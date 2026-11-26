import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';   // lekställningen (images/3d/lekplats.glb)
// Villaområdets omgivning: kvarterslekplats, basketplan, parkstråk (bollplan, damm, gång- och cykelväg),
// fler villor och radhus längs nya gator, återvinning, busshållplats och liv (gungor, karusell, folk som går,
// hund, cyklist, ankor, skorstensrök). Bakgrunden: skogsbryn i flera lager på kullar, tak och kyrktorn i fjärran.
//
// Allt statiskt läggs i villamiljöns befintliga buffertar (inga nya ritanrop): VD (småsaker), BD (grannhusen),
// V (träd och växter), lod (enkla hus långt bort) och vagar/YT (gatunätet). Det som rör sig ligger i ett eget
// nät med en liten skuggare (ett ritanrop) och röken i ett till (genomskinligt). Inget av det kastar skugga.
//
// skapaOmgivning(H) får villaNaras verktyg (H) och returnerar { lekplats(tm), bygg() }.
// villaSkog(r, trad, hy) bygger skogsbrynet i fjärrsetet (villaFjarr).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const UPP = [0, 1, 0];

// gläntor i skogsbrynet där tak skymtar (världens vinklar i grader, ±halv bredd) – samma i villaSkog och bygg()
const GLANTOR = [[-118, 7], [-52, 6], [14, 6], [63, 7], [128, 6], [172, 5]];
const iGlanta = (x, z, m = 0) => { const a = Math.atan2(z, x) * 180 / Math.PI; return GLANTOR.some(([g, b]) => { let d = Math.abs(a - g); if (d > 180) d = 360 - d; return d < b + m; }); };

// skogsbrynet bakom kvarteren: tre lager. Nära (128–165 m) blandat och glest med varierade höjder, mitten
// (165–200 m) tätare på kullarna, längst ut (200–226 m) tät silhuett. Gläntor lämnas för taken.
export function villaSkog(r, trad, hy) {
  const lager = [[128, 165, 260, 0.35], [165, 200, 330, 0.12], [200, 226, 380, 0]];
  for (const [d0, d1, n, gles] of lager) for (let i = 0; i < n; i++) {
    const a = (i + r() * 0.8) / n * Math.PI * 2, d = d0 + r() * (d1 - d0), x = Math.cos(a) * d, z = Math.sin(a) * d;
    // klungor: brus längs ringen gör att skogen kommer i dungar med luckor nära, tätare längre ut
    const k = 0.5 + 0.5 * Math.sin(a * 7 + d * 0.05) * Math.sin(a * 3.3 + 1.7);
    if (r() < gles * (1 - k)) continue;
    if (iGlanta(x, z, d < 165 ? 0 : 1)) continue;
    const q = r();
    if (d < 165) {
      if (q < 0.3) trad('ek', x, z, 9 + r() * 7);
      else if (q < 0.55) trad('bjork', x, z, 11 + r() * 8);
      else if (q < 0.72) trad('tall0', x, z, 0);
      else trad(r() < 0.5 ? 'gran1' : 'gran2', x, z, 0);
    } else if (d < 200) {
      if (q < 0.25) trad('ek', x, z, 11 + r() * 6); else if (q < 0.42) trad('bjork', x, z, 13 + r() * 6); else if (q < 0.62) trad('tall1', x, z, 0); else trad('gran2', x, z, 0);
    } else {
      if (q < 0.3) trad('tall1', x, z, 0); else if (q < 0.42) trad('ek', x, z, 12 + r() * 5); else trad('gran2', x, z, 0);
    }
  }
}

let LEKGEO = null;
const lekModell = () => LEKGEO || (LEKGEO = new Promise(res => new GLTFLoader().load('images/3d/lekplats.glb', gl => {
  let geo = null; gl.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; }); res(geo);
}, undefined, () => res(null))));

export function skapaOmgivning(H) {
  const { parkBil, THREE, r, pt, hy, iGata, ledig, husR, vagar, HU, BAK, GHW, GTR, VD, TS, BD, V, N, lod, trad, ror, lada3, vkvad, UG, ETT,
    lagg, ting, bilDel, grannBygg, GRANNTYP, GRANNFARG, C, VU, LJUS, VARMT, egenMat, yta, planta, lykta, ryMot, uppfarter, hack } = H;
  const n0 = pt(0, 0), nv = sub([...pt(1, 0), 0], [...n0, 0]), tv = sub([...pt(0, 1), 0], [...n0, 0]);
  const VN = [nv[0], 0, nv[1]], VT = [tv[0], 0, tv[1]];            // kvarterets sv- och lat-riktning i världen
  const varld = (fsv, flat) => nrm([VN[0] * fsv + VT[0] * flat, 0, VN[2] * fsv + VT[2] * flat]);

  // ---- en lokal ram: origo i (sv, lat), +w mot (fsv, flat), +u åt sidan (högerhänt med upp) ----
  function ram(sv, lat, fsv, flat) {
    const [ox, oz] = pt(sv, lat), Z = varld(fsv, flat), X = [Z[2], 0, -Z[0]];
    const ry = Math.atan2(Z[0], Z[2]);
    const P = (u, w, y = 0) => { const x = ox + X[0] * u + Z[0] * w, z = oz + X[2] * u + Z[2] * w; return [x, hy(x, z) + y, z]; };
    const Pf = (u, w, y, y0) => [ox + X[0] * u + Z[0] * w, y0 + y, oz + X[2] * u + Z[2] * w];   // fast höjd (plan yta)
    const ax = (vr = 0) => { const c = Math.cos(vr), s = Math.sin(vr); const A = [X[0] * c + Z[0] * s, 0, X[2] * c + Z[2] * s]; return [A, UPP, crs(A, UPP)]; };
    const lada = (u, w, y, hu, hh, hw, f, vr = 0, D = VD) => lada3(D, P(u, w, y), ax(vr), [hu, hh, hw], f);
    const ladaF = (u, w, y, y0, hu, hh, hw, f, vr = 0, D = VD) => lada3(D, Pf(u, w, y, y0), ax(vr), [hu, hh, hw], f);
    const rorL = (pts, rad, f, sid = 6, y0 = null) => ror(VD, pts.map(([u, w, y]) => [...(y0 === null ? P(u, w, y) : Pf(u, w, y, y0)), rad]), sid, UG, 1, () => f);
    const kvadF = (u, w, y0, hu, hw, f, vr = 0) => { const [A, , B] = ax(vr); vkvad(VD, Pf(u, w, 0, y0), A.map(v => v * hu), B.map(v => v * hw), UPP, f); };
    const sv_ = (u, w) => { const [x, , z] = P(u, w); return [(x - n0[0]) * VN[0] + (z - n0[1]) * VN[2], (x - n0[0]) * VT[0] + (z - n0[1]) * VT[2]]; };
    // staket med stolpar, två reglar och glesa spjälor/trådar (tunna kort, syns igenom); luckor = öppningar [u, w]
    const staket = (u0, w0, u1, w1, Hs, f, luckor = [], steg = 0.22, y0 = null, stolpe = 2.4) => {
      const L = Math.hypot(u1 - u0, w1 - w0), n = Math.max(1, Math.round(L / stolpe)), vr = Math.atan2(w1 - w0, u1 - u0), [Aa, , Bb] = ax(vr);
      const Q = (u, w, y) => y0 === null ? P(u, w, y) : Pf(u, w, y, y0);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, um = u0 + (u1 - u0) * (t0 + t1) / 2, wm = w0 + (w1 - w0) * (t0 + t1) / 2;
        if (luckor.some(([lu, lw]) => Math.hypot(um - lu, wm - lw) < 1.4)) continue;
        for (const t of [t0, t1]) lada3(VD, Q(u0 + (u1 - u0) * t, w0 + (w1 - w0) * t, Hs / 2), ax(vr), [0.035, Hs / 2 + 0.02, 0.035], f);
        for (const yy of [0.12, Hs - 0.05]) lada3(VD, Q(um, wm, yy), ax(vr), [L / n / 2, 0.022, 0.014], f);
        const ns = Math.round(L / n / steg);
        for (let j = 1; j < ns; j++) {
          const t = t0 + (t1 - t0) * j / ns, c = Q(u0 + (u1 - u0) * t, w0 + (w1 - w0) * t, (Hs + 0.07) / 2);
          for (const sgn of [1, -1]) vkvad(VD, c, Aa.map(v => v * 0.012), [0, (Hs - 0.17) / 2, 0], Bb.map(v => v * sgn), f);
        }
      }
    };
    return { P, Pf, X, Z, ry, ax, lada, ladaF, rorL, kvadF, staket, svlat: sv_, o: [ox, oz] };
  }

  // ---- det som rör sig: ett eget nät, attribut aPiv (vridpunkt, typ), aRor (axel/riktning, utslag/längd), aFas ----
  // typ 0 stilla, 1 pendel kring axel, 2 snurrar kring lodrät axel, 3 går fram och tillbaka (ben/armar svänger), 5 studsar
  const A = { P: [], N: [], C: [], PV: [], RO: [], FA: [], I: [] };
  const STILL = { piv: [0, 0, 0, 0], ro: [0, 1, 0, 0], fa: [0, 0, 0, 0] };
  const av = (p, n, f, an) => { A.P.push(...p); A.N.push(...n); A.C.push(...f); A.PV.push(...an.piv); A.RO.push(...an.ro); A.FA.push(...an.fa); return A.P.length / 3 - 1; };
  function aLada(c, AX, h, f, an = STILL) {
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const n = AX[i].map(v => v * s), a = AX[(i + 1) % 3], b = AX[(i + 2) % 3], ha = h[(i + 1) % 3], hb = h[(i + 2) % 3], k = A.P.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sa, sb]) => av([c[0] + n[0] * h[i] + a[0] * ha * sa + b[0] * hb * sb, c[1] + n[1] * h[i] + a[1] * ha * sa + b[1] * hb * sb, c[2] + n[2] * h[i] + a[2] * ha * sa + b[2] * hb * sb], n, f, an));
      if (s > 0) A.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else A.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
  }
  function aRor(p0, p1, rad, f, an = STILL, sid = 5) {
    const t = nrm(sub(p1, p0)), b1 = nrm(Math.abs(t[1]) < 0.9 ? crs(t, UPP) : crs(t, [1, 0, 0])), b2 = crs(t, b1), k = A.P.length / 3;
    for (const p of [p0, p1]) for (let j = 0; j <= sid; j++) {
      const a = j / sid * 6.283, n = [b1[0] * Math.cos(a) + b2[0] * Math.sin(a), b1[1] * Math.cos(a) + b2[1] * Math.sin(a), b1[2] * Math.cos(a) + b2[2] * Math.sin(a)];
      av([p[0] + n[0] * rad, p[1] + n[1] * rad, p[2] + n[2] * rad], n, f, an);
    }
    for (let j = 0; j < sid; j++) { const a = k + j, b = a + 1, c = a + sid + 1, d = c + 1; A.I.push(a, c, b, b, c, d); }
  }
  // en enkel människa (eller ett barn med s < 1): ben, kropp, armar, huvud och hår. Står vid p, tittar åt dir.
  // pose: 'sta', 'sitt' (ben framåt), 'cykel'. gang: {typ 3-animering} så att benen och armarna svänger.
  const HUD = [[0.86, 0.66, 0.52], [0.7, 0.5, 0.36], [0.48, 0.32, 0.22], [0.92, 0.74, 0.62]];
  const TROJA = [[0.62, 0.12, 0.1], [0.1, 0.24, 0.5], [0.85, 0.72, 0.2], [0.18, 0.4, 0.26], [0.82, 0.8, 0.76], [0.45, 0.2, 0.5], [0.9, 0.42, 0.18], [0.25, 0.25, 0.27]];
  const BYXOR = [[0.12, 0.14, 0.22], [0.2, 0.2, 0.21], [0.32, 0.26, 0.2], [0.18, 0.22, 0.36]];
  const HAR = [[0.12, 0.08, 0.05], [0.45, 0.3, 0.14], [0.72, 0.58, 0.32], [0.2, 0.14, 0.1]];
  // riktiga animerade människor (husritare-folk.js): poster samlas här och hämtas av miljön (folk). Klossfiguren som
  // posten ersätter drar ändå sina slumptal (folkUt), så att resten av kvarteret står kvar som förr.
  const FOLK = [], siktkil0 = H.iSiktkil || (() => false), siktkil = (x, z, m) => Math.hypot(x, z) < 34 && siktkil0(x, z, m);   // (bakom startvyns kamera, längre ut i kilen, syns de inte)
  const folkUt = (farg = {}) => { if (!farg.troja) r(); if (!farg.byxor) r(); r(); r(); };
  const folk = (post, farg) => { folkUt(farg); const p = post.p || post.p0 || (post.bana && post.bana[0]); if (post.t !== 'ga' && p && siktkil(p[0], p[p.length - 1], 1)) return; FOLK.push(post); };
  function figur(p, dir, s, an, pose = 'sta', farg = {}) {
    const F = nrm([dir[0], 0, dir[2]]), S = crs(UPP, F), AX = [S, UPP, F];   // S × UPP = F (högerhänt)
    const at = (x, y, z) => [p[0] + S[0] * x * s + F[0] * z * s, p[1] + y * s, p[2] + S[2] * x * s + F[2] * z * s];
    const tr = farg.troja || TROJA[r() * TROJA.length | 0], by = farg.byxor || BYXOR[r() * BYXOR.length | 0], hu = HUD[r() * HUD.length | 0], ha = HAR[r() * HAR.length | 0];
    const med = (ben, hoft) => an.piv[3] === 3 ? { piv: an.piv, ro: an.ro, fa: [an.fa[0], an.fa[1], ben, hoft * s] } : an;
    const b = (x, y, z, hx, hy, hz, f, a = an) => aLada(at(x, y, z), AX, [hx * s, hy * s, hz * s], f, a);
    if (pose === 'sitt') {
      for (const sx of [-1, 1]) { b(sx * 0.09, 0.5, 0.22, 0.065, 0.065, 0.24, by); b(sx * 0.09, 0.25, 0.44, 0.06, 0.22, 0.06, by); b(sx * 0.09, 0.03, 0.48, 0.06, 0.03, 0.1, [0.1, 0.1, 0.1]); }
      b(0, 0.85, 0, 0.17, 0.3, 0.1, tr);
      for (const sx of [-1, 1]) b(sx * 0.22, 0.95, 0.12, 0.05, 0.05, 0.2, tr);
    } else if (pose === 'cykel') {
      for (const sx of [-1, 1]) { b(sx * 0.1, 0.68, 0.05, 0.06, 0.3, 0.06, by, med(sx, 0.98)); }
      b(0, 1.12, 0.12, 0.17, 0.28, 0.1, tr);
      for (const sx of [-1, 1]) b(sx * 0.22, 1.12, 0.32, 0.05, 0.05, 0.24, tr);
    } else {
      for (const sx of [-1, 1]) { b(sx * 0.09, 0.44, 0, 0.065, 0.42, 0.07, by, med(sx, 0.86)); b(sx * 0.09, 0.03, 0.04, 0.06, 0.03, 0.1, [0.08, 0.08, 0.08], med(sx, 0.86)); }
      b(0, 1.15, 0, 0.17, 0.3, 0.1, tr);
      if (farg.fram) for (const sx of [-1, 1]) b(sx * 0.22, 1.32, 0.2, 0.05, 0.05, 0.2, tr);
      else for (const sx of [-1, 1]) b(sx * 0.23, 1.17, 0, 0.05, 0.26, 0.05, tr, med(-sx * 0.8, 1.42));
    }
    const yh = pose === 'sitt' ? 1.25 : pose === 'cykel' ? 1.52 : 1.55;
    b(0, yh + 0.1, pose === 'cykel' ? 0.15 : 0, 0.095, 0.11, 0.1, hu);
    b(0, yh + 0.2, (pose === 'cykel' ? 0.15 : 0) - 0.02, 0.1, 0.035, 0.105, farg.mossa || ha);
  }

  // ---- kvarterslekplats på en tom tomtplats (tm från villaNara: lok, f, hsv, hlat) ----
  let LEK = null;
  const RES = [];                     // egna upptagna ytor [sv, lat, radie] (lekplats, planer, damm)
  const fri = (sv, lat, m = 0.5) => ledig(sv, lat, m) && !RES.some(([a, b, rr]) => Math.hypot(sv - a, lat - b) < rr + m);
  function lekplats(tm) {
    const R = ram(tm.hsv, tm.hlat, tm.f[0], tm.f[1]), { P, lada, rorL, kvadF, X, Z } = R, y0 = P(0, 0)[1];
    LEK = { tm, R };
    RES.push([...R.svlat(0, -12), 26]);
    const TRA = [0.42, 0.28, 0.16], TRAM = [0.3, 0.2, 0.12], GRON = [0.1, 0.32, 0.16], ROD = [0.7, 0.1, 0.06], GUL = [0.9, 0.66, 0.08], BLA = [0.08, 0.28, 0.62], STAL = [0.5, 0.52, 0.54], SAND = [1.85, 1.55, 1.02];
    const U0 = -10.5, U1 = 10.5, W0 = -9.5, W1 = 7.2;
    // underlaget: sand över hela ytan, gummiasfalt under gungorna och vid klätterställningen, kantlist i trä
    { const [a0, b0] = R.svlat(U0, (W0 + W1) / 2), [a1, b1] = R.svlat(U1, (W0 + W1) / 2); yta(a0, b0, a1, b1, W1 - W0, 0.03, SAND, 6); }
    kvadF(4.6, -4.4, y0 + 0.045, 4.2, 2.6, [0.42, 0.1, 0.07]);             // röd gummiasfalt under gungorna
    kvadF(-5.3, -3.85, y0 + 0.045, 5.3, 5.5, [0.12, 0.3, 0.16]);           // grön gummiasfalt under lekställningen
    for (const [u, w, hu, hw] of [[0, W0, (U1 - U0) / 2, 0.05], [0, W1, (U1 - U0) / 2, 0.05], [U0, (W0 + W1) / 2, 0.05, (W1 - W0) / 2], [U1, (W0 + W1) / 2, 0.05, (W1 - W0) / 2]]) lada(u, w, 0.07, hu, 0.07, hw, TRAM);
    // lågt grönt spjälstaket runt, öppning mot gatan och en mot parken bakom
    const SM = 0.6, GRS = [0.1, 0.3, 0.16];
    R.staket(U0 - SM, W1 + SM, U1 + SM, W1 + SM, 0.85, GRS, [[0, W1 + SM]]); R.staket(U0 - SM, W0 - SM, U1 + SM, W0 - SM, 0.85, GRS, [[6.5, W0 - SM]]);
    R.staket(U0 - SM, W0 - SM, U0 - SM, W1 + SM, 0.85, GRS); R.staket(U1 + SM, W0 - SM, U1 + SM, W1 + SM, 0.85, GRS);
    // ---- lekställningen (images/3d/lekplats.glb: torn, broar, klätterväggar, spiral- och rörrutschkanor) ----
    // Utplockad ur en royaltyfri modell och förenklad (17 000 trianglar, färgen i hörnen): laddas i bakgrunden.
    LEK.stallning = { p: P(-5.3, -3.85), ry: R.ry, s: 0.85 };
    // ---- gungställning: tre fack (två vanliga gungor och en fågelbo-gunga) ----
    const GU = 4.6, GW = -4.4, GH = 2.35;
    {
      for (const u of [GU - 3.6, GU - 1.2, GU + 1.2, GU + 3.6]) for (const w of [-0.9, 0.9]) rorL([[u, GW + w, -0.05], [u, GW, GH]], 0.05, STAL);
      rorL([[GU - 3.7, GW, GH], [GU + 3.7, GW, GH]], 0.06, STAL);
    }
    // ---- sandlåda med leksaker ----
    {
      const su = -4.8, sw = 3.4;
      for (const [u, w, hu, hw] of [[su, sw - 1.5, 1.6, 0.1], [su, sw + 1.5, 1.6, 0.1], [su - 1.5, sw, 0.1, 1.5], [su + 1.5, sw, 0.1, 1.5]]) lada(u, w, 0.18, hu, 0.18, hw, TRA);
      lada(su, sw, 0.14, 1.42, 0.04, 1.42, [1.45, 1.25, 0.9]);
      rorL([[su + 0.6, sw - 0.5, 0.17], [su + 0.6, sw - 0.5, 0.36]], 0.11, ROD, 8);               // hink
      lada(su - 0.5, sw + 0.4, 0.21, 0.04, 0.012, 0.18, BLA, 0.6);                              // spade
      lada(su + 0.3, sw + 0.7, 0.26, 0.22, 0.08, 0.13, GUL, 0.3); lada(su + 0.38, sw + 0.7, 0.38, 0.08, 0.06, 0.12, ROD, 0.3);   // leksaksbil
      for (const [du, dw] of [[-0.55, -0.6], [-0.2, -0.75]]) rorL([[su + du, sw + dw, 0.17], [su + du, sw + dw, 0.24]], 0.12, [ROD, GRON][du < -0.3 ? 0 : 1], 8);   // sandformar
    }
    // ---- bänkar med papperskorg, cykelställ, skylt och lyktstolpe ----
    const bank = (u, w, vr) => {
      lada(u, w, 0.44, 0.85, 0.025, 0.22, TRA, vr); lada(u - 0.2 * Math.sin(vr), w + 0.2 * Math.cos(vr), 0.72, 0.85, 0.12, 0.025, TRA, vr);
      for (const k of [-0.7, 0.7]) lada(u + Math.cos(vr) * k, w - Math.sin(vr) * k * -1, 0.22, 0.03, 0.22, 0.2, [0.15, 0.15, 0.16], vr);
    };
    bank(-1.2, 6.2, 0); bank(9.2, 0, Math.PI / 2); bank(-9.3, 4.2, -Math.PI / 2);
    for (const [u, w] of [[0.6, 6.4], [9.4, 1.6]]) { rorL([[u, w, 0], [u, w, 0.85]], 0.03, [0.2, 0.2, 0.21]); rorL([[u, w, 0.45], [u, w, 0.95]], 0.2, [0.12, 0.3, 0.16], 8); }
    // cykelställ utanför grinden med tre cyklar
    {
      const cu = 4.0, cw = W1 + 2.0;
      lada(cu, cw, 0.03, 1.8, 0.03, 0.22, [0.3, 0.3, 0.31]);
      for (let k = 0; k < 3; k++) {
        const u = cu - 1.2 + k * 1.2, RAM = [[0.1, 0.25, 0.45], [0.55, 0.08, 0.06], [0.85, 0.85, 0.82]][k];
        rorL([[u, cw - 0.2, 0.0], [u, cw - 0.2, 0.55], [u, cw + 0.2, 0.55], [u, cw + 0.2, 0]], 0.02, STAL, 4);
        if (k === 1 && r() < 2) {
          const hj = w => { const pts = []; for (let j = 0; j <= 10; j++) { const a = j / 10 * 6.283; pts.push([u + 0.06, w + Math.cos(a) * 0.33, 0.34 + Math.sin(a) * 0.33]); } rorL(pts, 0.014, [0.03, 0.03, 0.03], 3); };
          hj(cw - 0.55); hj(cw + 0.55);
          rorL([[u + 0.06, cw - 0.55, 0.34], [u + 0.06, cw - 0.05, 0.36], [u + 0.06, cw + 0.42, 0.78], [u + 0.06, cw - 0.12, 0.78], [u + 0.06, cw - 0.05, 0.36]], 0.016, RAM, 4);
          rorL([[u + 0.06, cw + 0.42, 0.78], [u + 0.06, cw + 0.55, 0.34]], 0.014, RAM, 4); lada(u + 0.06, cw - 0.16, 0.92, 0.05, 0.02, 0.11, [0.04, 0.04, 0.04]);
        }
        if (k !== 1) {
          const hj = w => { const pts = []; for (let j = 0; j <= 10; j++) { const a = j / 10 * 6.283; pts.push([u + 0.06, w + Math.cos(a) * 0.3, 0.31 + Math.sin(a) * 0.3]); } rorL(pts, 0.014, [0.03, 0.03, 0.03], 3); };
          hj(cw - 0.5); hj(cw + 0.5);
          rorL([[u + 0.06, cw - 0.5, 0.31], [u + 0.06, cw, 0.33], [u + 0.06, cw + 0.38, 0.72], [u + 0.06, cw - 0.1, 0.72], [u + 0.06, cw, 0.33]], 0.016, RAM, 4);
          rorL([[u + 0.06, cw + 0.38, 0.72], [u + 0.06, cw + 0.5, 0.31]], 0.014, RAM, 4);
        }
      }
    }
    { const [a, b] = R.svlat(-2.6, W1 + 1.2); lykta(a, b, ...(() => { const [a2, b2] = R.svlat(-2.6, W1 + 2.2); return [a2 - a, b2 - b]; })()); }
    // skuggträd: en stor ek bakom klätterställningen och en lönn vid bänkarna, buskar i hörnen, låg häck bakom
    { const [x, , z] = P(-9.0, -10.8); trad('ek', x, z, 12.5, 4); }
    { const [x, , z] = P(10.5, -10.5); trad('ek', x, z, 10.5, 3.5); }
    { const [x, , z] = P(-12.2, 5.2); trad('ek', x, z, 9.5, 2.5); }
    for (const [u, w] of [[-11.6, -7.5], [11.8, -6.5], [11.8, 4.8], [-11.7, 1]]) { const [x, , z] = P(u, w); trad('buske', x, z, 1.2 + r() * 0.5, 1); }
    // ---- rörliga delar: gungor (en tjej och en kille gungar), fågelbo, gungdjur, karusell ----
    const axU = X;                                                     // gungornas axel = längs ställningen
    const gunga = (u, amp, fas, barn) => {
      const pv = P(u, GW, GH), an = { piv: [...pv, 1], ro: [...axU, amp], fa: [fas, 2.35, 0, 0] };
      for (const s of [-0.22, 0.22]) aRor(P(u + s, GW, GH - 0.02), P(u + s, GW, 0.5), 0.009, STAL, an, 3);
      aLada(P(u, GW, 0.48), [X, UPP, Z], [0.24, 0.025, 0.11], [0.08, 0.08, 0.09], an);
      if (barn) figur(P(u, GW - 0.2, 0.47 - 0.5 * 0.72), Z, 0.72, an, 'sitt');
    };
    gunga(GU - 2.95, 0.5, 0, true); gunga(GU - 1.85, 0.12, 1.1, false); gunga(GU - 0.55, 0.42, 1.9, true); gunga(GU + 0.55, 0.08, 0.4, false);
    {  // fågelbo i sista facket
      const u = GU + 2.4, pv = P(u, GW, GH), an = { piv: [...pv, 1], ro: [...axU, 0.22], fa: [0.7, 2.0, 0, 0] };
      for (const [du, dw] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45]]) aRor(P(u + du * 0.25, GW + dw * 0.25, GH - 0.02), P(u + du, GW + dw, 0.62), 0.01, STAL, an, 3);
      const pts = []; for (let j = 0; j <= 14; j++) { const a = j / 14 * 6.283; pts.push(P(u + Math.cos(a) * 0.5, GW + Math.sin(a) * 0.5, 0.6)); }
      for (let j = 0; j < 14; j++) aRor(pts[j], pts[j + 1], 0.05, [0.85, 0.2, 0.1], an, 4);
      aLada(P(u, GW, 0.6), [X, UPP, Z], [0.36, 0.012, 0.36], [0.16, 0.18, 0.2], an);
      figur(P(u - 0.05, GW + 0.05, 0.62 - 0.5 * 0.62), X, 0.62, an, 'sitt');
    }
    // förälder som står och puttar
    { const p = P(GU - 0.55, GW - 2.5, 0.03); folk({ t: 'sta', p, dir: [Z[0], Z[2]], typ: 1, pal: 0, klipp: 'sta' }, { troja: 1 }); }
    // gungdjur (häst och anka) på fjäder
    const gungdjur = (u, w, f, fas) => {
      const bas = P(u, w, 0), an = { piv: [...bas, 1], ro: [...X, 0.16], fa: [fas, 3.1, 0, 0] };
      aRor(P(u, w, 0), P(u, w, 0.45), 0.09, [0.55, 0.56, 0.58], an, 6);
      aLada(P(u, w, 0.62), [X, UPP, Z], [0.14, 0.16, 0.38], f, an); aLada(P(u, w + 0.36, 0.88), [X, UPP, Z], [0.11, 0.14, 0.13], f, an);
      aLada(P(u, w - 0.4, 0.78), [X, UPP, Z], [0.03, 0.1, 0.04], f, an); aRor(P(u - 0.2, w + 0.22, 0.82), P(u + 0.2, w + 0.22, 0.82), 0.02, [0.1, 0.1, 0.1], an, 4);
    };
    gungdjur(0.6, 0.6, ROD, 0); gungdjur(2.0, 1.9, GUL, 1.4);
    // karusell
    {
      const ku = 6.2, kw = 3.2, kp = P(ku, kw, 0), an = { piv: [...kp, 2], ro: [0, 1, 0, 0], fa: [0, 0.9, 0, 0] };
      aRor(P(ku, kw, 0.2), P(ku, kw, 0.3), 1.15, BLA, an, 16);
      aLada(P(ku, kw, 0.3), [X, UPP, Z], [0.8, 0.01, 0.8], [0.1, 0.22, 0.48], an);
      aLada(P(ku, kw, 0.3), [nrm([X[0] + Z[0], 0, X[2] + Z[2]]), UPP, crs(nrm([X[0] + Z[0], 0, X[2] + Z[2]]), UPP)], [0.8, 0.012, 0.8], [0.1, 0.22, 0.48], an);
      aRor(P(ku, kw, 0.3), P(ku, kw, 1.0), 0.06, GUL, an, 6);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, c = Math.cos(a), s = Math.sin(a); aRor(P(ku, kw, 0.95), P(ku + c * 0.95, kw + s * 0.95, 0.85), 0.025, GUL, an, 4); aRor(P(ku + c * 0.95, kw + s * 0.95, 0.85), P(ku + c * 0.95, kw + s * 0.95, 0.3), 0.025, GUL, an, 4); }
      figur(P(ku + 0.6, kw - 0.2, 0.31), X, 0.66, an, 'sta', { fram: true });
    }
    // barn i sandlådan och vid rutschkanan, förälder på bänken
    // (riktiga människor: en pojke står i sandlådan, en pappa pratar i telefon vid bänken)
    folk({ t: 'sta', p: P(-4.4, 3.0, 0.2), dir: [-Z[0] + X[0] * 0.5, -Z[2] + X[2] * 0.5], typ: 5, pal: 1, klipp: 'sta' });
    folk({ t: 'sta', p: P(-1.9, 5.3, 0.03), dir: [-Z[0], -Z[2]], typ: 3, pal: 2, klipp: 'tel' }, { troja: 1 });
    // ett barn springer fram och tillbaka mellan karusellen och gungdjuren
    { const p0 = P(-0.5, 0.0, 0), p1 = P(4.5, -0.5, 0);
      folk({ t: 'ga', bana: [[p0[0], p0[2]], [p1[0], p1[2]]], klipp: 'jogg', typ: 6, pal: 4, dy: 0.03 }); }
    basketplan();
  }

  // ---- basketplan bakom lekplatsen: grå asfalt, röda zoner, vita linjer, två korgar, nätstaket med öppning ----
  function basketplan() {
    const { R } = LEK, BW = -24.5, Lh = 13, Wh = 7.5;     // halva längden längs u, halva bredden längs w
    const { P, lada, rorL, kvadF, Pf } = R;
    let y0 = Infinity; for (const [u, w] of [[-Lh, BW - Wh], [Lh, BW - Wh], [-Lh, BW + Wh], [Lh, BW + Wh], [0, BW]]) y0 = Math.min(y0, P(u, w)[1]);
    const Y = y0 + 0.05, VIT = [1.6, 1.6, 1.56], LIN = 0.05;
    // asfalten (gatans yta: ett anrop) och en kantsten
    { const [a0, b0] = R.svlat(-Lh - 1.2, BW), [a1, b1] = R.svlat(Lh + 1.2, BW); yta(a0, b0, a1, b1, 2 * Wh + 2.4, 0.035, [0.78, 0.8, 0.8], 8); }
    kvadF(0, BW, Y, Lh, Wh, [0.2, 0.34, 0.3]);                                   // spelytan (grön)
    for (const s of [-1, 1]) kvadF(s * (Lh - 2.9), BW, Y + 0.003, 2.9, 2.45, [0.6, 0.2, 0.14]);   // röda zoner (straffområdet)
    // linjer: ytterlinjer, mittlinje, mittcirkel, straffkast, trepoängsbåge
    const Y2 = Y + 0.006;
    const linje = (u0, w0, u1, w1) => { const L = Math.hypot(u1 - u0, w1 - w0) / 2, vr = Math.atan2(w1 - w0, u1 - u0); kvadF((u0 + u1) / 2, (w0 + w1) / 2, Y2, L + LIN / 2, LIN / 2, VIT, vr); };
    const bage = (cu, cw, rad, a0, a1, n) => { for (let k = 0; k < n; k++) { const p = a0 + (a1 - a0) * k / n, q = a0 + (a1 - a0) * (k + 1) / n; linje(cu + Math.cos(p) * rad, cw + Math.sin(p) * rad, cu + Math.cos(q) * rad, cw + Math.sin(q) * rad); } };
    linje(-Lh, BW - Wh, Lh, BW - Wh); linje(-Lh, BW + Wh, Lh, BW + Wh); linje(-Lh, BW - Wh, -Lh, BW + Wh); linje(Lh, BW - Wh, Lh, BW + Wh); linje(0, BW - Wh, 0, BW + Wh);
    bage(0, BW, 1.8, 0, 6.283, 20);
    for (const s of [-1, 1]) {
      const ub = s * (Lh - 5.8);
      linje(s * Lh, BW - 2.45, ub, BW - 2.45); linje(s * Lh, BW + 2.45, ub, BW + 2.45); linje(ub, BW - 2.45, ub, BW + 2.45);
      bage(ub, BW, 1.8, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2, 10);
      const kc = s * (Lh - 1.575);
      bage(kc, BW, 6.75, s > 0 ? Math.PI / 2 + 0.2 : -Math.PI / 2 + 0.2, s > 0 ? Math.PI * 1.5 - 0.2 : Math.PI / 2 - 0.2, 18);
      for (const sw of [-1, 1]) linje(s * Lh, BW + sw * 6.6, kc - s * 6.75 * Math.sin(0.2), BW + sw * 6.6);
      // korgställning: stolpe bakom linjen, arm, skiva med ruta, ring och nät
      const up = s * (Lh + 0.9);
      rorL([[up, BW, -0.1], [up, BW, 3.3]], 0.08, [0.18, 0.2, 0.24], 8, Y);
      rorL([[up, BW, 3.1], [s * (Lh - 0.15), BW, 3.25]], 0.05, [0.18, 0.2, 0.24], 6, Y);
      R.ladaF(s * (Lh - 0.3), BW, 3.4, Y, 0.03, 0.53, 0.9, [1.5, 1.5, 1.45]);
      for (const [dw, dy, hw, hh] of [[0, 3.33, 0.3, 0.02], [0, 3.69, 0.3, 0.02], [-0.29, 3.51, 0.02, 0.18], [0.29, 3.51, 0.02, 0.18]]) R.ladaF(s * (Lh - 0.33), BW + dw, dy, Y, 0.005, hh, hw, [0.62, 0.1, 0.06]);
      const rc = s * (Lh - 0.33 - 0.3), ring = [];
      for (let j = 0; j <= 12; j++) { const a = j / 12 * 6.283; ring.push([rc + Math.cos(a) * 0.23, BW + Math.sin(a) * 0.23, 3.05]); }
      rorL(ring, 0.012, [0.9, 0.3, 0.05], 3, Y);
      // nätet vajar svagt (pendel kring ringen)
      const pv = Pf(rc, BW, 3.05, Y), an = { piv: [...pv, 1], ro: [...R.X, 0.08], fa: [s, 1.3, 0, 0] };
      for (let j = 0; j < 8; j++) { const a = j / 8 * 6.283, b2 = a + 0.4; aRor(Pf(rc + Math.cos(a) * 0.23, BW + Math.sin(a) * 0.23, 3.04, Y), Pf(rc + Math.cos(b2) * 0.14, BW + Math.sin(b2) * 0.14, 2.62, Y), 0.006, [0.92, 0.92, 0.9], an, 3); }
      for (const [yy, rr] of [[2.9, 0.2], [2.75, 0.17]]) for (let j = 0; j < 8; j++) { const a = j / 8 * 6.283, b2 = (j + 1) / 8 * 6.283; aRor(Pf(rc + Math.cos(a) * rr, BW + Math.sin(a) * rr, yy, Y), Pf(rc + Math.cos(b2) * rr, BW + Math.sin(b2) * rr, yy, Y), 0.005, [0.92, 0.92, 0.9], an, 3); }
    }
    // bollen vid ena korgen
    ror(VD, [Pf(Lh - 1.0, BW + 1.6, 0.0, Y).concat(0.02), Pf(Lh - 1.0, BW + 1.6, 0.12, Y).concat(0.12), Pf(Lh - 1.0, BW + 1.6, 0.24, Y).concat(0.02)], 8, UG, 1, () => [0.85, 0.32, 0.08]);
    // lågt nätstaket runt planen, öppning mot lekplatsen
    const FU = Lh + 2.2, FW = Wh + 1.2, GR = [0.08, 0.2, 0.12];
    R.staket(-FU, BW + FW, FU, BW + FW, 1.2, GR, [[-3, BW + FW]], 0.3, Y - 0.05, 2.5); R.staket(-FU, BW - FW, FU, BW - FW, 1.2, GR, [], 0.3, Y - 0.05, 2.5);
    R.staket(-FU, BW - FW, -FU, BW + FW, 1.2, GR, [], 0.3, Y - 0.05, 2.5); R.staket(FU, BW - FW, FU, BW + FW, 1.2, GR, [], 0.3, Y - 0.05, 2.5);
    // bänk vid sidan och två ungdomar: en studsar bollen, en springer mot korgen
    { const [x, y, z] = Pf(-6, BW + FW - 0.7, 0, Y); const D0 = R.ax(0); lada3(VD, [x, y + 0.44, z], D0, [0.9, 0.025, 0.2], [0.42, 0.28, 0.16]); for (const k of [-0.75, 0.75]) lada3(VD, [x + D0[0][0] * k, y + 0.22, z + D0[0][2] * k], D0, [0.03, 0.22, 0.18], [0.15, 0.15, 0.16]); }
    // (riktiga människor: en värmer upp framför bänken, en joggar mot korgen, en står vid bollen)
    folk({ t: 'sta', p: Pf(-6.3, BW + FW - 2.0, 0.0, Y), dir: [-R.Z[0], -R.Z[2]], typ: 2, pal: 3, klipp: 'varm', s: 0.96 }, { troja: 1 });
    { const p0 = Pf(-2, BW + 1, 0, Y), p1 = Pf(Lh - 3, BW - 0.5, 0, Y);
      folk({ t: 'ga', bana: [[p0[0], p0[2]], [p1[0], p1[2]]], y0: Y, klipp: 'jogg', typ: 3, pal: 5, s: 0.95 }, { troja: 1 }); }
    { const p = Pf(-Lh + 5, BW - 1.5, 0, Y); folk({ t: 'sta', p, dir: [-R.X[0] - R.Z[0] * 0.6, -R.X[2] - R.Z[2] * 0.6], typ: 1, pal: 1, klipp: 'sta', s: 0.95 }, { troja: 1 });
      const bp = Pf(-Lh + 5 - 0.35, BW - 1.5 - 0.35, 0.13, Y), an = { piv: [...bp, 5], ro: [0, 1, 0, 0.75], fa: [0, 4.2, 0, 0] };
      aRor([bp[0], bp[1] - 0.12, bp[2]], [bp[0], bp[1] + 0.12, bp[2]], 0.12, [0.85, 0.32, 0.08], an, 8); }
  }

  // ---- hus längs en ny gata: villor (grannhusens byggare, enklare fönstermodul) och radhuslängor ----
  const RADTYP = { L: 6.4, W: 9, he: 5.6, R: 2.2, dorr: 1.7, extra: 'skarm',
    fram: [[4.4, 1.25, 1.6, 1.25], [1.6, 3.9, 1.1, 1.2], [4.6, 3.9, 1.1, 1.2]], bak: [[2.0, 1.25, 2.0, 1.25], [4.9, 1.25, 1.0, 1.25], [1.6, 3.9, 1.1, 1.2], [4.6, 3.9, 1.1, 1.2]], gavel: [[4.5, 3.9, 0.8, 0.9]] };
  const ROK = [];                     // skorstenar som ryker
  let bilar = 0; const bilOk = (x, z) => Math.hypot(x, z) < 95 && bilar++ < 9;   // bilarna är tunga (trianglar): bara några, inte för långt bort
  const BF = [[0.62, 0.62, 0.64], [0.02, 0.02, 0.025], [0.32, 0.03, 0.02], [0.03, 0.08, 0.2], [0.78, 0.78, 0.76], [0.2, 0.22, 0.2]];
  function villa(v, sd, s, rmax) {
    const ti = r() * 3 | 0, typ = GRANNTYP[ti], fg = GRANNFARG[r() * GRANNFARG.length | 0], spegel = r() < 0.5, q = sd * (GHW + GTR + 6 + typ.W / 2);
    const hsv = v.c + q, hlat = s;
    const R = ram(hsv, hlat, -sd, 0), [hx, hz] = R.o, d = Math.hypot(hx, hz);
    if (d > rmax) return false;
    const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => R.svlat(a * (typ.L / 2 + 1), b * (typ.W / 2 + 1.5)));
    if (!hor.every(([a, b]) => ledig(a, b, 1) && !iGata(a, b, 0.3))) return false;
    const hy0 = Math.min(...hor.map(([a, b]) => hy(...pt(a, b)))), farg = [C(fg[0]).toArray(), C(fg[1]).toArray(), C(fg[2]).toArray(), fg[3]];
    const ut = grannBygg(BD, typ, hx, hy0, hz, R.ry, farg, r(), spegel, { sol: r() < 0.25, racke: false, altandorr: false, nara: false });
    husR.push({ sv: hsv, lat: hlat, f: [-sd, 0], ax: [0, sd], L: typ.L, W: typ.W });
    if (r() < 0.22 && ROK.length < 5) { const xs = (spegel ? -1 : 1) * typ.L * 0.22; ROK.push(ut.tw(xs, ut.yR + ut.T + 0.9, -0.65)); }
    // uppfart, bil, brevlåda, häck mot gatan, träd och buskar på tomten
    const ux = (spegel ? -1 : 1) * (typ.L / 2 - 1.6), F = typ.W / 2, [a0, b0] = R.svlat(ux, F + 0.1), [a1, b1] = R.svlat(ux, F + 6.1);
    uppfarter.push([a0, b0, a1, b1, 3]);
    if (r() < 0.6) { const [x, y, z] = R.P(ux, F + 3); if (bilOk(x, z)) parkBil(x, y, z, R.ry + Math.PI, BF[r() * BF.length | 0]); }
    const hk = r() < 0.6, HF = hk ? [0.04, 0.09, 0.03] : [0.85, 0.84, 0.8];
    for (const [l0, l1] of [[-12, ux - 1.8], [ux + 1.8, 12]]) { if (l1 - l0 < 1) continue; if (hk && d < 90) { hack(1, (u, w) => R.svlat(u, w), l0, F + 5.4, l1, F + 5.4); continue; } const m = (l0 + l1) / 2, [x, y, z] = R.P(m, F + 5.4); lada3(VD, [x, y + (hk ? 0.55 : 0.4), z], R.ax(0), [(l1 - l0) / 2, hk ? 0.55 : 0.4, hk ? 0.4 : 0.03], HF); }
    { const [x, , z] = R.P(-(spegel ? -1 : 1) * 6 * (0.6 + r() * 0.5), -F - 5 - r() * 3), q2 = r(); if (ledig(...R.svlat(-(spegel ? -1 : 1) * 6, -F - 6), 1)) trad(q2 < 0.35 ? 'bjork' : q2 < 0.6 ? 'ek' : q2 < 0.8 ? 'gran1' : 'tall0', x, z, q2 < 0.35 ? 10 + r() * 5 : 8 + r() * 4, 0); }
    if (r() < 0.5) { const [x, , z] = R.P((spegel ? -1 : 1) * 8.5, -F - 3); trad('ek', x, z, 6 + r() * 3, 0); }
    if (d < 75) for (const sx of [-1, 1]) { const [x, , z] = R.P(sx * (typ.L / 2 + 0.9), F + 0.8); trad('buske', x, z, 0.9 + r() * 0.4, 0); }
    if (r() < 0.2) { const [x, y, z] = R.P((spegel ? 1 : -1) * 3, -F - 4); lagg(TS, ting('flagga'), x, y, z, 1, Math.atan2(-0.33, 0.94), 8, 0.002); }
    { const [x, y, z] = R.P(ux + (spegel ? -1 : 1) * 2.1, F + 5.8); lagg(TS, ting('brevlada'), x, y, z, 1, R.ry + Math.PI / 2, 8, 0); }
    return true;
  }
  // radhusens färgsättningar per länga: två närliggande fasadkulörer som växlar per lägenhet, snickerier, tak, taktyp
  const RADFARG = [
    [['#e9e5db', '#d9cfb4'], '#f4f2ec', '#5a5d60', 0], [['#8a2c22', '#9a3a2c'], '#efece4', '#6b2a21', 1], [['#c4c7c1', '#8796a3'], '#f2f0ea', '#4f5357', 0],
    [['#e2c886', '#e8dfc4'], '#f2efe7', '#6b2a21', 1], [['#7c8a6a', '#9ba58b'], '#f1efe8', '#3a3b3c', 1], [['#cdb89a', '#e6e2d8'], '#ffffff', '#4b3f36', 1],
  ];
  const TRAF = [[0.42, 0.3, 0.19], [0.3, 0.3, 0.29], [0.5, 0.42, 0.3], [0.35, 0.1, 0.07]];
  // en enkel cykel i VD (hjul, ram, styre, sadel) vid p, längs riktningen d
  const cykelVD = (p, d, RAM) => {
    const at = (f, y) => [p[0] + d[0] * f, p[1] + y, p[2] + d[2] * f], hj = f => { const P = []; for (let j = 0; j <= 10; j++) { const a = j / 10 * 6.283; P.push([...at(f + Math.cos(a) * 0.32, 0.33 + Math.sin(a) * 0.32), 0.015]); } ror(VD, P, 3, UG, 1, () => [0.03, 0.03, 0.03]); };
    hj(-0.52); hj(0.52);
    ror(VD, [[...at(-0.52, 0.33), 0.016], [...at(0, 0.36), 0.016], [...at(0.42, 0.78), 0.016], [...at(-0.12, 0.78), 0.016], [...at(0, 0.36), 0.016]], 4, UG, 1, () => RAM);
    ror(VD, [[...at(0.42, 0.78), 0.014], [...at(0.52, 0.33), 0.014]], 4, UG, 1, () => RAM);
    ror(VD, [[...at(0.42, 0.78), 0.014], [...at(0.45, 0.98), 0.014]], 4, UG, 1, () => [0.2, 0.2, 0.2]);
    ror(VD, [[...at(-0.14, 0.78), 0.014], [...at(-0.16, 0.9), 0.014]], 4, UG, 1, () => RAM);
  };
  // trädäck på marken: plankmönster (gatunätets trall), kantbräda runt om; uc/wc mitt, hu/hw halva mått i ramen R
  const DACK_Y = 0.07;
  const dack = (R, uc, wc, hu, hw, f = [1.3, 0.98, 0.7]) => {
    const [a0, b0] = R.svlat(uc - hu, wc), [a1, b1] = R.svlat(uc + hu, wc); yta(a0, b0, a1, b1, 2 * hw, DACK_Y, f, 2);
    const KB = [0.36, 0.25, 0.16];
    for (const [u, w, a, b] of [[uc, wc - hw, hu + 0.04, 0.025], [uc, wc + hw, hu + 0.04, 0.025], [uc - hu, wc, 0.025, hw], [uc + hu, wc, 0.025, hw]]) { const [x, y, z] = R.P(u, w); lada3(VD, [x, y + 0.04, z], R.ax(0), [a, 0.045, b], KB); }
  };
  const kruka = (p, f) => { ror(VD, [[p[0], p[1], p[2], 0.15], [p[0], p[1] + 0.34, p[2], 0.2], [p[0], p[1] + 0.32, p[2], 0.17]], 7, UG, 1, () => [0.55, 0.26, 0.14]); planta('blomma', p[0], p[2], 0.45 + r() * 0.2, f); };
  function radhus(v, sd, s, n, rmax) {
    const typ = RADTYP, RF = RADFARG[r() * RADFARG.length | 0], q = sd * (GHW + GTR + 5 + typ.W / 2), hsv = v.c + q, Ltot = n * typ.L;
    const R = ram(hsv, s, -sd, 0), [hx, hz] = R.o, dist = Math.hypot(hx, hz);
    if (dist > rmax) return false;
    const hor = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => R.svlat(a * (Ltot / 2 + 1), b * (typ.W / 2 + 1.5)));
    if (!hor.every(([a, b]) => ledig(a, b, 1) && !iGata(a, b, 0.3))) return false;
    const hy0 = Math.min(...hor.map(([a, b]) => hy(...pt(a, b)))), nara = dist < 100, F = typ.W / 2, lok = (lx, lz) => R.svlat(lx, lz);
    const plank = TRAF[r() * TRAF.length | 0], dX = R.X;
    for (let k = 0; k < n; k++) {
      const u = -Ltot / 2 + typ.L * (k + 0.5), [x, , z] = R.P(u, 0), sp = k % 2 === 1, ud = u + (sp ? 1.5 : -1.5);   // dörrens läge längs längan
      const farg = [C(RF[0][k % 2]).multiplyScalar(0.97 + 0.06 * r()).toArray(), C(RF[1]).toArray(), C(RF[2]).toArray(), RF[3]];
      // grannarnas husbyggare: riktiga 3D-fönster (karm, båge, spröjs, bleck), dörr med skärmtak, altandörr mot uteplatsen,
      // takfot, vindskivor, hängrännor, stuprör och sockel. Varannan lägenhet speglad, så att entréerna kommer parvis.
      const ut = grannBygg(BD, { ...typ, he: typ.he + (k % 2) * 0.14 }, x, hy0, z, R.ry, farg, r(), sp, { nara, altandorr: true, racke: false });
      if (r() < 0.12 && ROK.length < 5) ROK.push(ut.tw((sp ? -1 : 1) * typ.L * 0.22, ut.yR + ut.T + 0.9, -0.65));
      // entrén: lampa vid dörren, plattgång till trottoaren, brevlåda, kruka och ibland en cykel
      N.glod.push([ut.dorr[0], ut.dorr[1] + 0.12, ut.dorr[2], 0.3, 0, ...VARMT, 0.25 + r() * 0.3]);
      lagg(TS, ting('entre'), ut.dorr[0], ut.dorr[1], ut.dorr[2], 1, 0, 8, 0, ETT, 0.25);
      { const [a0, b0] = lok(ud, F + 0.7), [a1, b1] = lok(ud, F + 5.2); yta(a0, b0, a1, b1, 1.1, 0.03, [2.1, 2.05, 1.95], 1); }
      { const [mx, my, mz] = R.P(ud + (sp ? 0.9 : -0.9), F + 4.9); lagg(TS, ting('brevlada'), mx, my, mz, 1, R.ry + Math.PI / 2, 8, 0); }
      if (nara) {
        kruka(R.P(ud + (sp ? -0.85 : 0.85), F + 0.95), [[1.05, 0.45, 0.5], [1.0, 0.92, 0.5], [0.75, 0.55, 1.0]][k % 3]);
        if (r() < 0.45) cykelVD(R.P(ud + (sp ? -2.2 : 2.2), F + 1.0), dX, [[0.1, 0.25, 0.45], [0.55, 0.08, 0.06], [0.08, 0.08, 0.09], [0.7, 0.7, 0.68]][r() * 4 | 0]);
      }
      // låg häck mellan förgårdarna (3D-häck nära, enkel låda längre bort)
      if (k < n - 1) { if (nara) hack(1, lok, u + typ.L / 2, F + 0.6, u + typ.L / 2, F + 4.6); else { const [hx2, hy2, hz2] = R.P(u + typ.L / 2, F + 2.6); lada3(VD, [hx2, hy2 + 0.5, hz2], R.ax(0), [0.3, 0.5, 2.0], [0.04, 0.09, 0.03]); } }
      // baksidan: uteplats i trä, plank mot grannen, förråd längst ner på tomten, utemöbler och krukor
      { const [a0, b0] = lok(u + (sp ? -0.7 : 0.7), -F - 0.05), [a1, b1] = lok(u + (sp ? -0.7 : 0.7), -F - 3.1); void a0; void b0; void a1; void b1; dack(R, u + (sp ? -0.7 : 0.7), -F - 1.6, 2.2, 1.5); }
      if (k < n - 1) {
        const [px, py, pz] = R.P(u + typ.L / 2, -F - 1.7);
        // riktigt plank: stolpar, två reglar, stående brädor med springor (tunna kort åt båda håll) och en överliggare
        void px; void py; void pz;
        const A3 = R.ax(0), sd = A3[0];
        for (const w of [-1.65, 0, 1.65]) { const [qx, qy, qz] = R.P(u + typ.L / 2, -F - 1.7 + w); lada3(VD, [qx, qy + 0.92, qz], A3, [0.045, 0.94, 0.045], plank.map(c => c * 0.75)); }
        for (const yy of [0.35, 1.45]) { const [qx, qy, qz] = R.P(u + typ.L / 2, -F - 1.7); lada3(VD, [qx, qy + yy, qz], A3, [0.02, 0.035, 1.68], plank.map(c => c * 0.7)); }
        for (let j = 0; j < 27; j++) {
          const w = -1.6 + j * 0.123, [qx, qy, qz] = R.P(u + typ.L / 2 + 0.03, -F - 1.7 + w), ton = 0.88 + 0.2 * ((j * 37) % 7) / 7;
          for (const sg of [1, -1]) vkvad(VD, [qx, qy + 0.92, qz], A3[2].map(v => v * 0.052), [0, 0.88, 0], sd.map(v => v * sg), plank.map(c => c * ton));
        }
        { const [qx, qy, qz] = R.P(u + typ.L / 2, -F - 1.7); lada3(VD, [qx, qy + 1.84, qz], A3, [0.06, 0.025, 1.72], plank.map(c => c * 0.85)); }
      }
      {
        // förrådet: litet trähus med stående panel (läkt), pulpettak med utsprång, dörr mot huset och ett fönster
        const fu = u + (sp ? 1.6 : -1.6), [fx, fy, fz] = R.P(fu, -F - 8.2), A3 = R.ax(0), TR = plank.map(c => c * 0.9), at = (du, dw) => { const [a, b, c] = R.P(fu + du, -F - 8.2 + dw); return [a, b, c]; };
        lada3(VD, [fx, fy + 1.05, fz], A3, [0.95, 1.05, 0.85], TR);
        if (nara) for (let j = 0; j < 7; j++) for (const sw of [-1, 1]) { const p = at(-0.84 + j * 0.28, sw * 0.86); lada3(VD, [p[0], p[1] + 1.05, p[2]], A3, [0.018, 1.04, 0.012], TR.map(c => c * 0.78)); }
        const up = nrm([A3[2][0] * 0.16, 1, A3[2][2] * 0.16]);
        lada3(VD, [fx, fy + 2.2, fz], [A3[0], up, nrm(crs(A3[0], up))], [1.12, 0.045, 1.08], [0.07, 0.07, 0.075]);
        { const p = at(0.2, 0.86); lada3(VD, [p[0], p[1] + 0.95, p[2]], A3, [0.4, 0.88, 0.015], RF[1] === '#ffffff' ? [0.9, 0.9, 0.88] : C(RF[1]).toArray()); }
        { const p = at(0.3, -0.86); lada3(VD, [p[0], p[1] + 1.4, p[2]], A3, [0.3, 0.22, 0.02], [0.85, 0.85, 0.82]); lada3(VD, [p[0], p[1] + 1.4, p[2]], A3, [0.25, 0.17, 0.025], [0.05, 0.06, 0.07]); }
      }
      if (nara) {
        { const [tx, ty, tz] = R.P(u + (sp ? -0.9 : 0.9), -F - 1.9); lagg(TS, ting(k % 2 ? 'utegruppSvart' : 'utegrupp'), tx, ty + DACK_Y, tz, 1, R.ry, 8, 0); }   // bord och stolar med dynor
        kruka(R.P(u + (sp ? -2.6 : 2.6), -F - 2.8, 0.16), [[1.05, 0.5, 0.6], [1.0, 0.9, 0.4]][k % 2]);
      }
      if (r() < 0.35) { const [bx, by, bz] = R.P(u - (sp ? 1.2 : -1.2) * 0.2, F + 7.5); if (bilOk(bx, bz)) parkBil(bx, by, bz, R.ry + Math.PI / 2, BF[r() * BF.length | 0]); }
      if (r() < 0.6) { const [tx, , tz] = R.P(u + (sp ? -1.5 : 1.5), -F - 5.8 - r()); trad(r() < 0.5 ? 'frukt' : 'buske', tx, tz, 2.4 + r() * 1.2, 0); }
    }
    husR.push({ sv: hsv, lat: s, f: [-sd, 0], ax: [0, sd], L: Ltot, W: typ.W });
    return true;
  }

  // ---- grannetomten bakom vår tomt (mot bakgatan): ett lågt enplanshus som inte konkurrerar med vårt hus ----
  const LAGHUS = { L: 10.5, W: 7.0, he: 2.45, R: 1.15, dorr: 6.7, extra: 'trappa',
    fram: [[1.8, 0.95, 1.2, 1.1], [4.0, 0.95, 1.2, 1.1], [9.0, 0.95, 1.2, 1.1]], bak: [[2.0, 0.95, 1.2, 1.1], [5.3, 0.95, 2.0, 1.1], [8.6, 0.95, 1.2, 1.1]],
    gavel: [[2.2, 0.95, 1.1, 1.05], [5.0, 0.95, 1.1, 1.05]] };
  // när inget hus får plats bakom vår tomt: en liten kvartersfruktträdgård (allt lågt) med häck mot gatan och grind,
  // grusgångar, bänkar, rabatter, lekstuga och äppelträd i rader
  function fruktTradgard(T, gk) {
    const lc = (T.lat0 + T.lat1) / 2, sv0 = gk + 0.6, sv1 = T.svB - 1.4;
    if (sv1 - sv0 < 6) return;
    const sc = (sv0 + sv1) / 2, R = ram(sc, lc, -1, 0), HD = (sv1 - sv0) / 2;    // +w mot gatan, w ∈ [−HD, HD]
    // bredden: så långt det är ledigt åt båda hållen (högst 22 m)
    const fri2 = (u, w) => { const [a, b] = R.svlat(u, w); return ledig(a, b, 0.4) && a < T.svB - 1.2; };
    let U0 = 0, U1 = 0;
    for (let x = 0.5; x <= 22; x += 0.5) { if (![-HD + 0.3, 0, HD - 0.3].every(w => fri2(-x, w))) break; U0 = -x; }
    for (let x = 0.5; x <= 22; x += 0.5) { if (![-HD + 0.3, 0, HD - 0.3].every(w => fri2(x, w))) break; U1 = x; }
    if (U1 - U0 < 8) return;
    tradgardInnehall(R, U0, U1, HD, sc, lc);
    globalThis.__grannTomt = { tradgard: true, U0, U1, HD };
  }
  // tomma tomtplatser i kvarteret (siktgator där inget hus får stå): en låg trädgårdstomt i stället för tom gräsmatta
  function tomTomt(tm) {
    const T = H.VRAM && H.VRAM.tomt, Wt = 9.2, Wb = -11.0, wc = (Wt + Wb) / 2, HD = (Wt - Wb) / 2;
    const [sc, lc] = tm.lok(0, wc), R = ram(sc, lc, tm.f[0], tm.f[1]);
    const fri2 = (u, w) => { const [a, b] = R.svlat(u, w); return ledig(a, b, 0.4) && !(T && a > T.svB - 1.2 && a < T.svF + 1.2 && b > T.lat0 - 1.2 && b < T.lat1 + 1.2) && !RES.some(([c, d, rr]) => Math.hypot(a - c, b - d) < rr); };
    let U0 = 0, U1 = 0;
    for (let x = 0.5; x <= 12.5; x += 0.5) { if (![-HD + 0.3, 0, HD - 0.3].every(w => fri2(-x, w))) break; U0 = -x; }
    for (let x = 0.5; x <= 12.5; x += 0.5) { if (![-HD + 0.3, 0, HD - 0.3].every(w => fri2(x, w))) break; U1 = x; }
    if (U1 - U0 < 8) return false;
    tradgardInnehall(R, U0, U1, HD, sc, lc);
    return true;
  }
  // större tomma gräsytor nära vår tomt (som inte är tomtplatser): rutnät i kvarterets ram, fyll varje ledig 20 × 20 m-ruta
  // med en låg trädgårdstomt vänd mot närmaste gata. Inte i startvyns siktkil.
  function fyllLuckor() {
    const T = H.VRAM && H.VRAM.tomt, gator = vagar.filter(v => v.dir === 'lat');
    const fri2 = (a, b) => ledig(a, b, 0.6) && !(T && a > T.svB - 1.5 && a < T.svF + 1.5 && b > T.lat0 - 1.5 && b < T.lat1 + 1.5) && !RES.some(([c, d, rr]) => Math.hypot(a - c, b - d) < rr + 0.5);
    for (let sv = -40; sv <= 44; sv += 4) for (let lat = -48; lat <= 48; lat += 4) {
      const [x, z] = pt(sv, lat); if (Math.hypot(x, z) > 60 || (H.iSiktkil && H.iSiktkil(x, z, 4))) continue;
      let ok = true;
      for (let a = -9; a <= 9 && ok; a += 3) for (let b = -9; b <= 9 && ok; b += 3) if (!fri2(sv + a, lat + b)) ok = false;
      if (!ok) continue;
      const g = gator.reduce((m, v) => Math.abs(v.c - sv) < Math.abs(m.c - sv) ? v : m, gator[0]), fsv = Math.sign(g.c - sv) || 1;
      const R = ram(sv, lat, fsv, 0);
      tradgardInnehall(R, -9, 9, 9, sv, lat);
    }
  }
  function tradgardInnehall(R, U0, U1, HD, sc, lc) {
    const kil = (x, z) => H.iSiktkil && H.iSiktkil(x, z, 1);
    const um = (U0 + U1) / 2, lok = (u, w) => R.svlat(u, w), GRUS = [1.5, 1.38, 1.15], TRA = [0.42, 0.28, 0.16], VIT = [0.86, 0.86, 0.83];
    RES.push([sc, lc, Math.max(HD, (U1 - U0) / 2)]);
    // häck mot gatan med en öppning och grindstolpar; låg häck längs sidorna
    hack(1, lok, U0, HD - 0.2, um - 1.1, HD - 0.2); hack(1, lok, um + 1.1, HD - 0.2, U1, HD - 0.2);
    for (const sx of [-1, 1]) { const [x, y, z] = R.P(um + sx * 1.1, HD - 0.2); lada3(VD, [x, y + 0.6, z], R.ax(0), [0.07, 0.6, 0.07], VIT); }
    for (const xs of [U0, U1]) hack(1, lok, xs, HD - 0.8, xs, -HD + 0.5);
    // grusgång in från grinden och en tvärgång genom trädgården
    { const [a0, b0] = lok(um, HD), [a1, b1] = lok(um, -HD + 1.2); yta(a0, b0, a1, b1, 1.4, 0.03, GRUS, 6); }
    { const [a0, b0] = lok(U0 + 1, 0), [a1, b1] = lok(U1 - 1, 0); yta(a0, b0, a1, b1, 1.2, 0.03, GRUS, 6); }
    // äppel- och päronträd i rader (låga), rabatter längs mittgången, bänkar vid korsningen, lekstuga i ett hörn
    for (let u = U0 + 2.5; u < U1 - 1.5; u += 4.2) for (const w of [-HD * 0.55, HD * 0.5]) {
      if (Math.abs(u - um) < 2 || (Math.abs(u - (U1 - 2.6)) < 2.8 && w < 0)) continue;
      const [x, , z] = R.P(u + (r() - 0.5) * 0.6, w + (r() - 0.5) * 0.6); if (!kil(x, z)) trad('frukt', x, z, 2.8 + r() * 1.0, 2.0);
    }
    for (const sx of [-1, 1]) {
      const [a0, b0] = lok(um + sx * 1.2, HD - 1.5), [a1, b1] = lok(um + sx * 1.2, 1.2); yta(a0, b0, a1, b1, 0.8, 0.02, [0.5, 0.4, 0.31], 5);
      for (let w = 1.4; w < HD - 1.6; w += 0.5) { const [x, , z] = R.P(um + sx * 1.2, w); planta('blomma', x, z, 0.36 + r() * 0.14, [[1.05, 0.55, 0.62], [1.0, 0.95, 0.75], [0.78, 0.6, 1.0], [1.05, 0.42, 0.36]][(w * 2 | 0) % 4]); }
    }
    for (const [u, w, vr] of [[um - 2.4, -1.1, 0], [um + 2.4, -1.1, 0]]) {
      R.lada(u, w, 0.44, 0.85, 0.025, 0.22, TRA, vr); R.lada(u, w - 0.2, 0.72, 0.85, 0.12, 0.025, TRA, vr);
      for (const k of [-0.7, 0.7]) R.lada(u + k, w, 0.22, 0.03, 0.22, 0.2, [0.15, 0.15, 0.16], vr);
    }
    { const [x, y, z] = R.P(um + 3.6, -1.1); ror(VD, [[x, y, z, 0.03], [x, y + 0.85, z, 0.03]], 4, UG, 1, () => [0.2, 0.2, 0.21]); ror(VD, [[x, y + 0.45, z, 0.2], [x, y + 0.95, z, 0.2]], 8, UG, 1, () => [0.12, 0.3, 0.16]); }
    { const [x, y, z] = R.P(U1 - 2.6, -HD + 2.2); lagg(TS, ting('lekstuga'), x, y, z, 1, R.ry + Math.PI, 8, 0); }
    if (U1 - U0 > 16) { const [x, y, z] = R.P(U0 + 3.2, -HD + 2.6); lagg(TS, ting('studsmatta'), x, y, z, 1, 0, 8, 0); }
    // ängsblommor och högre gräs längs häcken
    for (let u = U0 + 0.6; u < U1 - 0.4; u += 0.7) { const [x, , z] = R.P(u, -HD + 0.4 + r() * 0.5); if (r() < 0.6) planta('gras', x, z, 0.4 + r() * 0.3, [0.66, 0.7, 0.42]); else planta('blomma', x, z, 0.35, [1.0, 1.0, 0.92]); }
  }

  function grannTomt() {
    const T = H.VRAM && H.VRAM.tomt, M = H.mal; if (!T || !M || !M.dorr) return;
    const typ = LAGHUS, F = typ.W / 2, gk = BAK + GHW + GTR, hsv = gk + 5.2 + F, ZF = F + 4.6;
    // startvyns kamera (som entreVy i husritare.js): 22° från entréns normal åt altanens sida. Huset läggs rakt bakom vårt
    // hus sett därifrån, så att vårt hus skymmer det låga huset i startvyn; annars byggs ingen grannetomt alls.
    const dn = [M.dorr.nx, M.dorr.nz], du = [-M.dorr.nz, M.dorr.nx], D = M.dack;
    const sA = D ? Math.sign(((D.x0 + D.x1) / 2 - M.dorr.x) * du[0] + ((D.z0 + D.z1) / 2 - M.dorr.z) * du[1]) || 1 : 1, v22 = 22 * Math.PI / 180;
    const kam = nrm([dn[0] * Math.cos(v22) + du[0] * sA * Math.sin(v22), 0, dn[1] * Math.cos(v22) + du[1] * sA * Math.sin(v22)]);
    // kandidater längs bakgatan: hela tomten ledig, bakom vår tomtgräns, inte framför vårt hus (startvyns och helskärmens
    // kil mot entrén); bäst rakt bakom huset sett från entrén, där vårt eget hus skymmer det låga huset
    let bast = null;
    for (let d = 0; d <= 40; d += 0.5) for (const sg of d ? [1, -1] : [1]) {
      const lat = (T.lat0 + T.lat1) / 2 + sg * d, R = ram(hsv, lat, -1, 0), XL = -(typ.L / 2 + 4.5), XR = typ.L / 2 + 4.5;
      const bakre = -(Math.min(T.svB - 1.6, hsv + F + 9) - hsv);       // trädgården bakåt (−w) till strax före vårt staket
      if (bakre > -F - 3) continue;
      const prov = [];
      for (const u of [XL, 0, XR]) for (const w of [ZF - 0.3, F, 0, -F, bakre + 0.3]) prov.push([u, w]);
      const ok = prov.every(([u, w]) => { const [a, b] = R.svlat(u, w); return ledig(a, b, 0.4) && a < T.svB - 1.2; });
      if (!ok) continue;
      const [x, z] = R.o, l = Math.hypot(x, z) || 1, bak = -(x * kam[0] + z * kam[2]) / l;   // 1 = rakt bakom vårt hus från kameran
      if (bak < Math.cos(4 * Math.PI / 180)) continue;
      const poang = -bak;
      if (!bast || poang < bast.poang) bast = { R, lat, poang, bakre, XL, XR };
    }
    if (!bast) { fruktTradgard(T, gk); return; }
    const { R, lat, bakre } = bast, fg = GRANNFARG[(r() * GRANNFARG.length) | 0], spegel = r() < 0.5, sp = spegel ? -1 : 1;
    // tomten breddas åt det håll där gräsytan bakom vår tomt ligger (mot vår tomts mitt), så långt det är ledigt
    const si = Math.sign((R.svlat(1, 0)[1] - lat) * ((T.lat0 + T.lat1) / 2 - lat)) || 1;
    let XI = typ.L / 2 + 4.5;
    for (let x = XI + 0.5; x <= 26; x += 0.5) { if (![ZF - 0.3, 0, bakre + 0.3].every(w => { const [a, b] = R.svlat(si * x, w); return ledig(a, b, 0.4) && a < T.svB - 1.2; })) break; XI = x; }
    const XL = si > 0 ? -(typ.L / 2 + 4.5) : -XI, XR = si > 0 ? XI : typ.L / 2 + 4.5, BRED = XI - (typ.L / 2 + 4.5);
    const farg = [C(fg[0]).toArray(), C(fg[1]).toArray(), C(fg[2]).toArray(), fg[3]], [hx, hz] = R.o;
    const hy0 = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => R.P(a * typ.L / 2, b * F)[1]));
    const ut = grannBygg(BD, typ, hx, hy0, hz, R.ry, farg, r(), spegel, { nara: true, racke: true, altandorr: true, sol: r() < 0.4 });
    husR.push({ sv: hsv, lat, f: [-1, 0], ax: [0, 1], L: typ.L, W: typ.W });
    RES.push([hsv + 2, lat, 12]);
    N.glod.push([ut.dorr[0], ut.dorr[1] + 0.12, ut.dorr[2], 0.3, 0, ...VARMT, 0.3]);
    lagg(TS, ting('entre'), ut.dorr[0], ut.dorr[1], ut.dorr[2], 1, 0, 8, 0, ETT, 0.3);
    const lok = (u, w) => R.svlat(u, w), xd = -typ.L / 2 + (spegel ? typ.L - typ.dorr : typ.dorr), ux = -sp * (typ.L / 2 - 1.4);
    const VIT = [0.86, 0.86, 0.83];
    // uppfart vid ena gaveln, brevlåda, häck mot gatan med grind och plattgång till trappan
    { const [a0, b0] = lok(ux, F + 0.1), [a1, b1] = lok(ux, ZF + 0.9); uppfarter.push([a0, b0, a1, b1, 3]); }
    { const [mx, my, mz] = R.P(ux - sp * 2.0, ZF + 0.5); lagg(TS, ting('brevlada'), mx, my, mz, 1, R.ry + Math.PI / 2, 8, 0); }
    let iv = [[XL, XR]];
    [[ux - 1.9, ux + 1.9], [xd - 0.65, xd + 0.65]].forEach(([g0, g1]) => { iv = iv.flatMap(([a, b]) => b <= g0 || a >= g1 ? [[a, b]] : [[a, g0], [g1, b]].filter(([p, q]) => q - p > 0.5)); });
    iv.forEach(([a, b]) => hack(1, lok, a, ZF, b, ZF));
    for (const sx of [-1, 1]) { const [x, y, z] = R.P(xd + sx * 0.7, ZF); lada3(VD, [x, y + 0.6, z], R.ax(0), [0.06, 0.6, 0.06], VIT); }
    {  // öppet grindblad
      const vr = -1.1, gu = xd - 0.7, at = t => R.P(gu + Math.cos(vr) * t, ZF + Math.sin(vr) * t);
      for (const yy of [0.25, 0.75]) { const [x, y, z] = at(0.6); lada3(VD, [x, y + yy, z], R.ax(vr), [0.58, 0.03, 0.015], VIT); }
      for (let j = 0; j < 5; j++) { const [x, y, z] = at(0.12 + j * 0.24); lada3(VD, [x, y + 0.5, z], R.ax(vr), [0.03, 0.42, 0.012], VIT); }
    }
    { const [a0, b0] = lok(xd, ZF + 0.6), [a1, b1] = lok(xd, F + 1.35); yta(a0, b0, a1, b1, 1.2, 0.035, [2.2, 2.15, 2.05], 1); }
    // häck även längs sidorna mot grannarna (inte mot vår tomt: där står vårt staket)
    for (const xs of [XL, XR]) hack(0, lok, xs, ZF - 0.5, xs, bakre + 0.5);
    // rabatt längs framsidan med perenner och buskar
    for (const [a, b] of [[-typ.L / 2 + 0.3, xd - 1.0], [xd + 1.0, typ.L / 2 - 0.3]]) {
      if (b - a < 1) continue;
      const [a0, b0] = lok(a, F + 0.55), [a1, b1] = lok(b, F + 0.55); yta(a0, b0, a1, b1, 0.8, 0.02, [0.5, 0.4, 0.31], 5);
      for (let u = a + 0.3, k = 0; u < b - 0.2; u += 0.55, k++) { const [x, , z] = R.P(u, F + 0.5); if (k % 4 === 2) trad('buske', x, z, 0.6, 0); else planta('blomma', x, z, 0.36 + r() * 0.14, [[1.05, 0.55, 0.62], [1.0, 0.95, 0.75], [0.78, 0.6, 1.0], [1.05, 0.42, 0.36]][k % 4]); }
    }
    // uteplats i trä på baksidan med bord, stolar och parasoll
    const uc = sp * typ.L * 0.12, wb = -F - 1.3;
    dack(R, uc, wb, 2.2, 1.3);
    {
      const [tx, ty, tz] = R.P(uc + 0.5, wb - 0.1), Y = ty + DACK_Y;
      lagg(TS, ting('utegrupp'), tx, Y, tz, 1, R.ry, 8, 0);   // bord, stolar och dynor
      ror(VD, [[tx, Y, tz, 0.022], [tx, Y + 2.4, tz, 0.018]], 5, UG, 1, () => [0.75, 0.75, 0.73]);
      ror(VD, [[tx, Y + 2.4, tz, 0.03], [tx, Y + 2.1, tz, 1.3], [tx, Y + 2.06, tz, 1.3]], 10, UG, 1, () => [0.22, 0.36, 0.26]);
    }
    // fruktträd, studsmatta eller lekstuga, cykel vid entrén och buskar i hörnen
    for (const [u, w] of [[-sp * 4.2, bakre + 1.6], [sp * (typ.L / 2 + 2.4), bakre + 1.8]]) { const [x, , z] = R.P(u, w); trad('frukt', x, z, 3.0 + r() * 0.8, 2.0); }
    { const [x, y, z] = R.P(-sp * (typ.L / 2 + 2.3), -0.6); r(); lagg(TS, ting('lekstuga'), x, y, z, 1, R.ry + Math.PI / 2, 8, 0); }   // lekstugan i sidotomten, studsmattan på den breda sidan
    cykelVD(R.P(xd + sp * 1.5, F + 1.6), R.X, [0.1, 0.25, 0.45]);
    { const [x, , z] = R.P(XR - 1.2, bakre + 1.2); trad('buske', x, z, 1.6, 0); const [x2, , z2] = R.P(XL + 1.2, bakre + 1.0); trad('buske', x2, z2, 1.4, 0); }
    // den breda sidotomten: studsmatta, lekstuga, odlingslådor, äppelträd, flaggstång och en rabatt mot gatan
    if (BRED > 5) {
      const uI = si * (typ.L / 2 + 4.5 + BRED * 0.5), at = (k, w) => R.P(uI + si * k, w);
      { const [x, y, z] = at(-BRED * 0.2, -1.5); lagg(TS, ting('studsmatta'), x, y, z, 1, 0, 8, 0); }
      for (const k of [-0.9, 0.9]) {
        const [x, y, z] = at(BRED * 0.25 + k, ZF - 3.2), A3 = R.ax(0);
        lada3(VD, [x, y + 0.2, z], A3, [0.4, 0.2, 0.9], [0.34, 0.24, 0.15]); lada3(VD, [x, y + 0.38, z], A3, [0.36, 0.03, 0.86], [0.12, 0.09, 0.07]);
        for (let j = 0; j < 4; j++) { const [px, , pz] = at(BRED * 0.25 + k, ZF - 3.2 - 0.6 + j * 0.4); planta('gras', px, pz, 0.32, [0.55, 0.85, 0.4]); }
      }
      for (const [k, w] of [[-BRED * 0.35, bakre + 2.0], [BRED * 0.05, bakre + 1.6]]) { const [x, , z] = at(k, w); trad('frukt', x, z, 3.0 + r() * 0.8, 2.0); }
      { const [x, y, z] = at(BRED * 0.4, ZF - 1.6); lagg(TS, ting('flagga'), x, y, z, 1, Math.atan2(-0.33, 0.94), 8, 0.002); }
      for (let k = -BRED / 2 + 0.8; k < BRED / 2 - 0.5; k += 0.6) { const [x, , z] = at(k, ZF - 0.8); planta('blomma', x, z, 0.35 + r() * 0.12, [[1.05, 0.55, 0.62], [1.0, 0.95, 0.75], [0.78, 0.6, 1.0]][(k * 3 | 0) % 3 < 0 ? 0 : (k * 3 | 0) % 3]); }
    }
    globalThis.__grannTomt = { lat, hsv, bakre, svB: T.svB, BRED };
  }

  // ---- bygg(): gator, hus, parkstråket, liv och bakgrund ----
  function bygg() {
    grannTomt();
    fyllLuckor();
    // nya gator: en parallell gata bortom parken (+sv) och en bakom bakgatans kvarter (−sv)
    const FRAM = 98, BAKRE = BAK - 58;
    const nyF = { dir: 'lat', c: FRAM, a0: -150, a1: 150, linje: true }, nyB = { dir: 'lat', c: BAKRE, a0: -150, a1: 150 };
    vagar.push(nyF, nyB);
    // hus längs dem: villor och några radhuslängor; bortre raden bara där den hinner före skogsbrynet
    for (const [v, sd, rmax] of [[nyF, -1, 122], [nyF, 1, 120], [nyB, 1, 122], [nyB, -1, 118]]) {
      let s = v.a0 + 6 + r() * 6;
      while (s < v.a1) {
        if (r() < 0.3 && radhus(v, sd, s + 16, 5, rmax)) { s += 40; continue; }
        if (villa(v, sd, s, rmax)) s += 24 + r() * 4; else s += 8;
      }
    }
    // gatlyktor och trädallé längs den nya främre gatan, parkerade bilar vid trottoaren
    for (let l = -100; l <= 100; l += 28) { const sv = FRAM - GHW - GTR + 0.5; if (Math.hypot(...pt(sv, l)) < 125) lykta(sv, l, 1, 0); }
    for (let l = -90; l <= 90; l += 30) { const sv = BAKRE + GHW + GTR - 0.5; if (Math.hypot(...pt(sv, l)) < 125) lykta(sv, l, -1, 0); }
    for (let l = -110; l <= 110; l += 13) {
      const sv = FRAM + GHW + GTR - 0.8, [x, z] = pt(sv, l);
      if (Math.hypot(x, z) < 124 && !uppfarter.some(([, , c2, d2]) => Math.hypot(c2 - sv, d2 - l) < 4)) trad(((l / 13) | 0) % 2 ? 'bjork' : 'ek', x, z, 9 + r() * 2, 0);
    }
    for (let l = -80; l <= 80; l += 19) {
      if (r() < 0.45) continue;
      const sv = FRAM - GHW + 1.0, [x, z] = pt(sv, l + r() * 4);
      if (uppfarter.some(([, , c2, d2]) => Math.abs(c2 - sv) < 9 && Math.abs(d2 - l) < 4)) continue;
      if (bilOk(x, z)) parkBil(x, hy(x, z), z, ryMot(0, 1), BF[r() * BF.length | 0]);   // (BF: slumpen dras som förr, så att kvarteret står kvar)
    }
    // busshållplats och återvinningsstation vid den nya gatan
    { const [x, z] = pt(FRAM - GHW - GTR + 0.9, 30); lagg(TS, ting('kur'), x, hy(x, z), z, 1, ryMot(1, 0), 8, 0); const [x2, z2] = pt(FRAM - GHW - 0.5, 26.5); lagg(TS, ting('hallplats'), x2, hy(x2, z2), z2, 1, ryMot(1, 0), 8, 0);
      // någon väntar på bussen och pratar i telefon (husritare-folk.js)
      if (!siktkil(...pt(FRAM - GHW - GTR / 2, 27.8), 1)) FOLK.push({ t: 'sta', p: pt(FRAM - GHW - GTR / 2, 27.8), dir: [VN[0] + VT[0] * 0.3, VN[2] + VT[2] * 0.3], typ: 0, pal: 3, klipp: 'tel' }); }
    {
      // återvinning: plattan och fyra containrar (glas, papper, plast, metall)
      let lat0 = null; for (const l of [-46, -20, 58, 6, -70]) if (ledig(FRAM - GHW - GTR - 5, l, 4) && ledig(FRAM - GHW - GTR - 5, l + 7, 4)) { lat0 = l; break; }
      if (lat0 !== null) {
        RES.push([FRAM - GHW - GTR - 4.5, lat0 + 3.5, 7]);
        const R = ram(FRAM - GHW - GTR - 4.5, lat0 + 3.5, 1, 0);
        { const [a0, b0] = R.svlat(-5, 0), [a1, b1] = R.svlat(5, 0); yta(a0, b0, a1, b1, 4.5, 0.04, [1.7, 1.7, 1.68], 0); }
        [[0.1, 0.38, 0.18], [0.1, 0.24, 0.55], [0.85, 0.62, 0.1], [0.45, 0.46, 0.48]].forEach((f, k) => {
          const u = -3.6 + k * 2.4; R.lada(u, -0.4, 0.8, 1.0, 0.8, 0.85, f); R.lada(u, -0.4, 1.68, 0.95, 0.08, 0.8, f.map(v => v * 0.8));
          R.lada(u, 0.47, 1.25, 0.25, 0.08, 0.02, [0.05, 0.05, 0.05]);
        });
        const [hx, , hz] = R.P(-6.5, -2.0); trad('buske', hx, hz, 1.3, 0); const [hx2, , hz2] = R.P(6.5, -2.0); trad('buske', hx2, hz2, 1.4, 0);
      }
    }
    // ---- parkstråket mellan kvarteren (sv ≈ 44–68): gång- och cykelväg, lyktor, bollplan, damm, dungar, äng ----
    const PS = 64.5, lekLat = LEK ? LEK.tm.hlat : 0;
    { const [x0, z0] = pt(PS, -125), [x1, z1] = pt(PS, 125); void x0; void z0; void x1; void z1;
      let iv = [], a = null; for (let l = -125; l <= 125; l += 5) { const ok = Math.hypot(...pt(PS, l)) < 128 && ledig(PS, l, 1.5); if (ok && a === null) a = l; if ((!ok || l + 5 > 125) && a !== null) { iv.push([a, ok ? l : l - 5]); a = null; } }
      iv.filter(([a0, a1]) => a1 - a0 > 8).forEach(([a0, a1]) => { yta(PS, a0, PS, a1, 3.0, 0.035, [0.86, 0.86, 0.86], 8); for (let l = a0 + 6; l < a1 - 3; l += 24) lykta(PS + 2.1, l, -1, 0); }); }
    // gången från lekplatsens bakre grind till parkvägen
    if (LEK) {
      const G = [1.5, 1.38, 1.15], S = (u, w) => LEK.R.svlat(u, w), seg = (p, q) => yta(...S(...p), ...S(...q), 2.0, 0.033, G, 6);
      seg([6.5, -10.2], [6.5, -14.6]); seg([-3, -14.6], [17.4, -14.6]); seg([17.4, -14.6], [17.4, -31]);
      const [c0, d0] = S(17.4, -31); yta(c0, d0, PS, d0, 2.0, 0.033, G, 6);
    }
    // bollplan (grus) med mål, på den sida av lekplatsen där det finns plats
    for (const sx of [1, -1]) {
      const lc = lekLat + sx * 46, sc = 54;
      const R = ram(sc, lc, 1, 0);
      const ledigt = [[-17, -8.5], [17, -8.5], [-17, 8.5], [17, 8.5], [0, 0]].every(([u, w]) => { const [a, b] = R.svlat(u, w); return fri(a, b, 0.5) && Math.hypot(...pt(a, b)) < 120; });
      if (!ledigt) continue;
      RES.push([sc, lc, 19]);
      { const [a0, b0] = R.svlat(-16.5, 0), [a1, b1] = R.svlat(16.5, 0); yta(a0, b0, a1, b1, 17, 0.03, [1.45, 1.22, 0.95], 6); }
      const y0 = R.P(0, 0)[1] + 0.035, VIT = [1.5, 1.5, 1.45];
      const lin = (u0, w0, u1, w1) => { const L = Math.hypot(u1 - u0, w1 - w0) / 2, vr = Math.atan2(w1 - w0, u1 - u0); R.kvadF((u0 + u1) / 2, (w0 + w1) / 2, y0 + 0.004, L + 0.05, 0.05, VIT, vr); };
      lin(-15.5, -7.5, 15.5, -7.5); lin(-15.5, 7.5, 15.5, 7.5); lin(-15.5, -7.5, -15.5, 7.5); lin(15.5, -7.5, 15.5, 7.5); lin(0, -7.5, 0, 7.5);
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, b = (k + 1) / 16 * 6.283; lin(Math.cos(a) * 2.6, Math.sin(a) * 2.6, Math.cos(b) * 2.6, Math.sin(b) * 2.6); }
      for (const s of [-1, 1]) {
        const gu = s * 15.5;
        for (const w of [-1.5, 1.5]) R.rorL([[gu, w, 0], [gu, w, 1.55]], 0.05, VIT.map(v => v * 0.6), 6);
        R.rorL([[gu, -1.5, 1.55], [gu, 1.5, 1.55]], 0.05, VIT.map(v => v * 0.6), 6);
        for (const w of [-1.5, 1.5]) R.rorL([[gu, w, 1.55], [gu + s * 1.0, w, 0.02]], 0.015, [0.5, 0.5, 0.5], 3);
        R.lada(gu + s * 0.55, 0, 0.9, 0.004, 0.75, 1.45, [0.35, 0.36, 0.36], s * 0.55 * 0);
      }
      // två barn som springer på planen
      { const p0 = R.P(-10, -2), p1 = R.P(9, 3); folk({ t: 'ga', bana: [[p0[0], p0[2]], [p1[0], p1[2]]], klipp: 'jogg', typ: 5, pal: 2, prio: 2 }, { troja: 1 }); }
      { const p0 = R.P(8, -4), p1 = R.P(-6, 2); folk({ t: 'ga', bana: [[p0[0], p0[2]], [p1[0], p1[2]]], klipp: 'jogg', typ: 6, pal: 3, prio: 2 }, { troja: 1 }); }
      break;
    }
    // damm med vass och ankor på andra sidan
    {
      let D = null;
      for (const sx of [-1, 1]) { const lc = lekLat + sx * 44, sc = 52; const ok = [[0, 0], [11, 0], [-11, 0], [0, 7], [0, -7]].every(([a, b]) => fri(sc + b, lc + a, 1.5) && Math.hypot(...pt(sc + b, lc + a)) < 120); if (ok) { D = [sc, lc]; if (sx === -1) break; } }
      if (D) {
        RES.push([D[0], D[1], 12.5]); husR.push({ sv: D[0], lat: D[1], f: [1, 0], ax: [0, 1], L: 2 * 9.5 * 1.1, W: 2 * 6.2 * 1.1 });
        const [cx, cz] = pt(D[0], D[1]), y0 = hy(cx, cz) + 0.02, RA = 9.5, RB = 6.2, Dn = varld(1, 0), Dt = varld(0, 1);
        const e = (a, k) => [cx + (Dt[0] * Math.cos(a) * RA + Dn[0] * Math.sin(a) * RB) * k, cz + (Dt[2] * Math.cos(a) * RA + Dn[2] * Math.sin(a) * RB) * k];
        const k0 = VD.P.length / 3, NS = 28;
        H.hp(VD, cx, y0 + 0.02, cz, 0, 1, 0, 0.83, 0.5, [0.035, 0.06, 0.06]);
        for (let j = 0; j < NS; j++) { const a = j / NS * 6.283, wob = 1 + 0.08 * Math.sin(a * 3 + 1); const [x, z] = e(a, wob); H.hp(VD, x, y0 + 0.02, z, 0, 1, 0, 0.83, 0.5, [0.07, 0.1, 0.08]); }
        for (let j = 0; j < NS; j++) { const a = k0 + 1 + j, b = k0 + 1 + (j + 1) % NS; VD.I.push(k0, b, a, k0, a, b); }
        // strandkant: grus och stenar, vass (högt gräs) och en brygga med bänk
        for (let j = 0; j < NS; j++) {
          const a = j / NS * 6.283, wob = 1 + 0.08 * Math.sin(a * 3 + 1), [x, z] = e(a, wob * 1.04);
          lada3(VD, [x, y0 + 0.05, z], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.25 + r() * 0.2, 0.08, 0.2 + r() * 0.2], [0.36, 0.35, 0.33].map(v => v * (0.8 + r() * 0.4)));
          if (Math.sin(a * 2 + 0.5) > -0.2) for (let k = 0; k < 4; k++) { const [px, pz] = e(a + (r() - 0.5) * 0.2, wob * (1.06 + r() * 0.12)); planta('gras', px, pz, 0.9 + r() * 0.7, [0.6, 0.66, 0.36]); }
          else if (r() < 0.5) { const [px, pz] = e(a, wob * 1.15); planta('blomma', px, pz, 0.5, [1.0, 0.9, 0.5]); }
        }
        { const [x, z] = e(-Math.PI / 2, 1.25); trad('bjork', x, z, 14, 0); const [x2, z2] = e(Math.PI * 0.8, 1.35); trad('bjork', x2, z2, 12, 0); const [x3, z3] = e(0.3, 1.4); trad('ek', x3, z3, 11, 0); }
        // ankor som simmar runt
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1, [x, z] = e(a, 0.6), an = { piv: [cx, y0, cz, 2], ro: [0, 1, 0, 0], fa: [0, 0.12 + k * 0.02, 0, 0] };
          const tang = nrm([-(z - cz), 0, x - cx]), sd = crs(UPP, tang), AX = [sd, UPP, tang];
          aLada([x, y0 + 0.1, z], AX, [0.09, 0.07, 0.18], [0.42, 0.34, 0.22], an); aLada([x + tang[0] * 0.15, y0 + 0.24, z + tang[2] * 0.15], AX, [0.05, 0.06, 0.06], k ? [0.08, 0.3, 0.14] : [0.4, 0.32, 0.2], an);
          aLada([x + tang[0] * 0.23, y0 + 0.22, z + tang[2] * 0.23], AX, [0.025, 0.015, 0.04], [0.85, 0.55, 0.1], an);
        }
      }
    }
    // dungar av björk, ek och tall i olika storlekar, buskage och äng med blommor i parkens kanter
    {
      let ok = 0;
      for (let f = 0; f < 400 && ok < 34; f++) {
        const sv = 44 + r() * 24, lat = (r() - 0.5) * 230, [x, z] = pt(sv, lat);
        if (Math.hypot(x, z) > 122 || !fri(sv, lat, 3) || Math.abs(sv - PS) < 3 || (LEK && Math.abs(lat - lekLat) < 22)) continue;
        ok++;
        const typ = r(), n = 2 + (r() * 4 | 0);
        for (let k = 0; k < n; k++) {
          const a = r() * 6.283, dd = k ? 2 + r() * 4 : 0, sx = sv + Math.cos(a) * dd, sl = lat + Math.sin(a) * dd;
          if (!fri(sx, sl, 2) || Math.abs(sx - PS) < 3) continue;
          const [tx, tz] = pt(sx, sl);
          if (typ < 0.45) trad('bjork', tx, tz, 8 + r() * 9, 0); else if (typ < 0.75) trad('ek', tx, tz, 6 + r() * 8, 0); else trad(r() < 0.6 ? 'tall0' : 'gran1', tx, tz, 0, 0);
        }
        if (r() < 0.5) for (let k = 0; k < 2; k++) { const [bx, bz] = pt(sv + (r() - 0.5) * 6, lat + (r() - 0.5) * 6); if (fri(sv, lat, 1)) trad('buske', bx, bz, 1 + r() * 0.8, 0); }
      }
      // ängsmark: högre gräs och blommor (prästkrage, blåklint, smörblomma) i fläckar längs parkens kanter
      const BL = [[1.0, 1.0, 0.92], [0.55, 0.6, 1.1], [1.1, 0.95, 0.35], [1.05, 0.55, 0.7]];
      for (let f = 0, n = 0; f < 3000 && n < 420; f++) {
        const sv = 43 + r() * 26, lat = (r() - 0.5) * 220, [x, z] = pt(sv, lat);
        if (Math.hypot(x, z) > 115 || Math.sin(lat * 0.11 + sv * 0.3) < 0.2 || !fri(sv, lat, 0.6) || Math.abs(sv - PS) < 2.2 || (LEK && Math.abs(lat - lekLat) < 20 && sv < 64)) continue;
        n++;
        if (r() < 0.55) planta('gras', x, z, 0.4 + r() * 0.35, [0.68, 0.7, 0.42]); else planta('blomma', x, z, 0.32 + r() * 0.2, BL[r() * BL.length | 0]);
      }
      // parkbänkar med papperskorg längs gången och buskage i grupper
      for (let l = -100; l <= 100; l += 31) {
        const sv = PS - 2.4, [x, z] = pt(sv, l); if (Math.hypot(x, z) > 118 || !fri(sv, l, 1.2)) continue;
        const R = ram(sv, l, 1, 0); R.lada(0, 0, 0.44, 0.85, 0.025, 0.22, [0.42, 0.28, 0.16]); R.lada(0, -0.2, 0.72, 0.85, 0.12, 0.025, [0.42, 0.28, 0.16]);
        for (const k of [-0.7, 0.7]) R.lada(k, 0, 0.22, 0.03, 0.22, 0.2, [0.15, 0.15, 0.16]);
        R.rorL([[1.4, 0, 0], [1.4, 0, 0.85]], 0.03, [0.2, 0.2, 0.21]); R.rorL([[1.4, 0, 0.45], [1.4, 0, 0.95]], 0.2, [0.12, 0.3, 0.16], 8);
      }
      for (let f = 0, n = 0; f < 300 && n < 22; f++) {
        const sv = 44 + r() * 22, lat = (r() - 0.5) * 200, [x, z] = pt(sv, lat);
        if (Math.hypot(x, z) > 100 || !fri(sv, lat, 2) || Math.abs(sv - PS) < 3) continue;
        n++; for (let k = 0; k < 3; k++) { const [bx, bz] = pt(sv + (r() - 0.5) * 3, lat + (r() - 0.5) * 3); trad('buske', bx, bz, 1.0 + r() * 1.0, 0); }
      }
      // dungar även bakom det bakre kvarteret och utspridda träd mellan tomterna
      for (let f = 0, n = 0; f < 300 && n < 40; f++) {
        const sv = BAKRE - 30 + r() * 120 * (r() < 0.5 ? 0 : 1) + r() * 8, lat = (r() - 0.5) * 240, [x, z] = pt(sv, lat), d = Math.hypot(x, z);
        if (d < 78 || d > 125 || !fri(sv, lat, 3)) continue;
        n++; const q = r(); trad(q < 0.4 ? 'bjork' : q < 0.7 ? 'ek' : 'tall0', x, z, q < 0.4 ? 9 + r() * 8 : 7 + r() * 7, 0);
      }
    }
    // ---- liv på gatorna: hundägare, en som går, cyklister ----
    const gaPa = (sv, l0, l1, s, sp, fas, extra, typ = 2) => {
      if (extra !== 'cykel') {
        // inga människor i siktkilen mot vårt hus: den längsta biten av sträckan utanför kilen (minst 8 m)
        const sg = Math.sign(l1 - l0) || 1, bit = []; let a = null, bast = null;
        for (let l = l0; sg * (l1 - l) >= 0; l += sg) {
          const ok = !siktkil(...pt(sv, l), 2.0);
          if (ok && a === null) a = l;
          if ((!ok || sg * (l1 - l - sg) < 0) && a !== null) { const b = ok ? l : l - sg; bit.push([a, b]); a = null; }
        }
        bit.forEach(([a0, b0]) => { if (!bast || Math.abs(b0 - a0) > Math.abs(bast[1] - bast[0])) bast = [a0, b0]; });
        if (!bast || Math.abs(bast[1] - bast[0]) < 8) { folkUt(); return; }
        [l0, l1] = bast;
      }
      const [x0, z0] = pt(sv, l0), [x1, z1] = pt(sv, l1), p0 = [x0, hy(x0, z0), z0], d = nrm([x1 - x0, 0, z1 - z0]), L = Math.hypot(x1 - x0, z1 - z0);
      const an = { piv: [...p0, 3], ro: [...d, L], fa: [fas, sp, 0, 0] };
      if (extra === 'cykel') {
        const S = crs(UPP, d), at = (f, y) => [p0[0] + d[0] * f, p0[1] + y, p0[2] + d[2] * f];
        for (const f of [-0.52, 0.52]) { const P0 = []; for (let j = 0; j <= 12; j++) { const a = j / 12 * 6.283; P0.push([p0[0] + d[0] * (f + Math.cos(a) * 0.34), p0[1] + 0.34 + Math.sin(a) * 0.34, p0[2] + d[2] * (f + Math.cos(a) * 0.34)]); } for (let j = 0; j < 12; j++) aRor(P0[j], P0[j + 1], 0.016, [0.03, 0.03, 0.03], an, 3); }
        aRor(at(-0.52, 0.34), at(0, 0.38), 0.02, [0.6, 0.08, 0.06], an, 4); aRor(at(0, 0.38), at(-0.1, 0.85), 0.02, [0.6, 0.08, 0.06], an, 4); aRor(at(-0.1, 0.85), at(0.45, 0.85), 0.02, [0.6, 0.08, 0.06], an, 4); aRor(at(0.45, 0.85), at(0.52, 0.34), 0.018, [0.6, 0.08, 0.06], an, 4);
        aRor(at(0.45, 0.85), at(0.42, 1.05), 0.018, [0.2, 0.2, 0.2], an, 4); aLada(at(0.42, 1.06), [S, UPP, d], [0.26, 0.015, 0.02], [0.05, 0.05, 0.05], an);
        figur([p0[0] - d[0] * 0.2, p0[1] - 0.05, p0[2] - d[2] * 0.2], d, 1.0, an, 'cykel', { mossa: [0.9, 0.9, 0.88] });
        return;
      }
      if (extra === 'hund') folk({ t: 'hund', p0: [p0[0], p0[1] + 0.03, p0[2]], d, L, sp, fas, typ, pal: (fas * 10 | 0) % 6, klipp: 'ga' });
      else {
        // utan hund: en egen rutt längs trottoaren; finns en tvärgata på vägen svänger rutten runt hörnet in på den
        const bana = [pt(sv, l0)], v = vagar.find(q => q.dir === 'sv' && q.c > Math.min(l0, l1) + 3 && q.c < Math.max(l0, l1) - 3 && sv > q.a0 - tr - 1 && sv < q.a1 + tr + 1 && (q.a1 > sv + 12 || q.a0 < sv - 12));
        if (v) {
          const sg = Math.sign(v.c - l0), lk = v.c - sg * tr, ut = v.a1 > sv + 12 ? 1 : -1, sv2 = sv + ut * 18;
          const ok = [0.25, 0.5, 0.75, 1].every(f => !siktkil(...pt(sv + (sv2 - sv) * f, lk), 2));
          if (ok) bana.push(pt(sv, lk), pt(sv2, lk)); else bana.push(pt(sv, l1));
        } else bana.push(pt(sv, l1));
        folk({ t: 'ga', bana, klipp: 'ga', typ, pal: (fas * 10 | 0) % 6 });
      }
      if (extra === 'hund') {
        const S = crs(UPP, d), q = [p0[0] + d[0] * 1.3 + S[0] * 0.3, p0[1], p0[2] + d[2] * 1.3 + S[2] * 0.3], AX = [S, UPP, d], HB = [0.55, 0.38, 0.2];
        const ah = (ben, h) => ({ piv: an.piv, ro: an.ro, fa: [an.fa[0], an.fa[1], ben, h] });
        aLada([q[0], q[1] + 0.42, q[2]], AX, [0.11, 0.1, 0.3], HB, an); aLada([q[0] + d[0] * 0.34, q[1] + 0.56, q[2] + d[2] * 0.34], AX, [0.08, 0.09, 0.12], HB, an);
        for (const [fx, sx, b] of [[0.22, -1, 1], [0.22, 1, -1], [-0.22, -1, -1], [-0.22, 1, 1]]) aLada([q[0] + d[0] * fx + S[0] * sx * 0.07, q[1] + 0.17, q[2] + d[2] * fx + S[2] * sx * 0.07], AX, [0.03, 0.17, 0.03], HB, ah(b, 0.34));
        aRor([q[0] - d[0] * 0.3, q[1] + 0.48, q[2] - d[2] * 0.3], [q[0] - d[0] * 0.45, q[1] + 0.62, q[2] - d[2] * 0.45], 0.02, HB, an, 3);
        aRor([p0[0] + S[0] * 0.25 + d[0] * 0.05, p0[1] + 0.95, p0[2] + S[2] * 0.25 + d[2] * 0.05], [q[0] + d[0] * 0.38, q[1] + 0.55, q[2] + d[2] * 0.38], 0.006, [0.7, 0.1, 0.1], an, 3);
      }
    };
    const tr = GHW + GTR / 2;
    gaPa(BAK - tr, -55, 25, 1.0, 1.2, 0.0, 'hund', 1);            // bakgatans trottoar (syns i startvyn)
    gaPa(HU + tr, -40, 35, 0.98, 1.3, 0.4, 'hund', 3);            // huvudgatans bortre trottoar (lekplatsvyn)
    gaPa(HU + tr, 50, -10, 1.02, 1.4, 0.7, null, 'man');          // den realistiska mannen (folk-man.glb)
    gaPa(BAK + tr, 40, -30, 0.95, 1.25, 0.2, null, 4);            // äldre dam, svänger runt hörnet om det finns en tvärgata
    gaPa(BAK - 1.6, -90, 90, 1, 4.6, 0.3, 'cykel');               // cyklist på bakgatan
    gaPa(PS + 0.6, -90, 90, 1, 4.2, 0.65, 'cykel');                // och på parkvägen
    gaPa(PS - 0.6, 30, -60, 1.0, 1.15, 0.5, 'hund', 0);
    // en granne står ute på sin uppfart (vid infarten, framför en ev. bil) och vinkar mot vårt hus
    {
      const kand = uppfarter.map(([a0, b0, a1, b1]) => { const sv = a0 + (a1 - a0) * 0.88, lat = b0 + (b1 - b0) * 0.88, [x, z] = pt(sv, lat); return { x, z, d: Math.hypot(x, z) }; })
        .filter(q => q.d > 30 && q.d < 62 && !siktkil(q.x, q.z, 2)).sort((a, b) => a.d - b.d);
      if (kand.length) { const q = kand[0]; FOLK.push({ t: 'sta', p: [q.x, q.z], dir: [-q.x, -q.z], typ: 3, pal: 4, klipp: 'vinka' }); }
    }
    // ---- fjärran: tak och skorstenar i skogsbrynets gläntor, kyrktorn och vattentorn på kullarna ----
    for (const [g, b] of GLANTOR) for (let k = 0; k < 7; k++) {
      const a = (g + (r() - 0.5) * b * 1.5) * Math.PI / 180, d = 140 + r() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const fg = GRANNFARG[r() * GRANNFARG.length | 0], L = 9 + r() * 4, W = 7.5 + r() * 1.5;
      lod.push({ x, z, y: hy(x, z) - 0.5, L, W, H: 3 + (r() < 0.4 ? 2.6 : 0), ry: -a + Math.PI / 2 + (r() - 0.5) * 0.3, vagg: C(fg[0]), tak: C(fg[2]) });
    }
    // kyrktorn: vitt torn med svart spira och en kyrka i gläntan
    {
      const [g] = GLANTOR[2], a = g * Math.PI / 180, d = 212, x = Math.cos(a) * d, z = Math.sin(a) * d, y = hy(x, z) - 0.3, ax = [[Math.cos(a), 0, Math.sin(a)], UPP, crs([Math.cos(a), 0, Math.sin(a)], UPP)];
      lada3(VD, [x, y + 8, z], ax, [3.2, 8, 3.2], [0.92, 0.9, 0.86]); lada3(VD, [x, y + 16.6, z], ax, [3.4, 0.6, 3.4], [0.15, 0.15, 0.16]);
      ror(VD, [[x, y + 17, z, 2.9], [x, y + 27, z, 0.25], [x, y + 29, z, 0.05]], 4, UG, 1, () => [0.1, 0.1, 0.11]);
      const kx = x + ax[2][0] * 12, kz = z + ax[2][2] * 12, Lg = ax[2], Tv = ax[0], th = 0.72, HB = 5.4, yk = y + 9;
      lada3(VD, [kx, y + 4.5, kz], [Lg, UPP, crs(Lg, UPP)], [10, 4.5, 4.8], [0.92, 0.9, 0.86]);
      for (const s of [-1, 1]) {
        const d = nrm([Tv[0] * s * Math.cos(th), -Math.sin(th), Tv[2] * s * Math.cos(th)]), up = nrm([Tv[0] * s * Math.sin(th), Math.cos(th), Tv[2] * s * Math.sin(th)]), hl = HB / Math.cos(th) / 2;
        const top = [kx, yk + HB * Math.tan(th) - 0.3, kz];
        lada3(VD, [top[0] + d[0] * hl, top[1] + d[1] * hl, top[2] + d[2] * hl], [d, up, crs(d, up)], [hl, 0.18, 10.4], [0.2, 0.2, 0.22]);
      }
      for (const s of [-1, 1]) { const g0 = [kx + Lg[0] * s * 10, kz + Lg[2] * s * 10]; ror(VD, [[g0[0], yk - 0.1, g0[1], 0.01], [g0[0], yk, g0[1], 0.01]], 3, UG, 1, () => [0.9, 0.88, 0.84]); }
    }
    // vattentorn (svamp i betong) i en annan glänta
    {
      const [g] = GLANTOR[4], a = g * Math.PI / 180, d = 196, x = Math.cos(a) * d, z = Math.sin(a) * d, y = hy(x, z) - 0.3, B = [0.78, 0.77, 0.74];
      ror(VD, [[x, y, z, 2.4], [x, y + 22, z, 2.2], [x, y + 24, z, 9.5], [x, y + 29, z, 10], [x, y + 30.5, z, 9.2], [x, y + 31.5, z, 3]], 14, UG, 1, (yy) => yy > 23 ? B : B.map(v => v * 0.92));
    }
  }

  // ---- näten för det som rör sig och för röken ----
  function liv() {
    const ut = [];
    if (LEK && LEK.stallning) {
      const S = LEK.stallning, g = new THREE.Group(); g.name = 'lekstallning'; g.userData.egen = true;
      g.position.set(...S.p); g.rotation.y = S.ry; g.scale.setScalar(S.s); g.updateMatrix(); g.matrixAutoUpdate = false;
      const mat = egenMat('omgivning-lek', () => {
        const a = new THREE.MeshLambertMaterial({ vertexColors: true });
        a.onBeforeCompile = s => { s.uniforms.miljoLjus = LJUS; s.fragmentShader = 'uniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;'); };
        a.customProgramCacheKey = () => 'miljo-omgivning-lek';
        return a;
      });
      lekModell().then(geo => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.egen = true; g.add(m); g.updateMatrixWorld(true); }).catch(() => {});
      ut.push(g);
    }
    if (A.I.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(A.P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(A.N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(A.C, 3));
      g.setAttribute('aPiv', new THREE.Float32BufferAttribute(A.PV, 4));
      g.setAttribute('aRor', new THREE.Float32BufferAttribute(A.RO, 4));
      g.setAttribute('aFas', new THREE.Float32BufferAttribute(A.FA, 4));
      g.setIndex(A.P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(A.I, 1) : new THREE.Uint16BufferAttribute(A.I, 1));
      g.computeBoundingSphere();
      const m = egenMat('omgivning-liv', () => {
        const a = new THREE.MeshLambertMaterial({ vertexColors: true });
        a.onBeforeCompile = s => {
          s.uniforms.uTid = VU.uTid; s.uniforms.miljoLjus = LJUS;
          const FN = `
          uniform float uTid;
          attribute vec4 aPiv; attribute vec4 aRor; attribute vec4 aFas;
          vec3 vrid( vec3 v, vec3 k, float a ) { float c = cos( a ), s = sin( a ); return v * c + cross( k, v ) * s + k * dot( k, v ) * ( 1.0 - c ); }
          // flyttar en punkt (w = 1) eller en riktning (w = 0) enligt delens rörelse
          vec3 rorelse( vec3 p, float w ) {
            int typ = int( aPiv.w + 0.5 );
            vec3 rel = p - aPiv.xyz * w;
            if ( typ == 1 ) return aPiv.xyz * w + vrid( rel, aRor.xyz, aRor.w * sin( uTid * aFas.y + aFas.x ) );
            if ( typ == 2 ) return aPiv.xyz * w + vrid( rel, vec3( 0.0, 1.0, 0.0 ), uTid * aFas.y + aFas.x );
            if ( typ == 5 ) return p + vec3( 0.0, abs( sin( uTid * aFas.y + aFas.x ) ) * aRor.w * w, 0.0 );
            if ( typ == 3 ) {
              float L = max( aRor.w, 0.1 ), s = fract( uTid * aFas.y / ( 2.0 * L ) + aFas.x ), d = s < 0.5 ? s * 2.0 : 2.0 - s * 2.0;
              vec3 dir = aRor.xyz, sida = normalize( cross( vec3( 0.0, 1.0, 0.0 ), dir ) );
              if ( abs( aFas.z ) > 0.01 ) {
                float ang = aFas.z * 0.42 * sin( uTid * aFas.y * 4.2 );
                vec3 h = vec3( 0.0, aFas.w, 0.0 ) * w;
                rel = h + vrid( rel - h, sida, ang );
              }
              if ( s >= 0.5 ) rel = vec3( -rel.x, rel.y, -rel.z );
              float bob = abs( sin( uTid * aFas.y * 4.2 ) ) * 0.035 * w;
              return aPiv.xyz * w + rel + dir * ( L * d ) * w + vec3( 0.0, bob, 0.0 );
            }
            return p;
          }
`;
          s.vertexShader = FN + s.vertexShader
            .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = rorelse( objectNormal, 0.0 );')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = rorelse( transformed, 1.0 );');
          s.fragmentShader = 'uniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
        };
        a.customProgramCacheKey = () => 'miljo-omgivning-liv';
        return a;
      });
      const o = new THREE.Mesh(g, m); o.name = 'omgivning-liv'; o.frustumCulled = false; o.matrixAutoUpdate = false; o.receiveShadow = true; o.castShadow = false; o.userData.egen = true;
      ut.push(o);
    }
    if (ROK.length) {
      // rök: små oktaedrar som stiger, växer och tonar bort, driver med vinden
      const P = [], B = [], I = [], NP = 9, okt = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], F = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
      ROK.forEach((c, i) => { for (let k = 0; k < NP; k++) { const b = P.length / 3; okt.forEach(v => { P.push(...v); B.push(c[0], c[1], c[2], k / NP + i * 0.37); }); F.forEach(f => I.push(b + f[0], b + f[1], b + f[2])); } });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aBas', new THREE.Float32BufferAttribute(B, 4)); g.setIndex(I);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
      const m = egenMat('omgivning-rok', () => {
        const a = new THREE.MeshBasicMaterial({ color: 0xd8d8d4, transparent: true, opacity: 0.38, depthWrite: false });
        a.onBeforeCompile = s => {
          s.uniforms.uTid = VU.uTid; s.uniforms.uVind = VU.uVind; s.uniforms.miljoLjus = LJUS;
          s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\nattribute vec4 aBas;\nvarying float vA;\n' + s.vertexShader.replace('#include <begin_vertex>', `
            float t = fract( uTid * 0.07 + aBas.w );
            vec3 c = aBas.xyz + vec3( uVind.x, 0.0, uVind.y ) * t * 7.0 + vec3( 0.0, t * 6.5, 0.0 );
            vec3 transformed = c + position * ( 0.35 + t * 1.5 ) * vec3( 1.0, 0.8, 1.0 );
            vA = smoothstep( 0.0, 0.12, t ) * ( 1.0 - t );`);
          s.fragmentShader = 'varying float vA;\nuniform vec3 miljoLjus;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vA;\n  diffuseColor.rgb *= clamp( miljoLjus * 3.2, 0.25, 1.0 );');
        };
        a.customProgramCacheKey = () => 'miljo-omgivning-rok';
        return a;
      });
      const o = new THREE.Mesh(g, m); o.name = 'omgivning-rok'; o.frustumCulled = false; o.matrixAutoUpdate = false; o.renderOrder = 2; o.userData.egen = true;
      ut.push(o);
    }
    return ut;
  }

  return { lekplats, bygg, liv, tomTomt, fyllLuckor, folk: FOLK };
}
