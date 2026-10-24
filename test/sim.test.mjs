// Simulated swings and unit checks for the engine and the voice parser.
import { features, SwingDetector, analyze, runChecks, setupCheck, setupMetrics, averageFeatures, coach, emptyCoachState, reportText, frameHint,
  pickGolfer, buildPlan, calibrationPlan, dispute, skipFocus, ballRoi, detectBall, ballHit, stockDistances, roundStats, weeklySummary, calibSummary, coachNotes } from "../engine.js";
import { parseUtterance } from "../voice.js";
import { GOALS, SWING_LEN, goalLabel } from "../rules.js";
import { PHOTO } from "../art-data.js";
import { T, blockCall, catalog, sentences, keyOf } from "../lines.js";

const W = 640, H = 480;
function body({ hipShiftX = 0, handsX = 0.5, handsY = 0.62, spanScale = 1, noseDy = 0, stance = 0.16, shTilt = 0.01, upperX = 0, dx = 0, roll = 0 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const cx = 0.5 + hipShiftX + dx;
  const set = (i, x, y) => (lm[i] = { x, y: y + roll * (x - 0.5), visibility: 0.99 });
  const sw = 0.065 * spanScale;
  set(0, cx + upperX, 0.2 + noseDy);
  set(11, cx + upperX + sw, 0.3 - shTilt); set(12, cx + upperX - sw, 0.3 + shTilt);
  set(13, cx + sw, 0.42); set(14, cx - sw, 0.42);
  set(15, handsX + dx + 0.01, handsY); set(16, handsX + dx - 0.01, handsY);
  set(19, handsX + dx + 0.012, handsY + 0.02); set(20, handsX + dx - 0.012, handsY + 0.02);
  set(23, cx + 0.05, 0.5); set(24, cx - 0.05, 0.5);
  set(25, cx + 0.06, 0.66); set(26, cx - 0.06, 0.66);
  const ax = 0.5 + dx;
  set(27, ax + stance / 2, 0.82); set(28, ax - stance / 2, 0.82);
  set(29, ax + stance / 2 - 0.01, 0.83); set(30, ax - stance / 2 - 0.01, 0.83);
  set(31, ax + stance / 2 + 0.01, 0.83); set(32, ax - stance / 2 + 0.01, 0.83);
  return lm;
}
function simulate(opts) {
  const { sway = 0, turn = 0.4, arrive = 0, hold = 1, backF = 25, downF = 8 } = opts;
  const det = new SwingDetector(); det.club = opts.club || "iron";
  let t = 0, out = null; const dt = 33;
  const step = (lm) => { t += dt; const e = det.push(t, features(lm, W, H)); if (e?.type === "swing") out = e; };
  for (let i = 0; i < 30; i++) step(body({ ...opts.base }));
  for (let i = 0; i <= backF; i++) { const k = i / backF; step(body({ ...opts.base, hipShiftX: (opts.base?.hipShiftX || 0) - sway * k, handsX: 0.5 - 0.18 * k, handsY: 0.62 - 0.42 * k, spanScale: 1 - (1 - turn) * k })); }
  for (let i = 0; i <= downF; i++) { const k = i / downF; step(body({ ...opts.base, hipShiftX: -sway + (sway + arrive) * k, handsX: 0.32 + 0.18 * k, handsY: 0.2 + 0.42 * k, spanScale: turn + (1 - turn) * k })); }
  for (let i = 0; i <= 40; i++) { const k = Math.min(1, i / 15); step(body({ ...opts.base, hipShiftX: arrive + 0.06 * k * hold, handsX: 0.5 + 0.15 * k, handsY: 0.62 - 0.45 * k, spanScale: 1 - 0.5 * k })); }
  return out;
}
let fails = 0;
const expect = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; };

// --- Swing metrics
const GOOD = { base: { hipShiftX: 0.015 }, arrive: 0.015 };
let sw = simulate(GOOD);
expect("swing detected", !!sw);
const m = analyze(sw, "face", { clubId: "7i", group: "iron" });
const ch = runChecks(m, "iron", "face");
expect("no sway", ch.find((c) => c.id === "sway")?.pass === true);
expect("turn ok", ch.find((c) => c.id === "arms")?.pass === true);
expect("tempo measured", m.tempoRatio > 2 && m.backMs > 600);
const fast = analyze(simulate({ ...GOOD, backF: 12 }), "face", { clubId: "7i", group: "iron" });
expect("quick backswing gives lower tempo", fast.tempoRatio < m.tempoRatio);
const bad = analyze(simulate({ base: {}, sway: 0.06, turn: 0.95 }), "face", { clubId: "7i", group: "iron" });
const chb = runChecks(bad, "iron", "face");
expect("sway detected", chb.find((c) => c.id === "sway")?.pass === false);
expect("arms only detected", chb.find((c) => c.id === "arms")?.pass === false);
expect("setup rules not in motion checks", runChecks(bad, "iron", "face", { kind: "motion" }).every((c) => c.id !== "stance"));

// --- Pre-shot check
const narrow = averageFeatures([features(body({ stance: 0.08 }), W, H)]);
let sc = setupCheck(setupMetrics(narrow, "face", "7i", "iron", null), "iron", "face");
expect("narrow stance flagged before the shot", sc.next?.id === "stance" && /wider/.test(sc.fix));
const okSetup = averageFeatures([features(body({ stance: 0.16, hipShiftX: 0.015, shTilt: 0.02 }), W, H)]);
const ball = { x: (0.5 + 0.08 * 0.14) * W, y: 0.85 * H, d: 8 };
sc = setupCheck(setupMetrics(okSetup, "face", "7i", "iron", ball), "iron", "face");
console.log("   setup:", JSON.stringify(sc.logged));
expect("good setup is ready", sc.ready);
const farBall = { x: (0.5 + 0.08) * W, y: 0.85 * H, d: 8 };
sc = setupCheck(setupMetrics(okSetup, "face", "7i", "iron", farBall), "iron", "face");
expect("ball too far forward", sc.next?.id === "ballpos" && /back/.test(sc.fix));
const drv = setupMetrics(okSetup, "face", "driver", "driver", farBall);
expect("driver ball forward is fine", Math.abs(drv.ballPosErr) <= 0.12);

// --- Coaching: focus only from swing motion, with the reason
const st = emptyCoachState();
let r = coach(st, chb, bad, "iron", "face", 1);
console.log("   coach:", r.speech);
expect("focus is arms", st.focus?.id === "arms");
expect("speech has the reason", /body makes/.test(r.speech));
for (let i = 0; i < 5; i++) r = coach(st, ch, m, "iron", "face", 1);
expect("mastered after 4 of 5", st.mastered.includes("arms"));
const lowS = emptyCoachState(); coach(lowS, [{ id: "tempo", pass: false }, { id: "upper", pass: false }], {}, "driver", "face", 1);
expect("weak rules never the focus", lowS.focus === null);
const ds = emptyCoachState(); coach(ds, chb, bad, "iron", "face", 1); const before = ds.focus.hist.length; dispute(ds, ds.focus.id);
expect("wrong removes the result", ds.focus.hist.length === before - 1);
expect("skip changes focus", skipFocus(ds, "iron")?.id !== "arms");

// --- Putting stroke detector and checks
{
  const det = new SwingDetector(); det.club = "putt"; let t = 0, out = null;
  const step = (lm) => { t += 33; const e = det.push(t, features(lm, W, H)); if (e?.type === "swing") out = e; };
  for (let i = 0; i < 30; i++) step(body({}));
  for (let i = 0; i <= 15; i++) step(body({ handsX: 0.5 - 0.1 * (i / 15) }));
  for (let i = 0; i <= 10; i++) step(body({ handsX: 0.4 + 0.1 * (i / 10) }));
  for (let i = 0; i <= 40; i++) step(body({ handsX: 0.5 + 0.1 * Math.min(1, i / 12) }));
  expect("putting stroke detected", !!out);
  const pm = analyze(out, "face", { clubId: "PT", group: "putt" });
  expect("pendulum about equal", pm.pendulum > 0.8 && pm.pendulum < 1.3);
  expect("head still", runChecks(pm, "putt", "face").find((c) => c.id === "headstill")?.pass === true);
}

// --- Ball detection on a synthetic frame
{
  const f = features(body({}), W, H), roi = ballRoi(f, "face");
  const img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  for (let i = 0; i < W * H; i++) { img.data[i * 4] = 60; img.data[i * 4 + 1] = 120; img.data[i * 4 + 2] = 70; img.data[i * 4 + 3] = 255; }
  const bx = 0.5 * W + 4, by = 0.86 * H, rr = roi.d / 2;
  const paint = (cx, cy, r, col) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 4; img.data[i] = col; img.data[i + 1] = col; img.data[i + 2] = col; } };
  paint(bx, by, rr, 245);
  paint(0.58 * W, 0.83 * H, 9, 250); // a white shoe near the left ankle: must be ignored
  const b = detectBall(img, roi);
  expect("ball found", b && Math.abs(b.x - bx) < 3 && Math.abs(b.y - by) < 3);
  paint(bx, by, rr + 1, 60);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (img.data[i] === 60 && img.data[i + 1] === 60) { img.data[i + 1] = 120; img.data[i + 2] = 70; } }
  const gone = detectBall(img, roi);
  expect("ball gone after the shot", !gone && ballHit(b, gone) === true);
  expect("ball still there means practice", ballHit(b, b) === false && ballHit(null, null) === null);
}

// --- Golfer lock and views
const me = body({}), other = body({ dx: 0.3 });
let g = pickGolfer([other, me], null); expect("lock centred golfer", g.idx === 1);
g = pickGolfer([other], g.lock); expect("ignore the neighbour", g.idx === -1);
const d = body({}); for (const i of [12, 14, 16, 24, 26, 28]) d[i].visibility = 0.2;
expect("behind view ok with far side hidden", features(d, W, H, "dtl").ok === true);

// --- Plans by venue
let plan = buildPlan({ venue: "pw", total: 100 });
const range = plan.blocks.filter((b) => !b.short);
expect("Pittwater: range uses the bucket", range.reduce((a, b) => a + b.balls, 0) === 100);
expect("Pittwater: short game after the range", plan.blocks.some((b) => b.cat === "putt") && plan.blocks.some((b) => b.cat === "chip"));
expect("random block at the end of the range", range.at(-1).phase === "random" && range.at(-1).sequence.length === range.at(-1).balls);
console.log("   PW plan:", plan.blocks.map((b) => `${b.name} ${b.balls}${b.view === "dtl" ? "B" : "F"}`).join(" | "));
plan = buildPlan({ venue: "sf", minutes: 60 });
expect("Swing Factory: by time", plan.mode === "time" && plan.total === 66 && plan.blocks.every((b) => b.minutes) && !plan.blocks.some((b) => b.short));
const cal = calibrationPlan({ venue: "pw", total: 100 });
console.log("   calibration:", cal.blocks.map((b) => `${b.name} ${b.balls}${b.view === "dtl" ? "B" : "F"}`).join(" | "));
for (const c of ["short", "mid", "long", "hybrid", "driver", "chip", "putt"]) expect(`calibration: ${c} from both sides`, new Set(cal.blocks.filter((b) => b.cat === c).map((b) => b.view)).size === 2);
expect("calibration has no random block and no bunker", !cal.blocks.some((b) => b.cat === "random" || b.cat === "bunker"));
const hist = [{ id: "s1", start: 1, swings: [
  ...Array.from({ length: 10 }, () => ({ clubId: "driver", cat: "driver", res: { result: "slice", sev: 3 }, checks: [{ id: "arms", pass: false }] })),
  ...Array.from({ length: 10 }, () => ({ clubId: "7i", cat: "mid", res: { result: "straight", sev: 0 }, checks: [{ id: "arms", pass: true }] })),
] }];
plan = buildPlan({ venue: "pw", total: 100, sessions: hist });
expect("weakest club right after the warm up", plan.blocks[1].cat === "driver" && plan.worst === "driver");
expect("weakest club retested", plan.blocks.some((b) => b.phase === "retest"));

// --- A goal for every block: swing length, effort and what to try to do
const allPlans = [buildPlan({ venue: "pw", total: 100 }), buildPlan({ venue: "sf", minutes: 60 }), cal, plan];
expect("every block has a goal", allPlans.every((p) => p.blocks.every((b) => b.goal && b.goal.aim && goalLabel(b.goal))));
expect("warm up: half swings at 50%", allPlans.every((p) => p.blocks[0].phase === "warmup" && p.blocks[0].goal.swing === "half" && p.blocks[0].goal.effort === 50));
expect("calibration: full swings at 80%", cal.blocks.filter((b) => !b.short).slice(1).every((b) => b.goal.key === "calib" && goalLabel(b.goal) === "Full swing, 80%"));
expect("weakest club: three quarter at 70%, retest back at 80%", plan.blocks[1].goal.swing === "tq" && plan.blocks[1].goal.effort === 70 && plan.blocks.find((b) => b.phase === "retest").goal.effort === 80);
const pp = buildPlan({ venue: "pw", total: 100 }).blocks.filter((b) => b.cat === "putt");
expect("putting: short putts first, then long ones", pp.length === 2 && pp[0].goal.key === "puttShort" && pp[1].goal.key === "puttLong");
const dh = [{ start: 1, swings: Array.from({ length: 6 }, (_, i) => ({ clubId: "7i", block: "main", res: { result: "straight", sev: 0, distance: 128 + i } })) }];
const b7 = buildPlan({ venue: "sf", minutes: 60, sessions: dh }).blocks.filter((b) => b.clubId === "7i");
expect("full swing blocks show the usual carry", b7.some((b) => b.goal.swing === "full" && b.goal.carry === 130));
expect("no carry on slowed down blocks", b7.filter((b) => b.goal.swing !== "full").every((b) => !b.goal.carry));
const focusD = [{ start: 1, swings: Array.from({ length: 6 }, () => ({ clubId: "7i", block: "focus", res: { result: "straight", sev: 0, distance: 100 } })) }];
expect("slowed down swings don't count as usual distance", !stockDistances(focusD)["7i"]);
const said = blockCall(plan.blocks[1], 1, plan.blocks.length, { first: false, clubId: plan.blocks[1].clubId, minutes: null });
expect("the coach says the goal", said.includes("Three quarter swings at 70 percent."));
const cat = catalog();
expect("every goal sentence is recorded", Object.values(GOALS).every((g) => sentences(T.goal(g)).every((x) => cat.has(keyOf(x)))));

expect("every swing length has its photo", Object.keys(SWING_LEN).every((k) => PHOTO.lengths?.frames.some((f) => f.k === k)));

// --- Voice, distances, rounds, weekly
expect("voice: your words", parseUtterance("big slice")?.sev === 3 && parseUtterance("muy a la izquierda")?.result === "hook" && parseUtterance("one forty")?.distance === 140);
const sd = stockDistances([{ start: 1, swings: [130, 135, 140, 160, 138].map((d, i) => ({ clubId: "7i", res: { result: i === 3 ? "slice" : "straight", sev: i === 3 ? 3 : 0, distance: d } })) }]);
expect("stock distance uses good shots", sd["7i"].median === 135 || sd["7i"].median === 138);
const rs = roundStats([{ holes: [{ par: 4, score: 6, putts: 2, tee: "obr" }, { par: 4, score: 5, putts: 3, tee: "fairway", approach: "green" }, { par: 3, score: 4, putts: 2, approach: "short" }] }]);
expect("round stats", rs.fairways === 0.5 && rs.obRight === 1 && rs.threePutts === 1);
const wk = weeklySummary([{ start: Date.now(), swings: hist[0].swings }]);
expect("weekly summary", wk.cur.balls === 20 && wk.cur.topFault?.id === "arms");

// --- Reports
const calSession = { id: "c", start: Date.now(), venue: "pw", calib: { mic: "ok", heard: "straight" }, voiceLog: [{ text: "la mande lejos", parsed: false }],
  swings: [1, 2, 3].map((i) => ({ calib: true, clubId: "7i", view: "face", m, q: { fps: 24, poses: 2 }, ball: { before: { x: 1 }, hit: i < 3 }, voice: [{ text: "straight one forty" }], res: parseUtterance("straight one forty") })) };
const cs = calibSummary(calSession);
expect("calibration summary", cs.ballSeen === 3 && cs.hit === 2 && cs.distances === 3 && cs.groups[0].metrics.tempoRatio);
const rep = reportText([calSession], "c");
expect("calibration report lists unknown words", /did not understand: "la mande lejos"/.test(rep) && /Ball seen at setup: 3/.test(rep));
expect("coach notes", coachNotes(calSession, [calSession], null).length >= 1);
const lmF = body({}); lmF[27].visibility = 0.1;
expect("feet hint", /feet/.test(frameHint(features(lmF, W, H), "face")));
process.exit(fails ? 1 : 0);
