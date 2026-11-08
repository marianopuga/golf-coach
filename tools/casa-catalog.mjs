// Lista todas las frases del coach de casa para grabarlas con la voz neuronal.
// node tools/casa-catalog.mjs > /tmp/casa-catalog.json
import { catalog } from "../casa/lines.js?v=3";
const set = catalog();
process.stdout.write(JSON.stringify([...set].map(([k, v]) => ({ k, t: v.text, hot: !!v.hot }))));
