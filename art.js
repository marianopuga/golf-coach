// Pictures of the swing: photos of one golfer (art/p3, generated from our shot list, checked by hand) with translucent guides on top.
// Sizes, captions and guide positions in pixels come from art-data.js. Tips without an approved photo show text only.
import { PHOTO, PDIR, SWING, TEMPO, HERO } from "./art-data.js?v=17";

// The names of the full swing positions come with the photos (the sequence can be shorter while a photo is being redone)
export const SEQ_LABELS = SWING.length ? SWING.map((x) => x[3]) : ["Setup", "Takeaway", "Club parallel", "Lead arm parallel", "Three quarter", "Top", "Transition", "Downswing", "Delivery",
  "Impact", "Release", "Follow through", "Club up", "High", "Finish"];
const TEMPO_LABELS = ["Setup", "Takeaway", "Lead arm parallel", "Top", "Downswing", "Impact"];
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = (v) => Math.round(v * 10) / 10;

// Guides: dashed line (optional dot at its start), path through joints, ring, weight bar. Tone w white, b coral (the fault), n faint reference.
function photoGuides(list, w) {
  const s = w / 300, sw = n1(3.4 * s), dash = `${n1(9 * s)} ${n1(6 * s)}`;   // thick enough to read on a phone, where a photo is about 170 px wide
  const dot = (p, t) => `<circle cx="${p[0]}" cy="${p[1]}" r="${n1(5.5 * s)}" class="pg-dot ${t}"/>`;
  const stroke = (t) => `class="pg-line ${t}" stroke-width="${t === "n" ? n1(sw * 0.7) : sw}" stroke-dasharray="${dash}"`;
  return list.map((g) => {
    if (g[0] === "line") return `<line x1="${g[1][0]}" y1="${g[1][1]}" x2="${g[2][0]}" y2="${g[2][1]}" ${stroke(g[3])} stroke-linecap="round"/>${g[4] ? dot(g[1], g[3]) : ""}`;
    if (g[0] === "path") {
      const pts = g[1], closed = pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
      return `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" ${stroke(g[2])} stroke-linejoin="round"/>${(closed ? pts.slice(1) : pts).map((p) => dot(p, g[2])).join("")}`;
    }
    if (g[0] === "arrow") {
      const [a, b] = [g[1], g[2]], t = Math.atan2(b[1] - a[1], b[0] - a[0]), k = 11 * s;
      return `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]} M${n1(b[0] - k * Math.cos(t - 0.45))} ${n1(b[1] - k * Math.sin(t - 0.45))} L${b[0]} ${b[1]} L${n1(b[0] - k * Math.cos(t + 0.45))} ${n1(b[1] - k * Math.sin(t + 0.45))}" class="pg-line ${g[3]}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
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
// Labels that say what a line is ("Head at setup"). HTML on top of the photo, so they keep a readable size on any screen.
const tagsHtml = (list, w, h) => list.filter((g) => g[0] === "tag").map((g) => `<span class="ptag ${g[3] || "w"} ${g[4] || "c"}" style="left:${n1((g[1][0] / w) * 100)}%;top:${n1((g[1][1] / h) * 100)}%">${esc(g[2])}</span>`).join("");
const ZOOM = `<span class="pzoom" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>`;
const BADGE = { g: ["ok", "Right"], b: ["no", "Wrong"] };
const photoFrame = (f, i, numbered, full = true) => `<figure class="pframe"${full ? ' role="listitem"' : ""}><div class="pimg"${full ? ' tabindex="0" role="button" aria-label="Enlarge"' : ""}><img src="${PDIR}${f.f}" width="${f.w}" height="${f.h}" alt="${esc(f.label + ": " + f.sub)}" loading="lazy" decoding="async"><svg viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">${photoGuides(f.g, f.w)}</svg>${full ? tagsHtml(f.g, f.w, f.h) : ""}${full && BADGE[f.tone] ? `<span class="pbadge ${BADGE[f.tone][0]}">${BADGE[f.tone][1]}</span>` : ""}${full ? ZOOM : ""}</div>${full ? `<figcaption>${numbered ? `<b>${i + 1}</b> ` : ""}${esc(f.label)}<span>${esc(f.sub)}</span></figcaption>` : ""}</figure>`;

function photoArt(id) {
  const p = PHOTO[id]; if (!p) return null; const live = p.frames[p.live ?? 0];
  return {
    bad: false, cap: [live.sub, ""],
    figure(kind = "good", compact = false) { return kind === "good" ? photoFrame(live, p.live ?? 0, false, !compact) : ""; },
    block() {   // sequences number their steps; a Wrong frame inside a sequence gets its badge instead of a number
      let n = 0; const land = p.frames[0].w > p.frames[0].h ? " land" : "";
      return `<div class="pdemo ${p.t}${land}" data-n="${p.frames.length}" role="list">${p.frames.map((f) => photoFrame(f, f.tone === "b" ? 0 : n++, p.t === "sequence" && f.tone !== "b")).join("")}</div>`;
    },
  };
}

// Players: the full swing and the tempo (6 positions on a 3:1 clock). Same photos, swapped in place.
const BEAT = [600, 150, 150, 150, 150, 220, 80, 60, 50, 80, 70, 90, 100, 110, 130, 320, 1000].slice(0, Math.max(1, SWING.length - 1)).concat([1000]);
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

export const sequenceArt = () => SWING.length ? player("swing", "", `<div class="pp-strip" role="list" aria-label="The ${SWING.length} positions of the swing">${SWING.map(([f, w, h], i) =>
  `<button class="pp-th" role="listitem" data-pp-i="${i}" aria-current="${i === 0}"><img src="${PDIR}${f}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async"><span><b>${i + 1}</b> ${esc(SEQ_LABELS[i])}</span></button>`).join("")}</div>`) : "";
const tempoArt = () => ({
  bad: false, cap: ["Slow back, quick down", ""],
  figure(kind = "good") { const f = TEMPO[3]; return kind === "good" && f ? `<figure class="pframe"><div class="pimg"><img src="${PDIR}${f[0]}" width="${f[1]}" height="${f[2]}" alt="Top of the backswing" loading="lazy" decoding="async"></div></figure>` : ""; },
  block() {
    return player("tempo", `<div class="tbar" aria-label="Backswing three beats, downswing one beat"><i class="tb-fill"></i><span style="flex:3">Back <b>3</b></span><span style="flex:1">Down <b>1</b></span></div>`);
  },
});

// ---------------- Enlarge ----------------
// Tap a photo: it opens full screen with its guides and labels; swipe to the other photos of the same tip.
function openLightbox(pimg) {
  const box = pimg.closest(".pdemo, .sframes"); if (!box) return;
  const figs = [...box.querySelectorAll(":scope > figure")], at = Math.max(0, figs.indexOf(pimg.closest("figure")));
  const lb = document.createElement("div"); lb.className = "lbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photos");
  lb.innerHTML = `<button class="lb-x" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button><div class="lb-track"></div>${figs.length > 1 ? `<p class="lb-n"><span>${at + 1}</span> of ${figs.length}, swipe for the others</p>` : ""}`;
  const track = lb.querySelector(".lb-track");
  for (const f of figs) { const c = f.cloneNode(true); c.removeAttribute("role"); c.querySelector(".pimg")?.removeAttribute("tabindex"); c.querySelector(".pimg")?.removeAttribute("role"); const sl = document.createElement("div"); sl.className = "lb-slide"; sl.appendChild(c); track.appendChild(sl); }
  const prev = document.activeElement, close = () => { lb.remove(); document.removeEventListener("keydown", key); document.body.classList.remove("lb-open"); prev?.focus?.(); };
  const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") track.scrollBy({ left: track.clientWidth }); if (e.key === "ArrowLeft") track.scrollBy({ left: -track.clientWidth }); };
  lb.querySelector(".lb-x").onclick = close; lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-slide")) close(); });
  document.addEventListener("keydown", key); document.body.appendChild(lb); document.body.classList.add("lb-open");
  track.scrollLeft = at * track.clientWidth; lb.querySelector(".lb-x").focus();
  const n = lb.querySelector(".lb-n span"); if (n) track.addEventListener("scroll", () => { n.textContent = Math.round(track.scrollLeft / track.clientWidth) + 1; }, { passive: true });
}
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => { const p = e.target.closest?.(".pdemo .pimg, .sframes .pimg"); if (p && !p.closest(".lbox")) openLightbox(p); });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".pdemo .pimg, .sframes .pimg")) { e.preventDefault(); openLightbox(e.target); } });
}

export function artFor(id) {
  if (id === "tempo" && TEMPO.length) return tempoArt();
  return photoArt(id);
}
export const heroArt = () => HERO ? `<img src="${PDIR}${HERO[0]}" width="${HERO[1]}" height="${HERO[2]}" alt="" decoding="async" fetchpriority="high">` : "";

// ---------------- Your own swing, with the Library's guides ----------------
// data: what the live screen saved for a swing: 4 pictures (setup, top, impact, finish) cropped around you,
// their pose landmarks (0..1 in the picture) and the ball. The guide of a rule goes on the frame where it shows.
export const FRAME_NAMES = ["Setup", "Top", "Impact", "Finish"];
const GUIDE_FRAME = { sway: 1, arms: 1, posture: 2, stayleft: 2, upper: 2, flip: 2, headstill: 2, transfer: 3, feet: 3 };
export function faultGuides(rule, data, m = {}, tone = "b") {
  if (!rule || !data?.lm) return null;
  const w = data.w, h = data.h, L0 = data.lm[0], fi = rule in GUIDE_FRAME ? GUIDE_FRAME[rule] : ["tempo", "pendulum", "vshape"].includes(rule) ? null : 0;
  if (fi == null) return null;
  const L = data.lm[fi], P = (lm, i) => [n1(lm[i][0] * w), n1(lm[i][1] * h)], mid = (a, b) => [n1((a[0] + b[0]) / 2), n1((a[1] + b[1]) / 2)];
  const sh = (lm) => mid(P(lm, 11), P(lm, 12)), hp = (lm) => mid(P(lm, 23), P(lm, 24)), hands = (lm) => mid(P(lm, 15), P(lm, 16));
  const gy = n1(Math.max(...[27, 28, 29, 30, 31, 32].map((i) => L0[i][1])) * h + 0.015 * h);
  const ball = data.ball ? [n1(data.ball[0] * w), n1(data.ball[1] * h)] : null, pct = (v) => Math.max(2, Math.min(98, Math.round((v ?? 0.5) * 100)));
  const bar = (v) => ["weight", [P(L0, 28)[0], n1(gy + 0.03 * h)], [P(L0, 27)[0], n1(gy + 0.03 * h)], pct(v)];
  const g = [];
  switch (rule) {
    case "stance": case "chipstance": for (const i of [11, 12]) g.push(["line", P(L, i), [P(L, i)[0], gy], tone, 1]); break;
    case "ballpos": { const c = mid(P(L, 27), P(L, 28)); g.push(["line", [c[0], hp(L)[1] + 0.05 * h], [c[0], gy + 0.04 * h], "n", 0]); if (ball) g.push(["ring", ball, n1(0.03 * w), tone]); break; }
    case "weightset": g.push(bar(m.addrWeight)); break;
    case "tilt": { const r = P(L, 12), l = P(L, 11), d = [l[0] - r[0], l[1] - r[1]]; g.push(["line", [n1(r[0] - d[0] * 0.3), n1(r[1] - d[1] * 0.3)], [n1(l[0] + d[0] * 0.3), n1(l[1] + d[1] * 0.3)], tone, 0], ["line", [n1(r[0] - d[0] * 0.3), r[1]], [n1(l[0] + d[0] * 0.3), r[1]], "n", 0]); break; }
    case "handsahead": if (ball) g.push(["line", ball, [ball[0], n1(hands(L)[1] - 0.03 * h)], "n", 0], ["line", ball, hands(L), tone, 1]); break;
    case "hinge": { const a = hp(L), b = sh(L); g.push(["line", a, [n1(b[0] + (b[0] - a[0]) * 0.3), n1(b[1] + (b[1] - a[1]) * 0.3)], tone, 1]); break; }
    case "knees": g.push(["path", [P(L, 24), P(L, 26), P(L, 28)], tone]); break;
    case "reach": { const s = sh(L); g.push(["line", s, [s[0], n1(hands(L)[1] + 0.08 * h)], tone, 1]); break; }
    case "forearms": g.push(["line", P(L, 13), P(L, 15), "n", 1], ["line", P(L, 14), P(L, 16), tone, 1]); break;
    case "heels": { const s = sh(L); g.push(["line", s, [s[0], gy], tone, 1]); break; }
    case "eyesover": { const e = mid(P(L, 2), P(L, 5)); g.push(["line", e, [e[0], ball ? n1(ball[1] - 0.02 * h) : gy], tone, 1]); if (ball) g.push(["ring", ball, n1(0.03 * w), tone]); break; }
    case "sway": { const a = hp(L0), b = hp(L); g.push(["line", [a[0], gy], [a[0], n1(P(L0, 12)[1])], "n", 0], ["arrow", a, b, tone]); break; } // hips at setup, and where they slid to
    case "arms": g.push(["line", P(L, 12), P(L, 11), tone, 1]); break;
    case "posture": { const y = P(L0, 0)[1]; g.push(["line", [0, y], [w, y], "n", 0], ["path", [[P(L, 0)[0], y], P(L, 0)], tone]); break; }
    case "stayleft": g.push(bar(m.impWeight), ["line", [P(L0, 27)[0], gy], [P(L0, 27)[0], n1(P(L0, 11)[1])], "n", 0]); break;
    case "transfer": g.push(bar(m.transfer), ["line", [P(L0, 27)[0], gy], [P(L0, 27)[0], n1(P(L0, 0)[1])], "n", 0]); break;
    case "feet": g.push(["ring", P(L0, 27), n1(0.05 * w), "n"], ["ring", P(L0, 32), n1(0.05 * w), "n"], ["path", [P(L0, 27), P(L, 27)], tone], ["path", [P(L0, 32), P(L, 32)], tone]); break;
    case "upper": { const s = sh(L), p = hp(L), c = [n1(s[0] + (p[0] - s[0]) * 0.35), n1(s[1] + (p[1] - s[1]) * 0.35)]; g.push(["line", p, [p[0], n1(c[1] - 0.05 * h)], "n", 0], ["path", [c, p], tone]); break; }
    case "flip": if (ball) g.push(["line", [ball[0], n1(ball[1] + 0.02 * h)], [ball[0], n1(hands(L)[1] - 0.04 * h)], "n", 0], ["ring", hands(L), n1(0.04 * w), tone]); break;
    case "headstill": { const x = P(L0, 0)[0]; g.push(["line", [x, n1(P(L0, 0)[1] - 0.08 * h)], [x, n1(P(L0, 0)[1] + 0.12 * h)], "n", 0], ["path", [P(L0, 0), P(L, 0)], tone]); break; }
    default: return null;
  }
  // the label that says what the line is
  const T = (pt, text, al = "c", dx = 0, dy = 0, t = tone) => g.push(["tag", [n1(pt[0] + dx), n1(pt[1] + dy)], text, t, al]);
  const knee = P(L, 26), below = (y) => Math.min(n1(y + 0.045 * h), n1(0.96 * h));
  switch (rule) {
    case "stance": case "chipstance": T([mid(P(L, 11), P(L, 12))[0], knee[1]], "Shoulder width", "c", 0, 0, "w"); break;
    case "ballpos": T([mid(P(L, 27), P(L, 28))[0], hp(L)[1] + 0.02 * h], "Centre", "c", 0, 0, "w"); break;
    case "weightset": case "stayleft": case "transfer": T([mid(P(L0, 27), P(L0, 28))[0], below(gy + 0.03 * h)], "Weight", "c", 0, 0, "w");
      if (rule !== "weightset") T([P(L0, 27)[0], n1(P(L0, rule === "transfer" ? 0 : 11)[1] - 0.03 * h)], "Left foot at setup", "c", 0, 0, "w"); break;
    case "tilt": { const r = P(L, 12), l = P(L, 11); T([r[0] - (l[0] - r[0]) * 0.3, r[1]], "Level", "r", -6, 0, "w"); break; }
    case "handsahead": if (ball) T([ball[0], hands(L)[1] - 0.06 * h], "Vertical", "c", 0, 0, "w"); break;
    case "hinge": T(hp(L), "Back line", "r", -10); break;
    case "knees": T(knee, "Knee", "l", 12); break;
    case "reach": T([sh(L)[0], hands(L)[1] + 0.11 * h], "Under the shoulder"); break;
    case "forearms": T(P(L, 14), "Right forearm", "r", -10); break;
    case "heels": T([sh(L)[0], gy - 0.05 * h], "Shoulder line"); break;
    case "eyesover": { const e = mid(P(L, 2), P(L, 5)); T([e[0], (e[1] + (ball ? ball[1] : gy)) / 2], "Eye line", "l", 10); break; }
    case "sway": T([hp(L0)[0], P(L0, 12)[1] - 0.03 * h], "Hips at setup", "c", 0, 0, "w"); break;
    case "arms": T(P(L, 11), "Shoulders", "l", 10); break;
    case "posture": T([6, P(L0, 0)[1]], "Head at setup", "l", 0, 0, "w"); break;
    case "feet": T(P(L0, 27), "Feet at setup", "l", 0.06 * w, 0, "w"); break;
    case "upper": { const s2 = sh(L), p2 = hp(L); T([s2[0] + (p2[0] - s2[0]) * 0.35, s2[1] + (p2[1] - s2[1]) * 0.35], "Chest", "l", 12); T(p2, "Pelvis", "l", 12); break; }
    case "flip": T(hands(L), "Hands", "l", 0.05 * w); break;
    case "headstill": T([P(L0, 0)[0], P(L0, 0)[1] - 0.1 * h], "Head at setup", "c", 0, 0, "w"); break;
  }
  return g.length ? { frame: fi, g } : null;
}
// The four pictures of a swing, the guide on its frame. Old swings saved only the pictures.
export function swingFramesHtml(data, rule = null, m = {}, tone = "b") {
  const imgs = Array.isArray(data) ? data : data?.img;
  if (!imgs?.length) return "";
  const fg = Array.isArray(data) ? null : faultGuides(rule, data, m, tone), w = data.w || 150, h = data.h || 200;
  return imgs.map((u, i) => `<figure class="sframe${fg?.frame === i ? " on" : ""}"><div class="pimg" tabindex="0" role="button" aria-label="Enlarge ${FRAME_NAMES[i]}"><img alt="${FRAME_NAMES[i]}" src="${u}" width="${w}" height="${h}">${fg?.frame === i ? `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${photoGuides(fg.g, w)}</svg>${tagsHtml(fg.g, w, h)}` : ""}${ZOOM}</div><figcaption>${FRAME_NAMES[i]}</figcaption></figure>`).join("");
}
