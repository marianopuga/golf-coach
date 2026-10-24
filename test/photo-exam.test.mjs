// The photo exam: the app's own measurements and checks, run on the approved photo set where every picture
// is labeled right or wrong for one tip. A right picture must pass its check, a wrong one must fail it.
// Run: node test/photo-exam.test.mjs [--model lite|full] [--verbose]
import { readFileSync } from "fs";
import { features, setupMetrics, analyze, runChecks } from "../engine.js";

const FX = JSON.parse(readFileSync(new URL("./fixtures/photos.json", import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg("--model", "full"), VERBOSE = process.argv.includes("--verbose");
const W = FX.W, H = FX.H;

const lmOf = (id, model = MODEL) => { const p = FX.poses[model][id]; if (!p) throw new Error(`no pose for ${id}`); return p.map(([x, y, v]) => ({ x, y, visibility: v })); };
const ballOf = (id) => (FX.balls[id] ? { x: FX.balls[id][0] * W, y: FX.balls[id][1] * H, d: 24 } : null);
const feat = (id, view, shift = null) => {
  let lm = lmOf(id);
  if (shift) lm = lm.map((q) => ({ ...q, x: q.x + shift.x, y: q.y + shift.y }));
  return features(lm, W, H, view);
};
// The camera does not move during a real swing; between two photos it may drift a little. Line the photos up
// on the lead ankle, which stays planted until the finish.
const LEAD = 27;
const shiftTo = (ref, id) => { const a = lmOf(ref)[LEAD], b = lmOf(id)[LEAD]; return { x: a.x - b.x, y: a.y - b.y }; };

function setup(id, view, rule, { club = "7i", group = "iron" } = {}) {
  const f = feat(id, view), m = setupMetrics(f, view, club, group, ballOf(id));
  const c = runChecks(m, group, view, { kind: "setup" }).find((x) => x.id === rule);
  return { pass: c ? c.pass : null, m };
}
// A swing made of photos: address, then the top, impact and finish (or back and through for short shots).
function swing(rule, view, { addr, top, imp, fin, group = "iron", club = "7i", back, through }) {
  const fr = [], add = (t, id) => fr.push({ t, f: feat(id, view, id === addr ? null : shiftTo(addr, id)) });
  add(0, addr); add(60, addr); add(120, addr);
  if (back) { add(700, back); add(1000, imp || addr); add(1300, through); add(2100, through); }
  else { add(900, top); add(1200, imp || top); add(2000, fin || imp || top); add(2100, fin || imp || top); }
  const sw = { frames: fr, addr: { t0: 0, t1: 120 }, topT: back ? 700 : 900, impT: back ? 1000 : 1200, downFrames: 5 };
  const m = analyze(sw, view, { clubId: club, group, ball: ballOf(addr) });
  const c = runChecks(m, group, view, { kind: "motion" }).find((x) => x.id === rule);
  return { pass: c ? c.pass : null, m };
}

// [rule, expected pass, label, run]
const CASES = [
  ["stance", true, "A01 7 iron", () => setup("A01", "face", "stance")],
  ["stance", true, "D01 driver", () => setup("D01", "face", "stance", { club: "driver", group: "driver" })],
  ["stance", false, "A01 stance used with the driver", () => setup("A01", "face", "stance", { club: "driver", group: "driver" })],
  ["chipstance", true, "H01 feet close", () => setup("H01", "face", "chipstance", { club: "SW", group: "chip" })],
  ["chipstance", false, "H02 too wide", () => setup("H02", "face", "chipstance", { club: "SW", group: "chip" })],
  ["ballpos", true, "E01 wedge, middle", () => setup("E01", "face", "ballpos", { club: "PW" })],
  ["ballpos", true, "A01 7 iron", () => setup("A01", "face", "ballpos")],
  ["ballpos", true, "D01 driver, left heel", () => setup("D01", "face", "ballpos", { club: "driver", group: "driver" })],
  ["ballpos", false, "D01 ball with a 7 iron", () => setup("D01", "face", "ballpos")],
  ["ballpos", false, "E01 ball with the driver", () => setup("E01", "face", "ballpos", { club: "driver", group: "driver" })],
  ["weightset", true, "A01 chest to target", () => setup("A01", "face", "weightset")],
  ["weightset", false, "C01 chest back", () => setup("C01", "face", "weightset")],
  ["tilt", true, "A01 left shoulder higher", () => setup("A01", "face", "tilt")],
  ["tilt", true, "A01x left shoulder higher", () => setup("A01x", "face", "tilt")],
  ["tilt", false, "C02 shoulders level", () => setup("C02", "face", "tilt"), "the photo shows almost the same tilt as A01"],
  ["handsahead", true, "A01 hands ahead", () => setup("A01", "face", "handsahead")],
  ["handsahead", false, "C03 hands behind", () => setup("C03", "face", "handsahead")],
  ["hinge", true, "B01 lean from hips", () => setup("B01", "dtl", "hinge")],
  ["hinge", false, "B02 rounded back", () => setup("B02", "dtl", "hinge"), "body landmarks have no spine points: the camera sees how far you lean, not a rounded back"],
  ["hinge", false, "F01 standing tall", () => setup("F01", "dtl", "hinge")],
  ["hinge", false, "F02 standing tall", () => setup("F02", "dtl", "hinge")],
  ["knees", true, "B01 flexed", () => setup("B01", "dtl", "knees")],
  ["knees", false, "B03 locked", () => setup("B03", "dtl", "knees")],
  ["knees", false, "B04 sitting", () => setup("B04", "dtl", "knees")],
  ["reach", true, "B01 arms hang", () => setup("B01", "dtl", "reach")],
  ["reach", false, "B05 too far", () => setup("B05", "dtl", "reach")],
  ["reach", false, "B06 too close", () => setup("B06", "dtl", "reach")],
  ["forearms", true, "B01 right arm lower", () => setup("B01", "dtl", "forearms")],
  ["forearms", false, "B07 right arm high", () => setup("B07", "dtl", "forearms")],
  ["heels", true, "B01 balls of the feet", () => setup("B01", "dtl", "heels")],
  ["heels", false, "B08 on the heels", () => setup("B08", "dtl", "heels"), "the photo looks almost like B01; weight on the heels is only guessed"],
  ["eyesover", true, "I05 eyes over the ball", () => setup("I05", "dtl", "eyesover", { club: "PT", group: "putt" })],
  ["eyesover", false, "I06 too upright", () => setup("I06", "dtl", "eyesover", { club: "PT", group: "putt" })],
  ["arms", true, "A01 to A06 body turn", () => swing("arms", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["arms", false, "A01 to C04 arms only", () => swing("arms", "face", { addr: "A01", top: "C04", imp: "A10", fin: "A16" })],
  ["sway", true, "A01 to A06 hips turn", () => swing("sway", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["sway", false, "A01 to C05 hips slide", () => swing("sway", "face", { addr: "A01", top: "C05", imp: "A10", fin: "A16" })],
  ["posture", true, "A01 to A10 height kept", () => swing("posture", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["posture", false, "A01 to C06 stood up", () => swing("posture", "face", { addr: "A01", top: "A06", imp: "C06", fin: "A16" })],
  ["stayleft", true, "A10 weight left", () => swing("stayleft", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["stayleft", false, "C08 hanging back", () => swing("stayleft", "face", { addr: "A01", top: "A06", imp: "C08", fin: "A16" })],
  ["transfer", true, "A16 finish", () => swing("transfer", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["transfer", true, "A17 hold", () => swing("transfer", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A17" })],
  ["transfer", false, "C07 falling back", () => swing("transfer", "face", { addr: "A01", top: "A06", imp: "A10", fin: "C07" })],
  ["feet", true, "A16 balanced finish", () => swing("feet", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" }), "the photo set moves the feet between frames (lead ankle 90 px away)"],
  ["feet", true, "A17 hold", () => swing("feet", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A17" }), "the photo set moves the feet between frames"],
  ["feet", false, "C07 foot spun out", () => swing("feet", "face", { addr: "A01", top: "A06", imp: "A10", fin: "C07" }), "the photo set moves the feet between frames; the fall back is caught by the finish check"],
  ["upper", true, "D01 to D02 behind the ball", () => swing("upper", "face", { addr: "D01", top: "D02", imp: "D02", fin: "D02", club: "driver", group: "driver" })],
  ["upper", false, "D01 to D03 lunging", () => swing("upper", "face", { addr: "D01", top: "D03", imp: "D03", fin: "D03", club: "driver", group: "driver" })],
  ["flip", true, "A10 one line", () => swing("flip", "face", { addr: "A01", top: "A06", imp: "A10", fin: "A16" })],
  ["flip", false, "C09 wrists flipped", () => swing("flip", "face", { addr: "A01", top: "A06", imp: "C09", fin: "A16" })],
  ["vshape", true, "H01 H03 H04 V kept", () => swing("vshape", "face", { addr: "H01", back: "H03", imp: "H01", through: "H04", club: "SW", group: "chip" }), "not measured: the wrists and the club are not visible to the pose model"],
  ["vshape", false, "H07 broken V", () => swing("vshape", "face", { addr: "H01", back: "H03", imp: "H01", through: "H07", club: "SW", group: "chip" }), "not measured: the wrists and the club are not visible to the pose model"],
  ["pendulum", true, "H03 back, H04 through", () => swing("pendulum", "face", { addr: "H01", back: "H03", imp: "H01", through: "H04", club: "SW", group: "chip" })],
  ["pendulum", false, "H05 long back, H06 short through", () => swing("pendulum", "face", { addr: "H01", back: "H05", imp: "H01", through: "H06", club: "SW", group: "chip" })],
  ["headstill", true, "I01 I02 I03 head still", () => swing("headstill", "face", { addr: "I01", back: "I02", imp: "I01", through: "I03", club: "PT", group: "putt" })],
  ["headstill", false, "I04 head turns", () => swing("headstill", "face", { addr: "I01", back: "I02", imp: "I01", through: "I04", club: "PT", group: "putt" })],
];

const KEYM = { stance: "stanceRatio", chipstance: "stanceRatio", ballpos: "ballPosErr", weightset: "addrWeight", tilt: "leadShHigher", handsahead: "handsAhead", hinge: "hingeDeg",
  knees: "kneeDeg", reach: "reach", forearms: "forearmGap", heels: "shoulderOverFeet", eyesover: "eyesOver", arms: "shoulderTurn", sway: "sway", posture: "headRise",
  stayleft: "impWeight", transfer: "transfer", feet: "feetMoved", upper: "upperAhead", flip: "wristFlip", vshape: "vChange", pendulum: "pendulum", headstill: "headMove" };
let right = 0, testable = 0; const wrong = [], limits = [], byRule = {};
for (const [rule, want, label, run, limit] of CASES) {
  let r; try { r = run(); } catch (e) { r = { pass: null, m: {}, err: e.message }; }
  const ok = r.pass === want, val = `${KEYM[rule]} = ${r.m[KEYM[rule]]}`;
  if (limit) limits.push(`${rule}: ${label}, ${ok ? "right anyway" : "not caught"} (${val}). ${limit}`);
  else { testable++; if (ok) right++; else wrong.push(`${rule}: ${label} (expected ${want ? "pass" : "fail"}, got ${r.pass}${r.err ? " " + r.err : ""}, ${val})`); }
  (byRule[rule] ??= [0, 0])[ok ? 0 : 1]++;
  if (VERBOSE) console.log(`${limit ? "lim " : ok ? "ok  " : "MISS"} ${rule.padEnd(10)} ${label.padEnd(36)} ${val}`);
}
console.log(`Photo exam (${MODEL} model): ${right} of ${testable} testable cases right; ${limits.length} known limits`);
for (const w of wrong) console.log("  MISS " + w);
if (VERBOSE) for (const l of limits) console.log("  LIMIT " + l);
export const result = { right, testable, wrong, limits };
if (process.argv.includes("--strict") && wrong.length) process.exit(1);
