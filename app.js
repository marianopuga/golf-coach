// Live session: camera, pose model, swing detection, voice in and out.
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { CAMERA, BAG, clubById } from "./rules.js?v=7";
import { features, frameHint, pickGolfer, SwingDetector, analyze, runChecks, coach, ruleById,
  dispute, skipFocus, parseCommand, buildPlan, keyTimes, calibrationPlan } from "./engine.js?v=7";
import { DB, S, save } from "./store.js?v=7";
import * as views from "./views.js?v=7";

const $ = (s) => document.querySelector(s);
const camWord = (v) => (v === "dtl" ? "camera behind" : "camera in front");
const clubOptions = () => BAG.filter((c) => S.bag.includes(c.id)).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");

// ---------- Voice out ----------
let voice = null, speaking = false, speakTimer = 0, lastSpeech = "", lastDetail = "";
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en-(AU|GB)/.test(v.lang) && /Karen|Daniel|Samantha|Google/.test(v.name)) || vs.find((v) => v.lang.startsWith("en")) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, { force = false, queue = false, remember = false } = {}) {
  if (!text) return;
  if (remember) lastSpeech = text;
  if ((!S.voice && !force) || !("speechSynthesis" in window)) return;
  if (!queue) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.0; u.lang = voice?.lang || "en-AU";
  speaking = true;
  const done = () => { if (speechSynthesis.speaking || speechSynthesis.pending) return; clearTimeout(speakTimer); speakTimer = setTimeout(() => (speaking = false), 500); };
  u.onend = done; u.onerror = done;
  clearTimeout(speakTimer);
  speakTimer = setTimeout(() => (speaking = false), 2000 + text.length * 85);
  speechSynthesis.speak(u);
}

// ---------- Voice in (earphone microphone) ----------
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, micState = Rec ? "off" : "unsupported";
function updateMic() {
  const p = $("#micPill");
  const t = { on: "Mic listening", off: S.mic ? "Mic paused" : "Mic off", blocked: "Mic blocked, tap", unsupported: "No voice commands" }[micState];
  p.textContent = t; p.className = "pill " + (micState === "on" ? "ready" : micState === "blocked" ? "off" : "");
}
function startListening() {
  if (!Rec) { micState = "unsupported"; updateMic(); return; }
  if (!S.mic || !running || rec || micState === "blocked") return;
  try {
    const r = new Rec(); rec = r;
    r.lang = "en-US"; r.continuous = true; r.interimResults = false; r.maxAlternatives = 3;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; if (!res.isFinal) continue;
        const alts = []; for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
        onVoice(alts);
      }
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { micState = "blocked"; updateMic(); } };
    r.onend = () => { if (rec !== r) return; rec = null; if (micState === "blocked") return; micState = "off"; updateMic(); if (running && S.mic) setTimeout(startListening, 300); };
    r.start(); micState = "on"; updateMic();
  } catch (e) { rec = null; micState = "blocked"; updateMic(); }
}
function stopListening() {
  if (rec) { const r = rec; rec = null; try { r.abort(); } catch (e) {} }
  if (micState === "on") { micState = "off"; updateMic(); }
}
$("#micPill").onclick = () => {
  if (micState === "on") { S.mic = false; stopListening(); }
  else { S.mic = true; if (micState === "blocked") micState = "off"; startListening(); }
  save(); updateMic();
};

// ---------- Pose model ----------
let landmarker = null;
async function initModel() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const make = (delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate },
    runningMode: "VIDEO", numPoses: 2, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await make("GPU"); } catch (e) { landmarker = await make("CPU"); }
}
const modelReady = initModel().then(() => views.setModelState("Ready. The camera coach works offline from now on."))
  .catch((e) => views.setModelState("Could not load the pose model. Check your internet and reload. " + e.message));

// ---------- Live session ----------
const video = $("#video"), canvas = $("#overlay"), ctx = canvas.getContext("2d");
const det = new SwingDetector();
let stream = null, running = false, session = null, lastSwing = null, wakeLock = null, sessionMode = "free";
let lock = null, lockMissSince = 0, lastHintAt = 0, notOkSince = 0, lastVideoTime = -1, status = "";
let fpsCount = 0, fpsT0 = 0, fps = 30, slowSince = 0, slowWarned = false, swingsSinceHint = 99, endArmed = 0, lastPoses = 0;
const group = () => (sessionMode === "plan" && currentBlock()?.phase === "warmup") ? "wedge" : clubById(S.clubId).group;
const isCalibBlock = () => !!(session?.calib && currentBlock());
const currentBlock = () => session?.plan?.blocks[session.blockIdx] || null;

function setStatus(text, cls = "") { if (status === text) return; status = text; const el = $("#status"); el.textContent = text; el.className = "pill " + cls; }
function guide(text) { $("#guide").textContent = text; $("#guide").hidden = !text; }
function verdict(kind, word, what, cue) {
  $("#verdict").className = "verdict " + kind; $("#vWord").textContent = word; $("#vWhat").textContent = what; $("#vCue").textContent = cue || "";
}

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream; await video.play().catch(() => {});
}

async function start(kind) {
  const calib = kind === "calib"; if (calib) kind = "plan";
  sessionMode = kind; running = true;
  say(calib ? "Starting calibration." : kind === "plan" ? "Starting your plan." : "Starting free practice.", { force: true }); // first speech must come from a tap
  startListening(); // iPhone only allows the microphone to start from a tap
  $("#live").hidden = false; $("#clubLive").innerHTML = clubOptions(); $("#clubLive").value = S.clubId; $("#viewLive").value = S.view;
  try { await startCamera(); }
  catch (e) { running = false; stopListening(); setStatus("Camera blocked", "off"); verdict("", "CAMERA", "Camera access needed", "Allow camera access for this page in Safari settings, then try again."); return; }
  await modelReady;
  if (!landmarker) { running = false; stopListening(); verdict("", "ERROR", "Pose model did not load", "Check your internet and reload the app."); return; }
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  session = { id: String(Date.now()), start: Date.now(), swings: [], disputes: {}, muted: [] };
  if (calib) { session.calib = { mic: null }; session.plan = calibrationPlan(S.balls, S.bag); session.blockIdx = 0; session.blockDone = 0; }
  else if (kind === "plan") { session.plan = buildPlan(S.balls, S.bag, DB.sessions, DB.coach.focus ? ruleById(DB.coach.focus.id)?.view : null); session.blockIdx = 0; session.blockDone = 0; }
  DB.sessions.push(session); save();
  det.reset(); lock = null; lastSwing = null; slowWarned = false; swingsSinceHint = 99;
  $("#thumbs").hidden = true; $("#res").hidden = true; $("#count").textContent = "0 swings";
  $("#nextBtn").hidden = kind !== "plan"; $("#viewLive").disabled = kind === "plan"; $("#clubLive").disabled = kind === "plan";
  verdict("", "READY", "Get into your setup", "I start when you stand still.");
  if (calib && S.mic && Rec && micState !== "blocked") {
    // Voice test first, then the first block
    verdict("", "VOICE", "Voice test", "Say the word: straight");
    say("First a voice test. Say the word: straight.", { queue: true });
    setTimeout(() => {
      if (!session?.calib || session.calib.mic) return;
      session.calib.mic = "no"; save();
      say("I did not hear you. Use the buttons for the ball flight. For voice, check that Dictation is on in your iPhone settings.", { queue: true });
      verdict("", "READY", "Get into your setup", "I start when you stand still."); applyBlock(true, true);
    }, 16000);
    renderBlockbar();
  } else if (kind === "plan") { if (calib) session.calib.mic = "off"; applyBlock(true, calib); }
  else { det.club = group(); guide(CAMERA[S.view]); renderBlockbar(); }
  requestAnimationFrame(loop);
}

function applyBlock(first, queue = !first) {
  const b = currentBlock(); if (!b) return;
  S.clubId = b.clubId; S.view = b.view; det.club = group(); save();
  $("#clubLive").value = b.clubId; $("#viewLive").value = b.view;
  guide(`${b.name}, ${b.balls} balls. ${CAMERA[b.view]}`);
  const n = session.plan.blocks.length;
  const cam = b.view === "dtl" ? "Camera behind you." : "Camera in front of you.";
  if (b.phase === "calib") say(`${first ? S.profile.name + ", calibration" : "Calibration"} step ${session.blockIdx + 1} of ${n}. ${b.name}, ${b.balls} balls. ${cam} Swing normally, I won't correct you.`, { queue });
  else say(`${first ? S.profile.name + ", block" : "Block"} ${session.blockIdx + 1} of ${n}. ${b.name}, ${b.balls} balls. ${cam}${b.phase === "warmup" ? " Half swings." : b.phase === "retest" ? " Retest time." : ""}`, { queue });
  renderBlockbar();
}
function advanceBlock(manual) {
  if (sessionMode !== "plan") return;
  if (session.blockIdx < session.plan.blocks.length - 1) {
    session.blockIdx++; session.blockDone = 0; save();
    if (!manual) say("Block done.", { queue: true });
    applyBlock(false);
  } else {
    session.blockIdx = session.plan.blocks.length; renderBlockbar();
    if (session.calib) { S.calibDoneAt = Date.now(); say("Calibration done. Tap End, then copy the report and paste it to Claude. You can keep hitting with free practice after that.", { queue: true }); }
    else say("Plan done. Great work. Tap End to see your report.", { queue: true });
    save();
  }
}
function renderBlockbar() {
  const bb = $("#blockbar");
  if (sessionMode !== "plan") { bb.innerHTML = `<div class="top"><span><b>${clubById(S.clubId).name}</b> free practice</span><span>${camWord(S.view)}</span></div>`; return; }
  const blocks = session.plan.blocks, b = currentBlock(), n = blocks.length;
  const seg = blocks.map((x, i) => i < session.blockIdx ? '<i class="done"></i>' : i === session.blockIdx ? `<i class="now" style="--p:${Math.round((100 * session.blockDone) / x.balls)}%"></i>` : "<i></i>").join("");
  if (!b) { bb.innerHTML = `<div class="top"><span><b>${session.calib ? "Calibration" : "Plan"} done</b></span><span>${n} blocks</span></div><div class="segbar">${seg}</div>`; return; }
  bb.innerHTML = `<div class="top"><span><b>${b.name}</b> ${session.blockDone} of ${b.balls}</span><span>${session.calib ? "Calibration" : "Block"} ${session.blockIdx + 1} of ${n}, ${camWord(b.view)}</span></div><div class="segbar">${seg}</div>`;
}

function stop() {
  running = false; stopListening(); speechSynthesis?.cancel();
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  try { wakeLock?.release(); } catch (e) {} wakeLock = null;
  const s = session; session = null;
  if (s && !s.swings.length) DB.sessions = DB.sessions.filter((x) => x !== s);
  save(); $("#live").hidden = true;
  if (s?.swings.length) views.openReport(s.id, "today"); else views.go("today");
}
$("#endBtn").onclick = () => {
  const now = Date.now();
  if (now - endArmed < 3000) { stop(); return; }
  endArmed = now; $("#endBtn").textContent = "Tap again"; $("#endBtn").classList.add("warn");
  setTimeout(() => { $("#endBtn").textContent = "End"; $("#endBtn").classList.remove("warn"); }, 3000);
};
$("#nextBtn").onclick = () => advanceBlock(true);
$("#lockPill").onclick = () => { lock = null; say("Looking for you again. Stand in the middle."); };

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !running) return;
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  if (!stream || stream.getTracks().every((t) => t.readyState === "ended")) { try { await startCamera(); } catch (e) {} }
  if (!rec) startListening();
});

function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const res = landmarker.detectForVideo(video, now);
    const poses = res.landmarks || [];
    if (det.state === "address" || det.state === "swing") lastPoses = Math.max(lastPoses, poses.length); else if (det.state === "idle") lastPoses = 0;
    const g = pickGolfer(poses, lock);
    let lm = null;
    if (g.idx >= 0) { lm = poses[g.idx]; lock = g.lock; lockMissSince = 0; }
    else { if (!lockMissSince) lockMissSince = now; if (lock && now - lockMissSince > 2500 && det.state !== "swing") lock = null; }
    const lt = lm ? (poses.length > 1 ? "Locked on you, 1 other ignored" : "Locked on you") : "Looking for you";
    if ($("#lockPill").textContent !== lt) $("#lockPill").textContent = lt;
    const f = features(lm, video.videoWidth, video.videoHeight, S.view);
    capture(now, f);
    draw(poses, g.idx, f);
    handle(now, f);
    fpsCount++;
    if (now - fpsT0 > 1000) { fps = fpsCount * 1000 / (now - fpsT0); fpsCount = 0; fpsT0 = now;
      if (fps < 12) { slowSince ||= now; if (!slowWarned && now - slowSince > 4000) { slowWarned = true; say("The camera is running slow, so I may miss things. Close other apps or let the phone cool down."); } } else slowSince = 0; }
  }
  requestAnimationFrame(loop);
}

function handle(now, f) {
  const ev = det.push(now, f);
  if (det.state === "swing") setStatus("Swing", "busy");
  else if (det.state === "address") setStatus("Ready, hit when you want", "ready");
  else if (det.state === "cooldown") setStatus("Checking", "busy");
  else setStatus(f.ok ? "Get into your setup" : "Step into the picture");
  if (det.state === "idle") {
    const hint = frameHint(f, S.view);
    if (hint) {
      if (!notOkSince) notOkSince = now;
      if (now - notOkSince > 2500 && now - lastHintAt > 12000) { say(hint); guide(hint); lastHintAt = now; }
    } else { notOkSince = 0; if (now - lastHintAt > 5000 && !$("#guide").hidden) guide(""); }
  }
  if (ev?.type === "swing") onSwing(ev);
}

function onSwing(sw) {
  let m;
  try { m = analyze(sw, S.view); } catch (e) { console.warn(e); return; }
  const grp = group(), clubId = S.clubId, blk = currentBlock();
  const checks = runChecks(m, grp, S.view, session.muted);
  const q = { fps: Math.round(fps), poses: lastPoses, down: m.downFrames };
  if (isCalibBlock()) {
    const rec = { t: Date.now(), clubId, club: grp, cat: blk.cat, block: blk.phase, blockIdx: session.blockIdx, view: S.view, m, checks, items: [], calib: true, q };
    session.swings.push(rec); lastSwing = rec; lastDetail = "";
    const nCal = session.swings.filter((w) => w.calib && !w.practice).length;
    const line = `${session.blockDone + 1} of ${blk.balls}.` + (nCal === 1 ? " Now say how it flew, for example: straight, or slice." : "");
    verdict("", "CAPTURED", `${blk.name}, ${camWord(S.view)}`, "No corrections during calibration. Say how it flew.");
    say(line, { remember: true });
    $("#count").textContent = `${session.swings.filter((w) => !w.practice).length} swings`;
    renderThumbs(sw, null);
    if (S.ask) { $("#res").hidden = false; $("#res").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); }
    session.blockDone++; renderBlockbar(); if (session.blockDone >= blk.balls) advanceBlock(false);
    save(); return;
  }
  swingsSinceHint++;
  const r = coach(DB.coach, checks, m, grp, S.view, S.mode, { cameraHint: sessionMode === "free" && swingsSinceHint >= 5, name: S.profile.name });
  if (r.event?.type === "camera") swingsSinceHint = 0;
  const rec = { t: Date.now(), clubId, club: grp, cat: blk ? blk.cat : clubById(clubId).cat, block: blk?.phase || null, blockIdx: session.blockIdx ?? null,
    view: S.view, m, checks, items: r.items, focus: r.focusId, said: r.speech, q };
  session.swings.push(rec); lastSwing = rec; lastDetail = r.detail;
  const first = r.items[0];
  if (first) verdict(first.pass ? "good" : "bad", first.pass ? "GOOD" : "FIX", ruleById(first.id).title, r.speech);
  else verdict("good", "GOOD", "Nothing to fix from this angle", r.speech);
  say(r.speech, { remember: true });
  $("#count").textContent = `${session.swings.filter((w) => !w.practice).length} swings`;
  renderThumbs(sw, first?.id);
  if (S.ask) { $("#res").hidden = false; $("#res").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); }
  if (sessionMode === "plan" && blk) { session.blockDone++; renderBlockbar(); if (session.blockDone >= blk.balls) advanceBlock(false); }
  save();
}

// ---------- Commands (voice or buttons) ----------
function setResult(value) {
  if (!lastSwing) return;
  if (value === "practice") return markPractice();
  lastSwing.result = value; save();
  $("#res").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === value)));
}
function markPractice() {
  const w = lastSwing; if (!w || w.practice) return;
  w.practice = true;
  if (!w.calib) for (const c of w.checks) { const h = DB.coach.hist[c.id]; if (h?.length) h.pop(); if (DB.coach.focus?.id === c.id && DB.coach.focus.hist.length) DB.coach.focus.hist.pop(); }
  if (sessionMode === "plan") {
    if (w.blockIdx !== session.blockIdx) { session.blockIdx = w.blockIdx; session.blockDone = Math.max(0, currentBlock().balls - 1); say(`OK, practice swing. One more ball with the ${currentBlock().name}.`); }
    else { session.blockDone = Math.max(0, session.blockDone - 1); say("OK, practice swing, not counted."); }
    renderBlockbar();
  } else say("OK, practice swing, not counted.");
  $("#count").textContent = `${session.swings.filter((x) => !x.practice).length} swings`;
  $("#res").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === "practice")));
  save();
}
function markWrong() {
  const id = lastSwing?.items?.[0]?.id;
  if (!id || lastSwing.disputed) { say("Nothing to undo."); return; }
  lastSwing.disputed = id; dispute(DB.coach, id);
  session.disputes[id] = (session.disputes[id] || 0) + 1;
  if (session.disputes[id] >= 2 && !session.muted.includes(id)) { session.muted.push(id); say(`OK. I'll stop checking ${ruleById(id).title.toLowerCase()} today.`); }
  else say("OK, that one doesn't count.");
  save();
}
function doSkip() { const n = skipFocus(DB.coach, group()); say(n ? `New focus: ${n.title.toLowerCase()}.` : "No other focus right now."); save(); }
function doStatus() {
  if (sessionMode === "plan" && currentBlock()) { const b = currentBlock(), nb = session.plan.blocks[session.blockIdx + 1]; say(`${b.balls - session.blockDone} balls left with the ${b.name}.${nb ? " Then " + nb.name + "." : ""}`); }
  else say(`${session.swings.filter((w) => !w.practice).length} swings so far.`);
}
function onVoice(alts) {
  if (!running || speaking) return; // ignore what the mic hears while the app is talking
  if (session?.calib && session.calib.mic == null) {
    session.calib.mic = "ok"; session.calib.heard = alts[0] || ""; save();
    say("Voice works.");
    verdict("", "READY", "Get into your setup", "I start when you stand still.");
    applyBlock(true, true); return;
  }
  let cmd = null; for (const a of alts) { cmd = parseCommand(a); if (cmd) break; }
  if (!cmd) return;
  const recent = lastSwing && Date.now() - lastSwing.t < 30000;
  switch (cmd.type) {
    case "result": if (recent) { setResult(cmd.value); say(`${cmd.value === "top" ? "Thin" : cmd.value}, noted.`); } break;
    case "practice": if (recent) markPractice(); break;
    case "wrong": markWrong(); break;
    case "skip": doSkip(); break;
    case "repeat": say(lastSpeech || "Nothing yet."); break;
    case "explain": say(lastDetail || (DB.coach.focus ? ruleById(DB.coach.focus.id).rule : "No focus yet.")); break;
    case "next": advanceBlock(true); break;
    case "status": doStatus(); break;
  }
}
$("#res").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setResult(b.dataset.r); });
$("#wrongBtn").onclick = markWrong; $("#skipBtn").onclick = doSkip;
$("#explainBtn").onclick = () => say(lastDetail || (DB.coach.focus ? ruleById(DB.coach.focus.id).rule : "No focus yet."), { force: true });
$("#clubLive").onchange = (e) => { S.clubId = e.target.value; det.club = group(); save(); renderBlockbar(); say(clubById(S.clubId).name); };
$("#viewLive").onchange = (e) => { S.view = e.target.value; save(); guide(CAMERA[S.view]); renderBlockbar(); say(CAMERA[S.view]); };

// ---------- Frames for the swing replay ----------
const RING = 120, ring = []; let ringI = 0;
function capture(t, f) {
  if (det.state !== "address" && det.state !== "swing") return;
  if (!video.videoWidth) return;
  let e = ring[ringI % RING];
  if (!e) { e = ring[ringI % RING] = { c: document.createElement("canvas") }; }
  const w = 180, h = Math.round((180 * video.videoHeight) / video.videoWidth);
  if (e.c.width !== w || e.c.height !== h) { e.c.width = w; e.c.height = h; }
  e.c.getContext("2d").drawImage(video, 0, 0, w, h);
  e.t = t; e.p = f.p ? f.p.map((q) => ({ x: q.nx, y: q.ny, v: q.v })) : null;
  ringI++;
}
const nearestFrame = (t) => { let best = null; for (const e of ring) if (e?.t != null && e.p && (!best || Math.abs(e.t - t) < Math.abs(best.t - t))) best = e; return best; };
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
function renderThumbs(sw, ruleId) {
  const kt = keyTimes(sw), names = ["setup", "top", "impact", "finish"];
  const frames = names.map((n) => nearestFrame(kt[n]));
  if (frames.some((f) => !f)) { $("#thumbs").hidden = true; return; }
  const setup = frames[0].p;
  // one crop for all four, around the golfer at setup, so lines line up
  const xs = setup.map((q) => q.x), ys = setup.map((q) => q.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, top = Math.min(...ys), bot = Math.max(...ys);
  const srcW = frames[0].c.width, srcH = frames[0].c.height;
  let ch = (bot - top) * 1.6 * srcH, cw = ch * 0.75;
  cw = Math.min(cw, srcW); ch = Math.min(ch, srcH);
  const sx = Math.max(0, Math.min(srcW - cw, cx * srcW - cw / 2)), sy = Math.max(0, Math.min(srcH - ch, ((top + bot) / 2) * srcH - ch / 2));
  const cvs = [...$("#thumbs").querySelectorAll("canvas")];
  cvs.forEach((cv, i) => {
    const g = cv.getContext("2d"), fr = frames[i];
    g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(fr.c, sx, sy, cw, ch, 0, 0, cv.width, cv.height);
    const P = (q) => [((q.x * srcW - sx) / cw) * cv.width, ((q.y * srcH - sy) / ch) * cv.height];
    g.lineWidth = 2; g.strokeStyle = "#ffffffcc"; g.lineCap = "round";
    for (const [a, b] of BONES) { g.beginPath(); g.moveTo(...P(fr.p[a])); g.lineTo(...P(fr.p[b])); g.stroke(); }
    // guide line for the rule being coached
    g.strokeStyle = "#e8bf45"; g.fillStyle = "#e8bf45"; g.lineWidth = 2; g.setLineDash([5, 4]);
    const vline = (x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); };
    const hline = (y) => { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); };
    const midOf = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
    const hipS = P(midOf(setup, 23, 24));
    if (ruleId === "sway" && i === 1) vline(hipS[0]);
    if (ruleId === "posture" && i === 2) hline(P(setup[0])[1]);
    if (ruleId === "transfer" && i === 3) vline(P(setup[27])[0]);
    if (ruleId === "feet" && i === 3) { vline(P(setup[27])[0]); vline(P(setup[28])[0]); }
    if (ruleId === "ironweight" && (i === 0 || i === 2)) vline(P(midOf(setup, 27, 28))[0]);
    if (ruleId === "hinge" && i === 0) { g.setLineDash([]); g.beginPath(); g.moveTo(...P(midOf(setup, 23, 24))); g.lineTo(...P(midOf(setup, 11, 12))); g.stroke(); }
    g.setLineDash([]);
  });
  $("#thumbs").hidden = false;
}

// Live skeleton: the golfer in colour, anyone else in grey (ignored)
function draw(poses, idx, f) {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return;
  const sc = Math.min(r.width / vw, r.height / vh), ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
  poses.forEach((lm, k) => {
    const P = (i) => [ox + lm[i].x * vw * sc, oy + lm[i].y * vh * sc];
    ctx.lineWidth = k === idx ? 4 : 2; ctx.lineCap = "round";
    ctx.strokeStyle = k !== idx ? "#9aa0a680" : !f.ok ? "#e8bf45" : det.state === "address" ? "#57c088" : "#ffffffdd";
    for (const [a, b] of BONES) { if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue; ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); }
  });
}

views.init({ start });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
