// husritare-vaxter.js – riktiga gräs- och markväxter i husritarens miljöer (trädgård, villaområde, skog, vid sjön).
// Fotoskannade växter, förenklade till 400–1500 trianglar styck med en gemensam färg+alfa-atlas, packade i
// images/3d/vaxt-paket.bin (eget format: maskerat + gzip; avkodas här). Licensen kräver att innehållet inte går att
// plocka ut direkt, så filen är inte en vanlig .glb och saknar ursprungsnamn. Byggs om med _verktyg/vaxter/bygg.mjs.
//
// Användning (från husritare-miljo.js):
//   const VP = skapaVaxtPaket(THREE, { VU, LJUS, ANISO });
//   N.extra.push(VP.grupp(VP.tradgard({ mal, hy, sten })));     // tom grupp som fylls när paketet laddats (lat)
//
// Typer (nätens ordning i paketet): 0 rajgräs, 1 rajgräs liten, 2 kavelhirs, 3 starr, 4 fingerhirs, 5 tuvlilja, 6 sandrör
const TRI = [800, 400, 700, 800, 700, 900, 1500];
const URL_PAKET = 'images/3d/vaxt-paket.bin?v=3';
const AV = (() => { try { return new URLSearchParams(location.search).get('vaxter') === '0'; } catch (e) { return false; } })();   // ?vaxter=0 stänger av (för jämförelser)
// svaga enheter (pekskärm eller smal skärm): hälften så många markväxter (instanser och trianglar)
const KVAL = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 760 ? 0.5 : 1; } catch (e) { return 1; } })();

export function skapaVaxtPaket(THREE, { VU, LJUS, ANISO = 4, renderer = null }) {
  // mjuka strånkanter med alpha-to-coverage när renderaren har MSAA, annars bara alfatest
  const MSAA = (() => { try { const g = renderer.getContext(), a = g.getContextAttributes(); return !!(a && a.antialias) && (g.getParameter(g.SAMPLES) || 0) > 1; } catch (e) { return false; } })();
  const P = { geo: null, mat: null, vant: [], laddar: false };

  // ---- avkodning ----
  async function hamta() {
    const u8 = new Uint8Array(await (await fetch(URL_PAKET)).arrayBuffer());
    let s = 0x9e3779b9 ^ u8.length;
    for (let i = 0; i < u8.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; u8[i] ^= s & 255; }
    const raw = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const len = new DataView(raw).getUint32(0, true);
    const H = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 4, len)));
    const bas = 4 + len + ((4 - ((4 + len) % 4)) % 4);
    const geo = H.a.map(a => {
      const p = new Int16Array(raw, bas + a.p, a.nv * 3), n = new Int8Array(raw, bas + a.n, a.nv * 4);
      const pos = new Float32Array(a.nv * 3), nor = new Float32Array(a.nv * 3), hh = new Float32Array(a.nv);
      let hmax = 0.01;
      for (let i = 0; i < a.nv * 3; i++) pos[i] = p[i] * a.ps;
      for (let i = 0; i < a.nv; i++) hmax = Math.max(hmax, pos[i * 3 + 1]);
      for (let i = 0; i < a.nv; i++) {
        // normalerna dras mot uppåt: mjukt ljus över hela tuvan i stället för svarta baksidor
        const x = n[i * 4] / 127, y = n[i * 4 + 1] / 127, z = n[i * 4 + 2] / 127, nx = x * 0.45, ny = y * 0.45 + 0.75, nz = z * 0.45, l = Math.hypot(nx, ny, nz);
        nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
        hh[i] = Math.max(0, pos[i * 3 + 1] / hmax);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(raw.slice(bas + a.u, bas + a.u + a.nv * 4)), 2, true));
      g.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(raw.slice(bas + a.i, bas + a.i + a.ni * 2)), 1));
      g.computeBoundingSphere();
      return g;
    });
    const bild = await createImageBitmap(new Blob([new Uint8Array(raw, bas + H.b, H.bl)], { type: 'image/webp' }), { premultiplyAlpha: 'none', imageOrientation: 'none' });
    const t = new THREE.Texture(bild);
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
    return { geo, tex: t };
  }
  function material(tex) {
    const a = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.42, alphaToCoverage: MSAA, side: THREE.DoubleSide });
    a.onBeforeCompile = s => {
      Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt });
      s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\nattribute float aH;\nvarying float vH;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vH = aH;
          float h = aH * aH;
          vec4 bas = instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
          float fas = bas.x * 0.31 + bas.z * 0.23;
          float by = 0.55 + 0.45 * sin( uTid * 0.23 + fas * 0.8 ) * sin( uTid * 0.137 + fas * 0.5 + 1.3 );
          transformed.xz += ( uVind * ( 0.07 * by + 0.025 * sin( uTid * 1.6 + fas * 3.0 + position.x * 9.0 ) ) + 0.014 * vec2( sin( uTid * 2.3 + position.z * 11.0 + fas ), cos( uTid * 1.9 + position.x * 13.0 ) ) ) * h;
        }`);
      s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\nvarying float vH;\n' + s.fragmentShader
        // mipnivåerna tunnar annars ut stråna på avstånd (alfatestet äter dem): alfan höjs med nivån
        .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 dd = max( abs( dFdx( vMapUv ) ), abs( dFdy( vMapUv ) ) ) * 2048.0;
          diffuseColor.a *= 1.0 + 0.35 * log2( max( max( dd.x, dd.y ), 1.0 ) );
        }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.62 + 0.38 * smoothstep( 0.0, 0.55, vH );\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * 0.7 * vH );');
    };
    a.customProgramCacheKey = () => 'miljo-vaxtpaket';
    return a;
  }
  // laddas en gång, lat: först när en miljö bett om växter, och efter att huset hunnit visas
  function ladda(cb) {
    if (P.geo) { cb(P); return; }
    P.vant.push(cb);
    if (P.laddar) return;
    P.laddar = true;
    const start = () => hamta().then(({ geo, tex }) => { P.geo = geo; P.mat = material(tex); P.vant.splice(0).forEach(f => f(P)); })
      .catch(e => { console.warn('vaxt-paket', e); P.laddar = false; });
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 2500 }) : start()), 1200);
  }

  // poster: [{ x, y, z, s, sy, ry, typ, c: [r, g, b] }] → grupp som fylls med ett instansat nät per typ
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  // lod: [nära, långt, minsta andel] → posterna delas i rutor om 9 m (eget nät per ruta och art, så att rutor utanför bilden
  // gallras bort) och varje ruta ritar färre instanser ju längre bort kameran är (instanserna ligger i slumpad ordning)
  function grupp(poster, lod = null) {
    const g = new THREE.Group(); g.name = 'markvaxter';
    if (!poster.length || AV) return g;
    if (lod && KVAL < 1) lod = [lod[0] * 0.7, lod[1] * 0.75, lod[2] * 0.7];   // svaga enheter: glesare tidigare
    try { if (/[?&]prov=1/.test(location.search)) (window.__vaxt = window.__vaxt || []).push(g); } catch (e) { /* utan fönster */ }   // för provbilder
    console.info('miljö: markväxter', poster.length, 'st,', trianglar(poster), 'trianglar');
    ladda(({ geo, mat }) => {
      for (let t = 0; t < geo.length; t++) {
        const L0 = poster.filter(p => p.typ === t);
        if (!L0.length) continue;
        const rutor = {};
        if (lod) for (const p of L0) { const k = Math.floor(p.x / 9) + ',' + Math.floor(p.z / 9); (rutor[k] || (rutor[k] = [])).push(p); }
        else rutor.alla = L0;
        for (const k in rutor) {
        const L = rutor[k];
        if (lod) L.sort((a, b) => hash2(a.x, a.z) - hash2(b.x, b.z));
        const m = new THREE.InstancedMesh(geo[t], mat, L.length);
        m.name = 'markvaxter-' + t;
        L.forEach((p, i) => {
          E.set(p.lx || 0, p.ry, p.lz || 0); Q.setFromEuler(E); V.set(p.x, p.y, p.z); S.set(p.s, p.s * (p.sy || 1), p.s);
          m.setMatrixAt(i, M4.compose(V, Q, S)); m.setColorAt(i, C.setRGB(p.c[0], p.c[1], p.c[2]));
        });
        m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
        m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false;
        m.userData.egen = false;              // geometrin delas mellan miljöerna och släpps inte vid miljöbyte
        m.computeBoundingSphere();
        if (lod) {
          const n = L.length, c = new THREE.Vector3(), rad = m.boundingSphere.radius;
          m.onBeforeRender = (ren, sc, cam) => {
            c.copy(m.boundingSphere.center).applyMatrix4(m.matrixWorld);
            const d = Math.max(0, cam.position.distanceTo(c) - rad * 0.6), f = d <= lod[0] ? 1 : Math.max(lod[2], 1 - (d - lod[0]) / (lod[1] - lod[0]) * (1 - lod[2]));
            m.count = Math.ceil(n * f);   // (0 långt bort: inga kvarlämnade enstaka tuvor)
          };
        }
        g.add(m);
        }
      }
      try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ }   // motorn ritar bara vid behov
    });
    return g;
  }

  // ---- utplacering ----
  const brus = (x, z) => {                 // mjukt värdebrus 0..1 (klumpar på ~4–8 m)
    const f = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const o = (x, z, k) => { const X = x * k, Z = z * k, i = Math.floor(X), j = Math.floor(Z), u = X - i, v = Z - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      return (f(i, j) * (1 - su) + f(i + 1, j) * su) * (1 - sv) + (f(i, j + 1) * (1 - su) + f(i + 1, j + 1) * su) * sv; };
    return o(x, z, 0.17) * 0.65 + o(x + 9.1, z - 3.7, 0.45) * 0.35;
  };
  const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  const kantAv = (mal, x, z) => Math.hypot(Math.max(Math.abs(x) - mal.L / 2, 0), Math.max(Math.abs(z) - mal.W / 2, 0));
  const grundBredd = ({ L, W }) => Math.min(0.6, Math.max(0.35, 0.3 + 0.011 * (L + W)));
  // husgrundens fyra sidor som linjer (d m ut från väggen)
  const husLinjer = (mal, d) => { const a = mal.L / 2 + d, b = mal.W / 2 + d; return [[-a, -b, a, -b], [a, -b, a, b], [a, b, -a, b], [-a, b, -a, -b]]; };
  // husets entrésida (den som dörren vetter mot) två gånger, så att framsidan får fler klumpar
  const framLinje = (mal, d) => { const H = husLinjer(mal, d), n = [[0, -1], [1, 0], [0, 1], [-1, 0]], i = n.reduce((b, v, k) => v[0] * mal.dorr.nx + v[1] * mal.dorr.nz > n[b][0] * mal.dorr.nx + n[b][1] * mal.dorr.nz ? k : b, 0); return [H[i], H[i]]; };
  // tomtgränsen (samma ram som tomtGrund i husritare-miljo.js): fram 8,5 m, bak 9 m, sidor 6,5 m
  function tomtLinjer(mal) {
    const { L, W, dorr } = mal, dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
    const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * L / 2, b * W / 2]);
    const fA = (x, z) => x * dn[0] + z * dn[1], sA = (x, z) => x * du[0] + z * du[1];
    const f1 = Math.max(...hor.map(h => fA(...h))) + 8.5, f0 = Math.min(...hor.map(h => fA(...h))) - 9;
    const s0 = Math.min(...hor.map(h => sA(...h))) - 6.5, s1 = Math.max(...hor.map(h => sA(...h))) + 6.5;
    const P2 = (f, s) => [dn[0] * f + du[0] * s, dn[1] * f + du[1] * s];
    return [[...P2(f1, s0), ...P2(f1, s1)], [...P2(f1, s0), ...P2(f0, s0)], [...P2(f1, s1), ...P2(f0, s1)], [...P2(f0, s0), ...P2(f0, s1)]];
  }
  // färgvariation: grönt med lite gult/torrt; t = 0 frodigt, 1 torrare
  const ton = (r, t = 0.3) => { const d = r() < t ? 1 : 0, l = 0.86 + r() * 0.26; return [l * (1 + d * 0.2), l * (1 - d * 0.02), l * (0.92 - d * 0.3)]; };   // torr: varmare halmton
  const valj = (r, A) => { let s = 0; for (const [, w] of A) s += w; let q = r() * s; for (const [t, w] of A) { q -= w; if (q <= 0) return t; } return A[0][0]; };

  // allmän spridare: klumpar längs kanter (linjer och punkter) och glesare klumpar fritt i ytan där bruset är högt
  // o: { r, hy, fri(x, z, m), linjer, punkter: [[x, z, rad]], yta: [x0, z0, x1, z1], nK (klumpar), kantAndel,
  //      kantArter, ytArter: [[typ, vikt]], per: [min, max] plantor per klump, sprid: m, tri: max trianglar, torr, skala }
  function sprid(o) {
    const { r, hy, fri } = o, ut = [], per = o.per || [4, 10], sprid = o.sprid || 0.85, sk = o.skala || 1.9;
    let tri = 0;
    o = Object.assign({}, o, { tri: o.tri * KVAL });
    const linjer = o.linjer || [], punkter = o.punkter || [];
    const lLen = linjer.map(([a, b, c, d]) => Math.hypot(c - a, d - b)), lTot = lLen.reduce((s, v) => s + v, 0);
    for (let f = 0, k = 0; f < o.nK * 30 && k < o.nK && tri < o.tri; f++) {
      let cx, cz, kantK = false;
      if (r() < (o.kantAndel ?? 0.6) && (lTot || punkter.length)) {
        kantK = true;
        if (punkter.length && (!lTot || r() < 0.3)) { const [px, pz, pr] = punkter[(r() * punkter.length) | 0], a = r() * 6.283, d = pr * (1 + r() * 0.5); cx = px + Math.cos(a) * d; cz = pz + Math.sin(a) * d; }
        else {
          let q = r() * lTot, i = 0; while (i < linjer.length - 1 && q > lLen[i]) { q -= lLen[i]; i++; }
          const [a, b, c, d] = linjer[i], t = q / (lLen[i] || 1), nx = -(d - b) / (lLen[i] || 1), nz = (c - a) / (lLen[i] || 1), off = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.6);
          cx = a + (c - a) * t + nx * off; cz = b + (d - b) * t + nz * off;
        }
      } else {
        if (o.fram && r() < 0.6) [cx, cz] = o.fram(r());   // gräsmattan framför huset (startvyn)
        else { const [x0, z0, x1, z1] = o.yta; cx = x0 + r() * (x1 - x0); cz = z0 + r() * (z1 - z0); }
        if (brus(cx, cz) < 0.42 + r() * 0.25) continue;
      }
      if (!fri(cx, cz, 0.3)) continue;
      const A = kantK ? (o.kantArter || o.ytArter) : o.ytArter, typ = valj(r, A), n = per[0] + ((r() * (per[1] - per[0] + 1)) | 0);
      k++;
      for (let j = 0; j < n && tri < o.tri; j++) {
        // tätast i mitten; ibland en annan art i klumpens kant
        const a = r() * 6.283, d = Math.sqrt(r()) * sprid * (0.5 + 0.5 * n / per[1]), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!fri(x, z, 0.12)) continue;
        const t = j > 1 && r() < 0.25 ? valj(r, o.ytArter) : typ;
        ut.push({ x, y: hy(x, z) - 0.02, z, s: sk * (kantK ? 1.12 : 0.9) * (0.75 + r() * 0.5) * (1 - 0.25 * d / sprid), sy: 0.85 + r() * 0.35, ry: r() * 6.283, lx: (r() - 0.5) * 0.12, lz: (r() - 0.5) * 0.12, typ: t, c: ton(r, o.torr ?? 0.25) });
        tri += TRI[t];
      }
    }
    return ut;
  }
  // gräsytor nära huset, gemensamt för miljöerna
  function bas(mal, extra = () => true) {
    const gb = grundBredd(mal);
    return (x, z, m) => !mal.blockerad(x, z, m + 0.25) && !(mal.trappa && mal.trappa(x, z, m + 0.25)) && !(mal.sidodorrar || []).some(d => Math.hypot(x - d.x, z - d.z) < 1.3 + m)
      && kantAv(mal, x, z) > gb + 0.75 && extra(x, z, m);
  }
  // slumpad punkt på gräsmattan framför entrén: 1,5–9 m ut från fasaden, husets bredd + 6 m åt sidorna
  const framYta = (mal, r) => () => { const { L, W, dorr } = mal, dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx], djup = Math.abs(dn[0]) > 0.5 ? L / 2 : W / 2, bred = Math.abs(dn[0]) > 0.5 ? W / 2 : L / 2, f = djup + 1.5 + r() * 7.5, s = (r() - 0.5) * 2 * (bred + 6); return [dn[0] * f + du[0] * s, dn[1] * f + du[1] * s]; };
  const GRAN = 22;   // hur långt ut från huset växterna sprids (m)
  const ytaRunt = (mal, d = GRAN) => [-mal.L / 2 - d, -mal.W / 2 - d, mal.L / 2 + d, mal.W / 2 + d];

  // trädgården: kantklumpar vid husgrunden, staketet/häckarna och stenarna; fria klumpar på gräsmattan
  function tradgard({ mal, hy, sten = [], r = slumpFro(4848) }) {
    const gb = grundBredd(mal), nara = (x, z) => kantAv(mal, x, z) < GRAN, T = tomtLinjer(mal);
    // framsidan (husets entrésida och staketet fram) syns i startvyn: de linjerna räknas dubbelt
    return sprid({ r, hy, fri: bas(mal, nara), linjer: [...husLinjer(mal, gb + 1.15), ...framLinje(mal, gb + 1.15), ...T, T[0], T[0]], punkter: sten, yta: ytaRunt(mal, 14), fram: framYta(mal, r), nK: 64, kantAndel: 0.6,
      kantArter: [[2, 3], [3, 3], [0, 3], [5, 2], [4, 1]], ytArter: [[0, 4], [1, 3], [4, 3], [2, 1]], tri: 95000 });
  }
  // skogen (inte vintern): glänta runt huset, starr och tuvor vid gärdsgården och stenblocken
  function skog({ mal, hy, sten = [], r = slumpFro(4949) }) {
    const gb = grundBredd(mal), nara = (x, z) => kantAv(mal, x, z) < 15;
    return sprid({ r, hy, fri: bas(mal, nara), linjer: [...husLinjer(mal, gb + 1.15), ...tomtLinjer(mal)], punkter: sten, yta: ytaRunt(mal, 15), nK: 36, kantAndel: 0.65,
      kantArter: [[3, 4], [5, 3], [2, 2], [0, 1]], ytArter: [[3, 2], [0, 2], [5, 2], [1, 1]], tri: 70000, torr: 0.35 });
  }
  // vid sjön: rajgräs och hirs på land, sandrör i strandkanten. strand(x, z) → 0 på land … 1 vid vattnet (null = utanför gräset)
  function kust({ mal, hy, strand, stig = null, r = slumpFro(5050) }) {
    const gb = grundBredd(mal), land = (x, z) => { const q = strand(x, z); return q !== null && q < 0.55 && kantAv(mal, x, z) < GRAN; };
    const ut = sprid({ r, hy, fri: bas(mal, land), linjer: [...husLinjer(mal, gb + 1.15), ...framLinje(mal, gb + 1.15)], yta: ytaRunt(mal), fram: framYta(mal, r), nK: 0, kantAndel: 0.55,
      kantArter: [[2, 3], [0, 3], [3, 2], [4, 1]], ytArter: [[0, 4], [1, 3], [4, 2], [2, 2]], tri: 60000, torr: 0.35 });
    const sand = (x, z) => { const q = strand(x, z); return q !== null && q > 0.45 && kantAv(mal, x, z) < GRAN + 6 && (!stig || stig(x, z) > 0.9); };   // (sandröret är upp till 1,7 m brett)   // (aldrig genom bryggor, boden, bastun)
    let tri = ut.reduce((s, p) => s + TRI[p.typ], 0);
    return ut.concat(sprid({ r, hy, fri: bas(mal, sand), yta: ytaRunt(mal, GRAN + 6), nK: 26, kantAndel: 0, ytArter: [[6, 5], [2, 1]], per: [2, 6], sprid: 1.0, skala: 1.15, tri: Math.max(0, 110000 - tri), torr: 0.5 }),
      kustAng({ mal, hy, strand, stig, r: slumpFro(5252) }));
  }
  // ängen vid sjön: ett tätt fält av riktiga tuvor över hela tomten (jitterrutnät, tätheten följer bruset i fläckar),
  // kort gräs nära huset och framför det, högre ängsgräs (kavelhirs, starr, sandrör) i tuvor mot stranden och glest vid stigarna.
  // Ritas med lod i grupp(): rutor nära kameran fulla, långt bort glesa.
  function kustAng({ mal, hy, strand, stig, r }) {
    const ut = [], gb = grundBredd(mal), steg = 0.64 / Math.sqrt(KVAL), R = 34;
    for (let x = -R; x < R; x += steg) for (let z = -R; z < R; z += steg) {
      const px = x + (r() - 0.5) * steg * 0.95, pz = z + (r() - 0.5) * steg * 0.95, k = kantAv(mal, px, pz);
      if (k > 30 || k < gb + 0.55) continue;
      const s = strand(px, pz);
      if (s === null) continue;
      // ut i sanden (s > 1, q 9,2–11,3): gräset glesnar ut till enstaka strandgräs- och sandrörstuvor
      if (s > 1.0) {
        const g = (1.29 - s) / 0.29;
        if (r() > g * g * 0.5 || mal.blockerad(px, pz, 0.12) || (stig && stig(px, pz) < 0.9)) continue;
        const typ = r() < 0.35 ? 6 : r() < 0.6 ? 2 : 0, sk = typ === 6 ? 0.6 + r() * 0.4 : 1.6 + r() * 0.7;
        ut.push({ x: px, y: hy(px, pz) - 0.03, z: pz, s: sk, sy: 0.9 + r() * 0.5, ry: r() * 6.283, lx: (r() - 0.5) * 0.2, lz: (r() - 0.5) * 0.2, typ, c: ton(r, 0.35).map((v, i) => v * [1.02, 1.04, 0.8][i]) });
        continue;
      }
      const b = brus(px, pz), b2 = brus(px * 2.7 + 31, pz * 2.7 - 17);
      if (r() > 0.86 + b * 0.14) continue;
      if (k < 5.5 && r() < 0.75) continue;   // klippt gräsmatta närmast huset: fotomarken bär den, bara enstaka låga tuvor   // nästan jämn täthet: en sammanhängande gräsmatta, inga glesa fläckar
      const st = stig ? stig(px, pz) : 99;
      if (st < 0.32) continue;
      if (mal.blockerad(px, pz, 0.12) || (mal.trappa && mal.trappa(px, pz, 0.25)) || (mal.sidodorrar || []).some(d => Math.hypot(px - d.x, pz - d.z) < 1.2)) continue;
      // högt: mot stranden (s), i tuvor (b2), aldrig närmast huset eller tätt vid stigen
      const hog = s > 0.3 && b2 > 0.7 - s * 0.45 && k > 6 && st > 1.1;   // (färre spridda höga tuvor: de lästes som ogräs)
      let typ, sk, sy;
      // (tuvornas egna mått: rajgräs 0,27 × 0,24 m, liten 0,16 × 0,16, kavelhirs 0,38 × 0,5, starr 0,5 × 0,38, sandrör 1,5 × 0,75)
      if (hog) { typ = valj(r, s > 0.55 ? [[6, 3], [3, 3], [2, 3]] : [[2, 4], [3, 3], [0, 3], [6, 1]]); sk = typ === 6 ? 0.9 + r() * 0.5 : 2.0 + r() * 0.9; sy = (typ === 6 ? 1.1 : 1.25) + r() * 0.5 + s * 0.3; }
      // klippt gräsmatta närmast huset (k < 7: låga, jämna tuvor), sedan mjukt högre ängsgräs utåt; inga mörka starrtuvor i mattan
      else { const ang = Math.min(1, Math.max(0, (k - 6) / 9)); typ = valj(r, k < 7 ? [[1, 8], [0, 2]] : [[1, 8], [0, 3], [4, 2]]); sk = ((typ === 1 || typ === 4) ? 2.7 + r() * 0.8 : 2.0 + r() * 0.5) * (st < 0.9 ? 0.75 : 1); sy = (0.5 + 0.12 * r()) * (1 - ang) + (0.85 + r() * 0.45) * ang; }
      ut.push({ x: px, y: hy(px, pz) - 0.03, z: pz, s: sk, sy, ry: r() * 6.283, lx: (r() - 0.5) * 0.16, lz: (r() - 0.5) * 0.16, typ, c: ton(r, hog ? 0.18 : 0.03).map((v, i) => (0.95 + 0.2 * v) * [1.04, 1.1, 0.74][i]) });   // (jämnare ton: inga enstaka mörka eller ljusa prickar)   // friskt gulgrönt sommargräs
    }
    return ut;
  }
  // villaområdet: vår tomt (husgrunden) och grannarnas tomter (husgrunder och staket mot gatan), aldrig på gata,
  // trottoar, uppfarter, gångar, altaner eller grus. V = data från villaNara (se anropet där).
  function villa({ mal, hy, ledig, iGata, svAv, latAv, pt, uppfarter, YT, husR, tomtD, ram = null, r = slumpFro(5151) }) {
    const gb = grundBredd(mal), R = 46;
    const ytor = YT.map(y => y.P.map(p => [p[0], p[2]]));
    // ytor: konvexa fyrhörningar (gångar, altaner, grus); valfri ordning på hörnen, marginal m
    const iYta = (x, z, m) => ytor.some(q => { let pos = true, neg = true; for (let i = 0; i < q.length; i++) { const [ax, az] = q[i], [bx, bz] = q[(i + 1) % q.length], ex = bx - ax, ez = bz - az, c = (ex * (z - az) - ez * (x - ax)) / (Math.hypot(ex, ez) || 1); if (c < -m) pos = false; if (c > m) neg = false; } return pos || neg; });
    const fri = (x, z, m) => {
      if (Math.hypot(x, z) > R) return false;
      const a = svAv(x, z), b = latAv(x, z);
      if (iGata(a, b, 0.6 + m)) return false;
      const k = kantAv(mal, x, z);
      if (k < 7) { if (mal.blockerad(x, z, m + 0.25) || (mal.trappa && mal.trappa(x, z, m + 0.25)) || k < gb + 0.75) return false; }
      else if (!ledig(a, b, m + 0.35)) return false;
      if (uppfarter.some(([a0, b0, a1, b1, w]) => segAv(a, b, a0, b0, a1, b1) < w / 2 + m + 0.3)) return false;
      return !iYta(x, z, m + 0.15);
    };
    const linjer = [...husLinjer(mal, gb + 1.15), ...framLinje(mal, gb + 1.15)];
    husR.forEach(h => {   // grannhusens grunder, 1 m ut
      const hl = h.L / 2 + 1, hw = h.W / 2 + 1, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => pt(h.sv + h.ax[0] * u * hl + h.f[0] * v * hw, h.lat + h.ax[1] * u * hl + h.f[1] * v * hw));
      if (Math.hypot(...c[0]) > R + 10) return;
      for (let i = 0; i < 4; i++) linjer.push([...c[i], ...c[(i + 1) % 4]]);
    });
    tomtD.forEach(d => {   // grannarnas staket mot gatan (insidan), där klipparen inte kommer åt
      const ZF = d.typ.W / 2 + 5.4 - 0.3, a = pt(...d.lok(-12, ZF)), b = pt(...d.lok(12, ZF));
      if (Math.hypot(...a) < R + 10) linjer.push([...a, ...b]);
    });
    // vår tomt först (egen budget, syns i startvyn), sedan grannarnas. Med ram (staketet från villaNara): klumpar längs
    // staketets insida, vid grinden och längs gången, i varmare och torrare toner (kavelhirs med ax) mot den klippta mattan
    let egen;
    if (ram && ram.svF !== undefined) {
      const { svF, svB, lat0, lat1, latG, svG0 } = ram, P = (a, b) => pt(a, b), L2 = (a0, b0, a1, b1) => [...P(a0, b0), ...P(a1, b1)];
      // rabatterna (villaNara) längs staketets insida (1,35 m) och längs gången från grinden (±1,6 m) får inga klumpar
      const iRabatt = (a, b) => a > svF - 1.35 || (latG !== null && Math.abs(b - latG) < 1.6 && a > (ram.s1 ?? svG0) - 0.2);
      const inne = (x, z, m) => { const a = svAv(x, z), b = latAv(x, z); return a < svF - 0.2 && a > svB + 0.3 && b > lat0 + 0.3 && b < lat1 - 0.3 && !iRabatt(a, b) && fri(x, z, m); };
      const stak = L2(svF - 1.6, lat0 + 0.6, svF - 1.6, lat1 - 0.6), lin = [...linjer.slice(4, 6), stak, stak, L2(svF - 0.6, lat0 + 0.6, svB + 0.6, lat0 + 0.6), L2(svF - 0.6, lat1 - 0.6, svB + 0.6, lat1 - 0.6)];
      const pkt = [];

      egen = sprid({ r, hy, fri: inne, linjer: lin, punkter: pkt, yta: ytaRunt(mal, 12), fram: framYta(mal, r), nK: 90, kantAndel: 0.9, per: [3, 7],
        kantArter: [[2, 6], [1, 2], [3, 1], [0, 1], [4, 1]], ytArter: [[1, 3], [2, 2], [0, 1]], tri: 60000, torr: 0.5 });
    } else egen = sprid({ r, hy, fri: (x, z, m) => kantAv(mal, x, z) < 14 && fri(x, z, m), linjer: [...linjer.slice(0, 6), ...framLinje(mal, grundBredd(mal) + 1.15), ...tomtLinjer(mal), tomtLinjer(mal)[0], tomtLinjer(mal)[0]], yta: ytaRunt(mal, 12), fram: framYta(mal, r), nK: 64, kantAndel: 0.55,
      kantArter: [[2, 3], [3, 2], [0, 3], [5, 2], [4, 1]], ytArter: [[0, 4], [1, 3], [4, 2]], tri: 70000, torr: 0.2 });
    return egen.concat(sprid({ r, hy, fri: (x, z, m) => kantAv(mal, x, z) > 10 && fri(x, z, m), linjer: linjer.slice(6), yta: [-R, -R, R, R], nK: 50, kantAndel: 0.8,
      kantArter: [[2, 3], [3, 2], [0, 3], [5, 2], [4, 1]], ytArter: [[0, 4], [1, 3], [4, 2]], tri: 62000 - trianglar(egen) / KVAL, torr: 0.2 }));   // (sprid gångrar med KVAL; grannarnas tomter syns knappt i diset)
  }
  const segAv = (x, z, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)); return Math.hypot(x - ax - ex * t, z - az - ez * t); };

  function slumpFro(fro) { let s = fro >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const trianglar = poster => poster.reduce((s, p) => s + TRI[p.typ], 0);
  return { grupp, tradgard, skog, kust, villa, trianglar };
}
