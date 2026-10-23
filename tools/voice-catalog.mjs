// Lists every sentence the coach can say (for recording with the neural voice). node tools/voice-catalog.mjs > catalog.json
import { catalog, sentences, keyOf } from "../lines.js?v=9";
import { frameHint } from "../engine.js?v=9";
const set = catalog();
const add = (t, hot) => { for (const s of sentences(t)) { const k = keyOf(s); if (k && !set.has(k)) set.set(k, { text: s, hot }); } };
for (const s of frameHint.toString().match(/"([^"\\]|\\.)*"/g) || []) { const t = JSON.parse(s); if (t.length > 12) add(t, true); }
process.stdout.write(JSON.stringify([...set].map(([k, v]) => ({ k, t: v.text, hot: !!v.hot }))));
