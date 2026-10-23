// Screens: Today, History, Progress, Library, Profile, the session report and the round log.
import { RULES, VIDEOS, CAMERA, BAG, CATS, VENUES, VOICE_HELP, clubById } from "./rules.js?v=11";
import { buildPlan, calibrationPlan, catStats, sessionStats, reportText, ruleById, coachNotes, badRate, resOf, stockDistances, roundStats, weeklySummary, TEE, APPROACH } from "./engine.js?v=11";
import { badWeight, resultLabel } from "./voice.js?v=11";
import { DB, S, save, resetCoach, clearHistory, frames, giveFile } from "./store.js?v=11";
import { artFor, heroArt, sequenceArt, SEQ_LABELS } from "./art.js?v=11";
import { T } from "./lines.js?v=11";

const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const TABS = ["today", "history", "progress", "library", "profile"];
let current = "today", app = null, calMonth = new Date(), selDay = null, reportFrom = "history", modelState = "Loading the camera coach…";
const CAM_ICON = '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/></svg>';
const camText = (v) => (v === "dtl" ? "Behind" : "In front");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fmtDate = (t, o = { weekday: "short", day: "numeric", month: "short" }) => new Date(t).toLocaleDateString("en-AU", o);
const realSessions = () => DB.sessions.filter((s) => (s.swings || []).some((w) => !w.practice));
const kindOf = (s) => (s.calib ? "Calibration" : s.plan ? "Planned session" : "Free practice");
const calibDone = () => DB.sessions.some((s) => s.calib && (s.swings || []).filter((w) => !w.practice).length >= 20);
const venue = () => VENUES[S.venue] || VENUES.pw;
const vName = (id) => (id === "sf" ? "Swing Factory" : id === "pw" ? "Pittwater" : "Range");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const shortClub = (id) => ({ PW: "PW", SW: "SW" }[id] || clubById(id).name);
const ICON = {
  chart: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16"/><path d="M5 15l4.5-4.5 3.5 3L19 7"/></svg>',
  cal: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  flag: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3.5l11 4-11 4"/><path d="M3 21h15"/></svg>',
};
const empty = (icon, title, text) => `<div class="empty">${ICON[icon]}<h3>${title}</h3><p class="muted small">${text}</p></div>`;
const initials = () => (S.profile.name || "M").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
// Confirmation for destructive actions, and a short message with Undo
function confirmDialog(title, text, yes = "Delete") {
  const d = $("#confirm"); $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yes;
  return new Promise((res) => { const done = (v) => { if (d.open) d.close(); res(v); }; $("#confirmYes").onclick = () => done(true); $("#confirmNo").onclick = () => done(false); d.oncancel = () => res(false); d.showModal(); });
}
let toastTimer = 0;
function toast(text, undo) {
  const t = $("#toast"), u = $("#toastUndo"); $("#toastText").textContent = text; u.hidden = !undo;
  u.onclick = () => { t.hidden = true; undo(); }; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 6000);
}
const planOpts = () => ({ venue: S.venue, total: S.balls, minutes: S.minutes, bag: S.bag, sessions: DB.sessions, rounds: DB.rounds });

export function init(a) {
  app = a;
  $("#tabbar").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab); });
  go("today");
}
export function go(tab) {
  current = tab;
  for (const t of TABS) $("#tab-" + t).hidden = t !== tab;
  $("#screen-report").hidden = true; $("#screen-round").hidden = true; $("#tabbar").hidden = false;
  document.querySelectorAll("#tabbar button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  ({ today: renderToday, history: renderHistory, progress: renderProgress, library: renderLibrary, profile: renderProfile })[tab]();
  window.scrollTo(0, 0);
}
export function setModelState(t) { modelState = t; const el = $("#modelState"); if (el) el.textContent = t; }
function showOnly(id) { for (const t of TABS) $("#tab-" + t).hidden = true; $("#screen-report").hidden = id !== "report"; $("#screen-round").hidden = id !== "round"; window.scrollTo(0, 0); }

// ---------------- Today ----------------
function ring(good, n) {
  const r = 30, c = 2 * Math.PI * r, f = n ? good / 5 : 0;
  return `<svg class="ring" viewBox="0 0 76 76" aria-label="${good} of 5"><circle class="bg" cx="38" cy="38" r="${r}"/><circle class="fg" cx="38" cy="38" r="${r}" stroke-dasharray="${c * f} ${c}"/><text x="38" y="38">${good}/5</text></svg>`;
}
function planTable(plan) {
  const time = plan.mode === "time", range = plan.blocks.filter((b) => !b.short), short = plan.blocks.filter((b) => b.short);
  const row = (b, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(b.name)}</b>${b.why && b.phase !== "calib" ? `<small>${esc(b.why)}</small>` : ""}</td><td class="n">${b.balls}${time && b.minutes ? `<small>${b.minutes} min</small>` : ""}</td><td><span class="cam">${CAM_ICON}${camText(b.view)}</span></td></tr>`;
  return `<div class="card-scroll"><table class="score"><tr><th class="c">#</th><th>Club</th><th class="c">Balls</th><th>Camera</th></tr>
    ${range.map(row).join("")}
    <tr class="sub"><td></td><td>${time ? `Range, about ${plan.minutes} min` : "Range total"}</td><td class="n">${range.reduce((a, b) => a + b.balls, 0)}</td><td></td></tr>
    ${short.length ? `<tr class="sub"><td></td><td colspan="3">Short game, with your own balls</td></tr>${short.map((b, i) => row(b, range.length + i)).join("")}` : ""}
  </table></div>`;
}
function renderToday() {
  const el = $("#tab-today"), V = venue(), cal = !calibDone();
  const plan = cal ? calibrationPlan(planOpts()) : buildPlan(planOpts());
  const F = DB.coach.focus, fr = F && ruleById(F.id), l5 = F ? F.hist.slice(-5) : [];
  const wk = weeklySummary(DB.sessions), wc = wk.cur, wp = wk.prev;
  const trend = wc.bad != null && wp.bad != null ? (wc.bad < wp.bad ? `down from ${Math.round(wp.bad * 100)}%` : wc.bad > wp.bad ? `up from ${Math.round(wp.bad * 100)}%` : "same as last week") : "";
  const stepper = V.mode === "time"
    ? { v: S.minutes, unit: "minutes in your bay", chips: [30, 45, 60, 90], key: "minutes", step: 15 }
    : { v: S.balls, unit: "balls in your bucket", chips: [50, 100, 150], key: "balls", step: 10 };
  const name = S.profile.name.split(" ")[0];
  el.innerHTML = `
    <header class="lt hdr"><div><p class="greet">${fmtDate(Date.now(), { weekday: "long", day: "numeric", month: "long" })}</p><h1>Hello ${esc(name)}</h1></div><button class="avatar sm" id="toProfile" aria-label="Your profile">${esc(initials())}</button></header>
    ${S.roundDraft ? `<section class="panel"><div class="sect"><h2>Round in progress</h2><span class="meta">${esc(S.roundDraft.course || "Course")}</span></div><p class="muted small">${S.roundDraft.holes.filter((h) => h.score).length} of ${S.roundDraft.holes.length} holes logged.</p><button class="btn" id="contRound">Continue logging</button></section>` : ""}
    <section class="panel hero">
      ${heroArt() ? `<div class="hero-art" aria-hidden="true">${heroArt()}</div>` : ""}
      <h2>${cal ? "Calibration first" : "Ready to practise"}</h2>
      <p class="muted">${cal ? "Your first full session is a calibration: no corrections, every club from both camera sides. It teaches the app how your swing and your words look." : esc(V.about)}</p>
      <div class="seg" id="venue" role="group" aria-label="Range">${["pw", "sf"].map((id) => `<button data-v="${id}" aria-pressed="${id === S.venue}">${id === "pw" ? "Pittwater" : "Swing Factory"}</button>`).join("")}</div>
      <div class="stepper"><button id="minus" aria-label="Less">&minus;</button><output>${stepper.v}<small>${stepper.unit}</small></output><button id="plus" aria-label="More">+</button></div>
      <div class="pills" id="chips" style="justify-content:center">${stepper.chips.map((n) => `<button aria-pressed="${n === stepper.v}">${n}</button>`).join("")}</div>
      <button class="btn" id="go">${cal ? "Start calibration" : "Start session"}</button>
      <button class="linkbtn" id="alt">${cal ? "Normal session instead" : "Free practice instead"}</button>
    </section>
    <section class="panel" id="freeBox" hidden>
      <h3>Free practice</h3>
      <select id="freeClub" class="in-text">${BAG.filter((c) => S.bag.includes(c.id)).map((c) => `<option value="${c.id}" ${c.id === S.clubId ? "selected" : ""}>${c.name}</option>`).join("")}</select>
      <div class="pills" id="freeView"><button data-v="face" aria-pressed="${S.view === "face"}">Camera in front</button><button data-v="dtl" aria-pressed="${S.view === "dtl"}">Camera behind</button></div>
      <p class="muted small">${CAMERA[S.view]}</p>
      <button class="btn olive" id="goFree">Start free practice</button>
    </section>
    ${wc.sessions || wp.sessions ? `<section class="panel">
      <div class="sect"><h2>Your week</h2><span class="muted small">last 7 days</span></div>
      <div class="stats">
        <div class="stat"><b>${wc.sessions}</b><span>sessions</span></div>
        <div class="stat"><b>${wc.balls}</b><span>balls</span></div>
        <div class="stat"><b>${wc.bad == null ? "–" : Math.round(wc.bad * 100) + "%"}</b><span>bad shots${trend ? ", " + trend : ""}</span></div>
      </div>
      ${wc.topFault ? `<p class="small">Most frequent fault this week: <b>${esc(ruleById(wc.topFault.id)?.title)}</b>, ${Math.round(wc.topFault.rate * 100)}% of swings.</p>` : ""}
    </section>` : ""}
    <section class="panel">
      <h2>Your focus</h2>
      ${fr ? `<div class="focus">${ring(l5.filter(Boolean).length, l5.length)}<div style="display:grid;gap:4px"><h3>${esc(fr.title)}</h3><p class="muted small">${esc(fr.why)}</p><p class="small"><a href="${VIDEOS[fr.src].url || "#"}" target="_blank" rel="noopener">${VIDEOS[fr.src].who}: ${esc(VIDEOS[fr.src].title)}</a></p></div></div>
             <p class="muted small">Fixed after 4 good swings out of 5, then the next one starts. Before each shot the app also checks your setup and says "Ready".</p>`
           : `<p class="muted">${cal ? "Your first focus is chosen after calibration, from what the camera sees in your swing." : "Your first focus is chosen from your first coached swings."}</p>`}
    </section>
    <section class="panel">
      <div class="sect"><h2>${cal ? "Calibration plan" : "Your plan"}</h2><span class="muted small nw">${plan.blocks.length} blocks</span></div>
      ${cal ? `<p class="muted small">Swing normally, no corrections. After each ball say how it flew${V.tracer ? " and the distance on the screen" : ""}. The camera moves once per club.</p>` : ""}
      ${planTable(plan)}
      ${plan.adapted || cal ? "" : `<p class="muted small">Standard split for now. After a few sessions, the club you hit worst gets more balls, goes first and comes back at the end as a retest.</p>`}
      <details class="why"><summary>Why this order</summary>
        <p>Half swings first to loosen up, then from short clubs to long ones, so you reach the driver warm. ${plan.blocks.some((b) => b.phase === "random") ? "The random block at the end changes club every ball, like on the course. " : ""}${V.short.length ? "Short game comes last, on the greens, with your own balls. " : ""}The camera changes side between clubs so each club is checked from both sides over time.</p>
      </details>
    </section>
    <section class="panel">
      <h2>Played a round?</h2>
      <p class="muted">Log it in about 5 minutes. Your misses on the course change what you practise at the range.</p>
      <button class="btn quiet" id="logRound">Log a round</button>
    </section>
    <p class="muted small" id="modelState">${esc(modelState)}</p>`;
  const set = (v) => { if (stepper.key === "minutes") S.minutes = Math.max(15, Math.min(180, v)); else S.balls = Math.max(10, Math.min(300, v)); save(); renderToday(); };
  $("#minus").onclick = () => set(stepper.v - stepper.step); $("#plus").onclick = () => set(stepper.v + stepper.step);
  $("#chips").onclick = (e) => { const b = e.target.closest("button"); if (b) set(Number(b.textContent)); };
  $("#venue").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.venue = b.dataset.v; save(); renderToday(); };
  $("#go").onclick = () => app.start(cal ? "calib" : "plan");
  $("#alt").onclick = () => (cal ? app.start("plan") : ($("#freeBox").hidden = !$("#freeBox").hidden));
  $("#freeClub").onchange = (e) => { S.clubId = e.target.value; save(); };
  $("#freeView").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.view = b.dataset.v; save(); $("#freeView").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); };
  $("#goFree").onclick = () => app.start("free");
  $("#logRound").onclick = () => openRound(null);
  $("#toProfile").onclick = () => go("profile");
  $("#contRound") && ($("#contRound").onclick = () => openRound(null));
}

// ---------------- History ----------------
function dayMarks() {
  const all = realSessions(), rates = all.filter((s) => !s.calib).map(badRate).filter((x) => x != null);
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null, marks = {};
  for (const s of all) { const m = (marks[dayKey(s.start)] ??= { sessions: [], rates: [], rounds: [] }); m.sessions.push(s); const r = badRate(s); if (r != null && !s.calib) m.rates.push(r); }
  for (const r of DB.rounds) (marks[dayKey(r.date)] ??= { sessions: [], rates: [], rounds: [] }).rounds.push(r);
  for (const m of Object.values(marks)) { if (!m.sessions.length) m.kind = ""; else if (!m.rates.length || avg == null) m.kind = "dot"; else m.kind = m.rates.reduce((a, b) => a + b, 0) / m.rates.length <= avg ? "circle" : "square"; }
  return marks;
}
function renderHistory() {
  const el = $("#tab-history"), marks = dayMarks(), y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first = new Date(y, mo, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(), todayK = dayKey(Date.now());
  let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span class="dow">${d}</span>`).join("");
  for (let i = 0; i < startDow; i++) cells += "<span></span>";
  for (let d = 1; d <= days; d++) { const k = `${y}-${mo + 1}-${d}`, m = marks[k]; cells += `<button data-k="${k}" class="${k === todayK ? "today" : ""} ${k === selDay ? "sel" : ""}">${m?.kind ? `<span class="mk ${m.kind}"></span>` : ""}${m?.rounds.length ? '<span class="flag"></span>' : ""}${d}</button>`; }
  const inMonth = (t) => { const d = new Date(t); return d.getFullYear() === y && d.getMonth() === mo; };
  const sess = selDay ? (marks[selDay]?.sessions || []) : realSessions().filter((s) => inMonth(s.start));
  const rounds = selDay ? (marks[selDay]?.rounds || []) : DB.rounds.filter((r) => inMonth(r.date));
  el.innerHTML = `
    <header class="lt"><p class="greet">${plural(realSessions().length, "session")}, ${plural(DB.rounds.length, "round")}</p><h1>History</h1></header>
    <section class="panel">
      <div class="cal-head"><button id="mPrev" aria-label="Previous month">&lsaquo;</button><h2>${first.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h2><button id="mNext" aria-label="Next month">&rsaquo;</button></div>
      <div class="cal" id="cal">${cells}</div>
      <div class="legend"><span><i></i>Better than your average</span><span><i class="square"></i>Worse</span><span><i class="dot"></i>Calibration or no flights</span><span><i class="flag"></i>Round</span></div>
    </section>
    <section class="panel">
      <div class="sect"><h2>${selDay ? "That day" : "This month"}</h2>${selDay ? '<button class="linkbtn" id="allMonth">Whole month</button>' : ""}</div>
      ${sess.length || rounds.length ? `<div class="rows">
        ${sess.slice().reverse().map((s) => { const st = sessionStats(s), r = badRate(s); return `<button data-s="${s.id}"><b>${fmtDate(s.start)}, ${vName(s.venue)}</b><span class="r">${st.n}</span><small>${kindOf(s)}${r != null ? `, ${Math.round(r * 100)}% bad shots` : ""}</small><small>swings</small></button>`; }).join("")}
        ${rounds.slice().reverse().map((r) => { const sc = (r.holes || []).reduce((a, h) => a + (h.score || 0), 0); return `<button data-r="${r.id}"><b>${fmtDate(r.date)}, ${esc(r.course || "Round")}</b><span class="r">${sc || "–"}</span><small>Round, ${r.holes.length} holes</small><small>strokes</small></button>`; }).join("")}
      </div>` : `<p class="muted">Nothing here yet. Sessions and rounds show up on the calendar like a scorecard.</p>`}
    </section>`;
  $("#mPrev").onclick = () => { calMonth = new Date(y, mo - 1, 1); selDay = null; renderHistory(); };
  $("#mNext").onclick = () => { calMonth = new Date(y, mo + 1, 1); selDay = null; renderHistory(); };
  $("#cal").onclick = (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; selDay = marks[b.dataset.k] ? b.dataset.k : null; renderHistory(); };
  $("#allMonth") && ($("#allMonth").onclick = () => { selDay = null; renderHistory(); });
  el.querySelectorAll(".rows button[data-s]").forEach((b) => (b.onclick = () => openReport(b.dataset.s, "history")));
  el.querySelectorAll(".rows button[data-r]").forEach((b) => (b.onclick = () => openRound(b.dataset.r)));
}

// ---------------- Progress ----------------
function lineChart(points, { max = 1, fmt = (v) => Math.round(v * 100) + "%", label = "" } = {}) {
  const W = 340, H = 150, Lm = 36, R = 12, T = 10, B = 24;
  const x = (i) => Lm + (points.length === 1 ? (W - Lm - R) / 2 : (i * (W - Lm - R)) / (points.length - 1)), y = (v) => T + (1 - v / max) * (H - T - B);
  const grid = [0, 0.5, 1].map((g) => `<line x1="${Lm}" x2="${W - R}" y1="${y(g * max)}" y2="${y(g * max)}" stroke="var(--line)"/><text x="${Lm - 6}" y="${y(g * max) + 4}" text-anchor="end">${fmt(g * max)}</text>`).join("");
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const labels = points.map((p, i) => (points.length <= 6 || i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === points.length - 1 && points.length > 1 ? "end" : i === 0 && points.length > 1 ? "start" : "middle"}">${p.label}</text>` : "")).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${grid}<path d="${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="var(--tint)"/><path d="${path}" fill="none" stroke="var(--olive)" stroke-width="2.4"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === points.length - 1 ? 4.5 : 3}" fill="var(--olive)"/>`).join("")}${labels}</svg>`;
}
function spark(vals) {
  const W = 90, H = 26, pts = vals.map((v, i) => (v == null ? null : [4 + (i * (W - 8)) / Math.max(1, vals.length - 1), 3 + (1 - v) * (H - 6)])).filter(Boolean);
  return pts.length ? `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("")}" fill="none" stroke="var(--bad)" stroke-width="1.8"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2.6" fill="var(--bad)"/></svg>` : "";
}
function renderProgress() {
  const el = $("#tab-progress"), all = realSessions(), rs = roundStats(DB.rounds), sd = stockDistances(DB.sessions);
  if (!all.length && !rs) { el.innerHTML = `<header class="lt"><p class="greet">Your trend over time</p><h1>Progress</h1></header><section class="panel">${empty("chart", "Nothing to show yet", "After your first sessions you see bad shots per session, your tempo, your distances per club and how each fault is going. Rounds you log show here too.")}<button class="btn quiet" id="emptyGo">Plan today's session</button></section>`; $("#emptyGo").onclick = () => go("today"); return; }
  const pts = all.filter((s) => !s.calib && badRate(s) != null).slice(-12).map((s) => ({ label: fmtDate(s.start, { day: "numeric", month: "short" }), v: badRate(s) }));
  const tempo = all.map((s) => { const t = (s.swings || []).filter((w) => !w.practice && w.m?.tempoRatio && clubById(w.clubId).group !== "putt").map((w) => w.m.tempoRatio).sort((a, b) => a - b); return t.length >= 3 ? { label: fmtDate(s.start, { day: "numeric", month: "short" }), v: t[Math.floor(t.length / 2)] } : null; }).filter(Boolean).slice(-12);
  const cs = catStats(DB.sessions, 3), cats = Object.entries(cs).sort((a, b) => (b[1].score ?? -1) - (a[1].score ?? -1));
  const recent = all.slice(-8), perRule = {};
  for (const s of recent) for (const f of sessionStats(s).faults) (perRule[f.id] ??= {})[s.id] = f.n ? f.fail / f.n : null;
  const topRules = Object.keys(perRule).filter((id) => ruleById(id)?.conf === "high").map((id) => ({ id, vals: recent.map((s) => perRule[id][s.id] ?? null) })).map((r) => ({ ...r, last: [...r.vals].reverse().find((x) => x != null) ?? 0 })).sort((a, b) => b.last - a.last).slice(0, 6);
  const sdRows = BAG.filter((c) => sd[c.id]);
  const f = (v) => (v == null ? "–" : Math.round(v * 100) + "%");
  el.innerHTML = `
    <header class="lt"><p class="greet">${plural(all.length, "session")}, ${plural(DB.rounds.length, "round")}</p><h1>Progress</h1></header>
    <section class="panel"><h2>Bad shots per session</h2>${pts.length >= 2 ? lineChart(pts, { label: "Bad shots per session" }) : `<p class="muted">Say how each ball flew and this line appears after two coached sessions. "Big" misses count more than "a bit".</p>`}</section>
    ${tempo.length >= 2 ? `<section class="panel"><h2>Tempo</h2><p class="muted small">How many times longer your backswing takes than your downswing (middle value per session). Higher is smoother.</p>${lineChart(tempo, { max: 4, fmt: (v) => v.toFixed(1), label: "Tempo per session" })}</section>` : ""}
    ${sdRows.length ? `<section class="panel"><h2>Your distances</h2><p class="muted small">From the distances you said at Swing Factory. Bad shots are left out once there are enough good ones.</p>
      <div class="card-scroll"><table class="score"><tr><th>Club</th><th class="c">Usual</th><th class="c">Range</th><th class="c">Shots</th></tr>${sdRows.map((c) => `<tr><td><b>${shortClub(c.id)}</b></td><td class="n nw">${sd[c.id].median} m</td><td class="c nw">${sd[c.id].min} to ${sd[c.id].max}</td><td class="c">${sd[c.id].n}</td></tr>`).join("")}</table></div></section>` : ""}
    ${rs ? `<section class="panel"><h2>On the course</h2>
      <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="stat"><b>${rs.avg18 ?? "–"}</b><span>Scoring average, 18 holes</span></div><div class="stat"><b>${rs.puttsPerHole ? (rs.puttsPerHole * 18).toFixed(0) : "–"}</b><span>Putts per round</span></div><div class="stat"><b>${f(rs.fairways)}</b><span>Fairways hit</span></div><div class="stat"><b>${f(rs.greens)}</b><span>Greens in regulation</span></div></div>
      <p class="small">Tee shot misses: <b>${f(rs.missLeft)} left</b>, <b>${f(rs.missRight)} right</b>. Out of bounds or water: ${rs.obLeft} left, ${rs.obRight} right. Three putts: ${rs.threePutts}. Penalty strokes: ${rs.penalties}.</p>
      <p class="muted small">Your goal: under 100 by the end of the year.${rs.avg18 ? ` You are ${rs.avg18 < 100 ? "already there on average" : `${rs.avg18 - 99} strokes away on average`}.` : ""}</p></section>` : ""}
    ${cats.length ? `<section class="panel"><h2>Clubs lately</h2><p class="muted small">Your last three sessions. The plan gives more balls to the club at the top.</p>
      <div class="card-scroll"><table class="score"><tr><th>Group</th><th class="c">Swings</th><th class="c">Bad</th><th class="c">Faults</th></tr>${cats.map(([c, o], i) => `<tr><td><b>${CATS[c]?.name || c}</b>${i === 0 && o.score != null ? '<span class="tag">weakest</span>' : ""}</td><td class="n">${o.n}</td><td class="n">${o.logged ? Math.round(100 * Math.min(1, o.badRate)) + "%" : "–"}</td><td class="n">${o.checks ? pct(o.fails, o.checks) + "%" : "–"}</td></tr>`).join("")}</table></div></section>` : ""}
    <section class="panel"><h2>Faults over time</h2>${topRules.length ? `<div>${topRules.map((r) => `<div class="field"><span><b>${esc(ruleById(r.id).title)}</b><br><small class="muted">${Math.round(r.last * 100)}% of swings last time</small></span>${spark(r.vals)}</div>`).join("")}</div>` : `<p class="muted">Faults appear here once the app starts coaching you, after calibration.</p>`}</section>
    <section class="panel"><h2>Fixed</h2>${DB.coach.mastered.length ? [...new Set(DB.coach.mastered)].map((id) => `<p><b>${esc(ruleById(id)?.title)}</b> <span class="tag">fixed</span></p>`).join("") : `<p class="muted">Nothing fixed yet. A fault counts as fixed after 4 good swings out of 5.</p>`}</section>`;
}

// ---------------- Library ----------------
const TOPICS = [
  ["Setup", "Checked before each shot", ["stance", "ballpos", "hinge", "knees", "reach", "weightset", "tilt", "handsahead", "forearms", "heels", "setup-steps", "aim"]],
  ["Grip", "Read and practise", ["grip-left", "grip-right", "grip-style", "grip-check", "grip-palm"]],
  ["The swing", "Checked after each shot", ["arms", "tempo", "sway", "posture", "feet", "transfer"]],
  ["Irons", "Contact", ["stayleft", "flip"]],
  ["Driver", "Direction and speed", ["upper", "driver-up", "speed", "strike"]],
  ["Chipping", "Pittwater chipping green", ["chipstance", "vshape", "pendulum", "chip-steps"]],
  ["Putting", "Pittwater putting green", ["eyesover", "headstill", "putt-setup", "putt-grip", "putt-stroke"]],
  ["Bunker", "Pittwater bunker", ["bunker"]],
];
const FRAME_OF = { arms: 1, sway: 1, tempo: 1, posture: 2, stayleft: 2, upper: 2, flip: 2, feet: 3, transfer: 3 };
function campDiagram() {
  return `<svg class="diagram" viewBox="0 0 340 300" role="img" aria-label="Top view of where to put the phone">
    <path d="M170 250 L170 40" stroke="var(--line2)" stroke-width="2" stroke-dasharray="6 6"/>
    <path d="M170 18v34M170 18l18 7-18 7" stroke="var(--olive)" stroke-width="2.4" fill="none"/><text x="196" y="30">Target</text>
    <circle cx="170" cy="168" r="6" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/><text x="180" y="186">Ball</text>
    <ellipse cx="128" cy="168" rx="16" ry="26" fill="var(--tint)" stroke="var(--olive)" stroke-width="2"/><circle cx="128" cy="168" r="9" fill="var(--olive)"/><text x="70" y="140">You</text>
    <circle cx="150" cy="176" r="4" fill="var(--gold)"/><text x="88" y="214">Hands</text>
    <g transform="translate(276 154)"><rect width="18" height="30" rx="4" fill="var(--olive)"/><text x="-28" y="50">In front, 3 m</text></g><path d="M272 169 L180 169" stroke="var(--olive)" stroke-width="1.5" stroke-dasharray="3 4"/>
    <g transform="translate(141 252)"><rect width="18" height="30" rx="4" fill="var(--gold)"/><text x="26" y="20">Behind, 3 m</text></g><path d="M150 250 L150 182" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="3 4"/>
  </svg>`;
}
function tipHtml(r) {
  const v = VIDEOS[r.src], a = artFor(r.id);
  const tags = r.auto ? `<span class="tag">${r.kind === "setup" ? "before the shot" : "after the shot"}, ${r.view === "dtl" ? "camera behind" : r.view === "face" ? "camera in front" : "any camera"}</span>${r.conf === "low" ? '<span class="tag weak">weak measurement</span>' : ""}` : "";
  const pics = !a ? "" : a.block ? a.block() : `<div class="cmp ${a.bad ? "" : "one"}" data-tip="${r.id}">${a.figure("good")}${a.bad ? a.figure("bad") : ""}</div>`;
  return `<div class="tip"><h3>${esc(r.title)}${tags}</h3>${pics}<p>${esc(r.rule)}</p><small>${v.url ? `<a href="${v.url}" target="_blank" rel="noopener">${v.who}: ${esc(v.title)}</a>` : esc(v.title)}</small><div class="you" data-you="${r.id}"></div></div>`;
}
async function loadYou(root) {
  for (const el of root.querySelectorAll("[data-you]")) {
    const id = el.dataset.you, sid = DB.coach.lastPass?.[id] || null;
    if (!sid || sid === true) continue;
    const fr = await frames.get(sid); if (!fr) continue;
    el.innerHTML = `<div class="cmp one"><figure><span class="badge you">You, done right</span><img alt="Your swing" src="${fr[FRAME_OF[id] ?? 0]}"></figure></div>`;
  }
}
function renderLibrary() {
  const el = $("#tab-library");
  el.innerHTML = `
    <header class="lt"><p class="greet">Everything here comes from your Golf bible playlist</p><h1>Library</h1></header>
    <details class="chap" open><summary><h2>How a session works</h2></summary><div class="body"><ol class="steps">
      <li>Earphones in. Choose Pittwater or Swing Factory and how many balls or minutes you have.</li>
      <li>The app tells you which club to take, how many balls and where the camera goes.</li>
      <li>Stand the phone upright about 3 m away at hand height, with your whole body and the ball in the picture.</li>
      <li>Take your setup and stay still. The app checks your setup and tells you one thing at a time. When it says "Ready", hit.</li>
      <li>Two seconds later you hear the main correction and the reason, or "Good".</li>
      <li>Say how the ball flew in your own words, and at Swing Factory the distance. Practice swings next to the ball are ignored on their own.</li>
      <li>Say "pause" when a friend hits and "resume" when you are back.</li>
      <li>At the end, tap End twice and open your report.</li></ol></div></details>
    <details class="chap"><summary><h2>The full swing</h2><span class="muted small">17 positions</span></summary><div class="body">${sequenceArt() || `<ol class="seq-labels">${SEQ_LABELS.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`}
      <p class="muted small">Swipe through the swing. Face on, a 7 iron.</p></div></details>
    <details class="chap"><summary><h2>Where to put the camera</h2></summary><div class="body">${campDiagram()}
      <p><b>In front</b>: facing your chest, across the ball. It checks stance, ball position, weight, turn, sway, balance and finish.</p>
      <p><b>Behind</b>: on the line from your hands to the target. It checks your posture from the hips, knees, distance to the ball and your arms.</p>
      <p class="muted">The gold silhouette on the camera is your best setup so far. Match it before you hit.</p></div></details>
    <details class="chap"><summary><h2>Voice words</h2></summary><div class="body">
      <p class="muted">The camera sees your body, not the ball's flight. Your words are how the app learns your results. Speak after the app stops talking, within 40 seconds of the swing.</p>
      <dl class="words">${VOICE_HELP.map(([w, d]) => `<dt>${esc(w)}</dt><dd>${esc(d)}</dd>`).join("")}</dl></div></details>
    ${TOPICS.map(([name, sub, ids]) => `<details class="chap"><summary><h2>${name}</h2><span class="muted small">${sub}</span></summary><div class="body">${ids.map((id) => ruleById(id)).filter(Boolean).map(tipHtml).join("")}</div></details>`).join("")}
    <details class="chap"><summary><h2>The videos</h2></summary><div class="body">${Object.values(VIDEOS).filter((v) => v.url).map((v) => `<p><a href="${v.url}" target="_blank" rel="noopener">${esc(v.title)}</a><br><small class="muted">${v.who}</small></p>`).join("")}</div></details>`;
  el.querySelectorAll("details.chap").forEach((d) => d.addEventListener("toggle", () => d.open && loadYou(d), { once: true }));
}

// ---------------- Profile ----------------
let clearArmed = 0;
const PRECHECK_NAMES = { stance: "Stance width", chipstance: "Chip stance", ballpos: "Ball position", reach: "Distance to the ball", hinge: "Lean from the hips", knees: "Knee flex", weightset: "Weight on the front foot", tilt: "Shoulder tilt", forearms: "Forearms (Danny Maude)", handsahead: "Hands ahead", eyesover: "Eyes over the ball (putting)" };
function renderProfile() {
  const el = $("#tab-profile"), P = S.profile, initials = P.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "MP";
  const lastCal = DB.sessions.filter((s) => s.calib && (s.swings || []).length).at(-1);
  const vs = app?.voices ? app.voices() : [];
  el.innerHTML = `
    <header class="lt"><p class="greet">Your details and settings</p><h1>Profile</h1></header>
    <p class="group-title">Player</p>
    <section class="panel"><div class="me"><div class="avatar">${esc(initials)}</div><div><h2>${esc(P.name)}</h2><p class="muted">${esc(P.hand)} handed, ${esc(P.height)} cm, ${esc(P.level.toLowerCase())}, Vardon grip</p></div></div></section>
    <p class="group-title">Practice and coaching</p>
    <section class="panel"><h2>Calibration</h2>
      <p class="muted">${lastCal ? `Last calibration on ${fmtDate(lastCal.start)}: ${lastCal.swings.filter((w) => !w.practice).length} swings, voice ${lastCal.calib.mic === "ok" ? "worked" : lastCal.calib.mic === "no" ? "not heard" : "off"}.` : "No calibration yet. Do one full session first."}</p>
      ${lastCal ? `<button class="btn olive" id="pExport">Export calibration file for Claude</button>` : ""}
      <button class="btn quiet" id="pCalib">${lastCal ? "Run another calibration" : "Start calibration"}</button></section>
    <section class="panel"><h2>About you</h2><div style="display:grid;gap:12px">
      <label class="field" for="pName">Name the voice uses <input type="text" id="pName" value="${esc(P.name)}"></label>
      <label class="field" for="pHeight">Height in cm <input type="number" id="pHeight" value="${esc(P.height)}" min="140" max="220"></label>
      <label class="field" for="pLevel">Level <select id="pLevel">${["Beginner", "Intermediate", "Advanced"].map((l) => `<option ${l === P.level ? "selected" : ""}>${l}</option>`).join("")}</select></label></div></section>
    <section class="panel"><h2>Your bag</h2><p class="muted small">Only these clubs go into your plans.</p>
      <div class="bag" id="bag">${BAG.map((c) => `<label for="bag_${c.id}"><input type="checkbox" id="bag_${c.id}" data-id="${c.id}" ${S.bag.includes(c.id) ? "checked" : ""}>${c.name}</label>`).join("")}</div></section>
    <section class="panel"><h2>Coaching</h2>
      <span class="lbl">After the shot</span>
      <div class="pills" id="pMode"><button data-m="1" aria-pressed="${S.mode === 1}">Only the main thing</button><button data-m="3" aria-pressed="${S.mode === 3}">Main thing, then details</button></div>
      <div style="display:grid;gap:12px">
        <label class="field" for="pReason">Say the reason too <input type="checkbox" id="pReason" ${S.reason ? "checked" : ""}></label>
        <label class="field" for="pPre">Check my setup before each shot <input type="checkbox" id="pPre" ${S.preshot ? "checked" : ""}></label>
        <label class="field" for="pAuto">Ignore practice swings on their own <input type="checkbox" id="pAuto" ${S.autoPractice ? "checked" : ""}></label>
        <label class="field" for="pGhost">Show my best setup on the camera <input type="checkbox" id="pGhost" ${S.ghost ? "checked" : ""}></label>
        <label class="field" for="pAsk">Ball flight buttons on screen <input type="checkbox" id="pAsk" ${S.ask ? "checked" : ""}></label>
      </div>
      <span class="lbl">What the setup check looks at</span>
      <div class="pills" id="pChecks">${Object.entries(PRECHECK_NAMES).map(([id, n]) => `<button data-id="${id}" aria-pressed="${S.prechecks.includes(id)}">${n}</button>`).join("")}</div>
      <p class="muted small">Forearms and hands ahead are weak measurements: they are logged, not spoken, until calibration proves them. Alignment needs a club on the ground, so it is not checked yet.</p></section>
    <p class="group-title">Voice and listening</p>
    <section class="panel"><h2>Voice</h2>
      <p class="muted small">A natural recorded voice says everything the coach knows. It is an open source neural voice, recorded once and stored with the app, so it costs nothing and works without signal once downloaded.</p>
      <span class="lbl">Coach voice</span>
      <div class="pills" id="pVoiceId">${Object.entries(app?.speech?.VOICES || {}).map(([id, n]) => `<button data-v="${id}" aria-pressed="${(S.voiceId || "michael") === id}">${n}</button>`).join("")}</div>
      <div style="display:grid;gap:12px">
        <label class="field" for="pVoiceOn">Speak the feedback <input type="checkbox" id="pVoiceOn" ${S.voice ? "checked" : ""}></label>
        <label class="field" for="pSpeed">Speed <input type="range" id="pSpeed" min="0.85" max="1.15" step="0.05" value="${S.voiceSpeed || 1}"></label>
        <label class="field" for="pMic">Listen to my words <input type="checkbox" id="pMic" ${S.mic ? "checked" : ""}></label>
        <label class="field" for="pLang">I speak mostly in <select id="pLang">${[["en-US", "English"], ["es-US", "Spanish (US)"], ["es-CL", "Spanish (Chile)"], ["es-ES", "Spanish (Spain)"]].map(([v, n]) => `<option value="${v}" ${v === S.voiceLang ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      </div>
      ${app?.listen?.reason === "homescreen" ? `<div class="note warn"><b>Listening needs Safari.</b> iPhone does not let apps opened from the Home Screen use speech recognition. For voice commands open the app in Safari, or add it again with "Open as Web App" turned off.<a class="btn sm olive" href="${app.listen.safariLink()}">Open in Safari</a></div>` : ""}
      <button class="btn quiet" id="pTest">Test the voice</button>
      <button class="btn line" id="pDl">Download the voice for offline use</button>
      <details class="why"><summary>Backup voice</summary><p>Used only for a sentence that was never recorded, like a new name.</p>
        <label class="field" for="pVoice">Backup voice <select id="pVoice"><option value="">Best available</option>${vs.map((v) => `<option value="${esc(v.name)}" ${v.name === S.voiceName ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label></details>
      <p class="muted small">You mix languages. English listening understands your golf words best; Spanish directions like "derecha" work too. The report lists every word it did not understand.</p></section>
    <p class="group-title">Data and privacy</p>
    <section class="panel"><h2>Your data</h2><p class="muted small">Everything is saved only on this phone. Export a backup to Files from time to time.</p>
      <button class="btn line" id="pBackup">Export a backup</button><button class="btn line" id="pReset">Restart the focus</button><button class="btn line" id="pClear" style="color:var(--error)">Delete all history</button></section>
    <p class="muted small">Scratch Golfer Dreams, version 9. Rules from 9 videos in your Golf bible playlist. Voice: Kokoro, Apache 2.0.</p>`;
  const bind = (id, fn) => ($("#" + id).onchange = (e) => { fn(e.target); save(); });
  bind("pName", (t) => (P.name = t.value.trim() || "Mariano")); bind("pHeight", (t) => (P.height = Number(t.value) || 185)); bind("pLevel", (t) => (P.level = t.value));
  bind("pReason", (t) => (S.reason = t.checked)); bind("pPre", (t) => (S.preshot = t.checked)); bind("pAuto", (t) => (S.autoPractice = t.checked)); bind("pGhost", (t) => (S.ghost = t.checked)); bind("pAsk", (t) => (S.ask = t.checked));
  bind("pVoiceOn", (t) => { S.voice = t.checked; app.applyVoiceSettings(); }); bind("pVoice", (t) => { S.voiceName = t.value; app.applyVoiceSettings(); }); bind("pSpeed", (t) => { S.voiceSpeed = Number(t.value); app.applyVoiceSettings(); });
  bind("pMic", (t) => (S.mic = t.checked)); bind("pLang", (t) => (S.voiceLang = t.value));
  $("#bag").onchange = () => { S.bag = [...el.querySelectorAll("#bag input:checked")].map((x) => x.dataset.id); save(); };
  $("#pMode").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.mode = Number(b.dataset.m); save(); renderProfile(); };
  $("#pChecks").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const id = b.dataset.id; S.prechecks = S.prechecks.includes(id) ? S.prechecks.filter((x) => x !== id) : [...S.prechecks, id]; save(); b.setAttribute("aria-pressed", String(S.prechecks.includes(id))); };
  $("#pTest").onclick = () => { app.speech.unlock(); app.say(T.testVoice(P.name), { force: true }); };
  $("#pVoiceId").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.voiceId = b.dataset.v; save(); app.applyVoiceSettings(); $("#pVoiceId").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); app.speech.unlock(); app.say(T.testVoice(P.name), { force: true }); };
  $("#pDl").onclick = async () => { const btn = $("#pDl"); btn.disabled = true; const ok = await app.speech.downloadAll((d, n) => (btn.textContent = `Downloading the voice, ${Math.round((100 * d) / n)}%`)); btn.textContent = ok ? "Voice saved for offline use" : "Could not download, try with signal"; btn.disabled = false; };
  $("#pCalib").onclick = () => app.start("calib");
  $("#pExport") && ($("#pExport").onclick = () => exportSession(lastCal.id, $("#pExport")));
  $("#pBackup").onclick = async () => { const r = await giveFile(`scratch-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(DB)); $("#pBackup").textContent = r === "cancelled" ? "Export a backup" : "Backup ready"; };
  $("#pReset").onclick = () => { resetCoach(); $("#pReset").textContent = "Focus restarted"; };
  $("#pClear").onclick = async () => { if (await confirmDialog("Delete all history?", "Every session, round and swing picture on this phone is removed. This cannot be undone. Export a backup first if you want to keep it.", "Delete everything")) { clearHistory(); renderProfile(); toast("History deleted"); } };
}

// ---------------- Report ----------------
async function exportSession(sid, btn) {
  const s = DB.sessions.find((x) => x.id === sid); if (!s) return;
  btn.textContent = "Preparing…";
  const pics = {};
  for (const w of s.swings || []) { const f = await frames.get(w.id); if (f) pics[w.id] = f; }
  const pack = { app: "Scratch Golfer Dreams", version: 8, exported: new Date().toISOString(), profile: S.profile, settings: { prechecks: S.prechecks, voiceLang: S.voiceLang }, report: reportText(DB.sessions, sid, DB.coach), session: s, frames: pics };
  const r = await giveFile(`${s.calib ? "calibration" : "session"}-${new Date(s.start).toISOString().slice(0, 10)}.json`, JSON.stringify(pack));
  btn.textContent = r === "cancelled" ? "Export the file for Claude" : "File ready. Attach it in your chat with Claude.";
}
async function copyText(text, btn, label) {
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch (e) { btn.textContent = "Copy failed, try again"; }
  setTimeout(() => (btn.textContent = label), 2500);
}
export function openReport(sid, from = "history") {
  reportFrom = from; showOnly("report");
  const el = $("#screen-report"), s = DB.sessions.find((x) => x.id === sid);
  if (!s) { el.innerHTML = `<button class="linkbtn" id="rBack">&lsaquo; Back</button><p class="muted">This session was not found.</p>`; $("#rBack").onclick = () => go(reportFrom); return; }
  const st = sessionStats(s), r = badRate(s), notes = coachNotes(s, DB.sessions, DB.coach), per = {};
  for (const w of (s.swings || []).filter((w) => !w.practice)) {
    const o = (per[w.clubId] ??= { n: 0, logged: 0, straight: 0, bad: 0, dist: [], checks: 0, fails: 0 }), rs = resOf(w);
    o.n++; if (rs?.result) { o.logged++; if (rs.result === "straight") o.straight++; if (badWeight(rs) >= 1) o.bad++; } if (rs?.distance) o.dist.push(rs.distance);
    for (const c of w.checks || []) { if (ruleById(c.id)?.conf !== "high") continue; o.checks++; if (!c.pass) o.fails++; }
  }
  const rows = Object.entries(per).sort((a, b) => BAG.findIndex((c) => c.id === a[0]) - BAG.findIndex((c) => c.id === b[0]));
  const flights = Object.entries(st.results).sort((a, b) => b[1] - a[1]), logged = flights.reduce((a, [, n]) => a + n, 0);
  const setupF = st.faults.filter((f) => ruleById(f.id)?.kind === "setup"), motionF = st.faults.filter((f) => ruleById(f.id)?.kind === "motion");
  const bars = (list) => list.map((f) => `<div class="bar"><span>${esc(ruleById(f.id)?.title || f.id)}${ruleById(f.id)?.conf === "low" ? '<span class="tag weak">weak</span>' : ""}</span><span class="num muted">${f.fail}/${f.n}</span><i><span style="width:${f.rate}%"></span></i></div>`).join("");
  const real = (s.swings || []).filter((w) => !w.practice && resOf(w)?.result);
  const best = real.filter((w) => resOf(w).result === "straight").sort((a, b) => (a.checks || []).filter((c) => !c.pass).length - (b.checks || []).filter((c) => !c.pass).length)[0];
  const worst = real.slice().sort((a, b) => badWeight(resOf(b)) - badWeight(resOf(a)) || (b.checks || []).filter((c) => !c.pass).length - (a.checks || []).filter((c) => !c.pass).length)[0];
  const unknown = (s.voiceLog || []).filter((v) => !v.parsed && !v.duringSpeech).slice(-20);
  el.innerHTML = `
    <button class="linkbtn" id="rBack">&lsaquo; ${reportFrom === "today" ? "Today" : "History"}</button>
    <header class="lt"><p class="greet">${kindOf(s)}, ${vName(s.venue)}</p><h1>${fmtDate(s.start, { weekday: "long", day: "numeric", month: "long" })}</h1></header>
    ${s.calib ? `<section class="panel hero"><h2>Send this to Claude</h2><p class="muted">The file has every swing, your words and the pictures. Attach it in your chat with Claude and the rules get tuned to you.</p><button class="btn" id="rExport">Export the file for Claude</button></section>` : ""}
    <section class="panel"><div class="stats"><div class="stat"><b>${st.n}</b><span>swings</span></div><div class="stat"><b>${r == null ? "–" : Math.round(r * 100) + "%"}</b><span>bad shots</span></div><div class="stat"><b>${st.practice}</b><span>practice, ignored</span></div></div></section>
    <section class="panel"><h2>Coach notes</h2><div class="notes">${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div></section>
    ${best || worst ? `<section class="panel"><h2>Best and worst swing</h2>${best ? `<p class="small"><b>Best</b>: ${clubById(best.clubId).name}, ${esc(resultLabel(resOf(best)))}</p><div class="frames" data-f="${best.id}"></div>` : ""}${worst && worst !== best ? `<p class="small"><b>Worst</b>: ${clubById(worst.clubId).name}, ${esc(resultLabel(resOf(worst)))}</p><div class="frames" data-f="${worst.id}"></div>` : ""}</section>` : ""}
    <section class="panel"><h2>By club</h2><div class="card-scroll"><table class="score"><tr><th>Club</th><th class="c">Balls</th><th class="c">Straight</th><th class="c">Bad</th><th class="c">Dist.</th></tr>
      ${rows.map(([id, o]) => { const d = o.dist.sort((a, b) => a - b); return `<tr><td><b>${shortClub(id)}</b></td><td class="n">${o.n}</td><td class="n">${o.logged ? o.straight : "–"}</td><td class="n">${o.logged ? o.bad : "–"}</td><td class="c nw">${d.length ? d[Math.floor(d.length / 2)] + " m" : "–"}</td></tr>`; }).join("")}</table></div></section>
    ${setupF.length ? `<section class="panel"><h2>Setup, before the shot</h2>${bars(setupF)}</section>` : ""}
    ${motionF.length ? `<section class="panel"><h2>Swing, after the shot</h2>${bars(motionF)}</section>` : ""}
    ${logged ? `<section class="panel"><h2>Ball flight</h2>${flights.map(([k, n]) => `<div class="bar ${k === "straight" ? "good" : ""}"><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="num muted">${n}</span><i><span style="width:${pct(n, logged)}%"></span></i></div>`).join("")}</section>` : ""}
    ${unknown.length ? `<section class="panel"><h2>Words not understood</h2><p class="muted small">Claude uses these to teach the app your way of talking.</p><p>${unknown.map((v) => `"${esc(v.text)}"`).join(", ")}</p></section>` : ""}
    <section class="panel"><h2>The full report</h2><p class="muted small">Text version for Claude, if you prefer to paste it.</p>
      <button class="btn line" id="rCopy">Copy report</button>${s.calib ? "" : `<button class="btn line" id="rExport2">Export the file</button>`}
      <details class="why"><summary>Show the report text</summary><pre class="rep">${esc(reportText(DB.sessions, s.id, DB.coach))}</pre></details></section>
    <button class="linkbtn" id="rDel" style="color:var(--error);justify-self:start">Delete this session</button>`;
  $("#rBack").onclick = () => go(reportFrom);
  // Delete one session (a test, say). Undo for a few seconds; its swing pictures are removed after that.
  $("#rDel").onclick = async () => {
    if (!(await confirmDialog("Delete this session?", "It leaves your history and stats. You can undo for a few seconds.", "Delete session"))) return;
    const k = DB.sessions.findIndex((x) => x.id === s.id); if (k < 0) return;
    const [gone] = DB.sessions.splice(k, 1); save(); go("history"); let undone = false;
    toast("Session deleted", () => { undone = true; DB.sessions.splice(k, 0, gone); save(); go("history"); });
    setTimeout(() => { if (!undone) for (const w of gone.swings || []) frames.del(w.id); }, 7000);
  };
  $("#rCopy").onclick = () => copyText(reportText(DB.sessions, s.id, DB.coach), $("#rCopy"), "Copy report");
  $("#rExport") && ($("#rExport").onclick = () => exportSession(s.id, $("#rExport")));
  $("#rExport2") && ($("#rExport2").onclick = () => exportSession(s.id, $("#rExport2")));
  el.querySelectorAll("[data-f]").forEach(async (d) => { const f = await frames.get(d.dataset.f); d.innerHTML = f ? f.map((u, i) => `<img alt="${["Setup", "Top", "Impact", "Finish"][i]}" src="${u}">`).join("") : `<p class="muted small" style="grid-column:1/-1">No pictures saved for this swing.</p>`; });
}

// ---------------- Round log ----------------
let draft = null, editing = false;
const blankHole = (i) => ({ n: i + 1, par: 4, score: null, putts: null, teeClub: "driver", tee: null, approach: null, pen: 0 });
export function openRound(id) {
  const existing = id && DB.rounds.find((r) => r.id === id);
  editing = !!existing;
  if (!existing && S.roundDraft) { draft = JSON.parse(JSON.stringify(S.roundDraft)); draft.cur ??= 0; showOnly("round"); renderRound(); return; }
  draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: Date.now().toString(36), date: Date.now(), course: DB.rounds.at(-1)?.course || "", holes: Array.from({ length: 18 }, (_, i) => blankHole(i)), note: "" };
  // Same course as last time: copy its pars so you only fill in what happened
  const prev = !existing && DB.rounds.filter((r) => r.course && r.course === draft.course).at(-1);
  if (prev) prev.holes.forEach((h, i) => draft.holes[i] && (draft.holes[i].par = h.par));
  draft.cur = 0; showOnly("round"); renderRound();
}
function chips(name, options, value) { return `<div class="pills" data-k="${name}">${Object.entries(options).map(([k, v]) => `<button data-v="${k}" aria-pressed="${value === k}">${v}</button>`).join("")}</div>`; }
const scoreClass = (sc, par) => { if (!sc) return ""; const d = sc - par; return d <= -2 ? "eagle" : d === -1 ? "birdie" : d === 1 ? "bogey" : d >= 2 ? "double" : ""; };
function scorecard(H) {
  const sum = (a, k) => a.reduce((t, h) => t + (h[k] || 0), 0), cols = [];
  const front = H.slice(0, 9), back = H.slice(9);
  const tot = (n, a) => ({ n, par: sum(a, "par"), score: sum(a, "score") || null, putts: sum(a, "putts") || null, tot: true });
  front.forEach((h) => cols.push(h)); cols.push(tot("Out", front));
  if (back.length) { back.forEach((h) => cols.push(h)); cols.push(tot("In", back)); cols.push(tot("Total", H)); }
  return `<div class="card-scroll"><table class="score"><tr><th>Hole</th>${cols.map((c) => `<th class="c">${c.n}</th>`).join("")}</tr>
    <tr><td class="lbl">Par</td>${cols.map((c) => `<td class="c${c.tot ? " n" : ""}">${c.par}</td>`).join("")}</tr>
    <tr><td class="lbl">Score</td>${cols.map((c) => c.tot ? `<td class="n">${c.score ?? "–"}</td>` : `<td class="c"><span class="sc ${scoreClass(c.score, c.par)}">${c.score ?? "·"}</span></td>`).join("")}</tr>
    <tr><td class="lbl">Putts</td>${cols.map((c) => `<td class="c${c.tot ? " n" : ""}">${c.putts ?? "·"}</td>`).join("")}</tr></table></div>
    <div class="legend"><span><i></i>Birdie</span><span><i class="square" style="border-color:var(--text-2)"></i>Bogey</span><span><i class="square"></i>Double bogey or worse</span></div>`;
}
function renderRound() {
  if (!editing) { S.roundDraft = draft; save(); }
  const el = $("#screen-round"), clubs = BAG.filter((c) => S.bag.includes(c.id) && c.group !== "putt"), H = draft.holes, i = draft.cur, h = H[i], last = i === H.length - 1;
  const tot = H.reduce((a, x) => a + (x.score || 0), 0), par = H.filter((x) => x.score).reduce((a, x) => a + x.par, 0), putts = H.reduce((a, x) => a + (x.putts || 0), 0), done = H.filter((x) => x.score).length;
  el.innerHTML = `
    <button class="linkbtn" id="rdBack">&lsaquo; Back</button>
    <header class="lt"><p class="greet">About 5 minutes, after the round</p><h1>${editing ? "Edit round" : "Log a round"}</h1></header>
    <section class="panel"><div style="display:grid;gap:12px">
      <label class="in" for="rdCourse">Course<input class="in-text" id="rdCourse" placeholder="For example Long Reef" value="${esc(draft.course)}" autocomplete="off"></label>
      <label class="in" for="rdDate">Date<input class="in-text" id="rdDate" type="date" value="${new Date(draft.date).toISOString().slice(0, 10)}"></label>
      <div class="seg" id="rdHoles" role="group" aria-label="Holes"><button data-n="9" aria-pressed="${H.length === 9}">9 holes</button><button data-n="18" aria-pressed="${H.length === 18}">18 holes</button></div></div></section>
    <section class="panel">
      <h2>Scorecard</h2><p class="muted small">${done ? `${tot} strokes, ${tot - par === 0 ? "level par" : (tot - par > 0 ? "+" : "") + (tot - par)} after ${plural(done, "hole")}. Tap a hole to change it.` : "Tap a hole to jump to it."}</p>
      ${done ? scorecard(H) : ""}
      <div class="hstrip" id="rdStrip">${H.map((x, k) => `<button data-i="${k}" ${k === i ? 'aria-current="true"' : ""} aria-label="Hole ${x.n}">${x.n}<b>${x.score ?? "·"}</b></button>`).join("")}</div>
    </section>
    <section class="panel hole" id="rdHole">
      <div class="hd"><b>Hole ${h.n}</b>${chips("par", { 3: "Par 3", 4: "Par 4", 5: "Par 5" }, String(h.par))}</div>
      <div class="big-step"><button data-step="score" data-d="-1" aria-label="One stroke less">&minus;</button><output aria-live="polite">${h.score ?? "–"}<small>${h.score ? `strokes, ${h.score - h.par === 0 ? "par" : (h.score - h.par > 0 ? "+" : "") + (h.score - h.par)}` : "tap + to start at par"}</small></output><button data-step="score" data-d="1" aria-label="One stroke more">+</button></div>
      <div class="hd"><span class="lbl">Putts</span>${chips("putts", { 0: "0", 1: "1", 2: "2", 3: "3", 4: "4+" }, h.putts == null ? null : String(h.putts))}</div>
      ${h.par >= 4 ? `<span class="lbl">Tee shot</span><select class="in-text" data-k="teeClub">${clubs.map((c) => `<option value="${c.id}" ${c.id === h.teeClub ? "selected" : ""}>${c.name}</option>`).join("")}</select>${chips("tee", TEE, h.tee)}` : ""}
      <span class="lbl">${h.par === 3 ? "Tee shot to the green" : "Shot into the green"}</span>${chips("approach", APPROACH, h.approach)}
      <div class="hd"><span class="lbl">Penalty strokes</span><span class="mini-step"><button data-step="pen" data-d="-1" aria-label="One less">&minus;</button><output>${h.pen || 0}</output><button data-step="pen" data-d="1" aria-label="One more">+</button></span></div>
      <div class="hnav">${i > 0 ? `<button class="btn quiet" id="rdPrev">&lsaquo; Hole ${i}</button>` : "<span></span>"}${last ? "" : `<button class="btn olive" id="rdNext">Hole ${i + 2} &rsaquo;</button>`}</div>
    </section>
    <section class="panel"><p class="muted small">${putts ? `${putts} putts so far. ` : ""}Everything you enter is kept while you log, even if you leave this screen.</p>
      <textarea class="in-text" id="rdNote" rows="3" placeholder="Anything else? You can dictate it with the keyboard microphone.">${esc(draft.note || "")}</textarea>
      <button class="btn" id="rdSave">${editing ? "Save changes" : "Save round"}</button>${editing ? `<button class="btn line" id="rdDel">Delete this round</button>` : done ? `<button class="linkbtn" id="rdDiscard" style="color:var(--error)">Discard this round</button>` : ""}</section>`;
  const keepY = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };
  $("#rdBack").onclick = () => go(editing ? "history" : "today");
  $("#rdCourse").oninput = (e) => (draft.course = e.target.value);
  $("#rdDate").onchange = (e) => (draft.date = new Date(e.target.value + "T12:00:00").getTime() || Date.now());
  $("#rdNote").oninput = (e) => (draft.note = e.target.value);
  $("#rdHoles").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const n = Number(b.dataset.n); draft.holes = n === 9 ? H.slice(0, 9) : [...H, ...Array.from({ length: 18 - H.length }, (_, k) => blankHole(H.length + k))]; draft.cur = Math.min(draft.cur, draft.holes.length - 1); keepY(renderRound); };
  $("#rdStrip").onclick = (e) => { const b = e.target.closest("button[data-i]"); if (!b) return; draft.cur = Number(b.dataset.i); keepY(renderRound); };
  $("#rdPrev") && ($("#rdPrev").onclick = () => { draft.cur--; keepY(renderRound); });
  $("#rdNext") && ($("#rdNext").onclick = () => { draft.cur++; keepY(renderRound); });
  $("#rdHole").onclick = (e) => {
    const st = e.target.closest("button[data-step]");
    if (st) { const k = st.dataset.step, d = Number(st.dataset.d); h[k] = h[k] == null ? (k === "score" ? h.par : Math.max(0, d)) : Math.max(k === "score" ? 1 : 0, h[k] + d); keepY(renderRound); return; }
    const b = e.target.closest(".pills[data-k] button"); if (!b) return;
    const k = b.parentElement.dataset.k, v = b.dataset.v;
    if (k === "par") { h.par = Number(v); if (h.par === 3) h.tee = null; keepY(renderRound); return; }
    if (k === "putts") h.putts = h.putts === Number(v) ? null : Number(v); else h[k] = h[k] === v ? null : v;
    if (k === "tee" && ["obl", "obr", "wl", "wr"].includes(v) && !h.pen) h.pen = 1;
    keepY(renderRound);
  };
  $("#rdHole").onchange = (e) => { if (e.target.dataset.k === "teeClub") h.teeClub = e.target.value; };
  $("#rdSave").onclick = () => { const { cur, ...r } = draft, k = DB.rounds.findIndex((x) => x.id === r.id); if (k >= 0) DB.rounds[k] = r; else DB.rounds.push(r); DB.rounds.sort((a, b) => a.date - b.date); delete S.roundDraft; save(); go("progress"); toast("Round saved"); };
  $("#rdDel") && ($("#rdDel").onclick = async () => {
    if (!(await confirmDialog("Delete this round?", "Its scores leave your stats. You can undo for a few seconds.", "Delete round"))) return;
    const gone = DB.rounds.find((r) => r.id === draft.id); DB.rounds = DB.rounds.filter((r) => r.id !== draft.id); save(); go("history");
    toast("Round deleted", () => { DB.rounds.push(gone); DB.rounds.sort((a, b) => a.date - b.date); save(); go("history"); });
  });
  $("#rdDiscard") && ($("#rdDiscard").onclick = async () => { if (!(await confirmDialog("Discard this round?", "The holes you logged are removed.", "Discard"))) return; delete S.roundDraft; save(); go("today"); });
}
