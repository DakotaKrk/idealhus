// husritare-natur.js – fotoskannad skogsmark från Poly Haven (CC0): ormbunkar, mosstuvor, mossiga stenblock,
// stubbar, döda stockar, torra grenar, stenar och buskar. Filerna ligger färdigkomprimerade (meshopt + webp) i
// images/3d/ph/ph-<id>.glb. Varje modell normaliseras vid laddningen till en given storlek (basen på y = 0,
// mitten i x/z = 0) och ritas som ett instansierat nät per modell (ett ritanrop per modell och miljö).
// Laddas lat: först efter första bilden, och bara de modeller miljön ber om.
//
// API: skapaNatur(THREE, { VU, LJUS, ANISO, VAG_GLSL, MSAA }) i husritare-miljo.js; därefter
//   natur.grupp(poster, { sno })   poster [{ id, x, y, z, ry, s, lx?, lz? }] → Group (fylls när filerna finns)
//                                  y = markhöjden vid foten; s = skala (1 = modellens normalstorlek i MATT);
//                                  lx/lz = lutning (radianer) runt x/z; sno: snö på uppåtvända ytor (vinter)
//   natur.matt(id)                 { b: bredd i meter, h: höjd, sank: hur djupt foten sjunker in (andel av höjden) }
//   natur.av()                     true om ?natur=0 (för jämförelser)
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/three/addons/libs/meshopt_decoder.module.js';

let THREE = null, K = null;
const AV = (() => { try { return /[?&]natur=0/.test(location.search); } catch (e) { return false; } })();
// normalstorlek: b = största vågräta mått (m) eller l = längd (stockar), h = höjd om den styr; sank = andel av höjden under marken
// typ: 'sten' (fast, kastar skugga), 'tra' (stubbar, stockar, grenar), 'vaxt' (vajar lite, ingen skugga)
const MATT = {
  fern_02: { b: 1.35, sank: 0.05, typ: 'vaxt' },
  moss_01: { b: 0.55, sank: 0.15, typ: 'vaxt' },
  rock_moss_set_01: { b: 4.2, sank: 0.2, typ: 'sten' },   // en klunga på sex block
  rock_moss_set_02: { b: 3.6, sank: 0.2, typ: 'sten' },   // en rad block
  tree_stump_01: { b: 1.05, sank: 0.06, typ: 'tra' },
  tree_stump_02: { b: 0.95, sank: 0.06, typ: 'tra' },
  dead_tree_trunk: { b: 6.0, sank: 0.18, typ: 'tra' },
  dead_tree_trunk_02: { b: 4.6, sank: 0.4, typ: 'tra' },
  dry_branches_medium_01: { b: 1.7, sank: 0.1, typ: 'tra' },
  stone_01: { b: 1.3, sank: 0.25, typ: 'sten' },
  rock_07: { b: 0.9, sank: 0.25, typ: 'sten' },
  rock_09: { b: 1.1, sank: 0.2, typ: 'sten' },
  rock_face_01: { b: 5.0, sank: 0.22, typ: 'sten', gra: 0.75 },     // bred hällklack (strandkanter: motstranden, holmarna)
  rock_face_02: { b: 2.8, sank: 0.22, typ: 'sten', gra: 0.75 },     // gra: skanningens sandgula ton dras mot grå granit
  shrub_02: { h: 1.1, sank: 0.03, typ: 'vaxt' },
  shrub_03: { h: 0.8, sank: 0.03, typ: 'vaxt' },
  shrub_04: { h: 0.9, sank: 0.03, typ: 'vaxt' },
  nettle_plant: { h: 0.85, sank: 0.02, typ: 'vaxt' },
  shrub_sorrel_01: { h: 0.35, sank: 0.02, typ: 'vaxt' },
  weed_plant_02: { h: 0.5, sank: 0.02, typ: 'vaxt' },
  dandelion_01: { h: 0.28, sank: 0.02, typ: 'vaxt' },
};
const LADDAT = {}, MAT = {};
// laddningen börjar först när en bild har ritats (två bildrutor) och webbläsaren har en ledig stund
let START = null;
const start = () => START || (START = new Promise(ok => {
  const vid = () => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => ok(), { timeout: 2500 }) : setTimeout(ok, 300));
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(vid)); else vid();
}));
let LOADER = null;
const loader = () => LOADER || (LOADER = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));

// kvantiserade attribut (int16) till float, så att geometrin kan flyttas och skalas fritt
function tillFloat(geo) {
  for (const namn of ['position', 'normal', 'uv']) {
    const a = geo.attributes[namn]; if (!a || a.array instanceof Float32Array) continue;
    const n = a.count, s = a.itemSize, ut = new Float32Array(n * s);
    for (let i = 0; i < n; i++) { ut[i * s] = a.getX(i); if (s > 1) ut[i * s + 1] = a.getY(i); if (s > 2) ut[i * s + 2] = a.getZ(i); }
    geo.setAttribute(namn, new THREE.BufferAttribute(ut, s));
  }
  return geo;
}

// { geo, map, nor, alfa } för modellen id (alla nät i filen ihop, i modellens normalstorlek); laddas en gång
function hamta(id) {
  return LADDAT[id] || (LADDAT[id] = start().then(() => new Promise(ok => loader().load(`images/3d/ph/ph-${id}.glb`, g => {
    g.scene.updateMatrixWorld(true);
    const delar = [];
    let map = null, nor = null, alfa = false;
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = tillFloat(o.geometry.clone()); geo.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      delar.push(geo);
      const m = o.material; if (!map && m) { map = m.map || null; nor = m.normalMap || null; alfa = m.alphaTest > 0 || m.transparent; }
    });
    if (!delar.length) { ok(null); return; }
    // ihop till ett nät (filerna har ett nät, utom ogräset med två delar av samma material)
    let geo = delar[0];
    if (delar.length > 1) {
      const P = [], N = [], U = [], I = []; let bas = 0;
      for (const d of delar) {
        const p = d.attributes.position, nn = d.attributes.normal, uu = d.attributes.uv;
        for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); U.push(uu ? uu.getX(i) : 0, uu ? uu.getY(i) : 0); }
        if (d.index) for (let i = 0; i < d.index.count; i++) I.push(d.index.getX(i) + bas); else for (let i = 0; i < p.count; i++) I.push(i + bas);
        bas += p.count;
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.setIndex(I);
    }
    // normalstorlek: foten på y = 0, mitten i x/z = 0
    geo.computeBoundingBox();
    const bb = geo.boundingBox, M = MATT[id], sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
    const k = M.h ? M.h / Math.max(sy, 1e-3) : M.b / Math.max(sx, sz, 1e-3);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    for (const t of [map, nor]) if (t) t.anisotropy = K.ANISO;
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    console.info('ph-natur', id, (geo.index ? geo.index.count : geo.attributes.position.count) / 3 | 0, 'trianglar', [sx * k, sy * k, sz * k].map(v => v.toFixed(2)).join(' × '), 'm');
    ok({ geo, map, nor, alfa, H: sy * k });
  }, undefined, e => { console.warn('ph-natur', id, e); ok(null); }))));
}

// Material: Lambert med karta och normalkarta, miljöns omgivningsljus och nattdämpning som Fab-modellerna;
// växterna vajar lite i vinden; sno: snö på det som vänder sig uppåt (vinterns stenar och stubbar)
function material(id, del, sno, graV = MATT[id].gra) {   // graV: dra mot grå granit (andel), annars modellens egen
  const typ = MATT[id].typ, nyckel = id + '|' + (sno ? 1 : 0) + '|' + (graV || 0);
  if (MAT[nyckel]) return MAT[nyckel];
  const { VU, LJUS } = K;
  const m = new THREE.MeshLambertMaterial({ map: del.map, normalMap: del.nor || null, side: typ === 'vaxt' ? THREE.DoubleSide : THREE.FrontSide, alphaTest: del.alfa ? 0.45 : 0, alphaToCoverage: !!(del.alfa && K.MSAA) });
  if (del.nor) m.normalScale = new THREE.Vector2(1, 1);
  const H = Math.max(del.H, 0.05).toFixed(3);
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt, uVagA: VU.uVagA, uVagB: VU.uVagB });
    const v = `
      {
        vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        ${typ === 'vaxt' ? `
        mat3 im = mat3( instanceMatrix ); float s2 = max( dot( im[ 0 ], im[ 0 ] ), 1e-4 );
        float h = clamp( position.y / ${H}, 0.0, 1.0 ), fas = bas.x * 0.37 + bas.z * 0.29;
        float sv = h * h * 0.05 * ( 0.6 + 0.4 * sin( uTid * 1.3 + fas ) + 0.2 * sin( uTid * 3.1 + fas * 2.0 + position.x * 3.0 ) );
        transformed += transpose( im ) * ( vec3( uVind.x, 0.0, uVind.y ) * sv ) / s2;` : ''}
        if ( iVagF( bas.xz, 3.5 ) > 0.5 ) transformed = vec3( 0.0, -500.0, 0.0 );   // står i uppfartens glänta
      }`;
    s.vertexShader = K.VAG_GLSL + 'uniform float uTid;\nuniform vec2 uVind;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + v);
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\n' + s.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' +
        (typ === 'vaxt' ? ' diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ), diffuseColor.rgb, 0.8 ) * vec3( 0.86, 0.9, 0.8 );   // lite dovare än skanningen (som markväxterna)\n' : '') +
        (graV ? ` diffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ) * vec3( 1.62, 1.52, 1.46 ), ${graV.toFixed(2)} );\n` : '') +
        ' diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
      .replace('#include <lights_fragment_begin>', (sno ? `
        { // snö på det som vänder sig uppåt (världens normal), med normalkartans relief
          vec3 nW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
          float sn = smoothstep( 0.45, 0.8, nW.y );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.9, 0.96 ), sn );
        }
` : '') + '#include <lights_fragment_begin>')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus' + (typ === 'vaxt' ? ' + uSSS * 0.35' : '') + ' );');
  };
  m.customProgramCacheKey = () => 'ph-natur-' + typ + (sno ? '-sno' : '') + (graV ? '-gra' + graV : '');
  return (MAT[nyckel] = m);
}

const q = () => new THREE.Quaternion(), e = () => new THREE.Euler();
function matris(p, M, H) {
  const s = p.s || 1, y = p.y - M.sank * H * s;
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), q().setFromEuler(e().set(p.lx || 0, p.ry || 0, p.lz || 0, 'YXZ')), new THREE.Vector3(s, s * (p.sy || 1), s));
}

export const natur = {
  av: () => AV,
  matt: id => MATT[id],
  grupp(poster, { sno = false, namn = 'ph-natur', spegla = false, gra } = {}) {   // gra: grå granit (andel 0–1, t.ex. rabatternas block)   // spegla: syns i sjöns spegling (husritare-sjo.js)
    const g = new THREE.Group(); g.name = namn; g.matrixAutoUpdate = false;
    if (AV || !poster.length) return g;
    const per = {};
    poster.forEach(p => { if (MATT[p.id]) (per[p.id] || (per[p.id] = [])).push(p); });
    console.info('ph-natur', namn, Object.entries(per).map(([id, l]) => id + ' ' + l.length).join(', '));
    Object.entries(per).forEach(([id, lista]) => hamta(id).then(del => {
      if (!del) return;
      const M = MATT[id], im = new THREE.InstancedMesh(del.geo, material(id, del, sno, gra ?? MATT[id].gra), lista.length);
      lista.forEach((p, i) => im.setMatrixAt(i, matris(p, M, del.H)));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.name = 'ph-' + id; im.castShadow = M.typ !== 'vaxt'; im.receiveShadow = true; im.matrixAutoUpdate = false; im.userData.egen = false;
      if (spegla) im.userData.spegla = true;
      g.add(im);
    }));
    return g;
  },
};

// ---- klippta häckar (villaområdet): en tät, mörk kärna och två lövskal (alfa) utanpå, med skarp klippt form ----
// Formen: raka sidor som smalnar av lite uppåt, rundade axlar och plan topp. Lövtexturen ritas en gång på en duk
// (liguster: små ovala blad i varierande sommargrönt runt kvistar, med glipor) och läggs i meter längs ytan
// (u längs häcken, v runt profilen), så att skalen ger djup och en lövig kant i siluetten men formen förblir rak.
// Alla häckar i miljön i två nät (kärna + skal): två ritanrop och ett skuggritanrop.
const HTILE = 0.5;   // texturens ruta i meter
let HTEX = null;
function hackTextur() {
  if (HTEX) return HTEX;
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = K.ANISO || 4;
  let fro = 77413; const r = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  const PX = N / HTILE / 100;   // pixlar per centimeter
  // kvistar (syns i gliporna) och bladklungor längs dem: djupare blad mörkare, ytterst ljusare (ny tillväxt)
  const blad = [], kvistar = [];
  for (let i = 0; i < 60; i++) kvistar.push([r() * N, r() * N, r() * 6.283, (6 + r() * 10) * PX]);
  for (let i = 0; i < 1150; i++) {
    const k = kvistar[(r() * kvistar.length) | 0], t = r(), sp = (2 + r() * 5) * PX;
    const x = k[0] + Math.cos(k[2]) * k[3] * t + (r() - 0.5) * sp, y = k[1] + Math.sin(k[2]) * k[3] * t + (r() - 0.5) * sp;
    const d = r(), l = (2.6 + r() * 2.2) * PX, b = l * (0.36 + r() * 0.12);
    blad.push({ x, y, a: k[2] + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.9), l, b, d, h: 80 + r() * 24 + d * 5, s: 26 + r() * 20, lt: 15 + d * 22 + r() * 6 });
  }
  blad.sort((p, q) => p.d - q.d);
  const kopior = (x, y, m, f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const X = x + dx, Y = y + dy; if (X > -m && X < N + m && Y > -m && Y < N + m) f(X, Y); } };
  let i = 0, kv = false;
  const steg = () => {
    if (!kv) {
      kv = true; g.lineCap = 'round'; g.strokeStyle = 'rgba(58,44,30,0.95)'; g.lineWidth = 0.35 * PX;
      for (const [x0, y0, a, l] of kvistar) kopior(x0, y0, l + 4, (x, y) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); });
    }
    const slut = Math.min(blad.length, i + 400);
    for (; i < slut; i++) {
      const L = blad[i];
      kopior(L.x, L.y, L.l, (x, y) => {
        g.fillStyle = `hsl(${L.h},${L.s}%,${L.lt}%)`; g.beginPath(); g.ellipse(x, y, L.l / 2, L.b / 2, L.a, 0, 6.283); g.fill();
        // ljusare halva mot ljuset och mittnerven
        g.fillStyle = `hsla(${L.h - 4},${L.s + 6}%,${L.lt + 12}%,0.45)`; g.beginPath(); g.ellipse(x - Math.sin(L.a) * L.b * 0.18, y - L.b * 0.18, L.l * 0.42, L.b * 0.26, L.a, 0, 6.283); g.fill();
        g.strokeStyle = `hsla(${L.h},${L.s}%,${L.lt + 18}%,0.4)`; g.lineWidth = 0.08 * PX; g.beginPath(); g.moveTo(x - Math.cos(L.a) * L.l * 0.42, y - Math.sin(L.a) * L.l * 0.42); g.lineTo(x + Math.cos(L.a) * L.l * 0.4, y + Math.sin(L.a) * L.l * 0.4); g.stroke();
      });
    }
    return i >= blad.length;
  };
  // ritas i små steg när webbläsaren har en ledig stund (inga långa bildrutor)
  HTEX = { tex, klar: new Promise(ok => {
    const vid = typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 400 }) : f => setTimeout(f, 16);
    const kor = () => { if (steg()) { tex.needsUpdate = true; ok(tex); } else vid(kor); };
    start().then(() => vid(kor));
  }) };
  return HTEX;
}
function hackMaterial(skal) {
  const nyckel = 'hack' + (skal ? 'S' : 'K');
  if (MAT[nyckel]) return MAT[nyckel];
  const { VU, LJUS } = K, T = hackTextur();
  const m = new THREE.MeshLambertMaterial({ map: T.tex, vertexColors: true, alphaTest: skal ? 0.5 : 0, alphaToCoverage: !!(skal && K.MSAA) });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt });
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\n' + s.fragmentShader
      .replace('#include <map_fragment>', skal ? '#include <map_fragment>' :
        // kärnan: gliporna i lövverket blir mörka (skugga inne i häcken), ingen genomskinlighet
        '{ vec4 tc = texture2D( map, vMapUv ); diffuseColor.rgb *= mix( vec3( 0.05, 0.075, 0.035 ), tc.rgb, smoothstep( 0.2, 0.7, tc.a ) ); }')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * ' + (skal ? '0.3' : '0.12') + ' );');
  };
  m.customProgramCacheKey = () => 'ph-natur-' + nyckel;
  return (MAT[nyckel] = m);
}
// häckarnas nät: seg [{ x0, z0, x1, z1, H, D, typ, tint }] (y från hy, foten 5 cm under marken)
function hackGeo(seg, hy, skal) {
  const P = [], Nn = [], U = [], Cc = [], I = [];
  const lager = skal ? [[0.035, 0.31, 0.17, 1.0], [0.075, 0.63, 0.52, 0.92]] : [[0, 0, 0, 1]];
  for (const h of seg) {
    const dx = h.x1 - h.x0, dz = h.z1 - h.z0, L = Math.hypot(dx, dz); if (L < 0.2) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux, m = Math.max(1, Math.ceil(L / 0.8));
    for (const [o, du, dv, sk] of lager) {
      // profilen (tvärs, upp) från ena sidans fot över toppen till andra sidans fot
      const b0 = h.D / 2 + o, b1 = h.D / 2 * 0.86 + o, c = Math.min(0.12, h.H * 0.08), Ht = h.H + o;
      const pr = [[-b0, -0.05], [-b1, Ht - c], [-b1 + c * 0.45, Ht - c * 0.22], [-b1 + c, Ht], [b1 - c, Ht], [b1 - c * 0.45, Ht - c * 0.22], [b1, Ht - c], [b0, -0.05]];
      const vs = [0]; for (let k = 1; k < pr.length; k++) vs.push(vs[k - 1] + Math.hypot(pr[k][0] - pr[k - 1][0], pr[k][1] - pr[k - 1][1]));
      // mörkare mot foten, ljusare ny tillväxt uppåt (topp 0–1), och stora mjuka fläckar längs häcken
      const ton = (y, topp, x, z) => {
        const a = (0.5 + 0.5 * Math.min(1, Math.max(0, (y + 0.05) / (h.H * 0.75)))) * (0.86 + 0.14 * Math.sin(x * 0.83 + z * 0.37) * Math.sin(z * 0.61 - x * 0.29 + 1.7));
        return [h.tint[0] * a * (1 + 0.06 * topp), h.tint[1] * a * (1 + 0.08 * topp), h.tint[2] * a * (1 - 0.05 * topp)];
      };
      for (let k = 0; k < pr.length - 1; k++) {
        const [a0, y0] = pr[k], [a1, y1] = pr[k + 1], ea = a1 - a0, ey = y1 - y0, el = Math.hypot(ea, ey) || 1;
        let fa = ey / el, fy = -ea / el;
        if ((a0 + a1) / 2 * fa + ((y0 + y1) / 2 - h.H * 0.5) * fy < 0) { fa = -fa; fy = -fy; }   // normalen bort från mitten
        const topp = Math.max(0, fy), bas = P.length / 3;
        for (let j = 0; j <= m; j++) {
          const t = j / m, cx = h.x0 + dx * t, cz = h.z0 + dz * t, g0 = hy(cx, cz);
          for (const [aa, yy, vv] of [[a0, y0, vs[k]], [a1, y1, vs[k + 1]]]) {
            P.push(cx + nx * aa, g0 + yy, cz + nz * aa); Nn.push(nx * fa, fy, nz * fa);
            U.push((L * t + h.x0 * 0.37) / HTILE / sk + du, vv / HTILE / sk + dv); Cc.push(...ton(yy, topp, cx, cz));
          }
        }
        for (let j = 0; j < m; j++) {
          const q = bas + j * 2;
          // trianglarna (q, q+2, q+1) och (q+1, q+2, q+3); vänd om normalen pekar åt andra hållet
          const A = [P[q * 3], P[q * 3 + 1], P[q * 3 + 2]], B = [P[(q + 2) * 3], P[(q + 2) * 3 + 1], P[(q + 2) * 3 + 2]], C2 = [P[(q + 1) * 3], P[(q + 1) * 3 + 1], P[(q + 1) * 3 + 2]];
          const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C2[0] - A[0], C2[1] - A[1], C2[2] - A[2]];
          const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          if (cr[0] * nx * fa + cr[1] * fy + cr[2] * nz * fa >= 0) I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); else I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
        }
      }
      // gavlarna: profilen som en solfjäder (normalen åt −u vid början, +u vid slutet)
      for (const [t, sgn] of [[0, -1], [1, 1]]) {
        const cx = h.x0 + dx * t, cz = h.z0 + dz * t, g0 = hy(cx, cz), bas = P.length / 3;
        for (const [aa, yy] of pr) { P.push(cx + nx * aa + ux * sgn * o, g0 + yy, cz + nz * aa + uz * sgn * o); Nn.push(ux * sgn, 0, uz * sgn); U.push(aa / HTILE / sk + du + 0.5, yy / HTILE / sk + dv); Cc.push(...ton(yy, 0, cx, cz)); }
        // vinding efter normalen (första triangeln prövas)
        const A = bas, B = bas + 1, C2 = bas + 2;
        const e1 = [P[B * 3] - P[A * 3], P[B * 3 + 1] - P[A * 3 + 1], P[B * 3 + 2] - P[A * 3 + 2]], e2 = [P[C2 * 3] - P[A * 3], P[C2 * 3 + 1] - P[A * 3 + 1], P[C2 * 3 + 2] - P[A * 3 + 2]];
        const fram = (e1[1] * e2[2] - e1[2] * e2[1]) * ux * sgn + (e1[0] * e2[1] - e1[1] * e2[0]) * uz * sgn >= 0;
        for (let k = 1; k < pr.length - 1; k++) { if (fram) I.push(bas, bas + k, bas + k + 1); else I.push(bas, bas + k + 1, bas + k); }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  geo.setIndex(I); geo.computeBoundingSphere();
  return geo;
}
// ---- häckarnas löv: riktiga lövkvistar (fotograferade björkkvistar med alfa ur images/3d/fab-bjorkar.glb, "Five Birch
// Trees Pack" av LOLIPOP på Fab, CC BY 4.0, krediteras på sidan som de andra Fab-modellerna). Varje kvist är tre korsade
// kort (två lodräta, ett lutande) med kvistens foto; tusentals instanser fyller häckens yttre 25 cm. I skuggaren trycks
// allt som når utanför häckens låda in mot ytan (med några cm ojämnhet): sidorna och toppen blir klippta men med
// riktiga löv i flera lager, och normalen lutas utåt från häckens mitt (mjuk, sammanhållen belysning, ingen papp-kant).
// Ett instansierat nät (ett ritanrop) för alla nära häckar; längre bort räcker kärnan och lövskalen.
let KVIST = null;
function kvistKarta() {
  return KVIST || (KVIST = start().then(() => new Promise(ok => loader().load('images/3d/fab-bjorkar.glb', g => {
    let map = null; g.scene.traverse(o => { if (o.isMesh && /lov/.test(o.material.name) && o.material.map) map = o.material.map; });
    if (map) { map.anisotropy = K.ANISO || 4; map.colorSpace = THREE.SRGBColorSpace; }
    ok(map);
  }, undefined, e => { console.warn('hackar: fab-bjorkar', e); ok(null); }))));
}
function kvistGeo() {
  // kort 1 × 1 m med foten vid y = −0,5; uv: kvisten i atlasens övre högra ruta (A) och nedre vänstra (B)
  const P = [], N = [], U = [], I = [];
  const A = [0.545, 0.03, 0.97, 0.455], B = [0.03, 0.545, 0.455, 0.97];   // en bit innanför rutorna (barken i grannrutan blöder annars in i mipnivåerna)
  const kort = (ax, ay, az, bx, by, bz, nx, ny, nz, R, spegel) => {
    const k = P.length / 3;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j]) => {
      P.push(ax * i * 0.5 + bx * j * 0.5, ay * i * 0.5 + by * j * 0.5, az * i * 0.5 + bz * j * 0.5); N.push(nx, ny, nz);
      const u = (spegel ? -i : i) * 0.5 + 0.5, v = 0.5 - j * 0.5; U.push(R[0] + (R[2] - R[0]) * u, R[1] + (R[3] - R[1]) * v);
    });
    I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  kort(1, 0, 0, 0, 1, 0, 0, 0, 1, A, false);                                    // huvudkortet, parallellt med häckens yta
  const c = Math.cos(0.7), s = Math.sin(0.7), h = 0.55;
  kort(c * h, 0, s * h, 0, h, 0, -s, 0, c, B, false);                            // två mindre, vridna ±40°, ger djup
  kort(c * h, 0, -s * h, 0, h, 0, s, 0, c, A, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  return geo;
}
function kvistMaterial(map) {
  if (MAT.kvist) return MAT.kvist;
  const { VU, LJUS } = K;
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, alphaToCoverage: !!K.MSAA, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt, uTid: VU.uTid, uVind: VU.uVind });
    s.vertexShader = 'attribute vec4 aLada;\nattribute vec4 aMatt;\nattribute vec3 aTon;\nvarying vec3 vTon;\nvarying float vDjup;\nuniform float uTid;\nuniform vec2 uVind;\n' + s.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        // läget i världen och i häckens ram (aLada: mitt x, z och riktning ux, uz; aMatt: halv längd, halv djup, fot, höjd)
        vec4 wq = modelMatrix * instanceMatrix * vec4( position, 1.0 );
        vec2 hu = aLada.zw, hn = vec2( -hu.y, hu.x ), rel = wq.xz - aLada.xy;
        float lu = dot( rel, hu ), ln = dot( rel, hn ), ly = wq.y - aMatt.z;
        // ojämnhet i klippningen: några cm, olika längs häcken
        float oj = 0.035 * sin( lu * 7.3 + ly * 5.1 ) * sin( lu * 3.1 - ln * 9.0 + 1.3 );
        float bD = aMatt.y * mix( 1.0, 0.86, clamp( ly / aMatt.w, 0.0, 1.0 ) ) + oj, hT = aMatt.w + oj * 0.6;
        float nyN = clamp( ln, -bD - 0.05, bD + 0.05 ), nyY = min( ly, hT + 0.04 ), nyU = clamp( lu, -aMatt.x - 0.08, aMatt.x + 0.08 );   // bara det som sticker ut mer än ~5 cm klipps
        vec2 nyXZ = aLada.xy + hu * nyU + hn * nyN;
        vec3 nyW = vec3( nyXZ.x, aMatt.z + nyY, nyXZ.y );
        // vinden: toppen rör sig lite
        nyW.xz += uVind * 0.012 * clamp( nyY / aMatt.w, 0.0, 1.0 ) * sin( uTid * 1.7 + lu * 0.8 );
        // normalen: ut från häckens mitt (sidor och topp), blandad med kortets
        float tn = smoothstep( aMatt.w - 0.25, aMatt.w, nyY ), sn = sign( ln );
        vec3 ut = normalize( mix( vec3( hn.x * sn, 0.15, hn.y * sn ), vec3( 0.0, 1.0, 0.0 ), tn ) );
        objectNormal = normalize( mix( normalize( mat3( instanceMatrix ) * objectNormal ), ut, 0.8 ) );
        vTon = aTon;
        vDjup = clamp( min( bD - abs( ln ), hT - ly ) / 0.22, 0.0, 1.0 );   // 0 ytterst, 1 inne i häcken
        if ( aMatt.x < 0.0 ) {
          // klunga (buskar, trädkronor): aLada = mitt x, z, y och radie; normalen ut från klungans mitt, mörkare inåt;
          // vinden vajar klungan (mer högt upp och längre ut)
          vec3 cm = vec3( aLada.x, aLada.z, aLada.y ), d = wq.xyz - cm; float rr = length( d );
          nyW = wq.xyz;
          float sv = aMatt.y * ( 0.6 + 0.4 * sin( uTid * 1.3 + cm.x * 0.37 + cm.z * 0.29 ) );
          nyW.xz += uVind * sv * clamp( rr / aLada.w, 0.0, 1.2 ) + uVind * sv * 0.4 * sin( uTid * 3.1 + position.x * 5.0 );
          vec3 ut2 = normalize( d * vec3( 1.0, 1.3, 1.0 ) + vec3( 0.0, 0.25 * aLada.w, 0.0 ) );
          objectNormal = normalize( mix( normalize( mat3( instanceMatrix ) * objectNormal ), ut2, 0.75 ) );
          vDjup = clamp( 1.0 - rr / aLada.w, 0.0, 1.0 ) * 1.4 + clamp( ( cm.y - wq.y ) / aLada.w, 0.0, 1.0 ) * 0.35;
        }`)
      .replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = normalMatrix * objectNormal;\n#ifdef FLIP_SIDED\n transformedNormal = - transformedNormal;\n#endif')
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4( nyW, 1.0 );\ngl_Position = projectionMatrix * mvPosition;')
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4( nyW, 1.0 );');
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\nvarying vec3 vTon;\nvarying float vDjup;\n' + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= vTon * mix( 1.0, 0.45, vDjup );   // inne i häcken mörkare
        diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * 0.35 );');
  };
  m.customProgramCacheKey = () => 'ph-natur-kvist';
  return (MAT.kvist = m);
}
// instanser: kvistar i häckens yttre lager (sidor och topp), tätt (≈ 70 per meter häck)
function kvistNat(seg, hy, map) {
  let fro = 4711; const r = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  const M = [], LA = [], MA = [], TO = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sk = new THREE.Vector3();
  for (const h of seg) {
    const dx = h.x1 - h.x0, dz = h.z1 - h.z0, L = Math.hypot(dx, dz); if (L < 0.3) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux, cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2, y0 = hy(cx, cz) - 0.04, H = h.H, D = h.D;
    const n = Math.round(L * (h.typ ? 54 : 64));
    for (let i = 0; i < n; i++) {
      const t = r(), del = r(), lu = (t - 0.5) * (L + 0.1);
      let ln, ly, yaw, tilt;
      const s = 0.34 + r() * 0.18;
      if (del < 0.72) { const sd = r() < 0.5 ? -1 : 1; ln = sd * (D / 2 - 0.02 - r() * 0.12); ly = s * 0.35 + r() * (H - s * 0.6); yaw = Math.atan2(nx * sd, nz * sd) + (r() - 0.5) * 0.7; tilt = (r() - 0.5) * 0.5; }   // sidorna: kortet vänt utåt
      else { ln = (r() - 0.5) * (D - s * 0.5); ly = H - 0.03 - r() * 0.1; yaw = r() * 6.283; tilt = -1.45 + (r() - 0.5) * 0.35; }                                                    // toppen: kvistarna ligger ner, vända uppåt
      const x = cx + ux * lu + nx * ln, z = cz + uz * lu + nz * ln;
      p.set(x, y0 + ly, z); q.setFromEuler(e.set(tilt, yaw, (r() - 0.5) * 0.7, 'YXZ')); sk.set(s, s, s);
      M.push(new THREE.Matrix4().compose(p, q, sk));
      LA.push(cx, cz, ux, uz); MA.push(L / 2, D / 2, y0, H);
      const ljus = 0.78 + r() * 0.36, top = ly > H - 0.2 ? 1.08 : 1;
      TO.push(h.tint[0] * ljus * top * 0.95, h.tint[1] * ljus * top, h.tint[2] * ljus * top * 0.85);
    }
  }
  const geo = kvistGeo();
  geo.setAttribute('aLada', new THREE.InstancedBufferAttribute(new Float32Array(LA), 4));
  geo.setAttribute('aMatt', new THREE.InstancedBufferAttribute(new Float32Array(MA), 4));
  geo.setAttribute('aTon', new THREE.InstancedBufferAttribute(new Float32Array(TO), 3));
  const im = new THREE.InstancedMesh(geo, kvistMaterial(map), M.length);
  M.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  im.name = 'hackar-kvistar'; im.castShadow = false; im.receiveShadow = true; im.userData.egen = false; im.matrixAutoUpdate = false;
  return im;
}
// klungor av lövkvistar för buskar och trädkronor: poster [{ x, y, z, r (radie), sy (höjd/radie), n (kvistar), tint, s (kvistens storlek), vind }]
// kvistarna ligger i klungans yttre skal, kortet vänt utåt, några inne (mörka); ett instansierat nät
natur.lovklungor = (poster, namn = 'lovklungor') => {
  const g = new THREE.Group(); g.name = namn;
  if (!poster.length) return g;
  kvistKarta().then(map => {
    if (!map) return;
    let fro = 9001; const r = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
    const M = [], LA = [], MA = [], TO = [], q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sk = new THREE.Vector3();
    for (const k of poster) {
      const sy = k.sy || 0.8, n = k.n || Math.round(k.r * k.r * 36), s0 = k.s || 0.38;
      for (let i = 0; i < n; i++) {
        // punkt i skalet (lite in i klungan), tätare uppåt och utåt; ojämn kant (utbuktningar)
        const a = r() * 6.283, u = r() * 2 - 1, cu = Math.sqrt(1 - u * u), bukt = 0.86 + 0.18 * Math.sin(a * 3 + k.x) * Math.cos(u * 2.4 + k.z), djup = r() < 0.18 ? 0.45 + r() * 0.3 : 0.82 + r() * 0.2;
        const dx = Math.cos(a) * cu, dy = u, dz = Math.sin(a) * cu, rr = k.r * bukt * djup;
        p.set(k.x + dx * rr, k.y + dy * rr * sy, k.z + dz * rr);
        if (p.y < k.mark + 0.08) p.y = k.mark + 0.08 + r() * 0.1;
        const yaw = Math.atan2(dx, dz) + (r() - 0.5) * 0.9, tilt = -Math.asin(Math.max(-0.95, Math.min(0.95, dy))) * 0.9 + (r() - 0.5) * 0.5, s = s0 * (0.8 + r() * 0.5);
        q.setFromEuler(e.set(tilt, yaw, (r() - 0.5) * 1.2, 'YXZ')); sk.set(s, s, s);
        M.push(new THREE.Matrix4().compose(p, q, sk));
        LA.push(k.x, k.z, k.y, k.r); MA.push(-1, k.vind ?? 0.04, 0, 0);
        const lj = (0.74 + r() * 0.4) * (0.85 + 0.3 * Math.max(0, dy));
        TO.push(k.tint[0] * lj, k.tint[1] * lj, k.tint[2] * lj);
      }
    }
    const geo = kvistGeo();
    geo.setAttribute('aLada', new THREE.InstancedBufferAttribute(new Float32Array(LA), 4));
    geo.setAttribute('aMatt', new THREE.InstancedBufferAttribute(new Float32Array(MA), 4));
    geo.setAttribute('aTon', new THREE.InstancedBufferAttribute(new Float32Array(TO), 3));
    const im = new THREE.InstancedMesh(geo, kvistMaterial(map), M.length);
    M.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.name = namn; im.castShadow = false; im.receiveShadow = true; im.userData.egen = false; im.matrixAutoUpdate = false;
    // skuggan: en enkel, mörk kärna per klunga kastar skugga (kvistkorten gör det inte)
    g.add(im);
    try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e2) { /* utan fönster */ }
  });
  // mörka kärnor (skugga och täthet inifrån): ett instansierat nät av låga ikosaedrar
  const kg = new THREE.IcosahedronGeometry(1, 0), km = new THREE.MeshLambertMaterial({ color: '#2e4220' });
  km.onBeforeCompile = s2 => { s2.uniforms.miljoLjus = K.LJUS; s2.fragmentShader = 'uniform vec3 miljoLjus;\n' + s2.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus * 0.6;'); };
  km.customProgramCacheKey = () => 'ph-natur-klungkarna';
  const kim = new THREE.InstancedMesh(kg, km, poster.length), p2 = new THREE.Vector3(), q2 = new THREE.Quaternion(), s2v = new THREE.Vector3();
  poster.forEach((k, i) => kim.setMatrixAt(i, new THREE.Matrix4().compose(p2.set(k.x, Math.max(k.y, k.mark + k.r * (k.sy || 0.8) * 0.55), k.z), q2, s2v.set(k.r * 0.48, k.r * (k.sy || 0.8) * 0.45, k.r * 0.48))));
  kim.instanceMatrix.needsUpdate = true; kim.computeBoundingSphere(); kim.name = namn + '-karna'; kim.castShadow = true; kim.receiveShadow = true; kim.userData.egen = false; kim.matrixAutoUpdate = false;
  g.add(kim);
  return g;
};
// stammar vid foten (syns under lövverket): några grå-bruna stammar per meter, ett instansierat nät
function stamNat(seg, hy) {
  let fro = 811; const r = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  const geo = new THREE.CylinderGeometry(0.012, 0.018, 1, 4, 1, true).translate(0, 0.5, 0), M = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sk = new THREE.Vector3();
  for (const h of seg) {
    const dx = h.x1 - h.x0, dz = h.z1 - h.z0, L = Math.hypot(dx, dz); if (L < 0.3) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    for (let k = 0; k < L * 2.5; k++) {
      const lu = r() * L, ln = (r() - 0.5) * h.D * 0.55, x = h.x0 + ux * lu + nx * ln, z = h.z0 + uz * lu + nz * ln;
      p.set(x, hy(x, z) - 0.03, z); q.setFromEuler(e.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5)); sk.set(1, 0.35 + r() * 0.25, 1);
      M.push(new THREE.Matrix4().compose(p, q, sk));
    }
  }
  const m = new THREE.MeshLambertMaterial({ color: '#4a3f33' });
  m.onBeforeCompile = s => { s.uniforms.miljoLjus = K.LJUS; s.fragmentShader = 'uniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;'); };
  m.customProgramCacheKey = () => 'ph-natur-hackstam';
  const im = new THREE.InstancedMesh(geo, m, M.length); M.forEach((x, i) => im.setMatrixAt(i, x));
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.name = 'hackar-stammar'; im.userData.egen = false; im.matrixAutoUpdate = false;
  return im;
}
// häckarna: nära (inom ~55 m) en mörk kärna en bit innanför ytan, riktiga lövkvistar utanpå och stammar vid foten;
// längre bort kärnan med de två lövskalen (billigt, ser likadant ut på avstånd)
natur.hackar = (seg, hy) => {
  const g = new THREE.Group(); g.name = 'hackar';
  if (!seg.length) return g;
  const nara = seg.filter(h => Math.hypot((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2) < 48), fjarr = seg.filter(h => !nara.includes(h));
  const karna = [...fjarr, ...nara.map(h => ({ ...h, D: h.D * 0.72, H: h.H - 0.12, tint: h.tint.map(v => v * 0.7) }))];
  const kar = new THREE.Mesh(hackGeo(karna, hy, false), hackMaterial(false)); kar.name = 'hackar-karna'; kar.castShadow = true; kar.receiveShadow = true; kar.userData.egen = false; kar.matrixAutoUpdate = false; g.add(kar);
  let skal = null;
  if (fjarr.length) { skal = new THREE.Mesh(hackGeo(fjarr, hy, true), hackMaterial(true)); skal.name = 'hackar-skal'; skal.receiveShadow = true; skal.userData.egen = false; skal.matrixAutoUpdate = false; skal.visible = false; g.add(skal); }
  if (nara.length) {
    g.add(stamNat(nara, hy));
    kvistKarta().then(map => { if (!map) return; g.add(kvistNat(nara, hy, map)); try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ } });
  }
  hackTextur().klar.then(() => { if (skal) skal.visible = true; try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ } });
  return g;
};

export function skapaNatur(T, ctx) {
  THREE = T; K = ctx;
  return natur;
}
