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
// WebGL-provet görs först när en scen ska monteras, och provkontexten släpps direkt
let stodV = null;
const harWebgl = () => { if (stodV === null) { try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); stodV = !!gl; const lx = gl && gl.getExtension('WEBGL_lose_context'); if (lx) lx.loseContext(); } catch (x) { stodV = false; } } return stodV; };
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
const panel = () => tex(512, 256, (g, w, h) => {
  g.fillStyle = '#3d3530'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    const l = 50 + Math.random() * 14; g.fillStyle = `hsl(24, 13%, ${l / 4}%)`; g.fillRect(x, 0, 32, h);
    const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,235,210,.10)'); gr.addColorStop(0.5, 'rgba(255,235,210,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(x, 0, 32, h);
    g.strokeStyle = 'rgba(255,225,190,.06)'; g.lineWidth = 1; for (let n = 0; n < 5; n++) { const ox = x + 5 + Math.random() * 22; g.beginPath(); g.moveTo(ox, 0); g.bezierCurveTo(ox + 3, h * 0.3, ox - 3, h * 0.7, ox + 1, h); g.stroke(); }
    if (Math.random() < 0.4) { g.fillStyle = 'rgba(20,12,8,.35)'; g.beginPath(); g.ellipse(x + 16, Math.random() * h, 2.5, 4, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,240,220,.08)'; g.fillRect(x + 2, 0, 1, h);
  }
}, [3, 1]);
const falsTak = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#2c2825'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,245,230,.12)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 3, 0, 2, h); }
}, [4, 1]);
const plank = () => tex(256, 128, (g, w, h) => {
  for (let y = 0; y < h; y += 16) { g.fillStyle = `hsl(30, 38%, ${58 + Math.random() * 8}%)`; g.fillRect(0, y, w, 16); g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(0, y + 14, w, 2); for (let n = 0; n < 3; n++) { g.strokeStyle = 'rgba(120,75,35,.18)'; g.beginPath(); g.moveTo(0, y + 3 + n * 4); g.lineTo(w, y + 4 + n * 4); g.stroke(); } }
});
const plat = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9d6d0'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 3, 0, 3, h); }
}, [6, 1]);
const M = {
  fasad: () => new THREE.MeshStandardMaterial({ map: panel(), roughness: 0.82, metalness: 0.02 }),
  tak: new THREE.MeshStandardMaterial({ map: falsTak(), roughness: 0.55, metalness: 0.35 }),
  sockel: new THREE.MeshStandardMaterial({ color: '#7d7a76', roughness: 0.95 }),
  svart: new THREE.MeshStandardMaterial({ color: '#232120', roughness: 0.5, metalness: 0.3 }),
  stal: new THREE.MeshStandardMaterial({ color: '#7c8186', roughness: 0.4, metalness: 0.7 }),
  dack: () => new THREE.MeshStandardMaterial({ map: plank(), roughness: 0.85 }),
  glas: () => new THREE.MeshStandardMaterial({ color: '#40525c', emissive: '#ffb05a', emissiveIntensity: 0.12, roughness: 0.08, metalness: 0.7, envMapIntensity: 1.6 }),
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
  const f = (x, y, bw, bh, z = d / 2 + 0.03, rot = 0) => {
    const r = lada(bw + 0.14, bh + 0.14, 0.07, M.svart, 0.02), p = lada(bw, bh, 0.08, glas, 0), q = grupp(r, p);
    if (bw > 0.7) { const sp = lada(0.04, bh, 0.1, M.svart, 0); q.add(sp); }
    const bl = lada(bw + 0.24, 0.04, 0.16, M.stal, 0.01); bl.position.set(0, -bh / 2 - 0.08, 0.06); q.add(bl);
    const om = lada(bw + 0.26, 0.08, 0.05, M.ram, 0.01); om.position.set(0, bh / 2 + 0.11, 0.02); q.add(om);
    q.position.set(x, y, z); q.rotation.y = rot; g.add(q);
  };
  const sockel = lada(w + 0.08, 0.32, d + 0.08, M.sockel, 0.02); sockel.position.y = -0.1; g.add(sockel);
  const dack = lada(w * 0.62, 0.1, 1.5, M.dack(), 0.02); dack.position.set(-w * 0.12, 0.06, d / 2 + 0.78); g.add(dack);
  for (let x = -w * 0.43; x <= w * 0.19; x += 0.34) { const sp = lada(0.04, 0.5, 0.04, M.svart, 0); sp.position.set(x, 0.36, d / 2 + 1.5); g.add(sp); }
  const led = lada(w * 0.62, 0.05, 0.08, M.svart, 0.01); led.position.set(-w * 0.12, 0.62, d / 2 + 1.5); g.add(led);
  const lampa = lada(0.14, 0.22, 0.1, new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffcf8a', emissiveIntensity: 1.2 }), 0.03); lampa.position.set(w * 0.08 + 0.62, 2.05, d / 2 + 0.08); g.add(lampa);
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
    const nock = lada(0.14, 0.12, d + 0.5, M.svart, 0.02); nock.position.set(0, hv + rh + 0.1, 0); g.add(nock);
    [-1, 1].forEach((sd) => { const r2 = cyl(0.07, 0.07, d + 0.5, M.svart, 10); r2.rotation.x = Math.PI / 2; r2.position.set(sd * (w / 2 + 0.3), hv - 0.02, 0); g.add(r2); const st = cyl(0.04, 0.04, hv, M.svart, 8); st.position.set(sd * (w / 2 + 0.3), hv / 2, d / 2 + 0.2); g.add(st); });
    g.userData.hojd = hv + rh;
  }
  g.userData.hojd = g.userData.hojd || hv + 0.5; g.userData.w = w; g.userData.d = d;
  if (opt.skugga === false) g.traverse((o) => { o.castShadow = false; });
  return g;
}


/* Fordonen: hjul med däck och fälg, Legohus skåpbil och lastbil med flak ---------------------------- */
function hjul(r, b) {
  const g = new THREE.Group();
  const dack = cyl(r, r, b, M.mork, 24); dack.rotation.x = Math.PI / 2; g.add(dack);
  const falg = cyl(r * 0.58, r * 0.58, b + 0.02, M.stal, 20); falg.rotation.x = Math.PI / 2; g.add(falg);
  const nav = cyl(r * 0.18, r * 0.18, b + 0.04, M.svart, 10); nav.rotation.x = Math.PI / 2; g.add(nav);
  for (let n = 0; n < 5; n++) { const e = lada(r * 0.1, r * 0.5, b + 0.03, M.svart, 0); e.rotation.z = (n * Math.PI * 2) / 5; g.add(e); }
  return g;
}
const LJUS_FRAM = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#fff0c8', emissiveIntensity: 1.4 });
const LJUS_BAK = new THREE.MeshStandardMaterial({ color: '#c0392b', emissive: '#ff3b2a', emissiveIntensity: 0.9 });
function skapbil() {
  const g = new THREE.Group(), lack = new THREE.MeshStandardMaterial({ color: '#f7f3ec', roughness: 0.3, metalness: 0.25 }), glas = M.glas();
  const chassi = lada(2.7, 0.3, 1.1, M.svart, 0.06); chassi.position.y = 0.38; g.add(chassi);
  const last = lada(1.9, 1.05, 1.16, lack, 0.12); last.position.set(-0.35, 1.05, 0); g.add(last);
  const huv = lada(0.75, 0.55, 1.12, lack, 0.18); huv.position.set(0.95, 0.75, 0); g.add(huv);
  const hytt = lada(0.55, 0.62, 1.12, lack, 0.14); hytt.position.set(0.62, 1.2, 0); g.add(hytt);
  const vind = lada(0.05, 0.5, 1.0, glas, 0.02); vind.position.set(0.93, 1.17, 0); vind.rotation.z = -0.55; g.add(vind);
  [-1, 1].forEach((sd) => { const sida = lada(0.42, 0.34, 0.03, glas, 0.01); sida.position.set(0.6, 1.24, sd * 0.575); g.add(sida); const sp = lada(0.08, 0.12, 0.14, M.svart, 0.02); sp.position.set(0.86, 1.08, sd * 0.66); g.add(sp); });
  const rand = lada(1.92, 0.08, 1.18, M.koppar, 0.02); rand.position.set(-0.35, 0.82, 0); g.add(rand);
  const logo = lada(0.5, 0.22, 1.18, M.koppar, 0.03); logo.position.set(-0.35, 1.18, 0); g.add(logo);
  const grill = lada(0.04, 0.2, 0.7, M.svart, 0.01); grill.position.set(1.33, 0.68, 0); g.add(grill);
  [-1, 1].forEach((sd) => { const f = lada(0.04, 0.1, 0.2, LJUS_FRAM, 0.02); f.position.set(1.33, 0.82, sd * 0.42); g.add(f); const b = lada(0.04, 0.16, 0.12, LJUS_BAK, 0.02); b.position.set(-1.31, 0.9, sd * 0.48); g.add(b); });
  [1.36, -1.34].forEach((x) => { const st = lada(0.08, 0.14, 1.16, M.svart, 0.04); st.position.set(x, 0.48, 0); g.add(st); });
  const hj = [0.85, -0.8].flatMap((x) => [-0.52, 0.52].map((z) => { const h = hjul(0.27, 0.2); h.position.set(x, 0.27, z); g.add(h); return h; }));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.hjul = hj; g.userData.r = 0.27; return g;
}
function lastbil() {
  const g = new THREE.Group(), lack = new THREE.MeshStandardMaterial({ color: '#f2f0ec', roughness: 0.3, metalness: 0.3 }), glas = M.glas();
  const ram = lada(7.6, 0.3, 1.1, M.svart, 0.04); ram.position.set(0.1, 0.62, 0); g.add(ram);
  const hytt = lada(1.6, 1.75, 2.2, lack, 0.22); hytt.position.set(4.55, 1.55, 0); g.add(hytt);
  const tak = lada(1.3, 0.35, 2.0, lack, 0.15); tak.position.set(4.4, 2.55, 0); g.add(tak);
  const vind = lada(0.06, 0.8, 1.95, glas, 0.02); vind.position.set(5.36, 1.95, 0); g.add(vind);
  [-1, 1].forEach((sd) => {
    const sida = lada(0.7, 0.6, 0.03, glas, 0.01); sida.position.set(4.85, 1.95, sd * 1.11); g.add(sida);
    const arm = lada(0.4, 0.05, 0.05, M.svart, 0); arm.position.set(5.3, 2.1, sd * 1.25); g.add(arm); const sp = lada(0.06, 0.4, 0.18, M.svart, 0.02); sp.position.set(5.48, 1.95, sd * 1.42); g.add(sp);
    const tank = cyl(0.25, 0.25, 0.9, M.stal, 16); tank.rotation.z = Math.PI / 2; tank.position.set(3.3, 0.6, sd * 0.85); g.add(tank);
    const fl = lada(0.04, 0.12, 0.34, LJUS_FRAM, 0.02); fl.position.set(5.37, 0.95, sd * 0.78); g.add(fl);
    const bl = lada(0.04, 0.16, 0.2, LJUS_BAK, 0.02); bl.position.set(-3.68, 0.75, sd * 0.95); g.add(bl);
  });
  const rand = lada(1.62, 0.12, 2.22, M.koppar, 0.03); rand.position.set(4.55, 1.05, 0); g.add(rand);
  const grill = lada(0.05, 0.6, 1.4, M.svart, 0.02); grill.position.set(5.37, 1.25, 0); g.add(grill);
  const stot = lada(0.2, 0.25, 2.3, M.svart, 0.05); stot.position.set(5.4, 0.62, 0); g.add(stot);
  const flak = lada(7.2, 0.18, 2.3, new THREE.MeshStandardMaterial({ map: plank(), roughness: 0.85 }), 0.03); flak.position.set(0.1, 0.86, 0); g.add(flak);
  [-1, 1].forEach((sd) => { const kant = lada(7.2, 0.22, 0.06, M.stal, 0.02); kant.position.set(0.1, 1.04, sd * 1.15); g.add(kant); });
  const gavel = lada(0.1, 0.9, 2.3, M.stal, 0.02); gavel.position.set(3.68, 1.4, 0); g.add(gavel);
  const hj = [4.4, 0.5, -0.6, -2.6].flatMap((x) => [-0.98, 0.98].map((z) => { const h = hjul(0.46, 0.34); h.position.set(x, 0.46, z); g.add(h); return h; }));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.hjul = hj; g.userData.r = 0.46; g.userData.flak = 0.95; return g;
}

/* Stationerna ------------------------------------------------------------------------------------- */
const JORD = tex(256, 128, (g, w, h) => { const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#8d6a4a'); l.addColorStop(1, '#6e5038'); g.fillStyle = l; g.fillRect(0, 0, w, h);
  for (let n = 0; n < 160; n++) { g.fillStyle = ['rgba(40,25,12,.35)', 'rgba(190,160,120,.35)', 'rgba(120,110,100,.5)'][n % 3]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 2.5, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 30; y < h; y += 34) g.fillRect(0, y + Math.random() * 6, w, 2); }, [3, 1]);
const GRAS = tex(256, 256, (g, w, h) => { g.fillStyle = '#9fb57f'; g.fillRect(0, 0, w, h); for (let n = 0; n < 2400; n++) { g.strokeStyle = ['rgba(70,100,50,.25)', 'rgba(200,215,150,.3)', 'rgba(120,150,80,.3)'][n % 3]; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); g.stroke(); } }, [3, 3]);
const GRUS = tex(256, 128, (g, w, h) => {
  g.fillStyle = '#d6c5a8'; g.fillRect(0, 0, w, h);
  [0.27, 0.73].forEach((v) => { const l = g.createLinearGradient(0, h * v - 14, 0, h * v + 14); l.addColorStop(0, 'rgba(120,95,65,0)'); l.addColorStop(0.5, 'rgba(120,95,65,.22)'); l.addColorStop(1, 'rgba(120,95,65,0)'); g.fillStyle = l; g.fillRect(0, h * v - 14, w, 28); });
  for (let n = 0; n < 1800; n++) { g.fillStyle = ['rgba(90,70,50,.35)', 'rgba(255,250,240,.45)', 'rgba(150,130,105,.4)'][n % 3]; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}, [40, 1]);
function platta(farg, topp) {
  const g = new THREE.Group();
  const bas = lada(13.2, 1.3, 11.2, new THREE.MeshStandardMaterial({ map: JORD, roughness: 1 }), 0.35); bas.position.y = -0.6; g.add(bas);
  const gras = lada(13.3, 0.22, 11.3, new THREE.MeshStandardMaterial({ map: GRAS, roughness: 1 }), 0.12); gras.position.y = -0.04; g.add(gras);
  const yta = lada(11.6, 0.1, 9.6, new THREE.MeshStandardMaterial({ color: farg, roughness: 0.95 }), 0.3); yta.position.y = 0.04; g.add(yta);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 64), M.neon('#e9a25a', 1)); kant.rotation.x = Math.PI / 2; kant.scale.set(6.9, 5.9, 1); kant.position.y = -0.02; g.add(kant);
  g.userData.kant = kant;
  return g;
}
const LOV = ['#7f9a6c', '#8fa877', '#6f8c62'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
const TRAD = [];
function trad(x, z, s = 1) {
  const v = LOV[Math.abs(Math.round(x * 7 + z * 3)) % 3], t = grupp(cyl(0.08 * s, 0.11 * s, 0.9 * s, M.tra, 8));
  t.children[0].position.y = 0.45 * s;
  [[0.72, 1.2, 1.2], [0.54, 1.0, 1.8], [0.34, 0.8, 2.3]].forEach(([r, h, y]) => { const k = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 18), v); k.position.y = y * s; k.castShadow = k.receiveShadow = true; t.add(k); });
  t.position.set(x, 0, z); t.rotation.y = x + z; t.userData.vaj = Math.random() * 6; TRAD.push(t); return t;
}

/* Detaljerna: buskar, blommor, människor, koner, staket, lyktor, moln, fåglar och bilen ----------- */
function buske(x, z, s = 1) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 * s, 3), LOV[(Math.round(x + z) & 1) + 1]); b.scale.y = 0.75; b.position.set(x, 0.28 * s, z); b.rotation.y = x; b.castShadow = b.receiveShadow = true; return b; }
const BLOM = ['#f3d9b0', '#e9a25a', '#fbf6ee', '#e7a3a0', '#c9b4e0'].map((c) => new THREE.Color(c));
function blommor(n, fri = [4.4, 3.6]) {
  const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n), o = new THREE.Object3D();
  for (let k = 0, f = 0; k < n && f < 2000; f++) { const x = (Math.random() - 0.5) * 12, z = (Math.random() - 0.5) * 10; if (Math.abs(x) < fri[0] && Math.abs(z) < fri[1]) continue; o.position.set(x, 0.12, z); o.scale.setScalar(0.7 + Math.random() * 0.9); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, BLOM[k % BLOM.length]); k++; }
  return m;
}
const HUD = ['#e8c4a0', '#c99b74', '#8d6248'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
const HAR = ['#3b2a20', '#c9a06a', '#1d1a18', '#8a5a3c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
const BYXA = new THREE.MeshStandardMaterial({ color: '#34393f', roughness: 0.85 }), SKO = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.6 });
const OGA = new THREE.MeshBasicMaterial({ color: '#1b1915' }), REFLEX = new THREE.MeshStandardMaterial({ color: '#eef0f2', emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.3 });
function gubbe(klader, hjalm, n = 0, s = 1) {
  const g = new THREE.Group(), bas = new THREE.Group(), kl = new THREE.MeshStandardMaterial({ color: klader, roughness: 0.8 }), hud = HUD[n % 3]; g.add(bas);
  const ben = (sid) => { const p = new THREE.Group(); p.position.set(sid * 0.1, 0.66, 0); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 10), BYXA); b.position.y = -0.3; p.add(b); const sko = lada(0.15, 0.1, 0.27, SKO, 0.04); sko.position.set(0, -0.6, 0.05); p.add(sko); bas.add(p); return p; };
  const vb = ben(-1), hb = ben(1);
  const kropp = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.36, 6, 14), kl); kropp.scale.z = 0.8; kropp.position.y = 0.98; bas.add(kropp);
  if (hjalm) [0.9, 1.06].forEach((y) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.193, 0.193, 0.04, 18), REFLEX); r.scale.z = 0.8; r.position.y = y; bas.add(r); });
  const hals = cyl(0.06, 0.07, 0.1, hud, 10); hals.position.y = 1.27; bas.add(hals);
  const huvud = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), hud); huvud.scale.set(0.95, 1.08, 1); huvud.position.y = 1.43; bas.add(huvud);
  [-1, 1].forEach((sd) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), OGA); o.position.set(sd * 0.05, 1.45, 0.138); bas.add(o); });
  const nasa = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), hud); nasa.position.set(0, 1.41, 0.15); bas.add(nasa);
  if (hjalm) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.175, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.gul); h.position.y = 1.47; bas.add(h); const sk = cyl(0.21, 0.21, 0.02, M.gul, 20); sk.position.set(0, 1.47, 0.03); bas.add(sk); }
  else { const har = new THREE.Mesh(new THREE.SphereGeometry(0.158, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), HAR[n % 4]); har.rotation.x = -0.35; har.position.y = 1.45; bas.add(har); }
  const arm = (sid) => { const p = new THREE.Group(); p.position.set(sid * 0.24, 1.17, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), kl); a.position.y = -0.22; p.add(a); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), hud); hand.position.y = -0.45; p.add(hand); bas.add(p); return p; };
  g.userData.v = arm(-1); g.userData.h = arm(1); g.userData.vb = vb; g.userData.hb = hb; g.userData.bas = bas;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(s); return g;
}
const promenera = (gb, fas, amp = 1) => { const u = gb.userData, v = Math.sin(fas) * amp; u.v.rotation.x = v * 0.55; u.h.rotation.x = -v * 0.55; u.vb.rotation.x = -v * 0.5; u.hb.rotation.x = v * 0.5; u.bas.position.y = Math.abs(Math.cos(fas)) * 0.045 * amp; u.bas.rotation.z = Math.sin(fas) * 0.03 * amp; };
// stegfasen räknas fram ur sträckan: ett steg per ~0,55 m, armar och ben vilar när personen står still
const kliv = (gb, fart, dt) => { const u = gb.userData; u.fas = (u.fas || 0) + fart * dt * 5.7; u.amp = lerp(u.amp || 0, Math.min(1, fart * 1.4), Math.min(1, dt * 6)); promenera(gb, u.fas, u.amp); };
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
  const rok = [], rokMat = new THREE.MeshStandardMaterial({ color: '#d9d0c4', roughness: 1, transparent: true, depthWrite: false });
  for (let n = 0; n < 7; n++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 3), rokMat.clone()); st[1].add(r); rok.push(r); }
  const snick = gubbe('#c98a45', true, 1); st[1].add(snick);
  const bar = lada(0.12, 0.08, 2.2, M.tra, 0.02); bar.position.set(0.24, 1.3, 0); bar.rotation.x = 0.15; snick.userData.bas.add(bar);
  lagg(st[1], (t, dt) => {
    rok.forEach((r, n) => { const a = (t * 0.18 + n / 7) % 1; r.position.set(4.8 + a * 1.6 + Math.sin(t + n) * 0.2, 6.7 + a * 3.2, -3.6 - a * 0.6); r.scale.setScalar(0.5 + a * 1.6); r.material.opacity = (1 - a) * 0.85; r.rotation.set(t * 0.3 + n, n, 0); });
    const vx = Math.cos(t * 0.45) * 2.4 * 0.45; snick.position.set(Math.sin(t * 0.45) * 2.4, 0.06, 3.3); if (Math.abs(vx) > 0.05) trygg(snick, vx > 0 ? Math.PI / 2 : -Math.PI / 2, dt); kliv(snick, Math.abs(vx), dt);
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
  lagg(st[4], (t, dt) => { const a = t * 0.35, vx = -Math.sin(a) * 4.4 * 0.35, vz = Math.cos(a) * 3.2 * 0.35; bes.position.set(Math.cos(a) * 4.4, 0.06, -0.8 + Math.sin(a) * 3.2); trygg(bes, Math.atan2(vx, vz), dt); kliv(bes, Math.hypot(vx, vz), dt); bes.userData.v.rotation.x = -1.2; });
  // 6 Klart: familjen vinkar vid trappan, staket, brevlåda och rabatter
  const fam = [gubbe('#c98a45', false, 0), gubbe('#7f9a6c', false, 1), gubbe('#e7a3a0', false, 2, 0.62)];
  fam[0].position.set(2, 0.06, 3.4); fam[1].position.set(3.1, 0.06, 3.2); fam[2].position.set(2.6, 0.06, 3.7);
  const bl = grupp(cyl(0.04, 0.04, 0.9, M.mork, 8), lada(0.36, 0.3, 0.5, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5, metalness: 0.3 }), 0.08));
  bl.children[0].position.y = 0.45; bl.children[1].position.y = 0.95; bl.position.set(-0.7, 0.06, 4.7);
  st[5].add(...fam, staket(-6, 6, 4.95, 0.5), bl, blommor(46, [4.4, 3.4]), buske(-3.6, 0.5), buske(3.6, 0.5, 0.9), buske(-2.6, 0.7, 0.7));
  const hund = new THREE.Group(), pals = new THREE.MeshStandardMaterial({ color: '#c08a4e', roughness: 0.8 }), mork = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 });
  const hk = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.36, 6, 12), pals); hk.rotation.z = Math.PI / 2; hk.position.y = 0.38; hund.add(hk);
  const hh = new THREE.Group(); hh.position.set(0.3, 0.55, 0); hund.add(hh); const hhu = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), pals); hh.add(hhu);
  const nos2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 4, 8), pals); nos2.rotation.z = Math.PI / 2; nos2.position.set(0.13, -0.03, 0); hh.add(nos2); const tryn = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), OGA); tryn.position.set(0.21, -0.02, 0); hh.add(tryn);
  [-1, 1].forEach((sd) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mork); o.scale.set(0.5, 1.3, 0.8); o.position.set(-0.02, 0.06, sd * 0.1); o.rotation.x = sd * 0.4; hh.add(o); });
  const hben = [[0.2, -0.08], [0.2, 0.08], [-0.2, -0.08], [-0.2, 0.08]].map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.3, z); const b = cyl(0.035, 0.03, 0.3, pals, 8); b.position.y = -0.15; g.add(b); hund.add(g); return g; });
  const hsvans = new THREE.Group(); hsvans.position.set(-0.3, 0.45, 0); hund.add(hsvans); const sv = cyl(0.02, 0.03, 0.22, pals, 6); sv.position.y = 0.1; sv.rotation.z = 0.5; hsvans.add(sv);
  hund.traverse((m) => { if (m.isMesh) m.castShadow = true; }); st[5].add(hund);
  lagg(st[5], (t, dt) => {
    // springer, stannar och viftar, springer igen
    const fas = (t * 0.6) % (Math.PI * 2), spring = Math.sin(t * 0.25) > -0.3, a = t * 0.9;
    const tx = 2.6 + Math.cos(a) * 1.7, tz = 3.4 + Math.sin(a) * 0.95;
    if (spring) { const dx = tx - hund.position.x, dz = tz - hund.position.z; hund.position.x += dx * Math.min(1, dt * 4); hund.position.z += dz * Math.min(1, dt * 4); if (Math.hypot(dx, dz) > 0.01) vrid(hund, dx, dz, dt, 8); }
    hund.position.y = 0.06 + (spring ? Math.abs(Math.sin(t * 14)) * 0.06 : 0);
    hben.forEach((b, k) => { b.rotation.z = spring ? Math.sin(t * 14 + (k < 2 ? 0 : Math.PI)) * 0.7 : 0; });
    hsvans.rotation.x = Math.sin(t * (spring ? 18 : 24)) * 0.6; hh.rotation.z = spring ? 0.1 : Math.sin(t * 2) * 0.15;
  });
  lagg(st[5], (t) => { vinka(fam[0], t, 0); vinka(fam[1], t, 2); vinka(fam[2], t * 1.3, 1, true); fam[2].position.y = 0.06 + Math.abs(Math.sin(t * 4)) * 0.25; });
}
/* Naturen runt resan: mark till horisonten, kullar, berg, skog, sjö med båt, åkrar, stenar, gräs och vindkraftverk */
const HORISONT = '#f1ece0';
// himlen ritas om i samma duk när temat byts (topp, mitt och horisont kommer från --t-3d-…)
function ritaHimmel(g, w, h, topp, mitt, hor) { const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, topp); l.addColorStop(0.45, mitt); l.addColorStop(0.75, hor); l.addColorStop(1, hor); g.fillStyle = l; g.fillRect(0, 0, w, h); }
function himmel() {
  return tex(16, 512, (g, w, h) => ritaHimmel(g, w, h, '#b7d3e0', '#dfe9e6', HORISONT));
}
function slump(fro) { let s = fro; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const fNabb0 = () => new THREE.MeshStandardMaterial({ color: '#e9a25a', roughness: 0.5 });
function natur(scen) {
  const r = slump(7), SLUT = AVST * 5;
  const fri = (x, z) => z > -7.5 && z < 9.5 && x > -8 && x < SLUT + 8; // stationerna och gången
  // marken: mjukt gräs med fläckar som tonar bort i diset
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: '#c3cf9d', roughness: 1 })); mark.rotation.x = -Math.PI / 2; mark.position.set(SLUT / 2, -0.62, 0); mark.receiveShadow = true; mark.name = 'mark'; scen.add(mark);
  const gron = ['#9fb487', '#8ea877', '#b1c095', '#a3b98c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  // kullar bakom och berg längst bort
  for (let n = 0; n < 16; n++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), gron[n % 4]); const rad = 14 + r() * 18; k.scale.set(rad * 1.8, rad * 0.2, rad); k.position.set(-60 + n * 15 + r() * 8, -0.6, -78 - r() * 30); k.receiveShadow = true; scen.add(k); }
  const berg = new THREE.MeshStandardMaterial({ color: '#c3cbc6', roughness: 1 }), sno = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.9 });
  for (let n = 0; n < 9; n++) { const h = 26 + r() * 26, rad = 22 + r() * 16, x = -70 + n * 30 + r() * 12, z = -170 - r() * 40; const b = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 28), berg); b.position.set(x, h / 2 - 1, z); b.rotation.y = r() * 3; scen.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.3, h * 0.3, 28), sno); t.position.set(x, h - 1 - h * 0.15 + 0.2, z); t.rotation.y = b.rotation.y; scen.add(t); }
  // skogen: stammar och kronor som instanser
  const N = 340, kmat = new THREE.MeshStandardMaterial({ roughness: 0.9 }), stam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 1, 6), M.tra, N);
  const gran1 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 1.7, 18), kmat, N), gran2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 1.4, 18), kmat, N), lov = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), kmat, N);
  let kg = 0, kl = 0; const gran3 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 1.0, 18), kmat, N), lov2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), kmat, N * 2); let kl2 = 0; const forsk = new THREE.Vector3(), ljusare = new THREE.Color();
  const tonfarg = ['#5d7f52', '#6e8f5c', '#7f9f66', '#55744c', '#8aa86e'].map((c) => new THREE.Color(c)), o = new THREE.Object3D();
  let k = 0;
  const plantera = (x, z, s) => {
    if (k >= N || fri(x, z)) return; const f = tonfarg[k % 5];
    o.position.set(x, -0.6 + 0.5 * s, z); o.rotation.set(0, 0, 0); o.scale.setScalar(s); o.updateMatrix(); stam.setMatrixAt(k, o.matrix); k++;
    o.rotation.y = r() * 6;
    if (r() < 0.35) {
      o.position.y = -0.6 + 1.75 * s; o.scale.set(s * 1.05, s * 0.95, s * 1.05); o.updateMatrix(); lov.setMatrixAt(kl, o.matrix); lov.setColorAt(kl++, f);
      [[0.62, -0.25, 0.35, 0.68], [-0.55, -0.1, -0.4, 0.72], [0.1, 0.55, -0.2, 0.6]].forEach(([dx, dy, dz, sk]) => { forsk.set(dx, dy, dz).applyEuler(o.rotation).multiplyScalar(s); const bx = o.position.x, by = o.position.y, bz = o.position.z; o.position.add(forsk); o.scale.setScalar(s * sk); o.updateMatrix(); lov2.setMatrixAt(kl2, o.matrix); lov2.setColorAt(kl2++, ljusare.copy(f).offsetHSL(0, 0, dy > 0 ? 0.05 : -0.02)); o.position.set(bx, by, bz); });
      return;
    }
    o.position.y = -0.6 + 1.45 * s; o.updateMatrix(); gran1.setMatrixAt(kg, o.matrix); gran1.setColorAt(kg, f);
    o.position.y = -0.6 + 2.35 * s; o.updateMatrix(); gran2.setMatrixAt(kg, o.matrix); gran2.setColorAt(kg, f);
    o.position.y = -0.6 + 3.05 * s; o.updateMatrix(); gran3.setMatrixAt(kg, o.matrix); gran3.setColorAt(kg++, ljusare.copy(f).offsetHSL(0, 0, 0.03));
  };
  // dunge-vis: grupper av träd bakom, glesare framför, och täta skogar i båda ändarna
  for (let n = 0; n < 24; n++) { const cx = -30 + r() * (SLUT + 60), cz = -18 - r() * 32; const m = 4 + Math.floor(r() * 7); for (let j = 0; j < m; j++) plantera(cx + (r() - 0.5) * 9, cz + (r() - 0.5) * 7, 0.8 + r() * 1.1); }
  for (let n = 0; n < 5; n++) { const cx = n % 2 ? -14 - r() * 8 : SLUT + 14 + r() * 8, cz = 12 + r() * 10; for (let j = 0; j < 4; j++) plantera(cx + (r() - 0.5) * 5, cz + (r() - 0.5) * 4, 0.7 + r() * 0.6); }
  for (let n = 0; n < 110; n++) { const v = n % 2 ? -16 - r() * 30 : SLUT + 16 + r() * 30; plantera(v, -30 + r() * 55, 0.9 + r() * 1.2); }
  // sjön med strand, brygga, båt och ringar på vattnet
  const sjoX = SLUT * 0.55, sjoZ = -19;
  const strand = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#e9dcbf', roughness: 1 })); strand.rotation.x = -Math.PI / 2; strand.scale.set(15.5, 7.6, 1); strand.position.set(sjoX, -0.6, sjoZ); strand.receiveShadow = true; scen.add(strand);
  const vatten = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#8fbfc9', roughness: 0.12, metalness: 0.15, envMapIntensity: 1.4 })); vatten.rotation.x = -Math.PI / 2; vatten.scale.set(14, 6.4, 1); vatten.position.set(sjoX, -0.57, sjoZ); scen.add(vatten);
  const NV = 220, vass = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.03, 1, 5), new THREE.MeshStandardMaterial({ color: '#8b9a5b', roughness: 0.9 }), NV);
  for (let n = 0; n < NV; n++) { const a = r() * Math.PI * 2, rr = 0.9 + r() * 0.12; o.position.set(sjoX + Math.cos(a) * 14 * rr, -0.3, sjoZ + Math.sin(a) * 6.4 * rr); o.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3); o.scale.set(1, 0.6 + r() * 0.8, 1); o.updateMatrix(); vass.setMatrixAt(n, o.matrix); }
  scen.add(vass);
  const NN = 24, nack = new THREE.InstancedMesh(new THREE.CircleGeometry(0.32, 16, 0.3, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: '#6f9a5a', roughness: 0.6, side: THREE.DoubleSide }), NN);
  for (let n = 0; n < NN; n++) { o.position.set(sjoX - 8 + r() * 5, -0.555, sjoZ - 2 + r() * 4); o.rotation.set(-Math.PI / 2, 0, r() * 6); o.scale.setScalar(0.7 + r() * 0.7); o.updateMatrix(); nack.setMatrixAt(n, o.matrix); }
  scen.add(nack);
  const brygga = grupp(lada(1.2, 0.12, 4.2, M.tra, 0.02)); brygga.children[0].position.y = -0.38; [[-0.5, -1.8], [0.5, -1.8], [-0.5, 0], [0.5, 0], [-0.5, 1.8], [0.5, 1.8]].forEach(([x, z]) => { const p = cyl(0.06, 0.06, 0.6, M.tra, 6); p.position.set(x, -0.6, z); brygga.add(p); }); brygga.position.set(sjoX - 5, 0, sjoZ + 4.6); scen.add(brygga);
  const bat = new THREE.Group(); const skrov = lada(2, 0.4, 0.8, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5 }), 0.18); bat.add(skrov);
  const mast = cyl(0.04, 0.04, 2.4, M.vit, 6); mast.position.y = 1.3; bat.add(mast);
  const segelF = new THREE.Shape(); segelF.moveTo(0, 0); segelF.lineTo(1.1, 0); segelF.lineTo(0, 2); segelF.closePath();
  const segel = new THREE.Mesh(new THREE.ShapeGeometry(segelF), new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.7, side: THREE.DoubleSide })); segel.position.set(0.05, 0.35, 0); bat.add(segel);
  bat.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scen.add(bat);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), ringar = [];
  for (let n = 0; n < 4; n++) { const q = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), ringMat.clone()); q.rotation.x = -Math.PI / 2; q.position.set(sjoX + 4 - n * 3, -0.55, sjoZ - 1 + (n % 2) * 2); scen.add(q); ringar.push(q); }
  // åkrar i fåror framför gången
  [[SLUT * 0.3, -14, 14, 5, '#c9d49c']].concat([0, 1, 2, 3, 4, 5].map((n) => [-6 + n * 18.5, 15.5 + (n % 2) * 1.2, 15, 6.5, ['#dccb8f', '#bccb8c', '#e2c995', '#c9d49c'][n % 4]])).forEach(([x, z, w, d, f]) => {
    const akr = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: f, roughness: 1 }), mork = new THREE.MeshStandardMaterial({ color: new THREE.Color(f).multiplyScalar(0.86), roughness: 1 });
    for (let n = 0; n < d / 0.7; n++) { const rad = lada(w, 0.18, 0.4, n % 2 ? mat : mork, 0.08); rad.position.set(0, -0.52, -d / 2 + n * 0.7); rad.receiveShadow = true; akr.add(rad); }
    akr.position.set(x, 0, z); akr.rotation.y = 0.04; scen.add(akr);
  });
  // häckar mellan gången och åkrarna, och lövträd längst fram
  const NH = 150, hack = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 2), new THREE.MeshStandardMaterial({ roughness: 1 }), NH);
  for (let n = 0; n < NH; n++) { o.position.set(-14 + n * ((SLUT + 28) / NH) + (r() - 0.5) * 0.4, -0.45, 11.4 + (r() - 0.5) * 0.4); o.rotation.set(0, r() * 6, 0); o.scale.set(0.6 + r() * 0.3, 0.45 + r() * 0.2, 0.6); o.updateMatrix(); hack.setMatrixAt(n, o.matrix); hack.setColorAt(n, tonfarg[n % 5]); }
  hack.castShadow = hack.receiveShadow = true; scen.add(hack);
  for (let n = 0; n < 9; n++) { const cx = -6 + n * 12 + r() * 4; [0, 1, 2].forEach(() => plantera(cx + (r() - 0.5) * 4, 23 + r() * 6, 0.9 + r() * 0.5)); }
  stam.count = k; gran1.count = gran2.count = gran3.count = kg; lov.count = kl; lov2.count = kl2;
  [stam, gran1, gran2, gran3, lov, lov2].forEach((m) => { m.castShadow = m.receiveShadow = true; scen.add(m); });
  // traktorn som harvar åkern längst fram: kör en jämn slinga, svänger med framhjulen och dammar bakom sig
  const trak = new THREE.Group(), rod = new THREE.MeshStandardMaterial({ color: '#b8402b', roughness: 0.35, metalness: 0.25 });
  const chassi = lada(2.3, 0.35, 0.7, M.svart, 0.06); chassi.position.set(0.15, 0.62, 0); trak.add(chassi);
  const motor = lada(1.25, 0.62, 0.78, rod, 0.16); motor.position.set(0.72, 1.0, 0); trak.add(motor);
  const grill = lada(0.05, 0.45, 0.6, M.svart, 0.02); grill.position.set(1.35, 0.98, 0); trak.add(grill);
  [-0.22, 0.22].forEach((z) => { const l = lada(0.04, 0.08, 0.12, LJUS_FRAM, 0.02); l.position.set(1.37, 1.15, z); trak.add(l); });
  const golv = lada(1.1, 0.12, 1.3, M.svart, 0.03); golv.position.set(-0.45, 1.0, 0); trak.add(golv);
  [[0.05, 0.6], [0.05, -0.6], [-0.95, 0.6], [-0.95, -0.6]].forEach(([x, z]) => { const st = lada(0.06, 1.1, 0.06, M.svart, 0); st.position.set(x, 1.6, z); trak.add(st); });
  const tak = lada(1.2, 0.1, 1.4, rod, 0.04); tak.position.set(-0.45, 2.18, 0); trak.add(tak);
  const rutor = lada(1.0, 0.95, 1.2, new THREE.MeshStandardMaterial({ color: '#9fb6c0', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.45 }), 0.02); rutor.position.set(-0.45, 1.6, 0); trak.add(rutor);
  const stol = lada(0.35, 0.4, 0.4, M.svart, 0.06); stol.position.set(-0.6, 1.25, 0); trak.add(stol);
  const forare = gubbe('#5b7f9e', false, 2, 0.75); forare.position.set(-0.55, 0.62, 0); forare.rotation.y = Math.PI / 2; forare.userData.vb.rotation.x = forare.userData.hb.rotation.x = -1.4; forare.userData.v.rotation.x = forare.userData.h.rotation.x = -0.9; trak.add(forare);
  const ror = cyl(0.04, 0.05, 0.9, M.svart, 8); ror.position.set(1.05, 1.65, -0.25); trak.add(ror);
  [-1, 1].forEach((sd) => { const sk = lada(0.75, 0.06, 0.32, rod, 0.03); sk.position.set(-0.6, 1.22, sd * 0.78); trak.add(sk); });
  const bak = [-1, 1].map((sd) => { const h = hjul(0.55, 0.36); h.position.set(-0.6, 0.55, sd * 0.78); trak.add(h); return h; });
  const fram = [-1, 1].map((sd) => { const st = new THREE.Group(); st.position.set(0.95, 0.32, sd * 0.62); trak.add(st); const h = hjul(0.32, 0.22); st.add(h); return { st, h }; });
  const harv = new THREE.Group(); harv.position.set(-1.9, 0, 0); trak.add(harv);
  const balk = lada(0.2, 0.15, 2.0, M.stal, 0.03); balk.position.y = 0.45; harv.add(balk); const drag = lada(0.6, 0.08, 0.08, M.stal, 0); drag.position.set(0.4, 0.5, 0); harv.add(drag);
  for (let n = 0; n < 7; n++) { const p = lada(0.05, 0.4, 0.05, M.stal, 0); p.position.set(0, 0.25, -0.9 + n * 0.3); p.rotation.z = 0.3; harv.add(p); }
  const avgas = []; for (let n = 0; n < 6; n++) { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 2), new THREE.MeshStandardMaterial({ color: '#d8d3cb', roughness: 1, transparent: true, depthWrite: false })); scen.add(a); avgas.push(a); }
  const damm = []; for (let n = 0; n < 8; n++) { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), new THREE.MeshStandardMaterial({ color: '#cdb892', roughness: 1, transparent: true, depthWrite: false })); scen.add(a); damm.push(a); }
  trak.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scen.add(trak);
  // slingan: två raka sträckor och två halvcirklar, parametriserad på sträcka
  const RAK = 22, RAD = 1.5, X0 = -11, Z0 = 14.3, VARV = 2 * RAK + 2 * Math.PI * RAD;
  const slinga = (d, ut) => {
    d = ((d % VARV) + VARV) % VARV;
    if (d < RAK) return ut.set(X0 + d, 0, Z0, 0);
    d -= RAK; if (d < Math.PI * RAD) { const a = d / RAD; return ut.set(X0 + RAK + Math.sin(a) * RAD, 0, Z0 + RAD - Math.cos(a) * RAD, a); }
    d -= Math.PI * RAD; if (d < RAK) return ut.set(X0 + RAK - d, 0, Z0 + 2 * RAD, Math.PI);
    d -= RAK; const a = d / RAD; return ut.set(X0 - Math.sin(a) * RAD, 0, Z0 + RAD + Math.cos(a) * RAD, Math.PI + a);
  };
  const tp = new THREE.Vector4(), tp2 = new THREE.Vector4(), tmpV = new THREE.Vector3(); let trakD = 0, trakVinkel = 0;

  // fåren: vandrar lugnt till en ny betesplats, stannar och betar med huvudet nere
  const ull = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 1 }), nos = new THREE.MeshStandardMaterial({ color: '#2f2b28', roughness: 0.8 }), far = [];
  const HAGE = { x0: 17, x1: 31, z0: -14.5, z1: -9.5 };
  const nyPlats = (v) => v.set(HAGE.x0 + r() * (HAGE.x1 - HAGE.x0), 0, HAGE.z0 + r() * (HAGE.z1 - HAGE.z0));
  for (let n = 0; n < 7; n++) {
    const f = new THREE.Group(), kr = new THREE.Group(); kr.position.y = 0.62; f.add(kr);
    [[0, 0, 0, 0.36], [0.28, 0.04, 0.05, 0.3], [-0.28, 0.03, -0.04, 0.31], [0.05, 0.2, 0.1, 0.27], [-0.1, 0.18, -0.12, 0.26], [0.12, 0.02, -0.2, 0.26], [-0.12, -0.02, 0.2, 0.26]].forEach(([x, y, z, rr]) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 3), ull); b.position.set(x, y, z); kr.add(b); });
    const hv = new THREE.Group(); hv.position.set(0.5, 0.78, 0); f.add(hv);
    const hu = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), nos); hu.scale.set(1.45, 1, 0.85); hu.position.x = 0.14; hv.add(hu);
    const lugg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 2), ull); lugg.position.set(0.02, 0.1, 0); hv.add(lugg);
    [-1, 1].forEach((sd) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), nos); o.scale.set(0.5, 0.3, 1.4); o.position.set(0.02, 0.06, sd * 0.15); o.rotation.x = sd * 0.5; hv.add(o); const oga = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), OGA); oga.position.set(0.2, 0.05, sd * 0.08); hv.add(oga); });
    const ben = [[0.24, -0.15], [0.24, 0.15], [-0.24, -0.15], [-0.24, 0.15]].map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.42, z); const b = cyl(0.045, 0.04, 0.42, nos, 8); b.position.y = -0.21; g.add(b); f.add(g); return g; });
    const svans = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 2), ull); svans.position.set(-0.46, 0.68, 0); f.add(svans);
    f.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    nyPlats(f.position); f.position.y = -0.6; f.rotation.y = r() * 6;
    f.userData = { hv, ben, svans, mal: nyPlats(new THREE.Vector3()), vila: 1 + r() * 6, fas: r() * 6, gang: 0, amp: 0 }; scen.add(f); far.push(f);
  }
  // ankorna simmar i en liten slinga, en efter en
  const ankor = [], ankBrun = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.7 }), ankGron = new THREE.MeshStandardMaterial({ color: '#2f6b4f', roughness: 0.4, metalness: 0.2 });
  for (let n = 0; n < 4; n++) {
    const a = new THREE.Group(), kr = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), ankBrun); kr.scale.set(1.5, 0.8, 0.95); kr.position.y = 0.1; a.add(kr);
    const hu = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), n === 0 ? ankGron : ankBrun); hu.position.set(0.24, 0.3, 0); a.add(hu);
    const nb = lada(0.12, 0.03, 0.07, fNabb0(), 0.015); nb.position.set(0.36, 0.28, 0); a.add(nb);
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), ankBrun); st.rotation.z = Math.PI / 2 + 0.5; st.position.set(-0.3, 0.18, 0); a.add(st);
    const kolv = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })); kolv.rotation.x = -Math.PI / 2; kolv.position.y = 0.02; a.add(kolv);
    a.traverse((m) => { if (m.isMesh && m !== kolv) m.castShadow = true; }); a.scale.setScalar(n ? 0.75 : 0.9); a.userData = { kolv }; scen.add(a); ankor.push(a);
  }
  // fjärilarna: styr mjukt mot en blomma, landar, vilar med långsamma vingslag och flyger vidare
  const vingTex = (a, b) => { const t = tex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); const l = g.createLinearGradient(0, 0, w, 0); l.addColorStop(0, b); l.addColorStop(0.55, a); l.addColorStop(1, '#2a2420'); g.fillStyle = l;
    g.beginPath(); g.moveTo(4, 60); g.bezierCurveTo(30, 0, 110, -6, 124, 30); g.bezierCurveTo(118, 54, 70, 62, 4, 64); g.fill();
    g.beginPath(); g.moveTo(4, 66); g.bezierCurveTo(60, 66, 104, 80, 92, 112); g.bezierCurveTo(70, 128, 24, 110, 4, 72); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; [[100, 26, 6], [84, 18, 4], [70, 96, 5]].forEach(([x, y, rr]) => { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); });
  }); return t; };
  const FJ = [['#f2a341', '#ffd27a'], ['#fbf6ee', '#e9e2d6'], ['#d9737a', '#f3b8b0'], ['#8f86d6', '#c9c1f2']].map(([a, b]) => new THREE.MeshStandardMaterial({ map: vingTex(a, b), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }));
  const fjKropp = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.6 }), fjarilar = [];
  const blomma = (v, n) => v.set((n % 6) * AVST + (r() - 0.5) * 11, 0.18 + (r() < 0.3 ? 0.9 : 0), (r() < 0.5 ? -1 : 1) * (3.6 + r() * 1.2));
  for (let n = 0; n < 14; n++) {
    const f = new THREE.Group(); const kropp = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.16, 4, 8), fjKropp); kropp.rotation.x = Math.PI / 2; f.add(kropp);
    [-1, 1].forEach((sd) => { const a = cyl(0.003, 0.003, 0.14, fjKropp, 4); a.rotation.x = Math.PI / 2 - 0.5; a.rotation.z = sd * 0.35; a.position.set(sd * 0.02, 0.04, 0.14); f.add(a); });
    const vingar = [-1, 1].map((sd) => { const led = new THREE.Group(); f.add(led); const v = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), FJ[n % 4]); v.geometry.rotateX(-Math.PI / 2); v.geometry.translate(0.15, 0, 0); v.scale.x = sd; led.add(v); return { led, sd }; });
    const pos = blomma(new THREE.Vector3(), n); f.position.copy(pos); f.scale.setScalar(1.8);
    f.userData = { vingar, mal: blomma(new THREE.Vector3(), n), fart: new THREE.Vector3(), vila: r() * 3, fas: r() * 6, n, oppen: 0 }; scen.add(f); fjarilar.push(f);
  }
  const fjStyr = new THREE.Vector3();
  // stenar och gräs
  const stenMat = new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.95 });
  for (let n = 0; n < 40; n++) { const x = -20 + r() * (SLUT + 40), z = -9 - r() * 30; if (fri(x, z)) continue; const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + r() * 0.7, 2), stenMat); s.position.set(x, -0.5, z); s.rotation.set(r() * 3, r() * 3, 0); s.scale.y = 0.6; s.castShadow = s.receiveShadow = true; scen.add(s); }
  const NB = 160, ang = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), NB);
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
  return (t, dt) => {
    // traktorn: jämn fart, riktningen ur slingans tangent, framhjulen styr in i kurvan
    const fartT = 2.2, ds = fartT * (dt || 0); trakD += ds; slinga(trakD, tp); slinga(trakD + 1.2, tp2);
    trak.position.set(tp.x, -0.62 + Math.sin(t * 13) * 0.008, tp.z); trak.rotation.y = -tp.w;
    let styr = tp2.w - tp.w; styr = Math.atan2(Math.sin(styr), Math.cos(styr)); trakVinkel = lerp(trakVinkel, klamp(styr * 1.4, -0.6, 0.6), Math.min(1, (dt || 0) * 4));
    fram.forEach((f) => { f.st.rotation.y = trakVinkel; f.h.rotation.z -= ds / 0.32; }); bak.forEach((h) => { h.rotation.z -= ds / 0.55; });
    tmpV.set(1.05, 2.1, -0.25); trak.localToWorld(tmpV);
    avgas.forEach((a, n) => { const q = (t * 0.7 + n / 6) % 1; if (q < 0.05) a.userData.p = tmpV.clone(); const b = a.userData.p || tmpV; a.position.set(b.x - q * 0.4, b.y + q * 1.8, b.z + q * 0.3); a.scale.setScalar(0.5 + q * 2.2); a.material.opacity = (1 - q) * 0.5; });
    tmpV.set(-1.9, 0.2, 0); trak.localToWorld(tmpV);
    damm.forEach((a, n) => { const q = (t * 0.45 + n / 8) % 1; if (q < 0.04) a.userData.p = tmpV.clone(); const b = a.userData.p || tmpV; a.position.set(b.x, b.y + q * 0.9, b.z); a.scale.setScalar(0.4 + q * 2.4); a.material.opacity = (1 - q) * 0.35; });
    far.forEach((f) => {
      const u = f.userData, d = dt || 0; let gar = false;
      if (u.vila > 0) { u.vila -= d; if (u.vila <= 0) nyPlats(u.mal); }
      else { const dx = u.mal.x - f.position.x, dz = u.mal.z - f.position.z, l = Math.hypot(dx, dz); if (l < 0.15) u.vila = 3 + r() * 7; else { vrid(f, dx, dz, d, 2.5); const fx = Math.cos(f.rotation.y), fz = -Math.sin(f.rotation.y), v = 0.32 * mjuk((1 - Math.abs(Math.atan2(Math.sin(Math.atan2(-dz, dx) - f.rotation.y), Math.cos(Math.atan2(-dz, dx) - f.rotation.y))) / 1.2)); f.position.x += fx * v * d; f.position.z += fz * v * d; gar = v > 0.05; u.gang += v * d * 9; } }
      u.amp = lerp(u.amp, gar ? 1 : 0, Math.min(1, d * 5));
      u.ben.forEach((b, k) => { b.rotation.z = Math.sin(u.gang + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.45 * u.amp; });
      u.hv.rotation.z = lerp(u.hv.rotation.z, gar ? 0.1 : -0.75 + Math.sin(t * 2.2 + u.fas) * 0.08, Math.min(1, d * 3));
      u.svans.rotation.y = Math.sin(t * 6 + u.fas) * 0.4;
    });
    ankor.forEach((a, n) => { const v = t * 0.07 - n * 0.16, x = sjoX + 8.6 + Math.cos(v) * 2, z = sjoZ + Math.sin(v) * 1.2; a.position.set(x, -0.57 + Math.sin(t * 2 + n) * 0.012, z); a.rotation.y = Math.atan2(-Math.cos(v) * 1.2, -Math.sin(v) * 2); a.userData.kolv.scale.setScalar(1 + Math.sin(t * 3 + n) * 0.15); a.userData.kolv.material.opacity = 0.22 + Math.sin(t * 3 + n) * 0.08; });
    fjarilar.forEach((f) => {
      const u = f.userData, d = dt || 0;
      if (u.vila > 0) {
        u.vila -= d; u.fart.multiplyScalar(0.9); u.oppen = 0.6 + Math.sin(t * 2.5 + u.fas) * 0.55;
        if (u.vila <= 0) blomma(u.mal, u.n);
      } else {
        fjStyr.subVectors(u.mal, f.position); const l = fjStyr.length();
        if (l < 0.12) { u.vila = 2 + r() * 4; }
        else { fjStyr.normalize().multiplyScalar(Math.min(1.3, 0.4 + l)); fjStyr.x += Math.sin(t * 3.1 + u.fas) * 0.5; fjStyr.y += Math.sin(t * 4.3 + u.fas) * 0.35; fjStyr.z += Math.cos(t * 2.7 + u.fas) * 0.5; u.fart.lerp(fjStyr, Math.min(1, d * 2.2)); }
        u.oppen = Math.sin(t * 24 + u.fas) * 0.65 + 0.35;
      }
      f.position.addScaledVector(u.fart, d); if (f.position.y < 0.15) f.position.y = 0.15;
      if (u.fart.lengthSq() > 0.01) { const mal = Math.atan2(u.fart.x, u.fart.z); let dd = mal - f.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); f.rotation.y += dd * Math.min(1, d * 6); }
      u.vingar.forEach((w) => { w.led.rotation.z = w.sd * u.oppen * 1.25; });
    });

    verk.forEach((v, n) => { v.rotation.z = t * (0.7 + n * 0.12); });
    bat.position.set(sjoX + Math.cos(t * 0.12) * 5.5, -0.38 + Math.sin(t * 1.6) * 0.05, sjoZ + Math.sin(t * 0.12) * 2.4); bat.rotation.y = -t * 0.12 - Math.PI / 2; bat.rotation.z = Math.sin(t * 1.3) * 0.05;
    ringar.forEach((q, n) => { const a = (t * 0.25 + n / 4) % 1; q.scale.setScalar(0.3 + a * 2.4); q.material.opacity = (1 - a) * 0.5; });
    vatten.material.color.setHSL(0.53, 0.3, 0.66 + Math.sin(t * 0.8) * 0.015);
  };
}
/* Fler verkliga detaljer per station: bodbod, truck, armering, personbilar och trädgård ------------- */
function personbil(farg) {
  const g = new THREE.Group(), lack = new THREE.MeshStandardMaterial({ color: farg, roughness: 0.25, metalness: 0.45 }), glas = M.glas();
  const kropp = lada(2.3, 0.5, 1.02, lack, 0.2); kropp.position.y = 0.5; g.add(kropp);
  const kupe = lada(1.25, 0.46, 0.92, lack, 0.18); kupe.position.set(-0.15, 0.92, 0); g.add(kupe);
  const rutor = lada(1.27, 0.32, 0.94, glas, 0.12); rutor.position.set(-0.15, 0.95, 0); g.add(rutor);
  [-1, 1].forEach((sd) => { const f = lada(0.04, 0.08, 0.2, LJUS_FRAM, 0.02); f.position.set(1.15, 0.58, sd * 0.36); g.add(f); const b = lada(0.04, 0.08, 0.22, LJUS_BAK, 0.02); b.position.set(-1.15, 0.6, sd * 0.36); g.add(b); });
  const hj = [0.72, -0.72].flatMap((x) => [-0.47, 0.47].map((z) => { const h = hjul(0.22, 0.16); h.position.set(x, 0.22, z); g.add(h); return h; }));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); g.userData.hjul = hj; return g;
}
function bodbod() {
  const g = new THREE.Group(), platM = new THREE.MeshStandardMaterial({ map: plat(), roughness: 0.55, metalness: 0.2 });
  const kropp = lada(3, 1.5, 1.3, platM, 0.05); kropp.position.y = 0.95; g.add(kropp);
  const tak = lada(3.1, 0.08, 1.4, M.stal, 0.02); tak.position.y = 1.74; g.add(tak);
  [-0.8, 0.4].forEach((x) => { const f = lada(0.6, 0.45, 0.05, M.glas(), 0.02); f.position.set(x, 1.15, 0.66); g.add(f); });
  const dorr = lada(0.5, 1.05, 0.05, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5 }), 0.02); dorr.position.set(1.15, 0.73, 0.66); g.add(dorr);
  const trappa = lada(0.7, 0.2, 0.5, M.stal, 0.02); trappa.position.set(1.15, 0.12, 0.95); g.add(trappa);
  [-1.3, 1.3].forEach((x) => [-0.5, 0.5].forEach((z) => { const b = lada(0.18, 0.2, 0.18, M.sockel, 0.02); b.position.set(x, 0.1, z); g.add(b); }));
  g.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); return g;
}
function truck() {
  const g = new THREE.Group();
  const kropp = lada(1.1, 0.55, 0.8, M.gul, 0.1); kropp.position.set(-0.1, 0.5, 0); g.add(kropp);
  const vikt = lada(0.3, 0.6, 0.8, M.mork, 0.08); vikt.position.set(-0.6, 0.55, 0); g.add(vikt);
  const stol = lada(0.35, 0.3, 0.4, M.svart, 0.06); stol.position.set(-0.15, 0.9, 0); g.add(stol);
  [[0.25, 0.32], [0.25, -0.32], [-0.45, 0.32], [-0.45, -0.32]].forEach(([x, z]) => { const s = lada(0.05, 1.1, 0.05, M.svart, 0); s.position.set(x, 1.3, z); g.add(s); });
  const skydd = lada(0.8, 0.05, 0.72, M.svart, 0.01); skydd.position.set(-0.1, 1.85, 0); g.add(skydd);
  const mast = new THREE.Group(); mast.position.x = 0.5; g.add(mast);
  [-0.25, 0.25].forEach((z) => { const m = lada(0.07, 1.9, 0.07, M.stal, 0); m.position.set(0, 1.05, z); mast.add(m); });
  const gaffel = new THREE.Group(); mast.add(gaffel);
  [-0.18, 0.18].forEach((z) => { const f = lada(0.9, 0.04, 0.1, M.stal, 0); f.position.set(0.48, 0, z); gaffel.add(f); });
  const pall = plankor(0, 0); pall.scale.setScalar(0.42); pall.position.set(0.5, 0.02, 0); gaffel.add(pall);
  const hj = [[0.3, 0.2], [-0.45, 0.17]].flatMap(([x, r]) => [-0.38, 0.38].map((z) => { const h = hjul(r, 0.14); h.position.set(x, r, z); g.add(h); return h; }));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); g.userData = { hjul: hj, gaffel }; return g;
}
function vrid(o, dx, dz, dt, fart = 4) { const mal = Math.atan2(-dz, dx); let d = mal - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * fart); }
function trygg(gb, mal, dt) { let d = mal - gb.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); gb.rotation.y += d * Math.min(1, dt * 5); }
function dekor2(st) {
  const lagg = (s, f) => { const gammal = s.userData.tick; s.userData.tick = (t, dt) => { gammal(t, dt); f(t, dt); }; };
  // 1: bodbod och utsättningspinnar med snöre
  const bod = bodbod(); bod.position.set(3.4, 0.06, 3.4); st[0].add(bod);
  const pinnar = [[-5.2, -3.8], [-2.6, -3.8], [-2.6, -2.4], [-5.2, -2.4]], snMat = new THREE.MeshBasicMaterial({ color: '#f07a3a' });
  pinnar.forEach(([x, z], n) => { const p = cyl(0.03, 0.03, 0.5, M.tra, 6); p.position.set(x, 0.3, z); st[0].add(p); const [x2, z2] = pinnar[(n + 1) % 4]; const l = Math.hypot(x2 - x, z2 - z); const sn = cyl(0.008, 0.008, l, snMat, 4); sn.rotation.z = Math.PI / 2; sn.rotation.y = -Math.atan2(z2 - z, x2 - x); sn.position.set((x + x2) / 2, 0.45, (z + z2) / 2); st[0].add(sn); });
  // 2: trucken kör pallar fram och tillbaka (backar i stället för att vända tvärt)
  const tr = truck(); tr.position.set(0, 0.06, 1.9); st[1].add(tr); let trX = null;
  lagg(st[1], (t, dt) => {
    const x = Math.sin(t * 0.35) * 2.8; if (trX !== null) tr.userData.hjul.forEach((h) => { h.rotation.z -= (x - trX) / 0.18; }); trX = x; tr.position.x = x;
    tr.userData.gaffel.position.y = 0.12 + Math.max(0, Math.sin(t * 0.35 + 1.6)) * 0.5;
  });
  // 3: armeringsnät innan plattan gjuts
  const arm = new THREE.Group(), armM = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.6, metalness: 0.5 });
  for (let x = -3.2; x <= 3.21; x += 0.4) { const b = cyl(0.015, 0.015, 4.4, armM, 4); b.rotation.x = Math.PI / 2; b.position.set(x, 0, 0); arm.add(b); }
  for (let z = -2.1; z <= 2.11; z += 0.4) { const b = cyl(0.015, 0.015, 6.6, armM, 4); b.rotation.z = Math.PI / 2; b.position.set(0, 0.03, z); arm.add(b); }
  arm.position.set(0.6, 0.32, -0.6); st[2].add(arm);
  const skott = grupp(lada(0.9, 0.35, 0.6, M.gul, 0.06), cyl(0.18, 0.18, 0.08, M.mork, 14)); skott.children[1].rotation.x = Math.PI / 2; skott.children[1].position.set(0.5, -0.12, 0); skott.position.set(-4.6, 0.3, 0.8); skott.rotation.y = 0.5; st[2].add(skott);
  lagg(st[2], (t) => { const p = (t % 10) / 10; arm.visible = p > 0.18 && p < 0.42; });
  // 5: besiktningsmannens bil på uppfarten
  const bb = personbil('#5b7f9e'); bb.position.set(-2.6, 0.06, 4.2); bb.rotation.y = 0; st[4].add(bb);
  // 6: familjens bil, trädgårdsmöbler och en gunga
  const fb = personbil('#7d2e2a'); fb.position.set(-3, 0.06, 2.9); st[5].add(fb);
  const bord = grupp(cyl(0.35, 0.35, 0.05, M.tra, 20), cyl(0.04, 0.04, 0.5, M.svart, 8)); bord.children[0].position.y = 0.52; bord.children[1].position.y = 0.26; bord.position.set(-1.8, 0.16, 2); st[5].add(bord);
  [-0.55, 0.55].forEach((dx) => { const s = grupp(lada(0.36, 0.05, 0.36, M.tra, 0.02), lada(0.36, 0.4, 0.05, M.tra, 0.02)); s.children[0].position.y = 0.32; s.children[1].position.set(0, 0.52, -0.16); s.position.set(-1.8 + dx, 0.16, 2); s.rotation.y = dx > 0 ? -Math.PI / 2 : Math.PI / 2; st[5].add(s); });
  const gstall = new THREE.Group(); [-0.8, 0.8].forEach((x) => [-1, 1].forEach((sd) => { const b = cyl(0.04, 0.04, 2.1, M.tra, 6); b.position.set(x, 1, sd * 0.3); b.rotation.x = sd * 0.25; gstall.add(b); })); const topp = cyl(0.05, 0.05, 1.8, M.tra, 8); topp.rotation.z = Math.PI / 2; topp.position.y = 2; gstall.add(topp);
  const gunga = new THREE.Group(); gunga.position.y = 2; gstall.add(gunga); [-0.2, 0.2].forEach((x) => { const r = cyl(0.01, 0.01, 1.5, M.svart, 4); r.position.set(x, -0.75, 0); gunga.add(r); }); const sits = lada(0.5, 0.05, 0.22, M.koppar, 0.02); sits.position.y = -1.5; gunga.add(sits);
  gstall.position.set(-4.4, 0.06, -1.6); gstall.rotation.y = 0.3; gstall.traverse((m) => { if (m.isMesh) m.castShadow = true; }); st[5].add(gstall);
  lagg(st[5], (t) => { gunga.rotation.x = Math.sin(t * 1.8) * 0.5; });
}
function omgivning(scen) {
  const nat = natur(scen);
  // lyktor längs gången
  const lMat = M.neon('#ffd9a0', 1.1);
  for (let x = -6; x < AVST * 5 + 8; x += 8) {
    const l = new THREE.Group(), stolpe = cyl(0.035, 0.06, 2.3, M.svart, 10); stolpe.position.y = 1.15; l.add(stolpe);
    const fot = cyl(0.12, 0.14, 0.12, M.svart, 12); fot.position.y = 0.06; l.add(fot);
    const armen = lada(0.5, 0.04, 0.04, M.svart, 0); armen.position.set(0, 2.25, -0.22); armen.rotation.y = Math.PI / 2; l.add(armen);
    const hus = lada(0.22, 0.08, 0.22, M.svart, 0.02); hus.position.set(0, 2.2, -0.45); l.add(hus);
    const glas = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 12), lMat); glas.position.set(0, 2.05, -0.45); l.add(glas);
    l.traverse((m) => { if (m.isMesh) m.castShadow = true; }); l.position.set(x, -0.55, 9.8); scen.add(l);
  }
  // moln som driver förbi
  const molnMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92 }), moln = [];
  for (let n = 0; n < 8; n++) {
    const c = new THREE.Group(); [[0, 0, 1.6], [1.5, -0.2, 1.2], [-1.4, -0.3, 1.1], [0.6, 0.6, 1]].forEach(([x, y, r]) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 4), molnMat); b.position.set(x, y, 0); b.scale.y = 0.7; b.castShadow = true; c.add(b); });
    c.position.set(n * 14 - 10, 15 + (n % 3) * 1.5, -16 + (n % 2) * 6); c.scale.setScalar(0.8 + (n % 3) * 0.25); scen.add(c); moln.push(c);
  }
  // fåglar
  const fKropp = new THREE.MeshStandardMaterial({ color: '#3d3833', roughness: 0.8 }), fVit = new THREE.MeshStandardMaterial({ color: '#efe9e0', roughness: 0.8 }), fNabb = new THREE.MeshStandardMaterial({ color: '#e9a25a', roughness: 0.5 }), faglar = [];
  for (let n = 0; n < 7; n++) {
    const f = new THREE.Group(), k = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), n % 3 ? fKropp : fVit); k.scale.set(0.8, 0.75, 1.7); f.add(k);
    const hu = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), fKropp); hu.position.set(0, 0.06, 0.28); f.add(hu);
    const nb = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 8), fNabb); nb.rotation.x = Math.PI / 2; nb.position.set(0, 0.05, 0.4); f.add(nb);
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), fKropp); st.scale.y = 0.25; st.rotation.x = -Math.PI / 2; st.position.z = -0.32; f.add(st);
    const vingar = [-1, 1].map((sd) => { const inre = new THREE.Group(); inre.position.set(sd * 0.1, 0.03, 0.02); f.add(inre); const a = lada(0.36, 0.025, 0.24, fKropp, 0.01); a.position.x = sd * 0.18; inre.add(a); const yttre = new THREE.Group(); yttre.position.x = sd * 0.36; inre.add(yttre); const b = lada(0.34, 0.02, 0.18, fKropp, 0.01); b.position.set(sd * 0.16, 0, -0.03); b.rotation.y = sd * 0.2; yttre.add(b); return { inre, yttre, sd }; });
    f.userData = { vingar, off: new THREE.Vector3((n % 3 - 1) * 1.6 - Math.floor(n / 3) * 0.4, (n % 2) * 0.5, -Math.floor(n / 3) * 1.4 - Math.abs(n % 3 - 1) * 0.9), fas: n * 0.9, roll: 0 };
    f.scale.setScalar(1.3); scen.add(f); faglar.push(f);
  }
  const flockBana = (t, ut) => ut.set(AVST * 2.5 + Math.sin(t * 0.045) * AVST * 3.2, 11 + Math.sin(t * 0.17) * 1.2, -6 + Math.sin(t * 0.09) * 9);
  const fp = new THREE.Vector3(), fp2 = new THREE.Vector3(), fram3 = new THREE.Vector3(), upp3 = new THREE.Vector3(0, 1, 0);
  // Legohus skåpbil i det närmre körfältet
  const bil = skapbil(); bil.position.set(-12, -0.52, 6.4); scen.add(bil);
  const tick = (t, dt, fokusX) => {
    nat(t, dt);
    moln.forEach((c) => { c.position.x += dt * 0.5; if (c.position.x > AVST * 5 + 40) c.position.x = -40; const kant = mjuk(Math.min(c.position.x + 40, AVST * 5 + 40 - c.position.x) / 18); c.scale.setScalar((c.userData.bas || (c.userData.bas = c.scale.x)) * Math.max(0.001, kant)); });
    flockBana(t, fp); flockBana(t + 0.5, fp2); fram3.subVectors(fp2, fp).normalize(); const kurs = Math.atan2(fram3.x, fram3.z);
    flockBana(t + 1.5, fp2); const sving = Math.atan2(fp2.x - fp.x, fp2.z - fp.z) - kurs;
    faglar.forEach((f) => {
      const u = f.userData; tmp.copy(u.off).applyAxisAngle(upp3, kurs); f.position.copy(fp).add(tmp); f.position.y += Math.sin(t * 0.8 + u.fas) * 0.25;
      u.roll = lerp(u.roll, klamp(-Math.atan2(Math.sin(sving), Math.cos(sving)) * 1.2, -0.6, 0.6), Math.min(1, dt * 2));
      f.rotation.set(-fram3.y * 0.8, kurs, u.roll, 'YXZ');
      const slag = mjuk((Math.sin(t * 0.5 + u.fas) + 0.3) * 1.5), v = Math.sin(t * 11 + u.fas);
      u.vingar.forEach((w) => { w.inre.rotation.z = w.sd * (v * 0.65 * slag + (1 - slag) * 0.08); w.yttre.rotation.z = w.sd * (v * 0.45 * slag - 0.05); });
    });
    const fart = 3.4; bil.position.x += dt * fart; if (bil.position.x > AVST * 5 + 40) bil.position.x = -40;
    bil.position.y = -0.52 + Math.abs(Math.sin(t * 9)) * 0.01; bil.userData.hjul.forEach((h) => { h.rotation.z -= (dt * fart) / bil.userData.r; });
    lMat.emissiveIntensity = (1 + Math.sin(t * 1.5) * 0.15) * TV.lykta / 1.1;
  };
  tick.molnMat = molnMat; return tick;
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
  [[-5.5, -4.1], [5.5, -4.1], [-5.5, 1.5], [5.5, 1.5], [0, -4.1]].forEach(([x, z]) => { const p = lada(0.22, 5, 0.22, M.stal, 0.02); p.position.set(x, 2.6, z); hall.add(p); });
  const platM = new THREE.MeshStandardMaterial({ map: plat(), roughness: 0.6, metalness: 0.25 });
  const bak = lada(11.2, 4.4, 0.14, platM, 0.02); bak.position.set(0, 2.3, -4.1); hall.add(bak);
  [-1, 1].forEach((sd) => { const v = lada(0.14, 4.4, 4.2, platM, 0.02); v.position.set(sd * 5.5, 2.3, -2); hall.add(v); const port = lada(0.16, 1.4, 2.6, new THREE.MeshStandardMaterial({ color: '#c98a45', roughness: 0.5, metalness: 0.3 }), 0.02); port.position.set(sd * 5.52, 0.9, -1.4); hall.add(port); });
  const skylt = lada(3.4, 0.6, 0.06, new THREE.MeshStandardMaterial({ color: '#1b1915', roughness: 0.4 }), 0.05); skylt.position.set(0, 4.05, -4.0); hall.add(skylt);
  for (let n = 0; n < 3; n++) { const tand = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.2, 1.2, 3, 1), new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide })); tand.rotation.set(Math.PI / 2, Math.PI / 6, 0); tand.scale.set(1.9, 2.8, 1); tand.position.set(-3.6 + n * 3.6, 5.6, -1.3); tand.castShadow = true; hall.add(tand); }
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
    bygge.position.y = 0.17 - mjuk((p - 0.9) / 0.1) * 3;
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
  const motvikt = lada(0.4, 0.62, 1.32, M.mork, 0.12); motvikt.position.set(-1.08, 0.45, 0); topp.add(motvikt);
  const avgas = cyl(0.05, 0.05, 0.5, M.svart, 8); avgas.position.set(-0.6, 1.05, -0.42); topp.add(avgas);
  [-0.76, 0.76].forEach((z) => { [-0.75, -0.25, 0.25, 0.75].forEach((x) => { const r = cyl(0.12, 0.12, 0.05, M.stal, 14); r.rotation.x = Math.PI / 2; r.position.set(x, 0.18, z); grav.add(r); }); [-0.95, 0.95].forEach((x) => { const d = cyl(0.2, 0.2, 0.06, M.stal, 10); d.rotation.x = Math.PI / 2; d.position.set(x, 0.25, z); grav.add(d); }); });
  const hytt = lada(0.7, 0.8, 0.9, M.glas(), 0.1); hytt.position.set(0.25, 1.1, 0.15); topp.add(hytt);
  const bom = new THREE.Group(); bom.position.set(0.6, 0.7, 0); topp.add(bom);
  const b1 = lada(1.9, 0.22, 0.24, M.gul, 0.05); b1.position.x = 0.95; bom.add(b1);
  const led = new THREE.Group(); led.position.x = 1.9; bom.add(led);
  const b2 = lada(1.3, 0.18, 0.2, M.gul, 0.05); b2.position.x = 0.65; led.add(b2);
  const skopa = lada(0.45, 0.4, 0.5, M.mork, 0.05); skopa.position.x = 1.3; led.add(skopa);
  for (let n = 0; n < 4; n++) { const tand = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), M.stal); tand.rotation.z = -Math.PI / 2; tand.position.set(0.3, -0.18, -0.18 + n * 0.12); skopa.add(tand); }
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
  // lastbilen kör på vägen i det bortre körfältet
  const bil = lastbil(); g.add(bil); const VAG_Z = 8.2, VAG_Y = -0.52; let forraX = null;
  // kranen
  const kran = new THREE.Group(); kran.position.set(-5.2, 0, 2.2); g.add(kran);
  const fot = lada(1.4, 0.3, 1.4, M.mork, 0.05); fot.position.y = 0.15; kran.add(fot);
  [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([x, z]) => { const st = lada(0.07, 7.4, 0.07, M.gul, 0); st.position.set(x, 3.85, z); kran.add(st); });
  const diag = Math.hypot(0.44, 0.6), vinkel = Math.atan2(0.6, 0.44);
  for (let y = 0.45; y < 7.4; y += 0.6) for (let f = 0; f < 4; f++) { const s = lada(diag, 0.035, 0.035, M.gul, 0); const sd = (f % 2 ? 1 : -1) * ((y / 0.6) % 2 < 1 ? 1 : -1); s.rotation.z = vinkel * sd; const q = new THREE.Group(); q.add(s); q.rotation.y = (f * Math.PI) / 2; s.position.set(0, y + 0.3, 0.22); kran.add(q); }
  const arm = new THREE.Group(); arm.position.y = 7.6; kran.add(arm);
  [[-0.15, -0.15], [-0.15, 0.15], [0.22, 0]].forEach(([y, z]) => { const c = lada(9.4, 0.06, 0.06, M.gul, 0); c.position.set(3.1, y, z); arm.add(c); });
  for (let x = -1.4; x < 7.8; x += 0.5) [-0.15, 0.15].forEach((z) => { const s = lada(0.62, 0.035, 0.035, M.gul, 0); s.position.set(x + 0.25, 0.035, z * 0.5); s.rotation.z = ((x * 2) % 2 < 1 ? 1 : -1) * 0.65; s.rotation.y = z > 0 ? -0.25 : 0.25; arm.add(s); });
  const kab = grupp(lada(0.7, 0.65, 0.7, M.vit, 0.06), lada(0.72, 0.35, 0.6, M.glas(), 0.03)); kab.children[1].position.set(0.05, 0.08, 0.06); kab.position.set(0.35, -0.6, 0.55); arm.add(kab);
  const mot = lada(1.4, 0.7, 0.8, M.betong, 0.05); mot.position.x = -1.5; arm.add(mot);
  const topplamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.neon('#ff4a3a', 4)); topplamp.position.set(0, 0.4, 0); arm.add(topplamp);
  const vajer = cyl(0.02, 0.02, 1, M.mork, 6); arm.add(vajer);
  const krok = lada(0.3, 0.3, 0.3, M.gul, 0.05); arm.add(krok);
  const lokalt = new THREE.Vector3();
  g.userData.tick = (t) => {
    const p = (t % 22) / 22;
    // 0–0.32 bilen bromsar in längs vägen, 0.34–0.68 kranen lyfter, 0.7–0.78 sätter ner, 0.8–1 bilen kör vidare
    const inX = lerp(-64, 1.4, ut(p / 0.32)), utX = lerp(1.4, 48, Math.pow(klamp((p - 0.8) / 0.2, 0, 1), 2));
    const bx = p < 0.8 ? inX : utX; bil.position.set(bx, VAG_Y, VAG_Z);
    if (forraX !== null) { const steg = bx - forraX; if (Math.abs(steg) < 5) bil.userData.hjul.forEach((w) => { w.rotation.z -= steg / bil.userData.r; }); }
    forraX = bx; bil.position.y = VAG_Y + (Math.abs(bx - 1.4) > 0.05 ? Math.abs(Math.sin(t * 11)) * 0.012 : 0);
    const lyft = mjuk((p - 0.34) / 0.34);
    const fran = new THREE.Vector3(bil.position.x + 0.2, VAG_Y + bil.userData.flak, VAG_Z), till = new THREE.Vector3(-1.2, 0.42, -1.6);
    const pa = p < 0.34 ? fran : p < 0.68 ? new THREE.Vector3(lerp(fran.x, till.x, lyft), lerp(fran.y, till.y, lyft) + Math.sin(lyft * Math.PI) * 3.4, lerp(fran.z, till.z, lyft)) : till;
    h.scale.setScalar(p > 0.95 ? Math.max(0.001, 1 - mjuk((p - 0.95) / 0.05)) : 1);
    h.position.copy(pa); h.rotation.y = p < 0.34 ? 0 : p < 0.68 ? Math.sin(lyft * Math.PI) * 0.12 : 0;
    h.userData.glas.emissiveIntensity = p > 0.7 ? 0.6 : 0.12;
    // armen pekar mot huset, vajern hänger ner till taket
    lokalt.set(h.position.x - kran.position.x, 0, h.position.z - kran.position.z);
    arm.rotation.y = -Math.atan2(lokalt.z, lokalt.x); const r = Math.min(9.6, Math.max(1.5, lokalt.length()));
    const topp = h.position.y + (h.userData.hojd || 3) + 0.2; const lang = Math.max(0.3, 7.6 - topp);
    krok.position.set(r, -lang, 0); vajer.position.set(r, -lang / 2, 0); vajer.scale.y = lang; vajer.visible = krok.visible = p < 0.74;
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
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); // kantutjämningen sker i composer-målet (samples: 4)
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scen = new THREE.Scene(); scen.background = himmel(); scen.fog = new THREE.Fog(HORISONT, 70, 140);
  const pmrem = new THREE.PMREMGenerator(renderer); scen.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scen.environmentIntensity = 0.3;
  const kamera = new THREE.PerspectiveCamera(30, 2, 0.5, 200);
  const hemi = new THREE.HemisphereLight('#e4f0f6', '#a4b07f', 0.6); scen.add(hemi);
  const sol = new THREE.DirectionalLight('#fff0d8', 2.8); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0003; sol.shadow.normalBias = 0.035;
  Object.assign(sol.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 1, far: 110 }); scen.add(sol, sol.target);
  // vägen och den lysande banan genom alla steg
  const vag = lada(AVST * 5 + 90, 0.06, 3.6, new THREE.MeshStandardMaterial({ map: GRUS, roughness: 0.95 }), 0.03); vag.position.set(AVST * 2.5, -0.55, 7.5); scen.add(vag);
  for (let x = -44; x < AVST * 5 + 44; x += 1.6) { const s = lada(0.5, 0.02, 0.08, new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.9 }), 0); s.position.set(x, -0.5, 7.4); scen.add(s); }
  const banaPunkter = []; for (let n = 0; n <= 5; n++) banaPunkter.push(new THREE.Vector3(n * AVST, 0.2, 5.6));
  const bana = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(banaPunkter), 200, 0.04, 8), M.neon('#e9a25a', 1.2)); scen.add(bana);
  const pulser = []; for (let n = 0; n < 6; n++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.neon('#ffd9a0', 2.2)); scen.add(p); pulser.push(p); }
  const modeller = IH.MODELLER || [];
  const mod = (n) => modeller[n % Math.max(1, modeller.length)];
  const stationer = [station1(mod(1)), station2(mod(2)), station3(), station4(mod(0)), station5(mod(3)), station6(mod(4))];
  stationer.forEach((s, n) => { s.position.x = n * AVST; scen.add(s); });
  dekor(stationer); dekor2(stationer); const omg = omgivning(scen);
  // efterbehandlingen: neonen och fönstren glöder
  const mal = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(renderer, mal); comp.addPass(new RenderPass(scen, kamera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.35, 0.4, 1.6); comp.addPass(bloom); comp.addPass(new OutputPass());
  S = { omg, hemi, renderer, scen, kamera, sol, comp, bloom, stationer, pulser, el: null, nu: 0, mal: new THREE.Vector3(), mot: new THREE.Vector3(), auto: !LUGN, hel: true, zoom: 1, pan: 0, drag: null, paus: 0, t: 0, synlig: false, ram: 0, klocka: new THREE.Clock() };
  S.mot.set(0, 1.2, 0); S.kamPos = new THREE.Vector3(30, 60, 110);
  temaStart();
  renderer.domElement.className = 'resa3d__duk';
  // dra för att panorera när man har zoomat in, nyp eller Ctrl + hjul för att zooma
  const duk = renderer.domElement;
  duk.addEventListener('pointerdown', (ev) => { S.drag = { x: ev.clientX, pan: S.pan }; duk.setPointerCapture(ev.pointerId); });
  duk.addEventListener('pointermove', (ev) => {
    if (!S.drag || S.hel) return;
    if (S.auto && Math.abs(ev.clientX - S.drag.x) > 5) { S.auto = false; S.paus = 0; uppdateraUi(); }
    S.pan = S.drag.pan - (ev.clientX - S.drag.x) / duk.clientWidth * S.halvB * 2; starta();
  });
  const stral = new THREE.Raycaster(), musp = new THREE.Vector2();
  duk.addEventListener('pointerup', (ev) => {
    const d = S.drag; S.drag = null; if (!d || Math.abs(ev.clientX - d.x) > 5) return;
    const rr = duk.getBoundingClientRect(); musp.set(((ev.clientX - rr.left) / rr.width) * 2 - 1, -((ev.clientY - rr.top) / rr.height) * 2 + 1);
    stral.setFromCamera(musp, S.kamera); const tr = stral.intersectObjects(S.stationer, true)[0]; if (!tr) return;
    let o = tr.object; while (o && !S.stationer.includes(o)) o = o.parent; if (o) { S.auto = false; ga(S.stationer.indexOf(o), true); }
  });
  duk.addEventListener('pointercancel', () => { S.drag = null; });
  duk.addEventListener('wheel', (ev) => { if (!ev.ctrlKey) return; ev.preventDefault(); zooma(ev.deltaY > 0 ? 1 : -1, 1 + Math.min(0.4, Math.abs(ev.deltaY) / 200)); }, { passive: false });
  new IntersectionObserver((r) => { S.synlig = r[0].isIntersecting; if (S.synlig) starta(); }, { threshold: 0.05 }).observe(renderer.domElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) starta(); });
  addEventListener('resize', storlek);
}
/* Temat ------------------------------------------------------------------------------------------- */
// Himlen, dimman, marken, ljuset, neonen, lyktorna och molnen följer CRM:ets tema (--t-3d-… i CSS). Scenen byggs
// alltid i Original och ställs sedan om; vid temabyte tonas färgerna och ljuset över på drygt en halv sekund.
// Saknas en variabel (eller temat) gäller Original-värdet, så Original ritas exakt som förut.
const TV = { lykta: 1.1 };
const TEMA0 = { 'himmel-topp': '#b7d3e0', 'himmel-mitt': '#dfe9e6', horisont: HORISONT, mark: '#c3cf9d', 'hemi-upp': '#e4f0f6', 'hemi-ned': '#a4b07f', sol: '#fff0d8', neon: '#e9a25a', lykta: '#ffd9a0', moln: '#ffffff', 'sol-styrka': 2.8, 'hemi-styrka': 0.6, exponering: 0.95, 'lykta-styrka': 1.1 };
const TEMA_MS = 650, GLAS0 = new THREE.Color('#ffb05a'), MANSKEN = new THREE.Color('#7d8aa6');
function temaLas() {
  const cs = getComputedStyle(document.documentElement), u = {};
  for (const k in TEMA0) {
    const v = cs.getPropertyValue('--t-3d-' + k).trim();
    u[k] = typeof TEMA0[k] === 'number' ? (Number.isFinite(parseFloat(v)) ? parseFloat(v) : TEMA0[k]) : (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(v) ? v : TEMA0[k]);
  }
  return u;
}
// målet: färger som THREE.Color, tal, och himlens strängar (så att slutbilden ritas med exakt samma värden)
function temaMal(u) {
  const natt = klamp(1 - u['sol-styrka'] / 2.8, 0, 1), C = (x) => new THREE.Color(x);
  return {
    f: { hor: C(u.horisont), mark: C(u.mark), hu: C(u['hemi-upp']), hn: C(u['hemi-ned']), sol: C(u.sol), neon: C(u.neon), lykta: C(u.lykta), moln: C(u.moln), topp: C(u['himmel-topp']), mitt: C(u['himmel-mitt']) },
    n: { sol: u['sol-styrka'], hemi: u['hemi-styrka'], exp: u.exponering, lykta: u['lykta-styrka'], bloom: 0.35 + natt * 0.25, env: 0.3 * (1 - natt * 0.6), glas: 1 + natt * 4, molnGlod: natt * 0.5 },
    s: [u['himmel-topp'], u['himmel-mitt'], u.horisont]
  };
}
function temaBlanda(a, b, p) {
  const f = {}, n = {}; for (const k in a.f) f[k] = a.f[k].clone().lerp(b.f[k], p); for (const k in a.n) n[k] = lerp(a.n[k], b.n[k], p);
  return { f, n, s: null };
}
function temaSatt(v) {
  const T = S.temaObj, f = v.f, n = v.n;
  S.hemi.color.copy(f.hu); S.hemi.groundColor.copy(f.hn); S.hemi.intensity = n.hemi;
  S.sol.color.copy(f.sol); S.sol.intensity = n.sol;
  S.scen.fog.color.copy(f.hor); if (T.mark) T.mark.color.copy(f.mark); if (T.moln) { T.moln.color.copy(f.moln); T.moln.emissive.copy(MANSKEN).multiplyScalar(n.molnGlod); }
  // på kvällen lyser fönstren starkare (glasets glöd gånger n.glas; i dagsljus exakt som förut)
  T.glas.forEach((m) => m.emissive.copy(GLAS0).multiplyScalar(n.glas));
  T.neon.forEach((m) => { m.color.copy(f.neon); m.emissive.copy(f.neon); });
  T.lykta.forEach((m) => { m.color.copy(f.lykta); m.emissive.copy(f.lykta); });
  S.renderer.toneMappingExposure = n.exp; TV.lykta = n.lykta; S.bloom.strength = n.bloom; S.scen.environmentIntensity = n.env;
  const s = v.s || [f.topp.getStyle(), f.mitt.getStyle(), f.hor.getStyle()], nyckel = s.join();
  if (nyckel !== S.himmelNu) { S.himmelNu = nyckel; const bg = S.scen.background, c = bg.image; ritaHimmel(c.getContext('2d'), c.width, c.height, s[0], s[1], s[2]); bg.needsUpdate = true; }
  S.temaNu = v;
}
function temaStart() {
  // materialen som byter färg letas upp på sina Original-färger: neonen, lyktorna och pulserna
  const neon = new Set(), lykta = new Set(), glas = new Set();
  S.scen.traverse((o) => { const m = o.material; if (!m || !m.emissive || !m.color) return; const c = m.color.getHexString(), em = m.emissive.getHexString(); if (c === 'e9a25a' && em === 'e9a25a') neon.add(m); else if (c === 'ffd9a0' && em === 'ffd9a0') lykta.add(m); else if (em === 'ffb05a' && c === '40525c') glas.add(m); });
  const mark = S.scen.getObjectByName('mark');
  S.temaObj = { neon: [...neon], lykta: [...lykta], glas: [...glas], mark: mark && mark.material, moln: S.omg.molnMat };
  S.himmelNu = ['#b7d3e0', '#dfe9e6', HORISONT].join();
  const u = temaLas(); S.temaNyckel = JSON.stringify(u); temaSatt(temaMal(u));
}
function temaByt() {
  if (!S || !S.temaObj) return;
  const u = temaLas(), nyckel = JSON.stringify(u); if (nyckel === S.temaNyckel) return; S.temaNyckel = nyckel;
  const till = temaMal(u);
  // syns inte scenen (eller minskad rörelse): direkt till målet, annars en mjuk övertoning i bildrutorna
  if (LUGN || !S.ram || !S.synlig || document.hidden) { S.temaAnim = null; temaSatt(till); starta(); return; }
  S.temaAnim = { fran: S.temaNu, till, t0: performance.now() };
}
function temaSteg() {
  const A = S.temaAnim, p = mjuk((performance.now() - A.t0) / TEMA_MS);
  if (p >= 1) { S.temaAnim = null; temaSatt(A.till); } else temaSatt(temaBlanda(A.fran, A.till, p));
}
function storlek() {
  if (!S || !S.el) return;
  const w = S.el.clientWidth, h = S.el.clientHeight; if (!w || !h) return;
  S.renderer.setSize(w, h, false); S.comp.setSize(w, h); S.bloom.resolution.set(w / 2, h / 2);
  S.kamera.aspect = w / h; S.kamera.fov = w < 640 ? 40 : 28; S.kamera.updateProjectionMatrix(); starta();
}
function ga(n, narma) { S.nu = (n + 6) % 6; S.pan = 0; if (narma) { S.hel = false; S.zoom = 1; } uppdateraUi(); }
// uppspelningen: hela resan en stund, sedan flyger kameran steg för steg och till sist tillbaka till hela resan
// (smala skärmar hoppar över översikten, där blir stationerna för små)
function spela(dt) {
  S.paus += dt; if (S.paus < (S.hel ? 4 : 7)) return; S.paus = 0;
  const smal = S.el && S.el.clientWidth < 640;
  if (S.hel) { S.hel = false; S.zoom = 1.25; ga(0); }
  else if (S.nu === 5 && !smal) { S.hel = true; S.zoom = 1; S.pan = 0; uppdateraUi(); }
  else ga(S.nu + 1);
}
// ut (+1) eller in (-1); längst ut visas hela resan
function zooma(rikt, steg = 1.35) {
  if (rikt > 0) { if (S.hel) return; S.zoom *= steg; if (BAS * S.zoom >= S.hela * 0.97) S.hel = true; }
  else if (S.hel) { S.hel = false; S.zoom = S.hela / BAS / steg; } else S.zoom = Math.max(0.55, S.zoom / steg);
  uppdateraUi();
}
function uppdateraUi() {
  if (!S || !S.el) return;
  const steg = IH.PROJSTEG[S.nu], ui = S.el.querySelector('[data-resa-text]');
  // texten byts bara när innehållet ändras, så att kortet inte blinkar vid varje klick
  const pavag = (IH.db.projekt || []).filter((p) => IH.PROJSTEG.some((s, k) => s.id === p.steg && k < 5)).length;
  const html = S.hel
    ? '<span class="resa3d__nr resa3d__nr--hel">' + IKON.hel + '</span><span><small>Hela resan · 6 steg</small><b>Från ritning till nyckel</b><em>' + (pavag ? pavag + ' hus är på väg just nu. Klicka på ett steg för att flyga dit.' : 'Klicka på ett steg för att flyga dit.') + '</em></span>'
    : '<span class="resa3d__nr">' + (S.nu + 1) + '</span><span><small>Steg ' + (S.nu + 1) + ' av 6</small><b>' + e(steg.namn) + '</b><em>' + e(steg.text) + '</em></span>';
  if (ui && ui.dataset.html !== html) { ui.dataset.html = html; ui.innerHTML = html; ui.classList.remove('byter'); void ui.offsetWidth; ui.classList.add('byter'); }
  const kn = S.el.querySelector('[data-resa-auto]'); if (kn) { kn.setAttribute('aria-pressed', String(S.auto)); kn.title = S.auto ? 'Pausa resan' : 'Spela resan'; kn.setAttribute('aria-label', kn.title); kn.innerHTML = (S.auto ? IKON.paus : IKON.spela) + '<span>' + (S.auto ? 'Pausa' : 'Spela') + '</span>'; }
  S.el.querySelectorAll('[data-resa-hel]').forEach((hk) => hk.setAttribute('aria-pressed', String(S.hel)));
  S.el.classList.toggle('resa3d--hel', S.hel);
  S.el.querySelectorAll('.resa3d__nal').forEach((b) => b.classList.toggle('resa3d__nal--nu', !S.hel && +b.dataset.i === S.nu));
  starta();
  S.el.querySelectorAll('[data-resa-prick]').forEach((p, k) => p.setAttribute('aria-current', String(k === S.nu)));
  const blk = S.el.closest('.prodblock--fabrik'); if (blk) { blk.querySelectorAll('.fabrik__station').forEach((s, k) => { s.classList.toggle('resa-nu', k === S.nu); s.classList.toggle('resa-forbi', k < S.nu); }); const f = blk.querySelector('.fabrik'); if (f) f.style.setProperty('--nu', S.nu); }
}
function nalar() {
  // kundernas hus som nålar på sitt steg
  const lager = S.el.querySelector('[data-resa-nalar]'); if (!lager) return;
  const proj = (IH.db.projekt || []).filter((p) => IH.PROJSTEG.some((s) => s.id === p.steg));
  lager.innerHTML = IH.PROJSTEG.map((st, i) => {
    const l = proj.filter((p) => p.steg === st.id); if (!l.length) return '';
    const forst = (p) => { const k = IH.kund(p.kund); return k ? k.namn.split(' ')[0] : 'Projekt'; }, bild = (p) => { const m = IH.modell && IH.modell(p.modell); return m ? m.tumme : ''; };
    if (l.length === 1) { const m = IH.modell && IH.modell(l[0].modell); return '<button type="button" class="resa3d__nal" data-g="proj-oppna" data-id="' + l[0].id + '" data-i="' + i + '"><img src="' + e(bild(l[0])) + '" alt=""><span><b>' + e(forst(l[0])) + '</b><small>' + e(m ? m.namn : '') + '</small></span></button>'; }
    return '<button type="button" class="resa3d__nal resa3d__nal--flera" data-g="steg-hus" data-steg="' + st.id + '" data-i="' + i + '"><span class="resa3d__bilder">' + l.slice(0, 3).map((p) => '<img src="' + e(bild(p)) + '" alt="">').join('') + '</span><span><b>' + l.length + ' hus</b><small>' + e(forst(l[0])) + ' +' + (l.length - 1) + '</small></span></button>';
  }).join('');
}
const tmp = new THREE.Vector3(), OFF = new THREE.Vector3(-5, 13, 42).normalize(), BAS = 44.6;
// ikonerna i reglagen (paus = två rundade streck, spela = rundad triangel, hela resan = ramhörn)
const IKON = {
  paus: '<svg class="emo-ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11M15 6.5v11"/></svg>',
  spela: '<svg class="emo-ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.2v11.6a1 1 0 0 0 1.5.86l9-5.8a1 1 0 0 0 0-1.72l-9-5.8a1 1 0 0 0-1.5.86z" stroke-linejoin="round"/></svg>',
  hel: '<svg class="emo-ik" aria-hidden="true"><use href="#i-helskarm"/></svg>'
};
function placeraNalar() {
  const w = S.el.clientWidth, h = S.el.clientHeight;
  S.el.querySelectorAll('.resa3d__nal').forEach((b) => {
    const i = +b.dataset.i;
    tmp.set(i * AVST - 1, 6.6, -2.5).project(S.kamera);
    const syns = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
    b.style.transform = 'translate(' + ((tmp.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - tmp.y) / 2 * h).toFixed(1) + 'px) translate(-50%,-100%)' + (!S.hel && i === S.nu ? ' scale(1.06)' : '');
    b.style.opacity = syns ? 1 : 0; b.style.pointerEvents = syns ? '' : 'none';
  });
}
function starta() { if (S && !S.ram && S.synlig && !document.hidden && S.el && S.el.isConnected) { S.klocka.getDelta(); S.ram = requestAnimationFrame(ram); } }
function ram() {
  // S.ram är satt medan bildrutan ritas, så att starta() inifrån (ga, storlek) inte startar en andra slinga
  S.ram = -1;
  if (!S.el || !S.el.isConnected || !S.synlig || document.hidden) { S.ram = 0; return; }
  const dt = Math.min(0.05, S.klocka.getDelta()); S.t += LUGN ? 0 : dt;
  if (S.auto && !LUGN) spela(dt);
  // kameran: hela resan på en gång, eller inzoomad på steget; den glider mjukt och vaggar lite
  const halv = Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(S.kamera.fov / 2)) * S.kamera.aspect));
  S.hela = (AVST * 5 + 13) / 2 / halv;
  const dist = S.hel ? S.hela : klamp(BAS * S.zoom, 20, S.hela), halvB = dist * halv * 0.92; S.halvB = halvB;
  // marken och vägen räcker en station till åt båda hållen, så att även första och sista steget kan hamna mitt i bild
  const lo = halvB - 7 - AVST, hi = AVST * 5 + 7 + AVST - halvB;
  const x = S.hel || lo >= hi ? AVST * 2.5 : klamp(S.nu * AVST + S.pan, lo, hi); if (!S.hel && lo < hi) S.pan = x - S.nu * AVST;
  const sv = LUGN ? 0 : Math.sin(S.t * 0.25) * dist * 0.03;
  tmp.set(x - 0.5, 1.2 + dist * 0.035, -0.6); S.mal.copy(OFF).multiplyScalar(dist).add(tmp); S.mal.x += sv; S.mal.y += Math.sin(S.t * 0.3) * 0.5;
  const fart = S.drag ? 0.00001 : 0.0015;
  // minskad rörelse: kameran står direkt på målet
  if (LUGN) { S.kamPos.copy(S.mal); S.mot.copy(tmp); } else { S.kamPos.lerp(S.mal, 1 - Math.pow(fart, dt)); S.mot.lerp(tmp, 1 - Math.pow(fart, dt)); }
  const nu = S.kamPos.distanceTo(S.mot); S.scen.fog.near = Math.max(nu * 1.6, 70); S.scen.fog.far = Math.max(nu * 3.6, 200);
  const sk = S.sol.shadow.camera, sb = halvB + 9; if (Math.abs(sk.right - sb) > 0.5) { sk.left = -sb; sk.right = sb; sk.top = sb * 0.7; sk.bottom = -sb * 0.7; sk.updateProjectionMatrix(); }
  S.kamera.position.copy(S.kamPos); S.kamera.lookAt(S.mot);
  S.sol.position.set(S.mot.x + 22, 34, S.mot.z - 12); S.sol.target.position.copy(S.mot);
  S.stationer.forEach((s, n) => { if (Math.abs(n * AVST - S.mot.x) < halvB + AVST * 0.6) s.userData.tick(S.t + n * 1.7, dt); s.userData.kant.material.emissiveIntensity = n === S.nu && !S.hel ? 2.2 + Math.sin(S.t * 3) * 0.3 : n === S.nu ? 1.4 : 0.15; });
  S.pulser.forEach((p, n) => { const a = ((S.t * 0.09 + n / 6) % 1); p.position.set(a * AVST * 5, 0.2, 5.6); p.scale.setScalar(0.7 + Math.sin(S.t * 6 + n) * 0.25); });
  S.omg(S.t, dt, S.mot.x); TRAD.forEach((t) => { t.rotation.z = Math.sin(S.t * 1.2 + t.userData.vaj) * 0.035; });
  if (S.temaAnim) temaSteg();
  S.comp.render(dt);
  placeraNalar();
  // minskad rörelse: en stillbild som ritas om vid klick, dragning och storleksändring
  if (LUGN) { S.ram = 0; return; }
  S.ram = requestAnimationFrame(ram);
}
function montera(el) {
  if (!harWebgl()) { el.remove(); return; }
  if (!S) bygg(el);
  S.el = el;
  // smala skärmar börjar inzoomade på ett steg: hela resan blir bara en tunn remsa där
  if (el.clientWidth && el.clientWidth < 640 && S.hel) { S.hel = false; S.zoom = 1; S.pan = 0; }
  el.innerHTML = '<div class="resa3d__lager"><div class="resa3d__text" data-resa-text aria-live="polite"></div>' +
    '<div class="resa3d__nalar" data-resa-nalar></div>' +
    '<div class="resa3d__fot"><button type="button" class="resa3d__pil" data-resa-bak aria-label="Föregående steg"><svg class="emo-ik" aria-hidden="true"><use href="#i-pil-v"/></svg></button>' +
      '<span class="resa3d__prickar">' + IH.PROJSTEG.map((s, n) => '<button type="button" data-resa-prick="' + n + '" title="' + e(s.namn) + '"><i></i><span>' + e(s.kort) + '</span></button>').join('') + '</span>' +
      '<button type="button" class="resa3d__pil" data-resa-fram aria-label="Nästa steg"><svg class="emo-ik" aria-hidden="true"><use href="#i-pil"/></svg></button>' +
      '<button type="button" class="resa3d__auto" data-resa-auto></button>' +
      '<button type="button" class="resa3d__hel resa3d__hel--fot" data-resa-hel aria-label="Hela resan">' + IKON.hel + '</button></div>' +
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
  if (LUGN) [500, 1500].forEach((ms) => setTimeout(starta, ms));
}
if (IH) {
  const sok = () => { const el = document.querySelector('[data-resa3d]:not([data-monterad])'); if (el) { el.setAttribute('data-monterad', ''); montera(el); } };
  new MutationObserver(sok).observe(document.body, { childList: true, subtree: true });
  sok();
  // temabytet: attributet data-tema, temamotorns händelser och systemets mörka läge (när man följer systemet)
  const temaLyss = () => queueMicrotask(temaByt);
  new MutationObserver(temaLyss).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  ['ih:tema', 'tema-byte'].forEach((n) => { addEventListener(n, temaLyss); document.addEventListener(n, temaLyss); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', temaLyss);
}
