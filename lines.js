// Everything the coach says, in one place. The same functions build the live speech and the list of
// sentences that are pre-recorded with the neural voice (tools/voice-catalog.mjs), so they always match.
import { RULES, BAG, CAMERA, clubById } from "./rules.js?v=13";

// Sentence split and lookup key, shared by the player and the recorder.
export function sentences(text) {
  return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"])/).map((s) => s.trim()).filter(Boolean);
}
export const keyOf = (s) => String(s).toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const lc = (s) => String(s).toLowerCase();
const clubName = (id) => lc(clubById(id).name);
const pick = (arr, seed) => arr[Math.abs(seed | 0) % arr.length];

export const L = {
  start: { calib: "Starting calibration.", free: "Starting free practice.", plan: "Starting your session." },
  voiceTest: "First a quick voice test. Say the word: straight.",
  voiceFail: "I didn't hear you. No problem, use the buttons for the ball flight.",
  voiceOk: "Perfect, I can hear you.",
  blockDone: "Block done.",
  calibDone: "Calibration done. Tap End, then export the file and send it to Claude.",
  planDone: "Plan done. Great work. Tap End to see your report.",
  paused: "Paused. Say resume when you're back.",
  backOn: "Back on.",
  lookAgain: "Looking for you again. Stand in the middle.",
  slow: "The camera is running slow, so I may miss things. Close other apps or let the phone cool down.",
  timeUp: "Your time is up.",
  ready: "Ready.",
  practice: "OK, practice, not counted.",
  practiceMore: "OK, practice.",
  nothingUndo: "Nothing to undo.",
  noCount: "OK, that one doesn't count.",
  noFocus: "No other focus right now.",
  nothingYet: "Nothing yet.",
  noFocusYet: "No focus yet. Hit a few balls first.",
  gotIt: "Got it.",
  firstFlight: "Now tell me how it flew. For example: straight, or big slice.",
  hitEarly: "You hit before you were ready.",
  goodSwing: ["Good swing.", "Nice swing.", "That's a good one.", "Solid."],
  good: ["Good.", "Nice.", "Yes.", "That's it."],
  also: "Also:",
  warmup: "Easy half swings.",
  calibNoCorrect: "Swing normally, I won't correct you.",
  halfEasy: "Half swings, easy.",
  retest: "Retest time.",
  shortGame: "Short game now.",
  sorry: "Sorry, say that again?",
  listeningOff: "Voice listening is off. Tap the microphone to turn it on.",
  welcomeBack: "Welcome back.",
};

// ---- Templates (each returns sentences; the domains are listed in catalog()) ----
export const T = {
  hello: (name) => `Here we go, ${name}.`,
  blockOf: (calib, i, n) => `${calib ? "Calibration" : "Block"} ${i} of ${n}.`,
  takeClub: (id) => `Take the ${clubName(id)}.`,
  randomClubs: (n) => `Random clubs, ${n} balls.`,
  firstClub: (id) => `First, the ${clubName(id)}.`,
  count: (n, putts) => `${n} ${putts ? (n === 1 ? "putt" : "putts") : n === 1 ? "ball" : "balls"}.`,
  camera: (view) => (view === "dtl" ? "Camera behind you." : "Camera in front of you."),
  minutes: (n) => (n === 1 ? "One minute left." : `${n} minutes left.`),
  ofN: (k, n) => `${k} of ${n}.`,
  nextClub: (id) => `Next: the ${clubName(id)}.`,
  leftWith: (n) => (n === 1 ? "One more with this club." : `${n} more with this club.`),
  thenClub: (id) => `Then the ${clubName(id)}.`,
  swingsSoFar: (n) => (n === 1 ? "One swing so far." : `${n} swings so far.`),
  oneMoreWith: (id) => `One more ball with the ${clubName(id)}.`,
  stopChecking: (title) => `OK. I'll stop checking ${lc(title)} today.`,
  newFocus: (title) => `New focus: ${lc(title)}.`,
  yourFocus: (title) => `Your focus: ${lc(title)}.`,
  fixedIt: (name, title) => `${name}, you fixed it: ${lc(title)}.`,
  nextFocus: (title) => `Next focus: ${lc(title)}.`,
  clubSaid: (id) => `${clubById(id).name}.`,
  echo: (r) => {
    if (!r?.result) return "";
    const sev = r.result === "straight" ? "" : r.sev === 3 ? "big " : r.sev === 1 ? "slight " : "";
    const s = `${sev}${r.result}${r.short ? ", short" : ""}.`;
    return s[0].toUpperCase() + s.slice(1);
  },
  praise: (seed) => pick(L.goodSwing, seed),
  good: (seed) => pick(L.good, seed),
  testVoice: (name) => `Hi ${name}. Turn your chest away, and let the arms follow. Your body makes the speed.`,
};

// ---- Composed lines used by the live session ----
export function blockCall(b, idx, n, opts) {
  const out = [];
  if (opts.first) out.push(T.hello(opts.name));
  out.push(T.blockOf(b.phase === "calib", idx + 1, n));
  if (b.cat === "random") { out.push(T.randomClubs(b.balls), T.firstClub(opts.clubId)); }
  else out.push(T.takeClub(b.clubId), T.count(b.balls, b.cat === "putt"));
  out.push(T.camera(b.view));
  if (b.phase === "calib") out.push(L.calibNoCorrect);
  else if (b.phase === "warmup") out.push(L.halfEasy);
  else if (b.phase === "retest") out.push(L.retest);
  else if (b.short && !opts.first) out.push(L.shortGame);
  if (opts.minutes != null && !opts.first) out.push(T.minutes(Math.max(0, opts.minutes)));
  return out.join(" ");
}

// ---- Every sentence the app can say, for the recorder ----
export const RESULTS = ["straight", "slice", "hook", "push", "pull", "thin", "fat", "top", "shank", "sky"];
export function catalog({ name = "Mariano", maxBlock = 20, maxBalls = 30, maxMinutes = 120, maxSwings = 150 } = {}) {
  const set = new Map(); // key -> { text, hot }
  const addText = (text, hot = false) => { for (const s of sentences(text)) { const k = keyOf(s); if (!k) continue; if (!set.has(k)) set.set(k, { text: s, hot }); else if (hot) set.get(k).hot = true; } };
  const each = (v, hot) => (Array.isArray(v) ? v.forEach((x) => addText(x, hot)) : typeof v === "object" ? Object.values(v).forEach((x) => each(x, hot)) : addText(v, hot));
  each(L, true);
  const clubs = BAG.map((c) => c.id);
  addText(T.hello(name), true);
  for (let n = 1; n <= maxBlock; n++) for (let i = 1; i <= n; i++) { addText(T.blockOf(false, i, n)); addText(T.blockOf(true, i, n)); addText(T.ofN(i, n)); }
  for (let n = 1; n <= maxBalls; n++) { addText(T.count(n, false), n <= 15); addText(T.count(n, true)); addText(T.randomClubs(n)); addText(T.leftWith(n)); }
  for (const id of clubs) [T.takeClub, T.firstClub, T.nextClub, T.thenClub, T.oneMoreWith, T.clubSaid].forEach((f, j) => addText(f(id), j === 0 || j === 2));
  addText(T.camera("dtl"), true); addText(T.camera("face"), true);
  for (let n = 0; n <= maxMinutes; n++) addText(T.minutes(n), [15, 5, 1].includes(n));
  for (let n = 1; n <= maxSwings; n++) addText(T.swingsSoFar(n));
  addText(T.testVoice(name), true);
  for (const r of RESULTS) for (const sev of r === "straight" ? [0] : [1, 2, 3]) for (const short of [false, true]) addText(T.echo({ result: r, sev, short }), !short);
  // the rules: cues, reasons, "ok" lines, setup fixes and the long explanations
  const strings = (v) => (typeof v === "function" ? (v.toString().match(/"([^"\\]|\\.)*"/g) || []).map((s) => JSON.parse(s)) : v ? [v] : []);
  for (const r of RULES) {
    for (const k of ["cue", "ok", "why", "fix"]) for (const s of strings(r[k])) addText(s, r.auto);
    if (r.rule) addText(r.rule, false);
    if (r.title) { addText(T.stopChecking(r.title)); addText(T.newFocus(r.title)); addText(T.yourFocus(r.title)); addText(T.fixedIt(name, r.title)); addText(T.nextFocus(r.title)); }
    for (const s of strings(r.cue)) { const first = sentences(s)[0]; if (first) addText(`${L.also} ${first}`, true); }
  }
  Object.values(CAMERA).forEach((t) => addText(t));
  return set;
}
