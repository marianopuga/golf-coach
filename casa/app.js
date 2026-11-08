// Coach de casa: cámara, modelo de pose, conversación, replay, progreso y dos cámaras.
// La lógica (mediciones, metas, tendencias, comandos) está en core.js y se prueba en Node.
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import * as C from "./core.js?v=3";
import { L, M, STAGE_NAMES } from "./lines.js?v=3";
import * as Speech from "./speech.js?v=3";
import * as Listen from "./listen.js?v=3";
import { Link } from "./link.js?v=3";

const $ = (s) => document.querySelector(s);
const isMobile = matchMedia("(pointer: coarse)").matches;
const vid = $("#video"), overlay = $("#overlay"), octx = overlay.getContext("2d"), stageEl = $("#stage");
$("#ver").textContent = `v${C.VERSION}`;

// ---------------- Datos de este dispositivo ----------------
const KEY = "golfcasa.v3";
function loadDB() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && d.prof && Array.isArray(d.swings)) { d.prof = { ...C.newProfile(), ...d.prof }; d.settings ||= {}; return d; }
  } catch (e) {}
  return { prof: C.newProfile(), swings: [], settings: {} };
}
const DB = loadDB();
DB.device ||= C.uid();
const S = DB.settings;
let saveTimer = 0;
function save(now = false) {
  clearTimeout(saveTimer);
  const w = () => {
    try { if (DB.swings.length > 1500) DB.swings = DB.swings.slice(-1500); localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { $("#dataStatus").textContent = "No pude guardar en este navegador (modo privado o sin espacio)."; }
  };
  if (now) w(); else saveTimer = setTimeout(w, 400);
}

// ---------------- Ajustes ----------------
$("#view").value = S.view || "face";
$("#hand").value = DB.prof.hand || "R";
$("#height").value = DB.prof.heightCm || 185;
$("#voiceMode").value = S.voiceMode || "clips";
$("#mic").checked = !!S.mic;
const view = () => $("#view").value;
$("#view").onchange = () => { S.view = view(); save(); det.reset(); sm.reset(); };
$("#hand").onchange = () => { DB.prof.hand = $("#hand").value; save(); };
$("#height").onchange = () => { const h = +$("#height").value; if (h >= 140 && h <= 215) { DB.prof.heightCm = h; save(); } };
function fillVoices() {
  const vs = Speech.systemVoices(), sel = $("#sysVoice");
  sel.innerHTML = vs.length ? vs.map((v) => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join("") : `<option value="">No hay voces en español</option>`;
  if (S.sysVoice && vs.some((v) => v.name === S.sysVoice)) sel.value = S.sysVoice;
  $("#sysVoiceRow").hidden = $("#voiceMode").value !== "system";
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = fillVoices;
fillVoices();
function applyVoice() { Speech.configure({ mode: $("#voiceMode").value, systemVoice: $("#sysVoice").value }); }
$("#voiceMode").onchange = () => { S.voiceMode = $("#voiceMode").value; save(); fillVoices(); applyVoice(); Speech.unlock(); say(L.voiceTest, { force: true }); };
$("#sysVoice").onchange = () => { S.sysVoice = $("#sysVoice").value; save(); applyVoice(); Speech.unlock(); say(L.voiceTest, { force: true }); };
$("#testVoice").onclick = () => { Speech.unlock(); applyVoice(); say(L.voiceTest, { force: true }); };
applyVoice();

let lastSaid = "", lastSayAt = 0;
function say(lines, o = {}) {
  const text = Array.isArray(lines) ? lines.join(" ") : lines;
  if (!text) return;
  if (link.open && link.role === "guest" && !o.force) return; // la segunda cámara no habla
  lastSaid = text; lastSayAt = performance.now();
  Speech.say(lines, o);
}

// ---------------- Modelo de pose ----------------
// El modelo preciso por defecto; si el equipo no da abasto (menos de 16 cuadros por segundo) pasa al rápido.
let landmarker = null, vision = null, poseModel = S.poseModel || "full", modelP = null, swapping = false, slowSince = 0;
const MODEL_URL = (k) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${k}/float16/1/pose_landmarker_${k}.task`;
async function makeLandmarker(kind) {
  vision ??= await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const make = (delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL(kind), delegate }, runningMode: "VIDEO", numPoses: 2,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { return await make("GPU"); } catch (e) { return await make("CPU"); }
}
function loadModel() {
  modelP ||= makeLandmarker(poseModel)
    .catch(async (e) => { if (poseModel === "lite") throw e; poseModel = "lite"; return makeLandmarker("lite"); })
    .then((l) => { landmarker = l; return l; })
    .catch((e) => { modelP = null; throw e; }); // si falló, el próximo intento vuelve a probar
  return modelP;
}
loadModel().then(() => { $("#setupNote").textContent = "Modelo de pose listo."; })
  .catch((e) => { $("#setupNote").textContent = "No pude cargar el modelo de pose. Revisa internet y recarga. " + e.message; });
function useLite() {
  if (swapping || poseModel === "lite") return;
  swapping = true;
  makeLandmarker("lite").then((l) => { const old = landmarker; landmarker = l; poseModel = S.poseModel = "lite"; save(); try { old?.close(); } catch (e) {} })
    .catch(() => {}).finally(() => { swapping = false; slowSince = 0; });
}

// ---------------- Cámara ----------------
let stream = null, mirrored = false, cams = [];
async function listCams() {
  try {
    cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const sel = $("#cam"), cur = S.cam || "";
    sel.innerHTML = `<option value="">Automática</option>` + cams.map((d, i) => `<option value="${d.deviceId}">${d.label || `Cámara ${i + 1}`}</option>`).join("");
    if (cur && cams.some((d) => d.deviceId === cur)) sel.value = cur;
  } catch (e) {}
}
listCams();
function stopCamera() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; }
async function startCamera() {
  stopCamera();
  const base = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } };
  const id = $("#cam").value;
  const video = id ? { ...base, deviceId: { exact: id } } : { ...base, facingMode: isMobile ? "environment" : "user" };
  stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  vid.srcObject = stream;
  await vid.play().catch(() => {});
  const track = stream.getVideoTracks()[0], st = track.getSettings?.() || {}, label = track.label || "";
  mirrored = st.facingMode === "user" || /front|frontal|delanter|facetime/i.test(label) || (!isMobile && !st.facingMode);
  vid.classList.toggle("mirror", mirrored); overlay.classList.toggle("mirror", mirrored);
  await listCams();
  if (id) $("#cam").value = id;
  // En el celular, si existe el lente ultra gran angular y no elegiste otra cámara, lo uso: a 2 metros ve más cuerpo.
  if (isMobile && !id && !S.camChosen) {
    const uw = cams.find((d) => /ultra|gran angular/i.test(d.label) && !/front|frontal|delanter/i.test(d.label));
    if (uw && uw.deviceId !== st.deviceId) { $("#cam").value = uw.deviceId; return startCamera(); }
  }
  setPill("#pillCam", "Cámara encendida", "on");
}
$("#cam").onchange = async () => { S.cam = $("#cam").value; S.camChosen = true; save(); if (running) { try { await startCamera(); } catch (e) { cue("No pude cambiar de cámara.", "bad"); } } };

// ---------------- Sesión ----------------
let running = false, paused = false, lastVT = -1, wakeLock = null, sessionStart = 0;
const det = new C.SwingDetector(), sm = new C.Smoother();
let lock = null, lockMissSince = 0;
const fpsT = [];
async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request("screen"); } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (running && document.visibilityState === "visible") keepAwake(); });

$("#start").onclick = async () => {
  Speech.unlock(); applyVoice();
  $("#start").disabled = true; $("#setupNote").textContent = "Encendiendo la cámara...";
  try { await startCamera(); }
  catch (e) {
    $("#start").disabled = false;
    $("#setupNote").textContent = e.name === "NotAllowedError"
      ? "La cámara está bloqueada. En Safari: botón aA, Ajustes del sitio web, Cámara, Permitir. En Chrome: el ícono de cámara en la barra de dirección. En el Mac revisa también Configuración del Sistema, Privacidad, Cámara."
      : "No pude encender la cámara: " + e.message;
    setPill("#pillCam", "Cámara bloqueada", "bad");
    return;
  }
  $("#setupNote").textContent = "Cargando el modelo de pose...";
  try { await loadModel(); } catch (e) { $("#start").disabled = false; return; }
  $("#setupNote").textContent = "";
  running = true; paused = false; sessionStart = Date.now(); greeted = false; det.reset(); sm.reset(); lock = null;
  keepAwake(); Speech.prefetch();
  $("#setup").hidden = true; $("#live").hidden = false; $("#start").disabled = false;
  if (S.mic) startMic();
  stageEl.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(loop);
};
$("#btnStop").onclick = () => {
  running = false; stopCamera(); Listen.stop(); try { wakeLock?.release(); } catch (e) {}
  setPill("#pillCam", "Cámara apagada", ""); updateMicPill();
  const sess = sessionRecs().filter((r) => r.counted);
  if (sess.length) say(C.summaryLines(sessionRecs(), DB.swings, DB.prof).lines);
  $("#live").hidden = true; $("#setup").hidden = false; save(true);
};
function setPaused(p) {
  paused = p; det.reset();
  $("#btnPause").textContent = p ? "Seguir" : "Pausa";
  if (p) { Speech.earcon("pause"); say(L.paused, { force: true }); frameBadge("En pausa", "warn"); } else say(L.resumed, { force: true });
}
$("#btnPause").onclick = () => setPaused(!paused);
$("#btnRepeat").onclick = () => { Speech.unlock(); say(lastSaid || L.explainNone, { force: true }); };
const sessionRecs = () => DB.swings.filter((r) => r.ts >= sessionStart && r.device === DB.device);

function loop() {
  if (!running) return;
  if (landmarker && vid.readyState >= 2 && vid.currentTime !== lastVT) {
    lastVT = vid.currentTime;
    const t = performance.now();
    let res = null;
    try { res = landmarker.detectForVideo(vid, t); } catch (e) {}
    if (res) onFrame(res, t);
  }
  requestAnimationFrame(loop);
}

// ---------------- Cada cuadro ----------------
const POOL = 330, pool = [];
let poolI = 0, lastSnap = null, frameN = 0;
function snap(fps) {
  frameN++;
  if (fps > 40 && frameN % 2 && lastSnap) return lastSnap; // a 60 cuadros por segundo guardo uno de cada dos
  const W = vid.videoWidth, H = vid.videoHeight, w = W >= H ? 192 : 144, h = Math.round((w * H) / W);
  let c = pool[poolI];
  if (!c) { c = document.createElement("canvas"); pool[poolI] = c; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  c.getContext("2d").drawImage(vid, 0, 0, w, h);
  poolI = (poolI + 1) % POOL; lastSnap = c;
  return c;
}
function onFrame(res, t) {
  const W = vid.videoWidth, H = vid.videoHeight;
  if (!W) return;
  if (overlay.width !== W || overlay.height !== H) { overlay.width = W; overlay.height = H; stageEl.style.aspectRatio = `${W} / ${H}`; }
  fpsT.push(t); while (fpsT.length && t - fpsT[0] > 1000) fpsT.shift();
  const fps = fpsT.length;
  $("#fps").textContent = `${fps} fps · ${poseModel === "full" ? "preciso" : "rápido"}`;
  if (poseModel === "full" && fps < 16 && det.state !== "swing") { slowSince ||= t; if (t - slowSince > 5000) useLite(); } else slowSince = 0;

  const poses = res.landmarks || [], worlds = res.worldLandmarks || [];
  const pick = C.pickGolfer(poses, lock);
  lock = pick.lock;
  if (pick.idx < 0) { lockMissSince ||= t; if (t - lockMissSince > 1500) lock = null; } else lockMissSince = 0;
  const lm = pick.idx >= 0 ? poses[pick.idx] : null, wl = pick.idx >= 0 ? worlds[pick.idx] : null;
  octx.clearRect(0, 0, W, H);
  let f = lm ? C.features(lm, W, H, wl) : { ok: false, missing: ["todo"], p: null };
  if (f.p) { f = sm.push(f, t); drawSkel(octx, f.p, W, H, 0, 0, W, H, f.ok ? "#7cc4ff" : "#f5b942", false); } else sm.reset();
  const hint = C.frameHint(f, view());
  if (paused) return;
  showFrameHint(hint, t);
  f.img = snap(fps);
  drawHeadZone(f);
  const ev = det.push(t, f);
  if (ev) onEvent(ev, t);
  talkTick(t, f, hint);
  sendStatus(t, hint);
}

function drawSkel(g, p, W, H, ox, oy, w, h, color, flip) {
  const C2 = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  const X = (q) => ox + (flip ? w - (q[0] * w) / W : (q[0] * w) / W), Y = (q) => oy + (q[1] * h) / H;
  const pt = (i) => (Array.isArray(p[i]) ? p[i] : [p[i].x, p[i].y, p[i].v]);
  g.lineWidth = Math.max(2, w / 200); g.strokeStyle = color;
  for (const [a, b] of C2) { const A = pt(a), B = pt(b); if ((A[2] ?? 1) < 0.3 || (B[2] ?? 1) < 0.3) continue; g.beginPath(); g.moveTo(X(A), Y(A)); g.lineTo(X(B), Y(B)); g.stroke(); }
  g.fillStyle = color;
  for (const i of [0, 11, 12, 15, 16, 23, 24, 25, 26]) { const q = pt(i); if ((q[2] ?? 1) < 0.3) continue; g.beginPath(); g.arc(X(q), Y(q), Math.max(2, w / 160), 0, 7); g.fill(); }
}
// Zona de la cabeza: el círculo es tu tolerancia, se pone rojo si sales de ella durante el swing.
function drawHeadZone(f) {
  if (!det.addr || !f.p || (det.state !== "address" && det.state !== "swing")) return;
  const A = det.addr, cmpx = C.cmPerPx(view(), A, DB.prof), { okB } = C.bandFor(view() === "dtl" ? "headFwd" : "headLat", DB.prof);
  const r = okB / cmpx, off = Math.hypot(f.head.x - A.head.x, f.head.y - A.head.y);
  octx.lineWidth = 4; octx.strokeStyle = off > r ? "#ff6b6b" : "#3ecf8e";
  octx.beginPath(); octx.arc(A.head.x, A.head.y, r, 0, 7); octx.stroke();
  octx.fillStyle = "#ffd34d"; octx.beginPath(); octx.arc(f.head.x, f.head.y, 6, 0, 7); octx.fill();
  octx.setLineDash([8, 6]); octx.strokeStyle = "rgba(255,211,77,.7)"; octx.lineWidth = 2;
  octx.beginPath(); octx.moveTo(A.hp.x, A.hp.y - 0.4 * A.T); octx.lineTo(A.hp.x, A.hp.y + 0.6 * A.T); octx.stroke(); octx.setLineDash([]);
}
function frameBadge(text, cls) { const e = $("#frameBadge"); e.textContent = text; e.className = cls || ""; }
function cue(text, cls = "") { const e = $("#cue"); e.textContent = text; e.className = cls; }
function setPill(sel, text, cls) { const e = $(sel); e.textContent = text; e.className = "pill " + (cls || ""); }

// ---------------- Conversación ----------------
let greeted = false, lastSeen = 0, lostSpoken = false, addrPrompted = false, idleSince = 0, idlePrompted = false;
let hintNow = null, hintSince = 0, hintSaidAt = 0, hintSaid = "";
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const quietFor = () => (Speech.isSpeaking() ? 0 : performance.now() - lastSayAt);
function showFrameHint(hint, t) {
  if (det.state === "swing") return;
  if (hint !== hintNow) { hintNow = hint; hintSince = t; }
  if (!hint) { frameBadge(det.state === "address" ? "En posición" : "Encuadre bien", "ok"); return; }
  frameBadge(hint, "warn");
  // digo el problema de encuadre si dura más de 2,5 segundos (y no repito lo mismo seguido)
  if (t - hintSince > 2500 && quietFor() > 4000 && (hint !== hintSaid || t - hintSaidAt > 25000) && t - hintSaidAt > 9000) {
    say(hint); hintSaid = hint; hintSaidAt = t;
  }
}
function talkTick(t, f, hint) {
  if (link.open && link.role === "guest") return;
  if (!f.p) {
    if (lastSeen && t - lastSeen > 5000 && !lostSpoken) { say(L.lost); lostSpoken = true; }
    return;
  }
  lastSeen = t; lostSpoken = false;
  if (!greeted && !hint) { greeted = true; say(L.hello); return; }
  if (det.state === "address") {
    idleSince = 0;
    if (!addrPrompted && det.addr && t - det.addr.t1 > 9000 && quietFor() > 6000) { say(pick(L.areYouReady)); addrPrompted = true; }
  } else if (det.state === "idle") {
    if (!idleSince) { idleSince = t; idlePrompted = false; }
    else if (!idlePrompted && t - idleSince > 20000 && quietFor() > 10000 && !hint) { say(L.backToAddress); idlePrompted = true; }
  }
}
function onEvent(ev, t) {
  if (ev.type === "ready") {
    Speech.earcon("ready"); C.updateNoise(DB.prof, ev.addr, view()); addrPrompted = false;
    if (quietFor() > 6000) say(sessionRecs().length ? pick(L.ready) : L.firstReady);
  } else if (ev.type === "started") { cue(""); }
  else if (ev.type === "discard") {
    if (ev.why === "aborted") return; // ensayo de subida: no digo nada
    const why = ev.why === "tooSlow" ? L.why.tooSlow : L.why.out;
    cue(`${L.notCounted} ${why}`, "bad"); say([L.notCounted, why]);
  } else if (ev.type === "swing") { Speech.earcon("swing"); finishSwing(ev); }
}

// ---------------- Después de cada swing ----------------
let lastRec = null, partnerBuf = [];
async function finishSwing(ev) {
  const r = C.analyze(ev, view(), DB.prof);
  const impEpoch = performance.timeOrigin + ev.impT;
  const strip = renderStrip(ev, r);
  saveReplay(ev, r);
  if (link.open && link.role === "guest") {
    link.send({ type: "swing", r, impEpoch, strip });
    showReport(C.makeRecord([r], DB.prof), strip, null, null);
    cue("Enviado al principal.", "ok");
    return;
  }
  let results = [r], partnerStrip = null;
  if (link.open) {
    const p = await waitPartner(impEpoch, 1400);
    if (p) {
      if (p.r.view === r.view) say(L.sameView);
      else { results.push(p.r); partnerStrip = p.strip; }
    }
  }
  const rec = C.makeRecord(results, DB.prof, { device: DB.device, impEpoch });
  const coach = C.coachSwing(rec, DB.swings, DB.prof);
  rec.main = coach.main; rec.notes = coach.notes;
  DB.swings.push(rec); lastRec = rec;
  const lines = [...coach.lines];
  if (rec.counted) {
    const stg = C.checkStage(DB.prof, DB.swings);
    if (stg?.lines?.length) lines.push(...stg.lines);
    lines.push(...C.targetLines(C.updateTargets(DB.prof, DB.swings)));
    lines.push(...C.streakLines(DB.swings));
  }
  say(lines);
  cue(coach.lines.join(" "), coach.main ? "bad" : "ok");
  const n = sessionRecs().filter((x) => x.counted).length;
  if (rec.counted && n % 5 === 0) Speech.say(C.summaryLines(sessionRecs(), DB.swings, DB.prof).lines, { queue: true });
  save();
  showReport(rec, strip, partnerStrip, coach);
  renderProgress();
}
function waitPartner(epoch, ms) {
  return new Promise((res) => {
    const t0 = Date.now();
    const look = () => {
      const i = C.pairIndex(partnerBuf, epoch);
      if (i >= 0) { const p = partnerBuf.splice(i, 1)[0]; return res(p); }
      if (Date.now() - t0 > ms) return res(null);
      setTimeout(look, 100);
    };
    look();
  });
}
// Si el swing de la otra cámara llega tarde, lo junto igual con el último registro (sin volver a hablar).
function lateMerge(p) {
  const rec = lastRec;
  if (!rec || rec.views.includes(p.r.view) || Math.abs((rec.impEpoch || 0) - p.impEpoch) > 2500) return false;
  const merged = C.makeRecord([{ view: rec.views[0], m: rec.m, qm: rec.qm, reason: rec.reason }, p.r], DB.prof, { id: rec.id, ts: rec.ts, device: rec.device, impEpoch: rec.impEpoch, tag: rec.tag, main: rec.main });
  Object.assign(rec, merged, { views: [...rec.views, p.r.view] });
  save(); showReport(rec, $("#strip").src, p.strip, null); renderProgress();
  return true;
}

// ---------------- Imagen de 4 cuadros y replay ----------------
function nearest(frames, t) { let b = frames[0]; for (const x of frames) if (Math.abs(x.t - t) < Math.abs(b.t - t)) b = x; return b; }
function drawGuides(g, r, ox, oy, w, h, flip) {
  const W = vid.videoWidth || 640, H = vid.videoHeight || 480, X = (x) => ox + (flip ? w - (x * w) / W : (x * w) / W), Y = (y) => oy + (y * h) / H;
  g.setLineDash([6, 4]); g.lineWidth = 2;
  g.strokeStyle = "rgba(255,211,77,.9)"; g.beginPath(); g.moveTo(X(r.geo.addrHead.x), oy); g.lineTo(X(r.geo.addrHead.x), oy + h); g.stroke();
  g.beginPath(); g.moveTo(ox, Y(r.geo.addrHead.y)); g.lineTo(ox + w, Y(r.geo.addrHead.y)); g.stroke();
  g.strokeStyle = "rgba(124,196,255,.8)"; g.beginPath(); g.moveTo(X(r.geo.addrHip.x), Y(r.geo.addrHip.y) - h * 0.15); g.lineTo(X(r.geo.addrHip.x), oy + h); g.stroke();
  g.setLineDash([]);
}
function renderStrip(ev, r) {
  const fr = ev.frames.filter((x) => x.f.img && x.f.p);
  if (!fr.length) return "";
  const w = fr[0].f.img.width, h = fr[0].f.img.height, top = 22;
  const c = document.createElement("canvas"); c.width = w * 4; c.height = h + top;
  const g = c.getContext("2d"); g.fillStyle = "#101512"; g.fillRect(0, 0, c.width, c.height);
  [["Address", r.t.addr], ["Top", r.t.top], ["Impacto", r.t.imp], ["Final", r.t.end]].forEach(([lab, t], i) => {
    const x = nearest(fr, t);
    g.save();
    if (mirrored) { g.translate(i * w + w, top); g.scale(-1, 1); g.drawImage(x.f.img, 0, 0); } else g.drawImage(x.f.img, i * w, top);
    g.restore();
    drawSkel(g, x.f.p, x.f.W, x.f.H, i * w, top, w, h, "#7cc4ff", mirrored);
    drawGuides(g, r, i * w, top, w, h, mirrored);
    g.fillStyle = "#e9f0eb"; g.font = "bold 13px system-ui"; g.fillText(lab, i * w + 6, 15);
  });
  return c.toDataURL("image/jpeg", 0.78);
}
const rpool = [];
let replay = null, playing = false;
function saveReplay(ev, r) {
  const fr = ev.frames.filter((x) => x.f.img && x.f.p && x.t >= ev.addr.t1 - 300 && x.t <= ev.endT);
  if (!fr.length) return;
  const step = Math.max(1, Math.ceil(fr.length / 150)), sel = fr.filter((_, i) => i % step === 0);
  replay = {
    r, flip: mirrored, t0: sel[0].t,
    frames: sel.map((x, i) => {
      const c = rpool[i] || (rpool[i] = document.createElement("canvas"));
      c.width = x.f.img.width; c.height = x.f.img.height; c.getContext("2d").drawImage(x.f.img, 0, 0);
      return { t: x.t, c, p: x.f.p.map((q) => [q.x, q.y, q.v]), W: x.f.W, H: x.f.H };
    }),
  };
  $("#scrub").max = replay.frames.length - 1; $("#scrub").value = 0;
}
function drawReplayFrame(i) {
  if (!replay) return;
  const x = replay.frames[Math.max(0, Math.min(replay.frames.length - 1, i))], cv = $("#replay"), g = cv.getContext("2d");
  const w = x.c.width * 3, h = x.c.height * 3;
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  g.save(); if (replay.flip) { g.translate(w, 0); g.scale(-1, 1); } g.imageSmoothingQuality = "high"; g.drawImage(x.c, 0, 0, w, h); g.restore();
  drawSkel(g, x.p, x.W, x.H, 0, 0, w, h, "#7cc4ff", replay.flip);
  drawGuides(g, replay.r, 0, 0, w, h, replay.flip);
  const T = replay.r.t, ph = x.t < T.top - 60 ? (x.t < T.addr + 60 ? "Address" : "Subida") : x.t < T.top + 60 ? "Top" : x.t < T.imp - 40 ? "Bajada" : x.t < T.imp + 60 ? "Impacto" : "Final";
  g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, w, 34); g.fillStyle = "#fff"; g.font = "bold 20px system-ui"; g.fillText(ph, 10, 24);
}
$("#btnReplay").onclick = () => {
  if (!replay) return;
  $("#replay").hidden = false; $("#scrub").hidden = false;
  if (playing) { playing = false; $("#btnReplay").textContent = "Ver en cámara lenta"; return; }
  playing = true; $("#btnReplay").textContent = "Detener";
  const speed = +$("#speed").value, t0 = performance.now(), base = replay.frames[0].t;
  const tick = () => {
    if (!playing) return;
    const el = (performance.now() - t0) * speed + base;
    let i = replay.frames.findIndex((x) => x.t > el);
    if (i < 0) { playing = false; $("#btnReplay").textContent = "Ver en cámara lenta"; i = replay.frames.length - 1; }
    $("#scrub").value = i; drawReplayFrame(i);
    if (playing) requestAnimationFrame(tick);
  };
  tick();
};
$("#scrub").oninput = () => { playing = false; $("#btnReplay").textContent = "Ver en cámara lenta"; drawReplayFrame(+$("#scrub").value); };

// ---------------- Informe del swing ----------------
const STATUS = { ok: "Bien", ojo: "Ojo", corregir: "Corregir", nm: "No medible", info: "Info" };
function metaText(k, v) { return v == null ? "" : C.METRICS[k].kind === "min" ? `más de ${C.fmt(k, v)}` : `menos de ${C.fmt(k, v)}`; }
const ARROW = { mejorando: "↗ mejorando", empeorando: "↘ empeorando", estable: "→ estable" };
// Hacia dónde fue el movimiento, en palabras (el signo solo no se entiende).
const DIRW = { headLat: ["hacia atrás", "hacia adelante"], hipSway: ["hacia atrás", "hacia el objetivo"], headFwd: ["se acercó", "se alejó"],
  headVert: ["bajó", "subió"], earlyExt: ["hacia la pelota", "hacia atrás"], spineLoss: ["te enderezaste", "te agachaste"], hipShift: ["hacia el objetivo", "quedó atrás"], finishW: ["sobre el pie izquierdo", "quedó atrás"] };
const dirWord = (k, v) => (DIRW[k] && v != null && Math.abs(v) >= 0.5 ? DIRW[k][v > 0 ? 0 : 1] : "");
function showReport(rec, strip, partnerStrip, coach) {
  $("#report").hidden = false;
  $("#strip").src = strip || ""; $("#partnerStrip").hidden = !partnerStrip; if (partnerStrip) $("#partnerStrip").src = partnerStrip;
  $("#replay").hidden = true; $("#scrub").hidden = true; playing = false;
  const keys = C.KEYS.filter((k) => k in rec.m).sort((a, b) => (a === rec.main ? -1 : b === rec.main ? 1 : C.METRICS[a].prio - C.METRICS[b].prio));
  const rows = keys.map((k) => {
    const st = rec.st[k] || "info", tv = C.targetValue(k, DB.prof), tr = C.trendOf(DB.swings, k);
    const label = M[k]?.label || k, conf = C.METRICS[k].conf === "baja" ? " (aprox.)" : "";
    const fix = M[k]?.fix ? M[k].fix(rec.m[k]) : "";
    return `<tr class="${k === rec.main ? "main" : ""}" data-k="${k}"><td>${label}${conf}${tv != null ? `<div class="small">Tu meta: ${metaText(k, tv)}</div>` : ""}</td>
      <td class="v">${C.fmt(k, Math.abs(rec.m[k]) >= 0.5 && DIRW[k] ? Math.abs(rec.m[k]) : rec.m[k])}${dirWord(k, rec.m[k]) ? `<div class="small">${dirWord(k, rec.m[k])}</div>` : ""}</td><td><span class="st ${st}">${STATUS[st]}</span>${tr ? `<div class="small">${ARROW[tr.dir]}</div>` : ""}</td></tr>
      <tr class="whyrow" data-for="${k}" hidden><td colspan="3"><div class="why">${fix ? `<b>Qué hacer:</b> ${fix} ` : ""}${M[k]?.why || ""}</div></td></tr>`;
  }).join("");
  $("#checks").innerHTML = `<tr><th>Punto</th><th>Medida</th><th>Estado</th></tr>${rows}`;
  $("#checks").querySelectorAll("tr[data-k]").forEach((tr) => { tr.onclick = () => { const w = $(`#checks tr[data-for="${tr.dataset.k}"]`); if (w) w.hidden = !w.hidden; }; });
}

// ---------------- Progreso ----------------
const focusSel = $("#focus");
focusSel.innerHTML = `<option value="auto">Automático (plan escalonado)</option>` + STAGE_NAMES.map((n, i) => `<option value="${i}">Fijo: ${n}</option>`).join("");
focusSel.value = String(DB.prof.focus ?? "auto");
focusSel.onchange = () => { DB.prof.focus = focusSel.value === "auto" ? "auto" : +focusSel.value; save(); renderProgress(); };
function sparkline(k, vals, tv) {
  const d = C.METRICS[k], W = 260, H = 46, pad = 4;
  const ys = vals.map((v) => (d.kind === "abs" ? Math.abs(v) : v)), refs = [d.ok, d.bad, tv].filter((x) => x != null).map((x) => (d.kind === "abs" ? Math.abs(x) : x));
  const lo = Math.min(...ys, ...refs, d.kind === "min" ? Math.min(...ys) : 0), hi = Math.max(...ys, ...refs);
  const Y = (v) => H - pad - ((v - lo) / Math.max(1e-6, hi - lo)) * (H - 2 * pad), X = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, ys.length - 1);
  const line = (v, color, dash) => `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${color}" stroke-width="1" ${dash ? 'stroke-dasharray="4 3"' : ""}/>`;
  const dots = ys.map((v, i) => { const st = C.statusOf(k, vals[i], DB.prof); const col = st === "ok" ? "#3ecf8e" : st === "ojo" ? "#f5b942" : "#ff6b6b"; return `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" fill="${col}"/>`; }).join("");
  const path = ys.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join(" ");
  const okv = d.kind === "abs" ? Math.abs(d.ok) : d.ok;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${line(okv, "#3ecf8e", true)}${tv != null ? line(d.kind === "abs" ? Math.abs(tv) : tv, "#7cc4ff", false) : ""}<path d="${path}" fill="none" stroke="#9db0a4" stroke-width="1.2"/>${dots}</svg>`;
}
function renderProgress() {
  const prof = DB.prof, hist = DB.swings.filter((r) => r.counted), { i } = C.stageKeys(prof);
  $("#planBox").innerHTML = STAGE_NAMES.map((n, j) => `<span class="chip ${j === i ? "cur" : j < (prof.stage || 0) ? "done" : ""}">${j + 1}. ${n}</span>`).join("");
  const cards = [];
  for (const k of C.KEYS) {
    const d = C.METRICS[k];
    if (d.kind === "info" || d.kind === "bool") continue;
    const vals = C.goodValues(hist, k);
    if (!vals.length) continue;
    const tv = C.targetValue(k, prof), tr = C.trendOf(hist, k), med = C.median(vals.slice(-10));
    cards.push(`<div class="mcard"><div class="mhead"><b>${M[k].label}</b><span class="small">${vals.length} swings</span></div>${sparkline(k, vals.slice(-24), tv)}
      <div class="small">Tus últimos 10: <b>${C.fmt(k, med)}</b> · ${tv != null ? `Meta: ${metaText(k, tv)}` : `Meta después de ${Math.max(0, 5 - vals.length)} swings más`}${tr ? ` · ${ARROW[tr.dir]}${tr.cons === "menos" ? ", menos consistente" : tr.cons === "mas" ? ", más consistente" : ""}` : ""}</div></div>`);
  }
  $("#metricsGrid").innerHTML = cards.join("") || `<div class="small">Todavía no hay swings medidos. Línea verde: rango bueno. Línea azul: tu meta personal.</div>`;
  const ins = [];
  const n = DB.prof.noise || {};
  if (n.head != null) ins.push(`Ruido de tu cámara estando quieto: cabeza ${C.fmt("headLat", n.head)}, cadera ${C.fmt("hipSway", n.hip)}. Bajo 2,5 veces eso no corrijo.`);
  for (const f of C.feelInsights(hist)) ins.push(`Cuando lo sientes bien, ${M[f.k].label.toLowerCase()}: ${C.fmt(f.k, f.good)}. Cuando lo sientes mal: ${C.fmt(f.k, f.bad)}. Esa es tu señal.`);
  for (const [k, v] of Object.entries(DB.prof.tune || {})) if (v) ins.push(`Ajustado a ti: ${M[k].label.toLowerCase()} con ${String(Math.round(v * 10) / 10).replace(".", ",")} de margen extra (me dijiste dos veces que medí mal).`);
  const tagged = hist.filter((r) => r.tag).length;
  if (tagged < 6) ins.push(`Marca tus swings como "se sintió bien" o "mal" (llevas ${tagged}). Con 3 de cada uno te digo qué diferencia tus buenos swings de los malos.`);
  $("#insights").innerHTML = ins.map((x) => `<p>${x}</p>`).join("");
}

// ---------------- Botones de sensación y desacuerdo ----------------
function lastMine() { const r = DB.swings[DB.swings.length - 1]; return r && Date.now() - r.ts < 5 * 60000 ? r : null; }
function doTag(tag) {
  const r = lastMine();
  if (!r) return;
  r.tag = tag; save();
  const lines = [tag === "good" ? L.tagGood : L.tagBad];
  if (tag === "good") { const bad = Object.keys(r.st).filter((k) => r.st[k] === "corregir").sort((a, b) => C.METRICS[a].prio - C.METRICS[b].prio); if (bad.length) lines.push(L.feltGoodBut, M[bad[0]].bad(r.m[bad[0]])); }
  say(lines, { force: true }); renderProgress();
}
function doDispute() {
  const r = lastMine();
  const res = r ? C.dispute(DB.prof, r) : null;
  if (!res) { say(L.disputeNone, { force: true }); return; }
  r.disputed = true; save();
  say(res.pending ? L.disputeAck : L.disputeTuned, { force: true }); renderProgress();
}
function doExplain() { const r = lastMine(); const k = r?.main || r?.notes?.[0]; if (!k || !M[k]?.why) { say(L.explainNone, { force: true }); return; } say([M[k].fix(r.m[k]), M[k].why], { force: true }); }
function doInsights() {
  const fi = C.feelInsights(DB.swings.filter((r) => r.counted));
  if (!fi.length) { say(L.noInsights, { force: true }); return; }
  const f = fi[0];
  say(`Cuando lo sientes bien, ${M[f.k].name} se mueve ${C.fmt(f.k, f.good)}. Cuando lo sientes mal, ${C.fmt(f.k, f.bad)}.`, { force: true });
}
$("#btnGood").onclick = () => { Speech.unlock(); doTag("good"); };
$("#btnBad").onclick = () => { Speech.unlock(); doTag("bad"); };
$("#btnDispute").onclick = () => { Speech.unlock(); doDispute(); };

// ---------------- Micrófono y comandos ----------------
function updateMicPill() {
  const s = Listen.getState();
  const map = { on: ["Escuchando 'profe'", "on"], starting: ["Micrófono iniciando", "warn"], off: ["Micrófono apagado", ""], blocked: ["Micrófono bloqueado", "bad"], unsupported: ["Sin comandos de voz", ""], homescreen: ["Comandos solo en Safari", "warn"] };
  const [t, c] = map[s] || ["Micrófono apagado", ""];
  setPill("#pillMic", t, c);
}
Listen.init({
  result: (alts) => {
    if (Speech.isSpeaking()) return;
    for (const a of alts) { const c = C.parseCommand(a); if (c) { $("#heard").textContent = `Escuché: "${a}"`; runCommand(c); return; } }
  },
  state: updateMicPill,
});
updateMicPill();
function startMic() { Speech.audioMode("play-and-record"); Listen.start(); updateMicPill(); }
$("#mic").onchange = () => {
  S.mic = $("#mic").checked; save(); Speech.unlock();
  if (S.mic) { if (!Listen.available) { $("#heard").textContent = Listen.reason === "homescreen" ? "En iPhone los comandos solo funcionan abriendo la página en Safari." : "Este navegador no reconoce voz. Usa Chrome o Safari."; } startMic(); }
  else { Listen.stop(); Speech.audioMode("playback"); updateMicPill(); }
};
function runCommand(c) {
  Speech.earcon("ok");
  switch (c.cmd) {
    case "hey": say(L.heard, { force: true }); break;
    case "pause": if (!paused) setPaused(true); break;
    case "resume": if (paused) setPaused(false); else say(L.resumed, { force: true }); break;
    case "repeat": say(lastSaid || L.explainNone, { force: true }); break;
    case "summary": say(C.summaryLines(sessionRecs(), DB.swings, DB.prof).lines, { force: true }); break;
    case "dispute": doDispute(); break;
    case "tag": doTag(c.tag); break;
    case "explain": doExplain(); break;
    case "insights": doInsights(); break;
    case "focus":
      DB.prof.focus = c.stage; focusSel.value = String(c.stage); save(); renderProgress();
      say(c.stage === "auto" ? L.focusAuto : `Foco: ${STAGE_NAMES[c.stage]}.`, { force: true }); break;
    case "nextStage":
      if (DB.prof.focus !== "auto") DB.prof.focus = "auto";
      DB.prof.stage = Math.min(STAGE_NAMES.length - 1, (DB.prof.stage || 0) + 1); save(); renderProgress();
      say(`Foco: ${STAGE_NAMES[DB.prof.stage]}.`, { force: true }); break;
    default: Speech.earcon("oops"); say(L.unknown, { force: true });
  }
}

// ---------------- Dos cámaras ----------------
let partnerStatus = null, partnerBlindSaid = 0, lastStatusSent = 0;
const link = new Link({
  onOpen: (role) => {
    setPill("#pillLink", role === "host" ? "2.ª cámara conectada" : "Conectado al principal", "on");
    $("#linkStatus").textContent = role === "host" ? "Conectado. Yo junto los dos ángulos y hablo." : "Conectado. Esta cámara manda sus swings al principal y no habla.";
    if (role === "host") say(L.linked, { force: true });
  },
  onClose: () => { setPill("#pillLink", "Una cámara", "warn"); $("#linkStatus").textContent = "Se cortó la conexión. Cada dispositivo sigue funcionando solo."; say(L.unlinked, { force: true }); },
  onData: (d) => {
    if (d.type === "swing") {
      const p = { r: d.r, strip: d.strip, impEpoch: link.toLocal(d.impEpoch), at: Date.now() };
      partnerBuf = partnerBuf.filter((x) => Date.now() - x.at < 20000);
      if (!lateMerge(p)) partnerBuf.push(p);
    } else if (d.type === "status") partnerStatus = { ...d, at: Date.now() };
  },
});
function sendStatus(t, hint) {
  if (!link.open || link.role !== "guest" || t - lastStatusSent < 1500) return;
  lastStatusSent = t; link.send({ type: "status", hint, state: det.state, view: view() });
  return;
}
setInterval(() => {
  if (!link.open || link.role !== "host" || !partnerStatus) return;
  const fresh = Date.now() - partnerStatus.at < 4000;
  $("#linkStatus").textContent = fresh ? `Cámara ${partnerStatus.view === "dtl" ? "desde atrás" : "de frente"}: ${partnerStatus.hint || "te ve bien"}.` : "La otra cámara no está mandando datos.";
  if (fresh && partnerStatus.hint && det.state === "address" && Date.now() - partnerBlindSaid > 60000 && quietFor() > 5000) { partnerBlindSaid = Date.now(); say(L.partnerBlind); }
}, 1500);
$("#btnHost").onclick = async () => {
  Speech.unlock();
  $("#linkStatus").textContent = "Creando código...";
  try { const code = await link.host(); $("#linkStatus").innerHTML = `Código: <span class="code">${code}</span><br>En el otro dispositivo abre esta misma página, elige su ángulo y escribe el código.`; setPill("#pillLink", "Esperando 2.ª cámara", "warn"); }
  catch (e) { $("#linkStatus").textContent = "No pude crear el código: " + (e.message || e.type || e); }
};
$("#btnJoin").onclick = async () => {
  Speech.unlock();
  const code = $("#joinCode").value.replace(/\D/g, "");
  if (code.length !== 4) { $("#linkStatus").textContent = "El código tiene 4 números."; return; }
  $("#linkStatus").textContent = "Conectando...";
  try { await link.join(code); }
  catch (e) { $("#linkStatus").textContent = "No pude conectar: " + (e.message || e.type || e); }
};

// ---------------- Datos: Claude, exportar, juntar, borrar ----------------
$("#btnCopy").onclick = async () => {
  const text = C.reportText(DB.swings, DB.prof);
  try { await navigator.clipboard.writeText(text); $("#dataStatus").textContent = "Copiado. Pégalo en el chat con Claude para revisar tus números y ajustar tus metas."; }
  catch (e) { $("#dataStatus").textContent = "No pude copiar. Usa Descargar mis datos y adjunta el archivo en el chat."; }
};
$("#btnExport").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "golfcasa", v: C.VERSION, exported: new Date().toISOString(), ...DB }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `coach-casa-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$("#btnImport").onclick = () => $("#importFile").click();
$("#importFile").onchange = async () => {
  const file = $("#importFile").files[0];
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    const have = new Set(DB.swings.map((r) => r.id));
    const add = (d.swings || []).filter((r) => r && r.id && !have.has(r.id));
    DB.swings = [...DB.swings, ...add].sort((a, b) => a.ts - b.ts);
    C.updateTargets(DB.prof, DB.swings.filter((r) => r.counted));
    save(true); renderProgress();
    $("#dataStatus").textContent = `Junté ${add.length} swings nuevos.`;
  } catch (e) { $("#dataStatus").textContent = "Ese archivo no es de esta página."; }
  $("#importFile").value = "";
};
$("#btnReset").onclick = () => {
  if ($("#btnReset").dataset.armed !== "1") { $("#btnReset").dataset.armed = "1"; $("#btnReset").textContent = "Toca de nuevo para borrar"; setTimeout(() => { $("#btnReset").dataset.armed = ""; $("#btnReset").textContent = "Borrar todo"; }, 4000); return; }
  const keep = { ...DB.settings };
  DB.prof = C.newProfile(); DB.prof.heightCm = +$("#height").value || 185; DB.prof.hand = $("#hand").value; DB.swings = []; DB.settings = keep;
  save(true); renderProgress(); $("#report").hidden = true; $("#dataStatus").textContent = "Borrado. Partimos de cero.";
  $("#btnReset").dataset.armed = ""; $("#btnReset").textContent = "Borrar todo";
};

renderProgress();
