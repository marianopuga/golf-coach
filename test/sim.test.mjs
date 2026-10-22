// Simulated swings run through the detector, analysis and coach.
import { features, SwingDetector, analyze, runChecks, coach, emptyCoachState, reportText, frameHint } from "../engine.js";

const W = 720, H = 1280;
// Build 33 landmarks for a face-on golfer. Units: normalized.
function body({ hipShiftX = 0, handsX = 0.5, handsY = 0.62, spanScale = 1, noseDy = 0, stance = 0.16, shTilt = 0.01, upperX = 0 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const cx = 0.5 + hipShiftX;
  const set = (i, x, y) => (lm[i] = { x, y, visibility: 0.99 });
  const sw = 0.065 * spanScale; // half shoulder width
  set(0, cx + upperX, 0.26 + noseDy);
  set(11, cx + upperX + sw, 0.33 - shTilt); // left shoulder toward image right (target)
  set(12, cx + upperX - sw, 0.33 + shTilt);
  set(13, cx + sw, 0.45); set(14, cx - sw, 0.45);
  set(15, handsX + 0.01, handsY); set(16, handsX - 0.01, handsY);
  set(23, cx + 0.05, 0.52); set(24, cx - 0.05, 0.52);
  set(25, cx + 0.06, 0.68); set(26, cx - 0.06, 0.68);
  set(27, 0.5 + stance / 2, 0.84); set(28, 0.5 - stance / 2, 0.84);
  set(29, 0.5 + stance / 2 - 0.01, 0.85); set(30, 0.5 - stance / 2 - 0.01, 0.85);
  set(31, 0.5 + stance / 2 + 0.01, 0.85); set(32, 0.5 - stance / 2 + 0.01, 0.85);
  return lm;
}

function simulate(opts) {
  const { sway = 0, turn = 0.4, arrive = 0, hold = 1 } = opts;
  const det = new SwingDetector(); det.club = opts.club || "iron";
  let t = 0, out = null; const dt = 33;
  const step = (lm) => { t += dt; const e = det.push(t, features(lm, W, H)); if (e?.type === "swing") out = e; return e; };
  for (let i = 0; i < 30; i++) step(body({ ...opts.base }));            // address 1s
  for (let i = 0; i <= 25; i++) { const k = i / 25;                       // backswing 0.83s
    step(body({ ...opts.base, hipShiftX: -sway * k, handsX: 0.5 - 0.18 * k, handsY: 0.62 - 0.42 * k, spanScale: 1 - (1 - turn) * k })); }
  for (let i = 0; i <= 8; i++) { const k = i / 8;                         // downswing 0.27s
    step(body({ ...opts.base, hipShiftX: -sway + (sway + arrive) * k, handsX: 0.32 + 0.18 * k, handsY: 0.2 + 0.42 * k, spanScale: turn + (1 - turn) * k, upperX: (opts.upperAtImp || 0) * k })); }
  for (let i = 0; i <= 40; i++) { const k = Math.min(1, i / 15);         // follow through + finish
    step(body({ ...opts.base, hipShiftX: arrive + 0.06 * k * hold, handsX: 0.5 + 0.15 * k, handsY: 0.62 - 0.45 * k, spanScale: 1 - 0.5 * k })); }
  return out;
}

let fails = 0;
const expect = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; };

// 1. A good swing
const GOOD = { base: { hipShiftX: 0.015 }, arrive: 0.015 };
let sw = simulate(GOOD);
expect("good swing detected", !!sw);
let m = analyze(sw, "face"); let ch = runChecks(m, "iron", "face");
console.log(" metrics", m);
console.log(" checks", ch);
expect("no sway on good swing", ch.find((c) => c.id === "sway")?.pass === true);
expect("turn ok on good swing", ch.find((c) => c.id === "arms")?.pass === true);
expect("iron weight ok on good swing", ch.find((c) => c.id === "ironweight")?.pass === true);
const cs = runChecks(analyze(simulate({ base: {} }), "face"), "iron", "face");
expect("centred weight flagged", cs.find((c) => c.id === "ironweight")?.pass === false);

// 2. Sway + arms only
sw = simulate({ base: {}, sway: 0.06, turn: 0.95 });
m = analyze(sw, "face"); ch = runChecks(m, "iron", "face");
console.log(" metrics", m);
expect("sway detected", ch.find((c) => c.id === "sway")?.pass === false);
expect("arms only detected", ch.find((c) => c.id === "arms")?.pass === false);

// 3. Coach loop: one focus, held until 4 of 5
const st = emptyCoachState();
let r = coach(st, ch, m, "iron", "face", 1);
console.log(" coach:", r.speech);
expect("focus set", !!r.focusId);
const goodSw = simulate(GOOD); const gm = analyze(goodSw, "face"); const gch = runChecks(gm, "iron", "face");
for (let i = 0; i < 5; i++) r = coach(st, gch, gm, "iron", "face", 1);
console.log(" coach after 5 good:", r.speech);
expect("mastered event", JSON.stringify(st.mastered.iron).length > 2);

// 4. Mode 3
r = coach(emptyCoachState(), ch, m, "iron", "face", 3);
console.log(" mode3:", r.speech);
expect("mode 3 gives more than 1 item", r.items.length > 1);

// 5. Frame hint
const lm = body({}); lm[27].visibility = 0.1;
expect("feet hint", /feet/.test(frameHint(features(lm, W, H), "face")));

// 6. Report
const rep = reportText([{ id: "a", start: Date.now(), swings: [{ club: "iron", view: "face", result: "slice", checks: ch, m }, { club: "iron", view: "face", result: "slice", checks: ch, m }, { club: "iron", view: "face", result: "slice", checks: ch, m }] }], "a");
expect("report has faults", /Faults this session/.test(rep) && /Slices/.test(rep));
console.log(rep.split("\nRaw")[0]);

process.exit(fails ? 1 : 0);
