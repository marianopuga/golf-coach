// La voz del coach de casa. Frases grabadas una vez con la voz neuronal Kokoro (voz "Alex", acento latino),
// guardadas con la página y tocadas con Web Audio: suena como una persona y funciona sin internet.
// Si una frase no está grabada, la dice la mejor voz en español instalada en el equipo.
import { sentences, keyOf } from "./lines.js?v=3";

let ctx = null, index = null, voiceId = "alex", loading = null;
const cache = new Map();
let chain = Promise.resolve(), gen = 0, current = [], speakingUntil = 0, synthBusy = false;
let opts = { enabled: true, mode: "clips", systemVoice: "", volume: 1, muted: false };

export function configure(o) { opts = { ...opts, ...o }; }
export const options = () => ({ ...opts });
export function loadIndex() {
  if (index) return Promise.resolve(index);
  return (loading ||= fetch(`voice/${voiceId}/index.json`).then((r) => (r.ok ? r.json() : null))
    .then((j) => { index = j; loading = null; return j; }).catch(() => { loading = null; return null; }));
}
// El iPhone solo deja sonar después de un toque: llamar esto dentro de un botón.
export function unlock() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== "running") ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (e) {}
  if ("speechSynthesis" in window) { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
  loadIndex();
}
// En iPhone: solo reproducir, o reproducir y escuchar (cuando el micrófono está prendido).
export function audioMode(mode) { try { if (navigator.audioSession) navigator.audioSession.type = mode; } catch (e) {} }
export const isSpeaking = () => synthBusy || (ctx ? ctx.currentTime < speakingUntil : false);

function clip(key) {
  if (!ctx || !index?.clips?.[key]) return Promise.resolve(null);
  if (cache.has(key)) return cache.get(key);
  const p = fetch(`voice/${voiceId}/${index.clips[key][0]}`).then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? new Promise((res) => ctx.decodeAudioData(ab, res, () => res(null))) : null)).catch(() => null);
  cache.set(key, p);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return p;
}
export function prefetch() { loadIndex().then((ix) => { if (ix && ctx) for (const k of ix.hot || []) clip(k); }); }

function playBuffer(buf, myGen) {
  return new Promise((res) => {
    if (myGen !== gen || !buf) return res();
    const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = opts.volume;
    src.buffer = buf; src.connect(g).connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.01, speakingUntil);
    src.start(t); speakingUntil = t + buf.duration;
    current.push(src); src.onended = () => { current = current.filter((x) => x !== src); res(); };
  });
}

// Voces del sistema en español, de la más natural a la menos (Premium o Mejorada de Apple, la de Google en Chrome).
const NOVELTY = /eddy|flo|grandma|grandpa|abuel|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph/i;
const score = (v) => (/premium|mejorad|enhanced|natural|neural/i.test(v.name) ? 60 : 0) + (/google/i.test(v.name) ? 40 : 0)
  + (/es[-_](CL|419|MX|US|AR|CO)/i.test(v.lang) ? 10 : 0) + (v.localService ? 0 : 5) - (NOVELTY.test(v.name) ? 100 : 0);
export function systemVoices() {
  const vs = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  return vs.filter((v) => /^es/i.test(v.lang)).sort((a, b) => score(b) - score(a));
}
function bestSystemVoice() { const vs = systemVoices(); return (opts.systemVoice && vs.find((v) => v.name === opts.systemVoice)) || vs[0] || null; }
function synth(text, myGen) {
  return new Promise((res) => {
    if (myGen !== gen || !("speechSynthesis" in window)) return res();
    const u = new SpeechSynthesisUtterance(text), v = bestSystemVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "es-419";
    u.rate = 1; u.pitch = 1; u.volume = opts.volume; synthBusy = true;
    const done = () => { synthBusy = false; res(); };
    u.onend = done; u.onerror = done; setTimeout(done, 2000 + text.length * 90);
    speechSynthesis.speak(u);
  });
}
export function stop() {
  gen++; chain = Promise.resolve();
  for (const s of current) { try { s.stop(); } catch (e) {} }
  current = []; if (ctx) speakingUntil = ctx.currentTime;
  if ("speechSynthesis" in window) speechSynthesis.cancel(); synthBusy = false;
}
// Dice un texto o una lista de frases. queue: espera lo que se está diciendo; si no, lo interrumpe.
export function say(text, { queue = false, force = false } = {}) {
  if (!text || (!opts.enabled && !force) || (opts.muted && !force)) return Promise.resolve();
  if (!queue) stop();
  const myGen = gen, parts = sentences(text), useClips = opts.mode === "clips";
  const bufs = parts.map((s) => (useClips ? clip(keyOf(s)) : Promise.resolve(null)));
  chain = chain.then(async () => {
    if (useClips) await loadIndex();
    for (let i = 0; i < parts.length; i++) {
      if (myGen !== gen) return;
      const buf = await bufs[i];
      if (buf) { await playBuffer(buf, myGen); await wait(0.1); }
      else { if (ctx && speakingUntil) await waitUntil(speakingUntil); await synth(parts[i], myGen); }
    }
  });
  return chain;
}
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const waitUntil = (t) => new Promise((r) => setTimeout(r, Math.max(0, (t - ctx.currentTime) * 1000)));

// Sonidos cortos: listo (address), swing (la cámara lo vio), ok (te escuché), oops (no entendí), pausa, alerta.
export function earcon(kind) {
  if (!ctx || (opts.muted && kind !== "ok")) return;
  const now = ctx.currentTime + 0.01;
  const tone = (f, t0, d, type = "sine", vol = 0.16) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + t0);
    g.gain.setValueAtTime(0, now + t0); g.gain.linearRampToValueAtTime(vol, now + t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, now + t0 + d);
    o.connect(g).connect(ctx.destination); o.start(now + t0); o.stop(now + t0 + d + 0.02);
  };
  if (kind === "ready") { tone(784, 0, 0.14); tone(1175, 0.1, 0.22); }
  else if (kind === "swing") tone(196, 0, 0.12, "triangle", 0.2);
  else if (kind === "ok") tone(1046, 0, 0.12, "sine", 0.12);
  else if (kind === "oops") { tone(330, 0, 0.12); tone(262, 0.12, 0.16); }
  else if (kind === "pause") { tone(523, 0, 0.14); tone(392, 0.12, 0.2); }
  else if (kind === "alert") tone(880, 0, 0.14, "square", 0.08);
}
