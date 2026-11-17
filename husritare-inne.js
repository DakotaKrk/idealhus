// Husritarens inredning: möblerade interiörer för husen, byggda efter
// planritningarna i images/plan/. Allt i husets lokala system (meter):
// x längs huset (väst -> öst), z tvärs (norr -> söder), y uppåt, golvet på y = 0.
// Ytterväggarna i motorn är ensidiga ytor, så här finns en egen insida
// (foder med riktiga hål, smyg, karm, fönsterbänk och list), golv, tak som
// följer takfallet, mellanväggar med dörrar, kök, bad, sängar, soffor och loft.
// Väggar, golv och tak är finmaskiga så att en inbakad ocklusion (hörn, golvlist,
// under loftet) kan ligga i hörnfärgerna. Under möblerna ligger mjuka
// kontaktskuggor. Allt slås ihop per material till ett femtontal meshar.
import { RoundedBoxGeometry } from './vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from './vendor/three/addons/utils/BufferGeometryUtils.js';

const I = 0.25;      // insidans avstånd från ytterväggens plan (väggtjocklek)
const KARM = 0.108;  // så djupt in motorns karm sitter (insidan av karmen)
const LU = 2.12;     // loftets undersida
const LT = 2.32;     // loftets golv
const PI = Math.PI;

let T = null, MAT = null, ACC = null, BAS = null, CEIL = null, HH = null, LJUS = null, RGH = 1, EFTER = null, BADRUM = null, DUSCHAR = null;
let SPEGLAR = null, INNE = null, OPP = null, LAMPOR = null, SITT = null, BRYT = null, ID = null, NSTOL = 0, NSANG = 0;
let VAGGAR = null, LOFT = null, HAL = null, TON = null, FARG = null, SEED = 1;
// Lager för genomskärningen (tak / loft / botten), snitthöjder och gånghinder
let LAGER = 'botten', HARLOFT = false, HINDER = null, VAXTNR = 0, TRAPPOR = [], VAVL = null, LJUSL = [], ELD = null, MATTOR = [];
// Tomt hus: LOS = det som läggs nu är lösa möbler och saker (inte fast inredning). Taggen
// följer med geometrin; vid ihopslagningen hamnar det lösa sist i varje mesh, så att motorn
// kan dölja det med ett ritintervall (inga extra ritanrop, ingen ombyggnad). LOSA = meshar med löst.
let LOS = false, LOSA = [];
const SNITT = [2.2, 3.4];
const snitt = () => (HARLOFT ? SNITT : [SNITT[0]]);
const lagerFor = y => (y < SNITT[0] ? 'botten' : (HARLOFT && y < SNITT[1] ? 'loft' : 'tak'));
function iLager(l, fn) { const f = LAGER; LAGER = l; fn(); LAGER = f; }

// ---- Kameralägen ----
// Ögonhöjd 1,55 m (1,5 m i bad), i ett hörn eller en dörröppning, diagonalt över rummet
// så att möbler, fönster och djup syns. Minst 0,9 m till väggar och 0,6 m till möbler där
// rummet tillåter; små sovrum och bad fotograferas från dörröppningen. Huvudrummet först.
// ljus = var rumsljuset ska sitta i just den vyn (annars vid matbordets pendel).
export const INNE_VYER = {
  'sadel-30': [
    { namn: 'Allrum', pos: [1.6, 1.55, 0.2], mal: [3.5, 1.15, -0.45] },
    { namn: 'Kök och loft', pos: [2.15, 1.55, -0.3], mal: [0.3, 1.5, -1.55] },
    { namn: 'Sovrum', pos: [-2.15, 1.5, 0.75], mal: [-3.05, 0.85, -1.3], fov: 74 },   // i dörröppningen mot sängen; garderoben (z 0,47–1,37) står till vänster
    { namn: 'WC/bad', pos: [-1.15, 1.5, 0.0], mal: [-1.56, 1.0, -1.55], fov: 74, ljus: [-1.1, 1.95, -0.9] },
    { namn: 'Loft', pos: [-0.6, 3.22, -0.4], mal: [-2.8, 2.5, -0.95], fov: 74, niva: 'loft', ljus: [-1.6, 2.95, -0.1] },
    { namn: 'Hall', pos: [-1.1, 1.55, 0.45], mal: [2.5, 1.2, 0.3], fov: 74, ljus: [-0.6, 2.3, 0.6] },   // österut: badrums- och sovrumsdörrarnas öppna blad står bakom kameran; ljus: spotarna räknas inte, hallen blev dunkel kl. 21
  ],
  'sadel-40': [
    { namn: 'Allrum', pos: [0.9, 1.55, -0.2], mal: [4.7, 1.2, -0.6] },
    { namn: 'Kök och loft', pos: [2.5, 1.55, -0.15], mal: [-0.4, 1.5, -1.2] },
    { namn: 'Sovrum', pos: [-3.05, 1.5, 0.85], mal: [-4.7, 0.95, 0.0], fov: 74 },
    { namn: 'WC/bad', pos: [-2.3, 1.5, 0.0], mal: [-2.71, 1.0, -1.55], fov: 74, ljus: [-2.0, 1.95, -0.9] },
    { namn: 'Loft', pos: [-1.7, 3.15, -0.3], mal: [-4.2, 2.45, -0.9], fov: 74, niva: 'loft', ljus: [-2.8, 2.95, -0.1] },
    { namn: 'Hall', pos: [-2.2, 1.55, 0.45], mal: [1.5, 1.2, 0.3], fov: 74, ljus: [-1.6, 2.3, 0.6] },   // österut: dörrbladen bakom kameran; ljus: spotarna (3,5 m) är för högt för att räknas som taklampa, hallen blev mörk kl. 21
  ],
  'sadel-50': [
    { namn: 'Allrum', pos: [1.9, 1.55, 0.0], mal: [6.0, 1.2, 0.2] },
    { namn: 'Kök och loft', pos: [3.3, 1.55, 0.12], mal: [0.6, 1.5, -1.0] },
    { namn: 'Sovrum', pos: [-3.2, 1.5, 0.58], mal: [-5.9, 1.0, -0.35], fov: 72 },
    { namn: 'WC/bad', pos: [-0.77, 1.5, 0.0], mal: [-0.22, 1.0, -1.5], fov: 74, ljus: [-0.6, 1.95, -0.9] },
    { namn: 'Bastu', pos: [-1.93, 1.45, -0.46], mal: [-3.0, 1.0, -1.25], fov: 72, ljus: [-2.3, 1.9, -0.9] },
    { namn: 'Loft', pos: [-2.8, 3.18, -0.4], mal: [-5.2, 2.45, -0.9], fov: 74, niva: 'loft', ljus: [-4.0, 2.95, -0.1] },
    { namn: 'Hall', pos: [-0.7, 1.55, 0.45], mal: [3.5, 1.2, 0.3], fov: 74, ljus: [-0.2, 2.3, 0.6] },   // österut: dörrbladen bakom kameran; ljus: spotarna räknas inte, hallen blev dunkel kl. 21
  ],
  'pulpet-70': [
    // namnet = det rum som syns (styr också vilka lampor som lyser upp vyn)
    { namn: 'Vardagsrum', pos: [2.75, 1.55, 0.95], mal: [-4.6, 1.05, 2.3] },
    { namn: 'Vardagsrum och kök', pos: [-0.95, 1.55, 1.05], mal: [4.6, 1.15, 1.6] },
    { namn: 'Sovrum 3', pos: [0.6, 1.5, -0.17], mal: [-0.3, 0.95, -3.25], fov: 72 },   // en bit från det öppna dörrbladets handtag
    { namn: 'WC/bad', pos: [3.25, 1.5, -1.62], mal: [2.9, 1.1, -3.25], fov: 74, ljus: [3.3, 2.2, -2.5] },
    { namn: 'Sovrum 1', pos: [-3.75, 1.5, -0.5], mal: [-3.3, 0.9, -3.0], fov: 74 },   // fritt från det öppna dörrbladet
    { namn: 'Sovrum 2', pos: [-1.95, 1.5, -0.5], mal: [-2.3, 0.9, -3.0], fov: 74 },
    { namn: 'Hall', pos: [2.85, 1.55, -0.4], mal: [4.6, 1.0, -1.45], fov: 74 },
  ],
  'sadel-90': [
    { namn: 'Allrum', pos: [-1.4, 1.55, 0.4], mal: [-5.75, 1.0, -2.3] },
    { namn: 'Allrum och kök', pos: [-2.6, 1.55, -0.5], mal: [-4.9, 1.1, 3.0] },
    { namn: 'Sovrum 2', pos: [5.35, 1.5, -2.9], mal: [3.3, 0.95, -0.4], fov: 72 },   // från fönsterhörnet mot sänggaveln, dörren och garderoben (stod tätt intill sängen)
    { namn: 'WC/bad', pos: [1.92, 1.5, 1.4], mal: [2.9, 1.05, 3.25], fov: 74, ljus: [2.0, 2.1, 2.3] },
    { namn: 'Sovrum 1', pos: [1.0, 1.5, -0.45], mal: [0.45, 0.85, -3.0], fov: 74 },   // olivträdet (x 0) utanför bilden
    { namn: 'Sovrum 3', pos: [4.85, 1.5, 2.95], mal: [4.1, 0.85, 0.1], fov: 74 },   // från södra väggen förbi dörrbladet: nattduksbordet och garderoben syns
    { namn: 'Korridor', pos: [1.0, 1.55, 0.3], mal: [3.6, 1.35, 0.55], fov: 74 },   // österut: badrumsdörrens öppna blad skymmer inte
    { namn: 'Hall', pos: [0.05, 1.55, 0.55], mal: [-0.45, 1.05, 3.25], fov: 74 },   // längre bak: rocken på kroken fyllde halva bilden
  ],
};

// Ståplatser per rum för genomgången: [namn, x, z, nivå, mal]. y räknas fram.
// mal = punkten man vänds mot när man kommer fram (rumPunkter[].mal).
// Bildverktygen (närbilder med öppna skåp): sätts globalThis.__INNE_PROV före laddningen
// byts kameralägen (vyer: { hus: [{ pos, mal, fov }] }) och luckor vars namn matchar oppna
// (RegExp) står öppna från början. Används inte av sidan själv.
const PROV = globalThis.__INNE_PROV || null;
if (PROV && PROV.vyer) Object.entries(PROV.vyer).forEach(([id, l]) => l.forEach((v, i) => { if (v && INNE_VYER[id] && INNE_VYER[id][i]) Object.assign(INNE_VYER[id][i], v); }));
const RUM = {
  'sadel-30': [['Allrum', 1.6, 0.2, 0, [3.5, 1.15, -0.45]], ['Kök', 2.15, -0.3, 0, [0.3, 1.5, -1.55]], ['Hall', -0.9, 0.6, 0, [3.2, 1.25, 0.3]],
    ['Sovrum', -2.5, 0.8, 0, [-3.0, 0.95, -1.7]], ['WC/bad', -1.1, -0.6, 0, [-1.97, 1.3, -0.35]], ['Loft', -2.6, 0.5, 'loft', [2.5, 1.6, -0.5]]],
  'sadel-40': [['Allrum', 1.4, 0.0, 0, [4.7, 1.2, -0.4]], ['Kök', 2.5, -0.15, 0, [-0.4, 1.5, -1.2]], ['Hall', -1.9, 0.57, 0, [3.5, 1.3, 0.4]],
    ['Sovrum', -3.95, 1.1, 0, [-3.96, 0.95, -1.7]], ['WC/bad', -2.2, -0.6, 0, [-3.02, 1.3, -0.55]], ['Loft', -1.6, -0.5, 'loft', [3.5, 1.6, 0.0]]],
  'sadel-50': [['Allrum', 2.3, 0.15, 0, [6.0, 1.2, 0.3]], ['Kök', 3.3, 0.12, 0, [0.6, 1.5, -1.0]], ['Hall', -0.55, 0.6, 0, [4.0, 1.3, 0.4]],
    ['Sovrum', -4.4, 1.33, 0, [-5.9, 1.0, -0.2]], ['WC/bad', -0.45, -0.5, 0, [0.435, 1.3, -0.44]], ['Bastu', -2.1, -0.45, 0, [-3.0, 1.0, -1.2]],
    ['Loft', -1.5, -0.6, 'loft', [4.0, 1.6, 0.3]]],
  'pulpet-70': [['Vardagsrum', -0.6, 0.95, 0, [-4.5, 0.95, 2.4]], ['Vardagsrum och kök', 2.75, 1.5, 0, [4.75, 1.1, 2.6]], ['Hall', 3.73, -0.85, 0, [0.0, 1.2, 2.5]],
    ['Sovrum 1', -3.38, -0.55, 0, [-4.3, 0.95, -3.25]], ['Sovrum 2', -2.15, -0.55, 0, [-1.2, 0.95, -3.25]], ['Sovrum 3', 0.72, -0.5, 0, [-0.3, 0.95, -3.25]],
    ['WC/bad', 2.75, -2.15, 0, [3.3, 1.1, -3.25]]],
  'sadel-90': [['Allrum', -2.6, -0.9, 0, [-5.5, 1.0, -2.2]], ['Allrum och kök', -2.4, 1.6, 0, [-4.6, 1.1, 3.25]], ['Hall', -0.25, 2.2, 0, [-2.5, 1.2, -2.0]],
    ['Korridor', 2.4, 0.65, 0, [-4.0, 1.2, -0.5]], ['Sovrum 1', 1.3, -1.2, 0, [0.6, 1.0, -3.25]], ['Sovrum 2', 3.15, -0.6, 0, [5.75, 1.1, -3.0]],
    ['Sovrum 3', 4.42, 1.6, 0, [5.75, 1.0, 0.6]], ['WC/bad', 2.15, 2.05, 0, [3.44, 1.25, 1.85]]],
};

// ---- Texturer och material (skapas en gång, delas av alla hus) ----
function plankTextur() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  x.scale(2, 2);
  let s = 91;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rader = 12, hh = 512 / rader;   // texturen täcker 2,4 m -> 20 cm breda brädor
  for (let i = 0; i < rader; i++) {
    const y = i * hh;
    let p = r() * 512;
    const slut = p + 512;
    while (p < slut) {
      const len = Math.min(170 + r() * 260, slut - p);
      const l = 0.88 + r() * 0.18;
      const f = [196, 160, 120].map(v => Math.min(255, Math.round(v * l)));
      for (const dx of [0, -512]) {
        const px = p + dx;
        x.fillStyle = `rgb(${f[0]},${f[1]},${f[2]})`;
        x.fillRect(px, y, len, hh);
        let s2 = Math.floor(r() * 1e6);
        const r2 = () => (s2 = (s2 * 16807 + 7) % 2147483647) / 2147483647;
        for (let k = 0; k < 8; k++) {
          x.strokeStyle = `rgba(110,76,44,${0.05 + r2() * 0.09})`;
          x.lineWidth = 0.6 + r2();
          const yy = y + 2 + r2() * (hh - 4);
          x.beginPath(); x.moveTo(px, yy);
          x.bezierCurveTo(px + len * 0.3, yy + (r2() - 0.5) * 5, px + len * 0.7, yy + (r2() - 0.5) * 5, px + len, yy + (r2() - 0.5) * 2);
          x.stroke();
        }
        // fin, tät ådring och breda mjuka skiftningar längs brädan (flammig ek)
        for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(96,66,38,${0.02 + r2() * 0.035})`; x.fillRect(px, y + 1.5 + r2() * (hh - 3), len, 0.5 + r2() * 0.5); }
        for (let k = 0; k < 2; k++) { const gy = y + r2() * hh, gh = 5 + r2() * 12, g = x.createLinearGradient(0, gy - gh, 0, gy + gh), a = (r2() - 0.4) * 0.09;
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, a > 0 ? `rgba(255,236,206,${a})` : `rgba(92,60,32,${-a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
          x.save(); x.beginPath(); x.rect(px, y, len, hh); x.clip(); x.fillStyle = g; x.fillRect(px, gy - gh, len, 2 * gh); x.restore(); }
        // en och annan kvist: mörk kärna med ringar, ådringen böjer runt
        if (r2() < 0.13 && len > 120) { const kx0 = px + 30 + r2() * (len - 60), kx = Math.abs(kx0) < 16 || Math.abs(kx0 - 512) < 16 ? kx0 + 36 : kx0, ky = y + hh * (0.3 + r2() * 0.4), kr = 2.2 + r2() * 2.6;
          x.save(); x.beginPath(); x.rect(px, y, len, hh); x.clip();
          for (let q = 3; q >= 1; q--) { x.strokeStyle = `rgba(98,64,36,${0.035 + 0.02 * (3 - q)})`; x.lineWidth = 0.8; x.beginPath(); x.ellipse(kx, ky, kr * (1.6 + q * 1.5), kr * (0.8 + q * 0.5), 0, 0, 2 * Math.PI); x.stroke(); }
          const kg = x.createRadialGradient(kx, ky, 0, kx, ky, kr * 1.3); kg.addColorStop(0, 'rgba(84,54,30,0.5)'); kg.addColorStop(0.55, 'rgba(100,66,38,0.3)'); kg.addColorStop(1, 'rgba(110,76,44,0)');
          x.fillStyle = kg; x.beginPath(); x.ellipse(kx, ky, kr * 1.7, kr * 0.9, 0, 0, 2 * Math.PI); x.fill(); x.restore(); }
        x.fillStyle = 'rgba(80,54,30,0.4)'; x.fillRect(px, y, 1.4, hh);
      }
      p += len;
    }
    x.fillStyle = 'rgba(80,54,30,0.38)'; x.fillRect(0, y, 512, 1.4);
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Mjuk kontaktskugga: mörk mitt som tonar ut mot kanterna (används som 9-delad ruta).
function skuggTextur() {
  if (typeof document === 'undefined') return null;
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), d = x.createImageData(N, N);
  const ss = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const g = t => ss(t / 0.5) * ss((1 - t) / 0.5);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = g((i + 0.5) / N) * g((j + 0.5) / N);
    const k = (j * N + i) * 4;
    d.data[k] = 26; d.data[k + 1] = 20; d.data[k + 2] = 14; d.data[k + 3] = Math.round(255 * Math.pow(a, 1.4));
  }
  x.putImageData(d, 0, 0);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

// ---- Målade texturer (en gång, delas av alla hus) ----
const DUK = n => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = n; return c; };
function tex(c, rep) {
  if (!c) return null;
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
const ATL = 1024;
const cellUV = c => [c[0] / ATL, 1 - (c[1] + c[3]) / ATL, (c[0] + c[2]) / ATL, 1 - c[1] / ATL];
// bladatlas: blad med basen nedtill i cellen, spetsen upptill
const BL = {
  monstera: [0, 0, 512, 512], fikus: [512, 0, 256, 512], oliv: [768, 0, 256, 512],
  blomma: [0, 512, 256, 512], lans: [256, 512, 256, 256], pothos2: [256, 768, 256, 256],
  pothos: [512, 512, 256, 256], gras: [512, 768, 256, 256], eukalyptus: [768, 512, 256, 512],
};
// tryckatlas: mattor, konst, tidningar
const TR = {
  mattaA: [0, 0, 512, 512], mattaB: [512, 0, 512, 512],
  k0: [0, 512, 256, 256], k1: [256, 512, 256, 256], k2: [0, 768, 256, 256], k3: [256, 768, 256, 256], k4: [512, 768, 256, 256],
  tidning1: [512, 512, 256, 256], tidning2: [768, 512, 256, 256], vit: [768, 768, 256, 256],
};

// Spegelsymmetrisk bladform: vänster halva som bezier-segment i cellens 0..1-koordinater.
function symForm(x, [ox, oy, w, h], start, segs) {
  const P = (u, v) => [ox + u * w, oy + v * h];
  x.beginPath(); x.moveTo(...P(0.5, start));
  segs.forEach(s => x.bezierCurveTo(...P(s[0], s[1]), ...P(s[2], s[3]), ...P(s[4], s[5])));
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], e = i > 0 ? segs[i - 1] : [0, 0, 0, 0, 0.5, start];
    x.bezierCurveTo(...P(1 - s[2], s[3]), ...P(1 - s[0], s[1]), ...P(1 - e[4], e[5]));
  }
  x.closePath();
}

// kör en generator till slut (de synkrona anropen); stegvis via lagaMaterialSteg
const kor = it => { let r = it.next(); while (!r.done) r = it.next(); return r.value; };
function bladTextur() { return kor(bladTexturSteg()); }
function* bladTexturSteg() {
  const c = DUK(ATL); if (!c) return null;
  const x = c.getContext('2d', { willReadFrequently: true });   // läses tillbaka (dilateradTextur): ritas på CPU, ingen dyr GPU-återläsning
  let s = 4711; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.lineCap = 'round';
  const grad = (cell, a, b) => { const [ox, oy, w, h] = cell, g = x.createLinearGradient(ox, oy, ox + w, oy + h); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const nerv = (cell, y0, y1, n, bred, farg, lw, lut = 0.1) => {
    const [ox, oy, w, h] = cell, cx = ox + w / 2;
    x.strokeStyle = farg; x.lineWidth = lw * 1.8;
    x.beginPath(); x.moveTo(cx, oy + h * y0); x.lineTo(cx, oy + h * y1); x.stroke();
    x.lineWidth = lw;
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) {
      const y = oy + h * (y0 + (y1 - y0) * (i + 0.6) / n);
      x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + sd * w * bred * 0.5, y - h * lut * 0.5, cx + sd * w * bred, y - h * lut); x.stroke();
    }
  };
  // monstera: hjärtform, mörk blank ovansida, ljus mittnerv och fina sidonerver; djupa
  // slitsar från kanten in mot mittnerven och några ovala hål nära den (riktiga hål i alfa)
  {
    const C = BL.monstera, [ox, oy, w, h] = C, cx = ox + w / 2;
    symForm(x, C, 0.86, [[0.36, 0.99, 0.02, 0.86, 0.02, 0.52], [0.02, 0.18, 0.3, 0.02, 0.5, 0.015]]);
    // lodrät toning (spegelsymmetrisk kring mittnerven): ljusare mot spetsen
    { const g = x.createLinearGradient(0, oy, 0, oy + h); g.addColorStop(0, '#62a451'); g.addColorStop(1, '#3d7d3c'); x.fillStyle = g; }
    x.fill();
    x.save(); x.clip();
    const gl = x.createRadialGradient(cx, oy + h * 0.42, 10, cx, oy + h * 0.42, w * 0.48);
    gl.addColorStop(0, 'rgba(220,240,200,0.14)'); gl.addColorStop(1, 'rgba(220,240,200,0)');
    x.fillStyle = gl; x.fillRect(ox, oy, w, h);
    // sidonerver längs slitsarna och fina nerver mellan dem
    for (const sd of [-1, 1]) for (let i = 0; i < 16; i++) {
      const t = 0.06 + i * 0.054, ym = oy + h * (0.82 - t * 0.86), stor = i % 2 === 0;
      x.strokeStyle = stor ? 'rgba(175,205,135,0.42)' : 'rgba(150,190,120,0.2)'; x.lineWidth = stor ? 2.4 : 1.1;
      x.beginPath(); x.moveTo(cx, ym); x.quadraticCurveTo(cx + sd * w * 0.25, ym - h * 0.02, cx + sd * w * 0.56, ym - h * (0.08 + t * 0.05)); x.stroke();
    }
    x.strokeStyle = 'rgba(190,215,150,0.75)'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(cx, oy + h * 0.86); x.lineTo(cx, oy + h * 0.03); x.stroke();   // mittnerven i symmetriaxeln
    x.restore();
    x.globalCompositeOperation = 'destination-out';
    // fyra mjuka, smala slitsar per sida (rundade ändar) och ett litet ovalt hål på var sida;
    // samma läge på båda sidor så att bladet blir symmetriskt
    // slitsarna smalnar av inåt mot en rundad botten och vidgas lite mot kanten, så att
    // flikarna emellan blir mjuka och rundade (ingen rakt avhuggen kant)
    x.fillStyle = '#000';
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.17, ym = oy + h * (0.82 - t * 0.86), inner = w * (0.24 + (i % 2) * 0.04);
      for (const sd of [-1, 1]) {
        const ax = cx + sd * inner, ay = ym - h * 0.03, bx = cx + sd * w * 0.66, by = ym - h * (0.11 + t * 0.06), qx = (ax + bx) / 2, qy = (ay + by) / 2 + h * 0.014;
        const sid = [], ann = [];
        for (let k = 0; k <= 10; k++) {
          const u = k / 10, px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * qx + u * u * bx, py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * qy + u * u * by;
          const tx = 2 * (1 - u) * (qx - ax) + 2 * u * (bx - qx), ty = 2 * (1 - u) * (qy - ay) + 2 * u * (by - qy), tl = Math.hypot(tx, ty), bw = 2.2 + 5.5 * u * u;
          sid.push([px - ty / tl * bw, py + tx / tl * bw]); ann.push([px + ty / tl * bw, py - tx / tl * bw]);
        }
        x.beginPath(); x.moveTo(...sid[0]); sid.forEach(q => x.lineTo(...q)); ann.reverse().forEach(q => x.lineTo(...q)); x.closePath(); x.fill();
        x.beginPath(); x.arc(ax, ay, 2.2, 0, 2 * PI); x.fill();
        if (i === 1) { x.beginPath(); x.ellipse(cx + sd * w * 0.11, ym - h * 0.08, 5, 10, sd * 0.4, 0, 2 * PI); x.fill(); }
      }
    }
    // genomskinliga texlar får bladets gröna färg (nästan noll alfa) så att filtreringen
    // inte drar in en mörk eller ljus rand längs kanten och slitsarna
    x.globalCompositeOperation = 'destination-over';
    x.fillStyle = 'rgba(74,138,66,0.04)'; x.fillRect(ox, oy, w, h);
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = '#7a9a5a'; x.lineWidth = 9; x.beginPath(); x.moveTo(cx, oy + h); x.lineTo(cx, oy + h * 0.86); x.stroke();
  }
  yield;
  // fiolfikus: bred topp, midja, ljusa nerver
  {
    const C = BL.fikus;
    symForm(x, C, 0.98, [[0.3, 0.9, 0.16, 0.74, 0.2, 0.6], [0.24, 0.47, 0.0, 0.42, 0.03, 0.22], [0.05, 0.06, 0.36, 0.0, 0.5, 0.03]]);
    x.fillStyle = grad(C, '#386536', '#1f4425'); x.fill();
    x.save(); x.clip();
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(C[0], C[1], C[2] / 2, C[3]);
    nerv(C, 0.97, 0.06, 8, 0.48, 'rgba(190,205,140,0.55)', 2.2, 0.08);
    x.restore();
  }
  // olivkvist: tunn kvist med smala gråGröna blad
  {
    const [ox, oy, w, h] = BL.oliv, cx = ox + w / 2;
    x.strokeStyle = '#6b5a45'; x.lineWidth = 3.5;
    x.beginPath(); x.moveTo(cx, oy + h); x.quadraticCurveTo(cx - 10, oy + h * 0.5, cx + 6, oy + h * 0.04); x.stroke();
    // tätt med blad (26 st, 1 cm breda i verklig skala): glesa, smala blad såg ut som en vissen ormbunke
    for (let i = 0; i < 26; i++) {
      const t = 0.06 + i * 0.032, y = oy + h * (1 - t), sd = i % 2 ? 1 : -1;
      const a = sd * (0.45 + r() * 0.4), L = 66 + r() * 22 - t * 20;
      x.save(); x.translate(cx + sd * 2, y); x.rotate(a);
      x.fillStyle = r() < 0.4 ? '#a7b18f' : (r() < 0.5 ? '#80905f' : '#6f7f55');
      x.beginPath(); x.ellipse(0, -L / 2, 11 + r() * 4, L / 2, 0, 0, 2 * PI); x.fill();
      x.strokeStyle = 'rgba(210,220,190,0.35)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, -2); x.lineTo(0, -L + 6); x.stroke();
      x.restore();
    }
  }
  yield;
  // blomma: stjälk, två blad och en ljus ranunkel
  {
    const C = BL.blomma, [ox, oy, w, h] = C, cx = ox + w / 2;
    x.strokeStyle = '#5f7a4a'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(cx, oy + h); x.quadraticCurveTo(cx + 8, oy + h * 0.6, cx, oy + h * 0.24); x.stroke();
    x.fillStyle = '#5a7a46';
    for (const sd of [-1, 1]) { x.save(); x.translate(cx, oy + h * (0.62 + sd * 0.08)); x.rotate(sd * 0.6); x.beginPath(); x.ellipse(0, -40, 10, 42, 0, 0, 2 * PI); x.fill(); x.restore(); }
    const by = oy + h * 0.17;
    for (let k = 0; k < 3; k++) for (let i = 0; i < 7; i++) {
      const a = i * 2 * PI / 7 + k * 0.4, rr = w * (0.3 - k * 0.08);
      x.fillStyle = ['#efe4dc', '#ead3c8', '#f6eee8'][k];
      x.beginPath(); x.ellipse(cx + Math.cos(a) * rr * 0.45, by + Math.sin(a) * rr * 0.35, rr * 0.5, rr * 0.38, a, 0, 2 * PI); x.fill();
    }
    x.fillStyle = '#c9a98f'; x.beginPath(); x.arc(cx, by, 9, 0, 2 * PI); x.fill();
  }
  // lansettblad
  {
    const C = BL.lans;
    symForm(x, C, 0.98, [[0.4, 0.85, 0.18, 0.6, 0.2, 0.4], [0.22, 0.2, 0.44, 0.08, 0.5, 0.02]]);
    x.fillStyle = grad(C, '#46743f', '#2b5230'); x.fill();
    x.save(); x.clip(); nerv(C, 0.97, 0.05, 6, 0.3, 'rgba(170,200,130,0.4)', 1.6, 0.1); x.restore();
  }
  yield;
  // pothos: hjärtblad, ett med ljusa strimmor
  [[BL.pothos, '#5a8a3e', '#356a2c', true], [BL.pothos2, '#3f6f32', '#264f26', false]].forEach(([C, a, b, strimma]) => {
    symForm(x, C, 0.88, [[0.3, 0.99, 0.0, 0.86, 0.05, 0.55], [0.1, 0.28, 0.38, 0.1, 0.5, 0.03]]);
    x.fillStyle = grad(C, a, b); x.fill();
    x.save(); x.clip();
    if (strimma) for (let i = 0; i < 9; i++) {
      x.strokeStyle = `rgba(222,214,130,${0.25 + r() * 0.3})`; x.lineWidth = 3 + r() * 6;
      const sx = C[0] + C[2] * (0.25 + r() * 0.5);
      x.beginPath(); x.moveTo(sx, C[1] + C[3] * 0.85); x.quadraticCurveTo(sx + (r() - 0.5) * 60, C[1] + C[3] * 0.5, C[0] + C[2] * 0.5 + (r() - 0.5) * 40, C[1] + C[3] * 0.1); x.stroke();
    }
    nerv(C, 0.88, 0.05, 4, 0.36, 'rgba(200,215,150,0.35)', 1.6, 0.12);
    x.restore();
  });
  // eukalyptus: stjälk med runda silverblå blad i par
  {
    const [ox, oy, w, h] = BL.eukalyptus, cx = ox + w / 2;
    x.strokeStyle = '#7d6a58'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx, oy + h); x.quadraticCurveTo(cx - 14, oy + h * 0.5, cx + 10, oy + h * 0.03); x.stroke();
    for (let i = 0; i < 11; i++) {
      const t = 0.07 + i * 0.085, y = oy + h * (1 - t), dx = -14 * 2 * t * (1 - t) + 10 * t * t, rr = 30 - t * 14;
      for (const sd of [-1, 1]) {
        x.fillStyle = ['#8ea79e', '#9db3a9', '#7f988f'][Math.floor(r() * 3)];
        x.beginPath(); x.ellipse(cx + dx + sd * rr * 0.9, y - sd * 3, rr, rr * 0.86, 0, 0, 2 * PI); x.fill();
        x.strokeStyle = 'rgba(70,90,80,0.35)'; x.lineWidth = 1.2; x.stroke();
      }
    }
  }
  yield;
  // gräs: smala strån
  {
    const [ox, oy, w, h] = BL.gras;
    for (let i = 0; i < 22; i++) {
      const bx = ox + w * (0.35 + r() * 0.3), tx = ox + w * (0.05 + r() * 0.9), ty = oy + h * (0.02 + r() * 0.3);
      x.strokeStyle = ['#5b7d45', '#6f8f52', '#47683a'][i % 3]; x.lineWidth = 3 + r() * 2;
      x.beginPath(); x.moveTo(bx, oy + h); x.quadraticCurveTo(bx, oy + h * 0.5, tx, ty); x.stroke();
    }
  }
  yield;
  return yield* dilateradTexturSteg(x, ATL);
}

// Atlasen som datatextur där genomskinliga pixlar fått kantfärgen från bladet bredvid
// (alfa ligger kvar på 0): inga ljusa eller mörka fransar vid hål och kanter i mipmapparna.
function* dilateradTexturSteg(x, N) {
  const id = x.getImageData(0, 0, N, N), d = id.data, fyllt = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) fyllt[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  // (utan allokering per bildpunkt: förr skapades fyra små arrayer per pixel och pass, vilket
  // tog flera sekunder på en mobil; nu typade buffertar och direkta grannar)
  const nyI = new Int32Array(N * N), nyC = new Uint8Array(N * N * 3);
  for (let pass = 0; pass < 6; pass++) {
    yield;
    let k = 0;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const i = yy * N + xx; if (fyllt[i]) continue;
      let r = 0, g = 0, b = 0, n = 0, j;
      if (xx + 1 < N && fyllt[j = i + 1]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      if (xx > 0 && fyllt[j = i - 1]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      if (yy + 1 < N && fyllt[j = i + N]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      if (yy > 0 && fyllt[j = i - N]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      if (n) { nyI[k] = i; nyC[k * 3] = r / n; nyC[k * 3 + 1] = g / n; nyC[k * 3 + 2] = b / n; k++; }
    }
    for (let q = 0; q < k; q++) { const i = nyI[q]; d[i * 4] = nyC[q * 3]; d[i * 4 + 1] = nyC[q * 3 + 1]; d[i * 4 + 2] = nyC[q * 3 + 2]; fyllt[i] = 1; }
  }
  // raderna vänds så att uv följer samma konvention som en canvastextur (flipY)
  const ut = new Uint8Array(N * N * 4);
  for (let yy = 0; yy < N; yy++) ut.set(d.subarray((N - 1 - yy) * N * 4, (N - yy) * N * 4), yy * N * 4);
  const t = new T.DataTexture(ut, N, N, T.RGBAFormat);
  t.colorSpace = T.SRGBColorSpace; t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function tryckTextur() { return kor(tryckTexturSteg()); }
function* tryckTexturSteg() {
  // dubbel upplösning (2048 px) för skarpa motiv och mattor; ritas i 1024-koordinater
  const c = DUK(ATL * 2); if (!c) return null;
  const x = c.getContext('2d');
  x.scale(2, 2);
  let s = 977; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ruta = (C, f) => { x.fillStyle = f; x.fillRect(C[0], C[1], C[2], C[3]); };
  const brus = (C, n, a, ljus) => { x.fillStyle = ljus ? 'rgb(255,255,255)' : 'rgb(60,50,40)'; for (let i = 0; i < n; i++) { x.globalAlpha = a * r(); x.fillRect(C[0] + r() * C[2], C[1] + r() * C[3], 1 + r() * 2, 1 + r() * 2); } x.globalAlpha = 1; };
  // matta A: berber, gräddvit med kolgrått rutmönster av romber
  {
    const C = TR.mattaA, [ox, oy, w, h] = C;
    ruta(C, '#eee7db');
    // berberns öglor: täta rader av korta, mjuka streck i ljusare och mörkare gräddvitt
    // (samma öglor men färgen sätts bara när den byts och alfa via globalAlpha: förr tolkades en
    // ny färgsträng för var och en av ~44 000 öglor; paus efter var 64:e rad)
    let rad = 0, fy = -1;
    for (let yy = oy; yy < oy + h; yy += 2.5) {
      for (let xx = ox + (yy % 5 ? 0 : 1.2); xx < ox + w; xx += 2.4) {
        const v = r(), ljus = v < 0.5 ? 1 : 0;
        if (ljus !== fy) { x.fillStyle = ljus ? 'rgb(255,252,244)' : 'rgb(150,128,100)'; fy = ljus; }
        x.globalAlpha = ljus ? 0.25 + v * 0.4 : (v - 0.5) * 0.22; x.fillRect(xx, yy, 1.7, 1.6);
      }
      if (++rad % 64 === 0) { x.globalAlpha = 1; yield; fy = -1; }
    }
    x.globalAlpha = 1;
    brus(C, 4000, 0.08, false);
    x.save(); x.beginPath(); x.rect(ox + 22, oy + 22, w - 44, h - 44); x.clip();
    // romber i varm gråbrun ton (inget svart), dubbla linjer som i en handknuten berber
    for (const [f, lw, dx] of [['rgba(138,112,90,0.78)', 3.2, 0], ['rgba(170,146,120,0.45)', 1.4, 7]]) {
      x.strokeStyle = f; x.lineWidth = lw;
      for (let k = -7; k <= 7; k++) {
        x.beginPath();
        for (let j = 0; j <= 16; j++) { const y = oy + j * h / 16, xx = ox + w / 2 + k * 80 + dx + (j % 2 ? 40 : -40) + (r() - 0.5) * 3; j ? x.lineTo(xx, y) : x.moveTo(xx, y); }
        x.stroke();
      }
    }
    x.restore();
    x.strokeStyle = 'rgba(138,112,90,0.6)'; x.lineWidth = 3; x.strokeRect(ox + 12, oy + 12, w - 24, h - 24);
    x.strokeStyle = 'rgba(138,112,90,0.35)'; x.lineWidth = 1.2; x.strokeRect(ox + 18, oy + 18, w - 36, h - 36);
  }
  yield;
  // matta B: flatvävd med ränder i sand, terrakotta och grädde
  {
    const C = TR.mattaB, [ox, oy, w, h] = C;
    ruta(C, '#e4d9c6');
    const band = ['#e4d9c6', '#cdb898', '#e4d9c6', '#c08560', '#e4d9c6', '#d8c7aa', '#9c8a74', '#e4d9c6'];
    let y = oy + 30;
    for (let i = 0; y < oy + h - 30; i++) { const bh = 8 + r() * 26; x.fillStyle = band[i % band.length]; x.fillRect(ox + 20, y, w - 40, bh); y += bh; }
    // flatvävens inslag: fina tvärgående trådar och små lodräta varpstreck
    for (let yy = oy + 30; yy < oy + h - 30; yy += 2) { x.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '90,70,50'},${0.05 + r() * 0.06})`; x.fillRect(ox + 20, yy, w - 40, 0.8); }
    for (let i = 0; i < 1400; i++) { x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(ox + 20 + r() * (w - 40), oy + 30 + r() * (h - 60), 0.8, 3 + r() * 4); }
    brus(C, 6000, 0.12, false);
  }
  yield;
  // konst: fem egna målningar på duk (256 px per ruta), med dukens väv och lite korn
  const duk = (C, n, a) => {
    const [ox, oy, w, h] = C;
    // fin väv (halv bildpunkt i 1024-skala) och glest, fint korn: inga pixliga prickar
    x.fillStyle = `rgba(255,255,255,${a * 0.3})`; for (let i = 0; i < w; i += 1.5) x.fillRect(ox + i, oy, 0.5, h);
    x.fillStyle = `rgba(60,50,40,${a * 0.25})`; for (let j = 0; j < h; j += 1.5) x.fillRect(ox, oy + j, w, 0.5);
    for (let i = 0; i < n; i++) { const v = r() < 0.5; x.fillStyle = `rgba(${v ? '255,255,255' : '30,26,22'},${0.02 + r() * 0.04})`; x.fillRect(ox + r() * w, oy + r() * h, 0.5 + r() * 0.6, 0.5 + r() * 0.6); }
  };
  const mjukt = (C, fn) => { x.save(); x.beginPath(); x.rect(C[0], C[1], C[2], C[3]); x.clip(); fn(); x.restore(); };
  // 0: landskap med skarpa lager: blek himmel, solskiva, fyra kullar med rena konturer
  // och fina gräslinjer i förgrunden (inga mjuka gradientklickar)
  { const C = TR.k0, [ox, oy, w, h] = C; mjukt(C, () => {
    let g = x.createLinearGradient(0, oy, 0, oy + h * 0.6); g.addColorStop(0, '#c9d3d6'); g.addColorStop(1, '#efe6d6'); x.fillStyle = g; x.fillRect(ox, oy, w, h);
    x.fillStyle = '#e9b98a'; x.beginPath(); x.arc(ox + w * 0.7, oy + h * 0.34, w * 0.085, 0, 2 * PI); x.fill();
    [['#a9b39b', 0.52, 18, 0.9], ['#c4b08e', 0.62, 14, 1.4], ['#7f8f78', 0.72, 20, 0.7], ['#5f6f5c', 0.84, 12, 1.1]].forEach(([f, y0, amp, fr], k) => {
      x.fillStyle = f; x.beginPath(); x.moveTo(ox, oy + h);
      for (let i = 0; i <= 64; i++) { const xx = ox + i * w / 64; x.lineTo(xx, oy + h * y0 - amp * Math.sin(i / 64 * PI * fr + k * 1.9) - amp * 0.35 * Math.sin(i / 64 * PI * fr * 3.1 + k)); }
      x.lineTo(ox + w, oy + h); x.closePath(); x.fill();
    });
    x.strokeStyle = 'rgba(40,46,38,0.55)'; x.lineWidth = 0.6;
    for (let i = 0; i < 70; i++) { const xx = ox + r() * w, yy = oy + h * (0.9 + r() * 0.1); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - 0.5) * 3, yy - 4 - r() * 7); x.stroke(); }
    x.strokeStyle = 'rgba(60,60,58,0.7)'; x.lineWidth = 0.7;
    for (const [bx, by] of [[0.3, 0.22], [0.36, 0.25], [0.33, 0.19]]) { x.beginPath(); x.moveTo(ox + w * bx - 4, oy + h * by); x.quadraticCurveTo(ox + w * bx - 1.5, oy + h * by - 2.5, ox + w * bx, oy + h * by); x.quadraticCurveTo(ox + w * bx + 1.5, oy + h * by - 2.5, ox + w * bx + 4, oy + h * by); x.stroke(); }
  }); duk(C, 500, 0.03); }
  yield;
  // 1: botanisk linjeteckning: tunn kolgrå linje, kvist med blad och ådror, svag salviatvätt
  { const C = TR.k1, [ox, oy, w, h] = C; mjukt(C, () => {
    x.fillStyle = '#f3efe7'; x.fillRect(ox, oy, w, h);
    const t = x.createRadialGradient(ox + w * 0.55, oy + h * 0.5, 10, ox + w * 0.55, oy + h * 0.5, 90); t.addColorStop(0, 'rgba(154,165,140,0.28)'); t.addColorStop(1, 'rgba(154,165,140,0)'); x.fillStyle = t; x.fillRect(ox, oy, w, h);
    x.strokeStyle = '#34322f'; x.lineWidth = 1.6; x.lineCap = 'round';
    const P = tt => [ox + w * (0.5 + 0.08 * Math.sin(tt * 3)), oy + h * (0.92 - 0.8 * tt)];
    x.beginPath(); for (let i = 0; i <= 30; i++) { const [a, b] = P(i / 30); i ? x.lineTo(a, b) : x.moveTo(a, b); } x.stroke();
    for (let i = 1; i < 9; i++) {
      const tt = i / 9.5, [a, b] = P(tt), sd = i % 2 ? 1 : -1, L = 34 - i * 2, an = sd * 0.9 - 0.35;
      x.save(); x.translate(a, b); x.rotate(an);
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(L * 0.5, -L * 0.32, L, 0); x.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0); x.stroke();
      x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, 0); x.lineTo(L * 0.92, 0); for (let k = 1; k < 4; k++) { x.moveTo(L * k / 4.2, 0); x.lineTo(L * k / 4.2 + 6, -L * 0.14); } x.stroke(); x.lineWidth = 1.6;
      x.restore();
    }
  }); duk(C, 900, 0.04); }
  yield;
  // 2: bågar och cirklar i terrakotta och salvia på havre
  { const C = TR.k2, [ox, oy, w, h] = C; mjukt(C, () => {
    x.fillStyle = '#e8dfd0'; x.fillRect(ox, oy, w, h);
    x.fillStyle = '#b8664a'; x.beginPath(); x.moveTo(ox + 38, oy + 236); x.lineTo(ox + 38, oy + 130); x.arc(ox + 102, oy + 130, 64, PI, 0); x.lineTo(ox + 166, oy + 236); x.fill();
    x.fillStyle = '#e8dfd0'; x.beginPath(); x.moveTo(ox + 74, oy + 236); x.lineTo(ox + 74, oy + 140); x.arc(ox + 102, oy + 140, 28, PI, 0); x.lineTo(ox + 130, oy + 236); x.fill();
    x.fillStyle = 'rgba(154,165,140,0.92)'; x.beginPath(); x.moveTo(ox + 120, oy + 236); x.lineTo(ox + 120, oy + 168); x.arc(ox + 168, oy + 168, 48, PI, 0); x.lineTo(ox + 216, oy + 236); x.fill();
    x.fillStyle = '#d7a77f'; x.beginPath(); x.arc(ox + 190, oy + 70, 26, 0, 2 * PI); x.fill();
    x.fillStyle = '#3d3d3b'; x.beginPath(); x.arc(ox + 62, oy + 58, 9, 0, 2 * PI); x.fill();
  }); duk(C, 1400, 0.06); }
  yield;
  // 3: kornigt svartvitt foto av en klippkust
  { const C = TR.k3, [ox, oy, w, h] = C; mjukt(C, () => {
    let g = x.createLinearGradient(0, oy, 0, oy + h * 0.55); g.addColorStop(0, '#d9d9d6'); g.addColorStop(1, '#f1f1ee'); x.fillStyle = g; x.fillRect(ox, oy, w, h * 0.56);
    g = x.createLinearGradient(0, oy + h * 0.55, 0, oy + h); g.addColorStop(0, '#9c9c99'); g.addColorStop(1, '#5d5d5b'); x.fillStyle = g; x.fillRect(ox, oy + h * 0.55, w, h * 0.45);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`; x.fillRect(ox + r() * w, oy + h * (0.57 + r() * 0.4), 8 + r() * 30, 1); }
    x.fillStyle = '#2a2a29'; x.beginPath(); x.moveTo(ox, oy + h * 0.5);
    for (let i = 0; i <= 12; i++) x.lineTo(ox + w * 0.06 * i, oy + h * (0.5 + 0.035 * i + 0.03 * Math.sin(i * 2.3)));
    x.lineTo(ox + w * 0.78, oy + h); x.lineTo(ox, oy + h); x.fill();
    x.fillStyle = '#4a4a48'; x.beginPath(); x.ellipse(ox + w * 0.55, oy + h * 0.86, 26, 8, 0.1, 0, 2 * PI); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(ox, oy + h * 0.555); x.lineTo(ox + w, oy + h * 0.555); x.stroke();   // skarp horisont
    for (let i = 0; i < 4000; i++) { const v = Math.floor(r() * 255); x.fillStyle = `rgba(${v},${v},${v},0.05)`; x.fillRect(ox + r() * w, oy + r() * h, 0.5, 0.5); }
  }); }
  yield;
  // 4: skarp geometrisk komposition: rena fält i havre, terrakotta, salvia och kol,
  // en halvcirkel och en tunn linje (rena kanter)
  { const C = TR.k4, [ox, oy, w, h] = C; mjukt(C, () => {
    x.fillStyle = '#ece4d6'; x.fillRect(ox, oy, w, h);
    x.fillStyle = '#c47e5e'; x.fillRect(ox + w * 0.12, oy + h * 0.14, w * 0.42, h * 0.5);
    x.fillStyle = '#9aa58c'; x.fillRect(ox + w * 0.54, oy + h * 0.38, w * 0.34, h * 0.48);
    x.fillStyle = '#e2c79f'; x.beginPath(); x.arc(ox + w * 0.54, oy + h * 0.64, w * 0.2, PI, 0); x.closePath(); x.fill();
    x.fillStyle = '#3e3d3a'; x.beginPath(); x.arc(ox + w * 0.76, oy + h * 0.22, w * 0.06, 0, 2 * PI); x.fill();
    x.strokeStyle = '#3e3d3a'; x.lineWidth = 1; x.beginPath(); x.moveTo(ox + w * 0.12, oy + h * 0.78); x.lineTo(ox + w * 0.66, oy + h * 0.78); x.stroke();
  }); duk(C, 400, 0.03); }
  yield;
  // tidningar
  [[TR.tidning1, '#e9e2d6', '#a7b29a', '#1f1e1c', 'FORM'], [TR.tidning2, '#2f3a33', '#c79a6b', '#f3efe8', 'HEM']].forEach(([C, bg, bild, txt, ord]) => {
    const [ox, oy, w, h] = C;
    ruta(C, bg); x.fillStyle = bild; x.fillRect(ox + 24, oy + 70, w - 48, h - 110);
    x.fillStyle = txt; x.fillRect(ox + w / 2 - 50, oy + 28, 100, 14);
    x.fillRect(ox + 40, oy + h - 28, 90, 5); x.fillRect(ox + 40, oy + h - 18, 60, 4);
  });
  ruta(TR.vit, '#ffffff');
  const t = tex(c, false); if (t) t.anisotropy = 8;
  return t;
}

// Storformatsklinker i porslin: 2 x 2 plattor per textur med 2 mm fog. Golvet läser
// texturen som 1,2 m (60 x 60), väggarna som 0,6 x 1,2 m (30 x 60). Fogen är mjuk och
// ligger i mipmapparna, så att den tonar bort på avstånd i stället för att flimra.
// k = höjd/bredd för en upprepning (2 x 2 plattor). Väggen: 0,6 x 1,2 m (k = 2, plattor
// 30 x 60) på en 1024 x 2048-duk, så att fogarna blir lika breda åt båda hållen (~2 mm).
// Golvet: 1,2 x 1,2 m (k = 1, klinker 60 x 60, fog ~3 mm).
function kakelTextur(k = 1) { return kor(kakelTexturSteg(k)); }
function* kakelTexturSteg(k = 1) {
  const N = 1024, c = DUK(N); if (!c) return null;
  const H = N * k; c.height = H;
  const x = c.getContext('2d'), P = N / 2, Q = H / 2;
  let s = 333; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4; i++) {
    const tx = (i % 2) * P, ty = Math.floor(i / 2) * Q, l = 0.975 + r() * 0.04, w = (r() - 0.5) * 4;
    x.fillStyle = `rgb(${Math.round(241 * l + w)},${Math.round(237 * l)},${Math.round(230 * l - w)})`; x.fillRect(tx, ty, P, Q);
    // svag stenstruktur: mjuka moln (stora, mycket svaga) och fint korn
    const g = x.createLinearGradient(tx, ty, tx + P, ty + Q);
    g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.5, 'rgba(160,150,138,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0.03)');
    x.fillStyle = g; x.fillRect(tx, ty, P, Q);
    // (samma korn, men alfa via globalAlpha: förr tolkades en ny färgsträng per korn, 24 000 gånger)
    x.fillStyle = 'rgb(120,110,100)';
    for (let j = 0; j < 3000 * k; j++) { x.globalAlpha = r() * 0.06; x.fillRect(tx + r() * P, ty + r() * Q, 1.5, 1.5); }
    x.globalAlpha = 1;
    yield;   // paus per platta
  }
  // fogar: 3 px ljusgrå, lika breda åt båda hållen, med en ljus fas på ena sidan
  [0, 1].forEach(i => {
    const p = i * P, q = i * Q;
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(p + 2, 0, 1, H); x.fillRect(0, q + 2, N, 1);
    x.fillStyle = '#c3beb6'; x.fillRect(p - 1, 0, 3, H); x.fillRect(0, q - 1, N, 3);
    x.fillRect(N - 1, 0, 1, H); x.fillRect(0, H - 1, N, 1);
  });
  const t = tex(c, true); if (t) t.anisotropy = 8;
  return t;
}

// Linne/ull: fina riktade fibrer och mjukt brus i nästan vitt (inga fläckar eller ränder),
// färgen ligger i hörnfärgerna. Sömlös: fibrer nära kanten ritas även på andra sidan.
function linneTextur() {
  const N = 256, c = DUK(N); if (!c) return null;
  const x = c.getContext('2d');
  let s = 515; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#f2f0ec'; x.fillRect(0, 0, N, N);
  // mjukt lågfrekvent brus: liten ruta uppskalad med utjämning, sömlöst kaklad
  const sm = document.createElement('canvas'); sm.width = sm.height = 8;
  const sx = sm.getContext('2d'), d = sx.createImageData(8, 8);
  for (let i = 0; i < 64; i++) { const v = 200 + Math.floor(r() * 55); d.data[i * 4] = v; d.data[i * 4 + 1] = v - 4; d.data[i * 4 + 2] = v - 10; d.data[i * 4 + 3] = 255; }
  sx.putImageData(d, 0, 0);
  x.globalAlpha = 0.09; x.imageSmoothingEnabled = true;
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) x.drawImage(sm, ox - N / 16, oy - N / 16, N + N / 8, N + N / 8);
  x.globalAlpha = 1;
  // fin, tät väv: korn per pixel och en svag tvåtrådsväv som försvinner i mipmapparna
  const id = x.getImageData(0, 0, N, N), dd = id.data;
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
    const i = (yy * N + xx) * 4, v = 1 + (r() - 0.5) * 0.05 - (((xx >> 1) + (yy >> 1)) % 2 ? 0.012 : 0);
    dd[i] = Math.min(255, dd[i] * v); dd[i + 1] = Math.min(255, dd[i + 1] * v); dd[i + 2] = Math.min(255, dd[i + 2] * v);
  }
  x.putImageData(id, 0, 0);
  return tex(c, true);
}

// ---- Tygbiblioteket: åtta sömlösa vävar i en texturarray (ett material, ett ritanrop) ----
// Allt i 'tyg' (och gardinerna) läser lagret ur hörnattributet tyguv = (u, v, lager), där
// u och v är meter delat med rutans storlek (VAVM), så att väven har verklig skala.
// 0 linne (slub), 1 bomullsperkal (sängkläder), 2 bouclé (soffa, sänggavel), 3 sammet
// (en fåtölj), 4 frotté (handdukar), 5 stickat (plädar, puff), 6 ullmatta (berber),
// 7 fårskinn: det enda luggiga. Färgen ligger i hörnfärgerna (havre, sand, vitt, kol,
// salvia, rost, duvblått); texturen är nästan vit och bär bara struktur.
const VAV = { linne: 0, perkal: 1, boucle: 2, sammet: 3, frotte: 4, stick: 5, ull: 6, skinn: 7 };
const VAVM = [0.26, 0.12, 0.16, 0.4, 0.07, 0.1, 0.22, 0.24];
const PAL = { havre: '#d9cfbf', sand: '#cbb89a', vitt: '#f3f0ea', kol: '#3d3d3b', salvia: '#9aa58c', rost: '#a65a3a', duvbla: '#8797a6' };
function tygBibliotek() { const it = tygBibliotekSteg(); let r = it.next(); while (!r.done) r = it.next(); return r.value; }
// (paus efter var 32:a rad i varje lager: ett lager med cellbrus tog flera hundra ms på mobil)
function* tygBibliotekSteg() {
  if (typeof document === 'undefined') return null;
  const N = 256, NL = 8, D = new Uint8Array(N * N * 4 * NL);
  const hs = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s + 17, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const md = (a, n) => ((a % n) + n) % n;
  // periodiskt värdebrus med n celler över rutan (sömlöst)
  const br = (x, y, n, s) => {
    const fx = x / N * n, fy = y / N * n, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = hs(md(i, n), md(j, n), s), b = hs(md(i + 1, n), md(j, n), s), c = hs(md(i, n), md(j + 1, n), s), d = hs(md(i + 1, n), md(j + 1, n), s);
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  // periodiskt cellbrus: avståndet till närmaste punkt (öglor, noppor); CID = cellens slump
  let CID = 0;
  const cl = (x, y, n, s) => {
    const fx = x / N * n, fy = y / N * n, i = Math.floor(fx), j = Math.floor(fy); let d1 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = md(i + di, n), b = md(j + dj, n), px = i + di + hs(a, b, s), py = j + dj + hs(a, b, s + 9), d = Math.hypot(px - fx, py - fy);
      if (d < d1) { d1 = d; CID = hs(a, b, s + 31); }
    }
    return d1;
  };
  const ring = (d, r, b) => Math.exp(-((d - r) * (d - r)) / b);
  const F = [
    // linne: tvåtrådsväv med slubb (tjockare partier) längs trådarna
    (x, y) => { const r = y >> 1, c = x >> 1, vv = (r + c) & 1;
      const tr = vv ? br(x, 0, 8, 200 + (r & 127)) : br(y, 0, 8, 900 + (c & 127));
      const sl = Math.max(0, (vv ? br(x, 0, 5, 500 + (r & 127)) : br(y, 0, 5, 1500 + (c & 127))) - 0.7) * 2.4;
      return 0.9 + 0.05 * (tr - 0.5) + 0.1 * sl + (vv ? 0.012 : -0.012) + 0.03 * (br(x, y, 6, 1) - 0.5); },
    // perkal: tät, slät väv
    (x, y) => 0.955 + ((((x >> 1) + (y >> 1)) & 1) ? 0.012 : -0.012) + 0.025 * (br(x, y, 12, 2) - 0.5),
    // bouclé: små öglor i ojämna klungor
    // (mjukare öglor: på nära håll såg den starka kontrasten ut som ett regelbundet prickraster)
    (x, y) => { const d = cl(x, y, 30, 3); return 0.86 + 0.11 * ring(d, 0.32, 0.016) - 0.03 * (d < 0.12 ? 1 : 0) + 0.07 * (br(x, y, 16, 4) - 0.5) + 0.03 * (br(x, y, 5, 41) - 0.5); },
    // sammet: slät lugg med mjuka, stora skiftningar (glansen kommer i skuggningen)
    (x, y) => 0.88 + 0.1 * (br(x, y, 4, 5) - 0.5) + 0.04 * (br(x, y, 16, 6) - 0.5),
    // frotté: täta öglor i rader
    (x, y) => { const d = cl(x, y, 44, 7); return 0.8 + 0.18 * ring(d, 0.28, 0.01) + ((y >> 3) & 1 ? 0.02 : -0.02) + 0.05 * (br(x, y, 20, 8) - 0.5); },
    // stickat: slätstickning, rader av V-formade maskor
    (x, y) => { const u = (x % 8) / 8, w = (y % 8) / 8;
      const s = u < 0.5 ? u - 0.25 - (w - 0.5) * 0.32 : u - 0.75 + (w - 0.5) * 0.32;
      return 0.78 + 0.22 * Math.exp(-s * s / 0.012) * (0.7 + 0.3 * Math.sin(PI * w)) + 0.04 * (br(x, y, 32, 9) - 0.5); },
    // ullmatta (berber): grova öglor och mörka prickar
    (x, y) => { const d = cl(x, y, 24, 10), f = CID > 0.9 ? 0.72 : 1; return f * (0.8 + 0.17 * ring(d, 0.3, 0.02) + 0.06 * (br(x, y, 8, 11) - 0.5)); },
    // fårskinn: lockar (vriden brus) och fina hårstrån
    (x, y) => { const q = br(x, y, 6, 12) * 10 + br(x, y, 12, 13) * 5;
      return 0.74 + 0.22 * Math.pow(0.5 + 0.5 * Math.sin(q + br(x, y, 24, 14) * 3), 1.4) + 0.05 * (br(x, y, 64, 15) - 0.5); },
  ];
  for (let L = 0; L < NL; L++) for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = Math.max(0, Math.min(1, F[L](x, y))), k = ((L * N + y) * N + x) * 4;
      D[k] = 255 * v; D[k + 1] = 252 * v; D[k + 2] = 246 * v; D[k + 3] = 255;
    }
    if ((y & 31) === 31) yield;
  }
  const t = new T.DataArrayTexture(D, N, N, NL);
  t.format = T.RGBAFormat; t.type = T.UnsignedByteType; t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
// Tygmaterialets shader: väven ur texturarrayen, och sammetens lugg (ljusare i flykt).
function tygPatch(mt, arr) {
  if (!arr) return mt;
  mt.onBeforeCompile = sh => {
    sh.uniforms.tygArr = { value: arr };
    sh.vertexShader = 'attribute vec3 tyguv;\nvarying vec3 vTyg;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTyg = tyguv;');
    sh.fragmentShader = 'precision highp sampler2DArray;\nuniform sampler2DArray tygArr;\nvarying vec3 vTyg;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n  vec3 tygProv = texture(tygArr, vec3(vTyg.xy, floor(vTyg.z + 0.5))).rgb;\n  diffuseColor.rgb *= tygProv;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + reliefGLSL('tygProv.g', 0.0022) + '\n  if (abs(vTyg.z - 3.0) < 0.5) { float tf = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0); diffuseColor.rgb *= 0.78 + 0.62 * tf * tf; }');
  };
  mt.customProgramCacheKey = () => 'inne-tyg' + (mt.transparent ? '-t' : '');
  return mt;
}
// Varmt sken (additivt) från lamporna: vänster halva en mjuk ruta (9-delad), höger halva
// en kägla mot väggen (spotlight som träffar väggen uppifrån).
function skenTextur() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d'), d = x.createImageData(128, 64);
  const ss = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  for (let j = 0; j < 64; j++) for (let i = 0; i < 128; i++) {
    let a;
    if (i < 64) { const u = (i + 0.5) / 64, v = (j + 0.5) / 64, g = t => ss(t / 0.5) * ss((1 - t) / 0.5); a = Math.pow(g(u) * g(v), 1.6); }
    else { const X = ((i - 64 + 0.5) / 64 - 0.5) * 2, Y = (j + 0.5) / 64, kant = 0.1 + 0.75 * X * X;
      a = Y < kant ? 0 : ss((Y - kant) / 0.07) * Math.exp(-(Y - kant) * 2.4) * ss((1 - Math.abs(X)) / 0.35) * ss((1 - Y) / 0.2); }
    const k = (j * 128 + i) * 4; d.data[k] = d.data[k + 1] = d.data[k + 2] = 255; d.data[k + 3] = Math.round(255 * Math.min(1, a));
  }
  x.putImageData(d, 0, 0);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function skenMaterial(tex) {
  const m = new T.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, vertexColors: true, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: true });
  const u = { value: new Float32Array(32) };
  m.userData.ljus = u;
  m.onBeforeCompile = sh => {
    sh.uniforms.uLjus = u;
    sh.vertexShader = 'attribute float lnr;\nuniform float uLjus[32];\nvarying float vLjus;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLjus = uLjus[int(lnr + 0.5)];');
    sh.fragmentShader = 'varying float vLjus;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vLjus;');
  };
  m.customProgramCacheKey = () => 'inne-sken';
  return m;
}

// Neutral omgivning för väggar och tak: varmvitt ovanifrån, ljust i horisonten och
// trägolv nedtill, så att utemiljöns gröna mark inte färgar väggarna.
function neutralMiljo() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#f7f3ec'); g.addColorStop(0.45, '#ece7df'); g.addColorStop(0.52, '#e0d7ca'); g.addColorStop(1, '#cbbda8');   // (golvets studs ljusare och mindre brun: taken blev mörkt beige)
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const t = new T.CanvasTexture(c);
  t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace;
  return t;
}

// Glans per hörn: attributet rgh multiplicerar materialets roughness (keramik, kakel),
// så att svart glas på hällen och blanka väggplattor delar ritanrop med resten.
function glansPatch(mt, djup = 0) {
  mt.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float rgh;\nvarying float vRgh;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRgh = rgh;');
    sh.fragmentShader = 'varying float vRgh;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor * vRgh, 0.04, 1.0);');
    if (djup && mt.map) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + reliefGLSL(LJUSHET, djup));
  };
  mt.customProgramCacheKey = () => 'inne-rgh' + (djup && mt.map ? '-r' : '');
  return mt;
}
// Relief utan extra texturuppslag: normalen lutas efter höjdens (ljushetens) skärmderivata,
// i verklig skala (djup i meter mellan svart och vitt). Fogar, springor, ådring och väv får
// djup i släpljus. Tonar bort när en bildpunkt täcker mer än ett par centimeter (inget flimmer).
const LJUSHET = 'dot(sampledDiffuseColor.rgb, vec3(0.3333))';
const reliefGLSL = (h, djup) => `
  { vec3 rsx = -dFdx(vViewPosition), rsy = -dFdy(vViewPosition); float rh = ${h};
    float rfp = max(dot(rsx, rsx), dot(rsy, rsy));
    vec3 r1 = cross(rsy, normal), r2 = cross(normal, rsx); float rdet = dot(rsx, r1);
    vec3 rg = (dFdx(rh) * r1 + dFdy(rh) * r2) * (${djup.toFixed(5)} * (1.0 - smoothstep(0.00004, 0.0006, rfp)) * sign(rdet) / max(abs(rdet), 1e-9));
    float rl = length(rg); if (rl > 0.7) rg *= 0.7 / rl;
    normal = normalize(normal - rg); }`;
// material med vanlig färgkarta: relief ur kartan, och springorna (mörkt) lite mattare
function reliefPatch(mt, djup, namn, matt = 0, mitt = 0.4) {
  if (!mt.map) return mt;
  mt.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + reliefGLSL(LJUSHET, djup));
    if (matt) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor * (1.0 + ${matt.toFixed(3)} * (${mitt.toFixed(3)} - ${LJUSHET})), 0.04, 1.0);`);
  };
  mt.customProgramCacheKey = () => 'inne-relief-' + namn;
  return mt;
}
const GLANS = ['keramik', 'kakel', 'klinker'];

// Spegelns egen omgivning: ett ljust badrum målat som ekvirektangulär bild (väggar i
// storformatskakel, ljust tak med en lampa, ett dagsljusfönster, handdukar, golv).
function spegelMiljo() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const x = c.getContext('2d');
  x.scale(2, 2);
  let g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#fbfaf8'); g.addColorStop(0.3, '#f2efea'); g.addColorStop(0.5, '#ebe7e0'); g.addColorStop(0.62, '#dcd6cc');
  g.addColorStop(0.66, '#b8b0a4'); g.addColorStop(1, '#8f877c');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  x.fillStyle = 'rgba(150,140,128,0.35)';
  for (let X = 0; X < 1024; X += 64) x.fillRect(X, 150, 2, 190);
  [210, 275, 340].forEach(Y => x.fillRect(0, Y, 1024, 2));
  for (let k = 0; k < 4; k++) { const X = 128 + k * 256, h = x.createLinearGradient(X - 40, 0, X + 40, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(70,60,50,0.16)'); h.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = h; x.fillRect(X - 40, 140, 80, 210); }
  g = x.createLinearGradient(0, 170, 0, 300); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8eef2');
  x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(590, 165, 130, 145);
  x.fillStyle = g; x.fillRect(600, 175, 110, 125);
  x.fillStyle = '#f6f4f0'; x.fillRect(652, 175, 6, 125);
  x.fillStyle = '#e9e2d6'; x.fillRect(250, 215, 46, 90); x.fillStyle = '#b9a688'; x.fillRect(302, 240, 34, 60);
  x.fillStyle = '#d8d2c8'; x.fillRect(860, 150, 70, 190); x.fillStyle = '#3a3634'; x.fillRect(915, 250, 8, 4);
  // tydligare föremål runt om, så att reflexen läses som ett rum
  x.fillStyle = 'rgba(120,108,96,0.55)';
  for (let X = 32; X < 1024; X += 64) x.fillRect(X, 150, 2, 190);
  x.fillStyle = '#8a6a4a'; x.fillRect(0, 300, 420, 14); x.fillRect(0, 314, 420, 40); x.fillStyle = '#9c7a56'; x.fillRect(0, 314, 420, 3);
  x.fillStyle = '#f7f6f3'; x.beginPath(); x.ellipse(160, 300, 50, 12, 0, 0, 2 * PI); x.fill();
  x.fillStyle = '#1e1d1c'; x.fillRect(150, 255, 6, 45); x.fillRect(150, 255, 24, 6);
  x.fillStyle = '#4f6b3e'; x.beginPath(); x.arc(360, 282, 20, 0, 2 * PI); x.fill(); x.fillStyle = '#e2dbcf'; x.fillRect(348, 290, 24, 14);
  x.fillStyle = '#2a2826'; x.fillRect(848, 145, 6, 200); x.fillRect(936, 145, 6, 200); x.fillRect(848, 145, 94, 6);
  x.fillStyle = 'rgba(40,40,40,0.8)'; x.fillRect(700, 120, 4, 200); x.fillRect(560, 120, 4, 200);
  x.fillStyle = '#ffffff'; x.fillRect(605, 180, 100, 115);
  const l = x.createRadialGradient(512, 40, 0, 512, 40, 140); l.addColorStop(0, 'rgba(255,255,255,1)'); l.addColorStop(0.15, 'rgba(255,246,228,0.95)'); l.addColorStop(1, 'rgba(255,246,228,0)');
  x.fillStyle = l; x.fillRect(360, 0, 300, 200);
  const t = new T.CanvasTexture(c);
  t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace;
  return t;
}

// Spegelmaterialets ytstruktur: vänstra halvan blank (spegel, krom), högra halvan
// borstat stål (diskho, golvbrunn). Geometrin får uv i rätt halva vid ihopslagningen.
function stalTextur() {
  const c = DUK(256); if (!c) return null;
  const x = c.getContext('2d');
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = 'rgb(8,8,8)'; x.fillRect(0, 0, 128, 256);
  // satinerat stål: jämnt (roughness 0,4 x 0,8 = 0,32) med mycket svaga, breda skiftningar
  x.fillStyle = 'rgb(204,204,204)'; x.fillRect(128, 0, 128, 256);
  for (let i = 0; i < 24; i++) { const v = 204 + Math.round((r() - 0.5) * 14); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(132, i * 10 + 2, 120, 8); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.anisotropy = 4; return t;
}
// lägg en geometri i borstat stål
function stal(geo, m, mk = 'spegel') { geo.userData.stal = true; lagg(mk, geo, m); }
// stålbox (lokalt), som rbx men borstad
// borstat stål med neutral reflex (diskstal: speglar inte trädgårdens grönska)
function sbNeutral(w, h, d, x, y, z, r = 0.003, ry = 0) { stal(new RoundedBoxGeometry(w, h, d, 1, Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4))), mx(x, y, z, ry), 'diskstal'); }
function stalBox(w, h, d, x, y, z, r = 0.003, ry = 0) { stal(new RoundedBoxGeometry(w, h, d, 1, Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4))), mx(x, y, z, ry)); }

// Ekens ådring: mjuka, långa årsringslinjer längs u (sömlös), nästan vit (tonen i hörnen).
function ekTextur() {
  const N = 512, c = DUK(N); if (!c) return null;
  const x = c.getContext('2d');
  let s = 515; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#f4f1ec'; x.fillRect(0, 0, N, N);
  // rak ådring (inga höjdkurvor): breda, svaga band i olika ton som i sågat virke
  for (let y = 0; y < N;) { const h = 10 + r() * 40, l = r(); x.fillStyle = l < 0.5 ? `rgba(150,105,62,${0.03 + l * 0.06})` : `rgba(255,250,240,${(l - 0.5) * 0.12})`; x.fillRect(0, y, N, h); y += h; }
  // täta, nästan raka fibrer: bara en svag, långsam slingring (heltalsfrekvens, sömlöst)
  for (let i = 0; i < 260; i++) {
    const y0 = r() * N, a = 0.4 + r() * 1.4, f = 1 + Math.floor(r() * 2), ph = r() * 6, a2 = r() * 0.6, ph2 = r() * 6, al = 0.025 + r() * 0.07;
    x.strokeStyle = `rgba(118,80,46,${al})`; x.lineWidth = 0.4 + r() * 1.1;
    for (const dy of [0, -N, N]) { x.beginPath(); for (let u = 0; u <= N; u += 8) { const t = u / N * 2 * PI, yy = y0 + dy + a * Math.sin(t * f + ph) + a2 * Math.sin(t * 5 + ph2); u ? x.lineTo(u, yy) : x.moveTo(u, yy); } x.stroke(); }
  }
  // porer: korta streck längs fibrerna
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(90,60,35,${0.03 + r() * 0.06})`; x.fillRect(r() * N, r() * N, 3 + r() * 14, 0.8 + r() * 0.6); }
  return tex(c, true);
}

function lagaMaterial() {
  if (MAT) return MAT;
  const it = lagaMaterialSteg(); let r = it.next(); while (!r.done) r = it.next();
  return MAT;
}
// Texturerna byggs en i taget, med en paus (yield) mellan: inredningens bygge körs i små
// steg när datorn är ledig, och ett enda steg med alla texturer tog flera sekunder på mobil
// (kameran stod still efter Se inne). Tygbiblioteket ger också en paus per lager. Resultatet
// sparas i MAT och delas av alla hus, så det görs bara första gången.
let TEXV = null;
function* lagaMaterialSteg() {
  if (MAT) return MAT;
  const tx = TEXV || (TEXV = {});
  const steg = [['karta', plankTextur], ['blad', bladTexturSteg], ['tryck', tryckTexturSteg], ['kakel', () => kakelTexturSteg(2)], ['klinker', () => kakelTexturSteg(1)],
    ['ek', ekTextur], ['stal', stalTextur], ['spegelM', spegelMiljo], ['neutral', neutralMiljo], ['skugga', skuggTextur], ['sken', skenTextur], ['eld', eldTexturSteg]];
  // (bladatlasen och tryckatlasen ritas själva i flera steg, med en paus mellan motiven)
  for (const [k, f] of steg) if (!(k in tx)) { const v = f(); tx[k] = v && typeof v.next === 'function' ? yield* v : v; yield; }
  if (!('vavar' in tx)) { const it = tygBibliotekSteg(); let r = it.next(); while (!r.done) { yield; r = it.next(); } tx.vavar = r.value; }
  // linnetexturen behövs bara om tygbiblioteket saknas (ingen texturarray): förr byggdes den alltid
  if (!('linne' in tx)) { tx.linne = tx.vavar ? null : linneTextur(); yield; }
  if (MAT) return MAT;
  const S = o => new T.MeshStandardMaterial({ vertexColors: true, ...o });
  const karta = tx.karta, blad = tx.blad, tryck = tx.tryck, kakel = tx.kakel, klinker = tx.klinker, linne = tx.linne, vavar = tx.vavar;
  const tNeutral = () => tx.neutral, tSpegel = () => tx.spegelM, tEk = () => tx.ek, tStal = () => tx.stal, tSkugga = () => tx.skugga, tSken = () => tx.sken, tEld = () => tx.eld;
  // vägg/vit/tyg har vit grundfärg: tonen ligger i hörnfärgerna (se GRUND och ALIAS)
  MAT = {
    golv: reliefPatch(S({ color: karta ? 0xffffff : 0xc29b70, map: karta, roughness: 0.64, envMapIntensity: 0.7 }), 0.0026, 'golv', 0.5),
    vagg: S({ color: 0xffffff, roughness: 0.94, envMapIntensity: 0.65, envMap: tNeutral() }),
    ek: reliefPatch(S({ color: 0xc69c6d, map: tEk(), roughness: 0.5, envMapIntensity: 0.75 }), 0.0022, 'ek', 1.6, 0.86),
    tyg: tygPatch(S({ color: 0xffffff, map: vavar ? null : linne, roughness: 0.97, side: T.DoubleSide, envMapIntensity: 0.6 }), vavar),
    // gardiner: linne, lätt genomskinligt (och svagt självlysande i dagsljus, se ENV)
    gardin: tygPatch(S({ color: 0xffffff, map: vavar ? null : linne, roughness: 0.96, side: T.DoubleSide, transparent: true, opacity: 0.9, forceSinglePass: true, emissive: 0xfff4e6, emissiveIntensity: 0, envMapIntensity: 0.6 }), vavar),
    vit: S({ color: 0xffffff, roughness: 0.66, envMapIntensity: 0.7 }),
    svart: S({ color: 0x1f1e1c, roughness: 0.58, metalness: 0.35 }),
    keramik: glansPatch(S({ color: 0xf2efea, roughness: 0.26, envMapIntensity: 0.9 })),
    // väggplattor med mjuk glans (0,35), golvplattor matta (rgh 2 -> 0,7)
    kakel: glansPatch(S({ color: 0xffffff, map: kakel, roughness: 0.35, envMapIntensity: 0.9 }), 0.004),
    klinker: glansPatch(S({ color: 0xffffff, map: klinker, roughness: 0.35, envMapIntensity: 0.9 }), 0.004),
    // spegel och krom: egen målad badrumsomgivning som reflex (ingen realtidsspegel)
    spegel: S({ color: 0xe2e2de, metalness: 1, roughness: 0.4, roughnessMap: tStal(), envMap: tSpegel(), envMapIntensity: 1 }),
    // diskho: eget borstat rostfritt, neutral reflex (inte badrummets målade omgivning)
    diskstal: S({ color: 0xd9d6d0, metalness: 0.82, roughness: 0.46, envMap: tNeutral(), envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    blad: S({ color: 0xffffff, map: blad, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.55, envMapIntensity: 0.6 }),
    tryck: S({ color: 0xffffff, map: tryck, roughness: 0.88, envMapIntensity: 0.55 }),
    // glas: genomskinligt med en svag reflex av rummet (ingen djupskrivning: inget flimmer mot det bakom)
    glas: new T.MeshStandardMaterial({ color: 0xdde7e9, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, envMap: tSpegel(), envMapIntensity: 0.55 }),
    // allt som lyser: motorn styr emissiveIntensity efter kvällen (userData.lampMaterial)
    lampa: new T.MeshStandardMaterial({ color: 0xf7f3ec, emissive: 0xffbd7d, emissiveIntensity: 0.8, roughness: 0.6 }),   // ~2700 K
    // lampskärmar i linne: svagt självlysande på kvällen (userData.skarmMaterial)
    skarm: S({ color: 0xffffff, emissive: 0xffbd7d, emissiveIntensity: 0.0, roughness: 0.95, side: T.DoubleSide, envMapIntensity: 0.6 }),
    skugga: new T.MeshBasicMaterial({ map: tSkugga(), color: 0xffffff, transparent: true, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    osynlig: new T.MeshBasicMaterial({ visible: false }),
  };
  MAT.skenTex = tSken();
  // levande ljus: varje låga får en egen kopia (motorn kan fladdra dem var för sig)
  MAT.flamma = new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa448, emissiveIntensity: 2.2, roughness: 1, transparent: true, opacity: 0.92, depthWrite: false });
  // kaminens glöd (glödbädd och lågor bakom glaset): userData.eld.material
  // Lågor, glödbädd och skenet på glasets insida: additivt och mjukt (eldTextur, uv väljer del)
  MAT.eld = new T.MeshBasicMaterial({ map: tEld(), color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  return MAT;
}
// gamla materialnamn slås ihop med andra (färgen läggs i hörnfärgerna)
const ALIAS = { linne: ['tyg', '#e8e1d5'], matta: ['tyg', '#d8cdbb'], front: ['vit', '#8b9483'], tak: ['vagg', '#f0ede7'] };
const GRUND = { vit: '#ebe7df', vagg: '#ece8e1' };

// ---- Grundverktyg ----
const V = (x, y, z) => new T.Vector3(x, y, z);
const rnd = () => (SEED = (SEED * 16807) % 2147483647) / 2147483647;

// färg (sRGB-hex) för allt som läggs inom fn
function ton(hex, fn) { const f = TON; TON = DAMPA && hex ? damp(hex, DAMPA) : hex; const r = fn(); TON = f; return r; }
// allt som färgsätts inom fn dämpas mot varmt gråbeige (matvaror: inga leksaksklara färger)
let DAMPA = 0;
function dampat(t, fn) { const f = DAMPA; DAMPA = t; try { return fn(); } finally { DAMPA = f; } }
// insida: ytor inom fn vars normal pekar mot punkten c (lokalt) får tonen hex
function inne(hex, c, fn) { const f = INNE; INNE = { hex, c: c.clone().applyMatrix4(BAS) }; const r = fn(); INNE = f; return r; }
// väv (lager i tygbiblioteket) för allt tyg som läggs inom fn
function vav(namn, fn) { const f = VAVL; VAVL = VAV[namn] ?? VAVL; const r = fn(); VAVL = f; return r; }
// glans (roughness-faktor för keramik och kakel) för allt som läggs inom fn
function glans(v, fn) { const f = RGH; RGH = v; const r = fn(); RGH = f; return r; }

function lagg(mk, geo, m) {
  if (m) geo.applyMatrix4(m);
  let tn = TON;
  if (ALIAS[mk]) { tn = tn ?? ALIAS[mk][1]; mk = ALIAS[mk][0]; }
  if (!tn && GRUND[mk]) tn = GRUND[mk];
  geo.userData.ton = tn;
  if (RGH !== 1) geo.userData.rgh = RGH;
  if (INNE) geo.userData.inne = INNE;
  if (VAVL != null) geo.userData.vav = VAVL;
  if (LOS) geo.userData.los = true;
  const key = LAGER + '|' + mk;
  let l = ACC.get(key);
  if (!l) ACC.set(key, l = []);
  l.push(geo);
}

// ---- Rörliga delar, egna lampor och sittplatser ----
// Det som läggs inom fn samlas i en egen materialkarta (inte i husets sammanslagning),
// i ramen m (husets system). Inne i fn är koordinaterna lokala i den ramen.
function fanga(m, fn) {
  const accF = ACC, basF = BAS, acc = new Map();
  ACC = acc; BAS = new T.Matrix4();
  try { fn(); } finally { ACC = accF; BAS = basF; }
  return acc;
}
// Öppningsbar del: m = ram vid gångjärnet (eller lådans stängda läge) i husets system.
// Motorn vrider/skjuter obj (en tom grupp i ramen, 0 = stängd) längs axel med max.
function oppningsbar(namn, typ, axel, max, start, m, fn, rum = null) {
  const acc = fanga(m, fn), fast = new T.Group(), obj = new T.Group();
  const p = V(0, 0.5, 0).applyMatrix4(m);
  rum = rum ?? rumVid(p.x, p.z, p.y) ?? '';
  // Luckor och lådor hör inte till något rum: motorn gömmer annars rörliga delar i rum som
  // inte "syns" från rummet man senast stod nära (närmaste rumspunkt inom 1,6 m, utan hänsyn
  // till väggar och öppna dörrar). Då stod skåp, kyl och garderober utan luckor – allt
  // innehåll syntes fast de var stängda. Det rör 15–40 små meshar per hus.
  if (typ !== 'dorr') rum = '';
  m.decompose(fast.position, fast.quaternion, fast.scale);
  fast.name = 'fäste-' + namn; obj.name = namn; fast.add(obj);
  if (PROV && PROV.oppna && PROV.oppna.test(namn)) start = 1;
  if (start) { if (typ === 'lada') obj.position[axel] = max; else obj.rotation[axel] = max; }
  OPP.push({ obj, fast, typ, axel, max, start, namn, rum, acc, m, lager: LAGER });
  return OPP.length - 1;
}
// närmaste rum (genomgångens ståplatser) för en punkt i husets system
// (vägg mellan två punkter på golvnivå, dörröppningar räknas som fria)
function blockerad(ax, az, bx, bz) {
  return VAGGAR.some(w => {
    if (w.bunn > 0) return false;
    const [pa, pb, sa, sb] = w.axel === 'x' ? [az, bz, ax, bx] : [ax, bx, az, bz];
    if ((pa - w.c) * (pb - w.c) >= 0) return false;
    const s = sa + (sb - sa) * (w.c - pa) / (pb - pa);
    return s > w.lo - 0.02 && s < w.hi + 0.02 && !w.hal.some(h => h.h > 1.8 && s > h.a && s < h.b);
  });
}
function rumVid(x, z, y = null) {
  const loft = y != null ? (y > LT - 0.05 && iLoft(x, z)) : LAGER === 'loft';
  let b = null, bd = 1e9;
  // i badrummet hör allt till badrummets egen punkt (väggarna kan vara ritade först senare)
  const br = !loft && BADRUM ? BADRUM.find(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) : null;
  (RUM[ID] || []).forEach(([namn, rx, rz, nv]) => {
    if ((nv === 'loft') !== loft) return;
    const d = Math.hypot(rx - x, rz - z) + (!loft && blockerad(x, z, rx, rz) ? 50 : 0) + (br && !(rx > br.x0 && rx < br.x1 && rz > br.z0 && rz < br.z1) ? 20 : 0);
    if (d < bd) { bd = d; b = namn; }
  });
  return b;
}
// Lampa med egen mesh och egen materialkopia (lampa/skarm). Det som läggs inom fn ska
// bara vara den lysande delen. grupp: samla flera (spotar) i samma rum under ett namn.
// halo: glorior [[x, y, z, storlek], ...] lokalt (motorn), [] = ingen; annars en i lampans mitt.
function egenLampa(namn, q, fn, grupp = false, halo = null) {
  const p = V(...q).applyMatrix4(BAS), m0 = BAS.clone();
  const hv = halo && halo.map(([x, y, z, ...s]) => [...V(x, y, z).applyMatrix4(BAS).toArray().map(v => Math.round(v * 1000) / 1000), ...s]);
  const rum = rumVid(p.x, p.z, p.y) || '';
  const nyckel = grupp ? namn + '|' + rum + '|' + LAGER : null;
  const acc = fanga(m0, fn);
  // grupperade lampor byggs i husets ram: geometrin flyttas dit
  if (grupp) for (const [, l] of acc) l.forEach(g => g.applyMatrix4(m0));
  const f = nyckel && LAMPOR.find(l => l.nyckel === nyckel);
  if (f) {
    for (const [k, l] of acc) { if (!f.acc.has(k)) f.acc.set(k, []); f.acc.get(k).push(...l); }
    f.n++; f.sum.add(p); f.pos = f.sum.clone().divideScalar(f.n).toArray().map(v => Math.round(v * 100) / 100);
    if (hv) f.halo = [...(f.halo || []), ...hv];
    return LAMPOR.indexOf(f);
  }
  const mesh = new T.Group();
  if (!grupp) m0.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.name = 'lampa-' + namn;
  LAMPOR.push({ namn: grupp ? namn + ' ' + rum.toLowerCase() : namn, rum, pos: p.toArray().map(v => Math.round(v * 100) / 100), mesh, acc, m: grupp ? null : m0, lager: LAGER, nyckel, n: 1, sum: p.clone(), halo: hv, los: LOS });
  return LAMPOR.length - 1;
}
// Varmt sken från lampa nr i på en yta (lokalt): mitt (x, y, z), w x d, mjuk kant m.
// Plant (normal +y) eller mot en vägg (vagg = true: normal +z, d uppåt). kagla = spotens
// ljuskägla mot väggen (överkanten vid y + d/2). Följer lampans glöd, ingen egen lampa.
function sken(i, x, y, z, w, d, alfa = 0.5, vagg = false, m = 0.1, kagla = false, ry = 0) {
  if (i == null || i < 0 || i > 31) return;
  const pos = [], uv = [], ix = [];
  if (kagla) {
    [[-w / 2, -d / 2, 0.5, 1], [w / 2, -d / 2, 1, 1], [-w / 2, d / 2, 0.5, 0], [w / 2, d / 2, 1, 0]].forEach(([a, b, u, v]) => { pos.push(a, 0, b); uv.push(u, v); });
    ix.push(0, 2, 1, 1, 2, 3);
  } else {
    const xs = [-w / 2 - m, -w / 2, w / 2, w / 2 + m], zs = [-d / 2 - m, -d / 2, d / 2, d / 2 + m], tu = [0, 0.25, 0.25, 0.5], tv = [0, 0.5, 0.5, 1];
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) { pos.push(xs[k], 0, zs[j]); uv.push(tu[k], tv[j]); }
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { const a = j * 4 + k; ix.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.userData.alfa = alfa; g.userData.lnr = i;
  // plana sken stannar innanför ytterväggarna
  g.applyMatrix4(vagg ? mx(x, y, z, ry, PI / 2) : mx(x, y, z, ry));
  if (!vagg) { const pa = g.attributes.position, gx = HH.L / 2 - I - 0.005, gz = HH.W / 2 - I - 0.005; for (let k = 0; k < pa.count; k++) { pa.setX(k, Math.max(-gx, Math.min(gx, pa.getX(k)))); pa.setZ(k, Math.max(-gz, Math.min(gz, pa.getZ(k)))); } }
  ton('#ffcf9c', () => lagg('sken', g));
}
// Spegelglas: egen mesh (motorn renderar en kubkamera från spegeln och sätter envMap),
// med en tunn fasad stålkant. Ramen ligger i spegelns mitt.
function spegelYta(x, y, z, r) {
  const m = BAS.clone().multiply(new T.Matrix4().makeTranslation(x, y, z));
  SPEGLAR.push({ acc: fanga(m, () => lagg('spegel', new T.CircleGeometry(r, 64), mx(0, 0, 0))), m, lager: LAGER, mesh: new T.Group() });
  lagg('spegel', new T.TorusGeometry(r, 0.004, 6, 64), mx(x, y, z - 0.001));
}
// Sittplats: ögonpunkt (lokalt) och blickpunkt, och en osynlig träffyta för strålen.
function sitt(namn, pos, mal, yta) {
  const P = V(...pos).applyMatrix4(BAS), M = V(...mal).applyMatrix4(BAS), r = v => Math.round(v * 100) / 100;
  const [w, h, d, x, y, z] = yta;
  const g = new T.Mesh(new T.BoxGeometry(w, h, d), MAT.osynlig);
  g.matrixAutoUpdate = false; g.matrix.copy(BAS.clone().multiply(new T.Matrix4().makeTranslation(x, y, z))); g.matrixWorldNeedsUpdate = true;
  g.name = 'sitt-' + namn; g.userData.sitt = SITT.length;
  SITT.push({ namn, pos: [r(P.x), r(P.y), r(P.z)], mal: [r(M.x), r(M.y), r(M.z)], niva: LAGER === 'loft' ? 'loft' : 'botten', yta: g, los: LOS });
}

// Gånghinder: rektangel (lokalt i möbelns system) som axelparallell ruta i husets system.
function hind(w, d, cx = 0, cz = 0) {
  if (!HINDER) return;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = V(cx + sx * w / 2, 0, cz + sz * d / 2).applyMatrix4(BAS);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
  }
  const r = v => Math.round(v * 1000) / 1000;
  HINDER.push({ x0: r(x0), z0: r(z0), x1: r(x1), z1: r(z1), niva: LAGER === 'loft' ? 'loft' : 'botten', typ: 'mobel', los: LOS });
}

// Plan rektangel i lokalt XY (normal +z), mitt i origo. cell = atlasruta, annars uv 0..1.
function platta(mk, w, h, m, cell = null, n = null) {
  const g = new T.PlaneGeometry(w, h, n ? n[0] : Math.max(1, Math.ceil(w / 0.45)), n ? n[1] : Math.max(1, Math.ceil(h / 0.45)));
  if (cell) {
    const [a, b, c, d] = cellUV(cell), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, a + (c - a) * uv.getX(i), b + (d - b) * uv.getY(i));
  }
  lagg(mk, g, m);
}

// Bladkort: böjt och vikt längs mittnerven, basen i (x, y, z), lutar lut från lodlinjen
// åt azimut az. Längden len, bredden följer cellens proportioner.
const BLADTON = ['#ffffff', '#eef3e6', '#f6f4ea', '#dfe8d6', '#e8eedb', '#fbfbf2'];
function bladkort(cell, len, x, y, z, az, lut, o = {}) {
  const bred = len * cell[2] / cell[3] * (o.bred ?? 1), vik = o.vik ?? 0.12, bag = o.bag ?? 0.18, ny = o.ny ?? 3, nx = o.nx ?? 2, kupa = o.kupa ?? 0;
  const [u0, v0, u1, v1] = cellUV(cell);
  const pos = [], uv = [], ix = [];
  for (let j = 0; j <= ny; j++) {
    const t = j / ny;
    for (let i = 0; i <= nx; i++) {
      const s = i / nx - 0.5, kant = Math.sin(PI * Math.min(1, t * 1.15));   // skålningen klingar av mot bas och spets
      pos.push(s * bred, t * len * (1 - bag * t * 0.3), -vik * Math.abs(s) * bred - kupa * s * s * bred * kant + bag * t * t * len);
      uv.push(u0 + (u1 - u0) * (s + 0.5), v0 + (v1 - v0) * t);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; ix.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeVertexNormals();
  const rull = o.rull ?? (rnd() - 0.5) * 0.6, gx = HH.L / 2 - I - 0.02, gz = HH.W / 2 - I - 0.02;
  // bladets bas i husets system: väggprovet jämförde förr möbelns lokala läge med väggarnas
  // läge i huset, så blad i möbelramar (hyllor, bord, bänkar) nära origo räknades som "genom
  // väggen" och krymptes till en fjärdedel (slingväxterna såg kala ut i pulpet-70 och sadel-90)
  const bv = V(x, y, z).applyMatrix4(BAS);
  const ute = mm => {
    let ux = 0, uz = 0;
    const p = g.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mm); if (Math.abs(v.x) > gx) ux = 1; if (Math.abs(v.z) > gz) uz = 1;
      // mellanväggar: bladet får inte gå igenom till rummet bredvid
      for (const w of VAGGAR) {
        const bs = w.axel === 'x' ? bv.z - w.c : bv.x - w.c, vs = w.axel === 'x' ? v.z - w.c : v.x - w.c, ls = w.axel === 'x' ? v.x : v.z;
        if (Math.abs(bs) < 0.9 && Math.sign(bs) !== Math.sign(vs - Math.sign(bs) * (w.t / 2 + 0.01)) && ls > w.lo && ls < w.hi && v.y > w.bunn && v.y < 2.6) { if (w.axel === 'x') uz = 1; else ux = 1; }
      }
    }
    return ux || uz ? [ux, uz] : null;
  };
  let m = mx(x, y, z, az, lut, rull);
  for (let f = 0; f < 3; f++) {
    const u = ute(m); if (!u) break;
    if (u[0]) az = -az; if (u[1]) az = PI - az;
    if (f === 1) lut *= 0.5;
    m = mx(x, y, z, az, lut, rull);
  }
  // når bladet ändå en vägg krymps det mot basen (det sitter kvar på skaftet)
  let sk = 1;
  for (let f = 0; f < 6 && ute(m); f++) { g.scale(0.8, 0.8, 0.8); sk *= 0.8; }
  ton(o.ton ?? BLADTON[Math.floor(rnd() * BLADTON.length)], () => lagg('blad', g, m));
  // bladets läge längs mittnerven (t 0..1) i husets system, för skaft som ska nå bladet
  return t => V(0, t * len * (1 - bag * t * 0.3) * sk, bag * t * t * len * sk).applyMatrix4(m);
}
// riktning för (az, lut) enligt mx: lokalt +y efter YXZ-rotationen
const rikt = (az, lut) => V(Math.sin(lut) * Math.sin(az), Math.cos(lut), Math.sin(lut) * Math.cos(az));

function mx(x, y, z, ry = 0, rx = 0, rz = 0) {
  const q = new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ'));
  return BAS.clone().multiply(new T.Matrix4().compose(V(x, y, z), q, V(1, 1, 1)));
}

function box(mk, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  lagg(mk, new T.BoxGeometry(w, h, d), mx(x, y, z, ry, rx, rz));
}

function rbx(mk, w, h, d, x, y, z, r = 0.03, ry = 0, rx = 0, seg = 2, rz = 0) {
  const rr = Math.max(0.001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  lagg(mk, new RoundedBoxGeometry(w, h, d, seg, rr), mx(x, y, z, ry, rx, rz));
}

function cyl(mk, rt, rb, h, x, y, z, seg = 16, oppen = false, rx = 0, rz = 0) {
  lagg(mk, new T.CylinderGeometry(rt, rb, h, seg, 1, oppen), mx(x, y, z, 0, rx, rz));
}

// Svarvad form: profil [[r, y], ...] nerifrån och upp.
function svarv(mk, prof, x, y, z, seg = 18) {
  lagg(mk, new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), seg), mx(x, y, z));
}

// Möbel i eget system: (x, z) på golvet, vriden ry runt y. Lokalt +z = framsidan.
function med(x, z, ry, fn) {
  const gammal = BAS;
  BAS = gammal.clone().multiply(new T.Matrix4().makeTranslation(x, 0, z)).multiply(new T.Matrix4().makeRotationY(ry));
  fn();
  BAS = gammal;
}
// flytta allt som läggs inom fn (lokalt) med (x, y, z), t.ex. en lucka relativt sitt gångjärn
function forskjut(x, y, z, fn) {
  const gammal = BAS;
  BAS = gammal.clone().multiply(new T.Matrix4().makeTranslation(x, y, z));
  try { fn(); } finally { BAS = gammal; }
}
// Gångjärnsram för en lucka: gångjärnet i mitten av luckans kant (i plan), så att luckan i
// öppet läge ligger an mot stommens framkant i stället för att sväva framför den.
// xe: luckans kant på gångjärnssidan, hs: +1 = luckan sträcker sig åt +x, zb: luckans baksida.
// fn ritas som förut: lokalt x 0..bredd från kanten, z = 0 i luckans mitt (tjocklek t).
function gangjarnsLucka(namn, xe, hs, zb, t, fn, max = 1.55) {
  const Xa = V(hs, 0, 0), Za = V(0, 0, 0).crossVectors(Xa, V(0, 1, 0)), zs = Za.z;
  const m = BAS.clone().multiply(new T.Matrix4().makeBasis(Xa, V(0, 1, 0), Za).setPosition(xe + hs * t / 2, 0, zb + t / 2));
  return oppningsbar(namn, 'lucka', 'y', (zs < 0 ? 1 : -1) * max, 0, m, () => forskjut(-t / 2, 0, 0, () => fn(zs)));
}

// Fyrhörning i husets system med given normal (vänds rätt automatiskt).
function quad(mk, a, b, c, d, n) {
  const pos = [], nor = [];
  const tri = (p, q, r) => {
    const k = V(0, 0, 0).subVectors(q, p).cross(V(0, 0, 0).subVectors(r, p));
    if (k.dot(n) < 0) { const t = q; q = r; r = t; }
    [p, q, r].forEach(v => { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); });
  };
  tri(a, b, c); tri(a, c, d);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  lagg(mk, g, BAS);
}

// Konvex polygon i världskoordinater; framsidan vänds mot punkten mot.
function poly(mk, pts, mot) {
  const a = pts[0];
  const n = V(0, 0, 0).subVectors(pts[1], a).cross(V(0, 0, 0).subVectors(pts[2], a)).normalize();
  if (mot && n.dot(V(0, 0, 0).subVectors(mot, a)) < 0) { pts = pts.slice().reverse(); n.negate(); }
  const pos = [], nor = [];
  for (let i = 1; i < pts.length - 1; i++) {
    [pts[0], pts[i], pts[i + 1]].forEach(p => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); });
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  lagg(mk, g);
}

// Brytlinjer för finmaskiga ytor: tätt vid kanter (där ocklusionen sitter), glest i mitten.
function bryt(lo, hi, kanter = [], steg = 0.42, fina = [0.06, 0.16, 0.34]) {
  const maste = [lo, hi, ...kanter.filter(k => k > lo + 0.005 && k < hi - 0.005)];
  const ut = [...new Set(maste.map(v => Math.round(v * 1e4) / 1e4))];
  const valfria = [];
  [lo, hi, ...kanter].forEach(k => fina.forEach(f => valfria.push(k - f, k + f)));
  for (let x = lo + steg; x < hi - steg * 0.4; x += steg) valfria.push(x);
  valfria.forEach(v => { if (v > lo && v < hi && ut.every(u => Math.abs(u - v) > 0.035)) ut.push(v); });
  return ut.sort((a, b) => a - b);
}

// Finmaskig yta i ett lokalt (u, v)-plan: P(u, v) ger punkten, topp(u) den övre
// kanten (rak per kolumn), hal = [{u0, u1, v0, v1}] lämnas tomma.
function yta(mk, P, n, us, vs, topp, hal = [], uvf = null, delad = false) {
  // delad: väggyta (v = höjd) som delas i lager vid snitthöjderna
  if (delad) vs = [...new Set([...vs, ...snitt()].map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const buf = {};
  let pos, nor, uv;
  const valj = l => { const b = buf[l] || (buf[l] = { pos: [], nor: [], uv: [] }); pos = b.pos; nor = b.nor; uv = b.uv; };
  valj(LAGER);
  const tri = (p, q, r) => {
    const k = V(0, 0, 0).subVectors(q, p).cross(V(0, 0, 0).subVectors(r, p));
    if (k.lengthSq() < 1e-12) return;
    if (k.dot(n) < 0) { const t = q; q = r; r = t; }
    [p, q, r].forEach(v => { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); if (uvf) uv.push(...uvf(v)); });
  };
  const ut = () => Object.keys(buf).forEach(l => {
    const b = buf[l];
    if (!b.pos.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
    if (uvf) g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
    iLager(l, () => lagg(mk, g));
  });
  for (let i = 0; i < us.length - 1; i++) {
    const u0 = us[i], u1 = us[i + 1];
    if (u1 - u0 < 1e-4) continue;
    const um = (u0 + u1) / 2;
    const tA = topp(u0 + 1e-4), tB = topp(u1 - 1e-4), tmin = Math.min(tA, tB);
    const rader = vs.filter(v => v < tmin - 0.02);
    for (let j = 0; j < rader.length; j++) {
      const v0 = rader[j], sista = j === rader.length - 1;
      const vm = sista ? (v0 + tmin) / 2 : (v0 + rader[j + 1]) / 2;
      if (hal.some(h => um > h.u0 && um < h.u1 && vm > h.v0 && vm < h.v1)) continue;
      if (delad) valj(lagerFor(vm));
      const a = P(u0, v0), b = P(u1, v0);
      const c = sista ? P(u1, tB) : P(u1, rader[j + 1]), d = sista ? P(u0, tA) : P(u0, rader[j + 1]);
      tri(a, b, c); tri(a, c, d);
    }
  }
  ut();
}

// Lodrät fyrhörning F(y) = [punkt sida 1, punkt sida 2] från y0 till y1, delad vid snitten.
function stav(mk, F, y0, y1, n) {
  const ys = [y0, ...snitt().filter(c => c > y0 + 0.01 && c < y1 - 0.01), y1];
  for (let i = 0; i < ys.length - 1; i++) {
    const [a, b] = F(ys[i]), [c, d] = F(ys[i + 1]);
    iLager(lagerFor((ys[i] + ys[i + 1]) / 2), () => quad(mk, a, b, d, c, n));
  }
}

const RADER = (topp) => { const r = [-0.03, 0.06, 0.16, 0.34, 0.6]; for (let v = 0.95; v < topp; v += 0.4) r.push(v); return r; };

// Golv (eller loftgolv) som finmaskigt rutnät med plankkartan.
function golvYta(x0, x1, z0, z1, y = 0.004) {
  const kx = [], kz = [];
  VAGGAR.forEach(w => { if (w.axel === 'z') kx.push(w.c - w.t / 2, w.c + w.t / 2); else kz.push(w.c - w.t / 2, w.c + w.t / 2); });
  // badrummen har eget klinkergolv (med fall mot brunnen): trägolvet har hål där
  const bad = y < 0.1 ? BADRUM : [];
  bad.forEach(b => { kx.push(b.x0, b.x1); kz.push(b.z0, b.z1); });
  const xs = bryt(x0, x1, kx.filter(v => v > x0 && v < x1), 0.45), zs = bryt(z0, z1, kz.filter(v => v > z0 && v < z1), 0.45);
  yta('golv', (u, v) => V(u, y, v), V(0, 1, 0), xs, zs, () => z1, bad.map(b => ({ u0: b.x0 + 0.002, u1: b.x1 - 0.002, v0: b.z0 + 0.002, v1: b.z1 - 0.002 })), p => [p.x / 2.4, p.z / 2.4]);
}

// Plant tak mellan två räta kanter (a0 -> a1 längs x vid z0, b0 -> b1 vid z1), y från f(x, z).
function takYta(mk, x0, x1, z0, z1, f, n) {
  const kx = VAGGAR.filter(w => w.axel === 'z').map(w => w.c);
  const xs = bryt(x0, x1, kx.filter(v => v > x0 && v < x1), 0.5);
  const zs = bryt(Math.min(z0, z1), Math.max(z0, z1), [], 0.45);
  yta(mk, (u, v) => V(u, f(u, v), v), n, xs, zs, () => Math.max(z0, z1));
}

function lagaTak(H) {
  if (H.tak === 'sadel') {
    const half = H.W / 2, xk = H.kupa ? -H.L / 2 + H.kupa.langd : -1e9;
    return (x, z) => {
      const fot = (H.kupa && z > 0 && x < xk) ? H.kupa.hk : H.he;
      return fot + (H.hr - fot) * (1 - Math.abs(z) / half) - 0.02;
    };
  }
  return (x, z) => H.hN + (H.hS - H.hN) * (z + H.W / 2) / H.W - 0.02;
}

const iLoft = (x, z) => LOFT.some(r => x > r[0] - 0.01 && x < r[1] + 0.01 && z > r[2] - 0.01 && z < r[3] + 0.01);
const takVid = (x, z) => (iLoft(x, z) ? LU : CEIL(x, z));

// ---- Skalet: foder på ytterväggarna, golv och tak ----
function ramar(H) {
  const L = H.L, W = H.W;
  return {
    S: { o: V(-L / 2, 0, W / 2), u: V(1, 0, 0), n: V(0, 0, 1), len: L },
    N: { o: V(L / 2, 0, -W / 2), u: V(-1, 0, 0), n: V(0, 0, -1), len: L },
    E: { o: V(L / 2, 0, W / 2), u: V(0, 0, -1), n: V(1, 0, 0), len: W },
    W: { o: V(-L / 2, 0, -W / 2), u: V(0, 0, 1), n: V(-1, 0, 0), len: W },
  };
}

function ramMatris(f, djup) {
  const m = new T.Matrix4().makeBasis(f.u, V(0, 1, 0), f.n);
  m.setPosition(f.o.clone().addScaledVector(f.n, -djup));
  return m;
}

// Dörrtrycke (samma modell i hela huset): rund rosett med fasad kant mot bladet, rund hals,
// ett avrundat rör som böjer 90° ut från halsen och smalnar mot en rundad ände, och under det
// en separat rund skylt med ett vred. Lokalt i ramen M: trycket sitter i (x, y, z), bladets
// normal ut mot rummet är k·z (k = ±1), greppet pekar åt sx (±1) längs x. Allt läggs i mk.
function trycke(mk, M, x, y, z, k, sx, vred = true) {
  iRam(M, () => {
    const ros = (r, yy) => lagg(mk, new T.LatheGeometry([[0, 0], [r, 0], [r + 0.0012, 0.0025], [r, 0.006], [r - 0.004, 0.008], [0, 0.008]].map(q => new T.Vector2(q[0], q[1])), 16).rotateX(k * PI / 2), mx(x, yy, z));
    ros(0.025, y);
    lagg(mk, new T.CylinderGeometry(0.0085, 0.009, 0.046, 10, 1, true).rotateX(PI / 2), mx(x, y, z + k * 0.03));
    const P = [V(x, y, z + k * 0.046), V(x + sx * 0.012, y, z + k * 0.0575), V(x + sx * 0.04, y, z + k * 0.0605), V(x + sx * 0.09, y - 0.002, z + k * 0.0605), V(x + sx * 0.128, y - 0.004, z + k * 0.059)];
    tub(mk, P, 0.0098, 0.0078, 12, 8);
    lagg(mk, new T.SphereGeometry(0.0078, 8, 4, 0, 2 * PI, 0, PI / 2).rotateZ(-sx * PI / 2), mx(P[4].x, P[4].y, P[4].z));   // rundad ände
    lagg(mk, new T.SphereGeometry(0.0098, 8, 4), mx(P[0].x, P[0].y, P[0].z));
    if (vred === false) return;
    ros(0.019, y - 0.13);
    // vred: en liten, rundad tunga på en kort hals
    lagg(mk, new T.CylinderGeometry(0.006, 0.0065, 0.012, 8, 1, true).rotateX(PI / 2), mx(x, y - 0.13, z + k * 0.014));
    rbx(mk, 0.008, 0.03, 0.012, x, y - 0.13, z + k * 0.024, 0.0035, 0, 0, 1);
  });
}
// Fönsterhandtag: rundad rektangulär rosett mot karmen, en kort rund bas och ett platt,
// mjukt avrundat vridgrepp som pekar nedåt. Lokalt i M, normal ut i rummet k·z.
function fonsterHandtag(mk, M, x, y, z, k) {
  iRam(M, () => {
    rbx(mk, 0.034, 0.072, 0.009, x, y, z + k * 0.0045, 0.0042, 0, 0, 1);
    lagg(mk, new T.CylinderGeometry(0.0105, 0.0115, 0.02, 10, 1, true).rotateX(PI / 2), mx(x, y, z + k * 0.018));
    lagg(mk, new T.SphereGeometry(0.012, 10, 5), mx(x, y, z + k * 0.029));
    const g = new T.CapsuleGeometry(0.0078, 0.085, 3, 10).scale(1, 1, 0.68);
    lagg(mk, g, mx(x, y - 0.052, z + k * 0.031));
  });
}
// Skjutdörrens grepp: en smal, rundad stång på två runda distanser. Lokalt i M, normal k·z.
function skjutGrepp(mk, M, x, y, z, k) {
  iRam(M, () => {
    for (const dy of [-0.12, 0.12]) { lagg(mk, new T.CylinderGeometry(0.014, 0.0155, 0.004, 12).rotateX(PI / 2), mx(x, y + dy, z + k * 0.002)); lagg(mk, new T.CylinderGeometry(0.0055, 0.0055, 0.03, 8, 1, true).rotateX(PI / 2), mx(x, y + dy, z + k * 0.018)); }
    lagg(mk, new T.CapsuleGeometry(0.0095, 0.3, 3, 10), mx(x, y, z + k * 0.036));
  });
}

// Fönsterbänk i ramen m (u längs väggen, v upp, n ut från väggen negativt in i rummet):
// överkant i v, baksidan i nBak (inne i smygen), framkanten i nFram, längd L kring cu.
function fonsterBank(m, cu, v, nBak, nFram, L) {
  const t = 0.03, b = 0.004, r = 0.016, hl = L / 2 - b, s = new T.Shape();
  // planform (x = u, y = -n): rak bakkant, rundade framhörn
  const y0 = -nBak - b, y1 = -nFram - b;
  s.moveTo(-hl, y0); s.lineTo(hl, y0); s.lineTo(hl, y1 - r); s.quadraticCurveTo(hl, y1, hl - r, y1); s.lineTo(-hl + r, y1); s.quadraticCurveTo(-hl, y1, -hl, y1 - r); s.lineTo(-hl, y0);
  const g = new T.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-PI / 2).translate(cu, v - t + b, 0);
  lagg('ek', g, m.clone());
  // ändträ: mörkare, matt ton på bänkens raka ändar (0,3 mm utanför)
  ton('#8a6748', () => { for (const sd of [-1, 1]) { const q = new T.PlaneGeometry(Math.max(0.005, (y1 - r) - y0 - 0.004), t - 0.006).rotateY(sd * PI / 2).translate(cu + sd * (hl + b + 0.0003), v - t / 2, -((y0 + y1 - r) / 2)); lagg('ek', q, m.clone()); } });
  // skuggfog: en svag, mörk springa där bänkens underkant möter väggen
  ton('#7d7368', () => boxM('vagg', m, L - 0.03, 0.003, 0.002, cu, v - t - 0.0015, -I - 0.001));
}

function boxM(mk, m, w, h, d, cu, cv, cn) {
  if (w <= 0.002 || h <= 0.002) return;
  const g = new T.BoxGeometry(w, h, d);
  g.translate(cu, cv, cn);
  lagg(mk, g, m);
}

function foder(H, s, f, lista) {
  const len = f.len, ua = I, ub = len - I;
  const pkt = u => f.o.clone().addScaledVector(f.u, u).addScaledVector(f.n, -I);
  const t = u => { const p = pkt(u); return CEIL(p.x, p.z); };
  const hal = lista.map(({ o, i }) => ({
    o, i, f, s, u0: Math.max(o[1], ua + 0.01), u1: Math.min(o[1] + o[2], ub - 0.01), v0: o[3], v1: o[3] + o[4],
  })).filter(h => h.u1 > h.u0 + 0.05).sort((a, b) => a.u0 - b.u0);
  hal.forEach(h => { h.v1 = Math.min(h.v1, t(h.u0) - 0.03, t(h.u1) - 0.03); HAL.push(h); });
  const kanter = [];
  hal.forEach(h => kanter.push(h.u0, h.u1));
  if (H.tak === 'sadel' && (s === 'E' || s === 'W')) kanter.push(len / 2);
  if (s === 'S' && H.kupa) kanter.push(H.kupa.langd);
  const us = bryt(ua, ub, kanter, 0.42);
  const rader = RADER(4);
  hal.forEach(h => { rader.push(h.v0, h.v1); });
  const vs = [...new Set(rader.map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const nIn = f.n.clone().negate();
  yta('vagg', (u, v) => pkt(u).setY(v), nIn, us, vs, t, hal.map(h => ({ ...h, v0: h.v0 <= 0.01 ? -1 : h.v0 })), null, true);
}

function skal(H) {
  const R = ramar(H);
  const oppn = { S: [], N: [], E: [], W: [] };
  H.oppningar.forEach((o, i) => oppn[o[0]].push({ o, i }));
  Object.keys(R).forEach(s => foder(H, s, R[s], oppn[s]));
}

// golv och tak läggs sist, när mellanväggarna (för finmaskningen) finns
function golvOchTak(H) {
  const xa = -H.L / 2 + I, xb = H.L / 2 - I, za = -H.W / 2 + I, zb = H.W / 2 - I;
  EFTER.forEach(f => f()); EFTER = [];
  golvYta(xa, xb, za, zb);
  iLager('tak', () => takOver(H, xa, xb, za, zb));
}
function takOver(H, xa, xb, za, zb) {
  if (H.tak === 'sadel') {
    const nock = CEIL(0, 0);
    const lin = (zE, hE) => (u, v) => hE + (nock - hE) * (1 - Math.abs(v) / Math.abs(zE));
    const ned = (zE, hE) => V(0, -1, Math.sign(-zE) * (nock - hE) / Math.abs(zE)).normalize();
    const hN = CEIL(xb, za);
    takYta('tak', xa, xb, za, 0, lin(za, hN), ned(za, hN));
    if (H.kupa) {
      const xk = -H.L / 2 + H.kupa.langd, hk = CEIL(xk - 1e-3, zb), hs = CEIL(xk + 1e-3, zb);
      takYta('tak', xa, xk, 0, zb, lin(zb, hk), ned(zb, hk));
      takYta('tak', xk, xb, 0, zb, lin(zb, hs), ned(zb, hs));
      poly('tak', [V(xk, hs, zb), V(xk, hk, zb), V(xk, nock, 0)], V(xk - 1, 2.8, 1));
    } else {
      const hS = CEIL(xb, zb);
      takYta('tak', xa, xb, 0, zb, lin(zb, hS), ned(zb, hS));
    }
  } else {
    takYta('tak', xa, xb, za, zb, (u, v) => CEIL(u, v), V(0, -1, (H.hS - H.hN) / H.W).normalize());
  }
}

// Fönster- och dörrdetaljer på insidan: smyg, vit karm, bänk, foderlist, sockel.
function oppningsDetaljer(H) {
  const R = ramar(H);
  let nljus = 0;
  Object.keys(R).forEach(s => {
    const f = R[s], m0 = ramMatris(f, 0), len = f.len, ua = I, ub = len - I;
    const pkt = u => f.o.clone().addScaledVector(f.u, u).addScaledVector(f.n, -I);
    const tv = u => { const p = pkt(u); return takVid(p.x, p.z); };
    const hal = HAL.filter(h => h.s === s);
    hal.forEach(h => iLager(lagerFor(h.v0 + 0.05), () => {
      const { o } = h, typ = o[5], rutor = o[6] || 1;
      const w = h.u1 - h.u0, cu = (h.u0 + h.u1) / 2, hh = h.v1 - h.v0, cv = (h.v0 + h.v1) / 2;
      const d = I - KARM, cn = -(KARM + I) / 2;
      // smyg, målad som väggen
      boxM('vagg', m0, w + 0.04, 0.02, d, cu, h.v1 + 0.01, cn);
      boxM('vagg', m0, 0.02, hh, d, h.u0 - 0.01, cv, cn);
      boxM('vagg', m0, 0.02, hh, d, h.u1 + 0.01, cv, cn);
      // fönsterbänk i ek: sticker ut 2,5 cm förbi fodren, rundade framhörn, 4 mm rundad kant
      // runt om (en liten näsa fram), ändträ i mörkare ton på ändarna och en skuggfog mot väggen
      if (h.v0 > 0.01) fonsterBank(m0, cu, h.v0, cn + d / 2, cn - 0.0225 - (d + 0.045) / 2, w + 0.17);
      // ett levande ljus i fönsterbänken (lagt i ljusLagor)
      if (LAGER === 'botten' && h.v0 > 0.5 && h.v0 < 1.3 && w > 0.5 && nljus < 2) {
        const p = V(cu - w * 0.28, h.v0, cn - 0.03).applyMatrix4(m0);
        const krock = HINDER.some(hd => hd.typ === 'mobel' && p.x > hd.x0 - 0.05 && p.x < hd.x1 + 0.05 && p.z > hd.z0 - 0.05 && p.z < hd.z1 + 0.05);
        if (!krock) { nljus++; iRam(new T.Matrix4().makeTranslation(p.x, p.y, p.z), () => { ton('#c9c2b6', () => glans(0.5, () => svarv('keramik', [[0, 0], [0.04, 0], [0.042, 0.004], [0.036, 0.012], [0, 0.01]], 0, 0, 0, 24))); ljus(0, 0.01, 0, 0.03, 0.09); }); }
      }
      else boxM('ek', m0, w, 0.014, d, cu, 0.007, cn);
      // vit karm och spröjs på insidan av motorns karm
      const ru0 = o[1], ru1 = o[1] + o[2], rv0 = o[3], rv1 = Math.min(o[3] + o[4], h.v1 + 0.0);
      const rw = ru1 - ru0, rcu = (ru0 + ru1) / 2, rh = rv1 - rv0, rcv = (rv0 + rv1) / 2;
      const kd = 0.038, kn = -0.105;  // täcker även motorns färgade karmkant mot glaset
      if (typ === 'f' || typ === 'sk') {
        boxM('vit', m0, rw, 0.062, kd, rcu, rv1 - 0.031, kn);
        boxM('vit', m0, rw, 0.062, kd, rcu, rv0 + 0.031, kn);
        boxM('vit', m0, 0.062, rh, kd, ru0 + 0.031, rcv, kn);
        boxM('vit', m0, 0.062, rh, kd, ru1 - 0.031, rcv, kn);
        for (let i = 1; i < rutor; i++) boxM('vit', m0, 0.08, rh, kd, ru0 + (rw * i) / rutor, rcv, kn);
        // (handtagen förr: raka svarta lådor; nu rundad rosett, bas och avrundat grepp)
        if (typ === 'sk') skjutGrepp('svart', m0, rcu - rw * 0.02, 1.05, kn - kd / 2, -1);
        else if (LAGER === 'botten') fonsterHandtag('svart', m0, ru0 + rw / rutor - 0.1, rcv, kn - kd / 2, -1);
      } else {
        // ytterdörr: vit insida med handtag
        // vit karm på insidan av motorns dörrkarm (5,5 cm), bladet ryms mellan karmsidorna
        const dn = -0.1, dd = 0.006, bw = rw - 0.108, bh = o[4] - 0.055 - 0.034, b0 = rv0 + 0.029;
        boxM('vit', m0, rw, 0.058, kd, rcu, rv0 + o[4] - 0.029, kn);
        boxM('vit', m0, 0.056, o[4] - 0.025, kd, ru0 + 0.028, rv0 + (o[4] + 0.025) / 2, kn);
        boxM('vit', m0, 0.056, o[4] - 0.025, kd, ru1 - 0.028, rv0 + (o[4] + 0.025) / 2, kn);
        if (typ === 'dg') {
          const gw = rw * 0.42, gh = o[4] * 0.62, gc = rv0 + o[4] / 2 + o[4] * 0.08;
          const sidb = (bw - gw) / 2;
          boxM('vit', m0, sidb, bh, dd, ru0 + 0.054 + sidb / 2, b0 + bh / 2, dn);
          boxM('vit', m0, sidb, bh, dd, ru1 - 0.054 - sidb / 2, b0 + bh / 2, dn);
          boxM('vit', m0, gw, gc - gh / 2 - b0, dd, rcu, (b0 + gc - gh / 2) / 2, dn);
          boxM('vit', m0, gw, b0 + bh - (gc + gh / 2), dd, rcu, (b0 + bh + gc + gh / 2) / 2, dn);
        } else boxM('vit', m0, bw, bh, dd, rcu, b0 + bh / 2, dn);
        const sida = s === 'N' || s === 'W' ? -1 : 1;
        // trycke och låsvred (förr raka svarta lådor): samma modell som innerdörrarna
        trycke('svart', m0, rcu + sida * (rw / 2 - 0.07), 1.0, dn - dd / 2, -1, -sida);
      }
      // foderlist runt om på väggens insida
      const A = 0.06, fn = -I - 0.009, fd = 0.018;
      const tak = Math.min(tv(h.u0 - A), tv(h.u1 + A)) - 0.012;
      const top = Math.min(h.v1 + A, tak);
      const bot = h.v0 > 0.01 ? h.v0 : 0;   // sidofodren börjar på bänkens ovansida
      boxM('vit', m0, A, top - bot, fd, h.u0 - A / 2, (top + bot) / 2, fn);
      boxM('vit', m0, A, top - bot, fd, h.u1 + A / 2, (top + bot) / 2, fn);
      if (top - h.v1 > 0.02) boxM('vit', m0, w + 2 * A, top - h.v1, fd, cu, (top + h.v1) / 2, fn);
      if (h.v0 > 0.01) boxM('vit', m0, w + 0.17 - 0.03, A, fd, cu, h.v0 - 0.03 - A / 2, fn);   // smygbräda under bänken, i liv med bänkens raka del
    }));
    // golvsockel mellan öppningarna som går ner till golvet
    let a = ua;
    const stopp = hal.filter(h => h.v0 <= 0.01).map(h => [h.u0 - 0.06, h.u1 + 0.06]);
    stopp.push([ub, ub]);
    stopp.forEach(([p, q]) => {
      if (p - a > 0.05) boxM('vit', m0, p - a, 0.075, 0.012, (a + p) / 2, 0.0375, -I - 0.006);
      a = Math.max(a, q);
    });
  });
}

// ---- Mellanväggar med dörrar ----
// axel 'x': väggen går längs x vid z = c. axel 'z': längs z vid x = c.
// dorrar: { a, b, h, gang: 'a'|'b' (gångjärnssida), sida: +1|-1 (öppnar mot +z resp. +x), vinkel, mk }
// oppna: { a, b, h } öppningar utan dörrblad. topp: höjd eller utelämnad = upp till taket.
function vagg(axel, c, s0, s1, op = {}) {
  const t = op.t ?? 0.1, bunn = op.bunn ?? 0;
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  const topp = s => {
    if (typeof op.topp === 'number') return op.topp;
    return axel === 'x' ? Math.max(CEIL(s, c - t / 2), CEIL(s, c + t / 2)) : Math.max(CEIL(c - t / 2, s), CEIL(c + t / 2, s));
  };
  const hal = [...(op.dorrar || []), ...(op.oppna || [])].map(d => ({ a: d.a, b: d.b, h: d.h ?? 2.1 })).sort((p, q) => p.a - q.a);
  VAGGAR.push({ axel, c, lo, hi, t, topp, bunn, hal });
  const P = (sd, s, v) => (axel === 'x' ? V(s, v, c + sd * t / 2) : V(c + sd * t / 2, v, s));
  const N = sd => (axel === 'x' ? V(0, 0, sd) : V(sd, 0, 0));
  const E = axel === 'x' ? V(1, 0, 0) : V(0, 0, 1);
  const kanter = [];
  hal.forEach(h => kanter.push(h.a, h.b));
  if (typeof op.topp !== 'number' && axel === 'z' && HH.tak === 'sadel' && lo < 0 && hi > 0) kanter.push(0);
  const us = bryt(lo, hi, kanter, 0.42);
  const rader = bunn > 0 ? [bunn, bunn + 0.2] : RADER(4);
  hal.forEach(h => rader.push(h.h));
  const vs = [...new Set(rader.map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const hu = hal.map(h => ({ u0: h.a, u1: h.b, v0: -1, v1: h.h }));
  for (const sd of [1, -1]) yta('vagg', (s, v) => P(sd, s, v), N(sd), us, vs, topp, hu, null, true);
  // ändar, lock och dörrsmyg. Ändar som möter ytterväggens foder eller en annan vägg
  // läggs inte (de låg i samma plan som den ytan och z-flimrade); det avgörs sist.
  const ta = topp(lo + 1e-3), tb = topp(hi - 1e-3), lag0 = LAGER;
  const anda = (s, tt, nn) => EFTER.push(() => { if (!moter(axel, c, s, t)) iLager(lag0, () => stav('vagg', y => [P(1, s, y), P(-1, s, y)], bunn, tt, nn)); });
  anda(lo, ta, E.clone().negate());
  anda(hi, tb, E);
  if (typeof op.topp === 'number') iLager(lagerFor(ta - 0.01), () => quad('vagg', P(1, lo, ta), P(-1, lo, ta), P(-1, hi, ta), P(1, hi, ta), V(0, 1, 0)));
  if (bunn > 0) iLager(lagerFor(bunn + 0.01), () => quad('vagg', P(1, lo, bunn), P(-1, lo, bunn), P(-1, hi, bunn), P(1, hi, bunn), V(0, -1, 0)));
  // gånghinder: väggen mellan dörrarna (bara väggar som når golvet)
  if (bunn === 0 && HINDER) {
    let a = lo;
    [...hal.filter(h => h.h > 1.8).map(h => [h.a, h.b]), [hi, hi]].forEach(([p, q]) => {
      if (p - a > 0.02) HINDER.push(axel === 'x' ? { x0: a, z0: c - t / 2, x1: p, z1: c + t / 2, niva: 'botten', typ: 'vagg' } : { x0: c - t / 2, z0: a, x1: c + t / 2, z1: p, niva: 'botten', typ: 'vagg' });
      a = Math.max(a, q);
    });
  }
  hal.forEach(h => {
    quad('vagg', P(1, h.a, 0), P(-1, h.a, 0), P(-1, h.a, h.h), P(1, h.a, h.h), E);
    quad('vagg', P(1, h.b, 0), P(-1, h.b, 0), P(-1, h.b, h.h), P(1, h.b, h.h), E.clone().negate());
    quad('vagg', P(1, h.a, h.h), P(-1, h.a, h.h), P(-1, h.b, h.h), P(1, h.b, h.h), V(0, -1, 0));
    ton('#b8925f', () => rbx('ek', axel === 'x' ? h.b - h.a : t + 0.02, 0.012, axel === 'x' ? t + 0.02 : h.b - h.a, axel === 'x' ? (h.a + h.b) / 2 : c, 0.01, axel === 'x' ? c : (h.a + h.b) / 2, 0.004, 0, 0, 1));   // tröskel
  });
  // foder runt dörrarna och sockel på båda sidor
  const A = 0.065, ld = 0.012;
  const list = (sd, s, v, ls, lv, dd = ld) => {
    const p = P(sd, s, v).addScaledVector(N(sd), dd / 2);
    if (axel === 'x') box('vit', ls, lv, dd, p.x, p.y, p.z); else box('vit', dd, lv, ls, p.x, p.y, p.z);
  };
  for (const sd of [1, -1]) {
    hal.forEach(h => {
      const top = Math.min(h.h + A, Math.min(topp(h.a), topp(h.b)) - 0.01);
      // sidostyckena upp till öppningens överkant och ett överstycke som går över dem
      // hela vägen (en ren, sammanhängande list utan överlappande ytor)
      const ov = top - h.h > 0.02, ys = ov ? h.h : top;
      list(sd, h.a - A / 2, ys / 2, A, ys, 0.018);
      list(sd, h.b + A / 2, ys / 2, A, ys, 0.018);
      if (ov) list(sd, (h.a + h.b) / 2, (top + h.h) / 2, h.b - h.a + 2 * A, top - h.h, 0.018);
    });
    if (bunn === 0) {
      let a = moter(axel, c, lo, t) ? lo + 0.012 : lo;
      const he = moter(axel, c, hi, t) ? hi - 0.012 : hi;
      [...hal.map(h => [h.a - A, h.b + A]), [he, he]].forEach(([p, q]) => {
        if (p - a > 0.05) list(sd, (a + p) / 2, 0.0375, p - a, 0.075);
        a = Math.max(a, q);
      });
    }
  }
  (op.dorrar || []).forEach((d, di) => {
    // vit karm i öppningen: sidostycken och överstycke 22 mm, något bredare än väggen
    const kt = t + 0.004;
    ton('#f3f1ec', () => {
      // överstycket mellan sidostyckena (inga överlappande, samplana ytor som flimrar)
      if (axel === 'x') { box('vit', 0.022, d.h ?? 2.1, kt, d.a + 0.011, (d.h ?? 2.1) / 2, c); box('vit', 0.022, d.h ?? 2.1, kt, d.b - 0.011, (d.h ?? 2.1) / 2, c); box('vit', d.b - d.a - 0.044, 0.022, kt, (d.a + d.b) / 2, (d.h ?? 2.1) - 0.011, c); }
      else { box('vit', kt, d.h ?? 2.1, 0.022, c, (d.h ?? 2.1) / 2, d.a + 0.011); box('vit', kt, d.h ?? 2.1, 0.022, c, (d.h ?? 2.1) / 2, d.b - 0.011); box('vit', kt, 0.022, d.b - d.a - 0.044, c, (d.h ?? 2.1) - 0.011, (d.a + d.b) / 2); }
    });
    // dörrstopp: 12 x 30 mm list i karmen bakom det stängda bladet (inte i bastudörren)
    if (d.mk !== 'glas') ton('#f3f1ec', () => {
      const dh = d.h ?? 2.1, n0 = c + d.sida * (t / 2 - 0.041 - 0.015);
      if (axel === 'x') { box('vit', 0.012, dh - 0.022, 0.03, d.a + 0.028, (dh - 0.022) / 2, n0); box('vit', 0.012, dh - 0.022, 0.03, d.b - 0.028, (dh - 0.022) / 2, n0); }
      else { box('vit', 0.03, dh - 0.022, 0.012, n0, (dh - 0.022) / 2, d.a + 0.028); box('vit', 0.03, dh - 0.022, 0.012, n0, (dh - 0.022) / 2, d.b - 0.028); }
    });
    const w = d.b - d.a - 0.056, h = (d.h ?? 2.1) - 0.03, th = (d.vinkel ?? 85) * PI / 180;
    const sh = d.gang === 'a' ? d.a + 0.026 : d.b - 0.026, dir = d.gang === 'a' ? 1 : -1;
    // gångjärnets ram: x längs dörrbladet mot låskanten, y upp; bladet stängt i öppningen
    const Xa = E.clone().multiplyScalar(dir), Ya = V(0, 1, 0), Za = V(0, 0, 0).crossVectors(Xa, Ya);
    // gångjärnet sitter i bladets yta i väggens liv (inte inne i väggen): bladet ligger
    // från ytan och 4 cm in, och svänger ut i rummet utan att gå in i väggänden
    const hp = P(d.sida, sh, 0).addScaledVector(N(d.sida), 0.0005);
    const m = BAS.clone().multiply(new T.Matrix4().makeBasis(Xa, Ya, Za).setPosition(hp));
    const s = Za.dot(N(d.sida)) < 0 ? 1 : -1;   // positiv vinkel = öppnar åt d.sida
    const tj = d.mk === 'glas' ? 0.032 : 0.04, zb = (tj / 2 + 0.0005) * s;   // bladets mitt (lokalt z), inåt i öppningen
    // dörren heter efter rummet den leder in i (sidan den inte öppnar mot)
    const glasd = d.mk === 'glas', mitt = P(-d.sida, (d.a + d.b) / 2, 0).addScaledVector(N(-d.sida), 0.5);
    const dRum = rumVid(mitt.x, mitt.z) || '', namn = glasd ? 'Bastudörr' : 'Dörr ' + dRum.toLowerCase();
    const idx = oppningsbar(namn, 'dorr', 'y', s * th, 1, m, () => {
      if (!glasd) rbx(d.mk || 'vit', w, h, tj, w / 2, h / 2 + 0.006, zb, Math.min(0.004, tj / 2 - 0.0005), 0, 0, 1);
      // tre gångjärn i bladets kant vid gångjärnsaxeln
      ton('#a9a7a2', () => { for (const y of [0.2, 1.05, 1.9]) lagg('vit', new T.CylinderGeometry(0.007, 0.007, 0.09, 12), mx(0, y, 0)); });
      if (glasd) {
        // glasdörr: smal ram (35 mm) med rundade kanter runt glasrutan; handtag i borstat stål på två distanser med rosetter, fäst i ramens
        // låssida på båda sidor
        const rb = 0.035, yc = h / 2 + 0.006;
        // ram i ljus al (som bastupanelen) runt en klar, härdad glasruta
        ton('#c9a274', () => {
          rbx('ek', w, rb, tj, w / 2, 0.006 + rb / 2, zb, 0.005, 0, 0, 2);
          rbx('ek', w, rb, tj, w / 2, h + 0.006 - rb / 2, zb, 0.005, 0, 0, 2);
          rbx('ek', rb, h - 2 * rb + 0.002, tj, rb / 2, yc, zb, 0.005, 0, 0, 2);
          rbx('ek', rb, h - 2 * rb + 0.002, tj, w - rb / 2, yc, zb, 0.005, 0, 0, 2);
        });
        box('glas', w - 2 * rb + 0.008, h - 2 * rb + 0.008, 0.008, w / 2, yc, zb);
        const hx = w - rb / 2;
        ton('#cfccc6', () => { for (const k of [1, -1]) {
          const yta = zb + k * tj / 2;
          for (const y of [0.86, 1.14]) {
            stal(new T.CylinderGeometry(0.013, 0.015, 0.004, 20).rotateX(PI / 2), mx(hx, y, yta + k * 0.002));
            stal(new T.CylinderGeometry(0.0065, 0.0065, 0.04, 14).rotateX(PI / 2), mx(hx, y, yta + k * 0.02));
          }
          stal(new T.CapsuleGeometry(0.011, 0.32, 4, 16), mx(hx, 1.0, yta + k * 0.046));
        } });
        return;
      }
      // trycke på 1,0 m på båda sidor: rosett mot bladet (+0,5 mm), hals och grepp
      // (samma trycke som ytterdörren; greppet pekar in mot gångjärnet; i dörrens egen ram)
      ton('#2a2928', () => {
        for (const k of [1, -1]) trycke(glasd ? 'svart' : 'vit', BAS, w - 0.07, 1.0, zb + k * tj / 2, k, -1);
      });
    }, glasd ? 'Bastu' : dRum);
    // låsbleck i karmen vid låskanten
    {
      const lk = d.gang === 'a' ? d.b : d.a, q = P(0, lk, 1.0), in1 = d.gang === 'a' ? -0.0015 : 0.0015;
      ton('#9a9a96', () => axel === 'x' ? box('svart', 0.003, 0.18, 0.024, q.x + in1, 1.0, q.z) : box('svart', 0.024, 0.18, 0.003, q.x, 1.0, q.z + in1));
    }
    // stängd dörr spärrar dörröppningen (motorn släpper hindret när dörren är öppen)
    if (HINDER && bunn === 0) HINDER.push(axel === 'x' ? { x0: d.a, z0: c - t / 2, x1: d.b, z1: c + t / 2, niva: 'botten', dorr: idx } : { x0: c - t / 2, z0: d.a, x1: c + t / 2, z1: d.b, niva: 'botten', dorr: idx });
    // strömbrytare vid låskanten, på båda sidor av väggen
    const sb = d.gang === 'a' ? d.b + 0.17 : d.a - 0.17;
    if (sb > lo + 0.06 && sb < hi - 0.06) for (const sd of [1, -1]) {
      const q = P(sd, sb, 1.1).addScaledVector(N(sd), 0.006);
      // ram med en vippa som står ut lite och lutar (en strömbrytare, inte en vit ruta)
      const qa = P(sd, sb, 1.1).addScaledVector(N(sd), 0.0045), qb = P(sd, sb, 1.1).addScaledVector(N(sd), 0.0105);
      ton('#f6f5f2', () => { if (axel === 'x') rbx('vit', 0.08, 0.08, 0.009, qa.x, qa.y, qa.z, 0.004, 0, 0, 2); else rbx('vit', 0.009, 0.08, 0.08, qa.x, qa.y, qa.z, 0.004, 0, 0, 2); });
      ton('#fbfaf7', () => { if (axel === 'x') rbx('vit', 0.05, 0.05, 0.006, qb.x, qb.y, qb.z, 0.003, 0, sd * 0.06, 2); else rbx('vit', 0.006, 0.05, 0.05, qb.x, qb.y, qb.z, 0.003, 0, 0, 2, -sd * 0.06); });
      BRYT.push(V(q.x, q.y, q.z).applyMatrix4(BAS));
    }
  });
}

// Möter väggänden vid s (vägg längs axel vid c, tjocklek t) en annan yta i samma plan?
function moter(axel, c, s, t) {
  const yt = axel === 'x' ? HH.L / 2 - I : HH.W / 2 - I;
  if (Math.abs(Math.abs(s) - yt) < 0.012) return true;
  return VAGGAR.some(w => w.axel !== axel && Math.abs(Math.abs(s - w.c) - w.t / 2) < 0.012 && c > w.lo - 0.01 && c < w.hi + 0.01);
}

// ---- Trappa och loft ----
function trappa(xL, xH, z0, z1, hojd = LT) {
  TRAPPOR.push({ xL, xH, z0, z1, hojd, niva: 'botten' });
  const dir = Math.sign(xH - xL), run = Math.abs(xH - xL);
  const n = Math.round(hojd / 0.195), r = hojd / n, g = run / (n - 1);
  const cz = (z0 + z1) / 2, bz = z1 - z0;
  // steg 4,2 cm tjocka med rundad nos (3 cm överlapp), ändarna inne i vangerna
  for (let i = 1; i < n; i++) rbx('ek', g + 0.03, 0.042, bz - 0.03, xL + dir * (i - 0.5) * g, i * r - 0.021, cz, 0.014, 0, 0, 3);
  const lang = Math.hypot(run, hojd), a = Math.atan2(hojd, run), rz = dir > 0 ? a : -a, xm = (xL + xH) / 2;
  // vangerna täcker stegens ändar helt: överkanten (lodrätt) ligger r + 15 mm över
  // trapplinjen (stegens bakkant) och underkanten under det översta stegets framkant
  // (lodrätt mått hv på var sida om mittlinjen); kapad lodrätt mot golv, loftkant och bjälklag
  const hv = Math.max(0.13 / Math.cos(a), r + 0.0275), c0 = r + 0.015 - hv, k = hojd / run;
  const uB = (hv - c0) / k, uT = (hojd - 0.005 - c0 - hv) / k;
  const vform = [[0, 0], [uB, 0], [run, hojd + c0 - hv], [run, hojd - 0.005], [uT, hojd - 0.005], [0, c0 + hv]].map(([u, y]) => new T.Vector2(xL + dir * u, y));
  for (const zc of [z0 + 0.02, z1 - 0.025]) lagg('vit', new T.ExtrudeGeometry(new T.Shape(vform), { depth: 0.04, bevelEnabled: false }), mx(0, 0, zc - 0.02));
  // ledstång på den öppna sidan: en sammanhängande rundad ekprofil 45 x 45, 0,9 m över
  // nosarna; den slutar med en stolpe innan taket blir för lågt. Pinnar från vangen upp.
  const zr = z0 + 0.02, xa = t => xL + dir * run * t, yv = t => t * hojd + r + 0.015;
  let tE = 1; for (let t = 0.05; t <= 1; t += 0.01) if (t * hojd + 0.9 + 0.12 > takVid(xa(t), zr)) { tE = t - 0.01; break; }
  const t0 = 0.03, yr = t => t * hojd + 0.9;
  if (tE > t0 + 0.1) {
    const L = Math.hypot(run * (tE - t0), hojd * (tE - t0)), tm = (t0 + tE) / 2;
    rbx('ek', L, 0.045, 0.045, xa(tm), yr(tm), zr, 0.012, 0, 0, 2, rz);
    rbx('ek', L, 0.02, 0.06, xa(tm), yv(tm) + 0.01, zr, 0.004, 0, 0, 1, rz);   // vangens täcklist
    const nb = Math.floor(run * (tE - t0) / 0.13);
    for (let i = 1; i < nb; i++) { const t = t0 + (tE - t0) * i / nb, h = yr(t) - 0.03 - yv(t) - 0.02; box('ek', 0.028, h, 0.028, xa(t), yv(t) + 0.02 + h / 2, zr); }
    for (const t of [t0, tE]) { const h = yr(t) + 0.04 - yv(t); rbx('ek', 0.07, h, 0.07, xa(t), yv(t) + h / 2, zr, 0.01, 0, 0, 2); }
  }
  // ledstång på väggsidan: rund ek Ø 40 mm, 0,9 m över nosarna och 6 cm från väggen,
  // på fästen i grafit med rosetter mot väggen, rundade ändar
  {
    const zw = z1 - 0.065, yl = t => t * hojd + 0.9;
    let t1 = 0.95; for (let t = 0.1; t <= 0.95; t += 0.01) if (yl(t) + 0.1 > takVid(xa(t), z1 - 0.02)) { t1 = t - 0.02; break; }
    let t0 = 0.06;
    // fönster och dörrar i väggen bakom: ledstången och fästena får aldrig gå framför
    // eller sitta i en öppning (karm och foder + marginal); välj längsta fria biten
    const gz = HH.W / 2 - I, sidaV = Math.abs(z1 - gz) < 0.06 ? 'S' : Math.abs(z1 + gz) < 0.06 ? 'N' : null;
    const hal = !sidaV || !HH.oppningar ? [] : HH.oppningar.filter(o => o[0] === sidaV).map(o => {
      const a = sidaV === 'S' ? -HH.L / 2 + o[1] : HH.L / 2 - o[1] - o[2];
      return [a - 0.12, a + o[2] + 0.12, o[3] - 0.12, o[3] + o[4] + 0.12];
    });
    if (hal.length) {
      const fri = t => !hal.some(([a, b, y0, y1]) => xa(t) > a && xa(t) < b && yl(t) + 0.03 > y0 && yl(t) - 0.07 < y1);
      let bA = 0, bB = -1, s = null;
      for (let t = t0; t <= t1 + 1e-9; t += 0.005) {
        if (fri(t)) { if (s === null) s = t; if (t - s > bB - bA) { bA = s; bB = t; } } else s = null;
      }
      t0 = bA; t1 = bB;
    }
    if (t1 > t0 + 0.2) {
      const A = V(xa(t0), yl(t0), zw), B = V(xa(t1), yl(t1), zw), L = A.distanceTo(B), M = A.clone().add(B).multiplyScalar(0.5);
      const q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize());
      ton('#c9a77c', () => lagg('ek', new T.CapsuleGeometry(0.02, L, 6, 16).applyQuaternion(q).translate(M.x, M.y, M.z), mx(0, 0, 0)));
      const nf = Math.max(2, Math.ceil(L / 0.9) + 1);
      ton('#4b4844', () => glans(1.1, () => { for (let k = 0; k < nf; k++) {
        const t = t0 + 0.04 + (t1 - t0 - 0.08) * k / (nf - 1), x = xa(t), y = yl(t) - 0.03;
        lagg('keramik', new T.CylinderGeometry(0.006, 0.006, 0.05, 12).rotateX(PI / 2), mx(x, y, z1 - 0.025));
        lagg('keramik', new T.CylinderGeometry(0.006, 0.006, 0.03, 12), mx(x, y + 0.015, zw));
        lagg('keramik', new T.CylinderGeometry(0.022, 0.024, 0.008, 24).rotateX(PI / 2), mx(x, y, z1 - 0.004));
      } }));
    }
  }
  skugga(xm, cz, run, bz, 0, 0.15, 0.35);
  med(xm, cz, 0, () => hind(run, bz));
}

function relangGammal(axel, c, s0, s1) {
  const n = Math.max(2, Math.round(Math.abs(s1 - s0) / 0.11));
  const lo = Math.min(s0, s1) + 0.02, hi = Math.max(s0, s1) - 0.02;
  let forra = null;
  for (let i = 0; i <= n; i++) {
    const s = lo + (hi - lo) * i / n;
    const x = axel === 'x' ? s : c, z = axel === 'x' ? c : s;
    const h = Math.min(0.9, CEIL(x, z) - LT - 0.04);
    if (h < 0.12) { forra = null; continue; }
    box('ek', 0.03, h, 0.03, x, LT + h / 2, z);
    if (forra) {
      const hc = Math.min(forra.h, h), sm = (forra.s + s) / 2, l = s - forra.s + 0.034;
      if (axel === 'x') rbx('ek', l, 0.03, 0.055, sm, LT + hc + 0.015, z, 0.008, 0, 0, 1);
      else rbx('ek', 0.055, 0.03, l, x, LT + hc + 0.015, sm, 0.008, 0, 0, 1);
    }
    forra = { s, h };
  }
  if (axel === 'x') box('ek', hi - lo, 0.07, 0.02, (lo + hi) / 2, LT + 0.035, c);
  else box('ek', 0.02, 0.07, hi - lo, c, LT + 0.035, (lo + hi) / 2);
  if (HINDER) HINDER.push(axel === 'x' ? { x0: lo, z0: c - 0.04, x1: hi, z1: c + 0.04, niva: 'loft' } : { x0: c - 0.04, z0: lo, x1: c + 0.04, z1: hi, niva: 'loft' });
}

// Loftets räcke: bottenlist på bjälklagets kant, balusterpinnar (≤ 11 cm mellanrum) upp
// till en sammanhängande rundad överliggare i ek 45 x 45 som följer takfallet, stolpar i ändarna.
function relang(axel, c, s0, s1, utanSlut = false) {
  // Räcke runt loftets kant: stolpar (7 x 7 cm) i båda ändar och mellanstolpar högst
  // 1,6 m isär, en handledare med rundad profil mellan stolparna, en bottenregel strax
  // över golvet mellan stolparna och balustrar mellan regel och handledare med högst
  // 11 cm fritt mellanrum. Inga delar går igenom eller förbi stolparna.
  // stolparnas mitt 3 cm in från ändarna: där två räcken möts hamnar stolparna i samma punkt
  const a0 = Math.min(s0, s1) + 0.03, a1 = Math.max(s0, s1) - 0.03, sp = 0.035;
  const P = s => (axel === 'x' ? [s, c] : [c, s]);
  const H = s => { const [x, z] = P(s); return Math.min(0.9, CEIL(x, z) - LT - 0.08); };
  const nst = Math.max(1, Math.ceil((a1 - a0) / 1.6)), st = [];
  for (let k = 0; k <= nst; k++) st.push(a0 + (a1 - a0) * k / nst);
  const stolpar = st.filter(q => H(q) >= 0.2);
  // handledare: från stolpe till stolpe, följer taket där det sluttar (brytpunkter)
  const del = (a, b) => {
    const ha = H(a), hb = H(b); if (Math.min(ha, hb) < 0.2) return;
    const L = Math.hypot(b - a, hb - ha), m = (a + b) / 2, [x, z] = P(m), ang = Math.atan2(hb - ha, b - a), y = LT + (ha + hb) / 2 - 0.0225;
    if (axel === 'x') rbx('ek', L + 0.002, 0.045, 0.05, x, y, z, 0.02, 0, 0, 3, ang);
    else rbx('ek', 0.05, 0.045, L + 0.002, x, y, z, 0.02, 0, -ang, 3);
  };
  for (let k = 0; k < st.length - 1; k++) {
    const p0 = st[k] + sp, p1 = st[k + 1] - sp, br = [p0];
    let f0 = H(p0) >= 0.9 - 1e-6;
    for (let i = 1; i <= 60; i++) {
      const q = p0 + (p1 - p0) * i / 60, f = H(q) >= 0.9 - 1e-6;
      if (f !== f0) { let a = q - (p1 - p0) / 60, b = q; for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if ((H(m) >= 0.9 - 1e-6) === f0) a = m; else b = m; } br.push((a + b) / 2); f0 = f; }
    }
    br.push(p1);
    for (let i = 0; i < br.length - 1; i++) del(br[i], br[i + 1]);
    // bottenregel 4 x 4 cm, 4 cm över golvet, mellan stolparna
    const [x, z] = P((p0 + p1) / 2), L = p1 - p0;
    if (Math.min(H(p0), H(p1)) >= 0.2) {
      if (axel === 'x') rbx('ek', L, 0.04, 0.04, x, LT + 0.06, z, 0.008, 0, 0, 2);
      else rbx('ek', 0.04, 0.04, L, x, LT + 0.06, z, 0.008, 0, 0, 2);
    }
    // balustrar 2,8 x 2,8 cm mellan regelns ovansida och handledarens undersida
    const nb = Math.max(1, Math.ceil(L / 0.138));
    for (let i = 1; i < nb; i++) {
      const q = p0 + L * i / nb, h = H(q) - 0.045 - 0.08, [bx, bz] = P(q);
      if (h > 0.06) box('ek', 0.028, h, 0.028, bx, LT + 0.08 + h / 2, bz);
    }
  }
  // stolparna, lite högre än handledaren, med avfasad topp
  stolpar.forEach(q => { const h = H(q), [x, z] = P(q); rbx('ek', 0.07, h + 0.03, 0.07, x, LT + (h + 0.03) / 2, z, 0.008, 0, 0, 2); rbx('ek', 0.074, 0.012, 0.074, x, LT + h + 0.034, z, 0.004, 0, 0, 2); });
  if (HINDER) HINDER.push(axel === 'x' ? { x0: a0 - sp, z0: c - 0.04, x1: a1 + sp, z1: c + 0.04, niva: 'loft' } : { x0: c - 0.04, z0: a0 - sp, x1: c + 0.04, z1: a1 + sp, niva: 'loft' });
}

function dack(x0, x1, z0, z1) {
  LOFT.push([x0, x1, z0, z1]);
  // bara bjälklagets kanter: över- och undersidan täcks av loftgolvet och loftets tak,
  // som annars låg 3 mm från lådans ytor och flimrade på avstånd
  const g = new T.BoxGeometry(x1 - x0, LT - LU, z1 - z0), ix = g.index.array, kvar = [];
  g.groups.forEach((gr, i) => { if (i !== 2 && i !== 3) for (let k = gr.start; k < gr.start + gr.count; k++) kvar.push(ix[k]); });
  g.setIndex(kvar); g.clearGroups();
  ton('#f2efe9', () => lagg('vagg', g, mx((x0 + x1) / 2, (LU + LT) / 2, (z0 + z1) / 2)));
}

// Loft över sovrum och bad: del A norr om zA upp till xA, del B hela djupet väster om xB.
function loft(xA, zA, xB, zTrappa) { iLager('loft', () => loftInne(xA, zA, xB, zTrappa)); }
function loftInne(xA, zA, xB, zTrappa) {
  const XW = -HH.L / 2 + I, ZN = -HH.W / 2 + I, ZS = HH.W / 2 - I;
  dack(XW, xA, ZN, zA);
  dack(XW, xB, zA, ZS);
  relang('z', xA - 0.03, ZN, zA);
  // räckena möts i gemensamma hörnstolpar (xA - 0,03, zA - 0,03) och (xB - 0,03, zA - 0,03)
  relang('x', zA - 0.03, xB - 0.06, xA);
  relang('z', xB - 0.03, zA - 0.06, zTrappa + 0.04);   // slutar i en stolpe vid trappans räcke
  // madrass, puff och växt på loftet
  // 90-bädd med en 50 cm bred gång mellan bädden och räcket: förr stod 120-bädden 9 cm från
  // räcket, så att man i gångläget inte kom förbi den från trappan in på loftet
  // lykta på golvet vid fotänden (norr om gången): ram, glas och ett levande ljus; skenet är en egen lampa.
  // (byggs före bädden: fårskinnet vid fotänden letar plats runt hindren och lade sig förr in
  // under lyktan, så att lyktan stod i skinnet och ljuset såg ut att gå in i ett ben)
  med(XW + 2.55, zA - 1.0, 0, () => {
    skugga(0, 0, 0.16, 0.16, 0, 0.06, 0.35, LT + 0.021);
    hind(0.2, 0.2);
    // lyktans ram i varm grafit (inte svart), rundade lister och ett mjukt bygelhandtag
    ton('#4b4844', () => glans(1.2, () => { rbx('keramik', 0.17, 0.012, 0.17, 0, LT + 0.006, 0, 0.004, 0, 0, 2); rbx('keramik', 0.17, 0.02, 0.17, 0, LT + 0.27, 0, 0.005, 0, 0, 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbx('keramik', 0.012, 0.25, 0.012, sx * 0.079, LT + 0.137, sz * 0.079, 0.003, 0, 0, 1);
      lagg('keramik', new T.TorusGeometry(0.035, 0.004, 8, 20, PI), mx(0, LT + 0.28, 0)); }));
    for (const [a, b] of [[0, 0.079], [0, -0.079], [0.079, 0], [-0.079, 0]]) platta('glas', 0.146, 0.244, mx(a, LT + 0.137, b, a ? PI / 2 : 0), null, [1, 1]);
    ljus(0, LT + 0.012, 0, 0.028, 0.1);   // (smalare ljus: minst 4,5 cm till stolparna)
    const li = egenLampa('Lykta', [0, LT + 0.32, 0], () => lagg('lampa', new T.CircleGeometry(0.03, 16).rotateX(-PI / 2), mx(0, LT + 0.0125, 0)));
    sken(li, 0, LT + 0.006, 0, 0.3, 0.3, 0.3, false, 0.35);
  });
  med(XW + 1.09, zA - 1.055, PI / 2, () => sang(0.9, 2.0, { lag: true, tacke: '#efe9de', pled: '#cf9f78', kudde: '#b9c2a6' }));
  med(0, 0, 0, () => {
    ton('#b7875b', () => vav('stick', () => svarv('tyg', [[0, 0], [0.22, 0], [0.245, 0.04], [0.25, 0.26], [0.22, 0.3], [0, 0.31]], XW + 0.62, LT, (zA + ZS) / 2 + 0.1, 32)));
    // (puffen 28 cm närmare gaveln: den stod i vägen vid trappans topp i det smala loftet)
    skugga(XW + 0.62, (zA + ZS) / 2 + 0.1, 0.4, 0.4, 0, 0.1, 0.4, LT + 0.021);
    hind(0.5, 0.5, XW + 0.62, (zA + ZS) / 2 + 0.1);
  });
  loftMer(XW, xA, zA, xB, ZN, ZS);
}
// Loftets övriga möblering (loftet var kalt): en låg ekhylla med böcker, korg och växt under
// norra takfallet, golvkuddar vid räcket och en tavla lutad mot gaveln; på långa loft också
// en läshörna (matta, lågt bord, golvkuddar, plädkorg) och en kista med matta vid puffen.
// Allt är lågt nog att gå fritt från takfallet. Slumpföljden lämnas orörd för resten av huset.
function loftMer(XW, xA, zA, xB, ZN, ZS) {
  const s0 = SEED, upp = (x, z, ry, fn) => iRam(new T.Matrix4().makeTranslation(x, LT, z).multiply(new T.Matrix4().makeRotationY(ry)), fn);
  const hojd = (x, z) => CEIL(x, z) - LT;
  const xF = XW + 2.3, Lf = xA - 0.2 - xF;   // fritt golv öster om bäddens fotände
  const hw = Math.min(1.2, Lf - 0.1), hx = xF + 0.1 + hw / 2, hz = ZN + 0.5;
  if (hw > 0.6 && hojd(hx, hz - 0.15) > 0.36) upp(hx, hz, 0, () => {
    skugga(0, 0, hw, 0.3, 0, 0.1, 0.4); hind(hw, 0.3);
    rbx('ek', hw, 0.024, 0.3, 0, 0.3, 0, 0.006, 0, 0, 1); rbx('ek', hw - 0.04, 0.02, 0.28, 0, 0.05, 0, 0.005, 0, 0, 1);
    for (const s of [-1, 0, 1]) rbx('ek', 0.022, 0.29, 0.28, s * (hw / 2 - 0.011), 0.155, 0, 0.004, 0, 0, 1);
    bocker(-hw / 4, 0.06, 0.0, 0.1, 4, true);
    ton('#c4a477', () => svarv('tyg', [[0, 0], [0.1, 0], [0.115, 0.01], [0.12, 0.17], [0.114, 0.18], [0.108, 0.17], [0.104, 0.012], [0, 0.01]], hw / 4, 0.06, 0, 24));
    ton('#efe9df', () => vav('stick', () => rbx('tyg', 0.17, 0.07, 0.17, hw / 4, 0.19, 0, 0.03, 0.2, 0, 2)));
    bocker(-hw / 2 + 0.2, 0.312, 0.0, -0.12, 3, true);
    mugg(-hw / 2 + 0.42, 0.312, 0.04, '#d8cdbb', 0.6);
    smavaxt(hw / 2 - 0.16, 0, 0.312);
  });
  const golvkuddar = () => vav('linne', () => {
    skugga(0, 0, 0.5, 0.5, 0, 0.12, 0.35);
    ton(PAL.sand, () => kuddeRund('tyg', 0.56, 0.15, 0.56, 0, 0.0225, 0, { nx: 6, nz: 6 }));
    ton(PAL.salvia, () => kuddeRund('tyg', 0.5, 0.14, 0.5, 0.03, 0.118, -0.02, { ry: 0.3, nx: 6, nz: 6, som: false }));
  });
  if (Lf > 3) {
    const cx = (xF + hw + 0.5 + xA - 0.3) / 2, cz = zA - 0.85;
    upp(cx, cz, 0, () => {
      matta(0, 0, 1.7, 1.15, 0, '#d8cdbb', 1); MATTOR.pop();
      skugga(0, 0, 0.46, 0.46, 0, 0.14, 0.35, 0.04); hind(0.56, 0.56);
      svarv('ek', [[0, 0], [0.27, 0], [0.28, 0.01], [0.28, 0.028], [0.27, 0.034], [0, 0.034]], 0, 0.226, 0, 48);
      for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3 + 0.5; lagg('ek', new T.CylinderGeometry(0.02, 0.015, 0.21, 8), mx(Math.cos(a) * 0.17, 0.122, Math.sin(a) * 0.17)); }
      smavaxt(-0.08, -0.06, 0.26); bok(0.1, 0.26, 0.08, 0.3, 0.2, 0.024, 0.15, '#6c7a86'); mugg(0.13, 0.26, -0.1, '#ece6dc', 1.2);
      vav('linne', () => {
        ton(PAL.sand, () => kuddeRund('tyg', 0.6, 0.16, 0.6, -0.62, 0.041, 0.05, { ry: 0.15, nx: 6, nz: 6 }));
        ton(PAL.salvia, () => kuddeRund('tyg', 0.6, 0.16, 0.6, 0.62, 0.041, -0.1, { ry: -0.2, nx: 6, nz: 6, som: false }));
        ton(PAL.havre, () => kuddeRund('tyg', 0.5, 0.14, 0.5, 0.6, 0.142, -0.12, { ry: 0.25, nx: 6, nz: 6, som: false }));
      });
    });
    // två vikta plädar på golvet vid räcket
    upp(xA - 0.45, ZN + 0.8, 0.15, () => { skugga(0, 0, 0.4, 0.3, 0, 0.08, 0.35); vikt(0.42, 0.32, 0.06, 0, 0.002, 0, 0, PAL.sand, 'stick'); vikt(0.4, 0.3, 0.055, 0.01, 0.062, 0, 0.12, '#b9c2a6', 'stick'); });
  } else if (Lf > 1.5) upp(xA - 0.45, zA - 0.45, 0.2, golvkuddar);
  // tavla lutad mot västgaveln, söder om bokhögen
  iRam(new T.Matrix4().makeTranslation(XW + 0.04, LT + 0.252, 1.05).multiply(new T.Matrix4().makeRotationY(PI / 2)).multiply(new T.Matrix4().makeRotationX(-0.12)), () => tavla(0.4, 0.5, 1, 'ek', 0.004));
  // breda loft: matta vid puffen och en kista i ek med en vikt pläd längs södra takfallet
  if (xB - XW > 2.4) {
    upp(XW + 1.35, 1.0, 0, () => { matta(0, 0, 1.5, 1.0, 0, '#d8cdbb', 1); MATTOR.pop(); });
    // (kistan stod precis vid trappans topp och spärrade vägen in på loftet: nu längre västerut)
    upp(XW + 1.7, ZS - 0.42, 0, () => {
      skugga(0, 0, 0.8, 0.38, 0, 0.1, 0.4, 0.038); hind(0.8, 0.38);
      rbx('ek', 0.8, 0.26, 0.38, 0, 0.157, 0, 0.01, 0, 0, 1); rbx('ek', 0.82, 0.04, 0.4, 0, 0.309, 0, 0.01, 0, 0, 1);
      ton('#9a7a58', () => { for (const s of [-1, 1]) box('ek', 0.05, 0.012, 0.36, s * 0.33, 0.021, 0); });
      ton('#6b5a4a', () => rbx('ek', 0.05, 0.04, 0.006, 0, 0.27, 0.193, 0.002, 0, 0, 1));   // läderhasp
      vikt(0.42, 0.3, 0.05, -0.12, 0.329, 0, 0.1, '#b9c2a6', 'stick');
    });
  }
  SEED = s0;
}

// Loftets undersida och golv (finmaskigt), läggs när alla väggar finns
function loftYtor() {
  LOFT.forEach(([x0, x1, z0, z1]) => iLager('loft', () => {
    golvYta(x0, x1, z0, z1, LT + 0.003);
    takYta('tak', x0, x1, z0, z1, () => LU - 0.003, V(0, -1, 0));
  }));
}

// ---- Textilier och mjuka former ----
// Kudde: tunna kanter, puffig mitt. som: en fog (kantband) runt om.
function kudde(mk, w, h, d, x, y, z, o = {}) {
  const g = new T.BoxGeometry(w, h, d, o.nx ?? 8, 2, o.nz ?? 6);
  const p = g.attributes.position, puff = o.puff ?? 0.62;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) / (w / 2), Y = p.getY(i) / (h / 2), Z = p.getZ(i) / (d / 2);
    const f = (1 - X ** 4) * (1 - Z ** 4);
    const k = (1 - 0.05 * Y * Y) * (1 - (o.rund ?? 0.12) * X * X * Z * Z);
    p.setXYZ(i, p.getX(i) * k, Y * (h / 2) * ((1 - puff) + puff * f), p.getZ(i) * k);
  }
  const m = mx(x, y, z, o.ry ?? 0, o.rx ?? 0, o.rz ?? 0);
  lagg(mk, mjuk(g), m);
  if (o.som) lagg(mk, new RoundedBoxGeometry(w * 1.012, Math.max(0.008, h * (1 - puff) * 0.9), d * 1.012, 1, 0.003), m.clone());
}

// Sammanhängande yta: hörn i samma läge slås ihop och får gemensamma normaler (mjukt tyg).
function mjuk(g) {
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5); g.dispose();
  m.computeVertexNormals();
  return m;
}

// Fyllig kudde: rektangulär med platt undersida och uppblåst mitt, mjukt rundade kanter.
// Undersidan ligger på y - b där b = 0.15 h, så att kudden vilar på det den ligger på.
function kuddeRund(mk, w, h, d, x, y, z, o = {}) {
  const g = new T.BoxGeometry(w, h, d, o.nx ?? 8, 3, o.nz ?? 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) / (w / 2), Y = p.getY(i) / (h / 2), Z = p.getZ(i) / (d / 2);
    const fyll = Math.sqrt(Math.max(0, (1 - X * X) * (1 - Z * Z)));
    const f = 0.24 + 0.76 * fyll;
    const k = (1 - 0.13 * X * X * Z * Z) * (1 + 0.025 * (1 - Y * Y));      // mjuka hörn, lätt bukig sida
    // hörnveck: små veck som strålar in från hörnen (där fyllningen drar i tyget)
    const hc = Math.max(0, Math.abs(X * Z) - 0.3) / 0.7, hv = 1 - (o.hornveck ?? (h > 0.06 ? 0.16 : 0)) * hc * (0.5 + 0.5 * Math.cos((Math.abs(X) - Math.abs(Z)) * 10));
    const yy = Y > 0 ? Y * (h / 2) * f * hv : Y * (h / 2) * 0.3 * (1 - 0.15 * fyll);
    p.setXYZ(i, p.getX(i) * k, yy, p.getZ(i) * k);
  }
  const m = mx(x, y, z, o.ry ?? 0, o.rx ?? 0, o.rz ?? 0);
  lagg(mk, mjuk(g), m);
  // kantband (kedern) runt kudden där fram- och baksidan är hopsydda
  if (o.som ?? h > 0.06) {
    const k = (X, Z) => (1 - 0.13 * X * X * Z * Z) * 1.02, pts = [], yk = -h * 0.02;
    for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * PI, c = Math.cos(a), s = Math.sin(a), q = Math.pow(Math.abs(c) ** 6 + Math.abs(s) ** 6, -1 / 6), X = c * q, Z = s * q;
      pts.push(V(X * w / 2 * k(X, Z), yk, Z * d / 2 * k(X, Z))); }
    ton(skiftTon(TON, 0.9), () => lagg(mk, new T.TubeGeometry(new T.CatmullRomCurve3(pts, true, 'centripetal'), 64, Math.min(0.0045, h * 0.05), 5, true), m.clone()));
  }
}

// Tonen hex ljusare/mörkare (f < 1 mörkare), för kantband och sömmar.
function skiftTon(hex, f) { return '#' + new T.Color(hex ?? '#cfc6b6').multiplyScalar(f).getHexString(); }
// Tonen blandad mot varmt benvitt (t = andel), så att tyger blir ljusa och varma (tyget
// mörknar mycket av väven och ocklusionen; mörkgrå toner blev nästan svarta).
function ljusTon(hex, t) { return '#' + new T.Color(hex ?? '#cfc6b6').lerp(new T.Color('#f4ede2'), t).getHexString(); }

// Stoppad dyna/stomme: rundad låda (radie r) med svällande sidor, valfri insjunken sitt-
// yta, lätta veck och kantband (kedern) runt övre (och undre) sömmen. Lokalt mitt i (x, y, z).
// o: r, puff (översidan), botten, sida (x-sidorna), fram, bak (meter), sjunk, veck,
// kant ('topp' | 'bada' | 'fram'), nx/ny/nz, rx/ry/rz.
function dyna(mk, w, h, d, x, y, z, o = {}) {
  const r = Math.max(0.004, Math.min(o.r ?? 0.04, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const nx = o.nx ?? Math.max(6, Math.min(18, Math.round(w / 0.055))), ny = o.ny ?? Math.max(4, Math.min(12, Math.round(h / 0.055))), nz = o.nz ?? Math.max(6, Math.min(18, Math.round(d / 0.055)));
  const g = new T.BoxGeometry(1, 1, 1, nx, ny, nz), p = g.attributes.position, skr = new Float32Array(p.count);
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, tat = a => Math.sign(a) * (1 - (1 - Math.abs(a)) ** 2);
  const P = V(0, 0, 0), I = V(0, 0, 0), D = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) {
    P.set(tat(p.getX(i) * 2) * w / 2, tat(p.getY(i) * 2) * h / 2, tat(p.getZ(i) * 2) * d / 2);
    I.set(Math.max(-hx, Math.min(hx, P.x)), Math.max(-hy, Math.min(hy, P.y)), Math.max(-hz, Math.min(hz, P.z)));
    D.subVectors(P, I); const L = D.length() || 1; D.divideScalar(L);
    const bx = 1 - (I.x / Math.max(hx, 1e-4)) ** 2, by = 1 - (I.y / Math.max(hy, 1e-4)) ** 2, bz = 1 - (I.z / Math.max(hz, 1e-4)) ** 2;
    const vk = bx * bz * (Math.sin(I.x * 23 + I.z * 9) * 0.6 + Math.sin(I.z * 31 - I.x * 13) * 0.4);
    const topp = (o.puff ?? 0.01) * bx * bz - (o.sjunk ?? 0) * (bx * bz) ** 2 + (o.veck ?? 0) * vk;
    const ut = V(
      D.x * (o.sida ?? 0.004) * by * bz,
      D.y * (D.y > 0 ? topp : (o.botten ?? 0) * bx * bz),
      D.z * (D.z > 0 ? (o.fram ?? 0.006) : (o.bak ?? 0.004)) * bx * by);
    p.setXYZ(i, I.x + D.x * r + ut.x, I.y + D.y * r + ut.y, I.z + D.z * r + ut.z);
    // sömmen mörkare (mitt på rundningen), vecken skuggade
    const c = 1 - Math.max(Math.abs(D.x), Math.abs(D.y), Math.abs(D.z));
    skr[i] = 1 - 0.3 * c - (D.y > 0 && o.veck ? 0.05 * Math.max(0, -vk) : 0) - (D.y > 0 ? 0.04 * (o.sjunk ?? 0) / 0.012 * (bx * bz) ** 2 : 0);
  }
  g.setAttribute('skr', new T.Float32BufferAttribute(skr, 1));
  const m = mx(x, y, z, o.ry ?? 0, o.rx ?? 0, o.rz ?? 0);
  lagg(mk, mjuk(g), m);
  if (!o.kant) return;
  // kantband längs sömmen: rundad rektangel 0,29 r in från kanten, hörnradie 0,71 r
  const ax = w / 2 - 0.29 * r, az = d / 2 - 0.29 * r, rc = Math.min(0.71 * r, ax - 0.001, az - 0.001), sl = (y0) => {
    const pts = [];
    [[ax - rc, az - rc, 0], [-(ax - rc), az - rc, PI / 2], [-(ax - rc), -(az - rc), PI], [ax - rc, -(az - rc), 1.5 * PI]].forEach(([cx, cz, v0]) => {
      for (let k = 0; k <= 4; k++) { const v = v0 + k / 4 * PI / 2; pts.push(V(cx + Math.cos(v) * rc, y0, cz + Math.sin(v) * rc)); }
    });
    // extra punkter längs raka sidor, så att kurvan inte buktar
    const ut = [];
    pts.forEach((q, k) => { ut.push(q); const n = pts[(k + 1) % pts.length]; if (q.distanceTo(n) > 0.12) { const s = Math.ceil(q.distanceTo(n) / 0.12); for (let j = 1; j < s; j++) ut.push(q.clone().lerp(n, j / s)); } });
    return ut;
  };
  const rad = o.kantR ?? Math.min(0.005, r * 0.16), lagen = o.kant === 'bada' ? [1, -1] : [1];
  ton(skiftTon(TON, o.kantF ?? 0.88), () => lagen.forEach(s => {
    const c = new T.CatmullRomCurve3(sl(s * (h / 2 - 0.29 * r)), true, 'centripetal');
    lagg(mk, new T.TubeGeometry(c, Math.max(40, Math.round(c.getLength() / 0.02)), rad, 5, true), m.clone());
  }));
}

// Ledig golvyta: rektangeln (husets system) med 15 cm marginal mot hinder och kanter.
function golvFritt(x0, x1, z0, z1, loft) {
  const m = 0.15;
  if (loft && !LOFT.some(r => x0 > r[0] + m && x1 < r[1] - m && z0 > r[2] + m && z1 < r[3] - m)) return false;
  return !HINDER.some(h => (h.niva === 'alla' || h.niva === (loft ? 'loft' : 'botten')) && x1 + m > h.x0 && x0 - m < h.x1 && z1 + m > h.z0 && z0 - m < h.z1);
}
// Lägger fårskinnet på första lediga läget (lokalt [x, z, ry]), krymper vid behov.
function farskinnFritt(lagen) {
  for (const s of [1, 0.85, 0.7, 0.6]) for (const [x, z, ry] of lagen) {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let i = 0; i < 16; i++) { const t = i / 16 * 2 * PI, p = V(x + Math.cos(t) * 0.575 * s * Math.cos(ry) + Math.sin(t) * 0.92 * s * Math.sin(ry), 0, z - Math.cos(t) * 0.575 * s * Math.sin(ry) + Math.sin(t) * 0.92 * s * Math.cos(ry)).applyMatrix4(BAS); a0 = Math.min(a0, p.x); a1 = Math.max(a1, p.x); b0 = Math.min(b0, p.z); b1 = Math.max(b1, p.z); }
    if (golvFritt(a0, a1, b0, b1, LAGER === 'loft')) { farskinn(x, LT + 0.001, z, ry, 0.5 * s, 0.78 * s); return; }
  }
}
// Fårskinn på golvet: organisk kontur, fyllig mitt och mjukt nedrullade kanter.
function farskinn(x, y, z, ry, a = 0.5, b = 0.78, fg = '#f6efe3') {
  const nr = 10, ns = 72, pos = [], ix = [];
  let s = 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ph = [r() * 6, r() * 6, r() * 6];
  // ljust krämvitt oavsett anropets ton (äldre anrop gav gråaktiga skinn)
  fg = ljusTon(fg, 0.5);
  // skinnets form: bredare upptill, smalare mitt, små utskott (ben) och en lurvig,
  // oregelbunden kant; ytan har pälsens klungor (lockar) i flera storlekar
  const Rf = (th, t) => 1 + 0.09 * Math.cos(4 * th) + 0.05 * Math.sin(7 * th + ph[1]) + (t > 0.75 ? 0.05 * Math.sin(17 * th + ph[2]) + 0.03 * Math.sin(29 * th + ph[0]) : 0);
  // (vinkelvariationen tonas in från mitten: förr strålade åsarna ihop i mitten som en stjärna)
  const Hf = (th, t) => 0.03 * (1 - Math.pow(t, 4)) * (0.8 + Math.min(1, t * 2.5) * (0.12 * Math.sin(th * 5 + t * 9) + 0.08 * Math.sin(th * 13 + t * 21) * Math.sin(th * 7 - t * 15))) + 0.003;
  const P = (th, t) => { const rr = t * Rf(th, t); return [Math.cos(th) * rr * a, Hf(th, t), Math.sin(th) * rr * b * (1 - 0.12 * Math.cos(2 * th) * t)]; };
  pos.push(0, Hf(0, 0), 0);
  for (let j = 1; j <= nr; j++) {
    const t = j / nr;
    for (let i = 0; i < ns; i++) { const q = P(i / ns * 2 * PI, t); pos.push(q[0], q[1] + 0.003 * (r() - 0.5), q[2]); }
  }
  // lockar: små mjuka, rundade ulltofsar (låga kupoler, utdragna utåt) över hela skinnet;
  // i kanten lutar de nedåt. Storleken följer skinnet (fåtöljens lilla skinn får små lockar),
  // så att ytan blir lockig ull och inte taggig.
  const tof = [], ks = Math.max(0.55, Math.min(1, Math.sqrt(a * b / 0.39))), n = Math.round(310 * a * b / 0.39 / (ks * ks));
  for (let k = 0; k < n; k++) {
    // större, låga och överlappande lockar (7 x 3 segment): en sammanhängande lurvig päls,
    // inte lösa kantiga småstenar på nära håll
    const th = r() * 2 * PI, t = Math.min(1.02, Math.sqrt(r()) * 1.02), q = P(th, Math.min(1, t)), L = (0.05 + r() * 0.03) * ks, rr = (0.02 + r() * 0.012) * ks;
    const g = new T.SphereGeometry(1, 7, 2, 0, 2 * PI, 0, PI / 2).scale(rr, L * 0.22, L * 0.5);
    g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(0.08 + Math.max(0, t - 0.8) * 2.2, PI / 2 - th + (r() - 0.5) * 0.9, 0, 'YXZ')));
    g.translate(q[0], q[1] - 0.0025, q[2]);
    // normalerna dras mot lodlinjen: lockarna smälter in i skinnet (ingen mörk kontur runt varje)
    { const nn = g.attributes.normal, v = V(0, 0, 0); for (let j = 0; j < nn.count; j++) { v.fromBufferAttribute(nn, j); v.y += 1.3; v.normalize(); nn.setXYZ(j, v.x, v.y, v.z); } }
    tof.push(g);
  }
  // (fårskinnets eget, luggiga lager i tygbiblioteket: med bouclé blev det ett regelbundet prickmönster på nära håll)
  if (tof.length) { const tg = mergeGeometries(tof); tof.forEach(g => g.dispose()); ton(skiftTon(fg, 1.02), () => vav('skinn', () => lagg('tyg', tg, mx(x, y, z, ry)))); }
  for (let i = 0; i < ns; i++) ix.push(0, 1 + (i + 1) % ns, 1 + i);
  for (let j = 1; j < nr; j++) for (let i = 0; i < ns; i++) {
    const a0 = 1 + (j - 1) * ns + i, a1 = 1 + (j - 1) * ns + (i + 1) % ns, b0 = a0 + ns, b1 = a1 + ns;
    ix.push(a0, a1, b1, a0, b1, b0);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  ton(fg, () => vav('skinn', () => lagg('tyg', g, mx(x, y, z, ry))));
}

// Tyg som ligger på en yta och viker sig ner över kanterna (täcke, pläd).
// Lokalt: bredd längs x (kant vid ±B), från z0 till kanten z1 (fotänden), översida y.
function draperi(mk, o) {
  const { B, z0, z1, y, th, hs, hf } = o, R = o.R ?? 0.05;
  const SX = B + hs, Zl = z1 + hf - z0;
  const g0 = new T.BoxGeometry(1, 1, 1, o.nx ?? 26, 3, o.nz ?? 22);
  const p = g0.attributes.position;
  const bend = (s, e) => {
    if (s <= e) return [s, 0, 0];
    const d = s - e, ba = R * PI / 2;
    if (d < ba) { const a = d / R; return [e + R * Math.sin(a), R * (1 - Math.cos(a)), a]; }
    return [e + R, R + (d - ba), PI / 2];
  };
  const veck = o.veck ?? 0.006, skr = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) * 2, Zr = p.getZ(i) + 0.5;
    // fall: vikt (dubbel) kant vid z0 – översidan reser sig i en mjuk vulst, undersidan ligger kvar
    let Yv = p.getY(i) * th, fe = 0;
    if (o.fall) { const dz = Zr * Zl - (o.fallB ?? 0.02); fe = dz < 0 ? 1 : Math.exp(-((dz / 0.028) ** 2)); Yv += (Yv + th / 2) * o.fall * fe; }
    // rundad fri kant: ändytorna buktar ut som en halvcirkel (ingen platt, randig kant)
    const ext = th / 2 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * Yv / th, 2)));
    const sx = X * SX + (Math.abs(X) > 0.999 ? Math.sign(X) * ext : 0), sz = z0 + Zr * Zl + (Zr > 0.999 ? ext : (Zr < 0.001 ? -ext : 0));
    const [px, dx, ax] = bend(Math.abs(sx), B);
    const [pz, dz, az] = bend(sz, z1);
    const sg = Math.sign(sx) || 1;
    const hang = Math.max(ax, az) / (PI / 2);
    const w = veck * (Math.sin(sx * 11 + sz * 4) * 0.5 + Math.sin(sz * 7.3 - sx * 3) * 0.3 + Math.sin(sx * 23 - sz * 17) * 0.2) * (1 - hang);
    const fold = 0.01 * hang * Math.sin((ax > az ? sz : sx) * 9);
    const X2 = sg * (px + Math.sin(ax) * (Yv + fold));
    const Y2 = y - Math.max(dx, dz) + Yv * Math.cos(ax) * Math.cos(az) + w;
    const Z2 = pz + Math.sin(az) * (Yv + fold);
    p.setXYZ(i, X2, Y2, Z2);
    skr[i] = Math.min(1, Math.max(0.82, 0.93 + 0.07 * w / Math.max(0.002, veck) - 0.06 * hang * (0.5 + 0.5 * Math.sin((ax > az ? sz : sx) * 9)))) * (1 - 0.35 * fe * (1 - fe));
  }
  g0.setAttribute('skr', new T.Float32BufferAttribute(skr, 1));
  lagg(mk, mjuk(g0), mx(0, 0, 0));
}

// Gardin med wave-veck: lokalt x längs fönstret, +z in mot rummet, stången i z = 0.
// Jämna S-veck uppifrån (glidarna sitter på stången vid vågtopparna), mjuka linneveck
// som vidgar sig lite nedåt; vågdalarna får mjuk skugga. Slutar 1 cm över golvet.
function gardin(w, y0, y1) {
  const lam = 0.115, n = Math.max(8, Math.round(w / lam) * 8), h = y1 - y0;
  const g = new T.PlaneGeometry(w, h, n, 8), p = g.attributes.position, skr = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i), ner = 0.5 - Y / h, fas = X * 2 * PI / lam;
    const z = 0.034 * Math.sin(fas) * (1 - 0.2 * ner * ner) + 0.006 * ner * Math.sin(X * 31 + 1.3) * Math.sin(Y * 3) * Math.min(1, (Y + h / 2) / 0.25);
    p.setZ(i, z + 0.004); skr[i] = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(fas));
  }
  g.setAttribute('skr', new T.Float32BufferAttribute(skr, 1));
  g.computeVertexNormals();
  ton('#ece6da', () => vav('linne', () => lagg('gardin', g, mx(0, (y0 + y1) / 2, 0))));
  // fållen: en mjuk, jämn kant (dubbelvikt tyg) som följer vågen, så att underkanten blir rak
  { const pf = [];
    for (let k = 0; k <= n; k++) { const X = -w / 2 + k * w / n, fas = X * 2 * PI / lam; pf.push(V(X, -h / 2 + 0.018, 0.034 * Math.sin(fas) * (1 - 0.2 * (0.5 + (h / 2 - 0.018) / h) ** 2) + 0.004)); }
    ton('#efe9de', () => vav('linne', () => lagg('gardin', new T.TubeGeometry(new T.CatmullRomCurve3(pf), n * 2, 0.0045, 6, false), mx(0, (y0 + y1) / 2, 0)))); }
  // glidare: små ringar runt stången vid vågtopparna mot fönstret
  for (let k = 0; k < Math.round(w / lam); k++) { const xx = -w / 2 + (k + 0.75) * lam; if (xx < w / 2) lagg('svart', new T.TorusGeometry(0.0135, 0.0025, 4, 10), mx(xx, y1 + 0.012, 0, PI / 2)); }
}

// Gardiner vid öppning nr i (index i H.oppningar): 'v', 'h' eller 'b' (båda), eller 'rull'.
function gardiner(i, sidor = 'b', panel = 0.36) {
  const h = HAL.find(k => k.i === i);
  if (!h) return;
  const f = h.f, ua = I + 0.03, ub = f.len - I - 0.03;
  const pkt = (u, ut) => f.o.clone().addScaledVector(f.u, u).addScaledVector(f.n, -I - ut);
  const ry = Math.atan2(-f.n.x, -f.n.z);  // lokalt +z in mot rummet
  if (sidor === 'rull') {
    const m = pkt((h.u0 + h.u1) / 2, -0.03), w = h.u1 - h.u0 - 0.03, ned = (h.v1 - h.v0) * 0.38;
    med(m.x, m.z, ry, () => {
      // kassett med rundade kanter och gavlar, tyget i linne (lätt vävstruktur och små
      // mjuka böljor), en nederkantlist i ljus aluminium och ett draglock med kula
      const yk = h.v1 - 0.035, yb = yk - 0.03 - ned;
      ton('#ece8e0', () => { rbx('vit', w + 0.04, 0.06, 0.055, 0, yk, 0.006, 0.012, 0, 0, 3); for (const k of [-1, 1]) rbx('vit', 0.014, 0.066, 0.06, k * (w / 2 + 0.024), yk, 0.006, 0.004, 0, 0, 2); });
      { const g = new T.PlaneGeometry(w, ned, 2, 8), p = g.attributes.position;
        for (let k = 0; k < p.count; k++) p.setZ(k, 0.0025 * Math.sin((p.getY(k) / ned + 0.5) * PI * 4));
        g.computeVertexNormals();
        ton('#ebe4d8', () => vav('linne', () => lagg('linne', g, mx(0, yk - 0.03 - ned / 2, 0.02)))); }
      ton('#d9d6d0', () => { rbx('vit', w + 0.004, 0.02, 0.014, 0, yb, 0.02, 0.006, 0, 0, 2);
        cyl('vit', 0.0015, 0.0015, 0.12, w * 0.35, yb - 0.07, 0.022, 6);
        lagg('vit', new T.SphereGeometry(0.008, 12, 8), mx(w * 0.35, yb - 0.135, 0.022)); });
    });
    return;
  }
  let topp = Math.min(h.v1 + 0.22, Math.min(takVid(pkt(h.u0, 0.1).x, pkt(h.u0, 0.1).z), takVid(pkt(h.u1, 0.1).x, pkt(h.u1, 0.1).z)) - 0.05);
  if (h.v1 < SNITT[0] - 0.06) topp = Math.min(topp, SNITT[0] - 0.035);
  // längdorna staplas bredvid fönstret; smalare än 8 cm (mot ett hörn) läggs inte alls
  const lista = [];
  if (sidor !== 'h') lista.push([Math.max(ua, h.u0 - panel + 0.08), h.u0 + 0.08]);
  if (sidor !== 'v') lista.push([h.u1 - 0.08, Math.min(ub, h.u1 + panel - 0.08)]);
  const vu = (wx, wz) => (f.u.x ? (wx - f.o.x) * f.u.x : (wz - f.o.z) * f.u.z);   // läget längs väggen
  const sp = [];
  const p0 = pkt(0, 0);
  VAGGAR.forEach(w => { if ((w.axel === 'x') === !!f.u.x) return;
    const s = w.axel === 'z' ? vu(w.c, 0) : vu(0, w.c), d0 = w.axel === 'z' ? p0.z : p0.x;
    if (d0 > w.lo - 0.05 && d0 < w.hi + 0.05) sp.push([s - w.t / 2 - 0.03, s + w.t / 2 + 0.03]); });
  HINDER.forEach(hd => { if (hd.typ !== 'mobel' || hd.niva === 'loft') return;
    const c = pkt(h.u0, 0.12); const nara = f.u.x ? (hd.z0 < c.z + 0.12 && hd.z1 > c.z - 0.12) : (hd.x0 < c.x + 0.12 && hd.x1 > c.x - 0.12);
    if (!nara) return; const a1 = f.u.x ? vu(hd.x0, 0) : vu(0, hd.z0), b1 = f.u.x ? vu(hd.x1, 0) : vu(0, hd.z1); sp.push([Math.min(a1, b1) - 0.02, Math.max(a1, b1) + 0.02]); });
  const klipp = ([a, b]) => { for (const [p, q] of sp) { if (q <= a || p >= b) continue; if (p <= (a + b) / 2) a = Math.max(a, q); else b = Math.min(b, p); } return [a, b]; };
  const kvar = lista.map(klipp).filter(([a, b]) => b - a >= 0.08);
  if (!kvar.length) return;
  // stången går mellan två väggfästen; knopparna sitter utanför fästena, inom väggen
  const ra = Math.max(ua + 0.03, Math.min(...kvar.map(l => l[0])) - 0.04), rb = Math.min(ub - 0.03, Math.max(...kvar.map(l => l[1])) + 0.04);
  const rm = pkt((ra + rb) / 2, 0.075), L2 = rb - ra, yr = topp + 0.02;
  med(rm.x, rm.z, ry, () => {
    cyl('svart', 0.01, 0.01, L2, 0, yr, 0, 12, true, 0, PI / 2);
    [-1, 1].forEach(k => {
      const xf = k * (L2 / 2 - 0.035);
      cyl('svart', 0.022, 0.022, 0.008, xf, yr, -0.071, 14, false, PI / 2);          // rosett mot väggen
      cyl('svart', 0.006, 0.006, 0.068, xf, yr, -0.037, 10, false, PI / 2);          // arm ut till stången
      lagg('svart', new T.TorusGeometry(0.0115, 0.003, 4, 10), mx(xf, yr, 0, PI / 2));   // klämring
      lagg('svart', new T.SphereGeometry(0.016, 12, 6), mx(k * (L2 / 2 + 0.012), yr, 0));  // knopp
    });
  });
  kvar.forEach(([a, b]) => {
    const m = pkt((a + b) / 2, 0.075), w = Math.min(b - a, L2 - 0.1);
    med(m.x, m.z, ry, () => gardin(w, 0.014, topp + 0.008));
  });
}

// ---- Kontaktskugga på golvet ----
function skugga(x, z, w, d, ry = 0, m = 0.18, alfa = 0.55, y = 0.021, rx = 0) {
  const xs = [-w / 2 - m, -w / 2, w / 2, w / 2 + m], zs = [-d / 2 - m, -d / 2, d / 2, d / 2 + m], tu = [0, 0.5, 0.5, 1];
  const pos = [], uv = [], ix = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { pos.push(xs[i], 0, zs[j]); uv.push(tu[i], tu[j]); }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const a = j * 4 + i; ix.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(new Array(16).fill(0).flatMap(() => [0, 1, 0]), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.userData.alfa = alfa;
  lagg('skugga', g, mx(x, y, z, ry, rx));
}

// ---- Möbler (lokalt: framsidan mot +z, mitt på golvet i origo) ----
const soffa = (...a) => vav('boucle', () => soffa0(...a));
function soffa0(w, d0 = 0.86, o = {}) {
  const d = Math.min(d0, 0.87);
  const n = o.n ?? (w > 1.95 ? 3 : 2), fg = ljusTon(o.ton ?? '#9a958b', 0.5);
  // två sittplatser i soffan, blicken ut i rummet
  [-1, 1].forEach(k => sitt('Soffan', [k * w * 0.22, 1.1, 0.02], [k * w * 0.1, 0.95, 2.6], [w * 0.4, 0.45, d * 0.8, k * w * 0.22, 0.3, 0.05]));
  skugga(0, 0, w, d, 0, 0.2, 0.6);
  hind(w, d);
  ton('#7a5a3c', () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl('ek', 0.018, 0.012, 0.1, sx * (w / 2 - 0.1), 0.05, sz * (d / 2 - 0.1), 10);
  });
  ton(fg, () => {
    // stoppad stomme: sarg, rundade armstöd med kanter och en mjuk rygg (inga klossar)
    dyna('tyg', w, 0.2, d, 0, 0.2, 0, { r: 0.045, puff: 0.004, fram: 0.008, sida: 0.004 });
    for (const s of [-1, 1]) dyna('tyg', 0.17, 0.44, d, s * (w / 2 - 0.085), 0.42, 0, { r: 0.075, puff: 0.012, sida: 0.01, fram: 0.012, kant: 'topp', kantF: 0.9 });
    dyna('tyg', w - 0.03, 0.5, 0.2, 0, 0.55, -d / 2 + 0.1, { r: 0.07, puff: 0.012, fram: 0.015, bak: 0.006, rx: -0.05 });
    const wi = w - 0.34, cd = d - 0.24;
    for (let i = 0; i < n; i++) {
      const x = -wi / 2 + wi * (i + 0.5) / n, cw = wi / n - 0.01;
      // sittdyna: lätt insjunken mitt, svällande framkant, kedrar runt båda sömmarna
      dyna('tyg', cw, 0.15, cd, x, 0.37, 0.09, { r: 0.04, puff: 0.022, sjunk: 0.012, fram: 0.014, sida: 0.006, veck: 0.0025, kant: 'bada' });
      // ryggdyna: fyllig och lutad bakåt, mjukt rundad, något bredare upptill
      dyna('tyg', cw - 0.004, 0.46, 0.17, x, 0.66, -d / 2 + 0.29, { r: 0.065, puff: 0.012, fram: 0.035, bak: 0.01, sida: 0.012, veck: 0.002, rx: -0.2, kant: 'topp' });
    }
  });
  if (o.kuddar !== false) {
    const wi = w - 0.34;
    // prydnadskuddar: samma puffiga form, speglade kring soffans mitt, dämpade toner
    const luta = (s, x, ry, fg) => {
      const t = PI / 2 - 0.26, h = 0.16 * s, dd = 0.44 * s, b = 0.15 * h;
      const cy = 0.445 + (dd / 2) * Math.sin(t) - 0.012, cz = -d / 2 + 0.375 + b * Math.sin(t) + 0.02;
      ton(fg, () => vav('linne', () => kuddeRund('tyg', 0.44 * s, h, dd, x, cy, cz, { rx: t, ry, nx: 14, nz: 14 })));
    };
    const xk = wi / 2 - 0.26, k1 = o.k1 ?? '#c48a68', k2 = o.k2 ?? PAL.havre;
    if (n > 2) {
      // ytterpar i samma ton, en mindre kudde i mitten
      luta(1, -xk, 0.14, k2); luta(1, xk, -0.14, k2);
      luta(0.9, 0, 0, o.k3 ?? k1);
    } else { luta(1, -xk, 0.14, k1); luta(1, xk, -0.14, k2); }
    // pläd över armstödet
    ton(ljusTon(o.pled ?? PAL.sand, 0.2), () => vav('stick', () => {
      med(w / 2 - 0.085, 0, PI / 2, () => draperi('tyg', { B: d / 2 - 0.25, z0: -0.03, z1: 0.045, y: 0.655, th: 0.02, hs: 0.0, hf: 0.42, R: 0.045, veck: 0.007, nx: 12, nz: 18 }));
    }));
  }
}

const fatolj = (o = {}) => vav('sammet', () => fatolj0({ ton: '#b98066', ...o }));
function fatolj0(o = {}) {
  sitt('Fåtöljen', [0, 1.1, 0.0], [0, 0.95, 2.6], [0.7, 0.5, 0.7, 0, 0.3, 0]);
  skugga(0, 0, 0.8, 0.8, 0, 0.16, 0.5);
  hind(0.8, 0.8);
  ton('#7a5a3c', () => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl('ek', 0.018, 0.012, 0.16, sx * 0.3, 0.08, sz * 0.3, 8); });
  ton(ljusTon(o.ton ?? '#c7b9a3', 0.2), () => {
    // stoppad sits, rygg och rundade armstöd; sittdynan lätt insjunken med kedrar
    dyna('tyg', 0.78, 0.2, 0.78, 0, 0.26, 0, { r: 0.06, puff: 0.006, fram: 0.01, sida: 0.006 });
    dyna('tyg', 0.78, 0.55, 0.16, 0, 0.56, -0.31, { r: 0.075, puff: 0.012, fram: 0.022, bak: 0.008, sida: 0.006, veck: 0.002, rx: -0.12, kant: 'topp' });
    for (const s of [-1, 1]) dyna('tyg', 0.14, 0.3, 0.66, s * 0.32, 0.48, 0.02, { r: 0.065, puff: 0.01, sida: 0.008, fram: 0.012, kant: 'topp', kantF: 0.9 });
    dyna('tyg', 0.5, 0.13, 0.56, 0, 0.42, 0.06, { r: 0.04, puff: 0.02, sjunk: 0.01, fram: 0.012, sida: 0.005, veck: 0.002, kant: 'bada' });
    farskinn(0, 0.484, 0.04, PI / 2, 0.21, 0.29, '#f1ebe0');
  });
}

function stol(sittplats = true) {
  // de två första matstolarna i huset blir sittplatser, blicken mot bordet
  if (sittplats && NSTOL++ < 2) sitt('Matplatsen', [0, 1.15, -0.02], [0, 0.78, 0.9], [0.44, 0.5, 0.43, 0, 0.25, 0]);
  skugga(0, 0, 0.44, 0.44, 0, 0.1, 0.32);
  hind(0.44, 0.44);
  rbx('ek', 0.44, 0.035, 0.43, 0, 0.455, 0, 0.012, 0, 0, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lagg('ek', new T.CylinderGeometry(0.016, 0.012, 0.44, 8), mx(sx * 0.18, 0.22, sz * 0.17, 0, sz * 0.05, -sx * 0.05));
  for (const sx of [-1, 1]) cyl('ek', 0.012, 0.012, 0.38, sx * 0.19, 0.66, -0.2, 8);
  rbx('ek', 0.43, 0.1, 0.022, 0, 0.8, -0.205, 0.01, 0, -0.08, 1);
  ton('#d6cab6', () => dyna('tyg', 0.38, 0.032, 0.37, 0, 0.488, 0.01, { r: 0.013, puff: 0.01, sjunk: 0.002, fram: 0.003, sida: 0.003, nx: 8, ny: 2, nz: 8, kant: 'topp', kantR: 0.003 }));
}

let SENBORD = null;   // senaste matbordets mått (löparen i bordsdukningen följer bordets längd)
function bord(w, d, h = 0.74) {
  SENBORD = [w, d];
  skugga(0, 0, w, d, 0, 0.18, 0.28);
  hind(w, d);
  rbx('ek', w, 0.032, d, 0, h - 0.016, 0, 0.01, 0, 0, 2);
  rbx('ek', w - 0.12, 0.06, d - 0.12, 0, h - 0.062, 0, 0.005, 0, 0, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lagg('ek', new T.CylinderGeometry(0.024, 0.017, h - 0.032, 10), mx(sx * (w / 2 - 0.08), (h - 0.032) / 2, sz * (d / 2 - 0.08)));
}

// Liten uppsättning på ett bord: skål, vas med kvistar.
function bordsdukning(y, sk = 0.11) {
  // linnelöpare längs bordets längd under uppsättningen: 3 mm tjock med en smal fåll i ändarna
  if (SENBORD) { const [bw, bd] = SENBORD, lx = bw >= bd, L = Math.max(bw, bd) - 0.1, B = Math.min(0.38, Math.min(bw, bd) - 0.3);
    if (B > 0.2) ton('#f3ead8', () => vav('linne', () => { box('tyg', lx ? L : B, 0.003, lx ? B : L, 0, y + 0.0015, 0);
      for (const s of [-1, 1]) ton('#e2d6c0', () => box('tyg', lx ? 0.012 : B, 0.0036, lx ? B : 0.012, lx ? s * (L / 2 - 0.02) : 0, y + 0.0018, lx ? 0 : s * (L / 2 - 0.02))); }));
    y += 0.003; SENBORD = null; }
  ton('#d9d2c6', () => svarv('keramik', [[0, 0], [0.05, 0], [0.09, 0.02], [sk, 0.06], [sk - 0.005, 0.065], [0.08, 0.03], [0, 0.025]], -0.12, y, 0.02, 44));   // 44 segment: kanten var kantig på nära håll
  frukter(-0.12, y + 0.03, 0.02, 0.7);
  vas(0.16, y, -0.04, '#8c8f80', 0.2, true);
  // ljusstake i mässing med ett kronljus
  ton('#b08d57', () => glans(0.8, () => svarv('keramik', [[0, 0], [0.035, 0], [0.036, 0.006], [0.012, 0.014], [0.01, 0.06], [0.016, 0.065], [0.016, 0.08], [0, 0.08]], 0.04, y, 0.15, 24)));
  ljus(0.04, y + 0.08, 0.15, 0.011, 0.2);
}

function vas(x, y, z, fg = '#d8d0c2', h = 0.2, blommor = false) {
  // mjukt svarvad profil (fler punkter och 36 segment: vasen såg kantig ut på nära håll)
  ton(fg, () => svarv('keramik', [[0, 0], [0.04, 0], [0.047, h * 0.06], [0.056, h * 0.17], [0.06, h * 0.3], [0.058, h * 0.45], [0.05, h * 0.62], [0.037, h * 0.77], [0.026, h * 0.88], [0.025, h * 0.95], [0.03, h], [0.024, h], [0.02, h * 0.92], [0, h * 0.9]], x, y, z, 36));
  for (let i = 0; i < 5; i++) {
    const az = i * 2.4 + rnd() * 0.4, lut = 0.1 + rnd() * 0.35, cell = blommor && i % 2 === 0 ? BL.blomma : BL.eukalyptus, L = 0.3 + rnd() * 0.14;
    bladkort(cell, L, x, y + h * 0.85, z, az, lut, { bag: 0.08, vik: 0.02, rull: 0 });
    bladkort(cell, L * 0.9, x, y + h * 0.85, z, az + PI / 2, lut * 0.8, { bag: 0.08, vik: 0.02, rull: 0 });
  }
}

function bocker(x, y, z, ry, n, ligg = false) {
  let bredd = 0;
  // dämpade, ljusa ryggar (ingen nästan svart)
  const F = ['#b8735a', '#d9cbb2', '#6c7a86', '#8a8f7a', '#e6dfd2', '#8a6e58', '#c9a56a', '#74826f'];
  med(x, z, ry, () => {
    let p = 0, yy = y;
    for (let i = 0; i < n; i++) {
      const hh = 0.17 + rnd() * 0.08, tj = 0.016 + rnd() * 0.02, dj = 0.13 + rnd() * 0.04;
      ton(F[Math.floor(rnd() * F.length)], () => {
        if (ligg) { bok((rnd() - 0.5) * 0.02, yy, 0, (rnd() - 0.5) * 0.2, Math.min(0.24, hh), tj, Math.min(0.17, dj), TON); yy += tj; }
        else {
          // stående bok: pärm med rundad rygg ut mot rummet, inslaget i pärmarna ett krämvitt
          // bokblock som syns upptill, och två titelfält på ryggen (inget tryck, ingen text)
          const lut = i === n - 1 && n > 2 ? -0.09 : 0, bx = p + tj / 2 + (lut ? 0.008 : 0);
          rbx('tyg', tj, hh, dj, bx, y + hh / 2, 0, 0.003, 0, 0, 1, lut);
          ton('#efe8d8', () => box('vit', tj - 0.005, 0.003, dj - 0.012, bx - lut * hh / 2, y + hh + 0.0005, -0.003, 0, 0, lut));
          ton(skiftTon(TON, i % 2 ? 1.25 : 0.72), () => { box('tyg', tj * 0.8, hh * 0.16, 0.0012, bx - lut * hh * 0.22, y + hh * 0.72, dj / 2, 0, 0, lut); box('tyg', tj * 0.8, 0.006, 0.0012, bx + lut * hh * 0.3, y + hh * 0.2, dj / 2, 0, 0, lut); });
          p += tj + 0.002 + (lut ? 0.012 : 0);
        }
      });
    }
    bredd = p;
  });
  return bredd;
}

// Liggande bok: pärm (tyg) med 2 mm utstick, krämvitt snitt med fina linjer, rundad rygg
// och ett dämpat titelband. (x, y, z) = mitt på undersidan, bredd w, tjocklek t, djup d.
function bok(x, y, z, ry, w, t, d, fg) {
  med(x, z, ry, () => {
    ton(fg, () => {
      box('tyg', w, 0.0025, d, 0, y + 0.00125, 0); box('tyg', w, 0.0025, d, 0, y + t - 0.00125, 0);
      lagg('tyg', new T.CylinderGeometry(t / 2, t / 2, d, 16, 1, false, PI, PI).rotateX(PI / 2), mx(-w / 2 + t / 2 - 0.002, y + t / 2, 0));
    });
    ton('#efe8d8', () => box('vit', w - t / 2 - 0.004, t - 0.005, d - 0.004, t / 4, y + t / 2, 0));
    ton('#d9d0bd', () => { for (let i = 1; i < 3; i++) box('vit', w - t / 2 - 0.003, 0.0004, 0.0004, t / 4, y + t * i / 3, d / 2 - 0.0015); });
    ton('#cbb98f', () => box('tyg', 0.006, 0.0006, d * 0.7, -w / 2 + 0.03, y + t + 0.0003, 0));
  });
}

// Vägghylla i ek med böcker och en vas: (x, z) vid väggytan, ry så att +z pekar ut i rummet.
function vagghylla(x, z, ry, w, y, kort = false) {
  med(x, z, ry, () => {
    rbx('ek', w, 0.03, 0.22, 0, y, 0.11, 0.006, 0, 0, 1);
    // två konsoler under hyllan, mot väggen
    ton('#2b2a28', () => { for (const s of [-1, 1]) { box('svart', 0.02, 0.12, 0.004, s * (w / 2 - 0.1), y - 0.075, 0.002); box('svart', 0.02, 0.004, 0.16, s * (w / 2 - 0.1), y - 0.017, 0.08); } });
    const bw = bocker(-w / 2 + 0.06, y + 0.015, 0.11, 0, Math.max(3, Math.round(w * (w >= 0.7 ? 6 : 9))));
    slinga(w / 2 - 0.13, y + 0.015, 0.085, kort);
    // en liten tavla lutad mot väggen: överkanten mot väggen, underkanten på hyllan
    const aw = 0.2, ah = 0.26, ax = -w / 2 + 0.06 + bw + 0.03 + aw / 2, lu = 0.12;
    const lutar = w >= 0.7 && ax + aw / 2 < w / 2 - 0.13 - 0.085;
    if (lutar) iRam(mx(ax, y + 0.015 + ah / 2, 0.002), () => tavla(aw, ah, Math.floor(rnd() * 5), rnd() < 0.5 ? 'vit' : 'ek', 0.002));
    if (w >= 0.9 && !lutar) bocker(w / 2 - 0.36, y + 0.015, 0.11, 0.1, 3, true);
  });
}

// Soffbord: rund ekskiva, bricka med ljus, tidning, böcker och en liten växt.
function soffbord(r = 0.38, h = 0.42) {
  skugga(0, 0, r * 1.5, r * 1.5, 0, r * 0.4, 0.3);
  hind(r * 2, r * 2);
  svarv('ek', [[0, 0], [r - 0.01, 0], [r, 0.012], [r, 0.03], [r - 0.012, 0.035], [0, 0.035]], 0, h - 0.035, 0, 64);   // 64 segment: kanten syntes kantig på nära håll
  for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; lagg('ek', new T.CylinderGeometry(0.02, 0.014, h - 0.035, 8), mx(Math.cos(a) * r * 0.6, (h - 0.035) / 2, Math.sin(a) * r * 0.6)); }
  med(0.06, 0.07, 0.35, () => {
    // bricka i rökt ek (svart lack såg ut som plast): botten och rundade kanter
    ton('#5b4636', () => {
      rbx('ek', 0.34, 0.01, 0.22, 0, h + 0.005, 0, 0.004, 0, 0, 1);
      for (const k of [-1, 1]) { rbx('ek', 0.34, 0.03, 0.007, 0, h + 0.02, k * 0.1065, 0.003, 0, 0, 1); rbx('ek', 0.007, 0.03, 0.206, k * 0.1665, h + 0.02, 0, 0.003, 0, 0, 1); }
    });
    ljus(-0.08, h + 0.01, 0.01, 0.034, 0.1);
    ljus(0.0, h + 0.01, -0.04, 0.03, 0.06);
    ton('#c8b9a2', () => svarv('keramik', [[0, 0], [0.03, 0], [0.038, 0.02], [0.04, 0.05], [0.03, 0.08], [0.02, 0.1], [0.022, 0.11], [0.018, 0.11], [0.016, 0.1], [0, 0.098]], 0.09, h + 0.01, 0.02, 28));
    for (let i = 0; i < 3; i++) bladkort(BL.eukalyptus, 0.2, 0.09, h + 0.1, 0.02, i * 2.1, 0.25 + i * 0.12, { bag: 0.1, vik: 0.02 });
  });
  const k = r / 0.4;
  mugg(0.2 * k, h, -0.16 * k, '#ece6dc', 0.8);
  bok(-0.15 * k, h, -0.1 * k, -0.2, 0.22, 0.028, 0.16, '#8a8f7a');
  bok(-0.15 * k, h + 0.028, -0.1 * k, -0.12, 0.2, 0.024, 0.15, '#d9cbb2');
}

// Säng: stoppad ram och sänggavel, madrass, täcke med mjuka kanter, kuddar och pläd.
const sang = (...a) => vav('perkal', () => sang0(...a));
function sang0(w, l = 2.05, o = {}) {
  let ym;
  const ramTon = ljusTon(o.ram ?? '#c4b9a6', 0.4);
  if (o.lag) hind(w + 0.08, l + 0.06); else hind(w + 0.12, l + 0.1);
  if (!o.lag) {
    skugga(0, 0, w + 0.06, l + 0.06, 0, 0.22, 0.7);
    ton('#7a5a3c', () => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl('ek', 0.022, 0.02, 0.09, sx * (w / 2 - 0.06), 0.045, sz * (l / 2 - 0.08), 10); });
    ton(ramTon, () => vav('boucle', () => {
      // stoppad sängram och gavel med kedrar; gaveln har mjuka, lodräta kanaler
      dyna('tyg', w + 0.06, 0.24, l + 0.02, 0, 0.21, 0, { r: 0.04, puff: 0.003, sida: 0.006, fram: 0.006, kant: 'topp', kantF: 0.9 });
      dyna('tyg', w + 0.12, 0.1, 1.02, 0, 0.6, -l / 2 - 0.04, { r: 0.04, puff: 0.012, botten: 0.004, rx: PI / 2, kant: 'topp', kantF: 0.9 });
      const np = Math.max(2, Math.round((w + 0.08) / 0.4));
      for (let i = 0; i < np; i++) dyna('tyg', (w + 0.08) / np - 0.012, 0.06, 0.62, -(w + 0.08) / 2 + (w + 0.08) * (i + 0.5) / np, 0.8, -l / 2 + 0.03, { r: 0.026, puff: 0.022, sida: 0.004, fram: 0.006, bak: 0.004, rx: PI / 2 - 0.06, nx: 8, ny: 3, nz: 12 });
    }));
    ym = 0.33 + 0.2;
    // sängkanten (en per hus): sittande på långsidan med blicken ut i rummet
    if (NSANG++ < 1) sitt('Sängkanten', [w / 2 - 0.12, 1.12, 0.25], [0, 0.95, l / 2 + 2.5], [0.35, 0.5, 0.9, w / 2 - 0.15, 0.3, 0.25]);
    // madrass med rundade kanter och kantband runt båda sömmarna (bäddad med lakan)
    ton('#efebe4', () => dyna('tyg', w, 0.2, l - 0.03, 0, 0.43, 0.01, { r: 0.05, puff: 0.004, sida: 0.006, fram: 0.006, kant: 'bada', kantF: 0.94 }));
  } else {
    // låg ekbädd: indragen sockel, botten och en sarg runt om som madrassen ligger nedsänkt i
    skugga(0, 0, w + 0.1, l + 0.06, 0, 0.18, 0.62, LT + 0.021);
    ton('#9a7a58', () => rbx('ek', w - 0.12, 0.062, l - 0.12, 0, LT + 0.031, 0, 0.008, 0, 0, 1));
    rbx('ek', w + 0.02, 0.03, l + 0.0, 0, LT + 0.08, 0, 0.006, 0, 0, 1);
    for (const s of [-1, 1]) {
      rbx('ek', 0.03, 0.115, l + 0.06, s * (w / 2 + 0.02), LT + 0.1195, 0, 0.008, 0, 0, 2);
      rbx('ek', w + 0.01, 0.115, 0.03, 0, LT + 0.1195, s * (l / 2 + 0.015), 0.008, 0, 0, 2);
    }
    ton('#f1eee8', () => dyna('tyg', w, 0.19, l - 0.02, 0, LT + 0.19, 0.0, { r: 0.06, puff: 0.004, sida: 0.006, fram: 0.006, kant: 'bada', kantF: 0.94 }));
    ym = LT + 0.285;
  }
  const hs = o.lag ? 0.12 : 0.27;
  // täcke: tjockt (8–10 cm på den låga bädden), mjukt rundat över kanterna
  // (plädens böj delar mittpunkt med täckets, så att plädens insida följer täcket runt kanten)
  const Yd = ym + (o.lag ? 0.05 : 0.043), thd = o.lag ? 0.09 : 0.075, Rd = 0.03, VK = 0.016;
  ton(o.tacke ?? '#f1e9dc', () => draperi('tyg', { B: w / 2, z0: -l / 2 + 0.56, z1: l / 2 - 0.02, y: Yd, th: thd, hs: hs + 0.02, hf: hs + 0.02, R: Rd, veck: VK, fall: 0.42, fallB: 0.24, nx: 26, nz: 30 }));
  // (täckets nedvikta överkant framför kuddarna är täckets egen fall-vulst)
  // kuddar 50 x 70 som vilar på madrassen och lutar mot gaveln (vid låg bädd mot väggen),
  // framför dem prydnadskuddar i havre och salvia
  const np = w > 1.1 ? 2 : 1, kw = Math.min(0.7, w / np - 0.03), zH = -l / 2 + (o.lag ? 0.02 : 0.075);
  const vila = (bw, bh, bd, x, zBak, t, ry, fg) => {
    const b = 0.15 * bh;   // undersidan under mitten
    const cy = ym + b * Math.cos(t) + bd / 2 * Math.sin(t) - 0.008, cz = zBak + bd / 2 * Math.cos(t) + b * Math.sin(t);
    ton(fg, () => kuddeRund('tyg', bw, bh, bd, x, cy, cz, { rx: t, ry, nx: 16, nz: 12 }));
  };
  for (let i = 0; i < np; i++) {
    const x = np === 1 ? 0 : (i ? 1 : -1) * (kw / 2 + 0.012);
    vila(kw, 0.17, 0.5, x, zH, 0.26, 0, '#f2eee8');
  }
  // prydnadskuddar speglade kring sängens mitt
  const pk = np === 2 ? [[-0.21, '#dcd1bf', 0.06], [0.21, o.kudde ?? '#a9b39b', -0.06]] : [[0, '#a9b39b', 0]];
  vav('linne', () => pk.forEach(([x, fg, ry]) => vila(0.44, 0.15, 0.44, x, zH + 0.2, o.lag ? 0.4 : 0.95, ry, fg)));
  if (w >= 1.2 && !o.lag) vav('linne', () => vila(0.4, 0.12, 0.28, 0, zH + 0.33, 1.1, 0, '#c9957a'));
  if (o.lag) {
    // fårskinn vid bädden, bok och en bordslampa på en låg ekpall
    // fårskinnet vid fotänden, där det får plats med 15 cm till räcken, väggar och bädden
    farskinnFritt([[0.17, l / 2 + 0.75, PI / 2], [0, l / 2 + 0.6, PI / 2], [0.2, l / 2 + 0.6, PI / 2 + 0.3], [0, l / 2 + 0.75, PI / 2]]);
    // ekpallen vid huvudänden; bokhögen på golvet på pallens bortre sida, fri från pallen,
    // bädden och loftets räcken
    skugga(-(w / 2 + 0.42), -l / 2 + 0.22, 0.3, 0.3, 0, 0.08, 0.4, LT + 0.021);
    skugga(-(w / 2 + 0.7), -l / 2 + 0.22, 0.26, 0.22, 0, 0.06, 0.3, LT + 0.021);
    bocker(-(w / 2 + 0.7), LT, -l / 2 + 0.22, 0.25, 3, true);
    rbx('ek', 0.24, 0.2, 0.24, -(w / 2 + 0.42), LT + 0.1, -l / 2 + 0.22, 0.012, 0, 0, 2);
    bordslampa(-(w / 2 + 0.42), LT + 0.2, -l / 2 + 0.22, 0.85, 'ek');
  }
  // pläd över fotänden
  ton(ljusTon(o.pled ?? '#b5ab9a', 0.3), () => vav('stick', () => {
    // samma veck som täcket (ligger an), vikt dubbel kant mot huvudänden (fall)
    const thp = o.lag ? 0.024 : 0.022, Yp = Yd + thd / 2 + thp / 2 + 0.004 + VK * 0.15;
    draperi('tyg', { B: w / 2, z0: l / 2 - 0.5, z1: l / 2 - 0.02, y: Yp, th: thp, hs: hs * (o.lag ? 0.55 : 0.85), hf: o.lag ? 0.09 : 0.12, R: Rd + (Yp - Yd), veck: VK, fall: 0.9, nx: 30, nz: 22 });
  }));
}

function nattbord(o = {}) {
  skugga(0, 0, 0.42, 0.38, 0, 0.1, 0.45);
  hind(0.42, 0.36);
  // smala avsmalnande ekben, stomme med öppen hylla, låda upptill och en 2 cm skiva med utstick
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lagg('ek', new T.CylinderGeometry(0.014, 0.01, 0.2, 10), mx(sx * 0.18, 0.1, sz * 0.13));
  stomme('ek', 0.42, 0.3, 0.34, 0, 0.2, -0.01, null, { utanTak: true, inre: '#d8bf98', hyllor: [0.375] });
  rbx('ek', 0.46, 0.02, 0.38, 0, 0.51, 0, 0.006, 0, 0, 2);
  bok(-0.04, 0.218, 0.0, 0.1, 0.2, 0.03, 0.15, '#7c8794');
  oppningsbar('Nattduksbordets låda', 'lada', 'z', 0.24, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(0, 0.44, 0.168)), () => {
    inne('#e2cfae', V(0, 0, -0.2), () => rbx('ek', 0.4, 0.1, 0.016, 0, 0, 0, 0.004, 0, 0, 2));
    ton('#3a2e24', () => lagg('ek', new T.SphereGeometry(0.011, 12, 8), mx(0, 0.005, 0.014)));
    ton('#d9c4a4', () => { box('ek', 0.36, 0.008, 0.3, 0, -0.041, -0.155); for (const sx of [-1, 1]) box('ek', 0.01, 0.07, 0.3, sx * 0.18, -0.01, -0.155); box('ek', 0.36, 0.07, 0.01, 0, -0.01, -0.3); });
    // böcker, läsglasögon och en laddare
    [['#a24a2e', 0.02], ['#3f4c55', 0.018]].forEach(([fg, tj], j) => ton(fg, () => rbx('ek', 0.13, tj, 0.19, -0.1, -0.037 + tj / 2 + j * 0.02, -0.15, 0.003, 0.1 * j, 0, 1)));
    ton('#222', () => { for (const s of [-1, 1]) lagg('ek', new T.TorusGeometry(0.018, 0.002, 4, 8), mx(0.06 + s * 0.022, -0.03, -0.12, 0, -PI / 2, 0)); box('ek', 0.12, 0.003, 0.003, 0.06, -0.03, -0.15); });
    ton('#f2f0ea', () => { rbx('ek', 0.035, 0.022, 0.035, 0.12, -0.026, -0.24, 0.006, 0, 0, 1); lagg('ek', new T.TorusGeometry(0.04, 0.0025, 4, 8, PI * 1.5), mx(0.08, -0.035, -0.22, 0, -PI / 2, 0)); });
  });
  // lampa och en bok ovanpå, med marginal till skivans kanter
  const sd = o.sida ?? 1;   // lampan på sidan bort från sängen
  bordslampa(0.1 * sd, 0.52, -0.02, 1, o.fot);
  bok(-0.1 * sd, 0.52, 0.06, 0.15, 0.15, 0.025, 0.2, '#b8735a');
}

function garderob(w, d, h, n, typ = 'klader') {
  skugga(0, 0, w, d, 0, 0.12, 0.45);
  hind(w, d);
  stomme('vit', w, h, d - 0.02, 0, 0, -0.01, null, { gangjarn: Array.from({ length: n }, (_, i) => [i % 2 === 0 ? -1 : 1, 0.3, h - 0.3]).filter((g, i) => i === 0 || i === n - 1 || n >= 3) });
  ton('#3a3733', () => box('vit', w - 0.04, 0.07, d - 0.06, 0, 0.035, -0.02));
  // ljust garderobsgolv i björk ovanpå sockeln
  ton(BJORK, () => box('vit', w - 0.04, 0.012, d - 0.07, 0, 0.076, -0.025));
  garderobInne(w, d - 0.02, h, typ);
  const dw = w / n;
  for (let k = 1; k < n; k++) if (n >= 3) box('vit', 0.018, h - 0.036, d - 0.05, -w / 2 + dw * k, h / 2, -0.02);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    const kant = i % 2 === 0 ? 1 : -1;
    // dörren hänger i gångjärn på motsatt sida om handtaget och öppnar utåt
    const Xa = V(kant, 0, 0), Za = V(0, 0, 0).crossVectors(Xa, V(0, 1, 0)), zs = Za.z;
    const m = BAS.clone().multiply(new T.Matrix4().makeBasis(Xa, V(0, 1, 0), Za).setPosition(x - kant * (dw / 2 - 0.003), 0, d / 2 + 0.001));
    oppningsbar('Garderobsdörr', 'lucka', 'y', (zs < 0 ? 1 : -1) * 1.3, 0, m, () => {
      rbx('vit', dw - 0.006, h - 0.09, 0.022, (dw - 0.006) / 2, h / 2 + 0.04, -zs * 0.011, 0.006, 0, 0, 1);
      ton('#2a2928', () => box('vit', 0.014, 0.36, 0.02, dw - 0.053, 1.05, zs * 0.009));
    });
  }
  box('svart', w - 0.04, 0.07, 0.02, 0, 0.035, d / 2 - 0.05);
}

// Rundad rektangel (mitt, bredd, djup, hörnradie) som punkter [x, z] moturs; utv = utåt.
function rundRekt(cx, cz, w, d, r, utv = 0, seg = 6) {
  const ut = [], a = w / 2 - r, c = d / 2 - r, R = r + utv;
  [[a, c, 0], [-a, c, PI / 2], [-a, -c, PI], [a, -c, 1.5 * PI]].forEach(([hx, hz, v0]) => {
    for (let i = 0; i <= seg; i++) { const v = v0 + i / seg * PI / 2; ut.push([cx + hx + Math.cos(v) * R, cz + hz + Math.sin(v) * R]); }
  });
  return ut;
}
function rundRektPath(cx, cz, w, d, r, utv = 0) {
  const pts = rundRekt(cx, cz, w, d, r, utv), pa = new T.Path();
  pts.forEach(([x, z], i) => (i ? pa.lineTo(x, z) : pa.moveTo(x, z))); pa.closePath();
  return pa;
}
// Nedsänkt ho i borstat stål: väggar med rundade innerhörn (in- och utsida), botten,
// och en tunn plan stålkant i nivå med bänkskivan. Lokalt: y = överkant.
function ho(cx, cz, w, d, djup, y) {
  const P = rundRekt(cx, cz, w, d, 0.02, 0, 8), n = P.length, pos = [];
  const quad = (a, b, c, e) => pos.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let i = 0; i < n; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % n];
    quad([x0, y - djup, z0], [x1, y - djup, z1], [x1, y, z1], [x0, y, z0]);                       // insidan (moturs sett inifrån)
    const o = (q, k) => { const dx = q[0] - cx, dz = q[1] - cz, l = Math.hypot(dx, dz); return [q[0] + dx / l * 0.0015, k, q[1] + dz / l * 0.0015]; };
    quad(o(P[(i + 1) % n], y - djup), o(P[i], y - djup), o(P[i], y - 0.004), o(P[(i + 1) % n], y - 0.004));   // utsidan
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  ton('#d9d6d0', () => stal(mjukStal(g), mx(0, 0, 0), 'diskstal'));
  const sh = new T.Shape(P.map(([x, z]) => new T.Vector2(x, -z)));
  ton('#cdcac4', () => stal(new T.ShapeGeometry(sh).rotateX(-PI / 2), mx(0, y - djup + 0.0005, 0), 'diskstal'));
  ton('#7d7d7b', () => stal(new T.ShapeGeometry(sh).rotateX(PI / 2), mx(0, y - djup - 0.0005, 0), 'diskstal'));
  // tunn kant, 12 mm bred och 1,8 mm tjock, som ligger an mot skivan (en egen platta med
  // kantyta, inte en yta i nästan samma plan som skivan: den flimrade och fick skuggränder)
  const kant = new T.Shape(rundRekt(cx, cz, w, d, 0.02, 0.012, 8).map(([x, z]) => new T.Vector2(x, -z)));
  kant.holes.push(new T.Path(P.map(([x, z]) => new T.Vector2(x, -z)).reverse()));
  ton('#dfdcd6', () => stal(new T.ExtrudeGeometry(kant, { depth: 0.0025, bevelEnabled: false, curveSegments: 10 }).rotateX(-PI / 2), mx(0, y + 0.0015, 0), 'diskstal'));
}
// stålets väggar: sammanslagna hörn och mjuka normaler (inga ljusa skarvar i hörnen)
function mjukStal(g) { const m = mergeVertices(g, 1e-5); g.dispose(); m.computeVertexNormals(); return m; }

// ---- Skåpens insida och innehåll ----
// Skåpstomme med 18 mm sidor, botten, tak och rygg: utsidan i yttre ton, insidan i ljus
// björk. Hyllor med ljus framkant och små gångjärn på insidan av gångjärnssidan.
const BJORK = '#ede4d4';
// synliga skåpgavlar: frontens grön något ljusare, eftersom sidorna får mindre ljus än
// luckorna (lamporna lyser framifrån) och annars blev nästan svarta på kvällen
const GAVEL = '#a4ac9c';
function stomme(mk, w, h, d, cx, y0, cz, yttre, o = {}) {
  const t = 0.018, inre = o.inre ?? BJORK, z0 = cz - d / 2, ym = y0 + h / 2;
  inne(inre, V(cx, ym, cz), () => ton(yttre, () => {
    for (const s of [-1, 1]) box(mk, t, h, d, cx + s * (w / 2 - t / 2), ym, cz);
    box(mk, w - 2 * t, t, d, cx, y0 + t / 2, cz);
    if (!o.utanTak) box(mk, w - 2 * t, t, d, cx, y0 + h - t / 2, cz);
    box(mk, w - 2 * t, h - 2 * t, 0.008, cx, ym, z0 + 0.004);
  }));
  ton(inre, () => (o.hyllor || []).forEach(y => {
    box(mk, w - 2 * t - 0.002, 0.018, d - 0.035, cx, y, cz - 0.012);
    ton('#f6f2ea', () => box(mk, w - 2 * t - 0.002, 0.019, 0.003, cx, y, cz + d / 2 - 0.028));
  }));
  // gångjärn: små koppar på insidan av sidan
  (o.gangjarn || []).forEach(([sx, ...ys]) => ys.forEach(y => ton('#9a9a96', () => cyl(mk, 0.017, 0.017, 0.012, cx + sx * (w / 2 - t - 0.006), y, cz + d / 2 - 0.03, 8, false, 0, PI / 2))));
}
const runt = (mk, r0, r1, h, x, y, z, fg) => ton(fg, () => lagg(mk, new T.CylinderGeometry(r1, r0, h, mk === 'svart' ? 14 : 24), mx(x, y + h / 2, z)));
// överskåp: tallrikar, skålar, glas, muggar och burkar på två hyllplan
function overInnehall(w, xc, yb, yh, zc) {
  const L = xc - w / 2 + 0.03, B = w - 0.06;
  // nedre hyllplanet: tallriksstaplar och skålar
  // tallriksstaplar bredvid varandra (bara de som får plats), staplade utan glipor; bara
  // den översta tallriken har lock (de andras syns inte)
  // (riktiga tallrikar: fotring, uppvikt brätte med rundad kant; bara den översta har insida)
  const stapel = (cx, r, n, y0) => { for (let i = 0; i < n; i++) ton(i % 3 ? '#f4f2ee' : '#ece8e0', () => svarv('keramik',
    i < n - 1 ? [[r * 0.5, 0], [r * 0.56, 0.003], [r * 0.97, 0.0095], [r, 0.0115], [r * 0.97, 0.013]]
      : [[0, 0.004], [r * 0.5, 0.004], [r * 0.5, 0], [r * 0.56, 0.003], [r * 0.97, 0.0095], [r, 0.0115], [r * 0.97, 0.013], [r * 0.62, 0.0075], [r * 0.55, 0.006], [0, 0.006]], cx, y0 + i * 0.011, zc, 20)); };
  stapel(L + 0.115, 0.115, 6, yb);
  const tva = L + 0.43 <= L + B;
  if (tva) stapel(L + 0.335, 0.095, 5, yb);
  const sx = L + B - 0.075 > L + (tva ? 0.43 : 0.23) + 0.075 ? L + B - 0.075 : null;
  for (let i = 0; i < 3; i++) ton(['#d9d2c6', '#8c8f80', '#e9e4da'][i], () => svarv('keramik', [[0, 0], [0.04, 0], [0.075 - i * 0.008, 0.05], [0.07 - i * 0.008, 0.05], [0.035, 0.008], [0, 0.008]], sx ?? L + (tva ? 0.335 : 0.115), (sx ? yb : yb + (tva ? 0.055 : 0.066)) + i * 0.008, zc, 24));
  // övre hyllplanet: dricksglas och vinglas i glas, muggar och burkar
  // (dricksglasen har tunn vägg med in- och utsida och en tjock botten, så att de syns som glas)
  for (let i = 0; i < 4; i++) lagg('glas', new T.LatheGeometry([[0, 0], [0.031, 0], [0.036, 0.1], [0.0345, 0.1], [0.0295, 0.009], [0, 0.009]].map(q => new T.Vector2(q[0], q[1])), 16), mx(L + 0.05 + i * 0.08, yh, zc + 0.05));
  for (let i = 0; i < 3; i++) lagg('glas', new T.LatheGeometry([[0.03, 0], [0.032, 0.003], [0.004, 0.006], [0.004, 0.09], [0.03, 0.11], [0.04, 0.16], [0.036, 0.2]].map(q => new T.Vector2(q[0], q[1])), 24), mx(L + 0.05 + i * 0.08, yh, zc - 0.07));
  for (let i = 0; i < 2; i++) ton(['#ece6dc', '#c8b9a2'][i], () => {
    runt('keramik', 0.038, 0.04, 0.095, L + B * 0.62 + i * 0.1, yh, zc + 0.04, null);
    lagg('keramik', new T.TorusGeometry(0.026, 0.006, 8, 16, PI), mx(L + B * 0.62 + i * 0.1 + 0.04, yh + 0.05, zc + 0.04, 0, 0, -PI / 2));
  });
  [['#d8c79a', 0.12], ['#b98e63', 0.16]].forEach(([fg, h], i) => {
    runt('keramik', 0.045, 0.045, h, L + B * 0.86, yh, zc - 0.06 + i * 0.1, fg);
    runt('ek', 0.047, 0.047, 0.02, L + B * 0.86, yh + h, zc - 0.06 + i * 0.1, null);
  });
}
// bänkskåp: kastrull, stekpanna, durkslag; under diskhon vattenlås och rengöringsflaskor
function bankInnehall(w, x, i, ho, yb, yh, zc) {
  if (ho) {
    // vattenlås under brunnen och avlopp in mot väggen, sopkärl
    lagg('spegel', new T.CylinderGeometry(0.02, 0.02, 0.19, 16), mx(x + 0.06, 0.627, 0.05));
    lagg('spegel', new T.TorusGeometry(0.045, 0.02, 8, 16, PI), mx(x + 0.06, 0.53, 0.005, PI / 2, 0, PI));
    lagg('spegel', new T.CylinderGeometry(0.02, 0.02, 0.06, 16), mx(x + 0.06, 0.56, -0.04));
    lagg('spegel', new T.CylinderGeometry(0.02, 0.02, 0.25, 16).rotateX(PI / 2), mx(x + 0.06, 0.59, -0.165));
    // utdragbar källsortering: tre kärl med rundade hörn och lockkant på en bricka
    ton('#cfcfcb', () => rbx('vit', 0.4, 0.015, 0.34, x + 0.05, 0.126, 0.07, 0.004, 0, 0, 1));
    [['#e9e8e4', -0.085], ['#9a9c9a', 0.05], ['#e9e8e4', 0.185]].forEach(([fg, ox]) => ton(fg, () => {
      rbx('vit', 0.12, 0.3, 0.3, x + ox, 0.284, 0.07, 0.018, 0, 0, 2);
      rbx('vit', 0.126, 0.012, 0.306, x + ox, 0.44, 0.07, 0.005, 0, 0, 1);
    }));
    ton('#777', () => box('vit', 0.42, 0.01, 0.02, x + 0.05, 0.12, 0.25));
    // tilloppsrör från en vinkelventil på väggen upp till blandaren under skivan
    lagg('spegel', new T.CylinderGeometry(0.008, 0.008, 0.36, 16), mx(x, 0.688, -0.22));
    lagg('spegel', new T.CylinderGeometry(0.012, 0.012, 0.064, 16).rotateX(PI / 2), mx(x, 0.52, -0.255));
    // diskmedel, sprayflaska och tvättmedelsdunk i dämpade färger med etikettband, på en droppmatta
    ton('#b9bcb8', () => rbx('tyg', 0.2, 0.006, 0.3, x - 0.175, yb + 0.003, zc + 0.03, 0.002, 0, 0, 1));
    [['#eeeeea', 0.22, 0.032], ['#d7dad6', 0.24, 0.03], ['#a9bfa6', 0.2, 0.034]].forEach(([fg, h, r], k) => ton(fg, () => {
      svarv('keramik', [[0, 0], [r, 0], [r + 0.002, 0.006], [r + 0.002, h * 0.72], [r * 0.6, h * 0.86], [0.012, h * 0.92], [0.012, h], [0, h]], x - 0.24 + (k % 2) * 0.09, yb + 0.006, zc + 0.12 - Math.floor(k / 2) * 0.12, 24);
      ton('#8d8f8b', () => cyl('keramik', r + 0.0025, r + 0.0025, h * 0.22, x - 0.24 + (k % 2) * 0.09, yb + 0.006 + h * 0.35, zc + 0.12 - Math.floor(k / 2) * 0.12, 24));
    }));
    ton('#3b3d3c', () => { cyl('keramik', 0.012, 0.012, 0.04, x - 0.15, yb + 0.25, zc + 0.12, 16); lagg('keramik', new T.CylinderGeometry(0.004, 0.006, 0.03, 12).rotateX(PI / 2), mx(x - 0.15, yb + 0.262, zc + 0.145)); });
    ton('#7f9a8a', () => rbx('tyg', 0.16, 0.012, 0.12, x - 0.2, yb + 0.012, zc - 0.12, 0.004, 0.3, 0, 1));
    return;
  }
  if (i % 2 === 0) {
    // kastrull i stål med glaslock, stekpannor i grafit med trähandtag (inga svarta ytor)
    runt('spegel', 0.1, 0.1, 0.13, x - w * 0.18, yb, zc, '#d0d0cc');
    lagg('glas', new T.CylinderGeometry(0.098, 0.102, 0.012, 24), mx(x - w * 0.18, yb + 0.136, zc));
    ton('#4a4c50', () => cyl('vit', 0.012, 0.012, 0.012, x - w * 0.18, yb + 0.148, zc, 12));
    ton('#c9c9c6', () => { for (const s of [-1, 1]) box('spegel', 0.04, 0.012, 0.02, x - w * 0.18 + s * 0.12, yb + 0.11, zc); });
    svarv('spegel', [[0, 0], [0.04, 0], [0.09, 0.07], [0.1, 0.1], [0.096, 0.1], [0.085, 0.072], [0.036, 0.004], [0, 0.004]], x + w * 0.2, yb, zc, 24);
    for (let k = 0; k < 2; k++) { runt('vit', 0.12 - k * 0.015, 0.125 - k * 0.015, 0.04, x, yh + k * 0.04, zc - 0.02, '#4a4c50'); ton('#8a6a4a', () => box('ek', 0.16, 0.012, 0.03, x + 0.2 - k * 0.015, yh + 0.03 + k * 0.04, zc - 0.02)); }
  } else {
    for (let k = 0; k < 3; k++) runt('spegel', 0.13 - k * 0.02, 0.135 - k * 0.02, 0.05, x - w * 0.1, yb + k * 0.05, zc, '#cfcfcb');
    ton('#f2efe9', () => rbx('keramik', 0.3, 0.06, 0.2, x + w * 0.05 - 0.03, yh + 0.03, zc, 0.01, 0, 0, 1));
    ton('#e3dccf', () => rbx('keramik', 0.22, 0.08, 0.16, x - w * 0.12, yh + 0.1, zc + 0.02, 0.01, 0, 0, 1));
  }
}
// innehåll i en köksla: bestickinsats eller kökshanddukar (lådans egen mesh, vit med färger)
function ladaInnehall(w, k) {
  if (k % 2 === 0) {
    ton('#e2d6c2', () => {
      box('vit', w - 0.1, 0.006, 0.36, 0, -0.052, -0.235);
      for (let i = 0; i <= 4; i++) box('vit', 0.006, 0.04, 0.36, -(w - 0.1) / 2 + i * (w - 0.1) / 4, -0.032, -0.235);
    });
    const fack = (w - 0.1) / 4;
    for (let f = 0; f < 4; f++) for (let j = 0; j < 4; j++) ton(['#c9ccce', '#bfc2c4', '#d4d6d7'][(f + j) % 3], () => {
      const fx = -(w - 0.1) / 2 + fack * (f + 0.5) + (j - 1.5) * Math.min(0.022, fack * 0.22), y0 = -0.0473, sk = f === 3 ? 0.72 : 1;
      box('vit', 0.011 * sk, 0.0035, 0.12 * sk, fx, y0, -0.27 + 0.06 * (1 - sk));                    // skaft
      if (f === 0) { box('vit', 0.022, 0.003, 0.025, fx, y0, -0.195); for (let t = 0; t < 4; t++) box('vit', 0.0035, 0.0025, 0.035, fx - 0.0085 + t * 0.0057, y0, -0.165); }
      if (f === 1) { box('vit', 0.016, 0.002, 0.1, fx + 0.002, y0, -0.16); lagg('vit', new T.CylinderGeometry(0.008, 0.008, 0.002, 10, 1, false, 0, PI), mx(fx + 0.002, y0, -0.11, PI / 2, 0, 0)); }
      if (f >= 2) lagg('vit', new T.SphereGeometry(0.019 * sk, 6, 3, 0, 2 * PI, PI / 2, PI / 2).scale(0.8, 0.35, 1.35), mx(fx, y0 + 0.006, -0.21 + 0.04 * (1 - sk), 0, PI, 0));
    });
  } else ['#d9cbb2', '#f1ece3', '#8c9a8a', '#c7a27c'].forEach((fg, j) => vikt(0.2, 0.16, 0.026, -w * 0.2 + (j % 2) * 0.24, -0.0525 + Math.floor(j / 2) * 0.026, -0.2, (j % 2 ? -0.05 : 0.04), fg, 'linne', 'vit'));   // vikta kökshanddukar (lådans egen mesh)
}
// garderobens inredning: klädstång med galgar och kläder, hylla, skor, lådor och korg
const KLADTON = ['#7d8a94', '#d9cdb7', '#9a7a62', '#6a7a6c', '#b6a48a', '#b97a64', '#e7e1d6', '#7a828e', '#8f9b84', '#c9b6a0'];
let SKO_ENKEL = false;
function garderobInne(w, d, h, typ) { SKO_ENKEL = true; try { garderobInne0(w, d, h, typ); } finally { SKO_ENKEL = false; } }
function garderobInne0(w, d, h, typ) {
  const xi = w / 2 - 0.02, z0 = -d / 2 - 0.002, z1 = d / 2 - 0.035, zc = (z0 + z1) / 2, dz = z1 - z0, hw = 2 * xi + 0.004;
  if (typ === 'bad') {
    [0.45, 0.85, 1.25, 1.65].forEach((y, j) => {
      ton(BJORK, () => box('vit', hw, 0.018, dz, 0, y, zc));
      if (j < 3) for (let k = 0; k < 3; k++) vikt(Math.min(0.34, xi - 0.02), 0.26, 0.05, -xi / 2 + (k % 2) * xi, y + 0.009 + Math.floor(k / 2) * 0.05, zc, 0, ['#f1ece3', '#d9cbb2', '#8c9a8a'][(k + j) % 3]);
      else for (let k = 0; k < 4; k++) ton('#fbfaf7', () => cyl('tyg', 0.055, 0.055, 0.1, -xi + 0.08 + k * 0.12, y + 0.06, zc, 24));
    });
    ton('#c4a477', () => svarv('tyg', [[0, 0], [0.15, 0], [0.16, 0.3], [0.15, 0.3], [0.14, 0.01], [0, 0.01]], 0, 0.07, zc, 32));
    return;
  }
  const hylla = h - 0.3, sy = hylla - 0.07;
  ton(BJORK, () => { box('vit', hw, 0.018, dz, 0, hylla, zc); ton('#f6f2ea', () => box('vit', hw, 0.02, 0.003, 0, hylla, z1)); });
  lagg('spegel', new T.CylinderGeometry(0.012, 0.012, hw, 12).rotateZ(PI / 2), mx(0, sy, zc));
  for (const s of [-1, 1]) cyl('spegel', 0.018, 0.018, 0.012, s * (xi - 0.004), sy, zc, 16, false, 0, PI / 2);
  const steg = typ === 'hall' ? 0.13 : 0.104, n = Math.floor((2 * xi - 0.06) / steg);
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const x = -xi + 0.04 + i * steg + (r() - 0.5) * 0.015, L = typ === 'hall' ? 0.85 + r() * 0.2 : (r() < 0.25 ? 1.05 : 0.62 + r() * 0.25), bw = Math.min(dz - 0.12, 0.4) * (0.8 + 0.2 * ((i * 0.618) % 1)), ry = (r() - 0.5) * (i % 3 === 2 ? 0.5 : 0.2);   // olika breda, någon hänger snett
    const fg = typ === 'hall' ? ['#5d6a60', '#d3c8b3', '#8a6a52', '#7b7f86', '#b6a48a', '#e2dccf', '#6f7782'][i % 7] : KLADTON[Math.floor(r() * KLADTON.length)];
    r();
    // blandat: i hallen korta jackor och en och annan lång rock, i garderoben skjortor,
    // koftor, byxor över galge och klänningar
    if (typ === 'hall') plagg(x, sy, zc, bw, i % 3 === 1 ? L + 0.05 : L - 0.22, 'jacka', fg, ry);
    else plagg(x, sy, zc, bw, L > 1 ? L : i % 4 === 1 ? 0.6 + (L - 0.62) * 0.4 : L, L > 1 ? 'klanning' : ['skjorta', 'byxa', 'kofta', 'skjorta'][i % 4], fg, ry);
  }
  if (typ === 'hall') {
    // skohylla med skor, hattar och en väska på hyllan
    ton('#c69c6d', () => [0.12, 0.3].forEach(y => { for (let k = 0; k < 2; k++) box('ek', hw, 0.015, 0.03, 0, y, zc - 0.1 + k * 0.2); }));
    for (let k = 0; k < Math.floor(2 * xi / 0.24); k++) for (const y of [0.13, 0.31]) {
      const j = (k + (y > 0.2 ? 1 : 0)) % 4;
      par(-xi + 0.13 + k * 0.24, y + 0.0075, zc, 0, j === 0 ? 'kanga' : j === 2 ? 'toffel' : 'sneaker', ['#6b4a33', '#5a5653', '#b9ad9a', '#e9e5dd'][j]);
    }
    for (let k = 0; k < 2; k++) ton(['#4b5560', '#b9895c'][k], () => svarv('tyg', [[0, 0], [0.15, 0], [0.15, 0.01], [0.09, 0.02], [0.085, 0.1], [0, 0.11]], -xi + 0.2 + k * 0.3, hylla + 0.009, zc, 32));
    ton('#7a5a3c', () => { rbx('tyg', 0.3, 0.18, 0.12, xi - 0.22, hylla + 0.1, zc, 0.03, 0, 0, 1); lagg('tyg', new T.TorusGeometry(0.07, 0.008, 4, 12, PI), mx(xi - 0.22, hylla + 0.19, zc)); });
    return;
  }
  // kläder: vikta tröjor på hyllan, skor och en låda på golvet, tvättkorg
  for (let k = 0; k < Math.max(1, Math.floor(2 * xi / 0.34)); k++) for (let j = 0; j < 3; j++) vikt(0.3, 0.26, 0.055, -xi + 0.17 + k * 0.34, hylla + 0.009 + j * 0.055, zc, (r() - 0.5) * 0.1, KLADTON[(k * 3 + j) % KLADTON.length], 'stick');
  // skor på garderobsgolvet, en skokartong med lock och en mjuk tvättkorg
  const nk = Math.floor(2 * xi / 0.26), y0 = 0.082;
  for (let k = 0; k < nk; k++) {
    const kx = -xi + 0.13 + k * 0.26;
    if (xi > 0.4 && kx > xi - 0.5) continue;    // platsen för kartongen
    if (kx < -xi + 0.42) continue;               // platsen för tvättkorgen
    par(kx, y0, zc + 0.06, 0, ['sneaker', 'kanga', 'toffel'][k % 3], ['#e9e5dd', '#6b4a33', '#a9a08f'][k % 3]);
  }
  if (xi > 0.4) {
    ton('#c8ad8a', () => rbx('tyg', 0.34, 0.12, 0.24, xi - 0.22, y0 + 0.06, zc - 0.02, 0.006, 0.08, 0, 2));
    ton('#efe9df', () => rbx('tyg', 0.35, 0.03, 0.25, xi - 0.22, y0 + 0.125, zc - 0.02, 0.006, 0.08, 0, 2));
  }
  ton('#cdb595', () => svarv('tyg', [[0, 0], [0.12, 0], [0.13, 0.01], [0.138, 0.1], [0.14, 0.28], [0.145, 0.3], [0.14, 0.31], [0.134, 0.3], [0.13, 0.28], [0.128, 0.1], [0.118, 0.012], [0, 0.01]], -xi + 0.16, y0, zc - 0.05, 32));
}

// Plagg som en sluten tygvolym (ny byggare). Lokalt: bredden längs z, djupet längs x, framsidan
// +x, toppen (halsen) i y = 0 under stången sy. Kroppen är ringar ned längs plagget: runda
// axlar som följer galgen, lätt A-form, tjockast mitt fram och bak och tunn mot sidosömmarna,
// mjuka lodräta veck (samma våg fram och bak, som ett tyg som faller) och en böljande fåll.
// Ärmar är egna, plattade rör som börjar i axeln och hänger utanför kroppen med en lätt böj
// vid armbågen; krage och slag har volym och viker ut; knappar är små skivor på tyget.
// o.fin: fler segment (hallens rock på nära håll); o.ogla: ingen galge, en tygögla vid kragen
// (rocken på krokraden). Typer: skjorta, kofta, jacka, rock, klanning, byxa (dubbelvikt över
// galgens pinne).
function plagg(x, sy, zc, bw, L, typ, fg, ry = 0, o = {}) {
  const rock = typ === 'rock', byxa = typ === 'byxa', kl = typ === 'klanning', jacka = typ === 'jacka', kofta = typ === 'kofta', tjock = jacka || rock || kofta;
  const fas = x * 37.1 + zc * 11.3 + sy * 5.7, h1 = ((Math.sin(fas) * 43758.5453) % 1 + 1) % 1;
  const sm = (a, b, q) => { const t = Math.min(1, Math.max(0, (q - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hw = byxa ? Math.min(0.12, bw * 0.32) : bw / 2;
  const D = rock ? 0.03 : jacka ? 0.032 : kofta ? 0.021 : byxa ? 0.017 : kl ? 0.013 : 0.014;
  const AF = rock ? 0.16 : kl ? 0.45 : jacka ? 0.03 : byxa ? -0.1 : kofta ? 0.06 : 0.02;
  const VK = (kl ? 1.6 : byxa ? 0.55 : jacka ? 0.6 : rock ? 0.85 : 1) * (0.75 + 0.5 * h1);
  const SL = byxa ? 0 : 0.055, tS = byxa ? 0.05 : Math.min(0.2, 0.11 / L * 0.9);
  const fin = !!o.fin, NA = fin ? 26 : 15;
  const T0 = fin ? [0, 0.015, 0.03, 0.05, 0.07, 0.09, 0.11, 0.14, 0.18, 0.24, 0.31, 0.39, 0.47, 0.55, 0.63, 0.71, 0.79, 0.86, 0.92, 0.97, 1]
    : [0, 0.03, 0.06, 0.09, 0.13, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 0.96, 1];
  const yT = t => byxa ? -L * t : t < tS ? -SL * (1 - Math.cos(t / tS * PI / 2)) : -SL - (L - SL) * (t - tS) / (1 - tS);
  const wT = t => byxa ? hw * (1 + AF * t) : hw * (0.22 + 0.78 * Math.pow(Math.sin(Math.min(1, t / tS) * PI / 2), 0.8)) * (1 + AF * Math.pow(Math.max(0, (t - tS) / (1 - tS)), 1.3));
  const dT = t => D * (byxa ? Math.sqrt(Math.min(1, t / 0.04 + 0.05)) : 0.35 + 0.65 * sm(0, 0.09, t)) * (1 - (kl ? 0.25 : 0.08) * t);
  // (djupare, bredare veck: på nära håll såg framstycket platt ut; veck från axeln ned i en diagonal)
  const veck = (zn, t) => VK * ((0.005 + 0.017 * sm(0.08, 0.8, t)) * Math.sin(zn * PI * 2.3 + fas + t * 1.7) + 0.005 * sm(0, 0.3, t) * Math.sin(zn * PI * 5.1 + fas * 1.3 + t * 3) * (1 - 0.5 * t));
  const kant = zn => 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - zn * zn));
  // framsidans läge (x) vid (z, t): för knappar, slå och knappslå som ska ligga an mot tyget
  const framX = (zz, t) => { const zn = Math.max(-1, Math.min(1, zz / wT(t))), c = Math.pow(Math.abs(zn), 1 / 0.55); return dT(t) * Math.sqrt(Math.max(0, 1 - c * c)) * kant(zn) + veck(zn, t); };
  const pos = [], ix = [], N = T0.length;
  T0.forEach((t, j) => {
    const w = wT(t), d = dT(t) * (j === N - 1 ? 0.85 : 1), y = yT(t);
    for (let a = 0; a < NA; a++) {
      const v = a / NA * 2 * PI, c = Math.cos(v), s = Math.sin(v), zn = Math.sign(c) * Math.pow(Math.abs(c), 0.55);
      pos.push(d * s * kant(zn) + veck(zn, t), y + (j === N - 1 ? 0.012 * VK * Math.sin(zn * 4.3 + fas) : 0), zn * w * (1 + 0.025 * t * Math.sin(t * 9 + fas + Math.sign(c) * 2)));
    }
    if (j) for (let a = 0; a < NA; a++) { const p0 = (j - 1) * NA + a, p1 = (j - 1) * NA + (a + 1) % NA, q0 = j * NA + a, q1 = j * NA + (a + 1) % NA; ix.push(p0, q0, p1, p1, q0, q1); }
  });
  { const ct = pos.length / 3; pos.push(0, 0.004, 0); for (let a = 0; a < NA; a++) ix.push(ct, a, (a + 1) % NA);
    const cb = ct + 1, e = (N - 1) * NA; pos.push(veck(0, 1), yT(1) + 0.004, 0); for (let a = 0; a < NA; a++) ix.push(cb, e + (a + 1) % NA, e + a); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  const m = mx(x, sy - 0.045, zc, ry);
  const vv = kofta ? 'stick' : 'linne';
  ton(fg, () => vav(vv, () => lagg('tyg', g, m)));
  // upphängning: krok och hals i stål ovanför kragen (pinnen ligger dold i axlarna), eller en
  // tygögla vid kragen när plagget hänger direkt på en knagg
  if (o.ogla) {
    ton(skiftTon(fg, 0.85), () => { lagg('tyg', new T.TorusGeometry(0.021, 0.0032, 5, 14).rotateY(PI / 2), m.clone().multiply(new T.Matrix4().makeTranslation(0, 0.03, 0)));
      lagg('tyg', new T.CylinderGeometry(0.003, 0.004, 0.014, 6), m.clone().multiply(new T.Matrix4().makeTranslation(0, 0.004, 0))); });
  } else {
    ton('#c9c6c0', () => { lagg('spegel', new T.TorusGeometry(0.017, 0.0025, 3, 8, PI * 1.3).rotateZ(-PI * 0.15), mx(x, sy + 0.005, zc, ry + PI / 2));
      lagg('spegel', new T.CylinderGeometry(0.0022, 0.0022, 0.035, 5), m.clone().multiply(new T.Matrix4().makeTranslation(0, 0.022, 0))); });
    // byxorna hänger över galgens pinne: pinnens ändar syns på var sida
    if (byxa) ton('#c09a6c', () => lagg('ek', new T.CapsuleGeometry(0.006, 2 * hw + 0.08, 3, 6).rotateX(PI / 2), m.clone().multiply(new T.Matrix4().makeTranslation(0, -0.002, 0))));
  }
  if (byxa || kl) {
    // byxans pressveck resp. klänningens ringning
    if (byxa) ton(skiftTon(fg, 0.86), () => { const sp = [], si = []; T0.forEach((t, j) => { if (t < 0.06) return; const xx = framX(0, t) + 0.0012; sp.push(xx, yT(t), -0.0025, xx, yT(t), 0.0025); const q = sp.length / 3 - 2; if (q) si.push(q - 2, q - 1, q, q - 1, q + 1, q); });
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals(); lagg('tyg', sg, m.clone()); });
    else ton(skiftTon(fg, 0.85), () => lagg('tyg', new T.TorusGeometry(0.04, 0.005, 4, 12, PI).rotateX(PI / 2).rotateY(-PI / 2).scale(0.5, 1, 1), m.clone().multiply(new T.Matrix4().makeTranslation(dT(0.03) * 0.5, -0.008, 0))));
    return;
  }
  // ärmarna: plattade rör längs en mjuk kurva från axeln, utanför kroppen, smalare mot ärmslutet
  {
    const rS = rock || jacka ? 0.04 : kofta ? 0.034 : 0.029, dS = Math.min(rS * 0.8, D * 1.1 + 0.006), Ls = Math.min(rock ? 0.7 : tjock ? 0.62 : 0.58, L * 0.82);
    const RA = fin ? 10 : 7, SEG = fin ? 14 : 7, ap = [], ai = [];
    [-1, 1].forEach((s, e) => {
      const ws = wT(tS), tEnd = Math.min(0.98, tS + (Ls - 0.02) / (L - SL) * (1 - tS)), wE = wT(tEnd);
      const k = new T.CatmullRomCurve3([V(0, -SL * 0.45, s * ws * 0.8), V(0.002, -SL - 0.03, s * (ws + rS * 0.55)), V(0.012, -SL - Ls * 0.5, s * (wT((tS + tEnd) / 2) + rS * 0.7)), V(0.008, -SL - Ls, s * (wE + rS * 0.7))], false, 'centripetal');
      for (let i = 0; i <= SEG; i++) { const u = i / SEG, p = k.getPointAt(u), f = Math.sin(Math.min(1, u * 5 + 0.25) * PI / 2) * (1 - 0.22 * u), cuff = u > 0.93 ? 1.06 : 1;
        for (let a = 0; a < RA; a++) { const v = a / RA * 2 * PI; ap.push(p.x + Math.sin(v) * dS * f * cuff + veck(s, 0.3 + u * 0.5) * 0.5, p.y, p.z + Math.cos(v) * rS * f * cuff); }
        if (i) for (let a = 0; a < RA; a++) { const o = e * ((SEG + 1) * RA + 1), p0 = o + (i - 1) * RA + a, p1 = o + (i - 1) * RA + (a + 1) % RA, q0 = o + i * RA + a, q1 = o + i * RA + (a + 1) % RA; ai.push(p0, q0, p1, p1, q0, q1); } }
      // ärmslutet: en mörk öppning (fläkt) i ärmens ände
      const o = e * ((SEG + 1) * RA + 1), pe = k.getPointAt(1); ap.push(pe.x, pe.y + 0.004, pe.z); const c = o + (SEG + 1) * RA;
      for (let a = 0; a < RA; a++) ai.push(c, o + SEG * RA + (a + 1) % RA, o + SEG * RA + a);
    });
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(ap, 3)); ag.setIndex(ai); ag.computeVertexNormals();
    ton(fg, () => vav(vv, () => lagg('tyg', ag, m.clone())));
  }
  // krage med volym runt halsen (jacka och rock: tjockare och stående)
  ton(skiftTon(fg, tjock ? 0.9 : 1.06), () => vav(vv, () => lagg('tyg', new T.TorusGeometry(wT(0) + 0.01, tjock ? 0.013 : 0.0075, 5, 12).rotateX(PI / 2).scale((dT(0) + 0.012) / (wT(0) + 0.01), tjock ? 1.5 : 1, 1), m.clone().multiply(new T.Matrix4().makeTranslation(0, -0.006, 0)))));
  // slag (rock): vikta flikar i V som lyfter ut från kroppen, med en kant som ger tjocklek
  if (rock) { const lp = [], li = [], NS = fin ? 6 : 4;
    [-1, 1].forEach((s, e) => { for (let j = 0; j <= NS; j++) { const u = j / NS, t = 0.02 + 0.32 * u, zi = s * (wT(0) * 0.85 * (1 - u) + 0.006), zo = s * (wT(0) * 0.85 + 0.055 * Math.sin(Math.min(1, u * 1.6) * PI / 2) * (1 - u * 0.85)) * (1 - u * 0.75);
      lp.push(framX(zi, t) + 0.003, yT(t), zi, framX(zo, t) + 0.013 * (1 - u * 0.6), yT(t) - 0.008, zo, framX(zo, t) + 0.001, yT(t) - 0.008, zo);
      if (j) { const q = e * (NS + 1) * 3 + j * 3, p = q - 3; if (s > 0) li.push(p, p + 1, q, p + 1, q + 1, q, p + 1, p + 2, q + 1, p + 2, q + 2, q + 1); else li.push(p, q, p + 1, p + 1, q, q + 1, p + 1, q + 1, p + 2, p + 2, q + 1, q + 2); } } });
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeVertexNormals();
    ton(skiftTon(fg, 0.95), () => vav(vv, () => lagg('tyg', lg, m.clone())));
    // slagens vikta ytterkant: en mörkare, rundad kant där tyget viker sig, som ger fliken
    // tjocklek och skiljer den från framstycket under
    ton(skiftTon(fg, 0.72), () => [-1, 1].forEach(s => { const kp = [];
      for (let j = 0; j <= NS; j++) { const u = j / NS, t = 0.02 + 0.32 * u, zo = s * (wT(0) * 0.85 + 0.055 * Math.sin(Math.min(1, u * 1.6) * PI / 2) * (1 - u * 0.85)) * (1 - u * 0.75);
        kp.push(V(framX(zo, t) + 0.008 * (1 - u * 0.6), yT(t) - 0.009, zo)); }
      iRam(m, () => tub('tyg', kp, 0.0035, 0.0025, fin ? 16 : 8, 5)); })); }   // (i plaggets ram: förr dubbeltransformerad, hamnade fel)
  // knappslå (skjorta, kofta), dragkedja (jacka) och knappar som små rundade skivor
  { const br = jacka ? 0.0035 : 0.007, sp = [], si = [], t0 = rock ? 0.34 : 0.05;
    T0.filter(t => t >= t0).forEach((t, j) => { const xx = framX(0, t) + 0.0012; sp.push(xx, yT(t), -br, xx, yT(t), br); if (j) { const q = j * 2; si.push(q - 2, q - 1, q, q - 1, q + 1, q); } });
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    ton(jacka ? '#6f6c66' : skiftTon(fg, 0.94), () => vav('linne', () => lagg('tyg', sg, m.clone())));
    if (!jacka) ton(skiftTon(fg, 0.55), () => { const kn = rock ? [0.4, 0.55, 0.7] : kofta ? [0.15, 0.32, 0.49, 0.66] : [0.12, 0.3, 0.48, 0.66], r = rock ? 0.009 : 0.005;
      kn.forEach(t => lagg('tyg', new T.SphereGeometry(r, 8, 3).scale(0.35, 1, 1), m.clone().multiply(new T.Matrix4().makeTranslation(framX(0, t) + 0.002, yT(t), 0)))); });
  }
}
// Vägghängd toalett framför ett kaklat installationsschakt (dold cistern) med ekhylla.
// Lokalt: väggen vid z = -0.33, schaktets framsida vid z = -0.13.
function toalett() {
  skugga(0, 0.08, 0.34, 0.5, 0, 0.12, 0.26);
  hind(0.64, 0.74, 0, 0.04);
  ton('#e8e3da', () => kakelLada(0.64, 1.1, 0.2, 0, 0.55, -0.23));
  rbx('ek', 0.66, 0.03, 0.22, 0, 1.115, -0.22, 0.008, 0, 0, 2);
  // spolplatta: vit, rektangulär, två kromknappar
  ton('#f6f5f2', () => rbx('vit', 0.25, 0.165, 0.012, 0, 0.98, -0.124, 0.005, 0, 0, 2));
  // två vita tryckknappar (liten och stor spolning) med en smal skuggfog runt
  for (const k of [-1, 1]) {
    ton('#c9c6c0', () => rbx('vit', 0.1, 0.13, 0.004, k * 0.055, 0.98, -0.1165, 0.004, 0, 0, 1));
    ton('#f7f6f3', () => glans(0.6, () => rbx('keramik', 0.094, 0.124, 0.007, k * 0.055, 0.98, -0.1145, 0.004, 0, 0, 2)));
  }
  // skålen: svarvad, utan facetter, ovalt utdragen framåt och smalare mot väggen
  const sk = new T.LatheGeometry([[0, 0.0], [0.06, 0.0], [0.115, 0.012], [0.15, 0.05], [0.172, 0.11], [0.18, 0.17], [0.178, 0.2], [0.168, 0.212], [0.15, 0.212], [0.13, 0.19], [0.09, 0.12], [0.0, 0.1]].map(q => new T.Vector2(q[0], q[1])), 40);
  const ps = sk.attributes.position;
  for (let i = 0; i < ps.count; i++) {
    let x = ps.getX(i), z = ps.getZ(i) * 1.42;
    if (z < 0) x *= 1 - 0.22 * (-z / 0.26);
    ps.setXYZ(i, x, ps.getY(i), z);
  }
  sk.computeVertexNormals();
  ton('#f6f5f1', () => lagg('keramik', sk, mx(0, 0.2, 0.14)));
  // fästet mot schaktet
  ton('#f4f2ee', () => rbx('keramik', 0.22, 0.2, 0.12, 0, 0.32, -0.08, 0.05, 0, 0, 3));
  // sits (oval ring) och lock med mjuka kanter
  const ring = new T.TorusGeometry(0.138, 0.017, 10, 48).rotateX(PI / 2);
  ring.scale(1.0, 0.42, 1.42);
  ton('#f9f8f5', () => lagg('keramik', ring, mx(0, 0.419, 0.15)));
  const lock = new T.SphereGeometry(0.4, 40, 6, 0, 2 * PI, 0, 0.42);
  lock.scale(1.0, 0.32, 1.42);
  ton('#fbfaf7', () => { lagg('keramik', lock, mx(0, 0.426 - 0.4 * Math.cos(0.42) * 0.32, 0.15)); lagg('keramik', new T.CircleGeometry(0.4 * Math.sin(0.42), 40).rotateX(PI / 2).scale(1, 1, 1.42), mx(0, 0.4262, 0.15)); });
  // skuggfogar: mellan skål och sits och mellan sits och lock (annars en enda vit klump)
  ton('#aeaba5', () => glans(2.5, () => {
    lagg('keramik', new T.TorusGeometry(0.166, 0.0028, 4, 32).rotateX(PI / 2).scale(1, 1, 1.42), mx(0, 0.4115, 0.14));
    lagg('keramik', new T.TorusGeometry(0.159, 0.0022, 4, 32).rotateX(PI / 2).scale(1, 1, 1.42), mx(0, 0.4262, 0.15));
  }));
  for (const k of [-1, 1]) cyl('spegel', 0.011, 0.011, 0.035, k * 0.07, 0.431, -0.045, 16, false, 0, PI / 2);
  // toalettpappershållare på schaktets front med en rulle
  box('svart', 0.012, 0.012, 0.06, 0.175, 0.6, -0.1);
  cyl('svart', 0.005, 0.005, 0.13, 0.24, 0.6, -0.072, 10, false, 0, PI / 2);
  // (rullen med ett löst ark som hänger ned framför och en perforering tvärs över)
  ton('#fbfaf7', () => { cyl('tyg', 0.052, 0.052, 0.1, 0.24, 0.6, -0.042, 24, false, 0, PI / 2); box('tyg', 0.099, 0.085, 0.0016, 0.24, 0.5575, 0.0105, 0, 0.03); });
  ton('#dedad2', () => box('tyg', 0.099, 0.0012, 0.0018, 0.24, 0.55, 0.0108, 0, 0.03));
  ton('#8a8178', () => cyl('tyg', 0.021, 0.021, 0.101, 0.24, 0.6, -0.042, 16, false, 0, PI / 2));
  // på hyllan: reservrulle och en liten växt
  ton('#fbfaf7', () => cyl('tyg', 0.055, 0.055, 0.1, -0.2, 1.18, -0.22, 32));
  ljus(0.0, 1.13, -0.22, 0.03, 0.07, '#ece4d6');
  smavaxt(0.2, -0.22, 1.13);
}

// Vägghängt kommodskåp i ek med skålhandfat, rund spegel, vägglampa, tvålpumpar och växt;
// handdukstork med handdukar vid sidan (o.sida = +1/-1) och matta framför. Väggen vid z = -0.23.
function handfat(o = {}) {
  skugga(0, 0, 0.6, 0.46, 0, 0.12, 0.3);
  hind(0.6, 0.46);
  rbx('ek', 0.6, 0.38, 0.42, 0, 0.66, -0.02, 0.01, 0, 0, 2);
  // greppfri låda i ek med en mörk grepplist; lådkorgen följer med ut
  oppningsbar('Kommodlåda', 'lada', 'z', 0.3, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(0, 0.66, 0.2)), () => {
    rbx('ek', 0.598, 0.376, 0.02, 0, 0, 0, 0.008, 0, 0, 2);
    ton('#5b4330', () => box('ek', 0.56, 0.006, 0.004, 0, -0.02, 0.011));
    ton('#d9c4a4', () => { box('ek', 0.54, 0.01, 0.36, 0, -0.15, -0.19); for (const sx of [-1, 1]) box('ek', 0.012, 0.2, 0.36, sx * 0.27, -0.06, -0.19); box('ek', 0.54, 0.2, 0.012, 0, -0.06, -0.37); });
    // vikta handdukar, toalettartiklar, en liten korg och toalettrullar
    ['#f1ece3', '#d9cbb2', '#8c9a8a'].forEach((fg, j) => ton(fg, () => rbx('ek', 0.22, 0.04, 0.17, -0.14, -0.125 + j * 0.041, -0.16, 0.015, 0, 0, 1)));
    [['#e9e4da', 0.13], ['#6f7a66', 0.11], ['#c7a27c', 0.09]].forEach(([fg, h], j) => ton(fg, () => svarv('ek', [[0, 0], [0.022, 0], [0.024, h * 0.85], [0.01, h], [0, h]], 0.06 + j * 0.05, -0.145, -0.1, 24)));
    // liten mjuk korg med tre upprullade gästhanddukar
    ton('#cdb595', () => svarv('tyg', [[0, 0], [0.058, 0], [0.066, 0.006], [0.072, 0.04], [0.073, 0.066], [0.076, 0.072], [0.072, 0.077], [0.068, 0.072], [0.067, 0.04], [0.06, 0.008], [0, 0.006]], 0.15, -0.145, -0.27, 32));
    vav('frotte', () => [['#f4f1ea', 0], ['#dfe3d8', 2.094], ['#ebe2d2', 4.189]].forEach(([fg, a]) =>
      rullat(fg, 0.027, 0.09, mx(0.15 + Math.cos(a) * 0.032, -0.093, -0.27 + Math.sin(a) * 0.032, a, 0.06 * Math.sin(a), 0.06 * Math.cos(a)))));
  });
  // fristående skålhandfat i blank vit keramik, jämnt svarvat
  ton('#f6f5f1', () => glans(0.5, () => svarv('keramik', [[0, 0], [0.09, 0], [0.13, 0.012], [0.158, 0.04], [0.17, 0.08], [0.173, 0.112], [0.17, 0.125], [0.163, 0.125], [0.158, 0.1], [0.145, 0.06], [0.11, 0.032], [0.05, 0.024], [0, 0.023]], 0, 0.85, 0.02, 44)));
  // bottenventil i krom med en mörk springa runt proppen
  cyl('spegel', 0.021, 0.021, 0.003, 0, 0.8745, 0.02, 20);
  ton('#5a5855', () => cyl('vit', 0.0135, 0.0135, 0.0034, 0, 0.8745, 0.02, 14));
  cyl('spegel', 0.012, 0.012, 0.0045, 0, 0.8752, 0.02, 14);
  // väggblandare i mattsvart: rosett, pip och spak
  // (rosett mot kaklet, vågrät pip 21 cm ut över skålens mitt 10 cm över kanten, perlator;
  // spaken på en egen rosett bredvid)
  cyl('svart', 0.03, 0.03, 0.01, 0, 1.075, -0.2105, 32, false, PI / 2);
  cyl('svart', 0.012, 0.012, 0.21, 0, 1.075, -0.115, 24, false, PI / 2);
  lagg('svart', new T.SphereGeometry(0.012, 16, 8, 0, 2 * PI, 0, PI / 2).rotateX(PI / 2).scale(1, 0.8, 1), mx(0, 1.075, -0.01));
  cyl('svart', 0.009, 0.009, 0.008, 0, 1.064, -0.018, 20);
  cyl('svart', 0.026, 0.026, 0.01, 0.1, 1.075, -0.2105, 32, false, PI / 2);
  cyl('svart', 0.012, 0.012, 0.03, 0.1, 1.075, -0.19, 20, false, PI / 2);
  // spak: en platt, rundad hävarm som pekar upp och lite ut från rosetten
  rbx('svart', 0.013, 0.075, 0.009, 0.1, 1.108, -0.176, 0.004, 0, 0.18, 1);
  // rund spegel med varmt sken runt kanten (självlysande skiva bakom ger en ljusring)
  // (spegel och hylla sitter 8 cm högre än förr: blandarspaken har nu ~9 cm luft under hyllan)
  spegelYta(0, 1.58, -0.204, 0.3);
  const sl = egenLampa('Spegelbelysning', [0, 1.58, -0.2], () => ton('#e2ded6', () => lagg('lampa', new T.RingGeometry(0.299, 0.311, 64, 1), mx(0, 1.58, -0.2075))), false, []);   // ingen gloria mitt på spegeln; ljusringen 1,2 cm (förr 2,6 cm: såg ut som ett tjockt vitt rör när den var släckt)
  sken(sl, 0, 1.58, -0.2115, 0.36, 0.36, 0.42, true, 0.24);   // mjukt sken på kaklet runt spegeln
  // smal ekhylla under spegeln: tvålpump, tandborstmugg, ljus och en liten växt
  rbx('ek', 0.52, 0.022, 0.11, 0, 1.24, -0.175, 0.005, 0, 0, 2);
  const yh = 1.251;
  ton('#e9e4da', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.026, 0], [0.028, 0.004], [0.028, 0.1], [0.022, 0.112], [0.012, 0.118], [0, 0.118]], -0.2, yh, -0.175, 20)));
  cyl('svart', 0.006, 0.006, 0.03, -0.2, yh + 0.132, -0.175, 8); box('svart', 0.008, 0.008, 0.03, -0.2, yh + 0.145, -0.163);
  ton('#c9d2c4', () => glans(0.4, () => svarv('keramik', [[0, 0], [0.03, 0], [0.033, 0.09], [0.03, 0.09], [0.028, 0.006], [0, 0.006]], -0.09, yh, -0.175, 20)));
  [[-0.01, '#f2f0ea', 0.15], [0.012, '#7f8873', -0.12]].forEach(([dx, fg, a]) => ton(fg, () => {
    lagg('tyg', new T.CylinderGeometry(0.0035, 0.004, 0.17, 6), mx(-0.09 + dx, yh + 0.09, -0.175, 0, 0, a));
    rbx('tyg', 0.009, 0.022, 0.006, -0.09 + dx - Math.sin(a) * 0.085, yh + 0.09 + Math.cos(a) * 0.085, -0.172, 0.002, 0, 0, 1, a);
  }));
  // keramikburk med lock och knopp (bomullsrondeller)
  ton('#e3d9c8', () => glans(1.4, () => {
    svarv('keramik', [[0, 0], [0.03, 0], [0.034, 0.006], [0.034, 0.06], [0.031, 0.066], [0, 0.066]], 0.06, yh, -0.175, 28);
    svarv('keramik', [[0, 0], [0.035, 0], [0.036, 0.006], [0.03, 0.012], [0.008, 0.014], [0.008, 0.024], [0.004, 0.028], [0, 0.028]], 0.06, yh + 0.066, -0.175, 28);
  }));
  smavaxt(0.19, -0.175, yh);
  // tvålkopp med en tvål
  ton('#d9d2c6', () => svarv('keramik', [[0, 0], [0.035, 0], [0.055, 0.012], [0.06, 0.02], [0.054, 0.02], [0.045, 0.012], [0, 0.008]], 0.235, 0.85, 0.1, 24));
  ton('#efe3cf', () => rbx('keramik', 0.068, 0.024, 0.044, 0.235, 0.872, 0.1, 0.01, 0.3, 0, 2));
  const fritt = s => {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    // (från 4 cm framför kaklet: väggen bakom, en mellanvägg med eget hinder, ska inte räknas)
    for (const [px, pz] of [[s - 0.22, -0.19], [s + 0.22, -0.19], [s - 0.22, -0.08], [s + 0.22, -0.08]]) { const q = V(px, 0, pz).applyMatrix4(BAS); a0 = Math.min(a0, q.x); a1 = Math.max(a1, q.x); b0 = Math.min(b0, q.z); b1 = Math.max(b1, q.z); }
    const ut = -0.03;   // minst 3 cm luft till skåp, tvättmaskin och WC
    return !HINDER.some(h => !(Math.abs((h.x0 + h.x1) / 2 - V(0, 0, 0).applyMatrix4(BAS).x) < 0.01 && Math.abs((h.z0 + h.z1) / 2 - V(0, 0, 0).applyMatrix4(BAS).z) < 0.05) && h.niva !== 'loft' && a1 - ut > h.x0 && a0 + ut < h.x1 && b1 - ut > h.z0 && b0 + ut < h.z1);
  };
  // stegen och kroken ska stå inne i badrummet (inte genom en vägg eller dörröppning)
  const langsX = Math.abs(V(1, 0, 0).transformDirection(BAS).x) > 0.5, mX = langsX ? 0.23 : 0.1, mZ = langsX ? 0.1 : 0.23;
  const iRummet = s => { const q = V(s, 0, 0).applyMatrix4(BAS); return !BADRUM.length || BADRUM.some(b => q.x > b.x0 + mX && q.x < b.x1 - mX && q.z > b.z0 + mZ && q.z < b.z1 - mZ); };
  const sxv = [(o.sida ?? 1) * 0.6, -(o.sida ?? 1) * 0.6].find(s => iRummet(s) && fritt(s));
  if (sxv == null) {
    ton('#e3ddd2', () => vav('frotte', () => kuddeRund('tyg', 0.62, 0.024, 0.42, 0, 0.024, 0.52, { nx: 8, nz: 6, som: true })));   // med kantband
    // ingen plats för handduksstegen: en handdukskrok i borstat stål bredvid kommoden med en
    // handduk som hänger mjukt samlad från kroken
    const sk = [(o.sida ?? 1) * 0.47, -(o.sida ?? 1) * 0.47].find(s => iRummet(s) && fritt(s));
    if (sk != null) {
      ton('#d4d1cb', () => {
        lagg('diskstal', new T.CylinderGeometry(0.016, 0.016, 0.008, 24).rotateX(PI / 2), mx(sk, 1.62, -0.226));
        lagg('diskstal', new T.CylinderGeometry(0.006, 0.006, 0.05, 14).rotateX(PI / 2), mx(sk, 1.62, -0.197));
        lagg('diskstal', new T.SphereGeometry(0.009, 14, 10), mx(sk, 1.622, -0.172));
      });
      vav('frotte', () => krokHandduk(sk, 1.618, -0.19, 0, 0.42, 0.52, '#f2eee7'));
    }
    return;
  }
  const sx = sxv;
  // handduksstege i borstat stål (neutral reflex): två sidostycken med rundade ändar, fem
  // jämnt fördelade pinnar som går in i sidorna, och två väggfästen per sida med rosetter
  const zs = -0.185, y0 = 0.62, y1 = 1.74, pin = [0.72, 0.96, 1.2, 1.44, 1.68];
  ton('#cfccc6', () => {
    for (const k of [-1, 1]) {
      const xs = sx + k * 0.22;
      lagg('diskstal', new T.CapsuleGeometry(0.011, y1 - y0, 4, 16), mx(xs, (y0 + y1) / 2, zs));
      for (const y of [y0 + 0.08, y1 - 0.08]) {
        lagg('diskstal', new T.CylinderGeometry(0.007, 0.007, zs + 0.23, 14).rotateX(PI / 2), mx(xs, y, (zs - 0.23) / 2));
        lagg('diskstal', new T.CylinderGeometry(0.017, 0.019, 0.007, 24).rotateX(PI / 2), mx(xs, y, -0.2265));
      }
    }
    pin.forEach(y => lagg('diskstal', new T.CylinderGeometry(0.0085, 0.0085, 0.44, 16).rotateZ(PI / 2), mx(sx, y, zs)));
  });
  vav('frotte', () => {
    // handdukarna vikta över pinnarna: korta fall fram och bak, så att de inte hänger
    // framför pinnen under
    ton('#f2eee7', () => overStang(0.38, 0.2, 0.17, sx, 1.68, zs, 0, { r: 0.0105, veck: 0.008, nx: 12 }));
    ton(PAL.sand, () => overStang(0.34, 0.19, 0.16, sx, 1.2, zs, 0, { r: 0.0105, veck: 0.008, nx: 12 }));
    ton('#dfe3d8', () => overStang(0.28, 0.17, 0.14, sx, 0.72, zs, 0, { r: 0.0105, veck: 0.007, nx: 10 }));
    // badrumsmatta i bomull med lite lugg
    ton('#e3ddd2', () => kuddeRund('tyg', 0.62, 0.024, 0.42, 0, 0.024, 0.52, { nx: 8, nz: 6, som: true }));   // med kantband
  });
}

function tvatt() {
  skugga(0, 0, 0.6, 0.6, 0, 0.1, 0.35);
  hind(0.6, 0.6);
  ton('#f4f3f0', () => rbx('vit', 0.6, 0.85, 0.6, 0, 0.425, 0, 0.025, 0, 0, 2));
  // lucka: vit ring, kromring, välvt glas framför en mörk trumma
  const ly = 0.44;
  // trummans öppning: mörk insida och en grå gummipackning (fronten är hel, så ingen trumma bakom)
  ton('#2b2d2f', () => lagg('svart', new T.CircleGeometry(0.15, 40), mx(0, ly, 0.3015)));
  ton('#6d7276', () => lagg('vit', new T.CircleGeometry(0.105, 40), mx(0, ly - 0.004, 0.3025)));
  ton('#8a9095', () => lagg('vit', new T.TorusGeometry(0.15, 0.012, 10, 40).scale(1, 1, 0.5), mx(0, ly, 0.301)));
  // luckan (ring, kromring, välvt rökfärgat glas och handtag) i en mesh, gångjärn till vänster
  oppningsbar('Tvättmaskinens lucka', 'lucka', 'y', -1.6, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(-0.208, 0, 0.31)), () => {
    ton('#f6f5f2', () => lagg('vit', new T.TorusGeometry(0.178, 0.03, 10, 36), mx(0.208, ly, 0)));
    ton('#b9bcbe', () => lagg('vit', new T.TorusGeometry(0.148, 0.01, 8, 36), mx(0.208, ly, 0.02)));
    ton('#4b5055', () => lagg('vit', new T.SphereGeometry(0.42, 24, 6, 0, 2 * PI, 0, 0.36).rotateX(PI / 2).translate(0, 0, -0.07), mx(0.208, ly, -0.31)));
    ton('#2a2928', () => rbx('vit', 0.03, 0.07, 0.02, 0.408, ly, 0.02, 0.008, 0, 0, 1));
  });
  // panel: tvättmedelslåda till vänster, display, knappar och vred
  ton('#eceae6', () => rbx('vit', 0.19, 0.075, 0.03, -0.18, 0.78, 0.3, 0.01, 0, 0, 2));
  box('svart', 0.12, 0.008, 0.006, -0.18, 0.748, 0.316);
  ton('#2b2d2f', () => rbx('svart', 0.16, 0.06, 0.012, 0.02, 0.78, 0.302, 0.006, 0, 0, 1));
  ton('#5e7d8a', () => box('keramik', 0.06, 0.022, 0.003, 0.0, 0.785, 0.309));
  cyl('spegel', 0.034, 0.036, 0.03, 0.19, 0.78, 0.31, 20, false, PI / 2);
  cyl('svart', 0.026, 0.026, 0.006, 0.19, 0.78, 0.327, 16, false, PI / 2);
  // bänkskiva i ek ovanpå maskinen, vikta handdukar och en flätad tvättkorg med lock
  rbx('ek', 0.64, 0.03, 0.62, 0, 0.865, 0, 0.006, 0, 0, 2);
  const yb = 0.88;
  vikt(0.34, 0.27, 0.06, -0.11, yb, -0.05, 0.1, '#d9cbb2');
  vikt(0.32, 0.25, 0.05, -0.1, yb + 0.06, -0.05, 0.04, '#f1ece3');
  vikt(0.28, 0.21, 0.045, -0.11, yb + 0.11, -0.04, -0.05, '#8c9a8a');
  // flätad korg med mjukt välvt lock och knopp, fina flätband som följer korgens sida
  ton('#c4a477', () => {
    svarv('tyg', [[0, 0], [0.092, 0], [0.103, 0.006], [0.107, 0.02], [0.115, 0.19], [0.117, 0.2], [0.111, 0.2], [0.1, 0.02], [0, 0.02]], 0.19, yb, 0.02, 40);
    svarv('tyg', [[0, 0.236], [0.04, 0.234], [0.085, 0.226], [0.112, 0.214], [0.124, 0.205], [0.123, 0.198], [0.112, 0.199], [0, 0.2]], 0.19, yb, 0.02, 40);
    lagg('tyg', new T.SphereGeometry(0.014, 16, 10), mx(0.19, yb + 0.24, 0.02));
  });
  ton('#a5865d', () => [0.04, 0.075, 0.11, 0.145, 0.18].forEach(h => lagg('tyg', new T.TorusGeometry(0.1065 + (h - 0.02) * 0.0503, 0.0022, 6, 48).rotateX(PI / 2), mx(0.19, yb + h, 0.02))));
}

// Duschplats: ramlöst 8 mm glas med polerade, svagt gröna kanter och en smal svart profil
// mot väggen, golv med fall mot en linjär brunn, kaklad nisch med infälld hylla,
// takdusch och handdusch på stigarrör med termostatblandare.
function dusch(x0, z0, x1, z1, glas, vaggSida) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const p = { N: [cx, z0], S: [cx, z1], W: [x0, cz], E: [x1, cz] }[vaggSida];
  const inn = V(cx - p[0], 0, cz - p[1]).normalize(), ry = Math.atan2(inn.x, inn.z);
  const nsAxel = vaggSida === 'N' || vaggSida === 'S';
  DUSCHAR.push({ x0, x1, z0, z1, cx, cz, axel: nsAxel ? 'z' : 'x', linje: nsAxel ? p[1] + inn.z * 0.12 : p[0] + inn.x * 0.12, max: (nsAxel ? z1 - z0 : x1 - x0) - 0.12 });
  const andar = glas.flatMap(([ax, az, bx, bz]) => [[ax, az], [bx, bz]]);
  glas.forEach(([ax, az, bx, bz]) => {
    const l = Math.hypot(bx - ax, bz - az), ry2 = Math.atan2(-(bz - az), bx - ax), mxp = (ax + bx) / 2, mzp = (az + bz) / 2;
    const ux = (bx - ax) / l, uz = (bz - az) / l;
    const forsta = glas.indexOf(glas.find(g2 => g2[0] === ax && g2[1] === az && g2[2] === bx && g2[3] === bz)) === 0 && glas.length > 1;
    // 8 mm klart glas. Kanterna är egna smala ytor bredvid glaset (inte lådor i samma plan
    // som glasets sidor, som flimrade): glasrutan slutar där kanten börjar. Mot väggen en
    // smal profil i borstat stål som glaset går in i; den står 4 mm från kaklet.
    const kant = 0.003, E = [[ax, az, -1], [bx, bz, 1]].map(([ex, ez, k]) => {
      const delad = andar.filter(([qx, qz]) => Math.abs(qx - ex) < 0.01 && Math.abs(qz - ez) < 0.01).length > 1;
      const motVagg = !delad && (Math.abs(uz) < 0.5 ? (Math.abs(ex - x0) < 0.01 || Math.abs(ex - x1) < 0.01) : (Math.abs(ez - z0) < 0.01 || Math.abs(ez - z1) < 0.01));
      return { ex, ez, k, delad, motVagg };
    });
    // glasets utsträckning längs u: från a-änden (−) till b-änden (+)
    const ua = E[0].motVagg ? 0.008 : E[0].delad ? (forsta ? -0.004 : 0.004) : kant, ub = E[1].motVagg ? 0.008 : E[1].delad ? (forsta ? -0.004 : 0.004) : kant;
    const lg = l - ua - ub, mu = (ua - ub) / 2;
    box('glas', lg, 1.97 - kant, 0.008, mxp + ux * mu, 0.995 - kant / 2, mzp + uz * mu, ry2);
    // polerad överkant (egen smal list ovanpå glaset) med svagt grön ton som i riktigt glas
    ton('#8fb5a4', () => glans(0.25, () => box('keramik', lg, kant, 0.008, mxp + ux * mu, 1.98 - kant / 2, mzp + uz * mu, ry2)));
    E.forEach(({ ex, ez, k, delad, motVagg }) => {
      // glasbeslag i borstat stål: två hörnklämmor där glasen möts (på den första rutan)
      if (motVagg) ton('#cfccc6', () => stalBox(0.014, 1.97, 0.016, ex - ux * k * 0.011, 0.995, ez - uz * k * 0.011, 0.003, ry2));
      else if (!delad) ton('#8fb5a4', () => glans(0.25, () => box('keramik', kant, 1.97, 0.008, ex - ux * k * kant / 2, 0.995, ez - uz * k * kant / 2, ry2)));
    });
    if (HINDER) HINDER.push({ x0: Math.min(ax, bx) - 0.03, z0: Math.min(az, bz) - 0.03, x1: Math.max(ax, bx) + 0.03, z1: Math.max(az, bz) + 0.03, niva: 'botten' });
  });
  const top = Math.min(2.05, takVid(cx, cz) - 0.1), W = nsAxel ? x1 - x0 : z1 - z0;
  med(p[0], p[1], ry, () => {
    // kaklad inbyggnad i hörnet med en nisch och infälld hylla
    const a = -W / 2 + 0.005, b = a + 0.34, D = 0.1, zc = 0.014 + D / 2, ny0 = 1.0, ny1 = 1.32, tt = Math.min(2.1, takVid(cx, cz) - 0.012), m = (a + b) / 2;
    ton('#e9e5dd', () => {
      kakelLada(0.04, tt, D, a + 0.02, tt / 2, zc); kakelLada(0.04, tt, D, b - 0.02, tt / 2, zc);
      kakelLada(b - a - 0.08, ny0, D, m, ny0 / 2, zc);
      kakelLada(b - a - 0.08, tt - ny1, D, m, (tt + ny1) / 2, zc);
      kakelLada(b - a - 0.08, ny1 - ny0, 0.02, m, (ny0 + ny1) / 2, 0.024);
    });
    [['#e9e4da', 0.19], ['#6f7a66', 0.17], ['#c7a27c', 0.15]].forEach(([fg, h], i) => ton(fg, () => svarv('keramik', [[0, 0], [0.026, 0], [0.028, h * 0.85], [0.013, h], [0, h]], m - 0.075 + i * 0.075, ny0, 0.075, 16)));
    // skruvkork resp. pump på flaskorna och ett etikettfält (utan text)
    [0.19, 0.17, 0.15].forEach((h, i) => { const bx = m - 0.075 + i * 0.075;
      ton(['#7a756c', '#d9d4c8', '#5f5a52'][i], () => { cyl('keramik', 0.012, 0.013, 0.02, bx, ny0 + h + 0.009, 0.075, 10); if (i === 0) { cyl('keramik', 0.003, 0.003, 0.03, bx, ny0 + h + 0.03, 0.075, 6); box('keramik', 0.008, 0.007, 0.03, bx, ny0 + h + 0.046, 0.087); } });
      ton(['#cfc8ba', '#e6e1d6', '#e9dccb'][i], () => glans(2.5, () => lagg('keramik', new T.CylinderGeometry(0.0282, 0.0275, h * 0.36, 12, 1, true), mx(bx, ny0 + h * 0.42, 0.075)))); });
    // armaturen sitter mitt på den fria väggen bredvid inbyggnaden
    med(0.16, 0, 0, () => {
      // termostatblandare på 1,0 m: rund kropp, två vred, två väggfästen med rosetter
      cyl('svart', 0.032, 0.032, 0.3, 0, 1.0, 0.075, 24, false, 0, PI / 2);
      for (const k of [-1, 1]) {
        cyl('svart', 0.016, 0.016, 0.05, k * 0.1, 1.0, 0.037, 16, false, PI / 2);
        cyl('svart', 0.03, 0.03, 0.008, k * 0.1, 1.0, 0.018, 24, false, PI / 2);
        cyl('svart', 0.038, 0.038, 0.045, k * 0.172, 1.0, 0.075, 24, false, 0, PI / 2);
        lagg('svart', new T.TorusGeometry(0.038, 0.004, 6, 24).rotateY(PI / 2), mx(k * 0.15, 1.0, 0.075));
      }
      // stigarrör ur blandarens övre utlopp: ett rör med mjuk 90°-böj in i en 32 cm arm
      const yt = top - 0.06, ut = 0.075 + 0.32;
      const ror = new T.CurvePath();
      ror.add(new T.LineCurve3(V(0, 1.03, 0.075), V(0, yt - 0.06, 0.075)));
      ror.add(new T.QuadraticBezierCurve3(V(0, yt - 0.06, 0.075), V(0, yt, 0.075), V(0, yt, 0.135)));
      ror.add(new T.LineCurve3(V(0, yt, 0.135), V(0, yt, ut)));
      lagg('svart', new T.TubeGeometry(ror, 32, 0.011, 10, false), mx(0, 0, 0));
      // väggfäste högt upp på röret
      cyl('svart', 0.009, 0.009, 0.064, 0, yt - 0.3, 0.044, 12, false, PI / 2);
      cyl('svart', 0.026, 0.026, 0.008, 0, yt - 0.3, 0.018, 24, false, PI / 2);
      lagg('svart', new T.TorusGeometry(0.014, 0.004, 6, 16).rotateX(PI / 2), mx(0, yt - 0.3, 0.075));
      // kulled och takdusch, 25 cm, 8 mm tjock, centrerad under armens ände; munstycken under
      lagg('svart', new T.SphereGeometry(0.016, 16, 12), mx(0, yt - 0.008, ut));
      cyl('svart', 0.008, 0.008, 0.02, 0, yt - 0.022, ut, 12);
      svarv('svart', [[0, 0], [0.12, 0], [0.125, 0.003], [0.125, 0.006], [0.12, 0.008], [0, 0.008]], 0, yt - 0.04, ut, 48);
      ton('#5f5d58', () => cyl('keramik', 0.108, 0.108, 0.001, 0, yt - 0.0405, ut, 40));
      for (let i = 0; i < 24; i++) { const a = i * PI / 12, rr = i % 2 ? 0.05 : 0.085; box('svart', 0.004, 0.0012, 0.004, Math.cos(a) * rr, yt - 0.0412, ut + Math.sin(a) * rr); }
      // glidhållare som klämmer runt röret, handdusch som sitter i hållaren
      lagg('svart', new T.TorusGeometry(0.016, 0.006, 8, 20).rotateX(PI / 2), mx(0, 1.5, 0.075));
      box('svart', 0.02, 0.02, 0.04, 0, 1.5, 0.105);
      svarv('svart', [[0.012, 0], [0.02, 0], [0.022, 0.035], [0.018, 0.035], [0.015, 0.006]], 0, 1.475, 0.135, 20);
      lagg('svart', new T.CylinderGeometry(0.014, 0.011, 0.2, 16), mx(0, 1.56, 0.135));
      svarv('svart', [[0, 0], [0.04, 0], [0.042, 0.012], [0.03, 0.03], [0.014, 0.04], [0, 0.04]].map(([r, h]) => [r, -h]).reverse(), 0, 1.7, 0.135, 24);
      // slang från blandarens nedre utlopp i en mjuk båge upp till handduschens fäste
      const sl = [V(0, 0.968, 0.085), V(0.02, 0.86, 0.11), V(0.05, 0.79, 0.13), V(0.05, 0.95, 0.14), V(0.02, 1.25, 0.138), V(0, 1.46, 0.135)];
      lagg('svart', new T.TubeGeometry(new T.CatmullRomCurve3(sl), 40, 0.007, 8, false), mx(0, 0, 0));
    });
    // linjär golvbrunn i borstat stål med spår, i golvets lägsta linje
    // (golvet ligger på 3 mm vid brunnen, se badGolv: rännans överkant 1 mm över klinkern)
    sbNeutral(0.7, 0.006, 0.07, 0, 0.001, 0.12, 0.002);
    ton('#3a3936', () => { for (let i = 0; i < 10; i++) box('vit', 0.05, 0.002, 0.008, -0.3 + i * 0.066, 0.0035, 0.12); });
  });
}

const OLIVTON = ['#ffffff', '#eef0e8', '#e3e8da', '#f4f2ea'];
// Punkt (husets system, växten i (bx, bz)) minst marg innanför ytterväggarna och
// mellanväggarna på växtens sida: skaft och stammar når aldrig in i en vägg.
function innanfor(v, bx, bz, marg = 0.1) {
  const gx = HH.L / 2 - I - marg, gz = HH.W / 2 - I - marg;
  v.x = Math.max(-gx, Math.min(gx, v.x)); v.z = Math.max(-gz, Math.min(gz, v.z));
  for (const w of VAGGAR) {
    if (v.y < w.bunn) continue;
    const s = w.axel === 'x' ? v.x : v.z; if (s < w.lo - marg || s > w.hi + marg) continue;
    const bc = (w.axel === 'x' ? bz : bx) - w.c; if (Math.abs(bc) > 1.2) continue;
    const sd = Math.sign(bc) || 1, lim = w.c + sd * (w.t / 2 + marg), q = w.axel === 'x' ? 'z' : 'x';
    if (sd * (v[q] - lim) < 0) v[q] = lim;
  }
  return v;
}
// Stor växt på golvet: monstera, fiolfikus eller olivträd (i tur och ordning om typ saknas).
function vaxt(x, z, stor = true, y = 0, typ = null) {
  if (!stor) { smavaxt(x, z, y); return; }
  const t = typ ?? ['monstera', 'fikus', 'oliv'][VAXTNR++ % 3];
  skugga(x, z, 0.34, 0.34, 0, 0.16, 0.45, y + 0.021);
  { const hs = t === 'sansevieria' || t === 'zz' ? 0.34 : 0.42; hind(hs, hs, x, z); }
  if (t === 'monstera') {
    // matt keramikkruka med jord; 9 blad på välvda, avsmalnande skaft som växer ur jorden
    // på flera ställen; de unga bladen är mindre och ljusare och sitter nära mitten
    kruka(x, y, z, 0.2, 0.36, '#cfc7ba');
    const yj = y + 0.36 * 0.86, sida = rnd() * 2 * PI;
    for (let i = 0; i < 9; i++) {
      const ung = i >= 7, az0 = i * 2.39996 + rnd() * 0.6, az = az0 + 0.45 * Math.sin(az0 - sida);   // lite ensidig
      let dx = Math.sin(az), dz = Math.cos(az);
      const fri = (ax, az2) => { let m = 9; const gx = HH.L / 2 - I, gz = HH.W / 2 - I; if (ax > 0.1) m = Math.min(m, (gx - x) / ax); if (ax < -0.1) m = Math.min(m, (-gx - x) / ax); if (az2 > 0.1) m = Math.min(m, (gz - z) / az2); if (az2 < -0.1) m = Math.min(m, (-gz - z) / az2); return m; };
      if (fri(dx, dz) < 0.35) { dx = -dx; dz = -dz; }
      const ox = x + (rnd() - 0.5) * 0.14, oz = z + (rnd() - 0.5) * 0.14;
      const L = ung ? 0.32 + rnd() * 0.16 : 0.48 + rnd() * 0.5, ut = Math.max(0.04, Math.min(ung ? 0.06 + rnd() * 0.08 : 0.22 + rnd() * 0.32, fri(dx, dz) - 0.12));
      // skaftet: reser sig först, böjer sedan mjukt utåt och nickar lite nedåt mot bladet
      // skaftet stiger hela vägen (ingen topp ovanför bladet) och böjer mjukt utåt mot
      // bladets bas; bladet sitter i skaftets riktning
      const pts = [V(ox, yj, oz), V(ox + dx * ut * 0.12, yj + L * 0.5, oz + dz * ut * 0.12), V(ox + dx * ut * 0.5, yj + L * 0.82, oz + dz * ut * 0.5), V(ox + dx * ut, yj + L * (ung ? 0.96 : 0.9), oz + dz * ut)];
      pts.slice(1).forEach(q => innanfor(q, x, z));
      const k = ton('#7a9a5a', () => tub('tyg', pts, 0.01, 0.006, 16, 6));
      const tip = k.getPointAt(1);
      const bAz = Math.atan2(dx, dz); rnd();
      const langs = bladkort(BL.monstera, ung ? 0.17 + rnd() * 0.07 : 0.3 + rnd() * 0.18, tip.x, tip.y, tip.z, bAz, ung ? 0.45 + rnd() * 0.4 : 1.05 + rnd() * 0.4,
        { bag: 0.26, vik: 0.12, kupa: 0.3, nx: 6, ny: 4, rull: (rnd() - 0.5) * 0.2, ton: ung ? '#f4fbe8' : ['#eef3e6', '#f6f8ee', '#e6eedc', '#f1f5e8'][i % 4] });
      // skaftet fortsätter rakt in i bladets bas (texturens smala skaftbit syntes som ett hårstrå)
      { const a = tip, b = langs(0.15).applyMatrix4(BAS.clone().invert()), L2 = a.distanceTo(b);
        if (L2 > 0.005) { const q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), mid = a.clone().add(b).multiplyScalar(0.5);
          ton('#7a9a5a', () => lagg('tyg', new T.CylinderGeometry(0.0042, 0.006, L2, 6).applyQuaternion(q).translate(mid.x, mid.y, mid.z), mx(0, 0, 0))); } }
    }
  } else if (t === 'fikus') {
    // fiolfikus: träig stam i mjuk S-form, stora läderblad på korta skaft
    kruka(x, y, z, 0.17, 0.38, '#2f2d2a');
    ton('#2a2826', () => svarv('keramik', [[0, 0], [0.2, 0], [0.205, 0.02], [0.195, 0.02], [0, 0.01]], x, y, z, 32));   // fat
    const H = 1.05 + rnd() * 0.2, yj = y + 0.38 * 0.86, a0 = rnd() * 6;
    const stam = ton('#6a5644', () => tub('tyg', [V(x, yj, z), V(x + 0.025 * Math.sin(a0), yj + H * 0.4, z + 0.025 * Math.cos(a0)), V(x - 0.01 * Math.sin(a0), yj + H * 0.8, z - 0.01 * Math.cos(a0)), V(x, yj + H, z)], 0.015, 0.009, 14, 8));
    const grenar = [stam];
    for (let g = 0; g < 3; g++) {
      const a = a0 + g * 2.1, b = stam.getPointAt(0.82 + g * 0.06), L = 0.32 + rnd() * 0.15;
      const gp = [b, V(b.x + Math.sin(a) * 0.08, b.y + L * 0.5, b.z + Math.cos(a) * 0.08), V(b.x + Math.sin(a) * 0.14, b.y + L, b.z + Math.cos(a) * 0.14)];
      gp.slice(1).forEach(q => innanfor(q, x, z, 0.15));
      grenar.push(ton('#6f5a46', () => tub('tyg', gp, 0.008, 0.004, 10, 6)));
    }
    // 30 blad i spiral: större och mörkare nertill, små ljusa skott i topparna
    for (let i = 0; i < 30; i++) {
      const gi = i < 12 ? 0 : 1 + (i % 3), k = grenar[gi], f = gi ? 0.25 + 0.75 * ((i - 12) / 18) : 0.4 + 0.5 * (i / 12);
      const p = k.getPointAt(Math.min(0.98, f)), az = i * 2.39996 + rnd() * 0.4, ung = gi && f > 0.8;
      // bladskaft: kort, snett upp och ut från stammen/grenen till bladets bas
      const e = innanfor(V(p.x + Math.sin(az) * 0.045, p.y + 0.03, p.z + Math.cos(az) * 0.045), x, z, 0.12);
      ton('#6d7f4f', () => tub('tyg', [p, V((p.x + e.x) / 2, p.y + 0.022, (p.z + e.z) / 2), e], 0.004, 0.003, 4, 4));
      bladkort(BL.fikus, ung ? 0.17 + rnd() * 0.04 : 0.25 + rnd() * 0.1, e.x, e.y, e.z, az, ung ? 0.45 + rnd() * 0.3 : 0.75 + rnd() * 0.45,
        { bred: 1.5, bag: 0.16, vik: 0.1, kupa: 0.16, nx: 4, ny: 3, rull: (rnd() - 0.5) * 0.4, ton: ung ? '#e8efdc' : ['#c3cdbb', '#d2d9c8', '#b9c4b1'][i % 3] });
    }
  } else if (t === 'sansevieria') {
    // svärdsbräken: raka, styva svärdsblad ur jorden, mörkgröna med ljusare toner
    kruka(x, y, z, 0.15, 0.32, '#e4ddd0');
    const yj = y + 0.32 * 0.855;
    for (let i = 0; i < 11; i++) {
      const az = i * 2.39996 + rnd() * 0.5, rr = 0.02 + rnd() * 0.07, L = 0.45 + rnd() * 0.35;
      bladkort(BL.lans, L, x + Math.sin(az) * rr, yj - 0.004, z + Math.cos(az) * rr, az, 0.04 + rnd() * 0.16, { bred: 0.42, vik: 0.28, bag: 0.02, ny: 4, nx: 2, rull: (rnd() - 0.5) * 0.8, ton: ['#b9c9a0', '#a8bb92', '#c9d4a8', '#9fb388'][i % 4] });
    }
  } else if (t === 'zz') {
    // zamioculcas: välvda stjälkar med blanka, parvisa småblad längs hela stjälken
    kruka(x, y, z, 0.13, 0.28, '#3d3d3b');
    const yj = y + 0.28 * 0.855;
    for (let i = 0; i < 8; i++) {
      const az = i * 2.39996 + rnd() * 0.4, L = 0.38 + rnd() * 0.28, ut = 0.1 + rnd() * 0.16, ox = x + Math.sin(az) * 0.03, oz = z + Math.cos(az) * 0.03;
      const pts = [V(ox, yj - 0.004, oz), V(ox + Math.sin(az) * ut * 0.3, yj + L * 0.5, oz + Math.cos(az) * ut * 0.3), V(ox + Math.sin(az) * ut, yj + L, oz + Math.cos(az) * ut)];
      pts.slice(1).forEach(q => innanfor(q, x, z, 0.15));
      const k = ton('#6f7f4c', () => tub('tyg', pts, 0.007, 0.003, 10, 5));
      // småbladen 7–10 cm, uppåt och utåt i 50°, blanka och mörkt gröna (inte svarta streck)
      for (let j = 0; j < 7; j++) {
        const u = 0.32 + j * 0.1, p = k.getPointAt(Math.min(0.99, u)), sd = j % 2 ? 1 : -1;
        bladkort(BL.lans, 0.075 + 0.03 * Math.sin(u * PI), p.x, p.y, p.z, az + sd * 1.25, 0.9, { bred: 1.25, vik: 0.1, bag: 0.06, ny: 2, nx: 2, rull: sd * 0.3, ton: ['#c3d2ac', '#b4c69c', '#cfdcb9'][j % 3] });
      }
    }
  } else {
    // olivträd: två tunna stammar som vrider sig om varandra, smala silvergröna blad i klasar
    kruka(x, y, z, 0.17, 0.32, '#b8714c');
    const yj = y + 0.32 * 0.86, top = [];
    for (let s2 = 0; s2 < 2; s2++) {
      const pts = [];
      for (let j = 0; j <= 6; j++) { const t2 = j / 6, a = s2 * PI + t2 * 4.2; pts.push(V(x + Math.cos(a) * 0.016 * (1 - t2 * 0.3), yj + t2 * 0.72, z + Math.sin(a) * 0.016 * (1 - t2 * 0.3))); }
      ton('#7a6a58', () => tub('tyg', pts, 0.014, 0.009, 16, 5));
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4, b = V(x, yj + 0.7, z), e = innanfor(V(x + Math.sin(a) * 0.16, yj + 0.95 + k * 0.1, z + Math.cos(a) * 0.16), x, z, 0.3);
      ton('#7a6a58', () => tub('tyg', [b, V(x + Math.sin(a) * 0.05, yj + 0.82, z + Math.cos(a) * 0.05), e], 0.009, 0.005, 8, 5));
      top.push(e);
      // grenen delar sig i fyra kvistar uppåt och utåt; kvistkorten sitter längs kvistarna
      // (inga raka pinnar från en gemensam mittpunkt: kronan såg ut som ett paraplyskelett)
      for (let j = 0; j < 4; j++) {
        const ak = a + (j - 1.5) * 0.85 + (rnd() - 0.5) * 0.5, L = 0.12 + rnd() * 0.1, up = 0.45 + rnd() * 0.6;
        const s1 = innanfor(V(e.x + Math.sin(ak) * L * 0.5, e.y + L * up * 0.6, e.z + Math.cos(ak) * L * 0.5), x, z, 0.22);
        const s2 = innanfor(V(e.x + Math.sin(ak) * L, e.y + L * up, e.z + Math.cos(ak) * L), x, z, 0.22);
        const kv = ton('#7a6a58', () => tub('tyg', [e.clone(), s1, s2], 0.0045, 0.0022, 5, 4));
        for (let i = 0; i < 7; i++) {
          const p = kv.getPointAt(0.12 + i * 0.145);
          // korsade kort (som vasens kvistar): kronan får volym och inga kort syns som streck från sidan
          const ab = ak + (rnd() - 0.5) * 2.2, lb = 0.65 + rnd() * 0.85, Lb = 0.19 + rnd() * 0.1;
          bladkort(BL.oliv, Lb, p.x, p.y, p.z, ab, lb, { bag: 0.14, vik: 0.18, kupa: 0.2, ton: OLIVTON[(i + j) % 4] });
          bladkort(BL.oliv, Lb * 0.85, p.x, p.y, p.z, ab + PI / 2, lb * 0.85, { bag: 0.14, vik: 0.18, kupa: 0.2, ton: OLIVTON[(i + j + 2) % 4] });
        }
      }
    }
  }
}

function matta(x, z, w, d, ry = 0, fg = '#d8cdbb', m = null) {
  { const c = V(x, 0, z).applyMatrix4(BAS); MATTOR.push([c.x - w / 2, c.x + w / 2, c.z - d / 2, c.z + d / 2]); }
  // mattan: 14 mm tjock med rundade hörn och mjukt fasad kant (kantband i lite mörkare
  // ton runt mönstret), 2 mm över golvet så att den aldrig flimrar mot golvet
  const rh = Math.min(0.05, w * 0.06, d * 0.06), sh = new T.Shape(), hw = w / 2 - 0.003, hd = d / 2 - 0.003;
  sh.moveTo(-hw + rh, -hd); sh.lineTo(hw - rh, -hd); sh.quadraticCurveTo(hw, -hd, hw, -hd + rh); sh.lineTo(hw, hd - rh); sh.quadraticCurveTo(hw, hd, hw - rh, hd);
  sh.lineTo(-hw + rh, hd); sh.quadraticCurveTo(-hw, hd, -hw, hd - rh); sh.lineTo(-hw, -hd + rh); sh.quadraticCurveTo(-hw, -hd, -hw + rh, -hd);
  const eg = new T.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 }).rotateX(-PI / 2);
  eg.translate(0, 0.005, 0);
  const B = m ?? (rnd() < 0.5 ? 0 : 1);
  ton(skiftTon(fg, 0.97), () => vav('linne', () => lagg('tyg', eg, mx(x, 0, z, ry))));
  const C = B ? TR.mattaB : TR.mattaA, iw = w - 0.07, id = d - 0.07, a = iw / id;
  // cellen beskärs till mattans proportioner (som konst), så att mönstret inte töjs
  const c = a > 1 ? [C[0], C[1] + (C[3] - C[3] / a) / 2, C[2], C[3] / a] : [C[0] + (C[2] - C[2] * a) / 2, C[1], C[2] * a, C[3]];
  platta('tryck', iw, id, mx(x, 0.0172, z, ry, -PI / 2), c, [Math.ceil(w / 0.45), Math.ceil(d / 0.45)]);
  // berbermattan (A) har fransar i kortändarna: tunna tofsar som ligger på golvet
  if (B) return;
  const lx = w >= d, L = lx ? d : w, n = Math.floor((L - 0.06) / 0.012), fr = [];
  let s = 4211; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const k of [-1, 1]) for (let i = 0; i <= n; i++) {
    const t = -L / 2 + 0.03 + i * (L - 0.06) / n, len = 0.055 + r() * 0.02, vr = (r() - 0.5) * 0.3, e = (lx ? w : d) / 2 - 0.012;
    const g = new T.CylinderGeometry(0.0018, 0.0022, len, 3, 1, true).rotateX(PI / 2).rotateY(vr).translate(Math.sin(vr) * len / 2, 0.0035, e + Math.cos(vr) * len / 2);
    if (k < 0) g.rotateY(PI);
    if (lx) g.rotateY(PI / 2);
    g.translate(lx ? 0 : t, 0, lx ? t : 0);
    fr.push(g);
  }
  const fg2 = mergeGeometries(fr); fr.forEach(g => g.dispose());
  ton('#e9e1d2', () => vav('ull', () => lagg('tyg', fg2, mx(x, 0, z, ry))));
}

// Ram (lokalt): BAS = absolut ram för allt inom fn
function iRam(m, fn) { const g = BAS; BAS = m; fn(); BAS = g; }
// Tavla i lokalt system: mitt i origo, baksidan fri cm från väggen (z = 0), +z ut.
// 2 cm smal ram (ek, svart eller vit), distanser mot väggen, bakskiva, benvit
// passepartout med ljus fas runt bilden, målningen (beskuren till bildens proportioner)
// och ett tunt glas med svag glans.
function tavla(w, h, motiv = 0, ram = 'ek', fri = 0.004) {
  const R = 0.02, D = 0.024, zf = fri + D, rt = ram === 'svart' ? '#3b3936' : ram === 'vit' ? '#f2efe9' : null, mk = ram === 'ek' ? 'ek' : 'vit';
  ton(rt, () => {
    // ramlisterna möts i gering (rundad, fasad kant), ett stycke per sida
    for (const s of [-1, 1]) rbx(mk, w, R, D, 0, s * (h / 2 - R / 2), fri + D / 2, 0.005, 0, 0, 2);
    for (const s of [-1, 1]) rbx(mk, R, h - 2 * R + 0.001, D, s * (w / 2 - R / 2), 0, fri + D / 2, 0.005, 0, 0, 2);
    // bakkant mot väggen: tavlan ligger an, ingen synlig upphängning
  });
  // distanser i hörnen: tavlan vilar mot väggen
  if (fri > 0.006) ton(rt ?? '#b38a5e', () => box(mk, w - 0.01, h - 0.01, fri, 0, 0, fri / 2));
  const iw = w - 2 * R, ih = h - 2 * R, pp = Math.min(iw, ih) * 0.15, bw = iw - 2 * pp, bh = ih - 2 * pp, zm = zf - 0.008;
  ton('#d8d0c2', () => box('vit', iw + 0.002, ih + 0.002, 0.003, 0, 0, fri + 0.0015));
  ton('#f4f1ea', () => {
    for (const s of [-1, 1]) box('vit', iw, pp, 0.002, 0, s * (bh / 2 + pp / 2), zm);
    for (const s of [-1, 1]) box('vit', pp, bh, 0.002, s * (bw / 2 + pp / 2), 0, zm);
  });
  ton('#fffdf8', () => {   // fasen: en ljus linje runt bilden
    for (const s of [-1, 1]) box('vit', bw, 0.003, 0.0016, 0, s * (bh / 2 - 0.0015), zm - 0.0004);
    for (const s of [-1, 1]) box('vit', 0.003, bh - 0.006, 0.0016, s * (bw / 2 - 0.0015), 0, zm - 0.0004);
  });
  ton('#e9e3d8', () => box('vit', iw, ih, 0.002, 0, 0, zm - 0.005));   // underlag bakom bilden
  const C = [TR.k0, TR.k1, TR.k2, TR.k3, TR.k4][motiv % 5], a = bw / bh;
  const cell = a > 1 ? [C[0], C[1] + (C[3] - C[3] / a) / 2, C[2], C[3] / a] : [C[0] + (C[2] - C[2] * a) / 2, C[1], C[2] * a, C[3]];
  platta('tryck', bw, bh, mx(0, 0, zm - 0.0025), cell, [1, 1]);
  platta('glas', iw, ih, mx(0, 0, zf - 0.003), null, [1, 1]);
}
// Plats på väggen för en tavla (bredd w, höjd h, mitt på höjden y): flyttar tavlan längs
// väggen till närmaste läge där den ligger helt på väggytan, inte över dörr- eller
// fönsteröppningar (med foder), inte över en mellanväggs anslutning och minst 10 cm från
// strömbrytare. Ger [x, z] eller null (då hängs ingen tavla).
function vaggPlats(x, z, ry, y, w, h) {
  const nx = Math.round(Math.sin(ry)), nz = Math.round(Math.cos(ry)), langsX = Math.abs(nz) === 1;
  const s0 = langsX ? x : z, plan = langsX ? z : x, nd = langsX ? nz : nx;
  const y0 = y - h / 2, y1 = y + h / 2, hw = w / 2, blk = [];
  const gx = HH.L / 2 - I, gz = HH.W / 2 - I, g = langsX ? gx : gz;
  let lo = -g + 0.08 + hw, hi = g - 0.08 - hw;
  // ytterväggens öppningar (fönster och dörrar med foder)
  const yt = langsX ? gz : gx;
  if (Math.abs(Math.abs(plan) - yt) < 0.06 && HH.oppningar) {
    const sida = langsX ? (plan > 0 ? 'S' : 'N') : (plan > 0 ? 'E' : 'W');
    HH.oppningar.filter(o => o[0] === sida).forEach(o => {
      let a, b;
      if (sida === 'S') { a = -HH.L / 2 + o[1]; b = a + o[2]; } else if (sida === 'N') { b = HH.L / 2 - o[1]; a = b - o[2]; }
      else if (sida === 'E') { b = HH.W / 2 - o[1]; a = b - o[2]; } else { a = -HH.W / 2 + o[1]; b = a + o[2]; }
      if (o[3] - 0.1 < y1 && o[3] + o[4] + 0.1 > y0) blk.push([a - 0.1 - hw, b + 0.1 + hw]);
    });
  }
  VAGGAR.forEach(v => {
    const par = (v.axel === 'x') === langsX;
    if (par) {
      if (Math.abs(Math.abs(plan - v.c) - v.t / 2) < 0.04 && s0 > v.lo - 0.3 && s0 < v.hi + 0.3) {
        lo = Math.max(lo, v.lo + 0.06 + hw); hi = Math.min(hi, v.hi - 0.06 - hw);
        v.hal.forEach(q => { if (q.h + 0.08 > y0) blk.push([q.a - 0.14 - hw, q.b + 0.14 + hw]); });
      }
    } else if (plan + nd * 0.1 > v.lo && plan + nd * 0.1 < v.hi && v.bunn < y1) blk.push([v.c - v.t / 2 - 0.05 - hw, v.c + v.t / 2 + 0.05 + hw]);
  });
  (BRYT || []).forEach(q => {
    const qp = langsX ? q.z : q.x, qs = langsX ? q.x : q.z;
    if (Math.abs(qp - plan) < 0.08 && q.y + 0.04 + 0.1 > y0 && q.y - 0.04 - 0.1 < y1) blk.push([qs - 0.14 - hw, qs + 0.14 + hw]);
  });
  const ok = s => s >= lo - 1e-6 && s <= hi + 1e-6 && !blk.some(([a, b]) => s > a + 1e-6 && s < b - 1e-6);
  const kand = [s0, lo, hi, ...blk.flat()].filter(ok).sort((a, b) => Math.abs(a - s0) - Math.abs(b - s0));
  if (!kand.length || Math.abs(kand[0] - s0) > 1.2) return null;
  return langsX ? [kand[0], z] : [x, kand[0]];
}
// Tavla på väggen: (x, y, z) mitt på väggytan, ry så att lokalt +z pekar ut i rummet.
// Hänger 1,5 cm ut från väggen med en mjuk skugga bakom.
function konst(x, y, z, ry, w, h, motiv = 0, ram = 'ek') {
  const pl = vaggPlats(x, z, ry, y, w, h);
  if (!pl) return;
  [x, z] = pl;
  med(x, z, ry, () => {
    skugga(0, 0.0015, w * 0.94, h * 0.94, 0, 0.045, 0.3, y - 0.018, PI / 2);
    iRam(mx(0, y, 0), () => tavla(w, h, motiv, ram));
  });
}

// Pendel: kupa i grafit med ljus inuti, eller opalglob. Hör till taklagret.
function pendel(x, z, yb, ljus = false, typ = 'kupa') {
  if (ljus && !LJUS) LJUS = V(x, yb - 0.12, z);
  iLager('tak', () => {
    const tak = takVid(x, z), sladd = tak - 0.03 - yb - 0.2;
    // takkupa: svarvad, mjukt avfasad
    { const [rx, rz] = takLut(x, z); ton('#f1eee8', () => lagg('vit', new T.LatheGeometry([[0, -0.03], [0.016, -0.03], [0.052, -0.026], [0.06, -0.012], [0.062, -0.003], [0.06, 0.004], [0, 0.004]].map(q => new T.Vector2(q[0], q[1])), 28), mx(x, tak, z, 0, rx, rz))); }
    if (typ === 'glob') {
      const l = tak - yb - 0.31;
      // textilsladd, metallhållare och en opalglob
      if (l > 0.02) ton('#2f2e2c', () => cyl('svart', 0.0035, 0.0035, l - 0.03 + 0.004, x, yb + 0.31 + (l - 0.03) / 2, z, 8));
      ton('#c8a46c', () => cyl('diskstal', 0.025, 0.025, 0.04, x, yb + 0.29, z, 24));
      ton('#c8a46c', () => svarv('diskstal', [[0.024, 0], [0.04, 0.004], [0.044, 0.012], [0.03, 0.02], [0.024, 0.02]], x, yb + 0.258, z, 32));
      const li = egenLampa('Taklampa', [x, yb + 0.15, z], () => lagg('lampa', new T.SphereGeometry(0.13, 28, 16), mx(x, yb + 0.15, z)), false, [[x, yb + 0.15, z, 0.55, 0.2]]);   // glorian framför globen (inte skymd av den)
      iLager('botten', () => sken(li, x, 0.024, z, 0.7, 0.7, 0.22, false, 0.45));
    } else {
      // textilsladd ner till en slät kupa (48 segment, jämn profil) med mässingsinsida,
      // synlig godskant och en glödlampa som sitter dold uppe i kupan
      if (sladd > 0.02) ton('#2f2e2c', () => cyl('svart', 0.0035, 0.0035, sladd + 0.004, x, yb + 0.2 + sladd / 2, z, 8));
      ton('#c8a46c', () => cyl('diskstal', 0.022, 0.026, 0.05, x, yb + 0.205, z, 24));
      const ut = [[0.196, 0]], inn = [];
      for (let i = 0; i <= 9; i++) {
        const u = i / 9, r = 0.03 + 0.17 * Math.pow(1 - u, 0.75) * (1 - 0.08 * Math.sin(u * PI)), y = 0.19 * Math.pow(u, 0.9);
        ut.push([r, y]); inn.unshift([Math.max(0.001, r - 0.004), Math.max(0, y - 0.004)]);
      }
      ut.push([0, 0.19]); inn.unshift([0, 0.186]);
      ton('#6f6c67', () => svarv('vit', ut, x, yb, z, 48));   // grafitlackerad plåt (matt lack, inte metall: läses grafit även på kvällen)
      ton('#f2efe9', () => svarv('vagg', inn, x, yb, z, 48));
      // godskant och en opal diffusor nere i kupan: glödlampan syns inte underifrån
      const li = egenLampa(ljus ? 'Taklampa matbord' : 'Taklampa', [x, yb + 0.1, z], () => lagg('lampa', new T.CircleGeometry(0.17, 36).rotateX(PI / 2), mx(x, yb + 0.03, z)), false, [[x, yb - 0.01, z, 0.6]]);   // glorian där ljuset kommer ut under kupan
      iLager('botten', () => sken(li, x, 0.744, z, 0.34, 0.34, 0.42, false, 0.34));   // ljuspöl på bordet
    }
  });
}

// Takets lutning vid (x, z): [rx, rz] så att lokalt +y står vinkelrätt mot taket.
function takLut(x, z) {
  if (iLoft(x, z)) return [0, 0];
  const gx = (CEIL(x + 0.01, z) - CEIL(x - 0.01, z)) / 0.02, gz = (CEIL(x, z + 0.01) - CEIL(x, z - 0.01)) / 0.02;
  return [Math.atan(-gz), Math.atan(gx)];
}
// Takarmatur, plafond (taklagret).
function plafond(x, z, r = 0.16) {
  iLager('tak', () => {
    const t = takVid(x, z);
    { const [rx, rz] = takLut(x, z); ton('#f4f2ee', () => lagg('vagg', new T.CylinderGeometry(r + 0.01, r + 0.01, 0.024, 32), mx(x, t - 0.008, z, 0, rx, rz))); }
    const li = egenLampa('Taklampa', [x, t - 0.05, z], () => lagg('lampa', new T.SphereGeometry(r, 20, 8, 0, 2 * PI, PI / 2, PI / 2), mx(x, t - 0.02, z, 0, 0, 0)), false, [[x, t - 0.1, z, 0.45, r + 0.08]]);   // opalkupan skymmer inte sin gloria
    // bred, svag ljuspöl på golvet under lampan (syns också i dockskåpet, där taket är lyft)
    iLager('botten', () => sken(li, x, 0.024, z, 0.7, 0.7, 0.22, false, 0.5));   // håller sig inom rummets väggar
  });
}
// Infälld spot (taklagret).
// Tunn vit ring, mörk kant och en lins; ljuskäglan på väggen intill (om den är fri)
// läggs sist, när möblerna finns.
function spot(x, z) {
  let li = null;
  iLager('tak', () => {
    const t = takVid(x, z);
    const [rx, rz] = takLut(x, z);
    // infälld downlight: tunn vit krage med fasad kant mot taket, en försänkt reflektor i
    // borstat stål (kort kon upp mot linsen) och en lins som glöder när lampan är tänd och är
    // matt ljusgrå när den är släckt (förr en platt ring och en platt skiva: ett klistermärke)
    ton('#f4f2ee', () => lagg('vagg', new T.LatheGeometry([[0.033, 0.001], [0.035, -0.0035], [0.0435, -0.0045], [0.0465, -0.0025], [0.047, 0.001]].map(q => new T.Vector2(q[0], q[1])), 28), mx(x, t, z, 0, rx, rz)));
    ton('#d8d6d1', () => lagg('diskstal', new T.LatheGeometry([[0.0335, -0.0042], [0.0285, -0.0018], [0.0235, 0.0004]].map(q => new T.Vector2(q[0], q[1])), 24), mx(x, t, z, 0, rx, rz)));
    li = egenLampa('Spotlights', [x, t - 0.011, z], () => ton('#cfcac3', () => lagg('lampa', new T.CircleGeometry(0.024, 20).rotateX(PI / 2), mx(x, t - 0.0002, z, 0, rx, rz))), true, [[x, t - 0.03, z, 0.3]]);   // gloria vid varje spot
  });
  EFTER.push(() => spotKagla(li, x, z));
}
function spotKagla(li, x, z) {
  const t = takVid(x, z), XA = -HH.L / 2 + I, XB = HH.L / 2 - I, ZA = -HH.W / 2 + I, ZB = HH.W / 2 - I;
  const K = [[x - XA, XA, z, 1, 0, true], [XB - x, XB, z, -1, 0, true], [z - ZA, x, ZA, 0, 1, true], [ZB - z, x, ZB, 0, -1, true]];
  VAGGAR.forEach(w => {
    if (w.bunn > 0) return;
    const s = w.axel === 'x' ? x : z, q = w.axel === 'x' ? z : x;
    if (s < w.lo + 0.35 || s > w.hi - 0.35 || w.hal.some(h => s > h.a - 0.4 && s < h.b + 0.4)) return;
    const sd = Math.sign(q - w.c) || 1, f = w.c + sd * w.t / 2;
    K.push(w.axel === 'x' ? [sd * (q - f), x, f, 0, sd, false] : [sd * (q - f), f, z, sd, 0, false]);
  });
  K.sort((a, b) => a[0] - b[0]);
  const [d, fx, fz, nx, nz, ytter] = K[0];
  if (!(d > 0.12 && d < 0.62)) return;
  // inga fönster eller dörrar där käglan landar, och inga möbler framför
  if (ytter && HAL.some(h => { if (Math.abs(h.f.n.x + nx) > 0.5 || Math.abs(h.f.n.z + nz) > 0.5) return false;
    const pa = h.f.o.clone().addScaledVector(h.f.u, h.u0), pb = h.f.o.clone().addScaledVector(h.f.u, h.u1), s = nx ? z : x, a = nx ? pa.z : pa.x, b = nx ? pb.z : pb.x;
    return s > Math.min(a, b) - 0.4 && s < Math.max(a, b) + 0.4; })) return;
  const ax = fx + nx * 0.3, az = fz + nz * 0.3, r = 0.42;
  if (HINDER.some(h => h.typ === 'mobel' && h.niva !== 'loft' && h.x1 > ax - r && h.x0 < ax + r && h.z1 > az - r && h.z0 < az + r)) return;
  const bad = BADRUM.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1), ut = bad ? 0.019 : 0.004;
  iLager('botten', () => sken(li, fx + nx * ut, t - 0.02 - 0.6, fz + nz * ut, 0.62, 1.2, 0.5, true, 0, true, Math.atan2(nx, nz)));
}

// Köksinredning längs en vägg. axel: vilken axel bänken löper längs, vagg: väggens
// koordinat (baksidan), ut: +1/-1 framsidans riktning, s0..s1: utsträckning.
// hog/over/hylla: [[a, b]] i världskoordinater längs bänken, spis/disk: mittpunkt.
function kok(k) {
  const sc = (k.s0 + k.s1) / 2, len = Math.abs(k.s1 - k.s0);
  const ry = k.axel === 'z' ? (k.ut > 0 ? PI / 2 : -PI / 2) : (k.ut > 0 ? 0 : PI);
  const ex = Math.cos(ry), ez = -Math.sin(ry);
  const lx = s => (s - sc) * (k.axel === 'x' ? ex : ez);
  const span = ([a, b]) => { const p = lx(a), q = lx(b); return [Math.min(p, q), Math.max(p, q)]; };
  const cx = k.axel === 'x' ? sc : k.vagg + k.ut * 0.3, cz = k.axel === 'x' ? k.vagg + k.ut * 0.3 : sc;
  med(cx, cz, ry, () => {
    skugga(0, 0.02, len, 0.62, 0, 0.16, 0.5);
    hind(len, 0.62);
    const hog = (k.hog || []).map(span);
    let reg = [[-len / 2, len / 2]];
    hog.forEach(([a, b]) => {
      reg = reg.flatMap(([p, q]) => {
        const ut = [];
        if (a > p) ut.push([p, Math.min(a, q)]);
        if (b < q) ut.push([Math.max(b, p), q]);
        return ut;
      }).filter(r => r[1] - r[0] > 0.05);
    });
    const HX = 0.235, HZ0 = -0.15, HZ1 = 0.21;   // diskhons hål
    // hon centreras i det bänkskåp den hamnar i, så att den ryms helt i skåpets stomme
    let dx = k.disk != null ? lx(k.disk) : null;
    if (dx != null) {
      let bast = null;
      reg.forEach(([p, q]) => { const n = Math.max(1, Math.round((q - p) / 0.6)), w = (q - p) / n; for (let i = 0; i < n; i++) { const c = p + w * (i + 0.5); if (w >= 2 * HX + 0.04 && (bast == null || Math.abs(c - dx) < Math.abs(bast - dx))) bast = c; } });
      dx = bast;
    }
    let sx0 = k.spis != null ? lx(k.spis) : null;
    // hällen (och ugnen under) centreras i det bänkskåp den hamnar i
    if (sx0 != null) reg.forEach(([p, q]) => { const n = Math.max(1, Math.round((q - p) / 0.6)), w = (q - p) / n; for (let i = 0; i < n; i++) { const c = p + w * (i + 0.5); if (Math.abs(c - sx0) < w / 2) sx0 = c; } });
    // men minst 5 cm luft mellan hällen (58 cm) och bänkens ände (högskåp, vägg eller dörr)
    if (sx0 != null) reg.forEach(([p, q]) => { if (sx0 > p && sx0 < q && q - p > 0.7) sx0 = Math.min(Math.max(sx0, p + 0.34), q - 0.34); });
    // diskmaskinen bredvid diskbänksskåpet (bort från hällen); blindhörn där en annan bänk möter
    let dmX = null;
    const blX = k.blind != null ? lx(k.blind) : null;
    if (dx != null) {
      const c = [];
      reg.forEach(([p, q]) => { const n = Math.max(1, Math.round((q - p) / 0.6)), w = (q - p) / n; for (let i = 0; i < n; i++) { const x = p + w * (i + 0.5); if (Math.abs(Math.abs(x - dx) - w) < 0.03 && !(sx0 != null && Math.abs(x - sx0) < w / 2) && !(blX != null && Math.abs(x - blX) < w / 2)) c.push(x); } });
      c.sort((a, b) => (sx0 != null ? Math.abs(b - sx0) - Math.abs(a - sx0) : 0));
      dmX = c[0] ?? null;
    }
    reg.forEach(([p, q]) => {
      const L2 = q - p, n = Math.max(1, Math.round(L2 / 0.6)), w = L2 / n;
      // indragen sockel
      ton('#55534f', () => box('vit', L2, 0.1, 0.5, (p + q) / 2, 0.05, -0.05));   // grafit
      for (let i = 0; i < n; i++) {
        const x = p + w * (i + 0.5), ho = dx != null && Math.abs(x - dx) < w / 2;
        const ugn = !ho && sx0 != null && Math.abs(x - sx0) < w / 2 && w >= 0.54, dm = !ho && !ugn && dmX != null && Math.abs(x - dmX) < 1e-6;
        const bl = !ho && blX != null && Math.abs(x - blX) < w / 2;
        if (ugn) { ugnEnhet(x, w); continue; }
        // små kök utan högskåp (k.kyl === 'under'): integrerad bänkkyl med frysfack i stället
        if (dm) { if (k.kyl === 'under') kylUnder(x, w); else diskmaskin(x, w); continue; }
        // stomme (lägre under diskhon) och separata luckor och lådor med 3 mm skuggfog
        const st = ho ? 0.7 : 0.87;
        // stommens framkant i z 0,27 = luckornas baksida (ingen glipa bakom luckan)
        stomme('front', w - 0.002, 0.77, 0.565, x, 0.1, -0.0125, null, { hyllor: ho ? [] : [0.4], utanTak: true, gangjarn: [[i % 2 ? 1 : -1, 0.2, 0.6]] });
        if (ho) ton(BJORK, () => box('front', w - 0.04, 0.04, 0.018, x, 0.848, 0.245));
        if (!ho) ton(BJORK, () => box('front', w - 0.04, 0.018, 0.55, x, 0.701, -0.02));
        if (!bl) bankInnehall(w, x, i, ho, 0.118, 0.409, -0.03);
        if (!ho && !bl) {
          // utdragbar låda: front, handtag och lådkorg följer med
          oppningsbar('Låda', 'lada', 'z', 0.38, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(x, 0.787, 0.2795)), () => {
            rbx('front', w - 0.004, 0.164, 0.019, 0, 0, 0, 0.004, 0, 0, 1);
            ton('#2a2928', () => rbx('vit', Math.min(0.26, w * 0.45), 0.012, 0.02, 0, 0.033, 0.019, 0.005, 0, 0, 1));
            ton('#e9e6df', () => {
              box('vit', w - 0.07, 0.01, 0.44, 0, -0.06, -0.235);
              for (const sx of [-1, 1]) box('vit', 0.012, 0.11, 0.44, sx * (w / 2 - 0.04), -0.01, -0.235);
              box('vit', w - 0.07, 0.11, 0.012, 0, -0.01, -0.45);
            });
            ladaInnehall(w, i);
          });
        } else {
          rbx('front', w - 0.004, 0.164, 0.019, x, 0.787, 0.2795, 0.004, 0, 0, 1);
          // (diskbänksskåpets fasta övre front har inget eget handtag: ett handtag per lucka)
        }
        // blindhörnet: fast lucka utan handtag (den andra bänken ligger framför)
        if (bl) { rbx('front', w - 0.004, 0.592, 0.019, x, 0.4005, 0.2795, 0.004, 0, 0, 1); continue; }
        // underskåpets lucka med grepplist i överkant: gångjärn växelvis vänster/höger
        {
          const hs = i % 2 ? -1 : 1, Xa = V(hs, 0, 0), Za = V(0, 0, 0).crossVectors(Xa, V(0, 1, 0)), zs = Za.z;
          // gångjärnet mitt i luckans kant (i plan): öppen lucka ligger an mot stommens framkant
          const m = BAS.clone().multiply(new T.Matrix4().makeBasis(Xa, V(0, 1, 0), Za).setPosition(x - hs * (w / 2 - 0.002 - 0.0095), 0, 0.2795));
          oppningsbar(ho ? 'Diskbänksskåp' : 'Underskåp', 'lucka', 'y', (zs < 0 ? 1 : -1) * 1.55, 0, m, () => forskjut(-0.0095, 0, zs * 0.0095, () => {
            rbx('front', w - 0.004, 0.592, 0.019, (w - 0.004) / 2, 0.4005, -zs * 0.0095, 0.004, 0, 0, 1);
            // ett handtag per lucka (den mörka grepplisten i överkant såg ut som ett andra handtag)
            ton('#2a2928', () => rbx('vit', 0.014, 0.16, 0.02, w - 0.054, 0.6, zs * 0.0095, 0.005, 0, 0, 1));
          }));
        }
      }
      // gavlar i frontens färg där bänken slutar fritt (inte mot ett högskåp)
      for (const [e, sd] of [[p, 1], [q, -1]]) if (!hog.some(([a, b]) => Math.abs(a - e) < 0.01 || Math.abs(b - e) < 0.01)) ton(GAVEL, () => rbx('front', 0.019, 0.862, 0.568, e + sd * 0.0065, 0.435, -0.016, 0.003, 0, 0, 1));
      // bänkskiva 3,4 cm med rundad framkant; urtag för diskhon
      {
        const b = 0.004, s = new T.Shape();
        s.moveTo(p + b, -0.303 + b); s.lineTo(q - b, -0.303 + b); s.lineTo(q - b, 0.327 - b); s.lineTo(p + b, 0.327 - b); s.lineTo(p + b, -0.303 + b);
        if (dx != null && dx > p && dx < q) s.holes.push(rundRektPath(dx, (HZ0 + HZ1) / 2, 2 * HX - 0.006, HZ1 - HZ0 - 0.006, 0.02, b));
        if (sx0 != null && sx0 - 0.3 > p + 0.01 && sx0 + 0.3 < q - 0.01) s.holes.push(rundRektPath(sx0, 0.02, 0.56, 0.49, 0.006, b));
        const g = new T.ExtrudeGeometry(s, { depth: 0.034 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
        g.rotateX(PI / 2).translate(0, 0.902 - b, 0);
        lagg('ek', g, mx(0, 0, 0));
      }
      // fog mot stänkskyddet
      ton('#8d857a', () => box('vagg', L2, 0.005, 0.005, (p + q) / 2, 0.904, -0.286));
      // stänkskydd av kakel
      ton('#e7e1d6', () => box('keramik', L2, 0.548, 0.012, (p + q) / 2, 0.902 + 0.274, -0.294));
      // riktiga plattor (15 x 7,5 cm, blank glasyr med fogar) framför underlaget
      {
        const g = new T.PlaneGeometry(L2, 0.546), uv = g.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * L2 / 0.3, uv.getY(j) * 0.546 / 0.15);
        ton('#efeae1', () => glans(0.6, () => lagg('kakel', g, mx((p + q) / 2, 0.902 + 0.274, -0.2873))));
      }
    });
    hog.forEach(([p, q], hi) => {
      const L2 = q - p, n = Math.max(1, Math.round(L2 / 0.6)), w = L2 / n;
      ton('#55534f', () => box('vit', L2, 0.1, 0.5, (p + q) / 2, 0.05, -0.06));   // grafit sockel
      for (let i = 0; i < n; i++) {
        const x = p + w * (i + 0.5);
        if (hi === 0 && i === 0) { kylFrys(x, w); continue; }
        // högskåp: skafferi med matvaror och en inbyggd mikrovågsugn i ögonhöjd
        skafferi(x, w);
      }
      // inklädnad upp mot taket, delad vid snittet så att genomskärningen blir ren
      // (takets lägsta punkt över just högskåpens fyra hörn, inte över kökets mitt: under ett
      // takfall gick inklädnaden annars upp i taket vid ytterväggen)
      let lagst = takVid(cx, cz);
      for (const hx of [p + 0.01, q - 0.01]) for (const hz of [-0.29, 0.29]) { const w = V(hx, 0, hz).applyMatrix4(BAS); lagst = Math.min(lagst, takVid(w.x, w.z)); }
      const ov = Math.min(2.6, lagst - 0.025), mitt = Math.min(ov, SNITT[0]);
      box('front', L2, Math.max(0.02, mitt - 2.09), 0.6, (p + q) / 2, (2.09 + mitt) / 2, 0);
      // delen över snittet följer takfallet: varje övre hörn stannar 2,5 cm under taket (högst 2,6 m)
      if (ov > SNITT[0] - 0.001) {
        const g = new T.BoxGeometry(L2, 1, 0.6), pp = g.attributes.position; let hogst = SNITT[0];
        for (let j = 0; j < pp.count; j++) {
          if (pp.getY(j) < 0) { pp.setY(j, SNITT[0]); continue; }
          const wv = V(pp.getX(j) * 0.98 + (p + q) / 2, 0, pp.getZ(j) * 0.98).applyMatrix4(BAS), yy = Math.max(SNITT[0] + 0.004, Math.min(2.6, takVid(wv.x, wv.z) - 0.025));
          pp.setY(j, yy); hogst = Math.max(hogst, yy);
        }
        g.computeVertexNormals();
        if (hogst > SNITT[0] + 0.02) iLager(lagerFor(hogst - 0.01), () => lagg('front', g, mx((p + q) / 2, 0, 0)));
      }
    });
    // allt på bänkskivan ligger 5 cm högre (bänken på 90 cm)
    const bas0 = BAS; BAS = BAS.clone().multiply(new T.Matrix4().makeTranslation(0, 0.05, 0));
    if (dx != null) {
      const x = dx;
      // nedsänkt ho i borstat stål, 18 cm djup: väggar, rundad botten, brunn, bräddavlopp och kant
      const hw = 2 * HX - 0.01, hd = HZ1 - HZ0 - 0.01, hz = (HZ0 + HZ1) / 2, d = 0.18, yb = 0.852 - d;
      ho(x, hz, hw + 0.004, hd + 0.004, d, 0.852);
      // rund sil i stål: ring, hålmönster och mittlock, i nivå med botten
      ton('#bdbdba', () => stal(new T.RingGeometry(0.03, 0.044, 32).rotateX(-PI / 2), mx(x + 0.06, yb + 0.0009, hz + 0.02), 'diskstal'));
      ton('#e0e0dd', () => stal(new T.CircleGeometry(0.016, 24).rotateX(-PI / 2), mx(x + 0.06, yb + 0.0012, hz + 0.02)));
      for (let i = 0; i < 12; i++) { const a = i * PI / 6; box('svart', 0.004, 0.0004, 0.004, x + 0.06 + Math.cos(a) * 0.024, yb + 0.001, hz + 0.02 + Math.sin(a) * 0.024); }
      // bräddavlopp: liten stålplatta med slits på bakre väggen
      stalBox(0.05, 0.018, 0.003, x, 0.852 - 0.035, hz - hd / 2 - 0.0005, 0.002);
      box('svart', 0.034, 0.004, 0.002, x, 0.852 - 0.035, hz - hd / 2 + 0.0012);

      // blandare i båge
      // köksblandare: rund kropp på skivan, pip i en jämn båge över hon, utdragbart munstycke, sidospak
      // (i borstat stål, inte svart)
      ton('#d4d4d1', () => {
      stal(new T.CylinderGeometry(0.026, 0.026, 0.008, 32), mx(x, 0.856, -0.22));
      stal(new T.CylinderGeometry(0.022, 0.022, 0.1, 32), mx(x, 0.91, -0.22));
      stal(new T.TubeGeometry(new T.CatmullRomCurve3([V(x, 0.95, -0.22), V(x, 1.12, -0.215), V(x, 1.19, -0.15), V(x, 1.15, -0.07), V(x, 1.1, -0.055)]), 40, 0.012, 16, false), mx(0, 0, 0));
      stal(new T.CylinderGeometry(0.017, 0.015, 0.055, 24), mx(x, 1.07, -0.052));
      stal(new T.CylinderGeometry(0.006, 0.006, 0.05, 12).rotateZ(PI / 2), mx(x + 0.035, 0.94, -0.22));
      stal(new T.SphereGeometry(0.008, 12, 8), mx(x + 0.06, 0.94, -0.22));
      });
      ton('#4a4b4d', () => cyl('vit', 0.006, 0.006, 0.002, x, 1.0418, -0.052, 16));   // munstyckets mynning i grafit
    }
    if (sx0 != null) hall(sx0);
    // fria bänkytor: bänkens delar minus hällen, hon (+5 cm) och höga skåp
    {
      const los0 = LOS; LOS = true;   // det som står på bänken är löst (tomt hus)
      let fri = reg.map(r => [r[0] + 0.03, r[1] - 0.03]);
      const bort = (a, b) => { fri = fri.flatMap(([p, q]) => [[p, Math.min(q, a)], [Math.max(p, b), q]]).filter(([p, q]) => q - p > 0.04); };
      // (hons verkliga läge dx, inte det önskade: annars räknades en bit av hon som fri bänk)
      if (dx != null) { bort(dx - HX - 0.06, dx + HX + 0.06); diskhorna(dx, 0.852, -0.236); }
      else if (k.disk != null) { const x = lx(k.disk); bort(x - HX - 0.06, x + HX + 0.06); }
      if (sx0 != null) kastrull(sx0 - 0.14, 0.8555, -0.08);
      if (sx0 != null) bort(sx0 - 0.29 - 0.05, sx0 + 0.29 + 0.05);
      if (k.horn != null) { const hx = lx(k.horn); bort(hx - 0.64, hx + 0.64); }
      // föremål i tur och ordning: bredd och hur de ställs ut
      const saker = [
        [0.12, xc => redskap(xc, 0.852, -0.228)],
        [0.3, xc => skarbrada(xc, 0.852)],
        [0.14, xc => basilika(xc, 0.852, -0.17)],
        [0.31, xc => fruktskal(xc, 0.852, 0.02)],
        [0.2, xc => { svarv('svart', [[0, 0], [0.075, 0], [0.085, 0.05], [0.075, 0.2], [0.04, 0.23], [0, 0.23]], xc, 0.852, -0.17, 24);
          lagg('svart', new T.TorusGeometry(0.06, 0.009, 6, 16, PI), mx(xc, 1.02, -0.24, PI / 2, 0, PI / 2)); box('svart', 0.03, 0.03, 0.07, xc, 1.03, -0.09, 0, -0.6); }],
        [0.24, xc => oljaOchKvarnar(xc - 0.07, 0.852, -0.2)],
        [0.3, xc => brodrost(xc, 0.852, -0.17)],
        [0.12, xc => pressbryggare(xc, 0.852, -0.18)],
        [0.23, xc => skalstapel(xc, 0.852, -0.14)],
        [0.18, xc => kokshandduk(xc, 0.852, 0.06)],
        [0.1, xc => mugg(xc, 0.852, 0.1, '#c8b9a2', 0.5)],
      ];
      const upptaget = [], tagen = new Set();   // höga föremål vid väggen (redskap, skärbräda) som knivlisten ska undvika
      // varje fri bänkyta fylls i tur och ordning med det som ryms (ett föremål som inte får
      // plats hoppas över, så att nästa mindre kan ta platsen); överbliven plats delas jämnt
      for (const iv of fri) {
        const val = []; let b = 0;
        saker.forEach((s, si) => { if (!tagen.has(si) && b + s[0] + (val.length ? 0.04 : 0) <= iv[1] - iv[0]) { b += s[0] + (val.length ? 0.04 : 0); val.push(si); tagen.add(si); } });
        const luft = Math.min(0.12, (iv[1] - iv[0] - b) / (val.length + 1));
        let a = iv[0] + luft;
        val.forEach(si => { const w = saker[si][0]; if (si < 2) upptaget.push([a - 0.02, a + w + 0.02]); saker[si][1](a + w / 2); a += w + 0.04 + luft; });
      }
      // magnetisk knivlist i ek med fyra knivar på stänkskyddet, inte över hällen eller hon
      {
        let bx = null;
        reg.forEach(([p, q]) => { for (let c = p + 0.25; c <= q - 0.25; c += 0.05) {
          if (sx0 != null && Math.abs(c - sx0) < 0.52) continue;
          if (dx != null && Math.abs(c - dx) < 0.42) continue;
          if (upptaget.some(([a, b]) => c + 0.22 > a && c - 0.22 < b)) continue;
          if (bx == null || (sx0 != null && Math.abs(c - sx0) < Math.abs(bx - sx0))) bx = c;
        } });
        if (bx != null) {
          const yk = 1.25, zk = -0.2873;
          ton('#b98b5c', () => rbx('ek', 0.4, 0.045, 0.018, bx, yk, zk + 0.009, 0.004, 0, 0, 1));
          [[-0.13, 0.2, 0.045], [-0.05, 0.16, 0.035], [0.04, 0.22, 0.04], [0.13, 0.12, 0.025]].forEach(([ox, L, b]) => {
            ton('#d8d9d7', () => stal(new T.BoxGeometry(b, L, 0.0025), mx(bx + ox, yk - L / 2 + 0.01, zk + 0.0195)));
            ton('#6b5a4a', () => rbx('ek', 0.024, 0.11, 0.018, bx + ox, yk + 0.075, zk + 0.0195 + 0.002, 0.006, 0, 0, 1));
          });
        }
      }
      LOS = los0;
    }
    BAS = bas0;
    flakt(k, sx0, span, cx, cz);
    (k.over || []).map(span).forEach(([p, q]) => {
      const L2 = q - p, n = Math.max(1, Math.ceil(L2 / 0.6 - 0.02)), w = L2 / n;
      for (let i = 0; i < n; i++) {
        const xc = p + w * (i + 0.5), hs = n > 1 && i === 0 ? -1 : n > 1 && i === n - 1 ? 1 : (i % 2 ? -1 : 1);   // ändluckorna har gångjärnet inåt (inte mot väggen)
        stomme('front', w - 0.006, 0.64, 0.32, xc, 1.455, -0.14, GAVEL, { hyllor: [1.775], gangjarn: [[-hs, 1.55, 2.0]] });
        overInnehall(w - 0.04, xc, 1.473, 1.784, -0.15);
        // luckan: gångjärn på motsatt sida om handtaget, öppnar utåt
        const Xa = V(hs, 0, 0), Za = V(0, 0, 0).crossVectors(Xa, V(0, 1, 0)), zs = Za.z;
        // gångjärnet mitt i luckans kant (i plan): öppen lucka ligger an mot stommens framkant
        const m = BAS.clone().multiply(new T.Matrix4().makeBasis(Xa, V(0, 1, 0), Za).setPosition(xc - hs * (w / 2 - 0.003 - 0.0095), 0, 0.0305));
        oppningsbar('Överskåp', 'lucka', 'y', (zs < 0 ? 1 : -1) * 1.55, 0, m, () => forskjut(-0.0095, 0, zs * 0.0095, () => {
          rbx('front', w - 0.006, 0.64, 0.019, (w - 0.006) / 2, 1.775, -zs * 0.0095, 0.004, 0, 0, 1);
          // handtaget nertill vid låskanten, helt inom luckan (luckan 1,455–2,095)
          ton('#2a2928', () => rbx('vit', 0.014, 0.18, 0.02, w - 0.053, 1.575, zs * 0.0095, 0.005, 0, 0, 1));
        }));
      }
      ton('#bdbab4', () => box('diskstal', L2, 0.008, 0.03, (p + q) / 2, 1.452, -0.2));   // aluminiumprofil
      const nb = Math.max(1, Math.round(L2 / 0.45)), bh = Array.from({ length: nb }, (_, i) => [p + (L2 / nb) * (i + 0.5), 1.435, -0.2, 0.2]);
      const bl = egenLampa('Bänkbelysning', [(p + q) / 2, 1.449, -0.2], () => box('lampa', L2 - 0.08, 0.004, 0.018, (p + q) / 2, 1.449, -0.2), false, bh);
      // mjuka ändar: skenet tonar ut ca 0,25 m förbi listen (ingen hård lodrät kant)
      sken(bl, (p + q) / 2, 0.9035, -0.13, L2 - 0.3, 0.22, 0.4, false, 0.24);
      sken(bl, (p + q) / 2, 1.18, -0.2865, L2 - 0.3, 0.36, 0.3, true, 0.26);
    });
    (k.hylla || []).map(span).forEach(([p, q]) => {
      const m = (p + q) / 2;
      rbx('ek', q - p, 0.03, 0.24, m, 1.55, -0.18, 0.005, 0, 0, 1);
      let a = p + 0.03; const put = (b, f) => { if (a + b <= q - 0.02) { f(a + b / 2); a += b + 0.03; } };
      put(0.15, c => slinga(c, 1.565, -0.22, true));
      put(0.15, c => ton('#dcd4c7', () => svarv('keramik', [[0, 0], [0.055, 0], [0.07, 0.05], [0.075, 0.09], [0, 0.09]], c, 1.565, -0.18, 40)));
      put(0.15, c => bocker(c - 0.075, 1.565, -0.2, 0, 4));
      put(0.1, c => ton('#8c8f80', () => svarv('keramik', [[0, 0], [0.045, 0], [0.05, 0.11], [0, 0.11]], c, 1.565, -0.2, 40)));
    });
  });
}

// Köksfläkt över hällen: utdragbar under ett överskåp, annars en väggkåpa med skorsten
// upp till taket (delad vid snittet). Lokalt i bänkens system, väggen vid z = -0,3.
function flakt(k, sx0, span, cx, cz) {
  if (sx0 == null) return;
  const under = (k.over || []).map(span).some(([p, q]) => sx0 > p + 0.15 && sx0 < q - 0.15);
  if (under) {
    ton('#c9c9c6', () => stalBox(0.6, 0.045, 0.3, sx0, 1.425, -0.15, 0.003));
    ton('#2c2e31', () => glans(0.25, () => rbx('keramik', 0.6, 0.03, 0.012, sx0, 1.418, 0.0055, 0.003, 0, 0, 1)));
    // fettfilter i borstat stål med lameller, två lampor och knappar på frontlisten
    ton('#bdbdba', () => { stalBox(0.5, 0.003, 0.24, sx0, 1.4015, -0.16, 0.001); for (let j = 0; j < 9; j++) stalBox(0.004, 0.002, 0.22, sx0 - 0.2 + j * 0.05, 1.3995, -0.16, 0.0008); });
    ton('#fff6e2', () => { for (const s of [-1, 1]) cyl('vit', 0.018, 0.018, 0.002, sx0 + s * 0.22, 1.4015, -0.02, 16); });
    ton('#c9c9c4', () => { for (let j = 0; j < 4; j++) box('vit', 0.012, 0.003, 0.001, sx0 + 0.16 + j * 0.03, 1.418, 0.0118); });
    return;
  }
  const wp = V(sx0, 0, -0.19).applyMatrix4(BAS), tt = takVid(wp.x, wp.z) - 0.002, y0 = 1.69, mid = Math.min(tt, SNITT[0]);
  ton('#c9c9c6', () => { stalBox(0.6, 0.05, 0.5, sx0, 1.545, -0.05, 0.004); stalBox(0.3, 0.12, 0.26, sx0, 1.63, -0.17, 0.004); stalBox(0.26, mid - y0, 0.22, sx0, (y0 + mid) / 2, -0.19, 0.003); });
  // fettfilter i borstat stål med lameller, två lampor och knappar på kåpans framkant
  ton('#bdbdba', () => { stalBox(0.52, 0.003, 0.42, sx0, 1.5185, -0.05, 0.001); for (let j = 0; j < 10; j++) stalBox(0.004, 0.002, 0.4, sx0 - 0.225 + j * 0.05, 1.5165, -0.05, 0.0008); });
  ton('#fff6e2', () => { for (const s of [-1, 1]) cyl('vit', 0.02, 0.02, 0.002, sx0 + s * 0.27, 1.5195, 0.17, 16); });
  ton('#55575a', () => { for (let j = 0; j < 4; j++) cyl('vit', 0.006, 0.006, 0.002, sx0 + 0.13 + j * 0.035, 1.545, 0.2008, 12, false, PI / 2); });
  if (tt > SNITT[0] + 0.02) iLager(lagerFor(tt - 0.01), () => ton('#c9c9c6', () => stalBox(0.26, tt - SNITT[0], 0.22, sx0, (SNITT[0] + tt) / 2, -0.19, 0.003)));
}
// Inbyggd ugn under hällen: mörkt ugnsrum, kontrollpanel i svart glas med två vred i
// stål och en display, och en nedfällbar lucka med fönster och handtag. Lokalt i bänken.
function ugnEnhet(x, w) {
  // ugnsrummet: ihålig låda i mörkgrå emalj (insidan syns, framsidan öppen), en varm
  // ugnslampa uppe i bakre hörnet och en plåt på nedre falsen
  {
    const g = new T.BoxGeometry(w - 0.04, 0.6, 0.5), ix = g.index.array, kvar = [];
    g.groups.forEach((gr, i) => { if (i !== 4) for (let k = gr.start; k < gr.start + gr.count; k += 3) kvar.push(ix[k], ix[k + 2], ix[k + 1]); });
    g.setIndex(kvar); g.clearGroups();
    const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k));
    ton('#45484c', () => glans(0.5, () => lagg('keramik', g, mx(x, 0.43, -0.04))));
    ton('#f3e2bf', () => lagg('vit', new T.CircleGeometry(0.018, 16), mx(x + (w - 0.04) / 2 - 0.05, 0.68, -0.288)));
    ton('#3a3b3e', () => stalBox(w - 0.1, 0.01, 0.42, x, 0.24, -0.05, 0.004));
  }
  // skåpstommen runt ugnen (frontens färg utanpå, grafit inuti) med stålfalsar för plåtarna
  stomme('front', w - 0.002, 0.77, 0.565, x, 0.1, -0.0125, null, { utanTak: true, inre: '#4a4c50' });
  ton('#bdbdba', () => { for (const s of [-1, 1]) for (const y of [0.24, 0.38, 0.52]) stal(new T.CylinderGeometry(0.003, 0.003, 0.44, 8).rotateX(PI / 2), mx(x + s * ((w - 0.04) / 2 - 0.006), y - 0.007, -0.05)); });
  // galler i krom på mittfalsen och en plåt med en form (ugnsform med potatisgratäng)
  ton('#cfcfcc', () => { for (let j = 0; j < 9; j++) stal(new T.CylinderGeometry(0.0025, 0.0025, 0.42, 6).rotateX(PI / 2), mx(x - (w - 0.11) / 2 + j * (w - 0.11) / 8, 0.375, -0.05)); stal(new T.CylinderGeometry(0.003, 0.003, w - 0.1, 6).rotateZ(PI / 2), mx(x, 0.375, 0.16)); stal(new T.CylinderGeometry(0.003, 0.003, w - 0.1, 6).rotateZ(PI / 2), mx(x, 0.375, -0.26)); });
  ton('#f1ece2', () => glans(0.4, () => rbx('keramik', 0.3, 0.06, 0.2, x, 0.408, -0.06, 0.012, 0, 0, 2)));
  ton('#d9a95f', () => rbx('vit', 0.28, 0.004, 0.18, x, 0.431, -0.06, 0.002, 0, 0, 1));
  // kontrollpanel i grafitglas (inte svart) med två vred i stål
  ton('#2c2e31', () => glans(0.25, () => rbx('keramik', w - 0.006, 0.12, 0.022, x, 0.8, 0.278, 0.004, 0, 0, 1)));
  for (const k of [-1, 1]) {
    ton('#b9b9b6', () => stal(new T.CylinderGeometry(0.019, 0.02, 0.018, 24).rotateX(PI / 2), mx(x + k * (w / 2 - 0.08), 0.8, 0.298)));
    ton('#55575a', () => box('vit', 0.003, 0.012, 0.002, x + k * (w / 2 - 0.08), 0.81, 0.3077));
    // symbolprickar runt vredet
    ton('#c9c9c4', () => { for (let j = 0; j < 5; j++) { const a = PI * (0.75 + j * 0.375); box('vit', 0.003, 0.003, 0.001, x + k * (w / 2 - 0.08) + Math.cos(a) * 0.03, 0.8 + Math.sin(a) * 0.03, 0.2895); } });
  }
  ton('#22424c', () => glans(0.3, () => box('keramik', 0.1, 0.03, 0.002, x, 0.8, 0.2899)));
  ton('#f0d7a8', () => { for (let j = 0; j < 4; j++) box('vit', 0.008, 0.012, 0.001, x - 0.025 + j * 0.016, 0.8, 0.2905); });
  oppningsbar('Ugnslucka', 'lucka', 'x', 1.45, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(x, 0.12, 0.279)), () => {
    ton('#2a2c2f', () => glans(0.25, () => rbx('keramik', w - 0.006, 0.6, 0.024, 0, 0.3, 0, 0.004, 0, 0, 1)));   // grafitglas
    // luckans insida: emaljerad kant och en inre glasruta
    ton('#45484c', () => glans(0.5, () => rbx('keramik', w - 0.06, 0.5, 0.004, 0, 0.3, -0.013, 0.003, 0, 0, 1)));
    ton('#2a2827', () => glans(0.2, () => box('keramik', w - 0.17, 0.3, 0.002, 0, 0.3, -0.0155)));
    platta('glas', w - 0.17, 0.3, mx(0, 0.3, -0.0168, PI), null, [1, 1]);
    ton('#3a322b', () => glans(0.2, () => box('keramik', w - 0.17, 0.3, 0.002, 0, 0.3, 0.0125)));
    platta('glas', w - 0.17, 0.3, mx(0, 0.3, 0.0138), null, [1, 1]);
    ton('#c9c9c6', () => {
      stal(new T.CylinderGeometry(0.009, 0.009, w - 0.12, 20).rotateZ(PI / 2), mx(0, 0.53, 0.046));
      for (const k of [-1, 1]) stal(new T.CylinderGeometry(0.006, 0.006, 0.036, 12).rotateX(PI / 2), mx(k * (w / 2 - 0.09), 0.53, 0.03));
    });
  });
}
// Integrerad diskmaskin: lucka i frontens färg (fälls ner), insida i stål och två korgar.
function diskmaskin(x, w) {
  ton('#cfcfcc', () => {
    stalBox(w - 0.04, 0.012, 0.52, x, 0.12, -0.03); stalBox(w - 0.04, 0.012, 0.52, x, 0.83, -0.03);
    for (const s of [-1, 1]) stalBox(0.012, 0.7, 0.52, x + s * (w / 2 - 0.026), 0.475, -0.03);
    stalBox(w - 0.04, 0.7, 0.012, x, 0.475, -0.284);
  });
  // korgar av plastbelagd tråd i ljusgrått på hjul, med tallrikar, skålar och glas
  ton('#b9bcbe', () => { for (const y of [0.22, 0.52]) {
    for (let j = 0; j < 9; j++) cyl('vit', 0.0025, 0.0025, w - 0.07, x, y, -0.25 + j * 0.055, 6, false, 0, PI / 2);
    for (const s of [-1, 1]) { cyl('vit', 0.0025, 0.0025, 0.46, x + s * (w / 2 - 0.036), y + 0.06, -0.04, 6, false, PI / 2); box('vit', 0.003, 0.06, 0.46, x + s * (w / 2 - 0.036), y + 0.03, -0.04); }
    cyl('vit', 0.0025, 0.0025, w - 0.07, x, y + 0.06, 0.19, 6, false, 0, PI / 2);
    for (const s of [-1, 1]) for (const z of [-0.22, 0.14]) cyl('vit', 0.012, 0.012, 0.008, x + s * (w / 2 - 0.04), y - 0.012, z, 12, false, 0, PI / 2);
  } });
  // spolarmar i grått under korgarna
  ton('#a9acae', () => { box('vit', w - 0.16, 0.012, 0.03, x, 0.165, -0.04); box('vit', w - 0.2, 0.01, 0.025, x, 0.48, -0.04); cyl('vit', 0.02, 0.02, 0.02, x, 0.165, -0.04, 12); });
  // nedre korgen: tallrikar på högkant i ställ och två skålar
  ton('#f3f1ec', () => { for (let j = 0; j < 6; j++) lagg('keramik', new T.CylinderGeometry(0.11, 0.1, 0.012, 24).rotateZ(PI / 2), mx(x - 0.1 + j * 0.035, 0.335, -0.09)); });
  ton('#d9d2c6', () => { for (let j = 0; j < 2; j++) svarv('keramik', [[0, 0], [0.04, 0], [0.07, 0.05], [0.064, 0.05], [0.035, 0.008], [0, 0.008]], x + 0.17, 0.235 + j * 0.008, 0.08 - j * 0.02, 20); });
  // övre korgen: glas upp och ner och muggar
  for (let j = 0; j < 6; j++) lagg('glas', new T.CylinderGeometry(0.031, 0.036, 0.1, 16, 1, true), mx(x - 0.16 + (j % 3) * 0.08, 0.575, -0.14 + Math.floor(j / 3) * 0.1));
  ton('#c8b9a2', () => { for (let j = 0; j < 2; j++) lagg('keramik', new T.CylinderGeometry(0.04, 0.038, 0.09, 18), mx(x + 0.13, 0.57, -0.12 + j * 0.11)); });
  oppningsbar('Diskmaskin', 'lucka', 'x', 1.45, 0, BAS.clone().multiply(new T.Matrix4().makeTranslation(x, 0.105, 0.2795)), () => {
    rbx('front', w - 0.004, 0.762, 0.019, 0, 0.381, 0, 0.004, 0, 0, 1);
    ton('#2a2928', () => rbx('vit', Math.min(0.26, w * 0.45), 0.012, 0.02, 0, 0.715, 0.02, 0.005, 0, 0, 1));
    ton('#cfcfcc', () => stalBox(w - 0.06, 0.68, 0.008, 0, 0.38, -0.0135, 0.002));
    // knappar och display på luckans överkant (integrerad maskin) och diskmedelsfack på insidan
    ton('#3d3f42', () => box('vit', w - 0.08, 0.003, 0.012, 0, 0.7625, -0.002));
    ton('#d7dadb', () => { for (let j = 0; j < 6; j++) cyl('vit', 0.003, 0.003, 0.0012, -0.14 + j * 0.035, 0.7642, -0.002, 10); });
    ton('#7fc4d6', () => box('vit', 0.04, 0.0008, 0.006, 0.12, 0.7645, -0.002));
    ton('#e6e6e3', () => rbx('vit', 0.11, 0.07, 0.012, 0.08, 0.5, -0.022, 0.004, 0, 0, 1));
  });
}
// Kyl/frys i högskåpet (integrerad, 60 cm): skåpstomme med vit liner, glashyllor,
// grönsakslådor, belysning och matvaror; kylens lucka med dörrfack (flaskor, såser, ägg)
// och frysens lucka framför tre lådor. Gångjärn till vänster, stålhandtag till höger.
// Luckorna sitter i stommens framkant (z 0,281) och vrids kring gångjärnet.
const KYLVIT = '#f3f3f1';
function kylFrys(x, w) {
  const W = w - 0.006, wi = W - 0.036, xe = x - W / 2;
  stomme('front', W, 1.99, 0.58, x, 0.1, -0.01, GAVEL, { inre: KYLVIT });
  // mellanbotten mellan kyl och frys, bakvägg, belysning och termostat under taket
  ton(KYLVIT, () => box('vit', wi, 0.04, 0.56, x, 0.82, -0.02));
  ton('#e9e9e6', () => box('vit', wi - 0.04, 1.0, 0.004, x, 1.45, -0.288));
  ton('#fffdf6', () => box('vit', wi - 0.1, 0.01, 0.05, x, 2.067, 0.05));
  ton('#d9dbdc', () => box('vit', 0.12, 0.03, 0.008, x + wi / 2 - 0.09, 2.057, 0.1));
  ton('#7fb7c9', () => box('vit', 0.03, 0.012, 0.001, x + wi / 2 - 0.09, 2.057, 0.1045));
  kylInne(x, wi, 0.84, [1.07, 1.35, 1.63], 0.14, ['rester', 'mejeri', 'burkar']);
  frysInne(x, wi, 0.118, 0.8);
  kylLucka('Kylskåp', xe, 1, 0.281, W, 0.82, 2.09, { fack: [[1.0, 'flaskor'], [1.4, 'saser'], [1.8, 'agg']], handtag: [0.88, 1.36] });
  kylLucka('Frys', xe, 1, 0.281, W, 0.105, 0.8, { handtag: [0.52, 0.76] });
}
// Integrerad bänkkyl med frysfack (små kök): bakom en lucka i frontens färg, i bänkens rad.
function kylUnder(x, w) {
  const W = w - 0.004, wi = w - 0.002 - 0.036, xe = x - W / 2;
  stomme('front', w - 0.002, 0.77, 0.565, x, 0.1, -0.0125, null, { utanTak: true, inre: KYLVIT });
  ton(KYLVIT, () => box('vit', wi, 0.018, 0.56, x, 0.861, -0.015));
  // frysfack upptill med en frostad lucka och ett grepp
  ton('#e6e9eb', () => { box('vit', wi - 0.01, 0.008, 0.4, x, 0.704, -0.08); rbx('vit', wi - 0.02, 0.14, 0.01, x, 0.775, 0.125, 0.003, 0, 0, 1); });
  ton('#cfd3d6', () => box('vit', 0.12, 0.014, 0.012, x, 0.835, 0.134));
  ton('#fffdf6', () => box('vit', wi - 0.12, 0.008, 0.04, x, 0.696, 0.05));
  kylInne(x, wi, 0.118, [0.33, 0.53], 0.13, ['rester', 'burkar']);
  kylLucka('Kylskåp', xe, 1, 0.27, W, 0.105, 0.867, { fack: [[0.2, 'flaskor'], [0.5, 'agg']], grepp: 0.82 });
}
// kylens insida: glashyllor med vit framlist, grönsakslådor nederst och varor på hyllorna
function kylInne(x, wi, yb, hyllor, zf, varor) {
  hyllor.forEach(y => {
    box('glas', wi - 0.004, 0.005, zf + 0.285, x, y, (zf - 0.285) / 2);
    ton('#e2e3e1', () => {
      box('vit', wi - 0.004, 0.014, 0.012, x, y - 0.002, zf + 0.006);
      for (const s of [-1, 1]) box('vit', 0.006, 0.01, zf + 0.285, x + s * (wi / 2 - 0.003), y - 0.008, (zf - 0.285) / 2);
    });
  });
  // grönsakslådor: glasfront med greppkant och en mellanvägg
  const hc = hyllor[0] - yb - 0.012;
  box('glas', wi - 0.012, hc, 0.004, x, yb + hc / 2, zf - 0.03);
  ton('#e2e3e1', () => { box('vit', wi - 0.012, 0.016, 0.01, x, yb + hc - 0.012, zf - 0.03); box('vit', 0.004, hc, 0.38, x, yb + hc / 2, zf - 0.22); box('vit', wi - 0.012, 0.004, 0.4, x, yb + 0.002, zf - 0.22); });
  gronsaker(x - wi / 4, x + wi / 4, yb + 0.004);
  dampat(0.32, () => hyllor.forEach((y, j) => varor[j] && hyllvaror(varor[j], x - wi / 2, wi, y + 0.0025)));
}
// Grönsakslådans innehåll: sallad, gurka, tomater och paprika till vänster; äpplen,
// citroner och morötter till höger. y = lådans botten.
function gronsaker(xl, xr, y) {
  const S = (r, sx = 1, sy = 1, sz = 1) => new T.SphereGeometry(r, 12, 8).scale(sx, sy, sz);
  ton('#8db25a', () => lagg('keramik', S(0.068, 1, 0.75, 1), mx(xl - 0.06, y + 0.05, -0.17)));
  ton('#a9c873', () => lagg('keramik', S(0.05, 1.1, 0.7, 1), mx(xl - 0.07, y + 0.085, -0.17)));
  ton('#3f6b35', () => lagg('keramik', new T.CapsuleGeometry(0.021, 0.25, 4, 10).rotateX(PI / 2), mx(xl + 0.085, y + 0.021, -0.12)));
  ton('#c8432f', () => { for (const [dx, dz] of [[-0.1, 0.06], [-0.04, 0.07], [-0.1, 0.0]]) lagg('keramik', S(0.027, 1, 0.82, 1), mx(xl + dx, y + 0.022, dz)); });
  [['#d8a23a', 0.025, 0.06], ['#b8322a', 0.02, -0.03]].forEach(([fg, dx, dz]) => ton(fg, () => lagg('keramik', S(0.038, 1, 1.05, 1), mx(xl + dx, y + 0.04, dz))));
  ['#a8362e', '#b8452f', '#8fae4a'].forEach((fg, j) => ton(fg, () => lagg('keramik', S(0.034, 1, 0.9, 1), mx(xr - 0.08 + j * 0.075, y + 0.031, -0.16 + (j % 2) * 0.03))));
  ton('#e8c64a', () => { for (let j = 0; j < 2; j++) lagg('keramik', S(0.028, 1.3, 1, 1), mx(xr - 0.05 + j * 0.085, y + 0.028, -0.05)); });
  for (let j = 0; j < 4; j++) {
    ton('#e07a2e', () => lagg('vit', new T.ConeGeometry(0.013, 0.17, 8).rotateZ(PI / 2), mx(xr, y + 0.014 + (j > 2 ? 0.024 : 0), 0.035 + (j % 3) * 0.026)));
    ton('#6f8f4a', () => lagg('vit', new T.ConeGeometry(0.01, 0.05, 6).rotateZ(-PI / 2), mx(xr + 0.11, y + 0.014 + (j > 2 ? 0.024 : 0), 0.035 + (j % 3) * 0.026)));
  }
}
// varor på en kylhylla; L = vänstra innerväggen, b = innerbredd, y = hyllans ovansida
function hyllvaror(typ, L, b, y) {
  if (typ === 'mejeri') {
    mjolk(L + 0.05, y, -0.2, '#2f6f9a');
    mjolk(L + 0.13, y, -0.2, '#c9472f');
    mjolk(L + 0.21, y, -0.19, '#5b8f5a', 0.15);
    ost(L + 0.32, y, -0.04);
    smor(L + 0.46, y, -0.04);
    for (let j = 0; j < 2; j++) yoghurt(L + b - 0.11 + j * 0.065, y, -0.2, ['#e9e2f0', '#f3e3c4'][j]);
  } else if (typ === 'rester') {
    // matlåda i glas med lock och mat, köttbricka med plastfilm, täckt skål
    lagg('glas', new T.BoxGeometry(0.18, 0.07, 0.13), mx(L + 0.11, y + 0.035, -0.15));
    ton('#c98a4a', () => box('vit', 0.17, 0.035, 0.12, L + 0.11, y + 0.019, -0.15));
    ton('#5f8a8a', () => rbx('vit', 0.186, 0.014, 0.136, L + 0.11, y + 0.077, -0.15, 0.004, 0, 0, 1));
    ton('#ece8e0', () => box('vit', 0.2, 0.022, 0.14, L + 0.33, y + 0.011, 0.0));
    ton('#b5533f', () => glans(0.5, () => box('keramik', 0.17, 0.018, 0.11, L + 0.33, y + 0.022, 0.0)));
    lagg('glas', new T.BoxGeometry(0.2, 0.004, 0.14), mx(L + 0.33, y + 0.034, 0.0));
    ton('#e8e2d8', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.04, 0], [0.068, 0.05], [0.072, 0.07], [0.068, 0.07], [0.064, 0.052], [0.038, 0.006], [0, 0.006]], L + b - 0.09, y, -0.17, 20)));
    ton('#d9b25a', () => cyl('vit', 0.062, 0.062, 0.004, L + b - 0.09, y + 0.05, -0.17, 18));
    lagg('glas', new T.CylinderGeometry(0.073, 0.073, 0.002, 20), mx(L + b - 0.09, y + 0.071, -0.17));
  } else if (typ === 'burkar') {
    burk(L + 0.06, y, -0.18, 0.034, 0.1, '#7a2a3a', '#d8c79a', true);
    burk(L + 0.15, y, -0.16, 0.04, 0.12, '#8a9a3a', '#c9c9c6', true);
    for (let j = 0; j < 3; j++) yoghurt(L + 0.25 + j * 0.07, y, -0.03, ['#f1e6c8', '#e5eef1', '#f0dede'][j]);
    flaska(L + b - 0.07, y, -0.18, 0.028, 0.14, '#e6dcc0', '#3a6aa0');
    ton('#e9e1cf', () => rbx('vit', 0.09, 0.05, 0.07, L + b - 0.08, y + 0.025, -0.05, 0.008, 0, 0, 1));   // pålägg i ask
    ton('#c94f3d', () => box('vit', 0.091, 0.012, 0.071, L + b - 0.08, y + 0.044, -0.05));
  }
}
// ---- Matvaror: små förpackningar i låg upplösning (slås ihop med inredningen) ----
// (x, y, z) = mitten av botten. Färgerna är dämpade, inga svarta ytor.
// Förpackningarnas färger dämpas mot varmt gråbeige: tryckta kartonger och etiketter i
// jordnära toner i stället för leksaksklara röda, blå och gula klossar.
const damp = (hex, t = 0.5) => '#' + new T.Color(hex).lerp(new T.Color('#c3b9a8'), t).getHexString();
// Takåspaket (mjölk, juice): kartong med rundade hörn, ett tryckfält i dämpad ton nedtill,
// vikt takås med svetsfog och en skruvkork på ena takfallet.
function mjolk(x, y, z, fg = '#2f6f9a', h = 0.19, b = 0.07) {
  fg = damp(fg, 0.42);
  ton('#eeeae0', () => rbx('vit', b, h, b, x, y + h / 2, z, 0.005, 0, 0, 1));
  ton(fg, () => svarvFyrkant(b / 2 + 0.0008, h * 0.12, h * 0.5, x, y, z));
  const s = new T.Shape(); s.moveTo(-b / 2 + 0.003, 0); s.lineTo(b / 2 - 0.003, 0); s.lineTo(0.002, 0.03); s.lineTo(-0.002, 0.03); s.lineTo(-b / 2 + 0.003, 0);
  ton('#eeeae0', () => lagg('vit', new T.ExtrudeGeometry(s, { depth: b - 0.006, bevelEnabled: false }).translate(0, 0, -b / 2 + 0.003), mx(x, y + h - 0.003, z)));
  ton('#e2ddd0', () => box('vit', 0.004, 0.014, b - 0.004, x, y + h + 0.033, z));   // svetsfogen i nocken
  ton(damp(fg, 0.3), () => lagg('vit', new T.CylinderGeometry(0.011, 0.011, 0.01, 10), mx(x - b * 0.23, y + h + 0.017, z, 0, 0, 0.85)));
}
// tunn manschett med fyrkantigt tvärsnitt (tryckfält runt en kartong), y0..y1 över botten
function svarvFyrkant(r, y0, y1, x, y, z) {
  lagg('vit', new T.CylinderGeometry(r * Math.SQRT2, r * Math.SQRT2, y1 - y0, 4, 1, true).rotateY(PI / 4), mx(x, y + (y0 + y1) / 2, z));
}
function flaska(x, y, z, r, h, fg, kork = '#e8e4da', mk = 'keramik') {
  fg = damp(fg, 0.3); kork = damp(kork, 0.35);
  ton(fg, () => glans(0.5, () => svarv(mk, [[0, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.8], [r * 0.38, h * 0.93], [0, h * 0.93]], x, y, z, 14)));
  ton(kork, () => cyl('vit', r * 0.42, r * 0.42, h * 0.08, x, y + h * 0.955, z, 10));
  // etikettfält i ljust papper runt flaskans rakaste del (ingen text)
  // (samma 14 segment och vridning som flaskan: annars skär fasetterna igenom som ränder)
  ton(ljusTon(fg, 0.78), () => svarv('vit', [[r + 0.0012, h * 0.2], [r + 0.0012, h * 0.48]], x, y, z, 14));
}
function burk(x, y, z, r, h, fg, lock = '#c9c9c6', glasburk = false) {
  fg = damp(fg, 0.35);
  // etikettfält i ljust papper mitt på burken (ingen text)
  ton(ljusTon(fg, 0.72), () => lagg('vit', new T.CylinderGeometry(r + 0.0008, r + 0.0008, h * 0.34, 16, 1, true), mx(x, y + h * 0.4, z)));
  if (glasburk) {
    lagg('glas', new T.CylinderGeometry(r, r, h * 0.88, 16, 1, true), mx(x, y + h * 0.44, z));
    ton(fg, () => cyl('vit', r - 0.003, r - 0.003, h * 0.72, x, y + h * 0.36 + 0.001, z, 14));
  } else ton(fg, () => cyl('vit', r, r, h * 0.88, x, y + h * 0.44, z, 14));
  ton(lock, () => cyl('vit', r * 1.04, r * 1.04, h * 0.12, x, y + h * 0.94, z, 16));
}
// Konservburk: bleckplåt med räfflor och falsad kant upptill och nedtill, pappersetikett
// i dämpad ton runt mitten (en enda svarvad form för plåten).
function konserv(x, y, z, fg) {
  const R = 0.037, P = [[0, 0], [R - 0.002, 0], [R, 0.002], [R, 0.006], [R - 0.0015, 0.009]];
  for (let k = 0; k < 4; k++) P.push([R - 0.0004, 0.02 + k * 0.022], [R - 0.0018, 0.031 + k * 0.022]);
  P.push([R - 0.0015, 0.101], [R, 0.104], [R, 0.108], [R - 0.002, 0.11], [R - 0.004, 0.107], [0, 0.107]);
  ton('#c4c4c0', () => lagg('spegel', new T.LatheGeometry(P.map(q => new T.Vector2(q[0], q[1])), 14), mx(x, y, z)));
  ton(damp(fg, 0.45), () => lagg('vit', new T.CylinderGeometry(R + 0.0003, R + 0.0003, 0.07, 14, 1, true), mx(x, y + 0.055, z)));
}
// Paket (flingor, pasta, mjöl): kartong med rundade hörn, ett ljusare fält och en vikt flik upptill.
function paket(x, y, z, b, h, d, fg, band = '#f2efe8') {
  fg = damp(fg, 0.45);
  ton(fg, () => rbx('vit', b, h, d, x, y + h / 2, z, Math.min(0.006, b * 0.12), 0, 0, 1));
  ton(damp(band, 0.25), () => box('vit', b + 0.0012, h * 0.24, d * 0.72, x, y + h * 0.58, z));
  ton(skiftTon(fg, 0.88), () => box('vit', b * 0.92, 0.004, d * 0.3, x, y + h + 0.001, z));
}
function yoghurt(x, y, z, fg) {
  ton(fg, () => cyl('vit', 0.036, 0.03, 0.075, x, y + 0.0375, z, 14));
  ton('#d9d9d4', () => cyl('spegel', 0.038, 0.038, 0.003, x, y + 0.0765, z, 14));
}
function ost(x, y, z) {
  ton('#e6c45a', () => rbx('vit', 0.13, 0.07, 0.09, x, y + 0.035, z, 0.008, 0, 0, 1));
  ton('#c9473b', () => box('vit', 0.06, 0.071, 0.091, x - 0.035, y + 0.0355, z));
}
function smor(x, y, z) {
  ton('#f1e7c4', () => rbx('vit', 0.11, 0.05, 0.075, x, y + 0.025, z, 0.008, 0, 0, 1));
  ton('#d8b64a', () => rbx('vit', 0.114, 0.012, 0.079, x, y + 0.05, z, 0.004, 0, 0, 1));
}
function agg(x, y, z) { ton('#e9dcc6', () => lagg('keramik', new T.SphereGeometry(0.021, 10, 8).scale(1, 1.28, 1), mx(x, y + 0.027, z))); }
// Kylens lucka: front i frontens färg, tätningslist, vit innerdörr med dörrfack och varor.
// o.fack: [[y, typ]], o.handtag: [y0, y1] (stålhandtag) eller o.grepp: y (vågrätt grepp).
function kylLucka(namn, xe, hs, zb, W, y0, y1, o = {}) {
  const t = 0.019, h = y1 - y0, ym = (y0 + y1) / 2;
  gangjarnsLucka(namn, xe, hs, zb, t, zs => {
    const Z = d => zs * d;   // framåt i världen räknat från luckans mitt
    rbx('front', W, h, t, W / 2, ym, 0, 0.004, 0, 0, 1);
    ton('#d2d2ce', () => rbx('vit', W - 0.04, h - 0.04, 0.009, W / 2, ym, Z(-0.014), 0.004, 0, 0, 1));
    ton(KYLVIT, () => rbx('vit', W - 0.06, h - 0.06, 0.022, W / 2, ym, Z(-0.0295), 0.006, 0, 0, 1));
    (o.fack || []).forEach(([yf, typ]) => {
      ton('#eeeeec', () => { box('vit', W - 0.09, 0.006, 0.08, W / 2, yf, Z(-0.0805)); for (const s of [-1, 1]) box('vit', 0.006, 0.05, 0.08, W / 2 + s * (W / 2 - 0.048), yf + 0.022, Z(-0.0805)); });
      box('glas', W - 0.09, 0.07, 0.004, W / 2, yf + 0.035, Z(-0.1185));
      ton('#dcdcd8', () => box('vit', W - 0.09, 0.01, 0.005, W / 2, yf + 0.07, Z(-0.1185)));
      dampat(0.32, () => dorrfack(typ, W, yf + 0.003, Z(-0.08)));
    });
    if (o.handtag) ton('#c9c9c6', () => {
      const [a, b] = o.handtag;
      stal(new T.CylinderGeometry(0.008, 0.008, b - a, 16), mx(W - 0.047, (a + b) / 2, Z(0.0345)));
      for (const y of [a + 0.02, b - 0.02]) stal(new T.CylinderGeometry(0.005, 0.005, 0.026, 10).rotateX(PI / 2), mx(W - 0.047, y, Z(0.0215)));
    });
    if (o.grepp != null) ton('#2a2928', () => rbx('vit', Math.min(0.26, W * 0.45), 0.012, 0.02, W / 2, o.grepp, Z(0.019), 0.005, 0, 0, 1));
  });
}
// dörrfackens innehåll (lokalt i luckan): flaskor och paket, såser och sylt, ägg och smör
function dorrfack(typ, W, y, z) {
  if (typ === 'flaskor') {
    mjolk(0.1, y, z, '#2f6f9a', 0.19, 0.066);
    mjolk(0.18, y, z, '#e08a2a', 0.19, 0.066);
    flaska(W - 0.17, y, z, 0.03, 0.25, '#5d7f5a', '#d9d4c8');
    flaska(W - 0.1, y, z, 0.032, 0.26, '#8a6a3a', '#c9c9c6');
  } else if (typ === 'saser') {
    flaska(0.09, y, z, 0.028, 0.19, '#b8322a', '#f2efe8');
    flaska(0.16, y, z, 0.025, 0.17, '#d9b23a', '#e9e1cf');
    burk(0.24, y, z, 0.034, 0.09, '#7a2a3a', '#d8c79a', true);
    flaska(W - 0.16, y, z, 0.024, 0.2, '#e6dcc0', '#5f8a5a');
    burk(W - 0.09, y, z, 0.032, 0.11, '#c98a3a', '#c9c9c6', true);
  } else if (typ === 'agg') {
    ton('#f0f0ee', () => box('vit', 6 * 0.044 + 0.01, 0.012, 0.055, 0.08 + 2.5 * 0.044, y + 0.006, z));
    for (let j = 0; j < 6; j++) agg(0.08 + j * 0.044, y + 0.006, z);
    smor(W - 0.11, y, z);
  }
}
// Frysens tre lådor (fasta i stommen bakom luckan) med frysta varor
function frysInne(x, wi, yb, yt) {
  const n = 3, hd = (yt - yb - 0.02) / n;
  for (let j = 0; j < n; j++) {
    const y0 = yb + 0.01 + j * hd, h = hd - 0.025, L = x - wi / 2 + 0.02, yy = y0 + 0.006;
    ton('#eef0f1', () => {
      box('vit', wi - 0.01, 0.006, 0.47, x, y0 + 0.003, -0.04);
      for (const s of [-1, 1]) box('vit', 0.006, h, 0.47, x + s * (wi / 2 - 0.008), y0 + h / 2, -0.04);
      box('vit', wi - 0.01, h, 0.006, x, y0 + h / 2, -0.272);
    });
    box('glas', wi - 0.01, h, 0.006, x, y0 + h / 2, 0.192);
    ton('#d5d9db', () => box('vit', wi - 0.01, 0.022, 0.012, x, y0 + h - 0.011, 0.192));
    // (frysta varor i dämpade toner: påsar, kartonger och en glasslåda)
    dampat(0.45, () => {
    if (j === 0) {
      ton('#3f7a46', () => rbx('tyg', 0.16, 0.045, 0.22, L + 0.09, yy + 0.0225, -0.1, 0.015, 0, 0, 2));
      ton('#e0b23a', () => rbx('tyg', 0.15, 0.04, 0.2, L + 0.12, yy + 0.065, -0.12, 0.015, 0.2, 0, 2));
      ton('#f0e6d2', () => rbx('vit', 0.17, 0.1, 0.12, L + wi - 0.15, yy + 0.05, -0.15, 0.01, 0, 0, 1));
      ton('#8a5a42', () => rbx('vit', 0.174, 0.012, 0.124, L + wi - 0.15, yy + 0.102, -0.15, 0.004, 0, 0, 1));
    } else if (j === 1) {
      for (let k = 0; k < 2; k++) paket(L + 0.15, yy + k * 0.035, -0.08, 0.26, 0.034, 0.26, ['#b8463a', '#d9a03a'][k], '#f2efe8');
      paket(L + wi - 0.1, yy, -0.15, 0.1, 0.05, 0.18, '#2f5f8a', '#e8c64a');
    } else {
      ton('#dfe8ee', () => rbx('vit', 0.11, 0.035, 0.26, L + 0.07, yy + 0.0175, -0.12, 0.006, 0, 0, 1));
      ton('#5b4a7a', () => rbx('tyg', 0.14, 0.05, 0.19, L + 0.24, yy + 0.025, -0.1, 0.018, 0, 0, 2));
      ton('#c73a4a', () => rbx('tyg', 0.13, 0.045, 0.17, L + 0.4, yy + 0.0225, -0.12, 0.018, 0.15, 0, 2));
    }
    });
  }
}
// Högskåp som skafferi: nedre lucka, en inbyggd mikrovågsugn i ögonhöjd och en övre lucka.
// Hyllor med torrvaror, konserver, flaskor och kryddor. Gångjärn till vänster.
function skafferi(x, w) {
  const W = w - 0.006, wi = W - 0.036, xe = x - W / 2, L = x - wi / 2 + 0.015;
  stomme('front', W, 1.99, 0.58, x, 0.1, -0.01, GAVEL, { hyllor: [0.42, 0.75, 1.1, 1.48, 1.78], gangjarn: [[-1, 0.25, 0.95, 1.6, 1.95]] });
  // golvet: potatiskorg, lök och en mjölpåse
  ton('#b9895c', () => rbx('tyg', 0.22, 0.12, 0.2, L + 0.12, 0.118 + 0.06, -0.12, 0.02, 0, 0, 2));
  ton('#c9a46a', () => { for (let j = 0; j < 5; j++) lagg('keramik', new T.SphereGeometry(0.034, 10, 8).scale(1.25, 0.9, 1), mx(L + 0.06 + (j % 3) * 0.055, 0.118 + 0.125 + Math.floor(j / 3) * 0.02, -0.15 + (j % 2) * 0.06)); });
  ton('#b8743a', () => { for (let j = 0; j < 3; j++) lagg('keramik', new T.SphereGeometry(0.033, 10, 8), mx(L + 0.29 + j * 0.065, 0.118 + 0.032, 0.05)); });
  paket(L + wi - 0.1, 0.118, -0.15, 0.13, 0.25, 0.09, '#efe7d6', '#3a6aa0');
  // 0,43: konserver, pastaburkar i glas och ris
  ['#b8322a', '#5f7a3a', '#d9a83a', '#c9673a'].forEach((fg, j) => konserv(L + 0.04 + (j % 2) * 0.08, 0.429 + Math.floor(j / 2) * 0.11, -0.16, fg));
  for (let j = 0; j < 2; j++) burk(L + 0.23 + j * 0.11, 0.429, -0.12, 0.05, 0.22, ['#e7c98a', '#f0e6cf'][j], '#c69c6d', true);
  paket(L + wi - 0.07, 0.429, -0.1, 0.09, 0.2, 0.06, '#e8e0cc', '#b8463a');
  // 0,76: flingor, pasta, knäckebröd
  paket(L + 0.05, 0.759, -0.12, 0.07, 0.28, 0.19, '#d8a23a', '#f2efe8');
  paket(L + 0.13, 0.759, -0.12, 0.07, 0.26, 0.18, '#4a7aa8', '#e8c64a');
  for (let j = 0; j < 2; j++) paket(L + 0.24 + j * 0.11, 0.759, -0.08, 0.09, 0.2, 0.055, ['#2f5f9a', '#a8463a'][j], '#f2efe8');
  ton('#c99a5a', () => rbx('vit', 0.12, 0.06, 0.2, L + wi - 0.08, 0.759 + 0.03, -0.12, 0.008, 0, 0, 1));
  mikro(x, W, 1.11, 1.47);
  // 1,49: olja, vinäger, honung och en rad kryddburkar
  flaska(L + 0.04, 1.489, -0.2, 0.03, 0.26, '#b5a03a', '#3d5a3a');
  flaska(L + 0.11, 1.489, -0.2, 0.028, 0.24, '#7a3a3a', '#d9d4c8');
  burk(L + 0.2, 1.489, -0.18, 0.04, 0.12, '#d9a03a', '#c69c6d', true);
  ['#b8463a', '#8a9a4a', '#d9b23a', '#6b4a3a', '#c9673a', '#9a8a6a'].forEach((fg, j) => burk(L + 0.06 + j * 0.065, 1.489, 0.05, 0.022, 0.09, fg, '#c9c9c6', true));
  // 1,79: te, kaffe och socker
  for (let j = 0; j < 2; j++) paket(L + 0.06 + j * 0.13, 1.789, -0.12, 0.12, 0.07, 0.07, ['#6a8a6a', '#a87a5a'][j], '#f2efe8');
  ton('#6b4a3a', () => rbx('tyg', 0.1, 0.18, 0.07, L + 0.33, 1.789 + 0.09, -0.15, 0.015, 0, 0, 2));
  paket(L + wi - 0.08, 1.789, -0.12, 0.1, 0.16, 0.07, '#f2efe8', '#3a6aa0');
  // främre raden (hyllorna var nästan tomma framtill): glasburkar med torrvaror och lock,
  // en stapel skålar, olja och vinäger, bakform och en flätad korg; allt i dämpade toner
  dampat(0.3, () => {
    ['#e3d3a8', '#b98b5c', '#efe6d2'].forEach((fg, j) => burk(L + 0.05 + j * 0.095, 0.429, 0.1, 0.04, 0.15 - j * 0.02, fg, '#b98b5c', true));
    skalstapel(L + wi - 0.14, 0.429, 0.08);
    flaska(L + 0.04, 0.759, 0.12, 0.03, 0.27, '#6a7a3a', '#3d3a34'); flaska(L + 0.11, 0.759, 0.13, 0.026, 0.23, '#7a4a3a', '#d9d4c8');
    burk(L + 0.2, 0.759, 0.11, 0.045, 0.13, '#d9c79e', '#c9c9c6', true); burk(L + 0.3, 0.759, 0.12, 0.038, 0.1, '#8a5a3a', '#c9c9c6', true);
    paket(L + wi - 0.08, 0.759, 0.1, 0.11, 0.15, 0.06, '#c9b28a', '#efe9dc');
    for (let j = 0; j < 2; j++) paket(L + wi - 0.16 + j * 0.085, 1.489, -0.14, 0.075, 0.19 - j * 0.03, 0.14, ['#9aa58c', '#b9895c'][j], '#efe9dc');
    ton('#c4a477', () => svarv('tyg', [[0, 0], [0.085, 0], [0.095, 0.01], [0.1, 0.1], [0.094, 0.1], [0.088, 0.012], [0, 0.01]], L + wi - 0.13, 1.789, 0.08, 16));
    ton('#efe9df', () => vav('linne', () => rbx('tyg', 0.13, 0.05, 0.13, L + wi - 0.13, 1.83, 0.08, 0.02, 0.3, 0, 1)));
    for (let j = 0; j < 2; j++) burk(L + 0.06 + j * 0.1, 1.789, 0.1, 0.042, 0.12, ['#e6dcc0', '#a8774e'][j], '#3d3a34', true);
  });
  // luckorna (nedre 0,105–1,1 och övre 1,48–2,09) med handtag vid låskanten
  [[0.105, 1.1, 0.93], [1.48, 2.09, 1.63]].forEach(([y0, y1, yh], j) => gangjarnsLucka(j ? 'Skafferi uppe' : 'Skafferi', xe, 1, 0.281, 0.019, zs => {
    rbx('front', W, y1 - y0, 0.019, W / 2, (y0 + y1) / 2, 0, 0.004, 0, 0, 1);
    ton('#2a2928', () => rbx('vit', 0.014, 0.3, 0.02, W - 0.047, yh, zs * 0.019, 0.005, 0, 0, 1));
  }));
}
// Inbyggd mikrovågsugn: ram i stål, sidohängd lucka i grafitglas med fönster och handtag,
// kontrollpanel med display och vred, och ett ljust ugnsrum med glastallrik och en skål.
function mikro(x, W, y0, y1) {
  const h = y1 - y0, ym = (y0 + y1) / 2, pb = 0.13, Wd = W - pb, xe = x - W / 2, xc = xe + Wd / 2;
  // ugnsrummet: ihålig låda (öppen framåt) i ljusgrå emalj
  {
    const g = new T.BoxGeometry(Wd - 0.06, h - 0.1, 0.3), ix = g.index.array, kvar = [];
    g.groups.forEach((gr, i) => { if (i !== 4) for (let k = gr.start; k < gr.start + gr.count; k += 3) kvar.push(ix[k], ix[k + 2], ix[k + 1]); });
    g.setIndex(kvar); g.clearGroups();
    const n = g.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k));
    ton('#d6d6d2', () => glans(0.6, () => lagg('keramik', g, mx(xc, ym, 0.276 - 0.15))));
  }
  ton('#45474b', () => {
    box('vit', Wd, 0.042, 0.005, xc, y1 - 0.029, 0.2785); box('vit', Wd, 0.042, 0.005, xc, y0 + 0.029, 0.2785);
    box('vit', 0.03, h - 0.1, 0.005, xe + 0.015, ym, 0.2785); box('vit', 0.03, h - 0.1, 0.005, xe + Wd - 0.015, ym, 0.2785);
  });
  lagg('glas', new T.CylinderGeometry(0.12, 0.12, 0.006, 28), mx(xc, y0 + 0.05 + 0.012, 0.11));
  ton('#e8e2d8', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.035, 0], [0.06, 0.045], [0.056, 0.045], [0.033, 0.005], [0, 0.005]], xc, y0 + 0.065, 0.11, 18)));
  // stålkanter upptill och nertill
  ton('#c9c9c6', () => { stalBox(W, 0.008, 0.019, x, y1 - 0.004, 0.2905, 0.002); stalBox(W, 0.008, 0.019, x, y0 + 0.004, 0.2905, 0.002); });
  // kontrollpanel: grafitglas, display, knappar och vred
  ton('#2c2e31', () => glans(0.25, () => rbx('keramik', pb - 0.003, h - 0.016, 0.019, xe + Wd + pb / 2, ym, 0.2905, 0.003, 0, 0, 1)));
  ton('#f0d7a8', () => { for (let j = 0; j < 4; j++) box('vit', 0.007, 0.011, 0.001, xe + Wd + pb / 2 - 0.022 + j * 0.0145, y1 - 0.06, 0.3005); });
  ton('#8b8e92', () => { for (let j = 0; j < 6; j++) cyl('vit', 0.007, 0.007, 0.003, xe + Wd + pb / 2 - 0.025 + (j % 3) * 0.025, y1 - 0.11 - Math.floor(j / 3) * 0.03, 0.3015, 12, false, PI / 2); });
  ton('#b9b9b6', () => stal(new T.CylinderGeometry(0.022, 0.023, 0.016, 24).rotateX(PI / 2), mx(xe + Wd + pb / 2, y0 + 0.09, 0.308)));
  gangjarnsLucka('Mikrovågsugn', xe, 1, 0.281, 0.019, zs => {
    const Z = d => zs * d;
    ton('#2c2e31', () => glans(0.25, () => rbx('keramik', Wd - 0.003, h - 0.016, 0.019, (Wd - 0.003) / 2, ym, 0, 0.003, 0, 0, 1)));
    ton('#3b3e42', () => glans(0.3, () => box('keramik', Wd - 0.12, h - 0.11, 0.002, (Wd - 0.003) / 2 - 0.025, ym, Z(0.0096))));
    platta('glas', Wd - 0.12, h - 0.11, mx((Wd - 0.003) / 2 - 0.025, ym, Z(0.0108), zs < 0 ? PI : 0), null, [1, 1]);
    ton('#cfd0cd', () => box('vit', Wd - 0.04, h - 0.05, 0.003, (Wd - 0.003) / 2, ym, Z(-0.011)));
    ton('#c9c9c6', () => {
      stal(new T.CylinderGeometry(0.007, 0.007, h - 0.12, 14), mx(Wd - 0.035, ym, Z(0.03)));
      for (const y of [ym - (h - 0.16) / 2, ym + (h - 0.16) / 2]) stal(new T.CylinderGeometry(0.0045, 0.0045, 0.022, 10).rotateX(PI / 2), mx(Wd - 0.035, y, Z(0.0195)));
    });
  });
}
// Skärbräda i ek (40 x 26 x 2 cm) med rundade hörn och ett grepphål, lutad mot
// stänkskyddet (75°) med underkanten på bänkskivan. Lokalt i bänken (y = skivans yta).
function skarbrada(x, y) {
  const w = 0.26, h = 0.38, r = 0.03, s = new T.Shape(), lu = 0.2618;
  s.moveTo(-w / 2 + r, 0); s.lineTo(w / 2 - r, 0); s.quadraticCurveTo(w / 2, 0, w / 2, r); s.lineTo(w / 2, h - r); s.quadraticCurveTo(w / 2, h, w / 2 - r, h);
  s.lineTo(-w / 2 + r, h); s.quadraticCurveTo(-w / 2, h, -w / 2, h - r); s.lineTo(-w / 2, r); s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  const hal = new T.Path(); hal.absarc(0, h - 0.045, 0.016, 0, 2 * PI, true); s.holes.push(hal);
  const g = new T.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 }).translate(0, 0.002, 0.002);
  ton('#b98b5c', () => lagg('ek', g, mx(x, y, -0.288 + (h + 0.004) * Math.sin(lu), 0, -lu)));
}
// Basilika i en terrakottakruka: fem stjälkar med parvisa blad (inga lösa blad).
function basilika(x, y, z) {
  skugga(x, z, 0.12, 0.12, 0, 0.06, 0.3, y + 0.021);
  kruka(x, y, z, 0.06, 0.1, '#b8714c');
  const yj = y + 0.1 * 0.855;
  let s5 = null;   // de två extra stjälkarna rubbar inte slumpföljden för resten av huset
  for (let i = 0; i < 7; i++) {
    if (i === 5) s5 = SEED;
    const az = i * 2.39996 + rnd() * 0.5, rr = 0.008 + rnd() * 0.024, H = 0.07 + rnd() * 0.07, bx = x + Math.sin(az) * rr, bz = z + Math.cos(az) * rr;
    const top = V(bx + Math.sin(az) * 0.015, yj + H, bz + Math.cos(az) * 0.015);
    const k = ton('#6f8f4a', () => tub('tyg', [V(bx, yj - 0.004, bz), V((bx + top.x) / 2, yj + H * 0.5, (bz + top.z) / 2), top], 0.0028, 0.0018, 6, 4));
    for (let j = 0; j < 3; j++) { const p = k.getPointAt(0.45 + j * 0.27); for (const sd of [-1, 1]) bladkort(BL.pothos2, 0.044 + (2 - j) * 0.01, p.x, p.y, p.z, az + sd * PI / 2 + j * 0.7, 1.05 - j * 0.25, { bred: 0.95, vik: 0.2, bag: 0.1, ny: 2, nx: 2, ton: ['#d9f0b8', '#cfe8a8', '#e3f4c6'][j] }); }
  }
  if (s5 != null) SEED = s5;
}
// Induktionshäll i svart glas (nästan #0b0b0c, mycket blank) i planlåda med fasad kant:
// fyra runda zoner som svaga koncentriska grå ringar och en pekpanel med vita symboler.
function hall(x) {
  const y = 0.8545, zc = 0.02;
  // glaskeramik i grafit (inte helt svart) med blank yta och en smal fasad stålkant
  ton('#25272a', () => glans(0.2, () => rbx('keramik', 0.58, 0.007, 0.51, x, 0.8505, zc, 0.0032, 0, 0, 2)));
  ton('#c9c9c6', () => { for (const s of [-1, 1]) { stalBox(0.584, 0.004, 0.003, x, 0.852, zc + s * 0.2565, 0.001); stalBox(0.003, 0.004, 0.516, x + s * 0.2905, 0.852, zc, 0.001); } });
  ton('#3a3c3f', () => glans(0.3, () => box('keramik', 0.555, 0.05, 0.485, x, 0.822, zc)));   // hällens låda under skivan
  [[-0.14, -0.1, 0.1], [0.14, -0.1, 0.08], [-0.14, 0.11, 0.08], [0.14, 0.11, 0.1]].forEach(([zx, zz, zr]) => {
    [[zr, '#5a5d61', 0.0016], [zr * 0.6, '#46494d', 0.0012]].forEach(([r, fg, tj]) =>
      ton(fg, () => glans(0.3, () => lagg('keramik', new T.TorusGeometry(r, tj, 3, 36).rotateX(PI / 2).scale(1, 0.25, 1), mx(x + zx, y, zc + zz)))));
  });
  // pekpanel: minus/plus per zon, ett skjutreglage och en strömsymbol
  const zp = zc + 0.225;
  ton('#f2f2ee', () => {
    [-0.2, -0.08, 0.08, 0.2].forEach(px => { box('vit', 0.012, 0.0008, 0.0022, x + px - 0.014, y, zp); box('vit', 0.012, 0.0008, 0.0022, x + px + 0.014, y, zp); box('vit', 0.0022, 0.0008, 0.012, x + px + 0.014, y, zp); });
    box('vit', 0.09, 0.0008, 0.0016, x, y, zp);
    lagg('vit', new T.TorusGeometry(0.0065, 0.0011, 3, 20, PI * 1.6).rotateX(PI / 2).rotateY(-PI * 0.3), mx(x + 0.255, y, zp));
    box('vit', 0.0018, 0.0008, 0.007, x + 0.255, y, zp - 0.004);
  });
}

// Fruktskål: svarvad keramikskål (36 segment) med godstjocklek, och frukt i dämpade färger.
function fruktskal(x, y, z) {
  ton('#ebe6dd', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.05, 0], [0.056, 0.006], [0.1, 0.035], [0.135, 0.07], [0.14, 0.078], [0.134, 0.08], [0.128, 0.072], [0.094, 0.04], [0.05, 0.016], [0, 0.014]], x, y, z, 36)));
  frukter(x, y + 0.016, z, 1);
}
// Äpplen (tillplattade, med fördjupning och skaft), citron, apelsin, päron och bananer.
function frukter(x, y, z, s = 1) {
  const S = (r, sx, sy, sz) => new T.SphereGeometry(r * s, 20, 14).scale(sx, sy, sz);
  const appel = (dx, dz, fg, a) => {
    const g = S(0.037, 1, 0.88, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / (0.037 * s * 0.88); if (yy > 0.75) p.setY(i, p.getY(i) - 0.006 * s * (yy - 0.75) * 4); }
    g.computeVertexNormals();
    ton(fg, () => lagg('keramik', g, mx(x + dx * s, y + 0.032 * s, z + dz * s, a)));
    ton('#5b4330', () => lagg('ek', new T.CylinderGeometry(0.0018 * s, 0.0022 * s, 0.018 * s, 6), mx(x + dx * s, y + 0.06 * s, z + dz * s, 0, 0.3, 0)));
  };
  appel(0, 0.02, '#a94d3c', 0); appel(0.06, -0.02, '#9aa152', 1); appel(-0.05, -0.035, '#b4553f', 2);
  ton('#d4bd58', () => lagg('keramik', S(0.03, 1.35, 0.95, 0.95), mx(x - 0.055 * s, y + 0.03 * s, z + 0.04 * s, 0.4)));
  ton('#d4853a', () => lagg('keramik', S(0.036, 1, 0.94, 1), mx(x + 0.02 * s, y + 0.065 * s, z - 0.005 * s)));
  ton('#b9b35c', () => svarv('keramik', [[0, 0], [0.02 * s, 0.002], [0.034 * s, 0.03 * s], [0.03 * s, 0.05 * s], [0.018 * s, 0.07 * s], [0.012 * s, 0.085 * s], [0, 0.09 * s]], x + 0.07 * s, y, z + 0.045 * s, 20));
  // bananer: en klase om tre, 18 cm långa och böjda, med femkantigt snitt (fem mjuka åsar),
  // trubbig mörk blomände och en hals som smalnar mot en gemensam stjälk. Bananerna
  // fläktar ut från stjälken och ligger på frukten (förr små, lösa fingrar som stack upp).
  const ks = V(x + 0.085 * s, y + 0.072 * s, z + 0.035 * s);   // klasens stjälk i skålens kant
  for (let i = 0; i < 3; i++) {
    const k = new T.QuadraticBezierCurve3(V(-0.18, 0.04, 0), V(-0.09, -0.018, 0), V(0, 0, 0));
    const g = new T.TubeGeometry(k, 20, 1, 10, false), p = g.attributes.position, c = V(0, 0, 0);
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      let rr = 0.0165 * Math.pow(Math.sin(PI * Math.min(1, 0.05 + u * 0.75)), 0.5);
      if (u > 0.84) rr *= 1 - 0.55 * (u - 0.84) / 0.16;   // halsen mot stjälken
      k.getPointAt(u, c);
      for (let q = 0; q <= 10; q++) { const n = j * 11 + q, f = rr * (1 - 0.07 * Math.cos(PI * q)); p.setXYZ(n, c.x + (p.getX(n) - c.x) * f, c.y + (p.getY(n) - c.y) * f, c.z + (p.getZ(n) - c.z) * f); }
    }
    g.computeVertexNormals();
    g.scale(s, s, s);
    // fläkt runt stjälken; den mellersta ligger lite högre (ovanpå de andra)
    const m = mx(ks.x, ks.y + (i === 1 ? 0.012 : 0) * s, ks.z, -0.3 + (i - 1) * 0.42, 0, -0.06);
    ton(['#dcc25e', '#e3ca66', '#d6bb57'][i], () => glans(2.2, () => lagg('keramik', g, m)));
    ton('#3b2f24', () => lagg('ek', new T.SphereGeometry(0.0058 * s, 8, 6).translate(-0.18 * s, 0.04 * s, 0), m.clone()));
  }
  // gemensam stjälk (krona) i gröngrått
  ton('#7d7a4a', () => lagg('ek', new T.CylinderGeometry(0.0055 * s, 0.0075 * s, 0.03 * s, 8).rotateZ(-1.0).translate(0.012 * s, 0.009 * s, 0), mx(ks.x, ks.y, ks.z, -0.3)));
}

// Redskapskruka: avsmalnande glaserad kruka med rundad kant och fot, och blandade
// redskap i lite olika vinklar: träslev, stekspade, visp av slingor, slev i stål.
function redskap(x, y, z) {
  ton('#e4ddd0', () => glans(0.55, () => svarv('keramik', [[0, 0], [0.036, 0], [0.04, 0.004], [0.042, 0.012], [0.05, 0.11], [0.053, 0.135], [0.051, 0.142], [0.046, 0.14], [0.043, 0.112], [0.036, 0.02], [0, 0.02]], x, y, z, 40)));
  ton('#3d362f', () => cyl('tyg', 0.043, 0.043, 0.004, x, y + 0.1, z, 20));
  const stav = (mk, r, L, dx, dz, az, lut, fg) => {
    const d = rikt(az, lut), b = V(x + dx, y + 0.03, z + dz);
    ton(fg, () => lagg(mk, new T.CylinderGeometry(r * 0.85, r, L, 10), mx(b.x + d.x * L / 2, b.y + d.y * L / 2, b.z + d.z * L / 2, az, lut, 0)));
    return { top: b.clone().addScaledVector(d, L), d };
  };
  const huvud = (s, mk, geo, fg, lut, az) => ton(fg, () => lagg(mk, geo, mx(s.top.x, s.top.y, s.top.z, az, lut, 0)));
  // träslev med skålat huvud
  // fem redskap jämnt fördelade runt krukan: basen förskjuten åt samma håll som lutningen
  const ut = a => [Math.sin(a) * 0.014, Math.cos(a) * 0.014];
  let s = stav('ek', 0.006, 0.27, ...ut(2.8), 2.8, 0.17, '#b48a5c');
  huvud(s, 'ek', new T.SphereGeometry(0.026, 16, 10, 0, 2 * PI, 0, PI / 2).scale(0.75, 0.35, 1.1).rotateX(PI / 2).translate(0, 0.024, 0), '#b48a5c', 0.17, 2.8);
  // slitsad stekspade i svart silikon
  s = stav('svart', 0.0055, 0.23, ...ut(-0.95), -0.95, 0.17, '#2b2a28');
  { const sh = new T.Shape(); rundRekt(0, 0, 0.064, 0.084, 0.014).forEach(([a, b], i) => (i ? sh.lineTo(a, b) : sh.moveTo(a, b)));
    for (const k of [-1, 0, 1]) sh.holes.push(rundRektPath(k * 0.017, 0.008, 0.007, 0.05, 0.003));
    huvud(s, 'svart', new T.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 3 }).translate(0, 0.041, -0.002), '#2b2a28', 0.17, -0.95); }
  // visp: skaft i stål och sex trådslingor
  s = stav('spegel', 0.006, 0.17, ...ut(1.55), 1.55, 0.17, null);
  for (let i = 0; i < 6; i++) lagg('spegel', new T.TorusGeometry(0.026, 0.0011, 4, 24).scale(1, 2.1, 1).rotateY(i * PI / 6).translate(0, 0.052, 0), mx(s.top.x, s.top.y, s.top.z, 1.55, 0.17, 0));
  // slev i stål: tunt skaft och djup skål med godstjocklek; skaftet möter skålens kant
  s = stav('spegel', 0.004, 0.25, ...ut(-2.2), -2.2, 0.17, null);
  lagg('spegel', new T.LatheGeometry([[0, -0.035], [0.0175, -0.0303], [0.0303, -0.0175], [0.035, 0], [0.0337, 0.0012], [0.0324, 0], [0.028, -0.0163], [0.016, -0.0283], [0, -0.0325]].map(q => new T.Vector2(q[0], q[1])), 24).translate(0, 0.002, -0.0345), mx(s.top.x, s.top.y, s.top.z, -2.2, 0.17, 0));
  // tång i stål: två skänklar med ring nertill och tandade spetsar uppåt
  for (const k of [-1, 1]) {
    const t2 = stav('spegel', 0.0035, 0.24, ut(0.3)[0] + k * 0.004 * Math.cos(0.3), ut(0.3)[1] - k * 0.004 * Math.sin(0.3), 0.3, 0.17 + k * 0.02, null);
    stalBox(0.026, 0.035, 0.004, t2.top.x, t2.top.y + 0.012, t2.top.z, 0.002);
  }
  lagg('spegel', new T.TorusGeometry(0.008, 0.0016, 4, 12), mx(x, y + 0.1, z - 0.022));
}

// Olivolja i flaska av mörkgrönt glas med hällpip, och ett par salt- och pepparkvarnar.
function oljaOchKvarnar(x, y, z) {
  const P = [[0, 0], [0.03, 0], [0.032, 0.004], [0.032, 0.17], [0.026, 0.195], [0.012, 0.215], [0.011, 0.25], [0, 0.25]];
  ton('#3d5a2c', () => glans(0.35, () => svarv('keramik', P.map(([r, h]) => [Math.max(0, r - 0.002), h * 0.98]), x, y, z, 32)));
  lagg('glas', new T.LatheGeometry(P.map(([r, h]) => new T.Vector2(r + 0.0006, h)), 32), mx(x, y, z));
  ton('#d8c79a', () => glans(0.8, () => svarv('keramik', [[0, 0], [0.026, 0], [0.026, 0.07], [0, 0.07]], x, y + 0.06, z, 24)));   // etikett
  stalBox(0.02, 0.018, 0.02, x, y + 0.258, z, 0.004);
  lagg('spegel', new T.CylinderGeometry(0.0028, 0.0035, 0.05, 8), mx(x, y + 0.282, z + 0.012, 0, 0.7, 0));
  const kvarn = (dx, dz, fg, mk) => {
    const Q = [[0, 0], [0.022, 0], [0.024, 0.01], [0.02, 0.06], [0.017, 0.1], [0.021, 0.14], [0.022, 0.15], [0, 0.15]];
    if (mk === 'ek') svarv('ek', Q, x + dx, y, z + dz, 28); else ton(fg, () => glans(0.9, () => svarv(mk, Q, x + dx, y, z + dz, 28)));
    stal(new T.CylinderGeometry(0.012, 0.016, 0.018, 18), mx(x + dx, y + 0.159, z + dz));
    stal(new T.SphereGeometry(0.008, 10, 6), mx(x + dx, y + 0.17, z + dz));
  };
  kvarn(0.075, 0.015, null, 'ek');
  kvarn(0.13, -0.01, '#2a2826', 'keramik');
}

// ---- Mer på köksbänken (bänkarna var glest dukade) ----
// Brödrost i borstat stål: rundad kropp, mörk sockel, två springor, spak och vred.
function brodrost(x, y, z) {
  skugga(x, z, 0.27, 0.17, 0, 0.05, 0.3, y + 0.021);
  ton('#cfcfcc', () => stalBox(0.27, 0.165, 0.16, x, y + 0.0935, z, 0.03));
  ton('#2a2928', () => { rbx('svart', 0.26, 0.012, 0.15, x, y + 0.007, z, 0.005, 0, 0, 1);
    for (const s of [-1, 1]) rbx('svart', 0.17, 0.004, 0.026, x, y + 0.1755, z + s * 0.034, 0.002, 0, 0, 1);
    rbx('svart', 0.012, 0.03, 0.03, x + 0.14, y + 0.12, z, 0.004, 0, 0, 1);
    cyl('svart', 0.012, 0.012, 0.008, x + 0.139, y + 0.05, z + 0.03, 14, false, 0, PI / 2); });
}
// Pressbryggare: glascylinder med kaffe i stålram, lock med kolv och ett handtag.
function pressbryggare(x, y, z) {
  lagg('glas', new T.CylinderGeometry(0.046, 0.046, 0.15, 24, 1, true), mx(x, y + 0.085, z));
  ton('#3a2a20', () => glans(0.5, () => cyl('keramik', 0.043, 0.043, 0.07, x, y + 0.047, z, 24)));
  ton('#cfcfcc', () => { stal(new T.CylinderGeometry(0.05, 0.05, 0.012, 24), mx(x, y + 0.006, z)); stal(new T.CylinderGeometry(0.048, 0.05, 0.016, 24), mx(x, y + 0.166, z));
    stal(new T.CylinderGeometry(0.003, 0.003, 0.05, 8), mx(x, y + 0.199, z)); stal(new T.SphereGeometry(0.011, 12, 8), mx(x, y + 0.226, z)); });
  ton('#2a2928', () => lagg('svart', new T.TorusGeometry(0.05, 0.006, 6, 16, PI), mx(x + 0.046, y + 0.09, z, 0, 0, -PI / 2)));
}
// Stapel i stengods: tre tallrikar och tre skålar i varandra.
function skalstapel(x, y, z) {
  ton('#e9e4da', () => glans(0.7, () => { for (let j = 0; j < 3; j++) svarv('keramik', [[0, 0], [0.085, 0], [0.105, 0.006], [0.108, 0.012], [0.085, 0.01], [0, 0.008]], x, y + j * 0.011, z, 28); }));
  ['#9aa58c', '#d8cdbb', '#8797a6'].forEach((fg, j) => ton(fg, () => glans(0.7, () => svarv('keramik', [[0, 0], [0.032, 0], [0.036, 0.004], [0.068, 0.05], [0.07, 0.056], [0.066, 0.056], [0.034, 0.012], [0, 0.012]], x, y + 0.033 + j * 0.016, z, 28))));
}
// Vid diskhon: diskmedel i pumpflaska på ena sidan om blandaren, diskborste i en mugg på den andra.
function diskhorna(x, y, z) {
  ton('#e8e2d6', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.026, 0], [0.028, 0.004], [0.028, 0.1], [0.02, 0.118], [0.01, 0.124], [0, 0.124]], x - 0.13, y, z, 24)));
  ton('#2a2928', () => { cyl('svart', 0.004, 0.004, 0.035, x - 0.13, y + 0.14, z, 8); box('svart', 0.008, 0.008, 0.04, x - 0.13, y + 0.158, z + 0.014); });
  ton('#c9c2b4', () => glans(0.7, () => svarv('keramik', [[0, 0], [0.03, 0], [0.033, 0.006], [0.036, 0.075], [0.032, 0.075], [0.029, 0.01], [0, 0.01]], x + 0.16, y, z, 24)));
  ton('#b48a5c', () => lagg('ek', new T.CylinderGeometry(0.006, 0.006, 0.17, 8), mx(x + 0.16, y + 0.1, z, 0, 0.16, 0.1)));
  ton('#e9e4d8', () => lagg('tyg', new T.CylinderGeometry(0.02, 0.016, 0.03, 12), mx(x + 0.152, y + 0.196, z + 0.016, 0, 0.16, 0.1)));
}
// Kastrull i stål med lock, knopp och två handtag (på hällens bakre zon).
function kastrull(x, y, z) {
  ton('#cfcfcc', () => stal(new T.LatheGeometry([[0, 0], [0.086, 0], [0.09, 0.006], [0.09, 0.094], [0.095, 0.097], [0.09, 0.102], [0.05, 0.113], [0.012, 0.117], [0, 0.117]].map(q => new T.Vector2(q[0], q[1])), 32), mx(x, y, z)));
  ton('#2a2928', () => { cyl('svart', 0.014, 0.01, 0.022, x, y + 0.128, z, 14); for (const s of [-1, 1]) rbx('svart', 0.04, 0.01, 0.03, x + s * 0.108, y + 0.082, z, 0.004, 0, 0, 1); });
}
// Vikt kökshandduk i linne med en rand.
function kokshandduk(x, y, z) {
  vikt(0.16, 0.22, 0.022, x, y, z, 0.06, '#efe9dd', 'linne');
  ton('#8797a6', () => vav('linne', () => box('tyg', 0.162, 0.0235, 0.02, x + 0.001, y + 0.0118, z + 0.05, 0.06)));
}

function tidning(x, y, z, ry, cell) {
  med(x, z, ry, () => {
    ton('#f3f0ea', () => box('tyg', 0.21, 0.006, 0.28, 0, y + 0.003, 0));
    platta('tryck', 0.205, 0.275, mx(0, y + 0.0065, 0, 0, -PI / 2), cell, [1, 1]);
  });
}

function golvlampa() {
  // står foten (Ø 30 cm) delvis på en matta lyfts lampan till mattans ovansida
  const c = V(0, 0, 0).applyMatrix4(BAS), pa = MATTOR.some(([a, b, e, f]) => c.x + 0.15 > a && c.x - 0.15 < b && c.z + 0.15 > e && c.z - 0.15 < f);
  if (pa) { iRam(BAS.clone().multiply(new T.Matrix4().makeTranslation(0, 0.012, 0)), golvlampa0); return; }
  golvlampa0();
}
function golvlampa0() {
  skugga(0, 0, 0.3, 0.3, 0, 0.1, 0.4);
  hind(0.32, 0.32);
  // tung fot i grafit och en stång i borstad mässing
  ton('#4f4d49', () => svarv('diskstal', [[0, 0], [0.148, 0], [0.15, 0.006], [0.145, 0.016], [0.13, 0.022], [0.02, 0.026], [0, 0.026]], 0, 0, 0, 32));
  ton('#c8a46c', () => cyl('diskstal', 0.009, 0.009, 1.36, 0, 0.705, 0, 12));
  const li = skarm(0, 1.35, 0, 0.21, 0.17, 0.3, undefined, 'skarm', 'Golvlampa');
  sken(li, 0, 0.024, 0, 0.5, 0.5, 0.3, false, 0.5);
  // skärmen lyser upp väggen bakom (närmaste vägg inom 0,6 m, fri från fönster och dörrar)
  const c = V(0, 0, 0).applyMatrix4(BAS);
  EFTER.push(() => lampVaggSken(li, c.x, c.z, 1.5, 1.0, 1.3, 0.3));
}
// Mjukt sken från en lampa på närmaste vägg (husets ram): mitt på höjden y, w x h, alfa.
function lampVaggSken(li, x, z, y, w, h, alfa) {
  const XA = -HH.L / 2 + I, XB = HH.L / 2 - I, ZA = -HH.W / 2 + I, ZB = HH.W / 2 - I;
  const K = [[x - XA, XA, z, 1, 0, true], [XB - x, XB, z, -1, 0, true], [z - ZA, x, ZA, 0, 1, true], [ZB - z, x, ZB, 0, -1, true]];
  VAGGAR.forEach(v => {
    if (v.bunn > 0) return;
    const s = v.axel === 'x' ? x : z, q = v.axel === 'x' ? z : x;
    if (s < v.lo + w / 2 || s > v.hi - w / 2 || v.hal.some(o => s > o.a - w / 2 - 0.1 && s < o.b + w / 2 + 0.1)) return;
    const sd = Math.sign(q - v.c) || 1, f = v.c + sd * v.t / 2;
    K.push(v.axel === 'x' ? [sd * (q - f), x, f, 0, sd, false] : [sd * (q - f), f, z, sd, 0, false]);
  });
  K.sort((a, b) => a[0] - b[0]);
  const [d, fx, fz, nx, nz, ytter] = K[0];
  if (!(d > 0.05 && d < 0.6)) return;
  if (ytter && HAL.some(o => { if (Math.abs(o.f.n.x + nx) > 0.5 || Math.abs(o.f.n.z + nz) > 0.5) return false;
    const pa = o.f.o.clone().addScaledVector(o.f.u, o.u0), pb = o.f.o.clone().addScaledVector(o.f.u, o.u1), s = nx ? z : x, a = nx ? pa.z : pa.x, b = nx ? pb.z : pb.x;
    return s > Math.min(a, b) - w / 2 - 0.1 && s < Math.max(a, b) + w / 2 + 0.1; })) return;
  const bad = BADRUM.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1), ut = bad ? 0.019 : 0.004;
  iRam(new T.Matrix4(), () => iLager('botten', () => sken(li, fx + nx * ut, y, fz + nz * ut, w, h, alfa, true, 0.35, false, Math.atan2(nx, nz))));
}

// Kakelsättning per badrum: plattorna centreras på varje vägg och på golvet, och flyttas
// en halv platta om bitarna i hörnen annars blir smalare än en tredjedel av en platta.
// s = läget längs väggen (x eller z) -> u i texturen (en upprepning = 2 plattor).
let KAKEL = null;
function kakelSattning(x0, x1, z0, z1, T0) {
  const forsk = (a, b, p) => { const r = ((b - a) / 2) % p; return (a + b) / 2 + (r < p / 3 ? p / 2 : 0); };
  return { x: forsk(x0 + T0, x1 - T0, 0.3), z: forsk(z0 + T0, z1 - T0, 0.3), gx: forsk(x0 + T0, x1 - T0, 0.6), gz: forsk(z0 + T0, z1 - T0, 0.6) };
}
function kakelU(s, axel) { return (s - (KAKEL ? KAKEL[axel] : 0)) / 0.6; }

// Badrummet: storformatskakel på golv och väggar (hål för dörrar och fönster) och en spot.
function bad(x0, x1, z0, z1) {
  const T0 = 0.016;
  BADRUM.push({ x0, x1, z0, z1 });
  KAKEL = kakelSattning(x0, x1, z0, z1, T0);
  // golvet läggs sist, när duschens fall och brunn är kända
  EFTER.push(() => badGolv(x0, x1, z0, z1));
  const sidor = [
    { s: 'N', a: x0, b: x1, P: (u, v) => V(u, v, z0 + T0), n: V(0, 0, 1), linje: z0, axel: 'x' },
    { s: 'S', a: x0, b: x1, P: (u, v) => V(u, v, z1 - T0), n: V(0, 0, -1), linje: z1, axel: 'x' },
    { s: 'W', a: z0, b: z1, P: (u, v) => V(x0 + T0, v, u), n: V(1, 0, 0), linje: x0, axel: 'z' },
    { s: 'E', a: z0, b: z1, P: (u, v) => V(x1 - T0, v, u), n: V(-1, 0, 0), linje: x1, axel: 'z' },
  ];
  const ytter = { N: -HH.W / 2 + I, S: HH.W / 2 - I, W: -HH.L / 2 + I, E: HH.L / 2 - I };
  sidor.forEach(sd => {
    const hal = [];
    VAGGAR.forEach(w => {
      if (w.axel !== sd.axel) return;
      if (Math.abs(w.c - w.t / 2 - sd.linje) > 0.03 && Math.abs(w.c + w.t / 2 - sd.linje) > 0.03) return;
      w.hal.forEach(h => hal.push({ u0: h.a, u1: h.b, v0: -1, v1: h.h }));
    });
    if (Math.abs(ytter[sd.s] - sd.linje) < 0.03) HAL.filter(h => h.s === sd.s).forEach(h => {
      const pa = h.f.o.clone().addScaledVector(h.f.u, h.u0), pb = h.f.o.clone().addScaledVector(h.f.u, h.u1);
      const ua = sd.axel === 'x' ? pa.x : pa.z, ub = sd.axel === 'x' ? pb.x : pb.z;
      hal.push({ u0: Math.min(ua, ub), u1: Math.max(ua, ub), v0: h.v0 <= 0.01 ? -1 : h.v0, v1: h.v1 });
    });
    const pa = sd.P(sd.a, 0), pb = sd.P(sd.b, 0);
    const top = Math.min(2.1, takVid(pa.x, pa.z) - 0.012, takVid(pb.x, pb.z) - 0.012);
    const us = bryt(sd.a, sd.b, hal.flatMap(h => [h.u0, h.u1]), 0.4);
    const vs = [...new Set([-0.02, 0.06, 0.4, 0.8, 1.2, 1.6, ...hal.flatMap(h => [h.v0, h.v1]).filter(v => v > 0 && v < top - 0.02)].map(v => Math.round(v * 1e4) / 1e4))].sort((p, q) => p - q);
    // väggplattor 30 x 60 med mjuk glans, satta från väggens mitt (inga smala bitar i hörnen)
    ton('#e9e5dd', () => yta('kakel', sd.P, sd.n, us, vs, () => top, hal, p => [kakelU(sd.axel === 'x' ? p.x : p.z, sd.axel), p.y / 1.2]));
    // avslutningslist i borstat stål över kaklets överkant (inte över fönster och dörrar)
    let seg = [[sd.a + T0, sd.b - T0]];
    hal.filter(h => h.v1 > top - 0.03).forEach(h => { seg = seg.flatMap(([p, q]) => h.u1 <= p || h.u0 >= q ? [[p, q]] : [[p, h.u0], [h.u1, q]]); });
    const ln = sd.linje + (sd.s === 'N' || sd.s === 'W' ? 1 : -1) * (T0 + 0.004) / 2;
    seg.filter(([p, q]) => q - p > 0.05).forEach(([p, q]) => ton('#d4d1cb', () => sd.axel === 'x'
      ? sbNeutral(q - p, 0.007, T0 + 0.004, (p + q) / 2, top + 0.0035, ln, 0.0015)
      : sbNeutral(T0 + 0.004, 0.007, q - p, ln, top + 0.0035, (p + q) / 2, 0.0015)));
  });
  // två infällda spotar längs rummets längre led
  const lx = x1 - x0 > z1 - z0;
  [-1, 1].forEach(k => spot((x0 + x1) / 2 + (lx ? k * (x1 - x0) / 4 : 0), (z0 + z1) / 2 + (lx ? 0 : k * (z1 - z0) / 4)));
}

// Badrumsgolv i matta klinker 60 x 60 med fall (1–1,5 cm) mot duschens linjära brunn.
function badGolv(x0, x1, z0, z1) {
  const du = DUSCHAR.filter(d => d.cx > x0 && d.cx < x1 && d.cz > z0 && d.cz < z1);
  const kx = [], kz = [];
  du.forEach(d => { kx.push(d.x0, d.x1); kz.push(d.z0, d.z1); (d.axel === 'z' ? kz : kx).push(d.linje - 0.035, d.linje + 0.035); });
  const hojd = (x, z) => {
    for (const d of du) {
      if (x < d.x0 - 1e-4 || x > d.x1 + 1e-4 || z < d.z0 - 1e-4 || z > d.z1 + 1e-4) continue;
      const a = Math.abs((d.axel === 'z' ? z : x) - d.linje);
      // alltid över husets bjälklag (y 0): annars flimrade golvet närmast brunnen
      return a < 0.0351 ? 0.003 : 0.003 + 0.009 * Math.min(1, (a - 0.035) / Math.max(0.05, d.max - 0.035));
    }
    return 0.012;
  };
  const xs = bryt(x0, x1, kx.filter(v => v > x0 && v < x1), 0.3, [0.035]), zs = bryt(z0, z1, kz.filter(v => v > z0 && v < z1), 0.3, [0.035]);
  // klinker 60 x 60 centrerat i rummet (egen textur: fogarna lika breda åt båda hållen)
  const K = kakelSattning(x0, x1, z0, z1, 0.016);
  ton('#b3aca2', () => glans(2, () => yta('klinker', (u, v) => V(u, hojd(u, v), v), V(0, 1, 0), xs, zs, () => z1, [], p => [(p.x - K.gx) / 1.2, (p.z - K.gz) / 1.2])));
}

// ---- Växter av bladkort ----
// Matt kruka med vulstad kant och mörk, lite ojämn jord en bit ner i krukan.
function kruka(x, y, z, r, h, fg) {
  ton(fg, () => glans(3, () => svarv('keramik', [[0, 0], [r * 0.76, 0], [r * 0.79, h * 0.02], [r * 0.95, h * 0.84], [r * 0.99, h * 0.9], [r * 1.025, h * 0.94], [r * 1.02, h * 0.985], [r * 0.99, h], [r * 0.93, h], [r * 0.9, h * 0.96], [r * 0.875, h * 0.8], [0, h * 0.8]], x, y, z, 24)));
  const g = new T.RingGeometry(0.002, r * 0.895, 24, 3).rotateX(-PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = Math.hypot(p.getX(i), p.getZ(i)) / (r * 0.895); p.setY(i, 0.006 * (1 - q * q) + 0.003 * Math.sin(p.getX(i) * 140 + p.getZ(i) * 90)); }
  g.computeVertexNormals();
  // (jorden 4 % högre och lite ljusare, så att den syns innanför kanten)
  ton('#4a3a2c', () => lagg('tyg', g, mx(x, y + h * 0.895, z)));
}

// Avsmalnande rör längs en mjuk kurva (skaft, stammar, rötter). Ger tillbaka kurvan.
function tub(mk, pts, r0, r1, seg = 12, rad = 5) {
  const k = new T.CatmullRomCurve3(pts, false, 'centripetal'), g = new T.TubeGeometry(k, seg, 1, rad, false), p = g.attributes.position, c = V(0, 0, 0);
  for (let i = 0; i <= seg; i++) {
    k.getPointAt(i / seg, c); const rr = r0 + (r1 - r0) * i / seg;
    for (let j = 0; j <= rad; j++) { const q = i * (rad + 1) + j; p.setXYZ(q, c.x + (p.getX(q) - c.x) * rr, c.y + (p.getY(q) - c.y) * rr, c.z + (p.getZ(q) - c.z) * rr); }
  }
  lagg(mk, g, mx(0, 0, 0));
  return k;
}

function stjalk(x, y, z, az, lut, L, r0, r1, fg) {
  const d = rikt(az, lut);
  ton(fg, () => lagg('tyg', new T.CylinderGeometry(r1, r0, L, 5), mx(x + d.x * L / 2, y + d.y * L / 2, z + d.z * L / 2, az, lut, 0)));
  return V(x, y, z).addScaledVector(d, L);
}

// Pothos: hjärtblad 3–6 cm i grönt och gulgrönt (marmorerat), tätt vid krukan.
const POTHOSTON = ['#ffffff', '#f4f8e6', '#fff4c8', '#e3ecd4', '#fbf0bd', '#eef3e2', '#d9e6c9'];
const pothosBlad = (len, x, y, z, az, lut, o = {}) =>
  bladkort(rnd() < 0.68 ? BL.pothos : BL.pothos2, len, x, y, z, az, lut, { bag: 0.16, vik: 0.16, ny: 3, ton: POTHOSTON[Math.floor(rnd() * POTHOSTON.length)], ...o });
// tät krona i krukan
function pothosKrona(x, y, z, n, r) {
  for (let i = 0; i < n; i++) {
    const az = i * 2.39996 + rnd() * 0.6, rr = r * Math.sqrt(rnd());
    pothosBlad(0.042 + rnd() * 0.022, x + Math.sin(az) * rr, y + rnd() * 0.025, z + Math.cos(az) * rr, az, 0.45 + rnd() * 0.95);
  }
}
// En ranka längs en mjuk kurva: tät och storbladig nära krukan, glesare och mindre mot
// spetsen; bladen sitter växelvis, vända utåt med spetsen nedåt.
function ranka(pts, ut = V(0, 0, 1)) {
  const kurva = new T.CatmullRomCurve3(pts, false, 'centripetal');
  ton('#6d8a4c', () => lagg('tyg', new T.TubeGeometry(kurva, Math.max(8, pts.length * 2), 0.0022, 3, false), mx(0, 0, 0)));
  const lang = kurva.getLength(), n = Math.max(4, Math.round(lang * 30));
  const azUt = Math.atan2(ut.x, ut.z);
  for (let i = 0; i < n; i++) {
    const u = 0.04 + 0.95 * Math.pow(i / n, 1.45), p = kurva.getPointAt(u), tg = kurva.getTangentAt(u);
    const sd = i % 2 ? 1 : -1, sid = V(tg.z, 0, -tg.x).normalize().multiplyScalar(0.0025 * sd);
    pothosBlad(0.036 + 0.03 * (1 - u) + rnd() * 0.012, p.x + sid.x, p.y, p.z + sid.z, azUt + sd * 0.9 + (rnd() - 0.5) * 1.6, 1.5 + rnd() * 1.1, { rull: (rnd() - 0.5) * 1.8, vik: 0.24, bag: 0.2 });   // bladen vrids åt olika håll: syns också från sidan (längs väggen)
  }
  return kurva;
}

// Liten krukväxt (pothos) på bord och hyllor: tät krona och två korta rankor över kanten.
function smavaxt(x, z, y = 0) {
  skugga(x, z, 0.12, 0.12, 0, 0.07, 0.35, y + 0.021);
  kruka(x, y, z, 0.065, 0.11, '#e2dbcf');
  // Bladen växer ur jorden på egna skaft: de yttre lutar ut över krukans kant (ovanför den,
  // aldrig genom godset), de inre står mer upprätt och är mindre och ljusare (nya blad).
  // Förr låg bladen som lösa flak i och genom krukan.
  const yj = y + 0.11 * 0.895 + 0.004, N = 13;
  for (let i = 0; i < N; i++) {
    const inre = i >= 8, az = i * 2.39996 + rnd() * 0.5, rr = (inre ? 0.012 : 0.03) * (0.5 + rnd() * 0.5), lut = inre ? 0.15 + rnd() * 0.35 : 0.55 + rnd() * 0.5;
    const H = (inre ? 0.07 : 0.045) + rnd() * 0.03, bx = x + Math.sin(az) * rr, bz = z + Math.cos(az) * rr;
    const topp = stjalk(bx, yj - 0.004, bz, az, lut * 0.55, H, 0.0022, 0.0016, '#6f8a4c');
    pothosBlad((inre ? 0.04 : 0.052) + rnd() * 0.02, topp.x, topp.y, topp.z, az, lut + 0.25, { bag: 0.22, vik: 0.2, ny: 3, rull: (rnd() - 0.5) * 0.5, ...(inre ? { ton: '#f4fbe2' } : {}) });
  }
}

// Pothos på en hylla med rankor som hänger ner över kanten. Lokalt: +z ut från väggen.
// Stjälkarna svänger och pendlar mjukt, några har korta sidoskott.
function slinga(x, y, z, kort = false) {
  kruka(x, y, z, 0.07, 0.12, '#d9d2c6');
  pothosKrona(x, y + 0.115, z, 20, 0.05);
  // fem enskilda rankor med luft emellan: olika långa, isär i sidled och på olika djup från
  // väggen, så att de läses som egna stjälkar med blad och inte som en platt grön matta
  for (let k = 0; k < 5; k++) {
    const lang = (kort ? 0.12 + rnd() * 0.2 : 0.22 + rnd() * 0.62) * (k % 2 ? 0.75 : 1), sid = (k - 2) * 0.042, sv = 0.03 + rnd() * 0.04, fas = rnd() * 6, drift = (rnd() - 0.5) * 0.2, dj = 0.012 * (k % 3);
    const pts = [V(x + sid * 0.5, y + 0.118, z + 0.03), V(x + sid * 0.85, y + 0.112, z + 0.11), V(x + sid, y + 0.06, z + 0.17 + dj)];
    for (let j = 1; j <= 6; j++) {
      const t = j / 6;
      pts.push(V(x + sid + drift * t + Math.sin(t * 3.4 + fas) * sv * t, y + 0.06 - lang * t, z + 0.175 + dj + 0.035 * Math.sin(t * PI) - 0.015 * t));
    }
    const kurva = ranka(pts);
    if (k % 2 === 0 && lang > 0.45) {
      const p = kurva.getPointAt(0.35), s = rnd() < 0.5 ? -1 : 1, l2 = 0.12 + rnd() * 0.12;
      ranka([p, V(p.x + s * 0.035, p.y - l2 * 0.35, p.z + 0.02), V(p.x + s * 0.06, p.y - l2 * 0.75, p.z + 0.015), V(p.x + s * 0.065, p.y - l2, p.z)]);
    }
  }
}

// ---- Textil, badrum och sovrum: detaljer ----
// Tyg över en stång (handduk, pläd över en stolsrygg): stången längs lokalt x i (x, y, z),
// +z framåt. hf/hb = hur långt tyget hänger fram/bak. Mjuka veck som växer nedåt, rullad fåll.
function overStang(w, hf, hb, x, y, z, ry = 0, o = {}) {
  const r = o.r ?? 0.012, nx = o.nx ?? 9, ns = 16, L = hb + PI * r + hf, hmax = Math.max(hf, hb);
  const pos = [], ix = [];
  for (let j = 0; j <= ns; j++) {
    const s = j / ns * L;
    let yy, zz, d, sd;
    if (s < hb) { d = hb - s; yy = -d; zz = -r; sd = -1; }
    else if (s < hb + PI * r) { const a = (s - hb) / r; yy = r * Math.sin(a); zz = -r * Math.cos(a); d = 0; sd = 0; }
    else { d = s - hb - PI * r; yy = -d; zz = r; sd = 1; }
    for (let i = 0; i <= nx; i++) {
      const u = i / nx - 0.5, k = Math.min(1, d / 0.12), slut = Math.pow(d / hmax, 6);
      const veck = (o.veck ?? 0.011) * k * (Math.sin(u * w * 2 * PI / 0.12 + sd * 1.3) * 0.7 + Math.sin(u * w * 2 * PI / 0.05) * 0.3);
      // rock (o.rock): smala, mjukt sluttande axlar runt kroken som vidgas nedåt
      const vid = o.rock ? 0.42 + 0.58 * Math.pow(Math.min(1, d / 0.4), 0.6) : 1, axl = o.rock ? 0.05 * (2 * u) ** 2 * (1 - Math.min(1, d / 0.3)) : 0;
      const xx = u * w * vid * (1 - 0.035 * slut) + (o.sned ?? 0) * d * sd;
      pos.push(xx, yy - axl + 0.012 * Math.pow(Math.abs(u) * 2, 4) * slut, zz + sd * (veck + (o.veck ?? 0.011) * k + 0.004 * k));
    }
  }
  // varvet så att normalerna pekar utåt från stången (förr inåt: framsidan räknades som
  // vänd mot väggen och fick väggens hörnmörker, handdukar och rocken blev smutsigt mörka)
  for (let j = 0; j < ns; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; ix.push(a, a + nx + 2, a + 1, a, a + nx + 1, a + nx + 2); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  const m = mx(x, y, z, ry);
  lagg('tyg', g, m);
  // rullade fållar nertill
  for (const [h, sd] of [[hf, 1], [hb, -1]]) if (h > 0.03) lagg('tyg', new T.CylinderGeometry(0.005, 0.005, w * 0.96, 6).rotateZ(PI / 2).translate(0, -h, sd * (r + 0.003)), m.clone());
}

// Handduk som hänger från en krok (lokalt: kroken i origo, +z ut från väggen): hopsamlad i
// hängaren upptill, faller i djupa veck som jämnas ut nedåt, vågig nederkant och en vävd
// bård i mörkare ton en bit upp. Ett enda tygstycke (tre delar för bårdens färg).
function krokHandduk(x, y, z, ry, w, L, fg = '#f2eee7') {
  const NX = 18, T0 = [0, 0.03, 0.1, 0.24, 0.45, 0.68, 0.86, 0.9, 0.94, 1], fas = x * 31 + z * 17;
  const del = (i0, i1) => { const pos = [], ix = [];
    for (let j = i0; j <= i1; j++) { const t = T0[j], bred = w * (0.1 + 0.62 * Math.pow(Math.min(1, t / 0.3), 0.7) + 0.06 * t), amp = 0.006 + 0.022 * Math.min(1, t / 0.2) * (1 - 0.45 * t);
      for (let i = 0; i <= NX; i++) { const u = i / NX - 0.5;
        pos.push(u * bred + 0.004 * Math.sin(t * 9 + fas), -L * t - 0.02 * (2 * u) ** 2 * (1 - t) + (j === T0.length - 1 ? 0.008 * Math.sin(u * 14 + fas) : 0), 0.014 + amp * (1 + Math.sin(u * 2 * PI * 3.5 + fas + t * 0.8)) + 0.012 * t); }
      if (j > i0) for (let i = 0; i < NX; i++) { const a = (j - 1 - i0) * (NX + 1) + i, b = a + NX + 1; ix.push(a, b, a + 1, a + 1, b, b + 1); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
    lagg('tyg', g, mx(x, y, z, ry)); };
  ton(fg, () => { del(0, 6); del(8, 9); });
  ton(skiftTon(fg, 0.8), () => del(6, 7));
  ton(skiftTon(fg, 0.92), () => del(7, 8));
  // hängaren: en liten ögla upp till kroken
  ton(skiftTon(fg, 0.9), () => lagg('tyg', new T.TorusGeometry(0.012, 0.003, 4, 8), mx(x, y + 0.008, z, ry, 0, 0).multiply(new T.Matrix4().makeTranslation(0, 0, 0.014))));
}

// Vikt handduk/pläd: lager med rundade kanter och en rundad vikkant fram (lokalt +z).
function vikt(w, d, h, x, y, z, ry = 0, fg = '#efe9df', lag = 'frotte', mk = 'tyg') {
  // Tvärsnittet är ett vikt tyg: två mjuka lager med en synlig vikning (veck) i framkanten,
  // rundad bakkant och en lätt välvd ovansida; ändarna smalnar av mjukt (inga klossar).
  const P = [[-d / 2 + 0.2 * h, 0], [d / 2 - 0.3 * h, 0], [d / 2 - 0.05 * h, 0.12 * h], [d / 2, 0.27 * h], [d / 2 - 0.05 * h, 0.43 * h], [d / 2 - 0.24 * h, 0.5 * h],
    [d / 2 - 0.05 * h, 0.57 * h], [d / 2, 0.73 * h], [d / 2 - 0.05 * h, 0.88 * h], [d / 2 - 0.3 * h, h], [0, 1.04 * h], [-d / 2 + 0.25 * h, h], [-d / 2, 0.8 * h], [-d / 2, 0.2 * h]];
  const e = Math.min(0.014, h * 0.3), N = P.length, pos = [], ix = [];
  [[-w / 2, 0.8], [-w / 2 + e, 1], [w / 2 - e, 1], [w / 2, 0.8]].forEach(([sx, k], i) => {
    P.forEach(([pz, py]) => pos.push(sx, h / 2 + (py - h / 2) * k, pz * (1 - (1 - k) * 0.12)));
    if (i) for (let q = 0; q < N; q++) { const a = (i - 1) * N + q, b = (i - 1) * N + (q + 1) % N, c = i * N + q, f = i * N + (q + 1) % N; ix.push(a, c, b, b, c, f); }
  });
  for (let q = 1; q < N - 1; q++) ix.push(0, q, q + 1, 3 * N, 3 * N + q + 1, 3 * N + q);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  ton(fg, () => vav(lag, () => lagg(mk, g, mx(x, y, z, ry))));
}

// Lampskärm i linne: öppen upptill och nertill, med godstjocklek (två radier) och
// fållade kanter. Bas i y, r0 nedre och r1 övre radie, h höjd. Lyser varmt på kvällen.
function skarm(x, y, z, r0, r1, h, fg = '#efe7d9', mk = 'skarm', namn = 'Lampa') {
  const t = 0.003, P = [[r0 - t, 0.004], [r0, 0], [r0 + 0.001, 0.006], [r1 + 0.001, h - 0.006], [r1, h], [r1 - t, h - 0.004], [r0 - t, 0.004]];
  // stängd trumma: linneskärmen och två opalskivor (diffusorer) som döljer glödlampan;
  // allt är lampans egen lysande del (lyser igenom tyget när den är tänd)
  const i = egenLampa(namn, [x, y + h * 0.5, z], () => ton(fg, () => vav('linne', () => {
    svarv(mk, P, x, y, z, 32);
    lagg(mk, new T.CircleGeometry(r0 - t, 32).rotateX(PI / 2), mx(x, y + 0.01, z));
    lagg(mk, new T.CircleGeometry(r1 - t, 32).rotateX(-PI / 2), mx(x, y + h - 0.01, z));
  })), false, [[x, y + h * 0.5, z, Math.max(0.35, r0 * 3), r0 + 0.08]]);   // glorian framför hela skärmen: ingen hård ljus/mörk-gräns där skärmen skymde den
  // lamphållare (grafit) och en trådring i mässing med tre ekrar upp till skärmens överkant
  ton('#55534f', () => lagg('diskstal', new T.CylinderGeometry(0.014, 0.014, 0.04, 16), mx(x, y + 0.03, z)));
  ton('#c8a46c', () => {
    for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3, ex = x + Math.cos(a) * (r1 - 0.004), ez = z + Math.sin(a) * (r1 - 0.004), sx = x + Math.cos(a) * 0.014, sz = z + Math.sin(a) * 0.014;
      const p0 = V(sx, y + 0.05, sz), p1 = V(ex, y + h - 0.003, ez), L = p0.distanceTo(p1), mid = p0.clone().add(p1).multiplyScalar(0.5), q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize());
      lagg('diskstal', new T.CylinderGeometry(0.0015, 0.0015, L, 4).applyQuaternion(q).translate(mid.x, mid.y, mid.z), mx(0, 0, 0)); }
  });
  // tunna mässingsringar i över- och underkant
  ton('#c8a46c', () => { lagg('diskstal', new T.TorusGeometry(r0 + 0.002, 0.0035, 6, 32).rotateX(PI / 2), mx(x, y + 0.001, z)); lagg('diskstal', new T.TorusGeometry(r1 + 0.002, 0.0035, 6, 32).rotateX(PI / 2), mx(x, y + h - 0.001, z)); });
  return i;
}
// Bordslampa: svarvad fot (keramik, eller ek med fot 'ek'), mässingshals och linneskärm.
// fot 'ek': ekfot med mässingshals; skärmen i lampmaterialet i taklagret (loftet har inga
// egna ritanrop över för skärm och sken)
function bordslampa(x, y, z, s = 1, fot = '#c9b8a0') {
  const P = [[0, 0], [0.055, 0], [0.068, 0.012], [0.075, 0.05], [0.068, 0.1], [0.048, 0.15], [0.026, 0.19], [0.016, 0.21], [0.014, 0.225], [0, 0.225]].map(([a, b]) => [a * s, b * s]);
  if (fot === 'ek') svarv('ek', P, x, y, z, 28); else ton(fot, () => glans(0.8, () => svarv('keramik', P, x, y, z, 28)));
  if (fot === 'ek') {
    ton('#e8c98a', () => cyl('ek', 0.005, 0.005, 0.1 * s, x, y + 0.27 * s, z, 8));
    iLager('tak', () => skarm(x, y + 0.27 * s, z, 0.115 * s, 0.09 * s, 0.17 * s, null, 'lampa', 'Bordslampa'));
    return;
  }
  ton('#b08d57', () => cyl('keramik', 0.005, 0.005, 0.1 * s, x, y + 0.27 * s, z, 12));
  const li = skarm(x, y + 0.27 * s, z, 0.115 * s, 0.09 * s, 0.17 * s, undefined, 'skarm', 'Sänglampa');
  sken(li, x, y + 0.002, z, 0.1 * s, 0.1 * s, 0.5, false, 0.07);   // varm ljuspöl på skivan
  // skärmen lyser också upp väggen bakom bordet (sovrummen var dunkla på kvällen)
  const c = V(x, 0, z).applyMatrix4(BAS), yv = V(x, y + 0.36 * s, z).applyMatrix4(BAS).y;
  EFTER.push(() => lampVaggSken(li, c.x, c.z, yv, 0.5, 0.7, 0.19));
}

// Ljusskärm på väggarm (sänglampa): (x, z) vid väggytan, ry så att +z pekar ut i rummet.
function vagglampa(x, y, z, ry) {
  med(x, z, ry, () => {
    // väggplatta i grafit, arm och hals i mässing
    ton('#4f4d49', () => cyl('diskstal', 0.035, 0.035, 0.012, 0, y - 0.045, 0.006, 24, false, PI / 2));
    ton('#c8a46c', () => { cyl('diskstal', 0.006, 0.006, 0.17, 0, y - 0.045, 0.09, 10, false, PI / 2); cyl('diskstal', 0.004, 0.004, 0.065, 0, y - 0.0125, 0.17, 8); });
    const li = skarm(0, y - 0.03, 0.17, 0.085, 0.065, 0.14, undefined, 'skarm', 'Vägglampa');
    sken(li, 0, y - 0.02, 0.004, 0.1, 0.4, 0.4, true, 0.26);   // skenet på väggen (bred mjuk kant: ingen ruta)
  });
}

// Bänk vid sängens fot: ekben, stoppad dyna, pläd över ena änden och vikta kläder.
function bank(w = 1.1, d = 0.38, fg = '#b9a68a', pled = '#9da690') {
  skugga(0, 0, w, d, 0, 0.14, 0.4);
  hind(w, d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lagg('ek', new T.CylinderGeometry(0.018, 0.014, 0.4, 8), mx(sx * (w / 2 - 0.06), 0.2, sz * (d / 2 - 0.06)));
  rbx('ek', w, 0.035, d, 0, 0.415, 0, 0.012, 0, 0, 2);
  ton(ljusTon(fg, 0.15), () => dyna('tyg', w - 0.03, 0.06, d - 0.03, 0, 0.462, 0, { r: 0.022, puff: 0.012, sjunk: 0.003, fram: 0.004, sida: 0.004, veck: 0.0015, kant: 'topp' }));
  if (pled) ton(pled, () => vav('stick', () => med(w / 2 - 0.2, 0, PI / 2, () => draperi('tyg', { B: d / 2 - 0.004, z0: -0.2, z1: 0.2, y: 0.514, th: 0.016, hs: 0.16, hf: 0.0, R: 0.03, veck: 0.004, nx: 16, nz: 14 }))));
  vikt(0.3, 0.24, 0.05, -w / 2 + 0.25, 0.497, 0.0, 0.08, '#e4ddd0', 'stick');
  vikt(0.28, 0.22, 0.04, -w / 2 + 0.26, 0.547, 0.0, -0.05, '#a9b1ba', 'stick');
}

// Liten pall med en vikt pläd ovanpå.
const pall = (...a) => vav('stick', () => pall0(...a));
function pall0(fg = '#d6cab8', pled = '#cfae8a') {
  skugga(0, 0, 0.4, 0.4, 0, 0.12, 0.42);
  hind(0.42, 0.42);
  // mjukt rundad topp
  ton(fg, () => svarv('tyg', [[0, 0], [0.18, 0], [0.2, 0.03], [0.205, 0.33], [0.199, 0.372], [0.18, 0.398], [0.13, 0.412], [0.06, 0.417], [0, 0.418]], 0, 0, 0, 48));
  // en liten vikt pläd mitt på toppen, helt innanför kanten
  vikt(0.22, 0.17, 0.035, 0, 0.414, 0, 0.12, pled, 'stick');
}

// Stol med en pläd över ryggen.
function stolPled(fg = '#cfc4b0', skinn = false) {
  stol(false);
  if (skinn) farskinn(0, 0.509, 0.03, 0, 0.17, 0.22, '#f1ebe0');
  ton(fg, () => vav('stick', () => overStang(0.34, 0.34, 0.24, 0, 0.852, -0.205, 0, { r: 0.024, veck: 0.006, sned: 0.08 })));
}

// Sko (lokalt: mitt på sulan, framåt +z). Sneaker: sula, ovandel, tåhätta, öppning med
// krage och snörning. Känga: sula med klack, fot och skaft i läder.
// Svarvad, öppen form med ovalt tvärsnitt (z-led * oval): profil [[r, y], ...] nerifrån.
function svarvOval(mk, prof, x, y, z, seg, oval) {
  const g = new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), seg).scale(1, 1, oval);
  g.computeVertexNormals();
  lagg(mk, g, mx(x, y, z));
}
// Formen byggs som en läst: tvärsnitt längs skon (häl -> tå) med smal häl, bred trampdyna
// och rundad tå, låg över tårna och högre över vristen; sulan är en egen kant i annan ton
// (kängor och stövlar med klack). sida = +1/-1 speglar lästen (höger/vänster).
// Typer: 'sneaker', 'kanga' (snörd, kort skaft), 'stovel' (högt skaft), 'toffel' (öppen bak).
// (15 tvärsnitt, tätare vid häl och tå där formen rundas: ytan blir mjuk i stället för facetterad)
// Lästen: hälkappan reser sig brant, högst över vristen (u 0,2–0,3), sedan sjunker ovanlädret
// mot en låg, rund tåhätta. SKO_K = hur mycket tvärsnittet smalnar uppåt (ås över vristen,
// platt kupol över tårna), så att skon inte blir en limpa.
// (tätare tvärsnitt runt tån, så att tåhättan och sulkanten blir runda och inte kantiga)
const SKO_U = [0, 0.02, 0.05, 0.1, 0.16, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.85, 0.9, 0.94, 0.97, 0.99, 1];
const SKO_W = [0.01, 0.021, 0.028, 0.033, 0.0355, 0.0365, 0.0365, 0.037, 0.0385, 0.041, 0.0435, 0.045, 0.0445, 0.0415, 0.037, 0.031, 0.0235, 0.015, 0.005];
const SKO_H = [0.036, 0.057, 0.067, 0.073, 0.076, 0.077, 0.075, 0.07, 0.062, 0.054, 0.047, 0.041, 0.036, 0.0325, 0.029, 0.024, 0.018, 0.011, 0.003];
const SKO_K = [0.2, 0.24, 0.28, 0.32, 0.38, 0.44, 0.5, 0.52, 0.5, 0.44, 0.34, 0.22, 0.12, 0.05, 0.02, 0, 0, 0, 0];
// punkt på ovanlädret i tvärsnitt i, vinkel v (0 = yttersidans sulkant, pi/2 = åsen);
// kf < 1 ger en bredare ås (kängor och stövlar: foten fyller ut mot skaftet)
const skoSek = (i, v, w, h, kf = 1) => { const co = Math.cos(v), si = Math.sin(v); return [-Math.sign(co) * Math.pow(Math.abs(co), 0.75) * w * (1 - SKO_K[i] * kf * si * si), h * Math.pow(si, 0.9)]; };
function sko(x, y, z, ry, typ, fg, sida = 1) {
  iRam(mx(x, y, z, ry), () => {
    const L = 0.27, stov = typ === 'stovel', kang = typ === 'kanga', toff = typ === 'toffel', klack = stov || kang, n = SKO_U.length;
    const zU = u => (u - 0.5) * L, cx = u => sida * 0.007 * Math.sin(PI * Math.min(1, u * 1.1));
    // sulans överkant: klack under hälen som går mjukt över i en tunnare sula under hålfoten
    // (kängor, stövlar), jämntjock på sneakers; lätt tåfjädring
    const mjukt = (a, b, q) => { const t = Math.min(1, Math.max(0, (q - a) / (b - a))); return t * t * (3 - 2 * t); };
    const bas = u => (klack ? 0.036 - 0.019 * mjukt(0.27, 0.4, u) : toff ? 0.014 : 0.026);
    const sh = u => bas(u) + (u > 0.82 ? (u - 0.82) * 0.04 : 0);
    const hov = SKO_H.map(h => (klack ? h * 1.1 : toff ? Math.min(h, 0.046) : h));
    // åsens bredd: runt öppningen fyller foten ut (skaft och krage möter ovanlädret utan skarv)
    const kfU = u => (klack ? 0.2 : 0.5) + (klack ? 0.8 : 0.5) * mjukt(0.28, 0.48, u);
    // sulan: en kant som sticker ut 4 mm runt om, med rundad underkant
    {
      const pos = [], ix = [];
      SKO_U.forEach((u, i) => { const w = SKO_W[i] + 0.004, c = cx(u), zz = zU(u) * 1.02, lyft = sh(u) - bas(u) + (klack && u > 0.3 && u < 0.42 ? 0.012 * Math.sin((u - 0.3) / 0.12 * PI) : 0);
        pos.push(c - w * 0.86, lyft, zz, c - w, lyft + (sh(u) - lyft) * 0.55, zz, c - w * 0.97, sh(u) + 0.002, zz, c + w * 0.97, sh(u) + 0.002, zz, c + w, lyft + (sh(u) - lyft) * 0.55, zz, c + w * 0.86, lyft, zz);
        if (i) for (const k of [0, 1, 3, 4]) { const a = (i - 1) * 6 + k, b = i * 6 + k; ix.push(a, b, a + 1, a + 1, b, b + 1); } });
      for (const [e, vnd] of [[0, 0], [(n - 1) * 6, 1]]) for (let k = 1; k < 5; k++) ix.push(e, e + (vnd ? k + 1 : k), e + (vnd ? k : k + 1));
      // (sulans ovansida täcks av ovandelen och ritas inte; kanten får plana, lodräta normaler)
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
      ton(klack ? '#3b3029' : toff ? skiftTon(fg, 0.8) : '#f1efea', () => lagg('vit', g, mx(0, 0, 0)));
    }
    // ovandelen: halv båge per tvärsnitt, från sulkant över vristen till sulkant
    {
      // (skor inne i garderober: färre segment runt om och ingen snörning, de syns bara på avstånd)
      const NA = SKO_ENKEL ? 7 : 12, i0 = toff ? 9 : 0, pos = [], ix = [];
      for (let i = i0; i < n; i++) { const u = SKO_U[i], w = SKO_W[i], c = cx(u), h = hov[i] * (toff && i === i0 ? 0.92 : 1);
        for (let a = 0; a < NA; a++) { const [px, py] = skoSek(i, a / (NA - 1) * PI, w, h, kfU(u));
          pos.push(c + px, sh(u) - 0.002 + py, zU(u)); }
        if (i > i0) for (let a = 0; a < NA - 1; a++) { const p = (i - 1 - i0) * NA + a, q = (i - i0) * NA + a; ix.push(p, q, p + 1, p + 1, q, q + 1); } }
      // hälkappan och tåspetsen stängda
      for (let a = 1; a < NA - 1; a++) { const e = (n - 1 - i0) * NA; ix.push(e, e + a, e + a + 1); if (!toff) ix.push(0, a + 1, a); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
      ton(fg, () => lagg('tyg', g, mx(0, 0, 0)));
    }
    if (toff) return;
    // öppning: stoppad krage runt en mörk (inte svart) insida; kängor och stövlar får ett skaft
    const oz = zU(0.2), oy = sh(0.2) + hov[5], H = stov ? 0.23 : kang ? 0.07 : 0, ox = cx(0.2), lutS = stov ? -0.07 : -0.03;
    // skaftet: smalt vid vristen med två mjuka veck, vidgas uppåt mot kragen, lätt bakåtlutat
    if (H) ton(fg, () => { const g = new T.LatheGeometry((stov ? [[0.033, -0.03], [0.0315, 0], [0.0295, 0.03], [0.032, 0.045], [0.0295, 0.06], [0.0315, 0.078], [0.0315, 0.095], [0.036, 0.15], [0.042, H]] : [[0.033, -0.03], [0.0315, 0], [0.03, 0.025], [0.032, 0.05], [0.034, H]]).map(q => new T.Vector2(q[0], q[1])), 14).scale(1, 1, 1.28);
      g.computeVertexNormals(); lagg('tyg', g, mx(ox, oy - 0.016, oz - 0.002, 0, lutS)); });
    const ty = H ? oy - 0.016 + H * Math.cos(lutS) : oy - 0.008, tz = oz - 0.002 + (H ? H * Math.sin(lutS) : -0.002), rO = stov ? 0.042 : kang ? 0.034 : 0.023;
    const hAt = u => { let i = 1; while (i < n - 1 && SKO_U[i] < u) i++; const f = (u - SKO_U[i - 1]) / (SKO_U[i] - SKO_U[i - 1]); return hov[i - 1] + (hov[i] - hov[i - 1]) * f; };
    // stoppad skaftkant med tjocklek runt en mörk (inte svart) öppning
    ton(klack ? skiftTon(fg, 0.85) : '#dcd6cb', () => lagg('tyg', new T.TorusGeometry(rO, 0.006, 6, 14).rotateX(PI / 2).scale(1, 1, H ? 1.28 : 1.6), mx(ox, ty, tz, 0, lutS)));
    ton(klack ? '#4a3a2e' : '#5a524a', () => lagg('tyg', new T.CircleGeometry(rO - 0.003, 12).rotateX(-PI / 2).scale(1, 1, H ? 1.28 : 1.6), mx(ox, ty - 0.004, tz, 0, lutS)));
    // snörning (inte på stövlar): fem snörpar som korsar över vristen mellan två rader hål,
    // lagda på ovanlädret (ändarna i hålen, mitten lyft 1,5 mm över åsen), och en plös som
    // sticker upp framför öppningen
    if (!stov && !SKO_ENKEL) {
      const yta = (u, v, lyft) => { const i = Math.max(1, SKO_U.findIndex(q => q >= u)), f = (u - SKO_U[i - 1]) / (SKO_U[i] - SKO_U[i - 1]);
        const a = skoSek(i - 1, v, SKO_W[i - 1], hov[i - 1], kfU(SKO_U[i - 1])), b = skoSek(i, v, SKO_W[i], hov[i], kfU(SKO_U[i])); return [cx(u) + a[0] + (b[0] - a[0]) * f, sh(u) - 0.002 + a[1] + (b[1] - a[1]) * f + lyft, zU(u)]; };
      const pos = [], ix = [], u0 = klack ? 0.4 : 0.42, du = 0.042, vH = 0.42, b = 0.0022;
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const ua = u0 + i * du, ub = ua + (i < 4 ? du : 0), o = pos.length / 3;
        [[ua, PI / 2 + s * vH, 0.0006], [(ua + ub) / 2, PI / 2, 0.0018], [ub, PI / 2 - s * vH, 0.0006]].forEach(([u, v, ly]) => { const p = yta(u, v, ly); pos.push(p[0], p[1], p[2] - b, p[0], p[1], p[2] + b); });
        ix.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4, o + 3, o + 5, o + 4); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
      ton(klack ? '#4a3d33' : '#c9c3b7', () => lagg('tyg', g, mx(0, 0, 0)));
      // snörhålen: små mörka prickar i två rader
      ton(klack ? '#2f2823' : '#8f8a80', () => { for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const p = yta(u0 + i * du, PI / 2 + s * vH, 0.0004); lagg('tyg', new T.CircleGeometry(0.0028, 6).rotateX(-PI / 2), mx(p[0], p[1], p[2], 0, 0, s * 0.5)); } });
      // plösen: en mjuk tunga som reser sig ur öppningens framkant
      if (!kang) ton(skiftTon(fg, 0.93), () => { const p = yta(0.37, PI / 2, 0); lagg('tyg', new T.SphereGeometry(1, 8, 4, 0, 2 * PI, 0, PI / 2).scale(0.019, 0.022, 0.006), mx(p[0], p[1] - 0.002, p[2], 0, -0.5)); });
    }
  });
}
// Ett par: skorna står lite ojämnt (den ena en aning framför och utåtvriden), olika per par.
const par = (x, y, z, a, typ, fg) => { const h = Math.abs(Math.sin(x * 127.1 + z * 311.7 + y * 74.7) * 43758.5453) % 1, h2 = (h * 7.13) % 1;
  [-1, 1].forEach(k => sko(x + k * (0.053 + 0.004 * h2), y, z + k * (0.006 + 0.016 * h) * (h2 > 0.5 ? 1 : -1), a + k * (0.03 + 0.09 * h2) + (h - 0.5) * 0.08, typ, fg, k)); };
// Hallbänk i ek: spjälsits på sarg och smala ben, nedre spjälhylla med skor, ullfilt och korg.
function hallbank(w = 0.9, d = 0.34) {
  skugga(0, 0, w, d, 0, 0.1, 0.4);
  hind(w, d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lagg('ek', new T.CylinderGeometry(0.017, 0.013, 0.42, 12), mx(sx * (w / 2 - 0.05), 0.214, sz * (d / 2 - 0.04)));
  for (const sz of [-1, 1]) rbx('ek', w - 0.06, 0.05, 0.02, 0, 0.397, sz * (d / 2 - 0.04), 0.004, 0, 0, 1);
  for (const sx of [-1, 1]) rbx('ek', 0.03, 0.05, d - 0.06, sx * (w / 2 - 0.05), 0.397, 0, 0.004, 0, 0, 1);
  for (let i = 0; i < 5; i++) rbx('ek', w, 0.022, d / 5 - 0.008, 0, 0.433, -d / 2 + (i + 0.5) * d / 5, 0.006, 0, 0, 1);
  for (const sx of [-1, 1]) rbx('ek', 0.03, 0.02, d - 0.05, sx * (w / 2 - 0.05), 0.12, 0, 0.004, 0, 0, 1);
  for (let i = 0; i < 4; i++) rbx('ek', w - 0.08, 0.016, 0.05, 0, 0.138, -d / 2 + 0.05 + i * (d - 0.1) / 3, 0.004, 0, 0, 1);
  vikt(0.36, 0.26, 0.05, -w / 2 + 0.24, 0.444, 0, 0.06, PAL.salvia, 'stick');
  ton('#c4a477', () => svarv('tyg', [[0, 0], [0.1, 0], [0.11, 0.12], [0.104, 0.12], [0.094, 0.01], [0, 0.01]], w / 2 - 0.16, 0.146, 0, 24));
  par(-0.2, 0.146, 0, 0.05, 'sneaker', '#f2f0ea');
  par(0.04, 0.146, -0.01, -0.06, 'sneaker', PAL.sand);
}
// Hallen vid ytterdörren: skobricka med kant och tre par skor (utan bänk), en krokrad i
// ek med runda knaggar, en rock och en väska som hänger på knaggarna.
function hallen(x, z, ry, o = {}) {
  med(x, z, ry, () => {
    if (!o.bank) {
      ton('#2a2826', () => {
        rbx('svart', 0.66, 0.008, 0.34, 0.1, 0.008, 0.25, 0.003, 0, 0, 1);
        for (const s of [-1, 1]) { box('svart', 0.66, 0.016, 0.006, 0.1, 0.016, 0.25 + s * 0.167); box('svart', 0.006, 0.016, 0.34, 0.1 + s * 0.327, 0.016, 0.25); }
      });
      skugga(0.1, 0.25, 0.66, 0.34, 0, 0.06, 0.3);
      par(-0.11, 0.012, 0.25, 0.06, 'stovel', '#86654a');
      par(0.11, 0.012, 0.26, -0.05, 'sneaker', '#f2f0ea');
      par(0.32, 0.012, 0.24, 0.1, 'kanga', '#8a6a4c');
    }
    rbx('ek', 0.72, 0.1, 0.02, 0.05, 1.7, 0.01, 0.004, 0, 0, 1);
    for (const k of [-0.2, 0.05, 0.3]) { lagg('ek', new T.CylinderGeometry(0.012, 0.012, 0.07, 14).rotateX(PI / 2), mx(k, 1.7, 0.055)); lagg('ek', new T.SphereGeometry(0.016, 14, 10), mx(k, 1.7, 0.092)); }
    // rock i kamelfärgad ull på galge över knaggen: samma mjuka plagg som i garderoben
    // (tung kropp med veck, ärmar som faller rakt ned längs sidorna, krage, knappar), vänd
    // med framsidan ut i rummet. Förr en platt figur med ärmar som stod ut som vingar.
    // (utan galge: rocken hänger i en tygögla vid kragen på knaggen)
    med(-0.2, 0.075, -PI / 2, () => plagg(0, 1.715, 0, 0.44, 0.98, 'rock', '#c2a888', 0, { fin: true, ogla: true }));
    // väska i konjaksbrunt läder: mjuk påse som bukar nedtill och smalnar mot öppningen,
    // rundade hörn, en axelrem som hänger i en lång ögla från knaggen och ett lock med kant
    // Kroppen är ringar nerifrån och upp (rundad rektangel i tvärsnitt) som bukar ut nedtill
    // där tyngden ligger; locket följer framsidan och har rundade nedre hörn och en kant; remmen
    // är ett platt band som går upp över knoppen och ned till väskans båda övre hörn.
    ton('#b9895c', () => {
      const bx = 0.3, by = 1.06, bz = 0.062, NA = 20, P = 0.42;
      const R = [[0, 0.11, 0.012], [0.008, 0.138, 0.034], [0.03, 0.152, 0.049], [0.08, 0.157, 0.051], [0.15, 0.155, 0.045], [0.2, 0.15, 0.036], [0.228, 0.144, 0.024], [0.24, 0.136, 0.01]];
      const pos = [], ix = [];
      R.forEach(([y, w, d], j) => { for (let a = 0; a < NA; a++) { const v = a / NA * 2 * PI, c = Math.cos(v), s = Math.sin(v);
          pos.push(bx + w * Math.sign(c) * Math.pow(Math.abs(c), P), by + y + 0.004 * Math.sin(c * 3 + j) * (1 - y / 0.24), bz + d * Math.sign(s) * Math.pow(Math.abs(s), P)); }
        if (j) for (let a = 0; a < NA; a++) { const p0 = (j - 1) * NA + a, p1 = (j - 1) * NA + (a + 1) % NA, q0 = j * NA + a, q1 = j * NA + (a + 1) % NA; ix.push(p0, p1, q0, p1, q1, q0); } });
      { const cb = pos.length / 3; pos.push(bx, by + 0.002, bz); for (let a = 0; a < NA; a++) ix.push(cb, a, (a + 1) % NA);
        const ct = cb + 1, e = (R.length - 1) * NA; pos.push(bx, by + 0.242, bz); for (let a = 0; a < NA; a++) ix.push(ct, e + (a + 1) % NA, e + a); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
      lagg('tyg', g, mx(0, 0, 0));
      // framsidans z vid (höjd över botten, x från mitten), för locket som ska ligga an
      const radVid = y => { let i = 1; while (i < R.length - 1 && R[i][0] < y) i++; const f = (y - R[i - 1][0]) / (R[i][0] - R[i - 1][0]); return [R[i - 1][1] + (R[i][1] - R[i - 1][1]) * f, R[i - 1][2] + (R[i][2] - R[i - 1][2]) * f]; };
      const framZ = (y, xx) => { const [w, d] = radVid(y), c = Math.min(1, Math.pow(Math.abs(xx) / w, 1 / P)); return bz + d * Math.pow(Math.sqrt(Math.max(0, 1 - c * c)), P); };
      const NU = 10, NS = 9, lp = [], li = [], kantP = [];
      for (let j = 0; j <= NS; j++) { const s = j / NS, y = s < 0.2 ? 0.236 : 0.236 - (s - 0.2) / 0.8 * 0.125, q = s < 0.72 ? 1 : 0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - ((s - 0.72) / 0.28) ** 2));
        for (let i = 0; i <= NU; i++) { const u = i / NU * 2 - 1, xx = u * 0.142 * q, zz = s < 0.2 ? bz + (framZ(0.236, xx) - bz) * (s / 0.2) + 0.006 : framZ(y, xx) + 0.005;
          lp.push(bx + xx, by + y + (s < 0.2 ? 0.006 : 0), zz); if (j === NS || i === 0 || i === NU) kantP.push([j, i, bx + xx, by + y, zz + 0.001]); }
        if (j) for (let i = 0; i < NU; i++) { const a = (j - 1) * (NU + 1) + i, b = a + NU + 1; li.push(a, b, a + 1, a + 1, b, b + 1); } }
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setIndex(li); lg.computeVertexNormals();
      ton('#a87a50', () => lagg('tyg', lg, mx(0, 0, 0)));
      // kant (kedern) runt lockets nederkant och sidor
      { const ut = []; for (let j = 2; j <= NS; j++) ut.push(V(...kantP.find(k => k[0] === j && k[1] === 0).slice(2)));
        for (let i = 1; i < NU; i++) ut.push(V(...kantP.find(k => k[0] === NS && k[1] === i).slice(2)));
        for (let j = NS; j >= 2; j--) ut.push(V(...kantP.find(k => k[0] === j && k[1] === NU).slice(2)));
        ton('#93693f', () => tub('tyg', ut, 0.0028, 0.0028, 40, 5)); }
      ton('#c8a46c', () => rbx('diskstal', 0.024, 0.016, 0.005, bx, by + 0.115, framZ(0.11, 0) + 0.008, 0.003, 0, 0, 1));
      // remmen: ett platt band (2 cm) från hörnen upp över knoppen, med en mjuk båge
      const band = pts => { const k = new T.CatmullRomCurve3(pts.map(q => V(...q)), false, 'centripetal'), N = 28, bp = [], bi = [];
        for (let i = 0; i <= N; i++) { const p = k.getPointAt(i / N), t = k.getTangentAt(i / N), sd = V(0, 0, 1).cross(t).normalize().multiplyScalar(0.0105);
          bp.push(p.x - sd.x, p.y - sd.y, p.z - sd.z, p.x + sd.x, p.y + sd.y, p.z + sd.z); if (i) { const q = i * 2; bi.push(q - 2, q - 1, q, q - 1, q + 1, q); } }
        const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals(); lagg('tyg', bg, mx(0, 0, 0)); };
      ton('#9d7149', () => { band([[bx - 0.128, by + 0.232, bz], [bx - 0.104, by + 0.36, bz + 0.012], [bx - 0.056, by + 0.52, bz + 0.026], [bx - 0.016, by + 0.632, 0.088], [bx, by + 0.66, 0.092], [bx + 0.016, by + 0.632, 0.088], [bx + 0.056, by + 0.52, bz + 0.026], [bx + 0.104, by + 0.36, bz + 0.012], [bx + 0.128, by + 0.232, bz]]);
        for (const s of [-1, 1]) rbx('tyg', 0.026, 0.022, 0.006, bx + s * 0.128, by + 0.222, bz + s * 0, 0.003, 0, 0, 1); });
    });
  });
}

// Levande ljus (lokalt): stearin med smält kant, veke och en droppformad låga i egen mesh.
function ljus(x, y, z, r = 0.03, h = 0.08, fg = '#f3eee4') {
  ton(fg, () => svarv('keramik', [[0, 0], [r, 0], [r, h - 0.004], [r - 0.003, h], [r * 0.55, h - 0.006], [0, h - 0.005]], x, y, z, 24));
  ton('#2a2826', () => box('svart', 0.0018, 0.012, 0.0018, x, y + h, z));
  const m = BAS.clone().multiply(new T.Matrix4().makeTranslation(x, y + h + 0.009, z));
  const P = [[0, -0.003], [0.0042, 0.001], [0.0055, 0.006], [0.0042, 0.013], [0.0016, 0.02], [0, 0.026]];
  const acc = fanga(m, () => lagg('flamma', new T.LatheGeometry(P.map(q => new T.Vector2(q[0], q[1])), 12), mx(0, 0, 0)));
  const mesh = new T.Group(); m.decompose(mesh.position, mesh.quaternion, mesh.scale); mesh.name = 'ljuslaga';
  LJUSL.push({ acc, m, mesh, lager: LAGER, los: LOS, pos: V(0, 0.01, 0).applyMatrix4(m).toArray().map(v => Math.round(v * 1000) / 1000) });
}
// Eldens textur (256 x 256): vänster halva en mjuk låga (vit-gul kärna, orange mantel,
// genomskinlig spets), höger överdel glöd (orange brus), höger nederdel ett runt sken.
function eldTextur() { return kor(eldTexturSteg()); }
function* eldTexturSteg() {
  if (typeof document === 'undefined') return null;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), d = x.createImageData(N, N);
  const ss = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  let sd = 99; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const brus = []; for (let i = 0; i < 64; i++) brus.push(r());
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = ((N - 1 - j) * N + i) * 4, v = (j + 0.5) / N;
    let R = 0, G = 0, B = 0, A = 0;
    if (i < N / 2) {
      // låga: v 0 nertill, 1 i spetsen; bredden en droppe som smalnar mot spetsen
      const u = (i + 0.5) / (N / 2) * 2 - 1, bred = 0.85 * Math.pow(Math.sin(PI * Math.min(1, v * 0.92 + 0.08)), 0.9) * (1 - v * 0.55);
      const q = Math.abs(u) / Math.max(0.02, bred), kropp = ss((1 - q) / 0.55) * ss((1 - v) / 0.35) * ss(v / 0.06);
      const karna = ss((1 - q * 1.8) / 0.5) * ss((0.55 - v) / 0.3);
      R = 1; G = 0.42 + 0.5 * karna + 0.15 * (1 - v); B = 0.08 + 0.55 * karna;
      A = kropp * (0.75 + 0.25 * karna);
    } else if (j >= N / 2) {
      // glöd: orange med mörkare och ljusare fläckar
      const u = (i - N / 2) / (N / 2), w = (j - N / 2) / (N / 2), n = brus[(Math.floor(u * 8) + Math.floor(w * 8) * 8) % 64] * 0.5 + 0.5 * Math.sin(u * 23 + w * 17) * Math.sin(u * 9 - w * 13);
      R = 1; G = 0.35 + 0.3 * n; B = 0.05 + 0.1 * n; A = 0.55 + 0.4 * n;
    } else {
      const u = (i - N * 0.75) / (N / 4), w = (j - N * 0.25) / (N / 4), q = Math.hypot(u, w);
      R = 1; G = 0.62; B = 0.3; A = Math.pow(ss(1 - q), 1.6) * 0.5;
    }
    d.data[k] = Math.round(R * 255); d.data[k + 1] = Math.round(Math.min(1, G) * 255); d.data[k + 2] = Math.round(Math.min(1, B) * 255); d.data[k + 3] = Math.round(Math.max(0, Math.min(1, A)) * 255);
    if (i === N - 1 && (j & 63) === 63) yield;   // paus var 64:e rad
  }
  x.putImageData(d, 0, 0);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
// uv-ruta [u0, v0, u1, v1] på en geometri med uv 0..1
const uvRuta = (g, [a, b, c2, e]) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, a + (c2 - a) * u.getX(i), b + (e - b) * u.getY(i)); return g; };

// Liten vedkamin i grafit (lokalt, framsidan +z) på en skifferplatta: eldstad med glaslucka,
// ved och glöd innanför, rökrör upp till taket och en vedkorg bredvid.
function kamin(ved = 1) {
  skugga(0, 0, 0.6, 0.5, 0, 0.12, 0.45, 0.03);
  hind(0.7, 0.55);
  ton('#474643', () => glans(2.4, () => rbx('keramik', 0.7, 0.014, 0.55, 0, 0.011, 0.02, 0.004, 0, 0, 1)));
  // kroppen i mörk grafit med lätt glans (inte svart), svarvade fötter
  ton('#3a3733', () => glans(1.7, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) svarv('keramik', [[0, 0], [0.02, 0], [0.022, 0.006], [0.014, 0.02], [0.012, 0.05], [0.018, 0.058], [0.018, 0.064], [0, 0.064]], sx * 0.17, 0.018, sz * 0.13, 16);
    const y0 = 0.078;
    rbx('keramik', 0.42, 0.62, 0.24, 0, y0 + 0.31, -0.06, 0.012, 0, 0, 2);            // bakre delen
    rbx('keramik', 0.42, 0.15, 0.12, 0, y0 + 0.62 - 0.075, 0.12, 0.012, 0, 0, 2);     // ovan luckan
    rbx('keramik', 0.42, 0.17, 0.12, 0, y0 + 0.085, 0.12, 0.012, 0, 0, 2);            // under luckan
    for (const s of [-1, 1]) rbx('keramik', 0.07, 0.3, 0.12, s * 0.175, y0 + 0.17 + 0.15, 0.12, 0.006, 0, 0, 1);
    // topplatta och luckans ram med rundade hörn
    rbx('keramik', 0.44, 0.016, 0.38, 0, y0 + 0.628, 0.0, 0.006, 0, 0, 2);
    { const sh = new T.Shape(); rundRekt(0, 0, 0.29, 0.31, 0.02).forEach(([a, b], i) => (i ? sh.lineTo(a, b) : sh.moveTo(a, b)));
      sh.holes.push(rundRektPath(0, 0, 0.235, 0.255, 0.012));
      lagg('keramik', new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 }), mx(0, y0 + 0.32, 0.18)); }
  }));
  // handtag i stål på två distanser vid luckans låssida, luftreglage under luckan
  ton('#c9c6c0', () => {
    for (const y of [0.078 + 0.27, 0.078 + 0.37]) stal(new T.CylinderGeometry(0.005, 0.005, 0.026, 12).rotateX(PI / 2), mx(0.122, y, 0.205));
    stal(new T.CapsuleGeometry(0.008, 0.11, 4, 12), mx(0.122, 0.078 + 0.32, 0.222));
    stalBox(0.16, 0.006, 0.004, 0, 0.078 + 0.11, 0.1815, 0.002);
    stal(new T.CylinderGeometry(0.007, 0.007, 0.022, 12).rotateX(PI / 2), mx(0.03, 0.078 + 0.11, 0.192));
    stal(new T.SphereGeometry(0.009, 14, 10), mx(0.03, 0.078 + 0.11, 0.204));
  });
  ton('#3a3733', () => glans(1.7, () => {
    const yt = 0.078 + 0.62;
    // rökrör upp till taket
    const wp = V(0, 0, -0.06).applyMatrix4(BAS), tt = Math.max(...[0, 1.57, 3.14, 4.71].map(a => takVid(wp.x + Math.cos(a) * 0.066, wp.z + Math.sin(a) * 0.066))) + 0.005, mid = Math.min(tt, SNITT[0]);
    // takkrage som följer takfallet
    { const [rx, rz] = takLut(wp.x, wp.z); iLager(lagerFor(takVid(wp.x, wp.z) - 0.01), () => iRam(new T.Matrix4().makeTranslation(wp.x, takVid(wp.x, wp.z) - 0.006, wp.z), () => lagg('keramik', new T.CylinderGeometry(0.095, 0.095, 0.012, 32), mx(0, 0, 0, 0, rx, rz)))); }
    cyl('keramik', 0.065, 0.065, mid - yt, 0, (yt + mid) / 2, -0.06, 24, true);
    if (tt > SNITT[0] + 0.02) iLager(lagerFor(tt - 0.01), () => cyl('keramik', 0.065, 0.065, tt - SNITT[0], 0, (SNITT[0] + tt) / 2, -0.06, 24, true));
  }));
  platta('glas', 0.23, 0.25, mx(0, 0.078 + 0.32, 0.192), null, [1, 1]);
  // eldstadens insida: sotig chamotte i mörkt varmgrått (bakvägg och sidor)
  ton('#3b302a', () => { box('keramik', 0.28, 0.3, 0.004, 0, 0.078 + 0.32, 0.062); for (const s of [-1, 1]) box('keramik', 0.004, 0.3, 0.12, s * 0.138, 0.078 + 0.32, 0.122); });
  // tre kluvna vedträn med bark (sexkantiga i snitt), förkolnad mitt och ljusa ändytor
  const yB = 0.078 + 0.17;
  [[-0.045, 0.03, 0.12, 0.35, 0.027], [0.05, 0.03, 0.11, -0.3, 0.025], [0.0, 0.07, 0.12, 0.05, 0.024]].forEach(([dx, dy, dz, a, r]) => {
    const L = 0.2, mm = mx(dx, yB + dy, dz, a, 0, PI / 2);
    ton('#4a3b2e', () => lagg('ek', new T.CylinderGeometry(r, r * 1.05, L, 6, 1, true), mm));
    ton('#b48e66', () => { for (const k of [-1, 1]) lagg('ek', new T.CircleGeometry(r * 1.02, 6).rotateX(-k * PI / 2).translate(0, k * (L / 2 + 0.0005), 0), mm.clone()); });
    ton('#1f1813', () => lagg('ek', new T.CylinderGeometry(r * 1.015, r * 1.065, L * 0.5, 6, 1, true), mm.clone()));
  });
  // glödbädd, lågor och skenet innanför glaset: kaminens egen lysande mesh
  const m = BAS.clone().multiply(new T.Matrix4().makeTranslation(0, yB, 0.12));
  const acc = fanga(m, () => {
    lagg('eld', uvRuta(new T.PlaneGeometry(0.26, 0.1).rotateX(-PI / 2), [0.52, 0.52, 0.98, 0.98]), mx(0, 0.006, 0));
    // lågor: två korsade, lätt böjda kort per låga, olika höjd, ur veden uppåt
    [[-0.07, 0.11, 0.2], [-0.025, 0.16, -0.15], [0.02, 0.19, 0.1], [0.065, 0.13, -0.25], [0.0, 0.09, 0.6]].forEach(([dx, hh, lu]) => {
      for (const ry of [0.4, 0.4 + PI / 2]) {
        const g = uvRuta(new T.PlaneGeometry(hh * 0.55, hh, 2, 4), [0, 0, 0.5, 1]), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const t = p.getY(i) / hh + 0.5; p.setX(i, p.getX(i) + Math.sin(t * 2.4) * lu * 0.03); p.setY(i, t * hh); }
        lagg('eld', g, mx(dx, 0.045, 0, ry));
      }
    });
    // varmt sken på glasets insida
    lagg('eld', uvRuta(new T.PlaneGeometry(0.26, 0.26), [0.5, 0, 1, 0.5]), mx(0, 0.15, 0.065));
  });
  const mesh = new T.Group(); m.decompose(mesh.position, mesh.quaternion, mesh.scale); mesh.name = 'eld';
  ELD = { acc, m, mesh, lager: LAGER, pos: V(0, 0.1, 0).applyMatrix4(m).toArray().map(v => Math.round(v * 100) / 100) };
  // vedkorg bredvid
  if (ved) {
    ton('#8a6a4a', () => svarv('tyg', [[0, 0], [0.15, 0], [0.16, 0.26], [0.152, 0.26], [0.142, 0.012], [0, 0.012]], 0.52 * ved, 0.004, 0.05, 32));
    for (let i = 0; i < 6; i++) ton(['#8c6a48', '#7a5a3c', '#9c7a56'][i % 3], () => lagg('ek', new T.CylinderGeometry(0.03, 0.03, 0.34, 14), mx(0.52 * ved + (i % 3 - 1) * 0.07, 0.06 + Math.floor(i / 3) * 0.06, 0.05, 0, PI / 2, 0)));
    hind(0.34, 0.34, 0.52 * ved, 0.05);
  }
}
// Korg med plädar (rullade) och en stickad puff.
function pladkorg() {
  skugga(0, 0, 0.36, 0.36, 0, 0.08, 0.4); hind(0.4, 0.4);
  // mjuk, lätt bukig korg med rundad kant
  ton('#c4a988', () => svarv('tyg', [[0, 0], [0.15, 0], [0.163, 0.008], [0.172, 0.06], [0.178, 0.2], [0.176, 0.33], [0.181, 0.352], [0.176, 0.364], [0.166, 0.358], [0.163, 0.33], [0.164, 0.2], [0.155, 0.03], [0, 0.014]], 0, 0.004, 0, 40));
  // rullade plädar med rundade ändar och synlig spiral
  [[PAL.sand, -0.045, 0.0, 0.14, 0.1], [PAL.salvia, 0.05, 0.025, -0.12, 0.12], [PAL.havre, 0.0, -0.05, 0.04, -0.16]].forEach(([fg, dx, dz, rx, rz], i) =>
    vav('stick', () => rullat(fg, 0.06, 0.5, mx(dx, 0.3, dz, i * 0.9, rx, rz))));
}
// Rullat tyg (pläd, handduk) längs lokalt y, mitt i origo: rundade ändar och en spiral
// i lite mörkare ton på den övre änden.
function rullat(fg, R, L, m) {
  const prof = [[0, -L / 2], [R * 0.7, -L / 2], [R * 0.93, -L / 2 + R * 0.13], [R, -L / 2 + R * 0.4], [R, L / 2 - R * 0.4], [R * 0.93, L / 2 - R * 0.13], [R * 0.7, L / 2], [0, L / 2 - R * 0.07]].map(q => new T.Vector2(q[0], q[1]));
  const pts = [];
  for (let k = 0; k <= 28; k++) { const t = k / 28, a = t * 2.6 * 2 * PI, r = R * (0.13 + t * 0.78); pts.push(V(Math.cos(a) * r, L / 2 - R * 0.03 - R * 0.1 * (1 - t), Math.sin(a) * r)); }
  ton(fg, () => lagg('tyg', new T.LatheGeometry(prof, 18), m));
  ton('#' + new T.Color(fg).multiplyScalar(0.8).getHexString(), () => lagg('tyg', new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, R * 0.055, 4, false), m.clone()));
}
function puff() {
  skugga(0, 0, 0.4, 0.4, 0, 0.1, 0.4); hind(0.46, 0.46);
  ton(PAL.havre, () => vav('stick', () => svarv('tyg', [[0, 0], [0.2, 0], [0.225, 0.03], [0.23, 0.26], [0.205, 0.3], [0, 0.31]], 0, 0.004, 0, 48)));
}
// Mugg (keramik med öra).
function mugg(x, y, z, fg = '#ece6dc', ry = 0) {
  ton(fg, () => {
    // lätt bukig kropp med rundad fot och rundad läpp, godstjocklek och ett mjukt öra
    svarv('keramik', [[0, 0.002], [0.026, 0], [0.032, 0.003], [0.036, 0.012], [0.0395, 0.045], [0.0395, 0.08], [0.0385, 0.092], [0.0372, 0.0965], [0.0355, 0.0955], [0.0355, 0.085], [0.036, 0.05], [0.034, 0.02], [0.028, 0.012], [0, 0.011]], x, y, z, 28);
    lagg('keramik', new T.TorusGeometry(0.025, 0.0055, 8, 14, PI * 1.05).rotateZ(-PI * 0.025), mx(x + Math.cos(ry) * 0.039, y + 0.05, z - Math.sin(ry) * 0.039, ry, 0, -PI / 2));
  });
  ton('#6b4a33', () => lagg('keramik', new T.CircleGeometry(0.0352, 32).rotateX(-PI / 2), mx(x, y + 0.078, z)));   // te
}

// Lådor med kakel: uv efter läget i rummet, så att fogarna hamnar som på väggarna.
function kakelLada(w, h, d, x, y, z, ry = 0) {
  const g = new T.BoxGeometry(w, h, d);
  g.applyMatrix4(mx(x, y, z, ry));
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    uv.setXY(i, ay > 0.5 ? kakelU(p.getX(i), 'x') : (ax > 0.5 ? kakelU(p.getZ(i), 'z') : kakelU(p.getX(i), 'x')), ay > 0.5 ? kakelU(p.getZ(i), 'z') / 2 : p.getY(i) / 1.2);
  }
  lagg('kakel', g);
}

// Bastun i ljus al (ek-materialet i ljus ton): x0..x1, z0..z1, dörren i östväggen.
function bastu(x0, x1, z0, z1) {
  const AL = '#e2c39a', ALM = '#d3b085', MORK = '#6e5238';
  ton(AL, () => {
    // pärlspont: lodräta 9,5 cm bräder med smala mörka fogar mot en mörkare bakpanel
    const panel = (axel, c, a, b, y0, y1, sd) => {
      ton(MORK, () => axel === 'x' ? box('vagg', b - a, y1 - y0, 0.006, (a + b) / 2, (y0 + y1) / 2, c) : box('vagg', 0.006, y1 - y0, b - a, c, (y0 + y1) / 2, (a + b) / 2));
      const n = Math.round((b - a) / 0.096);
      for (let i = 0; i < n; i++) {
        const m = a + (b - a) * (i + 0.5) / n, bw = (b - a) / n - 0.005;
        ton(i % 3 ? AL : ALM, () => axel === 'x' ? rbx('vagg', bw, y1 - y0, 0.016, m, (y0 + y1) / 2, c + sd * 0.009, 0.003, 0, 0, 1) : rbx('vagg', 0.016, y1 - y0, bw, c + sd * 0.009, (y0 + y1) / 2, m, 0.003, 0, 0, 1));
      }
    };
    const TP = LU - 0.002;
    panel('z', x0 + 0.01, z0 + 0.01, z1 - 0.01, 0, TP, 1);
    panel('x', z1 - 0.01, x0 + 0.01, x1 - 0.01, 0, TP, -1);
    panel('x', z0 + 0.01, x0 + 0.01, x1 - 0.01, 0, 1.46, 1);
    // bredvid fönstret i norr ända upp
    { const fh = HAL.find(h => h.s === 'N' && (() => { const a = h.f.o.x - h.u0, b = h.f.o.x - h.u1; return Math.max(a, b) > x0 && Math.min(a, b) < x1; })());
      if (fh) { const a = Math.min(fh.f.o.x - fh.u0, fh.f.o.x - fh.u1), b = Math.max(fh.f.o.x - fh.u0, fh.f.o.x - fh.u1);
        if (a - 0.01 > x0 + 0.1) panel('x', z0 + 0.01, x0 + 0.01, a - 0.01, 1.46, TP, 1);
        if (x1 - 0.01 > b + 0.1) panel('x', z0 + 0.01, b + 0.01, x1 - 0.01, 1.46, TP, 1);
        panel('x', z0 + 0.01, a - 0.01, b + 0.01, Math.min(TP - 0.05, fh.v1 + 0.01), TP, 1); } }
    panel('z', x1 - 0.015, z0 + 0.01, z0 + 0.97, 0, TP, -1);
    panel('z', x1 - 0.01, z1 - 0.1, z1 - 0.01, 0, TP, -1);
    panel('z', x1 - 0.01, z0 + 0.97, z1 - 0.1, 2.02, TP, -1);
    // innertak av bräder längs x
    ton(ALM, () => { const n = Math.round((z1 - z0) / 0.096); for (let i = 0; i < n; i++) rbx('vagg', x1 - x0 - 0.02, 0.014, (z1 - z0) / n - 0.004, (x0 + x1) / 2, LU - 0.009, z0 + (z1 - z0) * (i + 0.5) / n, 0.003, 0, 0, 1); });
    // lavar: 9 cm ribbor med 1 cm springor på reglar
    const lav = (xa, xb, za, zb, y) => {
      const n = Math.round((xb - xa) / 0.1);
      for (let i = 0; i < n; i++) rbx('vagg', 0.088, 0.028, zb - za, xa + (xb - xa) * (i + 0.5) / n, y - 0.014, (za + zb) / 2, 0.006, 0, 0, 1);
      ton(ALM, () => [za + 0.08, (za + zb) / 2, zb - 0.08].forEach(z => box('vagg', xb - xa - 0.02, 0.05, 0.04, (xa + xb) / 2, y - 0.055, z)));
    };
    lav(x0 + 0.02, x0 + 0.57, z0 + 0.02, z1 - 0.02, 0.97);
    sitt('Bastulaven', [x0 + 0.32, 1.72, (z0 + z1) / 2], [x1, 1.35, (z0 + z1) / 2 + 0.2], [0.55, 0.3, z1 - z0 - 0.04, x0 + 0.3, 0.9, (z0 + z1) / 2]);
    lav(x0 + 0.57, x0 + 0.97, z0 + 0.62, z1 - 0.04, 0.52);
    ton(ALM, () => {
      box('vagg', 0.05, 0.92, 0.05, x0 + 0.52, 0.46, z0 + 0.06); box('vagg', 0.05, 0.92, 0.05, x0 + 0.52, 0.46, z1 - 0.06);
      box('vagg', 0.05, 0.47, 0.05, x0 + 0.92, 0.235, z0 + 0.66); box('vagg', 0.05, 0.47, 0.05, x0 + 0.92, 0.235, z1 - 0.08);
    });
    // ryggstöd: tre liggande ribbor framför ljuslisten
    [1.22, 1.34, 1.46].forEach(y => rbx('vagg', 0.028, 0.07, z1 - z0 - 0.1, x0 + 0.05, y, (z0 + z1) / 2, 0.008, 0, 0, 1));
    ton(MORK, () => [z0 + 0.1, z1 - 0.1].forEach(z => box('vagg', 0.025, 0.36, 0.04, x0 + 0.03, 1.34, z)));
    // termometer på väggen vid dörren: svarvad träring runt urtavlan
    lagg('vagg', new T.TorusGeometry(0.046, 0.009, 6, 24), mx(x1 - 0.32, 1.7, z1 - 0.036));
    cyl('vagg', 0.046, 0.046, 0.012, x1 - 0.32, 1.7, z1 - 0.026, 20, false, PI / 2);
    // krok med en linnehandduk vid dörren
    lagg('vagg', new T.CylinderGeometry(0.012, 0.012, 0.06, 12).rotateZ(PI / 2), mx(x1 - 0.045, 1.6, z0 + 0.6));
  });
  // Laggad träspann: stavar (fasetterad svarvning med mörka springor), två plåtband, vatten,
  // två öron med ett bågformat trähandtag; skopan ligger bredvid med skålad kopp och långt skaft.
  {
    const bx = x0 + 0.79, bz = z1 - 0.28, by = 0.52;
    ton('#d9b98c', () => {
      const g = new T.LatheGeometry([[0, 0.012], [0.078, 0.012], [0.08, 0], [0.086, 0], [0.101, 0.165], [0.094, 0.165], [0.081, 0.014]].map(q => new T.Vector2(q[0], q[1])), 14);
      lagg('vagg', g.toNonIndexed(), mx(bx, by, bz));   // plana stavar (ingen normalutjämning mellan dem)
      for (const s of [-1, 1]) rbx('vagg', 0.03, 0.06, 0.012, bx + s * 0.097, by + 0.18, bz, 0.005, 0, 0, 1);
      lagg('vagg', new T.TorusGeometry(0.097, 0.007, 5, 14, PI), mx(bx, by + 0.195, bz));
    });
    ton('#5d5952', () => { for (const [h, r] of [[0.035, 0.0898], [0.125, 0.0981]]) lagg('vit', new T.CylinderGeometry(r + 0.0014, r, 0.014, 20, 1, true), mx(bx, by + h, bz)); });
    ton('#8fa3a6', () => glans(0.3, () => lagg('keramik', new T.CircleGeometry(0.09, 16).rotateX(-PI / 2), mx(bx, by + 0.12, bz))));
    const sx = x0 + 0.75, sz = z1 - 0.62;
    ton('#cfa878', () => {
      svarv('vagg', [[0, 0], [0.02, 0.002], [0.04, 0.016], [0.05, 0.04], [0.046, 0.04], [0.037, 0.02], [0.018, 0.008], [0, 0.007]], sx, by, sz, 14);
      lagg('vagg', new T.CylinderGeometry(0.007, 0.01, 0.3, 7).rotateX(PI / 2), mx(sx, by + 0.036, sz - 0.195, 0, 0.03));
      lagg('vagg', new T.SphereGeometry(0.011, 7, 5), mx(sx, by + 0.031, sz - 0.345));
    });
  }
  // urtavla med gradskala (långa och korta streck i en båge), röd visare och nav
  ton('#f4f1ea', () => cyl('vit', 0.04, 0.04, 0.004, x1 - 0.32, 1.7, z1 - 0.034, 20, false, PI / 2));
  ton('#4a4640', () => { for (let i = 0; i <= 12; i++) { const a = -2.2 + i * 4.4 / 12, L = i % 3 ? 0.005 : 0.009; box('vit', 0.0016, L, 0.001, x1 - 0.32 + Math.sin(a) * (0.036 - L / 2), 1.7 + Math.cos(a) * (0.036 - L / 2), z1 - 0.0365, 0, 0, -a); }
    cyl('vit', 0.005, 0.005, 0.004, x1 - 0.32, 1.7, z1 - 0.038, 10, false, PI / 2); });
  ton('#b5402f', () => box('vit', 0.0024, 0.03, 0.001, x1 - 0.32 + Math.sin(0.9) * 0.012, 1.7 + Math.cos(0.9) * 0.012, z1 - 0.0375, 0, 0, -0.9));
  // ljuslist bakom ryggstödet
  cyl('lampa', 0.008, 0.008, z1 - z0 - 0.15, x0 + 0.025, 1.18, (z0 + z1) / 2, 6, false, PI / 2);
  // aggregat: mörk stållåda med stenkorg och oregelbundna, matta stenar
  const ax = x1 - 0.2, az = z0 + 0.23;
  skugga(ax, az, 0.36, 0.32, 0, 0.1, 0.45);
  // (borstat rostfritt i stället för en svart kloss; stenkorgen av rostfri tråd)
  ton('#c4c1bb', () => {
    sbNeutral(0.36, 0.5, 0.3, ax, 0.25, az, 0.012);
    const sb = (w, h, d, x, y, z) => sbNeutral(w, h, d, x, y, z, 0.0025);
    for (let i = 0; i < 6; i++) { sb(0.006, 0.16, 0.006, ax - 0.19, 0.585, az - 0.15 + i * 0.06); sb(0.006, 0.16, 0.006, ax + 0.19, 0.585, az - 0.15 + i * 0.06); sb(0.006, 0.16, 0.006, ax - 0.15 + i * 0.06, 0.585, az + 0.16); sb(0.006, 0.16, 0.006, ax - 0.15 + i * 0.06, 0.585, az - 0.16); }
    for (const s of [-1, 1]) { sb(0.39, 0.006, 0.006, ax, 0.665, az + s * 0.163); sb(0.006, 0.006, 0.33, ax + s * 0.193, 0.665, az); }
    sb(0.39, 0.008, 0.33, ax, 0.505, az);
  });
  // ventilationsspringor i fronten
  ton('#3b3a37', () => { for (let i = 0; i < 4; i++) box('vit', 0.26, 0.006, 0.003, ax, 0.08 + i * 0.022, az + 0.1505); });
  const GR = ['#7a7670', '#5e5b56', '#8d8982', '#4c4a46', '#6b6761', '#9a958d'];
  // (kantiga, spräckta stenar: grov form med plana brottytor i olika storlek, 80 trianglar
  // per sten i stället för 320 runda klumpar)
  for (let i = 0; i < 40; i++) {
    const g = new T.IcosahedronGeometry(0.03 + rnd() * 0.034, 1), pp = g.attributes.position;
    const fx = 0.75 + rnd() * 0.6, fy = 0.5 + rnd() * 0.4, fz = 0.75 + rnd() * 0.5;
    for (let j = 0; j < pp.count; j++) { const q = Math.sin(pp.getX(j) * 311 + pp.getY(j) * 197 + pp.getZ(j) * 113 + i * 1.7), k = 0.72 + 0.42 * Math.abs(q); pp.setXYZ(j, pp.getX(j) * fx * k, pp.getY(j) * fy * k, pp.getZ(j) * fz * k); }
    g.computeVertexNormals();
    const lag = Math.floor(i / 14);
    ton(GR[i % GR.length], () => lagg('vagg', g, mx(ax + (rnd() - 0.5) * 0.3, 0.53 + lag * 0.04 + rnd() * 0.012, az + (rnd() - 0.5) * 0.26, rnd() * 6, rnd() * 2, rnd() * 2)));
  }
  // aggregatets plåthölje: mörk överkant runt stenarna, panel med två vred och en lampa
  ton('#55534f', () => { for (const s of [-1, 1]) { box('vit', 0.37, 0.022, 0.012, ax, 0.5, az + s * 0.149); box('vit', 0.012, 0.022, 0.31, ax + s * 0.179, 0.5, az); }
    rbx('vit', 0.2, 0.07, 0.006, ax - 0.04, 0.34, az + 0.152, 0.003, 0, 0, 1); });
  ton('#d8d5cf', () => { for (const k of [-1, 1]) { cyl('vit', 0.018, 0.02, 0.016, ax - 0.04 + k * 0.05, 0.34, az + 0.162, 14, false, PI / 2); box('vit', 0.003, 0.014, 0.002, ax - 0.04 + k * 0.05, 0.346, az + 0.171); } });
  ton('#c9673a', () => box('vit', 0.008, 0.008, 0.002, ax - 0.04, 0.362, az + 0.1555));
  ton(MORK, () => { box('vagg', 0.012, 0.12, z1 - z0 - 0.06, x0 + 0.034, 0.06, (z0 + z1) / 2); box('vagg', x1 - x0 - 0.06, 0.12, 0.012, (x0 + x1) / 2, 0.06, z1 - 0.034); });
  // trall av ribbor framför laven
  ton(ALM, () => { for (let i = 0; i < 3; i++) rbx('vagg', 0.06, 0.022, z1 - z0 - 0.6, x0 + 1.01 + i * 0.07, 0.013, (z0 + 0.55 + z1 - 0.05) / 2, 0.005, 0, 0, 1); });
  // skyddsräcke i trä runt aggregatet och ett vred på dess front
  ton(ALM, () => {
    const rx = ax - 0.25, rz = az + 0.23;
    [[rx, rz], [rx, z0 + 0.03], [x1 - 0.03, rz]].forEach(([px, pz]) => box('vagg', 0.035, 0.62, 0.035, px, 0.31, pz));
    [0.3, 0.58].forEach(y => { rbx('vagg', 0.03, 0.04, rz - z0 - 0.03, rx, y, (rz + z0 + 0.03) / 2, 0.008, 0, 0, 1); rbx('vagg', x1 - 0.03 - rx, 0.04, 0.03, (rx + x1 - 0.03) / 2, y, rz, 0.008, 0, 0, 1); });
  });
  // timglas på väggen: vändbar trähållare (två svarvade plattor och tre pinnar) på en tapp
  // från en väggplatta, två glasbulber med smal midja och sand i den nedre
  {
    const tx = x0 + 0.85, tz = z1 - 0.062, ty = 1.33;
    ton(MORK, () => {
      rbx('vagg', 0.05, 0.24, 0.01, tx, ty + 0.09, z1 - 0.021, 0.004, 0, 0, 1);
      cyl('vagg', 0.007, 0.007, 0.04, tx, ty + 0.09, z1 - 0.04, 8, false, PI / 2);
      for (const y of [ty, ty + 0.172]) svarv('vagg', [[0, 0], [0.033, 0], [0.036, 0.004], [0.033, 0.008], [0, 0.008]], tx, y, tz, 16);
      for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3 + PI / 2; cyl('vagg', 0.0032, 0.0032, 0.166, tx + Math.cos(a) * 0.029, ty + 0.09, tz + Math.sin(a) * 0.029, 6); }
    });
    lagg('glas', new T.LatheGeometry([[0.004, 0], [0.019, 0.004], [0.025, 0.022], [0.023, 0.05], [0.01, 0.073], [0.0035, 0.082], [0.01, 0.091], [0.023, 0.114], [0.025, 0.142], [0.019, 0.16], [0.004, 0.164]].map(q => new T.Vector2(q[0], q[1])), 16), mx(tx, ty + 0.008, tz));
    ton('#e3cfa2', () => { svarv('vagg', [[0, 0], [0.018, 0], [0.023, 0.016], [0.012, 0.03], [0, 0.04]], tx, ty + 0.013, tz, 12); svarv('vagg', [[0, 0], [0.004, 0.006], [0.014, 0.022], [0, 0.022]], tx, ty + 0.092, tz, 10); });
  }
  ton(ALM, () => { rbx('vagg', 0.24, 0.12, 0.02, x0 + 0.03, 1.95, (z0 + z1) / 2 + 0.45, 0.006, PI / 2, 0, 1); });
  ton(MORK, () => { for (let i = 0; i < 4; i++) box('vagg', 0.004, 0.012, 0.18, x0 + 0.042, 1.91 + i * 0.026, (z0 + z1) / 2 + 0.45); });
  ton(ALM, () => {
    for (let i = 0; i < 6; i++) { const a = i / 5 * PI / 2; box('vagg', 0.012, 0.16, 0.02, x0 + 0.027 + Math.cos(a) * 0.1, 1.9, z1 - 0.027 - Math.sin(a) * 0.1, PI / 2 - a); }
    for (const y of [1.82, 1.98]) lagg('vagg', new T.TorusGeometry(0.1, 0.006, 6, 12, PI / 2).rotateX(-PI / 2), mx(x0 + 0.027, y, z1 - 0.027));
  });
  med(x0 + 0.08, z1 - 0.08, 0, () => egenLampa('Bastulampa', [0, 1.86, 0], () => cyl('lampa', 0.03, 0.03, 0.06, 0, 1.86, 0, 12)));
  vikt(0.32, 0.24, 0.05, x0 + 0.3, 0.97, z1 - 0.35, 0.1, '#f1ece3');
  vav('linne', () => krokHandduk(x1 - 0.062, 1.595, z0 + 0.6, -PI / 2, 0.4, 0.55, '#e8e1d4'));
  // bastudyna med nackrulle i linne på övre laven
  // (oblekt linne med kantband runt dynan, lätt nedsutten; rullen har rundade ändar med
  // en spiral i gaveln som ett rullat tyg, inte en slät plastcylinder)
  vav('linne', () => {
    ton('#e4dac8', () => dyna('tyg', 0.42, 0.034, 0.9, x0 + 0.3, 0.987, (z0 + z1) / 2 - 0.25, { r: 0.014, puff: 0.007, sjunk: 0.003, veck: 0.0012, fram: 0.003, sida: 0.003, kant: 'topp', kantF: 0.84, nx: 8, ny: 2, nz: 14 }));
    rullat('#dccfb8', 0.048, 0.4, mx(x0 + 0.3, 1.052, (z0 + z1) / 2 - 0.65, 0, 0, PI / 2));
  });
  // (den nedre laven är ett fotsteg utan gånghinder: med den som hinder återstod 21 cm golv
  // innanför dörren, och man kom aldrig in i bastun eller fram till laven för att sätta sig)
  [[x0, z0 + 0.01, x0 + 0.59, z1 - 0.01], [ax - 0.19, az - 0.16, ax + 0.19, az + 0.16]].forEach(([a, b, c, d]) => HINDER.push({ x0: a, z0: b, x1: c, z1: d, niva: 'botten', typ: 'mobel' }));
}

// ---- Tomt hus: fast inredning och lösa saker ----
// I husens möblering (MODELL) är allt löst om inget annat sägs. De här byggarna är huset
// självt och fast inredning (väggar, trappa, loftets däck och räcke, kök, badrum, bastu,
// kamin, garderober och takarmaturer): de stannar när möblerna döljs. Det lösa som de
// ställer fram (handdukar, växter, ljus, mat, kläder, det som står på bänkar och i skåp)
// pekas ut för sig. Byt taggen här, inte i varje möbel.
{
  const som = (los, f) => (...a) => { const g = LOS; LOS = los; try { return f(...a); } finally { LOS = g; } };
  vagg = som(false, vagg); trappa = som(false, trappa); dack = som(false, dack); relang = som(false, relang);
  kok = som(false, kok); bad = som(false, bad); toalett = som(false, toalett); dusch = som(false, dusch);
  handfat = som(false, handfat); tvatt = som(false, tvatt); bastu = som(false, bastu); kamin = som(false, kamin);
  garderob = som(false, garderob); spot = som(false, spot); plafond = som(false, plafond); pendel = som(false, pendel);
  ljus = som(true, ljus); smavaxt = som(true, smavaxt); slinga = som(true, slinga); overStang = som(true, overStang);
  rullat = som(true, rullat); kuddeRund = som(true, kuddeRund); kudde = som(true, kudde); vikt = som(true, vikt);
  bocker = som(true, bocker); mugg = som(true, mugg); kastrull = som(true, kastrull); diskhorna = som(true, diskhorna);
  redskap = som(true, redskap); skarbrada = som(true, skarbrada); basilika = som(true, basilika); fruktskal = som(true, fruktskal);
  oljaOchKvarnar = som(true, oljaOchKvarnar); brodrost = som(true, brodrost); pressbryggare = som(true, pressbryggare);
  skalstapel = som(true, skalstapel); kokshandduk = som(true, kokshandduk);
  krokHandduk = som(true, krokHandduk); mjolk = som(true, mjolk);
  ladaInnehall = som(true, ladaInnehall); overInnehall = som(true, overInnehall); bankInnehall = som(true, bankInnehall);
  kylInne = som(true, kylInne); frysInne = som(true, frysInne); dorrfack = som(true, dorrfack);
  paket = som(true, paket); burk = som(true, burk); flaska = som(true, flaska); konserv = som(true, konserv);
  garderobInne = som(true, garderobInne); lampVaggSken = som(true, lampVaggSken);
}

// ---- Husen ----
const MODELL = {
  *'sadel-30'() {
    vagg('z', -2.02, -1.75, 1.75, { topp: LU, dorrar: [{ a: 0.2, b: 1.0, h: 2.1, gang: 'b', sida: 1, vinkel: 88 }] });
    vagg('x', 0.035, -1.97, 0.25, { topp: LU, dorrar: [{ a: -1.55, b: -0.75, h: 2.1, gang: 'a', sida: 1, vinkel: 75 }] });
    vagg('z', 0.30, -1.75, 0.09, { topp: LU });
    yield;   // (väggar, trappa och loft i var sitt steg)
    trappa(0.29, -1.96, 1.08, 1.75);
    yield;
    loft(0.35, 0.09, -1.96, 1.08);
    yield;   // (köket i ett eget steg)
    kok({ axel: 'z', vagg: 0.35, ut: 1, s0: -1.75, s1: 0.09, spis: -1.42, disk: -0.3, kyl: 'under', over: [[-1.75, -0.9]], hylla: [[-0.75, 0.05]] });
    yield;
    // matplats vid norrväggen
    med(2.55, -1.3, 0, () => bord(0.75, 0.8));
    med(1.97, -1.3, PI / 2, stol);
    med(3.13, -1.3, -PI / 2, stol);
    pendel(2.55, -1.3, 1.5, true);
    med(2.55, -1.3, 0, () => bordsdukning(0.74, 0.1));
    yield;
    // soffa mot söder
    matta(2.62, 0.45, 1.6, 1.3);
    med(2.7, 1.17, PI, () => soffa(1.5, 0.9, { ton: PAL.havre }));
    med(2.7, 0.42, 0, () => soffbord(0.28));
    // ingen golvväxt här: trappans fot och ytterdörren tar platsen
    med(1.8, 1.5, 0, golvlampa);
    konst(2.55, 1.45, -1.75, 0, 0.5, 0.6, 1, 'svart');
    spot(0.75, -1.2); spot(0.75, -0.3);
    yield;
    // sovrum
    med(-3.0, -1.75 + 0.95 + 0.085, 0, () => sang(0.8, 1.9, { pled: '#c49c78' }));
    med(-2.305, -1.55, 0, () => nattbord({ sida: 1 }));
    konst(-3.0, 1.64, -1.75, 0, 0.5, 0.65, 0);
    konst(-3.5, 1.45, -0.6, PI / 2, 0.7, 0.5, 4, 'vit');
    // garderob mot gaveln söder om sängen (rummet hade ingenstans för kläderna); mattan i gången
    med(-3.2, 0.92, PI / 2, () => garderob(0.9, 0.6, 2.0, 2));
    matta(-2.48, 0.76, 0.7, 1.0, 0, '#d8cdbb', 1);
    vagghylla(-2.07, -0.6, -PI / 2, 0.6, 1.45, true);   // kort ranka: den långa hängde ner framför nattduksbordets lampa
    plafond(-2.75, 0.4);
    spot(-1.45, 0.56); spot(-0.45, 0.56);   // hallen framför loftet: infällda i takfallet
    hallen(-0.08, 0.085, 0);   // krokar och skor på badrumsväggen i hallen (hallen var tom); rocken fri från strömbrytaren (x -0,58)
    yield;
    // bad
    bad(-1.97, 0.25, -1.75, -0.015);
    med(-1.6, -1.75 + 0.33, 0, toalett);
    dusch(-0.65, -1.75, 0.25, -0.83, [[-0.65, -1.75, -0.65, -0.83], [-0.65, -0.83, -0.25, -0.83]], 'E');
    med(-0.055, -0.33, -PI / 2, tvatt);
    med(-1.97 + 0.23, -0.35, PI / 2, () => handfat({ sida: 1 }));   // sist: stegen/kroken ser allt annat
    gardiner(0, 'h', 0.3);
    gardiner(3, 'h');
    gardiner(6, 'h', 0.42);
    gardiner(5, 'rull');
  },

  *'sadel-40'() {
    vagg('z', -3.07, -1.75, 1.75, { topp: LU, dorrar: [{ a: 0.18, b: 0.98, h: 2.1, gang: 'b', sida: 1, vinkel: 88 }] });
    vagg('x', 0.02, -3.02, -0.82, { topp: LU, dorrar: [{ a: -2.67, b: -1.94, h: 2.1, gang: 'a', sida: 1, vinkel: 75 }] });
    vagg('z', -0.765, -1.75, 0.08, { topp: LU });
    yield;   // (väggar, trappa och loft i var sitt steg)
    trappa(-0.25, -3.02, 1.08, 1.75);
    yield;
    loft(-0.71, 0.08, -3.02, 1.08);
    yield;   // (köket i ett eget steg)
    kok({ axel: 'z', vagg: -0.715, ut: 1, s0: -1.75, s1: 0.08, spis: -1.42, disk: -0.25, kyl: 'under', over: [[-1.75, -0.9]], hylla: [[-0.75, 0.05]] });
    yield;
    // soffa mot norr med soffbord och matta
    matta(3.45, -0.55, 2.4, 1.7);   // fransarna gick 6 cm in i gavelväggen
    med(3.5, -1.28, 0, () => soffa(2.1, 0.92, { ton: '#8f8c84' }));
    med(3.5, -0.3, 0, () => soffbord(0.4));
    // två tavlor centrerade över soffan (mitt x 3,5), underkanten 22 cm över ryggen
    konst(3.17, 1.32, -1.75, 0, 0.5, 0.6, 0);
    konst(3.83, 1.32, -1.75, 0, 0.5, 0.6, 2);
    yield;
    // matplats vid söderfönstret
    med(2.42, 1.08, 0, () => bord(0.85, 1.3));
    [0.78, 1.38].forEach(z => { med(1.8, z, PI / 2, stol); med(3.04, z, -PI / 2, stol); });
    pendel(2.42, 1.08, 1.5, true);
    med(2.42, 1.08, 0, () => bordsdukning(0.74));
    yield;
    vaxt(4.1, 1.1, true, 0, 'monstera');   // fri från altandörren och gångvägen; bladen gick in i söderfönstrets gardin
    vagghylla(2.12, -1.75, 0, 0.5, 1.3, true);   // x 1,87–2,37, efter knaggarna och före soffan; kort ranka (den långa hängde ner till soffkarmen bakom golvlampan)
    med(4.5, 0.5, 0, pladkorg);
    med(2.05, -0.35, 0, puff);
    med(2.28, -1.2, 0, golvlampa);   // fri från hyllans hängväxt (z -1,45) och krukan: skärmen (r 0,21) gick igenom dem
    spot(-0.25, -1.2); spot(-0.25, -0.3);
    yield;
    // sovrum
    med(-3.96, -1.75 + 1.025 + 0.085, 0, () => sang(1.2, 2.05, { pled: '#a7b098', kudde: '#c09a6e' }));
    yield;
    matta(-4.02, 0.78, 1.2, 0.7);
    // (växten stod framför det golvlånga fönstret)
    // garderob i hörnet bredvid dörren (rummet saknade förvaring; pallen stod där)
    med(-3.45, 1.45, PI, () => garderob(0.6, 0.6, 2.0, 1));
    konst(-3.96, 1.5, -1.75, 0, 0.6, 0.45, 2);   // ca 17 cm över gaveln
    konst(-4.75, 1.45, -0.15, PI / 2, 0.5, 0.6, 4, 'svart');
    vagglampa(-4.5, 1.32, -1.75, 0); vagglampa(-3.42, 1.32, -1.75, 0);
    konst(-1.38, 1.45, 0.07, 0, 0.5, 0.6, 3);   // hallens badrumsvägg var tom
    yield;
    hallen(1.38, -1.75, 0);   // knaggarna (x 1,07–1,79) börjar höger om dörrfodret (slutar x 1,04); väskan hänger fritt vänster om vägghyllan
    plafond(-3.9, 0.7);
    spot(-2.45, 0.56); spot(-1.35, 0.56);   // hallen framför loftet: infällda i takfallet
    yield;
    // bad
    bad(-3.02, -0.815, -1.75, -0.03);
    yield;
    med(-2.58, -1.75 + 0.33, 0, toalett);
    dusch(-1.73, -1.75, -0.82, -0.84, [[-1.73, -1.75, -1.73, -0.84], [-1.73, -0.84, -1.3, -0.84]], 'E');
    med(-1.12, -0.34, -PI / 2, tvatt);
    yield;
    med(-3.02 + 0.23, -0.55, PI / 2, () => handfat({ sida: 1 }));   // sist: stegen/kroken ser allt annat
    gardiner(1, 'b', 0.3);
    gardiner(7, 'v', 0.3);   // bara norra längden: den södra krockade med fönster 1:s längd i hörnet
    gardiner(3, 'b', 0.34);
    gardiner(8, 'v', 0.42);
    gardiner(6, 'rull');
    gardiner(5, 'rull');   // badrumsfönstret var naket (insyn)
  },

  *'sadel-50'() {
    vagg('z', -3.23, -1.75, 1.75, { topp: LU, dorrar: [{ a: 0.18, b: 0.98, h: 2.1, gang: 'b', sida: 1, vinkel: 88 }] });
    vagg('x', 0.02, -3.17, 0.43, { topp: LU, dorrar: [{ a: -1.15, b: -0.38, h: 2.1, gang: 'a', sida: 1, vinkel: 78 }] });
    vagg('z', -1.92, -1.75, -0.03, { topp: LU, dorrar: [{ a: -0.78, b: -0.13, h: 2.0, gang: 'b', sida: 1, vinkel: 80, mk: 'glas' }] });
    vagg('z', 0.485, -1.75, 0.48, { topp: LU });
    yield;   // (väggar, trappa och loft i var sitt steg)
    trappa(-0.12, -3.17, 1.08, 1.75);
    yield;
    loft(0.54, 0.08, -3.17, 1.08);
    yield;   // (köket i ett eget steg)
    kok({ axel: 'z', vagg: 0.535, ut: 1, s0: -1.75, s1: 0.48, hog: [[-1.75, -1.15]], spis: -0.62, disk: 0.25, over: [[-1.15, -0.25]], hylla: [[-0.1, 0.45]] });
    yield;
    // bastu: ribbade lavar, ryggstöd, pärlspont, aggregat med stenkorg, ämbar och termometer
    bastu(-3.17, -1.97, -1.75, -0.03);
    yield;
    // matplats under norrfönstren
    med(3.27, -1.12, 0, () => bord(0.8, 1.2));
    [-1.42, -0.82].forEach(z => { med(2.65, z, PI / 2, stol); med(3.89, z, -PI / 2, stol); });
    pendel(3.27, -1.12, 1.5, true);
    med(3.27, -1.12, 0, () => bordsdukning(0.74));
    yield;
    // soffa framför stora söderfönstret
    matta(4.33, 0.5, 2.7, 1.7);
    med(4.33, 1.28, PI, () => soffa(2.4, 0.95, { ton: '#a39d90', k3: PAL.salvia }));
    med(4.33, 0.35, 0, () => soffbord(0.42));
    vaxt(5.35, -1.4, true, 0, 'monstera');   // längre från matstolarna
    med(2.55, 1.5, 0, golvlampa);   // vid soffans gavel, inte framför glaset i öster eller söder
    med(5.75, 0.9, 0, pladkorg);
    vagghylla(0.95, 1.75, PI, 0.6, 1.5);
    spot(1.2, -1.2); spot(1.2, -0.2);
    yield;
    // sovrum med säng mot västväggen
    // sängen mot norr, så att gången framför dörren (z 0,18–0,98) är fri; en vägglampa
    // på norra sidan där nattduksbordet inte får plats
    // 140-säng mellan de två golvlånga västfönstren (z -0,94 resp. 0,93): 160-sängens gavel
    // stod framför det norra fönstret. Mellan fönstren får inget nattduksbord plats, så en
    // vägglampa på var sida om gaveln.
    med(-6.0 + 1.025 + 0.085, 0.0, PI / 2, () => sang(1.4, 2.05, { pled: '#c8a07a' }));
    vagglampa(-6.0, 1.25, -0.79, PI / 2); vagglampa(-6.0, 1.25, 0.79, PI / 2);   // fria från fönstrens foder
    konst(-6.0, 1.6, 0.0, PI / 2, 0.8, 0.55, 3, 'svart');
    matta(-4.1, 0.0, 1.6, 1.9, 0, '#d8cdbb', 0);
    // garderob mot södra väggen (rummet saknade förvaring), stolen i hörnet vid fönstren
    med(-4.25, 1.45, PI, () => garderob(1.2, 0.6, 2.0, 2));
    med(-5.5, 1.3, PI / 2, () => stolPled('#7f8873', true));
    vaxt(-3.55, -1.45, true, 0, 'fikus');
    plafond(-4.6, 0.1);
    spot(-2.5, 0.56); spot(-1.2, 0.56); spot(0.05, 0.56);   // hallen framför loftet: infällda i takfallet
    // hallens badrumsvägg var tom: en låg skobänk närmast allrummet (krokraden med rocken
    // fyllde halva hallvyn där) och krokar med skobricka längre in, bakom badrumsdörren
    med(0.0, 0.07 + 0.175, 0, () => hallbank(0.8, 0.34));
    konst(0.15, 1.4, 0.07, 0, 0.3, 0.4, 2);   // över bänken, det som syns från hallvyn (smal: strömbrytaren och dörrfodret tar resten)
    hallen(-2.3, 0.07, 0);
    yield;
    // bad
    bad(-1.87, 0.435, -1.75, -0.03);
    dusch(-1.86, -1.75, -0.93, -0.84, [[-0.93, -1.75, -0.93, -0.84], [-1.4, -0.84, -0.93, -0.84]], 'W');
    med(-0.56, -1.75 + 0.33, 0, toalett);
    med(0.13, -1.45, 0, tvatt);
    med(0.435 - 0.23, -0.44, -PI / 2, () => handfat({ sida: -1 }));
    gardiner(4, 'v', 0.3);
    gardiner(5, 'h', 0.3);
    gardiner(7, 'h', 0.3);
    gardiner(9, 'b', 0.4);
    gardiner(0, 'rull');
    gardiner(2, 'rull');   // badrumsfönstret var naket (insyn)
  },

  *'pulpet-70'() {
    yield;
    // korridorväggen mellan sovrumsdelen och allrummet
    vagg('x', -0.06, -4.75, 4.75, {
      dorrar: [
        { a: -3.78, b: -2.98, gang: 'b', sida: -1, vinkel: 85 },
        { a: -2.54, b: -1.75, gang: 'a', sida: -1, vinkel: 85 },
        { a: 0.35, b: 1.14, gang: 'b', sida: -1, vinkel: 85 },
      ],
      oppna: [{ a: 2.8, b: 3.72, h: 2.1 }],
    });
    vagg('z', -2.78, -3.25, -0.11);
    vagg('z', -0.715, -3.25, -0.11);
    vagg('z', 1.40, -3.25, -1.58);
    vagg('x', -1.63, 1.45, 4.75, { dorrar: [{ a: 2.85, b: 3.66, gang: 'a', sida: 1, vinkel: 85 }] });
    yield;
    // garderobsblocket mellan sovrum 3 och hallen, med inklädnad upp till taket
    med(1.70, -0.845, -PI / 2, () => garderob(1.47, 0.66, 2.3, 2, 'klader'));
    med(2.385, -0.845, PI / 2, () => garderob(1.47, 0.67, 2.3, 2, 'hall'));
    vagg('z', 2.045, -1.58, -0.11, { t: 1.35, bunn: 2.3 });
    yield;
    // hall: bänk och krokar
    med(4.1, -1.405, 0, () => hallbank(0.9, 0.34));
    hallen(4.25, -1.58, 0, { bank: true });   // rocken fri från strömbrytaren vid badrumsdörren
    spot(4.1, -0.8);
    yield;
    // bad
    bad(1.45, 4.75, -3.25, -1.68);
    med(3.38, -3.25 + 0.33, 0, toalett);
    dusch(3.83, -3.25, 4.75, -2.35, [[3.83, -3.25, 3.83, -2.35], [3.83, -2.35, 4.3, -2.35]], 'E');
    med(1.75, -2.77, PI / 2, () => garderob(0.95, 0.6, 2.0, 1, 'bad'));
    med(1.75, -1.98, PI / 2, tvatt);
    med(2.77, -3.25 + 0.23, 0, () => handfat({ sida: -1 }));   // sist: stegen/kroken ser skåp och WC
    yield;
    // sovrum 1
    med(-3.36, -3.25 + 1.025 + 0.085, 0, () => sang(0.9, 2.05, { pled: '#a7b098' }));
    med(-4.12, -3.05, 0, () => nattbord({ sida: -1 }));
    med(-4.45, -0.42, PI / 2, () => garderob(0.6, 0.6, 2.1, 1));
    matta(-4.28, -2.03, 0.7, 0.85, 0, '#d8cdbb', 1);
    med(-4.45, -1.35, PI / 2, () => stolPled('#b9895c'));
    konst(-2.83, 1.45, -2.1, -PI / 2, 0.8, 0.55, 2);
    vagghylla(-4.75, -2.0, PI / 2, 0.7, 1.5);
    plafond(-3.77, -1.7);   // rummet hade bara sänglampan (dunkelt på kvällen)
    yield;
    // sovrum 2
    med(-2.18, -3.25 + 1.025 + 0.085, 0, () => sang(0.9, 2.05, { pled: '#b9895c' }));
    med(-1.42, -3.05, 0, nattbord);
    med(-1.07, -0.42, -PI / 2, () => garderob(0.6, 0.6, 2.1, 1));
    matta(-1.25, -1.8, 0.7, 1.3, 0, '#d8cdbb', 0);
    med(-1.05, -1.35, -PI / 2, () => stolPled('#7f8873'));
    konst(-2.73, 1.45, -2.1, PI / 2, 0.8, 0.55, 0, 'vit');
    vagghylla(-0.765, -2.0, -PI / 2, 0.7, 1.5);
    plafond(-1.75, -1.7);   // rummet hade bara sänglampan (dunkelt på kvällen)
    yield;
    // sovrum 3
    // 120-säng i det 2 m breda rummet: gång på båda sidor (vägg resp. nattduksbord)
    med(0.15, -3.25 + 1.05 + 0.085, 0, () => sang(1.2, 2.1, { pled: PAL.salvia }));
    matta(0.15, -1.6, 1.4, 1.2);
    konst(0.12, 1.62, -3.25, 0, 0.7, 0.5, 3, 'svart');
    med(1.12, -2.95, 0, nattbord);
    med(-0.15, -0.70, 0, () => bank(0.8, 0.34, undefined, null));
    smavaxt(0.12, -0.70, 0.49);
    vagghylla(-0.665, -2.45, PI / 2, 0.5, 1.4);   // smal hylla vid sänggaveln: den tomma västväggen
    pendel(0.12, -1.6, 1.95, false, 'glob');
    yield;
    // vardagsrum: två soffor mot varandra
    matta(-3.0, 1.9, 2.8, 2.3);
    med(-3.89, 1.9, PI / 2, () => soffa(2.1, 0.92, { ton: '#9a958b' }));
    med(-2.1, 1.9, -PI / 2, () => soffa(2.1, 0.92, { ton: '#7f8a78', k1: '#d8cfbf', k2: '#b98a5e' }));
    med(-3.0, 1.9, PI / 2, () => {
      skugga(0, 0, 1.1, 0.55, 0, 0.14, 0.3);
      hind(1.1, 0.55);
      rbx('ek', 1.1, 0.035, 0.55, 0, 0.4, 0, 0.01, 0, 0, 1);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => rbx('ek', 0.04, 0.385, 0.04, a * 0.48, 0.19, b * 0.2, 0.008, 0, 0, 1));
      bocker(-0.25, 0.418, 0.02, 0.2, 3, true);
      vaxt(0.3, -0.05, false, 0.418);
      // bricka med tekanna och två koppar
      ton('#a77c55', () => { rbx('ek', 0.26, 0.01, 0.2, 0.03, 0.423, 0.04, 0.004, 0, 0, 2); for (const k of [-1, 1]) { rbx('ek', 0.26, 0.02, 0.006, 0.03, 0.438, 0.04 + k * 0.097, 0.0025, 0, 0, 1); rbx('ek', 0.006, 0.02, 0.2, 0.03 + k * 0.127, 0.438, 0.04, 0.0025, 0, 0, 1); } });
      ton(PAL.salvia, () => glans(0.6, () => { svarv('keramik', [[0, 0], [0.045, 0], [0.06, 0.03], [0.058, 0.07], [0.035, 0.09], [0.01, 0.095], [0.012, 0.105], [0, 0.108]], -0.02, 0.428, 0.04, 28);
        lagg('keramik', new T.CylinderGeometry(0.006, 0.011, 0.07, 12).rotateZ(-0.8), mx(-0.02 + 0.075, 0.428 + 0.06, 0.04));
        lagg('keramik', new T.TorusGeometry(0.03, 0.0065, 10, 20, PI), mx(-0.02 - 0.058, 0.428 + 0.05, 0.04, 0, 0, PI / 2)); }));
      mugg(0.1, 0.428, -0.01, PAL.vitt, 0.4); mugg(0.1, 0.428, 0.09, PAL.havre, -0.3);
    });
    konst(-3.9, 1.45, -0.01, 0, 0.6, 0.8, 3, 'svart');
    med(-4.45, 0.36, PI / 2, () => kamin(0));
    konst(-0.32, 1.45, -0.01, 0, 0.9, 0.65, 4);
    vaxt(-4.58, 3.08, true, 0, 'sansevieria');
    med(-1.5, 3.0, 0, golvlampa);
    // (växten stod i dörröppningen mot altanen)
    yield;
    // matplats för fyra
    med(1.02, 1.68, PI / 2, () => bord(1.9, 0.9));
    // två stolar per långsida, 80 cm isär och symmetriskt under lamporna (tre per sida krockade)
    [1.3, 2.06].forEach(z => { med(0.36, z, PI / 2, stol); med(1.68, z, -PI / 2, stol); });
    pendel(1.02, 1.3, 1.62, true);
    pendel(1.02, 2.06, 1.62);
    med(1.02, 1.68, PI / 2, () => bordsdukning(0.74));
    yield;
    // kök längs östväggen med vinkel mot söder
    kok({ axel: 'z', vagg: 4.75, ut: -1, s0: -0.01, s1: 2.623, hog: [[-0.01, 1.2]], disk: 1.55, spis: 2.29, over: [[1.2, 1.95]], hylla: [[2.75, 3.2]] });
    // vinkelbänken slutar 26 cm från dörrens foder (x 3,34), så att den går fri från karmen
    kok({ axel: 'x', vagg: 3.25, ut: -1, s0: 3.6, s1: 4.75, blind: 4.45, horn: 4.75 });
    // hörnet: kakel på östväggen, vattenkokare, tre glasburkar och en liten växt
    ton('#e7e1d6', () => box('keramik', 0.012, 0.548, 0.615, 4.744, 1.176, 2.9305));
    ton('#efece6', () => glans(0.6, () => svarv('keramik', [[0, 0], [0.072, 0], [0.078, 0.01], [0.08, 0.15], [0.07, 0.2], [0.03, 0.21], [0, 0.212]], 4.42, 0.902, 3.06, 32)));
    ton('#5a5c60', () => { rbx('vit', 0.03, 0.15, 0.03, 4.42, 0.99, 3.06 + 0.095, 0.01, 0, 0, 1); cyl('vit', 0.03, 0.032, 0.02, 4.42, 0.912, 3.06, 32); cyl('vit', 0.02, 0.02, 0.012, 4.42, 1.118, 3.06, 24); });   // grafit, inte svart
    lagg('keramik', new T.CylinderGeometry(0.01, 0.018, 0.07, 16).rotateX(-0.9), mx(4.42, 1.05, 3.06 - 0.09));
    [[2.74, 0.16], [2.85, 0.13], [2.96, 0.1]].forEach(([zz, hh]) => {
      lagg('glas', new T.CylinderGeometry(0.042, 0.042, hh, 24, 1, true), mx(4.68, 0.902 + hh / 2, zz));
      ton(['#d9c79e', '#a8774e', '#efe6d2'][Math.round(hh * 30) % 3], () => cyl('keramik', 0.04, 0.04, hh * 0.6, 4.68, 0.902 + hh * 0.3, zz, 24));
      ton('#b98b5c', () => cyl('ek', 0.044, 0.044, 0.018, 4.68, 0.902 + hh + 0.009, zz, 24));
    });
    smavaxt(4.65, 3.16, 0.902);
    spot(3.9, 1.0); spot(3.9, 2.0);
    gardiner(3, 'b', 0.42);
    gardiner(8, 'b', 0.4);
    gardiner(4, 'v', 0.42);
    gardiner(0, 'rull');
    gardiner(1, 'rull');
    gardiner(2, 'rull');
  },

  *'sadel-90'() {
    vagg('x', -0.06, -0.40, 5.75, {
      dorrar: [
        { a: 1.32, b: 2.10, gang: 'b', sida: -1, vinkel: 85 },
        { a: 2.44, b: 3.25, gang: 'a', sida: -1, vinkel: 85 },
      ],
    });
    vagg('z', -0.35, -3.25, -0.11);
    vagg('z', 2.25, -3.25, -0.11);
    vagg('z', 3.49, -0.01, 3.25, { dorrar: [{ a: 0.12, b: 0.92, gang: 'b', sida: 1, vinkel: 85 }] });
    // badrumsdörren öppnar in i badet (stod uppslagen över halva korridoren), gångjärn mot toaletten
    vagg('x', 1.385, 0.46, 3.44, { dorrar: [{ a: 1.54, b: 2.31, gang: 'a', sida: 1, vinkel: 80 }] });
    vagg('z', 0.52, 1.435, 3.25);
    vagg('z', -1.575, 1.38, 3.25, { t: 0.13 });
    yield;
    // allrum: soffgrupp mot västväggen
    matta(-4.4, -1.93, 2.3, 2.6);
    med(-5.25, -1.93, PI / 2, () => soffa(2.1, 0.92, { ton: '#9a958b' }));
    med(-4.35, -1.93, 0, () => soffbord(0.4));
    med(-3.25, -1.8, -1.31, () => fatolj());
    med(-3.27, -2.95, 0, () => kamin(-1));
    konst(-0.40, 1.45, -1.9, -PI / 2, 1.0, 0.7);
    vaxt(-0.72, -1.1, true, 0, 'zz');   // vid väggen bredvid tavlan, inte framför skjutdörrens glas
    // (växten stod vid ytterdörren)
    vagghylla(-5.75, -1.93, PI / 2, 1.2, 1.6, true);
    med(-5.42, -0.6, 0, golvlampa);   // vid soffans södra gavel (stod framför norrfönstrets glas)
    pendel(-4.35, -1.93, 2.0, false, 'glob');
    yield;
    // matplats vid västfönstren
    med(-4.6, 1.0, 0, () => bord(1.8, 0.85));
    // två stolar per långsida, 80 cm isär och symmetriskt under lamporna (tre per sida krockade)
    [-5.0, -4.2].forEach(x => { med(x, 0.38, 0, stol); med(x, 1.62, PI, stol); });
    pendel(-5.0, 1.0, 1.5, true);
    pendel(-4.2, 1.0, 1.5);
    med(-4.6, 1.0, 0, () => bordsdukning(0.74));
    yield;
    // kök längs söderväggen och garderober vid entrén
    // bänken slutar fri från glasdörrens foder (dörren x -5,44 till -4,57)
    kok({ axel: 'x', vagg: 3.25, ut: -1, s0: -4.47, s1: -1.64, hog: [[-2.24, -1.64]], spis: -2.6, disk: -4.0, over: [[-3.6, -2.24]], hylla: [[-4.45, -3.7]] });
    med(-1.21, 2.315, PI / 2, () => garderob(1.87, 0.6, 2.15, 3, 'hall'));
    spot(-3.6, 2.4); spot(-2.6, 2.4);
    yield;
    // sovrum 7,8
    med(0.23, -3.25 + 1.025 + 0.085, 0, () => sang(0.9, 2.05, { pled: '#a7b098' }));
    med(0.98, -3.05, 0, nattbord);
    matta(1.1, -1.7, 1.1, 0.8, 0, '#d8cdbb', 1);
    med(1.95, -2.2, -PI / 2, () => stolPled(undefined, true));
    vaxt(1.98, -2.92, true, 0, 'oliv');   // i ljuset vid fönstret (stod i bildkanten vid dörrväggen)
    // garderob mot östväggen, fri från dörrbladet (z till -0,86) och stolen
    med(1.9, -1.4, -PI / 2, () => garderob(0.9, 0.6, 2.1, 2));
    konst(-0.30, 1.45, -2.1, PI / 2, 0.8, 0.55, 2, 'vit');
    plafond(0.95, -1.7);   // rummet hade bara sänglampan (dunkelt på kvällen)
    yield;
    // sovrum 10,6: dubbelsäng med huvudänden mot korridorväggen
    med(4.42, -0.11 - 1.05 - 0.085, PI, () => sang(1.6, 2.1, { pled: '#c9957a' }));
    // ingen nattduksbordsplats vid dörren: en vägglampa på väggen i stället
    vagglampa(3.44, 1.36, -0.11, PI);
    med(5.51, -0.33, PI, () => nattbord({ sida: -1 }));
    konst(4.42, 1.6, -0.11, PI, 0.9, 0.55, 0);
    matta(4.42, -2.75, 1.9, 0.7);
    pendel(4.42, -1.3, 1.95, false, 'glob');
    med(4.42, -2.68, 0, () => bank(1.2, 0.38));
    med(2.75, -2.8, PI * 0.25, () => stolPled('#b9895c'));
    vaxt(3.25, -2.8, true, 0, 'sansevieria');
    // garderob mot västväggen, mellan dörrbladet och läshörnan (rummet saknade förvaring)
    med(2.6, -1.6, PI / 2, () => garderob(1.2, 0.6, 2.1, 2));
    yield;
    // sovrum 7,1
    med(5.20, -0.01 + 1.025 + 0.085, 0, () => sang(0.9, 2.05, { pled: '#b9895c' }));
    med(4.45, 0.2, 0, () => nattbord({ sida: -1 }));
    // garderob mot västväggen söder om dörren, smal matta i gången mot sängen
    med(3.84, 1.65, PI / 2, () => garderob(1.0, 0.6, 2.1, 2));
    matta(4.44, 1.45, 0.5, 1.3, 0, '#d8cdbb', 0);
    med(3.85, 2.85, PI * 0.75, () => stolPled());
    vaxt(5.45, 2.55, true, 0, 'fikus');
    konst(5.75, 1.45, 1.1, -PI / 2, 0.8, 0.55, 1, 'svart');
    plafond(4.62, 1.6);   // rummet hade bara sänglampan (dunkelt på kvällen)
    hallen(0.455, 2.2, -PI / 2);
    spot(-0.2, 2.3);   // hallen
    matta(-0.17, 2.88, 0.8, 0.5, 0, '#8d8173');   // dörrmatta innanför ytterdörren
    spot(1.2, 0.66); spot(2.7, 0.66);   // korridoren
    konst(2.88, 1.5, 1.335, PI, 0.5, 0.7, 4);   // korridorens badrumsvägg (annat motiv än sovrum 1)
    yield;
    // bad
    bad(0.57, 3.44, 1.435, 3.25);   // först: kakelsättningen gäller schakt och nisch
    med(0.57 + 0.33, 1.86, PI / 2, toalett);
    dusch(0.57, 2.35, 1.48, 3.25, [[1.48, 2.35, 1.48, 3.25], [1.0, 2.35, 1.48, 2.35]], 'W');
    med(3.14, 2.95, -PI / 2, tvatt);
    med(3.44 - 0.23, 1.85, -PI / 2, () => handfat({ sida: 1 }));   // sist: stegen/kroken ser tvättmaskinen
    gardiner(0, 'b', 0.4);
    gardiner(2, 'h', 0.42);
    gardiner(3, 'b', 0.38);
    gardiner(8, 'b', 0.4);
    gardiner(9, 'b', 0.42);
    gardiner(1, 'rull');
    gardiner(7, 'b', 0.3);
  },
};

// ---- Inbakad ocklusion i hörnfärgerna ----
// Samma resultat som förut, men utan nya funktioner per hörn: väggarna förbereds en
// gång och avståndet till väggen (billigast) testas först, så att de flesta hoppas över.
const ocS = (a, d, k, r, w) => (w <= 0.01 || d < -0.03 ? a : a * (1 - k * w * Math.exp(-(d > 0 ? d : 0) / r)));
const viktS = c => (c > 0.25 ? 1 : Math.max(0, 1 + c * 1.35));
function lagaAO(H) {
  const XA = -H.L / 2 + I, XB = H.L / 2 - I, ZA = -H.W / 2 + I, ZB = H.W / 2 - I;
  const W = VAGGAR.map(w => ({
    ax: w.axel === 'x', lo: w.lo, hi: w.hi, bunn: w.bunn - 0.04, topp: w.topp, c: w.c, t2: w.t / 2,
    hal: w.hal.map(h => [h.a + 0.02, h.b - 0.02, h.h]),
  }));
  const nW = W.length;
  return (x, y, z, nx, ny, nz) => {
    let a = 1, golv = 0, tak = CEIL(x, z);
    if (iLoft(x, z)) { if (y < LU + 0.02) tak = LU; else golv = LT; }
    a = ocS(a, y - golv, 0.5, 0.2, viktS(-ny));
    a = ocS(a, tak - y, 0.42, 0.42, viktS(ny));
    a = ocS(a, x - XA, 0.42, 0.36, viktS(-nx));
    a = ocS(a, XB - x, 0.42, 0.36, viktS(nx));
    a = ocS(a, z - ZA, 0.42, 0.36, viktS(-nz));
    a = ocS(a, ZB - z, 0.42, 0.36, viktS(nz));
    for (let i = 0; i < nW; i++) {
      const w = W[i];
      const q = w.ax ? z : x, d = Math.abs(q - w.c) - w.t2;
      if (d > 1.2 || d < -0.03) continue;
      const s = w.ax ? x : z;
      if (s < w.lo - 0.04 || s > w.hi + 0.04 || y < w.bunn) continue;
      if (y > w.topp(Math.min(w.hi, Math.max(w.lo, s))) + 0.04) continue;
      let ihal = false;
      for (let j = 0; j < w.hal.length; j++) { const h = w.hal[j]; if (s > h[0] && s < h[1] && y < h[2]) { ihal = true; break; } }
      if (ihal) continue;
      const nq = w.ax ? nz : nx;
      a = ocS(a, d, 0.4, 0.34, viktS((q > w.c ? -1 : 1) * nq));
    }
    return Math.max(0.34, a);
  };
}

// ---- Ihopslagning per lager och material ----
// omgivningsljusets andel per material (gånger scenens environmentIntensity)
const ENV = { golv: 0.42, vagg: 0.34, ek: 0.48, tyg: 0.34, vit: 0.45, svart: 0.7, keramik: 0.65, kakel: 0.6, klinker: 0.6, blad: 0.4, tryck: 0.3, skarm: 0.34 };
const UTAN_SKUGGA = ['glas', 'lampa', 'skugga', 'sken', 'golv', 'tryck', 'spegel', 'flamma', 'eld'];
function* slaIhopSteg(grupp, H) {
  const ao = lagaAO(H);
  const fc = new Map();
  const farg = hex => { if (!fc.has(hex)) fc.set(hex, new T.Color(hex)); return fc.get(hex); };
  const lager = { tak: new T.Group(), loft: new T.Group(), botten: new T.Group() };
  Object.keys(lager).forEach(k => { lager[k].name = 'inne-' + k; grupp.add(lager[k]); });
  let tris = 0, anrop = 0;
  let raknat = 0;
  const skenMat = skenMaterial(MAT.skenTex), lampMats = [];
  // acc: material -> geometrier. m: lokal ram (öppningsbara delar och lampor byggs i sin
  // egen ram; för ocklusionen läggs de i husets ram och flyttas sedan tillbaka).
  // ut(lg, mesh) tar hand om färdiga meshar; klon: egna materialkopior (lampor).
  function* bygg(acc, m0, ut, klon) {
  const minv = m0 ? m0.clone().invert() : null;
  for (const [key, lista] of acc) {
    const [lg, mk] = key.split('|');
    const geos = [];
    // tomt hus: fast inredning först, lösa saker sist (stabil sortering), nFast = hörn i det fasta
    const ordnad = lista.some(g => g.userData.los) ? lista.slice().sort((a, b) => (a.userData.los ? 1 : 0) - (b.userData.los ? 1 : 0)) : lista;
    let nFast = 0;
    for (const g of ordnad) {
      const arLos = !!g.userData.los;
      if (m0) { g.applyMatrix4(m0); if (g.userData.inne) g.userData.inne = { hex: g.userData.inne.hex, c: g.userData.inne.c.clone().applyMatrix4(m0) }; }
      const tn = g.userData.ton, alfa = g.userData.alfa, ar = !!g.userData.stal, rg = g.userData.rgh ?? 1, inn = g.userData.inne, lag = g.userData.vav ?? 0, lnr = g.userData.lnr ?? 0;
      let k = g.index ? g.toNonIndexed() : g;
      if (k !== g) g.dispose();
      const skr = k.attributes.skr ? k.attributes.skr.array.slice() : null;   // veckens skugga (täcken, gardiner)
      Object.keys(k.attributes).forEach(n => { if (n !== 'position' && n !== 'normal' && n !== 'uv') k.deleteAttribute(n); });
      if (!k.attributes.normal) k.computeVertexNormals();
      const n = k.attributes.position.count;
      { const pa = k.attributes.position.array, gx = H.L / 2 - 0.045, gz = H.W / 2 - 0.045;
        for (let i = 0; i < pa.length; i += 3) { if (pa[i] > gx) pa[i] = gx; else if (pa[i] < -gx) pa[i] = -gx; if (pa[i + 2] > gz) pa[i + 2] = gz; else if (pa[i + 2] < -gz) pa[i + 2] = -gz; } }
      if (!k.attributes.uv) k.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(n * 2), 2));
      // borstat stål: strimmorna följer läget (v), blankt läser vänstra halvan
      if (mk === 'spegel' || mk === 'diskstal') { const u = k.attributes.uv; for (let i = 0; i < n; i++) u.setXY(i, ar ? 0.75 : 0.25, 0.5); }
      const p = k.attributes.position.array, nr = k.attributes.normal.array;
      // textil: väven i jämn täthet oavsett geometri (uv ur läget, efter ytans riktning)
      // ek: ådringen i verklig skala (0,6 m per ruta), längs den längsta riktningen
      // (delens längsta mått avgör: stående ben och spjälor får stående ådring, skivor längs
      // sin längd; varje del börjar på sitt eget ställe i mönstret, så att benen inte är kopior)
      if (mk === 'ek') { const u = k.attributes.uv; k.computeBoundingBox(); const bb = k.boundingBox, ex = bb.max.x - bb.min.x, ey = bb.max.y - bb.min.y, ez = bb.max.z - bb.min.z;
        const L = ey > ex * 1.15 && ey > ez * 1.15 ? 1 : ez > ex ? 2 : 0, fo = ((bb.min.x * 7.31 + bb.min.z * 3.17 + bb.min.y * 1.93) % 1 + 1) % 1;
        for (let i = 0; i < n; i++) { const X = p[i * 3], Y = p[i * 3 + 1], Z = p[i * 3 + 2], ax = Math.abs(nr[i * 3]), ay = Math.abs(nr[i * 3 + 1]), az = Math.abs(nr[i * 3 + 2]);
          let a, b;
          if (ay >= ax && ay >= az) { if (L === 2) { a = Z + X * 0.13; b = X; } else { a = X + Z * 0.13; b = Z; } }
          else if (ax >= az) { if (L === 1) { a = Y; b = Z; } else { a = Z; b = Y; } }
          else if (L === 1) { a = Y; b = X; } else { a = X; b = Y; }
          u.setXY(i, a / 0.6, b / 0.6 + fo); } }
      if (mk === 'tyg' || mk === 'gardin') {
        const u = k.attributes.uv, tu = new Float32Array(n * 3), sk = 1 / VAVM[lag];
        for (let i = 0; i < n; i++) { const X = p[i * 3], Y = p[i * 3 + 1], Z = p[i * 3 + 2], ax = Math.abs(nr[i * 3]), ay = Math.abs(nr[i * 3 + 1]), az = Math.abs(nr[i * 3 + 2]);
          let a, b; if (ay >= ax && ay >= az) { a = X; b = Z; } else if (ax >= az) { a = Z; b = Y; } else { a = X; b = Y; }
          u.setXY(i, a * 2.2, b * 2.2); tu[i * 3] = a * sk; tu[i * 3 + 1] = b * sk; tu[i * 3 + 2] = lag; }
        k.setAttribute('tyguv', new T.Float32BufferAttribute(tu, 3));
      }
      if (mk === 'skugga' || mk === 'sken') {
        const c = new Float32Array(n * 4), bas = mk === 'sken' ? farg(tn || '#ffd2a0') : null;
        for (let i = 0; i < n; i++) { c[i * 4] = bas ? bas.r : 1; c[i * 4 + 1] = bas ? bas.g : 1; c[i * 4 + 2] = bas ? bas.b : 1; c[i * 4 + 3] = alfa ?? 0.5; }
        k.setAttribute('color', new T.Float32BufferAttribute(c, 4));
        if (mk === 'sken') k.setAttribute('lnr', new T.Float32BufferAttribute(new Float32Array(n).fill(lnr), 1));
      } else {
        const bas0 = tn ? farg(tn) : null, ic = inn ? farg(inn.hex) : null, c = new Float32Array(n * 3);
        const ljus = mk === 'glas' || mk === 'lampa' || mk === 'spegel' || mk === 'flamma' || mk === 'eld';
        const golvAO = mk === 'blad' ? 0.55 : 1;   // bladen får bara hälften av hörnmörkret
        for (let i = 0; i < n; i++) {
          let f = ljus ? 1 : ao(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]);
          f = 1 - (1 - f) * golvAO;
          if (skr) f *= skr[i];
          const bas = ic && (inn.c.x - p[i * 3]) * nr[i * 3] + (inn.c.y - p[i * 3 + 1]) * nr[i * 3 + 1] + (inn.c.z - p[i * 3 + 2]) * nr[i * 3 + 2] > 0 ? ic : bas0;
          c[i * 3] = (bas ? bas.r : 1) * f; c[i * 3 + 1] = (bas ? bas.g : 1) * f; c[i * 3 + 2] = (bas ? bas.b : 1) * f;
        }
        k.setAttribute('color', new T.Float32BufferAttribute(c, 3));
      }
      if (GLANS.includes(mk)) k.setAttribute('rgh', new T.Float32BufferAttribute(new Float32Array(n).fill(rg), 1));
      k.clearGroups();
      geos.push(k);
      if (!arLos) nFast += n;
      raknat += n;
      if (raknat > 2500) { raknat = 0; yield; }   // (hörnmörkret per hörn är dyrt: kortare steg)
    }
    let ihop = null;
    try { ihop = mergeGeometries(geos, false); } catch (e) { ihop = null; }
    geos.forEach(g => g.dispose());
    yield;
    if (!ihop) continue;
    if (minv) ihop.applyMatrix4(minv);
    ihop.computeBoundingSphere();
    tris += ihop.attributes.position.count / 3; anrop++;
    const mat = mk === 'sken' ? skenMat : (mk === 'flamma' || mk === 'eld') ? MAT[mk].clone() : klon && (mk === 'lampa' || mk === 'skarm') ? MAT[mk].clone() : MAT[mk];
    const m = new T.Mesh(ihop, mat);
    m.name = 'inne-' + lg + '-' + mk;
    if (nFast < ihop.attributes.position.count) { m.userData.fastN = nFast; LOSA.push(m); }
    // taket kastar ingen egen skugga: yttertaket ligger 2 cm ovanför och skuggar redan,
    // och två nästan sammanfallande skuggytor gav randig skuggakne över takfallet
    m.castShadow = !UTAN_SKUGGA.includes(mk) && !(lg === 'tak' && mk === 'vagg');
    m.receiveShadow = !['glas', 'lampa', 'skugga', 'sken', 'flamma', 'eld'].includes(mk);
    if (mk === 'glas') m.renderOrder = 3;
    if (mk === 'skugga') m.renderOrder = 1;
    if (mk === 'sken') { m.renderOrder = 2; m.onBeforeRender = () => {
      // varje lampas sken följer lampans egen glöd (motorn styr den, 2,5 = tänd)
      const u = skenMat.userData.ljus.value;
      lampMats.forEach((l, i) => { let e = 0; l.forEach(([mt, s]) => { e = Math.max(e, mt.emissiveIntensity / s); }); u[i] = Math.min(1.2, e / 2.5); });
    }; }
    if (mk === 'gardin') m.onBeforeRender = (r, sc) => {
      const mt = m.material;
      if (sc.environment && mt.envMap !== sc.environment) mt.envMap = sc.environment;
      const e = Math.min(1, sc.environmentIntensity ?? 1);
      mt.envMapIntensity = 0.34 * e; mt.emissiveIntensity = 0.07 * e;   // dagsljuset lyser igenom linnet
    };
    m.matrixAutoUpdate = false; m.updateMatrix();
    // Scenens environmentIntensity skriver annars över materialets envMapIntensity
    // (när envMap är null). Med envMap satt gäller vår egen, relativt scenens värde.
    if (ENV[mk]) m.onBeforeRender = (r, sc) => {
      const mt = m.material;
      // väggarna behåller sin egen neutrala omgivning (ingen grön mark i väggfärgen)
      if (mk !== 'vagg' && sc.environment && mt.envMap !== sc.environment) mt.envMap = sc.environment;
      mt.envMapIntensity = ENV[mk] * (sc.environmentIntensity ?? 1);
      // skärmarna lyser igenom i takt med lamporna, om inte motorn styr dem själv
      if (mk === 'skarm' && !mt.userData.styrd) mt.emissiveIntensity = MAT.lampa.emissiveIntensity * 0.22;
    };
    // spegeln har sin egen omgivning: lite svagare när huset i övrigt är mörkt
    // krom och stål speglar scenens mjuka (PMREM) omgivning om den finns: inga hårda ränder
    if (mk === 'spegel') m.onBeforeRender = (r, sc) => {
      const e = Math.min(1, sc.environmentIntensity ?? 1);
      if (sc.environment && m.material.envMap !== sc.environment) m.material.envMap = sc.environment;
      // kvällen: reflexen dras ned med rummet (rostfritt ska inte lysa vitt i mörkret)
      m.material.envMapIntensity = 0.1 + 0.62 * e + (MAT.lampa.emissiveIntensity > 0.3 ? 0.06 : 0);
    };
    // borstat stål och mässing med egen neutral omgivning: lika mörkt som rummet på kvällen
    if (mk === 'diskstal') m.onBeforeRender = (r, sc) => { m.material.envMapIntensity = 0.15 + 0.95 * Math.min(1, (sc.environmentIntensity ?? 0.9) / 0.9); };
    // egen lampa: följer kvällens styrka tills motorn tar över (material.userData.styrd)
    if (mat !== MAT[mk] && mk === 'lampa') m.onBeforeRender = () => { if (!mat.userData.styrd) mat.emissiveIntensity = MAT.lampa.emissiveIntensity; };
    ut(lg, m);
  }
  }
  yield* bygg(ACC, null, (lg, m) => lager[lg].add(m), false);
  // öppningsbara delar: en pivot per del (vid gångjärnet / lådans stängda läge)
  for (const e of OPP) {
    yield* bygg(e.acc, e.m, (lg, m) => e.obj.add(m), false);
    lager[e.lager].add(e.fast); e.acc = null;
  }
  // speglar: eget material (metalness 1, roughness 0,02, vit); den målade omgivningen gäller
  // tills motorn har fångat en riktig reflex
  const speglar = [];
  for (const e of SPEGLAR) {
    e.m.decompose(e.mesh.position, e.mesh.quaternion, e.mesh.scale); e.mesh.name = 'spegel';
    yield* bygg(e.acc, e.m, (lg, m) => {
      m.material = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0, envMap: MAT.spegel.envMap, envMapIntensity: 1 });
      m.onBeforeRender = () => {}; m.castShadow = false; m.name = 'spegelglas';
      e.mesh.add(m); speglar.push(m);
    }, false);
    lager[e.lager].add(e.mesh); e.acc = null;
  }
  grupp.userData.speglar = speglar;
  // lampor: egen mesh med egen materialkopia per lampa
  // levande ljus och kaminens eld: egen mesh med egen materialkopia
  for (const e of [...LJUSL, ...(ELD ? [ELD] : [])]) {
    yield* bygg(e.acc, e.m, (lg, m) => { e.mesh.add(m); e.mat = m.material; }, false);
    lager[e.lager].add(e.mesh); e.acc = null;
  }
  for (const e of LAMPOR) {
    yield* bygg(e.acc, e.m, (lg, m) => e.mesh.add(m), true);
    lager[e.lager].add(e.mesh); e.acc = null;
    const l = []; e.mesh.traverse(o => { if (o.isMesh && o.material.emissive) l.push([o.material, /-skarm$/.test(o.name) ? 0.22 : 1]); });
    lampMats.push(l);
  }
  grupp.userData.lager = lager;
  grupp.userData.trianglar = Math.round(tris);
  grupp.userData.anrop = anrop;
}

// Gångytor för genomgången: osynliga plan (bara för strålkastning), 0,15 m in från väggarna
// (krocken håller ögat från väggen; planet ska inte ta slut före krocken, det ger hack).
function gangYtor(grupp, H) {
  const ut = [];
  const plan = (x0, x1, z0, z1, y, niva) => {
    if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
    const g = new T.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const m = new T.Mesh(g, MAT.osynlig);
    m.name = 'golv-' + niva; m.userData.niva = niva; m.castShadow = m.receiveShadow = false;
    m.matrixAutoUpdate = false; m.updateMatrix();
    grupp.add(m); ut.push(m);
  };
  const xa = -H.L / 2 + I, xb = H.L / 2 - I, za = -H.W / 2 + I, zb = H.W / 2 - I, r = 0.15;
  plan(xa + r, xb - r, za + r, zb - r, 0.01, 'botten');
  // loftet: A (norr) och B (hela djupet); B går in över A så att de hänger ihop
  if (LOFT.length === 2) {
    const [A, B] = LOFT;
    plan(A[0] + r, A[1] - r, A[2] + r, A[3] - r, LT + 0.01, 'loft');
    plan(B[0] + r, B[1] - r, B[2] - r, B[3] - r, LT + 0.01, 'loft');
  }
  return ut;
}
// byggInneSteg: samma bygge i små steg (generator). Motorn kör stegen när datorn är
// ledig och tar svaret (gruppen) när generatorn är klar. Ett nytt bygge nollar modulens
// tillstånd, så ett avbrutet bygge får aldrig fortsätta efter att ett nytt har startat.
export function byggInne(THREE, id, H) {
  const it = byggInneSteg(THREE, id, H);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
export function* byggInneSteg(THREE, id, H) {
  T = THREE;
  yield* lagaMaterialSteg();
  ACC = new Map(); BAS = new T.Matrix4(); HH = H; CEIL = lagaTak(H); LJUS = null;
  VAGGAR = []; LOFT = []; HAL = []; TON = null; RGH = 1; EFTER = []; BADRUM = []; DUSCHAR = [];
  SPEGLAR = []; OPP = []; LAMPOR = []; SITT = []; BRYT = []; ID = id; NSTOL = 0; NSANG = 0; SEED = 7; LAGER = 'botten'; VAXTNR = 0;
  HARLOFT = ['sadel-30', 'sadel-40', 'sadel-50'].includes(id);
  HINDER = []; TRAPPOR = []; VAVL = null; LJUSL = []; ELD = null; MATTOR = [];
  // ytterväggarna som hinder på alla nivåer
  const xa = -H.L / 2, xb = H.L / 2, za = -H.W / 2, zb = H.W / 2;
  HINDER.push({ x0: xa, z0: za, x1: xb, z1: za + I, niva: 'alla' }, { x0: xa, z0: zb - I, x1: xb, z1: zb, niva: 'alla' },
    { x0: xa, z0: za, x1: xa + I, z1: zb, niva: 'alla' }, { x0: xb - I, z0: za, x1: xb, z1: zb, niva: 'alla' });
  const grupp = new T.Group();
  grupp.name = 'inne';
  skal(H);
  yield;
  // möblerna rum för rum, ett steg per rum
  LOS = true; LOSA = [];   // i husens möblering är allt löst utom det som FAST-listan pekar ut
  if (MODELL[id]) yield* MODELL[id]();
  LOS = false;
  yield;
  golvOchTak(H);
  yield;
  loftYtor();
  yield;
  oppningsDetaljer(H);
  yield;
  yield* slaIhopSteg(grupp, H);
  grupp.userData.golvYtor = gangYtor(grupp, H);
  grupp.userData.hinder = HINDER;
  grupp.userData.trappor = TRAPPOR.map(t => ({ ...t }));
  grupp.userData.rumPunkter = (RUM[id] || []).map(([namn, x, z, nv, mal]) => { const niva = nv === 'loft' ? 'loft' : 0; return {
    namn, niva: niva || 'botten', ...(mal ? { mal: mal.slice() } : {}),
    ...((INNE_VYER[id] || []).find(v => v.namn === namn && v.ljus) ? { ljus: INNE_VYER[id].find(v => v.namn === namn).ljus } : {}),
    pos: [x, niva === 'loft' ? Math.round(Math.min(LT + 1.55, CEIL(x, z) - 0.15) * 100) / 100 : (/bad|bastu/i.test(namn) ? 1.5 : 1.55), z],
    // golvets höjd under punkten (loftets golv på loftet), så att skivan ligger på golvet
    golv: niva === 'loft' ? LT : 0,
  }; });
  // takVid(x, z, niva): takets höjd över bottenvåningens golv. På loftet gäller yttertaket,
  // nere loftets undersida där loftet ligger över. Stängd över kopior av lägena (modulens
  // tillstånd nollas av nästa bygge).
  {
    const loft = LOFT.map(r => r.slice()), ceil = CEIL;
    const under = (x, z) => loft.some(r => x > r[0] - 0.01 && x < r[1] + 0.01 && z > r[2] - 0.01 && z < r[3] + 0.01);
    grupp.userData.takVid = (x, z, niva) => (niva === 1 || niva === 'loft' || !under(x, z) ? ceil(x, z) : LU);
  }
  // genomskärning: väggar och foder ovanför snitthöjden ligger i lager.tak (och loft)
  grupp.userData.snittHojd = HARLOFT ? SNITT[1] : SNITT[0];
  grupp.userData.snittHojder = HARLOFT ? { botten: SNITT[0], loft: SNITT[1] } : { botten: SNITT[0] };
  // spelbara delar: öppningsbara dörrar och luckor, egna lampor, sittplatser
  grupp.userData.oppningsbara = OPP.map(({ obj, typ, axel, max, start, namn, rum }) => ({ obj, typ, axel, max, start, namn, rum }));
  grupp.userData.lampor = LAMPOR.map(({ namn, pos, mesh, rum, halo, los }) => {
    let b = null, bd = pos[1] < LT ? 6 : 0;   // loftets lampor har ingen väggbrytare
    BRYT.forEach(q => { const d = Math.hypot(q.x - pos[0], q.z - pos[2]); if (d < bd && !blockerad(q.x, q.z, pos[0], pos[2])) { bd = d; b = q; } });
    return { namn, pos, mesh, rum, los: !!los, ...(halo ? { halo } : {}), ...(b ? { brytare: [b.x, b.y, b.z].map(v => Math.round(v * 100) / 100) } : {}) };
  });
  grupp.userData.sittplatser = SITT.map(({ namn, pos, mal, niva, los }) => ({ namn, pos, mal, niva, los: !!los }));
  grupp.userData.sittYtor = SITT.map(s => { grupp.add(s.yta); return s.yta; });
  grupp.userData.lampMaterial = MAT.lampa;
  grupp.userData.ljusLagor = LJUSL.map(({ pos, mesh, los }) => ({ pos, mesh, los: !!los }));
  grupp.userData.losa = LOSA; LOSA = []; LOS = false;
  if (ELD) grupp.userData.eld = { pos: ELD.pos, material: ELD.mat, mesh: ELD.mesh };
  grupp.userData.skarmMaterial = MAT.skarm;
  SPEGLAR = null; OPP = null; LAMPOR = null; SITT = null; BRYT = null;
  ACC = null; VAGGAR = null; HAL = null; HINDER = null; EFTER = null; BADRUM = null; DUSCHAR = null;
  if (LJUS) {
    const l = new T.PointLight(0xffd6a0, 1.4, 7, 2);
    l.castShadow = false;
    l.position.copy(LJUS);
    grupp.add(l);
    grupp.userData.lampa = l;
  }
  grupp.userData.vyer = INNE_VYER[id] || [];
  return grupp;
}
