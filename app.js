// Live session: camera, pose model, pre-shot check, swing detection, ball detection, the coach's voice and listening.
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { CAMERA, BAG, clubById } from "./rules.js?v=15";
import { features, frameHint, pickGolfer, SwingDetector, analyze, runChecks, setupCheck, setupMetrics, averageFeatures, coach, ruleById,
  dispute, skipFocus, buildPlan, calibrationPlan, keyTimes, groupOf, ballRoi, detectBall, ballHit, resOf } from "./engine.js?v=15";
import { parseUtterance } from "./voice.js?v=15";
import { L, T, blockCall } from "./lines.js?v=15";
import * as Speech from "./speech.js?v=15";
import * as Listen from "./listen.js?v=15";
import { artFor } from "./art.js?v=15";
import { DB, S, save, frames } from "./store.js?v=15";
import * as views from "./views.js?v=15";

const $ = (s) => document.querySelector(s);
const camWord = (v) => (v === "dtl" ? "camera behind" : "camera in front");
const clubOptions = () => BAG.filter((c) => S.bag.includes(c.id)).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------- Voice out ----------------
let lastSpeech = "", lastDetail = "", readyCount = 0, sorryCount = 0;
function applyVoiceSettings() { Speech.configure({ enabled: S.voice, voiceId: S.voiceId || "michael", rate: S.voiceSpeed || 1, fallbackVoice: S.voiceName || "" }); }
applyVoiceSettings();
export function say(text, { force = false, queue = false, remember = false } = {}) {
  if (!text) return;
  if (remember) lastSpeech = text;
  if (!S.voice && !force) return;
  if (force && !S.voice) { Speech.configure({ enabled: true }); Speech.say(text, { queue }).then(() => Speech.configure({ enabled: S.voice })); return; }
  Speech.say(text, { queue });
}
export function voices() { return ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => /^en/.test(v.lang)); }
export { applyVoiceSettings };

// ---------------- Voice in ----------------
let captionTimer = 0;
function caption(text, kind = "") {
  const el = $("#caption"); if (!el) return;
  el.textContent = text; el.className = "caption " + kind; el.hidden = !text;
  clearTimeout(captionTimer); if (text) captionTimer = setTimeout(() => (el.hidden = true), kind === "heard" ? 2600 : 1800);
}
function updateMic(state = Listen.getState()) {
  const p = $("#micPill");
  const label = { on: "Listening", starting: "Starting mic", off: S.mic ? "Mic paused" : "Mic off", blocked: "Mic blocked", homescreen: "Voice needs Safari", unsupported: "No voice input" }[state] || "Mic off";
  p.textContent = label; p.className = "pill " + (state === "on" ? "ok" : state === "blocked" || state === "homescreen" ? "off" : "");
}
Listen.init({ result: onVoice, interim: (t) => caption(t, "interim"), state: updateMic });
function startListening() { if (!S.mic || !running) return; Listen.setLang(S.voiceLang || "en-US"); Listen.start(); }
function stopListening() { Listen.stop(); }
$("#micPill").onclick = () => {
  if (Listen.reason === "homescreen") { showVoiceNote(true); return; }
  if (Listen.getState() === "on" || Listen.getState() === "starting") { S.mic = false; stopListening(); Speech.audioMode("playback"); }
  else { S.mic = true; Speech.audioMode("play-and-record"); startListening(); }
  save(); updateMic();
};
function showVoiceNote(show) { const n = $("#voiceNote"); if (n) n.hidden = !show; }
$("#voiceNoteClose") && ($("#voiceNoteClose").onclick = () => showVoiceNote(false));
$("#voiceNoteOpen") && ($("#voiceNoteOpen").onclick = () => { location.href = Listen.safariLink(); });

// ---------------- Pose model ----------------
// The full model measures fine positions (head, hands, short strokes) clearly better than the lite one in the
// photo exam (test/photo-exam.test.mjs), so it is the default. If this phone cannot keep up (under 18 frames a
// second for 5 seconds) the app switches to the lite model once and remembers it.
let landmarker = null, vision = null, poseModel = S.poseModel || "full", swapping = false, slowFullSince = 0;
const MODEL_URL = (k) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${k}/float16/1/pose_landmarker_${k}.task`;
async function makeLandmarker(kind) {
  vision ??= await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const make = (delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL(kind), delegate },
    runningMode: "VIDEO", numPoses: 2, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { return await make("GPU"); } catch (e) { return await make("CPU"); }
}
async function initModel() {
  try { landmarker = await makeLandmarker(poseModel); }
  catch (e) { if (poseModel === "lite") throw e; poseModel = "lite"; landmarker = await makeLandmarker("lite"); }
}
function useLiteModel() {
  if (swapping || poseModel === "lite") return;
  swapping = true;
  makeLandmarker("lite").then((lm) => { const old = landmarker; landmarker = lm; poseModel = S.poseModel = "lite"; save(); try { old?.close(); } catch (e) {} })
    .catch(() => {}).finally(() => { swapping = false; slowFullSince = 0; });
}
const modelReady = initModel().then(() => views.setModelState(`Camera coach ready (${poseModel === "full" ? "precise" : "fast"} model). It works offline from now on.`))
  .catch((e) => views.setModelState("Could not load the pose model. Check your internet and reopen the app. " + e.message));

// ---------------- Session state ----------------
const video = $("#video"), canvas = $("#overlay"), ctx = canvas.getContext("2d");
const snap = document.createElement("canvas"), snapCtx = snap.getContext("2d", { willReadFrequently: true });
const det = new SwingDetector();
let stream = null, running = false, paused = false, session = null, lastSwing = null, wakeLock = null, sessionMode = "free";
let lock = null, lockMissSince = 0, lastHintAt = 0, notOkSince = 0, lastVideoTime = -1, status = "", curPoses = [];
let fpsCount = 0, fpsT0 = 0, fps = 30, slowSince = 0, slowWarned = false, endArmed = 0, lastPoses = 0, timeWarned = {};
let pre = null; // pre-shot state for the current setup
const currentBlock = () => session?.plan?.blocks[session.blockIdx] || null;
const group = () => groupOf(S.clubId, sessionMode === "plan" ? currentBlock()?.cat : null);

function setStatus(text, cls = "") { if (status === text) return; status = text; const el = $("#status"); el.textContent = text; el.className = "pill " + cls; }
function guide(text) { $("#guide").textContent = text; $("#guide").hidden = !text; }
// The verdict card: a big word, what it is about, the cue, and the picture of the right position.
function verdict(kind, word, what, cue, ruleId = null) {
  $("#verdict").className = "verdict " + kind; $("#vWord").textContent = word; $("#vWhat").textContent = what; $("#vCue").textContent = cue || "";
  const a = ruleId ? artFor(ruleId) : null, pic = $("#vPic");
  if (a && pic) { pic.innerHTML = a.figure("good", true); pic.hidden = false; } else if (pic) { pic.hidden = true; pic.innerHTML = ""; }
}

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } }, audio: false });
  video.srcObject = stream; await video.play().catch(() => {});
}

export async function start(kind) {
  const calib = kind === "calib";
  sessionMode = kind === "free" ? "free" : "plan"; running = true; paused = false; readyCount = 0; sorryCount = 0;
  Speech.unlock(); applyVoiceSettings(); // sound must be unlocked inside the tap
  Speech.audioMode(S.mic ? "play-and-record" : "playback");
  say(L.start[calib ? "calib" : kind === "free" ? "free" : "plan"], { force: true });
  startListening();
  $("#live").hidden = false; document.body.classList.add("live-on"); updateMic();
  showVoiceNote(S.mic && Listen.reason === "homescreen" && !S.voiceNoteSeen); if (Listen.reason === "homescreen") { S.voiceNoteSeen = true; save(); }
  $("#clubLive").innerHTML = clubOptions(); $("#clubLive").value = S.clubId; $("#viewLive").value = S.view;
  try { await startCamera(); }
  catch (e) { running = false; stopListening(); setStatus("Camera blocked", "off"); verdict("", "Camera", "Camera access needed", "Allow the camera for this site: in Safari tap the aA button, Website Settings, Camera, Allow. Then start again."); return; }
  await modelReady;
  if (!landmarker) { running = false; stopListening(); verdict("", "Error", "The pose model did not load", "Check your internet and reopen the app."); return; }
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  Speech.prefetch();
  const opts = { venue: S.venue, total: S.balls, minutes: S.minutes, bag: S.bag, sessions: DB.sessions, rounds: DB.rounds };
  session = { id: uid(), start: Date.now(), venue: S.venue, swings: [], disputes: {}, muted: [], voiceLog: [] };
  if (calib) { session.calib = { mic: null }; session.plan = calibrationPlan(opts); }
  else if (sessionMode === "plan") session.plan = buildPlan(opts);
  if (session.plan) { session.blockIdx = 0; session.blockDone = 0; }
  DB.sessions.push(session); save();
  det.reset(); lock = null; lastSwing = null; slowWarned = false; pre = null; timeWarned = {};
  $("#thumbs").hidden = true; $("#res").hidden = true; $("#count").textContent = "0 swings"; $("#vTempo").textContent = "";
  $("#nextBtn").hidden = sessionMode !== "plan"; $("#viewLive").disabled = sessionMode === "plan"; $("#clubLive").disabled = sessionMode === "plan";
  $("#pauseBtn").textContent = "Pause";
  verdict("", "Address", "Get into your setup", "Stand still over the ball. I check your setup, then say Ready.");
  if (calib && S.mic && Listen.available) {
    verdict("", "Voice", "Voice test", 'Say: "straight"');
    say(L.voiceTest, { queue: true });
    setTimeout(() => {
      if (!session?.calib || session.calib.mic) return;
      session.calib.mic = "no"; save();
      say(L.voiceFail, { queue: true });
      verdict("", "Address", "Get into your setup", "Stand still over the ball. I check your setup, then say Ready."); applyBlock(true, true);
    }, 16000);
    renderBlockbar();
  } else if (sessionMode === "plan") { if (calib) session.calib.mic = Listen.available ? "off" : Listen.reason; applyBlock(true, calib); }
  else { det.club = group(); guide(CAMERA[S.view]); renderBlockbar(); }
  requestAnimationFrame(loop);
}

function minutesLeft() { return session?.plan?.minutes ? Math.round(session.plan.minutes - (Date.now() - session.start) / 60000) : null; }
function applyBlock(first, queue = !first) {
  const b = currentBlock(); if (!b) return;
  S.clubId = b.cat === "random" ? b.sequence[0] : b.clubId; S.view = b.view; det.club = group(); save();
  $("#clubLive").value = S.clubId; $("#viewLive").value = b.view;
  guide(`${b.name}, ${b.balls} ${b.cat === "putt" ? "putts" : "balls"}. ${CAMERA[b.view]}`);
  say(blockCall(b, session.blockIdx, session.plan.blocks.length, { first, name: S.profile.name, clubId: S.clubId, minutes: minutesLeft() }), { queue });
  renderBlockbar();
}
function advanceBlock(manual) {
  if (sessionMode !== "plan" || !session) return;
  if (session.blockIdx < session.plan.blocks.length - 1) {
    session.blockIdx++; session.blockDone = 0; save();
    if (!manual) say(L.blockDone, { queue: true });
    applyBlock(false);
  } else {
    session.blockIdx = session.plan.blocks.length; renderBlockbar();
    if (session.calib) { S.calibDoneAt = Date.now(); say(L.calibDone, { queue: true }); }
    else say(L.planDone, { queue: true });
    save();
  }
}
function renderBlockbar() {
  const bb = $("#blockbar");
  if (sessionMode !== "plan") { bb.innerHTML = `<div class="top"><span><b>${clubById(S.clubId).name}</b> free practice</span><span>${camWord(S.view)}</span></div>`; return; }
  const blocks = session.plan.blocks, b = currentBlock(), n = blocks.length, left = minutesLeft();
  const seg = blocks.map((x, i) => (i < session.blockIdx ? '<i class="done"></i>' : i === session.blockIdx ? `<i class="now" style="--p:${Math.round((100 * session.blockDone) / x.balls)}%"></i>` : "<i></i>")).join("");
  const time = left != null ? `, ${Math.max(0, left)} min left` : "";
  if (!b) { bb.innerHTML = `<div class="top"><span><b>${session.calib ? "Calibration" : "Plan"} done</b></span><span>${n} blocks</span></div><div class="segbar">${seg}</div>`; return; }
  const clubTxt = b.cat === "random" ? `Random: ${clubById(S.clubId).name}` : b.name;
  bb.innerHTML = `<div class="top"><span><b>${clubTxt}</b> ${session.blockDone} of ${b.balls}</span><span>${session.calib ? "Calibration" : "Block"} ${session.blockIdx + 1} of ${n}, ${camWord(b.view)}${time}</span></div><div class="segbar">${seg}</div>`;
}

function stop() {
  running = false; paused = false; stopListening(); Speech.stop(); Speech.audioMode("playback");
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  try { wakeLock?.release(); } catch (e) {} wakeLock = null;
  const s = session; session = null;
  if (s) { s.ttsMissing = Speech.missingSentences(); }
  if (s && !s.swings.length) DB.sessions = DB.sessions.filter((x) => x !== s);
  save(); $("#live").hidden = true; document.body.classList.remove("live-on"); showVoiceNote(false);
  if (s?.swings.length) views.openReport(s.id, "today"); else views.go("today");
  views.pruneFrames().catch(() => {});
}
function setPaused(p) {
  if (!running) return;
  paused = p; det.reset(); pre = null;
  $("#pauseBtn").textContent = p ? "Resume" : "Pause";
  Speech.earcon(p ? "pause" : "resume");
  if (p) { verdict("", "Paused", "Session paused", 'Say "resume" or tap Resume.'); setStatus("Paused", "busy"); say(L.paused); }
  else { verdict("", "Address", "Get into your setup", "Stand still over the ball. I check your setup, then say Ready."); say(L.backOn); }
}
$("#endBtn").onclick = () => {
  const now = Date.now();
  if (now - endArmed < 3000) { stop(); return; }
  endArmed = now; $("#endBtn").textContent = "Tap again to end"; setTimeout(() => ($("#endBtn").textContent = "End"), 3000);
};
$("#pauseBtn").onclick = () => setPaused(!paused);
$("#nextBtn").onclick = () => advanceBlock(true);
$("#lockPill").onclick = () => { lock = null; say(L.lookAgain); };
document.addEventListener("visibilitychange", async () => {
  if (!running) return;
  if (document.visibilityState !== "visible") { stopListening(); return; } // iPhone kills listening in the background
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  if (!stream || stream.getTracks().every((t) => t.readyState === "ended")) { try { await startCamera(); } catch (e) {} }
  Speech.unlock(); startListening();
});

// ---------------- Frame loop ----------------
function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const res = landmarker.detectForVideo(video, now), poses = res.landmarks || [];
    curPoses = poses;
    const g = pickGolfer(poses, lock);
    let lm = null;
    if (g.idx >= 0) { lm = poses[g.idx]; lock = g.lock; lockMissSince = 0; }
    else { if (!lockMissSince) lockMissSince = now; if (lock && now - lockMissSince > 2500 && det.state !== "swing") lock = null; }
    const lt = lm ? (poses.length > 1 ? "On you, 1 other ignored" : "Locked on you") : "Looking for you";
    if ($("#lockPill").textContent !== lt) $("#lockPill").textContent = lt;
    const f = features(lm, video.videoWidth, video.videoHeight, S.view);
    if (!paused) { capture(now, f); handle(now, f); }
    draw(poses, g.idx, f);
    fpsCount++;
    if (now - fpsT0 > 1000) {
      fps = (fpsCount * 1000) / (now - fpsT0); fpsCount = 0; fpsT0 = now;
      if (poseModel === "full" && fps < 18) { slowFullSince ||= now; if (now - slowFullSince > 5000 && det.state !== "swing") useLiteModel(); } else slowFullSince = 0;
      if (fps < 12) { slowSince ||= now; if (!slowWarned && now - slowSince > 4000) { slowWarned = true; say(L.slow); } } else slowSince = 0;
      const left = minutesLeft();
      if (left != null) for (const mk of [15, 5, 0]) if (left <= mk && !timeWarned[mk]) { timeWarned[mk] = 1; say(mk ? T.minutes(mk) : L.timeUp, { queue: true }); }
    }
  }
  requestAnimationFrame(loop);
}

function handle(now, f) {
  const ev = det.push(now, f);
  if (det.state === "swing") setStatus("Swing", "busy");
  else if (det.state === "address") setStatus(pre?.ready ? "Ready, hit when you want" : "Checking your setup", "ok");
  else if (det.state === "cooldown") setStatus("Checking", "busy");
  else setStatus(f.ok ? "Get into your setup" : "Step into the picture");
  if (det.state === "idle") {
    if (pre && now - pre.t > 1500) pre = null;
    const hint = frameHint(f, S.view);
    if (hint) {
      if (!notOkSince) notOkSince = now;
      if (now - notOkSince > 2500 && now - lastHintAt > 12000) { say(hint); guide(hint); lastHintAt = now; }
    } else { notOkSince = 0; if (now - lastHintAt > 5000 && !$("#guide").hidden) guide(""); }
  }
  if (det.state === "address") preShot(now);
  if (ev?.type === "swing") { Speech.earcon("swing"); onSwing(ev); }
}

// ---------------- Ball detection on the current frame ----------------
function frameImage() {
  const w = video.videoWidth, h = video.videoHeight; if (!w) return null;
  if (snap.width !== w || snap.height !== h) { snap.width = w; snap.height = h; }
  snapCtx.drawImage(video, 0, 0, w, h);
  try { return snapCtx.getImageData(0, 0, w, h); } catch (e) { return null; }
}
function findBall(addrFeat) {
  if (group() === "bunker" || !addrFeat) return null;
  const roi = ballRoi(addrFeat, S.view); if (!roi) return null;
  return detectBall(frameImage(), roi);
}

// ---------------- Pre-shot check ----------------
function preShot(now) {
  if (!det.addr || group() === "warmup") return;
  if (pre && now - pre.t < 700) return;
  const still = det.hist.filter((h) => h.t >= det.addr.t0 && h.f.ok).map((h) => h.f);
  const a = averageFeatures(still); if (!a) return;
  const ball = findBall(a);
  const m = setupMetrics(a, S.view, S.clubId, group(), ball);
  const sc = setupCheck(m, group(), S.view, { selected: S.prechecks, muted: session.muted, tune: DB.coach.tune });
  const prev = pre;
  pre = { t: now, addr: a, ball: ball || prev?.ball || null, m, sc, ready: sc.ready, said: prev?.said || [], readySaid: prev?.readySaid || false, lastSay: prev?.lastSay || 0, lastId: prev?.lastId || null };
  if (session.calib || !S.preshot) return; // calibration: logged, never spoken
  if (!sc.ready) {
    pre.readySaid = false;
    verdict("bad", "Setup", ruleById(sc.next.id).title, sc.fix, sc.next.id);
    if (sc.next.id !== pre.lastId || now - pre.lastSay > 5000) { say(sc.fix); pre.lastId = sc.next.id; pre.lastSay = now; pre.said.push(sc.next.id); }
  } else if (!pre.readySaid) {
    pre.readySaid = true; readyCount++;
    verdict("good", "Ready", "Setup looks right", "Hit when you want.");
    Speech.earcon("ready"); if (readyCount <= 3) say(L.ready); // after a few, the chime alone means ready
  }
}

// ---------------- After the swing ----------------
function onSwing(sw) {
  const grp = group(), clubId = S.clubId, blk = currentBlock(), view = S.view;
  const p0 = pre; pre = null;
  const addrFeat = p0?.addr || averageFeatures(sw.frames.filter((x) => x.t <= sw.addr.t1 + 60).map((x) => x.f));
  const before = p0?.ball ?? null, after = before ? findBall(addrFeat) : null, hit = ballHit(before, after);
  let m;
  try { m = analyze(sw, view, { clubId, group: grp, ball: before }); } catch (e) { console.warn(e); return; }
  const checks = grp === "warmup" ? [] : runChecks(m, grp, view, { kind: "motion", muted: session.muted, tune: DB.coach.tune });
  const sc = p0?.sc || setupCheck(m, grp, view, { selected: S.prechecks, muted: session.muted, tune: DB.coach.tune });
  const q = { fps: Math.round(fps), poses: lastPoses, down: m.downFrames, model: poseModel };
  const recW = {
    id: uid(), t: Date.now(), clubId, club: grp, cat: blk ? (blk.cat === "random" ? clubById(clubId).cat : blk.cat) : clubById(clubId).cat, block: blk?.phase || null, blockIdx: session.blockIdx ?? null,
    view, m, checks, setup: { checks: sc.checks, logged: sc.logged, ready: sc.ready, notReady: !sc.ready && !session.calib, said: p0?.said || [] },
    ball: { before, after, hit }, q, voice: [], calib: !!session.calib,
    addrLm: addrFeat ? addrFeat.p.map((pt) => [Math.round((pt.x / video.videoWidth) * 1000) / 1000, Math.round((pt.y / video.videoHeight) * 1000) / 1000]) : null,
  };
  lastPoses = 0;
  // Practice swing: the ball is still there, or no ball was under you once detection has proven reliable here
  const autoPractice = S.autoPractice && !session.calib && grp !== "bunker" && (hit === false || (hit === null && ballReliability() >= 0.8));
  session.swings.push(recW); lastSwing = recW;
  renderThumbs(sw, recW.id, before);
  $("#vTempo").textContent = m.tempoRatio ? `Tempo ${m.tempoRatio.toFixed(1)} : 1` : "";
  if (autoPractice) {
    recW.practice = "auto";
    verdict("", "Practice", "Practice swing, not counted", hit === false ? "The ball is still there." : "No ball under you.");
    save(); return;
  }
  for (const c of sc.checks) if (c.pass) DB.coach.lastPass[c.id] = recW.id; // your own photo in the Library
  const realCount = session.swings.filter((w) => !w.practice).length;
  if (session.calib || grp === "warmup") {
    const n = blk ? T.ofN(session.blockDone + 1, blk.balls) : L.gotIt;
    verdict("", session.calib ? "Captured" : "Warm up", `${clubById(clubId).name}, ${camWord(view)}`, session.calib ? "No corrections during calibration. Say how it flew." : L.warmup);
    say(n + (realCount === 1 ? " " + L.firstFlight : ""), { remember: true });
  } else {
    const r = coach(DB.coach, checks, m, grp, view, S.mode, { name: S.profile.name, reason: S.reason, swingId: recW.id, seed: realCount });
    recW.items = r.items; recW.focus = r.focusId; recW.said = r.speech; recW.lowFails = r.lowFails;
    lastDetail = r.detail;
    const first = r.items[0], nr = recW.setup.notReady && S.preshot ? " " + L.hitEarly : "";
    if (first) verdict(first.pass ? "good" : "bad", first.pass ? "Good" : "Fix", ruleById(first.id).title, r.speech + nr, first.pass ? null : first.id);
    else verdict("good", "Good", "Nothing to fix from this side", r.speech + nr);
    say(r.speech, { remember: true });
  }
  countSwing(recW);
  if (S.ask) { $("#res").hidden = false; $("#res").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); }
  save();
}
function countSwing(w) {
  $("#count").textContent = `${session.swings.filter((x) => !x.practice).length} swings`;
  const blk = currentBlock();
  if (sessionMode === "plan" && blk && w.blockIdx === session.blockIdx) {
    session.blockDone++;
    if (blk.cat === "random" && session.blockDone < blk.balls) {
      S.clubId = blk.sequence[session.blockDone]; det.club = group(); $("#clubLive").value = S.clubId;
      say(T.nextClub(S.clubId), { queue: true });
    }
    renderBlockbar();
    if (session.blockDone >= blk.balls) advanceBlock(false);
  }
}
// Share of real shots (you said the flight) where the ball was seen at setup: proves detection works at this bay.
function ballReliability() {
  const w = session.swings.filter((x) => !x.practice && resOf(x)?.result).slice(-10);
  return w.length >= 5 ? w.filter((x) => x.ball?.before).length / w.length : 0;
}

// ---------------- Commands (voice or buttons) ----------------
function applyResult(parsed, text) {
  const w = lastSwing; if (!w) return false;
  if (w.practice === "auto") { w.practice = false; countSwing(w); } // you said how it flew, so it was a real shot
  const old = w.res || {}, add = {};
  for (const [k, v] of Object.entries(parsed)) if (v != null && v !== false && k !== "type" && k !== "words") add[k] = v;
  w.res = { ...old, ...add, words: text };
  $("#res").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === w.res.result)));
  save(); return true;
}
function setResultButton(value) {
  if (!lastSwing) return;
  if (value === "practice") return markPractice();
  applyResult({ result: value, sev: value === "straight" ? 0 : 2 }, "button");
}
function markPractice() {
  const w = lastSwing; if (!w || w.practice === true) return;
  const wasCounted = !w.practice; w.practice = true;
  if (!w.calib) for (const c of w.checks || []) { const h = DB.coach.hist[c.id]; if (h?.length) h.pop(); if (DB.coach.focus?.id === c.id && DB.coach.focus.hist.length) DB.coach.focus.hist.pop(); }
  if (sessionMode === "plan" && wasCounted) {
    if (w.blockIdx !== session.blockIdx) { session.blockIdx = w.blockIdx; session.blockDone = Math.max(0, currentBlock().balls - 1); S.clubId = w.clubId; det.club = group(); say(`${L.practiceMore} ${T.oneMoreWith(S.clubId)}`); }
    else { session.blockDone = Math.max(0, session.blockDone - 1); say(L.practice); }
    renderBlockbar();
  } else say(L.practice);
  $("#count").textContent = `${session.swings.filter((x) => !x.practice).length} swings`;
  save();
}
function markWrong() {
  const id = lastSwing?.items?.[0]?.id;
  if (!id || lastSwing.disputed) { say(L.nothingUndo); return; }
  lastSwing.disputed = id; dispute(DB.coach, id, lastSwing.m, lastSwing.club); // learns how far off the check was
  session.disputes[id] = (session.disputes[id] || 0) + 1;
  if (session.disputes[id] >= 2 && !session.muted.includes(id)) { session.muted.push(id); say(T.stopChecking(ruleById(id).title)); }
  else say(L.noCount);
  save();
}
function doSkip() { const n = skipFocus(DB.coach, group()); say(n ? T.newFocus(n.title) : L.noFocus); save(); }
function doStatus() {
  const left = minutesLeft(), t = left != null ? " " + T.minutes(Math.max(0, left)) : "";
  if (sessionMode === "plan" && currentBlock()) { const b = currentBlock(), nb = session.plan.blocks[session.blockIdx + 1]; say(`${T.leftWith(b.balls - session.blockDone)}${nb ? " " + T.thenClub(nb.clubId) : ""}${t}`); }
  else say(`${T.swingsSoFar(session.swings.filter((w) => !w.practice).length)}${t}`);
}
function doFocus() { const F = DB.coach.focus, r = F && ruleById(F.id); say(r ? `${T.yourFocus(r.title)} ${typeof r.cue === "string" ? r.cue : ""}` : L.noFocusYet); }
const explain = () => say(lastDetail || (DB.coach.focus ? ruleById(DB.coach.focus.id).rule : L.noFocusYet));
function onVoice(alts) {
  if (!running || !session || !alts.length) return;
  const text = alts[0] || "";
  let p = null, used = text;
  for (const a of alts) { p = parseUtterance(a); if (p) { used = a; break; } }
  const busy = Speech.isSpeaking();
  session.voiceLog.push({ t: Date.now(), text, alts: alts.slice(1, 4), parsed: !!p, duringSpeech: busy || undefined, swingId: lastSwing?.id || null });
  if (session.voiceLog.length > 400) session.voiceLog.shift();
  // While the coach talks only commands get through (you can interrupt: "stop", "pause", "repeat")
  if (busy && p?.type !== "command") return;
  if (session.calib && session.calib.mic == null) { // calibration voice test
    session.calib.mic = "ok"; session.calib.heard = text; save(); caption(`“${text}”`, "heard"); Speech.earcon("ok");
    say(L.voiceOk); verdict("", "Address", "Get into your setup", "Stand still over the ball. I check your setup, then say Ready."); applyBlock(true, true); return;
  }
  if (!p) {
    caption(`“${text}”`, "missed");
    if (lastSwing && Date.now() - lastSwing.t < 12000 && !lastSwing.res?.result) { Speech.earcon("oops"); if (sorryCount++ < 2) say(L.sorry); }
    return;
  }
  caption(`“${used}”`, "heard");
  if (p.type === "command") {
    if (busy || p.name === "hush") Speech.stop();
    switch (p.name) {
      case "hush": break;
      case "pause": setPaused(true); break;
      case "resume": if (paused) setPaused(false); break;
      case "practice": if (lastSwing && Date.now() - lastSwing.t < 40000) markPractice(); break;
      case "wrong": markWrong(); break;
      case "skip": doSkip(); break;
      case "repeat": say(lastSpeech || L.nothingYet); break;
      case "explain": explain(); break;
      case "focus": doFocus(); break;
      case "next": advanceBlock(true); break;
      case "status": doStatus(); break;
    }
    return;
  }
  if (!lastSwing || Date.now() - lastSwing.t > 40000) return;
  lastSwing.voice.push({ t: Date.now(), text: used });
  if (applyResult(p, used)) { Speech.earcon("ok"); if (p.result) say(T.echo(lastSwing.res)); }
}
$("#res").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setResultButton(b.dataset.r); });
$("#wrongBtn").onclick = markWrong; $("#skipBtn").onclick = doSkip;
$("#explainBtn").onclick = () => { Speech.unlock(); explain(); };
$("#clubLive").onchange = (e) => { S.clubId = e.target.value; det.club = group(); save(); renderBlockbar(); say(T.clubSaid(S.clubId)); };
$("#viewLive").onchange = (e) => { S.view = e.target.value; save(); guide(CAMERA[S.view]); renderBlockbar(); say(CAMERA[S.view]); };

// ---------------- Frames for the replay, the report and the export ----------------
// Each frame is cropped around you (fixed when you take your address) so the pictures stay sharp: 270 x 360.
const RING = 110, ring = [], CW = 270, CH = 360; let ringI = 0, capRoi = null;
function roiFor(f) {
  const W = video.videoWidth, H = video.videoHeight, bh = f.bodyH, h = Math.min(H, bh * 1.75), w = Math.min(W, h * 0.75);
  const cx = S.view === "dtl" ? (f.hp.x + f.hands.x) / 2 : f.hp.x, cy = (f.nose.y + Math.max(f.lAn.y, f.rAn.y)) / 2 - bh * 0.05; // behind: keep the ball in
  return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - h, cy - h / 2)), w, h };
}
function capture(t, f) {
  if (det.state === "address" || det.state === "swing") lastPoses = Math.max(lastPoses, curPoses.length);
  if (det.state !== "address" && det.state !== "swing" && det.state !== "cooldown") { capRoi = null; return; }
  if (!video.videoWidth) return;
  if (!capRoi) { if (!f.ok || !(f.bodyH > 0)) return; capRoi = roiFor(f); } // fixed from the address to the finish, so frames line up
  let e = ring[ringI % RING]; if (!e) e = ring[ringI % RING] = { c: document.createElement("canvas") };
  if (e.c.width !== CW || e.c.height !== CH) { e.c.width = CW; e.c.height = CH; }
  const r = capRoi, W = video.videoWidth, H = video.videoHeight;
  e.c.getContext("2d").drawImage(video, r.x, r.y, r.w, r.h, 0, 0, CW, CH);
  e.t = t; e.p = f.p ? f.p.map((q) => ({ x: (q.nx * W - r.x) / r.w, y: (q.ny * H - r.y) / r.h })) : null; e.roi = r; ringI++;
}
const nearestFrame = (t) => { let best = null; for (const e of ring) if (e?.t != null && e.p && (!best || Math.abs(e.t - t) < Math.abs(best.t - t))) best = e; return best; };
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const r3 = (v) => Math.round(v * 1000) / 1000;
function renderThumbs(sw, swingId, ball) {
  const kt = keyTimes(sw), list = ["setup", "top", "impact", "finish"].map((n) => nearestFrame(kt[n]));
  if (list.some((f) => !f)) { $("#thumbs").hidden = true; return; }
  const setup = list[0].p, roi = list[0].roi, W = video.videoWidth, H = video.videoHeight;
  const cvs = [...$("#thumbs").querySelectorAll("canvas")], imgs = [];
  for (const fr of list) { try { imgs.push(fr.c.toDataURL("image/jpeg", 0.8)); } catch (e) {} }
  cvs.forEach((cv, i) => {
    const g = cv.getContext("2d"), fr = list[i];
    g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(fr.c, 0, 0, cv.width, cv.height);
    const P = (q) => [q.x * cv.width, q.y * cv.height];
    g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,.8)"; g.lineCap = "round";
    for (const [a, b] of BONES) { g.beginPath(); g.moveTo(...P(fr.p[a])); g.lineTo(...P(fr.p[b])); g.stroke(); }
    g.strokeStyle = "#e3c25c"; g.setLineDash([5, 4]);
    const hips = P({ x: (setup[23].x + setup[24].x) / 2, y: (setup[23].y + setup[24].y) / 2 });
    if (i === 1) { g.beginPath(); g.moveTo(hips[0], 0); g.lineTo(hips[0], cv.height); g.stroke(); } // hips at setup: shows any sway
    if (i === 2) { const y = P(setup[0])[1]; g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); } // head height at setup
    g.setLineDash([]);
  });
  // Saved with the landmarks of each picture, so the report can draw the same guides as the Library on your swing
  if (swingId && imgs.length === 4) frames.put(swingId, { v: 2, w: CW, h: CH, img: imgs, lm: list.map((fr) => fr.p.map((q) => [r3(q.x), r3(q.y)])),
    ball: ball && roi ? [r3((ball.x - roi.x) / roi.w), r3((ball.y - roi.y) / roi.h)] : null });
  $("#thumbs").hidden = false;
}

// ---------------- Live drawing: you in colour, others in grey, the ghost of your best setup ----------------
function bestSetup() {
  const grp = group();
  for (let i = DB.sessions.length - 1; i >= 0; i--) {
    const ws = DB.sessions[i].swings || [];
    for (let j = ws.length - 1; j >= 0; j--) {
      const w = ws[j];
      if (w.addrLm && !w.practice && w.view === S.view && w.club === grp && w.setup?.ready && resOf(w)?.result === "straight") return w.addrLm;
    }
  }
  return null;
}
let ghostCache = { key: "", lm: null, t: 0 };
function draw(poses, idx, f) {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return;
  const sc = Math.min(r.width / vw, r.height / vh), ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
  const toScreen = (x, y) => [ox + x * vw * sc, oy + y * vh * sc];
  if (S.ghost && f.ok && (det.state === "idle" || det.state === "address") && !paused) {
    const key = S.clubId + S.view + group();
    if (ghostCache.key !== key || performance.now() - ghostCache.t > 10000) ghostCache = { key, lm: bestSetup(), t: performance.now() };
    const G = ghostCache.lm;
    if (G) {
      const gAnk = [(G[27][0] + G[28][0]) / 2, (G[27][1] + G[28][1]) / 2], gH = Math.max(G[27][1], G[28][1]) - G[0][1];
      const cAnk = [(f.lAn.x + f.rAn.x) / 2 / vw, (f.lAn.y + f.rAn.y) / 2 / vh], k = gH > 0 ? f.bodyH / vh / gH : 1;
      const Pg = (i) => toScreen(cAnk[0] + (G[i][0] - gAnk[0]) * k, cAnk[1] + (G[i][1] - gAnk[1]) * k);
      ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(227,194,92,.36)";
      for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(...Pg(a)); ctx.lineTo(...Pg(b)); ctx.stroke(); }
    }
  }
  poses.forEach((lm, k) => {
    const P = (i) => toScreen(lm[i].x, lm[i].y);
    ctx.lineWidth = k === idx ? 4 : 2; ctx.lineCap = "round";
    ctx.strokeStyle = k !== idx ? "rgba(160,166,170,.5)" : !f.ok ? "#e3c25c" : det.state === "address" ? (pre?.ready ? "#62c48d" : "#efe6c8") : "rgba(255,255,255,.85)";
    for (const [a, b] of BONES) { if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue; ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); }
  });
  const b = pre?.ball;
  if (b && det.state === "address") { const [x, y] = toScreen(b.x / vw, b.y / vh); ctx.strokeStyle = "#62c48d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, Math.max(7, b.d * sc), 0, Math.PI * 2); ctx.stroke(); }
}

views.init({ start, say, voices, speech: Speech, listen: Listen, applyVoiceSettings });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
