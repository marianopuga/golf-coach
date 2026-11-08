// Todo lo que dice el coach de casa, en un solo lugar. La voz grabada se genera desde aquí
// (tools/casa-catalog.mjs y tools/record_voice_es.py), así lo que suena y lo que se graba coinciden.

// Separa en frases y crea la llave de cada frase (la misma en el reproductor y en la grabadora).
export function sentences(text) {
  const list = Array.isArray(text) ? text : [text];
  return list
    .flatMap((t) => String(t || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9])/))
    .map((s) => s.trim())
    .filter(Boolean);
}
export const keyOf = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Números dichos en frases cortas (pocas variantes, para poder grabarlas todas).
export const cm = (v) => {
  const n = Math.min(60, Math.round(Math.abs(v)));
  return n === 0 ? "Menos de un centímetro." : n === 1 ? "Un centímetro." : `${n} centímetros.`;
};
export const grados = (v) => {
  let n = Math.round(Math.abs(v));
  if (n > 30) n = Math.round(n / 5) * 5;
  n = Math.min(n, 150);
  return n === 1 ? "Un grado." : `${n} grados.`;
};
export const count = (n) => (n === 1 ? "Llevas un swing." : `Llevas ${n} swings.`);
export const streak = (n) => `Van ${n} seguidos sin correcciones.`;
export const swingsLeft = (n) => (n === 1 ? "Te falta un swing para tu primera meta." : `Te faltan ${n} swings para tu primera meta.`);

// Etapas del plan escalonado (el foco avanza solo cuando dominas la etapa).
export const STAGE_NAMES = ["cabeza quieta", "cadera sin deslizar", "cadera primero", "torsión", "todo junto"];
export const stageNow = (i) => `Foco: ${STAGE_NAMES[i]}.`;
export const stageUp = (i) => [`Dominaste ${STAGE_NAMES[i]}.`, `Siguiente foco: ${STAGE_NAMES[i + 1]}.`];

// Cada medición: cómo se nombra, qué se dice si está bien o mal, cómo corregirla y la idea de Hogan detrás.
// bad(v) y fix(v) devuelven siempre una de pocas frases fijas, para poder grabarlas.
export const M = {
  headLat: {
    label: "Cabeza de lado", name: "la cabeza",
    good: "Bien la cabeza.",
    bad: (v) => (v > 0 ? "La cabeza se fue hacia atrás." : "La cabeza se adelantó antes del impacto."),
    fix: (v) => (v > 0 ? "Gira sobre tu eje, con la rodilla derecha firme." : "Quédate detrás de la pelota hasta el impacto."),
    why: "Idea de Hogan, lecciones dos y tres: la rodilla derecha queda flectada y apuntando un poco hacia adentro durante la subida. Ese apoyo frena el deslizamiento y te obliga a girar sobre un eje fijo.",
  },
  headVert: {
    label: "Cabeza arriba o abajo", name: "la altura de la cabeza",
    good: "Bien la altura.",
    bad: (v) => (v > 0 ? "Bajaste la cabeza." : "Te levantaste."),
    fix: () => "Mantén la flexión de rodillas y la inclinación hasta pasar el impacto.",
    why: "Idea de Hogan, lección dos: la postura del address se mantiene durante todo el swing. Si cambias la altura, cambia el punto más bajo del palo.",
  },
  hipSway: {
    label: "Cadera en la subida", name: "la cadera",
    good: "Bien la cadera, sin deslizar.",
    bad: (v) => (v > 0 ? "La cadera se deslizó hacia atrás." : "La cadera se fue hacia el objetivo en la subida."),
    fix: (v) => (v > 0 ? "Gírala, no la empujes. Siente el peso dentro del pie derecho." : "Deja el peso sobre el pie derecho en la subida."),
    why: "Idea de Hogan, lección tres: los hombros giran y arrastran a la cadera, que gira menos y resiste. La cadera gira en su lugar, no se desliza hacia atrás.",
  },
  hipShift: {
    label: "Peso al impacto", name: "el traspaso de peso",
    good: "Buen traspaso de peso.",
    bad: () => "Al impacto el peso quedó atrás.",
    fix: () => "Empieza la bajada girando la cadera hacia el objetivo.",
    why: "Idea de Hogan, lección cuatro: la bajada empieza girando la cadera hacia la izquierda. Ese giro lleva el peso al pie izquierdo antes del impacto.",
  },
  seq: {
    label: "Cadera inicia la bajada", name: "la secuencia",
    good: "La cadera inició la bajada.",
    bad: (v) => (v < -40 ? "Bajaste con los brazos primero." : "Hombros y cadera bajaron juntos."),
    fix: () => "Primero gira la cadera, después todo lo demás.",
    why: "Idea de Hogan, lección cuatro: la cadera inicia la bajada y los hombros, brazos y palo la siguen. Si bajan los brazos primero, pegas con los brazos y pierdes potencia.",
  },
  sep: {
    label: "Torsión (hombros menos cadera)", name: "la torsión",
    good: "Buena torsión.",
    bad: () => "Cadera y hombros giran juntos.",
    fix: () => "Que la cadera resista y los hombros giren más.",
    why: "Idea de Hogan, lección tres: en la subida los hombros giran más que la cadera. Esa diferencia estira el tronco como un resorte y es la potencia que después suelta la cadera.",
  },
  shTurn: {
    label: "Giro de hombros", name: "el giro de hombros",
    good: "Buen giro de hombros.",
    bad: () => "Giro de hombros corto.",
    fix: () => "Lleva la espalda hacia el objetivo.",
    why: "Idea de Hogan, lección tres: los hombros giran hasta que la espalda mira al objetivo, mientras la cadera resiste.",
  },
  finishW: {
    label: "Peso al final", name: "el final",
    good: "Buen final sobre el pie izquierdo.",
    bad: () => "Terminaste con el peso atrás.",
    fix: () => "Termina con el peso en el pie izquierdo y el pecho mirando al objetivo.",
    why: "Idea de Hogan: un swing completo termina en equilibrio sobre el pie izquierdo, con el cuerpo de frente al objetivo.",
  },
  hold: {
    label: "Final sostenido", name: "el equilibrio",
    good: "Final sostenido.",
    bad: () => "No sostuviste el final.",
    fix: () => "Sostén el final dos segundos.",
    why: "Si no puedes sostener el final, algo te sacó de equilibrio durante el swing. Sostenerlo dos segundos es la prueba.",
  },
  headFwd: {
    label: "Cabeza: distancia a la pelota", name: "la distancia a la pelota",
    good: "Bien la distancia a la pelota.",
    bad: (v) => (v > 0 ? "La cabeza se acercó a la pelota." : "La cabeza se alejó de la pelota."),
    fix: () => "Mantén la misma distancia a la pelota.",
    why: "Desde atrás se ve si la cabeza se acerca o se aleja de la pelota. Si se mueve, el palo llega a otro lugar.",
  },
  earlyExt: {
    label: "Cadera hacia la pelota", name: "la cadera hacia la pelota",
    good: "La cadera se mantuvo atrás.",
    bad: () => "La cadera se fue hacia la pelota.",
    fix: () => "En la bajada gira la cadera sin empujarla hacia la pelota.",
    why: "Es la falla que los coaches llaman extensión temprana: la cadera se acerca a la pelota en la bajada y el cuerpo se endereza. La cadera debe girar, no avanzar.",
  },
  spineLoss: {
    label: "Inclinación de la columna", name: "la inclinación",
    good: "Mantuviste la inclinación.",
    bad: (v) => (v > 0 ? "Te enderezaste antes del impacto." : "Te agachaste más en la bajada."),
    fix: () => "Mantén la inclinación de la columna hasta después del impacto.",
    why: "Idea de Hogan, lección dos: la inclinación desde la cadera que tomas en el address se mantiene hasta después del impacto.",
  },
  tempo: { label: "Tempo (subida : bajada)", name: "el tempo" },
};
// Cómo se dice un tramo de mejora o empeoramiento de cada medición.
export const trendLine = (k, dir) => {
  const n = M[k].name;
  return dir === "mejorando" ? `Mejoró ${n}.` : dir === "empeorando" ? `Empeoró ${n}.` : `${cap(n)} está estable.`;
};
export const metaLine = (k) => `Nueva meta para ${M[k].name}.`;
export const logroLine = (k) => `Lograste tu meta con ${M[k].name}.`;
export const ojoLine = (k) => `Ojo con ${M[k].name}.`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const L = {
  hello: "Te veo. Ponte en posición de address y quédate quieto un segundo.",
  ready: ["Listo, cuando quieras.", "Cuando quieras.", "Bien. Swing lento.", "Perfecto, otro más."],
  firstReady: "Ahí está. Haz el swing lento, al cincuenta por ciento.",
  areYouReady: ["¿Estás listo? Dale cuando quieras.", "¿Vamos? Swing lento."],
  backToAddress: "Cuando quieras, vuelve a la posición de address.",
  lost: "Te perdí de vista. Vuelve frente a la cámara.",
  notCounted: "Ese swing no lo cuento.",
  why: {
    fps: "La cámara iba muy lenta.",
    out: "Te saliste del cuadro.",
    vis: "No te vi bien. Revisa la luz.",
    fast: "Fue muy rápido para la cámara. Hazlo más lento.",
    aborted: "No terminaste el swing.",
    tooSlow: "Fue tan lento que no lo detecté entero.",
  },
  fixIntro: "Corrige esto.",
  allGood: "Todo bien en este swing.",
  paused: "En pausa.",
  resumed: "Seguimos. Ponte en posición.",
  tagGood: "Anotado, se sintió bien.",
  tagBad: "Anotado, se sintió mal.",
  feltGoodBut: "Lo sentiste bien, pero la cámara dice otra cosa.",
  disputeAck: "Lo anoto. Si pasa de nuevo, ajusto esa medida a ti.",
  disputeTuned: "Listo, ajusté esa medida a ti.",
  disputeNone: "No hay corrección que ajustar.",
  explainNone: "Todavía no te he corregido nada.",
  desarme: "Ojo, te estás desarmando.",
  masConsistente: "Estás más consistente.",
  menosConsistente: "Estás menos consistente.",
  learning: "Estoy aprendiendo cómo te mueves.",
  linked: "La segunda cámara está conectada.",
  unlinked: "Se desconectó la segunda cámara.",
  partnerBlind: "La otra cámara no te ve.",
  sameView: "Las dos cámaras están de frente. Pon una desde atrás.",
  heard: "Te escucho.",
  unknown: "No entendí. Di ok y el comando.",
  focusAuto: "Foco automático.",
  noInsights: "Todavía no tengo suficientes swings marcados como bien o mal.",
  voiceTest: "Hola Mariano. Así sueno. Cabeza quieta y la cadera inicia la bajada.",
};

// Mensajes de encuadre (se muestran y se dicen antes del swing).
export const FRAME = {
  nobody: "No te veo. Ponte frente a la cámara.",
  noHips: "No veo tu cadera. Aleja la cámara o apúntala más abajo.",
  noHead: "No veo tu cabeza. Aleja la cámara o apúntala más arriba.",
  noShoulders: "No veo tus dos hombros. Centra la cámara en tu cuerpo.",
  noHands: "No veo tus manos. Aleja un poco la cámara.",
  headroom: "Deja espacio sobre tu cabeza para las manos. Inclina la cámara un poco hacia arriba.",
  tooFar: "Estás muy lejos. Acerca la cámara.",
  looksDtl: "Esto parece una vista desde atrás. Cambia el ángulo a desde atrás o pon la cámara al frente.",
  looksFace: "Esto parece una vista de frente. Cambia el ángulo a de frente o pon la cámara detrás.",
  ok: "Encuadre bien.",
};

// Todas las frases que el coach puede decir, para grabarlas con la voz neuronal.
export function catalog() {
  const set = new Map();
  const add = (t, hot = false) => { for (const s of sentences(t)) { const k = keyOf(s); if (k && !set.has(k)) set.set(k, { text: s, hot }); } };
  const each = (v, hot) => (Array.isArray(v) ? v.forEach((x) => each(x, hot)) : v && typeof v === "object" ? Object.values(v).forEach((x) => each(x, hot)) : typeof v === "string" ? add(v, hot) : null);
  each(L, true); each(FRAME, true);
  for (const k of Object.keys(M)) {
    const d = M[k];
    if (!d.good) continue;
    add(d.good, true);
    for (const v of [5, -5, -60]) { add(d.bad(v), true); add(d.fix(v), true); }
    add(d.why); add(metaLine(k)); add(logroLine(k)); add(ojoLine(k), true);
    for (const dir of ["mejorando", "empeorando", "estable"]) add(trendLine(k, dir));
  }
  for (let n = 0; n <= 60; n++) add(cm(n), n <= 20);
  for (let n = 0; n <= 150; n++) add(grados(n));
  for (let n = 1; n <= 120; n++) add(count(n));
  for (let n = 3; n <= 40; n++) add(streak(n));
  for (let n = 1; n <= 5; n++) add(swingsLeft(n));
  STAGE_NAMES.forEach((_, i) => { add(stageNow(i), true); if (i < STAGE_NAMES.length - 1) add(stageUp(i)); });
  return set;
}
