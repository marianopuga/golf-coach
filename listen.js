// Listening. Uses the phone's own speech recognition (free, fast, good with golf words) and keeps it alive:
// iPhone stops it after every phrase and sometimes hangs, so it restarts quickly and a watchdog replaces a stuck one.
// Note: iPhone does not allow speech recognition in apps opened from the Home Screen, only in Safari itself.
const Rec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
export const standalone = typeof window !== "undefined" && (navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);
export const available = !!Rec && !(isIOS && standalone);
export const reason = !Rec ? "unsupported" : isIOS && standalone ? "homescreen" : "";
export const safariLink = () => "x-safari-" + location.href.split("#")[0];

let rec = null, want = false, state = available ? "off" : "unsupported", lang = "en-US";
let cb = { result: () => {}, interim: () => {}, state: () => {}, speech: () => {} };
let startedAt = 0, lastEvent = 0, fails = 0, watchdog = 0;
const now = () => Date.now();
function setState(s) { if (s !== state) { state = s; cb.state(s); } }
export const getState = () => state;

export function init(handlers) { cb = { ...cb, ...handlers }; }
export function setLang(l) { if (l && l !== lang) { lang = l; if (rec) { try { rec.abort(); } catch (e) {} } } }
export function start() {
  if (!available) { setState(state === "blocked" ? "blocked" : reason || "unsupported"); return; }
  want = true; spawn();
  clearInterval(watchdog);
  watchdog = setInterval(() => {
    if (!want) return;
    if (!rec) { spawn(); return; }
    // a recognizer that never started, or went silent for too long, is replaced
    if ((state !== "on" && now() - startedAt > 8000) || now() - lastEvent > 45000) { try { rec.abort(); } catch (e) {} rec = null; spawn(); }
  }, 3000);
}
export function stop() { want = false; clearInterval(watchdog); if (rec) { const r = rec; rec = null; try { r.abort(); } catch (e) {} } if (state === "on" || state === "starting") setState("off"); }

function spawn() {
  if (!want || rec || state === "blocked") return;
  let r;
  try { r = new Rec(); } catch (e) { setState("unsupported"); return; }
  rec = r; startedAt = now(); lastEvent = now(); setState("starting");
  r.lang = lang; r.continuous = !isIOS; r.interimResults = true; r.maxAlternatives = 5;
  r.onstart = () => { lastEvent = now(); fails = 0; setState("on"); };
  r.onaudiostart = r.onsoundstart = () => { lastEvent = now(); };
  r.onspeechstart = () => { lastEvent = now(); cb.speech(); };
  r.onresult = (e) => {
    lastEvent = now();
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i], alts = [];
      for (let j = 0; j < res.length; j++) alts.push(String(res[j].transcript || "").trim());
      if (res.isFinal) cb.result(alts.filter(Boolean)); else cb.interim(alts[0] || "");
    }
  };
  r.onerror = (e) => {
    lastEvent = now();
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { want = false; setState("blocked"); }
    else if (e.error !== "no-speech" && e.error !== "aborted") fails++;
  };
  r.onend = () => {
    if (rec === r) rec = null;
    if (!want || state === "blocked") { if (state !== "blocked") setState("off"); return; }
    setTimeout(spawn, fails ? Math.min(4000, 400 * fails) : 150);
  };
  try { r.start(); } catch (e) { rec = null; fails++; setTimeout(spawn, 800); }
}
