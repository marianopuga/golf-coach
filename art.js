// Pictures of the swing: rendered 3D golfer (art/*.webp, sizes in art-data.js). Fault pairs still use the vector drawings.
import { art } from "./illus.js?v=10";
import { SEQ, HERO } from "./art-data.js?v=10";

export const SEQ_LABELS = ["Setup", "Takeaway", "Club parallel", "Lead arm parallel", "Three quarter", "Top", "Transition", "Downswing", "Delivery",
  "Impact", "Release", "Follow through", "Club up", "High", "Wrap", "Finish", "Hold"];
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function artFor(id) {
  const a = art(id); if (!a) return null;
  return {
    bad: !!a.bad, cap: [a.goodCap || "", a.badCap || ""],
    figure(kind = "good", compact = false) {
      const pair = !!a.bad && !compact, svg = kind === "good" ? a.good : a.bad, cap = kind === "good" ? a.goodCap : a.badCap;
      if (!svg) return "";
      return `<figure>${pair ? `<span class="badge ${kind === "good" ? "ok" : "no"}">${kind === "good" ? "Right" : "Wrong"}</span>` : ""}${svg}${cap && !compact ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    },
  };
}
export const heroArt = () => HERO ? `<img src="${HERO[0]}" width="${HERO[1]}" height="${HERO[2]}" alt="" decoding="async" fetchpriority="high">` : "";
export const sequenceArt = () => SEQ.length ? `<div class="seq" role="list" aria-label="The 17 positions of the swing">${SEQ.map(([f, w, h], i) =>
  `<figure role="listitem"><img src="${f}" width="${w}" height="${h}" alt="${esc(SEQ_LABELS[i])}" loading="lazy" decoding="async"><figcaption><b>${i + 1}</b>${esc(SEQ_LABELS[i])}</figcaption></figure>`).join("")}</div>` : "";
