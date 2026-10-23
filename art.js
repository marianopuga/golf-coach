// Pictures of the right and wrong positions. Uses the vector drawings until the 3D golfer renders are final
// (then art-data.js and art/*.webp replace them; the functions below keep the same shape).
import { art } from "./illus.js?v=9";

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
export const heroArt = () => "";
export const sequenceArt = () => "";
