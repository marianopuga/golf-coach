import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { RULES, CLUBS, VIDEOS, CAMERA } from "./rules.js";
import { features, frameHint, SwingDetector, analyze, runChecks, coach, emptyCoachState, ruleById, sessionStats, reportText } from "./engine.js";

const $ = (s) => document.querySelector(s);
const KEY = "golfcoach.v1";

// ---------- Storage ----------
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) {}
  return { settings: { club: "iron", view: "face", mode: 1, voice: true, ask: true }, coach: emptyCoachState(), sessions: [] };
}
let DB = load();
DB.settings ??= {}; DB.coach ??= emptyCoachState(); DB.sessions ??= [];
function save() {
  if (DB.sessions.length > 80) DB.sessions = DB.sessions.slice(-80);
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { console.warn("save failed", e); }
}
const S = DB.settings;
S.club ??= "iron"; S.view ??= "face"; S.mode ??= 1; S.voice ??= true; S.ask ??= true;

// ---------- Voice ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en-(AU|GB)/.test(v.lang) && /Karen|Daniel|Samantha|Google/.test(v.name)) || vs.find((v) => v.lang.startsWith("en")) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, force) {
  if ((!S.voice && !force) || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.98; u.lang = voice?.lang || "en-AU";
  speechSynthesis.speak(u);
}

// ---------- Home UI ----------
function segInit(el, attr, get, set) {
  const sync = () => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === String(get()))));
  el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; set(b.dataset[attr]); sync(); refresh(); save(); });
  sync();
}
$("#clubSeg").innerHTML = Object.entries(CLUBS).map(([k, v]) => `<button data-c="${k}">${v}</button>`).join("");
segInit($("#clubSeg"), "c", () => S.club, (v) => (S.club = v));
segInit($("#viewSeg"), "v", () => S.view, (v) => (S.view = v));
segInit($("#modeSeg"), "m", () => S.mode, (v) => (S.mode = Number(v)));
$("#voiceOn").checked = S.voice !== false; $("#voiceOn").onchange = (e) => { S.voice = e.target.checked; save(); };
$("#askResult").checked = S.ask !== false; $("#askResult").onchange = (e) => { S.ask = e.target.checked; save(); };
$("#clubLive").innerHTML = Object.entries(CLUBS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

function focusText(club) {
  const F = DB.coach.focus?.[club];
  if (!F) return `<span class="hint">No focus yet for ${CLUBS[club].toLowerCase()}. It is set after your first swing.</span>`;
  const r = ruleById(F.id), good = F.hist.slice(-5).filter(Boolean).length, n = F.hist.slice(-5).length;
  return `Focus: <b>${r.title}</b> <span class="num">${good}/${n} good</span>`;
}
function refresh() {
  $("#viewHint").textContent = CAMERA[S.view];
  $("#focusHome").innerHTML = focusText(S.club);
  $("#focusLive").innerHTML = focusText(S.club);
  $("#clubLive").value = S.club; $("#viewLive").value = S.view;
}
refresh();

function show(id) { for (const s of ["home", "live", "report", "manual"]) $("#" + s).hidden = s !== id; window.scrollTo(0, 0); }
document.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => show("home")));

// ---------- Pose model ----------
let landmarker = null;
async function initModel() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const make = (delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate },
    runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await make("GPU"); } catch (e) { landmarker = await make("CPU"); }
}
const modelReady = initModel().then(() => { $("#loadState").textContent = "Ready. Put your earphones in and tap Start."; })
  .catch((e) => { $("#loadState").textContent = "Could not load the pose model. Check your internet and reload. " + e.message; });

// ---------- Live session ----------
const video = $("#video"), canvas = $("#overlay"), ctx = canvas.getContext("2d");
const det = new SwingDetector();
let stream = null, running = false, session = null, lastSwing = null, wakeLock = null;
let lastHintAt = 0, notOkSince = 0, lastVideoTime = -1, status = "";

function setStatus(text, cls = "") { if (status === text) return; status = text; const el = $("#status"); el.textContent = text; el.className = "pill " + cls; }

async function start() {
  say("Starting. " + CAMERA[S.view], true); // first speech must come from a tap on iPhone
  show("live");
  $("#guide").textContent = CAMERA[S.view]; $("#guide").hidden = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    setStatus("Camera blocked"); $("#said").textContent = "I need the camera. Allow camera access for this page in Safari settings, then try again."; return;
  }
  video.srcObject = stream; await video.play().catch(() => {});
  await modelReady;
  if (!landmarker) { $("#said").textContent = "The pose model did not load. Check your internet and reload the app."; return; }
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {}
  session = { id: String(Date.now()), start: Date.now(), swings: [] };
  DB.sessions.push(session); save();
  det.reset(); det.club = S.club; running = true; lastSwing = null;
  $("#items").innerHTML = ""; $("#res").hidden = true; $("#count").textContent = "0 swings";
  requestAnimationFrame(loop);
}

function stop() {
  running = false;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  try { wakeLock?.release(); } catch (e) {} wakeLock = null;
  if (session && !session.swings.length) DB.sessions = DB.sessions.filter((s) => s !== session);
  save(); refresh();
  if (session?.swings.length) { renderReport(session.id); show("report"); say(`Session done. ${session.swings.length} swings.`); }
  else show("home");
  session = null;
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && running) { try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {} }
});

function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const res = landmarker.detectForVideo(video, now);
    const lm = res.landmarks?.[0];
    const f = features(lm, video.videoWidth, video.videoHeight);
    draw(lm, f);
    handle(now, f);
  }
  requestAnimationFrame(loop);
}

function handle(now, f) {
  const ev = det.push(now, f);
  if (det.state === "swing") setStatus("Swing", "busy");
  else if (det.state === "address") setStatus("Ready, hit when you want", "ready");
  else if (det.state === "cooldown") setStatus("Thinking", "busy");
  else setStatus(f.ok ? "Get into your setup" : "Step into the picture");

  // Camera help when the body is not fully visible
  if (det.state === "idle") {
    const hint = frameHint(f, S.view);
    if (hint) {
      if (!notOkSince) notOkSince = now;
      if (now - notOkSince > 2500 && now - lastHintAt > 10000) { say(hint); $("#guide").textContent = hint; $("#guide").hidden = false; lastHintAt = now; }
    } else { notOkSince = 0; if (now - lastHintAt > 4000) $("#guide").hidden = true; }
  }
  if (ev?.type === "ready") { $("#guide").hidden = true; }
  if (ev?.type === "swing") onSwing(ev);
}

function onSwing(sw) {
  let m;
  try { m = analyze(sw, S.view); } catch (e) { console.warn(e); return; }
  const checks = runChecks(m, S.club, S.view);
  const r = coach(DB.coach, checks, m, S.club, S.view, S.mode);
  const rec = { t: Date.now(), club: S.club, view: S.view, m, checks, focus: r.focusId, said: r.speech };
  session.swings.push(rec); lastSwing = rec; save();
  say(r.speech);
  $("#said").textContent = r.speech;
  $("#items").innerHTML = r.items.map((i) => { const rule = ruleById(i.id); return `<div class="item ${i.pass ? "ok" : "no"}"><b>${i.pass ? "GOOD" : "FIX"}</b><span>${rule.title}${i.focus ? " (focus)" : ""}</span></div>`; }).join("");
  $("#count").textContent = `${session.swings.length} swing${session.swings.length === 1 ? "" : "s"}`;
  $("#focusLive").innerHTML = focusText(S.club);
  if (S.ask !== false) { $("#res").hidden = false; $("#res").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); }
}

$("#res").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b || !lastSwing) return;
  lastSwing.result = b.dataset.r === "skip" ? null : b.dataset.r;
  $("#res").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  save();
});
$("#clubLive").onchange = (e) => { S.club = e.target.value; det.club = S.club; save(); refresh(); say(CLUBS[S.club]); };
$("#viewLive").onchange = (e) => { S.view = e.target.value; save(); refresh(); $("#guide").textContent = CAMERA[S.view]; $("#guide").hidden = false; say(CAMERA[S.view]); };
$("#startBtn").onclick = start;
$("#endBtn").onclick = stop;

// Skeleton overlay, mapped onto the letterboxed video
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
function draw(lm, f) {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  if (!lm) return;
  const vw = video.videoWidth, vh = video.videoHeight, sc = Math.min(r.width / vw, r.height / vh);
  const ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
  const P = (i) => [ox + lm[i].x * vw * sc, oy + lm[i].y * vh * sc];
  ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.strokeStyle = f.ok ? (det.state === "address" ? "#57c088" : "#ffffffcc") : "#e8bf45";
  for (const [a, b] of BONES) { if ((lm[a].visibility ?? 1) < 0.4 || (lm[b].visibility ?? 1) < 0.4) continue; const A = P(a), B = P(b); ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); }
}

// ---------- Report ----------
$("#toReport").onclick = () => { renderReport(DB.sessions.at(-1)?.id); show("report"); };
function renderReport(sid) {
  const list = DB.sessions.slice(-6);
  $("#sessSeg").innerHTML = list.map((s) => `<button data-s="${s.id}" aria-pressed="${s.id === sid}">${new Date(s.start).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</button>`).join("");
  $("#sessSeg").onclick = (e) => { const b = e.target.closest("button"); if (b) renderReport(b.dataset.s); };
  const s = DB.sessions.find((x) => x.id === sid);
  if (!s) { $("#repBody").innerHTML = `<p class="hint" style="margin:0">No sessions yet. Your first report appears here after you hit some balls.</p>`; $("#repText").textContent = ""; return; }
  const st = sessionStats(s);
  const flights = Object.entries(st.results);
  $("#repBody").innerHTML = `
    <div class="stats">
      <div class="stat"><b>${st.n}</b><span class="hint">swings</span></div>
      <div class="stat"><b>${flights.reduce((a, [, n]) => a + n, 0)}</b><span class="hint">flights logged</span></div>
      <div class="stat"><b>${st.faults[0] ? st.faults[0].rate + "%" : "0%"}</b><span class="hint">top fault rate</span></div>
    </div>
    <span class="eyebrow">Faults, failed out of checked</span>
    ${st.faults.length ? st.faults.map((f) => `<div class="bar"><span>${ruleById(f.id)?.title || f.id}</span><span class="num">${f.fail}/${f.n}</span><i><span style="width:${f.rate}%"></span></i></div>`).join("") : '<p class="hint" style="margin:0">No checks yet.</p>'}
    ${flights.length ? `<span class="eyebrow">Ball flight</span><p style="margin:0">${flights.map(([r, n]) => `${r} <b>${n}</b>`).join(" · ")}</p>` : ""}`;
  $("#repText").textContent = reportText(DB.sessions, s.id);
}
$("#copyRep").onclick = async () => {
  const t = $("#repText").textContent;
  try { await navigator.clipboard.writeText(t); $("#copyRep").textContent = "Copied"; }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("#repText")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); $("#copyRep").textContent = "Selected, tap Copy"; }
  setTimeout(() => ($("#copyRep").textContent = "Copy report"), 2500);
};

// ---------- Manual ----------
$("#toManual").onclick = () => { renderManual(); show("manual"); };
function renderManual() {
  const auto = RULES.filter((r) => r.auto).sort((a, b) => a.priority - b.priority), man = RULES.filter((r) => !r.auto);
  const item = (r) => { const v = VIDEOS[r.src]; return `<div class="rule"><h3>${r.title}${r.auto ? `<span class="tag">camera, ${r.view === "dtl" ? "down the line" : r.view === "face" ? "face on" : "any view"}</span>` : ""}</h3>
    <span>${r.rule}</span>
    <small>${v.url ? `<a href="${v.url}" target="_blank" rel="noopener">${v.who}: ${v.title}</a>` : v.title}${r.clubs ? " · " + r.clubs.map((c) => CLUBS[c]).join(", ") : ""}</small></div>`; };
  $("#manBody").innerHTML = `<span class="eyebrow">Checked by the camera, in the order we fix them</span>${auto.map(item).join("")}
    <span class="eyebrow" style="margin-top:8px">Read and practise</span>${man.map(item).join("")}`;
}
