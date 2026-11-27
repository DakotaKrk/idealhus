// version: 2026-11-14 17:30
// husritare-bebott.js – spår av att folk bor i huset (byggs per hus och miljö).
//
// Trädgård: brevlåda vid uppfarten, sopkärl vid bilplatsens yttre ände, cykel med korg, klotgrill vid
// altanen, vedtrave vid en gavel, två odlingslådor (tomater vid käppar, sallad, dill) med en skottkärra,
// tvättlina på baksidan, gunga och en fotboll, krukor, vattenkanna, gummistövlar, lykta och slangvinda
// vid entrén. Skog: samma bas men yxkubbe och en skottkärra med ved vid traven, bänk och randig
// hängmatta i stället för tvättlina och gunga. Vinter: snö på locken och veden, snöskyffel mot
// väggen, spark vid entrén, pulka och snögubbe; inga växter, ingen tvättlina. Studio: ingenting.
// Till sist bakas alla enkla nät med samma material ihop (slaIhop): ~150 ritanrop blir 35–70.
//
// Allt är enkla primitiver (lådor, cylindrar, rundade lådor) med dämpade färger, ställs på
// markens höjd (mal.hy) och placeras deterministiskt (seedad slump per hus och miljö):
//  – mot väggen bara grunda saker (krukor och lykta vid trappan, slangvindan): i luckor utan dörrar,
//    låga fönster, trappor, altan och laddbox
//  – allt annat på tomten utanför gången runt huset (plats.ring.d2 + 0,2 m), fritt från mal.blockerad (altan,
//    bilplats, uppfart, gångar), naturens stammar, buskar och stenar (läses ur miljöns nät) och varandra.
// Lyktan vid dörren tänds med VU.uLampa (emissiv som skalas i shadern, ingen ny ljuskälla).
//
// API (från husritare-miljo.js):
//   const bebott = skapaBebott(THREE, rot, VU);
//   bebott.satt(namn, mal, plats)   // namn: 'studio' | 'tradgard' | 'skog' | 'vinter'
//   bebott.dispose()
import { RoundedBoxGeometry } from './vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { fab } from './husritare-fab.js?v=20261126t';   // skannade odlingsbäddar (Fab) när husritare-miljo.js startat modulen
import { blommor } from './husritare-blommor.js?v=20261126t';   // riktiga pelargoner och margeriter i krukorna
import { ph } from './husritare-ph.js?v=20261126t';   // Poly Haven-rekvisita (CC0): vattenkanna, lykta, stövlar, yxa, spade, gungstol, bänk, picknickbord …

// Husens öppningar (som HUS i husritare.js, nyckel L×W): [sida, u från vänster sett utifrån, bredd,
// underkant, dörr]. Bara för att inte ställa saker framför fönster och dörrar; okänt hus = bara dörrarna i mal.
const OPP = {
  '7.5x4': [['S', 0.55, 0.78, 0], ['S', 4.05, 0.89, 0, 1], ['S', 5.08, 0.6, 0], ['N', 1.87, 0.78, 0, 1], ['N', 4.95, 0.61, 1.5], ['E', 0.87, 2.39, 0, 1]],
  '10x4': [['S', 0.35, 0.81, 0.13], ['S', 5.17, 0.87, 0, 1], ['S', 6.6, 1.62, 0.9], ['N', 4.02, 0.81, 0, 1], ['N', 7.33, 0.59, 1.5],
    ['W', 0.32, 0.91, 1.52], ['W', 2.86, 0.81, 0.12], ['E', 0.46, 3.02, 0]],
  '12.5x4': [['N', 2.12, 1.63, 0.89], ['N', 4.12, 0.8, 0, 1], ['N', 6.51, 0.6, 1.5], ['N', 8.47, 0.6, 1.5], ['W', 0.25, 0.81, 0.1], ['W', 2.93, 0.81, 0.1],
    ['E', 0.5, 3.02, 0], ['S', 0.25, 0.81, 0.13], ['S', 7.66, 0.89, 0, 1], ['S', 9.06, 3.01, 0]],
  '10x7': [['N', 3.66, 0.58, 0], ['N', 5.79, 0.58, 0], ['N', 9.14, 0.58, 0], ['S', 1.1, 2.1, 0], ['S', 4.82, 2.39, 0, 1], ['S', 7.48, 0.8, 0],
    ['E', 3.85, 1.0, 0, 1], ['E', 5.23, 0.58, 0], ['W', 4.0, 2.1, 0]],
  '12x7': [['N', 0.28, 1.59, 0], ['N', 3.91, 0.78, 0], ['N', 6.58, 2.39, 0, 1], ['N', 9.57, 1.62, 0], ['S', 0.31, 0.87, 0, 1], ['S', 5.13, 0.89, 0, 1],
    ['S', 8.16, 0.58, 0], ['S', 10.83, 0.78, 0], ['E', 5.15, 1.58, 0], ['W', 3.81, 2.82, 0]],
};
const VAG = { B: 3.0, kant: 0.15 };   // uppfartens bredd och kantsten (som husritare-bil.js)
const mjuk = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const vagBoj = sv => 1.6 * mjuk(4, 16, sv);   // uppfartens böj (som husritare-bil.js)
function slump(s) { s = (s >>> 0) % 2147483646 + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

export function skapaBebott(THREE, rot, VU) {
  const grupp = new THREE.Group(); grupp.name = 'bebott'; rot.add(grupp);

  // ---- material (delas mellan husen, städas i dispose) ----
  const MAT = {};
  const mat = (hex, rough = 0.8, metal = 0, extra) => {
    const k = hex + rough + metal + (extra ? JSON.stringify(extra) : '');
    return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal }, extra || {})));
  };
  const snoMat = () => mat('#f4f7fb', 0.9, 0, { emissive: 0x1a2232 });
  // lyktans glas: varmt sken som tänds med lamporna (uLampa), svagt matt glas på dagen
  let glasMat = null;
  const lyktGlas = () => {
    if (glasMat) return glasMat;
    glasMat = new THREE.MeshStandardMaterial({ color: '#e8dcc4', roughness: 0.3, metalness: 0, emissive: '#ffb45a', emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
    glasMat.onBeforeCompile = s => {
      s.uniforms.uLampa = VU.uLampa;
      s.fragmentShader = 'uniform float uLampa;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep( 0.05, 0.6, uLampa );');
    };
    return glasMat;
  };

  // ---- byggklossar: varje nät får egen geometri (userData.egen) och kastar skugga ----
  const nat = (g, m, p, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, skugga = true) => {
    const o = new THREE.Mesh(g, m); o.userData.egen = true; o.castShadow = skugga; o.receiveShadow = true;
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o;
  };
  const lada = (w, h, d, m, p, x, y, z, rx, ry, rz) => nat(new THREE.BoxGeometry(w, h, d), m, p, x, y, z, rx, ry, rz);
  const rund = (w, h, d, rr, m, p, x, y, z, rx, ry, rz) => nat(new RoundedBoxGeometry(w, h, d, 2, Math.min(rr, w / 2, h / 2, d / 2) * 0.999), m, p, x, y, z, rx, ry, rz);
  const cyl = (rt, rb, h, seg, m, p, x, y, z, rx, ry, rz) => nat(new THREE.CylinderGeometry(rt, rb, h, seg), m, p, x, y, z, rx, ry, rz);
  const klot = (r, m, p, x, y, z, det = 1) => nat(new THREE.IcosahedronGeometry(r, det), m, p, x, y, z);
  const UPP = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  // stång mellan två punkter (lokala koordinater)
  const stang = (a, b, r, m, p, seg = 6, skugga = true) => {
    tmpA.set(...a); tmpB.set(...b); const l = tmpA.distanceTo(tmpB);
    const o = nat(new THREE.CylinderGeometry(r, r, l, seg), m, p, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 0, 0, 0, skugga);
    o.quaternion.setFromUnitVectors(UPP, tmpB.sub(tmpA).normalize()); return o;
  };
  const ny = namn => { const g = new THREE.Group(); g.name = namn; return g; };

  // ---- föremålen (lokalt: origo på marken, x längs väggen/längden, +z ut från väggen) ----
  function brevlada(sno) {
    const g = ny('brevlåda'), stolpe = mat('#2c2e2f', 0.6, 0.2), kropp = mat('#56645b', 0.55, 0.25);
    lada(0.08, 1.12, 0.08, stolpe, g, 0, 0.56, -0.12);
    lada(0.06, 0.05, 0.3, stolpe, g, 0, 1.08, -0.02);                                   // konsol
    lada(0.26, 0.17, 0.46, kropp, g, 0, 1.19, 0.02);
    const tak = new THREE.CylinderGeometry(0.13, 0.13, 0.46, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
    nat(tak, kropp, g, 0, 1.275, 0.02);
    lada(0.012, 0.11, 0.035, mat('#a8392c', 0.6), g, 0.137, 1.3, -0.1);                 // flaggan
    lada(0.002, 0.06, 0.14, mat('#e9e6de', 0.7), g, -0.131, 1.2, 0.04);                 // namnskylten
    if (sno) rund(0.3, 0.05, 0.5, 0.02, snoMat(), g, 0, 1.41, 0.02);
    return g;
  }
  function sopkarl(sno) {
    const g = ny('sopkärl');
    [['#3f5b3f', '#344c35', -0.3], ['#56595b', '#46494b', 0.3]].forEach(([f, l, x]) => {
      const k = new THREE.BoxGeometry(0.5, 0.92, 0.56, 1, 1, 1), p = k.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { p.setX(i, p.getX(i) * 0.86); p.setZ(i, p.getZ(i) * 0.88); }   // smalnar nedåt
      k.computeVertexNormals();
      nat(k, mat(f, 0.55), g, x, 0.53, 0.33);
      rund(0.54, 0.05, 0.63, 0.02, mat(l, 0.5), g, x, 1.01, 0.34);                      // lock
      lada(0.46, 0.03, 0.05, mat(l, 0.5), g, x, 0.97, 0.05);                            // handtag
      [-0.2, 0.2].forEach(h => cyl(0.1, 0.1, 0.05, 12, mat('#1b1c1d', 0.7), g, x + h, 0.1, 0.07, 0, 0, Math.PI / 2));
      if (sno) rund(0.5, 0.06, 0.58, 0.025, snoMat(), g, x, 1.06, 0.34);
    });
    // sopskärm: liggande bräder på baksidan och sidorna, stolpar i hörnen
    const tra = mat('#6a4e36', 0.85), stolp = mat('#5a4230', 0.85);
    for (let k = 0; k < 6; k++) {
      const y = 0.14 + k * 0.19;
      [-0.72, 0.72].forEach(x => lada(0.025, 0.13, 0.74, tra, g, x, y, 0.36));   // bara sidorna (en fristående bakvägg lästes som en lös skiva)
    }
    [[-0.72, -0.03], [0.72, -0.03], [-0.72, 0.72], [0.72, 0.72]].forEach(([x, z]) => lada(0.07, 1.2, 0.07, stolp, g, x, 0.6, z));
    lada(1.5, 0.05, 0.82, tra, g, 0, 1.22, 0.35);   // tak över kärlen
    return g;
  }
  function cykel() {
    const g = ny('cykel'), b = ny('ram'), ram = mat('#3d5866', 0.45, 0.3), svart = mat('#151617', 0.75), stal = mat('#9ea3a6', 0.35, 0.8);
    [-0.53, 0.53].forEach(x => {
      nat(new THREE.TorusGeometry(0.315, 0.024, 6, 28), svart, b, x, 0.34, 0);
      nat(new THREE.TorusGeometry(0.29, 0.006, 4, 24), stal, b, x, 0.34, 0, 0, 0, 0, false);
      cyl(0.03, 0.03, 0.08, 8, stal, b, x, 0.34, 0, Math.PI / 2);
    });
    const R = [-0.53, 0.34, 0], B = [-0.06, 0.3, 0], S = [-0.2, 0.84, 0], H = [0.38, 0.9, 0], Hb = [0.42, 0.7, 0], F = [0.53, 0.34, 0];
    [[B, S], [B, Hb], [R, B], [R, [-0.19, 0.78, 0]], [Hb, F], [H, Hb], [[0.08, 0.32, 0], [0.4, 0.74, 0]]].forEach(([a, c]) => stang(a, c, 0.017, ram, b));
    stang(H, [0.34, 1.0, 0], 0.014, stal, b);
    stang([0.31, 1.0, -0.23], [0.31, 1.0, 0.23], 0.012, stal, b);
    [-0.23, 0.23].forEach(z => cyl(0.018, 0.018, 0.1, 8, svart, b, 0.3, 1.0, z * 0.85, Math.PI / 2));
    rund(0.24, 0.06, 0.14, 0.025, svart, b, -0.22, 0.89, 0);
    lada(0.42, 0.018, 0.13, stal, b, -0.42, 0.72, 0);                                     // pakethållare
    // flätad korg på styret: öppen upptill (förr en sluten låda som såg ut som ett paket)
    const korg = mat('#8e6f4a', 0.9, 0, { side: THREE.DoubleSide });
    nat(new THREE.CylinderGeometry(0.16, 0.13, 0.19, 14, 1, true), korg, b, 0.62, 0.86, 0);
    cyl(0.13, 0.13, 0.01, 14, mat('#5e4a33', 0.95), b, 0.62, 0.77, 0);
    nat(new THREE.TorusGeometry(0.16, 0.012, 5, 18), mat('#7a5d3d', 0.85), b, 0.62, 0.955, 0, Math.PI / 2);
    cyl(0.09, 0.09, 0.025, 12, svart, b, -0.06, 0.3, 0.04, Math.PI / 2);                 // drevet
    stang([-0.1, 0.3, -0.03], [-0.24, 0.0, -0.16], 0.01, stal, b);                    // stödet
    b.position.z = 0.3; b.rotation.x = -0.07;                                             // står på stödet, lutar lite åt det
    g.add(b); return g;
  }
  function grill(sno) {
    const g = ny('grill'), svart = mat('#1c1d1f', 0.45, 0.35), stal = mat('#8d9295', 0.4, 0.8);
    nat(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), svart, g, 0, 0.74, 0);
    nat(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), svart, g, 0, 0.745, 0);
    lada(0.12, 0.03, 0.04, mat('#2a2b2c', 0.6), g, 0, 1.055, 0);
    [0, 2.094, 4.189].forEach(a => stang([Math.cos(a) * 0.2, 0.55, Math.sin(a) * 0.2], [Math.cos(a) * 0.33, 0.0, Math.sin(a) * 0.33], 0.014, stal, g));
    cyl(0.2, 0.2, 0.01, 18, mat('#4f5357', 0.6, 0.5), g, 0, 0.22, 0);                     // hyllan (mörk plåt: lyste vit förr)
    cyl(0.08, 0.06, 0.06, 10, stal, g, 0, 0.42, 0);                                     // askkoppen
    if (sno) nat(new THREE.SphereGeometry(0.297, 16, 4, 0, Math.PI * 2, 0, 0.85), snoMat(), g, 0, 0.75, 0);   // snömössa på locket
    return g;
  }
  function vedtrave(len, sno, r) {
    const g = ny('vedtrave'), tra = mat('#6a5a49', 0.9), virke = mat('#4d4a45', 0.85);
    const djup = 0.42, hojd = 1.02;
    // stockarna som en instans: bark på sidan, ljusa ändträn
    const st = [];
    for (let y = 0.15, rad = 0; y < hojd; rad++) {
      const rr = 0.06 + r() * 0.02;
      for (let x = -len / 2 + rr + (rad & 1 ? 0.04 : 0); x < len / 2 - rr; x += rr * 2 + 0.006) {
        const ri = rr * (0.85 + r() * 0.25);
        st.push([x, y + ri - rr, djup / 2 + 0.05 + (r() - 0.5) * 0.05, ri, djup * (0.92 + r() * 0.12), r() * 6.28]);
      }
      y += rr * 1.85;
    }
    const geo = new THREE.CylinderGeometry(1, 1, 1, 10);
    const m = new THREE.InstancedMesh(geo, [mat('#5f4d3c', 0.95), mat('#c7a77c', 0.9), mat('#c7a77c', 0.9)], st.length);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
    st.forEach(([x, y, z, ri, l, v], i) => {
      M4.compose(P.set(x, y, z), Q.setFromEuler(E.set(Math.PI / 2, 0, v)), S.set(ri, l, ri)); m.setMatrixAt(i, M4);
      const t = 0.82 + r() * 0.3; m.setColorAt(i, C.setRGB(t, t * (0.96 + r() * 0.06), t * (0.9 + r() * 0.1)));
    });
    m.userData.egen = true; m.castShadow = m.receiveShadow = true; g.add(m);
    // ställning: syllar, gavelstolpar och ett lutande tak av brädor
    [0.12, djup].forEach(z => lada(len + 0.1, 0.07, 0.07, tra, g, 0, 0.06, z));
    [-1, 1].forEach(s => [0.06, djup + 0.06].forEach(z => lada(0.06, hojd + 0.15, 0.06, tra, g, s * (len / 2 + 0.04), (hojd + 0.15) / 2, z)));
    lada(len + 0.3, 0.035, djup + 0.3, virke, g, 0, hojd + 0.17, djup / 2 + 0.12, 0.08);
    if (sno) rund(len + 0.3, 0.09, djup + 0.28, 0.04, snoMat(), g, 0, hojd + 0.23, djup / 2 + 0.12, 0.08);
    return g;
  }
  // ---- växter: varje planta är EN geometri med färg i hörnen, och alla delar samma material ----
  // Normalerna pekar uppåt/utåt ur plantan och vänds inte på baksidan (annars blir vartannat blad svart).
  const vaxtM = () => {
    const m = mat('#ffffff', 0.88, 0, { vertexColors: true, side: THREE.DoubleSide });
    if (!m.userData.vaxt) {
      m.userData.vaxt = true;
      m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );'); };
    }
    return m;
  };
  const LIN = {}, lin = hex => LIN[hex] || (LIN[hex] = (c => [c.r, c.g, c.b])(new THREE.Color(hex)));
  const bl = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const pl = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  function gronska() {
    const P = [], N = [], C = [];
    const v = (p, n, c) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c[0], c[1], c[2]); };
    const G = {
      v,
      // strå eller stjälk: avsmalnande band som böjer sig utåt av sin egen tyngd. lut = lutning från lodlinjen
      // vid roten, boj = ökning per led. per(q, t, andel) anropas i varje led (småblad längs en nerv).
      stra(x, y, z, az, len, b, lut, boj, c0, c1, seg = 4, spets = 0, per) {
        const ca = Math.cos(az), sa = Math.sin(az), sx = -sa * b / 2, sz = ca * b / 2, n = nrm(ca * 0.45, 1, sa * 0.45), dl = len / seg;
        let p = [x, y, z], t = lut, pv = 1, cv = c0;
        for (let i = 1; i <= seg; i++) {
          const q = [p[0] + Math.sin(t) * ca * dl, p[1] + Math.cos(t) * dl, p[2] + Math.sin(t) * sa * dl];
          const w = i === seg ? spets : 1 - Math.pow(i / seg, 1.6) * (1 - spets), cq = bl(c0, c1, i / seg);
          const a0 = [p[0] - sx * pv, p[1], p[2] - sz * pv], a1 = [p[0] + sx * pv, p[1], p[2] + sz * pv];
          if (w <= 0.001) { v(a0, n, cv); v(a1, n, cv); v(q, n, cq); }
          else { const b0 = [q[0] - sx * w, q[1], q[2] - sz * w], b1 = [q[0] + sx * w, q[1], q[2] + sz * w]; v(a0, n, cv); v(a1, n, cv); v(b1, n, cq); v(a0, n, cv); v(b1, n, cq); v(b0, n, cq); }
          if (per) per(q, t, i / seg);
          p = q; pv = w; cv = cq; t += boj;
        }
        return p;
      },
      // spetsigt blad från p längs d, bredd åt s; ena halvan mörkare (mittnerv), vik lyfter kanterna
      lov(p, d, s, l, b, n, c, c2 = c, vik = 0) {
        const m = pl(pl(p, d, l * 0.45), n, vik * b), a = pl(m, s, b / 2), e = pl(m, s, -b / 2), tp = pl(p, d, l), ck = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
        v(p, n, c); v(a, n, c); v(tp, n, c2); v(p, n, ck); v(tp, n, c2); v(e, n, ck);
      },
      // runt, kupat blad (sallad, pelargon): solfjäder från basen
      rund(p, d, s, l, b, n, c, c2 = c, kupa = 0) {
        const m = pl(p, d, l * 0.5), kant = [-2, -1, 0, 1, 2].map(th => pl(pl(pl(m, d, l * 0.5 * Math.cos(th)), s, b / 2 * Math.sin(th)), [0, 1, 0], kupa * l * Math.abs(Math.sin(th))));
        for (let i = 0; i < 4; i++) { const f = i === 0 || i === 3 ? [c2[0] * 0.85, c2[1] * 0.85, c2[2] * 0.85] : c2; v(p, n, c); v(kant[i], n, f); v(kant[i + 1], n, f); }
      },
      nat(p, x = 0, y = 0, z = 0) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        return nat(g, vaxtM(), p, x, y, z);
      },
    };
    return G;
  }
  function odlingslador(odling, sno, r) {
    const g = ny('odlingslådor'), tra = mat('#7c6b57', 0.9), kant = mat('#6d5e4c', 0.9), jord = mat('#35281e', 1);
    const SALLAD = ['#6a8c48', '#7f9c55', '#587c40'], BLAST = ['#3a5a2e', '#48693a'], V = gronska();
    const fo = fab.klar(), FM = [];   // fo: skannade odlingsbäddar (Fab, husritare-fab.js) i stället för lådorna; plantorna står kvar
    // Poly Havens odlingslåda i gammalt trä (planter_box_02, 1,31 × 0,47 × 0,49 m) före Fab-bädden: nedsänkt 10 cm så att
    // egen jord på 0,3 m (där plantorna står) ligger strax under kanten
    const pl = ph.klar(), PL = [];
    [-0.5, 0.5].forEach((z, j) => {
      if (pl) {
        PL.push({ m: 'planter_box_02', x: 0, y: -0.1, z, ry: j * Math.PI + (j ? 0.015 : -0.01), s: 1.05 });   // (slumpen dras som förut: 14 gånger per låda)
        lada(1.2, 0.02, 0.38, jord, g, 0, 0.3, z);
        for (let k = 0; k < 7; k++) { const dz = -0.24 + k * 0.08 + (r() - 0.5) * 0.01, rz = (r() - 0.5) * 0.03; if (Math.abs(dz) < 0.15) lada(1.16, 0.015, 0.03, jord, g, 0, 0.315, z + dz, 0, rz, 0); }   // krattade fåror
      } else if (fo) { FM.push(new THREE.Matrix4().compose(new THREE.Vector3(0, -0.01, z), new THREE.Quaternion().setFromAxisAngle(UPP, j * Math.PI), new THREE.Vector3(1.2, 1.6, 1.2))); for (let k = 0; k < 14; k++) r(); }   // (slumpen dras som förut)
      else {
      [-1, 1].forEach(s => { lada(1.24, 0.34, 0.045, tra, g, 0, 0.17, z + s * 0.3); lada(0.045, 0.34, 0.56, tra, g, s * 0.6, 0.17, z); });
      [-1, 1].forEach(s => { lada(1.3, 0.025, 0.08, kant, g, 0, 0.352, z + s * 0.29); lada(0.08, 0.025, 0.66, kant, g, s * 0.62, 0.352, z); });   // kantbräda att sitta på
      lada(1.16, 0.02, 0.56, jord, g, 0, 0.3, z);
      for (let k = 0; k < 7; k++) lada(1.12, 0.015, 0.03, jord, g, 0, 0.315, z - 0.24 + k * 0.08 + (r() - 0.5) * 0.01, 0, (r() - 0.5) * 0.03, 0);   // krattade fåror
      }
      if (sno) { rund(1.2, 0.09, 0.6, 0.04, snoMat(), g, 0, 0.37, z); return; }
      if (!odling) return;
      if (j === 0) {   // tomatplantor uppbundna vid käppar, några mogna tomater
        for (let i = 0; i < 3; i++) {
          const x = -0.38 + i * 0.38 + (r() - 0.5) * 0.05, zz = z + (r() - 0.5) * 0.1;
          stang([x + 0.04, 0.3, zz], [x + 0.04, 1.05, zz], 0.008, mat('#9c8456', 0.8), g, 4, false);
          stang([x, 0.3, zz], [x + 0.02, 0.95, zz + (r() - 0.5) * 0.04], 0.007, mat('#47663a', 0.85), g, 5, false);   // stjälken
          for (let k = 0; k < 11; k++) {   // parbladiga, hängande blad i spiral längs stjälken: en nerv med småblad i par
            const h = 0.36 + k * 0.052, a = k * 2.4 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), l = 0.23 + r() * 0.05 - k * 0.009, lu = 0.95 + r() * 0.3;
            const f = lin(BLAST[k % 2]), f2 = bl(f, lin('#7d9a52'), 0.3 + r() * 0.3), n = nrm(ca * 0.4, 1, sa * 0.4), ut = t => [Math.sin(t) * ca, Math.cos(t), Math.sin(t) * sa];
            const sma = (q, t, an) => [-1, 1].forEach(si => V.lov(q, nrm(Math.sin(t) * ca * 0.5 - sa * si, Math.cos(t) * 0.5 - 0.25, Math.sin(t) * sa * 0.5 + ca * si), ut(t), l * (0.5 - 0.14 * an), l * 0.27, n, f, f2, 0.15));
            const sp = V.stra(x + 0.01, h, zz, a, l, 0.008, lu, 0.22, f, f, 3, 0.6, sma);
            V.lov(sp, ut(lu + 0.66), [-sa, 0, ca], l * 0.5, l * 0.3, n, f, f2, 0.15);
          }
          for (let k = 0; k < 3; k++) klot(0.024 + r() * 0.008, mat(k ? '#c2402e' : '#d8873a', 0.45), g, x + (r() - 0.5) * 0.1, 0.45 + r() * 0.3, zz + (r() - 0.5) * 0.1, 1);
        }
      } else {         // sallad i rader och en rad med dill
        for (let i = 0; i < 6; i++) {
          const x = -0.45 + i * 0.18 + (r() - 0.5) * 0.03, zz = z + (i % 2 ? 0.1 : -0.1);
          if (i === 4) { for (let k = 0; k < 6; k++) stang([x, 0.31, zz], [x + (r() - 0.5) * 0.1, 0.55 + r() * 0.15, zz + (r() - 0.5) * 0.1], 0.006, mat('#7aa055', 0.8), g, 4, false); continue; }
          // salladshuvud: sex yttre blad som ligger ut och fem ljusare, mer upprätta i mitten
          const f = lin(SALLAD[i % 3]), f0 = bl(f, lin('#2f4a24'), 0.5), s = 0.06 + r() * 0.025;
          for (let k = 0; k < 11; k++) {
            const inre = k > 5, a = k * 2.4 + r() * 0.4, ca = Math.cos(a), sa = Math.sin(a), lu = inre ? 0.9 + r() * 0.3 : 0.25 + r() * 0.25, st = s * (inre ? 1.1 : 1.7) * (0.9 + r() * 0.2);
            V.rund([x + ca * 0.008, 0.31, zz + sa * 0.008], [ca * Math.cos(lu), Math.sin(lu), sa * Math.cos(lu)], [-sa, 0, ca], st, st * 0.95, nrm(ca * 0.5, 1, sa * 0.5), f0, inre ? bl(f, lin('#b9cf7a'), 0.4) : f, 0.22);
          }
        }
      }
    });
    if (odling && !sno) V.nat(g);
    if (FM.length) g.add(fab.odlingNat(FM));
    g.userData.ph = PL;   // (lokala; läggs i PHP vid placeringen, eftersom slaIhop tömmer gruppen innan filen laddats)
    return g;
  }
  // skottkärra (lokalt: hjulet mot +x): galvat tråg, grönt rör, luftgummihjul; last = 'jord' | 'ved' | null
  function skottkarra(last, sno, r) {
    const g = ny('skottkärra'), plat = mat('#8f979b', 0.45, 0.6), ror = mat('#3d5a3e', 0.5, 0.3), svart = mat('#1b1c1d', 0.8);
    const trag = new THREE.CylinderGeometry(0.5, 0.36, 0.3, 4, 1, true).rotateY(Math.PI / 4), p = trag.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * 1.15 + (p.getY(i) > 0 && p.getX(i) > 0 ? 0.12 : 0)); p.setZ(i, p.getZ(i) * 0.8); }
    trag.computeVertexNormals();
    nat(trag, mat('#8f979b', 0.45, 0.6, { side: THREE.DoubleSide }), g, 0, 0.55, 0);
    lada(0.6, 0.012, 0.42, plat, g, -0.02, 0.4, 0);                                       // botten
    [-1, 1].forEach(s => {
      stang([0.62, 0.3, s * 0.07], [-0.15, 0.42, s * 0.24], 0.016, ror, g);
      stang([-0.15, 0.42, s * 0.24], [-0.95, 0.62, s * 0.27], 0.016, ror, g);
      cyl(0.022, 0.022, 0.13, 8, svart, g, -0.98, 0.63, s * 0.27, 0, 0, Math.PI / 2 - 0.25);   // handtag
      stang([-0.35, 0.47, s * 0.25], [-0.42, 0.0, s * 0.25], 0.014, ror, g);               // stödben
    });
    nat(new THREE.TorusGeometry(0.15, 0.05, 8, 20), svart, g, 0.62, 0.2, 0);
    cyl(0.1, 0.1, 0.07, 12, mat('#c43a2c', 0.5), g, 0.62, 0.2, 0, Math.PI / 2);
    if (last === 'jord') {
      // kupad, knölig jordhög som sticker upp över trågkanten (förr en platt brun skiva)
      const jg = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), p = jg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.12 * Math.sin(x * 23 + z * 17) * Math.sin(z * 19 - x * 7) * (y > 0.02 ? 1 : 0); p.setXYZ(i, x * k, y * k, z * k); }
      jg.computeVertexNormals();
      const o = nat(jg, mat('#3d2d20', 1), g, 0.04, 0.56, 0); o.scale.set(1.0, 0.78, 0.7);
    }
    if (last === 'ved') for (let i = 0; i < 6; i++) {
      const o = cyl(0.05, 0.05, 0.4, 7, mat(i % 2 ? '#c7a77c' : '#6a5544', 0.9), g, -0.05 + (r() - 0.5) * 0.3, 0.6 + (i > 3 ? 0.08 : 0), (i % 4 - 1.5) * 0.11, Math.PI / 2, (r() - 0.5) * 0.4, 0);
      o.rotation.order = 'YXZ';
    }
    if (sno) { const o = nat(new THREE.SphereGeometry(0.3, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), snoMat(), g, 0.04, 0.62, 0); o.scale.set(1.05, 0.4, 0.72); }
    return g;
  }
  // gummistövlar, ett par (lokalt: tårna mot +z)
  function stovlar(r) {
    const g = ny('stövlar'), m = mat(r() < 0.5 ? '#2f3d2e' : '#1f2122', 0.6), sula = mat('#141414', 0.85);
    [[-0.07, 0, 0], [0.08, 0.04, 0.2]].forEach(([x, dz, ry]) => {
      const b = ny('stövel'); b.position.set(x, 0, dz); b.rotation.y = ry; g.add(b);
      cyl(0.052, 0.058, 0.32, 12, m, b, 0, 0.19, -0.02);
      rund(0.11, 0.09, 0.27, 0.04, m, b, 0, 0.045, 0.04);
      lada(0.105, 0.02, 0.27, sula, b, 0, 0.01, 0.04);
    });
    return g;
  }
  // spark (sparkstötting): sits med ryggstöd, styre och två långa medar (lokalt: framåt mot +x)
  function spark() {
    const g = ny('spark'), stal = mat('#9ba2a6', 0.35, 0.8), rod = mat('#9b2f25', 0.5), tra = mat('#7a5a3c', 0.7);
    [-0.2, 0.2].forEach(z => {
      stang([-0.75, 0.02, z], [0.5, 0.02, z], 0.016, stal, g);
      stang([0.5, 0.02, z], [0.62, 0.1, z], 0.016, stal, g);
      stang([0.28, 0.02, z * 0.9], [0.32, 0.5, z * 0.9], 0.014, rod, g);
      stang([0.32, 0.5, z * 0.9], [0.08, 0.98, z * 0.9], 0.014, rod, g);
    });
    rund(0.42, 0.03, 0.42, 0.012, tra, g, 0.32, 0.52, 0);                                 // sitsen
    rund(0.03, 0.4, 0.4, 0.01, tra, g, 0.11, 0.74, 0, 0, 0, 0.08);                        // ryggstödet
    stang([0.08, 0.98, -0.24], [0.08, 0.98, 0.24], 0.014, rod, g);                        // styret
    [-0.25, 0.25].forEach(z => cyl(0.02, 0.02, 0.09, 8, mat('#1b1c1d', 0.8), g, 0.08, 0.98, z, Math.PI / 2));
    return g;
  }
  function tvattlina(r) {
    const g = ny('tvättlina'), stolpe = mat('#8f8a80', 0.7, 0.2), lina = mat('#d8d4cc', 0.8);
    const L2 = 1.6, Y = 1.72;
    [-L2, L2].forEach(x => { lada(0.07, 1.8, 0.07, stolpe, g, x, 0.9, 0); lada(0.06, 0.06, 0.62, stolpe, g, x, 1.75, 0); });
    [-0.24, 0, 0.24].forEach(z => stang([-L2, Y, z], [L2, Y, z], 0.005, lina, g, 4, false));
    const PLAGG = [['#f1eee6', 0.62, 0.8], ['#9fb5c6', 0.42, 0.55], ['#d6b268', 0.5, 0.7], ['#c4806c', 0.38, 0.5], ['#e6e2d8', 0.95, 1.0], ['#7e8f74', 0.42, 0.6]];
    let x = -L2 + 0.25, i = 0;
    while (i < PLAGG.length) {
      const [f, b, h] = PLAGG[i], z = [-0.24, 0.24, 0][i % 3];
      if (x + b > L2 - 0.15) { x = -L2 + 0.3 + r() * 0.3; if (i > 3) break; }
      const o = lada(b, h, 0.012, mat(f, 0.95, 0, { side: THREE.DoubleSide }), g, x + b / 2, Y - h / 2 - 0.01, z, (r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.03);
      o.castShadow = true; x += b + 0.12 + r() * 0.15; i++;
    }
    return g;
  }
  function gunga() {
    const g = ny('gunga'), tra = mat('#866548', 0.85), rep = mat('#cfc6b4', 0.9);
    [-1.1, 1.1].forEach(x => [-0.72, 0.72].forEach(z => stang([x, 2.06, 0], [x * 1.12, 0, z], 0.045, tra, g, 8)));
    lada(2.6, 0.1, 0.1, tra, g, 0, 2.08, 0);
    [-0.45, 0.45].forEach((x, i) => {
      [-0.2, 0.2].forEach(d => stang([x + d, 2.03, 0], [x + d, 0.45, 0], 0.007, rep, g, 4, false));
      rund(0.44, 0.04, 0.18, 0.015, mat(i ? '#a8392c' : '#866548', 0.7), g, x, 0.44, 0);
    });
    return g;
  }
  function fotboll() {
    const g = ny('fotboll'), geo = new THREE.IcosahedronGeometry(0.11, 2), p = geo.attributes.position, f = [];
    const ik = new THREE.IcosahedronGeometry(1, 0).attributes.position, H = [];
    for (let i = 0; i < ik.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(ik, i); if (!H.some(h => h.distanceTo(v) < 1e-3)) H.push(v.normalize()); }
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.x += p.getX(i + k), c.y += p.getY(i + k), c.z += p.getZ(i + k);
      const svart = H.some(h => h.dot(c.normalize()) > 0.96), t = svart ? 0.05 : 0.86;
      for (let k = 0; k < 3; k++) f.push(t, t, svart ? 0.05 : 0.83);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(f, 3));
    nat(geo, mat('#ffffff', 0.55, 0, { vertexColors: true }), g, 0, 0.105, 0, 0.4, 0.7, 0);
    return g;
  }
  function kruka(rr, h, farg, typ, r) {
    // krukan: öppen mantel, rullad kant och jord tre centimeter ner; lerkrukor har krage. Växten är en
    // enda geometri (gronska) som börjar i jorden. typ: 'klot' | 'gras' | 'blommor' | 'ormbunke'
    const g = ny('kruka'), lera = typ === 'blommor' || typ === 'ormbunke', km = mat(farg, lera ? 0.9 : 0.7), yj = h - 0.03, y0 = yj + 0.004, V = gronska();
    nat(new THREE.CylinderGeometry(rr, rr * (lera ? 0.7 : 0.78), h, 18, 1, true), km, g, 0, h / 2, 0);
    if (lera) nat(new THREE.CylinderGeometry(rr * 1.07, rr * 1.05, h * 0.22, 18, 1, true), km, g, 0, h * 0.89, 0);
    nat(new THREE.TorusGeometry(rr * (lera ? 1.03 : 0.99), lera ? 0.02 : 0.016, 5, 18).rotateX(Math.PI / 2), km, g, 0, h - 0.012, 0);
    nat(new THREE.ConeGeometry(rr * 0.97, 0.02, 14), mat('#30251c', 1), g, 0, yj, 0, 0, 0, 0, false);
    if (typ === 'klot') {
      // buxbomsklot: mörk, lite knölig kärna och ett skal av små blad åt alla håll; ljusare nya skott upptill
      const R = rr * 1.05, cy = h + R * 0.78, fa = [r() * 6.28, r() * 6.28, r() * 6.28];
      const rad = (x, y, z) => R * (1 + 0.07 * Math.sin(x * 4.1 + fa[0]) * Math.cos(z * 3.7 + fa[1]) + 0.05 * Math.sin(y * 5.3 + fa[2]));
      const M0 = lin('#1c2c1c'), M1 = lin('#34502c'), L0 = lin('#2f4a2a'), L1 = lin('#4b6936'), NY = lin('#7c964c');
      const ik = new THREE.IcosahedronGeometry(1, 2), ip = ik.attributes.position;
      for (let i = 0; i < ip.count; i++) { const d = nrm(ip.getX(i), ip.getY(i), ip.getZ(i)), k = rad(d[0], d[1], d[2]) * 0.93; V.v([d[0] * k, cy + d[1] * k, d[2] * k], d, bl(M0, M1, 0.5 + 0.5 * d[1])); }
      ik.dispose();
      for (let i = 0, n = 720; i < n; i++) {
        const y = 1 - 1.88 * (i + r()) / n, a = i * 2.39996 + r() * 0.6, q = Math.sqrt(Math.max(0, 1 - y * y)), d = [Math.cos(a) * q, y, Math.sin(a) * q];
        const t1 = nrm(-d[2], 0, d[0]), t2 = [d[1] * t1[2], d[2] * t1[0] - d[0] * t1[2], -d[1] * t1[0]], v = r() * 6.283, cv = Math.cos(v), sv = Math.sin(v), ut = r() * r() * 0.7;
        const ld = nrm(t1[0] * cv + t2[0] * sv + d[0] * ut, t2[1] * sv + d[1] * ut + 0.12, t1[2] * cv + t2[2] * sv + d[2] * ut);
        const s = nrm(ld[1] * d[2] - ld[2] * d[1], ld[2] * d[0] - ld[0] * d[2], ld[0] * d[1] - ld[1] * d[0]);
        const dj = 0.92 + r() * 0.11, k = rad(d[0], d[1], d[2]) * dj, l = 0.032 + r() * 0.02, ho = 0.5 + 0.5 * y;
        let c = bl(L0, L1, ho * 0.6 + r() * 0.4);
        if (r() < 0.05 + 0.2 * ho) c = bl(c, NY, 0.5);
        if (dj < 0.96) c = bl(c, M1, 0.5);
        V.lov([d[0] * k, cy + d[1] * k, d[2] * k], ld, s, l, l * 0.62, nrm(d[0] + (r() - 0.5) * 0.5, d[1] + 0.3 + (r() - 0.5) * 0.5, d[2] + (r() - 0.5) * 0.5), c, bl(c, NY, 0.2), 0.1);
      }
    } else if (typ === 'gras') {
      // prydnadsgräs: många tunna strån i en fontän, några torra, och vippor på höga stjälkar
      const G0 = lin('#2c3d22'), G1 = lin('#6b7f45'), T0 = lin('#8a8656'), T1 = lin('#b5a673'), V0 = lin('#978763'), V1 = lin('#bdad86');
      for (let i = 0; i < 72; i++) {
        const a = r() * 6.283, ut = Math.sqrt(r()), d = ut * rr * 0.55, torr = r() < 0.1;
        V.stra(Math.cos(a) * d, y0, Math.sin(a) * d, a + (r() - 0.5) * 0.9, (0.42 + r() * 0.28) * (1 - 0.25 * ut), 0.01 + r() * 0.006, 0.04 + ut * 0.3 + r() * 0.12, 0.1 + r() * 0.2,
          torr ? T0 : G0, torr ? T1 : bl(G1, T0, r() * 0.35), 4);
      }
      for (let i = 0; i < 7; i++) {
        const a = r() * 6.283, d = r() * rr * 0.3, lu = 0.03 + r() * 0.1, bo = 0.04 + r() * 0.05;
        const p = V.stra(Math.cos(a) * d, y0, Math.sin(a) * d, a, 0.5 + r() * 0.2, 0.006, lu, bo, T0, T1, 3, 0.8);
        V.stra(p[0], p[1], p[2], a, 0.15 + r() * 0.07, 0.03, lu + bo * 3, 0.14, V0, V1, 3);
      }
    } else if (typ === 'ormbunke') {
      // ormbunke: bågade blad med flikar i par längs nerven, korta upprätta blad i mitten
      const O0 = lin('#263c1f'), O1 = lin('#4c6b33'), O2 = lin('#7f9a4e');
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), len = (i < 3 ? 0.24 : 0.33) + r() * 0.1, c1 = bl(O1, O2, r() * 0.5), n = nrm(ca * 0.5, 1, sa * 0.5);
        const flik = (q, t, an) => {
          const fl = len * 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(an * 0.94, 0.7)), 0.8) + 0.01;
          [-1, 1].forEach(si => V.lov(q, nrm(Math.sin(t) * ca * 0.35 - sa * si, Math.cos(t) * 0.35 - 0.1, Math.sin(t) * sa * 0.35 + ca * si), [Math.sin(t) * ca, Math.cos(t), Math.sin(t) * sa], fl, len * 0.12, n, bl(O0, c1, an), c1, 0.1));
        };
        V.stra(ca * 0.02, y0, sa * 0.02, a, len, 0.006, (i < 3 ? 0.1 : 0.35) + r() * 0.25, 0.13 + r() * 0.05, O0, c1, 9, 0, flik);
      }
    } else if (blommor.klar()) {
      g.userData.blom = { y: y0, rr };   // riktig pelargon/margerit (husritare-blommor.js) läggs i satt() efter slaIhop
    } else {
      // sommarblommor: en kulle av runda blad som hänger över kanten och blomklasar på korta stjälkar
      const B0 = lin('#294020'), B1 = lin('#52703a'), B2 = lin('#7b9450'), FA = lin('#b55f76'), FB = lin('#dfa3ad'), FC = lin('#efe6da');
      for (let i = 0, n = 46; i < n; i++) {
        const a = i * 2.39996 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), ut = Math.sqrt((i + 0.5) / n), d = ut * rr * 0.8, lu = 0.75 - ut * 1.1 + (r() - 0.5) * 0.3, l = 0.06 + r() * 0.03;
        V.rund([ca * d, y0 + 0.02 + (1 - ut) * 0.12 + r() * 0.03, sa * d], [ca * Math.cos(lu), Math.sin(lu), sa * Math.cos(lu)], [-sa, 0, ca], l, l * 1.05, nrm(ca * 0.6, 1, sa * 0.6), bl(B0, B1, 0.3 + r() * 0.4), bl(B1, B2, (1 - ut) * 0.5 + r() * 0.4), 0.12);
      }
      for (let i = 0; i < 9; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * rr * 0.7, fa = r() < 0.25 ? FC : bl(FA, FB, r());
        const p = V.stra(Math.cos(a) * d, y0 + 0.08, Math.sin(a) * d, a, 0.14 + r() * 0.1, 0.007, 0.1 + r() * 0.3, 0.1, B1, B2, 2, 0.8);
        for (let k = 0; k < 8; k++) {
          const v = k * 0.785 + r() * 0.5, e = 0.2 + r() * 1.1, pd = [Math.cos(v) * Math.cos(e), Math.sin(e), Math.sin(v) * Math.cos(e)];
          V.lov(pl(p, pd, 0.008), pd, [-Math.sin(v), 0, Math.cos(v)], 0.03, 0.026, nrm(pd[0] * 0.5, 1, pd[2] * 0.5), bl(fa, FA, 0.35), bl(fa, FC, r() * 0.3));
        }
      }
    }
    V.nat(g);
    return g;
  }
  function vattenkanna() {
    const g = ny('vattenkanna'), m = mat('#5b7f6a', 0.5, 0.3);
    cyl(0.09, 0.1, 0.22, 14, m, g, 0, 0.11, 0);
    stang([0.07, 0.06, 0], [0.24, 0.24, 0], 0.012, m, g);
    cyl(0.025, 0.012, 0.03, 8, m, g, 0.245, 0.25, 0, 0, 0, -0.8);
    const h = nat(new THREE.TorusGeometry(0.08, 0.01, 4, 12, Math.PI), m, g, -0.02, 0.22, 0); h.rotation.z = 0.2;
    return g;
  }
  function lykta(sno) {
    const g = ny('lykta'), svart = mat('#1d1e1f', 0.5, 0.4);
    lada(0.18, 0.025, 0.18, svart, g, 0, 0.012, 0);
    nat(new THREE.BoxGeometry(0.13, 0.22, 0.13), lyktGlas(), g, 0, 0.135, 0, 0, 0, 0, false);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => lada(0.016, 0.24, 0.016, svart, g, a * 0.07, 0.135, b * 0.07));
    nat(new THREE.ConeGeometry(0.13, 0.08, 4), svart, g, 0, 0.29, 0, 0, Math.PI / 4);
    nat(new THREE.TorusGeometry(0.03, 0.006, 4, 10), svart, g, 0, 0.35, 0);
    if (sno) { const s = nat(new THREE.ConeGeometry(0.12, 0.05, 4), snoMat(), g, 0, 0.33, 0, 0, Math.PI / 4); s.scale.set(0.9, 1, 0.9); }
    return g;
  }
  function slangvinda() {
    const g = ny('slangvinda'), gra = mat('#3b3d3e', 0.6, 0.2), slang = mat('#3f7536', 0.6);
    lada(0.2, 0.26, 0.02, gra, g, 0, 0.55, 0.01);
    lada(0.04, 0.04, 0.14, gra, g, 0, 0.55, 0.08);
    [0.1, 0.27].forEach(z => cyl(0.19, 0.19, 0.015, 16, gra, g, 0, 0.55, z, Math.PI / 2));
    [0.14, 0.185, 0.23].forEach((z, i) => nat(new THREE.TorusGeometry(0.14 - i * 0.005, 0.03, 6, 18), slang, g, 0, 0.55, z));
    stang([0.12, 0.47, 0.2], [0.18, 0.03, 0.24], 0.018, slang, g, 6);
    stang([0.18, 0.03, 0.24], [0.5, 0.02, 0.27], 0.018, slang, g, 6);
    return g;
  }
  // origo 0,3 m från väggen: skaftet vilar mot väggen, bladets underkant står på marken
  function snoskyffel() {
    const g = ny('snöskyffel'), skaft = mat('#2a2b2c', 0.6, 0.2), blad = mat('#2f5a85', 0.55);
    rund(0.5, 0.025, 0.4, 0.01, blad, g, 0, 0.2, 0.25, 1.19);
    lada(0.5, 0.05, 0.03, mat('#9aa0a4', 0.4, 0.7), g, 0, 0.025, 0.33, 1.19);           // slitlist i underkant
    stang([0, 0.36, 0.19], [0, 1.22, -0.2], 0.017, skaft, g);
    stang([-0.075, 1.25, -0.22], [0.075, 1.25, -0.22], 0.014, skaft, g);
    rund(0.44, 0.05, 0.3, 0.02, snoMat(), g, 0, 0.27, 0.26, 1.19);                      // kramsnö kvar på bladet
    return g;
  }
  function pulka() {
    const g = ny('pulka'), rod = mat('#b83a2e', 0.45);
    rund(0.82, 0.1, 0.46, 0.04, rod, g, 0, 0.07, 0);
    rund(0.22, 0.1, 0.46, 0.04, rod, g, 0.47, 0.13, 0, 0, 0, 0.6);
    stang([0.55, 0.15, 0], [0.95, 0.02, 0.15], 0.008, mat('#d9d3c6', 0.9), g, 4, false);
    return g;
  }
  function snogubbe() {
    const g = ny('snögubbe'), sno = snoMat(), kol = mat('#1a1a1a', 0.9);
    [[0.36, 0.3], [0.27, 0.82], [0.19, 1.2]].forEach(([r, y]) => klot(r, sno, g, 0, y, 0, 2));
    nat(new THREE.ConeGeometry(0.035, 0.18, 8), mat('#d8742c', 0.7), g, 0, 1.2, 0.26, Math.PI / 2);
    [-0.07, 0.07].forEach(x => klot(0.022, kol, g, x, 1.26, 0.17, 0));
    [0.72, 0.84, 0.96].forEach((y, i) => klot(0.024, kol, g, 0, y, 0.26 - i * 0.015, 0));
    nat(new THREE.TorusGeometry(0.17, 0.04, 6, 16), mat('#a33a33', 0.85), g, 0, 1.04, 0, Math.PI / 2);
    lada(0.08, 0.2, 0.04, mat('#a33a33', 0.85), g, 0.1, 0.92, 0.16, 0.2, 0, 0.1);
    const brun = mat('#4a3a2c', 0.9);
    stang([0.24, 0.86, 0], [0.62, 1.12, 0.05], 0.015, brun, g, 4); stang([0.5, 1.04, 0.04], [0.6, 1.2, 0.02], 0.01, brun, g, 4);
    stang([-0.24, 0.86, 0], [-0.6, 1.02, -0.05], 0.015, brun, g, 4);
    cyl(0.12, 0.14, 0.18, 12, mat('#2e3134', 0.6, 0.3), g, 0, 1.43, 0, -0.12);   // en hink som hatt
    return g;
  }
  function yxkubbe(r, utanYxa = false) {   // utanYxa: Poly Havens yxa sätts i kubben i stället (husritare-ph.js)
    const g = ny('yxkubbe'), bark = mat('#5f4d3c', 0.95), ande = mat('#c7a77c', 0.9);
    nat(new THREE.CylinderGeometry(0.25, 0.27, 0.44, 10), [bark, ande, ande], g, 0, 0.22, 0);
    if (!utanYxa) {
      lada(0.16, 0.08, 0.025, mat('#3a3c3e', 0.4, 0.7), g, 0.02, 0.47, 0, 0, 0, -0.3);   // yxhuvudet i kubben
      stang([0.08, 0.5, 0], [0.48, 0.84, 0.05], 0.018, mat('#a98458', 0.7), g);
    }
    for (let i = 0; i < 4; i++) {   // kluvna vedträn på marken
      const a = r() * 6.28, d = 0.45 + r() * 0.25;
      lada(0.34, 0.08, 0.1, mat(i % 2 ? '#c7a77c' : '#8d7458', 0.9), g, Math.cos(a) * d, 0.04, Math.sin(a) * d, 0, r() * 3, 0);
    }
    return g;
  }
  function bank(sno) {
    const g = ny('bänk'), tra = mat('#7d6248', 0.85), ben = mat('#2c2d2e', 0.6, 0.3);
    [-0.1, 0.04].forEach(z => rund(1.4, 0.04, 0.13, 0.01, tra, g, 0, 0.45, z));
    [-0.55, 0.55].forEach(x => { lada(0.05, 0.45, 0.04, ben, g, x, 0.225, 0.08); lada(0.05, 0.82, 0.04, ben, g, x, 0.41, -0.17, -0.12); lada(0.05, 0.04, 0.34, ben, g, x, 0.42, -0.02); });
    [0.6, 0.76].forEach(y => rund(1.4, 0.1, 0.03, 0.01, tra, g, 0, y, -0.18 - (y - 0.45) * 0.12, -0.12));
    if (sno) rund(1.36, 0.05, 0.24, 0.02, snoMat(), g, 0, 0.49, -0.03);
    return g;
  }
  function hangmatta() {
    const g = ny('hängmatta'), tra = mat('#7d6248', 0.85), duk = mat('#ffffff', 0.95, 0, { side: THREE.DoubleSide, vertexColors: true });
    lada(2.6, 0.08, 0.1, tra, g, 0, 0.05, 0);
    [-1.25, 1.25].forEach(x => lada(0.1, 0.06, 0.8, tra, g, x, 0.03, 0));
    [-1, 1].forEach(s => { stang([s * 0.85, 0.08, 0], [s * 1.35, 0.7, 0], 0.045, tra, g); stang([s * 1.35, 0.7, 0], [s * 1.5, 1.2, 0], 0.045, tra, g); });
    // duken: randig bomullsväv längs hela längden (en färg per triangel, skarpa ränder)
    const pg = new THREE.PlaneGeometry(2.0, 0.8, 16, 9).rotateX(-Math.PI / 2), p = pg.attributes.position, tvars = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), q = x / 1.0, bag = 1 - q * q, zn = p.getZ(i) / 0.4;
      p.setY(i, 1.0 - 0.48 * bag - 0.06 * (1 - zn ** 2) * bag); p.setZ(i, p.getZ(i) * (0.25 + 0.75 * Math.sqrt(Math.max(0, bag))));
      tvars.push(zn, 0);                                                                    // läget tvärs över duken (−1..1) i uv
    }
    pg.computeVertexNormals();
    pg.setAttribute('uv', new THREE.Float32BufferAttribute(tvars, 2));
    const nd = pg.toNonIndexed(), u = nd.attributes.uv, col = [];
    const RAND = ['#d8ccb2', '#9c4a3c', '#d8ccb2', '#d8ccb2', '#3f5f6e', '#d8ccb2', '#c39a48', '#d8ccb2', '#9c4a3c'].map(h => new THREE.Color(h));
    for (let i = 0; i < u.count; i += 3) {
      const z = (u.getX(i) + u.getX(i + 1) + u.getX(i + 2)) / 3, c = RAND[Math.min(8, Math.max(0, Math.floor((z + 1) / 2 * 9)))];
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    nd.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.dispose();
    nat(nd, duk, g);
    [-1, 1].forEach(s => stang([s * 1.0, 1.0, 0], [s * 1.48, 1.18, 0], 0.012, mat('#cfc6b4', 0.9), g, 4));
    rund(0.34, 0.09, 0.26, 0.04, mat('#8a9a83', 0.95), g, -0.74, 0.8, 0, 0, 0, -0.6);   // kudde: ligger i duken (förr stack den ut under)
    return g;
  }

  // ---- placering ----
  let skiv = [];                        // upptagna cirklar på tomten [x, z, r]
  function satt(namn, mal, plats) {
    stada();
    if (!mal || namn === 'studio' || !mal.blockerad) return;
    // vid sjön och villaområdet möbleras tomten som trädgården (odlingslådor, tvättlina, gunga …)
    const sno = namn === 'vinter', skog = namn === 'skog', villa = namn === 'villa', tradgard = namn === 'tradgard' || villa || namn === 'kust';
    const { L, W, dorr, dack } = mal, hy = mal.hy || (() => 0);
    const r = slump(Math.round(L * 131 + W * 977 + dorr.x * 53 + dorr.z * 71 + (dorr.nx + 2) * 7 + (dorr.nz + 2) * 3) * 7 + namn.length * 1013);
    const brus = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233 + L * 3.1 + W) * 43758.5453; return s - Math.floor(s); };
    const kant = (x, z) => Math.hypot(Math.max(Math.abs(x) - L / 2, 0), Math.max(Math.abs(z) - W / 2, 0));
    const iDack = (x, z, m = 0) => !!dack && x > dack.x0 - m && x < dack.x1 + m && z > dack.z0 - m && z < dack.z1 + m;
    const dackAv = (x, z) => dack ? Math.hypot(Math.max(dack.x0 - x, 0, x - dack.x1), Math.max(dack.z0 - z, 0, z - dack.z1)) : 99;
    // fas: delar vid väggen knyts till husets uppbyggnad (husritare.js satsBygg, userData.husFas)
    let fas = null;
    const placera = (g, x, z, ry = 0, dy = 0) => { g.position.set(x, hy(x, z) + dy, z); g.rotation.y = ry; if (fas) g.userData.husFas = fas; grupp.add(g); return g; };
    const fram = (fx, fz) => Math.atan2(fx, fz);          // vridning så att lokala +z pekar åt (fx, fz)
    skiv = [];
    // Poly Haven-rekvisita (husritare-ph.js): samlas här och läggs i en egen grupp efter slaIhop (texturerade, laddas lat)
    const PHP = [], phPa = ph.klar(), kust = namn === 'kust';
    const phS = (m, x, z, ry = 0, o = {}) => PHP.push(Object.assign({ m, x, y: hy(x, z) + (o.dy || 0), z, ry, fas }, o));
    // stövelparet: filen har två par (rena och smutsiga) 0,6 m isär; här bara det rena paret, flyttat till origo
    const phStovlar = (x, z, ry) => phS('rubber_boots', x, z, ry, { del: 'rubber_boots_l' });
    const nf = naturKarta(hy);
    const RING = Math.max(1.6, (plats && plats.ring && plats.ring.d2 || 1.4) + 0.2);   // gången runt huset slutar vid d2

    // väggarna: p(u, ut) som i ritningens öppningar, ry vänder lokala +z ut från väggen
    const NV = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
    const vp = (sd, u, n) => sd === 'S' ? [-L / 2 + u, W / 2 + n] : sd === 'N' ? [L / 2 - u, -W / 2 - n] : sd === 'E' ? [L / 2 + n, W / 2 - u] : [-L / 2 - n, -W / 2 + u];
    const uAv = (sd, x, z) => sd === 'S' ? x + L / 2 : sd === 'N' ? L / 2 - x : sd === 'E' ? W / 2 - z : z + W / 2;
    const SIDA = (nx, nz) => nz > 0.5 ? 'S' : nz < -0.5 ? 'N' : nx > 0.5 ? 'E' : 'W';
    const dsd = SIDA(dorr.nx, dorr.nz), uD = uAv(dsd, dorr.x, dorr.z);
    const opp = (OPP[`${L}x${W}`] || []).map(([sd, u, b, uk, d]) => ({ sd, u0: u, u1: u + b, uk, d: !!d }));
    if (!opp.length) [dorr, ...(mal.sidodorrar || [])].forEach(d => { const sd = SIDA(d.nx, d.nz), u = uAv(sd, d.x, d.z); opp.push({ sd, u0: u - 0.45, u1: u + 0.45, uk: 0, d: true }); });
    const huvud = opp.find(o => o.d && o.sd === dsd && uD > o.u0 - 0.2 && uD < o.u1 + 0.2);
    const tb = (huvud ? (huvud.u1 - huvud.u0) : 0.9) / 2 + 0.4;          // trappans halva bredd (som matt())
    const VAGG = ['S', 'N', 'E', 'W'].map(sd => ({ sd, vl: sd === 'S' || sd === 'N' ? L : W, n: NV[sd], ry: fram(...NV[sd]), upp: [] }));
    const box = plats && plats.box, uBox = box ? uAv(dsd, box[0], box[1]) : null;
    const vaggFri = (w, a, b, h, vidDorr = false) => {
      if (a < 0.12 || b > w.vl - 0.12) return false;
      if (w.upp.some(([c, d]) => a < d && b > c)) return false;
      for (const o of opp) if (o.sd === w.sd && (o.d || o.uk < h + 0.05)) { const m = o.d ? (vidDorr ? 0.15 : 0.45) : 0.06; if (a < o.u1 + m && b > o.u0 - m) return false; }
      if (w.sd === dsd) {
        if (!vidDorr && a < uD + tb + 0.3 && b > uD - tb - 0.3) return false;
        if (uBox !== null && a < uBox + 0.7 && b > uBox - 0.7) return false;
      }
      for (let u = a; u <= b + 1e-6; u += 0.15) for (const ut of [0.15, 0.5]) {
        const [x, z] = vp(w.sd, u, ut);
        if (iDack(x, z, 0.15) || (mal.trappa && mal.trappa(x, z, vidDorr ? 0 : 0.15))) return false;
        if ((mal.sidodorrar || []).some(d => Math.hypot(x - d.x, z - d.z) < 1.0)) return false;
        if (!nf.fri(x, z, 0.05)) return false;
      }
      return true;
    };
    // bästa lucka på någon vägg (lägst poäng), reserveras med 0,3 m marginal
    const hittaVagg = (len, h, poang) => {
      let bast = null, bp = Infinity;
      for (const w of VAGG) for (let a = 0.15; a + len <= w.vl - 0.15; a += 0.1) {
        const uc = a + len / 2, [x, z] = vp(w.sd, uc, 0.3), p = poang(w, uc, x, z) + brus(x, z) * 0.6;
        if (p < bp && vaggFri(w, a, a + len, h)) { bp = p; bast = { w, uc, a, x, z }; }
      }
      if (bast) bast.w.upp.push([bast.a - 0.3, bast.a + len + 0.3]);
      return bast;
    };
    const vid = (s, ut) => vp(s.w.sd, s.uc, ut);

    // tomten: fri från gångar, bilplats, altan, natur och övriga föremål
    const tomtFri = (x, z, rr) => {
      if (mal.blockerad(x, z, rr + 0.15) || dackAv(x, z) < rr + 0.25 || !nf.fri(x, z, rr + 0.15)) return false;
      for (let k = 0; k < 8; k++) { const a = k * 0.785, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; if (mal.blockerad(px, pz, 0.15) || kant(px, pz) < RING) return false; }
      return skiv.every(([sx, sz, sr]) => (sx - x) ** 2 + (sz - z) ** 2 > (sr + rr + 0.35) ** 2);
    };
    const hittaTomt = (rr, poang, min = 1.7, max = 9, extra) => {
      let bast = null, bp = Infinity;
      for (let x = -L / 2 - max; x <= L / 2 + max; x += 0.25) for (let z = -W / 2 - max; z <= W / 2 + max; z += 0.25) {
        const k = kant(x, z); if (k < Math.max(min, RING) + rr || k > max) continue;
        const p = poang(x, z, k) + brus(x, z) * 0.8; if (p >= bp) continue;
        if (!tomtFri(x, z, rr) || (extra && !extra(x, z))) continue;
        bp = p; bast = [x, z];
      }
      if (bast) skiv.push([bast[0], bast[1], rr]);
      return bast;
    };
    const boka = (x, z, rr) => skiv.push([x, z, rr]);
    const n = [dorr.nx, dorr.nz], t = [-dorr.nz, dorr.nx];
    const lang = (x, z) => (x - dorr.x) * n[0] + (z - dorr.z) * n[1];       // ut från dörrens vägg
    const sid = (x, z) => (x - dorr.x) * t[0] + (z - dorr.z) * t[1];         // i sidled längs dörrens vägg
    const bilSida = plats ? Math.sign(((plats.cx - dorr.x) * t[0] + (plats.cz - dorr.z) * t[1])) || 1 : 1;
    const narmsteVagg = (x, z) => { const dx = Math.abs(x) - L / 2, dz = Math.abs(z) - W / 2; return dx > dz ? [Math.sign(x), 0] : [0, Math.sign(z)]; };

    // 1. vid entrén: krukor, vattenkanna och lykta på var sin sida om trappan (vinter: skyffel och lykta)
    const dw = VAGG.find(w => w.sd === dsd);
    fas = 'ute';   // (kommer upp med trappan)
    [-bilSida, bilSida].forEach((s, i) => {
      const lat = s * (tb + 0.36), uu = uAv(dsd, dorr.x + t[0] * lat, dorr.z + t[1] * lat), a = uu - 0.28, b = uu + 0.28;
      if (!vaggFri(dw, a, b, -1, true)) return;   // krukor får stå framför fönster, inte dörrar
      dw.upp.push([a - 0.1, b + 0.1]);
      const [x, z] = vp(dsd, uu, 0.3), ld = uu > uD ? 1 : -1;                // ld: längs väggen bort från dörren
      const [lx, lz] = vp(dsd, uu + ld * 0.25, 0.22);
      if (i === 0) {
        if (sno) placera(snoskyffel(), x, z, dw.ry + 0.12);
        else {
          placera(kruka(0.24, 0.34, '#a9694b', 'blommor', r), x, z);   // blommande pelargon i lerkruka (buxbomsklotet såg ut som en grön klump)
          placera(kruka(0.15, 0.28, '#a9694b', skog ? 'ormbunke' : 'blommor', r), lx, lz);
          if (!skog && phPa) phS('watering_can_metal_01', ...vp(dsd, uu + ld * 0.52, 0.28), dw.ry + ld * 0.45, { s: 1.5 });   // (Poly Haven: pipen mot lokala +z)
          else if (!skog) placera(vattenkanna(), ...vp(dsd, uu + ld * 0.52, 0.24), dw.ry - Math.PI / 2 + ld * 0.45);   // pipen ut från väggen, inte in i den
        }
      } else {
        if (phPa) phS('wooden_lantern_01', ...vp(dsd, uu - ld * 0.15, 0.25), dw.ry + 0.3);   // trälyktan med varmt sken på kvällen
        else placera(lykta(sno), ...vp(dsd, uu - ld * 0.15, 0.25));
        if (!sno) placera(kruka(0.17, 0.5, '#3a3b3c', 'gras', r), ...vp(dsd, uu + ld * 0.12, 0.3));
        const us = uu + ld * 0.6;
        // (vid sjön står Poly Havens stövlar vid sjöboden i stället, husritare-sjo.js)
        if (!sno && vaggFri(dw, us - 0.17, us + 0.17, -1, true)) { dw.upp.push([us - 0.2, us + 0.2]); const ryS = dw.ry + (r() - 0.5) * 0.5; if (!phPa) placera(stovlar(r), ...vp(dsd, us, 0.24), ryS); else if (!kust) phStovlar(...vp(dsd, us, 0.22), ryS); }
      }
    });
    fas = null;

    // Gången runt huset (plats.ring: d1–d2 m från väggen) ska vara fri: djupa saker står fristående
    // på gräset strax utanför den, med baksidan mot huset. hittaFri ger mitten, väggens normal och läget
    // för gruppens origo (bakkanten).
    const hittaFri = (len, djup, poang, max = 7) => {
      const rr = djup / 2 + 0.08, halv = Math.max(0, len / 2 - rr);
      const p = hittaTomt(rr, poang, RING + 0.05, max, (x, z) => {
        const [a, b] = narmsteVagg(x, z);
        return [-1, 1].every(s => tomtFri(x + b * s * halv, z - a * s * halv, rr) && kant(x + b * s * halv, z - a * s * halv) > RING + rr);
      });
      if (!p) return null;
      const [a, b] = narmsteVagg(p[0], p[1]);
      [-1, 1].forEach(s => boka(p[0] + b * s * halv, p[1] - a * s * halv, rr));
      return { x: p[0], z: p[1], a, b, ox: p[0] - a * djup / 2, oz: p[1] - b * djup / 2, ry: fram(a, b) };
    };
    const vaggLangd = (a, b) => a ? W : L;

    // 2. sopkärlen fristående nära bilplatsen, inte mitt framför entrén
    // helst vid bilplatsens yttre ände, på sidan bort från entrén (där sopbilen hämtar), inte framför dörren
    const vg = plats && plats.vag;
    const bilP = vg ? [vg.x0 + plats.t[0] * vg.sida * 2.7 - plats.n[0] * 0.9, vg.z0 + plats.t[1] * vg.sida * 2.7 - plats.n[1] * 0.9] : [dorr.x + n[0] * 4, dorr.z + n[1] * 4];
    const sk = hittaFri(1.55, 0.85, (x, z) => Math.hypot(x - bilP[0], z - bilP[1]) * 0.5 + (Math.hypot(x - dorr.x, z - dorr.z) < 3.6 ? 4 : 0) + kant(x, z) * 0.2, 8);
    if (sk) placera(sopkarl(sno), sk.ox, sk.oz, sk.ry);

    // 3. cykeln i ett cykelställ några meter från dörren (inte på vintern)
    if (!sno) {
      const cy = hittaFri(1.9, 0.6, (x, z) => Math.abs(Math.hypot(x - dorr.x, z - dorr.z) - 3.4) * 0.5 + kant(x, z) * 0.6 + (lang(x, z) > 0 ? 0 : 2.5));
      if (cy) placera(cykel(), cy.ox, cy.oz, cy.ry);
    }

    // 4. vedtraven fristående vid en gavel (kortsidan), helst inte på dörrens sida
    let ved = null;
    const gavel = (a, b) => vaggLangd(a, b) === Math.min(L, W);
    // inte mitt framför ett golvlångt fönster eller en dörr (traven skymde sovrummets utsikt)
    // (också snett utanför ett hörn: utsikten från ett glasparti vidgas utåt som en kon)
    const framforFonster = (x, z, len) => opp.some(o => {
      if (o.uk >= 0.9) return false;
      const um = (o.u0 + o.u1) / 2, [px, pz] = vp(o.sd, um, 0), [qx, qz] = vp(o.sd, um + 1, 0), [nx, nz] = NV[o.sd];
      const ut = (x - px) * nx + (z - pz) * nz, sid = Math.abs((x - px) * (qx - px) + (z - pz) * (qz - pz));
      return ut > 0 && ut < 7 && sid < (o.u1 - o.u0) / 2 + len / 2 + 0.2 + ut * 0.45;
    });
    // först bara platser utanför fönstrens utsikt, annars som förut (med straff)
    for (const fri of [true, false]) {
      for (const len of [1.8, 1.4, 1.0]) {
        ved = hittaFri(len + 0.2, 0.8, (x, z) => {
          const [a, b] = narmsteVagg(x, z), ff = framforFonster(x, z, len);
          if (ff && fri) return Infinity;
          return (gavel(a, b) ? 0 : 2.5) + (a === n[0] && b === n[1] ? 3 : 0) + (ff ? 2.2 : 0) + kant(x, z) * 0.6;
        });
        if (ved) { placera(vedtrave(len, sno, r), ved.ox, ved.oz, ved.ry); break; }
      }
      if (ved) break;
    }

    // 5. slangvindan på väggen (inte vinter), helst nära altanen eller odlingen
    if (!sno) {
      const dc = dack ? [(dack.x0 + dack.x1) / 2, (dack.z0 + dack.z1) / 2] : [-dorr.x, -dorr.z];
      const sv = hittaVagg(0.6, 0.85, (w, uc, x, z) => Math.hypot(x - dc[0], z - dc[1]) * 0.3 + (w.sd === dsd ? 2 : 0));
      if (sv) { fas = 'vagg'; placera(slangvinda(), ...vid(sv, 0), sv.w.ry); fas = null; }   // (sitter på väggen)
    }

    // 6. brevlådan vid uppfartens yttre del, på sidan bort från huset
    if (plats && plats.vag) {
      const v = plats.vag, pn = plats.n, pt = plats.t;
      let ok = false;
      // villaområdet: vid gatan (uppfarten slutar vid trottoaren, plats.vagL), i rad med grannarnas lådor
      for (const sv of villa && plats.vagL ? [plats.vagL - 0.55, plats.vagL - 1.1] : [10, 9, 11, 8, 12, 7]) {
        for (const sd of [v.sida, -v.sida]) {
          const lat = vagBoj(sv) * v.sida + sd * (VAG.B / 2 + VAG.kant + 0.45), x = v.x0 + pn[0] * sv + pt[0] * lat, z = v.z0 + pn[1] * sv + pt[1] * lat;
          if (!nf.fri(x, z, 0.3) || (mal.pollare || []).some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.2)) continue;
          placera(brevlada(sno), x, z, fram(-pt[0] * sd, -pt[1] * sd)); boka(x, z, 0.4); ok = true;
          if (villa) for (const k of [1, 2]) {
            const x2 = x - pn[0] * 0.34 * k, z2 = z - pn[1] * 0.34 * k;   // sida vid sida (lådorna vetter mot uppfarten)
            placera(brevlada(sno), x2, z2, fram(-pt[0] * sd, -pt[1] * sd)); boka(x2, z2, 0.3);
          }
          break;
        }
        if (ok) break;
      }
    }

    // 7. grillen bredvid altanen
    if (dack) {
      const g = hittaTomt(0.42, (x, z) => Math.abs(dackAv(x, z) - 0.75) * 2 + kant(x, z) * 0.15, 1.9, 7.5);
      if (g) placera(grill(sno), g[0], g[1], r() * 6.28);
    }

    // 8. odlingslådorna på solsidan (söder), inte i skogen
    let odl = null;   // (läget för Poly Havens spade, kanna och handskar, steg 12)
    if (tradgard || sno) {
      const o = hittaTomt(0.95, (x, z, k) => -z * 0.25 + Math.abs(k - 3.2) * 0.6 + (lang(x, z) > 0 && Math.abs(sid(x, z)) < 4 ? 3 : 0), 2.0, 7);
      if (o) { const [a, b] = narmsteVagg(o[0], o[1]), ry = fram(a, b) + (r() - 0.5) * 0.1, og = placera(odlingslador(tradgard, sno, r), o[0], o[1], ry); odl = { x: o[0], z: o[1], ry };
        const c = Math.cos(ry), s = Math.sin(ry);   // Poly Havens odlingslådor (lokala poster → tomtens läge)
        (og.userData.ph || []).forEach(p => PHP.push(Object.assign({}, p, { x: o[0] + p.x * c + p.z * s, y: og.position.y + p.y, z: o[1] - p.x * s + p.z * c, ry: ry + p.ry }))); }
      if (o && tradgard) {
        const sk2 = hittaTomt(0.9, (x, z) => Math.abs(Math.hypot(x - o[0], z - o[1]) - 2.0), 1.8, 9);
        if (sk2) placera(skottkarra('jord', false, r), sk2[0], sk2[1], Math.atan2(o[1] - sk2[1], sk2[0] - o[0]) + (r() - 0.5) * 0.6);
      }
    }

    // 9. trädgården: tvättlina på baksidan, gunga och en fotboll
    if (tradgard) {
      // inte intill altanen och grillen (tvätten hängde i grillröken) och inte rakt utanför en dörr
      const framforDorr = (x, z) => opp.some(o => {
        if (!o.d) return false;
        const [px, pz] = vp(o.sd, (o.u0 + o.u1) / 2, 0), [nx, nz] = NV[o.sd], bx = x - px, bz = z - pz, l = bx * nx + bz * nz;
        return l > 0 && l < 6.5 && Math.abs(-bx * nz + bz * nx) < 2.7;
      });
      const narDorr = (x, z) => opp.some(o => {
        if (!o.d) return false;
        const [px, pz] = vp(o.sd, (o.u0 + o.u1) / 2, 0), [nx, nz] = NV[o.sd], bx = x - px, bz = z - pz, l = bx * nx + bz * nz;
        return l > 0 && l < 6.5 && Math.abs(-bx * nz + bz * nx) < 3.6;   // linan är 3,2 m bred: hela ska gå fri från dörrens gång
      });
      const tv = hittaTomt(0.45, (x, z, k) => (lang(x, z) > -1 ? 3 : 0) + Math.abs(k - 3.2) * 0.5 + (dackAv(x, z) < 3.4 ? 2.5 : 0) + (framforDorr(x, z) ? 4 : 0) + (framforFonster(x, z, 3.2) ? 1.5 : 0) + (ved && Math.hypot(x - ved.x, z - ved.z) < 4.2 ? 1.5 : 0)
        + (x * z > 0 && Math.abs(x) > L / 2 && Math.abs(z) > W / 2 ? 1.2 : 0), 2.0, 7, (x, z) => !narDorr(x, z) && [-1, -0.5, 0.5, 1].every(s => tomtFri(x + t[0] * s * 1.6, z + t[1] * s * 1.6, 0.35)));   // aldrig rakt utanför en dörr: hellre ingen lina alls
      if (tv) { [-1, 1].forEach(s => boka(tv[0] + t[0] * s * 1.6, tv[1] + t[1] * s * 1.6, 0.6)); placera(tvattlina(r), tv[0], tv[1], fram(n[0], n[1])); }
      // helst snett utanför ett hörn (inte mitt framför en vägg, där vyerna Söder/Öster/Norr/Väster tittar in)
      // och inte i hörnen mot kamerorna Runt om (sydost) och Baksida (nordväst): ställningen stod i förgrunden
      const gu = hittaTomt(1.35, (x, z, k) => Math.abs(k - 5) * 0.4 + (lang(x, z) > 0 ? 2 : 0) + Math.abs(sid(x, z) + bilSida * 6) * 0.15
        + (Math.abs(x) < L / 2 || Math.abs(z) < W / 2 ? 1 : 0) + (x * z > 0 ? 1.4 : 0), 3, 9.5);
      if (gu) { const [a, b] = narmsteVagg(gu[0], gu[1]); placera(gunga(), gu[0], gu[1], fram(a, b)); }
      const fb = hittaTomt(0.15, (x, z, k) => Math.abs(k - 3.5) * 0.3 + (gu ? Math.abs(Math.hypot(x - gu[0], z - gu[1]) - 2.6) : 0) + (lang(x, z) > 0 ? 0 : 0.5), 2, 9);
      if (fb) placera(fotboll(), fb[0], fb[1]);
    }

    // 10. skogen: yxkubbe vid veden, en bänk och en hängmatta
    let kubbe = null;
    // Poly Havens yxa med eggen i kubbens ovansida (0,44 m), skaftet snett uppåt (modellens egg ligger mot +z, huvudet upptill)
    const phYxa = (x, z, ry) => phS('wooden_axe', x + Math.sin(ry) * 0.05, z + Math.cos(ry) * 0.05, ry, { rx: Math.PI / 2 + 0.6, golv: false, dy: 0.44 + 0.345 - 0.06 });
    if (skog || sno) {
      if (skog && ved) {
        const vx = ved.x + ved.a * 1.3, vz = ved.z + ved.b * 1.3;
        let p = tomtFri(vx, vz, 0.5) ? [vx, vz] : null;
        if (p) boka(p[0], p[1], 0.5); else p = hittaTomt(0.5, (x, z) => Math.hypot(x - vx, z - vz), 1.8, 6);
        if (p) { const kg = yxkubbe(r, phPa), ryK = r() * 6.28; placera(kg, p[0], p[1], ryK); if (phPa) phYxa(p[0], p[1], ryK); kubbe = p; }
        const sk2 = hittaTomt(0.95, (x, z) => Math.abs(Math.hypot(x - ved.x, z - ved.z) - 2.4), 1.8, 9);   // på avstånd, på tvären: handtagen når inte in i traven
        if (sk2) placera(skottkarra('ved', false, r), sk2[0], sk2[1], Math.atan2(ved.z - sk2[1], sk2[0] - ved.x) + Math.PI / 2 + (r() - 0.5) * 0.3);
      }
      const bk = hittaTomt(0.85, (x, z, k) => Math.abs(k - 3) * 0.5 + (lang(x, z) > 2 ? 0 : 1) + Math.abs(sid(x, z) + bilSida * 4) * 0.2, 2.2, 7);
      if (bk) { const [a, b] = narmsteVagg(bk[0], bk[1]); placera(bank(sno), bk[0], bk[1], fram(a, b)); }
      if (skog) {
        const hm = hittaTomt(1.0, (x, z, k) => (lang(x, z) > -1 ? 2 : 0) + Math.abs(k - 4) * 0.5, 2.6, 9, (x, z) => [-1, 1].every(s => { const [a, b] = narmsteVagg(x, z); return tomtFri(x - b * s * 1.3, z + a * s * 1.3, 0.35); }));
        if (hm) { const [a, b] = narmsteVagg(hm[0], hm[1]); placera(hangmatta(), hm[0], hm[1], fram(a, b)); }
      }
    }

    // 11. vintern: snögubbe och pulka på framsidan, bort från bilen
    if (sno) {
      const sg = hittaTomt(0.5, (x, z, k) => Math.abs(lang(x, z) - 4.5) * 0.5 + Math.abs(sid(x, z) + bilSida * 4) * 0.3, 2.5, 9);
      if (sg) placera(snogubbe(), sg[0], sg[1], fram(n[0], n[1]) + (r() - 0.5) * 0.6, -0.04);
      const pk = hittaTomt(0.75, (x, z) => sg ? Math.abs(Math.hypot(x - sg[0], z - sg[1]) - 1.7) : 0, 2, 9);
      if (pk) placera(pulka(), pk[0], pk[1], r() * 6.28, -0.03);
      const sp = hittaTomt(0.8, (x, z) => Math.abs(Math.hypot(x - dorr.x, z - dorr.z) - 2.6) + (lang(x, z) > 0 ? 0 : 2), 1.8, 7);
      if (sp) placera(spark(), sp[0], sp[1], Math.atan2(-t[1], t[0]) * 1 + (r() - 0.5) * 0.5, -0.02);
    }

    // 12. Poly Haven-rekvisita (husritare-ph.js) som inte ersätter något: drar inga slumptal (resten behåller sin
    // slumpföljd) och placeras sist, så att inget annat flyttar sig. Allt provas mot tomtens fria ytor.
    if (phPa) {
      // lit: liten fri plats; ign = mitten på den egna reservationen (odlingslådorna, kubben) som får överlappas
      const lit = (x, z, rr, ign) => !mal.blockerad(x, z, rr + 0.1) && nf.fri(x, z, rr + 0.05) && dackAv(x, z) > rr + 0.2 && kant(x, z) > RING
        && skiv.every(([sx, sz, sr]) => (ign && Math.hypot(sx - ign[0], sz - ign[1]) < 0.01) || (sx - x) ** 2 + (sz - z) ** 2 > (sr + rr + 0.15) ** 2);
      const ut = (a, b) => fram(a, b);   // lokala +z ut från närmaste vägg
      // trädgård, villa och sjötomt: spade i jorden, vattenkanna och handskar vid odlingslådorna, målad bänk, gungstol vid altanen
      if (tradgard && odl) {
        const c = Math.cos(odl.ry), s = Math.sin(odl.ry), W2 = (lx, lz) => [odl.x + lx * c + lz * s, odl.z - lx * s + lz * c];
        // spaden står nedstucken i gräset vid lådornas kortände (bladet 2 dm ner), lite lutad
        let spade = [1e3, 1e3];
        for (const [lx, lz] of [[1.0, 0.15], [-1.0, 0.15], [1.0, -0.3]]) {
          const [x, z] = W2(lx, lz); if (!mal.blockerad(x, z, 0.2) && nf.fri(x, z, 0.1) && dackAv(x, z) > 0.4 && kant(x, z) > RING) { phS('rusted_spade_01', x, z, odl.ry + 1.3, { rz: 0.12, golv: false, dy: 0.503 - 0.2 }); spade = [x, z]; break; }
        }
        for (const [lx, lz] of [[-1.05, -0.4], [-1.05, 0.6], [0.1, -1.2], [0.1, 1.2]]) {
          const [x, z] = W2(lx, lz); if (Math.hypot(x - spade[0], z - spade[1]) > 0.8 && lit(x, z, 0.25, [odl.x, odl.z])) { phS('watering_can_metal_01', x, z, odl.ry + 2.2, { s: 1.5 }); boka(x, z, 0.25); break; }
        }
      }
      if (tradgard) {
        // målad träbänk mot huset en bit ut på gräset, med ett par trädgårdshandskar på sitsen
        const bk = hittaTomt(0.7, (x, z, k) => Math.abs(k - 2.6) * 0.5 + (ved && Math.hypot(x - ved.x, z - ved.z) < 3.5 ? 3 : 0) + (odl ? Math.abs(Math.hypot(x - odl.x, z - odl.z) - 2.4) * 0.6 : 0) + (lang(x, z) > 1 ? 1.5 : 0) + (framforFonster(x, z, 1.2) ? 1 : 0), 2.0, 7);
        if (bk) {
          const [a, b] = narmsteVagg(bk[0], bk[1]), ry = ut(a, b);
          phS('painted_wooden_bench', bk[0], bk[1], ry);
          phS('garden_gloves_01', bk[0] + Math.cos(ry) * 0.25, bk[1] - Math.sin(ry) * 0.25, ry + 0.5, { dy: 0.735 });
        }
        // gungstolen på gräset tätt intill altanen, vänd ut mot trädgården
        if (dack) {
          const gs = hittaTomt(0.55, (x, z) => Math.abs(dackAv(x, z) - 0.45) * 2 + kant(x, z) * 0.1, 1.9, 7.5);
          if (gs) { const [a, b] = narmsteVagg(gs[0], gs[1]); phS('Rockingchair_01', gs[0], gs[1], ut(a, b) + 0.35); }
        }
        // sjötomten: picknickbord på gräset (långsidan mot huset)
        if (kust) {
          const pb = hittaTomt(1.65, (x, z, k) => Math.abs(k - 5) * 0.4 + (lang(x, z) > 0 && Math.abs(sid(x, z)) < 4 ? 3 : 0) + (dack ? Math.abs(dackAv(x, z) - 4) * 0.2 : 0), 3.2, 7.5);
          if (pb) { const [a, b] = narmsteVagg(pb[0], pb[1]); phS('wooden_picnic_table', pb[0], pb[1], ut(a, b) + Math.PI / 2); }
        }
      }
      // skog och vinter: yxkubbe vid traven (vintern hade ingen), pall och hink vid kubben
      if ((skog || sno) && ved) {
        if (sno && !kubbe) {
          const vx = ved.x + ved.a * 1.3, vz = ved.z + ved.b * 1.3;
          const p = hittaTomt(0.5, (x, z) => Math.hypot(x - vx, z - vz), 1.8, 6);
          if (p) { const ryK = brus(p[0], p[1]) * 6.28; placera(yxkubbe(slump(Math.round(p[0] * 977 + p[1] * 131)), true), p[0], p[1], ryK); phYxa(p[0], p[1], ryK); kubbe = p; }
        }
        if (kubbe) {
          for (let k = 0; k < 8; k++) {
            const a = k * 0.785 + 0.4, x = kubbe[0] + Math.cos(a) * 1.2, z = kubbe[1] + Math.sin(a) * 1.2;
            if (lit(x, z, 0.3, kubbe)) { phS('folding_wooden_stool', x, z, a + 1.1); boka(x, z, 0.3); break; }
          }
          for (let k = 0; k < 8; k++) {
            const a = k * 0.785 + 2.2, x = kubbe[0] + Math.cos(a) * 1.05, z = kubbe[1] + Math.sin(a) * 1.05;
            if (lit(x, z, 0.22, kubbe)) { phS('wooden_bucket_01', x, z, a); boka(x, z, 0.22); break; }
          }
        }
      }
    }

    grupp.updateMatrixWorld(true);
    // blommande pelargon (stora krukan) och margerit (lilla) i krukorna: ett nät (husritare-blommor.js)
    const BLP = [], vv = new THREE.Vector3();
    grupp.children.forEach(o => { const b = o.userData.blom; if (!b) return; o.updateMatrix(); vv.set(0, b.y - 0.02, 0).applyMatrix4(o.matrix); const stor = b.rr > 0.2;   // (i gruppens rum)
      BLP.push({ art: stor ? 'pelargon' : 'margerit', x: vv.x, y: vv.y, z: vv.z, s: b.rr * (stor ? 4.6 : 5.2), ry: r() * 6.28, f: [[1.0, 0.18, 0.16], [1.0, 0.32, 0.45]][r() * 2 | 0], viktig: true }); });
    slaIhop();
    grupp.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    grupp.updateMatrixWorld(true);
    // Poly Haven-sakerna vid väggen i en egen grupp (följer husets uppbyggnad), resten för sig
    const PHv = PHP.filter(p => p.fas), PHo = PHP.filter(p => !p.fas);
    if (PHo.length) grupp.add(ph.grupp(PHo, 'ph-bebott'));
    if (PHv.length) { const g = ph.grupp(PHv, 'ph-bebott-vagg'); if (g) { g.userData.husFas = 'ute'; grupp.add(g); } }
    if (BLP.length) { const m = blommor.grupp(BLP, 'blommor-krukor'); if (m) { m.userData.husFas = 'ute'; grupp.add(m); } }   // (blommorna står i krukorna vid entrén)
    try { if (/[?&]prov=1/.test(location.search)) window.__krukor = BLP.map(p => [p.x, p.y, p.z, dorr.nx, dorr.nz]); } catch (e) { /* */ }
  }

  // Alla enkla nät med samma material (och skuggflagga) bakas till ett nät i gruppens rum:
  // ~150 små ritanrop blir 35–70. Instansade nät och nät med flera material står kvar som de är.
  const KARTOR = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'bumpMap', 'lightMap', 'envMap', 'displacementMap'];
  const enkel = m => m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.transparent && m.opacity === 1 && m.alphaTest === 0 && !m.flatShading && !m.wireframe
    && m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && KARTOR.every(t => !m[t]) && m.emissiveIntensity === 1;
  const hornMat = m => {
    const k = 'horn|' + m.roughness.toFixed(2) + '|' + m.metalness.toFixed(2) + '|' + m.emissive.getHexString() + '|' + m.side + '|' + m.envMapIntensity;
    return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, emissive: m.emissive.clone(), side: m.side, envMapIntensity: m.envMapIntensity }));
  };
  function slaIhop() {
    const inv = new THREE.Matrix4().copy(grupp.matrixWorld).invert(), M = new THREE.Matrix4(), N3 = new THREE.Matrix3();
    const hinkar = new Map(), kvar = [];
    grupp.traverse(o => {
      if (!o.isMesh) return;
      M.multiplyMatrices(inv, o.matrixWorld);
      if (o.isInstancedMesh || Array.isArray(o.material)) { for (let a = o; a && a !== grupp; a = a.parent) if (a.userData.husFas) { o.userData.husFas = a.userData.husFas; break; } kvar.push([o, M.clone()]); return; }
      // enkla material (bara färg, råhet, metall, glöd) delas efter råhet och metall: färgen bakas in som
      // hörnfärg, så att ~50 ritanrop blir ~10 (team-prestanda)
      const om = o.material, en = enkel(om), m = en ? hornMat(om) : om;
      let fas = null; for (let a = o; a && a !== grupp; a = a.parent) if (a.userData.husFas) { fas = a.userData.husFas; break; }
      const k = (en ? m.uuid : om.uuid) + (o.castShadow ? '+' : '-') + (fas || '');
      if (!hinkar.has(k)) hinkar.set(k, { m, kast: o.castShadow, fas, pos: [], nor: [], col: [] });
      const h = hinkar.get(k), g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, fc = en ? om.color : null;
      const P = g.attributes.position, Nn = g.attributes.normal, Cc = g.attributes.color, v = new THREE.Vector3();
      N3.getNormalMatrix(M);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(M); h.pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(Nn, i).applyMatrix3(N3).normalize(); h.nor.push(v.x, v.y, v.z);
        if (h.m.vertexColors) {
          const cr = Cc && om.vertexColors ? Cc.getX(i) : 1, cg = Cc && om.vertexColors ? Cc.getY(i) : 1, cb = Cc && om.vertexColors ? Cc.getZ(i) : 1;
          if (fc) h.col.push(cr * fc.r, cg * fc.g, cb * fc.b); else h.col.push(cr, cg, cb);
        }
      }
      if (g !== o.geometry) g.dispose();
      if (o.userData.egen) o.geometry.dispose();
    });
    grupp.clear();
    hinkar.forEach(h => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(h.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(h.nor, 3));
      if (h.m.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(h.col, 3));
      g.computeBoundingSphere();
      const o = new THREE.Mesh(g, h.m); o.userData.egen = true; o.castShadow = h.kast; o.receiveShadow = true; if (h.fas) o.userData.husFas = h.fas; grupp.add(o);
    });
    kvar.forEach(([o, m]) => { m.decompose(o.position, o.quaternion, o.scale); grupp.add(o); });
  }

  // Naturens stammar, buskar, stenar och drivor nära huset som ett rutnät (0,5 m), läst ur miljöns nät
  function naturKarta(hy) {
    const N = 96, S = 0.5, H = N * S / 2, ruta = new Uint8Array(N * N);
    const mark = (x, z, rr) => {
      const i0 = Math.floor((x - rr + H) / S), i1 = Math.floor((x + rr + H) / S), j0 = Math.floor((z - rr + H) / S), j1 = Math.floor((z + rr + H) / S);
      for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) ruta[i * N + j] = 1;
    };
    const M4 = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), Sk = new THREE.Vector3();
    rot.traverse(o => {
      if (!o.isMesh || o === grupp) return;
      const nm = o.name || '';
      if (o.isInstancedMesh) {
        const trad = !!o.geometry.attributes.aKol;
        if (!trad && !/^sten|^driv/.test(nm)) return;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M4); M4.decompose(P, Q, Sk);
          if (Math.abs(P.x) < H && Math.abs(P.z) < H) mark(P.x, P.z, Math.max(Sk.x, Sk.z) * (trad ? 0.2 : 0.6));
        }
      } else if (/^(bark|lov)(-fjarr)?$|^rabatt-jord|^blommor-/.test(nm)) {   // (även rabatterna och blommorna, husritare-blommor.js)
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          if (Math.abs(x) < H && Math.abs(z) < H && p.getY(i) - hy(x, z) < 3.2) ruta[Math.floor((x + H) / S) * N + Math.floor((z + H) / S)] = 1;
        }
      }
    });
    const fri = (x, z, rr) => {
      const i0 = Math.floor((x - rr + H) / S), i1 = Math.floor((x + rr + H) / S), j0 = Math.floor((z - rr + H) / S), j1 = Math.floor((z + rr + H) / S);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (i >= 0 && j >= 0 && i < N && j < N && ruta[i * N + j]) return false;
      return true;
    };
    return { fri };
  }

  function stada() {
    grupp.traverse(o => { if (o.userData.egen && o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    grupp.clear();
  }
  function dispose() {
    stada(); rot.remove(grupp);
    Object.values(MAT).forEach(m => m.dispose()); if (glasMat) glasMat.dispose();
  }
  return { satt, dispose };
}

// ---- uteplatsens sittgrupp (villaområdets grannar): bord, fyra karmstolar med dynor och parasoll ----
// Teak, gråbetsat eller målat trä (ekfaner i images/tex/lucka-ek, tonat per stil), dynor och parasolldukar i
// bomullsväv (images/tex/tyg-bomull), parasollens stång, ekrar och spröt i lackad metall. Alla grupper i miljön
// slås ihop till tre nät (trä, tyg, metall): tre ritanrop. Lokala +x längs bordet, stolarna på ±z.
// Måtten (m): bord 1,6 × 0,9 × 0,74; sitthöjd 0,44; stolarnas framkant 0,12 m från bordsskivans kant, så att
// stolarna aldrig går in i bordet (räknas i uteKoll: varje stols rektangel i planet mot bordets och mot grannstolen).
export const UTE_STIL = {
  tra: [[0.98, 0.7, 0.5], [0.95, 0.98, 1.02], [0.2, 0.2, 0.21], [1.55, 1.6, 1.62]],     // teak, gråbetsad, svartmålad, vitmålad (gånger ekens ljusbruna ton)
  dyna: [[1.12, 1.18, 1.15], [0.68, 0.86, 0.74], [0.3, 0.42, 0.66], [0.98, 0.62, 0.5]],      // linne, salvia, marinblå, terrakotta (gånger vävens beigerosa ton)
  duk: [[1.2, 1.26, 1.26], [0.4, 0.6, 0.5], [1.05, 1.08, 1.0], [0.32, 0.43, 0.68]],     // ecru, skogsgrön, sand, marin
};
export const uteKoll = { grupper: 0, krockar: 0 };
export function uteGrupper(THREE, poster, { VU, LJUS, ANISO = 4 } = {}) {
  const g = new THREE.Group(); g.name = 'uteplatser';
  if (!poster.length) return g;
  const D = { tra: { P: [], N: [], U: [], C: [], I: [] }, tyg: { P: [], N: [], U: [], C: [], I: [] }, met: { P: [], N: [], U: [], C: [], I: [] } };
  const M3 = new THREE.Matrix3(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
  // lägg en geometri i D[mat] med matrisen m och färgen f; uv skalas med uvS
  const lagg = (mat, geo, m, f, uvS = 1) => {
    const A = D[mat], bas = A.P.length / 3, p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    M3.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      V.fromBufferAttribute(p, i).applyMatrix4(m); A.P.push(V.x, V.y, V.z);
      V.fromBufferAttribute(n, i).applyMatrix3(M3).normalize(); A.N.push(V.x, V.y, V.z);
      A.U.push(u ? u.getX(i) * uvS : 0, u ? u.getY(i) * uvS : 0); A.C.push(f[0], f[1], f[2]);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) A.I.push(geo.index.getX(i) + bas); else for (let i = 0; i < p.count; i++) A.I.push(i + bas);
  };
  // låda med träets fiber längs det längsta måttet (uv i meter / 0,8; ekfaneret har fibern längs v)
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const lada = (mat, Mb, c, h, f, rot = null) => {
    const geo = BOX.clone(), uv = geo.attributes.uv, n = geo.attributes.normal, s = [h[0] * 2, h[1] * 2, h[2] * 2], fas = Math.abs(c[0] * 3.1 + c[2] * 1.7 + c[1] * 2.3) % 1;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)) > 0.5 ? 0 : Math.abs(n.getY(i)) > 0.5 ? 1 : 2, a = [0, 1, 2].filter(k => k !== ax), lang = s[a[0]] >= s[a[1]] ? 0 : 1;
      const p0 = uv.getX(i) * s[a[0]] / 0.8, p1 = uv.getY(i) * s[a[1]] / 0.8;
      if (lang === 0) uv.setXY(i, p1 + fas * 0.37, p0 + fas); else uv.setXY(i, p0 + fas * 0.37, p1 + fas);   // fibern (texturens v) längs brädan
    }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), rot ? Q.setFromEuler(E.set(...rot)) : Q.identity(), new THREE.Vector3(...s));
    lagg(mat, geo, m.premultiply(Mb), f); geo.dispose();
  };
  const dynaGeo = {};
  const dyna = (Mb, c, h, f, rot = null, fin = false) => {   // fin: rundare kanter (300 trianglar, annars 108)
    const k = h.map(v => v.toFixed(3)).join() + fin, geo = dynaGeo[k] || (dynaGeo[k] = new RoundedBoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2, fin ? 2 : 1, Math.min(h[1] * 0.9, 0.035)));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), rot ? Q.setFromEuler(E.set(...rot)) : Q.identity(), S1);
    lagg('tyg', geo, m.premultiply(Mb), f, 1.6);
  };
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  const ror = (Mb, a, b, rad, f) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
    const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(rad, l, rad));
    lagg('met', CYL, m.premultiply(Mb), f);
  };
  const BORD = { hx: 0.8, hz: 0.45, h: 0.74 }, STOL = { hx: 0.29, hz: 0.27, sits: 0.44, z: 0.45 + 0.12 + 0.27 }, STOLX = [-0.42, 0.42];
  for (const p of poster) {
    const Mb = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), Q.setFromEuler(E.set(0, p.ry, 0)), S1);
    const T = UTE_STIL.tra[p.stil | 0], TM = T.map(v => v * 0.82), DY = UTE_STIL.dyna[p.dyna | 0], DU = UTE_STIL.duk[p.duk | 0];
    // bordet: sju skivbrädor med springor, sarg och ben
    const nS = 7, sp = 0.012, bw = (BORD.hz * 2 - sp * (nS - 1)) / nS;
    for (let k = 0; k < nS; k++) lada('tra', Mb, [0, BORD.h - 0.014, -BORD.hz + bw / 2 + k * (bw + sp)], [BORD.hx, 0.014, bw / 2], T.map(v => v * (0.94 + 0.12 * ((k * 37) % 7) / 7)));
    for (const sz of [-1, 1]) lada('tra', Mb, [0, BORD.h - 0.065, sz * (BORD.hz - 0.06)], [BORD.hx - 0.08, 0.037, 0.011], TM);
    for (const sx of [-1, 1]) lada('tra', Mb, [sx * (BORD.hx - 0.08), BORD.h - 0.065, 0], [0.011, 0.037, BORD.hz - 0.06], TM);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lada('tra', Mb, [sx * (BORD.hx - 0.1), (BORD.h - 0.03) / 2, sz * (BORD.hz - 0.08)], [0.028, (BORD.h - 0.03) / 2, 0.028], TM);
    // karmstolarna, två på var långsida, vända mot bordet (ut = riktningen bort från bordet)
    for (const ut of [-1, 1]) for (const cx of STOLX) {
      const cz = ut * STOL.z, zF = cz - ut * (STOL.hz - 0.02), zB = cz + ut * (STOL.hz - 0.02);
      for (const sx of [-1, 1]) {
        const x = cx + sx * (STOL.hx - 0.025);
        lada('tra', Mb, [x, 0.31, zF], [0.022, 0.31, 0.022], TM);                                   // framben upp till armstödet
        lada('tra', Mb, [x, 0.21, zB], [0.022, 0.21, 0.022], TM);                                   // bakben
        lada('tra', Mb, [x, 0.66, zB + ut * 0.06], [0.022, 0.27, 0.022], TM, [ut * 0.24, 0, 0]);     // ryggstolpe, lutar bakåt
        lada('tra', Mb, [x, 0.635, (zF + zB) / 2 + ut * 0.02], [0.03, 0.013, STOL.hz], T);          // armstöd
        lada('tra', Mb, [x, 0.12, cz], [0.012, 0.025, STOL.hz - 0.02], TM);                         // nedre slå
      }
      for (let k = 0; k < 5; k++) lada('tra', Mb, [cx, STOL.sits - 0.012, zF + ut * (0.03 + k * 0.098)], [STOL.hx - 0.05, 0.012, 0.04], T);   // sitsens ribbor
      for (const sz of [zF, zB]) lada('tra', Mb, [cx, STOL.sits - 0.05, sz], [STOL.hx - 0.05, 0.03, 0.016], TM);
      for (let k = 0; k < 4; k++) lada('tra', Mb, [cx, 0.56 + k * 0.095, zB + ut * (0.035 + k * 0.024)], [STOL.hx - 0.05, 0.03, 0.01], T, [ut * 0.24, 0, 0]);   // ryggens spjälor
      // dynor: sits och rygg
      dyna(Mb, [cx, STOL.sits + 0.035, cz - ut * 0.005], [STOL.hx - 0.065, 0.035, STOL.hz - 0.03], DY, null, p.fin);
      dyna(Mb, [cx, 0.71, zB - ut * 0.01], [STOL.hx - 0.075, 0.19, 0.04], DY, [ut * 0.24, 0, 0], p.fin);
    }
    // parasoll genom bordets mitt: fot, stång, löpare med spröt, åtta ekrar och en duk i åtta fält med lätt svank och kappa
    if (p.parasoll) {
      const MET = [0.82, 0.82, 0.8], Ht = 2.46, R = 1.4, yR = 1.98, A = D.tyg;
      ror(Mb, [0, 0.0, 0], [0, 0.06, 0], 0.24, [0.25, 0.25, 0.26]);
      ror(Mb, [0, 0.06, 0], [0, Ht + 0.06, 0], 0.019, MET);
      ror(Mb, [0, Ht + 0.04, 0], [0, Ht + 0.12, 0], 0.03, MET);
      ror(Mb, [0, 1.74, 0], [0, 1.86, 0], 0.03, MET);
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) / 8 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        ror(Mb, [0, Ht - 0.025, 0], [c * R, yR - 0.025, sn * R], 0.007, MET);
        ror(Mb, [0, 1.8, 0], [c * R * 0.45, Ht - (Ht - yR) * 0.45 - 0.03, sn * R * 0.45], 0.006, MET);
      }
      const rader = p.fin ? 5 : 3, kol = p.fin ? 6 : 3;
      M3.getNormalMatrix(Mb);
      for (let k = 0; k < 8; k++) {
        const a0 = (k + 0.5) / 8 * Math.PI * 2, a1 = (k + 1.5) / 8 * Math.PI * 2, bas = A.P.length / 3, ljus = k % 2 ? 1 : 0.95;
        const pkt = (i, j) => {
          const t = i / rader, u = j / kol, a = a0 + (a1 - a0) * u, mitt = Math.sin(u * Math.PI);
          const rr = R * t * (1 - 0.035 * mitt), y = Ht - (Ht - yR) * t - 0.05 * mitt * t * (1.2 - t);
          return [Math.cos(a) * rr, y, Math.sin(a) * rr];
        };
        for (let i = 0; i <= rader; i++) for (let j = 0; j <= kol; j++) {
          const q = pkt(i, j), qa = pkt(Math.min(rader, i + 1), j), qb = pkt(i, Math.min(kol, j + 1)), qc = pkt(Math.max(0, i - 1), j), qd = pkt(i, Math.max(0, j - 1));
          const e1 = new THREE.Vector3(qa[0] - qc[0], qa[1] - qc[1], qa[2] - qc[2]), e2 = new THREE.Vector3(qb[0] - qd[0], qb[1] - qd[1], qb[2] - qd[2]), nn = e2.cross(e1).normalize();
          if (!(nn.y > 0)) nn.set(-nn.x, Math.abs(nn.y) || 1, -nn.z).normalize();
          V.set(q[0], q[1], q[2]).applyMatrix4(Mb); A.P.push(V.x, V.y, V.z);
          nn.applyMatrix3(M3).normalize(); A.N.push(nn.x, nn.y, nn.z);
          A.U.push(j / kol * 1.4, i / rader * 1.6); A.C.push(DU[0] * ljus, DU[1] * ljus, DU[2] * ljus);
        }
        for (let i = 0; i < rader; i++) for (let j = 0; j < kol; j++) { const q = bas + i * (kol + 1) + j, w = q + kol + 1; A.I.push(q, w, q + 1, q + 1, w, w + 1); }
        // kappan: en remsa 12 cm rakt ned längs kanten
        const b2 = A.P.length / 3;
        for (let j = 0; j <= kol; j++) for (const dy of [0, -0.12]) {
          const q = pkt(rader, j); V.set(q[0], q[1] + dy, q[2]).applyMatrix4(Mb); A.P.push(V.x, V.y, V.z);
          const a = a0 + (a1 - a0) * j / kol; V.set(Math.cos(a), 0, Math.sin(a)).transformDirection(Mb); A.N.push(V.x, V.y, V.z);
          A.U.push(j / kol * 1.4, dy ? 0.15 : 0); A.C.push(DU[0] * ljus * 0.92, DU[1] * ljus * 0.92, DU[2] * ljus * 0.92);
        }
        for (let j = 0; j < kol; j++) { const q = b2 + j * 2; A.I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      }
    }
    // kontroll i planet: varje stol (inkl. armstöd och dyna, ±hx, ±hz) mot bordsskivan och mot stolen bredvid
    uteKoll.grupper++;
    for (const ut of [-1, 1]) for (const cx of STOLX) {
      const zIn = ut * STOL.z - ut * STOL.hz;   // stolens framkant
      if (Math.abs(cx) - STOL.hx < BORD.hx && Math.abs(zIn) < BORD.hz + 0.02) uteKoll.krockar++;
    }
    if (STOLX[1] - STOLX[0] < STOL.hx * 2 + 0.02) uteKoll.krockar++;
  }
  const tex = fil => { const t = new THREE.TextureLoader().load(fil, () => { try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; return t; };
  const material = (namn, opt) => {
    const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opt));
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    m.onBeforeCompile = s => {
      Object.assign(s.uniforms, { miljoLjus: LJUS || { value: new THREE.Color(0.3, 0.3, 0.3) }, uNatt: (VU && VU.uNatt) || { value: 0 } });
      s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform float uNatt;\n' + s.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
    };
    m.customProgramCacheKey = () => 'ute-' + namn;
    return m;
  };
  const MAT = {
    tra: material('tra', { map: tex('images/tex/lucka-ek-diff.webp'), normalMap: tex('images/tex/lucka-ek-nor.webp') }),
    tyg: material('tyg', { map: tex('images/tex/tyg-bomull-diff.webp'), normalMap: tex('images/tex/tyg-bomull-nor.webp'), side: THREE.DoubleSide }),
    met: material('met', {}),
  };
  MAT.tra.normalScale = new THREE.Vector2(0.6, 0.6); MAT.tyg.normalScale = new THREE.Vector2(0.8, 0.8);
  for (const k of ['tra', 'tyg', 'met']) {
    const A = D[k]; if (!A.I.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(A.U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(A.C, 3));
    geo.setIndex(A.I); geo.computeBoundingSphere();
    const me = new THREE.Mesh(geo, MAT[k]); me.name = 'ute-' + k; me.castShadow = true; me.receiveShadow = true; me.userData.egen = false; me.matrixAutoUpdate = false;
    g.add(me);
  }
  BOX.dispose(); CYL.dispose(); Object.values(dynaGeo).forEach(q => q.dispose());
  try { window.__ute = uteKoll; } catch (e) { /* ingen window */ }
  return g;
}
