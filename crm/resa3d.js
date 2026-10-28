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
  g.fillStyle = '#26221f'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { g.fillStyle = `rgba(255,240,220,${0.03 + Math.random() * 0.04})`; g.fillRect(x + 2, 0, 12, h); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 2, h); }
}, [3, 1]);
const M = {
  fasad: () => new THREE.MeshStandardMaterial({ map: panel(), roughness: 0.82, metalness: 0.02 }),
  tak: new THREE.MeshStandardMaterial({ color: '#1a1816', roughness: 0.6, metalness: 0.25 }),
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
  const kant = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 64), M.neon(topp, 3)); kant.rotation.x = Math.PI / 2; kant.scale.set(6.9, 5.9, 1); kant.position.y = -0.02; g.add(kant);
  g.userData.kant = kant;
  return g;
}
function trad(x, z, s = 1) {
  const t = grupp(cyl(0.08 * s, 0.11 * s, 0.9 * s, M.tra, 8), new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.7 * s, 9), new THREE.MeshStandardMaterial({ color: '#4f7a4a', roughness: 0.9 })));
  t.children[0].position.y = 0.45 * s; t.children[1].position.y = 1.55 * s; t.children[1].castShadow = true; t.position.set(x, 0, z); return t;
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
  const g = platta('#8a6f52', '#7fe0a6');
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
  const g = platta('#9fb07d', '#ffcf6b');
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
  const g = platta('#a7c591', '#9fe7ff');
  const h = hus(modell); h.position.set(0, 0.06, -0.8); g.add(h);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 80), M.neon('#8ff3ff', 4)); ring.rotation.x = Math.PI / 2; ring.scale.set(h.userData.w * 0.75, h.userData.d * 0.95, 1); h.add(ring);
  const ljusplan = new THREE.Mesh(new THREE.PlaneGeometry(h.userData.w * 1.5, h.userData.d * 1.9), new THREE.MeshBasicMaterial({ color: '#8ff3ff', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ljusplan.rotation.x = Math.PI / 2; h.add(ljusplan);
  const bock = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#22c46a'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 13; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(36, 66); x.lineTo(56, 86); x.lineTo(94, 44); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const bockar = [[-2.5, 3.6, 1.6], [2.6, 3.4, 1.4], [-2.2, 2.4, -2.8], [2.8, 2.6, -2.6], [0, 4.6, 0]].map(([x, y, z]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bock, transparent: true, depthWrite: false })); s.position.set(x, y, z); s.scale.setScalar(0.01); h.add(s); return s; });
  g.add(trad(-5, 3.6, 0.9), trad(5, 3.9, 1.1), trad(5.3, -3.9, 0.8));
  g.userData.tick = (t) => {
    const p = (t % 8) / 8, y = 0.2 + (0.5 - Math.cos(p * Math.PI * 4) / 2) * (h.userData.hojd + 0.4);
    ring.position.y = ljusplan.position.y = y; ring.material.emissiveIntensity = 3 + Math.sin(t * 9) * 1.2;
    bockar.forEach((s, n) => { const a = p > 0.12 + n * 0.14 ? ut((p - 0.12 - n * 0.14) / 0.08) : 0; s.scale.setScalar(0.01 + a * 0.75 * (1 + Math.sin(t * 3 + n) * 0.05)); s.material.opacity = p > 0.95 ? (1 - p) / 0.05 : 1; });
  };
  return g;
}
function station6(modell) { // Klart
  const g = platta('#8fbf74', '#7fffb0');
  const h = hus(modell); h.position.set(0, 0.06, -0.8); h.userData.glas.emissiveIntensity = 1.6; g.add(h);
  const varmt = new THREE.PointLight('#ffb35c', 8, 9, 2); varmt.position.set(0, 1.6, 1.4); g.add(varmt);
  for (let n = 0; n < 5; n++) { const s = lada(0.7, 0.06, 0.5, M.betong, 0.08); s.position.set(0.5 + Math.sin(n) * 0.2, 0.1, 1.7 + n * 0.75); g.add(s); }
  const flagga = grupp(cyl(0.04, 0.04, 3, M.vit, 8), lada(0.9, 0.55, 0.02, M.neon('#ffb35c', 1.4), 0.01)); flagga.children[1].position.set(0.47, 1.2, 0); flagga.position.set(-4.6, 1.5, 1.6); g.add(flagga);
  const nyckel = new THREE.Group(); nyckel.position.set(0, h.userData.hojd + 2, -0.8); g.add(nyckel);
  const ogla = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 14, 40), M.neon('#ffc46b', 2.2)); nyckel.add(ogla);
  const skaft = lada(1.2, 0.16, 0.12, M.neon('#ffc46b', 2.2), 0.04); skaft.position.x = 1.02; nyckel.add(skaft);
  [1.35, 1.6].forEach((x) => { const t2 = lada(0.12, 0.3, 0.12, M.neon('#ffc46b', 2.2), 0.03); t2.position.set(x, -0.18, 0); nyckel.add(t2); });
  const glorie = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); nyckel.add(glorie);
  g.add(trad(-5, -3.6, 1.1), trad(4.8, -3.9, 0.9), trad(5.2, 3.6, 0.8), trad(-4.2, 3.8, 0.7));
  // konfetti
  const N = 140, konf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
  const FARG = ['#ffb35c', '#7fffb0', '#8fd0ff', '#ff7aa8', '#ffe27a'].map((f) => new THREE.Color(f));
  const bitar = []; for (let n = 0; n < N; n++) { bitar.push({ x: (Math.random() - 0.5) * 9, y: 6 + Math.random() * 8, z: (Math.random() - 0.5) * 7, v: 0.6 + Math.random() * 1.2, r: Math.random() * 6, s: (Math.random() - 0.5) * 6 }); konf.setColorAt(n, FARG[n % FARG.length]); }
  g.add(konf); const o = new THREE.Object3D();
  g.userData.tick = (t, dt) => {
    nyckel.rotation.y = t * 1.4; nyckel.position.y = h.userData.hojd + 2 + Math.sin(t * 2) * 0.25; glorie.lookAt(nyckel.position.x, nyckel.position.y, 100);
    glorie.material.opacity = 0.2 + Math.sin(t * 3) * 0.1;
    flagga.children[1].rotation.y = Math.sin(t * 3) * 0.25;
    varmt.intensity = 7 + Math.sin(t * 1.7) * 1.2;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scen = new THREE.Scene(); scen.background = new THREE.Color('#f3e9da'); scen.fog = new THREE.Fog('#f3e9da', 46, 95);
  const pmrem = new THREE.PMREMGenerator(renderer); scen.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scen.environmentIntensity = 0.3;
  const kamera = new THREE.PerspectiveCamera(30, 2, 0.5, 200);
  scen.add(new THREE.HemisphereLight('#fff3e0', '#6d5f4c', 0.5));
  const sol = new THREE.DirectionalLight('#ffe2b8', 1.7); sol.castShadow = true; sol.shadow.mapSize.set(1536, 1536); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
  Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 }); scen.add(sol, sol.target);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshStandardMaterial({ color: '#efe3cf', roughness: 1 })); mark.rotation.x = -Math.PI / 2; mark.position.y = -1.2; mark.receiveShadow = true; scen.add(mark);
  // vägen och den lysande banan genom alla steg
  const vag = lada(AVST * 5 + 30, 0.08, 2.4, new THREE.MeshStandardMaterial({ color: '#4a4541', roughness: 0.85 }), 0.04); vag.position.set(AVST * 2.5, 0.02, 7.2); scen.add(vag);
  for (let x = -12; x < AVST * 5 + 14; x += 1.6) { const s = lada(0.8, 0.02, 0.1, new THREE.MeshBasicMaterial({ color: '#f6e7c8' }), 0); s.position.set(x, 0.07, 7.2); scen.add(s); }
  const banaPunkter = []; for (let n = 0; n <= 5; n++) banaPunkter.push(new THREE.Vector3(n * AVST, 0.2, 5.6));
  const bana = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(banaPunkter), 200, 0.06, 8), M.neon('#ffb35c', 2.6)); scen.add(bana);
  const pulser = []; for (let n = 0; n < 6; n++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.neon('#ffe2a8', 6)); scen.add(p); pulser.push(p); }
  const modeller = IH.MODELLER || [];
  const mod = (n) => modeller[n % Math.max(1, modeller.length)];
  const stationer = [station1(mod(1)), station2(mod(2)), station3(), station4(mod(0)), station5(mod(3)), station6(mod(4))];
  stationer.forEach((s, n) => { s.position.x = n * AVST; scen.add(s); });
  // efterbehandlingen: neonen och fönstren glöder
  const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scen, kamera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.9, 0.55, 1.35); comp.addPass(bloom); comp.addPass(new OutputPass());
  S = { renderer, scen, kamera, sol, comp, bloom, stationer, pulser, el: null, nu: 0, mal: new THREE.Vector3(), mot: new THREE.Vector3(), auto: !LUGN, paus: 0, t: 0, synlig: false, ram: 0, klocka: new THREE.Clock() };
  S.mot.set(0, 1.2, 0); S.kamPos = new THREE.Vector3(-8, 13, 26);
  renderer.domElement.className = 'resa3d__duk';
  renderer.domElement.addEventListener('pointerdown', () => { S.auto = false; S.paus = 0; uppdateraUi(); });
  new IntersectionObserver((r) => { S.synlig = r[0].isIntersecting; if (S.synlig) starta(); }, { threshold: 0.05 }).observe(renderer.domElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) starta(); });
  addEventListener('resize', storlek);
}
function storlek() {
  if (!S || !S.el) return;
  const w = S.el.clientWidth, h = S.el.clientHeight; if (!w || !h) return;
  S.renderer.setSize(w, h, false); S.comp.setSize(w, h); S.bloom.resolution.set(w / 2, h / 2);
  S.kamera.aspect = w / h; S.kamera.fov = w < 640 ? 42 : 30; S.kamera.updateProjectionMatrix();
}
function ga(n) { S.nu = (n + 6) % 6; uppdateraUi(); }
function uppdateraUi() {
  if (!S || !S.el) return;
  const steg = IH.PROJSTEG[S.nu], ui = S.el.querySelector('[data-resa-text]');
  if (ui) ui.innerHTML = '<span class="resa3d__nr">' + (S.nu + 1) + '</span><span><small>Steg ' + (S.nu + 1) + ' av 6</small><b>' + e(steg.namn) + '</b><em>' + e(steg.text) + '</em></span>';
  if (ui) { ui.classList.remove('byter'); void ui.offsetWidth; ui.classList.add('byter'); }
  const kn = S.el.querySelector('[data-resa-auto]'); if (kn) { kn.setAttribute('aria-pressed', String(S.auto)); kn.title = S.auto ? 'Pausa resan' : 'Spela resan'; kn.innerHTML = '<svg class="emo-ik" aria-hidden="true"><use href="#i-' + (S.auto ? 'minus-cirkel' : 'film') + '"/></svg>' + (S.auto ? 'Pausa' : 'Spela'); }
  S.el.querySelectorAll('[data-resa-prick]').forEach((p, k) => p.setAttribute('aria-current', String(k === S.nu)));
  const blk = S.el.closest('.prodblock--fabrik'); if (blk) blk.querySelectorAll('.fabrik__station').forEach((s, k) => s.classList.toggle('resa-nu', k === S.nu));
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
const tmp = new THREE.Vector3();
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
  // kameran glider mot steget och vaggar lite
  const x = S.nu * AVST, sv = LUGN ? 0 : Math.sin(S.t * 0.25) * 2.2;
  S.mal.set(x - 7 + sv, 14 + Math.sin(S.t * 0.3) * 0.6, 26.5);
  S.kamPos.lerp(S.mal, 1 - Math.pow(0.0015, dt));
  S.mot.lerp(tmp.set(x - 1.2, 0.6, -0.2), 1 - Math.pow(0.002, dt));
  S.kamera.position.copy(S.kamPos); S.kamera.lookAt(S.mot);
  S.sol.position.set(S.mot.x + 9, 18, 12); S.sol.target.position.copy(S.mot);
  S.stationer.forEach((s, n) => { if (Math.abs(n * AVST - S.mot.x) < AVST * 1.6) s.userData.tick(S.t + n * 1.7, dt); s.userData.kant.material.emissiveIntensity = n === S.nu ? 3.4 + Math.sin(S.t * 4) * 0.8 : 0.6; });
  S.pulser.forEach((p, n) => { const a = ((S.t * 0.09 + n / 6) % 1); p.position.set(a * AVST * 5, 0.2, 5.6); p.scale.setScalar(0.7 + Math.sin(S.t * 6 + n) * 0.25); });
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
      '<button type="button" class="resa3d__auto" data-resa-auto></button></div></div>';
  el.prepend(S.renderer.domElement);
  el.addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-resa-prick]'), b = ev.target.closest('[data-resa-bak]'), f = ev.target.closest('[data-resa-fram]'), a = ev.target.closest('[data-resa-auto]');
    if (p || b || f) { S.auto = false; ga(p ? +p.dataset.resaPrick : S.nu + (f ? 1 : -1)); }
    if (a) { S.auto = !S.auto; S.paus = 0; uppdateraUi(); }
  });
  const blk = el.closest('.prodblock--fabrik');
  if (blk) blk.querySelectorAll('.fabrik__station').forEach((s, n) => s.addEventListener('click', (ev) => { if (ev.target.closest('button')) return; S.auto = false; ga(n); el.scrollIntoView({ block: 'nearest', behavior: LUGN ? 'auto' : 'smooth' }); }));
  nalar(); storlek(); uppdateraUi(); starta();
}
if (IH) {
  const sok = () => { const el = document.querySelector('[data-resa3d]:not([data-monterad])'); if (el) { el.setAttribute('data-monterad', ''); montera(el); } };
  new MutationObserver(sok).observe(document.body, { childList: true, subtree: true });
  sok();
}
