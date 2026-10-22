// Saved data: settings, profile, coaching state and sessions. Everything stays on the phone.
import { BAG } from "./rules.js?v=5";
import { emptyCoachState } from "./engine.js?v=5";

const KEY = "golfcoach.v2";
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!d) {
    d = { settings: {}, coach: emptyCoachState(), sessions: [] };
    try { const old = JSON.parse(localStorage.getItem("golfcoach.v1")); if (old?.sessions) d.sessions = old.sessions; } catch (e) {}
  }
  if (!d.coach || d.coach.v !== 2) d.coach = emptyCoachState();
  d.settings ??= {}; d.sessions ??= [];
  return d;
}
export const DB = load();
export const S = DB.settings;
S.clubId ??= "7i"; S.view ??= "face"; S.mode ??= 1; S.voice ??= true; S.mic ??= true; S.ask ??= true;
S.bag ??= BAG.map((c) => c.id); S.balls ??= 100;
S.profile ??= { name: "Mariano", hand: "Right", height: 185, level: "Beginner" };

export function save() {
  if (DB.sessions.length > 120) DB.sessions = DB.sessions.slice(-120);
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { console.warn("save failed", e); }
}
export function resetCoach() { DB.coach = emptyCoachState(); save(); }
export function clearHistory() { DB.sessions = []; DB.coach = emptyCoachState(); save(); }
