// version: 2026-11-14 04:00
// husritare-bil.js – en elbil på en parkeringsyta vid entrén, laddbox på fasaden och en laddkabel
// in i bilens laddlucka. Laddboxen och luckan pulserar mjukt i grön neon.
//
// Bilen och laddboxen är förenklade GLB-modeller (images/3d/elbil.glb ~150k trianglar,
// images/3d/laddbox.glb ~6k), utan märken eller text. De laddas en gång och flyttas mellan husen.
// Misslyckas laddningen står en enkel egen bil (byggd i kod) i stället.
// Laddluckan hittas med en stråle mot karossen; snön (vinter) byggs ur ett höjdfält av karossens ovansida.
// Lacken är metallic med klarlack som speglar scenens miljö (se lackeraBil).
// Neon: emissiva material + glorior (inga nya ljuskällor). Pulsen (period 1,5 s) går på
// miljöns VU.uTid, så den rör sig bara när miljöns liv går; minskad rörelse ger ett stilla sken.
// Klar laddning skickar händelsen 'husritare:nytt' (motorn ritar då om bilden och skuggan).
//
// API (från husritare-miljo.js):
//   const bil = skapaBil(THREE, rot, VU);
//   bil.planera(mal, H)   // väljer plats (fri från altan, trappor, sidodörrar), lägger gången runt huset,
//                         // uppfarten och pollarnas platser (mal.pollare) och utökar
//                         // mal.blockerad så att träd, buskar, stenar och gräs håller sig borta
//   bil.satt(namn, mal)   // ställer bilen, bygger ytan, laddboxen och kabeln för huset
//   bil.dispose()
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';

const NEON = '#3dff8a';
let LADDA = null;                         // delas mellan alla anrop: modellerna hämtas en gång per sida
function hamtaModeller() {
  if (!LADDA) {
    const l = new GLTFLoader();
    const en = url => new Promise((ok, fel) => l.load(url, g => ok(g.scene), undefined, fel));
    LADDA = Promise.allSettled([en(new URL('images/3d/elbil.glb?v=3', import.meta.url).href), en(new URL('images/3d/laddbox.glb', import.meta.url).href)]);
  }
  return LADDA;
}

export function skapaBil(THREE, rot, VU) {
  const skrap = [];
  const spara = o => { skrap.push(o); return o; };
  const mjuk = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lugn = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PU = { uRor: { value: lugn ? 0 : 1 } };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const grupp = new THREE.Group(); grupp.name = 'elbil'; rot.add(grupp);
  const bilen = new THREE.Group(); bilen.name = 'bil'; grupp.add(bilen);   // bilens ram: x framåt, +z mot väggen
  const husGrupp = new THREE.Group(); husGrupp.name = 'laddplats'; grupp.add(husGrupp);   // byggs om per hus
  let plats = null, miljo = 'studio', mal0 = null, dod = false;

  // ---- pulsen: samma uttryck i alla neondelar ----
  const PULS = `
    float pPuls = mix( 0.82, 0.5 + 0.5 * sin( uTid * 4.18879 ), uRor );
    float pNatt = max( uNatt, uLampa );`;
  const neonUni = s => { s.uniforms.uTid = VU.uTid; s.uniforms.uNatt = VU.uNatt; s.uniforms.uLampa = VU.uLampa; s.uniforms.uRor = PU.uRor; return 'uniform float uTid;\nuniform float uNatt;\nuniform float uLampa;\nuniform float uRor;\n'; };
  // själva neonlisten: mättad grön, ljusare på kvällen
  const neonMat = spara(new THREE.MeshBasicMaterial({ color: NEON, toneMapped: false, fog: false }));
  neonMat.onBeforeCompile = s => {
    s.fragmentShader = neonUni(s) + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${PULS}
      diffuseColor.rgb *= ( 0.42 + 0.58 * pPuls ) * ( 0.8 + 0.35 * pNatt );`);
  };
  // glorian: mjuk prick som adderas, svag på dagen
  const gloriaTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,.55)'); r.addColorStop(0.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = spara(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function gloriaMat(dag, natt) {
    const m = spara(new THREE.SpriteMaterial({ map: gloriaTex, color: NEON, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
    m.onBeforeCompile = s => {
      s.fragmentShader = neonUni(s) + s.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        ${PULS}
        diffuseColor.a *= mix( ${dag.toFixed(2)}, ${natt.toFixed(2)}, pNatt ) * ( 0.3 + 0.7 * pPuls );`);
    };
    return m;
  }
  const gloriaBox = gloriaMat(0.22, 0.95), gloriaPort = gloriaMat(0.16, 0.8);
  // ljuspöl på marken/väggen under boxen (bara kväll)
  const polMat = spara(new THREE.MeshBasicMaterial({ map: gloriaTex, color: NEON, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -6 }));
  polMat.onBeforeCompile = s => {
    s.fragmentShader = neonUni(s) + s.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      ${PULS}
      diffuseColor.a *= 0.32 * pNatt * ( 0.45 + 0.55 * pPuls );`);
  };

  // ---- material ----
  const kabelMat = spara(new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.55, metalness: 0 }));
  const plastMat = spara(new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.4, metalness: 0.1 }));
  const kontaktMat = spara(new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.35, metalness: 0 }));
  // snön på bilen: kornig nysnö. Vinterljuset är starkt, så färgen hålls grå (annars blir den utfrätt vit);
  // kornen i en egen karta och lätt ojämn yta (bumpMap). Natt: mörknar som marken.
  const snoKorn = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = (s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(29);
    g.fillStyle = '#9ea7b4'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2600; k++) { const v = 150 + r() * 26; g.fillStyle = `rgba(${v - 8 | 0},${v - 2 | 0},${v + 8 | 0},.5)`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 7, 0, 6.283); g.fill(); }
    for (let k = 0; k < 2500; k++) { const v = 190 + r() * 40; g.fillStyle = `rgba(${v | 0},${v | 0},${v + 6 | 0},.55)`; g.fillRect(r() * 256, r() * 256, 1, 1); }
    const t = spara(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const snoMat = spara(new THREE.MeshStandardMaterial({ map: snoKorn, bumpMap: snoKorn, bumpScale: 0.25, roughness: 0.92, metalness: 0, emissive: 0x111a28, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  snoMat.onBeforeCompile = s => {
    s.uniforms.uNatt = VU.uNatt;
    s.vertexShader = 'attribute float aSno;\nvarying float vSno;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSno = aSno;');
    s.fragmentShader = 'uniform float uNatt;\nvarying float vSno;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if ( vSno < 0.006 ) discard;\n diffuseColor.rgb *= 1.0 - 0.45 * uNatt;');
  };
  const skuggMat = spara(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -6 }));

  // ---- marktexturer (ritas en gång): betongplattor, grus och packad snö ----
  const TEX = {};
  function duk(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
  function slump(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  const markTex = {
    plattor() {      // 2 × 2 m: 4 × 4 plattor à 50 cm, fogar och lite smuts
      const [c, g] = duk(512), r = slump(77);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const v = 146 + r() * 20; g.fillStyle = `rgb(${v | 0},${v - 4 | 0},${v - 10 | 0})`; g.fillRect(i * 128, j * 128, 128, 128);   // grå betong (ljusare blev vitt i solen)
        for (let k = 0; k < 500; k++) { const w = v - 25 + r() * 50; g.fillStyle = `rgba(${w | 0},${w - 4 | 0},${w - 10 | 0},.35)`; g.fillRect(i * 128 + r() * 128, j * 128 + r() * 128, 2, 2); }
        const gr = g.createLinearGradient(i * 128, j * 128, i * 128 + 128, j * 128 + 128); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.07)'); g.fillStyle = gr; g.fillRect(i * 128, j * 128, 128, 128);
      }
      g.fillStyle = 'rgba(60,54,46,.75)'; for (let i = 0; i < 4; i++) { g.fillRect(i * 128, 0, 3, 512); g.fillRect(0, i * 128, 512, 3); }
      return [c, 2];
    },
    grus() {         // 1,5 m: tätt med små stenar i grått och beige
      const [c, g] = duk(512), r = slump(91);
      g.fillStyle = '#857c6c'; g.fillRect(0, 0, 512, 512);   // naturgrus som uppfarten i skogen
      for (let k = 0; k < 16000; k++) {
        const x = r() * 512, y = r() * 512, s = 1.5 + r() * 3.5, v = 88 + r() * 92, t = r() * 16;
        g.fillStyle = `rgb(${v + t | 0},${v + t * 0.5 | 0},${v - 6 | 0})`; g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(30,26,20,.25)'; g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.35, s, s * 0.5, 0, 0, 6.283); g.fill();
      }
      return [c, 1.5];
    },
    sno() {          // packad snö med svaga hjulspår
      const [c, g] = duk(512), r = slump(13);
      g.fillStyle = '#7f8896'; g.fillRect(0, 0, 512, 512);   // skottad: gråare än nysnön, med grus som skymtar
      for (let k = 0; k < 9000; k++) { const v = 140 + r() * 60; g.fillStyle = `rgba(${v - 10 | 0},${v - 4 | 0},${v | 0},.45)`; g.fillRect(r() * 512, r() * 512, 2 + r() * 4, 1 + r() * 2); }
      for (let k = 0; k < 3200; k++) { const v = 105 + r() * 50; g.fillStyle = `rgba(${v | 0},${v - 4 | 0},${v - 10 | 0},.4)`; g.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
      return [c, 2];
    },
  };
  function tex(namn) {
    if (TEX[namn]) return TEX[namn];
    const [c, m] = markTex[namn]();
    const t = spara(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / m, 1 / m); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (TEX[namn] = t);
  }
  const ytMat = {};
  function yta(namn) {
    if (ytMat[namn]) return ytMat[namn];
    const m = spara(new THREE.MeshStandardMaterial({ map: tex(namn), roughness: namn === 'sno' ? 0.8 : 0.95, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 }));
    if (namn === 'sno') m.emissive.set(0x141c2c);
    // natt: ytan mörknar som miljöns mark (den lyste annars ljust i månskenet)
    m.onBeforeCompile = s => { s.uniforms.uNatt = VU.uNatt; s.fragmentShader = 'uniform float uNatt;\n' + s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1.0 - 0.45 * uNatt;'); };
    return (ytMat[namn] = m);
  }

  // ---- bilen ----
  const BIL = { klar: false, port: null, portN: null, langd: 4.7, bredd: 1.95 };
  // Bilarna att välja på (modell()). rot: modellens vridning i bilens ram (laddluckans sida blir +z, mot boxen):
  // Teslan har luckan bak till höger, Volvon (laddhybrid) på vänstra framskärmen – båda hamnar i bilens bortre
  // ände från väggen, så kabelns väg blir densamma. hj: hjulens mått (radie, axelavstånd, bakaxel, styrvinkel).
  const BILAR = {
    tesla: { rot: Math.PI / 2, hj: { R: 0.405, WB: 3.019, bak: 1.573, styr0: -0.3979 }, neon: NEON, klar: false },
    volvo: { rot: -Math.PI / 2, hj: { R: 0.372, WB: 2.865, bak: 1.336, styr0: 0 }, neon: '#9fd6ff', klar: false,
      portFr: [[0.27, 0.86], [0.25, 0.84], [0.29, 0.88], [0.26, 0.8], [0.23, 0.9], [0.31, 0.82]] },
  };
  let MODELL = 'tesla';
  function sparaMatt(namn, yt) {
    BILAR[namn].yt = yt; BILAR[namn].klar = true;
    BILAR[namn].matt = { langd: BIL.langd, bak: BIL.bak, port: BIL.port.clone(), portN: BIL.portN.clone(), bredd: BIL.bredd };
  }
  const ray = new THREE.Raycaster();
  function trafa(mal, fran, rikt) { ray.set(fran, rikt); ray.far = 10; const h = ray.intersectObject(mal, true); return h.length ? h[0] : null; }
  function mattBil(obj, FR = [[0.085, 0.88], [0.155, 0.82], [0.14, 0.78], [0.17, 0.86], [0.13, 0.74]]) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj); BIL.langd = b.max.x - b.min.x; BIL.bak = b.min.x;
    // laddluckan: bak på högra sidan (+z), på bakskärmen bakom hjulet (kabeln hänger då fritt bakom däcket,
    // inte över fälgen), där strålen träffar karossen
    let h = null;
    for (const [fx, y] of FR) { h = trafa(obj, V(b.min.x + BIL.langd * fx, y, 3), V(0, 0, -1)); if (h) break; }
    if (h) {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : V(0, 0, 1);
      if (n.z < 0.3) n.set(0, 0, 1);
      BIL.port = h.point.clone(); BIL.portN = V(n.x * 0.5, 0, n.z).normalize();      // luckan står lodrätt
    } else { BIL.port = V(b.min.x + BIL.langd * 0.155, 0.82, 0.92); BIL.portN = V(0, 0, 1); }
    // sidans läge mitt på (för avståndet till väggen)
    const s = trafa(obj, V(0, 0.6, 3), V(0, 0, -1)); BIL.bredd = s ? s.point.z * 2 : 1.95;
  }
  // Snö på tak, motorhuv, baklucka och speglar (ytor som pekar uppåt), med tjocklek och rundade kanter.
  // Karossens översta yta rastreras uppifrån till ett höjdfält (3 cm rutor; ingen strålkastning mot
  // 100 000 trianglar). Snön är tjockast på plana ytor och tunnas ut mot branta; mot kanterna (där ytan
  // tar slut, blir brant eller tar ett steg) rundas den av som en kvarts cirkel. Rutorna (mörkt i färg-
  // kartan ovanför bröstlinjen) får bara snö där de är nästan plana (glastaket) och en liten vall i
  // nederkanten, där snön glidit ned mot motorhuven/bagageluckan. Sidorna och dörrarna är för branta.
  function snoTacke(obj) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    const D = 0.02, x0 = b.min.x + 0.02, z0 = b.min.z - 0.02;
    const NX = Math.ceil((b.max.x - 0.02 - x0) / D) + 1, NZ = Math.ceil((b.max.z + 0.02 - z0) / D) + 1, N = NX * NZ;
    const Y = new Float32Array(N).fill(-1), NY = new Float32Array(N), NXs = new Float32Array(N), NZs = new Float32Array(N), MORK = new Uint8Array(N);
    const a = V(), bb = V(), c = V(), na = V(), nb = V(), nc = V();
    obj.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index;
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      // färgkartan i liten upplösning: mörkt = ruta/plast
      let pix = null, PW = 0;
      const bild = o.material && o.material.map && o.material.map.image;
      if (bild && uv) {
        try { PW = 256; const cv = document.createElement('canvas'); cv.width = cv.height = PW; const cg = cv.getContext('2d', { willReadFrequently: true }); cg.drawImage(bild, 0, 0, PW, PW); pix = cg.getImageData(0, 0, PW, PW).data; } catch (e) { pix = null; }
      }
      const P = new Float32Array(pos.count * 3), Nn = nor ? new Float32Array(pos.count * 3) : null;
      for (let i = 0; i < pos.count; i++) {
        a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); P[i * 3] = a.x; P[i * 3 + 1] = a.y; P[i * 3 + 2] = a.z;
        if (Nn) { na.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); Nn[i * 3] = na.x; Nn[i * 3 + 1] = na.y; Nn[i * 3 + 2] = na.z; }
      }
      const T = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < T; t++) {
        const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromArray(P, ia * 3); bb.fromArray(P, ib * 3); c.fromArray(P, ic * 3);
        const ux = bb.x - a.x, uz = bb.z - a.z, vx = c.x - a.x, vz = c.z - a.z, det = ux * vz - uz * vx;
        if (Math.abs(det) < 1e-9) continue;
        const i0 = Math.max(0, Math.ceil((Math.min(a.x, bb.x, c.x) - x0) / D)), i1 = Math.min(NX - 1, Math.floor((Math.max(a.x, bb.x, c.x) - x0) / D));
        const j0 = Math.max(0, Math.ceil((Math.min(a.z, bb.z, c.z) - z0) / D)), j1 = Math.min(NZ - 1, Math.floor((Math.max(a.z, bb.z, c.z) - z0) / D));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const px = x0 + i * D - a.x, pz = z0 + j * D - a.z;
          const s = (px * vz - pz * vx) / det, r = (ux * pz - uz * px) / det, q = 1 - s - r;
          if (s < -1e-6 || r < -1e-6 || q < -1e-6) continue;
          const y = q * a.y + s * bb.y + r * c.y, k = i * NZ + j;
          if (y <= Y[k]) continue;
          Y[k] = y;
          if (Nn) {
            na.fromArray(Nn, ia * 3).multiplyScalar(q).add(nb.fromArray(Nn, ib * 3).multiplyScalar(s)).add(nc.fromArray(Nn, ic * 3).multiplyScalar(r)).normalize();
          } else na.set(0, 1, 0);
          NY[k] = na.y; NXs[k] = na.x; NZs[k] = na.z;
          if (pix) {
            const u = q * uv.getX(ia) + s * uv.getX(ib) + r * uv.getX(ic), v = q * uv.getY(ia) + s * uv.getY(ib) + r * uv.getY(ic);
            const px2 = Math.min(PW - 1, Math.max(0, Math.floor((u - Math.floor(u)) * PW))), py2 = Math.min(PW - 1, Math.max(0, Math.floor((v - Math.floor(v)) * PW)));
            const o4 = (py2 * PW + px2) * 4;
            MORK[k] = (pix[o4] + pix[o4 + 1] + pix[o4 + 2]) / 3 < 85 ? 1 : 0;
          } else MORK[k] = 0;
        }
      }
    });
    const id = (i, j) => i * NZ + j, in_ = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ;
    // mörk andel i omgivningen (7 × 7 rutor): rutor och strålkastare är stora mörka fält, fogar och
    // lister smala; speglingar i glaset (ljusare i kartan) fylls i. Mjuk övergång, inga trappsteg.
    const GF = new Float32Array(N);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const k = id(i, j); if (Y[k] < 0.78) continue;
      let n = 0, m = 0;
      for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) if (in_(i + di, j + dj)) { n++; m += MORK[id(i + di, j + dj)]; }
      GF[k] = m / n;
    }
    const glas = k => Y[k] > 0.95 && GF[k] > 0.4;
    // tjocklek före avrundning: plana ytor ~7 cm, branta tunnare, under motorhuvens höjd ingen snö
    const djup = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      if (Y[k] < 0.78 || NY[k] < 0.62) continue;
      let d = 0.075 * mjuk(0.62, 0.9, NY[k]);
      if (Y[k] > 0.95) d *= 1 - mjuk(0.25, 0.55, GF[k]) * (1 - mjuk(0.95, 0.985, NY[k]));   // vind- och bakruta: snön glider av, glastaket behåller den
      else d *= 1 - mjuk(0.4, 0.6, GF[k]);                                                // strålkastare och svarta fält
      djup[k] = d;
    }
    // vallen i rutornas nederkant: följ lutningen nedåt till lacken (motorhuv/baklucka) inom 16 cm
    const vall = new Float32Array(N);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const k = id(i, j);
      if (Y[k] < 0.95 || !glas(k) || NY[k] < 0.4 || NY[k] > 0.96) continue;
      const h = Math.hypot(NXs[k], NZs[k]) || 1, dx = NXs[k] / h, dz = NZs[k] / h;
      if (Math.abs(dx) < 0.8) continue;                  // bara vind- och bakruta (lutar framåt/bakåt), inte sidorutorna
      for (let s = 1; s <= 8; s++) {
        const ii = Math.round(i + dx * s), jj = Math.round(j + dz * s);
        if (!in_(ii, jj)) break;
        const kk = id(ii, jj);
        if (Y[kk] < 0.78) break;
        if (!glas(kk)) { if (djup[kk] > 0) vall[k] = 0.05 * (1 - (s - 1) / 8); break; }
      }
    }
    for (let k = 0; k < N; k++) djup[k] = Math.max(djup[k], vall[k]);
    // mjukare övergångar (två varv utjämning av tjockleken, bara mellan rutor på samma yta)
    for (let v = 0; v < 2; v++) {
      const ny = djup.slice();
      for (let i = 1; i < NX - 1; i++) for (let j = 1; j < NZ - 1; j++) {
        const k = id(i, j); if (djup[k] <= 0) continue;
        let s = 0, w = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const kk = id(i + di, j + dj); if (Math.abs(Y[kk] - Y[k]) > 0.05) continue;
          const ww = di || dj ? 1 : 2; s += djup[kk] * ww; w += ww;
        }
        ny[k] = s / w;
      }
      djup.set(ny);
    }
    // avstånd till kanten (m): kant = ingen snö, utanför bilen eller ett steg > 5 cm
    const avst = new Float32Array(N).fill(9);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const k = id(i, j);
      if (djup[k] <= 0.004) { avst[k] = 0; continue; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!in_(i + di, j + dj)) { avst[k] = 0; break; }
        if (Math.abs(Y[id(i + di, j + dj)] - Y[k]) > 0.05) { avst[k] = Math.min(avst[k], D * 0.5); }
      }
    }
    const R2 = Math.SQRT2 * D;
    for (let v = 0; v < 2; v++) {
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
        const k = id(i, j); if (!avst[k]) continue;
        for (const [di, dj, w] of v ? [[1, 0, D], [0, 1, D], [1, 1, R2], [1, -1, R2]] : [[-1, 0, D], [0, -1, D], [-1, -1, R2], [-1, 1, R2]]) {
          if (in_(i + di, j + dj)) avst[k] = Math.min(avst[k], avst[id(i + di, j + dj)] + w);
        }
      }
      if (!v) for (let i = NX - 1; i >= 0; i--) for (let j = NZ - 1; j >= 0; j--) {
        const k = id(i, j); if (!avst[k]) continue;
        for (const [di, dj, w] of [[1, 0, D], [0, 1, D], [1, 1, R2], [1, -1, R2]]) if (in_(i + di, j + dj)) avst[k] = Math.min(avst[k], avst[id(i + di, j + dj)] + w);
      }
    }
    // rundad kant: mjukt avrundad över 10–14 cm, och lite ojämnt (vind, smältning)
    const brus = (x, z) => 0.5 + 0.25 * Math.sin(x * 5.1 + Math.sin(z * 3.7) * 1.3) + 0.25 * Math.sin(z * 7.3 - x * 2.2 + 1.7);
    const ut = new Float32Array(N);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const k = id(i, j); if (djup[k] <= 0.004 || !avst[k]) continue;
      const R = Math.min(0.16, 0.08 + djup[k]), t = Math.min(1, avst[k] / R);
      ut[k] = djup[k] * t * t * (3 - 2 * t) * (0.82 + 0.3 * brus(x0 + i * D, z0 + j * D));
    }
    // ett varv utjämning till: trappstegen i rutnätet syns inte i kanten
    { const u2 = ut.slice(); for (let i = 1; i < NX - 1; i++) for (let j = 1; j < NZ - 1; j++) { const k = id(i, j); if (!ut[k]) continue; let s = 0; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) s += ut[id(i + di, j + dj)]; u2[k] = Math.min(ut[k], s / 9); } ut.set(u2); }
    // ytan: höjdfältet + snön, något utjämnat (karossens buckliga yta syns inte genom snön)
    const P = [], UV = [], SN = [], I = [], nr = new Int32Array(N).fill(-1);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const k = id(i, j); if (Y[k] < 0.78) continue;
      let s = 0, w = 0;
      for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
        if (!in_(i + di, j + dj)) continue; const kk = id(i + di, j + dj);
        if (Math.abs(Y[kk] - Y[k]) > 0.06) continue; s += Y[kk]; w++;
      }
      const yy = Y[k] + ut[k] + Math.max(-0.025, Math.min(0.025, s / w - Y[k])) * Math.min(1, ut[k] / 0.03) + 0.003;
      SN.push(ut[k]);
      nr[k] = P.length / 3; P.push(x0 + i * D, yy, z0 + j * D); UV.push((x0 + i * D) * 1.5, (z0 + j * D) * 1.5);
    }
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NZ - 1; j++) {
      const A = id(i, j), B = id(i + 1, j), C = id(i, j + 1), E = id(i + 1, j + 1);
      if (nr[A] < 0 || nr[B] < 0 || nr[C] < 0 || nr[E] < 0) continue;
      if (Math.max(ut[A], ut[B], ut[C], ut[E]) < 0.004) continue;
      const ys = [Y[A], Y[B], Y[C], Y[E]]; if (Math.max(...ys) - Math.min(...ys) > 0.025) continue;
      if (Math.min(NY[A], NY[B], NY[C], NY[E]) < 0.5) continue;           // aldrig ned på branta ytor (inga istappar av trianglar)
      I.push(nr[A], nr[C], nr[B], nr[B], nr[C], nr[E]);
    }
    const g = spara(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    g.setAttribute('aSno', new THREE.Float32BufferAttribute(SN, 1));   // tjockleken: kanten skärs av där snön är 6 mm (mjuk kontur, inga rutor)
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, snoMat); m.name = 'snoPaBilen'; m.castShadow = true; m.receiveShadow = true; m.visible = false;
    return m;
  }
  function lackera(obj) {
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const s = o.material;
      // lack med klarlack: klarlackens styrka följer färgkartans röda kanal (vit lack = full, däck/glas svagt)
      const m = spara(new THREE.MeshPhysicalMaterial({
        map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, metalnessMap: s.metalnessMap,
        roughness: 1, metalness: 1, clearcoat: 0.85, clearcoatRoughness: 0.1, clearcoatMap: s.map, envMapIntensity: 1.1,
      }));
      if (s.normalMap) m.normalScale.set(0.6, 0.6);
      s.dispose(); o.material = m;
      skrap.push(o.geometry);
    });
  }
  // Bilen: originalets färgkarta och normalkarta, men egna material per del. Modellens metall/råhets-
  // karta är brus (däck och rutor var lika metalliska som lacken), så delarna känns igen i shadern:
  // hjulen på läget (två cirklar i sidled), rutorna = mörkt ovanför bröstlinjen, bakljusen = rött,
  // resten ljust = lack. Lacken är metallic med klarlack, glimmer (flingor som tonar bort på avstånd
  // så att de inte flimrar) och utjämnad normalkarta; klarlacken speglar scenens miljö (scene.environment).
  // Vinter: lätt frost på rutorna (uFrost). (Modellen är bantad till 100 000 hörn; märken som i originalet.)
  const BU = { uFrost: { value: 0 } };
  function lackeraBil(obj) {
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const s = o.material;
      if (s.map) s.map.anisotropy = 8;
      // normalkartan är nästan helt slät och metall/råhetskartan brus: de används inte och släpps
      // (2048² + 1024² som aldrig laddas upp till grafikkortet)
      for (const t of ['normalMap', 'roughnessMap', 'metalnessMap']) if (s[t]) { const bild = s[t].image; s[t].dispose(); if (bild && bild.close) bild.close(); }
      const m = bilMat(s.map);
      s.dispose(); o.material = m;
      skrap.push(o.geometry);
    });
  }
  // lackens material; R (bara kopiorna som kör, se rigg): hjulen rullar och styr, lyktor och egen lackfärg.
  // Utan R blir skuggaren exakt som den parkerade bilens.
  function bilMat(map, R = null) {
    {
      const m = spara(new THREE.MeshPhysicalMaterial({
        map, roughness: 0.4, metalness: 0.5,
        clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.0,
      }));
      if (R) m.customProgramCacheKey = () => 'elbil-rigg-' + (R.hjul ? 'h' : 'k') + (R.forbi ? 'f' : '');
      m.onBeforeCompile = sh => {
        sh.uniforms.uFrost = BU.uFrost; sh.uniforms.uNatt = VU.uNatt;
        sh.vertexShader = 'varying vec3 vBP;\nvarying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBP = position; vBN = normal;');
        sh.fragmentShader = 'varying vec3 vBP;\nvarying vec3 vBN;\nuniform float uFrost;\nuniform float uNatt;\nfloat bHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }\n' + sh.fragmentShader
          .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          // rensning: registreringsskylten blank och inga märken på huv och baklucka (kartans kludd målas över med lack)
          float bSkylt = step( vBP.z, -2.0 ) * ( 1.0 - smoothstep( 0.308, 0.326, abs( vBP.x - 0.005 ) ) ) * ( 1.0 - smoothstep( 0.062, 0.076, abs( vBP.y - 0.7235 ) ) );
          float bMarke = ( 1.0 - smoothstep( 0.05, 0.07, abs( vBP.x ) ) ) * max( step( 1.9, vBP.z ) * ( 1.0 - smoothstep( 0.03, 0.045, abs( vBP.y - 0.7925 ) ) ), step( vBP.z, -1.9 ) * ( 1.0 - smoothstep( 0.018, 0.028, abs( vBP.y - 1.118 ) ) ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.46, 0.47, 0.49 ), max( bSkylt, bMarke ) );
          vec3 bS = pow( max( diffuseColor.rgb, 0.0 ), vec3( 0.4545 ) );
          float bL = dot( bS, vec3( 0.3333 ) );
          float bSat = max( bS.r, max( bS.g, bS.b ) ) - min( bS.r, min( bS.g, bS.b ) );
          float bRod = smoothstep( 0.12, 0.26, bSat ) * step( bS.g * 1.25, bS.r );
          float bMork = ( 1.0 - smoothstep( 0.13, 0.26, bL ) ) * ( 1.0 - bRod );
          // hjulen (uppmätt i modellen): nav i x = ±0,83, y = 0,40, z = 1,446 fram / −1,573 bak, ytterradie 0,405,
          // fälgradie 0,315. Framhjulen står styrda 22,8° – de mäts i hjulets egen ram (bT längs axeln, utåt +).
          float bSx = vBP.x < 0.0 ? -1.0 : 1.0;
          float bFram = step( 0.0, vBP.z );
          vec3 bD = vBP - vec3( bSx * 0.83, 0.40, mix( -1.573, 1.446, bFram ) );
          float bT = mix( bD.x, bD.x * 0.922 + bD.z * 0.388, bFram ) * bSx;
          float bR = length( vec2( bD.y, mix( bD.z, bD.z * 0.922 - bD.x * 0.388, bFram ) ) );
          // hela däcket ut till slitbanan (0,405) är gummi (färgkartan har ljusa fläckar där, som lyste som lack);
          // utanför det räknas bara det mörka som däck, så att lacken aldrig blir gummi
          float bHjul = max( 1.0 - smoothstep( 0.398, 0.407, bR ), ( 1.0 - smoothstep( 0.405, 0.418, bR ) ) * bMork ) * smoothstep( -0.19, -0.15, bT );
          float bDack = bHjul * smoothstep( 0.305, 0.325, bR );
          float bFalg = bHjul - bDack;
          // hjulhusen: ytor runt hjulet som vetter in mot navet är alltid svart plast
          float bRr = max( length( bD.yz ), 0.001 );
          float bHus = ( 1.0 - bHjul ) * smoothstep( 0.25, 0.5, -dot( normalize( vBN ).yz, bD.yz ) / bRr ) * ( 1.0 - smoothstep( 0.58, 0.64, bRr ) ) * ( 1.0 - smoothstep( 0.84, 0.9, vBP.y ) );
          float bEj = ( 1.0 - bHjul ) * ( 1.0 - bHus );
          float bHog = smoothstep( 0.93, 1.0, vBP.y );
          float bLykta = bMork * ( 1.0 - bHog ) * bEj * smoothstep( 1.55, 1.7, vBP.z ) * smoothstep( 0.6, 0.66, vBP.y );   // strålkastarnas glas
          float bGlas = bMork * bHog * bEj;
          float bPlast = bMork * ( 1.0 - bHog ) * bEj - bLykta + bHus;
          float bLack = ( 1.0 - bMork ) * ( 1.0 - bRod ) * bEj;
          float bRodU = bRod * bEj;                                      // lyktor och reflexer (bromsoken hör till fälgen)
          // glimmer: små flingor (3 mm) som bara syns nära; på avstånd jämnas de ut till ett lugnt glitter
          float bFw = length( fwidth( vBP ) );
          float bFl = bHash( floor( vBP * 330.0 ) );
          float bNara = 1.0 - smoothstep( 0.0006, 0.0025, bFw );
          // lacken: en jämn pärlvit ton; kartans fläckar och inbakade skuggor dämpas till 40 %
          float bLum = clamp( dot( diffuseColor.rgb, vec3( 0.3333 ) ) / 0.46, 0.0, 1.0 );
          vec3 bLackF = vec3( 0.525, 0.535, 0.55 ) * mix( bLum, 1.0, 0.6 );
          diffuseColor.rgb = mix( diffuseColor.rgb, bLackF, bLack );
          // fälgen: ren metall i två toner (kartans ljusa ekrar mot mörka mellanrum, utan inbakade blänk),
          // röda bromsok och en slät navkåpa
          float bEker = smoothstep( 0.30, 0.46, bL ) * ( 1.0 - bRod );
          vec3 bFalgF = mix( vec3( 0.015, 0.015, 0.017 ), vec3( 0.36, 0.37, 0.39 ), bEker );
          bFalgF = mix( bFalgF, vec3( 0.30, 0.02, 0.02 ), bRod );
          float bNav = 1.0 - smoothstep( 0.035, 0.05, bR );
          bFalgF = mix( bFalgF, vec3( 0.2, 0.2, 0.21 ), bNav );
          bEker = mix( bEker, 1.0, bNav );
          diffuseColor.rgb = mix( diffuseColor.rgb, bFalgF, bFalg );
          // däcken: matt svart gummi, däcksidan en aning blankare än slitbanan
          float bSida = smoothstep( 0.325, 0.34, bR ) * ( 1.0 - smoothstep( 0.37, 0.39, bR ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.02, 0.02, 0.022 ) + 0.006 * bSida, bDack );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012, 0.012, 0.014 ), bHus );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012, 0.014, 0.017 ), bGlas * 0.8 );    // tonade rutor
          // frost: ljusare, mattare rutor med ett fint mönster
          float bFrost = uFrost * bGlas * ( 0.7 + 0.3 * sin( vBP.x * 6.0 + sin( vBP.z * 5.0 + vBP.y * 7.0 ) * 2.0 ) ) * ( 1.0 - 0.5 * smoothstep( 1.3, 1.45, vBP.y ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.3, 0.33, 0.37 ), bFrost * 0.32 );
          metalnessFactor = bLack * 0.3 + bFalg * bEker * 0.85;
          roughnessFactor = bLack * ( 0.34 + 0.1 * ( bFl - 0.5 ) * bNara ) + bGlas * mix( 0.1, 0.5, bFrost ) + bDack * mix( 0.93, 0.74, bSida )
            + bFalg * mix( 0.6, 0.3, bEker ) + bPlast * 0.6 + bLykta * 0.12 + bRodU * 0.18;
          float bCc = bLack + bGlas * 0.6 * ( 1.0 - 0.8 * bFrost ) + bLykta + bRodU + bFalg * bEker * 0.35 + bPlast * 0.1;
          // baklyktorna glöder svagt i mörker
          totalEmissiveRadiance += vec3( 0.5, 0.012, 0.008 ) * ( bRodU * step( vBP.z, -1.8 ) * uNatt * 0.45 );`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          // flingorna lutar lite åt olika håll: små gnistor i solen (bara nära)
          normal = normalize( normal + bLack * bNara * 0.06 * ( vec3( bHash( floor( vBP * 330.0 ) + 7.0 ), bHash( floor( vBP * 330.0 ) + 13.0 ), bHash( floor( vBP * 330.0 ) + 29.0 ) ) - 0.5 ) );`)
          .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          material.clearcoat *= bCc;`);
        if (R) riggShader(sh, R, map);
      };
      return m;
    }
  }
  // Kopian som kör: hjulen är en egen del (samma hörn, egen indexlista, se delaModell). Framhjulen räta
  // först upp (modellen står styrd 22,8°), rullar kring axeln och styrs sedan med uStyr (uStyr = −0,3979
  // och uRull = 0 ger exakt den parkerade bilen). Färgerna räknas på ursprungsläget (vBP), så fälgens
  // ekrar (färgkartan) följer med när hjulet rullar. forbi: rörelsen helt i skuggaren (som gatans bilar).
  function riggShader(sh, R, map) {
    const U = R.U, fb = !!R.forbi;
    Object.assign(sh.uniforms, { uKart: { value: map }, uRull: U.uRull, uStyr: U.uStyr, uLjus: U.uLjus, uBlink: U.uBlink, uLackF: U.uLackF, uKor: U.uKor, uTid: VU.uTid });
    let nv = '', bv = '';
    if (R.hjul) {
      // bromsoken (röda i färgkartan) sitter still medan fälgen rullar
      nv = `vec3 hC = texture2D( uKart, uv ).rgb;
        float hRu = ( hC.r > 0.08 && hC.r > 2.5 * hC.g && hC.r > 2.5 * hC.b ) ? 0.0 : ${fb ? 'mod( uTid * uKor.x, 2.5447 ) / 0.405' : 'uRull'};
        float hSx = position.x < 0.0 ? -1.0 : 1.0;
        float hF = step( 0.0, position.z );
        vec3 hNav = vec3( hSx * 0.83, 0.40, mix( -1.573, 1.446, hF ) );
        mat3 hM = hF > 0.5 ? bRy( uStyr ) * bRx( hRu ) * bRy( 0.3979 ) : bRx( hRu );
        objectNormal = hM * objectNormal;`;
      bv = 'transformed = hNav + hM * ( position - hNav );';
    }
    if (fb) bv += '\n float bS = mod( uTid * uKor.x + uKor.w, uKor.y ) - 0.5 * uKor.y; transformed.z += bS; if ( abs( bS ) > uKor.z ) transformed.y -= 400.0;';
    sh.vertexShader = 'uniform sampler2D uKart;\nuniform float uRull;\nuniform float uStyr;\nuniform float uTid;\nuniform vec4 uKor;\n'
      + 'mat3 bRy( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c ); }\n'
      + 'mat3 bRx( float a ) { float c = cos( a ), s = sin( a ); return mat3( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c ); }\n'
      + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + nv).replace('vBP = position; vBN = normal;', 'vBP = position; vBN = normal;\n' + bv);
    // lackfärg: egen (uLackF) eller en ny per varv för bilen på gatan; lyktor, bakljus och blinkers
    const fh = 'uniform float uLjus;\nuniform float uBlink;\nuniform vec3 uLackF;\nuniform float uTid;\nuniform vec4 uKor;\n' + (fb ? `vec3 bForbiF() {
      float v = floor( ( uTid * uKor.x + uKor.w ) / uKor.y ), h = fract( sin( v * 12.9898 + 4.1 ) * 43758.5453 );
      return h < 0.3 ? vec3( 0.525, 0.535, 0.55 ) : h < 0.5 ? vec3( 0.03, 0.031, 0.035 ) : h < 0.7 ? vec3( 0.2, 0.21, 0.22 ) : h < 0.85 ? vec3( 0.04, 0.09, 0.24 ) : vec3( 0.36, 0.03, 0.025 );
    }\n` : '');
    sh.fragmentShader = fh + sh.fragmentShader.replace('vec3 bLackF = vec3( 0.525, 0.535, 0.55 ) *', 'vec3 bLackF = ' + (fb ? 'bForbiF()' : 'uLackF') + ' *')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float bLj = ${fb ? 'smoothstep( 0.15, 0.6, uNatt )' : 'uLjus'};
        float bBak = bRodU * step( vBP.z, -1.8 );
        float bBlk = ${fb ? '0.0' : 'step( 0.5, uBlink * ( vBP.x < 0.0 ? -1.0 : 1.0 ) ) * step( 0.6, abs( vBP.x ) )'};
        totalEmissiveRadiance += ( vec3( 1.5, 1.45, 1.3 ) * bLykta + vec3( 0.9, 0.025, 0.015 ) * bBak ) * bLj * ( 1.0 - bBlk ) + vec3( 1.9, 0.62, 0.06 ) * bBlk * max( bLykta, bBak * 1.5 );`);
  }
  // reserv: en enkel egen bil om modellen inte kan laddas (sidoprofil med rundade kanter + hjul)
  function reservBil() {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(-2.3, 0.3); sh.lineTo(2.25, 0.3); sh.quadraticCurveTo(2.38, 0.32, 2.35, 0.62); sh.quadraticCurveTo(2.3, 0.78, 1.9, 0.82);
    sh.lineTo(0.95, 0.95); sh.quadraticCurveTo(0.35, 1.45, -0.1, 1.46); sh.lineTo(-1.2, 1.44); sh.quadraticCurveTo(-1.9, 1.3, -2.25, 0.98); sh.quadraticCurveTo(-2.38, 0.8, -2.3, 0.3);
    const kg = spara(new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.08, bevelSegments: 5, curveSegments: 14 })); kg.translate(0, 0, -0.8);
    const kaross = new THREE.Mesh(kg, spara(new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 })));
    const hg = spara(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28)); hg.rotateX(Math.PI / 2);
    const hm = spara(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 }));
    g.add(kaross);
    for (const x of [1.42, -1.43]) for (const z of [0.82, -0.82]) { const h = new THREE.Mesh(hg, hm); h.position.set(x, 0.34, z); g.add(h); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  // kontaktskugga under bilen
  const skuggTex = (() => {
    // 5,6 × 2,9 m (46 × 44 bildpunkter per meter): mjukt mörker under hela karossen som tonar ut 20–30 cm
    // utanför den (annars syns det inte från sidan, bilen såg ut att sväva) och tätare under de fyra
    // däcken, så att bilen står på marken. Svart botten: alphaMap läser den gröna kanalen.
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128);
    g.filter = 'blur(9px)'; g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath();
    if (g.roundRect) g.roundRect(24, 22, 208, 84, 28); else g.rect(24, 22, 208, 84);
    g.fill();
    g.filter = 'blur(3px)'; g.fillStyle = 'rgba(255,255,255,.9)';
    for (const x of [56, 194]) for (const y of [25, 103]) { g.beginPath(); g.ellipse(x, y, 12, 7, 0, 0, 6.283); g.fill(); }
    const t = spara(new THREE.CanvasTexture(c)); return t;
  })();
  skuggMat.alphaMap = skuggTex; skuggMat.opacity = 0.66;
  const skugga = new THREE.Mesh(spara(new THREE.PlaneGeometry(5.6, 2.9).rotateX(-Math.PI / 2)), skuggMat);
  skugga.position.y = 0.012; skugga.renderOrder = 2; bilen.add(skugga);

  // snötäcket räknas först när vintern visas (ca 0,6 s skript som de andra miljöerna slipper helt)
  let snoBil = null, snoKalla = null, box = null;
  const BOXM = { ut: 0.085, topp: 0.4, halv: 0.1 };
  const PORT = {};                        // laddluckans delar (byggPort): ram, kontakt, lucka, ring, hål
  // laddluckans delar (i bilens ram, ritas på +z-sidan)
  const port = new THREE.Group(); port.name = 'laddlucka'; bilen.add(port);

  const laddning = hamtaModeller().then(([b, l]) => {
    if (dod) return;
    if (b.status === 'fulfilled') {
      const m = b.value; m.rotation.y = Math.PI / 2;            // modellen har fronten mot +z
      lackeraBil(m); delaModell(m); const yt = new THREE.Group(); yt.add(m); BIL.yt = yt;
      mattBil(yt); bilen.add(yt); snoKalla = yt; sparaMatt('tesla', yt);                           // mäts i egen ram innan den sätts in
    } else {
      console.warn('elbil.glb kunde inte laddas – reservbilen används', b.reason);
      const r = reservBil(); mattBil(r); bilen.add(r); snoKalla = r; sparaMatt('tesla', r);
    }
    if (l.status === 'fulfilled') { box = l.value; lackera(box); const bb = new THREE.Box3().setFromObject(box); BOXM.ut = bb.max.z; BOXM.topp = bb.max.y; BOXM.halv = Math.max(-bb.min.x, bb.max.x); }
    BILAR.tesla.box = box; BILAR.tesla.boxm = { ...BOXM };
    BIL.klar = true;
    byggPort();
    if (MODELL !== 'tesla') { const m = MODELL; MODELL = 'tesla'; modell(m); }   // valet kom före laddningen
    else if (mal0) satt(miljo, mal0);
    try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ }
  });

  // luckan står öppen, kontakten sitter i; en grön ring runt uttaget
  function byggPort() {
    port.clear();
    const p = BIL.port, n = BIL.portN, q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n);
    const ram = new THREE.Group(); ram.position.copy(p); ram.quaternion.copy(q); port.add(ram);
    const hal = new THREE.Mesh(spara(new THREE.CircleGeometry(0.05, 24)), plastMat); hal.position.z = 0.003; ram.add(hal);
    const ring = new THREE.Mesh(spara(new THREE.TorusGeometry(0.054, 0.0055, 6, 32)), neonMat); ring.position.z = 0.006; ram.add(ring);
    // luckan: rundad platta på ett gångjärn mot bilens front, uppfälld ~100°
    const ls = new THREE.Shape(); const rr = 0.02, w = 0.11, hh = 0.1;
    ls.moveTo(-w / 2 + rr, -hh / 2); ls.lineTo(w / 2 - rr, -hh / 2); ls.quadraticCurveTo(w / 2, -hh / 2, w / 2, -hh / 2 + rr); ls.lineTo(w / 2, hh / 2 - rr); ls.quadraticCurveTo(w / 2, hh / 2, w / 2 - rr, hh / 2);
    ls.lineTo(-w / 2 + rr, hh / 2); ls.quadraticCurveTo(-w / 2, hh / 2, -w / 2, hh / 2 - rr); ls.lineTo(-w / 2, -hh / 2 + rr); ls.quadraticCurveTo(-w / 2, -hh / 2, -w / 2 + rr, -hh / 2);
    const lg = spara(new THREE.ExtrudeGeometry(ls, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }));
    lg.translate(w / 2, 0, 0);
    const led = new THREE.Group(); led.position.set(0.06, 0, 0.004); led.rotation.y = -1.75; ram.add(led);
    led.add(new THREE.Mesh(lg, kontaktMat));
    // kontakten: rund stomme rakt ut, handtaget böjer nedåt (egen grupp: den flyttas till boxen när bilen kör)
    const kontakt = new THREE.Group(); kontakt.name = 'kontakt'; ram.add(kontakt);
    const stomme = new THREE.Mesh(spara(new THREE.CylinderGeometry(0.03, 0.034, 0.09, 18).rotateX(Math.PI / 2)), plastMat); stomme.position.z = 0.05; kontakt.add(stomme);
    const krage = new THREE.Mesh(spara(new THREE.TorusGeometry(0.034, 0.006, 6, 20)), kontaktMat); krage.position.z = 0.092; kontakt.add(krage);
    const handtag = new THREE.Mesh(spara(new THREE.CapsuleGeometry(0.024, 0.11, 4, 10)), plastMat);
    handtag.position.set(0, -0.06, 0.11); handtag.rotation.x = -0.75; kontakt.add(handtag);
    Object.assign(PORT, { ram, kontakt, led, ring, hal });
    ram.updateMatrix();
    BIL.kabelSlut = V(0, -0.115, 0.16).applyMatrix4(ram.matrix);         // där kabeln går ut ur handtaget (bilens ram)
    BIL.kabelRikt = V(0, -0.8, 0.55).normalize().applyQuaternion(q);
    BIL.portGlod = V(0, 0, 0.03).applyMatrix4(ram.matrix);
    port.traverse(o => { if (o.isMesh && o.material !== neonMat) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // ---- platsen: bredvid gången nära entrén, nosen mot fasaden (1,6–2 m kvar) ----
  // Laddboxen sitter på väggen strax bredvid bilens nos; kabeln går ned längs väggen och på marken
  // utmed bilens sida bak till laddluckan (bak, på sidan mot boxen), så att den syns.
  const VAG = { L: 48, B: 3.0 };   // längre ut, tonar ut över de sista 22 m (vägen tog slut tvärt mitt på fältet)                                       // samma bredd som bilplatsen: kantstenen löper vidare
  // bilplatsen (halv längd a, halv bredd b), kantstenens bredd och entréytan (ut till entreU, från w = entreW)
  const YTA = { a: 2.95, b: 1.5, kant: 0.15, entreU: 2.35, entreW: -1.0 };
  const vagBoj = sv => 1.6 * mjuk(4, 16, sv);                             // sidled (m) bort från gången
  // Alla hårda ytor (bilplats, entréyta, gången runt huset och uppfarten) har samma beläggning och
  // samma rutnät i världen (uv = x, z i meter), så att de går ihop utan skarvar: betongplattor med
  // kantsten i granit (trädgård), naturgrus som tonar ut i skogsmarken (skog), skottad snö (vinter).
  const ytTon = {};
  function ytaTona(typ) {          // som yta() men genomskinlig mot fjärran (aTona), för uppfarten
    if (ytTon[typ]) return ytTon[typ];
    const m = spara(new THREE.MeshStandardMaterial({ map: tex(typ), transparent: true, depthWrite: false, roughness: typ === 'sno' ? 0.8 : 0.95, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 }));
    if (typ === 'sno') m.emissive.set(0x141c2c);
    m.onBeforeCompile = sh => {
      sh.uniforms.uNatt = VU.uNatt;
      sh.vertexShader = 'attribute float aTona;\nvarying float vTona;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTona = aTona;');
      sh.fragmentShader = 'uniform float uNatt;\nvarying float vTona;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1.0 - 0.45 * uNatt;\n diffuseColor.a *= vTona;');
    };
    return (ytTon[typ] = m);
  }
  // geometri ur listor; framsidan vänds uppåt (annars blir ytan mörk)
  function geo(pos, uv, A, I) {
    if (I.length >= 3) {
      const [a, b, c] = I, ux = pos[b * 3] - pos[a * 3], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      if (uz * vx - ux * vz < 0) for (let i = 0; i < I.length; i += 3) { const x = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = x; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aTona', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  // band utåt från en linje i världen: [[x, z, nx, nz]] (n utåt). Kantsten: u tvärs, v = längd / 4;
  // mjukt: uv = x, z och aTona från ton (1) ut till 0
  function kantV(L, bredd, mjukt, hy, y, ton = null) {
    const pos = [], uv = [], A = [], I = []; let s = 0;
    L.forEach(([x, z, nx, nz], i) => {
      if (i) s += Math.hypot(x - L[i - 1][0], z - L[i - 1][1]);
      const ox = x + nx * bredd, oz = z + nz * bredd, a = ton ? ton[i] : 1;
      pos.push(x, hy(x, z) + y, z, ox, hy(ox, oz) + y, oz);
      if (mjukt) { uv.push(x, z, ox, oz); A.push(a, 0); } else { uv.push(0, s / 4, 1, s / 4); A.push(1, 1); }
      if (i < L.length - 1) { const k = 2 * i; I.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    });
    return geo(pos, uv, A, I);
  }
  // en linje delas där en sträckas mittpunkt ska bort (t.ex. där en annan yta tar vid)
  function dela(L, bort) {
    const ut = []; let cur = null;
    for (let i = 0; i < L.length - 1; i++) {
      if (bort((L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2, i)) { if (cur && cur.length > 1) ut.push(cur); cur = null; continue; }
      if (!cur) cur = [L[i]];
      cur.push(L[i + 1]);
    }
    if (cur && cur.length > 1) ut.push(cur);
    return ut;
  }
  // gången runt huset: från singelbädden och 0,95 m ut, rundade hörn, bruten vid altanen
  function ringPlan(mal) {
    const { L, W, dack } = mal, gb = Math.min(0.6, Math.max(0.35, 0.3 + 0.011 * (L + W)));
    const hx = L / 2, hz = W / 2, d1 = mal.namn === 'vinter' ? 0.64 : gb + 0.02, d2 = d1 + 0.95;   // vintern: utanför snövallen
    const dk = dack && { x0: dack.x0 + 0.45, x1: dack.x1 - 0.45, z0: dack.z0 + 0.45, z1: dack.z1 - 0.45 };
    const iDack = (x, z, m = 0) => !!dk && x > dk.x0 - m && x < dk.x1 + m && z > dk.z0 - m && z < dk.z1 + m;
    const inne = (x, z, m = 0) => {
      if (Math.abs(x) < hx && Math.abs(z) < hz) return false;
      const d = Math.hypot(Math.max(Math.abs(x) - hx, 0), Math.max(Math.abs(z) - hz, 0));
      return d > d1 - m && d < d2 + m && !iDack(x, z, -m);
    };
    return { hx, hz, d1, d2, inne, iDack };
  }
  function lagg0(g, m, ro) { const o = new THREE.Mesh(g, m); o.userData.egen = true; o.receiveShadow = true; o.renderOrder = ro; return o; }
  function byggRing(P, typ, hy, y0) {
    const R = P.ring, { hx, hz } = R, O = [];
    const sida = (x0, z0, x1, z1, nx, nz) => { const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1)); for (let i = 0; i < k; i++) O.push([x0 + (x1 - x0) * i / k, z0 + (z1 - z0) * i / k, nx, nz]); };
    const horn = (cx, cz, a0) => { for (let i = 0; i < 10; i++) { const v = a0 + i / 10 * Math.PI / 2; O.push([cx, cz, Math.cos(v), Math.sin(v)]); } };
    sida(hx, -hz, hx, hz, 1, 0); horn(hx, hz, 0); sida(hx, hz, -hx, hz, 0, 1); horn(-hx, hz, Math.PI / 2);
    sida(-hx, hz, -hx, -hz, -1, 0); horn(-hx, -hz, Math.PI); sida(-hx, -hz, hx, -hz, 0, -1); horn(hx, -hz, Math.PI * 1.5);
    const D = [R.d1, (R.d1 + R.d2) / 2, R.d2], n = O.length, K = D.length, pos = [], uv = [], A = [], I = [];
    const pkt = (i, j) => { const [x0, z0, nx, nz] = O[i % n]; return [x0 + nx * D[j], z0 + nz * D[j]]; };
    O.forEach((_, i) => D.forEach((_, j) => { const [x, z] = pkt(i, j); pos.push(x, hy(x, z) + y0, z); uv.push(x, z); A.push(1); }));
    const bort = [];
    for (let i = 0; i < n; i++) {
      bort[i] = D.some((_, j) => { const a = pkt(i, j), b = pkt(i + 1, j); return R.iDack(a[0], a[1]) || R.iDack(b[0], b[1]); });
      if (bort[i]) continue;
      for (let j = 0; j < K - 1; j++) { const a = i * K + j, b = ((i + 1) % n) * K + j; I.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const ut = [lagg0(geo(pos, uv, A, I), yta(typ), 1)];
    // ytterkanten: kantsten (trädgård) eller toning ut i marken; inte där bilplatsen, entréytan eller uppfarten tar vid
    const kant = []; for (let i = 0; i <= n; i++) { const [x, z] = pkt(i, K - 1), o = O[i % n]; kant.push([x, z, o[2], o[3]]); }
    for (const L of dela(kant, (x, z, i) => bort[i] || P.iPad(x, z, YTA.kant + 0.02) || P.iVag(x, z, 0.05))) {
      if (typ === 'plattor') ut.push(lagg0(kantV(L, YTA.kant, false, hy, y0 + 0.003), kantMat(), 1));
      else ut.push(lagg0(kantV(L, 0.55, true, hy, y0), ytaMjuk(typ), 2));
    }
    return ut;
  }
  // uppfarten: rakt ut från bilplatsen och i en mjuk böj bort från gången, tonar ut i fjärran
  function byggVag(P, typ, hy, y0) {
    // P.vagL (villaområdet): uppfarten slutar vid gatans trottoar, utan uttoning, med kantsten hela vägen
    const v = P.vag, n = P.n, t = P.t, B = VAG.B, L = P.vagL || VAG.L, N = P.vagL ? 50 : 160, K = 6;
    const pos = [], uv = [], A = [], I = [], kanter = [[], []], ton = [];
    for (let i = 0; i <= N; i++) {
      const sv = -0.03 + (L + 0.03) * i / N, lat = vagBoj(sv) * v.sida, d = (vagBoj(sv + 0.05) - vagBoj(sv - 0.05)) / 0.1 * v.sida;
      const cx = v.x0 + n[0] * sv + t[0] * lat, cz = v.z0 + n[1] * sv + t[1] * lat;
      let px = t[0] - n[0] * d, pz = t[1] - n[1] * d; const l = Math.hypot(px, pz); px /= l; pz /= l;   // vinkelrätt mot böjen
      const a = P.vagL ? 1 : 1 - mjuk(L - 22, L, sv);
      for (let j = 0; j <= K; j++) {
        const sd = j / K - 0.5, x = cx + px * sd * B, z = cz + pz * sd * B;
        pos.push(x, hy(x, z) + y0, z); uv.push(x, z); A.push(a);
      }
      kanter[0].push([cx - px * B / 2, cz - pz * B / 2, -px, -pz]); kanter[1].push([cx + px * B / 2, cz + pz * B / 2, px, pz]); ton.push(a);
      if (i < N) for (let j = 0; j < K; j++) { const k = i * (K + 1) + j, k2 = k + K + 1; I.push(k, k2, k + 1, k + 1, k2, k2 + 1); }
    }
    const m = lagg0(geo(pos, uv, A, I), ytaTona(typ), 3); m.name = 'uppfart';
    const ut = [m], slut = P.vagL ? N + 1 : Math.round(N * (L - 8.5) / L);
    for (const kl of kanter) {
      if (typ === 'plattor') ut.push(lagg0(kantV(kl.slice(1, slut), YTA.kant, false, hy, y0 + 0.003), kantMat(), 1));   // kantstenen slutar innan vägen tonar ut
      else ut.push(lagg0(kantV(kl, 0.55, true, hy, y0, ton), ytaMjuk(typ), 2));
    }
    return ut;
  }

  const SIDA = (nx, nz) => nz > 0.5 ? 'S' : nz < -0.5 ? 'N' : nx > 0.5 ? 'E' : 'W';
  function planera(mal, H) {
    const { dorr, gang, L, W } = mal;
    const n = [dorr.nx, dorr.nz], t = [gang.tx, gang.tz], sd = SIDA(dorr.nx, dorr.nz);
    const vl = sd === 'S' || sd === 'N' ? L : W;
    // väggkoordinat u (som ritningens öppningar: från vänster sett utifrån); u = u(dörr) − sidled längs t
    const uAv = (x, z) => sd === 'S' ? x + L / 2 : sd === 'N' ? L / 2 - x : sd === 'E' ? W / 2 - z : z + W / 2;
    const uD = uAv(dorr.x, dorr.z);
    const op = (H && Array.isArray(H.oppningar) ? H.oppningar : []).filter(o => o[0] === sd);
    const friU = u => u > 0.55 && u < vl - 0.55 && op.every(o => {
      const marg = o[5] === 'd' || o[5] === 'dg' ? 0.5 : 0.22;
      if (o[3] > 1.5 || o[3] + o[4] < 0.85) return true;                      // öppningen ligger ovanför/under boxen
      return u < o[1] - marg - 0.1 || u > o[1] + o[2] + marg + 0.1;
    });
    const blk0 = mal.blockerad;
    const gb = Math.abs(gang.off(9.2)) > 0.01 ? Math.sign(gang.off(9.2)) : 1;    // gångens böj (+t eller -t)
    const halvL = 2.42, halvB = 1.02, GAP = 1.2, D = GAP + halvL, BOX = halvB + 0.38;
    const iBil = (cx, cz, x, z, m) => { const dx = x - cx, dz = z - cz; return Math.abs(dx * n[0] + dz * n[1]) < halvL + m && Math.abs(dx * t[0] + dz * t[1]) < halvB + m; };
    let bast = null;
    for (let k = 0; k < 2 && !bast; k++) {
      const s = k ? gb : -gb;                                                // helst på sidan gången böjer bort från
      for (let c = 3.3; c <= 7.5 && !bast; c += 0.1) {
        const lat = s * c, cx = dorr.x + n[0] * D + t[0] * lat, cz = dorr.z + n[1] * D + t[1] * lat;
        let fri = true;
        // hela ytan (med kantsten) fri från gången, pollarna (0,85 m från mittlinjen), altanen och stigarna
        for (let i = -6; i <= 6 && fri; i++) for (let j = -4; j <= 4 && fri; j++) {
          const x = cx + n[0] * i * 0.51 + t[0] * j * 0.42, z = cz + n[1] * i * 0.51 + t[1] * j * 0.42;
          if (blk0(x, z, 1.2)) fri = false;
        }
        if (!fri) continue;
        // boxen mellan bilen och dörren, annars på bilens andra sida
        for (const p of [-s, s]) { const bl = lat + p * BOX; if (!bast && friU(uD - bl)) bast = { cx, cz, lat, s, p, bl }; }
      }
    }
    if (!bast) {      // nödfall: utan fri vägg står boxen ändå bredvid bilen
      const s = -gb, lat = s * 4.2;
      bast = { cx: dorr.x + n[0] * D + t[0] * lat, cz: dorr.z + n[1] * D + t[1] * lat, lat, s, p: -s, bl: lat - s * BOX };
    }
    const fx = -n[0], fz = -n[1];                                            // framåt = mot väggen
    const pv = [t[0] * bast.p, t[1] * bast.p];                               // luckans sida (mot boxen)
    plats = { ...bast, fx, fz, n, t, pv, D, box: [dorr.x + t[0] * bast.bl, dorr.z + t[1] * bast.bl] };
    // uppfarten: grusväg med gräs i mitten, rakt ut från bilplatsen och i en mjuk böj bort från gången
    plats.vag = { x0: bast.cx + n[0] * YTA.a, z0: bast.cz + n[1] * YTA.a, sida: bast.s };
    // entréytan: samma beläggning från trappan fram till bilplatsen, om ingen altan eller sidodörr står i vägen.
    // Dörrens ram: u ut från väggen, w i sidled mot bilen (dörren w = 0, bilens mitt w = c).
    const c = Math.abs(bast.lat), uRam = (x, z) => { const dx = x - dorr.x, dz = z - dorr.z; return [dx * n[0] + dz * n[1], (dx * t[0] + dz * t[1]) * bast.s]; };
    const ePunkt = (u, w) => [dorr.x + n[0] * u + t[0] * w * bast.s, dorr.z + n[1] * u + t[1] * w * bast.s];
    let entre = { u0: D - YTA.a, u1: YTA.entreU, w0: YTA.entreW, w1: c - YTA.b };
    for (let u = entre.u0 - 0.1; u <= entre.u1 + 0.2 && entre; u += 0.2) for (let w = entre.w0 - 0.2; w <= entre.w1 && entre; w += 0.2) {
      const [x, z] = ePunkt(u, w), dk = mal.dack;
      if (dk && x > dk.x0 - 0.1 && x < dk.x1 + 0.1 && z > dk.z0 - 0.1 && z < dk.z1 + 0.1) entre = null;
      else if ((mal.sidodorrar || []).some(d => { const bx = x - d.x, bz = z - d.z, l = bx * d.nx + bz * d.nz; return l > -0.4 && l < 3.6 && Math.abs(-bx * d.nz + bz * d.nx) < 0.95; })) entre = null;
    }
    plats.entre = entre; plats.c = c;
    // hårda ytor (bilplats med kantsten, entréyta): gångens plattor och den trampade snön hoppar över dem
    const iPad = (x, z, m = 0) => {
      const [u, w] = uRam(x, z), k = YTA.kant + m;
      if (Math.abs(u - D) < YTA.a + k && Math.abs(w - c) < YTA.b + k) return true;
      return !!entre && u > entre.u0 - m && u < entre.u1 + k && w > entre.w0 - k && w < c;
    };
    const iVag = (x, z, m = 0) => {
      const v = plats.vag, ex = x - v.x0, ez = z - v.z0, sv = ex * n[0] + ez * n[1];
      return sv > -0.05 - m && sv < VAG.L + m && Math.abs(ex * t[0] + ez * t[1] - vagBoj(sv) * v.sida) < VAG.B / 2 + YTA.kant + m;
    };
    const R = ringPlan(mal);
    Object.assign(plats, { ring: R, iPad, iVag });
    mal.hard = (x, z, m = 0) => iPad(x, z, m) || R.inne(x, z, m) || iVag(x, z, m);
    // stolplampor parvis längs uppfarten, strax utanför kantstenen
    const vagP = (sv, o = 0) => { const v = plats.vag, lat = vagBoj(sv) * v.sida + o; return [v.x0 + n[0] * sv + t[0] * lat, v.z0 + n[1] * sv + t[1] * lat]; };
    mal.pollare = []; mal.vagLjus = [];
    for (const sv of [2.2, 7.2, 12.2]) {
      const [x1, z1] = vagP(sv - 0.1), [x2, z2] = vagP(sv + 0.1), ry = Math.atan2(x2 - x1, z2 - z1);
      for (const sd of [-1, 1]) { const [x, z] = vagP(sv, sd * (VAG.B / 2 + 0.5)); if (!iPad(x, z, 0.3) && !R.inne(x, z, 0.3) && !blk0(x, z, 0.3)) mal.pollare.push([x, z, ry]); }
      mal.vagLjus.push(vagP(sv + 1.3));
    }
    mal.entreU = entre ? entre.u1 + YTA.kant : 0;
    // naturen håller sig borta från bilen, ytan och kabelns väg (längs bilens sida)
    mal.blockerad = (x, z, b = 1.25) => {
      if (blk0(x, z, b)) return true;
      const m = Math.min(0.55, 0.2 + b * 0.25);
      if (iBil(bast.cx, bast.cz, x, z, 0.5 + m)) return true;
      if (mal.hard(x, z, 0.15 + m)) return true;
      const dx = x - plats.box[0], dz = z - plats.box[1], ut = dx * n[0] + dz * n[1], la = (dx * t[0] + dz * t[1]) * bast.p;
      if (ut > -0.2 && ut < D + halvL && la > -0.45 - m && la < 0.45 + m) return true;
      const v = plats.vag, ex = x - v.x0, ez = z - v.z0, sv = ex * n[0] + ez * n[1];      // på uppfarten
      return sv > -0.5 && sv < VAG.L + 1 && Math.abs(ex * t[0] + ez * t[1] - vagBoj(sv) * v.sida) < VAG.B / 2 + Math.max(m, b);
    };
    mal0 = mal;
  }

  // ---- per hus: bilens läge, ytan, boxen, kabeln och glöden ----
  function stada() {
    husGrupp.traverse(o => { if (o.userData.egen && o.geometry) o.geometry.dispose(); });
    husGrupp.clear();
  }
  function satt(namn, mal) {
    KAB = null; parkera(true);                     // en bil som kör (eller är borta) står alltid hemma igen
    miljo = namn; mal0 = mal;
    stada();
    if (!plats) return;
    const P = plats;
    // bilen: x framåt längs fasaden, +z (laddluckan) mot väggen; spegelvänd om fronten pekar åt andra hållet
    bilen.position.set(P.cx, 0, P.cz);
    // +z i bilens ram (laddluckan) ska peka mot boxens sida: pekar den fel vänds bilen ett halvt varv
    // (aldrig spegelvänd – då blir skylten och texten bakvända)
    const vand = -P.fz * P.pv[0] + P.fx * P.pv[1] > 0 ? 0 : Math.PI;
    bilen.rotation.set(0, Math.atan2(-P.fz, P.fx) + vand, 0);
    bilen.scale.set(1, 1, 1);
    if (namn === 'vinter' && !snoBil && snoKalla) {      // mäts i bilens egen ram: lyfts ur medan höjdfältet räknas
      bilen.remove(snoKalla); snoBil = snoTacke(snoKalla); bilen.add(snoKalla, snoBil);
    }
    bilen.updateMatrixWorld(true);
    if (snoBil) snoBil.visible = namn === 'vinter';
    skugga.position.y = namn === 'vinter' ? 0.028 : 0.012;            // ovanpå den packade snön (2 cm)
    BU.uFrost.value = namn === 'vinter' ? 1 : 0;                       // lätt frost på rutorna
    // ytan: bilplatsen och entréytan i ett stycke – betongplattor med kantsten i granit (trädgård), grus som
    // tonar ut i skogsmarken (skog), skottad packad snö som tonar ut i snön (vinter); studion har redan betong.
    // Ytans plan: x mot väggen, y längs t, bilens mitt i origo. Mot uppfarten (x = −a) och mot husets
    // singelbädd (x = a) är hörnen raka och kanten öppen; kantsten eller toning bara mot marken.
    if (namn !== 'studio') {
      const typ = namn === 'skog' ? 'grus' : namn === 'vinter' ? 'sno' : 'plattor';
      const { a, b } = YTA, E = P.entre;
      // hörn [x, y, radie, kant på sträckan till nästa hörn], entréytan åt −y, moturs
      let H = E ? [[-a, -b, 0, 1], [P.D - E.u1, -b, 0.45, 1], [P.D - E.u1, -(P.c - E.w0), 0.35, 1], [a, -(P.c - E.w0), 0, 0], [a, b, 0, 1], [-a, b, 0, 0]]
        : [[-a, -b, 0, 1], [a, -b, 0, 0], [a, b, 0, 1], [-a, b, 0, 0]];
      if (P.s < 0) H = H.map(([x, y, r], i) => [x, -y, r, H[(i + H.length - 1) % H.length][3]]).reverse();   // spegla, behåll moturs
      const { pts, kant } = rundPoly(H);
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))), 1); g.rotateX(-Math.PI / 2);
      const ry = Math.atan2(-P.fz, P.fx), y0 = namn === 'vinter' ? 0.02 : 0.008;
      const lagg = (geo, mat, dy, ro) => { const m = new THREE.Mesh(geo, mat); m.userData.egen = true; m.receiveShadow = true; m.renderOrder = ro; m.position.set(P.cx, y0 + dy, P.cz); m.rotation.y = ry; husGrupp.add(m); };
      // uv i världen (samma rutnät som gången och uppfarten)
      const cs = Math.cos(ry), sn = Math.sin(ry), tillV = (x, y) => [P.cx + cs * x - sn * y, P.cz - sn * x - cs * y];
      const gp = g.attributes.position, gu = g.attributes.uv;
      for (let i = 0; i < gp.count; i++) { const X = gp.getX(i), Z = gp.getZ(i); gu.setXY(i, P.cx + cs * X + sn * Z, P.cz - sn * X + cs * Z); }
      lagg(g, yta(typ), 0, 1);
      const tata = L => { const ut = [L[0]]; for (let i = 1; i < L.length; i++) { const [a, b] = [L[i - 1], L[i]], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1)); for (let j = 1; j <= k; j++) ut.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } return ut; };
      for (const hel of kantLinjer(pts, kant)) for (const linje of dela(tata(hel), (x, y) => P.ring.inne(...tillV(x, y), 0.03))) {   // gången runt huset tar vid
        if (typ === 'plattor') lagg(band(linje, YTA.kant, false), kantMat(), 0.003, 1);   // kantsten i granit, 1 m långa
        else lagg(band(linje, 0.55, true), ytaMjuk(typ), 0, 2);                        // tonar ut i marken
      }
      const hy = mal.hy || (() => 0);
      byggRing(P, typ, hy, y0).forEach(o => husGrupp.add(o));
      byggVag(P, typ, hy, y0 + 0.002).forEach(o => husGrupp.add(o));
    }
    if (!BIL.klar) return;
    // boxen på fasaden
    const [bx, bz] = P.box, n = P.n, ry = Math.atan2(n[0], n[1]);
    const bg = new THREE.Group(); bg.name = 'laddbox'; bg.position.set(bx + n[0] * 0.035, 0.98, bz + n[1] * 0.035); bg.rotation.y = ry; husGrupp.add(bg);
    let ut = BOXM.ut, topp = BOXM.topp;
    const bx0 = MODELL === 'volvo' ? BILAR.volvo.box : box;
    if (bx0) bg.add(bx0);
    else { const k = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.08), kontaktMat); k.userData.egen = true; k.position.set(0, 0.18, 0.04); k.castShadow = true; bg.add(k); topp = 0.36; ut = 0.08; }
    // neon: lodrät ljuslist på framsidan + en ring runt laddkabelns utgång under boxen
    const lg = new THREE.CapsuleGeometry(0.0065, topp * 0.42, 3, 8); const list = new THREE.Mesh(lg, neonMat); list.userData.egen = true;
    list.position.set(0, topp * 0.55, ut + 0.004); bg.add(list);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 24), neonMat); ring.userData.egen = true; ring.rotation.x = Math.PI / 2; ring.position.set(0, -0.004, ut * 0.5); bg.add(ring);
    const kgrom = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.05, 12), plastMat); kgrom.userData.egen = true; kgrom.position.set(0, -0.025, ut * 0.5); bg.add(kgrom);
    const gl = new THREE.Sprite(gloriaBox); gl.position.set(0, topp * 0.55, ut + 0.03); gl.scale.set(0.5, 0.75, 1); bg.add(gl);
    const gl2 = new THREE.Sprite(gloriaBox); gl2.position.set(0, -0.01, ut * 0.5 + 0.02); gl2.scale.set(0.22, 0.22, 1); bg.add(gl2);
    // ljuspöl på väggen och marken under boxen
    const pv = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), polMat); pv.userData.egen = true; pv.position.set(0, topp * 0.45, -0.03); bg.add(pv);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2), polMat); pm.userData.egen = true; pm.position.set(0, -0.96, 0.4); bg.add(pm);
    bg.traverse(o => { if (o.isMesh && o.material !== neonMat && o.material !== polMat) { o.castShadow = true; o.receiveShadow = true; } });
    bg.updateMatrixWorld(true);
    // kabeln: ur boxens botten, ned längs väggen, på marken utmed bilens sida och upp i kontakten
    const ut0 = V(0, -0.05, ut * 0.5).applyMatrix4(bg.matrixWorld);
    const slut = BIL.kabelSlut.clone().applyMatrix4(bilen.matrixWorld);
    const rikt = BIL.kabelRikt.clone().transformDirection(bilen.matrixWorld);
    const mark = namn === 'vinter' ? 0.06 : 0.034;
    // (ut från väggen, längs väggen) räknat från boxen
    const pa = (dn, y, dt) => V(ut0.x + n[0] * dn + P.t[0] * dt, y, ut0.z + n[1] * dn + P.t[1] * dt);
    const dnS = (slut.x - ut0.x) * n[0] + (slut.z - ut0.z) * n[1], dtS = (slut.x - ut0.x) * P.t[0] + (slut.z - ut0.z) * P.t[1];
    const dg = dtS + P.p * 0.32;                                   // kabeln ligger strax utanför bilens sida
    const pts = [
      ut0, pa(0.03, 0.6, 0), pa(0.14, 0.14, 0), pa(0.45, mark, dg * 0.6), pa(0.95, mark, dg),
      pa(dnS * 0.55, mark + 0.004, dg + P.p * 0.06), pa(dnS - 0.3, mark, dg),
      slut.clone().addScaledVector(rikt, 0.24).setY(Math.max(mark + 0.1, slut.y - 0.3)), slut.clone().addScaledVector(rikt, 0.07), slut,
    ];
    const kabel = new THREE.Mesh(kabelGeo(pts, mark), kabelMat);
    kabel.userData.egen = true; kabel.castShadow = true; kabel.receiveShadow = true; husGrupp.add(kabel);
    // glorian vid laddluckan
    const gp = new THREE.Sprite(gloriaPort); gp.position.copy(BIL.portGlod.clone().applyMatrix4(bilen.matrixWorld)); gp.scale.set(0.34, 0.34, 1); husGrupp.add(gp);
    KAB = { pts, mark, ut0, bg, n, kabel, gp, ut, topp, ty: mal.hy || (() => 0), vinter: namn === 'vinter', villa: namn === 'villa', k: 0 };
    if (MODELL === 'ingen') { bilen.visible = false; kabelLage(1); }   // ingen bil: kabeln hänger på boxen
  }
  // kurvan slår över under marken där kabeln reser sig: tätt samplad och klämd ovanför marken
  function kabelGeo(pts, mark) {
    const grov = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const kurva = new THREE.CatmullRomCurve3(grov.getSpacedPoints(90).map(q => { q.y = Math.max(q.y, mark); return q; }), false, 'centripetal');
    return new THREE.TubeGeometry(kurva, 120, 0.0125, 7, false);
  }
  // kantsten i grå granit: u tvärs över stenen, v längs (4 m per varv, fog var 1 m) – samma ton som uppfartens
  let KANT = null;
  const kantMat = () => KANT || (KANT = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d'), r = slump(57);
    g.fillStyle = '#a19f9a'; g.fillRect(0, 0, 64, 512);
    for (let i = 0; i < 2600; i++) { const v = 125 + r() * 70; g.fillStyle = `rgba(${v | 0},${v - 2 | 0},${v - 5 | 0},.55)`; g.fillRect(r() * 64, r() * 512, 1.5, 1.5); }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, 5, 512);                       // fasad innerkant
    g.fillStyle = 'rgba(40,36,30,.35)'; g.fillRect(61, 0, 3, 512);                         // mot gräset
    g.fillStyle = 'rgba(50,46,40,.6)'; for (let y = 0; y < 512; y += 128) g.fillRect(0, y, 64, 2);
    const t = spara(new THREE.CanvasTexture(c)); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return spara(new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4 }));
  })());
  // samma yta som tonar ut (grus i skogen, snö på vintern): kornig kant, aTona 1 vid ytan och 0 ute
  const ytMjuk = {};
  function ytaMjuk(namn) {
    if (ytMjuk[namn]) return ytMjuk[namn];
    const m = spara(new THREE.MeshStandardMaterial({ map: tex(namn), transparent: true, depthWrite: false, roughness: namn === 'sno' ? 0.8 : 0.95, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 }));
    if (namn === 'sno') m.emissive.set(0x141c2c);
    m.onBeforeCompile = sh => {
      sh.uniforms.uNatt = VU.uNatt;
      sh.vertexShader = 'attribute float aTona;\nvarying float vTona;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTona = aTona;');
      sh.fragmentShader = 'uniform float uNatt;\nvarying float vTona;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float kTon = dot( diffuseColor.rgb, vec3( 0.3333 ) );
        diffuseColor.a *= smoothstep( 0.0, 1.0, vTona * 1.35 - 0.25 + ( kTon - 0.35 ) * ${namn === 'sno' ? '0.6' : '1.6'} );
        diffuseColor.rgb *= 1.0 - 0.45 * uNatt;`);
    };
    return (ytMjuk[namn] = m);
  }
  // rundad polygon: hörn [x, y, radie, kant] → punkter och per sträcka (punkt j → j+1) om den har kant
  function rundPoly(H, seg = 5) {
    const pts = [], kant = [], n = H.length;
    for (let i = 0; i < n; i++) {
      const [x, y, r, efter] = H[i], p = H[(i + n - 1) % n], q = H[(i + 1) % n];
      if (!r) { pts.push([x, y]); kant.push(efter); continue; }
      const l1 = Math.hypot(p[0] - x, p[1] - y), l2 = Math.hypot(q[0] - x, q[1] - y);
      const ax = x + (p[0] - x) / l1 * r, ay = y + (p[1] - y) / l1 * r, bx = x + (q[0] - x) / l2 * r, by = y + (q[1] - y) / l2 * r;
      for (let k = 0; k <= seg; k++) {
        const t = k / seg, u = 1 - t;
        pts.push([u * u * ax + 2 * u * t * x + t * t * bx, u * u * ay + 2 * u * t * y + t * t * by]); kant.push(k < seg ? !!(p[3] && efter) : efter);
      }
    }
    return { pts, kant };
  }
  // sammanhängande delar av omkretsen som har kant (öppna polylinjer)
  function kantLinjer(pts, kant) {
    const n = pts.length, ut = [], start = kant.findIndex((k, j) => k && !kant[(j + n - 1) % n]);
    if (start < 0) return [];
    for (let j = start, steg = 0; steg < n;) {
      if (!kant[j % n]) { j++; steg++; continue; }
      const linje = [pts[j % n]];
      while (kant[j % n] && steg < n) { j++; steg++; linje.push(pts[j % n]); }
      ut.push(linje);
    }
    return ut;
  }
  // band utåt från en polylinje (moturs, så utåt = höger). mjuk: uv i ytans plan och aTona 1 → 0;
  // annars kantsten: u tvärs, v = längd / 4
  function band(L, bredd, mjuk) {
    const P = [], U = [], A = [], N = [], I = [], n = L.length;
    const nrm = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
    let s = 0;
    for (let i = 0; i < n; i++) {
      const n1 = i > 0 ? nrm(L[i - 1], L[i]) : null, n2 = i < n - 1 ? nrm(L[i], L[i + 1]) : null;
      let mx, my;
      if (n1 && n2) { mx = n1[0] + n2[0]; my = n1[1] + n2[1]; const l = Math.hypot(mx, my) || 1, c = Math.max(0.4, (mx * n1[0] + my * n1[1]) / l); mx /= l * c; my /= l * c; }
      else [mx, my] = n1 || n2;
      if (i) s += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
      const [x, y] = L[i], ox = x + mx * bredd, oy = y + my * bredd;
      P.push(x, y, 0, ox, oy, 0); N.push(0, 0, 1, 0, 0, 1);
      if (mjuk) { U.push(x, y, ox, oy); A.push(1, 0); } else { U.push(0, s / 4, 1, s / 4); A.push(1, 1); }
      if (i < n - 1) { const k = 2 * i; I.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aTona', new THREE.Float32BufferAttribute(A, 1));
    g.setIndex(I); g.rotateX(-Math.PI / 2);
    return g;
  }

  // ================= bilen som kör: förbi på gatan, och vår bil som kör iväg och kommer hem =================
  // Kopiorna delar modellens hörn (100 000) men har egen indexlista för hjulen (delaModell) och egna
  // material (bilMat med R): den parkerade bilen påverkas aldrig. Mått i modellens ram (+z fram, +x vänster):
  // hjulnav x = ±0,83, y = 0,40, z = +1,446 / −1,573, ytterradie 0,405, framhjulen står styrda 22,8°.
  const HJ = { ...BILAR.tesla.hj };       // byts mot Volvons mått i modell()
  const SLUT_R = V(0, -0.115, 0.16), RIKT_R = V(0, -0.8, 0.55).normalize();   // kabelns utgång ur handtaget (lucka-ramen)
  let MOD = null, KAB = null, FORBI = null, rigP = null, rigSno = null;
  function delaModell(m) {
    let mesh = null; m.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh || !mesh.geometry.index) return;
    const g = mesh.geometry, P = g.attributes.position, I = g.index.array, K = [], H = [];
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i], b = I[i + 1], c = I[i + 2];
      const x = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, y = (P.getY(a) + P.getY(b) + P.getY(c)) / 3, z = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
      const sx = x < 0 ? -1 : 1, f = z >= 0, dx = x - sx * 0.83, dy = y - 0.4, dz = z - (f ? 1.446 : -1.573);
      const t = (f ? dx * 0.922 + dz * 0.388 : dx) * sx, r = Math.hypot(dy, f ? dz * 0.922 - dx * 0.388 : dz);
      (r < 0.415 && t > -0.19 && t < 0.17 ? H : K).push(a, b, c);   // triangelns mitt i hjulet (däck, fälg, nav)
    }
    if (!g.boundingSphere) g.computeBoundingSphere();
    const ny = idx => {
      const ng = spara(new THREE.BufferGeometry());
      for (const k in g.attributes) ng.setAttribute(k, g.attributes[k]);     // samma buffertar på grafikkortet
      ng.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1)); ng.boundingSphere = g.boundingSphere.clone();
      return ng;
    };
    MOD = { kaross: ny(K), hjul: ny(H), map: mesh.material.map };
  }
  let skuggGeoZ = null;      // kontaktskuggan i modellens ram (längden längs z)
  function rigg(forbi) {
    let S = forbi ? FORBI : null;
    if (!S) {
      const U = { uRull: { value: 0 }, uStyr: { value: HJ.styr0 }, uLjus: { value: 0 }, uBlink: { value: 0 }, uLackF: { value: V(0.525, 0.535, 0.55) }, uKor: { value: new THREE.Vector4() } };
      S = { U, forbi, kar: bilMat(MOD.map, { U, hjul: false, forbi }), hj: bilMat(MOD.map, { U, hjul: true, forbi }), sk: skuggMat };
      if (forbi) {
        U.uKor.value.set(forbi.fart, forbi.varv, forbi.syns, forbi.start);
        const sm = spara(skuggMat.clone());
        sm.onBeforeCompile = s => {
          s.uniforms.uTid = VU.uTid; s.uniforms.uKor = U.uKor;
          s.vertexShader = 'uniform float uTid;\nuniform vec4 uKor;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float bS = mod( uTid * uKor.x + uKor.w, uKor.y ) - 0.5 * uKor.y; transformed.z += bS; if ( abs( bS ) > uKor.z ) transformed.y -= 400.0;');
        };
        sm.customProgramCacheKey = () => 'elbil-forbi-skugga';
        S.sk = sm; FORBI = S;
      }
    }
    if (!skuggGeoZ) skuggGeoZ = spara(new THREE.PlaneGeometry(5.6, 2.9).rotateX(-Math.PI / 2).rotateY(Math.PI / 2));
    const g = new THREE.Group();
    for (const [geo, mat] of [[MOD.kaross, S.kar], [MOD.hjul, S.hj]]) {
      const o = new THREE.Mesh(geo, mat); o.castShadow = !forbi; o.receiveShadow = true; o.frustumCulled = !forbi; g.add(o);
    }
    const sk = new THREE.Mesh(skuggGeoZ, S.sk); sk.position.y = 0.012; sk.renderOrder = 2; sk.frustumCulled = !forbi; g.add(sk);
    g.userData.U = S.U; g.userData.skugga = sk;
    return g;
  }
  // bilen som kör förbi på gatan: lokala +z framåt, rörelsen i skuggaren (som förut: 7,8 m/s, syns inom
  // ±85 m och gör sedan en paus), ny lackfärg varje varv. Visar inget förrän modellen har laddats.
  function forbi(x, y, z, ry) {
    const g = new THREE.Group(); g.name = 'elbil-forbi'; g.position.set(x, y, z); g.rotation.y = ry;
    const fyll = () => {
      if (dod || !MOD || g.children.length) return;
      g.add(rigg({ fart: 7.8, varv: 520, syns: 85, start: 40 }));
      try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ }
    };
    if (MOD) fyll(); else laddning.then(fyll);
    return g;
  }

  // ---- Kör iväg / Kör hem ----
  // lage: 'hemma' (parkerad, laddar) → 'ut' (kontakten ur, lyktor, backar ut och kör iväg) → 'borta'
  // → 'in' (kommer längs gatan, svänger in, parkerar, kontakten i) → 'hemma'. parkera() återställer direkt.
  const KOR = { lage: 'hemma', fas: '', t: 0, segs: null, i: 0, s: 0, v: 0, styr: HJ.styr0, rull: 0, rk: 1, ljus: 0, blinkPa: false, blinkT: 0, sidaBl: 0, smuts: false };
  const meddela = () => { try { window.dispatchEvent(new CustomEvent('husritare:bil', { detail: { lage: KOR.lage } })); } catch (e) { /* utan fönster */ } };
  const vagP = (sv, lat) => { const v = plats.vag, n = plats.n, t = plats.t; return [v.x0 + n[0] * sv + t[0] * lat, v.z0 + n[1] * sv + t[1] * lat]; };
  const latC = sv => vagBoj(sv) * plats.vag.sida;
  const mitt = sv => vagP(sv, latC(sv));
  function mittT(sv) { const a = mitt(sv - 0.05), b = mitt(sv + 0.05), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  function mittLinje(s0, s1) { const N = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 0.25)), ut = []; for (let i = 0; i <= N; i++) ut.push(mitt(s0 + (s1 - s0) * i / N)); return ut; }
  function rak(a, b) { const N = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)), ut = []; for (let i = 0; i <= N; i++) ut.push([a[0] + (b[0] - a[0]) * i / N, a[1] + (b[1] - a[1]) * i / N]); return ut; }
  function bez(A, B, C, D, N = 48) {
    const ut = [];
    for (let i = 0; i <= N; i++) { const u = i / N, w = 1 - u, a = w * w * w, b = 3 * w * w * u, c = 3 * w * u * u, d = u * u * u; ut.push([a * A[0] + b * B[0] + c * C[0] + d * D[0], a * A[1] + b * B[1] + c * C[1] + d * D[1]]); }
    return ut;
  }
  // ett avsnitt: bakaxelns bana (punkter), växel g (+1 framåt, −1 back), toppfart vm, fart in v0 och ut v1
  function seg(P0, g, vm, v0, v1) {
    const P = [P0[0]], S = [0];
    for (let i = 1; i < P0.length; i++) { const q = P[P.length - 1], d = Math.hypot(P0[i][0] - q[0], P0[i][1] - q[1]); if (d > 1e-4) { P.push(P0[i]); S.push(S[S.length - 1] + d); } }
    const H = P.map((_, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; return Math.atan2(g * (b[0] - a[0]), g * (b[1] - a[1])); });
    return { P, S, H, L: S[S.length - 1], g, vm, v0, v1 };
  }
  function iSeg(sg, s) {
    let lo = 0, hi = sg.S.length - 1;
    s = Math.min(sg.L, Math.max(0, s));
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sg.S[m] <= s) lo = m; else hi = m; }
    return [lo, hi, Math.min(1, Math.max(0, (s - sg.S[lo]) / Math.max(1e-6, sg.S[hi] - sg.S[lo])))];
  }
  const vinkel = (a, b, u) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * u; };
  const psi = (sg, s) => { const [a, b, u] = iSeg(sg, s); return vinkel(sg.H[a], sg.H[b], u); };
  const krok = (sg, s) => { const a = Math.max(0, s - 0.6), b = Math.min(sg.L, s + 0.6); if (b - a < 0.05) return 0; const d = psi(sg, b) - psi(sg, a); return Math.atan2(Math.sin(d), Math.cos(d)) / (b - a); };
  const parkPsi = () => { const a = bilen.rotation.y + BILAR[MODELL === 'volvo' ? 'volvo' : 'tesla'].rot; return Math.atan2(Math.sin(a), Math.cos(a)); };   // modellens +z i världen
  function planeraKor(ut) {
    const P = plats, n = P.n, t = P.t, ps = parkPsi(), h0 = [Math.sin(ps), Math.cos(ps)];
    const R0 = [bilen.position.x - h0[0] * HJ.bak, bilen.position.z - h0[1] * HJ.bak];
    const svR0 = (R0[0] - P.vag.x0) * n[0] + (R0[1] - P.vag.z0) * n[1];
    const gH = h0[0] * n[0] + h0[1] * n[1] > 0 ? 1 : -1;          // +1: nosen mot gatan (kör ut framåt, backar hem)
    const vanster = h => [h[1], -h[0]];
    const segs = []; let sida = 0;
    if (KAB && KAB.villa && P.gata) {
      // villaområdet: ut på huvudgatan, närmaste körfältet (högertrafik), sväng med 4,5 m radie
      const LA = P.gata - 1.55, R = 4.5, k = 2.5, s1 = LA - R;
      const Ds = Math.sign(t[1] * n[0] - t[0] * n[1]) || 1, D = [t[0] * Ds, t[1] * Ds];
      const T1 = mittT(s1), C1 = mitt(s1), l1 = latC(s1);
      if (ut) {
        const TEl = gH * Ds, E = vagP(LA, l1 + TEl * R), TE = [t[0] * TEl, t[1] * TEl];
        segs.push(seg(mittLinje(svR0, s1).concat(bez(C1, [C1[0] + T1[0] * k, C1[1] + T1[1] * k], [E[0] - TE[0] * k, E[1] - TE[1] * k], E)), gH, gH < 0 ? 2.4 : 4, 0, gH < 0 ? 0 : 4));
        segs.push(seg(rak(E, vagP(LA, l1 + TEl * R + Ds * 115)), 1, 8.5, gH < 0 ? 0 : 4, 8.5));
        sida = Math.sign(D[0] * vanster(h0)[0] + D[1] * vanster(h0)[1]);
      } else {
        const ge = -gH, TQl = ge * Ds, Q = vagP(LA, l1 - TQl * R), TQ = [t[0] * TQl, t[1] * TQl];
        segs.push(seg(rak(vagP(LA, l1 - TQl * R - Ds * 115), Q), 1, 8.5, 8.5, ge > 0 ? 3 : 0));
        segs.push(seg(bez(Q, [Q[0] + TQ[0] * k, Q[1] + TQ[1] * k], [C1[0] + T1[0] * k, C1[1] + T1[1] * k], C1).concat(mittLinje(s1, svR0)), ge, ge > 0 ? 3 : 2.2, ge > 0 ? 3 : 0, 0));
        sida = Math.sign(h0[0] * vanster(D)[0] + h0[1] * vanster(D)[1]);
      }
    } else {
      // övriga miljöer: längs uppfarten tills bilen är utom synhåll (och samma väg hem)
      const far = 52;
      if (ut) segs.push(seg(mittLinje(svR0, far), gH, gH < 0 ? 3.2 : 6, 0, gH < 0 ? 3.2 : 6));
      else segs.push(seg(mittLinje(far, svR0), -gH, gH > 0 ? 3.2 : 5, gH > 0 ? 3.2 : 5, 0));
    }
    return { segs, sida };
  }
  function yAt(x, z) {
    const hy = KAB.ty, d = Math.hypot(x - bilen.position.x, z - bilen.position.z);
    return hy(x, z) - hy(bilen.position.x, bilen.position.z) * Math.max(0, 1 - d / 12);   // parkerad: y = 0 som förut
  }
  function stall(sg, s) {
    const [a, b, u] = iSeg(sg, s), x = sg.P[a][0] + (sg.P[b][0] - sg.P[a][0]) * u, z = sg.P[a][1] + (sg.P[b][1] - sg.P[a][1]) * u;
    const ps = vinkel(sg.H[a], sg.H[b], u), hx = Math.sin(ps), hz = Math.cos(ps);
    const yB = yAt(x, z), yF = yAt(x + hx * HJ.WB, z + hz * HJ.WB);
    rigP.position.set(x + hx * HJ.bak, yB + (yF - yB) * HJ.bak / HJ.WB, z + hz * HJ.bak);
    rigP.rotation.set(-Math.atan2(yF - yB, HJ.WB), ps, 0, 'YXZ');
    const U = rigP.userData.U; U.uStyr.value = KOR.styr; U.uRull.value = KOR.rull;
    if (rigP.userData.pose) rigP.userData.pose();
  }
  function visaRigg(pa) {
    if (pa) {
      if (!rigP) { rigP = MODELL === 'volvo' ? riggVolvo(null) : rigg(null); rigP.name = 'elbil-kor'; grupp.add(rigP); BILAR[MODELL].rig = rigP; }
      if (snoBil && !rigSno) { rigSno = new THREE.Mesh(snoBil.geometry, snoBil.material); rigSno.rotation.y = -BILAR[MODELL].rot; BILAR[MODELL].rigSno = rigSno; rigSno.castShadow = true; rigSno.receiveShadow = true; rigP.add(rigSno); }
      if (rigSno) rigSno.visible = !!snoBil && snoBil.visible;
      rigP.userData.skugga.position.y = skugga.position.y;
      rigP.visible = true; bilen.visible = false;
    } else { if (rigP) rigP.visible = false; bilen.visible = true; }
  }
  function stallHemma() {   // kopian exakt där den parkerade bilen står (samma styrning, hjulen orullade)
    rigP.position.set(bilen.position.x, bilen.position.y, bilen.position.z); rigP.rotation.set(0, parkPsi(), 0, 'YXZ');
    const U = rigP.userData.U; U.uStyr.value = HJ.styr0; U.uRull.value = 0;
    if (rigP.userData.pose) rigP.userData.pose();
  }
  // laddluckan: c = 0 öppen (som förut), 1 stängd
  function luckaLage(c) {
    if (!PORT.led) return;
    PORT.led.rotation.y = -1.75 - (Math.PI - 1.75) * c; PORT.led.position.z = 0.004 + 0.009 * c;
    PORT.ring.visible = c < 0.05; PORT.hal.visible = c < 0.98;
  }
  // kontakten och kabeln: k = 0 i bilen (exakt som förut), 1 upphängd på laddboxens sida mot bilen
  const kV = V(), kQ = new THREE.Quaternion(), kS = V(1, 1, 1);
  function kabelLage(k) {
    if (!KAB || !PORT.kontakt || KAB.k === k) return;
    KAB.k = k;
    const K = PORT.kontakt, nn = V(KAB.n[0], 0, KAB.n[1]);
    if (!KAB.M0) {
      bilen.updateMatrixWorld(true); KAB.bg.updateMatrixWorld(true);
      KAB.M0 = PORT.ram.matrixWorld.clone();
      const bw = KAB.bg.matrixWorld, xb = V(1, 0, 0).transformDirection(bw), bp = V().setFromMatrixPosition(bw);
      const sx = xb.x * (bilen.position.x - bp.x) + xb.z * (bilen.position.z - bp.z) >= 0 ? 1 : -1, e = xb.clone().multiplyScalar(sx);
      const R = new THREE.Matrix4().makeBasis(V(-1, 0, 0), V(0, 0, -1), V(0, -1, 0));    // nosen nedåt, handtaget ut från väggen
      KAB.M1 = bw.clone().multiply(new THREE.Matrix4().makeTranslation(sx * (BOXM.halv + 0.045), KAB.topp * 0.3, 0.07)).multiply(R);
      const s1 = SLUT_R.clone().applyMatrix4(KAB.M1), r1 = RIKT_R.clone().transformDirection(KAB.M1), u0 = KAB.ut0, lo = Math.max(KAB.mark + 0.12, u0.y - 0.62);
      const pS = [u0.clone(), u0.clone().addScaledVector(nn, 0.03).setY(u0.y - 0.2), u0.clone().addScaledVector(nn, 0.08).addScaledVector(e, 0.05).setY(lo + 0.03),
        u0.clone().addScaledVector(nn, 0.1).addScaledVector(e, BOXM.halv + 0.12).setY(lo + 0.06), s1.clone().addScaledVector(r1, 0.24), s1.clone().addScaledVector(r1, 0.07), s1];
      KAB.pS = pS;
      KAB.A = new THREE.CatmullRomCurve3(KAB.pts, false, 'centripetal').getSpacedPoints(40);
      KAB.B = new THREE.CatmullRomCurve3(pS, false, 'centripetal').getSpacedPoints(40);
      KAB.q0 = new THREE.Quaternion(); KAB.p0 = V(); KAB.M0.decompose(KAB.p0, KAB.q0, kS);
      KAB.q1 = new THREE.Quaternion(); KAB.p1 = V(); KAB.M1.decompose(KAB.p1, KAB.q1, kS);
    }
    let pts;
    if (k <= 0) {
      PORT.ram.add(K); K.position.set(0, 0, 0); K.quaternion.identity(); pts = KAB.pts;
    } else {
      const ke = k * k * (3 - 2 * k), b = Math.sin(Math.PI * ke);
      if (K.parent !== husGrupp) husGrupp.add(K);
      kV.lerpVectors(KAB.p0, KAB.p1, ke).addScaledVector(nn, 0.14 * b); kV.y += 0.2 * b;
      kQ.slerpQuaternions(KAB.q0, KAB.q1, ke);
      K.position.copy(kV); K.quaternion.copy(kQ);
      const slut = SLUT_R.clone().applyQuaternion(kQ).add(kV);
      if (k >= 1) pts = KAB.pS;
      else {
        const N = KAB.A.length - 1;
        pts = KAB.A.map((a, i) => { const w = Math.sin(Math.PI * i / N) * b; return a.clone().lerp(KAB.B[i], ke).addScaledVector(nn, 0.1 * w).add(V(0, -0.06 * w, 0)); });
        const d = slut.clone().sub(pts[N]);
        pts.forEach((p, i) => p.addScaledVector(d, (i / N) * (i / N)));
      }
    }
    K.updateMatrix();
    KAB.kabel.geometry.dispose(); KAB.kabel.geometry = kabelGeo(pts, KAB.mark);
    KAB.gp.visible = k <= 0;
  }
  function parkera(tyst) {
    const fore = KOR.lage;
    Object.assign(KOR, { lage: 'hemma', fas: '', segs: null, ljus: 0, blinkPa: false });
    if (rigP) { rigP.visible = false; rigP.userData.U.uLjus.value = 0; rigP.userData.U.uBlink.value = 0; }
    bilen.visible = true;
    luckaLage(0);
    if (KAB) kabelLage(0);
    else if (PORT.kontakt && PORT.kontakt.parent !== PORT.ram) { PORT.ram.add(PORT.kontakt); PORT.kontakt.position.set(0, 0, 0); PORT.kontakt.quaternion.identity(); }
    if (fore !== 'hemma') { KOR.smuts = true; meddela(); }
  }
  // kor('ut' | 'hem'): startar förloppet om det går (knappen är av under tiden); returnerar läget
  function kor(vad) {
    if (!BIL.klar || !plats || !KAB || !PORT.kontakt || MODELL === 'ingen' || !BILAR[MODELL].klar || (MODELL === 'tesla' && !MOD)) return KOR.lage;
    if (vad === 'ut' && KOR.lage === 'hemma') {
      const { segs, sida } = planeraKor(true);
      Object.assign(KOR, { lage: 'ut', fas: 'ur', t: 0, segs, i: 0, s: 0, v: 0, styr: HJ.styr0, rull: 0, rk: 1, ljus: 0, blinkPa: false, blinkT: 0, sidaBl: sida });
      meddela();
    } else if (vad === 'hem' && KOR.lage === 'borta') {
      const { segs, sida } = planeraKor(false);
      // hjulen ska stå som den parkerade bilens när kopian byts mot den: hela varv på vägen hem
      const net = segs.reduce((a, sg) => a + sg.g * sg.L, 0) / HJ.R, mal = Math.round(net / (2 * Math.PI)) * 2 * Math.PI;
      Object.assign(KOR, { lage: 'in', fas: 'kor', t: 0, segs, i: 0, s: 0, v: segs[0].v0, styr: 0, rull: 0, rk: Math.abs(net) > 7 ? mal / net : 1, ljus: 1, blinkPa: false, blinkT: 0, sidaBl: sida });
      visaRigg(true); stall(segs[0], 0);
      meddela();
    }
    return KOR.lage;
  }
  function korSteg(dt) {
    const sg = KOR.segs[KOR.i]; if (!sg) return true;
    const sist = KOR.i === KOR.segs.length - 1, A = 2.2;
    let kvar = sg.L - KOR.s;
    const vTill = Math.min(sg.vm, Math.sqrt(sg.v1 * sg.v1 + 2 * A * Math.max(0, kvar)));
    KOR.v += Math.max(-A * 1.6 * dt, Math.min(A * dt, vTill - KOR.v));
    if (kvar > 0.002) KOR.v = Math.max(KOR.v, 0.12);
    const ds = Math.min(kvar, KOR.v * dt); KOR.s += ds; kvar -= ds;
    KOR.rull += sg.g * ds / HJ.R * KOR.rk;
    // styrningen följer banans krökning (cykelmodellen), mjukt; sist tillbaka till den parkerade bilens vinkel
    let mal = Math.max(-0.6, Math.min(0.6, Math.atan(HJ.WB * sg.g * krok(sg, KOR.s))));
    if (KOR.lage === 'in' && sist) mal += (HJ.styr0 - mal) * mjuk(2.8, 0.4, kvar);
    KOR.styr += Math.max(-1.3 * dt, Math.min(1.3 * dt, mal - KOR.styr));
    // blinkers: ut tills bilen rätat upp sig på gatan, hem från 40 m före svängen
    if (KOR.lage === 'ut') KOR.blinkPa = KOR.sidaBl !== 0 && !(sist && KOR.s > 6);
    else KOR.blinkPa = KOR.sidaBl !== 0 && (KOR.i > 0 || kvar < 40) && !(sist && kvar < 4 && KOR.segs.length > 1);
    stall(sg, KOR.s);
    if (kvar <= 0.002) {
      if (!sist) { KOR.i++; KOR.s = 0; return false; }
      if (KOR.lage === 'in' && Math.abs(KOR.styr - HJ.styr0) > 0.002) return false;   // rattar färdigt på stället
      return true;
    }
    return false;
  }
  // steg(dt, { stopp }): en ruta av förloppet; stopp (inne, planlösning) parkerar direkt.
  // true så länge något rör sig (och en ruta efter en återställning), så att bilden och skuggan ritas om.
  function steg(dt, o = {}) {
    if (o.stopp && KOR.lage !== 'hemma') parkera();
    if (KOR.lage === 'hemma' || KOR.lage === 'borta') { const s = KOR.smuts; KOR.smuts = false; return s; }
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    KOR.t += dt;
    if (KOR.fas === 'ur') {
      kabelLage(mjuk(0, 1.2, KOR.t)); luckaLage(mjuk(1.1, 1.55, KOR.t));
      if (KOR.t >= 1.75) { visaRigg(true); stallHemma(); KOR.fas = 'tand'; KOR.t = 0; KOR.blinkPa = KOR.sidaBl !== 0; }
    } else if (KOR.fas === 'tand') {
      KOR.ljus = mjuk(0, 0.35, KOR.t);
      if (KOR.t >= 1.2) { KOR.fas = 'kor'; KOR.t = 0; }
    } else if (KOR.fas === 'kor') {
      if (korSteg(dt)) {
        if (KOR.lage === 'ut') { rigP.visible = false; KOR.lage = 'borta'; KOR.fas = ''; KOR.blinkPa = false; meddela(); return true; }
        KOR.fas = 'av'; KOR.t = 0; KOR.blinkPa = false; stallHemma();
      }
    } else if (KOR.fas === 'av') {
      KOR.ljus = 1 - mjuk(0, 0.5, KOR.t);
      if (KOR.t >= 0.7) { visaRigg(false); KOR.fas = 'in'; KOR.t = 0; }
    } else if (KOR.fas === 'in') {
      luckaLage(1 - mjuk(0, 0.45, KOR.t)); kabelLage(1 - mjuk(0.45, 1.65, KOR.t));
      if (KOR.t >= 1.75) { parkera(); return true; }
    }
    if (rigP) {
      KOR.blinkT = KOR.blinkPa ? KOR.blinkT + dt : 0;
      const U = rigP.userData.U; U.uLjus.value = KOR.ljus; U.uBlink.value = KOR.blinkPa && KOR.blinkT % 0.74 < 0.4 ? KOR.sidaBl : 0;
      if (rigP.userData.pose) rigP.userData.pose();
    }
    return true;
  }

  function dispose() {
    dod = true; stada(); rot.remove(grupp);
    skrap.forEach(o => o && o.dispose && o.dispose()); skrap.length = 0;
  }
  try { window.__elbilTMP = { grupp, KOR, bilen, plats: () => plats, rig: () => rigP, VU }; } catch (e) {} // TMP
  return { planera, satt, dispose, laddning, plats: () => plats, forbi, kor, steg, parkera, lage: () => KOR.lage };
}
