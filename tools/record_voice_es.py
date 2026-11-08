#!/usr/bin/env python3
"""Graba cada frase del coach de casa con la voz neuronal Kokoro (Apache 2.0, corre sin internet) en clips MP3.

uso: python3 tools/record_voice_es.py catalogo.json kokoro-v1.0.onnx voices-v1.0.bin casa/voice alex
voces: alex (em_alex, acento latino) o dora (ef_dora)
"""
import sys, json, os, hashlib, subprocess, re
import numpy as np
from kokoro_onnx import Kokoro

cat_path, model, voices, out_dir, vid = sys.argv[1:6]
part, parts = (int(sys.argv[6]), int(sys.argv[7])) if len(sys.argv) > 7 else (0, 1)
items = json.load(open(cat_path))
k = Kokoro(model, voices)
voice = {"alex": "em_alex", "dora": "ef_dora"}[vid]
os.makedirs(os.path.join(out_dir, vid), exist_ok=True)

def tts_text(t):
    # palabras en inglés escritas como suenan en español
    t = re.sub(r"\bOk\b", "Okey", t)
    t = re.sub(r"\baddress\b", "adres", t)
    t = re.sub(r"\bswings\b", "suings", t)
    t = re.sub(r"\bswing\b", "suing", t)
    return t

def trim(x, sr, thr_db=-42, pad=0.035):
    a = np.abs(x); thr = 10 ** (thr_db / 20) * max(a.max(), 1e-6)
    idx = np.where(a > thr)[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(pad * sr)); e = min(len(x), idx[-1] + int(pad * 1.6 * sr))
    return x[s:e]

def encode(x, sr, path):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x * min(0.1 / rms, 0.95 / (np.abs(x).max() + 1e-9))
    fade = int(0.008 * sr); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
                        "-codec:a", "libmp3lame", "-b:a", "48k", path], input=x.astype(np.float32).tobytes())
    return p.returncode == 0

out = {}
mine = [it for i, it in enumerate(items) if i % parts == part]
for n, it in enumerate(mine):
    key, text = it["k"], it["t"]
    name = hashlib.md5(key.encode()).hexdigest()[:10] + ".mp3"
    path = os.path.join(out_dir, vid, name)
    if os.path.exists(path):
        out[key] = [name, None]; continue
    try:
        audio, sr = k.create(tts_text(text), voice=voice, speed=1.0, lang="es-419")
    except Exception as e:
        print("fail", text, e, file=sys.stderr); continue
    audio = trim(np.asarray(audio, dtype=np.float32), sr)
    if encode(audio, sr, path):
        out[key] = [name, int(len(audio) / sr * 1000)]
    if n % 50 == 0: print(vid, part, n, len(mine), flush=True)
json.dump(out, open(os.path.join(out_dir, vid, f"part{part}.json"), "w"))
print("done", vid, part, len(out))
