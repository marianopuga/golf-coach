// Turns what you say into commands and shot results. Pure functions, tested in Node.
// Built around your own words from the questionnaire: English golf words, Spanish directions,
// "big" or "hard" for bad, "a bit" or "small" for a little, and distances from the tracer.

const strip = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (t, re) => re.test(" " + t + " ");
const W = (words) => new RegExp(" (" + words.join("|") + ") ");

const CMD = [
  ["hush", W(["stop talking", "stop", "be quiet", "quiet", "silence", "shh", "shush", "enough", "callate", "silencio", "para de hablar"])],
  ["focus", W(["what is my focus", "whats my focus", "my focus", "what should i work on", "what am i working on", "what do i work on", "en que me enfoco", "cual es mi foco"])],
  ["pause", W(["pause", "paws", "pours", "pausa", "hold on", "wait", "espera", "hang on"])],
  ["resume", W(["resume", "continue", "continua", "sigue", "seguimos", "go on", "lets go", "vamos de nuevo", "unpause"])],
  ["practice", W(["practice", "practise", "practica", "no ball", "sin pelota", "ignore that", "ignora"])],
  ["wrong", W(["wrong", "incorrect", "mal dicho", "eso no", "no es cierto", "error", "not right"])],
  ["skip", W(["skip", "salta", "otro foco", "change focus", "new focus"])],
  ["explain", W(["explain", "explica", "explicame", "why", "por que", "tell me more"])],
  ["repeat", W(["repeat", "repite", "say again", "otra vez", "que dijiste", "what did you say"])],
  ["next", W(["next block", "next", "siguiente", "move on"])],
  ["status", W(["status", "how many", "balls left", "cuantas quedan", "cuanto queda", "time left", "how am i doing", "como voy", "whats next", "what now", "que sigue", "where am i"])],
];

// Contact first, then shape, then plain direction.
const CONTACT = [
  ["shank", W(["shank", "shanked", "shanks", "socket"])],
  ["sky", W(["sky", "skied", "skyed", "pop up", "popped up", "globo"])],
  ["top", W(["top", "topped", "tops", "por arriba", "arriba", "topeada", "topee"])],
  ["thin", W(["thin", "thinned", "skull", "skulled", "delgada", "fina"])],
  ["fat", W(["fat", "chunk", "chunked", "heavy", "duff", "gorda", "pesada"])],
];
const SHAPE = [
  ["slice", W(["slice", "sliced", "slices", "slais", "slide", "fade", "faded"])],
  ["hook", W(["hook", "hooked", "hooks", "juk", "huck", "draw", "drew"])],
  ["push", W(["push", "pushed", "bush"])],
  ["pull", W(["pull", "pulled", "pool"])],
];
const RIGHT = W(["right", "derecha", "a la derecha"]);
const LEFT = W(["left", "izquierda", "a la izquierda"]);
const STRAIGHT = W(["straight", "strait", "recta", "recto", "derecho", "derechito", "perfect", "perfecto", "pure", "flush", "flushed", "great shot", "good shot", "buenisimo", "buena"]);
const SHORT = W(["short", "corta", "corto", "corti"]);
const BIG = W(["big", "hard", "huge", "very", "massive", "terrible", "muy", "mucho", "muchisimo", "fuerte", "horrible"]);
const SMALL = W(["a bit", "bit", "small", "little", "slight", "slightly", "un poco", "poquito", "leve", "suave"]);
const STRIKE = [["center", W(["center", "centre", "centro", "middle"])], ["toe", W(["toe", "punta"])], ["heel", W(["heel", "talon"])]];

// ---------------- Numbers (metres) ----------------
const EN = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ES = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300 };
function wordsToNumber(tokens) {
  // returns the first plausible distance (5 to 350) found in the token list
  let best = null;
  for (let i = 0; i < tokens.length && best == null; i++) {
    const t = tokens[i];
    if (/^\d{1,3}$/.test(t)) { const n = Number(t); if (n >= 5 && n <= 350) best = n; continue; }
    // English: "one forty", "a hundred and forty", "two hundred", "ninety five"
    if (EN[t] != null || t === "hundred" || (t === "a" && tokens[i + 1] === "hundred")) {
      let j = i, total = 0, cur = 0, used = false, hund = false;
      if (t === "a") { j++; }
      for (; j < tokens.length; j++) {
        const w = tokens[j];
        if (w === "and") continue;
        if (w === "hundred") { cur = (cur || 1) * 100; used = true; hund = true; continue; }
        if (EN[w] != null) {
          const v = EN[w];
          // "one forty": a single digit followed by tens means hundreds
          if (cur > 0 && cur < 10 && v >= 10 && !hund) { cur = cur * 100 + v; used = true; hund = true; continue; }
          cur += v; used = true; continue;
        }
        break;
      }
      total += cur;
      if (used && total >= 5 && total <= 350) best = total;
      continue;
    }
    if (ES[t] != null) {
      let j = i, cur = 0;
      for (; j < tokens.length; j++) { const w = tokens[j]; if (w === "y") continue; if (ES[w] == null) break; cur += ES[w]; }
      if (cur >= 5 && cur <= 350) best = cur;
    }
  }
  return best;
}

// ---------------- Fixing misheard words ----------------
// The recognizer sometimes returns a near miss ("strait", "slices", "light" for right). Unknown words of five letters or
// more are snapped to the closest golf word when they are one letter away (two for long words).
const LEX = new Set(), VOCAB = [];
for (const re of [...CMD.map((c) => c[1]), ...CONTACT.map((c) => c[1]), ...SHAPE.map((c) => c[1]), RIGHT, LEFT, STRAIGHT, SHORT, BIG, SMALL, ...STRIKE.map((c) => c[1])])
  for (const phrase of re.source.slice(2, -2).split("|")) for (const w of phrase.split(" ")) { LEX.add(w); if (w.length >= 5 && !VOCAB.includes(w)) VOCAB.push(w); }
for (const w of [...Object.keys(EN), ...Object.keys(ES), "the", "and", "that", "was", "this", "ball", "shot", "went", "with", "little", "really", "about", "metres", "meters", "yards", "hundred"]) LEX.add(w);
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function correct(t) {
  return t.split(" ").map((w) => {
    if (w.length < 5 || LEX.has(w) || /\d/.test(w)) return w;
    const max = w.length >= 8 ? 2 : 1; let best = null, bd = 9;
    for (const v of VOCAB) { const dd = lev(w, v); if (dd < bd) { bd = dd; best = v; } }
    return bd <= max ? best : w;
  }).join(" ");
}

// ---------------- Parse ----------------
// Returns { type: "command", name } or { type: "result", result, sev, dir, short, strike, distance, words } or null.
export function parseUtterance(text) {
  const t = correct(strip(text));
  if (!t) return null;
  const tokens = t.split(" ");
  for (const [name, re] of CMD) if (has(t, re)) return { type: "command", name };

  let result = null, dir = null;
  for (const [k, re] of CONTACT) if (has(t, re)) { result = k; break; }
  let shape = null;
  for (const [k, re] of SHAPE) if (has(t, re)) { shape = k; break; }
  const right = has(t, RIGHT), left = has(t, LEFT), straight = has(t, STRAIGHT);
  if (shape) dir = shape === "slice" || shape === "push" ? "right" : "left";
  else if (right && !left) dir = "right";
  else if (left && !right) dir = "left";
  if (!result) {
    if (shape) result = shape;
    else if (dir) result = dir === "right" ? "slice" : "hook"; // your own words: "derecha" = curved right
    else if (straight) result = "straight";
  }
  let strike = null;
  for (const [k, re] of STRIKE) if (has(t, re)) { strike = k; break; }
  const distance = wordsToNumber(tokens);
  const short = has(t, SHORT);
  if (!result && distance == null && !strike && !short) return null;
  let sev = result && result !== "straight" ? 2 : 0;
  if (sev && has(t, BIG)) sev = 3;
  else if (sev && has(t, SMALL)) sev = 1;
  return { type: "result", result: result || (short ? "straight" : null), sev, dir, short, strike, distance, words: t };
}

// A shot's weight in "bad shot" stats: a bit = 0.5, normal = 1, big = 1.5.
export const badWeight = (r) => (!r || !r.result || r.result === "straight" ? 0 : [0, 0.5, 1, 1.5][r.sev || 2]);
export const resultLabel = (r) => {
  if (!r || !r.result) return r?.distance ? `${r.distance} m` : "";
  const sev = r.result === "straight" ? "" : r.sev === 3 ? "big " : r.sev === 1 ? "slight " : "";
  return `${sev}${r.result}${r.short ? ", short" : ""}${r.distance ? `, ${r.distance} m` : ""}`;
};
