// Pictures of the swing: photos of one golfer (art/p2, generated from our shot list, checked by hand) with translucent guides on top.
// Sizes, captions and guide positions in pixels come from art-data.js. Tips without an approved photo show text only.
import { PHOTO, PDIR, SWING, TEMPO, HERO } from "./art-data.js?v=12";

export const SEQ_LABELS = ["Setup", "Takeaway", "Club parallel", "Lead arm parallel", "Three quarter", "Top", "Transition", "Downswing", "Delivery",
  "Impact", "Release", "Follow through", "Club up", "High", "Wrap", "Finish", "Hold"];
const TEMPO_LABELS = ["Setup", "Takeaway", "Lead arm parallel", "Top", "Downswing", "Impact"];
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = (v) => Math.round(v * 10) / 10;

// Guides: dashed line (optional dot at its start), path through joints, ring, weight bar. Tone w white, b coral (the fault), n faint reference.
function photoGuides(list, w) {
  const s = w / 300, sw = n1(2.6 * s), dash = `${n1(8 * s)} ${n1(6 * s)}`;
  const dot = (p, t) => `<circle cx="${p[0]}" cy="${p[1]}" r="${n1(4.5 * s)}" class="pg-dot ${t}"/>`;
  const stroke = (t) => `class="pg-line ${t}" stroke-width="${t === "n" ? n1(sw * 0.7) : sw}" stroke-dasharray="${dash}"`;
  return list.map((g) => {
    if (g[0] === "line") return `<line x1="${g[1][0]}" y1="${g[1][1]}" x2="${g[2][0]}" y2="${g[2][1]}" ${stroke(g[3])} stroke-linecap="round"/>${g[4] ? dot(g[1], g[3]) : ""}`;
    if (g[0] === "path") {
      const pts = g[1], closed = pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
      return `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" ${stroke(g[2])} stroke-linejoin="round"/>${(closed ? pts.slice(1) : pts).map((p) => dot(p, g[2])).join("")}`;
    }
    if (g[0] === "ring") return `<circle cx="${g[1][0]}" cy="${g[1][1]}" r="${g[2]}" class="pg-line ${g[3]}" stroke-width="${n1(sw * 0.8)}" stroke-dasharray="${n1(4 * s)} ${n1(3.4 * s)}"/>`;
    if (g[0] === "weight") {
      const [a, b, pct] = [g[1], g[2], g[3]], [la, lb] = g[4] || ["R", "L"], x = n1(a[0] + (b[0] - a[0]) * pct / 100), y = a[1], fs = n1(20 * s);
      return `<line x1="${a[0]}" y1="${y}" x2="${b[0]}" y2="${y}" class="pg-track" stroke-width="${n1(5 * s)}"/>`
        + `<text x="${n1(a[0] - 13 * s)}" y="${n1(y + 7 * s)}" class="pg-t" font-size="${fs}" text-anchor="end">${esc(la)}</text><text x="${n1(b[0] + 13 * s)}" y="${n1(y + 7 * s)}" class="pg-t" font-size="${fs}">${esc(lb)}</text>`
        + `<circle cx="${x}" cy="${y}" r="${n1(9 * s)}" class="pg-knob"/>`;
    }
    return "";
  }).join("");
}
const BADGE = { g: ["ok", "Right"], b: ["no", "Wrong"] };
const photoFrame = (f, i, numbered, full = true) => `<figure class="pframe"${full ? ' role="listitem"' : ""}><div class="pimg"><img src="${PDIR}${f.f}" width="${f.w}" height="${f.h}" alt="${esc(f.label + ": " + f.sub)}" loading="lazy" decoding="async"><svg viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">${photoGuides(f.g, f.w)}</svg>${full && BADGE[f.tone] ? `<span class="pbadge ${BADGE[f.tone][0]}">${BADGE[f.tone][1]}</span>` : ""}</div>${full ? `<figcaption>${numbered ? `<b>${i + 1}</b> ` : ""}${esc(f.label)}<span>${esc(f.sub)}</span></figcaption>` : ""}</figure>`;

function photoArt(id) {
  const p = PHOTO[id]; if (!p) return null; const live = p.frames[p.live ?? 0];
  return {
    bad: false, cap: [live.sub, ""],
    figure(kind = "good", compact = false) { return kind === "good" ? photoFrame(live, p.live ?? 0, false, !compact) : ""; },
    block() { return `<div class="pdemo ${p.t}" data-n="${p.frames.length}" role="list">${p.frames.map((f, i) => photoFrame(f, i, p.t === "sequence")).join("")}</div>`; },
  };
}

// Players: the full swing (17 positions) and the tempo (6 positions on a 3:1 clock). Same photos, swapped in place.
const BEAT = [600, 150, 150, 150, 150, 220, 80, 60, 50, 80, 70, 90, 100, 110, 130, 320, 1000];
const PLAYERS = {
  swing: { frames: SWING, labels: SEQ_LABELS, beats: BEAT },
  tempo: { frames: TEMPO, labels: TEMPO_LABELS, beats: [450, 250, 250, 250, 125, 125], fill: { 1: [75, 750], 4: [100, 250] } },  // back 750 ms, down 250 ms
};
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const PLAY_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`;
function player(kind, extra = "", strip = "") {
  const P = PLAYERS[kind], [f0] = P.frames; if (!f0) return "";
  return `<div class="pplay" data-pp="${kind}"><div class="pimg pp-stage"><img src="${PDIR}${f0[0]}" width="${f0[1]}" height="${f0[2]}" alt="${esc(P.labels[0])}" decoding="async" loading="lazy"></div>${extra}
    <div class="pp-bar"><p class="pp-label" aria-live="polite"><b>1</b> ${esc(P.labels[0])}</p><button class="linkbtn" data-pp-play>${PLAY_ICON}<span>${reduced() ? "Next position" : kind === "tempo" ? "Play the tempo" : "Play the swing"}</span></button></div>${strip}</div>`;
}
function show(box, i) {
  const P = PLAYERS[box.dataset.pp], f = P.frames[i], img = box.querySelector(".pp-stage img");
  img.src = PDIR + f[0]; img.alt = P.labels[i]; box.dataset.i = i;
  box.querySelector(".pp-label").innerHTML = `<b>${i + 1}</b> ${esc(P.labels[i])}`;
  const strip = box.querySelector(".pp-strip");
  if (strip) {
    strip.querySelectorAll("[data-pp-i]").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.ppI === i)));
    const th = strip.querySelector(`[data-pp-i="${i}"]`);
    if (th) strip.scrollTo({ left: th.offsetLeft - strip.clientWidth / 2 + th.clientWidth / 2, behavior: reduced() ? "auto" : "smooth" });
  }
}
const preload = (P) => Promise.all(P.frames.map(([f]) => { const im = new Image(); im.src = PDIR + f; return im.decode().catch(() => {}); }));
let run = 0;
if (typeof document !== "undefined") document.addEventListener("click", async (e) => {
  const th = e.target.closest?.("[data-pp-i]");
  if (th) { run++; show(th.closest(".pplay"), +th.dataset.ppI); return; }
  const b = e.target.closest?.("[data-pp-play]"); if (!b) return;
  const box = b.closest(".pplay"), P = PLAYERS[box.dataset.pp], fill = box.querySelector(".tb-fill"), me = ++run;
  if (reduced()) { show(box, ((+box.dataset.i || 0) + 1) % P.frames.length); return; }
  b.disabled = true; await preload(P); if (me !== run) { b.disabled = false; return; }
  if (fill) { fill.style.transition = "none"; fill.style.width = "0%"; }
  let i = 0; show(box, 0);
  const step = () => {
    if (me !== run || !box.isConnected) { b.disabled = false; return; }
    if (++i >= P.frames.length) { b.disabled = false; return; }
    if (fill && P.fill[i]) { fill.style.transition = `width ${P.fill[i][1]}ms linear`; fill.style.width = `${P.fill[i][0]}%`; }
    show(box, i); setTimeout(step, P.beats[i] ?? 900);
  };
  setTimeout(step, P.beats[0]);
});

export const sequenceArt = () => SWING.length ? player("swing", "", `<div class="pp-strip" role="list" aria-label="The 17 positions of the swing">${SWING.map(([f, w, h], i) =>
  `<button class="pp-th" role="listitem" data-pp-i="${i}" aria-current="${i === 0}"><img src="${PDIR}${f}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async"><span><b>${i + 1}</b> ${esc(SEQ_LABELS[i])}</span></button>`).join("")}</div>`) : "";
const tempoArt = () => ({
  bad: false, cap: ["Slow back, quick down", ""],
  figure(kind = "good") { const f = TEMPO[3]; return kind === "good" && f ? `<figure class="pframe"><div class="pimg"><img src="${PDIR}${f[0]}" width="${f[1]}" height="${f[2]}" alt="Top of the backswing" loading="lazy" decoding="async"></div></figure>` : ""; },
  block() {
    return player("tempo", `<div class="tbar" aria-label="Backswing three beats, downswing one beat"><i class="tb-fill"></i><span style="flex:3">Back <b>3</b></span><span style="flex:1">Down <b>1</b></span></div>`);
  },
});

export function artFor(id) {
  if (id === "tempo" && TEMPO.length) return tempoArt();
  return photoArt(id);
}
export const heroArt = () => HERO ? `<img src="${PDIR}${HERO[0]}" width="${HERO[1]}" height="${HERO[2]}" alt="" decoding="async" fetchpriority="high">` : "";
