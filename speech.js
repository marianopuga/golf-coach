// The coach's voice. Pre-recorded neural voice clips (Kokoro, recorded once, stored with the app) played through
// Web Audio, so it sounds like a person and works offline. Sentences that were never recorded fall back to the
// best voice installed on the phone. Short sounds (earcons) confirm things without words.
import { sentences, keyOf } from "./lines.js?v=13";

export const VOICES = { michael: "Coach", deep: "Deep" };
let ctx = null, index = null, voiceId = "michael", loading = null;
const cache = new Map(), missing = new Set();
let chain = Promise.resolve(), gen = 0, current = [], speakingUntil = 0, synthBusy = false;
let opts = { enabled: true, rate: 1, fallbackVoice: "", volume: 1 };

export function configure(o) { opts = { ...opts, ...o }; if (o.voiceId && o.voiceId !== voiceId) { voiceId = o.voiceId; index = null; cache.clear(); loadIndex(); } }
export function loadIndex() {
  if (index) return Promise.resolve(index);
  return (loading ||= fetch(`voice/${voiceId}/index.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { index = j; loading = null; return j; }).catch(() => { loading = null; return null; }));
}
// iPhone only allows sound after a tap: call this from a button handler.
export function unlock() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== "running") ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (e) {}
  if ("speechSynthesis" in window) { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
  loadIndex();
}
// Tell iOS how audio is used: playback only, or playing and listening (sessions with the microphone on).
export function audioMode(mode) { try { if (navigator.audioSession) navigator.audioSession.type = mode; } catch (e) {} }

export const isSpeaking = () => synthBusy || (ctx ? ctx.currentTime < speakingUntil : false);
export const missingSentences = () => [...missing];

function clip(key) {
  if (!index?.clips?.[key]) return Promise.resolve(null);
  if (cache.has(key)) return cache.get(key);
  const p = fetch(`voice/${voiceId}/${index.clips[key][0]}`).then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? new Promise((res) => ctx.decodeAudioData(ab, res, () => res(null))) : null)).catch(() => null);
  cache.set(key, p);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return p;
}
export function prefetch(keys) { if (!ctx) return; loadIndex().then((ix) => { if (!ix) return; for (const k of keys || ix.hot || []) clip(k); }); }
// Background download of every clip (so the whole voice works offline); returns progress callbacks.
export async function downloadAll(onProgress) {
  const ix = await loadIndex(); if (!ix) return false;
  const files = Object.values(ix.clips).map((c) => c[0]); let done = 0;
  const work = async () => { while (files.length) { const f = files.pop(); try { await fetch(`voice/${voiceId}/${f}`); } catch (e) {} done++; onProgress?.(done, done + files.length); } };
  await Promise.all([work(), work(), work(), work()]);
  return true;
}

function playBuffer(buf, myGen) {
  return new Promise((res) => {
    if (myGen !== gen || !buf) return res();
    const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = opts.volume;
    src.buffer = buf; src.playbackRate.value = opts.rate || 1; src.connect(g).connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.01, speakingUntil);
    src.start(t); speakingUntil = t + buf.duration / (opts.rate || 1);
    current.push(src); src.onended = () => { current = current.filter((x) => x !== src); res(); };
  });
}
function bestSystemVoice() {
  const vs = ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => /^en/.test(v.lang));
  return (opts.fallbackVoice && vs.find((v) => v.name === opts.fallbackVoice)) || vs.find((v) => /premium/i.test(v.name) && v.lang === "en-US") ||
    vs.find((v) => /enhanced/i.test(v.name) && v.lang === "en-US") || vs.find((v) => v.lang === "en-US") || vs[0] || null;
}
function synth(text, myGen) {
  return new Promise((res) => {
    if (myGen !== gen || !("speechSynthesis" in window)) return res();
    const u = new SpeechSynthesisUtterance(text), v = bestSystemVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = 1; u.pitch = 1; synthBusy = true;
    const done = () => { synthBusy = false; res(); };
    u.onend = done; u.onerror = done; setTimeout(done, 1500 + text.length * 110);
    speechSynthesis.speak(u);
  });
}
// Stop talking now (a new urgent line, or the golfer said stop).
export function stop() {
  gen++; chain = Promise.resolve();
  for (const s of current) { try { s.stop(); } catch (e) {} } current = []; if (ctx) speakingUntil = ctx.currentTime;
  if ("speechSynthesis" in window) speechSynthesis.cancel(); synthBusy = false;
}
// Say text. queue: wait for what is being said; otherwise interrupt it.
export function say(text, { queue = false } = {}) {
  if (!text || !opts.enabled) return Promise.resolve();
  if (!queue) stop();
  const myGen = gen, parts = sentences(text);
  const bufs = parts.map((s) => (ctx ? clip(keyOf(s)) : Promise.resolve(null)));
  chain = chain.then(async () => {
    await loadIndex();
    for (let i = 0; i < parts.length; i++) {
      if (myGen !== gen) return;
      const buf = await bufs[i];
      if (buf) { await playBuffer(buf, myGen); await wait(0.11); }
      else { missing.add(parts[i]); if (speakingUntil && ctx) await waitUntil(speakingUntil); await synth(parts[i], myGen); }
    }
  });
  return chain;
}
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const waitUntil = (t) => new Promise((r) => setTimeout(r, Math.max(0, (t - ctx.currentTime) * 1000)));

// Earcons: tiny synthesized sounds. ready, ok (heard you), swing (camera caught it), oops (did not understand), pause
export function earcon(kind) {
  if (!ctx || !opts.enabled) return;
  const now = ctx.currentTime + 0.01;
  const tone = (f, t0, d, type = "sine", vol = 0.18) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + t0);
    g.gain.setValueAtTime(0, now + t0); g.gain.linearRampToValueAtTime(vol, now + t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, now + t0 + d);
    o.connect(g).connect(ctx.destination); o.start(now + t0); o.stop(now + t0 + d + 0.02);
  };
  if (kind === "ready") { tone(784, 0, 0.16); tone(1175, 0.11, 0.24); }
  else if (kind === "ok") tone(1046, 0, 0.12, "sine", 0.14);
  else if (kind === "swing") { tone(196, 0, 0.12, "triangle", 0.22); }
  else if (kind === "oops") { tone(330, 0, 0.12, "sine", 0.12); tone(262, 0.12, 0.16, "sine", 0.12); }
  else if (kind === "pause") { tone(523, 0, 0.14); tone(392, 0.12, 0.2); }
  else if (kind === "resume") { tone(392, 0, 0.14); tone(523, 0.12, 0.2); }
}
