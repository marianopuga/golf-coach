// Simulated swings and unit checks for the engine.
import { features, SwingDetector, analyze, runChecks, coach, emptyCoachState, reportText, frameHint,
  pickGolfer, parseCommand, buildPlan, dispute, skipFocus, calibrationPlan, calibSummary } from "../engine.js";

const W = 720, H = 1280;
function body({ hipShiftX = 0, handsX = 0.5, handsY = 0.62, spanScale = 1, noseDy = 0, stance = 0.16, shTilt = 0.01, upperX = 0, dx = 0, roll = 0 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const cx = 0.5 + hipShiftX + dx;
  const set = (i, x, y) => (lm[i] = { x, y: y + roll * (x - 0.5), visibility: 0.99 });
  const sw = 0.065 * spanScale;
  set(0, cx + upperX, 0.26 + noseDy);
  set(11, cx + upperX + sw, 0.33 - shTilt); set(12, cx + upperX - sw, 0.33 + shTilt);
  set(13, cx + sw, 0.45); set(14, cx - sw, 0.45);
  set(15, handsX + dx + 0.01, handsY); set(16, handsX + dx - 0.01, handsY);
  set(23, cx + 0.05, 0.52); set(24, cx - 0.05, 0.52);
  set(25, cx + 0.06, 0.68); set(26, cx - 0.06, 0.68);
  const ax = 0.5 + dx;
  set(27, ax + stance / 2, 0.84); set(28, ax - stance / 2, 0.84);
  set(29, ax + stance / 2 - 0.01, 0.85); set(30, ax - stance / 2 - 0.01, 0.85);
  set(31, ax + stance / 2 + 0.01, 0.85); set(32, ax - stance / 2 + 0.01, 0.85);
  return lm;
}
function simulate(opts) {
  const { sway = 0, turn = 0.4, arrive = 0, hold = 1 } = opts;
  const det = new SwingDetector(); det.club = opts.club || "iron";
  let t = 0, out = null; const dt = 33;
  const step = (lm) => { t += dt; const e = det.push(t, features(lm, W, H)); if (e?.type === "swing") out = e; };
  for (let i = 0; i < 30; i++) step(body({ ...opts.base }));
  for (let i = 0; i <= 25; i++) { const k = i / 25; step(body({ ...opts.base, hipShiftX: -sway * k, handsX: 0.5 - 0.18 * k, handsY: 0.62 - 0.42 * k, spanScale: 1 - (1 - turn) * k })); }
  for (let i = 0; i <= 8; i++) { const k = i / 8; step(body({ ...opts.base, hipShiftX: -sway + (sway + arrive) * k, handsX: 0.32 + 0.18 * k, handsY: 0.2 + 0.42 * k, spanScale: turn + (1 - turn) * k, upperX: (opts.upperAtImp || 0) * k })); }
  for (let i = 0; i <= 40; i++) { const k = Math.min(1, i / 15); step(body({ ...opts.base, hipShiftX: arrive + 0.06 * k * hold, handsX: 0.5 + 0.15 * k, handsY: 0.62 - 0.45 * k, spanScale: 1 - 0.5 * k })); }
  return out;
}
let fails = 0;
const expect = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; };

const GOOD = { base: { hipShiftX: 0.015 }, arrive: 0.015 };
let sw = simulate(GOOD);
expect("good swing detected", !!sw);
let m = analyze(sw, "face"); let ch = runChecks(m, "iron", "face");
expect("no sway on good swing", ch.find((c) => c.id === "sway")?.pass === true);
expect("turn ok on good swing", ch.find((c) => c.id === "arms")?.pass === true);
expect("iron weight ok on good swing", ch.find((c) => c.id === "ironweight")?.pass === true);
expect("down frames counted", m.downFrames >= 3);

// camera roll is removed using the ankle line
const rolled = analyze(simulate({ base: { hipShiftX: 0.015, roll: 0.08 }, arrive: 0.015 }), "face");
expect("roll measured", Math.abs(rolled.cameraRollDeg) > 2);
expect("roll corrected for shoulder tilt", Math.abs(rolled.leadShHigher - m.leadShHigher) < 0.02);

sw = simulate({ base: {}, sway: 0.06, turn: 0.95 });
const mb = analyze(sw, "face"); const chb = runChecks(mb, "iron", "face");
expect("sway detected", chb.find((c) => c.id === "sway")?.pass === false);
expect("arms only detected", chb.find((c) => c.id === "arms")?.pass === false);

// Coaching: focus is the top high confidence fault, shared across clubs
const st = emptyCoachState();
let r = coach(st, chb, mb, "iron", "face", 1);
console.log(" coach:", r.speech);
expect("focus is arms (priority 3, before sway)", st.focus?.id === "arms");
expect("short cue", r.speech.length < 70);
r = coach(st, runChecks(mb, "driver", "face"), mb, "driver", "face", 1);
expect("same focus with driver", st.focus?.id === "arms");
for (let i = 0; i < 5; i++) r = coach(st, ch, m, "iron", "face", 1);
expect("mastered after 4 of 5", st.mastered.includes("arms"));
console.log(" after mastery:", st.focus?.id || "none");

// low confidence rules never become the focus
const low = emptyCoachState();
coach(low, [{ id: "heels", pass: false }, { id: "tilt", pass: false }], {}, "iron", "dtl", 1);
expect("low confidence never focus", low.focus === null);

// dispute and skip
const ds = emptyCoachState();
coach(ds, chb, mb, "iron", "face", 1);
const before = ds.focus.hist.length; dispute(ds, ds.focus.id);
expect("dispute removes last result", ds.focus.hist.length === before - 1 && ds.disputes.arms === 1);
const nx = skipFocus(ds, "iron");
expect("skip moves to another focus", nx && nx.id !== "arms");

// mode 3
r = coach(emptyCoachState(), chb, mb, "iron", "face", 3);
expect("mode 3 gives more than 1 item", r.items.length > 1);

// Golfer lock: neighbour on the side is ignored
const me = body({}), other = body({ dx: 0.3 });
let g = pickGolfer([other, me], null);
expect("first lock picks the centred golfer", g.idx === 1);
g = pickGolfer([me, other], g.lock);
expect("lock follows the golfer when order changes", g.idx === 0);
g = pickGolfer([other], g.lock);
expect("neighbour alone is not taken", g.idx === -1);

// Down the line: far side hidden is fine
const d = body({}); for (const i of [12, 14, 16, 24, 26, 28]) d[i].visibility = 0.2;
expect("dtl ok with far side hidden", features(d, W, H, "dtl").ok === true);
expect("face needs both sides", features(d, W, H, "face").ok === false);

// Voice commands
const pc = (t) => JSON.stringify(parseCommand(t));
expect("slice", pc("that was a slice") === '{"type":"result","value":"slice"}');
expect("thin", pc("thin") === '{"type":"result","value":"top"}');
expect("pulled left is a pull", pc("pulled left") === '{"type":"result","value":"pull"}');
expect("wrong", pc("that's wrong") === '{"type":"wrong"}');
expect("practice", pc("practice swing") === '{"type":"practice"}');
expect("noise ignored", parseCommand("nice weather today") === null);

// Plan
let plan = buildPlan(50, null, [], null);
expect("plan sums to total", plan.blocks.reduce((a, b) => a + b.balls, 0) === 50);
expect("plan starts with warm up", plan.blocks[0].phase === "warmup");
console.log(" default plan:", plan.blocks.map((b) => `${b.name} ${b.balls} ${b.view}`).join(" | "));
const hist = [{ id: "s1", start: 1, swings: [
  ...Array.from({ length: 10 }, () => ({ clubId: "driver", cat: "driver", club: "driver", result: "slice", checks: [{ id: "arms", pass: false }] })),
  ...Array.from({ length: 10 }, () => ({ clubId: "7i", cat: "mid", club: "iron", result: "straight", checks: [{ id: "arms", pass: true }] })),
] }];
plan = buildPlan(60, null, hist, "face");
console.log(" adapted plan:", plan.blocks.map((b) => `${b.name} ${b.balls} ${b.phase}`).join(" | "));
expect("worst club first after warm up", plan.blocks[1].cat === "driver" && plan.worst === "driver");
expect("worst club retested at the end", plan.blocks[plan.blocks.length - 1].phase === "retest");
const drv = plan.blocks.filter((b) => b.cat === "driver").reduce((a, b) => a + b.balls, 0);
const mid = plan.blocks.filter((b) => b.cat === "mid").reduce((a, b) => a + b.balls, 0);
expect("worst club gets more balls", drv > mid);
expect("adapted plan sums", plan.blocks.reduce((a, b) => a + b.balls, 0) === 60);
expect("blocks at most 10 balls", plan.blocks.every((b) => b.balls <= 10));

// Report
const rep = reportText([{ id: "a", start: Date.now(), swings: [1, 2, 3].map(() => ({ club: "iron", clubId: "7i", cat: "mid", view: "face", result: "slice", checks: chb, m: mb })) }], "a", st);
expect("report has faults and tips", /Faults this session/.test(rep) && /Slices/.test(rep) && /By category/.test(rep));

// Calibration
const cp = calibrationPlan(100, null);
console.log(" calibration:", cp.blocks.map((b) => `${b.name} ${b.balls} ${b.view}`).join(" | "));
expect("calibration uses the whole bucket", cp.blocks.reduce((a, b) => a + b.balls, 0) === 100);
for (const c of ["short", "mid", "long", "hybrid", "driver", "chip"]) {
  const v = new Set(cp.blocks.filter((b) => b.cat === c).map((b) => b.view));
  expect(`calibration sees ${c} from both sides`, v.size === 2);
}
let moves = 0; for (let i = 1; i < cp.blocks.length; i++) if (cp.blocks[i].view !== cp.blocks[i - 1].view) moves++;
expect("camera moves only every second block", moves <= Math.ceil(cp.blocks.length / 2));
const calS = { id: "c", start: Date.now(), calib: { mic: "ok", heard: "straight" }, swings: [1, 2, 3].map(() => ({ calib: true, clubId: "7i", view: "face", m, q: { fps: 24, poses: 2 } })) };
const cs2 = calibSummary(calS);
expect("calibration summary groups metrics", cs2.groups[0].metrics.sway && cs2.fps === 24 && cs2.otherPeople === 3);
expect("calibration report", /CALIBRATION REPORT/.test(reportText([calS], "c")) && /Voice test: worked/.test(reportText([calS], "c")));

const lm = body({}); lm[27].visibility = 0.1;
expect("feet hint", /feet/.test(frameHint(features(lm, W, H), "face")));
process.exit(fails ? 1 : 0);
