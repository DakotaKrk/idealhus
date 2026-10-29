/* Legohus CRM – mötesrummet i 3D (Kundmöte, #/mote): ett byggföretags mötesrum med stort fönster mot skogen,
   solstrålar och dammkorn i ljuset, ett ekbord med ritningar, husmodell på snurrskiva, laptop, kaffe som ångar,
   bygghjälm, tumstock, materialprover och en växt; stolar runt bordet där kunderna sitter (knapparna läggs på
   stolarna), whiteboard med husets resa, hylla med pärmar, foton på husen, väggklocka som går på riktigt och
   pendellampor som lyser. Ritas bara när scenen syns. three.js r170 ligger lokalt i vendor/three (MIT). */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

const IH = window.IH;
const LUGN = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stod = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (x) { return false; } })();

/* Hjälpare ---------------------------------------------------------------------------------------- */
function tex(w, h, rita, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; rita(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const mat = (o) => new THREE.MeshStandardMaterial(o);
const lada = (w, h, d, m, r = 0.02) => { const x = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), m); x.castShadow = x.receiveShadow = true; return x; };
const cyl = (a, b, h, m, s = 24) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, s), m); x.castShadow = x.receiveShadow = true; return x; };
const grupp = (...l) => { const g = new THREE.Group(); l.forEach((x) => x && g.add(x)); return g; };
const brus = (g, w, h, n, f) => { for (let i = 0; i < n; i++) { g.fillStyle = f(i); g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };

/* Texturer ---------------------------------------------------------------------------------------- */
const T = {
  golv: () => tex(1024, 1024, (g, w, h) => {
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -200 : 0; x < w; x += 400) {
      const l = 58 + Math.random() * 10; g.fillStyle = `hsl(32, 38%, ${l}%)`; g.fillRect(x, y, 400, 64);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(110,70,35,${0.05 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random(); g.beginPath(); const yy = y + 4 + Math.random() * 56; g.moveTo(x, yy); g.bezierCurveTo(x + 130, yy + (Math.random() - 0.5) * 8, x + 260, yy + (Math.random() - 0.5) * 8, x + 400, yy); g.stroke(); }
      g.fillStyle = 'rgba(60,35,15,.45)'; g.fillRect(x, y, 400, 2); g.fillRect(x, y, 2, 64);
    }
  }, [3, 3]),
  vagg: () => tex(512, 512, (g, w, h) => { g.fillStyle = '#efe8dd'; g.fillRect(0, 0, w, h); brus(g, w, h, 9000, (i) => i % 2 ? 'rgba(255,255,255,.25)' : 'rgba(120,100,80,.05)'); }, [4, 2]),
  ek: () => tex(1024, 512, (g, w, h) => {
    g.fillStyle = '#c99a63'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 128) { g.fillStyle = `hsl(31, 45%, ${54 + Math.random() * 8}%)`; g.fillRect(0, y, w, 128); g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(0, y, w, 1.5); }
    for (let k = 0; k < 220; k++) { g.strokeStyle = `rgba(100,60,25,${0.05 + Math.random() * 0.1})`; g.lineWidth = 0.6 + Math.random() * 1.4; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x / 90 + k) * 3 + (Math.random() - 0.5) * 2); g.stroke(); }
    for (let k = 0; k < 6; k++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = 'rgba(90,50,20,.35)'; for (let r = 3; r < 16; r += 3) { g.beginPath(); g.ellipse(x, y, r * 2.4, r, 0, 0, 7); g.stroke(); } }
  }),
  ritning: (rubrik) => tex(1024, 720, (g, w, h) => {
    g.fillStyle = '#1e4c8c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(170,210,255,.16)'; g.lineWidth = 1; for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#e4f1ff'; g.lineWidth = 7; g.strokeRect(150, 140, 720, 420);
    g.lineWidth = 4; [[470, 140, 470, 400], [150, 330, 470, 330], [640, 560, 640, 380], [640, 380, 870, 380]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    g.lineWidth = 2; g.beginPath(); g.arc(470, 400, 60, -Math.PI / 2, 0); g.stroke(); g.beginPath(); g.arc(640, 560, 60, Math.PI, Math.PI * 1.5); g.stroke();
    g.setLineDash([10, 8]); g.strokeStyle = 'rgba(228,241,255,.7)'; g.beginPath(); g.moveTo(150, 600); g.lineTo(870, 600); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e4f1ff'; g.font = '600 26px Poppins, sans-serif'; g.fillText(rubrik, 150, 110); g.font = '500 20px Poppins, sans-serif'; g.fillText('Plan 1:50', 760, 110);
    g.strokeRect(w - 250, h - 110, 220, 80); g.font = '600 18px Poppins, sans-serif'; g.fillText('LEGOHUS', w - 230, h - 80); g.font = '14px Poppins, sans-serif'; g.fillText('Bygglovsritning', w - 230, h - 52);
  }),
  whiteboard: () => tex(1024, 560, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h); const lg = g.createLinearGradient(0, 0, w, h); lg.addColorStop(0, 'rgba(255,255,255,.6)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(200,200,210,.15)'); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b3f73'; g.font = '700 46px Poppins, sans-serif'; g.fillText('Husets resa', 60, 90);
    const steg = ['Ritning', 'Tillverkning', 'Grund', 'Montage', 'Besiktning', 'Nyckel'];
    g.lineWidth = 6; g.strokeStyle = '#c9542f'; g.beginPath(); g.moveTo(90, 260); g.bezierCurveTo(300, 200, 600, 330, 940, 250); g.stroke();
    steg.forEach((s, n) => { const x = 90 + n * 170, y = 260 + Math.sin(n * 1.2) * 30; g.fillStyle = '#fff'; g.strokeStyle = '#1b3f73'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1b3f73'; g.font = '600 26px Poppins, sans-serif'; g.fillText(String(n + 1), x - 8, y + 9); g.font = '500 24px Poppins, sans-serif'; g.fillText(s, x - 40, y + 64); });
    g.strokeStyle = '#2e8b57'; g.lineWidth = 5; g.beginPath(); g.moveTo(80, 440); g.lineTo(100, 462); g.lineTo(140, 418); g.stroke(); g.fillStyle = '#2e8b57'; g.font = '500 28px Poppins, sans-serif'; g.fillText('Tomt OK · väg för kranbil', 160, 452);
    g.strokeStyle = '#1b3f73'; g.lineWidth = 3; g.strokeRect(640, 390, 300, 120); g.beginPath(); g.moveTo(640, 390); g.lineTo(790, 330); g.lineTo(940, 390); g.stroke();
  }),
  // utsikten: målad i lager med luftperspektiv – himmel med solsken, fjärran berg, åsar med granskog som blir
  // mörkare och skarpare närmare, en äng i solljus med björkar, en grusväg och ett Legohus med varma fönster
  // kvällshimlen (bara i mörka teman): mörkblå ton över himlen, stjärnor och en måne där solen står i dagsljus
  natt: () => tex(1024, 512, (g, w, h) => {
    let fro = 7; const r = () => { fro = (fro * 16807) % 2147483647; return (fro - 1) / 2147483646; };
    g.clearRect(0, 0, w, h);
    const hi = g.createLinearGradient(0, 0, 0, h * 0.6); hi.addColorStop(0, 'rgba(8,13,26,.85)'); hi.addColorStop(0.7, 'rgba(18,26,44,.55)'); hi.addColorStop(1, 'rgba(30,38,58,0)'); g.fillStyle = hi; g.fillRect(0, 0, w, h * 0.6);
    for (let n = 0; n < 160; n++) { const x = r() * w, y = r() * h * 0.36, a = 0.35 + r() * 0.6; g.fillStyle = `rgba(235,240,255,${a})`; g.beginPath(); g.arc(x, y, 0.6 + r() * 1.1, 0, 7); g.fill(); }
    const mx = w * 0.78, my = h * 0.18, sken = g.createRadialGradient(mx, my, 4, mx, my, 120); sken.addColorStop(0, 'rgba(220,228,255,.35)'); sken.addColorStop(1, 'rgba(220,228,255,0)'); g.fillStyle = sken; g.fillRect(mx - 120, my - 120, 240, 240);
    g.fillStyle = '#eef0f6'; g.beginPath(); g.arc(mx, my, 20, 0, 7); g.fill(); g.fillStyle = 'rgba(190,196,214,.5)'; [[-6, -5, 5], [7, 4, 4], [-2, 9, 3]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 7); g.fill(); });
  }),
  utsikt: (lager) => tex(2048, 1024, (g, w, h) => {
    let fro = 11; const bak = lager !== 'fram'; const r = () => { fro = (fro * 16807) % 2147483647; return (fro - 1) / 2147483646; };
    const himmel = g.createLinearGradient(0, 0, 0, h * 0.62); himmel.addColorStop(0, '#7fb1d3'); himmel.addColorStop(0.55, '#bcd7e6'); himmel.addColorStop(1, '#f4e6cf'); g.fillStyle = himmel; g.fillRect(0, 0, w, h);
    const sol = g.createRadialGradient(w * 0.78, h * 0.18, 10, w * 0.78, h * 0.18, w * 0.42); sol.addColorStop(0, 'rgba(255,246,220,.95)'); sol.addColorStop(0.12, 'rgba(255,236,196,.55)'); sol.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = sol; g.fillRect(0, 0, w, h);
    // mjuka moln i flera lager
    const moln = (x, y, sk, a) => { for (let n = 0; n < 9; n++) { const rx = (40 + r() * 70) * sk, ry = rx * 0.42, cx = x + (r() - 0.5) * 180 * sk, cy = y + (r() - 0.5) * 22 * sk; const m = g.createRadialGradient(cx, cy, 2, cx, cy, rx); m.addColorStop(0, `rgba(255,255,255,${a})`); m.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = m; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); } };
    moln(380, 150, 1.4, 0.8); moln(1050, 110, 1.1, 0.7); moln(1650, 210, 0.9, 0.6); moln(700, 260, 0.7, 0.5);
    // en ås av granar som silhuett: taggiga toppar i olika storlek
    const skog = (bas, hojd, farg, tat, fran = 0, till = w) => {
      g.fillStyle = farg; g.beginPath(); g.moveTo(fran, h);
      for (let x = fran; x <= till; x += tat * (0.55 + r() * 0.7)) {
        const th = hojd * (0.55 + r() * 0.6), y = bas(x), bred = tat * (1.1 + r() * 0.6) * Math.min(1.3, hojd / 70);
        g.lineTo(x - bred / 2, y); for (let k = 1; k <= 5; k++) { const yy = y - th * k / 5; g.lineTo(x - bred / 2 * (1 - k / 5) - bred * 0.12, yy + th * 0.06); g.lineTo(x - bred / 2 * (1 - k / 5), yy); }
        g.lineTo(x, y - th - th * 0.08); for (let k = 5; k >= 1; k--) { const yy = y - th * k / 5; g.lineTo(x + bred / 2 * (1 - k / 5), yy); g.lineTo(x + bred / 2 * (1 - k / 5) + bred * 0.12, yy + th * 0.06); } g.lineTo(x + bred / 2, y);
      }
      g.lineTo(till, h); g.closePath(); g.fill();
    };
    // fjärran berg med snö
    g.fillStyle = '#b9c9d3'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.42 - Math.sin(x / 260) * 40 - Math.sin(x / 90 + 1) * 14 - Math.max(0, 70 - Math.abs(x - 1300) / 3)); g.lineTo(w, h); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); for (let x = 1120; x <= 1480; x += 8) g.lineTo(x, h * 0.42 - Math.sin(x / 260) * 40 - Math.sin(x / 90 + 1) * 14 - Math.max(0, 70 - Math.abs(x - 1300) / 3) + 3); for (let x = 1480; x >= 1120; x -= 8) g.lineTo(x, h * 0.42 + 14 - Math.abs(x - 1300) / 8 - Math.sin(x / 40) * 5); g.fill();
    const dis = (a) => { g.fillStyle = `rgba(232,236,232,${a})`; g.fillRect(0, 0, w, h); };
    dis(0.1);
    skog((x) => h * 0.5 - Math.sin(x / 300) * 22, 46, '#8fa79a', 14);
    dis(0.07);
    skog((x) => h * 0.56 - Math.sin(x / 240 + 2) * 26, 70, '#6f8f72', 20);
    dis(0.06);
    // solstrålar genom diset
    for (let n = 0; n < 7; n++) { g.save(); g.translate(w * 0.78, h * 0.18); g.rotate(0.35 + n * 0.16); const st = g.createLinearGradient(0, 0, 0, h); st.addColorStop(0, 'rgba(255,240,210,.16)'); st.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = st; g.fillRect(-14 - n * 3, 0, 28 + n * 6, h); g.restore(); }
    if (bak) return;
    g.clearRect(0, 0, w, h);
    // ängen i solljus
    const ang = g.createLinearGradient(0, h * 0.6, 0, h); ang.addColorStop(0, '#b9c58a'); ang.addColorStop(0.5, '#a3b673'); ang.addColorStop(1, '#8aa060'); g.fillStyle = ang; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.64 - Math.sin(x / 400) * 14); g.lineTo(w, h); g.fill();
    for (let n = 0; n < 5000; n++) { const x = r() * w, y = h * 0.64 + r() * h * 0.36; g.strokeStyle = r() < 0.5 ? 'rgba(80,100,50,.25)' : 'rgba(230,236,170,.3)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 6 * (y / h)); g.stroke(); }
    for (let n = 0; n < 260; n++) { g.fillStyle = ['#fff7e8', '#f6d36b', '#e7a3a0', '#c9b4e0'][n % 4]; g.beginPath(); g.arc(r() * w, h * 0.7 + r() * h * 0.3, 1.5 + r() * 2, 0, 7); g.fill(); }
    // grusvägen fram till huset
    g.fillStyle = '#d8c7a6'; g.beginPath(); g.moveTo(w * 0.62, h); g.bezierCurveTo(w * 0.66, h * 0.86, w * 0.7, h * 0.76, w * 0.735, h * 0.7); g.lineTo(w * 0.75, h * 0.7); g.bezierCurveTo(w * 0.73, h * 0.78, w * 0.74, h * 0.88, w * 0.8, h); g.fill();
    // Legohus: svart panel, sadeltak, varma fönster, trädäck och skugga
    const hx = w * 0.7, hy = h * 0.69, hw = 230, hh = 92;
    g.fillStyle = 'rgba(40,50,30,.35)'; g.beginPath(); g.ellipse(hx + hw / 2, hy + 6, hw * 0.62, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#26221f'; g.fillRect(hx, hy - hh, hw, hh);
    for (let x = hx + 6; x < hx + hw; x += 9) { g.fillStyle = 'rgba(255,240,220,.06)'; g.fillRect(x, hy - hh, 2, hh); }
    g.fillStyle = '#1b1816'; g.beginPath(); g.moveTo(hx - 16, hy - hh + 2); g.lineTo(hx + hw / 2, hy - hh - 70); g.lineTo(hx + hw + 16, hy - hh + 2); g.fill();
    g.fillStyle = '#c98a45'; g.fillRect(hx + hw / 2 - 2, hy - hh - 70, 4, 6);
    [[20, 26, 52, 48], [96, 18, 38, 74], [156, 26, 52, 48]].forEach(([x, y, fw, fh]) => { const fg = g.createLinearGradient(0, hy - hh + y, 0, hy - hh + y + fh); fg.addColorStop(0, '#ffe2a8'); fg.addColorStop(1, '#f2a65a'); g.fillStyle = fg; g.fillRect(hx + x, hy - hh + y, fw, fh); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(hx + x + fw / 2 - 1, hy - hh + y, 2, fh); });
    const sken = g.createRadialGradient(hx + hw / 2, hy - hh / 2, 10, hx + hw / 2, hy - hh / 2, 220); sken.addColorStop(0, 'rgba(255,200,120,.25)'); sken.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = sken; g.fillRect(hx - 220, hy - hh - 220, hw + 440, hh + 440);
    g.fillStyle = '#b98a58'; g.fillRect(hx - 30, hy - 8, hw * 0.7, 10);
    // närmaste skogsbrynet, mörkt och skarpt, lämnar plats för huset
    skog((x) => h * 0.69 + Math.sin(x / 180) * 8, 150, '#3f5a3e', 34, 0, w * 0.6);
    skog((x) => h * 0.7 + Math.sin(x / 180) * 8, 150, '#3f5a3e', 34, w * 0.86, w);
    // björkar i förgrunden
    [[w * 0.6, 1.0], [w * 0.92, 1.25], [w * 0.08, 1.15]].forEach(([x, sk]) => {
      const y = h * 0.86; g.fillStyle = '#efe9df'; g.fillRect(x - 5 * sk, y - 260 * sk, 10 * sk, 260 * sk);
      for (let k = 0; k < 12; k++) { g.fillStyle = '#2b2622'; g.fillRect(x - 5 * sk + r() * 4, y - r() * 250 * sk, 4 + r() * 5, 2); }
      for (let k = 0; k < 7; k++) { const ya = y - (250 - k * 22) * sk, xa = x + (k % 2 ? 1 : -1) * (12 + k * 8) * sk; g.strokeStyle = '#5a4a3e'; g.lineWidth = 2 * sk; g.beginPath(); g.moveTo(x, ya + 10 * sk); g.quadraticCurveTo(xa, ya - 6 * sk, xa + (k % 2 ? 8 : -8) * sk, ya + 26 * sk); g.stroke(); }
      for (let k = 0; k < 150; k++) { const yy = y - 270 * sk + r() * 190 * sk, spread = 22 + (yy - (y - 270 * sk)) * 0.32, xx = x + (r() - 0.5) * 2 * spread * sk; g.fillStyle = `hsla(${70 + r() * 25}, ${40 + r() * 15}%, ${38 + r() * 22}%, .9)`; g.beginPath(); g.ellipse(xx, yy, 4 * sk, 6 * sk, r() * 3, 0, 7); g.fill(); }
    });
  }),
  skarm: () => tex(512, 320, (g, w, h) => {
    g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1915'; g.fillRect(0, 0, 90, h);
    g.fillStyle = '#e29a4a'; g.font = '700 22px Poppins, sans-serif'; g.fillText('Kupa 40', 116, 44); g.fillStyle = '#6b6258'; g.font = '14px Poppins, sans-serif'; g.fillText('Kalkyl · exempel', 116, 66);
    [0.55, 0.8, 0.4, 0.95, 0.7].forEach((v, n) => { g.fillStyle = n === 3 ? '#e29a4a' : '#f2d4ab'; g.fillRect(120 + n * 70, 280 - v * 160, 46, v * 160); });
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(246,198,141,.5)'; g.fillRect(18, 100 + k * 30, 54, 10); }
  }),
  parm: (text, farg) => tex(128, 512, (g, w, h) => { g.fillStyle = farg; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(16, 60, w - 32, 140); g.fillStyle = '#1b1915'; g.save(); g.translate(76, 190); g.rotate(-Math.PI / 2); g.font = '700 30px Poppins, sans-serif'; g.fillText(text, 0, 0); g.restore(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(w / 2, 400, 18, 0, 7); g.fill(); })
};

/* Möbler och saker -------------------------------------------------------------------------------- */
const M = {};
function material() {
  M.ek = new THREE.MeshPhysicalMaterial({ map: T.ek(), roughness: 0.38, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.22 });
  M.ekKant = mat({ color: '#a67442', roughness: 0.5 });
  M.stal = mat({ color: '#2b2a29', roughness: 0.35, metalness: 0.85 });
  M.krom = mat({ color: '#cfd3d6', roughness: 0.18, metalness: 1 });
  M.tyg = mat({ color: '#3b3632', roughness: 0.95 });
  M.tyg2 = mat({ color: '#c98a45', roughness: 0.9 });
  M.vit = mat({ color: '#f7f4ee', roughness: 0.6 });
  M.svart = mat({ color: '#1b1a19', roughness: 0.5, metalness: 0.2 });
  M.papper = mat({ color: '#fbfaf6', roughness: 0.9 });
  M.gul = mat({ color: '#f2b51e', roughness: 0.35, metalness: 0.05 });
  M.glas = mat({ color: '#d9ecf2', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.07 });
  M.panel = mat({ color: '#2a2521', roughness: 0.8 });
  M.lampa = mat({ color: '#fff3d6', emissive: '#ffd69a', emissiveIntensity: 2.4 });
}
function bord() {
  const g = new THREE.Group();
  const skiva = lada(6.4, 0.14, 3.2, M.ek, 0.07); skiva.position.y = 1.5; g.add(skiva);
  const kant = lada(6.42, 0.05, 3.22, M.ekKant, 0.02); kant.position.y = 1.41; g.add(kant);
  [[-2.6, 1.2], [2.6, 1.2], [-2.6, -1.2], [2.6, -1.2]].forEach(([x, z]) => { const b = lada(0.1, 1.4, 0.1, M.stal, 0.03); b.position.set(x, 0.72, z); g.add(b); });
  [-2.6, 2.6].forEach((x) => { const t = lada(0.1, 0.06, 2.5, M.stal, 0.02); t.position.set(x, 0.08, 0); g.add(t); });
  return g;
}
// kontorsstolen i rummets skala (bordet står i dubbel skala): stoppad sits och rygg med söm, mekanism under sitsen,
// gaskolv med skydd, femarmat fotkryss som sluttar ner till dubbla hjul som står på golvet, och armstöd
function stol(farg) {
  const g = new THREE.Group(), tyg = farg ? mat({ color: farg, roughness: 0.92 }) : M.tyg, plast = mat({ color: '#1e1d1c', roughness: 0.55 }), aluM = mat({ color: '#b9bec2', roughness: 0.3, metalness: 0.9 });
  const sits = lada(0.96, 0.15, 0.9, tyg, 0.07); sits.position.y = 0.95; g.add(sits);
  const sitsSkal = lada(0.98, 0.05, 0.92, plast, 0.03); sitsSkal.position.y = 0.865; g.add(sitsSkal);
  const som = lada(0.9, 0.006, 0.006, mat({ color: '#00000033', roughness: 1 }), 0); som.position.set(0, 1.026, 0.1); g.add(som);
  const mek = lada(0.36, 0.08, 0.36, plast, 0.02); mek.position.y = 0.8; g.add(mek);
  const spak = cyl(0.012, 0.012, 0.22, aluM, 8); spak.rotation.z = Math.PI / 2; spak.position.set(0.25, 0.8, 0.08); g.add(spak);
  const rygg = new THREE.Group(); rygg.position.set(0, 1.05, -0.42); rygg.rotation.x = -0.14; g.add(rygg);
  const ryggDyna = lada(0.9, 0.92, 0.13, tyg, 0.08); ryggDyna.position.y = 0.55; rygg.add(ryggDyna);
  const ryggSkal = lada(0.92, 0.94, 0.04, plast, 0.06); ryggSkal.position.set(0, 0.55, -0.07); rygg.add(ryggSkal);
  const svank = lada(0.7, 0.16, 0.03, tyg, 0.05); svank.position.set(0, 0.32, 0.075); rygg.add(svank);
  const ryggBage = lada(0.08, 0.32, 0.05, plast, 0.02); ryggBage.position.set(0, 0.06, -0.06); rygg.add(ryggBage);
  const skydd = cyl(0.09, 0.08, 0.3, plast, 20); skydd.position.y = 0.36; g.add(skydd);
  const kolv = cyl(0.045, 0.045, 0.32, aluM, 20); kolv.position.y = 0.62; g.add(kolv);
  const nav = cyl(0.13, 0.15, 0.08, aluM, 24); nav.position.y = 0.2; g.add(nav);
  for (let n = 0; n < 5; n++) {
    const a = n * Math.PI * 2 / 5 + 0.3, arm = new THREE.Group(); arm.rotation.y = -a; g.add(arm);
    const ben = lada(0.52, 0.06, 0.09, aluM, 0.025); ben.position.set(0.36, 0.17, 0); ben.rotation.z = -0.1; arm.add(ben);
    const gaffel = lada(0.06, 0.09, 0.07, plast, 0.02); gaffel.position.set(0.6, 0.12, 0); arm.add(gaffel);
    [-0.035, 0.035].forEach((z) => { const hjul = cyl(0.065, 0.065, 0.035, plast, 20); hjul.rotation.x = Math.PI / 2; hjul.position.set(0.62, 0.065, z); arm.add(hjul); });
  }
  [-1, 1].forEach((sd) => {
    const stod = lada(0.06, 0.32, 0.08, plast, 0.02); stod.position.set(sd * 0.47, 1.06, -0.12); g.add(stod);
    const ovan = lada(0.11, 0.05, 0.42, plast, 0.025); ovan.position.set(sd * 0.47, 1.24, -0.04); g.add(ovan);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function husModell() {
  const g = new THREE.Group(), fasad = mat({ color: '#2a2520', roughness: 0.8 }), tak = mat({ color: '#3a3430', roughness: 0.55, metalness: 0.2 }), ljus = mat({ color: '#ffe2ae', emissive: '#ffbf6e', emissiveIntensity: 1.8 });
  const kropp = lada(0.9, 0.42, 0.55, fasad, 0.01); kropp.position.y = 0.21; g.add(kropp);
  for (let x = -0.4; x <= 0.41; x += 0.045) { const r = lada(0.012, 0.42, 0.012, mat({ color: '#3b342d' }), 0); r.position.set(x, 0.21, 0.28); g.add(r); }
  const gavel = new THREE.Shape(); gavel.moveTo(-0.45, 0); gavel.lineTo(0.45, 0); gavel.lineTo(0, 0.3); gavel.closePath();
  const gg = new THREE.Mesh(new THREE.ExtrudeGeometry(gavel, { depth: 0.55, bevelEnabled: false }), fasad); gg.position.set(0, 0.42, -0.275); gg.castShadow = true; g.add(gg);
  [-1, 1].forEach((s) => { const p = lada(0.56, 0.025, 0.66, tak, 0.008); p.position.set(s * 0.235, 0.575, 0); p.rotation.z = -s * Math.atan2(0.3, 0.45); g.add(p); });
  [[-0.24, 0.2, 0.18, 0.22], [0.12, 0.17, 0.12, 0.3], [0.32, 0.22, 0.1, 0.12]].forEach(([x, y, w2, h2]) => { const f = lada(w2, h2, 0.01, ljus, 0); f.position.set(x, y, 0.281); g.add(f); });
  const dack = lada(0.7, 0.03, 0.22, M.ekKant, 0.005); dack.position.set(-0.05, 0.015, 0.4); g.add(dack);
  return g;
}
function hjalm() {
  const g = new THREE.Group();
  const kupa = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.gul); kupa.castShadow = true; g.add(kupa);
  const skarm = cyl(0.27, 0.27, 0.02, M.gul, 32); skarm.scale.z = 0.85; skarm.position.set(0, 0.01, 0.04); g.add(skarm);
  const ribba = lada(0.04, 0.2, 0.42, M.gul, 0.02); ribba.position.y = 0.12; ribba.rotation.x = 0; g.add(ribba);
  return g;
}
function kopp(farg) {
  const g = new THREE.Group(), m2 = mat({ color: farg, roughness: 0.35 });
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.18, 32, 1, true), m2); k.material.side = THREE.DoubleSide; k.position.y = 0.09; k.castShadow = true; g.add(k);
  const botten = cyl(0.075, 0.075, 0.01, m2, 24); botten.position.y = 0.005; g.add(botten);
  const kaffe = cyl(0.085, 0.085, 0.005, mat({ color: '#3a2214', roughness: 0.15 }), 24); kaffe.position.y = 0.15; g.add(kaffe);
  const ora = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 12, 24, Math.PI), m2); ora.position.set(0.1, 0.09, 0); ora.rotation.z = -Math.PI / 2; g.add(ora);
  return g;
}
function vaxt() {
  const g = new THREE.Group();
  const kruka = cyl(0.26, 0.2, 0.5, mat({ color: '#d8cfc2', roughness: 0.85 }), 32); kruka.position.y = 0.25; g.add(kruka);
  const blad = mat({ color: '#4f7a46', roughness: 0.6, side: THREE.DoubleSide });
  for (let n = 0; n < 22; n++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), blad); b.scale.set(0.35, 1.5, 0.08); const a = n * 2.4, h = 0.6 + Math.random() * 0.9; b.position.set(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12); b.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6); b.castShadow = true; g.add(b); }
  return g;
}

/* Scenen ------------------------------------------------------------------------------------------ */
let S = null;
function bygg() {
  material();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  // skuggorna räknas om var tredje bildruta (lamporna vajar bara lite) i stället för i varje
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  // bortom rummet tonar allt till krämvitt i stället för att visa kortets mörka bakgrund
  const scen = new THREE.Scene(); scen.background = new THREE.Color('#f6efe4'); scen.fog = new THREE.Fog('#f6efe4', 24, 52);
  const pm = new THREE.PMREMGenerator(renderer); scen.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scen.environmentIntensity = 0.45;
  const kamera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);

  // rummet: golv, två väggar, tak-kant, fönsterväggen med utsikt
  // golvet räcker långt fram och åt sidorna, så att kameran aldrig ser förbi kanten (smala och höga skärmar)
  const golvT = T.golv(); golvT.repeat.set(3 * 44 / 16, 3 * 30 / 12);
  const golv = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), mat({ map: golvT, roughness: 0.55, metalness: 0.02 })); golv.rotation.x = -Math.PI / 2; golv.position.set(0.7, 0, 10.8); golv.receiveShadow = true; scen.add(golv);
  // taket över rummet, i varmt vitt
  const takM = mat({ color: '#f3ece1', roughness: 0.95 }), tak = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 12), takM); tak.rotation.x = Math.PI / 2; tak.position.set(0.7, 6, 1.8); scen.add(tak);
  const vaggM = mat({ map: T.vagg(), roughness: 0.95 });
  // bakväggen med ett hål för fönstret, så att utsikten bakom syns på djupet
  [[-8, -0.9, 0, 6], [5.7, 8, 0, 6], [-0.9, 5.7, 0, 1.1], [-0.9, 5.7, 4.4, 6]].forEach(([x1, x2, y1, y2]) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, y2 - y1), vaggM); d.position.set((x1 + x2) / 2, (y1 + y2) / 2, -4.2); d.receiveShadow = true; scen.add(d); });
  const nisch = mat({ color: '#e6ddcf', roughness: 0.9 }); [[2.4, 1.1, 6.6, 0.02, 0.4], [2.4, 4.4, 6.6, 0.02, 0.4], [-0.9, 2.75, 0.02, 3.3, 0.4], [5.7, 2.75, 0.02, 3.3, 0.4]].forEach(([x, y, w2, h2, d2]) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w2 + (w2 < 1 ? 0 : 0), h2 < 1 ? 0.02 : h2, d2), nisch); k.position.set(x, y, -4.4); scen.add(k); });
  const vanster = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), vaggM); vanster.rotation.y = Math.PI / 2; vanster.position.set(-6.2, 3, 1.8); vanster.receiveShadow = true; scen.add(vanster); const hoger = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), vaggM); hoger.rotation.y = -Math.PI / 2; hoger.position.set(7.6, 3, 1.8); hoger.receiveShadow = true; scen.add(hoger);
  const sockel = lada(16, 0.14, 0.04, M.vit, 0.01); sockel.position.set(0, 0.07, -4.18); scen.add(sockel);
  // fönstret: utsikt, karmar, glas med reflex
  const utsikt = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: T.utsikt('bak'), toneMapped: false })); utsikt.position.set(2.4, 1.75, -9.5); scen.add(utsikt);
  const utsiktFram = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4.3), new THREE.MeshBasicMaterial({ map: T.utsikt('fram'), toneMapped: false, transparent: true })); utsiktFram.position.set(2.4, 2.45, -5.4); scen.add(utsiktFram);
  const nattM = new THREE.MeshBasicMaterial({ map: T.natt(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), nattPlan = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), nattM); nattPlan.position.set(2.4, 1.75, -9.45); nattPlan.visible = false; scen.add(nattPlan);
  const karm = M.svart; [[2.4, 4.4, 6.6, 0.12], [2.4, 1.1, 6.6, 0.12]].forEach(([x, y, w]) => { const k = lada(w, 0.12, 0.14, karm, 0.01); k.position.set(x, y, -4.12); scen.add(k); });
  [-0.9, 0.7, 2.4, 4.1, 5.7].forEach((x) => { const k = lada(0.1, 3.4, 0.14, karm, 0.01); k.position.set(x, 2.75, -4.12); scen.add(k); });
  const fbank = lada(6.8, 0.06, 0.4, M.vit, 0.02); fbank.position.set(2.4, 1.04, -3.98); scen.add(fbank);
  const glas = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), M.glas); glas.position.set(2.4, 2.75, -4.1); scen.add(glas);

  // ljuset: solen genom fönstret, himmelsljus, pendellamporna
  const hemi = new THREE.HemisphereLight('#fff6ea', '#a4876a', 0.55); scen.add(hemi);
  const sol = new THREE.DirectionalLight('#ffe7c4', 2.6); sol.position.set(5, 7, -9); sol.target.position.set(-0.5, 0, 0.8); sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03; sol.shadow.radius = 4; scen.add(sol, sol.target);
  const fyll = new THREE.PointLight('#ffd8a8', 6, 9, 2); fyll.position.set(-2.5, 3.2, 3); scen.add(fyll);
  // solstrålar: mjuka ljuskäglor med additiv blandning
  const straleM = new THREE.MeshBasicMaterial({ color: '#fff0cf', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const stralar = []; [0.7, 2.4, 4.1].forEach((x, n) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7), straleM.clone()); s.position.set(x - 2.2, 2.3, -1.2); s.rotation.set(-0.95, 0.35, 0.25); scen.add(s); stralar.push(s); void n; });
  // dammkorn som svävar i solljuset
  const ND = 240, dpos = new Float32Array(ND * 3), dfas = []; for (let n = 0; n < ND; n++) { dpos[n * 3] = -2 + Math.random() * 6; dpos[n * 3 + 1] = 0.8 + Math.random() * 3.4; dpos[n * 3 + 2] = -3.6 + Math.random() * 4.2; dfas.push(Math.random() * 6); }
  const damm = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dpos, 3)), new THREE.PointsMaterial({ color: '#fff3d8', size: 0.025, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); scen.add(damm);

  // fler detaljer i rummet
  const mattaM = mat({ map: tex(256, 256, (g, w, h) => { g.fillStyle = '#b9ad9b'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 2); } g.strokeStyle = 'rgba(80,60,40,.25)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); }, [3, 2]), roughness: 1 }), matta = lada(7.6, 0.012, 4.8, mattaM, 0.006); matta.position.set(0, 0.006, 0.1); scen.add(matta);
  const panelM = mat({ map: tex(512, 256, (g, w, h) => { g.fillStyle = '#c9a77c'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 20) { g.fillStyle = `hsl(31, 40%, ${52 + Math.random() * 8}%)`; g.fillRect(x, 0, 18, h); g.fillStyle = 'rgba(60,35,15,.4)'; g.fillRect(x + 18, 0, 2, h); } }, [8, 1]), roughness: 0.6 });
  const panelB = lada(5.4, 1.1, 0.05, panelM, 0.01); panelB.position.set(-3.4, 0.55, -4.15); scen.add(panelB);
  const panelL = lada(0.05, 1.1, 12, panelM, 0.01); panelL.position.set(-6.15, 0.55, 1.8); scen.add(panelL);
  const gardM = mat({ color: '#e9e1d4', roughness: 1, side: THREE.DoubleSide });
  [-1.35, 6.15].forEach((x) => { const gg = new THREE.Group(); for (let n = 0; n < 7; n++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.8, 10, 1, true, 0, Math.PI), gardM); v.position.set(n * 0.1 - 0.3, 0, 0); v.rotation.y = n % 2 ? Math.PI : 0; v.castShadow = true; gg.add(v); } gg.position.set(x, 2.55, -3.95); scen.add(gg); });
  const stang = cyl(0.02, 0.02, 7.8, M.krom, 10); stang.rotation.z = Math.PI / 2; stang.position.set(2.4, 4.5, -3.95); scen.add(stang);
  const dorr = grupp(lada(1.1, 2.4, 0.06, mat({ color: '#e9e2d6', roughness: 0.7 }), 0.02)); dorr.position.set(-6.13, 1.2, 4.6); dorr.rotation.y = Math.PI / 2; scen.add(dorr);
  const handtag = lada(0.16, 0.03, 0.04, M.krom, 0.01); handtag.position.set(-6.07, 1.15, 4.2); handtag.rotation.y = Math.PI / 2; scen.add(handtag);
  const hangare = new THREE.Group(); hangare.position.set(-5.4, 0, 3.6); scen.add(hangare);
  const hpel = cyl(0.03, 0.04, 1.9, M.svart, 10); hpel.position.y = 0.95; hangare.add(hpel); const hfot = cyl(0.25, 0.28, 0.04, M.svart, 24); hfot.position.y = 0.02; hangare.add(hfot);
  const vast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), mat({ color: '#e8ff2a', roughness: 0.7, emissive: '#8a9a00', emissiveIntensity: 0.15 })); vast.position.set(0.12, 1.45, 0.1); vast.rotation.y = 0.4; vast.castShadow = true; hangare.add(vast);
  [0.25, 0.45].forEach((y) => { const r = lada(0.51, 0.04, 0.125, mat({ color: '#d9dde0', roughness: 0.2, metalness: 0.6 }), 0); r.position.set(0.12, 1.45 - 0.35 + y, 0.1); r.rotation.y = 0.4; hangare.add(r); });
  const h3 = hjalm(); h3.position.set(0, 1.92, 0); h3.scale.setScalar(0.85); hangare.add(h3);
  const sb = lada(2.6, 0.9, 0.55, mat({ color: '#2f2a26', roughness: 0.5 }), 0.02); sb.position.set(-3.6, 0.45, -3.82); scen.add(sb);
  const sbTopp = lada(2.64, 0.04, 0.58, M.ek, 0.01); sbTopp.position.set(-3.6, 0.92, -3.82); scen.add(sbTopp);
  const modell2 = husModell(); modell2.position.set(-4.2, 0.94, -3.8); modell2.scale.setScalar(0.7); modell2.rotation.y = 0.5; scen.add(modell2);
  const termos = cyl(0.07, 0.07, 0.34, M.krom, 20); termos.position.set(-2.8, 1.11, -3.78); scen.add(termos);
  [0, 1, 2].forEach((n) => { const k = kopp('#f4efe7'); k.position.set(-3.15 + n * 0.17, 0.94, -3.7); k.scale.setScalar(0.8); scen.add(k); });
  // kontaktskuggor under saker, så de står på ytan
  const skuggT = tex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const kskugga = (x, y, z, sx, sz) => { const m2 = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: skuggT, transparent: true, depthWrite: false, opacity: 0.6 })); m2.rotation.x = -Math.PI / 2; m2.position.set(x, y, z); scen.add(m2); };
  kskugga(0, 0.015, 0, 7.4, 4.2); kskugga(-3.6, 0.012, -3.7, 3, 1); kskugga(-5.2, 0.012, 2.6, 0.9, 0.9); kskugga(5.6, 0.012, -3.5, 1.1, 1.1);
  // bordet och stolarna
  const b = bord(); scen.add(b);
  const stolar = [], STOLPOS = [[-2.2, 2.2, 0.05], [-0.75, 2.25, 0], [0.75, 2.25, 0], [2.2, 2.2, -0.05], [4.0, 0.5, 0], [-4.0, 0.5, 0]];
  STOLPOS.forEach(([x, z, r], n) => { const s = stol(n % 2 ? null : '#4a423b'); s.position.set(x, 0, z); s.rotation.y = Math.atan2(-x * (Math.abs(x) > 3 ? 1 : 0.25), -z) + r; scen.add(s); stolar.push(s); kskugga(x, 0.014, z, 1, 1); });
  const bortre = []; [[-1.5, -2.2], [0, -2.25], [1.5, -2.2]].forEach(([x, z]) => { const s = stol('#4a423b'); s.position.set(x, 0, z); s.rotation.y = Math.atan2(-x * 0.25, -z); scen.add(s); bortre.push(s); });

  // på bordet
  const Y = 1.575;
  const rit1 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), mat({ map: T.ritning('Kupa 40 · Planritning'), roughness: 0.85 })); rit1.rotation.set(-Math.PI / 2, 0, 0.08); rit1.position.set(-1.2, Y + 0.002, 0.2); rit1.receiveShadow = true; scen.add(rit1);
  const rit2 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), mat({ map: T.ritning('Sadel 30 · Fasader'), roughness: 0.85 })); rit2.rotation.set(-Math.PI / 2, 0, -0.18); rit2.position.set(-1.5, Y, -0.35); rit2.receiveShadow = true; scen.add(rit2);
  const rulle = cyl(0.06, 0.06, 1.1, mat({ color: '#e9e4d8', roughness: 0.9 }), 20); rulle.rotation.set(0, 0.4, Math.PI / 2); rulle.position.set(-2.6, Y + 0.06, -0.9); scen.add(rulle);
  const snurr = new THREE.Group(); snurr.position.set(0.35, Y, 0); scen.add(snurr);
  const platta = cyl(0.5, 0.52, 0.04, M.ekKant, 48); platta.position.y = 0.02; snurr.add(platta);
  const gras = cyl(0.46, 0.46, 0.01, mat({ color: '#8fae6c', roughness: 1 }), 48); gras.position.y = 0.045; snurr.add(gras);
  const hus = husModell(); hus.position.y = 0.05; hus.scale.setScalar(0.85); snurr.add(hus);
  // laptop med skärm som lyser
  const lap = new THREE.Group(); lap.position.set(1.85, Y, 0.55); lap.rotation.y = -0.6; scen.add(lap);
  const bas = lada(0.8, 0.03, 0.55, M.krom, 0.02); bas.position.y = 0.015; lap.add(bas);
  const tangent = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.26), mat({ color: '#2a2a2c', roughness: 0.8 })); tangent.rotation.x = -Math.PI / 2; tangent.position.set(0, 0.032, 0.03); lap.add(tangent);
  const lock = new THREE.Group(); lock.position.set(0, 0.03, -0.27); lock.rotation.x = -0.28; lap.add(lock);
  const lockM = lada(0.8, 0.52, 0.02, M.krom, 0.02); lockM.position.y = 0.26; lock.add(lockM);
  const skarm = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.46), new THREE.MeshBasicMaterial({ map: T.skarm(), toneMapped: false })); skarm.position.set(0, 0.26, 0.012); lock.add(skarm);
  const skarmLjus = new THREE.PointLight('#fff1dc', 1.2, 2, 2); skarmLjus.position.set(0, 0.3, 0.3); lock.add(skarmLjus);
  // kaffe med ånga
  const kopp1 = kopp('#f4efe7'); kopp1.position.set(1.2, Y, 0.9); scen.add(kopp1);
  const kopp2 = kopp('#c98a45'); kopp2.position.set(-0.45, Y, 0.95); scen.add(kopp2);
  const angaT = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const anga = []; [kopp1, kopp2].forEach((k) => { for (let n = 0; n < 7; n++) { const a2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: angaT, transparent: true, depthWrite: false, opacity: 0 })); scen.add(a2); anga.push({ m: a2, k, fas: n / 7 }); } });
  const valdRing = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.9, 64), new THREE.MeshBasicMaterial({ color: '#f6c68d', transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); valdRing.rotation.x = -Math.PI / 2; valdRing.position.y = 0.03; scen.add(valdRing);
  // ett varmt spotljus över den valda kundens stol
  const valdSpot = new THREE.SpotLight('#ffcf96', 0, 7, 0.42, 0.7, 1.4); valdSpot.position.set(0, 4.6, 0); scen.add(valdSpot, valdSpot.target);
  // bygghjälm, tumstock, penna, materialprover, block
  const h1 = hjalm(); h1.position.set(2.6, Y, -0.85); h1.rotation.y = 0.6; scen.add(h1);
  const tum = new THREE.Group(); tum.position.set(-0.1, Y + 0.008, 0.9); tum.rotation.y = 0.3; scen.add(tum);
  for (let n = 0; n < 4; n++) { const l = lada(0.36, 0.012, 0.05, M.gul, 0.004); l.position.set(n * 0.3, n * 0.013, n % 2 ? 0.02 : 0); l.rotation.y = n % 2 ? 0.5 : -0.1; tum.add(l); }
  const penna = cyl(0.012, 0.012, 0.4, mat({ color: '#e0a33a', roughness: 0.4 }), 8); penna.rotation.set(0, 0.9, Math.PI / 2); penna.position.set(-0.85, Y + 0.012, 0.55); scen.add(penna);
  [['#d9b083', 0], ['#2b2622', 1], ['#c7c2b8', 2], ['#8a6a4a', 3]].forEach(([f, n]) => { const p = lada(0.24, 0.025, 0.16, mat({ color: f, roughness: 0.7 }), 0.01); p.position.set(2.2 + n * 0.06, Y + 0.012 + n * 0.026, 0.05 + n * 0.02); p.rotation.y = -0.2 + n * 0.12; scen.add(p); });
  const block = lada(0.42, 0.02, 0.56, M.papper, 0.01); block.position.set(-2.3, Y + 0.01, 0.65); block.rotation.y = 0.2; scen.add(block);
  for (let n = 0; n < 6; n++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.008), mat({ color: '#8fb3cf' })); r.rotation.x = -Math.PI / 2; r.position.set(-2.3, Y + 0.022, 0.48 + n * 0.06); scen.add(r); }

  // whiteboarden, hyllan med pärmar, fotona och klockan
  const wb = grupp(lada(3.1, 1.7, 0.05, M.vit, 0.02)); wb.position.set(-3.6, 2.6, -4.12); scen.add(wb);
  const wbYta = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), mat({ map: T.whiteboard(), roughness: 0.25, metalness: 0.05 })); wbYta.position.set(0, 0, 0.03); wb.add(wbYta);
  const hylla = new THREE.Group(); hylla.position.set(-6.05, 0, -1.2); hylla.rotation.y = Math.PI / 2; scen.add(hylla);
  [0.6, 1.4, 2.2].forEach((y) => { const p = lada(2.4, 0.05, 0.4, M.ekKant, 0.01); p.position.set(0, y, 0.2); hylla.add(p); });
  const PARMAR = [['Ritningar', '#2f5f8f'], ['Bygglov', '#7d6bb0'], ['Avtal', '#c98a45'], ['Offerter', '#e29a4a'], ['Fakturor', '#c4584a'], ['Besiktning', '#3f8f6f']];
  PARMAR.forEach(([t, f], n) => { const p = lada(0.12, 0.5, 0.34, mat({ map: T.parm(t, f), roughness: 0.6 }), 0.01); p.position.set(-0.9 + n * 0.15, 1.69, 0.2); p.rotation.z = n === 5 ? 0.2 : 0; hylla.add(p); });
  const h2 = hjalm(); h2.position.set(0.7, 2.25, 0.2); h2.scale.setScalar(0.9); hylla.add(h2);
  const lov = vaxt(); lov.position.set(-5.2, 0, 2.6); scen.add(lov);
  const vaxt2 = vaxt(); vaxt2.position.set(5.6, 0, -3.5); vaxt2.scale.setScalar(1.25); scen.add(vaxt2);
  const loader = new THREE.TextureLoader(); const modeller = (IH && IH.MODELLER) || [];
  modeller.slice(0, 3).forEach((m, n) => { const t = loader.load(m.bild || m.tumme); t.colorSpace = THREE.SRGBColorSpace; const ram = lada(0.92, 0.66, 0.04, M.svart, 0.01); ram.position.set(-6.15, 2.9, 1.2 + n * 1.15); ram.rotation.y = Math.PI / 2; scen.add(ram); const bild = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.58), mat({ map: t, roughness: 0.4 })); bild.position.set(-6.12, 2.9, 1.2 + n * 1.15); bild.rotation.y = Math.PI / 2; scen.add(bild); });
  // väggklockan med visare som går
  const klocka = new THREE.Group(); klocka.position.set(-3.6, 4.15, -4.12); scen.add(klocka);
  const urtavla = cyl(0.36, 0.36, 0.05, M.vit, 48); urtavla.rotation.x = Math.PI / 2; klocka.add(urtavla);
  const urram = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 16, 64), M.ekKant); urram.castShadow = true; klocka.add(urram);
  const nav = cyl(0.025, 0.025, 0.03, M.svart, 16); nav.rotation.x = Math.PI / 2; nav.position.z = 0.06; klocka.add(nav);
  const urglas = new THREE.Mesh(new THREE.CircleGeometry(0.36, 48), mat({ color: '#ffffff', roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.12 })); urglas.position.z = 0.07; klocka.add(urglas);
  for (let n = 0; n < 12; n++) { const s = lada(0.02, n % 3 ? 0.04 : 0.08, 0.01, M.svart, 0); s.position.set(Math.sin(n / 12 * Math.PI * 2) * 0.3, Math.cos(n / 12 * Math.PI * 2) * 0.3, 0.03); s.rotation.z = -n / 12 * Math.PI * 2; klocka.add(s); }
  const visare = (l, b2, m2) => { const g = new THREE.Group(); const v = lada(b2, l, 0.01, m2, 0); v.position.y = l / 2 - 0.03; g.add(v); g.position.z = 0.04; klocka.add(g); return g; };
  const vTim = visare(0.18, 0.025, M.svart), vMin = visare(0.27, 0.018, M.svart), vSek = visare(0.3, 0.007, mat({ color: '#c9542f' }));
  // pendellamporna över bordet
  const lampor = [], pendlar = [], insidor = []; [-1.7, 0, 1.7].forEach((x) => {
    const p = new THREE.Group(); p.position.set(x, 5.3, 0); scen.add(p); pendlar.push(p);
    const sladd = cyl(0.006, 0.006, 1.4, M.svart, 6); sladd.position.y = -0.7; p.add(sladd);
    const skarm2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.32, 32, 1, true), mat({ color: '#1f1d1b', roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide })); skarm2.position.y = -1.55; skarm2.castShadow = true; p.add(skarm2);
    const insida = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.31, 32, 1, true), mat({ color: '#f3e6d2', roughness: 0.6, side: THREE.BackSide, emissive: '#ffcf8f', emissiveIntensity: 0.6 })); insida.position.y = -1.55; p.add(insida); insidor.push(insida.material);
    const glod = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), M.lampa); glod.position.y = -1.68; p.add(glod);
    const l = new THREE.SpotLight('#ffcf8f', 9, 6, 0.75, 0.6, 1.6); l.position.y = -1.7; p.add(l); l.target.position.set(x, 1.5, 0); scen.add(l.target); lampor.push(l);
  });
  // utanför fönstret: moln som driver, fåglar som flyger förbi och granar som vajar
  const molnT = tex(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.85)'; [[120, 90, 80], [420, 60, 110], [760, 110, 90], [960, 70, 60]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y, r, r * 0.32, 0, 0, 7); g.ellipse(x + r * 0.55, y + 8, r * 0.75, r * 0.28, 0, 0, 7); g.ellipse(x - r * 0.5, y + 10, r * 0.6, r * 0.25, 0, 0, 7); g.fill(); }); }, [1, 1]);
  molnT.wrapS = THREE.RepeatWrapping;
  const molnPlan = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: molnT, transparent: true, depthWrite: false, toneMapped: false })); molnPlan.scale.set(1.8, 1.8, 1); molnPlan.position.set(2.4, 4.6, -8.8); scen.add(molnPlan);
  // fåglarna: riktiga siluetter med kropp, stjärt och ledade vingar som slår och glider, i en liten flock
  const fagelM = new THREE.MeshBasicMaterial({ color: '#2f2c2b', side: THREE.DoubleSide }), faglar = [];
  const vingForm = new THREE.Shape(); vingForm.moveTo(0, 0); vingForm.quadraticCurveTo(0.09, 0.05, 0.2, 0.01); vingForm.quadraticCurveTo(0.12, -0.012, 0, -0.03); vingForm.closePath();
  const vingGeo = new THREE.ShapeGeometry(vingForm);
  for (let n = 0; n < 5; n++) {
    const f = new THREE.Group();
    const kr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), fagelM); kr.scale.set(2.4, 0.9, 0.9); f.add(kr);
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), fagelM); st.rotation.z = Math.PI / 2; st.position.x = -0.06; f.add(st);
    const vingar = [-1, 1].map((sd) => { const v = new THREE.Mesh(vingGeo, fagelM); v.rotation.x = -Math.PI / 2; v.scale.set(0.9, sd, 1); const led = new THREE.Group(); led.add(v); f.add(led); return { led, sd }; });
    f.userData.vingar = vingar; f.scale.setScalar(1.4 - n * 0.12); scen.add(f);
    faglar.push({ f, fas: n * 0.9, y: 4.0 + (n % 3) * 0.22, z: -7.2 + (n % 2) * 0.6 });
  }
  const granar = [];
  // laptopens staplar växer och krymper som om kalkylen räknas om
  const lapStaplar = []; for (let n = 0; n < 5; n++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.2), new THREE.MeshBasicMaterial({ color: n === 3 ? '#e29a4a' : '#f2d4ab', toneMapped: false })); st.geometry.translate(0, 0.1, 0); st.position.set(-0.13 + n * 0.08, 0.08, 0.014); lock.add(st); lapStaplar.push(st); }


  const comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  comp.addPass(new RenderPass(scen, kamera)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.9); comp.addPass(bloom); comp.addPass(new OutputPass());
  S = { temaObj: { hemi, sol, fyll, takM, vaggM, nisch, mattaM, insidor, utsikt: [utsikt.material, utsiktFram.material, molnPlan.material], nattM, nattPlan, molnM: molnPlan.material }, valdRing, valdSpot, pendlar, molnT, faglar, granar, lapStaplar, vaxter: [lov, vaxt2], renderer, scen, kamera, comp, bloom, stolar, bortre, snurr, anga, stralar, damm, dpos, dfas, ND, vTim, vMin, vSek, lampor, el: null, t: 0, ram: 0, synlig: false, mus: new THREE.Vector2(), musMal: new THREE.Vector2(), klocka: new THREE.Clock() };
  renderer.domElement.className = 'motesrum3d__duk';
  temaStart();
  new IntersectionObserver((r) => { S.synlig = r[0].isIntersecting; if (S.synlig) starta(); }, { threshold: 0.05 }).observe(renderer.domElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) starta(); });
  addEventListener('resize', storlek);
  new ResizeObserver(() => { S.lage = null; if (LUGN) starta(); }).observe(renderer.domElement);
}
/* Temat ------------------------------------------------------------------------------------------- */
// Rummet följer CRM:ets tema (--t-3d-rum-… i CSS): väggarna, taket, nischen, mattan, ljuset, lamporna och
// markeringen av vald kund. Med svagt solljus (Mörk) blir det kväll: utsikten mörknar, strålarna och dammet tonar
// bort och pendellamporna tar över. Scenen byggs i Original och ställs sedan om; vid temabyte tonas allt över.
// Saknas en variabel gäller Original-värdet, så Original ritas exakt som förut.
const TV = { ljus: 1 };
const TEMA0 = { rum: '#f6efe4', 'rum-tak': '#f3ece1', 'rum-vagg': '#efe8dd', 'rum-nisch': '#e6ddcf', 'rum-hemi-upp': '#fff6ea', 'rum-hemi-ned': '#a4876a', 'rum-sol': '#ffe7c4', 'rum-fyll': '#ffd8a8', 'rum-lampa': '#ffcf8f', vald: '#f6c68d', matta: '#b9ad9b', 'rum-sol-styrka': 2.6, 'rum-lampa-styrka': 9, 'rum-exponering': 1 };
const TEMA_MS = 650, KVALL = new THREE.Color('#3e4c6c');
function temaLas() {
  const cs = getComputedStyle(document.documentElement), u = {};
  for (const k in TEMA0) {
    const v = cs.getPropertyValue('--t-3d-' + k).trim();
    u[k] = typeof TEMA0[k] === 'number' ? (Number.isFinite(parseFloat(v)) ? parseFloat(v) : TEMA0[k]) : (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(v) ? v : TEMA0[k]);
  }
  return u;
}
// väggen och mattan är målade texturer: de tonas med materialfärgen (målfärg delat med texturens grundfärg),
// så att mönstret och bruset ligger kvar; i Original blir kvoten exakt 1
const kvot = (mal, bas) => { const m = new THREE.Color(mal), b = new THREE.Color(bas); return new THREE.Color(m.r / b.r, m.g / b.g, m.b / b.b); };
function temaMal(u) {
  const natt = Math.min(1, Math.max(0, 1 - u['rum-sol-styrka'] / 2.6)), C = (x) => new THREE.Color(x), ls = u['rum-lampa-styrka'] / 9;
  return {
    f: { rum: C(u.rum), tak: C(u['rum-tak']), vagg: kvot(u['rum-vagg'], '#efe8dd'), nisch: C(u['rum-nisch']), hu: C(u['rum-hemi-upp']), hn: C(u['rum-hemi-ned']), sol: C(u['rum-sol']), fyll: C(u['rum-fyll']), lampa: C(u['rum-lampa']), vald: C(u.vald), matta: kvot(u.matta, '#b9ad9b'), utsikt: new THREE.Color(1, 1, 1).lerp(KVALL, Math.min(1, natt * 1.3)) },
    n: { sol: u['rum-sol-styrka'], lampa: u['rum-lampa-styrka'], insida: 0.6 * ls, glod: 2.4 * ls, exp: u['rum-exponering'], hemi: 0.55 * (1 - natt * 0.35), bloom: 0.42 + natt * 0.2, env: 0.45 * (1 - natt * 0.5), ljus: 1 - natt * 0.85, natt: Math.min(1, natt * 1.3) }
  };
}
function temaBlanda(a, b, p) {
  const f = {}, n = {}; for (const k in a.f) f[k] = a.f[k].clone().lerp(b.f[k], p); for (const k in a.n) n[k] = a.n[k] + (b.n[k] - a.n[k]) * p;
  return { f, n };
}
function temaSatt(v) {
  const T = S.temaObj, f = v.f, n = v.n;
  S.scen.background.copy(f.rum); S.scen.fog.color.copy(f.rum);
  T.takM.color.copy(f.tak); T.vaggM.color.copy(f.vagg); T.nisch.color.copy(f.nisch); T.mattaM.color.copy(f.matta);
  T.hemi.color.copy(f.hu); T.hemi.groundColor.copy(f.hn); T.hemi.intensity = n.hemi;
  T.sol.color.copy(f.sol); T.sol.intensity = n.sol; T.fyll.color.copy(f.fyll);
  S.lampor.forEach((l) => { l.color.copy(f.lampa); l.intensity = n.lampa; });
  T.insidor.forEach((m) => { m.emissive.copy(f.lampa); m.emissiveIntensity = n.insida; }); M.lampa.emissiveIntensity = n.glod;
  S.valdRing.material.color.copy(f.vald);
  T.utsikt.forEach((m) => m.color.copy(f.utsikt)); T.nattM.opacity = n.natt; T.nattPlan.visible = n.natt > 0.001; T.molnM.opacity = 1 - n.natt * 0.75;
  S.renderer.toneMappingExposure = n.exp; S.bloom.strength = n.bloom; S.scen.environmentIntensity = n.env; TV.ljus = n.ljus;
  S.renderer.shadowMap.needsUpdate = true;
  S.temaNu = v;
}
function temaStart() { const u = temaLas(); S.temaNyckel = JSON.stringify(u); temaSatt(temaMal(u)); }
function temaByt() {
  if (!S || !S.temaNu) return;
  const u = temaLas(), nyckel = JSON.stringify(u); if (nyckel === S.temaNyckel) return; S.temaNyckel = nyckel;
  const till = temaMal(u);
  // syns inte scenen (eller minskad rörelse): direkt till målet, annars en mjuk övertoning i bildrutorna
  if (LUGN || !S.ram || !S.synlig || document.hidden) { S.temaAnim = null; temaSatt(till); starta(); return; }
  S.temaAnim = { fran: S.temaNu, till, t0: performance.now() };
}
function temaSteg() {
  const A = S.temaAnim, x = Math.min(1, Math.max(0, (performance.now() - A.t0) / TEMA_MS)), p = x * x * (3 - 2 * x);
  if (x >= 1) { S.temaAnim = null; temaSatt(A.till); } else temaSatt(temaBlanda(A.fran, A.till, p));
}
function storlek() { if (!S || !S.el) return; const w = S.el.clientWidth, h = S.el.clientHeight; if (!w || !h) return; S.renderer.setSize(w, h, false); S.comp.setSize(w, h); S.kamera.aspect = w / h; const smal = w < 900; S.utzoom = w / h < 1 ? 1 + (1 - w / h) * 0.85 : smal && w / h > 1.3 ? 0.86 : 1; S.kamera.fov = smal ? (w / h < 1 ? 52 : 40) : 34; S.lage = null; S.kamera.setViewOffset(w, h, smal ? 0 : -w * 0.15, smal ? (w / h < 1 ? (w < 600 ? -h * 0.08 : 0) : h * 0.08) : -h * 0.02, w, h); S.kamera.updateProjectionMatrix(); starta(); }
function starta() { if (S && !S.ram && S.synlig && !document.hidden && S.el && S.el.isConnected) { S.klocka.getDelta(); S.ram = requestAnimationFrame(ram); } }
const tmp = new THREE.Vector3();
// platserna sprids symmetriskt runt bordet: närmaste långsidan först, sedan mitt på bortre sidan
// (s = närmaste sidan 0–3, kortändarna 4–5; b = bortre sidan 0–2)
const MONSTER = [[], ['s1'], ['s1', 's2'], ['s1', 'b1', 's2'], ['s0', 's1', 's2', 's3'], ['s0', 's1', 'b1', 's2', 's3'], ['s0', 's1', 'b0', 'b2', 's2', 's3']];
function stolFor(n) { const m = (S.lage && MONSTER[S.lage.knappar.length]) || MONSTER[6], k = m[n]; if (!k) return null; return k[0] === 'b' ? S.bortre[+k[1]] : S.stolar[+k[1]]; }
// knapparna och rektanglarna mäts en gång (vid ny ritning och storleksändring), sedan skrivs bara translate i varje bildruta
function matLage() {
  const rum = S.el.parentElement && S.el.parentElement.querySelector('.motescen__rum'); if (!rum) return null;
  const rr = rum.getBoundingClientRect(), dr = S.el.getBoundingClientRect();
  const knappar = [...rum.querySelectorAll('.bord__plats')];
  knappar.forEach((b) => { b.style.left = '0px'; b.style.top = '0px'; });
  return { rum, knappar, halv: knappar.map((b) => (b.offsetWidth || 44) / 2 + 6), dx: dr.left - rr.left, dy: dr.top - rr.top, dw: dr.width, dh: dr.height, rw: rr.width, sist: [] };
}
function placeraPlatser() {
  if (!S.lage || !S.lage.rum.isConnected) S.lage = matLage(); const L = S.lage; if (!L) return;
  let ut = 0;
  L.knappar.forEach((b, n) => {
    const s = stolFor(n); if (!s) { b.style.display = 'none'; return; }
    tmp.set(s.position.x, 1.25, s.position.z + 0.15).project(S.kamera);
    let x = L.dx + (tmp.x + 1) / 2 * L.dw; const y = L.dy + (1 - tmp.y) / 2 * L.dh;
    // en plats utanför rummet gör att kameran backar lite tills alla får plats; till sist hålls den innanför kanten
    const halv = L.halv[n];
    if (x < halv || x > L.rw - halv) { ut = 1; x = Math.min(L.rw - halv, Math.max(halv, x)); }
    const f = L.sist[n]; if (f && Math.abs(f[0] - x) < 0.5 && Math.abs(f[1] - y) < 0.5) return;
    L.sist[n] = [x, y]; b.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
    const bort = S.bortre.includes(s); if (b._bort !== bort) { b._bort = bort; b.classList.toggle('bord__plats--bortre', bort); }
  });
  if (ut && (S.platsZoom || 1) < 1.15) S.platsZoom = (S.platsZoom || 1) * 1.02;
}
function ram() {
  // S.ram är satt medan bildrutan ritas, så att starta() inifrån (storlek via vakten) inte startar en andra slinga
  S.ram = -1; if (!S.el || !S.el.isConnected || !S.synlig || document.hidden) { S.ram = 0; return; }
  const dt = Math.min(0.05, S.klocka.getDelta()); S.t += LUGN ? 0 : dt; const t = S.t;
  vakt(dt);
  // kameran: en långsam glidning och lite följ-musen, aldrig ryckigt
  S.mus.lerp(S.musMal, 1 - Math.pow(0.02, dt));
  const a = (Math.sin(t * 0.08) - 1) * 0.07 + S.mus.x * 0.1, intro = LUGN ? 1 : 1 - Math.pow(1 - Math.min(1, t / 2.8), 3);
  const rad = (9.4 + (1 - intro) * 5) * (S.utzoom || 1) * (S.platsZoom || 1);
  S.kamera.position.set(Math.sin(a + (1 - intro) * 0.4) * rad + 1.2, 5.3 + (1 - intro) * 2.2 + Math.sin(t * 0.11) * 0.12 - S.mus.y * 0.3, Math.cos(a + (1 - intro) * 0.4) * rad + 2.4);
  S.kamera.lookAt(0.2, 1.35, -0.4);
  S.snurr.rotation.y = t * 0.25;
  S.pendlar.forEach((p, n) => { p.rotation.z = Math.sin(t * 0.9 + n * 1.3) * 0.012; p.rotation.x = Math.cos(t * 0.7 + n) * 0.008; });
  S.molnT.offset.x = (t * 0.006) % 1;
  S.faglar.forEach((x, n) => {
    const q = ((t * 0.045 + x.fas * 0.08) % 1.4) - 0.2, glid = Math.sin(t * 0.7 + n) > 0.2;
    x.f.position.set(-2.5 + q * 10 + Math.sin(n * 2.1) * 0.5, x.y + Math.sin(q * 5 + n) * 0.25, x.z + Math.cos(n) * 0.3);
    x.f.rotation.set(0, 0, Math.sin(q * 5 + n) * 0.12);
    const slag = glid ? 0.15 + Math.sin(t * 2 + n) * 0.05 : Math.sin(t * 13 + n * 1.7) * 0.8;
    x.f.userData.vingar.forEach((w) => { w.led.rotation.x = w.sd * slag; });
    x.f.visible = q > -0.1 && q < 1.15;
  });
  S.granar.forEach((g, n) => { g.rotation.z = Math.sin(t * 0.8 + n) * 0.03; });
  S.vaxter.forEach((v, n) => { v.rotation.z = Math.sin(t * 0.6 + n * 2) * 0.012; v.rotation.x = Math.cos(t * 0.5 + n) * 0.01; });
  S.lapStaplar.forEach((st, n) => { st.scale.y = 0.4 + (Math.sin(t * 0.8 + n * 1.3) * 0.5 + 0.5) * 0.9; });
  S.anga.forEach((x) => { const q = (t * 0.35 + x.fas) % 1; x.m.position.set(x.k.position.x + Math.sin(t * 2 + x.fas * 9) * 0.03 * q, 1.75 + q * 0.5, x.k.position.z + Math.cos(t * 1.7 + x.fas * 7) * 0.03 * q); x.m.scale.setScalar(0.05 + q * 0.16); x.m.material.opacity = Math.sin(q * Math.PI) * 0.32; });
  S.stralar.forEach((s, n) => { s.material.opacity = (0.045 + Math.sin(t * 0.5 + n * 1.7) * 0.02) * TV.ljus; });
  for (let n = 0; n < S.ND; n++) { S.dpos[n * 3 + 1] += Math.sin(t * 0.4 + S.dfas[n]) * 0.0009; S.dpos[n * 3] += Math.cos(t * 0.3 + S.dfas[n]) * 0.0007; }
  S.damm.geometry.attributes.position.needsUpdate = true; S.damm.material.opacity = (0.55 + Math.sin(t * 0.7) * 0.15) * TV.ljus;
  const nu = new Date(), sek = nu.getSeconds() + nu.getMilliseconds() / 1000, min = nu.getMinutes() + sek / 60, tim = (nu.getHours() % 12) + min / 60;
  S.vSek.rotation.z = -sek / 60 * Math.PI * 2; S.vMin.rotation.z = -min / 60 * Math.PI * 2; S.vTim.rotation.z = -tim / 12 * Math.PI * 2;
  // den valda kundens stol vrids lite mot bordet
  if (!S.lage || !S.lage.rum.isConnected) S.lage = matLage();
  const vald = S.lage ? S.lage.knappar.findIndex((b) => b.classList.contains('vald')) : -1;
  const vs = vald >= 0 ? stolFor(vald) : null; if (vs) { S.valdRing.position.x = vs.position.x; S.valdRing.position.z = vs.position.z; S.valdSpot.position.set(vs.position.x, 4.6, vs.position.z * 0.6); S.valdSpot.target.position.set(vs.position.x, 0.6, vs.position.z); }
  S.valdSpot.intensity += ((vs ? 8 : 0) - S.valdSpot.intensity) * (LUGN ? 1 : Math.min(1, dt * 4)); S.valdRing.material.opacity += ((vs ? 0.55 + Math.sin(t * 3) * 0.2 : 0) - S.valdRing.material.opacity) * Math.min(1, dt * 4); S.valdRing.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  S.stolar.concat(S.bortre).forEach((s) => { const mal = s === vs ? Math.sin(t * 1.5) * 0.15 : 0; s.children.forEach((c) => { if (c.position.y > 0.8) c.rotation.y += (mal - c.rotation.y) * Math.min(1, dt * 4); }); });
  if (S.temaAnim) temaSteg();
  if (LUGN || ++S.n % 3 === 0) S.renderer.shadowMap.needsUpdate = true;
  S.comp.render(dt); placeraPlatser();
  // minskad rörelse: en stillbild, som ritas om vid klick och storleksändring
  if (LUGN) { S.ram = 0; return; }
  S.ram = requestAnimationFrame(ram);
}
// enkel bildrutevakt: går det trögt i två sekunder sänks upplösningen och glöden stängs av
function vakt(dt) {
  S.n = S.n || 0; if (S.sankt || LUGN) return; S.vt = (S.vt || 0) + dt; S.vn = (S.vn || 0) + 1;
  if (S.vt < 2) return; const fps = S.vn / S.vt; S.vt = 0; S.vn = 0;
  if (S.t > 3 && fps < 40) { S.sankt = true; S.renderer.setPixelRatio(1); S.bloom.enabled = false; storlek(); }
}
function montera(el) {
  if (!stod) { document.documentElement.classList.add('ingen-webgl'); el.remove(); return; }
  if (!S) bygg();
  S.el = el; el.appendChild(S.renderer.domElement);
  const sek = el.parentElement; if (sek) sek.classList.add('motescen--3d'); const rum = sek && sek.querySelector('.motescen__rum'); if (rum) { rum.classList.add('motescen__rum--3d'); sek.addEventListener('pointermove', (ev) => { const r = sek.getBoundingClientRect(); S.musMal.set((ev.clientX - r.left) / r.width * 2 - 1, (ev.clientY - r.top) / r.height * 2 - 1); }); sek.addEventListener('pointerleave', () => S.musMal.set(0, 0)); }
  S.lage = null; storlek(); starta();
  // fotona på väggen laddas efter första bilden; med minskad rörelse ritas stillbilden om när de är klara
  if (LUGN) [600, 1800].forEach((ms) => setTimeout(starta, ms));
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('klar')));
}
if (IH) {
  const sok = () => { const el = document.querySelector('[data-motesrum3d]:not([data-monterad])'); if (el) { el.setAttribute('data-monterad', ''); montera(el); } };
  new MutationObserver(sok).observe(document.body, { childList: true, subtree: true }); sok();
  // temabytet: attributet data-tema, temamotorns händelser och systemets mörka läge (när man följer systemet)
  const temaLyss = () => queueMicrotask(temaByt);
  new MutationObserver(temaLyss).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  ['ih:tema', 'tema-byte'].forEach((n) => { addEventListener(n, temaLyss); document.addEventListener(n, temaLyss); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', temaLyss);
}
