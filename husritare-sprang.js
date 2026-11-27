// Sprängvyn "Vad ingår?": huset delar upp sig och visar vad som ingår i varje paket.
// Väggarna glider ut längs sina normaler, fönster och dörrar lyfts ut framför sina hål,
// taket (plåten) och takkassetterna lyfts uppåt och isär, golvbjälklaget stannar lägre och
// ett enkelt skiktsnitt visas i väggarna och taket (ytterpanel – luftspalt – stomme med
// isolering – installationsskikt/gips). Det som inte ingår i paketet tonas till grått glas.
//
// Husets egna nät flyttas på plats: hörnen i de hopslagna näten (ett per material) delas i
// öar (sammanhängande delar), och varje ö får en riktning efter vilken vägg eller vilket
// takfall den sitter på. Bara skiktsnittet är ny geometri (fyra nät, ett gemensamt material).
// Allt återställs exakt när vyn stängs. Motorn (husritare.js) ger delarna och en krok före
// varje bild via ritare.sprang; sidan (husritare-sida.js) kopplar knappen med kopplaSprang().

const TID = 2.2;          // sekunder för hela sprängningen (och tillbaka)
// starterna (andel av tiden): taket först, sedan kassetterna, bjälklaget, väggarna med sina skikt,
// sist glider fönstren och dörrarna ut framför sina hål. Varje rörelse tar lika lång tid.
const FAS_T = 0, FAS_K = 0.06, FAS_B = 0.12, FAS_V = 0.16, FAS_F = 0.34;
const FAS_MAX = FAS_F;
// sadeltakets fall (plåten och kassetterna) glider isär i sidled, så att man ser ned i huset
const takIsar = W => Math.max(0.6, W * 0.14), kassIsar = W => Math.max(0.35, W * 0.08);
const D = 1.5;            // väggarnas väg ut
const UPV = 0.5;          // väggarna lyfts lite, så att bjälklaget syns under dem
const HB = 0.22;          // bjälklaget och inredningen (lägre än väggarna: "sänks")
const HK = UPV + 1.6;     // takkassetterna (högt: man ska se ned i huset under dem)
const HP = HK + 1.3;      // plåttaket
const FONSTER_UT = 0.8;   // fönster och dörrar framför sina hål
const RANG = { P: 1, K: 2, N: 3, E: 4, X: 9 };

// Paketen, med samma namn och ordning som på prissidan. Bara det som står i paketen, inga andra mått.
const STEG = [
  { namn: 'Prefab stomme', kort: 'Stomme', intro: 'Ingår i paketet:', delar: [
    { t: 'Väggelement 170 mm', s: 'Med ytterpanel', a: 'stomme' },
    { t: 'Takkassetter', s: 'Med råspont och papp', a: 'kassett' },
    { t: 'Bjälklag/loft', a: 'bjalklag' },
    { t: 'Innerväggsstomme', a: 'innervagg' },
  ], not: 'Levereras vid tomtgräns.' },
  { namn: 'Klimatskal', kort: 'Klimat­skal', intro: 'Allt i Prefab stomme, och dessutom:', delar: [
    { t: 'Isolering', s: 'Rockwool/Isover el. likv.', a: 'isolering' },
    { t: 'Fönster', s: 'Elitfönster/NorDan el. likv.', a: 'fonster' },
    { t: 'Ytterdörr', s: 'Elitfönster/NorDan el. likv.', a: 'dorr' },
    { t: 'Plåttak med takavvattning', s: 'Plannja/Areco el. likv.', a: 'platt' },
    { t: 'Montering' },
  ] },
  { namn: 'Nyckelfärdig modul', kort: 'Nyckel­färdig', intro: 'Allt i Klimatskal, och dessutom:', delar: [
    { t: 'El och VVS' },
    { t: 'Invändig panel', s: 'Moelven el. likv.', a: 'gips' },
    { t: 'Innerdörrar', s: 'Swedoor el. likv.' },
    { t: 'Golv', s: 'Kährs/Parador el. likv.', a: 'golv' },
    { t: 'Kök och vitvaror', s: 'Siemens/Electrolux', a: 'kok' },
    { t: 'Badrum', s: 'Svedbergs el. likv.', a: 'bad' },
    { t: 'Trappa', loft: true },
    { t: 'Transport och kranlyft' },
    { t: 'Slutkontroll' },
  ] },
  { namn: 'Nyckelfärdig modul + entreprenad', kort: 'Entre­prenad', intro: 'Allt i Nyckelfärdig modul, och dessutom:', delar: [
    { t: 'Bygglov/bygganmälan' },
    { t: 'Mark och grund', s: 'Enligt avtal', a: 'grund' },
    { t: 'Inkoppling el och VA', a: 'va' },
    { t: 'Slutbesiktning' },
    { t: 'Ansvarsförsäkring' },
  ] },
];

const inUt = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const MANGD_LAGEN = [{ v: 0, t: 'Ihop' }, { v: 0.4, t: 'Lite' }, { v: 1, t: 'Helt' }];
const IKON_STANG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export function kopplaSprang({ ritare, scen, knapp, tillUte, lage }) {
  const I = ritare && ritare.sprang;
  if (!I || !knapp || !scen) return null;
  const { THREE, kamera, styr, mat, HUS } = I;
  const lugn = !!I.lugn;
  const duk = scen.querySelector('canvas');

  // ---- material (delas av allt i vyn) ----
  const GHOST = new THREE.MeshStandardMaterial({ color: 0xc3c8cd, roughness: 1, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false });
  const LAGER_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  // mineralull: matt, dov gulbeige, med fibrer i en liten målad struktur (färg och relief)
  const ULL = ullTextur();
  const ISOL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: ULL, bumpMap: ULL, bumpScale: 0.9 });
  // marken (grusbädden och schaktet): matt
  // glaset i det sprängda huset: klart, med en lätt spegling (husets eget glas ser mjölkigt ut
  // när rutan står fri i luften framför sitt hål); bara medan vyn är öppen
  const SPR_GLAS = new THREE.MeshStandardMaterial({ color: 0xdfeef2, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false });
  const sprMat = m => (m === mat.glas || m === mat.frostGlas ? SPR_GLAS : m);
  const MARK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const F = {
    tra: 0xd9b989, traMork: 0xb8915d, papp: 0x33363a, isol: 0xfaf3dc, gips: 0xefede7,
    grus: 0x8f8a80, makadam: 0x76716a, jord: 0x4a3b2e, jordLjus: 0x6a5642, sand: 0xc2ab7f,
    vatten: 0x2f62a8, avlopp: 0x5d6166, el: 0xd9542b,
  };
  const linj = {};
  Object.keys(F).forEach(k => { linj[k] = new THREE.Color().setHex(F[k]); });

  // ---- tillstånd ----
  // Etiketternas ankarpunkter vet hur de rör sig: läget vid t är basen + riktningen gånger delens
  // egen fas (samma som delen själv i satt), så att pricken sitter på delen vid varje isärdragning.
  const ankV = (v, dir, fas, dir2, fas2) => {
    v.bas = v.clone(); v.ad = dir ? dir.clone() : null; v.af = fas || 0; v.ad2 = dir2 ? dir2.clone() : null; v.af2 = fas2 || 0;
    if (dir) v.bas.sub(dir);
    if (dir2) v.bas.sub(dir2);
    return v;
  };
  const ankLage = (v, t, ut) => {
    ut = ut || new THREE.Vector3();
    if (!v.bas) return ut.copy(v);
    ut.copy(v.bas);
    if (v.ad) ut.addScaledVector(v.ad, lokal(t, v.af));
    if (v.ad2) ut.addScaledVector(v.ad2, lokal(t, v.af2));
    return ut;
  };
  const S = { pa: false, t: 0, tv: 0, mangd: 1, oppnar: false, satt: -1, steg: 0, hus: null, bygge: null, vantar: false, fore: null, skuggRuta: 0, etikettT: 0 };

  // ---- DOM: panelen och etiketterna ----
  const panel = document.createElement('section');
  panel.className = 'kspr'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Vad ingår i paketen');
  panel.innerHTML =
    '<div class="kspr__topp"><p class="kspr__etikett">Vad ingår?</p>' +
    '<button type="button" class="kspr__stang" data-kspr-stang aria-label="Stäng och sätt ihop huset">' + IKON_STANG + '</button></div>' +
    '<div class="kspr__flikar" role="tablist" aria-label="Paket">' +
    STEG.map((s, i) => '<button type="button" role="tab" class="kspr__flik" id="kspr-flik-' + i + '" aria-controls="kspr-text" aria-selected="false" tabindex="-1" data-kspr-steg="' + i + '"><b>' + (i + 1) + '</b><span>' + s.kort + '</span></button>').join('') +
    '<span class="kspr__markor" aria-hidden="true"></span></div>' +
    '<div class="kspr__text" id="kspr-text" role="tabpanel" aria-live="polite"></div>' +
    // isärdragningen: hur långt isär huset är (0–100 %), med lägena Ihop, Lite och Helt
    '<div class="kspr__mangd"><div class="kspr__mangd-topp"><span id="kspr-mangd-namn">Isärdragning</span><output class="kspr__mangd-varde" aria-hidden="true">100 %</output></div>' +
    '<div class="kspr__reglage" role="slider" tabindex="0" aria-labelledby="kspr-mangd-namn" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" aria-valuetext="Helt isär, 100 %">' +
    '<span class="kspr__spar"><span class="kspr__fyll"></span></span>' + MANGD_LAGEN.map(m => '<span class="kspr__mark" style="--m:' + m.v + '"></span>').join('') + '<span class="kspr__knopp"></span></div>' +
    '<div class="kspr__mangd-lagen">' + MANGD_LAGEN.map(m => '<button type="button" data-kspr-mangd="' + m.v + '" style="--m:' + m.v + '">' + m.t + '</button>').join('') + '</div></div>' +
    // foten (Föregående / Nästa eller Begär offert): alltid hel, utanför den rullande listan
    '<div class="kspr__fot"></div>';
  scen.appendChild(panel);
  const lappar = document.createElement('div');
  lappar.className = 'kspr__lappar'; lappar.setAttribute('aria-hidden', 'true');
  scen.appendChild(lappar);
  const flikar = [...panel.querySelectorAll('[data-kspr-steg]')];
  const textYta = panel.querySelector('.kspr__text');
  const markor = panel.querySelector('.kspr__markor');
  const fot = panel.querySelector('.kspr__fot');
  // listan rullar ensam; mjuka toningar i kanten där det finns mer att rulla till
  const tona = () => {
    const t = textYta, over = t.scrollHeight - t.clientHeight > 2;
    t.classList.toggle('kspr__text--topp', over && t.scrollTop > 2);
    t.classList.toggle('kspr__text--botten', over && t.scrollTop < t.scrollHeight - t.clientHeight - 2);
  };
  textYta.addEventListener('scroll', tona, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(tona).observe(textYta);
  // ---- isärdragningen (reglaget): S.mangd är målet, läget följer det med en fjäder (se steg) ----
  // Reglaget i panelen är det man ser och når med tangentbord och skärmläsare. Direkt i bilden:
  // Skift + rullning drar isär och ihop (vanlig rullning zoomar som förut, dragning vrider).
  const reglage = panel.querySelector('.kspr__reglage'), mangdVarde = panel.querySelector('.kspr__mangd-varde');
  const M = { drar: false };
  const mangdText = v => (v < 0.02 ? 'Ihop' : v > 0.98 ? 'Helt isär' : 'Isär') + ', ' + Math.round(v * 100) + ' %';
  function satsMangd(v, snapp) {
    v = Math.min(1, Math.max(0, v));
    if (snapp) { const m = MANGD_LAGEN.find(x => Math.abs(x.v - v) < 0.045); if (m) v = m.v; }
    S.mangd = v;
    reglage.style.setProperty('--v', v.toFixed(4));
    const pr = Math.round(v * 100);
    reglage.setAttribute('aria-valuenow', String(pr)); reglage.setAttribute('aria-valuetext', mangdText(v));
    mangdVarde.textContent = pr + ' %';
    panel.querySelectorAll('[data-kspr-mangd]').forEach(b => b.classList.toggle('kspr__lage--pa', Math.abs(+b.dataset.ksprMangd - v) < 0.005));
    if (S.bygge) { S.prov = null; I.begarRender(); }
  }
  const vardeAv = e => { const r = reglage.getBoundingClientRect(), k = 11; return (e.clientX - r.left - k) / Math.max(1, r.width - 2 * k); };
  reglage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); reglage.setPointerCapture(e.pointerId); reglage.focus({ preventScroll: true });
    M.drar = true; reglage.classList.add('kspr__reglage--drar'); satsMangd(vardeAv(e));
  });
  reglage.addEventListener('pointermove', e => { if (M.drar) satsMangd(vardeAv(e)); });
  const slappMangd = () => { if (!M.drar) return; M.drar = false; reglage.classList.remove('kspr__reglage--drar'); satsMangd(S.mangd, true); };
  reglage.addEventListener('pointerup', slappMangd); reglage.addEventListener('pointercancel', slappMangd); reglage.addEventListener('lostpointercapture', slappMangd);
  reglage.addEventListener('keydown', e => {
    const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
    if (d !== undefined) { e.preventDefault(); e.stopPropagation(); satsMangd(Math.round((S.mangd + d) * 20) / 20); return; }
    if (e.key === 'Home') { e.preventDefault(); satsMangd(0); } else if (e.key === 'End') { e.preventDefault(); satsMangd(1); }
  });
  panel.addEventListener('click', e => { const b = e.target.closest('[data-kspr-mangd]'); if (b) satsMangd(+b.dataset.ksprMangd); });
  // Skift + rullning i bilden (fångas före kamerans zoom)
  let rullTid = 0;
  scen.addEventListener('wheel', e => {
    if (!S.pa || !e.shiftKey) return;
    e.preventDefault(); e.stopPropagation();
    const d = e.deltaY || e.deltaX;
    M.drar = true; clearTimeout(rullTid); rullTid = setTimeout(() => { M.drar = false; satsMangd(S.mangd, true); I.begarRender(); }, 180);
    satsMangd(S.mangd - Math.sign(d) * Math.min(0.08, Math.abs(d) / 1200));
  }, { capture: true, passive: false });
  satsMangd(1);
  const smal = () => scen.clientWidth < 700;
  // smal skärm: panelen ligger under bilden (bilden är för låg för att dela), annars i den
  function placeraPanel() {
    const under = smal();
    panel.classList.toggle('kspr--under', under);
    if (under && panel.parentNode === scen) scen.after(panel);
    else if (!under && panel.parentNode !== scen) scen.appendChild(panel);
  }

  // css i en egen fil (hämtas när modulen kopplas, långt innan vyn öppnas)
  if (!document.querySelector('link[data-kspr-css]')) {
    const l = document.createElement('link');
    const q = import.meta.url.split('?')[1];
    l.rel = 'stylesheet'; l.href = new URL('husritare-sprang.css' + (q ? '?' + q : ''), import.meta.url).href;
    l.setAttribute('data-kspr-css', ''); document.head.appendChild(l);
  }

  // ---- hjälp: väggarnas ramar (samma som i motorn) ----
  function ramar(H, dl) {
    const L = H.L, W = H.W, xw = -L / 2, xe = L / 2, zn = -W / 2, zs = W / 2;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    return {
      S: { o: V(xw, 0, zs), u: V(1, 0, 0), n: V(0, 0, 1), len: L },
      N: { o: V(xe, 0, zn), u: V(-1, 0, 0), n: V(0, 0, -1), len: L },
      E: { o: V(xe, 0, zs), u: V(0, 0, -1), n: V(1, 0, 0), len: W },
      W: { o: V(xw, 0, zn), u: V(0, 0, 1), n: V(-1, 0, 0), len: W },
    };
  }
  function konturer(H, dl) {
    const L = H.L, W = H.W, hN = dl.hN, hS = dl.hS, hR = dl.hR, xw = -L / 2;
    const k = H.kupa, xk = k ? xw + k.langd : null, sadel = H.tak === 'sadel';
    return {
      S: k ? [[0, 0], [L, 0], [L, hS], [xk - xw, hS], [xk - xw, k.hk], [0, k.hk]] : [[0, 0], [L, 0], [L, hS], [0, hS]],
      N: [[0, 0], [L, 0], [L, hN], [0, hN]],
      E: sadel ? [[0, 0], [W, 0], [W, hN], [W / 2, hR], [0, hS]] : [[0, 0], [W, 0], [W, hN], [0, hS]],
      W: sadel ? (k ? [[0, 0], [W, 0], [W, k.hk], [W / 2, hR], [0, hN]] : [[0, 0], [W, 0], [W, hS], [W / 2, hR], [0, hN]]) : [[0, 0], [W, 0], [W, hS], [0, hN]],
    };
  }

  // ---- skiktsnittet: nya bitar, ihopslagna till fyra nät ----
  function nyttLager() { return { bitar: [] }; }
  // mineralull: tät, fin och mest liggande fibrer, blekt gul med lite grått, låg kontrast (förr
  // grova fläckar som såg ut som kamouflage). 256 px för ca 0,4 m (skiktsnittets uv, 2,5 per meter).
  function ullTextur() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#ddd3ad'; x.fillRect(0, 0, 256, 256);
    let fro = 11;
    const slump = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 6000; i++) {
      const px = slump() * 256, py = slump() * 256, l = 3 + slump() * 8, a = (slump() - 0.5) * 0.45;
      const v = slump(), f = v < 0.22 ? [190, 182, 152] : v < 0.7 ? [228, 219, 182] : [242, 236, 210];
      x.strokeStyle = 'rgba(' + f.join(',') + ',' + (0.3 + slump() * 0.35).toFixed(2) + ')';
      x.lineWidth = 0.5 + slump() * 0.6;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  // vilken etikett (del i paketen) bitarna som läggs nu hör till: markeringen i 3D använder den
  let TAGG = null;
  // skiktens egna material (byggs första gången ett hus sprängs): trä med ådring, tryckt
  // vindskyddsskiva, ångspärr i plast och panelens sågade kanter (färgen följer fasaden)
  let LM = null;
  function lagerMat() {
    if (LM) return LM;
    LM = {
      tra: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, map: traTextur('v') }),
      // (samma shaderprogram som träet: inget nytt att kompilera)
      vind: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, map: tryckTextur('#c9c4b4', 'rgba(60,84,120,0.5)', [120]) }),
      // (samma program som det grå glaset)
      plast: new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false }),
      // markeringsbandet: tryckt plast (samma program som träet)
      tejp: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, map: tryckTextur('#ffffff', 'rgba(25,25,25,0.75)', [118]) }),
    };
    return LM;
  }
  // geo i husets koordinater, färg (Color eller funktion av lokal normal), riktning, fas;
  // opt.ax: träets fiberriktning (världen) för ådringen, opt.uv: geometrins egen uv gäller
  function bit(lager, geo, farg, dir, fas, opt) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.normal) g.computeVertexNormals();
    lager.bitar.push({ g, farg, dir: dir.clone(), fas, ax: opt && opt.ax ? opt.ax.clone().normalize() : null, egenUv: !!(opt && opt.uv), tagg: TAGG });
  }
  function slaIhopLager(lager, kat, material = LAGER_MAT) {
    let n = 0;
    lager.bitar.forEach(b => { n += b.g.attributes.position.count; });
    if (!n) return null;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const o = new Uint32Array(n), dir = new Float32Array(lager.bitar.length * 3), fas = new Float32Array(lager.bitar.length);
    // uv: egen (panelen), längs fibrerna (trä: ådringen längs biten, 0,4 m per textur), annars
    // efter den dominerande normalen (lådprojektion), ca 0,4 m per textur
    const uv = new Float32Array(n * 2);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vN = new THREE.Vector3(), vP = new THREE.Vector3(), Y1 = new THREE.Vector3(0, 1, 0), X1 = new THREE.Vector3(1, 0, 0);
    let k = 0;
    lager.bitar.forEach((b, j) => {
      const p = b.g.attributes.position.array, nn = b.g.attributes.normal.array, c = b.g.userData.farg;
      const ue = b.egenUv && b.g.attributes.uv ? b.g.attributes.uv.array : null;
      for (let i = 0; i < p.length / 3; i++, k++) {
        const px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2], nx = nn[i * 3], ny = nn[i * 3 + 1], nz = nn[i * 3 + 2];
        pos[k * 3] = px; pos[k * 3 + 1] = py; pos[k * 3 + 2] = pz;
        nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
        const f = c ? c[i] : b.farg;
        col[k * 3] = f.r; col[k * 3 + 1] = f.g; col[k * 3 + 2] = f.b;
        o[k] = j;
        if (ue) { uv[k * 2] = ue[i * 2]; uv[k * 2 + 1] = ue[i * 2 + 1]; continue; }
        if (b.ax) {
          vN.set(nx, ny, nz); vP.set(px, py, pz);
          if (Math.abs(vN.dot(b.ax)) > 0.7) { vA.crossVectors(vN, Math.abs(ny) < 0.9 ? Y1 : X1).normalize(); vB.crossVectors(vN, vA); }   // ändträ
          else { vB.copy(b.ax); vA.crossVectors(vN, b.ax).normalize(); }
          uv[k * 2] = vP.dot(vA) * 2.5; uv[k * 2 + 1] = vP.dot(vB) * 2.5;
          continue;
        }
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) { uv[k * 2] = px * 2.5; uv[k * 2 + 1] = pz * 2.5; } else if (ax >= az) { uv[k * 2] = pz * 2.5; uv[k * 2 + 1] = py * 2.5; } else { uv[k * 2] = px * 2.5; uv[k * 2 + 1] = py * 2.5; }
      }
      dir[j * 3] = b.dir.x; dir[j * 3 + 1] = b.dir.y; dir[j * 3 + 2] = b.dir.z; fas[j] = b.fas;
      b.g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true; m.visible = false; m.frustumCulled = false;
    m.name = 'sprang-' + kat;
    return { mesh: m, o, dir, fas, kat: new Uint8Array(lager.bitar.length).fill(RANG[kat]), egen: true, mat0: material, tagg: lager.bitar.map(b => b.tagg || null) };
  }
  // färg per hörn efter normalen i bitens egna koordinater (före flytten): topp/sidor
  function fargNormal(geo, topp, sida) {
    const nn = geo.attributes.normal.array, c = [];
    for (let i = 0; i < nn.length / 3; i++) c.push(nn[i * 3 + 1] > 0.5 ? topp : sida);
    geo.userData.farg = c;
    return geo;
  }
  const lada = (w, h, d) => new THREE.BoxGeometry(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d));

  function byggLager(hus, H) {
    const dl = hus.userData.delar, Y0 = dl.Y0, R = ramar(H, dl), K = konturer(H, dl);
    const LMt = lagerMat();
    // tra: trä med ådring (stomme, läkt, panelens baksida), ovr: råspont med papp (färg per hörn),
    // vind: vindskyddsskivan, panel: panelens lockläkt (fasadens eget material), kant: panelens
    // sågade kanter, isol: mineralullen, gips: gips och installationsskiktet, plast: ångspärren
    const tra = nyttLager(), ovr = nyttLager(), isol = nyttLager(), gips = nyttLager();
    const vind = nyttLager(), panel = nyttLager(), kant = nyttLager(), plast = nyttLager();
    const TRA = new THREE.Color(1, 0.97, 0.92), TRA_M = new THREE.Color(0.86, 0.8, 0.72), TRA_RA = new THREE.Color(0.93, 0.9, 0.84);
    const ULLF = new THREE.Color(0xfff0c4), FOG = new THREE.Color(0xc9c5bb), VIT = new THREE.Color(1, 1, 1);
    const ank = {};
    const UP = new THREE.Vector3(0, 1, 0);
    const omb = { S: [], N: [], E: [], W: [] };
    H.oppningar.forEach(o => omb[o[0]].push({ u0: o[1], u1: o[1] + o[2], v0: o[3], v1: o[3] + o[4], typ: o[5] }));
    ank.vagg = {};
    const NED = 0.09, KB = 0.12, KT = 0.024;   // panelen går ned över syllen; hörnbrädorna (som i motorn)
    // låda med lutande överkant: u0..u1, v0 till t0 (vid u0) och t1 (vid u1), n z0..z1; uv i väggens meter
    const kloss8 = (u0, u1, v0, t0, t1, z0, z1, uvMeter) => {
      const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) < 0, y = p.getY(i) < 0;
        const u = x ? u0 : u1, v = y ? v0 : (x ? t0 : t1);
        p.setXYZ(i, u, v, p.getZ(i) < 0 ? z0 : z1);
        if (uvMeter) uv.setXY(i, u, v);
      }
      g.computeVertexNormals();
      return g;
    };
    Object.keys(R).forEach(s => {
      TAGG = 'stomme';
      const r = R[s], kont = K[s], len = r.len;
      const M = new THREE.Matrix4().makeBasis(r.u, UP, r.n).setPosition(r.o.x, r.o.y + Y0, r.o.z);
      // vägarna ut: panelen följer husets fasad, vindskyddet och läkten, stommen med ullen, gipsen
      const dF = r.n.clone().multiplyScalar(D).addScaledVector(UP, UPV);
      const dV = r.n.clone().multiplyScalar(D * 0.8).addScaledVector(UP, UPV);
      const dS = r.n.clone().multiplyScalar(D * 0.6).addScaledVector(UP, UPV);
      const dG = r.n.clone().multiplyScalar(D * 0.28).addScaledVector(UP, UPV);
      const iW = (u, v, n) => new THREE.Vector3(u, v, n).applyMatrix4(M);
      // övre kanter (inte botten, inte lodräta ändar)
      const kanter = [];
      for (let i = 1; i < kont.length; i++) {
        const a = kont[i], b = kont[(i + 1) % kont.length];
        if (Math.abs(a[0] - b[0]) > 1e-4) kanter.push([a, b]);
      }
      const vTopp = u => {
        let v = 0;
        kanter.forEach(([a, b]) => {
          const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
          if (u >= lo - 1e-6 && u <= hi + 1e-6) v = Math.max(v, a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]));
        });
        return v;
      };
      const hal = omb[s];
      const TJ = 0.045, DJ = 0.17, NC = -0.12;
      const axU = r.u.clone();
      // stommen: reglar 45 × 170, lodräta (ådringen uppåt) och liggande (syll, överliggare, bröstning)
      const stod = (u0, u1, v0, v1, ax) => {
        if (v1 - v0 < 0.02 || u1 - u0 < 0.005) return;
        const g = lada(u1 - u0, v1 - v0, DJ); g.translate((u0 + u1) / 2, (v0 + v1) / 2, NC); g.applyMatrix4(M);
        bit(tra, g, ax === UP ? TRA : TRA_M, dS, FAS_V + 0.02, { ax });
      };
      // reglarna c 600, vid hålens sidor och vid ändarna; en c 600-regel som hamnar på en annan
      // tas bort (förr låg två reglar i varandra och flimrade)
      const us = [];
      const laggU = u => { if (u >= TJ / 2 - 1e-6 && u <= len - TJ / 2 + 1e-6 && !us.some(x => Math.abs(x - u) < TJ * 1.05)) us.push(u); };
      hal.forEach(h => { laggU(h.u0 - TJ / 2); laggU(h.u1 + TJ / 2); });
      laggU(TJ / 2); laggU(len - TJ / 2);
      for (let u = TJ / 2; u < len - 0.1; u += 0.6) laggU(u);
      us.sort((a, b) => a - b);
      us.forEach(u => {
        let seg = [[TJ, vTopp(u) - 0.06]];
        hal.forEach(h => {
          if (u + TJ / 2 <= h.u0 || u - TJ / 2 >= h.u1) return;
          const ny = [];
          seg.forEach(([a, b]) => { if (h.v0 - TJ > a) ny.push([a, Math.min(b, h.v0 - TJ)]); if (h.v1 + 2 * TJ < b) ny.push([Math.max(a, h.v1 + 2 * TJ), b]); });
          seg = ny;
        });
        seg.forEach(([a, b]) => stod(u - TJ / 2, u + TJ / 2, a, b, UP));
      });
      // syll (utom vid dörrarna), överliggare mellan hålets reglar och fönsterbröstning
      let syll = [[0, len]];
      hal.filter(h => h.v0 < 0.05).forEach(h => { const ny = []; syll.forEach(([a, b]) => { if (h.u0 > a) ny.push([a, Math.min(b, h.u0)]); if (h.u1 < b) ny.push([Math.max(a, h.u1), b]); }); syll = ny; });
      syll.forEach(([a, b]) => stod(a, b, 0, TJ, axU));
      hal.forEach(h => {
        if (h.v1 + 2 * TJ < vTopp((h.u0 + h.u1) / 2) - 0.04) stod(h.u0, h.u1, h.v1, h.v1 + 2 * TJ, axU);
        if (h.v0 > 0.1) stod(h.u0, h.u1, h.v0 - TJ, h.v0, axU);
      });
      // hammarband längs de övre kanterna (lutar med gaveln), 2 mm tunnare än reglarna: inga
      // ytor i samma plan där de möts
      const cU = kont.reduce((a, p) => a + p[0], 0) / kont.length, cV = kont.reduce((a, p) => a + p[1], 0) / kont.length;
      kanter.forEach(([a, b]) => {
        const du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv), th = Math.atan2(dv, du);
        let px = -Math.sin(th), py = Math.cos(th);
        const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
        if ((cU - mu) * px + (cV - mv) * py < 0) { px = -px; py = -py; }
        const g = lada(l, TJ, DJ - 0.004); g.rotateZ(th); g.translate(mu + px * TJ / 2, mv + py * TJ / 2, NC); g.applyMatrix4(M);
        bit(tra, g, TRA_M, dS, FAS_V + 0.02, { ax: axU.clone().multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th)) });
      });

      // mineralull i varje fack mellan reglarna (och ovanför och under hålen): skivorna buktar
      // ut någon cm mellan reglarna, trycks in mot dem, har en skarv var 1,17 m och är lite ojämna
      const ullTopp = u => vTopp(u) - TJ * 1.6 - 0.004;
      const ullFack = (ua, ub, va, vb, fro) => {
        const h0 = Math.min(vb, ullTopp((ua + ub) / 2)) - va;
        if (ub - ua < 0.03 || h0 < 0.05) return;
        const sx = Math.max(2, Math.round((ub - ua) / 0.085)), sy = Math.max(2, Math.round(h0 / 0.12));
        const g = new THREE.BoxGeometry(1, 1, 1, sx, sy, 1), p = g.attributes.position;
        const Z0 = -0.2, Z1 = -0.04, B = 0.008;
        for (let i = 0; i < p.count; i++) {
          const fx = p.getX(i) + 0.5, fy = p.getY(i) + 0.5, fram = p.getZ(i) > 0;
          const u = ua + fx * (ub - ua), vt = Math.min(vb, ullTopp(u)), v = va + fy * (vt - va);
          const kant = Math.min(1, (v - va) / 0.07, (vt - v) / 0.07);
          let b = Math.pow(Math.sin(Math.PI * fx), 0.7) * B * Math.max(0, kant);
          b += (Math.sin(v * 31.7 + u * 13.1 + fro) * 0.0016 + Math.sin(v * 83.3 - u * 41.9 + fro * 2.3) * 0.0009) * Math.sin(Math.PI * fx);
          const sk = (v - va) % 1.17;   // skarven mellan skivorna
          if (v - va > 0.3 && vt - v > 0.1) b -= 0.006 * Math.exp(-Math.pow(Math.min(sk, 1.17 - sk) / 0.018, 2)) * Math.sin(Math.PI * fx);
          p.setXYZ(i, u, v, fram ? Z1 + b : Z0 - b * 0.7);
        }
        g.computeVertexNormals(); g.applyMatrix4(M);
        bit(isol, g, ULLF.clone().multiplyScalar(0.96 + 0.05 * Math.sin(fro * 7.1)), dS, FAS_V + 0.02);
      };
      for (let i = 0; i < us.length - 1; i++) {
        const ua = us[i] + TJ / 2 + 0.001, ub = us[i + 1] - TJ / 2 - 0.001, uc = (ua + ub) / 2;
        let seg = [[TJ + 0.002, 99]];
        hal.forEach(h => {
          if (uc < h.u0 || uc > h.u1) return;
          const ny = [];
          seg.forEach(([a, b]) => { if (h.v0 - TJ - 0.002 > a) ny.push([a, Math.min(b, h.v0 - TJ - 0.002)]); if (h.v1 + 2 * TJ + 0.002 < b) ny.push([Math.max(a, h.v1 + 2 * TJ + 0.002), b]); });
          seg = ny;
        });
        TAGG = 'isolering';
        seg.forEach(([a, b], j) => ullFack(ua, ub, a, b, i * 1.7 + j));
        TAGG = 'stomme';
      }

      // trappstegen (som i produktkortens snitt): gipsen täcker väggen bara till c1, ångspärren och
      // installationsläkten en regel längre; vindskyddet och läkten börjar vid c2. Snitten går
      // alltid vid en regel och aldrig genom ett hål.
      const friU = u => !hal.some(h => u > h.u0 - 0.15 && u < h.u1 + 0.15);
      const narmast = mal => { let b = null; us.forEach(u => { if (u > 0.5 && u < len - 0.5 && friU(u) && (b === null || Math.abs(u - mal) < Math.abs(b - mal))) b = u; }); return b; };
      const nasta = (fran, min) => { const u = us.find(x => x > fran + min && x < len - 0.3 && friU(x)); return u === undefined ? len : u; };
      const c1 = narmast(len * 0.55) ?? len, c1p = c1 >= len ? len : nasta(c1, 0.4);
      const c2 = narmast(len * 0.35) ?? 0;
      // väggens form mellan ua och ub (botten vb), med hålen som ligger helt inom den
      const klipp = (pl, k, sg) => { const ut = []; for (let i = 0; i < pl.length; i++) { const a = pl[i], b = pl[(i + 1) % pl.length], ia = sg * (a[0] - k) <= 1e-9, ib = sg * (b[0] - k) <= 1e-9; if (ia) ut.push(a); if (ia !== ib) { const t = (k - a[0]) / (b[0] - a[0]); ut.push([k, a[1] + (b[1] - a[1]) * t]); } } return ut; };
      const formMellan = (ua, ub, vb, dt) => {
        let pl = kont.map(p => [p[0], p[1] === 0 ? vb : p[1] - dt]);
        pl = klipp(klipp(pl, ub, 1), ua, -1);
        if (pl.length < 3) return null;
        const f = new THREE.Shape(pl.map(p => new THREE.Vector2(p[0], p[1])));
        hal.filter(h => h.u0 > ua + 0.01 && h.u1 < ub - 0.01).forEach(h => {
          const q = new THREE.Path(); q.moveTo(h.u0, Math.max(vb + 0.001, h.v0)); q.lineTo(h.u0, h.v1); q.lineTo(h.u1, h.v1); q.lineTo(h.u1, Math.max(vb + 0.001, h.v0)); q.closePath();
          if (h.v0 > vb + 0.01) f.holes.push(q);
        });
        return f;
      };
      // dörrarna når ned till botten: där skärs formen i stället i två delar runt dörren
      const formDelar = (ua, ub, vb, dt) => {
        let kl = [[ua, ub]];
        hal.filter(h => h.v0 <= vb + 0.01).forEach(h => { const ny = []; kl.forEach(([a, b]) => { if (h.u0 > a + 0.02) ny.push([a, Math.min(b, h.u0)]); if (h.u1 < b - 0.02) ny.push([Math.max(a, h.u1), b]); }); kl = ny; });
        const ut = [];
        kl.forEach(([a, b]) => {
          const f = formMellan(a, b, vb, dt);
          if (!f) return;
          ut.push(f);
        });
        // fältet ovanför varje dörr
        hal.filter(h => h.v0 <= vb + 0.01 && h.u0 >= ua - 0.01 && h.u1 <= ub + 0.01).forEach(h => {
          let pl = kont.map(p => [p[0], p[1] === 0 ? h.v1 : p[1] - dt]);
          pl = klipp(klipp(pl, h.u1, 1), h.u0, -1).filter(p => p[1] >= h.v1 - 1e-6);
          if (pl.length >= 3 && Math.max(...pl.map(p => p[1])) > h.v1 + 0.02) ut.push(new THREE.Shape(pl.map(p => new THREE.Vector2(p[0], p[1]))));
        });
        return ut;
      };
      const platta = (former, z0, djup, lager, farg, dir, fas, opt) => former.forEach(f => {
        const g = new THREE.ExtrudeGeometry(f, { depth: djup, bevelEnabled: false, curveSegments: 1 });
        g.translate(0, 0, z0); g.applyMatrix4(M);
        bit(lager, g, farg, dir, fas, opt);
      });
      // liggande virke [v, v + hh] längs väggen mellan ua och ub, avbrutet av hålen och taket
      const liggande = (v, hh, ua, ub, cb) => {
        let a = null;
        const ok = u => vTopp(Math.min(u, len)) - 0.03 > v + hh && !hal.some(h => u > h.u0 - 0.02 && u < h.u1 + 0.02 && v + hh > h.v0 - 0.02 && v < h.v1 + 0.02);
        for (let u = ua; u <= ub + 1e-6; u += 0.02) {
          const o = ok(u);
          if (o && a === null) a = u;
          if (!o && a !== null) { if (u - 0.02 - a > 0.08) cb(a, u - 0.02); a = null; }
        }
        if (a !== null && ub - a > 0.08) cb(a, ub);
      };

      TAGG = 'gips';
      // invändigt: gips 13 mm med skarvar var 1,2 m, installationsläkt 45 × 45 c 600, ångspärr
      platta(formDelar(0, c1, 0, 0.004), -0.262, 0.013, gips, linj.gips, dG, FAS_V + 0.04);
      for (let u = 1.2; u < c1 - 0.05; u += 1.2) {
        let seg = [[0.004, vTopp(u) - 0.01]];
        hal.forEach(h => { if (u < h.u0 - 0.003 || u > h.u1 + 0.003) return; const ny = []; seg.forEach(([a, b]) => { if (h.v0 > a) ny.push([a, Math.min(b, h.v0)]); if (h.v1 < b) ny.push([Math.max(a, h.v1), b]); }); seg = ny; });
        seg.forEach(([a, b]) => { if (b - a < 0.05) return; const g = lada(0.004, b - a, 0.0016); g.translate(u, (a + b) / 2, -0.2627); g.applyMatrix4(M); bit(gips, g, FOG, dG, FAS_V + 0.04); });
      }
      for (let v = 0.3; v < 3.4; v += 0.6) liggande(v, 0.045, 0.004, c1p, (a, b) => { const g = lada(b - a, 0.045, 0.041); g.translate((a + b) / 2, v + 0.0225, -0.2285); g.applyMatrix4(M); bit(gips, g, linj.tra, dG, FAS_V + 0.04); });
      platta(formDelar(0, c1p, 0, 0.004), -0.2075, 0.001, plast, VIT, dG, FAS_V + 0.04);
      TAGG = 'stomme';
      // utvändigt: vindskyddsskiva 9 mm och liggande läkt 28 × 70 c 600 (för stående panel)
      platta(formDelar(c2, len, 0, 0.004), -0.0345, 0.009, vind, VIT, dV, FAS_V + 0.01);
      for (let v = 0.12; v < 3.4; v += 0.6) liggande(v, 0.07, Math.min(len, c2 + 0.3), len - 0.005, (a, b) => { const g = lada(b - a, 0.07, 0.027); g.translate((a + b) / 2, v + 0.035, -0.012); g.applyMatrix4(M); bit(tra, g, TRA_M, dV, FAS_V + 0.01, { ax: axU }); });

      // ytterpanelen: husets fasad är en tunn yta. Här får den sin tjocklek (22 mm, sågade kanter i
      // fasadens färg och en baksida av obehandlat trä) och riktiga lockläkt 48 × 22 över
      // underbrädorna (samma delning som fasadens bild: 5 brädor per meter, locket först).
      {
        const kn = kont.map(p => [p[0], p[1] === 0 ? -NED : p[1]]);
        const f = new THREE.Shape(kn.map(p => new THREE.Vector2(p[0], p[1])));
        hal.forEach(h => { const q = new THREE.Path(); const vb = Math.max(-NED + 0.002, h.v0); q.moveTo(h.u0, vb); q.lineTo(h.u0, h.v1); q.lineTo(h.u1, h.v1); q.lineTo(h.u1, vb); q.closePath(); if (h.v0 > 0.01) f.holes.push(q); });
        // dörrarna: hålet går ned till panelens underkant, så formen skärs i delar runt dem
        const former = hal.some(h => h.v0 <= 0.01) ? (() => {
          let kl = [[0, len]];
          hal.filter(h => h.v0 <= 0.01).forEach(h => { const ny = []; kl.forEach(([a, b]) => { if (h.u0 > a + 0.02) ny.push([a, Math.min(b, h.u0)]); if (h.u1 < b - 0.02) ny.push([Math.max(a, h.u1), b]); }); kl = ny; });
          const ut = kl.map(([a, b]) => {
            const pl = klipp(klipp(kn, b, 1), a, -1);
            if (pl.length < 3) return null;
            const ff = new THREE.Shape(pl.map(p => new THREE.Vector2(p[0], p[1])));
            hal.filter(h => h.v0 > 0.01 && h.u0 > a + 0.01 && h.u1 < b - 0.01).forEach(h => { const q = new THREE.Path(); q.moveTo(h.u0, h.v0); q.lineTo(h.u0, h.v1); q.lineTo(h.u1, h.v1); q.lineTo(h.u1, h.v0); q.closePath(); ff.holes.push(q); });
            return ff;
          }).filter(Boolean);
          hal.filter(h => h.v0 <= 0.01).forEach(h => {
            const pl = klipp(klipp(kn.map(p => [p[0], p[1] === -NED ? h.v1 : p[1]]), h.u1, 1), h.u0, -1);
            if (pl.length >= 3 && Math.max(...pl.map(p => p[1])) > h.v1 + 0.02) ut.push(new THREE.Shape(pl.map(p => new THREE.Vector2(p[0], p[1]))));
          });
          return ut;
        })() : [f];
        former.forEach(ff => {
          const g = new THREE.ExtrudeGeometry(ff, { depth: 0.022, bevelEnabled: false, curveSegments: 1 });
          g.translate(0, 0, -0.022);
          const p = g.attributes.position.array, bak = [], sid = [];
          for (let t = 0; t < p.length; t += 9) {
            const z = [p[t + 2], p[t + 5], p[t + 8]];
            if (z.every(q => q > -0.001)) continue;               // framsidan: husets fasad
            (z.every(q => q < -0.021) ? bak : sid).push(...p.slice(t, t + 9));
          }
          g.dispose();
          const ny = arr => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); q.computeVertexNormals(); q.applyMatrix4(M); return q; };
          if (bak.length) bit(tra, ny(bak), TRA_RA, dF, FAS_V, { ax: UP });
          if (sid.length) bit(kant, ny(sid), VIT, dF, FAS_V);   // (färgen sätts efter fasaden, se kantFarg)
        });
        // lockläkten: inte under hörnbrädorna, avbrutna av hålen
        const hinder = hal.map(h => [h.u0, h.u1, h.v0, h.v1]);
        if (s === 'S' && H.kupa) { const xk = H.kupa.langd; hinder.push([xk - KB - 0.01, xk + KT + 0.01, dl.hS - 0.01, 99]); }
        for (let ua = 0; ua < len; ua += 0.2) {
          const ub = ua + 0.048;
          if (ua < KB + KT + 0.01 || ub > len - KB - KT - 0.01) continue;
          let seg = [[-NED + 0.004, 99]];
          hinder.forEach(([h0, h1, hv0, hv1]) => {
            if (ub <= h0 || ua >= h1) return;
            const ny = [];
            seg.forEach(([a, b]) => { if (hv0 > a + 0.02) ny.push([a, Math.min(b, hv0)]); if (hv1 < b - 0.02) ny.push([Math.max(a, hv1), b]); });
            seg = ny;
          });
          seg.forEach(([a, b]) => {
            const t0 = Math.min(b, vTopp(ua) - 0.004), t1 = Math.min(b, vTopp(ub) - 0.004);
            if (Math.min(t0, t1) - a < 0.04) return;
            const g = kloss8(ua, ub, a, t0, t1, 0.0008, 0.021, true); g.applyMatrix4(M);
            bit(panel, g, VIT, dF, FAS_V, { uv: true });
          });
        }
      }
      // ankare för etiketterna (sprängt läge)
      // en punkt på väggens insida som inte ligger i ett hål: den närmaste till (u, v) bland
      // kandidaterna us (längs väggen) och några höjder
      const fri = (u, v) => !hal.some(h => u > h.u0 - 0.12 && u < h.u1 + 0.12 && v > h.v0 - 0.12 && v < h.v1 + 0.12);
      const punkt = (us, uMal, vMal) => {
        let b = null, bd = 1e9;
        us.forEach(u => [vMal, vMal + 0.45, vMal - 0.45, 0.45, 1.9].forEach(v => {
          if (u < 0.2 || u > len - 0.2 || v < 0.25 || v > vTopp(u) - 0.25 || !fri(u, v)) return;
          const d = Math.abs(u - uMal) + Math.abs(v - vMal) * 0.6;
          if (d < bd) { bd = d; b = [u, v]; }
        }));
        return b || [uMal, vMal];
      };
      const stP = [], faP = [];
      for (let u = TJ / 2; u < len; u += 0.6) { stP.push(u); faP.push(u + 0.3); }
      const vm = Math.min(1.3, vTopp(len / 2) * 0.5);
      // stommen och ullen syns inifrån bortom gipsens kant (c1), gipsen före den
      const faG = faP.filter(u => u < c1 - 0.15), uBort = (c1 + len) / 2;
      const pS = punkt(stP, uBort - 0.3, vm + 0.25), pI = punkt(faP, uBort, vm), pG = punkt(faG.length ? faG : faP, c1 * 0.5, vm - 0.15);
      ank.vagg[s] = {
        n: r.n.clone(),
        stomme: ankV(iW(pS[0], pS[1], NC - DJ / 2).add(dS), dS, FAS_V + 0.02),
        isolering: ankV(iW(pI[0], pI[1], -0.207).add(dS), dS, FAS_V + 0.02),
        gips: ankV(iW(pG[0], pG[1], -0.262).add(dG), dG, FAS_V + 0.04),
        gipsLista: [0.25, 0.5, 0.75].flatMap(f => [0.9, 1.6].map(v => { const q = punkt(faG.length ? faG : faP, c1 * f, v); return ankV(iW(q[0], q[1], -0.262).add(dG), dG, FAS_V + 0.04); })),
        // utsidan av skikten vid väggens ändar: där syns de i glipan bakom ytterpanelen
        kant: {
          stomme: [TJ / 2, len - TJ / 2].map(u => { const q = punkt([u], u, vm); return ankV(iW(q[0], q[1], NC + DJ / 2 + 0.001).add(dS), dS, FAS_V + 0.02); }),
          isolering: [TJ + 0.28, len - TJ - 0.28].map(u => { const q = punkt([u], u, vm); return ankV(iW(q[0], q[1], -0.03).add(dS), dS, FAS_V + 0.02); }),
        },
        // fönster och dörrar: punkten på karmens kant (inte mitt i glaset), båda sidorna
        hal: hal.flatMap(h => {
          const dV = r.n.clone().multiplyScalar(D).addScaledVector(UP, UPV), dF = r.n.clone().multiplyScalar(FONSTER_UT).addScaledVector(UP, 0.1);
          const vm2 = h.v0 + (h.v1 - h.v0) * 0.55;
          return [h.u1 - 0.03, h.u0 + 0.03].map(u => ({ typ: h.typ, p: ankV(iW(u, vm2, 0.03).add(dV).add(dF), dV, FAS_V, dF, FAS_F) }));
        }),
      };
    });

    // takkassetterna: samma skivor som plåttaket (motorns takskiva), i moduler om ~1,2 m
    const L = H.L, W = H.W, xw = -L / 2, xe = L / 2, zn = -W / 2, zs = W / 2, OV = 0.32, OG = 0.14, T = 0.17;
    const plan = [];
    if (H.tak === 'sadel') {
      plan.push([xw - OG, xe + OG, [zn, dl.hN], [0, dl.hR], OV, -1]);
      if (H.kupa) {
        const xk = xw + H.kupa.langd;
        plan.push([xk, xe + OG, [zs, dl.hS], [0, dl.hR], OV, 1]);
        plan.push([xw - OG, xk + 0.12, [zs, H.kupa.hk], [0, dl.hR], OV * 0.7, 1]);
      } else plan.push([xw - OG, xe + OG, [zs, dl.hS], [0, dl.hR], OV, 1]);
    } else plan.push([xw - OG, xe + OG, [zn, dl.hN], [zs + OV, dl.hS + (dl.hS - dl.hN) / W * OV], OV, 0]);
    ank.kassett = []; ank.platt = [];
    plan.forEach(([xa, xb, p0, p1, ut, sida]) => {
      const dz = p1[0] - p0[0], dy = p1[1] - p0[1], lang = Math.hypot(dz, dy), rz = dz / lang, ry = dy / lang;
      const a = [p0[0] - rz * ut, p0[1] - ry * ut], Ls = lang + ut, mid = [(a[0] + p1[0]) / 2, (a[1] + p1[1]) / 2];
      const ez = rz >= 0 ? rz : -rz, ey = rz >= 0 ? ry : -ry, nY = ez, nZ = -ey;
      const Mr = new THREE.Matrix4().makeRotationX(Math.atan2(-ey, ez)).setPosition((xa + xb) / 2, mid[1] + nY * T / 2 + Y0, mid[0] + nZ * T / 2);
      const bredd = xb - xa, nm = Math.max(1, Math.round(bredd / 1.2)), bm = bredd / nm;
      // kassetterna en aning tunnare och kortare än plåttakets skiva: ihop syns de inte genom den
      const Mk = Mr.clone().multiply(new THREE.Matrix4().makeScale(0.996, 0.86, 0.992));
      for (let i = 0; i < nm; i++) {
        const xm = -bredd / 2 + bm * (i + 0.5), xv = (xa + xb) / 2 + xm;
        const dir = new THREE.Vector3(xv * 0.07, HK, sida * kassIsar(W));
        const fas = FAS_K + 0.02 * i / nm;
        const lagg = (lager, g, farg, opt) => { g.applyMatrix4(Mk); bit(lager, g, farg, dir, fas, opt); };
        const axK = new THREE.Vector3(0, 0, 1).transformDirection(Mk);
        TAGG = 'kassett';
        [-1, 1].forEach(sx => { const g = lada(0.045, T - 0.031, Ls - 0.004); g.translate(xm + sx * (bm / 2 - 0.03), -0.0155, 0); lagg(tra, g, TRA_M, { ax: axK }); });
        // råsponten med papp ovanpå: mörk topp, träkanter
        const tb = lada(bm - 0.012, 0.03, Ls), tg = tb.toNonIndexed(); tb.dispose();
        tg.translate(xm, T / 2 - 0.015, 0); fargNormal(tg, linj.papp, linj.tra); tg.applyMatrix4(Mk);
        ovr.bitar.push({ g: tg, farg: linj.papp, dir: dir.clone(), fas, tagg: 'kassett' });
        TAGG = 'isolering';
        const kar = lada(bm - 0.115, T - 0.045, Ls - 0.012); kar.translate(xm, -0.0225, 0); lagg(isol, kar, ULLF);
      }
      const c = new THREE.Vector3(0, T, 0).applyMatrix4(Mr);
      ank.kassett.push({ n: new THREE.Vector3(0, nY, nZ), p: ankV(c.clone().add(new THREE.Vector3(0, HK, sida * kassIsar(W))), new THREE.Vector3(0, HK, sida * kassIsar(W)), FAS_K) });
      ank.platt.push({ n: new THREE.Vector3(0, nY, nZ), p: ankV(c.clone().add(new THREE.Vector3(0, HP + 0.06, sida * takIsar(W))), new THREE.Vector3(0, HP, sida * takIsar(W)), FAS_T) });
    });

    // golvbjälklaget: reglar tvärs huset och kantreglar
    const yb = Y0 - 0.11, dB = new THREE.Vector3(0, HB, 0);
    TAGG = 'bjalklag';
    for (let x = xw + 0.12; x < xe - 0.08; x += 0.6) { const g = lada(0.045, 0.2, W - 0.24); g.translate(x, yb, 0); bit(tra, g, TRA, dB, FAS_B, { ax: new THREE.Vector3(0, 0, 1) }); }
    [-1, 1].forEach(sz => { const g = lada(L - 0.2, 0.2, 0.045); g.translate(0, yb, sz * (W / 2 - 0.12)); bit(tra, g, TRA_M, dB, FAS_B, { ax: new THREE.Vector3(1, 0, 0) }); });
    ank.bjalklag = [
      { n: new THREE.Vector3(0, 0, 1), p: ankV(new THREE.Vector3(xe * 0.55, Y0 + HB, zs - 0.12), new THREE.Vector3(0, HB, 0), FAS_B) },
      { n: new THREE.Vector3(0, 0, -1), p: ankV(new THREE.Vector3(xw * 0.55, Y0 + HB, zn + 0.12), new THREE.Vector3(0, HB, 0), FAS_B) },
      { n: new THREE.Vector3(1, 0, 0), p: ankV(new THREE.Vector3(xe - 0.12, Y0 + HB, zs * 0.4), new THREE.Vector3(0, HB, 0), FAS_B) },
      { n: new THREE.Vector3(-1, 0, 0), p: ankV(new THREE.Vector3(xw + 0.12, Y0 + HB, zn * 0.4), new THREE.Vector3(0, HB, 0), FAS_B) },
    ];
    // fler punkter ovanpå reglarna och på golvet (den första som syns används)
    ank.bjalklagYta = []; ank.golvYta = [];
    [0, -0.3, 0.3, -0.15, 0.15].forEach(fx => [0, 0.25, -0.25].forEach(fz => {
      const x = xw + 0.12 + Math.round((L / 2 + fx * L - 0.12) / 0.6) * 0.6;
      ank.bjalklagYta.push(ankV(new THREE.Vector3(Math.min(xe - 0.2, x), Y0 + HB - 0.01, fz * W), new THREE.Vector3(0, HB, 0), FAS_B));
      ank.golvYta.push(ankV(new THREE.Vector3(fx * L, Y0 + HB + 0.03, fz * W), new THREE.Vector3(0, HB, 0), FAS_B));
    }));

    const kantE = slaIhopLager(kant, 'P');
    const ut = [slaIhopLager(tra, 'P', LMt.tra), slaIhopLager(ovr, 'P'), slaIhopLager(panel, 'P', mat.fasad), kantE,
      slaIhopLager(vind, 'P', LMt.vind), slaIhopLager(isol, 'K', ISOL_MAT), slaIhopLager(gips, 'N'), slaIhopLager(plast, 'N', LMt.plast)].filter(Boolean);
    // ångspärren är genomskinlig: ingen skugga
    ut.forEach(e => { if (e.mat0 === LMt.plast) { e.mesh.castShadow = false; e.mesh.renderOrder = 3; } });
    if (kantE) kantE.kant = true;
    return { lista: ut, ank };
  }

  // entreprenaden: en grusbädd runt grunden och ett schakt ut mot tomtgränsen med ledningarna
  // i en sandbädd (blå PE för vatten, grått avlopp, orange kabelskyddsrör för el). Schaktet
  // ligger på den sida som vetter mot kameran och flyttas dit om man vrider runt huset.
  // Allt ligger som låga, mjuka vallar på marken (inga lådor, inget i markens eget plan).
  const BADD = 0.62, BADD_H = 0.15;
  // Mark och grund + Inkoppling el och VA. Grusbädden (makadam i kanterna, grus med fläckar på
  // toppen), en kantbalk i betong runt huset och ett grävt schakt ut mot tomtgränsen: sluttande
  // jordkanter, en vall av uppgrävd jord bredvid, sandbädd i botten och runda rör (vatten blått,
  // avlopp grått, el i orange skyddsrör) som går in i grundens betongkant. Schaktet ligger under
  // marken: en osynlig låda (bara djup, baksidorna, ritas efter marken) skär hålet i marken och
  // grusbädden, och schaktets ytor ritas i hålet (som produktkortens genomskärning).
  // betong: grå med porer och formens brädspår (samma program som ullen)
  let BETONG = null;
  function betongMat() {
    if (BETONG) return BETONG;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#a8a59d'; x.fillRect(0, 0, 256, 256);
    let fro = 23; const sl = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 500; i++) {
      x.fillStyle = sl() < 0.5 ? 'rgba(80,78,72,' + (0.05 + sl() * 0.08).toFixed(2) + ')' : 'rgba(200,198,190,' + (0.05 + sl() * 0.08).toFixed(2) + ')';
      const px = sl() * 256, py = sl() * 256, r = 3 + sl() * 14;
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { x.beginPath(); x.arc(px + dx, py + dy, r, 0, Math.PI * 2); x.fill(); }
    }
    for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(50,48,44,' + (0.25 + sl() * 0.35).toFixed(2) + ')'; x.beginPath(); x.arc(sl() * 256, sl() * 256, 0.5 + sl() * 1.3, 0, Math.PI * 2); x.fill(); }   // porer
    for (let y = 0; y < 256; y += 64) { x.fillStyle = 'rgba(70,68,62,0.28)'; x.fillRect(0, y, 256, 1.5); x.fillStyle = 'rgba(230,228,220,0.18)'; x.fillRect(0, y + 1.5, 256, 1); }   // brädspår var 10 cm
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    BETONG = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, map: t, bumpMap: t, bumpScale: 0.8 });
    return BETONG;
  }
  // jord: fläckig brun med småsten och rötter (färg och relief), 0,4 m per ruta
  let JORD = null;
  function jordMat() {
    if (JORD) return JORD;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#8a7660'; x.fillRect(0, 0, 256, 256);
    let fro = 17; const sl = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 1400; i++) {   // klumpar i olika ton
      const r = 2 + sl() * 12, v = sl();
      x.fillStyle = v < 0.5 ? 'rgba(60,44,30,' + (0.08 + sl() * 0.14).toFixed(2) + ')' : 'rgba(176,150,118,' + (0.06 + sl() * 0.12).toFixed(2) + ')';
      const px = sl() * 256, py = sl() * 256;
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { x.beginPath(); x.ellipse(px + dx, py + dy, r, r * (0.5 + sl() * 0.5), sl() * 3, 0, Math.PI * 2); x.fill(); }
    }
    for (let i = 0; i < 70; i++) {   // småsten: grå med en mörk skuggkant
      const px = sl() * 256, py = sl() * 256, r = 0.8 + sl() * 2, g = 112 + sl() * 40 | 0;
      x.fillStyle = 'rgba(40,30,22,0.35)'; x.beginPath(); x.arc(px + 0.7, py + 0.9, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgb(' + g + ',' + (g - 8) + ',' + (g - 22) + ')'; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(70,50,32,0.35)'; x.lineWidth = 0.8;   // tunna rötter
    for (let i = 0; i < 14; i++) { let px = sl() * 256, py = sl() * 256; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (sl() - 0.5) * 18; py += sl() * 10; x.lineTo(px, py); } x.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    JORD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, map: t, bumpMap: t, bumpScale: 1.6, side: THREE.DoubleSide });
    return JORD;
  }
  const ENT_MASK = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, side: THREE.BackSide });
  function trianglar(lista) {
    // lista: [[p, färg], ...] i grupper om tre; ger icke-indexerad geometri med färg per hörn
    const g = new THREE.BufferGeometry(), p = [], f = [];
    lista.forEach(([v]) => p.push(v[0], v[1], v[2]));
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    g.userData.farg = lista.map(x => x[1]);
    return g;
  }
  const quad = (ut, a, b, c, d, fa, fb, fc, fd) => { ut.push([a, fa], [b, fb], [c, fc], [a, fa], [c, fc], [d, fd]); };
  function byggEnt(H, sida) {
    TAGG = 'va';
    const L = H.L, W = H.W, ent = nyttLager(), d0 = new THREE.Vector3();
    let fro = 3;
    const slump = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    const ton = (c, k) => c.clone().multiplyScalar(1 + (slump() - 0.5) * k);
    // grusbädden: topp i rutor om 12 cm med fläckig färg (grus), sluttande kant i makadam
    const hx = L / 2 + BADD, hz = W / 2 + BADD, yT = BADD_H, yB = -0.06, ut = 0.2;
    const padT = [];
    {
      const nx = Math.ceil(2 * hx / 0.12), nz = Math.ceil(2 * hz / 0.12), dx = 2 * hx / nx, dz = 2 * hz / nz;
      const fg = []; for (let i = 0; i <= nx; i++) { fg.push([]); for (let j = 0; j <= nz; j++) fg[i].push(ton(linj.grus, 0.32)); }
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x0 = -hx + i * dx, z0 = -hz + j * dz;
        quad(padT, [x0, yT, z0], [x0, yT, z0 + dz], [x0 + dx, yT, z0 + dz], [x0 + dx, yT, z0], fg[i][j], fg[i][j + 1], fg[i + 1][j + 1], fg[i + 1][j]);
      }
      // kanten: fyra sluttande sidor, ljusare upptill
      const hornT = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]], hornB = [[-hx - ut, -hz - ut], [hx + ut, -hz - ut], [hx + ut, hz + ut], [-hx - ut, hz + ut]];
      for (let k = 0; k < 4; k++) {
        const a = hornT[k], b = hornT[(k + 1) % 4], c = hornB[(k + 1) % 4], d = hornB[k];
        const steg = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
        for (let s = 0; s < steg; s++) {
          const l = q => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q], m = q => [d[0] + (c[0] - d[0]) * q, d[1] + (c[1] - d[1]) * q];
          const p0 = l(s / steg), p1 = l((s + 1) / steg), q0 = m(s / steg), q1 = m((s + 1) / steg);
          const ft = ton(linj.makadam, 0.25), fb = ton(linj.makadam, 0.25).multiplyScalar(0.8);
          quad(padT, [p0[0], yT, p0[1]], [q0[0], yB, q0[1]], [q1[0], yB, q1[1]], [p1[0], yT, p1[1]], ft, fb, fb, ft);
        }
      }
    }
    // kantbalken: betong runt huset, 20 cm, med fasad överkant
    {
      const bet = new THREE.Color(0xb3afa6), betM = new THREE.Color(0x96928a);
      const yo = yT + 0.14, ox = L / 2 + 0.06, oz = W / 2 + 0.06, ix = L / 2 - 0.14, iz = W / 2 - 0.14, f = 0.02;
      const R = [[[-ox, -oz], [ox, -oz]], [[ox, -oz], [ox, oz]], [[ox, oz], [-ox, oz]], [[-ox, oz], [-ox, -oz]]];
      const Ri = [[[-ix, -iz], [ix, -iz]], [[ix, -iz], [ix, iz]], [[ix, iz], [-ix, iz]], [[-ix, iz], [-ix, -iz]]];
      const ff = [[-ox + f, -oz + f], [ox - f, -oz + f], [ox - f, oz - f], [-ox + f, oz - f]];
      const t = [];
      for (let k = 0; k < 4; k++) {
        const [a, b] = R[k], [ai, bi] = Ri[k], fa = ff[k], fb = ff[(k + 1) % 4];
        quad(t, [a[0], yB, a[1]], [b[0], yB, b[1]], [b[0], yo - f, b[1]], [a[0], yo - f, a[1]], betM, betM, bet, bet);            // utsidan
        quad(t, [a[0], yo - f, a[1]], [b[0], yo - f, b[1]], [fb[0], yo, fb[1]], [fa[0], yo, fa[1]], bet, bet, bet, bet);           // fasen
        quad(t, [fa[0], yo, fa[1]], [fb[0], yo, fb[1]], [bi[0], yo, bi[1]], [ai[0], yo, ai[1]], bet, bet, bet, bet);               // överkanten
      }
      const g = trianglar(t);
      ent.bitar.push({ g, farg: bet, dir: d0.clone(), fas: 0, tagg: 'grund' });
    }
    const n = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[sida], halv = n[0] ? L / 2 : W / 2;
    // schaktet byggs längs +z och vrids ut åt sidans normal
    const vrid = new THREE.Matrix4().makeRotationY(Math.atan2(n[0], n[1]));
    const s0 = halv + 0.06, s1 = halv + 5.2, D = 0.55, bT = 0.7, bB = 0.32, sl = 0.3;
    const sch = [], jord = nyttLager();
    {
      const jl = linj.jordLjus, jm = linj.jord;
      // jordytor: ett rutnät (a, b) med mjuka normaler och färg efter djupet (ljus upptill, mörk
      // nedtill), med jordens textur och relief (förr platta bruna polygoner)
      const brus = (p, q) => Math.sin(p * 7.3 + q * 11.1) * 0.5 + Math.sin(p * 17.9 - q * 23.7) * 0.3 + Math.sin(p * 41.3 + q * 37.1) * 0.2;
      const yta = (nu, nv, f, farg) => {
        const g = new THREE.PlaneGeometry(1, 1, nu, nv), pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) { const v = f(pp.getX(i) + 0.5, 0.5 - pp.getY(i)); pp.setXYZ(i, v[0], v[1], v[2]); }
        g.computeVertexNormals(); g.applyMatrix4(vrid);
        const gn = g.toNonIndexed(); g.dispose();
        const q = gn.attributes.position;
        gn.userData.farg = []; for (let i = 0; i < q.count; i++) gn.userData.farg.push(farg(q.getY(i)));
        bit(jord, gn, jl, d0, 0);
      };
      const JL = new THREE.Color(1.05, 1, 0.95), JM = new THREE.Color(0.5, 0.45, 0.4);   // (texturen ger den bruna färgen)
      const djupF = y => JL.clone().lerp(JM, Math.min(1, Math.max(0, -y / D)) * 0.9);
      // sidorna, sluttande och ojämna (ytan buktar in och ut några cm, inte vid kanterna)
      const nu = Math.ceil((s1 - s0) / 0.08);
      for (const sx of [-1, 1]) yta(nu, 7, (a, b) => {
        const zt = s0 + (s1 - s0) * a, zb = s0 + (s1 - sl - s0) * a, z = zt + (zb - zt) * b, y = -D * b;
        const d = brus(z * 1.3, y * 2.1 + sx) * 0.007 * Math.sin(Math.PI * b) * Math.min(1, a * 8);   // rena, skurna väggar
        return [sx * (bT + (bB - bT) * b - d), y, z];
      }, djupF);
      // bortre änden, sluttande
      yta(10, 7, (a, b) => {
        const x = (a * 2 - 1) * (bT + (bB - bT) * b), y = -D * b;
        return [x, y, s1 - sl * b - brus(x * 2.3, y * 2.7) * 0.007 * Math.sin(Math.PI * b)];
      }, djupF);
      // (ingen vall av uppgrävd jord: sprängvyn visas i studion, schaktet ska se rent ut)
      // botten under sanden, ända fram till grundens kant
      quad(sch, [-bB, -D, s0 + 0.004], [-bB, -D, s1 - sl], [bB, -D, s1 - sl], [bB, -D, s0 + 0.004], jm, jm, jm, jm);
      // återfyllningen: den bortre delen av schaktet är redan igenfylld med sand över rören (en
      // ojämn yta mellan slänterna, med en mjuk front ned mot rören)
      const zA = s0 + (s1 - s0) * 0.62, yA = -D + 0.34;
      yta(10, Math.ceil((s1 - sl - zA + 0.3) / 0.08), (a, b) => {
        const z = zA - 0.28 + (s1 - zA + 0.28) * b, fr = Math.min(1, Math.max(0, (z - zA + 0.28) / 0.28));
        const y = -D + 0.09 + (yA - (-D + 0.09)) * (fr * fr * (3 - 2 * fr)) + brus(z * 3.3, a * 4.1) * 0.012 * fr;
        const hx = bT + (bB - bT) * (-y / D) - 0.01;
        return [(a * 2 - 1) * hx * (1 - 0.04 * fr), y + (1 - Math.abs(a * 2 - 1)) * 0.015 * fr, Math.min(z, s1 - sl * (-y / D) - 0.005)];
      }, () => new THREE.Color(1.55, 1.38, 1.05));
    }
    const sg = trianglar(sch); sg.applyMatrix4(vrid);
    ent.bitar.push({ g: sg, farg: linj.jord, dir: d0.clone(), fas: 0, tagg: 'va' });
    const lagg = (g, f) => { g.applyMatrix4(vrid); bit(ent, g, f, d0, 0); };
    // sandbädden under rören
    { const g = new THREE.BoxGeometry(2 * bB - 0.01, 0.09, s1 - sl - s0 - 0.012); g.translate(0, -D + 0.045, (s0 + 0.008 + s1 - sl) / 2); lagg(g, linj.sand); }
    // Husets ände: schaktet slutar mot grundens lodräta betongkant (sockeln), med formens
    // brädspår. Kanten är bredare och djupare än schaktet, så att den går in i jordväggarna och
    // botten (ingen fog syns). Rören går längs sandbädden, böjs upp 90°, går en bit lodrätt (synlig
    // stigare), böjs 90° in mot huset och går in i kanten genom en genomföring med gummikrage.
    const bet = nyttLager();
    { const g = new THREE.BoxGeometry(2 * bT + 0.24, D + 0.12, 0.14); g.translate(0, -(D + 0.12) / 2 - 0.004, s0 - 0.064); /* framsidan 6 mm framför hålets kant */ g.applyMatrix4(vrid); bit(bet, g, new THREE.Color(1, 1, 1), d0, 0); }
    // rören: vatten PEM 32 mm (blått), avlopp PP 110 mm (grått), el i orange korrugerat
    // skyddsrör 50 mm; [läge tvärs, radie, färg, böjradie, höjd där röret går in, korrugerat]
    [[-0.2, 0.016, linj.vatten, 0.08, -0.17, false], [0.0, 0.055, linj.avlopp, 0.1, -0.13, false], [0.2, 0.025, linj.el, 0.09, -0.15, true]].forEach(([o, r, f, R, yIn, korr]) => {
      const yc = -D + 0.09 + r, zr = s0 + 0.045 + R + r;
      const V = (y, z) => new THREE.Vector3(o, y, z), k = 0.5523;   // (kvartscirkel som Bézier)
      const vag = new THREE.CurvePath();
      vag.add(new THREE.LineCurve3(V(yc, s1 - 0.02), V(yc, zr + R)));
      vag.add(new THREE.CubicBezierCurve3(V(yc, zr + R), V(yc, zr + R - R * k), V(yc + R - R * k, zr), V(yc + R, zr)));
      vag.add(new THREE.LineCurve3(V(yc + R, zr), V(yIn - R, zr)));
      vag.add(new THREE.CubicBezierCurve3(V(yIn - R, zr), V(yIn - R + R * k, zr), V(yIn, zr - R + R * k), V(yIn, zr - R)));
      vag.add(new THREE.LineCurve3(V(yIn, zr - R), V(yIn, s0 - 0.05)));
      const rs = korr ? 14 : 22, seg = Math.ceil(vag.getLength() / (korr ? 0.012 : 0.03));
      const g = new THREE.TubeGeometry(vag, seg, r, rs, false);
      if (korr) {
        // korrugeringen: radien böljar var 12 mm längs röret
        const p = g.attributes.position, nn = g.attributes.normal;
        for (let i = 0; i < p.count; i++) { const d = 0.0022 * Math.cos(Math.floor(i / (rs + 1)) * Math.PI); p.setXYZ(i, p.getX(i) + nn.getX(i) * d, p.getY(i) + nn.getY(i) * d, p.getZ(i) + nn.getZ(i) * d); }
        g.computeVertexNormals();
      }
      lagg(g, f);
      // genomföringen i kanten: en grå hylsa som sticker ut 3 cm och en svart gummikrage runt röret
      const h = new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.04, 28, 1, true); h.rotateX(Math.PI / 2); h.translate(o, yIn, s0 + 0.026); lagg(h, new THREE.Color(0x9a9b98));
      const fl = new THREE.RingGeometry(r * 1.05, r * 1.5, 28); fl.translate(o, yIn, s0 + 0.046); lagg(fl, new THREE.Color(0x8d8e8b));
      const t = new THREE.TorusGeometry(r * 1.12, r * 0.2 + 0.003, 8, 28); t.translate(o, yIn, s0 + 0.05); lagg(t, new THREE.Color(0x2a2b2d));
    });
    // markeringsband ovanpå återfyllningen: gult över elen, blått över vattnet
    const tejp = nyttLager();
    [[0.2, new THREE.Color(0xf2c230)], [-0.19, new THREE.Color(0x3d7fd6)]].forEach(([o, f]) => {
      const zA = s0 + (s1 - s0) * 0.62, z0 = zA + 0.05, z1 = s1 - 0.25, g = new THREE.BoxGeometry(0.075, 0.002, z1 - z0);
      g.translate(o, -D + 0.34 + 0.015 * (1 - Math.abs(o) / 0.62) + 0.008, (z0 + z1) / 2); g.applyMatrix4(vrid);
      bit(tejp, g, f, d0, 0);
    });
    const post = slaIhopLager(ent, 'E', MARK_MAT);
    post.mesh.renderOrder = 6;
    // jordytorna (slänterna, änden och vallen) i ett eget nät med jordens textur, som barn till posten
    const jp = slaIhopLager(jord, 'E', jordMat());
    if (jp) { jp.mesh.userData.lager = jp; jp.mesh.visible = true; jp.mesh.renderOrder = 6; jp.mesh.castShadow = false; post.mesh.add(jp.mesh); }
    // sulan (betong) och markeringsbanden, också som barn till posten
    [[bet, betongMat()], [tejp, lagerMat().tejp]].forEach(([lg, m]) => {
      const e = slaIhopLager(lg, 'E', m);
      if (e) { e.mesh.userData.lager = e; e.mesh.visible = true; e.mesh.renderOrder = 6; e.mesh.castShadow = false; post.mesh.add(e.mesh); }
    });
    // grusbädden ritas före hålet (så att schaktet skär igenom den), hålet före schaktet
    const pad = new THREE.Mesh(trianglar(padT), MARK_MAT); pad.renderOrder = 4; pad.receiveShadow = true; pad.castShadow = false;
    pad.geometry.setAttribute('color', new THREE.Float32BufferAttribute(pad.geometry.userData.farg.flatMap(c => [c.r, c.g, c.b]), 3));
    const mg = new THREE.BoxGeometry(2 * bT - 0.004, D + 0.12, s1 - s0 - 0.002); mg.translate(0, -(D + 0.12) / 2 + 0.006, (s0 + s1) / 2 + 0.001); mg.applyMatrix4(vrid);
    const mask = new THREE.Mesh(mg, ENT_MASK); mask.renderOrder = 5; mask.frustumCulled = false;
    pad.userData.tagg = 'grund';
    post.mesh.add(pad, mask);
    const P = s => new THREE.Vector3(n[0] * s, 0, n[1] * s);
    const nv = new THREE.Vector3(n[0], 0, n[1]);
    return {
      post, sida, slut: [n[0] * s1, n[1] * s1],
      // en enda fast punkt på schaktets övre kant (inte mitt bland rören): pricken byter aldrig plats
      ank: [(() => { const tx = new THREE.Vector3(1, 0, 0).applyMatrix4(new THREE.Matrix4().extractRotation(vrid)); return { n: tx.clone().setY(0.4).normalize(), p: new THREE.Vector3(0, 0.02, 0).add(P(halv + 2.2)).addScaledVector(tx, bT + 0.03) }; })()],
      grund: [-1, 1].flatMap(sx => [-1, 1].map(sz => ({ n: new THREE.Vector3(sx, 0, sz).normalize(), p: new THREE.Vector3(sx * (L / 2 + BADD - 0.18), BADD_H, sz * (W / 2 + BADD - 0.18)) }))),
    };
  }

  // innerväggarnas stomme ur inredningens hinder (finns när inredningen är byggd)
  function byggInnervaggar(hus, H) {
    let hl = null;
    try { hl = I.inneData().hinder; } catch (e) { hl = null; }
    if (!Array.isArray(hl)) return null;
    const dl = hus.userData.delar, Y0 = dl.Y0, hW = Math.min(2.35, Math.min(dl.hN, dl.hS) - 0.06);
    const tra = nyttLager(), dB = new THREE.Vector3(0, HB, 0);
    TAGG = 'innervagg';
    let sum = new THREE.Vector3(), antal = 0;
    const lista = [];
    hl.filter(b => b && b.typ === 'vagg' && b.niva === 'botten').forEach(b => {
      const xa = Math.min(b.x0, b.x1), xb = Math.max(b.x0, b.x1), za = Math.min(b.z0, b.z1), zb = Math.max(b.z0, b.z1);
      const lx = xb - xa, lz = zb - za;
      if (Math.max(lx, lz) < 0.3) return;
      if (Math.abs(xa) > H.L / 2 - 0.25 && Math.abs(xb) > H.L / 2 - 0.25) return;
      const langsX = lx >= lz, len = Math.max(lx, lz), tj = Math.min(0.07, Math.min(lx, lz) * 0.7), cx = (xa + xb) / 2, cz = (za + zb) / 2;
      const box = (l, h, y, off) => {
        const g = langsX ? lada(l, h, tj) : lada(tj, h, l);
        g.translate(cx + (langsX ? off : 0), Y0 + y, cz + (langsX ? 0 : off));
        bit(tra, g, linj.tra, dB, FAS_B);
      };
      box(len, 0.045, 0.0225, 0); box(len, 0.045, hW - 0.0225, 0);
      const n = Math.max(1, Math.round(len / 0.6));
      for (let i = 0; i <= n; i++) box(0.045, hW - 0.09, hW / 2, -len / 2 + 0.0225 + (len - 0.045) * i / n);
      sum.add(new THREE.Vector3(cx, Y0 + HB + hW * 0.75, cz)); antal++;
      lista.push(ankV(new THREE.Vector3(cx, Y0 + HB + hW - 0.02, cz), dB, FAS_B), ankV(new THREE.Vector3(cx, Y0 + HB + hW * 0.6, cz), dB, FAS_B));
    });
    const e = slaIhopLager(tra, 'P');
    if (!e) return null;
    return { post: e, ank: [{ n: new THREE.Vector3(0, 1, 0), p: ankV(sum.multiplyScalar(1 / antal), dB, FAS_B) }], lista };
  }

  // ---- öarna i ett hopslaget nät: de ursprungliga delarna (motorn minns var var och en börjar,
  // userData.bitar). Ett nät som inte slagits ihop är en enda del. Delarna slås aldrig ihop efter
  // läge: väggarna möts i hörnen, och då blev alla fyra en ö som flyttades åt samma håll.
  const OAR = new WeakMap();
  function oar(mesh) {
    const geo = mesh.geometry;
    if (OAR.has(geo)) return OAR.get(geo);
    const pos = geo.attributes.position, n = pos.count, p = pos.array;
    const b0 = mesh.userData.bitar;
    const st = b0 && b0.length && b0[b0.length - 1] < n ? b0 : new Uint32Array(1);
    const m = st.length, o = new Uint32Array(n), c = new Float64Array(m * 3), cnt = new Uint32Array(m);
    const lo = new Float64Array(m * 3).fill(1e9), hi = new Float64Array(m * 3).fill(-1e9);
    for (let k = 0; k < m; k++) {
      const a = st[k], b = k + 1 < m ? st[k + 1] : n;
      for (let i = a; i < b; i++) {
        o[i] = k; cnt[k]++;
        for (let d = 0; d < 3; d++) { const v = p[i * 3 + d]; c[k * 3 + d] += v; if (v < lo[k * 3 + d]) lo[k * 3 + d] = v; if (v > hi[k * 3 + d]) hi[k * 3 + d] = v; }
      }
    }
    for (let k = 0; k < m; k++) { const q = cnt[k] || 1; c[k * 3] /= q; c[k * 3 + 1] /= q; c[k * 3 + 2] /= q; }
    const ut = { o, m, c, n, lo, hi };
    OAR.set(geo, ut);
    return ut;
  }

  // ---- förberedelse: vad varje del är och vart den ska ----
  function forbered(hus) {
    const id = ritare.val().modell, H = HUS[id], dl = hus.userData.delar, Y0 = dl.Y0;
    const L = H.L, W = H.W, xw = -L / 2, xe = L / 2, zn = -W / 2, zs = W / 2;
    const R = ramar(H, dl);
    const hal = H.oppningar.map(o => ({ s: o[0], u0: o[1], u1: o[1] + o[2], v0: o[3], v1: o[3] + o[4], typ: o[5] }));
    const UP = new THREE.Vector3(0, 1, 0);
    const vaggDir = s => R[s].n.clone().multiplyScalar(D).addScaledVector(UP, UPV);
    // fönster och dörrar följer först med sin vägg och glider sedan ut framför sitt hål
    const halUt = s => R[s].n.clone().multiplyScalar(FONSTER_UT).addScaledVector(UP, 0.1);
    const narmasteSida = (x, z) => {
      const d = [['S', Math.abs(z - zs)], ['N', Math.abs(z - zn)], ['E', Math.abs(x - xe)], ['W', Math.abs(x - xw)]];
      d.sort((a, b) => a[1] - b[1]);
      return d[0][0];
    };
    // hela delen (dess låda, i väggens u/v/n) ryms vid ett hål: karm, båge, glas, foder, bleck
    const iHal = bb => {
      for (const h of hal) {
        const r = R[h.s];
        let u0 = 1e9, u1 = -1e9, n0 = 1e9, n1 = -1e9;
        [bb[0], bb[3]].forEach(x => [bb[2], bb[5]].forEach(z => {
          const dx = x - r.o.x, dz = z - r.o.z, u = dx * r.u.x + dz * r.u.z, nn = dx * r.n.x + dz * r.n.z;
          u0 = Math.min(u0, u); u1 = Math.max(u1, u); n0 = Math.min(n0, nn); n1 = Math.max(n1, nn);
        }));
        if (u0 > h.u0 - 0.26 && u1 < h.u1 + 0.26 && bb[1] > h.v0 - 0.4 && bb[4] < h.v1 + 0.4 && n0 > -0.45 && n1 < 0.45) { iHal.typ = h.typ; return h.s; }
      }
      return null;
    };
    const DOLDA_MAT = new Set([mat.rum, mat.insida, mat.skuggrand, mat.snoLager, mat.spill, mat.lampKon].filter(Boolean));
    const FONSTER_MAT = new Set([mat.glas, mat.frostGlas, mat.bagYtter, mat.bagInsida, mat.dorr, mat.handtag].filter(Boolean));
    const geoAntal = new Map();
    hus.traverse(o => { if (o.isMesh && o.geometry) geoAntal.set(o.geometry, (geoAntal.get(o.geometry) || 0) + 1); });
    const poster = [], objekt = [], dolda = [];
    const ig = hus.userData.inne;
    // vad en del är: [kategori, riktning, fas, riktning 2, fas 2] (null = döljs i vyn)
    const vaggOn = (m, x, y, z, bb) => {
      if (DOLDA_MAT.has(m)) return null;
      if (m === mat.fasadKupa) return ['P', vaggDir('S'), FAS_V, null, 0, 'stomme'];
      const s = narmasteSida(x, z);
      if (m === mat.fasad) return ['P', vaggDir(s), FAS_V, null, 0, 'stomme'];
      // smygen (hålets mörka insida, 16 cm djup) hör till väggen: fönstret och dörren lyfts ut
      // utan den och blir inte en djup, tung låda framför hålet
      const djup = s === 'N' || s === 'S' ? bb[5] - bb[2] : bb[3] - bb[0];
      if (m === mat.detaljMork && djup > 0.12 && djup < 0.3 && iHal(bb)) return ['P', vaggDir(s), FAS_V, null, 0, 'stomme'];
      const sh = iHal(bb);
      if (sh) return ['K', vaggDir(sh), FAS_V, halUt(sh), FAS_F, /^(d|dg|sk)$/.test(iHal.typ) ? 'dorr' : 'fonster'];
      if (FONSTER_MAT.has(m)) return ['K', vaggDir(s), FAS_V, halUt(s), FAS_F, m === mat.dorr ? 'dorr' : 'fonster'];
      return ['P', vaggDir(s), FAS_V, null, 0, 'stomme'];
    };
    // taket: plåten med allt som sitter på den (vindskivor, takfotsbrädor, rännor, stuprör,
    // genomföringar, snörasskydd) lyfts som en enhet; sadeltakets fall glider isär
    const takOn = (m, x, y, z, bb) => {
      if (DOLDA_MAT.has(m)) return null;
      // stupröret (det lodräta röret, svepen, böjen och utkastaren nedtill) följer väggen det sitter
      // på; bara böjen upp till rännan följer taket. Förr hängde röret ned från det lyfta taket
      // genom kassetterna och väggarnas skikt.
      if (m === mat.stupror && ((bb[4] - bb[1] > 0.6 && Math.max(bb[3] - bb[0], bb[5] - bb[2]) < 0.12) || bb[4] < Math.min(dl.hN, dl.hS) - 0.3)) return ['K', vaggDir(narmasteSida(x, z)), FAS_V, null, 0, 'platt'];
      const sida = H.tak === 'sadel' ? (z < -0.15 ? -1 : z > 0.15 ? 1 : 0) : 0;
      return ['K', new THREE.Vector3(0, HP, sida * takIsar(W)), FAS_T, null, 0, 'platt'];
    };
    const v0 = new THREE.Vector3();
    function hantera(grupp, regel) {
      grupp.children.forEach(o => {
        if (o === ig) return;
        if (!o.visible) return;
        const enkel = o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position &&
          !o.geometry.attributes.position.isInterleavedBufferAttribute && geoAntal.get(o.geometry) === 1 && isIdentitet(o);
        if (enkel) {
          const m0 = o.material;
          if (!Array.isArray(m0) && (DOLDA_MAT.has(m0) || !(m0.isMeshStandardMaterial || m0.isMeshPhysicalMaterial || m0.isMeshLambertMaterial || m0.isMeshPhongMaterial || m0.isMeshBasicMaterial))) { dolda.push(o); return; }
          const geo = o.geometry, oa = oar(o), M = oa.m;
          const dir = new Float32Array(M * 3), fas = new Float32Array(M), dir2 = new Float32Array(M * 3), fas2 = new Float32Array(M), kat = new Uint8Array(M);
          const tagg = new Array(M).fill(null);
          const mm = Array.isArray(m0) ? m0[0] : m0;
          let alla = true, tva = false;
          for (let k = 0; k < M; k++) {
            const bb = [oa.lo[k * 3], oa.lo[k * 3 + 1], oa.lo[k * 3 + 2], oa.hi[k * 3], oa.hi[k * 3 + 1], oa.hi[k * 3 + 2]];
            const r = regel(mm, oa.c[k * 3], oa.c[k * 3 + 1], oa.c[k * 3 + 2], bb);
            if (!r) { alla = false; kat[k] = 0; continue; }
            tagg[k] = r[5] || null;
            kat[k] = RANG[r[0]]; dir[k * 3] = r[1].x; dir[k * 3 + 1] = r[1].y; dir[k * 3 + 2] = r[1].z; fas[k] = r[2];
            if (r[3]) { tva = true; dir2[k * 3] = r[3].x; dir2[k * 3 + 1] = r[3].y; dir2[k * 3 + 2] = r[3].z; fas2[k] = r[4]; }
          }
          if (!alla && [...kat].every(v => v === 0)) { dolda.push(o); return; }
          for (let k = 0; k < M; k++) if (kat[k] === 0) kat[k] = RANG.X;
          poster.push({ mesh: o, geo, o: oa.o, dir, fas, dir2: tva ? dir2 : null, fas2: tva ? fas2 : null, kat, m0, orig: null, tagg });
          return;
        }
        if (o.isSprite || o.isPoints || o.isLine) { dolda.push(o); return; }
        // grupper, egna lägen och delad geometri: hela objektet flyttas
        const b = new THREE.Box3().setFromObject(o);
        if (b.isEmpty()) return;
        // lådan i gruppens koordinater (husets, väggarna och taket ligger Y0 upp)
        const lb = new THREE.Box3();
        [b.min.x, b.max.x].forEach(x => [b.min.y, b.max.y].forEach(y => [b.min.z, b.max.z].forEach(z => { hus.worldToLocal(v0.set(x, y, z)); if (grupp !== hus) v0.y -= Y0; lb.expandByPoint(v0); })));
        const c = lb.getCenter(new THREE.Vector3());
        let m1 = null;
        o.traverse(x => { if (!m1 && x.isMesh && !Array.isArray(x.material)) m1 = x.material; });
        const r = regel(m1, c.x, c.y, c.z, [lb.min.x, lb.min.y, lb.min.z, lb.max.x, lb.max.y, lb.max.z]);
        if (!r) { dolda.push(o); return; }
        const mats = [];
        o.traverse(x => { if (x.isMesh) mats.push({ mesh: x, m0: x.material }); });
        objekt.push({ obj: o, p0: o.position.clone(), dir: r[1].clone(), fas: r[2], dir2: r[3] ? r[3].clone() : null, fas2: r[4] || 0, kat: RANG[r[0]], mats, tagg: r[5] || null });
      });
    }
    function isIdentitet(o) {
      return o.position.lengthSq() === 0 && o.quaternion.x === 0 && o.quaternion.y === 0 && o.quaternion.z === 0 && o.scale.x === 1 && o.scale.y === 1 && o.scale.z === 1;
    }
    hantera(dl.vaggar, vaggOn);
    hantera(dl.tak, takOn);
    // grunden (sockeln) står kvar; uteplatsen, trappsteg och möbler göms i vyn
    const ovrigt = hus.children.filter(o => o !== dl.vaggar && o !== dl.tak && o !== dl.so && !/^sprang-/.test(o.name || ''));
    ovrigt.forEach(o => { if (o.visible) dolda.push(o); });
    if (dl.so) objekt.push({ obj: dl.so, p0: dl.so.position.clone(), dir: new THREE.Vector3(), fas: 0, dir2: null, fas2: 0, kat: RANG.E, mats: [{ mesh: dl.so, m0: dl.so.material }], tagg: 'grund' });
    // skiktsnittet (en gång per hus)
    if (!hus.userData.sprangLager) hus.userData.sprangLager = byggLager(hus, H);
    const LG = hus.userData.sprangLager;
    // panelens sågade kanter i fasadens färg (en aning mörkare); fasadfärgen kan ha bytts sedan
    LG.lista.forEach(e => {
      if (!e.kant) return;
      const c = mat.fasad.color, k = c.r + ',' + c.g + ',' + c.b;
      if (e.kantFarg === k) return;
      e.kantFarg = k;
      const a = e.mesh.geometry.attributes.color;
      for (let i = 0; i < a.count; i++) a.setXYZ(i, c.r * 0.82, c.g * 0.82, c.b * 0.82);
      a.needsUpdate = true;
    });
    const rikt = riktning();
    const EN = entPa(hus, H, kameraSida(hus, null));
    const lager = { lista: LG.lista.concat([EN.post]) };
    lager.lista.forEach(e => { if (!e.mesh.parent) hus.add(e.mesh); });
    const ank = Object.assign({}, LG.ank, { va: EN.ank, grund: EN.grund });
    return { hus, id, H, poster, objekt, dolda, lager, ank, inner: null, Y0, rikt, slut: EN.slut };
  }
  // husets sida (i husets koordinater) som vetter mot kameran; den nuvarande behålls tills en
  // annan sida är klart bättre (inget fladder när man vrider precis över ett hörn)
  const SIDNORM = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
  function kameraSida(hus, nu) {
    const d = kamera.position.clone().sub(styr.target);
    d.applyQuaternion(hus.getWorldQuaternion(new THREE.Quaternion()).invert());
    d.y = 0; d.normalize();
    const dot = k => SIDNORM[k][0] * d.x + SIDNORM[k][1] * d.z;
    let bast = 'S';
    Object.keys(SIDNORM).forEach(k => { if (dot(k) > dot(bast)) bast = k; });
    return nu && dot(nu) > dot(bast) - 0.25 ? nu : bast;
  }
  // schaktet på sidan (byggs om bara när sidan byts)
  function entPa(hus, H, sida) {
    const gammal = hus.userData.sprangEnt;
    if (gammal && gammal.sida === sida) return gammal;
    if (gammal) { hus.remove(gammal.post.mesh); gammal.post.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    return (hus.userData.sprangEnt = byggEnt(H, sida));
  }
  // medan vyn är öppen: följ kameran runt huset
  function foljEnt(B) {
    const gammal = B.hus.userData.sprangEnt, sida = kameraSida(B.hus, gammal && gammal.sida);
    if (gammal && gammal.sida === sida) return;
    const EN = entPa(B.hus, B.H, sida);
    const i = B.lager.lista.findIndex(e => e.kat[0] === RANG.E);
    if (i >= 0) B.lager.lista[i] = EN.post; else B.lager.lista.push(EN.post);
    if (!EN.post.mesh.parent) B.hus.add(EN.post.mesh);
    B.ank.va = EN.ank; B.ank.grund = EN.grund;
    S.satt = -1;
    satsSteg(B, S.steg);
    synlighet(B, S.t);
  }

  // bilen och rekvisitan nära huset (miljöns saker inom några meter): göms medan vyn är öppen
  function narSaker(B) {
    const hus = B.hus, H = B.H, hp = hus.getWorldPosition(new THREE.Vector3());
    const mx = H.L / 2 + D + FONSTER_UT + 2.5, mz = H.W / 2 + D + FONSTER_UT + 2.5;
    const ut = [], box = new THREE.Box3(), c = new THREE.Vector3(), st = new THREE.Vector3();
    const kolla = (o, djup) => {
      if (o === hus || o.isLight || o.isCamera || !o.visible) return;
      box.makeEmpty();
      try { box.setFromObject(o); } catch (e) { return; }
      if (box.isEmpty()) return;
      box.getSize(st); box.getCenter(c);
      if (st.y < 0.3 && Math.max(st.x, st.z) > 1.5) return;   // mark, gångar och uppfart får ligga kvar
      if (Math.max(st.x, st.z) > 9 || st.y > 9) { if (djup < 5) o.children.forEach(k => kolla(k, djup + 1)); return; }
      if (Math.abs(c.x - hp.x) < mx + st.x / 2 && Math.abs(c.z - hp.z) < mz + st.z / 2 && box.min.y < hp.y + 3) ut.push(o);
    };
    I.scene.children.forEach(o => kolla(o, 0));
    return ut;
  }

  // rekvisitan nära huset (och miljöns signatur, så att ett miljöbyte märks medan vyn är öppen)
  const miljoSign = () => { const c = I.scene.children; return c.length + ':' + (c[c.length - 1] ? c[c.length - 1].uuid : ''); };
  function rekvisita(B) {
    if (B.rekvisita) B.rekvisita.forEach(r => { r.o.visible = r.syn; });
    try { B.rekvisita = narSaker(B).map(o => ({ o, syn: o.visible })); } catch (e) { console.warn(e); B.rekvisita = []; }
    B.miljo = miljoSign(); B.traff = null; B.lappNyckel = null;
  }

  // ---- läget t (0 ihop … 1 isär) på alla delar ----
  const lokal = (t, f) => inUt(Math.min(1, Math.max(0, (t - f) / (1 - FAS_MAX))));
  function satt(B, t) {
    const alla = B.poster.concat(B.lager.lista, B.inner ? [B.inner.post] : []);
    alla.forEach(P => {
      const geo = P.mesh.geometry, pos = geo.attributes.position;
      if (P.egen) {
        if (!P.orig) P.orig = pos.array.slice();
      } else {
        // geometrin byttes under tiden (t.ex. ett fönster byggdes om): lämna den
        if (geo !== P.geo || pos.array.length !== P.n3) { if (P.orig) P.trasig = true; }
        if (P.trasig) return;
        if (!P.orig) { P.orig = pos.array.slice(); P.n3 = pos.array.length; P.ofc = P.mesh.frustumCulled; }
      }
      const a = pos.array, o = P.orig, oi = P.o, fs = P.fas, m = fs.length;
      // förflyttningen per del (två steg för fönstren), sedan samma för alla dess hörn
      const f = P.f || (P.f = new Float32Array(m * 3)), d = P.dir, d2 = P.dir2, f2 = P.fas2;
      for (let k = 0; k < m; k++) {
        const e = lokal(t, fs[k]), e2 = d2 ? lokal(t, f2[k]) : 0, kk = k * 3;
        f[kk] = d[kk] * e + (d2 ? d2[kk] * e2 : 0); f[kk + 1] = d[kk + 1] * e + (d2 ? d2[kk + 1] * e2 : 0); f[kk + 2] = d[kk + 2] * e + (d2 ? d2[kk + 2] * e2 : 0);
      }
      // skiktens egna bitar (reglar, läkt, ull, panelens lockläkt …) syns först när deras del börjat
      // glida ut: ihop ligger de i väggen och skulle annars sticka igenom fasaden eller flimra mot
      // den. Dolda bitar dras ihop till en punkt (sin mittpunkt), samma pris som att flytta dem.
      let dold = null;
      if (P.egen && P.kat[0] !== RANG.E) {
        if (!P.cen) {
          P.cen = new Float32Array(m * 3); const cnt = new Uint32Array(m);
          for (let i = 0, n = o.length / 3; i < n; i++) { const k = oi[i]; P.cen[k * 3] += o[i * 3]; P.cen[k * 3 + 1] += o[i * 3 + 1]; P.cen[k * 3 + 2] += o[i * 3 + 2]; cnt[k]++; }
          for (let k = 0; k < m; k++) { const q = cnt[k] || 1; P.cen[k * 3] /= q; P.cen[k * 3 + 1] /= q; P.cen[k * 3 + 2] /= q; }
        }
        dold = P.dold || (P.dold = new Uint8Array(m));
        for (let k = 0; k < m; k++) dold[k] = lokal(t, fs[k]) + (d2 ? lokal(t, f2[k]) : 0) < 0.012 ? 1 : 0;
      }
      for (let i = 0, n = a.length / 3; i < n; i++) {
        const k = oi[i], kk = k * 3, j = i * 3;
        if (dold && dold[k]) { a[j] = P.cen[kk]; a[j + 1] = P.cen[kk + 1]; a[j + 2] = P.cen[kk + 2]; continue; }
        a[j] = o[j] + f[kk]; a[j + 1] = o[j + 1] + f[kk + 1]; a[j + 2] = o[j + 2] + f[kk + 2];
      }
      pos.needsUpdate = true;
      P.mesh.frustumCulled = false;
    });
    B.objekt.forEach(X => { X.obj.position.copy(X.p0).addScaledVector(X.dir, lokal(t, X.fas)); if (X.dir2) X.obj.position.addScaledVector(X.dir2, lokal(t, X.fas2)); });
    const ig = B.hus.userData.inne;
    if (ig) { if (B.igY === undefined) B.igY = ig.position.y; ig.position.y = B.igY + HB * lokal(t, FAS_B); }
  }
  // vad som syns i full färg och vad som tonas, efter steget
  function satsSteg(B, steg) {
    const r = steg + 1;
    B.poster.forEach(P => {
      if (P.trasig) return;
      const geo = P.mesh.geometry, kat = P.kat, oi = P.o, idx = geo.index, n = idx ? idx.count : geo.attributes.position.count;
      if (Array.isArray(P.m0)) { P.mesh.material = [...kat].some(v => v <= r) ? P.m0 : GHOST; return; }
      const full = v => v <= r;
      let runs = [], start = 0, forra = null;
      for (let t = 0; t + 2 < n; t += 3) {
        const f = full(kat[oi[idx ? idx.getX(t) : t]]);
        if (forra === null) forra = f;
        else if (f !== forra) { runs.push([start, t - start, forra]); start = t; forra = f; }
      }
      if (forra !== null) runs.push([start, n - start, forra]);
      geo.clearGroups();
      if (runs.length <= 1) { P.mesh.material = runs.length && !runs[0][2] ? GHOST : sprMat(P.m0); return; }
      runs.forEach(([s, c, f]) => geo.addGroup(s, c, f ? 0 : 1));
      P.mesh.material = [sprMat(P.m0), GHOST];
    });
    B.objekt.forEach(X => { X.mats.forEach(q => { q.mesh.material = X.kat <= r ? sprMat(q.m0) : GHOST; }); });
    B.lager.lista.forEach(e => { e.mesh.material = e.kat[0] <= r ? e.mat0 : GHOST; });
    if (B.inner) B.inner.post.mesh.material = LAGER_MAT;
  }
  function synlighet(B, t) {
    const syns = t > 0.001;
    // grusbädden och ledningarna finns bara i entreprenaden
    B.lager.lista.forEach(e => { e.mesh.visible = syns && (e.kat[0] !== RANG.E || S.steg >= 3 || !S.pa); });
    if (B.inner) B.inner.post.mesh.visible = syns;
    // helt ihop (isärdragningen nere vid 0 %, inget har börjat röra sig): huset ser ut som vanligt,
    // med trappsteg, uteplats och saker runt om
    const ihop = !syns || lokal(t, FAS_T) < 0.004;
    B.dolda.forEach(o => { if (o.userData.sprangSyn === undefined) o.userData.sprangSyn = o.visible; o.visible = ihop && o.userData.sprangSyn; });
    if (B.rekvisita) B.rekvisita.forEach(r => { r.o.visible = ihop && r.syn; });
    const mg = I.matt();
    if (mg && syns) mg.visible = false;
    const ig = B.hus.userData.inne;
    if (ig && syns) ig.visible = S.steg >= 2;
  }
  function aterstall(B) {
    B.poster.forEach(P => {
      if (!P.trasig && P.orig && P.mesh.geometry === P.geo) { P.geo.attributes.position.array.set(P.orig); P.geo.attributes.position.needsUpdate = true; }
      P.geo.clearGroups();
      if (B.gransT !== undefined && !P.trasig && P.mesh.geometry === P.geo) P.geo.computeBoundingSphere();
      P.mesh.material = P.m0;
      if (P.ofc !== undefined) P.mesh.frustumCulled = P.ofc;
    });
    B.objekt.forEach(X => { X.obj.position.copy(X.p0); X.mats.forEach(q => { q.mesh.material = q.m0; }); });
    B.dolda.forEach(o => { if (o.userData.sprangSyn !== undefined) { o.visible = o.userData.sprangSyn; delete o.userData.sprangSyn; } });
    if (B.rekvisita) B.rekvisita.forEach(r => { r.o.visible = r.syn; });
    // vyns egna nät tas ur huset (de sparas till nästa gång och läggs tillbaka då)
    B.lager.lista.forEach(e => { e.mesh.visible = false; if (e.mesh.parent) e.mesh.parent.remove(e.mesh); });
    if (B.inner) { B.inner.post.mesh.visible = false; if (B.inner.post.mesh.parent) B.inner.post.mesh.parent.remove(B.inner.post.mesh); }
    const ig = B.hus.userData.inne;
    if (ig && B.igY !== undefined) ig.position.y = B.igY;
    const mg = I.matt();
    if (mg) mg.visible = !!ritare.val().matt;
    const ud = B.hus.userData;
    if (B.ext0) { ud.ext = B.ext0; ud.hojd = B.hojd0; }
    if (B.sno0) I.sno.value = B.sno0;
    S.vo = null; satsVy(0);
    document.documentElement.classList.remove('kspr-oppen');
    if (I.hus() === B.hus) I.skuggRam();
    I.ljus(); I.skugga(); I.begarRender();
  }

  // ---- kameran: en hög trekvartsvy som rymmer det sprängda huset ----
  // ytan i duken som inte täcks av panelen och verktygsraden (px)
  function friYta() {
    const W = duk.clientWidth, H = duk.clientHeight, sr = duk.getBoundingClientRect();
    const pr = panel.hidden ? null : panel.getBoundingClientRect();
    if (smal()) {
      // smal skärm: priskortet (om det finns) ligger i bildens nederkant
      let y1 = H - 12;
      scen.querySelectorAll('.kpris').forEach(e => { if (e.offsetWidth && !e.hidden) { const b = e.getBoundingClientRect(); if (b.top - sr.top > H * 0.5) y1 = Math.min(y1, b.top - sr.top - 8); } });
      return { x0: 10, x1: W - 10, y0: 12, y1, y1kol: y1, W, H };
    }
    const rad = scen.querySelector('.kf__verktyg'), rr = rad && rad.offsetHeight ? rad.getBoundingClientRect() : null;
    const x1 = W - 16, kol = Math.min(230, Math.max(170, (x1 - (pr ? pr.right - sr.left : 0)) * 0.34));
    const y1 = rr ? rr.top - sr.top - 10 : H - 80;
    let y1kol = y1;
    // andra rutor i bildens högra kant (t.ex. priskortet): etikettkolumnen slutar ovanför dem
    scen.querySelectorAll('.kpris').forEach(e => {
      if (!e.offsetWidth || e.hidden) return;
      const b = e.getBoundingClientRect();
      if (b.right - sr.left > x1 - kol - 10 && b.top - sr.top > H * 0.45) y1kol = Math.min(y1kol, b.top - sr.top - 10);
    });
    return { x0: pr ? pr.right - sr.left + 14 : 16, x1, y0: 14, y1, y1kol, W, H, kol };
  }
  // det sprängda husets egna hörn (stickprov, i världen): tätare inramning än en låda runt allt
  function sprangPunkter(B) {
    const ut = [], v = new THREE.Vector3();
    const ta = (mesh, pos, oi, dir, dir2) => {
      mesh.updateWorldMatrix(true, false);
      const n = pos.length / 3, steg = Math.max(1, Math.floor(n / 500));
      for (let i = 0; i < n; i += steg) {
        const k = oi[i] * 3;
        v.set(pos[i * 3] + dir[k], pos[i * 3 + 1] + dir[k + 1], pos[i * 3 + 2] + dir[k + 2]);
        if (dir2) { v.x += dir2[k]; v.y += dir2[k + 1]; v.z += dir2[k + 2]; }
        ut.push(v.applyMatrix4(mesh.matrixWorld).clone());
      }
    };
    B.poster.forEach(P => { if (P.kat.some(k => k <= 4)) ta(P.mesh, P.orig || P.geo.attributes.position.array, P.o, P.dir, P.dir2); });
    B.lager.lista.forEach(e => { if (e.kat[0] !== RANG.E) ta(e.mesh, e.orig || e.mesh.geometry.attributes.position.array, e.o, e.dir); });
    return ut;
  }
  // hög trekvartsvy från det hörn som ligger närmast den nuvarande vinkeln (enhetsvektor)
  function riktning() {
    const sp = new THREE.Spherical().setFromVector3(kamera.position.clone().sub(styr.target));
    const q = Math.PI / 2;
    sp.theta = Math.round((sp.theta - q / 2) / q) * q + q / 2;
    sp.phi = THREE.MathUtils.degToRad(64);   // ca 26° över marken: man ser in under det lyfta taket
    sp.radius = 1;
    return new THREE.Vector3().setFromSpherical(sp);
  }
  function kameraMal(B) {
    const dl = B.hus.userData.delar, H = B.H;
    const ex = H.L / 2 + D + FONSTER_UT + 0.2, ez = H.W / 2 + D + FONSTER_UT + 0.2, top = dl.Y0 + dl.hR + HP + 0.3;
    const xa = Math.min(-ex, B.slut[0] - 0.3), xb = Math.max(ex, B.slut[0] + 0.3), za = Math.min(-ez, B.slut[1] - 0.3), zb = Math.max(ez, B.slut[1] + 0.3);
    let horn = B.punkter || (B.punkter = sprangPunkter(B));
    if (horn.length < 8) { horn = []; [xa, xb].forEach(x => [0, top].forEach(y => [za, zb].forEach(z => horn.push(B.hus.localToWorld(new THREE.Vector3(x, y, z)))))); }
    // kameran kretsar runt husets mitt; förskjutningen bredvid panelen görs med vy-förskjutning
    const mt = B.hus.localToWorld(new THREE.Vector3(0, top * 0.42, 0));
    const rikt = B.rikt, Y = Object.assign({}, friYta()), cam = kamera.clone(), v = new THREE.Vector3();
    // på bred skärm: etiketterna i en kolumn till höger, huset i resten; huset fyller ~2/3 av ytan
    if (!smal()) Y.x1 -= Y.kol;
    const FYLL = smal() ? 0.9 : 0.9;
    cam.clearViewOffset();
    let dist = 30, bx = Y.W / 2, by = Y.H / 2;
    for (let varv = 0; varv < 6; varv++) {
      cam.position.copy(mt).addScaledVector(rikt, dist); cam.lookAt(mt); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
      horn.forEach(h => { v.copy(h).project(cam); const px = (v.x * 0.5 + 0.5) * Y.W, py = (0.5 - v.y * 0.5) * Y.H; a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, py); d = Math.max(d, py); });
      bx = (a + b) / 2; by = (c + d) / 2;
      const s = Math.max((b - a) / ((Y.x1 - Y.x0) * FYLL), (d - c) / ((Y.y1 - Y.y0) * FYLL));
      dist *= Math.max(0.5, Math.min(2, s));
    }
    // (bildens mitt räknas med det sista avståndet; varvet ovan konvergerar)
    return { pos: mt.clone().addScaledVector(rikt, dist), mt, ox: bx - (Y.x0 + Y.x1) / 2, oy: by - (Y.y0 + Y.y1) / 2 };
  }
  // vy-förskjutningen i kameran, k = 0 … 1 (inte under helskärmens övergång, som har en egen)
  function satsVy(k) {
    if (ritare.helPagar && ritare.helPagar()) return;
    const W = duk.clientWidth, H = duk.clientHeight;
    if (!S.vo || k <= 0 || !W || !H) { if (kamera.view && kamera.view.enabled && S.voSatt) { kamera.clearViewOffset(); S.voSatt = false; } return; }
    kamera.setViewOffset(W, H, S.vo.x * k, S.vo.y * k, W, H); S.voSatt = true;
  }

  // ---- etiketterna ----
  // Varje etikett är en prick på sin del (följer kameran exakt) och ett kort bredvid med en kort
  // ledare. Lugnt medan man drar: ankarpunkten och kortets plats väljs om först när kameran stått
  // still i 150 ms; kortet glider då dit med en kritiskt dämpad fjäder (ingen studs, ~220 ms) och
  // behåller sin sida om den andra inte är klart bättre. En prick vars punkt skyms av något tonas
  // ned (kortet tonas bort), utanför bilden tonas båda bort. Får ett kort inte plats utan att
  // ligga på ett annat eller på en prick fälls det ihop till sin prick (som på smal skärm) och
  // fälls ut när man pekar på pricken. Pekar man på en etikett eller en rad i listan lyser delen
  // upp i 3D (och raden och etiketten markeras); klick flyger kameran till delen.
  let lappLista = [];
  const LS = { nyckel: '', lost: null, flytt: 0, tid: 0, rr: 0, behov: true, hover: null, vald: null, glod: [], glodTagg: null, glodMal: 0 };
  function byggLappar(B) {
    if (B) B.lappNyckel = null;
    glodBort();
    LS.hover = null; LS.vald = null; LS.lost = null; LS.behov = true; LS.overblick = null;
    lappar.textContent = '';
    lappLista = [];
    const st = STEG[S.steg];
    let nr = 0;
    st.delar.forEach(dd => {
      if (dd.loft && !harLoft(B)) return;
      if (!dd.a || !ankare(B, dd.a, true)) return;
      nr++;
      const el = document.createElement('div');
      el.className = 'kspr__lapp';
      el.dataset.ksprNr = nr;
      el.innerHTML = '<i class="kspr__prick"><b>' + nr + '</b></i><span class="kspr__streck"></span><span class="kspr__kort"><b>' + dd.t + '</b>' + (dd.s ? '<small>' + dd.s + '</small>' : '') + '</span>';
      lappar.appendChild(el);
      lappLista.push({ el, a: dd.a, nr, prick: el.querySelector('.kspr__prick'), kort: el.querySelector('.kspr__kort'), streck: el.querySelector('.kspr__streck'),
        w: 0, h: 0, p: null, lok: null, bytLok: null, sidaI: 0, skymd: false, x: 0, y: 0, alfa: 0, prickAlfa: 0, ka: 0, malAlfa: 0, malPrick: 0,
        cur: null, vx: 0, vy: 0, mal: null, sida: 1, ihop: false, klass: '' });
    });
    ritaText(B);
  }
  const harLoft = B => (B.H.rum || []).some(r => /loft/i.test(r[0]));
  const vV = new THREE.Vector3(), vK = new THREE.Vector3();
  // ankarpunkterna (husets koordinater) i den ordning de prövas: den del som vetter rätt mot
  // kameran först. Den första som syns (inte skymd av något annat i vyn) används.
  const qInv = new THREE.Quaternion();
  function kandidater(B, namn) {
    const A = B.ank, hus = B.hus;
    vK.copy(kamera.position).sub(styr.target).applyQuaternion(qInv.copy(hus.getWorldQuaternion(qInv)).invert()).normalize();
    // (varje punkt får sin dels normal, nrm, som kameran använder när man väljer delen)
    const mot = lista => (lista || []).map(v => { if (v.p && v.n) v.p.nrm = v.n; return v; }).sort((a, b) => b.n.dot(vK) - a.n.dot(vK));
    if (namn === 'stomme' || namn === 'isolering' || namn === 'gips') {
      // skikten syns inifrån: den bortre väggen först (ytterpanelen döljer dem på den närmaste)
      const vl = mot(Object.values(A.vagg));
      vl.forEach(v => { [v.stomme, v.isolering, v.gips].concat(v.gipsLista, v.kant.stomme, v.kant.isolering).forEach(k => { if (k) k.nrm = v.n; }); });
      const ut = namn === 'gips' ? [] : vl.filter(v => v.n.dot(vK) > -0.2).flatMap(v => v.kant[namn]);
      const inne = vl.reverse().map(v => v[namn]);
      if (namn === 'gips') vl.forEach(v => { if (v.n.dot(vK) < 0.3) inne.push(...v.gipsLista); });
      return ut.concat(inne);
    }
    if (namn === 'fonster' || namn === 'dorr') {
      const ok = namn === 'fonster' ? h => h.typ === 'f' : h => h.typ === 'd' || h.typ === 'dg' || h.typ === 'sk';
      return mot(Object.values(A.vagg)).flatMap(v => v.hal.filter(ok).map(h => { h.p.nrm = v.n; return h.p; }));
    }
    if (namn === 'bjalklag') return mot(A.bjalklag).map(v => v.p).concat(A.bjalklagYta || []);
    // grundens hörn: bara de som vetter mot kameran (ett bortre hörn genom huset säger inget)
    if (namn === 'grund') return mot(A.grund).filter(v => v.n.dot(vK) > 0.05).map(v => v.p);
    if (namn === 'kassett' || namn === 'platt' || namn === 'va') return mot(A[namn]).map(v => v.p);
    if (namn === 'innervagg') return B.inner ? [B.inner.ank[0].p].concat(B.inner.lista || []) : [];
    if (namn === 'golv' || namn === 'kok' || namn === 'bad') {
      if (!hus.userData.inne) return [];
      const vyer = (ritare.inneVyer && ritare.inneVyer()) || [];
      const re = namn === 'kok' ? /kök/i : namn === 'bad' ? /bad/i : null;
      const v = re ? vyer.find(x => re.test(x.namn) && !x.niva) : null;
      if (re && !v) return [];
      if (!v) return A.golvYta || [ankV(new THREE.Vector3(0, B.Y0 + HB + 0.05, 0), new THREE.Vector3(0, HB, 0), FAS_B)];
      const y0 = B.Y0 + HB;
      return [[0, 1.0, 0], [0, 0.4, 0], [0.5, 0.9, 0], [-0.5, 0.9, 0], [0, 0.9, 0.5], [0, 0.9, -0.5], [0, 1.6, 0]].map(([dx, y, dz]) => ankV(new THREE.Vector3(v.pos[0] + dx, y0 + y, v.pos[2] + dz), new THREE.Vector3(0, HB, 0), FAS_B));
    }
    return [];
  }
  function ankare(B, namn, bara) {
    const k = kandidater(B, namn).filter(Boolean);
    if (bara) return k.length > 0;
    return k.length ? vV.copy(k[0]).applyMatrix4(B.hus.matrixWorld) : null;
  }
  // skyms punkten (världen) av en hel (inte genomskinlig) del i det sprängda huset?
  const ray = new THREE.Raycaster();
  ray.layers.enableAll();
  const traffar = [];
  function skymd(B, p) {
    if (!B.traff) {
      B.traff = [];
      B.poster.forEach(P => { if (!P.trasig && P.mesh.material !== GHOST && !(P.m0 && P.m0.transparent)) B.traff.push(P.mesh); });
      B.lager.lista.forEach(e => { if (e.mesh.visible && e.mesh.material !== GHOST && !(e.mat0 && e.mat0.transparent)) B.traff.push(e.mesh); });
      B.objekt.forEach(X => { if (X.kat !== RANG.X && X.obj.visible) X.obj.traverse(o => { if (o.isMesh && o.visible && o.material !== GHOST && !(o.material && o.material.transparent)) B.traff.push(o); }); });
    }
    const d = p.clone().sub(kamera.position), len = d.length();
    ray.set(kamera.position, d.multiplyScalar(1 / len));
    ray.near = 0; ray.far = len - 0.12;
    traffar.length = 0;
    ray.intersectObjects(B.traff, false, traffar);
    return traffar.length > 0;
  }
  // gränslådorna gäller det sprängda läget medan vyn står öppen (för träffarna), och det hopsatta efteråt
  function grans(B) {
    B.poster.forEach(P => { if (!P.trasig && P.mesh.geometry === P.geo) P.geo.computeBoundingSphere(); });
    B.lager.lista.forEach(e => e.mesh.geometry.computeBoundingSphere());
  }
  // ankarpunkterna väljs (kameran står still): den nuvarande behålls så länge den finns bland delens
  // punkter och syns; annars den första synliga. Punkterna är i husets koordinater och följer delen
  // (ankLage) vid varje isärdragning. Byts en synlig etiketts punkt tonas den ut och in på nya platsen.
  const vW = new THREE.Vector3();
  const varld = (B, lok, ut) => B.hus.localToWorld(ankLage(lok, S.t, ut || new THREE.Vector3()));
  function valjAnkare(B, W, H, mob) {
    B.traff = null;
    if (B.gransT !== S.t) { grans(B); B.gransT = S.t; }
    const Y = friYta(), fx0 = mob ? 8 : Y.x0 - 6, fy1 = Y.y1 + 4;
    const iBild = w => {
      const sp = vK.copy(w).project(kamera), px = (sp.x * 0.5 + 0.5) * W, py = (0.5 - sp.y * 0.5) * H;
      return sp.z <= 1 && px >= fx0 && px <= W - 8 && py >= 8 && py <= fy1 ? [px, py] : null;
    };
    const satta = [];   // prickarna får inte hamna på varandra
    const FLEX = { golv: 2, gips: 1, bjalklag: 1, innervagg: 1, stomme: 1, isolering: 1 };
    lappLista.slice().sort((a, b) => (FLEX[a.a] || 0) - (FLEX[b.a] || 0)).forEach(l => {
      l.provad = true;
      const lista = kandidater(B, l.a).filter(Boolean);
      const finns = k => k && lista.some(x => x === k || (x.bas && k.bas ? x.bas.distanceToSquared(k.bas) < 1e-8 : x.distanceToSquared(k) < 1e-8));
      const nu = l.bytLok || l.lok;
      if (nu && finns(nu)) {
        const w = varld(B, nu), q = iBild(w);
        if (q && !satta.some(([x, y]) => Math.hypot(x - q[0], y - q[1]) < 30) && !skymd(B, w)) { l.skymd = false; satta.push(q); return; }
      }
      let val = null, reserv = null;
      for (const k of lista) {
        const w = varld(B, k), q = iBild(w);
        if (!q || skymd(B, w)) continue;
        if (satta.some(([x, y]) => Math.hypot(x - q[0], y - q[1]) < 30)) { if (!reserv) reserv = [k, q]; continue; }
        val = [k, q]; break;
      }
      val = val || reserv;
      if (!val) {
        // ingen synlig punkt: den gamla gäller bara om den fortfarande hör till delen
        if (l.lok && !finns(l.lok)) { l.lok = null; l.bytLok = null; }
        if (l.lok) l.skymd = true;
        return;
      }
      satta.push(val[1]);
      l.skymd = false;
      if (!l.lok || (l.alfa < 0.05 && l.prickAlfa < 0.05) || !finns(l.lok)) { l.lok = val[0]; l.bytLok = null; l.cur = null; }
      else if (l.lok !== val[0]) l.bytLok = val[0];
    });
  }
  // delens yta i bilden nära pricken (de delar av delen som ligger inom 1,6 m från punkten):
  // kortet får inte ligga på den
  function delRuta(B, l, x0, y0, W, H) {
    // trianglarna som når in i en kub på 2 × 1,6 m runt punkten; deras hörn kläms in i kuben (en
    // lång regel eller en takskiva har bara hörn långt bort, men går ändå förbi punkten)
    const kallor = delKallor(B, l.a), R = 1.6, lo = l.p.clone().subScalar(R), hi = l.p.clone().addScalar(R);
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], q = new THREE.Vector3();
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9, n = 0;
    kallor.forEach(([obj, geo]) => {
      obj.updateWorldMatrix(true, false);
      const p = geo.attributes.position, idx = geo.index, m = (idx ? idx.count : p.count) / 3, steg = Math.max(1, Math.floor(m / 2500));
      for (let t = 0; t < m; t += steg) {
        for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(p, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(obj.matrixWorld);
        if (Math.max(v[0].x, v[1].x, v[2].x) < lo.x || Math.min(v[0].x, v[1].x, v[2].x) > hi.x || Math.max(v[0].y, v[1].y, v[2].y) < lo.y || Math.min(v[0].y, v[1].y, v[2].y) > hi.y || Math.max(v[0].z, v[1].z, v[2].z) < lo.z || Math.min(v[0].z, v[1].z, v[2].z) > hi.z) continue;
        for (let k = 0; k < 3; k++) {
          q.copy(v[k]).clamp(lo, hi).project(kamera);
          if (q.z > 1) continue;
          const px = x0 + (q.x * 0.5 + 0.5) * W, py = y0 + (0.5 - q.y * 0.5) * H;
          a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, py); d = Math.max(d, py); n++;
        }
      }
    });
    if (!n) return { x: l.x - 14, y: l.y - 14, w: 28, h: 28, n: 0 };
    // pricken ligger alltid i ytan (den sitter på delen)
    a = Math.min(a, l.x - 10); b = Math.max(b, l.x + 10); c = Math.min(c, l.y - 10); d = Math.max(d, l.y + 10);
    return { x: a, y: c, w: b - a, h: d - c, n };
  }
  // korten placeras (kameran står still) i fri yta bredvid sin del: till höger, vänster, över eller
  // under delens yta i bilden, närmast pricken; samma håll som förut om det inte är klart sämre.
  // Inga kort på varandra, på en prick, på delen, under panelen, priskortet eller verktygsraden.
  // Får det inte plats fälls kortet ihop till sin prick.
  function losKort(B, x0, y0, W, H, mob) {
    const Y = friYta(), GAP = 8, BYT = 40;
    const xmin = x0 + Y.x0, xmax = x0 + Y.x1, ymin = y0 + Y.y0, ymax = y0 + Y.y1;
    const aktiva = lappLista.filter(l => l.lok && l.malAlfa > 0);
    aktiva.forEach(l => { if (!l.w) { l.w = l.kort.offsetWidth; l.h = l.kort.offsetHeight; } });
    const lagda = lappLista.filter(l => l.lok && l.malPrick > 0).map(l => ({ x: l.x - 12, y: l.y - 12, w: 24, h: 24 }));   // alla prickar
    if (Y.kol && Y.y1kol < Y.y1) lagda.push({ x: x0 + Y.x1 - Y.kol, y: y0 + Y.y1kol, w: Y.kol, h: Y.y1 - Y.y1kol });   // priskortet
    const krock = (x, y, w, h, extra) => lagda.concat(extra).some(r => x < r.x + r.w + GAP && x + w + GAP > r.x && y < r.y + r.h + GAP && y + h + GAP > r.y);
    const ar = aktivNr();
    aktiva.sort((a, b) => (b.nr === ar) - (a.nr === ar) || a.y - b.y);
    aktiva.forEach(l => {
      const w = l.w, h = l.h, R = delRuta(B, l, x0, y0, W, H);
      // en del som täcker nästan hela bilden: bara en liten yta runt pricken spärras
      const stor = R.w > (xmax - xmin) * 0.55 || R.h > (ymax - ymin) * 0.6;
      const Z = stor ? { x: l.x - 18, y: l.y - 18, w: 36, h: 36 } : R;
      const klamX = x => Math.min(xmax - w, Math.max(xmin, x)), klamY = y => Math.min(ymax - h, Math.max(ymin, y));
      const hall = [
        k => [Z.x + Z.w + GAP, klamY(l.y - h / 2 + k)],          // höger
        k => [Z.x - GAP - w, klamY(l.y - h / 2 + k)],            // vänster
        k => [klamX(l.x - w / 2 + k), Z.y - GAP - h],            // över
        k => [klamX(l.x - w / 2 + k), Z.y + Z.h + GAP],          // under
      ];
      let bast = null;
      hall.forEach((f, i) => {
        for (let s = 0; s < 16; s++) {
          const k = (s % 2 ? 1 : -1) * Math.ceil(s / 2) * 10, [kx, ky] = f(k);
          if (kx < xmin || kx + w > xmax || ky < ymin || ky + h > ymax) continue;
          if (krock(kx, ky, w, h, [Z])) continue;
          const nx = Math.min(Math.max(l.x, kx), kx + w), ny = Math.min(Math.max(l.y, ky), ky + h);
          const kost = Math.hypot(nx - l.x, ny - l.y) + (i !== l.sidaI ? BYT : 0) + Math.abs(k) * 0.2;
          if (!bast || kost < bast.kost) bast = { kx, ky, i, kost };
          break;
        }
      });
      if (!bast) {
        l.ihop = true;
        bast = { kx: klamX(Z.x + Z.w + GAP), ky: klamY(l.y - h / 2), i: 0 };
      } else {
        l.ihop = false;
        lagda.push({ x: bast.kx, y: bast.ky, w, h });
      }
      l.sidaI = bast.i;
      l.mal = { x: bast.kx - l.x, y: bast.ky - l.y };
      // ett kort som inte syns (t.ex. medan kameran rörde sig) hoppar direkt till sin plats och
      // tonas in där; ett synligt glider dit med fjädern
      if (!l.cur || l.ka < 0.05) { l.cur = { x: l.mal.x, y: l.mal.y }; l.vx = 0; l.vy = 0; }
    });
  }
  const aktivNr = () => (LS.hover !== null ? LS.hover : LS.vald);
  const LAGER_TAGG = new Set(['stomme', 'isolering', 'gips', 'kassett', 'bjalklag', 'innervagg']);
  const lagerDold = l => LAGER_TAGG.has(l.a) && l.lok && l.lok.bas && (lokal(S.t, l.lok.af) + (l.lok.ad2 ? lokal(S.t, l.lok.af2) : 0)) < 0.012;
  // kontroll av korten som syns: inget kort på ett annat, på en prick eller på sin egen del
  function lappKrock(B, x0, y0, W, H) {
    const ov = (a, c) => a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y;
    const kort = lappLista.filter(l => l.lok && l.cur && l.mal && !l.ihop && l.malAlfa > 0).map(l => ({ l, r: { x: l.x + l.mal.x, y: l.y + l.mal.y, w: l.w, h: l.h } }));
    const prickar = lappLista.filter(l => l.lok && l.malPrick > 0).map(l => ({ x: l.x - 9, y: l.y - 9, w: 18, h: 18 }));
    for (let i = 0; i < kort.length; i++) {
      const a = kort[i];
      if (prickar.some(p => ov(a.r, p))) return a.l;
      for (let j = 0; j < i; j++) if (ov(a.r, kort[j].r)) return a.l;
      const R = delRuta(B, a.l, x0, y0, W, H);
      if (R.n && R.w < (W * 0.55) && R.h < (H * 0.6) && ov(a.r, R)) return a.l;
    }
    return null;
  }
  // kroken före varje bild: ger true medan något i etiketterna rör sig (fler bilder behövs)
  function ritaLappar() {
    const B = S.bygge;
    if (!B || !lappLista.length) return false;
    const syns = S.pa && !S.oppnar && S.t > 0.0015;
    lappar.classList.toggle('kspr__lappar--syns', syns);
    if (!syns) { LS.tid = 0; return glodSteg(0.016); }
    const nu = performance.now(), dt = LS.tid ? Math.min(0.05, Math.max(0.001, (nu - LS.tid) / 1000)) : 0.016;
    LS.tid = nu;
    const W = duk.clientWidth, H = duk.clientHeight, x0 = duk.offsetLeft, y0 = duk.offsetTop;
    const mob = smal();
    lappar.classList.toggle('kspr__lappar--prickar', mob);
    kamera.updateMatrixWorld();
    B.hus.updateMatrixWorld();
    // prickarna sitter på sina delar vid det nuvarande läget (också medan man drar isär)
    const proj = l => { varld(B, l.lok, l.p || (l.p = new THREE.Vector3())); vV.copy(l.p).project(kamera); l.x = x0 + (vV.x * 0.5 + 0.5) * W; l.y = y0 + (0.5 - vV.y * 0.5) * H; l.z = vV.z; };
    // kameran (eller isärdragningen) räknas som stilla när prickarna rört sig under en halv pixel
    // sedan förra bilden; så länge man håller i bilden eller reglaget räknas den som i rörelse
    let rorelse = 0;
    lappLista.forEach(l => { if (!l.lok) return; const px = l.x, py = l.y; proj(l); rorelse = Math.max(rorelse, Math.abs(l.x - px) + Math.abs(l.y - py)); });
    const nyckel = W + 'x' + H + '|' + S.steg + '|' + (B.hus.userData.sprangEnt && B.hus.userData.sprangEnt.sida);
    if (nyckel !== LS.nyckel || rorelse > 0.5) { LS.flytt = nu; LS.lost = null; }
    LS.nyckel = nyckel;
    if (LS.drar || M.drar) LS.flytt = nu;
    const still = nu - LS.flytt > 150;
    let ror = !still || nu - LS.flytt < 400;   // (några bilder till efter att kameran stannat: då väljs om)
    const forsta = lappLista.some(l => !l.provad);
    if ((still && LS.lost === null) || forsta) { valjAnkare(B, W, H, mob); LS.lost = 1; LS.behov = true; lappLista.forEach(l => { if (l.lok) proj(l); }); }
    else if (!still) {
      // medan kameran rör sig: en etikett per bild prövas om den skyms (punkten byts inte)
      const l = lappLista[LS.rr = (LS.rr + 1) % lappLista.length];
      if (l && l.lok) l.skymd = skymd(B, l.p);
    }
    const kf = 1 - Math.exp(-dt / 0.09);   // tonens tidskonstant ~90 ms
    const akt = aktivNr();
    lappLista.forEach(l => {
      if (l.bytLok && l.alfa < 0.04 && l.prickAlfa < 0.04) { l.lok = l.bytLok; l.bytLok = null; l.cur = null; LS.behov = true; proj(l); }
      // en del som ännu inte syns vid den här isärdragningen (skiktens bitar ligger dolda i väggen
      // tills de börjat glida ut): ingen prick och inget kort på den
      if (l.lok && lagerDold(l)) { l.malPrick = 0; l.malAlfa = 0; }
      else if (l.lok) {
        const inne = l.z < 1 && l.x > x0 - 4 && l.x < x0 + W + 4 && l.y > y0 - 4 && l.y < y0 + H + 4;
        l.malPrick = l.bytLok || !inne ? 0 : l.skymd ? 0.35 : 1;
        l.malAlfa = l.bytLok || !inne || l.skymd ? 0 : 1;
      } else { l.malPrick = 0; l.malAlfa = 0; }
      // en prick som dyker upp eller försvinner: korten ordnas om (när kameran står still)
      const sy = (l.malPrick > 0 ? 1 : 0) + (l.malAlfa > 0 ? 2 : 0);
      if (sy !== l.syn) { l.syn = sy; LS.behov = true; }
    });
    if (still && LS.behov) {
      losKort(B, x0, y0, W, H, mob); LS.behov = false;
      // efterkontroll: ett kort som ändå krockar fälls ihop (det kan aldrig ligga kvar så)
      for (let k = 0; k < lappLista.length; k++) { const fel = lappKrock(B, x0, y0, W, H); if (!fel) break; fel.ihop = true; }
      LS.koll = nu;
    } else if (still && nu - (LS.koll || 0) > 500) {
      // stilla bild: korten kontrolleras två gånger i sekunden (t.ex. en prick som glidit in under
      // ett kort efter att isärdragningen ändrats): krock → läggs om
      LS.koll = nu;
      if (lappKrock(B, x0, y0, W, H)) LS.behov = true;
    }
    const OM = 28;   // fjäderns vinkelfrekvens: kritiskt dämpad, framme på ~220 ms
    lappLista.forEach(l => {
      const arA = l.nr === akt, dimmad = akt !== null && !arA;
      // korten fälls ihop medan kameran rör sig (de följer inte med); bara prickarna sitter kvar
      const visa = ((!l.ihop && !mob) || arA) && still && !!l.mal;
      const mk = l.malAlfa * (visa ? 1 : 0) * (dimmad ? 0.4 : 1), mp = l.malPrick * (dimmad ? 0.55 : 1);
      const kfk = 1 - Math.exp(-dt / (visa ? 0.14 : 0.06));   // ut snabbt, in mjukt
      l.alfa += (l.malAlfa - l.alfa) * kf; l.ka += (mk - l.ka) * kfk; l.prickAlfa += (mp - l.prickAlfa) * kf;
      if (Math.abs(mk - l.ka) > 0.005 || Math.abs(mp - l.prickAlfa) > 0.005 || Math.abs(l.malAlfa - l.alfa) > 0.005) ror = true;
      else { l.ka = mk; l.prickAlfa = mp; l.alfa = l.malAlfa; }
      if (l.cur && l.mal) {
        if (lugn || l.ka < 0.02) { l.cur.x = l.mal.x; l.cur.y = l.mal.y; l.vx = l.vy = 0; }
        else for (let t = dt; t > 1e-6; t -= 1 / 120) {
          const h = Math.min(t, 1 / 120);
          l.vx += (-OM * OM * (l.cur.x - l.mal.x) - 2 * OM * l.vx) * h; l.cur.x += l.vx * h;
          l.vy += (-OM * OM * (l.cur.y - l.mal.y) - 2 * OM * l.vy) * h; l.cur.y += l.vy * h;
        }
        if (Math.abs(l.cur.x - l.mal.x) + Math.abs(l.cur.y - l.mal.y) > 0.2 || Math.abs(l.vx) + Math.abs(l.vy) > 2) ror = true;
        else { l.cur.x = l.mal.x; l.cur.y = l.mal.y; l.vx = l.vy = 0; }
      }
      // bara transform och opacitet skrivs (inga mått läses här)
      l.el.style.transform = 'translate3d(' + (l.x || 0).toFixed(1) + 'px,' + (l.y || 0).toFixed(1) + 'px,0)';
      l.prick.style.opacity = l.prickAlfa.toFixed(3);
      const kl = (l.ka > 0.3 ? ' kspr__lapp--kort' : '') + (l.prickAlfa > 0.3 ? ' kspr__lapp--prick' : '') + (arA ? ' kspr__lapp--aktiv' : '');
      if (kl !== l.klass) { l.klass = kl; l.el.className = 'kspr__lapp' + kl; }
      if (!l.cur) { l.kort.style.opacity = '0'; l.streck.style.opacity = '0'; return; }
      const kx = l.cur.x, ky = l.cur.y, w = l.w, h = l.h;
      l.kort.style.transform = 'translate(' + kx.toFixed(1) + 'px,' + ky.toFixed(1) + 'px)';
      l.kort.style.opacity = l.ka.toFixed(3);
      // ledaren: från prickens kant till kortets närmaste punkt
      const ex = Math.min(Math.max(0, kx), kx + w), ey = Math.min(Math.max(0, ky), ky + h);
      const len = Math.hypot(ex, ey), ang = Math.atan2(ey, ex);
      l.streck.style.width = Math.max(0, len - 10).toFixed(1) + 'px';
      l.streck.style.transform = 'rotate(' + ang.toFixed(4) + 'rad) translateX(10px)';
      l.streck.style.opacity = (len > 13 ? l.ka : 0).toFixed(3);
    });
    if (glodSteg(dt)) ror = true;
    return ror;
  }

  // ---- markeringen i 3D: delen lyser upp (ett varmt sken ovanpå, samma hörn som delen) ----
  const GLOD = new THREE.MeshBasicMaterial({ color: 0xff9e3d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  const GLOD_GEO = new WeakMap();   // nätets geometri → { tagg: geometri med bara den delens trianglar (delar hörnen) }
  function glodGeo(geo, o, tagg, tag, katOk, nyckel) {
    let c = GLOD_GEO.get(geo);
    if (!c) GLOD_GEO.set(geo, c = {});
    const tag0 = tag;
    tag = tag + (nyckel || '');   // (husets delar: per paket, de som ingår skiljer)
    if (c[tag] !== undefined) return c[tag];
    const idx = geo.index, n = idx ? idx.count : geo.attributes.position.count, ut = [];
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx.getX(t) : t, k = o[a];
      if (tagg[k] === tag0 && katOk(k)) ut.push(a, idx ? idx.getX(t + 1) : t + 1, idx ? idx.getX(t + 2) : t + 2);
    }
    if (!ut.length) return (c[tag] = null);
    // (geometrin delar husets hörn: den kasseras aldrig, då skulle hörnens buffert försvinna)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    g.setIndex(ut);
    return (c[tag] = g);
  }
  function glodBort() {
    LS.glod.forEach(m => { if (m.parent) m.parent.remove(m); });
    LS.glod = []; LS.glodTagg = null; GLOD.opacity = 0; LS.glodMal = 0;
  }
  function nyGlod(parent, geo) {
    const m = new THREE.Mesh(geo, GLOD);
    m.frustumCulled = false; m.renderOrder = 20; m.castShadow = false; m.receiveShadow = false; m.raycast = () => {};
    parent.add(m); LS.glod.push(m);
  }
  // delens källor: [objekt, geometri med bara delens trianglar] (delar hörnen med husets nät)
  function delKallor(B, tag) {
    const ut = [], r = S.steg + 1;
    if (!B || !tag) return ut;
    B.poster.forEach(P => {
      if (P.trasig || !P.tagg || P.mesh.geometry !== P.geo) return;
      const g = glodGeo(P.geo, P.o, P.tagg, tag, k => P.kat[k] <= r, '|' + r);
      if (g) ut.push([P.mesh, g]);
    });
    B.lager.lista.concat(B.inner ? [B.inner.post] : []).forEach(e => {
      if (!e.mesh.visible || e.kat[0] > r || !e.tagg) return;
      const g = glodGeo(e.mesh.geometry, e.o, e.tagg, tag, () => true);
      if (g) ut.push([e.mesh, g]);
      // schaktets jord, sulan, banden och grusbädden (barn till posten)
      e.mesh.children.forEach(x => {
        if (x.userData.tagg === tag) ut.push([x, x.geometry]);
        else if (x.userData.lager && x.userData.lager.tagg) { const gg = glodGeo(x.geometry, x.userData.lager.o, x.userData.lager.tagg, tag, () => true); if (gg) ut.push([x, gg]); }
      });
    });
    B.objekt.forEach(X => { if (X.tagg === tag && X.kat <= r) X.obj.traverse(o => { if (o.isMesh && o.material !== GLOD && o.geometry) ut.push([o, o.geometry]); }); });
    return ut;
  }
  function markeraDel(tag) {
    const B = S.bygge;
    if (!B) return;
    if (tag === LS.glodTagg) { LS.glodMal = tag ? 1 : 0; return; }
    glodBort();
    LS.glodTagg = tag;
    if (!tag) return;
    delKallor(B, tag).forEach(([o, g]) => nyGlod(o, g));
    LS.glodMal = 1;
    I.begarRender();
  }
  function glodSteg(dt) {
    const mal = LS.glodMal * 0.2;
    const k = 1 - Math.exp(-dt / 0.12);
    GLOD.opacity += (mal - GLOD.opacity) * k;
    if (Math.abs(mal - GLOD.opacity) < 0.004) { GLOD.opacity = mal; if (!mal && LS.glod.length) glodBort(); return false; }
    return true;
  }
  // delens låda i världen nära etikettens punkt (för kameran)
  function delLada(l) {
    const box = new THREE.Box3(), v = new THREE.Vector3(), B = S.bygge;
    delKallor(B, l.a).forEach(([m, g]) => {
      m.updateWorldMatrix(true, false);
      const p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count, steg = Math.max(1, Math.floor(n / 3000));
      for (let i = 0; i < n; i += steg) { v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld); if (!l.p || v.distanceTo(l.p) < 2.2) box.expandByPoint(v); }
    });
    if (box.isEmpty() && l && l.p) box.setFromCenterAndSize(l.p, new THREE.Vector3(1.4, 1.4, 1.4));
    return box;
  }
  // välj en etikett (nr) eller ingen: rad och etikett markeras, delen lyser
  function satsAktiv() {
    const nr = aktivNr(), l = lappLista.find(x => x.nr === nr);
    textYta.querySelectorAll('[data-kspr-nr]').forEach(li => li.classList.toggle('kspr__rad--aktiv', +li.dataset.ksprNr === nr));
    markeraDel(l ? l.a : null);
    LS.behov = true;   // det markerade kortet fälls ut och får plats först
    I.begarRender();
  }
  // Fokus på en del: kameran flyger dit och ramar in den, från det håll (nuvarande, vridet åt
  // sidan eller högre upp) där inget annat skymmer den; Esc eller klick i tom yta tillbaka till
  // översikten (där man var innan).
  const fri = (B, fran, till) => {
    const d = till.clone().sub(fran), len = d.length();
    ray.set(fran, d.multiplyScalar(1 / len)); ray.near = 0; ray.far = len * 0.8;
    if (!B.traff) skymd(B, till);
    traffar.length = 0; ray.intersectObjects(B.traff, false, traffar);
    return traffar.length === 0;
  };
  function flygTill(nr) {
    const B = S.bygge, l = lappLista.find(x => x.nr === nr);
    if (!B || !l || !l.lok || !l.p) return;
    // målet: punkten på delen; avståndet efter delens storlek nära punkten (3,5–9 m)
    const box = delLada(l), c = l.p.clone();
    const r = box.isEmpty() ? 1 : Math.min(3, box.getSize(new THREE.Vector3()).length() / 2);
    const dist = Math.min(9, Math.max(3.5, r / Math.sin(THREE.MathUtils.degToRad(kamera.fov / 2)) * 1.1));
    // riktningen: ut från delen (dess normal), blandad med nuvarande håll och lite uppifrån;
    // det första hållet där inget skymmer punkten används
    const UPv = new THREE.Vector3(0, 1, 0), d0 = kamera.position.clone().sub(styr.target).normalize();
    const nrm = l.lok.nrm ? l.lok.nrm.clone().applyQuaternion(B.hus.getWorldQuaternion(new THREE.Quaternion())).setY(0) : d0.clone().setY(0);
    if (nrm.lengthSq() < 1e-6) nrm.copy(d0).setY(0);
    nrm.normalize();
    const bas = nrm.clone().multiplyScalar(0.65).addScaledVector(d0.clone().setY(0).normalize(), 0.35).normalize();
    const prov = [0, 0.45, -0.45, 0.9, -0.9].flatMap(a => [0.55, 0.9, 0.3].map(h => bas.clone().applyAxisAngle(UPv, a).setY(h).normalize()));
    B.traff = null; grans(B); B.gransT = S.t;
    const dir = prov.find(d => c.clone().addScaledVector(d, dist).y > 0.4 && fri(B, c.clone().addScaledVector(d, dist), c)) || prov[0];
    if (!LS.overblick) LS.overblick = { pos: kamera.position.clone(), mal: styr.target.clone() };
    I.akTill(c.clone().addScaledVector(dir, dist), c, lugn ? 0 : 1.1);
  }
  function tillbaka() {
    if (LS.vald !== null) { LS.vald = null; satsAktiv(); }
    if (LS.overblick && S.pa) { I.akTill(LS.overblick.pos, LS.overblick.mal, lugn ? 0 : 1.0); }
    LS.overblick = null;
  }
  // listans rader: pekare, klick och tangentbord
  const nrAv = e => { const x = e.target.closest && e.target.closest('[data-kspr-nr]'); return x ? +x.dataset.ksprNr : null; };
  let hoverTid = 0;
  const peka = nr => { clearTimeout(hoverTid); if (nr === LS.hover) return; if (nr === null) { hoverTid = setTimeout(() => { LS.hover = null; satsAktiv(); }, 90); return; } LS.hover = nr; satsAktiv(); };
  const valj = nr => { LS.vald = nr; satsAktiv(); flygTill(nr); };
  panel.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const nr = nrAv(e); if (nr !== null) peka(nr); });
  panel.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const nr = nrAv(e); if (nr !== null && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-kspr-nr="' + nr + '"]'))) peka(null); });
  panel.addEventListener('click', e => { const nr = nrAv(e); if (nr === null || !e.target.closest('.kspr__lista')) return; if (LS.vald === nr) tillbaka(); else valj(nr); });
  textYta.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const nr = nrAv(e);
    if (nr === null) return;
    e.preventDefault(); valj(nr);
  });
  // Etiketterna i bilden tar inga pekarhändelser (de stoppar aldrig att man vrider huset): bilden
  // själv provar om pekaren är över ett kort eller en prick. Ett klick (utan dragning) på en
  // etikett väljer delen, ett klick i tom yta går tillbaka till översikten.
  const traffLapp = (cx, cy) => {
    const r = duk.getBoundingClientRect(), x = cx - r.left + duk.offsetLeft, y = cy - r.top + duk.offsetTop;
    for (const l of lappLista) {
      if (l.ka > 0.3 && l.cur && x >= l.x + l.cur.x - 4 && x <= l.x + l.cur.x + l.w + 4 && y >= l.y + l.cur.y - 4 && y <= l.y + l.cur.y + l.h + 4) return l.nr;
      if (l.prickAlfa > 0.3 && Math.hypot(x - l.x, y - l.y) < 15) return l.nr;
    }
    return null;
  };
  let ned = null;
  if (duk) {
    duk.addEventListener('pointerdown', e => { ned = [e.clientX, e.clientY]; LS.drar = true; });
    addEventListener('pointerup', () => { if (LS.drar) { LS.drar = false; LS.flytt = performance.now(); I.begarRender(); } }, true);
    addEventListener('pointercancel', () => { LS.drar = false; }, true);
    duk.addEventListener('pointermove', e => {
      if (!S.pa || LS.drar || e.pointerType === 'touch') return;
      const nr = traffLapp(e.clientX, e.clientY);
      duk.style.cursor = nr !== null ? 'pointer' : '';
      if (nr !== null) peka(nr); else if (LS.hover !== null) peka(null);
    });
    duk.addEventListener('pointerleave', () => { if (LS.hover !== null) peka(null); duk.style.cursor = ''; });
    duk.addEventListener('pointerup', e => {
      if (ned && S.pa && Math.hypot(e.clientX - ned[0], e.clientY - ned[1]) < 5) {
        const nr = traffLapp(e.clientX, e.clientY);
        if (nr !== null) { if (LS.vald === nr) tillbaka(); else valj(nr); }
        else if (LS.vald !== null || LS.overblick) tillbaka();
      }
      ned = null;
    });
  }
  // texten för steget: delar med en etikett i bilden får prickens nummer, övriga en bock (de
  // ingår, men syns inte som en egen del). Sista paketet: Begär offert i stället för Nästa.
  // Byte av flik: texten glider in från det håll man gick åt.
  let textSteg = -1;
  const BOCK = '<svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg>';
  function ritaText(B) {
    const st = STEG[S.steg];
    let nr = 0;
    const rad = st.delar.filter(dd => !(dd.loft && !harLoft(B))).map(dd => {
      const harA = dd.a && ankare(B, dd.a, true);
      if (harA) nr++;
      return '<li' + (harA ? ' data-kspr-nr="' + nr + '" tabindex="0"' : ' class="kspr__utan"') + '><i aria-hidden="true">' + (harA ? nr : BOCK) + '</i><span><b>' + dd.t + '</b>' + (dd.s ? '<small>' + dd.s + '</small>' : '') + '</span></li>';
    }).join('');
    const sist = S.steg >= STEG.length - 1;
    const kort = document.querySelector('.kpris [data-kpris-offert]');
    const nasta = sist
      ? '<a class="kspr__pil kspr__pil--nasta kspr__pil--offert" data-kpris-offert href="' + (kort ? kort.getAttribute('href') : 'kontakt.html') + '">Begär offert<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>'
      : '<button type="button" class="kspr__pil kspr__pil--nasta" data-kspr-pil="1">Nästa: ' + STEG[S.steg + 1].kort + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
    fot.innerHTML = '<div class="kspr__pilar"><button type="button" class="kspr__pil" data-kspr-pil="-1"' + (S.steg ? '' : ' disabled') + '>Föregående</button>' + nasta + '</div>';
    textYta.innerHTML = '<h3 class="kspr__namn">' + st.namn + '</h3><p class="kspr__intro">' + st.intro + '</p><ul class="kspr__lista">' + rad + '</ul>' +
      (st.not ? '<p class="kspr__not">' + st.not + '</p>' : '');
    requestAnimationFrame(tona);
    if (textSteg >= 0 && textSteg !== S.steg && !lugn) {
      textYta.classList.remove('kspr__text--fram', 'kspr__text--bak');
      void textYta.offsetWidth;
      textYta.classList.add(S.steg > textSteg ? 'kspr__text--fram' : 'kspr__text--bak');
    }
    textSteg = S.steg;
  }
  function markera() {
    flikar.forEach((f, i) => { const v = i === S.steg; f.setAttribute('aria-selected', String(v)); f.tabIndex = v ? 0 : -1; });
    const f = flikar[S.steg];
    if (f && f.offsetWidth) { markor.style.width = f.offsetWidth + 'px'; markor.style.transform = 'translateX(' + f.offsetLeft + 'px)'; }
  }

  // ---- kroken före varje bild ----
  function steg(dt) {
    const B = S.bygge;
    if (!B) return false;
    // huset byttes, eller ett annat läge tog över: tillbaka direkt
    if (I.hus() !== B.hus || (ritare.arInne && ritare.arInne()) || (ritare.arOppen && ritare.arOppen()) || (ritare.plan && ritare.plan())) { stang(true); return false; }
    // målet: hur långt isär användaren valt (öppet), annars ihop. Öppning och stängning går i
    // jämn takt; när vyn står öppen följer läget reglaget med en kritiskt dämpad fjäder
    // (inga hack när man drar, ingen studs), utan fjäder vid minskad rörelse.
    const mal = S.pa ? Math.max(0.002, S.mangd) : 0;
    let ror = false;
    const prov = typeof S.prov === 'number';
    if (prov) { if (S.t !== S.prov) S.t = S.prov; S.tv = 0; }
    else if (S.t !== mal) {
      if (lugn) { S.t = mal; S.tv = 0; S.oppnar = false; }
      else if (S.pa && !S.oppnar) {
        const OM = 13;
        for (let k = dt; k > 1e-6; k -= 1 / 120) {
          const h = Math.min(k, 1 / 120);
          S.tv += (-OM * OM * (S.t - mal) - 2 * OM * S.tv) * h; S.t += S.tv * h;
        }
        S.t = Math.min(1, Math.max(0.002, S.t));
        if (Math.abs(S.t - mal) < 0.0006 && Math.abs(S.tv) < 0.004) { S.t = mal; S.tv = 0; }
      } else {
        S.t = S.t < mal ? Math.min(mal, S.t + dt / TID) : Math.max(mal, S.t - dt / TID);
        S.tv = 0;
      }
      ror = S.t !== mal;
    }
    if (S.pa && S.oppnar && S.t === mal) S.oppnar = false;
    if (S.t !== S.satt) {
      satt(B, S.t); S.satt = S.t;
      if ((S.skuggRuta++ & 1) === 0 || S.t === mal) I.skugga();
    }
    synlighet(B, S.t);
    if (!S.pa && S.t === 0) { slut(); return false; }
    // miljön kan ha bytts till vinter medan vyn är öppen: snön av igen
    if (I.sno.value !== 0) { B.sno0 = I.sno.value; I.sno.value = 0; }
    // vy-förskjutningen glider i takt med kameran
    const vk = S.pa ? 1 : 0;
    if (S.voK !== vk) { S.voK = lugn ? vk : Math.min(1, Math.max(0, S.voK + (S.pa ? 1 : -1) * dt / 1.5)); ror = true; }
    satsVy(inUt(S.voK));
    if (B.innerVantar && B.hus.userData.inne) laggInner(B);
    // (schaktet ligger kvar på den sida det fick när vyn öppnades: det flyttar inte runt när man vrider)
    // miljön byttes medan vyn är öppen: den nya miljöns saker nära huset göms också
    if (((S.ruta = (S.ruta || 0) + 1) % 20) === 0 && B.miljo !== miljoSign()) { rekvisita(B); synlighet(B, S.t); }
    if (ritaLappar()) ror = true;
    if (fyllSteg(dt)) ror = true;
    return ror;
  }
  function laggInner(B) {
    B.innerVantar = false;
    const r = B.hus.userData.sprangInner || (B.hus.userData.sprangInner = byggInnervaggar(B.hus, B.H));
    if (!r) return;
    B.inner = r;
    if (!r.post.mesh.parent) B.hus.add(r.post.mesh);
    S.satt = -1;
    satsSteg(B, S.steg);
    byggLappar(B);
  }
  // ---- Studion: sprängvyn visas alltid i studiomiljön (regel) ----
  // Vid öppning sparas kundens miljö och motorn byter till studion (stegvis bygge, väntan på
  // 'husritare:miljoklar', motorns egen korta toning). Sprängningen börjar först när studion står.
  // När vyn är helt stängd byts kundens miljö tillbaka (samma toning). Tiden på dygnet, kameran och
  // valen rörs inte (kameran åker tillbaka som förut). Ett miljöval i menyn medan vyn är öppen
  // stänger vyn och gäller sedan (ingen återställning ovanpå). MS.gen räknas upp vid varje byte, så
  // att en gammal väntan aldrig gör något efter en ny öppning eller stängning.
  const MS = { fore: null, gen: 0 };
  const miljoNu = () => { try { return I.miljo ? I.miljo() : null; } catch (e) { return null; } };
  async function tillStudio(arAvbruten) {
    const m = miljoNu();
    if (!m || !ritare.miljo) return true;
    const gen = ++MS.gen;
    if (MS.fore === null) MS.fore = m.vill || m.namn;
    if (m.namn === 'studio' && !m.vill) return true;
    try { ritare.miljo('studio'); } catch (e) { console.warn(e); return true; }
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) {
      if (arAvbruten() || gen !== MS.gen) return false;
      const n = miljoNu();
      if (n && n.namn === 'studio' && !n.vill) break;
      await nastaRuta();
    }
    // motorns toning från den gamla miljön får gå klart (kort), sedan börjar sprängningen
    const t1 = performance.now();
    while (performance.now() - t1 < 600 && ritare.upptagen && ritare.upptagen()) { if (arAvbruten() || gen !== MS.gen) return false; await nastaRuta(); }
    return true;
  }
  function miljoTillbaka() {
    const f = MS.fore;
    MS.fore = null; MS.gen++;
    if (!f || f === 'studio' || !ritare.miljo) return;
    const m = miljoNu();
    if (m && m.namn === f && !m.vill) return;
    try { ritare.miljo(f); } catch (e) { console.warn(e); }
  }
  // ett eget miljöval i menyn medan vyn är öppen: vyn stängs (direkt) och valet gäller
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('[data-miljo]');
    if (!b || !(S.pa || S.bygge || S.vantar)) return;
    MS.fore = null; MS.gen++;
    if (S.vantar) S.avbruten = true;
    stang(true);
  }, true);
  // studion byggs i förväg när datorn är ledig (då går bytet nästan direkt)
  const forStudio = () => { try { if (I.miljoForbered) I.miljoForbered('studio'); } catch (e) { /* bara en förberedelse */ } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(forStudio, { timeout: 4000 }); else setTimeout(forStudio, 3000);
  // studion i sprängvyn: ljusare och mjukare. Inget nytt ljus läggs till (ett nytt ljus ändrar
  // alla materials program: förut kompilerades ~40 program om när vyn öppnades). I stället höjs
  // scenens eget himmelsljus en aning medan vyn är öppen i studion; motorns eget värde (som den kan
  // sätta om när som helst) följs och återställs när vyn stängs.
  const FYLL = { ljus: null, bas: 0, satt: -1, k: 0 };
  function fyllSteg(dt) {
    if (!FYLL.ljus) I.scene.traverse(o => { if (!FYLL.ljus && o.isHemisphereLight) FYLL.ljus = o; });
    const L = FYLL.ljus;
    if (!L) return false;
    if (L.intensity !== FYLL.satt) FYLL.bas = L.intensity;      // motorn har satt ett nytt värde
    const m = miljoNu(), mal = S.pa && m && m.namn === 'studio' && !m.vill ? 1 : 0;
    FYLL.k += (mal - FYLL.k) * (1 - Math.exp(-dt / 0.35));
    if (Math.abs(mal - FYLL.k) < 0.004) FYLL.k = mal;
    L.intensity = FYLL.satt = FYLL.bas * (1 + 0.45 * FYLL.k);
    return FYLL.k !== mal;
  }
  function fyllAv() { if (FYLL.ljus && FYLL.ljus.intensity === FYLL.satt) FYLL.ljus.intensity = FYLL.bas; FYLL.k = 0; FYLL.satt = -1; }

  function slut() {
    const B = S.bygge;
    miljoTillbaka();
    fyllAv();
    if (B) aterstall(B);
    if (S.foreSpar) S.foreSen = { ...S.foreSpar, tid: performance.now() };
    S.bygge = null; S.satt = -1; S.prov = null; S.foreSpar = null;
    I.steg(null);
    glodBort();
    panel.hidden = true; lappar.textContent = ''; lappLista = [];
    scen.classList.remove('kf__scen--sprang');
  }

  // ---- öppna och stänga ----
  const nastaRuta = () => new Promise(r => { let k = false; const ok = () => { if (!k) { k = true; r(); } }; requestAnimationFrame(ok); setTimeout(ok, 120); });   // reserv: rAF står still i dold flik
  async function oppna(steg = 0) {
    if (SN.grupp) snittStang(true);
    S.steg = Math.max(0, Math.min(STEG.length - 1, steg | 0));
    if (S.pa) { valjSteg(S.steg); return true; }
    // vyn håller på att stängas (huset sätts ihop): vänd tillbaka från där den är
    if (S.bygge && I.hus() === S.bygge.hus) {
      const B = S.bygge;
      S.pa = true; S.prov = null; S.oppnar = true; S.tv = 0;
      S.fore = S.foreSpar || { pos: kamera.position.clone(), mal: styr.target.clone() };
      satsSteg(B, S.steg);
      placeraPanel(); panel.hidden = false;
      scen.classList.add('kf__scen--sprang');
      document.documentElement.classList.add('kspr-oppen');
      knapp.setAttribute('aria-pressed', 'true');
      const K = kameraMal(B);
      S.vo = { x: K.ox, y: K.oy };
      I.akTill(K.pos, K.mt, lugn ? 0 : 1.6);
      byggLappar(B); markera(); meddela();
      I.begarRender();
      return true;
    }
    if (S.vantar) return false;
    S.vantar = true; S.avbruten = false; knapp.setAttribute('aria-busy', 'true');
    try {
      if (lage && lage() !== 'ute' && tillUte) tillUte();
      try { ritare.oppna(false, { direkt: true }); } catch (e) { /* inget tak av */ }
      try { if (ritare.plan && ritare.plan()) ritare.plan(false, { direkt: true }); } catch (e) { /* ingen plan */ }
      // studion börjar byggas direkt (samtidigt som huset blir klart); sprängningen väntar på båda
      const studio = tillStudio(() => S.avbruten);
      // vänta tills huset står stilla och utsidan gäller (och inredningen helst är byggd)
      const t0 = performance.now();
      if (!I.hus() || !I.hus().userData.inne) { try { ritare.forbered(); } catch (e) { /* äldre motor */ } }
      while (performance.now() - t0 < 9000) {
        const h = I.hus();
        const klart = h && !(ritare.arInne && ritare.arInne()) && !(ritare.flyger && ritare.flyger()) && !(ritare.arOppen && ritare.arOppen()) && !(ritare.plan && ritare.plan());
        // (inredningen väntas inte in: den byggs och värms vidare i ledig tid och läggs till när den
        // är klar, se laggInner; förut väntade öppningen upp till 6 s på den)
        if (klart && !(ritare.upptagen && ritare.upptagen())) break;
        if (klart && performance.now() - t0 > 1500) break;
        if (S.avbruten) break;
        await nastaRuta();
      }
      if (S.avbruten) return false;
      // studion först (regel); sprängningen börjar när den står
      if (!(await studio)) { if (S.avbruten) miljoTillbaka(); return false; }
      const hus = I.hus();
      if (!hus || S.avbruten) { miljoTillbaka(); return false; }
      try { ritare.snurra(false); } catch (e) { /* ingen snurr */ }
      const sn = document.querySelector('[data-snurra]'); if (sn) sn.setAttribute('aria-pressed', 'false');
      let B;
      try { B = forbered(hus); } catch (e) { console.warn('sprängvyn', e); miljoTillbaka(); return false; }
      S.bygge = B; S.pa = true; S.satt = -1; S.oppnar = true; S.tv = 0;
      rekvisita(B);
      if (hus.userData.inne) laggInnerDirekt(B); else B.innerVantar = true;
      satsSteg(B, S.steg);
      // öppnas den igen medan kameran ännu åker tillbaka: samma utgångsläge som förra gången
      const sen = S.foreSen && performance.now() - S.foreSen.tid < 2500 ? S.foreSen : null;
      S.fore = sen ? { pos: sen.pos.clone(), mal: sen.mal.clone() } : { pos: kamera.position.clone(), mal: styr.target.clone() };
      scen.classList.add('kf__scen--sprang');
      placeraPanel();
      panel.hidden = false;
      const K = kameraMal(B);
      S.vo = { x: K.ox, y: K.oy }; S.voK = lugn ? 1 : 0;
      I.akTill(K.pos, K.mt, lugn ? 0 : 1.6);
      // skuggkameran rymmer det sprängda huset, snön på taket tas bort, sidans fasta list göms (mobil)
      const ud = hus.userData, dl = ud.delar, ex = B.H.L / 2 + D + FONSTER_UT + 0.4, ez = B.H.W / 2 + D + FONSTER_UT + 0.4;
      B.ext0 = ud.ext; B.hojd0 = ud.hojd;
      ud.ext = { x0: Math.min(ud.ext.x0, -ex, B.slut[0]), x1: Math.max(ud.ext.x1, ex, B.slut[0]), z0: Math.min(ud.ext.z0, -ez, B.slut[1]), z1: Math.max(ud.ext.z1, ez, B.slut[1]) };
      ud.hojd = Math.max(ud.hojd, dl.Y0 + dl.hR + HP + 0.3);
      I.skuggRam();
      B.sno0 = I.sno.value; I.sno.value = 0;
      document.documentElement.classList.add('kspr-oppen');
      knapp.setAttribute('aria-pressed', 'true');
      byggLappar(B); markera();
      I.steg(steg_);
      flikar[S.steg].focus({ preventScroll: true });
      meddela();
      return true;
    } finally { S.vantar = false; knapp.removeAttribute('aria-busy'); }
  }
  function laggInnerDirekt(B) {
    const r = B.hus.userData.sprangInner || (B.hus.userData.sprangInner = byggInnervaggar(B.hus, B.H));
    if (!r) return;
    B.inner = r;
    if (!r.post.mesh.parent) B.hus.add(r.post.mesh);
  }
  const steg_ = (dt, nu) => steg(dt, nu);
  // direkt: utan animation (läget byts, huset byts); annars baklänges och kameran tillbaka
  function stang(direkt) {
    if (!S.bygge) { S.pa = false; if (S.vantar) S.avbruten = true; return; }
    S.pa = false; S.prov = null;
    LS.vald = null; LS.hover = null; LS.overblick = null; markeraDel(null);
    meddela();
    knapp.setAttribute('aria-pressed', 'false');
    lappar.classList.remove('kspr__lappar--syns');
    panel.hidden = true;
    if (direkt) { S.t = 0; slut(); return; }
    // tillbaka i full färg medan huset sätts ihop
    satsSteg(S.bygge, STEG.length - 1);
    if (S.fore) I.akTill(S.fore.pos, S.fore.mal, lugn ? 0 : 1.5);
    S.foreSpar = S.fore; S.fore = null;
    I.begarRender();
  }
  // stegbytet till andra delar av sidan (t.ex. priskortet): lyssnare och ett DOM-event
  const lyss = new Set();
  let sagt = null;
  function meddela() {
    const d = { steg: S.steg, namn: STEG[S.steg].namn, oppen: S.pa };
    const k = d.steg + '|' + d.oppen;
    if (k === sagt) return;
    sagt = k;
    lyss.forEach(fn => { try { fn(d); } catch (e) { console.warn(e); } });
    document.dispatchEvent(new CustomEvent('sprang-steg', { detail: d }));
  }
  function valjSteg(i) {
    const fokus = flikar.includes(document.activeElement);
    S.steg = Math.max(0, Math.min(STEG.length - 1, i | 0));
    markera();
    meddela();
    if (fokus) flikar[S.steg].focus({ preventScroll: true });
    if (!S.bygge) return;
    satsSteg(S.bygge, S.steg);
    synlighet(S.bygge, S.t);
    byggLappar(S.bygge);
    I.skugga(); I.begarRender();
  }

  // ---- händelser ----
  knapp.hidden = false;
  // ett klick medan vyn öppnas (studion byggs) avbryter öppningen: varje klick växlar
  knapp.addEventListener('click', () => { if (S.pa || S.vantar) stang(); else oppna(S.steg); });
  // pekaren på knappen: studion och inredningen börjar byggas redan nu
  ['pointerenter', 'focus'].forEach(h => knapp.addEventListener(h, () => { forStudio(); try { if (I.hus() && !I.hus().userData.inne) ritare.forbered(); } catch (e) { /* äldre motor */ } }));
  panel.addEventListener('click', e => {
    const f = e.target.closest('[data-kspr-steg]');
    if (f) { valjSteg(+f.getAttribute('data-kspr-steg')); return; }
    // Begär offert (sista paketet): adressen från priskortet just nu (paketet kan ha bytts nyss)
    const off = e.target.closest('a[data-kpris-offert]');
    if (off) { const k = document.querySelector('.kpris [data-kpris-offert]'); if (k) off.setAttribute('href', k.getAttribute('href')); return; }
    const p = e.target.closest('[data-kspr-pil]');
    if (p) { valjSteg(S.steg + +p.getAttribute('data-kspr-pil')); const ny = fot.querySelector('[data-kspr-pil="' + p.getAttribute('data-kspr-pil') + '"]') || (+p.getAttribute('data-kspr-pil') > 0 && fot.querySelector('.kspr__pil--offert')); if (ny && !ny.disabled) ny.focus(); else flikar[S.steg].focus(); return; }
    if (e.target.closest('[data-kspr-stang]')) { stang(); knapp.focus(); }
  });
  panel.querySelector('.kspr__flikar').addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -99 : e.key === 'End' ? 99 : 0;
    if (!d) return;
    e.preventDefault();
    valjSteg(S.steg + d); flikar[S.steg].focus();
  });
  document.addEventListener('keydown', e => {
    if (!S.pa) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (LS.vald !== null || LS.overblick) { tillbaka(); return; } stang(); knapp.focus(); return; }
    // tangenterna för de andra lägena: sprängvyn stängs direkt först
    if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[itpITP]$/.test(e.key) && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) stang(true);
  }, true);
  const rad = scen.querySelector('.kf__verktyg');
  if (rad) rad.addEventListener('click', e => {
    if (!S.pa) return;
    if (e.target.closest('[data-inne],[data-oppna],[data-plan],[data-spel],[data-bil]')) stang(true);
  }, true);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { placeraPanel(); if (S.bygge && S.pa) { const K = kameraMal(S.bygge); S.vo = { x: K.ox, y: K.oy }; I.begarRender(); } lappLista.forEach(l => { l.w = 0; }); LS.behov = true; LS.lost = null; markera(); ritaLappar(); I.begarRender(); }).observe(scen);

  // Sidan åker till gruppernas vinklar av sig själv (t.ex. när panelen rullar fram på mobil):
  // medan vyn är öppen ignoreras det. Väljer man själv en vinkel stängs vyn först.
  let valdVinkel = 0;
  document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('[data-vy],[data-vy-val],[data-inne-tumme]')) valdVinkel = performance.now(); }, true);
  document.addEventListener('keydown', e => { if (e.target && e.target.closest && e.target.closest('.kspr__reglage')) return; if (/^[1-6]$/.test(e.key) || e.key === 'ArrowLeft' || e.key === 'ArrowRight') valdVinkel = performance.now(); }, true);
  const vy0 = ritare.vy;
  if (typeof vy0 === 'function') ritare.vy = function (...arg) {
    if (S.pa || S.bygge) {
      if (performance.now() - valdVinkel > 800) return false;
      stang(true);
    }
    return vy0.apply(this, arg);
  };

  // ---- Genomskärningen (produktkorten Isolering och Underlagsduk) ----
  // Ett lokalt snitt i en vägg eller ett takfall: en ruta i fasaden (eller plåten) öppnas och
  // visar skikten bakom, med samma material som skiktsnittet ovan (mineralull mellan reglarna,
  // underlagsduk på råsponten). Huset själv rörs inte: en osynlig låda (bara djup, baksidorna,
  // djuptest "alltid") ritas efter fasaden och skär ett hål i djupbufferten; skikten ritas sedan i
  // hålet. snitt('isolering' | 'underlagsduk') bygger och öppnar, ger målet { min, max, n } (världen,
  // n = riktningen ut ur väggen/taket); snittStang(direkt) stänger. Kameran sköts av motorn.
  const SN = { grupp: null, typ: null, t: 0, mal: 0, hus: null, delar: null, tid: 0 };
  const SNITT_UT = 2.3, SNITT_IN = 0.8;   // sekunder: öppna (hålet växer, skikten glider på plats), stänga
  const snRay = new THREE.Raycaster();
  // uv i meter (en textur per 0,4 m, som skiktsnittet) på en låda w × h × d
  function snUv(g, w, h, d) {
    const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
      uv.setXY(i, uv.getX(i) * su / 0.4, uv.getY(i) * sv / 0.4);
    }
    return g;
  }
  const SN_BIT = 2;
  const stencilProv = m => { m.stencilWrite = true; m.stencilWriteMask = 0; m.stencilFuncMask = SN_BIT; m.stencilRef = SN_BIT; m.stencilFunc = THREE.EqualStencilFunc; return m; };
  const MASK = stencilProv(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthFunc: THREE.AlwaysDepth, side: THREE.BackSide }));
  // öppningens ruta i ytan: märker stencilen där hålet syns (djupprov: inget framför den)
  const OPPN = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: true });
  OPPN.stencilWrite = true; OPPN.stencilWriteMask = SN_BIT; OPPN.stencilRef = SN_BIT; OPPN.stencilFunc = THREE.AlwaysStencilFunc; OPPN.stencilZPass = THREE.ReplaceStencilOp;
  // trä i snittet: ådring längs bitens längd (riktning 'v' uppåt, 'u' åt sidan); 1 ruta = 0,4 m
  function traTextur(lang, mork) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = mork ? '#b98c55' : '#d4b07a'; x.fillRect(0, 0, 128, 512);
    let fro = mork ? 7 : 3;
    const sl = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const px = sl() * 128, bred = 0.6 + sl() * 2.2, ton = sl();
      x.strokeStyle = ton < 0.5 ? 'rgba(150,104,52,' + (0.12 + sl() * 0.22).toFixed(2) + ')' : 'rgba(255,240,210,' + (0.1 + sl() * 0.15).toFixed(2) + ')';
      x.lineWidth = bred; x.beginPath();
      let xx = px; x.moveTo(xx, 0);
      for (let y = 0; y <= 512; y += 32) { xx += (sl() - 0.5) * 2.4; x.lineTo(xx, y); }
      x.stroke();
    }
    for (let i = 0; i < 3; i++) {   // små kvistar
      const kx = sl() * 128, ky = sl() * 512, r = 3 + sl() * 4;
      const gr = x.createRadialGradient(kx, ky, 0, kx, ky, r * 2.2);
      gr.addColorStop(0, 'rgba(110,70,30,0.7)'); gr.addColorStop(0.5, 'rgba(140,95,45,0.35)'); gr.addColorStop(1, 'rgba(140,95,45,0)');
      x.fillStyle = gr; x.beginPath(); x.ellipse(kx, ky, r * 2.2, r * 3.4, 0, 0, Math.PI * 2); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (lang === 'u') { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
    return t;
  }
  // gipsskivans och underlagsdukens tryck: rader av text-streck och en tunn linje
  function tryckTextur(bas, ink, rader) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); x.fillStyle = bas; x.fillRect(0, 0, 256, 256);
    let fro = 5; const sl = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 1800; i++) { x.fillStyle = 'rgba(0,0,0,' + (sl() * 0.035).toFixed(3) + ')'; x.fillRect(sl() * 256, sl() * 256, 1.5, 1.5); }
    x.fillStyle = ink;
    rader.forEach(y => { let xx = 8; while (xx < 250) { const l = 4 + sl() * 14; x.fillRect(xx, y, l, 3); xx += l + 3 + (sl() < 0.18 ? 10 : 0); } x.fillRect(0, y + 9, 256, 1); });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  const SN_MAT = {
    kant: new THREE.MeshStandardMaterial({ color: 0x8c7a62, roughness: 0.9 }),
    bak: new THREE.MeshStandardMaterial({ color: F.gips, roughness: 0.95 }),
    traV: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, map: traTextur('v') }),
    traU: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, map: traTextur('u', true) }),
    sagat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, map: traTextur('v') }),
    ull: (() => { const t = ULL.clone(); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ color: 0xe8dca6, roughness: 1, map: t, bumpMap: t, bumpScale: 0.8 }); })(),
    vind: new THREE.MeshStandardMaterial({ color: 0xc4bfae, roughness: 0.9, map: tryckTextur('#c9c4b4', 'rgba(60,84,120,0.5)', [120]) }),
    plast: new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 0.6, depthWrite: false }),
    gips: new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.95 }),
    duk: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, map: tryckTextur('#2f3338', 'rgba(205,210,204,0.55)', [120]) }),
    spont: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, map: traTextur('u') }),
    fog: new THREE.MeshStandardMaterial({ color: 0xa88458, roughness: 0.95 }),
    ram: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, map: traTextur('v') }),
    dosa: new THREE.MeshStandardMaterial({ color: 0x7f868d, roughness: 0.55 }),
    vp: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: rafflaTex(), bumpMap: null }),
    kabel: new THREE.MeshStandardMaterial({ color: 0xdcdcd4, roughness: 0.45 }),
    skruv: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.35, metalness: 0.8 }),
    yta: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: traTextur('v') }),
    sida: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    gipsBak: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: tryckTextur('#cfc4ab', 'rgba(70,70,70,0.45)', [96]) }),
    tejp: new THREE.MeshStandardMaterial({ color: 0x7d93ad, roughness: 0.45 }),
  };
  Object.keys(SN_MAT).forEach(k => { if (k !== 'ram') stencilProv(SN_MAT[k]); });
  // avståndet längs riktningen d från p till första ytan i rot (eller null)
  function snAvst(rot, p, d) {
    snRay.set(p, d); snRay.far = 3; snRay.layers.enableAll(); snRay.camera = kamera;
    const h = (Array.isArray(rot) ? snRay.intersectObjects(rot, true) : snRay.intersectObject(rot, true)).find(x => x.object.isMesh && x.object.visible && x.object.material && !(x.object.material.transparent && x.object.material.opacity < 0.3));
    return h ? h.distance : null;
  }
  // en ruta (u0..u1, v0..v1) på en plan yta i ramen M (u, v i planet, +n ut): ytans läge n0 om hela
  // rutan är samma plana yta utan något framför (lampor, laddbox, rör), annars null
  function snYta(rot, M, u0, u1, v0, v1) {
    const ut = new THREE.Vector3().setFromMatrixColumn(M, 2).normalize().negate();
    const l = [];
    const K = 0.07, ua = u0 - K, ub = u1 + K, va = v0 - K, vb = v1 + K;
    for (let iu = 0; iu <= 8; iu++) for (let iv = 0; iv <= 7; iv++) {
      const p = new THREE.Vector3(ua + (ub - ua) * iu / 8, va + (vb - va) * iv / 7, 1).applyMatrix4(M);
      const d = snAvst(rot, p, ut);
      if (d === null) return null;
      l.push(1 - d);
    }
    const mn = Math.min(...l), mx = Math.max(...l);
    return mx - mn < 0.035 ? mx : null;
  }
  function snLada(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); return g; }
  // tvärsnittets textur: x = djupet (0 i ytan … 1 i z = -D), skikten som färgband med lite brus
  function snTvarTex(lager, D) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
    const x = c.getContext('2d');
    lager.forEach(([z0, z1, f]) => { x.fillStyle = f; x.fillRect(Math.floor(z0 / D * 1024), 0, Math.ceil((z1 - z0) / D * 1024) + 1, 64); });
    let fro = 9; const sl = () => { fro = (fro * 16807) % 2147483647; return fro / 2147483647; };
    for (let i = 0; i < 2600; i++) { x.fillStyle = sl() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'; x.fillRect(sl() * 1024, sl() * 64, 1 + sl() * 3, 1); }
    lager.forEach(([z0]) => { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(Math.floor(z0 / D * 1024), 0, 1, 64); });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  // hålets insida: botten (i z = -D) och fyra sidor som vetter inåt, med tvärsnittet som textur
  function snInsida(w, h, D, botten, sidMat) {
    const g = new THREE.Group();
    const bak = new THREE.Mesh(new THREE.PlaneGeometry(w, h), botten); bak.position.z = -D; g.add(bak);
    [[0, h / 2, Math.PI / 2, 0, w], [0, -h / 2, -Math.PI / 2, 0, w], [w / 2, 0, 0, -Math.PI / 2, h], [-w / 2, 0, 0, Math.PI / 2, h]].forEach(([x, y, rx, ry, l]) => {
      const geo = new THREE.PlaneGeometry(rx ? l : D, rx ? D : l);
      geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)).setPosition(x, y, -D / 2));
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, Math.min(1, Math.max(0, -p.getZ(i) / D)), (rx ? p.getX(i) : p.getY(i)) / 0.4);
      g.add(new THREE.Mesh(geo, sidMat));
    });
    g.traverse(o => { if (o.isMesh) { o.renderOrder = 6; o.receiveShadow = false; } });   // (skuggor gav prickig kant i flack vinkel)
    return g;
  }
  // ytans färg mitt i rutan (fasaden eller plåten), för den sågade kanten
  function snYtfarg(rot, M) {
    const p = new THREE.Vector3(0, 0, 0.6).applyMatrix4(M), d = new THREE.Vector3().setFromMatrixColumn(M, 2).normalize().negate();
    snRay.set(p, d); snRay.far = 2; snRay.layers.enableAll(); snRay.camera = kamera;
    const t = snRay.intersectObject(rot, true).find(x => x.object.isMesh && x.object.visible && x.object.material && !Array.isArray(x.object.material) && x.object.material.color);
    return t ? t.object.material : null;
  }
  // den sågade ytan (panel eller plåt) i samma färg och textur som fasaden/taket runt hålet
  function snYta2(ytM) {
    const m = SN_MAT.yta;
    m.color.copy(ytM && ytM.color ? ytM.color : new THREE.Color(0x8a5a44));
    m.map = ytM && ytM.map ? ytM.map : null;
    m.normalMap = ytM && ytM.normalMap ? ytM.normalMap : null;
    m.roughness = ytM && ytM.roughness !== undefined ? ytM.roughness : 0.75;
    m.metalness = ytM && ytM.metalness !== undefined ? ytM.metalness : 0;
    m.needsUpdate = true;
    return m.color;
  }
  // väggens el: dosa bakom gipsen, VP-rör upp och en kabel genom reglarna (dragen i installationsskiktet)
  function snEl(delar, u, v, X1, YB) {
    const grå = SN_MAT.dosa, rorM = SN_MAT.vp, kab = SN_MAT.kabel;
    const dosa = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.045, 28).rotateX(Math.PI / 2), grå);
    dosa.position.set(u, v, -0.2075); delar.push({ obj: dosa, fran: new THREE.Vector3(0, 0, 0.12), fas: 0.2 });
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 28).rotateX(Math.PI / 2), grå);
    lock.position.set(u, v, -0.228); delar.push({ obj: lock, fran: new THREE.Vector3(0, 0, 0.12), fas: 0.2 });
    // VP-röret (räfflat, 20 mm) från dosans ovansida upp genom hålet
    const rl = YB - (v + 0.03);
    const vp = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, rl, 14, 1, true), rorM);
    vp.geometry.attributes.uv.array.forEach((_, i, a) => { if (i % 2 === 1) a[i] *= rl / 0.012; });
    vp.position.set(u, v + 0.03 + rl / 2, -0.205); delar.push({ obj: vp, fran: new THREE.Vector3(0, 0.25, 0.08), fas: 0.3 });
    // kabeln (EKK 3G1,5) ut ur dosans sida, åt höger genom reglarnas borrhål
    const kl = X1 - (u + 0.034);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, kl, 10, 1, true).rotateZ(Math.PI / 2), kab);
    k.position.set(u + 0.034 + kl / 2, v - 0.006, -0.2); delar.push({ obj: k, fran: new THREE.Vector3(0.3, 0, 0.08), fas: 0.3 });
  }
  // räfflor för VP-röret
  function rafflaTex() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#b9bec4'; x.fillRect(0, 0, 8, 32);
    x.fillStyle = '#7d838a'; x.fillRect(0, 0, 8, 9); x.fillStyle = '#d6dade'; x.fillRect(0, 14, 8, 6);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // en låda från (u0, v0, z0) till (u1, v1, z1) i snittets lokala koordinater, uv i meter
  function snBit(delar, u0, u1, v0, v1, z0, z1, mat, fran, fas) {
    const w2 = u1 - u0, h2 = v1 - v0, d2 = Math.abs(z1 - z0);
    if (w2 <= 0.001 || h2 <= 0.001) return null;
    const m = new THREE.Mesh(snUv(snLada(w2, h2, d2), w2, h2, d2), mat);
    m.position.set((u0 + u1) / 2, (v0 + v1) / 2, (z0 + z1) / 2);
    delar.push({ obj: m, fran: fran || new THREE.Vector3(), fas: fas || 0, u0, u1 });
    return m;
  }
  // mineralull mellan två reglar: framsidan buktar ut någon cm i mitten och är lite ojämn,
  // kanterna mot reglarna trycks in
  function snUll(u0, u1, v0, v1, z0, z1) {
    const w2 = u1 - u0, h2 = v1 - v0, d2 = Math.abs(z1 - z0);
    const g2 = new THREE.BoxGeometry(w2, h2, d2, Math.max(2, Math.round(w2 / 0.025)), Math.max(2, Math.round(h2 / 0.04)), 1);
    const p = g2.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) < d2 / 2 - 1e-5) continue;
      const fx = (p.getX(i) + w2 / 2) / w2, y = p.getY(i);
      const bukt = Math.sin(Math.PI * Math.min(1, Math.max(0, fx))) * 0.012 - 0.006;
      const brus = Math.sin(y * 23.1 + fx * 9.7) * 0.0018 + Math.sin(y * 57.3 - fx * 31.1) * 0.0011;
      p.setZ(i, d2 / 2 + bukt + brus);
    }
    g2.computeVertexNormals();
    const m = new THREE.Mesh(snUv(g2, w2, h2, d2), SN_MAT.ull);
    m.position.set((u0 + u1) / 2, (v0 + v1) / 2, (z0 + z1) / 2);
    return m;
  }
  function snitt(typ) {
    const hus = I.hus();
    if (!hus || !hus.userData.delar) return null;
    if (S.pa || S.bygge) stang(true);
    if (SN.grupp && SN.typ === typ && SN.hus === hus && SN.mal === 1) return SN.svar;
    snittStang(true);
    const dl = hus.userData.delar;
    const Hm = Object.values(HUS).find(x => Math.abs(x.L - hus.userData.L) < 0.01 && Math.abs(x.W - hus.userData.W) < 0.01);
    if (!Hm) return null;
    const Y0 = dl.Y0, UP = new THREE.Vector3(0, 1, 0);
    hus.updateMatrixWorld(true);
    const blick = kamera.position.clone().setY(0).normalize();
    let rotS = hus; while (rotS.parent) rotS = rotS.parent;
    const hinder = [hus].concat(['laddplats', 'bebott'].map(n => rotS.getObjectByName(n)).filter(Boolean));
    // sakernas lådor (laddbox, kabel, krukor …) i världen: strålarna kunde missa en smal laddbox
    // mellan provpunkterna, så rutan prövas också mot lådorna med 15 cm marginal
    const hLador = [];
    hinder.slice(1).forEach(gr => gr.traverse(o => { if (o.isMesh && o.visible && !o.isInstancedMesh) { const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty()) hLador.push(b); } }));
    const krockar = (Ms, u0, u1, v0, v1, M = 0.15) => {
      const inv = new THREE.Matrix4().copy(Ms).invert(), lb = new THREE.Box3(), c = new THREE.Vector3();
      return hLador.some(b => {
        lb.makeEmpty();
        for (let i = 0; i < 8; i++) lb.expandByPoint(c.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(inv));
        return lb.max.x > u0 - M && lb.min.x < u1 + M && lb.max.y > v0 - M && lb.min.y < v1 + M && lb.max.z > -0.3 && lb.min.z < 1.2;
      });
    };
    const g = new THREE.Group(); g.name = 'produkt-snitt';
    const delar = [];   // { obj, fran: Vector3 (förskjutning i öppet läge = 0), fas }
    let M, w, h, n0, ram, sKvar = 99, halD = 0.25;
    // det senast lagda skiktet sågas tillbaka från vänster (från = där det börjar i hel vägg) vid start
    const sag = (start, fran) => { const d = delar[delar.length - 1]; d.peel = fran; d.start = start; };
    if (typ === 'isolering') {
      // en vägg som kameran ser, en ruta utan fönster, dörrar eller saker på väggen
      const R = ramar(Hm, dl), K = konturer(Hm, dl);
      const sidor = Object.keys(R).sort((a, b) => R[b].n.dot(blick) - R[a].n.dot(blick));
      w = 1.5; h = 1.35;
      for (const s of sidor) {
        const r = R[s], kont = K[s], len = r.len;
        const vMax = Math.min(...kont.filter(p => p[1] > 0.5).map(p => p[1]));
        if (vMax < h + 0.6) continue;
        const hal = Hm.oppningar.filter(o => o[0] === s);
        const Ms = new THREE.Matrix4().makeBasis(r.u, UP, r.n).setPosition(r.o.x, r.o.y + Y0, r.o.z);
        // från mitten och utåt, i steg om 0,15 m
        const v0 = Math.max(0.45, Math.min(0.75, (vMax - h) / 2));
        for (let k = 0; k < 2 * len / 0.15; k++) {
          const uc = len / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.15;
          const u0 = uc - w / 2, u1 = uc + w / 2;
          if (u0 < 0.35 || u1 > len - 0.35) continue;
          if (hal.some(o => u1 > o[1] - 0.25 && u0 < o[1] + o[2] + 0.25)) continue;
          if (krockar(Ms, u0, u1, v0, v0 + h)) continue;
          const nn = snYta(hinder, Ms, u0, u1, v0, v0 + h);
          if (nn === null) continue;
          M = Ms; n0 = nn; ram = { u0, u1, v0, v1: v0 + h, s };
          break;
        }
        if (M) break;
      }
      if (!M) return null;
      // lokalt: ruta centrerad i (0, 0), ytan i z = 0
      M = M.clone().multiply(new THREE.Matrix4().makeTranslation((ram.u0 + ram.u1) / 2, (ram.v0 + ram.v1) / 2, n0));
      // Väggen uppsågad trappstegsvis, utifrån och in, i riktiga tjocklekar: stående panel 22 mm,
      // liggande läkt 28 mm (luftspalt), vindskyddsskiva 9 mm, reglar 45 × 170 c 600 med mineralull,
      // ångspärr och gips 13 mm. Ingen ram: hålets sidor visar väggens sågade tvärsnitt, och längst
      // in syns elen (dosa, VP-rör och kabel) i installationsskiktet.
      const D = 0.243, fasF = snYta2(snYtfarg(hus, M));
      const sidTex = snTvarTex([[0, 0.022, '#' + fasF.getHexString()], [0.022, 0.05, '#3b352d'], [0.05, 0.059, '#c4bfae'], [0.059, 0.229, '#d6ca94'], [0.229, 0.2302, '#8fa3ae'], [0.2302, 0.243, '#e6e3da']], D);
      SN_MAT.sida.map = sidTex; SN_MAT.sida.needsUpdate = true;
      halD = D;
      const X0 = -w / 2 - 0.06, X1 = w / 2 + 0.06, YA = -h / 2 - 0.06, YB = h / 2 + 0.06;
      const sA = -w / 2 + 0.34, sB = sA + 0.6, sC = sB + 0.22, sE = sC + 0.2;   // trappstegen
      // gips och ångspärr (ångspärren slutar en bit in så att kanten syns)
      snBit(delar, X0, X1, YA, YB, -0.243, -0.2302, SN_MAT.gipsBak, null, 0);
      snBit(delar, -w / 2 + 0.08, X1, YA, YB, -0.2302, -0.2296, SN_MAT.plast, null, 0); sag(0.84, X0);
      snBit(delar, -w / 2 + 0.21, -w / 2 + 0.24, YA, YB, -0.2296, -0.2292, SN_MAT.tejp, null, 0);
      snEl(delar, -w / 2 + 0.19, -0.12, X1, YB);
      // reglar och ull
      const regU = []; for (let u = -w / 2 + 0.25 + 0.6; u < X1 + 0.6; u += 0.6) regU.push(u);
      regU.forEach(u => { if (u + 0.0225 > sA && u - 0.0225 < X1) snBit(delar, Math.max(sA, u - 0.0225), Math.min(X1, u + 0.0225), YA, YB, -0.2296, -0.059, SN_MAT.traV, new THREE.Vector3(0, 0, 0.05), 0.15); });
      const kanter = [sA].concat(regU.filter(u => u > sA && u < X1)).concat([X1]);
      for (let i = 0; i < kanter.length - 1; i++) {
        const a2 = i ? kanter[i] + 0.0225 : kanter[i], b2 = i < kanter.length - 2 ? kanter[i + 1] - 0.0225 : kanter[i + 1];
        if (b2 - a2 < 0.04) continue;
        delar.push({ obj: snUll(a2, b2, YA, YB, -0.2296, -0.061), fran: new THREE.Vector3(), fas: 0, u0: a2, u1: b2 });
        if (i === 0) sag(0.66, X0);
      }
      // vindskyddsskivan med en skarv, läkten med skruvar i varje regel, panelen sist
      snBit(delar, sB, X1, YA, YB, -0.059, -0.05, SN_MAT.vind, null, 0); sag(0.5, X0);
      // vindskyddet spikat i reglarna, c 150
      regU.filter(u => u > sB + 0.01 && u < X1).forEach(u => { for (let v = YA + 0.08; v < YB; v += 0.15) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0015, 8).rotateX(Math.PI / 2), SN_MAT.skruv); sp.position.set(u, v, -0.0497); delar.push({ obj: sp, fran: new THREE.Vector3(), fas: 0 }); } });
      if (sB + 0.36 < X1) snBit(delar, sB + 0.36, sB + 0.363, YA, YB, -0.0502, -0.0498, SN_MAT.fog, new THREE.Vector3(0.35, 0, 0.12), 0.5);
      [-h / 2 + 0.17, 0.02, h / 2 - 0.15].forEach((v, i) => {
        snBit(delar, sC, X1, v - 0.0225, v + 0.0225, -0.05, -0.022, SN_MAT.traU, null, 0); sag(0.34 + i * 0.04, X0);
        regU.filter(u => u > sC && u < X1).forEach(u => { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 10).rotateX(Math.PI / 2), SN_MAT.skruv); sk.position.set(u, v, -0.0215); delar.push({ obj: sk, fran: new THREE.Vector3(0, 0, 0.2), fas: 0.62 + i * 0.05 }); });
      });
      sKvar = sE;   // panelbrädorna till höger om sE stannar kvar (locket)
    } else if (typ === 'underlagsduk') {
      // takfallet mot kameran: en ruta i plåten, med läkten och underlagsduken under
      const L = Hm.L, W = Hm.W, sadel = Hm.tak === 'sadel';
      const sz = sadel ? (Math.sign(blick.z) || 1) : 1;
      const fot = sadel ? (sz > 0 ? (Hm.kupa ? dl.hS : dl.hS) : dl.hN) : dl.hS, topp = sadel ? dl.hR : dl.hN;
      const zf = sz * W / 2, zt = sadel ? 0 : -W / 2;
      // ramen: u längs x, v uppför fallet, n ut ur fallet
      const vdir = new THREE.Vector3(0, topp - fot, zt - zf), lang = vdir.length(); vdir.normalize();
      const nrm = new THREE.Vector3(1, 0, 0).cross(vdir).normalize();
      if (nrm.y < 0) nrm.negate();
      const uAx = vdir.clone().cross(nrm).normalize();   // höger hand: u × v = n
      w = Math.min(1.6, L * 0.3); h = Math.min(1.3, lang * 0.45);
      const xs = [];
      for (let k = 0; k < 24; k++) xs.push((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.3 + (Hm.kupa && sz > 0 ? L * 0.18 : 0));
      for (const xc of xs) {
        if (Math.abs(xc) + w / 2 > L / 2 - 0.4) continue;
        if (Hm.kupa && sz > 0 && xc - w / 2 < -L / 2 + Hm.kupa.langd + 0.3) continue;
        const o = new THREE.Vector3(xc, Y0 + fot, zf).addScaledVector(vdir, lang * 0.5);
        const Ms = new THREE.Matrix4().makeBasis(uAx, vdir, nrm).setPosition(o);
        const nn = snYta(hinder, Ms, -w / 2, w / 2, -h / 2, h / 2);
        if (nn === null) continue;
        M = Ms.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, nn));
        break;
      }
      if (!M) return null;
      // Takfallet uppsågat trappstegsvis, utifrån och in: plåten, bärläkt (tvärs), ströläkt (längs
      // fallet), underlagsduk i två våder, råspont 22 mm, och längst in takstol 45 × 170 med ull och
      // innertak. Ingen ram: hålets sidor visar takets sågade tvärsnitt.
      const D = 0.258, takF = snYta2(snYtfarg(hus, M));
      const sidTex = snTvarTex([[0, 0.003, '#' + takF.getHexString()], [0.003, 0.05, '#3b352d'], [0.05, 0.054, '#2f3338'], [0.054, 0.076, '#d4b07a'], [0.076, 0.246, '#d6ca94'], [0.246, 0.258, '#e6e3da']], D);
      SN_MAT.sida.map = sidTex; SN_MAT.sida.needsUpdate = true;
      halD = D;
      const X0 = -w / 2 - 0.06, X1 = w / 2 + 0.06, YA = -h / 2 - 0.06, YB = h / 2 + 0.06;
      const sA = -w / 2 + 0.3, sB = sA + 0.28, sC = sB + 0.28, sD = sC + 0.22, sE = sD + 0.18;
      const tu = -w / 2 + 0.16;
      snBit(delar, X0, X1, YA, YB, -0.258, -0.246, SN_MAT.gipsBak, null, 0);
      snBit(delar, tu - 0.0225, tu + 0.0225, YA, YB, -0.246, -0.076, SN_MAT.traV, new THREE.Vector3(0, 0, 0.05), 0.1);
      delar.push({ obj: snUll(X0, tu - 0.0225, YA, YB, -0.246, -0.078), fran: new THREE.Vector3(0, 0, 0.2), fas: 0.18 });
      delar.push({ obj: snUll(tu + 0.0225, sA + 0.2, YA, YB, -0.246, -0.078), fran: new THREE.Vector3(0, 0, 0.2), fas: 0.22 });
      // råspont: brädor 95 mm tvärs fallet
      for (let v = YA; v < YB; v += 0.095) {
        const st = 0.64 + (v - YA) / (YB - YA) * 0.12;
        snBit(delar, sA, X1, v, Math.min(YB, v + 0.092), -0.076, -0.054, SN_MAT.spont, null, 0); sag(st, X0);
        snBit(delar, sA, X1, v + 0.092, Math.min(YB, v + 0.095), -0.075, -0.056, SN_MAT.fog, null, 0); sag(st, X0);
      }
      // underlagsduken i två våder med överlapp
      snBit(delar, sB, X1, YA, 0.12, -0.054, -0.052, SN_MAT.duk, null, 0); sag(0.52, X0);
      snBit(delar, sB, X1, -0.03, YB, -0.052, -0.05, SN_MAT.duk, null, 0); sag(0.5, X0);
      // ströläkt längs fallet och bärläkt tvärs, plåten sist
      for (let u = sC + 0.05; u < X1; u += 0.6) snBit(delar, u - 0.0225, u + 0.0225, YA, YB, -0.05, -0.025, SN_MAT.traV, new THREE.Vector3(0, 0, 0.18), 0.66);
      for (let v = YA + 0.12; v < YB; v += 0.35) { snBit(delar, sD, X1, v - 0.035, v + 0.035, -0.025, -0.003, SN_MAT.traU, null, 0); sag(0.36, X0); }
      sKvar = sE;   // plåtvåderna till höger om sE stannar kvar (locket)
    } else return null;
    // hålet går från vänsterkanten till sågkanten (sKvar): till höger om den ligger fasadens egen
    // panel (plåt) kvar, så den sågade kanten är hålets högra sida och inget avviker i mönstret
    const hu1 = Math.min(w / 2, sKvar), hw = hu1 + w / 2, hcx = (hu1 - w / 2) / 2;
    {
      const D = halD;
      const mask = new THREE.Mesh(snLada(hw + 0.012, h + 0.012, D + 0.012), MASK); mask.position.set(hcx, 0, -D / 2 - 0.004); mask.renderOrder = 5;
      const ins = snInsida(hw, h, D, SN_MAT.gips, SN_MAT.sida); ins.position.x = hcx;
      const oppn = new THREE.Mesh(new THREE.PlaneGeometry(hw, h), OPPN); oppn.position.set(hcx, 0, 0.003); oppn.renderOrder = 4;
      g.add(mask, ins, oppn);
    }
    delar.forEach(d => { d.obj.renderOrder = 6; d.bas = d.obj.position.clone(); d.obj.castShadow = false; d.obj.receiveShadow = true; g.add(d.obj); });   // (skikten ligger under ytan: deras skuggor föll ut på fasaden/plåten utanför hålet)
    // allt i hålets låda klipps av masken: skikten utanför rutan (ändarna) skärs med ett plan per kant
    g.matrixAutoUpdate = false; g.matrix.copy(M);
    // (en aning innanför kanterna, så att skikten aldrig ligger i samma plan som hålets sidor och
    // flimrar; och planet i ytan: inget skikt sticker ut framför fasaden eller plåten)
    const plan = [[1, 0, hu1 - 0.004], [-1, 0, w / 2 - 0.004], [0, 1, h / 2 - 0.004], [0, -1, h / 2 - 0.004]].map(([a, b, c]) => new THREE.Plane(new THREE.Vector3(-a, -b, 0), c));
    plan.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0015));
    { const ramG = new THREE.Group(); g.add(ramG); SN.ram = ramG; }
    {
      const bw = typ === 'isolering' ? 0.12 : 0.2375, n = Math.ceil(hw / bw - 1e-6), lock = [];
      for (let i = 0; i < n; i++) {
        const u0 = -w / 2 + i * bw, u1 = Math.min(hu1, u0 + bw), b2 = u1 - u0;
        const mm = SN_MAT.yta.clone();
        mm.stencilWrite = false; mm.stencilFunc = THREE.AlwaysStencilFunc; mm.clippingPlanes = null;
        mm.transparent = true; mm.opacity = 1;
        const dj = typ === 'isolering' ? 0.022 : 0.004;
        const m = new THREE.Mesh(snUv(snLada(b2 - 0.002, h, dj), b2, h, dj), mm);
        m.position.set((u0 + u1) / 2, 0, 0.0015 - dj / 2); m.renderOrder = 7; m.castShadow = true; m.receiveShadow = false;
        // de som ligger till vänster om sKvar lyfts bort, från höger (vid sågkanten) mot vänster
        const nLyft = n, kvar = false;
        const ord = Math.max(0, nLyft - 1 - i) / Math.max(1, nLyft - 1);
        lock.push({ m, bas: m.position.clone(), start: kvar ? 99 : 0.02 + ord * 0.24, vrid: (i % 2 ? 1 : -1) * (0.08 + (i * 37 % 7) * 0.015) });
        g.add(m);
      }
      SN.lock = lock;
    }
    const varldPlan = () => plan.map(p => p.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(hus.matrixWorld, g.matrix)));
    const klipp = varldPlan();
    I.renderer.localClippingEnabled = true;
    [...new Set(delar.map(d => d.obj.material))].forEach(m => { m.clippingPlanes = klipp; });
    g.userData.klipp = klipp;
    hus.add(g); g.updateMatrixWorld(true);
    SN.grupp = g; SN.typ = typ; SN.hus = hus; SN.delar = delar; SN.w = w; SN.h = h; SN.t = 0; SN.mal = 1; SN.mask = [g.children[0], g.children[1], g.children[2], SN.ram];
    snSatt(lugn ? 1 : 0.001);
    if (lugn) SN.t = 1;
    I.steg(snSteg);
    // målet i världen: rutan, lite djup
    const box = new THREE.Box3();
    [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]].forEach(([u, v]) => [0.03, typ === 'isolering' ? -0.28 : -0.13].forEach(z => box.expandByPoint(new THREE.Vector3(u, v, z).applyMatrix4(g.matrixWorld))));
    const n = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).normalize();
    SN.svar = { min: box.min.toArray(), max: box.max.toArray(), n: n.toArray(), fyll: 0.5 };
    I.begarRender();
    return SN.svar;
  }
  // läget t (0 stängt … 1 öppet): hålet växer ut från mitten, skikten glider på plats efter sina faser
  // t (0 stängt … 1 öppet): först lyfts fasadens brädor (plåtens våder) ut ur väggen och bort en i
  // taget, sedan glider skikten på plats. Baklänges när snittet stängs.
  function snSatt(t) {
    const syns = t > 0.004;
    SN.mask.forEach(m => { m.scale.set(1, 1, 1); m.visible = syns; });
    (SN.lock || []).forEach(L => {
      const e = inUt(Math.min(1, Math.max(0, (t - L.start) / 0.32)));
      L.m.position.copy(L.bas); L.m.position.z += e * 0.42; L.m.position.y += Math.sin(e * Math.PI) * 0.06 + e * 0.1;
      L.m.rotation.set(-e * 0.35, 0, L.vrid * e);
      const o = 1 - Math.min(1, Math.max(0, (e - 0.45) / 0.55));
      L.m.material.opacity = o; L.m.material.depthWrite = o > 0.98; L.m.visible = o > 0.01;
    });
    SN.delar.forEach(d => {
      d.obj.position.copy(d.bas);
      if (d.peel !== undefined) {
        const k = inUt(Math.min(1, Math.max(0, (t - d.start) / 0.17)));
        const vanster = d.peel + (d.u0 - d.peel) * k;
        d.obj.scale.x = (d.u1 - vanster) / (d.u1 - d.u0);
        d.obj.position.x = (vanster + d.u1) / 2;
      }
      d.obj.visible = syns;
    });
  }
  function snSteg(dt) {
    if (!SN.grupp) return false;
    if (SN.hus !== I.hus()) { snittStang(true); return false; }
    const fore = SN.t;
    if (SN.mal > SN.t) SN.t = Math.min(1, SN.t + dt / SNITT_UT);
    else if (SN.mal < SN.t) SN.t = Math.max(0, SN.t - dt / SNITT_IN);
    if (SN.t !== fore) snSatt(SN.t);
    if (SN.t === 0 && SN.mal === 0) { snittStang(true); return true; }
    return SN.t !== SN.mal;
  }
  function snittStang(direkt) {
    if (!SN.grupp) return;
    if (!direkt && !lugn && SN.t > 0) { SN.mal = 0; I.steg(snSteg); I.begarRender(); return; }
    const g = SN.grupp;
    if (g.parent) g.parent.remove(g);
    g.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    (SN.lock || []).forEach(L => L.m.material.dispose()); SN.lock = null;
    Object.values(SN_MAT).forEach(m => { m.clippingPlanes = null; });
    if (SN_MAT.sida.map) { SN_MAT.sida.map.dispose(); SN_MAT.sida.map = null; SN_MAT.sida.needsUpdate = true; }
    SN.grupp = null; SN.typ = null; SN.delar = null; SN.svar = null; SN.mal = 0; SN.t = 0;
    if (!S.bygge) I.steg(null);
    I.begarRender();
  }

  // API (ritare.sprangVy): oppna(steg 0–3) öppnar vyn på ett paket (eller byter paket om den är
  // öppen), stang(), steg(i) byter paket, aktuelltSteg() ger det valda (0–3), arOppen(),
  // paket() ger namnen i ordning, vidSteg(fn) anropas med { steg, namn, oppen } vid varje byte
  // (också när vyn öppnas och stängs) och ger tillbaka en funktion som tar bort lyssnaren.
  // Samma uppgift kommer som CustomEvent 'sprang-steg' på document (detail = samma objekt).
  const api = {
    oppna, stang: () => stang(), steg: valjSteg, arOppen: () => S.pa,
    aktuelltSteg: () => S.steg,
    // isärdragningen 0–1 (som reglaget): mangd() läser, mangd(v) sätter
    mangd: v => { if (v === undefined || v === null) return S.mangd; satsMangd(+v, true); return S.mangd; },
    paket: () => STEG.map(s => s.namn),
    vidSteg(fn) { if (typeof fn !== 'function') return () => {}; lyss.add(fn); return () => lyss.delete(fn); },
    // för bildverktygen: prov(t) fryser sprängningen vid t (0–1), prov(null) släpper
    prov(t) { S.prov = t === null || t === undefined ? null : Math.min(1, Math.max(0, +t)); if (S.prov !== null) S.t = -1; I.begarRender(); return S.t; },
    bygge: () => S.bygge,
    lage: () => ({ pa: S.pa, t: +S.t.toFixed(3), steg: S.steg, delar: S.bygge ? S.bygge.poster.length : 0 }),
    // för bildverktygen: etiketternas läge (prick, kortets mål och nuvarande förskjutning, ton)
    lappLage: () => lappLista.map(l => ({ nr: l.nr, a: l.a, lok: l.lok ? l.lok.toArray().map(v => +v.toFixed(3)) : null, x: +(l.x || 0).toFixed(1), y: +(l.y || 0).toFixed(1), mal: l.mal, cur: l.cur, ihop: l.ihop, skymd: l.skymd, malPrick: l.malPrick, ka: +l.ka.toFixed(2), sida: l.sidaI, w: l.w, h: l.h, ruta: S.bygge && l.lok && l.p ? delRuta(S.bygge, l, duk.offsetLeft, duk.offsetTop, duk.clientWidth, duk.clientHeight) : null })),
    // produktkorten: en lokal genomskärning i väggen (isolering) eller taket (underlagsduk)
    snitt, snittStang: direkt => snittStang(!!direkt), snittLage: () => (SN.grupp && SN.mal === 1 ? SN.typ : null),
  };
  ritare.sprangVy = api;
  // skiktens shaders kompileras i förväg när datorn är ledig (annars frös den första bilden av
  // sprängningen ett par sekunder medan programmen länkades)
  const forkompilera = () => {
    try {
      const r = I.renderer;
      if (!r || !r.compileAsync || !I.scene) return;
      const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
      [lagerMat().tra, lagerMat().plast, lagerMat().tejp, lagerMat().vind, ISOL_MAT, LAGER_MAT, MARK_MAT, jordMat(), betongMat(), GHOST, SPR_GLAS, GLOD].forEach(m => { const x = new THREE.Mesh(geo, m); x.castShadow = true; x.receiveShadow = true; g.add(x); });
      r.compileAsync(g, kamera, I.scene).catch(() => {}).finally(() => geo.dispose());
    } catch (e) { /* bara en förberedelse */ }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(forkompilera, { timeout: 8000 }); else setTimeout(forkompilera, 4000);
  I.vidSteg = api.vidSteg;
  return api;
}
