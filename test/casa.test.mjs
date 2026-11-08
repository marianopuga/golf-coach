// Pruebas del coach de casa con swings simulados (node test/casa.test.mjs).
// El golfista se simula en un living: se ve de la cabeza a las rodillas, los pies quedan fuera del cuadro.
import assert from "node:assert/strict";
import * as C from "../casa/core.js?v=3";
import { catalog, keyOf, sentences } from "../casa/lines.js?v=3";

import { W, H, faceSwing, dtlSwing } from "./casa-sim.mjs";

function run(seq, view = "face", prof = C.newProfile()) {
  const det = new C.SwingDetector(), sm = new C.Smoother(), events = [];
  let swing = null;
  for (const fr of seq) {
    const f = sm.push(C.features(fr.lm, W, H, fr.wl), fr.t);
    const ev = det.push(fr.t, f);
    if (ev) { events.push(ev.type); if (ev.type === "swing") swing = ev; if (ev.type === "discard") events.push(ev.why); }
  }
  const r = swing ? C.analyze(swing, view, prof) : null;
  return { events, swing, r, rec: r ? C.makeRecord([r], prof) : null };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const near = (v, x, tol, msg) => assert.ok(v != null && Math.abs(v - x) <= tol, `${msg}: ${v} no está cerca de ${x} (±${tol})`);

test("encuadre: sin pies ni tobillos igual sirve", () => {
  const f = C.features(faceSwing()[0].lm, W, H);
  assert.equal(f.ok, true); assert.equal(C.frameHint(f, "face"), null);
});
test("encuadre: sin cadera pide alejar la cámara", () => {
  const lm = faceSwing()[0].lm; lm[23].y = 1.1; lm[24].y = 1.1;
  const f = C.features(lm, W, H);
  assert.equal(f.ok, false); assert.match(C.frameHint(f, "face"), /cadera/);
});
test("de frente: swing quieto, cadera primero", () => {
  const { events, r, rec } = run(faceSwing());
  assert.deepEqual(events.slice(0, 3), ["ready", "started", "swing"]);
  assert.equal(r.q.base, true);
  near(r.m.headLat, 0, 1.5, "cabeza lateral"); near(r.m.hipSway, 0, 1.5, "cadera en la subida"); near(r.m.hipShift, 6.1, 2, "peso al impacto");
  assert.ok(r.m.seq >= 15, `secuencia ${r.m.seq}`); near(r.m.shTurn, 85, 6, "giro de hombros"); near(r.m.sep, 45, 8, "torsión");
  assert.equal(r.m.hold, 1);
  assert.equal(rec.st.headLat, "ok"); assert.equal(rec.st.seq, "ok"); assert.equal(rec.counted, true);
});
test("de frente: cabeza y cadera que se deslizan", () => {
  const { r, rec } = run(faceSwing({ headBack: 0.04, hipBack: 0.03 }));
  near(r.m.headLat, 12.2, 1.5, "cabeza hacia atrás"); near(r.m.hipSway, 9.2, 1.5, "deslizamiento de cadera");
  assert.equal(rec.st.headLat, "corregir"); assert.equal(rec.st.hipSway, "ojo");
  const c = C.coachSwing(rec, [], C.newProfile());
  assert.equal(c.main, "headLat"); // muy claro: se corrige aunque sea el primero
  assert.ok(c.lines.includes("La cabeza se fue hacia atrás.")); assert.ok(c.lines.includes("12 centímetros.") || c.lines.includes("13 centímetros.") || c.lines.includes("11 centímetros."));
});
test("de frente: brazos primero en la bajada", () => {
  const { r, rec } = run(faceSwing({ seqLead: -80 }));
  assert.ok(r.m.seq <= -40, `secuencia ${r.m.seq}`); assert.equal(rec.st.seq, "corregir");
});
test("fuera del foco: aviso corto, sin corrección principal", () => {
  const { rec } = run(faceSwing({ seqLead: -80 }));
  const c = C.coachSwing(rec, [], C.newProfile());
  assert.equal(c.main, null); assert.equal(c.soft, "seq"); assert.ok(c.lines.includes("Ojo con la secuencia."));
});
test("de frente: cabeza que baja", () => {
  const { r } = run(faceSwing({ headDown: 0.03 }));
  near(r.m.headVert, 0.03 * 480 * (37 / 77.4), 1.5, "cabeza abajo");
});
test("final que no se sostiene", () => {
  const { r } = run(faceSwing({ finishMove: true, hold: 2600 }));
  assert.equal(r.m.hold, 0);
});
test("swing que no se termina no se cuenta", () => {
  const { events } = run(faceSwing({ abort: true }));
  assert.ok(events.includes("aborted"), events.join(","));
});
test("cámara lenta (10 cuadros por segundo): no se cuenta", () => {
  const { r, rec } = run(faceSwing({ fps: 10 }));
  assert.ok(r, "debería detectar el swing"); assert.equal(r.q.base, false); assert.equal(rec.counted, false); assert.equal(rec.reason, "fps");
  const c = C.coachSwing(rec, [], C.newProfile());
  assert.deepEqual(c.lines, ["Ese swing no lo cuento.", "La cámara iba muy lenta."]);
});
test("desde atrás: swing bueno", () => {
  const { r, rec } = run(dtlSwing(), "dtl");
  assert.ok(r, "detecta el swing desde atrás"); near(r.m.earlyExt, 0, 1, "cadera hacia la pelota"); near(r.m.spineLoss, 0, 1.5, "inclinación");
  near(r.m.headFwd, 0, 1, "cabeza"); assert.equal(rec.st.earlyExt, "ok");
});
test("desde atrás: extensión temprana y te enderezas", () => {
  const { r, rec } = run(dtlSwing({ ext: 0.03, stand: 0.06 }), "dtl");
  assert.ok(r.m.earlyExt > 6, `extensión ${r.m.earlyExt}`); assert.ok(r.m.spineLoss > 5, `inclinación ${r.m.spineLoss}`);
  assert.equal(rec.st.earlyExt, "corregir");
});
test("dos cámaras: un registro con las dos vistas", () => {
  const a = run(faceSwing({ headBack: 0.02 })).r, b = run(dtlSwing({ ext: 0.03 }), "dtl").r;
  const rec = C.makeRecord([a, b], C.newProfile());
  assert.deepEqual(rec.views, ["face", "dtl"]); assert.ok("earlyExt" in rec.m && "headLat" in rec.m && "seq" in rec.m);
  assert.equal(rec.m.headVert, a.m.headVert); // de frente manda cuando las dos miden lo mismo
});
test("emparejar por hora de impacto", () => {
  assert.equal(C.pairIndex([{ impEpoch: 1000 }, { impEpoch: 5000 }], 5400), 1);
  assert.equal(C.pairIndex([{ impEpoch: 1000 }], 3000), -1);
});

// ---- Perfil personal ----
const fake = (m, view = "face") => ({ view, m, qm: Object.fromEntries(Object.keys(m).map((k) => [k, true])), reason: null });
test("corrección solo si se repite (o es muy clara)", () => {
  const prof = C.newProfile(), hist = [];
  const r1 = C.makeRecord([fake({ headLat: 8.5 })], prof);
  const c1 = C.coachSwing(r1, hist, prof);
  assert.equal(c1.main, null); assert.equal(c1.soft, "headLat");
  hist.push(r1);
  const r2 = C.makeRecord([fake({ headLat: 8.6 })], prof);
  assert.equal(C.coachSwing(r2, hist, prof).main, "headLat");
});
test("ruido de medición sube el piso", () => {
  const prof = C.newProfile(); prof.noise.head = 2.4;
  assert.equal(C.statusOf("headLat", 5.5, prof), "ok");
  assert.equal(C.statusOf("headLat", 5.5, C.newProfile()), "ojo");
});
test("metas progresivas: se crean y se ajustan", () => {
  const prof = C.newProfile(), hist = [];
  for (const v of [10, 9, 11, 10, 9]) hist.push(C.makeRecord([fake({ headLat: v })], prof));
  let ch = C.updateTargets(prof, hist);
  assert.deepEqual(ch.map((c) => c.kind), ["new"]);
  const t0 = C.targetValue("headLat", prof); near(t0, 9.5, 0.6, "meta inicial");
  for (const v of [8, 8.5, 7.5, 8, 8, 9]) hist.push(C.makeRecord([fake({ headLat: v })], prof));
  ch = C.updateTargets(prof, hist);
  assert.equal(ch[0]?.kind, "tighter"); assert.ok(C.targetValue("headLat", prof) < t0);
});
test("tendencia y consistencia", () => {
  const prof = C.newProfile(), hist = [];
  for (const v of [10, 9, 11, 10, 9.5, 6, 5.5, 6, 5, 5.8]) hist.push(C.makeRecord([fake({ headLat: v })], prof));
  const t = C.trendOf(hist, "headLat");
  assert.equal(t.dir, "mejorando"); near(t.from, 10, 0.5, "antes"); near(t.to, 5.8, 0.5, "ahora");
});
test("desarme: mejora el foco pero empeora otra cosa", () => {
  const prof = C.newProfile(), hist = [];
  const hl = [10, 9, 11, 10, 9.5, 6, 5.5, 6, 5, 5.8], hs = [3, 2, 3, 2.5, 3, 8, 9, 8.5, 9, 8];
  for (let i = 0; i < 10; i++) hist.push(C.makeRecord([fake({ headLat: hl[i], hipSway: hs[i] })], prof));
  const s = C.summaryLines(hist, hist, prof);
  assert.ok(s.lines.includes("Mejoró la cabeza.")); assert.ok(s.lines.includes("Ojo, te estás desarmando.")); assert.ok(s.lines.includes("Empeoró la cadera."));
});
test("'eso está mal' dos veces ajusta la medición", () => {
  const prof = C.newProfile();
  const rec = C.makeRecord([fake({ headLat: 6 })], prof); rec.main = "headLat";
  assert.equal(C.dispute(prof, rec).pending, true);
  const res = C.dispute(prof, rec);
  assert.equal(res.pending, false); near(prof.tune.headLat, 1, 0.01, "ajuste");
  assert.equal(C.statusOf("headLat", 6, prof), "ok");
});
test("sensación contra realidad", () => {
  const prof = C.newProfile(), hist = [];
  for (const v of [4, 5, 4.5]) { const r = C.makeRecord([fake({ headLat: v })], prof); r.tag = "good"; hist.push(r); }
  for (const v of [9, 10, 8.5]) { const r = C.makeRecord([fake({ headLat: v })], prof); r.tag = "bad"; hist.push(r); }
  const fi = C.feelInsights(hist);
  assert.equal(fi[0].k, "headLat"); near(fi[0].good, 4.5, 0.01, "bien"); near(fi[0].bad, 9, 0.01, "mal");
});
test("plan escalonado: avanza al dominar la etapa", () => {
  const prof = C.newProfile(), hist = [];
  for (let i = 0; i < 6; i++) hist.push(C.makeRecord([fake({ headLat: i === 2 ? 6 : 2, headVert: 1 })], prof));
  const s = C.checkStage(prof, hist);
  assert.equal(s.from, 0); assert.equal(prof.stage, 1); assert.deepEqual(s.lines, ["Dominaste cabeza quieta.", "Siguiente foco: cadera sin deslizar."]);
});
test("plan escalonado: salta una etapa que esta cámara no puede medir", () => {
  const prof = C.newProfile(); prof.stage = 2; const hist = [];
  for (let i = 0; i < 6; i++) hist.push(C.makeRecord([fake({ earlyExt: 1, headFwd: 1 }, "dtl")], prof));
  const s = C.checkStage(prof, hist);
  assert.equal(s.skipped, true); assert.equal(prof.stage, 3);
});
test("comandos de voz con 'ok'", () => {
  assert.equal(C.parseCommand("hola cómo estás"), null);
  assert.deepEqual(C.parseCommand("Ok, pausa"), { cmd: "pause" });
  assert.deepEqual(C.parseCommand("okay sigue"), { cmd: "resume" });
  assert.deepEqual(C.parseCommand("O.K. repite"), { cmd: "repeat" });
  assert.deepEqual(C.parseCommand("ok"), { cmd: "hey" });
  assert.equal(C.parseCommand("ok vamos a ver qué pasa").cmd, "unknown"); // conversación: no hace nada
  assert.equal(C.parseCommand("ok bien, y después").cmd, "unknown"); // "ok bien" suelto no marca el swing
  assert.equal(C.parseCommand("ok para la próxima").cmd, "unknown"); // "para" no es pausa
  assert.equal(C.parseCommand("ok y después almorzamos").cmd, "unknown"); // conversación: no hace nada
  assert.deepEqual(C.parseCommand("ok eso está mal"), { cmd: "dispute" });
  assert.deepEqual(C.parseCommand("ok ese estuvo bien"), { cmd: "tag", tag: "good" });
  assert.deepEqual(C.parseCommand("ok se sintió mal"), { cmd: "tag", tag: "bad" });
  assert.deepEqual(C.parseCommand("ok cómo voy"), { cmd: "summary" });
  assert.deepEqual(C.parseCommand("ok foco cadera"), { cmd: "focus", stage: 1 });
  assert.deepEqual(C.parseCommand("profe pausa"), { cmd: "pause" });
  assert.equal(C.parseCommand("tocar el piano"), null); // "ok" dentro de otra palabra no cuenta
});
test("todas las frases que se dicen están en el catálogo de la voz grabada", () => {
  const cat = catalog(), prof = C.newProfile(), missing = new Set();
  const check = (lines) => { for (const s of sentences(lines)) if (!cat.has(keyOf(s))) missing.add(s); };
  for (const sc of [{}, { headBack: 0.04, hipBack: 0.03 }, { seqLead: -80 }, { headDown: 0.03 }, { fps: 10 }]) {
    const { rec } = run(faceSwing(sc));
    if (rec) check(C.coachSwing(rec, [], prof).lines);
  }
  const hist = [];
  for (let i = 0; i < 10; i++) hist.push(C.makeRecord([fake({ headLat: [10, 9, 11, 10, 9.5, 6, 5.5, 6, 5, 5.8][i], hipSway: [3, 2, 3, 2.5, 3, 8, 9, 8.5, 9, 8][i] })], prof));
  check(C.summaryLines(hist, hist, prof).lines);
  assert.deepEqual([...missing], []);
});
test("reporte para Claude", () => {
  const prof = C.newProfile(), hist = [];
  for (const v of [10, 9, 11, 10, 9]) hist.push(C.makeRecord([fake({ headLat: v })], prof));
  const t = C.reportText(hist, prof);
  assert.match(t, /Cabeza de lado: mediana últimos 10 10 cm/);
});

let fail = 0;
for (const t of tests) {
  try { t.fn(); console.log("ok  ", t.name); }
  catch (e) { fail++; console.log("FALLA", t.name, "\n     ", e.message); }
}
console.log(`\n${tests.length - fail} de ${tests.length} pruebas bien`);
process.exit(fail ? 1 : 0);
