// How the coach learns from you and picks the swings to show you. Run: node test/learning.test.mjs
import { emptyCoachState, dispute, tuneOffset, tuneSummary, runChecks, bestWorst, swingScore, mainFault, ruleById } from "../engine.js";
let fails = 0;
const ok = (name, cond, info = "") => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " " + info}`); if (!cond) fails++; };

// ---- Learning from "that's wrong" ----
const st = emptyCoachState();
const stanceFail = (m, tune) => runChecks(m, "iron", "face", { kind: "setup", tune }).find((c) => c.id === "stance").pass;
ok("a wide stance fails before any correction", stanceFail({ stanceRatio: 1.86 }, st.tune) === false);
dispute(st, "stance", { stanceRatio: 1.86 }, "iron");
ok("one correction does not change the check yet", tuneOffset(st.tune, "stance") === 0 && stanceFail({ stanceRatio: 1.86 }, st.tune) === false);
dispute(st, "stance", { stanceRatio: 1.9 }, "iron");
ok("two corrections move the check toward you", stanceFail({ stanceRatio: 1.86 }, st.tune) === true, JSON.stringify(st.tune));
ok("the move never passes the tolerance", Math.abs(tuneOffset(st.tune, "stance")) <= ruleById("stance").tol);
for (let i = 0; i < 6; i++) dispute(st, "stance", { stanceRatio: 3.5 }, "iron");
ok("far away corrections cannot drag the check past its limit", stanceFail({ stanceRatio: 2.3 }, st.tune) === false && Math.abs(tuneOffset(st.tune, "stance")) <= ruleById("stance").tol);
ok("the summary lists what adapted", tuneSummary(st).some((t) => t.id === "stance"));
const st2 = emptyCoachState();
dispute(st2, "sway", { sway: 0.25 }, "iron"); dispute(st2, "sway", { sway: 0.24 }, "iron");
ok("a swing check adapts the same way", runChecks({ sway: 0.24 }, "iron", "face", { kind: "motion", tune: st2.tune }).find((c) => c.id === "sway").pass === true);
ok("other checks are untouched", tuneOffset(st2.tune, "stance") === 0);

// ---- Best and worst swing per club and camera side ----
const sw = (id, club, view, result, fails = [], sev = 2) => ({ id, t: id.charCodeAt(0), clubId: club === "driver" ? "driver" : "7i", club, view,
  res: result ? { result, sev } : null, checks: ["sway", "arms", "posture"].map((r) => ({ id: r, pass: !fails.includes(r) })), setup: { checks: [] } });
const list = [sw("a", "iron", "face", "straight"), sw("b", "iron", "face", "slice", ["sway"], 3), sw("c", "iron", "face", "straight", ["arms"]),
  sw("d", "driver", "dtl", "hook", ["posture"]), sw("e", "driver", "dtl", "straight"), { ...sw("f", "iron", "face", "straight"), practice: "auto" }];
const bw = bestWorst(list);
const iron = bw.find((b) => b.key === "iron|face"), drv = bw.find((b) => b.key === "driver|dtl");
ok("one group per club and camera side", bw.length === 2 && !!iron && !!drv);
ok("best iron is the straight one with no fault", iron.best.id === "a");
ok("worst iron is the big slice with a sway", iron.worst.id === "b");
ok("practice swings are left out", iron.n === 3);
ok("driver best and worst", drv.best.id === "e" && drv.worst.id === "d");
ok("score: a straight clean swing beats a straight swing with a fault", swingScore(list[0]) > swingScore(list[2]));
ok("the worst swing's main fault is its swing fault", mainFault(iron.worst) === "sway");
ok("a single swing has a best but no worst", bestWorst([list[0]])[0].worst === null);

console.log(fails ? `${fails} failed` : "All learning tests passed");
process.exit(fails ? 1 : 0);
