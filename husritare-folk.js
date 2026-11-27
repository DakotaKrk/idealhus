// husritare-folk.js – riktiga, animerade människor i husritarens miljöer (villaområdet och vid sjön).
//
// Modeller:
//  - images/3d/folk-paket.bin: lågpolypersoner (1 500–2 500 trianglar, gemensamt biped-skelett) och animationer ur
//    "City People Free Samples" av Denys Almaral (Fab Standard License). Licensen tillåter inte att filerna sprids
//    fristående, så de är ihopslagna, gzippade och maskerade utan originalnamn (som vaxt-paket.bin). Byggs om med
//    _verktyg/folk/bygg.mjs. Klädfärgerna varieras med paletterna i paketet (samma nät, olika palett).
//  - images/3d/folk-man.glb: "The Sound Guy" av Tony Flanagan (CC BY 4.0), förenklad till 15k trianglar.
//
// Användning (husritare-miljo.js):
//   const FOLK = skapaFolk(THREE, { VU, LJUS });
//   N.extra.push(FOLK.grupp(poster, hy));     // tom grupp som fylls när modellerna laddats (lat, efter att huset visats)
//
// Poster (världens koordinater):
//   { t: 'ga',   bana: [[x, z], …], slinga, klipp: 'ga'|'lugn'|'jogg'|'telga', typ, pal, s, dy }   går längs en rutt (fram och tillbaka)
//   { t: 'hund', p0: [x, y, z], d: [dx, 0, dz], L, sp, fas, typ, pal }   går i takt med hunden i omgivningens skuggare (typ 3)
//   { t: 'sta',  p: [x, z] | [x, y, z], dir: [dx, dz], klipp: 'tel'|'vinka'|'varm'|'sta', typ, pal, s }
//   typ: 0 kvinna, 1 kvinna (rött hår), 2 man, 3 man med glasögon, 4 äldre kvinna, 5 pojke, 6 flicka, 'man' realistisk man
//   prio 2 = bara på dator (mobil får färre)
//
// Prestanda: inga skuggor (en mjuk fläck under fötterna), mixern uppdateras bara för synliga personer; de ~12 närmaste
// varje bildruta, längre bort var tredje, bortom 90 m står de still och bortom 170 m ritas de inte.
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { clone as klona } from './vendor/three/addons/utils/SkeletonUtils.js';

const URL_PAKET = 'images/3d/folk-paket.bin?v=1', URL_MAN = 'images/3d/folk-man.glb?v=1';
const AV = (() => { try { return new URLSearchParams(location.search).get('folk') === '0'; } catch (e) { return false; } })();   // ?folk=0 stänger av
const MOBIL = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 760; } catch (e) { return false; } })();
const MAX_NARA = MOBIL ? 6 : 12;
const TICK = {};   // tickrarnas delade osynliga nät (geometri och material)
const KVINNA = new Set([0, 1, 4, 6]);

export function skapaFolk(THREE, { VU, LJUS }) {
  const P = { typer: null, klipp: null, pal: null, man: null, vant: [], laddar: false };

  // ---- avkodning ----
  async function hamta() {
    const u8 = new Uint8Array(await (await fetch(URL_PAKET)).arrayBuffer());
    let s = 0x7f4a7c15 ^ u8.length;
    for (let i = 0; i < u8.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; u8[i] ^= s & 255; }
    const raw = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const len = new DataView(raw).getUint32(0, true);
    const H = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 4, len)));
    const bas = 4 + len + ((4 - ((4 + len) % 4)) % 4), bit = ([o, l]) => raw.slice(bas + o, bas + o + l);
    const L = new GLTFLoader();
    const typer = await Promise.all(H.k.map(async k => (await L.parseAsync(bit(k), '')).scene));
    const klipp = {};
    for (const a of H.a) {
      const g = await L.parseAsync(bit(a), ''), b = g.scene.getObjectByName('bip');
      klipp[a[2]] = { clip: g.animations[0], vila: b ? b.position.clone() : null };
    }
    const pal = await Promise.all(H.p.map(async p => {
      const t = new THREE.Texture(await createImageBitmap(new Blob([bit(p)], { type: 'image/webp' }), { imageOrientation: 'none' }));
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
    }));
    let man = null;
    if (!MOBIL) try { man = await L.loadAsync(URL_MAN); } catch (e) { console.warn('folk-man.glb', e); }   // (mobil: lågpolymannen i stället)
    return { typer, klipp, pal, man };
  }
  function ladda(cb) {
    if (P.typer) { cb(P); return; }
    P.vant.push(cb);
    if (P.laddar) return;
    P.laddar = true;
    const start = () => hamta().then(r => { Object.assign(P, r); forbered(); P.vant.splice(0).forEach(f => f(P)); })
      .catch(e => { console.warn('folk-paket', e); P.laddar = false; });
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 3000 }) : start()), 2000);
  }

  // ---- material: palett som karta, miljöns omgivningsljus ----
  const MAT = {};
  function lambert(nyckel, o) {
    if (MAT[nyckel]) return MAT[nyckel];
    const a = new THREE.MeshLambertMaterial(o);
    a.onBeforeCompile = s => { s.uniforms.miljoLjus = LJUS; s.fragmentShader = 'uniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;'); };
    a.customProgramCacheKey = () => 'miljo-folk' + (o.alphaTest ? '-a' : '');
    return (MAT[nyckel] = a);
  }
  // mjuk kontaktskugga under fötterna (ingen riktig skugga)
  let FLACK = null;
  const flack = () => FLACK || (FLACK = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { geo: new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
  })());

  // ---- förberedelse: material, klipp anpassade till varje persons skelett, steglängd och framåtriktning ----
  const BEN = { L: 'bip_L_Foot', R: 'bip_R_Foot', H: 'bip_Pelvis' };
  const MALL = {};            // typ -> { scen, skala, vrid, klipp: {kod: clip}, fart: {kod: m/s vid timeScale 1} }
  function forbered() {
    P.typer.forEach((sc, i) => {
      sc.traverse(o => { if (o.isMesh) { o.material = lambert('pal0', { map: P.pal[0] }); o.castShadow = false; o.receiveShadow = true; } });
      sc.updateMatrixWorld(true);
      const b = sc.getObjectByName('bip'), hojd = new THREE.Box3().setFromObject(sc).getSize(new THREE.Vector3()).y;
      MALL[i] = { scen: sc, skala: hojd > 20 ? 0.01 : 1, vila: b.position.clone(), klipp: {}, fart: {}, vrid: null, benL: BEN.L, benR: BEN.R, hoft: BEN.H };
    });
    if (P.man) {
      const sc = P.man.scene, ben = [];
      sc.traverse(o => {
        if (o.isBone && /foot/i.test(o.name) && !/toe|end/i.test(o.name)) ben.push(o.name);
        if (!o.isMesh) return;
        const m = o.material;
        o.material = lambert('man-' + m.name, { map: m.map, alphaTest: m.alphaTest || 0, side: m.side });
        o.castShadow = false; o.receiveShadow = true;
      });
      let hoft = null; sc.traverse(o => { if (!hoft && o.isBone && /hip|pelvis/i.test(o.name)) hoft = o.name; });
      const L = ben.find(n => /left|_l\b|\bl_|\.l\b|L$/i.test(n)) || ben[0], R = ben.find(n => n !== L) || ben[1];
      MALL.man = { scen: sc, skala: 1, klipp: { ga: P.man.animations.find(a => /walk/i.test(a.name)), sta: P.man.animations.find(a => /idle/i.test(a.name)) }, fart: {}, vrid: null, benL: L, benR: R, hoft };
    }
  }
  // klippet på ett annat skelett: höftens förflyttning skalas med höfthöjden, ryggens förflyttningar släpps,
  // och om höften glider framåt under cykeln (rotrörelse) tas glidningen bort (vi flyttar personen själva)
  function klippFor(typ, kod) {
    const M = MALL[typ]; if (!M) return null;
    if (M.klipp[kod] !== undefined) return M.klipp[kod];
    const K = P.klipp[kod]; if (!K) return (M.klipp[kod] = null);
    const ut = [];
    for (const tr of K.clip.tracks) {
      if (/bip_Spine1?\.position/.test(tr.name)) continue;
      if (tr.name === 'bip.position' && K.vila) {
        const v = tr.values.slice(), k = M.vila.z / K.vila.z, n = v.length / 3;
        for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) v[i * 3 + j] = M.vila.getComponent(j) + (v[i * 3 + j] - K.vila.getComponent(j)) * k;
        if (n > 1 && /^(ga|lugn|jogg|telga)/.test(kod)) {
          const T = tr.times[n - 1] || 1, dx = v[(n - 1) * 3] - v[0], dy = v[(n - 1) * 3 + 1] - v[1];
          for (let i = 0; i < n; i++) { const f = tr.times[i] / T; v[i * 3] -= dx * f; v[i * 3 + 1] -= dy * f; }
        }
        ut.push(new THREE.VectorKeyframeTrack(tr.name, tr.times, v));
      } else ut.push(tr);
    }
    return (M.klipp[kod] = new THREE.AnimationClip(kod, K.clip.duration, ut));
  }
  // steglängd: foten som står på marken glider bakåt i förhållande till höften med gångfarten
  const VA = new THREE.Vector3(), VB = new THREE.Vector3(), VH = new THREE.Vector3();
  function matGang(typ, kod) {
    const M = MALL[typ];
    if (M.fart[kod] !== undefined) return M.fart[kod];
    const clip = kod === 'ga' && typ === 'man' ? M.klipp.ga : klippFor(typ, kod);
    if (!clip) return (M.fart[kod] = 0);
    const o = klona(M.scen), mx = new THREE.AnimationMixer(o); mx.clipAction(clip).play();
    const fL = o.getObjectByName(M.benL), fR = o.getObjectByName(M.benR), h = o.getObjectByName(M.hoft);
    if (!fL || !fR || !h) return (M.fart[kod] = 1);
    const N = 48, dt = clip.duration / N, v = []; let fx = 0, fz = 0, fore = null;
    for (let i = 0; i <= N; i++) {
      mx.setTime(i * dt); o.updateMatrixWorld(true);
      fL.getWorldPosition(VA); fR.getWorldPosition(VB); h.getWorldPosition(VH);
      const vf = VA.y < VB.y ? 0 : 1, F = vf ? VB : VA, rel = [F.x - VH.x, F.z - VH.z];
      if (fore && fore.vf === vf) { const dx = rel[0] - fore.rel[0], dz = rel[1] - fore.rel[1]; v.push(Math.hypot(dx, dz) / dt); fx -= dx; fz -= dz; }
      fore = { vf, rel };
    }
    v.sort((a, b) => a - b);
    const sk = M.skala * (o.scale.x || 1);
    if (!M.vrid) M.vrid = Math.atan2(fx, fz);           // modellens framåt (i modellens rum) -> vridning så att framåt blir +z
    return (M.fart[kod] = v[Math.floor(v.length * 0.55)] * sk);
  }

  // ---- en person ----
  const KOD = (typ, k) => {
    if (typ === 'man') return k === 'ga' || k === 'lugn' ? 'ga' : 'sta';
    const kv = KVINNA.has(typ);
    if (k === 'ga') return typ === 4 ? 'lugn_k' : kv ? 'ga_k' : 'ga_m';
    if (k === 'lugn') return kv ? 'lugn_k' : 'lugn_m';
    if (k === 'jogg') return kv ? 'jogg_k' : 'jogg_m';
    if (k === 'telga') return 'telga_m';
    if (k === 'sta') return kv ? (typ % 2 ? 'sta_k2' : 'sta_k') : (typ % 2 ? 'sta_m2' : 'sta_m');
    return k;   // tel, vinka, varm
  };
  function person(post, i) {
    const typ = post.typ === 'man' && (!MALL.man || MOBIL) ? 2 : post.typ, M = MALL[typ];
    if (!M) return null;
    const rot = new THREE.Group(), o = klona(M.scen), s = post.s || 1;
    rot.name = 'folk-' + typ; rot.userData.egen = false;
    if (typ !== 'man') { const pi = (post.pal ?? i) % P.pal.length; o.traverse(m => { if (m.isMesh) { m.material = lambert('pal' + pi, { map: P.pal[pi] }); } }); }
    o.traverse(m => { if (m.isMesh) { m.userData.egen = false; m.frustumCulled = false; } });
    const gang = post.t !== 'sta', kod = KOD(typ, gang ? (post.klipp || 'ga') : (post.klipp || 'sta'));
    const fart = gang ? matGang(typ, kod) : 0;
    if (!M.vrid) matGang(typ, KOD(typ, 'ga'));
    o.scale.setScalar(M.skala * s); o.rotation.y = -(M.vrid || 0);
    rot.add(o);
    const f = flack(), sk = new THREE.Mesh(f.geo, f.mat); sk.position.y = 0.02; sk.scale.setScalar(s); sk.renderOrder = 1; sk.userData.egen = false; rot.add(sk);
    const mx = new THREE.AnimationMixer(o), clip = typ === 'man' ? M.klipp[kod] : klippFor(typ, kod);
    const act = clip ? mx.clipAction(clip) : null;
    if (act) { act.play(); act.time = (i * 0.37 % 1) * clip.duration; mx.update(0); }   // utgångsställning direkt (även när livet är avstängt)
    // stående med omväxling (vinka/värma upp några gånger, sedan stå en stund)
    let alt = null;
    if (!gang && (post.klipp === 'vinka' || post.klipp === 'varm') && typ !== 'man') {
      const c2 = klippFor(typ, KOD(typ, 'sta'));
      if (c2) alt = { a: act, b: mx.clipAction(c2), paA: true, nasta: clip.duration * (post.klipp === 'vinka' ? 2 : 2), tA: clip.duration * 2, tB: 5 + (i % 3) * 2 };
    }
    return { post, rot, o, mx, act, fart: fart * s, alt, ack: 0, typ };
  }

  // ---- rörelse längs rutter ----
  const TURN = 1.1;                                  // sekunder för att vända i en ände
  function banaAv(pts, hy, dy) {
    // runda hörnen (radie ~1,2 m) och sampla var 0,8 m med marken under
    const R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i === 0 || i === pts.length - 1) { R.push(p); continue; }
      const a = pts[i - 1], b = pts[i + 1], la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), r = Math.min(1.2, la / 2, lb / 2);
      const p0 = [p[0] + (a[0] - p[0]) / la * r, p[1] + (a[1] - p[1]) / la * r], p1 = [p[0] + (b[0] - p[0]) / lb * r, p[1] + (b[1] - p[1]) / lb * r];
      for (let k = 0; k <= 4; k++) { const t = k / 4, u = 1 - t; R.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]); }
    }
    const ut = [[...R[0]]], cum = [0];
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1], b = R[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(l / 0.8));
      for (let k = 1; k <= n; k++) { const q = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]; cum.push(cum[cum.length - 1] + l / n); ut.push(q); }
    }
    return { p: ut.map(([x, z]) => [x, hy(x, z) + dy, z]), cum, L: cum[cum.length - 1] };
  }
  function langs(B, d, ut) {          // punkt och riktning på avståndet d
    let lo = 0, hi = B.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B.cum[m] <= d) lo = m; else hi = m; }
    const a = B.p[lo], b = B.p[hi], l = B.cum[hi] - B.cum[lo] || 1, t = Math.min(1, Math.max(0, (d - B.cum[lo]) / l));
    ut[0] = a[0] + (b[0] - a[0]) * t; ut[1] = a[1] + (b[1] - a[1]) * t; ut[2] = a[2] + (b[2] - a[2]) * t; ut[3] = Math.atan2(b[0] - a[0], b[2] - a[2]);
    return ut;
  }
  const vinkel = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

  // ---- gruppen ----
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), SF = new THREE.Sphere(new THREE.Vector3(), 3), VW = new THREE.Vector3();
  function grupp(poster, hy) {
    const g = new THREE.Group(); g.name = 'folk';
    if (AV) return g;
    poster = poster.filter(p => p && (!MOBIL || (p.prio || 1) < 2));
    if (MOBIL) poster = poster.slice(0, 10);
    if (!poster.length) return g;
    // rutterna samplas direkt (hy behövs inte sedan)
    poster.forEach(p => {
      if (p.t === 'ga') p.B = banaAv(p.bana, p.y0 !== undefined ? () => p.y0 : hy, p.dy ?? 0.03);   // y0: fast höjd (plan, brygga)
      if (p.t === 'sta' && p.p.length === 2) p.p = [p.p[0], hy(p.p[0], p.p[1]) + (p.dy ?? 0.03), p.p[1]];
    });
    ladda(() => {
      const F = poster.map((p, i) => person(p, i)).filter(Boolean);
      const tmp = [0, 0, 0, 0];
      F.forEach((q, i) => {
        const p = q.post;
        if (p.t === 'sta') { q.rot.position.set(...p.p); q.rot.rotation.y = Math.atan2(p.dir[0], p.dir[1]); }
        if (p.t === 'ga') {
          // farten följer steget (fötterna glider inte); fram och tillbaka med en kort vändning i ändarna
          q.v = q.fart > 0.2 ? q.fart : 1.2; q.off = (i * 0.618 % 1) * 2 * (p.B.L / q.v + TURN);
        }
        if (p.t === 'hund' && q.act && q.fart > 0.2) q.act.timeScale = p.sp / q.fart;
        g.add(q.rot);
      });
      // tickern: ett osynligt nät som alltid ritas; flyttar och animerar folket en gång per bildruta (VU.uTid)
      // (geometri och material delas av alla tickrar: förr fick varje miljöbyte ett nytt par som aldrig släpptes)
      if (!TICK.geo) { TICK.geo = new THREE.BufferGeometry(); TICK.geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)); TICK.mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); }
      const tick = new THREE.Mesh(TICK.geo, TICK.mat);
      tick.frustumCulled = false; tick.userData.egen = false; tick.name = 'folk-tick';
      let tSist = null, ruta = 0;
      tick.onBeforeRender = (renderer, scene, camera) => {
        if ((camera.parent && camera.parent.isCubeCamera) || !camera.layers.isEnabled(0)) return;   // (spegelns kubkamera inne i huset; sjöns spegelkamera ser bara sitt lager – synligheten följer huvudkameran)
        const t = VU.uTid.value;
        // (körs vid varje ritning: synligheten följer kameran även när livet står still; tiden går bara med uTid)
        const dt = tSist === null ? 0 : Math.min(0.25, Math.max(0, t - tSist)); tSist = t; ruta++;
        FR.setFromProjectionMatrix(PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cam = camera.getWorldPosition(VW).clone();
        const lista = [];
        for (const q of F) {
          const p = q.post;
          if (p.t === 'ga') {
            const L = p.B.L, T1 = L / q.v, per = 2 * (T1 + TURN), u = ((t + q.off) % per + per) % per;
            let d, yaw, gar = true;
            if (u < T1) { d = u * q.v; langs(p.B, d, tmp); yaw = tmp[3]; }
            else if (u < T1 + TURN) { langs(p.B, L - 0.01, tmp); const k = (u - T1) / TURN; yaw = vinkel(tmp[3], tmp[3] + Math.PI, k * k * (3 - 2 * k)); gar = false; }
            else if (u < 2 * T1 + TURN) { d = L - (u - T1 - TURN) * q.v; langs(p.B, d, tmp); yaw = tmp[3] + Math.PI; }
            else { langs(p.B, 0.01, tmp); const k = (u - 2 * T1 - TURN) / TURN; yaw = vinkel(tmp[3] + Math.PI, tmp[3] + 2 * Math.PI, k * k * (3 - 2 * k)); gar = false; }
            q.rot.position.set(tmp[0], tmp[1], tmp[2]);
            q.rot.rotation.y = q.yaw === undefined || !gar ? yaw : vinkel(q.yaw, yaw, Math.min(1, dt * 8));
            q.yaw = q.rot.rotation.y;
            if (q.act) q.act.timeScale = gar ? q.v / Math.max(q.fart, 0.2) : 0.55;   // i vändningen: små steg på stället
          } else if (p.t === 'hund') {
            // samma formel som omgivningens skuggare (typ 3) så att hunden och kopplet följer med
            const L = Math.max(p.L, 0.1), s = (((t * p.sp / (2 * L) + p.fas) % 1) + 1) % 1, d = s < 0.5 ? s * 2 : 2 - s * 2;
            q.rot.position.set(p.p0[0] + p.d[0] * L * d, p.p0[1], p.p0[2] + p.d[2] * L * d);
            q.rot.rotation.y = Math.atan2(p.d[0], p.d[2]) + (s < 0.5 ? 0 : Math.PI);
          } else if (q.alt) {
            const A = q.alt; A.nasta -= dt;
            if (A.nasta <= 0) { const fr = A.paA ? A.a : A.b, ti = A.paA ? A.b : A.a; ti.reset().play(); fr.crossFadeTo(ti, 0.6, false); A.paA = !A.paA; A.nasta = A.paA ? A.tA : A.tB; }
          }
          // synlighet och avstånd
          VW.copy(q.rot.position).applyMatrix4(g.matrixWorld);
          const avst = VW.distanceTo(cam);
          // (näten gallras inte av motorn – benen rör sig – så de som är utanför bilden eller långt bort döljs här;
          // sfären är tilltagen så att ingen poppar in i kanten när kameran vrids)
          SF.center.copy(VW); SF.center.y += 0.9;
          q.syns = avst < 170 && FR.intersectsSphere(SF);
          q.rot.visible = q.syns;
          q.rot.children[1].visible = avst < 45;     // kontaktskuggan bara nära
          q.avst = avst;
          if (q.syns && avst < 90) lista.push(q); else q.ack += dt;
        }
        lista.sort((a, b) => a.avst - b.avst);
        lista.forEach((q, k) => {
          if (k < MAX_NARA || (ruta + k) % 3 === 0) { q.mx.update(dt + q.ack); q.ack = 0; } else q.ack += dt;
        });
      };
      g.add(tick);
      console.info('miljö: folk', F.length, 'personer');
      try { if (/[?&]prov=1/.test(location.search)) (window.__folk = (window.__folk || []).filter(f => f.g.parent)).push({ g, F }); } catch (e) { /* utan fönster */ }   // för provbilder
      try { window.dispatchEvent(new Event('husritare:nytt')); } catch (e) { /* utan fönster */ }
    });
    return g;
  }
  return { grupp };
}
