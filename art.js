// Pictures of the swing: the rendered 3D golfer (art/*.webp, sizes and guides in art-data.js).
// Guides are drawn crisp on top in SVG. Pictures without a render (putting) fall back to the vector drawings.
import { art } from "./illus.js?v=10";
import { SEQ, HERO, FAULTS, FDIR } from "./art-data.js?v=10";

export const SEQ_LABELS = ["Setup", "Takeaway", "Club parallel", "Lead arm parallel", "Three quarter", "Top", "Transition", "Downswing", "Delivery",
  "Impact", "Release", "Follow through", "Club up", "High", "Wrap", "Finish", "Hold"];
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TONE = { g: "#CFE449", b: "#F2867E", n: "rgba(242,245,241,.6)" };
function guides(list, w, h) {
  const sw = Math.max(2.5, h / 130), dash = `stroke-dasharray="${sw * 3} ${sw * 2.6}"`, fs = Math.round(h / 15);
  return list.map((g) => {
    const c = TONE[g[g.length - 1]] || TONE.n;
    if (g[0] === "line") return `<line x1="${g[1][0]}" y1="${g[1][1]}" x2="${g[2][0]}" y2="${g[2][1]}" stroke="${c}" stroke-width="${sw}" ${dash} stroke-linecap="round"/>`;
    if (g[0] === "ring") return `<circle cx="${g[1][0]}" cy="${g[1][1]}" r="${g[2]}" fill="none" stroke="${c}" stroke-width="${sw}" ${dash}/>`;
    if (g[0] === "poly") return `<polygon points="${g[1].map((p) => p.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="${sw}" ${dash} stroke-linejoin="round"/>`;
    if (g[0] === "arrow") {
      const [a, b] = [g[1], g[2]], t = Math.atan2(b[1] - a[1], b[0] - a[0]), k = sw * 4;
      return `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]} M${b[0] - k * Math.cos(t - 0.5)} ${b[1] - k * Math.sin(t - 0.5)} L${b[0]} ${b[1]} L${b[0] - k * Math.cos(t + 0.5)} ${b[1] - k * Math.sin(t + 0.5)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (g[0] === "text") return `<text x="${g[1][0]}" y="${g[1][1]}" fill="${c}" font-size="${fs}" font-weight="700" text-anchor="middle" font-family="Inter, system-ui, sans-serif" paint-order="stroke" stroke="rgba(20,24,22,.75)" stroke-width="${fs / 5}">${esc(g[2])}</text>`;
    return "";
  }).join("");
}
const pic = (id, kind, f, label) => `<div class="pic3d" style="max-width:${Math.round(230 * f.w / f.h)}px"><img src="${FDIR}${id}-${kind}.webp" width="${f.w}" height="${f.h}" alt="${esc(label)}" loading="lazy" decoding="async"><svg viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">${guides(f[kind] || [], f.w, f.h)}</svg></div>`;

export function artFor(id) {
  const a = art(id), f = FAULTS[id]; if (!a && !f) return null;
  const goodCap = a?.goodCap || "", badCap = a?.badCap || "", hasBad = f ? !!f.b : !!a?.bad;
  return {
    bad: hasBad, cap: [goodCap, badCap],
    figure(kind = "good", compact = false) {
      const k = kind === "good" ? "g" : "b", cap = kind === "good" ? goodCap : badCap;
      const body = f ? (f[k] ? pic(id, k, f, cap) : "") : (kind === "good" ? a.good : a.bad);
      if (!body) return "";
      return `<figure>${hasBad && !compact ? `<span class="badge ${kind === "good" ? "ok" : "no"}">${kind === "good" ? "Right" : "Wrong"}</span>` : ""}${body}${cap && !compact ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    },
  };
}
export const heroArt = () => HERO ? `<img src="${HERO[0]}" width="${HERO[1]}" height="${HERO[2]}" alt="" decoding="async" fetchpriority="high">` : "";
export const sequenceArt = () => SEQ.length ? `<div class="seq" role="list" aria-label="The 17 positions of the swing">${SEQ.map(([f, w, h], i) =>
  `<figure role="listitem"><img src="${f}" width="${w}" height="${h}" alt="${esc(SEQ_LABELS[i])}" loading="lazy" decoding="async"><figcaption><b>${i + 1}</b>${esc(SEQ_LABELS[i])}</figcaption></figure>`).join("")}</div>` : "";
