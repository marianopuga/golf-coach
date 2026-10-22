// Tabs: Today, History, Progress, Library, Profile, plus the session report screen.
import { CLUBS, VIDEOS, CAMERA, BAG, CATS, VOICE_HELP, BAD_RESULTS, clubById } from "./rules.js?v=5";
import { buildPlan, catStats, sessionStats, reportText, ruleById, coachNotes, badRate } from "./engine.js?v=5";
import { DB, S, save, resetCoach, clearHistory } from "./store.js?v=5";

const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const TABS = ["today", "history", "progress", "library", "profile"];
let current = "today", startFn = null, calMonth = new Date(), selDay = null, reportFrom = "history";

const CAM_ICON = '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/></svg>';
const camText = (v) => (v === "dtl" ? "Behind you" : "In front");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fmtDate = (t, o = { weekday: "short", day: "numeric", month: "short" }) => new Date(t).toLocaleDateString("en-AU", o);
const realSessions = () => DB.sessions.filter((s) => (s.swings || []).some((w) => !w.practice));
const kindOf = (s) => (s.calib ? "Calibration session" : s.plan ? "Planned session" : "Free practice");
const calibDone = () => DB.sessions.some((s) => s.calib && (s.swings || []).length >= 10);
const focusView = () => (DB.coach.focus ? ruleById(DB.coach.focus.id)?.view : null);

export function init({ start }) {
  startFn = start;
  $("#tabbar").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab); });
  go("today");
}
export function go(tab) {
  current = tab;
  for (const t of TABS) $("#tab-" + t).hidden = t !== tab;
  $("#screen-report").hidden = true; $("#tabbar").hidden = false;
  document.querySelectorAll("#tabbar button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  render(tab); window.scrollTo(0, 0);
}
export function refresh() { if (!$("#screen-report").hidden) return; render(current); }
function render(tab) { ({ today: renderToday, history: renderHistory, progress: renderProgress, library: renderLibrary, profile: renderProfile })[tab](); }
export function setModelState(text) { const el = $("#modelState"); if (el) el.textContent = text; S._modelState = text; }

// ---------------- Today ----------------
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function ring(good, n) {
  const r = 30, c = 2 * Math.PI * r, f = n ? good / 5 : 0;
  return `<svg class="ring" viewBox="0 0 76 76" aria-label="${good} of 5"><circle class="bg" cx="38" cy="38" r="${r}"/><circle class="fg" cx="38" cy="38" r="${r}" stroke-dasharray="${c * f} ${c}"/><text x="38" y="38">${good}/5</text></svg>`;
}
function renderToday() {
  const el = $("#tab-today");
  const plan = buildPlan(S.balls, S.bag, DB.sessions, focusView());
  const F = DB.coach.focus, fr = F && ruleById(F.id), l5 = F ? F.hist.slice(-5) : [];
  const weekAgo = Date.now() - 7 * 864e5;
  const week = realSessions().filter((s) => s.start >= weekAgo);
  const balls = week.reduce((a, s) => a + s.swings.filter((w) => !w.practice).length, 0);
  const last = realSessions().at(-1), lastBad = last ? badRate(last) : null;
  el.innerHTML = `
    <header class="lt"><p class="greet">${greeting()}, ${esc(S.profile.name)}</p><h1>Today</h1></header>
    ${calibDone() ? "" : `
    <section class="panel">
      <h2>Start with a calibration session</h2>
      <p class="muted">During the trial period, your first bucket is a calibration. Same clubs and order as a normal plan, every club from both camera sides, and no corrections. It tests the voice, checks that every swing is caught, and measures how your swing reads on camera. Then you paste the report to Claude to tune the rules.</p>
      <button class="btn" id="goCalib">Start calibration with ${S.balls} balls</button>
    </section>`}
    <section class="panel hero">
      <p class="muted">How many balls in your bucket?</p>
      <div class="stepper"><button id="bMinus" aria-label="Ten fewer balls">&minus;</button><output id="bOut">${S.balls}<small>balls</small></output><button id="bPlus" aria-label="Ten more balls">+</button></div>
      <div class="chips" id="bChips">${[50, 80, 100, 120].map((n) => `<button aria-pressed="${n === S.balls}">${n}</button>`).join("")}</div>
      <button class="btn" id="goPlan">${calibDone() ? "Start session" : "Start a normal session instead"}</button>
    </section>
    <section class="panel">
      <div class="sect"><h2>Your plan</h2><span class="muted small">${plan.blocks.length} blocks</span></div>
      <div class="card-scroll"><table class="score">
        <tr><th class="c">#</th><th>Club</th><th class="c">Balls</th><th>Camera</th></tr>
        ${plan.blocks.map((b, i) => `<tr><td class="n">${i + 1}</td><td><b>${b.name}</b><small>${esc(b.why)}</small></td><td class="n">${b.balls}</td><td><span class="cam">${CAM_ICON}${camText(b.view)}</span></td></tr>`).join("")}
        <tr class="tot"><td></td><td>Total</td><td class="n">${plan.total}</td><td></td></tr>
      </table></div>
      <details class="why"><summary>Why this order</summary>
        <p>You start with half swings to loosen up, then go from short clubs to long ones, so your body is warm before the driver. Chips come last, when you are tired and only need touch. The 7 iron gets the most balls because it is your reference club. Each club is split in two blocks so the camera sees it from both sides. After a few sessions, the club you hit worst moves to second place and comes back at the end as a retest.</p>
      </details>
      <button class="linkbtn" id="toggleFree">Free practice instead</button>
      <div id="freeBox" hidden style="display:grid;gap:10px">
        <label class="muted small" for="freeClub">Club</label>
        <select id="freeClub" class="btn line" style="font-family:var(--text);font-stretch:100%;font-size:1rem;font-weight:600">${BAG.filter((c) => S.bag.includes(c.id)).map((c) => `<option value="${c.id}" ${c.id === S.clubId ? "selected" : ""}>${c.name}</option>`).join("")}</select>
        <div class="seg" id="freeView"><button data-v="face" aria-pressed="${S.view === "face"}">Camera in front</button><button data-v="dtl" aria-pressed="${S.view === "dtl"}">Camera behind</button></div>
        <p class="muted small">${CAMERA[S.view]}</p>
        <button class="btn quiet" id="goFree">Start free practice</button>
      </div>
    </section>
    <section class="panel">
      <h2>Your focus</h2>
      ${fr ? `<div class="focus">${ring(l5.filter(Boolean).length, l5.length)}<div style="display:grid;gap:4px"><h3>${esc(fr.title)}</h3><p class="muted small">${esc(typeof fr.cue === "function" ? fr.rule.split(". ")[0] + "." : fr.cue)}</p><p class="small"><a href="${VIDEOS[fr.src].url}" target="_blank" rel="noopener">${VIDEOS[fr.src].who}: ${esc(VIDEOS[fr.src].title)}</a></p></div></div>
             <p class="muted small">A focus is fixed after 4 good swings out of 5. Then the next one starts.</p>`
           : `<p class="muted">Your first focus is chosen from your first coached swings: the most important thing the camera sees you doing wrong.</p>`}
    </section>
    <section class="panel">
      <h2>This week</h2>
      <div class="stats">
        <div class="stat"><b>${week.length}</b><span>sessions</span></div>
        <div class="stat"><b>${balls}</b><span>balls hit</span></div>
        <div class="stat"><b>${lastBad == null ? "–" : Math.round(lastBad * 100) + "%"}</b><span>bad shots last time</span></div>
      </div>
    </section>
    <p class="muted small" id="modelState">${esc(S._modelState || "Loading the pose model…")}</p>`;
  const setBalls = (n) => { S.balls = Math.max(10, Math.min(300, n)); save(); renderToday(); };
  $("#bMinus").onclick = () => setBalls(S.balls - 10);
  $("#bPlus").onclick = () => setBalls(S.balls + 10);
  $("#bChips").onclick = (e) => { const b = e.target.closest("button"); if (b) setBalls(Number(b.textContent)); };
  $("#goPlan").onclick = () => startFn("plan");
  $("#goCalib") && ($("#goCalib").onclick = () => startFn("calib"));
  $("#toggleFree").onclick = () => { $("#freeBox").hidden = !$("#freeBox").hidden; };
  $("#freeClub").onchange = (e) => { S.clubId = e.target.value; save(); };
  $("#freeView").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.view = b.dataset.v; save(); renderToday(); $("#freeBox").hidden = false; };
  $("#goFree").onclick = () => startFn("free");
}

// ---------------- History ----------------
function dayMarks() {
  const all = realSessions(), rates = all.map(badRate).filter((x) => x != null);
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const marks = {};
  for (const s of all) {
    const k = dayKey(s.start), r = badRate(s);
    const m = (marks[k] ??= { sessions: [], rates: [] }); m.sessions.push(s); if (r != null && !s.calib) m.rates.push(r);
  }
  for (const m of Object.values(marks)) {
    if (!m.rates.length || avg == null) m.kind = "dot";
    else { const r = m.rates.reduce((a, b) => a + b, 0) / m.rates.length; m.kind = r <= avg ? "circle" : "square"; }
  }
  return marks;
}
function renderHistory() {
  const el = $("#tab-history"), marks = dayMarks();
  const y = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first = new Date(y, mo, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
  const todayK = dayKey(Date.now());
  let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span class="dow">${d}</span>`).join("");
  for (let i = 0; i < startDow; i++) cells += `<span></span>`;
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${mo + 1}-${d}`, m = marks[k];
    cells += `<button data-k="${k}" class="${k === todayK ? "today" : ""} ${k === selDay ? "sel" : ""}" aria-label="${d}${m ? ", " + m.sessions.length + " session" : ""}">${m ? `<span class="mk ${m.kind}"></span>` : ""}${d}</button>`;
  }
  const monthSessions = realSessions().filter((s) => { const d = new Date(s.start); return d.getFullYear() === y && d.getMonth() === mo; });
  const shown = selDay ? (marks[selDay]?.sessions || []) : monthSessions;
  el.innerHTML = `
    <header class="lt"><p class="greet">${realSessions().length} sessions in total</p><h1>History</h1></header>
    <section class="panel">
      <div class="cal-head"><button id="mPrev" aria-label="Previous month">&lsaquo;</button><h2>${first.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h2><button id="mNext" aria-label="Next month">&rsaquo;</button></div>
      <div class="cal" id="cal">${cells}</div>
      <div class="legend"><span><i></i>Better than your average</span><span><i class="square"></i>Worse than your average</span><span><i class="dot"></i>Calibration or no flights logged</span></div>
    </section>
    <section class="panel">
      <div class="sect"><h2>${selDay ? fmtDate(shown[0]?.start || Date.now(), { weekday: "long", day: "numeric", month: "long" }) : "This month"}</h2>${selDay ? '<button class="linkbtn" id="allMonth">Whole month</button>' : ""}</div>
      ${shown.length ? `<div class="rows">${shown.slice().reverse().map((s) => { const st = sessionStats(s), r = badRate(s);
        return `<button data-s="${s.id}"><b>${fmtDate(s.start)}, ${new Date(s.start).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}</b><span class="r">${st.n}</span><small>${kindOf(s)}${r != null ? `, ${Math.round(r * 100)}% bad shots` : ""}</small><small>swings</small></button>`; }).join("")}</div>`
        : `<p class="muted">No sessions ${selDay ? "on this day" : "this month"} yet. Your sessions show up here, marked on the calendar like a scorecard.</p>`}
    </section>`;
  $("#mPrev").onclick = () => { calMonth = new Date(y, mo - 1, 1); selDay = null; renderHistory(); };
  $("#mNext").onclick = () => { calMonth = new Date(y, mo + 1, 1); selDay = null; renderHistory(); };
  $("#cal").onclick = (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; selDay = marks[b.dataset.k] ? b.dataset.k : null; renderHistory(); };
  $("#allMonth") && ($("#allMonth").onclick = () => { selDay = null; renderHistory(); });
  el.querySelectorAll(".rows button[data-s]").forEach((b) => (b.onclick = () => openReport(b.dataset.s, "history")));
}

// ---------------- Progress ----------------
function lineChart(points) { // points: [{label, v (0..1)}]
  const W = 340, H = 150, L = 34, R = 10, T = 10, B = 24;
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (1 - v) * (H - T - B);
  const grid = [0, 0.5, 1].map((g) => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g * 100}%</text>`).join("");
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const labels = points.map((p, i) => (points.length <= 6 || i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.label}</text>` : "").join("");
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === points.length - 1 ? 4.5 : 3}" fill="var(--fairway)"/>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bad shots per session">${grid}<path d="${area}" fill="var(--tint)"/><path d="${path}" fill="none" stroke="var(--fairway)" stroke-width="2.2"/>${dots}${labels}</svg>`;
}
function spark(vals) {
  const W = 90, H = 26, v = vals.map((x) => (x == null ? null : x));
  const pts = v.map((x, i) => (x == null ? null : [4 + (i * (W - 8)) / Math.max(1, v.length - 1), 3 + (1 - x) * (H - 6)])).filter(Boolean);
  if (!pts.length) return "";
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("")}" fill="none" stroke="var(--bad)" stroke-width="1.8"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2.6" fill="var(--bad)"/></svg>`;
}
function renderProgress() {
  const el = $("#tab-progress"), all = realSessions();
  if (!all.length) {
    el.innerHTML = `<header class="lt"><p class="greet">Your trend over time</p><h1>Progress</h1></header>
      <section class="panel"><h2>Nothing to show yet</h2><p class="muted">After your first session you will see your bad shot rate per session, your weakest club and how each swing fault is going. It gets useful after three sessions.</p></section>`;
    return;
  }
  const pts = all.filter((s) => badRate(s) != null).slice(-12).map((s) => ({ label: fmtDate(s.start, { day: "numeric", month: "short" }), v: badRate(s) }));
  const cs = catStats(DB.sessions, 3);
  const cats = Object.entries(cs).sort((a, b) => (b[1].score ?? -1) - (a[1].score ?? -1));
  const recent = all.slice(-8);
  const perRule = {};
  for (const s of recent) { const st = sessionStats(s); for (const f of st.faults) (perRule[f.id] ??= {})[s.id] = f.n ? f.fail / f.n : null; }
  const topRules = Object.keys(perRule).filter((id) => ruleById(id)?.conf === "high")
    .map((id) => ({ id, vals: recent.map((s) => perRule[id][s.id] ?? null) }))
    .map((r) => ({ ...r, last: [...r.vals].reverse().find((x) => x != null) ?? 0 })).sort((a, b) => b.last - a.last).slice(0, 6);
  el.innerHTML = `
    <header class="lt"><p class="greet">${all.length} sessions so far</p><h1>Progress</h1></header>
    <section class="panel">
      <h2>Bad shots per session</h2>
      ${pts.length >= 2 ? lineChart(pts) : `<p class="muted">Log the ball flight after each shot (say "slice", "straight"…) and this line appears after two sessions.</p>`}
    </section>
    <section class="panel">
      <h2>Clubs lately</h2>
      <p class="muted small">Your last three sessions. The plan gives more balls to the club at the top.</p>
      <div class="card-scroll"><table class="score"><tr><th>Group</th><th class="c">Swings</th><th class="c">Bad shots</th><th class="c">Faults</th></tr>
        ${cats.map(([c, o], i) => `<tr><td><b>${CATS[c]?.name || c}</b>${i === 0 && o.score != null ? '<span class="tag">weakest</span>' : ""}</td><td class="n">${o.n}</td><td class="n">${o.logged ? pct(o.bad, o.logged) + "%" : "–"}</td><td class="n">${o.checks ? pct(o.fails, o.checks) + "%" : "–"}</td></tr>`).join("")}
      </table></div>
    </section>
    <section class="panel">
      <h2>Swing faults over time</h2>
      ${topRules.length ? `<div class="rows" style="gap:0">${topRules.map((r) => `<div class="field"><span><b>${esc(ruleById(r.id).title)}</b><br><small class="muted">failed in ${Math.round(r.last * 100)}% of swings last time</small></span>${spark(r.vals)}</div>`).join("")}</div>`
        : `<p class="muted">Faults appear here once the app starts coaching you (after calibration).</p>`}
    </section>
    <section class="panel">
      <h2>Fixed</h2>
      ${DB.coach.mastered.length ? `<div style="display:grid;gap:8px">${[...new Set(DB.coach.mastered)].map((id) => `<p><b>${esc(ruleById(id)?.title)}</b> <span class="tag">fixed</span></p>`).join("")}</div>`
        : `<p class="muted">Nothing fixed yet. A fault counts as fixed after 4 good swings out of 5.</p>`}
    </section>`;
}

// ---------------- Library ----------------
const TOPICS = [
  ["Setup", ["hinge", "knees", "stance", "tilt", "heels", "setup-steps", "ballpos", "aim"]],
  ["Grip", ["grip-left", "grip-right", "grip-style", "grip-check", "grip-palm"]],
  ["The swing", ["arms", "sway", "feet", "posture", "transfer"]],
  ["Irons", ["ironweight", "shaftlean"]],
  ["Driver", ["upper", "forearms", "driver-up", "speed", "strike"]],
  ["Short game", ["bunker", "chipping", "putting"]],
];
const VOICE_LONG = {
  "straight, slice, hook, push, pull, thin, fat": "How the ball flew. Straight: at the target. Slice: curves hard to the right. Hook: curves to the left. Push: starts right and stays straight. Pull: starts left and stays straight. Thin: hit low off the bottom edge. Fat: ground before the ball, comes up short.",
};
function campDiagram() {
  return `<svg class="diagram" viewBox="0 0 340 300" role="img" aria-label="Top view of where to put the phone">
    <path d="M170 250 L170 40" stroke="var(--line2)" stroke-width="2" stroke-dasharray="6 6"/>
    <path d="M170 18v34M170 18l18 7-18 7" stroke="var(--fairway)" stroke-width="2.4" fill="none"/>
    <text x="196" y="30">Target</text>
    <circle cx="170" cy="168" r="6" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>
    <text x="180" y="186">Ball</text>
    <ellipse cx="128" cy="168" rx="16" ry="26" fill="var(--tint)" stroke="var(--fairway)" stroke-width="2"/>
    <circle cx="128" cy="168" r="9" fill="var(--fairway)"/>
    <text x="70" y="140">You</text>
    <g transform="translate(276 154)"><rect width="18" height="30" rx="4" fill="var(--fairway)"/><text x="-28" y="50">In front, 3 m</text></g>
    <path d="M272 169 L180 169" stroke="var(--fairway)" stroke-width="1.5" stroke-dasharray="3 4"/>
    <g transform="translate(119 252)"><rect width="18" height="30" rx="4" fill="var(--gold)"/><text x="26" y="20">Behind, 3 m</text></g>
    <path d="M128 250 L128 198" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="3 4"/>
  </svg>`;
}
function ruleHtml(r) {
  const v = VIDEOS[r.src];
  const tags = r.auto ? `<span class="tag">${r.view === "dtl" ? "camera behind" : r.view === "face" ? "camera in front" : "any camera"}</span>${r.conf === "low" ? '<span class="tag weak">weak measurement</span>' : ""}` : "";
  return `<div class="rule"><h3>${esc(r.title)}${tags}</h3><p>${esc(r.rule)}</p><small>${v.url ? `<a href="${v.url}" target="_blank" rel="noopener">${v.who}: ${esc(v.title)}</a>` : esc(v.title)}</small></div>`;
}
function renderLibrary() {
  const el = $("#tab-library");
  el.innerHTML = `
    <header class="lt"><p class="greet">Everything here comes from your Golf bible playlist</p><h1>Library</h1></header>
    <details class="chap" open><summary><h2>How a session works</h2></summary><div class="body">
      <ol class="steps">
        <li>Put your earphones in, choose how many balls you have and tap Start.</li>
        <li>The app tells you the club, how many balls and where the camera goes.</li>
        <li>Stand the phone upright against your bag, about 3 m away at hip height, with your whole body in the picture.</li>
        <li>Take your setup and stay still for half a second. Your skeleton turns green: hit when you want.</li>
        <li>About two seconds later you hear one short correction, or "Good" when you did it right.</li>
        <li>Say how the ball flew. If it was a practice swing, say "practice".</li>
        <li>When a block ends, the app tells you the next club and where to move the camera.</li>
        <li>At the end, tap End twice, open the report and copy it for Claude.</li>
      </ol></div></details>
    <details class="chap"><summary><h2>Where to put the camera</h2></summary><div class="body">
      ${campDiagram()}
      <p><b>In front</b>: facing your chest, across the ball. It checks stance width, sway, turn, balance and where your weight goes.</p>
      <p><b>Behind</b>: on the line from your hands to the target, behind you. It checks your posture from the hips, your knees and your heels.</p>
      <p class="muted">Upright, at hip height, 3 m away. If it cannot see your feet or head, it tells you. Other people in the picture are shown in grey and ignored.</p>
    </div></details>
    <details class="chap"><summary><h2>Voice words</h2></summary><div class="body">
      <p class="muted">The camera sees your body but not the ball, so the flight words are how the app learns your results. Speak after the app stops talking, within 30 seconds of the swing.</p>
      <dl class="words">${VOICE_HELP.map(([w, d]) => `<dt>${esc(w)}</dt><dd>${esc(VOICE_LONG[w] || d)}</dd>`).join("")}</dl>
    </div></details>
    <details class="chap"><summary><h2>Warm up and half swings</h2></summary><div class="body">
      <p>${esc(CATS.warmup.note)}</p>
      <p class="muted">A half swing goes back until your hands reach hip height and stops at hip height on the other side, at a relaxed speed. This one is not from the playlist: it is only the warm up before the clubs that count.</p>
    </div></details>
    ${TOPICS.map(([name, ids]) => `<details class="chap"><summary><h2>${name}</h2><span class="muted small">${ids.length} tips</span></summary><div class="body">${ids.map((id) => ruleById(id)).filter(Boolean).map(ruleHtml).join("")}</div></details>`).join("")}
    <details class="chap"><summary><h2>The videos</h2></summary><div class="body">
      ${Object.values(VIDEOS).filter((v) => v.url).map((v) => `<p><a href="${v.url}" target="_blank" rel="noopener">${esc(v.title)}</a><br><small class="muted">${v.who}</small></p>`).join("")}
    </div></details>`;
}

// ---------------- Profile ----------------
let clearArmed = 0;
function renderProfile() {
  const el = $("#tab-profile"), P = S.profile;
  const initials = P.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "MP";
  const lastCal = DB.sessions.filter((s) => s.calib && (s.swings || []).length).at(-1);
  el.innerHTML = `
    <header class="lt"><p class="greet">Your details and settings</p><h1>Profile</h1></header>
    <section class="panel"><div class="me"><div class="avatar">${esc(initials)}</div><div><h2>${esc(P.name)}</h2><p class="muted">${esc(P.hand)} handed, ${esc(P.height)} cm, ${esc(P.level.toLowerCase())}</p></div></div></section>
    <section class="panel">
      <h2>About you</h2>
      <div style="display:grid;gap:12px">
        <label class="field" for="pName">Name, used by the voice <input type="text" id="pName" value="${esc(P.name)}"></label>
        <label class="field" for="pHeight">Height in cm <input type="number" id="pHeight" value="${esc(P.height)}" min="140" max="220"></label>
        <label class="field" for="pLevel">Level <select id="pLevel">${["Beginner", "Intermediate", "Advanced"].map((l) => `<option ${l === P.level ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <div class="field"><span>Hand</span><span class="muted">Right (the rules assume a right hander)</span></div>
      </div>
    </section>
    <section class="panel">
      <h2>Your bag</h2><p class="muted small">Only these clubs go into your plans.</p>
      <div class="bag" id="bag">${BAG.map((c) => `<label for="bag_${c.id}"><input type="checkbox" id="bag_${c.id}" data-id="${c.id}" ${S.bag.includes(c.id) ? "checked" : ""}>${c.name}</label>`).join("")}</div>
    </section>
    <section class="panel">
      <h2>Coaching</h2>
      <span class="muted small">Corrections per swing</span>
      <div class="seg" id="pMode"><button data-m="1" aria-pressed="${S.mode === 1}">One, the most important</button><button data-m="3" aria-pressed="${S.mode === 3}">Up to three</button></div>
      <div style="display:grid;gap:12px">
        <label class="field" for="pVoice">Speak the feedback <input type="checkbox" id="pVoice" ${S.voice ? "checked" : ""}></label>
        <label class="field" for="pMic">Voice words through the earphones <input type="checkbox" id="pMic" ${S.mic ? "checked" : ""}></label>
        <label class="field" for="pAsk">Ball flight buttons on screen <input type="checkbox" id="pAsk" ${S.ask ? "checked" : ""}></label>
      </div>
    </section>
    <section class="panel">
      <h2>Trial period</h2>
      <p class="muted">${lastCal ? `Last calibration on ${fmtDate(lastCal.start)}: ${lastCal.swings.filter((w) => !w.practice).length} swings, voice ${lastCal.calib.mic === "ok" ? "worked" : lastCal.calib.mic === "no" ? "was not heard" : "was off"}.` : "No calibration yet. Do one full bucket before your real sessions."}</p>
      <button class="btn quiet" id="pCalib">${lastCal ? "Run another calibration" : "Start calibration"}</button>
    </section>
    <section class="panel">
      <h2>Your data</h2>
      <p class="muted small">Everything is saved only on this phone. Copy it to keep a backup or to send it to Claude.</p>
      <button class="btn line" id="pCopy">Copy all my data</button>
      <button class="btn line" id="pReset">Restart the focus</button>
      <button class="btn line" id="pClear">Delete all history</button>
    </section>
    <p class="muted small">Golf Bible Coach, version 5. Rules from 9 videos in your playlist.</p>`;
  const bind = (id, fn) => ($("#" + id).onchange = (e) => { fn(e.target); save(); });
  bind("pName", (t) => (P.name = t.value.trim() || "Mariano"));
  bind("pHeight", (t) => (P.height = Number(t.value) || 185));
  bind("pLevel", (t) => (P.level = t.value));
  bind("pVoice", (t) => (S.voice = t.checked)); bind("pMic", (t) => (S.mic = t.checked)); bind("pAsk", (t) => (S.ask = t.checked));
  $("#bag").onchange = () => { S.bag = [...el.querySelectorAll("#bag input:checked")].map((x) => x.dataset.id); save(); };
  $("#pMode").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; S.mode = Number(b.dataset.m); save(); renderProfile(); };
  $("#pCalib").onclick = () => startFn("calib");
  $("#pCopy").onclick = async () => { await copyText(JSON.stringify(DB), $("#pCopy"), "Copy all my data"); };
  $("#pReset").onclick = () => { resetCoach(); $("#pReset").textContent = "Focus restarted"; };
  $("#pClear").onclick = () => {
    if (Date.now() - clearArmed < 4000) { clearHistory(); renderProfile(); return; }
    clearArmed = Date.now(); $("#pClear").textContent = "Tap again to delete everything"; $("#pClear").classList.add("danger");
  };
}
async function copyText(text, btn, label) {
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
  catch (e) { btn.textContent = "Copy failed, try again"; }
  setTimeout(() => (btn.textContent = label), 2500);
}

// ---------------- Report ----------------
export function openReport(sid, from = "history") {
  reportFrom = from;
  const s = DB.sessions.find((x) => x.id === sid);
  for (const t of TABS) $("#tab-" + t).hidden = true;
  const el = $("#screen-report"); el.hidden = false; window.scrollTo(0, 0);
  if (!s) { el.innerHTML = `<button class="linkbtn" id="rBack">&lsaquo; Back</button><p class="muted">This session was not found.</p>`; $("#rBack").onclick = () => go(reportFrom); return; }
  const st = sessionStats(s), r = badRate(s), notes = coachNotes(s, DB.sessions, DB.coach);
  const per = {};
  for (const w of (s.swings || []).filter((w) => !w.practice)) {
    const k = w.clubId || w.club; const o = (per[k] ??= { n: 0, logged: 0, straight: 0, bad: 0, checks: 0, fails: 0 });
    o.n++; if (w.result) { o.logged++; if (w.result === "straight") o.straight++; if (BAD_RESULTS.includes(w.result)) o.bad++; }
    for (const c of w.checks || []) { if (ruleById(c.id)?.conf !== "high") continue; o.checks++; if (!c.pass) o.fails++; }
  }
  const order = BAG.map((c) => c.id);
  const clubRows = Object.entries(per).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  const flights = Object.entries(st.results).sort((a, b) => b[1] - a[1]), logged = flights.reduce((a, [, n]) => a + n, 0);
  el.innerHTML = `
    <button class="linkbtn" id="rBack" style="justify-self:start">&lsaquo; ${reportFrom === "today" ? "Today" : "History"}</button>
    <header class="lt"><p class="greet">${kindOf(s)}</p><h1>${fmtDate(s.start, { weekday: "long", day: "numeric", month: "long" })}</h1></header>
    <section class="panel"><div class="stats">
      <div class="stat"><b>${st.n}</b><span>swings</span></div>
      <div class="stat"><b>${r == null ? "–" : Math.round(r * 100) + "%"}</b><span>bad shots</span></div>
      <div class="stat"><b>${clubRows.length}</b><span>clubs</span></div>
    </div></section>
    <section class="panel"><h2>Coach notes</h2><div class="notes">${notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div></section>
    <section class="panel"><h2>By club</h2>
      <div class="card-scroll"><table class="score"><tr><th>Club</th><th class="c">Swings</th><th class="c">Straight</th><th class="c">Bad</th><th class="c">Faults</th></tr>
      ${clubRows.map(([id, o]) => `<tr><td><b>${clubById(id)?.name || CLUBS[id] || id}</b></td><td class="n">${o.n}</td><td class="n">${o.logged ? o.straight : "–"}</td><td class="n">${o.logged ? o.bad : "–"}</td><td class="n">${o.checks ? pct(o.fails, o.checks) + "%" : "–"}</td></tr>`).join("")}
      </table></div></section>
    ${st.faults.length ? `<section class="panel"><h2>Swing faults</h2>${st.faults.map((f) => `<div class="bar"><span>${esc(ruleById(f.id)?.title || f.id)}${ruleById(f.id)?.conf === "low" ? '<span class="tag weak">weak</span>' : ""}</span><span class="num muted">${f.fail}/${f.n}</span><i><span style="width:${f.rate}%"></span></i></div>`).join("")}</section>` : ""}
    ${logged ? `<section class="panel"><h2>Ball flight</h2>${flights.map(([k, n]) => `<div class="bar ${k === "straight" ? "good" : ""}"><span>${k === "top" ? "Thin" : k[0].toUpperCase() + k.slice(1)}</span><span class="num muted">${n}</span><i><span style="width:${pct(n, logged)}%"></span></i></div>`).join("")}</section>` : ""}
    <section class="panel"><h2>Send to Claude</h2>
      <p class="muted">Copy the full report and paste it in your chat with Claude for a review, and to tune the rules after a calibration.</p>
      <button class="btn" id="rCopy">Copy report</button>
      <details class="why"><summary>Show the report text</summary><pre class="rep" id="rText">${esc(reportText(DB.sessions, s.id, DB.coach))}</pre></details>
    </section>`;
  $("#rBack").onclick = () => go(reportFrom);
  $("#rCopy").onclick = () => copyText(reportText(DB.sessions, s.id, DB.coach), $("#rCopy"), "Copy report");
}
