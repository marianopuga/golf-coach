// Golfista simulado para las pruebas del coach de casa: se ve de la cabeza a las rodillas (los pies fuera del cuadro).
export const W = 640, H = 480;
const lerp = (a, b, s) => a + (b - a) * s;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (s) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(s));

export function toLm(pts) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  for (const [i, [x, y]] of Object.entries(pts)) lm[i] = { x, y, visibility: 0.95 };
  return lm;
}
export function toWl(yawS, yawH) {
  const wl = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 })), r = (d) => (d * Math.PI) / 180, s = r(yawS), h = r(yawH);
  wl[11] = { x: 0.18 * Math.cos(s), y: -0.5, z: 0.18 * Math.sin(s) }; wl[12] = { x: -0.18 * Math.cos(s), y: -0.5, z: -0.18 * Math.sin(s) };
  wl[23] = { x: 0.1 * Math.cos(h), y: 0, z: 0.1 * Math.sin(h) }; wl[24] = { x: -0.1 * Math.cos(h), y: 0, z: -0.1 * Math.sin(h) };
  return wl;
}
// Golfista diestro de frente: su lado izquierdo queda a la derecha de la imagen (objetivo hacia x mayor).
export function faceSwing(o = {}) {
  const { headBack = 0, headDown = 0, hipBack = 0, hipFwd = 0.02, seqLead = 80, fps = 30, back = 900, down = 350, thru = 450, hold = 1100,
    finishMove = false, abort = false, jitter = 0.0008, tAddr = 1000 } = o;
  const dt = 1000 / fps, out = [], tTop = tAddr + back, tImp = tTop + down, tFin = tImp + thru, tEnd = tFin + hold;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * jitter;
  for (let t = 0; t <= tEnd; t += dt) {
    let hx = 0.5, hy = 0.7, sYaw = 0, hYaw = 0, headDx = 0, headDy = 0, hipDx = 0;
    if (t > tAddr && t <= tTop) {
      const s = ease((t - tAddr) / back);
      hx = lerp(0.5, 0.38, s); hy = lerp(0.7, 0.2, s); sYaw = 85 * s; hYaw = 40 * s; headDx = -headBack * s; headDy = headDown * s; hipDx = -hipBack * s;
    } else if (t > tTop && t <= tImp) {
      const s = (t - tTop) / down, lead = seqLead / down;
      const sh = ease((s - Math.max(0, lead)) / (1 - Math.max(0, lead))), hp = ease((s - Math.max(0, -lead)) / (1 - Math.max(0, -lead)));
      hx = lerp(0.38, 0.51, sh); hy = lerp(0.2, 0.7, sh); sYaw = lerp(85, 0, sh); hYaw = lerp(40, -30, hp);
      headDx = -headBack * (1 - sh); headDy = headDown * (1 - sh); hipDx = lerp(-hipBack, hipFwd, hp);
    } else if (t > tImp) {
      const s = ease((t - tImp) / thru);
      if (abort) { hx = 0.51; hy = 0.7; sYaw = 0; hYaw = -30; hipDx = hipFwd; }
      else { hx = lerp(0.51, 0.62, s); hy = lerp(0.7, 0.18, s); sYaw = lerp(0, -70, s); hYaw = lerp(-30, -50, s); hipDx = lerp(hipFwd, hipFwd + 0.03, s); }
      if (finishMove && t > tFin) { hx += 0.05 * Math.sin(t / 60); hy += 0.04 * Math.cos(t / 70); }
    }
    const hc = 0.5 + headDx + rnd(), hyc = 0.115 + headDy + rnd();
    const shc = 0.5 + 0.5 * hipDx, spS = Math.max(0.02, 0.12 * Math.cos((sYaw * Math.PI) / 180));
    const hpc = 0.5 + hipDx + rnd(), spH = Math.max(0.02, 0.08 * Math.cos((hYaw * Math.PI) / 180));
    const pts = {
      0: [hc, hyc + 0.005], 7: [hc + 0.03, hyc - 0.005], 8: [hc - 0.03, hyc - 0.005],
      11: [shc + spS / 2, 0.25], 12: [shc - spS / 2, 0.27], 13: [(shc + hx) / 2 + 0.03, (0.25 + hy) / 2], 14: [(shc + hx) / 2 - 0.03, (0.27 + hy) / 2],
      15: [hx + 0.005 + rnd(), hy + rnd()], 16: [hx - 0.005 + rnd(), hy + rnd()],
      23: [hpc + spH / 2, 0.52], 24: [hpc - spH / 2, 0.52], 25: [0.55, 0.8], 26: [0.45, 0.8], 27: [0.56, 1.05], 28: [0.44, 1.05],
    };
    out.push({ t, lm: toLm(pts), wl: toWl(sYaw, hYaw) });
  }
  return out;
}
// Desde atrás: el golfista mira hacia la derecha de la imagen (la pelota).
export function dtlSwing(o = {}) {
  const { ext = 0, stand = 0, headIn = 0, fps = 30, back = 900, down = 350, thru = 450, hold = 1100, tAddr = 1000 } = o;
  const dt = 1000 / fps, out = [], tTop = tAddr + back, tImp = tTop + down, tFin = tImp + thru, tEnd = tFin + hold;
  for (let t = 0; t <= tEnd; t += dt) {
    let hx = 0.56, hy = 0.68, hipDx = 0, shUp = 0, headDx = 0;
    if (t > tAddr && t <= tTop) { const s = ease((t - tAddr) / back); hx = lerp(0.56, 0.42, s); hy = lerp(0.68, 0.18, s); }
    else if (t > tTop && t <= tImp) {
      const s = ease((t - tTop) / down);
      hx = lerp(0.42, 0.57, s); hy = lerp(0.18, 0.68, s); hipDx = ext * s; shUp = stand * s; headDx = headIn * s;
    } else if (t > tImp) {
      const s = ease((t - tImp) / thru);
      hx = lerp(0.57, 0.4, s); hy = lerp(0.68, 0.15, s); hipDx = ext; shUp = stand; headDx = headIn;
    }
    const hp = [0.4 + hipDx, 0.55], sh = [0.5 + hipDx - shUp * 0.5, 0.33 - shUp], hd = [0.58 + headDx - shUp * 0.5, 0.21 - shUp];
    const pts = {
      0: [hd[0], hd[1] + 0.01], 7: [hd[0] - 0.025, hd[1] - 0.005], 8: [hd[0] - 0.02, hd[1] - 0.005],
      11: [sh[0] + 0.005, sh[1]], 12: [sh[0] - 0.005, sh[1] + 0.005], 13: [(sh[0] + hx) / 2, (sh[1] + hy) / 2], 14: [(sh[0] + hx) / 2 - 0.01, (sh[1] + hy) / 2],
      15: [hx, hy], 16: [hx - 0.01, hy], 23: [hp[0] + 0.005, hp[1]], 24: [hp[0] - 0.005, hp[1]],
      25: [0.46, 0.78], 26: [0.44, 0.78], 27: [0.42, 1.02], 28: [0.4, 1.02],
    };
    out.push({ t, lm: toLm(pts), wl: null });
  }
  return out;
}
