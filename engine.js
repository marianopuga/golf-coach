// Pure logic: pose features, golfer lock, swing detection, metrics, coaching, voice commands,
// session planning and reports. No DOM here, so everything can be tested in Node.
import { RULES, RESULT_TIPS, BAD_RESULTS, CLUBS, BAG, CATS, CAT_ORDER, clubById } from "./rules.js?v=7";

const I = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
  lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHe: 29, rHe: 30, lTo: 31, rTo: 32 };
const FACE_REQ = [I.nose, I.lSh, I.rSh, I.lHip, I.rHip, I.lAn, I.rAn, I.lWr, I.rWr];
// Down the line: the far side of the body is hidden, so one of each pair is enough.
const DTL_REQ = [[I.nose], [I.lSh, I.rSh], [I.lHip, I.rHip], [I.lAn, I.rAn], [I.lWr, I.rWr]];

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r) => (r * 180) / Math.PI;
function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!d) return null;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d))));
}
const seen = (q) => q.v >= 0.5 && q.nx > 0.01 && q.nx < 0.99 && q.ny > 0.01 && q.ny < 0.99;

// lm: 33 landmarks, normalized x,y + visibility. W,H: video size in pixels.
export function features(lm, W, H, view = "face") {
  if (!lm || lm.length < 33) return { ok: false, why: "nobody", missing: [] };
  const p = lm.map((l) => ({ x: l.x * W, y: l.y * H, v: l.visibility ?? 1, nx: l.x, ny: l.y }));
  const missing = [];
  if (view === "dtl") { for (const g of DTL_REQ) if (!g.some((i) => seen(p[i]))) missing.push(g[0]); }
  else for (const i of FACE_REQ) if (!seen(p[i])) missing.push(i);
  const sh = mid(p[I.lSh], p[I.rSh]), hp = mid(p[I.lHip], p[I.rHip]);
  const T = dist(sh, hp) || 1;
  return {
    ok: missing.length === 0, missing, p, sh, hp, T,
    hands: mid(p[I.lWr], p[I.rWr]), nose: p[I.nose],
    span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    lAn: p[I.lAn], rAn: p[I.rAn], ankMid: mid(p[I.lAn], p[I.rAn]),
    heelMid: mid(p[I.lHe], p[I.rHe]), toeMid: mid(p[I.lTo], p[I.rTo]),
    bodyH: Math.max(p[I.lAn].y, p[I.rAn].y) - p[I.nose].y, H,
  };
}

export function frameHint(f, view) {
  if (!f || !f.p) return "I can't see you. Step into the picture.";
  const m = new Set(f.missing);
  if (m.has(I.lAn) || m.has(I.rAn)) return "I can't see your feet. Move the camera back or point it lower.";
  if (m.has(I.nose)) return "I can't see your head. Move the camera back or point it higher.";
  if (m.size) return "Part of your body is out of the picture. Move the camera back a little.";
  if (f.bodyH / f.H < 0.35) return "You are too far away. Move the camera a bit closer.";
  if (view === "face" && f.span < 0.45 * f.T) return "This looks like a view from behind. Put the camera in front of you.";
  if (view === "dtl" && f.span > 0.75 * f.T) return "This looks like a view from the front. Put the camera behind you.";
  return null;
}

// ---------- Golfer lock: ignore other people in the picture ----------
// poses: array of landmark arrays. lock: {x, y, size} in normalized units, or null.
export function pickGolfer(poses, lock) {
  const info = (poses || []).map((lm, idx) => {
    const hx = (lm[I.lHip].x + lm[I.rHip].x) / 2, hy = (lm[I.lHip].y + lm[I.rHip].y) / 2;
    const size = Math.max(lm[I.lAn].y, lm[I.rAn].y) - lm[I.nose].y;
    return { idx, x: hx, y: hy, size };
  });
  if (!info.length) return { idx: -1, lock };
  let best = null;
  if (lock) {
    for (const c of info) {
      const d = Math.hypot(c.x - lock.x, c.y - lock.y);
      const sizeOk = c.size > lock.size * 0.6 && c.size < lock.size * 1.6;
      if (d < 0.2 && sizeOk && (!best || d < best.d)) best = { ...c, d };
    }
    if (!best) return { idx: -1, lock };
  } else {
    // First lock: among the biggest bodies, the one closest to the middle of the picture.
    const maxSize = Math.max(...info.map((c) => c.size));
    for (const c of info.filter((c) => c.size >= 0.6 * maxSize)) {
      const d = Math.abs(c.x - 0.5);
      if (!best || d < best.d) best = { ...c, d };
    }
  }
  const k = lock ? 0.3 : 1; // smooth the lock so a fast swing does not drag it away
  const nl = lock ? { x: lock.x + (best.x - lock.x) * k, y: lock.y + (best.y - lock.y) * k, size: lock.size + (best.size - lock.size) * k } : { x: best.x, y: best.y, size: best.size };
  return { idx: best.idx, lock: nl };
}

// ---------- Swing detector ----------
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
    const low = f.hands.y > f.sh.y + 0.7 * f.T;
    if (this.state === "idle") {
      if (still && low) { this.state = "address"; this.addr = still; return { type: "ready" }; }
      return null;
    }
    if (still && low) this.addr = still;
    const rise = this.addr.hands.y - f.hands.y;
    if (rise > (this.club === "wedge" ? 0.3 : 0.55) * this.addr.T) {
      this.state = "swing"; this.start = t;
      this.frames = this.hist.filter((h) => h.t >= this.addr.t0 && h.f.ok);
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
    if (!this.down && (!this.top || f.hands.y < this.top.f.hands.y)) this.top = { t, f };
    if (!this.down && this.top && f.hands.y >= A.hands.y - 0.25 * A.T && t > this.top.t) this.down = true;
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

// ---------- Metrics ----------
function avgFeat(list) {
  if (!list.length) return null;
  const n = list.length, acc = (fn) => list.reduce((s, x) => s + fn(x), 0) / n;
  const p = []; for (let i = 0; i < 33; i++) p.push({ x: acc((x) => x.p[i].x), y: acc((x) => x.p[i].y) });
  return {
    p, sh: mid(p[I.lSh], p[I.rSh]), hp: mid(p[I.lHip], p[I.rHip]), T: acc((x) => x.T),
    hands: mid(p[I.lWr], p[I.rWr]), nose: p[I.nose], span: Math.abs(p[I.lSh].x - p[I.rSh].x),
    lAn: p[I.lAn], rAn: p[I.rAn], ankMid: mid(p[I.lAn], p[I.rAn]),
    heelMid: mid(p[I.lHe], p[I.rHe]), toeMid: mid(p[I.lTo], p[I.rTo]),
  };
}
const near = (frames, t, w) => frames.filter((x) => Math.abs(x.t - t) <= w).map((x) => x.f);
export const keyTimes = (sw) => ({ setup: sw.addr.t1, top: sw.topT, impact: sw.impT, finish: sw.impT + 800 });

export function analyze(sw, view) {
  const fr = sw.frames;
  const addr = avgFeat(fr.filter((x) => x.t >= sw.addr.t0 && x.t <= sw.addr.t1 + 60).map((x) => x.f)) || avgFeat(fr.slice(0, 3).map((x) => x.f));
  const top = avgFeat(near(fr, sw.topT, 40));
  const imp = avgFeat(near(fr, sw.impT, 40));
  const fin = avgFeat(fr.filter((x) => x.t >= sw.impT + 600).map((x) => x.f)) || avgFeat(fr.slice(-2).map((x) => x.f));
  const T = addr.T;
  const impactOk = (sw.downFrames ?? 5) >= 3; // enough frames to trust what happens at impact
  const m = { downFrames: sw.downFrames ?? null };
  m.headRise = (addr.nose.y - imp.nose.y) / T;

  if (view === "face") {
    const dir = Math.sign(addr.p[I.lSh].x - addr.p[I.rSh].x) || 1; // +1: target to image right
    const lead = { sh: addr.p[I.lSh], an: addr.lAn }, trail = { sh: addr.p[I.rSh], an: addr.rAn };
    const stanceW = Math.abs(addr.lAn.x - addr.rAn.x) || 1;
    // Camera roll: the ankles stand on flat ground, so their line is the horizon.
    const slope = (addr.lAn.y - addr.rAn.y) / ((addr.lAn.x - addr.rAn.x) || 1);
    m.cameraRollDeg = deg(Math.atan(slope));
    m.stanceRatio = stanceW / (addr.span || 1);
    const sx = addr.sh.x - addr.hp.x, sy = addr.sh.y - addr.hp.y, th = -Math.atan(slope);
    const rx = sx * Math.cos(th) - sy * Math.sin(th), ry = sx * Math.sin(th) + sy * Math.cos(th);
    m.tiltDeg = deg(Math.atan2(-rx * dir, -ry)); // positive: upper body behind the ball
    m.leadShHigher = ((trail.sh.y - lead.sh.y) - slope * (trail.sh.x - lead.sh.x)) / T;
    m.sway = ((addr.hp.x - top.hp.x) * dir) / stanceW;
    m.shoulderTurn = top.span / (addr.span || 1);
    m.transfer = ((fin.hp.x - trail.an.x) * dir) / (((lead.an.x - trail.an.x) * dir) || 1);
    const feetSpan = ((lead.an.x - trail.an.x) * dir) || 1;
    const centre = (f) => (f.sh.x + f.hp.x) / 2;
    m.addrWeight = ((centre(addr) - trail.an.x) * dir) / feetSpan;
    m.impWeight = impactOk ? ((centre(imp) - trail.an.x) * dir) / feetSpan : null;
    m.upperAhead = impactOk ? ((imp.sh.x - imp.hp.x) * dir) / T : null;
    m.feetMoved = Math.max(dist(fin.lAn, addr.lAn), dist(fin.rAn, addr.rAn)) / stanceW;
  } else {
    const facing = Math.sign(addr.toeMid.x - addr.heelMid.x) || 1;
    m.hingeDeg = deg(Math.atan2(Math.abs(addr.sh.x - addr.hp.x), addr.hp.y - addr.sh.y));
    const ka = [angle(addr.p[I.lHip], addr.p[I.lKn], addr.p[I.lAn]), angle(addr.p[I.rHip], addr.p[I.rKn], addr.p[I.rAn])].filter((x) => x != null);
    m.kneeDeg = ka.length ? ka.reduce((a, b) => a + b, 0) / ka.length : null;
    m.shoulderOverFeet = ((addr.sh.x - addr.ankMid.x) * facing) / T;
    const hingeImp = deg(Math.atan2(Math.abs(imp.sh.x - imp.hp.x), imp.hp.y - imp.sh.y));
    m.hingeLoss = impactOk ? m.hingeDeg - hingeImp : null;
  }
  for (const k of Object.keys(m)) if (typeof m[k] === "number") m[k] = Math.round(m[k] * 1000) / 1000;
  return m;
}

export function runChecks(m, club, view, muted = []) {
  const out = [];
  for (const r of RULES) {
    if (!r.auto || !r.clubs.includes(club) || muted.includes(r.id)) continue;
    if (r.view !== "both" && r.view !== view) continue;
    const pass = r.check(m, club);
    if (pass === null || pass === undefined) continue;
    out.push({ id: r.id, pass });
  }
  return out;
}

// ---------- Coaching ----------
export const ruleById = (id) => RULES.find((r) => r.id === id);
const say = (v, m, club) => (typeof v === "function" ? v(m, club) : v);
export function emptyCoachState() { return { v: 2, focus: null, hist: {}, mastered: [], disputes: {}, skipped: {} }; }
const applies = (r, club) => r && r.auto && r.clubs.includes(club);

function pickFocus(state, club, failingIds, exclude) {
  const H = state.hist;
  const cands = RULES.filter((r) => applies(r, club) && r.conf === "high" && r.id !== exclude && !(state.skipped[r.id] > 0) && (
    failingIds.includes(r.id) || ((H[r.id] || []).slice(-5).filter((x) => !x).length >= 3)));
  cands.sort((a, b) => a.priority - b.priority);
  return cands[0] || null;
}

// One focus for all clubs. A rule that does not apply to the club in your hands is paused, not lost.
export function coach(state, checks, m, club, view, mode, opts = {}) {
  const name = opts.name || "Mariano";
  for (const k of Object.keys(state.skipped)) state.skipped[k]--;
  for (const c of checks) { (state.hist[c.id] ??= []).push(c.pass); if (state.hist[c.id].length > 12) state.hist[c.id].shift(); }
  const failing = checks.filter((c) => !c.pass).map((c) => ruleById(c.id)).sort((a, b) => a.priority - b.priority);
  const failingHigh = failing.filter((r) => r.conf === "high");
  const lines = [], items = []; let event = null;

  if (!state.focus) { const r = pickFocus(state, club, failing.map((r) => r.id)); if (r) state.focus = { id: r.id, hist: [] }; }
  const F = state.focus, fr = F && ruleById(F.id);
  const fc = F && checks.find((c) => c.id === F.id);

  if (fc) {
    F.hist.push(fc.pass); if (F.hist.length > 10) F.hist.shift();
    const last5 = F.hist.slice(-5), good = last5.filter(Boolean).length;
    items.push({ id: F.id, pass: fc.pass, focus: true });
    lines.push(fc.pass ? `Good. ${say(fr.ok, m, club)} ${good} of ${last5.length}.` : say(fr.cue, m, club));
    if (last5.length >= 5 && good >= 4) {
      state.mastered.push(F.id);
      const next = pickFocus(state, club, failing.map((r) => r.id), F.id);
      event = { type: "mastered", id: F.id, next: next?.id || null };
      lines.push(`${name}, you fixed it: ${fr.title.toLowerCase()}.` + (next ? ` Next focus: ${next.title.toLowerCase()}.` : ""));
      state.focus = next ? { id: next.id, hist: [] } : null;
    }
  } else {
    // Focus not measurable now (other camera or other club): coach the top reliable fault instead.
    const other = failingHigh[0];
    if (other) { items.push({ id: other.id, pass: false }); lines.push(say(other.cue, m, club)); }
    else lines.push("Good swing.");
    if (F && opts.cameraHint && applies(fr, club) && fr.view !== "both" && fr.view !== view) {
      lines.push(`Your focus needs the camera ${fr.view === "dtl" ? "behind you" : "in front of you"}.`);
      event = { type: "camera", view: fr.view };
    }
  }
  if (mode === 3) {
    for (const r of failing) {
      if (items.length >= 3) break;
      if (items.some((i) => i.id === r.id)) continue;
      items.push({ id: r.id, pass: false });
      lines.push(`Also: ${say(r.cue, m, club)}`);
    }
  }
  const detail = items.length ? ruleById(items[0].id).rule : "";
  return { speech: lines.join(" "), items, event, detail, focusId: state.focus?.id || null };
}

// "wrong": undo the last result for that rule so a bad measurement does not count.
export function dispute(state, ruleId) {
  const h = state.hist[ruleId]; if (h?.length) h.pop();
  if (state.focus?.id === ruleId && state.focus.hist.length) state.focus.hist.pop();
  state.disputes[ruleId] = (state.disputes[ruleId] || 0) + 1;
}
// "skip": move to the next focus and keep the old one away for 20 swings.
export function skipFocus(state, club) {
  const old = state.focus?.id; if (old) state.skipped[old] = 20;
  const failingRecent = Object.entries(state.hist).filter(([, h]) => h.slice(-5).some((x) => !x)).map(([id]) => id);
  const next = pickFocus(state, club, failingRecent, old);
  state.focus = next ? { id: next.id, hist: [] } : null;
  return next;
}

// ---------- Voice commands ----------
const CMD = [
  ["wrong", /\b(wrong|mistake|incorrect|not true|no way)\b/],
  ["practice", /\b(practice|practise|no ball|air swing|ignore)\b/],
  ["skip", /\b(skip|change focus|new focus)\b/],
  ["explain", /\b(explain|why|how do i|tell me more)\b/],
  ["repeat", /\b(repeat|again|say that|what did you say)\b/],
  ["next", /\b(next block|next|move on)\b/],
  ["status", /\b(status|how many|balls left)\b/],
];
const RES = [
  ["straight", /\b(straight|perfect|great shot|good shot|pure|flushed?)\b/],
  ["slice", /\b(slice|sliced|fade|banana)\b/],
  ["hook", /\b(hook|hooked|draw)\b/],
  ["push", /\b(push|pushed)\b/],
  ["pull", /\b(pull|pulled)\b/],
  ["top", /\b(thin|thinned|top|topped|skull|skulled)\b/],
  ["fat", /\b(fat|chunk|chunked|heavy|duff)\b/],
];
export function parseCommand(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return null;
  for (const [type, re] of CMD) if (re.test(t)) return { type };
  for (const [value, re] of RES) if (re.test(t)) return { type: "result", value };
  return null;
}

// ---------- Stats and session plan ----------
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const catOf = (w) => w.cat || (w.club === "driver" ? "driver" : w.club === "hybrid" ? "hybrid" : w.club === "wedge" ? "chip" : "mid");

export function catStats(sessions, lastN = 3) {
  const out = {};
  for (const s of (sessions || []).slice(-lastN)) for (const w of s.swings || []) {
    if (w.practice || w.block === "warmup") continue;
    const c = catOf(w); const o = (out[c] ??= { n: 0, logged: 0, bad: 0, checks: 0, fails: 0 });
    o.n++;
    if (w.result) { o.logged++; if (BAD_RESULTS.includes(w.result)) o.bad++; }
    for (const ch of w.checks || []) { if (ruleById(ch.id)?.conf !== "high") continue; o.checks++; if (!ch.pass) o.fails++; }
  }
  for (const o of Object.values(out)) {
    o.badRate = o.logged ? o.bad / o.logged : null;
    o.faultRate = o.checks ? o.fails / o.checks : null;
    o.score = o.badRate != null && o.logged >= 5 ? 0.6 * o.badRate + 0.4 * (o.faultRate ?? o.badRate) : o.faultRate;
  }
  return out;
}

// total balls -> ordered blocks. The weakest category gets more balls, goes first after the
// warm up (when you are fresh) and comes back at the end as a retest.
export function buildPlan(total, bagIds, sessions, focusView) {
  total = Math.max(10, Math.min(300, Math.round(total || 50)));
  const bag = new Set(bagIds && bagIds.length ? bagIds : BAG.map((c) => c.id));
  const pick = (cat) => CATS[cat].pick.find((id) => bag.has(id)) || null;
  const stats = catStats(sessions);
  const cats = CAT_ORDER.filter((c) => pick(c));
  const warm = Math.max(4, Math.round(total * 0.08));
  const rest = total - warm;
  const w = {};
  for (const c of cats) { const s = stats[c]?.score; w[c] = CATS[c].base * (s == null ? 1 : 0.6 + 1.2 * s); }
  const sumW = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const balls = {}; let used = 0;
  for (const c of cats) { balls[c] = Math.max(3, Math.round((rest * w[c]) / sumW)); used += balls[c]; }
  // fix rounding on the biggest category
  const biggest = cats.slice().sort((a, b) => balls[b] - balls[a])[0];
  if (biggest) balls[biggest] += rest - used;
  const scored = cats.filter((c) => stats[c]?.score != null);
  const worst = scored.length ? scored.sort((a, b) => stats[b].score - stats[a].score)[0] : null;

  const why = (c) => {
    const s = stats[c];
    if (!s || s.score == null) return "";
    const parts = [];
    if (s.badRate != null && s.logged >= 5) parts.push(`${pct(s.bad, s.logged)}% bad shots`);
    if (s.faultRate != null) parts.push(`${pct(s.fails, s.checks)}% swing faults`);
    return (c === worst ? "Your weakest lately: " : "Lately: ") + parts.join(", ") + ".";
  };
  const blocks = [];
  const view0 = focusView === "face" ? "face" : "dtl";
  // Camera alternates block by block so every club gets checked from both sides.
  const add = (cat, n, phase) => {
    const id = pick(cat === "warmup" ? "warmup" : cat); if (!id || n <= 0) return;
    const parts = Math.ceil(n / 10);
    for (let part = 0; part < parts; part++) {
      const b = Math.floor(n / parts) + (part < n % parts ? 1 : 0);
      const v = blocks.length === 0 ? view0 : (blocks[blocks.length - 1].view === "dtl" ? "face" : "dtl");
      blocks.push({ cat, clubId: id, name: clubById(id).name, balls: b, view: v, phase,
        why: phase === "warmup" ? CATS.warmup.short : phase === "retest" ? "Retest your weakest club now that you are warm." : [why(cat), CATS[cat].note].filter(Boolean).join(" ") });
    }
  };
  add("warmup", warm, "warmup");
  if (worst) { const first = Math.ceil(balls[worst] * 0.6); add(worst, first, "focus"); balls[worst] -= first; }
  for (const c of cats) if (c !== worst) add(c, balls[c], "main");
  if (worst) add(worst, balls[worst], "retest");
  return { total, blocks, stats, worst, adapted: scored.length > 0 };
}

// ---------- Calibration (trial period) ----------
// A full bucket with no corrections, every club category from both camera sides. Each category
// is split in two blocks and the order is chosen so the camera only moves every second block.
export function calibrationPlan(total, bagIds) {
  total = Math.max(20, Math.min(300, Math.round(total || 100)));
  const bag = new Set(bagIds && bagIds.length ? bagIds : BAG.map((c) => c.id));
  const pick = (cat) => CATS[cat].pick.find((id) => bag.has(id)) || null;
  const cats = CAT_ORDER.filter((c) => pick(c));
  const warm = Math.max(4, Math.round(total * 0.08)), rest = total - warm;
  const sumW = cats.reduce((a, c) => a + CATS[c].base, 0) || 1;
  const balls = {}; let used = 0;
  for (const c of cats) { balls[c] = Math.max(4, Math.round((rest * CATS[c].base) / sumW)); used += balls[c]; }
  const biggest = cats.slice().sort((a, b) => balls[b] - balls[a])[0];
  if (biggest) balls[biggest] += rest - used;
  const why = "Calibration: swing normally, no corrections. Say how each ball flew.";
  const blocks = [];
  const push = (cat, id, n, view, phase) => blocks.push({ cat, clubId: id, name: clubById(id).name, balls: n, view, phase, why: phase === "warmup" ? CATS.warmup.short : why });
  let view = "dtl";
  const w = pick("warmup"); if (w) push("warmup", w, warm, view, "warmup");
  for (const c of cats) {
    const a = Math.ceil(balls[c] / 2), b = balls[c] - a;
    push(c, pick(c), a, view, "calib");
    view = view === "dtl" ? "face" : "dtl";
    if (b > 0) push(c, pick(c), b, view, "calib");
  }
  return { total, calib: true, blocks };
}
const CAL_KEYS = {
  face: ["stanceRatio", "tiltDeg", "leadShHigher", "addrWeight", "sway", "shoulderTurn", "impWeight", "upperAhead", "transfer", "feetMoved", "headRise", "cameraRollDeg", "downFrames"],
  dtl: ["hingeDeg", "kneeDeg", "shoulderOverFeet", "hingeLoss", "headRise", "downFrames"],
};
export function calibSummary(s) {
  const sw = (s.swings || []).filter((w) => w.calib && !w.practice);
  const groups = {};
  for (const w of sw) (groups[`${w.clubId}|${w.view}`] ??= []).push(w);
  const stat = (vals) => {
    const v = vals.filter((x) => typeof x === "number" && isFinite(x)); if (!v.length) return null;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    const r = (x) => Math.round(x * 1000) / 1000;
    return { n: v.length, mean: r(mean), sd: r(sd), min: r(Math.min(...v)), max: r(Math.max(...v)) };
  };
  const out = Object.entries(groups).map(([k, ws]) => {
    const [clubId, view] = k.split("|"), metrics = {};
    for (const key of CAL_KEYS[view] || []) { const st = stat(ws.map((w) => w.m?.[key])); if (st) metrics[key] = st; }
    return { clubId, view, n: ws.length, metrics };
  });
  const q = sw.map((w) => w.q || {});
  const avg = (k) => { const v = q.map((x) => x[k]).filter((x) => typeof x === "number"); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  return { mic: s.calib?.mic ?? null, heard: s.calib?.heard ?? null, swings: sw.length, practice: (s.swings || []).filter((w) => w.calib && w.practice).length,
    fps: avg("fps"), otherPeople: q.filter((x) => x.poses > 1).length, logged: sw.filter((w) => w.result).length, groups: out };
}

// ---------- Coach notes: a short written summary of a session ----------
export function coachNotes(s, sessions, cs) {
  const st = sessionStats(s), N = [];
  if (!st.n) return ["No swings were recorded in this session."];
  const clubs = Object.keys(st.byClub).length;
  if (s.calib) N.push(`Calibration session: ${st.n} swings with ${clubs} clubs and no corrections. Copy the report below and paste it to Claude so the rules can be tuned to your body and your camera.`);
  else N.push(`${st.n} swings with ${clubs} club${clubs > 1 ? "s" : ""}${s.plan ? `, following a ${s.plan.total} ball plan` : ""}.`);
  const per = {};
  for (const w of (s.swings || []).filter((w) => !w.practice && w.block !== "warmup")) {
    const k = w.clubId ? clubById(w.clubId).name : (CLUBS[w.club] || w.club);
    const o = (per[k] ??= { logged: 0, straight: 0, bad: 0, res: {} });
    if (w.result) { o.logged++; o.res[w.result] = (o.res[w.result] || 0) + 1; if (w.result === "straight") o.straight++; if (BAD_RESULTS.includes(w.result)) o.bad++; }
  }
  const ranked = Object.entries(per).filter(([, o]) => o.logged >= 3).sort((a, b) => a[1].bad / a[1].logged - b[1].bad / b[1].logged);
  if (ranked.length >= 2) {
    const [bn, b] = ranked[0], [wn, w] = ranked[ranked.length - 1];
    const top = Object.entries(w.res).filter(([r]) => r !== "straight").sort((a, b) => b[1] - a[1])[0]?.[0];
    N.push(`Best club today: ${bn.toLowerCase()}, ${b.straight} of ${b.logged} straight. Weakest: ${wn.toLowerCase()}, ${w.bad} of ${w.logged} went wrong${top ? `, mostly ${top === "top" ? "thin" : top}` : ""}.`);
    if (top && RESULT_TIPS[top]) N.push(RESULT_TIPS[top]);
  } else if (!Object.values(st.results).length) {
    N.push("No ball flights were logged, so the plan can only use your swing faults. Say how each ball flew next time: it is the only way the app knows the result.");
  }
  const tf = st.faults.find((f) => ruleById(f.id)?.conf === "high" && f.fail > 0);
  if (tf) { const r = ruleById(tf.id); N.push(`The fault that showed up most: ${r.title.toLowerCase()}, in ${tf.fail} of ${tf.n} swings. ${r.rule.split(". ")[0]}.`); }
  if (cs?.focus && !s.calib) { const l5 = cs.focus.hist.slice(-5); N.push(`Your focus now is ${ruleById(cs.focus.id).title.toLowerCase()}: ${l5.filter(Boolean).length} of your last ${l5.length} right.`); }
  const d = Object.keys(s.disputes || {});
  if (d.length) N.push(`You said ${d.map((id) => ruleById(id)?.title.toLowerCase()).join(" and ")} was wrong. Claude will look at that rule with this report.`);
  return N;
}
// Bad shot rate of a session (null when no flights were logged)
export function badRate(s) {
  const r = (s.swings || []).filter((w) => !w.practice && w.result);
  return r.length ? r.filter((w) => BAD_RESULTS.includes(w.result)).length / r.length : null;
}

// ---------- Reports ----------
export function sessionStats(s) {
  const swings = (s.swings || []).filter((w) => !w.practice);
  const byClub = {}, results = {}, faults = {};
  for (const w of swings) {
    const k = w.clubId ? clubById(w.clubId).name : (CLUBS[w.club] || w.club);
    byClub[k] = (byClub[k] || 0) + 1;
    if (w.result) results[w.result] = (results[w.result] || 0) + 1;
    for (const c of w.checks || []) { faults[c.id] ??= { fail: 0, n: 0 }; faults[c.id].n++; if (!c.pass) faults[c.id].fail++; }
  }
  const faultList = Object.entries(faults).map(([id, v]) => ({ id, ...v, rate: pct(v.fail, v.n) })).sort((a, b) => b.rate - a.rate || b.fail - a.fail);
  return { n: swings.length, practice: (s.swings || []).length - swings.length, byClub, results, faults: faultList };
}

export function reportText(sessions, sid, coachState) {
  const s = sessions.find((x) => x.id === sid) || sessions[sessions.length - 1];
  if (!s) return "No sessions yet.";
  const st = sessionStats(s), L = [];
  L.push(s.calib ? "GOLF COACH CALIBRATION REPORT" : "GOLF COACH SESSION REPORT");
  L.push(`Date: ${new Date(s.start).toLocaleString()}  Swings: ${st.n}  Practice swings ignored: ${st.practice}`);
  if (s.plan) L.push(`Plan: ${s.plan.total} balls, ${s.plan.blocks.length} blocks, finished ${Math.min(s.blockIdx ?? 0, s.plan.blocks.length)} blocks`);
  L.push("Clubs: " + Object.entries(st.byClub).map(([c, n]) => `${c} ${n}`).join(", "));
  const logged = Object.values(st.results).reduce((a, b) => a + b, 0);
  if (logged) L.push(`Ball flight (${logged} logged): ` + Object.entries(st.results).map(([r, n]) => `${r} ${n}`).join(", "));
  L.push("", "Faults this session (failed / checked):");
  for (const f of st.faults) { const r = ruleById(f.id); L.push(`  ${r ? r.title : f.id}${r?.conf === "low" ? " (weak measurement)" : ""}: ${f.fail}/${f.n} (${f.rate}%)`); }
  const cs = catStats([s], 1);
  L.push("", "By category (bad shots, swing faults):");
  for (const [c, o] of Object.entries(cs)) L.push(`  ${CATS[c]?.name || c}: ${o.n} swings, ${o.logged ? pct(o.bad, o.logged) + "% bad of " + o.logged + " logged" : "no flights logged"}, ${o.checks ? pct(o.fails, o.checks) + "% faults" : "no checks"}`);
  if (s.disputes && Object.keys(s.disputes).length) L.push("", "Corrections you said were wrong: " + Object.entries(s.disputes).map(([id, n]) => `${ruleById(id)?.title || id} x${n}`).join(", "));
  const prev = sessions.filter((x) => x.start < s.start).slice(-5);
  if (prev.length) {
    L.push("", "Trend (fail rate, older to newer, this session last):");
    for (const f of st.faults.slice(0, 5)) {
      const seq = [...prev, s].map((x) => { const q = sessionStats(x).faults.find((y) => y.id === f.id); return q ? q.rate + "%" : "-"; });
      L.push(`  ${ruleById(f.id)?.title || f.id}: ${seq.join(" > ")}`);
    }
  }
  const tips = Object.entries(st.results).filter(([r, n]) => RESULT_TIPS[r] && n >= 3).map(([r]) => RESULT_TIPS[r]);
  if (tips.length) { L.push("", "From your playlist, about your ball flight:"); tips.forEach((t) => L.push("  " + t)); }
  if (s.calib) {
    const c = calibSummary(s);
    L.push("", "Calibration checks:");
    L.push(`  Voice test: ${c.mic === "ok" ? "worked" + (c.heard ? ` (heard "${c.heard}")` : "") : c.mic === "no" ? "did not hear anything" : "not run"}`);
    L.push(`  Swings captured: ${c.swings} of ${s.plan?.total ?? "?"} planned, practice swings: ${c.practice}, ball flights logged: ${c.logged}`);
    L.push(`  Camera speed: ${c.fps ?? "?"} frames per second, swings with another person in the picture: ${c.otherPeople}`);
    for (const g of c.groups) {
      L.push(`  ${clubById(g.clubId).name}, camera ${g.view === "dtl" ? "behind" : "in front"} (${g.n} swings):`);
      for (const [k, v] of Object.entries(g.metrics)) L.push(`    ${k}: mean ${v.mean}, sd ${v.sd}, min ${v.min}, max ${v.max}`);
    }
  }
  if (coachState?.focus) L.push("", `Current focus: ${ruleById(coachState.focus.id)?.title}`);
  L.push("", "Raw swings: " + JSON.stringify((s.swings || []).map((w) => ({ c: w.clubId || w.club, v: w.view, r: w.result || null, p: w.practice ? 1 : 0, q: w.q || null, f: (w.checks || []).filter((c) => !c.pass).map((c) => c.id), m: w.m }))));
  return L.join("\n");
}
