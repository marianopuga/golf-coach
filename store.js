// Saved data. Settings, coaching, sessions and rounds in localStorage; swing pictures in IndexedDB.
// Everything stays on the phone.
import { BAG } from "./rules.js?v=19";
import { emptyCoachState } from "./engine.js?v=19";

const KEY = "golfcoach.v2";
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!d) d = { settings: {}, coach: emptyCoachState(), sessions: [], rounds: [] };
  if (!d.coach || d.coach.v !== 3) d.coach = { ...emptyCoachState(), ...(d.coach?.v === 2 ? { focus: d.coach.focus, hist: d.coach.hist || {}, mastered: d.coach.mastered || [] } : {}), v: 3 };
  d.settings ??= {}; d.sessions ??= []; d.rounds ??= [];
  return d;
}
export const DB = load();
export const S = DB.settings;
S.voiceId ??= "michael"; S.voiceSpeed ??= 1;
S.clubId ??= "7i"; S.view ??= "face"; S.voice ??= true; S.mic ??= true; S.ask ??= true;
S.mode = S.modeSet ? S.mode : 3; S.modeSet = true; // you asked: the important thing first, then the details
S.bag ??= BAG.map((c) => c.id); if (!S.bag.includes("PT")) S.bag.push("PT");
S.venue ??= "pw"; S.balls ??= 100; S.minutes ??= 60;
S.profile ??= { name: "Mariano", hand: "Right", height: 185, level: "Beginner" };
S.voiceLang ??= "en-US"; S.voiceName ??= ""; S.voicePitch ??= 0.85; S.voiceRate ??= 0.95;
S.preshot ??= true; S.reason ??= true; S.ghost ??= true; S.autoPractice ??= true;
S.prechecks ??= ["stance", "chipstance", "ballpos", "reach", "hinge", "knees", "weightset", "tilt", "forearms", "handsahead", "eyesover"];

export function save() {
  if (DB.sessions.length > 150) DB.sessions = DB.sessions.slice(-150);
  try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (e) { console.warn("save failed", e); return false; }
}
export function resetCoach() { DB.coach = emptyCoachState(); save(); }
export function clearHistory() { DB.sessions = []; DB.rounds = []; DB.coach = emptyCoachState(); save(); frames.clear(); }

// ---------------- Swing pictures (IndexedDB) ----------------
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open("golfcoach-frames", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("frames");
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await idb(); if (!db) return null;
  return new Promise((res) => {
    try { const t = db.transaction("frames", mode), s = t.objectStore("frames"), out = fn(s); t.oncomplete = () => res(out?.result ?? null); t.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}
export const frames = {
  put: (id, value) => tx("readwrite", (s) => s.put(value, id)),
  get: (id) => tx("readonly", (s) => s.get(id)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
  clear: () => tx("readwrite", (s) => s.clear()),
};

// Hand a file to the phone: the share sheet on iPhone (save to Files, send to Claude), or a download.
export async function giveFile(name, text, type = "application/json") {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return "downloaded";
}
