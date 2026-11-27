// husritare-ph.js – rekvisita från Poly Haven (CC0): färdigkomprimerade glb (meshopt + webp) i images/3d/ph/.
// Picknickbord, gungstol, vattenkanna, spade, yxa, lykta, flytväst, boj, sjömärke … Allt laddas lat, först efter
// första bilden och bara de filer som miljön använder; varje anrop ger genast en tom grupp som fylls när filen finns.
// Ett instansierat nät per del och material (ett ritanrop per del, hur många exemplar som helst).
//
// API:
//   phInit({ VU, renderer })   en gång (husritare-sjo.js): uniformer (lampor, tid) och skuggomritning när något laddats
//   ph.klar()                  false med ?ph=0 (för jämförelser): då ritas de egna, enklare varianterna
//   ph.grupp(poster, namn)     poster [{ m, x, y, z, ry, rx, rz, s, del, golv, flyt }] → Group (fylls lat)
//       m: modellnamnet utan ph- (t.ex. 'wooden_axe'); y: markens höjd där föremålet står; golv (standard true):
//       lyfts så att modellens lägsta punkt (efter vridning) hamnar på y; del: bara delar vars nod heter något
//       som innehåller texten (och delen flyttas till origo i x och z); flyt: guppar på vattnet (VU.uTid)
//   ph.mått(m)                 { x0, x1, y0, y1, z0, z1 } i meter (modellens eget rum, före vridning)
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/three/addons/libs/meshopt_decoder.module.js';

const AV = (() => { try { return /[?&]ph=0/.test(location.search); } catch (e) { return false; } })();
const DIR = 'images/3d/ph/ph-';
let VU = null, REND = null;
export function phInit(k) { VU = k.VU || VU; REND = k.renderer || REND; }

// modellernas mått i meter (ur filernas accessorer och noder; Poly Havens modeller står på y = 0)
const MATT = {
  wooden_picnic_table: [-1.12, 1.12, 0, 0.74, -1.5, 1.52], outdoor_table_chair_set_01: [-0.5, 0.5, 0, 0.86, -0.85, 0.85],
  watering_can_metal_01: [-0.1, 0.1, 0, 0.2, -0.18, 0.28], wooden_bucket_01: [-0.18, 0.18, 0, 0.56, -0.17, 0.17],
  wooden_crate_02: [-0.26, 0.26, 0, 0.45, -0.58, 0.58], wooden_barrels_01: [-0.37, 0.37, 0, 0.92, -0.37, 0.37],
  rusted_spade_01: [-0.08, 0.08, -0.5, 0.6, -0.02, 0.02], wooden_axe: [-0.02, 0.02, -0.21, 0.42, -0.04, 0.18],
  stone_fire_pit: [-0.72, 0.72, 0, 0.39, -0.72, 0.72], life_jacket: [-0.35, 0.35, 0, 0.99, -0.09, 0.09],
  ocean_buoy: [-0.47, 0.6, 0, 2.65, -0.48, 0.48], lateral_sea_marker: [-1.5, 1.5, 0, 6.84, -1.5, 1.5],
  wooden_lantern_01: [-0.11, 0.11, 0, 0.53, -0.11, 0.13], folding_wooden_stool: [-0.26, 0.26, 0, 0.44, -0.27, 0.27],
  rubber_boots: [-0.45, 0.45, 0, 0.38, -0.13, 0.13], Rockingchair_01: [-0.35, 0.35, 0, 1.19, -0.4, 0.52],
  painted_wooden_bench: [-0.57, 0.59, 0, 0.88, -0.26, 0.24], garden_gloves_01: [-0.11, 0.11, 0, 0.08, -0.13, 0.17],
  fishermans_hat: [-0.16, 0.16, 0, 0.09, -0.18, 0.18],
};
// färgjustering per modell (multipliceras på texturens färg): ljusare, mindre mättat där fotot var för mörkt
const TON = {
  rubber_boots: [1.25, 1.25, 1.25], Rockingchair_01: [1.4, 1.35, 1.3], painted_wooden_bench: [1.2, 1.15, 1.12], wooden_barrels_01: [1.15, 1.12, 1.08], wooden_crate_02: [1.08, 1.06, 1.04],
  stone_fire_pit: [1.1, 1.1, 1.1], wooden_axe: [1.1, 1.08, 1.05],
  shrub_02: [0.78, 1.08, 0.66],   // villans rabattbuskar: friskare grönt (skanningen är höstbrun)
};

// starten: efter första bilden (load + två bildrutor + vila)
const START = new Promise(ok => {
  const k = () => requestAnimationFrame(() => requestAnimationFrame(() => (window.requestIdleCallback || (f => setTimeout(f, 60)))(ok, { timeout: 1200 })));
  try { if (document.readyState === 'complete') k(); else addEventListener('load', k, { once: true }); } catch (e) { setTimeout(ok, 500); }
});
let LOADER = null;
const LADDAT = {};
// { delar: [{ namn, geo, mat, nod: Matrix4 }] } per modell; laddas en gång
function hamta(m) {
  return LADDAT[m] || (LADDAT[m] = START.then(() => new Promise(ok => {
    if (!LOADER) { LOADER = new GLTFLoader(); LOADER.setMeshoptDecoder(MeshoptDecoder); }
    LOADER.load(DIR + m + '.glb', g => {
      const delar = [], aniso = REND ? Math.min(8, REND.capabilities.getMaxAnisotropy()) : 4, ton = TON[m];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        const mat = o.material;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(t => { if (mat[t]) mat[t].anisotropy = aniso; });
        if (ton) mat.color.multiply(new THREE.Color(...ton));
        if (mat.metalness > 0.4 && !mat.metalnessMap) mat.metalness = 0.4;     // utan miljökarta blir blank metall svart
        mat.envMapIntensity = 0.8;
        if (mat.transmission > 0) { mat.transmission = 0; mat.transparent = true; mat.opacity = Math.min(mat.opacity, 0.45); mat.depthWrite = false; }   // transmission ritar hela scenen två gånger
        if (/glass/i.test(mat.name)) lyktGlas(mat);
        let nod = o.parent && o.parent.isMesh ? o.parent.name : o.name, p = o;
        while (p && p.parent && p.parent !== g.scene && !p.name) p = p.parent;
        nod = p.name || nod;
        o.geometry.computeBoundingBox();
        delar.push({ namn: nod, geo: o.geometry, mat, nod: o.matrixWorld.clone() });
      });
      ok({ delar });
    }, undefined, e => { console.warn('ph', m, e); ok(null); });
  })));
}
// lyktans glas: varmt sken som tänds med lamporna (uLampa), matt glas på dagen
function lyktGlas(mat) {
  mat.emissive = new THREE.Color('#ffb45a'); mat.emissiveIntensity = 2.4; mat.depthWrite = false;
  mat.onBeforeCompile = s => {
    s.uniforms.uLampa = VU ? VU.uLampa : { value: 0 };
    s.fragmentShader = 'uniform float uLampa;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep( 0.05, 0.6, uLampa );');
  };
  mat.customProgramCacheKey = () => 'ph-glas';
}
// variant av ett material: flyt = guppar på vattnet (lyft och lutning i vertexskuggaren), gron = det röda
// sjömärket omfärgat till styrbords gröna (röda texlar byter kanal, rost och smuts står kvar)
const VAR = new Map();
function variant(mat, flyt, gron) {
  if (!flyt && !gron) return mat;
  const k = mat.uuid + (flyt ? 'f' : '') + (gron ? 'g' : '');
  if (VAR.has(k)) return VAR.get(k);
  const m = mat.clone();
  m.onBeforeCompile = s => {
    if (gron) s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 c = diffuseColor.rgb; float rod = smoothstep( 0.03, 0.12, c.r - max( c.g, c.b ) );
        diffuseColor.rgb = mix( c, vec3( c.g * 0.42, c.r * 0.52, c.r * 0.36 ), rod ); }`);
    if (!flyt) return;
    s.uniforms.uTid = VU ? VU.uTid : { value: 0 };
    s.vertexShader = 'uniform float uTid;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        mat3 im = mat3( instanceMatrix ); float sk = max( length( im[ 1 ] ), 1e-4 );
        float fas = bas.x * 0.31 + bas.z * 0.23;
        vec3 w = ( im * transformed );                       // läget i världens skala (från instansens fot)
        float lyft = 0.06 * sin( uTid * 0.9 + fas ) + 0.025 * sin( uTid * 2.1 + fas * 2.0 );
        float lx = 0.035 * sin( uTid * 1.1 + fas + 1.3 ), lz = 0.03 * sin( uTid * 0.77 + fas + 0.4 );
        vec3 d = vec3( w.y * lx, lyft - w.x * lx - w.z * lz, w.y * lz );
        transformed += inverse( im ) * d;
      }`);
  };
  m.customProgramCacheKey = () => 'ph-' + (flyt ? 'flyt' : '') + (gron ? 'gron' : '');
  VAR.set(k, m);
  return m;
}

const V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S3 = new THREE.Vector3();
const HORN = [0, 1].flatMap(a => [0, 1].flatMap(b => [0, 1].map(c => [a, b, c])));
export const PH_LOGG = [];   // placerade föremål (för provbilder: window.__ph)
try { window.__ph = PH_LOGG; } catch (e) { /* ingen window */ }

export const ph = {
  klar: () => !AV,
  mått: m => { const v = MATT[m]; return v && { x0: v[0], x1: v[1], y0: v[2], y1: v[3], z0: v[4], z1: v[5] }; },
  grupp(poster, namn = 'ph', opt = {}) {   // opt.lager: extra lager (sjöns spegling)
    const g = new THREE.Group(); g.name = namn; g.matrixAutoUpdate = false;
    if (AV || !poster.length) return g;
    const per = {};
    poster.forEach(p => { (per[p.m] || (per[p.m] = [])).push(p); PH_LOGG.push({ m: p.m, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }); });
    Object.entries(per).forEach(([m, P]) => hamta(m).then(D => {
      if (!D) return;
      // grupper av poster med samma deluppsättning och flytflagga delar instansnät
      const sl = {};
      P.forEach(p => { const k = (p.del || '') + '|' + (p.flyt ? 1 : 0) + '|' + (p.farg || ''); (sl[k] || (sl[k] = [])).push(p); });
      Object.values(sl).forEach(PP => {
        const p0 = PP[0], delar = D.delar.filter(d => !p0.del || d.namn.includes(p0.del));
        if (!delar.length) return;
        // varje posts matris: placering × nod (delen ensam: noden flyttas till origo i x och z)
        const mats = PP.map(p => {
          const pl = new THREE.Matrix4().compose(V3.set(p.x, p.y, p.z), Q.setFromEuler(E.set(p.rx || 0, p.ry || 0, p.rz || 0, 'YXZ')), S3.setScalar(p.s || 1));
          const nm = delar.map(d => { const n = d.nod.clone(); if (p.del) { n.elements[12] = 0; n.elements[14] = 0; } return n; });
          let lag = Infinity;
          if (p.golv !== false) delar.forEach((d, i) => { const b = d.geo.boundingBox, M = new THREE.Matrix4().multiplyMatrices(pl, nm[i]); HORN.forEach(([a, bb, c]) => { V3.set(a ? b.max.x : b.min.x, bb ? b.max.y : b.min.y, c ? b.max.z : b.min.z).applyMatrix4(M); lag = Math.min(lag, V3.y); }); });
          const dy = Number.isFinite(lag) ? p.y - lag : 0;
          return nm.map(n => new THREE.Matrix4().multiplyMatrices(pl, n).premultiply(new THREE.Matrix4().makeTranslation(0, dy, 0)));
        });
        delar.forEach((d, i) => {
          const im = new THREE.InstancedMesh(d.geo, variant(d.mat, !!p0.flyt, p0.farg === 'gron'), PP.length);
          mats.forEach((ms, k) => im.setMatrixAt(k, ms[i]));
          im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox();
          im.name = 'ph-' + m; im.castShadow = !/glass/i.test(d.mat.name); im.receiveShadow = true; im.matrixAutoUpdate = false; im.userData.egen = false;
          if (/glass/i.test(d.mat.name)) im.renderOrder = 2;
          if (opt.lager) im.layers.enable(opt.lager);
          g.add(im);
        });
      });
      g.updateMatrixWorld(true);
      if (REND) REND.shadowMap.needsUpdate = true;
    }));
    return g;
  },
};
