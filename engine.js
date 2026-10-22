// Pure logic: pose features, swing detection, metrics, focus selection, reports.
// No DOM here, so it can be tested in Node.
import { RULES, RESULT_TIPS, CLUBS, VIDEOS } from "./rules.js";

const I = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
  lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHe: 29, rHe: 30, lTo: 31, rTo: 32 };
const REQUIRED = [I.nose, I.lSh, I.rSh, I.lHip, I.rHip, I.lAn, I.rAn, I.lWr, I.rWr];

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r) => (r * 180) / Math.PI;
function angle(a, b, c) { // angle at b
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!d) return null;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d))));
}

// lm: 33 landmarks with normalized x,y and visibility. W,H: video size in pixels.
export function features(lm, W, H) {
  if (!lm || lm.length < 33) return { ok: false, why: "nobody" };
  const p = lm.map((l) => ({ x: l.x * W, y: l.y * H, v: l.visibility ?? 1, nx: l.x, ny: l.y }));
  const missing = [];
  for (const i of REQUIRED) {
    const q = p[i];
    if (q.v < 0.5 || q.nx < 0.01 || q.nx > 0.99 || q.ny < 0.01 || q.ny > 0.99) missing.push(i);
  }
  const sh = mid(p[I.lSh], p[I.rSh]), hp = mid(p[I.lHip], p[I.rHip]);
  const T = dist(sh, hp) || 1;
  const f = {
    ok: missing.length === 0, missing,
    p, sh, hp, T,
    hands: mid(p[I.lWr], p[I.rWr]),
    nose: p[I.nose],
    span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    lAn: p[I.lAn], rAn: p[I.rAn],
    ankMid: mid(p[I.lAn], p[I.rAn]),
    heelMid: mid(p[I.lHe], p[I.rHe]),
    toeMid: mid(p[I.lTo], p[I.rTo]),
    bodyH: Math.max(...[I.lAn, I.rAn].map((i) => p[i].y)) - p[I.nose].y,
    H,
  };
  return f;
}

// Problems with the camera picture, as short spoken hints.
export function frameHint(f, view) {
  if (!f || !f.p) return "I can't see you. Step into the picture.";
  const m = new Set(f.missing);
  if (m.has(I.lAn) || m.has(I.rAn)) return "I can't see your feet. Move the phone further back or point it lower.";
  if (m.has(I.nose)) return "I can't see your head. Move the phone further back or point it higher.";
  if (m.size) return "Part of your body is out of the picture. Move the phone back a little.";
  const h = f.bodyH / f.H;
  if (h < 0.35) return "You are too far away. Move the phone a bit closer.";
  if (view === "face" && f.span < 0.45 * f.T) return "This looks like a down the line view. Move the phone in front of you, or switch the view.";
  if (view === "dtl" && f.span > 0.75 * f.T) return "This looks like a face on view. Move the phone behind you, or switch the view.";
  return null;
}

// ---------- Swing detector ----------
export class SwingDetector {
  constructor() { this.club = "iron"; this.reset(); }
  reset() { this.state = "idle"; this.hist = []; this.frames = []; this.addr = null; this.until = 0; }

  push(t, f) {
    this.hist.push({ t, f });
    while (this.hist.length && t - this.hist[0].t > 2000) this.hist.shift();

    if (this.state === "cooldown") {
      if (t > this.until) this.state = "idle";
      return null;
    }
    if (this.state === "swing") return this._swing(t, f);

    if (!f.ok) {
      if (this.state === "address") { this.state = "idle"; return { type: "lost" }; }
      return null;
    }
    const still = this._stillWindow(t, f.T);
    const low = f.hands.y > f.sh.y + 0.7 * f.T;
    if (this.state === "idle") {
      if (still && low) { this.state = "address"; this.addr = still; return { type: "ready" }; }
      return null;
    }
    // address
    if (still && low) this.addr = still;
    const rise = this.addr.hands.y - f.hands.y;
    const need = (this.club === "wedge" ? 0.3 : 0.55) * this.addr.T;
    if (rise > need) {
      this.state = "swing";
      this.start = t;
      const t0 = this.addr.t0;
      this.frames = this.hist.filter((h) => h.t >= t0 && h.f.ok);
      this.top = null; this.down = false; this.imp = null;
      return { type: "started" };
    }
    if (Math.abs(f.hands.x - this.addr.hands.x) > 1.2 * this.addr.T) { this.state = "idle"; return { type: "lost" }; }
    return null;
  }

  _stillWindow(t, T) {
    const w = this.hist.filter((h) => t - h.t <= 500 && h.f.ok);
    if (w.length < 4 || t - w[0].t < 350) return null;
    const cx = w.reduce((s, h) => s + h.f.hands.x, 0) / w.length;
    const cy = w.reduce((s, h) => s + h.f.hands.y, 0) / w.length;
    for (const h of w) if (Math.hypot(h.f.hands.x - cx, h.f.hands.y - cy) > 0.06 * T) return null;
    return { t0: w[0].t, t1: w[w.length - 1].t, hands: { x: cx, y: cy }, T: w[w.length - 1].f.T };
  }

  _swing(t, f) {
    if (f.ok) this.frames.push({ t, f });
    const A = this.addr;
    if (t - this.start > 3500) { this._cool(t, 1000); return { type: "discard", why: "too slow" }; }
    if (!f.ok) return null;
    if (!this.top || f.hands.y < this.top.f.hands.y) { if (!this.down) this.top = { t, f }; }
    if (!this.down && this.top && f.hands.y >= A.hands.y - 0.25 * A.T && t > this.top.t) this.down = true;
    if (this.down) {
      const d = dist(f.hands, A.hands);
      if (!this.imp || (d < this.imp.d && t - this.imp.t < 250)) this.imp = { t, d };
      if (t - this.imp.t > 900) {
        const out = { type: "swing", frames: this.frames.slice(), addr: A, topT: this.top.t, impT: this.imp.t, club: this.club };
        this._cool(t, 1500);
        return out;
      }
    }
    return null;
  }
  _cool(t, ms) { this.state = "cooldown"; this.until = t + ms; this.frames = []; }
}

// ---------- Metrics ----------
function avgFeat(list) {
  if (!list.length) return null;
  const n = list.length, acc = (fn) => list.reduce((s, x) => s + fn(x), 0) / n;
  const P = (i) => ({ x: acc((x) => x.p[i].x), y: acc((x) => x.p[i].y) });
  const p = []; for (let i = 0; i < 33; i++) p.push(P(i));
  return {
    p, sh: mid(p[I.lSh], p[I.rSh]), hp: mid(p[I.lHip], p[I.rHip]), T: acc((x) => x.T),
    hands: mid(p[I.lWr], p[I.rWr]), nose: p[I.nose], span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    lAn: p[I.lAn], rAn: p[I.rAn], ankMid: mid(p[I.lAn], p[I.rAn]),
    heelMid: mid(p[I.lHe], p[I.rHe]), toeMid: mid(p[I.lTo], p[I.rTo]),
  };
}
const near = (frames, t, w) => frames.filter((x) => Math.abs(x.t - t) <= w).map((x) => x.f);

export function analyze(sw, view) {
  const fr = sw.frames;
  const addr = avgFeat(fr.filter((x) => x.t >= sw.addr.t0 && x.t <= sw.addr.t1 + 60).map((x) => x.f))
    || avgFeat(fr.slice(0, 3).map((x) => x.f));
  const top = avgFeat(near(fr, sw.topT, 40));
  const imp = avgFeat(near(fr, sw.impT, 40));
  const fin = avgFeat(fr.filter((x) => x.t >= sw.impT + 600).map((x) => x.f)) || avgFeat(fr.slice(-2).map((x) => x.f));
  const T = addr.T;
  const m = {};

  // Head height change addr -> impact (positive = stood up). Works in both views.
  m.headRise = (addr.nose.y - imp.nose.y) / T;

  if (view === "face") {
    // Right handed golfer: left shoulder is toward the target. dir = +1 if target is to image right.
    const dir = Math.sign(addr.p[I.lSh].x - addr.p[I.rSh].x) || 1;
    const lead = { sh: addr.p[I.lSh], an: addr.lAn }, trail = { sh: addr.p[I.rSh], an: addr.rAn };
    const stanceW = Math.abs(addr.lAn.x - addr.rAn.x) || 1;
    m.stanceRatio = stanceW / (addr.span || 1);
    // Spine tilt away from target (positive = upper body behind the ball)
    m.tiltDeg = deg(Math.atan2((addr.hp.x - addr.sh.x) * dir, addr.hp.y - addr.sh.y));
    m.leadShHigher = (trail.sh.y - lead.sh.y) / T;
    m.sway = ((addr.hp.x - top.hp.x) * dir) / stanceW;
    m.shoulderTurn = top.span / (addr.span || 1);
    m.upperAhead = ((imp.sh.x - imp.hp.x) * dir) / T;
    m.transfer = ((fin.hp.x - trail.an.x) * dir) / (((lead.an.x - trail.an.x) * dir) || 1);
    // Weight split proxy: middle of chest and pelvis between the feet (0 = right foot, 1 = left foot)
    const feetSpan = ((lead.an.x - trail.an.x) * dir) || 1;
    const centre = (f) => (f.sh.x + f.hp.x) / 2;
    m.addrWeight = ((centre(addr) - trail.an.x) * dir) / feetSpan;
    m.impWeight = ((centre(imp) - trail.an.x) * dir) / feetSpan;
    m.feetMoved = Math.max(dist(fin.lAn, addr.lAn), dist(fin.rAn, addr.rAn)) / stanceW;
    // Hand speed: speed at impact vs peak
    let peak = 0, peakT = 0; const sp = [];
    for (let i = 1; i < fr.length; i++) {
      const dt = (fr[i].t - fr[i - 1].t) / 1000; if (dt <= 0) continue;
      const v = dist(fr[i].f.hands, fr[i - 1].f.hands) / T / dt;
      sp.push({ t: fr[i].t, v });
      if (fr[i].t > sw.topT && fr[i].t < sw.impT + 300 && v > peak) { peak = v; peakT = fr[i].t; }
    }
    const atImp = sp.filter((s) => Math.abs(s.t - sw.impT) <= 50).reduce((a, s) => Math.max(a, s.v), 0);
    m.speedRatio = peak > 0 ? Math.min(1.5, atImp / peak) : null;
  } else {
    const facing = Math.sign(addr.toeMid.x - addr.heelMid.x) || 1;
    m.hingeDeg = deg(Math.atan2(Math.abs(addr.sh.x - addr.hp.x), addr.hp.y - addr.sh.y));
    const near1 = facing > 0 ? "r" : "l"; // the side closer to the camera
    const k = (s) => s === "l" ? angle(addr.p[I.lHip], addr.p[I.lKn], addr.p[I.lAn]) : angle(addr.p[I.rHip], addr.p[I.rKn], addr.p[I.rAn]);
    const ka = [k("l"), k("r")].filter((x) => x != null);
    m.kneeDeg = ka.length ? ka.reduce((a, b) => a + b, 0) / ka.length : null;
    m.shoulderOverFeet = ((addr.sh.x - addr.ankMid.x) * facing) / T;
    const hingeImp = deg(Math.atan2(Math.abs(imp.sh.x - imp.hp.x), imp.hp.y - imp.sh.y));
    m.hingeLoss = m.hingeDeg - hingeImp;
    m.hipToBall = ((imp.hp.x - addr.hp.x) * facing) / T;
    void near1;
  }
  for (const k of Object.keys(m)) if (typeof m[k] === "number") m[k] = Math.round(m[k] * 1000) / 1000;
  return m;
}

export function runChecks(m, club, view) {
  const out = [];
  for (const r of RULES) {
    if (!r.auto || !r.clubs.includes(club)) continue;
    if (r.view !== "both" && r.view !== view) continue;
    const pass = r.check(m, club);
    if (pass === null || pass === undefined) continue;
    out.push({ id: r.id, pass });
  }
  return out;
}

// ---------- Focus and feedback ----------
export const ruleById = (id) => RULES.find((r) => r.id === id);
const text = (v, m, club) => (typeof v === "function" ? v(m, club) : v);

// state: { focus: {club: {id, hist: []}}, hist: {club: {ruleId: [bool...]}}, mastered: {club: [ids]} }
export function emptyCoachState() { return { focus: {}, hist: {}, mastered: {} }; }

export function coach(state, checks, m, club, view, mode, name = "Mariano") {
  state.hist[club] ??= {}; state.mastered[club] ??= [];
  const H = state.hist[club];
  for (const c of checks) { (H[c.id] ??= []).push(c.pass); if (H[c.id].length > 10) H[c.id].shift(); }
  const failing = checks.filter((c) => !c.pass).map((c) => ruleById(c.id)).sort((a, b) => a.priority - b.priority);
  const lines = []; const items = []; let event = null;

  const pickFocus = (exclude) => {
    // failing now, or failing in 3 of the last 5, highest priority first
    const cands = RULES.filter((r) => r.auto && r.clubs.includes(club) && r.id !== exclude && (
      failing.some((f) => f.id === r.id) ||
      ((H[r.id] || []).slice(-5).filter((x) => !x).length >= 3)));
    cands.sort((a, b) => a.priority - b.priority);
    return cands[0] || null;
  };

  let F = state.focus[club];
  if (!F) { const r = pickFocus(); if (r) F = state.focus[club] = { id: r.id, hist: [] }; }

  if (F) {
    const fr = ruleById(F.id);
    const fc = checks.find((c) => c.id === F.id);
    if (fc) {
      F.hist.push(fc.pass); if (F.hist.length > 10) F.hist.shift();
      const last5 = F.hist.slice(-5), good = last5.filter(Boolean).length;
      items.push({ id: F.id, pass: fc.pass, focus: true });
      if (fc.pass) lines.push(`${name}, ${text(fr.good, m, club)} That is ${good} of your last ${last5.length}.`);
      else lines.push(`${name}, ${text(fr.bad, m, club)}`);
      if (last5.length >= 5 && good >= 4) {
        state.mastered[club].push(F.id);
        const next = pickFocus(F.id);
        event = { type: "mastered", id: F.id, next: next?.id || null };
        lines.push(`You fixed it: ${fr.title.toLowerCase()}.` + (next ? ` Next focus: ${next.title.toLowerCase()}.` : " Keep swinging like that."));
        state.focus[club] = next ? { id: next.id, hist: [] } : null;
      }
    } else {
      // focus not visible from this camera angle
      const other = failing[0];
      if (other) { items.push({ id: other.id, pass: false }); lines.push(`${name}, ${text(other.bad, m, club)}`); }
      else lines.push(`${name}, nothing big to fix from this angle.`);
      const v = fr.view === "dtl" ? "down the line, behind you" : "face on, in front of you";
      lines.push(`To check your main focus, ${fr.title.toLowerCase()}, put the camera ${v}.`);
      event = { type: "camera", view: fr.view };
    }
  } else {
    lines.push(`${name}, good swing. Nothing to fix from this angle.`);
  }

  if (mode === 3) {
    for (const r of failing) {
      if (items.length >= 3) break;
      if (items.some((i) => i.id === r.id)) continue;
      items.push({ id: r.id, pass: false });
      lines.push(`Also, ${text(r.bad, m, club)}`);
    }
  }
  return { speech: lines.join(" "), items, event, focusId: state.focus[club]?.id || null };
}

// ---------- Reports ----------
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function sessionStats(s) {
  const swings = s.swings || [];
  const byClub = {}, results = {}, faults = {};
  for (const w of swings) {
    byClub[w.club] = (byClub[w.club] || 0) + 1;
    if (w.result) results[w.result] = (results[w.result] || 0) + 1;
    for (const c of w.checks || []) {
      const k = c.id; faults[k] ??= { fail: 0, n: 0 };
      faults[k].n++; if (!c.pass) faults[k].fail++;
    }
  }
  const faultList = Object.entries(faults).map(([id, v]) => ({ id, ...v, rate: pct(v.fail, v.n) }))
    .sort((a, b) => b.rate - a.rate || b.fail - a.fail);
  return { n: swings.length, byClub, results, faults: faultList };
}

export function reportText(sessions, sid) {
  const s = sessions.find((x) => x.id === sid) || sessions[sessions.length - 1];
  if (!s) return "No sessions yet.";
  const st = sessionStats(s);
  const L = [];
  L.push(`GOLF COACH SESSION REPORT`);
  L.push(`Date: ${new Date(s.start).toLocaleString()}  Swings: ${st.n}`);
  L.push(`Clubs: ` + Object.entries(st.byClub).map(([c, n]) => `${CLUBS[c] || c} ${n}`).join(", "));
  const logged = Object.values(st.results).reduce((a, b) => a + b, 0);
  if (logged) L.push(`Ball flight (${logged} logged): ` + Object.entries(st.results).map(([r, n]) => `${r} ${n}`).join(", "));
  L.push(``);
  L.push(`Faults this session (failed / checked):`);
  for (const f of st.faults) { const r = ruleById(f.id); L.push(`  ${r ? r.title : f.id}: ${f.fail}/${f.n} (${f.rate}%)`); }
  // Trend vs previous sessions
  const prev = sessions.filter((x) => x.start < s.start).slice(-5);
  if (prev.length) {
    L.push(``);
    L.push(`Trend (fail rate, older to newer, this session last):`);
    for (const f of st.faults.slice(0, 5)) {
      const seq = [...prev, s].map((x) => { const q = sessionStats(x).faults.find((y) => y.id === f.id); return q ? q.rate + "%" : "-"; });
      const r = ruleById(f.id); L.push(`  ${r ? r.title : f.id}: ${seq.join(" > ")}`);
    }
  }
  const tips = Object.entries(st.results).filter(([r, n]) => RESULT_TIPS[r] && n >= 3).map(([r]) => RESULT_TIPS[r]);
  if (tips.length) { L.push(``); L.push(`From your playlist, about your ball flight:`); tips.forEach((t) => L.push(`  ${t}`)); }
  L.push(``);
  L.push(`Raw swings: ` + JSON.stringify((s.swings || []).map((w) => ({ c: w.club, v: w.view, r: w.result || null, f: (w.checks || []).filter((c) => !c.pass).map((c) => c.id), m: w.m }))));
  return L.join("\n");
}

export { VIDEOS };
