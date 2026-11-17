// version: 2026-11-13 21:40
// husritare-miljo.js – omgivningar för husritaren: studio, trädgård, skog och vinter.
//
// Träden byggs som riktig vegetation: förgrenade, avsmalnande stammar med bark och tusentals
// alfatestade löv- och barrkort (texturer ritade en gång på duk). Gran, tall, björk och ek (och
// snö-/kala varianter) bakas en gång per miljö till en impostoratlas från 8 håll (färg med AO +
// normaler, WebGLRenderTarget); varje träd är ett kort mot kameran som tonar mellan de närmaste
// vinklarna (ett ritanrop). De 2–3 träd som står närmast huset är riktiga 3D-träd.
// Liv: vind, vindbyar och fladder i hörnskuggaren, drivande moln, fåglar, fallande löv,
// barr och snö samt dimslöjor – allt styrs av uniformer, ingenting räknas per bildruta i JS.
// Kväll: stjärnor och skymningsglöd i himlen, varma stolplampor, ljuspooler och ljusslinga,
// gnistrande snö i månsken – bara uniformer och opacitet, inga nya ljuskällor.
// Högst 17 ritanrop (fjärrsetets bark, lövverk och markväxter är egna nät som byggs en gång) och
// under 200 000 trianglar per miljö (se miljo.statistik()).
//
// API:
//   const miljo = skapaMiljo(THREE, scene, renderer);
//   miljo.satt('skog', H);                       // H = husets data med L (x-led) och W (z-led), ev. oppningar
//   miljo.uppdatera({ kvall: 0..1, mork, sol });  // kvällsfaktor, mörkt tema, valfritt sol = riktning (Vector3) mot solen
//   miljo.tick(sekunder)                         // klocktid i sekunder (t.ex. performance.now() / 1000); sätter bara uniformer
//   miljo.harLiv()                               // true om aktiv miljö har rörelse och livet är på
//   miljo.satLiv(pa)                             // slå på/av rörelsen; av = allt står still (tiden fryses)
//   miljo.lista                                  // [['studio','Studio'], ...]
//   miljo.statistik()                            // { anrop, trianglar } för den aktiva miljön
//   miljo.dispose();
import { skapaBil } from './husritare-bil.js?v=20261119d';   // elbilen med laddbox vid entrén
import { skapaBebott } from './husritare-bebott.js?v=20261119d';   // spår av folk som bor där: brevlåda, cykel, grill …

// ---- små hjälpare (utan THREE) -------------------------------------------
function slump(fro) {
  let a = fro >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(i, j, k) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function brus3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, z, okt = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < okt; i++) { s += a * brus3(x * f, 7.3 * i, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n; // ungefär 0..1
}
// sömlöst brus för texturer: gittret upprepas med perioden P, så rutan går ihop i kanterna
function tbrus(x, y, P, k) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const w = a => ((a % P) + P) % P, x0 = w(xi), x1 = w(xi + 1), y0 = w(yi), y1 = w(yi + 1);
  const a = hash(x0, y0, k), b = hash(x1, y0, k), c = hash(x0, y1, k), d = hash(x1, y1, k);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(u, v, P, okt, k) {
  let s = 0, a = 0.5, n = 0, p = P;
  for (let i = 0; i < okt; i++) { s += a * tbrus(u * p, v * p, p, k + i * 17); n += a; a *= 0.5; p *= 2; }
  return s / n;
}
const mjuk = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function duk(n, m = n) { const c = document.createElement('canvas'); c.width = n; c.height = m; return [c, c.getContext('2d')]; }
// fyll en duk pixel för pixel: fn(u, v, ut) skriver rgb (och ev. alfa) i ut
function pixlar(g, n, m, fn) {
  const im = g.createImageData(n, m), d = im.data, o = [0, 0, 0, 255];
  for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) {
    o[3] = 255; fn(x / n, y / m, o, x, y);
    const i = (y * n + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o[3];
  }
  g.putImageData(im, 0, 0);
}
// rita något nära kanten en gång till på andra sidan, så att texturen blir sömlös
function runt(n, x, y, m, fn) {
  for (const ox of [0, -n, n]) {
    if (ox && !(ox < 0 ? x > n - m : x < m)) continue;
    for (const oy of [0, -n, n]) { if (oy && !(oy < 0 ? y > n - m : y < m)) continue; fn(x + ox, y + oy); }
  }
}

// små vektorhjälpare på vanliga arrayer
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const perp = n => Math.abs(n[1]) < 0.9 ? norm(cross(n, [0, 1, 0])) : norm(cross(n, [1, 0, 0]));
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hsl = (h, s, l, a = 1) => `hsla(${h | 0},${s | 0}%,${l | 0}%,${a})`;
const ETT = [1, 1, 1];

// ---- miljön ---------------------------------------------------------------
export function skapaMiljo(THREE, scene, renderer) {
  const lista = [['studio', 'Studio'], ['tradgard', 'Trädgård'], ['skog', 'Skog'], ['vinter', 'Vinter']];
  const cap = renderer.capabilities || {};
  const ANISO = Math.min(4, cap.getMaxAnisotropy ? cap.getMaxAnisotropy() : 1);
  const skrap = [];                       // geometrier, material och texturer att städa
  const spara = o => { skrap.push(o); return o; };
  const C = h => new THREE.Color(h);

  const rot = new THREE.Group(); rot.name = 'miljo'; rot.matrixAutoUpdate = false;
  scene.add(rot);

  // gemensamma uniformer för allt liv (tick sätter bara uTid)
  const VU = {
    uTid: { value: 0 },
    uSol: { value: new THREE.Vector3(0.45, 0.75, 0.35).normalize() },
    uSSS: { value: new THREE.Color(0.2, 0.24, 0.06) },
    uSno: { value: 0 },
    uVind: { value: new THREE.Vector2(0.94, 0.33) },
    uFade: { value: new THREE.Vector2(38, 70) },
    uGlod: { value: new THREE.Color(0, 0, 0) },
    uStjarnor: { value: 0 },
    uGnistra: { value: 0 },
    uGlitter: { value: 0 },                           // solglitter på drivorna (vinter, dag)
    uLampa: { value: 0 },                             // lamporna tänds 0..1; varje lampa har sin fördröjning
    uPool: { value: 0 },                              // sen kväll 0..1: pooler och lampor varmare och bredare
    uNatt: { value: 0 },                              // natt 0..1 (impostorträden dovnar och blir månblå)
    uHus: { value: new THREE.Vector4(5, 3, 5, 0) },   // husets halva L, halva W, höjd med tak (huset står kring origo)
    uInne: { value: 0 },                              // 1 = kameran är inne (sätts av uppdatera({ inne }))
  };

  const bil = skapaBil(THREE, rot, VU);   // elbilen, laddboxen och kabeln (husritare-bil.js)
  const bebott = skapaBebott(THREE, rot, VU);   // brevlåda, cykel, grill m.m. (husritare-bebott.js)

  // ---- texturer (ritas en gång, bara när de behövs) ----
  function textur(c, meter, farg = true) {
    const t = spara(new THREE.CanvasTexture(c));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / meter, 1 / meter);
    if (farg) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    return t;
  }
  // atlas (2 × 2 rutor) som DataTexture: genomskinliga texlar får rutans medelfärg, så att
  // mipnivåerna inte får mörka kanter. flipY = false: v = 0 är dukens överkant.
  function atlas(c, kol = 2, rad = 2) {
    const n = c.width, m = c.height, d = c.getContext('2d').getImageData(0, 0, n, m).data, hx = n / kol, hy = m / rad;
    for (let k = 0; k < kol * rad; k++) {
      const x0 = (k % kol) * hx, y0 = Math.floor(k / kol) * hy; let R = 0, G = 0, B = 0, A = 0;
      for (let y = y0; y < y0 + hy; y += 2) for (let x = x0; x < x0 + hx; x += 2) { const i = (y * n + x) * 4; if (d[i + 3] > 160) { R += d[i]; G += d[i + 1]; B += d[i + 2]; A++; } }
      if (!A) continue; R /= A; G /= A; B /= A;
      for (let y = y0; y < y0 + hy; y++) for (let x = x0; x < x0 + hx; x++) { const i = (y * n + x) * 4; const al = d[i + 3]; if (al < 210) { const k = al < 40 ? 0 : (al - 40) / 170; d[i] = R + (d[i] - R) * k; d[i + 1] = G + (d[i + 1] - G) * k; d[i + 2] = B + (d[i + 2] - B) * k; } }
    }
    const t = spara(new THREE.DataTexture(new Uint8Array(d.buffer), n, m, THREE.RGBAFormat));
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = ANISO; t.needsUpdate = true;
    return t;
  }
  function ruta(g, k, fn) {
    g.save(); g.translate((k % 2) * 512, (k >> 1) * 512);
    g.beginPath(); g.rect(6, 6, 500, 500); g.clip();
    fn(); g.restore();
  }
  // ett blad: bas i (x, y), riktning ang, ena halvan ljusare/mörkare (bladet vrids mot ljuset)
  function blad(g, x, y, ang, len, bred, farg, halva, spets = 0.5, nerv = 0.3) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const k1 = len * (0.5 + spets * 0.25);
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.22, -bred, k1, -bred * 0.75, len, 0);
    g.bezierCurveTo(k1, bred * 0.75, len * 0.22, bred, 0, 0);
    g.fillStyle = farg; g.fill();
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.22, -bred, k1, -bred * 0.75, len, 0); g.closePath();
    g.fillStyle = halva; g.fill();
    if (nerv > 0) { g.strokeStyle = `rgba(225,235,180,${nerv})`; g.lineWidth = Math.max(0.6, bred * 0.1); g.beginPath(); g.moveTo(len * 0.04, 0); g.lineTo(len * 0.9, 0); g.stroke(); }
    g.restore();
  }
  const TX = {};
  const tx = namn => TX[namn] || (TX[namn] = GEN[namn]());
  const GEN = {
    // ljusa betongplattor: 1,6 m plattor med fog
    betong() {
      const [c, g] = duk(512), r = slump(11);
      g.fillStyle = '#cfcac1'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { const v = 185 + r() * 40; g.fillStyle = `rgba(${v | 0},${v - 3 | 0},${v - 8 | 0},.18)`; g.fillRect(r() * 512, r() * 512, 1.6, 1.6); }
      g.fillStyle = 'rgba(70,60,50,.28)'; g.fillRect(0, 0, 512, 3); g.fillRect(0, 0, 3, 512);
      return textur(c, 1.6);
    },
    // gräs: fläckar i tre skalor (sömlöst brus) + strån åt alla håll, inga klippränder. 2,2 m per ruta.
    gras() {
      const n = 512, [c, g] = duk(n), r = slump(21);
      pixlar(g, n, n, (u, v, o, x, y) => {
        // mest fin struktur (strån och tuvor, 3–15 cm); de stora mjuka fläckarna hålls svaga – de lästes som målade moln på mattan
        const p = tfbm(u, v, 4, 4, 3), f = tfbm(u, v, 32, 3, 11), torr = mjuk(0.6, 0.84, tfbm(u, v, 3, 3, 29));
        const t = mjuk(0.2, 0.8, p * 0.32 + f * 0.68), k = hash(x, y, 5) - 0.5, moss = mjuk(0.62, 0.8, tfbm(u, v, 6, 3, 47));
        let R = 58 + 38 * t + 15 * torr + k * 13, G = 84 + 44 * t + 8 * torr + k * 13, B = 37 + 21 * t + 3 * torr + k * 9;
        R += (70 - R) * moss * 0.3; G += (84 - G) * moss * 0.3; B += (44 - B) * moss * 0.3;         // mossfläckar
        const l = 0.3 * R + 0.59 * G + 0.11 * B;                                                    // lite avmättat
        o[0] = R + (l - R) * 0.32; o[1] = G + (l - G) * 0.32; o[2] = B + (l - B) * 0.24;
      });
      for (let i = 0; i < 240; i++) {                         // klöverblad: tre små runda blad
        const x = r() * n, y = r() * n, a = r() * 6.283, rr = 1.3 + r() * 0.9;
        g.fillStyle = `rgba(${58 + r() * 20 | 0},${92 + r() * 22 | 0},${50 + r() * 14 | 0},.55)`;
        for (let k = 0; k < 3; k++) { const b = a + k * 2.094; runt(n, x, y, 4, (px, py) => { g.beginPath(); g.arc(px + Math.cos(b) * rr, py + Math.sin(b) * rr, rr, 0, 6.283); g.fill(); }); }
      }
      g.lineCap = 'round'; g.lineWidth = 1;
      for (let i = 0; i < 17000; i++) {
        const x = r() * n, y = r() * n, a = r() * Math.PI * 2, l = 3 + r() * 7, v = r(), ljus = r() > 0.42;
        g.strokeStyle = ljus ? `rgba(${108 + v * 36 | 0},${130 + v * 30 | 0},${70 + v * 20 | 0},.3)` : `rgba(${52 + v * 14 | 0},${66 + v * 14 | 0},${40 + v * 8 | 0},.22)`;
        const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
        runt(n, x, y, 12, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx, py + dy); g.stroke(); });
      }
      for (let i = 0; i < 110; i++) {                        // enstaka klöver och smörblommor, mycket svagt
        const x = r() * n, y = r() * n;
        g.fillStyle = r() > 0.7 ? 'rgba(214,190,90,.35)' : 'rgba(226,228,200,.28)';
        runt(n, x, y, 3, (px, py) => g.fillRect(px, py, 1.6, 1.6));
      }
      return textur(c, 2.2);
    },
    // markbrus: 256² sömlös ruta, samplas per pixel via världens xz i två skalor (ersätter hörnfärgerna,
    // som gav diagonala ränder på ringnätet). r = stora fläckar, g = mellanskala, b = torrt/ljust
    brus() {
      const n = 256, [c, g] = duk(n);
      pixlar(g, n, n, (u, v, o) => {
        o[0] = mjuk(0.28, 0.72, tfbm(u, v, 4, 4, 301)) * 255;
        o[1] = mjuk(0.25, 0.75, tfbm(u, v, 8, 3, 313)) * 255;
        o[2] = mjuk(0.3, 0.7, tfbm(u, v, 3, 3, 337)) * 255;
      });
      return textur(c, 1, false);
    },
    // detaljgräs: korta strån i gråskala (medel 0,5), 0,75 m per ruta; tonas bort med avståndet
    grasDetalj() {
      const n = 256, [c, g] = duk(n), r = slump(23);
      g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, n, n);
      g.lineCap = 'round'; g.lineWidth = 1.1;
      for (let i = 0; i < 5200; i++) {
        const x = r() * n, y = r() * n, a = -Math.PI / 2 + (r() - 0.5) * 2.2, l = 4 + r() * 9, v = r() > 0.5 ? 150 + r() * 50 : 70 + r() * 40;
        g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},.5)`;
        const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
        runt(n, x, y, 14, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx, py + dy); g.stroke(); });
      }
      return textur(c, 1, false);
    },
    // nertrampad snö längs gången: mörkare, platt remsa med mjuka, ojämna kanter och fotspår.
    // u = tvärs (1,4 m), v = längs (5,2 m per ruta, sömlös)
    tramp() {
      const n = 256, m = 1024, [c, g] = duk(n, m), r = slump(61);
      pixlar(g, n, m, (u, v, o) => {
        const b = tfbm(u, v * 4, 3, 3, 71), f = tfbm(u, v * 4, 12, 2, 83);
        const kant = mjuk(0.02, 0.2 + 0.12 * b, u) * mjuk(0.02, 0.2 + 0.12 * (1 - b), 1 - u);
        const k = 0.9 + 0.1 * f;
        o[0] = 186 * k; o[1] = 194 * k; o[2] = 210 * k; o[3] = 255 * kant * (0.62 + 0.3 * b);
      });
      for (let s = 0; s < 8; s++) {                        // fotspår: två spår, omväxlande vänster/höger fot
        for (const sp of [-1, 1]) {
          const y = (s + (sp > 0 ? 0.5 : 0)) / 8 * m + (r() - 0.5) * 10, x = n / 2 + sp * (20 + r() * 6) + (s % 2 ? 9 : -9), a = (r() - 0.5) * 0.25;
          g.fillStyle = `rgba(150,160,184,${0.35 + r() * 0.2})`;
          for (const oy of [0, -m, m]) { g.beginPath(); g.ellipse(x, y + oy, 9, 22, a, 0, 6.283); g.fill(); }
        }
      }
      const t = textur(c, 1); t.wrapS = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1);
      return t;
    },
    // skogsbotten: mossa, barrmatta och lav, ljusare och läsbar. 3 m per ruta.
    skog() {
      const n = 512, [c, g] = duk(n), r = slump(31);
      pixlar(g, n, n, (u, v, o, x, y) => {
        const p = tfbm(u, v, 3, 4, 7), f = tfbm(u, v, 12, 3, 17), lav = mjuk(0.66, 0.8, tfbm(u, v, 8, 3, 41));
        // barrfläckarna hålls små och mjuka: stora, hårda fläckar i en 3 m-ruta upprepades som diagonala
        // ränder över gläntan (de stora fläckarna kommer i stället från markbruset i världen)
        const b = mjuk(0.3, 0.75, p * 0.45 + f * 0.55) * 0.8, k = hash(x, y, 9) - 0.5;
        let R = 60 + 30 * f, G = 86 + 28 * f, B = 42 + 12 * f;            // mossa (grönare, mindre gulbrun)
        R += (114 - R) * b; G += (94 - G) * b; B += (62 - B) * b;            // barr
        R += (150 - R) * lav * 0.35; G += (154 - G) * lav * 0.35; B += (122 - B) * lav * 0.35;
        o[0] = R + k * 18; o[1] = G + k * 18; o[2] = B + k * 12;
      });
      g.lineCap = 'round';
      for (let i = 0; i < 9000; i++) {
        const v = r(), x = r() * n, y = r() * n, a = r() * Math.PI, l = 2 + r() * 4;
        g.strokeStyle = `rgba(${136 + v * 40 | 0},${96 + v * 26 | 0},${58 + v * 16 | 0},.5)`; g.lineWidth = 0.8;
        runt(n, x, y, 8, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
      }
      for (let i = 0; i < 70; i++) {
        const x = r() * n, y = r() * n, a = r() * Math.PI, l = 12 + r() * 26, w = 1.2 + r();
        g.strokeStyle = 'rgba(70,54,38,.55)'; g.lineWidth = w;
        runt(n, x, y, 40, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
      }
      return textur(c, 3);
    },
    // snö: mjuk yta med svag blå ton i svackorna + glitter (glanskarta och lutande normaler)
    sno() {
      const n = 512, [c, g] = duk(n), r = slump(51);
      pixlar(g, n, n, (u, v, o, x, y) => {
        const p = tfbm(u, v, 3, 4, 5), f = tfbm(u, v, 14, 2, 13), k = hash(x, y, 3) - 0.5;
        const s = p * 0.7 + f * 0.3;
        o[0] = 212 + 22 * s + k * 5; o[1] = 220 + 18 * s + k * 5; o[2] = 234 + 12 * s + k * 4;
      });
      const [cs, gs] = duk(n), [cn, gn] = duk(n);
      gs.fillStyle = 'rgb(10,10,10)'; gs.fillRect(0, 0, n, n);
      gn.fillStyle = 'rgb(128,128,255)'; gn.fillRect(0, 0, n, n);
      for (let i = 0; i < 1500; i++) {
        const x = r() * n | 0, y = r() * n | 0, s = r() > 0.9 ? 2 : 1;
        const nx = (r() - 0.5) * 1.6, ny = (r() - 0.5) * 1.6, nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        gs.fillStyle = '#fff'; gs.fillRect(x, y, s, s);
        gn.fillStyle = `rgb(${128 + nx * 127 | 0},${128 + ny * 127 | 0},${128 + nz * 127 | 0})`; gn.fillRect(x, y, s, s);
      }
      return { karta: textur(c, 3), spec: textur(cs, 3, false), normal: textur(cn, 3, false) };
    },
    // grus: tvättad singel med skugga och högdager på varje sten. 0,9 m per ruta.
    grus() {
      const n = 512, [c, g] = duk(n), r = slump(81);
      pixlar(g, n, n, (u, v, o, x, y) => { const k = tfbm(u, v, 8, 3, 2) * 30 + (hash(x, y, 1) - 0.5) * 20; o[0] = 78 + k; o[1] = 74 + k; o[2] = 68 + k; });
      for (let i = 0; i < 4200; i++) {
        const x = r() * n, y = r() * n, rx = 2.4 + r() * 3.4, ry = rx * (0.6 + r() * 0.35), a = r() * Math.PI;
        const v = 128 + r() * 100, varm = (r() - 0.4) * 18;
        runt(n, x, y, 8, (px, py) => {
          g.fillStyle = 'rgba(28,26,22,.5)'; g.beginPath(); g.ellipse(px + 1, py + 1.2, rx, ry, a, 0, 6.283); g.fill();
          g.fillStyle = `rgb(${v + varm | 0},${v + varm * 0.4 | 0},${v - varm * 0.6 - 6 | 0})`; g.beginPath(); g.ellipse(px, py, rx, ry, a, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,255,250,.2)'; g.beginPath(); g.ellipse(px - rx * 0.3, py - ry * 0.35, rx * 0.45, ry * 0.4, a, 0, 6.283); g.fill();
        });
      }
      return textur(c, 0.9);
    },
    // bark i tre remsor (u): björk (vit med svarta porer), tall (rödbruna plattor), gran/lövträd (gråbrun fjällig)
    bark() {
      const n = 512, [c, g] = duk(n), r = slump(41), W3 = n / 3;
      const vy = (y, h, fn) => { fn(y); if (y + h > n) fn(y - n); if (y < h) fn(y + n); };
      // björk
      g.fillStyle = '#ebe8e1'; g.fillRect(0, 0, W3, n);
      for (let i = 0; i < 700; i++) { const x = r() * W3, y = r() * n, h = 10 + r() * 50; g.fillStyle = r() > 0.5 ? 'rgba(120,112,104,.09)' : 'rgba(255,255,255,.35)'; vy(y, h, yy => g.fillRect(x, yy, 1 + r() * 2.5, h)); }
      for (let i = 0; i < 300; i++) { const x = r() * (W3 - 20), y = r() * n, w = 5 + r() * 24, h = 1.2 + r() * 2.4; g.fillStyle = `rgba(${26 + r() * 20 | 0},${22 + r() * 16 | 0},${20 + r() * 14 | 0},${0.55 + r() * 0.35})`; vy(y, h, yy => g.fillRect(x, yy, w, h)); }
      for (let i = 0; i < 16; i++) {
        const x = r() * W3, y = r() * n, rx = 8 + r() * 18, ry = 3 + r() * 6;
        vy(y, ry * 2, yy => { g.fillStyle = 'rgba(34,28,26,.6)'; g.beginPath(); g.ellipse(x, yy, rx, ry, (r() - 0.5) * 0.3, 0, 6.283); g.fill(); });
      }
      for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(40,34,30,.5)'; g.fillRect(r() * W3, r() * n, 1.2, 1.2); }
      // tall
      g.fillStyle = '#3b2a20'; g.fillRect(W3, 0, W3, n);
      for (let i = 0; i < 340; i++) {
        const x = W3 + r() * W3, y = r() * n, w = 16 + r() * 34, h = 12 + r() * 30, v = r();
        vy(y, h, yy => {
          g.fillStyle = `rgb(${132 + v * 46 | 0},${78 + v * 30 | 0},${50 + v * 20 | 0})`; g.beginPath(); g.ellipse(x, yy, w / 2, h / 2, (r() - 0.5) * 0.25, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,220,180,.14)'; g.beginPath(); g.ellipse(x - w * 0.1, yy - h * 0.15, w * 0.32, h * 0.22, 0, 0, 6.283); g.fill();
        });
      }
      // gran / lövträd
      g.fillStyle = '#5b4d40'; g.fillRect(2 * W3, 0, n - 2 * W3, n);
      for (let i = 0; i < 2600; i++) {
        const x = 2 * W3 + r() * W3, y = r() * n, v = r();
        vy(y, 8, yy => { g.fillStyle = `rgba(${70 + v * 70 | 0},${60 + v * 56 | 0},${50 + v * 46 | 0},.55)`; g.beginPath(); g.ellipse(x, yy, 2 + r() * 5, 1.5 + r() * 4, 0, 0, 6.283); g.fill(); });
      }
      for (let i = 0; i < 60; i++) { const x = 2 * W3 + r() * W3, y = r() * n, h = 20 + r() * 70; g.fillStyle = 'rgba(30,24,20,.45)'; vy(y, h, yy => g.fillRect(x, yy, 1.5 + r() * 1.5, h)); }
      return textur(c, 1);
    },
    // lövatlas: 0 björkskott (hängande), 1 lövkluster, 2 granskott (bas uppe, spets nere), 3 tallruska
    lovAtlas() {
      const [c, g] = duk(1024), r = slump(501);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const halva = () => r() > 0.5 ? `rgba(255,255,215,${0.1 + r() * 0.1})` : `rgba(10,22,0,${0.1 + r() * 0.12})`;
      ruta(g, 0, () => {
        const blads = [];
        const kvist = (x0, y0, len, sway, tj, bladen) => {
          const P = [];
          for (let i = 0; i <= 20; i++) { const t = i / 20; P.push([x0 + sway * t * t + Math.sin(t * 3 + x0) * 5, y0 + len * t]); }
          g.strokeStyle = '#4d3b2e';
          for (let i = 0; i < 20; i++) { g.lineWidth = tj * (1 - i / 26); g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]); g.stroke(); }
          if (!bladen) return;
          let sida = 1;
          for (let d = 8 + r() * 6; d < len; d += 9 + r() * 6) {
            const t = d / len, i = Math.min(19, t * 20 | 0), p = P[i];
            sida = -sida;
            const l = 15 + r() * 10;
            blads.push([p[0], p[1], Math.PI / 2 + sida * (0.45 + r() * 0.6), l, l * 0.42]);
            if (r() < 0.06) kvist(p[0], p[1], 50 + r() * 70, sida * (30 + r() * 30), 1.2, true);
          }
        };
        for (let k = 0; k < 11; k++) kvist(30 + k * 41 + r() * 22, 6 + r() * 46, 330 + r() * 160, (r() - 0.5) * 110, 2.2, true);
        blads.sort(() => r() - 0.5).forEach(b => blad(g, b[0], b[1], b[2], b[3], b[4], hsl(70 + r() * 22, 38 + r() * 20, 26 + r() * 18), halva(), 0.85, 0.25));
      });
      ruta(g, 1, () => {
        g.strokeStyle = '#4a3b2c';
        for (let i = 0; i < 6; i++) { const a = r() * 6.283, l = 140 + r() * 80; g.lineWidth = 4; g.beginPath(); g.moveTo(256, 256); g.quadraticCurveTo(256 + Math.cos(a + 0.3) * l * 0.5, 256 + Math.sin(a + 0.3) * l * 0.5, 256 + Math.cos(a) * l, 256 + Math.sin(a) * l); g.stroke(); }
        const L = [];
        for (let i = 0; i < 150; i++) {
          const a = r() * 6.283, d = 225 * Math.sqrt(r()) * (0.82 + 0.18 * Math.sin(a * 3 + 1)), l = 26 + r() * 22;
          L.push([256 + Math.cos(a) * d - Math.cos(a) * l * 0.4, 256 + Math.sin(a) * d - Math.sin(a) * l * 0.4, a + (r() - 0.5) * 1.3, l, l * 0.5, d / 225]);
        }
        L.sort((p, q) => p[5] - q[5] + (r() - 0.5) * 0.6);
        L.forEach(b => blad(g, b[0], b[1], b[2], b[3], b[4], hsl(80 + r() * 26, 32 + r() * 22, 20 + r() * 16 + b[5] * 6), halva(), 0.55, 0.3));
      });
      ruta(g, 2, () => {
        const axel = t => [256 + Math.sin(t * 2.4) * 14, 10 + t * 492];
        const bredd = t => 205 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.92)), 0.6) * (1 - 0.45 * t);
        const hink = [[], [], [], [], [], []];
        const farg = ['#122720', '#183026', '#1f3a2e', '#274536', '#2d4c3a', '#34563f'];   // dämpade spetsar (inga ljusa kanter som läses som blad)
        const barr = (x, y, a, l, ny) => hink[ny ? 4 + (r() * 2 | 0) : (r() * 4 | 0)].push([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l]);
        for (let t = 0.02; t < 0.97; t += 0.035) for (const s of [-1, 1]) {
          const [x0, y0] = axel(t + (s > 0 ? 0.017 : 0)), vinkel = Math.PI / 2 - s * 0.95, len = bredd(t) / Math.sin(0.95) * (0.8 + r() * 0.3);
          const dx = Math.cos(vinkel), dy = Math.sin(vinkel);
          g.strokeStyle = '#3a2c20'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
          for (let d = 0; d < len; d += 2.6) {
            const x = x0 + dx * d, y = y0 + dy * d, ny = d > len * 0.72, l = 6 + r() * 5;
            barr(x, y, vinkel + 0.95 + r() * 0.3, l, ny); barr(x, y, vinkel - 0.95 - r() * 0.3, l, ny);
          }
        }
        for (let t = 0; t < 1; t += 0.006) { const [x, y] = axel(t); barr(x, y, Math.PI / 2 + 0.8, 8, false); barr(x, y, Math.PI / 2 - 0.8, 8, false); }
        g.lineWidth = 1.7;
        hink.forEach((h, i) => { g.strokeStyle = farg[i]; g.beginPath(); h.forEach(s => { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); }); g.stroke(); });
      });
      ruta(g, 3, () => {
        g.strokeStyle = '#5a3e2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(256, 500); g.quadraticCurveTo(240, 330, 262, 150); g.stroke();
        const farg = ['#33463a', '#3e5343', '#4a5f4b', '#586d55', '#687c61'];
        const tofsar = [];
        for (let i = 0; i < 12; i++) { const a = r() * 6.283, d = 175 * Math.sqrt(r()); tofsar.push([256 + Math.cos(a) * d, 250 + Math.sin(a) * d * 0.9, r()]); }
        tofsar.sort((a, b) => a[2] - b[2]).forEach(([x, y, v]) => {
          g.strokeStyle = '#5a3e2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(256, 330); g.lineTo(x, y); g.stroke();
          const bas = Math.atan2(y - 300, x - 256), hink = [[], [], [], [], []];
          for (let k = 0; k < 80; k++) {
            const a = bas + (r() - 0.5) * 3.2, l = 34 + r() * 36, b = (r() - 0.5) * 12;
            hink[Math.min(4, (v * 2 + r() * 3) | 0)].push([x, y, x + Math.cos(a) * l * 0.5 - Math.sin(a) * b, y + Math.sin(a) * l * 0.5 + Math.cos(a) * b, x + Math.cos(a) * l, y + Math.sin(a) * l]);
          }
          g.lineWidth = 1.6;
          hink.forEach((h, i) => { g.strokeStyle = farg[i]; g.beginPath(); h.forEach(s => { g.moveTo(s[0], s[1]); g.quadraticCurveTo(s[2], s[3], s[4], s[5]); }); g.stroke(); });
        });
      });
      return atlas(c);
    },
    // markväxter: 0 grässtrån, 1 gräs med blommor, 2 ormbunksblad (spets uppe), 3 blåbärsris. Basen nere.
    markAtlas() {
      const [c, g] = duk(1024), r = slump(601);
      g.lineCap = 'round';
      const stra = (x, y, h, b, lut, hu, sa, li) => {
        const gr = g.createLinearGradient(x, y, x + lut, y - h);
        gr.addColorStop(0, hsl(hu, sa, li - 16)); gr.addColorStop(0.55, hsl(hu, sa, li)); gr.addColorStop(1, hsl(hu - 6, sa - 6, li + 8));
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - b / 2, y);
        g.quadraticCurveTo(x - b * 0.3 + lut * 0.25, y - h * 0.55, x + lut, y - h);
        g.quadraticCurveTo(x + b * 0.3 + lut * 0.25, y - h * 0.55, x + b / 2, y); g.closePath(); g.fill();
      };
      const fan = (n, hmin, hmax, hu0, li0) => {
        for (let i = 0; i < n; i++) {
          const o = (r() - 0.5) * 2, x = 256 + o * 46, h = (hmin + r() * (hmax - hmin)) * (1 - 0.35 * Math.abs(o)), lut = o * 170 + (r() - 0.5) * 120;
          stra(x, 508, h, 3.5 + r() * 4, Math.max(-235, Math.min(235, lut)), hu0 + r() * 28, 20 + r() * 20, li0 + r() * 18);
        }
      };
      ruta(g, 0, () => fan(150, 230, 490, 64, 26));
      ruta(g, 1, () => {
        fan(80, 180, 400, 68, 30);
        for (let i = 0; i < 12; i++) {
          const x = 110 + r() * 292, y = 508 - (200 + r() * 230), typ = r();
          g.strokeStyle = '#5d7a34'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(256 + (x - 256) * 0.2, 508); g.lineTo(x, y); g.stroke();
          if (typ < 0.4) {                       // prästkrage
            g.fillStyle = '#f6f4ec'; for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 6, 8, 3, a, 0, 6.283); g.fill(); }
            g.fillStyle = '#e8b62c'; g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.fill();
          } else if (typ < 0.7) {                // smörblomma
            g.fillStyle = '#f0c531'; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 4, 5.5, 0, 6.283); g.fill(); }
          } else if (typ < 0.85) {               // blåklocka
            g.fillStyle = '#6a6fd2'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + (k - 1.5) * 7, y + k * 8, 5, 7, 0, 0, 6.283); g.fill(); }
          } else {                               // rödklöver
            g.fillStyle = '#c9688f'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14, 4, 0, 6.283); g.fill(); }
          }
        }
      });
      ruta(g, 2, () => {
        const rak = t => [256 + Math.sin(t * 2.2) * 10, 506 - t * 492];
        g.strokeStyle = '#4b6a2a'; g.lineWidth = 3;
        g.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const p = rak(t); t ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
        for (let t = 0.04; t < 0.97; t += 0.032) for (const s of [-1, 1]) {
          const tt = t + (s > 0 ? 0.016 : 0), p = rak(tt), pl = 210 * Math.pow(Math.sin(Math.PI * Math.pow(tt, 0.75)), 0.85) * (1 - 0.3 * tt) + 8;
          const va = 1.15 - 0.35 * tt, dx = Math.sin(va) * s, dy = -Math.cos(va), px = -dy, py = dx, fa = hsl(84 + r() * 14, 44 + r() * 16, 28 + r() * 14);
          g.fillStyle = fa;
          for (let d = 0; d < pl; d += 6.5) {
            const q = d / pl, x = p[0] + dx * d, y = p[1] + dy * d + q * q * 12, lo = (1 - q) * 9 + 2.5;
            for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + px * lo * 0.55 * k, y + py * lo * 0.55 * k, lo, lo * 0.5, Math.atan2(py * k + dy * 0.6, px * k + dx * 0.6), 0, 6.283); g.fill(); }
          }
        }
      });
      ruta(g, 3, () => {
        const blads = [];
        for (let i = 0; i < 16; i++) {
          const x0 = 256 + (r() - 0.5) * 260, x1 = x0 + (r() - 0.5) * 220, y1 = 508 - (180 + r() * 270);
          g.strokeStyle = '#5b6b2d'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, 508); g.quadraticCurveTo(x0, (508 + y1) / 2, x1, y1); g.stroke();
          for (let t = 0.15; t <= 1; t += 0.06) {
            const u = 1 - t, x = u * u * x0 + 2 * u * t * x0 + t * t * x1, y = u * u * 508 + 2 * u * t * ((508 + y1) / 2) + t * t * y1;
            blads.push([x, y, -Math.PI / 2 + (r() > 0.5 ? 1 : -1) * (0.7 + r() * 0.6), 9 + r() * 7]);
          }
        }
        blads.forEach(b => blad(g, b[0], b[1], b[2], b[3], b[3] * 0.62, r() < 0.1 ? hsl(28, 40, 36) : hsl(92 + r() * 22, 40 + r() * 18, 22 + r() * 16), (r() > 0.5 ? 'rgba(255,255,215,.14)' : 'rgba(10,22,0,.14)'), 0.4, 0));
        for (let i = 0; i < 30; i++) {
          const x = 120 + r() * 272, y = 120 + r() * 340, rr = 5 + r() * 1.8;
          g.fillStyle = r() > 0.5 ? '#26325a' : '#333f72'; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(205,215,255,.55)'; g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.3, 0, 6.283); g.fill();
        }
      });
      return atlas(c);
    },
    // partiklar: snöflinga, löv och barr (vita, färgen kommer från hörnfärgen)
    flinga() {
      const [c, g] = duk(64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const t = spara(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
    },
    lovSprite() {
      const [c, g] = duk(64);
      blad(g, 6, 34, -0.35, 54, 17, '#ffffff', 'rgba(0,0,0,.14)', 0.6, 0.5);
      const t = spara(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
    },
    barrSprite() {
      const [c, g] = duk(64); g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(14, 52); g.lineTo(50, 12); g.stroke();
      const t = spara(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
    },
    sten() {
      const [c, g] = duk(256), r = slump(71);
      g.fillStyle = '#e6e2da'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 30; i++) {
        const x = r() * 256, y = r() * 256, rad = 15 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, r() > 0.5 ? 'rgba(255,255,250,.12)' : 'rgba(60,55,50,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 5000; i++) { const v = 120 + r() * 120 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 9},.3)`; g.fillRect(r() * 256, r() * 256, 1.2, 1.2); }
      // granit: korn av ljus fältspat (vit till svagt rosa), grå kvarts och svart glimmer
      for (let i = 0; i < 2600; i++) { const ro = r() > 0.6; g.fillStyle = ro ? `rgba(236,214,204,${0.35 + r() * 0.3})` : `rgba(250,248,242,${0.3 + r() * 0.3})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2.2, 1 + r() * 1.8); }
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(150,150,154,${0.25 + r() * 0.25})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 1.6, 1 + r() * 1.6); }
      for (let i = 0; i < 2200; i++) { const v = 30 + r() * 30 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${0.45 + r() * 0.35})`; g.fillRect(r() * 256, r() * 256, 0.8 + r() * 1.4, 0.8 + r() * 1.2); }
      const t = textur(c, 1); t.repeat.set(1, 1); return t;
    },
    // mjuk rund skugga under träd och buskar
    flack() {
      const [c, g] = duk(128), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = spara(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
    },
    // moln på himlen: bara alfa, färgen sätts i skuggaren (följer kvällen)
    moln() {
      const n = 1024, m = 256, [c, g] = duk(n, m);
      pixlar(g, n, m, (u, v, o) => {
        // höjd över horisonten: sfärens v går från pol till pol, så raden 0 = zenit och mittraden = horisonten
        // (förr räknades sista raden som horisont: molnen blev så svaga att himlen såg tom ut)
        const e = (0.5 - v) * Math.PI;
        if (e <= 0) { o[0] = o[1] = o[2] = 255; o[3] = 0; return; }
        const d = tfbm(u, v * 2 + 0.1, 6, 5, 71) * 0.75 + tfbm(u, v * 2, 24, 2, 5) * 0.25;   // flacka molnbankar mot horisonten
        const a = mjuk(0.45, 0.66, d) * mjuk(0.02, 0.16, e) * (1 - 0.4 * mjuk(0.6, 1.3, e));
        o[0] = o[1] = o[2] = 255; o[3] = a * 255;
      });
      const t = spara(new THREE.CanvasTexture(c));
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    },
  };

  // ---- skuggartillägg ----
  // tva: marken samplar sin textur i två skalor (vriden och 3,7 gånger större) så att rutorna inte syns.
  // upp: dubbelsidiga kort behåller sin normal på baksidan (ingen svart baksida).
  // gnistra: snön glittrar blått i månsken (vinterns mark, styrs av uGnistra).
  // Alla miljöns material får dessutom ett mjukt omgivningsljus (miljoLjus).
  const LJUS = { value: new THREE.Color(0.3, 0.3, 0.3) };
  // mark: markens färgvariation samplas per pixel ur brustexturen via världens xz (två skalor),
  //   valfritt detaljgräs som tonas bort med avståndet, mjuka klippränder och avmättning.
  // glitter: procedurellt glitter (drivor): solglitter på dagen, blått i månsken (uGnistra).
  // sten: mossa på ovansidor (i fläckar), lav och mörk fot där stenen möter marken.
  // studio: studiogolvet – varje platta får sin egen svaga ton, en mjuk skugga samlas kring huset, golvet
  //   mörknar lätt ut mot fonden (ljuset ligger på huset) och får en diskret blank reflex i flacka vinklar.
  function patcha(m, { tva = false, upp = false, gnistra = false, mot = false, mark = null, glitter = false, sten = false, studio = false } = {}) {
    const MU = mark && {
      uBrus: { value: tx('brus') }, uDetalj: { value: mark.detalj ? tx('grasDetalj') : null },
      uMA: { value: new THREE.Vector3(...mark.A) }, uMB: { value: new THREE.Vector3(...mark.B) }, uMC: { value: new THREE.Vector3(...(mark.C || ETT)) },
      uMRad: { value: new THREE.Vector2(...(mark.rad || [900, 1000])) }, uMAmp: { value: mark.amp }, uMSat: { value: mark.sat ?? 1 },
    };
    m.onBeforeCompile = s => {
      s.uniforms.miljoLjus = LJUS; s.uniforms.uGnistra = VU.uGnistra; s.uniforms.uSol = VU.uSol; s.uniforms.uSSS = VU.uSSS; s.uniforms.uGlitter = VU.uGlitter; s.uniforms.uTid = VU.uTid;
      if (MU) Object.assign(s.uniforms, MU);
      let f = 'uniform vec3 miljoLjus;\nuniform float uGnistra;\nuniform vec3 uSol;\nuniform vec3 uSSS;\nuniform float uGlitter;\nuniform float uTid;\n' + s.fragmentShader;
      if (studio) {
        s.uniforms.uHus = VU.uHus;
        f = 'uniform vec4 uHus;\n' + f.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 sp = floor( vVM.xz / 1.6 );
          float sh = fract( sin( dot( sp, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          float sd = length( max( abs( vVM.xz ) - uHus.xy, 0.0 ) );
          diffuseColor.rgb *= ( 0.972 + 0.056 * sh ) * ( 1.0 - 0.17 * exp( -sd * 0.6 ) ) * mix( 1.03, 0.9, smoothstep( 7.0, 44.0, length( vVM.xz ) ) );
        }`);
      }
      if (mark || glitter || sten || studio) {
        s.vertexShader = 'varying vec3 vVM;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { vec4 wq = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
              wq = instanceMatrix * wq;
            #endif
            vVM = ( modelMatrix * wq ).xyz; }`);
        f = 'varying vec3 vVM;\n' + f;
      }
      if (sten) {
        // vSt: stenens egen höjd (−0,38 fot … 0,74 topp) och hur mycket ytan vetter uppåt
        s.uniforms.uBrus = { value: tx('brus') };
        s.vertexShader = 'varying vec2 vSt;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n          vSt = vec2( position.y, normal.y );');
        f = 'varying vec2 vSt;\nuniform sampler2D uBrus;\n' + f.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float mn = texture2D( uBrus, vVM.xz / 2.3 + vVM.y * 0.37 ).g;
          float ms = smoothstep( 0.4, 0.82, vSt.y * 0.8 + ( mn - 0.5 ) * 1.1 );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * vec3( 0.085, 0.14, 0.04 ) * ( 0.7 + 0.6 * mn ), ms * 0.85 );
          float lv = smoothstep( 0.6, 0.74, texture2D( uBrus, vVM.xz / 0.83 + vVM.y ).r ) * ( 1.0 - ms );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * vec3( 0.42, 0.45, 0.33 ), lv * 0.4 );
          diffuseColor.rgb *= 0.42 + 0.58 * smoothstep( -0.36, 0.1, vSt.x );
        }`);
      }
      if (tva) f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 tA = texture2D( map, vMapUv );
          vec4 tB = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.27 + vec2( 0.31, 0.67 ) );
          diffuseColor *= mix( tA, tB, 0.45 );
        #endif`);
      if (mark) s.uniforms.uHus = VU.uHus;
      if (mark) f = 'uniform vec4 uHus;\nuniform sampler2D uBrus;\nuniform vec3 uMA;\nuniform vec3 uMB;\nuniform vec3 uMC;\nuniform vec2 uMRad;\nuniform float uMAmp;\nuniform float uMSat;\n' + (mark.detalj ? 'uniform sampler2D uDetalj;\n' : '') +
        f.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 xz = vVM.xz;
          vec3 b1 = texture2D( uBrus, xz / 41.0 ).rgb;
          vec3 b2 = texture2D( uBrus, mat2( 0.8, -0.6, 0.6, 0.8 ) * xz / 8.3 + vec2( 0.37, 0.71 ) ).rgb;
          float nn = b1.r * 0.72 + b2.r * 0.28;
          vec3 k = mix( uMA, uMB, nn );
          k *= 1.0 + uMAmp * ( b2.g - 0.5 );
          k = mix( k, k * uMC, smoothstep( uMRad.x, uMRad.y, length( xz ) ) * ( 0.45 + 0.55 * b1.b ) );
          diffuseColor.rgb *= k;
          ${mark.rel ? `{
            // höjdkänsla: tuvor/vindrippel ur brustexturen, belysta från solens håll (skillnaden mot
            // en punkt en bit mot solen ger ljus sida och skuggsida) – syns även på utzoomat avstånd
            #define REL( p ) ( ${mark.rel.karta} )
            vec2 rs = normalize( uSol.xz + vec2( 1e-4 ) ) * ${mark.rel.steg.toFixed(3)};
            float r0 = texture2D( uBrus, REL( xz ) ).g, r1 = texture2D( uBrus, REL( xz + rs ) ).g;
            #undef REL
            float rn = 1.0 - smoothstep( 34.0, 80.0, distance( vVM, cameraPosition ) );
            float rl = rn * ( ( r0 - 0.5 ) * ${mark.rel.amp.toFixed(3)} + clamp( ( r0 - r1 ) * ${mark.rel.lut.toFixed(3)}, -0.13, 0.13 ) );
            diffuseColor.rgb *= 1.0 + rl * vec3( ${mark.rel.farg.map(v => v.toFixed(2)).join(', ')} );
          }` : ''}
          ${mark.detalj ? `{
            float dn = 1.0 - smoothstep( 9.0, 30.0, distance( vVM, cameraPosition ) );
            if ( dn > 0.0 ) {
              // en sampling (förr två): den grova skalan kommer nu från höjdkänslan ovan, så marken kostar inte mer än förut
              float dt = texture2D( uDetalj, vec2( xz.x + xz.y * 0.31, xz.y - xz.x * 0.31 ) / 0.83 ).r;
              diffuseColor.rgb *= mix( 1.0, 0.72 + 0.56 * dt, dn );
            }
          }` : ''}
          ${mark.klipp ? `{
            // gräskanten mot singelbädden: en mörkare, frodigare rand där klipparen inte kommer åt
            float gk = 1.0 - smoothstep( 0.4, 1.25, length( max( abs( xz ) - uHus.xy, 0.0 ) ) );
            diffuseColor.rgb *= vec3( 1.0 - 0.2 * gk, 1.0 - 0.13 * gk, 1.0 - 0.2 * gk );
            float rr = max( abs( xz.x ) - 3.0, abs( xz.y ) - 2.0 );
            float band = smoothstep( -0.55, 0.55, sin( xz.x * 2.856 ) ) * ( 1.0 - smoothstep( 9.0, 15.0, rr ) );
            diffuseColor.rgb *= vec3( 1.0 + 0.06 * band, 1.0 + 0.055 * band, 1.0 + 0.025 * band ) * ( 1.0 - 0.018 * ( 1.0 - smoothstep( 9.0, 15.0, rr ) ) );
          }` : ''}
          float lm = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
          diffuseColor.rgb = mix( vec3( lm ), diffuseColor.rgb, uMSat );
        }`);
      if (upp) f = f.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
      let slut = '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;';
      if (mot) slut += `
        {
          vec3 sv = normalize( ( viewMatrix * vec4( uSol, 0.0 ) ).xyz );
          float mt = pow( max( dot( normalize( -vViewPosition ), sv ), 0.0 ), 3.0 );
          reflectedLight.indirectDiffuse += diffuseColor.rgb * uSSS * ( 0.25 + 1.6 * mt );
        }`;
      if (studio) slut += `
        { float sf = pow( 1.0 - max( dot( normal, normalize( vViewPosition ) ), 0.0 ), 5.0 );
          totalEmissiveRadiance += miljoLjus * sf * 1.1; }`;
      if (gnistra) slut += `
        #ifdef USE_SPECULARMAP
          {
            float gl = texture2D( specularMap, vSpecularMapUv ).r;
            totalEmissiveRadiance += vec3( 0.6, 0.75, 1.0 ) * smoothstep( 0.5, 0.95, gl ) * uGnistra;
          }
        #endif`;
      if (glitter) slut += `
        {
          vec3 cel = floor( vVM * 48.0 );
          float h = fract( sin( dot( cel, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
          vec3 vd = normalize( cameraPosition - vVM );
          float h2 = fract( sin( dot( cel + floor( vd * 5.0 ), vec3( 39.3, 11.7, 83.1 ) ) ) * 24634.6345 );
          float gl = step( 0.982, h ) * step( 0.55, h2 ) * ( 0.7 + 0.3 * sin( uTid * 2.7 + h * 90.0 ) );
          float sl = max( dot( normalize( ( viewMatrix * vec4( uSol, 0.0 ) ).xyz ), normal ), 0.0 );
          totalEmissiveRadiance += vec3( 0.75, 0.86, 1.0 ) * gl * ( uGlitter * sl * 0.8 + uGnistra * 1.1 );
          // form: sidan som vetter från solen får blåare, svagare ljus (drivan lästes som en platt skiva)
          reflectedLight.directDiffuse *= mix( vec3( 0.62, 0.74, 0.96 ), vec3( 1.0 ), smoothstep( 0.2, 0.85, sl ) );
        }`;
      s.fragmentShader = f.replace('#include <lights_fragment_end>', slut);
    };
    m.customProgramCacheKey = () => 'miljo' + (tva ? '-tva' : '') + (upp ? '-upp' : '') + (gnistra ? '-gn' : '') + (mot ? '-mot' : '') + (mark ? '-m' + mark.id : '') + (glitter ? '-gl' : '') + (sten ? '-st' : '') + (studio ? '-sd' : '');
    return m;
  }
  const tvaSkalor = m => patcha(m, { tva: true });

  // Träd mellan kameran och huset tonas bort med ett rutmönster (ingen genomskinlighet, inget
  // sorteringsfel): utzoomad från baksidan stod kameran bakom eller mitt i en gran och såg bara
  // barr. En kon från kameran till husets kontur (uHus) plus en sfär kring kameran; träd vid och
  // bakom huset rörs inte, och bara färgpasset (skuggorna står kvar).
  // lag: lövverk under ~1,2 m (buskar, häck) står kvar i konen – de skymmer inte huset men blev rutiga i förgrunden
  const NARA_GLSL = (p, lag = false) => `
        { vec3 nc = vec3( 0.0, uHus.z * 0.4, 0.0 ) - cameraPosition; float nL = length( nc ), nR = length( uHus.xy ) + 0.8;
          vec3 nu = nc / max( nL, 1e-3 ), nw = ${p} - cameraPosition; float nt = dot( nw, nu );
          float nk = 1.0 - smoothstep( 3.0, 6.5, length( nw ) );
          if ( nt > 0.0 && nt < nL - nR ) {
            float nr = nR * nt / nL + 0.6;
            // konen är plattare på höjden (huset är lägre än det är brett): låga buskar under siktlinjen rastreras inte bort
            nk = max( nk, ( 1.0 - smoothstep( nr * 0.8, nr * 1.2 + 0.6, length( ( nw - nu * nt ) * vec3( 1.0, 1.7, 1.0 ) ) ) ) * ( 1.0 - smoothstep( nL - nR - 3.0, nL - nR, nt ) )${lag ? ` * smoothstep( 1.15, 1.7, ${p}.y )` : ''} );
          }
          if ( nk > 0.0 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) < nk ) discard; }`;
  // Vegetationens skuggare: vind (stammen böjs mer ju högre upp, löv fladdrar, byar via brus),
  // genomlysning (ljusare när man ser mot solen genom bladen), snö på ovansidor, mjukare alfa
  // på avstånd (mip-korrigering), uttoning med avståndet och glöd (lampor i barkgeometrin).
  function vegPatch(m, { sss = false, sno = false, fade = false, mip = false, upp = false, glod = false, snoBak = 0.3, fadeAv = null, nara = false } = {}) {
    m.onBeforeCompile = s => {
      Object.assign(s.uniforms, { miljoLjus: LJUS, uTid: VU.uTid, uVind: VU.uVind, uSol: VU.uSol, uSSS: VU.uSSS, uSno: VU.uSno, uFade: VU.uFade, uGlod: VU.uGlod, uLampa: VU.uLampa, uHus: VU.uHus, uNatt: VU.uNatt });
      s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\nattribute vec4 aVind;\nattribute float aSno;\nvarying float vSno;\nvarying vec3 vVarld;\n' +
        s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            float fas = aVind.x * 0.07 + aVind.y * 0.05;
            float by = sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 );
            float g = 0.55 + 0.45 * by;
            float sv = aVind.z * ( g * 1.1 + 0.25 * sin( uTid * 1.35 + fas * 3.0 ) + 0.12 * sin( uTid * 2.9 + fas * 5.0 ) );
            transformed.xz += uVind * sv;
            transformed.y -= abs( sv ) * 0.1;
            float fl = aVind.w * ( 0.45 + 0.8 * g );
            vec3 q = position * 1.7;
            transformed += fl * vec3( sin( uTid * 6.1 + q.x + q.y * 1.3 ), 0.5 * sin( uTid * 7.3 + q.z * 1.1 + q.y ), cos( uTid * 5.3 + q.y * 1.2 + q.z ) );
          }
          vSno = aSno;
          vVarld = transformed;`);
      let f = 'uniform vec4 uHus;\nuniform float uNatt;\nuniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform vec3 uSol;\nuniform float uSno;\nuniform vec2 uFade;\nuniform vec3 uGlod;\nuniform float uLampa;\nvarying float vSno;\nvarying vec3 vVarld;\n' + s.fragmentShader;
      let at = '';
      if (mip) at += `
        #ifdef USE_MAP
          { vec2 dd = vec2( length( dFdx( vMapUv ) ), length( dFdy( vMapUv ) ) ) * 1024.0;
            diffuseColor.a *= 1.0 + max( log2( max( max( dd.x, dd.y ), 1e-4 ) ), 0.0 ) * 0.55; }   // tätare kronor på avstånd (färre glipor mot bakgrunden)
        #endif`;
      if (nara) at += NARA_GLSL('vVarld', nara === 'lag');
      if (fade) at += fadeAv ? `\n diffuseColor.a *= 1.0 - smoothstep( ${fadeAv[0].toFixed(1)}, ${fadeAv[1].toFixed(1)}, distance( vVarld, cameraPosition ) );` : '\n diffuseColor.a *= 1.0 - smoothstep( uFade.x, uFade.y, distance( vVarld.xz, cameraPosition.xz ) );';
      if (mip) f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          { vec2 dd0 = fwidth( vMapUv ) * 1024.0;
            // högst mipnivå 3: längre ner blöder grannrutorna i atlasen (ljusa björklöv) in i kortkanterna
            float lod0 = clamp( log2( max( max( dd0.x, dd0.y ), 1e-4 ) ), 0.0, 3.0 );
            diffuseColor *= textureLod( map, vMapUv, lod0 ); }
        #endif`);
      // natt: vit näver, snö på grenar och ljusa blommor dämpas (lyste mot de mörka kronorna); lampornas glöd är emissiv och rörs inte
      at += '\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );';
      f = f.replace('#include <alphatest_fragment>', at + '\n#include <alphatest_fragment>');
      if (sno) f = f.replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef USE_MAP
          { vec2 sq = vMapUv * 20.0, si = floor( sq ), sf = fract( sq ); sf = sf * sf * ( 3.0 - 2.0 * sf );
            #define MH(p) fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 )
            float n = mix( mix( MH( si ), MH( si + vec2( 1.0, 0.0 ) ), sf.x ), mix( MH( si + vec2( 0.0, 1.0 ) ), MH( si + vec2( 1.0 ) ), sf.x ), sf.y );
            #undef MH
            float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) );
            float sn = smoothstep( 0.4, 0.62, vSno * uSno + ( n - 0.5 ) * 0.55 + lum * 0.06 ) * ( gl_FrontFacing ? 1.0 : ${snoBak.toFixed(2)} );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.93, 0.97 ) * ( 0.88 + 0.12 * n ), sn ); }
        #endif`);
      // lampornas delar (aSno > 0,05) får egen färg utan barktextur: grafitstolpe, frostat band och ljust lock
      if (glod) f = f.replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef USE_COLOR
          if ( vSno > 0.05 ) diffuseColor.rgb = vSno > 0.5 ? mix( vec3( 0.07, 0.072, 0.076 ), vColor, smoothstep( vSno - 1.0, vSno - 0.6, uLampa ) ) : vColor;
        #endif`);
      if (upp) f = f.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
      let slut = '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;';
      if (sss) slut += '\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uSSS * ( 0.3 + 1.5 * pow( max( dot( normalize( vVarld - cameraPosition ), uSol ), 0.0 ), 4.0 ) );';
      // bandet glöder när uLampa passerat lampans fördröjning (aSno = 1 + fördröjning)
      if (glod) slut += '\n\tif ( vSno > 0.5 ) totalEmissiveRadiance += uGlod * smoothstep( vSno - 1.0, vSno - 0.6, uLampa );';
      s.fragmentShader = f.replace('#include <lights_fragment_end>', slut);
    };
    const nyckel = ['veg', sss, sno, fade, mip, upp, glod, snoBak, fadeAv, nara].join('-');
    m.customProgramCacheKey = () => nyckel;
    return m;
  }

  // ---- geometrier ----
  // Marken: en rund skiva (r 230 m) i polärt rutnät, tätare nära huset. Platt närmast huset,
  // svagt böljande längre ut. UV i meter, så varje textur sätter sin egen rutstorlek via repeat.
  const RMAX = 230, RINGAR = 46, SEKT = 84;   // något glesare mark (trianglar)
  function markGeo(farg, hojd) {
    const n = 1 + RINGAR * SEKT, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const satt = (i, x, z) => {
      pos[i * 3] = x; pos[i * 3 + 1] = hojd ? hojd(x, z) : 0; pos[i * 3 + 2] = z; nor[i * 3 + 1] = 1; uv[i * 2] = x; uv[i * 2 + 1] = z;
      const f = farg ? farg(x, z, Math.hypot(x, z)) : [1, 1, 1];
      col[i * 3] = f[0]; col[i * 3 + 1] = f[1]; col[i * 3 + 2] = f[2];
    };
    satt(0, 0, 0);
    for (let i = 1; i <= RINGAR; i++) {
      const rr = RMAX * Math.pow(i / RINGAR, 2.2);
      for (let j = 0; j < SEKT; j++) { const a = (j + (i % 2) * 0.5) / SEKT * Math.PI * 2; satt(1 + (i - 1) * SEKT + j, Math.cos(a) * rr, Math.sin(a) * rr); }
    }
    const idx = [], V = (i, j) => 1 + (i - 1) * SEKT + (j % SEKT);
    for (let j = 0; j < SEKT; j++) idx.push(0, V(1, j + 1), V(1, j));
    for (let i = 1; i < RINGAR; i++) for (let j = 0; j < SEKT; j++) {
      const i0 = V(i, j), i1 = V(i, j + 1), o0 = V(i + 1, j), o1 = V(i + 1, j + 1);
      idx.push(i0, i1, o0, i1, o1, o0);
    }
    const g = spara(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    if (hojd) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  // Sten (platt, kantig) och snödriva (mjuk kulle), båda med inbakad skuggning.
  function blobGeo(detalj, amp, fro, sten = false) {
    const g = spara(new THREE.IcosahedronGeometry(1, detalj));
    const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const b1 = brus3(v.x * 1.8 + fro, v.y * 1.8, v.z * 1.8) * 2 - 1, b2 = brus3(v.x * 4.1, v.y * 4.1 + fro, v.z * 4.1) * 2 - 1;
      const d = 1 + amp * (b1 * 0.75 + b2 * 0.35);
      let y = v.y * d;
      // stenen: rundad kupa med plattare undersida (vilar i marken, ingen spets nedåt)
      if (sten) y = y < 0 ? y * 0.38 : y * 0.74; else if (y < -0.3) y = -0.3 + (y + 0.3) * 0.45;
      p.setXYZ(i, v.x * d, y, v.z * d);
      if (!sten) { const ny = v.y + 0.2, l = Math.hypot(v.x, ny, v.z); n.setXYZ(i, v.x / l, ny / l, v.z / l); }
      const h = (v.y + 1) / 2;
      if (sten) { const s = 0.72 + 0.28 * h; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s; continue; }
      // drivan: ljus ovansida, blåaktig skugga runt basen där den möter marken
      const s = 0.84 + 0.16 * h, bla = 1 - mjuk(-0.45, 0.3, v.y);
      c[i * 3] = s * (1 - 0.2 * bla); c[i * 3 + 1] = s * (1 - 0.13 * bla); c[i * 3 + 2] = s * (1 - 0.02 * bla);
    }
    if (sten) {
      // mjuka normaler: ytnormalerna medelvärdesbildas över hörn som delar läge (ikosaedern är
      // inte indexerad, så computeVertexNormals ensam gav kantiga facetter)
      g.computeVertexNormals();
      const acc = new Map(), nk = i => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
      for (let i = 0; i < p.count; i++) { const k = nk(i), a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
      for (let i = 0; i < p.count; i++) { const a = norm(acc.get(nk(i))); n.setXYZ(i, a[0], a[1], a[2]); }
      n.needsUpdate = true;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.computeBoundingSphere();
    return g;
  }

  const GEO = {};
  const geo = namn => GEO[namn] || (GEO[namn] = ({
    sten: () => blobGeo(2, 0.28, 5.3, true),        // 320, rundat block med mjuka normaler
    sten1: () => blobGeo(2, 0.36, 11.7, true),      // knölig, avlång
    sten2: () => blobGeo(2, 0.2, 23.1, true),       // slät, rundnött
    driva: () => blobGeo(1, 0.16, 2.2),             // 80 (trianglar: skog/vinter under 200k)
    // gångsten: avrundad rektangel med mjukt fasad överkant, normaliserad till 1 × 1 × 1 (skalas per platta)
    platta: () => {
      const sh = new THREE.Shape(), h = 0.5, k = 0.17;
      sh.moveTo(-h + k, -h); sh.lineTo(h - k, -h); sh.quadraticCurveTo(h, -h, h, -h + k); sh.lineTo(h, h - k); sh.quadraticCurveTo(h, h, h - k, h);
      sh.lineTo(-h + k, h); sh.quadraticCurveTo(-h, h, -h, h - k); sh.lineTo(-h, -h + k); sh.quadraticCurveTo(-h, -h, -h + k, -h);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.035, bevelSegments: 2, curveSegments: 3 });
      g.rotateX(-Math.PI / 2); g.computeBoundingBox();
      const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
      g.translate(-c.x, -c.y, -c.z); g.scale(1 / sz.x, 1 / sz.y, 1 / sz.z); g.computeVertexNormals();
      return spara(g);
    },
    flack: () => { const g = spara(new THREE.PlaneGeometry(1, 1)); g.rotateX(-Math.PI / 2); return g; },               // 2
  })[namn]());

  // ---- vegetation: lokala delar (en art och variant) ----
  // En del = hörnlistor: position, normal, uv, färg, fladder (m), snö (0..1, för barken: glöd).
  const del = () => ({ P: [], N: [], U: [], F: [], W: [], S: [], I: [] });
  function hp(D, x, y, z, nx, ny, nz, u, v, f, w = 0, s = 0) {
    D.P.push(x, y, z); D.N.push(nx, ny, nz); D.U.push(u, v); D.F.push(f[0], f[1], f[2]); D.W.push(w); D.S.push(s);
    return D.P.length / 3 - 1;
  }
  // barkremsor i atlasen (u)
  const UB = [0.012, 0.32], UT = [0.346, 0.654], UG = [0.68, 0.988];
  // rör längs en polylinje [[x, y, z, radie], ...] med parallellförflyttade ringar
  function ror(D, pts, sid, uv, vLang, farg, s = 0) {
    const bas = D.P.length / 3; let len = 0, b1 = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      const t = norm([q[0] - o[0], q[1] - o[1], q[2] - o[2]]);
      if (!b1) b1 = perp(t); else { const d = dot(b1, t); b1 = norm([b1[0] - t[0] * d, b1[1] - t[1] * d, b1[2] - t[2] * d]); }
      const b2 = cross(t, b1);
      if (i) len += Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
      const f = farg(p[1], i / (pts.length - 1));
      for (let j = 0; j <= sid; j++) {
        const a = j / sid * 6.283, ca = Math.cos(a), sa = Math.sin(a);
        const nx = b1[0] * ca + b2[0] * sa, ny = b1[1] * ca + b2[1] * sa, nz = b1[2] * ca + b2[2] * sa;
        hp(D, p[0] + nx * p[3], p[1] + ny * p[3], p[2] + nz * p[3], nx, ny, nz, uv[0] + (uv[1] - uv[0]) * j / sid, len / vLang, f, 0, s);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < sid; j++) {
      const a = bas + i * (sid + 1) + j, b = a + 1, c = a + sid + 1, d = c + 1;
      D.I.push(a, b, c, b, d, c);
    }
  }
  // kort (remsa): rader [{ p, h (halv bredd-vektor), v, f, w, s }], k = atlasruta, n = normal eller n(p)
  function kort(D, rader, k, n) {
    const col = k % 2, row = k >> 1, m = 0.007, U = u => col * 0.5 + m + u * (0.5 - 2 * m), V = v => row * 0.5 + m + v * (0.5 - 2 * m);
    const bas = D.P.length / 3;
    for (const R of rader) {
      const nn = typeof n === 'function' ? n(R.p) : n;
      for (const u of [0, 1]) {
        const sg = u ? 1 : -1;
        hp(D, R.p[0] + sg * R.h[0], R.p[1] + sg * R.h[1], R.p[2] + sg * R.h[2], nn[0], nn[1], nn[2], U(u), V(R.v), R.f, R.w || 0, R.s || 0);
      }
    }
    const P = D.P, N = D.N;
    for (let i = 0; i < rader.length - 1; i++) {
      const a = bas + i * 2, b = a + 1, c = a + 2, d = a + 3;
      const e1 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
      const e2 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
      if (dot(cross(e1, e2), [N[a * 3], N[a * 3 + 1], N[a * 3 + 2]]) >= 0) D.I.push(a, c, b, b, c, d); else D.I.push(a, b, c, b, d, c);
    }
  }
  // lövkluster: ett kort vinkelrätt mot n0 (vridet slumpvis), ibland ett korsat kort till
  function kluster(D, r, p, st, n0, kors, cell, fc, nf, sno = 0, w = 0.03) {
    const a = perp(n0), b = cross(n0, a), v = r() * 6.283, ca = Math.cos(v), sa = Math.sin(v);
    const ax = [a[0] * ca + b[0] * sa, a[1] * ca + b[1] * sa, a[2] * ca + b[2] * sa], bx = cross(n0, ax);
    const fb = [fc[0] * 0.78, fc[1] * 0.8, fc[2] * 0.78];   // kortets bas mörkare (djup i kronan)
    const plan = (u, q, s) => kort(D, [-0.5, 0.5].map(t => ({ p: [p[0] + q[0] * st * t, p[1] + q[1] * st * t, p[2] + q[2] * st * t], h: [u[0] * st / 2, u[1] * st / 2, u[2] * st / 2], v: t + 0.5, f: t < 0 ? fb : fc, w, s })), cell, nf);
    plan(ax, bx, sno);
    if (r() < kors) plan(n0, bx, sno * 0.35);
  }

  // Lövträd: 'lov' (lönn/ek), 'frukt' (äppelträd), 'mellan' (enklare), 'fjarr' (bara krona).
  // Stam som delar sig i grovgrenar och kvistar, lövkluster vid kvistarna, några inne i kronan.
  function lovVar(fro, typ) {
    const r = slump(fro), B = del(), Lv = del();
    const frukt = typ === 'frukt', fj = typ === 'fjarr', enkel = typ === 'mellan' || fj;
    const H = frukt ? 5 : 10, gaffel = H * (frukt ? 0.3 : 0.36), rs = frukt ? 0.12 : 0.27;
    const cc = [0, gaffel + (H - gaffel) * 0.5, 0], cR = frukt ? 2.3 : 3.6, cY = (H - gaffel) * 0.55;
    const nKr = p => norm([(p[0] - cc[0]) / cR * 0.8, (p[1] - cc[1]) / cY * 0.8 + 0.3, (p[2] - cc[2]) / cR * 0.8]);
    const ljus = p => 0.42 + 0.52 * Math.min(1.1, Math.hypot((p[0] - cc[0]) / cR, (p[1] - cc[1]) / cY, (p[2] - cc[2]) / cR)) + 0.1 * mjuk(cc[1], H, p[1]);
    // fler och mindre lövkluster (stora kort lästes som klumpar i kronan)
    const st0 = frukt ? 1.0 : enkel ? (fj ? 3.4 : 2.4) : 1.3;
    const klunga = (p, mork = 1) => {
      const n0 = norm([(p[0] - cc[0]) / cR + (r() - 0.5) * 0.9, (p[1] - cc[1]) / cY * 0.7 + 0.35 + (r() - 0.5) * 0.6, (p[2] - cc[2]) / cR + (r() - 0.5) * 0.9]);
      const f = ljus(p) * (0.88 + r() * 0.24) * mork;
      kluster(Lv, r, p, st0 * (0.8 + r() * 0.4), n0, enkel ? 1 : 0.5, 1, [f, f, f], nKr, 0, 0.03);
    };
    const spetsar = [];
    if (!fj) {
      const kx = (r() - 0.5) * 0.3, kz = (r() - 0.5) * 0.3;
      // rotbas: stammen vidgas mjukt mot marken (stod som en rak påle) och är mörkare, lite grönare nertill
      const rotbas = t => 1 + 0.85 * Math.pow(1 - Math.min(1, t / 0.22), 2.2);
      ror(B, [0, 0.06, 0.2, 0.45, 0.72, 1].map(t => [kx * Math.sin(t * 3), gaffel * 1.12 * t - (t ? 0 : 0.1), kz * Math.sin(t * 3), rs * (1 - 0.35 * t) * rotbas(t)]), frukt ? 6 : 7, UG, 1.3,
        y => { const k = mjuk(0, gaffel * 0.3, y); return [0.62 + 0.38 * k, 0.68 + 0.32 * k, 0.58 + 0.42 * k]; });
      const nL = (frukt ? 4 : 5) + (r() * 2 | 0);
      for (let k = 0; k < nL; k++) {
        const az = k / nL * 6.283 + r() * 0.8, el = (frukt ? 28 + r() * 18 : 42 + r() * 20) * Math.PI / 180, Lb = (frukt ? 2.1 : 3.7) * (0.75 + 0.4 * r());
        const s0 = [kx, gaffel * (0.85 + 0.3 * r()), kz], dir = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)], sank = (frukt ? 0.3 : 0.15) * Lb;
        const lp = t => [s0[0] + dir[0] * Lb * t, s0[1] + dir[1] * Lb * t - sank * t * t, s0[2] + dir[2] * Lb * t];
        ror(B, [0, 0.33, 0.66, 1].map(t => [...lp(t), rs * 0.55 * (1 - 0.8 * t)]), enkel ? 4 : 5, UG, 1.3, () => ETT);
        spetsar.push(lp(1), lp(0.65));
        const nS = enkel ? 2 : 4;
        for (let j = 0; j < nS; j++) {
          const p0 = lp(0.35 + j * 0.6 / nS + r() * 0.08), a2 = az + (r() - 0.5) * 2, e2 = el * 0.6 + (r() - 0.3) * 0.7, L2 = Lb * (0.4 + 0.25 * r());
          const d2 = [Math.cos(a2) * Math.cos(e2), Math.sin(e2), Math.sin(a2) * Math.cos(e2)];
          const sp = t => [p0[0] + d2[0] * L2 * t, p0[1] + d2[1] * L2 * t - L2 * 0.12 * t * t, p0[2] + d2[2] * L2 * t];
          ror(B, [0, 0.5, 1].map(t => [...sp(t), rs * 0.2 * (1 - 0.8 * t)]), 3, UG, 1.3, () => ETT);
          spetsar.push(sp(1), sp(0.55));
        }
      }
      spetsar.forEach(p => {
        klunga(p);
        const extra = enkel ? 0 : 3 + (r() * 2 | 0), sp = frukt ? 0.9 : 1.6;
        for (let e = 0; e < extra; e++) klunga([p[0] + (r() - 0.5) * sp, p[1] + (r() - 0.35) * sp * 0.75, p[2] + (r() - 0.5) * sp]);
      });
      // inre kluster: mörkare (skugga inne i kronan)
      for (let i = 0; i < (enkel ? 4 : 22); i++) { const a = r() * 6.283, d = r() * 0.65; klunga([cc[0] + Math.cos(a) * cR * d, cc[1] + (r() - 0.5) * cY, cc[2] + Math.sin(a) * cR * d], 0.62); }
    } else {
      ror(B, [[0, -0.1, 0, rs], [0, gaffel * 1.6, 0, rs * 0.5]], 4, UG, 1.3, () => ETT);
      for (let i = 0; i < 12; i++) {
        const a = r() * 6.283, e = (r() * 1.4 - 0.35), d = 0.7 + 0.3 * r();
        klunga([cc[0] + Math.cos(a) * Math.cos(e) * cR * d, cc[1] + Math.sin(e) * cY * d, cc[2] + Math.sin(a) * Math.cos(e) * cR * d]);
      }
    }
    return { bark: B, lov: Lv, H };
  }

  // Buske: några korta stjälkar och ett tätt skal av lövkort. Höjd ~1,1 m.
  function buskVar(fro) {
    const r = slump(fro), B = del(), Lv = del(), H = 1.1;
    for (let i = 0; i < 4; i++) { const a = r() * 6.283; ror(B, [[0, -0.05, 0, 0.03], [Math.cos(a) * 0.25, 0.4, Math.sin(a) * 0.25, 0.02], [Math.cos(a) * 0.45, 0.75, Math.sin(a) * 0.45, 0.01]], 3, UG, 1, () => ETT); }
    const nf = p => norm([p[0], p[1] - 0.2, p[2]]);
    // oregelbunden siluett: två–tre utskjutande partier och en sida som är lägre (ingen slät halvkula)
    const f1 = r() * 6.283, f2 = r() * 6.283;
    for (let i = 0; i < 32; i++) {
      const a = r() * 6.283, e = r() * 1.3, inne = i > 26;
      const d = (0.75 + 0.25 * r()) * (0.8 + 0.26 * Math.sin(a * 2 + f1) + 0.12 * Math.sin(a * 3 + f2)), dh = 0.86 + 0.2 * Math.sin(a + f2);
      const p = [Math.cos(a) * Math.cos(e) * 0.8 * (inne ? 0.4 : d), 0.15 + Math.sin(e) * 0.85 * (inne ? 0.5 : d * dh), Math.sin(a) * Math.cos(e) * 0.8 * (inne ? 0.4 : d)];
      const f = (0.5 + 0.47 * (p[1] / H)) * (inne ? 0.62 : 1) * (0.84 + r() * 0.3);
      kluster(Lv, r, p, 0.62 + r() * 0.3, norm([p[0] + (r() - 0.5) * 0.6, p[1] + 0.3, p[2] + (r() - 0.5) * 0.6]), 0.3, 1, [f, f, f], nf, 0, 0.02);
    }
    return { bark: B, lov: Lv, H };
  }

  // Markväxter (höjd 1, skalas): grästuva / blommor (3 korsade kort), ormbunke (7 bågade blad),
  // blåbärsris (4 kort). s = snö vid basen (vinterns torra strån står i snö).
  function tuvaVar(fro, k) {
    const r = slump(fro), D = del();
    for (let i = 0; i < 3; i++) {
      const a = i * 1.047 + r() * 0.5, b = 0.36 + r() * 0.1, h = 0.85 + r() * 0.3, la = r() * 6.283, lut = 0.06 + r() * 0.1;
      const ox = (r() - 0.5) * 0.08, oz = (r() - 0.5) * 0.08, tn = 0.9 + r() * 0.2, hh = [Math.cos(a) * b, 0, Math.sin(a) * b];
      kort(D, [
        { p: [ox, -0.12, oz], h: hh, v: 1, f: [0.38 * tn, 0.38 * tn, 0.38 * tn], w: 0, s: 0 },
        { p: [ox + Math.cos(la) * lut, h, oz + Math.sin(la) * lut], h: hh, v: 0, f: [1.05 * tn, 1.05 * tn, 1.05 * tn], w: 0.02, s: 0 },
      ], k, [0, 1, 0]);
    }
    return { bark: del(), lov: D, H: 1 };
  }
  function mattaVar(fro) {
    const r = slump(fro), D = del();
    for (let i = 0; i < 2; i++) {
      const a = i * 1.571 + r() * 0.6, b = 0.5 + r() * 0.12, hh = [Math.cos(a) * b, 0, Math.sin(a) * b], la = r() * 6.283;
      kort(D, [
        { p: [0, -0.15, 0], h: hh, v: 1, f: [0.72, 0.72, 0.72], w: 0 },
        { p: [Math.cos(la) * 0.1, 1, Math.sin(la) * 0.1], h: hh, v: 0, f: [0.96, 0.96, 0.96], w: 0.01 },
      ], 0, [0, 1, 0]);
    }
    return { bark: del(), lov: D, H: 1 };
  }
  function ormbunkeVar(fro) {
    const r = slump(fro), D = del();
    for (let i = 0; i < 7; i++) {
      const az = i / 7 * 6.283 + r() * 0.5, len = 0.85 + r() * 0.2, ut = [Math.cos(az), 0, Math.sin(az)], sd = [-Math.sin(az), 0, Math.cos(az)], roll = (r() - 0.5) * 0.5;
      const hh = [sd[0] * 0.17 * len * Math.cos(roll), 0.17 * len * Math.sin(roll), sd[2] * 0.17 * len * Math.cos(roll)], tn = 0.9 + r() * 0.2;
      const fk = t => (0.36 + 0.5 * t) * tn;
      kort(D, [0, 0.5, 1].map(t => ({ p: [ut[0] * len * (t * 0.85 - 0.06), -0.09 + len * (1.1 * t - 0.85 * t * t), ut[2] * len * (t * 0.85 - 0.06)], h: hh, v: 1 - t, f: [fk(t), fk(t) * 1.02, fk(t) * 0.96], w: 0.04 * t })), 2, norm([ut[0] * 0.75, 1, ut[2] * 0.75]));
    }
    return { bark: del(), lov: D, H: 1 };
  }
  function blabarVar(fro) {
    const r = slump(fro), D = del();
    for (let i = 0; i < 4; i++) {
      const a = i * 0.785 + r() * 0.4, b = 0.32 + r() * 0.08, luta = i > 1 ? 0.35 : 0, hh = [Math.cos(a) * b, 0, Math.sin(a) * b];
      kort(D, [
        { p: [0, -0.08, 0], h: hh, v: 1, f: [0.4, 0.4, 0.4], s: 0.8 },
        { p: [-Math.sin(a) * luta, 0.5, Math.cos(a) * luta], h: hh, v: 0, f: [1, 1, 1], w: 0.015 },
      ], 3, [0, 1, 0]);
    }
    return { bark: del(), lov: D, H: 1 };
  }

  const VAR = {};
  const GENV = {
    lov: i => lovVar(21 + i * 37, 'lov'), frukt: i => lovVar(25 + i * 41, 'frukt'),
    mellan: i => lovVar(29 + i * 43, 'mellan'), fjarr: i => lovVar(33 + i * 47, 'fjarr'),
    buske: i => buskVar(71 + i * 5),
    gras: i => tuvaVar(81 + i * 3, 0), matta: i => mattaVar(87 + i * 5), blomma: i => tuvaVar(85 + i * 3, 1), ormbunke: i => ormbunkeVar(91 + i * 3), blabar: i => blabarVar(95 + i * 3),
  };
  const variant = (typ, i) => VAR[typ + i] || (VAR[typ + i] = GENV[typ](i));
  // vindstyvhet: stamböjning i meter = VK · höjd · (y/höjd)²
  const VK = { lov: 0.01, frukt: 0.014, mellan: 0.01, fjarr: 0.008, buske: 0.035, gras: 0.2, matta: 0.3, blomma: 0.22, ormbunke: 0.12, blabar: 0.08 };
  const LOVTON = { lov: [0.86, 0.94, 0.82], frukt: [0.9, 0.96, 0.8], mellan: [0.84, 0.92, 0.8], fjarr: [0.8, 0.88, 0.78], buske: [0.72, 0.84, 0.68] };
  const BARKTON = { lov: [0.62, 0.56, 0.5], frukt: [0.64, 0.55, 0.47], mellan: [0.62, 0.56, 0.5], fjarr: [0.62, 0.56, 0.5], buske: [0.6, 0.55, 0.42] };
  const ton = (r, b, sp = 0.07) => { const k = 1 - sp + r() * sp * 2; return [b[0] * k * (1 + (r() - 0.5) * 0.04), b[1] * k, b[2] * k * (1 + (r() - 0.5) * 0.05)]; };

  // ---- sammanslagna världsgeometrier (ett ritanrop per material) ----
  const samling = () => ({ P: [], N: [], U: [], F: [], V: [], S: [], I: [] });
  // ford: lampans tändfördröjning, läggs på glödande delar (aSno ≥ 1)
  function lagg(Sm, D, x, y, z, s, ry, H, vk, tint = ETT, ford = 0) {
    const c = Math.cos(ry), sn = Math.sin(ry), bas = Sm.P.length / 3, n = D.P.length / 3;
    for (let i = 0; i < n; i++) {
      const lx = D.P[i * 3], ly = D.P[i * 3 + 1], lz = D.P[i * 3 + 2], nx = D.N[i * 3], nz = D.N[i * 3 + 2];
      Sm.P.push(x + (c * lx + sn * lz) * s, y + ly * s, z + (-sn * lx + c * lz) * s);
      Sm.N.push(c * nx + sn * nz, D.N[i * 3 + 1], -sn * nx + c * nz);
      Sm.U.push(D.U[i * 2], D.U[i * 2 + 1]);
      Sm.F.push(D.F[i * 3] * tint[0], D.F[i * 3 + 1] * tint[1], D.F[i * 3 + 2] * tint[2]);
      const hy = Math.max(0, ly / H);
      Sm.V.push(x, z, vk * H * s * hy * hy, D.W[i] * s);
      Sm.S.push(ford && D.S[i] > 0.5 ? D.S[i] + ford : D.S[i]);
    }
    for (const k of D.I) Sm.I.push(bas + k);
  }
  function slaIhop(A, B) {
    const bas = A.P.length / 3;
    ['P', 'N', 'U', 'F', 'V', 'S'].forEach(k => { for (const v of B[k]) A[k].push(v); });
    for (const k of B.I) A.I.push(bas + k);
    return A;
  }
  // fjärrsetets samlingar packas en gång till typade arrayer; nära setet läggs till vid varje hus
  const packa = Sm => ({ P: new Float32Array(Sm.P), N: new Float32Array(Sm.N), U: new Float32Array(Sm.U), F: new Float32Array(Sm.F), V: new Float32Array(Sm.V), S: new Float32Array(Sm.S), I: new Uint32Array(Sm.I) });
  // ett ritanrop per material: delarna (packade eller inte) kopieras efter varandra i samma buffertar
  function vegMesh(namn, delar, material, kast, tar) {
    const L = (Array.isArray(delar) ? delar : [delar]).filter(d => d && d.I.length);
    if (!L.length) return null;
    let nv = 0, ni = 0;
    L.forEach(d => { nv += d.P.length / 3; ni += d.I.length; });
    const A = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), U: new Float32Array(nv * 2), F: new Float32Array(nv * 3), V: new Float32Array(nv * 4), S: new Float32Array(nv) };
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), K = { P: 3, N: 3, U: 2, F: 3, V: 4, S: 1 };
    let ov = 0, oi = 0;
    for (const d of L) {
      for (const k in K) A[k].set(d[k], ov * K[k]);
      for (let j = 0; j < d.I.length; j++) I[oi + j] = d.I[j] + ov;
      ov += d.P.length / 3; oi += d.I.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A.P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(A.N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(A.U, 2));
    g.setAttribute('color', new THREE.BufferAttribute(A.F, 3));
    g.setAttribute('aVind', new THREE.BufferAttribute(A.V, 4));
    g.setAttribute('aSno', new THREE.BufferAttribute(A.S, 1));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.name = namn; m.castShadow = kast; m.receiveShadow = tar; m.matrixAutoUpdate = false; m.userData.egen = true;
    if (material.userData.djup) m.customDepthMaterial = material.userData.djup;
    return m;
  }

  // ---- material (delas mellan miljöerna) ----
  const MAT = {};
  const djup = map => spara(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide }));
  const mat = namn => MAT[namn] || (MAT[namn] = spara(({
    bark: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('bark'), vertexColors: true }), { glod: true, nara: true }),
    lov: () => {
      const m = vegPatch(new THREE.MeshLambertMaterial({ map: tx('lovAtlas'), vertexColors: true, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide }), { sss: true, sno: true, mip: true, upp: true, nara: 'lag' });
      m.userData.djup = djup(tx('lovAtlas')); return m;
    },
    vaxt: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('markAtlas'), vertexColors: true, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide }), { sss: false, sno: true, fade: true, mip: false, upp: true, snoBak: 1 }),
    matta: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('markAtlas'), vertexColors: true, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide }), { fade: true, fadeAv: [14, 32], upp: true }),
    driva: () => patcha(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: C('#141c2c') }), { glitter: true }),
    tramp: () => patcha(new THREE.MeshLambertMaterial({ map: tx('tramp'), transparent: true, depthWrite: false, emissive: C('#0e1524'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
    sten: () => patcha(new THREE.MeshLambertMaterial({ map: tx('sten'), vertexColors: true }), { sten: true }),
    platta: () => patcha(new THREE.MeshLambertMaterial({ map: tx('sten') })),
    flack: () => new THREE.MeshBasicMaterial({ map: tx('flack'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    grus: () => tvaSkalor(new THREE.MeshLambertMaterial({ map: tx('grus'), vertexColors: true, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    ao: () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  })[namn]()));

  // ---- liv: fallande snö, löv och barr (Points, all rörelse och omslagning i skuggaren) ----
  function fallande(typ) {
    const P = {
      sno: { n: 2600, lada: [34, 20, 34], ror: [0.75, 0.03, 0.45, 1], storlek: 0.06, max: 6,   // färre, mindre flingor: de lästes som salt över trädkronorna
      sprite: 'flinga', vand: false },
      lov: { n: 150, lada: [44, 10, 44], ror: [0.55, 0.25, 0.9, 0], storlek: 0.22, max: 14, sprite: 'lovSprite', vand: true },
      barr: { n: 420, lada: [40, 14, 40], ror: [0.35, 0.05, 0.4, 0], storlek: 0.11, max: 8, sprite: 'barrSprite', vand: true },
    }[typ];
    const r = slump(typ.length * 977), pos = new Float32Array(P.n * 3), fas = new Float32Array(P.n * 2), col = new Float32Array(P.n * 3);
    const pal = typ === 'lov' ? [[0.82, 0.62, 0.18], [0.7, 0.42, 0.14], [0.6, 0.66, 0.24], [0.86, 0.74, 0.3]] : typ === 'barr' ? [[0.55, 0.4, 0.24], [0.62, 0.48, 0.28], [0.42, 0.36, 0.22]] : [[1, 1, 1]];
    for (let i = 0; i < P.n; i++) {
      pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r(); fas[i * 2] = r(); fas[i * 2 + 1] = r();
      const c = pal[r() * pal.length | 0]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aFas', new THREE.BufferAttribute(fas, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const snoig = typ === 'sno';
    const m = MAT['fall-' + typ] || (MAT['fall-' + typ] = spara(new THREE.PointsMaterial({
      size: P.storlek, map: tx(P.sprite), vertexColors: true, transparent: snoig, depthWrite: !snoig, alphaTest: snoig ? 0.01 : 0.5, sizeAttenuation: true,
    })));
    const lada = new THREE.Vector3(...P.lada), ror4 = new THREE.Vector4(...P.ror);
    m.onBeforeCompile = s => {
      s.uniforms.uTid = VU.uTid; s.uniforms.uLada = { value: lada }; s.uniforms.uRor = { value: ror4 }; s.uniforms.uHus = VU.uHus; s.uniforms.uInne = VU.uInne;
      s.vertexShader = 'uniform float uTid;\nuniform vec3 uLada;\nuniform vec4 uRor;\nuniform vec4 uHus;\nuniform float uInne;\nattribute vec2 aFas;\nvarying float vVinkel;\n' + s.vertexShader
        .replace('#include <begin_vertex>', `
          vec3 transformed = position * uLada;
          float t = uTid;
          transformed.y -= t * uRor.x * ( 0.7 + 0.6 * aFas.x );
          transformed.x += t * uRor.y + sin( t * ( 0.4 + 0.5 * aFas.y ) + aFas.x * 6.283 ) * uRor.z;
          transformed.z += cos( t * ( 0.3 + 0.4 * aFas.x ) + aFas.y * 6.283 ) * uRor.z;
          ${typ === 'sno' ? `{
            // vindbyar: förflyttningen är integralen av farten 0,11·(1 − cos ωt)³, så snön ibland
            // driver snett i en by (topp ~0,9 m/s) och däremellan faller nästan rakt; aldrig bakåt
            float w = 0.273, tb = t + aFas.x * 1.2;
            float sb = sin( w * tb );
            float G = 2.5 * tb - ( 4.0 * sb - 0.75 * sin( 2.0 * w * tb ) - sb * sb * sb / 3.0 ) / w;
            transformed.xz += vec2( 0.94, 0.33 ) * G * 0.11 * ( 0.8 + 0.4 * aFas.y );
          }` : ''}
          vec3 fram = -vec3( viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2] );
          vec2 fh = normalize( fram.xz + vec2( 1e-4 ) );
          vec2 mitt = mix( vec2( 0.0 ), cameraPosition.xz + fh * uLada.x * 0.35, uRor.w );
          vec3 lo = vec3( mitt.x - uLada.x * 0.5, -0.3, mitt.y - uLada.z * 0.5 );
          transformed = lo + mod( transformed - lo, uLada );
          // aldrig inne i huset: lådan runt huset (med takfot) töms; är kameran inne hålls
          // partiklarna dessutom minst 1 m utanför väggarna
          bool kamInne = uInne > 0.5 || ( abs( cameraPosition.x ) < uHus.x && abs( cameraPosition.z ) < uHus.y && cameraPosition.y < uHus.z );
          float mg = kamInne ? 1.1 : 0.6;
          bool dold = abs( transformed.x ) < uHus.x + mg && abs( transformed.z ) < uHus.y + mg && transformed.y < uHus.z + ( kamInne ? 1.0 : 0.0 );
          vVinkel = t * ( 0.6 + 1.6 * aFas.x ) + aFas.y * 6.283;`)
        .replace('gl_PointSize = size;', 'gl_PointSize = size * ( 0.6 + 0.8 * aFas.y );')
        .replace('#include <fog_vertex>', `gl_PointSize = min( gl_PointSize, ${P.max.toFixed(1)} );\nif ( dold ) { gl_Position = vec4( 0.0, 0.0, -2.0, 1.0 ); gl_PointSize = 0.0; }\n#include <fog_vertex>`);
      s.fragmentShader = 'varying float vVinkel;\n' + s.fragmentShader.replace('#include <map_particle_fragment>', `
        #ifdef USE_MAP
          vec2 pc = gl_PointCoord - 0.5;
          ${P.vand ? 'float ca = cos( vVinkel ), sa = sin( vVinkel ); pc = mat2( ca, sa, -sa, ca ) * pc; pc.x /= max( 0.2, abs( cos( vVinkel * 0.73 ) ) );' : ''}
          diffuseColor *= texture2D( map, clamp( pc + 0.5, 0.0, 1.0 ) );
        #endif`);
    };
    m.customProgramCacheKey = () => 'miljo-fall-' + typ;
    const o = new THREE.Points(g, m);
    o.name = 'fall-' + typ; o.frustumCulled = false; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }

  // ---- liv: fåglar i lata slingor långt bort (instansade V, vingslag i skuggaren) ----
  function faglar(r, n) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, 0, 0, -0.12, -0.22, 0, 0, -0.5, 0, -0.08, 0.22, 0, 0, 0.5, 0, -0.08], 3));
    g.setAttribute('aVinge', new THREE.Float32BufferAttribute([0, 0, 1, 2, 1, 2], 1));
    g.setIndex([0, 2, 1, 2, 3, 1, 0, 1, 4, 4, 1, 5]);
    const bana = new Float32Array(n * 4), fas = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const grupp = i % 3, a = (-60 - grupp * 70 + (r() - 0.5) * 30) * Math.PI / 180, d = 45 + grupp * 12 + r() * 6;
      bana.set([Math.cos(a) * d + (r() - 0.5) * 4, Math.sin(a) * d + (r() - 0.5) * 4, 9 + r() * 9, 13 + grupp * 4 + r() * 3], i * 4);
      fas.set([r() * 6.283, (r() > 0.3 ? 1 : -1) * (0.05 + r() * 0.04), 5 + r() * 3], i * 3);
    }
    g.setAttribute('aBana', new THREE.InstancedBufferAttribute(bana, 4));
    g.setAttribute('aFas', new THREE.InstancedBufferAttribute(fas, 3));
    g.instanceCount = n;
    const m = MAT.faglar || (MAT.faglar = spara(new THREE.MeshBasicMaterial({ color: C('#2b2e33'), side: THREE.DoubleSide })));
    m.onBeforeCompile = s => {
      s.uniforms.uTid = VU.uTid;
      s.vertexShader = 'uniform float uTid;\nattribute vec4 aBana;\nattribute vec3 aFas;\nattribute float aVinge;\n' + s.vertexShader.replace('#include <begin_vertex>', `
        float a = aFas.x + uTid * aFas.y;
        vec3 c = vec3( aBana.x + cos( a ) * aBana.z, aBana.w + sin( a * 2.0 + aFas.x ) * 1.2, aBana.y + sin( a ) * aBana.z );
        vec3 fr = normalize( vec3( -sin( a ), 0.0, cos( a ) ) * sign( aFas.y ) );
        vec3 hg = vec3( fr.z, 0.0, -fr.x );
        float amp = 0.3 + 0.7 * smoothstep( -0.2, 0.6, sin( uTid * 0.5 + aFas.x * 3.0 ) );
        vec3 lp = position;
        if ( aVinge > 0.5 ) lp.y += sin( uTid * aFas.z + aFas.x * 7.0 - ( aVinge - 1.0 ) * 0.7 ) * ( aVinge > 1.5 ? 0.3 : 0.12 ) * amp;
        vec3 transformed = c + ( hg * lp.x + vec3( 0.0, lp.y, 0.0 ) + fr * lp.z ) * 0.75;`);
    };
    m.customProgramCacheKey = () => 'miljo-faglar';
    const o = new THREE.Mesh(g, m);
    o.name = 'faglar'; o.frustumCulled = false; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }

  // ---- liv: dimslöjor (vända mot kameran, driver långsamt) ----
  function dimslojor(r, krav) {
    const P = [], U = [], M = [], I = [];
    for (let f = 0, n = 0; f < 400 && n < 9; f++) {
      const a = r() * 6.283, d = 16 + r() * 26, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!krav(x, z, 'stor')) continue;
      const w = 7 + r() * 5, h = 1.8 + r() * 1.2, y = 1 + r() * 1.2, b = P.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { P.push((u - 0.5) * w * 2, (v - 0.5) * h * 2, 0); U.push(u, v); M.push(x, y, z); }
      I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute('aMitt', new THREE.Float32BufferAttribute(M, 3));
    g.setIndex(I);
    const m = MAT.dimma || (MAT.dimma = spara(new THREE.MeshBasicMaterial({ map: tx('flack'), color: C('#e4ebe6'), transparent: true, opacity: 0.3, depthWrite: false })));
    m.onBeforeCompile = s => {
      s.uniforms.uTid = VU.uTid;
      s.vertexShader = 'uniform float uTid;\nattribute vec3 aMitt;\n' + s.vertexShader.replace('#include <project_vertex>', `
        vec3 mp = aMitt + vec3( sin( uTid * 0.035 + aMitt.z * 0.13 ) * 3.5, sin( uTid * 0.05 + aMitt.x ) * 0.3, cos( uTid * 0.028 + aMitt.x * 0.11 ) * 2.5 );
        vec4 mvPosition = modelViewMatrix * vec4( mp, 1.0 );
        mvPosition.xy += position.xy;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    m.customProgramCacheKey = () => 'miljo-dimma';
    const o = new THREE.Mesh(g, m);
    o.name = 'dimma'; o.frustumCulled = false; o.renderOrder = 3; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }

  // ---- kväll: glöd runt lampor, ljuspooler på marken och varm dimma (ett additivt ritanrop) ----
  // poster: [x, y, z, bredd, typ (0 = mot kameran, 1 = på marken, 2 = dimslöja), r, g, b, fördröjning, höjd]
  // Varje post tänds när uLampa passerat dess fördröjning (lamporna tänds en i taget från dörren och utåt).
  function glodMesh(poster) {
    if (!poster.length) return null;
    const P = [], U = [], M = [], F = [], L = [], T = [], I = [];
    poster.forEach(([x, y, z, s, pl, cr, cg, cb, ford = 0, h = s]) => {
      const b = P.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { P.push((u - 0.5) * s, (v - 0.5) * h, 0); U.push(u, v); M.push(x, y, z); F.push(cr, cg, cb); L.push(pl); T.push(ford); }
      I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute('aMitt', new THREE.Float32BufferAttribute(M, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(F, 3));
    g.setAttribute('aPlatt', new THREE.Float32BufferAttribute(L, 1));
    g.setAttribute('aFord', new THREE.Float32BufferAttribute(T, 1));
    g.setIndex(I);
    const m = MAT.glod || (MAT.glod = spara(new THREE.MeshBasicMaterial({ map: tx('flack'), vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, side: THREE.DoubleSide })));
    m.onBeforeCompile = s => {
      s.uniforms.uLampa = VU.uLampa; s.uniforms.uTid = VU.uTid; s.uniforms.uPool = VU.uPool;
      s.vertexShader = 'uniform float uLampa;\nuniform float uTid;\nuniform float uPool;\nattribute vec3 aMitt;\nattribute float aPlatt;\nattribute float aFord;\nvarying float vPl;\nvarying float vTand;\nvarying float vFas;\n' + s.vertexShader.replace('#include <project_vertex>', `
        vPl = aPlatt; vTand = smoothstep( aFord, aFord + 0.4, uLampa ); vFas = aMitt.x * 0.7 + aMitt.z * 1.3;
        vec4 mvPosition;
        if ( aPlatt > 0.5 && aPlatt < 1.5 ) mvPosition = modelViewMatrix * vec4( aMitt + vec3( position.x, 0.0, position.y ) * ( 1.0 + 0.28 * uPool ), 1.0 );
        else {
          vec3 mp = aMitt;
          if ( aPlatt > 1.5 ) mp.xz += vec2( sin( uTid * 0.05 + vFas ), cos( uTid * 0.04 + vFas ) ) * 0.35;
          mvPosition = modelViewMatrix * vec4( mp, 1.0 ); mvPosition.xy += position.xy; mvPosition.z += aPlatt > 1.5 ? 0.0 : 0.25;
        }
        gl_Position = projectionMatrix * mvPosition;`);
      s.fragmentShader = 'uniform float uTid;\nuniform float uPool;\nvarying float vPl;\nvarying float vTand;\nvarying float vFas;\n' + s.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          if ( vPl > 1.5 ) {
            // dimslöja: bred, låg och flikig, utan rund kant
            vec2 q = vMapUv;
            float sida = smoothstep( 0.0, 0.32, q.x ) * smoothstep( 1.0, 0.68, q.x );
            float hojd = smoothstep( 0.0, 0.4, q.y ) * smoothstep( 1.0, 0.45, q.y );
            float fl = 0.55 + 0.45 * sin( q.x * 6.3 + uTid * 0.13 + vFas ) * sin( q.y * 4.1 - uTid * 0.09 + q.x * 2.7 + vFas );
            diffuseColor.a *= sida * hojd * fl;
          } else diffuseColor *= texture2D( map, vMapUv );
        #endif
        diffuseColor.a *= vTand;
        if ( vPl < 1.5 ) diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.1, 0.93, 0.72 ), uPool );   // sen kväll: varmare`);
    };
    m.customProgramCacheKey = () => 'miljo-glod2';
    const o = new THREE.Mesh(g, m);
    o.name = 'kvallsljus'; o.frustumCulled = false; o.renderOrder = 4; o.matrixAutoUpdate = false; o.userData.egen = true; o.visible = false;
    return o;
  }
  // stolplampor längs gången från dörren (stolpen hamnar i barkgeometrin, bandet glöder).
  // Dag: grafitgrå stolpe, frostat ljust band och ljust lock (inte svarta pinnar).
  // dimma = varm, låg dis kring gången närmast huset (skogen på kvällen).
  function lampor(Bark, glod, mal, hy, sno, dimma = false) {
    const VARM = [1, 0.66, 0.34], GRAFIT = [0.07, 0.072, 0.076], FROST = [0.95, 0.94, 0.9], LOCK = [0.12, 0.122, 0.126];   // mörk grafit (linjärt): inga vita pinnar på dagen
    const D = del();
    ror(D, [[0, -0.05, 0, 0.04], [0, 0.44, 0, 0.04]], 4, UG, 1, () => GRAFIT, 0.1);             // fyrkantig stolpe
    ror(D, [[0, 0.44, 0, 0.047], [0, 0.575, 0, 0.047]], 4, UG, 1, () => FROST, 1);              // frostat ljusband
    ror(D, [[0, 0.575, 0, 0.052], [0, 0.615, 0, 0.052], [0, 0.63, 0, 0.012]], 4, UG, 1, () => LOCK, 0.1);   // lock
    // pollarna parvis längs uppfarten (platserna från bil.planera: mal.pollare [x, z, vridning])
    (mal.pollare || []).forEach(([x, z, ry], i) => {
      const y = hy(x, z) - (sno ? 0.06 : 0), ford = (i >> 1) * 0.2 + (i & 1 ? 0.06 : 0);
      lagg(Bark, D, x, y, z, 1, Math.PI / 4 + ry, 1, 0, ETT, ford);
      glod.push([x, y + 0.51, z, 0.22, 0, ...VARM, ford]);   // liten gloria kring bandet (inte ett svävande klot)
      glod.push([x, y + 0.03, z, 2.5, 1, VARM[0] * 0.5, VARM[1] * 0.5, VARM[2] * 0.5, ford]);
    });
    if (dimma) (mal.vagLjus || []).forEach(([x, z], i) => {
      glod.push([x, hy(x, z) + 0.85, z, 4.2 + i * 0.8, 2, VARM[0] * 0.13, VARM[1] * 0.13, VARM[2] * 0.13, 0.15 + i * 0.2, 1.5]);
    });
  }

  // ---- himmel: inverterad sfär med färggradient, drivande moln och stjärnor, utan dimma ----
  const himmelGeo = spara(new THREE.SphereGeometry(240, 40, 20));
  const hpos = himmelGeo.attributes.position, himmelT = new Float32Array(hpos.count);
  for (let i = 0; i < hpos.count; i++) himmelT[i] = hpos.getY(i) / 240;
  himmelGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(hpos.count * 3), 3));
  const HU = {
    molnFarg: { value: C('#ffffff') }, molnMangd: { value: 0.5 },
    // solskivan och månen ritas per pixel (riktning, synlighet, färg); månen står där husritaren
    // lägger månljuset (35° upp, azimut 0,38π)
    uSolD: { value: new THREE.Vector3(0, 1, 0) }, uSolSyn: { value: 0 }, uSolF: { value: C('#fff4e0') },
    uManeD: { value: new THREE.Vector3(Math.cos(Math.PI * 0.38) * Math.cos(0.6109), Math.sin(0.6109), Math.sin(Math.PI * 0.38) * Math.cos(0.6109)) }, uManeSyn: { value: 0 },
  };
  // dithering: brus på ±½ steg efter sRGB-kodningen, så att den mjuka gradienten inte får band
  const himmelMat = spara(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false, map: tx('moln'), dithering: true }));
  himmelMat.onBeforeCompile = s => {
    Object.assign(s.uniforms, HU, { uTid: VU.uTid, uStjarnor: VU.uStjarnor });
    s.vertexShader = 'varying vec3 vRikt;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRikt = position;');
    s.fragmentShader = 'uniform vec3 molnFarg;\nuniform float molnMangd;\nuniform float uTid;\nuniform float uStjarnor;\nuniform vec3 uSolD;\nuniform float uSolSyn;\nuniform vec3 uSolF;\nuniform vec3 uManeD;\nuniform float uManeSyn;\nvarying vec3 vRikt;\n' + s.fragmentShader
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if ( uStjarnor > 0.001 ) {
          vec3 d = normalize( vRikt );
          vec2 sp = vec2( atan( d.z, d.x ) * 95.0, d.y * 150.0 );
          vec2 id = floor( sp ), fr = fract( sp ) - 0.5;
          float h = fract( sin( dot( id, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
          float h2 = fract( h * 91.7 );
          float st = step( 0.982, h ) * smoothstep( 0.16, 0.0, length( fr - ( vec2( h2, fract( h2 * 37.0 ) ) - 0.5 ) * 0.6 ) );
          st *= ( 0.45 + 0.55 * h2 ) * ( 0.75 + 0.25 * sin( uTid * 2.3 + h * 60.0 ) ) * smoothstep( 0.24, 0.55, d.y );   // inga stjärnor nära horisonten: de syntes som ljusa prickar genom kronornas glipor
          diffuseColor.rgb += vec3( 0.9, 0.93, 1.0 ) * st * uStjarnor;
        }
        {
          vec3 d = normalize( vRikt );
          float hz = smoothstep( -0.005, 0.02, d.y );                 // skivorna går ner bakom horisonten
          if ( uSolSyn > 0.001 ) {
            float a = length( d - uSolD );                           // vinkelavstånd (korda) till solen
            float skiva = 1.0 - smoothstep( 0.0075, 0.0105, a );
            float glod = 0.32 * exp( -a * 34.0 ) + 0.12 * exp( -a * 8.0 );
            diffuseColor.rgb = mix( diffuseColor.rgb + uSolF * glod * uSolSyn * hz, uSolF * 1.6, skiva * uSolSyn * hz );
          }
          if ( uManeSyn > 0.001 ) {
            float a = length( d - uManeD );
            vec3 t1 = normalize( cross( uManeD, vec3( 0.0, 1.0, 0.0 ) ) ), t2 = cross( t1, uManeD );
            vec2 q = vec2( dot( d, t1 ), dot( d, t2 ) ) / 0.0105;
            float rr = length( q ), skiva = 1.0 - smoothstep( 0.86, 1.0, rr );
            // mjuk randmörkning och några dova fläckar (maria)
            float mar = 0.5 * smoothstep( 0.42, 0.0, length( q - vec2( -0.25, 0.2 ) ) ) + 0.35 * smoothstep( 0.32, 0.0, length( q - vec2( 0.22, -0.18 ) ) ) + 0.25 * smoothstep( 0.26, 0.0, length( q - vec2( 0.3, 0.35 ) ) );
            vec3 mf = vec3( 0.93, 0.95, 1.0 ) * ( 1.0 - 0.18 * rr * rr ) * ( 1.0 - 0.22 * mar );
            float glod = 0.16 * exp( -a * 16.0 ) + 0.05 * exp( -a * 4.0 );
            diffuseColor.rgb = mix( diffuseColor.rgb + vec3( 0.55, 0.62, 0.8 ) * glod * uManeSyn * hz, mf, skiva * uManeSyn * hz );
          }
        }
        #ifdef USE_MAP
          { vec2 mu = vMapUv + vec2( uTid * 0.0015, 0.0 );
            float ma = texture2D( map, mu ).a;
            // volymkänsla: tätheten jämförs med en punkt en bit upp och mot solens håll – är molnet tunnare
            // där ligger kanten i ljus, är det tätare ligger vi på den gråa undersidan/skuggsidan
            vec3 md = normalize( vRikt );
            float mdaz = sin( atan( uSolD.z, -uSolD.x ) - atan( md.z, -md.x ) );
            float mb = texture2D( map, mu + vec2( mdaz * 0.006, 0.014 ) ).a;
            float ml = clamp( 0.5 + ( ma - mb ) * 2.4, 0.0, 1.0 );
            vec3 mf = molnFarg * mix( 0.8, 1.0, ml ) * ( 1.0 - 0.1 * smoothstep( 0.45, 0.95, ma ) );
            diffuseColor.rgb = mix( diffuseColor.rgb, mf, smoothstep( 0.0, 0.85, ma ) * molnMangd ); }
        #endif`);
  };
  himmelMat.customProgramCacheKey = () => 'miljo-himmel';
  const himmel = new THREE.Mesh(himmelGeo, himmelMat);
  himmel.name = 'himmel'; himmel.frustumCulled = false; himmel.renderOrder = -10; himmel.matrixAutoUpdate = false;
  rot.add(himmel);

  // ---- studions utsikt: en disig trädridå långt bort (syns genom fönstren inifrån) ----
  const studioRida = (() => {
    const W = 2048, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    let fro = 7;
    const rnd = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    const lager = (bas, amp, fg, krona, tat) => {
      g.fillStyle = fg; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, bas - amp * (0.5 + 0.5 * Math.sin(x / W * Math.PI * 6 + bas)) - amp * 0.4 * Math.sin(x / W * Math.PI * 17));
      g.lineTo(W, H); g.closePath(); g.fill();
      for (let x = 0; x < W; x += tat * (0.6 + rnd() * 0.8)) {
        const y = bas - amp * (0.5 + 0.5 * Math.sin(x / W * Math.PI * 6 + bas)) - amp * 0.4 * Math.sin(x / W * Math.PI * 17);
        const h = krona * (0.6 + rnd() * 0.8);
        if (rnd() < 0.55) { g.beginPath(); g.moveTo(x - h * 0.28, y + 2); g.lineTo(x, y - h); g.lineTo(x + h * 0.28, y + 2); g.fill(); }
        else { g.beginPath(); g.ellipse(x, y - h * 0.35, h * 0.38, h * 0.48, 0, 0, Math.PI * 2); g.fill(); }
      }
    };
    lager(170, 26, '#a9b4a6', 40, 22);
    lager(196, 18, '#8d9c88', 52, 26);
    lager(224, 12, '#748a6c', 64, 30);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.anisotropy = 4;
    const m = new THREE.Mesh(spara(new THREE.CylinderGeometry(64, 64, 16, 96, 1, true)),
      spara(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: true })));
    m.position.y = 6.5; m.updateMatrix(); m.matrixAutoUpdate = false; m.renderOrder = -9; m.frustumCulled = false; m.name = 'studio-rida'; m.visible = false;
    rot.add(m);
    return m;
  })();

  // ---- marken ----
  const mark = new THREE.Mesh();
  mark.name = 'mark'; mark.receiveShadow = true; mark.matrixAutoUpdate = false;
  rot.add(mark);

  // ---- grunden runt huset (byggs om när husets mått ändras) ----
  const grundGrupp = new THREE.Group(); grundGrupp.name = 'grund'; grundGrupp.matrixAutoUpdate = false;
  rot.add(grundGrupp);

  const bg = C('#ece7df');                      // scene.background = horisontens färg
  const dimma = new THREE.Fog(bg.clone(), 34, 90);

  // ---- markhöjd (platt nära huset) ----
  const hojdTradgard = (x, z) => { const r = Math.hypot(x, z); return mjuk(30, 70, r) * (fbm(x * 0.016 + 3, z * 0.016) - 0.45) * 4; };
  const hojdSkog = (x, z) => { const r = Math.hypot(x, z); return mjuk(13, 34, r) * ((fbm(x * 0.03, z * 0.03 + 5) - 0.45) * 2.6 + (fbm(x * 0.14, z * 0.14) - 0.5) * 0.5); };
  const hojdVinter = (x, z) => { const r = Math.hypot(x, z); return mjuk(15, 34, r) * (fbm(x * 0.026 + 9, z * 0.026) - 0.45) * 2.2; };

  // ---- markens färgvariation: per pixel i skuggaren (patcha mark), A = mörka/frodiga fläckar,
  // B = ljusa/torra, C = ängen längre ut (rad = radie där den tar över), amp = mellanskalan, sat = mättnad
  const MARK = {
    // rel = höjdkänsla i skuggaren: karta (GLSL, världens xz → brusets uv), steg mot solen (m), amp (ton), lut (ljus/skugga), farg
    tradgard: { id: 'tg', A: [0.88, 0.93, 0.86], B: [1.05, 1.03, 0.87], C: [1.08, 1.0, 0.8], rad: [20, 36], amp: 0.12, sat: 0.82, detalj: true, klipp: true,
      rel: { karta: '( p ) / 1.5', steg: 0.05, amp: 0.08, lut: 0.5, farg: [1, 1, 0.9] } },
    // skogen: frodig mossa (A) mot torrare barrmatta (B); utanför gläntan (15–32 m) mörkare, brunare skogsgolv (C)
    skog: { id: 'sk', A: [0.72, 0.77, 0.72], B: [1.1, 0.87, 0.82], C: [0.8, 0.76, 0.72], rad: [15, 32], amp: 0.36, sat: 0.88,
      rel: { karta: 'mat2( 0.8, -0.6, 0.6, 0.8 ) * ( p ) / 3.1', steg: 0.09, amp: 0.13, lut: 0.5, farg: [1, 1, 1] } },   // mossiga tuvor och svackor
    // vintern: blå skuggsvackor (A) mot vita ryggar (B), så att snötäcket får form i dagsljus
    // rel: vindrippel (avlånga längs vinden) med blå skuggsida
    vinter: { id: 'vi', A: [0.8, 0.865, 1.0], B: [0.95, 0.965, 0.99], amp: 0.12, sat: 1,
      rel: { karta: 'mat2( 0.1044, -0.15, 0.0367, 0.427 ) * ( p )', steg: 0.16, amp: 0.09, lut: 0.8, farg: [1, 0.82, 0.5] } },
  };

  // ---- miljöernas egenskaper ----
  // fjarr() bygger det som inte beror på huset (träd, ridå, äng, liv) en gång per miljö;
  // nara(mal, F) bygger gången, lamporna, gräsmattan och det som står tätt intill huset vid varje hus.
  const DEF = {
    studio: {
      dimma: [34, 90], morkMark: 0.42, bg: C('#ece7df'), kvallBg: C('#23242e'), rida: true, moln: 0.2,
      himmel: { top: C('#b4c3d3'), mid: C('#d6dde3'), hor: C('#ece7df') },
      mark: () => [markGeo(null), patcha(new THREE.MeshLambertMaterial({ map: tx('betong'), vertexColors: true }), { studio: true })], ljus: C('#b4b0a8'),
      grund: { ton: C('#e0dcd3'), ao: C('#2c261e'), styrka: 0.55, bredd: 0.32 },
    },
    tradgard: {
      dimma: [50, 190], morkMark: 0.62, hojd: hojdTradgard, moln: 0.6, liv: true, vind: 1,
      himmel: { top: C('#6e95c2'), mid: C('#a8c2db'), hor: C('#e6e0d2') },
      mark: () => [markGeo(null, hojdTradgard), patcha(new THREE.MeshLambertMaterial({ map: tx('gras'), vertexColors: true }), { tva: true, mot: true, mark: MARK.tradgard })],
      grund: { ton: C('#cdc8be'), ao: C('#1b220f'), styrka: 0.72 }, ljus: C('#9fb0bf'),
      fjarr: () => tradgardFjarr(), nara: (mal, F) => tradgardNara(mal, F),
    },
    skog: {
      dimma: [22, 115], morkMark: 0.62, hojd: hojdSkog, moln: 0.45, liv: true, vind: 0.75,
      himmel: { top: C('#8ea5b8'), mid: C('#bac6c9'), hor: C('#d6dad0') },
      mark: () => [markGeo(null, hojdSkog), patcha(new THREE.MeshLambertMaterial({ map: tx('skog'), vertexColors: true }), { tva: true, mark: MARK.skog })],
      grund: { ton: C('#b9b2a4'), ao: C('#191b0e'), styrka: 0.72 }, ljus: C('#a3b0a6'),
      maane: new THREE.Color(0.17, 0.215, 0.32), maaneStyrka: 0.9,         // månljus: blå fyllning, läsbar men stämningsfull
      fjarr: () => barrskogFjarr(false), nara: (mal, F) => barrskogNara(mal, F, false),
    },
    vinter: {
      dimma: [40, 160], morkMark: 0.62, hojd: hojdVinter, moln: 0.35, liv: true, vind: 0.6,
      himmel: { top: C('#a3b6cc'), mid: C('#cfd9e3'), hor: C('#eef0f0') },
      mark: () => {
        const s = tx('sno');
        return [markGeo(null, hojdVinter), patcha(new THREE.MeshPhongMaterial({
          map: s.karta, specularMap: s.spec, normalMap: s.normal, normalScale: new THREE.Vector2(0.6, 0.6),
          specular: 0xffffff, shininess: 120, vertexColors: true, emissive: C('#1a2438'),
        }), { tva: true, gnistra: true, mark: MARK.vinter })];
      },
      grund: { sno: true, ao: C('#3e5078'), styrka: 0.42 }, ljus: C('#9fb4d6'),
      fjarr: () => barrskogFjarr(true), nara: (mal, F) => barrskogNara(mal, F, true),
    },
  };
  const PERSIKA = C('#f4b48a'), BARNSTEN = C('#f39a4c'), MJUKBLA = C('#a9c0dc'), VARMLAMPA = new THREE.Color(1, 0.56, 0.24), band = new THREE.Color();
  const KV = { top: C('#0a1430'), mid: C('#1b2a48'), hor: C('#3b4a64') };
  const GULD = { top: C('#6d7fa6'), mid: C('#c9a38f'), hor: C('#f0b98a') };
  const GRY = { top: C('#8494b8'), mid: C('#d9b8b4'), hor: C('#f3c8b0') };
  const MORK = C('#1f1d19'), KVALLSGOLV = C('#7a808c'), MAANE = new THREE.Color(0.13, 0.15, 0.2), SKYMNING = C('#e9824a');

  // ---- utplacering ----
  const matris = (() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    return (x, y, z, sx, sy, sz, ry = 0, lx = 0, lz = 0) => {
      e.set(lx, ry, lz); q.setFromEuler(e); p.set(x, y, z); s.set(sx, sy, sz);
      return m.compose(p, q, s).clone();
    };
  })();
  function instanser(namn, geom, material, poster, skugga = false, tar = false) {
    if (!poster.length) return null;
    const m = new THREE.InstancedMesh(geom, material, poster.length);
    m.name = namn;
    poster.forEach((e, i) => { m.setMatrixAt(i, e.m); if (e.c) m.setColorAt(i, e.c); });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = skugga; m.receiveShadow = tar; m.matrixAutoUpdate = false;
    m.computeBoundingSphere();
    return m;
  }
  const variera = (hex, r, h = 0.025, s = 0.1, l = 0.08) => C(hex).offsetHSL((r() - 0.5) * h, (r() - 0.5) * s, (r() - 0.5) * l);

  // Fria zoner, så att träden inte skymmer kameran (12–35 m från huset).
  // Bakom huset (norr och väster) får träd stå närmare, utom i smala fönster där vyerna
  // Norr, Baksida och Väster tittar in. Framför (söder och öster) står stora träd först efter ~27 m.
  // Vinklar: öst 0°, syd 90°, väst ±180°, norr −90°.
  function regler(mal) {
    const { L, W } = mal, S = Math.max(L, W);
    const kant = (x, z) => Math.hypot(Math.max(Math.abs(x) - L / 2, 0), Math.max(Math.abs(z) - W / 2, 0));
    const fonster = a => Math.abs(a + 90) < 14 || Math.abs(a + 129) < 14 || Math.abs(a) > 166;
    const bak = a => a <= -12 || a >= 150;
    const KOR = [0, 51, 90, 180, -90, -129].map(g => [Math.cos(g * Math.PI / 180), Math.sin(g * Math.PI / 180)]);
    const korridor = (x, z) => KOR.some(([cx, cz]) => x * cx + z * cz > 0 && Math.abs(x * cz - z * cx) < S / 2 + 2.5);
    const krav = (x, z, klass = 'stor') => {
      const r = Math.hypot(x, z), a = Math.atan2(z, x) * 180 / Math.PI, k = kant(x, z);
      if (mal.blockerad && mal.blockerad(x, z, klass === 'tuva' ? 0.75 : 1.4)) return false;   // altanen och gången
      if (klass === 'tuva') return k >= 0.9;
      if (klass === 'lag') return k >= 2.2 && (bak(a) || r >= Math.max(9, S / 2 + 4.5));
      const liten = klass === 'liten';
      if (k < (liten ? 4 : 6)) return false;
      if (r < 32 && korridor(x, z)) return false;
      if (bak(a)) return r >= (fonster(a) ? (liten ? 22 : 28) : (liten ? Math.max(9.5, S / 2 + 5) : Math.max(13, S / 2 + 8.5)));
      return r >= (liten ? 22 : 27) + S * 0.3;
    };
    return { krav, kant, S };
  }
  function stroare(r, krav, upp) {
    return (antal, rMin, rMax, avst, klass = 'stor') => {
      const ut = [];
      for (let f = 0; f < antal * 40 && ut.length < antal; f++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(rMin * rMin + r() * (rMax * rMax - rMin * rMin));
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!krav(x, z, klass)) continue;
        if (!upp.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.a + avst) ** 2)) continue;
        const p = { x, z, a: avst }; upp.push(p); ut.push(p);
      }
      return ut;
    };
  }
  const polar = (grad, d) => [Math.cos(grad * Math.PI / 180) * d, Math.sin(grad * Math.PI / 180) * d];

  // Gemensam verktygslåda för en miljös vegetation: träd (bark + lövverk nära/fjärran), markväxter
  const NARA = 24;
  // impostorträden: [art, minsta och största höjd]; ridåns granar är mindre. Björk och ek tar given höjd.
  const BARR = { gran0: ['gran', 14, 24], gran1: ['gran', 14, 24], gran2: ['gran', 11, 19], tall0: ['tall', 15, 22], tall1: ['tall', 15, 22], bjork: ['bjork', 12, 18], bjorkKal: ['bjorkKal', 12, 18], ek: ['ek', 9, 14] };
  function verktyg(r, hy, blk = null, sno = false) {
    const V = { bark: samling(), nara: samling(), fjarr: samling(), mark: samling(), matta: samling(), barr: [] }, flack = [];
    const trad = (typ, x, z, h, flackB = 0) => {
      const b = BARR[typ];
      if (b) {
        const egen = b[0] === 'ek' || b[0].startsWith('bjork'), hh = egen && h > 0 ? h : b[1] + r() * (b[2] - b[1]), y = hy(x, z), bred = hh * (0.88 + r() * 0.24), ry = r() * 6.283;
        const artNamn = sno && (b[0] === 'gran' || b[0] === 'tall') ? b[0] + 'Sno' : b[0];
        const c = new THREE.Color(1, 1, 1).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12);
        if (typ === 'gran2') c.multiplyScalar(0.86);   // ridån lite mörkare, så den inte blir ljust ludd i diset
        V.barr.push({ m: matris(x, y, z, bred, hh, bred, ry), c, art: artNamn, x, y, z, hh, ry });
        if (flackB) flack.push({ m: matris(x, y + 0.02, z, hh * 0.3, 1, hh * 0.3, 0) });
        return;
      }
      const v = variant(typ, r() * 3 | 0), s = h / v.H, y = hy(x, z), ry = r() * 6.283;
      if (v.bark.I.length) lagg(V.bark, v.bark, x, y, z, s, ry, v.H, VK[typ], BARKTON[typ]);
      lagg(Math.hypot(x, z) < NARA ? V.nara : V.fjarr, v.lov, x, y, z, s, ry, v.H, VK[typ], ton(r, LOVTON[typ]));
      if (flackB) flack.push({ m: matris(x, y + 0.02, z, flackB, 1, flackB, 0) });
    };
    const vaxt = (typ, x, z, s, tint) => (blk && blk(x, z, 0.7)) || lagg(V.mark, variant(typ, r() * 3 | 0).lov, x, hy(x, z) - 0.02, z, s, r() * 6.283, 1, VK[typ], tint);
    // gräsmatta: korta strån 2–12 m från huset (där kameran tittar), tunnas ut utåt
    const matta = (mal, kant, antal, hmin, hmax, tint, gb) => {
      const { L, W } = mal, E = 12.5;
      for (let f = 0, n = 0; f < antal * 6 && n < antal; f++) {
        const x = (r() - 0.5) * (L + 2 * E), z = (r() - 0.5) * (W + 2 * E), k = kant(x, z);
        if (k < gb - 0.07 || k > E || (k > 2 && r() > 1 - (k - 2) / E * 0.65)) continue;
        if (blk && blk(x, z, 0.5)) continue;
        const s = (hmin + r() * (hmax - hmin)) * (k < gb + 0.1 ? 0.8 : 1);
        lagg(V.matta, variant('matta', r() * 3 | 0).lov, x, hy(x, z) - 0.01, z, s, r() * 6.283, 1, VK.matta, ton(r, tint, 0.12));
        n++;
      }
    };
    return { V, flack, trad, vaxt, matta };
  }

  // ---- Riktiga träd → bakade impostorer ----
  // Varje art byggs en gång i 3D: förgrenad, avsmalnande stam med bark, grenvåningar/grenar och
  // tusentals barr- och lövkort med inbakad AO (mörkare inne i kronan). Sedan renderas arten från
  // 8 håll till en atlas per miljö (2048², 8 vinklar × upp till 4 arter, 256 × 512 px per bild):
  // färg (sRGB) + normaler. I världen är varje träd ett kort mot kameran som väljer de två närmaste
  // vinklarna och tonar mellan dem; normalerna ger sol- och skuggsida i scenens eget ljus.
  // De närmaste träden runt huset läggs i stället in som riktiga 3D-träd (bark- och lövgeometrin).
  const ARTER = {};
  const art = namn => ARTER[namn] || (ARTER[namn] = GENART[namn]());
  const sprej = (D, p, dir, h, ls, f0, f1, s, w, cell, nf) => kort(D, [
    { p, h, v: 0, f: f0, w: 0, s },
    { p: [p[0] + dir[0] * ls, p[1] + dir[1] * ls, p[2] + dir[2] * ls], h, v: 1, f: f1, w, s },
  ], cell, nf);
  // Gran: tät, mörk blågrön kon av hängande grenvåningar; varje gren bär barrskott på båda sidor
  function granArt(fro, sno) {
    const r = slump(fro), B = del(), Lv = del(), H = 18, R0 = 0.235 * H;
    const stam = t => [Math.sin(t * 5 + fro) * 0.06 * t, t * H, Math.cos(t * 4 + fro) * 0.05 * t];
    ror(B, [-0.012, 0.15, 0.35, 0.55, 0.75, 0.9, 1].map(t => [...stam(t), 0.27 * Math.pow(1 - Math.max(0, t), 1.1) + 0.012]), 7, UG, 1.4, y => y < 1.5 ? [0.5, 0.47, 0.44] : [0.26, 0.24, 0.22]);   // inne i kronan: mörk stam (ljus bark lyste igenom glipor som prickar)
    const nf = p => norm([p[0] / R0, 0.45 + 0.3 * (p[1] / H), p[2] / R0]);
    for (let t = 0.07; t < 0.985; t += 0.022 + r() * 0.008) {
      const [sx0, y0, sz0] = stam(t), Rt = R0 * Math.pow(1 - t, 0.92) * (0.82 + 0.36 * r()) + 0.25, nb = t > 0.88 ? 4 : 5 + (r() * 3 | 0);
      for (let b = 0; b < nb; b++) {
        const az = (b + r() * 0.7) / nb * 6.283 + t * 9.1, ca = Math.cos(az), sa = Math.sin(az), L = Rt * (0.8 + 0.3 * r());
        const snoGren = sno && r() < 0.5;          // snön ligger i våningar: hela grenar, inte prickar överallt
        const P = u => [sx0 + ca * L * u, y0 - L * (0.2 + 0.08 * t) * Math.sin(u * Math.PI * 0.85) + L * 0.02 * u, sz0 + sa * L * u];
        ror(B, [0, 0.5, 1].map(u => [...P(u), (0.055 * (1 - t) + 0.012) * (1 - 0.75 * u)]), 3, UG, 1, () => [0.13, 0.115, 0.1]);   // grenar i skugga under barren: mörka, annars ljusa prickar genom gliporna
        const steg = 0.24 / Math.max(0.6, L);
        for (let u = 0.15; u <= 1.001; u += steg * (0.85 + 0.3 * r())) {
          const p = P(Math.min(1, u)), q = P(Math.min(1, u + 0.05)), dx = q[0] - p[0], dz = q[2] - p[2], dl = Math.hypot(dx, dz) || 1, ut = [dx / dl, dz / dl];
          // tre skott per nod: ett åt varje sida och ett som hänger rakt ner (gardiner under grenen)
          for (const sd of (u > 0.95 ? [0] : [-1, 1, 2])) {
            const vin = sd === 2 ? (r() - 0.5) * 0.6 : sd * (0.75 + r() * 0.35), cv = Math.cos(vin), sv = Math.sin(vin), ned = sd === 2 ? 0.25 : 1;
            const dir = norm([(ut[0] * cv - ut[1] * sv) * ned, -0.32 - r() * 0.25 + (sd ? 0 : 0.2) - (sd === 2 ? 0.9 : 0), (ut[0] * sv + ut[1] * cv) * ned]);
            const ls = (0.32 + 0.36 * (1 - u * 0.4)) * Math.min(1, 0.5 + L / 3) * (0.8 + 0.4 * r()) * (sd === 2 ? 0.8 : 1), bw = ls * 0.4;
            const roll = (r() - 0.5) * 1.3, hz = norm(cross(dir, [0, 1, 0])), hv = cross(hz, dir), cr = Math.cos(roll), sr = Math.sin(roll);
            const hn = [hz[0] * cr + hv[0] * sr, hz[1] * cr + hv[1] * sr, hz[2] * cr + hv[2] * sr], h = [hn[0] * bw, hn[1] * bw, hn[2] * bw];
            const q2 = Math.hypot(p[0], p[2]) / (Rt + 0.3), ao = (0.36 + 0.64 * mjuk(0.05, 0.95, q2)) * (0.8 + 0.3 * t) * (0.9 + 0.2 * r());
            // snö på hela skott som vänder ovansidan upp (sammanhängande fläckar), inte på hängande skott
            const s = snoGren && sd !== 2 && u > 0.25 && Math.abs(cross(hn, dir)[1]) > 0.5 && r() < 0.8 ? 0.85 : 0;
            sprej(Lv, p, dir, h, ls, [ao * 0.78, ao * 0.8, ao * 0.8], [ao * 1.05, ao * 1.05, ao * 1.05], s, 0.008, 2, nf);
          }
        }
      }
    }
    for (let k = 0; k < 4; k++) {                 // spetsig topp: korta skott rakt upp
      const a = k * 1.571 + r() * 0.4, h = [Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], p = [stam(1)[0], H + 0.35, stam(1)[2]];
      sprej(Lv, p, [0, -1, 0], h, 1.1, [0.9, 0.9, 0.9], [0.8, 0.8, 0.8], sno ? 0.4 : 0, 0.01, 2, nf);
    }
    return { bark: B, lov: Lv, H };
  }
  // Tall: hög stam, gråbrun nertill och orangebrun upptill, platt oregelbunden krona av barrtofsar
  function tallArt(fro, sno) {
    const r = slump(fro), B = del(), Lv = del(), H = 20, R = 0.22 * H, cc = [0, 0.8 * H, 0];
    const stam = t => [Math.sin(t * 3.1 + fro) * 0.22 * t, t * H, Math.cos(t * 2.3 + fro) * 0.16 * t];
    const farg = y => { const t = y / H; return lerp3([0.62, 0.6, 0.58], [1.3, 0.94, 0.74], mjuk(0.28, 0.6, t)); };
    ror(B, [-0.01, 0.2, 0.4, 0.6, 0.8, 0.95].map(t => [...stam(t), 0.3 * (1 - t * 0.85) + 0.02]), 7, UT, 1.6, farg);
    const nf = p => norm([(p[0] - cc[0]) / R, (p[1] - cc[1]) / (0.2 * H) * 0.5 + 0.55, (p[2] - cc[2]) / R]);
    const klump = (p, st) => {
      const q = Math.hypot(p[0], p[2]) / R, ao = (0.45 + 0.55 * mjuk(0.1, 1, q)) * (0.8 + 0.25 * mjuk(0.6 * H, H, p[1])) * (0.9 + 0.2 * r());
      for (let k = 0; k < 3; k++) {
        const pk = [p[0] + (r() - 0.5) * st * 0.5, p[1] + (r() - 0.5) * st * 0.25, p[2] + (r() - 0.5) * st * 0.5];
        kluster(Lv, r, pk, st * (0.75 + 0.4 * r()), norm([(r() - 0.5) * 1.8, 0.7, (r() - 0.5) * 1.8]), 0.7, 3, [ao, ao, ao], nf, sno && r() < 0.6 ? 0.85 : 0, 0.012);
      }
    };
    const nG = 11 + (r() * 4 | 0);
    for (let g = 0; g < nG; g++) {
      const t = 0.6 + 0.36 * (g + r() * 0.8) / nG, s0 = stam(t), az = r() * 6.283, el = 0.25 + r() * 0.5, L = (1.2 + 3.6 * (1 - (t - 0.6) / 0.4)) * (0.7 + 0.5 * r());
      const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      const P = u => [s0[0] + d[0] * L * u, s0[1] + d[1] * L * u - 0.15 * L * u * u, s0[2] + d[2] * L * u];
      ror(B, [0, 0.5, 1].map(u => [...P(u), 0.09 * (1 - 0.7 * u) * (1.2 - t) + 0.01]), 4, UT, 1, y => farg(y).map(v => v * 0.5));
      klump(P(1), 1.7);
      const nk = 2 + (r() * 3 | 0);
      for (let k = 0; k < nk; k++) {
        const p = P(0.45 + r() * 0.5), a2 = az + (r() - 0.5) * 2.2, L2 = 0.6 + r() * 1.4;
        const p2 = [p[0] + Math.cos(a2) * L2, p[1] + 0.2 + r() * 0.6, p[2] + Math.sin(a2) * L2];
        ror(B, [[...p, 0.04], [...p2, 0.015]], 3, UT, 1, y => farg(y).map(v => v * 0.4));
        klump(p2, 1.4);
      }
    }
    klump(stam(0.98), 1.5);
    return { bark: B, lov: Lv, H };
  }
  // Björk: vit näver med lenticeller (barktexturen) och mörk sprickig bas, 2–3 ledare, grenar som
  // bågnar nedåt med hängande fina kvistar; luftig gulgrön krona. kal = vinter: samma kvistar som ett
  // lila-brunt kvistdis.
  function bjorkArt(fro, kal) {
    const r = slump(fro), B = del(), Lv = del(), H = 15, lut = (r() - 0.5) * 0.6, yF = H * (0.38 + r() * 0.08);
    const cc = [lut, 0.66 * H, 0], R = 0.27 * H, Ry = 0.32 * H;
    const stamF = y => { const k = mjuk(0.5, 2.6, y); return [0.32 + 0.68 * k, 0.29 + 0.68 * k, 0.28 + 0.66 * k]; };
    const nf = p => norm([(p[0] - cc[0]) / R, (p[1] - cc[1]) / Ry * 0.7 + 0.3, (p[2] - cc[2]) / R]);
    ror(B, [-0.02, 0.25, 0.5, 0.75, 1].map(t => [lut * t * t, t * yF, 0, 0.2 - 0.09 * t]), 7, UB, 1.2, stamF);
    const ledare = [], nL = 2 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < nL; k++) {
      const e = [lut * 1.3 + (k - (nL - 1) / 2) * 1.2 + (r() - 0.5) * 0.6, H * (0.9 + r() * 0.1), (r() - 0.5) * 1.2];
      const pts = [0, 0.25, 0.5, 0.75, 1].map(t => [lut + (e[0] - lut) * t + Math.sin(t * 3 + k) * 0.25, yF + (e[1] - yF) * t, e[2] * t, (0.1 - k * 0.015) * (1 - 0.75 * t) + 0.012]);
      ror(B, pts, 5, UB, 1.2, stamF); ledare.push(pts);
    }
    const tint = kal ? [0.5, 0.37, 0.39] : [0.92, 0.97, 0.82];
    const kvist = (p, ut, u) => {
      // smala, hängande skott (breda kort lästes som ljusgröna block nära kameran)
      const hl = (0.8 + r() * 1.3) * (0.6 + 0.5 * u), bw = 0.26 + r() * 0.14, q = Math.hypot((p[0] - cc[0]) / R, (p[1] - cc[1]) / Ry, (p[2] - cc[2]) / R);
      const ao = (0.4 + 0.6 * mjuk(0.15, 1, q)) * (0.85 + 0.3 * r()), sv = [(r() - 0.5) * 0.3 + ut[0] * 0.2, -hl, (r() - 0.5) * 0.3 + ut[2] * 0.2];
      const dl = Math.hypot(...sv), dir = [sv[0] / dl, sv[1] / dl, sv[2] / dl];
      for (const vr of [0, 1.571]) {
        const a = Math.atan2(ut[2], ut[0]) + 1.571 + vr + (r() - 0.5) * 0.5, h = [Math.cos(a) * bw, 0, Math.sin(a) * bw];
        const f0 = [tint[0] * ao * 0.8, tint[1] * ao * 0.8, tint[2] * ao * 0.8], f1 = [tint[0] * ao, tint[1] * ao, tint[2] * ao];
        sprej(Lv, p, dir, h, dl, f0, f1, kal ? 0.12 : 0, 0.03, 0, nf);
      }
    };
    const grenar = [];
    ledare.forEach(pts => { for (let i = 1; i < pts.length; i++) for (let k = 0; k < 4; k++) if (r() < 0.75) { const t = r(), a = pts[i - 1], b = pts[i]; grenar.push(lerp3(a, b, t)); } });
    for (let y = yF * 0.8; y < yF; y += 0.6) grenar.push([lut * (y / yF) ** 2, y, 0]);
    grenar.forEach(p0 => {
      const az = r() * 6.283, el = 0.7 + r() * 0.45, f = (p0[1] - yF) / (H - yF), L = (1.5 + r() * 2.2) * (1 - 0.45 * Math.max(0, f));
      const dh = [Math.cos(az), 0, Math.sin(az)];
      const P = u => [p0[0] + dh[0] * L * u * Math.cos(el) * 1.25, p0[1] + L * Math.sin(el) * u - L * 0.75 * u * u, p0[2] + dh[2] * L * u * Math.cos(el) * 1.25];
      ror(B, [0, 0.5, 1].map(u => [...P(u), 0.045 * (1 - 0.8 * u) + 0.006]), 3, UB, 1, () => [0.5, 0.45, 0.43]);
      for (let u = 0.25; u <= 1.001; u += 0.09 + r() * 0.05) kvist(P(Math.min(1, u)), dh, u);
    });
    return { bark: B, lov: Lv, H };
  }
  const GENART = {
    gran: () => granArt(711, false), granSno: () => granArt(711, true),
    tall: () => tallArt(733, false), tallSno: () => tallArt(733, true),
    bjork: () => bjorkArt(911, false), bjorkKal: () => bjorkArt(911, true),
    ek: () => lovVar(121, 'lov'),                // bred, oregelbunden lövkrona (trädgården)
  };

  // bakningens skuggare: färg × hörnfärg (AO) med snö på synliga ovansidor, eller normaler (uMode 1)
  function bakMat(map, alfa, U) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uMode: U.uMode, uSno: U.uSno },
      // förmultiplicerad alfa: kanter och mipnivåer blandas aldrig med bakgrundens färg eller normal
      // (det gav salt-och-peppar och ljusa kanter); vid samplingen delas med α
      side: THREE.DoubleSide, transparent: alfa, blending: alfa ? THREE.CustomBlending : THREE.NoBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `attribute vec3 color;
        attribute float aSno;
        varying vec2 vUv; varying vec3 vN; varying vec3 vC; varying float vS; varying vec3 vP;
        void main() {
          vUv = uv; vC = color; vS = aSno; vN = normalize( normalMatrix * normal );
          vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D map; uniform float uMode; uniform float uSno;
        varying vec2 vUv; varying vec3 vN; varying vec3 vC; varying float vS; varying vec3 vP;
        void main() {
          ${alfa ? `vec2 dd = fwidth( vUv ) * 1024.0;
          vec4 t = textureLod( map, vUv, clamp( log2( max( max( dd.x, dd.y ), 1e-4 ) ), 0.0, 3.0 ) );
          t.a *= 1.0 + max( log2( max( max( dd.x, dd.y ), 1e-4 ) ), 0.0 ) * 0.55;
          if ( t.a < 0.22 ) discard;
          float al = smoothstep( 0.22, 0.7, t.a );` : 'vec4 t = texture2D( map, vUv ); float al = 1.0;'}
          if ( uMode > 0.5 ) { gl_FragColor = vec4( ( normalize( vN ) * 0.5 + 0.5 ) * al, al ); return; }
          vec3 c = t.rgb * vC;
          if ( uSno > 0.0 && vS > 0.0 ) {
            vec3 fn = normalize( cross( dFdx( vP ), dFdy( vP ) ) );
            vec3 up = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
            // snö bara på tydliga ovansidor, i fläckar (grov brusruta per kort), undersidorna förblir mörka
            float nz = fract( sin( dot( floor( vUv * 16.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            // hela kortets synliga ovansida blir vit (en fläck per skott); undersidan förblir grön
            float sn = uSno * step( 0.5, vS ) * smoothstep( -0.05, 0.3, dot( fn, up ) );
            c = mix( c, vec3( 0.86, 0.9, 0.95 ) * ( 0.9 + 0.1 * nz ), sn );
          }
          gl_FragColor = vec4( c * al, al );
        }`,
    });
  }
  const IMP = 2048, FW = 256, FH = 512;
  // bakar arterna (högst 4) till färg- och normalatlas; renderarens tillstånd återställs efteråt
  function bakaAtlas(arter) {
    const t0 = performance.now();
    // Varje bild bakas i dubbel upplösning till en liten ruta (med djupbuffert) och krymps sedan in i
    // atlasen med linjärt filter = 2 × 2 kantutjämning. Förr bakades rakt i atlasen utan utjämning:
    // barrkortens trappstegskanter förstorades till pixliga, randiga granar nära kameran.
    const SS = 2;
    const ny = srgb => {
      const rt = new THREE.WebGLRenderTarget(FW * SS, FH * SS, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
      if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace;
      return rt;
    };
    // atlasen: utan djup, med mipnivåer (de räknas en gång när allt är inkopierat)
    const slutmal = srgb => {
      const ut = new THREE.WebGLRenderTarget(IMP, IMP, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
      if (srgb) ut.texture.colorSpace = THREE.SRGBColorSpace;
      ut.texture.anisotropy = ANISO;
      return ut;
    };
    const rtF = ny(true), rtN = ny(false), utF = slutmal(true), utN = slutmal(false), U = { uMode: { value: 0 }, uSno: { value: 0 } };
    const kopMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: null } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { gl_FragColor = texture2D( t, vUv ); }',
    });
    const kopNat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), kopMat); kopNat.frustumCulled = false;
    const kopScen = new THREE.Scene(); kopScen.add(kopNat);
    const scen = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
    const mB = bakMat(tx('bark'), false, U), mL = bakMat(tx('lovAtlas'), true, U), box = [], noll = new THREE.Color(0, 0, 0);
    const fore = { rt: renderer.getRenderTarget(), c: renderer.getClearColor(new THREE.Color()), a: renderer.getClearAlpha(), auto: renderer.autoClear };
    renderer.autoClear = false;
    // atlasmålen skapas och töms (med mipnivåer påslagna, så att de finns), sedan kopieras rutorna in en i taget
    [utF, utN].forEach(ut => { renderer.setRenderTarget(ut); renderer.setClearColor(noll, 0); renderer.clear(true, false, false); ut.texture.generateMipmaps = false; ut.scissorTest = true; });
    arter.forEach((namn, rad) => {
      const A = art(namn), sb = samling(), sl = samling();
      lagg(sb, A.bark, 0, 0, 0, 1, 0, A.H, 0); lagg(sl, A.lov, 0, 0, 0, 1, 0, A.H, 0);
      let wx = 0, top = 0;
      [sb, sl].forEach(S => { for (let i = 0; i < S.P.length; i += 3) { wx = Math.max(wx, Math.hypot(S.P[i], S.P[i + 2])); top = Math.max(top, S.P[i + 1]); } });
      const Wb = Math.max(2 * wx * 1.05, top * 1.08 / 2), Hb = 2 * Wb, y0 = -0.03 * top;
      box.push(new THREE.Vector4(Wb / top, Hb / top, y0 / top, 0));
      const nat = [vegMesh('b', sb, mB, false, false), vegMesh('l', sl, mL, false, false)].filter(Boolean);
      nat.forEach(m => scen.add(m));
      cam.left = -Wb / 2; cam.right = Wb / 2; cam.bottom = y0; cam.top = y0 + Hb; cam.updateProjectionMatrix();
      U.uSno.value = namn === 'bjorkKal' ? 0.6 : /Sno$/.test(namn) ? 1 : 0;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        cam.position.set(Math.sin(a) * 80, 0, Math.cos(a) * 80); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
        for (const [rt, ut, mode] of [[rtF, utF, 0], [rtN, utN, 1]]) {
          U.uMode.value = mode;
          renderer.setRenderTarget(rt); renderer.setClearColor(noll, 0); renderer.clear(true, true, false);
          renderer.render(scen, cam);
          ut.viewport.set(k * FW, rad * FH, FW, FH); ut.scissor.set(k * FW, rad * FH, FW, FH);
          kopMat.uniforms.t.value = rt.texture;
          renderer.setRenderTarget(ut); renderer.render(kopScen, cam);
        }
      }
      nat.forEach(m => { scen.remove(m); m.geometry.dispose(); });
    });
    // mipnivåerna räknas en gång: en tom ritning mot målet räcker (three räknar dem efter varje ritning
    // när generateMipmaps är på – under inkopieringen var det avstängt, annars 128 omräkningar)
    kopNat.visible = false;
    [utF, utN].forEach(ut => {
      ut.scissorTest = false; ut.viewport.set(0, 0, IMP, IMP); ut.scissor.set(0, 0, IMP, IMP); ut.texture.generateMipmaps = true;
      renderer.setRenderTarget(ut); renderer.render(kopScen, cam);
    });
    renderer.setRenderTarget(fore.rt); renderer.setClearColor(fore.c, fore.a); renderer.autoClear = fore.auto;
    rtF.dispose(); rtN.dispose(); kopNat.geometry.dispose(); kopMat.dispose();
    mB.dispose(); mL.dispose();
    const ms = Math.round(performance.now() - t0);
    if (typeof console !== 'undefined') console.info(`miljö: bakade ${arter.join(', ')} på ${ms} ms`);
    return { rtF: utF, rtN: utN, box, ms };
  }

  // impostorkortens skuggare (delas av färg- och djupmaterialet)
  const IMP_V = `uniform float uTid;
    uniform vec2 uVind;
    uniform vec4 uBox[4];
    attribute float aKol;
    varying vec2 vImpUv; varying vec3 vR; varying vec3 vF; varying float vK0; varying float vK1; varying float vKf; varying float vRad; varying vec3 vImpP;
  `;
  const IMP_BEGIN = (djup) => `
    vec3 ip = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
    float isx = length( instanceMatrix[0].xyz ), isy = length( instanceMatrix[1].xyz );
    float iry = atan( -instanceMatrix[0].z, instanceMatrix[0].x );
    vec4 bx = uBox[ int( aKol + 0.5 ) ];
    vec2 tc = cameraPosition.xz - ip.xz; float tl = length( tc );
    vec2 fh = tl > 1e-3 ? tc / tl : vec2( 0.0, 1.0 );
    vF = vec3( fh.x, 0.0, fh.y ); vR = vec3( fh.y, 0.0, -fh.x );
    float fr = fract( ( atan( fh.x, fh.y ) - iry ) / 6.2831853 ) * 8.0;
    vK0 = floor( fr ); vKf = fr - vK0; vK1 = mod( vK0 + 1.0, 8.0 ); vRad = aKol;
    float bredd = isx * bx.x, hn = clamp( position.y * bx.y, 0.0, 1.2 );
    vec3 transformed = ip + vR * position.x * bredd + vec3( 0.0, isy * ( bx.z + position.y * bx.y ), 0.0 );
    ${djup ? '// skuggkortet flyttas bort från ljuset bakom trädet: ingen självskugga på kortet mot kameran\n    transformed -= vF * bredd * 0.55;' : ''}
    float by = 0.6 + 0.4 * sin( uTid * 0.23 + ip.x * 0.05 ) * sin( uTid * 0.137 + ip.z * 0.05 + 1.3 );
    transformed.xz += uVind * hn * hn * isy * ( 0.012 * by + 0.003 * sin( uTid * 1.1 + ip.x * 0.3 + ip.z * 0.2 ) );
    vImpUv = vec2( position.x + 0.5, position.y ); vImpP = transformed;`;
  const IMP_PROJ = 'vec4 mvPosition = viewMatrix * vec4( transformed, 1.0 );\n    gl_Position = projectionMatrix * mvPosition;';
  const IMP_MAP = `
    vec2 ics = vec2( 0.125, 0.25 );
    vec2 iu0 = ( vec2( vK0, vRad ) + clamp( vImpUv, 0.004, 0.996 ) ) * ics, iu1 = ( vec2( vK1, vRad ) + clamp( vImpUv, 0.004, 0.996 ) ) * ics;
    vec4 tI = mix( texture2D( map, iu0 ), texture2D( map, iu1 ), vKf );
    // förmultiplicerad atlas: nästan tomma texlar kastas, och division med ett golv (annars förstärks
    // 8-bitarsbruset i kanterna till ljusa prickar)
    if ( tI.a < 0.06 ) discard;
    tI.rgb /= max( tI.a, 0.25 );
    { vec2 dd = fwidth( iu0 ) * ${IMP.toFixed(1)}; float dm = max( max( dd.x, dd.y ), 1e-4 ); tI.a *= 1.0 + max( log2( dm ), 0.0 ) * 0.4;
      // nära kameran: kanten fransas upp i fina, sneda barrstreck (finare än atlasens texlar), så att
      // skottens rundade spetsar inte står som en hård sågtandskant; kronans inre (alfa 1) rörs inte
      vec2 bq = vImpUv * vec2( 520.0, 1040.0 );
      float bn = fract( sin( dot( floor( vec2( bq.x + bq.y * 0.7, bq.y * 0.22 ) ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
      float bn2 = fract( sin( dot( floor( vec2( bq.x - bq.y * 0.7, bq.y * 0.22 ) ), vec2( 39.346, 11.135 ) ) ) * 24634.6345 );
      tI.a *= mix( 1.0, 0.62 + 0.7 * min( bn, bn2 + 0.25 ), clamp( 2.2 - dm, 0.0, 1.0 ) ); }
    diffuseColor *= tI;`;
  function impMaterial(A) {
    const U = { uImpN: { value: A.rtN.texture }, uBox: { value: A.box.concat([0, 0, 0, 0].map(() => new THREE.Vector4())).slice(0, 4) } };
    const m = new THREE.MeshLambertMaterial({ map: A.rtF.texture, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide });
    m.onBeforeCompile = s => {
      Object.assign(s.uniforms, U, { uTid: VU.uTid, uVind: VU.uVind, uNatt: VU.uNatt, miljoLjus: LJUS, uHus: VU.uHus });
      s.vertexShader = IMP_V + s.vertexShader
        .replace('#include <begin_vertex>', IMP_BEGIN(false))
        .replace('#include <project_vertex>', IMP_PROJ)
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4( transformed, 1.0 );');
      s.fragmentShader = 'uniform sampler2D uImpN;\nuniform vec4 uHus;\nuniform float uNatt;\nuniform vec3 miljoLjus;\nvarying vec2 vImpUv; varying vec3 vR; varying vec3 vF; varying float vK0; varying float vK1; varying float vKf; varying float vRad; varying vec3 vImpP;\n' + s.fragmentShader
        .replace('#include <map_fragment>', NARA_GLSL('vImpP') + IMP_MAP)
        .replace('#include <color_fragment>', '#include <color_fragment>\n    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.6, 0.68, 0.92 ), uNatt * 0.75 );   // natt: dovare och månblå\n    diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );   // natt: snön på grenarna dämpas (lyste som vitt brus mot de mörka kronorna)')
        .replace('#include <normal_fragment_begin>', `
    float faceDirection = 1.0;
    vec4 inp = mix( texture2D( uImpN, iu0 ), texture2D( uImpN, iu1 ), vKf );
    vec3 inb = mix( vec3( 0.0, 0.7, 0.7 ), inp.xyz / max( inp.w, 0.02 ) * 2.0 - 1.0, smoothstep( 0.1, 0.4, inp.w ) );
    vec3 inW = normalize( inb.x * vR + inb.y * vec3( 0.0, 1.0, 0.0 ) + inb.z * vF );
    // natt: inga ljusa kanter mot kameran – normalen dras mot rakt upp (månljus ovanifrån)
    inW = normalize( mix( inW, vec3( 0.0, 1.0, 0.0 ), uNatt * 0.6 ) );
    vec3 normal = normalize( ( viewMatrix * vec4( inW, 0.0 ) ).xyz );
    vec3 nonPerturbedNormal = normal;`)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
    };
    m.customProgramCacheKey = () => 'miljo-imp';
    const dj = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: A.rtF.texture, alphaTest: 0.5, side: THREE.DoubleSide });
    dj.onBeforeCompile = s => {
      Object.assign(s.uniforms, U, { uTid: VU.uTid, uVind: VU.uVind });
      s.vertexShader = IMP_V + s.vertexShader.replace('#include <begin_vertex>', IMP_BEGIN(true)).replace('#include <project_vertex>', IMP_PROJ);
      s.fragmentShader = 'varying vec2 vImpUv; varying vec3 vR; varying vec3 vF; varying float vK0; varying float vK1; varying float vKf; varying float vRad;\n' + s.fragmentShader.replace('#include <map_fragment>', IMP_MAP);
    };
    dj.customProgramCacheKey = () => 'miljo-imp-djup';
    return { m, dj };
  }
  // alla impostorträd i miljön: ett instansat kort per träd, ett ritanrop
  function impMesh(lista, arter, A) {
    if (!lista.length) return null;
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
    g.setAttribute('aKol', new THREE.InstancedBufferAttribute(new Float32Array(lista.map(e => Math.max(0, arter.indexOf(e.art)))), 1));
    const M = impMaterial(A);
    const m = instanser('impostortrad', g, M.m, lista, true, false);
    m.customDepthMaterial = M.dj; m.userData.egen = true; m.frustumCulled = false;
    A.mat = M;
    return m;
  }
  // de närmaste träden runt huset blir riktiga 3D-träd (bark + lövkort med fladder), resten impostorer
  function naraTrad(V, n = 3, rmax = 30) {
    const kand = V.barr.map((e, i) => ({ e, i, d: Math.hypot(e.x, e.z) })).filter(o => o.d < rmax).sort((a, b) => a.d - b.d).slice(0, n);
    const bort = new Set(kand.map(o => o.i));
    kand.forEach(({ e }) => {
      const A = art(e.art), s = e.hh / A.H;
      lagg(V.bark, A.bark, e.x, e.y, e.z, s, e.ry, A.H, 0.006);
      lagg(V.nara, A.lov, e.x, e.y, e.z, s, e.ry, A.H, 0.006, [e.c.r, e.c.g, e.c.b]);
    });
    V.barr = V.barr.filter((e, i) => !bort.has(i));
  }
  // bygger miljöns impostorer: bakar atlasen (en gång per miljö) och plockar ut de nära 3D-träden
  function traden(V, arter, nNara = 3) {
    naraTrad(V, nNara);
    const A = bakaAtlas(arter);
    return { mesh: behall(impMesh(V.barr, arter, A)), atlas: A };
  }

  // Referenshus för fjärrsetet: största modellen (12,5 × 7 m). Gång och altan kan ligga mot vilken
  // vägg som helst, så fjärrsetet håller ett band fritt framför alla fyra väggarna (10,5 m ut).
  const REF = (() => {
    const L = 12.5, W = 7, M = 1.6, D = 10.5;
    const blockerad = (x, z) => {
      const ax = Math.abs(x), az = Math.abs(z);
      return (ax < L / 2 + M && az > W / 2 - 0.1 && az < W / 2 + D) || (az < W / 2 + M && ax > L / 2 - 0.1 && ax < L / 2 + D);
    };
    return { L, W, blockerad };
  })();
  const behall = o => { if (o) o.userData.behall = true; return o; };   // överlever husbyten (städas i dispose)
  // snödriva: högre än förr (y ≈ 0,45–0,65 av storleken), sjunker lite ner i marken
  const driva = (lista, r, x, y, z, s) => lista.push({ m: matris(x, y - s * 0.16, z, s * (1.2 + r() * 0.6), s * (0.45 + r() * 0.2), s * (1 + r() * 0.5), r() * 6.28), c: variera('#f6f8fb', r, 0.01, 0.03, 0.03) });

  // Sätter ihop fjärrsetet F (packat en gång) och nära setet N till miljöns grupp, med samma
  // ritanrop som förut: varje material ritas en gång, fjärr- och närdelarna i samma buffert.
  // fjärrsetets bark, lövverk och markväxter: egna nät som byggs en gång per miljö (behålls vid
  // modellbyte; förr kopierades hela skogen in i nya buffertar och laddades upp vid varje hus)
  function fjarrNat(F) {
    if (!F.nat) {
      F.nat = [vegMesh('bark-fjarr', F.bark, mat('bark'), true, true), vegMesh('lov-fjarr', F.lov, mat('lov'), true, true), vegMesh('markvaxter-fjarr', F.mark, mat('vaxt'), false, true)].filter(Boolean).map(behall);
      F.bark = F.lov = F.mark = null;   // de packade arrayerna behövs inte längre
    }
    return F.nat;
  }
  function montera(namn, F, N) {
    const g = new THREE.Group(); g.name = namn;
    const liv = Object.assign({}, F.liv, { glod: glodMesh(N.glod) });
    [
      ...fjarrNat(F),
      vegMesh('bark', N.V.bark, mat('bark'), true, true),
      vegMesh('lov', [N.V.nara, N.V.fjarr], mat('lov'), true, true),
      vegMesh('markvaxter', N.V.mark, mat('vaxt'), false, true),
      vegMesh('grasmatta', N.V.matta, mat('matta'), false, true),
      F.barr,
      // tre grundformer av sten (varannan/var tredje får en annan)
      ...['sten', 'sten1', 'sten2'].map((k, j) => instanser('stenar' + (j || ''), geo(k), mat('sten'), N.sten.filter((e, i) => i % 3 === j), true, true)),
      instanser('stig', geo('platta'), mat('platta'), N.platta, false, true),
      instanser('drivor', geo('driva'), mat('driva'), F.drivor.concat(N.drivor), false, true),
      instanser('flackar', geo('flack'), mat('flack'), F.flack.concat(N.flack)),
      N.tramp,
      liv.faglar, liv.fall, liv.dimma, liv.glod,
    ].forEach(m => m && g.add(m));
    g.userData.liv = liv;
    return g;
  }
  const narSet = (V, flack) => ({ V, flack, sten: [], platta: [], drivor: [], glod: [], tramp: null });

  // ---- Trädgård ----
  // Komposition som en nordisk tomt: två låga fruktträd bakom huset, björkgrupper vid hörnen
  // på avstånd, ett stort lövträd som vårdträd, buskar vid hörnen, en låg häck och en sammanhållen trädridå.
  const ANG = [0.7, 0.74, 0.44];
  function platser(r, krav, upp) {
    const fri = (x, z, a) => upp.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.a + a) ** 2);
    const plats = (grad, d, klass, a) => {
      for (let i = 0; i < 14; i++) {
        const [x, z] = polar(grad + (r() - 0.5) * 6, d * (1 + i * 0.1));
        if (krav(x, z, klass) && fri(x, z, a)) { upp.push({ x, z, a }); return [x, z]; }
      }
      return null;
    };
    return { fri, plats };
  }
  function tradgardFjarr() {
    const r = slump(1101), { krav, S } = regler(REF), upp = [], { fri, plats } = platser(r, krav, upp);
    const hy = hojdTradgard, { V, flack, trad, vaxt } = verktyg(r, hy, REF.blockerad, false);
    const tuvring = (x, z, n, rad, smin, smax) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad; vaxt('gras', x + Math.cos(a) * d, z + Math.sin(a) * d, smin + r() * (smax - smin), ton(r, ANG)); } };
    const grupp = (grad, d, n, typ, hmin, hmax) => {
      const c = plats(grad, d, 'liten', 2.4); if (!c) return;
      trad(typ, c[0], c[1], hmin + r() * (hmax - hmin), 4.6); tuvring(c[0], c[1], 8, 1.6, 0.3, 0.5);
      for (let k = 1; k < n; k++) {
        const v = r() * 6.283, x = c[0] + Math.cos(v) * (2.6 + r() * 1.2), z = c[1] + Math.sin(v) * (2.6 + r() * 1.2);
        if (!krav(x, z, 'liten') || !fri(x, z, 2)) continue;
        upp.push({ x, z, a: 2 }); trad(typ, x, z, (hmin + r() * (hmax - hmin)) * 0.92, 4.2); tuvring(x, z, 6, 1.4, 0.3, 0.5);
      }
    };
    grupp(-142, S / 2 + 15, 4, 'bjork', 13, 16);
    grupp(-38, S / 2 + 18, 3, 'bjork', 12.5, 15);
    [[-100, S / 2 + 17], [36, 34 + S * 0.3]].forEach(([a, d]) => {
      const p = plats(a, d, 'stor', 5); if (!p) return;
      trad('lov', p[0], p[1], 11 + r() * 2, 7.5); tuvring(p[0], p[1], 10, 2.2, 0.32, 0.55);
    });
    // högre gräs bara i kanten där gräsmattan möter ängen (26–36 m)
    // ängen: högre gräs i fläckar (höjd och ton följer en mjuk brusfläck), glest med blommor
    for (let f = 0, n = 0; f < 9000 && n < 320; f++) {
      const [x, z] = polar(r() * 360, 25 + Math.pow(r(), 1.4) * 22);
      const b = fbm(x * 0.12, z * 0.12);
      if (!krav(x, z, 'tuva') || b < 0.43) continue;
      const torr = fbm(x * 0.05 + 7, z * 0.05);
      vaxt('gras', x, z, (0.26 + r() * 0.16) * (0.8 + (b - 0.43) * 1.6), ton(r, torr > 0.55 ? [0.8, 0.74, 0.46] : ANG, 0.1));
      n++;
    }
    for (let f = 0, n = 0; f < 3000 && n < 70; f++) {
      const [x, z] = polar(r() * 360, 26 + r() * 18);
      if (!krav(x, z, 'tuva') || fbm(x * 0.12 + 3, z * 0.12) < 0.5) continue;
      vaxt('blomma', x, z, 0.3 + r() * 0.12, ton(r, ANG));
      n++;
    }
    // trädgrupper på mellanavstånd och en sammanhållen trädridå (95–125 m), mest gran med inslag av löv
    [[-70, 55], [-160, 58], [150, 62], [20, 64]].forEach(([g0, d0]) => {
      for (let k = 0; k < 3; k++) { const [x, z] = polar(g0 + (r() - 0.5) * 8, d0 + (r() - 0.5) * 6); if (krav(x, z, 'stor')) trad('ek', x, z, 11 + r() * 2); }
    });
    for (let i = 0; i < 240; i++) {
      const a = (i + r() * 0.6) / 240 * Math.PI * 2, gles = fbm(Math.cos(a) * 2 + 20, Math.sin(a) * 2);
      if (gles < 0.3) continue;
      const d = 95 + r() * 28, x = Math.cos(a) * d, z = Math.sin(a) * d, k = 0.85 + gles * 0.3;
      if (r() < 0.7) trad('gran2', x, z, (16 + r() * 4) * k); else trad('ek', x, z, (11 + r() * 3) * k);
    }
    // björkgrupperna (~20 m) blir riktiga 3D-träd (~1k trianglar styck): som impostorer blev de
    // pixliga block när kameran stod nära
    const T = traden(V, ['bjork', 'gran', 'ek'], 8);
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor: [], upp,
      liv: { faglar: behall(faglar(r, 7)), fall: behall(fallande('lov')) },
    };
  }
  function tradgardNara(mal, F) {
    const { L, W } = mal, S = Math.max(L, W), r = slump(101), { krav, kant } = regler(mal), upp = F.upp.slice(), { fri, plats } = platser(r, krav, upp);
    const hy = hojdTradgard, { V, flack, trad, vaxt, matta } = verktyg(r, hy, mal.blockerad, false), N = narSet(V, flack);
    const GRON = [0.56, 0.7, 0.4];
    const tuvring = (x, z, n, rad, smin, smax) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad; vaxt('gras', x + Math.cos(a) * d, z + Math.sin(a) * d, smin + r() * (smax - smin), ton(r, ANG)); } };
    const frukter = [];
    [[-48, S / 2 + 5.5], [-146, S / 2 + 6]].forEach(([a, d]) => {
      const p = plats(a, d, 'liten', 3); if (!p) return;
      trad('frukt', p[0], p[1], 3.6 + r() * 1, 4.2); tuvring(p[0], p[1], 6, 1.2, 0.3, 0.45); frukter.push(p);
      for (let k = 0; k < 7; k++) { const v = r() * 6.283, dd = 0.6 + r() * 1.1; vaxt('blomma', p[0] + Math.cos(v) * dd, p[1] + Math.sin(v) * dd, 0.32 + r() * 0.1, ton(r, ANG)); }
    });
    // buskar vid husets bakre hörn och en låg häck norr om huset
    const busk = (x, z, s) => { if (kant(x, z) < 1.6 + s || !fri(x, z, s) || mal.blockerad(x, z, 1.4)) return; upp.push({ x, z, a: s }); trad('buske', x, z, s * 1.1, s * 3); tuvring(x, z, 4, s * 1.1, 0.25, 0.4); };
    [[-L / 2 - 2.4, -W / 2 - 2.0, 1.0], [-L / 2 - 3.5, -W / 2 - 0.5, 0.8], [L / 2 + 2.3, -W / 2 - 2.1, 0.9], [L / 2 + 1.1, -W / 2 - 3.1, 0.7]]
      .forEach(([x, z, s]) => busk(x, z, s * (0.92 + r() * 0.16)));
    for (let x = -L / 2 + 0.6; x < L * 0.2; x += 1.25) busk(x + (r() - 0.5) * 0.2, -W / 2 - 4.6 + (r() - 0.5) * 0.2, 0.66 + r() * 0.08);
    // stenar vid buskarna
    [[-L / 2 - 3.3, -W / 2 - 2.6], [L / 2 + 3.0, -W / 2 - 1.0], [-L / 2 - 6.8, -W / 2 - 4.6]]
      .forEach(([x, z]) => { const s = 0.2 + r() * 0.28; if (kant(x, z) > 0.9) N.sten.push({ m: matris(x, hy(x, z) + s * 0.02, z, s * 1.3, s * (0.8 + r() * 0.3), s, r() * 6.28, (r() - 0.5) * 0.14, (r() - 0.5) * 0.14), c: variera('#a8a49b', r, 0.02, 0.05, 0.1) }); });
    // gången: stora betongplattor med rundade kanter och gräs emellan, från trappan ut i en mjuk böj
    // en smal, låg grässträng mot singelbädden
    const gb = grundBredd(mal);
    for (let i = 0; i < 260; i++) {
      const t = r() * 2 * (L + W), d = gb + 0.04 + Math.pow(r(), 2) * 0.7, s = 0.12 + r() * 0.07;
      let x, z;
      if (t < L) { x = -L / 2 + t; z = -W / 2 - d; } else if (t < L + W) { x = L / 2 + d; z = -W / 2 + t - L; }
      else if (t < 2 * L + W) { x = L / 2 - (t - L - W); z = W / 2 + d; } else { x = -L / 2 - d; z = W / 2 - (t - 2 * L - W); }
      if (mal.blockerad(x, z, 0.62)) continue;
      vaxt('gras', x, z, s, ton(r, GRON));
    }
    // gräsmattans strån: färre men högre (10–18 cm) och mindre mättade
    matta(mal, kant, 2400, 0.1, 0.18, [0.64, 0.7, 0.5], gb);
    N.sten.forEach(e => { const p = new THREE.Vector3().setFromMatrixPosition(e.m); tuvring(p.x, p.z, 7, 0.75, 0.22, 0.4); });
    // kväll: stolplampor längs stigen och en ljusslinga i ett fruktträd (tänds sist)
    lampor(V.bark, N.glod, mal, hy, false);
    if (frukter.length) {
      // slingan hänger i 4 bågar (kedjekurvor) mellan grenpunkter runt kronan; några lampor inne i kronan
      const [fx, fz] = frukter[0], y0 = hy(fx, fz), fasten = [];
      for (let k = 0; k < 5; k++) { const a = k * 1.35 + r() * 0.5, rd = 1.3 + r() * 0.6; fasten.push([fx + Math.cos(a) * rd, y0 + 2.2 + r() * 0.8, fz + Math.sin(a) * rd]); }
      for (let b = 0; b < 4; b++) {
        const A = fasten[b], B = fasten[b + 1], n = 5 + (r() * 2 | 0), inne = r() < 0.35 ? 0.65 : 1;
        for (let i = 0; i < n; i++) {
          const q = (i + 0.5) / n, x = fx + (A[0] + (B[0] - A[0]) * q - fx) * inne, z = fz + (A[2] + (B[2] - A[2]) * q - fz) * inne;
          const y = A[1] + (B[1] - A[1]) * q - 0.25 * Math.sin(Math.PI * q), st = 0.7 + r() * 0.3;
          N.glod.push([x, y, z, 0.24 + r() * 0.12, 0, st, 0.78 * st, 0.42 * st, 0.55 + (b * n + i) * 0.004 + r() * 0.02]);
        }
      }
    }
    mat('flack').color.set('#26300f'); mat('flack').opacity = 0.75;
    return N;
  }

  // ---- Skog och Vinter (barrskog runt en glänta) ----
  function barrskogFjarr(sno) {
    const r = slump(sno ? 1303 : 1202), { krav } = regler(REF), upp = [], stro = stroare(r, krav, upp);
    const hy = sno ? hojdVinter : hojdSkog, { V, flack, trad } = verktyg(r, hy, REF.blockerad, sno), drivor = [];
    // björkgrupper om 2–4 i gläntans kant, ibland en ung björk (6–9 m)
    const bjorkgrupp = (typ, n) => stro(n, 10, 24, 5, 'liten').forEach(({ x, z }) => {
      trad(typ, x, z, 0, 4.2);
      const fler = 1 + (r() * 3 | 0);
      for (let k = 0; k < fler; k++) {
        const a = r() * 6.283, d = 1.8 + r() * 1.6, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
        if (krav(bx, bz, 'liten')) trad(typ, bx, bz, r() < 0.35 ? 6 + r() * 3 : 0, 3);
      }
    });
    // granar: en ring runt gläntan bakom huset, sedan tätare skog; i vintern en snövall vid stammen
    stro(sno ? 16 : 22, 12, 32, sno ? 4.2 : 3.8).forEach(({ x, z }) => {
      const h = sno ? 13 + r() * 5 : 15 + r() * 6;
      trad('gran0', x, z, h, h * 0.36);
      if (sno) driva(drivor, r, x + (r() - 0.5) * 0.6, hy(x, z), z + (r() - 0.5) * 0.6, 0.9 + r() * 0.8);
    });
    stro(sno ? 34 : 42, 28, 56, sno ? 4.6 : 4.3).forEach(({ x, z }) => {
      const h = sno ? 15 + r() * 5 : 17 + r() * 6;
      trad('gran1', x, z, h, h * 0.34);
      if (sno) driva(drivor, r, x + (r() - 0.5) * 0.6, hy(x, z), z + (r() - 0.5) * 0.6, 0.9 + r() * 0.8);
    });
    stro(sno ? 2 : 3, 14, 30, 5).forEach(({ x, z }) => trad('tall0', x, z, 16 + r() * 5, 4.5));
    stro(sno ? 5 : 7, 30, 48, 5).forEach(({ x, z }) => trad('tall1', x, z, 15 + r() * 5, 4.5));
    if (!sno) {
      bjorkgrupp('bjork', 3);                  // några björkar i gläntans kant gör skogen ljusare
    } else bjorkgrupp('bjorkKal', 3);          // kala björkar (inga torra strån: de såg ut som klistermärken)
    // skogsridå (52–92 m), enkla granar som tonas av diset
    for (let i = 0, n = sno ? 380 : 420; i < n; i++) {
      const a = (i + r()) / n * Math.PI * 2, d = 52 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const k = 0.75 + 0.5 * fbm(Math.cos(a) * 3 + 7, Math.sin(a) * 3);
      if (r() < (sno ? 0.08 : 0.14)) trad('tall1', x, z, (15 + r() * 6) * k); else trad('gran2', x, z, (12 + r() * 10) * k);
    }
    const T = traden(V, sno ? ['granSno', 'tallSno', 'bjorkKal'] : ['gran', 'tall', 'bjork'], 1);   // ett nära 3D-träd (trianglar)
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor, upp,
      liv: { fall: behall(fallande(sno ? 'sno' : 'barr')), dimma: sno ? null : behall(dimslojor(r, krav)) },
    };
  }
  function barrskogNara(mal, F, sno) {
    const r = slump(sno ? 303 : 202), { krav, kant } = regler(mal), upp = F.upp;
    const hy = sno ? hojdVinter : hojdSkog, { V, flack, vaxt, matta } = verktyg(r, hy, mal.blockerad, sno), N = narSet(V, flack);
    if (!sno) {
      // kruståtel i gläntan
      // i klungor: en tät mitt som glesnar utåt, olika gröna/halmgula toner per klunga
      for (let f = 0, n = 0; f < 4000 && n < 380; f++) {
        const [cx, cz] = polar(r() * 360, 9 + r() * 22);
        if (!krav(cx, cz, 'tuva') || fbm(cx * 0.15, cz * 0.15) < 0.45) continue;
        const k = 5 + (r() * 9 | 0), rad = 0.5 + r() * 1.1, bas = r() < 0.35 ? [0.74, 0.68, 0.4] : r() < 0.6 ? [0.58, 0.66, 0.4] : [0.66, 0.66, 0.42];
        for (let j = 0; j < k; j++) {
          const a = r() * 6.283, d = Math.pow(r(), 1.6) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
          if (!krav(x, z, 'tuva')) continue;
          vaxt('gras', x, z, (0.2 + r() * 0.26) * (1 - 0.4 * d / rad), ton(r, bas, 0.14));
          n++;
        }
      }
      matta(mal, kant, 900, 0.08, 0.15, [0.62, 0.68, 0.43], grundBredd(mal));
      // blåbärsris i fläckar
      for (let f = 0, n = 0; f < 600 && n < 26; f++) {
        const [cx, cz] = polar(r() * 360, 8 + r() * 32);
        if (!krav(cx, cz, 'lag')) continue;
        for (let k = 0; k < 11; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * 1.7; vaxt('blabar', cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.55 + r() * 0.4, ton(r, ETT)); }
        n++;
      }
      // ormbunkar i skuggan
      for (let f = 0, n = 0; f < 3000 && n < 70; f++) {
        const [x, z] = polar(r() * 360, 9 + r() * 34);
        if (!krav(x, z, 'lag') || !upp.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.a * 0.3 + 0.8) ** 2)) continue;
        vaxt('ormbunke', x, z, 0.7 + r() * 0.5, ton(r, [0.9, 0.96, 0.86]));
        n++;
      }
    }
    // stenblock (mossiga i skogen, snötäckta drivor i vintern)
    for (let f = 0, n = 0; f < 2000 && n < (sno ? 12 : 14); f++) {
      const [x, z] = polar(r() * 360, 9 + r() * 32);
      if (!krav(x, z, 'lag') || Math.hypot(x, z) < 11) continue;
      const s = 0.4 + r() * 1.0, y = hy(x, z);
      if (sno) driva(N.drivor, r, x, y + s * 0.15, z, s * 1.1);
      else N.sten.push({ m: matris(x, y, z, s * (1.1 + r() * 0.4), s * (0.75 + r() * 0.4), s * (0.9 + r() * 0.3), r() * 6.28, (r() - 0.5) * 0.14, (r() - 0.5) * 0.14), c: variera(r() > 0.4 ? '#97928a' : '#858a72', r, 0.02, 0.08, 0.1) });   // granitgrå, några med mossa
      n++;
    }
    if (sno) { mat('flack').color.set('#5d7096'); mat('flack').opacity = 0.6; } else { mat('flack').color.set('#1d2010'); mat('flack').opacity = 0.8; }
    // skogen: gång av natursten (gråare, mer oregelbunden); i vintern ligger gången under snön (trampad)
    // kväll: stolplampor längs gången i båda; skogen får dessutom varm dis kring gången närmast huset
    lampor(V.bark, N.glod, mal, hy, sno, !sno);
    return N;
  }

  // ---- grunden: singelbädd (eller snövall) och kontaktskugga runt sockeln ----
  const grundBredd = ({ L, W }) => Math.min(0.6, Math.max(0.35, 0.3 + 0.011 * (L + W)));
  // punkter runt en rundad rektangel: [x, z, nx, nz]; avståndet d läggs på längs (nx, nz)
  function omkrets(hx, hz, steg = 0.3, nb = 6) {
    const pts = [];
    const sida = (x0, z0, x1, z1, nx, nz) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / steg)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz]); } };
    const horn = (cx, cz, a0) => { for (let i = 0; i < nb; i++) { const a = a0 + i / nb * Math.PI / 2; pts.push([cx, cz, Math.cos(a), Math.sin(a)]); } };
    sida(hx, -hz, hx, hz, 1, 0); horn(hx, hz, 0);
    sida(hx, hz, -hx, hz, 0, 1); horn(-hx, hz, Math.PI / 2);
    sida(-hx, hz, -hx, -hz, -1, 0); horn(-hx, -hz, Math.PI);
    sida(-hx, -hz, hx, -hz, 0, -1); horn(hx, -hz, Math.PI * 1.5);
    return pts;
  }
  // rader: [avstånd, ojämnhet] ; fn(d, x, z) => [y, r, g, b, a?]
  // upp(d0) = 0..1: hur mycket radens normal vrids mot rakt upp (kanten smälter in i marken)
  function ringGeo(hx, hz, rader, fn, fro, upp = null) {
    const P = omkrets(hx, hz), n = P.length, pos = [], uv = [], col = [], idx = [];
    const brus = P.map((p, i) => (brus3(i * 0.37, fro, 0.5) * 0.7 + brus3(i * 1.3, fro + 3, 0.5) * 0.3) * 2 - 1);
    let alfa = false;
    rader.forEach(([d0, jit]) => P.forEach(([x0, z0, nx, nz], i) => {
      const d = d0 + jit * brus[i], x = x0 + nx * d, z = z0 + nz * d, f = fn(d0, d, x, z);
      pos.push(x, f[0], z); uv.push(x, z); col.push(f[1], f[2], f[3]);
      if (f.length > 4) { col.push(f[4]); alfa = true; }
    }));
    for (let k = 0; k < rader.length - 1; k++) for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, e = (k + 1) * n + (i + 1) % n;
      idx.push(a, b, c, b, e, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, alfa ? 4 : 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (upp) {
      const nr = g.attributes.normal;
      rader.forEach(([d0], k) => {
        const t = upp(d0); if (t <= 0) return;
        for (let i = 0; i < n; i++) {
          const j = k * n + i, x = nr.getX(j) * (1 - t), y = nr.getY(j) * (1 - t) + t, z = nr.getZ(j) * (1 - t), l = Math.hypot(x, y, z) || 1;
          nr.setXYZ(j, x / l, y / l, z / l);
        }
      });
    }
    g.computeBoundingSphere();
    return g;
  }
  const lin = (pkt, d) => {           // styckvis linjär profil
    if (d <= pkt[0][0]) return pkt[0][1];
    for (let i = 1; i < pkt.length; i++) if (d <= pkt[i][0]) { const [a, ya] = pkt[i - 1], [b, yb] = pkt[i]; return ya + (yb - ya) * (d - a) / (b - a); }
    return pkt[pkt.length - 1][1];
  };
  function byggGrund(namn, mal) {
    grundGrupp.children.forEach(o => o.geometry.dispose());
    grundGrupp.clear();
    const d = DEF[namn], G = d.grund, hx = mal.L / 2, hz = mal.W / 2;
    const w = G.bredd || grundBredd(mal);
    let yProfil;
    if (G.sno) {
      // snövall som lutar mot sockeln, med blåaktig skugga närmast väggen
      const pkt = [[-0.04, 0.2], [0.05, 0.17], [0.2, 0.11], [0.4, 0.05], [0.62, 0.012], [0.9, -0.012]];
      yProfil = dd => lin(pkt, dd);
      const vall = new THREE.Mesh(ringGeo(hx, hz, [[-0.04, 0], [0.05, 0.02], [0.2, 0.05], [0.4, 0.08], [0.62, 0.12], [0.9, 0.16]], (d0, dd, x, z) => {
        if (mal.trappa && mal.trappa(x, z)) return [-0.012, 1, 1, 1];   // under trappan: ingen vall (stegen svävade)
        // samma material som marken (färgvariationen samplas per pixel i världen), så ytterkanten får
        // exakt markens färg (vit hörnfärg) och normal (rakt upp): ingen ljus ram där vallen möter snön
        const m = 0.8 + 0.2 * mjuk(-0.04, 0.5, dd), ut = mjuk(0.35, 0.62, d0);
        return [yProfil(dd), 1 + (m * 0.97 - 1) * (1 - ut), 1 + (m * 0.98 - 1) * (1 - ut), 1 + (0.9 + 0.1 * m - 1) * (1 - ut)];
      }, 7, d0 => mjuk(0.25, 0.62, d0)), byggda[namn].mat);
      vall.name = 'snovall'; vall.receiveShadow = true; vall.matrixAutoUpdate = false;
      grundGrupp.add(vall);
    } else {
      // singelbädd: mörkare närmast sockeln, mjukt utfransad mot marken
      const pkt = [[-0.04, 0.032], [w, 0.012], [w + 0.16, 0.003], [3, 0.003]];
      yProfil = dd => lin(pkt, dd);
      const grus = new THREE.Mesh(ringGeo(hx, hz, [[-0.04, 0], [0.07, 0], [w * 0.55, 0.02], [w, 0.06], [w + 0.16, 0.1]], (d0, dd) => {
        const s = d0 < 0 ? 0.72 : d0 < 0.1 ? 0.84 : d0 < w * 0.6 ? 1 : 0.97;
        return [yProfil(dd), s, s, s, d0 > w + 0.1 ? 0 : 1];
      }, 7), mat('grus'));
      mat('grus').userData.ton = G.ton;
      grus.name = 'singel'; grus.receiveShadow = true; grus.matrixAutoUpdate = false; grus.renderOrder = 1;
      grundGrupp.add(grus);
    }
    // kontaktskugga: mörkast i hörnet mellan sockel och mark, mjukt avtagande ut till ~1,9 m
    const a0 = G.styrka, ao = G.ao;
    const rader = [[-0.03, 0.62], [0.02, 0.52], [0.1, 0.34], [0.24, 0.19], [0.45, 0.1], [0.8, 0.045], [1.3, 0.015], [1.9, 0]];
    const kont = new THREE.Mesh(ringGeo(hx, hz, rader.map(([dd], i) => [dd, i > 3 ? 0.12 : 0]), (d0, dd, x, z) => {
      const a = lin(rader, d0) * a0 * (G.sno ? 1 : 0.25 + 0.75 * mjuk(0.3, 0.9, d0)); // motorns egen rand täcker 0–0,85 m
      const tr = G.sno && mal.trappa && mal.trappa(x, z, 0.25);
      return [Math.max(tr ? 0 : yProfil(dd), 0) + 0.004, ao.r, ao.g, ao.b, tr ? a * 0.25 : a];   // aldrig under marken (annars hård kant där vallen slutar)
    }, 11), mat('ao'));
    kont.name = 'kontaktskugga'; kont.renderOrder = 2; kont.matrixAutoUpdate = false;
    grundGrupp.add(kont);
  }

  // ---- tillstånd ----
  const byggda = {};
  let aktuell = 'studio', kuliss = null, nyckel = '';
  const tillstand = { kvall: 0, mork: false, sol: null, gry: 0 };

  function hamta(namn) {
    if (byggda[namn]) return byggda[namn];
    const d = DEF[namn], [g, m] = d.mark();
    spara(m);
    return (byggda[namn] = { geo: g, mat: m });
  }
  function matt(H) {
    const L = Math.max(1, +(H && H.L) || 10), W = Math.max(1, +(H && H.W) || 6);
    const op = H && Array.isArray(H.oppningar) ? H.oppningar : [];
    // väggens system som i motorn: u längs väggen sett utifrån (från vänster), n ut från väggen
    const vp = (sd, u, n) => sd === 'S' ? [-L / 2 + u, W / 2 + n] : sd === 'N' ? [L / 2 - u, -W / 2 - n] : sd === 'E' ? [L / 2 + n, W / 2 - u] : [-L / 2 - n, -W / 2 + u];
    const NV = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
    // huvuddörren som motorns vägglampa: första 'd' (S, N, E, W), annars 'dg', annars skjutdörr i söder
    const hitta = typ => { for (const s of ['S', 'N', 'E', 'W']) { const o = op.find(o => o[0] === s && o[5] === typ); if (o) return o; } return null; };
    const o = hitta('d') || hitta('dg') || op.find(o => o[0] === 'S' && o[5] === 'sk');
    let dorr = { x: 0, z: W / 2, nx: 0, nz: 1 };
    if (H && Number.isFinite(H.dorrX)) dorr.x = H.dorrX;
    else if (o && NV[o[0]]) { const [x, z] = vp(o[0], o[1] + o[2] / 2, 0); dorr = { x, z, nx: NV[o[0]][0], nz: NV[o[0]][1] }; }
    dorr.x = Math.round(dorr.x * 100) / 100; dorr.z = Math.round(dorr.z * 100) / 100;
    // altanen som i motorns altanMatt, med trappsteg och 0,5 m marginal
    let dack = null;
    const sd = H && H.altan;
    if (sd && NV[sd]) {
      const kand = op.filter(k => k[0] === sd && k[3] < 0.25 && k[4] > 1.8 && k[5] !== 'd');
      if (kand.length) {
        const k = kand.find(k => k[5] === 'sk') || kand.slice().sort((a, b) => b[2] - a[2])[0];
        const vl = sd === 'S' || sd === 'N' ? L : W, bred = Math.min(vl, Math.max(2.8, k[2] + 1.5));
        const u0 = Math.max(0, Math.min(vl - bred, k[1] + k[2] / 2 - bred / 2)), dj = (vl <= 4.5 ? 3 : 3.5) + 0.6, M = 0.5;
        const a = vp(sd, u0 - M, -0.2), b = vp(sd, u0 + bred + M, dj + M);
        dack = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
      }
    }
    // Gången: mittlinjen från trappan ut mot infarten, en mjuk böj (smoothstep, 1,2 m i sidled
    // på 8 m) bort från altanen, annars in mot husets mitt. Plattor, pollare, nertrampad snö och
    // den fria korridoren (blockerad) följer samma kurva.
    const gtx = -dorr.nz, gtz = dorr.nx;
    let gsid = -(dorr.x * gtx + dorr.z * gtz);
    if (dack) gsid = -(((dack.x0 + dack.x1) / 2 - dorr.x) * gtx + ((dack.z0 + dack.z1) / 2 - dorr.z) * gtz);
    const GB = 1.2 * (gsid < 0 ? -1 : 1), GT0 = 1.15, GT1 = 9.2;
    const goff = t => { const u = Math.min(1, Math.max(0, (t - GT0) / (GT1 - GT0))); return GB * u * u * (3 - 2 * u); };
    const gder = t => { const u = (t - GT0) / (GT1 - GT0); return u <= 0 || u >= 1 ? 0 : GB * 6 * u * (1 - u) / (GT1 - GT0); };
    const gang = {
      T0: GT0, T1: GT1, tx: gtx, tz: gtz, off: goff,
      punkt: (t, o = 0) => { const l = goff(t) + o; return [dorr.x + dorr.nx * t + gtx * l, dorr.z + dorr.nz * t + gtz * l]; },
      // vridning (som ry) för något som ligger längs gången
      vinkel: t => { const d = gder(t); return Math.atan2(dorr.nx + gtx * d, dorr.nz + gtz * d); },
    };
    // övriga ytterdörrar med trappsteg (inte på altanen): en kort stig rakt ut från varje
    const sidodorrar = [];
    op.forEach(k => {
      if (k === o || !NV[k[0]] || !(k[5] === 'd' || k[5] === 'dg' || k[5] === 'sk')) return;
      const [x, z] = vp(k[0], k[1] + k[2] / 2, 0), [px, pz] = vp(k[0], k[1] + k[2] / 2, 0.5);
      if (dack && px > dack.x0 && px < dack.x1 && pz > dack.z0 && pz < dack.z1) return;
      sidodorrar.push({ x, z, nx: NV[k[0]][0], nz: NV[k[0]][1] });
    });
    // husets höjd med tak (för att hålla snö och löv ute)
    const top = 0.22 + Math.max(3.2, ...['hr', 'hS', 'hN', 'he'].map(k => +(H && H[k]) || 0), +(H && H.kupa && H.kupa.hk) || 0) + 0.45;
    // blockerad: på altanen eller i gången från dörren (bredd = halv gångbredd)
    const blockerad = (x, z, bredd = 1.25) => {
      if (dack && x > dack.x0 && x < dack.x1 && z > dack.z0 && z < dack.z1) return true;
      const ax = x - dorr.x, az = z - dorr.z, langs = ax * dorr.nx + az * dorr.nz;
      if (langs > -0.4 && langs < 9.8 && Math.abs(-ax * dorr.nz + az * dorr.nx - goff(langs)) < bredd) return true;
      return sidodorrar.some(d => { const bx = x - d.x, bz = z - d.z, l = bx * d.nx + bz * d.nz; return l > -0.4 && l < 3.6 && Math.abs(-bx * d.nz + bz * d.nx) < Math.min(bredd, 0.95); });
    };
    // trappan vid huvuddörren (motorns steg når 1,05 m ut och är lite bredare än dörren)
    const tb = (o ? o[2] : 1) / 2 + 0.4;
    const trappa = (x, z, m = 0) => { const ax = x - dorr.x, az = z - dorr.z, langs = ax * dorr.nx + az * dorr.nz; return langs > -0.3 && langs < 1.15 + m && Math.abs(-ax * dorr.nz + az * dorr.nx) < tb + m; };
    return { L, W, dx: dorr.x, dorr, dack, top, blockerad, trappa, gang, sidodorrar };
  }


  let livObj = {}, livPa = true, senast = null;
  const tmpV = new THREE.Vector3(), DIMMA_DAG = C('#e4ebe6'), SNO_NATT = C('#9aaacc');
  function uppdatera(arg = {}) {
    if (arg.kvall !== undefined) tillstand.kvall = Math.max(0, Math.min(1, +arg.kvall || 0));
    if (arg.mork !== undefined) tillstand.mork = !!arg.mork;
    if (arg.gryning !== undefined) tillstand.gry = Math.max(0, Math.min(1, +arg.gryning || 0));   // 1 = gryning (6:00), 0 efter 8:30
    if (arg.sol && arg.sol.isVector3) tillstand.sol = arg.sol.clone().normalize();
    if (arg.inne !== undefined) VU.uInne.value = arg.inne ? 1 : 0;   // valfritt: kameran är inne i huset
    const d = DEF[aktuell], b = byggda[aktuell], kv = tillstand.kvall, mork = tillstand.mork;
    const gry = tillstand.gry, guldKv = mjuk(0, 0.45, kv) * (1 - mjuk(0.55, 1, kv));
    const guld = Math.max(guldKv, gry * 0.7), natt = mjuk(0.35, 1, kv) * 0.94;
    const G = gry > guldKv ? GRY : GULD;      // morgonen: svalare rosa-persika i stället för kvällens bärnsten
    const skym = mjuk(0.3, 0.65, kv) * (1 - 0.55 * mjuk(0.8, 1, kv));      // glöd vid horisonten där solen gick ner
    const lampa = mjuk(0.42, 0.88, kv);
    if (d.himmel) {
      const steg = s => { const c = d.himmel[s].clone(); if (s === 'hor') c.multiplyScalar(0.9); else if (s === 'mid') c.multiplyScalar(0.96); if (mork) c.lerp(MORK, 0.62); return c.lerp(G[s], guld * (s === 'hor' ? 0.75 : 0.5)).lerp(KV[s], natt); };
      const top = steg('top'), mid = steg('mid'), hor = steg('hor'), ca = himmelGeo.attributes.color, t = new THREE.Color(), varm = C('#ffe2bf');
      const sol = tillstand.sol, sx = sol ? sol.x : 0, sz = sol ? sol.z : 0, sl = Math.hypot(sx, sz) || 1;
      for (let i = 0; i < himmelT.length; i++) {
        const y = himmelT[i];
        if (y < 0.1) t.copy(hor).lerp(mid, mjuk(0, 0.1, y));
        else t.copy(mid).lerp(top, Math.pow((y - 0.1) / 0.9, 0.6));
        tmpV.fromBufferAttribute(hpos, i).normalize();
        if (sol) t.lerp(varm, Math.pow(Math.max(0, tmpV.dot(sol)), 8) * (0.35 + guld * 0.4) * (1 - natt));
        if (sol && guld > 0.01 && y < 0.3) {
          const hl = Math.hypot(tmpV.x, tmpV.z) || 1, rikt = Math.max(0, (tmpV.x * sx + tmpV.z * sz) / (hl * sl));
          band.copy(MJUKBLA).lerp(PERSIKA, Math.pow(rikt, 1.4)).lerp(BARNSTEN, Math.pow(rikt, 9));
          t.lerp(band, guld * (1 - mjuk(0, 0.3, y)) * (0.45 + 0.45 * rikt) * (1 - natt));
        }
        if (sol && skym > 0) {
          const hl = Math.hypot(tmpV.x, tmpV.z) || 1, rikt = Math.max(0, (tmpV.x * sx + tmpV.z * sz) / (hl * sl));
          t.lerp(SKYMNING, Math.pow(rikt, 3) * (1 - mjuk(0, 0.32, y)) * skym * 0.75);
        }
        ca.setXYZ(i, t.r, t.g, t.b);
      }
      ca.needsUpdate = true;
      bg.copy(hor);
      HU.molnMangd.value = (d.moln || 0) * (1 - natt * 0.6);
      HU.molnFarg.value.set('#ffffff').lerp(hor, 0.25).lerp(C('#f3c6a6'), guld * 0.6).lerp(C('#2e3550'), natt);
      if (mork) HU.molnFarg.value.lerp(MORK, 0.5);
    } else {
      bg.copy(mork ? MORK : d.bg).lerp(d.kvallBg, kv * 0.92);
    }
    VU.uStjarnor.value = d.himmel ? mjuk(0.6, 0.95, kv) * 1.1 : 0;
    // solskivan (dag till tidig kväll; solljusets riktning glider mot månen efter kvall 0,6) och månen
    if (tillstand.sol) HU.uSolD.value.copy(tillstand.sol);
    HU.uSolSyn.value = d.himmel && tillstand.sol ? (1 - mjuk(0.48, 0.6, kv)) * (mork ? 0.6 : 1) * (aktuell === 'studio' ? 0.5 : 1) : 0;
    HU.uSolF.value.set('#fff6e6').lerp(C('#ffc98a'), Math.max(guld, mjuk(0, 0.4, kv)));
    HU.uManeSyn.value = d.himmel ? mjuk(0.58, 0.95, kv) * (mork ? 0.7 : 1) : 0;
    VU.uGnistra.value = aktuell === 'vinter' ? mjuk(0.55, 0.9, kv) * 0.9 : 0;
    VU.uPool.value = mjuk(0.6, 0.9, kv);
    VU.uGlod.value.setRGB(1, 0.66, 0.34).lerp(VARMLAMPA, VU.uPool.value).multiplyScalar(2.2);
    VU.uLampa.value = lampa;
    VU.uNatt.value = natt;                                                // varje lampa tänds efter sin fördröjning
    VU.uGlitter.value = aktuell === 'vinter' ? 1 - natt : 0;
    dimma.color.copy(bg);
    if (d.dimma) dimma.near = d.dimma[0] * (1 - 0.3 * gry);   // morgondis
    LJUS.value.copy(d.ljus).multiplyScalar((mork ? 0.6 : 1) * (1 - kv * 0.6) * 0.55).lerp(d.maane || MAANE, natt * (d.maaneStyrka || 0.75));
    if (tillstand.sol) VU.uSol.value.copy(tillstand.sol);
    // genomlysningen i löv och gräs blir varmare i lågt ljus (gyllene timmen)
    VU.uSSS.value.setRGB(0.42 + 0.24 * guld, 0.5 - 0.1 * guld, 0.12 - 0.04 * guld).multiplyScalar(0.5 * (mork ? 0.6 : 1) * (1 - kv) * (tillstand.sol ? mjuk(-0.02, 0.2, tillstand.sol.y) : 1));
    const golv = s => s.setScalar(mork ? d.morkMark : 1).lerp(KVALLSGOLV, kv * 0.7);
    if (b) golv(b.mat.color);
    if (MAT.tramp) golv(MAT.tramp.color);
    if (MAT.sten) golv(MAT.sten.color);      // stenarna mörknar som marken (lyste ljusgrå i kvällsmörkret)
    if (b && b.mat.emissive && aktuell === 'vinter') b.mat.emissive.set('#1a2438').lerp(C('#2a313d'), natt);
    if (MAT.driva) { MAT.driva.emissive.set('#141c2c').lerp(C('#262d38'), natt); golv(MAT.driva.color); }   // drivorna mörknar som marken (lyste som vita plättar på natten)
    if (MAT.grus && MAT.grus.userData.ton) { golv(MAT.grus.color); MAT.grus.color.multiply(MAT.grus.userData.ton); }
    // livet följer kvällen (färg och synlighet, ingen rörelse här)
    if (livObj.faglar) livObj.faglar.visible = natt < 0.6 && !(livObj.glod && lampa > 0.001);   // aldrig samtidigt som lampglöden (14 anrop)
    // natt: snön blir månblå; barr och löv blir mörka (inte grå – de syntes som ljusa prickar mot de mörka kronorna)
    if (livObj.fall) { const fm = livObj.fall.material.color.setScalar(1); if (aktuell === 'vinter') fm.lerp(SNO_NATT, natt).multiplyScalar(1 - natt * 0.45); else fm.multiplyScalar(1 - natt * 0.85); }
    if (livObj.dimma) { livObj.dimma.material.color.copy(DIMMA_DAG).lerp(bg, 0.3).multiplyScalar(1 - natt * 0.75); livObj.dimma.material.opacity = 0.3 * (1 - natt * 0.85); }   // natt: slöjorna lyste igenom kronornas glipor som ljusa prickar
    if (livObj.glod) livObj.glod.visible = lampa > 0.001;
  }

  function satt(namn, H) {
    if (!DEF[namn]) namn = 'studio';
    const mal = matt(H); mal.namn = namn;
    const ny = [namn, mal.L, mal.W, mal.dorr.x, mal.dorr.z, mal.dorr.nx, mal.dorr.nz, mal.dack ? Object.values(mal.dack).map(v => v.toFixed(2)).join(',') : '-', mal.top.toFixed(2)].join('|');
    VU.uHus.value.set(mal.L / 2, mal.W / 2, mal.top, 0);
    if (ny === nyckel) return;
    bil.planera(mal, H);                     // bilens plats; utökar mal.blockerad innan naturen placeras
    nyckel = ny; aktuell = namn;
    const d = DEF[namn], b = hamta(namn);
    mark.geometry = b.geo; mark.material = b.mat;
    himmel.visible = !!d.himmel;
    studioRida.visible = !!d.rida;
    dimma.near = d.dimma[0]; dimma.far = d.dimma[1];
    scene.fog = dimma; scene.background = bg;
    slapp();
    if (d.fjarr) {
      // fjärrsetet (träd, ridå, äng, liv) byggs en gång per miljö; vid modellbyte byggs bara nära setet
      if (!FJ[namn]) {
        const andra = FJ_ORD.filter(k => k !== namn && FJ[k]);
        while (andra.length >= 2) slappFJ(andra.shift());    // högst två miljöer i grafikminnet
        FJ[namn] = d.fjarr();
      }
      const F = FJ[namn];
      FJ_ORD.splice(0, FJ_ORD.length, ...FJ_ORD.filter(k => k !== namn), namn);
      kuliss = montera(namn, F, d.nara(mal, F)); kuliss.matrixAutoUpdate = false; rot.add(kuliss); livObj = kuliss.userData.liv || {};
    }
    VU.uSno.value = namn === 'vinter' ? 1 : 0;
    VU.uVind.value.set(0.94, 0.33).multiplyScalar(d.vind || 0);
    byggGrund(namn, mal);
    mal.hy = d.hojd || (() => 0);            // markens höjd, så att uppfarten följer backarna
    bil.satt(namn, mal);
    bebott.satt(namn, mal, bil.plats());
    uppdatera();
    renderer.shadowMap.needsUpdate = true;
  }
  function slapp() {
    if (!kuliss) return;
    rot.remove(kuliss);
    kuliss.traverse(o => {
      if (o.userData.behall) return;                         // fjärrsetets delar lever kvar till dispose()
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.egen && o.geometry) o.geometry.dispose(); // även klonad geometri i instansade nät
    });
    kuliss.clear(); kuliss = null; livObj = {};
  }
  const FJ = {}, FJ_ORD = [];                                 // fjärrset per miljö, senast använda sist
  function slappFJ(k) {
    const F = FJ[k];
    if (!F) return;
    [F.barr, ...(F.nat || []), ...Object.values(F.liv)].forEach(o => { if (!o) return; if (o.isInstancedMesh) o.dispose(); if (o.geometry) o.geometry.dispose(); });
    if (F.atlas) { F.atlas.rtF.dispose(); F.atlas.rtN.dispose(); if (F.atlas.mat) { F.atlas.mat.m.dispose(); F.atlas.mat.dj.dispose(); } }
    delete FJ[k];
    const i = FJ_ORD.indexOf(k); if (i >= 0) FJ_ORD.splice(i, 1);
  }

  // ---- liv ----
  // tick(sekunder): klocktid i sekunder; uTid går fram med skillnaden (högst 0,25 s per steg).
  function tick(sek) {
    if (!livPa || !Number.isFinite(sek)) return;
    if (senast !== null) { let dt = sek - senast; if (dt < 0 || dt > 0.25) dt = 1 / 30; VU.uTid.value += dt; }
    senast = sek;
  }
  const harLiv = () => livPa && !!DEF[aktuell].liv;
  function satLiv(pa) { livPa = !!pa; senast = null; }

  function statistik() {
    let anrop = 0, trianglar = 0;
    rot.traverseVisible(o => {
      if (o.isPoints) { anrop++; return; }
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      anrop++; trianglar += t * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1);
    });
    return { anrop, trianglar: Math.round(trianglar) };
  }

  function dispose() {
    slapp();
    bil.dispose(); bebott.dispose();
    Object.keys(FJ).forEach(slappFJ);
    grundGrupp.children.forEach(o => o.geometry.dispose());
    grundGrupp.clear();
    scene.remove(rot);
    skrap.forEach(o => o && o.dispose && o.dispose());
    skrap.length = 0;
    [TX, MAT, GEO, VAR, byggda].forEach(c => { for (const k in c) delete c[k]; });
    kuliss = null; livObj = {}; nyckel = '';
    if (scene.fog === dimma) scene.fog = null;
    if (scene.background === bg) scene.background = null;
  }

  return { satt, uppdatera, lista, statistik, dispose, tick, harLiv, satLiv };
}
