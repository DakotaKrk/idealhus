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
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { clone as kloneSkelett } from '../vendor/three/addons/utils/SkeletonUtils.js';

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
  utsikt: () => tex(1024, 512, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#9fc4dc'); l.addColorStop(0.55, '#e5eef0'); l.addColorStop(0.62, '#f5ead8'); l.addColorStop(1, '#a9b886'); g.fillStyle = l; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.75)'; [[200, 90, 70], [620, 60, 90], [880, 120, 60]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y, r, r * 0.35, 0, 0, 7); g.ellipse(x + r * 0.6, y + 6, r * 0.7, r * 0.3, 0, 0, 7); g.fill(); });
    g.fillStyle = '#b8c3b6'; g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= w; x += 32) g.lineTo(x, 280 - Math.sin(x / 140) * 30 - Math.sin(x / 50) * 6); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    for (let k = 0; k < 80; k++) { const x = Math.random() * w, s = 16 + Math.random() * 34, y = 330 + Math.random() * 90; g.fillStyle = `hsl(${105 + Math.random() * 20}, 22%, ${24 + Math.random() * 14}%)`; g.beginPath(); g.moveTo(x, y - s * 2.4); g.lineTo(x + s * 0.6, y); g.lineTo(x - s * 0.6, y); g.fill(); }
    g.fillStyle = '#2b2622'; g.fillRect(700, 360, 110, 54); g.beginPath(); g.moveTo(690, 362); g.lineTo(755, 318); g.lineTo(820, 362); g.fill(); g.fillStyle = '#ffd18a'; g.fillRect(720, 376, 22, 26); g.fillRect(770, 376, 22, 26);
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
  M.glas = mat({ color: '#d9ecf2', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.18 });
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
function stol(farg) {
  const g = new THREE.Group(), tyg = farg ? mat({ color: farg, roughness: 0.92 }) : M.tyg;
  const sits = lada(0.62, 0.12, 0.6, tyg, 0.06); sits.position.y = 0.92; g.add(sits);
  const rygg = lada(0.6, 0.66, 0.1, tyg, 0.06); rygg.position.set(0, 1.36, -0.28); rygg.rotation.x = -0.12; g.add(rygg);
  const pelare = cyl(0.04, 0.04, 0.6, M.krom); pelare.position.y = 0.58; g.add(pelare);
  for (let n = 0; n < 5; n++) { const a = n * Math.PI * 2 / 5, ben = lada(0.34, 0.04, 0.06, M.svart, 0.02); ben.position.set(Math.cos(a) * 0.17, 0.12, Math.sin(a) * 0.17); ben.rotation.y = -a; g.add(ben); const hj = cyl(0.04, 0.04, 0.04, M.svart, 12); hj.rotation.z = Math.PI / 2; hj.position.set(Math.cos(a) * 0.33, 0.05, Math.sin(a) * 0.33); g.add(hj); }
  [-1, 1].forEach((s) => { const arm = lada(0.06, 0.04, 0.4, M.svart, 0.02); arm.position.set(s * 0.32, 1.12, -0.02); g.add(arm); const st = lada(0.04, 0.2, 0.04, M.svart, 0.01); st.position.set(s * 0.32, 1.02, -0.16); g.add(st); });
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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scen = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scen.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scen.environmentIntensity = 0.45;
  const kamera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);

  // rummet: golv, två väggar, tak-kant, fönsterväggen med utsikt
  const golv = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), mat({ map: T.golv(), roughness: 0.55, metalness: 0.02 })); golv.rotation.x = -Math.PI / 2; golv.receiveShadow = true; scen.add(golv);
  const vaggM = mat({ map: T.vagg(), roughness: 0.95 });
  const bak = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), vaggM); bak.position.set(0, 3, -4.2); bak.receiveShadow = true; scen.add(bak);
  const vanster = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), vaggM); vanster.rotation.y = Math.PI / 2; vanster.position.set(-6.2, 3, 1.8); vanster.receiveShadow = true; scen.add(vanster); const hoger = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), vaggM); hoger.rotation.y = -Math.PI / 2; hoger.position.set(7.6, 3, 1.8); hoger.receiveShadow = true; scen.add(hoger);
  const sockel = lada(16, 0.14, 0.04, M.vit, 0.01); sockel.position.set(0, 0.07, -4.18); scen.add(sockel);
  // fönstret: utsikt, karmar, glas med reflex
  const utsikt = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshBasicMaterial({ map: T.utsikt(), toneMapped: false })); utsikt.position.set(2.4, 2.75, -4.17); scen.add(utsikt);
  const karm = M.svart; [[2.4, 4.4, 6.6, 0.12], [2.4, 1.1, 6.6, 0.12]].forEach(([x, y, w]) => { const k = lada(w, 0.12, 0.14, karm, 0.01); k.position.set(x, y, -4.12); scen.add(k); });
  [-0.9, 0.7, 2.4, 4.1, 5.7].forEach((x) => { const k = lada(0.1, 3.4, 0.14, karm, 0.01); k.position.set(x, 2.75, -4.12); scen.add(k); });
  const fbank = lada(6.8, 0.06, 0.4, M.vit, 0.02); fbank.position.set(2.4, 1.04, -3.98); scen.add(fbank);
  const glas = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), M.glas); glas.position.set(2.4, 2.75, -4.1); scen.add(glas);

  // ljuset: solen genom fönstret, himmelsljus, pendellamporna
  scen.add(new THREE.HemisphereLight('#fff6ea', '#a4876a', 0.55));
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
  const matta = lada(7.6, 0.012, 4.8, mat({ map: tex(256, 256, (g, w, h) => { g.fillStyle = '#b9ad9b'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 2); } g.strokeStyle = 'rgba(80,60,40,.25)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); }, [3, 2]), roughness: 1 }), 0.006); matta.position.set(0, 0.006, 0.1); scen.add(matta);
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
  const stolar = [], STOLPOS = [[-2.2, 2.2, 0.05], [-0.75, 2.25, 0], [0.75, 2.25, 0], [2.2, 2.2, -0.05], [3.6, 0.6, -1.35], [-3.6, 0.6, 1.35]];
  STOLPOS.forEach(([x, z, r], n) => { const s = stol(n % 2 ? null : '#4a423b'); s.position.set(x, 0, z); s.rotation.y = Math.PI + r; scen.add(s); stolar.push(s); kskugga(x, 0.014, z, 1, 1); });
  [[-1.5, -2.2], [0, -2.25], [1.5, -2.2]].forEach(([x, z]) => { const s = stol('#4a423b'); s.position.set(x, 0, z); s.rotation.y = 0.04; scen.add(s); });

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
  const valdRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: '#f6c68d', transparent: true, opacity: 0, depthWrite: false })); valdRing.rotation.x = -Math.PI / 2; valdRing.position.y = 0.02; scen.add(valdRing);
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
  const lampor = [], pendlar = []; [-1.7, 0, 1.7].forEach((x) => {
    const p = new THREE.Group(); p.position.set(x, 5.3, 0); scen.add(p); pendlar.push(p);
    const sladd = cyl(0.006, 0.006, 1.4, M.svart, 6); sladd.position.y = -0.7; p.add(sladd);
    const skarm2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.32, 32, 1, true), mat({ color: '#1f1d1b', roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide })); skarm2.position.y = -1.55; skarm2.castShadow = true; p.add(skarm2);
    const insida = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.31, 32, 1, true), mat({ color: '#f3e6d2', roughness: 0.6, side: THREE.BackSide, emissive: '#ffcf8f', emissiveIntensity: 0.6 })); insida.position.y = -1.55; p.add(insida);
    const glod = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), M.lampa); glod.position.y = -1.68; p.add(glod);
    const l = new THREE.SpotLight('#ffcf8f', 9, 6, 0.75, 0.6, 1.6); l.position.y = -1.7; p.add(l); l.target.position.set(x, 1.5, 0); scen.add(l.target); lampor.push(l);
  });
  // utanför fönstret: moln som driver, fåglar som flyger förbi och granar som vajar
  const molnT = tex(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.85)'; [[120, 90, 80], [420, 60, 110], [760, 110, 90], [960, 70, 60]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y, r, r * 0.32, 0, 0, 7); g.ellipse(x + r * 0.55, y + 8, r * 0.75, r * 0.28, 0, 0, 7); g.ellipse(x - r * 0.5, y + 10, r * 0.6, r * 0.25, 0, 0, 7); g.fill(); }); }, [1, 1]);
  molnT.wrapS = THREE.RepeatWrapping;
  const molnPlan = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: molnT, transparent: true, depthWrite: false, toneMapped: false })); molnPlan.position.set(2.4, 3.75, -4.165); scen.add(molnPlan);
  const fagelM = new THREE.MeshBasicMaterial({ color: '#3b3a3c', side: THREE.DoubleSide }), faglar = [];
  for (let n = 0; n < 4; n++) { const f = new THREE.Group(); [-1, 1].forEach((sd) => { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.025), fagelM); v.geometry.translate(0.045 * sd, 0, 0); f.add(v); }); f.position.z = -4.16; scen.add(f); faglar.push({ f, fas: n * 0.7, y: 3.6 + (n % 2) * 0.25 }); }
  const granar = []; [[-0.6, 0.55], [0.15, 0.7], [1.6, 0.5], [3.3, 0.62], [4.9, 0.58], [5.5, 0.48]].forEach(([x, s2]) => { const gr = new THREE.Group(); gr.position.set(x, 1.6, -4.5); scen.add(gr); [[0.42, 0.9, 0.45], [0.32, 0.7, 0.95], [0.2, 0.5, 1.35]].forEach(([r, h, y]) => { const k = new THREE.Mesh(new THREE.ConeGeometry(r * s2, h * s2, 10), mat({ color: '#4f6b48', roughness: 0.9 })); k.position.y = y * s2; gr.add(k); }); granar.push(gr); });
  // människorna: en riggad figur från Quaternius Universal Animation Library (CC0, modeller/figurer) med färdiga
  // rörelser – presentatören vid whiteboarden pratar och visar, två kollegor sitter vid bordet och pratar
  const figurer = { mixers: [], presentator: null };
  new GLTFLoader().load('../modeller/figurer/mannekang.glb', (gltf) => {
    const klipp = (namn) => gltf.animations.find((a) => a.name === namn);
    const kladd = (rot, kropp, leder) => { rot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const m2 = (o.material.name || '').indexOf('Joint') >= 0 ? leder : kropp; o.material = m2; } }); };
    const ny = (x, z, ry, kropp, leder, rorelse, skala = 1) => {
      const f = kloneSkelett(gltf.scene); kladd(f, kropp, leder);
      const box = new THREE.Box3().setFromObject(f), h = box.max.y - box.min.y || 1, sk = 3.0 / h * skala;
      f.scale.setScalar(sk); f.position.set(x, 0, z); f.rotation.y = ry; scen.add(f);
      const mix = new THREE.AnimationMixer(f), akt = {};
      rorelse.forEach((n) => { const c = klipp(n); if (c) akt[n] = mix.clipAction(c); });
      figurer.mixers.push(mix); return { f, mix, akt };
    };
    const kavaj = mat({ color: '#2f3b4c', roughness: 0.6 }), ledK = mat({ color: '#c98a45', roughness: 0.45, metalness: 0.2 });
    const p = ny(-4.5, -2.95, 1.0, kavaj, ledK, ['Idle_Talking_Loop', 'Interact', 'Idle_Loop']);
    if (p.akt.Idle_Talking_Loop) p.akt.Idle_Talking_Loop.play();
    if (p.akt.Interact) { p.akt.Interact.setLoop(THREE.LoopOnce, 1); p.akt.Interact.clampWhenFinished = true; }
    p.mix.addEventListener('finished', () => { if (p.akt.Interact && p.akt.Idle_Talking_Loop) { p.akt.Idle_Talking_Loop.reset().play(); p.akt.Idle_Talking_Loop.crossFadeFrom(p.akt.Interact, 0.6, true); } });
    figurer.presentator = p;
    // två kollegor sitter på andra sidan bordet
    [[-1.5, -2.25, 0.04, '#7a5c45', 'Sitting_Talking_Loop'], [1.5, -2.25, 0.04, '#5b7f9e', 'Sitting_Idle_Loop']].forEach(([x, z, ry, farg, rorelse], n) => {
      const k = ny(x, z, ry, mat({ color: farg, roughness: 0.65 }), mat({ color: '#e9dccb', roughness: 0.5 }), [rorelse]);
      if (k.akt[rorelse]) { k.akt[rorelse].play(); k.akt[rorelse].time = n * 1.7; }
    });
    if (S) S.figurer = figurer;
  });
  // laptopens staplar växer och krymper som om kalkylen räknas om
  const lapStaplar = []; for (let n = 0; n < 5; n++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.2), new THREE.MeshBasicMaterial({ color: n === 3 ? '#e29a4a' : '#f2d4ab', toneMapped: false })); st.geometry.translate(0, 0.1, 0); st.position.set(-0.13 + n * 0.08, 0.08, 0.014); lock.add(st); lapStaplar.push(st); }


  const comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  comp.addPass(new RenderPass(scen, kamera)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.9); comp.addPass(bloom); comp.addPass(new OutputPass());
  S = { figurer, valdRing, pendlar, molnT, faglar, granar, lapStaplar, vaxter: [lov, vaxt2], renderer, scen, kamera, comp, bloom, stolar, snurr, anga, stralar, damm, dpos, dfas, ND, vTim, vMin, vSek, lampor, el: null, t: 0, ram: 0, synlig: false, mus: new THREE.Vector2(), musMal: new THREE.Vector2(), klocka: new THREE.Clock() };
  renderer.domElement.className = 'motesrum3d__duk';
  new IntersectionObserver((r) => { S.synlig = r[0].isIntersecting; if (S.synlig) starta(); }, { threshold: 0.05 }).observe(renderer.domElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) starta(); });
  addEventListener('resize', storlek);
}
function storlek() { if (!S || !S.el) return; const w = S.el.clientWidth, h = S.el.clientHeight; if (!w || !h) return; S.renderer.setSize(w, h, false); S.comp.setSize(w, h); S.kamera.aspect = w / h; const smal = w < 900; S.kamera.fov = smal ? 44 : 34; S.kamera.setViewOffset(w, h, smal ? 0 : -w * 0.2, smal ? 0 : -h * 0.02, w, h); S.kamera.updateProjectionMatrix(); }
function starta() { if (S && !S.ram && S.synlig && !document.hidden && S.el && S.el.isConnected) { S.klocka.getDelta(); S.ram = requestAnimationFrame(ram); } }
const tmp = new THREE.Vector3();
function placeraPlatser() {
  const rum = S.el.parentElement && S.el.parentElement.querySelector('.motescen__rum'); if (!rum) return;
  const rr = rum.getBoundingClientRect(), dr = S.el.getBoundingClientRect();
  rum.querySelectorAll('.bord__plats').forEach((b, n) => {
    const s = S.stolar[n]; if (!s) { b.style.display = 'none'; return; }
    tmp.set(s.position.x, 1.25, s.position.z + 0.15).project(S.kamera);
    const x = (dr.left - rr.left) + (tmp.x + 1) / 2 * dr.width, y = (dr.top - rr.top) + (1 - tmp.y) / 2 * dr.height;
    b.style.left = (x / rr.width * 100).toFixed(2) + '%'; b.style.top = (y / rr.height * 100).toFixed(2) + '%';
  });
}
function ram() {
  S.ram = 0; if (!S.el || !S.el.isConnected || !S.synlig || document.hidden) return;
  const dt = Math.min(0.05, S.klocka.getDelta()); S.t += LUGN ? dt * 0.3 : dt; const t = S.t;
  // kameran: en långsam glidning och lite följ-musen, aldrig ryckigt
  S.mus.lerp(S.musMal, 1 - Math.pow(0.02, dt));
  const a = Math.sin(t * 0.08) * 0.12 + S.mus.x * 0.12, intro = LUGN ? 1 : 1 - Math.pow(1 - Math.min(1, t / 2.8), 3);
  const rad = 9.4 + (1 - intro) * 5;
  S.kamera.position.set(Math.sin(a + (1 - intro) * 0.4) * rad + 1.2, 5.3 + (1 - intro) * 2.2 + Math.sin(t * 0.11) * 0.12 - S.mus.y * 0.3, Math.cos(a + (1 - intro) * 0.4) * rad + 2.4);
  S.kamera.lookAt(0.2, 1.35, -0.4);
  S.snurr.rotation.y = t * 0.25;
  S.pendlar.forEach((p, n) => { p.rotation.z = Math.sin(t * 0.9 + n * 1.3) * 0.012; p.rotation.x = Math.cos(t * 0.7 + n) * 0.008; });
  S.molnT.offset.x = (t * 0.006) % 1;
  S.faglar.forEach((x, n) => { const q = ((t * 0.07 + x.fas) % 1.6) - 0.2; x.f.position.set(-0.8 + q * 5.6, x.y + Math.sin(q * 6 + n) * 0.08, -4.16); const v = Math.sin(t * 12 + n) * 0.7; x.f.children[0].rotation.y = v; x.f.children[1].rotation.y = -v; x.f.visible = q > 0 && q < 1.25; });
  S.granar.forEach((g, n) => { g.rotation.z = Math.sin(t * 0.8 + n) * 0.03; });
  S.vaxter.forEach((v, n) => { v.rotation.z = Math.sin(t * 0.6 + n * 2) * 0.012; v.rotation.x = Math.cos(t * 0.5 + n) * 0.01; });
  // figurerna: rörelserna spelas av mixern; presentatören visar på whiteboarden med jämna mellanrum
  S.figurer.mixers.forEach((m) => m.update(dt));
  const pr = S.figurer.presentator;
  if (pr && pr.akt.Interact && !LUGN) { pr.nasta = (pr.nasta || 6) - dt; if (pr.nasta <= 0) { pr.nasta = 9 + Math.random() * 5; pr.akt.Interact.reset().play(); pr.akt.Interact.crossFadeFrom(pr.akt.Idle_Talking_Loop, 0.5, true); } }
  S.lapStaplar.forEach((st, n) => { st.scale.y = 0.4 + (Math.sin(t * 0.8 + n * 1.3) * 0.5 + 0.5) * 0.9; });
  S.anga.forEach((x) => { const q = (t * 0.35 + x.fas) % 1; x.m.position.set(x.k.position.x + Math.sin(t * 2 + x.fas * 9) * 0.03 * q, 1.75 + q * 0.5, x.k.position.z + Math.cos(t * 1.7 + x.fas * 7) * 0.03 * q); x.m.scale.setScalar(0.05 + q * 0.16); x.m.material.opacity = Math.sin(q * Math.PI) * 0.32; });
  S.stralar.forEach((s, n) => { s.material.opacity = 0.045 + Math.sin(t * 0.5 + n * 1.7) * 0.02; });
  for (let n = 0; n < S.ND; n++) { S.dpos[n * 3 + 1] += Math.sin(t * 0.4 + S.dfas[n]) * 0.0009; S.dpos[n * 3] += Math.cos(t * 0.3 + S.dfas[n]) * 0.0007; }
  S.damm.geometry.attributes.position.needsUpdate = true; S.damm.material.opacity = 0.55 + Math.sin(t * 0.7) * 0.15;
  const nu = new Date(), sek = nu.getSeconds() + nu.getMilliseconds() / 1000, min = nu.getMinutes() + sek / 60, tim = (nu.getHours() % 12) + min / 60;
  S.vSek.rotation.z = -sek / 60 * Math.PI * 2; S.vMin.rotation.z = -min / 60 * Math.PI * 2; S.vTim.rotation.z = -tim / 12 * Math.PI * 2;
  // den valda kundens stol vrids lite mot bordet
  const rumEl = S.el.parentElement && S.el.parentElement.querySelector('.motescen__rum'), vald = rumEl ? [...rumEl.querySelectorAll('.bord__plats')].findIndex((b) => b.classList.contains('vald')) : -1;
  const vs = vald >= 0 ? S.stolar[vald] : null; if (vs) { S.valdRing.position.x = vs.position.x; S.valdRing.position.z = vs.position.z; } S.valdRing.material.opacity += ((vs ? 0.55 + Math.sin(t * 3) * 0.2 : 0) - S.valdRing.material.opacity) * Math.min(1, dt * 4); S.valdRing.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  S.stolar.forEach((s, n) => { const mal = n === vald ? Math.sin(t * 1.5) * 0.15 : 0; s.children.forEach((c) => { if (c.position.y > 0.8) c.rotation.y += (mal - c.rotation.y) * Math.min(1, dt * 4); }); });
  S.comp.render(dt); placeraPlatser();
  S.ram = requestAnimationFrame(ram);
}
function montera(el) {
  if (!stod) { document.documentElement.classList.add('ingen-webgl'); el.remove(); return; }
  if (!S) bygg();
  S.el = el; el.appendChild(S.renderer.domElement);
  const sek = el.parentElement; if (sek) sek.classList.add('motescen--3d'); const rum = sek && sek.querySelector('.motescen__rum'); if (rum) { rum.classList.add('motescen__rum--3d'); sek.addEventListener('pointermove', (ev) => { const r = sek.getBoundingClientRect(); S.musMal.set((ev.clientX - r.left) / r.width * 2 - 1, (ev.clientY - r.top) / r.height * 2 - 1); }); sek.addEventListener('pointerleave', () => S.musMal.set(0, 0)); }
  storlek(); starta();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('klar')));
}
if (IH) {
  const sok = () => { const el = document.querySelector('[data-motesrum3d]:not([data-monterad])'); if (el) { el.setAttribute('data-monterad', ''); montera(el); } };
  new MutationObserver(sok).observe(document.body, { childList: true, subtree: true }); sok();
}
