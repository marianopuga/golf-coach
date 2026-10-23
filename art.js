// Pictures of the swing: the rendered 3D golfer (art/*.webp, sizes and guides in art-data.js).
// Guides are drawn crisp on top in SVG. Pictures without a render (putting) fall back to the vector drawings.
import { art } from "./illus.js?v=10";
import { SEQ, HERO, FAULTS, FDIR, PLAY, PHOTO, PDIR } from "./art-data.js?v=10";

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

// Photo demonstrations: the photo, then translucent guides drawn on top (dashed line from a body point, weight bar between the feet)
function photoGuides(list, w) {
  const s = w / 300;
  return list.map((g) => {
    if (g[0] === "vline") return `<line x1="${g[1][0]}" y1="${g[1][1]}" x2="${g[2][0]}" y2="${g[2][1]}" class="pg-line" stroke-width="${(2.6 * s).toFixed(1)}" stroke-dasharray="${(8 * s).toFixed(1)} ${(6 * s).toFixed(1)}"/><circle cx="${g[1][0]}" cy="${g[1][1]}" r="${(4.5 * s).toFixed(1)}" class="pg-dot"/>`;
    if (g[0] === "weight") {
      const [a, b, pct] = [g[1], g[2], g[3]], x = a[0] + (b[0] - a[0]) * pct / 100, y = a[1], fs = (15 * s).toFixed(1);
      return `<line x1="${a[0]}" y1="${y}" x2="${b[0]}" y2="${y}" class="pg-track" stroke-width="${(5 * s).toFixed(1)}"/>`
        + `<text x="${a[0] - 11 * s}" y="${y + 5.2 * s}" class="pg-t" font-size="${fs}" text-anchor="end">R</text><text x="${b[0] + 11 * s}" y="${y + 5.2 * s}" class="pg-t" font-size="${fs}">L</text>`
        + `<circle cx="${x}" cy="${y}" r="${(9 * s).toFixed(1)}" class="pg-knob"/>`;
    }
    return "";
  }).join("");
}
const photoFrame = (f, i, caption) => `<figure class="pframe"><div class="pimg"><img src="${PDIR}${f.f}" width="${f.w}" height="${f.h}" alt="${esc(f.label + ": " + f.sub)}" loading="lazy" decoding="async"><svg viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">${photoGuides(f.g, f.w)}</svg></div>${caption ? `<figcaption><b>${i + 1}</b> ${esc(f.label)}<span>${esc(f.sub)}</span></figcaption>` : ""}</figure>`;
function photoArt(id) {
  const p = PHOTO[id]; if (!p) return null; const live = p.frames[p.live ?? 0];
  return {
    bad: false, cap: [live.sub, ""],
    figure(kind = "good", compact = false) { return kind === "good" ? photoFrame(live, p.live ?? 0, !compact) : ""; },
    block() { return `<div class="pdemo" data-n="${p.frames.length}" role="list">${p.frames.map((f, i) => photoFrame(f, i, true)).join("")}</div>`; },
  };
}

export function artFor(id) {
  const ph = photoArt(id); if (ph) return ph;
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
// Swing playback at a real 3:1 tempo (slow back, quick down), from one sprite with a fixed frame
const BEAT = [600, 150, 150, 150, 150, 220, 80, 60, 50, 80, 70, 90, 100, 110, 130, 320, 1000];
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let playing = 0;
if (typeof document !== "undefined") document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-swing-play]"); if (!b) return;
  const box = b.closest(".swingplay"), sp = box.querySelector(".sp"), lab = box.querySelector(".sp-label"), n = PLAY[3], run = ++playing;
  const show = (i) => { sp.style.backgroundPosition = `${(i / (n - 1)) * 100}% 0`; lab.textContent = `${i + 1} ${SEQ_LABELS[i]}`; };
  if (reduced()) { const i = ((+sp.dataset.i || 0) + 1) % n; sp.dataset.i = i; show(i); return; }
  b.disabled = true; let i = 0, t0 = performance.now(), due = BEAT[0]; show(0);
  const tick = (t) => {
    if (run !== playing || !sp.isConnected) return;
    if (t - t0 >= due) { i++; if (i >= n) { b.disabled = false; return; } show(i); t0 = t; due = BEAT[i]; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const playBlock = () => PLAY ? `<div class="swingplay"><div class="sp" role="img" aria-label="The swing, position by position" style="aspect-ratio:${PLAY[1]} / ${PLAY[2]};background-image:url(${PLAY[0]});background-size:${PLAY[3] * 100}% 100%"></div>
  <p class="sp-label">1 Setup</p><button class="linkbtn" data-swing-play><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><span>${reduced() ? "Next position" : "Play the swing"}</span></button></div>` : "";
export const sequenceArt = () => SEQ.length ? playBlock() + `<div class="seq" role="list" aria-label="The 17 positions of the swing">${SEQ.map(([f, w, h], i) =>
  `<figure role="listitem"><img src="${f}" width="${w}" height="${h}" alt="${esc(SEQ_LABELS[i])}" loading="lazy" decoding="async"><figcaption><b>${i + 1}</b>${esc(SEQ_LABELS[i])}</figcaption></figure>`).join("")}</div>` : "";
