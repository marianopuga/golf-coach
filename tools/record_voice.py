#!/usr/bin/env python3
"""Record every coach sentence with the Kokoro neural voice (Apache 2.0, runs offline) into small MP3 clips.

usage: python3 tools/record_voice.py catalog.json model.onnx voices.bin out_dir voice_id
voice_id: michael (am_michael) or deep (am_michael blended with am_onyx for a lower, calmer voice)
"""
import sys, json, os, hashlib, subprocess
import numpy as np
from kokoro_onnx import Kokoro

cat_path, model, voices, out_dir, vid = sys.argv[1:6]
items = json.load(open(cat_path))
k = Kokoro(model, voices)
style = {"michael": lambda: k.get_voice_style("am_michael"),
         "deep": lambda: 0.55 * k.get_voice_style("am_michael") + 0.45 * k.get_voice_style("am_onyx")}[vid]()
speed = {"michael": 1.0, "deep": 0.96}[vid]
os.makedirs(os.path.join(out_dir, vid), exist_ok=True)
idx_path = os.path.join(out_dir, vid, "index.json")
index = json.load(open(idx_path)) if os.path.exists(idx_path) else {"voice": vid, "clips": {}, "hot": []}

def tts_text(t):
    t = t.replace("OK,", "Okay,").replace("OK.", "Okay.").replace(" OK ", " okay ")
    return t

def trim(x, sr, thr_db=-42, pad=0.035):
    a = np.abs(x); thr = 10 ** (thr_db / 20) * max(a.max(), 1e-6)
    idx = np.where(a > thr)[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(pad * sr)); e = min(len(x), idx[-1] + int(pad * 1.6 * sr))
    return x[s:e]

def encode(x, sr, path):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x * min(0.1 / rms, 0.95 / (np.abs(x).max() + 1e-9))   # even loudness, no clipping
    fade = int(0.008 * sr); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
                        "-codec:a", "libmp3lame", "-b:a", "48k", path], input=x.astype(np.float32).tobytes())
    return p.returncode == 0

done = 0
for it in items:
    key, text = it["k"], it["t"]
    if key in index["clips"]: continue
    try:
        audio, sr = k.create(tts_text(text), voice=style, speed=speed, lang="en-us")
    except Exception as e:
        print("fail", text, e, file=sys.stderr); continue
    audio = trim(np.asarray(audio, dtype=np.float32), sr)
    name = hashlib.md5(key.encode()).hexdigest()[:10] + ".mp3"
    if encode(audio, sr, os.path.join(out_dir, vid, name)):
        index["clips"][key] = [name, int(len(audio) / sr * 1000)]
    done += 1
    if done % 50 == 0:
        json.dump(index, open(idx_path, "w")); print(vid, done, flush=True)
index["hot"] = [it["k"] for it in items if it.get("hot") and it["k"] in index["clips"]]
json.dump(index, open(idx_path, "w"))
print("done", vid, len(index["clips"]))
