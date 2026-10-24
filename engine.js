// Pure logic: pose features, golfer lock, ball detection, swing detection, metrics, setup checks,
// coaching, plans by venue, stats, rounds and reports. No DOM, so everything is tested in Node.
import { RULES, RESULT_TIPS, BAD_RESULTS, GROUPS, BAG, CATS, RANGE_ORDER, SHORT_ORDER, VENUES, BALL_POS, GOALS, goalKey, clubById } from "./rules.js?v=22";
import { badWeight, resultLabel } from "./voice.js?v=22";
import { L, T } from "./lines.js?v=22";

const I = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lIdx: 19, rIdx: 20, lHip: 23, rHip: 24,
  lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHe: 29, rHe: 30, lTo: 31, rTo: 32 };
const FACE_REQ = [I.nose, I.lSh, I.rSh, I.lHip, I.rHip, I.lAn, I.rAn, I.lWr, I.rWr];
const DTL_REQ = [[I.nose], [I.lSh, I.rSh], [I.lHip, I.rHip], [I.lAn, I.rAn], [I.lWr, I.rWr]];
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r) => (r * 180) / Math.PI;
const r3 = (x) => (typeof x === "number" && isFinite(x) ? Math.round(x * 1000) / 1000 : x);
function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  return d ? deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d)))) : null;
}
const seen = (q) => q.v >= 0.5 && q.nx > 0.01 && q.nx < 0.99 && q.ny > 0.01 && q.ny < 0.99;
export const groupOf = (clubId, blockCat) => (blockCat === "warmup" ? "warmup" : blockCat === "chip" ? "chip" : blockCat === "bunker" ? "bunker" : blockCat === "putt" ? "putt" : clubById(clubId).group);

// ---------------- Features ----------------
export function features(lm, W, H, view = "face") {
  if (!lm || lm.length < 33) return { ok: false, why: "nobody", missing: [] };
  const p = lm.map((l) => ({ x: l.x * W, y: l.y * H, v: l.visibility ?? 1, nx: l.x, ny: l.y }));
  const missing = [];
  if (view === "dtl") { for (const g of DTL_REQ) if (!g.some((i) => seen(p[i]))) missing.push(g[0]); }
  else for (const i of FACE_REQ) if (!seen(p[i])) missing.push(i);
  return build(p, missing.length === 0, missing, H);
}
function build(p, ok, missing, H) {
  const sh = mid(p[I.lSh], p[I.rSh]), hp = mid(p[I.lHip], p[I.rHip]);
  const T = dist(sh, hp) || 1;
  return {
    ok, missing, p, sh, hp, T, H,
    hands: mid(p[I.lWr], p[I.rWr]), nose: p[I.nose],
    span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    lAn: p[I.lAn], rAn: p[I.rAn], ankMid: mid(p[I.lAn], p[I.rAn]),
    heelMid: mid(p[I.lHe], p[I.rHe]), toeMid: mid(p[I.lTo], p[I.rTo]),
    knMid: mid(p[I.lKn], p[I.rKn]),
    bodyH: Math.max(p[I.lAn].y, p[I.rAn].y) - p[I.nose].y,
  };
}
export function frameHint(f, view) {
  if (!f || !f.p) return "I can't see you. Step into the picture.";
  const m = new Set(f.missing);
  if (m.has(I.lAn) || m.has(I.rAn)) return "I can't see your feet. Move the camera back or point it lower.";
  if (m.has(I.nose)) return "I can't see your head. Move the camera back or point it higher.";
  if (m.size) return "Part of your body is out of the picture. Move the camera back a little.";
  if (f.H && f.bodyH / f.H < 0.35) return "You are too far away. Move the camera a bit closer.";
  if (view === "face" && f.span < 0.45 * f.T) return "This looks like a view from behind. Put the camera in front of you.";
  if (view === "dtl" && f.span > 0.75 * f.T) return "This looks like a view from the front. Put the camera behind you.";
  return null;
}

// ---------------- Golfer lock ----------------
export function pickGolfer(poses, lock) {
  const info = (poses || []).map((lm, idx) => ({ idx, x: (lm[I.lHip].x + lm[I.rHip].x) / 2, y: (lm[I.lHip].y + lm[I.rHip].y) / 2, size: Math.max(lm[I.lAn].y, lm[I.rAn].y) - lm[I.nose].y }));
  if (!info.length) return { idx: -1, lock };
  let best = null;
  if (lock) {
    for (const c of info) {
      const d = Math.hypot(c.x - lock.x, c.y - lock.y);
      if (d < 0.2 && c.size > lock.size * 0.6 && c.size < lock.size * 1.6 && (!best || d < best.d)) best = { ...c, d };
    }
    if (!best) return { idx: -1, lock };
  } else {
    const maxSize = Math.max(...info.map((c) => c.size));
    for (const c of info.filter((c) => c.size >= 0.6 * maxSize)) { const d = Math.abs(c.x - 0.5); if (!best || d < best.d) best = { ...c, d }; }
  }
  const k = lock ? 0.3 : 1;
  return { idx: best.idx, lock: lock ? { x: lock.x + (best.x - lock.x) * k, y: lock.y + (best.y - lock.y) * k, size: lock.size + (best.size - lock.size) * k } : { x: best.x, y: best.y, size: best.size } };
}

// ---------------- Ball detection ----------------
// Where the ball should be, in video pixels. Face on: in front of and between the feet. Behind: ahead of the toes.
export function ballRoi(f, view) {
  if (!f || !f.p) return null;
  const P = f.p, T = f.T, feet = [I.lAn, I.rAn, I.lHe, I.rHe, I.lTo, I.rTo].map((i) => P[i]);
  const ay = Math.max(P[I.lAn].y, P[I.rAn].y);
  const shoe = (an, he, to) => { const xs = [an.x, he.x, to.x], ys = [an.y, he.y, to.y]; return { x0: Math.min(...xs) - 0.1 * T, x1: Math.max(...xs) + 0.1 * T, y0: Math.min(...ys) - 0.25 * T, y1: Math.max(...ys) + 0.12 * T }; };
  const exclude = [shoe(P[I.lAn], P[I.lHe], P[I.lTo]), shoe(P[I.rAn], P[I.rHe], P[I.rTo])];
  let x0, x1, y0, y1;
  if (view === "dtl") {
    const facing = Math.sign(f.toeMid.x - f.heelMid.x) || 1;
    const toe = facing > 0 ? Math.max(P[I.lTo].x, P[I.rTo].x) : Math.min(P[I.lTo].x, P[I.rTo].x);
    const a = toe + facing * 0.15 * T, b = toe + facing * 2.6 * T;
    x0 = Math.min(a, b); x1 = Math.max(a, b); y0 = ay - 0.4 * T; y1 = ay + 0.3 * T;
  } else {
    const xs = feet.map((q) => q.x);
    x0 = Math.min(...xs) - 0.25 * f.span; x1 = Math.max(...xs) + 0.25 * f.span; y0 = ay - 0.15 * T; y1 = ay + 0.5 * T;
  }
  return { x0: Math.round(x0), x1: Math.round(x1), y0: Math.round(y0), y1: Math.round(y1), exclude, d: Math.max(3, 0.0265 * f.bodyH) };
}
// img: { data: RGBA bytes, width, height }. Returns { x, y, d, area } or null.
export function detectBall(img, roi) {
  if (!img || !roi) return null;
  const W = img.width, H = img.height, D = img.data;
  const x0 = Math.max(0, roi.x0), x1 = Math.min(W - 1, roi.x1), y0 = Math.max(0, roi.y0), y1 = Math.min(H - 1, roi.y1);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, mask = new Uint8Array(w * h), lum = [];
  const inShoe = (x, y) => roi.exclude?.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const i = (y * W + x) * 4; lum.push(0.299 * D[i] + 0.587 * D[i + 1] + 0.114 * D[i + 2]); }
  lum.sort((a, b) => a - b);
  const med = lum[Math.floor(lum.length / 2)] || 0, thr = Math.max(165, med + 45);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (inShoe(x, y)) continue;
    const i = (y * W + x) * 4, r = D[i], g = D[i + 1], b = D[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    if (L >= thr && Math.max(r, g, b) - Math.min(r, g, b) < 55) mask[(y - y0) * w + (x - x0)] = 1;
  }
  const expA = (Math.PI / 4) * roi.d * roi.d, seenM = new Uint8Array(w * h);
  let best = null;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seenM[s]) continue;
    const stack = [s]; seenM[s] = 1; let area = 0, sx = 0, sy = 0, bx0 = w, bx1 = 0, by0 = h, by1 = 0;
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k - x) / w; area++; sx += x; sy += y;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      for (const n of [k - 1, k + 1, k - w, k + w]) {
        if (n < 0 || n >= w * h || seenM[n] || !mask[n]) continue;
        if ((n === k - 1 && x === 0) || (n === k + 1 && x === w - 1)) continue;
        seenM[n] = 1; stack.push(n);
      }
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, fill = area / (bw * bh), asp = bw / bh;
    if (area < 0.2 * expA || area > 4 * expA || asp < 0.45 || asp > 2.2 || fill < 0.45) continue;
    const score = Math.abs(Math.log(area / expA)) + Math.abs(Math.log(asp));
    if (!best || score < best.score) best = { x: x0 + sx / area, y: y0 + sy / area, d: Math.sqrt((4 * area) / Math.PI), area, score };
  }
  return best ? { x: r3(best.x), y: r3(best.y), d: r3(best.d), area: best.area } : null;
}
// true: the ball left (real shot). false: the ball is still there (practice or a miss). null: no ball seen at setup.
export function ballHit(before, after) {
  if (!before) return null;
  if (after && Math.hypot(after.x - before.x, after.y - before.y) < 1.5 * before.d) return false;
  return true;
}

// ---------------- Swing detector ----------------
export class SwingDetector {
  constructor() { this.club = "iron"; this.reset(); }
  reset() { this.state = "idle"; this.hist = []; this.frames = []; this.addr = null; this.until = 0; }
  push(t, f) {
    this.hist.push({ t, f });
    while (this.hist.length && t - this.hist[0].t > 2000) this.hist.shift();
    if (this.state === "cooldown") { if (t > this.until) this.state = "idle"; return null; }
    if (this.state === "swing") return this._swing(t, f);
    if (!f.ok) { if (this.state === "address") { this.state = "idle"; return { type: "lost" }; } return null; }
    const still = this._stillWindow(t, f.T);
    const low = this.club === "putt" ? f.hands.y > f.sh.y + 0.5 * f.T : f.hands.y > f.sh.y + 0.7 * f.T;
    if (this.state === "idle") { if (still && low) { this.state = "address"; this.addr = still; return { type: "ready" }; } return null; }
    if (still && low) this.addr = still;
    const A = this.addr;
    const move = this.club === "putt" ? dist(f.hands, A.hands) : A.hands.y - f.hands.y;
    const need = (this.club === "putt" ? 0.1 : this.club === "chip" || this.club === "bunker" || this.club === "warmup" ? 0.3 : 0.55) * A.T;
    if (move > need) {
      this.state = "swing"; this.start = t;
      this.frames = this.hist.filter((h) => h.t >= A.t0 && h.f.ok);
      this.top = null; this.down = false; this.imp = null;
      return { type: "started" };
    }
    if (Math.abs(f.hands.x - A.hands.x) > 1.2 * A.T && this.club !== "putt") { this.state = "idle"; return { type: "lost" }; }
    return null;
  }
  _stillWindow(t, T) {
    const w = this.hist.filter((h) => t - h.t <= 500 && h.f.ok);
    if (w.length < 4 || t - w[0].t < 350) return null;
    const cx = w.reduce((s, h) => s + h.f.hands.x, 0) / w.length, cy = w.reduce((s, h) => s + h.f.hands.y, 0) / w.length;
    for (const h of w) if (Math.hypot(h.f.hands.x - cx, h.f.hands.y - cy) > 0.06 * T) return null;
    return { t0: w[0].t, t1: w[w.length - 1].t, hands: { x: cx, y: cy }, T: w[w.length - 1].f.T };
  }
  _swing(t, f) {
    if (f.ok) this.frames.push({ t, f });
    const A = this.addr, putt = this.club === "putt";
    if (t - this.start > 4000) { this._cool(t, 1000); return { type: "discard", why: "too slow" }; }
    if (!f.ok) return null;
    const amt = putt ? dist(f.hands, A.hands) : A.hands.y - f.hands.y;
    if (!this.down && (!this.top || amt > this.top.amt)) this.top = { t, f, amt };
    if (!this.down && this.top && t > this.top.t && (putt ? amt <= 0.35 * this.top.amt : amt <= 0.25 * A.T)) this.down = true;
    if (this.down) {
      const d = dist(f.hands, A.hands);
      if (!this.imp || (d < this.imp.d && t - this.imp.t < 250)) this.imp = { t, d };
      if (t - this.imp.t > 900) {
        const downFrames = this.frames.filter((x) => x.t > this.top.t && x.t <= this.imp.t).length;
        const out = { type: "swing", frames: this.frames.slice(), addr: A, topT: this.top.t, impT: this.imp.t, club: this.club, downFrames };
        this._cool(t, 1500);
        return out;
      }
    }
    return null;
  }
  _cool(t, ms) { this.state = "cooldown"; this.until = t + ms; this.frames = []; }
}

// ---------------- Metrics ----------------
function avgFeat(list) {
  if (!list.length) return null;
  const n = list.length, acc = (fn) => list.reduce((s, x) => s + fn(x), 0) / n;
  const p = []; for (let i = 0; i < 33; i++) p.push({ x: acc((x) => x.p[i].x), y: acc((x) => x.p[i].y), v: 1, nx: 0.5, ny: 0.5 });
  return build(p, true, [], list[0].H);
}
export const averageFeatures = avgFeat;
const near = (frames, t, w) => frames.filter((x) => Math.abs(x.t - t) <= w).map((x) => x.f);
export const keyTimes = (sw) => ({ setup: sw.addr.t1, top: sw.topT, impact: sw.impT, finish: sw.impT + 800 });

// Setup metrics from a still address (also used live, before the swing).
export function setupMetrics(a, view, clubId, group, ball) {
  const m = {};
  if (!a) return m;
  const T = a.T;
  if (view === "face") {
    const dir = Math.sign(a.p[I.lSh].x - a.p[I.rSh].x) || 1;
    const lead = { sh: a.p[I.lSh], an: a.lAn }, trail = { sh: a.p[I.rSh], an: a.rAn };
    const stanceW = Math.abs(a.lAn.x - a.rAn.x) || 1;
    const slope = (a.lAn.y - a.rAn.y) / ((a.lAn.x - a.rAn.x) || 1);
    m.cameraRollDeg = deg(Math.atan(slope));
    m.stanceRatio = stanceW / (a.span || 1);
    const sx = a.sh.x - a.hp.x, sy = a.sh.y - a.hp.y, th = -Math.atan(slope);
    const rx = sx * Math.cos(th) - sy * Math.sin(th), ry = sx * Math.sin(th) + sy * Math.cos(th);
    m.tiltDeg = deg(Math.atan2(-rx * dir, -ry));
    m.leadShHigher = ((trail.sh.y - lead.sh.y) - slope * (trail.sh.x - lead.sh.x)) / T;
    const feetSpan = ((lead.an.x - trail.an.x) * dir) || 1;
    m.addrWeight = (((a.sh.x + a.hp.x) / 2 - trail.an.x) * dir) / feetSpan;
    if (ball) {
      m.ballPos = ((ball.x - trail.an.x) * dir) / feetSpan;
      const target = group === "chip" ? 0.5 : group === "putt" ? BALL_POS.PT : BALL_POS[clubId] ?? 0.55;
      m.ballPosErr = m.ballPos - target;
      m.handsAhead = ((a.hands.x - ball.x) * dir) / T;
    }
  } else {
    const facing = Math.sign(a.toeMid.x - a.heelMid.x) || 1;
    m.hingeDeg = deg(Math.atan2(Math.abs(a.sh.x - a.hp.x), a.hp.y - a.sh.y));
    const ka = [angle(a.p[I.lHip], a.p[I.lKn], a.p[I.lAn]), angle(a.p[I.rHip], a.p[I.rKn], a.p[I.rAn])].filter((x) => x != null);
    m.kneeDeg = ka.length ? ka.reduce((x, y) => x + y, 0) / ka.length : null;
    m.shoulderOverFeet = ((a.sh.x - a.ankMid.x) * facing) / T;
    m.reach = ((a.hands.x - a.sh.x) * facing) / T;
    m.forearmGap = (a.p[I.lEl].y - a.p[I.rEl].y) / T;
    if (ball) { m.eyesOver = ((a.nose.x - ball.x) * facing) / T; m.ballDist = Math.abs(ball.x - a.toeMid.x) / T; }
  }
  for (const k of Object.keys(m)) m[k] = r3(m[k]);
  return m;
}

export function analyze(sw, view, ctx = {}) {
  const { clubId = "7i", group = "iron", ball = null } = ctx;
  const fr = sw.frames;
  const addr = avgFeat(fr.filter((x) => x.t >= sw.addr.t0 && x.t <= sw.addr.t1 + 60).map((x) => x.f)) || avgFeat(fr.slice(0, 3).map((x) => x.f));
  const top = avgFeat(near(fr, sw.topT, 40)), imp = avgFeat(near(fr, sw.impT, 40));
  const fin = avgFeat(fr.filter((x) => x.t >= sw.impT + 600).map((x) => x.f)) || avgFeat(fr.slice(-2).map((x) => x.f));
  const T = addr.T, impactOk = (sw.downFrames ?? 5) >= 3;
  const m = { downFrames: sw.downFrames ?? null, ...setupMetrics(addr, view, clubId, group, ball) };
  m.headRise = (addr.nose.y - imp.nose.y) / T;

  // Tempo: takeaway start, top, impact
  const start = fr.find((x) => x.t > sw.addr.t1 && dist(x.f.hands, addr.hands) > 0.08 * T);
  if (start && sw.topT > start.t && sw.impT > sw.topT) {
    m.backMs = sw.topT - start.t; m.downMs = sw.impT - sw.topT;
    m.tempoRatio = m.backMs / m.downMs;
  }
  // Pendulum: how far the hands go back versus through
  const before = fr.filter((x) => x.t <= sw.impT), after = fr.filter((x) => x.t > sw.impT && x.t <= sw.impT + 900);
  const amp = (list) => list.reduce((mx, x) => Math.max(mx, dist(x.f.hands, addr.hands)), 0);
  const back = amp(before), through = amp(after);
  if (back > 0.05 * T) m.pendulum = through / back;
  // Head and knees during the stroke
  m.headMove = fr.filter((x) => x.t <= sw.impT + 300).reduce((mx, x) => Math.max(mx, dist(x.f.nose, addr.nose)), 0) / T;
  m.kneeMove = fr.filter((x) => x.t <= sw.impT + 300).reduce((mx, x) => Math.max(mx, dist(x.f.knMid, addr.knMid)), 0) / T;

  if (view === "face") {
    const dir = Math.sign(addr.p[I.lSh].x - addr.p[I.rSh].x) || 1;
    const lead = addr.lAn, trail = addr.rAn, stanceW = Math.abs(lead.x - trail.x) || 1, feetSpan = ((lead.x - trail.x) * dir) || 1;
    m.sway = ((addr.hp.x - top.hp.x) * dir) / stanceW;
    m.shoulderTurn = top.span / (addr.span || 1);
    m.transfer = ((fin.hp.x - trail.x) * dir) / feetSpan;
    m.impWeight = impactOk ? (((imp.sh.x + imp.hp.x) / 2 - trail.x) * dir) / feetSpan : null;
    m.upperAhead = impactOk ? ((imp.sh.x - imp.hp.x) * dir) / T : null;
    // A good finish keeps the lead foot planted and pivots the trail foot on its toe: the trail heel
    // rising is not "moving". Count the lead ankle and the trail toe only.
    m.feetMoved = Math.max(dist(fin.lAn, addr.lAn), dist(fin.p[I.rTo], addr.p[I.rTo])) / stanceW;
    const wa = (f) => angle(f.p[I.lEl], f.p[I.lWr], f.p[I.lIdx]);
    if (impactOk && wa(addr) != null && wa(imp) != null) m.wristFlip = Math.abs(wa(imp) - wa(addr));
    // Scooping shows as the hands arriving behind the ball. The pose model cannot see the club or the
    // wrist angle well, but it sees the hands, and the ball position is known from the setup.
    if (impactOk && ctx.ball) m.impHandsAhead = ((imp.hands.x - ctx.ball.x) * dir) / T;
    const v = (f) => dist(f.hands, f.sh) / T, v0 = v(addr);
    m.vChange = Math.max(...fr.filter((x) => x.t <= sw.impT + 200).map((x) => Math.abs(v(x.f) - v0)));
  } else {
    const hingeImp = deg(Math.atan2(Math.abs(imp.sh.x - imp.hp.x), imp.hp.y - imp.sh.y));
    m.hingeLoss = impactOk ? m.hingeDeg - hingeImp : null;
  }
  for (const k of Object.keys(m)) m[k] = r3(m[k]);
  return m;
}

// ---------------- Checks ----------------
export const ruleById = (id) => RULES.find((r) => r.id === id);
const say = (v, m, g) => (typeof v === "function" ? v(m, g) : v);
const appliesTo = (r, group, view) => r.auto && r.clubs.includes(group) && (r.view === "both" || r.view === view);

// ---------------- Learning from you ----------------
// When you say a correction was wrong, the app works out how far that measurement was from passing. After two
// such corrections on the same check it shifts the check by the median of them, never more than the rule's
// tolerance (rule.tol), so it adapts to your body and camera without drifting away from the tip.
export function tuneOffset(tune, id) {
  const r = ruleById(id), t = tune?.[id];
  if (!r?.metric || !t || t.log.length < 2) return 0;
  const v = t.log.slice().sort((a, b) => a - b), med = v[Math.floor(v.length / 2)];
  return Math.max(-r.tol, Math.min(r.tol, med));
}
const tuned = (r, m, tune) => { const o = tuneOffset(tune, r.id); return o && m[r.metric] != null ? { ...m, [r.metric]: m[r.metric] + o } : m; };
export function flipNeeded(r, m, group) {      // smallest shift of the measurement that changes the verdict
  if (!r?.metric || m?.[r.metric] == null) return null;
  const was = r.check(m, group), step = r.tol / 20;
  for (let k = 1; k <= 20; k++) for (const sg of [1, -1]) {
    const d = sg * k * step, p = r.check({ ...m, [r.metric]: m[r.metric] + d }, group);
    if (p != null && p !== was) return Math.round(d * 1000) / 1000;
  }
  return null;
}
export function runChecks(m, group, view, { kind = null, muted = [], tune = null } = {}) {
  const out = [];
  for (const r of RULES) {
    if (!appliesTo(r, group, view) || muted.includes(r.id) || (kind && r.kind !== kind)) continue;
    const pass = r.check(tune ? tuned(r, m, tune) : m, group);
    if (pass === null || pass === undefined) continue;
    out.push({ id: r.id, pass });
  }
  return out;
}
// Pre-shot check: the first failing setup rule (by priority) and what to say. Low confidence rules are
// logged but not spoken until calibration proves them.
export function setupCheck(m, group, view, { selected = null, muted = [], tune = null } = {}) {
  const checks = runChecks(m, group, view, { kind: "setup", muted, tune }).filter((c) => !selected || selected.includes(c.id));
  const failing = checks.filter((c) => !c.pass).map((c) => ruleById(c.id)).sort((a, b) => a.priority - b.priority);
  const speakable = failing.filter((r) => r.conf === "high");
  return { checks, failing, next: speakable[0] || null, fix: speakable[0] ? say(speakable[0].fix, m, group) : null, ready: speakable.length === 0, logged: failing.map((r) => ({ id: r.id, fix: say(r.fix, m, group) })) };
}

// ---------------- Coaching after the swing ----------------
export function emptyCoachState() { return { v: 3, focus: null, hist: {}, mastered: [], disputes: {}, skipped: {}, lastPass: {}, tune: {} }; }
function pickFocus(state, group, failingIds, exclude) {
  const cands = RULES.filter((r) => r.auto && r.kind === "motion" && r.conf === "high" && r.clubs.includes(group) && r.id !== exclude && !(state.skipped[r.id] > 0) &&
    (failingIds.includes(r.id) || (state.hist[r.id] || []).slice(-5).filter((x) => !x).length >= 3));
  cands.sort((a, b) => a.priority - b.priority);
  return cands[0] || null;
}
export function coach(state, checks, m, group, view, mode, opts = {}) {
  const seed = opts.seed ?? Object.values(state.hist).reduce((a, h) => a + h.length, 0);
  const name = opts.name || "Mariano", reason = opts.reason !== false;
  for (const k of Object.keys(state.skipped)) state.skipped[k]--;
  for (const c of checks) { (state.hist[c.id] ??= []).push(c.pass); if (state.hist[c.id].length > 12) state.hist[c.id].shift(); if (c.pass) state.lastPass[c.id] = opts.swingId || true; }
  const motion = checks.filter((c) => ruleById(c.id)?.kind === "motion");
  const failing = motion.filter((c) => !c.pass).map((c) => ruleById(c.id)).sort((a, b) => a.priority - b.priority);
  const failingHigh = failing.filter((r) => r.conf === "high");
  const lines = [], items = []; let event = null;
  if (!state.focus) { const r = pickFocus(state, group, failingHigh.map((r) => r.id)); if (r) state.focus = { id: r.id, hist: [] }; }
  const F = state.focus, fr = F && ruleById(F.id), fc = F && motion.find((c) => c.id === F.id);
  if (fc) {
    F.hist.push(fc.pass); if (F.hist.length > 10) F.hist.shift();
    const l5 = F.hist.slice(-5), good = l5.filter(Boolean).length;
    items.push({ id: F.id, pass: fc.pass, focus: true });
    lines.push(fc.pass ? `${T.good(seed)} ${say(fr.ok, m, group)} ${T.ofN(good, l5.length)}` : say(fr.cue, m, group) + (reason ? " " + fr.why : ""));
    if (l5.length >= 5 && good >= 4) {
      state.mastered.push(F.id);
      const next = pickFocus(state, group, failingHigh.map((r) => r.id), F.id);
      event = { type: "mastered", id: F.id, next: next?.id || null };
      lines.push(T.fixedIt(name, fr.title) + (next ? " " + T.nextFocus(next.title) : ""));
      state.focus = next ? { id: next.id, hist: [] } : null;
    }
  } else {
    const other = failingHigh[0];
    if (other) { items.push({ id: other.id, pass: false }); lines.push(say(other.cue, m, group) + (reason ? " " + other.why : "")); }
    else lines.push(T.praise(seed));
  }
  if (mode === 3) {
    for (const r of failingHigh) {
      if (items.length >= 3) break;
      if (items.some((i) => i.id === r.id)) continue;
      items.push({ id: r.id, pass: false }); lines.push(`${L.also} ${say(r.cue, m, group)}`);
    }
  }
  const lowFails = failing.filter((r) => r.conf === "low").map((r) => r.id);
  return { speech: lines.join(" "), items, event, lowFails, detail: items.length ? ruleById(items[0].id).rule : "", focusId: state.focus?.id || null };
}
export function dispute(state, ruleId, m = null, group = null) {
  const h = state.hist[ruleId]; if (h?.length) h.pop();
  if (state.focus?.id === ruleId && state.focus.hist.length) state.focus.hist.pop();
  state.disputes[ruleId] = (state.disputes[ruleId] || 0) + 1;
  const d = m ? flipNeeded(ruleById(ruleId), tuned(ruleById(ruleId), m, state.tune), group) : null;
  if (d != null) { const t = ((state.tune ??= {})[ruleId] ??= { log: [] }); t.log.push(d + tuneOffset(state.tune, ruleId)); if (t.log.length > 9) t.log.shift(); }
  return d;
}
// What the app has adapted to you, for the report and the profile.
export function tuneSummary(state) {
  return Object.keys(state?.tune || {}).map((id) => ({ id, title: ruleById(id)?.title || id, n: state.tune[id].log.length, off: tuneOffset(state.tune, id) })).filter((t) => t.off);
}

// ---------------- Best and worst swings ----------------
// A swing's score: how the ball flew (your words) counts most, then the clear faults the camera saw.
export function swingScore(w) {
  const r = resOf(w), high = (list) => (list || []).filter((c) => !c.pass && ruleById(c.id)?.conf === "high").length;
  const res = r?.result ? (r.result === "straight" ? 2 : -2 * badWeight(r)) : 0;
  return res - high(w.checks) - 0.5 * high(w.setup?.checks);
}
// The fault to show on a swing: the first clear swing fault, then a setup fault, then a weak one.
export function mainFault(w) {
  const fails = (list, kind) => (list || []).filter((c) => !c.pass).map((c) => ruleById(c.id)).filter((r) => r && r.kind === kind).sort((a, b) => a.priority - b.priority);
  const motion = fails(w.checks, "motion"), setup = fails(w.setup?.checks, "setup");
  return (motion.find((r) => r.conf === "high") || setup.find((r) => r.conf === "high") || motion[0] || setup[0] || null)?.id || null;
}
// Best and worst swing for each club group and camera side, from swings that count.
export function bestWorst(swings) {
  const by = {};
  for (const w of (swings || []).filter((w) => !w.practice && w.block !== "warmup" && w.club !== "warmup")) (by[`${w.club}|${w.view}`] ??= []).push(w);
  const order = ["driver", "hybrid", "iron", "chip", "bunker", "putt"];
  return Object.entries(by).map(([key, list]) => {
    const [group, view] = key.split("|"), sorted = list.slice().sort((a, b) => swingScore(b) - swingScore(a) || a.t - b.t);
    const best = sorted[0], worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    return { key, group, view, n: list.length, best, worst: worst && swingScore(worst) < swingScore(best) ? worst : null };
  }).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.view === "face" ? -1 : 1));
}
export function skipFocus(state, group) {
  const old = state.focus?.id; if (old) state.skipped[old] = 20;
  const recent = Object.entries(state.hist).filter(([, h]) => h.slice(-5).some((x) => !x)).map(([id]) => id);
  const next = pickFocus(state, group, recent, old);
  state.focus = next ? { id: next.id, hist: [] } : null;
  return next;
}

// ---------------- Results and stats ----------------
// Each swing keeps your parsed words in `res`. Older swings only had a `result` string.
export const resOf = (w) => w.res || (w.result ? { result: w.result, sev: 2 } : null);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const catOf = (w) => w.cat || clubById(w.clubId || "7i").cat;
const counted = (w) => !w.practice && w.block !== "warmup";

export function catStats(sessions, lastN = 3) {
  const out = {};
  for (const s of (sessions || []).slice(-lastN)) for (const w of s.swings || []) {
    if (!counted(w)) continue;
    const c = catOf(w), o = (out[c] ??= { n: 0, logged: 0, bad: 0, badScore: 0, checks: 0, fails: 0 });
    o.n++;
    const r = resOf(w);
    if (r?.result) { o.logged++; const b = badWeight(r); o.badScore += b; if (b) o.bad++; }
    for (const ch of w.checks || []) { if (ruleById(ch.id)?.conf !== "high") continue; o.checks++; if (!ch.pass) o.fails++; }
  }
  for (const o of Object.values(out)) {
    o.badRate = o.logged ? o.badScore / o.logged : null;
    o.faultRate = o.checks ? o.fails / o.checks : null;
    o.score = o.badRate != null && o.logged >= 5 ? 0.6 * Math.min(1, o.badRate) + 0.4 * (o.faultRate ?? o.badRate) : o.faultRate;
  }
  return out;
}
export function badRate(s) {
  const r = (s.swings || []).filter((w) => counted(w) && resOf(w)?.result);
  return r.length ? Math.min(1, r.reduce((a, w) => a + badWeight(resOf(w)), 0) / r.length) : null;
}
export function sessionStats(s) {
  const swings = (s.swings || []).filter((w) => !w.practice);
  const byClub = {}, results = {}, faults = {};
  for (const w of swings) {
    const k = w.clubId ? clubById(w.clubId).name : (GROUPS[w.club] || w.club);
    byClub[k] = (byClub[k] || 0) + 1;
    const r = resOf(w); if (r?.result) results[r.result] = (results[r.result] || 0) + 1;
    for (const c of w.checks || []) { faults[c.id] ??= { fail: 0, n: 0 }; faults[c.id].n++; if (!c.pass) faults[c.id].fail++; }
    for (const c of w.setup?.checks || []) { faults[c.id] ??= { fail: 0, n: 0 }; faults[c.id].n++; if (!c.pass) faults[c.id].fail++; }
  }
  const faultList = Object.entries(faults).map(([id, v]) => ({ id, ...v, rate: pct(v.fail, v.n) })).sort((a, b) => b.rate - a.rate || b.fail - a.fail);
  return { n: swings.length, practice: (s.swings || []).length - swings.length, byClub, results, faults: faultList };
}
export function stockDistances(sessions) {
  const by = {};
  for (const s of sessions || []) for (const w of s.swings || []) {
    const d = resOf(w)?.distance; if (!d || w.practice || !w.clubId || w.block === "warmup" || w.block === "focus") continue;
    (by[w.clubId] ??= []).push({ d, t: w.t || s.start, bad: badWeight(resOf(w)) >= 1 });
  }
  const out = {};
  for (const [id, list] of Object.entries(by)) {
    const good = list.filter((x) => !x.bad).slice(-30).map((x) => x.d).sort((a, b) => a - b);
    const all = list.slice(-30).map((x) => x.d).sort((a, b) => a - b);
    const use = good.length >= 3 ? good : all, med = use[Math.floor(use.length / 2)];
    out[id] = { median: med, n: list.length, min: use[0], max: use[use.length - 1] };
  }
  return out;
}
export function weeklySummary(sessions, now = Date.now()) {
  const wk = 7 * 864e5, cur = (sessions || []).filter((s) => s.start > now - wk), prev = (sessions || []).filter((s) => s.start <= now - wk && s.start > now - 2 * wk);
  const agg = (list) => {
    const sw = list.flatMap((s) => (s.swings || []).filter(counted)), logged = sw.filter((w) => resOf(w)?.result);
    const faults = {};
    for (const w of sw) for (const c of w.checks || []) { if (ruleById(c.id)?.conf !== "high") continue; faults[c.id] ??= [0, 0]; faults[c.id][1]++; if (!c.pass) faults[c.id][0]++; }
    const top = Object.entries(faults).filter(([, v]) => v[1] >= 5).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1])[0];
    return { sessions: list.length, balls: sw.length, bad: logged.length ? Math.min(1, logged.reduce((a, w) => a + badWeight(resOf(w)), 0) / logged.length) : null, topFault: top ? { id: top[0], rate: top[1][0] / top[1][1] } : null };
  };
  return { cur: agg(cur), prev: agg(prev) };
}

// ---------------- Rounds on the course ----------------
export const TEE = { fairway: "Fairway", left: "Left", right: "Right", obl: "OB left", obr: "OB right", wl: "Water left", wr: "Water right" };
export const APPROACH = { green: "Green", short: "Short", long: "Long", left: "Left", right: "Right", bunker: "Bunker" };
export function roundStats(rounds) {
  const rs = rounds || [], holes = rs.flatMap((r) => r.holes || []).filter((h) => h.score);
  if (!holes.length) return null;
  const teeH = holes.filter((h) => h.par >= 4 && h.tee), n = (f) => teeH.filter(f).length;
  const scores = rs.filter((r) => (r.holes || []).every((h) => h.score)).map((r) => { const sc = r.holes.reduce((a, h) => a + h.score, 0); return r.holes.length === 9 ? sc * 2 : sc; });
  const putts = holes.filter((h) => h.putts != null);
  return {
    rounds: rs.length, avg18: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, last: scores.at(-1) ?? null,
    fairways: teeH.length ? n((h) => h.tee === "fairway") / teeH.length : null,
    missLeft: teeH.length ? n((h) => ["left", "obl", "wl"].includes(h.tee)) / teeH.length : null,
    missRight: teeH.length ? n((h) => ["right", "obr", "wr"].includes(h.tee)) / teeH.length : null,
    obLeft: n((h) => h.tee === "obl" || h.tee === "wl"), obRight: n((h) => h.tee === "obr" || h.tee === "wr"),
    greens: holes.filter((h) => h.approach).length ? holes.filter((h) => h.approach === "green").length / holes.filter((h) => h.approach).length : null,
    puttsPerHole: putts.length ? putts.reduce((a, h) => a + h.putts, 0) / putts.length : null,
    threePutts: putts.filter((h) => h.putts >= 3).length, penalties: holes.reduce((a, h) => a + (h.pen || 0), 0),
  };
}

// ---------------- Plans ----------------
// Weights: practice data first (worst club gets more balls), then your rounds (tee shot misses add driver
// balls, many putts add putting), then your priority order (driver above long irons and short game).
function weights(cats, sessions, rounds) {
  const stats = catStats(sessions), rst = roundStats(rounds), w = {};
  for (const c of cats) { const s = stats[c]?.score; w[c] = CATS[c].base * (s == null ? 1 : 0.6 + 1.2 * s); }
  if (rst && w.driver != null && rst.fairways != null) w.driver *= 1 + 0.6 * (1 - rst.fairways);
  if (rst && w.putt != null && rst.puttsPerHole != null && rst.puttsPerHole > 2) w.putt *= 1 + (rst.puttsPerHole - 2);
  return { w, stats };
}
const split = (n, parts) => Array.from({ length: parts }, (_, i) => Math.floor(n / parts) + (i < n % parts ? 1 : 0));
export function buildPlan({ venue = "pw", total, minutes, bag, sessions = [], rounds = [], calib = false } = {}) {
  const V = VENUES[venue] || VENUES.pw;
  const B = new Set(bag && bag.length ? bag : BAG.map((c) => c.id));
  const pick = (cat) => CATS[cat].pick.find((id) => B.has(id)) || null;
  minutes = Math.max(15, Math.min(180, Math.round(minutes || V.minutes || 60)));
  total = V.mode === "time" ? Math.round(minutes * V.rate) : Math.max(10, Math.min(300, Math.round(total || V.balls || 100)));
  const cats = RANGE_ORDER.filter((c) => pick(c));
  const { w, stats } = weights([...cats, ...SHORT_ORDER], sessions, rounds);
  const warm = Math.max(4, Math.round(total * 0.08));
  const randomN = calib || !cats.length ? 0 : Math.max(0, Math.round(total * 0.1));
  const rest = total - warm - randomN;
  const sumW = cats.reduce((a, c) => a + w[c], 0) || 1, balls = {}; let used = 0;
  for (const c of cats) { balls[c] = Math.max(calib ? 4 : 3, Math.round((rest * w[c]) / sumW)); used += balls[c]; }
  const biggest = cats.slice().sort((a, b) => balls[b] - balls[a])[0]; if (biggest) balls[biggest] += rest - used;
  const scored = cats.filter((c) => stats[c]?.score != null);
  const worst = !calib && scored.length ? scored.sort((a, b) => stats[b].score - stats[a].score)[0] : null;
  const why = (c) => {
    if (calib) return "Calibration: swing normally, no corrections. Say how each ball flew" + (V.tracer ? " and the distance." : ".");
    const s = stats[c]; if (!s || s.score == null) return CATS[c].short || "";
    const parts = [];
    if (s.badRate != null && s.logged >= 5) parts.push(`${Math.round(100 * Math.min(1, s.badRate))}% bad shots`);
    if (s.faultRate != null) parts.push(`${Math.round(100 * s.faultRate)}% swing faults`);
    return (c === worst ? "Your weakest lately: " : "Lately: ") + parts.join(", ") + ".";
  };
  // The goal of each block. Full swings at 75 to 80% also show the usual carry once 5 distances are logged.
  const sd = stockDistances(sessions);
  const goal = (cat, phase, clubId, part = 0) => {
    const k = goalKey(cat, phase, part), g = { key: k, ...GOALS[k] }, d = cat !== "random" && sd[clubId];
    if (d && d.n >= 5 && g.swing === "full" && g.effort >= 75) g.carry = Math.round(d.median / 5) * 5;
    return g;
  };
  const blocks = [];
  // Normal sessions start on the other camera side than last time, so every club gets both over time.
  let view = calib || (sessions.length % 2 === 0) ? "dtl" : "face";
  const flip = () => (view = view === "dtl" ? "face" : "dtl");
  const add = (cat, clubId, n, phase, extra = {}) => {
    if (!clubId || n <= 0) return;
    blocks.push({ cat, clubId, name: cat === "random" ? "Random clubs" : clubById(clubId).name, balls: n, view, phase, why: phase === "warmup" ? CATS.warmup.short : phase === "retest" ? "Retest your weakest club now that you are warm." : phase === "random" ? CATS.random.short : why(cat), goal: goal(cat, phase, clubId), ...extra });
  };
  add("warmup", pick("warmup"), warm, "warmup"); // camera behind for the warm up: it checks your setup
  const order = worst ? [worst, ...cats.filter((c) => c !== worst)] : cats;
  for (const c of order) {
    let n = balls[c];
    if (c === worst) { const first = Math.ceil(n * 0.6); balls[c] = n - first; n = first; }
    // Calibration: both camera sides per club, moving the camera once per club. Normal: one side per club.
    const parts = calib ? 2 : 1;
    split(n, parts).forEach((k, i) => { if (calib ? i > 0 : i === 0 && blocks.length) flip(); add(c, pick(c), k, c === worst ? "focus" : calib ? "calib" : "main"); });
  }
  if (worst && balls[worst] > 0) { flip(); add(worst, pick(worst), balls[worst], "retest"); }
  if (randomN) {
    const pool = cats.map(pick).filter(Boolean);
    const seq = Array.from({ length: randomN }, (_, i) => pool[(i * 3 + 1) % pool.length]);
    flip(); add("random", seq[0], randomN, "random", { sequence: seq });
  }
  // Short game at Pittwater: own balls on the greens, not from the bucket
  const short = [];
  for (const c of V.short || []) {
    const id = pick(c); if (!id) continue;
    if (calib && c === "bunker") continue; // the camera cannot see a ball in sand yet
    const n = calib ? 10 : Math.max(5, Math.round(CATS[c].base * (w[c] / CATS[c].base)));
    const parts = calib || c !== "bunker" ? 2 : 1;
    split(n, parts).forEach((k, i) => { const v = i === 0 ? (c === "putt" ? "face" : "dtl") : (c === "putt" ? "dtl" : "face"); short.push({ cat: c, clubId: id, name: CATS[c].name, balls: k, view: v, phase: calib ? "calib" : "short", short: true, why: calib ? "Calibration, no corrections." : CATS[c].short, goal: goal(c, calib ? "calib" : "short", id, i) }); });
  }
  const all = [...blocks, ...short];
  if (V.mode === "time") all.forEach((b) => { if (!b.short) b.minutes = Math.max(1, Math.round(b.balls / V.rate)); });
  return { venue: V.id, mode: V.mode, total, minutes: V.mode === "time" ? minutes : null, blocks: all, stats, worst, calib, adapted: scored.length > 0 };
}
export const calibrationPlan = (opts) => buildPlan({ ...opts, calib: true });

// ---------------- Coach notes and reports ----------------
export function coachNotes(s, sessions, cs) {
  const st = sessionStats(s), N = [];
  if (!st.n) return ["No swings were recorded in this session."];
  const clubs = Object.keys(st.byClub).length;
  if (s.calib) N.push(`Calibration: ${st.n} swings with ${clubs} clubs and no corrections. Export the calibration file and send it to Claude so the rules can be tuned to your body and your camera.`);
  else N.push(`${st.n} swings with ${clubs} club${clubs > 1 ? "s" : ""}${s.plan ? `, following a ${s.plan.total} ball plan` : ""}.`);
  const per = {};
  for (const w of (s.swings || []).filter(counted)) {
    const k = w.clubId ? clubById(w.clubId).name : w.club, r = resOf(w), o = (per[k] ??= { logged: 0, straight: 0, bad: 0, res: {} });
    if (r?.result) { o.logged++; o.res[r.result] = (o.res[r.result] || 0) + 1; if (r.result === "straight") o.straight++; if (badWeight(r) >= 1) o.bad++; }
  }
  const ranked = Object.entries(per).filter(([, o]) => o.logged >= 3).sort((a, b) => a[1].bad / a[1].logged - b[1].bad / b[1].logged);
  if (ranked.length >= 2) {
    const [bn, b] = ranked[0], [wn, w] = ranked[ranked.length - 1];
    const top = Object.entries(w.res).filter(([r]) => r !== "straight").sort((a, b) => b[1] - a[1])[0]?.[0];
    N.push(`Best club today: ${bn.toLowerCase()}, ${b.straight} of ${b.logged} straight. Weakest: ${wn.toLowerCase()}, ${w.bad} of ${w.logged} clearly off${top ? `, mostly ${top}` : ""}.`);
    if (top && RESULT_TIPS[top]) N.push(RESULT_TIPS[top]);
  } else if (!Object.values(st.results).length) N.push("No ball flights were logged. Say how each ball flew next time: it is the only way the app knows the result.");
  const tf = st.faults.find((f) => ruleById(f.id)?.conf === "high" && f.fail > 0);
  if (tf) { const r = ruleById(tf.id); N.push(`The fault that showed up most: ${r.title.toLowerCase()}, in ${tf.fail} of ${tf.n} swings.`); }
  const tempos = (s.swings || []).filter((w) => !w.practice && w.m?.tempoRatio).map((w) => w.m.tempoRatio).sort((a, b) => a - b);
  if (tempos.length >= 5) N.push(`Your tempo: backswing ${tempos[Math.floor(tempos.length / 2)].toFixed(1)} times as long as the downswing (middle value).`);
  if (cs?.focus && !s.calib) { const l5 = cs.focus.hist.slice(-5); N.push(`Your focus now: ${ruleById(cs.focus.id).title.toLowerCase()}, ${l5.filter(Boolean).length} of your last ${l5.length} right.`); }
  const d = Object.keys(s.disputes || {});
  if (d.length) N.push(`You said ${d.map((id) => ruleById(id)?.title.toLowerCase()).join(" and ")} was wrong. Claude will check that rule with this report.`);
  return N;
}
export function calibSummary(s) {
  const sw = (s.swings || []).filter((w) => w.calib);
  const real = sw.filter((w) => !w.practice);
  const ballSeen = sw.filter((w) => w.ball?.before).length, hit = sw.filter((w) => w.ball?.hit === true).length, still = sw.filter((w) => w.ball?.hit === false).length;
  const q = sw.map((w) => w.q || {}), avg = (k) => { const v = q.map((x) => x[k]).filter((x) => typeof x === "number"); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const groups = {};
  for (const w of real) (groups[`${w.clubId}|${w.view}`] ??= []).push(w);
  const stat = (vals) => { const v = vals.filter((x) => typeof x === "number" && isFinite(x)); if (!v.length) return null; const mean = v.reduce((a, b) => a + b, 0) / v.length; return { n: v.length, mean: r3(mean), sd: r3(Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)), min: r3(Math.min(...v)), max: r3(Math.max(...v)) }; };
  const out = Object.entries(groups).map(([k, ws]) => {
    const [clubId, view] = k.split("|"), keys = [...new Set(ws.flatMap((w) => Object.keys(w.m || {})))], metrics = {};
    for (const key of keys) { const st = stat(ws.map((w) => w.m?.[key])); if (st) metrics[key] = st; }
    return { clubId, view, n: ws.length, metrics };
  });
  return { mic: s.calib?.mic ?? null, heard: s.calib?.heard ?? null, swings: real.length, practice: sw.length - real.length, fps: avg("fps"), otherPeople: q.filter((x) => x.poses > 1).length,
    logged: real.filter((w) => resOf(w)?.result).length, distances: real.filter((w) => resOf(w)?.distance).length, ballSeen, hit, still, groups: out };
}
export function reportText(sessions, sid, coachState) {
  const s = sessions.find((x) => x.id === sid) || sessions[sessions.length - 1];
  if (!s) return "No sessions yet.";
  const st = sessionStats(s), L = [];
  L.push(s.calib ? "SCRATCH GOLFER DREAMS: CALIBRATION REPORT" : "SCRATCH GOLFER DREAMS: SESSION REPORT");
  L.push(`Date: ${new Date(s.start).toLocaleString()}  Venue: ${VENUES[s.venue]?.name || "?"}  Swings: ${st.n}  Practice swings: ${st.practice}`);
  if (s.plan) L.push(`Plan: ${s.plan.total} balls${s.plan.minutes ? ` in ${s.plan.minutes} min` : ""}, ${s.plan.blocks.length} blocks, reached block ${Math.min((s.blockIdx ?? 0) + 1, s.plan.blocks.length)}`);
  L.push("Clubs: " + Object.entries(st.byClub).map(([c, n]) => `${c} ${n}`).join(", "));
  const logged = Object.values(st.results).reduce((a, b) => a + b, 0);
  if (logged) L.push(`Ball flight (${logged} logged): ` + Object.entries(st.results).map(([r, n]) => `${r} ${n}`).join(", "));
  L.push("", "Checks (failed / checked):");
  for (const f of st.faults) { const r = ruleById(f.id); L.push(`  ${r ? r.title : f.id}${r?.conf === "low" ? " (weak)" : ""}${r?.kind === "setup" ? " [setup]" : ""}: ${f.fail}/${f.n} (${f.rate}%)`); }
  if (s.calib) {
    const c = calibSummary(s);
    L.push("", "Calibration checks:");
    L.push(`  Voice test: ${c.mic === "ok" ? `worked (heard "${c.heard}")` : c.mic === "no" ? "nothing heard" : "not run"}`);
    L.push(`  Swings: ${c.swings} real, ${c.practice} practice. Flights logged: ${c.logged}. Distances: ${c.distances}`);
    L.push(`  Ball seen at setup: ${c.ballSeen}, ball gone after swing: ${c.hit}, ball still there: ${c.still}`);
    L.push(`  Camera: ${c.fps ?? "?"} fps, swings with another person in view: ${c.otherPeople}`);
  }
  if (s.disputes && Object.keys(s.disputes).length) L.push("", "Corrections you said were wrong: " + Object.entries(s.disputes).map(([id, n]) => `${ruleById(id)?.title || id} x${n}`).join(", "));
  const unparsed = (s.voiceLog || []).filter((v) => !v.parsed).slice(-40);
  if (unparsed.length) L.push("", "Words the app did not understand: " + unparsed.map((v) => `"${v.text}"`).join(", "));
  const tips = Object.entries(st.results).filter(([r, n]) => RESULT_TIPS[r] && n >= 3).map(([r]) => RESULT_TIPS[r]);
  if (tips.length) { L.push("", "About your ball flight:"); tips.forEach((t) => L.push("  " + t)); }
  if (coachState?.focus) L.push("", `Current focus: ${ruleById(coachState.focus.id)?.title}`);
  L.push("", "Swings: " + JSON.stringify((s.swings || []).map((w) => ({ c: w.clubId, b: w.block, v: w.view, p: w.practice ? (w.practice === "auto" ? "auto" : 1) : 0, r: resOf(w) ? resultLabel(resOf(w)) : null, said: (w.voice || []).map((x) => x.text), ball: w.ball ? { hit: w.ball.hit, seen: !!w.ball.before } : null, pre: w.setup?.logged?.map((x) => x.id), nr: w.setup?.notReady ? 1 : 0, f: (w.checks || []).filter((c) => !c.pass).map((c) => c.id), m: w.m, q: w.q }))));
  return L.join("\n");
}
