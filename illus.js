// Illustrations: a shaded vector golfer (navy polo, white trousers, white cap and glove) drawn from
// joint positions in a 200 x 250 box, ground at y = 228. Every tip is a pose plus guide lines.
const COL = {
  shirtL: "#2c4f86", shirtD: "#16294a", shirtLn: "#0f1d36", pantsL: "#fbfbf9", pantsD: "#cfd3d8", pantsLn: "#8f97a2",
  skinL: "#e2b08a", skinD: "#b67f5a", capL: "#ffffff", capD: "#d5d9de", capLn: "#9ea5ae", sole: "#262a30", belt: "#4e3220",
  shaft: "#2f343b", grip: "#15181c", headL: "#d7dde3", headD: "#7c8792", ball: "#ffffff", ballLn: "#8b929a", guide: "#c99b2e", bad: "#c4452c", good: "#2f8a55",
};
let gid = 0;
const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// A tapered limb: polygon plus round ends, drawn as an outline pass then a fill pass.
function limb(a, b, wa, wb, fill, line) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const shape = (ka, kb, f) => {
    const pts = [[a[0] + nx * ka, a[1] + ny * ka], [b[0] + nx * kb, b[1] + ny * kb], [b[0] - nx * kb, b[1] - ny * kb], [a[0] - nx * ka, a[1] - ny * ka]];
    return `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${f}"/><circle cx="${a[0]}" cy="${a[1]}" r="${ka}" fill="${f}"/><circle cx="${b[0]}" cy="${b[1]}" r="${kb}" fill="${f}"/>`;
  };
  return (line ? shape(wa / 2 + 1, wb / 2 + 1, line) : "") + shape(wa / 2, wb / 2, fill);
}
function leg(l, g) {
  const out = [limb(l.hip, l.knee, 21, 16, `url(#${g}p)`, COL.pantsLn), limb(l.knee, l.ankle, 16, 13, `url(#${g}p)`, COL.pantsLn)];
  const k = L(l.hip, l.knee, 0.5), c = L(l.knee, l.ankle, 0.5);
  out.push(`<path d="M${k[0] + 2} ${k[1] - 18} L${l.knee[0] + 2} ${l.knee[1]} L${c[0] + 1.5} ${c[1] + 10}" fill="none" stroke="${COL.pantsD}" stroke-width="1.1"/>`);
  const heel = l.heel || [l.ankle[0] - (l.toe[0] - l.ankle[0]) * 0.3, l.ankle[1] + 4];
  const dx = l.toe[0] - heel[0], up = dx >= 0 ? 1 : -1;
  out.push(`<path d="M${heel[0] - up * 2} ${heel[1] + 3} Q${heel[0]} ${heel[1] - 6} ${L(heel, l.toe, 0.5)[0]} ${L(heel, l.toe, 0.5)[1] - 5} Q${l.toe[0] - up * 2} ${l.toe[1] - 5} ${l.toe[0] + up * 3} ${l.toe[1] + 1} L${l.toe[0] + up * 3} ${l.toe[1] + 3} L${heel[0] - up * 2} ${heel[1] + 4} Z" fill="${COL.capL}" stroke="${COL.capLn}" stroke-width="1"/>`);
  out.push(`<path d="M${heel[0] - up * 2} ${heel[1] + 3.6} L${l.toe[0] + up * 3} ${l.toe[1] + 2.4}" stroke="${COL.sole}" stroke-width="2.4" stroke-linecap="round"/>`);
  return out.join("");
}
function arm(a, g) {
  const sl = L(a.sh, a.el, 0.58);
  return [
    limb(a.sh, sl, 17, 13.5, `url(#${g}s)`, COL.shirtLn),
    limb(sl, a.el, 9.5, 8.5, a.far ? COL.skinD : `url(#${g}k)`, null),
    limb(a.el, a.hand, 8.5, 7, a.far ? COL.skinD : `url(#${g}k)`, null),
    a.glove ? `<ellipse cx="${a.hand[0]}" cy="${a.hand[1]}" rx="6" ry="6.4" fill="${COL.capL}" stroke="${COL.capLn}" stroke-width="1"/>`
            : `<ellipse cx="${a.hand[0]}" cy="${a.hand[1]}" rx="5.6" ry="6" fill="${a.far ? COL.skinD : COL.skinL}" stroke="${COL.skinD}" stroke-width=".8"/>`,
  ].join("");
}
function head(h, facing, g) {
  const [x, y] = h, out = [`<circle cx="${x}" cy="${y}" r="12.5" fill="url(#${g}h)"/>`];
  if (facing === "front") {
    out.push(`<path d="M${x - 12} ${y - 3} Q${x - 12.5} ${y - 18} ${x} ${y - 18.5} Q${x + 12.5} ${y - 18} ${x + 12} ${y - 3} Z" fill="url(#${g}c)" stroke="${COL.capLn}" stroke-width="1"/>`);
    out.push(`<path d="M${x - 14.5} ${y - 2.5} Q${x} ${y + 4.5} ${x + 14.5} ${y - 2.5} Q${x} ${y + 0.5} ${x - 14.5} ${y - 2.5} Z" fill="${COL.capL}" stroke="${COL.capLn}" stroke-width="1"/>`);
    out.push(`<path d="M${x - 9} ${y + 6} Q${x} ${y + 12} ${x + 9} ${y + 6}" fill="none" stroke="${COL.skinD}" stroke-width="1" opacity=".5"/>`);
  } else {
    const d = facing === "right" ? 1 : -1;
    out.push(`<path d="M${x - 13 * d} ${y} Q${x - 13 * d} ${y - 18} ${x} ${y - 18} Q${x + 12 * d} ${y - 18} ${x + 12 * d} ${y - 3} Z" fill="url(#${g}c)" stroke="${COL.capLn}" stroke-width="1"/>`);
    out.push(`<path d="M${x + 8 * d} ${y - 5} Q${x + 19 * d} ${y - 5} ${x + 23 * d} ${y - 0.5} L${x + 8 * d} ${y} Z" fill="${COL.capL}" stroke="${COL.capLn}" stroke-width="1"/>`);
    out.push(`<ellipse cx="${x - 3 * d}" cy="${y + 2}" rx="2.6" ry="3.3" fill="${COL.skinD}"/>`);
    out.push(`<path d="M${x - 12 * d} ${y + 1} Q${x - 9 * d} ${y + 7} ${x - 5 * d} ${y + 10}" fill="none" stroke="#5a4636" stroke-width="2" stroke-linecap="round" opacity=".55"/>`);
  }
  return out.join("");
}
function club(c) {
  const g = L(c.butt, c.head, c.putter ? 0.3 : 0.22), toe = c.toe || [c.head[0] + 9 * (c.face || 1), c.head[1] + 1];
  const dx = c.head[0] - c.butt[0], dy = c.head[1] - c.butt[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  return `<line x1="${c.butt[0]}" y1="${c.butt[1]}" x2="${g[0]}" y2="${g[1]}" stroke="${COL.grip}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<line x1="${g[0]}" y1="${g[1]}" x2="${c.head[0]}" y2="${c.head[1]}" stroke="${COL.shaft}" stroke-width="2.3" stroke-linecap="round"/>` +
    `<path d="M${c.head[0] - ux * 3} ${c.head[1] - uy * 3} L${toe[0]} ${toe[1] - (c.putter ? 2 : 4)} Q${toe[0] + (c.face || 1) * 1.5} ${toe[1]} ${toe[0]} ${toe[1] + 2.5} L${c.head[0] - (c.face || 1) * 1} ${c.head[1] + 3} Z" fill="url(#__CH)" stroke="${COL.shaft}" stroke-width=".9" stroke-linejoin="round"/>`;
}
export function golfer(p, { guides = "", ground = true, label = "" } = {}) {
  const g = "g" + ++gid, near = (x) => !x.far;
  const defs = `<defs>
    <linearGradient id="${g}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COL.shirtL}"/><stop offset="1" stop-color="${COL.shirtD}"/></linearGradient>
    <linearGradient id="${g}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COL.pantsL}"/><stop offset=".7" stop-color="#eef0f1"/><stop offset="1" stop-color="${COL.pantsD}"/></linearGradient>
    <linearGradient id="${g}k" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COL.skinL}"/><stop offset="1" stop-color="${COL.skinD}"/></linearGradient>
    <radialGradient id="${g}h" cx=".38" cy=".38" r=".7"><stop offset="0" stop-color="${COL.skinL}"/><stop offset="1" stop-color="${COL.skinD}"/></radialGradient>
    <linearGradient id="${g}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COL.capL}"/><stop offset="1" stop-color="${COL.capD}"/></linearGradient>
    <linearGradient id="${g}ch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COL.headL}"/><stop offset="1" stop-color="${COL.headD}"/></linearGradient>
    <filter id="${g}b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
  const parts = [];
  if (ground) parts.push(`<ellipse cx="${p.shadowX || 100}" cy="229" rx="${p.shadowW || 46}" ry="5.5" fill="rgba(25,40,28,.22)" filter="url(#${g}b)"/>`);
  if (p.ball) parts.push(`<circle cx="${p.ball[0]}" cy="${p.ball[1]}" r="4" fill="${COL.ball}" stroke="${COL.ballLn}" stroke-width="1"/>`);
  if (p.clubBehind) parts.push(club(p.club));
  p.legs.filter((l) => l.far).forEach((l) => parts.push(leg(l, g)));
  p.arms.filter((a) => a.far && a.behind).forEach((a) => parts.push(arm(a, g)));
  p.legs.filter(near).forEach((l) => parts.push(leg(l, g)));
  if (p.pelvis) parts.push(`<polygon points="${p.pelvis.map((q) => q.join(",")).join(" ")}" fill="url(#${g}p)"/>`);
  parts.push(limb(p.neck, p.headPos, 9, 9, COL.skinD, null));
  parts.push(`<polygon points="${p.torso.map((q) => q.join(",")).join(" ")}" fill="url(#${g}s)" stroke="${COL.shirtLn}" stroke-width="1.6" stroke-linejoin="round"/>`);
  if (p.collar) parts.push(`<path d="${p.collar}" fill="none" stroke="#e9edf3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (p.belt) parts.push(`<line x1="${p.belt[0][0]}" y1="${p.belt[0][1]}" x2="${p.belt[1][0]}" y2="${p.belt[1][1]}" stroke="${COL.belt}" stroke-width="4.5"/>`);
  if (p.headFirst) parts.push(head(p.headPos, p.facing, g));
  p.arms.filter((a) => a.far && !a.behind).forEach((a) => parts.push(arm(a, g)));
  if (!p.clubBehind) parts.push(club(p.club));
  p.arms.filter(near).forEach((a) => parts.push(arm(a, g)));
  if (!p.headFirst) parts.push(head(p.headPos, p.facing, g));
  return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${defs}${parts.join("").replaceAll("url(#__CH)", `url(#${g}ch)`)}${guides}</svg>`;
}

// ---------------- Poses ----------------
const clone = (o) => JSON.parse(JSON.stringify(o));
export const P = {
  addressFace: {
    facing: "front", headPos: [100, 45], neck: [100, 60], ball: [112, 226], shadowX: 101,
    torso: [[80, 64], [100, 61], [120, 64], [118, 100], [114, 127], [87, 127], [82, 100]],
    collar: "M93 61 L100 68 L107 61", belt: [[87, 126], [114, 126]], pelvis: [[87, 125], [114, 125], [117, 142], [84, 142]],
    legs: [{ hip: [91, 134], knee: [85, 177], ankle: [78, 221], toe: [66, 226] }, { hip: [110, 134], knee: [116, 177], ankle: [124, 221], toe: [136, 226] }],
    arms: [{ sh: [82, 69], el: [88, 103], hand: [100, 132] }, { sh: [118, 67], el: [113, 101], hand: [103, 130], glove: true }],
    club: { butt: [101, 120], head: [107, 225], face: 1 },
  },
  topFace: {
    facing: "front", headPos: [99, 46], neck: [99, 61], shadowX: 101, clubBehind: true, headFirst: true,
    torso: [[86, 65], [99, 61], [112, 66], [112, 100], [111, 127], [89, 127], [87, 100]],
    collar: "M93 62 L99 68 L105 62", belt: [[89, 126], [111, 126]], pelvis: [[89, 125], [111, 125], [114, 142], [86, 142]],
    legs: [{ hip: [93, 134], knee: [86, 177], ankle: [78, 221], toe: [66, 226] }, { hip: [107, 134], knee: [110, 178], ankle: [124, 221], toe: [136, 226] }],
    arms: [{ sh: [88, 68], el: [70, 78], hand: [72, 44] }, { sh: [110, 72], el: [92, 70], hand: [75, 47], glove: true }],
    club: { butt: [67, 52], head: [150, 34], face: 1, toe: [152, 44] },
  },
  impactFace: {
    facing: "front", headPos: [96, 47], neck: [97, 62], ball: [114, 225], shadowX: 102,
    torso: [[80, 70], [98, 63], [121, 64], [120, 100], [117, 126], [91, 127], [84, 100]],
    collar: "M90 63 L97 70 L104 63", belt: [[91, 125], [117, 124]], pelvis: [[91, 124], [117, 123], [121, 140], [89, 141]],
    legs: [{ hip: [96, 133], knee: [94, 176], ankle: [80, 216], toe: [70, 226], heel: [82, 214] }, { hip: [113, 132], knee: [120, 175], ankle: [125, 221], toe: [137, 226] }],
    arms: [{ sh: [84, 73], el: [94, 106], hand: [107, 132] }, { sh: [118, 67], el: [116, 100], hand: [110, 130], glove: true }],
    club: { butt: [109, 120], head: [112, 225], face: 1 },
  },
  finishFace: {
    facing: "right", headPos: [111, 45], neck: [109, 60], shadowX: 106, clubBehind: true,
    torso: [[97, 64], [110, 60], [119, 66], [121, 100], [119, 127], [100, 127], [96, 100]],
    belt: [[100, 126], [119, 126]], pelvis: [[100, 125], [119, 125], [121, 141], [98, 141]],
    legs: [{ hip: [104, 134], knee: [100, 176], ankle: [92, 212], toe: [86, 226], heel: [94, 210], far: true }, { hip: [115, 134], knee: [121, 176], ankle: [124, 221], toe: [137, 226] }],
    arms: [{ sh: [100, 66], el: [108, 50], hand: [126, 38], far: true, glove: true, behind: true }, { sh: [116, 67], el: [131, 57], hand: [128, 40] }],
    club: { butt: [133, 36], head: [68, 70], face: -1, toe: [60, 76] },
  },
  addressDtl: {
    facing: "right", headPos: [128, 55], neck: [120, 64], ball: [174, 225], shadowX: 110, shadowW: 52,
    torso: [[70, 124], [80, 98], [97, 70], [112, 63], [125, 71], [121, 84], [107, 105], [100, 126]],
    belt: [[70, 124], [100, 125]], pelvis: [[68, 122], [100, 123], [102, 142], [70, 145], [62, 136]],
    legs: [{ hip: [84, 136], knee: [103, 176], ankle: [94, 220], toe: [113, 225], far: true }, { hip: [80, 137], knee: [98, 177], ankle: [88, 221], toe: [107, 226] }],
    arms: [{ sh: [117, 72], el: [126, 105], hand: [127, 136], far: true, glove: true }, { sh: [111, 72], el: [120, 104], hand: [123, 136] }],
    club: { butt: [120, 126], head: [167, 224], face: 1, toe: [178, 225] },
  },
  uprightDtl: {
    facing: "right", headPos: [111, 44], neck: [107, 56], ball: [174, 225], shadowX: 108, shadowW: 52,
    torso: [[82, 126], [86, 98], [93, 64], [106, 57], [117, 64], [116, 80], [110, 104], [106, 127]],
    belt: [[82, 125], [106, 125]], pelvis: [[81, 123], [106, 123], [107, 142], [82, 144], [78, 136]],
    legs: [{ hip: [94, 137], knee: [99, 179], ankle: [93, 220], toe: [112, 225], far: true }, { hip: [91, 137], knee: [95, 180], ankle: [88, 221], toe: [107, 226] }],
    arms: [{ sh: [108, 66], el: [126, 99], hand: [140, 128], far: true, glove: true }, { sh: [103, 65], el: [122, 98], hand: [137, 129] }],
    club: { butt: [133, 120], head: [168, 224], face: 1, toe: [178, 225] },
  },
};
const mod = (base, fn) => { const p = clone(P[base]); fn(p); return p; };
const shift = (pt, dx, dy = 0) => { pt[0] += dx; pt[1] += dy; };
const shiftUpper = (p, dx, dy = 0) => { // torso, head, arms, club butt and hands move together
  shift(p.headPos, dx, dy); shift(p.neck, dx, dy); p.torso.forEach((q, i) => { if (q[1] < 112) shift(q, dx, dy); });
  p.arms.forEach((a) => { shift(a.sh, dx, dy); shift(a.el, dx, dy); shift(a.hand, dx, dy); }); shift(p.club.butt, dx, dy);
};
const line = (x1, y1, x2, y2, c = COL.guide) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.2" stroke-dasharray="6 5" stroke-linecap="round"/>`;
const arrow = (x1, y1, x2, y2, c = COL.guide) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 7; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x2} ${y2} L${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)} M${x2} ${y2} L${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`; };
const ring = (x, y, r, c = COL.guide) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 4"/>`;
const text = (x, y, t, c = COL.guide) => `<text x="${x}" y="${y}" font-size="11" font-weight="700" fill="${c}" font-family="Archivo, system-ui, sans-serif" text-anchor="middle">${t}</text>`;

// Narrow and wide stances
const narrow = mod("addressFace", (p) => { p.legs[0].knee = [90, 177]; p.legs[0].ankle = [90, 221]; p.legs[0].toe = [80, 226]; p.legs[1].knee = [111, 177]; p.legs[1].ankle = [111, 221]; p.legs[1].toe = [121, 226]; p.ball = [104, 226]; p.club.head = [103, 225]; });
const wide = mod("addressFace", (p) => { p.legs[0].knee = [80, 178]; p.legs[0].ankle = [66, 221]; p.legs[0].toe = [54, 226]; p.legs[1].knee = [121, 178]; p.legs[1].ankle = [136, 221]; p.legs[1].toe = [148, 226]; p.shadowW = 56; });
const putter = (base) => mod(base, (p) => { p.club.putter = true; });

// tip id -> [good pose, guides, bad pose, guides, captions]
export const ART = {
  stance: () => [P.addressFace, line(82, 70, 76, 222) + line(118, 67, 126, 222), narrow, line(82, 70, 82, 222) + line(118, 67, 118, 222), "Feet under the shoulders", "Feet too close"],
  chipstance: () => [narrow, line(90, 228, 111, 228, COL.good), wide, "", "Feet close together", "Too wide for a chip"],
  ballpos: () => [P.addressFace, line(78, 236, 124, 236) + text(101, 247, "middle") + line(101, 230, 101, 240), mod("addressFace", (p) => { p.ball = [128, 226]; p.club.head = [123, 225]; }), line(101, 230, 101, 240) + text(128, 247, "too far forward", COL.bad), "7 iron: just left of centre", "Ball too far forward"],
  hinge: () => [P.addressDtl, line(78, 132, 116, 66), P.uprightDtl, line(90, 134, 106, 58), "Lean from the hips", "Too upright, arms reaching"],
  knees: () => [P.addressDtl, ring(99, 177, 9, COL.good), mod("addressDtl", (p) => { p.legs[0].knee = [91, 178]; p.legs[1].knee = [86, 179]; shiftUpper(p, -3, -6); }), ring(86, 179, 9, COL.bad), "Soft knees", "Locked knees"],
  reach: () => [P.addressDtl, line(111, 60, 111, 150), mod("addressDtl", (p) => { p.arms.forEach((a) => { shift(a.el, 8, 0); shift(a.hand, 18, -4); }); shift(p.club.butt, 18, -4); p.club.head = [180, 224]; p.club.toe = [190, 225]; p.ball = [186, 225]; }), line(111, 60, 111, 150), "Arms hang under the shoulders", "Reaching for the ball"],
  weightset: () => [mod("addressFace", (p) => shiftUpper(p, 4)), line(101, 40, 101, 230) + arrow(104, 150, 122, 150, COL.good) + text(150, 154, "65%", COL.good), mod("addressFace", (p) => shiftUpper(p, -4)), line(101, 40, 101, 230), "Chest toward the target", "Hanging back"],
  tilt: () => [P.addressFace, line(70, 72, 130, 62), mod("addressFace", (p) => { p.torso[0] = [80, 64]; p.arms[0].sh = [82, 66]; p.torso[2] = [120, 64]; p.arms[1].sh = [118, 66]; }), line(70, 66, 130, 66), "Right shoulder lower", "Shoulders level"],
  handsahead: () => [mod("addressFace", (p) => { p.arms.forEach((a) => shift(a.hand, 5)); shift(p.club.butt, 6); }), line(112, 120, 112, 230), mod("addressFace", (p) => { p.arms.forEach((a) => shift(a.hand, -6)); shift(p.club.butt, -7); }), line(112, 120, 112, 230), "Handle slightly ahead", "Hands behind the ball"],
  forearms: () => [P.addressDtl, "", mod("addressDtl", (p) => { shift(p.arms[1].el, 6, -8); }), ring(126, 96, 10, COL.bad), "Right elbow down", "Right arm high, face opens"],
  heels: () => [P.addressDtl, line(104, 60, 104, 228), mod("addressDtl", (p) => { shiftUpper(p, -10, 4); p.pelvis.forEach((q) => shift(q, -6, 4)); }), line(104, 60, 104, 228), "Shoulders over the balls of the feet", "Sitting back on the heels"],
  eyesover: () => [putter("addressDtl"), line(128, 60, 128, 228), putter("uprightDtl"), line(111, 50, 111, 228), "Eyes over the ball", "Eyes inside the ball"],
  arms: () => [P.topFace, text(100, 22, "chest turned", COL.good), mod("topFace", (p) => { p.torso = [[80, 65], [99, 61], [120, 66], [118, 100], [113, 127], [87, 127], [82, 100]]; p.arms[0].sh = [82, 68]; p.arms[1].sh = [118, 68]; }), text(100, 22, "chest still square", COL.bad), "Shoulders turn", "Arms only"],
  tempo: () => [P.topFace, text(60, 20, "back 3") + text(140, 20, "down 1"), P.topFace, text(100, 20, "back 1, down 1", COL.bad), "Smooth back, then down", "Rushed from the top"],
  sway: () => [P.topFace, line(100, 120, 100, 150), mod("topFace", (p) => { shiftUpper(p, -10); p.pelvis.forEach((q) => shift(q, -10)); p.legs.forEach((l) => shift(l.hip, -10)); p.belt.forEach((q) => shift(q, -10)); p.torso.forEach((q) => { if (q[1] >= 112) shift(q, -10); }); }), line(100, 120, 100, 150), "Hips turn in place", "Hips slide away"],
  posture: () => [P.impactFace, line(60, 47, 140, 47), mod("impactFace", (p) => shiftUpper(p, 0, -10)), line(60, 47, 140, 47), "Same height at impact", "Stood up"],
  feet: () => [P.finishFace, ring(124, 222, 12, COL.good), mod("finishFace", (p) => { p.legs[1].ankle = [134, 218]; p.legs[1].toe = [147, 224]; p.legs[1].knee = [127, 176]; }), ring(137, 220, 13, COL.bad), "Feet planted", "Front foot spun out"],
  stayleft: () => [P.impactFace, line(101, 40, 101, 230) + arrow(104, 150, 122, 150, COL.good), mod("impactFace", (p) => shiftUpper(p, -9)), line(101, 40, 101, 230), "Weight left at impact", "Fell back"],
  transfer: () => [P.finishFace, line(124, 30, 124, 228), mod("finishFace", (p) => shiftUpper(p, -14, 4)), line(124, 30, 124, 228), "Finish over the front foot", "Finish on the back foot"],
  upper: () => [P.impactFace, line(114, 30, 114, 228), mod("impactFace", (p) => { shift(p.headPos, 16); shift(p.neck, 14); p.torso.forEach((q) => { if (q[1] < 90) shift(q, 10); }); p.arms.forEach((a) => shift(a.sh, 10)); }), line(114, 30, 114, 228), "Head behind the ball", "Upper body ahead"],
  flip: () => [P.impactFace, line(107, 130, 112, 225, COL.good), mod("impactFace", (p) => { p.arms.forEach((a) => shift(a.hand, -8, -2)); p.club.butt = [99, 120]; }), line(99, 125, 112, 225, COL.bad), "Handle ahead, flat wrist", "Scooped"],
  vshape: () => [narrow, `<polygon points="82,70 118,67 101,131" fill="none" stroke="${COL.good}" stroke-width="2" stroke-dasharray="5 4"/>`, mod("addressFace", (p) => { p.arms.forEach((a) => shift(a.hand, -10, -8)); p.club.butt = [88, 118]; p.club.head = [112, 222]; }), `<polygon points="82,70 118,67 91,123" fill="none" stroke="${COL.bad}" stroke-width="2" stroke-dasharray="5 4"/>`, "The V stays", "Wrists broke the V"],
  pendulum: () => [putter("addressFace"), arrow(100, 236, 74, 236, COL.good) + arrow(102, 236, 128, 236, COL.good), putter("addressFace"), arrow(100, 236, 66, 236, COL.bad) + arrow(102, 236, 112, 236, COL.bad), "Back as long as through", "Long back, short through"],
  headstill: () => [putter("addressFace"), ring(100, 45, 17, COL.good), mod("addressFace", (p) => { p.club.putter = true; shift(p.headPos, 9); shift(p.neck, 6); }), ring(100, 45, 17, COL.bad), "Head stays still", "Head follows the ball"],
  "setup-steps": () => [P.addressFace, "", null],
  "chip-steps": () => [narrow, "", null],
  "putt-setup": () => [putter("addressDtl"), line(128, 60, 128, 228), null],
  "putt-stroke": () => [putter("addressFace"), arrow(100, 236, 76, 236) + arrow(102, 236, 126, 236), null],
  aim: () => [P.addressDtl, line(30, 232, 196, 222) + text(60, 246, "target line"), null],
  "driver-up": () => [mod("impactFace", (p) => shiftUpper(p, -4)), arrow(118, 226, 140, 212), null],
  bunker: () => [wide, "", null],
};
export function art(id) {
  const f = ART[id]; if (!f) return null;
  const a = f();
  return { good: golfer(a[0], { guides: a[1], label: a[4] || "" }), bad: a[2] ? golfer(a[2], { guides: a[3], label: a[5] || "" }) : null, goodCap: a[4] || "", badCap: a[5] || "" };
}
export const strip = () => [["addressFace", "Setup"], ["topFace", "Top"], ["impactFace", "Impact"], ["finishFace", "Finish"]].map(([k, l]) => ({ svg: golfer(P[k]), label: l }));
