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
import { skapaBil } from './husritare-bil.js?v=20261126u';   // elbilen med laddbox vid entrén
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';   // 3D-grästuvorna (images/3d/gras-tuvor.glb)
import { skapaBebott, uteGrupper } from './husritare-bebott.js?v=20261126u';   // spår av folk som bor där: brevlåda, cykel, grill …
import { skapaVaxtPaket } from './husritare-vaxter.js?v=20261126u';   // fotoskannade gräs och markväxter (images/3d/vaxt-paket.bin)
import { skapaOmgivning, villaSkog } from './husritare-omgivning.js?v=20261126u';   // lekplats, park, fler kvarter, liv och skogsbryn i villaområdet
import { skapaFab } from './husritare-fab.js?v=20261126u';   // fria Fab-modeller: björkar, eka, odlingsbädd, uteplats, kantsten (CC BY)
import { skapaNatur } from './husritare-natur.js?v=20261126u';   // fotoskannad skogsmark (Poly Haven, CC0): ormbunkar, mossa, stenblock, stubbar, stockar
import { skapaBlommor } from './husritare-blommor.js?v=20261126u';   // riktiga trädgårdsblommor och rabatter (målad atlas, ett ritanrop)
import { ph } from './husritare-ph.js?v=20261126u';   // Poly Haven-rekvisita (CC0) i villaområdet: gatlyktor, brunnslock, sopkärl, slang, krukor, nisse, utemöbler
import { skapaFolk } from './husritare-folk.js?v=20261126u';   // riktiga animerade människor (City People, The Sound Guy), laddas lat
import { skapaSjo } from './husritare-sjo.js?v=20261126u';   // vid sjön: vattnet (spegling, vågor, djup), holmarna och sjötomtens detaljer

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
// kör en generator (stegvist bygge) till slutet i ett svep
const korG = g => { let st; while (!(st = g.next()).done); return st.value; };
function duk(n, m = n, las = false) { const c = document.createElement('canvas'); c.width = n; c.height = m; return [c, c.getContext('2d', las ? { willReadFrequently: true } : undefined)]; }   // las: läses tillbaka (atlas): duken ritas i processorn, getImageData väntar inte på grafikprocessen
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
  const lista = [['studio', 'Studio'], ['tradgard', 'Trädgård'], ['skog', 'Skog'], ['vinter', 'Vinter'], ['kust', 'Vid sjön'], ['villa', 'Villaområde']];
  const cap = renderer.capabilities || {};
  // MSAA på duken: då får löv- och barrkort alphaToCoverage (mjuka, stabila kanter); utan MSAA vanligt alfatest (inga ditherprickar)
  const MSAA = (() => { try { return !!renderer.getContext().getContextAttributes().antialias; } catch (e) { return false; } })();
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
    // uppfartens korridor (glänta): start [x, z] och riktning n; tvärriktning t, böjens sida, längd (0 = av). Träd, buskar,
    // stenar, drivor och fläckar vars fot står i korridoren försvinner i skuggaren (fjärrsetet byggs en gång per miljö)
    uVagA: { value: new THREE.Vector4(0, 0, 0, 1) }, uVagB: { value: new THREE.Vector4(1, 0, 1, 0) },
  };
  // flaggans duk (vegPatch): utslag d tvärs duken på avståndet a (0 vid stången … 1 fria kanten) och höjden v (0 överkant),
  // dess derivator (för normalerna), vindstyrkan st och vindens riktning vn / tvärs pv. Två vågor som löper utåt
  // (en lång, en kort fladdrande ytterst), byig styrka som vegetationens.
  const FLAGG_GLSL = `
float flaggD( float a, float v, float fas, out float da, out float dv, out float st, out vec2 vn, out vec2 pv ) {
  float by = sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 ), g = 0.55 + 0.45 * by, vs = length( uVind );
  vn = vs > 1e-3 ? uVind / vs : vec2( 1.0, 0.0 ); pv = vec2( -vn.y, vn.x );
  st = clamp( vs * ( 0.8 + 0.6 * g ), 0.45, 1.3 );
  float f1 = uTid * ( 2.4 + 2.0 * st ) - a * 5.2 + v * 1.4, A1 = 0.08 + 0.15 * st, e = a * ( 0.45 + 0.55 * a );
  float f2 = uTid * ( 6.8 + 3.0 * st ) - a * 12.0 + v * 3.7, A2 = 0.028 * st, e2 = a * a * a;
  da = cos( f1 ) * -5.2 * A1 * e + sin( f1 ) * A1 * ( 0.45 + 1.1 * a ) + cos( f2 ) * -12.0 * A2 * e2 + sin( f2 ) * A2 * 3.0 * a * a;
  dv = cos( f1 ) * 1.4 * A1 * e + cos( f2 ) * 3.7 * A2 * e2;
  return sin( f1 ) * A1 * e + sin( f2 ) * A2 * e2;
}
`;
  const VAG_GLSL = `uniform vec4 uVagA;\nuniform vec4 uVagB;\nfloat iVagF( vec2 p, float m ) {\n  if ( uVagB.w < 1.0 ) return 0.0;\n  vec2 d = p - uVagA.xy; float sv = dot( d, uVagA.zw ), lat = dot( d, uVagB.xy ), boj = 1.6 * smoothstep( 4.0, 16.0, sv ) * uVagB.z;\n  return step( -1.5, sv ) * step( sv, uVagB.w ) * step( abs( lat - boj ), m );\n}\n`;
  // samma test i JS (stolpar m.m.)
  const iVagJS = (x, z, m) => { const A = VU.uVagA.value, B = VU.uVagB.value; if (B.w < 1) return false; const dx = x - A.x, dz = z - A.y, sv = dx * A.z + dz * A.w, lat = dx * B.x + dz * B.y; return sv > -1.5 && sv < B.w && Math.abs(lat - 1.6 * mjuk(4, 16, sv) * B.z) < m; };

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
  function atlas(c, kol = 2, rad = 2, fore = null) {
    const n = c.width, m = c.height, d = c.getContext('2d').getImageData(0, 0, n, m).data, hx = n / kol, hy = m / rad;
    for (let k = 0; k < kol * rad; k++) {
      const x0 = (k % kol) * hx, y0 = Math.floor(k / kol) * hy; let R = 0, G = 0, B = 0, A = 0;
      for (let y = y0; y < y0 + hy; y += 2) for (let x = x0; x < x0 + hx; x += 2) { const i = (y * n + x) * 4; if (d[i + 3] > 160) { R += d[i]; G += d[i + 1]; B += d[i + 2]; A++; } }
      if (!A) continue; R /= A; G /= A; B /= A;
      for (let y = y0; y < y0 + hy; y++) for (let x = x0; x < x0 + hx; x++) { const i = (y * n + x) * 4; const al = d[i + 3]; if (al < 210) { const k = al < 40 ? 0 : (al - 40) / 170; d[i] = R + (d[i] - R) * k; d[i + 1] = G + (d[i + 1] - G) * k; d[i + 2] = B + (d[i + 2] - B) * k; } }
    }
    if (fore) { fore.image.data.set(new Uint8Array(d.buffer)); fore.needsUpdate = true; return fore; }   // ny bild i samma textur
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
  // kvistfotona till lövatlasen (laddas en gång; klar = båda avkodade)
  const KVISTBILD = { klar: false, bilder: null, p: null };
  const kvistBilder = () => KVISTBILD.p || (KVISTBILD.p = Promise.all(['images/tex/grankvist.webp', 'images/tex/tallkvist.webp'].map(u => {
    const b = new Image(); b.src = u; return b.decode().then(() => b);
  })).then(B => { KVISTBILD.bilder = B; KVISTBILD.klar = true; return true; }, e => { console.warn('kvistbilder', e); return false; }));
  const tx = namn => TX[namn] || (TX[namn] = GEN[namn]());
  // svaga enheter (pekskärm/smal skärm): markens normalkartor hoppas över
  const SVAGMARK = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 760; } catch (e) { return false; } })();
  // normalkarta: linjär (ingen sRGB), upprepas
  function fotoNor(url) {
    const t = spara(new THREE.TextureLoader().load(url));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = ANISO;
    return t;
  }
  function fotoTex(url, meter) {
    const t = spara(new THREE.TextureLoader().load(url));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / meter, 1 / meter);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  }
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
      // (dov gråbrun med svagt rostorange plattor: de rena rostfärgerna här gav knallröda tallstammar i ridån)
      g.fillStyle = '#38302a'; g.fillRect(W3, 0, W3, n);
      for (let i = 0; i < 340; i++) {
        const x = W3 + r() * W3, y = r() * n, w = 16 + r() * 34, h = 12 + r() * 30, v = r();
        vy(y, h, yy => {
          g.fillStyle = `rgb(${112 + v * 40 | 0},${88 + v * 30 | 0},${70 + v * 22 | 0})`; g.beginPath(); g.ellipse(x, yy, w / 2, h / 2, (r() - 0.5) * 0.25, 0, 6.283); g.fill();
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
      const [c, g] = duk(1024, 1024, true), r = slump(501);
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
        // lövklunga: kvistar som grenar sig från basen och löv i små grupper längs dem (glipor mellan grupperna och
        // en flikig kant, ingen rund skiva); inre löv mörka och blågröna, yttre ljusa och gulgröna i solen
        const r1 = slump(1501), K = [];
        const kvist = (x0, y0, a, l, tj, niva) => {
          const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l, xm = (x0 + x1) / 2 + Math.cos(a + 1.57) * l * 0.08, ym = (y0 + y1) / 2 + Math.sin(a + 1.57) * l * 0.08;
          g.strokeStyle = '#4a3b2c'; g.lineWidth = tj; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(xm, ym, x1, y1); g.stroke();
          for (let t = 0.3; t <= 1.001; t += 0.14) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (Math.hypot(x - 256, y - 270) < 215) K.push([x, y, a, niva, t]); }   // inom rutan (ingen rak kant)
          if (niva < 2) for (let k = 0; k < 2 + (r1() * 2 | 0); k++) { const t = 0.35 + r1() * 0.5; kvist(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, a + (r1() < 0.5 ? -1 : 1) * (0.45 + r1() * 0.4), l * (0.4 + r1() * 0.15), tj * 0.6, niva + 1); }
        };
        for (let k = 0; k < 5; k++) kvist(256 + (r1() - 0.5) * 20, 470, -Math.PI / 2 + (k - 2) * 0.36 + (r1() - 0.5) * 0.2, 165 + r1() * 40, 5, 0);
        const L = [];
        K.forEach(([x, y, a, niva, t]) => {
          const n = niva === 2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const la = a + (r1() - 0.5) * 2.4, l = 19 + r1() * 15, d = Math.min(1, Math.hypot(x - 256, y - 280) / 230);
            L.push([x + (r1() - 0.5) * 18, y + (r1() - 0.5) * 18, la, l, l * (0.46 + r1() * 0.12), d * 0.7 + t * 0.3 + (r1() - 0.5) * 0.3]);
          }
        });
        L.sort((p, q) => p[5] - q[5]);
        L.forEach(b => { const ut = Math.max(0, Math.min(1, b[5])); blad(g, b[0], b[1], b[2], b[3], b[4], hsl(100 - ut * 12 + r1() * 8, 26 + ut * 14 + r1() * 12, 18 + ut * 20 + r1() * 7), halva(), 0.55, 0.3); });
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
      // fotograferade kvistar (Poly Haven fir_tree_01 / pine_tree_01 twig, CC0; images/tex/grankvist.webp och tallkvist.webp):
      // granskottet och tallruskan ersätts av riktiga kvistar när bilderna finns. Finns de inte än byggs atlasen med de
      // ritade kvistarna, och när bilderna kommit ritas rutorna om, texturen byts och miljöernas impostorer bakas om.
      const fotoKvist = g => {
        const [gran, tall] = KVISTBILD.bilder;
        const rita = (k, bild, sx, sy, vand, f) => {
          // tonas på en egen duk (multiplicera, sedan alfan tillbaka ur fotot): fotots olivgröna toner mot atlasens
          const [o, og] = duk(512);
          og.drawImage(bild, sx, sy, 512, 512, 0, 0, 512, 512);
          og.globalCompositeOperation = 'multiply'; og.fillStyle = `rgb(${f.map(v => Math.round(v * 255)).join(',')})`; og.fillRect(0, 0, 512, 512);
          og.globalCompositeOperation = 'destination-in'; og.drawImage(bild, sx, sy, 512, 512, 0, 0, 512, 512);
          const ox = (k % 2) * 512, oy = (k >> 1) * 512;
          g.save(); g.clearRect(ox, oy, 512, 512); g.beginPath(); g.rect(ox + 6, oy + 6, 500, 500); g.clip();
          g.translate(ox, oy + (vand ? 512 : 0)); g.scale(1, vand ? -1 : 1); g.drawImage(o, 0, 0); g.restore();
        };
        rita(2, gran, 0, 512, true, [0.42, 0.72, 0.9]);   // granskott (mörkt blågrönt): rutan nere till vänster (gren med sidoskott), basen uppe
        rita(3, tall, 512, 0, false, [0.82, 1.0, 1.0]);   // tallruska: kransen (rutan uppe till höger), basen nere
      };
      if (KVISTBILD.klar) { fotoKvist(g); return atlas(c); }
      const t = atlas(c);
      kvistBilder().then(ok => {
        if (!ok || TX.lovAtlas !== t) return;
        const [c2, g2] = duk(1024, 1024, true); g2.drawImage(c, 0, 0); fotoKvist(g2); atlas(c2, 2, 2, t);   // ny duk (en läsning per duk)
        for (const k in FJ) { const A = FJ[k] && FJ[k].atlas; if (A && A.arter) bakaAtlas(A.arter, A); }
      });
      return t;
    },
    // markväxter: 0 grässtrån, 1 gräs med blommor, 2 ormbunksblad (spets uppe), 3 blåbärsris. Basen nere.
    markAtlas() {
      const [c, g] = duk(1024, 1024, true), r = slump(601);
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
    // vattnets vågor: sömlös höjdkarta (lite avlånga krusningar) omräknad till normaler, 256²
    vagor() {
      const n = 256, h = new Float32Array(n * n), [c, g] = duk(n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / n, v = y / n; h[y * n + x] = tfbm(u, v, 4, 4, 901) * 0.65 + tfbm(u, v, 16, 3, 917) * 0.35; }
      const H = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
      pixlar(g, n, n, (u, v, o, x, y) => {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 9, dy = (H(x, y + 1) - H(x, y - 1)) * 5, l = Math.hypot(dx, dy, 1);
        o[0] = 128 + 127 * (-dx / l); o[1] = 128 + 127 * (-dy / l); o[2] = 128 + 127 / l;
      });
      return textur(c, 1, false);
    },
    // asfalt: mörkgrå med ljusare stenkross, lagningar och svaga sprickor. 3 m per ruta.
    asfalt() {
      const n = 256, [c, g] = duk(n), r = slump(97);
      pixlar(g, n, n, (u, v, o, x, y) => {
        const p = tfbm(u, v, 3, 3, 401), k = hash(x, y, 7) - 0.5, lag = mjuk(0.66, 0.7, tfbm(u, v, 2, 2, 433));
        const s = 92 + 16 * p + k * 22 - lag * 10;
        o[0] = s; o[1] = s + 1; o[2] = s + 4;
      });
      for (let i = 0; i < 2600; i++) { const v = 130 + r() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},.35)`; runt(n, r() * n, r() * n, 2, (px, py) => g.fillRect(px, py, 1.2, 1.2)); }
      g.strokeStyle = 'rgba(30,30,32,.35)'; g.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) { let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
      return textur(c, 3);
    },
    // fototexturer (Poly Haven, CC0; images/tex, gjorda med team-miljo4/konvertera-tex.py): laddas i bakgrunden
    // (team-mark) strandsand, 512² sömlös ruta (0,9 m): höjdfält av korn i flera storlekar, ljuset bakat ur höjden
    // (mjuka gropar och toppar), kornfärger (kvarts, fältspat, glimmer), små stenar och skalfragment
    sand() {
      const n = 512, [c, g] = duk(n), r = slump(733), H = new Float32Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / n, v = y / n; H[y * n + x] = tfbm(u, v, 6, 3, 701) * 0.6 + tfbm(u, v, 48, 2, 719) * 0.25 + hash(x, y, 727) * 0.15; }
      const h = (x, y) => H[((y + n) % n) * n + ((x + n) % n)];
      pixlar(g, n, n, (u, v, o, x, y) => {
        const lj = (h(x - 1, y - 1) - h(x + 1, y + 1)) * 2.2, f = 0.86 + 0.24 * h(x, y) + lj, kr = hash(x, y, 741);
        let R = 196, G = 172, B = 132;
        if (kr > 0.93) { R = 226; G = 214; B = 196; } else if (kr > 0.88) { R = 206; G = 160; B = 136; } else if (kr < 0.015) { R = 110; G = 104; B = 96; }   // kvarts, fältspat, glimmer
        const t = tfbm(u, v, 3, 2, 757) - 0.5;
        o[0] = Math.max(0, Math.min(255, R * f * (1 + t * 0.12))); o[1] = Math.max(0, Math.min(255, G * f * (1 + t * 0.1))); o[2] = Math.max(0, Math.min(255, B * f * (1 + t * 0.06)));
      });
      // små stenar: rundade, med ljus ovansida och mörk skugga nedanför
      for (let i = 0; i < 70; i++) {
        const x = r() * n, y = r() * n, s = 1.5 + Math.pow(r(), 2.5) * 7, v = 70 + r() * 90 | 0, rr = r() < 0.3 ? 18 : 0;
        runt(n, x, y, s * 2, (px, py) => {
          g.fillStyle = 'rgba(40,32,24,.35)'; g.beginPath(); g.ellipse(px + s * 0.3, py + s * 0.35, s, s * 0.8, 0, 0, 6.283); g.fill();
          const gr = g.createRadialGradient(px - s * 0.3, py - s * 0.3, 0, px, py, s); gr.addColorStop(0, `rgb(${v + 50 + rr},${v + 45},${v + 40})`); gr.addColorStop(1, `rgb(${v - 10 + rr},${v - 14},${v - 18})`);
          g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, s, s * (0.65 + r() * 0.3), r() * 3, 0, 6.283); g.fill();
        });
      }
      // skalfragment: små ljusa bågar
      g.lineCap = 'round';
      for (let i = 0; i < 40; i++) { const x = r() * n, y = r() * n, s = 2 + r() * 4, a = r() * 6.28; runt(n, x, y, s * 2, (px, py) => { g.strokeStyle = r() < 0.2 ? 'rgba(70,80,110,.8)' : 'rgba(240,234,222,.85)'; g.lineWidth = 1 + r() * 1.4; g.beginPath(); g.arc(px, py, s, a, a + 1.6 + r()); g.stroke(); }); }
      return textur(c, 0.9);
    },
    // (team-mark) Poly Haven-marktexturer (CC0, 1024², normalkartor i OpenGL-format): samplas i världens xz i
    // patcha({ mark: { foto } }), så meter-värdet här spelar ingen roll
    phGras: () => fotoTex('images/tex/grasfoto-diff.webp', 1), phGrasN: () => fotoNor('images/tex/grasfoto-nor.webp'),
    phSand: () => fotoTex('images/tex/sand-diff.webp', 1), phSandN: () => fotoNor('images/tex/sand-nor.webp'),
    phSno: () => fotoTex('images/tex/sno-diff.webp', 1), phSnoN: () => fotoNor('images/tex/sno-nor.webp'),
    phSkog: () => fotoTex('images/tex/skogsmark-diff.webp', 1), phSkogN: () => fotoNor('images/tex/skogsmark-nor.webp'),
    phGrus: () => fotoTex('images/tex/grus-diff.webp', 1.4), phGrusN: () => fotoNor('images/tex/grus-nor.webp'),
    grusFoto: () => fotoTex('images/tex/sten-diff.webp', 1),
    grasHallFoto: () => fotoTex('images/tex/grashall-diff.webp', 1),
    bradorFoto: () => fotoTex('images/tex/brador-diff.webp', 1),
    // Poly Haven wood_planks_grey (CC0): grånade kustbrädor med spikar, fem brädor över bredden; normalkartan (OpenGL)
    bryggaFoto: () => fotoTex('images/tex/brygga-diff.webp', 1),
    bryggaNor: () => { const t = fotoTex('images/tex/brygga-nor.webp', 1); t.colorSpace = THREE.NoColorSpace; return t; },
    // klippt gräsmatta (ambientCG Grass004, CC0; team-villa/konv-gras.py): villaområdet, två skalor via patcha({ tva })
    grasMattaFoto: () => fotoTex('images/tex/gras-matta.webp', 2.2),
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
  const VP = skapaVaxtPaket(THREE, { VU, LJUS, ANISO, renderer });   // riktiga gräs och markväxter, laddas lat (husritare-vaxter.js)
  const FAB = skapaFab(THREE, { VU, LJUS, ANISO, VAG_GLSL, MSAA });           // Fab-modellerna, laddas lat (husritare-fab.js)
  const NATUR = skapaNatur(THREE, { VU, LJUS, ANISO, VAG_GLSL, MSAA });       // skogsmarkens skannade modeller, laddas lat (husritare-natur.js)
  const BLOM = skapaBlommor(THREE, { VU, LJUS, ANISO, MSAA });                 // trädgårdsblommor och rabatter (husritare-blommor.js)
  const FOLK = skapaFolk(THREE, { VU, LJUS });                                 // människor i villaområdet och vid sjön (husritare-folk.js)
  // de n närmaste björkarna (inom rmax) tas ur impostorlistan och blir Fab-björkar (instansierade, med vind)
  const fabBjorkar = (V, n, rmax) => {
    if (!FAB.klar()) return [];
    const k = V.barr.map((e, i) => ({ e, i, d: Math.hypot(e.x, e.z) })).filter(o => o.e.art === 'bjork' && o.d < rmax).sort((a, b) => a.d - b.d).slice(0, n);
    const bort = new Set(k.map(o => o.i)); V.barr = V.barr.filter((e, i) => !bort.has(i));
    return k.map(({ e }) => ({ x: e.x, y: e.y + 0.04, z: e.z, h: e.hh * 0.9, ry: e.ry }));
  };
  const HALL = { value: 0 };                              // 1 = stenarna är sjöns släta hällar (lav, mossa bara i skrevor)
  // stigarna i ängen vid sjön (upp till 8 sträckor x0, z0, x1, z1; sätts i kustNara från husritare-sjo.js), långt bort = ingen stig
  const STIG = { value: Array.from({ length: 8 }, () => new THREE.Vector4(1e4, 1e4, 1e4, 1e4)) };  const GLITTER = { value: new THREE.Color(0, 0, 0) };   // solens glitterväg på vattnet (sätts i uppdatera)
  // mark: markens färgvariation samplas per pixel ur brustexturen via världens xz (två skalor),
  //   valfritt detaljgräs som tonas bort med avståndet, mjuka klippränder och avmättning.
  // glitter: procedurellt glitter (drivor): solglitter på dagen, blått i månsken (uGnistra).
  // sten: mossa på ovansidor (i fläckar), lav och mörk fot där stenen möter marken.
  // studio: studiogolvet – varje platta får sin egen svaga ton, en mjuk skugga samlas kring huset, golvet
  //   mörknar lätt ut mot fonden (ljuset ligger på huset) och får en diskret blank reflex i flacka vinklar.
  // bomb (kräver mark): fototexturen samplas i världens xz med texturbombning – tre vridna och förskjutna samplingar
  //   som blandas efter ett lågfrekvent brus, plus en stor skala – så att ingen ruta upprepas synligt (vid sjön)
  function patcha(m, { tva = false, upp = false, gnistra = false, mot = false, mark = null, glitter = false, sten = false, studio = false, bomb = false } = {}) {
    const MU = mark && {
      uBrus: { value: tx('brus') }, uDetalj: { value: mark.detalj ? tx('grasDetalj') : null },
      uMA: { value: new THREE.Vector3(...mark.A) }, uMB: { value: new THREE.Vector3(...mark.B) }, uMC: { value: new THREE.Vector3(...(mark.C || ETT)) },
      uMRad: { value: new THREE.Vector2(...(mark.rad || [900, 1000])) }, uMAmp: { value: mark.amp }, uMSat: { value: mark.sat ?? 1 },
      uSten: { value: mark.hall ? tx('sten') : null }, uGrus: { value: mark.hall ? tx('grusFoto') : null }, uGrHall: { value: mark.hall ? tx('grasHallFoto') : null }, uSand: { value: mark.hall ? tx('phSand') : null },   // (Poly Haven coast_sand_01; GEN.sand finns kvar som reserv)
      ...(mark.ang ? { uStig: STIG } : {}),
      ...(mark.foto ? { uFA: { value: tx(mark.foto.a) }, uFB: { value: mark.foto.b ? tx(mark.foto.b) : null }, uNA: { value: mark.foto.an ? tx(mark.foto.an) : null }, uNB: { value: mark.foto.bn ? tx(mark.foto.bn) : null } } : {}),
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
      if (sten || glitter) {
        Object.assign(s.uniforms, { uVagA: VU.uVagA, uVagB: VU.uVagB });
        s.vertexShader = VAG_GLSL + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            if ( iVagF( vec2( instanceMatrix[3][0], instanceMatrix[3][2] ), 4.0 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );
          #endif`);
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
        s.uniforms.uBrus = { value: tx('brus') }; s.uniforms.uHall = HALL;
        s.vertexShader = 'varying vec2 vSt;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n          vSt = vec2( position.y, normal.y );');
        f = 'varying vec2 vSt;\nuniform sampler2D uBrus;\nuniform float uHall;\n' + f.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float mn = texture2D( uBrus, vVM.xz / 2.3 + vVM.y * 0.37 ).g;
          // hällarna vid sjön (uHall): ingen mosstäckt ovansida, bara mossa i skrevor och vid foten
          float ms = smoothstep( 0.4, 0.82, vSt.y * 0.8 + ( mn - 0.5 ) * 1.1 ) * ( 1.0 - uHall );
          ms = max( ms, uHall * smoothstep( 0.62, 0.8, mn ) * ( 1.0 - smoothstep( -0.2, 0.25, vSt.x ) ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * vec3( 0.085, 0.14, 0.04 ) * ( 0.7 + 0.6 * mn ), ms * 0.85 );
          float lr = texture2D( uBrus, vVM.xz / 0.83 + vVM.y ).r;
          float lv = smoothstep( 0.6 - uHall * 0.1, 0.74 - uHall * 0.1, lr ) * ( 1.0 - ms );
          // lav: grågröna rosetter, på hällarna även enstaka orange fläckar
          vec3 lavF = mix( vec3( 0.42, 0.45, 0.33 ), vec3( 0.62, 0.36, 0.1 ), uHall * step( 0.8, texture2D( uBrus, vVM.xz / 0.37 ).b ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * lavF, lv * ( 0.4 + 0.25 * uHall ) );
          diffuseColor.rgb *= 0.42 + 0.58 * smoothstep( -0.36, 0.1, vSt.x );
        }`);
        // granitkornet i världens skala (förr följde texturen sfärens uv och sträcktes ut till grova rutor på stora block)
        f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          diffuseColor *= mix( texture2D( map, vVM.xz * 0.85 ), texture2D( map, vec2( vVM.x + vVM.z * 0.6, vVM.y ) * 0.85 ), 1.0 - abs( vSt.y ) );
        #endif`);
      }
      if (mark && mark.foto) {
        // (team-mark) Poly Haven-foto(n) i världens xz med texturbombning (tre vridna, förskjutna samplingar efter brus),
        // valfritt en andra textur (b) inblandad efter brus eller radie, färgjusterad (tint); normalkartan med samma
        // samplingar (vridna tillbaka), tonas ut med avståndet; svaga enheter hoppar över normalkartan
        const F = mark.foto, n3 = v => v.toFixed(3), SA = F.s[0], SB = F.s[1] || F.s[0];
        const bomb3 = (tex, S) => `mix( mix( texture2D( ${tex}, w / ${n3(S)} ), texture2D( ${tex}, mat2( 0.8, -0.6, 0.6, 0.8 ) * w / ${n3(S * 0.93)} + vec2( 0.31, 0.67 ) ), fwB ), texture2D( ${tex}, mat2( -0.5, 0.866, -0.866, -0.5 ) * w / ${n3(S * 1.13)} + vec2( 0.71, 0.13 ) ), fwC )`;
        const blandB = F.rad ? `smoothstep( ${n3(F.rad[0])}, ${n3(F.rad[1])}, length( w ) + ( texture2D( uBrus, w / 11.0 ).r - 0.5 ) * 8.0 )` : `smoothstep( 0.3, 0.7, texture2D( uBrus, w / 13.0 + vec2( 0.15, 0.4 ) ).b ) * ${n3(F.bAndel ?? 0.5)}`;
        f = f.replace('#include <map_fragment>', `
        float fwB = 0.0, fwC = 0.0, fwM = 0.0;
        {
          vec2 w = vVM.xz;
          fwB = smoothstep( 0.35, 0.65, texture2D( uBrus, w / 6.7 ).r );
          fwC = smoothstep( 0.4, 0.7, texture2D( uBrus, w / 9.3 + vec2( 0.37, 0.11 ) ).g ) * 0.7;
          vec4 t = ${bomb3('uFA', SA)};
          ${F.b ? `fwM = ${blandB}; t = mix( t, ${bomb3('uFB', SB)}, fwM );` : ''}
          float tm = dot( t.rgb, vec3( 0.333 ) );
          t.rgb = max( vec3( 0.0 ), tm + ( t.rgb - tm ) * 1.2 );
          diffuseColor.rgb *= t.rgb * vec3( ${F.tint.map(n3).join(', ')} );
        }`);
        if (F.an && !SVAGMARK) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 w = vVM.xz;
          #define NB3( T, S ) ( mix( mix( texture2D( T, w / S ).xy * 2.0 - 1.0, transpose( mat2( 0.8, -0.6, 0.6, 0.8 ) ) * ( texture2D( T, mat2( 0.8, -0.6, 0.6, 0.8 ) * w / ( S * 0.93 ) + vec2( 0.31, 0.67 ) ).xy * 2.0 - 1.0 ), fwB ), transpose( mat2( -0.5, 0.866, -0.866, -0.5 ) ) * ( texture2D( T, mat2( -0.5, 0.866, -0.866, -0.5 ) * w / ( S * 1.13 ) + vec2( 0.71, 0.13 ) ).xy * 2.0 - 1.0 ), fwC ) )
          vec2 d = NB3( uNA, ${n3(SA)} );
          ${F.b ? (F.bn ? `d = mix( d, NB3( uNB, ${n3(SB)} ), fwM );` : 'd *= 1.0 - fwM * 0.8;') : ''}
          #undef NB3
          float kd = ${n3(F.k ?? 0.8)} * ( 1.0 - smoothstep( 12.0, 45.0, distance( vVM, cameraPosition ) ) );
          vec3 nWg = normalize( transpose( mat3( viewMatrix ) ) * normal );
          vec3 nWp = normalize( nWg + vec3( d.x, 0.0, -d.y ) * kd );
          normal = normalize( mat3( viewMatrix ) * nWp );
        }`);
      } else if (bomb && mark) f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
        {
          vec2 w = vVM.xz;
          float n1 = texture2D( uBrus, w / 6.7 ).r, n2 = texture2D( uBrus, w / 9.3 + vec2( 0.37, 0.11 ) ).g;
          vec4 tA = texture2D( map, w / 2.3 );
          vec4 tB = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * w / 2.1 + vec2( 0.31, 0.67 ) );
          vec4 tC = texture2D( map, mat2( -0.5, 0.866, -0.866, -0.5 ) * w / 2.6 + vec2( 0.71, 0.13 ) );
          vec4 t = mix( mix( tA, tB, smoothstep( 0.35, 0.65, n1 ) ), tC, smoothstep( 0.4, 0.7, n2 ) * 0.7 );
          vec4 tL = texture2D( map, mat2( 0.28, 0.96, -0.96, 0.28 ) * w / 9.5 + vec2( 0.53, 0.29 ) );
          t = mix( t, tL, 0.3 );
          float tm = dot( t.rgb, vec3( 0.333 ) );
          t.rgb = max( vec3( 0.0 ), tm + ( t.rgb - tm ) * 1.25 ) * 1.08;   // blandningen planar ut kontrasten: tillbaka lite
          diffuseColor *= t;
        }
        #endif`);
      else if (tva) f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 tA = texture2D( map, vMapUv );
          vec4 tB = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.27 + vec2( 0.31, 0.67 ) );
          diffuseColor *= mix( tA, tB, 0.45 );
        #endif`);
      if (mark) s.uniforms.uHus = VU.uHus;
      if (mark) f = 'uniform vec4 uHus;\nuniform sampler2D uBrus;\nuniform vec3 uMA;\nuniform vec3 uMB;\nuniform vec3 uMC;\nuniform vec2 uMRad;\nuniform float uMAmp;\nuniform float uMSat;\n' + (mark.detalj ? 'uniform sampler2D uDetalj;\n' : '') + (mark.hall ? 'uniform sampler2D uSten;\nuniform sampler2D uGrus;\nuniform sampler2D uGrHall;\nuniform sampler2D uSand;\n' : '') + (mark.ang ? 'uniform vec4 uStig[ 8 ];\n' : '') + (mark.foto ? 'uniform sampler2D uFA;\nuniform sampler2D uFB;\nuniform sampler2D uNA;\nuniform sampler2D uNB;\n' : '') +
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
          ${mark.ang ? `{
            // ängsmarken vid sjön: mikrovariation i fyra vridna skalor (ingen ruta upprepas synligt): fuktiga, blågröna
            // svackor, torra halmfläckar, gulgröna mosskuddar och små fläckar bar jord; trampade stigar (uStig) ner mot sjön
            vec4 a1 = texture2D( uBrus, mat2( 0.6, -0.8, 0.8, 0.6 ) * xz / 17.0 + vec2( 0.13, 0.57 ) );
            vec4 a2 = texture2D( uBrus, mat2( 0.28, 0.96, -0.96, 0.28 ) * xz / 3.7 + vec2( 0.71, 0.29 ) );
            vec4 a3 = texture2D( uBrus, mat2( 0.8, 0.6, -0.6, 0.8 ) * xz / 1.13 + vec2( 0.41, 0.83 ) );
            float an = 1.0 - smoothstep( 30.0, 75.0, distance( vVM, cameraPosition ) );
            float fukt = smoothstep( 0.5, 0.78, a1.r * 0.65 + a2.g * 0.35 );
            diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.78, 0.86, 0.8 ), fukt * 0.75 );
            float torr = smoothstep( 0.55, 0.82, a1.g * 0.55 + a2.b * 0.45 ) * ( 1.0 - fukt );
            diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.14, 1.1, 0.78 ), torr * 0.3 );   // (svagt: lite solblekt, ingen halm)
            float mos = smoothstep( 0.62, 0.8, a2.r * 0.6 + a3.g * 0.4 ) * ( 0.4 + 0.6 * fukt ) * an;
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.1, 0.13, 0.025 ) * ( 0.8 + 0.4 * a3.b ), mos * 0.5 );
            float jord = smoothstep( 0.76, 0.9, a3.r * 0.5 + a2.g * 0.3 + a1.b * 0.2 ) * an;
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.075, 0.055, 0.035 ) * ( 0.8 + 0.5 * a3.b ), jord * 0.18 );   // (svagt: fläckarna lästes som mörka prickar)
            // fint, oregelbundet korn (strån, förna) nära kameran
            float fk = texture2D( uBrus, vec2( xz.x * 2.3 + xz.y * 0.7, xz.y * 2.3 - xz.x * 0.7 ) ).g;
            diffuseColor.rgb *= ( 1.0 + ( fk - 0.5 ) * 0.22 * an ) * ( 1.0 - 0.14 * an );   // marken mellan tuvorna: skuggad grässvål, mörkare än stråna
            {
              // tät grässvål på mellanavstånd (10–90 m), där tuvorna gallras: små tuvor (ljusa, gulgröna toppar) och mörka
              // mellanrum i två vridna skalor, så att ängen läses som sammanhängande gräs och inte som en platt textur
              float md = distance( vVM, cameraPosition ), mv = smoothstep( 3.0, 9.0, md ) * ( 1.0 - smoothstep( 70.0, 140.0, md ) );
              float t1 = texture2D( uBrus, mat2( 0.8, -0.6, 0.6, 0.8 ) * xz / 0.61 ).r, t2 = texture2D( uBrus, mat2( 0.28, 0.96, -0.96, 0.28 ) * xz / 0.29 ).g;
              float tv = smoothstep( 0.25, 0.85, t1 * 0.6 + t2 * 0.4 );
              diffuseColor.rgb *= mix( vec3( 1.0 ), mix( vec3( 0.86, 0.9, 0.82 ), vec3( 1.06, 1.06, 0.94 ), tv ), mv );   // (svagare: fotot ger kornet)
            }
            {
              // mjuk ocklusion: gräset mörknar och blir djupare grönt intill husets sockel (sakerna står i gräset)
              float hd = length( max( abs( xz ) - uHus.xy, 0.0 ) );
              float ao = 1.0 - smoothstep( 0.15, 1.6, hd );
              diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.62, 0.7, 0.6 ), ao );
            }
            // stigar: bar, packad jord i mitten (varierande bredd), nedtrampat och blekare gräs vid sidorna
            float sd = 99.0;
            for ( int i = 0; i < 8; i ++ ) {
              vec4 s = uStig[ i ]; vec2 e = s.zw - s.xy;
              float t = clamp( dot( xz - s.xy, e ) / max( dot( e, e ), 1e-4 ), 0.0, 1.0 );
              sd = min( sd, length( xz - s.xy - e * t ) );
            }
            if ( sd < 1.2 ) {
              float sw = 0.2 + 0.14 * a3.g;
              float stig = 1.0 - smoothstep( sw * 0.45, sw, sd + ( a3.r - 0.5 ) * 0.12 );
              float tramp = 1.0 - smoothstep( sw, sw + 0.55, sd );
              diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.12, 1.04, 0.8 ), tramp * 0.55 );
              vec3 jc = mix( vec3( 0.085, 0.062, 0.04 ), vec3( 0.15, 0.115, 0.07 ), a2.b ) * ( 0.8 + 0.4 * a3.r );
              diffuseColor.rgb = mix( diffuseColor.rgb, jc, stig * 0.9 );
            }
          }` : ''}
          ${mark.hall ? `{
            // berghällar i marken (vid sjön): granit där strandbandet och bruset säger häll, och vid vattenlinjen
            // (även runt öarna). Fint fältspatskorn ur stentexturen, lav, mossa i skrevorna och en mörkare kant mot gräset.
            vec2 K = vec2( ${KUST[0].toFixed(3)}, ${KUST[1].toFixed(3)} );
            float l = -xz.x * K.y + xz.y * K.x, q = dot( xz, K ) + 3.2 * sin( l * 0.055 + 1.3 ) + 1.6 * sin( l * 0.14 + 0.4 );
            float hn = texture2D( uBrus, xz / 9.0 ).r * 0.65 + texture2D( uBrus, xz / 2.6 ).g * 0.35;
            float band = smoothstep( 12.5, 16.0, q ) * ( 1.0 - smoothstep( 60.0, 90.0, q ) );   // (förr från q 9,5: grå hällfläckar ute i gräset)
            // på stranden (bandet) blir ungefär hälften häll och resten grus; runt öarna och nere vid vattnet mest häll
            // ute i sjön (skären) bredare hällkant: granit upp till ~2 m över vattnet, så att skären inte blir gröna kakor
            // (höjdvillkoren gäller bara mot sjön: låga svackor på ängen bakom huset fick annars grå hällfläckar)
            float sida = smoothstep( 2.0, 8.0, q );
            // (team-mark: vid tomtens strand ingen häll i vattenbrynet och färre, mjukare hällfläckar i sanden – de gav ett
            // grått kamouflagemönster; hällkanten vid vattnet gäller bara ute vid skären, q > 26)
            float pres = max( max( band * 0.36 * smoothstep( 20.0, 26.0, q ), smoothstep( ${(VY + 1.15).toFixed(2)}, ${(VY + 0.5).toFixed(2)}, vVM.y ) * sida * smoothstep( 24.0, 30.0, q ) ),
              smoothstep( 30.0, 36.0, q ) * smoothstep( ${(VY + 2.4).toFixed(2)}, ${(VY + 1.2).toFixed(2)}, vVM.y ) );
            float hm = pres - 0.45 + ( hn - 0.5 ) * 0.7;     // utanför bandet och högt över vattnet aldrig häll
            {
              // (team-mark) på fastlandet bara häll där marken lutar: flacka partier blir gräs/sand (inga draperade "lakan");
              // ute vid skären (q > 30) som förut. Lutningen ur skärmderivatorna av världspositionen.
              vec3 nW = normalize( cross( dFdx( vVM ), dFdy( vVM ) ) );
              float lut = 1.0 - abs( nW.y );
              hm += ( smoothstep( 0.06, 0.22, lut ) - 0.55 ) * 0.5 * ( 1.0 - smoothstep( 28.0, 34.0, q ) );
            }
            float m = smoothstep( 0.0, 0.025, hm );   // skarp kant mot gräset/sanden, som slipad granit
            if ( m > 0.001 ) {
              vec3 g = mix( vec3( 0.25, 0.245, 0.24 ), vec3( 0.3, 0.25, 0.23 ), texture2D( uBrus, xz / 5.0 ).b );
              // slät, rundslipad häll: svagt korn och mjuka, breda toningar (förr grovt korn som såg ut som sandpapper)
              // slät häll med fint korn: fotograferad sten (rock_ground_02) som detalj i liten skala, och svaga breda toningar
              // (team-mark: tydligare granitkorn, svagare breda toningar – de mjuka toningarna såg ut som veck i ett lakan)
              g *= ( 0.82 + 0.3 * texture2D( uSten, xz * 0.9 ).r ) * ( 0.96 + 0.08 * texture2D( uBrus, xz / 6.0 ).g );
              g *= 0.62 + 0.75 * dot( texture2D( uGrus, xz / 0.55 ).rgb, vec3( 0.3, 0.59, 0.11 ) );
              // lav: mjuk, svag grågrön ton över hällen (hårda fläckar i en skala såg ut som kamouflagemönster)
              float lv = smoothstep( 0.5, 0.85, texture2D( uBrus, mat2( 0.6, -0.8, 0.8, 0.6 ) * xz / 3.1 ).r * 0.6 + texture2D( uBrus, xz / 0.9 ).b * 0.4 );
              g = mix( g, g * vec3( 1.06, 1.1, 0.97 ), lv * 0.45 );
              float spr = ( 1.0 - smoothstep( 0.0, 0.012, abs( texture2D( uBrus, xz / 7.0 ).g - 0.5 ) ) ) * ( 1.0 - smoothstep( 15.0, 35.0, distance( vVM, cameraPosition ) ) );
              // finare sprickor i en vriden skala till (kantiga, korsande linjer som i slipad granit)
              spr = max( spr, ( 1.0 - smoothstep( 0.0, 0.018, abs( texture2D( uBrus, mat2( 0.8, 0.6, -0.6, 0.8 ) * xz / 2.6 ).r - 0.5 ) ) ) * ( 1.0 - smoothstep( 8.0, 22.0, distance( vVM, cameraPosition ) ) ) );
              g = mix( g, g * 0.5, spr * 0.7 );   // sprickor: bara mörkare häll (gröna linjer såg ut som torkad lera)
              diffuseColor.rgb = mix( diffuseColor.rgb, g, m );
            }
            diffuseColor.rgb *= 1.0 - 0.32 * smoothstep( -0.05, 0.0, hm ) * ( 1.0 - smoothstep( 0.0, 0.09, hm ) ) * smoothstep( 18.0, 22.0, q );   // mörk kant där gräset möter hällen (inte vid sandstranden: gav en mörk rand)
            {
              // strandzonen: grus och småsten närmast vattnet där det inte är häll, och en våt, mörk rand vid vattenlinjen
              float yv = vVM.y, sb = texture2D( uBrus, xz / 1.7 ).b;
              // grusstranden: hela strandbandet (q 9,5–13 med oregelbunden kant) där det inte är häll, och sluttningen ner mot vattnet
              // bara en stor, mjuk bukt i kanten: småskaligt brus gav lösa grusfläckar ute i gräset (såg ut som fel)
              float qk = q + ( texture2D( uBrus, xz / 23.0 ).r - 0.5 ) * 3.0 + ( sb - 0.5 ) * 0.5;
              // (team-mark: bred, uppbruten övergång – sanden kryper in i gräset i små fläckar i stället för en hård kant)
              float qk2 = qk + ( texture2D( uBrus, mat2( 0.6, 0.8, -0.8, 0.6 ) * xz / 1.1 ).g - 0.5 ) * 1.8;
              qk2 = qk;   // (team-mark: ingen småskalig uppbrytning – den gav kantiga, pixliga flak; smal, mjuk övergång 1–2 m)
              float grus = max( smoothstep( 9.9, 11.4, qk2 ) * ( 1.0 - smoothstep( 24.0, 30.0, q ) ), smoothstep( ${(VY + 0.85).toFixed(2)}, ${(VY + 0.3).toFixed(2)}, yv + ( sb - 0.5 ) * 0.4 ) * sida ) * ( 1.0 - m );
              // övergången gräs → grus: gräs med sten (aerial_grass_rock) i ett 1,5 m brett band
              float ov = smoothstep( 8.3, 9.4, qk ) * ( 1.0 - smoothstep( 10.0, 11.2, qk ) ) * ( 1.0 - m );
              diffuseColor.rgb = mix( diffuseColor.rgb, texture2D( uGrHall, xz / 2.4 ).rgb * 0.95, ov * 0.0 );   // (team-mark: avstängt – den brungrå gräs-med-sten-zonen såg smutsig ut)   // (svagt: helt gav det en gulgrön ring runt gruset)
              // fotograferat stengrus (rock_ground_02), 1,6 m per ruta, vridet i två skalor så att rutan inte syns
              // fotograferat stengrus i naturlig kornstorlek (0,8 m per ruta), blandat med en vriden skala så att rutan inte syns,
              // fuktigare och mörkare närmare vattnet
              // strandgrus och sand: varm, ljust grå-beige bas där fotot bara ger kornet (ljushet, låg kontrast), så att inga
              // gröna/grå fläckmönster blir kvar; tunna sandstråk och småsten i två skalor
              float gL = dot( mix( texture2D( uGrus, xz / 0.8 ).rgb, texture2D( uGrus, mat2( 0.8, -0.6, 0.6, 0.8 ) * xz / 1.9 ).rgb, 0.4 ), vec3( 0.3, 0.59, 0.11 ) );
              vec3 sandF = mix( vec3( 0.28, 0.235, 0.165 ), vec3( 0.33, 0.285, 0.2 ), smoothstep( 0.3, 0.75, texture2D( uBrus, mat2( 0.96, 0.28, -0.28, 0.96 ) * xz / 4.3 ).g ) );
              float sten2 = texture2D( uBrus, xz / 0.19 ).r;
              // helt jämn sand: bara fint korn (fotot i liten skala, blir medelvärde på avstånd), inga stora ljusa/mörka fält
              float gF = dot( texture2D( uGrus, mat2( 0.8, -0.6, 0.6, 0.8 ) * xz / 0.33 ).rgb, vec3( 0.3, 0.59, 0.11 ) );
              // (team-mark) sandtexturen (GEN.sand) med texturbombning: tre vridna/förskjutna samplingar blandade efter brus
              vec3 gc;
              {
                float bn1 = texture2D( uBrus, xz / 5.3 + vec2( 0.21, 0.63 ) ).r, bn2 = texture2D( uBrus, xz / 7.7 + vec2( 0.55, 0.08 ) ).g;
                vec3 sA = texture2D( uSand, xz / 2.0 ).rgb;
                vec3 sB = texture2D( uSand, mat2( 0.8, -0.6, 0.6, 0.8 ) * xz / 2.3 + vec2( 0.31, 0.67 ) ).rgb;
                vec3 sC = texture2D( uSand, mat2( -0.5, 0.866, -0.866, -0.5 ) * xz / 1.8 + vec2( 0.71, 0.13 ) ).rgb;
                vec3 sx = mix( mix( sA, sB, smoothstep( 0.35, 0.65, bn1 ) ), sC, smoothstep( 0.4, 0.7, bn2 ) * 0.7 );
                gc = sx * vec3( 0.58, 0.6, 0.66 ) * ( 0.96 + 0.08 * gF );
              }
              gc *= mix( 0.7, 1.0, smoothstep( ${(VY - 0.05).toFixed(2)}, ${(VY + 1.1).toFixed(2)}, yv ) );   // mjuk fuktgradient mot vattnet
              {
                // (team-mark) sandens liv: vindkrusningar (avlånga rippel tvärs vinden, vridna av ett långsamt brus så att
                // de inte blir raka ränder), fint korn nära kameran, mörkare fuktig sand ner mot vattnet och en tunn
                // tånglinje där vågorna når upp; trampat och mörkare kring bryggans landfäste och stigarna
                float dk = distance( vVM, cameraPosition ), nk = 1.0 - smoothstep( 6.0, 40.0, dk );
                float vr = texture2D( uBrus, xz / 13.0 ).r;
                vec2 rq = mat2( 0.94, 0.33, -0.33, 0.94 ) * xz;
                float rip = sin( rq.x * 12.0 + vr * 9.0 + sin( rq.y * 0.9 ) * 1.4 );
                float ripA = smoothstep( 0.2, 0.6, texture2D( uBrus, xz / 7.1 + vec2( 0.4, 0.2 ) ).g ) * smoothstep( ${(VY + 0.35).toFixed(2)}, ${(VY + 0.8).toFixed(2)}, yv );   // bara på torr sand, i fält
                gc *= ( 1.0 + rip * 0.13 * ripA * nk ) * ( 1.0 + ( vr - 0.5 ) * 0.12 );   // krusningar + svag storskalig ton
                gc *= mix( 0.66, 1.0, smoothstep( ${(VY + 0.02).toFixed(2)}, ${(VY + 0.5).toFixed(2)}, yv + ( texture2D( uBrus, xz / 3.1 ).r - 0.5 ) * 0.12 ) );   // våt, mörk sand närmast vattnet
                float korn = texture2D( uBrus, vec2( xz.x * 4.1 + xz.y * 1.3, xz.y * 4.1 - xz.x * 1.3 ) ).r;
                gc *= 1.0 + ( korn - 0.5 ) * 0.26 * nk;
                {
                  // våt sand närmast vattnet: lätt blank med en svag himmelsreflex i flacka vinklar, och en tunn, avbruten
                  // skumrest där sista vågen nådde upp
                  float ws = 1.0 - smoothstep( ${(VY + 0.02).toFixed(2)}, ${(VY + 0.3).toFixed(2)}, yv + ( texture2D( uBrus, xz / 2.7 ).g - 0.5 ) * 0.08 );
                  vec3 vd = normalize( cameraPosition - vVM );
                  float fr = pow( 1.0 - clamp( vd.y, 0.0, 1.0 ), 3.0 );
                  gc = mix( gc, gc * 0.85 + vec3( 0.07, 0.085, 0.1 ) * ( 0.4 + 1.6 * fr ), ws );
                  float sk = ( 1.0 - smoothstep( 0.0, 0.018, abs( yv - ${(VY + 0.075).toFixed(3)} - ( texture2D( uBrus, xz / 1.3 ).r - 0.5 ) * 0.03 ) ) ) * smoothstep( 0.45, 0.6, texture2D( uBrus, xz / 0.7 ).b );
                  gc = mix( gc, vec3( 0.62, 0.62, 0.6 ), sk * 0.6 );
                }
                // tånglinjen: tunn, oregelbunden mörk rand med strån och tång en bit ovanför vattenbrynet
                float tl = ${(VY + 0.32).toFixed(2)} + ( texture2D( uBrus, xz / 4.3 ).b - 0.5 ) * 0.16;
                float tang = ( 1.0 - smoothstep( 0.0, 0.06, abs( yv - tl ) ) ) * smoothstep( 0.3, 0.55, texture2D( uBrus, xz / 1.9 ).g );
                gc = mix( gc, vec3( 0.1, 0.085, 0.05 ), tang * 0.7 );
                // trampat: mörkare, packad sand längs stigarna och vid spången
                float tr = 0.0;
                for ( int i = 0; i < 8; i ++ ) { vec4 s4 = uStig[ i ]; vec2 e = s4.zw - s4.xy; float t = clamp( dot( xz - s4.xy, e ) / max( dot( e, e ), 1e-4 ), 0.0, 1.0 ); tr = max( tr, 1.0 - smoothstep( 0.3, 1.1, length( xz - s4.xy - e * t ) ) ); }
                gc *= 1.0 - 0.06 * tr * ( 0.7 + 0.3 * korn );
              }
              diffuseColor.rgb = mix( diffuseColor.rgb, gc, grus );   // (förr 0,9: gräsets fläckar lyste igenomsanden)
              float vat = ( 1.0 - smoothstep( ${(VY - 0.05).toFixed(2)}, ${(VY + 0.45).toFixed(2)}, yv ) ) * sida;
              diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.74, 0.77, 0.8 ), vat * ( 0.7 + 0.3 * sb ) );   // svag, oregelbunden våt rand (inte en målad kant)
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
          ${mark.rand ? `{
            // villans gräsmattor: svaga klippränder (två riktningar, olika per kvarter) och fina tuvor/strån nära kameran
            float kn = 1.0 - smoothstep( 25.0, 70.0, distance( vVM, cameraPosition ) );
            vec2 rq = mat2( 0.9, -0.44, 0.44, 0.9 ) * xz;
            float rnd = smoothstep( -0.35, 0.35, sin( rq.x * 2.4 ) ) * ( 0.6 + 0.4 * smoothstep( 0.3, 0.7, texture2D( uBrus, xz / 23.0 ).b ) );
            diffuseColor.rgb *= 1.0 + ( rnd - 0.5 ) * 0.09 * ( 0.4 + 0.6 * kn );
            float tv = texture2D( uBrus, xz / 0.37 ).r, st = texture2D( uBrus, vec2( xz.x * 3.1 + xz.y * 0.9, xz.y * 3.1 - xz.x * 0.9 ) ).g;
            diffuseColor.rgb *= 1.0 + kn * ( ( tv - 0.5 ) * 0.16 + ( st - 0.5 ) * 0.12 );
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
    m.customProgramCacheKey = () => 'miljo' + (tva ? '-tva' : '') + (upp ? '-upp' : '') + (gnistra ? '-gn' : '') + (mot ? '-mot' : '') + (mark ? '-m' + mark.id : '') + (glitter ? '-gl' : '') + (sten ? '-st' : '') + (studio ? '-sd' : '') + (bomb ? '-bo' : '');
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
      Object.assign(s.uniforms, { uVagA: VU.uVagA, uVagB: VU.uVagB });
      s.vertexShader = VAG_GLSL + 'uniform float uTid;\nuniform vec2 uVind;\nattribute vec4 aVind;\nattribute float aSno;\nvarying float vSno;\nvarying vec3 vVarld;\nvarying vec3 vFlg;\n' + FLAGG_GLSL +
        s.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          if ( aVind.w < -1.5 ) {   // flaggans duk: normalen följer vågen (ljus och skugga i vecken), åt rätt håll på båda sidor
            float w2 = -aVind.w, k = floor( w2 * 0.5 ), a = w2 - 2.0 * k, v = ( k - 1.0 ) / 20.0, da, dv, st;
            vec2 vn, pv;
            flaggD( a, v, aVind.x * 0.07 + aVind.y * 0.05, da, dv, st, vn, pv );
            float sg = dot( objectNormal.xz, pv ) < 0.0 ? -1.0 : 1.0;
            objectNormal = sg * normalize( vec3( pv.x, 0.0, pv.y ) - ( da / 1.2 ) * vec3( vn.x, 0.0, vn.y ) + vec3( 0.0, dv / 0.9, 0.0 ) );   // (vecken lite förstärkta i ljuset)
          }`).replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            float fas = aVind.x * 0.07 + aVind.y * 0.05;
            vFlg = vec3( 0.0 );
            float by = sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 );
            float g = 0.55 + 0.45 * by;
            float sv = aVind.z * ( g * 1.1 + 0.25 * sin( uTid * 1.35 + fas * 3.0 ) + 0.12 * sin( uTid * 2.9 + fas * 5.0 ) );
            transformed.xz += uVind * sv;
            transformed.y -= abs( sv ) * 0.1;
            if ( aVind.w >= 0.0 ) {
              float fl = aVind.w * ( 0.45 + 0.8 * g );
              vec3 q = position * 1.7;
              transformed += fl * vec3( sin( uTid * 6.1 + q.x + q.y * 1.3 ), 0.5 * sin( uTid * 7.3 + q.z * 1.1 + q.y ), cos( uTid * 5.3 + q.y * 1.2 + q.z ) );
            } else if ( aVind.w < -1.5 ) {
              // flagga: vågor som löper från stången ut mot den fria kanten (större där), fladder ytterst; i svag vind
              // hänger duken ner mot stången. Duken dras in lite längs vinden där den buktar (behåller sin längd).
              float w2 = -aVind.w, k = floor( w2 * 0.5 ), a = w2 - 2.0 * k, v = ( k - 1.0 ) / 20.0, da, dv, st;
              vec2 vn, pv;
              float d = flaggD( a, v, fas, da, dv, st, vn, pv ), slak = clamp( 1.0 - st, 0.0, 1.0 );
              d += sin( uTid * 13.0 - a * 22.0 + v * 2.0 ) * 0.03 * a * a * a * a * ( 0.4 + v ) * st;   // fladder i det fria nedre hörnet
              vFlg = vec3( 1.0, a, v );
              transformed.xz += pv * d - vn * ( abs( d ) * 0.3 + a * a * 0.3 * slak );
              transformed.y -= a * a * 0.4 * slak + a * 0.05;
            } else {
              // vimpel (aVind.w = −andel av längden från stången): vågor som löper från stången mot spetsen, större
              // utslag mot spetsen; i svag vind hänger den i en båge, i byarna sträcks den ut och fladdrar mer
              float a = -aVind.w, vs = length( uVind );
              vec2 vn = vs > 1e-3 ? uVind / vs : vec2( 1.0, 0.0 ), pv = vec2( -vn.y, vn.x );
              float styrka = clamp( vs * ( 0.55 + 0.6 * g ), 0.15, 1.3 );
              transformed.xz += pv * sin( uTid * ( 4.0 + 3.0 * styrka ) - a * 10.0 ) * a * ( 0.1 + 0.22 * styrka );
              transformed.y += sin( uTid * 5.1 - a * 8.0 + 1.3 ) * a * 0.05 * styrka - a * a * 1.1 * ( 1.25 - styrka );
              transformed.xz -= vn * a * a * 0.8 * ( 1.25 - styrka );
            }
          }
          if ( iVagF( aVind.xy, 5.0 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );   // står i uppfartens glänta
          vSno = aSno;
          vVarld = transformed;`);
      let f = 'uniform vec4 uHus;\nuniform float uNatt;\nuniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform vec3 uSol;\nuniform float uSno;\nuniform vec2 uFade;\nuniform vec3 uGlod;\nuniform float uLampa;\nvarying float vSno;\nvarying vec3 vVarld;\nvarying vec3 vFlg;\n' + s.fragmentShader;
      let at = '';
      if (mip) at += `
        #ifdef USE_MAP
          { vec2 dd = vec2( length( dFdx( vMapUv ) ), length( dFdy( vMapUv ) ) ) * 1024.0;
            diffuseColor.a *= 1.0 + max( log2( max( max( dd.x, dd.y ), 1e-4 ) ), 0.0 ) * 0.55; }   // tätare kronor på avstånd (färre glipor mot bakgrunden)
        #endif`;
      if (nara) at += NARA_GLSL('vVarld', nara === 'lag');
      if (fade) at += fadeAv ? `\n diffuseColor.a *= 1.0 - smoothstep( ${fadeAv[0].toFixed(1)}, ${fadeAv[1].toFixed(1)}, distance( vVarld, cameraPosition ) );` : '\n diffuseColor.a *= 1.0 - smoothstep( uFade.x, uFade.y, distance( vVarld.xz, cameraPosition.xz ) );';
      // skärpt alpha-to-coverage: kanten blir en pixel bred i stället för ett brett prickigt övergångsband (kronorna såg pixliga ut)
      if (m.alphaToCoverage) at += '\n diffuseColor.a = clamp( ( diffuseColor.a - 0.5 ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );';
      if (mip) f = f.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          { vec2 dd0 = fwidth( vMapUv ) * 1024.0;
            // högst mipnivå 3: längre ner blöder grannrutorna i atlasen (ljusa björklöv) in i kortkanterna
            float lw = log2( max( max( dd0.x, dd0.y ), 1e-4 ) ), lod0 = clamp( lw, 0.0, 3.0 );
            vec4 tl = textureLod( map, vMapUv, lod0 );
            // alfan på avstånd från rätt mipnivå (högst 6): med färgens tak på 3 undersamplades barren och
            // glittrade när kameran rörde sig; alfans blödning i atlasen är bara en kantremsa
            tl.a = mix( tl.a, textureLod( map, vMapUv, clamp( lw, 0.0, 6.0 ) ).a, smoothstep( 2.5, 4.0, lw ) );
            diffuseColor *= tl; }
        #endif`);
      // flaggans duk: fin väv (tonas bort när den blir finare än en bildpunkt), dubbelsömmar längs över-, under- och
      // ytterkanten och en vit förstärkt likkant vid stången
      at += `
        if ( vFlg.x > 0.5 ) {
          float xa = vFlg.y * 2.0, yv = vFlg.z * 1.25;
          vec2 vv = vec2( xa, yv ) * 700.0; float fw = length( fwidth( vv ) );
          diffuseColor.rgb *= 1.0 + 0.07 * sin( vv.x ) * sin( vv.y ) * ( 1.0 - smoothstep( 0.6, 2.5, fw ) );
          float ds = min( min( yv, 1.25 - yv ), 2.0 - xa ), sw = max( fwidth( ds ) * 1.2, 0.0025 );
          float sm = max( 1.0 - smoothstep( 0.0, sw, abs( ds - 0.012 ) ), 1.0 - smoothstep( 0.0, sw, abs( ds - 0.026 ) ) );
          diffuseColor.rgb *= 1.0 - 0.22 * sm * ( 0.0025 / sw );
          if ( xa < 0.045 ) diffuseColor.rgb = vec3( 0.82, 0.81, 0.76 ) * ( 0.92 + 0.08 * sin( yv * 380.0 ) );
        }`;
      // natt: vit näver, snö på grenar och ljusa blommor dämpas (lyste mot de mörka kronorna); lampornas glöd är emissiv och rörs inte
      at += '\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );';
      if (m.alphaToCoverage) at += '\n diffuseColor.a = smoothstep( 0.28, 0.72, diffuseColor.a );   // delvis täckning bara i kanten (inget rutmönster inne i kronan)';
      f = f.replace('#include <alphatest_fragment>', at + '\n#include <alphatest_fragment>' +
        (m.alphaToCoverage ? '\n diffuseColor.a = mix( diffuseColor.a, 1.0, smoothstep( 0.2, 0.6, uNatt ) );   // kantutjämnade löv; natt: hel täckning (inga ljusa prickar)' : ''));
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
      // flaggan: genomlysning när solen står bakom duken, och en svag glans i vecken som vänder sig bort
      slut += '\n\tif ( vFlg.x > 0.5 ) { float gl = pow( max( dot( normalize( vVarld - cameraPosition ), normalize( uSol ) ), 0.0 ), 3.0 ); reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.9 * gl + 0.18 * pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 3.0 ) ); }';
      if (sss) slut += '\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uSSS * ( 0.3 + 1.5 * pow( max( dot( normalize( vVarld - cameraPosition ), uSol ), 0.0 ), 4.0 ) );';
      // bandet glöder när uLampa passerat lampans fördröjning (aSno = 1 + fördröjning)
      if (glod) slut += '\n\tif ( vSno > 0.5 ) totalEmissiveRadiance += uGlod * smoothstep( vSno - 1.0, vSno - 0.6, uLampa );';
      s.fragmentShader = f.replace('#include <lights_fragment_end>', slut);
    };
    const nyckel = ['veg', sss, sno, fade, mip, upp, glod, snoBak, fadeAv, nara, m.alphaToCoverage].join('-');
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
    return { bark: B, lov: Lv, H, spetsar, cc, cR, cY };   // spetsar: grenarnas toppar (lövklungorna i villaområdet)
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
  const djup = map => {
    const d = spara(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide }));
    d.onBeforeCompile = s => {   // inga skuggor från träd som tagits bort ur uppfartens glänta
      Object.assign(s.uniforms, { uVagA: VU.uVagA, uVagB: VU.uVagB });
      s.vertexShader = VAG_GLSL + 'attribute vec4 aVind;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  if ( iVagF( aVind.xy, 5.0 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );');
    };
    d.customProgramCacheKey = () => 'djup-vag';
    return d;
  };
  const mat = namn => MAT[namn] || (MAT[namn] = spara(({
    bark: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('bark'), vertexColors: true }), { glod: true, nara: true }),
    lov: () => {
      // alphaToCoverage: kantutjämnade lövkort (björkens krona såg ut som en pixlig pappfigur)
      const m = vegPatch(new THREE.MeshLambertMaterial({ map: tx('lovAtlas'), vertexColors: true, alphaTest: 0.42, alphaToCoverage: MSAA, side: THREE.DoubleSide }), { sss: true, sno: true, mip: true, upp: true, nara: 'lag' });
      m.userData.djup = djup(tx('lovAtlas')); return m;
    },
    vaxt: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('markAtlas'), vertexColors: true, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide }), { sss: false, sno: true, fade: true, mip: false, upp: true, snoBak: 1 }),
    matta: () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('markAtlas'), vertexColors: true, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide }), { fade: true, fadeAv: [14, 32], upp: true }),
    driva: () => patcha(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: C('#141c2c') }), { glitter: true }),
    tramp: () => patcha(new THREE.MeshLambertMaterial({ map: tx('tramp'), transparent: true, depthWrite: false, emissive: C('#0e1524'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
    sten: () => patcha(new THREE.MeshLambertMaterial({ map: tx('sten'), vertexColors: true }), { sten: true }),
    platta: () => patcha(new THREE.MeshLambertMaterial({ map: tx('sten') })),
    flack: () => { const m = new THREE.MeshBasicMaterial({ map: tx('flack'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uVagA: VU.uVagA, uVagB: VU.uVagB }); sh.vertexShader = VAG_GLSL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  if ( iVagF( vec2( instanceMatrix[3][0], instanceMatrix[3][2] ), 5.0 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );\n#endif'); };
      m.customProgramCacheKey = () => 'flack-vag'; return m; },
    grus: () => tvaSkalor(new THREE.MeshLambertMaterial({ map: tx('phGrus') /* team-mark: Poly Haven gravel_floor_03 */, vertexColors: true, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
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
    kumMap: { value: null }, uKum: { value: 0 },                          // stackmoln (vid sjön), se kumulus()
    uStral: { value: 0 },                                                 // solens halo och strålkrans (sätts i uppdatera)
  };
  // dithering: brus på ±½ steg efter sRGB-kodningen, så att den mjuka gradienten inte får band
  const himmelMat = spara(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false, map: tx('moln'), dithering: true }));
  himmelMat.onBeforeCompile = s => {
    Object.assign(s.uniforms, HU, { uTid: VU.uTid, uStjarnor: VU.uStjarnor });
    s.vertexShader = 'varying vec3 vRikt;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRikt = position;');
    s.fragmentShader = 'uniform vec3 molnFarg;\nuniform float molnMangd;\nuniform float uTid;\nuniform float uStjarnor;\nuniform vec3 uSolD;\nuniform float uSolSyn;\nuniform vec3 uSolF;\nuniform vec3 uManeD;\nuniform float uManeSyn;\nuniform sampler2D kumMap;\nuniform float uKum;\nuniform float uStral;\nvarying vec3 vRikt;\n' + s.fragmentShader
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
            // mjuk halo (linsglöd) och en diskret strålkrans: vinkeln runt solen ger långsamt vridna strålar
            if ( uStral > 0.001 ) {
              vec3 s1 = normalize( cross( uSolD, vec3( 0.0001, 1.0, 0.0 ) ) ), s2 = cross( s1, uSolD );
              float vin = atan( dot( d - uSolD, s2 ), dot( d - uSolD, s1 ) );
              float str = 0.6 * pow( 0.5 + 0.5 * sin( vin * 13.0 + 1.3 ), 6.0 ) + 0.4 * pow( 0.5 + 0.5 * sin( vin * 7.0 - uTid * 0.02 ), 8.0 );
              glod += uStral * ( 0.16 * exp( -a * 3.0 ) + 0.2 * str * exp( -a * 5.5 ) * smoothstep( 0.012, 0.05, a ) );
            }
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
        #endif
        // stackmoln (vid sjön): egen karta i riktningens azimut och höjd (0–40°), rgb = inbakad skuggning
        // (ljusa toppar, gråblå platta baser); solsidan lite ljusare
        if ( uKum > 0.001 ) {
          vec3 kd = normalize( vRikt );
          float ke = asin( clamp( kd.y, 0.0, 1.0 ) ) / 0.6981;
          if ( ke < 1.0 ) {
            vec2 ku = vec2( atan( kd.z, kd.x ) * 0.15915 + 0.5 + uTid * 0.0003, ke );
            vec4 kt = texture2D( kumMap, ku );
            float ks = 0.5 + 0.5 * dot( normalize( kd.xz + 1e-4 ), normalize( uSolD.xz + 1e-4 ) );
            // solkant och skuggsida: tätheten en bit mot solen (i kartans led) – tunnare där = kanten i ljus,
            // tätare där = vi ser molnets bortre, skuggade sida
            vec2 sr = vec2( atan( uSolD.z, uSolD.x ) * 0.15915 + 0.5 + uTid * 0.0003, asin( clamp( uSolD.y, -1.0, 1.0 ) ) / 0.6981 ) - ku;
            sr.x -= floor( sr.x + 0.5 );
            sr = normalize( sr * vec2( 9.0, 1.0 ) + 1e-5 );
            float kb = texture2D( kumMap, ku + sr * vec2( 0.0016, 0.016 ) ).a;
            float kant = clamp( ( kt.a - kb ) * 3.0, 0.0, 1.0 ), skugg = clamp( ( kb - kt.a ) * 2.0, 0.0, 1.0 );
            vec3 kf = molnFarg * kt.rgb * mix( 0.9, 1.06, ks ) * ( 1.0 - 0.22 * skugg );
            kf += uSolF * kant * ( 0.25 + 0.35 * ks ) * uSolSyn;
            diffuseColor.rgb = mix( diffuseColor.rgb, kf, kt.a * uKum * smoothstep( 0.0, 0.02, ke ) * ( 1.0 - smoothstep( 0.8, 0.99, ke ) ) );   // tonas ut mot kartans överkant (ingen rak kant)
          }
        }`);
  };
  himmelMat.customProgramCacheKey = () => 'miljo-himmel';
  // stackmolnens karta: 4096 × 512, azimut × höjd 0–40°; molnen ritas som mjuka bollar med platt bas,
  // små och flacka nära horisonten (långt bort), stora högre upp
  function kumulus() {
    const W = 4096, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    let fro = 31337;
    const rnd = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    const yAv = e => H * (1 - e / 40), PX = W / 360;          // höjd i grader -> rad; px per grad
    // varje moln ritas först på en egen duk (så att den grå basen bara mörkar det egna molnet – förut blev
    // rektangelns kanter raka streck över grannmolnen) och läggs sedan på kartan, även runt sömmen
    const kladd = document.createElement('canvas'); kladd.width = 2048; kladd.height = H;
    const k2 = kladd.getContext('2d');
    const moln = (az, e) => {
      const s = Math.sin(e * Math.PI / 180), bred0 = Math.min(600, (0.7 + rnd() * 0.9) * 52 * s * PX), hog0 = bred0 * (0.2 + rnd() * 0.24) * (0.55 + 0.45 * Math.cos(e * Math.PI / 180)), yb = yAv(e);
      // höga moln krymps i stället för att klippas, så att toppen alltid ligger under kartans uttoning (31°)
      const kS = Math.min(1, Math.max(4, (yb - yAv(31)) / 1.9) / hog0), bred = bred0 * kS, hog = hog0 * kS;
      const x0 = az * PX, n = 40 + (bred / 2 | 0), cx = bred * 1.5, w = Math.ceil(bred * 3);
      k2.clearRect(0, 0, w + 2, H);
      // en mjuk, sammanhängande kropp under bollarna (molnet läses som en volym, inte som lösa bomullstussar)
      { const ky = yb - hog * 0.45, gr = k2.createRadialGradient(cx, ky, 0, cx, ky, bred * 0.95);
        gr.addColorStop(0, 'rgba(248,250,253,0.5)'); gr.addColorStop(0.6, 'rgba(240,244,250,0.28)'); gr.addColorStop(1, 'rgba(235,240,248,0)');
        k2.save(); k2.translate(cx, ky); k2.scale(1, Math.max(0.15, hog * 0.7 / bred)); k2.translate(-cx, -ky);
        k2.fillStyle = gr; k2.beginPath(); k2.arc(cx, ky, bred * 0.95, 0, Math.PI * 2); k2.fill(); k2.restore(); }
      for (let i = 0; i < n; i++) {
        const t = (rnd() - 0.5) * 2, kx = cx + t * bred * 0.85, kupa = 1 - t * t;
        const rr = (0.05 + rnd() * 0.09) * bred * (0.5 + 0.6 * kupa), ky = Math.max(yb - rr * 0.3 - rnd() * hog * kupa, yAv(31) + rr);   // topparna under 31°: kartans uttoning (32–40°) gav annars en rak kant
        const gr = k2.createRadialGradient(kx + rr * 0.2, ky - rr * 0.4, rr * 0.05, kx, ky, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.62)'); gr.addColorStop(0.45, 'rgba(250,251,253,0.42)'); gr.addColorStop(0.8, 'rgba(232,237,245,0.14)'); gr.addColorStop(1, 'rgba(220,228,240,0)');
        k2.fillStyle = gr; k2.beginPath(); k2.arc(kx, ky, rr, 0, Math.PI * 2); k2.fill();
      }
      k2.clearRect(0, yb + 1, w + 2, H);                                   // platt bas
      // grå bas, bara på det egna molnet
      k2.globalCompositeOperation = 'source-atop';
      const bg = k2.createLinearGradient(0, yb - hog * 1.1, 0, yb);
      bg.addColorStop(0, 'rgba(150,164,186,0)'); bg.addColorStop(0.75, 'rgba(150,164,186,0.1)'); bg.addColorStop(1, 'rgba(140,154,178,0.2)');   // bara en antydan till skuggad bas
      k2.fillStyle = bg; k2.fillRect(0, 0, w + 2, H);
      k2.globalCompositeOperation = 'source-over';
      for (const dx of [0, -W, W]) { const x = x0 + dx - cx; if (x + w > 0 && x < W) g.drawImage(kladd, 0, 0, w, H, x, 0, w, H); }
    };
    // fler, mindre moln nära horisonten; några stora högre upp; luckor av klarblå himmel emellan
    // höga slöjmoln (cirrus) först, bakom stackmolnen: långa, tunna, svepande strimmor 12–29° upp
    for (let i = 0; i < 26; i++) {
      const az = rnd() * W, e = 12 + rnd() * 17, y = yAv(e), lang = (80 + rnd() * 260) * PX / 10, lut = (rnd() - 0.5) * 0.25;
      for (let k = 0; k < 14; k++) {
        const t = k / 13 - 0.5, x = az + t * lang * 6, yy = y + t * lang * 6 * lut + (rnd() - 0.5) * 6, rx = lang * (0.5 + rnd() * 0.6), ry = 2 + rnd() * 4;
        for (const dx of [0, -W, W]) {
          const gr = g.createRadialGradient(x + dx, yy, 0, x + dx, yy, rx);
          gr.addColorStop(0, `rgba(250,252,255,${0.09 + rnd() * 0.08})`); gr.addColorStop(1, 'rgba(250,252,255,0)');
          g.fillStyle = gr; g.save(); g.translate(x + dx, yy); g.scale(1, ry / rx); g.translate(-(x + dx), -yy); g.beginPath(); g.arc(x + dx, yy, rx, 0, Math.PI * 2); g.fill(); g.restore();
        }
      }
    }
    for (let i = 0; i < 76; i++) moln(rnd() * 360, 2 + Math.pow(rnd(), 1.3) * 25);   // färre men finare: vita sommarcumulus
    const t = spara(new THREE.CanvasTexture(cv));
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
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
  // Vid sjön: vattnet ligger åt nordväst (bakom huset i startvyn, som tittar mot entrén i söder/öster).
  // kustQ = avstånd ut mot vattnet längs KUST, med en buktande strandlinje; ytan ligger på VY.
  // Tomten är plan, berghällarna (knöligt band 12–30 m) sluttar ner i sjön; öar och andra stranden långt ut.
  // (sjön ligger åt väst-nordväst: i startvyn, som tittar norrut mot entrén, breder den ut sig till vänster och bakom huset)
  const KUST = [-0.616, -0.788], VY = -1.25;
  const kustQ = (x, z) => { const l = -x * KUST[1] + z * KUST[0]; return x * KUST[0] + z * KUST[1] + 3.2 * Math.sin(l * 0.055 + 1.3) + 1.6 * Math.sin(l * 0.14 + 0.4); };
  // öarna ligger vid sidorna: mitt i siktlinjen är fjärden öppen ut till horisonten (dis)
  const OAR = [[-5, -60, 12, 3.9], [-64, -17, 13.5, 3.75], [-41, -102, 10, 3.6], [-91, -52, 12.5, 3.85]];   // låga, breda skär (1,5–2 m över vattnet)
  const hojdKust = (x, z) => {
    // stranden närmare tomten (sluttar från q 10) och andra stranden bara åt sidorna (|l| > 35 m): rakt ut är fjärden öppen
    const r = Math.hypot(x, z), q = kustQ(x, z), ned = mjuk(10, 26, q), l = Math.abs(-x * KUST[1] + z * KUST[0]);
    const land = mjuk(30, 70, r) * (fbm(x * 0.016 + 3, z * 0.016) - 0.45) * 3.5;
    const hall = (fbm(x * 0.09, z * 0.09 + 11) - 0.5) * 1.1 * mjuk(11, 15, q) * (1 - mjuk(23, 28, q));
    let o = 0;
    // skären: långsmala kobbar längs stranden med flikig kant (vikar och uddar ur bruset), en låg udde i ena
    // änden och en flack hällfot ut i vattnet – inga runda kakor
    for (const [ox, oz, orr, oh] of OAR) {
      const dx = x - ox, dz = z - oz; if (dx * dx + dz * dz > orr * orr * 20) continue;
      const v = -0.66 + 0.45 * Math.sin(ox * 0.7 + oz * 0.3), c = Math.cos(v), s = Math.sin(v), a = (dx * c + dz * s) / 1.55, b = (-dx * s + dz * c) / 0.7;
      const fl = orr * orr * (0.5 + 0.75 * fbm(x * 0.09 + ox, z * 0.09 + oz) + 0.3 * fbm(x * 0.26 - oz, z * 0.26 + ox, 2));
      const d2 = (a * a + b * b) / fl, ud = Math.sign(Math.sin(ox * 1.3 + oz)) || 1, u2 = ((a - ud * orr * 0.95) ** 2 * 0.8 + (b - orr * 0.35) ** 2 * 3) / fl;
      if (d2 < 7 || u2 < 7) o += oh * (Math.exp(-d2 * 1.15) * (0.86 + 0.28 * fbm(x * 0.1, z * 0.1)) + 0.22 * Math.exp(-d2 * 0.35) + 0.32 * Math.exp(-u2 * 2.2));
    }
    const h = land * (1 - ned) + hall - 3.6 * ned + o + 7.5 * mjuk(100, 126, q) * mjuk(35, 80, l) * (0.7 + 0.6 * fbm(x * 0.03 + 4, z * 0.03));
    // strandhylla: höjderna närmast vattenlinjen trycks ihop mot en låg nivå, så att strandzonen (grus, häll, våt rand)
    // blir 3–6 m bred i stället för en tunn remsa i sluttningen; kanten varierar med bruset
    const c = VY + 0.22 + (fbm(x * 0.21 + 5, z * 0.21) - 0.5) * 0.3, w = 1 - mjuk(0.3, 0.85, Math.abs(h - c));
    return h - 0.65 * (h - c) * w;
  };
  // gräset blir torrare på hällarna och brunt/sandigt under vattnet (hörnfärg på marken)
  const kustFarg = (x, z) => {
    const h = hojdKust(x, z), q = kustQ(x, z), torr = mjuk(13, 18, q) * (1 - mjuk(28, 34, q)), vat = mjuk(VY + 0.25, VY - 0.5, h);
    const f = [1 + 0.06 * torr, 1 - 0.03 * torr, 1 - 0.14 * torr];
    return [f[0] + (0.66 - f[0]) * vat, f[1] + (0.6 - f[1]) * vat, f[2] + (0.46 - f[2]) * vat];
  };
  const SJO = skapaSjo(THREE, { VU, VY, KUST, kustQ, hy: hojdKust, fbm, slump, renderer, GLITTER, OAR });
  // villaområdet: plant kvarter, svaga höjder först långt ut
  const hojdVilla = (x, z) => { const r = Math.hypot(x, z); return mjuk(70, 120, r) * (fbm(x * 0.014 + 6, z * 0.014) - 0.45) * 4 + mjuk(150, 228, r) * (4 + 11 * fbm(x * 0.011 + 3, z * 0.011 - 2)); };   // kullar bakom skogsbrynet

  // ---- markens färgvariation: per pixel i skuggaren (patcha mark), A = mörka/frodiga fläckar,
  // B = ljusa/torra, C = ängen längre ut (rad = radie där den tar över), amp = mellanskalan, sat = mättnad
  const MARK = {
    // rel = höjdkänsla i skuggaren: karta (GLSL, världens xz → brusets uv), steg mot solen (m), amp (ton), lut (ljus/skugga), farg
    // (team-mark) foto: Poly Haven-marken (se patcha); gräset = leafy_grass blandat med klippt gräsmatta, tonat friskt grönt
    tradgard: { id: 'tg', foto: { a: 'phGras', an: 'phGrasN', b: 'grasMattaFoto', bAndel: 0.6, s: [2.4, 2.2], tint: [0.82, 1.1, 0.68], k: 0.8 }, A: [0.88, 0.93, 0.86], B: [1.05, 1.03, 0.87], C: [1.08, 1.0, 0.8], rad: [20, 36], amp: 0.12, sat: 0.82, detalj: true, klipp: true,
      rel: { karta: '( p ) / 1.5', steg: 0.05, amp: 0.08, lut: 0.5, farg: [1, 1, 0.9] } },
    // skogen: frodig mossa (A) mot torrare barrmatta (B); utanför gläntan (15–32 m) mörkare, brunare skogsgolv (C)
    skog: { id: 'sk', foto: { a: 'phGras', an: 'phGrasN', b: 'phSkog', bn: 'phSkogN', rad: [11, 21], s: [2.4, 2.2], tint: [0.74, 1.08, 0.74], k: 0.9 }, A: [0.72, 0.77, 0.72], B: [1.1, 0.87, 0.82], C: [0.8, 0.76, 0.72], rad: [15, 32], amp: 0.36, sat: 0.88,
      rel: { karta: 'mat2( 0.8, -0.6, 0.6, 0.8 ) * ( p ) / 3.1', steg: 0.09, amp: 0.13, lut: 0.5, farg: [1, 1, 1] } },   // mossiga tuvor och svackor
    // vintern: blå skuggsvackor (A) mot vita ryggar (B), så att snötäcket får form i dagsljus
    // rel: vindrippel (avlånga längs vinden) med blå skuggsida
    vinter: { id: 'vi', foto: { a: 'phSno', an: 'phSnoN', s: [2.6], tint: [1.04, 1.04, 1.06], k: 0.55 }, A: [0.8, 0.865, 1.0], B: [0.95, 0.965, 0.99], amp: 0.12, sat: 1,
      rel: { karta: 'mat2( 0.1044, -0.15, 0.0367, 0.427 ) * ( p )', steg: 0.16, amp: 0.09, lut: 0.8, farg: [1, 0.82, 0.5] } },
    // villaområdet: klippta gräsmattor, jämnare ton (inga stora mjuka fläckar), svaga klippränder överallt och tuvor nära kameran
    villa: { id: 'vl', foto: { a: 'phGras', an: 'phGrasN', b: 'grasMattaFoto', bAndel: 0.75, s: [2.4, 2.2], tint: [0.82, 1.1, 0.68], k: 0.7 }, A: [0.84, 0.94, 0.8], B: [1.1, 1.06, 0.82], C: [1.04, 1.0, 0.86], rad: [70, 110], amp: 0.12, sat: 0.82, detalj: true, klipp: true, rand: true,
      rel: { karta: '( p ) / 0.9', steg: 0.04, amp: 0.1, lut: 0.6, farg: [1, 1, 0.9] } },
    // vid sjön: oklippt, lite torrare gräs (inga klippränder)
    // (team-mark: friskt sommargrönt – djupare grönt i A, varmt gulgrönt i B, full mättnad; förr grå-/olivgrönt)
    kust: { id: 'ku', foto: { a: 'phGras', an: 'phGrasN', b: 'grasMattaFoto', bAndel: 0.55, s: [2.4, 2.2], tint: [0.82, 1.1, 0.68], k: 0.8 }, A: [0.74, 0.75, 0.64], B: [0.97, 0.9, 0.68], amp: 0.12, sat: 0.68, detalj: true, hall: true, ang: true,
      rel: { karta: '( p ) / 1.5', steg: 0.05, amp: 0.08, lut: 0.5, farg: [1, 1, 0.9] } },
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
      dimma: [75, 320], morkMark: 0.62, hojd: hojdTradgard, moln: 0.3, kum: 0.8, liv: true, vind: 1,
      himmel: { top: C('#6e95c2'), mid: C('#a8c2db'), hor: C('#e6e0d2') },
      mark: () => [markGeo(null, hojdTradgard), patcha(new THREE.MeshLambertMaterial({ map: tx('gras'), vertexColors: true }), { tva: true, mot: true, mark: MARK.tradgard })],
      grund: { ton: C('#cdc8be'), ao: C('#1b220f'), styrka: 0.72 }, ljus: C('#9fb0bf'),
      fjarr: () => korG(tradgardFjarrG()), fjarrG: () => tradgardFjarrG(), nara: (mal, F) => tradgardNara(mal, F),
    },
    skog: {
      dimma: [22, 115], morkMark: 0.62, hojd: hojdSkog, moln: 0.45, liv: true, vind: 0.75,
      himmel: { top: C('#8ea5b8'), mid: C('#bac6c9'), hor: C('#d6dad0') },
      mark: () => [markGeo(null, hojdSkog), patcha(new THREE.MeshLambertMaterial({ map: tx('skog'), vertexColors: true }), { tva: true, mark: MARK.skog })],
      grund: { ton: C('#b9b2a4'), ao: C('#191b0e'), styrka: 0.72 }, ljus: C('#a3b0a6'),
      maane: new THREE.Color(0.17, 0.215, 0.32), maaneStyrka: 0.9,         // månljus: blå fyllning, läsbar men stämningsfull
      fjarr: () => korG(barrskogFjarrG(false)), fjarrG: () => barrskogFjarrG(false), nara: (mal, F) => barrskogNara(mal, F, false),
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
      fjarr: () => korG(barrskogFjarrG(true)), fjarrG: () => barrskogFjarrG(true), nara: (mal, F) => barrskogNara(mal, F, true),
    },
    kust: {
      // klar svensk sommarhimmel: djupblå zenit, ljusblå (inte grå) horisont, stackmoln (kum); dimman långt ut ger luftperspektiv
      dimma: [90, 520], morkMark: 0.62, hojd: hojdKust, moln: 0.07, kum: 1, liv: true, vind: 1.1,
      himmel: { top: C('#4682cf'), mid: C('#98c0e8'), hor: C('#dae8f3') },
      // (team-mark: fotograferad gräsmatta med texturbombning i stället för den ritade grästexturen)
      mark: () => [markGeo(kustFarg, hojdKust), patcha(new THREE.MeshLambertMaterial({ map: tx('grasMattaFoto'), vertexColors: true }), { bomb: true, mot: true, mark: MARK.kust })],
      grund: { ton: C('#cdc8be'), ao: C('#1b220f'), styrka: 0.72 }, ljus: C('#b6c6d4'),
      fjarr: () => korG(kustFjarrG()), fjarrG: () => kustFjarrG(), nara: (mal, F) => kustNara(mal, F), naraG: (mal, F) => kustNaraG(mal, F),
    },
    villa: {
      dimma: [55, 270], morkMark: 0.62, hojd: hojdVilla, moln: 0.28, kum: 0.8, liv: true, vind: 0.85,
      himmel: { top: C('#7097c3'), mid: C('#adc4da'), hor: C('#e7e3da') },
      mark: () => [markGeo(null, hojdVilla), patcha(new THREE.MeshLambertMaterial({ map: tx('grasMattaFoto'), vertexColors: true }), { tva: true, mot: true, mark: MARK.villa })],
      grund: { ton: C('#cdc8be'), ao: C('#1b220f'), styrka: 0.72 }, ljus: C('#a3b0bd'),
      fjarr: () => korG(villaFjarrG()), fjarrG: () => villaFjarrG(), nara: (mal, F) => villaNara(mal, F), naraG: (mal, F) => villaNaraG(mal, F),
    },
  };
  const PERSIKA = C('#f4b48a'), BARNSTEN = C('#f39a4c'), MJUKBLA = C('#a9c0dc'), VARMLAMPA = new THREE.Color(1, 0.56, 0.24), band = new THREE.Color();
  const KV = { top: C('#0a1430'), mid: C('#1b2a48'), hor: C('#3b4a64') };
  const GULD = { top: C('#3e5f9f'), mid: C('#d6a27e'), hor: C('#ffb468') };   // gyllene timmen: djupblått uppåt, gyllene-orange glöd vid horisonten
  const GRY = { top: C('#6b86bd'), mid: C('#e0b9ae'), hor: C('#ffcfa6') };
  const MORK = C('#1f1d19'), KVALLSGOLV = C('#7a808c'), MAANE = new THREE.Color(0.13, 0.15, 0.2), SKYMNING = C('#f2803c');

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
  // buskarternas toner i villaområdet: liguster, tuja (mörk), spirea (ljust gulgrön), berberis (röd), syren (blågrön)
  const BUSKARTER = [[0.72, 0.84, 0.66], [0.5, 0.66, 0.5], [0.95, 1.0, 0.62], [0.82, 0.36, 0.3], [0.62, 0.76, 0.68], [0.78, 0.9, 0.6]];
  const BARR = { gran0: ['gran', 14, 24], gran1: ['gran', 14, 24], gran2: ['gran', 11, 19], tall0: ['tall', 15, 22], tall1: ['tall', 15, 22], bjork: ['bjork', 12, 18], bjorkKal: ['bjorkKal', 12, 18], ek: ['ek', 9, 14], tallLut: ['tallLut', 12, 17] };
  function verktyg(r, hy, blk = null, sno = false) {
    const V = { bark: samling(), nara: samling(), fjarr: samling(), mark: samling(), matta: samling(), barr: [], klung: [] }, flack = [];
    // ryFast: given vridning (lutande tallar lutar mot vattnet); slumptalet dras ändå, så att övriga miljöer står kvar
    const trad = (typ, x, z, h, flackB = 0, ryFast = null) => {
      const b = BARR[typ];
      if (b) {
        const egen = b[0] === 'ek' || b[0].startsWith('bjork'), hh = egen && h > 0 ? h : b[1] + r() * (b[2] - b[1]), y = hy(x, z) - (sno ? 0.25 : 0.06), bred = hh * (0.88 + r() * 0.24), ry0 = r() * 6.283, ry = ryFast ?? ry0;
        const artNamn = sno && (b[0] === 'gran' || b[0] === 'tall') ? b[0] + 'Sno' : b[0];
        const c = new THREE.Color(1, 1, 1).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12);
        if (typ === 'gran2') c.multiplyScalar(0.86);   // ridån lite mörkare, så den inte blir ljust ludd i diset
        V.barr.push({ m: matris(x, y, z, bred, hh, bred, ry), c, art: artNamn, x, y, z, hh, ry });
        if (flackB) flack.push({ m: matris(x, hy(x, z) + 0.02, z, hh * (sno ? 0.22 : 0.3), 1, hh * (sno ? 0.22 : 0.3), 0) });
        return;
      }
      const v = variant(typ, r() * 3 | 0), s = h / v.H, y = hy(x, z), ry = r() * 6.283;
      if (v.bark.I.length) lagg(V.bark, v.bark, x, y, z, s, ry, v.H, VK[typ], BARKTON[typ]);
      // nära lövträd (inom 40 m, inte i snö): kronan av riktiga lövkvistar i klungor vid grentopparna (husritare-natur.js)
      if (!sno && v.spetsar && (typ === 'lov' || typ === 'frukt' || typ === 'mellan') && Math.hypot(x, z) < 40) {
        const c = Math.cos(ry), sn = Math.sin(ry), tint = ton(r, typ === 'frukt' ? [0.86, 0.95, 0.72] : [0.8, 0.92, 0.72], 0.06), R0 = (typ === 'frukt' ? 0.95 : 1.35) * s;
        v.spetsar.forEach((p, k) => { if (typ !== 'mellan' && k % 2) return; V.klung.push({ x: x + (c * p[0] + sn * p[2]) * s, y: y + p[1] * s + R0 * 0.25, z: z + (-sn * p[0] + c * p[2]) * s, r: R0 * (0.85 + ((k * 7) % 5) * 0.08), sy: 0.78, mark: y + 1.2, tint: tint.map(t => t * (0.92 + ((k * 13) % 7) * 0.025)), s: typ === 'frukt' ? 0.4 : 0.52, vind: 0.06 }); });
        if (flackB) flack.push({ m: matris(x, y + 0.02, z, flackB, 1, flackB, 0) });
        return;
      }
      // villaområdets buskar: olika arter i färg (liguster, tuja, spirea, berberis, syren) och alltid en skugga under
      const villaBuske = typ === 'buske' && hy === hojdVilla, art = villaBuske ? BUSKARTER[(r() * BUSKARTER.length) | 0] : null;
      lagg(Math.hypot(x, z) < NARA ? V.nara : V.fjarr, v.lov, x, y, z, s, ry, v.H, VK[typ], ton(r, art || LOVTON[typ], villaBuske ? 0.08 : undefined));
      if (flackB || villaBuske) flack.push({ m: matris(x, y + 0.02, z, flackB || h * 0.55, 1, flackB || h * 0.55, 0) });
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
    // krokig stam (skärgårdstall): två svängar, och kronan i flera oregelbundna våningar från halva höjden
    // (rotpunkten ligger vid t < 0: negativ bas i pow gav NaN och tallarna försvann)
    const stam = t => { const b = Math.pow(Math.max(0, t), 1.5); return [Math.sin(fro) * 1.5 * b + Math.sin(t * 8.3 + fro * 2) * 0.28 * t, t * H, Math.cos(fro * 1.3) * 1.1 * b + Math.cos(t * 7.1 + fro) * 0.22 * t]; };   // tydlig böj och ett par knyckar
    // barken: gråbrun skorpbark nertill, dov rostorange spegelbark upptill (förr ×1,3 i rött: knallröda stammar)
    const farg = y => { const t = y / H; return lerp3([0.6, 0.6, 0.6], [0.62, 0.6, 0.62], mjuk(0.35, 0.65, t)); };   // (barktexturens tallremsa är redan rödbrun: ingen extra röd ton)
    // avsmalning: bred rotfot, smalnar snabbt nertill och sedan jämnt upp mot toppen
    ror(B, [-0.01, 0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 0.97].map(t => [...stam(t), 0.36 * Math.pow(1 - t, 1.25) * (1 + 0.5 * Math.pow(1 - Math.min(1, t / 0.08), 2)) + 0.025]), 7, UT, 1.6, farg);
    const nf = p => norm([(p[0] - cc[0]) / R, (p[1] - cc[1]) / (0.2 * H) * 0.5 + 0.55, (p[2] - cc[2]) / R]);
    // Kronan som i husritare-sjo.js (holmtallen): en sammanhängande, flack paraplymassa av överlappande barrklumpar
    // runt kronans mitt, korta grova grenar som slutar inne i klumparna – inga runda moln på långa kala grenar
    if (!sno) {
      const kb = 0.5, top = stam(0.97), CCm = stam(0.82), KRx = 0.2 * H, KRy = 0.15 * H;
      const nfK = p => norm([(p[0] - CCm[0]) / KRx, (p[1] - CCm[1]) / KRy * 0.8 + 0.35, (p[2] - CCm[2]) / KRx]);
      for (let k = 0, nk = 18; k < nk; k++) {
        const fi = k * 2.399 + r() * 0.7, uy = Math.max(-0.55, Math.min(0.9, -0.5 + 1.4 * (k + r()) / nk)), rh = Math.sqrt(1 - uy * uy), rad = 0.4 + r() * 0.6;
        const c = [CCm[0] + Math.cos(fi) * rh * rad * KRx, CCm[1] + uy * rad * KRy, CCm[2] + Math.sin(fi) * rh * rad * KRx], st = KRx * (0.3 + r() * 0.12);
        const t = Math.max(kb, Math.min(0.96, (c[1] - st * 0.6) / H)), bp = stam(t), e = lerp3(bp, c, 0.72);
        ror(B, [[...bp, 0.12 * (1.1 - t)], [...e, 0.03]], 4, UT, 1, y => farg(y).map(v => v * 0.45));
        // klumpen: 12 korsade kort i blandade riktningar; mörk inuti och undertill, ljus ytterst och i toppen
        for (let q = 0; q < 12; q++) {
          const a = r() * 6.283, cy = r() * 1.7 - 0.75, rr = 0.35 + 0.65 * Math.sqrt(r()), ch = Math.sqrt(Math.max(0, 1 - cy * cy));
          const p = [c[0] + Math.cos(a) * ch * rr * st, c[1] + cy * rr * st * 0.6, c[2] + Math.sin(a) * ch * rr * st];
          const ut = Math.hypot((p[0] - CCm[0]) / KRx, (p[1] - CCm[1]) / KRy, (p[2] - CCm[2]) / KRx), ao = (0.32 + 0.68 * mjuk(0.2, 1, ut)) * (0.6 + 0.4 * mjuk(-0.8, 0.8, (p[1] - c[1]) / st)) * (0.9 + 0.2 * r());
          const n0 = norm([Math.cos(a) * 0.6 + (r() - 0.5) * 0.8, 0.5 + cy * 0.4 + r() * 0.4, Math.sin(a) * 0.6 + (r() - 0.5) * 0.8]);
          kluster(Lv, r, p, st * (0.5 + 0.3 * r()), n0, 0.7, 3, [ao * 0.9, ao, ao * 0.95], nfK, 0, 0.012);
        }
      }
      return { bark: B, lov: Lv, H };
    }
    const klump = (p, st) => {
      const q = Math.hypot(p[0], p[2]) / R, ao = (0.45 + 0.55 * mjuk(0.1, 1, q)) * (0.8 + 0.25 * mjuk(0.6 * H, H, p[1])) * (0.9 + 0.2 * r());
      // tofsarna i volym: varje klump får både liggande och stående korsade kort (k ≥ 4: stående, normal nästan vågrät),
      // så att kronan aldrig visar tunna skivor från sidan (syntes i impostorbilderna som utklippta platta kort)
      for (let k = 0; k < 6; k++) {
        const pk = [p[0] + (r() - 0.5) * st * 0.75, p[1] + (r() - 0.5) * st * 0.3, p[2] + (r() - 0.5) * st * 0.75];
        const nk0 = k < 4 ? norm([(r() - 0.5) * 1.8, 0.7, (r() - 0.5) * 1.8]) : norm([Math.cos(k * 1.9 + r()), 0.15, Math.sin(k * 1.9 + r())]);
        kluster(Lv, r, pk, st * (0.75 + 0.4 * r()), nk0, 1, 3, [ao, ao, ao], nf, sno && r() < 0.6 ? 0.85 : 0, 0.012);
      }
    };
    const nG = 15 + (r() * 5 | 0);
    for (let g = 0; g < nG; g++) {
      const t = 0.48 + 0.48 * (g + r() * 0.8) / nG, s0 = stam(t), az = g * 2.4 + r() * 1.2, el = 0.12 + r() * 0.45, L = (1.4 + 3.8 * (1 - (t - 0.48) / 0.48)) * (0.65 + 0.6 * r());
      const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      const P = u => [s0[0] + d[0] * L * u, s0[1] + d[1] * L * u - 0.15 * L * u * u, s0[2] + d[2] * L * u];
      ror(B, [0, 0.5, 1].map(u => [...P(u), 0.09 * (1 - 0.7 * u) * (1.2 - t) + 0.01]), 4, UT, 1, y => farg(y).map(v => v * 0.5));
      klump(P(1), 2.0);
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
      const hl = (0.8 + r() * 1.3) * (0.6 + 0.5 * u), bw = 0.19 + r() * 0.12, q = Math.hypot((p[0] - cc[0]) / R, (p[1] - cc[1]) / Ry, (p[2] - cc[2]) / R);
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
    // strandtall: stammen böjer sig ut åt +x (mot vattnet när den vrids rätt), kronan följer med
    tallLut: () => {
      const A = tallArt(757, false), H = A.H;
      for (const D of [A.bark, A.lov]) for (let i = 0; i < D.P.length; i += 3) { const t = Math.max(0, D.P[i + 1]) / H; D.P[i] += H * 0.2 * t * t; }
      return A;
    },
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
  const bakaAtlas = (arter, mal = null) => korG(bakaAtlasG(arter, mal));
  // stegvis (en vinkel per steg): renderarens läge lämnas tillbaka före varje yield, så att bilden kan ritas emellan
  function* bakaAtlasG(arter, mal = null) {
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
    const rtF = ny(true), rtN = ny(false), utF = mal ? mal.rtF : slutmal(true), utN = mal ? mal.rtN : slutmal(false), U = { uMode: { value: 0 }, uSno: { value: 0 } };
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
    const lamna = () => { renderer.setRenderTarget(fore.rt); renderer.setClearColor(fore.c, fore.a); renderer.autoClear = fore.auto; };
    for (let rad = 0; rad < arter.length; rad++) {
      const namn = arter[rad];
      lamna(); yield; renderer.autoClear = false;
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
        if (k) { lamna(); yield; renderer.autoClear = false; }
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
    }
    lamna(); yield; renderer.autoClear = false;
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
    if (mal) { mal.box.splice(0, mal.box.length, ...box); mal.ms = ms; return mal; }
    return { rtF: utF, rtN: utN, box, ms, arter };
  }

  // impostorkortens skuggare (delas av färg- och djupmaterialet)
  const IMP_V = VAG_GLSL + `uniform float uTid;
    uniform vec2 uVind;
    uniform vec4 uBox[4];
    uniform float uVagMax;
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
    if ( iVagF( ip.xz, 5.5 ) > 0.5 && length( ip.xz ) < uVagMax ) transformed = vec3( 0.0, -500.0, 0.0 );   // trädet står i uppfartens glänta (vid sjön: vägen går in i skogen, ingen glugg till horisonten)
    vImpUv = vec2( position.x + 0.5, position.y ); vImpP = transformed;`;
  const IMP_PROJ = 'vec4 mvPosition = viewMatrix * vec4( transformed, 1.0 );\n    gl_Position = projectionMatrix * mvPosition;';
  const IMP_MAP = `
    vec2 ics = vec2( 0.125, 0.25 );
    vec2 iu0 = ( vec2( vK0, vRad ) + clamp( vImpUv, 0.004, 0.996 ) ) * ics, iu1 = ( vec2( vK1, vRad ) + clamp( vImpUv, 0.004, 0.996 ) ) * ics;
    vec4 tI = mix( texture2D( map, iu0 ), texture2D( map, iu1 ), smoothstep( 0.32, 0.68, vKf ) );   // skarpare övergång mellan vinklarna (annars syntes två eller tre stammar)
    // förmultiplicerad atlas: nästan tomma texlar kastas, och division med ett golv (annars förstärks
    // 8-bitarsbruset i kanterna till ljusa prickar)
    if ( tI.a < 0.1 ) discard;
    tI.rgb /= max( tI.a, 0.3 );
    tI.rgb *= mix( 0.72, 1.0, smoothstep( 0.15, 0.6, tI.a ) );   // tunna kanttexlar mörkare: inga ljusa glitterprickar mot himlen
    { vec2 dd = fwidth( iu0 ) * ${IMP.toFixed(1)}; tI.a *= 1.0 + max( log2( max( max( dd.x, dd.y ), 1e-4 ) ), 0.0 ) * 0.4; }
    diffuseColor *= tI;`;
  function impMaterial(A) {
    const U = { uImpN: { value: A.rtN.texture }, uBox: { value: A.box.concat([0, 0, 0, 0].map(() => new THREE.Vector4())).slice(0, 4) }, uVagA: VU.uVagA, uVagB: VU.uVagB, uVagMax: { value: A.vagMax || 1e5 } };
    // alphaToCoverage: den verkliga orsaken till sågtandskanterna var alfatestet (varje pixel helt in eller
    // ut). Med a2c blir kanten MSAA-utjämnad; three skärper alfan med fwidth, så inget brus av mipnivåerna.
    // Samma enda programvariant som förut (kompileras när miljön byggs), djupmaterialet har kvar alfatestet.
    const m = new THREE.MeshLambertMaterial({ map: A.rtF.texture, alphaTest: 0.45, alphaToCoverage: MSAA, side: THREE.DoubleSide });
    m.onBeforeCompile = s => {
      Object.assign(s.uniforms, U, { uTid: VU.uTid, uVind: VU.uVind, uNatt: VU.uNatt, miljoLjus: LJUS, uHus: VU.uHus, uSSS: VU.uSSS, uSol: VU.uSol });
      s.vertexShader = IMP_V + s.vertexShader
        .replace('#include <begin_vertex>', IMP_BEGIN(false))
        .replace('#include <project_vertex>', IMP_PROJ)
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4( transformed, 1.0 );');
      s.fragmentShader = 'uniform sampler2D uImpN;\nuniform vec4 uHus;\nuniform float uNatt;\nuniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform vec3 uSol;\nvarying vec2 vImpUv; varying vec3 vR; varying vec3 vF; varying float vK0; varying float vK1; varying float vKf; varying float vRad; varying vec3 vImpP;\n' + s.fragmentShader
        .replace('#include <map_fragment>', NARA_GLSL('vImpP') + IMP_MAP)
        // natt: hela täckningen igen (mörka kronor mot ljusare dis gav ljusa prickar i de utjämnade kanterna)
        .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n    diffuseColor.a = mix( diffuseColor.a, 1.0, smoothstep( 0.2, 0.6, uNatt ) );')
        .replace('#include <color_fragment>', '#include <color_fragment>\n    diffuseColor.rgb *= mix( 0.74, 1.1, smoothstep( 0.3, 0.95, vImpUv.y ) );   // kronan mörkare undertill, ljusare i toppen\n    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.6, 0.68, 0.92 ), uNatt * 0.75 );   // natt: dovare och månblå\n    diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );   // natt: snön på grenarna dämpas (lyste som vitt brus mot de mörka kronorna)')
        .replace('#include <normal_fragment_begin>', `
    float faceDirection = 1.0;
    vec4 inp = mix( texture2D( uImpN, iu0 ), texture2D( uImpN, iu1 ), smoothstep( 0.32, 0.68, vKf ) );
    vec3 inb = mix( vec3( 0.0, 0.7, 0.7 ), inp.xyz / max( inp.w, 0.02 ) * 2.0 - 1.0, smoothstep( 0.1, 0.4, inp.w ) );
    vec3 inW = normalize( inb.x * vR + inb.y * vec3( 0.0, 1.0, 0.0 ) + inb.z * vF );
    // natt: inga ljusa kanter mot kameran – normalen dras mot rakt upp (månljus ovanifrån)
    inW = normalize( mix( inW, vec3( 0.0, 1.0, 0.0 ), uNatt * 0.6 ) );
    vec3 normal = normalize( ( viewMatrix * vec4( inW, 0.0 ) ).xyz );
    vec3 nonPerturbedNormal = normal;`)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;' +
          '\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uSSS * ( 0.25 + 1.4 * pow( max( dot( normalize( vImpP - cameraPosition ), uSol ), 0.0 ), 4.0 ) );   // genomlysning mot solen');
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
  // bara: valfri lista med arter som får bli 3D (t.ex. björkarna vid sjön, som blev pixliga som kort)
  function naraTrad(V, n = 3, rmax = 30, bara = null) {
    const kand = V.barr.map((e, i) => ({ e, i, d: Math.hypot(e.x, e.z) })).filter(o => o.d < rmax && (!bara || bara.includes(o.e.art))).sort((a, b) => a.d - b.d).slice(0, n);
    const bort = new Set(kand.map(o => o.i));
    kand.forEach(({ e }) => {
      const A = art(e.art), s = e.hh / A.H;
      lagg(V.bark, A.bark, e.x, e.y, e.z, s, e.ry, A.H, 0.006);
      lagg(V.nara, A.lov, e.x, e.y, e.z, s, e.ry, A.H, 0.006, [e.c.r, e.c.g, e.c.b]);
    });
    V.barr = V.barr.filter((e, i) => !bort.has(i));
  }
  // bygger miljöns impostorer: bakar atlasen (en gång per miljö) och plockar ut de nära 3D-träden
  const traden = (...a) => korG(tradenG(...a));
  function* tradenG(V, arter, nNara = 3, rmax = 30, bara = null, vagMax = 1e5) {
    naraTrad(V, nNara, rmax, bara);
    yield;
    const A = yield* bakaAtlasG(arter); A.vagMax = vagMax;
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
      (F.klung || []).length + (N.V.klung || []).length ? NATUR.lovklungor([...(F.klung || []), ...(N.V.klung || [])], 'lovklungor-' + namn) : null,   // nära lövträd: kronor av riktiga lövkvistar (fjärr- och närsetets)
      vegMesh('markvaxter', N.V.mark, mat('vaxt'), false, true),
      vegMesh('grasmatta', N.V.matta, mat('matta'), false, true),
      F.barr,
      // tre grundformer av sten (varannan/var tredje får en annan)
      // (form: en given grundform, t.ex. de släta hällarna vid sjön – då blir de andra näten tomma och ritas inte)
      ...['sten', 'sten1', 'sten2'].map((k, j) => instanser('stenar' + (j || ''), geo(k), mat('sten'), N.sten.filter((e, i) => (e.form ?? i % 3) === j), true, true)),
      instanser('stig', geo('platta'), mat('platta'), N.platta, false, true),
      instanser('drivor', geo('driva'), mat('driva'), F.drivor.concat(N.drivor), false, true),
      instanser('flackar', geo('flack'), mat('flack'), F.flack.concat(N.flack)),
      N.tramp,
      ...(F.extra || []), ...N.extra,          // vid sjön: vatten och brygga; villaområdet: gata och grannhus
      liv.faglar, liv.fall, liv.dimma, liv.glod,
    ].forEach(m => m && g.add(m));
    g.userData.liv = liv;
    return g;
  }
  const narSet = (V, flack) => ({ V, flack, sten: [], platta: [], drivor: [], glod: [], tramp: null, extra: [] });

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
  function* tradgardFjarrG() {   // stegvis (se byggG)
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
    yield;
    for (let f = 0, n = 0; f < 9000 && n < 320; f++) {
      if (!(f & 127)) yield;
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
    yield;
    for (let i = 0; i < 240; i++) {
      if (!(i & 31)) yield;
      const a = (i + r() * 0.6) / 240 * Math.PI * 2, gles = fbm(Math.cos(a) * 2 + 20, Math.sin(a) * 2);
      if (gles < 0.3) continue;
      const d = 95 + r() * 28, x = Math.cos(a) * d, z = Math.sin(a) * d, k = 0.85 + gles * 0.3;
      if (r() < 0.7) trad('gran2', x, z, (16 + r() * 4) * k); else trad('ek', x, z, (11 + r() * 3) * k);
    }
    // björkgrupperna (~20 m) blir riktiga 3D-träd (~1k trianglar styck): som impostorer blev de
    // pixliga block när kameran stod nära
    yield;
    const FB = fabBjorkar(V, 5, 50);   // björkgrupperna närmast: Fab-björkar (husritare-fab.js), resten som förut
    const T = yield* tradenG(V, ['bjork', 'gran', 'ek'], 8 - FB.length);
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), klung: V.klung, mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor: [], upp,
      extra: FB.length ? [behall(FAB.bjorkar(FB))] : [],
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
    // gräsmattan: 3D-tuvor (images/3d/gras-tuvor.glb) i stället för de korta stråna, tätast nära huset
    // (ett ritanrop och ungefär lika många trianglar som stråna hade); egen slump, så att resten av tomten står kvar
    { const tf = (x, z, m) => !mal.blockerad(x, z, m) && kant(x, z) > gb + 0.8; N.extra.push(tuvGrupp(tuvPoster(mal, slump(4242), hy, tf, 22, 0).map(p => Object.assign(p, { typ: 0 })))); }
    N.sten.forEach(e => { const p = new THREE.Vector3().setFromMatrixPosition(e.m); tuvring(p.x, p.z, 7, 0.75, 0.22, 0.4); });
    // vår tomt: rabatter vid husgrunden, buskar och buxbom vid trappan, spjälstaket fram och häckar på sidorna (egen slump)
    tomtGrund(mal, V, N, slump(4545), hy, trad, 'tradgard');
    N.extra.push(bjvGrupp(bjvPoster(mal, hy, slump(4747), 'tradgard')));   // fotoskannade småväxter runt tomten
    N.extra.push(vagDetaljer(mal, V, hy, 'tradgard'));   // elstolpar med ledningar långt bakom huset
    N.extra.push(VP.grupp(VP.tradgard({ mal, hy, sten: stenPunkter(N.sten) })));   // gräs och markväxter i klumpar (husritare-vaxter.js)
    N.extra.push(NATUR.grupp(kantvaxter({ r: slump(5101), hy, ok: krav, upp, sten: stenPunkter(N.sten) }), { namn: 'ph-natur-tradgard' }));   // nässlor, syror, maskrosor och buskar (husritare-natur.js)
    // kväll: stolplampor längs stigen och en ljusslinga i ett fruktträd (tänds sist); pollarna i småsakernas nät
    // (barkens nät rastrerar bort det som står i siktlinjen: en pollare nära kameran blev en prickig pinne)
    { const LS = samling(); lampor(LS, N.glod, mal, hy, false); const m = vegMesh('ting', LS, egenMat('ting', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), { glod: true })), true, true); if (m) N.extra.push(m); }
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

  // ---- gemensamt för Vid sjön och Villaområdet ----
  const egenMat = (namn, fn) => MAT[namn] || (MAT[namn] = spara(fn()));
  // stenarnas fötter som [x, z, radie] (gräsklumpar runt stenarna, husritare-vaxter.js)
  function stenPunkter(L) { const p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion(); return L.filter(e => e.m).map(e => { e.m.decompose(p, q, s); return [p.x, p.z, Math.max(s.x, s.z) * 0.55 + 0.25]; }); }
  const lada = () => GEO.lada || (GEO.lada = spara(new THREE.BoxGeometry(1, 1, 1)));
  const VARMT = [1, 0.66, 0.34];
  // gräskant mot singelbädden och korta strån på gräsmattan (som i trädgården)
  function grasKant(mal, kant, vaxt, matta, r, tint, antal = 2200) {
    const { L, W } = mal, gb = grundBredd(mal);
    for (let i = 0; i < 260; i++) {
      const t = r() * 2 * (L + W), d = gb + 0.04 + Math.pow(r(), 2) * 0.7, s = 0.12 + r() * 0.07;
      let x, z;
      if (t < L) { x = -L / 2 + t; z = -W / 2 - d; } else if (t < L + W) { x = L / 2 + d; z = -W / 2 + t - L; }
      else if (t < 2 * L + W) { x = L / 2 - (t - L - W); z = W / 2 + d; } else { x = -L / 2 - d; z = W / 2 - (t - 2 * L - W); }
      if (mal.blockerad(x, z, 0.62)) continue;
      vaxt('gras', x, z, s, ton(r, [0.56, 0.7, 0.4]));
    }
    matta(mal, kant, antal, 0.1, 0.18, tint, gb);
  }

  // ---- Vid sjön ----
  // Vattnet: ett polärt nät bara där botten ligger under ytan. Standardmaterial (fresnel och spegling av
  // himlen ur scenens omgivning, solglitter i vågnormalerna), grunt vatten ljusare och brunare mot
  // stranden, ett tunt skumband i strandkanten. Vågorna är två rullande samplingar ur en 256-karta.
  function vattenMesh() {
    const RI = 34, SK = 88, pos = [], nor = [], dj = [], idx = [];
    for (let i = 0; i <= RI; i++) {
      const rr = 8 + (RMAX - 8) * Math.pow(i / RI, 1.7);
      for (let j = 0; j < SK; j++) { const a = (j + (i % 2) * 0.5) / SK * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr; pos.push(x, VY, z); nor.push(0, 1, 0); dj.push(VY - hojdKust(x, z)); }
    }
    const V = (i, j) => i * SK + (j % SK);
    for (let i = 0; i < RI; i++) for (let j = 0; j < SK; j++) {
      const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j), d = V(i + 1, j + 1);
      if (Math.max(dj[a], dj[b], dj[c], dj[d]) > -6) idx.push(a, b, c, b, d, c);   // stranden skärs i skuggaren mot djupkartan (husritare-sjo.js)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aDjup', new THREE.Float32BufferAttribute(dj, 1));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = egenMat('vatten', () => SJO.vattenMat());   // husritare-sjo.js
    const o = new THREE.Mesh(g, m);
    o.name = 'vatten'; o.receiveShadow = true; o.matrixAutoUpdate = false; o.userData.egen = true;
    return SJO.vattenKrok(o);   // speglingen i realtid
  }
  // Strandremsan: ett finare nät (1,2 m × ~0,8 m) längs strandlinjen närmast tomten, i markens material. Marknätet
  // är 3 m grovt, så strandkanten blev raka linjer; här följer kanten höjdfunktionen plus ett litet brus (stenar och
  // svackor), och markens skuggare ger hällar, grus, våt rand och mossa. Remsan ligger en aning över det grova nätet.
  function strandRemsa(material) {
    const NL = 118, DQ = [-4.5, -3, -2, -1.2, -0.5, 0.2, 1.0, 2.2], pos = [], uv = [], col = [], idx = [];
    const K0 = KUST[0], K1 = KUST[1];
    for (let i = 0; i <= NL; i++) {
      const l = -70 + 140 * i / NL;
      let qs = null;
      for (let q = 4; q < 45; q += 0.25) { const x = q * K0 - l * K1, z = q * K1 + l * K0; if (hojdKust(x, z) < VY) { qs = q; break; } }
      if (qs === null) qs = 45;
      DQ.forEach(dq => {
        const q = qs + dq, x = q * K0 - l * K1, z = q * K1 + l * K0;
        const b = (fbm(x * 0.45 + 3, z * 0.45) - 0.5) * 0.5 + (fbm(x * 1.3, z * 1.3 + 7) - 0.5) * 0.18;
        pos.push(x, hojdKust(x, z) + 0.04 + b * mjuk(-4.5, -0.5, dq), z); uv.push(x, z); col.push(...kustFarg(x, z));
      });
    }
    const R = DQ.length;
    for (let i = 0; i < NL; i++) for (let k = 0; k < R - 1; k++) { const a = i * R + k, c = (i + 1) * R + k; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // normalerna pekar uppåt oavsett vridning (nätet byggs i båda riktningar)
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    g.computeBoundingSphere();
    const o = new THREE.Mesh(g, material);
    o.name = 'strand'; o.receiveShadow = true; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }
  // bryggan: gråa, väderbitna brädor på tvären, två bärlinor och stolpar ner i botten. Lådorna läggs i
  // barkgeometrin (inget eget ritanrop); hörnfärgen tonar barktexturens gråbruna remsa till trä.
  const LADA3 = (...a) => lada3(...a);
  function lada3(D, c, A, h, f, uv = null) {   // A: högerorienterade axlar [a0, a1, a2], h: halva mått längs dem
    // uv = [u0, ubredd, v0]: egen bit av texturen (en bräda ur fotot och en förskjutning längs den), annars barkens remsa
    const u0 = uv ? uv[0] : UG[0], uw = uv ? uv[1] : UG[1] - UG[0], v0 = uv ? uv[2] : 0;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const n = A[i].map(v => v * s), a = A[(i + 1) % 3], b = A[(i + 2) % 3], ha = h[(i + 1) % 3], hb = h[(i + 2) % 3], bas = D.P.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sa, sb]) => hp(D, c[0] + n[0] * h[i] + a[0] * ha * sa + b[0] * hb * sb, c[1] + n[1] * h[i] + a[1] * ha * sa + b[1] * hb * sb, c[2] + n[2] * h[i] + a[2] * ha * sa + b[2] * hb * sb,
        n[0], n[1], n[2], u0 + uw * (sa + 1) / 2, v0 + (sb + 1) * hb, f));
      if (s > 0) D.I.push(bas, bas + 1, bas + 2, bas, bas + 2, bas + 3); else D.I.push(bas, bas + 2, bas + 1, bas, bas + 3, bas + 2);
    }
  }
  // Skannade strandstenar (images/3d/strandsten.glb: förenklad fotoskanning, 12 000 trianglar, gjord med
  // team-miljo4/konvertera-sten.py). Laddas i bakgrunden in i en grupp; en kopia längs strandlinjen till vänster om
  // huset i startvyn, långsidan längs stranden och nedre delen under vattenytan, så att den växer ihop med grus och vatten.
  function strandstenar() {
    const grupp = new THREE.Group(); grupp.name = 'strandstenar'; grupp.matrixAutoUpdate = false;
    // Skanningen är en sluttande stenbank (hög vid lokala −z, låg vid +z). Ytan vetter åt det låga hållet, så den måste
    // luta MOT kameran: den låga kanten läggs mot land (begravd i marken) och den höga ryggen ut mot vattnet, där
    // vattnet skär den. Vänd åt andra hållet såg man bara baksidan från tomten (bortskuren, osynlig med FrontSide).
    // Två kopior (ett instansat nät): vänster om bryggan och till höger bakom grillen, olika skala och vridning.
    // (en andra kopia vid −181° fick inte plats i triangelbudgeten; lägg till här om budgeten tillåter)
    const poster = [[-177, 0.44, 0.12]].map(([grad, sk, vr]) => {   // (vid −163° gick bryggan rakt genom stenbanken)
      const g = grad * Math.PI / 180, dx = Math.cos(g), dz = Math.sin(g);
      let dS = 22; for (let d = 8; d < 60; d += 0.25) if (hojdKust(dx * d, dz * d) < VY) { dS = d; break; }
      const x = dx * dS - KUST[0] * 1.4, z = dz * dS - KUST[1] * 1.4;   // landkanten på stranden, ryggen ute i vattnet
      return matris(x, VY - 0.72, z, sk, sk * 1.05, sk, Math.atan2(-KUST[0], -KUST[1]) + vr);   // landkanten ner i sanden
    });
    new GLTFLoader().load('images/3d/strandsten.glb', gl => {
      let nat = null; gl.scene.traverse(o => { if (o.isMesh && !nat) nat = o; });
      if (!nat) return;
      // mjuka normaler: den förenklade skanningen hade platta facetter (skarpa skärvor). Normalerna medelvärdesbildas
      // över alla hörn i samma läge, normalkartan tonas ner och färgen dras lite mot ljus grå granit
      { const g = nat.geometry; if (!g.attributes.normal) g.computeVertexNormals();
        const p = g.attributes.position, n = g.attributes.normal, acc = new Map(), k = i => `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`;
        g.computeVertexNormals();
        for (let i = 0; i < p.count; i++) { const kk = k(i), v = acc.get(kk) || [0, 0, 0]; v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i); acc.set(kk, v); }
        for (let i = 0; i < p.count; i++) { const v = acc.get(k(i)), l = Math.hypot(v[0], v[1], v[2]) || 1; n.setXYZ(i, v[0] / l, v[1] / l, v[2] / l); }
        n.needsUpdate = true; }
      const m = nat.material; m.envMapIntensity = 1; m.roughness = 0.9; MAT.strandsten = m; skrap.push(m, nat.geometry);
      if (m.normalScale) m.normalScale.multiplyScalar(0.45);
      if (m.color) m.color.setRGB(1.12, 1.08, 1.04);
      if (m.map) { m.map.anisotropy = ANISO; skrap.push(m.map); } if (m.normalMap) skrap.push(m.normalMap);
      const o = new THREE.InstancedMesh(nat.geometry, m, poster.length);
      poster.forEach((M, i) => o.setMatrixAt(i, M)); o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere();
      o.matrixAutoUpdate = false;
      o.castShadow = true; o.receiveShadow = true; o.name = 'strandsten';
      grupp.add(o); grupp.updateMatrixWorld(true);
      renderer.shadowMap.needsUpdate = true;
      window.dispatchEvent(new Event('husritare:nytt'));   // motorn ritar bara vid behov: be om en ny bild (och skugga)
    }, undefined, e => console.warn('strandsten.glb', e));
    return grupp;
  }
  function bryggaDel(r, grad) {
    // varje låda (bräda, regel, stolpe) tar en av fotots fem brädor och en egen förskjutning längs den: ingen bräda likadan
    const lada3 = (D2, c, A2, h, f) => { const k = r() * 5 | 0; return LADA3(D2, c, A2, h, f, [(k + 0.06) / 5, 0.88 / 5, r() * 7]); };
    const a = grad * Math.PI / 180, dx = Math.cos(a), dz = Math.sin(a), px = dz, pz = -dx, D = del();
    const A = [[px, 0, pz], [0, 1, 0], [dx, 0, dz]];
    let dS = 20;
    for (let d = 8; d < 50; d += 0.2) if (hojdKust(dx * d, dz * d) < VY) { dS = d; break; }
    // bryggan (2,2 m bred) börjar där stranden ligger minst 10 cm under brädorna, så att inga brädor går ner i marken;
    // i yttre änden en T-del (2 m ut åt +p) där solstolarna står, så att gångvägen är fri
    const d1 = dS + 8.5, y = VY + 0.48, B = 2.2, HB = B / 2, TD = 2.0, dT = d1 - 2.8;
    let d0 = dS - 0.5; for (let d = dS - 3.5; d < dS; d += 0.1) if (hojdKust(dx * d, dz * d) + 0.1 <= y) { d0 = d; break; }
    // brädorna: grånat trä med tydlig variation mellan brädorna (ljusare silvergrå, något brunare, någon nyare), två
    // skruvar över varje bärlina
    for (let d = d0; d < d1; d += 0.165) {
      // (fotot bär färgen: brädornas egen ton är nästan neutral, bara ljusare/mörkare och en aning varmare eller kallare)
      const k = 1.15 + r() * 0.3, h = r(), t = d > dT ? TD / 2 : 0, f = h < 0.15 ? [k * 1.04, k, k * 0.95] : h < 0.4 ? [k * 0.98, k, k * 1.02] : [k, k, k];
      lada3(D, [dx * d + px * t, y, dz * d + pz * t], A, [HB + t, 0.018, 0.072], f);
      for (const s of t ? [-0.85, 0.85, HB + 0.9, HB + TD - 0.15] : [-0.85, 0.85]) for (const o of [-0.035, 0.035]) lada3(D, [dx * (d + o) + px * s, y + 0.019, dz * (d + o) + pz * s], A, [0.007, 0.002, 0.007], [0.22, 0.2, 0.19]);
    }
    const mitt = (d0 + d1) / 2;
    for (const s of [-0.85, 0.85]) lada3(D, [dx * mitt + px * s, y - 0.1, dz * mitt + pz * s], A, [0.04, 0.075, (d1 - d0) / 2], [1.05, 1.02, 0.96]);
    // kantbräda längs sidorna (täcker bärlinornas ändar och ger bryggan en tjocklek), runt T-delen och tvärs över änden
    const kantB = (pc, dc, hp, hd) => lada3(D, [dx * dc + px * pc, y - 0.055, dz * dc + pz * pc], A, [hp, 0.075, hd], [1.3, 1.27, 1.2]);   // grått trä, inte svart
    kantB(-HB - 0.015, mitt, 0.016, (d1 - d0) / 2 + 0.02);
    kantB(HB + 0.015, (d0 + dT) / 2, 0.016, (dT - d0) / 2);
    kantB(HB + TD + 0.015, (dT + d1) / 2, 0.016, (d1 - dT) / 2 + 0.08);
    kantB(HB + TD / 2, dT - 0.08, TD / 2 + 0.02, 0.016);
    kantB(TD / 2, d1 + 0.07, HB + TD / 2 + 0.03, 0.016);
    // T-delen: bärlinor och stolpar ner i botten
    for (const s of [HB + 0.9, HB + TD - 0.15]) {
      lada3(D, [dx * (dT + d1) / 2 + px * s, y - 0.1, dz * (dT + d1) / 2 + pz * s], A, [0.04, 0.075, (d1 - dT) / 2], [1.05, 1.02, 0.96]);
      for (const d of [dT + 0.1, (dT + d1) / 2, d1 - 0.1]) { const x = dx * d + px * s, z = dz * d + pz * s, bt = hojdKust(x, z) - 0.4; lada3(D, [x, (y + bt) / 2 - 0.02, z], A, [0.085, (y - bt) / 2, 0.085], [1.15, 1.12, 1.06]); lada3(D, [x, VY - 0.08, z], A, [0.09, 0.1, 0.09], [0.55, 0.78, 0.32]); }
    }
    // stenkista i yttre änden: knuttimrad låda av grova stockar (fylld med sten), syns ovanför vattnet
    const dK = d1 - 1.05, gK = hojdKust(dx * dK, dz * dK) - 0.3;
    for (let k = 0, yy = y - 0.2 - 0.085; yy > gK; k++, yy -= 0.17) {
      const t = (yy < VY + 0.02 && yy > VY - 0.2 ? 0.75 : 1.1) + 0.15 * ((k * 7) % 3) / 2;
      if (k % 2 === 0) for (const s of [-HB + 0.04, HB - 0.04]) lada3(D, [dx * dK + px * s, yy, dz * dK + pz * s], A, [0.085, 0.085, 1.08], [t, t * 0.97, t * 0.92]);
      else for (const s of [-0.95, 0.95]) lada3(D, [dx * (dK + s) , yy, dz * (dK + s)], A, [HB + 0.08, 0.085, 0.085], [t, t * 0.97, t * 0.92]);
    }
    // stolpar: kraftiga, ner i botten där det är vatten under, korta stolpar nedgrävda i stranden vid landfästet;
    // ett tvärgående ok under bärlinorna vid varje stolppar (inga stolpar inne i stenkistan)
    for (let d = d0 + 0.3; d <= d1 + 0.01; d += 1.95) {
      if (d > dK - 1.3) continue;
      let ok = false;
      for (const s of [-HB + 0.08, HB - 0.08]) {
        const x = dx * d + px * s, z = dz * d + pz * s, g = hojdKust(x, z), b = g - (g < VY ? 0.4 : 0.05);
        if (y - b > 0.1) {
          lada3(D, [x, (y + b) / 2 - 0.02, z], A, [0.085, (y - b) / 2, 0.085], [1.15, 1.12, 1.06]); ok = true;
          if (g < VY - 0.1) lada3(D, [x, VY - 0.08, z], A, [0.09, 0.1, 0.09], [0.55, 0.78, 0.32]);   // gröna alger i vattenlinjen
        }
      }
      if (ok) lada3(D, [dx * d, y - 0.215, dz * d], A, [HB + 0.02, 0.06, 0.055], [0.68, 0.66, 0.62]);
    }
    // landfäste: en grov tvärbalk på stenar där bryggan möter stranden
    { const g = hojdKust(dx * d0, dz * d0); lada3(D, [dx * (d0 + 0.08), (y - 0.04 + g - 0.1) / 2, dz * (d0 + 0.08)], A, [HB, (y - 0.04 - g + 0.1) / 2, 0.08], [0.75, 0.72, 0.68]); }
    // spången från tomten ner till bryggan: tvärlagda brädor på två reglar, följer marken, samma brädor som bryggan
    // (fjärrsetet: börjar strax utanför det största husets hörn, så den aldrig går in i ett hus)
    const dStart = Math.min(6.25 / Math.max(Math.abs(dx), 1e-3), 3.5 / Math.max(Math.abs(dz), 1e-3)) + 2.2;
    // Brädorna samlas i plana avsatser; där marken faller mer än 17 cm börjar ett nytt steg med ett sättsteg, och
    // varje avsats får vangstycken på sidorna ner i marken (en riktig trätrappa i stället för lösa brädor i sluttningen)
    const steg = []; let cur = null;
    // (spången är 1,1 m bred, smalare än bryggan, och går ända fram till bryggans början)
    const SB = 0.55;
    for (let d = dStart; d < d0 - 0.1; d += 0.19) {
      const yg = Math.max(hojdKust(dx * d, dz * d) + 0.12, y - 0.01);   // aldrig under bryggans nivå: sista biten blir en plan avsats
      if (!cur || yg > cur.y + 0.015 || yg < cur.y - 0.17) { cur = { a: d, b: d, y: yg, g: hojdKust(dx * d, dz * d) + 0.12 }; steg.push(cur); }
      cur.b = d; cur.g = Math.min(cur.g, hojdKust(dx * d, dz * d) + 0.12);
    }
    steg.forEach((st, i) => {
      for (let d = st.a; d <= st.b + 0.001; d += 0.19) { const k = 1.15 + r() * 0.3; lada3(D, [dx * d, st.y, dz * d], A, [SB, 0.016, 0.08], [k, k, k]); }   // fotots grånade trä
      const m = (st.a + st.b) / 2, hl = (st.b - st.a) / 2 + 0.09, bot = st.g - 0.25, top = st.y - 0.018;
      for (const s of [-SB - 0.015, SB + 0.015]) lada3(D, [dx * m + px * s, (top + bot) / 2, dz * m + pz * s], A, [0.022, (top - bot) / 2, hl], [0.95, 0.97, 1.02]);
      const fg = steg[i - 1];
      if (fg) { const hi = Math.max(fg.y, st.y), lo = Math.min(fg.y, st.y) - 0.03, dd = st.a - 0.095; lada3(D, [dx * dd, (hi + lo) / 2, dz * dd], A, [SB, (hi - lo) / 2, 0.014], [1.0, 1.02, 1.06]); }   // sättsteg
    });
    // sista avsatsen möter bryggan: ett sättsteg om nivåerna skiljer
    { const sl = steg[steg.length - 1];
      if (sl && Math.abs(sl.y - y) > 0.03) { const hi = Math.max(sl.y, y), lo = Math.min(sl.y, y) - 0.03, dd = sl.b + 0.095; lada3(D, [dx * dd, (hi + lo) / 2, dz * dd], A, [SB, (hi - lo) / 2, 0.014], [1.0, 1.02, 1.06]); } }
    // ledstång på ena sidan av trappan: stolpar var 1,5 m och en handledare som följer stegen
    if (steg.length > 1) {
      const yVid = d => (steg.find(st => d <= st.b + 0.1) || steg[steg.length - 1]).y, s = -SB - 0.08, topp = [];
      for (let d = dStart + 0.15; d < d0 - 0.4; d += 1.9) topp.push([dx * d + px * s, yVid(d) + 0.9, dz * d + pz * s]);
      if (topp.length > 1) {
        topp.forEach(([x, yt, z]) => { const g = hojdKust(x, z) - 0.15; lada3(D, [x, (yt + g) / 2, z], A, [0.04, (yt - g) / 2, 0.04], [0.62, 0.58, 0.52]); });   // gråbrunt trä, inte ljust
        for (let i = 0; i + 1 < topp.length; i++) {
          const p = topp[i], q = topp[i + 1], v = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(...v), a2 = v.map(c => c / l), a0 = [px, 0, pz];
          const a1 = [a2[1] * a0[2] - a2[2] * a0[1], a2[2] * a0[0] - a2[0] * a0[2], a2[0] * a0[1] - a2[1] * a0[0]];   // a2 × a0
          lada3(D, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.02, (p[2] + q[2]) / 2], [a0, a1, a2], [0.03, 0.022, l / 2 + 0.04], [0.68, 0.64, 0.58]);
        }
      }
    }
    return { D, x: dx * (d1 - 0.35) + px * 0.85, z: dz * (d1 - 0.35) + pz * 0.85, y: y + 0.02, dx, dz, px, pz, d0, d1, dS, dStart, HB, TD, dT };
  }
  // småsaker vid sjön (ting-nätet): badstege, solstolar (ekan byggs i husritare-sjo.js)
  const STEGE = (() => { let D = null; return () => D || (D = (() => {
    const E = del(), A = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], f = [0.75, 0.76, 0.78];   // lokalt: stegen hänger i +z-kanten, ner i vattnet
    for (const x of [-0.25, 0.25]) { lada3(E, [x, -0.45, 0.05], A, [0.022, 0.95, 0.022], f); lada3(E, [x, 0.55, -0.12], A, [0.022, 0.022, 0.2], f); }
    for (let y = -1.2; y < 0.4; y += 0.3) lada3(E, [0, y, 0.05], A, [0.25, 0.018, 0.035], f);
    return E;
  })()); })();
  const SOLSTOL = (() => { let D = null; return () => D || (D = (() => {
    // solstol (vilstol) i oljad teak: ram med sidostycken, fyra ben med tvärslåar, spjälad sits och ställbar rygg
    // (ryggen bakåt = lokala −z), tjock tygdyna i blåvit rand längs stolen och en nackkudde
    const E = del(), A = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], tra = [0.6, 0.45, 0.3], traM = [0.46, 0.34, 0.22], vit = [0.92, 0.91, 0.87], bla = [0.2, 0.31, 0.5];
    const th = 0.9, c = Math.cos(th), s = Math.sin(th), AR = [[1, 0, 0], [0, c, s], [0, -s, c]], R0 = [0, 0.52, -0.6];   // ryggens mitt; lokala z längs ryggen (nedåt-framåt)
    const rp = (t, o) => [R0[0], R0[1] - s * t + c * o, R0[2] + c * t + s * o];   // punkt på ryggen: t längs, o ut från ytan
    for (const x of [-0.31, 0.31]) {
      lada3(E, [x, 0.27, 0.25], A, [0.022, 0.05, 0.74], tra);                                  // sidostycken
      for (const z of [-0.42, 0.92]) lada3(E, [x, 0.12, z], A, [0.024, 0.12, 0.028], traM);    // ben
      lada3(E, [x, ...rp(0, -0.02).slice(1)], AR, [0.02, 0.03, 0.4], tra);                     // ryggens sidor
      lada3(E, [x, 0.3, -0.75], A, [0.018, 0.018, 0.16], traM);                                // stödet bakom ryggen
    }
    for (const z of [-0.42, 0.92]) lada3(E, [0, 0.13, z], A, [0.3, 0.018, 0.018], traM);       // tvärslåar mellan benen
    for (let z = -0.42; z < 0.97; z += 0.095) lada3(E, [0, 0.3, z], A, [0.29, 0.009, 0.034], tra);   // sitsens spjälor
    for (let t = -0.34; t < 0.37; t += 0.095) lada3(E, rp(t, 0), AR, [0.29, 0.009, 0.034], tra);   // ryggens spjälor
    // dynan: sju ränder längs stolen (blå, vit …), sits och rygg, med en mörkare söm i varje kant
    for (let i = 0; i < 7; i++) {
      const x = -0.27 + (i + 0.5) * 0.54 / 7, f = i % 2 ? vit : bla, kf = i === 0 || i === 6 ? 0.85 : 1, h = i === 0 || i === 6 ? 0.026 : 0.032;
      lada3(E, [x, 0.309 + h, 0.27], A, [0.54 / 14, h, 0.68], f.map(v => v * kf));
      lada3(E, [x, ...rp(0.02, 0.009 + h).slice(1)], AR, [0.54 / 14, h, 0.36], f.map(v => v * kf));
    }
    lada3(E, rp(-0.3, 0.11), AR, [0.22, 0.05, 0.08], vit);   // nackkudde
    return E;
  })()); })();
  // ---- vid sjön: den fjärran åsen ----
  // Ett målat siluettkort 224 m ut över fjärden (ett ritanrop, 4096 × 256): en avlägsen blå ås i tre lager
  // med trädtoppar, åkrar, röda lador och ett segel. Luftperspektivet är inbakat; dimman tar resten.
  // (Närmare kort för motstranden och ridån syntes som lutande skivor: där står riktiga trädimpostorer, se kustFjarr.)
  var kustBak = null;   // var: uppdatera() kan läsa den innan raden körts
  function kustBakgrund() {
    if (kustBak) return kustBak;
    const W = 4096, RH = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = RH;
    const g = cv.getContext('2d');
    let fro = 90217;
    const rnd = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    const DIS = [170, 196, 220];                                         // luftperspektivets ton
    const rgb = (c, t = 0) => `rgb(${c.map((v, i) => Math.round(v + (DIS[i] - v) * t)).join(',')})`;
    const sv = (x, f) => Math.sin(x / W * Math.PI * 2 * f);
    // åsen (6,4 px/m): tre lager kullar med trädtoppar, åkrar med lador
    {
      const y1 = RH - 4, p = 6.4;
      const kontur = (bas, amp, f, s) => x => y1 - bas - amp * ((0.5 + 0.5 * sv(x + s * 300, f[0])) * (0.65 + 0.35 * sv(x + s * 70, f[1])) + 0.18 * sv(x, f[2]));
      const lager = (y, c, t, tand, toppar) => {
        g.fillStyle = rgb(c, t); g.beginPath(); g.moveTo(0, y1 + 4);
        for (let x = 0; x <= W; x += 4) g.lineTo(x, y(x));
        g.lineTo(W, y1 + 4); g.closePath(); g.fill();
        for (let x = rnd() * tand; x < W; x += tand * (0.5 + rnd())) {   // trädtopparna i konturen: spetsiga granar och runda lövträd
          const yy = y(x) + 1, h = tand * (1.2 + rnd() * 1.6) * toppar;
          g.beginPath();
          if (rnd() < 0.65) { g.moveTo(x - h * 0.28, yy + 1); g.lineTo(x, yy - h); g.lineTo(x + h * 0.28, yy + 1); }
          else g.ellipse(x, yy - h * 0.3, h * 0.36, h * 0.42, 0, 0, Math.PI * 2);
          g.fill();
        }
      };
      lager(kontur(70, 70, [2, 5, 13], 0.3), [86, 120, 104], 0.74, 4, 1);
      const mid = kontur(30, 52, [3, 7, 17], 1.1);
      lager(mid, [62, 92, 70], 0.56, 5, 1.1);
      // åkrar på mittlagrets sluttningar: ljusa fält, små röda lador
      [0.18, 0.43, 0.71, 0.9].forEach((f, i) => {
        const cx = W * f, bw = 90 + rnd() * 80;
        g.fillStyle = rgb(i % 2 ? [104, 128, 84] : [96, 124, 82], 0.62); g.beginPath();   // åkrar: dova, nära skogens ton (ljusa lästes som platta rutor)
        g.moveTo(cx - bw, mid(cx - bw) + 14); g.lineTo(cx + bw, mid(cx + bw) + 14); g.lineTo(cx + bw * 0.8, y1 - 8); g.lineTo(cx - bw * 0.9, y1 - 8); g.closePath(); g.fill();
        const lx = cx + (rnd() - 0.5) * bw, ly = Math.min(mid(lx) + 22, y1 - 12);
        // en liten lada långt bort, djupt i diset (kyrkan togs bort: den lästes som ett platt kort)
        g.fillStyle = rgb([128, 36, 26], 0.62); g.fillRect(lx, ly - 7, 18, 7);
        g.fillStyle = rgb([50, 46, 44], 0.62); g.fillRect(lx - 1, ly - 10, 20, 3);
      });
      lager(kontur(4, 22, [4, 11, 29], 2.3), [44, 70, 52], 0.42, 6, 1.2);
      // strandlinjen och segel långt ute
      g.fillStyle = rgb([200, 196, 184], 0.4); g.fillRect(0, y1 - 1, W, 2);
      [0.34].forEach(f => {
        const x = W * f, h = 3.8 * p;
        g.fillStyle = rgb([248, 248, 244], 0.25); g.beginPath(); g.moveTo(x, y1 - 3); g.lineTo(x, y1 - h); g.lineTo(x + h * 0.42, y1 - 3); g.closePath(); g.fill();
        g.fillStyle = rgb([226, 226, 222], 0.3); g.beginPath(); g.moveTo(x - 1, y1 - 3); g.lineTo(x - 1, y1 - h * 0.85); g.lineTo(x - h * 0.3, y1 - 3); g.closePath(); g.fill();
        g.fillStyle = rgb([230, 230, 226], 0.3); g.fillRect(x - h * 0.3, y1 - 3, h * 0.75, 3);
      });
    }
    const tex = spara(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 8;
    // korten: remsor längs bågar (vända mot huset), botten 1–1,5 m under marken
    // kortet: en lodrät remsa längs en båge (vänd mot huset), botten under vattenytan; 30 m högt, 480 m per varv i atlasen
    const pos = [], uv = [], idx = [], ROW = [[0, 1, 30, 480]];
    const remsa = (pts, rad) => {
      if (pts.length < 2) return;
      const [v0, v1, H, B] = ROW[rad];
      let u = rnd();
      pts.forEach(([x, z, y], i) => {
        if (i) u += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]) / B;
        const b = pos.length / 3; pos.push(x, y, z, x, y + H, z); uv.push(u, v0, u, v1);
        if (i) idx.push(b - 2, b, b - 1, b - 1, b, b + 1);
      });
    };
    const aK = Math.atan2(KUST[1], KUST[0]), N = 720, as = [];
    for (let i = 0; i <= N; i++) {
      const a = aK - Math.PI + i / N * Math.PI * 2, x = Math.cos(a) * 224, z = Math.sin(a) * 224;
      as.push([x, z, Math.max(VY, hojdKust(x, z)) - 0.9]);   // hela varvet: bakom landsidans skog syns också blå åsar, inte en kal horisont
    }
    remsa(as, 0);
    const geo = spara(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const mat = spara(new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, alphaToCoverage: MSAA, side: THREE.DoubleSide, fog: true }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'kust-fjarran'; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.visible = false;
    rot.add(mesh);
    return (kustBak = { mesh, mat });
  }
  function* kustFjarrG() {   // stegvis (yield): se byggG; kustFjarr() kör den i ett svep
    const r = slump(1404), { krav, S } = regler(REF), upp = [], { fri, plats } = platser(r, krav, upp);
    const hy = hojdKust, { V, flack, trad, vaxt } = verktyg(r, hy, REF.blockerad, false);
    const motVatten = Math.atan2(-KUST[1], KUST[0]);                    // ry som vrider lokala +x (lutningen) mot vattnet
    const strand = (grad, niva) => { const a = grad * Math.PI / 180; for (let d = 8; d < 90; d += 0.25) if (hy(Math.cos(a) * d, Math.sin(a) * d) < niva) return d; return null; };
    // lutande tallar på hällarna i viken (siktgatorna håller dem 32 m ut i nordväst)
    for (const g of [-62, -70, -56, 170, 162, 178, -48]) {
      const d = strand(g + (r() - 0.5) * 4, VY + 0.9); if (!d) continue;
      const [x, z] = polar(g, Math.max(d - 0.6 - r() * 1.6, 0));
      if (!krav(x, z, 'liten') || !fri(x, z, 3.2)) continue;
      upp.push({ x, z, a: 3.2 }); trad('tallLut', x, z, 0, 3.4, motVatten + (r() - 0.5) * 0.8);
    }
    // på landsidan: björkgrupper och ett par stora, ensamma björkar
    const grupp = (grad, d, n, hmin, hmax) => {
      const c = plats(grad, d, 'liten', 2.4); if (!c) return;
      // björkarna står på gräset en bit upp från stranden (förr hamnade en Fab-björk i strandsanden vid vattenbrynet)
      for (let k = 0; k < 30 && kustQ(c[0], c[1]) > 13; k++) { c[0] -= KUST[0]; c[1] -= KUST[1]; }
      trad('bjork', c[0], c[1], hmin + r() * (hmax - hmin), 4.4);
      for (let k = 1; k < n; k++) {
        const v = r() * 6.283, x = c[0] + Math.cos(v) * (2.6 + r() * 1.2), z = c[1] + Math.sin(v) * (2.6 + r() * 1.2);
        if (!krav(x, z, 'liten') || !fri(x, z, 2) || kustQ(x, z) > 14) continue;
        upp.push({ x, z, a: 2 }); trad('bjork', x, z, (hmin + r() * (hmax - hmin)) * 0.92, 4);
      }
    };
    grupp(135, S / 2 + 15, 3, 12, 15); grupp(-36, S / 2 + 24, 3, 12, 15);
    // (förr två stora lövträd: ensamma gröna klumpar på ängen; nu stora björkar, de närmaste blir Fab-björkar)
    [[25, 34 + S * 0.3], [110, 36]].forEach(([a, d]) => { const p = plats(a, d, 'stor', 5); if (p && kustQ(p[0], p[1]) < 14) trad('bjork', p[0], p[1], 12 + r() * 2.5, 4.4); });
    // ängen på landsidan (inte på hällarna)
    for (let f = 0, n = 0; f < 9000 && n < 0; f++) {   // (team-mark: avstängt – platta gräskort såg ut som pinnar; markskuggarens grässvål tar över)
      const [x, z] = polar(r() * 360, 24 + Math.pow(r(), 1.4) * 24), b = fbm(x * 0.12, z * 0.12);
      if (kustQ(x, z) > 12 || !krav(x, z, 'tuva') || b < 0.45) continue;
      vaxt('gras', x, z, (0.26 + r() * 0.16) * (0.8 + (b - 0.45) * 1.6), ton(r, ANG, 0.1)); n++;
    }
    // vass i grunt vatten (0,05–0,6 m), i ruggar; inte vid bryggan
    const BRY = -152;   // till vänster om huset i startvyn (rakt bakom skymdes bryggan)
    for (let f = 0, n = 0; f < 6000 && n < 170; f++) {
      if (!(f & 63)) yield;
      const g = -223 + r() * 190, d = 12 + r() * 50, [x, z] = polar(g, d), dj = VY - hy(x, z);
      if (dj < 0.05 || dj > 0.6 || fbm(x * 0.22 + 2, z * 0.22) < 0.47 || (Math.abs(g - BRY) < 7 && d < 36)) continue;
      vaxt('gras', x, z, 1.25 + r() * 0.75, ton(r, [0.74, 0.74, 0.46], 0.12)); n++;
    }
    // öarna: granithällar, vindpinade tallar, enar, ljung, vass och näckrosor byggs i husritare-sjo.js; här inget mer
    // (björkkorten på holmarna togs bort: de såg platta ut på nära håll)
    yield;
    const SJOF = yield* SJO.fjarrG(r);
    yield;
    // andra stranden (i diset) och skogsridån på landsidan
    // ridån: blandskog (mest gran, en del tall, lite björk) i stället för bara granar; arten dras ur ett eget
    // slumptal, så att bryggan m.m. får samma slumpföljd som förut. Fler träd läggs till efter bryggan (nedan).
    const rA = slump(2207), ridaFran = V.barr.length;
    for (let i = 0; i < 520; i++) {
      if (!(i & 31)) yield;
      const a = (i + r() * 0.6) / 520 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), mot = ca * KUST[0] + sa * KUST[1];
      let d;
      if (mot > 0.3) { if (mot > 0.82) continue; d = (126 + r() * 20) / mot; if (d > 185) continue; }   // rakt ut öppen fjärd; längre ut blev träden vita spöken i diset
      else { d = 95 + r() * 28; if (kustQ(ca * d, sa * d) > 40) continue; if (r() < 0.45) continue; }
      const x = ca * d, z = sa * d;
      if (hy(x, z) < VY + 0.5) continue;
      // (landsidan: inga björk- eller ekkort i ridån – de lästes som platta ljusgröna klistermärken; 'ek' fanns inte ens
      // i kustens atlas och ritades som lutande strandtall)
      if (mot > 0.3) trad(r() < 0.35 ? 'tall1' : 'gran2', x, z, 0); else if (r() < 0.7) { const t = rA(); trad(t < 0.66 ? 'gran2' : 'tall1', x, z, 0); } else trad('gran2', x, z, 11 + r() * 3);
    }
    yield;
    const bry = bryggaDel(r, BRY);
    yield;
    // tätare skog efter bryggan (påverkar inte dess slumpföljd): ridån på landsidan 98–135 m och en sluten
    // blandskog på motstranden (första fasta landet bortom fjärden), i stället för målade kort
    { const aK = Math.atan2(KUST[1], KUST[0]);
      for (let f = 0, n = 0; f < 3000 && n < 260; f++) {
        const a = aK + Math.PI + (rA() - 0.5) * 2 * 2.0, d = 98 + rA() * 37, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (kustQ(x, z) > 40 || hy(x, z) < VY + 0.5 || REF.blockerad(x, z, 3)) continue;
        const t = rA(); trad(t < 0.7 ? 'gran2' : 'tall1', x, z, 0); n++;
      }
      // skogsbrynet framför ridån (82–104 m, flera lager och ojämnt djup): sly av unga granar och björkar, buskar,
      // ormbunkar och högt gräs vid foten, så att ridån inte står som en rad stammar på en gräsmatta med himlen
      // rakt igenom. Eget slumptal: resten av miljön står kvar.
      { const rB = slump(3301), GS = new THREE.Color(0.8, 0.84, 0.8);
        for (let f = 0, n = 0; f < 8000 && n < 460; f++) {
          if (!(f & 63)) yield;
          const a = aK + Math.PI + (rB() - 0.5) * 2 * 2.1, d = 80 + Math.pow(rB(), 0.7) * 26 + 6 * fbm(a * 9, 3), x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (kustQ(x, z) > 32 || hy(x, z) < VY + 0.5 || REF.blockerad(x, z, 3)) continue;
          const t = rB(), y = hy(x, z) - 0.06;
          if (t < 0.5) { const hh = 3 + rB() * 10, b = hh * (0.85 + rB() * 0.3); V.barr.push({ m: matris(x, y, z, b, hh, b, rB() * 6.283), c: GS.clone(), art: 'gran', x, y, z, hh, ry: 0 }); }
          else if (t < 0.6) { const hh = 4 + rB() * 6, b = hh * 0.9; V.barr.push({ m: matris(x, y, z, b, hh, b, rB() * 6.283), c: GS.clone().multiplyScalar(0.9), art: 'gran', x, y, z, hh, ry: 0 }); }
          else trad('buske', x, z, 1 + rB() * 1.8, 0);   // sly och enbuskar vid foten (buskkort: tonas inte bort på avstånd)
          n++;
        }
        // tät granskog bakom brynet (96–128 m), så att inga gluggar visar gräs och horisont mellan stammarna
        for (let f = 0, n = 0; f < 6000 && n < 320; f++) {
          if (!(f & 63)) yield;
          const a = aK + Math.PI + (rB() - 0.5) * 2 * 2.1, d = 96 + rB() * 32, x = Math.cos(a) * d, z = Math.sin(a) * d;
          if (kustQ(x, z) > 40 || hy(x, z) < VY + 0.5) continue;
          const hh = 13 + rB() * 9, b = hh * (0.85 + rB() * 0.25), y = hy(x, z) - 0.06;
          V.barr.push({ m: matris(x, y, z, b, hh, b, rB() * 6.283), c: GS.clone().multiplyScalar(0.95), art: 'gran', x, y, z, hh, ry: 0 }); n++;
        } }
      // motstranden: skogen börjar 27 m bakom strandkanten (räknat som i husritare-sjo.js), så att stugorna
      // (17–21 m upp från stranden) står fritt framför skogsbrynet, inte bakom stammar
      const Q0 = {}, q0 = l => { const k = Math.round(l); if (Q0[k] === undefined) { Q0[k] = 999; for (let q = 100; q < 200; q += 0.5) if (hy(q * KUST[0] - k * KUST[1], q * KUST[1] + k * KUST[0]) > VY + 0.6) { Q0[k] = q; break; } } return Q0[k]; };
      for (let f = 0, n = 0; f < 4000 && n < 340; f++) {
        if (!(f & 63)) yield;
        const a = aK + (rA() - 0.5) * 2 * 1.45, d = 100 + rA() * 112, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (kustQ(x, z) < 102 || hy(x, z) < VY + 0.7 || x * KUST[0] + z * KUST[1] < q0(-x * KUST[1] + z * KUST[0]) + 27) continue;
        const t = rA(); trad(t < 0.6 ? 'gran2' : 'tall1', x, z, 0); n++;   // (inga björkkort: de lyste som klistermärken)
      } }
    // ridåns och motstrandens träd: mörkare och dovare (björkarna lyste som ljusgröna klistermärken, tallstammarna rött)
    { const BJ = new THREE.Color(0.5, 0.55, 0.52), TA = new THREE.Color(0.58, 0.6, 0.62);
      for (let i = ridaFran; i < V.barr.length; i++) { const e = V.barr[i]; if (e.art === 'bjork') e.c.multiply(BJ); else if (e.art === 'tall') e.c.multiply(TA); else e.c.multiplyScalar(0.9); }
      // björkkorten närmare (grupperna på landsidan): också dovare, så att inga ljusgröna platta kort sticker ut
      for (let i = 0; i < ridaFran; i++) { const e = V.barr[i]; if (e.art === 'bjork') e.c.multiply(BJ).multiplyScalar(1.25); } }
    // strandtallarna och ridåns närmaste tallar byggs med holmarnas tallmodell (husritare-sjo.js): barrkuddar av
    // kvistkort i stället för runda gröna moln; resten av ridån (långt ut i diset) förblir kort
    yield;
    const SJOT = (() => {
      const k = V.barr.map((e, i) => ({ e, i, d: Math.hypot(e.x, e.z) })).filter(o => o.e.art === 'tallLut' || (o.e.art === 'tall' && o.d < 118)).sort((a, b) => a.d - b.d).slice(0, 22);
      const bort = new Set(k.map(o => o.i)); V.barr = V.barr.filter((e, i) => !bort.has(i));
      return SJO.tallar(k.map(o => o.e));
    })();
    // skannad skogsmark i brynet på landsidan (husritare-natur.js) och stenblock vid holmarnas strandkant
    yield;
    const PHN = (() => {
      const aK = Math.atan2(KUST[1], KUST[0]), upp = V.barr.filter(e => Math.hypot(e.x, e.z) > 70).map(e => ({ x: e.x, z: e.z, a: e.hh * 0.12 }));
      const ok = (x, z, k) => kustQ(x, z) <= 30 && hy(x, z) > VY + 0.6 && !REF.blockerad(x, z, 2) && krav(x, z, k);
      const P = skogsmark({ r: slump(5404), hy, ok, upp, rMin: 76, rMax: 98, vinkel: [aK + Math.PI, 1.9], antal: 0.7 });
      const rH = slump(5405), SL = ['rock_moss_set_01', 'stone_01', 'rock_07', 'rock_09'];
      for (const [ox, oz, orr] of SJO.OAR) for (let k = 0, n = SVAGMARK ? 2 : 3; k < n; k++) {
        const v = rH() * 6.2832, dx = Math.cos(v), dz = Math.sin(v);
        let d0 = null; for (let d = 2; d < orr * 2.4; d += 0.25) if (SJO.holmH(ox + dx * d, oz + dz * d) < VY + 0.3) { d0 = d; break; }
        if (!d0) continue;
        const d = d0 - 0.5 - rH() * 1.4, x = ox + dx * d, z = oz + dz * d, id = SL[(rH() * SL.length) | 0], s = 0.8 + rH() * 0.7, a = NATUR.matt(id).b * s * 0.5;
        const y = Math.min(SJO.holmH(x, z), SJO.holmH(x + a, z), SJO.holmH(x - a, z), SJO.holmH(x, z + a), SJO.holmH(x, z - a));
        P.push({ id, x, y, z, ry: rH() * 6.2832, s, lx: (rH() - 0.5) * 0.2, lz: (rH() - 0.5) * 0.2 });
      }
      return NATUR.grupp(P, { namn: 'ph-natur-kust' });
    })();
    // (sjö-ph) skannade granitklackar (rock_face) i vattenlinjen: motstrandens raka sandremsa bryts upp av block
    // (aldrig vid stugornas bryggor), och syns i speglingen
    yield;
    const PHS = (() => {
      const rS = slump(5406), P = [], QLm = (q, l) => [q * KUST[0] - l * KUST[1], q * KUST[1] + l * KUST[0]];
      const stug = (SJOF.stugor || []).map(([x, z]) => -x * KUST[1] + z * KUST[0]);
      const fot = (h, x, z, a) => Math.min(h(x, z), h(x + a, z), h(x - a, z), h(x, z + a), h(x, z - a));
      // skanningen är en öppen bergvägg (bara framsidan finns): framsidan (modellens +z) vänds ut mot vattnet och tomten
      const RYV = Math.atan2(-KUST[0], -KUST[1]);
      for (let l = -118 + rS() * 6; l < 118; l += (SVAGMARK ? 13 : 6) + rS() * 9) {
        if (stug.some(sl => Math.abs(sl - l) < 9)) continue;
        let qv = null; for (let q = 92; q < 140; q += 0.25) { const [x, z] = QLm(q, l); if (hy(x, z) > VY - 0.15 && !SJO.OAR.some(([ox, oz, orr]) => Math.hypot(x - ox, z - oz) < orr * 2.6)) { qv = q; break; } }
        if (qv === null || qv > 150) continue;
        // tillplattade (sy) och lutade ut mot vattnet: låga rundslipade hällar, inte resta block på sanden
        // ibland en mindre klack bredvid (en grupp läses som berg i dagen, ett ensamt block som utlagt)
        for (let k = 0, n = rS() < 0.45 ? 2 : 1; k < n; k++) {
          const stor = k === 0 && rS() < 0.75, id = stor ? 'rock_face_01' : 'rock_face_02', s = stor ? 1.1 + rS() * 0.5 : 1.0 + rS() * 0.6, sy = 0.55 + rS() * 0.2;
          const H = (stor ? 3.56 : 2.55) * s, [x, z] = QLm(qv + (k ? -0.6 : 0.4) + rS() * 1.0, l + (k ? (rS() < 0.5 ? -1 : 1) * (2.6 + rS() * 1.2) : 0)), a = NATUR.matt(id).b * s * 0.3;
          P.push({ id, x, y: fot(hy, x, z, a) + 0.22 * H * (1 - sy), z, ry: RYV + (rS() - 0.5) * 0.7, s, sy, lx: (rS() - 0.5) * 0.12, lz: (rS() - 0.5) * 0.12 });
        }
      }
      // (holmarna fick ingen klack: skanningens raka snittkanter syntes mot holmnätets rundade granit)
      console.info('ph-natur strandklackar', P.length);
      return NATUR.grupp(P, { namn: 'ph-natur-strand', spegla: true });
    })();
    // bryggan i ett eget nät med fotograferade brädor (brown_planks_03)
    yield;
    const BS = samling(); lagg(BS, bry.D, 0, 0, 0, 1, 0, 1, 0);
    const bryNat = vegMesh('brygga', BS, egenMat('brygga3', () => vegPatch(new THREE.MeshLambertMaterial({ map: tx('bryggaFoto'), normalMap: tx('bryggaNor'), normalScale: new THREE.Vector2(1.2, 1.2), vertexColors: true }), {})), true, true);
    const FB = fabBjorkar(V, 10, 90);   // björkgrupperna: Fab-björkar (husritare-fab.js)
    // björkar som inte blev Fab-björkar (Fab inte laddad, eller för långt bort) blir granar: björkkorten med stora blad
    // och vit stam stod som platta ljusgröna klistermärken framför skogen
    V.barr.forEach(e => { if (e.art === 'bjork') { e.art = 'gran'; e.c.multiplyScalar(0.9); } });
    yield;
    const T = yield* tradenG(V, ['tallLut', 'tall', 'gran', 'bjork'], Math.max(0, 4 - FB.length), 48, ['bjork'], 78);   // de fyra närmaste björkarna i 3D (resten av trianglarna går till de skannade strandstenarna)
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), klung: V.klung, mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor: [], upp,
      extra: [behall(vattenMesh()), behall(strandRemsa(byggda.kust.mat)), behall(bryNat), behall(strandstenar()), ...SJOF.map(behall), ...SJOT.map(behall), behall(PHN), behall(PHS), ...(FB.length ? [behall(FAB.bjorkar(FB))] : [])], brygga: bry,
      liv: { faglar: behall(faglar(r, 9)) },   // (inga fallande löv vid sjön: ritanropet går till stenstranden)
    };
  }
  const kustNara = (mal, F) => korG(kustNaraG(mal, F));
  function* kustNaraG(mal, F) {   // stegvis (se byggG)
    const r = slump(404), { krav, kant } = regler(mal), hy = hojdKust;
    // träden från fjärrsetet (tallar på hällarna, björkar): flaggstången, sjöboden, däcket och eldstaden hålls fria från dem
    // (stammen minst m + halva trädets kronradie bort); flaggstångens läge hålls fritt för sjöboden och däcket
    const tradNara = (x, z, m) => (F.upp || []).some(p => Math.hypot(p.x - x, p.z - z) < m + p.a * 0.5);
    let flagg = null;
    // inga grässtrån ute på hällbandet (de täckte hällarna i markens skuggare)
    // (gränsen brusas, så att gräset tunnas ut i tuvor i stället för en rak kant)
    const { V, flack, vaxt, matta, trad } = verktyg(r, hy, (x, z, b) => mal.blockerad(x, z, b) || kustQ(x, z) + (fbm(x * 0.35, z * 0.35 + 3) - 0.5) * 4 > 9.2, false), N = narSet(V, flack);
    const tuvring = (x, z, n, rad, smin, smax) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (hy(px, pz) > VY + 0.15) vaxt('gras', px, pz, smin + r() * (smax - smin), ton(r, ANG)); } };
    // berghällar: breda, låga, rundslipade granitryggar som sluttar ner i vattnet
    const hall = [], aV = Math.atan2(KUST[1], KUST[0]);
    // hällarna själva ligger i markens skuggare (granit i strandbandet); här bara rundade block, halvt nedsjunkna,
    // på hällarna och ute i det grunda vattnet, med gräs runt foten på land
    yield;
    for (let f = 0, n = 0; f < 1200 && n < 0; f++) {   // (blocken är nu den skannade stenstranden, strandstenar(); inget eget nät)
      const a = aV + (r() - 0.5) * 2.7, d = 11 + r() * 26, x = Math.cos(a) * d, z = Math.sin(a) * d, q = kustQ(x, z), s = 0.45 + r() * 1.0;
      if (q < 11.5 || q > 27 || !krav(x, z, 'lag') || kant(x, z) < 3 + s || hall.some(([hx, hz, hs]) => Math.hypot(x - hx, z - hz) < (hs + s) * 1.2)) continue;
      hall.push([x, z, s]);
      N.sten.push({ form: 2, m: matris(x, hy(x, z) - s * 0.22, z, s * (1.2 + r() * 0.5), s * (0.5 + r() * 0.2), s * (1.0 + r() * 0.3), r() * 6.28, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12), c: variera(r() < 0.5 ? '#a19d97' : '#ab9e96', r, 0.02, 0.05, 0.1) });
      tuvring(x, z, 4, s * 1.5, 0.22, 0.4); n++;
    }
    yield;
    N.extra.push(vagDetaljer(mal, V, hy, 'kust', (x, z) => hy(x, z) < VY + 0.2));   // elstolpar på land, vägräcke där uppfarten går nära vattnet (team-villa)
    yield;
    grasKant(mal, kant, vaxt, matta, r, [0.66, 0.7, 0.48], 0);   // (team-mark: färre platta strån, det täta tuvfältet i husritare-vaxter.js tar över)   // färre strån: 3D-björkarna och den skannade stenstranden tar trianglarna
    yield;
    lampor(V.bark, N.glod, mal, hy, false);
    // bryggans lykta: tänds med lamporna, varm pöl på bryggan och vattnet
    const b = F.brygga;
    yield;
    if (b) {
      const D = del();
      // lykta på en trästolpe: fyrkantig glaskupa som glöder, ram och ett litet spetsigt tak
      ror(D, [[0, -0.05, 0, 0.055], [0, 0.9, 0, 0.05]], 4, UG, 1, () => [0.75, 0.62, 0.48], 0.1);
      ror(D, [[0, 0.9, 0, 0.1], [0, 0.93, 0, 0.1]], 4, UG, 1, () => [0.05, 0.05, 0.055], 0.1);
      ror(D, [[0, 0.93, 0, 0.085], [0, 1.15, 0, 0.085]], 4, UG, 1, () => [0.95, 0.9, 0.78], 1);
      ror(D, [[0, 1.15, 0, 0.13], [0, 1.18, 0, 0.13], [0, 1.31, 0, 0.012]], 4, UG, 1, () => [0.05, 0.05, 0.055], 0.1);
      lagg(V.bark, D, b.x, b.y, b.z, 1, 0, 1, 0, ETT, 0.3);
      N.glod.push([b.x, b.y + 1.04, b.z, 0.36, 0, ...VARMT, 0.3]);
      N.glod.push([b.x, VY + 0.02, b.z, 4.2, 1, 0.5, 0.33, 0.17, 0.3]);
      // badstege i bryggans ände, två solstolar mot sjön (ett eget ritanrop utan textur)
      const TS = samling(), ryB = Math.atan2(b.dx, b.dz), yd = b.y - 0.02, P = (d, s) => [b.dx * d + b.px * s, b.dz * d + b.pz * s];
      { const [x, z] = P(b.d1 + 0.1, -0.4); lagg(TS, STEGE(), x, yd, z, 1, ryB, 1, 0); }   // utanför bryggans ände, ner i vattnet
      // ekan (klinkbyggd, med förtöjningslina) byggs i husritare-sjo.js
      // solstolarna på T-delen i bryggans ände, sida vid sida med fotändan ut mot vattnet (gångvägen hålls fri)
      for (const t of [0.75, 1.95]) { const [x, z] = P(b.dT + t, b.HB + b.TD / 2 - 0.08); lagg(TS, SOLSTOL(), x, yd, z, 1, Math.atan2(b.px, b.pz) + (t < 1 ? 0.06 : -0.06), 1, 0); }
      // spången ner till bryggan ligger i bryggans nät (fjärrsetet); här hålls den fri från tomtens föremål
      { const blk0 = mal.blockerad, ux = b.dx, uz = b.dz;
        mal.blockerad = (x, z, br = 1.25) => {
          if (blk0(x, z, br)) return true;
          const l = x * ux + z * uz, s = Math.abs(-x * uz + z * ux);
          return l > b.dStart - 1 && l < b.d1 + 1 && s < 1.6 + Math.min(br, 1.2);
        };
        // flaggstång en bit vid sidan om spången, med vimpel som fladdrar; första lediga läge där varken stången
        // eller vimpeln (3,2 m med vinden) kommer nära ett träd (minst 4 m till stammen)
        // vimpeln vrids så att den pekar med vinden (VU.uVind ~ (0,94, 0,33)); slumptalet dras ändå
        r();
        const L0 = b.d0, friFlagg = (x, z) => [0, 1.6, 3.2].every(t => !tradNara(x + 0.94 * t, z + 0.33 * t, 4));
        for (const [f, sid] of [[0.7, 4.5], [0.7, -4.5], [0.55, 4.5], [0.55, -4.5], [0.85, 5.5], [0.85, -5.5], [0.4, 5], [0.4, -5], [0.7, 7], [0.7, -7]]) {
          const fx = ux * (L0 * f) + uz * sid, fz = uz * (L0 * f) - ux * sid;
          if (mal.blockerad(fx, fz, 1) || kant(fx, fz) <= 2 || !friFlagg(fx, fz)) continue;
          lagg(TS, ting('flagga'), fx, hy(fx, fz), fz, 1, Math.atan2(-0.33, 0.94), 8, 0.002); flagg = [fx, fz];
          break;
        }
      }
      // eget material, dubbelsidigt: ekans skal är öppna ytor (insidan skars annars bort och båten såg ihålig ut)
      const tm = vegMesh('ting', TS, egenMat('tingKust', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { glod: true, upp: false })), true, true);
      if (tm) N.extra.push(tm);
      // (team-mark) stocken läggs längs höjdkurvan: den vridning där ändarna ligger lika högt, lite nedsjunken; i en brant
      // sluttning (ändarna skiljer > 0,12 m) eller i vattnet läggs den inte alls (förr svävade ena änden som ett band)
      const liggRatt = (sx, sz, lang) => {
        let bast = [0, 9];
        for (let k = 0; k < 12; k++) { const ry = k * Math.PI / 12, c = Math.cos(ry), s = Math.sin(ry); const d = Math.abs(hy(sx + c * lang, sz - s * lang) - hy(sx - c * lang, sz + s * lang)); if (d < bast[1]) bast = [ry, d]; }
        const c = Math.cos(bast[0]), s = Math.sin(bast[0]), lo = Math.min(hy(sx, sz), hy(sx + c * lang, sz - s * lang), hy(sx - c * lang, sz + s * lang));
        return [bast[0], lo - 0.06, bast[1] < 0.12 && lo > VY + 0.12];
      };
      // drivvedsstockar på grusstranden till vänster och höger om huset (syns i startvyn)
      for (const [g0, lang] of [[-166, 2.6], [-52, 2.0], [-150, 1.6]]) {
        const ga = g0 * Math.PI / 180; let dd = null;
        for (let d = 8; d < 60; d += 0.25) if (kustQ(Math.cos(ga) * d, Math.sin(ga) * d) > 12.2) { dd = d; break; }
        if (dd === null) continue;
        const sx = Math.cos(ga) * dd, sz = Math.sin(ga) * dd;
        if (mal.blockerad(sx, sz, 1.5) || kant(sx, sz) < 4) continue;
        const Dd = del();
        // silvergrå drivved (björkremsans ljusa bark, gråtonad) med två grenstumpar
        ror(Dd, [[-lang, 0.14, 0, 0.16], [-lang * 0.3, 0.13, 0.04, 0.15], [lang * 0.4, 0.12, -0.03, 0.12], [lang, 0.1, 0.02, 0.07]], 8, UB, 1.2, () => [0.5, 0.48, 0.44]);   // (gråare, inte rosa)
        ror(Dd, [[lang * 0.1, 0.2, 0.05, 0.05], [lang * 0.25, 0.38, 0.3, 0.025]], 5, UB, 1, () => [0.55, 0.53, 0.5]);
        ror(Dd, [[-lang * 0.5, 0.18, -0.06, 0.045], [-lang * 0.65, 0.22, -0.4, 0.02]], 5, UB, 1, () => [0.55, 0.53, 0.5]);
        r();   // (slumptalet dras som förut)
        const [ry, yy, ok] = liggRatt(sx, sz, lang);
        if (ok) lagg(V.bark, Dd, sx, yy, sz, 1, ry, 1, 0);
      }
      // en strandad stock på hällarna intill bryggan
      const ga = Math.atan2(b.dz, b.dx) + 0.22, sd = (() => { for (let d = 8; d < 40; d += 0.25) if (hy(Math.cos(ga) * d, Math.sin(ga) * d) < VY + 0.35) return d; return 15; })();
      const sx = Math.cos(ga) * sd, sz = Math.sin(ga) * sd, Ds = del();
      ror(Ds, [[-1.7, 0.17, 0, 0.19], [0, 0.16, 0.05, 0.17], [1.7, 0.13, -0.04, 0.12]], 8, UB, 1.2, () => [0.5, 0.48, 0.44]);
      ror(Ds, [[0.3, 0.24, 0.05, 0.055], [0.55, 0.45, 0.35, 0.025]], 5, UB, 1, () => [0.55, 0.53, 0.5]);
      // (team-mark: den strandade stocken vid bryggan hamnade tvärs över spången, däcket och vedstället – borttagen)
      void sx; void sz; void Ds;
    }
    yield;
    // gräs och markväxter på land, sandrör närmast stranden (samma gräsgräns som stråna ovan; husritare-vaxter.js)
    { const malS = Object.assign(Object.create(mal), { blockerad: (x, z, m = 1.25) => mal.blockerad(x, z, m) || tradNara(x, z, Math.max(m, 1.5) + 1.2) || (!!flagg && Math.hypot(x - flagg[0], z - flagg[1]) < m + 2.5) });
      const SJ = yield* SJO.naraG(malS, F.brygga, krav, kant, r); N.extra.push(...SJ.nat);      if (SJ.eld) { const [x, y, z] = SJ.eld; N.glod.push([x, y + 0.3, z, 0.7, 0, 1, 0.5, 0.18, 0.6], [x, y + 0.03, z, 3.2, 1, 0.6, 0.3, 0.1, 0.6]); }   // glöden i eldstaden på kvällen
      // (team-mark) stigarna från sjötomten till markens skuggare; ängen (tätt fält med lod: full nära kameran, gles långt bort) byggs efter
      // sjötomten så att stigarna hålls fria
      const st = SJ.stigar || []; STIG.value.forEach((v, i) => (st[i] ? v.set(...st[i]) : v.set(1e4, 1e4, 1e4, 1e4)));      N.extra.push(VP.grupp(VP.kust({ mal, hy, stig: SJ.stigAv || null, strand: (x, z) => { const q = kustQ(x, z) + (fbm(x * 0.35, z * 0.35 + 3) - 0.5) * 4; return q > 11.3 || hy(x, z) < VY + 0.2 ? null : Math.max(0, (q - 2) / 7.2); } }), [13, 19, 0]));   // (kort toning: en halvgles zon gav spridda prickar)   // (3D-gräset jämnt tätt till 12 m, tonas ut till 26 m – bortom tar fotomarken över; inga prickar)
      // (team-tomt) vår sjötomt som i skogen (tomtGrund, typ 'kust'): rabatter vid husgrunden, buxbom vid trappan och en
      // gärdsgård med grind i infarten på landsidan: fram och längs sidorna ner mot sjön, där den slutar när ängen möter
      // stranden. Luckor där stigarna går, och inget nära eldstaden, sjöboden, flaggan eller träden.
      { const E = SJ.eld, Bd = SJ.bod;
        const malT = Object.assign(Object.create(mal), { blockerad: (x, z, m = 1.25) => mal.blockerad(x, z, m) || hy(x, z) < VY + 0.35 || kustQ(x, z) > 4.5 || kant(x, z) > 24
          || tradNara(x, z, m + 0.4) || (!!flagg && Math.hypot(x - flagg[0], z - flagg[1]) < m + 1)
          || (!!E && Math.hypot(x - E[0], z - E[2]) < 6) || (!!Bd && Math.hypot(x - Bd.x, z - Bd.z) < 5) || (!!SJ.stigAv && SJ.stigAv(x, z) < 0.6 + m * 0.4)
          || (SJ.bjorkar || []).some(p => Math.hypot(x - p.x, z - p.z) < m + 0.6) });
        tomtGrund(malT, V, N, slump(4747), hy, trad, 'kust');
        if (SJ.bjorkar && SJ.bjorkar.length) N.extra.push(FAB.bjorkar(SJ.bjorkar));   // hängmattans två björkar (husritare-sjo.js)
        // (SJ.buskar: platser för syrener och bärbuskar; buskmodellen såg ut som gröna klumpar och ritas inte – hellre inga än fejk)
      }
    }
    // folk vid sjön (husritare-folk.js): en kvinna står ute på bryggan (mannen på spången är borttagen på användarens begäran)
    yield;
    if (F.brygga) {
      const b = F.brygga, Pb = (d, s) => [b.dx * d + b.px * s, b.dz * d + b.pz * s];
      N.extra.push(FOLK.grupp([
        { t: 'sta', p: [...Pb(b.d1 - 2.4, -0.1)].flatMap((v, i) => i ? [b.y, v] : [v]), dir: [b.dx, b.dz], typ: 1, pal: 2, klipp: 'sta' },
      ], hy));
    }   // sjöbod, kanot, eldstad, stolar, blommor, vass, stenmur (husritare-sjo.js)
    mat('flack').color.set('#26300f'); mat('flack').opacity = 0.75;
    return N;
  }

  // ---- Villaområdet ----
  // Grannhusen: enkla volymer (en kropp med gavlar och ett tak, två instansade nät för alla hus).
  // Fönster, knutar, sockel och panel ritas i skuggaren ur husets mått (instansens skala), inga texturer;
  // på kvällen lyser en slumpad del av fönstren (uLampa). Takresningen = 0,36 × husets djup.
  // en geometri för hela grannhuset: väggar och gavlar (aTak 0) och taket (aTak 1) – ett ritanrop för alla hus
  function grannGeo() {
    const P = [], Nn = [], R = [], K = [], Tk = [];
    const v = (x, y, z, n, rg = 0, k = 0, tk = 0) => { P.push(x, y, z); Nn.push(...n); R.push(rg); K.push(k); Tk.push(tk); };
    for (const s of [-1, 1]) {
      [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 0], [0.5, 1], [-0.5, 1]].forEach(([x, y]) => v(x, y, 0.5 * s, [0, 0, s]));
      [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 0], [0.5, 1], [-0.5, 1]].forEach(([z, y]) => v(0.5 * s, y, z, [s, 0, 0]));
      v(0.5 * s, 1, -0.5, [s, 0, 0]); v(0.5 * s, 1, 0.5, [s, 0, 0]); v(0.5 * s, 1, 0, [s, 0, 0], 1);
      const n = [0, 0.81, 0.59 * s];
      [[-0.5, 0.5 * s, 0, 1], [0.5, 0.5 * s, 0, 1], [0.5, 0, 1, 0], [-0.5, 0.5 * s, 0, 1], [0.5, 0, 1, 0], [-0.5, 0, 1, 0]].forEach(([x, z, rg, k]) => v(x, 1, z, n, rg, k, 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('aRygg', new THREE.Float32BufferAttribute(R, 1));
    g.setAttribute('aKant', new THREE.Float32BufferAttribute(K, 1));
    g.setAttribute('aTak', new THREE.Float32BufferAttribute(Tk, 1));
    g.computeBoundingSphere();
    return spara(g);
  }
  function grannMat() {
    return egenMat('grannhus', () => {
      const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      m.onBeforeCompile = s => {
        Object.assign(s.uniforms, { uLampa: VU.uLampa, miljoLjus: LJUS });
        s.vertexShader = 'attribute float aRygg;\nattribute float aKant;\nattribute float aTak;\nvarying vec3 vFas;\nvarying vec3 vHus;\nvarying float vTak;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 gsc = vec3( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ), length( instanceMatrix[2].xyz ) );
      transformed.y += aRygg * 0.36 * gsc.z / gsc.y;
      // taket: utstick på gavlarna och vid takfoten, en aning över gavelns topp
      transformed.x += aTak * sign( position.x ) * 0.32 / gsc.x;
      transformed.z += aTak * aKant * sign( position.z ) * 0.4 / gsc.z;
      transformed.y += aTak * ( 0.05 - aKant * 0.29 ) / gsc.y;
      vTak = aTak;
      { vec3 lp = transformed * gsc; bool gv = abs( normal.x ) > 0.5;
        vFas = vec3( gv ? lp.z + gsc.z * 0.5 : lp.x + gsc.x * 0.5, lp.y, gv ? gsc.z : gsc.x );
        vHus = vec3( fract( sin( dot( instanceMatrix[3].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ), gsc.y, gv ? 1.0 : 0.0 ); }`);
        let f = 'uniform float uLampa;\nuniform vec3 miljoLjus;\nvarying vec3 vFas;\nvarying vec3 vHus;\nvarying float vTak;\n' + s.fragmentShader;
        f = f.replace('#include <color_fragment>', `#include <color_fragment>
        float fon = 0.0, ram = 0.0, tand = 0.0;
        if ( vTak > 0.5 ) {
          // takfärg ur husets slumptal: svart, tegelröd, grafit, brun
          float tv = fract( vHus.x * 7.13 );
          vec3 tf = tv < 0.3 ? vec3( 0.05, 0.05, 0.055 ) : tv < 0.55 ? vec3( 0.25, 0.06, 0.045 ) : tv < 0.8 ? vec3( 0.09, 0.1, 0.11 ) : vec3( 0.18, 0.13, 0.1 );
          diffuseColor.rgb = tf * ( 0.9 + 0.1 * smoothstep( 0.3, 0.7, abs( fract( vFas.x / 0.5 ) - 0.5 ) * 2.0 ) );   // plåtfalsar / takpannerader
        } else {
          float u = vFas.x, y = vFas.y, w = vFas.z, aa = max( fwidth( u ), 0.004 ) * 1.2;
          #define BOX( p, a, b ) ( smoothstep( (a) - aa, (a) + aa, p ) * ( 1.0 - smoothstep( (b) - aa, (b) + aa, p ) ) )
          float st = floor( y / 2.7 ), fy = y - st * 2.7, n = max( 1.0, floor( ( w - 1.4 ) / 2.5 ) ), cell = ( w - 1.4 ) / n;
          float k = floor( ( u - 0.7 ) / cell ), fu = u - 0.7 - k * cell, mid = cell * 0.5;
          float inne = BOX( u, 0.7, w - 0.7 ) * step( y, vHus.y - 0.3 + vHus.z * ( 0.36 * w - 0.7 ) );
          fon = BOX( fu, mid - 0.52, mid + 0.52 ) * BOX( fy, 0.95, 2.15 ) * inne;
          ram = BOX( fu, mid - 0.62, mid + 0.62 ) * BOX( fy, 0.86, 2.24 ) * inne;
          float knut = 1.0 - BOX( u, 0.16, w - 0.16 );
          float panel = 0.95 + 0.05 * smoothstep( 0.35, 0.5, abs( fract( u / 0.2 ) - 0.5 ) ) * ( 1.0 - smoothstep( 0.0, 0.05, aa ) );
          vec3 c = diffuseColor.rgb * panel;
          c = mix( c, vec3( 0.9, 0.89, 0.86 ), max( ram * ( 1.0 - fon ), knut ) * 0.92 );
          // fönsterkors (vit post och tvärpost) i varje fönster
          float kors = max( BOX( fu, mid - 0.035, mid + 0.035 ), BOX( fy, 1.6, 1.67 ) ) * fon;
          c = mix( c, mix( vec3( 0.12, 0.15, 0.18 ), vec3( 0.38, 0.44, 0.5 ), smoothstep( 1.2, 2.1, fy ) ), fon );
          c = mix( c, vec3( 0.9, 0.89, 0.86 ), kors );
          c = mix( c, vec3( 0.32, 0.31, 0.3 ), 1.0 - smoothstep( 0.32, 0.36, y ) );
          // tänt fönster: hela rutan (fönstrets index, inte pixeln) väljs, och glaset blir varmt och jämnt
          float tf = step( 0.45, fract( sin( dot( vec3( k, st, floor( vHus.x * 97.0 ) ), vec3( 12.99, 78.23, 37.7 ) ) ) * 43758.5453 ) );
          tand = tf * fon * ( 1.0 - kors ) * ( 0.85 + 0.15 * smoothstep( 2.15, 1.0, fy ) );
          c = mix( c, vec3( 0.55, 0.42, 0.28 ), tand * uLampa );
          diffuseColor.rgb = c;
          #undef BOX
        }`);
        f = f.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;\n\ttotalEmissiveRadiance += vec3( 1.0, 0.6, 0.28 ) * 0.8 * tand * uLampa;');
        s.fragmentShader = f;
      };
      m.customProgramCacheKey = () => 'miljo-grann';
      return m;
    });
  }
  function grannhus(hus) {
    const poster = hus.map(h => ({ m: matris(h.x, h.y - 0.12, h.z, h.L, h.H + 0.12, h.W, h.ry), c: h.vagg }));
    return [instanser('grannhus', GEO.grannhus || (GEO.grannhus = grannGeo()), grannMat(), poster, false, true)].filter(Boolean);
  }
  // Gatunätet (ett ritanrop): körbanor i asfalt med vägmarkering i skuggaren (streckad mittlinje,
  // övergångsställen), trottoarer med kantsten och grannarnas uppfarter. Allt i kvarterets ram (sv, lat).
  // vag: { dir: 'lat' (gatan löper längs lat, ligger vid sv = c) | 'sv', c, a0, a1, linje, zebra: [s0 …] }
  const GHW = 3.25, GTR = 2;
  // egen: vår uppfart över trottoaren { v, sd, s0, s1 } (husritare-bil.js lägger plattorna och den nedsänkta kantstenen)
  function gataNat(pt, hy, vagar, uppfarter, ytor = [], egen = null) {
    const B = { P: [], U: [], F: [], G: [], I: [] }, ST = 4, T = 0.13;
    const lok = (v, s, q) => v.dir === 'lat' ? pt(v.c + q, s) : pt(s, v.c + q);
    const kvad = (A, f, g, uv = null) => {   // uv: egna texturkoordinater (lodräta ytor: längs ytan och uppåt, annars blir fotot strimmor)
      const b = B.P.length / 3;
      A.forEach((p, k) => { B.P.push(p[0], p[1], p[2]); if (uv) B.U.push(uv[k][0], uv[k][1]); else B.U.push(p[0], p[2]); B.F.push(f[0], f[1], f[2]); B.G.push(g[0], g[1], g[2], g[3]); });
      B.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    // intervall längs gatan minus de bitar där en tvärgata ligger (m = extra marginal)
    const delar = (v, m) => {
      let iv = [[v.a0, v.a1]];
      vagar.forEach(w => {
        if (w === v || w.dir === v.dir || w.a0 > v.c + GHW + GTR || w.a1 < v.c - GHW - GTR) return;
        const c0 = w.c - GHW - m, c1 = w.c + GHW + m;
        iv = iv.flatMap(([a, b]) => b <= c0 || a >= c1 ? [[a, b]] : [[a, c0], [c1, b]].filter(([x, y]) => y - x > 0.05));
      });
      return iv;
    };
    const yta = (v, iv, q0, q1, y, f, mark) => iv.forEach(([a0, a1]) => {
      for (let s = a0; s < a1 - 1e-3; s += ST) {
        const s1 = Math.min(a1, s + ST);
        kvad([[s, q0], [s, q1], [s1, q1], [s1, q0]].map(([ss, q]) => { const [x, z] = lok(v, ss, q); return [x, hy(x, z) + y, z]; }), f, [0, 99, -999, 0]);
        if (mark) { const g0 = B.G.length - 16; [[s, q0], [s, q1], [s1, q1], [s1, q0]].forEach(([ss, q], k) => { B.G[g0 + k * 4] = ss; B.G[g0 + k * 4 + 1] = q; B.G[g0 + k * 4 + 2] = mark.z; B.G[g0 + k * 4 + 3] = mark.l; }); }
      }
    });
    const kant = (v, iv, q, y0, y1, f) => iv.forEach(([a0, a1]) => {
      for (let s = a0; s < a1 - 1e-3; s += ST) {
        const s1 = Math.min(a1, s + ST), [xa, za] = lok(v, s, q), [xb, zb] = lok(v, s1, q), ha = hy(xa, za), hb = hy(xb, zb);
        kvad([[xa, ha + y0, za], [xb, hb + y0, zb], [xb, hb + y1, zb], [xa, ha + y1, za]], f, [0, 99, -999, 0], [[s, y0], [s1, y0], [s1, y1], [s, y1]]);
      }
    });
    // bilöverfarter: där en uppfart möter gatan skärs trottoaren och kantstenen upp på uppfartens bredd
    const SNITT = [];
    if (egen) SNITT.push({ ...egen, egen: true });
    (uppfarter || []).forEach(([a, b, c, d, br]) => {
      for (const v of vagar) {
        const q = v.dir === 'lat' ? c - v.c : d - v.c, sm = v.dir === 'lat' ? (b + d) / 2 : (a + c) / 2;
        if (Math.abs(Math.abs(q) - (GHW + GTR)) < 0.7 && sm > v.a0 + 3 && sm < v.a1 - 3) { SNITT.push({ v, sd: Math.sign(q), s0: sm - br / 2, s1: sm + br / 2 }); break; }
      }
    });
    const skar = (v, sd, iv) => { let ut = iv; SNITT.filter(o => o.v === v && o.sd === sd).forEach(o => { ut = ut.flatMap(([a, b]) => b <= o.s0 || a >= o.s1 ? [[a, b]] : [[a, o.s0], [o.s1, b]].filter(([x, y]) => y - x > 0.05)); }); return ut; };
    const LJ = [1.95, 1.93, 1.88], KS = [2.35, 2.33, 2.28], SID = [1.7, 1.68, 1.64];
    vagar.forEach(v => {
      // körbanan: en tvärgata (dir 'sv') skärs där en längsgata (dir 'lat') redan ligger
      const ivK = v.dir === 'sv' ? delar(v, 0) : [[v.a0, v.a1]];
      (v.zebra && v.zebra.length ? v.zebra : [-999]).forEach((z, k) => { if (k === 0) yta(v, ivK, -GHW - 0.05, GHW + 0.05, 0.025, [1, 1, 1], { z, l: v.linje ? 1 : 0 }); });
      // trottoarer: längsgatorna går hela vägen utom över tvärgatans körbana; tvärgatornas slutar vid längsgatornas trottoar
      const ivT = v.dir === 'lat' ? delar(v, 0) : delar(v, GTR);
      for (const sd of [-1, 1]) {
        const ivS = skar(v, sd, ivT);
        yta(v, ivS, sd * GHW, sd * (GHW + 0.16), T + 0.012, KS);   // kantstenen 1,2 cm över trottoaren (aldrig i samma plan)
        yta(v, ivS, sd * (GHW + 0.16), sd * (GHW + GTR), T, LJ);
        kant(v, ivS, sd * GHW, 0, T + 0.012, [2.1, 2.08, 2.04]);
        kant(v, ivS, sd * (GHW + GTR), -0.06, T, SID);
      }
    });
    // överfarterna: trottoarens gavlar vid snittet, och för grannarnas uppfarter plattor över trottoaren (2 mm under dess
    // yta, med ramp upp från tomten) och en nedsänkt kantsten som sluttar ner till 3 cm över körbanan
    const P3 = (v, s, q, y) => { const [x, z] = lok(v, s, q); return [x, hy(x, z) + y, z]; };
    SNITT.forEach(o => {
      const { v, sd } = o;
      for (const [s, ut] of [[o.s0, -1], [o.s1, 1]]) {
        const A = [P3(v, s, sd * GHW, 0), P3(v, s, sd * (GHW + GTR), 0), P3(v, s, sd * (GHW + GTR), T), P3(v, s, sd * GHW, T + 0.012)];
        kvad(ut * sd > 0 ? A : [A[1], A[0], A[3], A[2]], SID, [0, 99, -999, 0], [[0, 0], [GTR, 0], [GTR, T], [0, T]]);
      }
      if (o.egen) return;
      const pat = (A, typ) => { kvad(A, [1.55, 1.42, 1.18], [0, 99, -999, 0]); const g0 = B.G.length - 16; A.forEach((p, k) => { B.G[g0 + k * 4] = p[0]; B.G[g0 + k * 4 + 1] = 60; B.G[g0 + k * 4 + 2] = p[2]; B.G[g0 + k * 4 + 3] = typ; }); };
      const typ = (Math.floor(Math.abs(o.s0 * 0.37)) % 3) ? 8 : 10, rad = (q0, y0, q1, y1) => [P3(v, o.s0, sd * q0, y0), P3(v, o.s1, sd * q0, y0), P3(v, o.s1, sd * q1, y1), P3(v, o.s0, sd * q1, y1)];
      pat(rad(GHW + 0.3, T - 0.002, GHW + GTR, T - 0.002), typ);                 // över trottoaren
      pat(rad(GHW + GTR, T - 0.002, GHW + GTR + 0.55, 0.028), typ);              // ramp ner till tomtens uppfart
      kvad(rad(GHW, 0.03, GHW + 0.3, T - 0.002), KS, [0, 99, -999, 0]);         // nedsänkt kantsten
      { const A = rad(GHW, 0, GHW, 0.03); kvad(sd > 0 ? A : [A[1], A[0], A[3], A[2]], [2.1, 2.08, 2.04], [0, 99, -999, 0], [[o.s0, 0], [o.s1, 0], [o.s1, 0.03], [o.s0, 0.03]]); }
    });
    // grannarnas uppfarter: [sv0, lat0, sv1, lat1, bredd] längs en rak linje; marksten eller grus (Poly Haven-foto i
    // skuggaren, mönster 8 och 10, samplas i världens x/z)
    (uppfarter || []).forEach(([a, b, c, d, br]) => {
      const dx = c - a, dz = d - b, l = Math.hypot(dx, dz) || 1, px = -dz / l * br / 2, pz = dx / l * br / 2;
      const q = [[a + px, b + pz], [a - px, b - pz], [c - px, d - pz], [c + px, d + pz]].map(([s, la]) => { const [x, z] = pt(s, la); return [x, hy(x, z) + 0.02, z]; });
      const typ = (Math.floor(Math.abs(a * 0.37 + b * 0.61)) % 3) ? 8 : 10;
      kvad(q, [1.55, 1.42, 1.18], [0, 99, -999, 0]);
      const g0 = B.G.length - 16; q.forEach((p, k) => { B.G[g0 + k * 4] = p[0]; B.G[g0 + k * 4 + 1] = 60; B.G[g0 + k * 4 + 2] = p[2]; B.G[g0 + k * 4 + 3] = typ; });
    });
    // villans ytor: plattgångar, trall, jord, grus, brunnslock och dagvattenbrunnar (mönster: aGata = [u, 60, v, typ])
    ytor.forEach(o => { kvad(o.P, o.f, [0, 99, -999, 0]); const g0 = B.G.length - 16; o.G.forEach((g, k) => g.forEach((v, j) => { B.G[g0 + k * 4 + j] = v; })); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.F, 3));
    g.setAttribute('aGata', new THREE.Float32BufferAttribute(B.G, 4));
    g.setIndex(B.I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = egenMat('asfalt', () => {
      const a = patcha(new THREE.MeshLambertMaterial({ map: tx('asfalt'), vertexColors: true, side: THREE.DoubleSide })), fore = a.onBeforeCompile;
      a.onBeforeCompile = s => {
        fore(s);
        s.vertexShader = 'attribute vec4 aGata;\nvarying vec4 vGata;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGata = aGata;');
        s.fragmentShader = 'varying vec4 vGata;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if ( vGata.y < 50.0 || vGata.y > 95.0 ) {   // asfaltens och trottoarens ballast: grusfotot (Poly Haven) i liten skala, bara ljusheten
          const vec3 LW = vec3( 0.2126, 0.7152, 0.0722 );
          vec2 bu = vMapUv * 3.0;
          float bl = dot( texture2D( tGrusFoto, bu / 0.55 ).rgb, LW ) / max( dot( textureLod( tGrusFoto, vec2( 0.5 ), 11.0 ).rgb, LW ), 1e-3 );
          float bs = dot( texture2D( tGrusFoto, bu / 7.0 + 0.31 ).rgb, LW ) / max( dot( textureLod( tGrusFoto, vec2( 0.5 ), 11.0 ).rgb, LW ), 1e-3 );
          diffuseColor.rgb *= mix( 1.0, clamp( bl, 0.55, 1.5 ), 0.42 ) * mix( 1.0, clamp( bs, 0.7, 1.3 ), 0.25 );
        }
        if ( vGata.y < 50.0 ) {
          float aa = fwidth( vGata.y ) + 0.01, m = 0.0;
          m = vGata.w * ( 1.0 - smoothstep( 0.06, 0.06 + aa, abs( vGata.y ) ) ) * step( fract( vGata.x / 6.0 ), 0.5 );        // streckad mittlinje
          float iz = step( vGata.z, vGata.x ) * step( vGata.x, vGata.z + 3.0 );                                                 // övergångsställe
          m = max( m, iz * smoothstep( 0.45 - aa, 0.45 + aa, fract( vGata.y / 1.0 + 0.25 ) ) * ( 1.0 - smoothstep( 2.7, 2.7 + aa, abs( vGata.y ) ) ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.82, 0.8 ), m * 0.85 );
        } else if ( vGata.y > 55.0 && vGata.y < 65.0 ) {
          float w = vGata.w; vec2 q = vec2( vGata.x, vGata.z );
          if ( w < 1.5 ) {                // betongplattor 40 × 40 cm med fogar och lite olika ton
            vec2 c = q / 0.4, fc = fract( c ), aa = fwidth( c ) + 0.01;
            float fog = max( 1.0 - smoothstep( 0.0, 0.035 + aa.x, min( fc.x, 1.0 - fc.x ) ), 1.0 - smoothstep( 0.0, 0.035 + aa.y, min( fc.y, 1.0 - fc.y ) ) );
            float h = fract( sin( dot( floor( c ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            diffuseColor.rgb *= ( 0.93 + 0.1 * h ) * ( 1.0 - 0.32 * fog );
          } else if ( w < 2.5 ) {         // trall: 14,5 cm bräder, mörka springor, skarvar och ton per bräda
            float c = q.y / 0.145, fc = fract( c ), aa = fwidth( c ) + 0.01, b = floor( c );
            float h = fract( sin( b * 12.9898 + 4.1 ) * 43758.5453 );
            float sk = fract( ( q.x + h * 3.1 ) / 3.6 ), skarv = 1.0 - smoothstep( 0.0, 0.004 + fwidth( q.x ) / 3.6, min( sk, 1.0 - sk ) );
            float spr = 1.0 - smoothstep( 0.0, 0.06 + aa, min( fc, 1.0 - fc ) );
            diffuseColor.rgb *= ( 0.82 + 0.3 * h ) * ( 1.0 - 0.7 * max( spr, skarv * 0.8 ) ) * ( 0.94 + 0.06 * sin( q.x * 7.0 + h * 20.0 + sin( q.x * 23.0 ) ) );
          } else if ( w < 3.5 ) {         // brunnslock i gjutjärn
            float rr = length( q ), aa = fwidth( rr ) + 0.004;
            float lock = 1.0 - smoothstep( 0.3, 0.3 + aa, rr ), ring = smoothstep( 0.3, 0.3 + aa, rr ) * ( 1.0 - smoothstep( 0.35, 0.35 + aa, rr ) );
            vec2 g = fract( q / 0.055 ); float rut = step( 0.72, max( g.x, g.y ) ) * step( 0.07, rr );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.05, 0.048, 0.046 ) * ( 1.0 + 0.7 * rut ), lock );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.13, 0.13, 0.125 ), ring );
          } else if ( w < 4.5 ) {         // dagvattenbrunn: galler i en ram
            vec2 a = abs( q ); float ram = step( a.x, 0.3 ) * step( a.y, 0.22 ), ins = step( a.x, 0.25 ) * step( a.y, 0.17 );
            float gal = step( 0.5, fract( q.x / 0.05 ) );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.1, 0.098, 0.095 ), ram );
            diffuseColor.rgb = mix( diffuseColor.rgb, mix( vec3( 0.012 ), vec3( 0.09, 0.088, 0.085 ), gal ), ins );
          } else if ( w > 6.5 && w < 7.5 ) {   // rund rabatt (radie 1,45 m) med en mörkare kant mot gräset
            float rr = length( q ); if ( rr > 1.45 ) discard;
            float n1 = fract( sin( dot( floor( q * 11.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            diffuseColor.rgb *= ( 0.8 + 0.4 * n1 ) * ( 1.0 - 0.25 * smoothstep( 1.3, 1.45, rr ) );
          } else if ( w < 5.5 ) {         // jord i rabatten: mullig, mörk, lite barkmull
            float n1 = fract( sin( dot( floor( q * 11.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
            diffuseColor.rgb *= 0.8 + 0.4 * n1;
          } else if ( w > 7.5 ) {         // fotoytor (Poly Haven): 8 marksten (uppfart), 9 granithällar (gång), 10 grus
            vec3 ft = w < 8.5 ? texture2D( tMarksten, q / 2.4 ).rgb : w < 9.5 ? texture2D( tGranithall, q / 1.8 ).rgb : texture2D( tGrusFoto, q / 1.6 ).rgb;
            diffuseColor.rgb = ft * ( w < 8.5 ? 0.95 : w < 9.5 ? 0.9 : 1.0 );
          }
        }`);
        Object.assign(s.uniforms, a.userData.foto || (a.userData.foto = { tMarksten: { value: fotoTex('images/tex/marksten-diff.webp', 1) }, tGranithall: { value: fotoTex('images/tex/granithall-diff.webp', 1) }, tGrusFoto: { value: tx('phGrus') } }));
        s.fragmentShader = 'uniform sampler2D tMarksten, tGranithall, tGrusFoto;\n' + s.fragmentShader;
      };
      a.customProgramCacheKey = () => 'miljo-gata';
      return a;
    });
    const o = new THREE.Mesh(g, m); o.name = 'gata'; o.receiveShadow = true; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }
  // gatlykta: grafitstolpe 4,7 m med en arm ut över gatan (lokala +z) och en frostad armatur som glöder
  const lyktaDel = (() => {
    let D = null;
    return () => {
      if (D) return D;
      D = del();
      const G = () => [0.06, 0.062, 0.066];
      ror(D, [[0, -0.05, 0, 0.075], [0, 2.4, 0, 0.065], [0, 4.62, 0, 0.05]], 6, UG, 1, G, 0.1);
      ror(D, [[0, 4.58, 0, 0.03], [0, 4.76, 0.35, 0.028], [0, 4.8, 0.82, 0.028]], 4, UG, 1, G, 0.1);
      ror(D, [[0, 4.69, 0.92, 0.17], [0, 4.62, 0.92, 0.19]], 8, UG, 1, () => [0.95, 0.94, 0.9], 1);
      ror(D, [[0, 4.82, 0.92, 0.12], [0, 4.7, 0.92, 0.2]], 8, UG, 1, G, 0.1);
      return D;
    };
  })();
  function* villaFjarrG() {   // stegvis (se byggG)
    const r = slump(1505), hy = hojdVilla, { V, flack, trad } = verktyg(r, hy, REF.blockerad, false);
    yield;
    // trädridå bakom kvarteren (i diset)
    villaSkog(r, trad, hy);   // skogsbryn i tre lager på kullarna, gläntor med tak (husritare-omgivning.js)
    yield;
    const T = yield* tradenG(V, ['gran', 'ek', 'tall', 'bjork'], 0);
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), klung: V.klung, mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor: [], upp: [],
      liv: { faglar: behall(faglar(r, 14)), fall: behall(fallande('lov')) },
    };
  }
  const VAGGAR = ['#8e2f25', '#d6b86a', '#e6e2d8', '#b8bbb4', '#7f8f9c', '#7c8a6a', '#3f3f3c', '#cdb89a', '#9a3a2c', '#e9dfc4'];
  // grannhusens färgsättningar: [fasad, snickerier, tak, taktyp 0 plåt / 1 tegel]
  const GRANNFARG = [
    ['#8a2c22', '#efece4', '#2b2b2c', 0], ['#e2c886', '#f2efe7', '#6b2a21', 1], ['#e9e5db', '#f4f2ec', '#38393b', 0], ['#c4c7c1', '#f2f0ea', '#5a2a22', 1],
    ['#8796a3', '#f1efe9', '#2c2d2f', 0], ['#9ba58b', '#f1efe8', '#3a3b3c', 1], ['#4a4b48', '#d9d6cf', '#2a2a2b', 0], ['#c99a52', '#f1eee6', '#6a2b22', 1],
    ['#a3402f', '#efece4', '#3b3c3e', 1], ['#e8dfc4', '#ffffff', '#4b3f36', 1],
  ];
  // husvarianter: L, W, takfot (he) och nockhöjd över takfot (R); fönster [u, y0, bredd, höjd] per vägg sett utifrån, dörrens u, entrétyp
  const GRANNTYP = [
    { L: 12, W: 8.4, he: 3.0, R: 2.1, dorr: 6.1, extra: 'farstu',
      fram: [[1.7, 1.25, 1.2, 1.2], [3.8, 1.25, 1.2, 1.2], [8.4, 1.25, 1.2, 1.2], [10.4, 1.25, 1.2, 1.2]],
      bak: [[1.8, 1.25, 1.2, 1.2], [4.4, 1.25, 2.2, 1.2], [7.9, 1.25, 1.2, 1.2], [10.3, 1.25, 1.2, 1.2]],
      gavel: [[2.3, 1.25, 1.2, 1.2], [6.1, 1.25, 1.2, 1.2], [4.2, 3.35, 0.7, 0.7]] },
    { L: 10, W: 8, he: 4.0, R: 3.1, dorr: 5.4, extra: 'trappa',
      fram: [[1.6, 1.25, 1.2, 1.25], [3.6, 1.25, 1.2, 1.25], [7.2, 1.25, 1.2, 1.25], [8.9, 1.25, 0.8, 1.25]],
      bak: [[2.0, 1.25, 1.2, 1.25], [5.0, 1.25, 2.0, 1.25], [8.2, 1.25, 1.2, 1.25]],
      gavel: [[2.0, 1.25, 1.1, 1.2], [6.0, 1.25, 1.1, 1.2], [2.9, 4.3, 0.9, 1.15], [5.1, 4.3, 0.9, 1.15]] },
    { L: 11, W: 8.6, he: 6.0, R: 2.3, dorr: 5.5, extra: 'skarm',
      fram: [[1.6, 1.25, 1.2, 1.25], [3.7, 1.25, 1.2, 1.25], [7.5, 1.25, 1.2, 1.25], [9.5, 1.25, 1.2, 1.25],
        [1.6, 3.95, 1.2, 1.25], [3.7, 3.95, 1.2, 1.25], [5.5, 3.95, 1.0, 1.25], [7.5, 3.95, 1.2, 1.25], [9.5, 3.95, 1.2, 1.25]],
      bak: [[2.0, 1.25, 1.2, 1.25], [4.5, 1.25, 2.0, 1.25], [7.2, 1.25, 1.2, 1.25], [9.3, 1.25, 1.2, 1.25], [2.0, 3.95, 1.2, 1.25], [4.5, 3.95, 1.2, 1.25], [7.2, 3.95, 1.2, 1.25], [9.3, 3.95, 1.2, 1.25]],
      gavel: [[2.5, 1.25, 1.2, 1.25], [6.1, 1.25, 1.2, 1.25], [2.5, 3.95, 1.2, 1.25], [6.1, 3.95, 1.2, 1.25]] },
  ];
  // bygger ett grannhus (lokalt: framsidan vid z = +W/2 mot gatan, x längs gatan) in i bufferten B
  function grannBygg(B, typ, cx, cy, cz, ry, farg, hash, spegel, opt = {}) {
    const { L, W, he, R } = typ, c = Math.cos(ry), s = Math.sin(ry), Y0 = 0.4;
    const tw = (x, y, z) => [cx + c * x + s * z, cy + y, cz - s * x + c * z], tn = n => [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]];
    const kvad = (Q, n, del, U) => {        // Q: fyra lokala hörn runt, n: lokal normal; vänds så att framsidan pekar längs n
      const e1 = [Q[1][0] - Q[0][0], Q[1][1] - Q[0][1], Q[1][2] - Q[0][2]], e2 = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1], Q[2][2] - Q[0][2]];
      const vand = dot(cross(e1, e2), n) < 0, b = B.P.length / 3, nw = tn(n);
      Q.forEach((q, k) => { const p = tw(...q); B.P.push(...p); B.N.push(...nw); B.U.push(...(U ? U[k] : [q[0] + q[2], q[1]])); B.D.push(del); B.F1.push(...farg[0]); B.F2.push(...farg[1]); B.F3.push(...farg[2]); B.H.push(hash, farg[3]); });
      if (vand) B.I.push(b, b + 2, b + 1, b, b + 3, b + 2); else B.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const tri = (Q, n, del) => { kvad([Q[0], Q[1], Q[2], Q[2]], n, del); };
    const lada = (x0, x1, y0, y1, z0, z1, del) => {
      kvad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], del); kvad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], del);
      kvad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], del); kvad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], del);
      kvad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], del);
    };
    // väggarna: origo i vänstra hörnet sett utifrån, tangent t, normal n (spegel: fönstren räknas från andra hållet)
    const V = {
      fram: { o: [-L / 2, 0, W / 2], t: [1, 0, 0], n: [0, 0, 1], l: L }, bak: { o: [L / 2, 0, -W / 2], t: [-1, 0, 0], n: [0, 0, -1], l: L },
      ost: { o: [L / 2, 0, W / 2], t: [0, 0, -1], n: [1, 0, 0], l: W }, vast: { o: [-L / 2, 0, -W / 2], t: [0, 0, 1], n: [-1, 0, 0], l: W },
    };
    const wp = (w, u, y, d) => [w.o[0] + w.t[0] * u + w.n[0] * d, y, w.o[2] + w.t[2] * u + w.n[2] * d];
    const rekt = (w, u0, u1, y0, y1, d, del, U) => kvad([wp(w, u0, y0, d), wp(w, u1, y0, d), wp(w, u1, y1, d), wp(w, u0, y1, d)], w.n, del, U);
    const tvar = (w, u0, u1, y, d0, d1, n, del) => kvad([wp(w, u0, y, d0), wp(w, u1, y, d0), wp(w, u1, y, d1), wp(w, u0, y, d1)], n, del);
    const sida = (w, u, y0, y1, d0, d1, n, del) => kvad([wp(w, u, y0, d0), wp(w, u, y1, d0), wp(w, u, y1, d1), wp(w, u, y0, d1)], n, del);
    let fonsterNr = 0;
    // fönster- och dörrmodul i 3D: glaset 3 cm ut, smyg (8 cm djup) ut till karmens framkant, karm, foder runt på väggen,
    // båge med spröjs (2- eller 4-luft), fönsterbleck i plåt. Dörr: blad med fyllningar och glasparti, handtag och tröskel.
    // nara = full modul (hus inom ~45 m), annars enklare (utan båge, fyllningar och sidoytor på fodret).
    const nara = opt.nara !== false;
    const fonster = (w, [u, y0, b, h], dorr = false) => {
      if (spegel) u = w.l - u;
      const a = u - b / 2, e = u + b / 2, k = fonsterNr++, ut = w.t.map(v => -v), yb = dorr ? Y0 : y0, yt = y0 + h;
      const GD = 0.03, KD = opt.hjalte ? 0.15 : 0.11, KB = 0.05, FB = 0.1, FD = 0.035, UVg = [[k, 0], [k + 1, 0], [k + 1, 1], [k, 1]];
      const kant = (x0, x1, y_0, y_1, d0, d1) => {   // en upphöjd list: framsida och (nära) sidor
        rekt(w, x0, x1, y_0, y_1, d1, 1);
        if (nara) { sida(w, x0, y_0, y_1, d0, d1, w.t, 1); sida(w, x1, y_0, y_1, d0, d1, ut, 1); tvar(w, x0, x1, y_1, d0, d1, [0, 1, 0], 1); tvar(w, x0, x1, y_0, d0, d1, [0, -1, 0], 1); }
      };
      if (dorr) {
        rekt(w, a, e, Y0 + 0.02, yt, GD + 0.01, 5);                                                  // dörrbladet
        rekt(w, a + 0.2, e - 0.2, yt - 0.72, yt - 0.18, GD + 0.015, 3, UVg);                          // glasparti
        kant(a + 0.16, e - 0.16, yt - 0.76, yt - 0.72, GD + 0.01, GD + 0.04); kant(a + 0.16, e - 0.16, yt - 0.18, yt - 0.14, GD + 0.01, GD + 0.04);
        if (nara) for (const [p0, p1] of [[Y0 + 0.2, Y0 + 0.75], [Y0 + 0.88, yt - 0.9]]) { rekt(w, a + 0.16, e - 0.16, p0, p1, GD + 0.03, 5); sida(w, a + 0.16, p0, p1, GD + 0.01, GD + 0.03, w.t, 5); sida(w, e - 0.16, p0, p1, GD + 0.01, GD + 0.03, ut, 5); tvar(w, a + 0.16, e - 0.16, p1, GD + 0.01, GD + 0.03, [0, 1, 0], 5); }
        kant(e - 0.17, e - 0.07, Y0 + 1.02, Y0 + 1.06, GD + 0.02, GD + 0.08); rekt(w, e - 0.13, e - 0.1, Y0 + 0.92, Y0 + 1.12, GD + 0.03, 6);   // handtag och skylt
        rekt(w, a - 0.06, e + 0.06, Y0 - 0.03, Y0 + 0.02, KD + 0.03, 6); tvar(w, a - 0.06, e + 0.06, Y0 + 0.02, GD, KD + 0.03, [0, 1, 0], 6);   // tröskel
      } else rekt(w, a, e, y0, yt, GD, 3, UVg);
      // glasrutan: riktigt glas (samma material som attefallshusens fönster) instansierat ovanpå det målade rummet bakom
      if (opt.rutor) {
        const ga = dorr ? a + 0.2 : a, ge = dorr ? e - 0.2 : e, g0 = dorr ? yt - 0.72 : y0, g1 = dorr ? yt - 0.18 : yt, uc = (ga + ge) / 2, yc = (g0 + g1) / 2;
        opt.rutor.push({ p: tw(...wp(w, uc, yc, GD + 0.012)), t: tn(w.t), n: tn(w.n), b: ge - ga, h: g1 - g0 });
      }
      if (opt.lang) {   // långt bort (över ~95 m): glas, foder och bleck räcker (syns som riktiga fönster i diset)
        rekt(w, a - KB - FB, e + KB + FB, yt, yt + KB + FB, FD, 1); rekt(w, a - KB - FB, a, yb, yt, FD, 1); rekt(w, e, e + KB + FB, yb, yt, FD, 1);
        if (!dorr) { rekt(w, a - KB - FB, e + KB + FB, y0 - KB - 0.07, y0, FD + 0.03, 6); rekt(w, u - 0.03, u + 0.03, y0, yt, GD + 0.02, 1); }
        return;
      }
      // smygen: fyra ytor från glaset ut till karmens framkant (mörkare, ligger i skugga)
      tvar(w, a, e, yt, GD, KD, [0, -1, 0], 9); sida(w, a, yb, yt, GD, KD, w.t, 9); sida(w, e, yb, yt, GD, KD, ut, 9);
      if (!dorr) tvar(w, a, e, y0, GD, KD, [0, 1, 0], 9);
      // karmen (5 cm) och fodret runt (10 cm, på väggen)
      kant(a - KB, e + KB, yt, yt + KB, FD, KD); kant(a - KB, a, yb, yt, FD, KD); kant(e, e + KB, yb, yt, FD, KD);
      if (!dorr) kant(a - KB, e + KB, y0 - KB, y0, FD, KD);
      // fodret (3,5 cm): bara framsidan och ytterkanterna (innerkanterna döljs av karmen)
      rekt(w, a - KB - FB, e + KB + FB, yt + KB, yt + KB + FB, FD, 1); rekt(w, a - KB - FB, a - KB, yb, yt + KB, FD, 1); rekt(w, e + KB, e + KB + FB, yb, yt + KB, FD, 1);
      if (opt.hjalte) { sida(w, a - KB - FB, yb, yt + KB + FB, 0, FD, ut, 1); sida(w, e + KB + FB, yb, yt + KB + FB, 0, FD, w.t, 1); tvar(w, a - KB - FB, e + KB + FB, yt + KB + FB, 0, FD, [0, 1, 0], 1); }
      if (!dorr) {
        // fönsterbleck: plåt som sticker ut 17 cm med en liten fall-kant
        rekt(w, a - KB - FB - 0.02, e + KB + FB + 0.02, y0 - KB - 0.07, y0 - KB, KD + 0.06, 6); tvar(w, a - KB - FB - 0.02, e + KB + FB + 0.02, y0 - KB, FD, KD + 0.06, [0, 1, 0], 6);
        // bågar och spröjs: lodpost (2-luft) och på högre fönster även en tvärpost (4-luft)
        const BB = 0.045, BDd = GD + 0.03, lod = b > 1.6 ? [a + b / 3, a + 2 * b / 3] : [u];
        if (nara) { rekt(w, a, e, yt - BB, yt, BDd, 1); rekt(w, a, e, y0, y0 + BB, BDd, 1); rekt(w, a, a + BB, y0, yt, BDd, 1); rekt(w, e - BB, e, y0, yt, BDd, 1); if (opt.hjalte) { tvar(w, a + BB, e - BB, yt - BB, GD, BDd, [0, -1, 0], 1); tvar(w, a + BB, e - BB, y0 + BB, GD, BDd, [0, 1, 0], 1); } }   // bågen (3 cm): framsida, och på de närmaste husen bågens inre kanter
        lod.forEach(x => kant(x - 0.032, x + 0.032, y0, yt, GD, KD + 0.02));   // mittposten står djupare ut än karmen (skugglinje), som på attefallshusen
        if (h > 1.0 && (k % 3)) kant(a, e, y0 + h * 0.62 - 0.02, y0 + h * 0.62 + 0.02, GD, BDd);
      }
    };
    // sockel, väggar och gavlar (gavelspetsen upp till nocken)
    for (const w of Object.values(V)) {
      rekt(w, -0.03, w.l + 0.03, -0.7, Y0, 0.03, 4);   // sockeln går ner i marken (husen längre ut står i svag lutning)
      rekt(w, 0, w.l, Y0, he, 0, 0, [[0, Y0], [w.l, Y0], [w.l, he], [0, he]]);
      if (w.l === W) kvad([wp(w, 0, he, 0), wp(w, W, he, 0), wp(w, W / 2, he + R, 0), wp(w, W / 2, he + R, 0)], w.n, 0, [[0, he], [W, he], [W / 2, he + R], [W / 2, he + R]]);
      // knutbrädor
      rekt(w, -0.03, 0.14, Y0, he, 0.035, 1); rekt(w, w.l - 0.14, w.l + 0.03, Y0, he, 0.035, 1);
      if (nara) { const ut2 = w.t.map(v => -v); sida(w, -0.03, Y0, he, 0, 0.035, ut2, 1); sida(w, 0.14, Y0, he, 0, 0.035, w.t, 1); sida(w, w.l - 0.14, Y0, he, 0, 0.035, ut2, 1); sida(w, w.l + 0.03, Y0, he, 0, 0.035, w.t, 1); }
    }
    // baksidans breda fönster blir en altandörr (glas ner till golvet) med ett trappsteg, så att även baksidan har en entré
    typ.fram.forEach(f => fonster(V.fram, f)); typ.bak.forEach(f => fonster(V.bak, opt.altandorr && f[2] >= 1.9 ? [f[0], Y0 + 0.12, f[2] * 0.85, 2.0] : f));
    // altandörren: tröskeln Y0 + 0,12 över grunden; två steg (stigning ~17 cm, steg 30 cm) ner till marken, centrerade på
    // dörren, så att dörren aldrig öppnar mot en sockelvägg. Ligger det en altan framför (villaområdets grannar) täcker den stegen.
    let altan = null;
    if (opt.altandorr) { const wd = typ.bak.find(f => f[2] >= 1.9); if (wd) { const u = spegel ? L - wd[0] : wd[0], xb = L / 2 - u, sY = Y0 + 0.12, b = wd[2] * 0.5 + 0.15;
      lada(xb - b, xb + b, 0, sY * 2 / 3, -W / 2 - 0.3, -W / 2, 4); lada(xb - b, xb + b, 0, sY / 3, -W / 2 - 0.6, -W / 2 - 0.3, 4);
      altan = { xb, b: wd[2] * 0.85, sY }; } }
    typ.gavel.forEach(f => { fonster(V.ost, f); fonster(V.vast, f); });
    fonster(V.fram, [typ.dorr, Y0, 1.0, 2.15], true);
    // taket: två fall med utsprång, tjocklek, takfotsbräda, vindskivor och nockplåt; hängrännor och stuprör
    const OV = 0.45, OG = 0.35, T = 0.22, X = L / 2 + OG, ZE = W / 2 + OV, yE = he - OV * R / (W / 2), yR = he + R;
    for (const sz of [-1, 1]) {
      const n = norm([0, W / 2, sz * R]), sl = Math.hypot(ZE, yR - yE);
      kvad([[-X, yE + T, sz * ZE], [X, yE + T, sz * ZE], [X, yR + T, 0], [-X, yR + T, 0]], n, 2, [[-X, sl], [X, sl], [X, 0], [-X, 0]]);
      kvad([[-X, yE, sz * ZE], [X, yE, sz * ZE], [X, yR, 0], [-X, yR, 0]], [0, -n[1], -n[2]], 1);
      kvad([[-X, yE, sz * ZE], [X, yE, sz * ZE], [X, yE + T, sz * ZE], [-X, yE + T, sz * ZE]], [0, 0, sz], 1);
      for (const sx of [-1, 1]) kvad([[sx * X, yE - 0.02, sz * ZE], [sx * X, yR - 0.02, 0], [sx * X, yR + T + 0.03, 0], [sx * X, yE + T + 0.03, sz * ZE]], [sx, 0, 0], 1);
      // vindskivorna som riktiga brädor (2,8 cm tjocka) med överkant, på husen nära
      if (nara) for (const sx of [-1, 1]) { const Xv = sx * (X + 0.028); kvad([[Xv, yE - 0.02, sz * ZE], [Xv, yR - 0.02, 0], [Xv, yR + T + 0.03, 0], [Xv, yE + T + 0.03, sz * ZE]], [sx, 0, 0], 1); kvad([[sx * X, yE + T + 0.03, sz * ZE], [Xv, yE + T + 0.03, sz * ZE], [Xv, yR + T + 0.03, 0], [sx * X, yR + T + 0.03, 0]], norm([0, W / 2, sz * R]), 1); kvad([[sx * X, yE - 0.02, sz * ZE], [Xv, yE - 0.02, sz * ZE], [Xv, yE + T + 0.03, sz * ZE], [sx * X, yE + T + 0.03, sz * ZE]], [0, 0, sz], 1); }
      const PT = (t, h) => [yE + T + (yR - yE) * t + h, sz * ZE * (1 - t)];   // punkt på takytan (t = 0 takfot, 1 nock), h ovanför
      // snörasskydd: två rör längs takfoten på konsoler (husen nära)
      if (opt.hjalte) {
        const [ys, zs] = PT(0.1, 0.1);
        for (const dy of [0, 0.07]) lada(-X + 0.2, X - 0.2, ys + dy - 0.015, ys + dy + 0.015, zs - 0.015, zs + 0.015, 6);
        for (let x = -X + 0.4; x < X - 0.3; x += 1.1) lada(x - 0.012, x + 0.012, ys - 0.1, ys + 0.09, zs - 0.03, zs + 0.03, 6);
      }
      // takstege på framsidan (husen nära): två vangstycken och pinnar från takfoten till nocken
      if (opt.hjalte && sz === 1) {
        const xl = (spegel ? 1 : -1) * L * 0.3, nn = Math.round(sl / 0.3);
        for (const dx of [0, 0.42]) { const [y0s, z0s] = PT(0.04, 0.09), [y1s, z1s] = PT(0.97, 0.09); kvad([[xl + dx - 0.025, y0s, z0s], [xl + dx + 0.025, y0s, z0s], [xl + dx + 0.025, y1s, z1s], [xl + dx - 0.025, y1s, z1s]], n, 6); kvad([[xl + dx + 0.025, y0s - 0.06, z0s], [xl + dx + 0.025, y0s, z0s], [xl + dx + 0.025, y1s, z1s], [xl + dx + 0.025, y1s - 0.06, z1s]], [1, 0, 0], 6); }
        for (let k = 1; k < nn; k++) { const [yk, zk] = PT(0.04 + 0.93 * k / nn, 0.1); lada(xl, xl + 0.42, yk - 0.012, yk + 0.012, zk - 0.012, zk + 0.012, 6); }
      }
      kvad([[-X - 0.02, yR + T + 0.01, 0], [X + 0.02, yR + T + 0.01, 0], [X + 0.02, yR + T + 0.01 - 0.06 * R / (W / 2) * 1.5, sz * 0.13], [-X - 0.02, yR + T + 0.01 - 0.06 * R / (W / 2) * 1.5, sz * 0.13]], [0, 1, sz * 0.4], 6);
      lada(-X + 0.05, X - 0.05, yE - 0.12, yE + 0.02, sz * (ZE + 0.02) - 0.07, sz * (ZE + 0.02) + 0.07, 6);
      for (const sx of [-1, 1]) lada(sx * (L / 2 - 0.3) - 0.045, sx * (L / 2 - 0.3) + 0.045, 0.12, yE - 0.06, sz * (W / 2 + 0.16) - 0.045, sz * (W / 2 + 0.16) + 0.045, 6);
      // solceller på takfallet mot gatan (några hus): paneler med aluminiumram, 7 cm över pannorna
      if (opt.sol && sz === 1) {
        const ta = 0.16, tb = 0.82, xa = -L * 0.34, xb = L * 0.18, P0 = t => [yE + T + (yR - yE) * t + 0.07, ZE * (1 - t)];
        const [ya, za] = P0(ta), [yb, zb] = P0(tb);
        if (!nara) kvad([[xa, ya, za], [xb, ya, za], [xb, yb, zb], [xa, yb, zb]], n, 8, [[xa, 0], [xb, 0], [xb, sl * (tb - ta)], [xa, sl * (tb - ta)]]);
        else {
          // riktiga paneler: 1,0 × 1,65 m med 3 cm glipor, 4 cm tjocka med aluminiumkant, på två skenor
          const PW = 1.0, PH = 1.65, nx = Math.floor((xb - xa) / (PW + 0.03)), nt = Math.floor(sl * (tb - ta) / (PH + 0.03)), dt = (PH + 0.03) / sl;
          const P1 = (t, h) => [yE + T + (yR - yE) * t + h, ZE * (1 - t)];
          for (let j = 0; j < nt; j++) {
            const t0 = ta + j * dt, t1 = t0 + PH / sl;
            for (const tt of [t0 + 0.22 * (t1 - t0), t0 + 0.78 * (t1 - t0)]) { const [yr, zr] = P1(tt, 0.035); lada(xa - 0.05, xa + nx * (PW + 0.03) + 0.02, yr - 0.02, yr + 0.02, zr - 0.02, zr + 0.02, 6); }
            for (let i = 0; i < nx; i++) {
              const x0 = xa + i * (PW + 0.03), x1 = x0 + PW, [y0p, z0p] = P1(t0, 0.06), [y1p, z1p] = P1(t1, 0.06), [y0q, z0q] = P1(t0, 0.1), [y1q, z1q] = P1(t1, 0.1);
              kvad([[x0, y0q, z0q], [x1, y0q, z0q], [x1, y1q, z1q], [x0, y1q, z1q]], n, 8, [[0.02, 0.02], [PW + 0.02, 0.02], [PW + 0.02, PH + 0.05], [0.02, PH + 0.05]]);
              kvad([[x0, y0p, z0p], [x1, y0p, z0p], [x1, y0q, z0q], [x0, y0q, z0q]], [0, -n[2], n[1]], 6); kvad([[x0, y1p, z1p], [x0, y1q, z1q], [x1, y1q, z1q], [x1, y1p, z1p]], [0, n[2], -n[1]], 6);
              kvad([[x0, y0p, z0p], [x0, y0q, z0q], [x0, y1q, z1q], [x0, y1p, z1p]], [-1, 0, 0], 6); kvad([[x1, y0p, z0p], [x1, y1p, z1p], [x1, y1q, z1q], [x1, y0q, z0q]], [1, 0, 0], 6);
            }
          }
        }
      }
    }
    const xs = (spegel ? -1 : 1) * L * 0.22;
    lada(xs - 0.3, xs + 0.3, he + R * 0.4, yR + T + 0.85, -0.95, -0.35, 7);
    // skorstenens plåtbeslag mot taket och en täckplåt med droppkant överst
    { const yt = yR + T - 0.65 / ZE * (yR - yE); lada(xs - 0.36, xs + 0.36, yt - 0.06, yt + 0.14, -1.02, -0.28, 6); lada(xs - 0.37, xs + 0.37, yR + T + 0.85, yR + T + 0.92, -1.03, -0.27, 6); }
    // entrén
    const xd = -L / 2 + (spegel ? L - typ.dorr : typ.dorr), z0 = W / 2;
    if (typ.extra === 'farstu') {
      lada(xd - 1.2, xd + 1.2, 0, Y0, z0, z0 + 1.6, 4); lada(xd - 0.7, xd + 0.7, 0, 0.2, z0 + 1.6, z0 + 1.95, 4);
      for (const sx of [-1, 1]) lada(xd + sx * 1.02 - 0.06, xd + sx * 1.02 + 0.06, Y0, 2.75, z0 + 1.38, z0 + 1.5, 1);
      // räcke längs farstuns sidor: handledare och spjälor
      if (opt.racke) for (const sx of [-1, 1]) {
        lada(xd + sx * 1.14 - 0.035, xd + sx * 1.14 + 0.035, Y0 + 0.84, Y0 + 0.9, z0 + 0.05, z0 + 1.4, 1);
        for (let k = 0; k < 5; k++) { const zz = z0 + 0.22 + k * 0.27; lada(xd + sx * 1.14 - 0.016, xd + sx * 1.14 + 0.016, Y0, Y0 + 0.84, zz - 0.016, zz + 0.016, 1); }
      }
      const yk = 2.75, yn = 3.35;
      for (const sx of [-1, 1]) kvad([[xd + sx * 1.3, yk, z0], [xd + sx * 1.3, yk, z0 + 1.75], [xd, yn, z0 + 1.75], [xd, yn, z0]], norm([sx * 0.6, 1.3, 0]), 2, [[0, 1.4], [1.75, 1.4], [1.75, 0], [0, 0]]);
      tri([[xd - 1.2, yk, z0 + 1.7], [xd + 1.2, yk, z0 + 1.7], [xd, yn - 0.05, z0 + 1.7]], [0, 0, 1], 1);
    } else if (typ.extra === 'trappa') {
      lada(xd - 0.9, xd + 0.9, 0, Y0, z0, z0 + 1.0, 4); lada(xd - 0.9, xd + 0.9, 0, 0.2, z0 + 1.0, z0 + 1.35, 4);
      lada(xd - 0.95, xd + 0.95, 2.66, 2.78, z0, z0 + 1.05, 1); for (const sx of [-1, 1]) lada(xd + sx * 0.85 - 0.025, xd + sx * 0.85 + 0.025, 2.4, 2.66, z0, z0 + 0.7, 1);   // entrétak på konsoler
      if (opt.racke) for (const sx of [-1, 1]) {
        lada(xd + sx * 0.86 - 0.03, xd + sx * 0.86 + 0.03, Y0 + 0.84, Y0 + 0.9, z0 + 0.05, z0 + 0.95, 1);
        for (let k = 0; k < 3; k++) { const zz = z0 + 0.2 + k * 0.3; lada(xd + sx * 0.86 - 0.016, xd + sx * 0.86 + 0.016, Y0, Y0 + 0.84, zz - 0.016, zz + 0.016, 1); }
      }
    } else {
      lada(xd - 1.1, xd + 1.1, 2.72, 2.84, z0, z0 + 1.1, 1); lada(xd - 0.9, xd + 0.9, 0, 0.2, z0, z0 + 0.6, 4);
    }
    return { dorr: tw(xd + 0.75, 2.25, z0 + 0.12), fram: tw(0, 0, z0), tw, tn, xd, z0, yR, T, X, he, Y0, altan };
  }
  function grannNat(B) {
    if (!B.I.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.N, 3));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(B.U, 2));
    g.setAttribute('aDel', new THREE.Float32BufferAttribute(B.D, 1));
    g.setAttribute('aF1', new THREE.Float32BufferAttribute(B.F1, 3));
    g.setAttribute('aF2', new THREE.Float32BufferAttribute(B.F2, 3));
    g.setAttribute('aF3', new THREE.Float32BufferAttribute(B.F3, 3));
    g.setAttribute('aHH', new THREE.Float32BufferAttribute(B.H, 2));
    g.setIndex(B.I); g.computeBoundingSphere();
    const m = egenMat('grannD', () => {
      const a = new THREE.MeshLambertMaterial({ color: 0xffffff });
      // fototexturer (Poly Haven, CC0): målad stående panel, plåt- och tegeltak, furudörr och puts; färgas efter husets
      // kulör (fotots ljushet mot dess medelton), normalkartorna (OpenGL) ger panelens fogar och takets falsar relief
      const FT = { tFas: fotoTex('images/tex/fasad-vit-diff.webp', 1), tFasN: fotoNor('images/tex/fasad-vit-nor.webp'), tPlat: fotoTex('images/tex/tak-plat-diff.webp', 1), tPlatN: fotoNor('images/tex/tak-plat-nor.webp'),
        tTegel: fotoTex('images/tex/tak-tegel-diff.webp', 1), tTegelN: fotoNor('images/tex/tak-tegel-nor.webp'), tDorr: fotoTex('images/tex/dorr-furu-diff.webp', 1), tPuts: fotoTex('images/tex/puts-diff.webp', 1) };
      const FTU = Object.fromEntries(Object.entries(FT).map(([k, t]) => [k, { value: t }]));
      a.onBeforeCompile = s => {
        Object.assign(s.uniforms, { uLampa: VU.uLampa, miljoLjus: LJUS }, FTU);
        s.vertexShader = 'attribute vec2 aUV;\nattribute float aDel;\nattribute vec3 aF1;\nattribute vec3 aF2;\nattribute vec3 aF3;\nattribute vec2 aHH;\nvarying vec2 vUV;\nvarying float vDel;\nvarying vec3 vF1;\nvarying vec3 vF2;\nvarying vec3 vF3;\nvarying vec2 vHH;\n' +
          s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUV = aUV; vDel = aDel; vF1 = aF1; vF2 = aF2; vF3 = aF3; vHH = aHH;');
        s.fragmentShader = 'uniform float uLampa;\nuniform vec3 miljoLjus;\nvarying vec2 vUV;\nvarying float vDel;\nvarying vec3 vF1;\nvarying vec3 vF2;\nvarying vec3 vF3;\nvarying vec2 vHH;\n' +
          'uniform sampler2D tFas, tFasN, tPlat, tPlatN, tTegel, tTegelN, tDorr, tPuts;\n' +
          'float fotoL( sampler2D t, vec2 uv ) { const vec3 W = vec3( 0.2126, 0.7152, 0.0722 ); return dot( texture2D( t, uv ).rgb, W ) / max( dot( textureLod( t, vec2( 0.5 ), 11.0 ).rgb, W ), 1e-3 ); }\n' + s.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
          float tand = 0.0;
          {
            int d = int( vDel + 0.5 );
            vec3 c = vF2;
            if ( d == 0 ) {                                   // stående panel: fotot av målade brädor (3,6 m per ruta, ~19 cm bräda) i husets kulör
              float l = fotoL( tFas, vUV / 3.6 );
              c = vF1 * clamp( 1.0 + ( l - 1.0 ) * 1.8, 0.55, 1.3 );
              c *= 0.88 + 0.12 * smoothstep( 0.4, 0.9, vUV.y );
            } else if ( d == 2 ) {                            // falsat plåttak (foto, 4 m per ruta) eller tegelpannor (foto, 4,4 m), i takets kulör
              if ( vHH.y < 0.5 ) c = vF3 * clamp( 1.0 + ( fotoL( tPlat, vUV / 4.0 ) - 1.0 ) * 1.4, 0.5, 1.4 );
              else { vec2 tu = vUV / 5.2; vec3 tt = texture2D( tTegel, tu ).rgb, tm = textureLod( tTegel, vec2( 0.5 ), 11.0 ).rgb; c = mix( vF3 * clamp( 1.0 + ( fotoL( tTegel, tu ) - 1.0 ) * 0.75, 0.6, 1.3 ), vF3 * clamp( tt / max( tm, vec3( 1e-3 ) ), 0.6, 1.4 ), 0.12 ) * vec3( 0.92, 0.95, 0.97 ); }
            } else if ( d == 3 ) {                            // glas: mörk spegling på dagen, varmt sken med gardiner på kvällen
              float k = floor( vUV.x ), u = fract( vUV.x );
              float lit = step( 0.42, fract( sin( k * 12.9898 + vHH.x * 78.233 ) * 43758.5453 ) );
              c = mix( vec3( 0.025, 0.032, 0.04 ), vec3( 0.2, 0.25, 0.3 ), smoothstep( 0.15, 1.0, vUV.y ) * ( 0.6 + 0.4 * u ) );
              float gard = 1.0 - smoothstep( 0.14, 0.24, u ) * smoothstep( 0.86, 0.76, u );
              // gardiner syns även på dagen: ljusa sidovåder och ibland en kappa upptill (inte i alla fönster)
              float gh = fract( sin( k * 3.71 + vHH.x * 17.3 ) * 917.13 );
              float kappa = step( 0.55, gh ) * smoothstep( 0.84, 0.87, vUV.y );
              vec3 tyg = gh < 0.3 ? vec3( 0.66, 0.64, 0.58 ) : gh < 0.75 ? vec3( 0.72, 0.71, 0.68 ) : vec3( 0.55, 0.42, 0.33 );
              c = mix( c, tyg * ( 0.72 + 0.28 * vUV.y ) * ( 0.9 + 0.1 * sin( u * 60.0 ) ), max( gard, kappa ) * step( 0.12, gh ) * 0.9 );
              tand = lit * ( 0.55 + 0.45 * ( 1.0 - gard ) ) * ( 0.85 + 0.15 * vUV.y );
              c = mix( c, mix( vec3( 0.5, 0.36, 0.2 ), vec3( 0.42, 0.2, 0.12 ), gard ), lit * uLampa );
            } else if ( d == 4 ) {                            // sockel i puts: ljusgrå, fint korn och svaga fläckar
              c = vec3( 0.42, 0.41, 0.39 ) * clamp( fotoL( tPuts, vUV / 2.0 ), 0.6, 1.4 ) * ( 0.94 + 0.06 * sin( vUV.x * 1.7 + vUV.y * 3.1 ) );   // (foto, Poly Haven)
            }
            else if ( d == 5 ) {                              // dörrblad: målat trä (furufotots ådring), den bruna är oljad furu
              float h = fract( vHH.x * 13.7 ); c = h < 0.3 ? vec3( 0.06, 0.12, 0.08 ) : h < 0.55 ? vec3( 0.25, 0.05, 0.04 ) : h < 0.8 ? vec3( 0.05, 0.08, 0.16 ) : vec3( 0.22, 0.13, 0.07 );
              c *= mix( 1.0, clamp( fotoL( tDorr, vUV / 2.2 ), 0.4, 1.8 ), h < 0.8 ? 0.35 : 0.9 );
            }
            else if ( d == 6 ) c = vHH.y > 0.5 ? vec3( 0.06, 0.062, 0.065 ) : vF3 * 0.95;
            else if ( d == 7 ) c = vec3( 0.28, 0.09, 0.06 ) * ( 0.85 + 0.15 * step( 0.14, fract( vUV.y / 0.075 ) ) );
            else if ( d == 9 ) c = vF2 * 0.62;                // smygen (fönstrets insida), i skugga
            else if ( d == 8 ) {                              // solpaneler: mörkblå celler, ljus aluminiumram per panel
              vec2 g = vec2( vUV.x / 1.04, vUV.y / 1.72 ), fg = fract( g ), aa = fwidth( g ) + 0.01;
              float ram = max( 1.0 - smoothstep( 0.0, 0.012 + aa.x, min( fg.x, 1.0 - fg.x ) ), 1.0 - smoothstep( 0.0, 0.008 + aa.y, min( fg.y, 1.0 - fg.y ) ) );
              vec2 ce = fract( g * vec2( 6.0, 10.0 ) ), ca = fwidth( g * vec2( 6.0, 10.0 ) ) + 0.01;
              float cl = max( 1.0 - smoothstep( 0.0, 0.03 + ca.x, min( ce.x, 1.0 - ce.x ) ), 1.0 - smoothstep( 0.0, 0.03 + ca.y, min( ce.y, 1.0 - ce.y ) ) ) * ( 1.0 - smoothstep( 0.02, 0.06, aa.x ) );
              c = mix( vec3( 0.006, 0.008, 0.02 ) + vec3( 0.008, 0.009, 0.014 ) * cl, vec3( 0.16, 0.17, 0.18 ), ram * ( 1.0 - smoothstep( 0.015, 0.06, max( aa.x, aa.y ) ) ) );
            }
            diffuseColor.rgb = c;
          }`)
          // relief: lockpanelens läkt och plåttakets falsar (och pannornas rader) böjer normalen, så att solen ger ljus och skugga
          .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          {
            int dn = int( vDel + 0.5 );
            if ( dn == 0 || dn == 2 ) {
              vec3 q1 = dFdx( -vViewPosition ), q2 = dFdy( -vViewPosition );
              vec2 s1 = dFdx( vUV ), s2 = dFdy( vUV );
              float sg = sign( s1.x * s2.y - s2.x * s1.y );   // speglad uv: tangenterna byter håll
              vec3 Tt = ( q1 * s2.y - q2 * s1.y ) * sg, Bt = ( q2 * s1.x - q1 * s2.x ) * sg;
              if ( length( Tt ) > 1e-7 && length( Bt ) > 1e-7 ) {
                Tt = normalize( Tt - normal * dot( Tt, normal ) ); Bt = normalize( Bt - normal * dot( Bt, normal ) );
                // fotots normalkarta (OpenGL: grönt uppåt i v)
                vec3 nt = ( dn == 0 ? texture2D( tFasN, vUV / 3.6 ).xyz : vHH.y < 0.5 ? texture2D( tPlatN, vUV / 4.0 ).xyz : texture2D( tTegelN, vUV / 5.2 ).xyz ) * 2.0 - 1.0;
                nt.xy *= dn == 0 ? 1.6 : 1.2;
                normal = normalize( Tt * nt.x + Bt * nt.y + normal * max( nt.z, 0.2 ) );
              }
            }
          }`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;
          totalEmissiveRadiance += vec3( 1.0, 0.62, 0.3 ) * 0.9 * tand * uLampa;
          if ( int( vDel + 0.5 ) == 3 || int( vDel + 0.5 ) == 8 ) {   // glaset (och solpanelernas glas) speglar himlen och marken (fresnel)
            vec3 Vv = normalize( vViewPosition ), Rw = ( vec4( reflect( -Vv, normal ), 0.0 ) * viewMatrix ).xyz;
            float fr = 0.07 + 0.65 * pow( 1.0 - max( dot( normal, Vv ), 0.0 ), 4.0 );
            vec3 env = Rw.y > 0.0 ? mix( miljoLjus * 2.4, miljoLjus * vec3( 1.5, 1.85, 2.6 ), clamp( Rw.y * 1.6, 0.0, 1.0 ) ) : miljoLjus * vec3( 0.55, 0.6, 0.42 );
            if ( int( vDel + 0.5 ) == 8 ) fr = 0.012 + 0.12 * pow( 1.0 - max( dot( normal, Vv ), 0.0 ), 6.0 );   // solpanel: nästan svart, bara en svag glans i flack vinkel
            totalEmissiveRadiance += env * fr * ( 1.0 - 0.7 * uLampa );
            reflectedLight.directDiffuse *= 0.45;
          }`);
      };
      a.customProgramCacheKey = () => 'miljo-grannD';
      return a;
    });
    const o = new THREE.Mesh(g, m); o.name = 'grannhus-nara'; o.receiveShadow = true; o.castShadow = true; o.matrixAutoUpdate = false; o.userData.egen = true;
    return o;
  }
  // småsaker i kvarteret (ett ritanrop, vegetationens skuggare: vimpeln fladdrar, lamporna glöder)
  const TING = {};
  const ting = namn => TING[namn] || (TING[namn] = (() => {
    const D = del(), A = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], L3 = (c, h, f) => lada3(D, c, A, h, f), MORK = [0.03, 0.032, 0.035];
    if (namn === 'brevlada') { L3([0, 0.55, -0.1], [0.035, 0.55, 0.035], MORK); L3([0, 1.17, 0], [0.13, 0.09, 0.23], [0.1, 0.16, 0.12]); L3([0.135, 1.27, -0.1], [0.006, 0.05, 0.016], [0.5, 0.05, 0.03]); }
    else if (namn === 'bil') {       // enkel personbil, kaross i hörnfärg (tint), lokala +z framåt
      L3([0, 0.6, 0], [0.88, 0.28, 2.15], ETT); L3([0, 1.1, -0.2], [0.8, 0.24, 1.1], [0.04, 0.05, 0.06]); L3([0, 1.35, -0.25], [0.74, 0.02, 0.92], ETT);
      for (const x of [-0.84, 0.84]) for (const z of [-1.38, 1.38]) L3([x, 0.33, z], [0.11, 0.33, 0.33], [0.02, 0.02, 0.022]);
      for (const x of [-0.6, 0.6]) { L3([x, 0.72, 2.16], [0.16, 0.06, 0.01], [0.9, 0.9, 0.85]); L3([x, 0.76, -2.16], [0.18, 0.05, 0.01], [0.45, 0.02, 0.02]); }
    } else if (namn === 'tunna') { L3([0, 0.52, 0], [0.3, 0.52, 0.36], ETT); L3([0, 1.06, 0], [0.32, 0.03, 0.38], [0.6, 0.6, 0.6]); }
    else if (namn === 'staket') { L3([0, 0.48, 0], [0.9, 0.36, 0.015], [0.86, 0.85, 0.82]); L3([-0.9, 0.5, 0], [0.04, 0.5, 0.04], [0.86, 0.85, 0.82]); }
    else if (namn === 'studsmatta') {
      const P = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * 6.283; P.push([Math.cos(a) * 1.8, 0.85, Math.sin(a) * 1.8, 0.05]); }
      ror(D, P, 4, UG, 1, () => [0.08, 0.2, 0.45]);
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, b = (i + 1) / 18 * 6.283, k = D.P.length / 3; hp(D, 0, 0.84, 0, 0, 1, 0, 0.7, 0.5, MORK); hp(D, Math.cos(b) * 1.7, 0.84, Math.sin(b) * 1.7, 0, 1, 0, 0.7, 0.5, MORK); hp(D, Math.cos(a) * 1.7, 0.84, Math.sin(a) * 1.7, 0, 1, 0, 0.7, 0.5, MORK); D.I.push(k, k + 1, k + 2); }
      for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.4; L3([Math.cos(a) * 1.75, 0.42, Math.sin(a) * 1.75], [0.03, 0.42, 0.03], [0.4, 0.4, 0.42]); }
    } else if (namn === 'lekstuga') {
      // liten faluröd stuga: vita knutar, dörr och spröjsat fönster på gaveln (lokala +z), sadeltak med takfot och
      // vita vindskivor, fönster på ena långsidan, trappsteg och en låg grund
      const FALU = [0.4, 0.07, 0.045], VIT = [0.88, 0.87, 0.83], GLAS = [0.05, 0.065, 0.08], TAK = [0.06, 0.06, 0.065];
      const HB = 0.75, HD = 0.85, HV = 1.38, HN = 2.05;
      L3([0, 0.05, 0], [HB + 0.03, 0.05, HD + 0.03], [0.3, 0.29, 0.27]);
      L3([0, 0.1 + (HV - 0.1) / 2, 0], [HB, (HV - 0.1) / 2, HD], FALU);
      for (const sz of [-1, 1]) {   // gavelspetsarna
        const k = D.P.length / 3;
        hp(D, -HB, HV, sz * HD, 0, 0, sz, 0.83, 0.5, FALU); hp(D, HB, HV, sz * HD, 0, 0, sz, 0.83, 0.5, FALU); hp(D, 0, HN, sz * HD, 0, 0, sz, 0.83, 0.5, FALU);
        if (sz > 0) D.I.push(k, k + 1, k + 2); else D.I.push(k, k + 2, k + 1);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L3([sx * HB, 0.1 + (HV - 0.1) / 2, sz * HD], [0.04, (HV - 0.1) / 2, 0.04], VIT);
      // dörr med foder och ett spröjsat fönster bredvid på gaveln
      L3([0.3, 0.6, HD + 0.01], [0.21, 0.48, 0.01], [0.7, 0.55, 0.2]);
      for (const [x, y, hx, hy] of [[0.07, 0.62, 0.025, 0.52], [0.53, 0.62, 0.025, 0.52], [0.3, 1.11, 0.255, 0.025]]) L3([x, y, HD + 0.015], [hx, hy, 0.012], VIT);
      L3([0.42, 0.62, HD + 0.025], [0.015, 0.015, 0.01], [0.15, 0.15, 0.15]);
      const fonster = (cx, cy, cz, ax, w, h) => {   // glas, karm och korsspröjs; ax: 'z' = på gaveln, 'x' = på långsidan
        const P = (a, b) => ax === 'z' ? [cx + a, cy + b, cz] : [cx, cy + b, cz + a], H = (ha, hb, t) => ax === 'z' ? [ha, hb, t] : [t, hb, ha];
        L3(P(0, 0), H(w, h, 0.008), GLAS);
        const d = ax === 'z' ? [0, 0, 0.012] : [0.012 * Math.sign(cx), 0, 0], Q = (a, b) => { const p = P(a, b); return [p[0] + d[0], p[1], p[2] + d[2]]; };
        for (const [a, b, ha, hb] of [[0, h, w + 0.03, 0.03], [0, -h, w + 0.03, 0.03], [-w, 0, 0.03, h], [w, 0, 0.03, h], [0, 0, w, 0.015], [0, 0, 0.015, h]]) L3(Q(a, b), H(ha, hb, 0.012), VIT);
      };
      fonster(-0.38, 0.85, HD + 0.008, 'z', 0.2, 0.2);
      fonster(HB + 0.008, 0.85, -0.1, 'x', 0.25, 0.2);
      // sadeltaket (ryggen längs z) med takfot, vita vindskivor på gavlarna
      const th = Math.atan2(HN - HV, HB), hl = Math.hypot(HB, HN - HV) / 2 + 0.09;
      for (const sx of [-1, 1]) {
        const d = [sx * Math.cos(th), -Math.sin(th), 0], up = [sx * Math.sin(th), Math.cos(th), 0], ax3 = [d, up, cross(d, up)];
        const c = [sx * HB / 2 + d[0] * 0.09 + up[0] * 0.03, (HV + HN) / 2 + d[1] * 0.09 + up[1] * 0.03, 0];
        lada3(D, c, ax3, [hl, 0.025, HD + 0.14], TAK);
        for (const sz of [-1, 1]) lada3(D, [c[0] - up[0] * 0.04, c[1] - up[1] * 0.04, sz * (HD + 0.13)], ax3, [hl, 0.05, 0.012], VIT);
      }
      L3([0.3, 0.07, HD + 0.2], [0.28, 0.07, 0.16], [0.42, 0.32, 0.22]);   // trappsteg
    } else if (namn === 'utegrupp' || namn === 'utegruppSvart') {
      // bord med ben, sarg och spjälad skiva, fyra stolar med ryggstöd och dynor (lokala z: stolarna på var sin sida)
      const T = namn === 'utegrupp' ? [0.4, 0.27, 0.16] : [0.075, 0.075, 0.08], TM = T.map(v => v * 0.75), DYNA = namn === 'utegrupp' ? [0.78, 0.74, 0.64] : [0.55, 0.12, 0.08];
      for (let i = 0; i < 5; i++) L3([0, 0.735, -0.36 + i * 0.18], [0.75, 0.016, 0.075], T);
      for (const sz of [-1, 1]) L3([0, 0.69, sz * 0.4], [0.7, 0.035, 0.015], TM);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L3([sx * 0.66, 0.36, sz * 0.36], [0.025, 0.36, 0.025], TM);
      for (const [cx, cz, s] of [[-0.4, 0.78, 1], [0.4, 0.78, 1], [-0.4, -0.78, -1], [0.4, -0.78, -1]]) {
        L3([cx, 0.44, cz], [0.21, 0.018, 0.2], T);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) L3([cx + sx * 0.18, 0.22, cz + sz * 0.17], [0.017, 0.22, 0.017], TM);
        for (const sx of [-1, 1]) L3([cx + sx * 0.18, 0.7, cz + s * 0.19], [0.017, 0.26, 0.017], TM);
        for (const y of [0.62, 0.78]) L3([cx, y, cz + s * 0.2], [0.18, 0.04, 0.012], T);
        L3([cx, 0.48, cz - s * 0.01], [0.19, 0.025, 0.18], DYNA);
      }
    } else if (namn === 'flagga') {
      // vit stång (7,7 m) med förgylld knopp, lina med fall ner till en knap på stången, och en svensk flagga 2,0 × 1,25 m
      // (16:10): blå duk med gult kors, korset 5:2:9 på längden och 4:2:4 på höjden, förskjutet mot stången.
      // Duken är ett rutnät 32 × 20 där korsets kanter ligger på rutlinjerna (skarpa kanter, varje ruta sin färg).
      // Lokala +x = med vinden (placeras vriden efter vinden). W = −(a + 2·(rad + 1)): a = andel av längden från stången,
      // raden ger höjden; skuggaren gör vågorna och normalerna (se vegPatch, "flagga").
      ror(D, [[0, -0.05, 0, 0.055], [0, 3.5, 0, 0.045], [0, 7.6, 0, 0.03], [0, 7.7, 0, 0.03]], 8, UG, 1, () => [0.93, 0.93, 0.91]);
      ror(D, [[0, 7.68, 0, 0.022], [0, 7.71, 0, 0.05], [0, 7.75, 0, 0.068], [0, 7.8, 0, 0.06], [0, 7.84, 0, 0.035], [0, 7.86, 0, 0.004]], 8, UG, 1, () => [0.88, 0.66, 0.2]);   // förgylld knopp
      ror(D, [[0, -0.1, 0, 0.11], [0, 0.04, 0, 0.11], [0, 0.06, 0, 0.075]], 8, UG, 1, () => [0.5, 0.49, 0.47]);   // betongfot
      // lina: upp på stångens läsida, ner längs andra sidan i en lätt båge (fallet), till en knap på 1,3 m
      ror(D, [[0.045, 1.3, 0, 0.006], [0.05, 4, 0.01, 0.006], [0.045, 7.62, 0, 0.006]], 3, UG, 1, () => [0.9, 0.88, 0.82]);
      ror(D, [[-0.04, 1.3, 0.03, 0.006], [-0.09, 3.2, 0.06, 0.006], [-0.1, 5.4, 0.05, 0.006], [-0.04, 7.62, 0.02, 0.006]], 3, UG, 1, () => [0.9, 0.88, 0.82]);
      ror(D, [[0, 1.27, -0.09, 0.012], [0, 1.27, 0.09, 0.012]], 4, UG, 1, () => [0.3, 0.3, 0.3]);   // knapen
      const LV = 2.0, HV = 1.25, YV = 7.58, NU = 32, NR = 20, BLA = [0.0, 0.2, 0.47], GUL = [1.0, 0.84, 0.08];   // svensk blå #006AA7 och gul #FECC02 (avstämt mot miljöns ljus)
      // hakar på linan vid dukens över- och underkant
      for (const yy of [YV, YV - HV]) ror(D, [[0.01, yy, 0, 0.012], [0.05, yy, 0, 0.012]], 4, UG, 1, () => [0.55, 0.55, 0.56]);
      for (let j = 0; j < NR; j++) for (let i = 0; i < NU; i++) {
        const uc = (i + 0.5) / NU, vc = (j + 0.5) / NR, kors = (uc > 5 / 16 && uc < 7 / 16) || (vc > 4 / 10 && vc < 6 / 10), f = kors ? GUL : BLA, k = D.P.length / 3;
        for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const a = (i + di) / NU, rad = j + dj; hp(D, 0.04 + a * LV, YV - rad / NR * HV, 0, 0, 0, 1, 0.7, 0.5, f, -(a + 2 * (rad + 1))); }
        D.I.push(k, k + 2, k + 1, k, k + 3, k + 2, k, k + 1, k + 2, k, k + 2, k + 3);
      }
    } else if (namn === 'kur') {     // busskur, öppen mot gatan (lokala +z)
      L3([0, 2.45, 0], [1.7, 0.05, 0.75], [0.12, 0.13, 0.14]); L3([0, 1.35, -0.7], [1.65, 1.05, 0.015], [0.18, 0.24, 0.27]);
      for (const x of [-1.65, 1.65]) { L3([x, 1.35, -0.3], [0.015, 1.05, 0.4], [0.18, 0.24, 0.27]); L3([x, 1.22, 0.65], [0.04, 1.22, 0.04], [0.12, 0.13, 0.14]); }
      L3([0, 0.45, -0.45], [1.2, 0.03, 0.2], [0.35, 0.22, 0.12]);
    } else if (namn === 'hallplats') { L3([0, 1.3, 0], [0.035, 1.3, 0.035], [0.5, 0.5, 0.5]); L3([0, 2.45, 0], [0.28, 0.22, 0.015], [0.8, 0.62, 0.05]); L3([0, 2.45, 0.017], [0.18, 0.13, 0.002], [0.85, 0.85, 0.82]); }
    else if (namn === 'skylt') { L3([0, 1.15, 0], [0.035, 1.15, 0.035], [0.5, 0.5, 0.5]); L3([0, 2.15, 0], [0.42, 0.2, 0.012], [0.86, 0.86, 0.84]); L3([0, 2.15, 0.013], [0.38, 0.16, 0.002], [0.02, 0.1, 0.35]); }
    else if (namn === 'entre') ror(D, [[0, 0, 0, 0.07], [0, 0.2, 0, 0.07]], 6, UG, 1, () => [0.95, 0.94, 0.9], 1);
    return D;
  })());
  // impostorträd som hör till nära setet (grannträdgårdarna), med fjärrsetets atlas och ett eget material (återanvänds)
  function impNara(lista, arter, A) {
    if (!lista.length || !A) return null;
    if (!A.naraMat) A.naraMat = impMaterial(A);
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
    g.setAttribute('aKol', new THREE.InstancedBufferAttribute(new Float32Array(lista.map(e => Math.max(0, arter.indexOf(e.art)))), 1));
    const m = instanser('impostortrad-nara', g, A.naraMat.m, lista, true, false);
    m.customDepthMaterial = A.naraMat.dj; m.userData.egen = true; m.frustumCulled = false;
    return m;
  }
  // ---- 3D-grästuvor och prästkragar (images/3d/gras-tuvor.glb, gjord med team-villa/gras-glb.mjs) ----
  // Laddas en gång; varje miljö får en tom grupp som fylls med tre instansade nät när filen finns.
  // Vertexfärg (rot mörk → topp ljus), vajar lätt i vinden i vertexskuggaren. Inga egna skuggor.
  const TUVOR = { geo: null, vant: [], laddar: false };
  function tuvGeo(cb) {
    if (TUVOR.geo) { cb(TUVOR.geo); return; }
    TUVOR.vant.push(cb);
    if (TUVOR.laddar) return;
    TUVOR.laddar = true;
    new GLTFLoader().load('images/3d/gras-tuvor.glb', g => {
      const ut = {}; g.scene.traverse(o => { if (o.isMesh) ut[o.name] = spara(o.geometry); });
      TUVOR.geo = ut; TUVOR.vant.splice(0).forEach(f => f(ut));
    }, undefined, e => console.warn('gras-tuvor', e));
  }
  const tuvMat = () => egenMat('tuva', () => {
    const a = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    a.onBeforeCompile = s => {
      Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uSol: VU.uSol, uNatt: VU.uNatt });
      s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = clamp( position.y / 0.21, 0.0, 1.0 ); h *= h;
          vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
          float fas = bas.x * 0.31 + bas.z * 0.23;
          float by = 0.55 + 0.45 * sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 );
          transformed.xz += ( uVind * ( 0.05 * by + 0.02 * sin( uTid * 1.6 + fas * 3.0 + position.x * 9.0 ) ) + 0.012 * vec2( sin( uTid * 2.3 + position.z * 11.0 + fas ), cos( uTid * 1.9 + position.x * 13.0 ) ) ) * h;
        }`);
      s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform vec3 uSol;\nuniform float uNatt;\n' + s.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * 0.6 );');
    };
    a.customProgramCacheKey = () => 'miljo-tuva';
    return a;
  });
  // poster: [{ x, y, z, s, ry, typ }] (typ 0/1 grästuva, 2 prästkrage)
  function tuvGrupp(poster) {
    const g = new THREE.Group(); g.name = 'grastuvor';
    if (!poster.length) return g;
    tuvGeo(G => {
      ['tuvaA', 'tuvaD', 'prastkrage'].forEach((k, t) => {
        const L = poster.filter(p => p.typ === t), geo = G[k];
        if (!L.length || !geo) return;
        const m = instanser('tuvor-' + k, geo, tuvMat(), L.map(p => ({ m: matris(p.x, p.y, p.z, p.s, p.s * (p.sy || 1), p.s, p.ry) })), false, true);
        if (m) { m.userData.egen = false; m.frustumCulled = false; g.add(m); }
      });
    });
    return g;
  }
  // tuvor runt huset: tätast närmast (2–9 m från väggen), glesare utåt till ~16 m; prästkragar i kanterna
  // fri(x, z): marken är ledig (inte plattor, uppfart, altan eller bil)
  function tuvPoster(mal, r, hy, fri, n, nBlom, kanter = [], vikt = null, skala = 1) {
    const { L, W } = mal, ut = [], kant = (x, z) => Math.hypot(Math.max(Math.abs(x) - L / 2, 0), Math.max(Math.abs(z) - W / 2, 0)), gb = grundBredd(mal);
    for (let f = 0; f < n * 12 && ut.length < n; f++) {
      const x = (r() - 0.5) * (L + 32), z = (r() - 0.5) * (W + 32), k = kant(x, z);
      if (k < gb + 0.9 || k > 16 || r() > (1.15 - k / 14) * (vikt ? vikt(x, z) : 1)) continue;
      if (!fri(x, z, 0.45)) continue;
      ut.push({ x, y: hy(x, z) - 0.015, z, s: (0.85 + r() * 0.5) * skala, sy: 0.9 + r() * 0.5, ry: r() * 6.283, typ: r() < 0.55 ? 0 : 1 });
    }
    // prästkragar: i gräsmattans kanter (mot rabatter, häckar och staket) och nära husgrunden
    const K = kanter.length ? kanter : [[-L / 2, -W / 2, 2.6], [L / 2, -W / 2, 2.6], [-L / 2, W / 2, 2.6], [L / 2, W / 2, 2.6]];
    for (let f = 0, b = 0; f < nBlom * 20 && b < nBlom; f++) {
      const [cx, cz, rr] = K[(r() * K.length) | 0], a = r() * 6.283, x = cx + Math.cos(a) * rr * (0.8 + r() * 0.4), z = cz + Math.sin(a) * rr * (0.8 + r() * 0.4);
      const k = kant(x, z);
      if (k < gb + 0.8 || k > 16 || !fri(x, z, 0.35)) continue;
      ut.push({ x, y: hy(x, z) - 0.01, z, s: 0.7 + r() * 0.35, ry: r() * 6.283, typ: 2 }); b++;
    }
    return ut;
  }
  // ---- fotoskannade småväxter (images/3d/bjork-vaxter.glb + images/tex/bjork-vaxter.webp, gjorda med team-villa/fbx-vaxter.mjs
  // och atlas-vaxter.py): ormbunkar, gräsbuske, vissnat gräs och nässlor. Alla utplacerade växter slås ihop till ett nät
  // (ett ritanrop), alfatest i stället för genomskinlighet, vajar lätt i vinden. Laddas en gång.
  const BJV = { geo: null, vant: [], laddar: false };
  function bjvGeo(cb) {
    if (BJV.geo) { cb(BJV.geo); return; }
    BJV.vant.push(cb);
    if (BJV.laddar) return;
    BJV.laddar = true;
    new GLTFLoader().load('images/3d/bjork-vaxter.glb', g => {
      const ut = {}; g.scene.traverse(o => { if (o.isMesh) ut[o.name] = o.geometry; });
      BJV.geo = ut; BJV.vant.splice(0).forEach(f => f(ut));
    }, undefined, e => console.warn('bjork-vaxter', e));
  }
  const bjvMat = () => egenMat('bjorkVaxter', () => {
    const t = spara(new THREE.TextureLoader().load('images/tex/bjork-vaxter.webp'));
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    const a = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.42, alphaToCoverage: MSAA, side: THREE.DoubleSide });
    a.onBeforeCompile = s => {
      Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uSol: VU.uSol, uNatt: VU.uNatt });
      s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\nattribute vec3 aBas;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = clamp( aBas.z, 0.0, 1.0 ); h *= h;
          float fas = aBas.x * 0.31 + aBas.y * 0.23;
          float by = 0.55 + 0.45 * sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 );
          transformed.xz += ( uVind * ( 0.06 * by + 0.025 * sin( uTid * 1.5 + fas * 3.0 + position.x * 5.0 ) ) + 0.015 * vec2( sin( uTid * 2.2 + position.z * 9.0 + fas ), cos( uTid * 1.8 + position.x * 11.0 ) ) ) * h;
        }`);
      s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform vec3 uSol;\nuniform float uNatt;\n' + s.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * 0.7 );');
    };
    a.customProgramCacheKey = () => 'miljo-bjorkvaxter';
    return a;
  });
  // poster: [{ namn, x, y, z, s, ry }] → en tom grupp som fylls med ett sammanslaget nät när filen finns
  function bjvGrupp(poster) {
    const g = new THREE.Group(); g.name = 'smavaxter';
    if (!poster.length) return g;
    bjvGeo(G => {
      const L = poster.filter(p => G[p.namn]);
      let nv = 0, ni = 0; L.forEach(p => { nv += G[p.namn].attributes.position.count; ni += G[p.namn].index.count; });
      if (!nv) return;
      const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), B = new Float32Array(nv * 3), I = new Uint32Array(ni);
      let ov = 0, oi = 0;
      L.forEach(p => {
        const geo = G[p.namn], pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ix = geo.index, c = Math.cos(p.ry), sn = Math.sin(p.ry);
        let hmax = 0.01; for (let i = 0; i < pa.count; i++) hmax = Math.max(hmax, pa.getY(i));
        for (let i = 0; i < pa.count; i++) {
          const lx = pa.getX(i), ly = pa.getY(i), lz = pa.getZ(i), k = ov + i;
          P[k * 3] = p.x + (c * lx + sn * lz) * p.s; P[k * 3 + 1] = p.y + ly * p.s; P[k * 3 + 2] = p.z + (-sn * lx + c * lz) * p.s;
          Nn[k * 3] = c * na.getX(i) + sn * na.getZ(i); Nn[k * 3 + 1] = na.getY(i); Nn[k * 3 + 2] = -sn * na.getX(i) + c * na.getZ(i);
          U[k * 2] = ua.getX(i); U[k * 2 + 1] = ua.getY(i);
          B[k * 3] = p.x; B[k * 3 + 1] = p.z; B[k * 3 + 2] = ly / hmax;
        }
        for (let j = 0; j < ix.count; j++) I[oi + j] = ix.getX(j) + ov;
        ov += pa.count; oi += ix.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('aBas', new THREE.BufferAttribute(B, 3));
      geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, bjvMat()); m.name = 'smavaxter'; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.egen = true;
      g.add(m);
    });
    return g;
  }
  // utplacering runt vårt hus: ormbunkar i skuggan på baksidan, gräsbuskar vid tomtens hörn, vissnat gräs och nässlor
  // längs bakre gränsen; aldrig i startvyns kil, på gångar, altan eller uppfart
  function bjvPoster(mal, hy, r, typ) {
    const { L, W, dorr } = mal, S = Math.max(L, W), ut = [], dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
    const iKil = (x, z) => [-34, -22, 0, 22, 34].some(g => { const a = g * Math.PI / 180, d = [dn[0] * Math.cos(a) + du[0] * Math.sin(a), dn[1] * Math.cos(a) + du[1] * Math.sin(a)], tt = x * d[0] + z * d[1]; return tt > 0 && Math.abs(-x * d[1] + z * d[0]) < S / 2 + 2 + tt * 0.08; });
    const kant = (x, z) => Math.hypot(Math.max(Math.abs(x) - L / 2, 0), Math.max(Math.abs(z) - W / 2, 0));
    const fri = (x, z, m) => !mal.blockerad(x, z, m) && !(mal.trappa && mal.trappa(x, z, m)) && !iKil(x, z) && kant(x, z) > 1.4 && ut.every(p => Math.hypot(p.x - x, p.z - z) > 1.1);
    const P2 = (f, s) => [dn[0] * f + du[0] * s, dn[1] * f + du[1] * s];
    const bak = -(Math.abs(dn[0]) > 0.5 ? L : W) / 2, sid = (Math.abs(dn[0]) > 0.5 ? W : L) / 2;
    const satt = (namn, f, s, sk, n = 1) => { for (let k = 0; k < 6 && n > 0; k++) { const [x, z] = P2(f + (r() - 0.5) * 1.6, s + (r() - 0.5) * 1.6); if (!fri(x, z, 0.5)) continue; ut.push({ namn, x, y: hy(x, z) - 0.02, z, s: sk * (0.85 + r() * 0.3), ry: r() * 6.283 }); n--; } };
    const sko = typ === 'skog';
    satt('ferns3', bak - 1.6, -sid + 0.8, 1.0); satt('ferns3', bak - 1.9, sid - 1.2, 0.9); satt('small_ferns1', bak - 1.3, sid - 2.6, 1.2, 2);
    satt('long_dead_grass1', bak - 7, 0.5 * sid, 0.9);
    if (sko) { satt('ferns3', bak - 3.5, 0, 1.1, 2); satt('small_ferns1', bak - 2.5, -sid - 1.5, 1.3, 2); }
    return ut;
  }
  // ---- trästaket (images/3d/trastaket.glb + trastaket-diff/-nor.webp, gjorda med team-villa/fbx-staket.mjs): ett fack
  // är 2 m (stolpen vid x = −0,15, spjälor längs +x), färgen per fack via instanceColor (vit, faluröd, grå, natur).
  // Alla fack i ett instansierat nät (ett ritanrop); laddas en gång.
  const STK = { geo: null, vant: [], laddar: false };
  function stkGeo(cb) {
    if (STK.geo) { cb(STK.geo); return; }
    STK.vant.push(cb);
    if (STK.laddar) return;
    STK.laddar = true;
    new GLTFLoader().load('images/3d/trastaket.glb', g => {
      let geo = null; g.scene.traverse(o => { if (o.isMesh) geo = o.geometry; });
      STK.geo = geo; STK.vant.splice(0).forEach(f => f(geo));
    }, undefined, e => console.warn('trastaket', e));
  }
  const stkMat = () => egenMat('trastaket', () => {
    const t = fotoTex('images/tex/trastaket-diff.webp', 1), nm = spara(new THREE.TextureLoader().load('images/tex/trastaket-nor.webp'));
    t.flipY = false; nm.flipY = false;
    const a = new THREE.MeshLambertMaterial({ map: t, normalMap: nm, side: THREE.DoubleSide });
    a.onBeforeCompile = s => {
      s.uniforms.miljoLjus = LJUS;
      s.fragmentShader = 'uniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
    };
    a.customProgramCacheKey = () => 'miljo-trastaket';
    return a;
  });
  const STAKFARGER = { vit: [1.45, 1.45, 1.4], falu: [0.62, 0.13, 0.08], gra: [0.5, 0.5, 0.47], natur: [0.85, 0.62, 0.4] };
  // ett fack mitt i (x, y, z) längs lokala x (vridning ry), längd l
  const stkFack = (lista, x, y, z, ry, l, farg) => {
    // modellen går från x = −0,2 (stolpens ytterkant) till 1,9 (sista spjälans kant): skalas så att facket täcker exakt l
    const c = Math.cos(ry), s = Math.sin(ry), sx = l / 2.1, ox = x - c * (l / 2 - 0.2 * sx), oz = z + s * (l / 2 - 0.2 * sx);
    lista.push({ m: matris(ox, y - 0.02, oz, sx, 1, 1, ry), c: new THREE.Color(...farg) });
  };
  function stkGrupp(lista) {
    const g = new THREE.Group(); g.name = 'trastaket';
    if (!lista.length) return g;
    stkGeo(geo => { const m = instanser('trastaket', geo, stkMat(), lista, true, true); if (m) { m.userData.egen = false; m.frustumCulled = false; g.add(m); } });
    return g;
  }
  // ---- vägdetaljer (images/3d/vagdetaljer.glb + vagdetaljer-diff/-nor.webp, gjorda med team-villa/fbx-vag.mjs och atlas-vag.py):
  // elstolpar i rad bakom huset med hängande ledningar (kedjekurva), och vägräcken längs uppfarten där marken faller
  // av eller vattnet är nära. Stolpar och räcken slås ihop till ett nät (ett ritanrop); ledningar och isolatorer i barkens nät.
  const VDT = { geo: null, vant: [], laddar: false };
  function vdtGeo(cb) {
    if (VDT.geo) { cb(VDT.geo); return; }
    VDT.vant.push(cb);
    if (VDT.laddar) return;
    VDT.laddar = true;
    new GLTFLoader().load('images/3d/vagdetaljer.glb', g => {
      const ut = {}; g.scene.traverse(o => { if (o.isMesh) ut[o.name] = o.geometry; });
      VDT.geo = ut; VDT.vant.splice(0).forEach(f => f(ut));
    }, undefined, e => console.warn('vagdetaljer', e));
  }
  const vdtMat = sno => egenMat('vagdetaljer' + (sno ? 'Sno' : ''), () => {
    const t = fotoTex('images/tex/vagdetaljer-diff.webp', 1), nm = spara(new THREE.TextureLoader().load('images/tex/vagdetaljer-nor.webp'));
    t.flipY = false; nm.flipY = false;
    const a = new THREE.MeshLambertMaterial({ map: t, normalMap: nm });
    a.onBeforeCompile = s => {
      s.uniforms.miljoLjus = LJUS;
      s.vertexShader = 'varying float vUpp;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUpp = normal.y;');
      s.fragmentShader = 'uniform vec3 miljoLjus;\nvarying float vUpp;\n' + s.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>' + (sno ? '\n diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.89, 0.95 ), smoothstep( 0.35, 0.7, vUpp ) * 0.9 );' : ''))
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
    };
    a.customProgramCacheKey = () => 'miljo-vagdetaljer' + (sno ? '-sno' : '');
    return a;
  });
  function vdtGrupp(poster, sno) {
    const g = new THREE.Group(); g.name = 'vagdetaljer';
    if (!poster.length) return g;
    vdtGeo(G => {
      const L = poster.filter(p => G[p.namn]);
      let nv = 0, ni = 0; L.forEach(p => { nv += G[p.namn].attributes.position.count; ni += G[p.namn].index.count; });
      if (!nv) return;
      const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
      let ov = 0, oi = 0;
      L.forEach(p => {
        const geo = G[p.namn], pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ix = geo.index, c = Math.cos(p.ry), sn = Math.sin(p.ry), sx = p.sx || 1;
        for (let i = 0; i < pa.count; i++) {
          const lx = pa.getX(i) * sx, ly = pa.getY(i), lz = pa.getZ(i), k = ov + i;
          P[k * 3] = p.x + c * lx + sn * lz; P[k * 3 + 2] = p.z - sn * lx + c * lz; P[k * 3 + 1] = (p.mark ? p.mark(P[k * 3], P[k * 3 + 2]) : p.y) + ly;   // räcken följer marken hörn för hörn
          Nn[k * 3] = c * na.getX(i) + sn * na.getZ(i); Nn[k * 3 + 1] = na.getY(i); Nn[k * 3 + 2] = -sn * na.getX(i) + c * na.getZ(i);
          U[k * 2] = ua.getX(i); U[k * 2 + 1] = ua.getY(i);
        }
        for (let j = 0; j < ix.count; j++) I[oi + j] = ix.getX(j) + ov;
        ov += pa.count; oi += ix.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, vdtMat(sno)); m.name = 'vagdetaljer'; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.egen = true;
      g.add(m);
    });
    return g;
  }
  // typ: 'skog' | 'vinter' | 'kust' | 'tradgard' | 'villa'; vatten(x, z): sant där det är vatten (vid sjön)
  function vagDetaljer(mal, V, hy, typ, vatten = null) {
    const { L, W, dorr } = mal, poster = [], D = del(), sno = typ === 'vinter', dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
    const djup = (Math.abs(dn[0]) > 0.5 ? L : W) / 2;
    // elstolpar: en rad tvärs bakom huset (40 m mellan stolparna), längre ut i villaområdet och trädgården
    const F = -(djup + (typ === 'villa' || typ === 'tradgard' ? 62 : 36)), ryP = Math.atan2(-du[1], du[0]), stolpar = [];
    for (let s = -120; s <= 120; s += 40) {
      const x = dn[0] * F + du[0] * s, z = dn[1] * F + du[1] * s;
      if (typ === 'kust' || Math.hypot(x, z) > 140 || (vatten && vatten(x, z)) || mal.blockerad(x, z, 2) || iVagJS(x, z, 6)) { stolpar.push(null); continue; }   // aldrig i uppfartens glänta; vid sjön inga elstolpar (ledningarna syntes som streck över himlen)
      const y = hy(x, z) - 0.25; poster.push({ namn: 'elstolpe', x, y, z, ry: ryP }); stolpar.push([x, y, z]);
    }
    // ledningar: tre faser mellan stolparna (fästen på tvärslån), kedjekurva med ~0,5 m nedhäng; enkla isolatorer
    const FAST = [[-1.75, 10.35], [1.75, 10.35], [0, 10.95]], LED = [0.03, 0.03, 0.032], ISO = [0.62, 0.6, 0.56];
    const at = (p, z0, y0) => [p[0] + du[0] * 0.05 + dn[0] * z0, p[1] + y0, p[2] + du[1] * 0.05 + dn[1] * z0];
    stolpar.forEach((p, i) => {
      if (!p) return;
      FAST.forEach(([z0, y0]) => { const a = at(p, z0, y0); ror(D, [[a[0], a[1] - 0.02, a[2], 0.045], [a[0], a[1] + 0.22, a[2], 0.04]], 6, UG, 1, () => ISO); });
      const q = stolpar[i + 1]; if (!q) return;
      FAST.forEach(([z0, y0]) => {
        const a = at(p, z0, y0 + 0.22), b = at(q, z0, y0 + 0.22), pts = [], len = Math.hypot(b[0] - a[0], b[2] - a[2]), sag = 0.012 * len;
        for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.08 * Math.sin(Math.PI * t) * 0, a[2] + (b[2] - a[2]) * t, 0.012]); }
        ror(D, pts, 4, UG, 1, () => LED);
      });
    });
    // vägräcken längs uppfarten där marken faller av mot sidan (eller vatten finns intill); i skogen och på vintern
    // alltid ett par vid uppfartens böj, på ytterkanten
    const P = bil.plats();
    if (P && P.vag && typ !== 'villa' && typ !== 'tradgard') {
      const v = P.vag, n = P.n, t = P.t, boj = sv => 1.6 * mjuk(4, 16, sv) * v.sida;
      const vp = (sv, o) => { const lat = boj(sv) + o; return [v.x0 + n[0] * sv + t[0] * lat, v.z0 + n[1] * sv + t[1] * lat]; };
      // ändstycke: räckets balk böjs ner i marken (1,4 m) i början och slutet av en rad räcken
      const GALV = [0.42, 0.43, 0.44];
      const slutstycke = (sv, sd, dir) => {
        const s0 = dir < 0 ? sv : sv, [xa, za] = vp(s0, sd * 2.2), [xb, zb] = vp(s0 + dir * 1.4, sd * 2.2), ya = hy(xa, za) + 0.62, yb = hy(xb, zb) + 0.05;
        const mx = (xa + xb) / 2, mz = (za + zb) / 2, my = (ya + yb) / 2, l = Math.hypot(xb - xa, zb - za, yb - ya), dx = (xb - xa) / l, dy = (yb - ya) / l, dz = (zb - za) / l;
        const sideN = norm(cross([dx, dy, dz], [0, 1, 0])), up = cross(sideN, [dx, dy, dz]);
        lada3(D, [mx, my, mz], [[dx, dy, dz], up, sideN], [l / 2, 0.15, 0.02], GALV);
      };
      for (const sd of [-1, 1]) {
        let ant = 0, slutSv = 0;
        for (let sv = 6; sv < 31; sv += 4.36) {
          const [x, z] = vp(sv + 2.18, sd * 2.15), [xu, zu] = vp(sv + 2.18, sd * 4.6), y = hy(x, z);
          const fall = y - hy(xu, zu) > 0.28 || (vatten && (vatten(xu, zu) || vatten(...vp(sv + 2.18, sd * 7))));
          if (!fall || (mal.blockerad(x, z, 0) && !P.iVag(x, z, 0.6))) { if (ant) { slutstycke(sv, sd, 1); ant = 0; } continue; }
          const [x1, z1] = vp(sv, sd * 2.15), [x2, z2] = vp(sv + 4.36, sd * 2.15), ry = Math.atan2(-(z2 - z1), x2 - x1);
          if (!ant) slutstycke(sv, sd, -1);
          // räcket följer marken: varje hörn får markens höjd där det står (stolparna går ner i marken)
          poster.push({ namn: ant % 3 === 2 ? 'vagracke2' : 'vagracke1', x, y: y - 0.42, z, ry, sx: Math.hypot(x2 - x1, z2 - z1) / 4.3, mark: (px, pz) => hy(px, pz) - 0.42 });
          ant++; slutSv = sv + 4.36;
        }
        if (ant) slutstycke(slutSv, sd, 1);
      }
    }
    for (let i = 0; i < D.S.length; i++) if (D.S[i] < 0.05) D.S[i] = 0.1;   // egen färg utan barktextur
    lagg(V.bark, D, 0, 0, 0, 1, 0, 8, 0);
    return vdtGrupp(poster, sno);
  }
  // ---- gammal trägrind med stolpar (images/3d/tragrind.glb + tragrind-diff/-nor.webp, gjorda med team-villa/fbx-grind.mjs):
  // vid infarten i skogen och vintern, stolparna vid gärdsgårdens hörn och öppningar. Allt slås ihop till ett nät (ett ritanrop);
  // på vintern ligger snö på överkanterna (ytor som vetter uppåt blir vita).
  const TGR = { geo: null, vant: [], laddar: false };
  // glesare stolpar (gärdsgården har ~100 st): hörn i samma 2 cm-ruta (och samma uv-ruta, så att sömmarna står kvar)
  // slås ihop; trianglar som blir platta tas bort. Ungefär 40 % färre trianglar, formen och texturen står kvar.
  function glesa(geo, cell) {
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ix = geo.index;
    const nyckel = new Map(), rep = [], till = new Int32Array(pa.count);
    for (let i = 0; i < pa.count; i++) {
      const k = [pa.getX(i), pa.getY(i), pa.getZ(i)].map(v => Math.round(v / cell)).concat([Math.round(ua.getX(i) / 0.04), Math.round(ua.getY(i) / 0.04)]).join();
      if (!nyckel.has(k)) { nyckel.set(k, rep.length); rep.push(i); }
      till[i] = nyckel.get(k);
    }
    const I = [];
    for (let q = 0; q < ix.count; q += 3) { const a = till[ix.getX(q)], b = till[ix.getX(q + 1)], c = till[ix.getX(q + 2)]; if (a !== b && b !== c && a !== c) I.push(a, b, c); }
    const P = new Float32Array(rep.length * 3), Nn = new Float32Array(rep.length * 3), U = new Float32Array(rep.length * 2);
    rep.forEach((i, j) => { P.set([pa.getX(i), pa.getY(i), pa.getZ(i)], j * 3); Nn.set([na.getX(i), na.getY(i), na.getZ(i)], j * 3); U.set([ua.getX(i), ua.getY(i)], j * 2); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setIndex(I);
    return g;
  }
  function tgrGeo(cb) {
    if (TGR.geo) { cb(TGR.geo); return; }
    TGR.vant.push(cb);
    if (TGR.laddar) return;
    TGR.laddar = true;
    new GLTFLoader().load('images/3d/tragrind.glb', g => {
      const ut = {}; g.scene.traverse(o => { if (o.isMesh) ut[o.name] = /^stolpe/.test(o.name) ? glesa(o.geometry, 0.02) : o.geometry; });
      TGR.geo = ut; TGR.vant.splice(0).forEach(f => f(ut));
    }, undefined, e => console.warn('tragrind', e));
  }
  // sno === 'sjo': vid sjön silvergrått vittrat trä, ljusare toppar, tydligare ådring och lite varmare i solen
  const tgrMat = sno => egenMat('tragrind' + (sno === 'sjo' ? 'Sjo' : sno ? 'Sno' : ''), () => {
    const t = fotoTex('images/tex/tragrind-diff.webp', 1), nm = spara(new THREE.TextureLoader().load('images/tex/tragrind-nor.webp'));
    t.repeat.set(1, 1); t.flipY = false; nm.flipY = false; nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
    const a = new THREE.MeshLambertMaterial({ map: t, normalMap: nm, normalScale: new THREE.Vector2(1, 1) });
    a.onBeforeCompile = s => {
      s.uniforms.miljoLjus = LJUS;
      s.vertexShader = 'varying float vUpp;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vUpp = normal.y;');
      s.fragmentShader = 'uniform vec3 miljoLjus;\nvarying float vUpp;\n' + s.fragmentShader
        // grått, väderbitet trä (texturen är olivbrun): mest gråskala, ljusare, en aning silvrig
        .replace('#include <map_fragment>', '#include <map_fragment>\n { float gl = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ); diffuseColor.rgb = mix( vec3( gl ), diffuseColor.rgb, 0.22 ) * vec3( 2.5, 2.5, 2.6 ); }' + (sno === 'sjo' ? '\n { float gl = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) / 2.5; float g2 = clamp( 0.34 + ( gl - 0.2 ) * 2.6, 0.12, 0.95 ); diffuseColor.rgb = mix( vec3( g2 ) * vec3( 1.02, 1.0, 0.97 ), vec3( g2 * 1.22 ), smoothstep( 0.3, 0.7, vUpp ) ); }' : sno ? '\n diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.92, 0.97 ), smoothstep( 0.22, 0.5, vUpp ) );' : ''))
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus' + (sno === 'sjo' ? ' * 1.9;\n\treflectedLight.directDiffuse *= vec3( 1.08, 1.02, 0.94 );' : ';'));
    };
    a.customProgramCacheKey = () => 'miljo-tragrind' + (sno === 'sjo' ? '-sjo' : sno ? '-sno' : '');
    return a;
  });
  // poster: [{ namn: 'grind' | 'stolpe1'…'stolpe4', x, y, z, ry, s }]
  // E (valfri): egen geometri i världskoordinater { P, N, U, I } (gärdsgårdens störar, slanor och vidjor) i samma nät
  function tgrGrupp(poster, sno, E) {
    const g = new THREE.Group(); g.name = 'tragrind';
    if (!poster.length && !(E && E.I.length)) return g;
    tgrGeo(G => {
      const L = poster.filter(p => G[p.namn]);
      let nv = 0, ni = 0; L.forEach(p => { nv += G[p.namn].attributes.position.count; ni += G[p.namn].index.count; });
      if (E) { nv += E.P.length / 3; ni += E.I.length; }
      if (!nv) return;
      const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
      let ov = 0, oi = 0;
      if (E) { P.set(E.P); Nn.set(E.N); U.set(E.U); I.set(E.I); ov = E.P.length / 3; oi = E.I.length; }
      L.forEach(p => {
        const geo = G[p.namn], pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ix = geo.index, c = Math.cos(p.ry), sn = Math.sin(p.ry), s = p.s || 1, sx = p.sx || 1;
        for (let i = 0; i < pa.count; i++) {
          const lx = pa.getX(i) * sx, ly = pa.getY(i), lz = pa.getZ(i), k = ov + i;
          if (p.m) {   // full matris (gärdsgårdens lutande stolpar): läge och normal
            const m = p.m.elements, nx = na.getX(i), ny = na.getY(i), nz = na.getZ(i);
            P[k * 3] = m[0] * lx + m[4] * ly + m[8] * lz + m[12]; P[k * 3 + 1] = m[1] * lx + m[5] * ly + m[9] * lz + m[13]; P[k * 3 + 2] = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
            const qx = m[0] * nx + m[4] * ny + m[8] * nz, qy = m[1] * nx + m[5] * ny + m[9] * nz, qz = m[2] * nx + m[6] * ny + m[10] * nz, ql = Math.hypot(qx, qy, qz) || 1;
            Nn[k * 3] = qx / ql; Nn[k * 3 + 1] = qy / ql; Nn[k * 3 + 2] = qz / ql;
          } else {
          P[k * 3] = p.x + (c * lx + sn * lz) * s; P[k * 3 + 1] = p.y + ly * s; P[k * 3 + 2] = p.z + (-sn * lx + c * lz) * s;
          Nn[k * 3] = c * na.getX(i) + sn * na.getZ(i); Nn[k * 3 + 1] = na.getY(i); Nn[k * 3 + 2] = -sn * na.getX(i) + c * na.getZ(i);
          }
          U[k * 2] = ua.getX(i); U[k * 2 + 1] = ua.getY(i);
        }
        for (let j = 0; j < ix.count; j++) I[oi + j] = ix.getX(j) + ov;
        ov += pa.count; oi += ix.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, tgrMat(sno)); m.name = 'tragrind'; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.egen = true;
      g.add(m);
    });
    return g;
  }
  // ligusterhäck för vår tomt i trädgården (modul 1 m längs lokala x, 1,3 m hög): bara lövkort i lager, ingen låda.
  // Yttre kort på sidorna och ovanpå (rundad överkant), ett mörkare inre lager som täpper till glipor mellan dem.
  const THACK = [];
  function tomtHack(v) {
    if (THACK[v]) return THACK[v];
    const r = slump(911 + v * 13), Lv = del(), H = 1.3, D = 0.66;
    const nf = p => norm([p[0] * 0.25, (p[1] - H * 0.5) / H * 1.5, p[2] / D * 2.4]);
    const prof = y => 1 - 0.38 * Math.pow(Math.max(0, (y / H - 0.62) / 0.38), 2);   // sidorna rundas av mot toppen
    for (let i = 0; i < 40; i++) {
      const sida = i & 1 ? 1 : -1, x = (r() - 0.5) * 1.15;
      let y, z, ut, f;
      if (i < 10) { y = H * (0.15 + r() * 0.7); z = sida * D * (0.1 + r() * 0.12); ut = [(r() - 0.5) * 0.8, (r() - 0.5) * 0.5, sida]; f = 0.3 + r() * 0.1; }
      else if (i < 32) { y = H * (0.05 + r() * 0.88); z = sida * D / 2 * prof(y) * (0.82 + r() * 0.22); ut = [(r() - 0.5) * 0.6, (r() - 0.45) * 0.7, sida]; f = (0.55 + 0.42 * y / H) * (0.85 + r() * 0.3); }
      else { y = H * (0.9 + r() * 0.1); z = (r() - 0.5) * D * 0.6; ut = [(r() - 0.5) * 0.6, 1, z * 1.5]; f = 0.88 + r() * 0.22; }
      kluster(Lv, r, [x, y, z], 0.44 + r() * 0.2, norm(ut), 0.25, 1, [f, f, f], nf, 0, 0.008);
    }
    return (THACK[v] = Lv);
  }
  // ---- vår tomt i trädgården, skogen och vintern: rabatter vid husgrunden, buskar vid trappan, buxbom i krukor och en
  // tomtgräns (trädgård: vitt spjälstaket fram och häck på sidorna; skog: gärdsgård; vinter: låg stenmur). Allt läggs i
  // befintliga nät (barkens nät för trä och sten, lövnätet för häcken, markväxterna), så inga nya ritanrop.
  function tomtGrund(mal, V, N, r, hy, trad, typ) {
    const { L, W, dorr } = mal, gb = grundBredd(mal), S = Math.max(L, W), D = del(), DG = del(), sno = typ === 'vinter', skog = typ === 'skog';
    const upptagen = (x, z, m) => mal.blockerad(x, z, m) || (mal.trappa && mal.trappa(x, z, m)) || (mal.sidodorrar || []).some(d => Math.hypot(x - d.x, z - d.z) < 1.2 + m);
    const dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
    const iKil = (x, z, m = 1.2) => [-34, -22, 0, 22, 34].some(g => {
      const a = g * Math.PI / 180, d = [dn[0] * Math.cos(a) + du[0] * Math.sin(a), dn[1] * Math.cos(a) + du[1] * Math.sin(a)];
      const tt = x * d[0] + z * d[1]; return tt > 0 && Math.abs(-x * d[1] + z * d[0]) < S / 2 + m + tt * 0.08;
    });
    const planta = (t, x, z, s, tint) => lagg(V.mark, variant(t, r() * 3 | 0).lov, x, hy(x, z) - 0.02, z, s, r() * 6.283, 1, VK[t], tint);
    const BL = [[0.42, 0.28, 0.78], [0.95, 0.42, 0.6], [0.95, 0.95, 0.9]];
    const blommor = (x, z, t, h) => { const y0 = hy(x, z), f = BL[t]; for (let j = 0; j < 5; j++) { const a = r() * 6.283, rr = r() * 0.15, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = y0 + h * (0.75 + r() * 0.3), s = t === 0 ? 0.018 : 0.035, sh = t === 0 ? 0.06 : 0.03; vkvad(D, [px, py, pz], [s, 0, 0], [0, sh, 0], [0, 0.3, 1], f, 0.01); vkvad(D, [px, py, pz], [0, 0, s], [0, sh, 0], [1, 0.3, 0], f, 0.01); } };
    // rabatter längs husgrunden (utanför singeln, eller utanför gången där en gång löper längs fasaden)
    // (team-tomt: rabatterna – fyrkantiga mullrutor med klotbuskar – och buskkrukorna vid trappan är avstängda i alla
    // miljöer: gräset går fram till singelbädden längs grunden; entrén har blommande lerkrukor, husritare-bebott.js)
    if (false) [[0, 1, L], [0, -1, L], [1, 0, W], [-1, 0, W]].forEach(([nx, nz, vl]) => {
      const tx = -nz, tz = nx, cx = nx * L / 2, cz = nz * W / 2;
      let k = 0;
      for (let u = -vl / 2 + 0.3; u <= vl / 2 - 0.3; u += 0.48, k++) {
        let dd = null;
        for (let d0 = gb + 0.42; d0 < gb + 2.9; d0 += 0.2) { if (!upptagen(cx + nx * d0 + tx * u, cz + nz * d0 + tz * u, 0.34)) { dd = d0; break; } }
        if (dd === null) continue;
        const x = cx + nx * (dd + 0.1) + tx * u, z = cz + nz * (dd + 0.1) + tz * u, y = hy(x, z);
        vlada(D, x, y + 0.005, z, Math.atan2(-tz, tx), 0.25, 0.012, 0.45, skog ? [0.12, 0.09, 0.06] : [0.16, 0.11, 0.07], 0, true);   // barkmull
        if (k % 5 === 2) trad('buske', x, z, 0.55 + r() * 0.25, 0.35);
        else if (k % 5 === 4) planta(skog ? 'ormbunke' : 'gras', x, z, skog ? 0.5 : 0.7 + r() * 0.2, skog ? [0.7, 0.85, 0.55] : ton(r, [0.86, 0.84, 0.5], 0.08));
        else { planta('blomma', x, z, 0.44 + r() * 0.18, [1, 1, 1]); if (!skog) blommor(x, z, k % 3, 0.4); }
      }
    });
    // buskar vid trappan och buxbom i krukor
    if (false) for (const sx of [-1, 1]) {
      let e = 0.6;
      for (let l = 0.4; l < 3; l += 0.1) { if (!(mal.trappa && mal.trappa(dorr.x + du[0] * l + dn[0] * 0.8, dorr.z + du[1] * l + dn[1] * 0.8, 0))) { e = l; break; } }
      const x = dorr.x + du[0] * sx * (e + 0.95) + dn[0] * 0.85, z = dorr.z + du[1] * sx * (e + 0.95) + dn[1] * 0.85, y = hy(x, z);
      if (mal.trappa && mal.trappa(x, z, 0.2)) continue;
      ror(D, [[x, y, z, 0.2], [x, y + 0.48, z, 0.26], [x, y + 0.5, z, 0.27]], 10, UG, 1, () => [0.06, 0.062, 0.065]);
      lagg(V.nara, variant('buske', 1).lov, x, y + 0.36, z, 0.52, sx, 1.1, 0.01, [0.5, 0.66, 0.42]);
    }
    // tomtgränsen i dörrens ram: fram 8,5 m från fasaden, bak 9 m, sidorna 6,5 m från gavlarna; luckor där gångar och uppfart går
    const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * L / 2, b * W / 2]);
    const fA = (x, z) => x * dn[0] + z * dn[1], sA = (x, z) => x * du[0] + z * du[1];
    // vid sjön (typ 'kust'): större tomt (fram 8 m, sidorna 11 m från gavlarna) och ingen baksida: sidorna går mot sjön
    // och slutar där ängen möter stranden (kustNara spärrar stranden, eldstaden och stigarna i mal.blockerad)
    const KU = typ === 'kust';
    const f1 = Math.max(...hor.map(h => fA(...h))) + (KU ? 8 : 8.5), f0 = Math.min(...hor.map(h => fA(...h))) - (KU ? 40 : 9);
    const s0 = Math.min(...hor.map(h => sA(...h))) - (KU ? 11 : 6.5), s1 = Math.max(...hor.map(h => sA(...h))) + (KU ? 11 : 6.5);
    const P2 = (f, s) => [dn[0] * f + du[0] * s, dn[1] * f + du[1] * s];
    // Tomtgränsen som en sluten slinga (fram s0 → s1, sidan, bak, andra sidan). Varje sida får sina sträckor mellan
    // öppningarna (där gångar, uppfart eller altan korsar gränsen); infarten är den största öppningen fram (minst minInf
    // bred), övriga öppningar fram är gångar. e längs sidan, n inåt mot tomten.
    const gransSidor = minInf => {
      const C0 = P2((f0 + f1) / 2, (s0 + s1) / 2), HRN = [[f1, s0], [f1, s1], [f0, s1], [f0, s0]].map(h => P2(...h));
      return HRN.map((A, i) => {
        const B = HRN[(i + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]), e = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
        let n = [-e[1], e[0]]; if ((C0[0] - A[0]) * n[0] + (C0[1] - A[1]) * n[1] < 0) n = [-n[0], -n[1]];
        const pt = t => [A[0] + e[0] * t, A[1] + e[1] * t];
        let opp = []; { let a = null; for (let t = 0; t <= len + 1e-6; t += 0.2) { const b = upptagen(...pt(t), 0.35); if (b && a === null) a = t; if ((!b || t + 0.2 > len) && a !== null) { opp.push([a - 0.3, t + 0.3]); a = null; } } }
        if (i === 0 && opp.length) {
          const k = opp.reduce((m, o, j) => (o[1] - o[0] > opp[m][1] - opp[m][0] ? j : m), 0), o = opp[k];
          if (o[1] - o[0] > 2) { const mid = (o[0] + o[1]) / 2, hw = Math.max((o[1] - o[0]) / 2, minInf / 2); opp[k] = Object.assign([mid - hw, mid + hw], { inf: true }); }
        }
        opp = opp.map(o => Object.assign([o[0] < 0.6 ? 0 : o[0], o[1] > len - 0.6 ? len : o[1]], { inf: !!o.inf })).sort((p, q) => p[0] - q[0]);
        // öppningar som går in i varandra slås ihop
        const ihop = [];
        for (const o of opp) { const l = ihop[ihop.length - 1]; if (l && o[0] <= l[1] + 0.5) { l[1] = Math.max(l[1], o[1]); l.inf = l.inf || o.inf; } else ihop.push(o); }
        const io = ihop.find(o => o.inf), inf = io ? [io[0], io[1]] : null;
        const gang = i === 0 ? ihop.filter(o => !o.inf && o[0] > 0 && o[1] < len) : [];
        const strackor = []; let t0 = 0;
        for (const [a, b] of ihop.concat([[len, len]])) { if (a - t0 > 0.5) strackor.push([t0, a]); t0 = Math.max(t0, b); }
        return { A, e, n, len, pt, strackor, inf, gang };
      });
    };
    if (typ === 'tradgard') {
      // trädgården: vitt spjälstaket runt hela tomten (stolpar högst 2 m isär, hörnstolpar, två reglar och spjälor
      // utanpå), öppen infart mellan två grövre stolpar, en spjälgrind i gångens öppning och ligusterhäck innanför på
      // sidorna (utom i siktgatan framför entrén)
      const VIT = [0.88, 0.88, 0.85], STP = [];
      const box = (x, y, z, e, hx, hyy, hz, tunn, f = VIT) => vlada(DG, x, y, z, Math.atan2(-e[1], e[0]), hx, hyy, hz, f, 0, tunn);
      const stolpe = (p, e, grov) => {
        if (STP.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.25)) return;
        STP.push(p);
        const y = hy(p[0], p[1]), h = grov ? 0.56 : 0.5, w = grov ? 0.06 : 0.045;
        box(p[0], y + h - 0.05, p[1], e, w, h, w, false);
        box(p[0], y + 2 * h - 0.03, p[1], e, w + 0.014, 0.022, w + 0.014, false);   // lock
      };
      // spjälor längs [P, P + e·l] (utsidan), från t0 till t1 längs sträckan
      const spjalor = (P, e, n, t0, t1, hoj = 0.44) => {
        const ns = Math.max(1, Math.round((t1 - t0) / 0.14));
        for (let j = 0; j < ns; j++) {
          const t = t0 + (j + 0.5) * (t1 - t0) / ns, x = P[0] + e[0] * t - n[0] * 0.026, z = P[1] + e[1] * t - n[1] * 0.026;
          box(x, hy(x, z) + 0.04 + hoj, z, e, 0.034, hoj, 0.01, true);
        }
      };
      const fack = (P, e, n, l) => {
        const m = [P[0] + e[0] * l / 2, P[1] + e[1] * l / 2], ym = (hy(...P) + hy(P[0] + e[0] * l, P[1] + e[1] * l)) / 2;
        for (const yy of [0.27, 0.74]) box(m[0], ym + yy, m[1], e, l / 2, 0.035, 0.012, true);
        spjalor(P, e, n, 0.07, l - 0.07);
      };
      const SID = gransSidor(0);
      SID.forEach(S => S.strackor.forEach(([a, b]) => {
        const nb = Math.max(1, Math.ceil((b - a) / 2)), l = (b - a) / nb;
        for (let i = 0; i <= nb; i++) stolpe(S.pt(a + i * l), S.e, (i === 0 && a > 0) || (i === nb && b < S.len));
        for (let i = 0; i < nb; i++) fack(S.pt(a + i * l), S.e, S.n, l);
      }));
      // spjälgrind i gångens öppning (stängd, i linje med staketet): ram av två ståndare och två reglar
      SID[0].gang.forEach(([a, b]) => {
        const S = SID[0], P = S.pt(a), l = b - a, ym = (hy(...P) + hy(...S.pt(b))) / 2;
        for (const t of [0.1, l - 0.1]) { const p = S.pt(a + t); box(p[0] - S.n[0] * 0.026, ym + 0.48, p[1] - S.n[1] * 0.026, S.e, 0.035, 0.44, 0.018, false); }
        for (const yy of [0.22, 0.76]) { const p = S.pt(a + l / 2); box(p[0], ym + yy, p[1], S.e, l / 2 - 0.12, 0.035, 0.014, true); }
        spjalor(P, S.e, S.n, 0.17, l - 0.17, 0.42);
      });
      // häcken: tät ligusterhäck utan låda (lövkort i lager, mörkare inåt, rundad överkant), 0,8 m innanför staketet
      for (const S of [SID[1], SID[3]]) {
        const ry = Math.atan2(-S.e[1], S.e[0]);
        for (let t = 0.9, k = 0; t < S.len - 0.9; t += 0.85, k++) {
          const [x0, z0] = S.pt(t), x = x0 + S.n[0] * 0.8, z = z0 + S.n[1] * 0.8;
          if (upptagen(x, z, 0.5) || iKil(x, z) || Math.hypot(Math.max(Math.abs(x) - L / 2, 0), Math.max(Math.abs(z) - W / 2, 0)) < 3) continue;
          lagg(V.nara, tomtHack(k % 4), x, hy(x, z) - 0.02, z, 1, ry + (r() - 0.5) * 0.06, 1.3, 0.004, ton(r, [0.74, 0.9, 0.56], 0.05));
        }
      }
    } else {
      // skog och vinter: gärdsgård runt hela tomten. Stolppar (två störar som lutar lite och möts uppåt, ihopbundna med
      // vidjor i två höjder) och slanor i 35° som vilar i banden: slanorna är en parallell skara som klipps vid
      // stolpparen i varje ände, så att gärdsgården går obruten runt hörnen. I infarten står den gamla trägrinden
      // (images/3d/tragrind.glb) mellan två grindstolpar, uppslagen inåt över gräset. Allt i grindens nät och material
      // (ett ritanrop, grått väderbitet trä; på vintern snö på det som vetter uppåt).
      const E = { P: [], N: [], U: [], I: [] }, TG = [], PAR = [];
      // rör längs [[x, y, z, radie], …]; uv = [u0, u1, v0, v1] i grindens texturatlas; lock = platt topp (snö på vintern)
      const tub = (pts, sid, uv, lock) => {
        const bas = E.P.length / 3; let b1 = null, len = 0, tot = 0;
        for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
        let t = null;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
          t = norm([q[0] - o[0], q[1] - o[1], q[2] - o[2]]);
          if (!b1) b1 = perp(t); else { const d = dot(b1, t); b1 = norm([b1[0] - t[0] * d, b1[1] - t[1] * d, b1[2] - t[2] * d]); }
          const b2 = cross(t, b1);
          if (i) len += Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
          for (let j = 0; j <= sid; j++) {
            const a = j / sid * 6.283, ca = Math.cos(a), sa = Math.sin(a), n = [b1[0] * ca + b2[0] * sa, b1[1] * ca + b2[1] * sa, b1[2] * ca + b2[2] * sa];
            E.P.push(p[0] + n[0] * p[3], p[1] + n[1] * p[3], p[2] + n[2] * p[3]); E.N.push(n[0], n[1], n[2]);
            E.U.push(uv[0] + (uv[1] - uv[0]) * j / sid, uv[2] + (uv[3] - uv[2]) * len / tot);
          }
        }
        for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < sid; j++) { const a = bas + i * (sid + 1) + j, b = a + 1, c = a + sid + 1, d = c + 1; E.I.push(a, b, c, b, d, c); }
        if (lock) {
          const p = pts[pts.length - 1], c0 = E.P.length / 3, r0 = c0 - sid - 1;
          E.P.push(p[0], p[1], p[2]); E.N.push(t[0], t[1], t[2]); E.U.push((uv[0] + uv[1]) / 2, uv[3]);
          for (let j = 0; j < sid; j++) {
            E.P.push(E.P[(r0 + j) * 3], E.P[(r0 + j) * 3 + 1], E.P[(r0 + j) * 3 + 2]); E.N.push(t[0], t[1], t[2]); E.U.push(uv[0] + (uv[1] - uv[0]) * j / sid, uv[3] - 0.03);
          }
          for (let j = 0; j < sid; j++) E.I.push(c0, c0 + 1 + j, c0 + 1 + (j + 1) % sid);
        }
      };
      const H0 = 1.2, M = Math.tan(32 * Math.PI / 180), SP = H0 / M;   // slanornas högsta höjd och lutning
      // stolppar i (x, z): e längs gärdsgården, n tvärs; i hörnen slås två par ihop till ett längs bisektrisen
      const nyttPar = (x, z, e, n) => {
        const f = PAR.find(p => Math.hypot(p.x - x, p.z - z) < 0.3);
        if (!f) { PAR.push({ x, z, e, n }); return; }
        const n2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
        f.e = n2([f.e[0] + e[0], f.e[1] + e[1]]); f.n = n2([f.n[0] + n[0], f.n[1] + n[1]]);
      };
      // stolpparen: två av de skannade stolparna (tragrind.glb) per par, slumpvis valda och vridna, lutande lite
      // bakåt längs gärdsgården; vidjorna i två höjder runt båda. [namn, höjd, halv bredd (x), halv tjocklek (z)]
      const SKAN = [['stolpe1', 1.16, 0.05, 0.03], ['stolpe2', 1.13, 0.11, 0.05], ['stolpe3', 1.08, 0.08, 0.04], ['stolpe4', 1.06, 0.09, 0.05]];
      const ritaPar = ({ x, z, e, n }) => {
        const y = hy(x, z), lut = 0.1 + r() * 0.06, ryE = Math.atan2(-e[1], e[0]);
        let lat = 0, bre = 0;
        for (const sd of [-1, 1]) {
          const [namn, h, xh, zh] = SKAN[(r() * 4) | 0], sk = (1.4 + r() * 0.14) / h, w = zh * sk + 0.075, vand = r() < 0.5;
          lat = Math.max(lat, w + zh * sk); bre = Math.max(bre, xh * sk);
          const px = x + n[0] * sd * w, pz = z + n[1] * sd * w;
          // vridning längs gärdsgården (ryE, ibland vänd), lutning bakåt (lut) och inåt mot den andra stören (ihop)
          const ryP = ryE + (vand ? Math.PI : 0) + (r() - 0.5) * 0.25, M4 = new THREE.Matrix4().makeRotationY(ryP);
          const ihop = -sd * Math.sign(Math.sin(ryP) * n[0] + Math.cos(ryP) * n[1]) * Math.atan(0.05 / 1.2);   // toppen mot den andra stören
          M4.multiply(new THREE.Matrix4().makeRotationX(ihop)).multiply(new THREE.Matrix4().makeRotationZ(vand ? -lut : lut));
          M4.premultiply(new THREE.Matrix4().makeTranslation(px, y - 0.12, pz)); M4.multiply(new THREE.Matrix4().makeScale(sk, sk, sk));
          TG.push({ namn, m: M4 });
          if (sno) {   // snöhätta på stolptoppen: en låg kupol (normaler uppåt, blir vit i skuggaren)
            const t = new THREE.Vector3(0, h, 0).applyMatrix4(M4), c0 = E.P.length / 3, rx = xh * sk * 0.9, rz = zh * sk * 1.1;
            E.P.push(t.x, t.y + 0.035, t.z); E.N.push(0, 1, 0); E.U.push(0.3, 0.6);
            for (let j = 0; j < 7; j++) { const v = j / 7 * 6.283, cx = Math.cos(v) * rx, cz = Math.sin(v) * rz; E.P.push(t.x + e[0] * cx + n[0] * cz, t.y - 0.005, t.z + e[1] * cx + n[1] * cz); E.N.push(Math.cos(v) * 0.5, 0.86, Math.sin(v) * 0.5); E.U.push(0.3, 0.6); }
            for (let j = 0; j < 7; j++) { const a2 = c0 + 1 + j, b2 = c0 + 1 + (j + 1) % 7; E.I.push(c0, a2, b2, c0, b2, a2); }
          }
        }
        for (const h of [0.46, 0.97]) {
          const c = [x - e[0] * lut * h, y + h, z - e[1] * lut * h], pts = [];
          for (let i = 0; i <= 8; i++) { const a = i / 8 * 6.283; pts.push([c[0] + e[0] * Math.cos(a) * (bre + 0.02) + n[0] * Math.sin(a) * (lat + 0.015), c[1] + Math.sin(a) * 0.025, c[2] + e[1] * Math.cos(a) * (bre + 0.02) + n[1] * Math.sin(a) * (lat + 0.015), 0.012]); }
          tub(pts, 3, [0.8, 0.86, 0.62, 0.92]);
        }
      };
      // slanor längs en sträcka från A (längd len): en parallell skara y = M·(x − x0), klippt till [0, len] och [0, H0]
      // slanor längs en sträcka från A (längd len): en parallell skara y = M·(x − x0). Nedre änden på marken (eller i
      // första stolpparets band där sträckan börjar), övre änden alltid strax förbi ett stolppar: det sista paret slanan
      // når under H0. Ingen slana slutar i luften mitt i ett fack.
      const slanor = (A, e, n, len) => {
        const nb = Math.max(1, Math.round(len / 1.15)), bay = len / nb, p = 0.27;
        for (let i = 0; i <= nb; i++) nyttPar(A[0] + e[0] * bay * i, A[1] + e[1] * bay * i, e, n);
        for (let k = 0; ; k++) {
          const x0 = -SP + (k + 0.5) * p; if (x0 >= len - 0.3) break;
          const xs = Math.max(0, x0), iSist = Math.min(nb, Math.floor((x0 + SP) / bay + 1e-6));
          if (iSist * bay < xs + 0.2) continue;   // når inget par: ritas inte
          const xe = Math.min(len, iSist * bay + 0.16);
          const sd = (k % 2 ? 1 : -1) * 0.01;
          const P = (x, ut) => { const px = A[0] + e[0] * x + n[0] * sd, pz = A[1] + e[1] * x + n[1] * sd; return [px, hy(px, pz) + M * (x - x0) + (x0 > 0 && x === xs ? -0.03 : 0.0), pz, ut]; };
          const u = 0.06 + r() * 0.4, v = 0.38 + r() * 0.08, rs = 0.03 + r() * 0.008;
          tub([P(xs, rs), P(xe, rs * 0.82)], 6, [u, u + 0.22, v, v + Math.min(0.5, (xe - xs) * 0.3)]);
        }
      };
      const SID = gransSidor(4.8), S0 = SID[0];
      // en kort bit mellan två öppningar (infart och gång) blir ingen egen gärdsgård: där står bara grindstolparna
      SID.forEach(S => S.strackor.forEach(([a, b]) => { if (b - a >= 1.4 || a === 0 || b === S.len) slanor(S.pt(a), S.e, S.n, b - a); }));
      const grind = S0.inf ? { a: S0.pt(S0.inf[0] + 0.19), b: S0.pt(S0.inf[1] - 0.19), e: S0.e, n: S0.n } : null;
      PAR.forEach(ritaPar);
      // grindstolparna (GLB) och en vidja som binder var och en till gärdsgårdens ändpar
      const grindStolpar = (a, b, e, n) => {
        const ryE = Math.atan2(-e[1], e[0]);
        for (const [p, sd] of [[a, -1], [b, 1]]) {
          TG.push({ namn: 'stolpe2', x: p[0], y: hy(p[0], p[1]) - 0.08, z: p[1], ry: ryE, s: 1.22 });
          // vidjan bara där gärdsgården har ett ändpar bredvid (inte mellan två tätt liggande öppningar)
          if (!PAR.some(q => Math.hypot(q.x - p[0] - e[0] * sd * 0.19, q.z - p[1] - e[1] * sd * 0.19) < 0.3)) continue;
          const c = [p[0] + e[0] * sd * 0.095, hy(p[0], p[1]) + 0.9, p[1] + e[1] * sd * 0.095], pts = [];
          for (let i = 0; i <= 8; i++) { const v = i / 8 * 6.283; pts.push([c[0] + e[0] * Math.cos(v) * 0.19 + n[0] * Math.sin(v) * 0.2, c[1] + Math.sin(v) * 0.03, c[2] + e[1] * Math.cos(v) * 0.19 + n[1] * Math.sin(v) * 0.2, 0.013]); }
          tub(pts, 3, [0.8, 0.86, 0.62, 0.92]);
        }
      };
      if (grind) {
        const { a, b, e, n } = grind;
        grindStolpar(a, b, e, n);
        // grinden hänger i ena stolpen och står uppslagen utåt (85–135°, helst rakt ut längs uppfarten) över gräset utanför tomten (innanför står
        // gårdens saker), helst på sidan bort från entrén; fri från uppfarten och pollarna
        const sDorr = sA(dorr.x, dorr.z), kand = [];
        for (const sida of [0, 1]) for (const g of [95, 105, 85, 115, 125, 135]) kand.push([sida, g]);
        const avst = sida => Math.abs(sA(...(sida ? b : a)) - sDorr);
        kand.sort((p, q) => avst(q[0]) - avst(p[0]));
        const GB = 4.14, gs = Math.min(1, (Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.24) / GB);
        for (const [sida, g] of kand) {
          const H = sida ? b : a, ee = sida ? [-e[0], -e[1]] : e, v = g * Math.PI / 180, d = [ee[0] * Math.cos(v) - n[0] * Math.sin(v), ee[1] * Math.cos(v) - n[1] * Math.sin(v)];
          let fri = true;
          for (let u = 0.3; u <= GB * gs + 0.2; u += 0.35) { const x = H[0] + d[0] * (u + 0.12), z = H[1] + d[1] * (u + 0.12); if (upptagen(x, z, 0.3) || (mal.pollare || []).some(q => Math.hypot(q[0] - x, q[1] - z) < 0.4)) { fri = false; break; } }
          if (!fri) continue;
          const cx = H[0] + d[0] * (0.12 + GB * gs / 2), cz = H[1] + d[1] * (0.12 + GB * gs / 2);
          TG.push({ namn: 'grind', x: cx, y: hy(cx, cz) + 0.03, z: cz, ry: Math.atan2(-d[1], d[0]), s: gs });
          break;
        }
      }
      // gångens öppning: samma grind i smalare format (bara bredden skalas) mellan två grindstolpar, halvöppen inåt
      // bredvid gången, gångjärnet på den sida där bladets fria ände hamnar på gräset
      S0.gang.forEach(([ga, gb]) => {
        const e = S0.e, n = S0.n, a = S0.pt(ga + 0.19), b = S0.pt(gb - 0.19);
        grindStolpar(a, b, e, n);
        const w = Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.2, v = 68 * Math.PI / 180;
        let bast = null, bp = 1e9;
        for (const sida of [0, 1]) {
          const H = sida ? b : a, ee = sida ? [-e[0], -e[1]] : e, d = [ee[0] * Math.cos(v) + n[0] * Math.sin(v), ee[1] * Math.cos(v) + n[1] * Math.sin(v)];
          let p = 0; for (let u = 0.2; u <= w + 1e-6; u += 0.2) if (upptagen(H[0] + d[0] * (u + 0.1), H[1] + d[1] * (u + 0.1), 0.05)) p += u;
          if (p < bp) { bp = p; bast = { H, d }; }
        }
        const { H, d } = bast, cx = H[0] + d[0] * (0.1 + w / 2), cz = H[1] + d[1] * (0.1 + w / 2);
        TG.push({ namn: 'grind', x: cx, y: hy(cx, cz) + 0.03, z: cz, ry: Math.atan2(-d[1], d[0]), s: 1, sx: w / 4.14 });
      });
      N.extra.push(tgrGrupp(TG, KU ? 'sjo' : sno, E));
    }
    for (let i = 0; i < D.S.length; i++) if (D.S[i] < 0.05) D.S[i] = 0.1;   // egen färg utan barktextur (som lampornas stolpar)
    lagg(V.bark, D, 0, 0, 0, 1, 0, 8, 0);
    // tomtgränsen i småsakernas nät (utan barkens uttoning i siktlinjen: det låga staketet rastrerades bort framför kameran)
    if (DG.I.length) { const Sm = samling(); lagg(Sm, DG, 0, 0, 0, 1, 0, 8, 0); const m = vegMesh('ting', Sm, egenMat('ting', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), { glod: true })), true, true); if (m) N.extra.push(m); }
  }
  // ---- villaområdet: tomternas detaljer ----
  // Allt läggs i befintliga sammanslagna nät: småsaker (världskoordinater) i 'ting', häckarnas löv i lövnätet,
  // plattor, trall, jord, grus och brunnar som ytor i gatans nät (egna mönster i gatans skuggare).
  // låda i världen: mitt (x, y, z), vriden ry runt y (lokala x/z som lagg), halva mått, färg, glöd (aSno)
  // undersidan syns aldrig och ritas inte; tunn = bara ovansida, fram- och baksida (spjälor, reglar, häckkärnor)
  const vlada = (D, x, y, z, ry, hx, hy, hz, f, s = 0, tunn = false) => {
    const c = Math.cos(ry), sn = Math.sin(ry), n0 = D.S.length, i0 = D.I.length;
    lada3(D, [x, y, z], [[c, 0, -sn], [0, 1, 0], [sn, 0, c]], [hx, hy, hz], f);
    if (s) for (let i = n0; i < D.S.length; i++) D.S[i] = s;
    // sidornas ordning i lada3: −x, +x, −y, +y, −z, +z (6 index var)
    const beh = D.I.slice(i0).filter((_, k) => { const sd = (k / 6) | 0; return sd !== 2 && (!tunn || sd >= 3); });
    D.I.length = i0; for (const v of beh) D.I.push(v);
  };
  const vladaYttre = (...a) => vlada(...a);   // (villaNaraG skuggar vlada med en variant som också registrerar hinder)
  // fyrhörning runt p med halvvektorerna a och b, framsidan mot n; w = fladder per hörn (eller ett tal)
  const vkvad = (D, p, a, b, n, f, w = 0) => {
    const k = D.P.length / 3, ws = Array.isArray(w) ? w : [w, w, w, w];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j], q) => hp(D, p[0] + a[0] * i + b[0] * j, p[1] + a[1] * i + b[1] * j, p[2] + a[2] * i + b[2] * j, n[0], n[1], n[2], 0.83, 0.5, f, ws[q]));
    if (dot(cross(a, b), n) >= 0) D.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else D.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
  };
  // husnummer: siffror i sju segment på en mörk skylt (bara siffror, ingen annan text)
  const SEG7 = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
  function husnummer(D, nr, p, ax, n, k = 1) {
    const s = String(nr), Wd = 0.075 * k, H = 0.07 * k, T = 0.011 * k, steg = 0.12 * k;
    vkvad(D, p, ax.map(v => v * (s.length * steg / 2 + 0.05 * k)), [0, 0.12 * k, 0], n, [0.04, 0.05, 0.08]);
    const seg = { a: [0, H, Wd / 2, T], g: [0, 0, Wd / 2, T], d: [0, -H, Wd / 2, T], f: [-Wd / 2, H / 2, T, H / 2], b: [Wd / 2, H / 2, T, H / 2], e: [-Wd / 2, -H / 2, T, H / 2], c: [Wd / 2, -H / 2, T, H / 2] };
    [...s].forEach((ch, i) => {
      const cx = (i - (s.length - 1) / 2) * steg;
      for (const k of SEG7[+ch]) {
        const [u, v, hu, hv] = seg[k];
        vkvad(D, [p[0] + ax[0] * (cx + u) + n[0] * 0.006, p[1] + v, p[2] + ax[2] * (cx + u) + n[2] * 0.006], ax.map(q => q * hu), [0, hv, 0], n, [0.95, 0.95, 0.92]);
      }
    });
  }
  // bil som sakta kör förbi längs gatan (lokala +z): rörelsen i skuggaren, inga skuggor, runda hjul
  // personbil (lokala +z framåt), förenklad efter vår riktiga bil: lägre motorhuv, sluttande vindruta och bakruta,
  // mörka rutor med tak i karossfärg, runda hjul med fälg, lyktor och backspeglar. Karossen i farg (eller ETT + tint).
  function bilForm(D, farg) {
    const L3 = (c, h, f) => lada3(D, c, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h, f), HJ = [0.025, 0.025, 0.028], GL = [0.03, 0.04, 0.05];
    const kv = (P, f) => { const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]], n = norm(cross(e1, e2)), k = D.P.length / 3; P.forEach(p => hp(D, p[0], p[1], p[2], n[0], n[1], n[2], 0.83, 0.5, f)); D.I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    // karossen: underdel, motorhuv (lägre fram) och bagagelucka
    L3([0, 0.55, -0.1], [0.88, 0.22, 2.12], farg);
    kv([[-0.86, 0.77, 2.0], [0.86, 0.77, 2.0], [0.86, 0.88, 0.95], [-0.86, 0.88, 0.95]], farg);   // huven sluttar framåt
    kv([[0.86, 0.77, 2.0], [-0.86, 0.77, 2.0], [-0.86, 0.6, 2.25], [0.86, 0.6, 2.25]], farg);    // nosen
    L3([0, 0.82, -1.75], [0.86, 0.06, 0.5], farg);
    // kupén: sluttande vindruta och bakruta, sidorutor (mörka), taket i karossfärg
    const b = [[-0.82, 0.88, 0.95], [0.82, 0.88, 0.95], [0.82, 0.88, -1.35], [-0.82, 0.88, -1.35]], t = [[-0.7, 1.36, 0.15], [0.7, 1.36, 0.15], [0.7, 1.36, -0.95], [-0.7, 1.36, -0.95]];
    kv([b[0], b[1], t[1], t[0]], GL); kv([b[2], b[3], t[3], t[2]], GL); kv([b[1], b[2], t[2], t[1]], GL); kv([b[3], b[0], t[0], t[3]], GL);
    kv([[-0.71, 1.37, 0.12], [0.71, 1.37, 0.12], [0.71, 1.37, -0.93], [-0.71, 1.37, -0.93]], farg);
    for (const sx of [-1, 1]) {
      kv(sx > 0 ? [[0.835, 0.9, 0.0], [0.835, 0.9, -0.08], [0.725, 1.35, -0.4], [0.725, 1.35, -0.32]] : [[-0.835, 0.9, -0.08], [-0.835, 0.9, 0.0], [-0.725, 1.35, -0.32], [-0.725, 1.35, -0.4]], farg);   // B-stolpe
      L3([sx * 0.95, 1.0, 0.85], [0.07, 0.04, 0.05], farg);                                             // backspegel
      L3([sx * 0.6, 0.7, 2.215], [0.16, 0.045, 0.012], [1.4, 1.36, 1.25]); L3([sx * 0.62, 0.78, -2.225], [0.17, 0.04, 0.012], [0.5, 0.02, 0.02]);
    }
    L3([0, 0.4, 2.235], [0.5, 0.06, 0.01], [0.03, 0.03, 0.035]);                                         // grill
    L3([0, 0.012, 0], [0.95, 0.004, 2.25], [0.015, 0.015, 0.015]);                                        // kontaktskugga
    for (const sx of [-0.86, 0.86]) for (const sz of [-1.4, 1.4]) {
      ror(D, [[sx - 0.11, 0.33, sz, 0.33], [sx + 0.11, 0.33, sz, 0.33]], 12, UG, 1, () => HJ);
      const sg = Math.sign(sx), cx = sx + sg * 0.112, c0 = hp(D, cx, 0.33, sz, sg, 0, 0, 0.83, 0.5, [0.35, 0.35, 0.36]);
      for (let j = 0; j < 12; j++) { const a = j / 12 * 6.283; hp(D, cx, 0.33 + Math.cos(a) * 0.3, sz + Math.sin(a) * 0.3, sg, 0, 0, 0.83, 0.5, j & 1 ? HJ : [0.3, 0.3, 0.31]); }
      for (let j = 0; j < 12; j++) { const a = c0 + 1 + j, b2 = c0 + 1 + (j + 1) % 12; if (sg > 0) D.I.push(c0, a, b2); else D.I.push(c0, b2, a); }
    }
    return D;
  }
  let BILFORM = null;
  const bilDel = () => BILFORM || (BILFORM = bilForm(del(), ETT));   // parkerade bilar (tint per bil i lagg)
  const villaNara = (mal, F) => korG(villaNaraG(mal, F));
  function* villaNaraG(mal, F) {   // stegvis (se byggG)
    const r = slump(505), { krav, kant } = regler(mal), hy = hojdVilla, FODL = [];   // FODL: grannarnas odlingsbäddar (Fab)
    // Poly Haven (CC0) nära startvyn: rekvisita och buskar (husritare-ph.js, ett instansierat nät per modell och del);
    // egen slump, så att resten av kvarteret står kvar. Mobil: kortare avstånd, färre saker.
    const PHV = [], PHP = ph.klar(), rP = slump(7171), PHR = SVAGMARK ? 0.6 : 1;
    // alla parkerade bilar längre bort: Tesla och Volvo i förenklad modell (bil.lodBilar, ett instansierat nät per modell);
    // egen slump för modell och färg, så att resten av kvarteret står kvar (vit, svart, grå, mörkblå, röd, silver)
    const LODB = [], rB = slump(9191), LACK = ['#e9e9e6', '#111214', '#6d7075', '#1b2a4a', '#8c1219', '#b4b8bd', '#e9e9e6', '#2a2c30'];
    // Hinder (världens xz, orienterade rektanglar { typ, x, z, ux, uz, hx, hz }; ux/uz = lokala x): häckar, staket,
    // grindar, stolpar, träd, buskar, hus och annat på marken. Bilarna (BILK) prövas mot dem allra sist och flyttas
    // inom sin uppfart eller tas bort, så att ingen bil står i en häck, ett staket eller ett träd. BILR: bilarnas
    // platser, som häckar, staket, buskar och markväxter (ledig) håller sig undan från redan när de läggs ut.
    const HIND = [], BILK = [], BILR = [], BIL_HX = 1.1, BIL_HZ = 2.42;
    const BILKOLL = (() => { try { return !/[?&]bilkoll=0/.test(location.search); } catch (e) { return true; } })();   // ?bilkoll=0: utan krockkoll (för jämförelser)
    const hinder = (typ, x, z, ry, hx, hz) => { HIND.push({ typ, x, z, ux: Math.cos(ry), uz: -Math.sin(ry), hx, hz }); };
    const bilRekt = (x, z, ry) => ({ x, z, ux: Math.cos(ry), uz: -Math.sin(ry), hx: BIL_HX, hz: BIL_HZ });
    const iBil = (x, z, m) => BILKOLL && BILR.some(b => { const dx = x - b.x, dz = z - b.z; return Math.abs(dx * b.ux + dz * b.uz) < b.hx + m && Math.abs(-dx * b.uz + dz * b.ux) < b.hz + m; });
    // parkBil (även från husritare-omgivning.js): platsen reserveras genast, bilen läggs ut först när allt annat finns
    const parkBil = (x, y, z, ry, _t, upp = null) => { BILK.push({ x, y, z, ry, upp, typ: rB() < 0.5 ? 'tesla' : 'volvo', farg: LACK[rB() * LACK.length | 0] }); BILR.push(bilRekt(x, z, ry)); };
    const { V, flack, trad: tradV, vaxt, matta } = verktyg(r, hy, mal.blockerad, false), N = narSet(V, flack);
    // träd och buskar blir hinder (stammen för träd: bilen får stå under kronan, inte i stammen)
    // Nära (buskar inom 70 m, lövträd inom 42 m): riktiga lövkvistar i klungor (husritare-natur.js, lovklungor) i stället
    // för de platta lövkorten: buskarna som en rundad klunga, träden med samma stam och grenar och en klunga vid varje grentopp.
    const KLUNG = [];
    const trad = (typ, x, z, h, fl, ry) => {
      const rr = typ === 'buske' ? Math.max(0.45, h * 0.5) : 0.45, d = Math.hypot(x, z);
      if (d < 160) HIND.push({ typ: typ === 'buske' ? 'buske' : 'trad-' + typ, x, z, ux: 1, uz: 0, hx: rr, hz: rr });
      if (typ === 'buske' && d < 70) {
        const y = hy(x, z), art = BUSKARTER[(r() * BUSKARTER.length) | 0], R = h * 0.55;
        KLUNG.push({ x, y: y + R * 0.78, z, r: R, sy: 0.82, mark: y, tint: ton(r, art, 0.08).map(v => v * 0.95), s: 0.26 + h * 0.06, vind: 0.025, n: Math.round(30 + R * R * 95) });
        if (h > 1.6) KLUNG.push({ x: x + (r() - 0.5) * R * 0.6, y: y + R * 1.25, z: z + (r() - 0.5) * R * 0.6, r: R * 0.62, sy: 0.9, mark: y, tint: ton(r, art, 0.08), s: 0.28 + h * 0.05, vind: 0.03, n: Math.round(24 + R * R * 48) });
        flack.push({ m: matris(x, y + 0.02, z, h * 0.55, 1, h * 0.55, 0) });
        return;
      }
      if ((typ === 'lov' || typ === 'frukt' || typ === 'mellan') && d < 38) {
        const v = variant(typ, r() * 3 | 0), s = h / v.H, y = hy(x, z), ryT = r() * 6.283, c = Math.cos(ryT), sn = Math.sin(ryT);
        lagg(V.bark, v.bark, x, y, z, s, ryT, v.H, VK[typ], BARKTON[typ]);
        const tint = ton(r, typ === 'frukt' ? [0.86, 0.95, 0.72] : [0.8, 0.92, 0.72], 0.06), R0 = (typ === 'frukt' ? 0.95 : 1.35) * s;
        v.spetsar.forEach((p, k) => {
          if (typ === 'mellan' ? false : k % 2) return;   // varannan topp räcker (klungorna överlappar)
          const wx = x + (c * p[0] + sn * p[2]) * s, wz = z + (-sn * p[0] + c * p[2]) * s, wy = y + p[1] * s;
          KLUNG.push({ x: wx, y: wy + R0 * 0.25, z: wz, r: R0 * (0.85 + ((k * 7) % 5) * 0.08), sy: 0.78, mark: y + 1.2, tint: tint.map(t => t * (0.92 + ((k * 13) % 7) * 0.025)), s: typ === 'frukt' ? 0.4 : 0.52, vind: 0.06 });
        });
        if (fl) flack.push({ m: matris(x, y + 0.02, z, fl, 1, fl, 0) });
        return;
      }
      return tradV(typ, x, z, h, fl, ry);
    };
    // lådor som står på marken (stolpar, staket, murar, växthus, kompost, lekstugor …) blir hinder för bilarna
    const vlada = (D, x, y, z, ry, hx, hyy, hz, ...rest) => {
      if (hyy > 0.12 && y - hyy < hy(x, z) + 0.35 && Math.hypot(x, z) < 160) HIND.push({ typ: 'lada', x, z, ux: Math.cos(ry), uz: -Math.sin(ry), hx, hz });
      return vladaYttre(D, x, y, z, ry, hx, hyy, hz, ...rest);
    };
    const lada3H = (D, c, A, h, f, uv) => {
      const l = Math.hypot(A[0][0], A[0][2]);
      if (h[1] > 0.12 && Math.abs(A[1][1]) > 0.9 && l > 0.5 && c[1] - h[1] < hy(c[0], c[2]) + 0.35 && Math.hypot(c[0], c[2]) < 160) HIND.push({ typ: 'lada', x: c[0], z: c[2], ux: A[0][0] / l, uz: A[0][2] / l, hx: h[0], hz: h[2] });
      return lada3(D, c, A, h, f, uv);
    };
    grasKant(mal, kant, vaxt, matta, r, [0.64, 0.7, 0.5], 0);   // inga korta strån: 3D-tuvorna tar över (vår tomt nedan)
    const P = bil.plats(), TS = samling();
    if (P && P.vag) {
      // kvarterets ram: sv ut från vår bilplats (mot gatan), lat längs gatan
      yield;
      const n = P.n, t = P.t, O = [P.vag.x0, P.vag.z0];
      yield;
      const pt = (sv, lat) => [O[0] + n[0] * sv + t[0] * lat, O[1] + n[1] * sv + t[1] * lat];
      yield;
      const svAv = (x, z) => (x - O[0]) * n[0] + (z - O[1]) * n[1], latAv = (x, z) => (x - O[0]) * t[0] + (z - O[1]) * t[1];
      yield;
      const vagLat = sv => 1.6 * mjuk(4, 16, sv) * P.vag.sida;
      yield;
      const ryMot = (dsv, dlat) => Math.atan2(n[0] * dsv + t[0] * dlat, n[1] * dsv + t[1] * dlat);   // lokala +z pekar åt (dsv, dlat)
      const TINGR = { studsmatta: 1.85, brevlada: 0.25, tunna: 0.4, flagga: 0.2, kur: 1.8, hallplats: 0.2, skylt: 0.2 };
      const ting1 = (namn, sv, lat, ry, tint = ETT, ford = 0) => { const [x, z] = pt(sv, lat); lagg(TS, ting(namn), x, hy(x, z), z, 1, ry, 8, namn === 'flagga' ? 0.002 : 0, tint, ford); if (TINGR[namn]) hinder(namn, x, z, 0, TINGR[namn], TINGR[namn]); };
      // gatunätet: huvudgatan framför tomten (vår uppfart ansluter), en tvärgata in i kvarteret och en gata bakom (korsning)
      yield;
      const HU = 14.25, LS = -32 * (P.vag.sida || 1), BAK = -44, sg = Math.sign(LS);
      yield;
      const vagar = [
        { dir: 'lat', c: HU, a0: -170, a1: 170, linje: true, zebra: [sg > 0 ? LS - GHW - GTR - 3.6 : LS + GHW + GTR + 0.6] },
        { dir: 'sv', c: LS, a0: -170, a1: HU, zebra: [HU - GHW - GTR - 4.2] },
        { dir: 'lat', c: BAK, a0: -170, a1: 170 },
      ];
      P.vagL = HU - GHW - GTR; P.gata = HU;   // gatans mitt (husritare-bil.js: vår bil kör ut i närmaste körfältet)
      mal.pollare = (mal.pollare || []).filter(([x, z]) => svAv(x, z) < P.vagL - 0.6);
      yield;
      const iGata = (sv, lat, m = 0) => vagar.some(v => { const q = v.dir === 'lat' ? sv - v.c : lat - v.c, s = v.dir === 'lat' ? lat : sv; return Math.abs(q) < GHW + GTR + m && s > v.a0 - m && s < v.a1 + m; });
      // vår tomt (staket, häckar, rabatter, gångar, träd) byggs i andra varvet nedan
      // gatlyktor längs gatorna (tänds från huset och utåt)
      // startvyns siktkil (kameran står 22° från entrén åt altanens sida, helskärmen rakt fram eller åt andra hållet):
      // höga saker där tonas bort med rutmönster i vegetationsskuggaren och blev prickiga, så de flyttas ut ur kilen
      yield;
      const iSiktkil = (() => {
        const d = mal.dorr; if (!d) return () => false;
        const dn = [d.nx, d.nz], du = [-d.nz, d.nx], Rh = Math.hypot(mal.L || 8, mal.W || 6) / 2;
        const ax = [-22, 0, 22].map(g => { const a = g * Math.PI / 180; return [dn[0] * Math.cos(a) + du[0] * Math.sin(a), dn[1] * Math.cos(a) + du[1] * Math.sin(a)]; });
        return (x, z, m = 0.8) => ax.some(([ux, uz]) => { const t = x * ux + z * uz, q = Math.abs(-x * uz + z * ux); return t > 0 && t < 75 && q < Rh + 1.5 + m + t * 0.1; });
      })();
      yield;
      const lykta = (sv0, lat0, dsv, dlat) => {
        let sv = sv0, lat = lat0;
        for (const k of [0, 6, -6, 12, -12, 18, -18, 24, -24]) {   // längs gatan bort ur siktkilen
          sv = sv0 + (dsv ? 0 : k); lat = lat0 + (dsv ? k : 0);
          if (!iSiktkil(...pt(sv, lat))) break;
          if (k === -24) return;
        }
        if (iGata(sv, lat, -GTR) || kant(...pt(sv, lat)) < 3) return;
        const [x, z] = pt(sv, lat), y = hy(x, z), ry = ryMot(dsv, dlat), ford = 0.12 + Math.hypot(x, z) * 0.004;
        if (PHP && Math.hypot(x, z) < 40 * PHR) {   // nära: Poly Havens stolplykta (4,6 m, ~12k trianglar), glaset lyser med lamporna
          PHV.push({ m: 'street_lamp_01', x, y, z, ry, s: 1.2 });
          N.glod.push([x, y + 4.0, z, 0.75, 0, ...VARMT, ford]);
          N.glod.push([x, y + 0.05, z, 9, 1, 0.42, 0.28, 0.14, ford]);
          return;
        }
        lagg(V.bark, lyktaDel(), x, y, z, 1, ry, 1, 0, ETT, ford);
        const hx = x + Math.sin(ry) * 0.92, hz = z + Math.cos(ry) * 0.92;
        N.glod.push([hx, y + 4.58, hz, 0.8, 0, ...VARMT, ford]);
        N.glod.push([hx, y + 0.05, hz, 9, 1, 0.42, 0.28, 0.14, ford]);
      };
      [-75, -45, -15, 15, 45, 75].forEach(l => lykta(HU + GHW + GTR - 0.5, l, -1, 0));
      [-10, -40, -70].forEach(s => lykta(s, LS - sg * (GHW + GTR - 0.5), 0, sg));
      [-60, -20, 20, 60].forEach(l => lykta(BAK - GHW - GTR + 0.5, l, 1, 0));
      // grannhusen: tomter längs gatorna, husen vända mot sin gata; nära = detaljerade, längre bort enkla volymer
      yield;
      const BD = { P: [], N: [], U: [], D: [], F1: [], F2: [], F3: [], H: [], I: [] }, lod = [], upp = [], uppfarter = [];
      yield;
      const tomter = [], husR = [], tomtD = [], tomma = [], RUT = [], PARK = [];   // PARK: grannarnas parkerade bilar   // RUT: grannhusens glasrutor (instansierat glas)   // tomma: tomtplatser utan hus (siktgator, avstånd) – fylls med buskage eller lekplats
      [[0, 26, 7], [1, 26, 9], [2, 26, 3]].forEach(([vi, steg, off]) => { const v = vagar[vi]; for (const sd of [1, -1]) for (let s = v.a0 + off; s <= v.a1; s += steg) tomter.push({ v, sd, s: s + (r() - 0.5) * 3 }); });
      yield;
      let nDet = 0;
      yield;
      for (const tm of tomter) {
        const ti = r() * 3 | 0, typ = GRANNTYP[ti], fi = r() * GRANNFARG.length | 0, spegel = r() < 0.5, bilP = r(), extra = r();
        const q = tm.sd * (GHW + GTR + 6 + typ.W / 2), [hsv, hlat] = tm.v.dir === 'lat' ? [tm.v.c + q, tm.s] : [tm.s, tm.v.c + q];
        const f = tm.v.dir === 'lat' ? [-tm.sd, 0] : [0, -tm.sd], ax = [f[1], -f[0]];          // framåt (mot gatan) och längs gatan i kvarterets ram
        const lok = (lx, lz) => [hsv + ax[0] * lx + f[0] * lz, hlat + ax[1] * lx + f[1] * lz];
        const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => lok(a * (typ.L / 2 + 0.8), b * (typ.W / 2 + 1.2)));
        if (hor.some(([a, b]) => iGata(a, b, 0.3))) continue;
        const [hx, hz] = pt(hsv, hlat);
        if (!hor.every(([a, b]) => { const [x, z] = pt(a, b); return krav(x, z, 'stor') && kant(x, z) > 9 && Math.hypot(x, z) < 150; })) { if (Math.hypot(hx, hz) > 30 && Math.hypot(hx, hz) < 95) tomma.push({ hsv, hlat, lok, f, ax }); continue; }
        if (upp.some(u => Math.hypot(u[0] - hx, u[1] - hz) < 14)) continue;
        if (Math.hypot(hx, hz) < 33) { tomma.push({ hsv, hlat, lok, f, ax }); continue; }   // grannhus tätt intill tomten skars av i bildkanten i startvyn
        const hr = { sv: hsv, lat: hlat, f, ax, L: typ.L, W: typ.W }; upp.push([hx, hz]); husR.push(hr);
        // husets höjd: lägsta hörnet (inget hus svävar där marken lutar längre ut)
        const ry = ryMot(f[0], f[1]), hy0 = Math.min(...hor.slice(0, 4).map(([a, b]) => hy(...pt(a, b)))), fg = GRANNFARG[fi], farg = [C(fg[0]).toArray(), C(fg[1]).toArray(), C(fg[2]).toArray(), fg[3]];
        if (Math.hypot(hx, hz) < 150 && nDet < 44) {   // alla hus som syns får takfot, vindskivor, hörnbrädor, sockel och riktiga fönster (enklare modul långt bort)   // alla hus i synhåll är detaljerade (dörr, farstu, sockel, stuprör); ~800 trianglar styck
          nDet++;
          const hh = r(), ut = grannBygg(BD, typ, hx, hy0, hz, ry, farg, r(), spegel, { sol: hh < 0.4, racke: true, altandorr: true, nara: Math.hypot(hx, hz) < 52, hjalte: Math.hypot(hx, hz) < 46,   /* (team-prestanda: detaljnivån till 52/46 m, förr 70/62) */ lang: Math.hypot(hx, hz) > 105, rutor: RUT });   // hjältenivå på alla grannhus i synhåll; längst bort (över 125 m, i diset) en enklare men 3D-modul   // hjältenivå: alla hus inom ~60 m (syns i startvyn)
          N.glod.push([ut.dorr[0], ut.dorr[1] + 0.12, ut.dorr[2], 0.3, 0, ...VARMT, 0.25 + r() * 0.3]);
          lagg(TS, ting('entre'), ut.dorr[0], ut.dorr[1], ut.dorr[2], 1, 0, 8, 0, ETT, 0.25);   // lampa vid entrén
          // uppfart vid husets ena gavel, ut till trottoaren; bil på en del av dem, brevlåda vid infarten
          const ux = (spegel ? -1 : 1) * (typ.L / 2 - 1.6), [a0, b0] = lok(ux, typ.W / 2 + 0.1), [a1, b1] = lok(ux, typ.W / 2 + 6.1);
          uppfarter.push([a0, b0, a1, b1, 3]);
          if (bilP < 0.5) { const [c0, c1] = lok(ux, typ.W / 2 + 2.9), BF = [[0.62, 0.62, 0.64], [0.02, 0.02, 0.025], [0.32, 0.03, 0.02], [0.03, 0.08, 0.2], [0.78, 0.78, 0.76], [0.2, 0.22, 0.2]]; { const [bx, bz] = pt(c0, c1), bry = ryMot(-f[0], -f[1]); PARK.push({ x: bx, z: bz, ry: bry, tint: BF[r() * BF.length | 0], d: Math.hypot(bx, bz), upp: [-0.78, 0.38] }); BILR.push(bilRekt(bx, bz, bry)); } }
          { const [m0, m1] = lok(ux + (spegel ? -1 : 1) * 2.1, typ.W / 2 + 5.8); ting1('brevlada', m0, m1, ryMot(f[0], f[1]) + Math.PI / 2); }
          { const [t0, t1] = lok((spegel ? 1 : -1) * (typ.L / 2 + 0.7), typ.W / 2 - 1.2), [tx0, tz0] = pt(t0, t1);
            if (PHP && Math.hypot(tx0, tz0) < 50 * PHR) PHV.push({ m: 'metal_trash_can', del: 'rust', x: tx0, y: hy(tx0, tz0), z: tz0, ry: ry + rP() * 0.6 });   // sopkärl i plåt (Poly Haven)
            else ting1('tunna', t0, t1, ry, [0.06, 0.16, 0.08]); }
          // staket, häckar, rabatter, gångar, altan och träd läggs i andra varvet (villaTomt), när alla hus är kända
          tomtD.push({ typ, lok, f, ax, ux, ry, ut, spegel, extra, hh, h: r(), h2: r(), d: Math.hypot(hx, hz), hsv, hlat, hr });
          // ibland studsmatta, lekstuga eller flaggstång
          // studsmatta, lekstuga eller flagga på andra sidan än altandörren (altanen läggs framför dörren)
          let kSida = spegel ? -1 : 1;
          if (ut.altan) { const dp = ut.tw(ut.altan.xb, 0, -typ.W / 2), [dsv, dlat] = [svAv(dp[0], dp[2]), latAv(dp[0], dp[2])]; kSida = ((dsv - hsv) * ax[0] + (dlat - hlat) * ax[1]) > 0 ? -1 : 1; }
          const [k0, k1] = lok(kSida * typ.L * 0.3, -typ.W / 2 - 3.2), [kx, kz] = pt(k0, k1);
          if (krav(kx, kz, 'lag') && kant(kx, kz) > 6 && !iGata(k0, k1, 1)) {
            if (extra > 0.8) ting1('studsmatta', k0, k1, 0); else if (extra > 0.65) { ting1('lekstuga', k0, k1, ry + Math.PI); husR.push({ sv: k0, lat: k1, f, ax, L: 2.6, W: 2.8 }); /* lekstugan står fri: träd, buskar och markväxter håller undan */ } else if (extra > 0.55) { r(); ting1('flagga', k0, k1, Math.atan2(-0.33, 0.94)); }
          }
        } else lod.push({ x: hx, z: hz, y: hy0, L: typ.L, W: typ.W, H: typ.he, ry, vagg: C(fg[0]), tak: C(fg[2]) });
      }
      // ---- andra varvet: tomterna runt grannhusen (staket, häckar, rabatter, gångar, altan, trädgård) och gatumiljön ----
      yield;
      const VD = del(), YT = [], STL = [], UTE = [];   // STL: trästaketets fack (instansierat nät); UTE: sittgrupperna (husritare-bebott.js)
      const BLP = [], BLD = [], BLS = [], BLK = BLOM.klar();   // riktiga blommor (husritare-blommor.js): plantor, bäddar, granitblock
      const VRAM = {};                       // vår tomts staket, grind och gång i kvarterets ram (för markväxterna)
      const planta = (typ, x, z, s, tint) => lagg(V.mark, variant(typ, r() * 3 | 0).lov, x, hy(x, z) - 0.02, z, s, r() * 6.283, 1, VK[typ], tint);   // som vaxt, men även intill gångarna
      // blomhuvuden i färg ovanpå en perenn: lavendel (lila ax), rosa eller vitt (två korsade små kort per blomma, fladdrar lätt)
      yield;
      const BLOMMOR = [[0.42, 0.28, 0.78], [0.95, 0.42, 0.6], [0.95, 0.95, 0.9], [0.98, 0.78, 0.2]];
      yield;
      const blommor = (x, z, typ, h) => {
        const y0 = hy(x, z), f = BLOMMOR[typ];
        for (let j = 0; j < 6; j++) {
          const a = r() * 6.283, rr = r() * 0.16, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = y0 + h * (0.75 + r() * 0.3), s = typ === 0 ? 0.018 : 0.035, sh = typ === 0 ? 0.06 : 0.03;
          vkvad(VD, [px, py, pz], [s, 0, 0], [0, sh, 0], [0, 0.3, 1], f, 0.01); vkvad(VD, [px, py, pz], [0, 0, s], [0, sh, 0], [1, 0.3, 0], f, 0.01);
        }
      };
      yield;
      const W3 = (a, b) => { const [x, z] = pt(a, b); return [x, hy(x, z), z]; };
      yield;
      // gångar, trall och uppfarter (kvarterets ram: [a0, b0, a1, b1, bredd]): häckar, buskar och träd håller sig utanför
      const YTR = [];
      const iRemsa = (a, b, [a0, b0, a1, b1, br], m) => { const dx = a1 - a0, dz = b1 - b0, l = Math.hypot(dx, dz) || 1, t = ((a - a0) * dx + (b - b0) * dz) / l, q = Math.abs((a - a0) * dz - (b - b0) * dx) / l; return t > -m && t < l + m && q < br / 2 + m; };
      const iYtaV = (x, z, m = 0) => { const a = svAv(x, z), b = latAv(x, z); return YTR.some(y => iRemsa(a, b, y, m)) || uppfarter.some(y => iRemsa(a, b, y, m)); };
      const ledig = (a, b, m = 0.5) => {
        if (iGata(a, b, 0.3)) return false;
        const [x, z] = pt(a, b);
        if (kant(x, z) < 7 || mal.blockerad(x, z, 1) || Math.hypot(x, z) > 150) return false;
        if (iBil(x, z, m + 0.35) || iYtaV(x, z, m * 0.5)) return false;   // parkerade bilar och gångar/uppfarter hålls fria
        return !husR.some(h => { const da = a - h.sv, db = b - h.lat, lx = da * h.ax[0] + db * h.ax[1], lz = da * h.f[0] + db * h.f[1]; return Math.abs(lx) < h.L / 2 + m && Math.abs(lz) < h.W / 2 + m; });
      };
      // yta i kvarterets ram från (a0, b0) till (a1, b1), bredd br, y över marken; mönster typ (1 plattor, 2 trall, 5 jord, 6 grus)
      yield;
      const yta = (a0, b0, a1, b1, br, y, f, typ) => {
        const dx = a1 - a0, dz = b1 - b0, l = Math.hypot(dx, dz) || 1, px = -dz / l * br / 2, pz = dx / l * br / 2;
        if (typ !== 5) YTR.push([a0, b0, a1, b1, br]);
        const H = [[a0 + px, b0 + pz, 0, br / 2], [a0 - px, b0 - pz, 0, -br / 2], [a1 - px, b1 - pz, l, -br / 2], [a1 + px, b1 + pz, l, br / 2]];
        YT.push({ P: H.map(([a, b]) => { const [x, yy, z] = W3(a, b); return [x, yy + y, z]; }), f, G: H.map(([, , u, v]) => [u, 60, v, typ]) });
      };
      // liten kvadrat runt (a, b): brunnslock (3), dagvattenbrunn och trädgaller (4); mönstrets u/v i meter från mitten
      yield;
      const punkt = (a, b, hu, hv, y, typ) => {
        const H = [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]];
        YT.push({ P: H.map(([u, v]) => { const [x, yy, z] = W3(a + v, b + u); return [x, yy + y, z]; }), f: [1.9, 1.88, 1.84], G: H.map(([u, v]) => [u, 60, v, typ]) });
      };
      yield;
      const VIT = [0.88, 0.88, 0.85], TUJA = [0.5, 0.64, 0.44], LIGUSTER = [0.74, 0.9, 0.56], JORD = [0.5, 0.4, 0.31];
      yield;
      const STAKFARG = [[0.4, 0.1, 0.07], [0.46, 0.38, 0.28], [0.27, 0.27, 0.25], [0.58, 0.5, 0.38]];
      yield;
      const BLOMFARG = [[1.05, 0.55, 0.62], [1.0, 0.95, 0.75], [0.78, 0.6, 1.0], [1.05, 0.42, 0.36], [1.0, 0.78, 0.4]];
      yield;
      // klippt häck längs en linje i tomtens ram (husritare-natur.js: tät kärna och två lövskal med skarp form).
      // Linjen delas i 0,45 m-moduler; de som är lediga (hus, gata, bilar, gångar, uppfarter) bildar sammanhängande
      // häckar med exakta ändar, så att inga löv växer ut över gångar, uppfarter eller in i bilar.
      const HSEG = [];
      const hack = (typH, lok, lx0, lz0, lx1, lz1) => {
        const len = Math.hypot(lx1 - lx0, lz1 - lz0), H = typH ? 1.25 : 1.8, Dj = typH ? 0.6 : 0.8, n = Math.max(1, Math.round(len / 0.45));
        const ok = [];
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, [a, b] = lok(lx0 + (lx1 - lx0) * t, lz0 + (lz1 - lz0) * t), [x, z] = pt(a, b);
          ok.push(ledig(a, b, 0.05) && !iYtaV(x, z, Dj / 2 + 0.08) && !iBil(x, z, Dj / 2 + 0.25));
        }
        const tint = ton(r, typH ? [0.84, 0.9, 0.74] : [0.6, 0.74, 0.62], 0.05);   // liguster friskt sommargrönt, tuja mörkare blågrön
        for (let k = 0; k < n;) {
          if (!ok[k]) { k++; continue; }
          let e = k; while (e + 1 < n && ok[e + 1]) e++;
          const t0 = k / n + (k ? 0.12 / len : 0), t1 = (e + 1) / n - (e < n - 1 ? 0.12 / len : 0);
          if ((t1 - t0) * len > 0.6) {
            const A = W3(...lok(lx0 + (lx1 - lx0) * t0, lz0 + (lz1 - lz0) * t0)), B = W3(...lok(lx0 + (lx1 - lx0) * t1, lz0 + (lz1 - lz0) * t1));
            const sk = 0.95 + 0.1 * r(), L = Math.hypot(B[0] - A[0], B[2] - A[2]), ryS = Math.atan2(-(B[2] - A[2]), B[0] - A[0]);
            HSEG.push({ x0: A[0], z0: A[2], x1: B[0], z1: B[2], H: H * sk, D: Dj, typ: typH, tint });
            hinder('hack', (A[0] + B[0]) / 2, (A[2] + B[2]) / 2, ryS, L / 2 + 0.05, Dj / 2 + 0.06);
            vlada(VD, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 0.012, (A[2] + B[2]) / 2, ryS, L / 2 + 0.06, 0.012, Dj * 0.5 + 0.1, [0.11, 0.075, 0.05], 0, true);   // barkmull längs foten
          }
          k = e + 1;
        }
      };
      // ett staketfack (1,8 m · k längs lokala x) mitt i (x, z): 0 vitt spjälstaket, 1 stående trästaket, 2 låg stenmur
      yield;
      const stakSeg = (typS, x, y, z, ry, fa, nara, k = 1) => {
        const c = Math.cos(ry), s = Math.sin(ry);
        const L3 = (u, yy, w, hx, hyy, hz, f, tunn = false) => vlada(VD, x + c * u * k + s * w, y + yy, z - s * u * k + c * w, ry, hx, hyy, hz, f, 0, tunn);
        if (typS === 0) {
          L3(-0.9, 0.55, 0, 0.045, 0.55, 0.045, VIT);
          if (!nara) { L3(0, 0.5, 0, 0.88 * k, 0.42, 0.012, [0.78, 0.78, 0.75]); return; }
          for (const yy of [0.3, 0.78]) L3(0, yy, -0.022, 0.88 * k, 0.03, 0.012, VIT, true);
          for (let j = 0; j < 7; j++) L3(-0.77 + j * 0.257, 0.5, 0.004, 0.036, 0.47, 0.01, VIT, true);   // (vår tomt och grannarna nära)
        } else if (typS === 1) {
          L3(-0.9, 0.66, 0, 0.05, 0.66, 0.05, fa.map(v => v * 0.8));
          L3(0, 0.66, 0, 0.88 * k, 0.6, 0.018, fa);
          L3(0, 1.28, 0, 0.92 * k, 0.025, 0.045, fa.map(v => v * 0.85));
          if (nara) for (let j = 0; j < 4; j++) L3(-0.66 + j * 0.44, 0.66, 0.022, 0.01, 0.58, 0.005, fa.map(v => v * 0.68), true);
        } else {
          const t = 0.86 + 0.14 * Math.sin(x * 3.1 + z * 1.7);
          L3(0, 0.26, 0, 0.9 * k, 0.26, 0.17, [0.34 * t, 0.33 * t, 0.31 * t]);
          L3(0, 0.54, 0, 0.93 * k, 0.025, 0.2, [0.52, 0.51, 0.48]);
        }
      };
      // ---- vår tomt (huset kunden ritar): finast i kvarteret. Allt räknas ut från husets mått, entrén, altanen och uppfarten.
      {
        const { L, W, dorr, dack } = mal, gb = grundBredd(mal), S = Math.max(L, W);
        const K = (x, z) => [svAv(x, z), latAv(x, z)];                       // världen → kvarterets ram
        const ytaW = (x0, z0, x1, z1, br, y, f, typ) => yta(...K(x0, z0), ...K(x1, z1), br, y, f, typ);
        const upptagen = (x, z, m) => mal.blockerad(x, z, m) || (mal.trappa && mal.trappa(x, z, m)) || (mal.sidodorrar || []).some(d => Math.hypot(x - d.x, z - d.z) < 1.2 + m);
        // startvyn och helskärmen tittar mot entrén (±22° åt altanens håll, lite bredare för helskärmen): inget högt i den kilen
        const dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
        const iKil = (x, z, m = 1.2) => {
          for (const g of [-34, -22, 0, 22, 34]) {
            const a = g * Math.PI / 180, d = [dn[0] * Math.cos(a) + du[0] * Math.sin(a), dn[1] * Math.cos(a) + du[1] * Math.sin(a)];
            const tt = x * d[0] + z * d[1], q = Math.abs(-x * d[1] + z * d[0]);
            if (tt > 0 && q < S / 2 + m + tt * 0.08) return true;
          }
          return false;
        };
        // tomtens gränser i kvarterets ram: mot gatan där det gamla staketet stod, bakåt och åt sidorna från husets hörn
        const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => K(a * L / 2, b * W / 2));
        // framkanten: staketet står högst 8,5 m framför fasaden (syns i startvyns nederkant, under siktlinjen mot huset)
        const svF = Math.min(P.vagL - 0.6, Math.max(...hor.map(h => h[0])) + 8.5), svB = Math.min(...hor.map(h => h[0])) - 9;
        const lat0 = Math.min(-2.5, ...hor.map(h => h[1])) - 6.5, lat1 = Math.max(2.5, ...hor.map(h => h[1])) + 6.5;
        VRAM.tomt = { svB, svF, lat0, lat1 };   // vår tomts gränser (grannetomten bakom, husritare-omgivning.js)
        const egenFri = (a, b, m, hog) => { const [x, z] = pt(a, b); return !upptagen(x, z, m) && kant(x, z) > 1.5 + m && !(hog && iKil(x, z)); };
        // gången från grinden: rakt ut från trappan om dörren vetter mot gatan, annars ut en bit och sedan mot gatan
        const dsv = dorr.nx * n[0] + dorr.nz * n[1];
        const [sS, lS] = K(dorr.x + dorr.nx * 1.6, dorr.z + dorr.nz * 1.6), [sS2, lS2] = K(dorr.x + dorr.nx * 2.6, dorr.z + dorr.nz * 2.6);
        const latG = dsv > 0.7 ? lS : lS2, svG0 = dsv > 0.7 ? sS : sS2;
        // ---- tomtgränsen: ett sammanhängande vitt trästaket runt hela tomten (raka, jämna fack, stolpar i hörnen och vid
        // varje öppning), öppning med stolpar vid uppfarten och en stängd grind vid gången. Luckor bara där en gång eller
        // uppfart faktiskt korsar gränsen; varje lucka får stolpar på båda sidor, så att inga fack slutar tvärt.
        const ryF = ryMot(1, 0), ryS = ryMot(0, 1);
        const stolpe = (a, b, h = 1.18) => { const [x, y, z] = W3(a, b); vlada(VD, x, y + h / 2, z, ryF, 0.065, h / 2, 0.065, VIT); vlada(VD, x, y + h + 0.02, z, ryF, 0.085, 0.022, 0.085, VIT); };
        // gräns från (a0, b0) till (a1, b1) i kvarterets ram; las = givna luckor [t0, t1] i meter längs linjen
        const grans = (a0, b0, a1, b1, las = [], skanna = true) => {
          const len = Math.hypot(a1 - a0, b1 - b0), at = t => [a0 + (a1 - a0) * t / len, b0 + (b1 - b0) * t / len], ry = Math.abs(a1 - a0) > Math.abs(b1 - b0) ? ryS : ryF;
          const luckor = las.slice();
          let st = null;
          if (skanna) for (let t = 0; t <= len + 1e-6; t += 0.25) { const [x, z] = pt(...at(t)), b = upptagen(x, z, 0.25); if (b && st === null) st = t; if ((!b || t + 0.25 > len) && st !== null) { luckor.push([st - 0.3, t + 0.3]); st = null; } }
          let iv = [[0, len]];
          luckor.forEach(([g0, g1]) => { iv = iv.flatMap(([p, q]) => q <= g0 || p >= g1 ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v - u > 0.4)); });
          iv.forEach(([p, q]) => {
            const nn = Math.max(1, Math.round((q - p) / 2)), sl = (q - p) / nn;
            for (let k = 0; k < nn; k++) { const [x, y, z] = W3(...at(p + sl * (k + 0.5))); stkFack(STL, x, y, z, ry, sl, STAKFARGER.vit); }
            stolpe(...at(p)); stolpe(...at(q));
          });
        };
        const vagG = vagLat(svF), harGrind = Math.abs(latG - vagG) > 3.2 && dsv > -0.3;
        grans(svF, lat0, svF, lat1, [[vagG - 2.3 - lat0, vagG + 2.3 - lat0], ...(harGrind ? [[latG - 0.62 - lat0, latG + 0.62 - lat0]] : [])], false);   // framsidan: bara uppfarten och grinden (inga extra glapp)
        grans(svF, lat0, svB, lat0); grans(svF, lat1, svB, lat1); grans(svB, lat0, svB, lat1);
        if (harGrind) {
          // stängd grind exakt mellan grindstolparna (grövre och högre än staketets, med knopp): gångjärn på ena sidan,
          // 2 cm glipa mot den andra; samma spjälor och höjd som staketet
          {
            const ex = [Math.cos(ryF), 0, -Math.sin(ryF)], b0 = latG - 0.62 + 0.09, b1 = latG + 0.62 - 0.09 - 0.02;
            const [x, y, z] = W3(svF, (b0 + b1) / 2), l = b1 - b0;
            stkFack(STL, x, y, z, ryF, l, STAKFARGER.vit);
            const kx = x - ex[0] * l / 2, kz = z - ex[2] * l / 2;   // gångjärnssidan (fackets början)
            for (const yy of [0.25, 0.78]) vlada(VD, kx - ex[0] * 0.03, y + yy, kz - ex[2] * 0.03, ryF, 0.06, 0.012, 0.035, [0.05, 0.05, 0.055]);
          }
          for (const sx of [-1, 1]) {
            const [x, y, z] = W3(svF, latG + sx * 0.62);
            vlada(VD, x, y + 0.67, z, ryF, 0.085, 0.67, 0.085, VIT); vlada(VD, x, y + 1.36, z, ryF, 0.105, 0.025, 0.105, VIT);
            ror(VD, [[x, y + 1.38, z, 0.045], [x, y + 1.43, z, 0.055], [x, y + 1.49, z, 0.035], [x, y + 1.51, z, 0.005]], 8, UG, 1, () => VIT);   // knopp
          }
          // plattgång från grinden till trappan (slutar där den befintliga gången börjar), kantsten och två pollare vid grinden
          // gången börjar vid trottoaren (P.vagL) och går under grinden fram till trappan
          const sT = Math.max(svF + 0.6, P.vagL + 0.05);
          let s1 = sT;
          for (let s = sT; s > svG0; s -= 0.25) { const [x, z] = pt(s, latG); if ((s < svF - 0.3 && mal.blockerad(x, z, 0.05)) || kant(x, z) < 1.2) break; s1 = s; }
          if (sT - s1 > 0.8) {
            yta(sT, latG, s1, latG, 1.2, 0.035, [2.25, 2.2, 2.1], 1);
            // gången går upp på trottoaren: en kort ramp (0,6 m) från gångens höjd till trottoarens (som uppfarten)
            { const H = [[sT - 0.6, -0.6, 0.035], [sT - 0.6, 0.6, 0.035], [sT + 0.02, 0.6, 0.142], [sT + 0.02, -0.6, 0.142]];
              YT.push({ P: H.map(([a2, b2, y2]) => { const [x, yy, z] = W3(a2, latG + b2); return [x, yy + y2, z]; }), f: [2.25, 2.2, 2.1], G: H.map(([a2, b2]) => [a2, 60, b2, 1]) }); }
            for (const sx of [-1, 1]) { const [x, y, z] = W3((sT + s1) / 2, latG + sx * 0.66); vlada(VD, x, y + 0.02, z, ryF, 0.05, 0.035, (sT - s1) / 2, [0.42, 0.42, 0.4]); }
            if (dsv <= 0.7) { const [x0, z0] = pt(s1, latG); ytaW(x0, z0, dorr.x + dorr.nx * 1.5, dorr.z + dorr.nz * 1.5, 1.2, 0.034, [2.25, 2.2, 2.1], 1); }
            VRAM.s1 = s1;
          }
          for (const sx of [-1, 1]) {
            const [x, y, z] = W3(svF - 0.45, latG + sx * 0.95), ford = 0.12;
            ror(VD, [[x, y - 0.05, z, 0.06], [x, y + 0.5, z, 0.06]], 6, UG, 1, () => [0.07, 0.072, 0.076]);
            ror(VD, [[x, y + 0.5, z, 0.062], [x, y + 0.62, z, 0.062]], 6, UG, 1, () => [0.95, 0.94, 0.9], 1 + ford);
            vlada(VD, x, y + 0.64, z, 0, 0.075, 0.02, 0.075, [0.1, 0.1, 0.105]);
            N.glod.push([x, y + 0.56, z, 0.18, 0, ...VARMT, ford]); N.glod.push([x, y + 0.03, z, 1.8, 1, 0.5, 0.33, 0.17, ford]);
          }
        }
        Object.assign(VRAM, { svF, svB, lat0, lat1, latG: harGrind ? latG : null, svG0, vagG });
        // ---- rabatter: längs staketets insida och längs gången från grinden. Stålkant mot gräsmattan, mörk barkmull,
        // tätt blandade perenner i höjdskikt (prydnadsgräs och rudbeckia bakerst, lavendel och kattmynta i mitten, låga
        // marktäckare i kanten), några klot-buxbom, inga raka rader; lågspänningslampor längs gången.
        const rabatt = (a0, b0, a1, b1, br, bak, gang = false, lampor = []) => {   // lampor: [x, z] som plantorna håller undan från   // bak: +1/−1 = vilken sida av linjen som är bakkant (staket/gång)
          const len = Math.hypot(a1 - a0, b1 - b0); if (len < 1) return;
          const ua = [(a1 - a0) / len, (b1 - b0) / len], ub = [-ua[1] * bak, ua[0] * bak];   // ub pekar från framkanten mot bakkanten
          if (BLK) {
            // riktiga blommor i en bädd med mjuk kant mot gräset: vid staketet låga fram mot gräsmattan, vid gången
            // lavendel närmast plattorna (rak kant mot kantstenen) och rosor bakom
            const A = pt(a0, b0), B2 = pt(a1, b1), F2 = pt(a0 - ub[0], b0 - ub[1]), lv = [F2[0] - A[0], F2[1] - A[1]], ll = Math.hypot(lv[0], lv[1]) || 1;
            const R = BLOM.rabattRand({ a: A, b: B2, br, lag: [lv[0] / ll, lv[1] / ll], rak: gang ? 1 : -1, stil: gang ? 'gang' : 'sol', r, hy, ledig: (x, z, m) => !upptagen(x, z, m) && !lampor.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 0.16 + m), stenar: 0 });
            BLP.push(...R.poster); BLD.push(R.badd); BLS.push(...R.stenar);
            return;
          }
          yta(a0, b0, a1, b1, br, 0.02, [0.3, 0.21, 0.14], 5);
          { const [x, y, z] = W3(a0 + (a1 - a0) / 2 - ub[0] * br / 2, b0 + (b1 - b0) / 2 - ub[1] * br / 2); vlada(VD, x, y + 0.025, z, Math.abs(ua[0]) > Math.abs(ua[1]) ? ryS : ryF, len / 2, 0.03, 0.006, [0.08, 0.075, 0.07], 0, true); }   // stålkant mot gräset
          const n = Math.round(len * br * 7);
          for (let i = 0; i < n; i++) {
            const t = r() * len, q = r(), a = a0 + ua[0] * t + ub[0] * (q - 0.5) * br * 0.9, b = b0 + ua[1] * t + ub[1] * (q - 0.5) * br * 0.9, [x, z] = pt(a, b);
            if (upptagen(x, z, 0.15)) continue;
            const v = r();
            if (q > 0.62) { if (v < 0.5) planta('gras', x, z, 0.75 + r() * 0.25, ton(r, [0.9, 0.86, 0.52], 0.08)); else { planta('blomma', x, z, 0.6 + r() * 0.15, [1, 1, 0.8]); blommor(x, z, 3, 0.6); } }
            else if (q > 0.25) { if (v < 0.55) { planta('blomma', x, z, 0.45 + r() * 0.12, [0.85, 0.8, 1]); blommor(x, z, 0, 0.45); } else { planta('blomma', x, z, 0.38 + r() * 0.1, [0.8, 0.85, 1]); blommor(x, z, 0, 0.34); } }
            else if (false && v < 0.12) lagg(V.nara, variant('buske', 1).lov, x, hy(x, z) - 0.05, z, 0.36, r() * 6.28, 1.1, 0.01, [0.5, 0.66, 0.42]);   // klot-buxbom
            else planta('blabar', x, z, 0.3 + r() * 0.1, [0.7, 0.85, 0.6]);   // låg marktäckare i kanten
          }
        };
        {
          let ivR = [[lat0 + 0.5, lat1 - 0.5]];
          [[vagG - 2.6, vagG + 2.6], ...(harGrind ? [[latG - 0.75, latG + 0.75]] : [])].forEach(([g0, g1]) => { ivR = ivR.flatMap(([p, q]) => q <= g0 || p >= g1 ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v - u > 1)); });
          ivR.forEach(([p, q]) => rabatt(svF - 0.75, p, svF - 0.75, q, 1.0, -1));
          if (harGrind && VRAM.s1 !== undefined) for (const sx of [-1, 1]) {
            // låga marklampor längs gången: i rabattens framkant precis innanför kantstenen, fritt runt om (plantorna
            // håller undan); svart stolpe, opalvit kupa som lyser på kvällen och en svart hatt som skärmar uppåt
            const LP = [];
            for (let s = svF - 1.4; s > VRAM.s1 + 0.6; s -= 1.6) LP.push(W3(s, latG + sx * (BLK ? 0.8 : 0.78)));
            rabatt(svF - 0.4, latG + sx * 1.1, VRAM.s1 + 0.3, latG + sx * 1.1, 0.75, -sx, true, LP.map(([x, , z]) => [x, z]));
            for (const [x, y, z] of LP) {
              const ford = 0.15;
              ror(VD, [[x, y - 0.03, z, 0.02], [x, y + 0.2, z, 0.02]], 6, UG, 1, () => [0.05, 0.05, 0.055]);
              ror(VD, [[x, y + 0.2, z, 0.04], [x, y + 0.205, z, 0.046], [x, y + 0.285, z, 0.046], [x, y + 0.29, z, 0.04]], 10, UG, 1, () => [1.0, 0.97, 0.9], 1 + ford);   // opalkupa
              ror(VD, [[x, y + 0.29, z, 0.062], [x, y + 0.302, z, 0.062], [x, y + 0.31, z, 0.03]], 10, UG, 1, () => [0.05, 0.05, 0.055]);   // hatt
              N.glod.push([x, y + 0.245, z, 0.1, 0, ...VARMT, ford]); N.glod.push([x, y + 0.02, z, 0.9, 1, 0.42, 0.28, 0.14, ford]);
            }
          }
        }
        // rabatter längs husgrunden: jord (barkmull) utanför singelbädden, perenner, prydnadsgräs, låga buskar och en rosenbuske nära entrén
        // (team-tomt: avstängt – klotbuskarna och jordremsan såg fejk ut; gräset går fram till singelbädden)
        const NV4 = [[0, 1, L], [0, -1, L], [1, 0, W], [-1, 0, W]];
        let ros = false;
        if (false) NV4.forEach(([nx, nz, vl]) => {
          const tx = -nz, tz = nx, cx = nx * L / 2, cz = nz * W / 2, run = [];
          let ut = gb + 0.42;
          const slut = () => {
            if (run.length >= 2) {
              const u0 = run[0] - 0.25, u1 = run[run.length - 1] + 0.25;
              ytaW(cx + nx * (ut + 0.1) + tx * u0, cz + nz * (ut + 0.1) + tz * u0, cx + nx * (ut + 0.1) + tx * u1, cz + nz * (ut + 0.1) + tz * u1, 0.9, 0.018, [0.42, 0.31, 0.22], 5);
              run.forEach((u, k) => {
                // bakre raden: perenn eller prydnadsgräs en bit in, främre raden lägre blommor
                { const x = cx + nx * (ut + 0.38) + tx * (u + 0.24), z = cz + nz * (ut + 0.38) + tz * (u + 0.24); planta('blomma', x, z, 0.3 + r() * 0.12, BLOMFARG[(k + 2) % 5]); }
                const x = cx + nx * (ut + (r() - 0.5) * 0.15) + tx * u, z = cz + nz * (ut + (r() - 0.5) * 0.15) + tz * u;
                if (!ros && Math.hypot(x - dorr.x, z - dorr.z) < 4.5) {
                  ros = true; trad('buske', x, z, 0.95, 0.5);
                  // (inga lösa blomkort i busken: blommor växer bara på marken)
                } else if (k % 5 === 2) trad('buske', x, z, 0.55 + r() * 0.25, 0.35);
                else if (k % 5 === 4) planta('gras', x, z, 0.7 + r() * 0.25, ton(r, [0.86, 0.84, 0.5], 0.08));
                else { planta('blomma', x, z, 0.46 + r() * 0.2, BLOMFARG[(k + (nx + 2) * 3 + nz) % 5 | 0]); blommor(x, z, (k + nx + 2) % 3, 0.42); }
              });
            }
            run.length = 0;
          };
          // rabatten ligger utanför singeln, eller utanför gången där en gång löper längs fasaden
          for (let u = -vl / 2 + 0.3; u <= vl / 2 - 0.3; u += 0.48) {
            let dd = null;
            for (let d0 = gb + 0.42; d0 < gb + 2.9; d0 += 0.2) { const x = cx + nx * d0 + tx * u, z = cz + nz * d0 + tz * u; if (!upptagen(x, z, 0.34)) { dd = d0; break; } }
            if (dd === null || Math.abs(dd - ut) > 0.05) { slut(); if (dd !== null) ut = dd; }
            if (dd !== null) run.push(u);
          }
          slut();
        });
        // buskar på båda sidor om trappan
        if (false) for (const sx of [-1, 1]) for (const lat of [1.55, 1.95, 2.4]) {
          const x = dorr.x + du[0] * sx * lat + dn[0] * (gb + 0.45), z = dorr.z + du[1] * sx * lat + dn[1] * (gb + 0.45);
          if (!upptagen(x, z, 0.28)) { trad('buske', x, z, 0.75, 0.45); break; }
        }
        // grusgång runt huset till altanen (utanför rabatterna), bara där marken är fri
        if (dack) {
          const d = gb + 1.25, X = L / 2 + d, Z = W / 2 + d, per = 2 * (2 * X + 2 * Z);
          const pAv = s => { s = ((s % per) + per) % per; if (s < 2 * X) return [-X + s, Z]; s -= 2 * X; if (s < 2 * Z) return [X, Z - s]; s -= 2 * Z; if (s < 2 * X) return [X - s, -Z]; s -= 2 * X; return [-X, -Z + s]; };
          const sAv = (x, z) => { let b = 0, bd = 1e9; for (let s = 0; s < per; s += 0.1) { const [px, pz] = pAv(s), dd = Math.hypot(px - x, pz - z); if (dd < bd) { bd = dd; b = s; } } return b; };
          const sd = sAv(dorr.x, dorr.z), sa = sAv((dack.x0 + dack.x1) / 2, (dack.z0 + dack.z1) / 2);
          let ds = sa - sd; if (ds > per / 2) ds -= per; if (ds < -per / 2) ds += per;
          let st = null;
          for (let k = 0; k <= Math.abs(ds) / 0.5; k++) {
            const s = sd + Math.sign(ds) * k * 0.5, [x, z] = pAv(s), ok = !mal.blockerad(x, z, 0.15) && !(mal.trappa && mal.trappa(x, z, 0.2));
            if (ok && st === null) st = s;
            if ((!ok || k >= Math.abs(ds) / 0.5 - 1) && st !== null) {
              const s1 = ok ? s : s - Math.sign(ds) * 0.5;
              if (Math.abs(s1 - st) > 0.6) { const step = Math.sign(s1 - st); let a = st; while (Math.abs(s1 - a) > 0.05) { const nxt = Math.abs(s1 - a) > 1 ? a + step : s1; const [x0, z0] = pAv(a), [x1, z1] = pAv(nxt); if (Math.hypot(x1 - x0, z1 - z0) > 0.05) ytaW(x0, z0, x1, z1, 0.8, 0.022, [1.55, 1.44, 1.22], 6); a = nxt; } }
              st = null;
            }
          }
        }
        // träd på tomten (aldrig i vyernas kil): ett äppelträd och en björk; syren i ett hörn
        const tradPlats = (kand, m) => { for (const [a, b] of kand) { const [x, z] = pt(a, b); if (krav(x, z, 'liten') && !iKil(x, z, 2.5) && !upptagen(x, z, m)) return [x, z]; } return null; };
        const bakH = [[svB + 3.5, lat0 + 3.5], [svB + 3.5, lat1 - 3.5], [svB + 5, (lat0 + lat1) / 2 - 4], [svB + 5, (lat0 + lat1) / 2 + 4], [svF - 3.2, lat0 + 3.2], [svF - 3.2, lat1 - 3.2]];
        const ap = tradPlats(bakH, 1.6); if (ap) trad('frukt', ap[0], ap[1], 4.2 + r() * 0.6, 2.4);
        const bj = tradPlats(bakH.filter(([a, b]) => !ap || Math.hypot(pt(a, b)[0] - ap[0], pt(a, b)[1] - ap[1]) > 5), 2); if (bj) { const A = art('bjork'), h = 12; lagg(V.bark, A.bark, bj[0], hy(...bj), bj[1], h / A.H, r() * 6.28, A.H, 0.006); lagg(V.nara, A.lov, bj[0], hy(...bj), bj[1], h / A.H, r() * 6.28, A.H, 0.006); flack.push({ m: matris(bj[0], hy(...bj) + 0.02, bj[1], 3, 1, 3, 0) }); }
        const sy = [[svF - 1.6, lat0 + 1.6], [svF - 1.6, lat1 - 1.6], [svB + 1.6, lat0 + 1.6], [svB + 1.6, lat1 - 1.6]].map(([a, b]) => pt(a, b)).find(([x, z]) => !iKil(x, z, 1.5) && !upptagen(x, z, 1.2) && kant(x, z) > 4);
        if (sy) {
          const [x, z] = sy, y = hy(x, z);
          trad('buske', x, z, 2.6, 1.3); trad('buske', x + 0.9, z + 0.6, 2.2, 0);
          // (inga lösa blomkort i busken: blommor växer bara på marken)
          // fågelholk på en stolpe vid syrenen
          const fx = x - 1.2, fz = z - 0.4, fy = hy(fx, fz), ryH = ryMot(-1, 0);
          try { window.__holk = [fx, fy, fz, x, z]; } catch (e) { /* ingen window */ }
          vlada(VD, fx, fy + 0.9, fz, ryH, 0.035, 0.9, 0.035, [0.35, 0.27, 0.18]);
          vlada(VD, fx, fy + 1.95, fz, ryH, 0.1, 0.15, 0.1, [0.42, 0.33, 0.22]); vlada(VD, fx, fy + 2.13, fz, ryH, 0.13, 0.015, 0.14, [0.22, 0.12, 0.08]);
          const hn = [Math.sin(ryH), 0, Math.cos(ryH)]; vkvad(VD, [fx + hn[0] * 0.101, fy + 2.0, fz + hn[2] * 0.101], [0.018 * hn[2], 0, -0.018 * hn[0]], [0, 0.018, 0], hn, [0.02, 0.02, 0.02]);
        }
        // trädgårdsbänk vid äppelträdet, vänd mot huset
        if (ap) {
          const vx = -ap[0], vz = -ap[1], l = Math.hypot(vx, vz) || 1, bx = ap[0] + vx / l * 1.6, bz = ap[1] + vz / l * 1.6, ryb = Math.atan2(vx, vz), by = hy(bx, bz);
          if (!upptagen(bx, bz, 0.6) && !iKil(bx, bz, 1)) {
            const BR = [0.42, 0.3, 0.19], JR = [0.05, 0.05, 0.055], c3 = Math.cos(ryb), s3 = Math.sin(ryb), at = (u, w) => [bx + c3 * u + s3 * w, bz - s3 * u + c3 * w];
            for (const w of [-0.08, 0.06]) { const [x, z] = at(0, w); vlada(VD, x, by + 0.45, z, ryb, 0.75, 0.018, 0.06, BR); }
            for (const yy of [0.62, 0.76]) { const [x, z] = at(0, -0.2); vlada(VD, x, by + yy, z, ryb, 0.75, 0.05, 0.015, BR); }
            for (const u of [-0.62, 0.62]) { const [x, z] = at(u, -0.04); vlada(VD, x, by + 0.22, z, ryb, 0.025, 0.22, 0.2, JR); const [x2, z2] = at(u, -0.2); vlada(VD, x2, by + 0.6, z2, ryb, 0.025, 0.2, 0.018, JR); }
          }
        }
        // rund rabatt med buskar, perenner och stenar på framsidans gräsmatta, vid husets ände bort från uppfarten
        const kantBlom = [];
        {
          const svM = Math.max(...hor.map(h => h[0])), latH0 = Math.min(...hor.map(h => h[1])), latH1 = Math.max(...hor.map(h => h[1]));
          const vg = vagLat(svM + 3.5), sida = Math.abs(latH0 - vg) > Math.abs(latH1 - vg) ? -1 : 1;
          const ia = svM + 3.6, ib = sida < 0 ? latH0 - 1.2 : latH1 + 1.2, [ix, iz] = pt(ia, ib);
          if (BLK && !upptagen(ix, iz, 1.6) && svF - ia > 2) {
            // riktiga blommor: rosor och gräs i mitten, perenner i skikt ut mot kanten, nedsjunkna granitblock
            const R = BLOM.rabattRund({ c: [ix, iz], R: 1.45, r, hy, ledig: (x, z, m) => !upptagen(x, z, m), stenar: 3 });
            BLP.push(...R.poster); BLD.push(R.badd); BLS.push(...R.stenar); VRAM.rund = [ix, iz];
            kantBlom.push([ix, iz, 1.9]);
          } else if (!upptagen(ix, iz, 1.6) && svF - ia > 2) {
            const H = [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]];
            YT.push({ P: H.map(([u, v]) => { const [x, yy, z] = W3(ia + v, ib + u); return [x, yy + 0.02, z]; }), f: [0.42, 0.31, 0.22], G: H.map(([u, v]) => [u, 60, v, 7]) });
            const iy = hy(ix, iz);
            trad('buske', ix, iz, 0.85, 0.8); trad('buske', ix + 0.6, iz - 0.4, 0.6, 0);
            for (let k = 0; k < 14; k++) {
              const a = k / 14 * 6.283 + r() * 0.3, rr = 0.55 + r() * 0.7, x = ix + Math.cos(a) * rr, z = iz + Math.sin(a) * rr;
              if (k % 4 === 0) planta('gras', x, z, 0.6 + r() * 0.2, ton(r, [0.86, 0.84, 0.5], 0.08));
              else { planta('blomma', x, z, 0.4 + r() * 0.18, [[0.78, 0.6, 1.05], [1.05, 0.55, 0.62], [1.0, 1.0, 0.95]][k % 3]); blommor(x, z, k % 3, 0.38); }
            }
            for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4, rr = 1.05 + r() * 0.25, x = ix + Math.cos(a) * rr, z = iz + Math.sin(a) * rr, s = 0.18 + r() * 0.2; N.sten.push({ m: matris(x, iy + s * 0.05, z, s * 1.4, s * (0.7 + r() * 0.3), s * 1.1, r() * 6.28, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2), c: variera('#a6a298', r, 0.02, 0.05, 0.1), form: 0 }); }
            kantBlom.push([ix, iz, 1.9]);
          }
        }
        // buxbom i stora krukor på var sin sida om trappan (team-tomt: avstängt – de gröna kloten såg fejk ut; entrén har lerkrukor med pelargon)
        if (false) {
          let e = 0.6;
          for (let l = 0.4; l < 3; l += 0.1) { const x = dorr.x + du[0] * l + dn[0] * 0.8, z = dorr.z + du[1] * l + dn[1] * 0.8; if (!(mal.trappa && mal.trappa(x, z, 0))) { e = l; break; } }
          for (const sx of [-1, 1]) {
            const x = dorr.x + du[0] * sx * (e + 0.95) + dn[0] * 0.85, z = dorr.z + du[1] * sx * (e + 0.95) + dn[1] * 0.85, y = hy(x, z);
            if (mal.trappa && mal.trappa(x, z, 0.2)) continue;
            ror(VD, [[x, y, z, 0.2], [x, y + 0.48, z, 0.26], [x, y + 0.5, z, 0.27]], 10, UG, 1, () => [0.06, 0.062, 0.065]);
            vkvad(VD, [x, y + 0.47, z], [0.24, 0, 0], [0, 0, 0.24], [0, 1, 0], [0.08, 0.06, 0.045]);
            lagg(V.nara, variant('buske', 1).lov, x, y + 0.36, z, 0.52, sx, 1.1, 0.01, [0.5, 0.66, 0.42]);   // klippt buxbomsklot
          }
        }
        // 3D-grästuvor på gräsmattan (tätast framför och runt huset) och prästkragar i kanterna
        {
          const tf = (x, z, m) => !upptagen(x, z, m) && kant(x, z) > gb + 0.8 && Math.abs(svAv(x, z) - svF) > 0.5;
          const K4 = [[-L / 2, -W / 2, 2.6], [L / 2, -W / 2, 2.6], [-L / 2, W / 2, 2.6], [L / 2, W / 2, 2.6], ...kantBlom];
          // framför huset (där startvyn tittar) tätast; större tuvor i kanterna mot staket och rabatter
          const fram = (x, z) => (x - dorr.x) * dn[0] + (z - dorr.z) * dn[1] > 1 ? 1 : 0.25;
          N.extra.push(tuvGrupp(tuvPoster(mal, slump(4343), hy, tf, 18, 6, K4, fram, 1.35).map(p => p.typ === 1 ? Object.assign(p, { typ: 0 }) : p)));
          N.extra.push(bjvGrupp(bjvPoster(mal, hy, slump(4747), 'villa')));   // fotoskannade småväxter på baksidan
        }
        // husnummer på fasaden bredvid dörren och en utekran med slang vid närmaste hörn
        {
          const p = [dorr.x + du[0] * 1.35 + dn[0] * 0.04, hy(dorr.x, dorr.z) + 1.95, dorr.z + du[1] * 1.35 + dn[1] * 0.04];
          // (egna små nät, knutna till husets uppbyggnad i husritare.js: numret följer väggen,
          // kranen och slangen kommer upp med trappan; förut stod de kvar i luften före huset)
          const HN = del(), HK = del();
          husnummer(HN, 14, p, [-du[0], 0, -du[1]], [dn[0], 0, dn[1]], 1.6);
          const kx = dorr.x + du[0] * 2.4 + dn[0] * 0.05, kz = dorr.z + du[1] * 2.4 + dn[1] * 0.05, ky = hy(kx, kz);
          vlada(HK, kx, ky + 0.55, kz, Math.atan2(dn[0], dn[1]), 0.03, 0.03, 0.05, [0.55, 0.45, 0.2]);
          vlada(HK, kx, ky + 0.6, kz + 0, Math.atan2(dn[0], dn[1]), 0.012, 0.03, 0.012, [0.6, 0.1, 0.06]);
          const sl = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * 5.2; sl.push([kx + dn[0] * (0.25 + 0.18 * Math.cos(a)) + du[0] * 0.18 * Math.sin(a) * 0.6, ky + 0.03, kz + dn[1] * (0.25 + 0.18 * Math.cos(a)) + du[1] * 0.18 * Math.sin(a) * 0.6, 0.013]); }
          sl.unshift([kx, ky + 0.5, kz, 0.013]);
          if (!upptagen(kx + dn[0] * 0.3, kz + dn[1] * 0.3, 0.1)) ror(HK, sl, 4, UG, 1, () => [0.08, 0.3, 0.12]);
          for (const [D, fas, namn] of [[HN, 'vagg', 'husfas-nummer'], [HK, 'ute', 'husfas-kran']]) {
            const Sm = samling(); lagg(Sm, D, 0, 0, 0, 1, 0, 8, 0);
            const m = vegMesh(namn, Sm, egenMat('ting', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), { glod: true })), true, true);
            if (m) { m.userData.husFas = fas; N.extra.push(m); }
          }
        }
      }
      try { window.__villa = { hus: tomtD.map(d => ({ d: +d.d.toFixed(1), fram: d.ut.fram.map(v => +v.toFixed(1)), dorr: d.ut.dorr.map(v => +v.toFixed(1)), ry: +d.ry.toFixed(2) })), gata: { O: [P.vag.x0, P.vag.z0], n, t, HU } }; } catch (e) { /* ingen window */ }   // för provbilder
      const narmast = tomtD.reduce((m, d, i) => d.d < tomtD[m].d ? i : m, 0);
      yield;
      let uteVald = false;   // Fab-uteplatsen hamnar på en granntomt (nedan)
      tomtD.forEach((d, i) => {
        const { typ, lok, ux, ry, spegel, ut } = d, L = typ.L, F = typ.W / 2, sp = spegel ? -1 : 1, nara = d.d < 52;
        const xd = -L / 2 + (spegel ? L - typ.dorr : typ.dorr), zt = F + (typ.extra === 'farstu' ? 1.95 : typ.extra === 'trappa' ? 1.35 : 0.6);
        const ZF = F + 5.4, typS = d.h < 0.3 ? 0 : d.h < 0.55 ? 1 : d.h < 0.78 ? 2 : d.d > 60 ? 1 : 3, fa = STAKFARG[(d.h2 * 4) | 0];   // tujahäck bara nära
        const P3 = (lx, lz) => W3(...lok(lx, lz)), fri = (lx, lz, m) => ledig(...lok(lx, lz), m);
        const ex = [Math.cos(ry), 0, -Math.sin(ry)], ez = [Math.sin(ry), 0, Math.cos(ry)];
        // gränsen mot gatan: luckor vid uppfarten och vid gången
        // tomtens bredd: till mitten mot grannen om det finns ett hus bredvid, annars bara en bit förbi gaveln (inga staketfack ute på tom mark)
        const granne = sx => husR.some(h => h !== d.hr && h.f[0] === d.f[0] && h.f[1] === d.f[1] && Math.abs((h.sv - d.hsv) * d.f[0] + (h.lat - d.hlat) * d.f[1]) < 4 && ((h.sv - d.hsv) * d.ax[0] + (h.lat - d.hlat) * d.ax[1]) * sx > 8 && ((h.sv - d.hsv) * d.ax[0] + (h.lat - d.hlat) * d.ax[1]) * sx < 30);
        const XL = granne(-1) ? -12.4 : -(L / 2 + 3.5), XR = granne(1) ? 12.4 : L / 2 + 3.5;
        // Fab-uteplatsen (husritare-fab.js) i stället för altanen på första granntomten 18–45 m bort utan studsmatta,
        // lekstuga eller flagga: parallellt med huset, 1,2 m från baksidan, minst 1 m från häckar, staket och andra hus.
        // Ytan reserveras i husR innan något annat på tomten läggs ut, så att träd, häckar och växter håller undan.
        let uteH = false;
        if (FAB.klar() && !uteVald && nara && d.extra <= 0.55 && d.d > 16 && d.d < 50) for (const cu of [-sp * L * 0.17, sp * L * 0.17, 0]) {
          if (uteH) break;
          const zu = -F - 3.2, [ua, ub] = lok(cu, zu);
          const ok = [cu - 2.9 > XL + 1.2 && cu + 2.9 < XR - 1.2, !iSiktkil(...pt(ua, ub), 3),
            [[-2.9, -2], [2.9, -2], [-2.9, 0], [2.9, 0], [0, -2]].every(([u, v]) => fri(cu + u, zu + v, 1.0)),
            [[-2.9, 2], [2.9, 2], [0, 2]].every(([u, v]) => fri(cu + u, zu + v, 0.3))];
          if (ok.every(Boolean)) {
            uteVald = uteH = true;
            const h0 = Math.max(...[[-2.9, -2], [2.9, -2], [-2.9, 2], [2.9, 2], [0, 0]].map(([u, v]) => P3(cu + u, zu + v)[1]));
            const [x, , z] = P3(cu, zu);
            N.extra.push(FAB.uteplats(x, h0 - 0.02, z, ry + Math.PI / 2, 0.27));
            husR.push({ sv: ua, lat: ub, f: d.f, ax: d.ax, L: 5.8, W: 4.0 });
          }
        }
        let iv = [[XL, XR]];
        [[ux - 1.9, ux + 1.9], [xd - 0.62, xd + 0.62]].forEach(([g0, g1]) => { iv = iv.flatMap(([a, b]) => b <= g0 || a >= g1 ? [[a, b]] : [[a, g0], [g1, b]].filter(([p, q]) => q - p > 0.5)); });
        iv.forEach(([a, b]) => {
          const ha = a > XL + 0.01 ? a + 0.18 : a, hb = b < XR - 0.01 ? b - 0.18 : b;   // häcken slutar en bit före gången och uppfarten (lövskalen)
          if (typS === 3) { hack(0, lok, ha, ZF - 0.35, hb, ZF - 0.35); return; }
          const n = Math.max(1, Math.round((b - a) / 1.8)), st = (b - a) / n;
          for (let k = 0; k < n; k++) { const lx = a + st * (k + 0.5); if (!fri(lx, ZF, 0.2)) continue; const [x, y, z] = P3(lx, ZF); if (typS < 2 && d.d < 38) stkFack(STL, x, y, z, ry, st, typS === 0 ? STAKFARGER.vit : [STAKFARGER.falu, STAKFARGER.natur, STAKFARGER.gra, STAKFARGER.natur][(d.h2 * 4) | 0]); else stakSeg(typS, x, y, z, ry, fa, nara, st / 1.8); hinder('staket', x, z, ry, st / 2 + 0.06, 0.08); }
          if (typS < 2 && fri(b, ZF, 0.2)) { const [x, y, z] = P3(b, ZF); vlada(VD, x, y + 0.6, z, ry, 0.05, 0.6, 0.05, typS ? fa : VIT); }
          if (typS === 2) hack(1, lok, ha, ZF - 0.75, hb, ZF - 0.75);
          // högre gräs och ogräs vid staketet, där klipparen inte kommer åt
          if (nara) for (let lx = a + 0.2; lx < b; lx += 0.55) {
            const [aa, bb] = lok(lx, ZF - 0.12 - r() * 0.2); if (!ledig(aa, bb, 0.1)) continue;
            const [x, z] = pt(aa, bb);
            if (r() < 0.85) planta('gras', x, z, 0.3 + r() * 0.28, ton(r, [0.62, 0.68, 0.4], 0.12)); else planta('blomma', x, z, 0.3 + r() * 0.1, [1, 1, 0.9]);
          }
        });
        // grind vid gången: grindstolpar och ett öppet grindblad (muren får två pelare)
        if (fri(xd, ZF, 0.2)) for (const sx of [-1, 1]) {
          const [x, y, z] = P3(xd + sx * 0.62, ZF);
          if (typS === 2) vlada(VD, x, y + 0.36, z, ry, 0.16, 0.36, 0.2, [0.4, 0.39, 0.37]);
          else if (typS < 2) vlada(VD, x, y + 0.66, z, ry, 0.065, 0.66, 0.065, typS ? fa.map(v => v * 0.8) : VIT);
          if (sx < 0 && typS < 2) {
            const r2 = ry - 1.25, c2 = Math.cos(r2), s2 = Math.sin(r2), gx = x + c2 * 0.55, gz = z - s2 * 0.55;
            if (typS === 0) {
              for (const yy of [0.3, 0.78]) vlada(VD, gx, y + yy, gz, r2, 0.52, 0.03, 0.012, VIT);
              for (let j = 0; j < 4; j++) vlada(VD, gx + c2 * (-0.39 + j * 0.26), y + 0.5, gz - s2 * (-0.39 + j * 0.26), r2, 0.036, 0.47, 0.01, VIT);
            } else vlada(VD, gx, y + 0.66, gz, r2, 0.52, 0.58, 0.02, fa);
          }
        }
        // plattgång från trottoaren till entrén, kantsten och belysta pollare vid trappan
        {
          const [a0, b0] = lok(xd, ZF + 0.6), [a1, b1] = lok(xd, zt);
          yta(a0, b0, a1, b1, 1.2, 0.035, [2.2, 2.15, 2.05], nara ? 9 : 1);   // nära: granithällar (foto)
          const lz = (ZF + 0.6 + zt) / 2, hl = (ZF + 0.6 - zt) / 2;
          if (nara) for (const sx of [-1, 1]) { const [x, y, z] = P3(xd + sx * 0.66, lz); vlada(VD, x, y + 0.04, z, ry, 0.05, 0.07, hl, [0.6, 0.6, 0.58]); }
          if (d.h2 > 0.3) for (const sx of [-1, 1]) {
            const [x, y, z] = P3(xd + sx * 0.95, zt + 0.5), ford = 0.2 + r() * 0.2;
            ror(VD, [[x, y - 0.05, z, 0.06], [x, y + 0.5, z, 0.06]], 6, UG, 1, () => [0.08, 0.08, 0.085]);
            ror(VD, [[x, y + 0.5, z, 0.062], [x, y + 0.62, z, 0.062]], 6, UG, 1, () => [0.95, 0.9, 0.78], 1 + ford);
            vlada(VD, x, y + 0.64, z, 0, 0.075, 0.02, 0.075, [0.08, 0.08, 0.085]);
            N.glod.push([x, y + 0.56, z, 0.16, 0, ...VARMT, ford]);
            N.glod.push([x, y + 0.04, z, 1.4, 1, 0.3, 0.2, 0.1, ford]);
          }
        }
        // husnummer vid dörren och ibland antenn eller parabol
        if (ut.tw) {
          husnummer(VD, 2 + 2 * ((i * 7 + 3) % 23), ut.tw(ut.xd - 0.82, 2.05, ut.z0 + 0.03), ut.tn([1, 0, 0]), ut.tn([0, 0, 1]));
          if (d.hh > 0.3 && d.hh < 0.48) {
            const b = ut.tw(-L * 0.28, ut.yR + ut.T, 0), ax = ut.tn([0, 0, 1]);
            ror(VD, [[b[0], b[1] - 0.1, b[2], 0.025], [b[0], b[1] + 1.7, b[2], 0.02]], 5, UG, 1, () => [0.5, 0.5, 0.52]);
            for (const [yy, l] of [[1.1, 0.5], [1.35, 0.42], [1.6, 0.34]]) vlada(VD, b[0], b[1] + yy, b[2], ry + Math.PI / 2, l, 0.008, 0.008, [0.55, 0.55, 0.57]);
            vlada(VD, b[0] + ax[0] * 0.3, b[1] + 1.6, b[2] + ax[2] * 0.3, ry, 0.01, 0.01, 0.45, [0.55, 0.55, 0.57]);
          } else if (d.hh >= 0.48 && d.hh < 0.62) {
            const n0 = ut.tn([1, 0, 0]), p0 = ut.tw(L / 2 + 0.03, ut.he - 0.7, -0.8), dir = norm([n0[0] * 0.8 + ez[0] * 0.3, 0.35, n0[2] * 0.8 + ez[2] * 0.3]);
            const P = t => [p0[0] + dir[0] * t, p0[1] + dir[1] * t, p0[2] + dir[2] * t];
            ror(VD, [P(0).concat(0.025), P(0.3).concat(0.025)], 4, UG, 1, () => [0.6, 0.6, 0.6]);
            ror(VD, [P(0.22).concat(0.04), P(0.36).concat(0.3), P(0.4).concat(0.33)], 10, UG, 1, () => [0.78, 0.78, 0.76]);
          }
        }
        // carport över uppfarten på några tomter
        if (nara && d.h2 < 0.22) {
          for (const sx of [-1, 1]) for (const lz of [F + 0.9, F + 5.0]) { const [x, y, z] = P3(ux + sx * 1.6, lz); vlada(VD, x, y + 1.2, z, ry, 0.055, 1.2, 0.055, VIT); }
          const [x, y, z] = P3(ux, F + 2.95);
          vlada(VD, x, y + 2.44, z, ry, 1.85, 0.1, 2.3, VIT); vlada(VD, x, y + 2.56, z, ry, 1.82, 0.025, 2.27, [0.12, 0.12, 0.13]);
        }
        // tomtgränsen även åt sidorna (alla tomter): samma staket som mot gatan, eller en häck; långt bort enkla fack
        for (const sx of [-1, 1]) {
          if (d.d > 56 || (nara && (typS >= 2 || (sx > 0) === (d.h2 < 0.5)))) continue;   // nära: den ena sidan får häck nedan; längst bort bara framsidan
          const ryS2 = ry + Math.PI / 2, l0 = ZF - 0.3, l1 = -F - 7.5, nn = Math.max(1, Math.round((l0 - l1) / 2)), sl = (l0 - l1) / nn;
          for (let k = 0; k < nn; k++) {
            const xs = sx > 0 ? XR + 0.2 : XL - 0.2, lz = l0 - sl * (k + 0.5); if (!fri(xs, lz, 0.2)) continue;
            const [x, y, z] = P3(xs, lz);
            stakSeg(typS < 2 ? typS : 1, x, y, z, ryS2, fa, d.d < 36, sl / 1.8);   // sidorna med de lätta facken (trianglar)
          }
        }
        // en cykel vid entrén på några tomter
        if (nara && d.h2 > 0.45 && d.h2 < 0.8) {
          const [cx, cy, cz] = P3(xd + (spegel ? -1.6 : 1.6), zt + 0.6), c = Math.cos(ry), s = Math.sin(ry), RAM = [[0.1, 0.25, 0.45], [0.55, 0.08, 0.06], [0.08, 0.08, 0.09]][(d.h * 3) | 0];
          const at = (u, yy) => [cx + c * u, cy + yy, cz - s * u];
          for (const u of [-0.55, 0.55]) { const P = []; for (let j = 0; j <= 12; j++) { const a = j / 12 * 6.283, p = at(u + Math.cos(a) * 0.33, 0.34 + Math.sin(a) * 0.33); P.push([...p, 0.016]); } ror(VD, P, 4, UG, 1, () => [0.03, 0.03, 0.03]); }
          ror(VD, [[...at(-0.55, 0.34), 0.016], [...at(-0.05, 0.36), 0.016], [...at(0.42, 0.78), 0.016], [...at(-0.12, 0.78), 0.016], [...at(-0.05, 0.36), 0.016]], 4, UG, 1, () => RAM);
          ror(VD, [[...at(0.42, 0.78), 0.014], [...at(0.55, 0.34), 0.014]], 4, UG, 1, () => RAM);
          ror(VD, [[...at(-0.12, 0.78), 0.014], [...at(-0.16, 0.9), 0.014]], 4, UG, 1, () => RAM); vlada(VD, ...at(-0.16, 0.92), ry, 0.11, 0.02, 0.05, [0.04, 0.04, 0.04]);
          ror(VD, [[...at(0.42, 0.78), 0.014], [...at(0.46, 0.98), 0.014]], 4, UG, 1, () => RAM); vlada(VD, ...at(0.46, 0.99), ry, 0.03, 0.012, 0.26, [0.05, 0.05, 0.05]);
        }
        // tomterna längre bort: buskar vid husets främre hörn och ett träd på baksidan, så att inget hus står naket
        if (!nara) {
          if (d.d < 95) for (const sx of [-1, 1]) { const [a, b] = lok(sx * (L / 2 + 0.9), F + 0.8), [x, z] = pt(a, b); if (ledig(a, b, 0.6)) trad('buske', x, z, 0.9 + r() * 0.4, 0.8); }
          const [a, b] = lok((d.h - 0.5) * L, -F - 4.5), [x, z] = pt(a, b);
          if (ledig(a, b, 1.5) && krav(x, z, 'liten')) trad(d.h < 0.35 && d.d < 75 ? 'mellan' : d.h < 0.6 ? 'ek' : 'gran1', x, z, d.h < 0.6 ? 8 + r() * 3 : 0, 2.5);   // långt bort impostorträd (billiga)
          return;
        }
        // rabatt längs husets framsida: jord, perenner, rosor och några buskar
        let rb = [[-L / 2 + 0.25, L / 2 - 0.25]];
        [[xd - 1.35, xd + 1.35], [ux - 1.8, ux + 1.8]].forEach(([g0, g1]) => { rb = rb.flatMap(([a, b]) => b <= g0 || a >= g1 ? [[a, b]] : [[a, g0], [g1, b]].filter(([p, q]) => q - p > 0.6)); });
        const phTomt = PHP && d.d < 48 * PHR;   // de närmaste grannarna: Poly Haven-buskar och rekvisita
        // riktig rabatt (husritare-blommor.js) från (a, z) till (b, z) i husets ram, bredd br; lågt mot gräset (z ut från huset · ut)
        const grannRabatt = (a, b, z, br, ut, busk = []) => {
          const A = pt(...lok(a, z)), B2 = pt(...lok(b, z)), Fr = pt(...lok(a, z + ut)), lv = [Fr[0] - A[0], Fr[1] - A[1]], ll = Math.hypot(lv[0], lv[1]) || 1;
          const R = BLOM.rabattRand({ a: A, b: B2, br, lag: [lv[0] / ll, lv[1] / ll], rak: -1, stil: 'grann', r, hy, lod: 1, glesa: 0.7,
            ledig: (x, z2, m) => ledig(svAv(x, z2), latAv(x, z2), m * 0.5) && !busk.some(([bx, bz, br2]) => Math.hypot(bx - x, bz - z2) < br2 + m) });
          BLP.push(...R.poster); BLD.push(R.badd);
        };
        rb.forEach(([a, b], ri) => {
          const [a0, b0] = lok(a, F + 0.55), [a1, b1] = lok(b, F + 0.55);
          if (BLK) {
            // buskar längs fasaden (Poly Haven-raden nära, annars miljöns buskar) och blommor framför och mellan dem
            const busk = [];
            if (phTomt) { const n = Math.floor((b - a - 0.1) / 2.5); for (let j = 0; j < n; j++) busk.push([...pt(...lok(a + (b - a) * (j + 0.5) / n, F + 0.62)), 0.55]); }
            else for (let lx = a + 0.7; lx < b - 0.4; lx += 2.3) { const [x, z] = pt(...lok(lx, F + 0.5)); trad('buske', x, z, 0.55 + r() * 0.35, 0.4); busk.push([x, z, 0.4]); }
            grannRabatt(a, b, F + 0.72, 0.85, 1, busk);
          } else {
          yta(a0, b0, a1, b1, 0.8, 0.02, JORD, 5);
          let k = 0;
          for (let lx = a + 0.35; lx < b - 0.2; lx += 0.55 + r() * 0.3, k++) {
            const [x, z] = pt(...lok(lx, F + 0.5 + (r() - 0.5) * 0.3));
            if (k % 4 === 1) { const s = 0.55 + r() * 0.35; if (!phTomt) trad('buske', x, z, s, 0.4); }
            else planta('blomma', x, z, 0.34 + r() * 0.16, BLOMFARG[(d.h * 5 + k) % 5 | 0]);
          }
          }
          // en rad fotoskannade buskar (Poly Haven shrub_02: fyra glesa buskar på rad, ~2,4 m, ~1,1 m höga) längs fasaden
          if (phTomt) {
            const n = Math.floor((b - a - 0.1) / 2.5);
            for (let j = 0; j < n; j++) {
              const lx = a + (b - a) * (j + 0.5) / n, [x, z] = pt(...lok(lx, F + 0.62));
              PHV.push({ m: 'shrub_02', del: 'shrub', x, y: hy(x, z) - 0.03, z, ry: ry + (rP() < 0.5 ? Math.PI : 0), s: 0.36 + rP() * 0.04 });
            }
            // tomtenisse vid rabattens kant (bara hos närmaste grannen)
            if (i === narmast && !d.nisse && b - a > 1.2) { d.nisse = true; const [x, z] = pt(...lok(a + 0.45, F + 1.05)); PHV.push({ m: 'garden_gnome', x, y: hy(x, z), z, ry: ry + 0.35, s: 0.9 }); }
          }
        });
        // vid entrén: lerkrukor med blommor på trappan, slang på gaveln vid uppfarten, sprinkler på gräsmattan bakom
        if (phTomt) {
          const yP = typ.extra === 'skarm' ? 0.2 : 0.4, zP = typ.extra === 'farstu' ? F + 1.2 : typ.extra === 'trappa' ? F + 0.72 : F + 0.3, xP = typ.extra === 'farstu' ? 0.85 : 0.72;
          for (const sx of [-1, 1]) {
            if (rP() < 0.25) continue;
            const p = ut.tw(xd + sx * xP, yP, zP), s = 1.1 + rP() * 0.3;
            PHV.push({ m: 'planter_pot_clay', x: p[0], y: p[1], z: p[2], ry: rP() * 6.28, s });
            if (BLK) BLP.push({ art: rP() < 0.75 ? 'pelargon' : 'margerit', x: p[0], y: p[1] + 0.2 * s - 0.03, z: p[2], s: 0.62 * s, ry: rP() * 6.28, f: [[1.0, 0.18, 0.16], [1.0, 0.32, 0.45], [1.0, 0.55, 0.7]][(d.h * 3 + sx + 1) % 3 | 0], viktig: true });   // blommande pelargon eller margerit
            else for (let j = 0; j < 3; j++) lagg(V.mark, variant('blomma', j % 3).lov, p[0] + (rP() - 0.5) * 0.12, p[1] + 0.2 * s, p[2] + (rP() - 0.5) * 0.12, 0.3, rP() * 6.28, 1, 0.05, BLOMFARG[(d.h * 5 + j * 2) % 5 | 0]);
          }
          const gx = spegel ? -1 : 1, slang = ut.tw(gx * (L / 2 + 0.005), 0.78, F - 0.8);   // gaveln på uppfartens sida, 0,8 m från hörnet
          if (rP() < 0.75 && PHV.filter(p => p.m === 'garden_hose_wall_mounted_01').length < 2) PHV.push({ m: 'garden_hose_wall_mounted_01', x: slang[0], y: slang[1], z: slang[2], ry: ry + gx * Math.PI / 2, golv: false });
          // sprinklern på gräset: inte på trädgårdsgången (altanen → växthuset/odlingen), inte vid växthuset eller trädet
          const g1 = [-sp * L * 0.17 - sp * 1.6, -F - 3.1], g2 = [-sp * (L / 2 - 0.6) + sp * 0.2, -F - 4.7];
          const gAv = (u, w) => { const dx = g2[0] - g1[0], dz = g2[1] - g1[1], t = Math.max(0, Math.min(1, ((u - g1[0]) * dx + (w - g1[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(g1[0] + dx * t - u, g1[1] + dz * t - w); };
          const sk = [[sp * 1.2, -F - 4.4], [-sp * 0.6, -F - 5.6], [sp * 2.8, -F - 3.9]].find(([u, w]) => gAv(u, w) > 1.4 && Math.hypot(u + sp * (L / 2 - 0.6), w + F + 6.4) > 2.4 && Math.hypot(u - sp * L * 0.32, w + F + 6.2) > 1.2 && Math.abs(w + F + 4.3) > 0.5 && ledig(...lok(u, w), 0.6));
          if (sk && rP() < 0.6) { const [x, z] = pt(...lok(...sk)); PHV.push({ m: 'garden_sprinkler_01', x, y: hy(x, z), z, ry: rP() * 6.28 }); }
        }
        // rabatt innanför spjälstaketet
        if (typS === 0) iv.forEach(([a, b]) => {
          const [a0, b0] = lok(a + 0.3, ZF - 0.75), [a1, b1] = lok(b - 0.3, ZF - 0.75);
          if (b - a < 1.6 || !ledig(a0, b0, 0.2) || !ledig(a1, b1, 0.2)) return;
          if (BLK) { grannRabatt(a + 0.3, b - 0.3, ZF - 0.75, 0.75, -1); return; }   // lågt mot gräsmattan (in mot huset)
          yta(a0, b0, a1, b1, 0.7, 0.02, JORD, 5);
          for (let lx = a + 0.6; lx < b - 0.4; lx += 0.7) { const [x, z] = pt(...lok(lx, ZF - 0.75)); planta('blomma', x, z, 0.36 + r() * 0.16, BLOMFARG[(lx * 3 + 9) % 5 | 0]); }
        });
        // syren vid ena framhörnet
        {
          const lx = -sp * (L / 2 + 1.6), lz = F + 2.2;
          if (fri(lx, lz, 1.2)) {
            const [x, y, z] = P3(lx, lz);
            trad('buske', x, z, 2.5, 1.2);
            // (inga lösa blomkort i busken: blommor växer bara på marken)
          }
        }
        // häck längs ena tomtgränsen
        { const sx = d.h2 < 0.5 ? 1 : -1, xs = sx > 0 ? XR + 0.2 : XL - 0.2; hack(1, lok, xs, ZF - 0.5, xs, -F - 7.5); }
        // altan med trall på baksidan, utemöbler och parasoll
        // altanen ligger framför altandörren (husets bakre breda dörr), trallen 2,5 cm under tröskeln; mot gräset trappsteg
        // (stigning ~17 cm, steg 30 cm). Sittgruppen står i altanens andra ände, så att dörren och vägen ut är fria.
        let c = -sp * L * 0.17, kD = sp, dorrY = null;
        const zb = -F - 1.5;
        if (ut.altan) {
          const dp = ut.tw(ut.altan.xb, 0, -F), lxD = (svAv(dp[0], dp[2]) - d.hsv) * d.ax[0] + (latAv(dp[0], dp[2]) - d.hlat) * d.ax[1];
          kD = lxD > 0 ? -1 : 1; c = Math.max(-L / 2 + 2.45, Math.min(L / 2 - 2.45, lxD + kD * 1.2)); dorrY = ut.tw(0, ut.altan.sY, 0)[1];
        }
        if (!uteH && [[-2.4, -3], [2.4, -3], [0, -3]].every(([u, v]) => fri(c + u, -F + v - 0.1, 0.2))) {
          const yM = P3(c, zb)[1], y0 = dorrY != null ? Math.max(0.12, dorrY - 0.025 - yM) : 0.32;
          const [a0, b0] = lok(c - 2.4, zb), [a1, b1] = lok(c + 2.4, zb);
          yta(a0, b0, a1, b1, 3.0, y0, d.h < 0.5 ? [1.3, 0.92, 0.62] : [1.1, 1.02, 0.92], 2);
          { const [x, y, z] = P3(c, zb); vlada(VD, x, y + y0 / 2 - 0.005, z, ry, 2.4, y0 / 2 - 0.005, 1.5, [0.22, 0.15, 0.1]); }
          { const n = Math.max(1, Math.round(y0 / 0.17)), cS = c - kD * 1.0;   // trappan ner mot gräset, mitt för vägen ut från dörren
            for (let j = 1; j < n + (n === 1 ? 1 : 0); j++) { const top = n === 1 ? y0 * 0.5 : y0 * (1 - j / n), [x, y, z] = P3(cS, -F - 3.0 - 0.3 * (j - 0.5)); vlada(VD, x, y + top / 2, z, ry, 0.75, top / 2, 0.15, [0.34, 0.25, 0.17]); vlada(VD, x, y + top - 0.012, z, ry, 0.77, 0.014, 0.16, [0.46, 0.34, 0.23]); } }
          try { (window.__villa.altaner || (window.__villa.altaner = [])).push({ d: +d.d.toFixed(1), tröskel: dorrY != null ? +dorrY.toFixed(3) : null, trall: +(yM + y0).toFixed(3), mark: +yM.toFixed(3) }); } catch (e) { /* ingen window */ }
          // sittgrupp: bord, fyra karmstolar med dynor och parasoll (husritare-bebott.js, uteGrupper): teak, gråbetsat,
          // svart- eller vitmålat trä, dynor och duk i bomullsväv; bordet längs altanen, stolarna fria från bordet
          const [tx, ty, tz] = P3(c + kD * 1.0, zb - 0.1), Y = ty + y0;
          try { (window.__villa.ute || (window.__villa.ute = [])).push([+tx.toFixed(2), +Y.toFixed(2), +tz.toFixed(2), +ry.toFixed(3), d.d]); } catch (e) { /* ingen window */ }
          UTE.push({ x: tx, y: Y, z: tz, ry, stil: (d.h2 * 4) | 0, dyna: (d.h * 7 | 0) % 4, duk: (d.h * 13 | 0) % 4, parasoll: d.h2 < 0.65, fin: d.d < 46 });
        }
        // trädgårdsgång (grus eller plattor) till växthuset eller odlingslådorna, kompost i hörnet
        const vx = -sp * (L / 2 - 0.6), vz = -F - 6.4;
        if (!uteH && fri(vx, vz, 1.8)) {
          const [a0, b0] = lok(c - sp * 1.6, -F - 3.1), [a1, b1] = lok(vx + sp * 0.2, vz + 1.7);
          yta(a0, b0, a1, b1, 0.9, 0.025, d.h2 < 0.5 ? [1.5, 1.4, 1.2] : [2.1, 2.05, 1.95], d.h2 < 0.5 ? 10 : 9);   // grus eller granithällar (foto)
          const [x, y, z] = P3(vx, vz);
          if (d.hh > 0.5) {         // litet växthus: glas, vit aluminiumram, sadeltak
            const GL = [0.5, 0.62, 0.64], RAM = [0.86, 0.87, 0.85];
            vlada(VD, x, y + 0.85, z, ry, 1.1, 0.85, 1.5, GL);
            for (const sg2 of [-1, 1]) {
              const th = 0.52, d0 = [ex[0] * sg2 * Math.cos(th), -Math.sin(th), ex[2] * sg2 * Math.cos(th)], n0 = [ex[0] * sg2 * Math.sin(th), Math.cos(th), ex[2] * sg2 * Math.sin(th)];
              lada3(VD, [x + d0[0] * 0.64, y + 2.33 + d0[1] * 0.64, z + d0[2] * 0.64], [d0, n0, ez.map(v => v * sg2)], [0.64, 0.012, 1.53], GL);
            }
            for (const [u, v] of [[-1.1, -1.5], [1.1, -1.5], [-1.1, 1.5], [1.1, 1.5]]) vlada(VD, x + ex[0] * u + ez[0] * v, y + 0.86, z + ex[2] * u + ez[2] * v, ry, 0.03, 0.86, 0.03, RAM);
            vlada(VD, x, y + 2.34, z, ry, 0.03, 0.03, 1.55, RAM);
            for (const v of [-1.5, 1.5]) vlada(VD, x + ez[0] * v, y + 1.7, z + ez[2] * v, ry, 1.12, 0.025, 0.03, RAM);
            const [kx, ky, kz] = P3(vx + sp * 1.4, vz + 1.2);
            ror(VD, [[kx, ky, kz, 0.11], [kx, ky + 0.28, kz, 0.1]], 8, UG, 1, () => [0.1, 0.34, 0.16]);
            ror(VD, [[kx + 0.08, ky + 0.08, kz, 0.018], [kx + 0.3, ky + 0.32, kz, 0.014]], 4, UG, 1, () => [0.1, 0.34, 0.16]);
          } else {                  // två odlingslådor med grönsaker
            for (const v of [-0.8, 0.8]) {
              const [bx, by, bz] = P3(vx + v, vz), fo = FAB.klar();
              if (fo) FODL.push({ x: bx, y: by - 0.02, z: bz, ry: ry + Math.PI / 2 + (v > 0 ? Math.PI : 0), s: 1.65 });   // skannad odlingsbädd (Fab, husritare-fab.js)
              else { vlada(VD, bx, by + 0.2, bz, ry, 0.42, 0.2, 0.9, [0.34, 0.24, 0.15]); vlada(VD, bx, by + 0.38, bz, ry, 0.38, 0.03, 0.86, [0.12, 0.09, 0.07]); }
              for (let k = 0; k < 4; k++) lagg(V.mark, variant('gras', k % 3).lov, bx + ez[0] * (k - 1.5) * 0.4, by + (fo ? 0.29 : 0.38), bz + ez[2] * (k - 1.5) * 0.4, 0.32, r() * 6.28, 1, 0.1, [0.55, 0.85, 0.4]);
            }
          }
          if (fri(vx - sp * 2.6, vz - 0.6, 0.4)) { const [qx, qy, qz] = P3(vx - sp * 2.6, vz - 0.6); vlada(VD, qx, qy + 0.45, qz, ry, 0.5, 0.45, 0.5, [0.07, 0.14, 0.07]); vlada(VD, qx, qy + 0.93, qz, ry + 0.05, 0.54, 0.04, 0.54, [0.06, 0.11, 0.06]); }
        }
        // tvättlina med tvätt som fladdrar i vinden
        if (!uteH && d.h2 > 0.72) {
          const lz = -F - 4.3, l0 = sp * 2.2;
          if (fri(l0 - 1.7, lz, 0.4) && fri(l0 + 1.7, lz, 0.4)) {
            const [x0, y0, z0] = P3(l0 - 1.7, lz), [x1, , z1] = P3(l0 + 1.7, lz);
            for (const [x, z] of [[x0, z0], [x1, z1]]) { vlada(VD, x, y0 + 0.9, z, ry, 0.03, 0.9, 0.03, [0.6, 0.6, 0.6]); vlada(VD, x, y0 + 1.78, z, ry, 0.025, 0.025, 0.36, [0.6, 0.6, 0.6]); }
            const TV = [[0.9, 0.9, 0.88], [0.25, 0.4, 0.65], [0.85, 0.75, 0.55], [0.7, 0.25, 0.22], [0.9, 0.9, 0.88], [0.4, 0.55, 0.4]];
            for (const v of [-0.25, 0.25]) {
              vlada(VD, (x0 + x1) / 2 + ez[0] * v, y0 + 1.79, (z0 + z1) / 2 + ez[2] * v, ry, 1.7, 0.004, 0.004, [0.85, 0.85, 0.85]);
              for (let k = 0; k < 3; k++) {
                const u = -1.2 + k * 1.15 + (v > 0 ? 0.5 : 0) + r() * 0.2, bw = 0.2 + r() * 0.12, bh = 0.25 + r() * 0.3, f = TV[(k * 2 + (v > 0 ? 1 : 0)) % 6];
                const p = [(x0 + x1) / 2 + ex[0] * u + ez[0] * v, y0 + 1.78 - bh, (z0 + z1) / 2 + ex[2] * u + ez[2] * v];
                for (const sgn of [1, -1]) vkvad(VD, p, ex.map(q => q * bw), [0, bh, 0], ez.map(q => q * sgn), f, [0.035, 0.035, 0, 0]);
              }
            }
          }
        }
        // träd i trädgården: äppelträd, och en lönn, björk eller gran i bakre hörnet
        { const [a, b] = lok(sp * L * 0.32, -F - 6.2), [x, z] = pt(a, b); if (ledig(a, b, 1.5) && krav(x, z, 'liten')) trad('frukt', x, z, 3.4 + r() * 1.3, 2.2); }
        {
          const [a, b] = lok(sp * 9.5, -F - 5.5 - r() * 2), [x, z] = pt(a, b);
          if (ledig(a, b, 2) && krav(x, z, 'liten')) { if (d.h < 0.4) trad(d.d < 36 ? 'lov' : 'mellan', x, z, 9 + r() * 4, 3); else if (d.h < 0.75) trad('bjork', x, z, 11 + r() * 4, 2.5); else trad(r() < 0.5 ? 'gran1' : 'tall0', x, z, 0, 2.5); }
        }
        // katten sitter på trappan hos närmaste granne; där vajar också en vimpel i trädgården
        if (i === narmast) {
          const yk = typ.extra === 'skarm' ? 0.2 : 0.4, [x, y, z] = P3(xd + 0.62, typ.extra === 'farstu' ? F + 1.25 : typ.extra === 'trappa' ? F + 0.7 : F + 0.35), K = [0.5, 0.29, 0.12], Y = y + yk;
          const at = (u, yy, w) => [x + ex[0] * u + ez[0] * w, Y + yy, z + ex[2] * u + ez[2] * w];
          const kb = (u, yy, w, hx, hyy, hz, f = K) => { const p = at(u, yy, w); vlada(VD, p[0], p[1], p[2], ry, hx, hyy, hz, f); };
          kb(0, 0.06, -0.04, 0.085, 0.06, 0.1); kb(0, 0.17, 0.02, 0.065, 0.11, 0.06); kb(0, 0.3, 0.05, 0.06, 0.055, 0.055);
          kb(-0.035, 0.37, 0.05, 0.014, 0.025, 0.008, [0.3, 0.15, 0.07]); kb(0.035, 0.37, 0.05, 0.014, 0.025, 0.008, [0.3, 0.15, 0.07]);
          kb(-0.03, 0.03, 0.08, 0.018, 0.03, 0.03, [0.85, 0.82, 0.76]); kb(0.03, 0.03, 0.08, 0.018, 0.03, 0.03, [0.85, 0.82, 0.76]);
          ror(VD, [at(0.05, 0.02, -0.13).concat(0.018), at(0.14, 0.01, -0.06).concat(0.016), at(0.17, 0.01, 0.06).concat(0.012)], 4, UG, 1, () => K);
          if (fri(sp * 3.5, -F - 3.4, 0.5)) { const [fx, fy, fz] = P3(sp * 3.5, -F - 3.4); lagg(TS, ting('flagga'), fx, fy, fz, 1, Math.atan2(-0.33, 0.94), 8, 0.002); }
        }
      });
      // tomma tomtplatser (där inget hus får stå för siktens skull, eller för nära vår tomt): en lekplats och annars buskage,
      // så att det inte blir stora tomma gräsytor. Allt lågt (under ~2,3 m).
      // omgivningen (husritare-omgivning.js): lekplatsen, parkstråket, fler kvarter, liv och fjärran
      yield;
      // omgivningens sittgrupper (ting 'utegrupp') blir samma riktiga sittgrupper som på grannarnas altaner
      const laggOmg = (Sm, D, x, y, z, s, ry, ...rest) => {
        const sv = D === TING.utegruppSvart;
        if (Sm === TS && (D === TING.utegrupp || sv)) { UTE.push({ x, y, z, ry, stil: sv ? 2 : (UTE.length % 2 ? 0 : 1), dyna: UTE.length % 4, duk: (UTE.length * 3) % 4, parasoll: UTE.length % 3 === 0 }); return; }
        return lagg(Sm, D, x, y, z, s, ry, ...rest);
      };
      const OMG = skapaOmgivning({ parkBil, THREE, r, pt, hy, iGata, ledig, husR, vagar, HU, BAK, GHW, GTR, VD, TS, BD, V, N, lod, trad, ror, lada3: lada3H, vkvad, hp, UG, ETT,
        lagg: laggOmg, ting, bilDel, lyktaDel, grannBygg, GRANNTYP, GRANNFARG, C, VU, LJUS, VARMT, egenMat, yta, planta, lykta, ryMot, uppfarter, hack, mal, VRAM, iSiktkil });
      {
        const fyllda = []; let lek = 0;
        tomma.forEach(tm => {
          const [x0, z0] = pt(tm.hsv, tm.hlat);
          if (husR.some(h => Math.hypot(...pt(h.sv, h.lat).map((v, i) => v - [x0, z0][i])) < 15) || fyllda.some(([a, b]) => Math.hypot(a - x0, b - z0) < 20)) return;
          if (!ledig(tm.hsv, tm.hlat, 2)) return;
          fyllda.push([x0, z0]);
          const P = (lx, lz) => W3(...tm.lok(lx, lz)), ok = (lx, lz, m) => ledig(...tm.lok(lx, lz), m), ryT = ryMot(tm.f[0], tm.f[1]);
          const exT = [Math.cos(ryT), 0, -Math.sin(ryT)], TRA = [0.4, 0.28, 0.17], ROD = [0.6, 0.08, 0.05], GUL = [0.85, 0.62, 0.08], GRA = [0.45, 0.46, 0.48];
          if (lek < 1 && Math.hypot(x0, z0) > 36) {
            lek++; OMG.lekplats(tm);   // kvarterslekplats och basketplan (husritare-omgivning.js)
          } else {
            // en låg trädgårdstomt (häck, grusgångar, fruktträd, lekstuga, bänkar; husritare-omgivning.js); annars buskage
            if (!OMG.tomTomt(tm)) for (let k = 0; k < 3; k++) { const u = (r() - 0.5) * 9, w = (r() - 0.5) * 6; if (!ok(u, w, 0.8)) continue; const [x, , z] = P(u, w); trad('buske', x, z, 1.0 + r() * 0.9, 1.1); }
          }
        });
      }
      yield;
      OMG.bygg();
      // gatuträd i rad längs huvudgatan (på trottoarens bortre kant, mellan lyktorna) med trädgaller
      yield;
      const iKors = (a, b, m) => vagar.filter(v => { const q = v.dir === 'lat' ? a - v.c : b - v.c, s = v.dir === 'lat' ? b : a; return Math.abs(q) < GHW + GTR + m && s > v.a0 - m && s < v.a1 + m; }).length > 1;
      yield;
      for (const sd of [1, -1]) for (let l = -90; l <= 90; l += 30) {
        const sv = HU + sd * (GHW + GTR - 0.8), [x, z] = pt(sv, l);
        if (iKors(sv, l, 1) || !krav(x, z, 'stor') || uppfarter.some(([, , c2, d2]) => Math.hypot(c2 - sv, d2 - l) < 3) || iSiktkil(x, z, 2)) continue;
        trad('mellan', x, z, 7 + r() * 2, 0);
        punkt(sv, l, 0.6, 0.6, 0.14, 4);
      }
      // brunnslock i körbanan och dagvattenbrunnar vid kantstenen
      yield;
      vagar.forEach((v, vi) => {
        for (let s = v.a0 + 12 + vi * 5; s < v.a1 - 5; s += 37) for (const [q, typ, hu, hv, ds] of [[v.linje ? 1.5 : 0.4, 3, 0.36, 0.36, 0], [-(GHW - 0.32), 4, 0.3, 0.22, 9], [GHW - 0.32, 4, 0.3, 0.22, 21]]) {
          const [a, b] = v.dir === 'lat' ? [v.c + q, s + ds] : [s + ds, v.c + q];
          if (iKors(a, b, 1)) continue;
          const [x, z] = pt(a, b); if (Math.hypot(x, z) > 140) continue;
          if (typ === 3 && PHP && Math.hypot(x, z) < 60 * PHR) { PHV.push({ m: 'water_manhole_cover', x, y: hy(x, z) - 0.007, z, ry: rP() * 6.28, golv: false }); continue; }   // gjutjärnslock (Poly Haven), 1 cm över asfalten
          punkt(a, b, hu, hv, 0.031, typ);
        }
      });
      // farthinder på tvärgatan och en generisk varningsskylt (triangel med en enkel symbol, ingen text)
      {
        const sv0 = HU - GHW - GTR - 22, [x, y, z] = W3(sv0, LS), ryB = ryMot(1, 0), e0 = [Math.cos(ryB), 0, -Math.sin(ryB)], n0 = [Math.sin(ryB), 0, Math.cos(ryB)];
        vlada(VD, x, y + 0.04, z, ryB, GHW - 0.05, 0.04, 1.0, [0.13, 0.13, 0.14]); vlada(VD, x, y + 0.075, z, ryB, GHW - 0.06, 0.035, 0.55, [0.13, 0.13, 0.14]);
        for (let k = -2; k <= 2; k++) vlada(VD, x + e0[0] * k * 1.1, y + 0.112, z + e0[2] * k * 1.1, ryB, 0.18, 0.002, 0.5, [0.85, 0.85, 0.82]);
        const [sx, sy, sz] = W3(sv0 + 6, LS - sg * (GHW + GTR - 0.4));
        ror(VD, [[sx, sy - 0.05, sz, 0.035], [sx, sy + 2.3, sz, 0.035]], 6, UG, 1, () => [0.55, 0.55, 0.56]);
        const tri = (h, ytop, f, off) => {
          const k = VD.P.length / 3, c0 = [sx + n0[0] * off, sy + ytop, sz + n0[2] * off], b = h * 0.577;
          hp(VD, c0[0], c0[1], c0[2], ...n0, 0.83, 0.5, f);
          hp(VD, c0[0] - e0[0] * b, c0[1] - h, c0[2] - e0[2] * b, ...n0, 0.83, 0.5, f);
          hp(VD, c0[0] + e0[0] * b, c0[1] - h, c0[2] + e0[2] * b, ...n0, 0.83, 0.5, f);
          if (dot(cross([-e0[0] * b, -h, -e0[2] * b], [e0[0] * b, -h, e0[2] * b]), n0) >= 0) VD.I.push(k, k + 1, k + 2); else VD.I.push(k, k + 2, k + 1);
        };
        tri(0.78, 2.62, [0.62, 0.04, 0.03], 0.04); tri(0.5, 2.43, [0.92, 0.92, 0.88], 0.045);
        vlada(VD, sx + n0[0] * 0.05, sy + 2.05, sz + n0[2] * 0.05, ryB, 0.11, 0.025, 0.004, [0.03, 0.03, 0.03]);
        vlada(VD, sx + n0[0] * 0.05, sy + 2.09, sz + n0[2] * 0.05, ryB, 0.05, 0.02, 0.004, [0.03, 0.03, 0.03]);
      }
      yield;
      N.extra.push(stkGrupp(STL));
      if (HSEG.length) N.extra.push(NATUR.hackar(HSEG, hy));   // klippta häckar (husritare-natur.js)
      if (KLUNG.length) N.extra.push(NATUR.lovklungor(KLUNG, 'lovklungor-villa'));   // buskar och lövträdens kronor av riktiga lövkvistar
      try { if (window.__villa) window.__villa.klungor = KLUNG.length; } catch (e) { /* ingen window */ }
      if (UTE.length) N.extra.push(uteGrupper(THREE, UTE, { VU, LJUS, ANISO }));   // sittgrupper med parasoll (husritare-bebott.js)
      try { if (window.__villa) window.__villa.hackar = HSEG.map(h => [h.typ, +h.x0.toFixed(2), +h.z0.toFixed(2), +h.x1.toFixed(2), +h.z1.toFixed(2), +h.H.toFixed(2), h.D]); } catch (e) { /* ingen window */ }
      yield;
      lagg(TS, VD, 0, 0, 0, 1, 0, 8, 0);
      yield;
      N.extra.push(...OMG.liv());
      yield;
      N.extra.push(FOLK.grupp(OMG.folk, hy));   // fotgängare, hundägare, föräldrar, ungdomar, grannen (husritare-folk.js)
      // vår elbil (samma modell) kör sakta förbi på huvudgatan i bortre körfältet (högertrafik), med jämna mellanrum
      yield;
      { const sd = Math.sign(t[0] * n[1] - t[1] * n[0]) || 1, [x, z] = pt(HU + 1.55, 0), d0 = pt(HU + 1.55, sd); if (typeof bil.forbi === 'function') { const ry = Math.atan2(d0[0] - x, d0[1] - z); N.extra.push(bil.forbi(x, hy(x, z), z, ry), bil.forbi(x, hy(x, z), z, ry, 'volvo')); } }   // blå Tesla, röd Volvo ett halvt varv efter
      { const lD = vagLat(HU - GHW - GTR / 2); N.extra.push(gataNat(pt, hy, vagar, uppfarter, YT, { v: vagar[0], sd: -1, s0: lD - 1.5 - 0.22, s1: lD + 1.5 + 0.22 })); }   // vår uppfart (3 m + kantstenar) över trottoaren
      // gräsremsa med rundad kantsten (Fab, husritare-fab.js) utanför trottoarerna inom ~75 m: 8 m-bitar längs gatan,
      // rännstenen mot trottoaren och gräset mot tomten; inte över tvärgator, uppfarter, vår uppfart eller gångar
      yield;
      if (FAB.klar()) {
        const KB = 1.65, bitar = [], lok = (v, s, q) => v.dir === 'lat' ? pt(v.c + q, s) : pt(s, v.c + q);
        const iUpp = (sv, la) => uppfarter.some(([a, b, c, d, br]) => { const dx = c - a, dz = d - b, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((sv - a) * dx + (la - b) * dz) / l2)); return Math.hypot(a + dx * t - sv, b + dz * t - la) < br / 2 + 0.8; });
        vagar.forEach(v => [-1, 1].forEach(sd => {
          for (let s = v.a0 + 2; s + 8 <= v.a1 - 2; s += 8) {
            const ok = [0, 2, 4, 6, 8].every(ds => [0.2, KB - 0.2].every(dq => {
              const q = sd * (GHW + GTR + dq), sv = v.dir === 'lat' ? v.c + q : s + ds, la = v.dir === 'lat' ? s + ds : v.c + q, [x, z] = pt(sv, la);
              return Math.hypot(x, z) < 75 && !iUpp(sv, la) && !mal.blockerad(x, z, 0.4) && !vagar.some(w => w !== v && (w.dir === 'lat' ? Math.abs(sv - w.c) : Math.abs(la - w.c)) < GHW + GTR + 0.3 && (w.dir === 'lat' ? la : sv) > w.a0 - 1 && (w.dir === 'lat' ? la : sv) < w.a1 + 1);
            }));
            if (!ok) continue;
            const qy = sd * (GHW + GTR + KB), A = lok(v, s, qy), B = lok(v, s + 8, qy), I = lok(v, s, qy - sd);
            const Z = [(B[0] - A[0]) / 8, (B[1] - A[1]) / 8], X = [I[0] - A[0], I[1] - A[1]], fram = X[0] * Z[1] - X[1] * Z[0] > 0;   // lokala x = (Zz, −Zx) ska peka mot gatan
            const [o, zd] = fram ? [A, Z] : [B, [-Z[0], -Z[1]]];
            bitar.push({ x: o[0], z: o[1], ry: Math.atan2(zd[0], zd[1]), dy: 0.012 });
          }
        }));
        N.extra.push(FAB.kantsten(bitar, hy));
        if (FODL.length) N.extra.push(FAB.odling(FODL));
      }
      yield;
      N.extra.push(VP.grupp(VP.villa({ mal, hy, ledig, iGata, svAv, latAv, pt, uppfarter, YT, husR, tomtD, ram: VRAM })));   // gräs och markväxter på tomterna (husritare-vaxter.js)
      if (BLK) {   // riktiga blommor, myllan i bäddarna och granitblocken (husritare-blommor.js, husritare-natur.js): 3–5 ritanrop
        [BLOM.grupp(BLP, 'blommor-villa'), BLOM.baddar(BLD, hy, 'rabatt-jord-villa')].forEach(o => o && N.extra.push(o));
        if (BLS.length) N.extra.push(NATUR.grupp(BLS, { namn: 'rabatt-sten', gra: 0.8 }));
        try { window.__blom = { villa: BLP.length, baddar: BLD.length, stenar: BLS.map(s => [+s.x.toFixed(2), +s.z.toFixed(2)]), grind: VRAM.latG != null ? [...pt(VRAM.svF + 0.3, VRAM.latG), ...pt(VRAM.svF - 3, VRAM.latG), ...pt(VRAM.svF, VRAM.latG + 1.5)] : null, rund: VRAM.rund || null, forsta: BLP.slice(0, 3).map(p => [p.art, +p.x.toFixed(2), +p.z.toFixed(2)]), lp: BLP.map(p => [p.art[0], +p.x.toFixed(1), +p.z.toFixed(1)]) }; } catch (e) { /* ingen window */ }
      }
      yield;
      const nat = grannNat(BD); if (nat) N.extra.push(nat);
      try { if (window.__villa) window.__villa.ph = PHV.reduce((o, p) => (o[p.m] = (o[p.m] || 0) + 1, o), {}); } catch (e) { /* ingen window */ }
      yield;
      if (PHV.length) N.extra.push(ph.grupp(PHV, 'ph-villa'));   // gatlyktor, brunnslock, sopkärl, buskar, krukor, slang, nisse, utemöbler (husritare-ph.js)
      // parkerade bilar: hos de två närmaste grannarna fulla modeller (bilteamets kopior: röd Volvo, blå Tesla),
      // längre bort de förenklade. Kopiorna laddas i bakgrunden; geometrin delas med vår bil (disponeras inte här).
      {
        // krockkoll: varje bil (orienterad rektangel med backspeglar) mot alla hinder och redan ställda bilar, med
        // 0,2 m luft. Krockar den flyttas den inom sin uppfart (längs och lite i sidled); går det inte tas den bort.
        const HK = HIND.slice(), w = (dsv, dlat) => [n[0] * dsv + t[0] * dlat, n[1] * dsv + t[1] * dlat];
        husR.forEach(h => { const [x, z] = pt(h.sv, h.lat), [ux, uz] = w(h.ax[0], h.ax[1]); HK.push({ typ: 'hus', x, z, ux, uz, hx: h.L / 2, hz: h.W / 2 }); });
        const PHR2 = { shrub_02: 0.5, metal_trash_can: 0.35, street_lamp_01: 0.25, garden_gnome: 0.15, planter_pot_clay: 0.2, garden_sprinkler_01: 0.12 };
        PHV.forEach(q => { if (PHR2[q.m]) HK.push({ typ: q.m, x: q.x, z: q.z, ux: 1, uz: 0, hx: PHR2[q.m], hz: PHR2[q.m] }); });
        const krock = (A, B, m) => {
          const dx = B.x - A.x, dz = B.z - A.z;
          for (const [ax, az] of [[A.ux, A.uz], [-A.uz, A.ux], [B.ux, B.uz], [-B.uz, B.ux]]) {
            const ra = A.hx * Math.abs(ax * A.ux + az * A.uz) + A.hz * Math.abs(-ax * A.uz + az * A.ux), rb = B.hx * Math.abs(ax * B.ux + az * B.uz) + B.hz * Math.abs(-ax * B.uz + az * B.ux);
            if (Math.abs(dx * ax + dz * az) > ra + rb + m) return false;
          }
          return true;
        };
        const stallda = [], KOLL = { flyttade: 0, borttagna: 0, luft: 0.2 };
        const stall = b => {
          if (!BILKOLL) { stallda.push(bilRekt(b.x, b.z, b.ry)); return true; }
          const ry = b.ry, ez = [Math.sin(ry), Math.cos(ry)], ex = [Math.cos(ry), -Math.sin(ry)], [lo, hi] = b.upp || [-1.5, 1.5];
          const langs = [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6, 0.8, -0.8, 1.1, -1.1, 1.5, -1.5].filter(d => d >= lo - 1e-6 && d <= hi + 1e-6), sid = b.upp ? [0, 0.2, -0.2, 0.35, -0.35] : [0];
          for (const dl of langs) for (const ds of sid) {
            const x = b.x + ez[0] * dl + ex[0] * ds, z = b.z + ez[1] * dl + ex[1] * ds, R = bilRekt(x, z, ry);
            if (HK.some(h => krock(R, h, KOLL.luft)) || stallda.some(o => krock(R, o, 0.4))) continue;
            if (dl || ds) KOLL.flyttade++;
            stallda.push(R); b.x = x; b.z = z; return true;
          }
          KOLL.borttagna++;
          { const R = bilRekt(b.x, b.z, ry), h = HK.find(q => krock(R, q, KOLL.luft)); (KOLL.orsak || (KOLL.orsak = [])).push([+b.x.toFixed(1), +b.z.toFixed(1), h ? h.typ : 'bil']); }
          return false;
        };
        const RIKTIGA = [['volvo', '#b3121b'], ['tesla', '#1f4fa8']], grp = new THREE.Group(); grp.name = 'grannbilar';
        const PARKOK = PARK.sort((a, b) => a.d - b.d).filter(stall);
        BILK.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).filter(stall).forEach(b => LODB.push({ x: b.x, y: hy(b.x, b.z), z: b.z, ry: b.ry, typ: b.typ, farg: b.farg }));
        BILK.length = 0;
        try { if (window.__villa) Object.assign(window.__villa, { bilKoll: KOLL, hinder: HK.map(h => [h.typ, +h.x.toFixed(2), +h.z.toFixed(2), +h.ux.toFixed(4), +h.uz.toFixed(4), +h.hx.toFixed(2), +h.hz.toFixed(2)]), bilMatt: [BIL_HX, BIL_HZ] }); } catch (e) { /* ingen window */ }
        PARKOK.forEach((b, i) => {
          const rk = i < RIKTIGA.length && b.d < 60 && typeof bil.kopia === 'function' ? RIKTIGA[i] : null;
          if (!rk) { LODB.push({ x: b.x, y: hy(b.x, b.z), z: b.z, ry: b.ry, typ: rB() < 0.5 ? 'tesla' : 'volvo', farg: LACK[rB() * LACK.length | 0] }); return; }
          // samma bil i förenklad modell syns tills kameran kommer nära (narBilar, 26 m): först då den fulla (88–150k trianglar)
          const y = hy(b.x, b.z), nb = { x: b.x, z: b.z, lod: typeof bil.lodBilar === 'function' ? bil.lodBilar([{ x: b.x, y, z: b.z, ry: b.ry, typ: rk[0], farg: rk[1] }]) : null, full: null };
          if (nb.lod) grp.add(nb.lod);
          NARBIL.push(nb);
          bil.kopia(rk[0], rk[1]).then(o => { if (!o) return; o.position.set(b.x, y, b.z); o.rotation.y = b.ry; o.traverse(q => { q.userData.egen = false; }); o.visible = !nb.lod; nb.full = o; nb.nara = !nb.lod; grp.add(o); }).catch(() => {});
        });
        N.extra.push(grp);
      }
      // glaset i grannhusens fönster och dörrar: samma material som attefallshusens glas (mörkt, blankt, speglar himlen
      // via scenens miljökarta, halvgenomskinligt över det målade rummet med gardiner), alla rutor i ett instansierat nät
      yield;
      if (RUT.length) {
        const gm = egenMat('grannGlas', () => new THREE.MeshStandardMaterial({ color: 0x172028, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 1.9 }));   // tydligare spegling av himlen (scene.environment)
        const q = new THREE.Quaternion(), M3 = new THREE.Matrix4();
        const L = RUT.map(g => { const bx = new THREE.Vector3(...g.t), bz = new THREE.Vector3(...g.n), by = new THREE.Vector3().crossVectors(bz, bx); M3.makeBasis(bx, by, bz); q.setFromRotationMatrix(M3); return { m: new THREE.Matrix4().compose(new THREE.Vector3(...g.p), q, new THREE.Vector3(g.b, g.h, 1)) }; });
        const pg = GEO.ruta || (GEO.ruta = spara(new THREE.PlaneGeometry(1, 1)));
        const gi = instanser('grannglas', pg, gm, L, false, false);
        if (gi) { gi.renderOrder = 2; gi.userData.egen = false; N.extra.push(gi); }
      }
      yield;
      N.extra.push(...grannhus(lod));
      // busshållplats på bortre trottoaren och en vägskylt vid korsningen (utan text)
      yield;
      ting1('kur', HU + GHW + GTR - 0.9, -sg * 40, ryMot(-1, 0));
      yield;
      ting1('hallplats', HU + GHW + 0.5, -sg * 36.5, ryMot(-1, 0));
      yield;
      ting1('skylt', HU - GHW - GTR + 0.5, LS - sg * (GHW + GTR - 0.4), ryMot(1, 0));
      yield;
      { const FB = fabBjorkar(V, 14, 95); if (FB.length) N.extra.push(FAB.bjorkar(FB)); naraTrad(V, Math.max(0, 2 - FB.length), 70, ["bjork"]); }   // trädgårdarnas björkar blir riktiga 3D-träd (Fab-björkar), granar och tallar förblir kort
      const imp = impNara(V.barr, ['gran', 'ek', 'tall', 'bjork'], F.atlas); if (imp) N.extra.push(imp);
      V.barr = [];
    }
    if (LODB.length && typeof bil.lodBilar === 'function') N.extra.push(bil.lodBilar(LODB));
    const tm = vegMesh('ting', TS, egenMat('ting', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), { glod: true })), true, true);
    if (tm) N.extra.push(tm);
    N.extra.push(vagDetaljer(mal, V, hy, 'villa'));   // elstolpar med ledningar i bakgrunden
    lampor(V.bark, N.glod, mal, hy, false);
    mat('flack').color.set('#26300f'); mat('flack').opacity = 0.75;
    return N;
  }

  // ---- Skog och Vinter (barrskog runt en glänta) ----
  function* barrskogFjarrG(sno) {   // stegvis (se byggG)
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
    yield;
    for (let i = 0, n = sno ? 380 : 420; i < n; i++) {
      if (!(i & 31)) yield;
      const a = (i + r()) / n * Math.PI * 2, d = 52 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const k = 0.75 + 0.5 * fbm(Math.cos(a) * 3 + 7, Math.sin(a) * 3);
      if (r() < (sno ? 0.08 : 0.14)) trad('tall1', x, z, (15 + r() * 6) * k); else trad('gran2', x, z, (12 + r() * 10) * k);
    }
    yield;
    const FB = sno ? [] : fabBjorkar(V, 2, 40);   // sommar: gläntans två närmaste björkar som Fab-björkar (vintern har kala björkar)
    const T = yield* tradenG(V, sno ? ['granSno', 'tallSno', 'bjorkKal'] : ['gran', 'tall', 'bjork'], 1);   // ett nära 3D-träd (trianglar)
    return {
      bark: packa(V.bark), lov: packa(slaIhop(V.nara, V.fjarr)), klung: V.klung, mark: packa(V.mark), barr: T.mesh, atlas: T.atlas, flack, drivor, upp,
      extra: FB.length ? [behall(FAB.bjorkar(FB))] : [],
      liv: { fall: behall(fallande(sno ? 'sno' : 'barr')), dimma: sno ? null : behall(dimslojor(r, krav)) },
    };
  }
  // ---- skogsmarken med skannade modeller (husritare-natur.js): ormbunkar och mossa vid stammarna, mossiga block,
  // stubbar, en liggande död stock och torra grenar. Allt står på marken (foten sjunker lite in), håller avstånd till
  // huset, gången och uppfarten (krav, iVagJS), till träden (upp) och stenarna och till varandra.
  // o: { r, hy, ok(x, z, klass), upp, sten: [[x, z, radie]], rMin, rMax, sno, antal: skala på mängden, mitt: [x, z] (ringens mitt) }
  function skogsmark(o) {
    const { r, hy, ok, upp = [], sno = false, rMin = 10, rMax = 46, antal = 1, mitt = [0, 0], vinkel = null } = o;
    const ut = [], tagna = (o.sten || []).map(([x, z, a]) => ({ x, z, a }));
    const svag = SVAGMARK ? 0.6 : 1, N = k => Math.max(k ? 1 : 0, Math.round(k * antal * svag));
    const ledig = (x, z, a) => tagna.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.a + a) ** 2) && !iVagJS(x, z, 3.5 + a);
    const tradFri = (x, z, a) => upp.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (Math.min(p.a, 3) * 0.25 + a + 0.4) ** 2);
    const punkt = () => {
      const a = vinkel ? vinkel[0] + (r() - 0.5) * 2 * vinkel[1] : r() * 6.2832, d = Math.sqrt(rMin * rMin + r() * (rMax * rMax - rMin * rMin));
      return [mitt[0] + Math.cos(a) * d, mitt[1] + Math.sin(a) * d];
    };
    const lagg = (id, x, z, a, s, extra = {}) => { tagna.push({ x, z, a }); ut.push({ id, x, y: hy(x, z), z, ry: r() * 6.2832, s, ...extra }); };
    // höjden under hela foten: lägsta punkten (inget svävar på en sluttning)
    const fot = (x, z, a) => Math.min(hy(x, z), hy(x + a, z), hy(x - a, z), hy(x, z + a), hy(x, z - a));
    const sattFritt = (id, n, a, klass, smin, smax, nara = false) => {
      for (let f = 0, k = 0; f < n * 60 && k < n; f++) {
        let x, z;
        if (nara && upp.length) { const t = upp[(r() * upp.length) | 0], v = r() * 6.2832, d = Math.min(t.a, 3) * 0.3 + 0.6 + r() * 2.2; x = t.x + Math.cos(v) * d; z = t.z + Math.sin(v) * d; const rr = Math.hypot(x - mitt[0], z - mitt[1]); if (rr < rMin || rr > rMax) continue; }
        else [x, z] = punkt();
        const s = smin + r() * (smax - smin);
        if (!ok(x, z, klass) || !ledig(x, z, a * s) || !tradFri(x, z, a * s * 0.5)) continue;
        tagna.push({ x, z, a: a * s }); ut.push({ id, x, y: fot(x, z, a * s * 0.6), z, ry: r() * 6.2832, s, lx: (r() - 0.5) * 0.12, lz: (r() - 0.5) * 0.12 }); k++;
      }
    };
    if (!sno) {
      // ormbunkar i klungor vid stammarna (skuggan), mosstuvor vid rötterna och kring blocken, torra grenar på marken
      for (let c = 0, f = 0; c < N(7) && f < 400; f++) {
        const t = upp.length ? upp[(r() * upp.length) | 0] : null; if (!t) break;
        const v = r() * 6.2832, d = Math.min(t.a, 3) * 0.35 + 1 + r() * 2.5, cx = t.x + Math.cos(v) * d, cz = t.z + Math.sin(v) * d, rr = Math.hypot(cx - mitt[0], cz - mitt[1]);
        if (rr < rMin || rr > rMax || !ok(cx, cz, 'lag')) continue;
        for (let k = 0, n = 2 + (r() * 2.5 | 0); k < n; k++) {
          const x = cx + (r() - 0.5) * 2.8, z = cz + (r() - 0.5) * 2.8, s = 0.75 + r() * 0.55;
          if (!ok(x, z, 'lag') || !ledig(x, z, 0.4 * s) || !tradFri(x, z, 0.2)) continue;
          lagg('fern_02', x, z, 0.45 * s, s);
        }
        c++;
      }
      sattFritt('moss_01', N(34), 0.25, 'lag', 0.7, 1.6, true);
      sattFritt('dry_branches_medium_01', N(4), 0.8, 'lag', 0.8, 1.2);
    }
    // mossiga block (vinter: kala stenar med snö ovanpå), stubbar
    if (!sno) { sattFritt('rock_moss_set_01', N(3), 2.1, 'liten', 0.75, 1.2); sattFritt('rock_moss_set_02', N(3), 1.8, 'liten', 0.75, 1.2); }
    else { sattFritt('stone_01', N(3), 0.7, 'liten', 0.8, 1.3); sattFritt('rock_07', N(3), 0.5, 'liten', 0.8, 1.4); sattFritt('rock_09', N(3), 0.6, 'liten', 0.8, 1.3); }
    sattFritt('tree_stump_01', N(2), 0.5, 'liten', 0.8, 1.2, true);
    sattFritt('tree_stump_02', N(2), 0.5, 'liten', 0.8, 1.2, true);
    // en liggande död stock (och i stora skogar en till): längs marken, lutad efter sluttningen, fritt längs hela längden
    for (const [id, L] of [['dead_tree_trunk', 6], ['dead_tree_trunk_02', 4.6]].slice(0, antal >= 1 && !SVAGMARK ? 2 : 1)) {
      for (let f = 0; f < 200; f++) {
        const [x, z] = punkt(), ry = r() * 6.2832, s = 0.85 + r() * 0.25, l = L * s / 2, ux = Math.cos(ry), uz = -Math.sin(ry);
        let fri = true;
        for (let t = -1; t <= 1.001 && fri; t += 0.25) { const px = x + ux * l * t, pz = z + uz * l * t; fri = ok(px, pz, 'liten') && ledig(px, pz, 0.5) && tradFri(px, pz, 0.3); }
        if (!fri) continue;
        const h0 = hy(x - ux * l, z - uz * l), h1 = hy(x + ux * l, z + uz * l), hm = hy(x, z);
        if (Math.abs(h1 - h0) > 0.9 || hm - (h0 + h1) / 2 > 0.25) continue;   // för brant eller en kulle mitt under (skulle sväva i ändarna)
        for (let t = -1; t <= 1.001; t += 0.5) tagna.push({ x: x + ux * l * t, z: z + uz * l * t, a: 0.6 });
        ut.push({ id, x, y: Math.min(hm, (h0 + h1) / 2), z, ry, s, lz: Math.atan2(h1 - h0, 2 * l) });
        break;
      }
    }
    return ut;
  }
  // ogräs och buskar i trädgårdens kanter (husritare-natur.js): nässlor, syror och ogräs i klungor, några maskrosor
  // och låga buskar; som skogsmarken fritt från huset, gången, uppfarten, träden och stenarna
  function kantvaxter(o) {
    const { r, hy, ok, upp = [], rMin = 12, rMax = 30 } = o, ut = [], tagna = (o.sten || []).map(([x, z, a]) => ({ x, z, a }));
    const svag = SVAGMARK ? 0.6 : 1, N = k => Math.max(1, Math.round(k * svag));
    const fri = (x, z, a) => tagna.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.a + a) ** 2) && upp.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > (Math.min(p.a, 3) * 0.3 + a + 0.3) ** 2) && !iVagJS(x, z, 3 + a);
    const punkt = () => { const a = r() * 6.2832, d = Math.sqrt(rMin * rMin + r() * (rMax * rMax - rMin * rMin)); return [Math.cos(a) * d, Math.sin(a) * d]; };
    const klunga = (ids, n, k0, k1, a, smin, smax) => {
      for (let c = 0, f = 0; c < n && f < n * 40; f++) {
        const [cx, cz] = punkt(); if (!ok(cx, cz, 'lag') || !fri(cx, cz, a)) continue;
        for (let k = 0, m = k0 + (r() * (k1 - k0 + 1) | 0); k < m; k++) {
          const x = cx + (r() - 0.5) * 1.6, z = cz + (r() - 0.5) * 1.6, s = smin + r() * (smax - smin), id = ids[(r() * ids.length) | 0];
          if (!ok(x, z, 'lag') || !fri(x, z, a * s)) continue;
          tagna.push({ x, z, a: a * s }); ut.push({ id, x, y: hy(x, z), z, ry: r() * 6.2832, s });
        }
        c++;
      }
    };
    klunga(['nettle_plant'], N(2), 2, 3, 0.3, 0.8, 1.2);
    klunga(['shrub_sorrel_01', 'weed_plant_02'], N(5), 2, 4, 0.2, 0.8, 1.3);
    klunga(['dandelion_01'], N(2), 1, 2, 0.12, 0.8, 1.2);
    klunga(['shrub_03', 'shrub_04'], N(2), 1, 2, 0.5, 0.8, 1.2);
    return ut;
  }
  function barrskogNara(mal, F, sno) {
    const r = slump(sno ? 303 : 202), { krav, kant } = regler(mal), upp = F.upp;
    const hy = sno ? hojdVinter : hojdSkog, { V, flack, vaxt, matta, trad } = verktyg(r, hy, mal.blockerad, sno), N = narSet(V, flack);
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
    if (sno) { mat('flack').color.set('#9fb2d4'); mat('flack').opacity = 0.32; }   // snö: bara en svag blå skugga under träden (inte en mörk skiva) else { mat('flack').color.set('#1d2010'); mat('flack').opacity = 0.8; }
    // skogen: gång av natursten (gråare, mer oregelbunden); i vintern ligger gången under snön (trampad)
    // kväll: stolplampor längs gången i båda; skogen får dessutom varm dis kring gången närmast huset
    tomtGrund(mal, V, N, slump(4646), hy, trad, sno ? 'vinter' : 'skog');   // vår tomt: rabatter, buxbom och gärdsgård
    if (!sno) N.extra.push(bjvGrupp(bjvPoster(mal, hy, slump(4747), 'skog')));
    N.extra.push(vagDetaljer(mal, V, hy, sno ? 'vinter' : 'skog'));   // elstolpar med ledningar bakom huset, vägräcke i uppfartens böj
    if (!sno) N.extra.push(VP.grupp(VP.skog({ mal, hy, sten: stenPunkter(N.sten) })));   // starr och gräs i gläntan (husritare-vaxter.js); vintern utan
    N.extra.push(NATUR.grupp(skogsmark({ r: slump(sno ? 5303 : 5202), hy, ok: krav, upp, sten: stenPunkter(N.sten), sno, rMin: 10, rMax: 46 }), { sno }));   // skannad skogsmark (husritare-natur.js)
    { const LS = samling(); lampor(LS, N.glod, mal, hy, sno, !sno); const m = vegMesh('ting', LS, egenMat('ting', () => vegPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), { glod: true })), true, true); if (m) N.extra.push(m); }   // pollarna utan barkens rastrering (som trädgården)
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
      const steg = s => { const c = d.himmel[s].clone(); if (s === 'hor') c.multiplyScalar(0.9); else if (s === 'mid') c.multiplyScalar(0.96); if (mork) c.lerp(MORK, 0.12 + 0.5 * mjuk(0.15, 0.7, kv));   /* mörkt tema: dagshimlen hålls klar, mörknar först i skymningen */ return c.lerp(G[s], guld * (s === 'hor' ? 0.75 : 0.5)).lerp(KV[s], natt); };
      const top = steg('top'), mid = steg('mid'), hor = steg('hor'), ca = himmelGeo.attributes.color, t = new THREE.Color(), varm = C('#ffe2bf');
      const sol = tillstand.sol, sx = sol ? sol.x : 0, sz = sol ? sol.z : 0, sl = Math.hypot(sx, sz) || 1;
      for (let i = 0; i < himmelT.length; i++) {
        const y = himmelT[i];
        if (y < 0.1) t.copy(hor).lerp(mid, mjuk(0, 0.1, y));
        else t.copy(mid).lerp(top, Math.pow((y - 0.1) / 0.9, 0.6));
        tmpV.fromBufferAttribute(hpos, i).normalize();
        if (sol) t.lerp(varm, Math.pow(Math.max(0, tmpV.dot(sol)), 8) * (0.35 + guld * 0.4) * (1 - natt));
        if (sol && aktuell === 'kust') t.lerp(varm, Math.pow(Math.max(0, tmpV.dot(sol)), 3) * 0.16 * (1 - natt));   // vid sjön: ett brett, mjukt sommarsken runt solen
        if (sol && guld > 0.01 && y < 0.3) {
          const hl = Math.hypot(tmpV.x, tmpV.z) || 1, rikt = Math.max(0, (tmpV.x * sx + tmpV.z * sz) / (hl * sl));
          band.copy(MJUKBLA).lerp(PERSIKA, Math.pow(rikt, 2.6)).lerp(BARNSTEN, Math.pow(rikt, 9));
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
      HU.uKum.value = HU.kumMap.value ? (d.kum || 0) * (1 - natt * 0.7) : 0;
      // fjärran vid sjön (målade kort, inget ljus): varmare i gyllene timmen, mörknar med natten
      if (kustBak) kustBak.mat.color.set('#ffffff').lerp(C('#ffcf9e'), guld * 0.45).multiplyScalar((1 - kv * 0.72) * (1 - natt * 0.92) * (mork ? 0.7 : 1));
      HU.molnFarg.value.set('#ffffff').lerp(hor, 0.25).lerp(C('#f3c6a6'), guld * 0.6).lerp(C('#2e3550'), natt);
      if (mork) HU.molnFarg.value.lerp(MORK, 0.1 + 0.4 * mjuk(0.15, 0.7, kv));
    } else {
      bg.copy(mork ? MORK : d.bg).lerp(d.kvallBg, kv * 0.92);
    }
    VU.uStjarnor.value = d.himmel ? mjuk(0.6, 0.95, kv) * 1.1 : 0;
    // solskivan (dag till tidig kväll; solljusets riktning glider mot månen efter kvall 0,6) och månen
    if (tillstand.sol) HU.uSolD.value.copy(tillstand.sol);
    HU.uSolSyn.value = d.himmel && tillstand.sol ? (1 - mjuk(0.48, 0.6, kv)) * (mork ? 0.6 : 1) * (aktuell === 'studio' ? 0.5 : 1) : 0;
    HU.uStral.value = HU.uSolSyn.value * (aktuell === 'kust' ? 1 : 0.6) * (1 - guld * 0.4);   // halo och strålkrans runt solen
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
    ['asfalt', 'trottoar', 'brygga'].forEach(k => { if (MAT[k]) { golv(MAT[k].color); if (k === 'trottoar') MAT[k].color.multiply(C('#dcd8d0')); } });
    // vattnet: speglingen av himlen dämpas med kvällen (omgivningskartan är dagens himmel), djupet blir mörkblått
    // lite mindre himmel i speglingen, så att vattnets egen blågröna ton syns
    if (MAT.strandsten) MAT.strandsten.envMapIntensity = (1 - natt * 0.85) * (mork ? 0.7 : 1);   // skannade stenar: omgivningsljuset är dagens himmel
    if (MAT.vatten) { MAT.vatten.envMapIntensity = 0.78 * (1 - natt * 0.8) * (mork ? 0.7 : 1); MAT.vatten.color.set('#1c4550').lerp(C('#0b1622'), natt * 0.9); }
    // glittervägen: varm sol på dagen och i gyllene timmen, svagt blå i månskenet (ljusets riktning glider mot månen)
    { const sy = tillstand.sol ? tillstand.sol.y : 0.5, syn = mjuk(-0.02, 0.08, sy) * (mork ? 0.6 : 1);
      GLITTER.value.setRGB(1, 0.92 - 0.25 * guld, 0.75 - 0.4 * guld).multiplyScalar((1 - natt) * (1 + guld * 0.6)).lerp(new THREE.Color(0.32, 0.4, 0.6), natt).multiplyScalar(syn * (aktuell === 'kust' ? 1.35 : 1)); }   // vid sjön en starkare glitterväg
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
    let mal = matt(H); mal.namn = namn;
    const ny = [namn, mal.L, mal.W, mal.dorr.x, mal.dorr.z, mal.dorr.nx, mal.dorr.nz, mal.dack ? Object.values(mal.dack).map(v => v.toFixed(2)).join(',') : '-', mal.top.toFixed(2)].join('|');
    VU.uHus.value.set(mal.L / 2, mal.W / 2, mal.top, 0);
    if (STEG.vill && STEG.vill.namn !== namn) STEG.vill = null;          // ett nytt val avbryter det väntande bytet
    if (ny === nyckel) return;
    // stegvist byte: en miljö visas redan och den nya saknar sitt fjärrset → det byggs i små steg i ledig tid
    // (byggG), den gamla står kvar tills den nya är klar och programmen kompilerade; sedan byts det på en gång
    if (STEG.pa && !STEG.tvinga && nyckel && aktuell !== namn && DEF[namn].fjarr && (!FJ[namn] || DEF[namn].naraG)) { starta(namn, H); return; }
    const tm = STEG.tid ? [performance.now()] : null, mt = k => { if (tm) { const t = performance.now(); STEG.tid[k] = Math.round(t - tm[0]); tm[0] = t; } };
    // nära setet kan vara räknat i förväg av det stegvisa bygget (samma hus): då används dess mal och bilplats
    const fore = STEG.tvinga && STEG.fore && STEG.fore.namn === namn && STEG.fore.H === H ? STEG.fore : null;
    STEG.fore = null;
    if (fore) { mal = fore.mal; bil.planeraTill(fore.B); }
    else bil.planera(mal, H);                // bilens plats; utökar mal.blockerad innan naturen placeras
    mt('planera');
    { const Pv = bil.plats(); if (Pv && Pv.vag && namn !== 'villa' && namn !== 'studio') { VU.uVagA.value.set(Pv.vag.x0, Pv.vag.z0, Pv.n[0], Pv.n[1]); VU.uVagB.value.set(Pv.t[0], Pv.t[1], Pv.vag.sida || 1, 120); } else VU.uVagB.value.w = 0; }
    nyckel = ny; aktuell = namn;
    const d = DEF[namn], b = hamta(namn);
    mark.geometry = b.geo; mark.material = b.mat;
    himmel.visible = !!d.himmel;
    studioRida.visible = !!d.rida;
    if (d.kum && !HU.kumMap.value) HU.kumMap.value = kumulus();      // stackmoln (kust, trädgård, villaområdet)
    if (namn === 'kust') kustBakgrund().mesh.visible = true;
    else if (kustBak) kustBak.mesh.visible = false;
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
      mt('fore');
      const N = fore && fore.F === F ? fore.N : d.nara(mal, F); mt('nara');
      kuliss = montera(namn, F, N); kuliss.matrixAutoUpdate = false; rot.add(kuliss); livObj = kuliss.userData.liv || {};
      mt('montera');
    }
    VU.uSno.value = namn === 'vinter' ? 1 : 0;
    HALL.value = namn === 'kust' ? 1 : 0;
    if (MAT.faglar) MAT.faglar.color.set(namn === 'kust' ? '#6b737c' : '#2b2e33');   // vid sjön: måsar, i motljus mot himlen (vita syntes som prickar)
    VU.uVind.value.set(0.94, 0.33).multiplyScalar(d.vind || 0);
    byggGrund(namn, mal); mt('grund');
    mal.hy = d.hojd || (() => 0);            // markens höjd, så att uppfarten följer backarna
    bil.satt(namn, mal); mt('bil');
    bebott.satt(namn, mal, bil.plats()); mt('bebott');
    uppdatera(); mt('uppdatera');
    renderer.shadowMap.needsUpdate = true;
  }
  // ---- skuggarprogrammen kompileras parallellt innan något ritas ----
  // Ett nät vars program inte är färdigt låser annars hela bilden medan drivrutinen länkar (vid miljöbyte 5–7 s
  // med ~45 nya program, och en ny frysning varje gång en lat fil – Poly Haven, Fab, skannad natur – fylls i).
  // Nya nät under miljön kompileras med renderer.compile (KHR_parallel_shader_compile: blockerar inte), hålls
  // utanför alla kameror (lagermask 0, även skuggkameran) tills programmen är klara och släpps sedan in tillsammans
  // (efter 1,5 s de som är klara, så att inget väntar på det långsammaste). Kontrollen räknar bara näten (billig)
  // och kompilerar enbart de nya.
  const VARM = { djupKopia: new WeakMap(), kam: (() => { const k = new THREE.PerspectiveCamera(); k.layers.mask = 3; return k; })(), sett: new WeakSet(), vantar: new Map(), n: -1, tid: 0, t0: 0 };
  try { if (/[?&]prov=1/.test(location.search)) { VARM.logg = []; window.__varm = VARM; VARM.rend = renderer; VARM.scen = scene; } } catch (e) { /* utan fönster */ }   // för provbilder
  const harKlar = m => { const P = renderer.properties.get(m).programs; if (!P) return true; for (const p of P.values()) if (!p.isReady()) return false; return true; };   // alla varianter (huvudbild, spegling)
  const matKlar = o => (Array.isArray(o.material) ? o.material.every(harKlar) : harKlar(o.material)) && (!o.castShadow || ((!o.customDepthMaterial || harKlar(o.customDepthMaterial)) && (!o.userData.djupProxy || harKlar(o.userData.djupProxy))));
  function varma() {
    if (VARM.av) return;
    // programmens nycklar hänger på tonmappningen, omgivningskartan och dimman (motorn byter dem efter satt):
    // när de ändras kompileras alla nät om (de som redan finns hittas i cachen, bara de nya kostar)
    const env = scene.environment, nyck = renderer.toneMapping + '|' + (env ? env.uuid : '-') + '|' + (scene.fog ? scene.fog.isFogExp2 ? 2 : 1 : 0) + '|' + renderer.outputColorSpace;
    if (nyck !== VARM.nyck) { VARM.nyck = nyck; VARM.sett = new WeakSet(); }
    const nya = []; let n = 0;
    rot.traverse(o => { if (!(o.isMesh || o.isPoints) || !o.material) return; n++; if (!VARM.sett.has(o)) { VARM.sett.add(o); nya.push(o); } });
    VARM.n = n;
    if (!nya.length) return;
    try { kompilera(nya, aktuell === 'kust'); } catch (e) { VARM.av = true; console.warn('miljö: förkompileringen', e); return; }
    let fler = false;
    nya.forEach(o => { if (!matKlar(o)) { VARM.vantar.set(o, o.layers.mask); o.layers.mask = 0; fler = true; } });
    if (VARM.logg) VARM.logg.push([Math.round(performance.now()), nya.length, VARM.vantar.size]);
    if (fler && !VARM.tid) { VARM.t0 = performance.now(); VARM.tid = setTimeout(kollaVarm, 16); }
  }
  // nya nät (behöver inte sitta i scenen) kompileras parallellt med scenens ljus, dimma och omgivningskarta
  function kompilera(nya, spegel) {
      // compile() tar antalet klippplan från det objekt som ritades senast (inredningen klipps): nollställ
      // klippläget genom att rita ett osynligt objekt utan plan till en 1 × 1-buffert, annars blir nycklarna fel
      if (!VARM.att) {
        VARM.att = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
        VARM.att.frustumCulled = false; VARM.rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
      }
      const fore = renderer.getRenderTarget(), sk = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate = false;
      try { renderer.setRenderTarget(VARM.rt); renderer.render(VARM.att, VARM.kam); } finally { renderer.setRenderTarget(fore); renderer.shadowMap.needsUpdate = sk; }
      renderer.compile({ traverse: f => nya.forEach(f), traverseVisible: () => {} }, VARM.kam, scene);
      if (spegel) SJO.forvarm(nya, scene);                                 // speglingens varianter
      // skuggpassets egna djupmaterial (customDepthMaterial): skuggpasset sätter sida, karta och alfatest från
      // nätets material och ritar till skuggkartan utan dimma och omgivningskarta – samma läge här, annars
      // länkades de första gången skuggan ritades om (0,3–0,5 s)
      const djup = [];
      nya.forEach(o => {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!o.castShadow || !o.isMesh || !m) return;
        // utan eget djupmaterial använder skuggpasset en kopia av sitt inbyggda (RGBA-packat); programmet delas via
        // nyckeln, så en egen likadan kopia förkompilerar det (en per material)
        const dm = o.customDepthMaterial || o.userData.djupProxy || (o.userData.djupProxy = VARM.djupKopia.get(m) || (VARM.djupKopia.set(m, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })), VARM.djupKopia.get(m)));
        dm.side = m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : m.side === THREE.FrontSide ? THREE.BackSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide;
        dm.alphaMap = m.alphaMap; dm.alphaTest = m.alphaTest; dm.map = m.map;
        const t = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, dm, 1) : new THREE.Mesh(o.geometry, dm);
        t.receiveShadow = o.receiveShadow; t.castShadow = true; djup.push(t);
      });
      if (djup.length) {
        const env = scene.environment, fog = scene.fog;
        scene.environment = null; scene.fog = null; renderer.setRenderTarget(VARM.rt);
        try { renderer.compile({ traverse: f => djup.forEach(f), traverseVisible: () => {} }, VARM.kam, scene); }
        finally { scene.environment = env; scene.fog = fog; renderer.setRenderTarget(fore); djup.forEach(t => { if (t.isInstancedMesh) t.dispose(); }); }
      }
  }
  function kollaVarm() {
    VARM.tid = 0;
    const fri = performance.now() - VARM.t0 > 1500, klara = [];
    let alla = true;
    for (const [o, mask] of VARM.vantar) {
      let r = o; while (r.parent) r = r.parent;
      if (r !== scene) { VARM.vantar.delete(o); continue; }          // borttaget under tiden
      if (matKlar(o)) klara.push([o, mask]); else alla = false;
    }
    if (alla || fri) {
      klara.forEach(([o, mask]) => { o.layers.mask |= mask; VARM.vantar.delete(o); });
      if (klara.length) { renderer.shadowMap.needsUpdate = true; try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ } }
    }
    if (VARM.vantar.size) VARM.tid = setTimeout(kollaVarm, 16);
  }
  // lata fyllningar (Poly Haven, Fab, skannad natur, folk) kommer när som helst: titta efter nya nät några gånger i sekunden
  const varmKoll = setInterval(() => { try { varma(); } catch (e) { /* */ } }, 250);
  // ---- stegvisa bygget (miljöbyte utan långa rutor) ----
  // API (för motorn): miljo.steg(ms = 8) bygger vidare högst ms millisekunder och svarar true när inget väntar;
  // miljo.vantar() → namnet på miljön som byggs (eller null); miljo.forbered(namn, H) börjar bygga i förväg
  // (t.ex. vid hovring) utan att byta. Utan motorns hjälp driver en egen rAF-slinga bygget 8 ms per ruta.
  // När det är klart görs bytet (satt) och 'husritare:miljoklar' skickas (detail.namn), därefter 'husritare:nytt'.
  // ?stegvis=0 stänger av (bytet görs direkt, som förut).
  const VANTA = {};
  const STEG = { pa: (() => { try { return !/[?&]stegvis=0/.test(location.search); } catch (e) { return true; } })(), jobb: null, vill: null, raf: 0, sist: -1e9, tvinga: false };
  try { if (/[?&]prov=1/.test(location.search)) { window.__steg = STEG; STEG.tid = {}; } } catch (e) { /* utan fönster */ }   // för provbilder
  function* byggG(namn) {
    const d = DEF[namn];
    STEG.fas = 'sjotex'; if (namn === 'kust') yield* SJO.forberedG();   // vattnets texturer (våg, brus, djup)
    STEG.fas = 'mark'; const b = hamta(namn); yield;                     // marken
    if (!FJ[namn]) {
      STEG.fas = 'fjarr'; const F = d.fjarrG ? yield* d.fjarrG() : d.fjarr();
      yield;
      STEG.fas = 'fjarrNat'; fjarrNat(F); yield;
      // högst två fjärrset i grafikminnet (det som visas släpps aldrig här)
      const andra = FJ_ORD.filter(k => k !== namn && k !== aktuell && FJ[k]);
      while (andra.length && Object.keys(FJ).length >= 2) slappFJ(andra.shift());
      FJ[namn] = F;
    }
    STEG.fas = 'blom'; yield* BLOM.forberedG(); STEG.fas = 'bilsno'; yield* bil.forberedG(namn);   // blommornas atlas, snön på bilen
    STEG.fas = 'kompilera';
    // programmen för fjärrsetet och marken kompileras parallellt innan något visas
    const F = FJ[namn], lista = [];
    [F.barr, ...(F.nat || []), ...(F.extra || []), ...Object.values(F.liv || {})].forEach(o => o && o.traverse(c => { if ((c.isMesh || c.isPoints) && c.material) lista.push(c); }));
    const mm = new THREE.Mesh(b.geo, b.mat); mm.receiveShadow = mark.receiveShadow; lista.push(mm);
    if (!VARM.av) { try { kompilera(lista, namn === 'kust'); } catch (e) { console.warn('miljö: förkompileringen', e); } }
    STEG.fas = 'vanta'; for (let i = 0; i < 600 && !lista.every(matKlar); i++) yield VANTA;  // (högst ~10 s)
    // materialens texturer laddas upp till grafikkortet en i taget (annars alla i första bilden efter bytet)
    STEG.fas = 'texturer';
    yield* laddaUpp(lista);
    STEG.fas = 'nara';
    // nära setet (beror på huset och bilens plats) räknas också i förväg när bytet väntar: bilens plats räknas utan
    // att röra bilen som står (planeraBer); under varje steg gäller den nya platsen och uppfartens glänta, sedan den gamla
    const v = STEG.vill;
    if (v && v.namn === namn && d.naraG) {
      const mal = matt(v.H); mal.namn = namn;
      const B = bil.planeraBer(mal, v.H), g = d.naraG(mal, F);
      let st;
      do { st = medPlats(B, namn, () => g.next()); if (!st.done) yield; } while (!st.done);
      STEG.fore = { namn, H: v.H, mal, B, N: st.value, F };
      // nära setets färdiga nät (grannhus, sjöns ting, rekvisita …): program och texturer i förväg
      STEG.fas = 'naraKomp';
      const nl = []; (st.value.extra || []).forEach(o => o && o.traverse(c => { if ((c.isMesh || c.isPoints) && c.material) nl.push(c); }));
      if (nl.length && !VARM.av) { try { kompilera(nl, namn === 'kust'); } catch (e) { /* */ } }
      for (let i = 0; i < 300 && !nl.every(matKlar); i++) yield VANTA;
      yield* laddaUpp(nl);
    }
  }
  // materialens texturer laddas upp till grafikkortet en i taget (annars alla i första bilden efter bytet)
  function* laddaUpp(lista) {
    const tx = new Set();
    lista.forEach(o => (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.isRenderTargetTexture) tx.add(v); } }));
    for (const t of tx) { if (t.image) { try { renderer.initTexture(t); } catch (e) { /* */ } yield; } }
  }
  function medPlats(B, namn, fn) {
    const forra = bil.planNu(), a = VU.uVagA.value.clone(), b = VU.uVagB.value.clone();
    bil.planeraTill(B);
    { const Pv = B.plats; if (Pv && Pv.vag && namn !== 'villa' && namn !== 'studio') { VU.uVagA.value.set(Pv.vag.x0, Pv.vag.z0, Pv.n[0], Pv.n[1]); VU.uVagB.value.set(Pv.t[0], Pv.t[1], Pv.vag.sida || 1, 120); } else VU.uVagB.value.w = 0; }
    try { return fn(); } finally { bil.planeraTill(forra); VU.uVagA.value.copy(a); VU.uVagB.value.copy(b); }
  }
  function starta(namn, H) {
    STEG.vill = H ? { namn, H } : STEG.vill;
    if (!STEG.jobb || STEG.jobb.namn !== namn) STEG.jobb = { namn, g: byggG(namn), klar: false };
    driv();
  }
  function steg(ms = 8) {
    STEG.sist = performance.now();
    const J = STEG.jobb;
    if (!J) return true;
    const t0 = performance.now();
    try {
      while (performance.now() - t0 < ms) {
        const t1 = performance.now(), st = J.g.next(), dt = performance.now() - t1;
        if (STEG.tid && dt > 30) (STEG.lang = STEG.lang || []).push(J.namn + ':' + STEG.fas + ':' + Math.round(dt));
        if (st.done) { J.klar = true; break; } if (st.value === VANTA) break;
      }
    } catch (e) { console.warn('miljö: stegvisa bygget', e); J.klar = true; }
    if (!J.klar) return false;
    STEG.jobb = null;
    const v = STEG.vill;
    if (v && v.namn === J.namn) {
      STEG.vill = null; STEG.tvinga = true;
      const t2 = performance.now();
      try { satt(v.namn, v.H); } finally { STEG.tvinga = false; }
      if (STEG.tid) STEG.tid.satt = Math.round(performance.now() - t2);
      try { window.dispatchEvent(new CustomEvent('husritare:miljoklar', { detail: { namn: v.namn } })); window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ }
    }
    return !STEG.jobb;
  }
  function driv() {
    if (STEG.raf || typeof requestAnimationFrame !== 'function') return;
    const g = () => { STEG.raf = 0; if (!STEG.jobb) return; if (performance.now() - STEG.sist > 12) steg(8); if (STEG.jobb) STEG.raf = requestAnimationFrame(g); };
    STEG.raf = requestAnimationFrame(g);
  }
  const forbered = (namn, H) => { if (DEF[namn] && DEF[namn].fjarr && !FJ[namn] && namn !== aktuell) { if (!STEG.jobb) STEG.jobb = { namn, g: byggG(namn), klar: false }; driv(); } };
  // grannarnas fulla bilar: bara när kameran är nära (annars den förenklade); motorn anropar före varje bild
  const NARBIL = [];
  function narBilar(pos) {
    varma();                                 // nya lata nät hålls utanför bilden tills deras program är klara
    for (const nb of NARBIL) {
      if (!nb.full || !nb.lod) continue;
      const d2 = (pos.x - nb.x) ** 2 + (pos.z - nb.z) ** 2, nara = nb.nara ? d2 < 30 * 30 : d2 < 26 * 26;
      if (nara === nb.nara) continue;
      nb.nara = nara; nb.full.visible = nara; nb.lod.visible = !nara;
      renderer.shadowMap.needsUpdate = true;
    }
  }
  // Delar av miljön som kan vänta till efter första bilden (motorn döljer dem vid starten, kompilerar
  // deras program i vila och tonar in dem): allt utom livet och det som ligger helt inom 24 m från huset
  // (vår tomt: gräsmatta, gång, staket, stenar, tuvor). Tomma grupper (laddas ännu) räknas till de senare.
  const SENARE_B = new THREE.Box3(), SENARE_S = new THREE.Sphere();
  function senare() {
    if (!kuliss) return [];
    const liv = Object.values(kuliss.userData.liv || {});
    return kuliss.children.filter(o => {
      if (liv.includes(o)) return false;
      SENARE_B.setFromObject(o, false);
      if (SENARE_B.isEmpty()) return true;
      SENARE_B.getBoundingSphere(SENARE_S);
      return SENARE_S.center.length() + SENARE_S.radius > 24;
    });
  }
  function slapp() {
    NARBIL.length = 0;
    if (!kuliss) return;
    rot.remove(kuliss);
    // fjärrsetets delar (behall) lever kvar med hela sitt underträd till slappFJ/dispose(); förr städades barnen i
    // fjärrsetets grupper (holmar, sjöns ting, Poly Haven-stenar, Fab-björkar) vid varje byte och laddades upp på nytt
    const rensa = o => {
      if (o.userData.behall) return;
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); // folkets benkartor (en DataTexture per klon, läckte vid varje miljöbyte)
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.egen && o.geometry) o.geometry.dispose(); // även klonad geometri i instansade nät
      o.children.forEach(rensa);
    };
    kuliss.children.forEach(rensa);
    kuliss.clear(); kuliss = null; livObj = {};
  }
  const FJ = {}, FJ_ORD = [];                                 // fjärrset per miljö, senast använda sist
  function slappFJ(k) {
    const F = FJ[k];
    if (!F) return;
    [F.barr, ...(F.nat || []), ...(F.extra || []), ...Object.values(F.liv)].forEach(o => {
      if (!o) return;
      if (o.isInstancedMesh) o.dispose(); if (o.geometry) o.geometry.dispose();
      o.traverse(c => { if (c === o) return; if (c.isSkinnedMesh && c.skeleton) c.skeleton.dispose(); if (c.isInstancedMesh) c.dispose(); if (c.userData.egen && c.geometry) c.geometry.dispose(); });   // gruppernas barn
    });
    if (F.atlas) { F.atlas.rtF.dispose(); F.atlas.rtN.dispose(); [F.atlas.mat, F.atlas.naraMat].forEach(M => { if (M) { M.m.dispose(); M.dj.dispose(); } }); }
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
    clearInterval(varmKoll); clearTimeout(VARM.tid); VARM.vantar.clear();
    if (STEG.raf) cancelAnimationFrame(STEG.raf); STEG.jobb = STEG.vill = null;
    if (VARM.att) { VARM.att.geometry.dispose(); VARM.att.material.dispose(); VARM.rt.dispose(); }
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

  // bilKor('ut' | 'hem'), bilSteg(dt, { stopp }), bilLage(), bilParkera(): elbilen kör iväg och hem (husritare-bil.js)
  return { satt, steg, vantar: () => (STEG.vill ? STEG.vill.namn : null), forbered, uppdatera, lista, statistik, dispose, tick, narBilar, senare, harLiv, satLiv, bilKor: v => (typeof bil.kor === 'function' ? bil.kor(v) : 'hemma'), bilSteg: (dt, o) => (typeof bil.steg === 'function' ? bil.steg(dt, o) : false), bilLage: () => (typeof bil.lage === 'function' ? bil.lage() : 'hemma'), bilParkera: () => (typeof bil.parkera === 'function' ? bil.parkera() : undefined), bilModell: (v, o) => (typeof bil.modell === 'function' ? (v === undefined ? bil.modellNu() : bil.modell(v, o)) : 'tesla'), bilKopia: (typ, farg) => (typeof bil.kopia === 'function' ? bil.kopia(typ, farg) : Promise.resolve(null)) };
}
