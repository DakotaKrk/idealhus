// husritare-fab.js – sex fria modeller från Fab (CC BY 4.0; krediteringen står på sidan), kraftigt förenklade
// till images/3d/fab-*.glb med scratchpad-verktygen team-fab/verk (bjork.py, atlas.py, kantsten.py):
//   fab-bjorkar.glb   två björkar ur "Five Birch Trees Pack (lowpoly, LODs)" (LOLIPOP), lägsta LOD, barken förenklad
//   fab-kantsten.glb  8 m av "Grass strip along road with rolled curb" (marc sawyer) som höjdfält med bakad textur
//   fab-eka.glb       "Wooden Boat 1" (JamyzGenius), sex texturer i en atlas
//   fab-odling.glb    "Garden bed scan (lowpoly)" (sixonetwo), förenklad skanning
//   fab-uteplats.glb  "Garden seating" (Hellz): mur, sittgrupp, eldstad och pergola i en atlas, utan trappor
// Allt laddas lat en gång; varje anrop ger genast en tom grupp (eller ett tomt instansierat nät) som fylls när filen
// finns. Ett instansierat nät per del och material (få ritanrop). Träden och ekan rör sig i vertexskuggaren
// (vind och vågor via VU.uTid och VU.uVind), inget på processorn.
//
// API: skapaFab(THREE, { VU, LJUS, ANISO, VAG_GLSL }) i husritare-miljo.js; därefter
//   fab.bjorkar(poster)   poster [{ x, y, z, h, ry }]           → Group (björkar med vind; h = höjd i meter)
//   fab.eka(x, y, z, ry)                                       → Group (gungar på vattnet; fören mot lokala −z)
//   fab.odling(poster)    poster [{ x, y, z, ry, s }]           → Group
//   fab.odlingNat(m)      m: Matrix4[] (lokala, t.ex. i bebotts grupp) → InstancedMesh (fylls senare; överlever slaIhop)
//   fab.uteplats(x, y, z, ry, s)                               → Group
//   fab.kantsten(bitar)   bitar [{ x, y, z, ry }] (8 m långa, lokala +z längs gatan, +x mot gatan) → Group
//   fab.klar()            true när skapaFab körts
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';

let THREE = null, K = null;
const AV = (() => { try { return /[?&]fab=0/.test(location.search); } catch (e) { return false; } })();   // ?fab=0 stänger av (för jämförelser)
const FIL = { bjork: 'images/3d/fab-bjorkar.glb', eka: 'images/3d/fab-eka.glb', odling: 'images/3d/fab-odling.glb', uteplats: 'images/3d/fab-uteplats.glb', kantsten: 'images/3d/fab-kantsten.glb' };
const LADDAT = {}, MAT = {};

// { nätnamn: { geo, map, H } } per fil; laddas en gång
function hamta(namn) {
  return LADDAT[namn] || (LADDAT[namn] = new Promise(ok => new GLTFLoader().load(FIL[namn], g => {
    const ut = {};
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = o.geometry; geo.computeBoundingBox();
      const map = o.material && o.material.map;
      if (map) { map.anisotropy = K.ANISO; map.colorSpace = THREE.SRGBColorSpace; }
      ut[o.name] = { geo, map, H: geo.boundingBox.max.y, alfa: o.material && o.material.alphaTest > 0 };
    });
    ok(ut);
  }, undefined, e => { console.warn('fab', namn, e); ok(null); })));
}

// Material: Lambert med karta, miljöns omgivningsljus och nattdämpning som de andra växterna.
// typ: 'bark' | 'lov' (vind, löven fladdrar och lyses igenom), 'eka' (gungar), 'fast'
function material(typ, del) {
  const nyckel = typ + '|' + del.map.uuid;
  if (MAT[nyckel]) return MAT[nyckel];
  const { VU, LJUS } = K;
  const m = new THREE.MeshLambertMaterial({ map: del.map, side: typ === 'kantsten' ? THREE.FrontSide : THREE.DoubleSide, alphaTest: del.alfa ? 0.42 : 0, alphaToCoverage: !!(del.alfa && K.MSAA) });
  if (typ === 'kantsten') { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; m.transparent = true; m.depthWrite = false; }   // ligger på marken; gräsdelen tonar ut mot gräsmattan
  const H = Math.max(del.H, 0.01).toFixed(3);
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt, uVagA: VU.uVagA, uVagB: VU.uVagB });
    let v = '';
    if (typ === 'bark' || typ === 'lov') v = `
      {
        // instansens fot och skala; vinden räknas i världen och förs tillbaka till modellens rum
        vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        mat3 im = mat3( instanceMatrix ); float s2 = max( dot( im[ 0 ], im[ 0 ] ), 1e-4 );
        float h = clamp( position.y / ${H}, 0.0, 1.0 );
        float fas = bas.x * 0.07 + bas.z * 0.05;
        float by = sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 ), g = 0.55 + 0.45 * by;
        float sv = h * h * 0.22 * ( g * 1.1 + 0.25 * sin( uTid * 1.35 + fas * 3.0 ) + 0.12 * sin( uTid * 2.9 + fas * 5.0 ) );
        vec3 w = vec3( uVind.x, 0.0, uVind.y ) * sv;
        ${typ === 'lov' ? 'vec3 q = position * 1.7; w += h * 0.05 * ( 0.45 + 0.8 * g ) * length( uVind ) * vec3( sin( uTid * 6.1 + q.x + q.y * 1.3 ), 0.5 * sin( uTid * 7.3 + q.z * 1.1 + q.y ), cos( uTid * 5.3 + q.y * 1.2 + q.z ) );' : ''}
        transformed += transpose( im ) * w / s2;
        if ( iVagF( bas.xz, 5.0 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );   // står i uppfartens glänta
      }`;
    if (typ === 'eka') v = `
      {
        vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        float fas = bas.x * 0.3 + bas.z * 0.2;
        float rull = 0.03 * sin( uTid * 1.05 + fas ) + 0.012 * sin( uTid * 2.3 + fas * 2.0 );
        float stamp = 0.014 * sin( uTid * 0.8 + fas + 1.7 ), lyft = 0.03 * sin( uTid * 0.93 + fas + 0.6 );
        vec3 p = transformed;
        transformed.y += lyft + p.x * rull + p.z * stamp;
        transformed.x -= p.y * rull; transformed.z -= p.y * stamp;
      }`;
    s.vertexShader = (typ === 'bark' || typ === 'lov' ? K.VAG_GLSL : '') + 'uniform float uTid;\nuniform vec2 uVind;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + v);
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\n' + s.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (typ === 'lov' ? ' diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ), diffuseColor.rgb, 0.6 ) * vec3( 0.66, 0.72, 0.52 );   // dovare, mindre mättat grönt (neongrönt mot sanden)\n' : '') + (typ === 'kantsten' ? `
 {   // u: 0 = gräskanten mot tomten … 1 = rännstenen. Skanningens gräs dämpas mot gräsmattans ton och tonar ut mjukt,
     // så att villans gräsmatta syns igenom; kantstenen (u > ~0,62) står kvar som den är
   float u = vMapUv.x, sten = smoothstep( 0.56, 0.66, u );
   float l = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
   vec3 gras = mix( vec3( l ), diffuseColor.rgb, 0.7 ) * vec3( 0.86, 0.92, 0.74 );
   diffuseColor.rgb = mix( gras, diffuseColor.rgb, sten );
   diffuseColor.a = max( sten, smoothstep( 0.18, 0.6, u ) * 0.55 );
 }
` : '') + ' diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus' + (typ === 'lov' ? ' + uSSS * 0.45' : '') + ' );');
  };
  m.customProgramCacheKey = () => 'fab-' + typ;
  return (MAT[nyckel] = m);
}

const M4 = () => new THREE.Matrix4();
const matris = (x, y, z, ry, sx, sy = sx, sz = sx) => M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

// ett instansierat nät per del i filen (namnfilter), med givna matriser
function fyll(g, namn, matriser, val) {
  if (!matriser.length) return g;
  hamta(namn).then(D => {
    if (!D) return;
    Object.entries(D).forEach(([n, del]) => {
      if (val.filter && !val.filter(n)) return;
      const M = (val.matriser ? val.matriser(n) : matriser);
      if (!M.length) return;
      const im = new THREE.InstancedMesh(del.geo, material(val.typ(n), del), M.length);
      M.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.name = 'fab-' + n; im.castShadow = !!val.skugga; im.receiveShadow = true; im.matrixAutoUpdate = false; im.userData.egen = false;
      if (val.ordning) im.renderOrder = val.ordning;
      g.add(im);
    });
  });
  return g;
}
const grupp = namn => { const g = new THREE.Group(); g.name = namn; g.matrixAutoUpdate = false; return g; };

export const fab = {
  klar: () => !!THREE && !AV,
  // björkar: två sorter (bjork1, bjork2) växlar; skalan ur önskad höjd
  bjorkar(poster) {
    const g = grupp('fab-bjorkar');
    if (!poster.length) return g;
    const sort = [[], []];
    poster.forEach((p, i) => sort[i % 2].push(p));
    return fyll(g, 'bjork', poster, {
      skugga: true,
      typ: n => n.endsWith('lov') ? 'lov' : 'bark',
      matriser: n => sort[n.startsWith('bjork1') ? 0 : 1].map(p => matris(p.x, p.y, p.z, p.ry, p.h / (n.startsWith('bjork1') ? 10.78 : 11.66))),
    });
  },
  eka(x, y, z, ry) { return fyll(grupp('fab-eka'), 'eka', [matris(x, y, z, ry, 1)], { skugga: true, typ: () => 'eka' }); },
  odling(poster) { return fyll(grupp('fab-odling'), 'odling', poster.map(p => matris(p.x, p.y, p.z, p.ry, p.s || 1, p.sy || p.s || 1)), { skugga: true, typ: () => 'fast' }); },
  // för bebotts grupp: nätet finns direkt (tomt) och får geometri och material när filen laddats
  odlingNat(matriser) {
    const im = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }), matriser.length);
    matriser.forEach((m, i) => im.setMatrixAt(i, m));
    im.name = 'fab-odling'; im.castShadow = true; im.receiveShadow = true; im.userData.egen = false; im.frustumCulled = false;
    hamta('odling').then(D => { const del = D && D.odling; if (!del) return; im.geometry = del.geo; im.material = material('fast', del); im.frustumCulled = true; im.computeBoundingSphere(); });
    return im;
  },
  uteplats(x, y, z, ry, s) { return fyll(grupp('fab-uteplats'), 'uteplats', [matris(x, y, z, ry, s)], { skugga: true, typ: () => 'fast' }); },
  // kantstenen följer marken: bitarna slås ihop till ett nät där varje hörn lyfts till hy(x, z) (ett ritanrop)
  kantsten(bitar, hy) {
    const g = grupp('fab-kantsten');
    if (!bitar.length) return g;
    hamta('kantsten').then(D => {
      const del = D && D.kantsten; if (!del) return;
      const P0 = del.geo.attributes.position, U0 = del.geo.attributes.uv, I0 = del.geo.index, n = P0.count;
      const P = new Float32Array(n * bitar.length * 3), U = new Float32Array(n * bitar.length * 2), I = new Uint32Array(I0.count * bitar.length);
      bitar.forEach((b, k) => {
        const c = Math.cos(b.ry), s = Math.sin(b.ry);
        for (let i = 0; i < n; i++) {
          const lx = P0.getX(i), lz = P0.getZ(i), x = b.x + c * lx + s * lz, z = b.z - s * lx + c * lz, j = (k * n + i);
          P[j * 3] = x; P[j * 3 + 1] = hy(x, z) + P0.getY(i) + (b.dy || 0); P[j * 3 + 2] = z;
          U[j * 2] = U0.getX(i); U[j * 2 + 1] = U0.getY(i);
        }
        for (let i = 0; i < I0.count; i++) I[k * I0.count + i] = I0.getX(i) + k * n;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, material('kantsten', del));
      m.name = 'fab-kantsten'; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.egen = true; m.renderOrder = 1;
      g.add(m);
    });
    return g;
  },
};

export function skapaFab(T, ctx) {
  THREE = T; K = ctx;
  return fab;
}
