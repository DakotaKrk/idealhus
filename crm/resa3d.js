/* Legohus CRM – husets resa i 3D (2026-10-29). En diorama med sex stationer längs en väg, från ritning till nyckel:
   1 Ritning & lov (ritbordet: planen ritas, en hologramskiss reser sig, stämpeln slår GODKÄNT), 2 Tillverkning (hallen:
   väggarna reser sig en efter en, svetsgnistor), 3 Grund & mark (grävmaskinen gräver, plattan gjuts, el och vatten
   kommer upp), 4 Leverans & montage (lastbilen kör in, kranen lyfter huset på plats), 5 Slutbesiktning (en ljusring
   skannar huset, bockarna tänds) och 6 Klart (fönstren lyser, nyckeln snurrar, konfetti). Husen byggs ur modellernas
   mått och taktyp. Kameran åker mellan stationerna av sig själv; klick på ett steg flyger dit. Kundernas hus står som
   nålar på sitt steg – klick öppnar projektet. Scenen ritas bara när den syns och fliken är aktiv (datorn ska inte
   lagga), med lägre upplösning på svaga skärmar. three.js r170 ligger lokalt i vendor/three (MIT). */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

const IH = window.IH;
const LUGN = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AVST = 16; // mellan stationerna
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stod = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (x) { return false; } })();
const lerp = THREE.MathUtils.lerp, klamp = THREE.MathUtils.clamp;
const mjuk = (x) => { x = klamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ut = (x) => 1 - Math.pow(1 - klamp(x, 0, 1), 3);

/* Material och texturer -------------------------------------------------------------------------- */
function tex(w, h, rita, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; rita(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const panel = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4038'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { g.fillStyle = `rgba(255,240,220,${0.03 + Math.random() * 0.04})`; g.fillRect(x + 2, 0, 12, h); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 2, h); }
}, [3, 1]);
const M = {
  fasad: () => new THREE.MeshStandardMaterial({ map: panel(), roughness: 0.82, metalness: 0.02 }),
  tak: new THREE.MeshStandardMaterial({ color: '#3a322c', roughness: 0.7, metalness: 0.15 }),
  glas: () => new THREE.MeshStandardMaterial({ color: '#2b2f33', emissive: '#ffb05a', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.6 }),
  ram: new THREE.MeshStandardMaterial({ color: '#c79a62', roughness: 0.5 }),
  tra: new THREE.MeshStandardMaterial({ color: '#d9b083', roughness: 0.7 }),
  betong: new THREE.MeshStandardMaterial({ color: '#b9b3aa', roughness: 0.92 }),
  gul: new THREE.MeshStandardMaterial({ color: '#f0b030', roughness: 0.45, metalness: 0.2 }),
  mork: new THREE.MeshStandardMaterial({ color: '#2d2a27', roughness: 0.6, metalness: 0.4 }),
  vit: new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: 0.55 }),
  koppar: new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.35, metalness: 0.75 }),
  neon: (f, s = 2.4) => new THREE.MeshStandardMaterial({ color: f, emissive: f, emissiveIntensity: s, roughness: 0.4 }),
};
const lada = (w, h, d, mat, r = 0.06) => { const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
const cyl = (r1, r2, h, mat, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = m.receiveShadow = true; return m; };
const grupp = (...barn) => { const g = new THREE.Group(); barn.forEach((b) => b && g.add(b)); return g; };

/* Huset ur modellens mått och taktyp ------------------------------------------------------------- */
function matt(m) {
  const t = String((m && m.matt) || '7,5 × 4 m').replace(/,/g, '.').match(/([\d.]+)\s*×\s*([\d.]+)/);
  let w = t ? +t[1] : 7.5, d = t ? +t[2] : 4; const s = Math.min(1, 6.4 / Math.max(w, d)); w *= s; d *= s;
  const pulpet = /pulpet/i.test((m && m.tak) || ''), vinkel = +(((m && m.tak) || '').match(/(\d+)°/) || [0, 27])[1];
  return { w, d, pulpet, vinkel: pulpet ? 4 : klamp(vinkel, 18, 40) };
}
function hus(m, opt = {}) {
  const { w, d, pulpet, vinkel } = matt(m), hv = 2.5, g = new THREE.Group();
  const fasad = M.fasad(); fasad.map.repeat.set(w / 2.4, 1);
  const kropp = lada(w, hv, d, fasad, 0.04); kropp.position.y = hv / 2; g.add(kropp);
  const glas = M.glas(); g.userData.glas = glas;
  // fönster och dörr på framsidan (+z) och en gavel
  const f = (x, y, bw, bh, z = d / 2 + 0.03, rot = 0) => { const r = lada(bw + 0.12, bh + 0.12, 0.06, M.ram, 0.02), p = lada(bw, bh, 0.07, glas, 0); const q = grupp(r, p); q.position.set(x, y, z); q.rotation.y = rot; g.add(q); };
  f(-w * 0.28, 1.35, w * 0.26, 1.5); f(w * 0.08, 1.15, 0.9, 2.0); f(w * 0.32, 1.45, w * 0.16, 0.9);
  f(0, 1.4, d * 0.45, 1.0, 0, Math.PI / 2); g.children[g.children.length - 1].position.set(w / 2 + 0.03, 1.4, 0);
  // taket
  if (pulpet) {
    const tak = lada(w + 0.5, 0.16, d + 0.6, M.tak, 0.03); tak.position.y = hv + 0.2; tak.rotation.x = THREE.MathUtils.degToRad(vinkel); g.add(tak);
    const lis = lada(w + 0.5, 0.06, 0.08, M.koppar, 0.01); lis.position.set(0, hv + 0.16, d / 2 + 0.3); g.add(lis);
  } else {
    const a = THREE.MathUtils.degToRad(vinkel), rh = Math.tan(a) * (w / 2), lang = Math.hypot(w / 2, rh) + 0.35;
    const gavel = new THREE.Shape(); gavel.moveTo(-w / 2, 0); gavel.lineTo(w / 2, 0); gavel.lineTo(0, rh); gavel.closePath();
    const gg = new THREE.ExtrudeGeometry(gavel, { depth: d, bevelEnabled: false }); gg.translate(0, 0, -d / 2);
    const gm = new THREE.Mesh(gg, fasad); gm.position.y = hv; gm.castShadow = gm.receiveShadow = true; g.add(gm);
    [-1, 1].forEach((s) => { const p = lada(lang, 0.14, d + 0.5, M.tak, 0.03); p.position.set(s * (w / 4 + 0.02 * s), hv + rh / 2 + 0.07, 0); p.rotation.z = -s * a; g.add(p); });
    const nock = lada(0.14, 0.12, d + 0.5, M.koppar, 0.02); nock.position.set(0, hv + rh + 0.1, 0); g.add(nock);
    g.userData.hojd = hv + rh;
  }
  g.userData.hojd = g.userData.hojd || hv + 0.5; g.userData.w = w; g.userData.d = d;
  if (opt.skugga === false) g.traverse((o) => { o.castShadow = false; });
  return g;
}

/* Stationerna ------------------------------------------------------------------------------------- */
function platta(farg, topp) {
  const g = new THREE.Group();
  const bas = lada(13.2, 1.2, 11.2, new THREE.MeshStandardMaterial({ color: '#e9dcc7', roughness: 0.9 }), 0.4); bas.position.y = -0.6; g.add(bas);
  const yta = lada(12.6, 0.12, 10.6, new THREE.MeshStandardMaterial({ color: farg, roughness: 0.95 }), 0.3); yta.position.y = 0.02; g.add(yta);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 64), M.neon('#e9a25a', 1)); kant.rotation.x = Math.PI / 2; kant.scale.set(6.9, 5.9, 1); kant.position.y = -0.02; g.add(kant);
  g.userData.kant = kant;
  return g;
}
const LOV = ['#7f9a6c', '#8fa877', '#6f8c62'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
const TRAD = [];
function trad(x, z, s = 1) {
  const v = LOV[Math.abs(Math.round(x * 7 + z * 3)) % 3], t = grupp(cyl(0.08 * s, 0.11 * s, 0.9 * s, M.tra, 8));
  t.children[0].position.y = 0.45 * s;
  [[0.72, 1.2, 1.2], [0.54, 1.0, 1.8], [0.34, 0.8, 2.3]].forEach(([r, h, y]) => { const k = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), v); k.position.y = y * s; k.castShadow = k.receiveShadow = true; t.add(k); });
  t.position.set(x, 0, z); t.rotation.y = x + z; t.userData.vaj = Math.random() * 6; TRAD.push(t); return t;
}

/* Detaljerna: buskar, blommor, människor, koner, staket, lyktor, moln, fåglar och bilen ----------- */
function buske(x, z, s = 1) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 * s, 0), LOV[(Math.round(x + z) & 1) + 1]); b.scale.y = 0.75; b.position.set(x, 0.28 * s, z); b.rotation.y = x; b.castShadow = b.receiveShadow = true; return b; }
const BLOM = ['#f3d9b0', '#e9a25a', '#fbf6ee', '#e7a3a0', '#c9b4e0'].map((c) => new THREE.Color(c));
function blommor(n, fri = [4.4, 3.6]) {
  const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n), o = new THREE.Object3D();
  for (let k = 0, f = 0; k < n && f < 2000; f++) { const x = (Math.random() - 0.5) * 12, z = (Math.random() - 0.5) * 10; if (Math.abs(x) < fri[0] && Math.abs(z) < fri[1]) continue; o.position.set(x, 0.12, z); o.scale.setScalar(0.7 + Math.random() * 0.9); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, BLOM[k % BLOM.length]); k++; }
  return m;
}
const HUD = ['#e8c4a0', '#c99b74', '#8d6248'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
function gubbe(klader, hjalm, n = 0, s = 1) {
  const g = new THREE.Group(), kl = new THREE.MeshStandardMaterial({ color: klader, roughness: 0.8 });
  const ben = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 8), new THREE.MeshStandardMaterial({ color: '#3d3833', roughness: 0.8 })); ben.position.y = 0.38;
  const kropp = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.36, 4, 10), kl); kropp.position.y = 0.96;
  const huvud = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), HUD[n % 3]); huvud.position.y = 1.43;
  g.add(ben, kropp, huvud);
  if (hjalm) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gul); h.position.y = 1.47; g.add(h); }
  const arm = (sid) => { const p = new THREE.Group(); p.position.set(sid * 0.26, 1.16, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.36, 3, 6), kl); a.position.y = -0.24; p.add(a); g.add(p); return p; };
  g.userData.v = arm(-1); g.userData.h = arm(1);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(s); return g;
}
const promenera = (gb, t) => { gb.userData.v.rotation.x = Math.sin(t * 7) * 0.55; gb.userData.h.rotation.x = -Math.sin(t * 7) * 0.55; gb.children[0].position.y = 0.38 + Math.abs(Math.sin(t * 7)) * 0.04; };
const vinka = (gb, t, fas = 0, bada) => { gb.userData.h.rotation.z = 2.5 + Math.sin(t * 7 + fas) * 0.35; if (bada) gb.userData.v.rotation.z = -2.5 - Math.sin(t * 7 + fas + 1) * 0.35; };
function kon(x, z) {
  const orange = new THREE.MeshStandardMaterial({ color: '#f07a3a', roughness: 0.5 });
  const k = grupp(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 14), orange), new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.09, 14), M.vit), lada(0.42, 0.05, 0.42, orange, 0.02));
  k.children[0].position.y = 0.33; k.children[1].position.y = 0.36; k.children[2].position.y = 0.05; k.children[0].castShadow = true; k.position.set(x, 0.06, z); return k;
}
function staket(x1, x2, z, lucka) {
  const g = new THREE.Group();
  for (let x = x1; x <= x2 + 0.01; x += 0.42) { if (Math.abs(x - lucka) < 0.7) continue; const p = lada(0.09, 0.62, 0.06, M.vit, 0.02); p.position.set(x, 0.37, z); g.add(p); }
  [0.28, 0.52].forEach((y) => [[x1, lucka - 0.7], [lucka + 0.7, x2]].forEach(([a, b]) => { const r = lada(b - a, 0.06, 0.04, M.vit, 0.01); r.position.set((a + b) / 2, y, z - 0.05); g.add(r); }));
  return g;
}
function plankor(x, z) {
  const g = new THREE.Group(); const pall = lada(1.9, 0.14, 1.1, new THREE.MeshStandardMaterial({ color: '#a8875f', roughness: 0.9 }), 0.02); pall.position.y = 0.13; g.add(pall);
  for (let n = 0; n < 5; n++) for (let k = 0; k < 4; k++) { const p = lada(1.8, 0.12, 0.22, M.tra, 0.02); p.position.set(0, 0.27 + n * 0.13, -0.36 + k * 0.24); g.add(p); }
  g.position.set(x, 0, z); return g;
}
function dekor(st) {
  const lagg = (s, f) => { const gammal = s.userData.tick; s.userData.tick = (t, dt) => { gammal(t, dt); f(t, dt); }; };
  // 1 Ritbordet: arkitekten vid bordet, buskar och blommor
  const ark = gubbe('#3f6aa8', false, 0); ark.position.set(-4.2, 0.06, 1.4); ark.rotation.y = 2.1;
  st[0].add(ark, buske(4.8, -3.4), buske(-5.4, 2.4, 1.2), buske(5.4, 2.8, 0.8), blommor(30, [4.3, 3.2]));
  lagg(st[0], (t) => { ark.userData.h.rotation.x = -1.1 + Math.sin(t * 3) * 0.25; ark.userData.v.rotation.x = -0.3; ark.rotation.y = 2.1 + Math.sin(t * 0.6) * 0.25; });
  // 2 Fabriken: skorsten med rök, plankor och en snickare som går fram och tillbaka
  const sk = cyl(0.32, 0.4, 6.6, M.mork, 16); sk.position.set(4.8, 3.3, -3.6); st[1].add(sk, plankor(4.4, 3.6), plankor(-4.6, 3.4), buske(-5.6, -4.2));
  const rok = [], rokMat = new THREE.MeshStandardMaterial({ color: '#d9d0c4', roughness: 1, transparent: true, flatShading: true, depthWrite: false });
  for (let n = 0; n < 7; n++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), rokMat.clone()); st[1].add(r); rok.push(r); }
  const snick = gubbe('#c98a45', true, 1); st[1].add(snick);
  lagg(st[1], (t) => {
    rok.forEach((r, n) => { const a = (t * 0.18 + n / 7) % 1; r.position.set(4.8 + a * 1.6 + Math.sin(t + n) * 0.2, 6.7 + a * 3.2, -3.6 - a * 0.6); r.scale.setScalar(0.5 + a * 1.6); r.material.opacity = (1 - a) * 0.85; r.rotation.set(t * 0.3 + n, n, 0); });
    snick.position.set(Math.sin(t * 0.45) * 2.4, 0.06, 3.3); snick.rotation.y = Math.cos(t * 0.45) > 0 ? Math.PI / 2 : -Math.PI / 2; promenera(snick, t);
  });
  // 3 Grunden: två byggare och koner
  const b1 = gubbe('#e9a25a', true, 2), b2 = gubbe('#5b7f9e', true, 0); b1.position.set(-2.8, 0.06, 2.6); b2.position.set(3.2, 0.06, -3.6); b2.rotation.y = -0.6;
  st[2].add(b1, b2, kon(-1.6, 4.4), kon(0, 4.4), kon(1.6, 4.4), kon(-5.6, -1), buske(-5.4, 1.6, 0.9));
  lagg(st[2], (t) => { b1.rotation.y = 0.6 + Math.sin(t * 0.8) * 0.4; b1.userData.h.rotation.x = -0.8 + Math.sin(t * 4) * 0.5; b2.userData.v.rotation.x = -1 + Math.sin(t * 5) * 0.3; b2.userData.h.rotation.x = -1 + Math.sin(t * 5 + 1) * 0.3; });
  // 4 Montaget: en som dirigerar kranen, koner och blommor
  const dir = gubbe('#f0b030', true, 1); dir.position.set(-3.4, 0.06, 4.2); dir.rotation.y = 0.4;
  st[3].add(dir, kon(5.6, -3.6), kon(5.6, -2.4), buske(5.4, -4.4), blommor(20, [5.2, 3.8]));
  lagg(st[3], (t) => vinka(dir, t * 0.6, 0, true));
  // 5 Besiktningen: besiktningsmannen går runt huset med sin pärm
  const bes = gubbe('#4a4038', false, 0), parm = lada(0.32, 0.42, 0.05, new THREE.MeshStandardMaterial({ color: '#e9a25a', roughness: 0.5 }), 0.02);
  parm.position.set(0, -0.5, 0.12); bes.userData.v.add(parm); st[4].add(bes, blommor(34, [4.6, 3.6]), buske(-5.6, -1.4), buske(5.6, 0.6, 1.1));
  lagg(st[4], (t) => { const a = t * 0.35; bes.position.set(Math.cos(a) * 4.4, 0.06, -0.8 + Math.sin(a) * 3.2); bes.rotation.y = -a; promenera(bes, t); bes.userData.v.rotation.x = -1.2; });
  // 6 Klart: familjen vinkar vid trappan, staket, brevlåda och rabatter
  const fam = [gubbe('#c98a45', false, 0), gubbe('#7f9a6c', false, 1), gubbe('#e7a3a0', false, 2, 0.62)];
  fam[0].position.set(2, 0.06, 3.4); fam[1].position.set(3.1, 0.06, 3.2); fam[2].position.set(2.6, 0.06, 3.7);
  const bl = grupp(cyl(0.04, 0.04, 0.9, M.mork, 8), lada(0.36, 0.3, 0.5, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5, metalness: 0.3 }), 0.08));
  bl.children[0].position.y = 0.45; bl.children[1].position.y = 0.95; bl.position.set(-0.7, 0.06, 4.7);
  st[5].add(...fam, staket(-6, 6, 4.95, 0.5), bl, blommor(46, [4.4, 3.4]), buske(-3.6, 0.5), buske(3.6, 0.5, 0.9), buske(-2.6, 0.7, 0.7));
  lagg(st[5], (t) => { vinka(fam[0], t, 0); vinka(fam[1], t, 2); vinka(fam[2], t * 1.3, 1, true); fam[2].position.y = 0.06 + Math.abs(Math.sin(t * 4)) * 0.25; });
}
/* Naturen runt resan: mark till horisonten, kullar, berg, skog, sjö med båt, åkrar, stenar, gräs och vindkraftverk */
const HORISONT = '#f1ece0';
function himmel() {
  return tex(16, 512, (g, w, h) => { const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#b7d3e0'); l.addColorStop(0.45, '#dfe9e6'); l.addColorStop(0.75, HORISONT); l.addColorStop(1, HORISONT); g.fillStyle = l; g.fillRect(0, 0, w, h); });
}
function slump(fro) { let s = fro; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function natur(scen) {
  const r = slump(7), SLUT = AVST * 5;
  const fri = (x, z) => z > -7.5 && z < 9.5 && x > -8 && x < SLUT + 8; // stationerna och gången
  // marken: mjukt gräs med fläckar som tonar bort i diset
  const grasTex = tex(256, 256, (g, w, h) => { g.fillStyle = '#d5dbb3'; g.fillRect(0, 0, w, h); for (let n = 0; n < 900; n++) { g.fillStyle = ['rgba(150,175,120,.10)', 'rgba(205,190,150,.10)', 'rgba(255,250,235,.12)'][n % 3]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 0, 7); g.fill(); } }, [160, 160]);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: grasTex, roughness: 1 })); mark.rotation.x = -Math.PI / 2; mark.position.set(SLUT / 2, -0.62, 0); mark.receiveShadow = true; scen.add(mark);
  const gron = ['#9fb487', '#8ea877', '#b1c095', '#a3b98c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  // kullar bakom och berg längst bort
  for (let n = 0; n < 16; n++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), gron[n % 4]); const rad = 14 + r() * 18; k.scale.set(rad * 1.8, rad * 0.2, rad); k.position.set(-60 + n * 15 + r() * 8, -0.6, -78 - r() * 30); k.receiveShadow = true; scen.add(k); }
  const berg = new THREE.MeshStandardMaterial({ color: '#c3cbc6', roughness: 1, flatShading: true }), sno = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.9, flatShading: true });
  for (let n = 0; n < 9; n++) { const h = 26 + r() * 26, rad = 22 + r() * 16, x = -70 + n * 30 + r() * 12, z = -170 - r() * 40; const b = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), berg); b.position.set(x, h / 2 - 1, z); b.rotation.y = r() * 3; scen.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.3, h * 0.3, 7), sno); t.position.set(x, h - 1 - h * 0.15 + 0.2, z); t.rotation.y = b.rotation.y; scen.add(t); }
  // skogen: stammar och kronor som instanser
  const N = 520, stam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 1, 6), M.tra, N), krona = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 2.3, 7), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), N);
  const tonfarg = ['#6f8c62', '#7f9a6c', '#8fa877', '#5f7d57', '#94ad7c'].map((c) => new THREE.Color(c)), o = new THREE.Object3D();
  let k = 0;
  const plantera = (x, z, s) => { if (k >= N || fri(x, z)) return; o.position.set(x, -0.6 + 0.5 * s, z); o.rotation.set(0, 0, 0); o.scale.setScalar(s); o.updateMatrix(); stam.setMatrixAt(k, o.matrix); o.position.y = -0.6 + 1.9 * s; o.rotation.y = r() * 6; o.updateMatrix(); krona.setMatrixAt(k, o.matrix); krona.setColorAt(k, tonfarg[k % 5]); k++; };
  // dunge-vis: grupper av träd bakom, glesare framför, och täta skogar i båda ändarna
  for (let n = 0; n < 30; n++) { const cx = -30 + r() * (SLUT + 60), cz = -18 - r() * 32; const m = 5 + Math.floor(r() * 8); for (let j = 0; j < m; j++) plantera(cx + (r() - 0.5) * 9, cz + (r() - 0.5) * 7, 0.8 + r() * 1.1); }
  for (let n = 0; n < 5; n++) { const cx = n % 2 ? -14 - r() * 8 : SLUT + 14 + r() * 8, cz = 12 + r() * 10; for (let j = 0; j < 4; j++) plantera(cx + (r() - 0.5) * 5, cz + (r() - 0.5) * 4, 0.7 + r() * 0.6); }
  for (let n = 0; n < 160; n++) { const v = n % 2 ? -16 - r() * 30 : SLUT + 16 + r() * 30; plantera(v, -30 + r() * 55, 0.9 + r() * 1.2); }
  stam.count = krona.count = k; stam.castShadow = krona.castShadow = true; krona.receiveShadow = true; scen.add(stam, krona);
  // sjön med strand, brygga, båt och ringar på vattnet
  const sjoX = SLUT * 0.55, sjoZ = -19;
  const strand = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#e9dcbf', roughness: 1 })); strand.rotation.x = -Math.PI / 2; strand.scale.set(15.5, 7.6, 1); strand.position.set(sjoX, -0.6, sjoZ); strand.receiveShadow = true; scen.add(strand);
  const vatten = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#8fbfc9', roughness: 0.12, metalness: 0.15, envMapIntensity: 1.4 })); vatten.rotation.x = -Math.PI / 2; vatten.scale.set(14, 6.4, 1); vatten.position.set(sjoX, -0.57, sjoZ); scen.add(vatten);
  const brygga = grupp(lada(1.2, 0.12, 4.2, M.tra, 0.02)); brygga.children[0].position.y = -0.38; [[-0.5, -1.8], [0.5, -1.8], [-0.5, 0], [0.5, 0], [-0.5, 1.8], [0.5, 1.8]].forEach(([x, z]) => { const p = cyl(0.06, 0.06, 0.6, M.tra, 6); p.position.set(x, -0.6, z); brygga.add(p); }); brygga.position.set(sjoX - 5, 0, sjoZ + 4.6); scen.add(brygga);
  const bat = new THREE.Group(); const skrov = lada(2, 0.4, 0.8, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5 }), 0.18); bat.add(skrov);
  const mast = cyl(0.04, 0.04, 2.4, M.vit, 6); mast.position.y = 1.3; bat.add(mast);
  const segelF = new THREE.Shape(); segelF.moveTo(0, 0); segelF.lineTo(1.1, 0); segelF.lineTo(0, 2); segelF.closePath();
  const segel = new THREE.Mesh(new THREE.ShapeGeometry(segelF), new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.7, side: THREE.DoubleSide })); segel.position.set(0.05, 0.35, 0); bat.add(segel);
  bat.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scen.add(bat);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), ringar = [];
  for (let n = 0; n < 4; n++) { const q = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), ringMat.clone()); q.rotation.x = -Math.PI / 2; q.position.set(sjoX + 4 - n * 3, -0.55, sjoZ - 1 + (n % 2) * 2); scen.add(q); ringar.push(q); }
  // åkrar i fåror framför gången
  [[-14, 14, 10, 6, '#dccb8f'], [SLUT * 0.3, -14, 14, 5, '#c9d49c'], [SLUT + 14, 15, 10, 6, '#e2c995']].forEach(([x, z, w, d, f]) => {
    const akr = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: f, roughness: 1 }), mork = new THREE.MeshStandardMaterial({ color: new THREE.Color(f).multiplyScalar(0.86), roughness: 1 });
    for (let n = 0; n < d / 0.7; n++) { const rad = lada(w, 0.18, 0.4, n % 2 ? mat : mork, 0.08); rad.position.set(0, -0.52, -d / 2 + n * 0.7); rad.receiveShadow = true; akr.add(rad); }
    akr.position.set(x, 0, z); akr.rotation.y = 0.04; scen.add(akr);
  });
  // stenar och gräs
  const stenMat = new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.95, flatShading: true });
  for (let n = 0; n < 40; n++) { const x = -20 + r() * (SLUT + 40), z = -9 - r() * 30; if (fri(x, z)) continue; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + r() * 0.7, 0), stenMat); s.position.set(x, -0.5, z); s.rotation.set(r() * 3, r() * 3, 0); s.scale.y = 0.6; s.castShadow = s.receiveShadow = true; scen.add(s); }
  const NT = 900, tuva = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.5, 4), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), NT); let nt = 0;
  for (let f = 0; f < 4000 && nt < NT; f++) { const x = -18 + r() * (SLUT + 36), z = -14 + r() * 36; if (fri(x, z) && !(z > 8.3 && z < 9.5)) continue; o.position.set(x, -0.42, z); o.rotation.set((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4); o.scale.setScalar(0.7 + r() * 0.9); o.updateMatrix(); tuva.setMatrixAt(nt, o.matrix); tuva.setColorAt(nt, tonfarg[(nt * 7) % 5]); nt++; }
  tuva.count = nt; scen.add(tuva);
  const NB = 420, ang = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), NB);
  for (let n = 0; n < NB; n++) { o.position.set(-16 + r() * (SLUT + 32), -0.5, 9.6 + r() * 14); o.rotation.set(0, 0, 0); o.scale.setScalar(0.6 + r() * 0.9); o.updateMatrix(); ang.setMatrixAt(n, o.matrix); ang.setColorAt(n, BLOM[n % BLOM.length]); }
  scen.add(ang);
  // vindkraftverk på kullarna
  const verk = [];
  [[-10, -70], [SLUT * 0.3, -84], [SLUT * 0.7, -78], [SLUT + 14, -72]].forEach(([x, z], n) => {
    const g = new THREE.Group(), hoj = 11 + (n % 2) * 2; const torn = cyl(0.18, 0.4, hoj, M.vit, 10); torn.position.y = hoj / 2; g.add(torn);
    const nav = new THREE.Group(); nav.position.set(0, hoj, 0.4); g.add(nav); nav.add(lada(0.5, 0.5, 1.1, M.vit, 0.15));
    for (let b = 0; b < 3; b++) { const blad = lada(0.26, 4.6, 0.08, M.vit, 0.04); blad.geometry.translate(0, 2.3, 0); blad.rotation.z = (b * Math.PI * 2) / 3; blad.position.z = 0.6; nav.add(blad); }
    g.position.set(x, 0.5, z); g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scen.add(g); verk.push(nav);
  });
  return (t) => {
    verk.forEach((v, n) => { v.rotation.z = t * (0.7 + n * 0.12); });
    bat.position.set(sjoX + Math.cos(t * 0.12) * 7, -0.38 + Math.sin(t * 1.6) * 0.05, sjoZ + Math.sin(t * 0.12) * 2.6); bat.rotation.y = -t * 0.12 - Math.PI / 2; bat.rotation.z = Math.sin(t * 1.3) * 0.05;
    ringar.forEach((q, n) => { const a = (t * 0.25 + n / 4) % 1; q.scale.setScalar(0.3 + a * 2.4); q.material.opacity = (1 - a) * 0.5; });
    vatten.material.color.setHSL(0.53, 0.3, 0.66 + Math.sin(t * 0.8) * 0.015);
  };
}
function omgivning(scen) {
  const nat = natur(scen);
  // lyktor längs gången
  const lMat = M.neon('#ffd9a0', 1.1);
  for (let x = -6; x < AVST * 5 + 8; x += 8) { const l = grupp(cyl(0.05, 0.07, 1.9, M.mork, 8), new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), lMat)); l.children[0].position.y = 0.95; l.children[1].position.y = 2; l.position.set(x, -0.55, 6.25); scen.add(l); }
  // moln som driver förbi
  const molnMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.92 }), moln = [];
  for (let n = 0; n < 8; n++) {
    const c = new THREE.Group(); [[0, 0, 1.6], [1.5, -0.2, 1.2], [-1.4, -0.3, 1.1], [0.6, 0.6, 1]].forEach(([x, y, r]) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), molnMat); b.position.set(x, y, 0); b.scale.y = 0.7; b.castShadow = true; c.add(b); });
    c.position.set(n * 14 - 10, 15 + (n % 3) * 1.5, -16 + (n % 2) * 6); c.scale.setScalar(0.8 + (n % 3) * 0.25); scen.add(c); moln.push(c);
  }
  // fåglar
  const fMat = new THREE.MeshBasicMaterial({ color: '#4a4038', side: THREE.DoubleSide }), faglar = [];
  for (let n = 0; n < 4; n++) { const f = new THREE.Group(); [-1, 1].forEach((s) => { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), fMat); v.geometry.translate(0.25 * s, 0, 0); f.add(v); }); scen.add(f); faglar.push(f); }
  // Legohus-bilen som kör längs gången
  const bil = new THREE.Group(), lack = new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.35, metalness: 0.2 });
  const kaross = lada(2.4, 0.9, 1.1, lack, 0.22); kaross.position.y = 0.75; bil.add(kaross);
  const rand = lada(2.42, 0.12, 1.12, M.koppar, 0.04); rand.position.y = 0.62; bil.add(rand);
  const ruta = lada(0.08, 0.42, 0.96, M.glas(), 0.02); ruta.position.set(1.17, 0.95, 0); bil.add(ruta);
  const hjul = []; [-0.75, 0.75].forEach((x) => [-0.52, 0.52].forEach((z) => { const h = cyl(0.24, 0.24, 0.16, M.mork, 16); h.rotation.x = Math.PI / 2; h.position.set(x, 0.26, z); bil.add(h); hjul.push(h); }));
  const fram = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.neon('#fff2c9', 2)); fram.position.set(1.2, 0.68, 0.38); const fram2 = fram.clone(); fram2.position.z = -0.38; bil.add(fram, fram2);
  bil.position.set(-12, -0.52, 7.4); scen.add(bil);
  return (t, dt, fokusX) => {
    nat(t);
    moln.forEach((c) => { c.position.x += dt * 0.5; if (c.position.x > AVST * 5 + 24) c.position.x = -24; });
    faglar.forEach((f, n) => { const a = t * 0.32 + n * 0.5; f.position.set(fokusX + Math.cos(a) * (7 + n), 10 + n * 0.6 + Math.sin(t * 0.9 + n) * 0.4, -3 + Math.sin(a) * 5); f.rotation.y = -a; f.children[0].rotation.z = Math.sin(t * 10 + n) * 0.6; f.children[1].rotation.z = -Math.sin(t * 10 + n) * 0.6; });
    bil.position.x += dt * 3.2; if (bil.position.x > AVST * 5 + 14) bil.position.x = -14;
    bil.position.y = -0.52 + Math.abs(Math.sin(t * 9)) * 0.015; hjul.forEach((h) => { h.rotation.y -= dt * 13; });
    lMat.emissiveIntensity = 1 + Math.sin(t * 1.5) * 0.15;
  };
}

function station1(modell) { // Ritning & lov
  const g = platta('#efe6d6', '#7fb6ff');
  const bord = grupp(lada(7, 0.18, 4.4, M.tra, 0.05)); bord.children[0].position.y = 1.5;
  [[-3.2, -1.9], [3.2, -1.9], [-3.2, 1.9], [3.2, 1.9]].forEach(([x, z]) => { const b = cyl(0.07, 0.07, 1.45, M.mork, 8); b.position.set(x, 0.73, z); bord.add(b); });
  bord.rotation.x = -0.12; bord.position.z = -0.6; g.add(bord);
  // ritningen som ritas fram
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const cx = c.getContext('2d');
  const ritTex = new THREE.CanvasTexture(c); ritTex.colorSpace = THREE.SRGBColorSpace;
  const papper = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.75), new THREE.MeshStandardMaterial({ map: ritTex, roughness: 0.8, emissive: '#ffffff', emissiveMap: ritTex, emissiveIntensity: 0.35 }));
  papper.rotation.x = -Math.PI / 2; papper.position.set(0, 1.61, 0); papper.receiveShadow = true; bord.add(papper);
  const linjer = [[120, 120, 900, 120], [900, 120, 900, 520], [900, 520, 120, 520], [120, 520, 120, 120], [480, 120, 480, 520], [120, 330, 480, 330], [620, 520, 620, 380], [620, 380, 900, 380], [250, 520, 330, 520], [700, 120, 790, 120]];
  const ritaPlan = (p) => {
    cx.fillStyle = '#1f4f8f'; cx.fillRect(0, 0, 1024, 640);
    cx.strokeStyle = 'rgba(160,210,255,.18)'; cx.lineWidth = 1; for (let x = 0; x < 1024; x += 32) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 640); cx.stroke(); } for (let y = 0; y < 640; y += 32) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(1024, y); cx.stroke(); }
    cx.strokeStyle = '#dff0ff'; cx.lineWidth = 7; cx.lineCap = 'round';
    const tot = linjer.length * p;
    linjer.forEach((l, n) => { const del = klamp(tot - n, 0, 1); if (!del) return; cx.beginPath(); cx.moveTo(l[0], l[1]); cx.lineTo(lerp(l[0], l[2], del), lerp(l[1], l[3], del)); cx.stroke(); });
    if (p > 0.85) { cx.fillStyle = `rgba(223,240,255,${(p - 0.85) / 0.15})`; cx.font = '600 34px Poppins, sans-serif'; cx.fillText((modell && modell.namn) || 'Huset', 140, 590); cx.fillText(((modell && modell.matt) || ''), 640, 590); }
    ritTex.needsUpdate = true;
  };
  // hologrammet av huset
  const holo = hus(modell, { skugga: false }); const kanter = new THREE.Group();
  holo.traverse((o) => { if (o.isMesh) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), new THREE.LineBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.9 })); l.position.copy(o.position); l.rotation.copy(o.rotation); l.scale.copy(o.scale); kanter.add(l); } });
  kanter.scale.setScalar(0.32); kanter.position.set(0, 1.75, 0); bord.add(kanter);
  // pennan och stämpeln
  const penna = grupp(cyl(0.05, 0.05, 1.1, M.gul, 8), new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), M.mork)); penna.children[1].position.y = -0.63; penna.rotation.z = 0.6; bord.add(penna);
  const stampel = grupp(cyl(0.32, 0.32, 0.18, new THREE.MeshStandardMaterial({ color: '#b8402b', roughness: 0.5 })), cyl(0.08, 0.1, 0.55, M.tra, 10), new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.tra));
  stampel.children[1].position.y = 0.36; stampel.children[2].position.y = 0.7; stampel.position.set(2.2, 3, 0.8); bord.add(stampel);
  const markC = document.createElement('canvas'); markC.width = markC.height = 256; const mk = markC.getContext('2d');
  mk.strokeStyle = '#ff5a3c'; mk.lineWidth = 14; mk.beginPath(); mk.arc(128, 128, 104, 0, 7); mk.stroke(); mk.fillStyle = '#ff5a3c'; mk.font = '800 52px Poppins, sans-serif'; mk.textAlign = 'center'; mk.fillText('LOV', 128, 120); mk.font = '700 30px Poppins, sans-serif'; mk.fillText('GODKÄNT', 128, 164);
  const markTex = new THREE.CanvasTexture(markC); markTex.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: markTex, transparent: true, opacity: 0, depthWrite: false }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(2.2, 1.625, 0.8); bord.add(mark);
  g.add(trad(-5, -4, 0.9), trad(5.2, 3.8, 0.8));
  let senast = -1;
  g.userData.tick = (t) => {
    const p = (t % 9) / 9, r = mjuk(p / 0.55);
    const steg = Math.round(r * 60); if (steg !== senast) { senast = steg; ritaPlan(steg / 60); }
    penna.position.set(lerp(-2.4, 2.2, r) + Math.sin(t * 7) * 0.08, 2.2, lerp(-1, 0.9, (Math.sin(t * 2.3) + 1) / 2));
    kanter.position.y = 1.75 + ut((p - 0.45) / 0.2) * 1.1; kanter.rotation.y = t * 0.6; kanter.visible = p > 0.45;
    kanter.children.forEach((l) => { l.material.opacity = 0.55 + Math.sin(t * 6) * 0.35; });
    const s = klamp((p - 0.7) / 0.08, 0, 1), upp = p > 0.78 ? ut((p - 0.78) / 0.1) : 0;
    stampel.position.y = 3 - Math.sin(s * Math.PI / 2) * 1.38 + upp * 1.38;
    mark.material.opacity = p > 0.76 ? Math.min(1, (p - 0.76) / 0.04) * (p > 0.96 ? (1 - p) / 0.04 : 1) : 0;
  };
  return g;
}
function station2(modell) { // Tillverkning
  const g = platta('#cfc8bd', '#ffb35c');
  const hall = new THREE.Group();
  const golv = lada(11.4, 0.1, 8.6, new THREE.MeshStandardMaterial({ color: '#a39d94', roughness: 0.5, metalness: 0.1 }), 0.05); golv.position.y = 0.12; hall.add(golv);
  [[-5.5, -4.1], [5.5, -4.1], [-5.5, 1.5], [5.5, 1.5], [0, -4.1]].forEach(([x, z]) => { const p = lada(0.25, 5, 0.25, M.mork, 0.03); p.position.set(x, 2.6, z); hall.add(p); });
  for (let n = 0; n < 3; n++) { const tand = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.2, 1.2, 3, 1), new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide })); tand.rotation.set(Math.PI / 2, Math.PI / 6, 0); tand.scale.set(1.9, 2.8, 1); tand.position.set(-3.6 + n * 3.6, 5.6, -1.3); tand.castShadow = true; hall.add(tand); }
  const balk = lada(11.4, 0.28, 0.4, M.gul, 0.04); balk.position.set(0, 4.8, -1.3); hall.add(balk);
  const vagn = grupp(lada(0.8, 0.4, 0.7, M.gul, 0.06), cyl(0.02, 0.02, 1.6, M.mork, 6)); vagn.children[1].position.y = -1; vagn.position.set(0, 4.55, -1.3); hall.add(vagn);
  const lampor = []; [-3.6, 0, 3.6].forEach((x) => { const l = cyl(0.35, 0.5, 0.25, M.neon('#ffd9a0', 1.6), 16); l.position.set(x, 4.3, -1.3); hall.add(l); lampor.push(l); });
  g.add(hall);
  // huset som byggs: stommen och väggarna som reser sig
  const { w, d } = matt(modell);
  const bygge = new THREE.Group(); bygge.position.set(0, 0.17, -1.3); g.add(bygge);
  const stomme = new THREE.Group(); for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) [-d / 2, d / 2].forEach((z) => { const s = lada(0.1, 2.5, 0.1, M.tra, 0); s.position.set(x, 1.25, z); stomme.add(s); }); bygge.add(stomme);
  const fasad = M.fasad(); fasad.map.repeat.set(1.2, 1);
  const vaggar = [[0, d / 2, w, 0], [0, -d / 2, w, 0], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, Math.PI / 2]].map(([x, z, l, r]) => { const v = lada(l, 2.5, 0.16, fasad, 0.02); v.position.set(x, 1.25, z); v.rotation.y = r; bygge.add(v); return v; });
  const tak = lada(w + 0.4, 0.14, d + 0.4, M.tak, 0.03); tak.position.y = 2.6; bygge.add(tak);
  // gnistorna (glöder i bloom)
  const N = 70, pos = new Float32Array(N * 3), fart = [];
  for (let n = 0; n < N; n++) fart.push(new THREE.Vector3());
  const gn = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: '#ffcf6b', size: 0.09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  bygge.add(gn); const kalla = new THREE.Vector3(w / 2, 1.4, d / 2 + 0.1);
  const ljus = new THREE.PointLight('#ffb35c', 0, 6, 2); ljus.position.copy(kalla); bygge.add(ljus);
  g.add(trad(-5.6, 4, 0.8));
  g.userData.tick = (t, dt) => {
    const p = (t % 10) / 10;
    vaggar.forEach((v, n) => { const a = ut((p - 0.08 - n * 0.12) / 0.14); v.position.y = lerp(-1.4, 1.25, a); v.visible = a > 0.01; });
    tak.position.y = lerp(5.5, 2.6, ut((p - 0.6) / 0.15)); tak.visible = p > 0.6;
    vagn.position.x = Math.sin(t * 0.7) * 3.6;
    const svets = p > 0.1 && p < 0.7 && Math.sin(t * 13) > -0.3;
    ljus.intensity = svets ? 6 + Math.random() * 6 : 0;
    for (let n = 0; n < N; n++) {
      if (pos[n * 3 + 1] <= -0.1 || fart[n].lengthSq() === 0) { if (svets) { pos[n * 3] = kalla.x; pos[n * 3 + 1] = kalla.y; pos[n * 3 + 2] = kalla.z; fart[n].set((Math.random() - 0.3) * 2.6, Math.random() * 2.4, (Math.random() - 0.2) * 2.6); } else { pos[n * 3 + 1] = -1; continue; } }
      fart[n].y -= 7 * dt; pos[n * 3] += fart[n].x * dt; pos[n * 3 + 1] += fart[n].y * dt; pos[n * 3 + 2] += fart[n].z * dt;
    }
    gn.geometry.attributes.position.needsUpdate = true;
    lampor.forEach((l, n) => { l.material.emissiveIntensity = 1.5 + Math.sin(t * 2 + n) * 0.25; });
  };
  return g;
}
function station3() { // Grund & mark
  const g = platta('#c9b496', '#7fe0a6');
  const grop = lada(7.4, 0.2, 5, new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 1 }), 0.1); grop.position.set(0.6, 0.05, -0.6); g.add(grop);
  const form = new THREE.Group(); [[0, 2.4, 7, 0], [0, -2.4, 7, 0], [3.5, 0, 4.8, Math.PI / 2], [-3.5, 0, 4.8, Math.PI / 2]].forEach(([x, z, l, r]) => { const b = lada(l, 0.35, 0.08, M.tra, 0.01); b.position.set(x, 0.3, z); b.rotation.y = r; form.add(b); }); form.position.set(0.6, 0, -0.6); g.add(form);
  const platt = lada(6.8, 0.32, 4.6, M.betong, 0.05); platt.position.set(0.6, 0.27, -0.6); g.add(platt);
  const rorF = [['#5fa8ff', -1.6], ['#f0c040', 0], ['#8a8f96', 1.5]].map(([f, x]) => { const r = cyl(0.09, 0.09, 0.8, M.neon(f, 1.2), 10); r.position.set(0.6 + x, 0.2, -0.2); g.add(r); return r; });
  const hog = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.3, 14), new THREE.MeshStandardMaterial({ color: '#7a5f45', roughness: 1 })); hog.position.set(-4.4, 0.65, 3); hog.castShadow = true; g.add(hog);
  // grävmaskinen
  const grav = new THREE.Group(); grav.position.set(4, 0, 3.2); g.add(grav);
  [-0.55, 0.55].forEach((z) => { const b = lada(2, 0.45, 0.42, M.mork, 0.15); b.position.set(0, 0.25, z); grav.add(b); });
  const topp = new THREE.Group(); topp.position.y = 0.55; grav.add(topp);
  const kropp = lada(1.6, 0.8, 1.3, M.gul, 0.12); kropp.position.set(-0.2, 0.4, 0); topp.add(kropp);
  const hytt = lada(0.7, 0.8, 0.9, M.glas(), 0.1); hytt.position.set(0.25, 1.1, 0.15); topp.add(hytt);
  const bom = new THREE.Group(); bom.position.set(0.6, 0.7, 0); topp.add(bom);
  const b1 = lada(1.9, 0.22, 0.24, M.gul, 0.05); b1.position.x = 0.95; bom.add(b1);
  const led = new THREE.Group(); led.position.x = 1.9; bom.add(led);
  const b2 = lada(1.3, 0.18, 0.2, M.gul, 0.05); b2.position.x = 0.65; led.add(b2);
  const skopa = lada(0.45, 0.4, 0.5, M.mork, 0.05); skopa.position.x = 1.3; led.add(skopa);
  g.add(trad(-5, -3.8, 1), trad(-3.8, -4.4, 0.7));
  g.userData.tick = (t) => {
    const p = (t % 10) / 10, c = (t % 3.2) / 3.2;
    topp.rotation.y = Math.PI + 0.6 + Math.sin(t * 0.9) * 0.6;
    bom.rotation.z = 0.35 + Math.sin(c * Math.PI * 2) * 0.35; led.rotation.z = -1 - Math.sin(c * Math.PI * 2 + 1) * 0.5; skopa.rotation.z = Math.sin(c * Math.PI * 2) * 0.6;
    form.visible = p > 0.15; platt.scale.y = Math.max(0.01, ut((p - 0.3) / 0.25)); platt.position.y = 0.11 + platt.scale.y * 0.16;
    rorF.forEach((r, n) => { const a = ut((p - 0.6 - n * 0.07) / 0.1); r.scale.y = Math.max(0.01, a); r.position.y = 0.3 + a * 0.4; r.material.emissiveIntensity = 0.8 + Math.sin(t * 4 + n) * 0.6; });
  };
  return g;
}
function station4(modell) { // Leverans & montage
  const g = platta('#cdd3b4', '#ffcf6b');
  const grund = lada(6.6, 0.4, 4.4, M.betong, 0.05); grund.position.set(-1.2, 0.2, -1.6); g.add(grund);
  const h = hus(modell); g.add(h);
  // lastbilen
  const bil = new THREE.Group(); g.add(bil);
  const hytt = lada(1.6, 1.7, 2.1, new THREE.MeshStandardMaterial({ color: '#e8edf2', roughness: 0.35, metalness: 0.3 }), 0.25); hytt.position.set(4.6, 1.25, 0); bil.add(hytt);
  const ruta = lada(0.1, 0.7, 1.8, M.glas(), 0.02); ruta.position.set(5.42, 1.6, 0); bil.add(ruta);
  const flak = lada(7.4, 0.25, 2.3, M.mork, 0.04); flak.position.set(0.2, 0.75, 0); bil.add(flak);
  [-2.6, -1.6, 0.8, 4.4].forEach((x) => [-1.05, 1.05].forEach((z) => { const h2 = cyl(0.42, 0.42, 0.32, M.mork, 18); h2.rotation.x = Math.PI / 2; h2.position.set(x, 0.42, z); bil.add(h2); }));
  const lampa1 = cyl(0.12, 0.12, 0.05, M.neon('#fff2c9', 3), 12); lampa1.rotation.z = Math.PI / 2; lampa1.position.set(5.43, 0.9, 0.75); bil.add(lampa1);
  const lampa2 = lampa1.clone(); lampa2.position.z = -0.75; bil.add(lampa2);
  // kranen
  const kran = new THREE.Group(); kran.position.set(-5.2, 0, 2.2); g.add(kran);
  const fot = lada(1.4, 0.3, 1.4, M.mork, 0.05); fot.position.y = 0.15; kran.add(fot);
  const mast = lada(0.35, 7.4, 0.35, M.gul, 0.03); mast.position.y = 3.85; kran.add(mast);
  for (let y = 0.6; y < 7.4; y += 0.6) { const s = lada(0.4, 0.04, 0.04, M.mork, 0); s.position.y = y; s.rotation.z = 0.7; kran.add(s); }
  const arm = new THREE.Group(); arm.position.y = 7.6; kran.add(arm);
  const jib = lada(9, 0.3, 0.3, M.gul, 0.03); jib.position.x = 3.3; arm.add(jib);
  const mot = lada(1.4, 0.7, 0.8, M.betong, 0.05); mot.position.x = -1.5; arm.add(mot);
  const topplamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.neon('#ff4a3a', 4)); topplamp.position.set(0, 0.4, 0); arm.add(topplamp);
  const vajer = cyl(0.02, 0.02, 1, M.mork, 6); arm.add(vajer);
  const krok = lada(0.3, 0.3, 0.3, M.gul, 0.05); arm.add(krok);
  const lokalt = new THREE.Vector3();
  g.userData.tick = (t) => {
    const p = (t % 12) / 12;
    // 0–0.25 bilen kör in, 0.25–0.7 kranen lyfter, 0.7–0.85 sätter ner, 0.85–1 bilen kör iväg
    const inX = lerp(-16, 1.4, ut(p / 0.25)), utX = lerp(1.4, 18, mjuk((p - 0.82) / 0.18));
    bil.position.set(p < 0.82 ? inX : utX, 0, 3.4);
    const lyft = mjuk((p - 0.28) / 0.42);
    const fran = new THREE.Vector3(bil.position.x + 0.2, 0.9, 3.4), till = new THREE.Vector3(-1.2, 0.42, -1.6);
    const pa = p < 0.28 ? fran : p < 0.7 ? new THREE.Vector3(lerp(fran.x, till.x, lyft), lerp(fran.y, till.y, lyft) + Math.sin(lyft * Math.PI) * 3.4, lerp(fran.z, till.z, lyft)) : till;
    h.position.copy(pa); h.rotation.y = p < 0.28 ? 0 : p < 0.7 ? Math.sin(lyft * Math.PI) * 0.12 : 0;
    h.userData.glas.emissiveIntensity = p > 0.72 ? 0.9 : 0.25;
    // armen pekar mot huset, vajern hänger ner till taket
    lokalt.set(h.position.x - kran.position.x, 0, h.position.z - kran.position.z);
    arm.rotation.y = -Math.atan2(lokalt.z, lokalt.x); const r = Math.min(7.4, Math.max(1.5, lokalt.length()));
    const topp = h.position.y + (h.userData.hojd || 3) + 0.2; const lang = Math.max(0.3, 7.6 - topp);
    krok.position.set(r, -lang, 0); vajer.position.set(r, -lang / 2, 0); vajer.scale.y = lang; vajer.visible = krok.visible = p < 0.86;
    topplamp.material.emissiveIntensity = Math.sin(t * 5) > 0 ? 5 : 0.4;

  };
  return g;
}
function station5(modell) { // Slutbesiktning
  const g = platta('#cbd5b2', '#9fe7ff');
  const h = hus(modell); h.position.set(0, 0.06, -0.8); g.add(h);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 80), M.neon('#9fe0e8', 1.4)); ring.rotation.x = Math.PI / 2; ring.scale.set(h.userData.w * 0.75, h.userData.d * 0.95, 1); h.add(ring);
  const ljusplan = new THREE.Mesh(new THREE.PlaneGeometry(h.userData.w * 1.5, h.userData.d * 1.9), new THREE.MeshBasicMaterial({ color: '#8ff3ff', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ljusplan.rotation.x = Math.PI / 2; h.add(ljusplan);
  const bock = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#22c46a'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 13; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(36, 66); x.lineTo(56, 86); x.lineTo(94, 44); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bockar = [[-2.5, 3.6, 1.6], [2.6, 3.4, 1.4], [-2.2, 2.4, -2.8], [2.8, 2.6, -2.6], [0, 4.6, 0]].map(([x, y, z]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bock, transparent: true, depthWrite: false })); s.position.set(x, y, z); s.scale.setScalar(0.01); h.add(s); return s; });
  g.add(trad(-5, 3.6, 0.9), trad(5, 3.9, 1.1), trad(5.3, -3.9, 0.8));
  g.userData.tick = (t) => {
    const p = (t % 8) / 8, y = 0.2 + (0.5 - Math.cos(p * Math.PI * 4) / 2) * (h.userData.hojd + 0.4);
    ring.position.y = ljusplan.position.y = y; ring.material.emissiveIntensity = 1.3 + Math.sin(t * 9) * 0.3;
    bockar.forEach((s, n) => { const a = p > 0.12 + n * 0.14 ? ut((p - 0.12 - n * 0.14) / 0.08) : 0; s.scale.setScalar(0.01 + a * 0.75 * (1 + Math.sin(t * 3 + n) * 0.05)); s.material.opacity = p > 0.95 ? (1 - p) / 0.05 : 1; });
  };
  return g;
}
function station6(modell) { // Klart
  const g = platta('#c4d1a8', '#7fffb0');
  const h = hus(modell); h.position.set(0, 0.06, -0.8); h.userData.glas.emissiveIntensity = 0.9; g.add(h);
  const varmt = new THREE.PointLight('#ffb35c', 4, 8, 2); varmt.position.set(0, 1.6, 1.4); g.add(varmt);
  for (let n = 0; n < 5; n++) { const s = lada(0.7, 0.06, 0.5, M.betong, 0.08); s.position.set(0.5 + Math.sin(n) * 0.2, 0.1, 1.7 + n * 0.75); g.add(s); }
  const flagga = grupp(cyl(0.04, 0.04, 3, M.vit, 8), lada(0.9, 0.55, 0.02, M.neon('#ffb35c', 1.4), 0.01)); flagga.children[1].position.set(0.47, 1.2, 0); flagga.position.set(-4.6, 1.5, 1.6); g.add(flagga);
  const nyckel = new THREE.Group(); nyckel.position.set(0, h.userData.hojd + 2, -0.8); g.add(nyckel);
  const ogla = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 14, 40), M.neon('#e9a25a', 0.9)); nyckel.add(ogla);
  const skaft = lada(1.2, 0.16, 0.12, M.neon('#e9a25a', 0.9), 0.04); skaft.position.x = 1.02; nyckel.add(skaft);
  [1.35, 1.6].forEach((x) => { const t2 = lada(0.12, 0.3, 0.12, M.neon('#e9a25a', 0.9), 0.03); t2.position.set(x, -0.18, 0); nyckel.add(t2); });
  const glorie = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); nyckel.add(glorie);
  g.add(trad(-5, -3.6, 1.1), trad(4.8, -3.9, 0.9), trad(5.2, 3.6, 0.8), trad(-4.2, 3.8, 0.7));
  // konfetti
  const N = 60, konf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
  const FARG = ['#e9a25a', '#c98a45', '#f3d9b0', '#a9bf8e', '#fff3e0'].map((f) => new THREE.Color(f));
  const bitar = []; for (let n = 0; n < N; n++) { bitar.push({ x: (Math.random() - 0.5) * 9, y: 6 + Math.random() * 8, z: (Math.random() - 0.5) * 7, v: 0.6 + Math.random() * 1.2, r: Math.random() * 6, s: (Math.random() - 0.5) * 6 }); konf.setColorAt(n, FARG[n % FARG.length]); }
  g.add(konf); const o = new THREE.Object3D();
  g.userData.tick = (t, dt) => {
    nyckel.rotation.y = t * 1.4; nyckel.position.y = h.userData.hojd + 2 + Math.sin(t * 2) * 0.25; glorie.lookAt(nyckel.position.x, nyckel.position.y, 100);
    glorie.material.opacity = 0.1 + Math.sin(t * 3) * 0.05;
    flagga.children[1].rotation.y = Math.sin(t * 3) * 0.25;
    varmt.intensity = 3.6 + Math.sin(t * 1.7) * 0.6;
    bitar.forEach((b, n) => { b.y -= b.v * dt; b.r += b.s * dt; if (b.y < 0.1) { b.y = 6 + Math.random() * 3; } o.position.set(b.x + Math.sin(t + n) * 0.3, b.y, b.z); o.rotation.set(b.r, b.r * 0.7, b.r * 0.3); o.updateMatrix(); konf.setMatrixAt(n, o.matrix); });
    konf.instanceMatrix.needsUpdate = true;
  };
  return g;
}

/* Scenen ------------------------------------------------------------------------------------------ */
let S = null;
function bygg(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scen = new THREE.Scene(); scen.background = himmel(); scen.fog = new THREE.Fog(HORISONT, 70, 140);
  const pmrem = new THREE.PMREMGenerator(renderer); scen.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scen.environmentIntensity = 0.5;
  const kamera = new THREE.PerspectiveCamera(30, 2, 0.5, 200);
  scen.add(new THREE.HemisphereLight('#fff6ea', '#b8a68c', 0.9));
  const sol = new THREE.DirectionalLight('#ffe9cc', 1.5); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
  Object.assign(sol.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 1, far: 110 }); scen.add(sol, sol.target);
  // vägen och den lysande banan genom alla steg
  const vag = lada(AVST * 5 + 30, 0.06, 1.6, new THREE.MeshStandardMaterial({ color: '#e3d2b8', roughness: 0.95 }), 0.03); vag.position.set(AVST * 2.5, -0.55, 7.4); scen.add(vag);
  for (let x = -12; x < AVST * 5 + 14; x += 1.6) { const s = lada(0.5, 0.02, 0.08, new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.9 }), 0); s.position.set(x, -0.5, 7.4); scen.add(s); }
  const banaPunkter = []; for (let n = 0; n <= 5; n++) banaPunkter.push(new THREE.Vector3(n * AVST, 0.2, 5.6));
  const bana = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(banaPunkter), 200, 0.04, 8), M.neon('#e9a25a', 1.2)); scen.add(bana);
  const pulser = []; for (let n = 0; n < 6; n++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.neon('#ffd9a0', 2.2)); scen.add(p); pulser.push(p); }
  const modeller = IH.MODELLER || [];
  const mod = (n) => modeller[n % Math.max(1, modeller.length)];
  const stationer = [station1(mod(1)), station2(mod(2)), station3(), station4(mod(0)), station5(mod(3)), station6(mod(4))];
  stationer.forEach((s, n) => { s.position.x = n * AVST; scen.add(s); });
  dekor(stationer); const omg = omgivning(scen);
  // efterbehandlingen: neonen och fönstren glöder
  const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scen, kamera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.35, 0.4, 1.6); comp.addPass(bloom); comp.addPass(new OutputPass());
  S = { omg, renderer, scen, kamera, sol, comp, bloom, stationer, pulser, el: null, nu: 0, mal: new THREE.Vector3(), mot: new THREE.Vector3(), auto: !LUGN, hel: true, zoom: 1, pan: 0, drag: null, paus: 0, t: 0, synlig: false, ram: 0, klocka: new THREE.Clock() };
  S.mot.set(0, 1.2, 0); S.kamPos = new THREE.Vector3(30, 60, 110);
  renderer.domElement.className = 'resa3d__duk';
  // dra för att panorera när man har zoomat in, nyp eller Ctrl + hjul för att zooma
  const duk = renderer.domElement;
  duk.addEventListener('pointerdown', (ev) => { S.auto = false; S.paus = 0; S.drag = { x: ev.clientX, pan: S.pan }; duk.setPointerCapture(ev.pointerId); uppdateraUi(); });
  duk.addEventListener('pointermove', (ev) => { if (!S.drag || S.hel) return; S.pan = S.drag.pan - (ev.clientX - S.drag.x) / duk.clientWidth * S.halvB * 2; });
  ['pointerup', 'pointercancel'].forEach((t) => duk.addEventListener(t, () => { S.drag = null; }));
  duk.addEventListener('wheel', (ev) => { if (!ev.ctrlKey) return; ev.preventDefault(); zooma(ev.deltaY > 0 ? 1 : -1, 1 + Math.min(0.4, Math.abs(ev.deltaY) / 200)); }, { passive: false });
  new IntersectionObserver((r) => { S.synlig = r[0].isIntersecting; if (S.synlig) starta(); }, { threshold: 0.05 }).observe(renderer.domElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) starta(); });
  addEventListener('resize', storlek);
}
function storlek() {
  if (!S || !S.el) return;
  const w = S.el.clientWidth, h = S.el.clientHeight; if (!w || !h) return;
  S.renderer.setSize(w, h, false); S.comp.setSize(w, h); S.bloom.resolution.set(w / 2, h / 2);
  S.kamera.aspect = w / h; S.kamera.fov = w < 640 ? 40 : 28; S.kamera.updateProjectionMatrix();
}
function ga(n, narma) { S.nu = (n + 6) % 6; S.pan = 0; if (narma) { S.hel = false; S.zoom = 1; } uppdateraUi(); }
// ut (+1) eller in (-1); längst ut visas hela resan
function zooma(rikt, steg = 1.35) {
  if (rikt > 0) { if (S.hel) return; S.zoom *= steg; if (BAS * S.zoom >= S.hela * 0.97) S.hel = true; }
  else if (S.hel) { S.hel = false; S.zoom = S.hela / BAS / steg; } else S.zoom = Math.max(0.55, S.zoom / steg);
  uppdateraUi();
}
function uppdateraUi() {
  if (!S || !S.el) return;
  const steg = IH.PROJSTEG[S.nu], ui = S.el.querySelector('[data-resa-text]');
  if (ui) ui.innerHTML = '<span class="resa3d__nr">' + (S.nu + 1) + '</span><span><small>Steg ' + (S.nu + 1) + ' av 6</small><b>' + e(steg.namn) + '</b><em>' + e(steg.text) + '</em></span>';
  if (ui) { ui.classList.remove('byter'); void ui.offsetWidth; ui.classList.add('byter'); }
  const kn = S.el.querySelector('[data-resa-auto]'); if (kn) { kn.setAttribute('aria-pressed', String(S.auto)); kn.title = S.auto ? 'Pausa resan' : 'Spela resan'; kn.innerHTML = '<svg class="emo-ik" aria-hidden="true"><use href="#i-' + (S.auto ? 'minus-cirkel' : 'film') + '"/></svg>' + (S.auto ? 'Pausa' : 'Spela'); }
  S.el.querySelectorAll('[data-resa-prick]').forEach((p, k) => p.setAttribute('aria-current', String(k === S.nu)));
  const hk = S.el.querySelector('[data-resa-hel]'); if (hk) hk.setAttribute('aria-pressed', String(S.hel));
  const blk = S.el.closest('.prodblock--fabrik'); if (blk) { blk.querySelectorAll('.fabrik__station').forEach((s, k) => { s.classList.toggle('resa-nu', k === S.nu); s.classList.toggle('resa-forbi', k < S.nu); }); const f = blk.querySelector('.fabrik'); if (f) f.style.setProperty('--nu', S.nu); }
}
function nalar() {
  // kundernas hus som nålar på sitt steg
  const lager = S.el.querySelector('[data-resa-nalar]'); if (!lager) return;
  const proj = (IH.db.projekt || []).filter((p) => IH.PROJSTEG.some((s) => s.id === p.steg));
  lager.innerHTML = proj.map((p, n) => {
    const k = IH.kund(p.kund), m = IH.modell && IH.modell(p.modell), i = IH.PROJSTEG.findIndex((s) => s.id === p.steg);
    const sam = proj.filter((q) => q.steg === p.steg), j = sam.indexOf(p);
    return '<button type="button" class="resa3d__nal" data-g="proj-oppna" data-id="' + p.id + '" data-i="' + i + '" data-j="' + j + '" style="--d:' + (n * 0.08) + 's"><img src="' + e(m ? m.tumme : '') + '" alt=""><span><b>' + e(k ? k.namn.split(' ')[0] : 'Projekt') + '</b><small>' + e(m ? m.namn : '') + '</small></span></button>';
  }).join('');
}
const tmp = new THREE.Vector3(), OFF = new THREE.Vector3(-6.5, 17.4, 40.6).normalize(), BAS = 44.6;
function placeraNalar() {
  const w = S.el.clientWidth, h = S.el.clientHeight;
  S.el.querySelectorAll('.resa3d__nal').forEach((b) => {
    const i = +b.dataset.i, j = +b.dataset.j;
    tmp.set(i * AVST - 2.5 + j * 2.8, 6.4 + j * 0.2, -2.5).project(S.kamera);
    const syns = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
    b.style.transform = 'translate(' + ((tmp.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - tmp.y) / 2 * h).toFixed(1) + 'px) translate(-50%,-100%)';
    b.style.opacity = syns ? (i === S.nu ? 1 : 0.55) : 0; b.style.pointerEvents = syns ? '' : 'none';
  });
}
function starta() { if (S && !S.ram && S.synlig && !document.hidden && S.el && S.el.isConnected) { S.klocka.getDelta(); S.ram = requestAnimationFrame(ram); } }
function ram() {
  S.ram = 0;
  if (!S.el || !S.el.isConnected || !S.synlig || document.hidden) return;
  const dt = Math.min(0.05, S.klocka.getDelta()); S.t += LUGN ? dt * 0.35 : dt;
  if (S.auto) { S.paus += dt; if (S.paus > 7) { S.paus = 0; ga(S.nu + 1); } }
  // kameran: hela resan på en gång, eller inzoomad på steget; den glider mjukt och vaggar lite
  const halv = Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(S.kamera.fov / 2)) * S.kamera.aspect));
  S.hela = (AVST * 5 + 13) / 2 / halv;
  const dist = S.hel ? S.hela : klamp(BAS * S.zoom, 20, S.hela), halvB = dist * halv * 0.92; S.halvB = halvB;
  const lo = halvB - 7, hi = AVST * 5 + 7 - halvB;
  const x = S.hel || lo >= hi ? AVST * 2.5 : klamp(S.nu * AVST + S.pan, lo, hi); if (!S.hel && lo < hi) S.pan = x - S.nu * AVST;
  const sv = LUGN ? 0 : Math.sin(S.t * 0.25) * dist * 0.03;
  tmp.set(x - 0.5, 1.6 + dist * 0.06, -0.6); S.mal.copy(OFF).multiplyScalar(dist).add(tmp); S.mal.x += sv; S.mal.y += Math.sin(S.t * 0.3) * 0.5;
  const fart = S.drag ? 0.00001 : 0.0015;
  S.kamPos.lerp(S.mal, 1 - Math.pow(fart, dt));
  S.mot.lerp(tmp, 1 - Math.pow(fart, dt));
  const nu = S.kamPos.distanceTo(S.mot); S.scen.fog.near = nu * 1.4; S.scen.fog.far = nu * 3.2;
  const sk = S.sol.shadow.camera, sb = halvB + 9; if (Math.abs(sk.right - sb) > 0.5) { sk.left = -sb; sk.right = sb; sk.top = sb * 0.7; sk.bottom = -sb * 0.7; sk.updateProjectionMatrix(); }
  S.kamera.position.copy(S.kamPos); S.kamera.lookAt(S.mot);
  S.sol.position.set(S.mot.x + 18, 40, 24); S.sol.target.position.copy(S.mot);
  S.stationer.forEach((s, n) => { if (Math.abs(n * AVST - S.mot.x) < halvB + AVST * 0.6) s.userData.tick(S.t + n * 1.7, dt); s.userData.kant.material.emissiveIntensity = n === S.nu ? 1.4 + Math.sin(S.t * 3) * 0.3 : 0.15; });
  S.pulser.forEach((p, n) => { const a = ((S.t * 0.09 + n / 6) % 1); p.position.set(a * AVST * 5, 0.2, 5.6); p.scale.setScalar(0.7 + Math.sin(S.t * 6 + n) * 0.25); });
  S.omg(S.t, dt, S.mot.x); TRAD.forEach((t) => { t.rotation.z = Math.sin(S.t * 1.2 + t.userData.vaj) * 0.035; });
  S.comp.render(dt);
  placeraNalar();
  S.ram = requestAnimationFrame(ram);
}
function montera(el) {
  if (!stod) { el.remove(); return; }
  if (!S) bygg(el);
  S.el = el;
  el.innerHTML = '<div class="resa3d__lager"><div class="resa3d__text" data-resa-text aria-live="polite"></div>' +
    '<div class="resa3d__nalar" data-resa-nalar></div>' +
    '<div class="resa3d__fot"><button type="button" class="resa3d__pil" data-resa-bak aria-label="Föregående steg"><svg class="emo-ik" aria-hidden="true"><use href="#i-pil-v"/></svg></button>' +
      '<span class="resa3d__prickar">' + IH.PROJSTEG.map((s, n) => '<button type="button" data-resa-prick="' + n + '" title="' + e(s.namn) + '"><i></i><span>' + e(s.kort) + '</span></button>').join('') + '</span>' +
      '<button type="button" class="resa3d__pil" data-resa-fram aria-label="Nästa steg"><svg class="emo-ik" aria-hidden="true"><use href="#i-pil"/></svg></button>' +
      '<button type="button" class="resa3d__auto" data-resa-auto></button></div>' +
    '<div class="resa3d__zoom"><button type="button" class="resa3d__hel" data-resa-hel><svg class="emo-ik" aria-hidden="true"><use href="#i-helskarm"/></svg>Hela resan</button>' +
      '<button type="button" class="resa3d__z" data-resa-zoom="-1" aria-label="Zooma in">+</button><button type="button" class="resa3d__z" data-resa-zoom="1" aria-label="Zooma ut">\u2212</button></div></div>';
  el.prepend(S.renderer.domElement);
  el.addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-resa-prick]'), b = ev.target.closest('[data-resa-bak]'), f = ev.target.closest('[data-resa-fram]'), a = ev.target.closest('[data-resa-auto]');
    if (p || b || f) { S.auto = false; ga(p ? +p.dataset.resaPrick : S.nu + (f ? 1 : -1), true); }
    const z = ev.target.closest('[data-resa-zoom]'), hl = ev.target.closest('[data-resa-hel]');
    if (z) zooma(+z.dataset.resaZoom);
    if (hl) { S.hel = !S.hel; S.zoom = 1; S.pan = 0; uppdateraUi(); }
    if (a) { S.auto = !S.auto; S.paus = 0; uppdateraUi(); }
  });
  const blk = el.closest('.prodblock--fabrik');
  if (blk) blk.querySelectorAll('.fabrik__station').forEach((s, n) => s.addEventListener('click', (ev) => { if (ev.target.closest('button')) return; S.auto = false; ga(n, true); el.scrollIntoView({ block: 'nearest', behavior: LUGN ? 'auto' : 'smooth' }); }));
  nalar(); storlek(); uppdateraUi(); starta();
}
if (IH) {
  const sok = () => { const el = document.querySelector('[data-resa3d]:not([data-monterad])'); if (el) { el.setAttribute('data-monterad', ''); montera(el); } };
  new MutationObserver(sok).observe(document.body, { childList: true, subtree: true });
  sok();
}
