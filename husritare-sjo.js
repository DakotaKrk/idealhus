// husritare-sjo.js – miljön "Vid sjön": vattnet (vågor, spegling, djup, skum), skärgårdsholmarna och sjötomtens
// detaljer (sjöbod, kanot, eldstad, blommor, båtar, fåglar …). Importeras av husritare-miljo.js.
//
// API: skapaSjo(THREE, K) med K = { VU, VY, KUST, kustQ, hy, fbm, slump, renderer, GLITTER, OAR }
//   sjo.vattenMat()          material till vattennätet (MeshStandardMaterial + egen skuggare)
//   sjo.vattenKrok(mesh)     spegling i realtid (bara på datorer med vettig grafik) via mesh.onBeforeRender
//   sjo.fjarr(r, o)          { grupper: [...], tallar } – holmar, tallar, motstranden, prick, segelbåt, änder (byggs en gång)
//   sjo.nara(mal, b, krav, kant) → [Object3D] – sjöbod, kanot, eldstad, stolar, blommor, stenmur … (byggs per hus)
//   sjo.spegla(obj)          lägg ett objekt i speglingens lager
// Allt som rör sig gör det i vertexskuggaren (VU.uTid, VU.uVind); inget räknas på processorn per bild.

import { ph, phInit } from './husritare-ph.js?v=20261126r';   // Poly Haven-rekvisita (CC0): sjömärken, boj, flytväst, stövlar, tunna, lådor, eldstad, yxa …
import { blommor } from './husritare-blommor.js?v=20261126r';   // riktiga lupiner vid stranden

export function skapaSjo(THREE, K) {
  const { VU, VY, KUST, kustQ, hy, fbm, slump, renderer } = K;
  phInit({ VU, renderer });
  const C = h => new THREE.Color(h);
  const mjuk = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const LAGER = 6;                                   // speglingens lager
  const SVAG = (() => { try { return /[?&]spegel=0/.test(location.search) || (!/[?&]foto=1/.test(location.search) && (matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 760)); } catch (e) { return true; } })();
  const AV = (() => { try { return /[?&]sjo=0/.test(location.search); } catch (e) { return false; } })();   // ?sjo=0: utan sjöns tillägg (för jämförelser)
  const spegla = o => { if (o) o.traverse(c => c.layers.enable(LAGER)); return o; };

  // ---- texturer ----
  // sömlöst värdebrus (fyra kanaler med olika frön), 256², för korn, lav, skum och vindbyar
  const hsh = (i, j, k) => { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const tb = (x, y, P, k) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const w = a => ((a % P) + P) % P, a = hsh(w(xi), w(yi), k), b = hsh(w(xi + 1), w(yi), k), c = hsh(w(xi), w(yi + 1), k), d = hsh(w(xi + 1), w(yi + 1), k);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const tf = (u, v, P, okt, k) => { let s = 0, a = 0.5, n = 0, p = P; for (let i = 0; i < okt; i++) { s += a * tb(u * p, v * p, p, k + i * 17); n += a; a *= 0.5; p *= 2; } return s / n; };
  // Stegvisa jobb: de tunga bitarna (texturer, holmar, stugor) är generatorer som kan köras i små steg i ledig tid
  // (forberedG/fjarrG, styrs av miljöns stegvisa bygge) eller i ett svep när de behövs direkt (kor). Samma resultat.
  const JOBB = {};
  const jobb = (k, G) => JOBB[k] || (JOBB[k] = { g: G(), klar: false, v: undefined });
  const kor = J => { while (!J.klar) { const st = J.g.next(); if (st.done) { J.klar = true; J.v = st.value; } } return J.v; };
  function* stega(J) { while (!J.klar) { const st = J.g.next(); if (st.done) { J.klar = true; J.v = st.value; } else yield; } return J.v; }
  const korG = g => { let st; while (!(st = g.next()).done); return st.value; };
  let BRUS = null;
  const brusG = function* () {
    const n = 256, d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) { if (!(y & 7)) yield; for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n, i = (y * n + x) * 4;
      d[i] = tf(u, v, 4, 5, 11) * 255; d[i + 1] = tf(u, v, 8, 4, 23) * 255; d[i + 2] = tf(u, v, 16, 3, 37) * 255; d[i + 3] = tf(u, v, 6, 4, 51) * 255;
    } }
    // kontrasten sträcks (fbm samlas kring 0,5)
    for (let i = 0; i < d.length; i++) d[i] = Math.max(0, Math.min(255, (d[i] - 128) * 1.9 + 128));
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  const brus = () => BRUS || (BRUS = kor(jobb('brus', brusG)));
  // vågkarta: summa av riktade sinusvågor med heltalsvågtal (sömlös), mest med vinden; rg = lutning, b = höjd
  let VAG = null;
  const vagG = function* () {
    const n = 256, r = slump(77), V = [];
    for (let i = 0; i < 48; i++) {
      const L = 2 + Math.pow(r(), 1.6) * 30, th = (r() - 0.5) * 2.2 + (r() < 0.2 ? Math.PI : 0);
      const kx = Math.round(L * Math.cos(th)), ky = Math.round(L * Math.sin(th));
      if (!kx && !ky) continue;
      V.push([kx, ky, Math.pow(Math.hypot(kx, ky), -1.25), r() * 6.283]);
    }
    const sx = new Float32Array(n * n), sy = new Float32Array(n * n), h = new Float32Array(n * n);
    let mx = 1e-6, mh = 1e-6;
    for (let y = 0; y < n; y++) { if (!(y & 7)) yield; for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n, i = y * n + x; let a = 0, b = 0, c = 0;
      for (const [kx, ky, A, f] of V) { const ph = 6.2832 * (kx * u + ky * v) + f, cs = Math.cos(ph); a += A * kx * cs; b += A * ky * cs; c += A * Math.sin(ph); }
      sx[i] = a; sy[i] = b; h[i] = c; mx = Math.max(mx, Math.abs(a), Math.abs(b)); mh = Math.max(mh, Math.abs(c));
    } }
    const d = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { d[i * 4] = 128 + 127 * sx[i] / mx; d[i * 4 + 1] = 128 + 127 * sy[i] / mx; d[i * 4 + 2] = 128 + 127 * h[i] / mh; d[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  const vagTex = () => VAG || (VAG = kor(jobb('vag', vagG)));

  // ---- holmarnas form (finare än marknätet) ----
  // Varje skär i OAR (husritare-miljo.js) får ett eget, tätt nät ovanpå marken: rundslipade granitryggar i
  // inlandsisens riktning, avsatser och svackor. Höjden ligger alltid över det grova marknätet (som syns annars).
  const OAR = K.OAR;
  const IS = [0.93, 0.37];                            // isens riktning (ryggarna löper längs den)
  const relief = (x, z) => {
    const a = x * IS[0] + z * IS[1], b = -x * IS[1] + z * IS[0];
    const rygg = fbm(a * 0.09 + 3, b * 0.32 + 1, 3);                       // långa, rundade ryggar
    const knol = fbm(x * 0.45 + 7, z * 0.45 - 2, 2);
    const avs = Math.abs(fbm(a * 0.05 + 11, b * 0.05, 2) * 6 % 1 - 0.5);   // avsatser (bankning i graniten)
    const val = mjuk(0.42, 0.78, fbm(a * 0.16 + 5, b * 0.42 - 3, 2)) * 0.28;   // (flackare: inga degbulor)  // rundhällar: kupiga valryggar på ryggarna
    // (slipat: små knölar och avsatser svaga, så att hällen blir stora sammanhängande rundade former)
    return Math.max(0, (rygg - 0.36) * 2.1) + val + (knol - 0.5) * 0.06 + mjuk(0.05, 0.12, avs) * 0.1 - skara(x, z) * 0.14;
  };
  // sprickor (diaklaser) i två riktningar, 0…1: smala skåror som delar hällen i rundade block
  function skara(x, z) {
    const a = x * IS[0] + z * IS[1], b = -x * IS[1] + z * IS[0];
    return Math.max(1 - mjuk(0, 0.028, Math.abs(fbm(a * 0.07 + 21, b * 0.2, 2) - 0.5)), (1 - mjuk(0, 0.024, Math.abs(fbm(a * 0.22 - 4, b * 0.06 + 8, 2) - 0.5))) * 0.8);
  }
  // det grova marknätets höjd i (x, z), exakt som markGeo bygger det (ringar, förskjutna sektorer)
  const RMAX = 230, RINGAR = 46, SEKT = 84, mh = new Map();
  const mv = (i, j) => { j = ((j % SEKT) + SEKT) % SEKT; const k = i * 1000 + j; let v = mh.get(k); if (v === undefined) { const rr = RMAX * Math.pow(i / RINGAR, 2.2), a = (j + (i % 2) * 0.5) / SEKT * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr; v = [x, hy(x, z), z]; mh.set(k, v); } return v; };
  const grov = (x, z) => {
    const r = Math.hypot(x, z), t = RINGAR * Math.pow(r / RMAX, 1 / 2.2), i = Math.max(1, Math.min(RINGAR - 1, Math.floor(t)));
    let ang = Math.atan2(z, x); if (ang < 0) ang += Math.PI * 2;
    const jc = Math.floor(ang / (Math.PI * 2) * SEKT);
    for (let j = jc - 2; j <= jc + 1; j++) {
      for (const T of [[mv(i, j), mv(i, j + 1), mv(i + 1, j)], [mv(i, j + 1), mv(i + 1, j + 1), mv(i + 1, j)]]) {
        const [A, B, Cc] = T, d = (B[2] - Cc[2]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[2] - Cc[2]);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((B[2] - Cc[2]) * (x - Cc[0]) + (Cc[0] - B[0]) * (z - Cc[2])) / d, l2 = ((Cc[2] - A[2]) * (x - Cc[0]) + (A[0] - Cc[0]) * (z - Cc[2])) / d, l3 = 1 - l1 - l2;
        if (l1 >= -1e-4 && l2 >= -1e-4 && l3 >= -1e-4) return l1 * A[1] + l2 * B[1] + l3 * Cc[1];
      }
    }
    return hy(x, z);
  };
  // holmens yta: den fina höjden plus ryggarna, aldrig under det grova nätet
  const holmH = (x, z) => {
    const h = hy(x, z), ov = h - VY;
    if (ov < -1.2) return h;
    const rel = relief(x, z) * mjuk(-0.6, 0.6, ov);
    return Math.max(h + rel + 0.05, grov(x, z) + 0.06);
  };
  // kobbar: små rundade stenrygg-skär (bara sten och en fågel), egna former i djupt vatten
  const QL = (q, l) => [q * KUST[0] - l * KUST[1], q * KUST[1] + l * KUST[0]];   // (avstånd ut, längs stranden) → (x, z)
  const KOBBAR = [[62, 22, 2.6, 1.05, 0.6], [80, -28, 3.4, 1.3, 1.9], [44, -10, 1.7, 0.75, 2.6]].map(([q, l, ...v]) => [...QL(q, l), ...v]);
  let kobbH = (x, z) => {
    let best = -99;
    for (const [kx, kz, kr, kh, rot] of KOBBAR) {
      const c = Math.cos(rot), s = Math.sin(rot), a = ((x - kx) * c + (z - kz) * s) / kr, b = (-(x - kx) * s + (z - kz) * c) / (kr * 0.6);
      // isslipad valrygg: flack och rundad, mjuk sluttning åt ena hållet och brantare (plockad) ände åt det andra
      // (flikig kontur ur bruset, flack topp med sprickor och avsatser: inte en slät kupol)
      const as = a > 0 ? a * 1.35 : a * 0.85, d2 = (as * as + b * b) / (0.7 + 0.6 * fbm(x * 0.4 + kx, z * 0.4 + kz, 2)); if (d2 > 2.6) continue;
      const t = Math.max(0, 1 - d2 / 1.9);
      best = Math.max(best, VY - 0.6 + (kh * 0.55 + 0.6) * mjuk(0, 0.75, t) * (0.8 + 0.4 * fbm(x * 0.5, z * 0.5 + 4, 2)) + relief(x, z) * 0.45 * mjuk(0.1, 0.5, t) - skara(x, z) * 0.12);
    }
    return best;
  };
  // ytans höjd för vattnets djupkarta: holmarna och kobbarna som de ritas
  const ytaH = (x, z) => {
    let h = hy(x, z);
    if (h > VY - 1.2) for (const [ox, oz, orr] of OAR) if ((x - ox) ** 2 + (z - oz) ** 2 < (orr * 2.4) ** 2) { h = holmH(x, z); break; }
    return Math.max(h, kobbH(x, z));
  };

  // ---- vattnets djupkarta: r = djup (−2…6 m), g = skum runt stolpar, stenar och båtar ----
  const BOX = [-215, -235, 270];                      // x0, z0, sida (m): hela sjön framför tomten
  const DN = 512;
  let DJUP = null;
  const hinder = [];                                  // [x, z, radie] – stämplas in i g-kanalen
  function djupTex() {
    if (!DJUP) kor(jobb('djup', djupG));
    return DJUP;
  }
  function* djupG() {
    const d = new Uint8Array(DN * DN * 4), st = BOX[2] / DN;
    for (let j = 0; j < DN; j++) for (let i = 0; i < DN; i++) {
      if (!(i & 127)) yield;
      const x = BOX[0] + (i + 0.5) * st, z = BOX[1] + (j + 0.5) * st, k = (j * DN + i) * 4;
      // långt ute (stort q) är det djupt utom vid holmar/kobbar: hoppa över den dyra höjden där
      const q = x * KUST[0] + z * KUST[1];
      let h;
      if (q > 40 && q < 100 && !OAR.some(([ox, oz, orr]) => (x - ox) ** 2 + (z - oz) ** 2 < (orr * 2.2) ** 2) && !KOBBAR.some(([kx, kz, kr]) => (x - kx) ** 2 + (z - kz) ** 2 < (kr * 1.6) ** 2)) h = VY - 6;
      else h = ytaH(x, z);
      d[k] = Math.max(0, Math.min(255, (VY - h + 2) / 8 * 255)); d[k + 3] = 255;
    }
    DJUP = new THREE.DataTexture(d, DN, DN, THREE.RGBAFormat);
    DJUP.magFilter = THREE.LinearFilter; DJUP.minFilter = THREE.LinearFilter; DJUP.needsUpdate = true;
    stampla();
  }
  // sjöns texturer i förväg, i små steg (miljöns stegvisa bygge)
  function* forberedG() {
    if (AV) return;
    if (!BRUS) BRUS = yield* stega(jobb('brus', brusG));
    if (!VAG) VAG = yield* stega(jobb('vag', vagG));
    if (!DJUP) yield* stega(jobb('djup', djupG));
  }
  function stampla() {
    if (!DJUP) return;
    const d = DJUP.image.data, st = BOX[2] / DN;
    for (const [x, z, rr] of hinder) {
      const R = rr + 1.4, i0 = Math.floor((x - R - BOX[0]) / st), i1 = Math.ceil((x + R - BOX[0]) / st), j0 = Math.floor((z - R - BOX[1]) / st), j1 = Math.ceil((z + R - BOX[1]) / st);
      for (let j = Math.max(0, j0); j <= Math.min(DN - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(DN - 1, i1); i++) {
        const px = BOX[0] + (i + 0.5) * st, pz = BOX[1] + (j + 0.5) * st, dd = Math.hypot(px - x, pz - z), v = 1 - mjuk(rr, R, dd), k = (j * DN + i) * 4 + 1;
        d[k] = Math.max(d[k], v * 255);
      }
    }
    DJUP.needsUpdate = true;
  }
  const lagHinder = (lista) => { hinder.push(...lista); stampla(); };

  // ---- vattnets material ----
  const RU = { uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflPa: { value: 0 } };
  // livet på vattnet (fylls i av fjarr): hoppande fiskar (x, z, fas, period) ger ringar och stänk, svanar och
  // andflocken (x, z, fas, radie: samma bana som tingskuggarens typ 2) ger kölvatten
  const NF = 6, NS = 4;
  const LIVU = { uFisk: { value: Array.from({ length: NF }, () => new THREE.Vector4(0, 0, 0, 0)) }, uSvan: { value: Array.from({ length: NS }, () => new THREE.Vector4(0, 0, 0, 0)) } };   // w = 0: tom plats
  try { if (/[?&]prov=1/.test(location.search)) window.__sjoLiv = { LIVU, VU }; } catch (e) { /* utan fönster */ }   // för provbilder
  function vattenMat() {
    const v = new THREE.MeshStandardMaterial({ color: C('#1c4550'), roughness: 0.06, metalness: 0, envMapIntensity: 1, side: THREE.DoubleSide });
    v.onBeforeCompile = s => {
      Object.assign(s.uniforms, RU, LIVU, {
        uTid: VU.uTid, uNatt: VU.uNatt, uSol: VU.uSol, uGlitter: K.GLITTER, uVind: VU.uVind,
        uVag2: { value: vagTex() }, uBrusS: { value: brus() }, uDjup: { value: djupTex() }, uBox: { value: new THREE.Vector3(BOX[0], BOX[1], 1 / BOX[2]) },
      });
      s.vertexShader = 'attribute float aDjup;\nvarying float vDjup;\nvarying vec3 vWP;\nuniform mat4 uReflMat;\nvarying vec4 vRefl;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vDjup = aDjup; vWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vRefl = uReflMat * vec4( vWP, 1.0 );`);
      s.fragmentShader = `uniform float uTid;\nuniform float uNatt;\nuniform vec3 uSol;\nuniform vec3 uGlitter;\nuniform vec2 uVind;
        uniform sampler2D uVag2;\nuniform sampler2D uBrusS;\nuniform sampler2D uDjup;\nuniform vec3 uBox;
        uniform sampler2D uRefl;\nuniform float uReflPa;\nvarying vec4 vRefl;\nvarying float vDjup;\nvarying vec3 vWP;\nuniform vec4 uFisk[${NF}];\nuniform vec4 uSvan[${NS}];\n` + s.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 p = vWP.xz;
          float djup = vDjup, hind = 0.0;
          { vec2 tu = ( p - uBox.xy ) * uBox.z;
            if ( tu.x > 0.002 && tu.y > 0.002 && tu.x < 0.998 && tu.y < 0.998 ) { vec4 dt = texture2D( uDjup, tu ); djup = dt.r * 8.0 - 2.0; hind = dt.g; } }
          float av = distance( vWP, cameraPosition );
          // oregelbunden vattenlinje (småsten och svackor), skuret mot djupkartan
          float jag = ( texture2D( uBrusS, p * 0.23 ).r - 0.5 ) * 0.16 + ( texture2D( uBrusS, p * 1.1 ).b - 0.5 ) * 0.06;
          if ( djup + jag < 0.0 ) discard;
          // vågor i fyra skalor som driver åt olika håll: lång dyning, vindvågor, krusningar och (bara nära) fina krusningar.
          // Mipmapparna jämnar ut lutningen på avstånd, så ytan blir en lugn spegel mot horisonten. Vindbyarna är stora och svaga.
          float vs = 0.45 + 0.55 * clamp( length( uVind ), 0.0, 1.2 );
          float nara = 1.0 / ( 1.0 + av * 0.035 );
          float fin = smoothstep( 40.0, 5.0, av );
          vec2 s0 = mat2( 0.6, 0.8, -0.8, 0.6 ) * ( texture2D( uVag2, mat2( 0.6, -0.8, 0.8, 0.6 ) * p / 36.0 + uTid * vec2( 0.0055, -0.0085 ) ).rg * 2.0 - 1.0 );
          vec2 s1 = texture2D( uVag2, p / 8.5 + uTid * vec2( 0.026, 0.014 ) ).rg * 2.0 - 1.0;
          vec2 s2 = mat2( 0.8, 0.6, -0.6, 0.8 ) * ( texture2D( uVag2, mat2( 0.8, -0.6, 0.6, 0.8 ) * p / 2.9 + uTid * vec2( -0.042, 0.057 ) ).rg * 2.0 - 1.0 );
          vec2 s3 = mat2( 0.28, 0.96, -0.96, 0.28 ) * ( texture2D( uVag2, mat2( 0.28, -0.96, 0.96, 0.28 ) * p / 0.95 + uTid * vec2( 0.075, 0.048 ) ).rg * 2.0 - 1.0 );
          float by = smoothstep( 0.2, 0.85, texture2D( uBrusS, p / 150.0 + uTid * vec2( 0.0028, 0.0018 ) ).r );
          vec2 sl = ( s0 * 0.45 + s1 * 0.55 + s2 * 0.42 * nara + s3 * 0.3 * fin ) * ( 0.7 + 0.45 * by ) * 0.17 * vs;
          sl *= 0.3 + 0.7 * smoothstep( 0.0, 1.4, djup );     // lugnare i det grunda
          // speglingen förskjuts bara av de längre vågorna: krusningarna nära kameran gav ett prickigt rutmönster i den
          vec2 slR = ( s0 * 0.45 + s1 * 0.55 + s2 * 0.1 * nara ) * ( 0.7 + 0.45 * by ) * 0.17 * vs * ( 0.3 + 0.7 * smoothstep( 0.0, 1.4, djup ) );
          // fiskhopp: ringar som sprider sig från uppsticket och nedslaget, ett stänk vid nedslaget
          float stank = 0.0;
          for ( int i = 0; i < ${NF}; i++ ) {
            vec4 f = uFisk[ i ]; if ( f.w < 1.0 ) continue;
            float t = mod( uTid + f.z, f.w ), hd = f.z * 2.7; vec2 dir = vec2( cos( hd ), sin( hd ) );
            if ( t > 6.5 || dot( p - f.xy, p - f.xy ) > 40.0 ) continue;
            for ( int k = 0; k < 2; k++ ) {
              float a = t - float( k ) * 0.8; if ( a < 0.0 ) continue;
              vec2 dv = p - f.xy - dir * 0.7 * float( k ); float d = length( dv ) + 1e-4, rr = 0.12 + a * 0.7;
              float e = exp( -a * 0.75 ) * exp( -( d - rr ) * ( d - rr ) * 9.0 ) * ( 0.6 + 0.4 * float( k ) );
              vec2 rv = dv / d * cos( ( d - rr ) * 19.0 ) * e * 0.4; sl += rv; slR += rv * 0.6;
              stank += exp( -a * 4.0 ) * smoothstep( 0.45, 0.05, d ) * float( k );
            }
          }
          // kölvatten: ett V bakom svanarna och änderna (vinkeln ~20°), som klingar av bakåt
          for ( int i = 0; i < ${NS}; i++ ) {
            vec4 sv = uSvan[ i ]; if ( sv.w < 0.5 ) continue;
            float a = sv.z + uTid * ( sv.w > 12.0 ? 0.55 : 0.14 ) / sv.w;
            vec2 c = sv.xy + sv.w * vec2( cos( a ), sin( a ) ), fw = vec2( -sin( a ), cos( a ) ), sd = vec2( -fw.y, fw.x ), dv = p - c;
            float bak = -dot( dv, fw ), tv = dot( dv, sd );
            if ( bak < -0.4 || bak > 12.0 || abs( tv ) > 5.0 ) continue;
            float v = abs( tv ) - max( bak, 0.0 ) * 0.36, w = exp( -v * v * 5.0 ) * exp( -max( bak, 0.0 ) * 0.25 ) * smoothstep( -0.4, 0.3, bak );
            vec2 rv = sd * sign( tv ) * sin( v * 16.0 - uTid * 2.5 ) * w * 0.22; sl += rv; slR += rv * 0.6;
          }
          vec3 nW = normalize( vec3( -sl.x, 1.0, -sl.y ) );
          vec3 Vw = normalize( cameraPosition - vWP );
          // fresnel med en dämpad normal: annars blir ytan prickig (fresnel är mycket känslig i flack vinkel)
          vec3 nF = normalize( vec3( -sl.x * 0.4, 1.0, -sl.y * 0.4 ) );
          float cv = clamp( dot( nF, Vw ), 0.0, 1.0 );
          float Fr = 0.02 + 0.98 * pow( 1.0 - cv, 5.0 );
          // vattnets kropp: rött släcks först, sedan blått (grönbrun skärgårdsvik); botten skymtar i det grunda
          // (sand, grus, mörka tångfläckar, ljusnät från vågorna), djupt blir det mörkt blågrönt-grått
          float dp = max( djup, 0.0 );
          vec3 ext = exp( -dp * vec3( 1.8, 1.15, 1.6 ) );
          vec3 bot = vec3( 0.44, 0.39, 0.29 ) * ( 0.72 + 0.5 * texture2D( uBrusS, p / 1.3 ).g );
          bot = mix( bot, vec3( 0.34, 0.32, 0.28 ), smoothstep( 0.5, 0.7, texture2D( uBrusS, p / 0.45 ).r ) * 0.6 );                     // småsten
          float tg = texture2D( uBrusS, p / 7.0 ).b * 0.65 + texture2D( uBrusS, p / 1.7 ).r * 0.35;
          bot = mix( bot, vec3( 0.2, 0.23, 0.12 ), smoothstep( 0.52, 0.72, tg ) * smoothstep( 0.1, 0.6, dp ) * 0.45 );                   // tång och dy
          float ka = texture2D( uBrusS, p / 0.8 + sl * 1.6 + uTid * vec2( 0.018, 0.012 ) ).a;
          bot *= 0.84 + 0.42 * smoothstep( 0.5, 0.72, ka ) * ( 1.0 - smoothstep( 0.3, 1.4, dp ) );                                        // ljusnät på botten
          vec3 kropp = mix( vec3( 0.017, 0.04, 0.047 ), bot * vec3( 0.52, 0.6, 0.46 ), ext );
          kropp = mix( kropp, kropp * vec3( 0.9, 1.0, 1.05 ), by * 0.3 );
          // vågornas skuggning i himmelsljuset: sett uppifrån syns krusningarna som ljusare och mörkare sidor
          kropp *= 1.0 + clamp( dot( sl, vec2( 0.62, -0.78 ) ) * 3.0, -0.3, 0.3 ) * ( 1.0 - smoothstep( 0.5, 0.95, 1.0 - cv ) );
          kropp *= 1.0 - 0.75 * uNatt;
          // skum: en smal, trasig rand mot stranden som andas med svallet, och kring stolpar, stenar och båtar
          float sv = texture2D( uBrusS, p * 0.9 + uTid * vec2( 0.03, -0.02 ) ).g;
          float kant = djup + jag;
          float rand = 1.0 - smoothstep( 0.0, 0.035 + 0.03 * ( 0.5 + 0.5 * sin( uTid * 1.1 + p.x * 0.6 + p.y * 0.4 ) ), kant );
          float skum = rand * smoothstep( 0.4, 0.68, sv + 0.3 * rand ) * 0.75;   // (inget skum kring stolpar och båtar: djupkartans grova rutor gav ett prickigt fält, och sjön är lugn)          skum = clamp( skum, 0.0, 1.0 ) * ( 1.0 - 0.8 * uNatt ) * smoothstep( 90.0, 30.0, av );
          // strandkanten: det tunna vattnet visar botten nästan rakt igenom och speglar mindre, så kanten smälter ihop med stranden
          Fr *= 0.3 + 0.7 * smoothstep( 0.0, 0.16, kant );
          skum = max( skum, clamp( stank, 0.0, 1.0 ) * 0.85 * smoothstep( 0.35, 0.7, sv + 0.3 ) );   // fiskens stänk
          diffuseColor.rgb = mix( kropp * ( 1.0 - Fr ), vec3( 0.74, 0.76, 0.74 ), skum );
          float glans = 1.0 - skum;
          // speglingsbildens kanter: där spegelstrålen går utanför bilden (nära kameran) tar himlen ur omgivningen över
          vec2 ru0 = vRefl.xy / vRefl.w;
          float rKant = smoothstep( 1.02, 0.9, ru0.y ) * smoothstep( 0.62, 0.3, Vw.y );   // (brant uppåt räcker inte speglingsbilden: himlakupolen tar slut, en vågrät kant syntes)`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { // solens glitterväg: skarpa blänk där vågornas normaler speglar solen
            vec3 sd = normalize( ( viewMatrix * vec4( uSol, 0.0 ) ).xyz ), rf = reflect( -normalize( vViewPosition ), normal );
            float k = max( dot( rf, sd ), 0.0 );
            totalEmissiveRadiance += uGlitter * ( pow( k, 900.0 ) * 9.0 + pow( k, 220.0 ) * 1.1 + pow( k, 60.0 ) * 0.18 ) * glans;
            if ( uReflPa > 0.5 ) reflectedLight.indirectSpecular *= ( 1.0 - rKant ) * glans;
            else reflectedLight.indirectSpecular *= glans;
          }`)
        .replace('#include <opaque_fragment>', `
          if ( uReflPa > 0.5 ) {
            // speglingen: himlen, holmarna och strandträden, förskjuten av vågorna
            // (förskjutningen i skärmens led: små vågor darrar speglingen i sidled, dyningen drar ut den på höjden)
            vec2 sv2 = ( viewMatrix * vec4( slR.x, 0.0, slR.y, 0.0 ) ).xy;
            vec2 ru = vRefl.xy / vRefl.w + vec2( sv2.x * 0.7, sv2.y * 0.35 + ( slR.x + slR.y ) * 0.12 ) * ( 0.035 + 0.05 * nara );
            vec3 rf = texture2D( uRefl, clamp( ru, vec2( 0.001 ), vec2( 0.999 ) ) ).rgb;
            outgoingLight += rf * Fr * glans * 0.9 * rKant;
          }
          #include <opaque_fragment>`);
    };
    v.customProgramCacheKey = () => 'sjo-vatten';
    return v;
  }

  // ---- speglingen: scenens speglingslager ritas från en kamera under vattnet (halv upplösning) ----
  const RK = new THREE.PerspectiveCamera(), rt = { t: null };
  const plan = new THREE.Plane(), N0 = new THREE.Vector3(0, 1, 0), P0 = new THREE.Vector3(), kp = new THREE.Vector3(), rm = new THREE.Matrix4(), la = new THREE.Vector3(), mal = new THREE.Vector3(), vy = new THREE.Vector3(), cp = new THREE.Vector4(), q4 = new THREE.Vector4(), stl = new THREE.Vector2();
  const NAMN = new Set(['himmel', 'mark', 'impostortrad', 'brygga']);
  let ritar = false, raknare = 0;
  const SK = { kam: new THREE.Matrix4(), proj: new THREE.Matrix4(), tid: -1, n: 0, ok: false };   // senaste speglingens kamera (se vattenKrok)
  const nyttMal = (B, H) => new THREE.WebGLRenderTarget(B, H, { type: THREE.HalfFloatType, samples: 0 });
  // speglingens egna program (bild till ett mål: ingen tonmappning, linjär färg – andra nycklar än huvudbilden)
  // kompileras parallellt i förväg för nya nät som syns i speglingen (anropas av miljöns varma, utanför ritningen)
  function forvarm(nya, scene) {
    if (SVAG || AV) return;
    const L = nya.filter(o => o.layers.isEnabled(LAGER) || o.userData.spegla || NAMN.has(o.name));
    if (!L.length) return;
    if (!rt.t) rt.t = nyttMal(64, 64);
    RK.layers.set(LAGER);
    scene.traverse(o => { if (o.isLight) o.layers.enable(LAGER); });   // ljusen räknas som i speglingen (annars nycklar utan ljus)
    const forra = renderer.getRenderTarget();
    renderer.setRenderTarget(rt.t);
    try { renderer.compile({ traverse: f => L.forEach(f), traverseVisible: () => {} }, RK, scene); } finally { renderer.setRenderTarget(forra); }
  }
  function vattenKrok(mesh) {
    if (SVAG || AV) return mesh;
    RK.layers.set(LAGER);
    mesh.onBeforeRender = (rend, scene, cam) => {
      if (ritar || !cam.isPerspectiveCamera) return;
      P0.set(0, VY, 0); kp.setFromMatrixPosition(cam.matrixWorld);
      if (kp.y < VY + 0.05) { RU.uReflPa.value = 0; return; }
      // lagret: himlen, marken, träden och lamporna (ljusen testas mot kamerans lager); en gång per sekund räcker
      if ((raknare++ % 30) === 0) scene.traverse(o => { if ((o.isLight || NAMN.has(o.name) || o.userData.spegla) && o.layers.mask !== 0) o.layers.enable(LAGER); });   // (mask 0: väntar på sitt program, se miljöns varma)
      rend.getDrawingBufferSize(stl);
      const B = Math.max(64, Math.round(stl.x * 0.5)), H = Math.max(64, Math.round(stl.y * 0.5));
      if (!rt.t) rt.t = nyttMal(B, H);
      else if (rt.t.width !== B || rt.t.height !== H) { rt.t.setSize(B, H); SK.ok = false; }
      // stilla kamera medan livet rör sig (bilden ritas om varje ruta för vågornas skull): speglingen ritas om
      // varannan ruta (vågorna förvränger den ändå; allt som är nytt syns senast nästa ruta). Rör sig kameran,
      // står tiden still eller har något annat ändrats ritas den direkt
      const stilla = SK.ok && SK.kam.equals(cam.matrixWorld) && SK.proj.equals(cam.projectionMatrix), tidGar = VU.uTid.value !== SK.tid;
      SK.tid = VU.uTid.value;
      if (stilla && tidGar && (SK.n++ & 1)) { RU.uRefl.value = rt.t.texture; RU.uReflPa.value = 1; return; }
      SK.kam.copy(cam.matrixWorld); SK.proj.copy(cam.projectionMatrix); SK.ok = true;
      // spegelkameran (som three/Reflector): spegla läget och blickriktningen i vattenytan, sned närplan i ytan
      vy.subVectors(P0, kp); vy.reflect(N0).negate(); vy.add(P0);
      rm.extractRotation(cam.matrixWorld);
      la.set(0, 0, -1).applyMatrix4(rm).add(kp);
      mal.subVectors(P0, la); mal.reflect(N0).negate(); mal.add(P0);
      RK.position.copy(vy); RK.up.set(0, 1, 0).applyMatrix4(rm).reflect(N0); RK.lookAt(mal);
      RK.far = cam.far; RK.near = cam.near; RK.updateMatrixWorld(); RK.projectionMatrix.copy(cam.projectionMatrix);
      RU.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(RK.projectionMatrix).multiply(RK.matrixWorldInverse);
      plan.setFromNormalAndCoplanarPoint(N0, P0).applyMatrix4(RK.matrixWorldInverse);
      cp.set(plan.normal.x, plan.normal.y, plan.normal.z, plan.constant);
      const pm = RK.projectionMatrix, e = pm.elements;
      q4.x = (Math.sign(cp.x) + e[8]) / e[0]; q4.y = (Math.sign(cp.y) + e[9]) / e[5]; q4.z = -1; q4.w = (1 + e[10]) / e[14];
      cp.multiplyScalar(2 / cp.dot(q4));
      e[2] = cp.x; e[6] = cp.y; e[10] = cp.z + 1; e[14] = cp.w;
      const forra = rend.getRenderTarget(), au = rend.shadowMap.autoUpdate, nu = rend.shadowMap.needsUpdate, ar = rend.info.autoReset, xr = rend.xr.enabled;
      ritar = true; mesh.visible = false;
      rend.shadowMap.autoUpdate = false; rend.shadowMap.needsUpdate = false; rend.info.autoReset = false; rend.xr.enabled = false;
      try {
        rend.setRenderTarget(rt.t); rend.state.buffers.depth.setMask(true);
        if (rend.autoClear === false) rend.clear();
        rend.render(scene, RK);
      } finally {
        rend.setRenderTarget(forra); rend.shadowMap.autoUpdate = au; rend.shadowMap.needsUpdate = nu; rend.info.autoReset = ar; rend.xr.enabled = xr;
        ritar = false; mesh.visible = true;
        const vp = cam.viewport; if (vp !== undefined) rend.state.viewport(vp);
      }
      RU.uRefl.value = rt.t.texture; RU.uReflPa.value = 1;
    };
    return mesh;
  }

  // ---- byggare: sammanslagna nät med hörnfärg, vind (aVaj) och rörelse (aAnim) ----
  // aAnim = (x, z, fas, typ): typ 1 guppar kring (x, z); 2 + R/1000 åker runt (x, z) med radien R (byggd kring origo,
  // fören mot +z); 3 svävar kring (x, z) (trollslända). aVaj = hur mycket vinden tar (0 vid foten).
  const GEO = {};
  const ickeIdx = g => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals(); return { p: n.attributes.position.array, n: n.attributes.normal.array }; };
  const bas = (namn, fn) => GEO[namn] || (GEO[namn] = ickeIdx(fn()));
  // knölig sfär (stenar, barrklumpar, buskar): mjuka normaler, deterministisk knölighet per variant
  const knol = (namn, fro, amp, ws = 8, hs = 6) => bas(namn, () => {
    const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amp * (fbm(x * 1.7 + fro, z * 1.7 + y * 1.3 - fro, 3) - 0.5) * 2; p.setXYZ(i, x * k, y * k, z * k); }
    g.computeVertexNormals(); return g;
  });
  const kant = (namn, fro) => bas(namn, () => {
    const g = new THREE.BoxGeometry(2, 2, 2, 5, 4, 5), p = g.attributes.position, rr = slump(fro), v = new THREE.Vector3();
    // rundad låda (superellips) som sedan hyvlas av 5–7 slumpade plan: flata sidor, mjuka kanter
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const l = Math.pow(Math.abs(v.x) ** 4 + Math.abs(v.y) ** 4 + Math.abs(v.z) ** 4, 0.25); v.multiplyScalar(1 / l); p.setXYZ(i, v.x, v.y, v.z); }
    const plan = []; for (let k = 0, n = 5 + (rr() * 3 | 0); k < n; k++) { const a = rr() * 6.283, b = (rr() - 0.3) * 1.4; plan.push([Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b), 0.62 + rr() * 0.25]); }
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); for (const [a, b, c, d] of plan) { const t = v.x * a + v.y * b + v.z * c; if (t > d) v.set(v.x - (t - d) * a, v.y - (t - d) * b, v.z - (t - d) * c); } p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  });
  const LADA = () => bas('lada', () => new THREE.BoxGeometry(1, 1, 1));
  const CYL = () => bas('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 7, 1, true).translate(0, 0.5, 0));
  const CYLS = () => bas('cylS', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1).translate(0, 0.5, 0));
  const KON = () => bas('kon', () => new THREE.ConeGeometry(1, 1, 6, 1, true).translate(0, 0.5, 0));
  const PLAN = () => bas('plan', () => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));
  const SKIVA = () => bas('skiva', () => new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2));
  const BLAD = () => bas('blad', () => new THREE.CircleGeometry(1, 9, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2));
  const KLOT = () => bas('klot', () => new THREE.SphereGeometry(1, 7, 5));
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), T3 = new THREE.Vector3();
  const M = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(T3.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S3.set(sx, sy, sz));
  const UPP = new THREE.Vector3(0, 1, 0), D3 = new THREE.Vector3();
  // en cylinder/kon från a till b (radie r)
  const MAB = (a, b, r, r2 = r) => { D3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const l = D3.length(); Q.setFromUnitVectors(UPP, D3.normalize()); return new THREE.Matrix4().compose(T3.set(a[0], a[1], a[2]), Q, S3.set(r, l, r2)); };
  // Ytstruktur i tingens skuggare (aTx = u, v, typ): 1 trä (fotot images/tex/brador-diff.webp, ådring längs brädans
  // längsta axel, en slumpad bräda ur fotot per bit), 4 målat trä (svagare), 3 ändträ (årsringar, ljusare ved),
  // 2 sten (sten-diff.webp triplanärt i världen). Sätts per byggavsnitt med TXT (eller o.tx per anrop).
  let TXT = 0;
  const hsh2 = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  function bygg() {
    const P = [], N = [], F = [], A = [], W = [], T = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
    const B = {
      add(g, m, farg, o = {}) {
        nm.getNormalMatrix(m);
        const an = o.anim || [0, 0, 0, 0], fn = typeof farg === 'function', typ = o.tx !== undefined ? o.tx : TXT;
        let tb = null;
        if (typ && typ !== 2) {
          const e = m.elements, s = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
          const mn = g.mn || (g.mn = [0, 1, 2].map(k => { let a = 1e9; for (let i = k; i < g.p.length; i += 3) a = Math.min(a, g.p[i]); return a; }));
          const mx = g.mx || (g.mx = [0, 1, 2].map(k => { let a = -1e9; for (let i = k; i < g.p.length; i += 3) a = Math.max(a, g.p[i]); return a; }));
          const d = s.map((sk, k) => sk * (mx[k] - mn[k])), L = d.indexOf(Math.max(...d)), h = hsh2(e[12] + e[13] * 0.37, e[14]);
          tb = { s, mn, mx, d, L, col: Math.floor(h * 5), voff: hsh2(e[14], e[12]) * 7 };   // en av fotots fem brädor
        }
        for (let i = 0; i < g.p.length; i += 3) {
          const lx = g.p[i], ly = g.p[i + 1], lz = g.p[i + 2];
          v.set(lx, ly, lz).applyMatrix4(m); const wx = v.x, wy = v.y, wz = v.z; P.push(wx, wy, wz);
          v.set(g.n[i], g.n[i + 1], g.n[i + 2]).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z);
          const f = fn ? farg(lx, ly, lz, v.x, v.y, v.z, wx, wy, wz) : farg;
          F.push(f[0] ** 2.2, f[1] ** 2.2, f[2] ** 2.2); A.push(an[0], an[1], an[2], an[3]); W.push(o.vaj ? o.vaj(lx, ly, lz, wy) : 0);
          if (!typ) T.push(0, 0, 0);
          else if (typ === 2) T.push(0, 0, 2);
          else {
            const lc = [lx, ly, lz], ln = [g.n[i], g.n[i + 1], g.n[i + 2]], { s, mn, mx, d, L } = tb, o1 = (L + 1) % 3, o2 = (L + 2) % 3;
            if ((typ === 1 || typ === 5) && Math.abs(ln[L]) > 0.7) T.push((lc[o1] - (mn[o1] + mx[o1]) / 2) * s[o1], (lc[o2] - (mn[o2] + mx[o2]) / 2) * s[o2], 3);   // ändträ
            else {
              const acr = Math.abs(ln[o1]) > 0.7 ? o2 : Math.abs(ln[o2]) > 0.7 ? o1 : (d[o1] >= d[o2] ? o1 : o2), q = (lc[acr] - mn[acr]) / Math.max(1e-6, mx[acr] - mn[acr]);
              T.push((tb.col + 0.1 + 0.8 * q) / 5, (lc[L] - mn[L]) * s[L] * 0.9 + tb.voff, typ);
            }
          }
        }
      },
      // råa trianglar (holmarnas nät): p, n, f som platta listor
      ra(p, n, f) { for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); F.push(f[i] ** 2.2); } for (let i = 0; i < p.length / 3; i++) { A.push(0, 0, 0, 0); W.push(0); T.push(0, 0, 0); } },
      get antal() { return P.length / 9; },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(F, 3)); g.setAttribute('aAnim', new THREE.Float32BufferAttribute(A, 4)); g.setAttribute('aVaj', new THREE.Float32BufferAttribute(W, 1));
        g.setAttribute('aTx', new THREE.Float32BufferAttribute(T, 3));
        g.computeBoundingSphere(); return g;
      },
    };
    return B;
  }
  const ANIM_V = `
    attribute vec4 aAnim;\nattribute float aVaj;\nuniform float uTid;\nuniform vec2 uVind;\nvarying vec3 vSW;\nvarying float vBarr;
    float sjoR( float w ) { return ( w - 2.0 ) * 1000.0; }
    float sjoA( vec4 an ) { float R = sjoR( an.w ); return an.z + uTid * ( R > 12.0 ? 0.55 : 0.14 ) / max( R, 0.5 ); }
`;
  const anim = s => {
    Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, uBrusS: { value: brus() } });
    s.vertexShader = ANIM_V + s.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        if ( aAnim.w > 1.5 && aAnim.w < 2.9 ) { float th = -sjoA( aAnim ), c = cos( th ), si = sin( th ); objectNormal.xz = vec2( objectNormal.x * c + objectNormal.z * si, -objectNormal.x * si + objectNormal.z * c ); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if ( aVaj > 0.0 ) {
          float f = position.x * 0.37 + position.z * 0.29, vs = length( uVind );
          transformed.xz += aVaj * ( uVind * ( 0.55 + 0.45 * sin( uTid * 1.3 + f ) ) + 0.3 * vec2( sin( uTid * 2.7 + f * 2.3 ), cos( uTid * 2.2 + f * 1.7 ) ) * ( 0.25 + vs ) );
        }
        float kk = aAnim.w;
        if ( kk > 0.5 && kk < 1.5 ) {
          vec2 d = position.xz - aAnim.xy; float b = sin( uTid * 1.15 + aAnim.z ), c = sin( uTid * 0.87 + aAnim.z * 1.7 );
          transformed.y += 0.035 * b + d.x * 0.028 * c - d.y * 0.022 * b;
        } else if ( kk > 1.5 && kk < 2.9 ) {
          float R = sjoR( kk ), a = sjoA( aAnim ), th = -a, c = cos( th ), si = sin( th );
          transformed.xz = aAnim.xy + R * vec2( cos( a ), sin( a ) ) + vec2( position.x * c + position.z * si, -position.x * si + position.z * c );
          transformed.y += 0.03 * sin( uTid * 1.3 + aAnim.z ) + 0.02 * position.z * sin( uTid * 0.9 + aAnim.z );
          if ( R < 12.0 && fract( aAnim.z * 0.37 ) > 0.45 ) {   // änderna dyker ibland (var 20:e–30:e sekund, ett par sekunder under ytan)
            float pd = 20.0 + 10.0 * fract( aAnim.z * 1.7 ), td = mod( uTid + aAnim.z * 13.0, pd );
            transformed.y -= 0.55 * smoothstep( 0.0, 0.5, td ) * ( 1.0 - smoothstep( 2.6, 3.2, td ) );
          }
        } else if ( kk > 4.5 ) {
          // fisk som hoppar: var P:e sekund en båge (0,8 s) upp ur vattnet och ner igen; annars under ytan (osynlig)
          float P = ( kk - 5.0 ) * 100.0, t = mod( uTid + aAnim.z, P ), u = t / 0.8, hd = aAnim.z * 2.7;
          vec2 dir = vec2( cos( hd ), sin( hd ) );
          float pitch = ( 1.0 - 2.0 * clamp( u, 0.0, 1.0 ) ) * 1.05, cp = cos( pitch ), sp = sin( pitch );
          vec3 lp = vec3( position.x * cp - position.y * sp, position.x * sp + position.y * cp, position.z );
          transformed.xz = aAnim.xy + dir * ( u * 0.7 + lp.x ) + vec2( -dir.y, dir.x ) * lp.z;
          transformed.y = ${VY.toFixed(3)} + lp.y + ( u < 1.0 ? 0.5 * 4.0 * u * ( 1.0 - u ) - 0.06 : -3.0 );
        } else if ( kk > 2.9 ) {
          float t = uTid * 0.8 + aAnim.z * 10.0;
          transformed.xz = aAnim.xy + position.xz + vec2( sin( t * 0.7 ) * 2.2 + sin( t * 2.3 ) * 0.5, cos( t * 0.53 ) * 1.8 + sin( t * 1.9 ) * 0.4 );
          transformed.y += 0.2 * sin( t * 1.7 ) + ( position.y - aAnim.z * 0.0 ) * 0.0;
        }
        vSW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vBarr = step( 0.2, kk ) * step( kk, 0.3 );`);
    s.fragmentShader = 'uniform sampler2D uBrusS;\nvarying vec3 vSW;\nvarying float vBarr;\n' + s.fragmentShader;
  };
  const MATS = {};
  // granit: hörnfärgen bär lav, mossa och våt rand; skuggaren lägger fältspatskorn och sprickor ovanpå
  const granitMat = () => MATS.granit || (MATS.granit = (() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    // fotograferad sten (samma som miljöns andra stenar): färg och normalkarta, lagda triplanart i världskoordinater
    const tl = new THREE.TextureLoader(), lad = (url, srgb) => tl.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; });
    const tSten = lad('images/tex/granit-diff.webp', true), tStenN = lad('images/tex/granit-nor.webp', false);   // Poly Haven mossy_rock (CC0), nor_gl
    [tSten, tStenN].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    tSten.colorSpace = THREE.SRGBColorSpace;
    m.onBeforeCompile = s => {
      anim(s);
      s.uniforms.tSten = { value: tSten }; s.uniforms.tStenN = { value: tStenN };
      s.fragmentShader = 'uniform sampler2D tSten;\nuniform sampler2D tStenN;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 p = vSW.xz + vSW.y * vec2( 0.31, -0.27 );
          float av = distance( vSW, cameraPosition ), nk = 1.0 - smoothstep( 25.0, 70.0, av );
          // fototexturen i två skalor: ovanifrån (Y) och den dominerande sidoprojektionen (X eller Z), blandade efter
          // normalen; den grova skalan vriden och utblandad med lågfrekvent brus (texturbombning mot upprepning).
          // Bilden används relativt sitt eget medelvärde, så att hörnfärgens lav, mossa och toner står kvar.
          vec3 gnW = normalize( ( vec4( vNormal, 0.0 ) * viewMatrix ).xyz ), gb = pow( abs( gnW ), vec3( 4.0 ) ); gb /= gb.x + gb.y + gb.z;
          vec2 sUv = gb.x > gb.z ? vSW.zy : vSW.xy;
          float bom = smoothstep( 0.3, 0.7, texture2D( uBrusS, vSW.xz * 0.05 ).r );
          vec3 dA = texture2D( tSten, vSW.xz / 2.2 ).rgb * gb.y + texture2D( tSten, sUv / 2.2 + 0.21 ).rgb * ( gb.x + gb.z );
          vec3 dB = texture2D( tSten, mat2( 0.8, 0.6, -0.6, 0.8 ) * vSW.xz / 6.1 + 0.37 ).rgb;
          vec3 dT = mix( dA, mix( dA, dB, 0.5 ), bom ), dM = textureLod( tSten, vec2( 0.5 ), 12.0 ).rgb;
          dT = mix( vec3( dot( dT, vec3( 0.3, 0.59, 0.11 ) ) ), dT, 0.55 ); dM = mix( vec3( dot( dM, vec3( 0.3, 0.59, 0.11 ) ) ), dM, 0.55 );   // (lavens grönt nedtonat)
          diffuseColor.rgb *= mix( vec3( 1.0 ), clamp( dT / max( dM, vec3( 0.02 ) ), 0.0, 2.2 ), 0.85 * ( 0.45 + 0.55 * nk ) );
          float k1 = texture2D( uBrusS, p * 1.9 ).b, k2 = texture2D( uBrusS, p * 5.3 ).a;
          diffuseColor.rgb *= mix( 1.0, 0.92 + 0.15 * k1, nk );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.1, 1.04, 1.0 ), smoothstep( 0.72, 0.8, k2 ) * nk * 0.5 );      // fältspat (svagt varm, inte rosa)
          diffuseColor.rgb *= 1.0 - smoothstep( 0.82, 0.9, texture2D( uBrusS, p * 7.1 ).g ) * 0.35 * nk;                                     // svart glimmer
          float sp = 1.0 - smoothstep( 0.0, 0.018, abs( texture2D( uBrusS, p / 4.3 ).g - 0.5 ) );
          sp = max( sp, 1.0 - smoothstep( 0.0, 0.012, abs( texture2D( uBrusS, mat2( 0.6, 0.8, -0.8, 0.6 ) * p / 2.2 ).r - 0.5 ) ) );
          diffuseColor.rgb *= 1.0 - sp * 0.2 * ( 1.0 - smoothstep( 15.0, 45.0, av ) );
          // långa sprickor som syns även från tomten: aldrig smalare än en bildpunkt, svagare i stället
          // (två riktningar, utdragna längs isens väg så att de blir raka diaklaser i stället för slingrande linjer)
          vec2 pi = vec2( dot( p, vec2( 0.93, 0.37 ) ), dot( p, vec2( -0.37, 0.93 ) ) );
          float jn = texture2D( uBrusS, pi * vec2( 1.0 / 34.0, 1.0 / 7.0 ) ).g - 0.5, jw = max( 0.014, fwidth( jn ) * 1.3 );
          float jm = texture2D( uBrusS, pi * vec2( 1.0 / 5.0, 1.0 / 26.0 ) + 0.5 ).r - 0.5, jw2 = max( 0.012, fwidth( jm ) * 1.3 );
          diffuseColor.rgb *= 1.0 - max( ( 1.0 - smoothstep( 0.0, jw, abs( jn ) ) ) * 0.6 * ( 0.014 / jw ), ( 1.0 - smoothstep( 0.0, jw2, abs( jm ) ) ) * 0.4 * ( 0.012 / jw2 ) );
          // ockra- och rostfläckar (järnutfällningar) i flammor
          float ro = smoothstep( 0.6, 0.74, texture2D( uBrusS, p * 0.37 + 3.1 ).r ) * smoothstep( 0.35, 0.7, texture2D( uBrusS, p * 2.3 ).g );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.22, 0.98, 0.7 ), ro * 0.6 );
          // vid vattenlinjen: våt, mörkare sten
          float vat = 1.0 - smoothstep( ${(VY + 0.04).toFixed(3)}, ${(VY + 0.5).toFixed(3)}, vSW.y );
          diffuseColor.rgb *= 1.0 - 0.25 * vat;
        }`)
        // materialkänsla: korn och sprickor som relief i normalen (bump ur brustexturen), slipad yta som glänser lite,
        // blank och våt vid vattenlinjen
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { // normalkartan triplanart (whiteout-blandning, Y och den dominerande sidan), svagare på avstånd
          float av = distance( vSW, cameraPosition ), st = 0.9 * ( 1.0 - smoothstep( 20.0, 80.0, av ) ) + 0.15;
          vec3 nW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ), gb = pow( abs( nW ), vec3( 4.0 ) ); gb /= gb.x + gb.y + gb.z;
          bool sX = gb.x > gb.z;
          vec3 tY = texture2D( tStenN, vSW.xz / 2.2 ).xyz * 2.0 - 1.0, tS = texture2D( tStenN, ( sX ? vSW.zy : vSW.xy ) / 2.2 + 0.21 ).xyz * 2.0 - 1.0;
          tY.xy *= st; tS.xy *= st;
          vec3 nY = vec3( tY.x + nW.x, abs( tY.z ) * nW.y, tY.y + nW.z );
          vec3 nS = sX ? vec3( abs( tS.z ) * nW.x, tS.y + nW.y, tS.x + nW.z ) : vec3( tS.x + nW.x, tS.y + nW.y, abs( tS.z ) * nW.z );
          nW = normalize( nY * gb.y + nS * ( gb.x + gb.z ) );
          normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );
        }`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix( 0.82, 0.34, 1.0 - smoothstep( ${(VY + 0.04).toFixed(3)}, ${(VY + 0.5).toFixed(3)}, vSW.y ) );`);
    };
    m.customProgramCacheKey = () => 'sjo-granit3';
    return m;
  })());
  // trä, färg, båtar och djur (fast eller i rörelse)
  const tingMat = () => MATS.ting || (MATS.ting = (() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    // trä- och stenstruktur (aTx, se bygg): fototexturens ljushet moduleras på hörnfärgen och ger en liten bump
    const tl = new THREE.TextureLoader(), lad = url => tl.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; });
    // Poly Haven (CC0): wood_planks_grey (grånade kustbrädor med spikar, 5 brädor över bredden, ådring lodrätt) och
    // old_wood_floor (mörkare oljat trä, ådring vågrätt), med normalkartor (OpenGL)
    const tTra = lad('images/tex/brygga-diff.webp'), tTraN = lad('images/tex/brygga-nor.webp'), tGra = lad('images/tex/gratra-diff.webp'), tGraN = lad('images/tex/gratra-nor.webp'), tSt = lad('images/tex/sten-diff.webp');
    [tTra, tTraN, tGra, tGraN, tSt].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    m.onBeforeCompile = s => { anim(s);
      Object.assign(s.uniforms, { tTra: { value: tTra }, tTraN: { value: tTraN }, tGra: { value: tGra }, tGraN: { value: tGraN }, tSt: { value: tSt } });
      s.vertexShader = 'attribute vec3 aTx;\nvarying vec3 vTx;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTx = aTx;');
      s.fragmentShader = 'uniform sampler2D tTra;\nuniform sampler2D tTraN;\nuniform sampler2D tGra;\nuniform sampler2D tGraN;\nuniform sampler2D tSt;\nvarying vec3 vTx;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 0.9 + 0.2 * texture2D( uBrusS, vSW.xz * 2.3 + vSW.y * 1.7 ).b;
      float trH = 0.0, trN = 0.0; vec2 trUv = vec2( 0.0 );
      if ( vTx.z > 0.5 ) {
        if ( vTx.z < 1.5 || vTx.z > 3.5 ) {   // trä: fotots ljushet på hörnfärgen (behåller bitens ton), relief ur normalkartan; målat trä svagt
          bool gr = vTx.z > 4.5; trUv = gr ? vec2( vTx.y * 0.6, vTx.x * 0.9 ) : vTx.xy;   // (old_wood_floor har ådringen vågrätt)
          vec3 tf = gr ? texture2D( tGra, trUv ).rgb : texture2D( tTra, trUv ).rgb, tm = gr ? textureLod( tGra, vec2( 0.5 ), 12.0 ).rgb : textureLod( tTra, vec2( 0.5 ), 12.0 ).rgb;
          float l = dot( tf, vec3( 0.3, 0.59, 0.11 ) ) / max( 0.05, dot( tm, vec3( 0.3, 0.59, 0.11 ) ) ), k = vTx.z > 3.5 && vTx.z < 4.5 ? 0.26 : 0.85;
          // fotot styr färgen (ådring, spikhål, fläckar): bitens egen färg ger bara ljusheten; målat trä behåller sin färg
          vec3 lin = pow( tf, vec3( 2.2 ) ), lm = pow( tm, vec3( 2.2 ) ); float ljus = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) / max( 0.02, dot( lm, vec3( 0.3, 0.59, 0.11 ) ) );
          vec3 foto = lin * ljus * 0.95;
          diffuseColor.rgb = vTx.z > 3.5 && vTx.z < 4.5 ? diffuseColor.rgb * mix( 1.0, clamp( l, 0.3, 1.8 ), k ) : mix( diffuseColor.rgb * clamp( l, 0.3, 1.8 ), foto, 0.7 ); trN = vTx.z > 3.5 && vTx.z < 4.5 ? 0.0 : ( gr ? 2.0 : 1.0 );
        } else if ( vTx.z < 2.5 ) {           // sten: triplanärt i världen
          vec3 nW = normalize( cross( dFdx( vSW ), dFdy( vSW ) ) ), bw = pow( abs( nW ), vec3( 4.0 ) ); bw /= dot( bw, vec3( 1.0 ) );
          // (grustexturen används bara som fint korn i liten skala; stenens form bär resten)
          vec3 t = texture2D( tSt, vSW.yz * 2.6, 1.5 ).rgb * bw.x + texture2D( tSt, vSW.xz * 2.6 + 0.3, 1.5 ).rgb * bw.y + texture2D( tSt, vSW.xy * 2.6 + 0.6, 1.5 ).rgb * bw.z;
          float l = dot( t, vec3( 0.3, 0.59, 0.11 ) ); diffuseColor.rgb *= 0.8 + 0.45 * l; trH = 0.0;
        } else {                              // ändträ: årsringar kring en förskjuten märg, ljusare ved, mörkare ytterkant
          float rr = length( vTx.xy - vec2( 0.008, -0.006 ) ), ring = smoothstep( 0.7, 1.0, fract( rr * 170.0 ) );
          vec3 ved = vec3( 0.8, 0.66, 0.46 ) * ( 0.88 + 0.12 * sin( rr * 40.0 ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, ved * ved * 1.1, 0.8 ) * ( 1.0 - 0.22 * ring ); trH = ring * 0.25;
        }
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if ( trN > 0.5 ) {   // normalkartan i en ram ur uv-derivatorna (som three:s perturbNormal2Arb)
        vec3 q0 = dFdx( -vViewPosition ), q1 = dFdy( -vViewPosition ); vec2 st0 = dFdx( trUv ), st1 = dFdy( trUv );
        vec3 q1p = cross( q1, normal ), q0p = cross( normal, q0 ), T = q1p * st0.x + q0p * st1.x, Bv = q1p * st0.y + q0p * st1.y;
        float dt = max( dot( T, T ), dot( Bv, Bv ) ), sc = dt == 0.0 ? 0.0 : inversesqrt( dt );
        vec3 mn = ( trN > 1.5 ? texture2D( tGraN, trUv ).xyz : texture2D( tTraN, trUv ).xyz ) * 2.0 - 1.0; mn.xy *= 1.1;
        normal = normalize( T * ( mn.x * sc ) + Bv * ( mn.y * sc ) + normal * mn.z );
      }
      if ( trH > 0.0 ) { vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition ); float dhx = dFdx( trH ), dhy = dFdy( trH );
        vec3 r1 = cross( dpy, normal ), r2 = cross( normal, dpx ); float det = dot( dpx, r1 );
        normal = normalize( abs( det ) * normal - sign( det ) * ( dhx * r1 + dhy * r2 ) * 0.35 ); }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float mt = smoothstep( 0.0, 0.03, dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ); reflectedLight.indirectSpecular *= mt; reflectedLight.directSpecular *= mt; }   // matt svart papp speglar inte kvällshimlen`); };
    m.customProgramCacheKey = () => 'sjo-ting';
    return m;
  })());
  // växter: dubbelsidiga, vinden i vertexskuggaren, lite genomlysning
  const vaxtMat = () => MATS.vaxt || (MATS.vaxt = (() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    m.onBeforeCompile = s => { anim(s); s.uniforms.uSol = VU.uSol; s.uniforms.uSSS = VU.uSSS;
      s.fragmentShader = 'uniform vec3 uSol;\nuniform vec3 uSSS;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.78 + 0.44 * texture2D( uBrusS, vSW.xz * 3.1 + vSW.y * 2.3 ).a;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if ( vBarr > 0.5 ) {
          // barrklumpar: kanten (där ytan vänder sig från kameran) bryts upp i tofsar, barrstruktur och små gluggar
          float fr = 1.0 - abs( dot( normal, normalize( vViewPosition ) ) );
          float n = texture2D( uBrusS, vSW.xz * 1.9 + vSW.y * 1.4 ).g * 0.55 + texture2D( uBrusS, vSW.xz * 6.3 - vSW.y * 4.1 ).b * 0.45;
          if ( n < fr * 1.1 - 0.12 ) discard;
          diffuseColor.rgb *= 0.55 + 0.85 * smoothstep( 0.2, 0.8, n );
        }`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 sd = normalize( ( viewMatrix * vec4( uSol, 0.0 ) ).xyz ); float g = pow( max( dot( normalize( -vViewPosition ), sd ), 0.0 ), 3.0 );
          reflectedLight.indirectDiffuse += uSSS * diffuseColor.rgb * g * 1.6; }`); };
    m.customProgramCacheKey = () => 'sjo-vaxt';
    return m;
  })());
  const nat = (B, mat, namn, { kast = false, tar = true, fast = true, spegel = true } = {}) => {
    if (!B.antal) return null;
    const o = new THREE.Mesh(B.geo(), mat);
    o.name = namn; o.castShadow = kast; o.receiveShadow = tar; o.matrixAutoUpdate = false; o.userData.egen = true; o.userData.spegla = spegel;
    if (!fast) o.frustumCulled = false;
    console.info('miljö: sjö', namn, B.antal | 0, 'trianglar');
    return o;
  };

  // ---- byggstenar ----
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const skala = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const vari = (c, r, s = 0.08) => { const k = 1 - s + r() * s * 2; return [c[0] * k * (1 + (r() - 0.5) * s * 0.5), c[1] * k, c[2] * k * (1 + (r() - 0.5) * s * 0.5)]; };
  // AO: mörkare nertill och på undersidan
  const BARR = [0, 0, 0, 0.25];   // barrflagga: trasig siluett i växtskuggaren
  const ao = (c, ny, ly, lo = 0.55) => skala(c, lo + (1 - lo) * (0.5 + 0.5 * ny) * (0.75 + 0.25 * Math.min(1, ly + 0.5)));
  // ---- skärgårdstallen: stam och grenar som rör, kronan av barrkort (fotograferade tallkvistar) ----
  const MSAA = (() => { try { return !!renderer.getContext().getContextAttributes().antialias; } catch (e) { return false; } })();
  // barratlas 1024²: fotograferade tallkvistar (Poly Haven pine_tree_01 twig, CC0) i 2 × 2 rutor (images/tex/tallkvist.webp,
  // byggd med phverk/kvist.py): en kvist med sidoskott, ett ensamt skott, ett skott med sidoskott och en krans. Basen nere
  // (v 0) och spetsen uppe i varje ruta; genomskinliga texlar har kvistens färg (inga svarta mipkanter). Normalkarta bredvid.
  let BARRT = null;
  const barrTex = () => BARRT || (BARRT = (() => {
    const tl = new THREE.TextureLoader(), lad = (url, srgb) => tl.load(url, t => { t.needsUpdate = true; });
    const t = lad('images/tex/tallkvist.webp'), n = lad('images/tex/tallkvist-nor.webp');
    t.colorSpace = THREE.SRGBColorSpace;
    for (const x of [t, n]) { x.magFilter = THREE.LinearFilter; x.minFilter = THREE.LinearMipmapLinearFilter; x.generateMipmaps = true; x.anisotropy = 4; }
    return { t, n };
  })());
  // barrkortens material: alfatest (a2c med MSAA), täckningen tjockare på avstånd (mipnivåerna tunnar annars ut kronan),
  // rundad kronnormal på båda sidor av kortet och genomlysning mot solen
  const barrMat = () => MATS.barr || (MATS.barr = (() => {
    const m = new THREE.MeshStandardMaterial({ map: barrTex().t, normalMap: barrTex().n, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: MSAA });
    m.onBeforeCompile = s => { anim(s); s.uniforms.uSol = VU.uSol; s.uniforms.uSSS = VU.uSSS;
      s.fragmentShader = 'uniform vec3 uSol;\nuniform vec3 uSSS;\n' + s.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          { float lod = log2( max( length( fwidth( vMapUv * vec2( 1024.0 ) ) ), 1.0 ) ); diffuseColor.a = min( 1.0, diffuseColor.a * ( 1.0 + 0.4 * lod ) ); }
          diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ), diffuseColor.rgb, 0.7 ) * vec3( 0.36, 0.56, 0.62 );   // fotots olivgröna barr mot skärgårdstallens kalla, mörka blågröna (som den ritade texturen)
          diffuseColor.rgb *= 0.8 + 0.4 * texture2D( uBrusS, vSW.xz * 0.45 + vSW.y * 0.3 ).a;`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          #ifdef DOUBLE_SIDED
            normal *= faceDirection;
          #endif`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec3 sd = normalize( ( viewMatrix * vec4( uSol, 0.0 ) ).xyz ); float g = pow( max( dot( normalize( -vViewPosition ), sd ), 0.0 ), 3.0 );
            reflectedLight.indirectDiffuse += uSSS * diffuseColor.rgb * g * 0.5;
            // inga glansiga kortkanter: snett belysta kort speglade kvällshimlen (Fresnel) som orange glöd
            reflectedLight.indirectSpecular *= 0.0; reflectedLight.directSpecular *= 0.15; }`); };
    m.customProgramCacheKey = () => 'sjo-barr2-' + MSAA;
    return m;
  })());
  // tallstammarnas och grenarnas material: matt bark, ingen genomlysning och knappt någon glans
  // (växtmaterialets genomlysning gjorde stammarna ljust beige i motljus)
  const barkMat = () => MATS.bark || (MATS.bark = (() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
    // fotograferad tallbark (Poly Haven pine_bark, CC0): lagd i världen från sidorna (X/Z-projektion, v längs höjden),
    // relativt sitt medelvärde så att hörnfärgen (grå nertill, rostorange upptill) styr tonen; normalkartan ger skorpornas relief
    const tl = new THREE.TextureLoader(), lad = (url, srgb) => tl.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; });
    const tB = lad('images/tex/tallbark-diff.webp', true), tBN = lad('images/tex/tallbark-nor.webp', false);
    tB.colorSpace = THREE.SRGBColorSpace;
    m.onBeforeCompile = s => { anim(s); s.uniforms.tBark = { value: tB }; s.uniforms.tBarkN = { value: tBN };
      s.fragmentShader = 'uniform sampler2D tBark;\nuniform sampler2D tBarkN;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 gnW = normalize( ( vec4( vNormal, 0.0 ) * viewMatrix ).xyz ); float wx = abs( gnW.x ) / ( abs( gnW.x ) + abs( gnW.z ) + 1e-4 );
          vec3 d = mix( texture2D( tBark, vec2( vSW.z, vSW.y * 0.6 ) / 0.9 ).rgb, texture2D( tBark, vec2( vSW.x, vSW.y * 0.6 ) / 0.9 + 0.31 ).rgb, 1.0 - wx );
          vec3 dm = textureLod( tBark, vec2( 0.5 ), 12.0 ).rgb;
          float av = distance( vSW, cameraPosition );
          diffuseColor.rgb *= mix( vec3( 1.0 ), clamp( d / max( dm, vec3( 0.02 ) ), 0.0, 2.2 ), 0.85 - 0.4 * smoothstep( 15.0, 60.0, av ) ); }`)
      // rörens varv går åt "fel" håll för three: den synliga sidan räknades som baksida och fick normalen vänd inåt –
      // stammarna blev kolsvarta. Hörnnormalen (utåt) används som den är på båda sidor.
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 nW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ); bool sX = abs( nW.x ) > abs( nW.z );
          float st = 0.9 * ( 1.0 - smoothstep( 10.0, 40.0, distance( vSW, cameraPosition ) ) );
          vec3 t = texture2D( tBarkN, ( sX ? vec2( vSW.z, vSW.y * 0.6 ) : vec2( vSW.x, vSW.y * 0.6 ) ) / 0.9 + ( sX ? 0.0 : 0.31 ) ).xyz * 2.0 - 1.0; t.xy *= st;
          vec3 n2 = sX ? vec3( abs( t.z ) * nW.x, t.y + nW.y, t.x + nW.z ) : vec3( t.x + nW.x, t.y + nW.y, abs( t.z ) * nW.z );
          normal = normalize( ( viewMatrix * vec4( normalize( n2 ), 0.0 ) ).xyz ); }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= 0.2; reflectedLight.directSpecular *= 0.25;`); };
    m.customProgramCacheKey = () => 'sjo-bark3';
    return m;
  })());
  // byggare för barrkorten (med uv)
  function byggKort() {
    const P = [], N = [], F = [], U = [], A = [], W = [];
    return {
      v(p, n, f, u, w) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); F.push(f[0] ** 2.2, f[1] ** 2.2, f[2] ** 2.2); U.push(u[0], u[1]); A.push(0, 0, 0, 0); W.push(w); },
      get antal() { return P.length / 9; },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(F, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        g.setAttribute('aAnim', new THREE.Float32BufferAttribute(A, 4)); g.setAttribute('aVaj', new THREE.Float32BufferAttribute(W, 1));
        g.computeBoundingSphere(); return g;
      },
    };
  }
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const kors = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // rör längs punkter [x, y, z, radie] (stam, grenar): parallellförda ramar, s sidor, färg per hörn farg(t, vinkel, ny)
  function ror(B, pts, s, farg) {
    const p = [], n = [], f = [], R = []; let ref = [0.31, 0, 0.95];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const dd = ref[0] * t[0] + ref[1] * t[1] + ref[2] * t[2], u = nrm([ref[0] - t[0] * dd, ref[1] - t[1] * dd, ref[2] - t[2] * dd]), w = kors(t, u); ref = u;
      const ring = [];
      for (let k = 0; k <= s; k++) {
        const th = k / s * 6.2832, c = Math.cos(th), si = Math.sin(th), nx = u[0] * c + w[0] * si, ny = u[1] * c + w[1] * si, nz = u[2] * c + w[2] * si, rr = pts[i][3];
        ring.push([pts[i][0] + nx * rr, pts[i][1] + ny * rr, pts[i][2] + nz * rr, nx, ny, nz, farg(i / (pts.length - 1), th, ny)]);
      }
      R.push(ring);
    }
    const V = q => { p.push(q[0], q[1], q[2]); n.push(q[3], q[4], q[5]); f.push(q[6][0], q[6][1], q[6][2]); };
    for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < s; k++) { const a = R[i][k], b = R[i][k + 1], c = R[i + 1][k], d = R[i + 1][k + 1]; V(a); V(c); V(b); V(b); V(c); V(d); }
    B.ra(p, n, f);
  }
  // en barrtofs: tre kort i kors runt skottets riktning d, i punkten o; normalen följer kudden (rundad, inte platt)
  function tofs(Bk, r, o, d, L, ton, nf, vaj) {
    let e1 = kors(d, [0, 1, 0]); if (Math.hypot(...e1) < 0.2) e1 = [1, 0, 0]; e1 = nrm(e1); const e2 = kors(d, e1), W = L * 0.5, rot = r() * 3.14;
    const ru = (r() * 4) | 0, cu = (ru & 1) * 0.5, cv = (ru >> 1) * 0.5, sp = r() < 0.5, u0 = sp ? 1 : 0, u1 = sp ? 0 : 1;   // ruta i 2 × 2-atlasen, ibland spegelvänd
    for (let k = 0; k < 3; k++) {
      const th = rot + k * 1.047, sd = [e1[0] * Math.cos(th) + e2[0] * Math.sin(th), e1[1] * Math.cos(th) + e2[1] * Math.sin(th), e1[2] * Math.cos(th) + e2[2] * Math.sin(th)];
      const q = (sx, sl) => [o[0] + sd[0] * W * sx + d[0] * L * sl, o[1] + sd[1] * W * sx + d[1] * L * sl, o[2] + sd[2] * W * sx + d[2] * L * sl];
      const Q = [[q(-1, -0.12), [u0, 0]], [q(1, -0.12), [u1, 0]], [q(1, 0.88), [u1, 1]], [q(-1, 0.88), [u0, 1]]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const [pp, uv] = Q[i]; Bk.v(pp, nf(pp), ton(pp, uv[1]), [cu + uv[0] * 0.5, cv + uv[1] * 0.5], vaj(pp[1]) + uv[1] * 0.012); }
    }
  }
  // en barrklump: rundad, oregelbunden boll av tofsar i blandade riktningar kring c (radie s), lite utåt längs (ux, uz).
  // Normal och ton följer hela kronan (mitt CC, halvaxlar KR = [vågrät, lodrät]): mörk inuti och undertill, ljusare
  // unga skott ytterst och i toppen – så att kronan läses som en sammanhängande volym, inte som lösa skivor
  function kudde(Bv, Bk, r, c, s, ux, uz, CC, tint, vaj, liten = 1, KR = [s * 2, s * 1.2]) {
    const ry = s * (0.55 + r() * 0.15), nt = Math.max(6, Math.min(26, Math.round((6 + s * s * 10) * liten)));
    const rel = p => [(p[0] - CC[0]) / KR[0], (p[1] - CC[1]) / KR[1], (p[2] - CC[2]) / KR[0]];
    const nf = p => { const q = rel(p), a = nrm([(p[0] - c[0]) / s, (p[1] - c[1]) / ry, (p[2] - c[2]) / s]); return nrm([q[0] * 0.7 + a[0] * 0.3, q[1] * 0.7 + a[1] * 0.3 + 0.35, q[2] * 0.7 + a[2] * 0.3]); };
    const ton = (p, v) => {
      const q = rel(p), ut = Math.hypot(q[0], q[1], q[2]), lok = (p[1] - c[1]) / ry;
      const ao = (0.42 + 0.58 * mjuk(0.2, 1.0, ut)) * (0.55 + 0.45 * mjuk(-1, 0.6, lok)) * (0.75 + 0.25 * mjuk(-0.8, 0.6, q[1]));
      const topp = mjuk(0.3, 1.1, q[1] + ut * 0.3) * mjuk(0.4, 1, v), f = skala(tint, ao * (0.85 + 0.2 * v));
      return [f[0] * (1 + 0.15 * topp), f[1] * (1 + 0.3 * topp), f[2] * (1 + 0.12 * topp)];
    };
    // en kvist in i klumpen (syns i gluggarna underifrån)
    { const a = r() * 6.283, l = s * (0.4 + r() * 0.4); Bv.add(CYL(), MAB([c[0] - ux * s * 0.3, c[1] - ry * 0.4, c[2] - uz * s * 0.3], [c[0] + Math.cos(a) * l, c[1] + ry * 0.1, c[2] + Math.sin(a) * l], 0.02), [0.3, 0.25, 0.2]); }
    for (let k = 0; k < nt; k++) {
      const a = r() * 6.283, cy = r() * 1.7 - 0.75, rh = Math.sqrt(Math.max(0, 1 - cy * cy)), rr = 0.35 + 0.65 * Math.sqrt(r());
      const dx = Math.cos(a) * rh, dz = Math.sin(a) * rh, o = [c[0] + dx * rr * s + ux * s * 0.12, c[1] + cy * rr * ry, c[2] + dz * rr * s + uz * s * 0.12];
      const q = nrm([o[0] - CC[0], 0, o[2] - CC[2]]);
      const d = nrm([q[0] * 0.5 + dx * 0.4 + (r() - 0.5) * 0.5, 0.35 + cy * 0.3 + r() * 0.4, q[2] * 0.5 + dz * 0.4 + (r() - 0.5) * 0.5]);
      tofs(Bk, r, o, d, s * (0.5 + r() * 0.3) + 0.18, ton, nf, vaj);
    }
  }
  // skärgårdstall: krokig, vindpinad stam (grå skorpbark nertill, orange spegelbark upptill), döda kvistar på den kala
  // stammen och en oregelbunden, flack krona av barrkuddar på grova grenar med armbåge uppåt – längst åt lä.
  // lag: liten, krokig tall direkt på hällen som lutar hårt och har kronan nästan från marken
  // lvIn: egen lutningsriktning (strandtallar lutar ut mot vattnet), lutIn: extra lutning
  function tall(Bv, Bk, r, x, y, z, h, lag = false, lvIn = null, lutIn = 0) {
    const lv = lvIn || [0.94, 0.33], aL = Math.atan2(lv[1], lv[0]);
    const lut = lag ? 0.22 + r() * 0.3 : 0.03 + r() * 0.1 + lutIn, vr = r() * 6.283, vamp = lag ? 0.1 + r() * 0.08 : 0.03 + r() * 0.07, n = lag ? 7 : 10;
    const rb = (lag ? 0.028 : 0.016) * h + 0.05, pts = [];
    let px = x, pz = z;
    for (let i = 0; i <= n; i++) {
      const t = i / n, k = lag ? 0.4 + 1.4 * t : 1;
      if (i) { px += (lv[0] * lut * k + Math.cos(vr + t * 4.1) * vamp) * h / n; pz += (lv[1] * lut * k + Math.sin(vr + t * 4.1) * vamp) * h / n; }
      pts.push([px, y - 0.3 + t * (h + 0.3) * (lag ? 1 - t * 0.3 : 1), pz, rb * (1 - t * 0.86) * (i === 0 ? 1.45 : 1)]);
    }
    const P = t => { const i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i; return [0, 1, 2, 3].map(q => pts[i][q] + (pts[i + 1][q] - pts[i][q]) * f); };
    const kb = lag ? 0.22 + r() * 0.1 : 0.3 + r() * 0.16;   // kronans början (skärgårdstallar har ofta grenar halvvägs ned)
    const gra = [0.44, 0.42, 0.4], ora = vari([0.56, 0.47, 0.41], r, 0.04);   // (hörnfärgen linjäriseras ^2,2: mättade toner blev knallröda)   // (dämpad rödbrun: rent orange lyste i kvällssolen)
    ror(Bv, pts, lag ? 5 : 7, (t, th, ny) => {
      const sk = fbm(th * 1.6 + x, t * 14 + z, 2), c = lerp(gra, ora, mjuk(kb - 0.25, kb + 0.05, t + (sk - 0.5) * 0.25));
      return skala(c, (0.72 + 0.35 * sk) * (0.85 + 0.15 * ny));
    });
    const vaj = wy => 0.012 * Math.max(0, wy - y) / h * 3;
    // döda kvistar och grenstumpar på den kala stammen (grå, pekar lite nedåt)
    for (let k = 0, nd = lag ? 1 : 3 + (r() * 5 | 0); k < nd; k++) {
      const bp = P(0.12 + r() * (kb - 0.1)), ga = r() * 6.283, l = h * (0.025 + r() * 0.07), tip = [bp[0] + Math.cos(ga) * l, bp[1] - l * (0.1 + r() * 0.3), bp[2] + Math.sin(ga) * l];
      Bv.add(CYL(), MAB(bp, tip, rb * 0.09), [0.44, 0.42, 0.39]);
      if (l > h * 0.05) { const m = [(bp[0] + tip[0]) / 2, (bp[1] + tip[1]) / 2, (bp[2] + tip[2]) / 2], g2 = ga + (r() - 0.5) * 1.6; Bv.add(CYL(), MAB(m, [m[0] + Math.cos(g2) * l * 0.4, m[1] + l * 0.05, m[2] + Math.sin(g2) * l * 0.4], rb * 0.05), [0.47, 0.45, 0.42]); }
    }
    const tint = [0.86 + r() * 0.08, 0.94 + r() * 0.06, 0.96 + r() * 0.1];   // (ljusare: kronorna blev nästan svarta pannkakor)   // (tallens barr: mörkt blågröna, inte lövgröna)
    const grenF = (t) => lerp([0.42, 0.33, 0.26], [0.34, 0.3, 0.25], t);
    // kronan: en sammanhängande, oregelbunden massa – en flack paraplyformad ellipsoid (förskjuten åt lä) fylld med
    // överlappande klumpar; luftig kant men ingen himmel rakt igenom. Korta, grova grenar från stammen slutar inne i klumparna.
    const kH = (1 - kb) * h, KR = [lag ? h * 0.32 + 0.4 : h * (0.16 + r() * 0.06) + 0.7, kH * 0.36 + 0.3];   // (flack: tallkronan är bredare än hög)
    const CC = (() => { const m = P(kb + (1 - kb) * 0.62); return [m[0] + lv[0] * KR[0] * 0.18, m[1], m[2] + lv[1] * KR[0] * 0.18]; })();
    const nk = lag ? 5 + (r() * 3 | 0) : 9 + (r() * 5 | 0) + Math.max(0, Math.round((h - 10) / 2));
    for (let k = 0; k < nk; k++) {
      const fi = k * 2.399 + r() * 0.7, uy = Math.max(-0.55, Math.min(0.9, -0.5 + 1.4 * (k + r()) / nk)), rh = Math.sqrt(1 - uy * uy), rad = 0.4 + r() * 0.6;   // (ojämnt: några klumpar sticker ut, kanten blir flikig)
      const ex = Math.cos(fi), ez = Math.sin(fi), lee = 0.5 + 0.5 * (ex * lv[0] + ez * lv[1]), ut = KR[0] * rh * rad * (0.75 + 0.45 * lee);
      const c = [CC[0] + ex * ut, CC[1] + uy * rad * KR[1], CC[2] + ez * ut];
      const s = Math.min(1.9, KR[0] * (0.34 + r() * 0.14) + 0.18);
      const t = Math.max(kb * 0.92, Math.min(0.97, (c[1] - s * 0.7 - y) / h)), bp = P(t);
      const e = [bp[0] + (c[0] - bp[0]) * 0.72, bp[1] + (c[1] - bp[1]) * 0.72, bp[2] + (c[2] - bp[2]) * 0.72], L = Math.hypot(e[0] - bp[0], e[2] - bp[2]);
      if (L > 0.3) ror(Bv, [[bp[0], bp[1], bp[2], bp[3] * 0.7], [(bp[0] + e[0]) / 2, (bp[1] + e[1]) / 2 - L * 0.06, (bp[2] + e[2]) / 2, bp[3] * 0.36], [e[0], e[1], e[2], bp[3] * 0.2]], 4, (tt, th, ny) => skala(grenF(tt), 0.7 + 0.3 * ny));
      kudde(Bv, Bk, r, c, s, ex, ez, CC, tint, vaj, 1, KR);
    }
    // stammens topp: smal och grenig – två–tre tunna toppskott upp i de översta klumparna
    for (let k = 0, top = pts[n]; k < (lag ? 1 : 2 + (r() * 2 | 0)); k++) {
      const a = r() * 6.283, bp = P(0.8 + r() * 0.1), e = [top[0] + Math.cos(a) * KR[0] * 0.3, top[1] + r() * 0.4, top[2] + Math.sin(a) * KR[0] * 0.3];
      ror(Bv, [[bp[0], bp[1], bp[2], bp[3] * 0.5], [e[0], e[1], e[2], bp[3] * 0.15]], 4, (tt, th, ny) => skala(grenF(0.5), 0.7 + 0.3 * ny));
    }
  }
  // en (juniperus) på hällen: låg, oregelbunden buske av tilltryckta, mörkt blågröna klumpar som kryper ut åt sidorna
  // (en mörk kärna av klumpar, och utanpå blågröna barrtofsar som strävar uppåt-utåt)
  function en(Bv, Bk, r, x, y, z, h) {
    const c = vari([0.24, 0.31, 0.22], r, 0.12), n = 3 + (r() * 3 | 0), w = h * (0.9 + r() * 0.6), tint = [0.8 + r() * 0.08, 0.9 + r() * 0.06, 0.92 + r() * 0.08];
    for (let k = 0; k < n; k++) {
      const a = r() * 6.283, d = k ? w * (0.3 + r() * 0.4) : 0, s = w * (k ? 0.24 + r() * 0.18 : 0.36), sy = h * (k ? 0.14 + r() * 0.12 : 0.26 + r() * 0.1), v = k % 4;
      Bv.add(knol('en' + v, v * 5.3, 0.5, 7, 5), M(x + Math.cos(a) * d, y + sy * 0.4, z + Math.sin(a) * d, s * (1 + r() * 0.4), sy, s * (0.75 + r() * 0.4), r() * 6.28, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3),
        (lx, ly, lz, nx, ny) => skala(c, 0.5 + 0.5 * (0.5 + 0.5 * ny)), { vaj: (lx, ly, lz, wy) => 0.02 * Math.max(0, wy - y), anim: BARR });
    }
    const C = [x, y + h * 0.1, z], nf = p => nrm([p[0] - C[0], (p[1] - C[1]) * 1.6 + 0.3, p[2] - C[2]]);
    const ton = (p, v) => skala(tint, (0.45 + 0.55 * mjuk(-0.1, h * 0.7, p[1] - y)) * (0.9 + 0.15 * v)), vaj = wy => 0.02 * Math.max(0, wy - y);
    for (let k = 0, nt = 6 + (w * 6 | 0); k < nt; k++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * w * 0.75, o = [x + Math.cos(a) * d, y + h * (0.05 + r() * 0.3) * (1 - d / w * 0.5), z + Math.sin(a) * d];
      tofs(Bk, r, o, nrm([Math.cos(a) * d / w * 0.8 + (r() - 0.5) * 0.3, 0.7 + r() * 0.3, Math.sin(a) * d / w * 0.8 + (r() - 0.5) * 0.3]), h * (0.32 + r() * 0.2) + 0.1, ton, nf, vaj);
    }
  }
  // kärleksört/fetknopp på hällen: en flack matta av små gula och grågröna rosetter (platta skivor)
  function fetknopp(Bv, r, x, y, z, s) {
    for (let i = 0, n = 6 + (r() * 6 | 0); i < n; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * s, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, k = 0.05 + r() * 0.05;
      Bv.add(SKIVA(), M(px, y + 0.03 + r() * 0.02, pz, k, 1, k, r() * 6.28), r() < 0.6 ? vari([0.86, 0.72, 0.18], r, 0.1) : [0.46, 0.52, 0.32]);
    }
  }
  // liten björk- eller rönnplanta i en skreva: tunn stam och några ljusgröna lövklumpar (växtskuggaren bryter kanten)
  function planta(Bv, r, x, y, z, h) {
    const ron = r() < 0.5, c = ron ? [0.3, 0.4, 0.14] : [0.38, 0.48, 0.16], top = [x + (r() - 0.5) * 0.3, y + h, z + (r() - 0.5) * 0.3];
    Bv.add(CYL(), MAB([x, y - 0.05, z], top, 0.022), ron ? [0.4, 0.36, 0.3] : [0.85, 0.84, 0.8]);
    for (let k = 0; k < 7; k++) {
      const a = r() * 6.283, t = 0.35 + k * 0.1, s = h * (0.1 + r() * 0.07);
      Bv.add(knol('planta' + (k % 2), 3.1 + k, 0.5, 6, 4), M(x + (top[0] - x) * t + Math.cos(a) * s * 0.6, y + h * t, z + (top[2] - z) * t + Math.sin(a) * s * 0.6, s, s * 0.7, s, r() * 6.28),
        (lx, ly, lz, nx, ny) => skala(vari(c, r, 0.08), 0.6 + 0.4 * (0.5 + 0.5 * ny)), { vaj: (lx, ly, lz, wy) => 0.03 * Math.max(0, wy - y), anim: BARR });
    }
  }
  // gräs i skrevorna: en tuva smala, böjda strån (fårsvingel, kruståtel), gröna eller halmgula
  function skrevgras(Bv, r, x, y, z, s) {
    const c = r() < 0.5 ? lerp([0.56, 0.52, 0.36], [0.64, 0.58, 0.42], r()) : lerp([0.36, 0.4, 0.24], [0.44, 0.46, 0.3], r());   // (dovt: inga neongröna prickar)
    for (let i = 0, n = 4 + (r() * 4 | 0); i < n; i++) {
      const a = r() * 6.283, d = r() * s * 0.25, h = s * (0.6 + r() * 0.6);
      Bv.add(STRA(), M(x + Math.cos(a) * d, y - 0.03, z + Math.sin(a) * d, 0.02, h, h, r() * 6.283, (r() - 0.5) * 0.7, (r() - 0.5) * 0.5), (lx, ly) => skala(c, 0.55 + 0.5 * ly), { vaj: (lx, ly) => ly * ly * 0.05 });
    }
  }
  // fiskebod på en holme: faluröd med vita knutar och vindskivor, svart papptak, dörr mot sjön, litet spröjsat fönster,
  // kallmurad stengrund; en smal brygga på stolpar ut från hällen framför. Returnerar upptagna platser [x, z, r].
  const GAVEL = () => bas('gavel', () => rawGeo([-0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0.5, 0, -0.5, 0, 1, 0.5, 0.5, 0, 0.5]));
  function holmBod(Bf, Bg, r, ox, oz, orr, hind) {
    // den flackaste platsen nära stranden på sidan mot tomten (boden ska stå lågt, inte på en stenpall)
    const L = 2.5, D = 3.2, wh = 2.0, gh = 1.1;
    let bast = null;
    for (let f = -1.2; f <= 1.21; f += 0.15) {
      const ar = Math.atan2(-oz, -ox) + f, dx = Math.cos(ar), dz = Math.sin(ar);
      let d0 = null; for (let d = 1; d < orr * 3; d += 0.2) if (holmH(ox + dx * d, oz + dz * d) < VY + 0.1) { d0 = d; break; }
      if (d0 === null) continue;
      const sx = ox + dx * d0, sz = oz + dz * d0, ry = Math.atan2(dx, dz);
      for (const ind of [2.2, 3, 4]) {
        const bx = sx - dx * (D / 2 + ind), bz = sz - dz * (D / 2 + ind);
        const R2 = (lx, lz) => [bx + lx * Math.cos(ry) + lz * Math.sin(ry), bz - lx * Math.sin(ry) + lz * Math.cos(ry)];
        let gmin = 99, gmax = -99;
        // tätt rutnät (hällens relief mellan hörnen fick annars sticka upp genom väggen)
        for (let a = -1; a <= 1.001; a += 0.25) for (let b = -1; b <= 1.001; b += 0.25) { const [wx, wz] = R2(a * (L / 2 + 0.25), b * (D / 2 + 0.25)), g = holmH(wx, wz); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
        const v = gmax - gmin + Math.max(0, gmin - VY - 1.2) * 0.5 + Math.abs(f) * 0.15;
        if (gmin > VY + 0.25 && (!bast || v < bast.v)) bast = { v, sx, sz, dx, dz, ry, bx, bz, R2, gmin, gmax };
      }
    }
    if (!bast) return [];
    const { sx, sz, dx, dz, ry, bx, bz, R2, gmin, gmax } = bast;
    const y0 = gmax + 0.08, rod = vari([0.43, 0.13, 0.09], r, 0.04), vit = [0.9, 0.89, 0.84], svart = [0.09, 0.09, 0.1], tra = [0.5, 0.46, 0.4];
    const At = (lx, ly, lz, ax, ay, az, c, B = Bf, rz = 0) => { const [wx, wz] = R2(lx, lz); B.add(LADA(), M(wx, ly, wz, ax, ay, az, ry, 0, rz), c); };
    At(0, (gmin - 0.3 + y0) / 2, 0, L - 0.08, y0 - gmin + 0.3, D - 0.08, [0.46, 0.44, 0.42], Bg);   // stengrunden
    At(0, y0 + 0.06, 0, L + 0.05, 0.12, D + 0.05, [0.28, 0.2, 0.15]);                                 // syllen
    At(0, y0 + wh / 2, 0, L, wh, D, rod);
    { const [wx, wz] = R2(0, 0); Bf.add(GAVEL(), M(wx, y0 + wh, wz, L, gh, D, ry), rod); }
    for (const a of [-1, 1]) for (const b of [-1, 1]) At(a * L / 2, y0 + wh / 2, b * D / 2, 0.13, wh, 0.13, vit);   // knutbrädor
    const th = Math.atan2(gh, L / 2), sl = Math.hypot(L / 2, gh);
    for (const a of [-1, 1]) {
      At(a * (L / 4 + 0.06), y0 + wh + gh / 2 + 0.05, 0, sl + 0.32, 0.06, D + 0.5, svart, Bf, -a * th);   // takfallen
      for (const b of [-1, 1]) At(a * (L / 4 + 0.03), y0 + wh + gh / 2 - 0.03, b * (D / 2 + 0.24), sl + 0.26, 0.17, 0.04, vit, Bf, -a * th);   // vindskivor
    }
    At(0, y0 + wh + gh + 0.04, 0, 0.16, 0.07, D + 0.5, svart);                                         // nock
    At(0.25, y0 + 0.92, D / 2 + 0.02, 0.96, 1.86, 0.04, vit); At(0.25, y0 + 0.9, D / 2 + 0.045, 0.8, 1.74, 0.03, skala(rod, 0.8));   // dörren mot sjön
    At(L / 2 + 0.02, y0 + 1.35, -0.4, 0.04, 0.64, 0.74, vit); At(L / 2 + 0.045, y0 + 1.35, -0.4, 0.03, 0.52, 0.62, [0.05, 0.07, 0.09]);
    At(L / 2 + 0.06, y0 + 1.35, -0.4, 0.02, 0.52, 0.04, vit); At(L / 2 + 0.06, y0 + 1.35, -0.4, 0.02, 0.04, 0.62, vit);   // fönster med spröjs
    At(-L / 2 - 0.25, y0 + 0.42, 0.3, 0.36, 0.05, 1.4, tra); for (const b of [-0.5, 1.1]) At(-L / 2 - 0.25, y0 + 0.2, b, 0.3, 0.42, 0.06, tra);   // bänk vid väggen
    // bryggan: tvärslagna, gråa bräder på två bärlinor och stolpar
    const dk = VY + 0.5, B2 = (al, si) => [sx + dx * al + dz * si, sz + dz * al - dx * si];
    for (let al = -1.4; al < 5.2; al += 0.17) { const [px, pz] = B2(al, 0); Bf.add(LADA(), M(px, dk, pz, 1.3, 0.045, 0.15, ry + (r() - 0.5) * 0.02), vari(tra, r, 0.1)); }
    for (const si of [-0.5, 0.5]) { const [px, pz] = B2(1.9, si); Bf.add(LADA(), M(px, dk - 0.09, pz, 0.08, 0.13, 6.6, ry), skala(tra, 0.7)); }
    for (const al of [1.2, 3.2, 5.0]) for (const si of [-0.6, 0.6]) { const [px, pz] = B2(al, si); Bf.add(CYL(), M(px, VY - 1.6, pz, 0.07, dk - VY + 1.55, 0.07), (lx, ly) => ly < 0.75 ? [0.2, 0.2, 0.15] : [0.36, 0.32, 0.27]); }
    { const [px, pz] = B2(4.9, 0.45); Bf.add(CYL(), M(px, dk, pz, 0.06, 0.25, 0.06), [0.3, 0.27, 0.23]); }   // pollare
    { const [px, pz] = B2(3, 0); hind.push([px, pz, 3.5]); }
    return [[bx, bz, 3.4], [sx, sz, 2.5]];
  }
  // ris på holmarna: en flack matta (låg klump) med korta, färgade kvistkort ovanpå – ljung brunlila, blåbär
  // gulgrönt, kråkris mörkt; mossa bara som matta
  // (barrtexturen är mörk: tonen måste vara > 1 för att riset ska bli dovt grönbrunt i stället för svarta siluetter)
  const RIS = { ljung: [2.0, 1.7, 1.45], blabar: [1.3, 1.42, 0.92], kraka: [1.45, 1.6, 1.25] };
  function ris(Bv, Bk, r, typ, x, y, z, s) {
    if (!RIS[typ]) { tuva(Bv, r, typ, x, y - s * 0.3, z, s * 1.2); return; }
    const tint = vari(RIS[typ], r, 0.1), C = [x, y - s * 0.3, z], nf = p => nrm([p[0] - C[0], (p[1] - C[1]) * 2 + 0.4, p[2] - C[2]]);
    // ljungen blommar: skottens toppar lila
    const blom = typ === 'ljung' && r() < 0.8, ton = (p, v) => blom && v > 0.5 ? lerp(skala(tint, 0.75 + 0.4 * v), [2.7, 1.6, 2.8], (v - 0.5) * 1.3) : skala(tint, 0.75 + 0.4 * v), vaj = () => 0.01;
    for (let k = 0, n = 6 + (r() * 4 | 0); k < n; k++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * s * 1.1, o = [x + Math.cos(a) * d, y - 0.04, z + Math.sin(a) * d];
      tofs(Bk, r, o, nrm([Math.cos(a) * 0.5 + (r() - 0.5) * 0.4, 0.8, Math.sin(a) * 0.5 + (r() - 0.5) * 0.4]), s * (0.6 + r() * 0.4) + 0.06, ton, nf, vaj);
    }
  }
  // låga tuvor: ljung (lila-brun), blåbärsris (grönt), mossa
  const TUVA = { ljung: [[0.32, 0.26, 0.21], [0.48, 0.3, 0.4]], blabar: [[0.22, 0.34, 0.13], [0.3, 0.4, 0.16]], mossa: [[0.3, 0.36, 0.14], [0.4, 0.42, 0.2]], kraka: [[0.2, 0.24, 0.12], [0.26, 0.3, 0.14]] };
  function tuva(Bv, r, typ, x, y, z, s) {
    const [a, b] = TUVA[typ], c = lerp(a, b, r());
    for (let i = 0; i < 3; i++) { const v = r() * 6.28, d = i ? s * (0.5 + r() * 0.6) : 0, cc = vari(c, r, 0.12), ss = s * (i ? 0.6 + r() * 0.3 : 1);
      Bv.add(knol('tuva' + (r() * 3 | 0), 7, 0.5, 5, 3), M(x + Math.cos(v) * d, y, z + Math.sin(v) * d, ss * (0.8 + r() * 0.5), ss * 0.55, ss * (0.8 + r() * 0.5), r() * 6.28),
        (lx, ly, lz, nx, ny) => skala(cc, 0.55 + 0.45 * (0.5 + 0.5 * ny)), { vaj: (lx, ly) => Math.max(0, ly) * 0.012, anim: BARR }); }
  }
  // vassens delar: avsmalnande, lätt böjt strå (fyra led), ett hängande blad och en vippa (två korsade romber)
  const rawGeo = (P) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g; };
  const STRA = () => bas('vassStra', () => {
    const Y = [0, 0.3, 0.58, 0.82, 1], w = y => 0.5 * (1 - y * 0.75) * (y < 1 ? 1 : 0), b = y => 0.06 * y * y, P = [];
    for (let k = 0; k < 4; k++) { const y0 = Y[k], y1 = Y[k + 1], a0 = w(y0), a1 = w(y1);
      P.push(-a0, y0, b(y0), a0, y0, b(y0), a1, y1, b(y1)); if (a1 > 0) P.push(-a0, y0, b(y0), a1, y1, b(y1), -a1, y1, b(y1)); }
    return rawGeo(P);
  });
  const VBLAD = () => bas('vassBlad', () => rawGeo([0, 0, -0.5, 0, 0, 0.5, 0.5, 0.2, 0.32, 0, 0, -0.5, 0.5, 0.2, 0.32, 0.5, 0.2, -0.32, 0.5, 0.2, -0.32, 0.5, 0.2, 0.32, 1, 0.02, 0]));
  const VIPPA = () => bas('vassVippa', () => rawGeo([0, 0, 0, 0.5, 0.4, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -0.5, 0.4, 0, 0, 0, 0, 0, 0.4, 0.5, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0.4, -0.5]));
  // vass (bladvass): ett tätt bestånd, avlångt längs (cos rot, sin rot), högst i mitten och lägre ut mot kanterna;
  // gröna strån blandade med fjolårets halmgula, hängande blad, bruna vippor i toppen och här och där kaveldun
  function vass(Bv, r, x, z, n, rad, hmin, hmax, el = 1, rot = r() * 6.283) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.pow(r(), 0.65), u = Math.cos(a) * d * rad * el, v = Math.sin(a) * d * rad;
      const px = x + u * cr - v * sr, pz = z + u * sr + v * cr, ry = r() * 6.283, djs = VY - ytaH(px, pz);
      if (djs < 0.03 || djs > 1.3 || kustQ(px, pz) < 10) continue;   // varje strå i grunt vatten: aldrig på land eller ute på djupet
      const h = (hmin + r() * (hmax - hmin)) * (1 - 0.45 * d * d), gammal = r() < 0.3;
      const c = gammal ? lerp([0.62, 0.55, 0.36], [0.74, 0.66, 0.46], r()) : lerp([0.3, 0.4, 0.14], [0.48, 0.54, 0.24], r());
      const lut = (r() - 0.5) * 0.28, lz = (r() - 0.5) * 0.2, vj = (lx, ly) => ly * ly * 0.11;
      const Ms = M(px, VY - 0.25, pz, 0.045, h + 0.25, h + 0.25, ry, lut, lz);
      Bv.add(STRA(), Ms, (lx, ly) => skala(lerp([0.3, 0.32, 0.18], c, mjuk(0, 0.25, ly)), 0.6 + 0.45 * ly), { vaj: vj });
      for (let k = 0, nb = gammal ? (r() < 0.5 ? 1 : 0) : 3 + (r() * 2.6 | 0); k < nb; k++) {
        const t = 0.3 + r() * 0.5, L = 0.34 + r() * 0.26, fp = T3.set(0, t, 0.06 * t * t).applyMatrix4(Ms).toArray();
        Bv.add(VBLAD(), M(fp[0], fp[1], fp[2], L, L * (0.4 + r() * 0.5), 0.085, r() * 6.283, 0, -0.15 - r() * 0.35), (lx) => skala(c, 0.8 + 0.3 * lx), { vaj: (lx) => t * t * 0.11 + lx * 0.04 });
      }
      if (r() < (gammal ? 0.5 : 0.22)) {   // vippa: brunviolett på nya strån, gråbrun på gamla
        const vc = gammal ? [0.55, 0.48, 0.4] : lerp([0.33, 0.24, 0.22], [0.45, 0.36, 0.3], r()), vs = 0.16 + r() * 0.1, tp = T3.set(0, 0.97, 0.056).applyMatrix4(Ms).toArray();
        Bv.add(VIPPA(), M(tp[0], tp[1] - vs * 0.1, tp[2], vs * 0.17, vs * 1.15, vs * 0.17, ry, lut + 0.55, lz), (lx, ly) => skala(vc, 0.8 + 0.3 * ly), { vaj: () => 0.11 });
      }
      if (r() < 0.04) Bv.add(CYL(), M(px, VY + h * 0.8, pz, 0.022, 0.17, 0.022, 0), [0.3, 0.18, 0.1], { vaj: () => 0.1 });   // kaveldun
    }
  }
  // näckrosor: ett bestånd av små klungor; flytande blad med skåra (lite olika gröna, några gulnade eller rödaktiga
  // i kanten), vita blommor med två kransar kronblad och gul mitt, och slutna knoppar
  function nackros(Bf, r, x, z, n, rad) {
    const kl = []; for (let k = 0, nk = 2 + (n / 14 | 0); k < nk; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad * 0.8; kl.push([x + Math.cos(a) * d, z + Math.sin(a) * d, rad * (0.3 + r() * 0.35)]); }
    for (let i = 0; i < n; i++) {
      const [kx, kz, kr] = kl[(r() * kl.length) | 0], a = r() * 6.283, d = Math.sqrt(r()) * kr, px = kx + Math.cos(a) * d, pz = kz + Math.sin(a) * d, s = 0.08 + r() * 0.08, djs = VY - ytaH(px, pz);
      if (djs < 0.3 || djs > 2.8 || kustQ(px, pz) < 10) continue;   // varje blad flyter på vatten som är tillräckligt djupt
      const t = r(), c = t < 0.06 ? [0.36, 0.36, 0.13] : t < 0.1 ? [0.24, 0.22, 0.11] : vari([0.13, 0.24, 0.08], r, 0.15), an = [px, pz, r() * 6.28, 1];
      const kanten = t < 0.25 ? [0.26, 0.16, 0.1] : c;
      Bf.add(BLAD(), M(px, VY + 0.008 + r() * 0.008, pz, s, 1, s, r() * 6.28), (lx, ly, lz) => { const rr = Math.hypot(lx, lz); return lerp(skala(c, 0.85 + 0.3 * rr), kanten, mjuk(0.8, 1, rr) * 0.45); }, { anim: an });
      const f = r();
      if (f < 0.12) {
        for (let k = 0; k < 6; k++) Bf.add(PLAN(), M(px, VY + 0.02, pz, 0.035, 0.075, 1, k * 1.05, -1.0, 0), [0.96, 0.95, 0.92], { anim: an });
        for (let k = 0; k < 6; k++) Bf.add(PLAN(), M(px, VY + 0.025, pz, 0.028, 0.06, 1, k * 1.05 + 0.52, -0.45, 0), [0.98, 0.97, 0.93], { anim: an });
        Bf.add(KLOT(), M(px, VY + 0.045, pz, 0.018, 0.012, 0.018), [0.95, 0.78, 0.15], { anim: an });
      } else if (f < 0.17) Bf.add(KLOT(), M(px + s * 0.3, VY + 0.03, pz, 0.022, 0.035, 0.022), [0.86, 0.88, 0.8], { anim: an });   // knopp
    }
  }
  // sten/block: granit, mossa på ovansidan om mossig
  function block(Bg, r, x, y, z, s, mossig = false, sjunk = 0.35) {
    const g = kant('kant' + (r() * 5 | 0), 900 + (r() * 5 | 0)), c = vari(r() < 0.5 ? [0.5, 0.46, 0.44] : [0.56, 0.5, 0.47], r, 0.08), sy = s * (0.5 + r() * 0.3);
    Bg.add(g, M(x, y + sy * (1 - sjunk * 2), z, s * (0.9 + r() * 0.4), sy, s * (0.8 + r() * 0.4), r() * 6.28, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2),
      (lx, ly, lz, nx, ny, nz, wx, wy, wz) => {
        let f = skala(c, 0.62 + 0.38 * (0.5 + 0.5 * ny));
        // mossa: tunn, fläckvis och dov (grågrön), bara i fläckar på ovansidan – ingen grön mössa (team-mark)
        if (mossig) f = lerp(f, [0.3, 0.33, 0.2], mjuk(0.55, 0.75, fbm(wx * 3.3, wz * 3.3 + wy, 2)) * mjuk(0.3, 0.8, ny) * 0.55);
        else f = lerp(f, [0.62, 0.63, 0.55], mjuk(0.6, 0.75, fbm(wx * 1.3 + 5, wz * 1.3 + wy, 2)) * 0.5);   // lav
        f = skala(f, 1 - 0.55 * (1 - mjuk(0.0, 0.035, Math.abs(fbm(wx * 1.1 + wy * 0.7, wz * 1.1 - wy, 2) - 0.5))));   // spricka
        return f;
      });
  }

  // ---- holmarna: täta granitnät ovanpå marken, med lav, svart lavbälte vid vattnet, ljung och mossa i svackorna ----
  // ok(x, z): valfritt filter – rutor utanför ritas inte (holmarnas nät får aldrig nå upp på fastlandets strand)
  function holmNat(Bg, cx, cz, R, hf, steg, ok = null) {
    const n = Math.ceil(2 * R / steg), x0 = cx - R, z0 = cz - R, H = [], col = [], nor = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) H.push(hf(x0 + i * steg, z0 + j * steg));
    const h = (i, j) => H[Math.max(0, Math.min(n, j)) * (n + 1) + Math.max(0, Math.min(n, i))];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = x0 + i * steg, z = z0 + j * steg, y = h(i, j), dx = (h(i + 1, j) - h(i - 1, j)) / (2 * steg), dz = (h(i, j + 1) - h(i, j - 1)) / (2 * steg), l = Math.hypot(dx, 1, dz);
      nor.push(-dx / l, 1 / l, -dz / l);
      // svackor (krökningen) samlar jord: ljung, mossa
      const kr = (h(i + 2, j) + h(i - 2, j) + h(i, j + 2) + h(i, j - 2)) / 4 - y, ov = y - VY, lut = 1 - 1 / l;
      const n1 = fbm(x * 0.21 + 3, z * 0.21, 3), n2 = fbm(x * 0.7, z * 0.7 + 9, 2), n3 = fbm(x * 1.6 + 2, z * 1.6, 2);
      // rosa-grå granit: rödare fältspat där hällen är brant och frisk, grå vittrad yta på krönen
      let f = skala(lerp([0.43, 0.41, 0.38], [0.5, 0.47, 0.43], n1),   // (varm grå: inte rosa/lila, inte blekt vit)
 0.8 + 0.3 * fbm(x * 0.12 - 3, z * 0.12 + 5, 2));   // (fläckvis mörkare, vittrad)
      f = lerp(f, [0.44, 0.43, 0.42], mjuk(0.4, 0.72, n2) * 0.7 * (0.6 + 0.4 * (1 - lut)));         // grå, vittrade partier
      f = lerp(f, [0.52, 0.48, 0.45], mjuk(0.15, 0.5, lut) * 0.3);                                // brantare: friskare, rosa
      f = lerp(f, [0.56, 0.57, 0.53], mjuk(0.55, 0.8, n3) * 0.4 * mjuk(0.5, 1.2, ov));           // grå skorplav
      f = lerp(f, [0.58, 0.63, 0.5], mjuk(0.66, 0.74, fbm(x * 0.55 - 6, z * 0.55 + 2, 2)) * 0.25 * mjuk(0.6, 1.4, ov));   // grågröna lavrosetter
      f = skala(f, 1 - 0.65 * skara(x, z));                                                       // sprickorna: mörka skåror
      f = lerp(f, [0.64, 0.64, 0.28], mjuk(0.66, 0.78, fbm(x * 1.1 + 7, z * 1.1, 2)) * 0.55 * mjuk(0.6, 1.4, ov));   // kartlav (gulgröna rosetter)
      f = lerp(f, [0.7, 0.5, 0.26], mjuk(0.8, 0.88, fbm(x * 2.3, z * 2.3 + 4, 2)) * mjuk(0.3, 0.6, ov) * (1 - mjuk(1.2, 2, ov)) * 0.5);   // vägglav
      const band = 1 - mjuk(0.2, 0.42 + 0.16 * n2, ov);   // (bredare, mörkare vattenrand)
      f = lerp(f, [0.13, 0.12, 0.11], band * mjuk(-0.1, 0.05, ov) * 0.85);                     // svart lavbälte
      if (ov < 0.08) f = skala(f, 0.55 + 0.45 * mjuk(-0.3, 0.08, ov));                          // vått
      // risringen: i svackorna och som fläckar på de flacka krönen (ljung brun-lila, blåbär/mossa grön, torrt gräs)
      const veg = Math.max(mjuk(0.015, 0.08, kr + (n1 - 0.5) * 0.12), mjuk(0.56, 0.7, fbm(x * 0.33 - 4, z * 0.33 + 7, 2)) * mjuk(1.0, 1.7, ov) * 0.85) * mjuk(0.6, 1.1, ov) * (1 - mjuk(0.3, 0.55, lut));
      f = skala(f, 1 - mjuk(0.01, 0.14, kr) * 0.28);                                             // AO: skrevor och svackor mörkare
      f = lerp(f, lerp(lerp([0.3, 0.25, 0.18], [0.29, 0.34, 0.15], n3), [0.5, 0.46, 0.3], mjuk(0.6, 0.8, n2) * 0.6), veg * 0.92);
      // mosskuddar: tjock grön mossa i svackorna och på skuggsidorna (norrsluttningar), mjuk övergång mot hällen
      const moss = Math.max(mjuk(0.02, 0.1, kr), mjuk(0.12, 0.35, -nor[nor.length - 1]) * mjuk(0.45, 0.7, fbm(x * 0.4 + 2, z * 0.4 - 6, 2))) * mjuk(0.35, 0.8, ov) * mjuk(0.35, 0.6, fbm(x * 0.8 - 1, z * 0.8 + 3, 2));
      f = lerp(f, skala([0.27, 0.37, 0.12], 0.8 + 0.45 * n3), moss * 0.88);
      col.push(f);
    }
    const P = [], Nn = [], Fv = [];
    const vx = (i, j) => { const k = j * (n + 1) + i; P.push(x0 + i * steg, H[k], z0 + j * steg); Nn.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]); Fv.push(...col[k]); };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (Math.max(h(i, j), h(i + 1, j), h(i, j + 1), h(i + 1, j + 1)) < VY - 0.35) continue;
      if (ok && !ok(x0 + (i + 0.5) * steg, z0 + (j + 0.5) * steg)) continue;
      vx(i, j); vx(i, j + 1); vx(i + 1, j); vx(i + 1, j); vx(i, j + 1); vx(i + 1, j + 1);
    }
    Bg.ra(P, Nn, Fv);
  }
  // en liten fågel (fiskmås) som står: vit kropp, grå vingar, gul näbb
  function mas(Bf, x, y, z, ry) {
    const R = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const k = R(0, 0); Bf.add(KLOT(), M(k[0], y + 0.2, k[1], 0.1, 0.09, 0.2, ry), [0.92, 0.92, 0.9]);
    for (const s of [-1, 1]) { const w = R(s * 0.07, -0.03); Bf.add(KLOT(), M(w[0], y + 0.23, w[1], 0.04, 0.06, 0.19, ry, 0.15, 0), [0.6, 0.62, 0.66]); }
    const hd = R(0, 0.16); Bf.add(KLOT(), M(hd[0], y + 0.31, hd[1], 0.055, 0.055, 0.06, ry), [0.95, 0.95, 0.93]);
    const nb = R(0, 0.23); Bf.add(KON(), M(nb[0], y + 0.3, nb[1], 0.012, 0.06, 0.012, ry, Math.PI / 2, 0), [0.92, 0.75, 0.15]);
    for (const s of [-1, 1]) { const b = R(s * 0.03, 0); Bf.add(CYL(), M(b[0], y, b[1], 0.008, 0.13, 0.008), [0.85, 0.7, 0.3]); }
  }
  // gräsand (byggd kring origo, näbben mot +z): brun hona eller hane med grönt huvud
  function and(Bf, r, an) {
    const hane = r() < 0.5, kr = hane ? [0.55, 0.5, 0.45] : [0.45, 0.33, 0.2];
    Bf.add(KLOT(), M(0, VY + 0.06, 0, 0.13, 0.09, 0.24), kr, { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.14, -0.14, 0.08, 0.05, 0.08), hane ? [0.2, 0.18, 0.18] : kr, { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.21, 0.17, 0.055, 0.06, 0.06), hane ? [0.08, 0.3, 0.14] : [0.42, 0.32, 0.2], { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.2, 0.25, 0.02, 0.012, 0.045), [0.85, 0.7, 0.2], { anim: an });
  }

  // knipa (byggd som gräsanden): hanen svartvit med rundat mörkt huvud och vit kindfläck, honan grå med brunt huvud
  function knipa(Bf, r, an) {
    const hane = r() < 0.55;
    Bf.add(KLOT(), M(0, VY + 0.05, 0, 0.12, 0.08, 0.21), hane ? [0.93, 0.93, 0.92] : [0.5, 0.5, 0.5], { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.11, -0.04, 0.1, 0.04, 0.17), hane ? [0.12, 0.12, 0.13] : [0.38, 0.38, 0.38], { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.19, 0.15, 0.06, 0.065, 0.065), hane ? [0.06, 0.1, 0.08] : [0.4, 0.26, 0.16], { anim: an });
    if (hane) Bf.add(KLOT(), M(0, VY + 0.17, 0.2, 0.062, 0.018, 0.018), [0.95, 0.95, 0.95], { anim: an });
    Bf.add(KON(), M(0, VY + 0.18, 0.2, 0.014, 0.05, 0.014, 0, Math.PI / 2, 0), [0.12, 0.12, 0.12], { anim: an });
  }
  // knölsvan: vit kropp med lyfta vingar, S-böjd hals, orange näbb med svart knöl (fören mot +z)
  function svan(Bf, an) {
    const vit = [0.95, 0.95, 0.93], v2 = [0.9, 0.9, 0.88];
    Bf.add(KLOT(), M(0, VY + 0.1, 0, 0.27, 0.17, 0.5), vit, { anim: an });
    for (const s of [-1, 1]) Bf.add(KLOT(), M(s * 0.13, VY + 0.21, -0.1, 0.16, 0.11, 0.38, 0, -0.18, s * 0.2), v2, { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.18, -0.48, 0.1, 0.06, 0.12, 0, -0.4, 0), v2, { anim: an });   // stjärten
    const P = [[0, 0.16, 0.36], [0, 0.34, 0.46], [0, 0.52, 0.42], [0, 0.66, 0.33], [0, 0.76, 0.33], [0, 0.8, 0.4]];
    for (let i = 0; i < P.length - 1; i++) { const a = [P[i][0], VY + P[i][1], P[i][2]], b = [P[i + 1][0], VY + P[i + 1][1], P[i + 1][2]]; Bf.add(CYLS(), MAB(a, b, 0.055 - i * 0.006), vit, { anim: an }); }
    Bf.add(KLOT(), M(0, VY + 0.8, 0.43, 0.045, 0.048, 0.08), vit, { anim: an });
    Bf.add(KON(), M(0, VY + 0.785, 0.5, 0.022, 0.09, 0.016, 0, Math.PI / 2 + 0.25, 0), [0.92, 0.45, 0.12], { anim: an });
    Bf.add(KLOT(), M(0, VY + 0.81, 0.49, 0.016, 0.018, 0.022), [0.06, 0.06, 0.06], { anim: an });
  }
  // fisk (byggd kring origo längs +x): smal silvrig kropp med mörk rygg och en stjärtfena
  function fisk(Bf, an) {
    Bf.add(KLOT(), M(0, 0, 0, 0.16, 0.045, 0.035), (lx, ly) => ly > 0.3 ? [0.25, 0.3, 0.28] : [0.78, 0.8, 0.78], { anim: an });
    Bf.add(PLAN(), M(-0.19, -0.05, 0, 0.08, 0.1, 1), [0.4, 0.44, 0.42], { anim: an });
  }

  // ---- fjärrsetet: holmar, kobbar, holmarnas växter, motstrandens stugor, prickar, segelbåt, änder ----
  // fastlandets tallar (strandtallarna och ridåns närmaste) med samma modell som holmarnas: lista med
  // { x, y, z, hh, ry, art } från miljöns trädlista (tallLut lutar ut åt sitt lokala +x, dvs (cos ry, −sin ry))
  function tallar(lista) {
    if (AV || !lista.length) return [];
    const Bv = bygg(), Bk = byggKort(), r = slump(5150);
    for (const e of lista) {
      const lut = e.art === 'tallLut';
      tall(Bv, Bk, r, e.x, e.y + 0.06, e.z, lut ? Math.min(12, Math.max(8, e.hh * 0.65)) : Math.min(14, e.hh * 0.75), false, lut ? [Math.cos(e.ry), -Math.sin(e.ry)] : null, lut ? 0.12 : 0);
    }
    return [nat(Bv, barkMat(), 'sjo-landtallar', { fast: false }), nat(Bk, barrMat(), 'sjo-landtallar-barr', { fast: false })].filter(Boolean);
  }
  function fjarr(r) { return korG(fjarrG(r)); }
  function* fjarrG(r) {   // (stegvis: se forberedG och miljöns stegvisa bygge)
    if (AV) return [];
    const Bg = bygg(), Bv = bygg(), Bf = bygg(), Bk = byggKort(), Bs = bygg();   // Bs: tallarnas stammar och grenar (barkmaterialet)
    const hind = [];
    const holme = ([ox, oz, orr], oi) => {
      // (holmarna är långsmala: upp till ~2,2 × orr längs ryggen). Ute i sjön = kustQ > 31: närmare ligger fastlandets
      // strand, och där fick holmens granitnät och tallar annars hamna (ett svävande hällakan med en tall i)
      const ute = (x, z) => kustQ(x, z) > 31;
      holmNat(Bg, ox, oz, orr * 2.3, holmH, 0.62, ute);
      const slump2 = () => { for (let f = 0; f < 30; f++) { const a = r() * 6.283, d = Math.sqrt(r()) * orr * 1.7, p = [ox + Math.cos(a) * d, oz + Math.sin(a) * d]; if (ute(p[0], p[1])) return p; } return [ox, oz]; };
      // fiskebod och brygga på den näst största holmen
      const pa = oi === 1 ? holmBod(Bf, Bg, r, ox, oz, orr, hind) : [];
      const ledig = (x, z, m) => !pa.some(([px, pz, pr = 0]) => Math.hypot(px - x, pz - z) < m + pr);
      // höga tallar på krönen (3–6), ofta i en liten grupp, och låga krokiga tallar ute på de kala hällarna
      for (let k = 0, m = 0, nh = 3 + (orr > 11 ? 1 : 0) + (r() * 2 | 0); k < 500 && m < nh; k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY + 1.2 || !ledig(x, z, 2.3)) continue;
        pa.push([x, z, 0]); tall(Bs, Bk, r, x, y, z, 4.5 + r() * 4 + (m === 1 ? 2 : 0)); m++;   // (4,5–10,5 m: låga, vindpinade)
      }
      for (let k = 0, m = 0, nl = 4 + (r() * 3 | 0); k < 500 && m < nl; k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY + 0.5 || y > VY + 1.4 || !ledig(x, z, 2)) continue;
        pa.push([x, z, 0]); tall(Bs, Bk, r, x, y - 0.05, z, 1.8 + r() * 2.4, true); m++;
      }
      // enar, ljung, blåbärsris, kråkris och mossa: en ring av ris i svackorna och på krönen, enar i lä av tallarna
      // (i sammanhängande fläckar i svackorna, inte utströdda prickar: en fläck är 3–6 tuvor av samma art, ibland en en)
      for (let k = 0, n = 0; k < 2000 && n < 15; k++) {
        const [cx, cz] = slump2(), cy = holmH(cx, cz), ov = cy - VY;
        if (ov < 0.7 || !ledig(cx, cz, 1)) continue;
        const sv = (holmH(cx + 1.2, cz) + holmH(cx - 1.2, cz) + holmH(cx, cz + 1.2) + holmH(cx, cz - 1.2)) / 4 - cy;
        if (sv < 0.01) continue;
        const t = r(), typ = t < 0.4 ? 'ljung' : t < 0.65 ? 'blabar' : t < 0.78 ? 'kraka' : 'mossa';
        for (let q = 0, nq = 3 + (r() * 4 | 0); q < nq; q++) {
          const a = r() * 6.283, d = Math.sqrt(r()) * 1.3, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = holmH(x, z);
          ris(Bv, Bk, r, typ, x, y, z, 0.25 + r() * 0.2);
        }
        if (r() < 0.8) { const a = r() * 6.283, x = cx + Math.cos(a) * 1.6, z = cz + Math.sin(a) * 1.6; en(Bv, Bk, r, x, holmH(x, z) - 0.05, z, 0.55 + r() * 0.7); }
        n++;
      }
      // gräs i sprickorna och skrevorna, ända ned mot lavbältet
      for (let k = 0, n = 0; k < 2000 && n < 50; k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY + 0.35 || skara(x, z) < 0.45 || !ledig(x, z, 0.3)) continue;
        skrevgras(Bv, r, x, y, z, 0.3 + r() * 0.3); n++;
      }
      // fetknopp på de flacka hällarna, och några små björk- och rönnplantor i skrevorna
      for (let k = 0, n = 0; k < 800 && n < 7; k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY + 0.6 || !ledig(x, z, 0.6)) continue;
        fetknopp(Bv, r, x, y, z, 0.35 + r() * 0.4); n++;
      }
      for (let k = 0, n = 0; k < 800 && n < 2 + (r() * 2 | 0); k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY + 0.8 || skara(x, z) < 0.3 || !ledig(x, z, 1.2)) continue;
        pa.push([x, z, 0]); planta(Bv, r, x, y, z, 0.9 + r() * 1.3); n++;
      }
      // stenblock: några stora flyttblock på hällen och mindre stenar i strandkanten
      for (let k = 0, n = 0; k < 200 && n < 7; k++) {
        const [x, z] = slump2(), y = holmH(x, z);
        if (y < VY - 0.2 || !ledig(x, z, 1)) continue;
        const stor = n < 3 && y > VY + 0.6;
        const ner = Math.min(holmH(x + 1, z), holmH(x - 1, z), holmH(x, z + 1), holmH(x, z - 1));   // (i sluttning: sjunk ned till lägsta kanten)
        block(Bg, r, x, ner, z, stor ? 1.1 + r() * 0.8 : 0.3 + r() * 0.45, stor && r() < 0.5, stor ? 0.3 : 0.35); n++;
      }
      // vass och näckrosor i lä (vinden kommer från väst: på öster- och norrsidan)
      for (let k = 0, n = 0; k < 80 && n < 4; k++) {
        const a = Math.atan2(0.33, 0.94) + (r() - 0.5) * 2.2, d = orr * (0.6 + r() * 1.1), x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d, dj = VY - ytaH(x, z);
        if (dj < 0.1 || dj > 0.9) continue;
        vass(Bv, r, x, z, 55 + (r() * 30 | 0), 1.0 + r() * 0.6, 1.1, 1.9, 1.8, a + Math.PI / 2); n++;
      }
      for (let k = 0, n = 0; k < 80 && n < 2; k++) {
        const a = Math.atan2(0.33, 0.94) + (r() - 0.5) * 1.6, d = orr * (1.0 + r() * 1.0), x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d, dj = VY - ytaH(x, z);
        if (dj < 0.4 || dj > 2.2) continue;
        nackros(Bf, r, x, z, 30 + (r() * 20 | 0), 2.0); n++;
      }
    };
    for (let oi = 0; oi < OAR.length; oi++) { holme(OAR[oi], oi); yield; }   // en holme per steg (stegvisa bygget)
    // kobbar: bara sten, en mås på den största
    KOBBAR.forEach(([kx, kz, kr], i) => {
      holmNat(Bg, kx, kz, kr * 1.45, kobbH, 0.22);
      for (let k = 0; k < 2; k++) { const v = r() * 6.283, x = kx + Math.cos(v) * kr * 1.05, z = kz + Math.sin(v) * kr * 0.65, y = Math.max(kobbH(x, z), VY - 0.35); block(Bg, r, x, y, z, 0.2 + r() * 0.2, false, 0.4); }   // små stenar i vattenbrynet
      if (i === 0) { let bx = kx, bz = kz, by = -99; for (let k = 0; k < 30; k++) { const x = kx + (r() - 0.5) * kr, z = kz + (r() - 0.5) * kr * 0.5, y = kobbH(x, z); if (y > by) { by = y; bx = x; bz = z; } } mas(Bf, bx, by - 0.02, bz, r() * 6.28); }
    });
    // prickar (sjömärken): röd och grön stång med toppmärke, guppar
    // (Poly Haven: lateral_sea_marker, en flytande lateralboj; babord röd som i fotot, styrbord omfärgad grön; guppar i skuggaren)
    const PHF = [];
    [[46, 6, true], [70, -18, false]].forEach(([q, l, rod]) => {
      const [x, z] = QL(q, l), an = [x, z, r() * 6.28, 1], c = rod ? [0.72, 0.1, 0.08] : [0.12, 0.42, 0.2];
      hind.push([x, z, 0.25]);
      if (ph.klar()) { PHF.push({ m: 'lateral_sea_marker', x, y: VY - 0.3, z, ry: an[2], s: 0.45, golv: false, flyt: true, farg: rod ? '' : 'gron' }); return; }
      // smal stång (rostig och smutsig vid vattenlinjen), babord röd med cylinder, styrbord grön med kon uppåt
      Bf.add(CYLS(), M(x, VY - 0.5, z, 0.045, 2.3, 0.045), (lx, ly) => ly < 0.3 ? lerp([0.25, 0.17, 0.1], c, mjuk(0.15, 0.3, ly)) : c, { anim: an });
      if (rod) Bf.add(CYLS(), M(x, VY + 1.8, z, 0.11, 0.3, 0.11), c, { anim: an });
      else Bf.add(bas('konS', () => new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0)), M(x, VY + 1.8, z, 0.14, 0.32, 0.14), c, { anim: an });
    });
    // en röd boj (ocean_buoy) längre in i viken, där det är minst 1,5 m djupt
    if (ph.klar()) for (const [q, l] of [[34, -10], [30, 14], [38, 22], [42, -24]]) {
      const [x, z] = QL(q, l); if (VY - ytaH(x, z) < 1.5 || kustQ(x, z) < 25) continue;
      PHF.push({ m: 'ocean_buoy', x, y: VY - 0.32, z, ry: 0.7, s: 0.75, golv: false, flyt: true }); hind.push([x, z, 0.5]); break;
    }
    // segelbåt långt ute: vitt skrov, mast, stor- och försegel; åker sakta runt
    { const [cx, cz] = QL(104, 4), R = 15, an = [cx, cz, r() * 6.28, 2 + R / 1000];
      const skrov = bas('skrov', () => { const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); p.setX(i, p.getX(i) * (1 - Math.max(0, zz) * 0.55)); } g.computeVertexNormals(); return g; });
      Bf.add(skrov, M(0, VY + 0.35, 0, 1.1, 0.7, 3.4), (lx, ly) => ly > -0.25 ? [0.92, 0.92, 0.9] : [0.15, 0.2, 0.32], { anim: an });
      Bf.add(LADA(), M(0, VY + 0.42, -0.6, 1.6, 0.12, 4.4), [0.62, 0.5, 0.36], { anim: an });
      Bf.add(LADA(), M(0, VY + 0.6, -0.4, 1.0, 0.35, 1.4), [0.9, 0.9, 0.88], { anim: an });
      Bf.add(CYL(), M(0, VY + 0.4, 0.4, 0.06, 9, 0.06), [0.85, 0.85, 0.85], { anim: an });
      const segel = (a, b, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); g.computeVertexNormals(); return ickeIdx(g); };
      Bf.add(segel([0.15, 1.1, 0.35], [0.15, 9.2, 0.35], [0.5, 1.2, -3.2]), new THREE.Matrix4().makeTranslation(0, VY, 0), [0.95, 0.94, 0.9], { anim: an });
      Bf.add(segel([0.05, 1.0, 0.5], [0.05, 8.2, 0.45], [0.4, 0.9, 3.1]), new THREE.Matrix4().makeTranslation(0, VY, 0), [0.93, 0.93, 0.9], { anim: an });
    }
    // änder: två par som simmar sakta i viken
    [[30, -22, 4.5], [26, 30, 3.2]].forEach(([q, l, R]) => { const [cx, cz] = QL(q, l); if (VY - ytaH(cx, cz) < 0.4) return; for (let k = 0; k < 2; k++) and(Bf, r, [cx, cz, k * 0.35 + r() * 6, 2 + R / 1000]); });
    // svanpar, en flock knipor och gräsänder och hoppande fisk, med en egen slumpföljd (resten av miljön behåller sin).
    // Banorna är cirklar (tingskuggarens typ 2) som provas mot djupet runt om: aldrig över holmar, vass eller brygga.
    {
      const rl = slump(5150);
      const fri = (cx, cz, R, min) => { for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; if (VY - ytaH(x, z) < min || kustQ(x, z) < 30) return false; } return VY - ytaH(cx, cz) >= min; };
      const hitta = (qmin, qmax, R, min) => { for (let f = 0; f < 300; f++) { const [cx, cz] = QL(qmin + rl() * (qmax - qmin), (rl() - 0.5) * 130); if (fri(cx, cz, R, min)) return [cx, cz]; } return null; };
      let si = 0;
      const R1 = 13 + rl() * 5, c1 = hitta(45, 90, R1, 1.5);
      if (c1) { const f0 = rl() * 6.283; for (let k = 0; k < 2; k++) { const an = [c1[0], c1[1], f0 - k * 1.6 / R1, 2 + R1 / 1000]; svan(Bf, an); LIVU.uSvan.value[si++].set(c1[0], c1[1], an[2], R1); } }
      const R2 = 7 + rl() * 3, c2 = hitta(40, 95, R2 + 0.6, 1.2);
      if (c2) { const f0 = rl() * 6.283; for (let k = 0; k < 6; k++) { const an = [c2[0], c2[1], f0 - k * (0.55 + rl() * 0.4) / R2, 2 + (R2 + (rl() - 0.5) * 0.8) / 1000]; (rl() < 0.6 ? knipa : and)(Bf, rl, an); if (k === 0) LIVU.uSvan.value[si++].set(c2[0], c2[1], an[2], (an[3] - 2) * 1000); } }
      for (let i = 0, f = 0; i < NF && f < 400; f++) {
        const c = hitta(22, 75, 0.9, 1.6); if (!c) break;
        const P = 45 + rl() * 35, fas = 7 + rl() * (P - 8), an = [c[0], c[1], fas, 5 + P / 100];
        fisk(Bf, an); LIVU.uFisk.value[i++].set(c[0], c[1], fas, P);
      }
    }
    // motstranden: svenska sommarstugor (faluröda, vita knutar, altan, syren, flaggstång, brygga), långt bort i diset
    let st = 0; const stP = [];   // byggda stugors lägen: aldrig två tätt intill varandra
    for (let f = 0; f < 200 && st < 5; f++) {
      yield;
      const l = (r() < 0.5 ? -1 : 1) * (48 + r() * 60);
      let q0 = null; for (let q = 100; q < 175; q += 0.5) { const [x, z] = QL(q, l); if (hy(x, z) > VY + 0.6) { q0 = q; break; } }
      if (q0 === null || q0 > 165) continue;
      const qS = q0 + 5 + r() * 4, [x0, z0] = QL(qS, l), y = hy(x0, z0);
      if (y > VY + 6) continue;
      const [x, z] = QL(qS + 12, l);   // 12 m längre upp, där slänten planar ut (provet ovan står kvar: samma slumpföljd)
      const ry = Math.atan2(-KUST[0], -KUST[1]) + (r() - 0.5) * 0.4, b = 5 + r() * 3, d = 4 + r() * 1.5;
      const R2 = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
      // Riktiga svenska sommarstugor (detaljerna drar inga slumptal: resten av miljön behåller sin slumpföljd).
      // Matt faluröd stående panel med lockläkt, vita knutar, vindskivor och fönsteromfattningar med spröjs och
      // mörkt glas med reflex; takfot och utstickande gavlar; tre typer: 1,5-plan, vinkelhus, stuga med altan.
      // Golvet ligger plant på en stensockel som tar upp lutningen; flaggstång, syren och buskar, brygga ner i vattnet.
      const H = k => { const v = Math.sin(st * 91.7 + k * 12.31 + x * 0.37) * 43758.5453; return v - Math.floor(v); };
      const typ = st % 3, FALU = [0.27, 0.065, 0.045], LOCK = [0.13, 0.03, 0.022], VIT = [0.9, 0.9, 0.86], TRA = [0.47, 0.4, 0.31];
      const TI = (H(1) * 3) | 0, TAK = [[0.1, 0.105, 0.115], [0.26, 0.085, 0.055], [0.2, 0.205, 0.215]][TI];
      const TAK2 = TI === 1 ? [0.17, 0.05, 0.033] : TAK.map(v => v * 2.4);   // tegelradernas skugga / plåtens ljusa falsar
      let yF = 0;
      const P = (lx, ly, lz) => { const [px, pz] = R2(lx, lz); return [px, yF + ly, pz]; };
      const box = (lx, ly, lz, sx, sy, sz, c, rx = 0, rz = 0) => Bf.add(LADA(), M(...P(lx, ly, lz), sx, sy, sz, ry, rx, rz), c);
      const boxV = (lx, ly, lz, sx, sy, sz, c, rx = 0) => Bf.add(LADA(), M(...P(lx, ly, lz), sx, sy, sz, ry + Math.PI / 2, rx, 0), c);   // vriden 90° (flygeln)
      const PRISMA = bas('gavelprisma', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([
        -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
        -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
        0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0], 3)); g.computeVertexNormals(); return g; });
      // en huskropp längs lokala x (vrid: flygel längs -z), golv på 0, väggar hv, sadeltak med lutning a
      const kropp = (ox, oz, b, d, hv, a, vrid) => {
        const B = vrid ? boxV : box, L = (u, w) => vrid ? [ox + w, oz - u] : [ox + u, oz + w];
        const rH = (d / 2) * Math.tan(a), ut = 0.45, gl = 0.32;
        B(ox, hv / 2, oz, b, hv, d, FALU);
        // lockläkt: smala lister var 45:e cm på alla fyra väggar
        for (let u = -b / 2 + 0.25; u < b / 2 - 0.15; u += 0.45) for (const s of [-1, 1]) { const [px, pz] = L(u, s * (d / 2 + 0.015)); B(px, hv / 2, pz, 0.07, hv, 0.045, LOCK); }
        for (let w = -d / 2 + 0.25; w < d / 2 - 0.15; w += 0.45) for (const s of [-1, 1]) { const [px, pz] = L(s * (b / 2 + 0.015), w); B(px, hv / 2, pz, 0.045, hv, 0.07, LOCK); }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = L(sx * b / 2, sz * d / 2); B(px, hv / 2, pz, 0.16, hv, 0.16, VIT); }
        // gavelröstena: faluröda trianglar; takfallen med takfot, vita vindskivor och takfotsbräda
        Bf.add(PRISMA, M(...P(ox, hv, oz), b, rH, d, ry + (vrid ? Math.PI / 2 : 0)), FALU);
        const sl = (d / 2 + ut) / Math.cos(a), ym = hv + rH - (d / 2 + ut) / 2 * Math.tan(a);
        for (const s of [-1, 1]) {
          const [px, pz] = L(0, s * (d / 2 + ut) / 2);
          B(px, ym + 0.09, pz, b + gl * 2, 0.2, sl, TAK, s * a);
          if (TI === 1) for (let t = -sl / 2 + 0.2; t < sl / 2; t += 0.34) { const [rx2, rz2] = L(0, s * ((d / 2 + ut) / 2 + t * Math.cos(a))); B(rx2, ym + 0.2 - t * Math.sin(a), rz2, b + gl * 2, 0.035, 0.07, TAK2, s * a); }
          else for (let u = -b / 2 - gl + 0.3; u < b / 2 + gl - 0.1; u += 0.55) { const [rx2, rz2] = L(u, s * (d / 2 + ut) / 2); B(rx2, ym + 0.22, rz2, 0.03, 0.04, sl, TAK2, s * a); }
          for (const sx of [-1, 1]) { const [vx, vz] = L(sx * (b / 2 + gl - 0.02), s * (d / 2 + ut) / 2); B(vx, ym + 0.02, vz, 0.05, 0.2, sl, VIT, s * a); }
          const [fx, fz] = L(0, s * (d / 2 + ut - 0.02)); B(fx, hv - ut * Math.tan(a) - 0.04, fz, b + gl * 2, 0.16, 0.04, VIT);
          // skuggan under takfoten: en mörk list högst upp på väggen
          const [ux, uz] = L(0, s * (d / 2 + 0.02)); B(ux, hv - 0.12, uz, b, 0.24, 0.02, [0.2, 0.055, 0.045]);
        }
        return { L, B, rH, b, d };
      };
      // fönster: vit omfattning, mörkt glas med en ljusare himmelsreflex upptill, spröjs i kors, vit fönsterbleck
      const ruta = (K, u, s, ly, w, h, gavel) => {
        const { L, B } = K, ut = (o, du = 0) => gavel ? L(s * o, u + du) : L(u + du, s * o), dim = (a, c, t) => gavel ? [t, c, a] : [a, c, t], o0 = gavel ? K.b / 2 : K.d / 2;
        const lagg = (o, du, dy, a2, c2, t2, c) => { const [px, pz] = ut(o0 + o, du); B(px, ly + dy, pz, ...dim(a2, c2, t2), c); };
        lagg(0.004, 0, 0, w, h, 0.02, [0.06, 0.075, 0.1]);                                   // glaset, indraget
        lagg(0.012, 0, h * 0.27, w * 0.94, h * 0.34, 0.01, [0.3, 0.38, 0.48]);              // himmelsreflex upptill
        for (const sd of [-1, 1]) lagg(0.01, sd * w * 0.37, -h * 0.05, w * 0.2, h * 0.86, 0.012, [0.86, 0.82, 0.72]);   // gardiner
        lagg(0.02, 0, 0, 0.045, h, 0.03, VIT); lagg(0.02, 0, h * 0.08, w, 0.045, 0.03, VIT);   // spröjs
        for (const sd of [-1, 1]) { lagg(0.035, sd * (w / 2 + 0.05), 0, 0.1, h + 0.2, 0.07, VIT); lagg(0.035, 0, sd * (h / 2 + 0.05), w + 0.2, 0.1, 0.07, VIT); }   // omfattningen
        lagg(0.06, 0, -h / 2 - 0.13, w + 0.32, 0.045, 0.14, VIT);                          // fönsterbleck
      };
      // golvet plant: mitt emellan lägsta och högsta marken under fotavtrycket (med flygeln); nedåt sjön tar stensockeln
      // upp lutningen, uppåt står huset något nedgrävt i slänten
      let lo = 99, hi = -99;
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const [gx, gz] = R2((i / 4 - 0.5) * (b + 1), (j / 4 - 0.5) * (d + 1) - (typ === 1 && j < 2 ? 2.5 : 0)); const g = hy(gx, gz); lo = Math.min(lo, g); hi = Math.max(hi, g); }
      if (hi - lo > 4.5 || stP.some(([px, pz]) => Math.hypot(px - x, pz - z) < 16)) { st++; continue; }   // (st räknas ändå: samma slumpföljd)
      stP.push([x, z]);
      // låg gråsockel som följer marken: golvet 30 cm över marken på sjösidan, uppåt slänten står huset lite nedsänkt
      // (högst 0,9 m); sockeln byggs av block längs väggarna, vart och ett från marken där det står upp till golvet
      yF = Math.max(lo + 0.3, hi - 0.9);
      const hv = typ === 0 ? 3.1 : 2.45, a = typ === 0 ? 0.88 : 0.72;
      const sockel = (ox, oz, bb, dd) => {
        const kant = (u0, w0, u1, w1) => {
          const n = Math.max(1, Math.round(Math.hypot(u1 - u0, w1 - w0) / 0.55));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, u = u0 + (u1 - u0) * t, w = w0 + (w1 - w0) * t, [gx, gz] = R2(ox + u, oz + w), g = hy(gx, gz) - yF;
            if (g > -0.04) continue;                                      // under marken: inget att visa
            const hh = -g + 0.1, lu = Math.abs(u1 - u0) / n + 0.04, lw = Math.abs(w1 - w0) / n + 0.04;
            box(ox + u, g + hh / 2 - 0.08, oz + w, Math.max(lu, 0.22), hh, Math.max(lw, 0.22), (k + (u0 * 7 | 0)) % 3 ? [0.5, 0.49, 0.46] : [0.42, 0.41, 0.39]);
          }
        };
        kant(-bb / 2, dd / 2, bb / 2, dd / 2); kant(-bb / 2, -dd / 2, bb / 2, -dd / 2); kant(-bb / 2, -dd / 2, -bb / 2, dd / 2); kant(bb / 2, -dd / 2, bb / 2, dd / 2);
      };
      sockel(0, 0, b + 0.1, d + 0.1);
      const K = kropp(0, 0, b, d, hv, a, false);
      if (typ === 1) {   // vinkelhus: en smalare flygel bakåt från ena gaveln
        const fb = 4 + H(2) * 1.5, fd = 3.6, ox = (b / 2 - fd / 2) * (H(3) < 0.5 ? -1 : 1), oz = -d / 2 - fb / 2 + 0.3;
        sockel(ox, oz, fd + 0.1, fb + 0.1);
        const KF = kropp(ox, oz, fb, fd, 2.3, 0.72, true);
        ruta(KF, 0, 1, 1.45, 0.75, 0.9, false); ruta(KF, 0, -1, 1.45, 0.75, 0.9, false);
      }
      // långsidan mot sjön: dörr i vit omfattning, fönster med spröjs; gavelfönster (1,5-plan: även övervåningens)
      const dx = typ === 2 ? -b * 0.18 : b > 6.4 ? 0 : -b * 0.22;
      box(dx, 1.06, d / 2 + 0.03, 1.08, 2.16, 0.05, VIT);
      box(dx, 1.0, d / 2 + 0.055, 0.86, 2.0, 0.04, H(4) < 0.35 ? [0.84, 0.82, 0.76] : [0.16, 0.26, 0.2]);
      box(dx + 0.3, 1.0, d / 2 + 0.09, 0.05, 0.05, 0.06, [0.75, 0.7, 0.5]);                       // handtag
      (typ === 2 ? [b * 0.18, b * 0.36] : dx === 0 ? [-b * 0.3, b * 0.3] : [b * 0.08, b * 0.32]).forEach(u => ruta(K, u, 1, 1.45, 0.85, 1.0, false));
      ruta(K, -b * 0.2, -1, 1.45, 0.75, 0.9, false);
      for (const s of [-1, 1]) ruta(K, 0, s, typ === 0 ? hv + 0.75 : 1.5, 0.7, 0.85, true);
      if (typ === 0) for (const s of [-1, 1]) ruta(K, 0, s, 1.4, 0.8, 0.95, true);
      // farstukvist/altan: golv med kantbräda, kraftiga stolpar ner i marken, vitt räcke med spjälor och handledare
      const aw = typ === 2 ? 3.6 : 2.2, ad = typ === 2 ? 2.2 : 1.5, ax = typ === 2 ? dx + 0.9 : dx;
      box(ax, -0.07, d / 2 + ad / 2, aw, 0.1, ad, TRA);
      box(ax, -0.16, d / 2 + ad - 0.02, aw, 0.18, 0.05, [0.86, 0.86, 0.82]);                    // kantbräda (vit)
      for (const sx of [-1, 1]) box(ax + sx * (aw / 2 - 0.02), -0.16, d / 2 + ad / 2, 0.05, 0.18, ad, [0.86, 0.86, 0.82]);
      const stolpe = (u, w, topp) => { const [gx, gz] = R2(u, w), g = hy(gx, gz) - yF - 0.05; box(u, (g + topp) / 2, w, 0.16, topp - g, 0.16, VIT); };
      const takKvist = typ !== 2;
      for (const sx of [-1, 1]) stolpe(ax + sx * (aw / 2 - 0.1), d / 2 + ad - 0.1, takKvist ? 2.45 : 1.0);
      for (const sx of [-1, 1]) stolpe(ax + sx * (aw / 2 - 0.1), d / 2 + 0.12, 1.0);
      const racke = (u0, w0, u1, w1) => {   // handledare, nedre slå och spjälor var 12:e cm
        const L = Math.hypot(u1 - u0, w1 - w0), lang = Math.abs(u1 - u0) > Math.abs(w1 - w0), um = (u0 + u1) / 2, wm = (w0 + w1) / 2;
        box(um, 0.95, wm, lang ? L : 0.09, 0.06, lang ? 0.09 : L, VIT); box(um, 0.12, wm, lang ? L : 0.06, 0.05, lang ? 0.06 : L, VIT);
        for (let t = 0.12; t < L - 0.06; t += 0.12) { const u = u0 + (u1 - u0) * t / L, w = w0 + (w1 - w0) * t / L; box(u, 0.53, w, 0.035, 0.8, 0.035, VIT); }
      };
      for (const sx of [-1, 1]) racke(ax + sx * (aw / 2 - 0.1), d / 2 + 0.12, ax + sx * (aw / 2 - 0.1), d / 2 + ad - 0.1);
      for (const sx of [-1, 1]) racke(ax + sx * (aw / 2 - 0.1), d / 2 + ad - 0.1, ax + sx * 0.62, d / 2 + ad - 0.1);
      { // trätrappan: steg om 18 cm ner till marken mellan två kraftiga vangstycken, vit ledstång på stolpar
        const [tx, tz] = R2(ax, d / 2 + ad + 0.8), fall = Math.max(0.2, yF - hy(tx, tz)), n = Math.max(1, Math.round(fall / 0.18)), hs = fall / n, L2 = n * 0.28;
        for (let k = 0; k < n; k++) box(ax, -(k + 1) * hs + 0.03, d / 2 + ad + 0.14 + k * 0.28, 1.1, 0.05, 0.3, TRA);
        const lut = Math.atan2(fall, L2), lv = Math.hypot(fall, L2) + 0.2;
        if (n >= 3) for (const sx of [-1, 1]) {   // (ett–två steg: bara stegen, inga vangstycken eller ledstång)
          box(ax + sx * 0.6, -fall / 2 - 0.05, d / 2 + ad + L2 / 2, 0.07, 0.3, lv, TRA, lut);
          box(ax + sx * 0.6, -fall / 2 + 0.88, d / 2 + ad + L2 / 2, 0.07, 0.06, lv - 0.2, VIT, lut);
          box(ax + sx * 0.6, -fall + 0.42, d / 2 + ad + L2 - 0.08, 0.09, 0.95, 0.09, VIT);
        }
        // grusgång i marken: tunna ytor som följer markens lutning, nästan i nivå med gräset
        for (let w = d / 2 + ad + L2 + 0.3; w < d / 2 + ad + L2 + 10; w += 0.5) {
          const [gx, gz] = R2(ax + (w - d / 2) * 0.05, w), gy = hy(gx, gz); if (gy < VY + 0.2) break;
          const [ax2, az2] = R2(ax + (w - d / 2) * 0.05, w - 0.35), [bx2, bz2] = R2(ax + (w - d / 2) * 0.05, w + 0.35), lt = Math.atan2(hy(ax2, az2) - hy(bx2, bz2), 0.7);
          Bf.add(LADA(), M(gx, gy + 0.008, gz, 0.9, 0.02, 0.72, ry, lt, 0), (w * 4 | 0) % 2 ? [0.58, 0.55, 0.48] : [0.55, 0.52, 0.46]);
        }
      }
      if (takKvist) for (const s of [-1, 1]) box(ax + s * aw * 0.26, 2.6, d / 2 + ad / 2, aw * 0.6, 0.12, ad + 0.3, TAK, 0, -s * 0.6);
      // skorsten: putsad, svart plåthuv
      box(b * 0.24, hv + K.rH * 0.6 + 0.5, -d * 0.1, 0.5, K.rH + 1.0, 0.5, [0.6, 0.56, 0.52]);
      box(b * 0.24, hv + K.rH * 1.1 + 1.02, -d * 0.1, 0.62, 0.07, 0.62, [0.12, 0.12, 0.12]);
      // (inga buskar: de klotformade lästes som bollar)
      // flaggstång med svensk flagga vid varannan stuga
      if (st % 2 === 0) {
        const fu = -b / 2 - 3, fw = d / 2 + 3, [px, pz] = R2(fu, fw), gy = hy(px, pz);
        Bf.add(CYL(), M(px, gy, pz, 0.06, 8.5, 0.06), VIT); Bf.add(KLOT(), M(px, gy + 8.55, pz, 0.1, 0.1, 0.1), [0.8, 0.66, 0.2]);
        const flagg = (u, sx, sy, c) => { const [qx, qz] = R2(fu + u, fw); Bf.add(LADA(), M(qx, gy + 7.9, qz, sx, sy, 0.03, ry), c); };
        flagg(0.82, 1.6, 1.0, [0.06, 0.3, 0.6]); flagg(0.62, 0.2, 1.0, [0.98, 0.8, 0.12]); flagg(0.82, 1.6, 0.2, [0.98, 0.8, 0.12]);
      }
      // brygga ner i vattnet (mot sjön, lokala +z): spång från strandkanten ut till ungefär 1 m djup
      { let s0 = null, s1 = null;
        for (let w = d / 2 + 1; w < 40; w += 0.25) { const [px, pz] = R2(b * 0.3, w), g = hy(px, pz); if (s0 === null && g < VY + 0.15) s0 = w; if (s0 !== null && g < VY - 0.9) { s1 = w; break; } }
        if (s0 !== null && s0 < 26) {
          s1 = Math.min(s1 || s0 + 7, s0 + 9);
          const [px, pz] = R2(b * 0.3, (s0 - 1.5 + s1) / 2);
          Bf.add(LADA(), M(px, VY + 0.42, pz, 1.4, 0.08, s1 - s0 + 1.5, ry), TRA);
          for (let w = s0; w <= s1 + 0.01; w += 1.6) for (const sx of [-0.62, 0.62]) { const [qx, qz] = R2(b * 0.3 + sx, w); Bf.add(CYL(), M(qx, VY - 1.2, qz, 0.08, 1.6, 0.08), [0.3, 0.25, 0.2]); }
          const [qx, qz] = R2(b * 0.3, s1 + 0.1); Bf.add(LADA(), M(qx, VY + 0.42, qz, 2.6, 0.08, 1.6, ry), TRA);
        }
      }
      hind.push([x, z, b * 0.8]);
      st++;
    }
    yield;
    lagHinder(hind);
    const ut = [nat(Bg, granitMat(), 'sjo-holmar'), nat(Bv, vaxtMat(), 'sjo-holmvaxter', { fast: false }), nat(Bk, barrMat(), 'sjo-tallbarr', { fast: false }), nat(Bs, barkMat(), 'sjo-tallstammar', { fast: false }), nat(Bf, tingMat(), 'sjo-fjarr', { fast: false })].filter(Boolean);
    if (PHF.length) ut.push(ph.grupp(PHF, 'ph-sjo-fjarr', { lager: LAGER }));   // sjömärkena och bojen (husritare-ph.js)
    ut.stugor = stP;   // motstrandens stugor [x, z] (miljön håller strandblocken borta från deras bryggor)
    return ut;
  }

  // ---- nära setet: sjötomtens detaljer, byggs per hus ----
  // b: bryggan (husritare-miljo.js bryggaDel), krav/kant: miljöns regler (siktgator, avstånd till huset)
  function nara(mal, b, krav, kant, r) { return korG(naraG(mal, b, krav, kant, r)); }
  function* naraG(mal, b, krav, kant, r) {   // stegvis (se miljöns byggG)
    if (AV) return { nat: [] };
    const Bt = bygg(), Bv = bygg(), Bg = Bt, hind = [];   // stenarna nära i samma nät som tingen (ett ritanrop)
    const fri = [];   // upptagna platser [x, z, radie]
    const PHT = [], phPa = ph.klar(), xz = ([x, z]) => ({ x, z });   // Poly Haven-rekvisita på sjötomten (husritare-ph.js), en grupp sist
    const ledig = (x, z, rr) => fri.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + rr);
    const ta = (x, z, rr) => fri.push([x, z, rr]);
    const strandD = (g) => { const a = g * Math.PI / 180; for (let d = 6; d < 60; d += 0.2) if (hy(Math.cos(a) * d, Math.sin(a) * d) < VY) return d; return null; };
    const framfor = (x, z) => { const a = Math.atan2(z, x) * 180 / Math.PI, rr = Math.hypot(x, z); return a > 15 && a < 165 && rr < 34; };   // framför huset (kamerans sida): inget högt
    // bryggans spång och själva bryggan hålls fria
    // (team-mark) byggda ytor som växter ska hålla sig från: [cx, cz, ux, uz, halvlängd längs u, halvbredd] – bryggan med spången,
    // sjöboden med bryggdäck och gångbrygga; rektAv = avstånd till närmaste (0 inuti)
    const rektar = [], rektAv = (x, z) => { let m = 99; for (const [cx, cz, ux, uz, hl, hb] of rektar) { const px = x - cx, pz = z - cz, a = Math.abs(px * ux + pz * uz) - hl, c = Math.abs(-px * uz + pz * ux) - hb; m = Math.min(m, Math.hypot(Math.max(a, 0), Math.max(c, 0))); } return m; };
    if (b) { const l0 = b.dStart - 0.6, l1 = b.d1 + 0.3; rektar.push([b.dx * (l0 + l1) / 2, b.dz * (l0 + l1) / 2, b.dx, b.dz, (l1 - l0) / 2, 1.0]); }
    if (b) { for (let d = b.dStart; d < b.d1 + 1; d += 1.5) ta(b.dx * d, b.dz * d, 2.2); }
    const R2 = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const roda = [0.43, 0.13, 0.09], vit = [0.88, 0.88, 0.84];   // falu rödfärg: matt, mörk, dragning åt brunt
    // -- sjöbod: matt falu rödfärg, vita knutar och vindskivor, svart papptak, pardörrar mot sjön. Den står som en
    // riktig sjöbod ute i vattnet på tjärade pålar, med ett litet bryggdäck på landgaveln och en gångbrygga in till
    // stranden. Ute i vattnet finns varken hällar eller holmnätets granit (sjo-holmar ritas bara där ytan är över VY − 0,35),
    // så inget berg kan gå igenom boden --
    const W = 3.4, D = 4.2, HV = 2.2;
    // ytan som den ritas: marken (hy och det grova marknätet), holmnätet runt skären och kobbarna
    const yta = (x, z) => { let h = Math.max(hy(x, z), grov(x, z), ytaH(x, z)); for (const [ox, oz, orr] of OAR) if (Math.abs(x - ox) < orr * 2.3 && Math.abs(z - oz) < orr * 2.3) { h = Math.max(h, holmH(x, z)); break; } return h; };
    const sjobod = () => {
      const kand = [], y0 = VY + 0.72, PD = 1.3;   // golvets höjd, bryggdäckets djup på landgaveln
      for (let g = -215; g <= -95; g += 3) {
        const d = strandD(g); if (!d) continue;
        const a = g * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a);
        if (b && Math.abs(((g - Math.atan2(b.dz, b.dx) * 180 / Math.PI + 540) % 360) - 180) < 16) continue;
        if (Math.abs(g + 177) < 12) continue;   // den skannade stenbanken (strandstenar() i husritare-miljo.js) ligger vid −177°
        for (const ut of [3.2, 4.2, 5.2, 6.4, 7.6, 9, 10.5]) {
          const x = ux * (d + ut), z = uz * (d + ut), ry = Math.atan2(ux, uz), Lk = R2(x, z, ry);
          // (ute på vattnet räcker det att boden står minst 21 m bort: den är låg och siktgatorna går över den)
          if (!krav(x, z, 'liten') && !(Math.hypot(x, z) > 21 && krav(x, z, 'lag'))) continue;
          if (mal.blockerad(x, z, 3.2) || !ledig(x, z, 4)) continue;
          // hela boden och dess bryggdäck över vatten som är minst 6 dm djupt (inga hällar under)
          let ok = true;
          for (let i = 0; i <= 4 && ok; i++) for (let j = 0; j <= 5 && ok; j++) if (yta(...Lk((i / 4 - 0.5) * (W + 0.8), D / 2 + 0.4 - j / 5 * (D + 0.4 + PD))) > VY - 0.6) ok = false;
          if (!ok) continue;
          // gångbryggan in mot land: tills ytan når nästan upp till golvet (högst 9 m)
          let lg = null;
          for (let l = 0.4; l < 9; l += 0.2) { const p = Lk(0, -D / 2 - PD - l); if (yta(...p) > y0 - 0.42) { lg = l; break; } }
          if (lg === null) continue;
          kand.push([lg * 0.4 + Math.abs(g + 176) * 0.015 + ut * 0.1, x, z, a, lg]);
        }
      }
      if (!kand.length) return;
      kand.sort((p, q) => p[0] - q[0]);
      const [, x, z, a, lg] = kand[0], ry = Math.atan2(Math.cos(a), Math.sin(a)), L = R2(x, z, ry);
      ta(x, z, 4); { const [gx, gz] = L(0, -D / 2 - PD - lg / 2); ta(gx, gz, 1.5); }
      { const [ox, oz] = L(0, 0), [vx, vz] = L(0, 1), z0 = D / 2 + 0.1, z1 = -D / 2 - PD - lg - 0.3, [cx, cz] = L(0, (z0 + z1) / 2);   // (team-mark) bod + däck + gångbrygga
        rektar.push([cx, cz, vx - ox, vz - oz, (z0 - z1) / 2, W / 2 + 0.25]); }
      TXT = 1;   // pålar, syllar, bryggdäck och gångbrygga: naturligt trä
      const tjara = [0.24, 0.21, 0.18], gra = [0.55, 0.52, 0.47];
      // pålar: tjärade stockar ner i botten, med en ljusare torr ring ovanför vattnet
      const pale = (lx, lz, top) => { const [px, pz] = L(lx, lz), bot = yta(px, pz) - 0.4; Bt.add(CYLS(), M(px, bot, pz, 0.1, top - bot, 0.1, r() * 6.28), (l2, ly, l3, nx, ny, nz, wx, wy) => wy > VY + 0.05 ? skala(tjara, 1.35) : wy > VY - 0.25 ? [0.16, 0.19, 0.13] : tjara); hind.push([px, pz, 0.14]); };
      for (const lx of [-W / 2 + 0.15, 0, W / 2 - 0.15]) for (const lz of [-D / 2 + 0.15, 0, D / 2 - 0.15]) pale(lx, lz, y0 - 0.17);
      for (const lx of [-W / 2 + 0.15, W / 2 - 0.15]) { const [px, pz] = L(lx, 0); Bt.add(LADA(), M(px, y0 - 0.2, pz, 0.16, 0.16, D + 0.2, ry), skala(tjara, 1.3)); }   // syllar
      // bryggdäck på landgaveln (bänk under fönstret) och gångbryggan in till stranden, tvärlagda grå brädor
      const plankor = (lz0, lz1, bredd, yy) => { for (let lz = lz0; lz > lz1; lz -= 0.16) { const [px, pz] = L((r() - 0.5) * 0.02, lz - 0.075), c = vari(gra, r, 0.08); Bt.add(LADA(), M(px, yy, pz, bredd, 0.035, 0.14, ry), (l2, ly) => skala(c, ly > 0 ? 1 : 0.7)); } };
      plankor(-D / 2 - 0.02, -D / 2 - PD, W + 0.3, y0 - 0.03);
      for (const lx of [-W / 2, W / 2]) { pale(lx, -D / 2 - PD + 0.12, y0 - 0.07); const [px, pz] = L(lx, -D / 2 - PD / 2); Bt.add(LADA(), M(px, y0 - 0.12, pz, 0.08, 0.14, PD, ry), skala(tjara, 1.3)); }
      plankor(-D / 2 - PD, -D / 2 - PD - lg, 1.0, y0 - 0.03);
      for (const s of [-0.45, 0.45]) {
        const [px, pz] = L(s, -D / 2 - PD - lg / 2); Bt.add(LADA(), M(px, y0 - 0.12, pz, 0.07, 0.14, lg, ry), skala(tjara, 1.3));
        for (let l = 1.6; l < lg - 0.3; l += 1.8) { const [qx, qz] = L(s, -D / 2 - PD - l); if (yta(qx, qz) < y0 - 0.35) pale(s, -D / 2 - PD - l, y0 - 0.07); }
      }
      // en grov sten i landänden som trappsteg upp på gångbryggan
      { const [px, pz] = L(0, -D / 2 - PD - lg - 0.25), g = yta(px, pz), h = y0 - 0.2 - g; if (h > 0.05) Bt.add(knol('trappsten', 7, 0.18, 8, 5), M(px, g + h * 0.4, pz, 0.6, Math.max(0.12, h * 0.7), 0.35, ry), (l2, ly, l3, nx, ny) => skala([0.46, 0.44, 0.42], 0.7 + 0.3 * ny), { tx: 2 }); }
      Bt.add(LADA(), M(...(() => { const [px, pz] = L(0, 0); return [px, y0 - 0.06, pz]; })(), W + 0.1, 0.12, D + 0.1, ry), [0.3, 0.25, 0.2]);
      TXT = 4;   // väggar, knutar, dörrar och fönsterfoder: målat trä
      // väggbrädor (lockpanel): stående brädor med smala lock
      const bradVagg = (lx0, lz0, lx1, lz1, hfn, nrm) => {
        // på gavlarna delas varje bräda i tre smala remsor, så att överkanten följer takfallet utan synliga trappsteg
        const lang = Math.hypot(lx1 - lx0, lz1 - lz0), gav = !!nrm[1], m = gav ? 3 : 1, n = Math.max(2, Math.round(lang / 0.22)) * m, cs = [];
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, lx = lx0 + (lx1 - lx0) * t, lz = lz0 + (lz1 - lz0) * t, hh = hfn(lx), [px, pz] = L(lx + nrm[0] * 0.02, lz + nrm[1] * 0.02);
          const c = cs[i / m | 0] || (cs[i / m | 0] = vari(roda, r, 0.06)), bw = lang / n + (i % m === m - 1 ? -0.01 : 0.002);
          Bt.add(LADA(), M(px, y0 + hh / 2, pz, nrm[0] ? 0.04 : bw, hh, nrm[0] ? bw : 0.04, ry), (lx2, ly) => skala(c, 0.84 + 0.12 * (ly + 0.5)));
          if ((i / m | 0) % 2 === 0 && i % m === (m >> 1)) { const [qx, qz] = L(lx + nrm[0] * 0.05, lz + nrm[1] * 0.05); Bt.add(LADA(), M(qx, y0 + hh / 2, qz, nrm[0] ? 0.03 : 0.05, hh, nrm[0] ? 0.05 : 0.03, ry), skala(c, 0.85)); }
        }
      };
      const tak = HV + W / 2 * 0.8;
      bradVagg(-W / 2, -D / 2, -W / 2, D / 2, () => HV, [-1, 0]);
      bradVagg(W / 2, -D / 2, W / 2, D / 2, () => HV, [1, 0]);
      const gavel = lx => HV + (tak - HV) * Math.max(0, 1 - Math.abs(lx) / (W / 2));
      bradVagg(-W / 2, -D / 2, W / 2, -D / 2, gavel, [0, -1]);
      bradVagg(-W / 2, D / 2, -W * 0.33, D / 2, gavel, [0, 1]); bradVagg(W * 0.33, D / 2, W / 2, D / 2, gavel, [0, 1]);
      // pardörrar mot sjön (lite mörkare röd, vita foder) och gavelns överstycke
      for (const s of [-1, 1]) { const [px, pz] = L(s * W * 0.165, D / 2 + 0.03); Bt.add(LADA(), M(px, y0 + 0.95, pz, W * 0.32, 1.9, 0.05, ry), skala(roda, 0.82)); const [kx, kz] = L(s * W * 0.165, D / 2 + 0.07); Bt.add(LADA(), M(kx, y0 + 0.95, kz, 0.06, 1.75, 0.03, ry, 0, s * 0.72), skala(roda, 0.7)); }
      for (let i = 0; i < 27; i++) { const lx = -W * 0.33 + (i + 0.5) * W * 0.66 / 27, hh = gavel(lx) - 1.9, [px, pz] = L(lx, D / 2 + 0.02); if (hh > 0.02) Bt.add(LADA(), M(px, y0 + 1.9 + hh / 2, pz, W * 0.66 / 27 + 0.002, hh, 0.05, ry), vari(roda, r, 0.03)); }   // gavelspetsen över dörrarna
      // dörrarnas reglar (överst och nederst) i samma röda
      for (const s of [-1, 1]) for (const yy of [0.28, 1.62]) { const [px, pz] = L(s * W * 0.165, D / 2 + 0.065); Bt.add(LADA(), M(px, y0 + yy, pz, W * 0.3, 0.12, 0.03, ry), skala(roda, 0.74)); }
      for (const s of [-1, 1]) { const [px, pz] = L(s * W * 0.335, D / 2 + 0.06); Bt.add(LADA(), M(px, y0 + 1.0, pz, 0.1, 2.0, 0.04, ry), vit); }
      { const [px, pz] = L(0, D / 2 + 0.06); Bt.add(LADA(), M(px, y0 + 1.95, pz, W * 0.7, 0.1, 0.04, ry), vit); }
      // vita knutar och vindskivor
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = L(sx * (W / 2 + 0.03), sz * (D / 2 + 0.03)); Bt.add(LADA(), M(px, y0 + HV / 2, pz, 0.13, HV, 0.13, ry), vit); }
      const vinkel = Math.atan2(tak - HV, W / 2), sl = Math.hypot(W / 2, tak - HV) + 0.35;
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const [px, pz] = L(sx * W / 4, sz * (D / 2 + 0.2)); Bt.add(LADA(), M(px, y0 + (HV + tak) / 2 + 0.12, pz, sl, 0.16, 0.04, ry, 0, -sx * vinkel), vit); }
      // gavelns överkant: en bräda i skugga längs takfallet tätt på väggen (döljer panelens trappsteg mot taket)
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const [px, pz] = L(sx * W / 4, sz * (D / 2 + 0.08)); Bt.add(LADA(), M(px, y0 + (HV + tak) / 2 + 0.01, pz, Math.hypot(W / 2, tak - HV) + 0.06, 0.17, 0.03, ry, 0, -sx * vinkel), skala(roda, 0.5)); }
      // fönster: vit karm med foder och bleck, spröjsat (fyra rutor), glaset speglar himlen upptill och är mörkt nertill
      const glas = (lx, ly) => lerp([0.05, 0.065, 0.08], [0.62, 0.7, 0.76], mjuk(-0.1, 0.5, ly + lx * 0.25));
      const fonster = (lx, lz, yc, n, w, h) => {   // n: väggens normal [nx, nz] i bodens lokala ram
        const P = o => L(lx + n[0] * o, lz + n[1] * o), X = (a, b2) => n[0] ? a : b2;
        { const [px, pz] = P(0.05); Bt.add(LADA(), M(px, yc, pz, X(0.04, w + 0.14), h + 0.14, X(w + 0.14, 0.04), ry), vit); }                     // foder
        { const [px, pz] = P(0.065); Bt.add(LADA(), M(px, yc, pz, X(0.03, w - 0.04), h - 0.04, X(w - 0.04, 0.03), ry), glas); }                 // glas
        { const [px, pz] = P(0.08); Bt.add(LADA(), M(px, yc, pz, X(0.025, 0.035), h - 0.02, X(0.035, 0.025), ry), vit);                        // spröjs
          Bt.add(LADA(), M(px, yc, pz, X(0.025, w - 0.02), 0.035, X(w - 0.02, 0.025), ry), vit); }
        for (const s of [-1, 1]) { const [px, pz] = L(lx + n[0] * 0.075 + X(0, s * (w / 2 - 0.01)), lz + n[1] * 0.075 + X(s * (w / 2 - 0.01), 0)); Bt.add(LADA(), M(px, yc, pz, X(0.025, 0.03), h, X(0.03, 0.025), ry), vit); }   // karm
        for (const s of [-1, 1]) { const [px, pz] = P(0.075); Bt.add(LADA(), M(px, yc + s * (h / 2 - 0.01), pz, X(0.025, w), 0.03, X(w, 0.025), ry), vit); }
        { const [px, pz] = P(0.1); Bt.add(LADA(), M(px, yc - h / 2 - 0.09, pz, X(0.1, w + 0.2), 0.025, X(w + 0.2, 0.1), ry, 0, 0), [0.82, 0.82, 0.8]); }   // fönsterbleck
      };
      fonster(0.98, -D / 2 - 0.02, y0 + 1.45, [0, -1], 0.56, 0.5);     // gavelfönster på landsidan (vid sidan av dörren)
      // dörr på landgaveln mot bryggdäcket (så att man kan gå in från gångbryggan): rödmålad bräddörr med
      // Z-regel, vitt foder, tröskel, gångjärn till vänster och handtag med låsbleck till höger
      { const dw = 0.8, dh = 1.9, P = (lx, o) => L(lx, -D / 2 - o);
        { const [px, pz] = P(0, 0.03); Bt.add(LADA(), M(px, y0 + dh / 2, pz, dw, dh, 0.05, ry), skala(roda, 0.82)); }
        for (let i = 1; i < 5; i++) { const [px, pz] = P(-dw / 2 + i * dw / 5, 0.057); Bt.add(LADA(), M(px, y0 + dh / 2, pz, 0.012, dh - 0.04, 0.006, ry), skala(roda, 0.6)); }   // brädornas fogar
        for (const yy of [0.25, 1.62]) { const [px, pz] = P(0, 0.065); Bt.add(LADA(), M(px, y0 + yy, pz, dw - 0.06, 0.11, 0.03, ry), skala(roda, 0.74)); }   // reglar
        { const [px, pz] = P(0, 0.066), v = Math.atan2(1.62 - 0.25, dw - 0.12); Bt.add(LADA(), M(px, y0 + (0.25 + 1.62) / 2, pz, Math.hypot(dw - 0.12, 1.37), 0.1, 0.028, ry, 0, -v), skala(roda, 0.7)); }   // snedsträvan (Z)
        for (const sx of [-1, 1]) { const [px, pz] = P(sx * (dw / 2 + 0.045), 0.05); Bt.add(LADA(), M(px, y0 + (dh + 0.06) / 2, pz, 0.09, dh + 0.06, 0.04, ry), vit); }   // foder
        { const [px, pz] = P(0, 0.05); Bt.add(LADA(), M(px, y0 + dh + 0.07, pz, dw + 0.22, 0.09, 0.045, ry), vit); }
        { const [px, pz] = P(0, 0.09); Bt.add(LADA(), M(px, y0 + dh + 0.125, pz, dw + 0.3, 0.02, 0.1, ry), [0.82, 0.82, 0.8]); }   // droppbleck
        { const [px, pz] = P(0, 0.04); Bt.add(LADA(), M(px, y0 + 0.015, pz, dw + 0.1, 0.03, 0.12, ry), [0.4, 0.37, 0.33]); }   // tröskel
        for (const yy of [0.32, 1.55]) { const [px, pz] = P(-dw / 2 + 0.17, 0.075); Bt.add(LADA(), M(px, y0 + yy, pz, 0.32, 0.035, 0.012, ry), [0.08, 0.08, 0.08]); }   // gångjärn
        { const [px, pz] = P(dw / 2 - 0.1, 0.07); Bt.add(LADA(), M(px, y0 + 1.0, pz, 0.05, 0.15, 0.012, ry), [0.12, 0.12, 0.12]);
          const [hx, hz] = P(dw / 2 - 0.1, 0.1); Bt.add(LADA(), M(hx, y0 + 1.0, hz, 0.11, 0.022, 0.022, ry), [0.06, 0.06, 0.06]); }   // handtag
      }
      fonster(W / 2 + 0.02, -1.1, y0 + 1.35, [1, 0], 0.7, 0.6);     // på långsidan
      TXT = 0;   // papp
      // tak: svart papp med läkt
      for (const sx of [-1, 1]) { const [px, pz] = L(sx * W / 4 * 1.05, 0); Bt.add(LADA(), M(px, y0 + (HV + tak) / 2 + 0.12, pz, sl + 0.05, 0.07, D + 0.6, ry, 0, -sx * vinkel), [0.14, 0.14, 0.155]); }
      { const [px, pz] = L(0, 0); Bt.add(LADA(), M(px, y0 + tak + 0.14, pz, 0.14, 0.08, D + 0.62, ry), [0.09, 0.09, 0.1]); }
      // pappens trekantlister nerför takfallen (var 60:e cm), fångar ljuset lite mer än pappen
      for (const sx of [-1, 1]) for (let zk = -D / 2 - 0.22; zk <= D / 2 + 0.25; zk += (D + 0.44) / 8) {
        const [px, pz] = L(sx * (W / 4 * 1.05 + Math.sin(vinkel) * 0.05), zk);
        Bt.add(LADA(), M(px, y0 + (HV + tak) / 2 + 0.12 + Math.cos(vinkel) * 0.05, pz, sl + 0.03, 0.035, 0.04, ry, 0, -sx * vinkel), (lx, ly) => ly > 0 ? [0.2, 0.2, 0.215] : [0.1, 0.1, 0.11]);
      }
      // takfot: vit takfotsbräda längs takkanten och mörk plåtkant ovanpå, tak med synlig tjocklek
      for (const sx of [-1, 1]) {
        const ex = W / 4 * 1.05 + (sl + 0.05) / 2 * Math.cos(vinkel), ey = y0 + (HV + tak) / 2 + 0.12 - (sl + 0.05) / 2 * Math.sin(vinkel);
        const [px, pz] = L(sx * (ex + 0.015), 0); Bt.add(LADA(), M(px, ey - 0.07, pz, 0.035, 0.16, D + 0.64, ry), vit);
        const [qx, qz] = L(sx * (ex + 0.035), 0); Bt.add(LADA(), M(qx, ey + 0.02, qz, 0.02, 0.05, D + 0.66, ry), [0.1, 0.1, 0.11]);
        const [ux, uz] = L(sx * W / 4 * 1.05, 0); Bt.add(LADA(), M(ux, y0 + (HV + tak) / 2 + 0.05, uz, sl, 0.06, D + 0.58, ry, 0, -sx * vinkel), [0.36, 0.3, 0.25]);   // råspont under pappen
      }
      // gångjärn och regel på pardörrarna
      for (const s of [-1, 1]) for (const hy2 of [0.45, 1.5]) { const [px, pz] = L(s * W * 0.27, D / 2 + 0.06); Bt.add(LADA(), M(px, y0 + hy2, pz, 0.3, 0.04, 0.015, ry), [0.08, 0.08, 0.08]); }
      { const [px, pz] = L(0, D / 2 + 0.07); Bt.add(LADA(), M(px, y0 + 1.05, pz, 0.24, 0.05, 0.02, ry), [0.1, 0.1, 0.1]); }
      // livboj på långsidan, åror lutade mot väggen
      { const [px, pz] = L(W / 2 + 0.09, 0.6); const g = bas('boj', () => new THREE.TorusGeometry(0.28, 0.065, 6, 14)); Bt.add(g, M(px, y0 + 1.35, pz, 1, 1, 1, ry + Math.PI / 2), (lx, ly) => (Math.floor((Math.atan2(ly, lx) + Math.PI) / (Math.PI / 4)) % 2) ? [0.85, 0.12, 0.08] : [0.93, 0.92, 0.9]); }
      // dörrhandtag och låsbleck på högra dörren
      { const [px, pz] = L(0.22, D / 2 + 0.065); Bt.add(LADA(), M(px, y0 + 1.0, pz, 0.06, 0.16, 0.012, ry), [0.12, 0.12, 0.12]);
        const [hx, hz] = L(0.22, D / 2 + 0.11); Bt.add(LADA(), M(hx, y0 + 1.0, hz, 0.022, 0.15, 0.022, ry), [0.06, 0.06, 0.06]);
        for (const s of [-1, 1]) { const [qx, qz] = L(0.22, D / 2 + 0.085); Bt.add(LADA(), M(qx, y0 + 1.0 + s * 0.06, qz, 0.016, 0.016, 0.05, ry), [0.06, 0.06, 0.06]); } }
      // fiskenät upphängt på en stång på landgaveln, med korkflöten upptill och några åror lutade mot långsidan
      // nätet: glest maskverk av tunna trådar i två diagonala riktningar, hopsamlat nertill och lite utbuktande
      { const nx = -1.05, topp = y0 + 1.8, NH = 1.0, P = (u, t) => { const [qx, qz] = L(nx + (u - 0.5) * (0.9 - 0.32 * t), -D / 2 - 0.1 - 0.05 * t - 0.03 * Math.sin(t * 3.1)); return [qx, topp - t * NH + 0.02 * Math.sin(u * 9) * t, qz]; };
        for (const fam of [1, -1]) for (let c = -0.4; c <= 1.4; c += 0.09) for (let t = 0; t < 0.99; t += 0.2) {
          const u0 = c + fam * t * 0.4, u1 = c + fam * (t + 0.2) * 0.4;
          if (u0 < 0 || u0 > 1 || u1 < 0 || u1 > 1) continue;
          Bt.add(CYL(), MAB(P(u0, t), P(u1, t + 0.2), 0.0045), [0.4, 0.42, 0.33]);
        }
        for (const t of [0, 1]) for (let u = 0; u < 0.99; u += 0.25) Bt.add(CYL(), MAB(P(u, t), P(u + 0.25, t), 0.009), t ? [0.3, 0.3, 0.28] : [0.6, 0.55, 0.42]);   // överlina och blylina
        const [sx, sz] = L(nx, -D / 2 - 0.12); Bt.add(LADA(), M(sx, y0 + 1.86, sz, 1.25, 0.035, 0.035, ry), [0.5, 0.44, 0.36]);   // stången
        for (const s of [-1, 1]) { const [kx, kz] = L(nx + s * 0.55, -D / 2 - 0.09); Bt.add(LADA(), M(kx, y0 + 1.86, kz, 0.03, 0.03, 0.08, ry), [0.3, 0.26, 0.22]); }
        for (let i = 0; i < 7; i++) { const [fx, fz] = L(nx - 0.42 + i * 0.14, -D / 2 - 0.135); Bt.add(CYLS(), M(fx, y0 + 1.72 + (i % 2) * 0.02, fz, 0.032, 0.07, 0.032, ry, 0, Math.PI / 2), [0.78, 0.55, 0.28]); }
        for (let i = 0; i < 6; i++) { const [fx, fz] = L(nx - 0.36 + i * 0.14, -D / 2 - 0.15); Bt.add(LADA(), M(fx, y0 + 0.82, fz, 0.03, 0.025, 0.025, ry), [0.3, 0.3, 0.3]); }   // sänken
      }
      { const ladaY = bas('ladaY', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
        // två par åror upphängda vågrätt på krokar på långsidan (bladen åt samma håll, spetsarna målade)
        for (const [hh, lz0] of [[1.25, -1.5], [1.42, -1.35]]) {
          const [ax, az] = L(-W / 2 - 0.1, lz0), [bx, bz] = L(-W / 2 - 0.1, lz0 + 2.4), A3 = [ax, y0 + hh, az], B3 = [bx, y0 + hh + 0.04, bz];
          Bt.add(CYL(), MAB(A3, B3, 0.02), [0.74, 0.62, 0.45]);
          const C3 = A3.map((v, i) => v + (B3[i] - v) * 0.76);
          Bt.add(ladaY, MAB(C3, B3, 0.13, 0.016), (lx, ly) => lerp([0.7, 0.58, 0.42], [0.12, 0.25, 0.38], ly > 0.8 ? 1 : 0));
        }
        for (const lz of [-0.8, 0.6]) { const [kx, kz] = L(-W / 2 - 0.07, lz); Bt.add(LADA(), M(kx, y0 + 1.2, kz, 0.1, 0.3, 0.03, ry), [0.12, 0.12, 0.12]); }   // krokarna
      }
      // gammal träbänk på bryggdäcket under gavelfönstret: gråvittrad, två bockar och tjock sittbräda
      { const gra = [0.52, 0.49, 0.44], bx = 1.02, bz = -D / 2 - 0.32;   // (flyttad åt sidan: dörren sitter mitt på gaveln)
        for (const s of [-1, 1]) { const [lx2, lz2] = L(bx + s * 0.38, bz); Bt.add(LADA(), M(lx2, y0 + 0.2, lz2, 0.06, 0.42, 0.3, ry), skala(gra, 0.8)); }
        { const [cx, cz] = L(bx, bz); Bt.add(LADA(), M(cx, y0 + 0.44, cz, 1.0, 0.05, 0.34, ry), (lx, ly) => skala(gra, ly > 0.4 ? 1.05 : 0.75)); }
      }
      // Poly Haven på bryggdäcket: gummistövlar under nätet, en tunna och två staplade fisklådor i hörnen
      if (phPa) {
        const yd = y0 - 0.012, P = (lx, lz) => L(lx, lz);
        PHT.push({ m: 'rubber_boots', ...xz(P(-1.0, -D / 2 - 0.3)), y: yd, ry: ry + Math.PI + 0.15, del: 'dirty' });   // det smutsiga paret
        PHT.push({ m: 'wooden_barrels_01', ...xz(P(1.4, -D / 2 - PD + 0.42)), y: yd, ry: ry + 0.6, del: 'barrel01', s: 0.85 });
        PHT.push({ m: 'wooden_crate_02', ...xz(P(-1.26, -D / 2 - PD + 0.33)), y: yd, ry: ry + Math.PI / 2 + 0.04 });
        PHT.push({ m: 'wooden_crate_02', ...xz(P(-1.25, -D / 2 - PD + 0.35)), y: yd + 0.464, ry: ry + Math.PI / 2 - 0.1 });
      }
      TXT = 0;
      console.info('miljö: sjöbod vid', x.toFixed(1), z.toFixed(1));
      return { x, z, ry, L, y0, W, D };
    };
    yield;
    const bod = sjobod();
    // -- kanot och kajak upp och ner på bockar (nära boden eller på land vid bryggan) --
    const kanot = (x, z, ry, langd, farg) => {
      const y = hy(x, z), L = R2(x, z, ry);
      for (const s of [-1, 1]) { const [px, pz] = L(0, s * langd * 0.28); for (const t of [-1, 1]) { const [ax, az] = L(t * 0.3, s * langd * 0.28); Bt.add(CYL(), MAB([ax, y - 0.05, az], [px, y + 0.42, pz], 0.03), [0.55, 0.45, 0.33]); } Bt.add(LADA(), M(px, y + 0.43, pz, 0.85, 0.06, 0.08, ry), [0.55, 0.45, 0.33]); }
      const g = bas('kanot', () => { const gg = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i), yy = p.getY(i); p.setX(i, p.getX(i) * Math.pow(Math.max(0, 1 - zz * zz), 0.15)); p.setY(i, yy * (1 - 0.3 * zz * zz) + 0.15 * zz ** 4); } gg.computeVertexNormals(); return gg; });
      Bt.add(g, M(x, y + 0.47, z, 0.4, 0.3, langd / 2, ry), (lx, ly, lz, nx, ny) => skala(farg, 0.72 + 0.32 * Math.max(0, ny)));
      for (const sx of [-1, 1]) { const [gx, gz] = L(sx * 0.39, 0); Bt.add(LADA(), M(gx, y + 0.47, gz, 0.03, 0.03, langd * 0.9, ry), [0.45, 0.33, 0.22]); }
    };
    yield;
    if (bod) {
      const [kx, kz] = bod.L(-bod.W / 2 - 2.8, -0.2);
      if (krav(kx, kz, 'lag') && hy(kx, kz) > VY + 0.25 && ledig(kx, kz, 1.5)) { kanot(kx, kz, bod.ry, 4.8, [0.62, 0.15, 0.1]); ta(kx, kz, 2.5); }
      const [jx, jz] = bod.L(-bod.W / 2 - 4.4, 0.4);
      if (krav(jx, jz, 'lag') && hy(jx, jz) > VY + 0.25 && ledig(jx, jz, 1.2)) {
        const g = bas('kajak', () => { const gg = new THREE.SphereGeometry(1, 10, 6); gg.computeVertexNormals(); return gg; }), y = hy(jx, jz);
        Bt.add(g, M(jx, y + 0.12, jz, 0.3, 0.16, 2.1, bod.ry + 0.1), (lx, ly) => ly > 0.3 ? [0.12, 0.12, 0.13] : [0.92, 0.7, 0.1]); ta(jx, jz, 1.5);
      }
    }
    // -- eldstad med stenring och sotiga vedträn; bakom den ett litet trädäck (plant, på plintar) med två
    // däckstolar (Adirondack) mot sjön och ett vedställ med kluven ved vid däckets kortsida --
    const brasa = () => {
      const g0 = b ? Math.atan2(b.dz, b.dx) * 180 / Math.PI : -150, DW = 3.0, DD = 2.2, DA = 3.4;   // däckets mått, avstånd eld–däck
      // alla lägen som går först, sedan det flackaste (däcket ska ligga lågt på marken, inte stå som en låda i sluttningen)
      let bast = null;
      for (const dg of [18, -20, 28, -30, 38, 10, 46, -40, 54, -48, 62, -56]) for (const ut of [3.4, 4.2, 5.0, 5.8, 6.6]) {
        const g = g0 + dg, d = strandD(g); if (!d) continue;
        const a = g * Math.PI / 180, x = Math.cos(a) * (d - ut), z = Math.sin(a) * (d - ut);
        if (!krav(x, z, 'lag') || mal.blockerad(x, z, 2.5) || kant(x, z) < 4 || !ledig(x, z, 3.2) || hy(x, z) < VY + 0.3) continue;
        // däcket på landsidan om elden, lokala +z mot sjön
        const ryD = Math.atan2(Math.cos(a), Math.sin(a)), dx = x - Math.cos(a) * DA, dz = z - Math.sin(a) * DA, LD = R2(dx, dz, ryD);
        let lo = 99, hi = -99;
        for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) { const gg = hy(...LD((i / 3 - 0.5) * DW, (j / 2 - 0.5) * DD)); lo = Math.min(lo, gg); hi = Math.max(hi, gg); }
        // eldplatsens grusplan (r 2 m) ska vara någorlunda plan
        let elo = 99, ehi = -99; for (let k = 0; k < 8; k++) { const gg = hy(x + Math.cos(k * 0.785) * 1.9, z + Math.sin(k * 0.785) * 1.9); elo = Math.min(elo, gg); ehi = Math.max(ehi, gg); }
        if (hi - lo > 0.9 || mal.blockerad(dx, dz, 2.2) || kant(dx, dz) < 9.5 ||   // tomtens tvättlina och gunga står inom 7 m från huset (husritare-bebott.js)
           !ledig(dx, dz, 2.2) || lo < VY + 0.2) continue;
        const p = (hi - lo) * 1.5 + (ehi - elo) + Math.abs(dg) * 0.003 + ut * 0.01;
        if (!bast || p < bast.p) bast = { p, a, x, z, ryD, dx, dz, LD, lo, hi };
      }
      if (!bast) return null;
      { const { a, x, z, ryD, dx, dz, LD, lo, hi } = bast;
        ta(x, z, 1.6); ta(dx, dz, 2.3);
        const y = hy(x, z), ux = Math.cos(a), uz = Math.sin(a), vx2 = -uz, vz2 = ux;   // u: mot sjön, v: åt sidan
        TXT = 2;   // eldringens stenar (gruset och askan har egen färg: TXT sätts om nedan)
        // eldstaden: en ring av rundade gråstenar, sotiga på insidan, en askbädd med kol och halvbrända vedträn
        // som ligger kors och tvärs, kluven ved travad bredvid och två stockbänkar på var sin sida om elden
        TXT = 0;
        // grusat runt plan kring elden (r ≈ 2 m), följer marken och sjunker ner i den i en oregelbunden kant
        // (färgen glider över i strandsandens ton och ytan sjunker ner i marken ytterst: ingen hård kant)
        { const RR = [0, 0.45, 0.9, 1.3, 1.6, 1.85, 2.1, 2.4], LYFT = [0.035, 0.035, 0.035, 0.035, 0.03, 0.015, -0.005, -0.05], NS = 28, P = [], Nn = [], Fv = [];
          const pt = (i, j) => { const v = j / NS * 6.283, rk = RR[i] * (1 + (fbm(Math.cos(v) * 1.3 + x, Math.sin(v) * 1.3 + z, 2) - 0.5) * 0.3), px = x + Math.cos(v) * rk, pz = z + Math.sin(v) * rk;
            let f = skala([0.45, 0.43, 0.4], (0.75 + 0.45 * fbm(px * 4, pz * 4, 2)) * (0.9 + 0.2 * fbm(px * 13, pz * 13, 2)));
            f = lerp(f, [0.34, 0.33, 0.32], 1 - mjuk(0.7, 1.3, rk));          // aska och sot närmast elden
            f = lerp(f, [0.53, 0.48, 0.39], mjuk(1.3, 2.3, rk));              // ut i sanden
            return [px, Math.max(hy(px, pz), grov(px, pz)) + LYFT[i], pz, f]; };
          const tri = (a, b2, c) => { for (const q of [a, b2, c]) { P.push(q[0], q[1], q[2]); Nn.push(0, 1, 0); Fv.push(...q[3]); } };
          for (let i = 0; i < RR.length - 1; i++) for (let j = 0; j < NS; j++) { const a0 = pt(i, j), a1 = pt(i, j + 1), b0 = pt(i + 1, j), b1 = pt(i + 1, j + 1); tri(a0, a1, b0); tri(a1, b1, b0); }   // (motsols sett uppifrån: framsidan uppåt)
          Bt.ra(P, Nn, Fv);
          for (let k = 0; k < 18; k++) { const v = r() * 6.283, d = 0.75 + r() * 0.5, sx = x + Math.cos(v) * d, sz = z + Math.sin(v) * d; Bt.add(LADA(), M(sx, Math.max(hy(sx, sz), grov(sx, sz)) + 0.04, sz, 0.02 + r() * 0.03, 0.012, 0.02 + r() * 0.03, r() * 6.28), r() < 0.6 ? [0.06, 0.055, 0.05] : [0.3, 0.29, 0.28]); }   // kolbitar och aska som hamnat utanför ringen
        }
        TXT = 2;
        const sot = (wx, wz, nx = 0, nz = 0) => { const d = Math.hypot(wx - x, wz - z) + 1e-4, inn = -(nx * (wx - x) + nz * (wz - z)) / d; return mjuk(0.64, 0.44, d) * Math.min(1, Math.max(0.15, 0.35 + inn)); };   // sot på stenarnas insida
        for (let i = 0, n = 17; i < n; i++) {
          const v = (i + (r() - 0.5) * 0.25) / n * 6.283, rr = 0.64 + (r() - 0.5) * 0.06, s = 0.13 + r() * 0.06, sx = x + Math.cos(v) * rr, sz = z + Math.sin(v) * rr;
          const k4 = r() * 4 | 0, g = knol('eldsten2' + k4, 40 + k4 * 3.1, 0.24, 10, 7), c = vari([[0.42, 0.415, 0.4], [0.46, 0.44, 0.42], [0.37, 0.365, 0.36], [0.44, 0.42, 0.4]][r() * 4 | 0], r, 0.06), sy = s * (0.55 + r() * 0.25);
          Bt.add(g, M(sx, Math.max(hy(sx, sz), grov(sx, sz)) + sy * 0.2, sz, s * (1.1 + r() * 0.4), sy, s * (0.8 + r() * 0.3), -v + (r() - 0.5) * 0.6, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => {
            let f = skala(c, 0.62 + 0.38 * (0.5 + 0.5 * ny)) , so = sot(wx, wz, nx, nz);
            f = skala(f, 0.85 + 0.3 * fbm(wx * 9, wz * 9 + wy * 7, 2));   // korn och fläckar
            f = lerp(f, [0.66, 0.67, 0.58], mjuk(0.6, 0.72, fbm(wx * 2.3 + 5, wz * 2.3 + wy, 2)) * 0.5 * (1 - so));   // lav på utsidan
            return lerp(f, [0.08, 0.072, 0.065], so * (0.6 + 0.4 * fbm(wx * 6, wz * 6 + wy * 4, 2)));   // sot på insidan
          });
        }
        TXT = 0;
        const ASKA = bas('askbadd', () => new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2));
        Bt.add(ASKA, M(x, y + 0.025, z, 0.56, 1, 0.56), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => { const d = Math.hypot(lx, lz); return lerp(skala([0.36, 0.34, 0.32], 0.7 + 0.5 * fbm(wx * 5, wz * 5, 2)), [0.05, 0.045, 0.04], mjuk(0.15, 0.9, d)); });
        for (let i = 0; i < 9; i++) { const v = r() * 6.283, d = Math.sqrt(r()) * 0.33; Bt.add(LADA(), M(x + Math.cos(v) * d, y + 0.035, z + Math.sin(v) * d, 0.05 + r() * 0.05, 0.025, 0.03 + r() * 0.04, r() * 6.28), [0.04, 0.035, 0.03]); }   // kol
        TXT = 1;   // vedträn, stockbänkar och däcket: naturligt trä (ändträ med årsringar)
        // halvbrända vedträn: kolsvarta in mot mitten, barken kvar i ytteränden, vilar på stenarna
        for (let i = 0; i < 4; i++) {
          const v = i * 1.65 + r() * 0.5, ro = 0.5 + r() * 0.08, ri = 0.06 + r() * 0.08, w = v + (r() - 0.5) * 0.6;
          Bt.add(CYLS(), MAB([x + Math.cos(v) * ro, y + 0.13, z + Math.sin(v) * ro], [x + Math.cos(w + 3.14) * ri, y + 0.05, z + Math.sin(w + 3.14) * ri], 0.04 + r() * 0.012), (lx, ly) => lerp([0.34, 0.28, 0.22], [0.045, 0.04, 0.035], mjuk(0.2, 0.6, ly)));
        }
        // kluven ved travad på marken vid sidan om ringen (mot däcket), ändarna ljusa
        // kluven ved: kilformade vedträn (en tårtbit av stocken med barken på den rundade sidan), inte femkantiga stavar
        const KIL = () => bas('kloveKil', () => { const s = new THREE.Shape(); s.moveTo(0, 0); for (let i = 0; i <= 5; i++) { const v = -0.85 + i * 0.34; s.lineTo(Math.cos(v) * 1.6, Math.sin(v) * 1.6); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(-0.8, 0, -0.5).rotateX(-Math.PI / 2); });
        { const klove = KIL(), cx = x + vx2 * 0.55 + ux * 1.35, cz = z + vz2 * 0.55 + uz * 1.35, ryV = Math.atan2(ux, uz);   // på gruset, på sjösidan
          for (let rad = 0; rad < 2; rad++) for (let k = 0; k < 3 - rad; k++) {
            const o = (k - (3 - rad) / 2) * 0.115, px = cx + ux * o, pz = cz + uz * o, rr = 0.05 + r() * 0.012;
            Bt.add(klove, M(px, hy(cx, cz) + 0.05 + rad * 0.095, pz, rr, 0.45 + r() * 0.06, rr, ryV + (r() - 0.5) * 0.08, r() * 6.28, Math.PI / 2), (lx, ly, lz, nx, ny, nz) => Math.abs(nx * vx2 + nz * vz2) > 0.7 ? [0.78, 0.64, 0.45] : [0.4, 0.34, 0.28]);
          }
        }
        TXT = 5;
        // stockbänkar: en halverad stock (kluvna ytan uppåt, gråvittrad) på två stubbar, på var sin sida om elden
        { const HALV = bas('halvstock', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, 0, Math.PI).rotateZ(-Math.PI / 2));
          // tre bänkar i en halvcirkel på landsidan om elden (mot däcket), var och en tangent till cirkeln
          // (två bänkar på sidorna, något bakåt mot land; mot däcket står stolarna)
          let nb = 0;
          for (const vb of [Math.PI * 0.62, Math.PI * 1.38, Math.PI * 0.45, Math.PI * 1.55, Math.PI * 0.3, Math.PI * 1.7].map(t => a + t)) {
            if (nb >= 2 || Math.hypot(x + Math.cos(vb) * 1.5 - dx, z + Math.sin(vb) * 1.5 - dz) < 2.6) continue;   // aldrig in i däcket
            nb++;
            const ux = -Math.sin(vb), uz = Math.cos(vb);   // bänkens längdriktning (tangent)
            const bx = x + Math.cos(vb) * 1.5, bz = z + Math.sin(vb) * 1.5, ryB = -Math.atan2(uz, ux), gy = (hy(bx + ux * 0.55, bz + uz * 0.55) + hy(bx - ux * 0.55, bz - uz * 0.55)) / 2;
            if (hy(bx, bz) < VY + 0.15) continue;
            // korta, grova stubbar djupt nedsänkta i marken; stocken (barken nedåt) vilar i en urtagning ovanpå dem
            for (const t of [-0.48, 0.48]) { const sx = bx + ux * t, sz = bz + uz * t, g0 = Math.min(hy(sx, sz), grov(sx, sz)), c = vari([0.34, 0.3, 0.25], r, 0.05); Bt.add(CYLS(), M(sx, g0 - 0.3, sz, 0.16, gy + 0.27 - (g0 - 0.3), 0.16, r() * 6.28), (lx, ly, lz, nx, ny) => ny > 0.9 ? [0.52, 0.45, 0.35] : c); }
            Bt.add(HALV, M(bx, gy + 0.45, bz, 1.55, 0.19, 0.19, ryB), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => skala([0.33, 0.27, 0.21], (0.7 + 0.3 * (0.5 + 0.5 * ny)) * (0.8 + 0.4 * fbm(wx * 7, wy * 20, 2))));   // barken
            Bt.add(LADA(), M(bx, gy + 0.453, bz, 1.53, 0.008, 0.36, ryB), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => skala([0.5, 0.46, 0.4], 0.85 + 0.25 * fbm(wx * 3 + wz * 14, wz * 3 - wx * 14, 2)));   // kluvna ytan, grånad med ådring
            ta(bx, bz, 0.9);
          }
        }
        TXT = 1;
        // däcket vrids (högst ±55° från sjön) så att lokala +z går nerför sluttningen: då kan avsatserna följa marken
        { const gxW = (hy(dx + 1.5, dz) - hy(dx - 1.5, dz)) / 3, gzW = (hy(dx, dz + 1.5) - hy(dx, dz - 1.5)) / 3;
          let dv = Math.atan2(-gxW, -gzW) - bast.ryD; dv = Math.atan2(Math.sin(dv), Math.cos(dv));
          const ryD = Math.hypot(gxW, gzW) > 0.03 ? bast.ryD + Math.max(-0.96, Math.min(0.96, dv)) : bast.ryD, LD = R2(dx, dz, ryD);
        // trädäck: lågt, ovansidan 10 cm över markens högsta punkt; gråvittrade brädor med springor på reglar och
        // bärlinor, stolpar på betongplintar där marken faller undan, kantbräda runt om och en trappa ner mot elden
        // Däcket är i två avsatser som följer sluttningen (delat tvärs över den axel där marken faller mest): den övre
        // med vedstället, den nedre med stolarna, ett sättsteg (och vid behov ett mellansteg) emellan
        const P3 = (lx, ly, lz) => { const [px, pz] = LD(lx, lz); return [px, ly, pz]; }, G = (lx, lz) => hy(...LD(lx, lz));
        const hog = (x0, x1, z0, z1) => { let m = -99; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) m = Math.max(m, G(x0 + (x1 - x0) * i / 4, z0 + (z1 - z0) * j / 3)); return m; };
        const fz = hog(-DW / 2, DW / 2, -DD / 2, 0) - hog(-DW / 2, DW / 2, 0, DD / 2), fx = hog(-DW / 2, 0, -DD / 2, DD / 2) - hog(0, DW / 2, -DD / 2, DD / 2);
        const axX = Math.abs(fx) > Math.abs(fz), sL = (axX ? fx : fz) > 0 ? 1 : -1;   // delningsaxel, den nedre halvans sida
        const halv = s => axX ? [s < 0 ? -DW / 2 : 0, s < 0 ? 0 : DW / 2, -DD / 2, DD / 2] : [-DW / 2, DW / 2, s < 0 ? -DD / 2 : 0, s < 0 ? 0 : DD / 2];
        const yU = hog(...halv(-sL)) + 0.07, yL0 = Math.min(yU, hog(...halv(sL)) + 0.07), tva = yU - yL0 >= 0.08, yD = tva ? yL0 : yU;
        // oljad, lätt grånad lärk: varmt gråbrun, varje bräda sin ton
        const virke = [0.5, 0.44, 0.37], betong = [0.55, 0.54, 0.52], kantF = [0.56, 0.48, 0.39], LARK = [0.64, 0.55, 0.45];
        const niva = (x0, x1, z0, z1, yT, kx0, kx1, kz0, kz1) => {   // kx0 …: kantbräda på den sidan
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, bx = x1 - x0, bz = z1 - z0;
          for (const lz of [z0 + 0.22, z1 - 0.22]) {
            Bt.add(LADA(), M(...P3(cx, yT - 0.208, lz), bx - 0.1, 0.12, 0.07, ryD), skala(virke, 0.8));                                // bärlina
            for (const lx of bx > 2.4 ? [x0 + 0.2, cx, x1 - 0.2] : [x0 + 0.2, x1 - 0.2]) {
              const g = G(lx, lz), top = yT - 0.268;
              if (top - g > 0.06) Bt.add(LADA(), M(...P3(lx, (g + 0.14 + top) / 2, lz), 0.095, Math.max(0.01, top - g - 0.14), 0.095, ryD), skala(virke, 0.85));   // stolpe
              if (top - g > -0.05) { const c = vari(betong, r, 0.04); Bt.add(LADA(), M(...P3(lx, g + 0.03, lz), 0.22, 0.22, 0.22, ryD), (lx2, ly) => skala(c, ly > 0.4 ? 1.05 : 0.85)); }   // plint
            }
          }
          for (let lx = x0 + 0.05; lx <= x1 - 0.04; lx += 0.6) Bt.add(LADA(), M(...P3(Math.min(lx, x1 - 0.05), yT - 0.088, cz), 0.045, 0.12, bz - 0.04, ryD), skala(virke, 0.75));   // reglar
          const nb = Math.round(bz / 0.125);
          // brädorna i två längder med förskjutna skarvar (skarven över en regel), skuggfog mellan brädorna och en
          // rad med två skruvar över varje regel
          for (let k = 0; k < nb; k++) {
            const zc = z0 + (k + 0.5) / nb * bz, sk = x0 + 0.05 + 0.6 * (1 + (k * 3) % Math.max(1, Math.floor((bx - 0.1) / 0.6) - 1));
            for (const [s0, s1] of [[x0, sk], [sk, x1]]) { const c = lerp(vari(LARK, r, 0.1), [0.6, 0.6, 0.58], r() * 0.35); Bt.add(LADA(), M(...P3((s0 + s1) / 2, yT - 0.014, zc), s1 - s0 - 0.006, 0.028, bz / nb - 0.016, ryD), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => skala(c, (ly > 0.4 ? 1 : 0.62) * (0.92 + 0.16 * fbm(wx * 1.5 + wz * 9, wz * 1.5 - wx * 9, 2)))); }
            for (let lx = x0 + 0.05; lx <= x1 - 0.04; lx += 0.6) for (const o of [-0.025, 0.025]) Bt.add(LADA(), M(...P3(Math.min(lx, x1 - 0.05), yT + 0.0005, zc + o), 0.008, 0.002, 0.008, ryD), [0.2, 0.19, 0.18]);
          }
          // kantbräda (täcker regeländarna)
          if (kz0) Bt.add(LADA(), M(...P3(cx, yT - 0.07, z0 - 0.012), bx + 0.05, 0.11, 0.022, ryD), kantF);
          if (kz1) Bt.add(LADA(), M(...P3(cx, yT - 0.07, z1 + 0.012), bx + 0.05, 0.11, 0.022, ryD), kantF);
          if (kx0) Bt.add(LADA(), M(...P3(x0 - 0.012, yT - 0.07, cz), 0.022, 0.11, bz + 0.05, ryD), kantF);
          if (kx1) Bt.add(LADA(), M(...P3(x1 + 0.012, yT - 0.07, cz), 0.022, 0.11, bz + 0.05, ryD), kantF);
        };
        if (!tva) niva(-DW / 2, DW / 2, -DD / 2, DD / 2, yU, true, true, true, true);
        else {
          const [a0, a1, b0, b1] = halv(-sL), [c0, c1, d0, d1] = halv(sL), h = yU - yD;
          niva(a0, a1, b0, b1, yU, !(axX && sL < 0), !(axX && sL > 0), !(!axX && sL < 0), !(!axX && sL > 0));
          // den nedre halvan börjar 1 cm från delningen (sättsteget står där)
          niva(c0 + (axX && sL > 0 ? 0.01 : 0), c1 - (axX && sL < 0 ? 0.01 : 0), d0 + (!axX && sL > 0 ? 0.01 : 0), d1 - (!axX && sL < 0 ? 0.01 : 0), yD, !(axX && sL > 0), !(axX && sL < 0), !(!axX && sL > 0), !(!axX && sL < 0));
          const Q = (u, y, v, su, sy, sv) => axX ? M(...P3(u, y, v), su, sy, sv, ryD) : M(...P3(v, y, u), sv, sy, su, ryD);   // u längs delningsaxeln
          Bt.add(LADA(), Q(sL * 0.02, (yU + yD) / 2 - 0.03, 0, 0.022, h + 0.02, (axX ? DD : DW) + 0.05), [0.56, 0.52, 0.46]);   // sättsteg mellan avsatserna
          if (h > 0.24) {
            for (const q of [-0.07, 0.07]) Bt.add(LADA(), Q(sL * 0.17 + q, yU - h / 2 - 0.014, 0, 0.125, 0.028, 0.8), vari([0.62, 0.58, 0.52], r, 0.06));   // mellansteg
            Bt.add(LADA(), Q(sL * 0.31, (yU - h / 2 + yD) / 2 - 0.03, 0, 0.022, h / 2, 0.82), [0.56, 0.52, 0.46]);
          }
        }
        // trappa mot elden från framkanten (på den nedre avsatsen om den når fram): vangstycken ner till marken, steg om högst 18 cm
        const xT = tva && axX ? sL * DW / 4 : 0, yF = tva && !axX && sL < 0 ? yU : yD;
        // ner från däcket mot elden: en eller två flata natursten som trappsteg, liggande i marken (ingen trätrappa i luften)
        { let zz = DD / 2 + 0.22, yy = yF;
          for (let k = 0; k < 3; k++) {
            const gF = G(xT, zz), h = yy - gF; if (h < 0.1) break;
            const top = Math.max(gF + 0.03, yy - Math.min(0.2, h * 0.55)), [px, , pz] = P3(xT + (r() - 0.5) * 0.1, 0, zz);
            Bt.add(knol('stegsten' + k, 11 + k, 0.12, 8, 5), M(px, (top + gF - 0.15) / 2, pz, 0.48 + r() * 0.1, (top - gF + 0.15) / 2, 0.24, ryD + (r() - 0.5) * 0.2), (l2, ly, l3, nx, ny, nz, wx, wy, wz) => skala([0.47, 0.45, 0.43], (0.68 + 0.32 * ny) * (0.85 + 0.3 * fbm(wx * 4, wz * 4, 2))), { tx: 2 });
            yy = top; zz += 0.42;
          }
        }
        TXT = 4;   // målade stolar och bord
        // två stolar fritt på däcket, vända mot sjön (lite isär), med gott om plats; ett litet bord emellan
        // (delat på längden: en stol på var avsats)
        const ryS = bast.ryD;
        const stolar = !tva ? [[-0.85, 0.25, yU], [0.85, 0.25, yU]] : axX ? [[-0.9, 0.25, sL < 0 ? yD : yU], [0.9, 0.25, sL > 0 ? yD : yU]] : [[-0.85, sL * 0.6, yD], [0.85, sL * 0.6, yD]];
        // (vända mot sjön men vridna en bit mot elden)
        stolar.forEach(([lx, lz, yy], i) => { const [px, , pz] = P3(lx, 0, lz), te = Math.atan2(x - px, z - pz), dv = Math.atan2(Math.sin(te - ryS), Math.cos(te - ryS)); adirondack(Bt, px, yy, pz, ryS + dv * 0.45, i ? [0.26, 0.37, 0.3] : [0.88, 0.88, 0.84]); });
        { // litet bord mellan stolarna med en lykta och två kaffekoppar
          const [xB, zB, yB] = tva && axX ? [0, 0.15, Math.max(yU, yD)] : [0, stolar[0][1] + 0.1, stolar[0][2]];
          if (!(tva && axX)) {
            const P3b = (lx, ly, lz) => P3(xB + lx, yB + ly, zB + lz);
            Bt.add(LADA(), M(...P3b(0, 0.42, 0), 0.36, 0.03, 0.36, ryS), [0.86, 0.86, 0.82]);
            for (const i of [-1, 1]) for (const j of [-1, 1]) Bt.add(LADA(), M(...P3b(i * 0.14, 0.205, j * 0.14), 0.035, 0.41, 0.035, ryS), [0.8, 0.8, 0.76]);
            TXT = 0;
            // lykta: svart ram, frostat glas som glöder lite, ett litet tak och en bygel
            Bt.add(LADA(), M(...P3b(0.06, 0.445, -0.05), 0.11, 0.02, 0.11, ryS), [0.08, 0.08, 0.08]);
            Bt.add(LADA(), M(...P3b(0.06, 0.53, -0.05), 0.09, 0.15, 0.09, ryS), [0.95, 0.88, 0.7]);
            for (const i of [-1, 1]) for (const j of [-1, 1]) Bt.add(LADA(), M(...P3b(0.06 + i * 0.048, 0.53, -0.05 + j * 0.048), 0.012, 0.16, 0.012, ryS), [0.08, 0.08, 0.08]);
            Bt.add(KON(), M(...P3b(0.06, 0.61, -0.05), 0.08, 0.06, 0.08, ryS), [0.08, 0.08, 0.08]);
            Bt.add(LADA(), M(...P3b(0.06, 0.685, -0.05), 0.04, 0.03, 0.008, ryS), [0.08, 0.08, 0.08]);
            // kaffekoppar på fat
            for (const [cxp, czp] of [[-0.09, 0.08], [0.1, 0.1]]) {
              Bt.add(SKIVA(), M(...P3b(cxp, 0.437, czp), 0.06, 1, 0.06), [0.94, 0.93, 0.9]);
              Bt.add(CYLS(), M(...P3b(cxp, 0.438, czp), 0.034, 0.055, 0.034), (l2, ly, l3, nx, ny) => ny > 0.9 ? [0.25, 0.15, 0.08] : [0.95, 0.94, 0.91]);
            }
          }
        }
        TXT = 1;
        // öppet vedställ på marken bredvid däckets kortsida (inte på däcket): fyra störar, två medar och kluven ved
        // staplad med de ljusa ändarna utåt; inget tak, inga väggar
        { const sid = tva && axX ? -sL : -1, vx = sid * (DW / 2 + 0.5), VL = 1.4, VH = 0.8, ax = Math.cos(ryD), az = -Math.sin(ryD);   // vedens axel = lokala x
          let g = 99; for (const j of [-1, 0, 1]) for (const i of [-1, 1]) g = Math.min(g, G(vx + i * 0.25, j * VL / 2));
          const klove = KIL(), tra = [0.4, 0.34, 0.28];
          for (const j of [-1, 1]) for (const i of [-1, 1]) { const [px, , pz] = P3(vx + i * 0.22, 0, j * (VL / 2 + 0.03)); Bt.add(CYL(), M(px, hy(px, pz) - 0.15, pz, 0.03, g + VH + 0.2 - hy(px, pz), 0.03), tra); }
          for (const i of [-1, 1]) Bt.add(LADA(), M(...P3(vx + i * 0.15, g + 0.04, 0), 0.07, 0.07, VL + 0.1, ryD), skala(tra, 0.85));
          const ved = (nx, ny, nz) => Math.abs(nx * ax + nz * az) > 0.7 ? [0.8, 0.66, 0.46] : [0.42, 0.36, 0.3];
          for (let rad = 0, yy = g + 0.13; rad < 6; rad++, yy += 0.105) for (let k = 0, zz = -VL / 2 + 0.06; zz < VL / 2 - 0.06; k++) {
            const rr = 0.045 + r() * 0.015; zz += rr;
            Bt.add(klove, M(...P3(vx + (r() - 0.5) * 0.06, yy, zz), rr, 0.4 + r() * 0.06, rr, ryD + (r() - 0.5) * 0.05, r() * 6.28, Math.PI / 2), (lx, ly, lz, nx, ny, nz) => ved(nx, ny, nz));
            zz += rr + 0.006;
          }
          // huggkubbe på landsidan om vedstället med Poly Havens yxa i (eggen i ändträt, skaftet snett uppåt)
          if (phPa) {
            const [kx, , kz] = P3(vx, 0, -VL / 2 - 0.6), g0 = hy(kx, kz);
            if (g0 > VY + 0.25 && rektAv(kx, kz) > 0.6) {
              Bt.add(CYLS(), M(kx, g0 - 0.12, kz, 0.24, 0.56, 0.24, ryD), (lx, ly, lz, nx, ny) => ny > 0.9 ? [0.78, 0.64, 0.45] : [0.36, 0.29, 0.22]);
              const ryK = ryD + 0.9;
              PHT.push({ m: 'wooden_axe', x: kx + Math.sin(ryK) * 0.05, y: g0 + 0.44 + 0.345 - 0.06, z: kz + Math.cos(ryK) * 0.05, ry: ryK, rx: Math.PI / 2 + 0.6, golv: false });
              ta(kx, kz, 0.6);
            }
          }
        }
        }
        TXT = 0;
        console.info('miljö: eldplats och däck vid', x.toFixed(1), z.toFixed(1), 'lutning', (hi - lo).toFixed(2));
        return [x, y, z];
      }
      return null;
    };
    const adirondack = (B, x, y, z, ry, c) => {
      const L = R2(x, z, ry), P3 = (lx, ly, lz) => { const [px, pz] = L(lx, lz); return [px, y + ly, pz]; };
      for (const s of [-1, 1]) {
        B.add(LADA(), M(...P3(s * 0.32, 0.22, 0.1), 0.05, 0.08, 0.95, ry, -0.25, 0), c);                      // sidostycke (sluttar bakåt)
        B.add(LADA(), M(...P3(s * 0.32, 0.25, 0.42), 0.05, 0.5, 0.06, ry), c);                                // framben
        B.add(LADA(), M(...P3(s * 0.38, 0.62, 0.12), 0.16, 0.025, 0.75, ry), c);                              // breda armstöd
        B.add(LADA(), M(...P3(s * 0.38, 0.42, 0.42), 0.04, 0.4, 0.05, ry), c);
      }
      for (let i = 0; i < 6; i++) B.add(LADA(), M(...P3(0, 0.34 - i * 0.025, 0.4 - i * 0.11), 0.62, 0.02, 0.08, ry, -0.22, 0), c);          // sits
      for (let i = 0; i < 5; i++) { const lx = (i - 2) * 0.12; const hh = 0.85 + (2 - Math.abs(i - 2)) * 0.08; B.add(LADA(), M(...P3(lx * (1 + 0.25), 0.22 + hh / 2 * Math.cos(0.38), -0.12 - hh / 2 * Math.sin(0.38)), 0.09, hh, 0.02, ry, -0.38, -lx * 0.5), c); }   // rygg (solfjäder, lutar bakåt)
      B.add(LADA(), M(...P3(0, 0.62, -0.3), 0.62, 0.05, 0.03, ry, -0.38, 0), c);   // ryggens tvärslå
      // tygdynor i sits och rygg (linne, kanterna lite mörkare som en kuddes rundade kant)
      const dyna = (lx, ly, lz) => skala(tyg, 0.8 + 0.2 * (1 - Math.max(Math.abs(lx), Math.abs(lz)) * 1.6) + 0.12 * ly);
      const tyg = c[0] > 0.6 ? [0.3, 0.4, 0.52] : [0.86, 0.81, 0.7];
      B.add(LADA(), M(...P3(0, 0.335, 0.13), 0.54, 0.075, 0.6, ry, -0.22, 0), dyna);
      B.add(LADA(), M(...P3(0, 0.58, -0.215), 0.5, 0.6, 0.075, ry, -0.38, 0), (lx, ly, lz) => skala(tyg, 0.82 + 0.18 * (1 - Math.abs(lx) * 1.6) + 0.1 * lz));
    };
    yield;
    const eld = brasa();
    // eldringen: Poly Havens stone_fire_pit (fotograferade stenar) mitt på grusplanen, där glöden tänds på kvällen
    if (phPa && eld) PHT.push({ m: 'stone_fire_pit', x: eld[0], y: Math.max(hy(eld[0], eld[2]), grov(eld[0], eld[2])) + 0.02, z: eld[2], ry: 0.4 });
    // -- bänk på bryggan, fågelholk på stolpe, stenmur och gärdsgård på landsidan --
    if (b) {
      const HB = b.HB || 0.9, d = b.d1 - 4.3, x = b.dx * d + b.px * (HB - 0.28), z = b.dz * d + b.pz * (HB - 0.28), ry = Math.atan2(b.px, b.pz) + Math.PI;
      const ryL = Math.atan2(b.dx, b.dz), L = R2(x, z, ryL), yb = b.y, P3 = (lx, ly, lz) => { const [px, pz] = L(lx, lz); return [px, yb + ly, pz]; };
      TXT = 1;
      // bänk med ryggstöd längs bryggkanten (ryggen mot kanten, man sitter med utsikt tvärs över viken): gråvittrat trä
      const gra = [0.58, 0.55, 0.5];
      for (const s of [-1, 1]) {
        Bt.add(LADA(), M(...P3(-0.16, 0.2, s * 0.62), 0.05, 0.4, 0.05, ryL), skala(gra, 0.85));                       // framben
        Bt.add(LADA(), M(...P3(0.2, 0.42, s * 0.62), 0.05, 0.86, 0.05, ryL, 0, -0.1), skala(gra, 0.85));             // bakben som går upp i ryggen
        Bt.add(LADA(), M(...P3(0.02, 0.37, s * 0.62), 0.44, 0.05, 0.05, ryL), skala(gra, 0.8));                      // sarg
        Bt.add(LADA(), M(...P3(0.02, 0.1, s * 0.62), 0.38, 0.035, 0.035, ryL), skala(gra, 0.8));                     // fotslå
      }
      for (let i = 0; i < 3; i++) Bt.add(LADA(), M(...P3(-0.13 + i * 0.13, 0.41, 0), 0.115, 0.032, 1.62, ryL), vari(gra, r, 0.06));   // sits
      for (const h of [0.62, 0.78]) Bt.add(LADA(), M(...P3(0.2 + (h - 0.4) * 0.1, h, 0), 0.03, 0.11, 1.62, ryL, 0, -0.1), vari(gra, r, 0.06));   // rygg
      // Poly Haven: flytväst och fiskehatt på bänken, trälykta och träspann ytterst på bryggan (ekans sida, gången fri)
      if (phPa) {
        PHT.push({ m: 'life_jacket', ...xz(L(0, -0.38)), y: yb + 0.428, ry: ryL + 0.08, rx: -Math.PI / 2, s: 0.6 });
        PHT.push({ m: 'fishermans_hat', ...xz(L(-0.02, 0.45)), y: yb + 0.428, ry: ryL + 1.2 });
        const PB = (d, s) => ({ x: b.dx * d + b.px * s, z: b.dz * d + b.pz * s });
        PHT.push({ m: 'wooden_lantern_01', ...PB(b.d1 - 0.3, -(HB - 0.22)), y: b.y + 0.02, ry: ryL + 0.4 });
        PHT.push({ m: 'wooden_bucket_01', ...PB(b.d1 - 0.95, -(HB - 0.28)), y: b.y + 0.02, ry: ryL + 2.1 });
      }
      TXT = 0;
      // förtöjningsringar i bryggkanten på ekans sida, och en knap (klyka) på kanten
      const RING = bas('ring', () => new THREE.TorusGeometry(0.06, 0.011, 5, 12));
      for (const dd of [b.d1 - 0.8, b.d1 - 4.6, b.d1 - 7.2]) {
        const rx = b.dx * dd - b.px * (HB + 0.05), rz = b.dz * dd - b.pz * (HB + 0.05);
        Bt.add(RING, M(rx, b.y - 0.13, rz, 1, 1, 1, Math.atan2(b.px, b.pz), 0.25), [0.2, 0.14, 0.1]);
        Bt.add(LADA(), M(b.dx * dd - b.px * (HB + 0.035), b.y - 0.07, b.dz * dd - b.pz * (HB + 0.035), 0.05, 0.05, 0.012, Math.atan2(b.px, b.pz)), [0.15, 0.12, 0.1]);
      }
      { const dd = b.d1 - 5.6, kx = b.dx * dd - b.px * (HB - 0.1), kz = b.dz * dd - b.pz * (HB - 0.1);
        Bt.add(LADA(), M(kx, b.y + 0.03, kz, 0.05, 0.06, 0.05, ryL), [0.14, 0.14, 0.15]);
        Bt.add(LADA(), M(kx, b.y + 0.07, kz, 0.04, 0.03, 0.26, ryL), [0.14, 0.14, 0.15]); }
      TXT = 2;
      // landfästet: gråsten staplad i två skift längs bryggans sidor, där bryggan går ut från stranden (stenkista)
      // Rundade, nötta gråstenar (mjuka normaler, knöliga former, flata undersidor), olika storlek, staplade och
      // nedsjunkna i marken; granit med variation, fläckar av ljus lav, lite mossa och mörkare våt fot
      const KSTEN = k => knol('rundsten' + k, 60 + k * 4.3, 0.32, 12, 8);
      const sten = (x, y, z, s, sy, ry2) => Bg.add(KSTEN(r() * 5 | 0), M(x, y, z, s * (1 + r() * 0.5), sy, s * (0.8 + r() * 0.3), ry2, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15), (lx, ly, lz, nx, ny, nz, wx, wy, wz) => {
        let f = skala([0.5, 0.47, 0.45], (0.62 + 0.38 * (0.5 + 0.5 * ny)) * (0.78 + 0.44 * fbm(wx * 6 + wy * 3, wz * 6, 2)));   // grå granit med dragning åt rosa
        f = lerp(f, [0.64, 0.65, 0.55], mjuk(0.48, 0.6, fbm(wx * 3.1 + 7, wz * 3.1 + wy * 2, 2)) * 0.8 * Math.max(0.25, ny));   // lav
        f = lerp(f, [0.2, 0.22, 0.14], mjuk(0.66, 0.74, fbm(wx * 2.3 - 3, wz * 2.3 + wy, 2)) * 0.5 * Math.max(0, ny));      // lite mossa
        if (wy < VY + 0.08) f = skala(f, 0.62);   // våt fot
        return f;
      });
      for (let dd = b.d0 + 0.05; dd < b.dS + 0.6; dd += 0.36 + r() * 0.2) for (const s of [-1, 1]) {
        const sx = b.dx * dd + b.px * s * (HB + 0.12 + r() * 0.1), sz = b.dz * dd + b.pz * s * (HB + 0.12 + r() * 0.1), g = hy(sx, sz), h = b.y - 0.06 - g, ryS = Math.atan2(b.dx, b.dz) + (r() - 0.5) * 0.6;
        if (h < 0.1) continue;
        const s0 = 0.18 + r() * 0.16, sy0 = Math.min(h * 0.55, s0 * (0.55 + r() * 0.25));
        sten(sx, g + sy0 * 0.1, sz, s0, sy0, ryS);                                                         // nedre skiftet, nedsjunket
        if (h > 0.38) { const s1 = 0.12 + r() * 0.12; sten(sx + (r() - 0.5) * 0.12, g + sy0 * 0.85 + s1 * 0.35, sz + (r() - 0.5) * 0.12, s1, s1 * 0.6, ryS + 0.8); }
        if (r() < 0.35) { const s2 = 0.06 + r() * 0.06, ox = (r() - 0.5) * 0.5; sten(sx + b.dx * ox + b.px * s * 0.25, hy(sx, sz) + s2 * 0.15, sz + b.dz * ox + b.pz * s * 0.25, s2, s2 * 0.6, r() * 6.28); }   // småsten vid foten
        if (g < VY) hind.push([sx, sz, 0.3]);
      }
      void ry;
    }
    yield;
    TXT = 0;
    // -- ekan förtöjd längs bryggan: klinkbyggd allmogeeka, 4 m, vit utsida med synliga bordgångar (varje bord
    // ligger utanpå det undre, med en skuggad kant), oljat trä invändigt, mahognyfärgad reling, förstäv och köl,
    // akterspegel, durk, två toftar och akterbänk, åror på toftarna, årtullar och en förtöjningslina till en pollare --
    if (b) {
      const N = 18, BORD = 6, LANG = 2.0;
      const spant = t => {                                   // t −1 akter … 1 för
        const bb = t > 0 ? 0.72 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.55) : 0.72 * (1 - 0.24 * t * t);
        const d = 0.5 * (1 - 0.45 * Math.max(0, t) ** 3) - 0.08 * Math.max(0, -t) ** 2;
        const rr = 0.58 + 0.05 * t * t + 0.12 * Math.max(0, t) ** 3;
        return { z: t * LANG, b: Math.max(bb, 0.02), d, r: rr };
      };
      const pkt = (sp, k, sx) => { const u = k / BORD; return [sx * (0.05 + (sp.b - 0.05) * Math.pow(Math.sin(u * Math.PI / 2), 0.85)), sp.r - sp.d * Math.pow(1 - u, 1.25), sp.z]; };
      const geo = (fn) => { const P = []; const q = (a, b2, c, d) => P.push(...a, ...b2, ...c, ...a, ...c, ...d); fn(q, P); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g; };
      const ut = (p, sx, k) => [p[0] + sx * 0.02, p[1] - 0.012, p[2]];   // bordets underkant ligger utanpå det undre bordet
      // utsidan: bord för bord; färgen läses ur bordets nummer (lokala y-läget räcker inte i stäven), så varje bord blir en egen geometri
      const bordGeo = k => bas('ekaBord' + k, () => geo(q => { for (const sx of [-1, 1]) for (let i = 0; i < N; i++) {
        const a = spant(i / N * 2 - 1), c = spant((i + 1) / N * 2 - 1);
        const A0 = ut(pkt(a, k, sx), sx, k), C0 = ut(pkt(c, k, sx), sx, k), A1 = pkt(a, k + 1, sx), C1 = pkt(c, k + 1, sx);
        q(A0, C0, C1, A1);
        if (k > 0) q(pkt(a, k, sx), pkt(c, k, sx), C0, A0);   // landet: smal skuggad kant under bordet
      } }));
      const insGeo = bas('ekaIn', () => geo(q => { for (const sx of [-1, 1]) for (let i = 0; i < N; i++) for (let k = 0; k < BORD; k++) {
        const a = spant(i / N * 2 - 1), c = spant((i + 1) / N * 2 - 1), I = p => [p[0] * 0.965, p[1] + 0.012, p[2] * 0.995];
        q(I(pkt(a, k, sx)), I(pkt(a, k + 1, sx)), I(pkt(c, k + 1, sx)), I(pkt(c, k, sx)));
      } }));
      const spegelGeo = bas('ekaSpegel', () => geo((q, P) => { const sp = spant(-1), m = [0, sp.r - sp.d * 0.5, sp.z - 0.005]; for (let k = 0; k < BORD; k++) for (const sx of [-1, 1]) P.push(...m, ...pkt(sp, k, sx).map((v, j) => j === 2 ? v - 0.005 : v * (j === 0 ? 1.02 : 1)), ...pkt(sp, k + 1, sx).map((v, j) => j === 2 ? v - 0.005 : v * (j === 0 ? 1.02 : 1))); }));
      const d = b.d1 - 3.2, ryE = Math.atan2(b.dx, b.dz) + 0.12, ex = b.dx * d - b.px * ((b.HB || 0.9) + 0.85), ez = b.dz * d - b.pz * ((b.HB || 0.9) + 0.85), ey = VY - (0.58 - 0.5) - 0.1;   // kölen 1 dm under ytan (lätt eka, tom)
      const LE = R2(ex, ez, ryE), P3 = (lx, ly, lz) => { const [px, pz] = LE(lx, lz); return [px, ey + ly, pz]; }, an = { anim: [ex, ez, r() * 6.28, 1] };
      const mE = M(ex, ey, ez, 1, 1, 1, ryE), vit = [0.86, 0.86, 0.83], olja = [0.44, 0.36, 0.27], mahog = [0.3, 0.2, 0.14];   // dovt oljat, lätt grånat trä (inte lack)
      // utsidan: vit med lite smuts och alggrön ton strax ovanför vattenlinjen, bottenfärg under
      for (let k = 0; k < BORD; k++) { const v = 0.94 + 0.06 * (k % 2); Bt.add(bordGeo(k), mE, (lx, ly, lz, nx, ny, nz, wx, wy, wz) => ly < 0.17 ? [0.16, 0.22, 0.2] : lerp(skala(vit, v * (0.94 + 0.1 * fbm(wx * 3, wz * 3 + wy, 2))), [0.5, 0.52, 0.42], (1 - mjuk(0.17, 0.3, ly)) * 0.7), an); }
      // insidan: ådrat oljat trä, något grånat på ovansidorna, mörkare nere i bilgen
      TXT = 5;   // insidan, durk, toftar och åror: mörkare oljat trä med ådring
      Bt.add(insGeo, mE, (lx, ly, lz, nx, ny, nz, wx, wy, wz) => lerp(skala(olja, (0.75 + 0.3 * Math.min(1, (ly - 0.08) / 0.5)) * (0.86 + 0.24 * fbm(wx * 1.2 + wz * 11, wz * 1.2 - wx * 11, 2))), [0.56, 0.55, 0.52], 0.25 * Math.max(0, ny)), an);
      Bt.add(spegelGeo, mE, vit, an);
      // reling (relingslist utanpå översta bordet), köl och förstäv
      for (const sx of [-1, 1]) for (let i = 0; i < N; i++) {
        const a = pkt(spant(i / N * 2 - 1), BORD, sx), c = pkt(spant((i + 1) / N * 2 - 1), BORD, sx), m = a.map((v, j) => (v + c[j]) / 2), dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], l = Math.hypot(dx, dy, dz);
        Bt.add(LADA(), M(...P3(m[0] + sx * 0.012, m[1] + 0.012, m[2]), 0.05, 0.045, l + 0.01, ryE + Math.atan2(dx, dz), -Math.atan2(dy, Math.hypot(dx, dz))), mahog, an);
      }
      Bt.add(LADA(), M(...P3(0, spant(0).r - spant(0).d - 0.025, -0.1), 0.06, 0.05, 3.7, ryE), [0.2, 0.2, 0.18], an);
      { const f = spant(1); Bt.add(LADA(), M(...P3(0, f.r - f.d / 2 + 0.03, LANG + 0.02), 0.06, f.d + 0.1, 0.07, ryE, 0.12), mahog, an); }
      // durk, toftar, akterbänk och förtofta (bredden följer skrovets insida på den höjden)
      const inre = (z, y) => { const sp = spant(z / LANG); let k = 0; while (k < BORD && pkt(sp, k + 1, 1)[1] < y) k++; const p0 = pkt(sp, k, 1), p1 = pkt(sp, Math.min(BORD, k + 1), 1), t = p1[1] > p0[1] ? (y - p0[1]) / (p1[1] - p0[1]) : 0; return (p0[0] + (p1[0] - p0[0]) * Math.min(1, Math.max(0, t))) * 0.95; };
      for (let z = -1.55; z <= 1.2; z += 0.14) { const sp = spant(z / LANG), y = sp.r - sp.d + 0.07; Bt.add(LADA(), M(...P3(0, y, z), inre(z, y) * 1.4, 0.015, 0.11, ryE), skala(olja, 0.75 + r() * 0.1), an); }
      for (const [z, dz2] of [[-0.35, 0.2], [0.55, 0.2], [-1.6, 0.32], [1.45, 0.16]]) { const y = spant(z / LANG).r - 0.17; Bt.add(LADA(), M(...P3(0, y, z), inre(z, y) * 2, 0.03, dz2, ryE), skala(olja, 1.1), an); }
      // åror på toftarna (bladen akterut), årtullar på relingen
      for (const sx of [-1, 1]) {
        const y = spant(0.1).r - 0.13, x = sx * 0.28;
        Bt.add(CYL(), MAB(P3(x, y, 1.25), P3(x * 1.15, y + 0.03, -0.95), 0.022), [0.72, 0.6, 0.42], an);
        Bt.add(LADA(), M(...P3(x * 1.18, y + 0.035, -1.2), 0.13, 0.012, 0.5, ryE), [0.7, 0.58, 0.4], an);
        const sp = spant(0.1 / LANG), [tx2, ty] = pkt(sp, BORD, sx);
        for (const o of [-0.035, 0.035]) Bt.add(LADA(), M(...P3(tx2, ty + 0.07, 0.1 + o), 0.012, 0.08, 0.012, ryE), [0.12, 0.12, 0.12], an);
      }
      // en ringlad lina i fören och ett öskar i trä akterut på durken
      { const RL = bas('linrulle', () => new THREE.TorusGeometry(1, 0.16, 4, 14));
        for (let k = 0; k < 3; k++) { const sp = spant(1.12 / LANG); Bt.add(RL, M(...P3(0.02 * k, sp.r - sp.d + 0.1 + k * 0.022, 1.12), 0.11 - k * 0.012, 0.11 - k * 0.012, 0.11 - k * 0.012, ryE, Math.PI / 2), [0.8, 0.74, 0.58], an); }
        const sa = spant(-1.05 / LANG); Bt.add(LADA(), M(...P3(0.12, sa.r - sa.d + 0.12, -1.05), 0.13, 0.07, 0.2, ryE + 0.4), (lx, ly) => skala([0.55, 0.4, 0.25], ly > 0.4 ? 0.6 : 1), an); }
      // förtöjningslina från förstävens ring till en pollare på bryggkanten, hänger i en lätt båge
      { const f = spant(1), a0 = P3(0, f.r + 0.02, LANG + 0.04), pd = d + 2.5, pp = [b.dx * pd - b.px * ((b.HB || 0.9) - 0.1), b.y + 0.02, b.dz * pd - b.pz * ((b.HB || 0.9) - 0.1)];
        Bt.add(CYLS(), M(pp[0], b.y - 0.02, pp[2], 0.045, 0.2, 0.045), [0.15, 0.15, 0.15]);
        const sp = t => [a0[0] + (pp[0] - a0[0]) * t, a0[1] + (pp[1] + 0.12 - a0[1]) * t - 0.22 * Math.sin(Math.PI * t), a0[2] + (pp[2] - a0[2]) * t];
        for (let i = 0; i < 8; i++) Bt.add(CYL(), MAB(sp(i / 8), sp((i + 1) / 8), 0.011), [0.82, 0.76, 0.6]);
      }
      hind.push([ex, ez, 1.0], [...LE(0, 1.6)].concat(0.5), [...LE(0, -1.7)].concat(0.6));
    }
    yield;
    TXT = 0;
    yield;
    { // fågelholk på en grå stolpe en bit upp på land
      for (let g = 150; g <= 260; g += 12) {
        const a = g * Math.PI / 180, x = Math.cos(a) * 14, z = Math.sin(a) * 14;
        if (!krav(x, z, 'lag') || mal.blockerad(x, z, 1) || kant(x, z) < 4 || !ledig(x, z, 1) || hy(x, z) < VY + 0.6) continue;
        const y = hy(x, z), ry = a + Math.PI; ta(x, z, 1);
        Bt.add(CYL(), M(x, y, z, 0.045, 2.3, 0.045), [0.5, 0.48, 0.44]);
        Bt.add(LADA(), M(x, y + 2.45, z, 0.2, 0.3, 0.2, ry), [0.6, 0.47, 0.34]);
        Bt.add(LADA(), M(x, y + 2.64, z, 0.28, 0.03, 0.3, ry, 0.25, 0), [0.25, 0.2, 0.16]);
        const L = R2(x, z, ry), [hx, hz] = L(0, 0.105); Bt.add(SKIVA(), M(hx, y + 2.5, hz, 0.035, 1, 0.035, ry, Math.PI / 2, 0), [0.05, 0.04, 0.03]);
        break;
      }
    }
    // stenmur: en rad gråsten i två skift längs tomtens landsida (låg, siktgatan påverkas inte)
    const mur = (x0, z0, x1, z1) => {
      const lang = Math.hypot(x1 - x0, z1 - z0), n = Math.round(lang / 0.62);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t + (r() - 0.5) * 0.15, z = z0 + (z1 - z0) * t + (r() - 0.5) * 0.15;
        if (mal.blockerad(x, z, 0.7) || kant(x, z) < 2.5 || hy(x, z) < VY + 0.3) continue;
        const y = hy(x, z); block(Bg, r, x, y, z, 0.32 + r() * 0.14, r() < 0.35, 0.2);
        if (r() < 0.7) block(Bg, r, x + (r() - 0.5) * 0.2, y + 0.32, z + (r() - 0.5) * 0.2, 0.22 + r() * 0.1, r() < 0.5, 0.15);
      }
    };
    // gärdsgård: par av stolpar med lutande slanor, grått väderbitet trä
    const gard = (x0, z0, x1, z1) => {
      const lang = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / lang, uz = (z1 - z0) / lang, n = Math.round(lang / 1.6), ry = Math.atan2(ux, uz);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ux * lang * i / n, z = z0 + uz * lang * i / n;
        if (mal.blockerad(x, z, 1) || kant(x, z) < 2.5 || hy(x, z) < VY + 0.3) continue;
        const y = hy(x, z), c = vari([0.5, 0.47, 0.42], r, 0.06);
        for (const s of [-1, 1]) Bt.add(CYL(), M(x - uz * s * 0.09, y - 0.1, z + ux * s * 0.09, 0.035, 1.35, 0.035, 0, (r() - 0.5) * 0.06, 0), c);
        if (i < n) for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, px = x + ux * 1.6 * t, pz = z + uz * 1.6 * t; Bt.add(CYL(), MAB([px - ux * 0.55, y + 0.05, pz - uz * 0.55], [px + ux * 0.55, y + 1.15, pz + uz * 0.55], 0.02), vari([0.48, 0.43, 0.37], r, 0.12)); }
      }
    };
    yield;
    { const S = Math.max(mal.L, mal.W);
      // muren längs högra sidan bakom huset (sedd från starten: till höger), gärdsgården till vänster framåt
      const [ax, az] = [S / 2 + 9, -2], [bx, bz] = [S / 2 + 9, -(S / 2 + 14)];
      // (team-mark: stenmuren togs bort – raden av rundade block såg ut som lösa tvålstenar)
      if (false) mur(ax, az, bx, bz);
      // (team-tomt: den lösa gärdsgårdsbiten mitt på gräset togs bort; tomtens gärdsgård med grind byggs i husritare-miljo.js,
      // tomtGrund(…, 'kust'), runt hela landsidan)
      if (false) gard(-(S / 2 + 10), 6, -(S / 2 + 10), 18);
    }
    // -- stigar (team-mark): trampade stigar i ängen från huset ner till sjöboden och eldstaden (husritare-miljo.js ritar
    // dem i markens skuggare via uStig och håller gräset borta). Lite slingriga: fyra sträckor per stig. --
    const stigar = [];
    yield;
    { const mal2 = (tx2, tz2) => [Math.max(-mal.L / 2 - 0.9, Math.min(mal.L / 2 + 0.9, tx2)), Math.max(-mal.W / 2 - 0.9, Math.min(mal.W / 2 + 0.9, tz2))];
      const mal3 = [];
      // till boden: förbi gaveln (dörrarna vetter mot sjön), på den sida som ligger närmast huset
      if (bod) { const A = bod.L(bod.W / 2 + 0.9, bod.D * 0.2), B = bod.L(-bod.W / 2 - 0.9, bod.D * 0.2); mal3.push(Math.hypot(...A) < Math.hypot(...B) ? A : B); }
      if (eld) mal3.push([eld[0], eld[2]]);
      for (const [ex, ez] of mal3) {
        const [sx, sz] = mal2(ex, ez), dx = ex - sx, dz = ez - sz, l = Math.hypot(dx, dz);
        if (l < 2.5) continue;
        const nx = -dz / l, nz = dx / l, amp = Math.min(1.2, l * 0.07) * (r() < 0.5 ? -1 : 1), fas = r() * 0.6;
        let px = sx, pz = sz;
        for (let i = 1; i <= 4; i++) {
          const t = i / 4, o = i < 4 ? amp * Math.sin(t * Math.PI + fas) : 0, qx = sx + dx * t + nx * o, qz = sz + dz * t + nz * o;
          stigar.push([px, pz, qx, qz]); px = qx; pz = qz;
        }
      }
    }
    const stigAv = (x, z) => { let m = 99; for (const [ax, az, bx, bz] of stigar) { const ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1))); m = Math.min(m, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return m; };
    // -- (team-tomt) sommartomten: en liten röd vedeldad bastu nere vid stranden med däck, utedusch och trappstenar ner
    // i vattnet, en hängmatta mellan två björkar med utsikt över sjön, en syrenberså längs gärdsgården och en rad
    // vinbärsbuskar. Gärdsgården står i husritare-miljo.js (tomtGrund, 11 m från gavlarna, 8 m fram); björkarna (Fab)
    // läggs där också (bjorkar). Allt i tingens och växternas nät, inga nya ritanrop; egen slump (ängen står kvar). --
    const bjorkar = [], buskar = [];
    let bastuP = null;   // bastuns mitt (gräset hålls borta, se stigAv i svaret)
    let stketAv = () => 99;
    yield;
    { const rt = slump(8181), { L: HL, W: HW, dorr } = mal, dn = [dorr.nx, dorr.nz], du = [-dorr.nz, dorr.nx];
      const HOR = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => [a * HL / 2, c * HW / 2]);
      const sA = (x, z) => x * du[0] + z * du[1], fA = (x, z) => x * dn[0] + z * dn[1], PT = (s, f) => [du[0] * s + dn[0] * f, du[1] * s + dn[1] * f];
      const SIDOR = [Math.min(...HOR.map(h => sA(...h))) - 11, Math.max(...HOR.map(h => sA(...h))) + 11], fBak = Math.min(...HOR.map(h => fA(...h)));
      const nUt = (x, z) => { const gx = kustQ(x + 0.5, z) - kustQ(x - 0.5, z), gz = kustQ(x, z + 0.5) - kustQ(x, z - 0.5), l = Math.hypot(gx, gz) || 1; return [gx / l, gz / l]; };
      const tra = [0.58, 0.54, 0.48], betong = [0.56, 0.55, 0.53], svart = [0.09, 0.09, 0.1];
      const glas = (lx, ly) => lerp([0.05, 0.065, 0.08], [0.6, 0.68, 0.74], mjuk(-0.1, 0.5, ly + lx * 0.25));
      // ---- bastun: 2,4 × 2,2 m, gaveln med dörr, fönster och skärmtak mot sjön; däck framför, utedusch vid sidan ----
      const BW = 2.4, BD = 2.2, BH = 2.0, DK = 1.5;
      let bb = null;
      for (let g = -110; g <= 30; g += 2.5) {
        const a = g * Math.PI / 180;
        for (let rr = 9; rr < 40; rr += 0.8) {
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          if (kustQ(x, z) < 4 || Math.min(Math.abs(sA(x, z) - SIDOR[0]), Math.abs(sA(x, z) - SIDOR[1])) < 3.2) continue;   // nedanför gärdsgårdens ände
          const [nx, nz] = nUt(x, z), ry = Math.atan2(nx, nz), Lb = R2(x, z, ry);
          if (!krav(x, z, 'liten') || mal.blockerad(x, z, 1.2) || !ledig(x, z, 3.4) || stigAv(x, z) < 3.2 || kant(x, z) < 9) continue;
          if ((bod && Math.hypot(x - bod.x, z - bod.z) < 12) || (eld && Math.hypot(x - eld[0], z - eld[2]) < 9)) continue;
          let lo = 99, hi = -99;
          for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const h = hy(...Lb((i / 4 - 0.5) * (BW + 1.9), -BD / 2 - 0.2 + j / 4 * (BD + DK + 0.2))); lo = Math.min(lo, h); hi = Math.max(hi, h); }
          if (lo < VY + 0.04 || hi - lo > 0.9) continue;
          const p = (hi - lo) * 2 + rr * 0.05 + (lo - VY) * 1.5;
          if (!bb || p < bb.p) bb = { p, x, z, ry, Lb, hi };
        }
      }
      if (bb) {
        const { x, z, ry, Lb: L, hi } = bb, y0 = hi + 0.16;
        ta(x, z, 3.3); bastuP = L(0, 0.6);
        const P3 = (lx, ly, lz) => { const [px, pz] = L(lx, lz); return [px, ly, pz]; };
        const box = (lx, ly, lz, sx, sy, sz, f, rx = 0, rz = 0) => Bt.add(LADA(), M(...P3(lx, ly, lz), sx, sy, sz, ry, rx, rz), f);
        const G = (lx, lz) => hy(...L(lx, lz));
        // grund: betongplintar och en mörk sockelbräda
        for (const lx of [-BW / 2 + 0.12, BW / 2 - 0.12]) for (const lz of [-BD / 2 + 0.12, 0, BD / 2 - 0.12]) { const g = G(lx, lz); box(lx, (g + y0) / 2 - 0.1, lz, 0.2, y0 - g + 0.1, 0.2, betong); }
        box(0, y0 - 0.07, 0, BW + 0.02, 0.14, BD + 0.02, [0.26, 0.21, 0.17]);
        TXT = 4;   // (sjö-ph) panel, knutar och vindskivor: målat trä med ådring (förr helt släta)
        // lockpanel i falu rödfärg: stående brädor med lock; gavlarna i smala brädor som följer takfallet
        // gavelns överkant = takskivans undersida (ingen glipa mot taket)
        const tak = BH + BW / 2 * 0.72, gavel = lx => Math.max(BH, (BH + tak) / 2 + 0.104 - (Math.abs(lx) - BW / 4 * 1.05) * 0.72);
        for (const s of [-1, 1]) for (let i = 0, n = 11; i < n; i++) {
          const lz = -BD / 2 + (i + 0.5) * BD / n, c = vari(roda, rt, 0.06);
          box(s * (BW / 2 + 0.02), y0 + BH / 2, lz, 0.04, BH, BD / n + 0.003, (lx, ly) => skala(c, 0.84 + 0.12 * (ly + 0.5)));
          if (i % 2) box(s * (BW / 2 + 0.05), y0 + BH / 2, lz, 0.03, BH, 0.05, skala(c, 0.84));
        }
        for (const s of [-1, 1]) for (let i = 0, n = 24; i < n; i++) {
          const lx = -BW / 2 + (i + 0.5) * BW / n, hh = gavel(lx), c = vari(roda, rt, 0.05);
          box(lx, y0 + hh / 2, s * (BD / 2 + 0.02), BW / n + 0.003, hh, 0.04, (l2, ly) => skala(c, 0.84 + 0.12 * (ly + 0.5)));
          if (i % 4 === 1) box(lx, y0 + hh / 2, s * (BD / 2 + 0.045), 0.045, hh, 0.025, skala(c, 0.84));
        }
        // vita knutbrädor och vindskivor; svart papptak med läkt, skärmtak 0,7 m ut över däcket (0,3 m bak)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (BW / 2 + 0.03), y0 + BH / 2, sz * (BD / 2 + 0.03), 0.12, BH, 0.12, vit);
        const vinkel = Math.atan2(tak - BH, BW / 2), sl = Math.hypot(BW / 2, tak - BH) + 0.36, ym = y0 + (BH + tak) / 2 + 0.12;
        // vindskivorna i takskivans eget läge och lutning (överkanten jäms med taket), och en skuggad list tätt på
        // gavelväggen längs takfallet som täcker panelens överkant
        for (const [sz, oz] of [[1, 0.7], [-1, 0.3]]) for (const sx of [-1, 1]) box(sx * BW / 4 * 1.05, ym - 0.02, sz * (BD / 2 + oz + 0.02), sl + 0.05, 0.15, 0.035, vit, 0, -sx * vinkel);
        for (const sz of [-1, 1]) for (const sx of [-1, 1]) box(sx * BW / 4 * 1.05, ym - 0.07, sz * (BD / 2 + 0.065), sl - 0.5, 0.13, 0.03, skala(roda, 0.55), 0, -sx * vinkel);
        for (const sx of [-1, 1]) {
          box(sx * BW / 4 * 1.05, ym + 0.02, 0.2, sl + 0.05, 0.07, BD + 1.04, [0.13, 0.13, 0.145], 0, -sx * vinkel);
          for (let k = 0; k < 6; k++) box(sx * (BW / 4 * 1.05 + Math.sin(vinkel) * 0.05), ym + 0.02 + Math.cos(vinkel) * 0.05, -BD / 2 - 0.28 + (k + 0.5) * (BD + 1.0) / 6, sl + 0.03, 0.035, 0.04, (lx, ly) => ly > 0 ? [0.2, 0.2, 0.215] : [0.1, 0.1, 0.11], 0, -sx * vinkel);
          const ex = BW / 4 * 1.05 + (sl + 0.05) / 2 * Math.cos(vinkel), ey = ym + 0.02 - (sl + 0.05) / 2 * Math.sin(vinkel);
          box(sx * (ex + 0.015), ey - 0.06, 0.2, 0.035, 0.14, BD + 1.06, vit);   // takfotsbräda
        }
        box(0, y0 + tak + 0.15, 0.2, 0.13, 0.07, BD + 1.06, svart);   // nock
        TXT = 0;
        // två stolpar bär skärmtakets främre ände (på däcket)
        for (const sx of [-1, 1]) { const hh = BH + 0.17; box(sx * (BW / 2 - 0.08), y0 + hh / 2, BD / 2 + 0.62, 0.09, hh, 0.09, vit); }
        // skorsten: svart rör ur takfallet med regnhatt, kamin inne
        { const [px, pz] = L(0.5, -0.4), yb = y0 + gavel(0.5) - 0.05;
          Bt.add(CYLS(), M(px, yb, pz, 0.075, tak - gavel(0.5) + 1.15, 0.075), svart);
          Bt.add(CYLS(), M(px, yb + 0.05, pz, 0.13, 0.05, 0.13), [0.16, 0.16, 0.17]);   // takgenomföring
          Bt.add(KON(), M(px, y0 + tak + 1.18, pz, 0.17, 0.12, 0.17), svart);
          Bt.add(CYLS(), M(px, y0 + tak + 1.1, pz, 0.08, 0.09, 0.08), [0.2, 0.2, 0.2]); }
        // dörren (oljat trä, Z-regel, vitt foder) och ett fyrkantigt fönster på gaveln, ett smalt fönster på långsidan
        const ek = [0.52, 0.38, 0.24];
        box(-0.32, y0 + 0.95, BD / 2 + 0.045, 0.86, 1.92, 0.03, vit);
        box(-0.32, y0 + 0.9, BD / 2 + 0.065, 0.7, 1.78, 0.04, (lx, ly) => skala(ek, 0.85 + 0.15 * Math.abs(Math.sin(lx * 31))));
        for (const yy of [0.3, 1.5]) box(-0.32, y0 + yy, BD / 2 + 0.09, 0.62, 0.1, 0.025, skala(ek, 0.75));
        { const [px, pz] = L(-0.32, BD / 2 + 0.09); Bt.add(LADA(), M(px, y0 + 0.9, pz, 0.08, 1.28, 0.025, ry, 0, 0.45), skala(ek, 0.75)); }
        box(-0.05, y0 + 0.95, BD / 2 + 0.11, 0.05, 0.22, 0.04, [0.3, 0.2, 0.12]);   // handtag i trä
        const fonster = (lx, lz, yc, w, h, n) => {   // n: [nx, nz] väggens normal
          const Q = (o, d1, d2, sw, sh, f) => { const [px, pz] = L(lx + n[0] * o + (n[0] ? 0 : d1), lz + n[1] * o + (n[1] ? 0 : d1)); Bt.add(LADA(), M(px, yc + d2, pz, n[0] ? 0.03 : sw, sh, n[0] ? sw : 0.03, ry), f); };
          Q(0.05, 0, 0, w + 0.14, h + 0.14, vit); Q(0.07, 0, 0, w - 0.04, h - 0.04, glas);
          Q(0.085, 0, 0, 0.035, h - 0.02, vit); Q(0.085, 0, 0, w - 0.02, 0.035, vit);
          for (const s of [-1, 1]) { Q(0.08, s * (w / 2 - 0.01), 0, 0.03, h, vit); Q(0.08, 0, s * (h / 2 - 0.01), w, 0.03, vit); }
          Q(0.1, 0, -h / 2 - 0.09, w + 0.2, 0.025, [0.82, 0.82, 0.8]);
        };
        fonster(0.6, BD / 2 + 0.02, y0 + 1.32, 0.46, 0.46, [0, 1]);
        fonster(BW / 2 + 0.02, -0.2, y0 + 1.42, 0.6, 0.34, [1, 0]);
        TXT = 1;   // (sjö-ph) däck och bänk: naturligt trä
        // däcket framför: tvärlagda grå brädor på reglar, plintar i framkant, trappa om det är högt
        for (let lz = BD / 2 + 0.03, k = 0; lz < BD / 2 + DK; lz += 0.145, k++) { const c = vari(tra, rt, 0.07); box((rt() - 0.5) * 0.02, y0 - 0.035, lz + 0.07, BW + 0.6, 0.035, 0.13, (lx, ly) => skala(c, ly > 0 ? 1 : 0.7)); }
        for (const sx of [-1, 0, 1]) { box(sx * (BW / 2 + 0.2), y0 - 0.13, BD / 2 + DK / 2, 0.07, 0.15, DK, skala(tra, 0.6)); const g = G(sx * (BW / 2 + 0.2), BD / 2 + DK - 0.1); box(sx * (BW / 2 + 0.2), (g + y0) / 2 - 0.12, BD / 2 + DK - 0.1, 0.16, y0 - g, 0.16, betong); }
        box(0, y0 - 0.1, BD / 2 + DK + 0.01, BW + 0.62, 0.11, 0.025, skala(tra, 0.8));   // kantbräda
        { const gF = G(0, BD / 2 + DK + 0.3), h = y0 - gF;
          if (h > 0.22) { const n = Math.ceil(h / 0.18); for (let k = 1; k < n; k++) box(0, y0 - k * h / n - 0.02, BD / 2 + DK + (k - 0.5) * 0.27, 1.0, 0.035, 0.25, vari(tra, rt, 0.06)); }
        }
        // bänk under fönstret, bastuhink med skopa vid dörren och en randig badhandduk på en krok
        for (const s of [-1, 1]) box(0.62 + s * 0.42, y0 + 0.2, BD / 2 + 0.3, 0.05, 0.4, 0.3, skala(tra, 0.75));
        box(0.62, y0 + 0.43, BD / 2 + 0.3, 1.05, 0.05, 0.34, (lx, ly) => skala(tra, ly > 0.4 ? 1.02 : 0.72));
        { const [px, pz] = L(-0.95, BD / 2 + 0.35); Bt.add(CYLS(), M(px, y0, pz, 0.14, 0.22, 0.14), (lx, ly) => Math.abs(ly - 0.25) < 0.06 || Math.abs(ly - 0.8) < 0.06 ? [0.5, 0.5, 0.48] : ly > 0.98 ? [0.36, 0.26, 0.16] : ek);
          Bt.add(CYL(), MAB([px, y0 + 0.2, pz], [px + 0.2, y0 + 0.36, pz + 0.05], 0.012), skala(ek, 0.8)); }
        box(-0.92, y0 + 1.28, BD / 2 + 0.075, 0.24, 0.6, 0.015, (lx, ly) => (Math.floor((ly + 0.5) * 7) % 3 === 1) ? [0.22, 0.36, 0.55] : [0.93, 0.92, 0.88]);
        TXT = 0;
        // utedusch vid däckets sida: stolpe med rör, strilhuvud och kran, trall på marken
        { const dx = BW / 2 + 0.95, dz = BD / 2 + 0.45, g = G(dx, dz);
          for (let k = 0; k < 6; k++) box(dx, g + 0.04, dz - 0.36 + k * 0.145, 0.8, 0.04, 0.11, vari(tra, rt, 0.08));
          for (const s of [-1, 1]) box(dx + s * 0.32, g + 0.01, dz, 0.06, 0.04, 0.84, skala(tra, 0.6));
          box(dx, g + 1.08, dz - 0.45, 0.1, 2.25, 0.1, skala(tra, 0.85));
          const mt = [0.72, 0.5, 0.32];   // kopparrör
          Bt.add(CYL(), MAB(P3(dx, g + 0.3, dz - 0.39), P3(dx, g + 2.12, dz - 0.39), 0.014), mt);
          Bt.add(CYL(), MAB(P3(dx, g + 2.12, dz - 0.39), P3(dx, g + 2.12, dz - 0.02), 0.014), mt);
          { const [px, pz] = L(dx, dz - 0.02); Bt.add(CYLS(), M(px, g + 2.05, pz, 0.1, 0.04, 0.1), [0.75, 0.75, 0.77]); }
          box(dx, g + 1.1, dz - 0.37, 0.09, 0.05, 0.07, [0.7, 0.7, 0.72]); }
        // trappstenar från däcket ner mot vattnet
        for (let k = 0; k < 4; k++) { const lz = BD / 2 + DK + 0.75 + k * 0.62, lx = (k % 2 ? 0.12 : -0.1), [px, pz] = L(lx, lz), g = hy(px, pz);
          if (g < VY - 0.15) break;
          Bt.add(knol('hallsten' + k, 11 + k * 5, 0.32, 9, 5), M(px, Math.max(g, VY - 0.08) - 0.045, pz, 0.3 + rt() * 0.1, 0.07, 0.24 + rt() * 0.06, ry + rt() * 3), (l2, ly, l3, nx, ny, nz, wx, wy, wz) => { let f = skala([0.47, 0.45, 0.43], (0.7 + 0.3 * ny) * (0.8 + 0.4 * fbm(wx * 7, wz * 7, 2))); f = lerp(f, [0.6, 0.6, 0.52], mjuk(0.55, 0.68, fbm(wx * 3 + 4, wz * 3, 2)) * 0.6 * Math.max(0, ny)); return lerp(f, [0.56, 0.5, 0.46], 0.25); }); }   // flata granithällar, nedsänkta (en–två cm över marken)
        console.info('tomt: bastu vid', x.toFixed(1), z.toFixed(1));
      }
      // ---- hängmatta mellan två björkar uppe på gräset (minst några meter från stranden), längs strandlinjen så att man
      // ligger med sjöutsikt. Randig bomullsduk mellan spridarpinnar i trä, säckig med veck, lägsta punkt ~55 cm över
      // marken; rep från pinnarnas ändar till en ring och vidare till ett spännband runt varje stam ----
      let hm = null;
      for (let g = -120; g <= 25; g += 3) {
        const a = g * Math.PI / 180;
        for (let rr = 10; rr < 32; rr += 0.75) {
          const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
          if (kustQ(cx, cz) > 3 || kant(cx, cz) < 9.5 || !ledig(cx, cz, 2.6) || stigAv(cx, cz) < 2 || mal.blockerad(cx, cz, 2) || hy(cx, cz) < VY + 0.6) continue;
          const [nx, nz] = nUt(cx, cz), tx = -nz, tz = nx, T = [[cx + tx * 1.9, cz + tz * 1.9], [cx - tx * 1.9, cz - tz * 1.9]];
          if (!T.every(([px, pz]) => krav(px, pz, 'liten') && !mal.blockerad(px, pz, 1.2) && ledig(px, pz, 1.4) && hy(px, pz) > VY + 0.6 && kustQ(px, pz) < 3.5 && stigAv(px, pz) > 1.4)) continue;
          if ((eld && Math.hypot(cx - eld[0], cz - eld[2]) < 6) || (bod && Math.hypot(cx - bod.x, cz - bod.z) < 7) || (bastuP && Math.hypot(cx - bastuP[0], cz - bastuP[1]) < 5)) continue;
          if (Math.min(Math.abs(sA(cx, cz) - SIDOR[0]), Math.abs(sA(cx, cz) - SIDOR[1])) < 2.5) continue;   // inte i gärdsgården
          const p = rr * 0.1 + Math.abs(g + 55) * 0.012 + Math.abs(hy(...T[0]) - hy(...T[1])) * 4;
          if (!hm || p < hm.p) hm = { p, T, cx, cz };
        }
      }
      if (hm) {
        const { T } = hm; ta(hm.cx, hm.cz, 2.4); T.forEach(([px, pz]) => ta(px, pz, 1));
        T.forEach(([px, pz]) => bjorkar.push({ x: px, y: hy(px, pz) - 0.05, z: pz, h: 9 + rt() * 2, ry: rt() * 6.28 }));
        const [[ax, az], [bx2, bz2]] = T, dd = Math.hypot(bx2 - ax, bz2 - az), e = [(bx2 - ax) / dd, (bz2 - az) / dd], sd = [-e[1], e[0]];
        const gA = hy(ax, az), gB = hy(bx2, bz2), gM = hy(hm.cx, hm.cz), ryE = Math.atan2(e[0], e[1]);
        const A = [ax + e[0] * 0.13, gA + 1.8, az + e[1] * 0.13], B = [bx2 - e[0] * 0.13, gB + 1.8, bz2 - e[1] * 0.13];
        const yE = Math.min(gA, gB) + 1.12, E1 = [A[0] + e[0] * 0.78, yE, A[2] + e[1] * 0.78], E2 = [B[0] - e[0] * 0.78, yE, B[2] - e[1] * 0.78];
        const sag = yE - (gM + 0.55), BR = 0.4;   // dukens halva bredd vid pinnarna
        // u längs mattan (0–1), v tvärs (−1–1): kanterna lyfts (säcken), mjuka längsgående veck, smalare på mitten
        const DP = (u, v) => { const s = Math.sin(Math.PI * u), w = BR * (1 - 0.22 * s), b = [E1[0] + (E2[0] - E1[0]) * u, E1[1] + (E2[1] - E1[1]) * u, E1[2] + (E2[2] - E1[2]) * u];
          const y = b[1] - sag * s + 0.2 * v * v * s + 0.018 * Math.sin(v * 9.4) * s; return [b[0] + sd[0] * v * w, y, b[2] + sd[1] * v * w]; };
        const NV = [0.9, 0.88, 0.82], BL = [0.32, 0.46, 0.62];
        const farg = v => { const t = Math.abs(v); return (t > 0.18 && t < 0.3) || (t > 0.62 && t < 0.7) ? BL : NV; };
        const pp = [], nn = [], ff = [], NU = 18, NVV = 14;
        for (let i = 0; i < NU; i++) for (let j = 0; j < NVV; j++) {
          const u0 = i / NU, u1 = (i + 1) / NU, v0 = j / NVV * 2 - 1, v1 = (j + 1) / NVV * 2 - 1, q = [DP(u0, v0), DP(u1, v0), DP(u1, v1), DP(u0, v1)];
          const c = farg((v0 + v1) / 2), k = 0.92 + 0.08 * Math.cos((v0 + v1) * 4.7);
          for (const [a1, b1, c1] of [[0, 1, 2], [0, 2, 3]]) {
            const P = [q[a1], q[b1], q[c1]], n = nrm(kors([P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]]));
            const nu = n[1] < 0 ? n.map(v => -v) : n;
            for (const p of P) { pp.push(...p); nn.push(...nu); ff.push(c[0] * k, c[1] * k, c[2] * k); }
          }
        }
        Bt.ra(pp, nn, ff);
        const tra2 = [0.62, 0.48, 0.32], rep2 = [0.74, 0.66, 0.5], band = [0.24, 0.3, 0.38];
        for (const [S, u, sg, g0] of [[A, 0, 1, gA], [B, 1, -1, gB]]) {
          // spridarpinne i trä tvärs över dukens ände
          const P0 = DP(u, -1.12), P1 = DP(u, 1.12); Bt.add(CYLS(), MAB(P0, P1, 0.02), tra2);
          // repen: pinnens ändar och mitt till en ring, ringen till stammen; spännband runt stammen
          const R = [S[0] + e[0] * sg * 0.42, S[1] - 0.26, S[2] + e[1] * sg * 0.42];
          for (const v of [-1.08, -0.5, 0, 0.5, 1.08]) Bt.add(CYL(), MAB(R, DP(u, v), 0.008), rep2);
          Bt.add(CYL(), MAB(S, R, 0.016), rep2);
          Bt.add(bas('ring', () => new THREE.TorusGeometry(0.06, 0.011, 5, 12)), M(R[0], R[1], R[2], 0.5, 0.5, 0.5, ryE + Math.PI / 2), [0.35, 0.35, 0.36]);
          const tc = [S[0] - e[0] * sg * 0.13, S[1], S[2] - e[1] * sg * 0.13];
          Bt.add(CYL(), M(tc[0], tc[1] - 0.025, tc[2], 0.155, 0.05, 0.155), band);
          void g0;
        }
        // kudde i ena änden och en rutig ullfilt i mattan
        { const p = DP(0.2, 0); Bt.add(knol('kudde', 3, 0.12, 8, 5), M(p[0], p[1] + 0.09, p[2], 0.26, 0.08, 0.18, ryE, 0, 0), [0.78, 0.8, 0.72]); }
        { const rut = (lx, ly, lz) => (Math.floor((lx + 0.5) * 5) + Math.floor((lz + 0.5) * 5) + Math.floor((ly + 0.5) * 5)) % 2 ? [0.62, 0.26, 0.2] : [0.86, 0.8, 0.7];
          const p = DP(0.6, 0.35), q = DP(0.6, 1.0);
          Bt.add(LADA(), M((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.03, (p[2] + q[2]) / 2, 0.5, 0.025, Math.hypot(q[0] - p[0], q[2] - p[2]) + 0.05, ryE + Math.PI / 2, -Math.atan2(q[1] - p[1], Math.hypot(q[0] - p[0], q[2] - p[2])), 0), rut);
        }
        console.info('tomt: hängmatta vid', hm.cx.toFixed(1), hm.cz.toFixed(1));
      }
      // ---- syrener och bärbuskar: riktiga lövbuskar (miljöns buskmodell; husritare-miljo.js lägger dem via buskar) med
      // minst en meter fritt till gärdsgården; syrenerna i en oregelbunden grupp bakom huset, bärbuskarna i en rad fram ----
      { let bast = null;
        for (const s of [SIDOR[0] + 2.7, SIDOR[1] - 2.7]) for (let f = fBak + 1; f > fBak - 12; f -= 0.5) {
          const [x, z] = PT(s, f);
          if (hy(x, z) < VY + 0.3 || kustQ(x, z) > 4 || !krav(x, z, 'liten') || !ledig(x, z, 2.2) || mal.blockerad(x, z, 1.6) || stigAv(x, z) < 2.2) continue;
          if (![-1.6, 1.6].every(o => { const [qx, qz] = PT(s, f + o); return hy(qx, qz) > VY + 0.3 && ledig(qx, qz, 1.2) && !mal.blockerad(qx, qz, 1.2); })) continue;
          const p = Math.abs(f - fBak + 2.5) * 0.3 - (eld ? Math.hypot(x - eld[0], z - eld[2]) * 0.05 : 0);
          if (!bast || p < bast.p) bast = { p, s, f, inn: s < 0 ? 1 : -1 };
        }
        if (bast) for (const [o, d, h] of [[-0.8, 0.15, 1.9], [0.9, -0.2, 1.7]]) { const [x, z] = PT(bast.s + bast.inn * d, bast.f + o + (rt() - 0.5) * 0.3); buskar.push({ x, z, h: h + rt() * 0.3 }); ta(x, z, 1.3); }
      }
      { let bast = null;
        for (const s of [SIDOR[0] + 1.8, SIDOR[1] - 1.8]) for (let f = fBak + 1; f < fBak + HW + 7; f += 0.5) {
          const pts = [0, 1.3, 2.6].map(o => PT(s, f + o));
          if (!pts.every(([x, z]) => hy(x, z) > VY + 0.3 && kustQ(x, z) < 4 && ledig(x, z, 0.8) && !mal.blockerad(x, z, 0.9) && stigAv(x, z) > 1.2)) continue;
          const p = Math.abs(f - fBak - 2) * 0.2 + (eld ? Math.hypot(...PT(s, f).map((v, i) => v - [eld[0], eld[2]][i])) * 0.03 : 0);
          if (!bast || p < bast.p) bast = { p, pts };
        }
        if (bast) bast.pts.forEach(([x, z]) => { buskar.push({ x, z, h: 0.85 + rt() * 0.2 }); ta(x, z, 0.8); });
      }
      // avstånd till gärdsgårdens linjer (sidorna och framkanten), så att ängens blommor inte står i den
      stketAv = (x, z) => { const s = sA(x, z), f = fA(x, z), fF = Math.max(...HOR.map(h => fA(...h))) + 8;
        let m = Math.abs(f - fF) + (s < SIDOR[0] || s > SIDOR[1] ? 99 : 0);
        if (f < fF + 0.5) m = Math.min(m, Math.abs(s - SIDOR[0]), Math.abs(s - SIDOR[1]));
        return m; };
    }
    // -- strandängen: lupiner, smörblommor, prästkragar, älggräs och fackelblomster; mossiga block i brynet --
    const stjalk = (B, x, y, z, h, c) => B.add(PLAN(), M(x, y, z, 0.012, h, 1, r() * 6.28), c, { vaj: (lx, ly) => ly * ly * 0.06 });
    // lupin: grön bladrosett av handflikiga blad (9 småblad i solfjäder), 1–4 stänglar med täta, tjocka blomspiror
    // (lila, rosa, vit; knoppigt grönaktig topp), ett par stängelblad. Spiran är ett eget svarvat nät med blomkransar.
    const LSPIRA = () => bas('lupspira', () => {
      const pr = [new THREE.Vector2(0.001, 0)];
      for (let i = 0; i <= 9; i++) { const t = i / 9, rr = (1 - 0.7 * Math.pow(t, 1.4)) * (0.84 + 0.16 * Math.cos(t * Math.PI * 9)); pr.push(new THREE.Vector2(rr, t * 0.97)); }
      pr.push(new THREE.Vector2(0.001, 1));
      return new THREE.LatheGeometry(pr, 5);
    });
    const LBLAD = () => bas('lupblad', () => {
      const P = [], n = 7;
      for (let i = 0; i < n; i++) {
        const v = i / n * Math.PI * 2, c = Math.cos(v), sn = Math.sin(v), w = 0.19, m = 0.55;
        const tip = [c, -0.22, sn], l = [c * m - sn * w, 0.02, sn * m + c * w], rr = [c * m + sn * w, 0.02, sn * m - c * w];
        P.push(0, 0, 0, ...l, ...tip, 0, 0, 0, ...tip, ...rr);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
    });
    const LUPF = [[0.36, 0.3, 0.74], [0.42, 0.26, 0.72], [0.82, 0.42, 0.66], [0.9, 0.55, 0.72], [0.94, 0.92, 0.94]];
    // riktiga lupiner (husritare-blommor.js): alfakort med målade blomspiror och handflikiga blad, ett nät för alla
    const LUPP = [], LUPB = [[0.3, 0.2, 0.92], [0.46, 0.18, 0.82], [0.92, 0.26, 0.58], [1.0, 0.48, 0.72], [1.0, 0.98, 0.95]];
    const lupin = (x, y, z, fk) => {
      if (blommor.klar()) { LUPP.push({ art: 'lupin', x, y: y + 0.01, z, s: 0.85 + r() * 0.3, ry: r() * 6.28, f: LUPB[fk[(r() * fk.length) | 0]] }); return; }
      const bl = [0.28, 0.48, 0.15];   // (friskare sommargrönt)
      for (let i = 0, n = 3 + (r() * 2 | 0); i < n; i++) { const v = i / n * 6.283 + r(), dd = 0.1 + r() * 0.08, s = 0.14 + r() * 0.05; Bv.add(LBLAD(), M(x + Math.cos(v) * dd, y + 0.12 + r() * 0.16, z + Math.sin(v) * dd, s, s, s, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), (lx, ly, lz) => skala(bl, 0.75 + 0.45 * (lx * lx + lz * lz)), { vaj: () => 0.012 }); }
      for (let k = 0, n = 1 + (r() * 2.6 | 0); k < n; k++) {
        const h = 0.75 + r() * 0.4, sx = x + (r() - 0.5) * 0.18, sz = z + (r() - 0.5) * 0.18, c = vari(LUPF[fk[(r() * fk.length) | 0]], r, 0.06), hs = h * (0.38 + r() * 0.1), rs = 0.045 + r() * 0.012;
        stjalk(Bv, sx, y, sz, h - hs * 0.9, [0.24, 0.34, 0.13]);
        Bv.add(LBLAD(), M(sx, y + h * 0.38, sz, 0.11, 0.11, 0.11, r() * 6.28, 0.2, 0), bl, { vaj: () => 0.02 });
        Bv.add(LSPIRA(), M(sx, y + h - hs, sz, rs, hs, rs, r() * 6.28), (lx, ly) => {
          // blomkransarna: ljusare segel (fanan) i varannan rad, mörkare nertill i kransen; gröna knoppar i toppen
          const rad = 0.5 + 0.5 * Math.cos(ly * Math.PI * 9 / 0.97), k2 = lerp(skala(c, 0.72 + 0.4 * rad), [0.96, 0.95, 0.96], 0.18 * rad * (ly < 0.7 ? 1 : 0));
          return lerp(k2, [0.45, 0.5, 0.3], mjuk(0.72, 0.98, ly) * 0.7);
        }, { vaj: (lx, ly) => 0.035 + ly * 0.04 });
      }
    };
    const blomma = (x, y, z, h, c, s, mitt) => {
      stjalk(Bv, x, y, z, h, [0.28, 0.38, 0.14]);
      Bv.add(SKIVA(), M(x, y + h, z, s, 1, s, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), c, { vaj: () => h * h * 0.06 });
      if (mitt) Bv.add(SKIVA(), M(x, y + h + 0.004, z, s * 0.35, 1, s * 0.35), mitt, { vaj: () => h * h * 0.06 });
    };
    const alggras = (x, y, z) => { const h = 0.6 + r() * 0.35; for (let i = 0; i < 2; i++) { const hx = x + (r() - 0.5) * 0.15, hz = z + (r() - 0.5) * 0.15, hh = h * (0.85 + r() * 0.2); Bv.add(PLAN(), M(hx, y, hz, 0.02, hh, 1, r() * 6.28), [0.26, 0.36, 0.13], { vaj: (lx, ly) => ly * ly * 0.06 }); for (let q = 0; q < 2; q++) Bv.add(knol('alg', 3, 0.6, 5, 3), M(hx + (r() - 0.5) * 0.06, y + hh - q * 0.03, hz + (r() - 0.5) * 0.06, 0.03, 0.025, 0.03, r() * 6.28), [0.92, 0.88, 0.72], { vaj: () => hh * hh * 0.06, anim: BARR }); } for (let i = 0; i < 4; i++) Bv.add(PLAN(), M(x, y + 0.1, z, 0.05, 0.3, 1, i * 1.6, 0.8, 0), [0.22, 0.32, 0.12], { vaj: () => 0.01 }); };
    const fackla = (x, y, z) => { const h = 0.6 + r() * 0.3; stjalk(Bv, x, y, z, h, [0.25, 0.32, 0.12]); Bv.add(KON(), M(x, y + h * 0.65, z, 0.025, h * 0.35, 0.025), [0.56, 0.3, 0.46], { vaj: () => 0.05 }); };
    const ang = (n, test, fn) => { for (let f = 0, k = 0; f < n * 30 && k < n; f++) { const a = r() * 6.283, d = 6 + Math.sqrt(r()) * 30, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!test(x, z)) continue; fn(x, hy(x, z), z); k++; } };
    const land = (x, z, qmin, qmax) => { const q = kustQ(x, z); return q > qmin && q < qmax && hy(x, z) > VY + 0.2 && !mal.blockerad(x, z, 0.6) && kant(x, z) > 1.5 && ledig(x, z, 0.3) && stigAv(x, z) > 0.55 && stketAv(x, z) > 1 && rektAv(x, z) > 0.8; };
    // lupiner i täta bestånd längs strandkanten (där gräset möter gruset), avlånga längs stranden; varje bestånd
    // har en eller två färger, som när de sprider sig själva. Aldrig framför huset eller vid bryggan och boden.
    yield;
    { const tx = -KUST[1], tz = KUST[0];
      for (let g = 0, n = 0; g < 600 && n < (SVAG ? 4 : 7); g++) {   // (team-mark: färre men tätare bestånd)
        const gr = -230 + r() * 200, a = gr * Math.PI / 180; let cx = null, cz = null;
        for (let d = 7; d < 50; d += 0.25) { const xx = Math.cos(a) * d, zz = Math.sin(a) * d; if (kustQ(xx, zz) > 8.9) { cx = xx; cz = zz; break; } }
        if (cx === null || !land(cx, cz, -40, 9.6) || framfor(cx, cz) || !krav(cx, cz, 'lag') || !ledig(cx, cz, 1.8)) continue;
        const fk = r() < 0.45 ? [0, 1] : r() < 0.5 ? [0, 2, 4] : [1, 3, 2];
        for (let i = 0, m = 0; i < 120 && m < (SVAG ? 18 : 32); i++) {
          const u = (r() - 0.5) * 4.6, w = (r() - 0.5) * 1.5 * (1 - Math.abs(u) / 2.7), x = cx + tx * u - KUST[0] * w, z = cz + tz * u - KUST[1] * w;
          if (!land(x, z, -40, 10.0) || framfor(x, z)) continue;
          lupin(x, hy(x, z) - 0.03, z, fk); m++;
        }
        ta(cx, cz, 2.4); n++;
      }
      // och några bestånd på landsidan, i brynet mot skogen och längs tomtens kanter (som i dikesrenar)
      for (let g = 0, n = 0; g < 400 && n < (SVAG ? 2 : 3); g++) {
        const a = r() * 6.283, d = 15 + r() * 17, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
        if (!land(cx, cz, -40, 4) || framfor(cx, cz) || kant(cx, cz) < 13 || !krav(cx, cz, 'lag') || !ledig(cx, cz, 2.2)) continue;   // bara i tomtens ytterkant
        const fk = r() < 0.5 ? [0, 1, 4] : [1, 2, 3], v = r() * 6.283, ux = Math.cos(v), uz = Math.sin(v);
        for (let i = 0, m = 0; i < 160 && m < (SVAG ? 28 : 48); i++) {   // (team-mark: stora täta bestånd, inte små prickgrupper)
          const u = (r() - 0.5) * 6.5, w = (r() - 0.5) * 2.4 * (1 - Math.abs(u) / 3.6), x = cx + ux * u - uz * w, z = cz + uz * u + ux * w;
          if (!land(x, z, -40, 6) || framfor(x, z)) continue;
          lupin(x, hy(x, z) - 0.03, z, fk); m++;
        }
        ta(cx, cz, 2.2); n++;
      }
    }
    // ängsblommor (team-mark): i naturliga kluster, med blad vid basen; varje art har sin höjd, form och färg
    // basblad: smala, böjda blad i en liten rosett (två trianglar var)
    const basblad = (x, y, z, n, l, c) => { for (let i = 0; i < n; i++) Bv.add(PLAN(), M(x, y, z, 0.025 + r() * 0.015, l * (0.6 + r() * 0.5), 1, r() * 6.28, 0.5 + r() * 0.5, 0), (lx, ly) => skala(c, 0.6 + 0.5 * ly), { vaj: (lx, ly) => ly * 0.01 }); };
    const KRONA = () => bas('krona12', () => new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2));
    // prästkrage: vit krona med tolv strålblommor (taggig kant), gul, upphöjd mitt
    const prastkrage = (x, y, z) => {
      const h = 0.45 + r() * 0.3; basblad(x, y, z, 3, 0.14, [0.2, 0.32, 0.11]);
      stjalk(Bv, x, y, z, h, [0.26, 0.36, 0.13]);
      const s = 0.034 + r() * 0.012, rx = (r() - 0.5) * 0.6, rz = (r() - 0.5) * 0.6, ry = r() * 6.28;
      Bv.add(KRONA(), M(x, y + h, z, s, 1, s, ry, rx, rz), (lx, ly, lz) => { const a = Math.atan2(lz, lx), d = Math.hypot(lx, lz); return d > 0.5 ? skala([0.97, 0.97, 0.94], 0.85 + 0.15 * Math.cos(a * 12)) : [0.95, 0.95, 0.92]; }, { vaj: () => h * h * 0.06 });
      Bv.add(knol('pk', 11, 0.2, 5, 3), M(x, y + h + 0.004, z, s * 0.32, s * 0.16, s * 0.32, 0, rx, rz), [0.95, 0.7, 0.08], { vaj: () => h * h * 0.06 });
    };
    // blåklocka: tunn, lätt böjd stjälk med 1–3 nickande klockor
    const blaklocka = (x, y, z) => {
      const h = 0.3 + r() * 0.22; basblad(x, y, z, 2, 0.08, [0.22, 0.34, 0.13]);
      stjalk(Bv, x, y, z, h, [0.3, 0.4, 0.16]);
      for (let k = 0, n = 1 + (r() * 2.4 | 0); k < n; k++) {
        const v = r() * 6.28, o = k ? 0.03 + r() * 0.03 : 0.01, yy = y + h - k * 0.05 - 0.035, c = vari([0.34, 0.38, 0.86], r, 0.1);
        Bv.add(KON(), M(x + Math.cos(v) * o, yy, z + Math.sin(v) * o, 0.016, 0.03, 0.016, v, 0.35, 0), (lx, ly) => skala(c, 0.65 + 0.45 * (1 - ly)), { vaj: () => h * h * 0.07 });
      }
    };
    // smörblomma: grenig stjälk, 2–4 små blankt gula koppar
    const smorblomma = (x, y, z) => {
      const h = 0.4 + r() * 0.3; basblad(x, y, z, 3, 0.1, [0.22, 0.34, 0.12]);
      stjalk(Bv, x, y, z, h, [0.28, 0.38, 0.14]);
      for (let k = 0, n = 2 + (r() * 2.5 | 0); k < n; k++) {
        const v = r() * 6.28, o = k ? 0.04 + r() * 0.06 : 0, hh = h - (k ? 0.04 + r() * 0.12 : 0), px = x + Math.cos(v) * o, pz = z + Math.sin(v) * o;
        if (k) Bv.add(PLAN(), M((x + px) / 2, y + hh * 0.55, (z + pz) / 2, 0.008, hh * 0.5, 1, v, Math.cos(v) * 0.3, Math.sin(v) * 0.3), [0.28, 0.38, 0.14], { vaj: () => hh * hh * 0.05 });
        Bv.add(KON(), M(px, y + hh, pz, 0.014, -0.012, 0.014, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), vari([1.0, 0.82, 0.06], r, 0.06), { vaj: () => hh * hh * 0.06 });
      }
    };
    // rödklöver: låg, med trebladiga blad (ljus fläck i mitten) och ett rundat, rosalila huvud
    const rodklover = (x, y, z) => {
      const h = 0.13 + r() * 0.15;
      for (let i = 0; i < 3; i++) { const v = i * 2.09 + r(), px = x + Math.cos(v) * 0.04, pz = z + Math.sin(v) * 0.04; Bv.add(SKIVA(), M(px, y + 0.06 + r() * 0.04, pz, 0.022, 1, 0.013, v, (r() - 0.5) * 0.4, 0), (lx, ly, lz) => Math.hypot(lx, lz) < 0.45 ? [0.38, 0.46, 0.26] : [0.2, 0.33, 0.12], { vaj: () => 0.005 }); }
      stjalk(Bv, x, y, z, h, [0.3, 0.38, 0.16]);
      const kc = vari([0.78, 0.3, 0.5], r, 0.08);
      Bv.add(knol('klover', 5, 0.35, 5, 3), M(x, y + h + 0.012, z, 0.018, 0.022, 0.018, r() * 6.28), (lx, ly) => skala(kc, 0.75 + 0.35 * ly), { vaj: () => h * h * 0.05 });
    };
    // midsommarblomster (skogsnäva): yvig, flikiga blad och flera blåvioletta femtaliga blommor
    const midsommar = (x, y, z) => {
      const h = 0.32 + r() * 0.22, mc = vari([0.5, 0.32, 0.78], r, 0.05);
      for (let i = 0; i < 3; i++) Bv.add(LBLAD(), M(x + (r() - 0.5) * 0.08, y + 0.1 + r() * h * 0.5, z + (r() - 0.5) * 0.08, 0.07, 0.07, 0.07, r() * 6.28, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4), [0.26, 0.44, 0.14], { vaj: () => 0.012 });
      for (let k = 0, n = 2 + (r() * 3 | 0); k < n; k++) {
        const v = r() * 6.28, o = 0.03 + r() * 0.08, hh = h * (0.8 + r() * 0.25), px = x + Math.cos(v) * o, pz = z + Math.sin(v) * o;
        Bv.add(PLAN(), M((x + px) / 2, y, (z + pz) / 2, 0.008, hh, 1, v, Math.sin(v) * 0.2, Math.cos(v) * 0.2), [0.28, 0.36, 0.14], { vaj: (lx, ly) => ly * ly * 0.05 });
        Bv.add(bas('femkrona', () => new THREE.CircleGeometry(1, 5).rotateX(-Math.PI / 2)), M(px, y + hh, pz, 0.019, 1, 0.019, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), (lx, ly, lz) => Math.hypot(lx, lz) < 0.3 ? [0.9, 0.85, 0.92] : mc, { vaj: () => hh * hh * 0.06 });
      }
    };
    // hundkex: hög, luftig vit flockblomma i brynen (juni)
    const hundkex = (x, y, z) => {
      const h = 0.7 + r() * 0.4; basblad(x, y, z, 4, 0.25, [0.2, 0.32, 0.11]);
      stjalk(Bv, x, y, z, h, [0.3, 0.38, 0.17]);
      for (let k = 0; k < 6; k++) { const v = k * 1.05 + r() * 0.4, o = 0.04 + r() * 0.03; Bv.add(SKIVA(), M(x + Math.cos(v) * o, y + h - 0.01 + r() * 0.02, z + Math.sin(v) * o, 0.022, 1, 0.022, r() * 6.28), vari([0.93, 0.93, 0.88], r, 0.04), { vaj: () => h * h * 0.07 }); }
    };
    // klusterspridning: klungor med tätast i mitten och enstaka utlöpare
    const KM = SVAG ? 0.55 : 1;
    // (bestånden samlas i ängens kanter: mot stranden, i tomtens ytterkant och längs stigarna; ängen däremellan är gräs)
    const kantLage = (x, z) => kustQ(x, z) > 5.5 || kant(x, z) > 13 || stigAv(x, z) < 1.8;
    const kluster = (antal, per, rad, test, fn, ctr = kantLage) => {
      for (let f = 0, k = 0; f < antal * 60 && k < antal * KM; f++) {
        const a = r() * 6.283, d = 5 + Math.sqrt(r()) * 31, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
        if (!test(cx, cz) || !ctr(cx, cz)) continue; k++;
        for (let i = 0, n = per[0] + (r() * (per[1] - per[0] + 1) | 0); i < n; i++) {
          const v = r() * 6.283, dd = Math.pow(r(), 0.75) * rad * (i % 7 === 6 ? 2.2 : 1), x = cx + Math.cos(v) * dd, z = cz + Math.sin(v) * dd;
          if (test(x, z)) fn(x, hy(x, z) - 0.01, z);
        }
      }
    };
    // färre, tätare bestånd (kluster i kanterna) och bara enstaka ängsblommor ute i gräset
    yield;
    kluster(13, [30, 50], 1.5, (x, z) => land(x, z, -40, 9.4), prastkrage);
    yield;
    kluster(11, [22, 36], 1.3, (x, z) => land(x, z, -40, 9.8), smorblomma);
    yield;
    kluster(9, [14, 24], 0.9, (x, z) => land(x, z, -40, 9.6), blaklocka);
    yield;
    kluster(9, [16, 28], 1.0, (x, z) => land(x, z, -40, 8.5), rodklover);
    yield;
    kluster(7, [10, 18], 1.0, (x, z) => land(x, z, -40, 7) && kant(x, z) > 4, midsommar);
    yield;
    kluster(6, [6, 12], 1.1, (x, z) => land(x, z, -40, 5) && !framfor(x, z) && kant(x, z) > 7, hundkex);
    yield;
    ang(SVAG ? 15 : 30, (x, z) => land(x, z, -40, 9), (x, y, z) => (r() < 0.5 ? prastkrage : r() < 0.5 ? smorblomma : rodklover)(x, y, z));   // enstaka ute i ängen
    // älggräs och fackelblomster i några täta fuktiga bestånd vid strandkanten (förr jämnt utspridda pinnar på sanden)
    yield;
    kluster(5, [7, 12], 0.8, (x, z) => land(x, z, 6, 9.6) && !framfor(x, z), alggras);
    yield;
    kluster(4, [6, 10], 0.7, (x, z) => land(x, z, 6, 9.6) && !framfor(x, z), fackla);
    // strandfynd på sanden (team-mark): småsten i några storlekar, vita snäckskal, tångruskor längs tånglinjen och torra
    // strån; slumpat över hela stranden så att inget mönster upprepas
    yield;
    { const pa = (x, z, ymin, ymax) => { const q = kustQ(x, z), y = hy(x, z); return q > 9.8 && q < 24 && y > VY + ymin && y < VY + ymax && !mal.blockerad(x, z, 0.4) && ledig(x, z, 0.2) && kant(x, z) > 2; };
      const sprid2 = (n, ymin, ymax, fn) => { for (let f = 0, k = 0; f < n * 20 && k < n * KM; f++) { const a = (-235 + r() * 210) * Math.PI / 180, d = 8 + r() * 36, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!pa(x, z, ymin, ymax)) continue; fn(x, hy(x, z), z); k++; } };
      sprid2(260, 0.0, 1.2, (x, y, z) => { const s = 0.025 + Math.pow(r(), 3) * 0.12, c = vari(r() < 0.5 ? [0.46, 0.44, 0.42] : r() < 0.5 ? [0.55, 0.48, 0.44] : [0.32, 0.31, 0.3], r, 0.1); Bt.add(knol('sm' + (r() * 3 | 0), 31, 0.35, 6, 4), M(x, y + s * 0.15, z, s * (1 + r() * 0.5), s * (0.5 + r() * 0.3), s, r() * 6.28), (lx, ly, lz, nx, ny) => skala(c, 0.6 + 0.4 * (0.5 + 0.5 * ny))); });   // småsten
      sprid2(60, 0.1, 0.9, (x, y, z) => { const s = 0.012 + r() * 0.012; Bt.add(SKIVA(), M(x, y + 0.008, z, s, 1, s * 0.8, r() * 6.28, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6), vari([0.92, 0.88, 0.82], r, 0.06)); });   // snäckskal (blåmussla ibland mörk)
      sprid2(45, 0.22, 0.45, (x, y, z) => { for (let i = 0; i < 5; i++) { const v = r() * 6.28, l = 0.12 + r() * 0.2; Bt.add(PLAN(), M(x + (r() - 0.5) * 0.25, y + 0.01, z + (r() - 0.5) * 0.25, 0.04 + r() * 0.03, l, 1, v, -Math.PI / 2 + 0.05, 0), vari([0.2, 0.16, 0.08], r, 0.15)); } });   // tångruskor (blåstång, platt på sanden)
      sprid2(120, 0.3, 1.3, (x, y, z) => { const v = r() * 6.28, l = 0.15 + r() * 0.25; Bv.add(PLAN(), M(x, y + 0.01, z, 0.008, l, 1, v, -Math.PI / 2 + 0.08 + r() * 0.2, 0), vari([0.72, 0.64, 0.45], r, 0.1)); });   // torra strån
      // småsten i klungor (som vågorna samlat dem), fjädrar, torra vasstrån i drivor längs tånglinjen och flata stenar att gå på
      sprid2(18, 0.05, 0.6, (x, y, z) => { for (let i = 0, n = 6 + (r() * 10 | 0); i < n; i++) { const v = r() * 6.28, d = Math.sqrt(r()) * 0.45, px = x + Math.cos(v) * d, pz = z + Math.sin(v) * d, s = 0.02 + Math.pow(r(), 2) * 0.07, c = vari(r() < 0.6 ? [0.48, 0.46, 0.43] : [0.58, 0.5, 0.46], r, 0.12); Bt.add(knol('sm' + (r() * 3 | 0), 31, 0.35, 6, 4), M(px, hy(px, pz) + s * 0.1, pz, s * (1 + r() * 0.5), s * 0.55, s, r() * 6.28), (lx, ly, lz, nx, ny) => skala(c, 0.6 + 0.4 * (0.5 + 0.5 * ny))); } });
      sprid2(14, 0.2, 1.2, (x, y, z) => { const v = r() * 6.28, l = 0.09 + r() * 0.06; Bt.add(PLAN(), M(x, y + 0.012, z, 0.025, l, 1, v, -Math.PI / 2 + 0.15, 0.1), r() < 0.7 ? [0.92, 0.92, 0.9] : [0.45, 0.43, 0.42]); Bt.add(PLAN(), M(x, y + 0.014, z, 0.003, l * 1.1, 1, v, -Math.PI / 2 + 0.15, 0.1), [0.85, 0.83, 0.78]); });   // fjädrar (mås, kråka) med spole
      sprid2(22, 0.25, 0.5, (x, y, z) => { for (let i = 0; i < 9; i++) { const v = r() * 0.8 + (r() < 0.5 ? 0 : 3.14), l = 0.3 + r() * 0.5; Bv.add(PLAN(), M(x + (r() - 0.5) * 0.4, y + 0.015, z + (r() - 0.5) * 0.4, 0.012, l, 1, v, -Math.PI / 2 + 0.04, 0), vari([0.7, 0.62, 0.45], r, 0.1)); } });   // vasstrån i drivor
      // (sjö-ph) en skannad drivvedsstock (Poly Haven dead_tree_trunk_02, 2,2 m) uppspolad på sanden parallellt med
      // strandlinjen; söker en fri plats utan slumptal (resten av stranden behåller sin slumpföljd)
      if (phPa) for (let g = -62; g > -232; g -= 6) {
        const a = g * Math.PI / 180, d0 = strandD(g); if (!d0) continue;
        const x = Math.cos(a) * (d0 - 1.5), z = Math.sin(a) * (d0 - 1.5), tx = -Math.sin(a), tz = Math.cos(a), L2 = 1.2;
        if (framfor(x, z) || rektAv(x, z) < 2 || ![-1, 0, 1].every(t => pa(x + tx * L2 * t, z + tz * L2 * t, 0.1, 1.1))) continue;
        const y = Math.min(hy(x - tx * L2, z - tz * L2), hy(x, z), hy(x + tx * L2, z + tz * L2)) - 0.07;
        PHT.push({ m: 'dead_tree_trunk_02', x, y, z, ry: Math.atan2(-tz, tx) + 0.25, s: 0.55 });
        ta(x, z, 1.4);
        console.info('miljö: drivved vid', x.toFixed(1), z.toFixed(1));
        break;
      }
      // drivved: grenar med silvergrå, längsgående sprickor och en bit kvarsittande mörk bark i ena änden, en grenstump
      sprid2(4, 0.25, 0.9, (x, y, z) => { const v = r() * 6.28, l = 0.8 + r() * 0.9, rb = 0.04 + r() * 0.04, a = [x - Math.cos(v) * l / 2, y + rb * 0.6, z - Math.sin(v) * l / 2], b2 = [x + Math.cos(v) * l / 2, y + rb * 0.5, z + Math.sin(v) * l / 2];
        Bt.add(CYL(), MAB(a, b2, rb, rb * 0.8), (lx, ly, lz) => { const spr = Math.abs(Math.sin(Math.atan2(lz, lx) * 7 + ly * 3)) < 0.15 ? 0.6 : 1, bark = ly < 0.22 ? [0.3, 0.25, 0.2] : [0.62, 0.6, 0.56]; return skala(bark, spr * (0.85 + 0.15 * Math.sin(ly * 40))); });
        const m = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (a[2] + b2[2]) / 2]; Bt.add(CYL(), MAB(m, [m[0] + Math.cos(v + 1.2) * 0.25, m[1] + 0.06, m[2] + Math.sin(v + 1.2) * 0.25], rb * 0.4, rb * 0.25), [0.58, 0.56, 0.52]); });
      sprid2(5, 0.3, 1.0, (x, y, z) => { const s = 0.28 + r() * 0.15, fc = vari([0.5, 0.48, 0.45], r, 0.06); Bt.add(knol('flat' + (r() * 2 | 0), 47, 0.2, 8, 4), M(x, y - s * 0.05, z, s * (1 + r() * 0.3), s * 0.12, s, r() * 6.28), (lx, ly, lz, nx, ny) => skala(fc, 0.65 + 0.35 * (0.5 + 0.5 * ny))); });   // flata stenar
    }
    // vass i det grunda längs stranden (inte vid bryggan eller boden)
    // täta, avlånga vassbälten längs strandlinjen (som en bård i det grunda), några mindre ruggar emellan
    yield;
    for (let f = 0, n = 0; f < 500 && n < 8; f++) {
      const g = -220 + r() * 190, d = strandD(g); if (!d) continue;
      const a = g * Math.PI / 180, dd = d + 1.5 + r() * 3.5, x = Math.cos(a) * dd, z = Math.sin(a) * dd, dj = VY - ytaH(x, z), stor = n < 5;
      if (dj < 0.08 || dj > 0.8 || kustQ(x, z) < 10 || !ledig(x, z, stor ? 3.2 : 2) || rektAv(x, z) < (stor ? 2.5 : 1.5) + 0.8) continue;   // (team-mark: aldrig genom bryggor/boden)   // (kustQ: aldrig i en svacka uppe på land)
      const rad = stor ? 1.5 + r() * 0.7 : 0.8 + r() * 0.5, el = stor ? 2.2 + r() * 1.0 : 1.2;
      vass(Bv, r, x, z, stor ? 190 + (r() * 80 | 0) : 60 + (r() * 25 | 0), rad, 1.3, 2.3, el, a + Math.PI / 2); ta(x, z, rad * (stor ? 1.6 : 1.1)); n++;
    }
    // näckrosbestånd i lugnt vatten (0,5–2 m djupt), utanför vassen och borta från bryggan
    yield;
    for (let f = 0, n = 0; f < 400 && n < 3; f++) {
      const g = -220 + r() * 190, d = strandD(g); if (!d) continue;
      const a = g * Math.PI / 180, dd = d + 5 + r() * 9, x = Math.cos(a) * dd, z = Math.sin(a) * dd, dj = VY - ytaH(x, z);
      if (dj < 0.5 || dj > 2.0 || kustQ(x, z) < 10 || !ledig(x, z, 3.5)) continue;
      nackros(Bt, r, x, z, 45 + (r() * 30 | 0), 2.4 + r() * 1.2); ta(x, z, 3); n++;
    }
    // mossiga block i skogsbrynet och blåbärsris runt dem
    // (team-mark: färre, mindre och djupt nedsjunkna grå block med lav; inga gröna tuvklumpar runt dem – de såg ut som utlagda plattor)
    yield;
    for (let f = 0, n = 0; f < 300 && n < 0; f++) {   // (team-mark: inga ensamma block på öppna gräsmattan)
      const a = r() * 6.283, d = 18 + r() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!land(x, z, -40, 6) || !krav(x, z, 'lag') || framfor(x, z) || kant(x, z) < 12) continue;
      const s = 0.35 + r() * 0.4; block(Bg, r, x, hy(x, z), z, s, false, 0.55); ta(x, z, s + 0.5);
      n++;
    }
    // ljung och kråkris på den torra kanten mot hällarna, blåbärsris i fläckar mot skogen (team-mark)
    const ris = (antal, per, rad, test, typ, smin, smax, ctr) => kluster(antal, per, rad, test, (x, y, z) => tuva(Bv, r, typ(), x, y + 0.01, z, smin + r() * (smax - smin)), ctr);
    // (ljungen på strandkanten togs bort: knölarna blev lila bollar på sanden)
    // (team-mark: blåbärsriset av knölar blev platta mörkgröna klumpar på ängen – avstängt)
    if (false) ris(12, [5, 9], 1.3, (x, z) => land(x, z, -40, 3) && kant(x, z) > 9, () => (r() < 0.8 ? 'blabar' : 'mossa'), 0.2, 0.34, (x, z) => kant(x, z) > 13);
    // låga buskar i ängens kanter: nypon (rosa blommor, några nypon), en (smal och mörk) och sälg (grågröna, rundade blad)
    const nypon = (x, y, z) => {
      // låg, utbredd och oregelbunden (flera små, platta sjok i en avlång fläck), ljust gräsgrön – inte en rund mörk klump
      const h = 0.45 + r() * 0.35, c = vari([0.25, 0.35, 0.15], r, 0.1), la = r() * 6.28;
      for (let k = 0; k < 8; k++) {
        const u = (r() - 0.5) * h * 2.6, w2 = (r() - 0.5) * h * 1.1, px = x + Math.cos(la) * u - Math.sin(la) * w2, pz = z + Math.sin(la) * u + Math.cos(la) * w2, s = h * (0.28 + r() * 0.2), py = y + h * (0.15 + r() * 0.45) * (1 - Math.abs(u) / (h * 2));
        Bv.add(knol('nyp' + (k % 3), k * 2.1 + 3, 0.7, 7, 5), M(px, py, pz, s * (1 + r() * 0.5), s * 0.55, s, r() * 6.28, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4), (lx, ly, lz, nx, ny) => skala(c, 0.72 + 0.35 * (0.5 + 0.5 * ny)), { vaj: (lx, ly, lz, wy) => 0.02 * Math.max(0, wy - y), anim: BARR });
        for (let b = 0; b < 4; b++) {
          const w = r() * 6.28, e = r() * 1.2, bx = px + Math.cos(w) * Math.cos(e) * s * 0.95, bz = pz + Math.sin(w) * Math.cos(e) * s * 0.95, by = py + Math.sin(e) * s * 0.75;
          if (r() < 0.75) Bv.add(SKIVA(), M(bx, by, bz, 0.026, 1, 0.026, r() * 6.28, (r() - 0.5) * 1.2, (r() - 0.5) * 1.2), (lx, ly, lz) => Math.hypot(lx, lz) < 0.3 ? [0.95, 0.8, 0.3] : [0.95, 0.62, 0.72], { vaj: () => 0.02 * (by - y) });
          else Bv.add(knol('hip', 4, 0.1, 5, 3), M(bx, by, bz, 0.012, 0.016, 0.012), [0.7, 0.1, 0.06], { vaj: () => 0.02 * (by - y) });
        }
      }
    };
    const pelaren = (x, y, z) => {
      // (blågrön, ljusare i toppen och på solsidan; sjoken är små och många så att siluetten blir luddig, inte en klump)
      const h = 0.9 + r() * 0.8, c = vari([0.2, 0.3, 0.24], r, 0.1);
      for (let k = 0; k < 9; k++) { const t = k / 9, w = h * 0.17 * (1 - t * 0.55), v = r() * 6.28, o = w * 0.35; Bv.add(knol('pen' + (k % 3), k * 3.3 + 1, 0.6, 6, 4), M(x + Math.cos(v) * o, y + h * (0.1 + t * 0.85), z + Math.sin(v) * o, w, h * 0.14, w * (0.8 + r() * 0.3), r() * 6.28), (lx, ly, lz, nx, ny) => skala(c, (0.7 + 0.5 * (0.5 + 0.5 * nx)) * (0.85 + 0.3 * t)), { vaj: (lx, ly, lz, wy) => 0.015 * Math.max(0, wy - y), anim: BARR }); }
    };
    const salg = (x, y, z) => {
      const h = 0.9 + r() * 0.5, c = vari([0.34, 0.4, 0.28], r, 0.08);
      for (let k = 0; k < 4; k++) { const v = r() * 6.28, l = h * (0.6 + r() * 0.3); Bv.add(CYL(), MAB([x, y - 0.05, z], [x + Math.cos(v) * l * 0.3, y + l, z + Math.sin(v) * l * 0.3], 0.02), [0.4, 0.36, 0.3]); }
      for (let k = 0; k < 7; k++) { const v = r() * 6.28, d = h * (0.1 + r() * 0.3), s = h * (0.22 + r() * 0.12); Bv.add(knol('salg' + (k % 3), k * 1.7 + 9, 0.5, 7, 5), M(x + Math.cos(v) * d, y + h * (0.5 + r() * 0.4), z + Math.sin(v) * d, s, s * 0.85, s, r() * 6.28), (lx, ly, lz, nx, ny) => skala(c, 0.55 + 0.5 * (0.5 + 0.5 * ny)), { vaj: (lx, ly, lz, wy) => 0.025 * Math.max(0, wy - y), anim: BARR }); }
    };
    // (pelarenarna togs bort: smala mörka pelare såg ut som cypresser; buskarna står bara i ängens ytterkanter)
    yield;
    for (let f = 0, n = 0; f < 500 && n < (SVAG ? 4 : 7); f++) {
      const a = r() * 6.283, d = 16 + r() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!land(x, z, -40, 9.5) || framfor(x, z) || !krav(x, z, 'lag') || kant(x, z) < 9 || !ledig(x, z, 1.4)) continue;
      if (false) nypon(x, hy(x, z), z); ta(x, z, 1.2); n++;   // (team-mark: avstängt – de platta bladklumparna lästes som utlagda gröna plattor)   // (sälgen togs bort: klot på pinne)
    }
    // trollsländor vid vassen
    yield;
    { const Bf = Bt; for (let i = 0; i < 3; i++) { const g = -200 + i * 40, d = strandD(g); if (!d) continue; const a = g * Math.PI / 180, x = Math.cos(a) * (d + 0.5), z = Math.sin(a) * (d + 0.5), an = [x, z, r() * 6.28, 3];
      Bf.add(LADA(), M(0, VY + 0.7, 0, 0.012, 0.012, 0.07), [0.1, 0.35, 0.55], { anim: an });
      for (const s of [-1, 1]) Bf.add(LADA(), M(s * 0.04, VY + 0.71, 0.01, 0.07, 0.002, 0.016), [0.75, 0.8, 0.85], { anim: an }); } }
    yield;
    lagHinder(hind);
    const ut = [nat(Bt, tingMat(), 'sjo-ting', { kast: true, fast: false }), nat(Bv, vaxtMat(), 'sjo-vaxter', { fast: false })].filter(Boolean);
    if (PHT.length) ut.push(ph.grupp(PHT, 'ph-sjo-ting', { lager: LAGER }));
    if (LUPP.length) { const m = blommor.grupp(LUPP, 'blommor-lupiner'); if (m) ut.push(m); }
    try { if (/[?&]prov=1/.test(location.search)) window.__lup = LUPP.filter((p, i) => i % 20 === 0).map(p => [p.x, p.y, p.z]); } catch (e) { /* */ }   // Poly Haven-rekvisitan (husritare-ph.js), fylls när filerna laddats
    // (team-mark) stigAv används av gräsfältet för att hålla tuvor borta: även bastun och bryggorna/boden (0,8 m fritt; fältet utesluter < 0,32)
    return { nat: ut, eld, bod, stigar, stigAv: (x, z) => Math.min(stigAv(x, z), bastuP ? Math.max(0, Math.hypot(x - bastuP[0], z - bastuP[1]) - 2.3) : 99, rektAv(x, z) - 0.5), bjorkar, buskar };
  }

  return { vattenMat, vattenKrok, forvarm, forberedG, fjarrG, naraG, spegla, holmH, kobbH, ytaH, lagHinder, fjarr, tallar, nara, OAR, KOBBAR, brus, SVAG, LAGER, dispose() { if (rt.t) rt.t.dispose(); [BRUS, VAG, DJUP].forEach(t => t && t.dispose()); BRUS = VAG = DJUP = null; for (const k in JOBB) delete JOBB[k]; } };
}
