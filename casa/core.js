// Coach de casa: lógica pura (sin DOM), probada en Node con swings simulados (test/casa.test.mjs).
// Parte de las ideas del motor de la app principal (engine.js): detector de swing por la altura de las manos,
// mediciones 2D simples y nunca una corrección con una medición débil. Cambios para practicar en el living:
// no necesita ver los pies, mide de frente y desde atrás (dos dispositivos a la vez) y aprende de ti:
// ruido de medición, metas progresivas, tendencias, lo que sientes y lo que me corriges.
import { M, L, FRAME, STAGE_NAMES, keyOf, cm as cmLine, grados as degLine, count as countLine, streak as streakLine,
  stageUp as stageUpLines, trendLine, metaLine, logroLine, ojoLine } from "./lines.js?v=3";

export const VERSION = "3.0";
export const I = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
  lKn: 25, rKn: 26, lAn: 27, rAn: 28 };
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r) => (r * 180) / Math.PI;
const r1 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
export const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a) => { const m = median(a); return m == null ? 0 : 1.4826 * median(a.map((x) => Math.abs(x - m))); };
export const angDiff = (a, b) => { let d = a - b; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);

// ---------------- Mediciones de cada cuadro ----------------
// Para el living basta ver cabeza, hombros y cadera: los pies y las rodillas son opcionales.
const seen = (q) => q.v >= 0.5 && q.nx > 0.01 && q.nx < 0.99 && q.ny > 0.01 && q.ny < 0.99;
const NEED = { cabeza: [I.nose], hombros: [I.lSh, I.rSh], cadera: [I.lHip, I.rHip] };

export function features(lm, W, H, wl = null) {
  if (!lm || lm.length <= I.rAn) return { ok: false, missing: ["todo"], p: null };
  const p = lm.map((l) => ({ x: l.x * W, y: l.y * H, v: l.visibility ?? 1, nx: l.x, ny: l.y }));
  const missing = Object.keys(NEED).filter((k) => !NEED[k].every((i) => seen(p[i])));
  const sh = mid(p[I.lSh], p[I.rSh]), hp = mid(p[I.lHip], p[I.rHip]);
  // La cabeza es siempre el promedio de nariz y orejas (la misma definición en todos los cuadros, sin saltos).
  const head = { x: (p[I.nose].x + p[I.lEar].x + p[I.rEar].x) / 3, y: (p[I.nose].y + p[I.lEar].y + p[I.rEar].y) / 3 };
  let shYaw = null, hipYaw = null;
  if (wl && wl.length > I.rHip) {
    const yaw = (a, b) => deg(Math.atan2(wl[b].z - wl[a].z, wl[b].x - wl[a].x));
    shYaw = yaw(I.rSh, I.lSh); hipYaw = yaw(I.rHip, I.lHip);
  }
  return {
    ok: missing.length === 0, missing, p, W, H, head, sh, hp,
    nose: { x: p[I.nose].x, y: p[I.nose].y },
    lSh: { x: p[I.lSh].x, y: p[I.lSh].y }, rSh: { x: p[I.rSh].x, y: p[I.rSh].y },
    hands: mid(p[I.lWr], p[I.rWr]),
    T: dist(sh, hp) || 1, sw: dist(p[I.lSh], p[I.rSh]) || 1, span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    shYaw, hipYaw,
    wristsSeen: seen(p[I.lWr]) || seen(p[I.rWr]), kneesSeen: seen(p[I.lKn]) && seen(p[I.rKn]),
    vis: Math.min(p[I.nose].v, p[I.lSh].v, p[I.rSh].v, p[I.lHip].v, p[I.rHip].v),
  };
}

// Suaviza el temblor del modelo de pose (promedio exponencial que depende del tiempo entre cuadros, así una
// cámara lenta no atrasa las manos). El esqueleto dibujado sigue siendo el crudo.
export class Smoother {
  constructor(tau = 25) { this.tau = tau; this.s = null; this.t = null; }
  reset() { this.s = null; this.t = null; }
  push(f, t = null) {
    if (!f || !f.p) return f;
    const dt = t != null && this.t != null ? Math.max(1, t - this.t) : 33;
    this.t = t;
    const a = 1 - Math.exp(-dt / this.tau), s = this.s;
    if (!s) { this.s = { head: { ...f.head }, hands: { ...f.hands }, hp: { ...f.hp }, sh: { ...f.sh }, shYaw: f.shYaw, hipYaw: f.hipYaw }; return f; }
    for (const k of ["head", "hands", "hp", "sh"]) { s[k].x += a * (f[k].x - s[k].x); s[k].y += a * (f[k].y - s[k].y); f[k] = { ...s[k] }; }
    for (const k of ["shYaw", "hipYaw"]) if (f[k] != null) { s[k] = s[k] == null ? f[k] : s[k] + a * angDiff(f[k], s[k]); f[k] = s[k]; }
    f.T = dist(f.sh, f.hp) || f.T;
    return f;
  }
}

// Qué falta en el encuadre, en palabras. null si está bien.
export function frameHint(f, view) {
  if (!f || !f.p) return FRAME.nobody;
  const m = new Set(f.missing);
  if (m.has("cadera")) return FRAME.noHips;
  if (m.has("cabeza")) return FRAME.noHead;
  if (m.has("hombros")) return FRAME.noShoulders;
  if (!f.wristsSeen) return FRAME.noHands;
  if (f.nose.y / f.H < 0.05) return FRAME.headroom;
  if ((f.hp.y - f.nose.y) / f.H < 0.16) return FRAME.tooFar;
  if (view === "face" && f.span < 0.45 * f.T) return FRAME.looksDtl;
  if (view === "dtl" && f.span > 0.75 * f.T) return FRAME.looksFace;
  return null;
}

// Si aparece otra persona en la imagen, sigue al golfista (el más grande cerca del centro, después el mismo).
export function pickGolfer(poses, lock) {
  const info = (poses || []).map((lm, idx) => ({ idx, x: (lm[I.lHip].x + lm[I.rHip].x) / 2, y: (lm[I.lHip].y + lm[I.rHip].y) / 2,
    size: Math.abs((lm[I.lHip].y + lm[I.rHip].y) / 2 - lm[I.nose].y) }));
  if (!info.length) return { idx: -1, lock };
  let best = null;
  if (lock) {
    for (const c of info) {
      const d = Math.hypot(c.x - lock.x, c.y - lock.y);
      if (d < 0.25 && c.size > lock.size * 0.5 && c.size < lock.size * 2 && (!best || d < best.d)) best = { ...c, d };
    }
    if (!best) return { idx: -1, lock };
  } else {
    const maxSize = Math.max(...info.map((c) => c.size));
    for (const c of info.filter((c) => c.size >= 0.6 * maxSize)) { const d = Math.abs(c.x - 0.5); if (!best || d < best.d) best = { ...c, d }; }
  }
  const k = lock ? 0.3 : 1;
  return { idx: best.idx, lock: lock ? { x: lock.x + (best.x - lock.x) * k, y: lock.y + (best.y - lock.y) * k, size: lock.size + (best.size - lock.size) * k } : { x: best.x, y: best.y, size: best.size } };
}

// ---------------- Detector de swing ----------------
// Address: manos bajas y quietas medio segundo. Swing: las manos suben. Top: lo más alto. Impacto: las manos
// vuelven más cerca de donde estaban en el address. Final: las manos suben de nuevo y quedan quietas.
export class SwingDetector {
  constructor(o = {}) { this.need = o.need ?? 0.4; this.maxMs = o.maxMs ?? 8000; this.reset(); }
  reset() { this.state = "idle"; this.hist = []; this.frames = []; this.addr = null; this.until = 0; }
  push(t, f) {
    this.hist.push({ t, f });
    while (this.hist.length && t - this.hist[0].t > 2500) this.hist.shift();
    if (this.state === "cooldown") { if (t > this.until) this.state = "idle"; return null; }
    if (this.state === "swing") return this._swing(t, f);
    if (!f.ok) { if (this.state === "address") { this.state = "idle"; return { type: "lost" }; } return null; }
    const still = this._still(t, 500, 0.06);
    const low = f.hands.y > f.sh.y + 0.7 * f.T;
    if (this.state === "idle") {
      if (still && low) { this.state = "address"; this.addr = still; return { type: "ready", addr: still }; }
      return null;
    }
    if (still && low) this.addr = still;
    const A = this.addr, rise = A.hands.y - f.hands.y, side = Math.abs(f.hands.x - A.hands.x);
    if (rise > this.need * A.T || (side > 0.7 * A.T && rise > 0.15 * A.T)) {
      this.state = "swing"; this.start = t;
      this.frames = this.hist.filter((h) => h.t >= A.t0);
      this.top = null; this.down = false; this.imp = null; this.impDone = false; this.after = 0;
      return { type: "started" };
    }
    if (side > 1.4 * A.T && rise < 0.15 * A.T) { this.state = "idle"; return { type: "lost" }; }
    return null;
  }
  _still(t, ms, tol, from = -Infinity) {
    const w = this.hist.filter((h) => t - h.t <= ms && h.t >= from && h.f.ok);
    if (w.length < 4 || t - w[0].t < ms * 0.7) return null;
    const c = (k) => ({ x: w.reduce((s, h) => s + h.f[k].x, 0) / w.length, y: w.reduce((s, h) => s + h.f[k].y, 0) / w.length });
    const hands = c("hands"), T = w[w.length - 1].f.T;
    for (const h of w) if (dist(h.f.hands, hands) > tol * T) return null;
    const head = c("head"), hp = c("hp");
    const sd = (k, ctr) => Math.sqrt(w.reduce((s, h) => s + dist(h.f[k], ctr) ** 2, 0) / w.length);
    return { t0: w[0].t, t1: w[w.length - 1].t, hands, head, hp, T, sw: w[w.length - 1].f.sw, jitHead: sd("head", head), jitHip: sd("hp", hp) };
  }
  _swing(t, f) {
    this.frames.push({ t, f });
    const A = this.addr;
    if (t - this.start > this.maxMs) return this._drop(t, "tooSlow");
    if (!f.ok) return null;
    const amt = A.hands.y - f.hands.y;
    if (!this.down) {
      if (!this.top || amt > this.top.amt) this.top = { t, amt };
      // bajada: las manos ya bajaron bastante desde el top (sirve también con una cámara lenta)
      if (t > this.top.t && this.top.amt > this.need * A.T && amt <= Math.max(0.25 * A.T, 0.4 * this.top.amt)) this.down = true;
      else return null;
    }
    if (!this.impDone) {
      const d = dist(f.hands, A.hands);
      if (!this.imp || d < this.imp.d) this.imp = { t, d, amt };
      if (t - this.imp.t > 250 || amt > this.imp.amt + 0.2 * A.T) this.impDone = true;
      return null;
    }
    this.after = Math.max(this.after, amt); // en el final las manos vuelven a subir
    if (t - this.imp.t > 300 && this._still(t, 450, 0.08, this.imp.t + 300)) return this._emit(t, true);
    if (t - this.imp.t > 2000) return this._emit(t, false);
    return null;
  }
  _emit(t, finishStill) {
    if (this.after < 0.3 * this.addr.T) return this._drop(t, "aborted");
    const downFrames = this.frames.filter((x) => x.t > this.top.t && x.t <= this.imp.t && x.f.ok).length;
    const out = { type: "swing", frames: this.frames.slice(), addr: this.addr, topT: this.top.t, impT: this.imp.t, endT: t, finishStill, downFrames };
    this.state = "cooldown"; this.until = t + 1200; this.frames = [];
    return out;
  }
  _drop(t, why) { this.state = "cooldown"; this.until = t + 800; this.frames = []; return { type: "discard", why }; }
}

// ---------------- Mediciones del swing ----------------
// kind: abs (mientras más cerca de 0, mejor), pos (solo los valores positivos son malos), min (más alto es mejor),
// bool, info (se muestra, no se corrige). ok y bad en las unidades de la medición. conf: qué tan confiable es.
export const METRICS = {
  headLat: { view: "face", unit: "cm", kind: "abs", ideal: 3, ok: 5, bad: 8, prio: 1, noise: "head", conf: "alta" },
  hipSway: { view: "face", unit: "cm", kind: "abs", ideal: 3, ok: 6, bad: 10, prio: 2, noise: "hip", conf: "alta" },
  headFwd: { view: "dtl", unit: "cm", kind: "abs", ideal: 3, ok: 5, bad: 8, prio: 2, noise: "head", conf: "alta" },
  earlyExt: { view: "dtl", unit: "cm", kind: "pos", ideal: 0, ok: 3, bad: 6, prio: 3, noise: "hip", conf: "alta" },
  spineLoss: { view: "dtl", unit: "°", kind: "abs", ideal: 2, ok: 5, bad: 9, prio: 3, conf: "alta" },
  headVert: { view: "both", unit: "cm", kind: "abs", ideal: 2.5, ok: 4, bad: 7, prio: 4, noise: "head", conf: "alta" },
  seq: { view: "face", unit: "ms", kind: "min", ideal: 50, ok: 15, bad: -40, prio: 5, conf: "media" },
  hipShift: { view: "face", unit: "cm", kind: "min", ideal: 7, ok: 3, bad: -1, prio: 6, conf: "media" },
  sep: { view: "face", unit: "°", kind: "min", ideal: 30, ok: 15, bad: 5, prio: 7, conf: "baja" },
  shTurn: { view: "face", unit: "°", kind: "min", ideal: 80, ok: 55, bad: 40, prio: 8, conf: "baja" },
  finishW: { view: "face", unit: "cm", kind: "min", ideal: 12, ok: 6, bad: 1, prio: 9, conf: "media" },
  hold: { view: "both", unit: "", kind: "bool", prio: 10, conf: "alta" },
  tempo: { view: "both", unit: ":1", kind: "info", prio: 20 },
};
export const KEYS = Object.keys(METRICS);
const SCORED = KEYS.filter((k) => !["info", "bool"].includes(METRICS[k].kind));
// Plan escalonado: cada etapa trae sus mediciones. La última es todo junto.
export const STAGES = [["headLat", "headVert", "headFwd"], ["hipSway", "earlyExt"], ["seq", "hipShift"], ["sep", "shTurn", "spineLoss"], null];
export { STAGE_NAMES };

function avgF(list) {
  if (!list || !list.length) return null;
  const n = list.length, P = (k) => ({ x: list.reduce((s, f) => s + f[k].x, 0) / n, y: list.reduce((s, f) => s + f[k].y, 0) / n });
  const ang = (k) => { const v = list.map((f) => f[k]).filter((x) => x != null); if (!v.length) return null; return v[0] + v.reduce((s, x) => s + angDiff(x, v[0]), 0) / v.length; };
  const o = { head: P("head"), sh: P("sh"), hp: P("hp"), hands: P("hands"), lSh: P("lSh"), rSh: P("rSh"), shYaw: ang("shYaw"), hipYaw: ang("hipYaw") };
  o.T = dist(o.sh, o.hp) || 1; o.sw = list.reduce((s, f) => s + f.sw, 0) / n;
  return o;
}
const near = (fr, t, w) => fr.filter((x) => Math.abs(x.t - t) <= w).map((x) => x.f);
const NEEDS = { hipShift: "impact", earlyExt: "impact", spineLoss: "impact", seq: "seq", sep: "turn", shTurn: "turn", tempo: "handsTop" };

// Escala: de frente se usa el ancho de hombros, desde atrás el largo del tronco (los dos quedan en el plano de la imagen).
export const cmPerPx = (view, a, prof = {}) => {
  const h = prof.heightCm || 185;
  return view === "dtl" ? (prof.torsoCm || 0.285 * h) / a.T : (prof.shoulderCm || 0.2 * h) / a.sw;
};

export function analyze(sw, view, prof = {}) {
  const hand = prof.hand || "R";
  const all = sw.frames, fr = all.filter((x) => x.f.ok), A = sw.addr;
  const addr = avgF(fr.filter((x) => x.t >= A.t0 && x.t <= A.t1).map((x) => x.f)) || avgF(fr.slice(0, 3).map((x) => x.f));
  const top = avgF(near(fr, sw.topT, 40)) || addr, imp = avgF(near(fr, sw.impT, 40)) || addr;
  const fin = avgF(fr.filter((x) => x.t >= sw.endT - 350).map((x) => x.f)) || avgF(fr.slice(-3).map((x) => x.f));
  // Calidad: con una medición débil no se corrige nada (se marca "no medible").
  const inSwing = all.filter((x) => x.t > A.t1 && x.t <= sw.impT), okSwing = inSwing.filter((x) => x.f.ok);
  const span = okSwing.length > 1 ? (okSwing[okSwing.length - 1].t - okSwing[0].t) / 1000 : 0;
  const fps = span > 0 ? (okSwing.length - 1) / span : 0;
  const okFrac = inSwing.length ? okSwing.length / inSwing.length : 0;
  const vis = okSwing.length ? okSwing.reduce((s, x) => s + x.f.vis, 0) / okSwing.length : 0;
  const yawFrames = okSwing.filter((x) => x.f.shYaw != null && x.f.hipYaw != null).length;
  const hasYaw = yawFrames >= 5 && yawFrames >= 0.8 * okSwing.length;
  const handsTop = near(fr, sw.topT, 70).some((f) => f.wristsSeen);
  const q = {
    fps: r1(fps), okFrac: r1(okFrac), vis: r1(vis), downFrames: sw.downFrames,
    base: fps >= 14 && okFrac >= 0.8 && vis >= 0.55, impact: sw.downFrames >= 3, seq: sw.downFrames >= 6 && hasYaw, turn: hasYaw, handsTop,
  };
  const reason = q.base ? null : fps < 14 ? "fps" : okFrac < 0.8 ? "out" : "vis";
  const m = {};
  const start = fr.find((x) => x.t > A.t1 && dist(x.f.hands, addr.hands) > 0.08 * addr.T);
  if (start && sw.topT > start.t && sw.impT > sw.topT) {
    m.backMs = Math.round(sw.topT - start.t); m.downMs = Math.round(sw.impT - sw.topT); m.tempo = m.backMs / m.downMs;
  }
  const during = fr.filter((x) => x.t >= A.t1 && x.t <= sw.impT);
  const cmpx = cmPerPx(view, addr, prof);
  const geo = { cmpx, addrHead: addr.head, addrHip: addr.hp };
  if (view === "face") {
    // Dirección del objetivo en la imagen: del hombro de atrás al hombro de adelante.
    const tgt = Math.sign(hand === "L" ? addr.rSh.x - addr.lSh.x : addr.lSh.x - addr.rSh.x) || 1, back = -tgt;
    let lat = 0, dip = 0, rise = 0;
    for (const x of during) {
      const dx = (x.f.head.x - addr.head.x) * back * cmpx, dy = (x.f.head.y - addr.head.y) * cmpx;
      if (Math.abs(dx) > Math.abs(lat)) lat = dx;
      if (dy > dip) dip = dy;
      if (-dy > rise) rise = -dy;
    }
    m.headLat = lat; m.headVert = dip >= rise ? dip : -rise;
    m.hipSway = (top.hp.x - addr.hp.x) * back * cmpx;
    if (q.impact) m.hipShift = (imp.hp.x - addr.hp.x) * tgt * cmpx;
    if (fin) m.finishW = (fin.hp.x - addr.hp.x) * tgt * cmpx;
    m.hold = sw.finishStill ? 1 : 0;
    if (q.turn && during.length > 3) {
      const sT = during.map((x) => Math.abs(angDiff(x.f.shYaw, addr.shYaw))), hT = during.map((x) => Math.abs(angDiff(x.f.hipYaw, addr.hipYaw)));
      let iS = 0, iH = 0;
      for (let i = 0; i < during.length; i++) { if (sT[i] > sT[iS]) iS = i; if (hT[i] > hT[iH]) iH = i; }
      m.shTurn = sT[iS]; m.hipTurn = hT[iS]; m.sep = sT[iS] - hT[iS];
      if (q.seq && sT[iS] >= 25 && hT[iH] >= 10) {
        // Qué empieza a volver primero desde el top: la cadera, los hombros o las manos.
        const drop = (arr, pk) => { for (let i = pk; i < arr.length; i++) if (arr[i] < arr[pk] - 5) return during[i].t; return null; };
        const tH = drop(hT, iH), tS = drop(sT, iS);
        let tHands = null;
        for (const x of during) if (x.t > sw.topT && x.f.hands.y > top.hands.y + 0.12 * addr.T) { tHands = x.t; break; }
        if (tH != null && tS != null) { let s = tS - tH; if (tHands != null && tHands + 40 < tH) s = Math.min(s, tHands - tH); m.seq = Math.round(s); }
      }
    }
    geo.tgt = tgt;
  } else {
    // Desde atrás: hacia dónde mira el golfista (la cabeza va por delante de la cadera, hacia la pelota).
    const facing = Math.sign(addr.head.x - addr.hp.x) || 1;
    let fwd = 0, dip = 0, rise = 0;
    for (const x of during) {
      const dx = (x.f.head.x - addr.head.x) * facing * cmpx, dy = (x.f.head.y - addr.head.y) * cmpx;
      if (Math.abs(dx) > Math.abs(fwd)) fwd = dx;
      if (dy > dip) dip = dy;
      if (-dy > rise) rise = -dy;
    }
    m.headFwd = fwd; m.headVert = dip >= rise ? dip : -rise;
    const spine = (f) => deg(Math.atan2((f.sh.x - f.hp.x) * facing, f.hp.y - f.sh.y));
    m.spineAddr = spine(addr);
    if (q.impact) { m.earlyExt = (imp.hp.x - addr.hp.x) * facing * cmpx; m.spineLoss = spine(addr) - spine(imp); }
    m.hold = sw.finishStill ? 1 : 0;
    geo.facing = facing;
  }
  for (const k of Object.keys(m)) if (!["backMs", "downMs", "seq", "hold"].includes(k)) m[k] = r1(m[k]);
  const qm = {};
  for (const k of Object.keys(m)) qm[k] = q.base && (!NEEDS[k] || !!q[NEEDS[k]]);
  return { view, m, qm, q, reason, geo, t: { addr: A.t1, top: sw.topT, imp: sw.impT, end: sw.endT } };
}

// ---------------- Rangos, estados y tu perfil ----------------
export const badness = (k, v) => { const d = METRICS[k]; return d.kind === "abs" ? Math.abs(v) : d.kind === "pos" ? v : d.kind === "min" ? -v : 0; };
const fromBad = (k, b) => (METRICS[k].kind === "min" ? -b : b);

export function newProfile() {
  return { v: 1, heightCm: 185, hand: "R", stage: 0, focus: "auto", tune: {}, disputes: {}, targets: {}, tgtN: {}, noise: {} };
}

// Rango de una medición para ti: el rango de base, más lo que ajustaste con "eso está mal", más el ruido de tu cámara.
export function bandFor(k, prof = {}) {
  const d = METRICS[k], tune = prof.tune?.[k] || 0;
  let okB = badness(k, d.ok) + tune, badB = badness(k, d.bad) + tune;
  const nz = d.noise && d.kind !== "min" ? prof.noise?.[d.noise] : null;
  if (nz) { const floor = 2.5 * nz; if (okB < floor) { badB += floor - okB; okB = floor; } }
  return { okB, badB, idealB: badness(k, d.ideal) };
}
export function statusOf(k, v, prof) {
  const d = METRICS[k];
  if (!d || v == null || !isFinite(v)) return "nm";
  if (d.kind === "info") return "info";
  if (d.kind === "bool") return v ? "ok" : "ojo";
  const { okB, badB } = bandFor(k, prof), b = badness(k, v);
  return b <= okB ? "ok" : b <= badB ? "ojo" : "corregir";
}

// Junta lo que midieron una o dos cámaras en un solo registro de swing.
export function makeRecord(results, prof, extra = {}) {
  const m = {}, qm = {};
  for (const r of results) for (const k of Object.keys(r.m)) if (!(k in m) || (!qm[k] && r.qm[k])) { m[k] = r.m[k]; qm[k] = r.qm[k]; }
  const st = {};
  for (const k of KEYS) if (k in m) st[k] = qm[k] ? statusOf(k, m[k], prof) : "nm";
  const counted = Object.keys(st).some((k) => st[k] !== "nm" && st[k] !== "info" && k !== "hold");
  const reason = counted ? null : (results.find((r) => r.reason)?.reason || "vis");
  return { id: uid(), ts: Date.now(), views: results.map((r) => r.view), m, qm, st, counted, reason, tag: null, main: null, stage: prof.stage ?? 0, ...extra };
}
export const goodValues = (hist, k) => hist.filter((r) => r.qm?.[k] && r.m?.[k] != null && isFinite(r.m[k])).map((r) => r.m[k]);

// Ruido de medición: cuánto "se mueve" tu cabeza y tu cadera estando quieto en el address. Debajo de eso no corrijo.
export function updateNoise(prof, addr, view) {
  const cmpx = cmPerPx(view, addr, prof);
  prof.noise ||= {};
  for (const [k, j] of [["head", addr.jitHead], ["hip", addr.jitHip]]) {
    const v = j * cmpx;
    if (!isFinite(v)) continue;
    prof.noise[k] = prof.noise[k] == null ? v : 0.8 * prof.noise[k] + 0.2 * v;
  }
}

// Metas progresivas: parten un poco mejor que tu mediana y se ajustan cuando las logras (o si están muy lejos).
export function updateTargets(prof, hist) {
  prof.targets ||= {}; prof.tgtN ||= {};
  const changed = [];
  for (const k of SCORED) {
    const vals = goodValues(hist, k);
    if (vals.length < 5) continue;
    const bs = vals.map((v) => badness(k, v)), { badB, idealB } = bandFor(k, prof), w = Math.max(1e-6, badB - idealB);
    const T = prof.targets[k];
    if (T == null) {
      prof.targets[k] = Math.max(idealB, Math.min(median(bs.slice(-10)) - 0.1 * w, badB + w));
      prof.tgtN[k] = vals.length; changed.push({ k, kind: "new" }); continue;
    }
    if (vals.length - (prof.tgtN[k] || 0) < 5) continue;
    const last = bs.slice(-8), hits = last.filter((b) => b <= T).length;
    if (last.length >= 6 && hits >= 0.75 * last.length && T > idealB + 1e-9) {
      prof.targets[k] = Math.max(idealB, T - 0.2 * w); prof.tgtN[k] = vals.length; changed.push({ k, kind: "tighter" });
    } else if (last.length >= 8 && hits <= 1) {
      prof.targets[k] = Math.min(badB + w, T + 0.15 * w); prof.tgtN[k] = vals.length; changed.push({ k, kind: "looser" });
    }
  }
  return changed;
}
export const targetValue = (k, prof) => (prof.targets?.[k] == null ? null : fromBad(k, prof.targets[k]));
export const metTarget = (k, v, prof) => prof.targets?.[k] != null && v != null && badness(k, v) <= prof.targets[k] + 1e-9;

// Tendencia: tus últimos 5 swings contra los 5 anteriores (y si estás más o menos consistente).
export function trendOf(hist, k) {
  const vals = goodValues(hist, k);
  if (vals.length < 8) return null;
  const bs = vals.map((v) => badness(k, v)), last = bs.slice(-5), prev = bs.slice(-10, -5);
  const { badB, idealB } = bandFor(k, {}), w = Math.max(1e-6, badB - idealB);
  const mL = median(last), mP = median(prev), dl = mL - mP, thr = 0.15 * w;
  const dir = dl <= -thr ? "mejorando" : dl >= thr ? "empeorando" : "estable";
  const sL = mad(last), sP = mad(prev);
  const cons = sL > 1.6 * sP + 0.1 * w ? "menos" : sP > 1.6 * sL + 0.1 * w ? "mas" : null;
  return { dir, from: fromBad(k, mP), to: fromBad(k, mL), cons };
}

// "Profe, eso está mal": después de dos veces en la misma medición, la muevo a ti (nunca más que el ancho del rango).
export function dispute(prof, rec) {
  const k = rec?.main;
  if (!k) return null;
  const d = METRICS[k], v = rec.m[k], { okB } = bandFor(k, prof);
  const need = badness(k, v) - okB;
  if (!(need > 0)) return { k, pending: false, shift: 0 };
  prof.disputes ||= {}; prof.tune ||= {};
  const list = (prof.disputes[k] ||= []);
  list.push(need);
  if (list.length < 2) return { k, pending: true };
  const cap = Math.abs(badness(k, d.bad) - badness(k, d.ok));
  const shift = Math.min(median(list), cap);
  prof.tune[k] = Math.min(cap, (prof.tune[k] || 0) + shift);
  prof.disputes[k] = [];
  return { k, pending: false, shift };
}

// Lo que sientes contra lo que mide la cámara (necesita swings marcados como "bien" y como "mal").
export function feelInsights(hist) {
  const out = [];
  for (const k of SCORED) {
    const g = goodValues(hist.filter((r) => r.tag === "good"), k), b = goodValues(hist.filter((r) => r.tag === "bad"), k);
    if (g.length < 3 || b.length < 3) continue;
    const { badB, idealB } = bandFor(k, {}), w = Math.max(1e-6, badB - idealB);
    const mg = median(g.map((v) => badness(k, v))), mb = median(b.map((v) => badness(k, v)));
    if (mb - mg > 0.25 * w) out.push({ k, good: fromBad(k, mg), bad: fromBad(k, mb), gap: (mb - mg) / w });
  }
  return out.sort((a, b) => b.gap - a.gap);
}

// ---------------- El coach ----------------
const byPrio = (a, b) => METRICS[a].prio - METRICS[b].prio;
const measurable = (rec, k) => !!rec.st?.[k] && rec.st[k] !== "nm" && rec.st[k] !== "info";
export function stageKeys(prof) {
  const manual = prof.focus != null && prof.focus !== "auto";
  const i = manual ? +prof.focus : prof.stage || 0;
  return { i, manual, keys: STAGES[i] || KEYS.filter((k) => METRICS[k].kind !== "info") };
}
const numLine = (k, v) => (METRICS[k].unit === "cm" ? cmLine(v) : METRICS[k].unit === "°" ? degLine(v) : null);

// Qué decir después de un swing: una cosa buena y una sola corrección (la del foco, y solo si se repite o es muy clara).
export function coachSwing(rec, hist, prof) {
  const out = { lines: [], main: null, positive: null, soft: null, notes: [], targetHits: [] };
  if (!rec.counted) { out.lines.push(L.notCounted, L.why[rec.reason] || L.why.vis); return out; }
  const { keys } = stageKeys(prof);
  const prev = hist.filter((r) => r.counted && r.id !== rec.id).slice(-2);
  const persistent = (k) => {
    if (rec.st[k] !== "corregir") return false;
    const { okB, badB } = bandFor(k, prof), w = Math.max(1e-6, badB - okB);
    if (badness(k, rec.m[k]) > badB + 0.6 * w) return true; // muy claro, no espero a que se repita
    return prev.some((r) => r.st?.[k] === "corregir" || r.st?.[k] === "ojo");
  };
  const inStage = keys.filter((k) => measurable(rec, k)).sort(byPrio);
  const others = Object.keys(rec.st).filter((k) => !keys.includes(k) && measurable(rec, k)).sort(byPrio);
  out.main = inStage.find(persistent) || others.find((k) => METRICS[k].prio <= 3 && persistent(k)) || null;
  // sin corrección principal: aviso corto ("ojo con...") de algo del foco, o de algo fuera del foco que se repite
  if (!out.main) out.soft = inStage.find((k) => rec.st[k] === "corregir") || others.find((k) => METRICS[k].kind !== "bool" && persistent(k)) || null;
  const goods = inStage.filter((k) => rec.st[k] === "ok");
  out.targetHits = inStage.filter((k) => metTarget(k, rec.m[k], prof));
  out.positive = goods.find((k) => out.targetHits.includes(k)) || goods[0] || (!out.main ? others.find((k) => rec.st[k] === "ok" && METRICS[k].kind !== "bool") : null) || null;
  if (out.positive) { out.lines.push(M[out.positive].good); const n = numLine(out.positive, rec.m[out.positive]); if (n) out.lines.push(n); }
  if (out.main) {
    const k = out.main, v = rec.m[k];
    out.lines.push(M[k].bad(v)); const n = numLine(k, v); if (n) out.lines.push(n); out.lines.push(M[k].fix(v));
  } else if (out.soft) out.lines.push(ojoLine(out.soft));
  else if (!out.positive) out.lines.push(L.allGood);
  if (out.positive && !out.main && out.targetHits.includes(out.positive)) out.lines.push(logroLine(out.positive));
  out.notes = Object.keys(rec.st).filter((k) => k !== out.main && (rec.st[k] === "corregir" || rec.st[k] === "ojo")).sort(byPrio);
  return out;
}

// Avanza el plan escalonado cuando dominas la etapa: 5 de tus últimos 6 swings bien en cada medición del foco.
export function checkStage(prof, hist) {
  const { i, manual } = stageKeys(prof);
  if (manual || i >= STAGES.length - 1) return null;
  const keys = STAGES[i], recent = hist.filter((r) => r.counted).slice(-6);
  if (recent.length < 6) return null;
  let measured = 0;
  for (const k of keys) {
    const rs = recent.filter((r) => measurable(r, k));
    if (rs.length < 4) continue;
    measured++;
    if (rs.filter((r) => r.st[k] === "ok").length < rs.length - 1) return null;
  }
  if (!measured && recent.some((r) => keys.some((k) => measurable(r, k)))) return null;
  prof.stage = i + 1;
  return { from: i, skipped: !measured, lines: measured ? stageUpLines(i) : [] };
}

export const streakOf = (hist) => { let n = 0; for (let i = hist.length - 1; i >= 0; i--) { const r = hist[i]; if (!r.counted) continue; if (r.main) break; n++; } return n; };
export const streakLines = (hist) => { const n = streakOf(hist); return n >= 3 && n % 3 === 0 ? [streakLine(Math.min(n, 40))] : []; };

// Resumen hablado cada 5 swings: tendencias del foco y si al arreglar algo se desarmó otra cosa.
export function summaryLines(sessionRecs, hist, prof) {
  const counted = sessionRecs.filter((r) => r.counted);
  const lines = [countLine(Math.max(1, counted.length))];
  const { keys } = stageKeys(prof);
  const tr = {};
  for (const k of SCORED) { const t = trendOf(hist, k); if (t) tr[k] = t; }
  for (const k of keys.filter((k) => tr[k])) lines.push(trendLine(k, tr[k].dir));
  const better = Object.keys(tr).filter((k) => tr[k].dir === "mejorando");
  const worseOut = Object.keys(tr).filter((k) => tr[k].dir === "empeorando" && METRICS[k].prio <= 6 && !keys.includes(k)).sort(byPrio);
  if (better.length && worseOut.length) lines.push(L.desarme, trendLine(worseOut[0], "empeorando"));
  const cons = keys.map((k) => tr[k]?.cons).filter(Boolean);
  if (cons.includes("menos")) lines.push(L.menosConsistente); else if (cons.includes("mas")) lines.push(L.masConsistente);
  return { lines, trends: tr };
}

export function targetLines(changed) {
  return changed.filter((c) => c.kind === "tighter").slice(0, 1).map((c) => metaLine(c.k));
}

// Empareja un swing de la otra cámara por la hora del impacto (relojes sincronizados).
export function pairIndex(list, epoch, tol = 900) {
  let best = -1, bd = Infinity;
  list.forEach((x, i) => { const d = Math.abs(x.impEpoch - epoch); if (d < bd) { bd = d; best = i; } });
  return bd <= tol ? best : -1;
}

// ---------------- Comandos de voz ----------------
// Solo reacciona si la frase parte con "profe" (o "coach"): así puede escuchar sin confundirse con lo que hablas.
export function parseCommand(text) {
  const t = keyOf(text);
  const m = t.match(/\b(profe|profesor|coach|couch|coach|cauch|coche)\b(.*)$/);
  if (!m) return null;
  const c = m[2].trim();
  if (!c) return { cmd: "hey" };
  if (/\b(pausa|para|espera|detente|stop)\b/.test(c)) return { cmd: "pause" };
  if (/\b(sigue|seguimos|continua|continuar|dale|vamos)\b/.test(c)) return { cmd: "resume" };
  if (/\b(repite|repetir|que dijiste)\b/.test(c)) return { cmd: "repeat" };
  if (/\b(como voy|como vamos|resumen)\b/.test(c)) return { cmd: "summary" };
  if (/\b(esta mal medido|eso esta mal|no estoy de acuerdo|te equivocaste|equivocado|error|no es cierto)\b/.test(c)) return { cmd: "dispute" };
  if (/\b(que aprendiste|que sabes de mi)\b/.test(c)) return { cmd: "insights" };
  if (/\b(explica|explicame|por que|como lo hago)\b/.test(c)) return { cmd: "explain" };
  if (/\bfoco\b/.test(c)) {
    if (/automatico|auto/.test(c)) return { cmd: "focus", stage: "auto" };
    if (/cabeza/.test(c)) return { cmd: "focus", stage: 0 };
    if (/primero|secuencia|bajada/.test(c)) return { cmd: "focus", stage: 2 };
    if (/cadera/.test(c)) return { cmd: "focus", stage: 1 };
    if (/torsion|giro|hombro/.test(c)) return { cmd: "focus", stage: 3 };
    if (/todo/.test(c)) return { cmd: "focus", stage: 4 };
  }
  if (/\b(siguiente|sube de nivel|siguiente etapa)\b/.test(c)) return { cmd: "nextStage" };
  if (/\b(mal|malo|mala)\b/.test(c)) return { cmd: "tag", tag: "bad" };
  if (/\b(bien|bueno|buena|buenisimo)\b/.test(c)) return { cmd: "tag", tag: "good" };
  return { cmd: "unknown", text: c };
}

// ---------------- Texto para mostrar y para mandarle a Claude ----------------
export function fmt(k, v) {
  const d = METRICS[k];
  if (v == null || !isFinite(v)) return "s/d";
  if (d.kind === "bool") return v ? "sí" : "no";
  if (d.unit === ":1") return `${String(Math.round(v * 10) / 10).replace(".", ",")} : 1`;
  if (d.unit === "ms") return `${v > 0 ? "+" : ""}${Math.round(v)} ms`;
  const n = Math.round(v * 10) / 10;
  return `${String(n).replace(".", ",")} ${d.unit}`;
}
export function reportText(hist, prof, n = 25) {
  const out = [`Coach de casa v${VERSION}. Altura ${prof.heightCm} cm, ${prof.hand === "L" ? "zurdo" : "diestro"}. Etapa: ${STAGE_NAMES[stageKeys(prof).i]}.`];
  const counted = hist.filter((r) => r.counted);
  out.push(`Swings medidos: ${counted.length}. Ruido de medición: cabeza ${fmt("headLat", prof.noise?.head)}, cadera ${fmt("hipSway", prof.noise?.hip)}.`);
  for (const k of SCORED) {
    const vals = goodValues(hist, k);
    if (!vals.length) continue;
    const t = trendOf(hist, k), tv = targetValue(k, prof);
    out.push(`${M[k].label}: mediana últimos 10 ${fmt(k, median(vals.slice(-10)))}${tv != null ? `, meta ${fmt(k, tv)}` : ""}${t ? `, ${t.dir}` : ""}${prof.tune?.[k] ? `, ajustada ${String(Math.round(prof.tune[k] * 10) / 10).replace(".", ",")}` : ""}.`);
  }
  const fi = feelInsights(hist);
  for (const f of fi) out.push(`Sensación: cuando se siente bien, ${M[f.k].label.toLowerCase()} ${fmt(f.k, f.good)}; cuando se siente mal, ${fmt(f.k, f.bad)}.`);
  out.push("Últimos swings:");
  for (const r of hist.slice(-n)) {
    const d = new Date(r.ts), when = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    const vals = KEYS.filter((k) => r.m?.[k] != null).map((k) => `${k} ${fmt(k, r.m[k])} ${r.st?.[k] || ""}`).join("; ");
    out.push(`${when} [${(r.views || []).join("+")}] ${r.counted ? "" : "(no contado) "}${r.tag ? `(${r.tag}) ` : ""}${r.main ? `corrección ${r.main}. ` : ""}${vals}`);
  }
  return out.join("\n");
}
