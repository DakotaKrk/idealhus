// Husritaren: husen från bygglovsritningarna (A-40.1/A-40.3, BTIB 2026-11)
// byggda i three.js. Allt mäts i meter. x går längs huset (väst -> öst),
// z tvärs (norr -> söder), y uppåt. Väggarna är plana ytor med riktiga hål
// för fönster och dörrar; i hålen sitter smyg, karm, foder och glas.
import * as THREE from './vendor/three/three.module.min.js';
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { mergeGeometries } from './vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { skapaMiljo } from './husritare-miljo.js?v=20261119k';
import { byggInne, byggInneSteg, INNE_VYER } from './husritare-inne.js?v=20261119k';
import { skapaPlanlager } from './husritare-plan.js?v=20261119k';

// ---- Husen enligt ritningarna ------------------------------------------
// Öppningar: [sida, x från vänster sett utifrån, bredd, underkant, höjd, typ, rutor]
// Typer: f fönster, d dörr, dg dörr med glas, sk skjutdörr.
const HUS = {
  'sadel-30': {
    namn: 'Sadel 30', yta: 30, L: 7.5, W: 4, tak: 'sadel', he: 2.6, hr: 3.62, altan: 'E',
    kupa: { langd: 3.8, hk: 3.45 },
    rum: [['Allrum', 14.8], ['Sovrum', 4.9], ['WC/bad', 3.7], ['Loft', 9.0]],
    farg: { fasad: 'gran', tak: 'svart', detalj: 'gragron' },
    oppningar: [
      ['S', 0.55, 0.78, 0, 2.1, 'f', 1], ['S', 0.52, 2.72, 2.77, 0.58, 'f', 3], ['S', 4.05, 0.89, 0, 2.1, 'd', 1], ['S', 5.08, 0.6, 0, 2.1, 'f', 1],
      ['N', 1.87, 0.78, 0, 2.1, 'dg', 1], ['N', 4.95, 0.61, 1.5, 0.6, 'f', 1],
      ['E', 0.87, 2.39, 0, 2.08, 'sk', 2],
    ],
  },
  'sadel-40': {
    namn: 'Sadel 40', yta: 40, L: 10, W: 4, tak: 'sadel', he: 2.6, hr: 3.62, altan: 'E',
    kupa: { langd: 4.33, hk: 3.45 },
    rum: [['Allrum', 22.8], ['Sovrum', 5.6], ['WC/bad', 3.7], ['Loft', 9.7]],
    farg: { fasad: 'mossgron', tak: 'rod', detalj: 'salvia' },
    oppningar: [
      ['S', 0.29, 2.71, 2.8, 0.58, 'f', 3], ['S', 0.35, 0.81, 0.13, 1.98, 'f', 1], ['S', 5.17, 0.87, 0, 2.11, 'd', 1], ['S', 6.6, 1.62, 0.9, 1.21, 'f', 2],
      ['N', 4.02, 0.81, 0, 2.1, 'dg', 1], ['N', 7.33, 0.59, 1.5, 0.6, 'f', 1],
      ['W', 0.32, 0.91, 1.52, 0.6, 'f', 1], ['W', 2.86, 0.81, 0.12, 2.0, 'f', 1],
      ['E', 0.46, 3.02, 0, 2.1, 'f', 2],
    ],
  },
  'sadel-50': {
    namn: 'Sadel 50', yta: 50, L: 12.5, W: 4, tak: 'sadel', altan: 'E', he: 2.47, hr: 2.47 + 2 * Math.tan(30 * Math.PI / 180),
    rum: [['Allrum', 25.1], ['Sovrum', 9.4], ['WC/bad', 3.9], ['Bastu', 2.0], ['Loft', 16.0]],
    farg: { fasad: 'grabla', tak: 'tegel', detalj: 'beige' },
    oppningar: [
      ['N', 2.12, 1.63, 0.89, 1.21, 'f', 2], ['N', 4.12, 0.8, 0, 2.1, 'dg', 1], ['N', 6.51, 0.6, 1.5, 0.6, 'f', 1], ['N', 8.47, 0.6, 1.5, 0.6, 'f', 1],
      ['W', 0.25, 0.81, 0.1, 2.0, 'f', 1], ['W', 2.93, 0.81, 0.1, 2.0, 'f', 1],
      ['E', 0.5, 3.02, 0, 2.1, 'f', 2],
      ['S', 0.25, 0.81, 0.13, 1.98, 'f', 1], ['S', 7.66, 0.89, 0, 2.11, 'd', 1], ['S', 9.06, 3.01, 0, 2.1, 'f', 2],
    ],
  },
  'pulpet-70': {
    namn: 'Pulpet 70', yta: 70, L: 10, W: 7, tak: 'pulpet', hN: 3.06, hS: 3.67, trappa: 'betong',
    altan: 'S',
    rum: [['Vardagsrum/kök', 30.8], ['Sovrum', 7.1], ['Sovrum', 6.0], ['Sovrum', 6.0], ['WC/bad', 5.1], ['Hall', 3.8]],
    farg: { fasad: 'svart', tak: 'svart', detalj: 'svart' },
    oppningar: [
      ['N', 3.66, 0.58, 0, 2.09, 'f', 1], ['N', 5.79, 0.58, 0, 2.09, 'f', 1], ['N', 9.14, 0.58, 0, 2.09, 'f', 1],
      ['S', 1.1, 2.1, 0, 2.1, 'f', 1], ['S', 4.82, 2.39, 0, 2.1, 'sk', 2], ['S', 7.48, 0.8, 0, 2.1, 'f', 1],
      ['E', 3.85, 1.0, 0, 2.1, 'd', 1], ['E', 5.23, 0.58, 0, 2.1, 'f', 1],
      ['W', 4.0, 2.1, 0, 2.1, 'f', 1],
    ],
  },
  'sadel-90': {
    namn: 'Sadel 90', yta: 90, L: 12, W: 7, tak: 'sadel', trappa: 'betong', altan: 'N', snoskydd: true, he: 2.19, hr: 2.19 + 3.5 * Math.tan(22 * Math.PI / 180),
    rum: [['Allrum', 41.1], ['Sovrum', 10.6], ['Sovrum', 7.8], ['Sovrum', 7.1], ['WC/bad', 5.1]],
    farg: { fasad: 'falu', tak: 'rod', detalj: 'falu' },
    oppningar: [
      ['N', 0.28, 1.59, 0, 2.08, 'f', 1], ['N', 3.91, 0.78, 0, 2.08, 'f', 1], ['N', 6.58, 2.39, 0, 2.08, 'sk', 2], ['N', 9.57, 1.62, 0, 2.08, 'f', 1],
      ['S', 0.31, 0.87, 0, 2.1, 'dg', 1], ['S', 5.13, 0.89, 0, 2.1, 'd', 1], ['S', 8.16, 0.58, 0, 2.1, 'f', 1, 'frost'], ['S', 10.83, 0.78, 0, 2.1, 'f', 1],
      ['E', 5.15, 1.58, 0, 2.1, 'f', 1],
      ['W', 3.81, 2.82, 0, 2.1, 'f', 2],
    ],
  },
};

export const FARGER = {
  fasad: {
    svart: ['Svart', '#232220'], falu: ['Falu rödfärg', '#7b2c22'], mossgron: ['Mossgrön', '#3d4a31'],
    grabla: ['Gråblå', '#6c7a88'], gran: ['Grånad gran', '#9b8f80'], ljusgra: ['Ljusgrå', '#c3c0b7'], vit: ['Vit', '#e9e6de'],
  },
  tak: {
    svart: ['Svart', '#252628'], antracit: ['Antracit', '#3c3f43'], gra: ['Grå', '#7f8388'], rod: ['Röd', '#842620'], tegel: ['Tegelröd', '#9a4529'],
  },
  detalj: {
    svart: ['Svart', '#1e1e1d'], vit: ['Vit', '#ecebe6'], gragron: ['Grågrön', '#8d968a'], salvia: ['Salvia', '#a8b399'],
    beige: ['Beige', '#d9cdb5'], falu: ['Röd', '#7b2c22'],
  },
};

export const MODELLER = HUS;

// ---- Texturer som ritas i kod ----------------------------------------
function brus(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
const mjuk = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Lockpanel (underliggare + överliggare): 5 brädor per meter, c/c 200 mm,
// överliggaren 48 mm. Färgkartan är gråskala som multipliceras med fasadfärgen,
// normalkartan ger överliggarnas kanter, skuggfogen och en svag ådring.
function panelTextur(renderer) {
  const PX = 1024, M = 1.0, N = 5, P = PX / N, LK = P * 0.24;
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const g = c.getContext('2d');
  const r = brus(7);
  const ader = (x0, bredd, antal, styrka) => {
    for (let k = 0; k < antal; k++) {
      const xx = x0 + 3 + r() * (bredd - 6), a = styrka * (0.4 + r() * 0.6);
      g.strokeStyle = r() > 0.45 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`;
      g.lineWidth = 0.8 + r() * 2;
      // ådringen går jämnt upp i rutan (helt antal svängar), så att skarven var meter inte syns
      const fas = r() * 9, amp = 1 + r() * 2.5, varv = 1 + Math.floor(r() * 3);
      g.beginPath(); g.moveTo(xx + Math.sin(fas) * amp, 0);
      for (let y = 32; y <= PX; y += 32) g.lineTo(xx + Math.sin(y / PX * Math.PI * 2 * varv + fas) * amp, y);
      g.stroke();
    }
  };
  for (let i = 0; i < N; i++) {
    const x0 = i * P;
    // underliggaren: egen ton per bräda
    const lj = 212 + Math.floor(r() * 26);   // jämnare ton mellan brädorna (målad panel, inte fläckig)
    g.fillStyle = `rgb(${lj},${lj},${lj - 2})`; g.fillRect(x0, 0, P, PX);
    ader(x0 + LK, P - LK, 34, 0.085);
    // kvist ibland
    if (r() > 0.5) {
      const kx = x0 + LK + (P - LK) * (0.25 + r() * 0.5), ky = 24 + r() * (PX - 48);
      const gr = g.createRadialGradient(kx, ky, 0, kx, ky, 8);
      gr.addColorStop(0, 'rgba(50,38,26,.14)'); gr.addColorStop(1, 'rgba(50,38,26,0)');   // kvisten skymtar genom färgen
      g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 6, 10, 0, 0, 7); g.fill();
    }
    // mjuk skugga på brädan intill överliggarna
    let gl = g.createLinearGradient(x0 + LK, 0, x0 + LK + 22, 0);
    gl.addColorStop(0, 'rgba(0,0,0,.34)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.fillRect(x0 + LK, 0, 22, PX);
    gl = g.createLinearGradient(x0 + P - 16, 0, x0 + P, 0);
    gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = gl; g.fillRect(x0 + P - 16, 0, 16, PX);
    // överliggaren
    const lb = 214 + Math.floor(r() * 34);
    g.fillStyle = `rgb(${lb},${lb},${lb - 2})`; g.fillRect(x0, 0, LK, PX);
    ader(x0, LK, 10, 0.075);
    // spikhuvuden i läkten, två rader per meter (mot spikreglarna): en liten mörk prick som
    // färgen sjunkit in i, med en svag rinnrand under
    for (const ny of [0.27, 0.77]) {
      const sx = x0 + LK * (0.42 + r() * 0.16), sy = PX * ny + (r() - 0.5) * 8;
      g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(sx - 1, sy, 2, 26 + r() * 30);
      g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.arc(sx, sy, 2.3, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(sx, sy + 2.6, 1.6, 0, 7); g.fill();
    }
    // kanterna som mjuka ramper (minst 6 px), aldrig smalare än ett par pixlar i bild
    // (ljuskanten hålls svag: en stark vit kant fick panelen att se ut som profilerad plåt)
    gl = g.createLinearGradient(x0, 0, x0 + 7, 0); gl.addColorStop(0, 'rgba(255,255,255,.1)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(x0, 0, 7, PX);
    gl = g.createLinearGradient(x0 + LK - 7, 0, x0 + LK, 0); gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = gl; g.fillRect(x0 + LK - 7, 0, 7, PX);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / M, 1 / M);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // normalkarta i halv upplösning, räknad ur en höjdprofil
  const NP = 512, S = PX / NP;
  const hojd = new Float32Array(NP * NP);
  // svag ådring i höjdled, utjämnad över flera texlar: brus per texel gav moaré på avstånd
  const kol = new Float32Array(NP), raa = new Float32Array(NP);
  for (let x = 0; x < NP; x++) raa[x] = r();
  for (let x = 0; x < NP; x++) { let sm = 0; for (let j = -3; j <= 3; j++) sm += raa[(x + j + NP) % NP]; kol[x] = sm / 7; }
  for (let y = 0; y < NP; y++) {
    for (let x = 0; x < NP; x++) {
      const X = (x + 0.5) * S, lok = X % P;
      let h;
      // mjukare kanter (fler texlar) så att normalkartan inte får högfrekventa kanter
      if (lok < LK) { const e = Math.min(lok, LK - lok); h = 1.6 + 2.4 * mjuk(0, 14, e); }
      else { const e = Math.min(lok - LK, P - lok); h = 0.6 * mjuk(0, 10, e); }
      // finsågad yta: fibrerna står upp lite (0,3; med 0,16 var träet slätt som plåt på nära håll)
      h += 0.3 * kol[x] * (0.75 + 0.25 * Math.sin(y / NP * Math.PI * 2 * 4 + x * 0.05));
      hojd[y * NP + x] = h;
    }
  }
  const n = document.createElement('canvas'); n.width = n.height = NP;
  const ng = n.getContext('2d'); const bild = ng.createImageData(NP, NP); const d = bild.data;
  const K = 0.7;
  for (let y = 0; y < NP; y++) {
    for (let x = 0; x < NP; x++) {
      const hx = hojd[y * NP + (x + 1) % NP] - hojd[y * NP + (x + NP - 1) % NP];
      const hy = hojd[((y + 1) % NP) * NP + x] - hojd[((y + NP - 1) % NP) * NP + x];
      let nx = -hx * K, ny = hy * K, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * NP + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ng.putImageData(bild, 0, 0);
  const nt = new THREE.CanvasTexture(n);
  nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(1 / M, 1 / M);
  nt.colorSpace = THREE.NoColorSpace; nt.anisotropy = t.anisotropy;
  [t, nt].forEach(x => { x.generateMipmaps = true; x.minFilter = THREE.LinearMipmapLinearFilter; x.magFilter = THREE.LinearFilter; });
  return { karta: t, normal: nt };
}

// Altanväxternas atlas, 4×2 rutor à 256 px: 0 gräs, 1 gräs med vippor, 2 olivkrona,
// 3 lavendel, 4 gran/tall med snö, 5 pelargon. Ritas en gång.
function vaxtAtlas(renderer) {
  const C = 256, c = document.createElement('canvas'); c.width = C * 4; c.height = C * 2;
  const g = c.getContext('2d'), r = brus(91);
  const blad = (x0, y0, x1, y1, cx, cy, bredd, farg) => {
    g.strokeStyle = farg; g.lineWidth = bredd; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (a, al = 1) => 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')';
  const ruta = (i, fn) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); g.beginPath(); g.rect(4, 4, C - 8, C - 8); g.clip(); fn(); g.restore(); };
  const gras = vippor => () => {
    for (let i = 0; i < 170; i++) {
      const t = r(), x0 = 128 + (r() - 0.5) * 36, h = 120 + r() * 125, lut = (r() - 0.5) * 2;
      const x1 = x0 + lut * (40 + r() * 90), y1 = 252 - h * (0.75 + 0.25 * (1 - Math.abs(lut)));
      const f = mix([70, 96, 48], [178, 166, 112], Math.pow(t, 1.6) * (vippor ? 0.9 : 0.5));
      blad(x0, 254, x1, y1, x0 + lut * 10, 252 - h * 0.7, 1 + r() * 1.6, rgb(f));
    }
    if (vippor) for (let i = 0; i < 26; i++) {
      const x = 128 + (r() - 0.5) * 150, y = 20 + r() * 70, lut = (r() - 0.5) * 0.8;
      blad(128 + (r() - 0.5) * 20, 250, x, y + 30, (x + 128) / 2, y + 60, 1, 'rgba(150,140,100,.9)');
      for (let k = 0; k < 40; k++) { const q = k / 40; g.fillStyle = rgb(mix([200, 186, 150], [230, 212, 170], r()), 0.8); g.fillRect(x + lut * q * 30 + (r() - 0.5) * 7, y + 30 - q * 34, 1.6, 1.6); }
    }
  };
  ruta(0, gras(false)); ruta(1, gras(true));
  ruta(2, () => {
    // lös olivkrona: tunna kvistar och smala silvergröna blad
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6, l = 50 + r() * 60, x1 = 128 + Math.cos(a) * l, y1 = 150 + Math.sin(a) * l;
      blad(128, 200, x1, y1, 128 + Math.cos(a) * l * 0.4, 175, 1.6, 'rgba(92,80,62,1)');
      for (let k = 0; k < 34; k++) {
        const q = r(), x = 128 + (x1 - 128) * q + (r() - 0.5) * 34, y = 200 + (y1 - 200) * q + (r() - 0.5) * 34, v = r() * 6.28;
        g.fillStyle = rgb(mix([86, 100, 72], [168, 178, 150], r())); g.beginPath(); g.ellipse(x, y, 1.6, 6 + r() * 3, v, 0, 7); g.fill();
      }
    }
  });
  ruta(3, () => {
    // lavendel: grågröna smala blad nertill, stjälkar med lila ax
    for (let i = 0; i < 70; i++) { const x0 = 128 + (r() - 0.5) * 60, lut = (r() - 0.5) * 1.6; blad(x0, 254, x0 + lut * 50, 200 - r() * 40, x0 + lut * 10, 225, 2, rgb(mix([88, 104, 84], [140, 152, 128], r()))); }
    for (let i = 0; i < 55; i++) {
      const x0 = 128 + (r() - 0.5) * 50, lut = (r() - 0.5) * 1.5, x1 = x0 + lut * 70, y1 = 30 + r() * 80;
      blad(x0, 250, x1, y1, x0 + lut * 20, 150, 1.2, 'rgba(104,118,86,1)');
      for (let k = 0; k < 14; k++) { const q = k / 14; g.fillStyle = rgb(mix([96, 78, 150], [160, 140, 200], r())); g.beginPath(); g.ellipse(x1 - lut * q * 8, y1 + q * 34, 3, 2.2, 0, 0, 7); g.fill(); }
    }
  });
  ruta(4, () => {
    // gran- och tallris med snö ovanpå
    for (let i = 0; i < 9; i++) {
      const x0 = 128 + (r() - 0.5) * 40, a = -Math.PI / 2 + (r() - 0.5) * 1.5, l = 120 + r() * 100, x1 = x0 + Math.cos(a) * l, y1 = 252 + Math.sin(a) * l;
      blad(x0, 254, x1, y1, (x0 + x1) / 2, (254 + y1) / 2, 2.4, 'rgba(78,60,44,1)');
      for (let k = 0; k < 90; k++) {
        const q = 0.15 + r() * 0.85, x = x0 + (x1 - x0) * q, y = 254 + (y1 - 254) * q, sid = r() > 0.5 ? 1 : -1, nl = 7 + r() * 9;
        g.strokeStyle = rgb(mix([28, 54, 36], [62, 92, 58], r())); g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + sid * nl * 0.8 + Math.cos(a) * nl * 0.5, y - nl * 0.5 + Math.sin(a) * nl * 0.3); g.stroke();
      }
      for (let k = 0; k < 7; k++) { const q = 0.3 + r() * 0.7, x = x0 + (x1 - x0) * q, y = 254 + (y1 - 254) * q - 5; g.fillStyle = 'rgba(246,248,252,.95)'; g.beginPath(); g.ellipse(x, y, 7 + r() * 8, 3 + r() * 2.5, a + Math.PI / 2, 0, 7); g.fill(); }
    }
  });
  ruta(5, () => {
    // pelargon: runda blad med mörkare zon och klasar av röda och rosa blommor
    for (let i = 0; i < 46; i++) {
      const x = 128 + (r() - 0.5) * 170, y = 140 + r() * 105, rr = 12 + r() * 10;
      g.fillStyle = rgb(mix([58, 92, 46], [104, 140, 70], r())); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,52,30,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, rr * 0.55, 0, 7); g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = 128 + (r() - 0.5) * 160, y = 60 + r() * 90, f = r() > 0.5 ? [196, 58, 62] : [222, 112, 140];
      blad(x, y + 10, x + (r() - 0.5) * 20, y + 70, x, y + 40, 1.4, 'rgba(80,110,56,1)');
      for (let k = 0; k < 26; k++) { g.fillStyle = rgb(mix(f, [255, 220, 220], r() * 0.3)); g.beginPath(); g.arc(x + (r() - 0.5) * 22, y + (r() - 0.5) * 18, 2.6 + r() * 1.6, 0, 7); g.fill(); }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// Snö i däckets springor och ett tunt puder, 1 m per ruta (samma rader som däcket: 8 per meter)
function snoTextur() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = brus(13);
  const gra = v => { v = v | 0; return 'rgb(' + v + ',' + v + ',' + v + ')'; };
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { g.fillStyle = gra(40 + r() * 90); g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 8; i++) {
    const y = (i + 1) * 32 - 2.5;
    for (let x = 0; x < N; x += 4) { g.fillStyle = gra(r() > 0.15 ? 200 + r() * 55 : 60); g.fillRect(x, y - 2 - r() * 2, 4, 4 + r() * 3); }
  }
  for (let i = 0; i < 10; i++) {
    const x = r() * N, y = r() * N, rr = 14 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Svag variation i ytans råhet (grön kanal), lågfrekvent så att den inte flimrar
function rahetTextur(renderer, styrka = 0.35) {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); const r = brus(61);
  g.fillStyle = 'rgb(232,232,232)'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 70; i++) {
    const x = r() * N, y = r() * N, rr = 8 + r() * 26, v = r() > 0.5 ? 255 : 190;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr);
      gr.addColorStop(0, `rgba(${v},${v},${v},${styrka})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// Gjuten betong till sockeln: grå med porer och svaga fläckar
function betongTextur() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const r = brus(23);
  g.fillStyle = '#bdbab4'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 256, rr = 10 + r() * 40, v = r() > 0.5 ? 0 : 255;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(${v},${v},${v},.07)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // gjutskarv (formens fog) och en mörkare, fuktig rand nedtill mot marken
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(126, 0, 2, 256); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(128, 0, 2, 256);
  { const gr = g.createLinearGradient(0, 256, 0, 170); gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 170, 256, 86); }
  for (let i = 0; i < 2600; i++) { const v = r() > 0.5 ? 60 : 235; g.fillStyle = `rgba(${v},${v},${v},${0.1 + r() * 0.25})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Himlen som speglas i glas och plåt: en mjuk gradient med trädrand vid horisonten
const HIMMEL = {
  studio: { top: '#b7c4d2', hor: '#f0ede7', mark: '#bdb7ad' },
  tradgard: { top: '#7da2cc', hor: '#e5eaee', mark: '#5a6839', band: '#3a4729', bandH: 0.13 },
  skog: { top: '#7b9bc2', hor: '#dde4e7', mark: '#3e4930', band: '#25321e', bandH: 0.28 },
  vinter: { top: '#9db4cc', hor: '#eef1f4', mark: '#e9edf2', band: '#3a4943', bandH: 0.2 },
};

// ---- Scenen -----------------------------------------------------------
// Ger ett löfte: scenen byggs i steg med en paus mellan de tunga delarna (miljön, texturerna,
// huset), så att sidan hinner rita och svara under tiden. Svaret är motorns gränssnitt;
// dess redo (ett löfte) blir klart när programmen är kompilerade och första bilden är ritad.
export async function skapaRitare(duk, alternativ = {}) {
  // stencil: fasaden märker sina pixlar så att inredningen aldrig ritas över den (se mat.fasad)
  const renderer = new THREE.WebGLRenderer({ canvas: duk, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: true });
  // foto: true (sidans ?foto=1) ger skarpaste bilden: pixeltäthet 1,5, inget intro, ingen snurr, inget liv
  const FOTO = !!alternativ.foto;
  // skärmens egen pixeltäthet upp till 2 (taket 1,25 gav suddig bild och trappiga linjer på täta skärmar)
  const SKARP = FOTO ? 1.5 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(SKARP);
  // en paus som släpper fram en ritad ruta (i en dold flik: högst 80 ms); fotoläget väntar inte
  const paus = FOTO ? () => Promise.resolve() : () => new Promise(r => {
    let k = false; const f = () => { if (!k) { k = true; r(); } };
    requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 80);
  });
  // mätmärkena går också till sidan (alternativ.vidLaddning), som visar laddningens förlopp
  const marke = n => { try { performance.mark(n); } catch (e) { /* utan mätning */ } if (typeof alternativ.vidLaddning === 'function') { try { alternativ.vidLaddning(n); } catch (e) { console.warn(e); } } };
  // Mjuka skuggor, men skuggkartan räknas bara om när något ändras
  // (huset byggs, solen flyttas). Att vrida kameran kostar då inget extra.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let nySkugga = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const EXPO = 1.12;
  renderer.toneMappingExposure = EXPO;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // räknarna nollas en gång per ruta (i ram), så att ?prestanda=1 visar hela rutan
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = {};
  function himmelEnv(namn) {
    if (envCache[namn]) return envCache[namn];
    const d = HIMMEL[namn] || HIMMEL.studio;
    const geo = new THREE.SphereGeometry(10, 64, 32);
    const pos = geo.attributes.position, f = new Float32Array(pos.count * 3);
    const top = new THREE.Color(d.top), hor = new THREE.Color(d.hor), mk = new THREE.Color(d.mark), band = d.band ? new THREE.Color(d.band) : null, c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i) / 10, az = Math.atan2(pos.getZ(i), pos.getX(i));
      if (yy < 0) c.copy(hor).lerp(mk, Math.min(1, -yy * 7));
      else {
        c.copy(hor).lerp(top, Math.pow(yy, 0.55));
        if (band) {
          const hb = d.bandH * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin(az * 7 + 0.4)) * (0.6 + 0.4 * Math.sin(az * 19 + 1.3)));
          if (yy < hb) c.copy(band).lerp(hor, (yy / hb) * 0.3);
        }
      }
      f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    const s = new THREE.Scene(); s.add(new THREE.Mesh(geo, m));
    const rt = pmrem.fromScene(s, 0.03);
    geo.dispose(); m.dispose();
    return (envCache[namn] = rt.texture);
  }
  marke('rit-motor');
  await paus();
  scene.environment = himmelEnv('studio');
  scene.environmentIntensity = 0.9;

  const kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  kamera.position.set(13, 6, 15);

  // Tung, mjuk känsla: lång glidning efter ett svep, lugn rotation
  const styr = new OrbitControls(kamera, duk);
  styr.enableDamping = true; styr.dampingFactor = 0.05;
  styr.rotateSpeed = 0.7; styr.zoomSpeed = 0.6;
  styr.minDistance = 7; styr.maxDistance = 42;
  styr.maxPolarAngle = Math.PI * 0.485; styr.minPolarAngle = 0.12;
  styr.enablePan = false;
  styr.autoRotate = !FOTO && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // fotovinkeln hjalte står i ögonhöjd: kameran får gå ned till horisonten
  if (FOTO) styr.maxPolarAngle = Math.PI * 0.5;
  styr.autoRotateSpeed = 0.55;
  // snurrar bara en kort stund i början, sedan står den still och ritar bara när något ändras
  styr.target.set(0, 1.6, 0);
  // husets mittpunkt: zoom mot pekaren får flytta målet en bit, utzoomning glider tillbaka hit
  const hem = new THREE.Vector3(0, 1.6, 0);
  let hemR = 3, hemTopp = 4;
  // Dämpningen per sekund i stället för per ruta: samma glid vid 30 och 60 bilder/s
  const DEMP_UTE = 0.055, DEMP_INNE = 0.085;
  // OrbitControls kör update() i varje pekarhändelse (och läser clientHeight varje gång).
  // Här begär händelserna bara en ruta; update körs en gång per ruta i ram().
  // styrNu() gör en direkt uppdatering när koden själv flyttar kameran.
  const styrUpdate = styr.update.bind(styr);
  let styrIRam = false;
  styr.update = dt => { if (styrIRam) return styrUpdate(dt); begarRender(); return false; };
  const styrNu = () => styrUpdate();
  // höjden läses ur cachen som storlek() fyller, aldrig ur layouten under ett drag
  Object.defineProperty(duk, 'clientHeight', { configurable: true, get: () => dukH });

  // ljus
  // Inne: tre fasta ljus som skapas här med styrka 0, så att antalet ljus aldrig ändras
  // och inget kompileras om. Varmvitt (ca 2900 K), inte orange. Huvudljuset står vid
  // rummets taklampa, spotten lyser ned från pendeln och det tredje sitter i en
  // sänglampa eller golvlampa (se rumsLjus).
  const inneLjus = new THREE.PointLight(0xffe7d2, 0, 9, 2);
  const inneLjus2 = new THREE.PointLight(0xffe4cc, 0, 4, 2);
  const inneSpot = new THREE.SpotLight(0xffead6, 0, 5, 0.8, 0.85, 2);
  // det fjärde fasta ljuset: rummets näst närmaste tända lampa (bordslampa, golvlampa)
  const inneLjus3 = new THREE.PointLight(0xffd2a4, 0, 4.5, 2);
  const himmel = new THREE.HemisphereLight(0xcfdcea, 0x6a604f, 0.42);
  scene.add(himmel, inneLjus, inneLjus2, inneLjus3, inneSpot, inneSpot.target);
  // lampornas färg: neutralt varmvitt på dagen, 2700 K på kvällen (glödlampsvarmt, inte orange)
  const LJ_DAG = new THREE.Color(0xffe7d2), LJ_2700 = new THREE.Color(0xffc58e), SPOT_DAG = new THREE.Color(0xffead6), SPOT_2700 = new THREE.Color(0xffcb98), LJ2_2700 = new THREE.Color(0xffb979);
  const sol = new THREE.DirectionalLight(0xfff1e0, 3.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sk = sol.shadow.camera; sk.left = -14; sk.right = 14; sk.top = 14; sk.bottom = -14; sk.near = 1; sk.far = 80;
  sol.shadow.bias = -0.00025; sol.shadow.normalBias = 0.035;   // takets båda sidor kastar skugga: lite mer normalBias mot acne
  scene.add(sol, sol.target);
  const SOL_DAG = new THREE.Color(0xfff2e2), SOL_LAG = new THREE.Color(0xffb26a), SOL_KVALL = new THREE.Color(0xff8c55), MANE = new THREE.Color(0x9fb4d6);
  const manePos = new THREE.Vector3();
  const HIM_DAG = new THREE.Color(0xcfdcea), HIM_KVALL = new THREE.Color(0x56607e), HIM_MARK = new THREE.Color(0x6a604f), HIM_INNE = new THREE.Color(0xdcc5a6), HIM_GYLLEN = new THREE.Color(0xf4cfa6), STUDS = new THREE.Color(0xd9bf9c), NATT_GOLV = new THREE.Color(0x5a4c3e);

  marke('rit-himmel');
  await paus();
  const omgivning = skapaMiljo(THREE, scene, renderer);
  marke('rit-miljo');
  await paus();
  scene.background = new THREE.Color('#ece7df');
  scene.fog = new THREE.Fog(scene.background, 34, 90);
  let morktTema = false;
  const RUMSLJUS = new THREE.Color(0x8c7b68), RUM_DAG = new THREE.Color(0x4a433b);
  let miljoNamn = 'studio';
  const GAMLA_NAMN = { gras: 'tradgard', sno: 'vinter' };

  // Kontaktskugga: en mjuk mörk rand tätt runt sockeln, ritad efter husets mått.
  // Hålls svag; miljön kan lägga sin egen ring utanpå.
  const flack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  flack.rotation.x = -Math.PI / 2; flack.position.y = 0.004; flack.renderOrder = 1; scene.add(flack);
  function satFlack(L, W) {
    const M = 0.85, PPM = 24, bw = L + 2 * M, bh = W + 2 * M;
    const cw = Math.ceil(bw * PPM), ch = Math.ceil(bh * PPM);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d'); const b = x.createImageData(cw, ch); const d = b.data;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const dx = Math.max(Math.abs((i + 0.5) / PPM - bw / 2) - L / 2, 0), dz = Math.max(Math.abs((j + 0.5) / PPM - bh / 2) - W / 2, 0);
        const t = 1 - Math.min(1, Math.hypot(dx, dz) / M);
        const k = (j * cw + i) * 4;
        d[k] = 24; d[k + 1] = 20; d[k + 2] = 14; d[k + 3] = 255 * Math.pow(t, 2.4);
      }
    }
    x.putImageData(b, 0, 0);
    const gam = flack.material.map;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    flack.material.map = t; flack.material.needsUpdate = true;
    if (gam) gam.dispose();
    flack.scale.set(bw, bh, 1);
  }

  await paus();
  const panel = panelTextur(renderer);
  // kvällsskenet i rummen: ljusast mitt på varje yta, mörkare mot hörnen
  function rumSken() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 26, 2, 32, 32, 46);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#9a9a9a'); gr.addColorStop(1, '#303030');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // material som byter färg
  const glasSpeg = { value: 3.5 }, glasFres = { value: 0.94 }, glasEnv = { value: 1 };
  const rahet = rahetTextur(renderer);
  // fasaden: svagare fläckar i råheten (målad panel; med 0,35 blev det mörka fläckar i släpljus)
  const rahetFasad = rahetTextur(renderer, 0.14);
  const mat = {
    fasad: new THREE.MeshStandardMaterial({ map: panel.karta, normalMap: panel.normal, normalScale: new THREE.Vector2(0.75, 0.75), roughnessMap: rahetFasad, roughness: 0.9, metalness: 0 }),
    // lackad plåt: lite mattare (0,64) så att solsidan inte bleks till rosa/grått uppifrån mitt på dagen
    tak: new THREE.MeshStandardMaterial({ roughnessMap: rahet, roughness: 0.64, metalness: 0.28 }),
    falsar: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.4 }),
    detalj: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04 }),
    // stuprören: samma plåt och färg som taket (som rännan) men eget material, så att de kan döljas när taket lyfts
    stupror: new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.38 }),
    detaljMork: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.15 }),
    glas: new THREE.MeshStandardMaterial({ color: 0x172028, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0xffb15e, emissiveIntensity: 0 }),
    // frostat (matt) glas i badrumsfönster: släpper ljus men man ser inte in
    frostGlas: new THREE.MeshStandardMaterial({ color: 0xdfe3e1, roughness: 0.55, metalness: 0, transparent: true, opacity: 0.96, depthWrite: false }),
    // rummet bakom glaset: en låda som bara syns inifrån, så att man ser djup genom fönstren
    rum: new THREE.MeshStandardMaterial({ color: 0x4a433b, roughness: 0.95, side: THREE.BackSide, emissive: 0xffa95a, emissiveMap: rumSken(), emissiveIntensity: 0, envMapIntensity: 0.45 }),
    // sockeln: ljusare gjuten betong, så att den läses som betong och inte som mörk plast
    sockel: new THREE.MeshStandardMaterial({ color: 0x8e8a83, map: betongTextur(), roughnessMap: rahet, roughness: 1, envMapIntensity: 0.6 }),
    handtag: new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.28, metalness: 0.9 }),
    insida: new THREE.MeshStandardMaterial({ color: 0xe7e2d8, roughness: 0.9 }),
    // fönsterbågarnas vitmålade insida (eget material: insida göms när man är inne)
    bagInsida: new THREE.MeshStandardMaterial({ color: 0xeeebe4, roughness: 0.6 }),
    // bågarnas yttre skikt och glasdörrens lister: detaljfärgen utifrån, ljusa när man står inne
    // (annars lyser utsidans färg som en tunn linje runt glaset inifrån)
    bagYtter: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04 }),
    // ytterdetaljer: trappor, dörrmatta, vägglampa, skuggränder
    // trappsteg och altanens sarg: ådring längs brädan (lådornas u går längs långsidan), 128×32 px
    tra: new THREE.MeshStandardMaterial({ color: 0xa3927b, roughness: 0.78, map: (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'), r = brus(53);
      g.fillStyle = '#e6e2da'; g.fillRect(0, 0, 128, 32);
      for (let i = 0; i < 46; i++) {
        const y = r() * 32, v = r() > 0.5 ? 0 : 255;
        g.strokeStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.1})`; g.lineWidth = 0.5 + r() * 1.2;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + (r() - 0.5) * 3, 88, y + (r() - 0.5) * 3, 128, y); g.stroke();
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
    })() }),
    betong: new THREE.MeshStandardMaterial({ color: 0xa9a59d, map: (() => { const t = betongTextur(); t.repeat.set(1.4, 1.4); return t; })(), roughness: 0.92 }),
    matta: new THREE.MeshStandardMaterial({ color: 0x4a3f33, roughness: 1 }),
    lampGlas: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.35, emissive: 0xffc27a, emissiveIntensity: 0 }),
    takMork: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
    // altanen: grå, väderbitna brädor med springor (1 m per rutan)
    altan: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, map: (() => {
      const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const r = brus(41);
      const N = 8, B = 512 / N;
      for (let i = 0; i < N; i++) {
        let x = 0;
        while (x < 512) {
          const len = 140 + r() * 300, t = r();
          const R = 132 + t * 26, G = 124 + t * 22, Bl = 112 + t * 18;
          g.fillStyle = `rgb(${R | 0},${G | 0},${Bl | 0})`; g.fillRect(x, i * B, len, B);
          for (let k = 0; k < 14; k++) {
            const yy = i * B + 3 + r() * (B - 6); g.strokeStyle = r() > 0.5 ? 'rgba(40,34,28,.16)' : 'rgba(255,250,240,.12)';
            g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 4, x + len * 0.7, yy + (r() - 0.5) * 4, x + len, yy); g.stroke();
          }
          // ändträet vid skarven: brädändarna har tagit upp mer väta och är mörkare, med en sprickad ände
          { const ge = g.createLinearGradient(x + len - 12, 0, x + len, 0); ge.addColorStop(0, 'rgba(40,32,24,0)'); ge.addColorStop(1, 'rgba(40,32,24,.28)'); g.fillStyle = ge; g.fillRect(x + len - 12, i * B, 12, B); }
          if (r() > 0.6) { g.strokeStyle = 'rgba(30,24,18,.35)'; g.lineWidth = 0.8; const sy = i * B + B * (0.3 + r() * 0.4); g.beginPath(); g.moveTo(x + len, sy); g.lineTo(x + len - 10 - r() * 14, sy + (r() - 0.5) * 2); g.stroke(); }
          g.fillStyle = 'rgba(30,26,22,.85)'; g.fillRect(x + len - 2, i * B, 2, B);   // skarv
          g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x + len * 0.08, i * B + B * 0.2, 2, 2); g.fillRect(x + len * 0.08, i * B + B * 0.72, 2, 2);   // skruvar
          x += len;
        }
        g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, i * B, 512, 2);
        g.fillStyle = '#1f1b17'; g.fillRect(0, (i + 1) * B - 5, 512, 5);   // springan
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    })() }),
    mobel: new THREE.MeshStandardMaterial({ color: 0x8a6c4e, roughness: 0.62 }),
    dyna: new THREE.MeshStandardMaterial({ color: 0xb8af9f, roughness: 0.97, side: THREE.DoubleSide }),
    kruka: new THREE.MeshStandardMaterial({ color: 0x45433f, roughness: 0.7, metalness: 0.1 }),
    // altanens växter: en målad atlas (gräs, gräs med vippor, oliv, lavendel, gran med snö,
    // pelargon); hörnfärgerna ger mörkare inre delar
    vaxt: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, map: vaxtAtlas(renderer) }),
    // dynor, plädar, fårskinn, mattor, krukor och snöhuvor: vit grund, färgen i hörnen
    textil: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
    // tunt snölager på däcket: snö i springorna och lite puder (alfakarta, 1 m per ruta)
    snoLager: new THREE.MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.9, transparent: true, depthWrite: false, alphaMap: snoTextur(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    // mjuk kontaktskugga under krukor och möbler (en bild, inga ljus)
    flackM: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, alphaMap: (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, '#bbb'); gr.addColorStop(0.5, '#555'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })() }),
    pol: new THREE.MeshBasicMaterial({ color: 0xffb470, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false, toneMapped: false, map: (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#7a7a7a'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })() }),
    // takets undersida (takfoten): syns alltid utifrån, även när inredningen visas
    takUnder: new THREE.MeshStandardMaterial({ color: 0xe7e2d8, roughness: 0.9 }),
    // kvällsljus utan riktiga lampor: varma ytor på marken och på väggen (additiva)
    spill: new THREE.MeshBasicMaterial({ color: 0xffb468, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false, toneMapped: false, map: (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), d = g.createImageData(64, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
        const v = y / 127, sx = Math.abs(x / 63 - 0.5) * 2, bredd = 0.55 + v * 0.45;
        const a = Math.pow(1 - v, 1.6) * (1 - mjuk(bredd * 0.3, bredd, sx)) * mjuk(0, 0.15, v);   // mjuka sidor (inga skarpa rektanglar)
        const i = (y * 64 + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255 * a; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })() }),
    lampKon: new THREE.MeshBasicMaterial({ color: 0xffbf80, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false, toneMapped: false, map: (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), d = g.createImageData(64, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
        // överst sitter lampan; konen vidgas nedåt och har en ljus fläck under armaturen
        const v = y / 127, sx = Math.abs(x / 63 - 0.5) * 2, w = 0.12 + v * 0.95;
        const kon = (1 - mjuk(w * 0.45, w, sx)) * Math.pow(1 - v, 1.3) * mjuk(0.0, 0.08, v);
        const prick = Math.exp(-((sx * 3) ** 2 + ((v - 0.1) * 7) ** 2)) * 0.6;
        const a = Math.min(1, kon + prick), i = (y * 64 + x) * 4;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255 * a; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })() }),
    skuggrand: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, alphaMap: (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#4a4a4a'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c);
    })() }),
  };
  // skuggranden: tätast i överkant (under takfoten), tonar ut nedåt
  mat.skuggrand.opacity = 0.5;
  // stående falsar fångar ljuset: blankare och ljusare än plåten under
  mat.falsar.roughness = 0.3; mat.falsar.metalness = 0.55;
  mat.fasad.side = THREE.FrontSide;
  // väggarna är tunna ytor: båda sidorna måste kasta skugga, annars lyser solen
  // rakt igenom den vägg som vetter mot den (och in i rummen)
  mat.fasad.shadowSide = THREE.DoubleSide;
  // Fasaden märker stencilen (1) där den ritas, och inredningen ritas bara där märket saknas
  // (fönsterhålen, snittet i dockskåpet, inifrån där fasaden vänder ryggen till). Utan detta
  // vann små möbelytor som syns precis i kant (vy öst/väst rakt längs mellanväggarna) ibland
  // djuptestet mot fasaden i mjukvarurendering: ljusa prickar och en strimma mitt i gaveln.
  // Fasaden ritas först bland de ogenomskinliga (renderOrder -1, satt i byggHus).
  mat.fasad.stencilWrite = true; mat.fasad.stencilRef = 1;
  mat.fasad.stencilFunc = THREE.AlwaysStencilFunc; mat.fasad.stencilZPass = THREE.ReplaceStencilOp;
  // Panelens ruta upprepas var meter. Här får varje bräda över hela väggen en egen ton, och
  // var fjärde underbräda en skarv (mörk fog, 3 mm) på egen höjd. Räknas ur väggens uv
  // (meter, 5 brädor per meter): ingen ny textur och inget ritanrop.
  mat.fasad.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  {
    float pBi = floor(vMapUv.x * 5.0), pLok = fract(vMapUv.x * 5.0);
    float pH = fract(sin(pBi * 12.9898) * 43758.5453), pH2 = fract(sin(pBi * 78.233 + 2.1) * 24634.6345);
    // läkten (första 24 %) har egen ton, skild från brädan under
    float pTon = pLok < 0.24 ? pH2 : pH;
    diffuseColor.rgb *= 0.93 + 0.12 * pTon;
    if (pH2 > 0.74 && pLok > 0.26) {
      float pSy = 0.7 + pH * 1.5, pD = abs(vMapUv.y - pSy);
      diffuseColor.rgb *= 1.0 - 0.6 * (1.0 - smoothstep(0.0012, 0.0045, pD));
      // brädan ovanför skarven har annan ton än den under
      diffuseColor.rgb *= vMapUv.y > pSy ? 1.035 : 0.975;
    }
  }`);
  };
  mat.fasad.customProgramCacheKey = () => 'fasad-brador';
  // Kupans östvägg (gaveltriangeln ovanför huvudtaket) är den enda fasadytan vars utsida
  // vetter in mot rummen: inifrån, snett uppåt mot innertaket, ligger den bakom innertaket men
  // framför kameran. Med stencilmärket ritades den först och innertaket hoppades över där:
  // en grön triangel genom taket. Samma panel och färg, men inget märke och vanlig ordning,
  // så djuptestet avgör. (Inga möbler står där uppe, så strimfelet som märket löste uppstår inte.)
  mat.fasadKupa = mat.fasad.clone();
  mat.fasadKupa.stencilWrite = false; mat.fasadKupa.stencilFunc = THREE.AlwaysStencilFunc;
  mat.fasadKupa.onBeforeCompile = mat.fasad.onBeforeCompile; mat.fasadKupa.customProgramCacheKey = mat.fasad.customProgramCacheKey;
  // taket har ingen undersida i skuggpasset (takUnder kastar inte skugga): med enkelsidig
  // skugga ritades bara baksidorna, och solen lyste igenom takutsprånget (ljusa streck i
  // husets skugga, solljus i rummen). Båda sidorna kastar skugga.
  mat.tak.shadowSide = THREE.DoubleSide; mat.falsar.shadowSide = THREE.DoubleSide; mat.detalj.shadowSide = THREE.DoubleSide; mat.stupror.shadowSide = THREE.DoubleSide;
  // Glaset: reflektionen läggs ovanpå (förmultiplicerad blandning) och glaset blir
  // tätare i flack vinkel (fresnel). Rakt framifrån syns rummet bakom.
  mat.glas.blending = THREE.CustomBlending;
  mat.glas.blendSrc = THREE.OneFactor; mat.glas.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.glas.onBeforeCompile = s => {
    s.uniforms.glasSpeg = glasSpeg; s.uniforms.glasFres = glasFres; s.uniforms.glasEnv = glasEnv;
    s.fragmentShader = 'uniform float glasSpeg;\nuniform float glasFres;\nuniform float glasEnv;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `
      float glasF = pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 2.6);
      float glasA = mix(diffuseColor.a, glasFres, glasF);
      vec3 glasRefl = (reflectedLight.indirectSpecular * glasEnv + reflectedLight.directSpecular) * mix(glasSpeg, 1.0, glasF);
      vec3 glasKropp = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * glasA + totalEmissiveRadiance;
      gl_FragColor = vec4(glasKropp + glasRefl, glasA);`);
  };
  mat.glas.customProgramCacheKey = () => 'glas-fresnel';
  // Vinter: snö på taket, foder, bleck och fönsterbänkar. Ytor som vetter uppåt blir vita med
  // ett brusigt kant (normal.y × brus), bara en uniform: inga nya ritanrop och ingen ny shader
  // när miljön byts.
  const snoU = { value: 0 };
  const SNO_GLSL = `uniform float uSno;
varying vec3 vSnoP;
float snoHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snoBrus(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(snoHash(i), snoHash(i + vec2(1.0, 0.0)), f.x), mix(snoHash(i + vec2(0.0, 1.0)), snoHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
  function snoPa(m, styrka) {
    const f = m.onBeforeCompile, k = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      if (f) f.call(m, sh, r);
      sh.uniforms.uSno = snoU;
      sh.vertexShader = 'varying vec3 vSnoP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vSnoP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = SNO_GLSL + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uSno > 0.0) {
    // snön ligger efter ytans riktiga lutning: med normalkartans falsar stack varje fals upp
    // som ett färgat streck genom snötäcket (vitt tak med kritstreck). Lite av kartan är kvar,
    // så att falsarna anas som mjuka åsar; snöytan själv är slät och svagt flammig (drivor).
    vec3 snoN = inverseTransformDirection(normalize(mix(normal, nonPerturbedNormal, 0.75)), viewMatrix);
    float snoB = snoBrus(vSnoP.xz * 3.1 + vSnoP.y) * 0.6 + snoBrus(vSnoP.zx * 11.0) * 0.4;
    float snoK = smoothstep(0.45, 0.8, snoN.y + (snoB - 0.5) * 0.45) * uSno * ${styrka.toFixed(2)};
    normal = normalize(mix(normal, nonPerturbedNormal, snoK * 0.62));
    // något under helvitt, annars brändes ett flackt tak ut till ett tomt vitt ark uppifrån
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.94) * (0.9 + 0.1 * snoBrus(vSnoP.xz * 1.3 + 4.0) + 0.04 * snoBrus(vSnoP.xz * 5.0)), snoK);
    roughnessFactor = mix(roughnessFactor, 0.88, snoK);
    metalnessFactor = mix(metalnessFactor, 0.0, snoK);
  }`);
    };
    m.customProgramCacheKey = () => (k ? k.call(m) : '') + '|sno' + styrka;
  }
  snoPa(mat.tak, 0.95); snoPa(mat.falsar, 0.9); snoPa(mat.takMork, 0.9); snoPa(mat.detalj, 0.85);

  let husGrupp = null, matGrupp = null, aktuell = null, lampSken = 0;
  // dockskåpet: pa = önskat läge, t = 0 stängt .. 1 öppet (animeras)
  // vantar = taket svävar medan inredningen byggs färdigt; svav 0..1 = svävets styrka;
  // skarv = mjuk övergång när riktningen vänds mitt i lyftet; vis = det som visas nu
  const oppen = { pa: false, t: 0, lager: { tak: false, loft: true, fokus: null }, snitt: 99, klipp: new THREE.Plane(new THREE.Vector3(0, -1, 0), 99), lana: null,
    vantar: false, vantarOpts: null, svav: 0, svavT: 0, skarv: null, vis: { y: 0, a: 0, o: 1 } };
  // Tomt hus (möblerna dolda) och planlösningen (vyn rakt ovanifrån), se längre ned
  const tomt = { pa: false };
  const plan = { pa: false, t: 0, fov: 0, egen: false, A: null, B: null, data: null, lager: null, grans: null, varOppen: false, lagerFore: null, y: 0 };
  let val = { modell: 'sadel-40', fasad: null, tak: null, detalj: null, tid: 14, matt: false };

  // ---- Hjälpare för ytor ----
  // En vägg i ett lokalt plan: u åt höger sett utifrån, v uppåt.
  function vagg(grupp, ursprung, uAxel, normal, kontur, hal) {
    const form = new THREE.Shape(kontur.map(p => new THREE.Vector2(p[0], p[1])));
    hal.forEach(h => {
      const p = new THREE.Path();
      p.moveTo(h.u0, h.v0); p.lineTo(h.u0, h.v1); p.lineTo(h.u1, h.v1); p.lineTo(h.u1, h.v0); p.lineTo(h.u0, h.v0);
      form.holes.push(p);
    });
    const geo = new THREE.ShapeGeometry(form);
    const m = new THREE.Mesh(geo, mat.fasad);
    const vAxel = new THREE.Vector3(0, 1, 0);
    const mtx = new THREE.Matrix4().makeBasis(uAxel, vAxel, normal);
    mtx.setPosition(ursprung);
    m.applyMatrix4(mtx);
    m.castShadow = true; m.receiveShadow = true;
    grupp.add(m);
    return mtx;
  }

  function lada(grupp, mtx, w, h, d, cu, cv, cn, material, skugga = true, rx = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(cu, cv, cn);
    if (rx) m.rotation.x = rx;
    m.applyMatrix4(mtx);
    m.castShadow = skugga; m.receiveShadow = true;
    grupp.add(m);
    return m;
  }
  // låda direkt i gruppens koordinater
  function kloss(grupp, w, h, d, x, y, z, material, skugga = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = skugga; m.receiveShadow = true;
    grupp.add(m);
    return m;
  }
  const UPP = new THREE.Vector3(0, 1, 0);
  // rör mellan två punkter (hängrännor och stuprör)
  function ror(grupp, a, b, r, material, seg = 10) {
    const d = b.clone().sub(a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, false), material);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UPP, d.normalize());
    m.castShadow = true; m.receiveShadow = true;
    grupp.add(m);
    return m;
  }

  const NED = 0.09;   // panelen går ned över syllen: 13 cm sockel syns

  // Öppningsbara fönster (f med bröstning) och skjutdörrar (sk): bågarna och glaset slås
  // ihop som allt annat, men märks (userData.fonster) så att slaIhop kan minnas var de
  // hamnade. Först när någon pekar på eller öppnar ett fönster byggs just det fönstrets
  // bågar om i egna pivåer (fonsterUt). En osynlig träffyta per fönster kostar inget ritanrop.
  const FONSTER_TRAFF = new THREE.MeshBasicMaterial({ visible: false });
  let fonsterBygg = null;   // samlas medan byggHus pågår
  // Fönster/dörr i en vägg. mtx = väggens lokala system (u, v, n ut).
  function oppning(grupp, mtx, o) {
    const [, , w, b, h, typ, rutor] = o;
    const u0 = o.u0, u1 = u0 + w, v0 = b, v1 = b + h, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    const DJUP = 0.16, KARM = 0.055, FB = 0.095, FT = 0.022;
    const dorr = typ === 'd' || typ === 'dg';
    const lagt = b > 0.02;
    const fid = fonsterBygg && ((typ === 'f' && lagt) || typ === 'sk') ? fonsterBygg.length : -1;
    const tagga = m => { if (fid >= 0) m.userData.fonster = fid; return m; };
    // smyg (insidan av hålet)
    lada(grupp, mtx, w, 0.02, DJUP, cu, v1 - 0.01, -DJUP / 2, mat.detaljMork, false);
    lada(grupp, mtx, 0.02, h, DJUP, u0 + 0.01, cv, -DJUP / 2, mat.detaljMork, false);
    lada(grupp, mtx, 0.02, h, DJUP, u1 - 0.01, cv, -DJUP / 2, mat.detaljMork, false);
    if (lagt) lada(grupp, mtx, w, 0.02, DJUP, cu, v0 + 0.01, -DJUP / 2, mat.detaljMork, false);
    // foder runt om, med en liten droppnäsa över
    const yB = lagt ? v0 - FB : -NED + 0.035, yT = v1 + FB;
    lada(grupp, mtx, w + FB * 2, FB, FT, cu, v1 + FB / 2, FT / 2, mat.detalj);
    lada(grupp, mtx, w + FB * 2 + 0.03, 0.012, FT + 0.032, cu, yT + 0.006, (FT + 0.032) / 2, mat.detaljMork);
    lada(grupp, mtx, FB, yT - yB, FT, u0 - FB / 2, (yT + yB) / 2, FT / 2, mat.detalj);
    lada(grupp, mtx, FB, yT - yB, FT, u1 + FB / 2, (yT + yB) / 2, FT / 2, mat.detalj);
    // profilerat foder: en list längs ytterkanten (8 mm ut) och en skuggfals mot karmen,
    // så att fodret får kant och skugglinje i stället för att vara en slät bräda
    const PL = 0.016, PU = 0.008, SF = 0.007;
    lada(grupp, mtx, PL, yT - yB, FT + PU, u0 - FB + PL / 2, (yT + yB) / 2, (FT + PU) / 2, mat.detalj);
    lada(grupp, mtx, PL, yT - yB, FT + PU, u1 + FB - PL / 2, (yT + yB) / 2, (FT + PU) / 2, mat.detalj);
    lada(grupp, mtx, w + FB * 2, PL, FT + PU, cu, yT - PL / 2, (FT + PU) / 2, mat.detalj);
    lada(grupp, mtx, SF, h, 0.004, u0 - SF / 2, cv, FT + 0.001, mat.detaljMork, false);
    lada(grupp, mtx, SF, h, 0.004, u1 + SF / 2, cv, FT + 0.001, mat.detaljMork, false);
    lada(grupp, mtx, w + 2 * SF, SF, 0.004, cu, v1 + SF / 2, FT + 0.001, mat.detaljMork, false);
    if (lagt) {
      lada(grupp, mtx, w + FB * 2, FB, FT, cu, v0 - FB / 2, FT / 2, mat.detalj);
      // fönsterbleck: lutar utåt och har en droppkant
      lada(grupp, mtx, w + FB * 2 + 0.03, 0.01, 0.1, cu, v0 + 0.002, 0.012, mat.detaljMork, true, 0.16);
      lada(grupp, mtx, w + FB * 2 + 0.03, 0.03, 0.008, cu, v0 - 0.018, 0.062, mat.detaljMork);
    }
    const z = -0.07;
    if (dorr) {
      // tröskel och dörrblad med en glasruta (dg) eller slätt
      lada(grupp, mtx, w, 0.025, DJUP + 0.04, cu, 0.0125, -DJUP / 2 + 0.02, mat.detaljMork);
      // karm runt bladet (sidor och överstycke), bladet sitter 1 cm bakom karmens framkant
      lada(grupp, mtx, w, KARM, 0.07, cu, v1 - KARM / 2, z, mat.detalj);
      lada(grupp, mtx, KARM, h - 0.025, 0.07, u0 + KARM / 2, (h + 0.025) / 2, z, mat.detalj);
      lada(grupp, mtx, KARM, h - 0.025, 0.07, u1 - KARM / 2, (h + 0.025) / 2, z, mat.detalj);
      const bh = h - KARM - 0.034;
      const bw = w - 2 * KARM - 0.008, by0 = 0.029, by1 = by0 + bh;
      if (typ === 'dg') {
        // glasdörren: bladet i fyra delar runt ett riktigt hål, så att man ser igenom rutan
        // (förut var bladet massivt och visade sin färgade baksida inifrån)
        const gw = w * 0.42, gh = h * 0.62, gy = cv + h * 0.08, sb = (bw - gw) / 2, ga = gy - gh / 2, gb = gy + gh / 2;
        lada(grupp, mtx, sb, bh, 0.05, cu - gw / 2 - sb / 2, by0 + bh / 2, z, mat.detalj);
        lada(grupp, mtx, sb, bh, 0.05, cu + gw / 2 + sb / 2, by0 + bh / 2, z, mat.detalj);
        lada(grupp, mtx, gw, ga - by0, 0.05, cu, (by0 + ga) / 2, z, mat.detalj);
        if (by1 - gb > 0.005) lada(grupp, mtx, gw, by1 - gb, 0.05, cu, (by1 + gb) / 2, z, mat.detalj);
        // hålets kanter kläs ljusa (vitmålad insida, som bågarna), annars lyser detaljfärgen runt rutan inifrån
        const FO = 0.004, fz = z - 0.004, fd = 0.05;
        lada(grupp, mtx, FO, gh, fd, cu - gw / 2 + FO / 2, gy, fz, mat.bagInsida, false);
        lada(grupp, mtx, FO, gh, fd, cu + gw / 2 - FO / 2, gy, fz, mat.bagInsida, false);
        lada(grupp, mtx, gw, FO, fd, cu, ga + FO / 2, fz, mat.bagInsida, false);
        lada(grupp, mtx, gw, FO, fd, cu, gb - FO / 2, fz, mat.bagInsida, false);
        lada(grupp, mtx, gw, gh, 1.3, cu, gy, -DJUP - 0.65, mat.rum, false);   // mörkt rum bakom rutan, som i fönstren
      } else lada(grupp, mtx, bw, bh, 0.05, cu, by0 + bh / 2, z, mat.detalj);
      // tre gångjärn på bladets gångjärnssida (mot trycket)
      const gs = o.sida === 'N' || o.sida === 'W' ? 1 : -1, gx = cu + gs * (w / 2 - KARM - 0.002);
      [0.22, bh / 2 + 0.03, bh - 0.18].forEach(gy => lada(grupp, mtx, 0.022, 0.1, 0.022, gx, gy, z + 0.03, mat.detaljMork));
      if (typ === 'dg') {
        const gm = lada(grupp, mtx, w * 0.42, h * 0.62, 0.01, cu, cv + h * 0.08, z + 0.028, mat.glas, false);
        gm.userData.glas = true;
        // glaslister runt rutan (annars låg glaset som en platta klistrad på bladet)
        const gw = w * 0.42, gh = h * 0.62, gy = cv + h * 0.08, GL = 0.028;
        lada(grupp, mtx, gw + 2 * GL, GL, 0.014, cu, gy + gh / 2 + GL / 2, z + 0.031, mat.bagYtter, false);
        lada(grupp, mtx, gw + 2 * GL, GL, 0.014, cu, gy - gh / 2 - GL / 2, z + 0.031, mat.bagYtter, false);
        lada(grupp, mtx, GL, gh, 0.014, cu - gw / 2 - GL / 2, gy, z + 0.031, mat.bagYtter, false);
        lada(grupp, mtx, GL, gh, 0.014, cu + gw / 2 + GL / 2, gy, z + 0.031, mat.bagYtter, false);
      } else {
        // två frästa spår i det släta bladet
        lada(grupp, mtx, w - 0.24, 0.012, 0.006, cu, cv + h * 0.18, z + 0.026, mat.detaljMork, false);
        lada(grupp, mtx, w - 0.24, 0.012, 0.006, cu, cv - h * 0.22, z + 0.026, mat.detaljMork, false);
      }
      // trycke: skylt, hals och handtag, plus låscylinder
      const sida = o.sida === 'N' || o.sida === 'W' ? -1 : 1;
      const hx = cu + sida * (w / 2 - 0.09);
      lada(grupp, mtx, 0.045, 0.21, 0.01, hx, 1.0, z + 0.03, mat.handtag, false);
      // runt trycke (hals, böj och grepp) och rund låscylinder i stället för kantiga klossar;
      // allt ligger inom bladets volym, så det följer med när ytterdörren öppnas (ytterdorr)
      const hp = (a, b, c) => new THREE.Vector3(a, b, c).applyMatrix4(mtx), hr = 0.0095;
      ror(grupp, hp(hx, 1.04, z + 0.034), hp(hx, 1.04, z + 0.078), hr, mat.handtag, 10);
      ror(grupp, hp(hx, 1.04, z + 0.078), hp(hx - sida * 0.125, 1.04, z + 0.078), hr, mat.handtag, 10);
      const hk = new THREE.Mesh(new THREE.SphereGeometry(hr, 10, 6), mat.handtag);
      hk.position.copy(hp(hx, 1.04, z + 0.078)); hk.castShadow = true; hk.receiveShadow = true; grupp.add(hk);
      ror(grupp, hp(hx, 0.93, z + 0.034), hp(hx, 0.93, z + 0.047), 0.014, mat.handtag, 12);
      lada(grupp, mtx, 0.004, 0.012, 0.002, hx, 0.93, z + 0.0475, mat.detaljMork, false);
      // tröskelskena i metall längs trösklens framkant
      lada(grupp, mtx, w - 2 * KARM, 0.004, 0.06, cu, 0.0235, 0.012, mat.handtag, false);
      return;
    }
    // karm runt om
    lada(grupp, mtx, w, KARM, 0.07, cu, v1 - KARM / 2, z, mat.detalj);
    lada(grupp, mtx, w, KARM, 0.07, cu, v0 + KARM / 2, z, mat.detalj);
    lada(grupp, mtx, KARM, h, 0.07, u0 + KARM / 2, cv, z, mat.detalj);
    lada(grupp, mtx, KARM, h, 0.07, u1 - KARM / 2, cv, z, mat.detalj);
    // mittposten står djupare ut än karmen och kastar en tydlig skugglinje
    for (let i = 1; i < rutor; i++) lada(grupp, mtx, KARM * 1.4, h, 0.1, u0 + (w * i) / rutor, cv, z + 0.02, mat.detalj);
    // bågar: en smalare ram per ruta, 1 cm indragen bakom karmens framkant,
    // så att profilen syns som ett steg i ljuset
    const SB = 0.042, pw = (w - 2 * KARM) / rutor, zb = z - 0.012;
    for (let i = 0; i < rutor; i++) {
      const a = u0 + KARM + pw * i, bu = a + pw;
      const pa = a + (i ? KARM * 0.7 : 0), pb = bu - (i < rutor - 1 ? KARM * 0.7 : 0), pc = (pa + pb) / 2, pww = pb - pa;
      // skjutdörren: bara den rörliga delen (den sista) byggs om
      const t = typ !== 'sk' || i === rutor - 1 ? tagga : m => m;
      // bågen i två skikt: yttre 3 cm i detaljfärgen, inre 2 cm ljus (vitmålad insida)
      [[0.03, 0.01, mat.bagYtter], [0.02, -0.015, mat.bagInsida]].forEach(([dd, dz, mm]) => {
        t(lada(grupp, mtx, pww, SB, dd, pc, v1 - KARM - SB / 2, zb + dz, mm, false));
        t(lada(grupp, mtx, pww, SB * 1.25, dd, pc, v0 + KARM + SB * 0.625, zb + dz, mm, false));
        t(lada(grupp, mtx, SB, h - 2 * KARM, dd, pa + SB / 2, cv, zb + dz, mm, false));
        t(lada(grupp, mtx, SB, h - 2 * KARM, dd, pb - SB / 2, cv, zb + dz, mm, false));
      });
    }
    const g = tagga(lada(grupp, mtx, w - KARM, h - KARM, 0.01, cu, cv, z - 0.01, o[7] === 'frost' ? mat.frostGlas : mat.glas, false));
    g.userData.glas = true; g.renderOrder = 2;
    lada(grupp, mtx, w - 0.02, h - 0.02, 1.3, cu, cv, -DJUP - 0.65, mat.rum, false);
    if (typ === 'sk') tagga(lada(grupp, mtx, 0.03, 0.55, 0.03, cu + w * 0.18, 1.05, z + 0.05, mat.handtag));
    if (fid >= 0) {
      const hb = lada(grupp, mtx, w - 0.02, h - 0.02, 0.14, cu, cv, z, FONSTER_TRAFF, false);
      hb.renderOrder = 1; hb.userData.fonsterTraff = fid; hb.name = 'fonster-traff';
      fonsterBygg.push({ mtx: mtx.clone(), typ, u0, w, cu, cv, v0, v1, h, rutor, KARM, SB, pw, z, zb, bitar: [], traff: hb, o: null });
    }
  }

  // BoxGeometry utan undersidan (den läggs som egen yta i takfotens färg)
  function utanBotten(geo) {
    const idx = geo.index.array, g3 = geo.groups[3], ny = [];
    for (let i = 0; i < idx.length; i++) if (i < g3.start || i >= g3.start + g3.count) ny.push(idx[i]);
    geo.setIndex(ny); geo.clearGroups();
    return geo;
  }

  // Takskiva: från takfot (z0, y0) till nock (z1, y1) i tvärled, x från xa till xb.
  // Med vindskivor, vindskiveplåt, takfotsplåt, synlig takfotsbräda, hängränna
  // och stuprör. Allt läggs direkt i takgruppen så att det slås ihop per material.
  // op: { ranna, stupror: [x...], hogKant (bräda i övre änden), utanVind: -1|1, y0 }
  const VT = 0.028, VH = 0.22;
  // Falsarna (bandplåt var 50:e cm) är bakade i en normalkarta med mipmaps (ingen flimmer på
  // avstånd); riktig geometri bara i kanterna (vindskivor, plåtar). En ruta = en fals,
  // läst ur uv1 (u = fals nummer, v = meter längs taket).
  const falsKarta = (() => {
    const W = 128, H = 4, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), d = g.createImageData(W, H), SP = 0.5;
    const h = u => { const dm = Math.min(u, 1 - u) * SP; return 0.032 * (1 - mjuk(0.009, 0.017, dm)); };
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, du = 1 / W / 4, dh = (h((u + du) % 1) - h((u - du + 1) % 1)) / (2 * du * SP);
      const l = Math.hypot(dh, 1), nx = -dh / l, nz = 1 / l;
      for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; d.data[i] = (nx * 0.5 + 0.5) * 255; d.data[i + 1] = 128; d.data[i + 2] = nz * 255; d.data[i + 3] = 255; }
    }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.channel = 1; t.anisotropy = 8;
    return t;
  })();
  mat.tak.normalMap = falsKarta; mat.tak.normalScale = new THREE.Vector2(0.9, 0.9);
  // Plåtens färgkarta (gråskala × takfärgen, samma uv1): fyra våder i bredd med var sin ton,
  // en smal mörk rand intill varje fals (skuggan i vecket) och svaga rinnränder längs fallet.
  // Utan den var taket en enda jämn yta på håll, där normalkartans falsar tonar bort.
  mat.tak.map = (() => {
    const W = 512, H = 64, V = 4, PV = W / V, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), r = brus(29);
    for (let k = 0; k < V; k++) {
      const x0 = k * PV, t = 236 + Math.floor(r() * 16);
      g.fillStyle = `rgb(${t},${t},${t})`; g.fillRect(x0, 0, PV, H);
      for (let i = 0; i < 6; i++) { const v = r() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},.022)`; g.fillRect(x0 + 8 + r() * (PV - 22), 0, 2 + r() * 9, H); }
    }
    // falsen ligger i rutans kant (u = heltal): halva på var sida om skarven
    for (let k = 0; k <= V; k++) {
      const x = k * PV;
      let gl = g.createLinearGradient(x - 11, 0, x - 4, 0); gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,.13)');
      g.fillStyle = gl; g.fillRect(x - 11, 0, 7, H);
      gl = g.createLinearGradient(x + 4, 0, x + 11, 0); gl.addColorStop(0, 'rgba(0,0,0,.13)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl; g.fillRect(x + 4, 0, 7, H);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - 2, 0, 4, H);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / V, 1); t.channel = 1; t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  function takskiva(grupp, xa, xb, p0, p1, T, utsprang, op = {}) {
    const dz = p1[0] - p0[0], dy = p1[1] - p0[1];
    const lang = Math.hypot(dz, dy);
    const rz = dz / lang, ry = dy / lang;
    const a = [p0[0] - rz * utsprang, p0[1] - ry * utsprang];
    const L = lang + utsprang;
    const mid = [(a[0] + p1[0]) / 2, (a[1] + p1[1]) / 2];
    // riktning med positiv z, så att skivans lokala Y alltid pekar uppåt
    const ez = rz >= 0 ? rz : -rz, ey = rz >= 0 ? ry : -ry;
    const nY = ez, nZ = -ey;               // normalen (uppåt)
    const bredd = xb - xa;
    const skiva = new THREE.Group();
    const del = (geo, material, x, y, z, skugga = true) => {
      const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
      m.castShadow = skugga; m.receiveShadow = true; skiva.add(m); return m;
    };
    const n = Math.max(1, Math.floor(bredd / 0.5));
    const skivGeo = new THREE.BoxGeometry(bredd, T, L), sp = skivGeo.attributes.position, uv1 = new Float32Array(sp.count * 2);
    for (let i = 0; i < sp.count; i++) { uv1[i * 2] = (sp.getX(i) + bredd / 2) * n / bredd; uv1[i * 2 + 1] = sp.getZ(i); }
    skivGeo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    del(utanBotten(skivGeo), mat.tak, 0, 0, 0);
    const under = new THREE.PlaneGeometry(bredd, L); under.rotateX(Math.PI / 2);
    del(under, mat.takUnder, 0, -T / 2, 0, false);
    // falsarna (var 50:e cm, 32 mm höga) ligger i normalkartan, se falsKarta
    // vindskivor med plåt ovanpå
    // Sadeltak: vindskivorna och deras plåt geras lodrätt i nocken (z = p1[0]). Rakt avkapade
    // (vinkelrätt mot takfallet) lämnade de en V-formad kil under nocken där de två möttes.
    const posZ = mid[0] + nZ * T / 2, sR = rz >= 0 ? 1 : -1;
    const gera = (geo, yOff) => {
      if (op.hogKant) return geo;   // pulpettak: övre änden är ingen nock
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getZ(i) * sR > 0) p.setZ(i, (p1[0] - posZ + (p.getY(i) + yOff) * ey) / ez);
      geo.computeVertexNormals(); return geo;
    };
    [-1, 1].forEach(s => {
      const yV = T / 2 - VH / 2 + 0.025, yP = T / 2 + 0.034;
      if (op.utanVind === s) {
        // sidan mot kupan: väggen täcker takskivans ände, utom vid takutsprånget där den
        // stack fram som en bar röd skivkant. Där sitter en kort vindskiva med plåt.
        const Lk = utsprang + 0.02, zk = (rz >= 0 ? -1 : 1) * (L / 2 - Lk / 2);
        del(new THREE.BoxGeometry(VT, VH, Lk), mat.detalj, s * (bredd / 2 + VT / 2), yV, zk);
        del(new THREE.BoxGeometry(VT + 0.03, 0.018, Lk + 0.01), mat.falsar, s * (bredd / 2 + VT / 2 - 0.006), yP, zk);
        return;
      }
      del(gera(new THREE.BoxGeometry(VT, VH, L), yV), mat.detalj, s * (bredd / 2 + VT / 2), yV, 0);
      del(gera(new THREE.BoxGeometry(VT + 0.03, 0.018, L + 0.01), yP), mat.falsar, s * (bredd / 2 + VT / 2 - 0.006), yP, 0);
    });
    // takfotsplåt
    const eZ = rz >= 0 ? -L / 2 : L / 2;
    del(new THREE.BoxGeometry(bredd + 2 * VT, 0.016, 0.07), mat.falsar, 0, T / 2 + 0.008, eZ - Math.sign(eZ) * 0.03);
    if (op.hogKant) del(new THREE.BoxGeometry(bredd + 2 * VT, 0.016, 0.07), mat.falsar, 0, T / 2 + 0.008, -eZ + Math.sign(eZ) * 0.03);
    // snörasskydd (där produktbilden har det): två rör på konsoler ca 45 cm upp från takfoten
    if (op.snoskydd) {
      const zs = eZ - Math.sign(eZ) * 0.45, bl = bredd - 0.3, nk = Math.max(2, Math.round(bl / 0.9));
      for (let i = 0; i <= nk; i++) {
        const xk = -bl / 2 + bl * i / nk;
        del(new THREE.BoxGeometry(0.012, 0.15, 0.05), mat.falsar, xk, T / 2 + 0.073, zs, false);
      }
      [0.09, 0.135].forEach(h => {
        const g = new THREE.CylinderGeometry(0.012, 0.012, bl + 0.06, 8); g.rotateZ(Math.PI / 2);
        del(g, mat.falsar, 0, T / 2 + h, zs + Math.sign(eZ) * 0.012, false);
      });
    }
    skiva.rotation.x = Math.atan2(-ey, ez);
    skiva.position.set((xa + xb) / 2, mid[1] + nY * T / 2, mid[0] + nZ * T / 2);
    skiva.updateMatrix();
    skiva.children.slice().forEach(c => { c.applyMatrix4(skiva.matrix); grupp.add(c); });

    // takfotsbräda (lodrät) i ändarna
    const xm = (xa + xb) / 2, bb = bredd + 2 * VT;
    const bradda = (p, ut) => {
      const top = [p[0] + nZ * T, p[1] + nY * T];
      const zY = ut > 0 ? Math.max(p[0], top[0]) : Math.min(p[0], top[0]);
      const yb = p[1] - 0.06, yt = top[1];
      kloss(grupp, bb, yt - yb, 0.025, xm, (yt + yb) / 2, zY + ut * 0.0125, mat.detalj);
      return { z: zY + ut * 0.025, yb };
    };
    const ut = -Math.sign(rz) || -1;
    const fot = bradda(a, ut);
    if (op.hogKant) bradda(p1, -ut);
    if (op.ranna) {
      // halvrund hängränna i takets plåt: öppen upptill, med vulst på utsidan och ändlock
      // (extruderad profil), upphängd i rännkrokar mot takfotsbrädan
      const rr = 0.062, rt = 0.006, zg = fot.z + ut * (rr + 0.004), yg = fot.yb + 0.075;
      const rx0 = xa - VT - 0.03, rx1 = xb + VT + 0.03;
      const prof = new THREE.Shape();
      prof.absarc(0, 0, rr, Math.PI, 2 * Math.PI, false);
      prof.absarc(0, 0, rr - rt, 2 * Math.PI, Math.PI, true);
      const rGeo = new THREE.ExtrudeGeometry(prof, { depth: rx1 - rx0, bevelEnabled: false, curveSegments: 14 });
      rGeo.rotateY(Math.PI / 2);   // profilens x -> världens -z, strängen längs x
      const rm = new THREE.Mesh(rGeo, mat.falsar);
      rm.position.set(rx0, yg, zg); rm.castShadow = true; rm.receiveShadow = true; grupp.add(rm);
      // vulst (rullad kant) på utsidan
      ror(grupp, new THREE.Vector3(rx0, yg, zg + ut * rr), new THREE.Vector3(rx1, yg, zg + ut * rr), 0.009, mat.falsar, 6);
      // rännkrokar ca var 60:e cm: band från takfotsbrädan runt rännans underkant
      const nk = Math.max(2, Math.round((rx1 - rx0) / 0.6));
      for (let i = 0; i <= nk; i++) {
        const xk = rx0 + 0.08 + (rx1 - rx0 - 0.16) * i / nk;
        kloss(grupp, 0.022, 0.006, 2 * rr + 0.012, xk, yg + 0.004, zg, mat.falsar, false);
        kloss(grupp, 0.022, rr + 0.004, 0.006, xk, yg - rr / 2 + 0.004, fot.z + ut * 0.003, mat.falsar, false);
      }
      const Y0 = op.y0 || 0;
      // Stuprör: utlopp rakt ned ur rännan, svanhals in mot väggen, lodrätt ned med rörsvep
      // mot väggen och en utkastare vid marken. Ett tal = rör på långväggen vid x; ett objekt
      // { x, z, nx } = rör på gavelväggen (runt hörnet), utkastaren åt nx.
      (op.stupror || []).forEach(s => {
        const rp = 0.04, gav = typeof s === 'object';
        const x = gav ? s.x : s, zp = gav ? s.z : p0[0] + ut * (0.035 + rp);
        const dx = gav ? s.nx : 0, dz = gav ? 0 : ut;
        const V = (a, b, c) => new THREE.Vector3(a, b, c);
        const A = V(x, yg - rr + 0.02, zg), A1 = V(x, yg - rr - 0.08, zg), B = V(x, yg - 0.38, zp);
        const C = V(x, 0.26 - Y0, zp), D = V(x + dx * 0.22, 0.11 - Y0, zp + dz * 0.22);
        ror(grupp, A, A1, rp, mat.stupror);
        ror(grupp, A1, B, rp, mat.stupror);
        ror(grupp, B, C, rp, mat.stupror);
        ror(grupp, C, D, rp, mat.stupror);
        // böjarna: klot i rörets grovlek, så att fogarna blir hela
        [A1, B, C].forEach(p => { const k = new THREE.Mesh(new THREE.SphereGeometry(rp, 10, 6), mat.stupror); k.position.copy(p); k.castShadow = true; k.receiveShadow = true; grupp.add(k); });
        // muff under rännan och vid utkastaren
        ror(grupp, V(x, yg - rr - 0.005, zg), V(x, yg - rr - 0.045, zg), rp * 1.18, mat.stupror);
        ror(grupp, D.clone().lerp(C, 0.15), D.clone().lerp(C, -0.04), rp * 1.12, mat.stupror);
        // rörsvep: ring runt röret och ett stag in i väggen, ca var 1,2 m
        const ds = 0.035 + rp, ns = Math.max(2, Math.round((B.y - C.y) / 1.2) + 1);
        for (let i = 0; i < ns; i++) {
          const yk = C.y + 0.25 + (B.y - C.y - 0.45) * i / (ns - 1);
          ror(grupp, V(x, yk - 0.016, zp), V(x, yk + 0.016, zp), rp + 0.006, mat.stupror);
          if (gav) kloss(grupp, ds, 0.018, 0.018, x - dx * ds / 2, yk, zp, mat.stupror, false);
          else kloss(grupp, 0.018, 0.018, ds, x, yk, zp - dz * ds / 2, mat.stupror, false);
        }
      });
    }
  }

  // kopior i gruppens koordinater; blandas geometrier med och utan index blir alla utan
  function forIhop(lista) {
    const blandat = lista.some(m => m.geometry.index) && lista.some(m => !m.geometry.index);
    return lista.map(m => {
      m.updateMatrix();
      const k = blandat && m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      k.applyMatrix4(m.matrix); return k;
    });
  }
  function slaIhop(grupp) {
    const hinkar = new Map();
    grupp.children.slice().forEach(m => {
      if (!m.isMesh || m.isInstancedMesh || Array.isArray(m.material) || m.renderOrder) return;
      // samma attribut krävs för att slå ihop (RoundedBox saknar index, Cylinder har det)
      const nyckel = m.material.uuid + (m.castShadow ? 's' : '') + '|' + Object.keys(m.geometry.attributes).sort().join(',');
      if (!hinkar.has(nyckel)) hinkar.set(nyckel, []);
      hinkar.get(nyckel).push(m);
    });
    hinkar.forEach(lista => {
      if (lista.length < 2) return;
      const geos = forIhop(lista);
      geos.forEach(k => k.clearGroups());
      let ihop = null;
      try { ihop = mergeGeometries(geos, false); } catch (e) { ihop = null; }
      geos.forEach(g => g.dispose());
      if (!ihop) return;
      const ny = new THREE.Mesh(ihop, lista[0].material);
      ny.castShadow = lista[0].castShadow; ny.receiveShadow = true;
      minnsFonster(lista, geos, ny);
      lista.forEach(m => { grupp.remove(m); m.geometry.dispose(); });
      grupp.add(ny);
    });
    // glaset för sig, också ihopslaget
    const glas = grupp.children.filter(m => m.isMesh && m.material === mat.glas);
    if (glas.length > 1) {
      const geos = forIhop(glas);
      let ihop = null;
      try { ihop = mergeGeometries(geos, false); } catch (e) { ihop = null; }
      geos.forEach(g => g.dispose());
      if (ihop) {
        const ny = new THREE.Mesh(ihop, mat.glas); ny.renderOrder = 2;
        minnsFonster(glas, geos, ny);
        glas.forEach(m => { grupp.remove(m); m.geometry.dispose(); });
        grupp.add(ny);
      }
    }
    // märkta delar som inte slogs ihop: hela meshen göms när fönstret byggs om
    if (fonsterBygg) grupp.children.forEach(m => { const f = m.userData.fonster; if (m.isMesh && f !== undefined && fonsterBygg[f]) fonsterBygg[f].bitar.push({ mesh: m, hela: true }); });
  }
  // var fönstrets bågar och glas hamnade i den hopslagna geometrin (hörnen i följd)
  function minnsFonster(lista, geos, ny) {
    if (!fonsterBygg) return;
    let off = 0;
    lista.forEach((m, j) => {
      const n = geos[j].attributes.position.count, f = m.userData.fonster;
      if (f !== undefined && fonsterBygg[f]) fonsterBygg[f].bitar.push({ mesh: ny, start: off, count: n });
      off += n;
    });
  }

  // Detaljerna utanför väggarna: trappsteg och dörrmatta vid varje ytterdörr,
  // vägglampa vid entrén, skuggrand under takfoten och (om ritningen har det) ett däck.
  // Trappor och däck ligger i 'ute' (står på marken), lampan och randen i väggarna.
  function utsida(vaggar, ute, H, omb, mtxer, m) {
    const { Y0, L, hN, hS, xw, xk } = m;
    const tra = H.trappa !== 'betong';
    const DS = 0.02;                       // stegets ovansida under tröskeln
    // trä: brädor med springor på en indragen mörk regel; betong: hela block
    const steg = (mtx, cu, bred, n0, n1, top) => {
      if (!tra) { lada(ute, mtx, bred, top + Y0, n1 - n0, cu, (top - Y0) / 2, (n0 + n1) / 2, mat.betong); return; }
      const BT = 0.028, BB = 0.118, GAP = 0.01;
      lada(ute, mtx, bred - 0.05, top + Y0 - BT, n1 - n0 - 0.04, cu, (top - BT - Y0) / 2, (n0 + n1) / 2 - 0.01, mat.detaljMork);
      const antal = Math.max(1, Math.round((n1 - n0 + GAP) / (BB + GAP)));
      const bb = (n1 - n0 - GAP * (antal - 1)) / antal;
      for (let i = 0; i < antal; i++) lada(ute, mtx, bred, BT, bb, cu, top - BT / 2, n0 + bb / 2 + i * (bb + GAP), mat.tra);
    };
    const dorrar = [];
    Object.keys(omb).forEach(s => omb[s].forEach(o => { if (o[5] === 'd' || o[5] === 'dg' || o[5] === 'sk') dorrar.push(o); }));
    const al = altanMatt(H, omb, m);
    dorrar.forEach(o => {
      const mtx = mtxer[o.sida], w = o[2], cu = o.u0 + w / 2;
      if (al && al.sida === o.sida && cu > al.u0 && cu < al.u1) return;
      const sk = o[5] === 'sk', bred = w + (sk ? 0.4 : 0.6), dj = sk ? 0.8 : 0.75;
      // två steg: podest i trösklens höjd och ett halvsteg ned mot marken
      steg(mtx, cu, bred, -0.06, dj, -DS);
      steg(mtx, cu, bred - 0.1, dj, dj + 0.3, -Y0 + (Y0 - DS) / 2);
      if (!sk) lada(ute, mtx, Math.min(0.85, w * 0.95), 0.012, 0.5, cu, -DS + 0.006, 0.34, mat.matta, false);
    });
    const altanUt = al ? byggAltan(ute, mtxer[al.sida], al, Y0) : null;
    if (altanUt) { try { byggMobler(ute); } catch (e) { console.warn('altanens möbler', H.namn, e); } }

    // ljusspill på marken: ett plan per glasad öppning i bottenvåningen, lika brett som
    // öppningen och längre ju högre den är. Alla slås ihop till en mesh.
    Object.keys(omb).forEach(sd => omb[sd].forEach(o => {
      if (o[5] === 'd' || o[3] > 2.3) return;
      const w = o[2], cu = o.u0 + w / 2, dj = 0.7 + (o[3] + o[4]) * 0.55;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.2 + 0.35, dj).rotateX(-Math.PI / 2), mat.spill);
      // över gruset (miljöns mark ligger några cm upp)
      pl.position.set(cu, -Y0 + 0.11, dj / 2 + 0.02); pl.applyMatrix4(mtxer[sd]); ute.add(pl);
    }));

    // skuggrand under takfoten på långsidorna
    const rand = (mtx, u0, u1, top) => {
      const hh = 0.42, mm = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, hh), mat.skuggrand);
      mm.position.set((u0 + u1) / 2, top - hh / 2, 0.004); mm.applyMatrix4(mtx); vaggar.add(mm);
    };
    rand(mtxer.N, 0, L, hN);
    if (H.kupa) { rand(mtxer.S, xk - xw, L, hS); rand(mtxer.S, 0, xk - xw, H.kupa.hk); } else rand(mtxer.S, 0, L, hS);

    // vägglampan vid huvuddörren, på gångjärnssidan (bort från trycket)
    const huvud = dorrar.find(o => o[5] === 'd') || dorrar.find(o => o[5] === 'dg');
    if (!huvud) return { glod: null, altan: altanUt };
    const mtx = mtxer[huvud.sida], sida = huvud.sida === 'N' || huvud.sida === 'W' ? -1 : 1;
    const vagglangd = huvud.sida === 'S' || huvud.sida === 'N' ? L : m.W;
    const krock = u => u < 0.3 || u > vagglangd - 0.3 || omb[huvud.sida].some(p => p !== huvud && u > p.u0 - 0.22 && u < p.u0 + p[2] + 0.22 && p[3] < 2.25 && p[3] + p[4] > 1.7);
    const vanster = huvud.u0 - 0.3, hoger = huvud.u0 + huvud[2] + 0.3;
    let lu = sida > 0 ? vanster : hoger;
    if (krock(lu)) lu = sida > 0 ? hoger : vanster;
    if (krock(lu)) return { glod: null, altan: altanUt };
    const lv = 1.96;
    lada(vaggar, mtx, 0.085, 0.2, 0.016, lu, lv, 0.008, mat.detaljMork);
    lada(vaggar, mtx, 0.1, 0.15, 0.12, lu, lv, 0.076, mat.detaljMork);
    lada(vaggar, mtx, 0.11, 0.012, 0.135, lu, lv + 0.081, 0.078, mat.detaljMork);
    lada(vaggar, mtx, 0.078, 0.01, 0.098, lu, lv - 0.08, 0.078, mat.lampGlas, false);
    lada(vaggar, mtx, 0.06, 0.05, 0.004, lu, lv - 0.035, 0.138, mat.lampGlas, false);
    // falskt sken: en additiv bild som inte behöver något ljus
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const gx = c.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.18, 'rgba(255,190,110,.55)'); gr.addColorStop(0.5, 'rgba(255,170,90,.14)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: 0xffc58a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(lu, lv - 0.07, 0.12).applyMatrix4(mtx); sp.scale.set(0.45, 0.45, 1); sp.renderOrder = 3; sp.visible = false;
    vaggar.add(sp);
    // ljuskonen på panelen under och över lampan
    const kon = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9), mat.lampKon);
    kon.position.set(lu, lv - 0.86, 0.006); kon.applyMatrix4(mtx); vaggar.add(kon);
    const upp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateZ(Math.PI), mat.lampKon);
    upp.position.set(lu, lv + 0.32, 0.006); upp.applyMatrix4(mtx); vaggar.add(upp);
    return { glod: sp, altan: altanUt };
  }

  // Altanens läge: framför den största glasade öppningen i bottenplan på H.altan-sidan
  // (skjutdörr före fönster). Bredd = öppningen + 1,5 m, djup 3–3,5 m.
  function altanMatt(H, omb, m) {
    const sd = H.altan;
    if (!sd || !omb[sd]) return null;
    const kand = omb[sd].filter(o => o[3] < 0.25 && o[4] > 1.8 && o[5] !== 'd');
    if (!kand.length) return null;
    const o = kand.find(k => k[5] === 'sk') || kand.slice().sort((a, b) => b[2] - a[2])[0];
    const vl = sd === 'S' || sd === 'N' ? m.L : m.W;
    const bred = Math.min(vl, Math.max(2.8, o[2] + 1.5));
    let u0 = o.u0 + o[2] / 2 - bred / 2;
    u0 = Math.max(0, Math.min(vl - bred, u0));
    return { sida: sd, u0, u1: u0 + bred, djup: vl <= 4.5 ? 3.0 : 3.5, o };
  }

  // Altanen med möbler. Allt i väggens system (u längs väggen, v upp, n ut) och i 'ute',
  // så att det slås ihop per material (cirka 8 ritanrop) och kommer upp med sockeln.
  function byggAltan(ute, mtx, al, Y0) {
    const Wd = al.u1 - al.u0, Dd = al.djup, cu = (al.u0 + al.u1) / 2, top = -0.006;
    const satt = (geo, material, u, v, n, ry = 0, skugga = true) => {
      const mm = new THREE.Mesh(geo, material); mm.position.set(u, v, n); mm.rotation.y = ry;
      mm.applyMatrix4(mtx); mm.castShadow = skugga; mm.receiveShadow = true; ute.add(mm); return mm;
    };
    // en möbeldel: lokala mått (x längs, y upp, z framåt) runt möbelns mitt (a, n) vriden ry
    const del = (w, h, d, x, y, z, material, a, n, ry = 0, skugga = true, geo = null) => {
      const c = Math.cos(ry), sn = Math.sin(ry);
      return satt(geo || new THREE.BoxGeometry(w, h, d), material, cu + a + x * c + z * sn, top + y, n - x * sn + z * c, ry, skugga);
    };
    const plan = (w, d, a, n, y, material, rep = true) => {
      const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      if (rep) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + a * 0.37, uv.getY(i) * d); }
      return satt(g, material, cu + a, top + y, n, 0, false);
    };
    // däcket: brädor ovanpå, sarg runt de tre fria sidorna, ett steg ned längs framkanten
    plan(Wd, Dd, 0, Dd / 2, 0.001, mat.altan);
    const SG = 0.028;
    lada(ute, mtx, Wd + SG * 2, Y0 - 0.02, SG, cu, -Y0 / 2 - 0.01, Dd + SG / 2, mat.tra);
    lada(ute, mtx, SG, Y0 - 0.02, Dd, al.u0 - SG / 2, -Y0 / 2 - 0.01, Dd / 2, mat.tra);
    lada(ute, mtx, SG, Y0 - 0.02, Dd, al.u1 + SG / 2, -Y0 / 2 - 0.01, Dd / 2, mat.tra);
    lada(ute, mtx, Wd + SG * 2, 0.03, 0.05, cu, -0.021, Dd + 0.004, mat.tra);   // täckbräda på kanten
    const sb = Math.min(Wd - 0.4, 2.4), sy = -Y0 / 2;
    lada(ute, mtx, sb, Y0 / 2 - 0.03, 0.36, cu, (sy - 0.03 - Y0) / 2, Dd + SG + 0.18, mat.tra);
    const st = new THREE.PlaneGeometry(sb, 0.36).rotateX(-Math.PI / 2);
    { const uv = st.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sb, uv.getY(i) * 0.36); }
    satt(st, mat.altan, cu, sy - 0.03, Dd + SG + 0.18, 0, false);

    // möblerna byggs för sig efter miljön (byggMobler) och byggs om vid miljöbyte
    ute.userData.altan = { mtx, Wd, Dd, cu, top };
    const la = Wd / 2 - 0.42, ln = Dd - 0.38;
    // varm ljuspöl på däcket och ett sken runt lyktorna
    plan(2.2, 2.2, la - 0.15, ln - 0.1, 0.008, mat.pol, false);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const gx = c.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.2, 'rgba(255,190,110,.5)'); gr.addColorStop(0.55, 'rgba(255,170,90,.12)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: 0xffc58a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set(cu + la - 0.13, top + 0.2, ln - 0.06).applyMatrix4(mtx); sp.scale.set(0.9, 0.9, 1); sp.renderOrder = 3; sp.visible = false;
    ute.add(sp);
    // utbredning (i husets x/z) för skuggkameran
    const pA = new THREE.Vector3(al.u0, 0, 0).applyMatrix4(mtx), pB = new THREE.Vector3(al.u1, 0, Dd + 0.6).applyMatrix4(mtx);
    return { glod: sp, x0: Math.min(pA.x, pB.x), x1: Math.max(pA.x, pB.x), z0: Math.min(pA.z, pB.z), z1: Math.max(pA.z, pB.z) };
  }

  // ---- Altanens möbler, efter miljön ----
  // Studio: ljus ek och vitt linne, inget plock. Trädgård: sommar med dynor, kuddar, pläd,
  // parasoll (stora däck), blommor och oliv. Skog: mörkt oljat trä, mossgröna dynor,
  // ullpläd och eldskål. Vinter: inga dynor, snö på sitsar och bord, fårskinn, granris
  // och snö i däckets springor. Lyktorna lyser på kvällen i alla (glöden finns i däcket).
  // Allt slås ihop per material: trä, textil (färg i hörnen), metall, ljus, glas, växter,
  // kontaktskugga och snölager, högst 8 ritanrop för möblerna.
  const MOBELTEMA = {
    studio: { ram: 0xc6a47c, grov: 0.62, dyna: 0xebe6dc, kudde: null, pled: null, matta: null, kruka: 0xcfc9bf, vaxt: [1, 0], oliv: false, parasoll: null, eld: false, sno: false, fall: 0 },
    tradgard: { ram: 0x8c6243, grov: 0.55, dyna: 0xe3ddd0, kudde: [0xae7a5e, 0xc4b28c, 0x7d8869], pled: 0xb59f7c, matta: 0x8e877a, kruka: 0xa8674c, vaxt: [5, 1, 3], oliv: true, parasoll: 'uppe', eld: false, sno: false, fall: 0 },
    skog: { ram: 0x4a3829, grov: 0.5, dyna: 0x5d6748, kudde: [0x9a7b4e, 0x6e5c4a], pled: 0x7c5242, matta: 0x5d5448, kruka: 0x3e3c39, vaxt: [1, 0], oliv: false, parasoll: null, eld: true, sno: false, fall: 1 },
    vinter: { ram: 0x7c6957, grov: 0.72, dyna: null, kudde: null, pled: null, matta: null, kruka: 0x3e3c39, vaxt: [4, 4], oliv: false, parasoll: 'nere', eld: false, sno: true, fall: 2 },
  };
  const SNO = 0xf1f3f6, FALL = 0xebe2d2;
  function byggMobler(ute) {
    const A = ute && ute.userData.altan;
    if (!A) return;
    const gml = ute.getObjectByName('mobler');
    if (gml) { ute.remove(gml); gml.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const grp = new THREE.Group(); grp.name = 'mobler'; ute.add(grp);
    const T = MOBELTEMA[miljoNamn] || MOBELTEMA.studio;
    mat.mobel.color.setHex(T.ram); mat.mobel.roughness = T.grov;
    const { mtx, Wd, Dd, cu, top } = A;
    const fc = new THREE.Color();
    const morkare = (hex, k = 0.78) => fc.setHex(hex).multiplyScalar(k).getHex();
    const farga = (geo, hex) => {
      fc.setHex(hex);
      const n = geo.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = fc.r; c[i * 3 + 1] = fc.g; c[i * 3 + 2] = fc.b; }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      return geo;
    };
    const skuggar = m => m !== mat.lampGlas && m !== mat.snoLager && m !== mat.flackM && m !== mat.glas;
    // F = { a, n, r }: möbelns mitt längs väggen (a från däckets mitt), ut från väggen (n) och vridning
    const lagg = (geo, material, F, x, y, z, farg) => {
      if (farg !== undefined && farg !== null) farga(geo, farg);
      const c = Math.cos(F.r || 0), sn = Math.sin(F.r || 0);
      const mm = new THREE.Mesh(geo, material);
      mm.position.set(cu + F.a + x * c + z * sn, top + y, F.n - x * sn + z * c); mm.rotation.y = F.r || 0;
      mm.applyMatrix4(mtx); mm.castShadow = skuggar(material); mm.receiveShadow = true; grp.add(mm);
      return mm;
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    // rundad låda; bula < 0 ger en svag svacka i ovansidan (dyna), > 0 en kupig snöhuva
    const rund = (w, h, d, r, bula = 0) => {
      const g = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.002, Math.min(r, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001)));
      if (bula) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i); if (y <= 0) continue;
          const qx = p.getX(i) / (w / 2), qz = p.getZ(i) / (d / 2);
          p.setY(i, y + bula * Math.max(0, 1 - qx * qx) * Math.max(0, 1 - qz * qz) * (y / (h / 2)));
        }
        g.computeVertexNormals();
      }
      return g;
    };
    const skugga = (F, w, d) => lagg(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat.flackM, F, 0, 0.004, 0);

    // loungesoffa (och fåtölj med L ≈ 0,8): ribbad ram, ben och armstöd, sits 40 cm, djup 80 cm
    const soffa = (F, L, extra = true) => {
      [-1, 1].forEach(sx => {
        const x = sx * (L / 2 - 0.035);
        lagg(box(0.055, 0.62, 0.055), mat.mobel, F, x, 0.31, 0.35);
        lagg(box(0.055, 0.7, 0.055), mat.mobel, F, x, 0.35, -0.35);
        lagg(box(0.085, 0.035, 0.84), mat.mobel, F, x, 0.637, 0);
        for (let k = 0; k < 3; k++) lagg(box(0.024, 0.055, 0.66), mat.mobel, F, x, 0.15 + k * 0.14, 0);
      });
      [-0.36, 0.36].forEach(z => lagg(box(L - 0.1, 0.07, 0.04), mat.mobel, F, 0, 0.215, z));
      for (let k = 0; k < 6; k++) lagg(box(L - 0.1, 0.02, 0.085), mat.mobel, F, 0, 0.26, -0.3 + k * 0.12);
      lagg(box(L - 0.1, 0.05, 0.04), mat.mobel, F, 0, 0.68, -0.37);
      const nb = Math.max(3, Math.round((L - 0.1) / 0.13));
      for (let k = 0; k < nb; k++) lagg(box(0.05, 0.38, 0.02), mat.mobel, F, -(L - 0.2) / 2 + k * (L - 0.2) / (nb - 1), 0.47, -0.37);
      skugga(F, L + 0.35, 1.15);
      const n = Math.max(1, Math.round((L - 0.12) / 0.66)), w = (L - 0.12) / n, x0 = -(L - 0.12) / 2;
      if (T.dyna) {
        for (let k = 0; k < n; k++) {
          const x = x0 + w * (k + 0.5);
          lagg(rund(w - 0.008, 0.13, 0.7, 0.035, -0.014), mat.textil, F, x, 0.335, 0.03, T.dyna);   // ovansidan på 40 cm
          lagg(box(w - 0.03, 0.011, 0.011), mat.textil, F, x, 0.396, 0.379, morkare(T.dyna));      // passpoal
          lagg(box(w - 0.03, 0.011, 0.011), mat.textil, F, x, 0.274, 0.379, morkare(T.dyna));
          lagg(rund(w - 0.02, 0.42, 0.14, 0.05).rotateX(-0.2), mat.textil, F, x, 0.6, -0.26, T.dyna);
        }
        if (extra && T.kudde && L > 1.2) [-1, 1].forEach((sx, i) => lagg(rund(0.42, 0.42, 0.13, 0.06).rotateZ(sx * 0.12).rotateX(-0.25), mat.textil, F, sx * (L / 2 - 0.32), 0.61, -0.12, T.kudde[i % T.kudde.length]));
        if (extra && T.pled) {
          lagg(rund(0.5, 0.03, 0.62, 0.012), mat.textil, F, L / 2 - 0.4, 0.415, 0.02, T.pled);
          lagg(rund(0.5, 0.26, 0.025, 0.01), mat.textil, F, L / 2 - 0.4, 0.29, 0.39, T.pled);
        }
      }
      if (T.sno) {
        const fall = extra && T.fall > 0, sw = fall ? L - 0.16 - 0.56 : L - 0.16, fx = sw > 0.3 ? L / 2 - 0.36 : 0;
        if (sw > 0.3) lagg(rund(sw, 0.06, 0.72, 0.028, 0.025), mat.textil, F, fall ? -(L - 0.16) / 2 + sw / 2 : 0, 0.3, 0, SNO);
        if (fall) {
          lagg(rund(0.52, 0.045, 0.78, 0.02, 0.01), mat.textil, F, fx, 0.295, 0.02, FALL);
          lagg(rund(0.48, 0.4, 0.04, 0.02).rotateX(-0.06), mat.textil, F, fx, 0.48, -0.33, FALL);
        }
        [-1, 1].forEach(sx => lagg(rund(0.085, 0.03, 0.84, 0.014, 0.008), mat.textil, F, sx * (L / 2 - 0.035), 0.668, 0, SNO));
        lagg(rund(L - 0.1, 0.03, 0.06, 0.014, 0.008), mat.textil, F, 0, 0.72, -0.37, SNO);
      }
    };
    const soffbord = F => {
      for (let k = 0; k < 5; k++) lagg(box(0.9, 0.022, 0.085), mat.mobel, F, 0, 0.38, -0.2 + k * 0.1);
      [-0.4, 0.4].forEach(x => [-0.2, 0.2].forEach(z => lagg(box(0.045, 0.37, 0.045), mat.mobel, F, x, 0.185, z)));
      [-0.2, 0.2].forEach(z => lagg(box(0.78, 0.04, 0.03), mat.mobel, F, 0, 0.34, z));
      skugga(F, 1.2, 0.8);
      if (T.sno) lagg(rund(0.92, 0.05, 0.5, 0.024, 0.02), mat.textil, F, 0, 0.41, 0, SNO);
    };
    const matbord = F => {
      for (let k = 0; k < 9; k++) lagg(box(1.6, 0.035, 0.09), mat.mobel, F, 0, 0.74, -0.4 + k * 0.1);
      [-0.72, 0.72].forEach(x => [-0.36, 0.36].forEach(z => lagg(box(0.06, 0.72, 0.06), mat.mobel, F, x, 0.36, z)));
      [-0.36, 0.36].forEach(z => lagg(box(1.4, 0.07, 0.03), mat.mobel, F, 0, 0.685, z));
      skugga(F, 2.0, 1.3);
      if (T.sno) lagg(rund(1.62, 0.05, 0.9, 0.024, 0.02), mat.textil, F, 0, 0.785, 0, SNO);
    };
    // stol med ribbad rygg; i vintern fårskinn på de första T.fall stolarna, annars snö
    const stol = (F, i) => {
      [-0.2, 0.2].forEach(x => {
        lagg(box(0.04, 0.45, 0.04), mat.mobel, F, x, 0.225, 0.19);
        lagg(box(0.04, 0.9, 0.04), mat.mobel, F, x, 0.45, -0.19);
      });
      for (let k = 0; k < 4; k++) lagg(box(0.44, 0.022, 0.09), mat.mobel, F, 0, 0.44, -0.15 + k * 0.1);
      for (let k = 0; k < 3; k++) lagg(box(0.42, 0.05, 0.02), mat.mobel, F, 0, 0.62 + k * 0.1, -0.2);
      if (T.dyna && !T.sno) lagg(rund(0.42, 0.045, 0.4, 0.018, -0.006), mat.textil, F, 0, 0.475, 0.01, T.dyna);
      if (T.sno || (T.fall && i < T.fall)) {
        if (i < T.fall) {
          lagg(rund(0.46, 0.04, 0.5, 0.018, 0.01), mat.textil, F, 0, 0.47, 0.02, FALL);
          lagg(rund(0.42, 0.36, 0.035, 0.016), mat.textil, F, 0, 0.7, -0.22, FALL);
        } else lagg(rund(0.44, 0.04, 0.42, 0.018, 0.015), mat.textil, F, 0, 0.47, 0, SNO);
      }
    };
    const parasoll = (F, uppe) => {
      lagg(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 8), mat.mobel, F, 0, 1.15, 0);
      if (uppe) {
        lagg(new THREE.ConeGeometry(1.3, 0.34, 8, 1, true), mat.textil, F, 0, 2.24, 0, 0xe6dfd1);
        lagg(new THREE.ConeGeometry(0.06, 0.06, 8), mat.mobel, F, 0, 2.42, 0);
      } else {
        lagg(new THREE.ConeGeometry(0.12, 1.05, 8), mat.textil, F, 0, 1.62, 0, 0xcdc6b8);
        if (T.sno) lagg(new THREE.ConeGeometry(0.075, 0.12, 8), mat.textil, F, 0, 2.13, 0, SNO);
      }
    };
    // växtkort: böjda plan ur atlasen, mörkare nertill (hörnfärg), cell 0–5
    const kort = (F, y, w, h, cell, ry, bojd) => {
      const g = new THREE.PlaneGeometry(w, h, 1, 4); g.translate(0, h / 2, 0);
      const p = g.attributes.position, uv = g.attributes.uv, col = cell % 4, row = Math.floor(cell / 4), c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / h;
        p.setZ(i, bojd * t * t * h);
        uv.setXY(i, (col + 0.02 + uv.getX(i) * 0.96) / 4, 1 - (row + 1) / 2 + (0.02 + uv.getY(i) * 0.96) / 2);
        const f = 0.45 + 0.55 * Math.pow(t, 0.7); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f;
      }
      g.rotateY(ry); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.computeVertexNormals();
      return lagg(g, mat.vaxt, F, 0, y, 0);
    };
    // Prydnadsgräs som riktiga strån (avsmalnande band som böjer sig utåt, mörka vid roten
    // och ljusa i toppen) i stället för korslagda bilder. Går i textilmaterialet (färg i
    // hörnen), så det slås ihop med dynor och krukor: inget nytt ritanrop.
    const gras = (F, y, R, h, vippor) => {
      const r = brus(17 + Math.abs(Math.round(F.a * 31 + F.n * 7))), P = [], C = [];
      const tri = (a, b, c, ca, cb, cc) => { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); C.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]); };
      const stra = (rr, az, len, lut, b, g0, g1, SEG = 4) => {
        const ca = Math.cos(az), sa = Math.sin(az), sx = -sa * b / 2, sz = ca * b / 2;
        let p = [ca * rr, 0, sa * rr], t = lut * 0.35, pw = 1, pc = g0;
        for (let k = 1; k <= SEG; k++) {
          const dl = len / SEG, q = [p[0] + Math.sin(t) * ca * dl, p[1] + Math.cos(t) * dl, p[2] + Math.sin(t) * sa * dl];
          const w = k === SEG ? 0 : 1 - k / SEG * 0.6, f = k / SEG, qc = [g0[0] + (g1[0] - g0[0]) * f, g0[1] + (g1[1] - g0[1]) * f, g0[2] + (g1[2] - g0[2]) * f];
          const a0 = [p[0] - sx * pw, p[1], p[2] - sz * pw], a1 = [p[0] + sx * pw, p[1], p[2] + sz * pw];
          if (!w) tri(a0, a1, q, pc, pc, qc);
          else { const b0 = [q[0] - sx * w, q[1], q[2] - sz * w], b1 = [q[0] + sx * w, q[1], q[2] + sz * w]; tri(a0, a1, b1, pc, pc, qc); tri(a0, b1, b0, pc, qc, qc); }
          p = q; pw = w; pc = qc; t += lut * 0.5;
        }
        return p;
      };
      for (let i = 0; i < 90; i++) {
        const t0 = r();
        stra(Math.sqrt(r()) * R * 0.75, r() * 6.283, h * (0.5 + r() * 0.5), 0.08 + r() * 0.5, 0.014 + r() * 0.014,
          [0.13 + t0 * 0.08, 0.22 + t0 * 0.1, 0.1], vippor ? [0.55 + t0 * 0.1, 0.56, 0.32] : [0.36 + t0 * 0.16, 0.5 + t0 * 0.12, 0.22]);
      }
      // vippor: raka strån med ett ljust ax i toppen
      if (vippor) for (let i = 0; i < 16; i++) {
        const az = r() * 6.283, ax = [0.8, 0.74, 0.56], p = stra(r() * R * 0.5, az, h * (1.0 + r() * 0.25), 0.04 + r() * 0.16, 0.007, [0.3, 0.34, 0.18], [0.62, 0.58, 0.38], 3);
        const ca = Math.cos(az + 1.57) * 0.022, sa = Math.sin(az + 1.57) * 0.022, l = 0.13 + r() * 0.06;
        tri([p[0] - ca, p[1], p[2] - sa], [p[0] + ca, p[1], p[2] + sa], [p[0], p[1] + l, p[2]], ax, ax, ax);
        tri([p[0] - ca, p[1], p[2] - sa], [p[0] + ca, p[1], p[2] + sa], [p[0], p[1] - l * 0.5, p[2]], ax, ax, ax);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
      g.computeVertexNormals();
      return lagg(g, mat.textil, F, 0, y, 0);
    };
    // kruka med kant och synlig jord, mjuk skugga under
    const kruka = (F, R, H, vaxt) => {
      lagg(new THREE.CylinderGeometry(R, R * 0.78, H, 20, 1, true), mat.textil, F, 0, H / 2, 0, T.kruka);
      lagg(new THREE.CircleGeometry(R * 0.78, 16).rotateX(Math.PI / 2), mat.textil, F, 0, 0.004, 0, morkare(T.kruka));
      lagg(new THREE.TorusGeometry(R * 0.985, 0.022, 6, 24).rotateX(Math.PI / 2), mat.textil, F, 0, H - 0.012, 0, morkare(T.kruka, 0.9));
      lagg(new THREE.CircleGeometry(R * 0.95, 20).rotateX(-Math.PI / 2), mat.textil, F, 0, H - 0.04, 0, 0x3a2e24);
      skugga(F, R * 3.2, R * 3.2);
      const y = H - 0.04;
      if (vaxt === 'oliv') {
        // tunn, vriden stam och en lös krona av silvergröna blad
        let ox = 0;
        for (let k = 0; k < 3; k++) { const v = (k % 2 ? 1 : -1) * 0.16; lagg(new THREE.CylinderGeometry(0.022, 0.032, 0.42, 6).rotateZ(v), mat.textil, F, ox - v * 0.21, y + 0.21 + k * 0.4, 0, 0x6a5a48); ox -= v * 0.42; }
        for (let k = 0; k < 4; k++) kort({ a: F.a + ox, n: F.n, r: 0 }, y + 0.95, 1.05, 0.95, 2, k * Math.PI / 4 + 0.3, 0.08);
        for (let k = 0; k < 2; k++) kort({ a: F.a + ox * 0.5, n: F.n, r: 0 }, y + 0.6, 0.75, 0.6, 2, k * Math.PI / 2 + 1.1, 0.1);
        return;
      }
      if (vaxt === 0 || vaxt === 1) { gras(F, y, R, 0.8, vaxt === 1); return; }
      const stor = vaxt === 0 || vaxt === 1 || vaxt === 4;
      const antal = stor ? 5 : 4, w = stor ? 0.9 : 0.62, h = vaxt === 4 ? 0.95 : stor ? 0.85 : 0.45;
      for (let k = 0; k < antal; k++) kort(F, y, w, h, vaxt, k * Math.PI / antal + 0.4 * (k % 2), (k % 2 ? 1 : -1) * (vaxt === 4 ? 0.12 : 0.22));
    };

    // ---- placering: mittstråket från dörren till trappan hålls fritt ----
    const vansterKruka = { a: -(Wd / 2 - 0.36), n: 0.38, r: 0 }, hogerKruka = { a: Wd / 2 - 0.36, n: 0.38, r: 0 };
    kruka(vansterKruka, 0.27, 0.58, T.vaxt[0]);
    kruka(hogerKruka, T.oliv ? 0.3 : 0.27, T.oliv ? 0.55 : 0.58, T.oliv ? 'oliv' : T.vaxt[1]);
    const matsal = Wd * Dd >= 13;
    const bred = Wd >= 3.3;
    if (!matsal) {
      const Ls = Math.max(1.4, Math.min(2.0, Dd - 1.35)), sn = 0.78 + Ls / 2;
      if (T.matta) lagg(rund(bred ? 2.0 : 1.5, 0.008, Ls + 0.3, 0.004), mat.textil, { a: -Wd / 2 + 1.25, n: sn, r: 0 }, 0, 0.004, 0, T.matta);
      soffa({ a: -Wd / 2 + 0.45, n: sn, r: Math.PI / 2 }, Ls);
      soffbord({ a: -Wd / 2 + 1.32, n: sn, r: Math.PI / 2 });
      if (bred && T.eld) eldskal({ a: Wd / 2 - 0.62, n: sn });
      else if (bred) soffa({ a: Wd / 2 - 0.47, n: sn, r: -Math.PI / 2 }, 0.8, T.sno);
    } else {
      const tf = { a: -Wd / 2 + 1.05, n: Dd / 2 + 0.15, r: Math.PI / 2 };
      if (T.matta) lagg(rund(2.0, 0.008, 2.4, 0.004), mat.textil, { a: tf.a, n: tf.n, r: 0 }, 0, 0.004, 0, T.matta);
      matbord(tf);
      [[-0.4, -0.66], [0.4, -0.66], [-0.4, 0.66], [0.4, 0.66]].forEach(([x, z], i) => stol({ a: tf.a + z, n: tf.n - x, r: z < 0 ? Math.PI / 2 : -Math.PI / 2 }, i));
      if (T.parasoll) parasoll({ a: tf.a, n: tf.n, r: 0 }, T.parasoll === 'uppe');
      if (Wd >= 3.6) {
        if (T.eld) eldskal({ a: Wd / 2 - 0.62, n: Dd / 2 + 0.1 });
        else soffa({ a: Wd / 2 - 0.47, n: Dd / 2 + 0.1, r: -Math.PI / 2 }, 0.8, true);
      }
    }
    if (T.vaxt[2] !== undefined && !matsal) kruka({ a: -Wd / 2 + 0.3, n: Dd - 0.28, r: 0 }, 0.2, 0.36, T.vaxt[2]);
    else if (T.vaxt[2] !== undefined) kruka({ a: Wd / 2 - 0.3, n: 1.05, r: 0 }, 0.2, 0.36, T.vaxt[2]);
    function eldskal(F) {
      F.r = 0;
      lagg(new THREE.SphereGeometry(0.32, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.kruka, F, 0, 0.42, 0);
      for (let k = 0; k < 3; k++) { const v = k * 2.09; lagg(box(0.03, 0.16, 0.03), mat.kruka, F, Math.cos(v) * 0.2, 0.08, Math.sin(v) * 0.2); }
      for (let k = 0; k < 3; k++) lagg(new THREE.CylinderGeometry(0.04, 0.045, 0.42, 7).rotateZ(Math.PI / 2).rotateY(k * 1.05), mat.textil, F, 0, 0.36 + k * 0.035, 0, 0x5a4331);
      skugga(F, 0.9, 0.9);
    }

    // lyktpar i ytterhörnet: svart ram, klart glas och ett ljus som lyser på kvällen
    const la = Wd / 2 - 0.42, ln = Dd - 0.38;
    [[0, 0, 1], [0.27, 0.12, 0.78]].forEach(([dx, dz, sk]) => {
      const F = { a: la - dx, n: ln - dz, r: 0.3 };
      lagg(box(0.2 * sk, 0.03, 0.2 * sk), mat.kruka, F, 0, 0.015, 0);
      lagg(box(0.15 * sk, 0.27 * sk, 0.15 * sk), mat.glas, F, 0, 0.03 + 0.135 * sk, 0);
      [-1, 1].forEach(x => [-1, 1].forEach(z => lagg(box(0.016, 0.3 * sk, 0.016), mat.kruka, F, x * 0.085 * sk, 0.03 + 0.15 * sk, z * 0.085 * sk)));
      lagg(box(0.2 * sk, 0.035, 0.2 * sk), mat.kruka, F, 0, 0.05 + 0.3 * sk, 0);
      lagg(new THREE.TorusGeometry(0.035 * sk, 0.007, 6, 12), mat.kruka, F, 0, 0.1 + 0.33 * sk, 0);
      lagg(new THREE.CylinderGeometry(0.03 * sk, 0.03 * sk, 0.09 * sk, 10), mat.lampGlas, F, 0, 0.03 + 0.045 * sk, 0);
      lagg(new THREE.ConeGeometry(0.008 * sk, 0.03 * sk, 6), mat.lampGlas, F, 0, 0.03 + 0.105 * sk, 0);
      skugga(F, 0.4 * sk, 0.4 * sk);
      if (T.sno) lagg(rund(0.21 * sk, 0.025, 0.21 * sk, 0.01, 0.01), mat.textil, F, 0, 0.08 + 0.3 * sk, 0, SNO);
    });

    // vinter: snö i springorna, drivor längs kanterna och mot väggen
    if (T.sno) {
      const g = new THREE.PlaneGeometry(Wd, Dd).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Wd, uv.getY(i) * Dd);
      lagg(g, mat.snoLager, { a: 0, n: Dd / 2, r: 0 }, 0, 0.003, 0);
      lagg(rund(Wd, 0.045, 0.14, 0.02, 0.012), mat.textil, { a: 0, n: Dd - 0.07, r: 0 }, 0, 0.015, 0, SNO);
      [-1, 1].forEach(sx => lagg(rund(0.14, 0.045, Dd - 0.3, 0.02, 0.012), mat.textil, { a: sx * (Wd / 2 - 0.07), n: Dd / 2, r: 0 }, 0, 0.015, 0, SNO));
      lagg(rund(Wd - 0.2, 0.06, 0.2, 0.028, 0.02), mat.textil, { a: 0, n: 0.1, r: 0 }, 0, 0.02, 0, SNO);
    }
    slaIhop(grp);
    grp.visible = !tomt.pa;   // tomt hus: altanens möbler är också borta
    nySkugga = true;
  }

  function byggHus(id) {
    const H = HUS[id];
    const g = new THREE.Group();
    const L = H.L, W = H.W, Y0 = 0.22, OV = 0.32, OG = 0.14, T = 0.17;
    const xw = -L / 2, xe = L / 2, zn = -W / 2, zs = W / 2;
    const xk = H.kupa ? xw + H.kupa.langd : null;

    // sockel: mörk gjuten betong, indragen 6 cm under panelen
    const so = new THREE.Mesh(new THREE.BoxGeometry(L - 0.12, Y0, W - 0.12), mat.sockel);
    so.position.y = Y0 / 2; so.castShadow = true; so.receiveShadow = true; g.add(so);

    const vaggar = new THREE.Group(); vaggar.position.y = Y0; g.add(vaggar);
    const omb = { S: [], N: [], E: [], W: [] };
    H.oppningar.forEach(o => { const k = o.slice(); k.sida = o[0]; k.u0 = o[1]; omb[o[0]].push(k); });
    const hal = s => omb[s].map(o => ({ u0: o.u0, u1: o.u0 + o[2], v0: o[3], v1: o[3] + o[4] }));
    const ned = k => k.map(p => [p[0], p[1] === 0 ? -NED : p[1]]);

    // höjder
    let hN, hS, hR;
    if (H.tak === 'sadel') { hN = H.he; hS = H.he; hR = H.hr; } else { hN = H.hN; hS = H.hS; }

    // Söder: u åt öster
    const sydKontur = H.kupa
      ? [[0, 0], [L, 0], [L, hS], [xk - xw, hS], [xk - xw, H.kupa.hk], [0, H.kupa.hk]]
      : [[0, 0], [L, 0], [L, hS], [0, hS]];
    const mS = vagg(vaggar, new THREE.Vector3(xw, 0, zs), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), ned(sydKontur), hal('S'));
    // Norr: u åt väster
    const mN = vagg(vaggar, new THREE.Vector3(xe, 0, zn), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), ned([[0, 0], [L, 0], [L, hN], [0, hN]]), hal('N'));
    // Öst: u åt norr (vänster = söder)
    const ostKontur = H.tak === 'sadel'
      ? [[0, 0], [W, 0], [W, hN], [W / 2, hR], [0, hS]]
      : [[0, 0], [W, 0], [W, hN], [0, hS]];
    const mE = vagg(vaggar, new THREE.Vector3(xe, 0, zs), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), ned(ostKontur), hal('E'));
    // Väst: u åt söder (vänster = norr)
    const vastKontur = H.tak === 'sadel'
      ? (H.kupa ? [[0, 0], [W, 0], [W, H.kupa.hk], [W / 2, hR], [0, hN]] : [[0, 0], [W, 0], [W, hS], [W / 2, hR], [0, hN]])
      : [[0, 0], [W, 0], [W, hS], [0, hN]];
    const mW = vagg(vaggar, new THREE.Vector3(xw, 0, zn), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), ned(vastKontur), hal('W'));
    // Kupans östvägg ovanför huvudtaket
    if (H.kupa) {
      vagg(vaggar, new THREE.Vector3(xk, 0, zs), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), [[0, hS], [0, H.kupa.hk], [W / 2, hR]], []);
      // utsidan vetter in mot huset (öster om kupan): med fasadens stencilmärke syntes den
      // genom innertaket (inredningen ritas inte där fasaden märkt), se mat.fasadKupa
      vaggar.children[vaggar.children.length - 1].material = mat.fasadKupa;
    }
    // insidan stängd: ett mörkt "tak" i väggtoppen så att man aldrig ser igenom
    const inner = new THREE.Mesh(new THREE.BoxGeometry(L - 0.02, 0.02, W - 0.02), mat.insida);
    inner.position.set(0, Math.min(hN, hS) - 0.02, 0); vaggar.add(inner);

    // droppbleck runt om där panelen slutar över sockeln
    const yd = -NED + 0.008;
    kloss(vaggar, L + 0.07, 0.034, 0.036, 0, yd, zs + 0.012, mat.detaljMork);
    kloss(vaggar, L + 0.07, 0.034, 0.036, 0, yd, zn - 0.012, mat.detaljMork);
    kloss(vaggar, 0.036, 0.034, W + 0.07, xe + 0.012, yd, 0, mat.detaljMork);
    kloss(vaggar, 0.036, 0.034, W + 0.07, xw - 0.012, yd, 0, mat.detaljMork);

    // hörnbrädor: två brädor per hörn som bildar ett L
    const KB = 0.12, KT = 0.024, yb0 = -NED + 0.025;
    const horn = (sx, sz, y0, y1) => {
      const cx = sx * L / 2, cz = sz * W / 2, hh = y1 - y0, yc = (y0 + y1) / 2;
      kloss(vaggar, KB + KT, hh, KT, cx - sx * KB / 2 + sx * KT / 2, yc, cz + sz * KT / 2, mat.detalj);
      kloss(vaggar, KT, hh, KB, cx + sx * KT / 2, yc, cz - sz * KB / 2, mat.detalj);
    };
    horn(1, 1, yb0, hS); horn(1, -1, yb0, hN); horn(-1, -1, yb0, hN);
    horn(-1, 1, yb0, H.kupa ? H.kupa.hk : hS);
    if (H.kupa) {
      const hh = H.kupa.hk - hS, yc = (H.kupa.hk + hS) / 2;
      kloss(vaggar, KT, hh, KB, xk + KT / 2, yc, zs - KB / 2, mat.detalj);
      kloss(vaggar, KB + KT, hh, KT, xk - KB / 2 + KT / 2, yc, zs + KT / 2, mat.detalj);
    }

    const mtxer = { S: mS, N: mN, E: mE, W: mW };
    fonsterBygg = [];
    Object.keys(omb).forEach(s => omb[s].forEach(o => oppning(vaggar, mtxer[s], o)));
    const ute = new THREE.Group(); ute.position.y = Y0; g.add(ute);
    const ut = utsida(vaggar, ute, H, omb, mtxer, { Y0, L, W, hN, hS, xw, xe, xk });
    const glod = ut.glod, al = ut.altan;
    // husets utbredning med altanen, för skuggkameran
    const ext = { x0: -L / 2 - 0.6, x1: L / 2 + 0.6, z0: -W / 2 - 0.6, z1: W / 2 + 0.6 };
    if (al) { ext.x0 = Math.min(ext.x0, al.x0); ext.x1 = Math.max(ext.x1, al.x1); ext.z0 = Math.min(ext.z0, al.z0); ext.z1 = Math.max(ext.z1, al.z1); }

    // tak
    const tak = new THREE.Group(); tak.position.y = Y0; g.add(tak);
    // Stuprörens plats vid varje hörn: på långväggen strax innanför hörnbrädan, annars runt
    // hörnet på gaveln, annars längre in på långväggen. Aldrig framför fönster, dörrar,
    // dörrlampan, trappsteg eller altanen (röret och utkastaren går hela vägen till marken).
    const RP = 0.04, KANT = KB + KT + RP + 0.025, alS = altanMatt(H, omb, { L, W });
    const fritt = (s, u) => !omb[s].some(o => {
      const m = o[5] === 'f' ? 0.14 : 0.45;
      return u + RP > o.u0 - m && u - RP < o.u0 + o[2] + m;
    }) && !(alS && alS.sida === s && u + RP > alS.u0 - 0.15 && u - RP < alS.u1 + 0.15);
    const stup = (sida, sx, xmin = xw, xmax = xe) => {
      const sz = sida === 'S' ? 1 : -1, uL = x => sida === 'S' ? x - xw : xe - x;
      let x = sx * (L / 2 - KANT);
      if (fritt(sida, uL(x))) return x;
      const gs = sx > 0 ? 'E' : 'W', z = sz * (W / 2 - KANT);
      if (fritt(gs, gs === 'E' ? zs - z : z - zn)) return { x: sx * (L / 2 + 0.035 + RP), z, nx: sx };
      for (let d = KANT + 0.05; d < L; d += 0.05) { x = sx * (L / 2 - d); if (x < xmin + KANT || x > xmax - KANT) break; if (fritt(sida, uL(x))) return x; }
      return sx * (L / 2 - KANT);
    };
    if (H.tak === 'sadel') {
      takskiva(tak, xw - OG, xe + OG, [zn, hN], [0, hR], T, OV, { ranna: true, stupror: [stup('N', -1), stup('N', 1)], snoskydd: H.snoskydd, y0: Y0 });   // norr
      if (H.kupa) {
        takskiva(tak, xk, xe + OG, [zs, hS], [0, hR], T, OV, { ranna: true, stupror: [stup('S', 1, xk, xe)], utanVind: -1, y0: Y0 });  // söder, efter kupan
        takskiva(tak, xw - OG, xk + 0.12, [zs, H.kupa.hk], [0, hR], T, OV * 0.7, { ranna: true, stupror: [stup('S', -1, xw, xk)], y0: Y0 }); // kupans tak
      } else {
        takskiva(tak, xw - OG, xe + OG, [zs, hS], [0, hR], T, OV, { ranna: true, stupror: [stup('S', -1), stup('S', 1)], snoskydd: H.snoskydd, y0: Y0 });
      }
      // nockplåt: två plåtar som följer takfallen
      const nockbit = (x0, x1, fot, sz) => {
        const th = Math.atan((hR - fot) / (W / 2));
        const y = hR + T / Math.cos(th) + 0.036;
        const m = kloss(tak, x1 - x0, 0.012, 0.17, (x0 + x1) / 2, y - Math.sin(th) * 0.085, sz * Math.cos(th) * 0.085, mat.falsar);
        m.rotation.x = sz * th;
      };
      const xA = xw - OG - VT - 0.01, xB = xe + OG + VT + 0.01;
      nockbit(xA, xB, hN, -1);
      if (H.kupa) { nockbit(xA, xk + 0.12 + VT, H.kupa.hk, 1); nockbit(xk + 0.12 + VT, xB, hS, 1); }
      else nockbit(xA, xB, hS, 1);
    } else {
      takskiva(tak, xw - OG, xe + OG, [zn - 0.0, hN], [zs + OV, hS + (hS - hN) / W * OV], T, OV, { ranna: true, stupror: [stup('N', -1), stup('N', 1)], hogKant: true, y0: Y0 });
    }

    // sätt ihop och centrera på marken
    try { slaIhop(vaggar); } finally { var fonster = fonsterBygg || []; fonsterBygg = null; }
    // fasaden först, så att dess stencilmärke finns när inredningen ritas (se mat.fasad)
    vaggar.children.forEach(m => { if (m.isMesh && m.material === mat.fasad) m.renderOrder = -1; });
    slaIhop(tak);
    slaIhop(ute);
    g.userData = { fonster, L, W, hojd: Y0 + (hR || hS) + T, glod, lyktGlod: al && al.glod, ext, delar: { so, vaggar, tak, ute, Y0, hN, hS, hR: hR || Math.max(hN, hS) } };
    return g;
  }

  // ---- Mått ----
  function etikett(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,.94)';
    x.beginPath(); x.roundRect(8, 18, 240, 60, 30); x.fill();
    x.fillStyle = '#1b1915'; x.font = '600 34px Poppins, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 49);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(2.2, 0.82, 1); s.renderOrder = 10;
    return s;
  }
  function mattLinje(grupp, a, b, text, ut) {
    const lm = new THREE.LineBasicMaterial({ color: 0x1b1915, transparent: true, opacity: 0.75, depthTest: false });
    const pts = [a, b];
    const tick = (p) => [p.clone().addScaledVector(ut, -0.18), p.clone().addScaledVector(ut, 0.18)];
    [pts, tick(a), tick(b)].forEach(p => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), lm); l.renderOrder = 9; grupp.add(l); });
    const e = etikett(text); e.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(new THREE.Vector3(0, 1, 0), 0.3); grupp.add(e);
  }
  function byggMatt(H, hojd) {
    const g = new THREE.Group();
    const L = H.L, W = H.W, y = 0.03, d = 0.9;
    const fmt = v => v.toFixed(1).replace('.', ',') + ' m';
    mattLinje(g, new THREE.Vector3(-L / 2, y, W / 2 + d), new THREE.Vector3(L / 2, y, W / 2 + d), fmt(L), new THREE.Vector3(1, 0, 0));
    mattLinje(g, new THREE.Vector3(L / 2 + d, y, W / 2), new THREE.Vector3(L / 2 + d, y, -W / 2), fmt(W), new THREE.Vector3(0, 0, 1));
    mattLinje(g, new THREE.Vector3(L / 2 + d, 0, -W / 2 - d * 0.2), new THREE.Vector3(L / 2 + d, hojd, -W / 2 - d * 0.2), 'Nock ' + fmt(hojd), new THREE.Vector3(1, 0, 0));
    return g;
  }

  // ---- Färger, sol och kvällsljus ----
  function satFarger() {
    const H = HUS[val.modell];
    const f = FARGER.fasad[val.fasad || H.farg.fasad][1];
    const t = FARGER.tak[val.tak || H.farg.tak][1];
    const d = FARGER.detalj[val.detalj || H.farg.detalj][1];
    // färgerna tonar över i stället för att hoppa
    // färgprovets hex är skärmfärg; i dagsljus blir den för mättad, så den dämpas något
    malFarg.fasad.set(f); dampa(malFarg.fasad, 0.88); malFarg.fasadKupa.copy(malFarg.fasad);
    malFarg.tak.set(t); dampa(malFarg.tak, 0.78);
    malFarg.falsar.copy(malFarg.tak).offsetHSL(0, 0, 0.06);
    malFarg.takMork.copy(malFarg.tak).offsetHSL(0, 0, -0.07);
    malFarg.detalj.set(d); dampa(malFarg.detalj, 0.9);
    malFarg.detaljMork.copy(malFarg.detalj).offsetHSL(0, 0, -0.1);
    malFarg.stupror.copy(malFarg.falsar);   // ränna och stuprör i takets plåt, som på produktbilderna
    // takutsprångets undersida målas som vindskivorna och takfotsbrädan: i ljust krämvitt syntes den
    // som en vit strimma mellan gavelns överkant och vindskivan (bara på den bortre sluttningen)
    malFarg.takUnder.copy(malFarg.detalj);
    tonar = true;
    begarRender();
  }
  const hsl = { h: 0, s: 0, l: 0 };
  function dampa(c, k) { c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * k, hsl.l); return c; }
  const malFarg = { fasad: new THREE.Color(), fasadKupa: new THREE.Color(), tak: new THREE.Color(), falsar: new THREE.Color(), takMork: new THREE.Color(), detalj: new THREE.Color(), detaljMork: new THREE.Color(), stupror: new THREE.Color(), takUnder: new THREE.Color() };
  let tonar = false, forstaFarg = true;
  function tonaFarger(f) {
    if (!tonar) return false;
    let kvar = false;
    const k = 1 - Math.pow(0.86, f);
    for (const n in malFarg) {
      const c = mat[n].color;
      if (forstaFarg) { c.copy(malFarg[n]); continue; }
      c.lerp(malFarg[n], k);
      if (Math.abs(c.r - malFarg[n].r) + Math.abs(c.g - malFarg[n].g) + Math.abs(c.b - malFarg[n].b) > 0.004) kvar = true;
      else c.copy(malFarg[n]);
    }
    forstaFarg = false;
    tonar = kvar;
    return kvar;
  }

  // Skuggkameran läggs tätt runt huset sett från solen: skarpare och billigare
  const horn8 = Array.from({ length: 8 }, () => new THREE.Vector3());
  function passaSkugga() {
    if (!husGrupp) return;
    const { hojd, ext } = husGrupp.userData, m = 3.4;
    sk.position.copy(sol.position); sk.lookAt(sol.target.position); sk.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = horn8[i].set(i & 1 ? ext.x1 + m : ext.x0 - m, i & 2 ? hojd + 0.2 : 0, i & 4 ? ext.z1 + m : ext.z0 - m).applyMatrix4(sk.matrixWorldInverse);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); z0 = Math.min(z0, -p.z); z1 = Math.max(z1, -p.z);
    }
    // near nära solen (inte 2 m före huset): allt som står mellan solen och huset (träd, buskar,
    // möbler) kastar då hela sin skugga. Med near strax före huset klipptes kastarna och deras
    // skuggor slutade tvärt, som tunna avhuggna streck på fasaden.
    sk.left = x0; sk.right = x1; sk.bottom = y0; sk.top = y1; sk.near = 0.5; sk.far = z1 + 30;
    sk.updateProjectionMatrix();
  }

  // Ljuset för läget (ute/inne) utifrån det solen just räknat fram
  const ljus = { kvall: 0, env: 0.9, him: 0.42, lag: 0, sol: 3.2 };
  // Snö och löv får inte falla inne: miljön får veta när man står inne eller har taket av
  let miljoInne = false;
  function satMiljoInne() {
    const v = !!(inneLage || oppen.pa || oppen.t > 0);
    if (v === miljoInne) return;
    miljoInne = v;
    try { if (omgivning && typeof omgivning.uppdatera === 'function') omgivning.uppdatera({ inne: v }); } catch (e) { console.warn(e); }
  }
  function lageLjus() {
    const k = ljus.kvall;
    satMiljoInne();
    // Inifrån: glaset nästan helt klart med svag spegling och svag fresnel, så att
    // trädgården syns som genom riktigt glas. Exponeringen hålls nere en aning så att
    // utsikten inte bränns ut; rummet bärs av sin egen AO och lampan.
    // inne på dagen: lägre exponering och mer ljus i rummet, så att utsikten inte bränns ut
    // medan rummet blir lika ljust; på kvällen går exponeringen upp till fullt
    renderer.toneMappingExposure = inneLage ? EXPO * (0.88 + k * 0.16) : EXPO * (1 - k * 0.06);
    scene.environmentIntensity = inneLage ? 0.9 : ljus.env;
    himmel.intensity = inneLage ? ljus.him * 1.3 : ljus.him;
    // utifrån: speglande glas som ändå släpper in blicken (0,42 dag, tunnare på kvällen)
    // på natten: miljön dras ned för hela scenen, men glaset behåller en (dämpad) spegling
    // med fresnel, så att fönstren inte blir svarta hål
    // inifrån på kvällen: rutan blir ett mörkblått fönster mot natten med lampornas
    // glans och en svag varm ton (rummets egen spegling), utan någon extra rendering
    mat.glas.opacity = inneLage ? 0.1 + k * 0.14 : 0.42 - k * 0.14;
    glasEnv.value = inneLage ? 1 : 1 + k * 0.9;
    mat.glas.envMapIntensity = inneLage ? 0.15 + k * 0.35 : 1;
    if (inneLage) mat.glas.color.setHex(0x26323a).lerp(GLAS_NATT, k); else mat.glas.color.setHex(0x172028);
    mat.glas.emissiveIntensity = inneLage ? k * 0.018 : k * 0.03;
    // frostat glas: mörknar med natten (inifrån är det mörkt ute bakom), utifrån bara ett svagt varmt sken
    mat.frostGlas.color.setHex(0xdfe3e1).lerp(FROST_NATT, k);
    mat.frostGlas.envMapIntensity = 1 - k * 0.85;
    mat.frostGlas.emissive.setHex(0xffb05e); mat.frostGlas.emissiveIntensity = inneLage ? 0 : k * 0.05;
    glasSpeg.value = inneLage ? 0.35 + k * 0.45 : 2.6 - k * 0.8;
    glasFres.value = inneLage ? 0.3 : 0.9;
    // Den riktiga inredningen syns genom fönstren så fort den är byggd (och kameran
    // är närmare än 35 m). Lådorna bakom glaset finns bara kvar tills dess.
    const ig = husGrupp && husGrupp.userData.inne, dock = oppen.pa || oppen.t > 0;
    const synsInne = inneLage || dock || (!!ig && !inneLangt);
    // längre bort än ca 14 m syns lådorna bakom glaset i stället för inredningen (färre ritanrop)
    mat.rum.visible = !inneLage && !dock && (!ig || inneLangt);
    mat.insida.visible = !synsInne;
    mat.takUnder.visible = !inneLage && !dock;
    if (ig) ig.visible = synsInne;
    // dörrarna och lamporna läses in så fort inredningen finns (lamporna styrs sedan av motorn)
    if (ig) { try { iaData(); iaSynlighet(); } catch (e) { console.warn(e); } }
    // inifrån syns inte yttertaket (taket, rännorna och stuprören ligger på lager 1, se ram):
    // färre ritanrop inne, och utifrån ritas det som förut
    if (husGrupp && !husGrupp.userData.takLager) {
      husGrupp.userData.delar.tak.traverse(o => { if (o.isMesh) o.layers.set(1); });
      husGrupp.userData.takLager = true;
    }
    kamera.layers.mask = inneLage ? 1 : 3;
    // det fasta punktljuset i allrummet: varmt på kvällen, även sett utifrån
    // inne: punktljuset och himmelsljuset fyller på när solen står lågt (morgon) eller det är kväll
    // Inne på kvällen: kontrasten kommer från lamporna. Himmel, miljö och sol dras ned
    // nästan helt, så att hörnen långt från lamporna blir mörka i stället för bruna.
    if (inneLage) {
      satLampLjus();   // tända lampor (eller kvällen, utan lampor från inredningen)
      // natt: miljön och himlen nästan borta (mörka hörn), studsen från golvet neutralt grå
      // i stället för beige (det gav en brun ton över allt); lamporna bär rummet
      scene.environmentIntensity = 0.9 * (1 - k * 0.74);   // lite studs kvar: skåpgavlar på skuggsidan blir inte helsvarta
      himmel.intensity = ljus.him * 1.3 * (1 - k * 0.75) + ljus.lag * (1 - k) * 0.34;
      // låg sol (morgon, gyllene timmen): varmt ljus från fönstren; kväll: mörkblå natt
      // uppåt, lampornas studs från golvet nedåt (taket)
      himmel.color.copy(HIM_DAG).lerp(HIM_GYLLEN, ljus.lag * 0.6 * (1 - k)).lerp(HIM_KVALL, k).multiplyScalar(1 - k * 0.55);
      himmel.groundColor.copy(HIM_INNE).lerp(STUDS, k * (1 - k)).lerp(NATT_GOLV, mjuk(0.5, 1, k));
      sol.intensity = ljus.sol * (1 - k * 0.85);
    } else {
      // varma rum bakom glaset; i dockskåpet (taket av) lyser rummen av sina egna lampor:
      // punktljuset vid allrummets lampa och ett vid loftets, i stället för en jämn väggglöd
      inneLjus.intensity = ig ? k * 3 : 0;
      himmel.color.copy(HIM_DAG).lerp(HIM_GYLLEN, ljus.lag * 0.35 * (1 - k) + (ljus.gry || 0) * 0.3).lerp(HIM_KVALL, k);
      himmel.groundColor.copy(HIM_MARK).multiplyScalar(1 - k * 0.5);
      inneSpot.intensity = 0; inneLjus2.intensity = 0; inneLjus3.intensity = 0;
      if (dock && ig) dockLjus(k);
      inneLjus.color.copy(LJ_DAG).lerp(LJ_2700, k);
      sol.intensity = ljus.sol;
    }
    nattInne(synsInne ? k : 0, !inneLage && !dock);   // ingen väggglöd i dockskåpet (gav platt laxrosa)
    mat.spill.opacity = inneLage ? 0 : k * 0.85; mat.spill.visible = mat.spill.opacity > 0.01;
    mat.lampKon.opacity = inneLage ? 0 : lampSken * 0.55; mat.lampKon.visible = mat.lampKon.opacity > 0.01;
    if (husGrupp && husGrupp.userData.glod) husGrupp.userData.glod.visible = !inneLage && lampSken > 0.01;
    if (husGrupp && husGrupp.userData.lyktGlod) husGrupp.userData.lyktGlod.visible = lampSken > 0.01;
    satHalo(synsInne ? k : 0);
  }
  // Dockskåpet på kvällen: allrummets punktljus vid sin lampa, loftets (inneLjus3) vid den
  // högst sittande lampan. Ljusen finns redan i scenen, så inget kompileras om.
  function dockLjus(k) {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.delar) return;
    const Y0 = d.delar.Y0 || 0;
    if (d.lampPos) inneLjus.position.copy(d.lampPos).y += Y0;
    let ut = null;
    try { ut = iaData(); } catch (e) { ut = null; }
    const loft = ut && ut.lampor ? ut.lampor.filter(L => L && L.pos && L.pos[1] > 2.2).sort((a, b) => b.pos[1] - a.pos[1])[0] : null;
    if (loft) { inneLjus3.position.set(loft.pos[0], loft.pos[1] + Y0 - 0.12, loft.pos[2]); inneLjus3.intensity = k * 1.6; }
    inneLjus.color.copy(LJ_DAG).lerp(LJ_2700, Math.min(1, k * 1.2));
    inneLjus3.color.copy(inneLjus.color);
  }

  // Inredningens kvällsljus utan nya ljus: lampornas material lyser (lampMaterial från
  // inredningen om det finns) och ljusa väggar får en svag varm egenglöd. Bara uniformer
  // ändras, så inget kompileras om.
  // Väggglöden används bara sett utifrån (rummen bakom glaset lyser). Inifrån ger den
  // en enhetlig brun ton över allt, eftersom egenglöd inte påverkas av hörnmörkret.
  const GLAS_NATT = new THREE.Color(0x0d1624);
  const FROST_NATT = new THREE.Color(0x4a4845);
  const VARM = new THREE.Color(0xffb878), LAMPVIT = new THREE.Color(0xffe6cc), SKARMVIT = new THREE.Color(0xffdcb4);
  function nattInne(k, vaggGlod = true) {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.inne) return;
    if (!d.inneMat) {
      const ud = d.inne.userData, lampor = new Set(), sett = new Set(), lista = [];
      const skarm = ud.skarmMaterial;
      if (skarm) sett.add(skarm);   // skärmarna följer lampan (inredningen räknar ×0,22)
      [ud.lampMaterial, ud.lampMaterials, ud.lampMat, ud.lampor].forEach(x => {
        (Array.isArray(x) ? x : [x]).forEach(m => { if (m && m.isMaterial && m.emissive) lampor.add(m); });
      });
      d.inne.traverse(o => {
        if (!o.isMesh) return;
        o.receiveShadow = true;   // solen genom fönstren landar på golv och möbler
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (!m || sett.has(m) || !m.emissive) return;
          sett.add(m);
          const lampa = lampor.has(m);
          const lum = m.color ? m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11 : 0;
          if (!lampa && (lum < 0.4 || m.transparent || m.emissive.getHex() !== 0)) return;
          lista.push({ m, lampa, e0: m.emissive.clone(), i0: m.emissiveIntensity });
        });
      });
      lampor.forEach(m => { if (!sett.has(m)) lista.push({ m, lampa: true, e0: m.emissive.clone(), i0: m.emissiveIntensity }); });
      d.inneMat = lista;
    }
    const sk = d.inne.userData.skarmMaterial;
    if (sk && sk.emissive && !sk.userData.styrd) {
      const lm = d.inne.userData.lampMaterial; sk.emissiveIntensity = (lm && tal(lm.emissiveIntensity) ? k * 2.5 : 0) * 0.22;
      if (!sk.userData.motorE0) sk.userData.motorE0 = sk.emissive.clone();
      sk.emissive.copy(k > 0.001 ? SKARMVIT : sk.userData.motorE0);
    }
    d.inneMat.forEach(x => {
      if (x.m.userData.motorStyrd) return;   // dörrarnas kopior och de egna lamporna
      if (x.lampa) {
        x.m.emissive.copy(k > 0.001 ? LAMPVIT : x.e0);
        x.m.emissiveIntensity = k * 2.5;
      } else if (k > 0.001 && vaggGlod) { x.m.emissive.copy(x.m.color).multiply(VARM); x.m.emissiveIntensity = k * 0.11; }
      else { x.m.emissive.copy(x.e0); x.m.emissiveIntensity = x.i0; }
    });
  }

  // ---- Glorian runt lampor och ljus: ett enda Points-anrop per hus, bara på kvällen ----
  // Mjuk additiv gloria (som bloom, utan efterbehandling) runt varje egen lampa och runt
  // de små lysande klungorna (stearinljusen på borden). Ljusen fladdrar svagt, men bara när
  // livet går (uTid ändras i ram); annars står glorian still och kostar ingenting.
  const HALO_MAT = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uTid: { value: 0 }, uH: { value: 900 } },
    vertexShader: `attribute float aS; attribute float aFl; attribute float aI; attribute float aFas; attribute float aDr;
      uniform float uTid; uniform float uH; varying float vI;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = length(mv.xyz);
        mv.xyz *= max(0.0, 1.0 - aDr / max(d, 0.2));   // en bit mot kameran (0,12 m): skärmen skymmer inte allt; en opalglob lyser själv och ska inte skymma sin gloria
        gl_Position = projectionMatrix * mv;
        float fl = 1.0 + aFl * (0.09 * sin(uTid * 9.3 + aFas) + 0.05 * sin(uTid * 21.7 + aFas * 1.7) + 0.03 * sin(uTid * 41.0 + aFas * 3.1));
        vI = aI * fl;
        gl_PointSize = min(uH * 0.45, aS * fl * projectionMatrix[1][1] * uH * 0.5 / max(0.05, -mv.z));
      }`,
    fragmentShader: `uniform float uK; varying float vI;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c);
        if (r > 1.0) discard;
        float a = (exp(-r * 4.5) - 0.011) * 0.55 + exp(-r * 22.0) * 0.45;
        gl_FragColor = vec4(vec3(1.0, 0.70, 0.40) * a * vI * uK, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const haloStorlek = new THREE.Vector2();
  function byggHalo() {
    const d = husGrupp && husGrupp.userData, ig = d && d.inne;
    if (!ig) return null;
    if (d.halo !== undefined) return d.halo;
    d.halo = null;
    const ut = iaData(), P = [], S = [], F = [], I = [], A = [], DR = {};
    let r = 1;
    const slump = () => ((r = (r * 16807) % 2147483647) / 2147483647) * 6.283;
    (ut ? ut.lampor : []).forEach(L => {
      if (!L) return;
      // inredningen kan ange egna glorior [x, y, z, storlek] (spotarna var för sig, ingen mitt på spegeln)
      const pk = L.halo || [[L.pos[0], L.pos[1] - 0.04, L.pos[2], 0.7]];
      L.haloI = [];
      pk.forEach(p => { if (p.length > 4) DR[P.length / 3] = p[4]; L.haloI.push(P.length / 3); P.push(p[0], p[1], p[2]); S.push(p[3]); F.push(0); I.push(L.t * L.t * (3 - 2 * L.t)); A.push(slump()); });
    });
    // stearinljusens lågor och kaminens eld från inredningen: fladdrande gloria
    const lagor = [];
    (Array.isArray(ig.userData.ljusLagor) ? ig.userData.ljusLagor : []).forEach(l => {
      if (l && Array.isArray(l.pos)) { lagor.push(l.pos); if (tomt.pa && l.los) return; P.push(l.pos[0], l.pos[1] + 0.01, l.pos[2]); S.push(0.24); F.push(1); I.push(0.85); A.push(slump()); }
    });
    const eld = ig.userData.eld;
    if (eld && Array.isArray(eld.pos)) { lagor.push(eld.pos); P.push(eld.pos[0], eld.pos[1], eld.pos[2]); S.push(0.9); F.push(1.6); I.push(0.9); A.push(slump()); }
    let K = [];
    try { K = lampKlungor(); } catch (e) { K = []; }
    K.forEach(c => {
      if (ut && (ut.allaLampor || ut.lampor).some(L => L && Math.hypot(L.pos[0] - c.x, L.pos[1] - c.y, L.pos[2] - c.z) < 0.35)) return;
      if (tomt.pa && c.los) return;   // tomt hus: lösa lampors klungor lyser inte
      if (lagor.some(p => Math.hypot(p[0] - c.x, p[1] - c.y, p[2] - c.z) < 0.2)) return;
      // små och låga (ljus på bord och hyllor) fladdrar; högre klungor är lampor och står still
      const fy = c.y > 2.3 ? c.y - 2.3 : c.y;   // loftets golv ligger ungefär 2,3 m upp
      const ljus = fy < 1.4;
      P.push(c.x, c.y + (ljus ? 0.02 : 0), c.z); S.push(ljus ? 0.26 : 0.6); F.push(ljus ? 1 : 0); I.push(ljus ? 0.8 : 1); A.push(slump());
    });
    if (!P.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
    const dr = new Float32Array(S.length).fill(0.12);
    Object.keys(DR).forEach(i => { dr[i] = DR[i]; });
    g.setAttribute('aDr', new THREE.Float32BufferAttribute(dr, 1));
    g.setAttribute('aFl', new THREE.Float32BufferAttribute(F, 1));
    g.setAttribute('aI', new THREE.Float32BufferAttribute(I, 1));
    g.setAttribute('aFas', new THREE.Float32BufferAttribute(A, 1));
    const pt = new THREE.Points(g, HALO_MAT);
    pt.name = 'halo'; pt.renderOrder = 6; pt.castShadow = pt.receiveShadow = false; pt.visible = false;
    ig.add(pt);
    return (d.halo = pt);
  }
  function satHalo(k) {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.inne) return;
    const pa = k > 0.02;
    // levande ljus: släckta på dagen, tänds i skymningen
    (Array.isArray(d.inne.userData.ljusLagor) ? d.inne.userData.ljusLagor : []).forEach(l => { if (l && l.mesh && l.mesh.isObject3D) l.mesh.visible = pa; });
    const h = pa ? byggHalo() : d.halo;
    if (!h) return;
    h.visible = pa;
    HALO_MAT.uniforms.uK.value = mjuk(0.05, 0.85, k) * (inneLage ? 1 : 0.8);
    renderer.getDrawingBufferSize(haloStorlek); HALO_MAT.uniforms.uH.value = haloStorlek.y;
  }
  function haloLampa(L) {
    const h = husGrupp && husGrupp.userData.halo;
    if (!h || !Array.isArray(L.haloI) || !L.haloI.length) return;
    const a = h.geometry.attributes.aI, e = L.t * L.t * (3 - 2 * L.t);
    L.haloI.forEach(j => { a.array[j] = e; }); a.needsUpdate = true;
  }

  // tid 6–22: solen går från öster över söder till väster
  function satSol() {
    const t = Math.min(1, Math.max(0, (val.tid - 6) / 16));
    const az = Math.PI * (0.15 + t * 0.95);             // öst -> väst via söder
    // solen går ned strax efter halv nio; timmen före är gyllene
    const hojd = Math.sin(Math.PI * Math.min(1, Math.max(0, t * 1.1)));
    const elev = 0.08 + hojd * 0.85;
    const r = 30;
    sol.position.set(Math.cos(az) * r * Math.cos(elev), Math.sin(elev) * r, Math.sin(az) * r * Math.cos(elev));
    sol.target.position.set(0, 0, 0);
    // skymningen 18:30–21:15 (lamporna tänds vid 19:40), sedan natt
    const kvall = Math.max(0, Math.min(1, (val.tid - 18.5) / 2.75));
    // lågt stående sol är varm och svagare; mitt på dagen nästan vit
    const lag = 1 - mjuk(0.1, 0.9, elev);
    // gryningen (6–8:30): rosa-persika himmel och dis i miljön, mjukare miljöljus
    const gry = 1 - mjuk(6, 8.5, val.tid);
    // gyllene timmen: tydligt varmt släpljus; kvällsdämpningen börjar först efter solnedgången
    sol.color.copy(SOL_DAG).lerp(SOL_LAG, lag).lerp(SOL_LAG, mjuk(0, 0.4, kvall)).lerp(SOL_KVALL, kvall * 0.5);
    sol.intensity = 3.5 * (0.55 + 0.45 * mjuk(0.06, 0.6, elev)) * (1 - mjuk(0.35, 1, kvall) * 0.85);
    // natten: från kvall 0,6 tar en kall måne över (35° upp i sydost, styrka 0,5–0,7), så att
    // huset har form och skugga i stället för ett orange sken längs marken
    const mane = mjuk(0.6, 1, kvall);
    if (mane > 0) {
      const mAz = Math.PI * 0.38, mEl = 35 * Math.PI / 180;
      manePos.set(Math.cos(mAz) * r * Math.cos(mEl), Math.sin(mEl) * r, Math.sin(mAz) * r * Math.cos(mEl));
      sol.position.lerp(manePos, mane).setLength(r);
      sol.color.lerp(MANE, mane);
      sol.intensity = sol.intensity * (1 - mane) + (0.5 + 0.2 * mane) * mane;
    }
    himmel.color.copy(HIM_DAG).lerp(HIM_GYLLEN, lag * 0.35 * (1 - kvall) + gry * 0.3).lerp(HIM_KVALL, kvall);
    himmel.groundColor.copy(inneLage ? HIM_INNE : HIM_MARK).multiplyScalar(1 - kvall * 0.5);
    sol.shadow.bias = inneLage ? -0.0006 : -0.00025; sol.shadow.normalBias = inneLage ? 0.045 : 0.035;
    // natten: miljökartan är dagshimlen, så den dras ned nästan helt (plåt och glas lyste blågrått)
    ljus.lag = lag; ljus.kvall = kvall; ljus.gry = gry; ljus.him = Math.max(0.3, 0.42 - kvall * 0.14); ljus.env = Math.max(0.12, 0.95 - kvall * 0.8 - gry * 0.25); ljus.sol = sol.intensity;
    // kvällen: rummen bakom glaset lyser varmt
    // vägglampan vid entrén tänds i skymningen; skenet är en additiv bild, inget ljus
    lampSken = mjuk(0.3, 0.65, kvall);
    lamporFoljTid();
    mat.lampGlas.emissiveIntensity = lampSken * 2.6;
    if (husGrupp && husGrupp.userData.glod) husGrupp.userData.glod.material.opacity = lampSken * 0.75;
    if (husGrupp && husGrupp.userData.lyktGlod) husGrupp.userData.lyktGlod.material.opacity = lampSken * 0.8;
    mat.pol.opacity = lampSken * 0.5; mat.pol.visible = lampSken > 0.01;
    mat.rum.emissiveIntensity = kvall * 0.75;
    mat.rum.color.copy(RUM_DAG).lerp(RUMSLJUS, kvall);
    lageLjus();
    passaSkugga();
    nySkugga = true;
    omgivning.uppdatera({ kvall, gryning: gry, mork: morktTema, sol: sol.position.clone().normalize(), inne: miljoInne });
    begarRender();
    if (alternativ.vidKvall) alternativ.vidKvall(kvall);
  }

  function sluta(grupp) {
    scene.remove(grupp);
    slappSpeglar(grupp.userData);
    if (grupp.userData.takKlon) { grupp.userData.takKlon.forEach(c => c.dispose()); grupp.userData.takKlon = null; }
    if (grupp === husGrupp) oppen.lana = null;
    if (grupp.userData.ydorr) { grupp.userData.ydorr.kopior.forEach(m => m.dispose()); grupp.userData.ydorr = null; }
    // dörrarnas och lampornas materialkopior (klonaMat, inredningens egna per lampa) och
    // de hopslagna lamporna utifrån: släpps med huset
    const ut = grupp.userData.ia;
    if (ut) {
      ut.opp.forEach(o => { if (o && o.mats) o.mats.forEach(x => x.m.dispose()); });
      ut.lampor.forEach(L => { if (L && L.mats) L.mats.forEach(m => m.dispose()); });
      (ut.uteMesh || []).forEach(m => m.material.dispose());
      ut.uteMesh = []; grupp.userData.ia = null;
    }
    grupp.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.isSprite || o.isLine) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  function satMiljo() {
    vakna();
    snoU.value = miljoNamn === 'vinter' ? 1 : 0;
    omgivning.satt(miljoNamn, HUS[val.modell]);
    scene.environment = himmelEnv(miljoNamn);
  }
  function visa(id, montera = true) {
    vakna();
    planBryt();
    flygAvbryt(false);
    if (inneLage) inne(false);
    // dockskåpet stängs helt på det gamla huset (taket på plats, skuggranden och stuprören
    // tillbaka); förut låg skuggranden kvar osynlig på nästa hus om man bytte medan det var öppet
    if (oppen.pa || oppen.t > 0 || oppen.vantar || oppen.svav > 0) { if (husGrupp) stangDirekt(); else { oppen.pa = false; oppen.vantar = false; oppen.svav = 0; oppen.t = 0; oppen.fore = null; } }
    oppen.foreSist = null; oppen.skarv = null;
    // snittet nollas också, annars klipps det nya huset vid förra husets snitthöjd
    oppen.snittNu = oppen.snittMal = 2; oppen.klipp.constant = 99;
    // det gamla huset sjunker undan medan det nya monteras
    if (rivGrupp) { sluta(rivGrupp); rivGrupp = null; }
    if (husGrupp) {
      if (montera && !lugn) { rivGrupp = husGrupp; rivT = 0; } else sluta(husGrupp);
    }
    if (matGrupp) { sluta(matGrupp); }
    val.modell = id; aktuell = HUS[id];
    husGrupp = byggHus(id);
    scene.add(husGrupp);
    byggT = montera && !lugn ? (rivGrupp ? -0.22 : 0) : 1;
    satsBygg(Math.max(0, byggT));
    nySkugga = true;
    const { L, W, hojd } = husGrupp.userData;
    satFlack(L, W);
    matGrupp = byggMatt(aktuell, hojd); matGrupp.visible = val.matt; scene.add(matGrupp);
    // anpassa kamerans avstånd till husets storlek
    const storlek = Math.max(L, W * 1.4);
    styr.minDistance = storlek * 0.75; styr.maxDistance = storlek * 3.6;
    hem.set(0, hojd * 0.42, 0); hemR = Math.max(L, W) * 0.42; hemTopp = hojd + 0.4;
    styr.target.copy(hem);
    zoomMal = null; zoomRa = null;
    satMiljo();
    satFarger(); satSol();
    planeraInne(byggT < 1 ? 2200 : 600);
    begarRender();
  }

  // Avstånd så att huset ryms i bilden, räknat från kamerans synfält.
  // Riktningen är en enhetsvektor från målpunkten.
  function avstand(riktning, kam = kamera) {
    const { L, W, hojd } = husGrupp.userData;
    const vf = THREE.MathUtils.degToRad(kam.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * kam.aspect);
    // husets utbredning sett från riktningen (plus takutsprång)
    const ax = Math.abs(riktning.x), az = Math.abs(riktning.z);
    const n = Math.hypot(ax, az) || 1;
    const bredd = ((L + 0.7) * az + (W + 0.7) * ax) / n;
    const djup = ((L + 0.7) * ax + (W + 0.7) * az) / n;
    const hogt = hojd * Math.max(0.35, Math.hypot(riktning.x, riktning.z)) + djup * Math.abs(riktning.y);
    const d = Math.max((bredd * 1.18) / (2 * Math.tan(hf)), (hogt * 1.3) / (2 * Math.tan(vf)));
    return d + djup / 2;
  }
  // Vyerna: de fyra fasta plus en per steg i ritaren
  const VYER = {
    runt: [0.6, 0.3, 0.74, 1], soder: [0, 0.16, 1, 1], norr: [0, 0.16, -1, 1], ovan: [0.001, 1, 0.3, 1], ost: [1, 0.16, 0.001, 1], vast: [-1, 0.16, 0.001, 1], baksida: [-0.62, 0.26, -0.76, 1],
    modell: [0.62, 0.26, 0.76, 1], fasad: [0.42, 0.1, 0.9, 0.92], tak: [-0.45, 0.85, 0.55, 0.95],
    fonster: [-0.32, 0.12, 0.95, 0.86], summa: [0.7, 0.22, 0.66, 1],
  };
  // Startvyn ("Runt om", även efter husbyte): rakt mot entrén, 22° åt det håll där altanen
  // ligger, i låg höjd (10° nedåt mot husets mitt). Avståndet väljs så att huset med altanen
  // fyller 80 % av bildens bredd (eller 36 % av höjden, det som kräver mest avstånd), och mitten
  // ligger symmetriskt kring målpunkten. Huset hamnar en aning över mitten, fritt från verktygsraden.
  const ENTRE = { vinkel: THREE.MathUtils.degToRad(22), lut: THREE.MathUtils.degToRad(7), bredd: 0.78, hojd: 0.36 };   // hojd: på bred skärm även bilen och marken framför, ovanför verktygsraden
  function entreVy(kam, mitt) {
    const Y = dorrInfo(), d = husGrupp.userData, H = HUS[val.modell];
    if (!Y) return null;
    const SN = { S: [0, 0, 1], N: [0, 0, -1], E: [1, 0, 0], W: [-1, 0, 0] }[H.altan];
    const s = SN ? Math.sign(SN[0] * Y.u.x + SN[2] * Y.u.z) || 1 : 1;
    const dir = Y.n.clone().multiplyScalar(Math.cos(ENTRE.vinkel)).addScaledVector(Y.u, s * Math.sin(ENTRE.vinkel)).normalize();
    const hoger = new THREE.Vector3(-dir.z, 0, dir.x);
    // husets utbredning (med takfot, utan altanen: den får gå ut mot bildkanten, som i en
    // vanlig husbild) åt sidorna från målpunkten, två gånger den största sidan
    const e = { x0: -d.L / 2 - 0.35, x1: d.L / 2 + 0.35, z0: -d.W / 2 - 0.35, z1: d.W / 2 + 0.35 };
    let sida = 0, fram = 0;
    [[e.x0, e.z0], [e.x1, e.z0], [e.x0, e.z1], [e.x1, e.z1]].forEach(([x, z]) => {
      sida = Math.max(sida, Math.abs((x - mitt.x) * hoger.x + (z - mitt.z) * hoger.z));
      fram = Math.max(fram, (x - mitt.x) * dir.x + (z - mitt.z) * dir.z);
    });
    const vf = THREE.MathUtils.degToRad(kam.fov) / 2, hf = Math.atan(Math.tan(vf) * kam.aspect);
    const dist = Math.max((2 * sida) / ENTRE.bredd / (2 * Math.tan(hf)), d.hojd / ENTRE.hojd / (2 * Math.tan(vf))) + fram;
    return new THREE.Vector3(dir.x * Math.cos(ENTRE.lut), Math.sin(ENTRE.lut), dir.z * Math.cos(ENTRE.lut)).multiplyScalar(dist).add(mitt);
  }
  function mal(vy, kam = kamera, mitt = styr.target) {
    if ((vy === 'runt' || vy === 'modell' || !VYER[vy]) && vy !== 'hjalte' && husGrupp) {
      let p = null;
      try { p = entreVy(kam, mitt); } catch (e) { console.warn(e); }
      if (p) return p;
    }
    if (vy === 'hjalte') {
      // hjältebilden: låg trekvart i ögonhöjd (1,7 m över marken), lite himmel ovanför
      const r = new THREE.Vector3(0.64, 0, 0.77).normalize();
      const p = r.multiplyScalar(avstand(r, kam) * 1.12).add(mitt);
      p.y = 1.7;
      return p;
    }
    const v = VYER[vy] || VYER.runt;
    const r = new THREE.Vector3(v[0], v[1], v[2]).normalize();
    return r.multiplyScalar(avstand(r, kam) * v[3]).add(mitt);
  }
  function placeraKamera() {
    kamera.position.copy(mal('runt'));
    styr.maxDistance = Math.max(styr.maxDistance, kamera.position.distanceTo(styr.target) * 1.6);
    begarRender();
  }
  let inneFov = 0;   // vyns eget synfält (INNE_VYER[].fov), 0 = standard
  const fovFor = inneVy => inneVy ? (kamera.aspect < 1 ? Math.max(inneFov || 62, 74) : (inneFov || 62)) : (kamera.aspect < 1 ? 42 : 32);

  // ---- Övergångar i WebGL ----
  // Förra rutan kopieras till en textur på grafikkortet (copyTexSubImage2D: ingen JPEG,
  // ingen avkodning, ingen läsning till processorn) och tonas bort i en helskärmsruta
  // ovanpå de nya rutorna medan kameran åker. Sista rutan före stillastående kopieras
  // alltid, så ett klick på en stilla bild kostar ingen extra rendering alls.
  // RGB-format: duken saknar alfakanal, och RGBA-kopia från den är inte tillåten.
  const tonStorlek = new THREE.Vector2();
  let tonTex = null;
  const tonMat = new THREE.ShaderMaterial({
    uniforms: { karta: { value: null }, alfa: { value: 0 }, skala: { value: 1 } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    // ingen färgrymd eller tonmappning: texturen innehåller redan färdiga skärmvärden
    fragmentShader: 'uniform sampler2D karta;\nuniform float alfa;\nuniform float skala;\nvarying vec2 vUv;\nvoid main() { vec2 uv = (vUv - 0.5) / skala + 0.5; gl_FragColor = vec4(texture2D(karta, uv).rgb, alfa); }',
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const tonQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tonMat);
  tonQuad.frustumCulled = false;
  const tonScen = new THREE.Scene(); tonScen.add(tonQuad);
  const tonKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tona = { t: 1, pa: false, tid: 0.5, farsk: false };
  function tonTextur() {
    renderer.getDrawingBufferSize(tonStorlek);
    const w = Math.max(1, tonStorlek.x | 0), h = Math.max(1, tonStorlek.y | 0);
    if (tonTex && tonTex.image.width === w && tonTex.image.height === h) return tonTex;
    if (tonTex) tonTex.dispose();
    tonTex = new THREE.FramebufferTexture(w, h);
    // RGB med uttalat RGB8: three ger RGBFormat + UNSIGNED_BYTE inget storleksformat (glTexStorage2D
    // fick osorterat RGB, GL_INVALID_ENUM, och varje kopia blev "Offset overflows"). RGB8 går att kopiera
    // till både med och utan alfa i duken (RGBA8 från en duk utan alfa ger GL_INVALID_OPERATION).
    tonTex.format = THREE.RGBFormat;
    tonTex.internalFormat = 'RGB8';
    tonTex.minFilter = tonTex.magFilter = THREE.LinearFilter;
    tonMat.uniforms.karta.value = tonTex;
    tona.farsk = false; tona.pa = false;
    return tonTex;
  }
  function ritaTona() {
    // förra bilden ovanpå: opacitet och en liten skalning, bara på grafikkortet
    const e = tona.t, k = e * e * (3 - 2 * e);
    tonMat.uniforms.alfa.value = 1 - k;
    tonMat.uniforms.skala.value = 1 + 0.02 * (1 - (1 - e) ** 3);
    renderer.autoClear = false;
    renderer.render(tonScen, tonKam);
    renderer.autoClear = true;
  }
  function kopieraRuta() {
    try { renderer.copyFramebufferToTexture(tonTextur()); tona.farsk = true; } catch (e) { tona.farsk = false; }
  }
  // fångar bilden som syns nu och startar toningen; renderar bara om bilden inte redan finns
  function fangaOvergang() {
    if (lugn || !husGrupp) return;
    slutforIa();   // dörrar och lampor hoppar till sitt slutläge, så att bilden inte fångas mitt i
    tonTextur();
    if (!tona.farsk) {
      renderer.render(scene, kamera);
      if (tona.pa) ritaTona();
      kopieraRuta();
    }
    tona.pa = true; tona.t = 0;
    begarRender();
  }
  // när datorn är ledig (requestIdleCallback, annars en kort timeout)
  // senaste trycket, klicket eller tangenten: förberedelserna i vila håller sig undan en stund
  let inmatSist = -1e9;
  ['pointerdown', 'keydown', 'touchstart'].forEach(h => window.addEventListener(h, () => { inmatSist = performance.now(); }, { capture: true, passive: true }));
  // väntar någon på förberedelserna just nu? (då ska de gå på för fullt)
  const vantarPaKomp = () => !!((flyg && flyg.bana && flyg.bana.halv) || oppen.vantar);
  const nastaRuta = () => new Promise(r => { let k = false; const f = () => { if (!k) { k = true; r(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 100); });
  function ledigt(fn, ms = 600) {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: ms });
    // utan requestIdleCallback (iPhone Safari): 10 ms arbete var 16:e ms. Förut 8 ms var 60:e,
    // och inredningen hann inte byggas och värmas innan man tryckte på Se inne (lång väntan)
    else setTimeout(() => fn({ timeRemaining: () => 10, didTimeout: true }), 16);
  }
  function skickaOvergang(opts) {
    if (!opts || opts.overgang !== 'tona') return;
    fangaOvergang();
  }

  // ---- Inne i huset: möblerad interiör och 360° från ögonhöjd ----
  let inneLage = false, ute = null;
  // Inredningen: byggs i små steg när datorn är ledig (byggInneSteg), shaders kompileras
  // parallellt (compileAsync) och först därefter blir den synlig. Behövs den direkt
  // (Se inne, dockskåpet) körs resten av stegen på en gång.
  let inneBygge = null;
  function forberedInne(g) {
    const d = husGrupp.userData;
    const l = g.userData.lampa;
    if (l) { d.lampPos = l.position.clone(); l.parent.remove(l); }
    g.visible = false;
    d.delar.vaggar.add(g);
    // klipp vid ytterväggarnas insida: växtblad och annat får aldrig synas utanför huset
    const H = HUS[val.modell], m = 0.04;
    const plan = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), H.L / 2 - m), new THREE.Plane(new THREE.Vector3(-1, 0, 0), H.L / 2 - m),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), H.W / 2 - m), new THREE.Plane(new THREE.Vector3(0, 0, -1), H.W / 2 - m),
    ];
    g.traverse(o => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => {
        if (!mm.userData.inneKlipp) { mm.userData.inneKlipp = plan.map(p => p.clone()); mm.clippingPlanes = (mm.clippingPlanes || []).concat(mm.userData.inneKlipp); }
        mm.userData.inneKlipp.forEach((p, i) => p.copy(plan[i]));
        mm.clipShadows = true;
        // aldrig över fasaden: bara där fasaden inte har märkt stencilen (se mat.fasad)
        mm.stencilWrite = true; mm.stencilWriteMask = 0; mm.stencilRef = 1; mm.stencilFunc = THREE.NotEqualStencilFunc;
      });
    });
    renderer.localClippingEnabled = true;
    if (d.lampPos) inneLjus.position.copy(d.lampPos).add(new THREE.Vector3(0, d.delar.Y0, 0));
    if (oppen.pa || oppen.t > 0) klippAlla();
    d.inneVantar = g;
  }
  function inneKlar() {
    const d = husGrupp.userData;
    if (!d.inneVantar) return;
    d.inne = d.inneVantar; d.inneVantar = null;
    if (tomt.pa) tomtGeo();
  }
  function inneGrupp() {
    const d = husGrupp.userData;
    if (!d.inne) {
      if (!d.inneVantar) {
        let g;
        if (inneBygge && inneBygge.hus === husGrupp) { let r = inneBygge.it.next(); while (!r.done) r = inneBygge.it.next(); g = r.value; }
        else g = byggInne(THREE, val.modell, HUS[val.modell]);
        inneBygge = null;
        forberedInne(g);
      }
      inneKlar();
    }
    return d.inne;
  }
  // Inredningen byggs när huset är monterat och första bilderna är ritade, så att
  // fönstren visar de riktiga rummen i stället för tomma lådor.
  let inneTimer = 0, inneLangt = false, pekarNere = false;
  duk.addEventListener('pointerdown', () => { pekarNere = true; }, { passive: true });
  window.addEventListener('pointerup', () => { pekarNere = false; }, { passive: true });
  window.addEventListener('pointercancel', () => { pekarNere = false; }, { passive: true });
  // inget bygge medan man drar, zoomar eller kameran åker
  const inneVanta = () => byggT < 1 || rivGrupp || aka || pekarNere || zoomMal !== null || tona.pa || gang.glid || performance.now() - inmatSist < 400;
  function planeraInne(ms) {
    clearTimeout(inneTimer);
    inneBygge = null;
    inneTimer = setTimeout(() => {
      inneTimer = 0;
      if (!husGrupp || husGrupp.userData.inne || husGrupp.userData.inneVantar) return;
      if (inneVanta()) { planeraInne(400); return; }
      const hus = husGrupp;
      try { inneBygge = { it: byggInneSteg(THREE, val.modell, HUS[val.modell]), hus }; } catch (e) { console.warn(e); return; }
      ledigt(function steg(dl) {
        const jobb = inneBygge;
        if (!jobb || jobb.hus !== husGrupp || hus.userData.inne || hus.userData.inneVantar) { if (jobb && jobb.hus !== husGrupp) inneBygge = null; return; }
        if (inneVanta()) { setTimeout(() => ledigt(steg), 200); return; }
        const slut = performance.now() + Math.max(4, Math.min(10, dl && dl.timeRemaining ? dl.timeRemaining() : 8));
        let r;
        try { do { r = jobb.it.next(); } while (!r.done && performance.now() < slut); } catch (e) { console.warn(e); inneBygge = null; return; }
        if (!r.done) { ledigt(steg); return; }
        inneBygge = null;
        try { forberedInne(r.value); } catch (e) { console.warn(e); return; }
        // när inredningen syns: inneläget värms i vila (varmInne), så att Se inne kan börja direkt
        const syns = () => { if (husGrupp !== hus) return; marke('rit-inne-klar'); lageLjus(); nySkugga = true; begarRender(); if (!FOTO) ledigt(() => { if (husGrupp === hus) varmInne(hus); }, 1500); };
        // shaders kompileras utan att låsa sidan där webbläsaren kan (KHR_parallel_shader_compile);
        // dockskåpets snitt och takkopior kompileras samtidigt (annars vid första lyftet).
        // Inredningen blir synlig (lageLjus) först när allt är kompilerat.
        inneForbered(hus);
        forvarmOppen(hus, 1).then(syns, syns);   // ett program i taget (se kompKlipp)
      }, 1200);
    }, ms);
  }
  // det raka bytet (inne() längre ned väljer mellan det och åkningen genom ytterdörren)
  function inneRakt(pa, vyIndex = 0, opts) {
    if (pa) {
      const vyer = INNE_VYER[val.modell] || [];
      const v = vyer[Math.max(0, Math.min(vyer.length - 1, vyIndex | 0))];
      if (!v) return Promise.resolve(false);
      skickaOvergang(opts);
      if (byggT < 1) { byggT = 1; satsBygg(1); }
      if (rivGrupp) { sluta(rivGrupp); rivGrupp = null; }
      if (oppen.pa || oppen.t > 0) {
        // från dockskåpet: utsidan man kommer tillbaka till är vyn före öppningen
        aka = null;
        if (oppen.fore) { kamera.position.copy(oppen.fore.pos); styr.target.copy(oppen.fore.mal); }
        stangDirekt();
      }
      inneGrupp();
      if (!inneLage && !flyg) {   // under åkningen in är utsidans vy redan sparad (flygStart)
        ute = { pos: kamera.position.clone(), mal: styr.target.clone(), min: styr.minDistance, max: styr.maxDistance, pMin: styr.minPolarAngle, pMax: styr.maxPolarAngle, zoom: styr.enableZoom };
      }
      inneLage = true;
      aka = null; zoomMal = null; styr.autoRotate = false;
      if (matGrupp) matGrupp.visible = false;
      const Y0 = husGrupp.userData.delar.Y0;
      const ogon = new THREE.Vector3(v.pos[0], v.pos[1] + Y0, v.pos[2]);
      const titt = new THREE.Vector3(v.mal[0], v.mal[1] + Y0, v.mal[2]).sub(ogon).normalize();
      // kameran snurrar runt en punkt några centimeter framför ögat: det blir att titta runt
      styr.minDistance = 0.005; styr.maxDistance = 0.02; styr.enableZoom = false;
      // att titta runt: lugnare vridning än runt huset (synfältet är dubbelt så brett);
      // på pekskärm dras bilden (−0,38, sätts vid pointerdown)
      styr.rotateSpeed = 0.42;
      styr.minPolarAngle = 0.35; styr.maxPolarAngle = Math.PI - 0.45;
      styr.target.copy(ogon).addScaledVector(titt, 0.01);
      kamera.position.copy(ogon);
      inneFov = Number.isFinite(v.fov) && v.fov > 10 ? v.fov : 0;
      kamera.fov = fovFor(true); kamera.updateProjectionMatrix();
      gangStart(ogon, v);
      punktAnim.till = performance.now() + 3000; vakna();
      const ri = rumFor(v);
      satRumLjus(ri, v.ljus);
      lageLjus();
      // spegeln fångas en gång när man kliver in, och igen vid badet
      const d = husGrupp.userData;
      if (!d.spegelEnv || arBad(v.namn)) fangaSpeglar(ri);
      styrNu(); begarRender();
      return Promise.resolve(true);
    }
    if (!inneLage) return Promise.resolve(false);
    skickaOvergang(opts);
    inneLage = false; vakna();
    gangSlut();
    lageLjus();
    kamera.layers.mask = 3;
    if (matGrupp) matGrupp.visible = val.matt;
    if (ute) {
      styr.rotateSpeed = 0.7;
      styr.minDistance = ute.min; styr.maxDistance = ute.max; styr.minPolarAngle = ute.pMin; styr.maxPolarAngle = ute.pMax; styr.enableZoom = ute.zoom;
      styr.target.copy(ute.mal); kamera.position.copy(ute.pos);
    }
    kamera.fov = fovFor(false); kamera.updateProjectionMatrix();
    styrNu(); begarRender();
    return Promise.resolve(true);
  }

  // ---- Rummens ljus: räknas en gång per hus ----
  // Lampornas lägen tas ur inredningens lampMaterial-meshar (hopslagna, så hörnen klumpas
  // ihop till lampor). För varje rumspunkt väljs den närmaste pendeln/taklampan (spot +
  // huvudljus) och närmaste låga lampa (sänglampa, golvlampa) som syns utan vägg emellan.
  // Allt i inredningens koordinater (golvet = 0); Y0 läggs på när ljusen placeras.
  const rumLjus = { spot: false, lag: false, styrka: 1, l2: 0 };
  function lampKlungor() {
    const d = husGrupp.userData;
    if (d.lampKlungor) return d.lampKlungor;
    const ut = [], ig = d.inne;
    if (!ig) return ut;
    const ud = ig.userData, lm = new Set();
    [ud.lampMaterial, ud.lampMaterials].forEach(x => (Array.isArray(x) ? x : [x]).forEach(m => { if (m && m.isMaterial) lm.add(m); }));
    if (lm.size) {
      ig.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(ig.matrixWorld).invert(), M = new THREE.Matrix4(), p = new THREE.Vector3(), C = 0.4, celler = new Map();
      ig.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !lm.has(o.material)) return;
        M.multiplyMatrices(inv, o.matrixWorld);
        const a = o.geometry.attributes.position;
        // nl = hörn i lösa saker (tomt hus): de ligger sist i meshen, från userData.fastN
        const fN = Number.isInteger(o.userData.fastN) ? o.userData.fastN : Infinity;
        for (let i = 0; i < a.count; i++) {
          p.fromBufferAttribute(a, i).applyMatrix4(M);
          const k = Math.floor(p.x / C) + ',' + Math.floor(p.y / C) + ',' + Math.floor(p.z / C);
          let c = celler.get(k);
          if (!c) celler.set(k, c = { x: 0, y: 0, z: 0, n: 0, y0: Infinity, nl: 0 });
          c.x += p.x; c.y += p.y; c.z += p.z; c.n++; if (p.y < c.y0) c.y0 = p.y;
          if (i >= fN) c.nl++;
        }
      });
      celler.forEach(c => {
        const cx = c.x / c.n, cy = c.y / c.n, cz = c.z / c.n;
        const u = ut.find(u => Math.hypot(u.x / u.n - cx, u.y / u.n - cy, u.z / u.n - cz) < 0.55);
        if (u) { u.x += c.x; u.y += c.y; u.z += c.z; u.n += c.n; u.nl += c.nl; u.y0 = Math.min(u.y0, c.y0); }
        else ut.push({ ...c });
      });
    }
    return (d.lampKlungor = ut.map(u => ({ x: u.x / u.n, y: u.y / u.n, z: u.z / u.n, y0: u.y0, los: u.nl > u.n / 2 })));
  }
  function rumsLjus() {
    const d = husGrupp.userData;
    if (d.rumsLjus) return tomt.pa ? d.rumsLjusTomt : d.rumsLjus;
    const P = punkter(), K0 = lampKlungor(), ig = d.inne, vagg = [];
    if (ig) { ig.updateMatrixWorld(true); ig.traverse(o => { if (o.isMesh && /-vagg$/.test(o.name)) vagg.push(o); }); }
    const W = ig ? ig.matrixWorld : new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), rc = new THREE.Raycaster(), hit = [];
    const syns = (p, c) => {
      if (!vagg.length) return true;
      a.set(p[0], p[1], p[2]).applyMatrix4(W); b.set(c.x, c.y, c.z).applyMatrix4(W);
      const dd = a.distanceTo(b); if (dd < 0.3) return true;
      rc.set(a, b.sub(a).normalize()); rc.far = dd - 0.2; hit.length = 0;
      rc.intersectObjects(vagg, false, hit);
      const fri = !hit.length; hit.length = 0; return fri;
    };
    // två uppsättningar: med möbler och för tomt hus (utan de lösa lampornas klungor)
    const rakna = K => P.map(p => {
      const fy = punktGolv(p), x = p.pos[0], z = p.pos[2];
      let pend = null, lag = null, bp = 3.4, bl = 3.4;
      K.forEach(c => {
        const h = c.y - fy;
        if (h < 0.25 || h > 3.4) return;
        const r = Math.hypot(c.x - x, c.z - z);
        if (h >= 1.5) { if (r < bp && syns(p.pos, c)) { bp = r; pend = c; } }
        else if (r < bl && syns(p.pos, c)) { bl = r; lag = c; }
      });
      const huvud = Array.isArray(p.ljus) ? [+p.ljus[0], +p.ljus[1], +p.ljus[2]]
        : pend ? [pend.x, Math.max(fy + 1.7, pend.y0 - 0.3), pend.z]
        : lag ? [lag.x, fy + 1.9, lag.z] : [x, fy + 2.05, z];
      return {
        huvud, styrka: Array.isArray(p.ljus) || pend ? 1 : lag ? 0.5 : 0.8,
        spot: pend ? { pos: [pend.x, pend.y0 - 0.03, pend.z], mal: [pend.x, fy, pend.z] } : null,
        lag: lag ? [lag.x, lag.y + 0.06, lag.z] : null,
      };
    });
    d.rumsLjus = rakna(K0);
    d.rumsLjusTomt = K0.some(c => c.los) ? rakna(K0.filter(c => !c.los)) : d.rumsLjus;
    return tomt.pa ? d.rumsLjusTomt : d.rumsLjus;
  }
  // rumspunkten för en inne-vy: samma namn, annars närmaste
  function rumFor(v) {
    const P = punkter();
    if (!P.length || !v) return -1;
    let i = P.findIndex(p => p.namn && p.namn === v.namn);
    if (i >= 0) return i;
    let bast = Infinity;
    P.forEach((p, j) => { const dd = Math.hypot(p.pos[0] - v.pos[0], (p.pos[1] - v.pos[1]) * 2, p.pos[2] - v.pos[2]); if (dd < bast) { bast = dd; i = j; } });
    return i;
  }
  // Rumsbytet tonas: ljusens lägen och styrkor går från förra rummets till det nya på 0,35 s
  const ljusTona = { t: 1, lp: new THREE.Vector3(), li: 0, sp: new THREE.Vector3(), st: new THREE.Vector3(), si: 0, l2p: new THREE.Vector3(), l2i: 0,
    mSp: new THREE.Vector3(), mSt: new THREE.Vector3(), mL2: new THREE.Vector3(), v: new THREE.Vector3() };
  function satRumLjus(i, over, mjukt) {
    const d = husGrupp.userData, Y0 = d.delar.Y0, LT = ljusTona;
    if (mjukt && !lugn && inneLage) {
      LT.lp.copy(inneLjus.position); LT.li = inneLjus.intensity;
      LT.sp.copy(inneSpot.position); LT.st.copy(inneSpot.target.position); LT.si = inneSpot.intensity;
      LT.l2p.copy(inneLjus2.position); LT.l2i = inneLjus2.intensity;
      LT.t = 0;
    } else LT.t = 1;
    let R = null;
    try { R = i >= 0 ? rumsLjus()[i] || null : null; } catch (e) { console.warn(e); }
    if (Array.isArray(over)) inneLjus.position.set(over[0], over[1] + Y0, over[2]);
    else if (R) inneLjus.position.set(R.huvud[0], R.huvud[1] + Y0, R.huvud[2]);
    else if (d.lampPos) inneLjus.position.copy(d.lampPos).y += Y0;
    rumLjus.styrka = R ? R.styrka : 1;
    rumLjus.spot = !!(R && R.spot);
    if (rumLjus.spot) {
      inneSpot.position.set(R.spot.pos[0], R.spot.pos[1] + Y0, R.spot.pos[2]);
      inneSpot.target.position.set(R.spot.mal[0], R.spot.mal[1] + Y0, R.spot.mal[2]);
      inneSpot.target.updateMatrixWorld();
    }
    rumLjus.lag = !!(R && R.lag);
    rumNu = i; ljusHem.copy(inneLjus.position);
    if (rumLjus.lag) inneLjus2.position.set(R.lag[0], R.lag[1] + Y0, R.lag[2]);
    LT.mSp.copy(inneSpot.position); LT.mSt.copy(inneSpot.target.position); LT.mL2.copy(inneLjus2.position);
  }
  function stegLjus(dt) {
    if (ljusTona.t >= 1 || !inneLage) { ljusTona.t = 1; return false; }
    ljusTona.t = Math.min(1, ljusTona.t + dt / 0.35);
    satLampLjus();
    return true;
  }

  // ---- Spegeln: en liten kubkamera (128 px) en gång, inte per ruta ----
  // Inredningen kan lämna userData.speglar = [mesh]. Bilden förfiltreras med PMREM så att
  // envMap-typen blir densamma som scenens (ingen omkompilering).
  const arBad = n => /bad|wc|dusch/i.test(n || '');
  let spegelKam = null, spegelRT = null;
  function slappSpeglar(d) {
    if (!d || !d.spegelEnv) return;
    d.spegelEnv.forEach(({ rt, mats }) => {
      mats.forEach(mt => { if (mt.userData.spegelEnv === rt.texture) { delete mt.userData.spegelEnv; mt.envMap = scene.environment; } });
      rt.dispose();
    });
    d.spegelEnv = null;
  }
  function spegelRigg() {
    if (spegelKam) return;
    spegelRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    spegelKam = new THREE.CubeCamera(0.05, 40, spegelRT);
  }
  function fangaSpeglar(ri) {
    const d = husGrupp && husGrupp.userData, ig = d && d.inne;
    const l = ig && ig.userData && Array.isArray(ig.userData.speglar) ? ig.userData.speglar.filter(m => m && m.isMesh && m.geometry && m.material) : [];
    if (!l.length) return;
    const nyckel = ri + '|' + val.tid;
    if (d.spegelEnv && d.spegelNyckel === nyckel) return;
    const dolda = [];
    const gom = o => { if (o && o.visible) { dolda.push(o); o.visible = false; } };
    try {
      spegelRigg();
      slappSpeglar(d);
      d.spegelEnv = []; d.spegelNyckel = nyckel;
      gom(markor); gom(skylt); gom(d.punktMesh);
      l.forEach(gom);
      scene.updateMatrixWorld();
      const n = new THREE.Vector3(), nm = new THREE.Matrix3();
      l.forEach(m => {
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        spegelKam.position.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld);
        const na = g.attributes.normal;
        if (na && na.count) { n.fromBufferAttribute(na, 0).applyMatrix3(nm.getNormalMatrix(m.matrixWorld)).normalize(); spegelKam.position.addScaledVector(n, 0.08); }
        spegelKam.updateMatrixWorld();
        spegelKam.update(renderer, scene);
        const rt = pmrem.fromCubemap(spegelRT.texture);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach(mt => { mt.userData.spegelEnv = rt.texture; mt.envMap = rt.texture; });
        d.spegelEnv.push({ rt, mats });
        // inredningens onBeforeRender sätter scenens miljö på materialen; spegeln behåller sin
        if (!m.userData.spegelSlag) {
          const f = m.onBeforeRender;
          m.onBeforeRender = function (...arg) {
            if (typeof f === 'function') f.apply(this, arg);
            (Array.isArray(this.material) ? this.material : [this.material]).forEach(mt => { if (mt && mt.userData.spegelEnv) mt.envMap = mt.userData.spegelEnv; });
          };
          m.userData.spegelSlag = true;
        }
      });
    } catch (e) { console.warn(e); }
    finally { dolda.forEach(o => { o.visible = true; }); }
    begarRender();
  }

  // ---- Gå runt inne (som Matterport) ----
  // Klick på golvet glider dit i ögonhöjd, WASD/pilar går, Q/E vrider, dra tittar runt.
  // Inredningen lämnar golvYtor (meshar att träffa), rumPunkter och hinder (2D-lådor);
  // saknas de går det ändå: golvet blir en osynlig yta och huset en enkel låda.
  // RADIE mot väggar, RADIE_M mot möbler (man kan gå närmare ett bord än en vägg)
  const OGON = 1.60, RADIE = 0.25, RADIE_M = 0.17, FART = 1.25;
  const TANGENT = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'v', ArrowLeft: 'v', KeyD: 'h', ArrowRight: 'h', KeyQ: 'q', KeyE: 'e' };
  const gang = { tangent: new Set(), vx: 0, vz: 0, vrid: 0, glid: null, niva: 0, golvY: 0, pekar: false, px: 0, py: 0, ner: null, drog: false, hov: -1, x: 0, z: 0, hjul: 0, sistMal: null, sitter: -1, stod: null, snabb: false };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), traffar = [], NER = new THREE.Vector3(0, -1, 0);
  const gV = new THREE.Vector3(), gV2 = new THREE.Vector3(), gV3 = new THREE.Vector3(), gM = new THREE.Matrix4();
  let dukB = 1, dukH = 1;
  // ---- Golvringen: en enda mesh med egen shader (tunn vit ring, mjukt sken inåt) ----
  // Läget räknas bara när pekaren rört sig (en strålning per ruta, i ram). Ringen glider
  // mjukt dit, följer golvets normal och tonas nära väggar; röd där man inte kan gå.
  // Över möbler, väggar och gränssnitt syns den inte. Vid klick pulserar den ut (1 → 1,3).
  const RING_D = 0.5;
  // Färgerna (bärnsten → rosa → salvia → bärnsten) sveper runt ringen på 4 s med en
  // glans som vandrar; ringen andas ±4 %. uTid är en och samma tid för ringen och skivorna
  // (punktAnim), uRorlig 0 vid minskad rörelse: då står färgerna still.
  const ANIM = { uTid: { value: 0.8 }, uRorlig: { value: 1 } };
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uAlfa: { value: 0 }, uRod: { value: 0 }, uPuls: { value: 0 }, uTid: ANIM.uTid, uRorlig: ANIM.uRorlig },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float uAlfa; uniform float uRod; uniform float uPuls; uniform float uTid; uniform float uRorlig; varying vec2 vUv;',
      'vec3 palett(float a) {',
      '  vec3 A = vec3(0.941, 0.710, 0.431), R = vec3(0.910, 0.627, 0.541), S = vec3(0.624, 0.722, 0.627);',
      '  float x = fract(a) * 3.0;',
      '  return x < 1.0 ? mix(A, R, smoothstep(0.0, 1.0, x)) : x < 2.0 ? mix(R, S, smoothstep(0.0, 1.0, x - 1.0)) : mix(S, A, smoothstep(0.0, 1.0, x - 2.0));',
      '}',
      'void main() {',
      '  vec2 p = vUv - 0.5;',
      '  float vinkel = atan(p.y, p.x) / 6.28318 + 0.5;',
      '  float r = length(p) * 2.0 / (1.0 + 0.04 * sin(uTid * 2.4166) * uRorlig * (1.0 - uPuls));',
      '  float w = max(fwidth(r) * 1.2, 0.003);',
      '  float ring = smoothstep(0.778 - w, 0.778, r) * (1.0 - smoothstep(0.818, 0.818 + w, r));',
      '  float sken = (1.0 - smoothstep(0.1, 0.8, r)) * 0.12 + exp(-pow((r - 0.8) * 12.0, 2.0)) * 0.28;',
      '  float sv = fract(vinkel - uTid * 0.3), glans = exp(-pow(min(sv, 1.0 - sv) * 8.0, 2.0)) * uRorlig;',
      '  float a = (ring * (0.85 + 0.3 * glans) + sken * (1.0 - 0.6 * uPuls)) * uAlfa;',
      '  if (a < 0.003) discard;',
      '  vec3 c = mix(palett(vinkel + uTid * 0.25), vec3(1.0, 0.97, 0.92), 0.25 * glans + 0.35 * uPuls);',
      '  gl_FragColor = vec4(mix(c, vec3(0.70, 0.53, 0.51), uRod), a);',
      '}'].join('\n'),
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
  });
  const markor = new THREE.Mesh(new THREE.PlaneGeometry(RING_D / 0.8, RING_D / 0.8).rotateX(-Math.PI / 2), ringMat);
  markor.renderOrder = 6; markor.visible = false; markor.frustumCulled = false; scene.add(markor);
  const rN = new THREE.Vector3();
  // mal: dit pekaren visar; giltig: man får gå dit; puls: 0–1 under klickets puls, annars -1
  const ring = { mal: new THREE.Vector3(), q: new THREE.Quaternion(), alfa: 0, alfaMal: 0, rod: 0, rodMal: 0, niva: 0, golvY: 0, giltig: false, puls: -1 };
  // Rumspunkterna: svagt glödande skivor på golvet. Skenet andas med tiden (uTid sätts bara
  // i rutor som ritas ändå: liv eller rörelse), storleken följer avståndet.
  // aLjus per skiva: x = hovrad (0/1), y = synlighet (tonas bort där man står)
  // Skivorna: en mjuk kärna, tre ringar som vidgas och tonas (ett ekolod, 2,2 s), färgerna
  // sveper runt kanten (4 s) med en vandrande glans och ett svagt dis inåt. Den hovrade
  // pulserar fortare (uHovTid går 1,6 gånger så fort).
  const PUNKT_MAT = new THREE.ShaderMaterial({
    uniforms: { uTid: ANIM.uTid, uHovTid: { value: 0.8 }, uRorlig: ANIM.uRorlig },
    vertexShader: 'attribute vec2 aLjus;\nvarying vec2 vUv;\nvarying vec2 vL;\nvoid main() {\n  vUv = uv; vL = aLjus;\n  vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n  p = instanceMatrix * p;\n#endif\n  gl_Position = projectionMatrix * modelViewMatrix * p;\n}',
    fragmentShader: [
      'uniform float uTid; uniform float uHovTid; uniform float uRorlig; varying vec2 vUv; varying vec2 vL;',
      'vec3 palett(float a) {',
      '  vec3 A = vec3(0.941, 0.710, 0.431), R = vec3(0.910, 0.627, 0.541), S = vec3(0.624, 0.722, 0.627);',
      '  float x = fract(a) * 3.0;',
      '  return x < 1.0 ? mix(A, R, smoothstep(0.0, 1.0, x)) : x < 2.0 ? mix(R, S, smoothstep(0.0, 1.0, x - 1.0)) : mix(S, A, smoothstep(0.0, 1.0, x - 2.0));',
      '}',
      'void main() {',
      '  vec2 p = vUv - 0.5;',
      '  float r = length(p) * 2.0, vinkel = atan(p.y, p.x) / 6.28318 + 0.5, hov = vL.x;',
      '  float t = mix(uTid, uHovTid, hov);',
      '  float w = max(fwidth(r) * 1.2, 0.003);',
      '  float karna = (1.0 - smoothstep(0.0, 0.2, r)) * 0.6;',
      '  float dis = (1.0 - smoothstep(0.05, 0.7, r)) * 0.15;',
      '  float kant = smoothstep(0.64 - w, 0.64, r) * (1.0 - smoothstep(0.685, 0.685 + w, r)) * 0.5;',
      '  float sv = fract(vinkel - t * 0.35), glans = exp(-pow(min(sv, 1.0 - sv) * 9.0, 2.0)) * uRorlig;',
      '  float ekon = 0.0;',
      '  for (int i = 0; i < 3; i++) {',
      '    float f = fract(t / 2.2 + float(i) / 3.0), rr = 0.16 + f * 0.78;',
      '    ekon += (1.0 - f) * (1.0 - f) * smoothstep(0.0, 0.12, f) * exp(-pow((r - rr) * 20.0, 2.0)) * 0.42;',
      '  }',
      '  float a = (karna + dis + kant * (0.8 + 0.6 * glans) + ekon * uRorlig) * (0.62 + 0.48 * hov) * vL.y * (1.0 - smoothstep(0.9, 1.0, r));',
      '  if (a < 0.003) discard;',
      '  vec3 c = mix(palett(vinkel + t * 0.25), vec3(1.0, 0.96, 0.9), karna * 0.7 + glans * 0.25);',
      '  gl_FragColor = vec4(c, a);',
      '}'].join('\n'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
  });
  const GOLV_OSYNLIG = new THREE.MeshBasicMaterial({ visible: false });
  let skylt = null;
  const inneData = () => (husGrupp && husGrupp.userData.inne && husGrupp.userData.inne.userData) || {};
  function golvLista() {
    const d = husGrupp.userData, ud = inneData();
    if (!d.golv) {
      const l = Array.isArray(ud.golvYtor) ? ud.golvYtor.filter(m => m && m.isMesh) : [];
      if (l.length) d.golv = { lista: l, riktig: true };
      else {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(d.L - 0.3, d.W - 0.3).rotateX(-Math.PI / 2), GOLV_OSYNLIG);
        m.position.y = d.delar.Y0; m.visible = false; m.userData.niva = 0; husGrupp.add(m); m.updateMatrixWorld();
        d.golv = { lista: [m], riktig: false };
      }
    }
    return d.golv;
  }
  // innerväggarna (inredningens meshar som heter ...-vagg): pekaren på en vägg ska inte
  // ge en ring på golvet bakom den
  function vaggLista() {
    const d = husGrupp.userData;
    if (!d.vaggMesh) {
      const l = [];
      if (d.inne) d.inne.traverse(o => { if (o.isMesh && /-vagg$/.test(o.name)) l.push(o); });
      d.vaggMesh = l;
    }
    return d.vaggMesh;
  }
  function punkter() {
    const l = inneData().rumPunkter;
    return Array.isArray(l) ? l.filter(p => p && Array.isArray(p.pos) && p.pos.length >= 3) : [];
  }
  function hinderLista() {
    const d = husGrupp.userData;
    if (!d.hinder) {
      const l = inneData().hinder;
      d.hinder = (Array.isArray(l) ? l : []).filter(b => b && [b.x0, b.z0, b.x1, b.z1].every(Number.isFinite))
        .map(b => {
          const h = { x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1), z0: Math.min(b.z0, b.z1), z1: Math.max(b.z0, b.z1), niva: b.niva === 'alla' ? -1 : nivaTal(b.niva), mobel: b.typ === 'mobel', los: !!b.los };
          // dörrens låda (hinder[].dorr = index i oppningsbara): stoppar bara när dörren är stängd
          h.dorr = Number.isInteger(b.dorr) && b.dorr >= 0 ? b.dorr : -1;
          // trappans låda: man går uppför den i stället för att stöta i den
          h.trappa = b.typ === 'trappa' || (h.niva !== 1 && trappor().some(t => {
            const ox = Math.min(h.x1, Math.max(t.xL, t.xH)) - Math.max(h.x0, Math.min(t.xL, t.xH)), oz = Math.min(h.z1, t.z1) - Math.max(h.z0, t.z0);
            return ox > 0 && oz > 0 && ox * oz > 0.8 * (h.x1 - h.x0) * (h.z1 - h.z0);
          }));
          return h;
        });
    }
    // tomt hus: de lösa möblernas hinder släpps (los kommer från inredningen)
    return tomt.pa ? d.hinderTomt || (d.hinderTomt = d.hinder.filter(h => !h.los)) : d.hinder;
  }
  // stoppar hindret? en dörrs låda bara så länge dörren är (nästan) stängd
  function stoppar(b) {
    if (b.dorr < 0) return true;
    const ut = husGrupp.userData.ia, o = ut && ut.opp[b.dorr];
    return !o || o.t < 0.3;
  }
  // Trappor: inredningen kan lämna userData.trappor = [{ xL, xH, z0, z1, hojd }] (xL nedre
  // änden, xH övre). Annars används trapporna som inredningen ritar i dag (samma mått).
  const TRAPPOR = {
    'sadel-30': [{ xL: 0.29, xH: -1.96, z0: 1.08, z1: 1.75 }],
    'sadel-40': [{ xL: -0.25, xH: -3.02, z0: 1.08, z1: 1.75 }],
    'sadel-50': [{ xL: -0.12, xH: -3.17, z0: 1.08, z1: 1.75 }],
  };
  function trappor() {
    const d = husGrupp.userData;
    if (d.trappor) return d.trappor;
    const ud = inneData(), l = Array.isArray(ud.trappor) ? ud.trappor : TRAPPOR[val.modell] || [];
    const ut = l.filter(t => t && [t.xL, t.xH, t.z0, t.z1].every(Number.isFinite) && Math.abs(t.xH - t.xL) > 0.3)
      .map(t => ({ xL: t.xL, xH: t.xH, z0: Math.min(t.z0, t.z1), z1: Math.max(t.z0, t.z1), h: tal(t.hojd) ? t.hojd : 2.32 }));
    if (d.inne) d.trappor = ut;
    return ut;
  }
  // höjden på trappan under (x, z), räknat från bottenvåningens golv; en halv meter
  // vilplan efter översta steget, så att man kommer upp på loftets golv
  // (svaret är ett och samma objekt, TR, som skrivs över av nästa anrop: inget skräp per ruta)
  const TR = { s: 0, y: 0, t: null };
  function trappaVid(x, z) {
    const T = trappor();
    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      if (z < t.z0 || z > t.z1) continue;
      const L = Math.abs(t.xH - t.xL), s = (x - t.xL) / (t.xH - t.xL);
      if (s < 0 || s > 1 + 0.5 / L) continue;
      TR.s = s; TR.y = Math.min(1, s) * t.h; TR.t = t;
      return TR;
    }
    return null;
  }
  // våningen som tal: 0 botten, 1 loft (inredningen skriver 'botten'/'loft')
  const nivaTal = v => v === 'loft' || v === 1 ? 1 : 0;
  const nivaFor = t => t.object.userData.niva !== undefined ? nivaTal(t.object.userData.niva) : (t.point.y - husGrupp.userData.delar.Y0 > 1.2 ? 1 : 0);
  // rumPunkter.golv är golvets höjd under punkten (loftets golv på loftet); saknas det
  // räknas det från ögonhöjden pos[1], OGON ovanför golvet
  const punktGolv = p => (tal(+p.golv) && p.golv !== null && p.golv !== '' ? +p.golv : Math.max(0, (+p.pos[1] || OGON) - OGON));
  const punktSyn = [];   // skivornas synlighet (samma som aLjus.y), för hovringen
  function byggPunkter() {
    const d = husGrupp.userData;
    if (d.punktMesh !== undefined) return d.punktMesh;
    const P = punkter();
    if (!P.length) return (d.punktMesh = null);
    const g = new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2);
    g.setAttribute('aLjus', new THREE.InstancedBufferAttribute(new Float32Array(P.length * 2).fill(1), 2));
    const im = new THREE.InstancedMesh(g, PUNKT_MAT, P.length);
    P.forEach((p, i) => { gM.makeTranslation(p.pos[0], punktGolv(p) + d.delar.Y0 + 0.014, p.pos[2]); im.setMatrixAt(i, gM); });
    im.instanceMatrix.needsUpdate = true; im.renderOrder = 5; im.visible = false; im.frustumCulled = false;
    im.userData.sist = new THREE.Vector3(1e9, 0, 0);
    husGrupp.add(im); im.updateMatrixWorld();
    return (d.punktMesh = im);
  }
  // skivorna växer lite med avståndet (syns i hela rummet utan att bli stora nära) och
  // tonas bort där man står; räknas bara när kameran flyttat sig
  const gS2 = new THREE.Vector3();
  function skalaPunkter(tvinga) {
    const im = husGrupp && husGrupp.userData.punktMesh;
    if (!im || !im.visible) return;
    const K = kamera.position;
    if (!tvinga && im.userData.sist.distanceToSquared(K) < 1e-4) return;
    im.userData.sist.copy(K);
    const P = punkter(), Y0 = husGrupp.userData.delar.Y0, a = im.geometry.attributes.aLjus;
    for (let i = 0; i < P.length && i < im.count; i++) {
      const p = P[i], y = punktGolv(p) + Y0 + 0.014;
      const d = Math.hypot(p.pos[0] - K.x, (y - K.y) * 0.5, p.pos[2] - K.z);
      const s = Math.min(1.45, Math.max(0.8, 0.68 + d * 0.11)) * (i === gang.hov ? 1 + 0.15 * utC(punktAnim.hovK) : 1);
      const syn = mjuk(0.75, 1.5, Math.hypot(p.pos[0] - K.x, p.pos[2] - K.z)) * (1 - mjuk(10, 15, d));
      gM.makeScale(s, 1, s).setPosition(p.pos[0], y, p.pos[2]); im.setMatrixAt(i, gM);
      punktSyn[i] = syn; a.setY(i, syn); a.setX(i, i === gang.hov ? 1 : 0);
    }
    im.instanceMatrix.needsUpdate = true; a.needsUpdate = true;
    if (skylt) placeraSkylt();
  }
  function placeraSkylt() {
    const p = punkter()[gang.hov];
    if (!skylt || !p) return;
    const y = punktGolv(p) + husGrupp.userData.delar.Y0;
    const d = Math.hypot(p.pos[0] - kamera.position.x, p.pos[2] - kamera.position.z);
    const s = Math.min(1.5, Math.max(0.75, 0.55 + d * 0.16));
    skylt.scale.set(1.1 * s, 0.41 * s, 1);
    skylt.position.set(p.pos[0], y + 0.42 + 0.16 * s, p.pos[2]);
  }
  function satHov(i) {
    if (i === gang.hov) return false;
    gang.hov = i;
    punktAnim.hovK = lugn ? 1 : 0; punktAnim.hovTid = punktAnim.tid; PUNKT_MAT.uniforms.uHovTid.value = punktAnim.hovTid;
    skalaPunkter(true);
    if (skylt) { scene.remove(skylt); skylt.material.map.dispose(); skylt.material.dispose(); skylt = null; }
    const p = i >= 0 ? punkter()[i] : null;
    if (p) {
      skylt = etikett(p.namn || 'Rum'); skylt.material.opacity = lugn ? 1 : 0;
      placeraSkylt(); scene.add(skylt);
    }
    const im = husGrupp && husGrupp.userData.punktMesh;
    if (im) { const a = im.geometry.attributes.aLjus; for (let j = 0; j < im.count; j++) a.setX(j, j === i ? 1 : 0); a.needsUpdate = true; }
    duk.style.cursor = p ? 'pointer' : '';
    return true;
  }
  // punkten ligger inne i en möbel eller vägg (lådorna på våningen)
  function inuti(x, z, niva) {
    const H = hinderLista();
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if ((b.niva === -1 || b.niva === niva) && stoppar(b) && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
    }
    return false;
  }
  // minsta avståndet till en vägg (möbler räknas inte)
  function friVagg(x, z, niva) {
    const H = hinderLista(); let m = 9;
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if (b.mobel || b.dorr >= 0 || (b.niva !== -1 && b.niva !== niva)) continue;
      m = Math.min(m, Math.hypot(x - Math.min(b.x1, Math.max(b.x0, x)), z - Math.min(b.z1, Math.max(b.z0, z))));
    }
    return m;
  }
  // Pekar man genom en dörröppning till ett annat rum? Vägen dit passerar en smal öppning
  // (vägg nära på båda sidor) och punkten hör till en annan rumspunkt än den man står vid.
  // Då går klicket till rummets punkt, vänd som rummet är tänkt att ses.
  function genomDorr(x, z, niva) {
    if (niva !== gang.niva) return -1;
    const P = punkter();
    if (P.length < 2) return -1;
    const cx = kamera.position.x, cz = kamera.position.z, L = Math.hypot(x - cx, z - cz);
    if (L < 1.1) return -1;
    const narmast = (px, pz) => {
      let b = -1, bd = Infinity;
      for (let i = 0; i < P.length; i++) { if (nivaTal(P[i].niva) !== niva) continue; const d = Math.hypot(P[i].pos[0] - px, P[i].pos[2] - pz); if (d < bd) { bd = d; b = i; } }
      return b;
    };
    const rT = narmast(x, z);
    if (rT < 0 || rT === narmast(cx, cz)) return -1;
    const ux = (x - cx) / L, uz = (z - cz) / L, n = Math.ceil(L / 0.12);
    for (let i = 2; i < n - 1; i++) {
      const s = i / n * L, px = cx + ux * s, pz = cz + uz * s;
      if (friVagg(px, pz, niva) > 0.04 && friVagg(px - uz * 0.62, pz + ux * 0.62, niva) < 0.22 && friVagg(px + uz * 0.62, pz - ux * 0.62, niva) < 0.22) return rT;
    }
    return -1;
  }
  function gomRing() { ring.alfaMal = 0; ring.giltig = false; }
  // Pekaren över duken: en strålning per ruta, och bara när pekaren rört sig
  function pekaGolv() {
    let byt = false;
    // i Spelläget gäller siktet (ram), inte pekaren
    if (!inneLage || !husGrupp || !gang.pekar || gang.glid || gang.tangent.size || spel.pa) {
      byt = ring.alfaMal > 0 || gang.hov >= 0; gomRing(); satHov(-1); if (!spel.pa && satMal(null)) byt = true; return byt;
    }
    if (rektSmuts) lasRekt();
    ndc.set((gang.px - dukV) / dukB * 2 - 1, -((gang.py - dukT) / dukH) * 2 + 1);
    ray.setFromCamera(ndc, kamera); ray.far = 16;
    // en dörr, lucka, låda, sittplats eller lampa under pekaren går före golvet och rumspunkterna
    const mt = traffaIa(NA_PEK);
    if (mt) {
      byt = ring.alfaMal > 0 || gang.hov >= 0;
      gomRing(); satHov(-1);
      if (satMal(mt)) byt = true;
      duk.style.cursor = 'pointer';
      ray.far = Infinity;
      return byt;
    }
    if (satMal(null)) { byt = true; duk.style.cursor = gang.hov >= 0 ? 'pointer' : ''; }
    // sittande: inget golv att gå till (rumsknapparna och kartan fungerar ändå)
    if (gang.sitter >= 0) { if (ring.alfaMal > 0 || gang.hov >= 0) byt = true; gomRing(); satHov(-1); ray.far = Infinity; return byt; }
    let hov = -1;
    const im = husGrupp.userData.punktMesh;
    traffar.length = 0;
    if (im && im.visible) {
      ray.intersectObject(im, false, traffar);
      for (let i = 0; i < traffar.length; i++) { const id = traffar[i].instanceId; if (!(punktSyn[id] < 0.3)) { hov = id; break; } }
    }
    const fore = ring.alfaMal, foreRod = ring.rodMal;
    gomRing();
    if (hov < 0) {
      traffar.length = 0;
      ray.intersectObjects(golvLista().lista, false, traffar);
      const t = traffar[0];
      if (t && t.point.y < kamera.position.y - 0.4) {
        // pekaren på en vägg: strålen går vidare till golvet bakom, det räknas inte
        const vg = vaggLista();
        let iVagg = false;
        if (vg.length) { ray.far = Math.max(0.01, t.distance - 0.05); traffar.length = 0; ray.intersectObjects(vg, false, traffar); iVagg = traffar.length > 0; }
        const x = t.point.x, z = t.point.z, niva = nivaFor(t);
        if (!iVagg && !inuti(x, z, niva)) {
          const f = fri(x, z, niva);
          ring.giltig = f >= RADIE || (f >= 0.12 && litetRum(x, z, niva));
          ring.mal.set(x, t.point.y + 0.012, z); ring.niva = niva; ring.golvY = t.point.y;
          if (t.face) { rN.copy(t.face.normal).transformDirection(t.object.matrixWorld); if (rN.y < 0) rN.negate(); ring.q.setFromUnitVectors(UPP, rN); }
          else ring.q.identity();
          // nära en vägg tonas ringen; ogiltigt mål: svag röd ring
          ring.alfaMal = ring.giltig ? 0.45 + 0.5 * mjuk(RADIE, RADIE + 0.45, f) : 0.5;
          ring.rodMal = ring.giltig ? 0 : 1;
          if (ring.giltig) hov = genomDorr(x, z, niva);
          byt = true;
        }
      }
    }
    if (satHov(hov)) byt = true;
    if (fore !== ring.alfaMal || foreRod !== ring.rodMal) byt = true;
    traffar.length = 0; ray.far = Infinity;
    return byt;
  }
  // ringen och etiketten: mjukt efter, puls vid klick. Sant så länge något rör sig.
  function stegRing(dt) {
    let ror = false;
    if (gang.hov >= 0 && punktAnim.hovK < 1) { punktAnim.hovK = Math.min(1, punktAnim.hovK + dt / 0.16); skalaPunkter(true); ror = true; }
    if (skylt && skylt.material.opacity < 1) { skylt.material.opacity = Math.min(1, skylt.material.opacity + dt / 0.2); ror = true; }
    const u = ringMat.uniforms;
    if (ring.puls >= 0) {
      ring.puls = Math.min(1, ring.puls + dt / 0.45);
      const e = 1 - (1 - ring.puls) ** 3;
      markor.scale.setScalar(1 + 0.6 * e);
      u.uAlfa.value = 0.95 * (1 - e); u.uPuls.value = e; u.uRod.value = 0;
      markor.visible = !FOTO;
      if (ring.puls >= 1) { ring.puls = -1; ring.alfa = 0; ring.rod = 0; markor.visible = false; markor.scale.setScalar(1); u.uPuls.value = 0; }
      return true;
    }
    const k = 1 - Math.exp(-dt / 0.06), ka = 1 - Math.exp(-dt / 0.09);
    if (ring.alfaMal > 0) {
      const d2 = markor.position.distanceToSquared(ring.mal);
      // ny ring, eller ett hopp på över 2 m: dit direkt
      if (ring.alfa < 0.03 || d2 > 4) { markor.position.copy(ring.mal); markor.quaternion.copy(ring.q); }
      else {
        if (d2 > 1e-6) { markor.position.lerp(ring.mal, k); ror = true; } else markor.position.copy(ring.mal);
        if (markor.quaternion.angleTo(ring.q) > 0.002) { markor.quaternion.slerp(ring.q, k); ror = true; } else markor.quaternion.copy(ring.q);
      }
    }
    const da = ring.alfaMal - ring.alfa, dr = ring.rodMal - ring.rod;
    if (Math.abs(da) > 0.005) { ring.alfa += da * ka; ror = true; } else ring.alfa = ring.alfaMal;
    if (Math.abs(dr) > 0.01) { ring.rod += dr * ka; ror = true; } else ring.rod = ring.rodMal;
    u.uAlfa.value = ring.alfa; u.uRod.value = ring.rod;
    markor.visible = ring.alfa > 0.005 && !FOTO;   // fotoläget: ingen gångring på golvet
    return ror;
  }
  function pulsa(pos, q) {
    if (lugn) { ring.alfa = 0; gomRing(); markor.visible = false; return; }
    markor.position.copy(pos); if (q) markor.quaternion.copy(q); else markor.quaternion.identity();
    ring.puls = 0; gomRing();
    begarRender();
  }
  // malPunkt (valfri, [x, y, z] som rumPunkter.mal): blicken vrids mjukt dit under glidningen
  const gS = new THREE.Spherical();
  const inUtSin = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
  // ögat på golvet g vid (x, z): OGON över golvet, men aldrig närmare taket än 0,18 m
  // (loftet och trappans övre del ligger under det sluttande taket)
  function ogonVid(x, z, g, niva) {
    let y = g + OGON;
    const tv = inneData().takVid;
    if (typeof tv === 'function') {
      const t = +tv(x, z, niva);
      if (Number.isFinite(t)) y = Math.max(g + 0.9, Math.min(y, husGrupp.userData.delar.Y0 + t - 0.18));
    }
    return y;
  }
  // Vägen för en glidning: punkter { x, z, g (golvet), nv (våningen), tr (sträckan dit är trappan) }.
  // Mellan våningarna går den via trappans fot, trappans topp + 0,4 m och sedan målet
  // (samma väg åt båda hållen). En vägg eller möbel på vägen: via närmaste dörröppning;
  // finns ingen och strikt är satt blir det ingen glidning (null).
  function vagTill(x, g, z, niva, strikt) {
    const P = kamera.position, Y0 = husGrupp.userData.delar.Y0;
    const p = [{ x: P.x, z: P.z, g: gang.golvY, nv: gang.niva, tr: false }];
    const via = (r, gg, nv) => (r || []).forEach(q => p.push({ x: q.x, z: q.z, g: gg, nv, tr: false }));
    const T = trappor();
    if (niva !== gang.niva && T.length) {
      let t = T[0], bd = Infinity;
      T.forEach(tt => { const d = Math.hypot((tt.xL + tt.xH) / 2 - P.x, (tt.z0 + tt.z1) / 2 - P.z); if (d < bd) { bd = d; t = tt; } });
      const dir = Math.sign(t.xH - t.xL) || 1, zc = (t.z0 + t.z1) / 2, upp = niva > gang.niva;
      const fot = { x: t.xL - dir * 0.35, z: zc, g: upp ? gang.golvY : g, nv: 0, tr: false };
      const topp = { x: t.xH + dir * 0.4, z: zc, g: Y0 + t.h, nv: 1, tr: false };
      const a = upp ? fot : topp, b = upp ? topp : fot;
      if (!trappaVid(P.x, P.z)) { via(rutt(P.x, P.z, a.x, a.z, gang.niva), gang.golvY, gang.niva); p.push(a); }
      p.push({ ...b, tr: true });
      via(rutt(b.x, b.z, x, z, niva), g, niva);
    } else {
      const r = rutt(P.x, P.z, x, z, niva);
      if (!r && strikt) return null;
      via(r, g, niva);
    }
    p.push({ x, z, g, nv: niva, tr: false });
    const s = [0];
    for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z));
    return { p, s, L: s[s.length - 1] };
  }
  // fri väg mellan två punkter (prov var 10:e cm); dörrarnas lådor räknas inte, de öppnas på vägen
  function vagFri(ax, az, bx, bz, niva) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.1));
    for (let i = 1; i < n; i++) { const u = i / n; if (fri(ax + (bx - ax) * u, az + (bz - az) * u, niva, true) < 0.1) return false; }
    return true;
  }
  // [] = rakt dit, [{ x, z }] = via en dörrlådas mitt, null = ingen väg
  function rutt(ax, az, bx, bz, niva) {
    if (vagFri(ax, az, bx, bz, niva)) return [];
    const H = hinderLista();
    let bast = null, bl = Infinity;
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if (b.dorr < 0 || (b.niva !== -1 && b.niva !== niva)) continue;
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, l = Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz);
      if (l < bl && vagFri(ax, az, cx, cz, niva) && vagFri(cx, cz, bx, bz, niva)) { bl = l; bast = { x: cx, z: cz }; }
    }
    return bast ? [bast] : null;
  }
  // läget längs vägen (e 0–1): x och z längs sträckorna, ögat följer golvet (trappan steg för steg)
  function glidPunkt(G, e) {
    const V = G.vag, d = e * V.L, Y0 = husGrupp.userData.delar.Y0;
    let i = 1;
    while (i < V.p.length - 1 && V.s[i] < d) i++;
    const a = V.p[i - 1], b = V.p[i], sl = V.s[i] - V.s[i - 1];
    const u = sl > 1e-6 ? Math.min(1, Math.max(0, (d - V.s[i - 1]) / sl)) : 1;
    const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
    let g = a.g + (b.g - a.g) * u, nv = u < 0.5 ? a.nv : b.nv;
    if (b.tr) {
      if (trappaVid(x, z)) { g = Y0 + TR.y; nv = TR.s > 0.5 ? 1 : 0; }
      else g = u < 0.5 ? a.g : b.g;
    }
    const P = kamera.position;
    P.x = x; P.z = z; P.y = ogonVid(x, z, g, nv) + G.dy0 * (1 - e);
    G.dx = b.x - a.x; G.dz = b.z - a.z;
  }
  // opt (sitta och resa sig): { y: ögats höjd, tid, satt: 'sitt' | 'res' }; strikt: avvisa en blockerad väg
  function glidTill(x, golvY, z, niva, malPunkt, opt) {
    if (flyg) return false;   // åkningen genom ytterdörren pågår
    const satt = opt && opt.satt;
    gang.blockerad = false;
    // allt annat än att sätta sig betyder att man reser sig först
    if (satt !== 'sitt' && gang.sitter >= 0) { gang.sitter = -1; gang.stod = null; meddelaSitt(); }
    const P = kamera.position;
    P.y -= spel.bob; P.x -= spel.bx; P.z -= spel.bz; spel.bob = spel.bx = spel.bz = 0;
    const till = new THREE.Vector3(x, opt && tal(opt.y) ? opt.y : ogonVid(x, z, golvY, niva), z);
    const vrid = Array.isArray(malPunkt) && malPunkt.length >= 3 && malPunkt.every(n => Number.isFinite(+n));
    if (till.distanceTo(P) < 0.05 && !vrid) return false;
    let vag = null, tid = opt && tal(opt.tid) ? opt.tid : 0.9;
    if (!satt) {
      vag = vagTill(x, golvY, z, niva, opt && opt.strikt);
      if (!vag) { gang.blockerad = true; return false; }
      // in-ut (sinus) på 0,45 s + 0,17 s per meter, högst 1,3 s
      if (!(opt && tal(opt.tid))) tid = Math.min(1.3, 0.45 + 0.17 * vag.L);
    }
    gang.glid = { fran: P.clone(), till, t: 0, tid, niva, golvY, satt, vag, dx: 0, dz: 0,
      dy0: vag ? P.y - ogonVid(P.x, P.z, gang.golvY, gang.niva) : 0 };
    if (vrid) {
      const b = styr.target.clone().sub(P), r = b.length() || 0.01;
      const m = new THREE.Vector3(+malPunkt[0], +malPunkt[1] + husGrupp.userData.delar.Y0, +malPunkt[2]).sub(till);
      if (m.lengthSq() > 1e-4) {
        const sF = new THREE.Spherical().setFromVector3(b), sT = new THREE.Spherical().setFromVector3(m);
        const pMin = styr.minPolarAngle + 0.02, pMax = styr.maxPolarAngle - 0.02;
        sT.phi = Math.min(pMax, Math.max(pMin, sT.phi)); sF.phi = Math.min(pMax, Math.max(pMin, sF.phi));
        let dth = sT.theta - sF.theta; if (dth > Math.PI) dth -= Math.PI * 2; if (dth < -Math.PI) dth += Math.PI * 2;
        Object.assign(gang.glid, { r, sF, sT, dth });
        // en stor vridning på stället får lite mer tid
        if (!satt) gang.glid.tid = Math.min(1.3, Math.max(gang.glid.tid, 0.5 + Math.abs(dth) * 0.25));
      }
    }
    gang.vx = gang.vz = 0; gang.hjul = 0;
    gomRing(); satHov(-1);
    begarRender();
    return true;
  }
  // en avbruten glidning: golvet och våningen letas upp där man är (stråle nedåt)
  function avbrytGlid() {
    gang.glid = null;
    const P = kamera.position, Y0 = husGrupp.userData.delar.Y0;
    gang.x = P.x; gang.z = P.z;
    if (trappaVid(P.x, P.z)) { gang.golvY = Y0 + TR.y; gang.niva = TR.s > 0.5 ? 1 : 0; return; }
    const golv = golvLista();
    if (!golv.riktig) return;
    gV3.set(P.x, P.y + 0.05, P.z); ray.set(gV3, NER); ray.far = 3.5; traffar.length = 0;
    ray.intersectObjects(golv.lista, false, traffar); ray.far = Infinity;
    const t = traffars0();
    if (t) { gang.golvY = t.point.y; gang.niva = nivaFor(t); }
  }
  function gaTill(i) {
    const p = punkter()[i | 0];
    if (!p || !inneLage) return false;
    return glidTill(p.pos[0], punktGolv(p) + husGrupp.userData.delar.Y0, p.pos[2], nivaTal(p.niva), p.mal);
  }
  // minsta avståndet från (x, z) till ett hinder på våningen. Trappans låda räknas inte (man går
  // uppför den, som i krockR); utanDorr: dörrarnas lådor räknas inte heller (vägen för en glidning)
  function fri(x, z, niva, utanDorr) {
    const H = hinderLista(); let m = 9;
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if ((b.niva !== -1 && b.niva !== niva) || b.trappa || (utanDorr ? b.dorr >= 0 : !stoppar(b))) continue;
      const dx = x - Math.min(b.x1, Math.max(b.x0, x)), dz = z - Math.min(b.z1, Math.max(b.z0, z));
      // möbler räknas som om de låg längre bort, så att den mindre radien gäller mot dem
      m = Math.min(m, Math.hypot(dx, dz) + (b.mobel ? RADIE - RADIE_M : 0));
    }
    return m;
  }
  // knuffa ut en cirkel ur lådorna på samma våning; att knuffa längs normalen ger glidning längs väggen
  function krock(nx, nz) {
    const x0 = nx, z0 = nz;
    krockR(nx, nz, RADIE);
    // trångt (bastun): får inte cirkeln plats tas en mindre radie
    if (fri(gang.x, gang.z, gang.niva) < RADIE * 0.9) krockR(x0, z0, 0.12);
  }
  function krockR(nx, nz, R) {
    const H = hinderLista(), d = husGrupp.userData;
    for (let varv = 0; varv < 3; varv++) {
      for (let i = 0; i < H.length; i++) {
        const b = H[i];
        if ((b.niva !== -1 && b.niva !== gang.niva) || b.trappa || !stoppar(b)) continue;
        const cx = Math.min(b.x1, Math.max(b.x0, nx)), cz = Math.min(b.z1, Math.max(b.z0, nz));
        const dx = nx - cx, dz = nz - cz, d2 = dx * dx + dz * dz, Rb = b.mobel ? Math.min(R, RADIE_M) : R;
        if (d2 >= Rb * Rb) continue;
        if (d2 > 1e-10) { const l = Math.sqrt(d2); nx = cx + dx / l * Rb; nz = cz + dz / l * Rb; }
        else {
          const a = nx - b.x0, bb = b.x1 - nx, c = nz - b.z0, e = b.z1 - nz, m = Math.min(a, bb, c, e);
          if (m === a) nx = b.x0 - Rb; else if (m === bb) nx = b.x1 + Rb; else if (m === c) nz = b.z0 - Rb; else nz = b.z1 + Rb;
        }
      }
    }
    const gx = d.L / 2 - Math.min(R, 0.2) - 0.12, gz = d.W / 2 - Math.min(R, 0.2) - 0.12;
    gang.x = Math.max(-gx, Math.min(gx, nx)); gang.z = Math.max(-gz, Math.min(gz, nz));
  }
  const traffars0 = () => { const t = traffar[0] || null; traffar.length = 0; return t; };
  // golvet under (gang.x, gang.z): trappan eller gångytan, högst ett trappsteg (0,45 m) från
  // golvet man står på. Sätter golvY och våningen och svarar sant om man kan stå där.
  function provaGolv() {
    if (trappaVid(gang.x, gang.z)) {
      const y = husGrupp.userData.delar.Y0 + TR.y;
      if (Math.abs(y - gang.golvY) > 0.45) return false;
      gang.golvY = y; gang.niva = TR.s > 0.5 ? 1 : 0;
      return true;
    }
    const golv = golvLista();
    if (!golv.riktig) return true;
    gV3.set(gang.x, gang.golvY + 0.6, gang.z);
    ray.set(gV3, NER); ray.far = 3; traffar.length = 0;
    ray.intersectObjects(golv.lista, false, traffar);
    ray.far = Infinity;
    const t = traffars0();
    if (!t || Math.abs(t.point.y - gang.golvY) > 0.45) return false;
    gang.golvY = t.point.y; gang.niva = nivaFor(t);
    return true;
  }
  // ett delsteg (dx, dz) från (gang.x, gang.z). Går det inte: i trappan hålls man mellan
  // trappans sidor, annars provas bara x-steget och bara z-steget (den blockerade ledens fart
  // nollas). Går inget blir man kvar (stopp).
  function steg1(dx, dz) {
    const cx = gang.x, cz = gang.z, gN = gang.golvY, nN = gang.niva;
    const t = trappaVid(cx, cz) ? TR.t : null;
    krock(cx + dx, cz + dz);
    if (provaGolv()) return true;
    gang.golvY = gN; gang.niva = nN;
    if (t) {
      const z = Math.min(t.z1 - 0.02, Math.max(t.z0 + 0.02, gang.z));
      if (z !== gang.z) { gang.z = z; if (provaGolv()) { gang.vz = 0; return true; } gang.golvY = gN; gang.niva = nN; }
    }
    if (Math.abs(dx) > 1e-6) { krock(cx + dx, cz); if (provaGolv()) { gang.vz = 0; return true; } gang.golvY = gN; gang.niva = nN; }
    if (Math.abs(dz) > 1e-6) { krock(cx, cz + dz); if (provaGolv()) { gang.vx = 0; return true; } gang.golvY = gN; gang.niva = nN; }
    gang.x = cx; gang.z = cz; gang.vx = gang.vz = 0; gang.hjul = 0;
    return false;
  }
  // Spelläget: musen tittar (0,0016 rad per bildpunkt), också under en glidning
  function spelTitt() {
    if (!spel.dx && !spel.dy) return false;
    gS.setFromVector3(gV);
    gS.theta -= spel.dx * 0.0016;
    gS.phi = Math.min(styr.maxPolarAngle - 0.02, Math.max(styr.minPolarAngle + 0.02, gS.phi + spel.dy * 0.0016));
    gV.setFromSpherical(gS);
    spel.dx = spel.dy = 0;
    return true;
  }
  function stegGang(dt) {
    gV.copy(styr.target).sub(kamera.position);    // blicken (någon cm framåt)
    const G = gang.glid, P = kamera.position;
    if (G) {
      G.t = Math.min(1, G.t + dt / G.tid);
      if (G.vag) glidPunkt(G, inUtSin(G.t));
      else {
        // sätta sig: först fram, sedan ned med en mjuk sjunkning (2–3 cm) som sätter sig;
        // resa sig: upp först, sedan bort
        const e = inUt(G.t);
        P.lerpVectors(G.fran, G.till, e);
        const sitt = G.satt === 'sitt', ky = sitt ? utC(del(G.t, 0.12, 1)) : utC(G.t);
        P.y = G.fran.y + (G.till.y - G.fran.y) * ky - (sitt ? 0.028 * Math.sin(Math.PI * del(G.t, 0.62, 1)) : 0);
        G.dx = G.till.x - G.fran.x; G.dz = G.till.z - G.fran.z;
      }
      // musen i Spelläget tar över blicken; annars vrids den mot målet
      if (spelTitt()) G.sF = null;
      else if (G.sF) {
        const ev = inUt(Math.min(1, G.t * 1.1));
        gS.set(G.r, G.sF.phi + (G.sT.phi - G.sF.phi) * ev, G.sF.theta + G.dth * ev);
        gV.setFromSpherical(gS);
      }
      // en stängd dörr på vägen öppnas när man kommer fram till den
      if (!G.satt && ia.auto && G.t < 0.97) {
        const l = Math.hypot(G.dx, G.dz);
        if (l > 0.05) autoDorr(P.x + G.dx / l * 0.7, P.z + G.dz / l * 0.7, -2);
      }
      styr.target.copy(P).add(gV);
      if (G.t >= 1) { gang.niva = G.niva; gang.golvY = G.golvY; gang.glid = null; gang.x = P.x; gang.z = P.z; }
      return true;
    }
    // Spelläget: musen (pekarlåset) tittar fritt
    let ror = spelTitt();
    const T = gang.tangent;
    // sittande: man tittar runt men går inte (WASD reser en, se tangenterna)
    if (gang.sitter >= 0) {
      gang.vx = gang.vz = gang.vrid = gang.hjul = 0;
      if (ror) styr.target.copy(P).add(gV);
      return ror;
    }
    const fw = (T.has('f') ? 1 : 0) - (T.has('b') ? 1 : 0), st = (T.has('h') ? 1 : 0) - (T.has('v') ? 1 : 0), q = (T.has('e') ? 1 : 0) - (T.has('q') ? 1 : 0);
    // start τ 0,14 s, inbromsning τ 0,11 s; Skift ×1,6; i trappan 0,55 av farten
    const k = 1 - Math.exp(-dt / (fw || st ? 0.14 : 0.11)), kv = 1 - Math.exp(-dt / (q ? 0.12 : 0.15));
    const fart = FART * (gang.snabb ? 1.6 : 1) * (trappaVid(P.x - spel.bx, P.z - spel.bz) ? 0.55 : 1);
    gV2.set(gV.x, 0, gV.z); if (gV2.lengthSq() < 1e-10) gV2.set(0, 0, -1); gV2.normalize();
    let tx = gV2.x * fw - gV2.z * st, tz = gV2.z * fw + gV2.x * st;
    const tl = Math.hypot(tx, tz); if (tl > 1) { tx /= tl; tz /= tl; }
    gang.vx += (tx * fart - gang.vx) * k; gang.vz += (tz * fart - gang.vz) * k;
    gang.vrid += (q * 1.9 - gang.vrid) * kv;
    // hjulet: ett mjukt kliv fram eller bak längs blicken (tidskonstant 0,18 s)
    let hx = 0, hz = 0;
    if (Math.abs(gang.hjul) > 0.002) { const s = gang.hjul * (1 - Math.exp(-dt / 0.18)); gang.hjul -= s; hx = gV2.x * s; hz = gV2.z * s; }
    else gang.hjul = 0;
    if (fw || st || q || hx || hz) ror = true;
    if (Math.abs(gang.vrid) > 0.003) {
      const a = gang.vrid * dt, c = Math.cos(a), sn = Math.sin(a), x = gV.x * c - gV.z * sn;
      gV.z = gV.x * sn + gV.z * c; gV.x = x;
      ror = true;
    } else gang.vrid = 0;
    // gungningen räknas ovanpå ögonhöjden och läget
    P.y -= spel.bob; P.x -= spel.bx; P.z -= spel.bz;
    const fv = Math.hypot(gang.vx, gang.vz);
    if (fv > 0.004 || hx || hz) {
      // går man mot en stängd dörr öppnas den (en knapp halvmeter framför)
      if (ia.auto && fv > 0.25) autoDorr(P.x + gang.vx * 0.42, P.z + gang.vz * 0.42, gang.niva);
      // delsteg om högst 7 cm med krock i vart och ett: ingen tunnling genom tunna väggar
      const dx = gang.vx * dt + hx, dz = gang.vz * dt + hz, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.07));
      gang.x = P.x; gang.z = P.z;
      for (let i = 0; i < n; i++) if (!steg1(dx / n, dz / n)) break;
      P.x = gang.x; P.z = gang.z;
      ror = true;
    } else gang.vx = gang.vz = 0;
    const ty = ogonVid(P.x, P.z, gang.golvY, gang.niva);
    if (Math.abs(P.y - ty) > 0.002 && (ror || T.size)) { P.y += (ty - P.y) * (1 - Math.pow(0.0004, dt)); ror = true; }
    // gungningen när man går, bara i Spelläget: 1,2 cm upp och ned, 0,6 cm i sidled (halva takten)
    if (spel.pa && !lugn) {
      const v = Math.hypot(gang.vx, gang.vz);
      spel.amp += ((v > 0.15 ? Math.min(1, v / FART) : 0) - spel.amp) * (1 - Math.exp(-dt / 0.16));
      spel.fas += dt * Math.PI * 2 * (1.0 + 0.55 * v);
      if (spel.amp < 0.002) spel.amp = 0;
      const sid = 0.006 * spel.amp * Math.sin(spel.fas * 0.5);
      spel.bob = 0.012 * spel.amp * Math.sin(spel.fas);
      spel.bx = -gV2.z * sid; spel.bz = gV2.x * sid;
      if (spel.amp) ror = true;
    } else spel.bob = spel.bx = spel.bz = 0;
    P.y += spel.bob; P.x += spel.bx; P.z += spel.bz;
    if (ror) styr.target.copy(P).add(gV);
    return ror;
  }
  function gangStart(ogon, v) {
    gang.glid = null; gang.vx = gang.vz = gang.vrid = gang.hjul = 0; gang.sistMal = null;
    if (gang.sitter >= 0) { gang.sitter = -1; gang.stod = null; meddelaSitt(); }
    spel.bob = spel.bx = spel.bz = spel.amp = 0;
    gang.niva = v.niva !== undefined ? nivaTal(v.niva) : (v.pos[1] > 2.1 ? 1 : 0);
    gang.golvY = ogon.y - OGON;
    const golv = golvLista();
    if (golv.riktig) {
      gV2.set(ogon.x, ogon.y + 0.1, ogon.z); ray.set(gV2, NER); ray.far = 2.6; traffar.length = 0;
      ray.intersectObjects(golv.lista, false, traffar); ray.far = Infinity;
      if (traffar.length) { gang.golvY = traffar[0].point.y; gang.niva = nivaFor(traffar[0]); }
      traffar.length = 0;
    }
    const im = byggPunkter(); if (im) { im.visible = !FOTO; skalaPunkter(true); }   // fotoläget: inga rumsringar på golvet
    try { iaData(); meddelaLampor(); } catch (e) { console.warn(e); }
    flytt.smuts = true; flytt.rum = -1;
  }
  function gangSlut() {
    gang.glid = null; gang.tangent.clear(); gang.vx = gang.vz = gang.vrid = gang.hjul = 0; gang.sistMal = null; gang.snabb = false;
    if (gang.sitter >= 0) { gang.sitter = -1; gang.stod = null; meddelaSitt(); }
    spelAv(true); satMal(null);
    gomRing(); ring.alfa = 0; ring.puls = -1; markor.visible = false; markor.scale.setScalar(1); satHov(-1);
    const im = husGrupp && husGrupp.userData.punktMesh; if (im) im.visible = false;
  }
  window.addEventListener('keydown', e => {
    vakna();
    if (!inneLage || e.altKey || e.ctrlKey || e.metaKey) return;
    const ae = document.activeElement;
    if (ae !== duk && !gang.pekar && !spel.pa) return;
    if (ae && ae !== duk && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (e.key === 'Shift') { gang.snabb = true; return; }
    // E: öppna, stäng, sätt dig, tänd. Utan något inom räckhåll vrider E som förut (inte i Spelläget).
    if (e.code === 'KeyE') {
      const m = !gang.glid ? eMal() : null;
      if (m || spel.pa) { e.preventDefault(); if (m && !e.repeat) gorMal(m); return; }
    }
    if (e.code === 'Escape' && spel.pa) { spelAv(true); return; }
    const k = TANGENT[e.code];
    if (!k) return;
    e.preventDefault();
    if (gang.sitter >= 0) {
      // sittande: ett steg åt något håll reser en (vrida går inte)
      if (k !== 'q' && k !== 'e' && !e.repeat) resDig();
      if (k === 'q' || k === 'e') return;
    } else if (gang.glid && !gang.glid.satt && !e.repeat) avbrytGlid();   // upprepade tangenter avbryter inte
    if (!gang.tangent.has(k)) { gang.tangent.add(k); begarRender(); }
  });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') gang.snabb = false; const k = TANGENT[e.code]; if (k) gang.tangent.delete(k); });
  window.addEventListener('blur', () => { gang.tangent.clear(); gang.snabb = false; });
  // Styrspaken på pekskärm (sidan ritar den): fram/bak och sidled, -1..1. Den trycker på samma
  // riktningar som W A S D, så gången, krocken, trappan och dörrarna beter sig likadant.
  let spakNu = new Set();
  function satSpak(fw, st) {
    const vill = new Set();
    if (inneLage && !spel.pa && !flyg) {
      if (fw > 0.34) vill.add('f'); else if (fw < -0.34) vill.add('b');
      if (st > 0.34) vill.add('h'); else if (st < -0.34) vill.add('v');
    }
    if (vill.size && !spakNu.size) {
      // första rörelsen: reser en som sitter, avbryter en glidning (som en tangent)
      if (gang.sitter >= 0) { resDig(); return; }
      if (gang.glid && !gang.glid.satt) avbrytGlid();
    }
    if (gang.sitter >= 0) vill.clear();
    spakNu.forEach(k => { if (!vill.has(k)) gang.tangent.delete(k); });
    vill.forEach(k => gang.tangent.add(k));
    spakNu = vill;
    vakna(); begarRender();
  }
  // ---- Saker att göra inne: dörrar, luckor och lådor, sittplatser och lampor ----
  // Inredningen lämnar userData.oppningsbara [{ obj, typ, axel, max, start, namn }] (obj är en
  // pivå vid gångjärnet eller lådans stängda läge, i stängt läge när den lämnas över),
  // sittplatser [{ namn, pos, mal }] med sittYtor (osynliga lådor, userData.sitt = index) och
  // lampor [{ namn, pos, mesh, rum, brytare }]. Allt läses en gång per hus (userData.ia);
  // saknade fält ger bara färre saker att göra. Pekaren eller siktet visar vad man kan göra,
  // klick, tryck eller E gör det. Rörelserna ritas bara medan de pågår.
  const OPP_TID = 0.45, LAMP_TID = 0.25, NA_E = 2, NA_E2 = 2.4, NA_PEK = 3.6, SITT_Y = 1.15;
  const AXEL = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const TONING = new THREE.Color(0xfff0dc);
  const OPP_ORD = { dorr: 'dörr', lucka: 'lucka', lada: 'låda' };
  const BRYT_GEO = new THREE.BoxGeometry(0.14, 0.18, 0.14);
  const iaQ = new THREE.Quaternion(), iaQ2 = new THREE.Quaternion(), iaV = new THREE.Vector3(), iaV2 = new THREE.Vector3(), iaV3 = new THREE.Vector3(), iaBox = new THREE.Box3();
  // mal: det pekaren eller siktet står på ({ sort: 'opp' | 'sitt' | 'lampa', i, d }); auto: dörrar öppnas när man går in i dem
  const ia = { mal: null, annons: '', auto: alternativ.autoDorr !== false };
  // Spelläget: pekarlås, musen tittar, siktet i mitten; gungning när man går
  const spel = { pa: false, dx: 0, dy: 0, bob: 0, bx: 0, bz: 0, fas: 0, amp: 0, smuts: false, siktT: 0, skuld: false };
  // ljusPreset: morgon (låg varm sol från öster), dag, gyllene timmen (låg sol, skymningen
  // börjar), kväll (blå natt ute, lamporna tända inne)
  const LJUS_PRESET = { morgon: 7.5, dag: 13, gyllene: 19.2, kvall: 21.5 };
  let presetId = 0;
  const lampMinne = {};   // per hus medan sidan är öppen: lampans val när man själv tänt eller släckt
  let rumNu = -1;
  const ljusHem = new THREE.Vector3();
  const meddela = (namn, v) => { if (typeof alternativ[namn] === 'function') { try { alternativ[namn](v); } catch (e) { console.warn(e); } } };

  // materialet klonas en gång per del (för toningen vid hovring); klippningen och shaderns
  // tillägg följer med, så programmet blir detsamma (ingen omkompilering)
  function klonaMat(m) {
    const ud = m.userData; m.userData = {};
    let c;
    try { c = m.clone(); } finally { m.userData = ud; }
    c.userData = Object.assign({}, ud, { motorStyrd: true });
    c.clippingPlanes = m.clippingPlanes; c.clipShadows = m.clipShadows;
    c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey;
    return c;
  }
  function iaData() {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.inne) return null;
    if (d.ia) return d.ia;
    const ud = d.inne.userData, ut = { opp: [], sitt: [], lampor: [], meshes: [], vem: new Map() };
    d.inne.updateMatrixWorld(true);
    const lagg = (rot, mal) => {
      if (rot && rot.isObject3D) rot.traverse(o => { if (o.isMesh && !ut.vem.has(o)) { ut.meshes.push(o); ut.vem.set(o, mal); } });
    };
    (Array.isArray(ud.oppningsbara) ? ud.oppningsbara : []).forEach((x, i) => {
      ut.opp[i] = null;
      if (!x || !x.obj || !x.obj.isObject3D) return;
      try {
        const typ = x.typ === 'lucka' || x.typ === 'lada' ? x.typ : 'dorr';
        const axel = AXEL[x.axel] ? x.axel : typ === 'lada' ? 'z' : typ === 'lucka' ? 'x' : 'y';
        const max = tal(x.max) && x.max !== 0 ? x.max : typ === 'lada' ? 0.35 : typ === 'lucka' ? -1.6 : 1.65;
        const obj = x.obj, start = x.start === 1 || x.start === true ? 1 : 0;
        // pivån står i sin hållare: stängd = läge och vridning 0 (inredningen har redan satt start)
        const q1 = obj.quaternion.clone(), p1 = obj.position.clone();
        obj.quaternion.identity(); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
        iaBox.setFromObject(obj);
        const cL = iaBox.isEmpty() ? new THREE.Vector3() : obj.worldToLocal(iaBox.getCenter(new THREE.Vector3()));
        obj.quaternion.copy(q1); obj.position.copy(p1); obj.updateMatrixWorld(true);
        const mats = [], byt = new Map();
        let skugga = false;
        obj.traverse(o => {
          if (!o.isMesh) return;
          if (o.castShadow) skugga = true;
          const ar = Array.isArray(o.material);
          const l = (ar ? o.material : [o.material]).map(m => {
            if (!m || !m.emissive) return m;
            if (!byt.has(m)) { const c = klonaMat(m); byt.set(m, c); mats.push({ m: c, e: c.emissive.clone().multiplyScalar(c.emissiveIntensity) }); }
            return byt.get(m);
          });
          o.material = ar ? l : l[0];
        });
        const o = { obj, typ, axel, max, namn: x.namn || '', rum: typeof x.rum === 'string' ? x.rum : '', passage: false, q0: new THREE.Quaternion(), p0: new THREE.Vector3(), cL, mats, skugga,
          t: start, mal: start, fran: start, k: -1, tecken: typ === 'dorr' ? Math.sign(max) || 1 : 1, hov: 0, hovMal: 0 };
        ut.opp[i] = o;
        if (start) satsOpp(o);
        lagg(obj, { sort: 'opp', i });
      } catch (e) { console.warn(e); }
    });
    // dörrarna mellan rummen: de som har en låda i hinder (syns alltid inifrån)
    (Array.isArray(ud.hinder) ? ud.hinder : []).forEach(b => { if (b && Number.isInteger(b.dorr) && ut.opp[b.dorr]) ut.opp[b.dorr].passage = true; });
    (Array.isArray(ud.sittplatser) ? ud.sittplatser : []).forEach((s, i) => {
      const ok = s && Array.isArray(s.pos) && s.pos.length >= 3 && s.pos.every(n => Number.isFinite(+n));
      ut.sitt[i] = ok ? { namn: s.namn || '', pos: s.pos.map(Number), mal: Array.isArray(s.mal) && s.mal.length >= 3 && s.mal.every(n => Number.isFinite(+n)) ? s.mal.map(Number) : null } : null;
    });
    const sy = ud.sittYtor;
    (Array.isArray(sy) ? sy : sy && sy.isObject3D ? [sy] : []).forEach(r => {
      if (r && r.isObject3D) r.traverse(o => { const i = o.userData.sitt; if (o.isMesh && Number.isInteger(i) && ut.sitt[i] && !ut.vem.has(o)) { ut.meshes.push(o); ut.vem.set(o, { sort: 'sitt', i }); } });
    });
    const P = punkter(), minne = lampMinne[val.modell] || (lampMinne[val.modell] = {});
    (Array.isArray(ud.lampor) ? ud.lampor : []).forEach((l, i) => {
      ut.lampor[i] = null;
      if (!l || !Array.isArray(l.pos) || l.pos.length < 3 || !l.pos.every(n => Number.isFinite(+n))) return;
      const pos = l.pos.map(Number), mats = [];
      if (l.mesh && l.mesh.isObject3D) l.mesh.traverse(o => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (!m || !m.emissive || mats.includes(m)) return;
          // motorn tar över (inredningen och nattInne rör den inte längre); skärmen lyser 0,22 av lampan
          m.userData.styrd = true; m.userData.motorStyrd = true;
          m.userData.lampSkala = /-skarm$/.test(o.name) ? 0.22 : 1;
          m.userData.lampFarg = m.emissive.getHex() !== 0 ? m.emissive.clone() : LAMPVIT.clone();
          mats.push(m);
        });
      });
      // strömbrytaren (ett läge [x, y, z] vid dörren): en osynlig träffyta, inget ritanrop
      let bryt = null;
      if (Array.isArray(l.brytare) && l.brytare.length >= 3 && l.brytare.every(n => Number.isFinite(+n))) {
        bryt = new THREE.Mesh(BRYT_GEO, GOLV_OSYNLIG);
        bryt.position.set(+l.brytare[0], +l.brytare[1], +l.brytare[2]); bryt.name = 'brytare-' + i;
        d.inne.add(bryt); bryt.updateMatrixWorld(true);
      } else if (l.brytare && l.brytare.isObject3D) bryt = l.brytare;
      // rummet: index eller namn bland rumPunkterna, annars närmaste på samma våning
      let ri = -1;
      if (Number.isInteger(l.rum) && P[l.rum]) ri = l.rum;
      else if (typeof l.rum === 'string') ri = P.findIndex(p => p.namn === l.rum);
      if (ri < 0) {
        const nv = pos[1] > 2.1 ? 1 : 0; let b = Infinity;
        P.forEach((p, j) => { if (nivaTal(p.niva) !== nv) return; const dd = Math.hypot(p.pos[0] - pos[0], p.pos[2] - pos[2]); if (dd < b) { b = dd; ri = j; } });
      }
      const pa = typeof minne[i] === 'boolean' ? minne[i] : ljus.kvall > 0.4;
      const halo = Array.isArray(l.halo) ? l.halo.filter(p => Array.isArray(p) && p.length >= 4 && p.every(n => Number.isFinite(+n))).map(p => p.map(Number)) : null;
      const L = { namn: l.namn || '', pos, mats, ri, pa, t: pa ? 1 : 0, mesh: l.mesh && l.mesh.isObject3D ? l.mesh : null, halo };
      ut.lampor[i] = L; satsLampa(L);
      lagg(l.mesh, { sort: 'lampa', i });
      lagg(bryt, { sort: 'lampa', i });
    });
    d.ia = ut;
    if (tomt.pa) tomtIa(ut);   // tomt hus: de lösa lamporna och sittplatserna är borta
    if (ut.lampor.some(Boolean)) satLampLjus();
    return ut;
  }
  // läget t (0 stängd, 1 öppen; under rörelsen en aning förbi) på pivån
  function satsOpp(o) {
    if (o.delar) {
      // fönstrets bågar vrids inåt (höger båge åt andra hållet); skjutdörren glider i sidled
      o.delar.forEach(p => { if (o.typ === 'skjut') p.obj.position.x = o.max * o.t; else p.obj.rotation.y = o.max * o.t * p.tecken; });
      return;
    }
    const obj = o.obj;
    if (o.typ === 'lada') { obj.position.copy(o.p0); obj.position[o.axel] += o.max * o.t; }
    else obj.quaternion.copy(o.q0).multiply(iaQ.setFromAxisAngle(AXEL[o.axel], (o.typ === 'dorr' ? Math.abs(o.max) * o.tecken : o.max) * o.t));
    if (!obj.matrixAutoUpdate) obj.updateMatrix();
    obj.matrixWorldNeedsUpdate = true;
  }
  // ---- Fönstren: byggs ut ur de hopslagna väggarna först när de används ----
  const fonsterLista = () => (husGrupp && husGrupp.userData.fonster) || [];
  const fM = new THREE.Matrix4();
  function fonsterUt(j) {
    const f = fonsterLista()[j];
    if (!f) return null;
    if (f.o) return f.o;
    // bågarna och glaset i de hopslagna ytorna: hörnen dras ihop till en punkt (osynliga trianglar)
    f.bitar.forEach(b => {
      if (b.hela) { b.mesh.visible = false; return; }
      const p = b.mesh.geometry.attributes.position;
      const x = p.getX(b.start), y = p.getY(b.start), z = p.getZ(b.start);
      for (let v = b.start; v < b.start + b.count; v++) p.setXYZ(v, x, y, z);
      p.needsUpdate = true;
    });
    const vaggar = husGrupp.userData.delar.vaggar, delar = [], skjut = f.typ === 'sk';
    const { mtx, rutor, KARM, SB, pw, u0, v0, v1, cv, h, zb } = f, hh = h - 2 * KARM;
    const box = (w2, h2, d2, x, y, z) => new THREE.BoxGeometry(w2, h2, d2).translate(x, y, z);
    const lagg = (geo, material, foralder) => { const m = new THREE.Mesh(geo, material); m.receiveShadow = true; foralder.add(m); return m; };
    const fastGlas = [];
    for (let i = 0; i < rutor; i++) {
      const a = u0 + KARM + pw * i, bu = a + pw;
      const pa = a + (i ? KARM * 0.7 : 0), pb = bu - (i < rutor - 1 ? KARM * 0.7 : 0), pww = pb - pa;
      if (skjut && i !== rutor - 1) { fastGlas.push(box(pww - 0.01, hh, 0.01, (pa + pb) / 2, cv, f.z - 0.01)); continue; }
      // svenska fönster går inåt: vänster båge på vänster gångjärn, den sista bågen (om fler än en) på höger
      const hoger = !skjut && rutor > 1 && i === rutor - 1, hu = skjut ? (pa + pb) / 2 : hoger ? pb : pa;
      // skjutdelen löper 5 cm innanför den fasta, så att den går fri från mittposten
      const fast = new THREE.Group();
      fM.copy(mtx).multiply(gM.makeTranslation(hu, cv, zb - (skjut ? 0.05 : 0)));
      fM.decompose(fast.position, fast.quaternion, fast.scale);
      const obj = new THREE.Group(); fast.add(obj);
      const ox = (pa + pb) / 2 - hu;
      // samma två skikt som i oppning(): detaljfärg utåt, ljus insida
      [[0.03, 0.01, mat.bagYtter], [0.02, -0.015, mat.bagInsida]].forEach(([dd, dz, mm]) => lagg(mergeGeometries([
        box(pww, SB, dd, ox, v1 - KARM - SB / 2 - cv, dz), box(pww, SB * 1.25, dd, ox, v0 + KARM + SB * 0.625 - cv, dz),
        box(SB, hh, dd, pa + SB / 2 - hu, 0, dz), box(SB, hh, dd, pb - SB / 2 - hu, 0, dz)]), mm, obj));
      const gl = lagg(box(pww - 0.01, hh, 0.01, ox, 0, 0.002), mat.glas, obj); gl.renderOrder = 2; gl.userData.glas = true;
      if (skjut) lagg(box(0.03, 0.55, 0.03, f.cu + f.w * 0.18 - hu, 1.05 - cv, f.z + 0.05 - zb + 0.05), mat.handtag, obj);
      vaggar.add(fast); fast.updateMatrixWorld(true);
      delar.push({ obj, tecken: hoger ? -1 : 1 });
    }
    if (fastGlas.length) {
      const g = new THREE.Mesh(mergeGeometries(fastGlas).applyMatrix4(mtx), mat.glas);
      g.renderOrder = 2; g.userData.glas = true; vaggar.add(g);
    }
    if (oppen.pa || oppen.t > 0) klippAlla();
    f.o = { fonster: true, typ: skjut ? 'skjut' : 'fonster', delar, obj: delar[0] && delar[0].obj, max: skjut ? -Math.min(0.9, pw * 0.92) : 1.31,
      mats: [], skugga: false, t: 0, mal: 0, fran: 0, k: -1, hov: 0, hovMal: 0, cL: new THREE.Vector3() };
    begarRender();
    return f.o;
  }
  // skuggkartan räknas om en gång när rörelsen är klar, och bara när delen kastar skugga i
  // solljuset (dagtid, nära en yttervägg med fönster). Lamporna inne kastar inga skuggor.
  function oppKlar(o) {
    if (o.fonster || !o.skugga || sol.intensity < 0.15) return;
    const d = husGrupp.userData, p = o.obj.getWorldPosition(iaV);
    if (Math.min(d.L / 2 - Math.abs(p.x), d.W / 2 - Math.abs(p.z)) < 1.8) nySkugga = true;
  }
  function vaxlaOpp(i, auto) {
    const ut = iaData();
    return vaxlaO(ut && ut.opp[i], auto);
  }
  function vaxlaO(o, auto) {
    if (!o) return false;
    const till = o.mal > 0.5 ? 0 : 1;
    if (auto && till === 0) return false;
    if (auto && o.k >= 0) return false;
    // auto-öppningen vilar en sekund efter att man själv stängt dörren
    if (auto && o.stangd && performance.now() - o.stangd < 1000) return false;
    if (till === 0 && o.typ === 'dorr' && !o.fonster && inneLage && iStorrOppning(o)) return false;
    if (till === 0 && !auto) o.stangd = performance.now();
    // dörrar öppnas bort från den som öppnar: åt det håll bladets mitt rör sig bort från kameran
    if (till === 1 && o.typ === 'dorr' && Math.abs(o.t) < 0.02) {
      o.obj.updateMatrixWorld(true);
      const c = o.obj.localToWorld(iaV.copy(o.cL));
      const r = iaV2.copy(c).sub(o.obj.getWorldPosition(iaV3));
      const ax = iaV3.copy(AXEL[o.axel]).applyQuaternion(o.obj.getWorldQuaternion(iaQ2));
      const s = ax.cross(r).dot(r.copy(c).sub(kamera.position));
      if (Math.abs(s) > 1e-6) o.tecken = s > 0 ? 1 : -1;
    }
    o.fran = o.t; o.mal = till; o.k = 0;
    if (lugn) { o.t = till; o.k = -1; satsOpp(o); oppKlar(o); }
    iaAnnonsera(); begarRender();
    return true;
  }
  // står man i dörröppningen (cirkeln når in i dörrens låda) går dörren inte att stänga
  function iStorrOppning(o) {
    const ut = husGrupp && husGrupp.userData.ia, i = ut ? ut.opp.indexOf(o) : -1;
    if (i < 0) return false;
    const H = hinderLista(), x = kamera.position.x, z = kamera.position.z;
    for (let j = 0; j < H.length; j++) {
      const b = H[j];
      if (b.dorr !== i || (b.niva !== -1 && b.niva !== gang.niva)) continue;
      if (Math.hypot(x - Math.min(b.x1, Math.max(b.x0, x)), z - Math.min(b.z1, Math.max(b.z0, z))) < RADIE) return true;
    }
    return false;
  }
  // går man (eller glider) mot en stängd dörr öppnas den; niva -2 = vilken våning som helst
  function autoDorr(x, z, niva) {
    if (!ia.auto) return;
    const ut = iaData();
    if (!ut || !ut.opp.length) return;
    const H = hinderLista(), R = RADIE + 0.08;
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if (b.dorr < 0 || (niva !== -2 && b.niva !== -1 && b.niva !== niva)) continue;
      const o = ut.opp[b.dorr];
      if (!o || o.mal > 0.5) continue;
      const dx = x - Math.min(b.x1, Math.max(b.x0, x)), dz = z - Math.min(b.z1, Math.max(b.z0, z));
      if (dx * dx + dz * dz < R * R) vaxlaOpp(b.dorr, true);
    }
  }
  // ---- lamporna: egenglöden 0–2,5 på 0,25 s (smoothstep, ingen flimmer) ----
  function satsLampa(L) {
    const e = L.t * L.t * (3 - 2 * L.t);
    L.mats.forEach(m => { m.emissive.copy(m.userData.lampFarg || LAMPVIT); m.emissiveIntensity = 2.5 * e * (m.userData.lampSkala || 1); });
    haloLampa(L);
  }
  // Utifrån syns inredningen mest genom glaset: de rörliga delarna göms (färre ritanrop) och
  // lamporna syns bara när de lyser på kvällen. Inifrån och i dockskåpet syns allt.
  function lamporUte(ut, nyckel) {
    if (!nyckel.includes('1')) nyckel = '';
    if (ut.uteNyckel === nyckel) return;
    ut.uteNyckel = nyckel;
    (ut.uteMesh || []).forEach(m => { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); });
    ut.uteMesh = [];
    const ig = husGrupp.userData.inne;
    if (!nyckel || !ig) return;
    ig.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(ig.matrixWorld).invert(), M = new THREE.Matrix4();
    const hinkar = { lampa: { geos: [], m: null }, skarm: { geos: [], m: null } };
    ut.lampor.forEach(L => {
      if (!L || !L.pa || !L.mesh) return;
      L.mesh.traverse(o => {
        if (!o.isMesh || !o.geometry || Array.isArray(o.material)) return;
        const h = (o.material.userData.lampSkala || 1) < 1 ? hinkar.skarm : hinkar.lampa;
        M.multiplyMatrices(inv, o.matrixWorld);
        h.geos.push(o.geometry.clone().applyMatrix4(M));
        if (!h.m) h.m = o.material;
      });
    });
    Object.values(hinkar).forEach(h => {
      if (!h.geos.length) return;
      let geo = null;
      try { geo = mergeGeometries(h.geos, false); } catch (e) { geo = null; }
      h.geos.forEach(g => g.dispose());
      if (!geo) return;
      // samma material som en tänd lampa (klonat, med samma klippning): ingen ny shader
      const mt = klonaMat(h.m);
      mt.emissive.copy(h.m.userData.lampFarg || LAMPVIT); mt.emissiveIntensity = 2.5 * (h.m.userData.lampSkala || 1);
      const m = new THREE.Mesh(geo, mt);
      m.name = 'lampor-ute'; m.castShadow = false; m.receiveShadow = false;
      ig.add(m); ut.uteMesh.push(m);
    });
  }
  // Inifrån syns skåpen bara i rummet man står i och rummen som hänger ihop med det (öppen
  // planlösning); dörrarna mellan rummen syns alltid. Utifrån syns bara dörrarna, inom 12 m.
  const UTE_NARA2 = 12 * 12;
  function rumGrannar(namn) {
    const d = husGrupp.userData;
    if (d.rumGrannar === undefined) {
      const P = punkter(), vg = vaggLista(), Y0 = d.delar.Y0, karta = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3();
      P.forEach(p => { if (!karta.has(p.namn)) karta.set(p.namn, new Set([p.namn])); });
      if (vg.length) {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const A = P[i], B = P[j];
          if (A.namn === B.namn || nivaTal(A.niva) !== nivaTal(B.niva)) continue;
          // fri sikt mellan rumspunkterna i ögonhöjd = samma rum i öppen planlösning (eller en öppning)
          a.set(A.pos[0], +A.pos[1] + Y0, A.pos[2]); b.set(B.pos[0], +B.pos[1] + Y0, B.pos[2]);
          const L = a.distanceTo(b);
          if (L < 0.01) continue;
          ray.set(a, b.sub(a).divideScalar(L)); ray.far = L; traffar.length = 0;
          ray.intersectObjects(vg, false, traffar);
          if (!traffar.length) { karta.get(A.namn).add(B.namn); karta.get(B.namn).add(A.namn); }
          traffar.length = 0;
        }
        ray.far = Infinity;
      }
      d.rumGrannar = vg.length && P.length ? karta : false;
    }
    return d.rumGrannar ? d.rumGrannar.get(namn) || null : null;
  }
  function iaSynlighet() {
    const d = husGrupp && husGrupp.userData, ut = d && d.ia;
    if (!ut) return;
    const dock = oppen.pa || oppen.t > 0, inne = inneLage || dock;
    const P = punkter(), rn = inneLage && rumNu >= 0 && P[rumNu] ? P[rumNu].namn : null, grann = rn ? rumGrannar(rn) : null;
    const kanda = d.rumGrannar || null, nara = kamera.position.lengthSq() < UTE_NARA2;
    ut.opp.forEach(o => {
      if (!o) return;
      let syns = true;
      if (dock) syns = true;
      else if (inneLage) syns = o.passage || !grann || !o.rum || !kanda || !kanda.has(o.rum) || grann.has(o.rum) || o.k >= 0;
      else syns = o.passage && nara;
      o.obj.visible = syns;
    });
    ia.nara = nara;
    // lamporna: inifrån var för sig; utifrån på kvällen som två hopslagna ytor (lampa + skärm),
    // byggda av de lampor som är tända (2 ritanrop i stället för ett per lampa)
    ut.lampor.forEach(L => { if (L && L.mesh) L.mesh.visible = inne; });
    lamporUte(ut, !inne && ljus.kvall > 0.05 ? ut.lampor.map(L => (L && L.pa ? 1 : 0)).join('') : '');
  }
  // De fasta ljusen inne (inga nya ljus, så inget kompileras om): huvudljuset flyttas till
  // den närmaste tända lampan i rummet man står i och följer dess styrka; spotten och det
  // låga ljuset följer den starkaste tända lampan i rummet. Utan lampor från inredningen
  // tänds allt med kvällen som förut.
  function satLampLjus() {
    if (!inneLage || !husGrupp) return;
    const k = ljus.kvall, ut = husGrupp.userData.ia, L = ut && ut.lampor.some(Boolean) ? ut.lampor : null;
    let lk = k, rk = k, f = 1, l3 = 0, lagEnsam = null;
    if (L) {
      lk = 0; rk = 0; f = 0.35 + 0.65 * k;   // på dagen gör en lampa mindre
      const Y0 = husGrupp.userData.delar.Y0, K = kamera.position;
      let bast = null, bd = Infinity;
      // spegel- och bänkbelysning sitter mot väggen: ett punktljus där lyser allt bakifrån
      // (mörka framsidor, randiga skuggor), så de väljs sist och lyser svagare; golvlampor
      // väljs gärna (de ska lysa upp soffan bredvid)
      const accent = l => /Spegel|Bänk/.test(l.namn), vikt = l => (accent(l) ? 6 : /Golvlampa/.test(l.namn) ? -1.2 : 0);
      L.forEach(l => {
        if (!l || l.t <= 0.001 || (rumNu >= 0 && l.ri !== rumNu)) return;
        rk = Math.max(rk, l.t);
        const dd = Math.hypot(l.pos[0] - K.x, l.pos[1] + Y0 - K.y, l.pos[2] - K.z) + vikt(l);
        if (dd < bd) { bd = dd; bast = l; }
      });
      if (bast) {
        // loftets lampor står lågt intill snedtaket: svagare, annars bränns tak och bädd ut
        const PL = punkter(), loftF = l => (PL[l.ri] && nivaTal(PL[l.ri].niva) ? (/Lykta/.test(l.namn) ? 0.12 : 0.25) : 1) * (accent(l) ? 0.35 : 1);
        // taklampor och spotar: punktljuset en bit under armaturen (annars en utbränd fläck i taket)
        // en plafond sitter direkt mot taket: ljuset längre ned och lite svagare, annars blir
        // taket runt kupan utfrätt vitt (sovrummet i sadel-50)
        const plaf = /Taklampa$/.test(bast.namn) && bast.pos[1] > 2.2 && !(PL[bast.ri] && nivaTal(PL[bast.ri].niva));
        const ned = plaf ? 0.72 : /Taklampa$|Spotlights/.test(bast.namn) ? 0.4 : 0.12;
        inneLjus.position.set(bast.pos[0], bast.pos[1] + Y0 - ned, bast.pos[2]); lk = bast.t * loftF(bast) * (plaf ? 0.82 : 1);
        // det fjärde ljuset: närmaste andra tända lampa i rummet, minst 1 m från den första
        let tva = null, td = Infinity;
        L.forEach(l => {
          if (!l || l === bast || l.t <= 0.001 || (rumNu >= 0 && l.ri !== rumNu)) return;
          if (Math.hypot(l.pos[0] - bast.pos[0], l.pos[2] - bast.pos[2]) < 1) return;
          const dd = Math.hypot(l.pos[0] - K.x, l.pos[1] + Y0 - K.y, l.pos[2] - K.z) + vikt(l);
          if (dd < td) { td = dd; tva = l; }
        });
        if (tva) { inneLjus3.position.set(tva.pos[0], tva.pos[1] + Y0 - 0.1, tva.pos[2]); l3 = tva.t * loftF(tva); }
        // sovrum med bara en låg lampa (nattduksbordet): ljuset kom från sänggaveln i
        // täckets höjd, så täcket och garderoben blev svarta; ett mjukt varmt fyllnadsljus
        // under taket mitt emellan lampan och kameran (som studs från taket)
        else if (bast.pos[1] < 1.3 && !(PL[bast.ri] && nivaTal(PL[bast.ri].niva))) lagEnsam = bast;
      }
      else inneLjus.position.copy(ljusHem);
    } else inneLjus.position.copy(ljusHem);
    // Loftet på kvällen: lamporna står lågt (golvlyktan vid fotänden lyser bara sidorna), så
    // täcket blev svart ovanpå. Det fjärde ljuset blir då ett mjukt varmt fyllnadsljus under
    // nocken, ovanför sängen/lampan (inget nytt ljus, inget kompileras om).
    let fyll = null;
    if (k > 0.05) {
      const dl = husGrupp.userData.delar, Y0 = dl.Y0, K = kamera.position, p = rumNu >= 0 ? punkter()[rumNu] : null;
      const iLoft = p ? !!nivaTal(p.niva) : K.y - Y0 > 2.3;
      if (iLoft && tal(dl.hR)) {
        // under nocken, mellan kameran och loftets lampa (där sängen står)
        const lamp = L && L.find(l => l && l.t > 0.001 && l.pos[1] > 2.0 && (rumNu < 0 || l.ri === rumNu));
        const x = lamp ? lamp.pos[0] * 0.6 + K.x * 0.4 : K.x, z = lamp ? lamp.pos[2] * 0.6 + K.z * 0.4 : K.z;
        fyll = { x, y: Y0 + dl.hR - 0.55, z, i: mjuk(0.05, 0.6, k) * 0.9 };
      } else if (lagEnsam) {
        const x = lagEnsam.pos[0] * 0.5 + K.x * 0.5, z = lagEnsam.pos[2] * 0.5 + K.z * 0.5;
        fyll = { x, y: Y0 + 2.0, z, i: mjuk(0.05, 0.6, k) * 2.4 * lagEnsam.t, tre: true };
      }
    }
    // kvällen: 2700 K; himlen och miljön är nästan borta, så lamporna får bära rummet
    inneLjus.color.copy(LJ_DAG).lerp(LJ_2700, Math.max(k, ljus.lag * 0.4));
    inneSpot.color.copy(SPOT_DAG).lerp(SPOT_2700, k);
    inneLjus2.color.copy(LJ_DAG).lerp(LJ2_2700, k);
    inneLjus.intensity = 1.2 * (0.75 + ljus.lag * 0.5) * (1 - k) + lk * 7.5 * rumLjus.styrka * f;
    inneSpot.intensity = rumLjus.spot ? rk * 11 * f : 0;
    inneLjus2.intensity = rumLjus.lag ? rk * 2.6 * f : 0;
    inneLjus3.intensity = l3 * 3.2 * f;
    // loftets fyllnadsljus tar ett ledigt ljus: rummets "låga" ljus om loftet saknar ett, annars det fjärde
    if (fyll) {
      const fl = fyll.tre ? inneLjus3 : !rumLjus.lag ? inneLjus2 : !l3 ? inneLjus3 : null;
      if (fl) { fl.position.set(fyll.x, fyll.y, fyll.z); fl.color.copy(LJ_2700); fl.intensity = fyll.i; }
    }
    rumLjus.l2 = inneLjus2.intensity;
    const LT = ljusTona;
    if (LT.t < 1) {
      const e = LT.t * LT.t * (3 - 2 * LT.t);
      LT.v.copy(inneLjus.position); inneLjus.position.lerpVectors(LT.lp, LT.v, e);
      inneLjus.intensity = LT.li + (inneLjus.intensity - LT.li) * e;
      inneSpot.position.lerpVectors(LT.sp, LT.mSp, e); inneSpot.target.position.lerpVectors(LT.st, LT.mSt, e); inneSpot.target.updateMatrixWorld();
      inneSpot.intensity = LT.si + (inneSpot.intensity - LT.si) * e;
      inneLjus2.position.lerpVectors(LT.l2p, LT.mL2, e);
      inneLjus2.intensity = LT.l2i + (inneLjus2.intensity - LT.l2i) * e;
      inneLjus3.intensity *= e;
      rumLjus.l2 = inneLjus2.intensity;
    }
  }
  function meddelaLampor() {
    const ut = husGrupp && husGrupp.userData.ia, l = ut ? ut.lampor.filter(Boolean) : [];
    meddela('vidLampor', { antal: l.length, tanda: l.filter(L => L.pa).length });
  }
  function vaxlaLampa(i, pa) {
    const ut = iaData(), L = ut && ut.lampor[i];
    if (!L) return false;
    L.pa = pa === undefined ? !L.pa : !!pa;
    (lampMinne[val.modell] || (lampMinne[val.modell] = {}))[i] = L.pa;
    if (lugn) { L.t = L.pa ? 1 : 0; satsLampa(L); satLampLjus(); }
    meddelaLampor(); iaAnnonsera(); begarRender();
    return true;
  }
  // Alla lampor: utan värde tänds alla om ingen lyser, annars släcks alla
  function allaLampor(pa) {
    const ut = iaData(), l = ut ? ut.lampor : [];
    if (!l.some(Boolean)) return false;
    if (pa === undefined) pa = !l.some(L => L && L.pa);
    const minne = lampMinne[val.modell] || (lampMinne[val.modell] = {});
    l.forEach((L, i) => { if (!L) return; L.pa = !!pa; minne[i] = L.pa; if (lugn) { L.t = L.pa ? 1 : 0; satsLampa(L); } });
    if (lugn) satLampLjus();
    meddelaLampor(); iaAnnonsera(); begarRender();
    return !!pa;
  }
  // kvällen: lampor man inte själv rört tänds efter 0,4 och släcks på dagen
  function lamporFoljTid() {
    const ut = husGrupp && husGrupp.userData.ia;
    if (!ut || !ut.lampor.some(Boolean)) return;
    const minne = lampMinne[val.modell] || {}, pa = ljus.kvall > 0.4;
    let byt = false;
    ut.lampor.forEach((L, i) => { if (L && typeof minne[i] !== 'boolean' && L.pa !== pa) { L.pa = pa; byt = true; if (lugn) { L.t = pa ? 1 : 0; satsLampa(L); } } });
    if (byt) { meddelaLampor(); iaAnnonsera(); begarRender(); }
  }
  // ---- sitta: kameran glider ned på sitsen (ögat ca 1,1 m) och vänder sig mot mal ----
  function meddelaSitt() { meddela('vidSitt', gang.sitter >= 0); }
  function sattDig(i) {
    const ut = iaData(), s = ut && ut.sitt[i];
    if (!s || !inneLage || !husGrupp) return false;
    if (gang.sitter < 0) gang.stod = { x: kamera.position.x, z: kamera.position.z, golvY: gang.golvY, niva: gang.niva };
    const Y0 = husGrupp.userData.delar.Y0, st = gang.stod;
    const y = SITT_Y + (st.golvY - Y0);   // ögat 1,15 m över golvet när man sitter
    gang.sitter = i;
    glidTill(s.pos[0], st.golvY, s.pos[2], st.niva, s.mal, { y: y + Y0, tid: lugn ? 0.01 : 0.9, satt: 'sitt' });
    gang.sitter = i;   // glidTill nollar inte en sittande som sätter sig, men var tydlig
    meddelaSitt(); iaAnnonsera();
    return true;
  }
  // tillbaka dit man stod innan man satte sig, i ögonhöjd
  // upp till en fri punkt en halvmeter framför sitsen (åt det håll den vetter), annars dit man stod
  function resDig() {
    if (gang.sitter < 0) return false;
    const s = gang.stod, ut = iaData(), sp = ut && ut.sitt[gang.sitter];
    gang.sitter = -1; gang.stod = null; meddelaSitt();
    let mx = s ? s.x : 0, mz = s ? s.z : 0;
    if (s && sp) {
      let fx = sp.mal ? sp.mal[0] - sp.pos[0] : s.x - sp.pos[0], fz = sp.mal ? sp.mal[2] - sp.pos[2] : s.z - sp.pos[2];
      const l = Math.hypot(fx, fz);
      if (l > 1e-3) {
        fx /= l; fz /= l;
        hitta: for (const d of [0.5, 0.65, 0.8]) for (const a of [0, 0.45, -0.45, 0.9, -0.9]) {
          const c = Math.cos(a), sn = Math.sin(a), x = sp.pos[0] + (fx * c - fz * sn) * d, z = sp.pos[2] + (fx * sn + fz * c) * d;
          if (fri(x, z, s.niva) >= RADIE * 0.9 && !inuti(x, z, s.niva)) { mx = x; mz = z; break hitta; }
        }
      }
    }
    if (s) glidTill(mx, s.golvY, mz, s.niva, null, { tid: lugn ? 0.01 : 0.7, satt: 'res' });
    iaAnnonsera(); begarRender();
    return true;
  }
  // ---- vad pekaren eller siktet står på ----
  // strålen (satt av den som ropar) mot alla delar; en vägg närmare än träffen tar bort den
  function traffaIa(maxD) {
    const ut = iaData(), F = fonsterTraff();
    if ((!ut || !ut.meshes.length) && !F.length) return null;
    const far0 = ray.far;
    traffar.length = 0; ray.far = maxD;
    if (ut && ut.meshes.length) ray.intersectObjects(ut.meshes, false, traffar);
    if (F.length) ray.intersectObjects(F, false, traffar);   // sorterar alla träffar
    let t = null;
    for (let i = 0; i < traffar.length; i++) {
      const ob = traffar[i].object, fi = ob.userData.fonsterTraff;
      if (fi !== undefined) { t = { sort: 'fonster', i: fi, d: traffar[i].distance }; break; }
      const m = ut && ut.vem.get(ob);
      if (!m) continue;
      if (m.sort === 'opp' && ut.opp[m.i] && !ut.opp[m.i].obj.visible) continue;   // gömt skåp i ett annat rum
      if ((m.sort === 'sitt' && !ut.sitt[m.i]) || (m.sort === 'lampa' && !ut.lampor[m.i])) continue;   // tomt hus: möbeln är borta
      t = { sort: m.sort, i: m.i, d: traffar[i].distance }; break;
    }
    traffar.length = 0;
    if (t) {
      const vg = vaggLista();
      if (vg.length) { ray.far = Math.max(0.01, t.d - 0.04); ray.intersectObjects(vg, false, traffar); if (traffar.length) t = null; traffar.length = 0; }
    }
    ray.far = far0;
    return t;
  }
  function fonsterTraff() {
    const d = husGrupp && husGrupp.userData;
    if (!d) return [];
    if (!d.fonsterTraff) d.fonsterTraff = fonsterLista().map(f => f.traff).filter(Boolean);
    return d.fonsterTraff;
  }
  // Utifrån: bara fönstren, inom 6 m, och inte genom väggen (fasaden har hål för fönstren)
  function pekaUte() {
    if (inneLage || !husGrupp || !gang.pekar || aka || oppen.pa || oppen.t > 0 || byggT < 1 || !fonsterTraff().length) return satMal(null);
    if (rektSmuts) lasRekt();
    ndc.set((gang.px - dukV) / dukB * 2 - 1, -((gang.py - dukT) / dukH) * 2 + 1);
    ray.setFromCamera(ndc, kamera);
    traffar.length = 0; ray.far = 6;
    ray.intersectObjects(fonsterTraff(), false, traffar);
    let t = traffar.length ? { sort: 'fonster', i: traffar[0].object.userData.fonsterTraff, d: traffar[0].distance } : null;
    traffar.length = 0;
    if (t) {
      const d = husGrupp.userData;
      if (!d.fasadMesh) { d.fasadMesh = []; d.delar.vaggar.children.forEach(m => { if (m.isMesh && m.material === mat.fasad) d.fasadMesh.push(m); }); }
      ray.far = Math.max(0.01, t.d - 0.03);
      ray.intersectObjects(d.fasadMesh, false, traffar);
      if (traffar.length) t = null;
      traffar.length = 0;
    }
    ray.far = Infinity;
    const byt = satMal(t);
    duk.style.cursor = t ? 'pointer' : '';
    return byt;
  }
  // mitt i bilden: det siktet träffar inom räckhåll, annars en dörr inom 2 m och ca 22° från blicken
  function siktMal() {
    if (!inneLage || !husGrupp) return null;
    ndc.set(0, 0); ray.setFromCamera(ndc, kamera);
    let t = traffaIa(NA_E2);
    if (t && (t.sort === 'opp' || t.sort === 'fonster') && t.d > NA_E) t = null;
    if (t) return t;
    const ut = iaData();
    if (!ut) return null;
    kamera.getWorldDirection(iaV3);
    let bast = null, bc = Math.cos(0.38);
    ut.opp.forEach((o, i) => {
      if (!o) return;
      const c = o.obj.localToWorld(iaV.copy(o.cL)).sub(kamera.position), L = c.length();
      if (L > NA_E || L < 1e-3) return;
      const cos = c.dot(iaV3) / L;
      if (cos > bc) { bc = cos; bast = { sort: 'opp', i, d: L, dir: c.divideScalar(L).clone() }; }
    });
    if (bast) {
      const vg = vaggLista();
      if (vg.length) {
        ray.set(kamera.position, bast.dir); ray.far = Math.max(0.01, bast.d - 0.08); traffar.length = 0;
        ray.intersectObjects(vg, false, traffar); if (traffar.length) bast = null;
        traffar.length = 0; ray.far = Infinity;
      }
    }
    return bast && { sort: bast.sort, i: bast.i, d: bast.d };
  }
  // E: det pekaren står på om det är inom räckhåll, annars det som är mitt i bilden
  function eMal() {
    if (!spel.pa && ia.mal && ia.mal.d <= (ia.mal.sort === 'opp' || ia.mal.sort === 'fonster' ? NA_E : NA_E2)) return ia.mal;
    return siktMal();
  }
  function malText(m) {
    if (m && m.sort === 'fonster') {
      const f = fonsterLista()[m.i], oppet = !!(f && f.o && f.o.mal > 0.5);
      return f ? (oppet ? 'Stäng ' : 'Öppna ') + (f.typ === 'sk' ? 'skjutdörr' : 'fönster') : '';
    }
    const ut = husGrupp && husGrupp.userData.ia;
    if (!m || !ut) return '';
    if (m.sort === 'opp') { const o = ut.opp[m.i]; return o ? (o.mal > 0.5 ? 'Stäng ' : 'Öppna ') + OPP_ORD[o.typ] : ''; }
    if (m.sort === 'sitt') return gang.sitter === m.i ? 'Res dig' : 'Sätt dig';
    if (m.sort === 'lampa') { const L = ut.lampor[m.i]; return L ? (L.pa ? 'Släck lampa' : 'Tänd lampa') : ''; }
    return '';
  }
  // etiketten (sidan ritar den vid pekaren, eller under siktet i Spelläget)
  function iaAnnonsera() {
    const text = malText(ia.mal), nyckel = text + (spel.pa ? '|m' : '');
    if (nyckel === ia.annons) return;
    ia.annons = nyckel;
    meddela('vidMal', text ? { text, mitt: spel.pa, tangent: 'E' } : null);
  }
  function satMal(m) {
    const ut = husGrupp && husGrupp.userData.ia, f = ia.mal;
    const samma = !!f === !!m && (!m || (f.sort === m.sort && f.i === m.i));
    if (!samma && f && f.sort === 'opp' && ut && ut.opp[f.i]) ut.opp[f.i].hovMal = 0;
    ia.mal = m;
    if (m && m.sort === 'opp' && ut && ut.opp[m.i]) ut.opp[m.i].hovMal = 1;
    iaAnnonsera();
    if (!samma) begarRender();
    return !samma;
  }
  function gorMal(m) {
    if (!m || (!inneLage && m.sort !== 'fonster')) return false;
    let ok = false;
    if (m.sort === 'opp') ok = vaxlaOpp(m.i);
    else if (m.sort === 'fonster') ok = vaxlaO(fonsterUt(m.i));
    else if (m.sort === 'sitt') ok = gang.sitter === m.i ? resDig() : sattDig(m.i);
    else if (m.sort === 'lampa') ok = vaxlaLampa(m.i);
    iaAnnonsera();
    return ok;
  }
  // en ruta: dörrarna rör sig, toningen vid hovring och lamporna. Sant så länge något rör sig.
  // alla öppningsbara: inredningens och de fönster som byggts ut
  const NOLL = { opp: [], lampor: [] };
  function allaOpp() {
    const ut = (husGrupp && husGrupp.userData.ia) || NOLL, F = fonsterLista();
    if (!F.some(f => f.o)) return ut.opp;
    return ut.opp.concat(F.map(f => f.o));
  }
  function stegIa(dt) {
    if (!husGrupp) return false;
    const ut = husGrupp.userData.ia || NOLL, alla = allaOpp();
    let ror = false, lampa = false;
    for (let i = 0; i < alla.length; i++) {
      const o = alla[i];
      if (!o) continue;
      if (o.k >= 0) {
        o.k = Math.min(1, o.k + dt / OPP_TID);
        let f;
        if (o.typ === 'lada' || o.typ === 'skjut') f = utC(o.k);   // lådor och skjutdörrar glider
        else {
          f = inUt(o.k);
          // dörrar: en liten översväng som sätter sig (öppnar en aning förbi, studsar upp lite vid stängning)
          if (o.typ === 'dorr') { const b = 0.045 * Math.sin(Math.PI * del(o.k, 0.55, 1)); f += o.mal > o.fran ? b : -0.6 * b; }
        }
        o.t = o.fran + (o.mal - o.fran) * f;
        if (o.k >= 1) { o.t = o.mal; o.k = -1; oppKlar(o); }
        satsOpp(o); ror = true;
      }
      if (o.hov !== o.hovMal) {
        o.hov = lugn ? o.hovMal : o.hovMal > o.hov ? Math.min(o.hovMal, o.hov + dt / 0.14) : Math.max(o.hovMal, o.hov - dt / 0.2);
        const a = o.hov * 0.13;
        o.mats.forEach(x => { x.m.emissive.setRGB(x.e.r + TONING.r * a, x.e.g + TONING.g * a, x.e.b + TONING.b * a); x.m.emissiveIntensity = 1; });
        ror = true;
      }
    }
    for (let i = 0; i < ut.lampor.length; i++) {
      const L = ut.lampor[i];
      if (!L) continue;
      const m = L.pa ? 1 : 0;
      if (L.t !== m) { L.t = m > L.t ? Math.min(1, L.t + dt / LAMP_TID) : Math.max(0, L.t - dt / LAMP_TID); satsLampa(L); lampa = true; }
    }
    if (lampa) { satLampLjus(); if (!inneLage) iaSynlighet(); ror = true; }
    return ror;
  }
  // pågår en rörelse? (vinkelbilder och övergångar väntar eller hoppar till slutet)
  function iaRorSig() {
    if (!husGrupp) return false;
    const ut = husGrupp.userData.ia || NOLL;
    return allaOpp().some(o => o && o.k >= 0) || ut.lampor.some(L => L && L.t !== (L.pa ? 1 : 0));
  }
  function slutforIa() {
    if (!husGrupp || !iaRorSig()) return false;
    const ut = husGrupp.userData.ia || NOLL;
    allaOpp().forEach(o => { if (o && o.k >= 0) { o.t = o.mal; o.k = -1; satsOpp(o); oppKlar(o); } });
    ut.lampor.forEach(L => { if (L) { L.t = L.pa ? 1 : 0; satsLampa(L); } });
    satLampLjus();
    tona.farsk = false;
    return true;
  }
  // ---- Spelläget ----
  function satSpel(pa) {
    pa = !!pa && inneLage && typeof duk.requestPointerLock === 'function';
    if (pa === spel.pa) return spel.pa;
    if (!pa) { spelAv(true); return false; }
    spel.pa = true; spel.dx = spel.dy = 0; spel.smuts = true;
    styr.enableRotate = false;
    gomRing(); satHov(-1); duk.style.cursor = 'none';
    try { const p = duk.requestPointerLock(); if (p && typeof p.catch === 'function') p.catch(() => spelAv(false)); } catch (e) { spelAv(false); return false; }
    ia.annons = ''; satMal(null); begarRender();
    return true;
  }
  function spelAv(slapp) {
    if (!spel.pa) return;
    spel.pa = false; spel.dx = spel.dy = 0;
    if (spel.bob || spel.bx || spel.bz) { gV3.set(spel.bx, spel.bob, spel.bz); kamera.position.sub(gV3); styr.target.sub(gV3); }
    spel.bob = spel.bx = spel.bz = spel.amp = 0;
    styr.enableRotate = true; duk.style.cursor = '';
    if (slapp && document.pointerLockElement === duk) { try { document.exitPointerLock(); } catch (e) { /* redan släppt */ } }
    ia.annons = ''; satMal(null);
    meddela('vidSpel', false);
    begarRender();
  }
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== duk && spel.pa) spelAv(false); });
  document.addEventListener('pointerlockerror', () => spelAv(false));
  document.addEventListener('mousemove', e => {
    if (!spel.pa || document.pointerLockElement !== duk) return;
    // en enstaka spik i rörelsen (vissa webbläsare) får inte kasta runt blicken
    const kl = v => Math.max(-200, Math.min(200, v || 0));
    spel.dx = kl(spel.dx + kl(e.movementX)); spel.dy = kl(spel.dy + kl(e.movementY));
    begarRender();
  });
  // Pekaren: bara klientkoordinater sparas (offsetX kan tvinga fram en layout);
  // dukens läge läses högst en gång per ruta, och bara efter scroll eller storleksbyte.
  let dukV = 0, dukT = 0, rektSmuts = true;
  function lasRekt() { const r = duk.getBoundingClientRect(); dukV = r.left; dukT = r.top; rektSmuts = false; }
  window.addEventListener('scroll', () => { rektSmuts = true; }, { passive: true, capture: true });
  duk.addEventListener('pointerenter', () => { rektSmuts = true; });
  // ett tryck: rör sig högst 12 px (finger) eller 5 px (mus) och släpps inom 350 ms, samma pekare
  const SLOP_FINGER = 12, SLOP_MUS = 5, TRYCK_MS = 350;
  const arTryck = (n, e) => !!n && !gang.drog && e.pointerId === n.id && Math.hypot(e.clientX - n.x, e.clientY - n.y) <= n.slop && performance.now() - n.t < TRYCK_MS;
  duk.addEventListener('pointermove', e => {
    gang.pekar = true; gang.px = e.clientX; gang.py = e.clientY;
    if (liv.pa && performance.now() - liv.inmat > 15000) vakna(); else liv.inmat = performance.now();
    if (gang.ner && e.pointerId === gang.ner.id && Math.hypot(e.clientX - gang.ner.x, e.clientY - gang.ner.y) > gang.ner.slop) gang.drog = true;
    if (inneLage && e.pointerType !== 'touch') { pekRay = true; schema(); }
    // utifrån: fönstren nära huset (inom 6 m från ett fönster, se pekaUte)
    else if (!inneLage && e.pointerType !== 'touch' && !gang.ner && husGrupp && kamera.position.lengthSq() < 100) { pekRay = true; schema(); }
    else if (!inneLage && ia.mal) { satMal(null); duk.style.cursor = ''; }
  });
  duk.addEventListener('pointerleave', () => { gang.pekar = false; if (inneLage) { pekRay = true; schema(); } });
  duk.addEventListener('pointerdown', e => {
    vakna();
    // ett andra finger (nyp): inget tryck
    if (gang.ner && e.pointerId !== gang.ner.id) { gang.drog = true; return; }
    const finger = e.pointerType === 'touch';
    gang.ner = e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), slop: finger ? SLOP_FINGER : SLOP_MUS } : null; gang.drog = false;
    // inne: på pekskärm dras bilden med fingret, med musen vrids blicken som förut
    if (inneLage) styr.rotateSpeed = finger ? -0.38 : 0.42;
  });
  duk.addEventListener('pointercancel', e => { if (gang.ner && e.pointerId === gang.ner.id) gang.ner = null; });
  duk.addEventListener('pointerup', e => {
    const n = gang.ner;
    if (n && e.pointerId !== n.id) return;
    gang.ner = null;
    const tryck = arTryck(n, e);
    // Spelläget: klick gör det som siktet står på
    if (spel.pa) { if (n && inneLage) gorMal(siktMal()); return; }
    // utifrån: ett klick (inte ett drag) på ett fönster öppnar eller stänger det
    if (!inneLage) {
      if (!tryck || !husGrupp) return;
      gang.px = e.clientX; gang.py = e.clientY; gang.pekar = true;
      pekaUte();
      if (ia.mal && ia.mal.sort === 'fonster') { gorMal(ia.mal); if (e.pointerType === 'touch') satMal(null); }
      return;
    }
    if (!tryck || !inneLage) return;
    gang.px = e.clientX; gang.py = e.clientY; gang.pekar = true;
    pekaGolv();   // pekskärm: ingen hovring före klicket
    // dörr, lucka, låda, sittplats eller lampa: gör det (på pekskärm försvinner etiketten direkt)
    if (ia.mal) { gorMal(ia.mal); if (e.pointerType === 'touch') satMal(null); return; }
    if (gang.sitter >= 0) return;
    const Y0 = husGrupp.userData.delar.Y0;
    if (gang.hov >= 0) {
      // en rumspunkt, eller ett rum bakom en dörröppning: dit, vänd som rummet ska ses
      // ett ljust utbrott på skivan, sedan glidningen
      const i = gang.hov, p = punkter()[i];
      if (ring.alfaMal > 0) pulsa(ring.mal, ring.q);
      else if (p) pulsa(gV.set(p.pos[0], punktGolv(p) + Y0 + 0.014, p.pos[2]));
      gang.sistMal = null;
      satHov(-1);
      if (lugn) gaTill(i); else setTimeout(() => { if (inneLage && !gang.glid) gaTill(i); }, 110);
    } else if (ring.giltig) {
      // mål inne i en möbel eller vägg (+ 0,25 m) avvisas; trånga rum tillåter 0,12 m.
      // En vägg eller möbel på vägen utan dörröppning runt: röd ring, ingen glidning
      const m = ring.mal, q = ring.q.clone(), mp = m.clone();
      gang.sistMal = { x: m.x, z: m.z, golvY: ring.golvY, niva: ring.niva, fx: kamera.position.x, fz: kamera.position.z, tid: performance.now() };
      if (glidTill(m.x, ring.golvY, m.z, ring.niva, null, { strikt: true })) pulsa(mp, q);
      else if (gang.blockerad) {
        gang.sistMal = null;
        ring.mal.copy(mp); ring.q.copy(q); ring.giltig = false; ring.alfaMal = 0.6; ring.rodMal = 1;
        begarRender();
      }
    }
  });
  // dubbelklick: gå dit och vänd blicken åt det hållet (i ögonhöjd)
  duk.addEventListener('dblclick', e => {
    const m = gang.sistMal;
    if (!inneLage || !husGrupp || !m || performance.now() - m.tid > 700) return;
    e.preventDefault();
    gang.sistMal = null;
    const dx = m.x - m.fx, dz = m.z - m.fz, l = Math.hypot(dx, dz);
    if (l < 0.2) return;
    const Y0 = husGrupp.userData.delar.Y0;
    glidTill(m.x, m.golvY, m.z, m.niva, [m.x + dx / l * 3, m.golvY - Y0 + OGON, m.z + dz / l * 3], { strikt: true });
  });
  // hjulet inne: kliv fram och bak, mjukt (högst 0,8 m i kö)
  duk.addEventListener('wheel', e => {
    vakna();
    if (!inneLage || !husGrupp) return;
    e.preventDefault();
    if (gang.glid || gang.sitter >= 0) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    // 2,5 mm per bildpunkt, högst 0,8 m i kö
    gang.hjul = Math.max(-0.8, Math.min(0.8, gang.hjul - Math.max(-240, Math.min(240, dy)) * 0.0025));
    gomRing(); satHov(-1);
    begarRender();
  }, { passive: false });
  // ett litet rum: det finns hinder nära på båda sidor i någon led
  function litetRum(x, z, niva) {
    return fri(x + 0.3, z, niva) < 0.05 && fri(x - 0.3, z, niva) < 0.05 || fri(x, z + 0.3, niva) < 0.05 && fri(x, z - 0.3, niva) < 0.05;
  }

  // Var man står, i husets koordinater (huset står mitt på origo)
  const flytt = { smuts: false, sist: 0, rum: -1, spegel: -1, spegelTid: 0 };
  function spegelSnart() {
    clearTimeout(flytt.spegelTid);
    flytt.spegelTid = setTimeout(() => {
      if (flytt.spegel < 0 || !inneLage) { flytt.spegel = -1; return; }
      if (gang.glid || gang.tangent.size || gang.ner || ramId || rorForra) { spegelSnart(); return; }
      const ri = flytt.spegel; flytt.spegel = -1;
      ledigt(() => { if (inneLage && flytt.rum === ri) fangaSpeglar(ri); });
    }, 250);
  }
  function position() {
    gV.copy(styr.target).sub(kamera.position);
    const x = kamera.position.x, z = kamera.position.z, P = punkter();
    let rum = -1, bast = 1.6;   // närmaste rumspunkt inom 1,6 m, annars -1
    for (let i = 0; i < P.length; i++) {
      if (nivaTal(P[i].niva) !== gang.niva) continue;
      const d = Math.hypot(P[i].pos[0] - x, P[i].pos[2] - z); if (d < bast) { bast = d; rum = i; }
    }
    return { x, z, riktning: Math.atan2(gV.z, gV.x), niva: gang.niva, rum };
  }
  function skickaFlytt(nu) {
    flytt.smuts = false; flytt.sist = nu;
    const pos = position();
    // punktljuset följer med till rummet man står i (badet och bastun har egna lägen)
    // byt rummets ljus först när den nya punkten är minst 0,35 m närmare än den förra
    // (ingen fladdring mitt emellan två punkter); ljusen tonas över på 0,35 s
    const PP = punkter(), fore = inneLage && flytt.rum >= 0 ? PP[flytt.rum] : null, ny = pos.rum >= 0 ? PP[pos.rum] : null;
    const nara = (fore && ny && nivaTal(fore.niva) === nivaTal(ny.niva))
      ? Math.hypot(fore.pos[0] - pos.x, fore.pos[2] - pos.z) - Math.hypot(ny.pos[0] - pos.x, ny.pos[2] - pos.z) >= 0.35 : true;
    if (inneLage && pos.rum >= 0 && pos.rum !== flytt.rum && nara) {
      flytt.rum = pos.rum;
      satRumLjus(pos.rum, undefined, true);
      lageLjus();
      const p = punkter()[pos.rum];
      // spegeln (CubeCamera + pmrem, 50–150 ms) fångas när man står still, aldrig mitt i en glidning
      if (p && arBad(p.namn)) { flytt.spegel = pos.rum; spegelSnart(); }
      begarRender();
    }
    if (typeof alternativ.vidFlytt === 'function') { try { alternativ.vidFlytt(pos); } catch (e) { console.warn(e); } }
  }

  // ---- Dockskåpet: taket lyfts av och väggarna skärs, så att man ser ned i rummen ----
  const KLIPP = [oppen.klipp];
  const takLada = new THREE.Box3();
  oppen.snittNu = oppen.snittMal = 2;
  const tal = v => typeof v === 'number' && Number.isFinite(v);
  function oppenSnitt() {
    const d = husGrupp.userData.delar, ud = inneData(), sh = ud.snittHojder && typeof ud.snittHojder === 'object' ? ud.snittHojder : ud.snittHojd;
    // inredningens snitthöjder säger om huset har ett loft (lager.loft finns även tomt, och
    // gav pulpet-70 och sadel-90 ett loftsnitt 1 m ovanför rummen)
    const harLoft = sh && typeof sh === 'object' ? tal(sh.loft) : !!(ud.lager && ud.lager.loft) || (HUS[val.modell].rum || []).some(r => /loft/i.test(r[0]));
    const bot = tal(sh) ? sh : sh && tal(sh.botten) ? sh.botten : 1.9;
    let lo = sh && tal(sh.loft) ? sh.loft : NaN;
    // utan loft: snittet där inredningens väggar slutar (botten), inte vid takfoten; annars
    // stack fodren och hörnbrädorna upp ovanför de skurna rummen (sadel-90, pulpet-70)
    if (!tal(lo)) lo = harLoft ? Math.min(d.hR - 0.3, Math.max(d.hN, d.hS) + 0.75) : Math.min(bot, Math.min(d.hN, d.hS) - 0.02);
    return { bot, loft: lo, harLoft };
  }
  // Takets genomskinliga kopior skapas en gång per hus (transparent ingår i programnyckeln,
  // så varje ny kopia kompilerades om och hackade vid varje lyft). De släpps i sluta().
  function takKloner(grupp) {
    const ud = grupp && grupp.userData, tak = ud && ud.delar && ud.delar.tak;
    if (!tak) return null;
    if (!ud.takKlon) {
      ud.takKlon = new Map();
      tak.children.forEach(m => {
        if (!m.isMesh || Array.isArray(m.material)) return;
        const o = m.userData.orig || m.material;
        // utan klippplan: clone() kopierar planen (fasta kopior som inte följer snittet), och
        // ett material som delas med väggarna klippte då bort det lyfta taket ovanför huset
        // clone() tar inte med onBeforeCompile: utan den tappade det lyfta taket snön (vinter)
        if (!ud.takKlon.has(o)) { const c = o.clone(); c.onBeforeCompile = o.onBeforeCompile; c.customProgramCacheKey = o.customProgramCacheKey; c.transparent = true; c.visible = o !== mat.insida; c.clippingPlanes = null; c.clipShadows = false; ud.takKlon.set(o, c); }
      });
    }
    return ud.takKlon;
  }
  // kopiorna kompileras i förväg (när inredningen blivit klar och datorn är ledig)
  function forkompTak(hus) {
    const K = takKloner(hus), tak = hus && hus.userData.delar && hus.userData.delar.tak;
    if (!K || !tak || hus.userData.takKomp) return Promise.resolve();
    hus.userData.takKomp = true;
    // stand-ins med kopiorna (taket självt behåller sina material medan det kompileras)
    const rot = new THREE.Group();
    tak.children.forEach(m => {
      const c = m.isMesh && !Array.isArray(m.material) && K.get(m.userData.orig || m.material);
      if (!c) return;
      const s = new THREE.Mesh(m.geometry, c); s.receiveShadow = m.receiveShadow; s.castShadow = m.castShadow; rot.add(s);
    });
    try { return kompKlipp([rot], () => husGrupp === hus); } catch (e) { console.warn(e); return Promise.resolve(); }
  }
  // renderer.compile() räknar inte med materialens klippplan: antalet plan tas från det
  // objekt som ritades senast, så klippta material (inredningen, väggarna med snittet)
  // kompilerades med fel nyckel och sedan om, synkront, när de syntes första gången, i
  // första lyftet (0,6–1,5 s stopp). Här sätts klippläget först genom att rita ett osynligt
  // objekt med lika många plan till en 1×1-buffert, sedan kompileras just de objekten,
  // parallellt där webbläsaren kan (KHR_parallel_shader_compile). Inget ritas på duken.
  let kompAtt = null, kompRT = null;
  const kompPlan = [];
  // mal: ett render target vars programvarianter ska kompileras (spegelns kubkarta: ingen
  // tonmappning, linjär färgrymd), annars dukens
  function kompKlipp(rotter, giltig, sats = Infinity, mal = null) {
    if (typeof renderer.compile !== 'function') return Promise.resolve();
    if (!kompAtt) {
      kompAtt = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
      kompAtt.frustumCulled = false;
      kompRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    }
    const grupper = new Map();
    rotter.forEach(r => r && r.traverse(x => {
      if (!(x.isMesh || x.isLine || x.isPoints) || !x.material) return;
      (Array.isArray(x.material) ? x.material : [x.material]).forEach(m => {
        const n = renderer.localClippingEnabled && m && m.clippingPlanes ? m.clippingPlanes.length : 0;
        if (!grupper.has(n)) grupper.set(n, new Set());
        grupper.get(n).add(x);
      });
    }));
    const fore = renderer.getRenderTarget(), sov = ms => new Promise(r => setTimeout(r, ms));
    // ett objekt i taget med klippläget satt precis innan (ett nytt program kan nollställa det
    // för resten av omgången, sett i Edge/D3D11); fick det ändå fel antal plan tas det om
    const ettObjekt = (x, n, mats) => {
      const skugga = renderer.shadowMap.needsUpdate;
      try {
        for (let varv = 0; varv < 3; varv++) {
          kompAtt.material.clippingPlanes = n ? kompPlan.slice(0, n) : null;
          renderer.shadowMap.needsUpdate = false;
          renderer.setRenderTarget(kompRT); renderer.render(kompAtt, kamera); renderer.setRenderTarget(mal || fore);
          renderer.compile({ traverse: f => f(x), traverseVisible() {} }, kamera, scene).forEach(m => mats.add(m));
          const fel = (Array.isArray(x.material) ? x.material : [x.material]).some(m => m && !(m.isShaderMaterial && !m.clipping) && renderer.properties.get(m).numClippingPlanes !== undefined && renderer.properties.get(m).numClippingPlanes !== n);
          if (!fel) break;
        }
      } finally { renderer.setRenderTarget(fore); renderer.shadowMap.needsUpdate = skugga; }
    };
    const redo = mats => { for (const m of mats) { const p = renderer.properties.get(m).currentProgram; if (p && typeof p.isReady === 'function' && !p.isReady()) return false; } return true; };
    const alla = new Set();
    return (async () => {
      // sats = högst så många nya program åt gången (medan taket svävar: 8): grafikprocessen
      // översätter dem medan rutorna väntar, och alla på en gång gav en ruta på över en sekund.
      // I ledig tid kompileras allt på en gång (snabbast totalt, parallellt, och ingen ritar då)
      for (const [n, objekt] of grupper) {
        while (kompPlan.length < n) kompPlan.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4));
        let nya = new Set(), p0 = renderer.info.programs.length;
        let skiva = performance.now() + 12;
        for (const x of objekt) {
          if (giltig && !giltig()) return;
          // ett tryck eller en tangent nyss: vänta tills sidan har svarat (utom när någon väntar på
          // just detta: åkningen som står framför dörren eller taket som svävar)
          while (performance.now() - inmatSist < 400 && !vantarPaKomp()) await sov(60);
          const pf = renderer.info.programs.length;
          ettObjekt(x, n, nya);
          // högst cirka 12 ms i sträck, och aldrig mer än ett nytt program per ruta: utan parallell
          // kompilering (Safari) låser varje program sidan, och flera i rad gav sekundlånga stopp
          if (performance.now() > skiva || renderer.info.programs.length > pf) { await nastaRuta(); skiva = performance.now() + 12; if (giltig && !giltig()) return; }
          if (renderer.info.programs.length - p0 >= sats) {
            const slut = performance.now() + 3000;
            while (!redo(nya) && performance.now() < slut) await sov(12);            nya.forEach(m => alla.add(m)); nya = new Set(); p0 = renderer.info.programs.length;
          }
        }
        const slut = performance.now() + 8000;
        while (!redo(nya) && performance.now() < slut) await sov(16);
        nya.forEach(m => alla.add(m));
      }
      // texturerna laddas också upp i förväg (annars i första rutan där inredningen syns),
      // några åt gången så att sidan inte står still
      if (typeof renderer.initTexture !== 'function') return;
      const tex = new Set();
      alla.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.isRenderTargetTexture) tex.add(v); } });
      const lista = [...tex];
      while (lista.length) {
        if (giltig && !giltig()) return;
        const s = performance.now() + 6;
        while (lista.length && performance.now() < s) { try { renderer.initTexture(lista.shift()); } catch (e) { /* laddas när den syns */ } }
        await sov(0);
      }
    })().catch(e => console.warn(e));
  }
  // Allt som första lyftet annars kompilerar mitt i klicket (det gav ett stopp på 0,1–1,5 s):
  // snittplanet läggs på väggarna och inredningen redan nu (ett plan till ändrar
  // programnyckeln; planet ligger ovanför huset tills taket lyfts, så inget klipps),
  // snittkanten och takets genomskinliga kopior. Kompileras parallellt.
  // inredningen tas i bruk (fortfarande dold): dörrarnas och lampornas materialkopior
  // (iaData) görs nu, så att de kompileras med resten i stället för i första lyftet
  function inneForbered(hus) {
    if (husGrupp !== hus) return;
    try { if (!hus.userData.inne) inneKlar(); iaData(); } catch (e) { console.warn(e); }
    // ytterdörrens blad lyfts ut till sin pivå nu, så att dess material kompileras med resten
    try { ytterdorr(); byggPunkter(); } catch (e) { console.warn(e); }
  }
  function forvarmOppen(hus, sats) {
    if (husGrupp !== hus || !hus.userData.delar) return Promise.resolve();
    const giltig = () => husGrupp === hus;
    try { snittKant(hus.userData.delar, true); } catch (e) { console.warn(e); }
    // Väggarna syns medan detta pågår: snittplanet läggs på först när deras nya program är
    // klara. Till dess kompileras stand-ins (samma programnyckel: kopia av materialet med
    // planen, samma geometri och skuggflaggor); de riktiga materialen hittar sedan programmen.
    const stand = new THREE.Group(), sett = new Set();
    hus.userData.delar.vaggar.traverse(o => {
      if (!(o.isMesh || o.isLine || o.isPoints) || !o.material || Array.isArray(o.material)) return;
      const m = o.material;
      if (m.userData.klippSatt || sett.has(m)) return;
      sett.add(m);
      let c;
      try { c = klonaMat(m); } catch (e) { return; }
      c.clippingPlanes = (m.userData.inneKlipp || []).concat(KLIPP); c.clipShadows = true;
      const s = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, c, o.count) : o.isMesh ? new THREE.Mesh(o.geometry, c) : o.isLine ? new THREE.Line(o.geometry, c) : new THREE.Points(o.geometry, c);
      if (o.isInstancedMesh) { s.instanceMatrix = o.instanceMatrix; s.instanceColor = o.instanceColor; }
      s.receiveShadow = o.receiveShadow; s.castShadow = o.castShadow; stand.add(s);
    });
    const varm = () => { hus.userData.oppenVarm = true; };
    const p = (async () => {
      try {
        await Promise.all([forkompTak(hus), kompKlipp([stand], giltig, sats)]);
        if (!giltig()) return;
        klippAlla();
        nySkugga = true; begarRender();   // skuggpassets djupmaterial med det nya planet (små)
        await kompKlipp([hus], giltig, sats);   // det som återstår (oftast inget)
      } catch (e) { console.warn(e); }
      stand.traverse(s => { if (s.material) s.material.dispose(); });
    })();
    return p.then(varm, varm);
  }
  // Inredningen behövs nu (taket ska lyftas) men är inte klar: resten byggs i bitar om
  // högst 40 ms med ritade rutor emellan (i stället för en låst sekund i klicket),
  // kompileras parallellt och sedan anropas klar(). Avbryts när huset byts eller lyftet ångras.
  function inneSnart(hus, klar, villkor, bit = 40) {   // villkor: gäller väntan fortfarande? (annars: taket svävar); bit: ms per bit
    const ud = hus.userData;
    clearTimeout(inneTimer); inneTimer = 0;
    const steg = () => {
      if (husGrupp !== hus || !(villkor ? villkor() : oppen.vantar)) return;
      if (!ud.inne && !ud.inneVantar) {
        if (!inneBygge || inneBygge.hus !== hus) {
          try { inneBygge = { it: byggInneSteg(THREE, val.modell, HUS[val.modell]), hus }; } catch (e) { console.warn(e); inneBygge = null; klar(); return; }
        }
        // 40 ms per bit: man väntar på just detta (svävet visar det), så hellre klart fort
        // med ~20 bilder/s än långsamt med fler
        const jobb = inneBygge, slut = performance.now() + bit;
        let r;
        try { do { r = jobb.it.next(); } while (!r.done && performance.now() < slut); } catch (e) { console.warn(e); inneBygge = null; klar(); return; }
        // korta bitar (kameran rör sig under tiden): en ritad ruta mellan varje
        if (!r.done) { if (bit < 40) requestAnimationFrame(() => setTimeout(steg, 0)); else setTimeout(steg, 0); return; }
        inneBygge = null;
        try { forberedInne(r.value); } catch (e) { console.warn(e); klar(); return; }
      }
      inneForbered(hus);
      forvarmOppen(hus, bit < 40 ? 1 : 8).then(klar, klar);
    };
    // korta bitar (Se inne): första biten först efter två ritade rutor, så att trycket syns och
    // kameran hinner börja röra sig (inredningens första steg kan ta en sekund på mobil)
    if (bit < 40) { const t0 = performance.now(); const vanta = () => (performance.now() - t0 < 350 ? nastaRuta().then(vanta) : steg()); nastaRuta().then(vanta); } else steg();
  }
  function takMaterial(opac) {
    const tak = husGrupp && husGrupp.userData.delar.tak;
    if (!tak) return;
    if (opac === null) {
      if (!oppen.lana) return;
      tak.children.forEach(m => { if (m.userData.orig) { m.material = m.userData.orig; delete m.userData.orig; } });
      oppen.lana = null;   // kopiorna behålls till nästa lyft
      return;
    }
    if (!oppen.lana) {
      const K = takKloner(husGrupp);
      if (!K) return;
      oppen.lana = K;
      tak.children.forEach(m => {
        if (!m.isMesh || Array.isArray(m.material) || m.userData.orig) return;
        const c = K.get(m.material);
        if (c) { m.userData.orig = m.material; m.material = c; }
      });
    }
    // färgbyten (även mitt i lyftet) följer med till kopiorna
    oppen.lana.forEach((c, o) => { c.opacity = opac; if (c.color && o.color) c.color.copy(o.color); });
  }
  function satsLager() {
    const L = inneData().lager;
    if (!L) return;
    const pa = oppen.pa || oppen.t > 0;
    if (L.tak) {
      // Takskiktet döljs i dockskåpet, utom delar som ligger helt under snittet
      // (t.ex. lampskärmen vid loftsängen). Delarnas topphöjd mäts en gång per hus.
      const dolj = pa && !oppen.lager.tak;
      L.tak.visible = !dolj || oppen.lager.loft !== false;
      if (dolj && L.tak.visible) {
        const Y0 = husGrupp.userData.delar.Y0, snitt = oppen.snittMal - 0.02;
        L.tak.children.forEach(o => {
          if (o.userData.takTopp === undefined) { o.updateWorldMatrix(true, true); o.userData.takTopp = takLada.setFromObject(o).max.y - Y0; }
          o.visible = o.userData.takTopp < snitt; o.userData.takDold = !o.visible;
        });
      } else L.tak.children.forEach(o => { if (o.userData.takDold) { o.visible = true; o.userData.takDold = false; } });
    }
    if (L.loft) L.loft.visible = !pa || oppen.lager.loft !== false;
    if (L.botten) L.botten.visible = true;
  }
  function klippAlla() {
    husGrupp.userData.delar.vaggar.traverse(o => {
      if (!o.material) return;
      // inredningens egna plan (vid ytterväggarnas insida) behålls; snittet läggs till
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m.userData.klippSatt) return;
        m.clippingPlanes = (m.userData.inneKlipp || []).concat(KLIPP); m.clipShadows = true; m.userData.klippSatt = true;
      });
    });
  }
  // Lyftets kurvor, t = 0 stängt .. 1 öppet. Upp (1,15 s): taket lossnar och lutar som ett
  // lock, far upp med en mjuk översläng och tonar bort högst upp. Ned (1,0 s): tonar in högt
  // upp, sjunker mjukt, lutar åt andra hållet och sätter sig med en liten fjädring.
  const LYFT_H = 3.3, LYFT_UPP = 1.15, LYFT_NED = 1.0;
  function lyftKurva(t, upp, ut) {
    if (upp) {
      // p^1,6 ger en mjuk start (taket lossnar), utBak den mjuka överslängen högst upp
      const p = del(t, 0.02, 0.86);
      ut.y = LYFT_H * utBak(p ** 1.6);
      ut.a = 0.13 * Math.sin(Math.PI * p) * (1 - p);
      ut.o = 1 - mjuk(0.42, 0.93, t);
    } else {
      const q = 1 - t, p = del(q, 0, 0.86);
      ut.y = LYFT_H * (1 - inUt(p)) - 0.025 * Math.sin(Math.PI * del(q, 0.86, 1));
      ut.a = -0.08 * Math.sin(Math.PI * p) * p;
      ut.o = mjuk(0.02, 0.5, q);
    }
    return ut;
  }
  const lyftNu = { y: 0, a: 0, o: 1 };  function satsOppen() {
    if (!husGrupp) return;
    const d = husGrupp.userData.delar, e = inUt(oppen.t), topp = d.hR + 1.2, syns = oppen.t > 0;
    renderer.localClippingEnabled = true; // inredningen klipps alltid vid ytterväggarna
    oppen.klipp.constant = d.Y0 + topp + (oppen.snittNu - topp) * e;
    // taket: kurvan för riktningen; vänds riktningen mitt i lyftet glider det över till den
    // nya kurvan på 0,3 s (skarv) i stället för att hoppa
    const upp = oppen.pa, k = lyftKurva(oppen.t, upp, lyftNu), vis = oppen.vis;
    // (skarven får klinga av även om t hunnit till 0 eller 1, annars hoppade taket sista biten)
    if (oppen.skarv && oppen.skarv.k <= 0) oppen.skarv = null;
    if (oppen.t > 0 && oppen.t < 1 && oppen.riktForra !== undefined && upp !== oppen.riktForra) oppen.skarv = { y: vis.y - k.y, a: vis.a - k.a, o: vis.o - k.o, k: 1 };
    oppen.riktForra = upp;
    const s = oppen.skarv, sk = s ? s.k * s.k * (3 - 2 * s.k) : 0;
    let y = k.y + (s ? s.y * sk : 0), a = k.a + (s ? s.a * sk : 0);
    const o = Math.min(1, Math.max(0, k.o + (s ? s.o * sk : 0)));
    // svävet medan inredningen byggs färdigt: taket lossnar 14 cm och gungar lätt
    if (oppen.svav > 0) {
      const sv = mjuk(0, 1, oppen.svav);
      y += sv * (0.14 + 0.025 * Math.sin(oppen.svavT * 5.2));
      a += sv * 0.012 * Math.sin(oppen.svavT * 3.4);
    }
    vis.y = y; vis.a = a; vis.o = o;
    if (byggT >= 1) {
      // lutningen vrider runt takets mitt, inte runt husets fot
      const hc = (tal(d.hR) ? d.hR : 3) * 0.7, b = a * 0.4;
      d.tak.rotation.set(a, 0, b);
      d.tak.position.set(hc * Math.sin(b), d.Y0 + y + hc * (1 - Math.cos(a)), -hc * Math.sin(a));
    }
    d.tak.visible = oppen.t < 1 && o > 0.004;
    // det genomskinliga taket kastar ingen skugga (annars låg skuggan kvar efter taket)
    const kast = o > 0.5;
    if (kast !== oppen.kastForra) {
      oppen.kastForra = kast;
      d.tak.traverse(m => { if (!m.isMesh) return; if (m.userData.kast === undefined) m.userData.kast = m.castShadow; m.castShadow = m.userData.kast && kast; });
      nySkugga = true;
    }
    // skuggranden under takfoten är takets falska skugga: den tonar bort när taket lyfts
    const rand = 1 - mjuk(0, 0.7, y);
    mat.skuggrand.opacity = 0.5 * rand; mat.skuggrand.visible = rand > 0.02;
    // stuprören står på marken: de döljs direkt när taket börjar lyfta (inga "ben" under taket)
    const lyft = syns || oppen.svav > 0;
    d.tak.children.forEach(m => { if ((m.userData.orig || m.material) === mat.stupror) m.visible = !lyft; });
    takMaterial(syns && oppen.t < 1 && o < 0.995 ? o : null);
    satsLager();
    snittKant(d, syns);
    // ljuset räknas om bara när dockskåpet slås på/av eller lyftet når sitt slut (inte varje ruta)
    const dockNu = oppen.pa || syns, slutNu = oppen.t === 0 || oppen.t === 1;
    if (dockNu !== oppen.dockForra || slutNu !== oppen.slutForra) { oppen.dockForra = dockNu; oppen.slutForra = slutNu; lageLjus(); }
  }
  // Snittytan i dockskåpet: en mörk varmgrå kant (0,17 m bred) längs ytterväggarnas insida vid
  // snitthöjden, så att väggarna inte ser ut som papper. Ett ritanrop, byggs en gång per hus.
  // (genomskinlig från början, så att kanten kan tonas in under lyftet utan nytt program)
  const KANT_MAT = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.92, transparent: true });
  function snittKant(d, syns) {
    const ud = husGrupp.userData;
    if (!ud.snittKant) {
      if (!syns) return;
      const H = HUS[val.modell], L = H.L, W = H.W, T = 0.17, h = 0.02, delar = [];
      const lada = (w, dd, x, z) => { const g = new THREE.BoxGeometry(w, h, dd); g.translate(x, 0, z); delar.push(g); };
      lada(L, T, 0, W / 2 - T / 2); lada(L, T, 0, -W / 2 + T / 2);
      lada(T, W - 2 * T, L / 2 - T / 2, 0); lada(T, W - 2 * T, -L / 2 + T / 2, 0);
      let g = null;
      try { g = mergeGeometries(delar, false); } catch (e) { g = null; }
      delar.forEach(x => x.dispose());
      if (!g) return;
      const m = new THREE.Mesh(g, KANT_MAT);
      m.name = 'snittkant'; m.castShadow = false; m.receiveShadow = true; m.visible = false;
      husGrupp.add(m); ud.snittKant = m;
    }
    const m = ud.snittKant;
    // bara när snittet ligger under takfoten (alla fyra väggarna skärs); ett loftsnitt ovanför
    // takfoten skär bara gavlarna, och då svävade ringen i luften ovanför långsidorna
    const fot = Math.min(tal(d.hN) ? d.hN : 99, tal(d.hS) ? d.hS : 99);
    // tonas in mellan 45 och 85 % av lyftet (förut dök den upp i ett slag vid 60 %)
    KANT_MAT.opacity = mjuk(0.45, 0.85, oppen.t);
    m.visible = syns && oppen.t > 0.45 && oppen.klipp.constant - d.Y0 < fot - 0.01;
    if (m.visible) { m.position.set(0, oppen.klipp.constant - 0.01 - husGrupp.position.y, 0); m.updateMatrix(); }
  }
  function stangDirekt() { oppen.pa = false; oppen.vantar = false; oppen.svav = 0; oppen.t = 0; oppen.fore = null; oppen.skarv = null; satsOppen(); if (matGrupp) matGrupp.visible = val.matt; }
  function oppna(pa, opts) {
    pa = !!pa; vakna();
    // Öppna tak utifrån avslutar planlösningen först (inte planvyns eget lyft, och inte dess
    // fortsättning när inredningen byggts färdigt)
    if (!plan.egen && !(plan.pa && opts && opts.efterVantan)) planBryt();
    if (opts && opts.lager && typeof opts.lager === 'object') Object.assign(oppen.lager, opts.lager);
    if (!husGrupp) return false;
    flygAvbryt(false);
    if (pa) {
      if (inneLage) inne(false);
      if (byggT < 1) { byggT = 1; satsBygg(1); }
      if (rivGrupp) { sluta(rivGrupp); rivGrupp = null; }
      // Inredningen inte klar än: taket lossnar direkt och svävar medan den byggs färdigt i
      // bitar och kompileras (förut byggdes den i klicket och sidan stod still i 1–5 s)
      // (och innan inredningen är uppladdad till grafikkortet: varmInne, annars hackade första lyftet)
      if ((!husGrupp.userData.inne || !husGrupp.userData.oppenVarm || (!husGrupp.userData.inneVarm && !FOTO)) && !oppen.pa && !(opts && (opts.direkt || opts.efterVantan))) {
        oppen.vantarOpts = opts || null;
        if (!oppen.vantar) {
          oppen.vantar = true;
          const hus = husGrupp;
          const lyft = () => {
            if (husGrupp !== hus || !oppen.vantar) return;
            oppen.vantar = false;
            try { oppna(true, Object.assign({}, oppen.vantarOpts, { direkt: lugn, efterVantan: true })); } catch (e) { console.warn(e); begarRender(); }
          };
          inneSnart(hus, () => { if (FOTO || husGrupp !== hus || !oppen.vantar) lyft(); else varmInne(hus).then(lyft, lyft); }, null, 12);
          // väntan får aldrig fastna (knappen visar aria-busy så länge): efter 12 s lyfts taket ändå
          setTimeout(lyft, 12000);
        }
        styr.autoRotate = false; zoomMal = null;
        begarRender();
        return true;
      }
      inneGrupp();
      klippAlla();
      const sn = oppenSnitt();
      oppen.snittMal = oppen.lager.loft === false ? sn.bot : sn.loft;
      if (oppen.t === 0) oppen.snittNu = oppen.snittMal;
      // öppnas igen mitt i stängningen: vyn före första öppningen gäller fortfarande
      // (annars åkte kameran aldrig tillbaka vid nästa stängning)
      if (oppen.t === 0 || !oppen.fore) oppen.fore = oppen.t > 0 && oppen.foreSist ? oppen.foreSist : { pos: kamera.position.clone(), mal: styr.target.clone() };
      oppen.pa = true;
      if (matGrupp) matGrupp.visible = false;
      styr.autoRotate = false; zoomMal = null;
      // högt trekvartsperspektiv (cirka 50° från lodlinjen), samma väderstreck som nu
      const Y0 = husGrupp.userData.delar.Y0;
      const loftFokus = oppen.lager.fokus === 'loft' && sn.harLoft && oppen.lager.loft !== false;
      // målet en bit upp, så att huset hamnar ovanför lagerraden (den täckte däcket och soffan)
      const mt = new THREE.Vector3(0, Y0 + (loftFokus ? Math.max(1.4, sn.loft - 1.0) : Math.min(oppen.snittMal, 2.4) * 0.35) + 0.35, 0);
      sA.setFromVector3(v1.copy(kamera.position).sub(styr.target));
      const r = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), sA.theta);
      const till = r.clone().multiplyScalar(avstand(r) * (loftFokus ? 0.8 : 0.95)).add(mt);
      styr.maxDistance = Math.max(styr.maxDistance, till.distanceTo(mt) * 1.3);
      aka = { fran: kamera.position.clone(), till, t: 0, tid: 1.1, mf: styr.target.clone(), mt };
      // direkt (eller rörelsekänslig användare): inget lyft, kameran hoppar
      if (lugn || (opts && opts.direkt)) {
        oppen.t = 1; oppen.snittNu = oppen.snittMal; aka = null;
        styr.target.copy(mt); kamera.position.copy(till); nySkugga = true; styrNu();
      }
      satsOppen(); begarRender();
      return true;
    }
    // ångrat medan taket svävade: det sätter sig igen (svävet tonar ut i ram)
    if (oppen.vantar) { oppen.vantar = false; begarRender(); }
    if (!oppen.pa) return false;
    oppen.pa = false;
    if (matGrupp) matGrupp.visible = val.matt;
    if (oppen.fore) { aka = { fran: kamera.position.clone(), till: oppen.fore.pos, t: 0, tid: 1.0, mf: styr.target.clone(), mt: oppen.fore.mal }; }
    if (lugn || (opts && opts.direkt)) {
      if (oppen.fore) { kamera.position.copy(oppen.fore.pos); styr.target.copy(oppen.fore.mal); }
      aka = null; stangDirekt(); nySkugga = true; styrNu();
    }
    oppen.foreSist = oppen.fore; oppen.fore = null;
    begarRender();
    return false;
  }

  // ---- Tomt hus: möblerna döljs, huset står kvar ----
  // Inredningen lägger det lösa sist i varje hopslagen mesh (userData.fastN = antal hörn i
  // det fasta, userData.losa = meshar med löst i). Allt löst döljs då med ett ritintervall:
  // ingen ombyggnad, inga nya material eller program, samma ritanrop. Bytet tonas med förra
  // bilden (0,4 s). Lösa lampor släcks och tas ur lamplistan så länge (ljus, glorior och
  // sken följer med), lösa sittplatser och möblernas gånghinder släpps.
  function tomtGeo() {
    const d = husGrupp && husGrupp.userData, ig = d && (d.inne || d.inneVantar);
    if (ig && Array.isArray(ig.userData.losa)) ig.userData.losa.forEach(m => { if (m && m.geometry) m.geometry.setDrawRange(0, tomt.pa ? (m.userData.fastN | 0) : Infinity); });
    const mb = d && d.delar && d.delar.ute && d.delar.ute.getObjectByName('mobler');
    if (mb) mb.visible = !tomt.pa;
  }
  function tomtIa(ut) {
    const d = husGrupp && husGrupp.userData, ig = d && d.inne;
    if (!ut || !ig) return;
    const ul = Array.isArray(ig.userData.lampor) ? ig.userData.lampor : [], us = Array.isArray(ig.userData.sittplatser) ? ig.userData.sittplatser : [];
    if (!ut.allaLampor) { ut.allaLampor = ut.lampor.slice(); ut.allaSitt = ut.sitt.slice(); }
    const minne = lampMinne[val.modell] || {};
    ut.allaLampor.forEach((L, i) => {
      if (!L || !ul[i] || !ul[i].los) return;
      if (tomt.pa) { if (ut.lampor[i]) { L.pa = false; L.t = 0; satsLampa(L); ut.lampor[i] = null; } }
      else if (!ut.lampor[i]) { L.pa = typeof minne[i] === 'boolean' ? minne[i] : ljus.kvall > 0.4; L.t = L.pa ? 1 : 0; ut.lampor[i] = L; satsLampa(L); }
    });
    ut.allaSitt.forEach((s, i) => { if (s && us[i] && us[i].los) ut.sitt[i] = tomt.pa ? null : s; });
  }
  function satTomt(pa, opts) {
    pa = !!pa;
    if (pa === tomt.pa) return pa;
    vakna();
    const d = husGrupp && husGrupp.userData, ig = d && d.inne;
    if (husGrupp && !(opts && opts.direkt)) { try { fangaOvergang(); tona.tid = 0.4; } catch (e) { console.warn(e); } }
    tomt.pa = pa;
    tomtGeo();
    if (ig) {
      try {
        const ut = iaData(), us = ig.userData.sittplatser;
        if (pa && gang.sitter >= 0 && Array.isArray(us) && us[gang.sitter] && us[gang.sitter].los) resDig();
        tomtIa(ut);
        // gloriorna byggs om nästa gång de behövs (de lösa lampornas och ljusens faller bort)
        if (d.halo) { if (d.halo.parent) d.halo.parent.remove(d.halo); d.halo.geometry.dispose(); }
        d.halo = undefined;
        if (inneLage) {
          satRumLjus(rumNu, undefined, true);
          if (flytt.rum >= 0) { flytt.spegel = flytt.rum; spegelSnart(); }   // spegeln visar annars möblerna som nyss stod där
        }
        lageLjus(); meddelaLampor();
      } catch (e) { console.warn(e); }
    }
    nySkugga = true; begarRender();
    return pa;
  }

  // ---- Planlösningen: huset rakt ovanifrån, uppritat som en ritning ----
  // Taket lyfts med dockskåpets vanliga lyft (bottenvåningen, loftet dolt) medan kameran
  // sveper upp till en lodrät vy med smalt synfält (nästan ortografisk). Väggar, mått och
  // rumsnamn ritas av husritare-plan.js som HTML/SVG ovanpå bilden. Allt är en funktion av
  // plan.t (0–1, drivs av tiden): samma bana spelas baklänges när vyn stängs, och den kan
  // vändas mitt i. Andra lägen (Se inne, vinklar, husbyte, Öppna tak) avslutar vyn direkt.
  const PLAN_FOV = 13, PLAN_IN = 2.2, PLAN_UT = 1.5;
  const pV = new THREE.Vector3(), pS = new THREE.Spherical();
  const planProj = (x, z, ut) => { pV.set(x, plan.y, z).project(kamera); ut[0] = (pV.x * 0.5 + 0.5) * dukB; ut[1] = (0.5 - pV.y * 0.5) * dukH; };
  const planTal = (v, n = 1) => String(Math.round(v * 10 ** n) / 10 ** n).replace('.', ',');
  // Ritningens innehåll, en gång per hus: väggarnas snitt (ytterväggar mellan dörrarna och
  // inredningens innerväggar), fönstren som glas, rumsnamn med ytor ur husets data och mått.
  function planData() {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.inne) return null;
    if (d.planData) return d.planData;
    const H = HUS[val.modell], L = H.L, W = H.W, T = 0.25, ud = d.inne.userData;
    const hin = Array.isArray(ud.hinder) ? ud.hinder.filter(b => b && [b.x0, b.z0, b.x1, b.z1].every(Number.isFinite)) : [];
    const rekt = b => ({ x0: Math.min(b.x0, b.x1), z0: Math.min(b.z0, b.z1), x1: Math.max(b.x0, b.x1), z1: Math.max(b.z0, b.z1) });
    const vaggar = [], glas = [];
    // ytterväggarna, ett varv: söder, öster, norr, väster. u = läget längs väggen från vänster
    // sett utifrån (som i HUS.oppningar); dörrar blir luckor, fönster och skjutdörrar glas
    const sidor = {
      S: [L, (a, b) => ({ x0: -L / 2 + a, x1: -L / 2 + b, z0: W / 2 - T, z1: W / 2 })],
      E: [W, (a, b) => ({ x0: L / 2 - T, x1: L / 2, z0: W / 2 - b, z1: W / 2 - a })],
      N: [L, (a, b) => ({ x0: L / 2 - b, x1: L / 2 - a, z0: -W / 2, z1: -W / 2 + T })],
      W: [W, (a, b) => ({ x0: -L / 2, x1: -L / 2 + T, z0: -W / 2 + a, z1: -W / 2 + b })],
    };
    Object.keys(sidor).forEach(s => {
      const [langd, bit] = sidor[s], kort = s === 'E' || s === 'W';
      const opp = (H.oppningar || []).filter(o => o[0] === s).map(o => ({ a: o[1], b: o[1] + o[2], dorr: o[5] === 'd' || o[5] === 'dg' })).sort((p, q) => p.a - q.a);
      let a = kort ? T : 0;
      const slut = kort ? langd - T : langd;
      opp.forEach(o => {
        if (o.a - a > 0.02) vaggar.push(bit(a, o.a));
        if (!o.dorr) { const g = bit(o.a, o.b); if (kort) { g.x0 += T * 0.3; g.x1 -= T * 0.3; } else { g.z0 += T * 0.3; g.z1 -= T * 0.3; } glas.push(g); }
        a = Math.max(a, o.b);
      });
      if (slut - a > 0.02) vaggar.push(bit(a, slut));
    });
    // innerväggarna (bitarna mellan dörrarna), från väster till öster
    let inre = hin.filter(b => b.typ === 'vagg');
    if (!inre.length) inre = hin.filter(b => !b.typ && !Number.isInteger(b.dorr) && b.niva === 'botten');
    inre.map(rekt).sort((p, q) => p.x0 - q.x0).forEach(b => vaggar.push(b));
    vaggar.forEach((v, i) => { v.i = i; });
    // rummens utbredning: från rumspunkten ut till närmaste vägg eller dörr åt varje håll
    const stopp = hin.filter(b => b.typ === 'vagg' || Number.isInteger(b.dorr)).map(rekt);
    const ext = (x, z) => {
      const e = { x0: -L / 2 + T, x1: L / 2 - T, z0: -W / 2 + T, z1: W / 2 - T };
      stopp.forEach(b => {
        if (z > b.z0 - 0.03 && z < b.z1 + 0.03) { if (b.x1 <= x + 0.02) e.x0 = Math.max(e.x0, b.x1); else if (b.x0 >= x - 0.02) e.x1 = Math.min(e.x1, b.x0); }
        if (x > b.x0 - 0.03 && x < b.x1 + 0.03) { if (b.z1 <= z + 0.02) e.z0 = Math.max(e.z0, b.z1); else if (b.z0 >= z - 0.02) e.z1 = Math.min(e.z1, b.z0); }
      });
      return e;
    };
    const yta = e => (e.x1 - e.x0) * (e.z1 - e.z0);
    const P = punkter(), vyer = INNE_VYER[val.modell] || [], rum = [], tagna = new Set();
    const vyFor = namn => { let i = vyer.findIndex(v => v.namn === namn); if (i < 0) i = vyer.findIndex(v => v.namn.startsWith(namn) || namn.startsWith(v.namn)); return Math.max(0, i); };
    const bott = P.map((p, i) => ({ p, i, e: ext(p.pos[0], p.pos[2]) })).filter(o => !nivaTal(o.p.niva));
    const forst = s => String(s).toLowerCase().split(/[\s/]+/)[0];
    // slutna rum får lappen mitt i rummet, öppna rum vid sin rumspunkt
    // (per led: där det är mindre än 4,6 m mellan väggarna gäller mitten, annars rumspunkten)
    const mittX = o => (o.e.x1 - o.e.x0 < 4.6 ? (o.e.x0 + o.e.x1) / 2 : o.p.pos[0]), mittZ = o => (o.e.z1 - o.e.z0 < 4.6 ? (o.e.z0 + o.e.z1) / 2 : o.p.pos[2]);
    const lapp = (namn, m2, o) => { rum.push({ namn, yta: m2 || 0, x: mittX(o), z: mittZ(o), w: o.e.x1 - o.e.x0, d: o.e.z1 - o.e.z0, vy: vyFor(o.p.namn) }); tagna.add(o.i); };
    const grupper = new Map();
    let loftYta = 0;
    (H.rum || []).forEach(([namn, m2]) => { if (/loft/i.test(namn)) { loftYta = m2; return; } if (!grupper.has(namn)) grupper.set(namn, []); grupper.get(namn).push(m2); });
    grupper.forEach((ytor, namn) => {
      let kand = bott.filter(o => !tagna.has(o.i) && o.p.namn === namn);
      if (!kand.length) kand = bott.filter(o => !tagna.has(o.i) && forst(o.p.namn) === forst(namn) && !/ och /.test(o.p.namn));
      // flera rum med samma namn (Sovrum): det största uppmätta rummet får den största ytan
      kand = kand.slice(0, ytor.length).sort((p, q) => yta(q.e) - yta(p.e));
      const ys = ytor.slice().sort((p, q) => q - p);
      kand.forEach((o, k) => lapp(namn, ys[k], o));
    });
    // rum utan yta i husets data (hall, korridor): bara namnet; utsiktspunkter i ett rum som redan har en lapp hoppas över
    bott.forEach(o => {
      if (tagna.has(o.i) || /kök| och /i.test(o.p.namn)) return;
      const x = mittX(o), z = mittZ(o);
      if (rum.some(R => Math.hypot(R.x - x, R.z - z) < 1.1)) return;
      lapp(o.p.namn, 0, o);
    });
    // loftet: streckad kontur ovanför bottenvåningen
    const loft = [];
    (Array.isArray(ud.golvYtor) ? ud.golvYtor : []).forEach(m => {
      if (!m || !m.isMesh || m.userData.niva !== 'loft') return;
      m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
      loft.push({ x0: b.min.x - 0.15, z0: b.min.z - 0.15, x1: b.max.x + 0.15, z1: b.max.z + 0.15 });
    });
    // mått: längden på den sida som inte har altanen, bredden i väster
    const sz = H.altan === 'S' ? -1 : 1, ut = 0.85;
    const matt = [
      { a: [-L / 2, sz * (W / 2 + ut)], b: [L / 2, sz * (W / 2 + ut)], text: planTal(L, 2) + ' m', ut: [0, sz * 0.55] },
      { a: [-L / 2 - ut, -W / 2], b: [-L / 2 - ut, W / 2], text: planTal(W, 2) + ' m', ut: [-0.75, 0] },
    ];
    return (d.planData = { L, W, vaggar, nOrdning: vaggar.length, glas, rum, loft, loftYta, loftText: 'N', matt });
  }
  // kamerans läge som (mål, riktning, halv bildhöjd i meter, synfält)
  function planPose() {
    pS.setFromVector3(pV.copy(kamera.position).sub(styr.target));
    return { mal: styr.target.clone(), theta: pS.theta, phi: pS.phi, halv: pS.radius * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2), fov: kamera.fov };
  }
  // läget rakt ovanifrån: norr uppåt (hög, smal bild: huset vridet ett kvarts varv), huset
  // mitt i den fria ytan mellan bildens kanter och verktygsraden
  function planTopp() {
    const d = husGrupp.userData, H = HUS[val.modell], B = Math.max(1, dukB), Hh = Math.max(1, dukH);
    // fri yta: bilden minus kanterna och verktygsraden. Huset fyller den, med plats för
    // måttlinjerna (0,85 m ut + talet) på två sidor; skalan s är bildpunkter per meter.
    const mS = 12, mT = 14, mB = 86, fW = B - 2 * mS, fH = Hh - mT - mB;
    const sL = Math.min((fW - 46) / (H.L + 1.5), (fH - 40) / (H.W + 1.5)), sP = Math.min((fW - 76) / (H.W + 2.4), (fH - 76) / (H.L + 2.4));
    // hög, smal bild: huset vrids ett kvarts varv om det blir tydligt större så
    const staende = sP > sL * 1.12, s = Math.max(3, staende ? sP : sL), halv = Hh / (2 * s), ned = (mB - mT) / 2 / s;
    let theta = 0;
    if (staende) { pS.setFromVector3(pV.copy(kamera.position).sub(styr.target)); theta = pS.theta < 0 ? -Math.PI / 2 : Math.PI / 2; }
    const mal = new THREE.Vector3(Math.sin(theta) * ned, d.delar.Y0 + 1.2, Math.cos(theta) * ned);
    // liggande: måtten står i väster och i söder (norr om altanen ligger i söder), så huset
    // skjuts en bit åt andra hållet och hamnar mitt i det som blir över
    if (!staende) { const u = (0.5 * s + 20) / 2 / s; mal.x -= u; mal.z += H.altan === 'S' ? -u : u; }
    return { mal, theta, phi: 0.0007, halv, fov: PLAN_FOV };
  }
  // kameran längs banan mellan A (vyn före) och B (rakt ovanifrån), e = 0..1
  function planKam(e) {
    const A = plan.A, B = plan.B;
    if (!A || !B) return;
    let dth = B.theta - A.theta; if (dth > Math.PI) dth -= Math.PI * 2; if (dth < -Math.PI) dth += Math.PI * 2;
    const fov = A.fov + (B.fov - A.fov) * e, halv = A.halv * Math.pow(B.halv / A.halv, e);
    styr.target.lerpVectors(A.mal, B.mal, e);
    pS.set(halv / Math.tan(THREE.MathUtils.degToRad(fov) / 2), A.phi + (B.phi - A.phi) * e, A.theta + dth * e);
    kamera.position.setFromSpherical(pS).add(styr.target);
    kamera.fov = fov; plan.fov = fov; kamera.updateProjectionMatrix();
  }
  function planRita() { if (plan.lager && plan.data) plan.lager.rita(planProj, plan.t, dukB, dukH); }
  function planKlar() {
    if (plan.grans) { styr.maxDistance = plan.grans.max; styr.minPolarAngle = plan.grans.pMin; plan.grans = null; }
    plan.fov = 0; plan.t = 0; plan.data = null;
    planBil(false);
    if (!inneLage) { kamera.fov = fovFor(false); kamera.updateProjectionMatrix(); }
    if (plan.lager) plan.lager.gom();
  }
  const planSag = () => { try { duk.dispatchEvent(new CustomEvent('husritare:plan', { detail: { pa: plan.pa } })); } catch (e) { console.warn(e); } };
  function planVy(pa, opts) {
    pa = !!pa;
    if (!husGrupp || pa === plan.pa) return plan.pa;
    const direkt = lugn || !!(opts && opts.direkt);
    vakna();
    if (pa) {
      if (inneLage) inneRakt(false);
      if (!plan.lager) plan.lager = skapaPlanlager(duk, i => {
        const R = plan.data && plan.data.rum[i];
        if (R) { try { duk.dispatchEvent(new CustomEvent('husritare:planrum', { detail: { vy: R.vy, namn: R.namn } })); } catch (e) { console.warn(e); } }
      });
      if (plan.t <= 0) {
        plan.varOppen = oppen.pa; plan.lagerFore = Object.assign({}, oppen.lager);
        plan.A = planPose(); plan.A.pos = kamera.position.clone();
        plan.grans = { max: styr.maxDistance, pMin: styr.minPolarAngle };
        plan.B = planTopp(); plan.data = null;
      }
      plan.pa = true; plan.egen = true;
      try { oppna(true, { lager: { tak: false, loft: false, fokus: null }, direkt }); } catch (e) { console.warn(e); } finally { plan.egen = false; }
      aka = null; zoomMal = null; styr.autoRotate = false;
      styr.minPolarAngle = 0; styr.maxDistance = Math.max(styr.maxDistance, plan.B.halv / Math.tan(THREE.MathUtils.degToRad(plan.B.fov) / 2) * 1.5);
      if (direkt) { plan.t = 1; planHamta(); planKam(1); planBil(true); nySkugga = true; styrNu(); }
    } else {
      if (direkt && !lugn) { try { fangaOvergang(); tona.tid = 0.4; } catch (e) { console.warn(e); } }
      if (plan.t >= 1) { const A = plan.A; plan.B = planPose(); if (A) plan.A = A; }   // man kan ha vridit eller zoomat i planvyn
      plan.pa = false; plan.egen = true;
      try {
        if (plan.varOppen) oppna(true, { lager: plan.lagerFore, direkt });
        else oppna(false, { direkt });
      } catch (e) { console.warn(e); } finally { plan.egen = false; }
      if (plan.lagerFore) Object.assign(oppen.lager, plan.lagerFore);
      // nästa taklyft utgår från vyn före planlösningen (inte från en punkt mitt i svepet)
      if (!plan.varOppen && plan.A && plan.A.pos) oppen.foreSist = { pos: plan.A.pos.clone(), mal: plan.A.mal.clone() };
      aka = null; zoomMal = null;
      if (direkt) { planKam(0); planKlar(); nySkugga = true; styrNu(); }
    }
    begarRender();
    planSag();
    return plan.pa;
  }
  function planHamta() {
    if (plan.data || !husGrupp) return !!plan.data;
    let D = null;
    try { D = planData(); } catch (e) { console.warn(e); }
    if (!D) return false;
    const sn = oppenSnitt();
    plan.y = husGrupp.userData.delar.Y0 + sn.bot;
    plan.data = D; plan.lager.satt(D);
    return true;
  }
  // andra lägen tar över: planvyn avslutas direkt (förra bilden tonas bort)
  function planBryt() { if (plan.pa || plan.t > 0) planVy(false, { direkt: true }); if (plan.t > 0) { planKam(0); planKlar(); planSag(); } }
  function stegPlan(dt) {
    if (!plan.pa && plan.t <= 0) return false;
    const mal = plan.pa ? 1 : 0;
    if (plan.pa && !plan.data) planHamta();
    if (plan.t === mal) return plan.pa && !plan.data;   // väntar på inredningen: rutorna fortsätter
    const forr = plan.t;
    plan.t = plan.pa ? Math.min(1, plan.t + dt / PLAN_IN) : Math.max(0, plan.t - dt / PLAN_UT);
    // uppritningen väntar på inredningen (taket svävar så länge), kameran hinner före
    if (plan.pa && !plan.data) plan.t = Math.min(plan.t, 0.34);
    aka = null;
    planKam(inUt(del(plan.t, 0, 0.7)));
    planBil(plan.t > 0.34);
    if (!plan.pa && plan.t <= 0) { planKlar(); nySkugga = true; }
    return plan.t !== forr || (plan.pa && !plan.data);
  }
  // bilen på tomten skymmer ritningen (i smala bilder ligger den över måtten): borta medan
  // ritningen syns, tillbaka när man lämnar planlösningen. Bara synligheten, inget byggs om.
  function planBil(dold) {
    if (dold === !!plan.bilDold) return;
    const bil = scene.getObjectByName('elbil');
    if (!bil) return;
    if (dold) { plan.bilSyns = bil.visible; bil.visible = false; } else bil.visible = plan.bilSyns !== false;
    plan.bilDold = dold; nySkugga = true;
  }

  // ---- Ytterdörren och åkningen in genom den ----
  // Huvuddörrens blad ligger i de hopslagna väggytorna (utsidan) och i inredningens ytor
  // (den vita insidan med trycke). Första gången dörren behövs lyfts alla trianglar som
  // ligger helt inom bladets volym ut till en pivå vid gångjärnen (ytterdorr); i källan dras
  // de ihop till punkter. Dörren går utåt, som svenska ytterdörrar.
  // Åkningen (flyg) är en ren funktion av s (0 = ute, 1 = inne): kamerans bana, blick och
  // synfält, dörrens vinkel och bytet ute/inne i dörröppningen. s drivs av tiden (inte av
  // rutorna) och kan vända mitt i; ut ur huset spelas samma bana baklänges.
  const DORR_VINKEL = 1.72, FLYG_IN = 2.2, FLYG_UT = 1.5;
  let flyg = null;
  function ytterdorr() {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.delar) return null;
    if (d.ydorr !== undefined) return d.ydorr;
    if (!d.inne && !d.inneVantar) return null;   // insidans blad finns först med inredningen
    d.ydorr = null;
    const H = HUS[val.modell], o = H.oppningar.find(x => x[5] === 'd') || H.oppningar.find(x => x[5] === 'dg');
    if (!o) return null;
    try {
      const L = H.L, W = H.W, s = o[0], u0 = o[1], w = o[2], h = o[4], KARM = 0.055;
      const ax = { S: [[-L / 2, 0, W / 2], [1, 0, 0], [0, 0, 1]], N: [[L / 2, 0, -W / 2], [-1, 0, 0], [0, 0, -1]], E: [[L / 2, 0, W / 2], [0, 0, -1], [1, 0, 0]], W: [[-L / 2, 0, -W / 2], [0, 0, 1], [-1, 0, 0]] }[s];
      const uA = new THREE.Vector3(...ax[1]), nA = new THREE.Vector3(...ax[2]);
      const mtx = new THREE.Matrix4().makeBasis(uA, UPP, nA).setPosition(new THREE.Vector3(...ax[0]));
      // gångjärnen sitter som i oppning(): höger sett utifrån på norr och väst, annars vänster
      const gs = s === 'N' || s === 'W' ? 1 : -1, cu = u0 + w / 2, gx = cu + gs * (w / 2 - KARM - 0.002), PZ = -0.045;
      const vaggar = d.delar.vaggar, fast = new THREE.Group(), piv = new THREE.Group();
      fast.add(piv);
      new THREE.Matrix4().copy(mtx).multiply(new THREE.Matrix4().makeTranslation(gx, 0, PZ)).decompose(fast.position, fast.quaternion, fast.scale);
      vaggar.add(fast);
      husGrupp.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(fast.matrixWorld).invert();
      // bladets volym i pivåns koordinater: innanför karmen, över tröskeln, från tryckets
      // utsida till insidans trycke
      const xa = u0 + KARM - 0.003 - gx, xb = u0 + w - KARM + 0.003 - gx;
      const lada = new THREE.Box3(new THREE.Vector3(Math.min(xa, xb), 0.026, -0.2 - PZ), new THREE.Vector3(Math.max(xa, xb), h - KARM + 0.003, 0.04 - PZ));
      const kalla = [];
      vaggar.traverse(m => { if (m.isMesh && !m.isInstancedMesh && m.geometry && m.geometry.attributes.position && m.material && !Array.isArray(m.material) && m.material.visible !== false) kalla.push(m); });
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), bb = new THREE.Box3(), M = new THREE.Matrix4(), kopior = new Map();
      let skugga = false;
      kalla.forEach(m => {
        const g = m.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        M.multiplyMatrices(inv, m.matrixWorld);
        if (!bb.copy(g.boundingBox).applyMatrix4(M).intersectsBox(lada)) return;
        const pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, tri = [];
        if (pos.isInterleavedBufferAttribute) return;
        for (let i = 0; i + 2 < n; i += 3) {
          const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
          if (lada.containsPoint(a.fromBufferAttribute(pos, i0).applyMatrix4(M)) && lada.containsPoint(b.fromBufferAttribute(pos, i1).applyMatrix4(M)) && lada.containsPoint(c.fromBufferAttribute(pos, i2).applyMatrix4(M))) tri.push(i0, i1, i2, i);
        }
        if (!tri.length) return;
        const ny = new THREE.BufferGeometry(), antal = tri.length / 4 * 3;
        for (const namn in g.attributes) {
          const at = g.attributes[namn];
          if (at.isInterleavedBufferAttribute) continue;
          const arr = new at.array.constructor(antal * at.itemSize);
          let k = 0;
          for (let t = 0; t < tri.length; t += 4) for (let j = 0; j < 3; j++) { const vi = tri[t + j] * at.itemSize; for (let e = 0; e < at.itemSize; e++) arr[k++] = at.array[vi + e]; }
          ny.setAttribute(namn, new THREE.BufferAttribute(arr, at.itemSize, at.normalized));
        }
        ny.applyMatrix4(M);
        // i källan: trianglarna dras ihop till en punkt (antalet hörn ändras inte, så fönstrens
        // minne av var deras bågar ligger gäller fortfarande)
        for (let t = 0; t < tri.length; t += 4) {
          const i = tri[t + 3];
          if (idx) { idx.setX(i + 1, tri[t]); idx.setX(i + 2, tri[t]); }
          else { a.fromBufferAttribute(pos, tri[t]); pos.setXYZ(tri[t + 1], a.x, a.y, a.z); pos.setXYZ(tri[t + 2], a.x, a.y, a.z); }
        }
        if (idx) idx.needsUpdate = true; else pos.needsUpdate = true;
        let mm = m.material;
        if (mm.userData.inneKlipp) {
          // inredningens material klipps vid ytterväggens insida och ritas aldrig över fasaden:
          // bladet som svänger ut får en egen kopia utan de planen och utan stencilprovet
          let k = kopior.get(mm);
          if (!k) {
            k = klonaMat(mm);
            const ik = mm.userData.inneKlipp;
            k.clippingPlanes = (mm.clippingPlanes || []).filter(p => !ik.includes(p)); k.userData.inneKlipp = [];
            k.stencilWrite = false; k.stencilFunc = THREE.AlwaysStencilFunc;
            kopior.set(mm, k);
          }
          mm = k;
        }
        const dm = new THREE.Mesh(ny, mm);
        dm.castShadow = m.castShadow; dm.receiveShadow = m.receiveShadow; dm.renderOrder = m.renderOrder; dm.layers.mask = m.layers.mask;
        if (typeof m.onBeforeRender === 'function') dm.onBeforeRender = m.onBeforeRender;
        dm.name = 'ytterdorr-blad';
        if (m.castShadow) skugga = true;
        piv.add(dm);
      });
      if (!piv.children.length) { vaggar.remove(fast); return null; }
      fast.updateMatrixWorld(true);
      // öppningens mitt i väggarnas koordinater (3 cm från gångjärnssidan, där det öppna bladet står)
      const mitt = new THREE.Vector3(cu - gs * 0.03, 0, 0).applyMatrix4(mtx);
      d.ydorr = { fast, piv, gs, t: 0, n: nA, u: uA, mitt, w, h, kopior: [...kopior.values()], skugga };
    } catch (e) { console.warn(e); d.ydorr = null; }
    return d.ydorr;
  }
  function satsYdorr(Y, t) {
    if (!Y || Y.t === t) return;
    // (skuggkartan räknas inte om under åkningen, bara efter landningen: se flygSlut)
    Y.t = t; Y.piv.rotation.y = Y.gs * DORR_VINKEL * t;
  }
  // dörröppningens läge ur ritningen (behövs innan bladet är utlyft): mitt, normal och gångjärnssida
  function dorrInfo() {
    const d = husGrupp && husGrupp.userData;
    if (!d || !d.delar) return null;
    if (d.dorrInfo !== undefined) return d.dorrInfo;
    const H = HUS[val.modell], o = H.oppningar.find(x => x[5] === 'd') || H.oppningar.find(x => x[5] === 'dg');
    if (!o) return (d.dorrInfo = null);
    const L = H.L, W = H.W, s = o[0], gs = s === 'N' || s === 'W' ? 1 : -1;
    const ax = { S: [[-L / 2, 0, W / 2], [1, 0, 0], [0, 0, 1]], N: [[L / 2, 0, -W / 2], [-1, 0, 0], [0, 0, -1]], E: [[L / 2, 0, W / 2], [0, 0, -1], [1, 0, 0]], W: [[-L / 2, 0, -W / 2], [0, 0, 1], [-1, 0, 0]] }[s];
    const u = new THREE.Vector3(...ax[1]), n = new THREE.Vector3(...ax[2]);
    return (d.dorrInfo = { n, u, gs, w: o[2], mitt: new THREE.Vector3(...ax[0]).addScaledVector(u, o[1] + o[2] / 2 - gs * 0.03) });
  }
  // fritt avstånd för kameran på bottenvåningen: till ytterväggarnas insida, innerväggar, trappan
  // och möbler (utanMobel: möblerna räknas inte). Dörrarnas lådor räknas aldrig, de öppnas.
  function friFlyg(x, z, utanMobel) {
    const H = hinderLista(), d = husGrupp.userData;
    let m = Math.min(d.L / 2 - 0.25 - Math.abs(x), d.W / 2 - 0.25 - Math.abs(z));
    for (let i = 0; i < H.length; i++) {
      const b = H[i];
      if (b.niva === 1 || b.dorr >= 0 || (utanMobel && b.mobel)) continue;
      const dx = x - Math.min(b.x1, Math.max(b.x0, x)), dz = z - Math.min(b.z1, Math.max(b.z0, z)), l = Math.hypot(dx, dz);
      if (l < m) m = l;
    }
    return m;
  }
  // Vägen inne från (ax, az) till (bx, bz): kortaste vägen i ett rutnät om 10 cm där rutor
  // närmare än 38 cm från väggar och möbler är stängda (utom intill start och mål) och trånga
  // rutor kostar mer, så att vägen håller mitten av passagen. Svaret är hörnpunkterna emellan.
  function inneVag(ax, az, bx, bz) {
    const d = husGrupp.userData, C = 0.1, nx = Math.round(d.L / C) + 1, nz = Math.round(d.W / C) + 1, x0 = -d.L / 2, z0 = -d.W / 2;
    const karta = hard => {
      const nyckel = hard ? 'friHard' : 'friMjuk';
      if (!d[nyckel]) { const k = new Float32Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) k[j * nx + i] = friFlyg(x0 + i * C, z0 + j * C, !hard); d[nyckel] = k; }
      return d[nyckel];
    };
    const ruta = (x, z) => Math.max(0, Math.min(nx - 1, Math.round((x - x0) / C))) + Math.max(0, Math.min(nz - 1, Math.round((z - z0) / C))) * nx;
    const nara = (x, z) => Math.min(Math.hypot(x - ax, z - az), Math.hypot(x - bx, z - bz));
    const sok = (K, KLAR) => {
      const start = ruta(ax, az), mal = ruta(bx, bz), N = nx * nz;
      if (start === mal) return [];
      const g = new Float32Array(N).fill(Infinity), fran = new Int32Array(N).fill(-1), stangd = new Uint8Array(N), hog = [];
      const in_ = (i, f) => { let k = hog.length; hog.push([f, i]); while (k > 0) { const p = (k - 1) >> 1; if (hog[p][0] <= hog[k][0]) break; const t = hog[p]; hog[p] = hog[k]; hog[k] = t; k = p; } };
      const ut = () => {
        const topp = hog[0], sist = hog.pop();
        if (hog.length) { hog[0] = sist; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < hog.length && hog[a][0] < hog[m][0]) m = a; if (b < hog.length && hog[b][0] < hog[m][0]) m = b; if (m === k) break; const t = hog[m]; hog[m] = hog[k]; hog[k] = t; k = m; } }
        return topp[1];
      };
      g[start] = 0; in_(start, 0);
      while (hog.length) {
        const i = ut();
        if (stangd[i]) continue;
        stangd[i] = 1;
        if (i === mal) break;
        const ix = i % nx, iz = (i / nx) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const jx = ix + dx, jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
          const j = jz * nx + jx;
          if (stangd[j]) continue;
          const c = K[j], xx = x0 + jx * C, zz = z0 + jz * C;
          if (c < KLAR && !(c > 0.04 && nara(xx, zz) < 0.75)) continue;
          const ng = g[i] + (dx && dz ? 1.4142 : 1) * C * (1 + 3 * Math.max(0, 0.75 - c));
          if (ng < g[j]) { g[j] = ng; fran[j] = i; in_(j, ng + Math.hypot(xx - bx, zz - bz)); }
        }
      }
      if (fran[mal] < 0) return null;
      const l = [];
      for (let i = fran[mal]; i >= 0 && i !== start; i = fran[i]) l.push({ x: x0 + (i % nx) * C, z: z0 + ((i / nx) | 0) * C });
      return l.reverse();
    };
    let K = karta(true), v = sok(K, 0.38);
    if (!v) { K = karta(false); v = sok(K, 0.38); }
    if (!v) v = sok(K, 0.15);
    if (!v || !v.length) return [];
    // förenkla: från varje punkt rakt till den längst bort som nås med 42 cm fritt hela vägen
    const fritt = (p, q) => {
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.07));
      for (let k = 1; k < n; k++) { const x = p.x + (q.x - p.x) * k / n, z = p.z + (q.z - p.z) * k / n, c = K[ruta(x, z)]; if (c < 0.42 && !(c > 0.04 && nara(x, z) < 0.75)) return false; }
      return true;
    };
    const mal = { x: bx, z: bz }, svar = [];
    let nu = { x: ax, z: az }, k = 0;
    for (let varv = 0; varv < 200 && !fritt(nu, mal); varv++) {
      let j = v.length - 1;
      while (j > k && !fritt(nu, v[j])) j--;
      if (j < k) break;
      svar.push(v[j]); nu = v[j]; k = j + 1;
      if (k >= v.length) break;
    }
    return svar;
  }
  // ---- Värmning av inneläget, i vila efter laddningen ----
  // Första gången man klev in gjordes allt detta i klicket (uppmätt: 46 nya program, 77
  // geometrier och spegelns kubkarta i en enda uppgift). Nu görs det i förväg, i bitar:
  // 1. det som räknas en gång per hus (rummens ljus, grannrum, golv, vägkartan),
  // 2. programmen för spegelns kubkarta kompileras utan att låsa sidan,
  // 3. en ruta av inneläget ritas i ett hörn om 8 × 8 bildpunkter (allt laddas upp till
  //    grafikkortet, och det som ändå saknar program får det), 4. spegeln fångas.
  // Steg 3 och 4 körs i ram (varmJobb), före den vanliga bilden, en ruta var.
  let varmJobb = null;
  const varmKam = new THREE.PerspectiveCamera();
  const varmFar = () => !inneLage && !oppen.pa && oppen.t === 0 && byggT >= 1 && !rivGrupp && !aka && (!flyg || (flyg.bana && flyg.bana.halv));
  function iInnelaget(v, fn) {
    const ri = rumFor(v), lager = kamera.layers.mask;
    inneLage = true;
    try { satRumLjus(ri, v.ljus); lageLjus(); fn(ri); } catch (e) { console.warn(e); }
    finally { inneLage = false; lageLjus(); kamera.layers.mask = lager; }
  }
  function varmInne(hus) {
    const d = hus.userData;
    if (d.inneVarm) return Promise.resolve(true);
    if (d.varmLofte) return d.varmLofte;
    const giltig = () => husGrupp === hus, sov = ms => new Promise(r => setTimeout(r, ms));
    const v = (INNE_VYER[val.modell] || [])[0];
    d.varmLofte = (async () => {
      if (!v || !d.inne) return false;
      // väntar tills inget annat pågår (taket av, redan inne, en vinkelåkning)
      for (let i = 0; i < 400 && giltig() && !varmFar(); i++) { if (inneLage) { d.inneVarm = true; return true; } await sov(250); }
      if (!giltig()) return false;
      try { rumsLjus(); golvLista(); byggPunkter(); ytterdorr(); } catch (e) { console.warn(e); }
      // taklyftet: takskiktets delar mäts en gång (satsLager gjorde det i första lyftet)
      try {
        const Lg = inneData().lager, Y0 = d.delar.Y0;
        if (Lg && Lg.tak) Lg.tak.children.forEach(o => { if (o.userData.takTopp === undefined) { o.updateWorldMatrix(true, true); o.userData.takTopp = takLada.setFromObject(o).max.y - Y0; } });
      } catch (e) { console.warn(e); }
      await sov(0);
      if (!giltig() || !varmFar()) { d.varmLofte = null; return false; }
      iInnelaget(v, () => {}); marke('varm-data');
      await sov(0);
      if (!giltig()) return false;
      try { const Y = dorrInfo(), Y0 = d.delar.Y0; if (Y) inneVag(Y.mitt.x - Y.n.x * 0.6, Y.mitt.z - Y.n.z * 0.6, v.pos[0], v.pos[2]); } catch (e) { console.warn(e); }
      await sov(0);
      const speglar = d.inne.userData && Array.isArray(d.inne.userData.speglar) && d.inne.userData.speglar.length;
      if (speglar) { spegelRigg(); try { await kompKlipp([scene], giltig, 8, spegelRT); } catch (e) { console.warn(e); } }
      if (!giltig()) return false;
      for (let i = 0; i < 400 && giltig() && !varmFar(); i++) { if (inneLage) { d.inneVarm = true; return true; } await sov(250); }
      if (!giltig()) return false;
      marke('varm-program');
      await new Promise(klar => { varmJobb = { hus, v, steg: 0, klar }; begarRender(); });
      if (!giltig()) return false;
      d.inneVarm = true; marke('rit-inne-varm');
      return true;
    })().catch(e => { console.warn(e); return false; });
    return d.varmLofte;
  }
  // körs i ram före den vanliga bilden; svarar sant medan det finns mer att göra
  function stegVarm() {
    const J = varmJobb;
    if (!J) return false;
    if (J.hus !== husGrupp) { varmJobb = null; J.klar(false); return false; }
    // väntar (något annat pågår, eller man har just tryckt): ett nytt försök lite senare
    if (!varmFar() || (performance.now() - inmatSist < 400 && !vantarPaKomp())) { setTimeout(begarRender, 300); return false; }
    const d = J.hus.userData, skugga = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;
    try {
      if (J.steg === 0) {
        iInnelaget(J.v, () => {
          const Y0 = d.delar.Y0, oculled = [];
          varmKam.copy(kamera); varmKam.fov = 62; varmKam.aspect = 1; varmKam.updateProjectionMatrix();
          varmKam.position.set(J.v.pos[0], J.v.pos[1] + Y0, J.v.pos[2]); varmKam.lookAt(J.v.mal[0], J.v.mal[1] + Y0, J.v.mal[2]); varmKam.updateMatrixWorld();
          varmKam.layers.mask = 3;
          J.hus.traverse(o => { if ((o.isMesh || o.isLine || o.isPoints) && o.frustumCulled) { o.frustumCulled = false; oculled.push(o); } });
          const pm = d.punktMesh, pmSyns = pm && pm.visible; if (pm) pm.visible = true;
          const pr = renderer.getPixelRatio(), sida = 8 / pr;
          renderer.setScissorTest(true); renderer.setViewport(0, 0, sida, sida); renderer.setScissor(0, 0, sida, sida);
          try {
            renderer.render(scene, varmKam);
            // toningens program och textur (bytet i dörröppningen)
            tonTextur(); tonMat.uniforms.alfa.value = 0; renderer.autoClear = false; renderer.render(tonScen, tonKam); renderer.autoClear = true;
          } finally {
            renderer.autoClear = true; renderer.setScissorTest(false); renderer.setViewport(0, 0, dukB, dukH); renderer.setScissor(0, 0, dukB, dukH);
            oculled.forEach(o => { o.frustumCulled = true; }); if (pm) pm.visible = pmSyns;
          }
        });
        J.steg = 1; tona.farsk = false; marke('varm-ruta');
        return true;
      }
      if (J.steg === 1) { iInnelaget(J.v, ri => fangaSpeglar(ri)); J.steg = 2; marke('varm-spegel'); return true; }
      // 5. taklyftet: en ruta mitt i lyftet (takets genomskinliga kopior, snittet, snittkanten och
      // dockskåpets ljus) i samma lilla hörn, så att första lyftet inte tar programmen i bruk
      const spar = Object.assign({}, oppen), sparVis = Object.assign({}, oppen.vis), sparLager = Object.assign({}, oppen.lager);
      try {
        klippAlla();
        const sn = oppenSnitt();
        oppen.snittMal = oppen.snittNu = sn.loft; oppen.pa = true; oppen.t = 0.55; oppen.skarv = null; oppen.riktForra = true;
        satsOppen();
        varmKam.copy(kamera); varmKam.aspect = 1; varmKam.updateProjectionMatrix(); varmKam.layers.mask = 3;
        varmKam.position.set(d.L * 0.6, d.hojd + 6, d.W * 0.9 + 3); varmKam.lookAt(0, 1.5, 0); varmKam.updateMatrixWorld();
        const pr = renderer.getPixelRatio(), sida = 8 / pr, oculled = [];
        J.hus.traverse(o => { if ((o.isMesh || o.isLine || o.isPoints) && o.frustumCulled) { o.frustumCulled = false; oculled.push(o); } });
        renderer.setScissorTest(true); renderer.setViewport(0, 0, sida, sida); renderer.setScissor(0, 0, sida, sida);
        try { renderer.render(scene, varmKam); } finally {
          renderer.setScissorTest(false); renderer.setViewport(0, 0, dukB, dukH); renderer.setScissor(0, 0, dukB, dukH);
          oculled.forEach(o => { o.frustumCulled = true; });
        }
      } finally {
        const lana = oppen.lana;   // takets lånade kopior lämnas tillbaka av satsOppen nedan, inte här
        Object.assign(oppen, spar); oppen.lana = lana; Object.assign(oppen.vis, sparVis); Object.assign(oppen.lager, sparLager);
        satsOppen(); nySkugga = true; tona.farsk = false;
      }
    } catch (e) { console.warn(e); }
    finally { renderer.shadowMap.needsUpdate = skugga; }
    varmJobb = null; J.klar(true);
    return false;
  }
  // s → andel av banans längd: lugn start, fart fram till knuten (3,2 m framför dörren) och
  // en mjuk inbromsning genom dörren och fram till ögats plats (monoton kubisk Hermite)
  function flygTakt(sK, fK) {
    const d0 = fK / sK, d1 = (1 - fK) / (1 - sK), m1 = d0 + d1 > 1e-6 ? 2 * d0 * d1 / (d0 + d1) : 0;
    const h = (x0, x1, y0, y1, k0, k1, x) => { const hh = x1 - x0, t = (x - x0) / hh, t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * hh * k0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * hh * k1; };
    return s => (s <= 0 ? 0 : s >= 1 ? 1 : s < sK ? h(0, sK, 0, fK, 0, m1, s) : h(sK, 1, fK, 1, m1, 0, s));
  }
  // Banan: en båge runt huset från kamerans plats ute till en punkt framför dörren, rakt
  // genom öppningens mitt och sedan (via en dörröppning om en vägg står emellan) till ögat inne
  // halv: inredningen är inte klar än. Banan går då bara fram till dörren (kameran stannar
  // mjukt 3,2 m framför den, se stegFlyg) och byts mot den hela när allt är förberett.
  function flygBana(uteP, uteM, inneP, inneQ, inneFovNu, halv) {
    const Y = dorrInfo();
    if (!Y) return null;
    const d = husGrupp.userData, oy = d.delar.Y0 + 1.55, n = Y.n;
    const D = Y.mitt.clone(); D.y = oy;
    if (halv) { inneP = D.clone().addScaledVector(n, -1.4); inneQ = new THREE.Quaternion().setFromRotationMatrix(flM.lookAt(D, inneP, UPP)); }
    const P = [], lagg = p => { if (!P.length || P[P.length - 1].distanceTo(p) > 0.18) { P.push(p); return true; } return false; };
    const A1 = D.clone().addScaledVector(n, 3.2); A1.y = oy + 0.1;
    const fA = new THREE.Spherical().setFromVector3(v1.copy(uteP).sub(hem)), fB = new THREE.Spherical().setFromVector3(v1.copy(A1).sub(hem));
    let dth = fB.theta - fA.theta; if (dth > Math.PI) dth -= Math.PI * 2; if (dth < -Math.PI) dth += Math.PI * 2;
    const N = Math.max(2, Math.ceil(Math.abs(dth) / 0.4) + 1), sf = new THREE.Spherical();
    for (let i = 0; i < N; i++) {
      const e = i / N;
      // avståndet krymper sent, så att bågen går runt hörnet och inte genom huset
      sf.set(fA.radius + (fB.radius - fA.radius) * Math.pow(e, 1.6), Math.max(0.05, fA.phi + (fB.phi - fA.phi) * e), fA.theta + dth * e);
      lagg(new THREE.Vector3().setFromSpherical(sf).add(hem));
    }
    if (!lagg(A1)) P[P.length - 1] = A1;
    const iA1 = P.length - 1;
    P.push(D.clone().addScaledVector(n, 2.0)); const iA2 = P.length - 1;
    P.push(D.clone().addScaledVector(n, 1.0));
    P.push(D.clone()); const iT = P.length - 1;
    const A4 = D.clone().addScaledVector(n, -0.6);
    P.push(A4); const iA4 = P.length - 1;
    // inne: en väg som håller avstånd till väggar och möbler (inneVag), med tätare punkter på
    // långa raksträckor så att kurvan inte buktar ut i svängarna
    let via = [];
    if (!halv) { try { via = inneVag(A4.x, A4.z, inneP.x, inneP.z); } catch (e) { console.warn(e); via = []; } }
    let fx = A4.x, fz = A4.z;
    via.concat([{ x: inneP.x, z: inneP.z, slut: true }]).forEach(q => {
      const l = Math.hypot(q.x - fx, q.z - fz), bitar = Math.max(1, Math.round(l / 0.9));
      for (let k = 1; k <= bitar; k++) { if (k === bitar && q.slut) break; lagg(new THREE.Vector3(fx + (q.x - fx) * k / bitar, oy, fz + (q.z - fz) * k / bitar)); }
      fx = q.x; fz = q.z;
    });
    if (!lagg(inneP.clone())) { if (P.length - 1 > iA4) P[P.length - 1] = inneP.clone(); else P.push(inneP.clone().addScaledVector(n, -0.001)); }
    const DIV = 600, kurva = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    kurva.arcLengthDivisions = DIV;
    const lg = kurva.getLengths(DIV), L = lg[DIV] || 1;
    const fVid = i => lg[Math.round(i / (P.length - 1) * DIV)] / L;
    const fA1 = fVid(iA1), fA2 = fVid(iA2), fT = fVid(iT), fA4 = fVid(iA4);
    // knuten vid halva tiden; börjar kameran nära dörren kommer den tidigare
    const sK = Math.min(0.46, Math.max(0.22, 0.18 + fA1 * 0.4)), takt = flygTakt(sK, Math.min(0.97, Math.max(0.02, fA1)));
    const sVid = f => { let a = 0, b = 1; for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (takt(m) < f) a = m; else b = m; } return (a + b) / 2; };
    const tidIn = FLYG_IN + (Math.abs(dth) > 2 ? 0.2 : 0);
    // dörren står helt öppen när kameran är 2 m framför den (den börjar öppnas 0,9 s före),
    // och stängs bakom en när man är inne
    const sO1 = Math.max(0.06, sVid(fA2)), sO0 = Math.max(0.01, sO1 - 0.9 / tidIn), sC0 = Math.min(sVid(fA4 + 0.5 / L), 1 - 0.3 / tidIn), sT = sVid(fT - 0.12 / L);
    // blicken: genom dörrens mitt i ögonhöjd mot en punkt långt bakom huset; från dörren
    // vrids den mot vyns riktning, jämnt fördelat över tiden fram till landningen
    const sikte = D.clone().addScaledVector(n, -(Math.max(d.L, d.W) + 4));
    const sG0 = Math.min(sVid(fT - 0.6 / L), 0.9);
    return { Y: null, kurva, L, takt, sVid, sK, fA1, fA2, fT, fA4, sO0, sO1, sC0, sT, sG0, sTak: halv ? sVid(fA1) : 1, halv: !!halv, tidIn, tidUt: FLYG_UT, sikte, uteM: uteM.clone(), inneP: inneP.clone(), inneQ: inneQ.clone(), fovInne: inneFovNu };
  }
  const flM = new THREE.Matrix4(), flQ = new THREE.Quaternion(), flV = new THREE.Vector3();
  // allt som beror på s: läget ute/inne, kameran, dörren och vinjetten
  function satsFlyg(F) {
    const B = F.bana, s = F.s, f = B.takt(s);
    const villInne = s >= B.sT;
    if (villInne !== inneLage) flygByt(F, villInne);
    B.kurva.getPointAt(f, kamera.position);
    flV.copy(B.uteM).lerp(B.sikte, mjuk(0, 0.42, s));
    flM.lookAt(kamera.position, flV, UPP);
    // (femtegradskurvan börjar och slutar utan vare sig fart eller acceleration i vridningen)
    const g = del(s, B.sG0, 0.985), gk = g * g * g * (g * (g * 6 - 15) + 10);
    kamera.quaternion.setFromRotationMatrix(flM).slerp(B.inneQ, gk);
    kamera.fov = fovFor(false) + (B.fovInne - fovFor(false)) * mjuk(B.fA1, B.fA4, f);
    kamera.updateProjectionMatrix();
    styr.target.copy(kamera.position).add(flV.set(0, 0, -(inneLage ? 0.01 : 4)).applyQuaternion(kamera.quaternion));
    const Y = B.halv ? null : husGrupp.userData.ydorr;
    satsYdorr(Y, Math.min(inUt(del(s, B.sO0, B.sO1)), 1 - inUt(del(s, B.sC0, 1))));
    // en stängd innerdörr på vägen öppnas när kameran närmar sig
    if (inneLage && F.rikt > 0 && s < 0.97) { flV.set(0, 0, -0.7).applyQuaternion(kamera.quaternion); try { autoDorr(kamera.position.x + flV.x, kamera.position.z + flV.z, -2); } catch (e) { /* utan dörrar */ } }
    // vinjetten tätnar kring dörröppningen och släpper när man är inne
    meddela('vidFlyg', { pa: true, vantar: B.halv, k: mjuk(B.sO0, B.sT, s) * (1 - mjuk(B.sT, Math.min(1, B.sT + 0.3), s)) });
  }
  // bytet i dörröppningen: förra rutan tonas bort på 0,3 s medan ljuset, glaset och
  // exponeringen byter läge (inget hårt klipp)
  function flygByt(F, tillInne) {
    // (rutan före bytet är redan kopierad på grafikkortet, se ram: ingen extra rendering här)
    try { fangaOvergang(); tona.tid = 0.4; } catch (e) { console.warn(e); }
    if (tillInne) inneRakt(true, F.vy); else inneRakt(false);
  }
  function stegFlyg(dt) {
    const F = flyg;
    if (!F || F.vantar) return false;
    if (!F.paus) {
      // farten närmar sig riktningen mjukt, så att en vändning mitt i åkningen inte rycker
      let malV = F.rikt > 0 ? 1 / F.bana.tidIn : -1 / F.bana.tidUt;
      // halv bana: farten ebbar ut mot stoppet framför dörren (aldrig ett tvärstopp)
      const tak = F.bana.sTak;
      if (F.rikt > 0 && tak < 1) malV *= mjuk(0, 0.16, tak - F.s);
      F.v += (malV - F.v) * (1 - Math.exp(-dt / 0.085));
      F.s = Math.min(F.rikt > 0 ? tak : 1, Math.max(0, F.s + F.v * dt));
      if (F.s >= tak && tak < 1 && F.v > 0) F.v = 0;
    }
    satsFlyg(F);
    if (!F.paus && ((F.rikt > 0 && F.s >= 1) || (F.rikt < 0 && F.s <= 0))) flygSlut(F.rikt > 0);
    return true;
  }
  // slutläget: exakt samma kamera som inne() och "tillbaka ut" ger utan åkning
  function flygSlut(tillInne) {
    const F = flyg;
    if (!F) return;
    flyg = null;
    styr.enabled = true; aka = null;
    satsYdorr(husGrupp && husGrupp.userData.ydorr, 0);
    if (!F.vantar) {
      if (tillInne) {
        if (!inneLage) inneRakt(true, F.vy);
        if (F.egen && F.bana) {
          // tillbaka till platsen man stod på (en utåkning som vändes): golvet letas upp där
          kamera.position.copy(F.bana.inneP); kamera.quaternion.copy(F.bana.inneQ);
          styr.target.copy(kamera.position).add(flV.set(0, 0, -0.01).applyQuaternion(kamera.quaternion));
          try { avbrytGlid(); } catch (e) { console.warn(e); }
        }
        kamera.fov = fovFor(true);
      } else {
        if (inneLage) inneRakt(false);
        else if (ute) { styr.target.copy(ute.mal); kamera.position.copy(ute.pos); }
        kamera.fov = fovFor(false);
      }
      kamera.updateProjectionMatrix();
    } else if (!tillInne && ute && !inneLage) { styr.target.copy(ute.mal); kamera.position.copy(ute.pos); }
    styrNu();
    meddela('vidFlyg', { pa: false, k: 0 });
    nySkugga = true; begarRender();
    try { F.klar(true); } catch (e) { console.warn(e); }
  }
  // något annat tar över (annat hus, en vinkel, taket, ett rum): åkningen hoppar till ett slutläge
  function flygAvbryt(tillInne) {
    if (flyg) flygSlut(!!tillInne && !flyg.vantar);
  }
  function kanFlyga(pa, vyIndex) {
    // (mitt i monteringen och introt går det också: flygStart gör huset färdigt först; förut blev
    // det i stället det raka bytet, som byggde hela inredningen i trycket, 13 s på mobil)
    if (lugn || FOTO || !husGrupp || oppen.pa || oppen.t > 0 || oppen.vantar || oppen.svav > 0) return false;
    if (!HUS[val.modell].oppningar.some(o => o[5] === 'd' || o[5] === 'dg')) return false;
    if (pa) {
      if (inneLage) return false;
      const vyer = INNE_VYER[val.modell] || [], v = vyer[Math.max(0, Math.min(vyer.length - 1, vyIndex | 0))];
      return !!v && nivaTal(v.niva) === 0 && v.pos[1] < 2.1;
    }
    return inneLage && !!ute && gang.niva === 0 && gang.sitter < 0 && !trappaVid(kamera.position.x, kamera.position.z);
  }
  function flygStart(pa, vyIndex) {
    const hus = husGrupp, F = { rikt: pa ? 1 : -1, s: pa ? 0 : 1, v: 0, vantar: true, paus: false, vy: vyIndex | 0, egen: !pa, bana: null, klar: null, lofte: null };
    F.lofte = new Promise(r => { F.klar = r; });
    flyg = F;
    vakna();
    aka = null; zoomMal = null; zoomRa = null; styr.autoRotate = false; styr.enabled = false;
    const utan = () => {   // ingen bana: samma byte som förut, med toning
      if (flyg !== F) return;
      flyg = null; styr.enabled = true;
      meddela('vidFlyg', { pa: false, k: 0 });
      inneRakt(pa, F.vy, { overgang: 'tona' });
      F.klar(true);
    };
    if (!pa) {
      gang.glid = null; gang.tangent.clear(); gang.vx = gang.vz = gang.vrid = gang.hjul = 0;
      if (spel.pa) spelAv(true);
      satMal(null); gomRing();
      try { F.bana = flygBana(ute.pos, ute.mal, kamera.position, kamera.quaternion, kamera.fov); } catch (e) { console.warn(e); }
      if (!F.bana) { utan(); return F.lofte; }
      F.vantar = false; begarRender();
      return F.lofte;
    }
    // huset monteras färdigt direkt (det gamla huset sjunker inte klart), så att banan utgår från det färdiga huset
    if (byggT < 1) { byggT = 1; satsBygg(1); nySkugga = true; }
    if (rivGrupp) { sluta(rivGrupp); rivGrupp = null; }
    ute = { pos: kamera.position.clone(), mal: styr.target.clone(), min: styr.minDistance, max: styr.maxDistance, pMin: styr.minPolarAngle, pMax: styr.maxPolarAngle, zoom: styr.enableZoom };
    // Hela banan kräver att inredningen är byggd, kompilerad och värmd (varmInne). Är den inte
    // det börjar kameran ändå direkt på bågen mot dörren (halv bana) och stannar mjukt framför
    // den, medan resten byggs i korta bitar; sedan byts banan på samma plats och åkningen går vidare.
    const d = hus.userData, klart = () => !!(d.inne && d.oppenVarm && d.inneVarm);
    const bana = halv => {
      const v = INNE_VYER[val.modell][F.vy], Y0 = d.delar.Y0;
      const ogon = new THREE.Vector3(v.pos[0], v.pos[1] + Y0, v.pos[2]);
      flM.lookAt(ogon, flV.set(v.mal[0], v.mal[1] + Y0, v.mal[2]), UPP);
      const q = new THREE.Quaternion().setFromRotationMatrix(flM);
      const f0 = inneFov; inneFov = Number.isFinite(v.fov) && v.fov > 10 ? v.fov : 0;
      const fi = fovFor(true); inneFov = f0;
      return flygBana(ute.pos, ute.mal, ogon, q, fi, halv);
    };
    const hel = () => {
      if (flyg !== F || husGrupp !== hus) return;
      let ny = null;
      try { inneGrupp(); if (!inneLage) lageLjus(); ytterdorr(); ny = bana(false); } catch (e) { console.warn(e); }
      if (!ny) { utan(); return; }
      // samma plats på den nya banan (sträckan fram till dörren är densamma i båda)
      if (F.bana) F.s = Math.min(0.999, ny.sVid(F.bana.takt(F.s) * F.bana.L / ny.L));
      F.bana = ny; F.vantar = false; begarRender();
    };
    try { F.bana = bana(!klart()); } catch (e) { console.warn(e); }
    if (!F.bana) { utan(); return F.lofte; }
    F.vantar = false; forra = 0;
    if (F.bana.halv) inneSnart(hus, () => { if (flyg === F && husGrupp === hus) varmInne(hus).then(hel, hel); }, () => flyg === F, 9);
    else { try { ytterdorr(); } catch (e) { console.warn(e); } }
    begarRender();
    return F.lofte;
  }
  // Se inne och tillbaka ut. opts.overgang: 'dorr' = åkningen genom ytterdörren (där det går,
  // annars toning), 'tona' = förra bilden tonas bort. Utan opts: direkt (länkar, bildverktyg).
  function inne(pa, vyIndex = 0, opts) {
    pa = !!pa;
    if (pa) planBryt();
    const dorr = !!(opts && opts.overgang === 'dorr');
    if (flyg) {
      const F = flyg;
      if (dorr && !F.vantar && pa !== F.rikt > 0) { F.rikt = pa ? 1 : -1; F.paus = false; vakna(); begarRender(); return F.lofte; }   // vänd mitt i
      if (dorr && pa === F.rikt > 0) return F.lofte;
      flygAvbryt(pa);
      if (pa === inneLage && (!pa || (vyIndex | 0) === F.vy)) return Promise.resolve(true);
    }
    if (dorr && kanFlyga(pa, vyIndex)) return flygStart(pa, vyIndex);
    return inneRakt(pa, vyIndex, dorr ? { overgang: 'tona' } : opts);
  }

  // ---- Kamera-åkningar ----
  // vy(namn) åker dit; vy(namn, { overgang: 'tona' }) lämnar först nuvarande bild till
  // en bild av nuvarande ruta på grafikkortet som tonas bort (fangaOvergang) och åker sedan
  // på 1,0 s, eller hoppar med hopp: true.
  // Ett tal som andra argument tolkas som den gamla farten per ruta.
  let aka = null;
  function akTill(vy, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    planBryt();
    flygAvbryt(false);
    skickaOvergang(o);
    if (inneLage) inne(false);
    // vyerna räknas från husets mitt; har zoomen flyttat målet glider det tillbaka under åkningen
    const mitt = oppen.pa ? styr.target : hem;
    const till = mal(vy, kamera, mitt);
    styr.maxDistance = Math.max(styr.maxDistance, till.distanceTo(mitt) * 1.3);
    styr.autoRotate = false; zoomMal = null; zoomRa = null;
    if (o.hopp) {
      aka = null; styr.target.copy(mitt); kamera.position.copy(till); kamera.fov = fovFor(false); kamera.updateProjectionMatrix();
      styrNu(); begarRender(); return;
    }
    // easeInOutCubic över 1,0 s (1,1 s utan toning), synfältet andas 2 % mitt i åkningen
    let tid = o.tid || (typeof opts === 'number' && opts > 0 ? 1 / (opts * 60) : (o.overgang === 'tona' ? 1.0 : 1.1));
    if (!o.tid && !(typeof opts === 'number' && opts > 0)) {
      // längre åkning ju större vinkel (Söder ↔ Norr är 180°, inte lika snabbt som ett kvarts varv)
      const fA = new THREE.Spherical().setFromVector3(kamera.position.clone().sub(mitt)), fB = new THREE.Spherical().setFromVector3(till.clone().sub(mitt));
      let vd = Math.abs(fB.theta - fA.theta); if (vd > Math.PI) vd = Math.PI * 2 - vd;
      tid = Math.max(tid * 0.8, 0.8 + 0.5 * vd / Math.PI);
    }
    aka = { fran: kamera.position.clone(), till, t: 0, tid };
    if (styr.target.distanceToSquared(mitt) > 1e-6) { aka.mf = styr.target.clone(); aka.mt = mitt.clone(); }
    begarRender();
  }

  // Mjuk zoom med hjulet: målavståndet ändras direkt, kameran glider dit.
  // Zoomen går mot punkten under pekaren. Vid gränserna tar det mjukt emot (högst 12 %
  // förbi, allt trögare) och när hjulet släpps glider avståndet tillbaka innanför.
  let zoomMal = null, zoomRa = null, zoomTid = 0;
  const zoom = { cx: 0, cy: 0, nx: 0, ny: 0, mot: false, las: false };
  const zD = new THREE.Vector3(), zP = new THREE.Vector3(), zT = new THREE.Vector3();
  function mjukGrans(x, lo, hi) {
    if (x < lo) return lo * (1 - 0.12 * (1 - Math.exp(-3 * Math.log(lo / x))));
    if (x > hi) return hi * (1 + 0.12 * (1 - Math.exp(-3 * Math.log(x / hi))));
    return x;
  }
  function zoomTillbaka() {
    zoomRa = null;
    const lo = styr.minDistance, hi = styr.maxDistance;
    const r = zoomMal !== null ? zoomMal : kamera.position.distanceTo(styr.target);
    if (r < lo || r > hi) { zoomMal = Math.min(hi, Math.max(lo, r)); zoom.mot = false; begarRender(); }
  }
  duk.addEventListener('wheel', e => {
    if (inneLage || !styr.enabled || !styr.enableZoom) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (aka) { aka = null; kamera.fov = fovFor(false); kamera.updateProjectionMatrix(); }
    styr.autoRotate = false;
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const lo = styr.minDistance, hi = styr.maxDistance;
    if (zoomRa === null) zoomRa = Math.log(zoomMal !== null ? zoomMal : kamera.position.distanceTo(styr.target));
    zoomRa = Math.min(Math.log(hi) + 0.6, Math.max(Math.log(lo) - 0.6, zoomRa + Math.max(-300, Math.min(300, dy)) * 0.0019 * styr.zoomSpeed));
    zoomMal = mjukGrans(Math.exp(zoomRa), lo, hi);
    // bara klientkoordinaterna; omräkningen till bildens koordinater görs i ramen
    zoom.cx = e.clientX; zoom.cy = e.clientY; zoom.mot = true; zoom.las = true;
    clearTimeout(zoomTid); zoomTid = setTimeout(zoomTillbaka, 170);
    begarRender();
  }, { capture: true, passive: false });

  // ---- Rendera bara när något rör sig ----
  let ramId = 0, aktiv = true, dukSyns = true, flikSyns = !document.hidden, byggT = 1, rivT = 1, rivGrupp = null;
  // ritKlar: programmen är kompilerade, rutor får ritas. vantaStart: första bilden står still
  // (huset omonterat, kameran i introts början) tills sidan öppnar slöjan och anropar starta().
  let ritKlar = false, vantaStart = false, forstaRuta = null;
  const rorSkarpa = { lag: false, full: 1 };
  const lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const del = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const utC = x => 1 - (1 - x) ** 3;
  const utBak = x => { const c = 1.25; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
  const inUt = x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
  // Monteringen: sockeln gjuts, väggmodulerna reser sig ur marken och taket läggs på
  function satsBygg(t) {
    const d = husGrupp.userData.delar, H = husGrupp.userData.hojd;
    const s = Math.max(0.001, utC(del(t, 0, 0.2)));
    d.so.scale.y = s; d.so.position.y = d.Y0 * s / 2;
    d.vaggar.position.y = d.Y0 - (H + 0.3) * (1 - utC(del(t, 0.1, 0.6)));
    const tk = del(t, 0.52, 1);
    d.tak.position.y = d.Y0 + 2.6 * (1 - utBak(tk));
    d.tak.visible = tk > 0 && oppen.t < 1;
    if (d.ute) d.ute.visible = t > 0.12;
  }
  // En enda rAF åt gången (iRam/ramId). behov = någon har bett om en ny bild.
  let iRam = false, behov = false, pekRay = false, rorForra = false;
  function schema() { if (iRam || ramId || !aktiv) return; ramId = requestAnimationFrame(ram); }
  function begarRender() { behov = true; schema(); }
  let forra = 0;

  // ---- Liv: vind, moln, fåglar och snö från miljön, högst 30 bilder/s ----
  // Slingan går bara när liv är på, miljön har liv och duken och fliken syns.
  // Rutor emellan hoppas över (ingen rendering) men slingan står kvar. Skuggkartan
  // räknas aldrig om för livets skull. Blir rutorna för långsamma (snitt över 40 ms
  // i 2 s) går livet ned till 15 bilder/s, och sedan av (alternativ.vidLiv(false)).
  // Utan inmatning (pekare, tangent, hjul över scenen, lägesbyte) i 20 s går livet ned till
  // 10 bilder/s och efter 60 s står det still; nästa inmatning (vakna) väcker det igen.
  const liv = { pa: !lugn && !FOTO, fps: 30, klocka: 0, sist: 0, snitt: 0, langsamFran: 0, anrop: 0, ritade: false, inmat: performance.now() };
  const LIV_LANGSAM = 20000, LIV_VILA = 60000;
  const miljoHarLiv = () => { try { return typeof omgivning.tick === 'function' && typeof omgivning.harLiv === 'function' && !!omgivning.harLiv(); } catch (e) { return false; } };
  const livKor = () => liv.pa && aktiv && miljoHarLiv() && performance.now() - liv.inmat < LIV_VILA;
  const livFps = nu => (nu - liv.inmat > LIV_LANGSAM ? Math.min(10, liv.fps) : liv.fps);
  function vakna() {
    const vilade = performance.now() - liv.inmat > LIV_LANGSAM;
    liv.inmat = performance.now();
    if (vilade) begarRender();
  }
  // Skivornas och ringens tid: går när pekaren är över duken (och rört sig de senaste 20 s)
  // eller i 3 s efter att man kommit in; sedan en långsam puls bara medan livet går. Annars
  // fryses tiden på en fin ruta (0,8 s). Minskad rörelse: tiden står alltid still.
  const punktAnim = { tid: 0.8, hovTid: 0.8, sist: 0, till: 0, hovK: 1, fryst: true, sistRit: 0 };
  function punktFart(nu) {
    if (!inneLage || lugn || !aktiv || !husGrupp) return 0;
    if ((gang.pekar && nu - liv.inmat < LIV_LANGSAM) || nu < punktAnim.till) return 1;
    return livKor() ? 0.5 : 0;
  }
  function stegPunktAnim(nu, fart) {
    if (fart > 0) {
      const d = punktAnim.sist ? Math.min(0.1, (nu - punktAnim.sist) / 1000) : 0;
      punktAnim.tid += d * fart; punktAnim.hovTid += d * fart * 1.6;
      punktAnim.sist = nu; punktAnim.fryst = false;
    } else if (!punktAnim.fryst) { punktAnim.fryst = true; punktAnim.tid = punktAnim.hovTid = 0.8; punktAnim.sist = 0; }
    ANIM.uTid.value = punktAnim.tid; PUNKT_MAT.uniforms.uHovTid.value = punktAnim.hovTid;
  }
  ANIM.uRorlig.value = lugn ? 0 : 1;
  function satLiv(pa) {
    liv.pa = !!pa; liv.fps = 30; liv.snitt = 0; liv.langsamFran = 0; liv.inmat = performance.now();
    if (typeof omgivning.satLiv === 'function') { try { omgivning.satLiv(liv.pa); } catch (e) { console.warn(e); } }
    begarRender();
    return liv.pa;
  }
  function matLiv(nu) {
    // tiden från en ritad ruta till nästa anrop = vad rutan kostade
    if (liv.anrop && liv.ritade) {
      const d = nu - liv.anrop;
      if (d < 300) {
        liv.snitt = liv.snitt ? liv.snitt + (d - liv.snitt) * 0.08 : d;
        if (liv.snitt > 40) {
          if (!liv.langsamFran) liv.langsamFran = nu;
          else if (nu - liv.langsamFran > 2000) {
            liv.langsamFran = 0; liv.snitt = 0;
            if (liv.fps > 15) liv.fps = 15;
            else {
              satLiv(false);
              if (typeof alternativ.vidLiv === 'function') { try { alternativ.vidLiv(false); } catch (e) { console.warn(e); } }
            }
          }
        } else liv.langsamFran = 0;
      }
    }
    liv.anrop = nu;
  }
  const sA = new THREE.Spherical(), sB = new THREE.Spherical(), sC = new THREE.Spherical(), v1 = new THREE.Vector3();
  // Rutornas kostnad för ?prestanda=1: bilder/s, ms per ruta (processorn), ritanrop och trianglar
  const perf = { rutor: 0, ms: 0, msMaxNu: 0, intervall: 0, sistRuta: 0, anrop: 0, tri: 0, skuggAnrop: 0, tummeAnrop: 0 };
  // Går rörelserna under 25 bilder/s (snitt över 45 rutor i följd) sänks kvaliteten ett steg:
  // 1. pixeltätheten till 1, 2. skuggkartan till 1024 och tätheten till 0,85, 3. tätheten 0,7.
  // Den höjs aldrig igen under besöket (inget pendlande). Inte i fotoläget eller i en
  // fjärrstyrd webbläsare utan skärm (bildverktygen ska ge samma skärpa varje gång).
  const kval = { pa: !FOTO && alternativ.anpassa !== false && !/Headless/i.test(navigator.userAgent || ''), steg: 0, sum: 0, n: 0, ror: false };
  function sankKvalitet() {
    const pr = renderer.getPixelRatio();
    kval.steg++;
    // skärpan går aldrig under 1 (lägre gav suddig bild): först skuggkartan, sedan tätheten i två steg
    if (kval.steg === 1) {
      sol.shadow.mapSize.set(1024, 1024);
      if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
      nySkugga = true;
      if (pr <= 1) kval.pa = false;
    } else if (kval.steg === 2) { renderer.setPixelRatio(Math.max(1, Math.min(pr, 1.5))); if (pr <= 1.5) kval.pa = false; }
    else { renderer.setPixelRatio(Math.max(1, Math.min(pr, 1.25))); kval.pa = false; }
    storlek();
  }
  // Vinkelbilder som väntar på att ritas: högst en per ruta, före huvudbilden i samma ruta
  const tummeKo = [];
  const tummeKlar = () => !aka && !flyg && byggT >= 1 && !rivGrupp && !(oppen.t > 0 && oppen.t < 1) && !oppen.vantar && !(oppen.svav > 0) && !oppen.skarv;   // somUte lägger på taket; bara mitt i lyftet väntar de
  function nasta() { if (!ramId && aktiv) ramId = requestAnimationFrame(ram); }
  function ram(nu) {
    ramId = 0;
    if (!ritKlar) return;   // scenens program kompileras ännu; första rutan begärs när de är klara
    // grafiken tappad (telefonen tog minnet): inget ritas förrän den är tillbaka (sidan laddar om)
    if (renderer.getContext().isContextLost()) return;
    iRam = true;   // allt som begär en ruta under rutan hamnar i den här (ingen extra rAF)
    nu = nu || performance.now();
    const t0 = performance.now();
    const livNu = livKor() && !vantaStart;
    if (livNu) matLiv(nu); else liv.anrop = 0;
    if (pekRay) { pekRay = false; if (inneLage ? pekaGolv() : pekaUte()) behov = true; }
    const livDags = livNu && nu - liv.sist >= 1000 / livFps(nu) - 4;
    const pFart = punktFart(nu), pDags = pFart === 1 && nu - punktAnim.sistRit >= 33 - 4;
    if (!pFart && !punktAnim.fryst) behov = true;   // en sista ruta med den frysta tiden
    if (!behov && !rorForra && !livDags && !pDags && !tummeKo.length && !varmJobb) {
      // inget att rita: livet (eller skivornas puls) väntar på sin nästa ruta, annars står allt still
      liv.ritade = false;
      iRam = false;
      if (livNu || pFart === 1) nasta();
      else { forra = 0; liv.anrop = 0; liv.sist = 0; if (flytt.smuts) skickaFlytt(nu); }
      return;
    }
    behov = false;
    // tiden sedan förra rutan, så att rörelserna tar lika lång tid på alla datorer
    const dt = vantaStart ? 0 : Math.min(0.12, forra ? (nu - forra) / 1000 : 1 / 60);   // före starta(): bilden står still
    forra = nu;
    const f = dt * 60;
    if (aka) {
      aka.t = Math.min(1, aka.t + dt / aka.tid);
      const e = inUt(aka.t);
      // åk i en båge runt huset i stället för rakt igenom det
      sA.setFromVector3(v1.copy(aka.fran).sub(aka.mf || styr.target));
      sB.setFromVector3(v1.copy(aka.till).sub(aka.mt || styr.target));
      if (aka.mf) styr.target.lerpVectors(aka.mf, aka.mt, e);
      let dth = sB.theta - sA.theta; if (dth > Math.PI) dth -= Math.PI * 2; if (dth < -Math.PI) dth += Math.PI * 2;
      // vid stora vinklar lyfts kameran lite mitt i åkningen (går över hörnet, inte förbi väggen)
      sC.set(sA.radius + (sB.radius - sA.radius) * e, Math.max(0.05, sA.phi + (sB.phi - sA.phi) * e - 0.08 * Math.sin(Math.PI * e) * Math.abs(dth) / Math.PI), sA.theta + dth * e);
      kamera.position.setFromSpherical(sC).add(styr.target);
      // kameran "andas": synfältet vidgas 2 % mitt i åkningen och är tillbaka när den landar
      kamera.fov = fovFor(false) * (1 + 0.02 * Math.sin(Math.PI * e));
      if (aka.t >= 1) { aka = null; kamera.fov = fovFor(false); }
      kamera.updateProjectionMatrix();
    }
    let zoomar = false;
    if (zoomMal !== null) {
      v1.copy(kamera.position).sub(styr.target);
      const r = v1.length();
      let nyR = r + (zoomMal - r) * (1 - Math.pow(0.84, f));
      if (Math.abs(zoomMal - nyR) < 0.002 * r) { nyR = zoomMal; zoomMal = null; } else zoomar = true;
      const s = nyR / r;
      if (s < 1 && zoom.mot && !oppen.pa && oppen.t === 0 && !aka) {
        // in mot pekaren: punkten under pekaren står still, kamera och mål skalas runt den
        if (zoom.las) { if (rektSmuts) lasRekt(); zoom.nx = (zoom.cx - dukV) / dukB * 2 - 1; zoom.ny = -((zoom.cy - dukT) / dukH) * 2 + 1; zoom.las = false; }
        zD.set(zoom.nx, zoom.ny, 0.5).unproject(kamera).sub(kamera.position).normalize();
        const cos = -zD.dot(v1) / r;
        if (cos > 0.25) {
          zP.copy(kamera.position).addScaledVector(zD, r / cos);
          zT.copy(styr.target).lerp(zP, 1 - s).sub(hem);
          // målet stannar nära huset (pan finns inte, så det måste kunna komma tillbaka)
          if (zT.lengthSq() > hemR * hemR) zT.setLength(hemR);
          zT.add(hem); zT.y = Math.min(hemTopp, Math.max(0.3, zT.y));
          styr.target.copy(zT);
        }
      } else if (s > 1 && !oppen.pa && oppen.t === 0 && !aka) {
        // ut: målet glider tillbaka mot husets mitt
        styr.target.lerp(hem, Math.min(1, (s - 1) * 2.5));
      }
      kamera.position.copy(styr.target).addScaledVector(v1, s);
    }
    if (rivGrupp) {
      rivT = Math.min(1, rivT + dt / 0.35);
      rivGrupp.position.y = -(rivGrupp.userData.hojd + 0.6) * rivT ** 2;
      if (rivT >= 1) { sluta(rivGrupp); rivGrupp = null; }
    }
    if (byggT < 1) {
      byggT = Math.min(1, byggT + dt / 1.6);
      satsBygg(Math.max(0, byggT));
    }
    // dockskåpet: taket lyfts på 1,15 s och sänks på 1,0 s (lyftKurva), snittet glider vid
    // byte av våning; medan inredningen byggs färdigt svävar taket (svav)
    let lyfter = false;
    if (!lugn && (oppen.vantar || oppen.svav > 0)) {   // minskad rörelse: inget sväv (knappen visar laddningen)
      oppen.svavT += dt;
      oppen.svav = oppen.vantar ? Math.min(1, oppen.svav + dt / 0.35) : Math.max(0, oppen.svav - dt / 0.3);
      lyfter = true;
      if (!(oppen.pa ? oppen.t < 1 : oppen.t > 0)) { satsOppen(); if ((perf.rutor & 1) === 0 || oppen.svav === 0) nySkugga = true; }
    }
    if ((oppen.pa ? oppen.t < 1 : oppen.t > 0) || oppen.skarv) {
      if (typeof oppen.prov === 'number') oppen.t = oppen.pa ? Math.min(0.999, Math.max(oppen.prov, 0.001)) : Math.max(0.001, Math.min(oppen.prov, 0.999));   // bildverktygen: lyftet fryst (takProv)
      else oppen.t = Math.min(1, Math.max(0, oppen.t + (oppen.pa ? dt / LYFT_UPP : -dt / LYFT_NED)));
      if (oppen.skarv) oppen.skarv.k = Math.max(0, oppen.skarv.k - dt / 0.3);
      satsOppen(); lyfter = true;
      // skuggan följer taket under lyftet (varannan ruta) i stället för att hoppa vid slutet
      if (oppen.t === 0 || oppen.t === 1 || (perf.rutor & 1) === 0) nySkugga = true;
    } else if (oppen.t > 0 && Math.abs(oppen.snittNu - oppen.snittMal) > 0.003) {
      oppen.snittNu += (oppen.snittMal - oppen.snittNu) * (1 - Math.pow(0.002, dt)); lyfter = true;
      if (Math.abs(oppen.snittNu - oppen.snittMal) <= 0.003) { oppen.snittNu = oppen.snittMal; nySkugga = true; }
      satsOppen();
    }
    // åkningen genom ytterdörren styr kameran själv (ingen gång, ingen OrbitControls under tiden)
    const flyger = flyg ? stegFlyg(dt) : false;
    // Skärpan under rörelse (avstängd): att byta pixeltäthet gör om bildbufferten (setSize), och
    // det gav ett stopp precis när åkningen började och slutade (uppmätt 4,4 s i mobilemulering).
    // Skärpan står därför still; kvar finns bara återställningen om den någon gång sänkts.
    const villLag = false;
    if (villLag && !rorSkarpa.lag) {
      rorSkarpa.lag = true; rorSkarpa.full = renderer.getPixelRatio();
      if (rorSkarpa.full > 1.3) { renderer.setPixelRatio(1.25); storlek(); }
    } else if (!villLag && rorSkarpa.lag && !tona.pa) {
      rorSkarpa.lag = false;
      if (renderer.getPixelRatio() < rorSkarpa.full) { renderer.setPixelRatio(rorSkarpa.full); storlek(); }
    }
    const planRor = stegPlan(dt);   // planlösningen: kameran upp till lodrät vy och tillbaka
    const gar = inneLage && !flyg && stegGang(dt);
    const ljusRor = stegLjus(dt);
    stegPunktAnim(nu, pFart); if (pFart === 1) punktAnim.sistRit = nu;
    const iaRor = stegIa(dt);
    const ringRor = inneLage && stegRing(dt);
    if (!inneLage && husGrupp && husGrupp.userData.inne) {
      // inredningen syns utifrån inom 30 m (släpps vid 32 m), så att man ser in genom fönstren
      const langt = kamera.position.lengthSq() > (inneLangt ? 30 * 30 : 32 * 32);  // syns genom fönstren från normal vy
      if (langt !== inneLangt) { inneLangt = langt; lageLjus(); }
      // dörrarna inne syns utifrån bara inom 14 m
      else if ((kamera.position.lengthSq() < UTE_NARA2) !== !!ia.nara) iaSynlighet();
    }
    const tonade = tonaFarger(f);
    mat.bagYtter.color.copy(inneLage ? mat.bagInsida.color : mat.detalj.color);
    // dämpningen räknas per sekund; utanför huset får avståndet gå lite förbi gränserna
    // (gummibandet), zoomTillbaka() för det sedan mjukt innanför igen
    styr.dampingFactor = 1 - Math.pow(1 - (inneLage ? DEMP_INNE : DEMP_UTE), f);
    const mn = styr.minDistance, mx = styr.maxDistance;
    if (!inneLage) { styr.minDistance = mn * 0.86; styr.maxDistance = mx * 1.14; }
    styrIRam = true;
    const rorde = flyger ? false : styr.update(dt);
    // Spelläget: det som är mitt i bilden, när kameran eller delarna rört sig
    // (högst tio gånger per sekund; en skuld ritas ikapp i en senare ruta)
    if (spel.pa && inneLage && (gar || rorde || iaRor || spel.smuts || spel.skuld)) {
      if (nu - spel.siktT >= 100) { spel.smuts = false; spel.skuld = false; spel.siktT = nu; satMal(siktMal()); }
      else spel.skuld = true;
    } else if (!spel.pa) spel.skuld = false;
    styrIRam = false;
    styr.minDistance = mn; styr.maxDistance = mx;
    if (livNu) {
      liv.klocka += liv.sist ? Math.min(0.1, (nu - liv.sist) / 1000) : 0;
      liv.sist = nu;
      try { omgivning.tick(liv.klocka); } catch (e) { console.warn(e); liv.pa = false; }
      // ljusens fladder: bara uniformer, bara när livet går och glorian syns
      const h = husGrupp && husGrupp.userData.halo;
      if (h && h.visible) {
        HALO_MAT.uniforms.uTid.value = liv.klocka;
        if (inneLage && rumLjus.l2 > 0) inneLjus2.intensity = rumLjus.l2 * (1 + 0.05 * Math.sin(liv.klocka * 9.3) + 0.03 * Math.sin(liv.klocka * 23.1));
      }
    }
    if (inneLage) skalaPunkter(false);
    renderer.info.reset();
    // vinkelbilderna väntar tills dörrar och lampor rört sig klart (rutorna går ändå)
    // värmningen av inneläget: en bit per ruta, före den vanliga bilden
    const varmKor = varmJobb ? stegVarm() : false;
    if (tummeKo.length && !iaRor && !iaRorSig()) {
      const jobb = tummeKo.shift();
      if (tummeKlar()) { try { ritaTumme(jobb.vy, jobb.duk); jobb.klar(true); } catch (e) { console.warn(e); jobb.klar(false); } }
      else jobb.klar(false);
      perf.tummeAnrop = renderer.info.render.calls; renderer.info.reset();
    }
    if (nySkugga || byggT < 1 || rivGrupp) { renderer.shadowMap.needsUpdate = true; nySkugga = false; }
    // Yttertaket (lager 1) ritas inte inifrån, men skuggpasset testar lagren mot huvudkameran:
    // i en ruta där skuggkartan räknas om är taket med (det syns ändå inte bakom innertaket)
    const skuggRuta = renderer.shadowMap.needsUpdate;
    kamera.layers.mask = !inneLage || skuggRuta ? 3 : 1;
    renderer.render(scene, kamera);
    if (plan.t > 0) planRita();   // planlösningens ritning följer kameran (HTML/SVG ovanpå)
    // räknarna direkt efter huvudbilden; rutor med skuggpass (och vinkelbilderna) räknas för sig
    if (skuggRuta) perf.skuggAnrop = renderer.info.render.calls;
    else { perf.anrop = renderer.info.render.calls; perf.tri = renderer.info.render.triangles; }
    // förra bilden tonas bort ovanpå (0,5 s)
    let tonaKor = false;
    if (tona.pa) {
      tona.t = Math.min(1, tona.t + dt / tona.tid);
      ritaTona();
      if (tona.t >= 1) { tona.pa = false; tona.tid = 0.5; } else tonaKor = true;
    }
    if (inneLage && (gar || rorde)) flytt.smuts = true;
    const rorSig = rorde || flyger || planRor || aka || zoomar ||styr.autoRotate || tonade || byggT < 1 || rivGrupp || lyfter || gar || tonaKor || ringRor || iaRor || ljusRor || spel.skuld;
    rorForra = !!rorSig;
    liv.ritade = true;
    const fortsatt = !!(rorSig || varmKor || livKor() || punktFart(nu) === 1 || tummeKo.length) && aktiv && !vantaStart;
    if (forstaRuta) { const klar = forstaRuta; forstaRuta = null; marke('rit-forsta-bild'); klar(true); }
    // sista rutan före stillastående sparas på grafikkortet till nästa övergång
    // (och rutan just före bytet ute/inne i dörröppningen, så att bytet inte behöver rita om den)
    const snartByte = flyg && flyg.bana && !flyg.vantar && Math.abs(flyg.s - flyg.bana.sT) < 0.05 && (flyg.s < flyg.bana.sT) === (flyg.v > 0);
    if ((!fortsatt && !lugn) || snartByte) kopieraRuta(); else tona.farsk = false;
    // mätning (inga objekt skapas)
    const ms = performance.now() - t0;
    perf.ms = perf.ms ? perf.ms + (ms - perf.ms) * 0.1 : ms;
    if (ms > perf.msMaxNu) perf.msMaxNu = ms;
    if (perf.sistRuta && nu - perf.sistRuta < 250) perf.intervall = perf.intervall ? perf.intervall + (nu - perf.sistRuta - perf.intervall) * 0.1 : nu - perf.sistRuta;
    // anpassning: tiden mellan rutorna medan något rör sig (kval.ror = förra rutan rörde sig också)
    if (kval.pa && !rorSkarpa.lag) {
      if (kval.ror && perf.sistRuta && nu - perf.sistRuta < 250) { kval.sum += nu - perf.sistRuta; kval.n++; }
      kval.ror = !!rorSig && fortsatt;
      if (kval.n >= 45) { const snitt = kval.sum / kval.n; kval.sum = 0; kval.n = 0; if (snitt > 40) sankKvalitet(); }
    }
    perf.sistRuta = nu; perf.rutor++;
    behov = false;   // det som begärdes under rutan är redan med i bilden
    iRam = false;
    if (fortsatt) nasta();
    else { forra = 0; liv.anrop = 0; liv.sist = 0; }
    // efter rutan: det som skickas här får begära nya rutor igen
    if (flytt.smuts && (!fortsatt || nu - flytt.sist >= 100)) skickaFlytt(nu);
  }
  styr.addEventListener('change', begarRender);
  styr.addEventListener('start', () => {
    styr.autoRotate = false; zoomMal = null; zoomRa = null;
    if (aka) { aka = null; kamera.fov = fovFor(inneLage); kamera.updateProjectionMatrix(); }
  });
  // nypzoom kan ha gått förbi gränsen: glid tillbaka när fingrarna släpper
  styr.addEventListener('end', () => { if (!inneLage) zoomTillbaka(); });

  function storlek() {
    const r = duk.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    renderer.getDrawingBufferSize(haloStorlek); HALO_MAT.uniforms.uH.value = haloStorlek.y;
    dukB = r.width; dukH = r.height; dukV = r.left; dukT = r.top; rektSmuts = false;
    kamera.aspect = r.width / r.height;
    kamera.fov = plan.fov || fovFor(inneLage);
    kamera.updateProjectionMatrix();
    // planlösningen passas in på nytt i den nya bildstorleken
    if (plan.pa && plan.B) { const B = planTopp(); if (B.theta !== plan.B.theta) B.theta = plan.B.theta; plan.B = B; if (plan.t >= 1) planKam(1); }
    tona.farsk = false;
    begarRender();
  }
  new ResizeObserver(storlek).observe(duk);
  // pausa när duken inte syns
  new IntersectionObserver(e => { dukSyns = e[e.length - 1].isIntersecting; aktiv = dukSyns && flikSyns; if (aktiv) begarRender(); }).observe(duk);
  document.addEventListener('visibilitychange', () => { flikSyns = !document.hidden; aktiv = dukSyns && flikSyns; if (aktiv) begarRender(); });
  // miljön har laddat något i efterhand (elbilen, husritare-bil.js): ny bild och ny skugga
  window.addEventListener('husritare:nytt', () => { renderer.shadowMap.needsUpdate = true; begarRender(); });
  if (typeof omgivning.satLiv === 'function') { try { omgivning.satLiv(liv.pa); } catch (e) { console.warn(e); } }

  marke('rit-ytor');
  await paus();
  visa(alternativ.modell || val.modell, alternativ.montera !== false);
  storlek();
  placeraKamera();
  marke('rit-scen');
  // Första bilden: i fotoläget direkt, som förut. Annars kompileras scenens program först
  // utan att låsa sidan (kompKlipp: några objekt i taget, sedan väntan på grafikkortet, och
  // texturerna laddas upp i små bitar), och första rutan ritas därefter. Med intro står den
  // rutan still tills sidan anropar starta().
  vantaStart = !FOTO && !lugn && alternativ.montera !== false;
  const redo = new Promise(r => { forstaRuta = r; });
  if (FOTO) ritKlar = true;
  else {
    (async () => {
      await paus();
      // bara det som syns i första bilden (och hela huset, vars tak och trappor monteras strax):
      // allt annat i scenen kompileras i vila efteråt. Förut väntade första bilden på alla
      // program, också för sådant som inte visas förrän senare.
      const synliga = [];
      scene.traverseVisible(o => { if (o.isMesh || o.isLine || o.isPoints) synliga.push(o); });
      try { await Promise.race([kompKlipp([husGrupp, { traverse: f => synliga.forEach(f) }], null), new Promise(r => setTimeout(r, 6000))]); } catch (e) { console.warn(e); }
      marke('rit-kompilerat');
      ritKlar = true; begarRender();
      setTimeout(() => ledigt(() => { try { kompKlipp([scene], null, 6); } catch (e) { console.warn(e); } }, 2000), 6000);
    })();
    // utan starta() från sidan börjar introt ändå efter en stund
    setTimeout(() => starta(), 25000);
  }
  function starta() {
    if (!vantaStart) return;
    vantaStart = false; forra = 0; marke('rit-start');
    clearTimeout(snurrTid); snurrTid = setTimeout(() => { styr.autoRotate = false; }, 7000);
    begarRender();
  }
  // Introt: kameran svävar in från högt och långt bort medan huset monteras
  if (!lugn && alternativ.montera !== false) {
    const slut = kamera.position.clone();
    // (från ovanför trädtopparna: startvyn står lågt, och en start långt ut i samma höjd hamnade inne i skogen)
    kamera.position.copy(slut.clone().sub(styr.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.45).multiplyScalar(1.35).add(new THREE.Vector3(0, 11, 0)).add(styr.target));
    aka = { fran: kamera.position.clone(), till: slut, t: 0, tid: 2.1 };
    begarRender();
  }

  // Tumnaglar ritas alltid som utsidan, även om man just står inne i huset.
  // rita = false: huvudbilden ritas ändå direkt efter (i ram), så den hoppas över här.
  function somUte(fn, rita = true) {
    const varInne = inneLage, synligt = matGrupp.visible, varOppen = oppen.pa, oT = oppen.t;
    matGrupp.visible = false;
    if (varInne) { inneLage = false; lageLjus(); }
    if (oT > 0 || varOppen) { oppen.pa = false; oppen.t = 0; satsOppen(); }
    const kam = tummeKam.copy(kamera); kam.fov = fovFor(false); kam.updateProjectionMatrix(); kam.layers.mask = 3;
    if (varInne) iaSynlighet();
    const mitt = varInne && ute ? ute.mal : (varOppen || oT > 0) && oppen.fore ? oppen.fore.mal : hem;
    try { return fn(kam, mitt); } finally {
      if (oT > 0 || varOppen) { oppen.pa = varOppen; oppen.t = oT; satsOppen(); }
      if (varInne) { inneLage = true; lageLjus(); }
      kamera.layers.mask = inneLage ? 1 : 3;
      matGrupp.visible = synligt;
      if (rita) renderer.render(scene, kamera);
    }
  }
  // En vinkel ritas i ett litet hörn av duken (setViewport/scissor, inga nya buffertar)
  // och kopieras med drawImage till målduken. Ingen JPEG och ingen avkodning.
  const tummeKam = new THREE.PerspectiveCamera();
  const bufStorlek = new THREE.Vector2();
  function ritaTumme(vy, mal2d, rita = false) {
    return somUte((kam, mitt) => {
      const pr = renderer.getPixelRatio();
      renderer.getDrawingBufferSize(bufStorlek);
      let w = mal2d.width, h = mal2d.height;
      const k = Math.min(1, bufStorlek.x / w, bufStorlek.y / h);
      w = Math.max(2, Math.floor(w * k)); h = Math.max(2, Math.floor(h * k));
      const vw = w / pr, vh = h / pr;
      const pw = Math.floor(vw * pr), ph = Math.floor(vh * pr);
      kam.aspect = mal2d.width / mal2d.height; kam.updateProjectionMatrix();
      kam.position.copy(mal(vy, kam, mitt)); kam.lookAt(mitt); kam.updateMatrixWorld();
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, vw, vh); renderer.setScissor(0, 0, vw, vh);
      try { renderer.render(scene, kam); } finally {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, dukB, dukH); renderer.setScissor(0, 0, dukB, dukH);
      }
      // WebGL räknar nerifrån: hörnet ligger längst ned i bufferten
      const x = mal2d.getContext('2d');
      x.drawImage(renderer.domElement, 0, bufStorlek.y - ph, pw, ph, 0, 0, mal2d.width, mal2d.height);
      return mal2d;
    }, rita);
  }
  // autorotationen i början stängs av efter 7 s, utom om man själv slagit på den
  let snurrTid = setTimeout(() => { styr.autoRotate = false; }, 7000);

  return {
    // redo: löfte som blir klart när första bilden är ritad; starta(): introt börjar (slöjan öppnas)
    redo, starta,
    visa,
    satt(nyckel, varde) {
      val[nyckel] = varde;
      if (nyckel === 'tid') { cancelAnimationFrame(presetId); presetId = 0; satSol(); }
      else if (nyckel === 'matt') { matGrupp.visible = !!varde && !inneLage; begarRender(); }
      else satFarger();
    },
    // Ljusets snabbval: ljusPreset('morgon' | 'dag' | 'gyllene' | 'kvall'), även 'Morgon',
    // 'Gyllene timmen', 'Kväll'. Tiden glider dit på 1,4 s (direkt med reducerad rörelse),
    // lamporna man själv rört följer tiden igen. alternativ.vidTid(t) får varje steg, så att
    // sidan kan flytta reglaget. Ger ett löfte med sluttiden (false för okänt namn).
    ljusPreset(namn) {
      const n = String(namn || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const nyckel = Object.keys(LJUS_PRESET).find(k => n.startsWith(k));
      if (!nyckel) return Promise.resolve(false);
      const till = LJUS_PRESET[nyckel], fran = val.tid, T = lugn ? 0 : 1400, t0 = performance.now();
      cancelAnimationFrame(presetId);
      delete lampMinne[val.modell];
      return new Promise(klar => {
        const steg = nu => {
          const k = T ? Math.min(1, (nu - t0) / T) : 1, e = k * k * (3 - 2 * k);
          val.tid = fran + (till - fran) * e;
          satSol(); meddela('vidTid', val.tid);
          if (k < 1) presetId = requestAnimationFrame(steg);
          else { presetId = 0; klar(till); }
        };
        steg(t0);
      });
    },
    ljusPresets: () => ({ ...LJUS_PRESET }),
    vy: akTill,
    // övergången till nästa byte: förra bilden tonas bort på grafikkortet
    tona: fangaOvergang,
    val: () => ({ ...val, modell: val.modell }),
    standardfarg: id => HUS[id].farg,
    // Vinkelbild direkt i en <canvas> (2D). Ritas i nästa ruta, en per ruta; löftet
    // ger true när bilden finns, false om den fick vänta (åkning, montering, dockskåp).
    tummeDuk(vy, duk2d) {
      return new Promise(klar => { tummeKo.push({ vy, duk: duk2d, klar }); begarRender(); });
    },
    // Som data-URL (för Spara, som lägger bilden i localStorage): liten rendering, liten JPEG
    tumme(vy, w = 240) {
      const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w / (16 / 9.4));
      slutforIa();
      ritaTumme(vy, c, true);
      return c.toDataURL('image/jpeg', 0.8);
    },
    tummar(vyer, w = 240) {
      const ut = {};
      vyer.forEach(vy => { ut[vy] = this.tumme(vy, w); });
      return ut;
    },
    // nuvarande bild i en <canvas> i 1×, t.ex. sammanfattningen (ingen kodning)
    bildTill(duk2d) {
      renderer.getDrawingBufferSize(bufStorlek);
      if (duk2d.width !== bufStorlek.x || duk2d.height !== bufStorlek.y) { duk2d.width = bufStorlek.x; duk2d.height = bufStorlek.y; }
      renderer.render(scene, kamera);
      duk2d.getContext('2d').drawImage(renderer.domElement, 0, 0);
      tona.farsk = false;
      kopieraRuta();
      return duk2d;
    },
    tema(mork) { morktTema = !!mork; satSol(); },
    snurra(pa) { clearTimeout(snurrTid); styr.autoRotate = !!pa; begarRender(); return styr.autoRotate; },
    upptagen: () => tonar || byggT < 1 || !!rivGrupp || !!aka || !!flyg || tona.pa,
    // allt byggt och stilla: inredningen klar, inga åkningar eller toningar, ingen ruta på väg
    fardig: () => !!husGrupp && !!husGrupp.userData.inne && !tonar && byggT >= 1 && !rivGrupp && !aka && !flyg && !tona.pa && zoomMal === null && !ramId && !rorForra && !nySkugga && !iaRorSig(),
    miljo(namn) {
      namn = GAMLA_NAMN[namn] || namn;
      if (!omgivning.lista.some(m => m[0] === namn)) return;
      miljoNamn = namn; satMiljo();
      if (husGrupp) { try { byggMobler(husGrupp.userData.delar.ute); } catch (e) { console.warn(e); } }
      nySkugga = true; satSol();
    },
    miljoLista: () => omgivning.lista.slice(),
    inne,
    // Åkningen genom ytterdörren: forbered() bygger inredningen nu (hovring över Se inne),
    // flyger() säger om den pågår. flygProv(s) är för bildverktygen: fryser åkningen vid
    // s (0 ute … 1 inne) och ritar; flygProv(null) släpper den igen.
    forbered() { if (husGrupp && !husGrupp.userData.inne && !husGrupp.userData.inneVantar && !inneBygge) planeraInne(0); },
    flyger: () => !!flyg,
    // för kontroll i bildverktygen: ytterdörrens läge (0 stängd … 1 öppen) och kamerans plats
    dorrOppen: () => { const Y = husGrupp && husGrupp.userData.ydorr; return Y ? Y.t : 0; },
    // taklyftet för bildverktygen: takProv(t) fryser lyftet vid t (0 stängt … 1 öppet), takProv(null) släpper
    takProv(t) { oppen.prov = t === null || t === undefined ? null : +t; begarRender(); return { t: oppen.t, pa: oppen.pa, vantar: oppen.vantar }; },
    // grafikminnet: nya program eller texturer under en åkning betyder att något inte var förberett
    grafik: () => ({ program: renderer.info.programs.length, texturer: renderer.info.memory.textures, geometrier: renderer.info.memory.geometries, inneVarm: !!(husGrupp && husGrupp.userData.inneVarm) }),
    kameraLage: () => kamera.position.toArray().concat(styr.target.toArray(), [kamera.fov, styr.enabled ? 1 : 0]).map(x => +x.toFixed(3)),
    flygProv(s) {
      if (!flyg || flyg.vantar) return null;
      if (s === null || s === undefined) { flyg.paus = false; flyg.v = 0; begarRender(); return null; }
      flyg.paus = true; flyg.s = Math.min(1, Math.max(0, +s)); begarRender();
      const B = flyg.bana;
      return { s: flyg.s, sT: B.sT, sO0: B.sO0, sO1: B.sO1, sC0: B.sC0, L: B.L, tid: B.tidIn, kamera: kamera.position.toArray().map(x => +x.toFixed(2)), dorr: +((husGrupp.userData.ydorr || { t: 0 }).t).toFixed(2), halv: B.halv, fri: +(B.halv || !inneLage ? 9 : friFlyg(kamera.position.x, kamera.position.z, false)).toFixed(2), inne: inneLage, fov: +kamera.fov.toFixed(1) };
    },
    // Spelläget (pekarlås): spel(true/false) sätter, spel() läser
    spel: pa => (pa === undefined ? spel.pa : satSpel(pa)),
    kanSpel: () => typeof duk.requestPointerLock === 'function',
    // sitta och resa sig, lamporna, dörrarna som öppnas när man går in i dem
    resDig,
    sitter: () => gang.sitter >= 0,
    allaLampor,
    lampor: () => { const ut = iaData(), l = ut ? ut.lampor.filter(Boolean) : []; return { antal: l.length, tanda: l.filter(L => L.pa).length }; },
    autoDorr: pa => (pa === undefined ? ia.auto : (ia.auto = !!pa)),
    // namn, läge och våning per vy (samma ordning som inne(true, i)); kartan behöver inte läsa inredningen själv
    inneVyer: () => (INNE_VYER[val.modell] || []).map(v => ({ namn: v.namn, pos: v.pos, mal: v.mal, niva: v.niva })),
    arInne: () => inneLage,
    // liv: vind, moln och fåglar. liv() läser läget, liv(true/false) sätter det.
    liv: pa => (pa === undefined ? liv.pa : satLiv(pa)),
    harLiv: miljoHarLiv,
    // ritanrop: hela bilden (utan skuggpass) och husets egna delar
    statistik() {
      renderer.info.reset();
      renderer.render(scene, kamera);
      let hus = 0;
      if (husGrupp) husGrupp.traverseVisible(o => { if ((o.isMesh || o.isSprite) && o.material && o.material.visible !== false) hus++; });
      return { anrop: renderer.info.render.calls, trianglar: renderer.info.render.triangles, hus, inne: !!(husGrupp && husGrupp.userData.inne), liv: liv.pa, livFps: liv.fps };
    },
    // mätningen för ?prestanda=1, utan att rita något: senaste rutans anrop och trianglar,
    // rutor sedan förra anropet, snitt och max ms per ruta och tiden mellan rutorna
    prestanda() {
      const ut = { rutor: perf.rutor, ms: perf.ms, msMax: perf.msMaxNu, intervall: perf.intervall, anrop: perf.anrop, trianglar: perf.tri, skuggAnrop: perf.skuggAnrop, tummeAnrop: perf.tummeAnrop, stilla: !ramId && !rorForra };
      perf.rutor = 0; perf.msMaxNu = 0;
      return ut;
    },
    // dockskåpet: oppna(true, { lager: { tak, loft, fokus: 'loft' } })
    oppna,
    arOppen: () => oppen.pa || oppen.vantar,
    // för bildverktygen: sittplatserna inne med läge på skärmen (px i duken) och avstånd, bara läsning
    provSitt() {
      const ut = iaData(), Y0 = husGrupp ? husGrupp.userData.delar.Y0 : 0;
      if (!ut || !inneLage) return [];
      return ut.sitt.map((s, i) => {
        if (!s) return null;
        pV.set(s.pos[0], s.pos[1] + Y0 - 0.45, s.pos[2]);
        const d = pV.distanceTo(kamera.position); pV.project(kamera);
        return { i, namn: s.namn, avstand: +d.toFixed(2), framfor: pV.z < 1, x: Math.round((pV.x * 0.5 + 0.5) * dukB), y: Math.round((0.5 - pV.y * 0.5) * dukH) };
      }).filter(Boolean);
    },
    // styrspaken på pekskärm: spak(fram, sidled) med -1..1, spak(0, 0) = släppt
    spak: (fw, st) => satSpak(+fw || 0, +st || 0),
    // Tomt hus: tomt(true/false) döljer eller visar möblerna (tonas 0,4 s), tomt() läser läget
    tomt: (pa, opts) => (pa === undefined ? tomt.pa : satTomt(pa, opts)),
    // Planlösningen rakt ovanifrån: plan(true/false, { direkt }), plan() läser läget.
    // Duken skickar 'husritare:plan' ({ pa }) när läget ändras och 'husritare:planrum'
    // ({ vy, namn }) när man klickar på ett rum. planLage() är för bildverktygen.
    plan: (pa, opts) => (pa === undefined ? plan.pa : planVy(pa, opts)),
    planLage: () => ({ pa: plan.pa, t: +plan.t.toFixed(3), data: !!plan.data, rum: plan.data ? plan.data.rum.map(r => [r.namn, r.yta, +r.x.toFixed(2), +r.z.toFixed(2), r.vy]) : [] }),
    // taket svävar medan inredningen byggs färdigt (knappen visar att det laddar)
    lyftLaddar: () => oppen.vantar,
    harLoft: () => !!husGrupp && (HUS[val.modell].rum || []).some(r => /loft/i.test(r[0])),
    // vandringen inne
    rumPunkter: () => (inneLage || (husGrupp && husGrupp.userData.inne) ? punkter().map(p => ({ namn: p.namn, niva: nivaTal(p.niva) ? 'loft' : 'botten' })) : []),
    gaTill,
    position,
    // bara Ladda ned-knappen: skarp PNG (kodas en gång, när man ber om den)
    nedladdning() {
      const pr = renderer.getPixelRatio();
      renderer.setPixelRatio(Math.min(3, SKARP * 1.6));
      // glorierna räknas i pixlar: följ den skarpare bufferthöjden (annars blev de för små)
      renderer.getDrawingBufferSize(haloStorlek); HALO_MAT.uniforms.uH.value = haloStorlek.y;
      renderer.render(scene, kamera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setPixelRatio(pr);
      renderer.getDrawingBufferSize(haloStorlek); HALO_MAT.uniforms.uH.value = haloStorlek.y;
      renderer.render(scene, kamera);
      tona.farsk = false;
      return url;
    },
    bild() {
      renderer.render(scene, kamera);
      return renderer.domElement.toDataURL('image/jpeg', 0.9);
    },
  };
}
