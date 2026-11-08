// Dos cámaras a la vez: el celular y el computador se conectan directo (WebRTC, con PeerJS solo para encontrarse).
// Cada uno mide su ángulo; el secundario le manda sus swings al principal, que los junta y habla.
// Los relojes se sincronizan con pings, así un swing se empareja por la hora del impacto.
const PREFIX = "golfcasa-v3-";
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
    s.onload = () => (window.Peer ? res(window.Peer) : rej(new Error("PeerJS no cargó")));
    s.onerror = () => rej(new Error("No pude cargar PeerJS. Revisa internet."));
    document.head.appendChild(s);
  });
}

export class Link {
  constructor(h = {}) { this.h = h; this.peer = null; this.conn = null; this.offsets = []; this.offset = 0; this.timer = 0; this.role = null; }
  get open() { return !!this.conn?.open; }
  // Principal: crea un código de 4 dígitos para que el otro dispositivo se una.
  async host() {
    const Peer = await loadPeer();
    this.close(); this.role = "host";
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      try {
        await new Promise((res, rej) => {
          this.peer = new Peer(PREFIX + code);
          this.peer.on("open", res);
          this.peer.on("error", (e) => rej(e));
        });
        this.peer.on("connection", (c) => this._attach(c));
        this.peer.on("disconnected", () => { try { this.peer.reconnect(); } catch (e) {} });
        return code;
      } catch (e) {
        try { this.peer?.destroy(); } catch (x) {}
        if (e?.type !== "unavailable-id") throw e;
      }
    }
    throw new Error("No encontré un código libre. Intenta de nuevo.");
  }
  // Secundario: se une con el código del principal.
  async join(code) {
    const Peer = await loadPeer();
    this.close(); this.role = "guest";
    await new Promise((res, rej) => { this.peer = new Peer(); this.peer.on("open", res); this.peer.on("error", rej); });
    const c = this.peer.connect(PREFIX + String(code).trim(), { reliable: true });
    this._attach(c);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("No respondió el otro dispositivo. Revisa el código y que los dos tengan internet.")), 12000);
      c.on("open", () => { clearTimeout(t); res(); });
      this.peer.on("error", (e) => { clearTimeout(t); rej(e); });
    });
  }
  _attach(c) {
    if (this.conn && this.conn !== c) { try { this.conn.close(); } catch (e) {} }
    this.conn = c;
    c.on("open", () => { this.offsets = []; this._sync(); this.h.onOpen?.(this.role); });
    c.on("data", (d) => this._data(d));
    c.on("close", () => { if (this.conn === c) { this.conn = null; clearInterval(this.timer); this.h.onClose?.(); } });
    c.on("error", () => {});
  }
  _sync() {
    clearInterval(this.timer);
    let n = 0;
    const ping = () => this.send({ type: "ping", t0: Date.now() });
    ping();
    this.timer = setInterval(() => { if (++n < 8 || n % 30 === 0) ping(); }, 400);
  }
  _data(d) {
    if (!d || typeof d !== "object") return;
    if (d.type === "ping") return this.send({ type: "pong", t0: d.t0, t1: Date.now() });
    if (d.type === "pong") {
      const now = Date.now(), rtt = now - d.t0;
      if (rtt > 1500) return;
      this.offsets.push(d.t1 - (d.t0 + rtt / 2));
      if (this.offsets.length > 11) this.offsets.shift();
      this.offset = median(this.offsets);
      return;
    }
    this.h.onData?.(d);
  }
  // Hora del otro dispositivo pasada a mi reloj.
  toLocal(epoch) { return epoch - this.offset; }
  send(o) { try { if (this.conn?.open) this.conn.send(o); } catch (e) {} }
  close() { clearInterval(this.timer); try { this.conn?.close(); } catch (e) {} try { this.peer?.destroy(); } catch (e) {} this.conn = null; this.peer = null; }
}
