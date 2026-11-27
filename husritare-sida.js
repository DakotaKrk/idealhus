// Kopplar rita-hus.html till 3D-scenen i husritare.js.
// Upplägg som en bilkonfigurator: valen i fällbara grupper, kameran åker till
// rätt vinkel för gruppen man ändrar i, vinkelbilder under scenen och en
// sammanfattning längst ner. Länken sparar allt som valts.
// Inne-läget och miljölistan används bara om motorn har dem (ritare.inne,
// ritare.inneVyer, ritare.miljoLista); annars syns sidan som förut.
// Inbäddat läge (?inbaddad=1, för husens egna sidor i en iframe): bara scenen och en
// kort verktygsrad, länk till hela husritaren, och 3D:n startar först när den syns.
import { skapaRitare, FARGER, MODELLER } from './husritare.js?v=20261126t';
import { PRODUKTER, GRUPPER, OMRADEN, PROD_IKON, skapaKort, skapaFokus, loggaBild, loggaReserv } from './husritare-produkt.js?v=20261126t';
import { kopplaPris, lasPaket } from './husritare-pris.js?v=20261126t';
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';

const MOTOR_V = '20261126t';
// Standardutseendet: utan val i adressen (och när man kommer tillbaka till sidan med bakåtknappen
// eller laddar om den) möts man av samma bild varje gång: Kupa 40 i falurött med svart tak och
// vita detaljer, vinter, gyllene timmen, kameran i startvyn. Adressen som sidan själv skriver
// medan man väljer (spara) minns i sessionStorage, så att en delad länk med val fortfarande gäller.
const STANDARD = 'modell=kupa-40&fasad=falu&tak=svart&detalj=vit&tid=19.2&miljo=vinter';
// Kupa 30 och Kupa 40 hette Sadel 30 och Sadel 40 (namnbyte 2026-11-18). Koden, bilderna och
// planerna har kvar id:na sadel-30/sadel-40; adressen visar kupa-30/kupa-40 och båda läses.
const MODELL_IN = { 'kupa-30': 'sadel-30', 'kupa-40': 'sadel-40' };
const MODELL_UT = { 'sadel-30': 'kupa-30', 'sadel-40': 'kupa-40' };
const modellId = m => MODELL_IN[m] || m;
const LAGE_NYCKLAR = ['modell', 'fasad', 'tak', 'detalj', 'tid', 'miljo', 'vy', 'rum', 'matt', 'oppen', 'lager', 'tomt', 'plan', 'bil'];
const EGEN_NYCKEL = 'rita-hus-egen';
const egenAdress = () => { try { return sessionStorage.getItem(EGEN_NYCKEL) || ''; } catch (e) { return ''; } };
(function standardval() {
  const q = new URLSearchParams(location.search);
  let nav = {};
  try { nav = performance.getEntriesByType('navigation')[0] || {}; } catch (e) { /* äldre webbläsare */ }
  const tillbaka = (nav.type === 'back_forward' || nav.type === 'reload') && location.search.slice(1) === egenAdress();
  if (LAGE_NYCKLAR.some(k => q.has(k)) && !tillbaka) return;
  const ny = new URLSearchParams(STANDARD);
  q.forEach((v, k) => { if (!LAGE_NYCKLAR.includes(k)) ny.set(k, v); });   // prov, intro, inbaddad, foto … följer med
  try { history.replaceState(history.state, '', '?' + ny.toString() + location.hash); } catch (e) { /* förhandsvisning */ }
})();
const Q0 = new URLSearchParams(location.search);
const INB = Q0.get('inbaddad') === '1';
if (INB) document.documentElement.classList.add('inbaddad');
// Fotoläge (?foto=1, för bilder med headless Edge): bara scenen över hela fönstret, inget
// gränssnitt, inget intro, ingen snurr, inget liv. När allt är byggt och stilla sätts
// <html data-foto-klar="1">. Går ihop med modell, miljo, tid, fasad, tak, detalj och vy
// (runt, soder, ost, norr, vast, hjalte m.fl.).
const FOTO = Q0.get('foto') === '1';
if (FOTO) document.documentElement.classList.add('foto');
const START_MODELL = MODELLER[modellId(Q0.get('modell'))] ? modellId(Q0.get('modell')) : 'sadel-40';
const scen = document.querySelector('.kf__scen');
// inbäddad: vänta tills ramen syns (iframen kan ligga långt ned på sidan)
if (INB && !FOTO && 'IntersectionObserver' in window) {
  await new Promise(klar => {
    const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); klar(); } }, { rootMargin: '120px 0px' });
    io.observe(scen);
  });
}
const kf = document.querySelector('.kf');
const duk = document.querySelector('.ritare__duk');
const laddar = document.querySelector('.ritare__laddar');
const tips = document.querySelector('.ritare__tips');
const tipsText = tips.querySelector('span') || tips;
if (matchMedia('(pointer: coarse)').matches) tipsText.textContent = 'Dra för att vrida · nyp för att zooma';
const TIPS_UTE = tipsText.textContent;
const PLANER = {
  'sadel-30': [['sadel-30', 'Plan'], ['sadel-30-loft', 'Loft']],
  'sadel-40': [['sadel-40', 'Plan'], ['sadel-40-loft', 'Loft']],
  'sadel-50': [['sadel-50', 'Plan'], ['sadel-50-loft', 'Loft']],
  'pulpet-70': [['pulpet-70', 'Plan']],
  'sadel-90': [['sadel-90', 'Plan']],
};
// Ytterväggarnas hörn i planbilderna (bildpunkter: bredd, höjd, vänster, topp,
// höger, botten), uppmätta i images/plan/. Används för kartan inne i huset.
const PLANRUTA = {
  'sadel-30': [1171, 771, 45, 90, 1011, 609],
  'sadel-40': [1527, 832, 71, 117, 1368, 636],
  'sadel-50': [1851, 806, 71, 117, 1693, 636],
  'pulpet-70': [1698, 1206, 191, 164, 1491, 1074],
  'sadel-90': [1796, 1224, 178, 111, 1738, 1021],
};
// loftets planbilder (images/plan/*-loft.webp), uppmätta på samma sätt
const PLANRUTA_LOFT = {
  'sadel-30': [1158, 735, 46, 84, 1020, 604],
  'sadel-40': [1459, 699, 46, 46, 1345, 566],
  'sadel-50': [1784, 699, 46, 46, 1670, 566],
};
// kartan för våningen man står på: loftets plan och ruta när man är på loftet
let kartaNiva = 0;
const pakLoft = () => kartaNiva === 1 && PLANRUTA_LOFT[val.modell] && PLANER[val.modell][1];
const kartaRuta = () => (pakLoft() ? PLANRUTA_LOFT[val.modell] : PLANRUTA[val.modell]);
const vyNiva = v => (v && (v.niva === 'loft' || v.niva === 1) ? 1 : 0);
const TUMMAR = [...document.querySelectorAll('.ktumme[data-vy]')];
const VINKLAR = TUMMAR.map(t => t.getAttribute('data-vy'));
const lugn = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TONA = { overgang: 'tona' };
// kör fn när nästa ruta är ritad (i en flik i bakgrunden: efter 120 ms)
const efterRuta = fn => { let k = false; const f = () => { if (!k) { k = true; fn(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 120); };
// Se inne och tillbaka ut: kameran åker genom ytterdörren (motorn faller tillbaka på toning
// där det inte går: loftet, taket av, minskad rörelse)
const DORR = { overgang: 'dorr' };
// Motorn berättar om åkningen: vinjetten tätnar kring dörröppningen (bara opacitet på ett
// eget lager), skyltarna inne väntar tills man har landat, och knappen visar om inredningen
// byggs färdigt först.
const flygEl = document.querySelector('.kf__flyg');
// (anropas varje ruta under åkningen: sidan rörs bara när något faktiskt har ändrats)
const flygNu = { pa: false, k: '', vantar: false, knapp: null };
function visaFlyg(i) {
  const pa = !!(i && i.pa), k = pa ? (Math.round(Math.max(0, Math.min(1, +i.k || 0)) * 50) / 50).toFixed(2) : '', vantar = pa && !!i.vantar;
  if (pa !== flygNu.pa) { flygNu.pa = pa; scen.classList.toggle('kf__scen--flyger', pa); }
  if (k !== flygNu.k) { flygNu.k = k; if (flygEl) flygEl.style.opacity = k; }
  if (vantar !== flygNu.vantar) {
    flygNu.vantar = vantar;
    const b = flygNu.knapp || (flygNu.knapp = document.querySelector('[data-inne]'));
    if (b) { if (vantar) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy'); }
  }
}

// ---- övergången: motorn tonar förra bilden på grafikkortet (ingen bild i sidan) ----
// för byten som inte går via vy() eller inne() (modell och miljö)
function tonaSjalv() {
  if (!ritare || lugn() || typeof ritare.tona !== 'function') return;
  try { ritare.tona(); } catch (e) { /* utan toning blir det ett rakt klipp */ }
}

let ritare = null;
var prisKort = null;   // var: uppdatera() och spara() kan köras innan kortet är uppsatt
var skickaText = '';
// Laddningen i ordning: logotypen ritar sig först (sidan är stilla under tiden, bara modulerna
// hämtas), sedan byggs scenen i steg med pauser emellan och dess program kompileras utan att
// låsa sidan. När första bilden finns öppnas slöjan, och först då börjar monteringen och
// kamerans intro (motorns starta), så att man ser dem från början.
// Förloppslinjen följer motorns mätmärken (vidLaddning); mellan märkena kryper den långsamt mot
// nästa steg, så att den aldrig står still och aldrig går bakåt. Raden under säger vad som pågår.
const LADD_STEG = {
  'rit-motor': [0.3, 'Tänder himlen'], 'rit-himmel': [0.36, 'Planterar runt huset'], 'rit-miljo': [0.55, 'Målar fasaden'],
  'rit-ytor': [0.62, 'Reser väggarna'], 'rit-scen': [0.74, 'Lägger taket'], 'rit-kompilerat': [0.93, 'Tänder lamporna'], 'rit-forsta-bild': [1, null],
};
const ladd = { mal: 0.24, nu: 0.02, tak: 0.3, raf: 0, sist: 0, text: '' };
const laddLinje = laddar && laddar.querySelector('.ritare__laddar-linje i'), laddText = laddar && laddar.querySelector('[data-laddar-text]');
function laddStatus(text) {
  if (!laddText || !text || text === ladd.text) return;
  ladd.text = text;
  if (lugn()) { laddText.textContent = text; return; }
  laddText.classList.add('byt');
  setTimeout(() => { laddText.textContent = text; laddText.classList.remove('byt'); }, 220);
}
function laddSteg(namn) {
  const s = LADD_STEG[namn];
  if (!s) return;
  ladd.mal = Math.max(ladd.mal, s[0]);
  const ordning = Object.values(LADD_STEG).map(x => x[0]), nasta = ordning.find(x => x > s[0]);
  ladd.tak = Math.max(ladd.tak, nasta ? s[0] + (nasta - s[0]) * 0.85 : 1);
  laddStatus(s[1]);
}
function laddRita(nu) {
  ladd.raf = 0;
  const dt = ladd.sist ? Math.min(0.1, (nu - ladd.sist) / 1000) : 0;
  ladd.sist = nu;
  // ikapp mot målet, annars en krypfart mot nästa steg (högst 85 % av vägen dit)
  const ny = ladd.nu < ladd.mal ? ladd.nu + (ladd.mal - ladd.nu) * (1 - Math.exp(-dt / 0.25)) : Math.min(ladd.tak, ladd.nu + dt * 0.012);
  if (ny > ladd.nu) { ladd.nu = ny; laddLinje.style.setProperty('--p', ladd.nu.toFixed(4)); }
  if (!laddar.classList.contains('klar')) ladd.raf = requestAnimationFrame(laddRita);
}
if (laddLinje && !FOTO) { laddStatus('Hämtar ritningen'); ladd.raf = requestAnimationFrame(laddRita); }
try {
  ritare = await skapaRitare(duk, {
    vidLaddning: laddSteg,
    // modellen ur länken direkt, så att huset inte byggs två gånger
    modell: START_MODELL, montera: !FOTO && Q0.get('intro') !== '0', foto: FOTO,
    miljo: Q0.get('miljo') || undefined,   // miljön byggs direkt (inte studion först)
    // motorn stängde av livet för att datorn inte orkade
    vidLiv: pa => { const b = document.querySelector('[data-liv]'); if (b) b.setAttribute('aria-pressed', String(!!pa)); if (!pa) visaTips('Rörelserna i miljön pausades för att bilden ska flyta', 4000); },
    vidFlytt: pos => flyttadInne(pos),
    // dörrar, sittplatser och lampor: etiketten vid pekaren (eller under siktet i Spelläget)
    vidMal: info => visaMal(info),
    vidSpel: pa => visaSpel(pa),
    vidSitt: pa => visaSitt(pa),
    vidLampor: l => visaLampor(l),
    // ljusets snabbval glider i motorn; reglaget och klockan följer varje steg
    vidTid: t => foljTid(t),
    vidFlyg: i => visaFlyg(i),
    // klick eller tryck på ytterdörren utifrån: samma som Se inne (åkningen genom dörren)
    vidDorrIn: () => { dorrTipsSett(); if (vyLage() === 'ute') bytLage('inne'); },
    // klick på taket, hängrännan eller stupröret utifrån: produktkortet
    vidDel: id => oppnaProdukt(id, null),
  });
  ritare.tema(document.documentElement.getAttribute('data-tema') === 'mork');
  // slöjan öppnas när logotypen har ritat sig (cirka 1,4 s) och scenens första bild är klar;
  // en dator som aldrig blir klar får se scenen ändå efter 20 s. Sedan bort helt.
  const visaScen = () => {
    // klart inom 0,6 s (cachat): ingen uppritning, bara en snabb toning
    if (performance.now() < 600) laddar.classList.add('snabb');
    cancelAnimationFrame(ladd.raf);
    laddar.classList.add('klar'); scen.classList.add('kf__scen--klar');
    try { if (typeof ritare.starta === 'function') ritare.starta(); } catch (e) { console.warn(e); }
    setTimeout(() => laddar.classList.add('borta'), 1200);
    setTimeout(visaDorrTips, 5000);
  };
  const redo = ritare.redo && typeof ritare.redo.then === 'function' ? ritare.redo : Promise.resolve();
  // logotypen hinner rita sig (1,6 s från första målningen), utom när allt var klart inom 0,6 s
  const klarVid = Promise.race([redo, new Promise(r => setTimeout(r, 20000))]).then(() => performance.now(), () => performance.now());
  klarVid.then(t => new Promise(r => setTimeout(r, t < 600 || lugn() ? 0 : Math.max(0, 1650 - performance.now())))).then(visaScen, visaScen);
} catch (e) {
  laddar.textContent = 'Din webbläsare kan inte visa 3D. Planerna finns längre ner.';
  laddar.removeAttribute('aria-hidden'); laddar.setAttribute('role', 'alert');
  console.warn(e);
}
const kan = namn => !!(ritare && typeof ritare[namn] === 'function');
// ?prov=1 (bildverktygen): motorn nås som window.__ritare
if (Q0.get('prov') === '1') window.__ritare = ritare;
if (ritare) { duk.__ritare = ritare; duk.__produktbild = produktbild; }   // Bygg online (husritare-app.js): studiobilden till offerten

const val = { modell: START_MODELL, fasad: null, tak: null, detalj: null };
const aktiv = g => val[g] || MODELLER[val.modell].farg[g];
const nf = v => String(v).replace('.', ',');

// ---- tipset i scenen ----
let tipsTid = 0, harDragit = false;
function visaTips(text, ms = 4000) {
  clearTimeout(tipsTid);
  if (!text) { tips.classList.add('borta'); return; }
  tipsText.textContent = text;
  // ett meddelande syns även när handen med "Dra för att vrida" redan gått undan
  tips.classList.add('kf__tips--besked');
  tips.classList.remove('borta');
  tipsTid = setTimeout(() => tips.classList.add('borta'), ms);
}
// ytterdörren går att klicka på utifrån: ett diskret tips första gången (sedan aldrig mer)
const DORR_TIPS = 'legohus-dorr-tips';
function dorrTipsSett() { try { localStorage.setItem(DORR_TIPS, '1'); } catch (e) { /* privat läge */ } }
function visaDorrTips() {
  if (INB || FOTO || vyLage() !== 'ute') return;
  try { if (localStorage.getItem(DORR_TIPS)) return; } catch (e) { return; }
  dorrTipsSett();
  visaTips(finPekare.matches ? 'Klicka på dörren för att gå in' : 'Tryck på dörren för att gå in', 5000);
}
// handen visas en gång per besök och går undan efter 5 s även om ingen drar
const TIPS_NYCKEL = 'legohus-ritare-tips';
function gomHanden() {
  harDragit = true; scen.classList.add('kf__scen--dragit');
  try { sessionStorage.setItem(TIPS_NYCKEL, '1'); } catch (e) { /* privat läge */ }
}
try { if (sessionStorage.getItem(TIPS_NYCKEL)) gomHanden(); } catch (e) { /* privat läge */ }
if (!harDragit) setTimeout(() => { if (!harDragit) gomHanden(); }, 5000);

// ---- inne: hur man går (chipet ovanför verktygen och ?-knappen) ----
// glider in när man kliver in, går bort efter 4 s eller vid första rörelsen
const gangTips = document.querySelector('[data-gang-tips]');
const hjalpKnapp = document.querySelector('[data-hjalp]');
let gangTid = 0, gangVisad = 0;
function visaGang(pa, ms = 4000) {
  if (!gangTips) return;
  clearTimeout(gangTid);
  pa = !!pa;
  gangTips.classList.toggle('syns', pa);
  gangTips.setAttribute('aria-hidden', String(!pa));
  if (hjalpKnapp) hjalpKnapp.setAttribute('aria-pressed', String(pa));
  if (pa) {
    gangVisad = performance.now(); gangTid = setTimeout(() => visaGang(false), ms);
    // krockar raden med kartan (låg scen, kartan uppe till höger): till vänster om kartan
    gangTips.classList.remove('kf__gang--vanster');
    const k = document.querySelector('[data-karta]');
    if (k && !k.hidden && getComputedStyle(k).display !== 'none') {
      const a = gangTips.getBoundingClientRect(), b = k.getBoundingClientRect();
      if (a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom) gangTips.classList.add('kf__gang--vanster');
    }
  }
}
// första rörelsen i scenen tar bort det (inte samma klick som visade det)
function gangRorelse() {
  if (gangTips && gangTips.classList.contains('syns') && performance.now() - gangVisad > 350) visaGang(false);
}

// ---- inne: det man kan göra (dörrar, luckor, lådor, sitta, lampor) ----
// motorn talar om vad pekaren eller siktet står på; etiketten följer pekaren
const malChip = document.querySelector('[data-mal]');
const malText = malChip && malChip.querySelector('[data-mal-text]');
const resKnapp = document.querySelector('[data-res-dig]');
const spelKnapp = document.querySelector('[data-spel]');
const lampKnapp = document.querySelector('[data-lampor]');
const finPekare = matchMedia('(hover: hover) and (pointer: fine)');
let malInfo = null, pekX = 0, pekY = 0, spelPa = false, spelSlut = 0;
function placeraMal() {
  if (!malChip || !malInfo || malInfo.mitt) return;
  const r = scen.getBoundingClientRect();
  const x = Math.min(r.width - malChip.offsetWidth - 8, Math.max(8, pekX - r.left + 16));
  const y = Math.min(r.height - malChip.offsetHeight - 8, Math.max(8, pekY - r.top + 18));
  malChip.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)';
}
function visaMal(info) {
  if (!malChip) return;
  malInfo = info && info.text ? info : null;
  if (!malInfo) { malChip.hidden = true; return; }
  malText.textContent = malInfo.text;
  malChip.classList.toggle('kf__mal--mitt', !!malInfo.mitt);
  if (malInfo.mitt) malChip.style.transform = '';
  malChip.hidden = false;
  placeraMal();
}
duk.addEventListener('pointermove', e => { pekX = e.clientX; pekY = e.clientY; if (malInfo && !malInfo.mitt) placeraMal(); }, { passive: true });
duk.addEventListener('pointerleave', () => { if (malInfo && !malInfo.mitt) visaMal(null); });
function visaSpel(pa) {
  pa = !!pa;
  if (spelPa && !pa) spelSlut = performance.now();
  spelPa = pa;
  scen.classList.toggle('kf__scen--spel', pa);
  if (spelKnapp) spelKnapp.setAttribute('aria-pressed', String(pa));
}
function visaSitt(pa) {
  if (resKnapp) resKnapp.hidden = !pa || !inneLage;
}
function visaLampor(l) {
  if (!lampKnapp) return;
  lampKnapp.hidden = !inneLage || !l || !l.antal;
  lampKnapp.setAttribute('aria-pressed', String(!!(l && l.tanda)));
}
if (resKnapp) resKnapp.addEventListener('click', () => { if (kan('resDig')) ritare.resDig(); duk.focus({ preventScroll: true }); });
if (lampKnapp) lampKnapp.addEventListener('click', () => { if (kan('allaLampor')) ritare.allaLampor(lampKnapp.getAttribute('aria-pressed') !== 'true'); });
if (spelKnapp) spelKnapp.addEventListener('click', () => {
  if (!kan('spel')) return;
  const pa = !spelPa;
  // pekarlåset måste begäras i klicket
  const svar = !!ritare.spel(pa);
  visaSpel(svar);
  if (svar) { visaGang(false); duk.focus({ preventScroll: true }); }
});
// Spelläget: på pekskärm (eller utan pekarlås) finns det inte, där räcker det att trycka på en dörr
const kanSpelNu = () => !!spelKnapp && kan('spel') && kan('kanSpel') && ritare.kanSpel() && finPekare.matches;

// ---- kameran följer gruppen man arbetar i ----
let nuVy = null;
function markeraTumme(vy) {
  TUMMAR.forEach(t => t.setAttribute('aria-pressed', String(t.getAttribute('data-vy') === vy)));
  if (inneTumme) inneTumme.setAttribute('aria-pressed', String(vy === 'inne'));
  vyKnappar().forEach(b => b.setAttribute('aria-checked', String(b.getAttribute('data-vy-val') === vy)));
  flyttaRing();
}
function aka(vy, opt) {
  if (!ritare) return;
  // en vinkel utifrån tar en ut ur huset först
  if (inneLage) { sattInne(false, undefined, opt).then(() => { nuVy = null; aka(vy, opt); }); return; }
  // från dockskåpet: taket läggs på innan kameran åker
  if (oppetLage) { sattOppen(false); nuVy = null; }
  if (typeof stangProdukt === 'function' && !prodAker) stangProdukt(true);
  if (vy === nuVy) return;
  nuVy = vy;
  if (opt) ritare.vy(vy, opt); else ritare.vy(vy);
  // motorn slutar snurra när kameran åker; knappen följer med
  snurrPa = false; sn.setAttribute('aria-pressed', 'false');
  markeraTumme(vy);
  spara();
}
document.querySelectorAll('.kgrupp[data-kamera]').forEach(g => {
  // inne i huset (eller i dockskåpet) ändrar ett färgval bara färgen, kameran står kvar
  g.addEventListener('toggle', () => { if (g.open && g.dataset.klar && !inneLage && !oppetLage) aka(g.getAttribute('data-kamera')); g.dataset.klar = '1'; });
  // bara med mus: på pekskärm börjar en rullning i panelen också med pointerdown
  // (där flyttar ändringen av färgen kameran i stället, se change nedan)
  // och bara på ett färgprov: text, rubriker och mellanrum flyttar inte kameran
  g.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || !e.target.closest('.kfarg')) return; if (!inneLage && !oppetLage) aka(g.getAttribute('data-kamera')); });
});

// ---- färgprover: ritningens kulör för sig, resten under ----
const GRUPPNAMN = { fasad: 'Fasad', tak: 'Tak', detalj: 'Fönster och plåt' };
function byggProver() {
  const H = MODELLER[val.modell];
  document.querySelectorAll('.kgrupp[data-grupp]').forEach(sek => {
    const g = sek.getAttribute('data-grupp');
    if (!FARGER[g]) return;
    const rit = sek.querySelector('[data-lista="ritning"]'), fler = sek.querySelector('[data-lista="fler"]');
    rit.innerHTML = ''; fler.innerHTML = '';
    let n = 0;
    Object.entries(FARGER[g]).forEach(([id, [namn, hex]]) => {
      const l = document.createElement('label');
      // materialprov (kfarg--fasad: stående panel, --tak: falsad plåt, --detalj: slät lack) och en bock
      l.className = 'kfarg kfarg--' + g;
      l.style.setProperty('--i', n++);
      const ritningens = id === H.farg[g];
      l.innerHTML = '<input type="radio" name="' + g + '" value="' + id + '" aria-label="' + GRUPPNAMN[g] + ': ' + esc(namn) + (ritningens ? ' (ritningens kulör)' : '') + '"><span class="kfarg__prov" style="--f:' + hex + '"><svg class="kfarg__bock" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l3.8 3.8L18 8"/></svg></span><span class="kfarg__namn" aria-hidden="true">' + esc(namn) + '</span>';
      (ritningens ? rit : fler).appendChild(l);
    });
    // rubriken "Fler kulörer" följer med bara när det finns fler
    const etikett = fler.previousElementSibling;
    if (etikett && etikett.classList.contains('kgrupp__etikett')) etikett.hidden = !fler.children.length;
    // "Ritningens kulör" som rekommendation, och en knapp som återställer till den (syns bara
    // när man har valt något annat, se uppdatera)
    const ritEt = rit.previousElementSibling;
    if (ritEt && ritEt.classList.contains('kgrupp__etikett') && !ritEt.querySelector('.kgrupp__rek')) ritEt.insertAdjacentHTML('beforeend', ' <span class="kgrupp__rek">Rekommenderad</span>');
    if (!sek.querySelector('[data-aterstall]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kgrupp__aterstall'; b.setAttribute('data-aterstall', g); b.hidden = true;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>Återställ till ritningens kulör';
      b.addEventListener('click', () => valjKulorer({ [g]: MODELLER[val.modell].farg[g] }));
      rit.after(b);
    }
  });
  byggPaletter();
}
// Byter kulörer (en eller flera grupper) som om man hade valt dem i listorna: motorn tonar huset
// mjukt (tonaFarger), rubrikerna och sammanfattningen följer med
function valjKulorer(v) {
  Object.entries(v).forEach(([g, id]) => {
    if (!FARGER[g] || !FARGER[g][id]) return;
    val[g] = id;
    if (ritare) ritare.satt(g, id);
  });
  uppdatera(); spara(); nyaTummar();
}
// Färdiga kombinationer: bara kulörer som redan finns i FARGER, högst tre, med beskrivande namn
const PALETTER = [
  ['Klassisk falu', { fasad: 'falu', tak: 'svart', detalj: 'vit' }],
  ['Skogsgrön', { fasad: 'mossgron', tak: 'antracit', detalj: 'salvia' }],
  ['Nordiskt ljus', { fasad: 'ljusgra', tak: 'gra', detalj: 'vit' }],
].filter(([, p]) => Object.entries(p).every(([g, id]) => FARGER[g] && FARGER[g][id]));
function byggPaletter() {
  const forsta = document.querySelector('.kgrupp[data-grupp="fasad"]');
  if (!forsta || !PALETTER.length) return;
  let ruta = document.querySelector('[data-paletter]');
  if (!ruta) {
    ruta = document.createElement('div');
    ruta.className = 'kpaletter'; ruta.setAttribute('data-paletter', '');
    ruta.setAttribute('role', 'group'); ruta.setAttribute('aria-label', 'Färdiga kombinationer');
    ruta.innerHTML = '<p class="kgrupp__etikett">Färdiga kombinationer</p><div class="kpaletter__rad">' + PALETTER.map(([namn, p], i) =>
      '<button type="button" class="kpalett" data-palett="' + i + '" aria-pressed="false" style="--i:' + i + '"><span class="kpalett__prov" aria-hidden="true">' +
      ['fasad', 'tak', 'detalj'].map(g => '<i style="--f:' + FARGER[g][p[g]][1] + '"></i>').join('') + '</span><span class="kpalett__namn">' + esc(namn) + '</span></button>').join('') + '</div>';
    ruta.addEventListener('click', e => { const b = e.target.closest('[data-palett]'); if (b) valjKulorer(PALETTER[+b.getAttribute('data-palett')][1]); });
    forsta.before(ruta);
  }
}
document.querySelectorAll('.kgrupp[data-grupp]').forEach(sek => {
  const g = sek.getAttribute('data-grupp');
  if (!FARGER[g]) return;
  sek.addEventListener('change', e => {
    val[g] = e.target.value;
    if (ritare) ritare.satt(g, val[g]);
    if (!inneLage && !oppetLage) aka(sek.getAttribute('data-kamera'));
    uppdatera(); spara(); nyaTummar();
  });
});

// ---- vinkelbilderna ----
// Varje vinkel har två <canvas>: den nya bilden ritas i den dolda (motorn ritar den i
// ett litet hörn av duken och kopierar med drawImage) och tonas sedan in med opacitet.
// En bild per ledig stund (requestIdleCallback), ingen JPEG och ingen avkodning.
let tummeTid = 0, tummeKo = [], senasteTummar = '', tummeVarv = 0;
const ledig = f => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 140));
const valdMiljo = () => { const b = document.querySelector('[data-miljo][aria-checked="true"]'); return b ? b.getAttribute('data-miljo') : 'studio'; };
const TUMME_B = Math.round(240 * Math.min(2, window.devicePixelRatio || 1)), TUMME_H = Math.round(TUMME_B * 9.4 / 16);
function tummeDukar(bild) {
  if (bild._dukar) return bild._dukar;
  const d = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = TUMME_B; c.height = TUMME_H; c.className = 'ktumme__duk'; c.setAttribute('aria-hidden', 'true'); bild.appendChild(c); return c; });
  return (bild._dukar = { d, synlig: -1 });
}
const kanTummar = () => !INB && !FOTO && kan('tummeDuk');
// Medan vinklarna ritas: den valda rutan visar modellens foto ur images/hus3d (bara när
// husets egna kulörer gäller, annars vore det fel hus), de andra en lugn skimrande platta.
// De ritade vinklarna tonas sedan in ovanpå.
let reservModell = '';
function visaReserv() {
  const nyModell = reservModell !== val.modell;
  reservModell = val.modell;
  const egna = !val.fasad && !val.tak && !val.detalj;
  const vald = nuVy && VINKLAR.includes(nuVy) ? nuVy : VINKLAR[0];
  TUMMAR.forEach(k => {
    const t = k.querySelector('.ktumme__bild');
    if (!t) return;
    // förra modellens ritade bilder går undan
    if (nyModell && t._dukar) { t._dukar.d.forEach(c => c.classList.remove('syns')); t._dukar.synlig = -1; }
    if (t._dukar && t._dukar.synlig >= 0) return;
    const foto = egna && k.getAttribute('data-vy') === vald;
    t.style.backgroundImage = foto ? 'url(images/hus3d/' + val.modell + '-600.webp)' : '';
    t.classList.toggle('ktumme__bild--vantar', !foto);
    t.classList.add('har-bild');
  });
}
// Vinkelbilderna ritas en i taget när datorn är ledig, så att inget hackar, och den valda
// vinkeln först. Medan motorn åker eller tonar väntar kön och fortsätter sedan där den var.
function nyaTummar() {
  if (!kanTummar()) return;
  visaReserv();
  const nyckel = [val.modell, aktiv('fasad'), aktiv('tak'), aktiv('detalj'), document.documentElement.getAttribute('data-tema'), valdMiljo(), Math.round(+tid.value)].join('|');
  // samma bilder som redan ritas eller är ritade: kön får gå klart i lugn och ro
  if (nyckel === senasteTummar) return;
  clearTimeout(tummeTid);
  senasteTummar = nyckel;
  const varv = ++tummeVarv;
  const forst = nuVy && VINKLAR.includes(nuVy) ? nuVy : VINKLAR[0];
  tummeKo = [forst, ...VINKLAR.filter(v => v !== forst)];
  function vanta() {
    if (!ritare || varv !== tummeVarv) return;
    if (ritare.upptagen()) { tummeTid = setTimeout(vanta, 300); return; }
    ledig(nasta);
  }
  function nasta() {
    if (varv !== tummeVarv || !tummeKo.length) return;
    if (ritare.upptagen()) { tummeTid = setTimeout(vanta, 300); return; }
    const vy = tummeKo[0];
    const t = document.querySelector('.ktumme[data-vy="' + vy + '"] .ktumme__bild');
    if (!t) { tummeKo.shift(); if (tummeKo.length) ledig(nasta); return; }
    const dd = tummeDukar(t), ny = dd.synlig === 0 ? 1 : 0;
    ritare.tummeDuk(vy, dd.d[ny]).then(ok => {
      if (varv !== tummeVarv) return;
      if (!ok) { tummeTid = setTimeout(vanta, 400); return; }
      tummeKo.shift();
      dd.d[ny].classList.add('syns'); if (dd.synlig >= 0) dd.d[dd.synlig].classList.remove('syns');
      dd.synlig = ny; t.classList.add('har-bild'); t.classList.remove('ktumme__bild--vantar');
      if (tummeKo.length) ledig(nasta);
    });
  }
  tummeTid = setTimeout(vanta, 500);
}
TUMMAR.forEach(t => t.addEventListener('click', () => aka(t.getAttribute('data-vy'), TONA)));

// ringen runt vald vinkel glider till den nya bilden
const tummar = document.querySelector('.kf__tummar');
const ring = document.querySelector('.kf__tummar-ring');
function flyttaRing() {
  if (!ring) return;
  const t = tummar.querySelector('.ktumme[aria-pressed="true"]:not([hidden]) .ktumme__bild');
  if (!t) { ring.classList.remove('syns'); return; }
  const forst = !ring.classList.contains('syns');
  if (forst) ring.style.transition = 'none';
  ring.style.width = t.offsetWidth + 'px';
  ring.style.height = t.offsetHeight + 'px';
  // bildens läge i remsan: knappens läge plus bildens läge i knappen
  const k = t.closest('.ktumme');
  ring.style.transform = 'translate(' + (k.offsetLeft + t.offsetLeft) + 'px,' + (k.offsetTop + t.offsetTop) + 'px)';
  ring.classList.add('syns');
  if (forst) { void ring.offsetWidth; ring.style.transition = ''; }
}
if (ring && 'ResizeObserver' in window) new ResizeObserver(() => { ring.style.transition = 'none'; flyttaRing(); void ring.offsetWidth; ring.style.transition = ''; }).observe(tummar);

// ---- en rad per val, samma i panelen, sammanfattningen och jämförelsen ----
function beskrivning(v) {
  // ett sparat färg-id som inte längre finns blir modellens egen kulör
  const H = MODELLER[v.modell], g = k => (v[k] && FARGER[k][v[k]] ? v[k] : H.farg[k]);
  return { H, f: FARGER.fasad[g('fasad')], t: FARGER.tak[g('tak')], d: FARGER.detalj[g('detalj')] };
}
function fakta(H) { return H.yta + ' m² · ' + nf(H.L) + ' × ' + nf(H.W) + ' m'; }
const rumsyta = H => H.rum.reduce((a, r) => a + r[1], 0);
// rummen som modellsidornas faktaruta säger dem (kupa-30.html, sadel-90.html …)
const RUM_ETIKETT = { 'sadel-30': '1 sovrum + loft', 'sadel-40': '1 sovrum + loft', 'sadel-50': '1 sovrum + loft', 'pulpet-70': '3 sovrum', 'sadel-90': '3 sovrum' };
const rumEtikett = id => RUM_ETIKETT[id] || (MODELLER[id] ? MODELLER[id].rum.filter(r => r[0] === 'Sovrum').length + ' sovrum' : '');
// bara = true: bara kulörerna (sammanfattningen visar hus, storlek och rum för sig)
function rader(v, bara = false) {
  const { H, f, t, d } = beskrivning(v);
  const rad = (dt, dd, hex) => '<div><dt>' + dt + '</dt><dd>' + (hex ? '<i style="--f:' + hex + '"></i>' : '') + esc(dd) + '</dd></div>';
  const kulorer = rad('Fasad', f[0], f[1]) + rad('Tak', t[0], t[1]) + rad('Fönster och plåt', d[0], d[1]);
  if (bara) return kulorer;
  // rummen som på modellsidan ("3 sovrum"), ytan ur ritningen efter
  return rad('Hus', H.namn) + rad('Storlek', fakta(H)) + kulorer +
    rad('Rum', rumEtikett(v.modell) + ' · ' + nf(rumsyta(H).toFixed(1)) + ' m²' + (H.rum.some(r => /loft/i.test(r[0])) ? ' inkl. loft' : ''));
}

// ---- texter, sammanfattning och plan ----
function uppdatera() {
  const H = MODELLER[val.modell];
  document.querySelectorAll('.kgrupp[data-grupp]').forEach(sek => {
    const g = sek.getAttribute('data-grupp');
    if (!FARGER[g]) return;
    const id = aktiv(g);
    const inp = sek.querySelector('input[value="' + id + '"]');
    if (inp) inp.checked = true;
    // rubrikens kulörnamn byter med en kort toning (bara när det ändras)
    const valt = sek.querySelector('[data-valt]'), nytt = FARGER[g][id][0];
    if (valt.textContent !== nytt) {
      const forut = !!valt.textContent;
      valt.textContent = nytt;
      if (forut) { valt.classList.remove('kgrupp__bytt'); void valt.offsetWidth; valt.classList.add('kgrupp__bytt'); }
    }
    const at = sek.querySelector('[data-aterstall]');
    if (at) at.hidden = id === H.farg[g];
  });
  // färdiga kombinationer: den som stämmer med valen är markerad
  document.querySelectorAll('[data-palett]').forEach(b => {
    const p = PALETTER[+b.getAttribute('data-palett')][1];
    b.setAttribute('aria-pressed', String(Object.entries(p).every(([g, id]) => aktiv(g) === id)));
  });
  document.querySelector('[data-valt="modell"]').textContent = H.namn + ' · ' + H.yta + ' m²';
  ritaHusval();
  document.querySelectorAll('[data-namn]').forEach(n => {
    if (n.dataset.namn === H.namn) return;
    n.dataset.namn = H.namn;
    if (n.closest('.kf__namn') && !lugn()) {
      n.removeAttribute('aria-label');
      n.innerHTML = '<span class="sr">' + esc(H.namn) + '</span>' + [...H.namn].map((c, i) => '<span class="bokstav" aria-hidden="true" style="--i:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>').join('');
    } else n.textContent = H.namn;
  });
  const bar = document.querySelector('[data-namn-bar]');
  if (bar) bar.textContent = H.namn;
  raknaUpp(document.querySelector('[data-yta]'), H.yta, 0, ' m²');
  raknaUpp(document.querySelector('[data-k-yta]'), H.yta);
  // samma rumsetikett som modellsidornas faktaruta (H.rum räknar även WC, bastu, hall och loft)
  const kRum = document.querySelector('[data-k-rum]');
  if (kRum) { kRum.textContent = rumEtikett(val.modell); kRum.classList.add('kf__rumtext'); }
  const dec = x => (Number.isInteger(x) ? 0 : 1);
  raknaUpp(document.querySelector('[data-k-l]'), H.L, dec(H.L));
  raknaUpp(document.querySelector('[data-k-w]'), H.W, dec(H.W));
  document.querySelector('[data-summa-lista]').innerHTML = rader(val);
  const { f, t, d } = beskrivning(val);
  const meddelande = 'Från husritaren: ' + H.namn + ' (' + fakta(H) + '). Fasad: ' + f[0] + '. Tak: ' + t[0] + '. Fönster och plåt: ' + d[0] + '.';
  skickaText = meddelande;
  ritaSkicka();
  if (prisKort) prisKort.rita();
  if (!INB && !FOTO) ritaPlan(H);
}

// Skicka förfrågan: det ritade huset och det valda paketet följer med till kontaktsidan.
function ritaSkicka() {
  if (!skickaText) return;
  const m = MODELL_UT[val.modell] || val.modell;
  const text = skickaText + (prisKort ? ' Paket: ' + prisKort.namn() + '.' : '');
  const q = 'modell=' + encodeURIComponent(m) + (prisKort ? '&paket=' + encodeURIComponent(prisKort.paket()) : '') + '&ritat=' + encodeURIComponent(text);
  document.querySelectorAll('[data-skicka]').forEach(a => { a.href = 'kontakt.html?' + q + '#kontaktformular'; });
}

// ---- Planen: flikar, nyckeltal och rum med stapel för andel av ytan ----
const planImg = document.querySelector('[data-planimg]');
const planFlikar = document.querySelector('[data-planflikar]');
let planVisad = '', planFil = '';
function visaPlanbild(fil, namn, H) {
  planFil = fil;
  planImg.classList.remove('syns');
  const ny = new Image();
  ny.onload = () => { if (planFil !== fil) return; planImg.src = ny.src; planImg.alt = namn + ' för ' + H.namn; requestAnimationFrame(() => planImg.classList.add('syns')); };
  ny.src = 'images/plan/' + fil + '.webp';
  planFlikar.querySelectorAll('button').forEach(b => {
    const pa = b.dataset.fil === fil;
    b.setAttribute('aria-selected', String(pa));
    b.tabIndex = pa ? 0 : -1;
  });
}
function ritaPlan(H) {
  if (planVisad === val.modell) return;
  planVisad = val.modell;
  const planer = PLANER[val.modell];
  document.querySelector('[data-namn-plan]').textContent = H.namn;
  const sovrum = H.rum.filter(r => r[0] === 'Sovrum').length;
  document.querySelector('[data-plan-under]').textContent =
    H.rum.length + ' rum' + (sovrum ? ', varav ' + sovrum + ' sovrum' : '') + (planer.length > 1 ? ' · plan och loft' : '');
  // bara tal som kommer ur ritningens data; talen räknar upp när de syns
  const siffra = (dt, tal, dec, enh) => '<div><dt>' + dt + '</dt><dd><b data-tal="' + tal + '" data-dec="' + dec + '">' + nf(tal.toFixed(dec)) + '</b>' + (enh ? '<small>' + enh + '</small>' : '') + '</dd></div>';
  const sif = document.querySelector('[data-plan-siffror]');
  sif.innerHTML = siffra('Byggyta', H.yta, 0, 'm²') +
    '<div><dt>Mått</dt><dd><b>' + nf(H.L) + ' × ' + nf(H.W) + '</b><small>m</small></dd></div>' +
    // rumsytan räknar med loftet och kan då bli större än byggytan: säg det
    siffra(H.rum.some(r => /loft/i.test(r[0])) ? 'Rumsyta inkl. loft' : 'Rumsyta', rumsyta(H), 1, 'm²') +
    '<div><dt>Rum</dt><dd><b class="kf__rumtext">' + esc(rumEtikett(Object.keys(MODELLER).find(k => MODELLER[k] === H) || val.modell)) + '</b></dd></div>';
  const storst = Math.max(...H.rum.map(r => r[1]));
  const rum = document.querySelector('[data-rum]');
  rum.innerHTML = H.rum.map((r, i) =>
    '<li style="--i:' + i + '"><span class="kplan__rumnamn">' + esc(r[0]) + '</span><span class="kplan__yta-tal">' + nf(r[1].toFixed(1)) + ' m²</span>' +
    '<span class="kplan__stapel" aria-hidden="true"><i style="--b:' + (r[1] / storst).toFixed(3) + '"></i></span></li>').join('');
  planFlikar.innerHTML = planer.map(([fil, namn]) => '<button type="button" role="tab" data-fil="' + fil + '" aria-controls="planpanel" aria-selected="false">' + namn + '</button>').join('');
  planFlikar.hidden = planer.length < 2;
  visaPlanbild(planer[0][0], planer[0][1], H);
  if (planSynlig) spelaPlan(); else planVantar = true;
}
// stapler och tal spelas när planen kommer in i bild, inte medan den ligger dold
const planYta = document.querySelector('.kplan__yta');
let planSynlig = false, planVantar = true;
function spelaPlan() {
  planVantar = false;
  const rum = document.querySelector('[data-rum]');
  rum.classList.remove('in'); void rum.offsetWidth; rum.classList.add('in');
  document.querySelectorAll('[data-plan-siffror] [data-tal]').forEach(b => {
    b.dataset.v = 0;
    raknaUpp(b, +b.dataset.tal, +b.dataset.dec);
  });
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(e => {
    planSynlig = e[0].isIntersecting;
    if (planSynlig && planVantar) spelaPlan();
  }, { threshold: 0.25 }).observe(planYta);
} else planSynlig = true;
planFlikar.addEventListener('click', e => {
  const b = e.target.closest('button[data-fil]');
  if (b) visaPlanbild(b.dataset.fil, b.textContent, MODELLER[val.modell]);
});
// pilarna byter flik, som i en vanlig flikrad
planFlikar.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const knappar = [...planFlikar.querySelectorAll('button')];
  const i = knappar.indexOf(document.activeElement);
  if (i < 0) return;
  const n = knappar[(i + (e.key === 'ArrowRight' ? 1 : -1) + knappar.length) % knappar.length];
  n.focus(); n.click(); e.preventDefault();
});
const planDialog = document.querySelector('[data-plan-dialog]');
function forstoraPlan() {
  if (!planImg.src) return;
  const stor = document.querySelector('[data-plan-stor]');
  stor.src = planImg.src; stor.alt = planImg.alt;
  planDialog.showModal();
}
document.querySelector('[data-forstora]').addEventListener('click', forstoraPlan);
// husraderna: planknappen visar husets plan i stort utan att byta hus
document.querySelectorAll('[data-visa-plan]').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  const id = b.getAttribute('data-visa-plan'), H = MODELLER[id];
  if (!H || !PLANER[id]) return;
  const stor = document.querySelector('[data-plan-stor]');
  stor.src = 'images/plan/' + PLANER[id][0][0] + '.webp'; stor.alt = 'Plan för ' + H.namn;
  planDialog.showModal();
}));
document.querySelector('[data-planbild]').addEventListener('click', forstoraPlan);

// talet räknar mjukt upp eller ner till det nya värdet
function raknaUpp(el, till, dec = 0, efter = '') {
  if (!el) return;
  const fran = parseFloat(el.dataset.v != null ? el.dataset.v : till);
  el.dataset.v = till;
  const skriv = v => { el.textContent = nf(v.toFixed(dec)) + efter; };
  if (fran === till || lugn()) { skriv(till); return; }
  const t0 = performance.now(), nr = el._rakna = (el._rakna || 0) + 1;
  (function steg(t) {
    if (el._rakna !== nr) return;
    const k = Math.min(1, (t - t0) / 450), e = 1 - (1 - k) ** 3;
    skriv(fran + (till - fran) * e);
    if (k < 1) requestAnimationFrame(steg);
  })(t0);
  // en flik i bakgrunden ritar inga rutor: talet ska ändå bli rätt (inte stanna på förra husets)
  setTimeout(() => { if (el._rakna === nr) skriv(till); }, 600);
}

function bytModell(id) {
  val.modell = id; val.fasad = val.tak = val.detalj = null;
  byggProver(); uppdatera(); spara();
  if (ritare) {
    if (oppetLage) sattOppen(false, true);
    const ut = inneLage ? sattInne(false) : Promise.resolve();
    // först får klicket synas (markeringen flyttar sig, siffrorna byts), sedan byggs huset:
    // bygget tar en stund och låste annars sidan innan något hade hunnit ritas
    ut.then(() => new Promise(efterRuta)).then(() => {
      if (val.modell !== id) return;   // ett nytt val hann före
      // ingen toning här: motorn sänker det gamla huset själv, och båda samtidigt
      // visade det gamla huset dubbelt (stående och sjunkande)
      // (kulörerna är husets egna, eller de som ett sparat hus just har satt i val)
      ['fasad', 'tak', 'detalj'].forEach(g => ritare.satt(g, val[g]));
      ritare.visa(id);
      nuVy = null; aka('modell');
      nyaTummar();
    });
  }
}
document.querySelectorAll('input[name="modell"]').forEach(r => r.addEventListener('change', () => bytModell(r.value)));

// ---- Husvalet i panelen: ett fält glider bakom det valda huset, och ihopfälld visar
// rubriken husets ritning. Raderna glider in efter varandra när listan fälls ut. ----
const husLista = document.querySelector('.kmodeller');
const husFalt = husLista && husLista.querySelector('.kmodeller__falt');
const husMini = document.querySelector('[data-valt-mini]');
function flyttaFalt(direkt) {
  if (!husFalt) return;
  const rad = husLista.querySelector('input[name="modell"]:checked');
  const kort = rad && rad.closest('.kmodell');
  if (!kort || !kort.offsetHeight) { husFalt.classList.remove('syns'); return; }
  const forst = direkt || !husFalt.classList.contains('syns');
  if (forst) husFalt.style.transition = 'none';
  husFalt.style.height = kort.offsetHeight + 'px';
  husFalt.style.transform = 'translateY(' + kort.offsetTop + 'px)';
  husFalt.classList.add('syns');
  if (forst) { void husFalt.offsetWidth; husFalt.style.transition = ''; }
}
function ritaHusval() {
  if (!husLista) return;
  husLista.querySelectorAll('.kmodell').forEach(k => k.classList.toggle('kmodell--vald', !!k.querySelector('input:checked')));
  const rit = husLista.querySelector('input[name="modell"]:checked ~ .kmodell__kort .kmodell__ritning, .kmodell--vald .kmodell__ritning');
  if (husMini && rit && husMini.dataset.modell !== val.modell) { husMini.dataset.modell = val.modell; husMini.innerHTML = rit.outerHTML; }
  flyttaFalt();
}
if (husLista) {
  const grupp = husLista.closest('.kgrupp');
  grupp.addEventListener('toggle', () => {
    if (!grupp.open) return;
    flyttaFalt(true);
    if (lugn()) return;
    husLista.classList.remove('kmodeller--in'); void husLista.offsetWidth; husLista.classList.add('kmodeller--in');
  });
  husLista.addEventListener('animationend', e => { if (e.target.classList.contains('kmodell') && e.target === husLista.lastElementChild) husLista.classList.remove('kmodeller--in'); });
  if ('ResizeObserver' in window) new ResizeObserver(() => flyttaFalt(true)).observe(husLista);
}

// ---- verktygsraden ----
document.querySelector('[data-byt]').addEventListener('click', e => {
  e.preventDefault();
  const g = document.getElementById('kgrupp-modell');
  g.open = true; g.scrollIntoView({ behavior: lugn() ? 'auto' : 'smooth', block: 'start' });
  aka('modell');
});
// Börja om: färger, ljus, miljö, mått, våning, inne, öppet tak och kameran tillbaka till
// början (huset står kvar). aka tar en ut ur huset eller lägger på taket först.
// en kort bekräftelse på knappen: ikonen byts mot en bock som ritas in
function klarKnapp(k, ms) {
  k.classList.remove('kf__lank--klar'); void k.offsetWidth; k.classList.add('kf__lank--klar');
  clearTimeout(k._klar); k._klar = setTimeout(() => k.classList.remove('kf__lank--klar'), ms);
}
// Börja om frågar först när något är ändrat: första trycket blir "Säker?", andra gör det
const aterKnapp = document.querySelector('[data-aterstall]');
const andrat = () => !!(val.fasad || val.tak || val.detalj || Math.abs(+tid.value - STANDARD_TID) > 0.01 || valdMiljo() !== 'studio' ||
  mk.getAttribute('aria-pressed') === 'true' || inneLage || oppetLage);
function fragaAter(pa) {
  const span = aterKnapp.querySelector('span');
  clearTimeout(aterKnapp._fraga);
  aterKnapp.classList.toggle('kf__lank--fraga', pa);
  span.textContent = pa ? 'Säker?' : 'Börja om';
  if (pa) aterKnapp.setAttribute('aria-label', 'Säker? Tryck igen för att börja om'); else aterKnapp.removeAttribute('aria-label');
  if (pa) aterKnapp._fraga = setTimeout(() => fragaAter(false), 3000);
}
aterKnapp.addEventListener('blur', () => { if (aterKnapp.classList.contains('kf__lank--fraga')) fragaAter(false); });
aterKnapp.addEventListener('click', e => {
  if (!aterKnapp.classList.contains('kf__lank--fraga') && andrat()) { e.stopImmediatePropagation(); fragaAter(true); return; }
  fragaAter(false); klarKnapp(aterKnapp, 1200);
}, true);
aterKnapp.addEventListener('click', () => {
  val.fasad = val.tak = val.detalj = null;
  if (ritare) ['fasad', 'tak', 'detalj'].forEach(g => ritare.satt(g, null));
  if (mk.getAttribute('aria-pressed') === 'true') mk.click();
  if (Math.abs(+tid.value - STANDARD_TID) > 0.01) { kvFore = STANDARD_TID; glidTid(STANDARD_TID); }
  if (valdMiljo() !== 'studio') valjMiljo('studio');
  lagerVal = 'hela'; ritaLager();
  nuVy = null; aka('runt', TONA);
  visaLiv();
  uppdatera(); spara(); nyaTummar();
});
// Kopiera länk: dela-menyn på pekskärm, annars urklipp; går inget av dem visas adressen
// markerad i ett litet fält, så att man kan kopiera den själv
const dela = document.querySelector('[data-dela]');
let adressRuta = null;
function visaAdress() {
  if (!adressRuta) {
    adressRuta = document.createElement('div');
    adressRuta.className = 'kf__adress';
    adressRuta.innerHTML = '<input type="text" readonly aria-label="Länken till ditt hus">';
    dela.closest('.kf__lankar').appendChild(adressRuta);
    const f = adressRuta.firstChild;
    f.addEventListener('blur', () => { adressRuta.classList.remove('syns'); });
    f.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); f.blur(); dela.focus(); } });
  }
  const f = adressRuta.firstChild;
  f.value = location.href;
  adressRuta.classList.add('syns');
  f.focus({ preventScroll: true }); f.select();
}
dela.addEventListener('click', async () => {
  const span = dela.querySelector('span'), text = span.dataset.text || (span.dataset.text = span.textContent);
  if (matchMedia('(pointer: coarse)').matches && navigator.share) {
    try { await navigator.share({ title: document.title, url: location.href }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(location.href); span.textContent = 'Kopierad'; klarKnapp(dela, 2000); clearTimeout(span._tid); span._tid = setTimeout(() => { span.textContent = text; }, 2000); }
  catch (e) { visaAdress(); }
});

// ---- verktygen i scenen ----
// standardläget: sen eftermiddag (17:00) – varmt, lågt sidoljus med långa mjuka skuggor, klarblå himmel
const STANDARD_TID = 17;
const tid = document.getElementById('rit-tid');
const ut = document.querySelector('[data-tid]');
function visaTid(v) {
  visaTidUt(v);
  if (ritare) ritare.satt('tid', v);
}
// bara reglaget och klockan (motorn har redan tiden)
function visaTidUt(v) {
  const h = Math.floor(v), m = Math.round((v - h) * 60) % 60;
  ut.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  tid.setAttribute('aria-valuetext', ut.textContent);
  tid.style.setProperty('--p', ((v - 6) / 16 * 100).toFixed(1) + '%');
  markeraLjus(v);
  radTid(v);
}
// Verktygsraden: solen vrider sig med tiden, tummen lyser i dygnets färg och bubblan ovanför
// tummen visar klockslaget (och snabbvalets namn när tiden står på ett)
const TID_FARG = [[6, [246, 176, 150]], [9, [248, 214, 160]], [13, [255, 246, 220]], [17, [250, 210, 140]], [19.2, [244, 160, 78]], [21, [196, 126, 160]], [22, [128, 118, 196]]];
const LJUS_NAMN = { morgon: 'Morgon', dag: 'Dag', gyllene: 'Gyllene timmen', kvall: 'Kväll' };
function radTid(v) {
  const sol = tid.closest('.kf__sol');
  if (!sol || !isFinite(v)) return;
  sol.style.setProperty('--sol-vrid', ((v - 6) / 16 * 180).toFixed(1) + 'deg');
  let i = 1;
  while (i < TID_FARG.length - 1 && v > TID_FARG[i][0]) i++;
  const [t0, a] = TID_FARG[i - 1], [t1, b] = TID_FARG[i], k = Math.min(1, Math.max(0, (v - t0) / (t1 - t0)));
  sol.style.setProperty('--tidfarg', 'rgb(' + a.map((x, j) => Math.round(x + (b[j] - x) * k)).join(',') + ')');
  let bubbla = sol.querySelector('.kf__tidbubbla');
  if (!bubbla) { bubbla = document.createElement('span'); bubbla.className = 'kf__tidbubbla'; bubbla.setAttribute('aria-hidden', 'true'); sol.appendChild(bubbla); }
  let id = '';
  try { id = Object.keys(LJUS_TID).find(n => Math.abs(LJUS_TID[n] - v) < 0.13) || ''; } catch (e) { id = ''; }
  bubbla.textContent = id ? LJUS_NAMN[id] + ' · ' + ut.textContent : ut.textContent;
  // tummen är 18 px: mitten går från 9 px till bredden minus 9 px
  const w = tid.offsetWidth;
  if (!w) return;
  const x = tid.offsetLeft + 9 + (v - 6) / 16 * (w - 18);
  // bubblan stannar inom scenen (8 px marginal); pilen pekar ändå på tummen
  let fx = x;
  if (sol.classList.contains('kf__sol--drar')) {
    const bw = bubbla.offsetWidth / 2, sr = scen.getBoundingClientRect(), so = sol.getBoundingClientRect().left;
    fx = Math.min(sr.right - so - bw - 8, Math.max(sr.left - so + bw + 8, x));
  }
  sol.style.setProperty('--tid-x', fx.toFixed(1) + 'px');
  sol.style.setProperty('--pil-x', (x - fx).toFixed(1) + 'px');
}
// Ljuset glider till en ny tid på 1,2 s (Börja om, Mina hus, snabbval utan motorstöd)
const kvKnapp = document.querySelector('[data-kvall]');
let kvFore = STANDARD_TID, kvAnim = 0;
const synkaKvall = () => { if (kvKnapp) kvKnapp.setAttribute('aria-pressed', String(+tid.value >= 20)); };
function glidTid(till) {
  cancelAnimationFrame(kvAnim); ljusKor = 0;
  const fran = +tid.value, t0 = performance.now(), T = lugn() ? 0 : 1200;
  const steg = nu => {
    const k = T ? Math.min(1, Math.max(0, (nu - t0) / T)) : 1, e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    const v = fran + (till - fran) * e;
    tid.value = String(v); visaTid(k < 1 ? v : till);
    if (k < 1) kvAnim = requestAnimationFrame(steg);
    else { kvAnim = 0; tid.value = String(till); spara(); nyaTummar(); }
  };
  kvAnim = requestAnimationFrame(steg);
}
if (kvKnapp) kvKnapp.addEventListener('click', () => {
  const pa = kvKnapp.getAttribute('aria-pressed') !== 'true';
  kvKnapp.setAttribute('aria-pressed', String(pa));
  // månen är samma sak som snabbvalet Kväll; av går tillbaka till tiden innan
  if (pa) { if (+tid.value < 20) kvFore = +tid.value; valjLjus('kvall'); } else glidTid(kvFore < 20 ? kvFore : STANDARD_TID);
});
tid.addEventListener('input', () => { cancelAnimationFrame(kvAnim); kvAnim = 0; ljusKor = 0; visaTid(+tid.value); synkaKvall(); });
// reglaget har step="any" (snabbvalens 19:12 hamnar rätt); pilarna stegar ändå en kvart
tid.addEventListener('keydown', e => {
  const d = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  tid.value = String(Math.min(22, Math.max(6, Math.round((+tid.value + d) * 4) / 4)));
  tid.dispatchEvent(new Event('input')); tid.dispatchEvent(new Event('change'));
});

// ---- ljusets snabbval: Morgon, Dag, Gyllene timmen, Kväll (popupen vid solen) ----
// motorn glider (ritare.ljusPreset) och skickar varje steg till vidTid; utan den glider sidan
const ljusPopup = document.getElementById('kf-ljus');
const ljusKnapp = document.querySelector('[data-ljus-knapp]');
const ljusKnappar = () => (ljusPopup ? [...ljusPopup.querySelectorAll('[data-ljus]')] : []);
const LJUS_TID = { morgon: 7.5, dag: 13, gyllene: 19.2, kvall: 21.5 };
try { if (kan('ljusPresets')) Object.assign(LJUS_TID, ritare.ljusPresets()); } catch (e) { /* sidans tider gäller */ }
let ljusKor = 0, ljusNr = 0;
function markeraLjus(v) {
  const id = Object.keys(LJUS_TID).find(k => Math.abs(LJUS_TID[k] - v) < 0.13) || '';
  ljusKnappar().forEach(b => b.setAttribute('aria-checked', String(b.getAttribute('data-ljus') === id)));
  if (ljusKnapp) ljusKnapp.classList.toggle('kf__ljusknapp--val', !!id);
}
function foljTid(t) {
  // drar man själv i reglaget under glidningen gäller reglaget
  if (!ljusKor || !isFinite(t)) return;
  tid.value = String(t); visaTidUt(t); synkaKvall();
}
function valjLjus(id) {
  const till = LJUS_TID[id];
  if (till == null) return;
  if (id === 'kvall' && kvKnapp) { if (+tid.value < 20) kvFore = +tid.value; }
  if (!kan('ljusPreset')) { glidTid(till); return; }
  cancelAnimationFrame(kvAnim); kvAnim = 0;
  const nr = ljusKor = ++ljusNr;
  let svar;
  try { svar = ritare.ljusPreset(id); } catch (e) { console.warn(e); glidTid(till); return; }
  Promise.resolve(svar).then(t => {
    if (ljusKor !== nr) { if (ritare) ritare.satt('tid', +tid.value); return; }
    ljusKor = 0;
    const v = typeof t === 'number' ? t : till;
    tid.value = String(v); visaTidUt(v); synkaKvall();
    spara(); nyaTummar();
  }, e => { console.warn(e); ljusKor = 0; });
}
tid.addEventListener('change', () => { spara(); nyaTummar(); });
const mk = document.querySelector('[data-matt-knapp]');
mk.addEventListener('click', () => {
  const p = mk.getAttribute('aria-pressed') !== 'true';
  mk.setAttribute('aria-pressed', String(p));
  if (ritare) ritare.satt('matt', p);
  spara();
});
const sn = document.querySelector('[data-snurra]');
// motorn snurrar inte med minskad rörelse eller i fotoläget
sn.setAttribute('aria-pressed', String(!!ritare && !FOTO && !lugn()));
sn.addEventListener('click', () => { if (ritare) { snurrPa = !!ritare.snurra(sn.getAttribute('aria-pressed') !== 'true'); sn.setAttribute('aria-pressed', String(snurrPa)); } });
duk.addEventListener('pointerdown', () => { snurrPa = false; sn.setAttribute('aria-pressed', 'false'); });
// motorn slutar snurra efter 7 s om man inte själv slagit på det (snurra() stoppar
// motorns timer); knappen följer samma regel
let snurrPa = false;
setTimeout(() => { if (!snurrPa) sn.setAttribute('aria-pressed', 'false'); }, 7000);
// Liv: vind i träden, moln och fåglar. Syns bara när miljön har liv.
const livKnapp = document.querySelector('[data-liv]');
function visaLiv() {
  if (!livKnapp) return;
  let har = false;
  try { har = kan('harLiv') && kan('liv') && !!ritare.harLiv(); } catch (e) { har = false; }
  livKnapp.hidden = !har;
  if (har) livKnapp.setAttribute('aria-pressed', String(!!ritare.liv()));
}
if (livKnapp) livKnapp.addEventListener('click', () => {
  if (kan('liv')) livKnapp.setAttribute('aria-pressed', String(!!ritare.liv(livKnapp.getAttribute('aria-pressed') !== 'true')));
});
const hk = document.querySelector('[data-helskarm]');
// Helskärm: riktig helskärm där elementet stöder det, annars (iPhone Safari) fyller scenen
// skärmen med en egen layout (html.ritare-fyll: scenen position fixed, resten av sidan dold)
const kanHel = !!scen.requestFullscreen && document.fullscreenEnabled !== false;
let fyllLage = null;   // null, 'knapp' eller 'auto' (liggande telefon)
function fyll(pa, hur) {
  pa = !!pa;
  if (pa === !!fyllLage) { if (pa && hur === 'knapp') fyllLage = 'knapp'; return; }
  fyllLage = pa ? hur || 'knapp' : null;
  // en platshållare av scenens storlek står kvar på sidan, så att sidan inte hoppar ihop
  // under den (och glidningen ut vet vart bilden ska landa)
  if (pa) {
    helScrollY = scrollY;
    if (!helPlats) { helPlats = document.createElement('div'); helPlats.className = 'kf__hel-plats'; helPlats.setAttribute('aria-hidden', 'true'); }
    const r = scen.getBoundingClientRect();
    helPlats.style.height = r.height + 'px';
    helPlats.style.borderRadius = getComputedStyle(scen).borderTopLeftRadius;
    scen.before(helPlats);
    helRadSynk();
    // scenens förälder (sticky på dator) är en egen stapel: lyft hela den över sidan, panelen
    // och sidhuvudet (bakgrunden ligger i samma stapel, under scenen)
    const v = scen.parentElement;
    if (getComputedStyle(v).position === 'static') v.style.position = 'relative';
    v.style.zIndex = '2147483000';
    if (helBakgrund && helBakgrund.parentElement !== v) v.insertBefore(helBakgrund, v.firstChild);
  } else {
    if (helPlats) helPlats.remove();
    const v = scen.parentElement;
    v.style.position = ''; v.style.zIndex = '';
    try { if (Math.abs(scrollY - helScrollY) > 1) window.scrollTo(0, helScrollY); } catch (e) { /* äldre webbläsare */ }
  }
  document.documentElement.classList.toggle('ritare-fyll', pa);
  if (pa && hur === 'auto') scen.scrollIntoView({ block: 'center' });
  if (!pa) helVila(false);
  hk.setAttribute('aria-pressed', String(pa || !!document.fullscreenElement));
  hk.querySelector('span').textContent = pa ? 'Lämna helskärm' : 'Helskärm';
  hk.setAttribute('data-tips', pa ? 'Lämna helskärm' : 'Helskärm');
}
// Mjukt byte in i och ut ur helskärm: en mörk slöja i scenen tonar upp (160 ms), bytet sker
// bakom den, sedan tonar slöjan bort medan bilden glider fram från lätt förminskad (420 ms).
// Själva helskärmsbytet är webbläsarens och går inte att animera; slöjan döljer hoppet.
const lugnRorelse = matchMedia('(prefers-reduced-motion: reduce)');
let helSloja = null, helBytes = false;
function helFram() {
  if (lugnRorelse.matches) return;
  scen.classList.remove('kf__scen--hel-in'); void scen.offsetWidth;   // starta om animationen
  scen.classList.add('kf__scen--hel-in');
  setTimeout(() => scen.classList.remove("kf__scen--hel-in"), 760);
}
function mjuktByte(gor) {
  if (lugnRorelse.matches || helBytes) { gor(); return; }
  if (!helSloja) { helSloja = document.createElement('div'); helSloja.className = 'kf__hel-sloja'; helSloja.setAttribute('aria-hidden', 'true'); scen.appendChild(helSloja); }
  helBytes = true;
  helSloja.classList.add('kf__hel-sloja--pa');
  // Slöjan står kvar tills scenen har bytt storlek och ritats några gånger i den nya storleken
  // (första rutorna efter en storleksändring är tunga – det var där det hackade), sedan tonas
  // den lugnt bort. Högst 900 ms även om ingen storleksändring kommer.
  setTimeout(() => {
    let klar = false, ro = null;
    const slapp = () => {
      if (klar) return; klar = true;
      if (ro) ro.disconnect();
      let n = 0;
      const ruta = () => { if (++n < 4) { requestAnimationFrame(ruta); return; }
        helSloja.classList.remove('kf__hel-sloja--pa');
        helFram();
        setTimeout(() => { helBytes = false; }, 300);
      };
      requestAnimationFrame(ruta);
    };
    // scenens egen storlek (fyll-layouten ändrar inte fönstret, bara scenen); första mätningen
    // är nuvarande storlek och räknas inte
    let forsta = true;
    try { ro = new ResizeObserver(() => { if (forsta) { forsta = false; return; } setTimeout(slapp, 60); }); ro.observe(scen); } catch (e) { /* äldre webbläsare */ }
    setTimeout(slapp, 380);
    gor();
  }, 240);
}
// Helskärm – visningsvyn. Bilden växer ut från sin plats på sidan till hela fönstret (och
// tillbaka) som ett klipp (clip-path) som öppnas, över en ljus bakgrund. Duken har sin slutliga
// storlek från första rutan, och motorn (ritare.helStart) komponerar bilden för rutan som syns
// i varje bildruta: i början exakt bilden från sidan, i slutet den nya utsikten där hela huset
// ryms mellan kontrollerna. Klipp, bakgrund och kamera räknas i samma bildruta, så inget glider
// isär. Kontrollerna är svävande glasöar som tonar in i kaskad när bilden nästan har landat.
// Knappen använder den här fyll-layouten i alla webbläsare (webbläsarens egen helskärm går inte
// att animera – den hoppar alltid – och finns inte i iPhone Safari).
let helBakgrund = null, helRor = false, helPlats = null, helRad = null;
// mjuka kurvor (kubisk bezier, som i CSS): ut ur vila utan ryck, lång mjuk landning
function bezier(x1, y1, x2, y2) {
  const kx = t => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const ky = t => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  const dx = t => 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (kx(t) - x) / d; t = Math.min(1, Math.max(0, t)); }
    return ky(t);
  };
}
const helKurvaIn = bezier(0.42, 0, 0.12, 1), helKurvaUt = bezier(0.45, 0, 0.18, 1);
const HEL_IN = 760, HEL_UT = 640, HEL_RADIE = 20;
// överraden i helskärm: husets namn och yta till vänster, Stäng till höger
function helRadSynk() {
  if (!helRad) {
    helRad = document.createElement('div');
    helRad.className = 'kf__helrad';
    helRad.innerHTML = '<p class="kf__helnamn"><b></b><small></small></p>'
      + '<button type="button" class="kf__helstang" aria-label="Stäng helskärm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg><span>Stäng</span></button>';
    helRad.querySelector('.kf__helstang').addEventListener('click', () => helskarm(false));
    scen.appendChild(helRad);
  }
  const namn = document.querySelector('#kf-namn [data-namn]') || document.querySelector('[data-namn]'), yta = document.querySelector('[data-yta]');
  helRad.querySelector('b').textContent = namn ? (namn.getAttribute('data-namn') || namn.querySelector('.sr')?.textContent || namn.textContent).trim() : '';
  helRad.querySelector('small').textContent = yta ? yta.textContent.trim() : '';
}
// kontrollerna i scenen (det som syns)
const helUI = () => [...scen.querySelectorAll(':scope > .kf__helrad, :scope > .kf__rum, :scope > .kf__verktyg, :scope > .kf__spak, :scope > .kf__kartknapp, :scope > .kf__karta, :scope > .kf__lager')]
  .filter(e => !e.hidden && e.offsetParent !== null && getComputedStyle(e).display !== 'none');
const helUIAnim = new Map();
// tona kontrollerna (bara opacity och transform, Web Animations: överst i stacken, även över
// radens egna CSS-animationer). pa = in; sedan släpps animationen och CSS gäller igen.
function helUITona(pa, tid = 420, forsk = 0, fordrojning = 0, lista = helUI()) {
  lista.forEach((e, i) => {
    const gammal = helUIAnim.get(e);
    const fran = gammal ? +getComputedStyle(e).opacity : pa ? 0 : 1;
    if (gammal) gammal.cancel();
    const dy = e.matches('.kf__helrad, .kf__rum') ? -10 : 10;
    const a = e.animate(pa
      ? [{ opacity: fran, transform: `translateY(${(dy * (1 - fran)).toFixed(1)}px) scale(${(1 - 0.015 * (1 - fran)).toFixed(4)})` }, { opacity: 1, transform: 'none' }]
      : [{ opacity: fran, transform: 'none' }, { opacity: 0, transform: `translateY(${dy * 0.5}px) scale(0.99)` }],
      { duration: lugnRorelse.matches ? 1 : tid, delay: lugnRorelse.matches ? 0 : fordrojning + i * forsk, easing: pa ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)', fill: 'both' });
    helUIAnim.set(e, a);
    if (pa) a.onfinish = () => { if (helUIAnim.get(e) === a) { a.cancel(); helUIAnim.delete(e); } };
  });
}
function helUISlapp() { helUIAnim.forEach(a => a.cancel()); helUIAnim.clear(); }
// kontrollernas ytor i helskärm, som marginaler för kameran (px från kanterna, med luft)
function helMarginaler() {
  const B = scen.getBoundingClientRect(), m = { t: 0, b: 0, l: 0, r: 0 };
  if (!B.width) return m;
  scen.querySelectorAll(':scope > .kf__helrad > *, :scope > .kf__rum > div, :scope > .kf__verktyg').forEach(e => {
    if (e.offsetParent === null) return;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.top + r.height / 2 < B.top + B.height / 2) m.t = Math.max(m.t, r.bottom - B.top + 10);
    else m.b = Math.max(m.b, B.bottom - r.top + 10);
  });
  m.l = m.r = Math.min(24, B.width * 0.04);
  return m;
}
function glidHel(pa) {
  // ett tryck mitt i en glidning sparas och görs när bilden har landat (inget avbrott, inget hack)
  if (helRor) { helOnskan = pa === helMalLage ? null : pa; return; }
  helOnskan = null;
  if (pa && fyllLage === 'auto') { fyll(true, 'knapp'); return; }   // liggande telefon: redan fylld
  if (pa === !!fyllLage) return;
  if (!helBakgrund) { helBakgrund = document.createElement('div'); helBakgrund.className = 'kf__hel-bakgrund'; helBakgrund.setAttribute('aria-hidden', 'true'); }
  if (helBakgrund.parentElement !== scen.parentElement) scen.parentElement.insertBefore(helBakgrund, scen.parentElement.firstChild);
  const html = document.documentElement;
  // minskad rörelse (eller äldre motor): direkt byte, ny utsikt utan glid
  if (lugnRorelse.matches || !kan('helStart')) {
    fyll(pa, 'knapp');
    try { ritare.helStart({ direkt: true, inUt: pa, marg: pa ? helMarginaler() : null }); } catch (e) { /* äldre motor */ }
    if (pa) helVila(true);
    return;
  }
  helRor = true; helMalLage = pa;
  html.classList.add('ritare-glid');
  if (pa) {
    const A = scen.getBoundingClientRect();
    fyll(true, 'knapp');
    const B = scen.getBoundingClientRect();
    if (!A.width || !B.width) { html.classList.remove('ritare-glid'); helRor = false; return; }
    const marg = helMarginaler();
    helFormat = B.width / B.height;
    // kontrollerna osynliga tills bilden nästan har landat
    const ui = helUI();
    helUITona(false, 1, 0, 0, ui);
    let uiIn = false;
    helBakgrund.style.opacity = '0';
    helVakt = setTimeout(() => { if (helRor) helStad(true); }, HEL_IN + 1500);
    ritare.helStart({
      inUt: true, tid: HEL_IN, kurva: helKurvaIn, marg,
      fran: { x: A.left - B.left, y: A.top - B.top, w: A.width, h: A.height },
      till: { x: 0, y: 0, w: B.width, h: B.height },
      vidRuta(R, e, k) {
        scen.style.clipPath = `inset(${R.y.toFixed(2)}px ${(B.width - R.x - R.w).toFixed(2)}px ${(B.height - R.y - R.h).toFixed(2)}px ${R.x.toFixed(2)}px round ${(HEL_RADIE * (1 - e)).toFixed(2)}px)`;
        helBakgrund.style.opacity = Math.min(1, e * 1.6).toFixed(3);
        if (!uiIn && k >= 0.5) { uiIn = true; helUITona(true, 460, 55, 0, ui); }
      },
      klar() {
        scen.style.clipPath = '';
        helBakgrund.style.opacity = '';
        html.classList.remove('ritare-glid');
        if (!uiIn) helUITona(true, 460, 55, 0, ui);
        clearTimeout(helVakt);
        helRor = false;
        helVila(true);
        helNasta();
      },
    });
  } else {
    if (!helPlats || !helPlats.isConnected) { helStad(false); return; }
    // sidan står där den stod före helskärm (platshållaren mäts i samma läge)
    try { if (Math.abs(scrollY - helScrollY) > 1) window.scrollTo(0, helScrollY); } catch (e) { /* äldre webbläsare */ }
    const B = scen.getBoundingClientRect(), T = helPlats.getBoundingClientRect();
    helVakt = setTimeout(() => { if (helRor) helStad(false); }, HEL_UT + 1500);
    helVila(false);
    helUITona(false, 200);
    helBakgrund.style.opacity = '1';
    ritare.helStart({
      inUt: false, tid: HEL_UT, kurva: helKurvaUt, marg: null,
      fran: { x: 0, y: 0, w: B.width, h: B.height },
      till: { x: T.left - B.left, y: T.top - B.top, w: T.width, h: T.height },
      vidRuta(R, e) {
        scen.style.clipPath = `inset(${R.y.toFixed(2)}px ${(B.width - R.x - R.w).toFixed(2)}px ${(B.height - R.y - R.h).toFixed(2)}px ${R.x.toFixed(2)}px round ${(HEL_RADIE * e).toFixed(2)}px)`;
        helBakgrund.style.opacity = Math.max(0, 1 - e * 1.25).toFixed(3);
      },
      klar() {
        // bilden har landat på sin plats: tillbaka in i sidan (motorn byter buffert direkt efter)
        helStad(false, true);
      },
    });
  }
}
// Städningen när en övergång är klar eller avbryts (×, Esc, knappen, vriden telefon, vakten):
// allt som helskärmen ändrat återställs. Tål att anropas flera gånger. iHel = läget ska bli helskärm.
// franMotorn: anropet kommer från motorns egen avslutning (då ska motorn inte avbrytas igen).
let helVakt = 0, helScrollY = 0, helOnskan = null, helMalLage = false;
// sparat tryck under glidningen: görs nu (efter att den förra bilden ritats färdigt)
function helNasta() {
  const o = helOnskan; helOnskan = null;
  if (o !== null && o !== !!fyllLage) requestAnimationFrame(() => glidHel(o));
}
function helStad(iHel, franMotorn) {
  clearTimeout(helVakt);
  const html = document.documentElement;
  if (!franMotorn && kan('helAvbryt')) { try { if (ritare.helPagar()) ritare.helAvbryt(); } catch (e) { /* äldre motor */ } }
  if (!iHel && fyllLage) fyll(false);
  scen.style.clipPath = ''; scen.style.transform = '';
  if (helBakgrund) helBakgrund.style.opacity = '';
  html.classList.remove('ritare-glid');
  helUISlapp();
  helRor = false;
  if (iHel) { helVila(true); helNasta(); return; }
  clearTimeout(helVilaTid); clearTimeout(helStorlekTid); helVilar = false;
  html.classList.remove('ritare-vila');
  if (helPlats) helPlats.remove();
  const v = scen.parentElement; v.style.position = ''; v.style.zIndex = '';
  if (!franMotorn) { try { ritare.fryStorlek(false); } catch (e) { /* äldre motor */ } }
  helGlitter();
  helNasta();
}
// kontrollerna vilar (tonar bort) när man inte rört mus, finger eller tangent på en stund
let helVilaTid = 0, helVilar = false;
function helVilaKan() {
  if (!fyllLage || helRor) return false;
  if (scen.querySelector('.kf__popup:not([hidden]), .kf__karta--oppen, .kf__spak--drar, [aria-expanded="true"]')) return false;
  if (scen.querySelector(':scope > :is(.kf__helrad, .kf__verktyg, .kf__rum, .kf__karta, .kf__lager):hover')) return false;
  const a = document.activeElement;
  if (a && a !== document.body && scen.contains(a) && !a.matches('canvas') && a.matches(':focus-visible')) return false;
  return true;
}
function helVila(vaken) {
  clearTimeout(helVilaTid);
  if (helVilar) { helVilar = false; document.documentElement.classList.remove('ritare-vila'); if (fyllLage && !helRor) helUITona(true, 280); }
  if (vaken && fyllLage) helVilaTid = setTimeout(() => {
    if (!helVilaKan()) { helVila(true); return; }
    helVilar = true;
    document.documentElement.classList.add('ritare-vila');
    helUITona(false, 700);
  }, 3600);
}
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => window.addEventListener(t, () => { if (fyllLage && !helRor) helVila(true); }, { passive: true, capture: true }));
// Esc stänger helskärmen (om ingen meny, dialog eller spelläget tar den först)
window.addEventListener('keydown', e => {
  // (planlösningen och menyerna tar Esc först: ett tryck stänger dem, nästa stänger helskärmen)
  if (e.key !== 'Escape' || e.defaultPrevented || planLage || oppenMeny) return;
  // (mitt i en glidning in räknas den som helskärm: Esc köas och tar inte samtidigt en ut ur huset)
  if (helRor) { e.stopPropagation(); if (helMalLage) helskarm(false); return; }
  if (fyllLage !== 'knapp') return;
  if (document.pointerLockElement || spelPa || performance.now() - spelSlut < 500 || document.querySelector('.kf__popup:not([hidden]), dialog[open]')) return;
  // i helskärm stänger Esc bara helskärmen (inte samtidigt Se inne): ett steg i taget
  e.stopPropagation();
  helskarm(false);
}, true);
// vriden telefon eller ändrat fönster i helskärm: kontrollernas ytor och utsikten räknas om
let helStorlekTid = 0, helFormat = 0;
window.addEventListener('resize', () => {
  if (!fyllLage || helRor) return;
  clearTimeout(helStorlekTid);
  helStorlekTid = setTimeout(() => {
    if (!fyllLage || helRor || !kan('helMarg')) return;
    const m = helMarginaler(), f = innerWidth / innerHeight;
    if (helFormat && Math.abs(f / helFormat - 1) > 0.15 && kan('helOmrama')) ritare.helOmrama(m); else ritare.helMarg(m);
    helFormat = f;
  }, 180);
});
function helskarm(pa) {
  bilHem();   // bilen står parkerad när bilden byter format
  // (mitt i en glidning gäller ett nytt tryck motsatsen till dit bilden är på väg)
  if (pa === undefined) pa = helRor ? !helMalLage : !(document.fullscreenElement || fyllLage);
  if (!pa && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  glidHel(!!pa);
}
hk.addEventListener('click', () => helskarm());
// lämnar man helskärm med Esc eller systemets knapp glider bilden mjukt tillbaka
document.addEventListener('fullscreenchange', () => { if (!helBytes && !document.fullscreenElement) helFram(); });
document.addEventListener('fullscreenchange', () => {
  const hel = !!document.fullscreenElement;
  if (!hel && fyllLage === 'knapp' && !kanHel) return;
  if (!hel && fyllLage) fyll(false);
  hk.setAttribute('data-tips', hel ? 'Lämna helskärm' : 'Helskärm');
  hk.querySelector('span').textContent = hel ? 'Lämna helskärm' : 'Helskärm';
  hk.setAttribute('aria-pressed', String(hel));
});

// ---- verktygsradens finish: ljus som följer musen, klockbubbla vid reglaget, solen som
// vrider sig med tiden och en liten studs när ett läge slås på eller av. Bara utseende:
// knapparna och motorn gör samma sak som förut. ----
const verktyg = document.querySelector('.kf__verktyg');
if (verktyg) {
  const yta = document.createElement('span');
  yta.className = 'kf__vyta'; yta.setAttribute('aria-hidden', 'true');
  yta.innerHTML = '<i class="kf__vglod"></i>';
  verktyg.prepend(yta);
  const glod = yta.firstChild;
  let glodX = 0, glodRaf = 0;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    verktyg.addEventListener('pointermove', e => {
      glodX = e.clientX - verktyg.getBoundingClientRect().left;
      if (!glodRaf) glodRaf = requestAnimationFrame(() => { glodRaf = 0; glod.style.transform = 'translate3d(' + (glodX - 70).toFixed(1) + 'px,0,0)'; });
    });
    verktyg.addEventListener('pointerenter', () => verktyg.classList.add('kf__verktyg--glod'));
    verktyg.addEventListener('pointerleave', () => verktyg.classList.remove('kf__verktyg--glod'));
  }
  // lägen som slås på eller av får en kort studs (även när motorn eller tangenterna byter)
  new MutationObserver(lista => lista.forEach(m => {
    const b = m.target;
    if (!b.classList || !b.classList.contains('kf__vk') || m.oldValue === b.getAttribute('aria-pressed')) return;
    b.classList.remove('kf__vk--slag'); void b.offsetWidth; b.classList.add('kf__vk--slag');
  })).observe(verktyg, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'], attributeOldValue: true });
  verktyg.addEventListener('animationend', e => { if (e.animationName === 'kfv-slag') e.target.closest('.kf__vk')?.classList.remove('kf__vk--slag'); });
  // klockbubblan syns medan man drar eller stegar med pilarna
  const sol = tid.closest('.kf__sol');
  let bubblaTid = 0;
  const visaBubbla = ms => {
    clearTimeout(bubblaTid); sol.classList.add('kf__sol--drar'); radTid(+tid.value);
    if (ms) bubblaTid = setTimeout(() => sol.classList.remove('kf__sol--drar'), ms);
  };
  tid.addEventListener('pointerdown', () => visaBubbla(0));
  ['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, () => { if (sol.classList.contains('kf__sol--drar')) visaBubbla(700); }));
  tid.addEventListener('keydown', e => { if (/^(Arrow|Page|Home|End)/.test(e.key)) visaBubbla(1100); });
  tid.addEventListener('blur', () => { clearTimeout(bubblaTid); sol.classList.remove('kf__sol--drar'); });
  radTid(+tid.value);
}
['pointerdown', 'wheel'].forEach(t => duk.addEventListener(t, () => {
  // tipset med handen försvinner efter första draget och kommer inte tillbaka
  if (!harDragit) gomHanden();
  visaTips(null);
  gangRorelse();
  // när man själv vrider är kameran inte längre i en sparad vy (bara första gången:
  // markeraTumme läser ringens mått, och det ska inte ske i varje hjulsteg)
  if (!inneLage && nuVy !== null) { nuVy = null; markeraTumme(null); }
}, { passive: true }));

// ---- menyerna i verktygsraden (Vy och Miljö) ----
const MENYER = [];
let oppenMeny = null;
function meny(knapp, popup, knappar, valj) {
  const m = { knapp, popup, knappar };
  MENYER.push(m);
  knapp.addEventListener('click', e => { e.stopPropagation(); visaMeny(oppenMeny === m ? null : m, e.detail === 0); });
  popup.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    valj(b);
    visaMeny(null); knapp.focus();
  });
  popup.addEventListener('keydown', e => {
    const k = knappar(), i = k.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      k[(i + (e.key === 'ArrowDown' ? 1 : -1) + k.length) % k.length].focus();
    } else if (e.key === 'Tab') visaMeny(null);
  });
  return m;
}
function visaMeny(m, fokus) {
  MENYER.forEach(o => { o.popup.hidden = o !== m; o.knapp.setAttribute('aria-expanded', String(o === m)); });
  oppenMeny = m;
  if (m && fokus) { const b = m.popup.querySelector('[aria-checked="true"]') || m.knappar()[0]; if (b) b.focus(); }
}
document.addEventListener('click', e => { if (oppenMeny && !e.target.closest('.kf__verktyg .kf__meny')) visaMeny(null); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && oppenMeny) { e.stopPropagation(); const k = oppenMeny.knapp; visaMeny(null); k.focus(); } }, true);

const vyPopup = document.getElementById('kf-vy');
const vyKnappar = () => [...vyPopup.querySelectorAll('[data-vy-val]')];
meny(document.querySelector('[data-vy-knapp]'), vyPopup, vyKnappar, b => aka(b.getAttribute('data-vy-val'), TONA));
if (ljusKnapp && ljusPopup) meny(ljusKnapp, ljusPopup, ljusKnappar, b => valjLjus(b.getAttribute('data-ljus')));

// ---- Se inne: motorn flyttar kameran in i huset ----
const inneKnapp = document.querySelector('[data-inne]');
const inneRum = document.querySelector('[data-inne-rum]');
const inneRumRad = inneRum && inneRum.querySelector('[role="group"]');
const inneTumme = document.querySelector('[data-inne-tumme]');
const karta = document.querySelector('[data-karta]');
const kartaBild = document.querySelector('[data-karta-bild]');
const kartaPunkter = document.querySelector('[data-karta-punkter]');
const kartaNamn = document.querySelector('[data-karta-namn]');
const kanInne = kan('inne') && !!inneKnapp;
let inneLage = false, inneVy = 0, mattForeInne = false, inneJobb = Promise.resolve();
function inneVyer() {
  if (!kan('inneVyer')) return [];
  try { const l = ritare.inneVyer(); return Array.isArray(l) ? l : []; } catch (e) { console.warn(e); return []; }
}
// Rummen att gå till kommer från motorns rumPunkter (gå-läget); finns de inte
// används de komponerade vyerna som förut. Kartan visar alltid vyerna.
let aktivtRum = -1;
function rumPunkter() {
  if (!kan('rumPunkter')) return [];
  try { const l = ritare.rumPunkter(); return Array.isArray(l) ? l : []; } catch (e) { console.warn(e); return []; }
}
function ritaRum() {
  if (!inneRum) return;
  const p = rumPunkter(), ga = p.length > 0 && kan('gaTill');
  const l = ga ? p : inneVyer();
  // varje flik: en liten ikon för rummet (syns på bred scen) och namnet; den valda markeras av
  // en gemensam markör som glider mellan flikarna (rullRad flyttar den)
  inneRumRad.innerHTML = '<i class="kf__rum-markor" aria-hidden="true"></i>' + l.map((v, i) => {
    const namn = (v && v.namn) || 'Vy ' + (i + 1);
    return '<button type="button" ' + (ga ? 'data-rum-ga' : 'data-rum-vy') + '="' + i + '" aria-pressed="' + (i === (ga ? aktivtRum : inneVy)) + '">' + rumIkon(namn) + '<span>' + esc(namn) + '</span></button>';
  }).join('');
  inneRum.hidden = !inneLage || l.length < 2;
  ritaKarta(inneVyer());
}
// prick för var man står, flyttas live medan man glider och går
let duPrick = null, sistPos = null;
function kartaPunkt(x, z) {
  const ruta = kartaRuta(), H = MODELLER[val.modell];
  if (!ruta) return null;
  const [bw, bh, x0, y0, x1, y1] = ruta;
  return [(x0 + (x / H.L + 0.5) * (x1 - x0)) / bw * 100, (y0 + (z / H.W + 0.5) * (y1 - y0)) / bh * 100];
}
function flyttadInne(pos) {
  if (!pos || !inneLage) return;
  sistPos = pos;
  const nv = pos.niva === 1 || pos.niva === 'loft' ? 1 : 0;
  if (nv !== kartaNiva) { kartaNiva = nv; ritaKarta(inneVyer()); return; }
  if (karta && !karta.hidden && kartaPunkter) {
    const pt = kartaPunkt(pos.x, pos.z);
    if (pt) {
      if (!duPrick || !duPrick.isConnected) {
        duPrick = document.createElement('span');
        duPrick.className = 'kf__prick kf__prick--har kf__prick--du'; duPrick.setAttribute('aria-hidden', 'true'); duPrick.innerHTML = '<i></i>';
        kartaPunkter.appendChild(duPrick);
      }
      duPrick.style.left = Math.max(0, Math.min(100, pt[0])).toFixed(2) + '%';
      duPrick.style.top = Math.max(0, Math.min(100, pt[1])).toFixed(2) + '%';
      duPrick.style.setProperty('--v', (pos.riktning * 180 / Math.PI).toFixed(1) + 'deg');
    }
  }
  const p = rumPunkter();
  if (p.length && pos.rum >= 0 && pos.rum !== aktivtRum) {
    aktivtRum = pos.rum;
    if (inneRumRad) inneRumRad.querySelectorAll('[data-rum-ga]').forEach(b => b.setAttribute('aria-pressed', String(+b.getAttribute('data-rum-ga') === aktivtRum)));
    if (kartaNamn && p[aktivtRum]) kartaNamn.textContent = p[aktivtRum].namn || '';
    rumTillVy();
  }
}
// rummet man gått till sparas i länken som vyn med samma namn
function rumTillVy() {
  const p = rumPunkter(), namn = p[aktivtRum] && p[aktivtRum].namn;
  if (!namn) return;
  const i = inneVyer().findIndex(v => v && v.namn === namn);
  if (i >= 0 && i !== inneVy) { inneVy = i; spara(); }
}

// Kartan: planbilden med en prick där man står och en kon åt det håll man tittar.
// Lägena kommer från motorn om den lämnar dem, annars ur inredningens lista.
let INNE_LAGEN = null;
async function inneLagen() {
  if (INNE_LAGEN) return INNE_LAGEN;
  try { INNE_LAGEN = (await import('./husritare-inne.js?v=' + MOTOR_V)).INNE_VYER || {}; } catch (e) { INNE_LAGEN = {}; }
  return INNE_LAGEN;
}
let kartaModell = '';
async function ritaKarta(l) {
  if (!karta) return;
  const ruta = kartaRuta();
  if (!inneLage || !ruta || !l.length) { karta.hidden = true; return; }
  let lagen = l;
  if (!l.every(v => v && Array.isArray(v.pos))) {
    const k = (await inneLagen())[val.modell] || [];
    lagen = l.map((v, i) => ({ ...v, pos: k[i] && k[i].pos, mal: k[i] && k[i].mal }));
  }
  if (!inneLage) return;
  const H = MODELLER[val.modell];
  const [bw, bh, x0, y0, x1, y1] = ruta;
  const punkt = p => [(x0 + (p[0] / H.L + 0.5) * (x1 - x0)) / bw * 100, (y0 + (p[2] / H.W + 0.5) * (y1 - y0)) / bh * 100];
  const bildNyckel = val.modell + (pakLoft() ? '|loft' : '');
  if (kartaModell !== bildNyckel) {
    kartaModell = bildNyckel;
    kartaBild.src = 'images/plan/' + PLANER[val.modell][pakLoft() ? 1 : 0][0] + '.webp';
    kartaBild.style.aspectRatio = bw + ' / ' + bh;
  }
  kartaPunkter.innerHTML = lagen.map((v, i) => {
    if (!v.pos || (PLANRUTA_LOFT[val.modell] && vyNiva(v) !== kartaNiva)) return '';
    const [x, y] = punkt(v.pos);
    const vinkel = v.mal ? Math.atan2(v.mal[2] - v.pos[2], v.mal[0] - v.pos[0]) * 180 / Math.PI : 0;
    return '<button type="button" class="kf__prick' + (i === inneVy && !sistPos ? ' kf__prick--har' : '') + '" data-rum-vy="' + i + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;--v:' + vinkel.toFixed(1) + 'deg" aria-label="' + esc(v.namn || 'Vy ' + (i + 1)) + '" title="' + esc(v.namn || 'Vy ' + (i + 1)) + '" aria-pressed="' + (i === inneVy) + '"><i></i></button>';
  }).join('');
  kartaNamn.textContent = (l[inneVy] && l[inneVy].namn) || '';
  karta.hidden = false;
  duPrick = null;
  if (sistPos) flyttadInne(sistPos);
}

function sattInne(pa, vyIndex, opt) {
  if (!kanInne) return Promise.resolve();
  pa = !!pa;
  // ett rum ur länken som inte finns blir det sista som finns
  if (vyIndex != null) vyIndex = Math.min(Math.max(0, vyIndex | 0), Math.max(0, inneVyer().length - 1));
  const byterRum = pa && inneLage && vyIndex != null && vyIndex !== inneVy;
  if (pa === inneLage && !byterRum) return inneJobb;
  if (!prodAker) stangProdukt(true);   // Se inne / Se ute för hand: produktkortet går bort
  const forra = inneLage;
  inneLage = pa;
  if (vyIndex != null) inneVy = vyIndex; else if (pa && !forra) inneVy = 0;
  scen.classList.toggle('kf__scen--inne', pa);
  kf.classList.toggle('kf--inne', pa);
  inneKnapp.setAttribute('aria-pressed', String(pa));
  if (typeof ritaLagesknappar === 'function') ritaLagesknappar();   // (alla tre knapparna efter läget)
  inneKnapp.querySelector('span').textContent = pa ? 'Se ute' : 'Se inne';
  inneKnapp.setAttribute('data-tips', pa ? 'Gå ut ur huset' : 'Gå in i huset');
  if (pa && oppetLage) sattOppen(false, true);
  if (pa && !forra) {
    nuVy = null; markeraTumme('inne'); aktivtRum = -1; sistPos = null; kartaNiva = vyNiva(inneVyer()[inneVy]);
    // måttlinjer och snurr hör till utsidan
    mattForeInne = mk.getAttribute('aria-pressed') === 'true';
    if (mattForeInne) ritare.satt('matt', false);
    if (sn.getAttribute('aria-pressed') === 'true') { ritare.snurra(false); sn.setAttribute('aria-pressed', 'false'); }
    visaTips(null);
    // efter toningen in (0,5 s), så att chipet inte glider in över den gamla bilden
    // (efter åkningen in genom dörren: annars hann chipet gå bort innan man var inne)
    const pek = matchMedia('(hover: none), (pointer: coarse)').matches;
    let vantat = 0;
    const visaNar = () => {
      if (!inneLage) return;
      if (kan('flyger') && ritare.flyger() && (vantat += 200) < 30000) { setTimeout(visaNar, 200); return; }
      // vänd-tipset först (samma plats under flikarna); hjälpen när det har gått bort
      if (typeof vandTips !== 'undefined' && vandTips && (vantat += 200) < 40000 && (vandTips.syns() || vantat < 900)) { setTimeout(visaNar, 300); return; }
      // kartan öppen: hjälpen hade lagt sig under den; den hoppas över (?-knappen visar den)
      if (karta && karta.classList.contains('kf__karta--oppen')) return;
      // på pekskärm bara första gången (?-knappen visar den igen)
      if (pek) { let sett = false; try { sett = !!localStorage.getItem('legohus-gang-sett'); localStorage.setItem('legohus-gang-sett', '1'); } catch (e) { /* privat läge */ } if (sett) return; }
      // på dator första gången per besök
      else { let sett = false; try { sett = !!sessionStorage.getItem('legohus-gang-sett'); sessionStorage.setItem('legohus-gang-sett', '1'); } catch (e) { /* privat läge */ } if (sett) return; }
      visaGang(true, 4000);
    };
    setTimeout(visaNar, lugn() ? 0 : 380);
  } else if (!pa && forra) {
    markeraTumme(null);
    if (mattForeInne) ritare.satt('matt', true);
    mattForeInne = false;
    visaTips(null);
    visaGang(false);
    tipsText.textContent = TIPS_UTE; tips.classList.remove('kf__tips--besked');
  }
  if (hjalpKnapp) hjalpKnapp.hidden = !pa;
  if (spelKnapp) spelKnapp.hidden = !pa || !kanSpelNu();
  if (!pa) { if (spelPa && kan('spel')) ritare.spel(false); visaSpel(false); visaMal(null); visaSitt(false); if (lampKnapp) lampKnapp.hidden = true; }
  mk.hidden = pa; sn.hidden = pa;
  ritaRum();
  let svar;
  try { svar = opt ? ritare.inne(pa, pa ? inneVy : undefined, opt) : ritare.inne(pa, pa ? inneVy : undefined); } catch (e) { console.warn(e); }
  // minskad rörelse: ingen åkning och ingen toning i motorn, bara en snabb mjuk intoning av bilden
  if (opt && lugn() && typeof duk.animate === 'function') { try { duk.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }); } catch (e) { /* utan animation: rakt byte */ } }
  spara();
  inneJobb = Promise.resolve(svar).catch(e => console.warn(e)).then(() => {
    if (!inneLage) { nyaTummar(); sistPos = null; return; }
    // börja med rummet som har samma namn som vyn
    const vn = (inneVyer()[inneVy] || {}).namn, rp = rumPunkter();
    if (aktivtRum < 0 && vn) aktivtRum = rp.findIndex(p => p && p.namn === vn);
    ritaRum();
    if (kan('position')) { try { flyttadInne(ritare.position()); } catch (e) { /* utan position syns bara vyerna */ } }
    if (kan('lampor')) { try { visaLampor(ritare.lampor()); } catch (e) { console.warn(e); } }
  });
  return inneJobb;
}
if (kanInne) {
  inneKnapp.hidden = false;
  if (inneTumme) inneTumme.hidden = false;
  flyttaRing();
  // med tangentbordet (detail 0), och med mus, går fokus till duken, så att W A S D
  // fungerar direkt (på pekskärm skulle fokus bara visa tangentbordet i onödan)
  const fokusDuk = e => { if (inneLage && (e.detail === 0 || finPekare.matches)) duk.focus({ preventScroll: true }); };
  inneKnapp.addEventListener('click', e => { bytLage(vyLage() === 'inne' ? 'ute' : 'inne'); fokusDuk(e); });
  if (inneTumme) inneTumme.addEventListener('click', e => { sattInne(true, undefined, DORR); fokusDuk(e); });
  // pekaren eller fokus på knappen: inredningen byggs färdigt nu, så att åkningen kan börja direkt
  if (kan('forbered')) [inneKnapp, inneTumme].forEach(el => el && ['pointerenter', 'focus', 'touchstart'].forEach(h => el.addEventListener(h, () => { try { ritare.forbered(); } catch (err) { console.warn(err); } }, { passive: true })));
  // fliken som väljs är den som fingret/musen tryckte ned på, även om raden gled under trycket
  // (då hamnar släppet på grannfliken eller mellan dem och klicket gäller annars fel flik eller raden)
  let rumNer = null, rumNerT = 0;
  [inneRum, karta].forEach(el => el && el.addEventListener('pointerdown', e => {
    rumNer = e.isPrimary !== false ? e.target.closest('[data-rum-ga], [data-rum-vy]') : null; rumNerT = performance.now();
  }, { passive: true }));
  [inneRum, karta].forEach(el => el && el.addEventListener('click', e => {
    const ner = e.detail !== 0 && rumNer && rumNer.isConnected && el.contains(rumNer) && performance.now() - rumNerT < 1500 ? rumNer : null;
    rumNer = null;
    const mal = ner || e.target;
    const g = mal.closest('[data-rum-ga]');
    if (g) { aktivtRum = +g.getAttribute('data-rum-ga'); ritare.gaTill(aktivtRum); inneRumRad.querySelectorAll('[data-rum-ga]').forEach(b => b.setAttribute('aria-pressed', String(b === g))); rumTillVy(); fokusDuk(e); return; }
    const b = mal.closest('[data-rum-vy]');
    if (b) { sistPos = null; sattInne(true, +b.getAttribute('data-rum-vy'), TONA); fokusDuk(e); }
  }));
  if (hjalpKnapp && gangTips) hjalpKnapp.addEventListener('click', () => visaGang(!gangTips.classList.contains('syns'), 6000));
  // tangenterna för att gå tar bort chipet; ? visar det igen
  window.addEventListener('keydown', e => {
    if (!inneLage || e.altKey || e.ctrlKey || e.metaKey) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    if (/^(Key[WASDQE]|Arrow(Up|Down|Left|Right))$/.test(e.code)) gangRorelse();
    // G: Spelläget av och på (som knappen)
    if (e.code === 'KeyG' && !e.repeat && spelKnapp && spelKnapp.offsetParent && !document.querySelector('dialog[open]')) spelKnapp.click();
  });
  // Escape i scenen tar en ut igen
  scen.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !inneLage || oppenMeny) return;
    // Esc i Spelläget (eller just efter, när webbläsaren släppte pekaren) avslutar bara Spelläget
    if (spelPa || performance.now() - spelSlut < 500) { if (spelPa && kan('spel')) ritare.spel(false); visaSpel(false); return; }
    sattInne(false, undefined, DORR); inneKnapp.focus();
  });
}

// ---- Öppna tak: taket lyfts av och man ser ned i rummen, våning för våning ----
const oppnaKnapp = document.querySelector('[data-oppna]');
const lagerRad = document.querySelector('[data-lager]');
// våningsraden ligger i scenen (inte i en verktygsgrupp): då centreras den mot scenen och
// kan aldrig sticka ut utanför den (gruppens animation gjorde gruppen till dess ram)
if (lagerRad) scen.appendChild(lagerRad);
const kanOppna = kan('oppna') && !!oppnaKnapp;
const LAGER = { hela: { tak: false, loft: true, fokus: null }, botten: { tak: false, loft: false, fokus: null }, loft: { tak: false, loft: true, fokus: 'loft' } };
let oppetLage = false, lagerVal = 'hela';
const harLoft = () => (MODELLER[val.modell].rum || []).some(r => /loft/i.test(r[0]));
function ritaLager() {
  if (!lagerRad) return;
  if (lagerVal === 'loft' && !harLoft()) lagerVal = 'hela';
  // ett hus utan loft har bara en våning, då behövs ingen våningsrad
  lagerRad.hidden = !oppetLage || !harLoft();
  const lb = lagerRad.querySelector('[data-lager-val="loft"]');
  if (lb) lb.hidden = !harLoft();
  lagerRad.querySelectorAll('[data-lager-val]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-lager-val') === lagerVal)));
}
// utanMotor: bara knappar och klasser (motorn stänger själv vid inne och modellbyte)
function sattOppen(pa, utanMotor, direkt) {
  if (!kanOppna) return false;
  pa = !!pa;
  if (pa && inneLage) sattInne(false);
  oppetLage = pa;
  scen.classList.toggle('kf__scen--oppen', pa);
  oppnaKnapp.setAttribute('aria-pressed', String(pa));
  oppnaKnapp.querySelector('span').textContent = pa ? 'Lägg på tak' : 'Öppna tak';
  oppnaKnapp.setAttribute('data-tips', pa ? 'Lägg tillbaka taket' : 'Lyft av taket och se in');
  if (pa) {
    nuVy = null; markeraTumme(null);
    if (sn.getAttribute('aria-pressed') === 'true') { ritare.snurra(false); sn.setAttribute('aria-pressed', 'false'); }
  }
  if (!utanMotor) {
    let ok = !pa;
    try { ok = !!ritare.oppna(pa, { lager: LAGER[lagerVal], direkt: !!direkt }) || !pa; } catch (e) { console.warn(e); }
    // motorn kunde inte öppna (huset inte byggt än, eller ett fel): knapparna tillbaka
    if (!ok) {
      oppetLage = false;
      scen.classList.remove('kf__scen--oppen');
      oppnaKnapp.setAttribute('aria-pressed', 'false');
      oppnaKnapp.querySelector('span').textContent = 'Öppna tak';
      oppnaKnapp.setAttribute('data-tips', 'Lyft av taket och se in');
      ritaLager();
      return false;
    }
  }
  ritaLager();
  spara();
  if (!pa) nyaTummar();
  visaLyftLaddar();
  ritaLagesknappar();
  return true;
}
// Taket svävar medan inredningen byggs färdigt: knappen är redan intryckt och pricken pulserar
// (aria-busy) tills lyftet börjar
let lyftKoll = 0;
function visaLyftLaddar() {
  cancelAnimationFrame(lyftKoll);
  const steg = () => {
    const laddar = oppetLage && kan('lyftLaddar') && ritare.lyftLaddar();
    if (laddar) oppnaKnapp.setAttribute('aria-busy', 'true'); else oppnaKnapp.removeAttribute('aria-busy');
    lyftKoll = laddar ? requestAnimationFrame(steg) : 0;
  };
  steg();
}
if (kanOppna) {
  oppnaKnapp.hidden = false;
  oppnaKnapp.addEventListener('click', () => bytLage(vyLage() === 'tak' ? 'ute' : 'tak'));
  if (lagerRad) lagerRad.addEventListener('click', e => {
    const b = e.target.closest('[data-lager-val]');
    if (!b || !oppetLage) return;
    lagerVal = b.getAttribute('data-lager-val');
    try { ritare.oppna(true, { lager: LAGER[lagerVal] }); } catch (err) { console.warn(err); }
    ritaLager(); spara();
  });
  scen.addEventListener('keydown', e => { if (e.key === 'Escape' && oppetLage && !oppenMeny) sattOppen(false); });
}

// ---- Elbilen: Kör iväg / Kör hem ----
// Motorn kör förloppet (ritare.bil): kontakten ur, lyktorna tänds, bilen kör iväg; sedan hem igen.
// Knappen är av medan bilen kör och byter text efter läget (duken skickar 'husritare:bil').
// Helskärm parkerar bilen direkt; Se inne, planlösningen och miljö-/modellbyten gör motorn själv.
const bilKnapp = document.querySelector('[data-bil]');
const kanBil = kan('bil') && !!bilKnapp;
function visaBil(lage) {
  if (!kanBil) return;
  const kor = lage === 'ut' || lage === 'in', hem = lage === 'borta' || lage === 'ut';
  bilKnapp.disabled = kor;
  bilKnapp.setAttribute('aria-pressed', String(hem));
  bilKnapp.querySelector('span').textContent = hem ? 'Kör hem' : 'Kör iväg';
  bilKnapp.setAttribute('data-tips', lage === 'ut' ? 'Bilen kör iväg …' : lage === 'in' ? 'Bilen kommer hem …' : hem ? 'Kör hem bilen och ladda den' : 'Kör iväg med bilen');
}
function bilHem() { try { if (kanBil) visaBil(ritare.bil('parkera')); } catch (e) { /* före knappen fanns */ } }
if (kanBil) {
  bilKnapp.hidden = false; bilKnapp.dataset.etikett = 'Bil';
  bilKnapp.addEventListener('click', () => { try { visaBil(ritare.bil(ritare.bil() === 'borta' ? 'hem' : 'ut')); } catch (e) { console.warn(e); } });
  window.addEventListener('husritare:bil', e => visaBil(e.detail && e.detail.lage));
  document.addEventListener('fullscreenchange', bilHem);
  visaBil(ritare.bil());
}

// ---- Tomt hus (möblerna av och på) och Planlösning (vyn rakt ovanifrån) ----
// Motorn gör bytet (ritare.tomt, ritare.plan); här hålls knapparna, länken och Esc i takt.
// Planlösningen avslutas av motorn själv när ett annat läge tar över (husritare:plan).
const tomtKnapp = document.querySelector('[data-tomt]'), planKnapp = document.querySelector('[data-plan]');
const kanTomt = kan('tomt') && !!tomtKnapp, kanPlan = kan('plan') && !!planKnapp;
var tomtLage = false, planLage = false;   // var: vyLage() kan anropas (dörrtipset) innan raden körts
function sattTomt(pa, direkt) {
  if (!kanTomt) return;
  tomtLage = !!pa;
  try { tomtLage = !!ritare.tomt(tomtLage, { direkt: !!direkt }); } catch (e) { console.warn(e); }
  tomtKnapp.setAttribute('aria-pressed', String(tomtLage));
  tomtKnapp.querySelector('span').textContent = tomtLage ? 'Visa möbler' : 'Tomt hus';
  tomtKnapp.setAttribute('data-tips', tomtLage ? 'Visa möblerna igen' : 'Tomt hus: dölj möblerna');
  scen.classList.toggle('kf__scen--tomt', tomtLage);
  spara();
}
function visaPlan(pa) {
  if (!kanPlan || pa === planLage) return;
  planLage = pa;
  planKnapp.setAttribute('aria-pressed', String(pa));
  planKnapp.querySelector('span').textContent = pa ? 'Stäng planlösning' : 'Planlösning';
  planKnapp.setAttribute('data-tips', pa ? 'Tillbaka till huset' : 'Planlösning ovanifrån');
  scen.classList.toggle('kf__scen--plan', pa);
  if (pa) {
    nuVy = null; markeraTumme(null);
    if (sn.getAttribute('aria-pressed') === 'true') { ritare.snurra(false); sn.setAttribute('aria-pressed', 'false'); }
  }
  spara();
  ritaLagesknappar();
}
function sattPlan(pa, direkt) {
  if (!kanPlan) return;
  pa = !!pa;
  if (pa && inneLage) sattInne(false);
  let ok = false;
  try { ok = !!ritare.plan(pa, { direkt: !!direkt }); } catch (e) { console.warn(e); }
  visaPlan(ok);
}

// ---- Vyns läge: EN tillståndsmaskin för Se inne, Öppna tak och Planlösning ----
// Läget är exakt ett av ute, inne, tak (taket av) och plan (planlösningen går före: den lyfter
// taket själv, men då är bara Planlösning "på"). Knappar, tangenter och Esc går genom bytLage,
// som kör rätt övergång från läget man är i; knapparnas utseende ritas bara från läget.
// Tomt hus är en egen flagga som gäller i alla lägen (sattTomt).
function vyLage() { return planLage ? 'plan' : inneLage ? 'inne' : oppetLage ? 'tak' : 'ute'; }
// en smal etikett under ikonen när läget är på (pekskärm, se husritare.css): man ser var man är
[[oppnaKnapp, 'Tak av'], [planKnapp, 'Plan'], [tomtKnapp, 'Tomt']].forEach(([b, t]) => { if (b) b.dataset.etikett = t; });
let planFran = 'ute';
function ritaLagesknappar() {
  const l = vyLage();
  if (inneKnapp) inneKnapp.setAttribute('aria-pressed', String(l === 'inne'));
  if (oppnaKnapp) {
    oppnaKnapp.setAttribute('aria-pressed', String(l === 'tak'));
    const s = oppnaKnapp.querySelector('span'); if (s) s.textContent = l === 'tak' ? 'Lägg på tak' : 'Öppna tak';
    oppnaKnapp.setAttribute('data-tips', l === 'tak' ? 'Lägg tillbaka taket' : 'Lyft av taket och se in');
  }
  if (planKnapp) planKnapp.setAttribute('aria-pressed', String(l === 'plan'));
}
function bytLage(mal) {
  stangProdukt(true);
  const fran = vyLage();
  if (mal === fran) { ritaLagesknappar(); return; }
  if (mal === 'plan') {
    planFran = fran;
    if (fran === 'inne') sattInne(false, undefined, TONA);   // ut utan åkning; planen sveper upp från ytterbilden
    sattPlan(true);
  } else if (fran === 'plan') {
    if (mal === planFran && mal !== 'inne') sattPlan(false);   // motorn spelar tillbaka till ute eller taket av
    else {
      sattPlan(false, true);   // direkt (förra bilden tonas bort), sedan vidare till målet
      if (mal === 'inne') { if (oppetLage) sattOppen(false, true); sattInne(true, undefined, TONA); }
      else if (mal === 'tak') { if (!oppetLage) sattOppen(true); }
      else if (oppetLage) sattOppen(false);
    }
  } else if (mal === 'inne') {
    // från taket av: in direkt (motorn lägger på taket utan att först visa utsidan)
    if (fran === 'tak') { sattOppen(false, true); sattInne(true, undefined, TONA); }
    else sattInne(true, undefined, DORR);
  } else if (mal === 'tak') sattOppen(true);   // sattOppen går ut ur huset först om man är inne
  else if (mal === 'ute') { if (fran === 'inne') sattInne(false, undefined, DORR); else if (fran === 'tak') sattOppen(false); }
  ritaLagesknappar();
}
if (kanTomt) {
  tomtKnapp.hidden = false;
  tomtKnapp.addEventListener('click', () => sattTomt(!tomtLage));
}
if (kanPlan) {
  planKnapp.hidden = false;
  planKnapp.addEventListener('click', () => bytLage(vyLage() === 'plan' ? planFran : 'plan'));
  duk.addEventListener('husritare:plan', e => visaPlan(!!(e.detail && e.detail.pa)));
  // klick på ett rum i ritningen: in i det rummet (motorn tonar över från planlösningen)
  duk.addEventListener('husritare:planrum', e => { if (kanInne && e.detail) sattInne(true, e.detail.vy | 0); });
  scen.addEventListener('keydown', e => { if (e.key === 'Escape' && planLage && !oppenMeny) { e.stopPropagation(); bytLage(planFran); } }, true);
}

// ---- Bilen vid huset: Tesla, Volvo eller ingen, under miljöerna i miljömenyn (adressen: bil=volvo) ----
// Motorn byter och tonar över när modellen är laddad; Kör iväg/Kör hem gäller den valda bilen.
const BILVAL = [['tesla', 'Tesla', '#e8e9eb'], ['volvo', 'Volvo', '#1c2c44'], ['ingen', 'Ingen bil', 'transparent']];
var bilVal = 'tesla';   // var: spara() kan köras innan raden har nåtts
function byggBilval() {
  if (!kan('bilModell') || !mpopup || mpopup.querySelector('[data-bilval]')) return;
  mpopup.insertAdjacentHTML('beforeend', '<p class="kf__poprubrik" role="presentation">Bil</p>' + BILVAL.map(([id, namn, f]) =>
    '<button type="button" role="menuitemradio" aria-checked="' + (id === bilVal) + '" data-bilval="' + id + '"><i style="--f:' + f + '"' + (id === 'ingen' ? ' class="kf__ingen"' : '') + '></i>' + namn + '</button>').join(''));
}
function valjBil(id, tyst) {
  if (!kan('bilModell')) return;
  bilVal = BILVAL.some(b => b[0] === id) ? id : 'tesla';
  byggBilval();
  mpopup.querySelectorAll('[data-bilval]').forEach(b => b.setAttribute('aria-checked', String(b.getAttribute('data-bilval') === bilVal)));
  const knapp = document.querySelector('[data-bil]');
  if (knapp && kan('bil')) knapp.hidden = bilVal === 'ingen';
  try { Promise.resolve(ritare.bilModell(bilVal)).then(() => { if (typeof visaBil === 'function' && kan('bil')) visaBil(ritare.bil()); }); } catch (e) { console.warn(e); }
  if (!tyst) spara();
}
// ---- miljö: listan kommer från motorn om den finns ----
const mpopup = document.getElementById('kf-miljo');
const MILJOFARG = { studio: '#d6d0c6', tradgard: '#6e7d47', skog: '#3f5236', vinter: '#eef0f2', kust: '#4f7f98', villa: '#a8826a' };
function byggMiljo() {
  if (!kan('miljoLista')) return;
  let lista;
  try { lista = ritare.miljoLista(); } catch (e) { console.warn(e); return; }
  if (!Array.isArray(lista)) return;
  lista = lista.filter(x => Array.isArray(x) && x[0]);
  if (!lista.length) return;
  const valt = valdMiljo();
  const finns = lista.some(([id]) => id === valt);
  mpopup.innerHTML = lista.map(([id, namn], i) =>
    '<button type="button" role="menuitemradio" aria-checked="' + (finns ? id === valt : i === 0) + '" data-miljo="' + esc(id) + '">' +
    '<i' + (MILJOFARG[id] ? ' style="--f:' + MILJOFARG[id] + '"' : '') + '></i>' + esc(namn || id) + '</button>').join('');
}
function miljoKnappar() { return [...mpopup.querySelectorAll('[data-miljo]')]; }
function valjMiljo(id, tyst) {
  const b = miljoKnappar().find(o => o.getAttribute('data-miljo') === id);
  if (!b) return false;
  miljoKnappar().forEach(o => o.setAttribute('aria-checked', String(o === b)));
  // valet syns i menyn direkt; den tunga ombyggnaden av miljön kommer i nästa ruta
  if (ritare) {
    if (tyst) { ritare.miljo(id); visaLiv(); }
    else efterRuta(() => { tonaSjalv(); ritare.miljo(id); visaLiv(); nyaTummar(); });
  }
  if (!tyst) spara();
  return true;
}
meny(document.querySelector('[data-miljo-knapp]'), mpopup, miljoKnappar, b => { if (b.hasAttribute('data-bilval')) valjBil(b.getAttribute('data-bilval')); else valjMiljo(b.getAttribute('data-miljo')); });
byggMiljo();
byggBilval();
visaLiv();
// miljön kan byggas klart sent på en långsam dator: titta efter liv en stund (högst 10 s)
{
  let livKoll = 0;
  const livTid = setInterval(() => { visaLiv(); if (!livKnapp || !livKnapp.hidden || ++livKoll >= 20) clearInterval(livTid); }, 500);
}

// ladda ned en skarp bild av vyn
document.querySelector('[data-ladda]').addEventListener('click', () => {
  if (!ritare) return;
  const a = document.createElement('a');
  a.href = ritare.nedladdning();
  a.download = 'legohus-' + val.modell + (inneLage ? '-inne' : '') + '.png';
  document.body.appendChild(a); a.click(); a.remove();
});

// grupperna fälls ut och ihop med mjuk höjd
document.querySelectorAll('.kgrupp').forEach(g => {
  const inre = document.createElement('div');
  inre.className = 'kgrupp__inre';
  [...g.children].filter(c => c.tagName !== 'SUMMARY').forEach(c => inre.appendChild(c));
  g.appendChild(inre);
  const klar = fn => {
    if (inre._klar) inre.removeEventListener('transitionend', inre._klar);
    inre._klar = ev => { if (ev.target !== inre || ev.propertyName !== 'height') return; fn(); inre.style.height = ''; inre.removeEventListener('transitionend', inre._klar); inre._klar = null; };
    inre.addEventListener('transitionend', inre._klar);
  };
  g.querySelector('summary').addEventListener('click', e => {
    if (lugn()) return;
    e.preventDefault();
    if (g.open && !g.dataset.stanger) {
      g.dataset.stanger = '1';
      inre.style.height = inre.scrollHeight + 'px';
      requestAnimationFrame(() => { inre.style.height = '0px'; });
      klar(() => { g.open = false; delete g.dataset.stanger; });
    } else {
      // öppnas den mitt i en stängning fortsätter den från höjden den har
      const fran = g.dataset.stanger ? inre.offsetHeight : 0;
      delete g.dataset.stanger;
      g.open = true;
      inre.style.height = fran + 'px';
      requestAnimationFrame(() => { inre.style.height = inre.scrollHeight + 'px'; });
      klar(() => {});
    }
  });
});

// ljuset följer pekaren över korten (bara med mus, bara medan man rör den)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let ruta = null;
  document.addEventListener('pointermove', e => {
    if (lugn()) return;
    const k = e.target.closest && e.target.closest('.kljus');
    if (!k) return;
    if (ruta) return;
    ruta = requestAnimationFrame(() => {
      ruta = null;
      const r = k.getBoundingClientRect();
      k.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      k.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    });
  }, { passive: true });
  document.querySelectorAll('.kgrupp, .ksumma, .kplan__panel, .kplan__bild, .kf__lankar').forEach(k => k.classList.add('kljus'));
}

// mörkt läge följer sidans temaknapp
new MutationObserver(() => { if (ritare) { ritare.tema(document.documentElement.getAttribute('data-tema') === 'mork'); nyaTummar(); } })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

// ---- länken minns valen ----
let startar = true;
const fullLank = document.querySelector('[data-full]');
function spara() {
  if (startar) return;
  ritaEtikett();
  try { ritaSparaLage(); } catch (e) { /* listan är inte uppsatt än */ }
  const q = new URLSearchParams();
  q.set('modell', MODELL_UT[val.modell] || val.modell);
  ['fasad', 'tak', 'detalj'].forEach(g => { if (val[g]) q.set(g, val[g]); });
  if (Q0.get('taktyp')) q.set('taktyp', Q0.get('taktyp'));   // takmaterial (motorn: betong, tegel, plat; standard falsad plåt)
  const tv = Math.round(+tid.value * 100) / 100;
  if (tv !== STANDARD_TID) q.set('tid', String(tv));
  const m = valdMiljo();
  if (m !== 'studio') q.set('miljo', m);
  if (inneLage) { q.set('vy', 'inne'); if (inneVy) q.set('rum', inneVy); }
  else if (!oppetLage && nuVy && VINKLAR.includes(nuVy)) q.set('vy', nuVy);
  if (mk.getAttribute('aria-pressed') === 'true' && !inneLage) q.set('matt', '1');
  if (oppetLage) { q.set('oppen', '1'); if (lagerVal !== 'hela') q.set('lager', lagerVal); }
  if (tomtLage) q.set('tomt', '1');
  if (typeof bilVal === 'string' && bilVal !== 'tesla') q.set('bil', bilVal);
  if (planLage) q.set('plan', '1');
  q.set('paket', prisKort ? prisKort.paket() : lasPaket());   // valt paket (husritare-pris.js)
  if (fullLank) fullLank.href = 'rita-hus.html?' + q.toString();
  // inbäddad: iframens adress lämnas i fred, bara länken till hela husritaren följer med
  if (INB) return;
  try { history.replaceState(null, '', '?' + q.toString()); } catch (e) { /* förhandsvisning utan historik */ }
  try { sessionStorage.setItem(EGEN_NYCKEL, q.toString()); } catch (e) { /* privat läge */ }
}
// Tillbaka från webbläsarens sidcache (bakåtknappen, sidan står kvar i minnet): adressen som
// sidan själv skrev ersätts med standarden. Står allt redan som standard läggs bara kameran i
// startvyn (utan intro); annars laddas sidan om i standardläget utan intro.
window.addEventListener('pageshow', e => {
  if (!e.persisted || INB || FOTO || !ritare || location.search.slice(1) !== egenAdress()) return;
  const sq = new URLSearchParams(STANDARD), q = new URLSearchParams(location.search);
  const somStandard = ['modell', 'fasad', 'tak', 'detalj', 'miljo'].every(k => q.get(k) === sq.get(k)) && Math.abs(+q.get('tid') - 19.2) < 0.01 && !inneLage && !oppetLage && !tomtLage && !planLage && q.get('matt') !== '1' && !q.has('bil');
  if (!somStandard) { location.replace('?' + STANDARD + '&intro=0' + location.hash); return; }
  try { ritare.vy('runt', { hopp: true }); } catch (err) { console.warn(err); }
  nuVy = 'runt'; markeraTumme('runt'); spara();
});
(function () {
  const q = new URLSearchParams(location.search);
  const m = modellId(q.get('modell'));
  // modellen är redan byggd av skapaRitare (START_MODELL)
  if (m && MODELLER[m]) document.querySelector('input[name="modell"][value="' + m + '"]').checked = true;
  ['fasad', 'tak', 'detalj'].forEach(g => {
    const v = q.get(g);
    if (v && FARGER[g][v]) { val[g] = v; if (ritare) ritare.satt(g, v); }
  });
  const t = parseFloat(q.get('tid'));
  tid.value = String(t >= 6 && t <= 22 ? t : STANDARD_TID);
  tid.dispatchEvent(new Event('input'));
  if (t >= 20) kvFore = STANDARD_TID;
  // gamla namn i sparade länkar (motorn har samma karta, GAMLA_NAMN)
  const GAMLA_MILJO = { gras: 'tradgard', sno: 'vinter' };
  const mi = q.get('miljo');
  if (mi) valjMiljo(GAMLA_MILJO[mi] || mi, true);
  if (q.get('matt') === '1') mk.click();
  const vy = q.get('vy');
  if (vy === 'inne' && kanInne) setTimeout(() => sattInne(true, Math.max(0, parseInt(q.get('rum'), 10) || 0)), FOTO ? 0 : 600);
  else if (FOTO && vy && ritare) { nuVy = vy; ritare.vy(vy, { hopp: true }); }
  // en delad länk landar direkt i vinkeln, som att öppna en bild (åkningen är för klick)
  else if (vy && VINKLAR.includes(vy)) {
    if (ritare) { nuVy = vy; try { ritare.vy(vy, { hopp: true }); } catch (e) { console.warn(e); } snurrPa = false; sn.setAttribute('aria-pressed', 'false'); markeraTumme(vy); }
  }
  if (q.get('oppen') === '1' && kanOppna && vy !== 'inne') {
    const lg = q.get('lager');
    if (lg && LAGER[lg]) lagerVal = lg;
    // vänta tills huset är byggt och introt har åkt klart, och lyft sedan taket med
    // glidning (inte direkt), så att det inte hoppar; en långsam dator får försöka en stund
    let forsok = 0;
    const oppnaNar = () => {
      if (oppetLage || inneLage) return;
      // efter 30 s väntan öppnas taket ändå, så att länken alltid landar i det öppna huset
      const vanta = kan('upptagen') && ritare.upptagen() && forsok < 100;
      if (vanta || !sattOppen(true)) { if (++forsok < 140) setTimeout(oppnaNar, 300); }
    };
    setTimeout(oppnaNar, 400);
  }
  // tomt=1: möblerna dolda från början; plan=1: planlösningen när huset står klart
  if (q.get('tomt') === '1') sattTomt(true, true);
  if (q.has('bil')) valjBil(q.get('bil'), true);
  if (q.get('plan') === '1' && kanPlan && vy !== 'inne') {
    let forsok = 0;
    const planNar = () => {
      if (planLage || inneLage) return;
      const vanta = !FOTO && ((kan('upptagen') && ritare.upptagen()) || (q.get('oppen') === '1' && kanOppna && !oppetLage)) && forsok < 100;
      if (vanta) { if (++forsok < 140) setTimeout(planNar, 300); return; }
      sattPlan(true, FOTO);
    };
    setTimeout(planNar, FOTO ? 0 : 700);
  }
  // ?prestanda=1: bilder/s, ms per ruta, ritanrop, trianglar och långa uppgifter efter klick
  if (q.get('prestanda') === '1' && kan('prestanda')) prestandaRuta();
  // ?stat=1 visar ritanropen (för mätning)
  if (q.get('stat') === '1' && kan('statistik')) {
    const el = document.createElement('pre'); el.className = 'kf__stat'; scen.appendChild(el);
    setInterval(() => { if (ritare.upptagen()) return; try { el.textContent = JSON.stringify(ritare.statistik()); } catch (e) { el.textContent = String(e); } }, 1000);
  }
})();

// ---- mätrutan (?prestanda=1) ----
// Rutan skriver bara text två gånger per sekund; den läser aldrig layouten.
// Långa uppgifter (över 50 ms) räknas med PerformanceObserver; de som börjar inom en
// sekund efter ett klick eller tryck räknas för sig, liksom klickets tid till nästa bild.
function prestandaRuta() {
  const el = document.createElement('pre');
  el.className = 'kf__prestanda'; el.setAttribute('aria-hidden', 'true');
  scen.appendChild(el);
  const lt = { n: 0, max: 0, klickN: 0, klickMax: 0, sista: [] }, ev = { max: 0, sista: 0 };
  let klick = -1e9, sist = performance.now();
  document.addEventListener('pointerdown', () => { klick = performance.now(); }, { capture: true, passive: true });
  document.addEventListener('keydown', () => { klick = performance.now(); }, { capture: true, passive: true });
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => {
      lt.n++; lt.max = Math.max(lt.max, e.duration);
      if (e.startTime >= klick - 20 && e.startTime - klick < 1000) { lt.klickN++; lt.klickMax = Math.max(lt.klickMax, e.duration); lt.sista.unshift(Math.round(e.duration)); lt.sista.length = Math.min(lt.sista.length, 4); }
    })).observe({ type: 'longtask', buffered: true });
  } catch (e) { lt.n = -1; }
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => {
      if (/pointer|click|key/.test(e.name)) { ev.sista = e.duration; ev.max = Math.max(ev.max, e.duration); }
    })).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) { /* stöds inte */ }
  setInterval(() => {
    let p;
    try { p = ritare.prestanda(); } catch (e) { el.textContent = String(e); return; }
    const nu = performance.now(), s = (nu - sist) / 1000; sist = nu;
    const fps = p.rutor / s;
    el.textContent =
      (p.stilla && !p.rutor ? 'stilla (ritar inget)' : fps.toFixed(0) + ' bilder/s · ' + (p.intervall ? p.intervall.toFixed(1) : '–') + ' ms mellan') + '\n' +
      'ruta ' + p.ms.toFixed(1) + ' ms (max ' + p.msMax.toFixed(1) + ')\n' +
      p.anrop + ' anrop · ' + (p.trianglar / 1000).toFixed(0) + 'k trianglar\n' +
      'skuggpass ' + (p.skuggAnrop || 0) + ' anrop · vinkelbild ' + (p.tummeAnrop || 0) + '\n' +
      (lt.n < 0 ? 'långa uppgifter: stöds inte' : 'långa uppgifter ' + lt.n + ' (max ' + Math.round(lt.max) + ' ms)\n' +
      'efter klick: ' + lt.klickN + (lt.klickN ? ' (max ' + Math.round(lt.klickMax) + ' ms; ' + lt.sista.join(', ') + ')' : ' ✓')) + '\n' +
      'klick → bild ' + Math.round(ev.sista) + ' ms (max ' + Math.round(ev.max) + ')';
  }, 500);
}

// ==== Spara, Mina hus, Jämför och Sammanfattning ====
const NYCKEL = 'legohus-mina-hus';
function lasSparade() { try { return JSON.parse(localStorage.getItem(NYCKEL)) || []; } catch (e) { return []; } }
function skrivSparade(l) { try { localStorage.setItem(NYCKEL, JSON.stringify(l)); return true; } catch (e) { return false; } }
const giltig = h => h && h.val && MODELLER[h.val.modell];

const sparaKnapp = document.querySelector('[data-spara]');
const minaKnapp = document.querySelector('[data-mina]');
const minaLista = document.getElementById('kf-mina');
const antal = document.querySelector('[data-antal]');
function visaMina(pa) { minaLista.hidden = !pa; minaKnapp.setAttribute('aria-expanded', String(pa)); }
function ritaMina() {
  try { ritaMinaNu(); } catch (e) { console.warn(e); }
}
function ritaMinaNu() {
  const l = lasSparade();
  antal.hidden = !l.length; antal.textContent = l.length;
  document.querySelector('[data-tom]').hidden = !!l.length;
  const ul = document.querySelector('[data-sparade]');
  ul.innerHTML = l.map((h, i) => {
    if (!giltig(h)) return '';
    const { H, f, t } = beskrivning(h.val);
    return '<li><input type="checkbox" data-valj="' + i + '" aria-label="Jämför ' + esc(H.namn) + '">' +
      '<img src="' + sparadBild(h) + '" alt="">' +
      '<button type="button" class="kf__lista-ladda" data-ladda-hus="' + i + '"><b>' + H.namn + '</b><small>' + esc(f[0]) + ' · ' + esc(t[0]) + ' tak</small></button>' +
      '<button type="button" class="kf__lista-knapp" data-ta-bort="' + i + '" aria-label="Ta bort ' + H.namn + '">Ta bort</button></li>';
  }).join('');
  uppdateraJamfor();
  if (typeof ritaSparaLage === 'function' && !startar) ritaSparaLage();
}
function uppdateraJamfor() {
  const valda = minaLista.querySelectorAll('[data-valj]:checked');
  const n = valda.length;
  // högst tre i jämförelsen
  minaLista.querySelectorAll('[data-valj]').forEach(c => { c.disabled = !c.checked && n >= 3; });
  const b = document.querySelector('[data-jamfor]');
  b.disabled = n < 2; b.textContent = n < 2 ? 'Markera två eller tre hus att jämföra' : 'Jämför ' + n + ' hus';
}
// sparade bilder är små JPEG:ar; saknas en (äldre sparning) används modellens foto
const reservBild = id => 'images/hus3d/' + id + '-600.webp';
const sparadBild = h => (typeof h.bild === 'string' && h.bild.startsWith('data:image/') ? h.bild : reservBild(h.val.modell));
// Spara direkt efter ett färgbyte: motorn tonar fortfarande kulören, och bilden blev
// då förra färgen. Vänta tills tonen/åkningen är klar (högst 2,5 s) innan bilden tas.
const valNu = () => ({ ...val, miljo: valdMiljo(), tid: Math.round(+tid.value * 100) / 100 });
function sparaNu(knapp, forsok = 0, vid = valNu()) {
  if (!ritare) return;
  // huset som gällde vid klicket sparas, även om man hunnit byta under väntan
  const samma = JSON.stringify(vid) === JSON.stringify(valNu());
  if (samma && forsok < 25 && kan('upptagen') && ritare.upptagen()) { setTimeout(() => sparaNu(knapp, forsok + 1, vid), 100); return; }
  let l = lasSparade();
  // motorn ritar vinkelbilden som utsidan med taket på, även inifrån och i dockskåpet;
  // har huset bytts sedan klicket används modellens foto
  let bild = '';
  if (samma) { try { bild = ritare.tumme('summa', 360); } catch (e) { console.warn(e); } }
  // miljön och ljuset följer med; samma hus två gånger blir en rad, överst
  const nytt = { val: vid, bild, tid: Date.now() };
  const nyckel = JSON.stringify(nytt.val);
  l = l.filter(h => !h || JSON.stringify(h.val) !== nyckel);
  l.unshift(nytt);
  while (l.length > 6) l.pop();
  const ok = skrivSparade(l);
  ritaMina();
  if (ok && !lugn()) { antal.classList.remove('studs'); void antal.offsetWidth; antal.classList.add('studs'); }
  if (knapp === sparaKnapp && ok) { ritaSparaLage(); klarKnapp(sparaKnapp, 900); }
  else if (knapp) {
    // knappens egen text minns första gången (två snabba klick ska inte fastna på Sparat)
    const span = knapp.querySelector('span') || knapp, t = span.dataset.text || (span.dataset.text = span.textContent);
    span.textContent = ok ? 'Sparat' : 'Kunde inte spara';
    clearTimeout(span._tid); span._tid = setTimeout(() => { span.textContent = t; }, 1800);
  }
}
sparaKnapp.addEventListener('click', () => sparaNu(sparaKnapp));
// Spara visar om huset som syns redan finns i Mina hus (ifyllt bokmärke, texten Sparat)
function ritaSparaLage() {
  const nyckel = JSON.stringify(valNu());
  const finns = lasSparade().some(h => h && JSON.stringify(h.val) === nyckel);
  sparaKnapp.classList.toggle('kf__lank--sparad', finns);
  sparaKnapp.setAttribute('aria-pressed', String(finns));
  sparaKnapp.setAttribute('data-tips', finns ? 'Huset finns i Mina hus' : 'Spara huset i Mina hus');
  const span = sparaKnapp.querySelector('span');
  if (span) span.textContent = finns ? 'Sparat' : 'Spara';
}
minaKnapp.addEventListener('click', e => { e.stopPropagation(); visaMina(minaLista.hidden); });
document.addEventListener('click', e => { if (!minaLista.hidden && !e.target.closest('.kf__meny--rad')) visaMina(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !minaLista.hidden) { visaMina(false); minaKnapp.focus(); } });
minaLista.addEventListener('change', uppdateraJamfor);
minaLista.addEventListener('click', e => {
  const ladda = e.target.closest('[data-ladda-hus]'), bort = e.target.closest('[data-ta-bort]');
  if (ladda) {
    const h = lasSparade()[+ladda.getAttribute('data-ladda-hus')];
    if (!giltig(h)) return;
    // samma hus som nu: bara färger, miljö och ljus byts (huset byggs inte om, kameran står kvar)
    const samma = h.val.modell === val.modell;
    if (!samma) {
      document.querySelector('input[name="modell"][value="' + h.val.modell + '"]').checked = true;
      bytModell(h.val.modell);
    } else tonaSjalv();
    ['fasad', 'tak', 'detalj'].forEach(g => { const v = h.val[g]; val[g] = v && FARGER[g][v] ? v : null; });
    const sattFarger = () => { if (ritare) ['fasad', 'tak', 'detalj'].forEach(g => ritare.satt(g, val[g])); nyaTummar(); };
    // färgerna sätts när modellbytet har gått igenom i motorn
    if (samma) sattFarger(); else Promise.resolve(inneJobb).then(sattFarger);
    if (h.val.miljo && h.val.miljo !== valdMiljo()) valjMiljo(h.val.miljo, true);
    const ht = +h.val.tid;
    if (ht >= 6 && ht <= 22 && Math.abs(ht - +tid.value) > 0.01) glidTid(ht);
    uppdatera(); spara(); visaMina(false); minaKnapp.focus();
  } else if (bort) {
    const l = lasSparade(); l.splice(+bort.getAttribute('data-ta-bort'), 1); skrivSparade(l); ritaMina();
    minaKnapp.focus();
  }
});

// dialogerna: stäng med knapp, Escape (inbyggt) eller klick utanför
document.querySelectorAll('.kdialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-stang]')) d.close(); });
});

const jamforDialog = document.querySelector('[data-jamfor-dialog]');
document.querySelector('[data-jamfor]').addEventListener('click', () => {
  const l = lasSparade();
  const valda = [...minaLista.querySelectorAll('[data-valj]:checked')].map(c => l[+c.getAttribute('data-valj')]).filter(giltig).slice(0, 3);
  if (valda.length < 2) return;
  document.querySelector('[data-jamfor-kolumner]').innerHTML = valda.map(h => {
    const { H } = beskrivning(h.val);
    const q = new URLSearchParams(Object.entries(h.val).filter(([, v]) => v)).toString();
    return '<article class="kjmf__kol"><img src="' + sparadBild(h) + '" alt=""><h3>' + H.namn + '</h3><p>' + fakta(H) + '</p><dl>' + rader(h.val) + '</dl>' +
      '<a class="kf__knapp" href="?' + q + '">Öppna det här huset</a></article>';
  }).join('');
  visaMina(false);
  jamforDialog.showModal();
});

const summaDialog = document.querySelector('[data-summa-dialog]');
function oppnaSumma() {
  const { H } = beskrivning(val);
  document.querySelector('[data-summa-namn]').textContent = H.namn;
  document.querySelector('[data-summa-fakta]').textContent = fakta(H);
  const chips = document.querySelector('[data-summa-chips]');
  if (chips) chips.innerHTML = '<div><dt>Rum</dt><dd>' + esc(rumEtikett(val.modell)) + '</dd></div>' +
    '<div><dt>' + (H.rum.some(r => /loft/i.test(r[0])) ? 'Rumsyta inkl. loft' : 'Rumsyta') + '</dt><dd>' + nf(rumsyta(H).toFixed(1)) + ' m²</dd></div>';
  document.querySelector('[data-summa-dl]').innerHTML = rader(val, !!chips);
  // paketet och priset: samma som priskortet visar
  const prisDl = document.querySelector('[data-summa-pris]');
  if (prisDl) {
    const k = document.querySelector('.kpris'), v = k && k.querySelector('[data-kpris-paket][aria-checked="true"]');
    const fran = v && v.querySelector('[data-kpris-fran]'), belopp = v && v.querySelector('[data-kpris-belopp]'), moms = k && k.querySelector('[data-kpris-moms]');
    prisDl.innerHTML = v ? '<div><dt>Paket</dt><dd>' + esc(((v.querySelector('.kpris__pnamn') || v).firstChild || {}).textContent || '') + '</dd></div>' +
      '<div class="ksam__prisrad"><dt>Pris</dt><dd><b>' + (fran && !fran.hidden ? 'från ' : '') + esc(belopp ? belopp.textContent : '') + '</b>' + (moms && moms.textContent ? '<small>' + esc(moms.textContent) + '</small>' : '') + '</dd></div>' : '';
    prisDl.hidden = !v;
  }
  const plan = document.querySelector('[data-summa-plan]');
  plan.src = 'images/plan/' + PLANER[val.modell][0][0] + '.webp';
  plan.alt = 'Plan för ' + H.namn;
  const rull = document.querySelector('[data-summa-rull]');
  if (rull) rull.scrollTop = 0;
  summaDialog.showModal();
  // bilden: bara huset, utan miljön (snö, staket, bil), mot en ljus studiobakgrund; annars en 1×-kopia av duken
  // (efter showModal: rutan har sin storlek, så att bilden ritas i rätt format)
  const bild = document.querySelector('[data-summa-bild]');
  if (ritare && bild) {
    if (bild.tagName === 'CANVAS') { if (!summa3dStart(bild) && !produktbild(bild) && kan('bildTill')) ritare.bildTill(bild); }
    else if (bild.tagName === 'IMG') bild.src = ritare.nedladdning();
    bild.setAttribute('aria-label', H.namn + ', fasad ' + beskrivning(val).f[0].toLowerCase() + ', tak ' + beskrivning(val).t[0].toLowerCase());
  }
}
// Produktbilden: huset ensamt (miljön, bilen och måtten döljs en enda bildruta), ritat från
// kamerans håll runt huset i en lugn vinkel, inpassat i rutan, med en mjuk skugga under.
// Allt återställs direkt efteråt och scenen ritas om som förut. false om motorn saknar delarna.
// opt (offertens studiobild, husritare-app.js via duk.__produktbild): bredd/hojd i px (annars rutans
// storlek), vinkel (radianer runt huset från framsidan, annars kamerans håll), ljus (ljus botten även
// i mörkt tema), studio (fast eftermiddagsljus, ingen snö, inga utemöbler) och skarp (ritas i full
// storlek i stället för att skalas upp från duken).
let produktLada = null;
function produktbild(duk, opt = {}) {
  const S = ritare && ritare.sprang;
  if (!S || !S.THREE || !S.renderer || typeof S.hus !== 'function') return false;
  const { THREE, scene, kamera, renderer } = S, hus = S.hus();
  if (!hus) return false;
  const yta = duk.parentElement ? { width: duk.parentElement.offsetWidth, height: duk.parentElement.offsetHeight } : { width: 0, height: 0 };
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const W = opt.bredd || Math.max(320, Math.round((yta.width || 640) * pr)), Hh = opt.hojd || Math.max(240, Math.round((yta.height || 480) * pr));
  if (duk.width !== W || duk.height !== Hh) { duk.width = W; duk.height = Hh; }
  const behall = new Set();
  for (let o = hus; o; o = o.parent) behall.add(o);
  const dolda = [];
  const dolj = grupp => grupp.children.forEach(c => {
    if (behall.has(c)) { if (c !== hus) dolj(c); return; }
    if (c.isLight) return;
    let ljus = false; c.traverse(x => { if (x.isLight) ljus = true; });
    if (ljus) { dolj(c); return; }
    if (c.visible) { c.visible = false; dolda.push(c); }
  });
  const mork = !opt.ljus && document.documentElement.getAttribute('data-tema') === 'mork';
  const dimma0Lage = scene.fog ? [scene.fog.near, scene.fog.far, scene.fog.density] : null;
  const bg0 = scene.background, dimma0 = scene.fog, vp = new THREE.Vector4(), sc = new THREE.Vector4(), sct = renderer.getScissorTest();
  renderer.getViewport(vp); renderer.getScissor(sc);
  const matt = typeof S.matt === 'function' ? S.matt() : null, mattSyns = matt && matt.visible;
  const mobler = opt.studio ? hus.getObjectByName('mobler') : null, moblerSyns = mobler && mobler.visible;
  const studio0 = opt.studio ? { tid: ritare.val().tid, expo: renderer.toneMappingExposure, sno: S.sno ? S.sno.value : 0 } : null;
  // studio: 'latt' (sammanfattningens 3D, varje bildruta): ingen snö och inga utemöbler, men kundens eget ljus
  // (ljusbytet ritar om solens skuggkarta två gånger per bild; det görs bara för de skarpa bilderna)
  const tungStudio = !!opt.studio && opt.studio !== 'latt';
  let pr0 = null;
  try {
    dolj(scene);
    if (mattSyns) matt.visible = false;
    if (studio0) {
      if (tungStudio && kan('satt')) ritare.satt('tid', 15);
      renderer.toneMappingExposure = Math.abs(renderer.toneMappingExposure);   // vid sjön är den negativ (sommargraderingen)
      if (S.sno) S.sno.value = 0;
      if (moblerSyns) mobler.visible = false;
      if (tungStudio) {
        if (S.skuggRam) S.skuggRam();   // solens skuggor efter det nya ljuset
        renderer.shadowMap.needsUpdate = true;
      }
    }
    hus.updateMatrixWorld(true);
    // lådan runt huset räknas en gång per hus (sammanfattningens 3D ritar många bilder i rad)
    const lada = produktLada && produktLada.hus === hus && produktLada.studio === !!opt.studio ? produktLada : null;
    const box = lada ? lada.box.clone() : new THREE.Box3(), b = new THREE.Box3();
    if (!lada) {
    hus.traverseVisible(o => {
      if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    });
    // bara själva huset: lådan kapas vid husets mått (L, W, höjd) med lite luft för takfot och trappor
    const ud = hus.userData || {};
    if (ud.L && ud.W && ud.hojd) {
      const hx = ud.L / 2 + 0.8, hz = ud.W / 2 + 1.2;   // L längs x, W längs z
      box.intersect(new THREE.Box3(new THREE.Vector3(-hx, -0.3, -hz).add(hus.position), new THREE.Vector3(hx, ud.hojd + 0.6, hz).add(hus.position)));
    }
    produktLada = { hus, studio: !!opt.studio, box: box.clone() };
    }
    const storlek = box.getSize(new THREE.Vector3());
    if (box.isEmpty() || storlek.length() > 80) throw new Error('ingen ram');
    const mitt = box.getCenter(new THREE.Vector3());
    const dir = typeof opt.vinkel === 'number' ? new THREE.Vector3(Math.sin(opt.vinkel), 0, Math.cos(opt.vinkel)) : kamera.position.clone().sub(mitt); dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 1);
    dir.normalize();
    const hojd = THREE.MathUtils.degToRad(15);
    dir.multiplyScalar(Math.cos(hojd)); dir.y = Math.sin(hojd);
    // opt.rikt: ett eget håll (från huset mot kameran), t.ex. sammanfattningens 3D-vinkel, med sin egen höjd
    if (opt.rikt && opt.rikt.lengthSq() > 1e-6) dir.copy(opt.rikt).normalize();
    // opt.kam: en egen kamera som följer med mellan bilderna (sammanfattningens 3D, nedladdningen därifrån).
    // Första gången passas den in här; sedan styrs den utifrån och ritas som den står.
    const kamKlar = opt.kam && opt.kam.userData && opt.kam.userData.klar;
    const kam = kamKlar ? opt.kam : new THREE.PerspectiveCamera(28, W / Hh, 0.1, 400);
    kam.layers.mask = 3;   // taket ligger i lager 1 (dockskåpet): alltid med på produktbilden
    if (kamKlar) { kam.aspect = W / Hh; kam.updateProjectionMatrix(); kam.updateMatrixWorld(); }
    else {
    const vf = THREE.MathUtils.degToRad(kam.fov) / 2, hf = Math.atan(Math.tan(vf) * kam.aspect);
    const radie = storlek.length() / 2;
    let avst = radie * 1.04 / Math.sin(Math.min(vf, hf));
    // inpassning: huset (lådans hörn) fyller ~78 % av bredden eller höjden, två varv
    const horn = [];
    for (let i = 0; i < 8; i++) horn.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const pv = new THREE.Vector3();
    for (let varv = 0; varv < 3; varv++) {
      kam.position.copy(mitt).addScaledVector(dir, avst);
      kam.near = Math.max(0.1, avst / 40); kam.far = avst * 4;
      kam.lookAt(mitt); kam.updateProjectionMatrix(); kam.updateMatrixWorld();
      if (varv === 2) break;
      const ut = Math.max(...horn.map(h => { pv.copy(h).project(kam); return Math.max(Math.abs(pv.x), Math.abs(pv.y)); }));
      if (ut > 0.05) avst *= ut / 0.78;
    }
    if (opt.kam) {
      opt.kam.fov = kam.fov; opt.kam.near = kam.near; opt.kam.far = kam.far; opt.kam.aspect = kam.aspect; opt.kam.layers.mask = 3;
      opt.kam.position.copy(kam.position); opt.kam.quaternion.copy(kam.quaternion); opt.kam.updateProjectionMatrix(); opt.kam.updateMatrixWorld();
      opt.kam.userData = { klar: true, mal: mitt.toArray(), avst };
    }
    }
    // dimman skjuts bort i stället för att tas bort: fog = null kompilerar om alla material (sekunder)
    scene.background = new THREE.Color(mork ? 0x2a2621 : 0xffffff);
    if (dimma0 && 'near' in dimma0) { dimma0.near = 1e4; dimma0.far = 2e4; } else if (dimma0 && 'density' in dimma0) dimma0.density = 0;
    let buf = renderer.getDrawingBufferSize(new THREE.Vector2()), rpr = renderer.getPixelRatio();
    if (opt.skarp && (buf.x < W || buf.y < Hh)) {
      pr0 = rpr; rpr = Math.min(3, rpr * Math.max(W / buf.x, Hh / buf.y));
      renderer.setPixelRatio(rpr); buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    }
    const k = Math.min(1, buf.x / W, buf.y / Hh), pw = Math.floor(W * k), ph = Math.floor(Hh * k);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, pw / rpr, ph / rpr); renderer.setScissor(0, 0, pw / rpr, ph / rpr);
    renderer.render(scene, kam);
    const x = duk.getContext('2d');
    x.save();
    if (mork) {
      x.drawImage(renderer.domElement, 0, buf.y - ph, pw, ph, 0, 0, W, Hh);
    } else {
      // studioljus: ljus botten, skuggan under huset, huset multiplicerat ovanpå (vitt blir botten)
      const g = x.createLinearGradient(0, 0, 0, Hh);
      g.addColorStop(0, '#f6f3ee'); g.addColorStop(1, '#e9e4db');
      x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      const fot = new THREE.Vector3(mitt.x, box.min.y, mitt.z).project(kam);
      let sx = (fot.x + 1) / 2 * W, sy = (1 - fot.y) / 2 * Hh, rx = W * 0.4, ky = 0.09;
      if (opt.studio) {
        // 3/4-vinkeln: skuggan följer husets fotavtryck sett snett ovanifrån (bredare och djupare)
        let x0 = W, x1 = 0, y0 = Hh, y1 = 0;
        [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.max.z]].forEach(([fx, fz]) => {
          const q = new THREE.Vector3(fx, box.min.y, fz).project(kam), px = (q.x + 1) / 2 * W, py = (1 - q.y) / 2 * Hh;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        });
        sx = (x0 + x1) / 2; sy = (y0 + y1) / 2 + (y1 - y0) * 0.08; rx = (x1 - x0) * 0.62; ky = Math.min(0.6, Math.max(0.12, (y1 - y0) * 0.75 / rx));
      }
      x.translate(sx, sy); x.scale(1, ky);
      const s = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      s.addColorStop(0, 'rgba(60, 50, 38, 0.38)'); s.addColorStop(0.6, 'rgba(60, 50, 38, 0.14)'); s.addColorStop(1, 'rgba(60, 50, 38, 0)');
      x.fillStyle = s; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill();
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.drawImage(renderer.domElement, 0, buf.y - ph, pw, ph, 0, 0, W, Hh);
    }
    x.restore();
    return true;
  } catch (e) {
    return false;
  } finally {
    dolda.forEach(o => { o.visible = true; });
    if (mattSyns) matt.visible = true;
    if (studio0) {
      if (moblerSyns) mobler.visible = true;
      if (S.sno) S.sno.value = studio0.sno;
      if (tungStudio) {
        if (kan('satt')) ritare.satt('tid', studio0.tid);
        if (S.skuggRam) S.skuggRam();
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.toneMappingExposure = studio0.expo;
    }
    if (pr0 !== null) renderer.setPixelRatio(pr0);
    scene.background = bg0; scene.fog = dimma0;
    if (dimma0) { if ('near' in dimma0) { dimma0.near = dimma0Lage[0]; dimma0.far = dimma0Lage[1]; } else if ('density' in dimma0) dimma0.density = dimma0Lage[2]; }
    renderer.setScissorTest(sct); renderer.setViewport(vp); renderer.setScissor(sc);
    renderer.render(scene, kamera);
  }
}

// Sammanfattningens 3D: samma motor och scen som ritaren, ingen andra motor. Varje bildruta är en
// produktbild (studio 'latt') från en egen kamera som en egen OrbitControls styr på rutans duk;
// huvudvyn återställs och ritas om i samma uppgift, så den är orörd när rutan stängs. Bilden ritas
// bara när något rör sig: autorotation tills man tar i huset, dämpning, åkningen tillbaka.
// Pekskärm: ett finger i sidled vrider, lodrätt rullar (touch-action: pan-y), två fingrar nyper.
// Dubbelklick/dubbeltryck och 0 återställer, piltangenterna vrider, +/− zoomar.
const summa3d = { kam: null, styr: null, duk: null, ram: 0, oppen: false, start: null, aka: null, tips: null };
function summa3dBegar() { if (summa3d.oppen && !summa3d.ram) summa3d.ram = requestAnimationFrame(summa3dRuta); }
function summa3dRuta(nu) {
  summa3d.ram = 0;
  if (!summa3d.oppen) return;
  const { kam, styr } = summa3d;
  let ror = false;
  if (summa3d.aka) {
    const A = summa3d.aka, t = Math.min(1, (nu - A.t0) / A.tid), e = 1 - Math.pow(1 - t, 3);
    kam.position.lerpVectors(A.fran, A.till, e); styr.target.lerpVectors(A.mf, A.mt, e);
    if (t >= 1) summa3d.aka = null; else ror = true;
  }
  if (styr.update()) ror = true;
  produktbild(summa3d.duk, { kam, studio: 'latt' });
  if (ror || styr.autoRotate) summa3dBegar();
}
function summa3dAka(pos, mal, tid = 600) {
  const { kam, styr } = summa3d;
  if (lugn() || !tid) { kam.position.copy(pos); styr.target.copy(mal); styr.update(); summa3dBegar(); return; }
  summa3d.aka = { fran: kam.position.clone(), till: pos.clone(), mf: styr.target.clone(), mt: mal.clone(), t0: performance.now(), tid };
  summa3dBegar();
}
function summa3dTagit() {
  if (!summa3d.styr) return;
  summa3d.styr.autoRotate = false;
  const t = summa3d.tips;
  if (t && !t.hidden) { t.classList.add('ksam__tips--ut'); setTimeout(() => { t.hidden = true; }, 300); }
}
function summa3dStart(duk) {
  const S = ritare && ritare.sprang;
  if (!S || !S.THREE || !S.renderer) return false;
  const T = S.THREE;
  if (!summa3d.kam) {
    summa3d.duk = duk;
    summa3d.kam = new T.PerspectiveCamera(28, 1, 0.1, 400);
    const st = new OrbitControls(summa3d.kam, duk);
    st.enableDamping = true; st.dampingFactor = 0.08; st.enablePan = false; st.rotateSpeed = 0.7; st.zoomSpeed = 0.8;
    st.minPolarAngle = 0.2; st.maxPolarAngle = Math.PI * 0.49; st.autoRotateSpeed = 0.6;
    st.addEventListener('start', summa3dTagit);
    st.addEventListener('change', summa3dBegar);
    summa3d.styr = st;
    duk.style.touchAction = 'pan-y';   // OrbitControls sätter none: då gick arket inte att rulla på mobilen
    duk.tabIndex = 0;
    const aterstall = () => { summa3dTagit(); if (summa3d.start) summa3dAka(summa3d.start.pos, summa3d.start.mal); };
    duk.addEventListener('dblclick', e => { e.preventDefault(); aterstall(); });
    let sist = null;
    duk.addEventListener('pointerup', e => {
      if (e.pointerType !== 'touch') return;
      const n = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      if (sist && n.t - sist.t < 320 && Math.hypot(n.x - sist.x, n.y - sist.y) < 30) { aterstall(); sist = null; return; }
      sist = n;
    });
    duk.addEventListener('keydown', e => {
      const steg = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      const zoom = e.key === '+' || e.key === '=' ? 0.85 : e.key === '-' || e.key === '_' ? 1.18 : 0;
      if (e.key === '0' || e.key === 'Home') { e.preventDefault(); aterstall(); return; }
      if (!steg && !zoom) return;
      e.preventDefault(); summa3dTagit();
      const sf = new T.Spherical().setFromVector3(summa3d.kam.position.clone().sub(st.target));
      if (steg) { sf.theta += steg[0] * 0.26; sf.phi = Math.min(st.maxPolarAngle, Math.max(st.minPolarAngle, sf.phi + steg[1] * 0.14)); }
      if (zoom) sf.radius = Math.min(st.maxDistance, Math.max(st.minDistance, sf.radius * zoom));
      summa3dAka(new T.Vector3().setFromSpherical(sf).add(st.target), st.target.clone(), 300);
    });
    const tips = document.createElement('span');
    tips.className = 'ksam__tips'; tips.id = 'ksam-tips';
    tips.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14.3-4.9M20 12a8 8 0 0 1-14.3 4.9M18.6 3.2v4.2h-4.2M5.4 20.8v-4.2h4.2"/></svg><span></span>';
    duk.parentElement.appendChild(tips);
    duk.setAttribute('aria-describedby', 'ksam-tips');
    summa3d.tips = tips;
    summaDialog.addEventListener('close', summa3dStopp);
  }
  // ny inpassning varje gång: från huvudkamerans håll, som förut
  summa3d.kam.userData = {};
  summa3d.aka = null;
  if (!produktbild(duk, { kam: summa3d.kam, studio: 'latt' })) return false;
  const u = summa3d.kam.userData, st = summa3d.styr;
  st.target.fromArray(u.mal);
  st.minDistance = u.avst * 0.55; st.maxDistance = u.avst * 1.8;
  st.update();
  summa3d.start = { pos: summa3d.kam.position.clone(), mal: st.target.clone() };
  st.autoRotate = !lugn();
  summa3d.tips.hidden = false; summa3d.tips.classList.remove('ksam__tips--ut');
  summa3d.tips.lastChild.textContent = matchMedia('(pointer: coarse)').matches ? 'Dra i sidled för att vrida' : 'Dra för att vrida · dubbelklicka för att börja om';
  duk.parentElement.classList.add('ksam__bild--3d');
  summa3d.oppen = true;
  summa3dBegar();
  return true;
}
// rutan stängd: ingen bildruta till, huvudvyn ritas om av motorn (inget annat att släppa: samma motor)
function summa3dStopp() {
  summa3d.oppen = false; summa3d.aka = null;
  if (summa3d.ram) { cancelAnimationFrame(summa3d.ram); summa3d.ram = 0; }
  if (summa3d.styr) summa3d.styr.autoRotate = false;
  const S = ritare && ritare.sprang;
  if (S && S.begarRender) S.begarRender();
}
// Ladda ned bild i sammanfattningen: en skarp studiobild (2400 × 1600) från rutans vinkel just nu
function summa3dNedladdning() {
  if (!summa3d.oppen || !summa3d.kam || !summa3d.kam.userData.klar) return false;
  // samma håll som i rutan, men huset passas in på nytt i bildens format (fyller ca 78 %)
  const rikt = summa3d.kam.position.clone().sub(summa3d.styr.target);
  const c = document.createElement('canvas');
  if (!produktbild(c, { rikt, bredd: 2400, hojd: 1600, studio: true, ljus: true, skarp: true })) return false;
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'legohus-' + val.modell + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  summa3dBegar();   // rutans bild igen (den skarpa bilden ritades med studioljus)
  return true;
}
document.querySelector('[data-oppna-summa]').addEventListener('click', oppnaSumma);
// planritningen i sammanfattningen förstoras i planens egen helskärmsdialog
const summaPlanKnapp = document.querySelector('[data-summa-planstor]');
if (summaPlanKnapp) summaPlanKnapp.addEventListener('click', () => {
  const plan = document.querySelector('[data-summa-plan]'), stor = document.querySelector('[data-plan-stor]');
  if (!plan.src || !stor) return;
  stor.src = plan.src; stor.alt = plan.alt;
  planDialog.showModal();
});

// ==== Kortkommandon: ?-knappen i verktygsraden eller tangenten ? ====
const tangentDialog = document.querySelector('[data-tangent-dialog]');
const tangentKnapp = document.querySelector('[data-tangenter]');
function visaTangenter() {
  if (!tangentDialog || tangentDialog.open) return;
  visaMeny(null); visaMina(false);
  tangentDialog.showModal();
}
if (tangentKnapp) tangentKnapp.addEventListener('click', visaTangenter);
const VADERSTRECK = ['soder', 'ost', 'norr', 'vast'];
const skrivFalt = el => !!el && (el.isContentEditable || el.matches('textarea, select, input:not([type="radio"]):not([type="checkbox"]):not([type="range"])'));
window.addEventListener('keydown', e => {
  if (INB || FOTO || !ritare || e.altKey || e.ctrlKey || e.metaKey || e.repeat || e.defaultPrevented) return;
  if (document.querySelector('dialog[open]') || skrivFalt(document.activeElement)) return;
  if (e.key === '?') { e.preventDefault(); visaTangenter(); return; }
  if (e.shiftKey) return;
  const siffra = /^Digit([1-6])$/.exec(e.code);
  if (siffra) { const vy = VINKLAR[+siffra[1] - 1]; if (vy) { e.preventDefault(); aka(vy, TONA); } return; }
  // utomhus med fokus på bilden: pilarna går till nästa väderstreck (inne går man med dem)
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement === duk && !inneLage) {
    e.preventDefault();
    const i = VADERSTRECK.indexOf(nuVy), steg = e.key === 'ArrowRight' ? 1 : -1;
    aka(VADERSTRECK[i < 0 ? (steg > 0 ? 0 : 3) : (i + steg + 4) % 4]);
    return;
  }
  if (e.code === 'KeyI' && kanInne) { e.preventDefault(); inneKnapp.click(); }
  else if (e.code === 'KeyT' && kanOppna) { e.preventDefault(); bytLage(vyLage() === 'tak' ? 'ute' : 'tak'); }
  else if (e.code === 'KeyM' && !inneLage && !mk.hidden) { e.preventDefault(); mk.click(); }
  else if (e.code === 'KeyL' && ljusKnapp) { e.preventDefault(); ljusKnapp.click(); }
  else if (e.code === 'KeyP' && kanPlan) { e.preventDefault(); bytLage(vyLage() === 'plan' ? planFran : 'plan'); }
  else if (e.code === 'KeyB' && kanTomt) { e.preventDefault(); sattTomt(!tomtLage); }
  else if (e.key === 'Escape' && planLage && !oppenMeny) { e.preventDefault(); bytLage(planFran); }
});

// duken berättar för skärmläsare vilket hus, vilket läge och vilket ljus som syns
function ritaEtikett() {
  const H = MODELLER[val.modell];
  const ljus = ljusKnappar().find(b => b.getAttribute('aria-checked') === 'true');
  const ljusText = ljus ? ljus.firstChild.nextSibling.textContent.toLowerCase() : 'klockan ' + ut.textContent;
  duk.setAttribute('aria-label', H.namn + ' i 3D' + (inneLage ? ', inifrån' : '') + (oppetLage ? ', taket av' : '') + ', ' + ljusText + '. ' +
    (inneLage ? 'Gå med W A S D eller piltangenterna.' : 'Dra för att vrida, scrolla eller nyp för att zooma. Piltangenterna byter väderstreck.'));
}
document.querySelector('[data-ladda-summa]').addEventListener('click', () => { if (!summa3dNedladdning()) document.querySelector('[data-ladda]').click(); });
document.querySelector('[data-spara-summa]').addEventListener('click', e => sparaNu(e.currentTarget));
ritaMina();
// ---- Priskortet (husritare-pris.js): valt paket, pris och Begär offert, synkat med sprängvyn ----
// Inbäddad och foto: inget kort, men paketet följer med i länken till hela husritaren.
const TAKTYP_TILLVAL = { betong: 'Betongpannor', tegel: 'Tegeltak' };
prisKort = kopplaPris({
  scen, visa: !INB && !FOTO,
  modell: () => MODELL_UT[val.modell] || val.modell,
  namn: () => MODELLER[val.modell].namn,
  sprang: () => (ritare && ritare.sprangVy) || null,
  tillval: () => TAKTYP_TILLVAL[Q0.get('taktyp')] || '',
  upptagen: () => !!(ritare && kan('upptagen') && ritare.upptagen()),
  // adressen (spara) först: produktlistan läser ?paket= när den får händelsen
  vidByt: id => { ritaSkicka(); spara(); dispatchEvent(new CustomEvent('husritare:paket', { detail: { paket: id } })); },
});
byggProver();
uppdatera();
startar = false;
ritaSparaLage();
ritaEtikett();
if (INB) spara();
// fotoläget: klart när motorn har byggt allt (inredning, miljö, skuggor) och står still
// två mätningar i rad
if (FOTO && ritare) {
  laddar.classList.add('klar', 'borta');
  let stilla = 0;
  const koll = setInterval(() => {
    let klar = false;
    try { klar = kan('fardig') ? !!ritare.fardig() : !ritare.upptagen(); } catch (e) { klar = false; }
    stilla = klar ? stilla + 1 : 0;
    if (stilla >= 2) { clearInterval(koll); document.documentElement.dataset.fotoKlar = '1'; }
  }, 250);
}   // länken Öppna i husritaren får samma hus och val
markeraTumme(nuVy || (inneLage ? 'inne' : 'runt'));
nyaTummar();

// ---- Grafiken tappas (telefonen behövde minnet, appbyte, drivrutinen startade om) ----
// three.js väntar på att sammanhanget kommer tillbaka; då laddas sidan om (länken har alla
// val, så samma hus, färger och läge kommer tillbaka). Under tiden: ett vänligt besked.
if (!FOTO) {
  let tappad = null;
  duk.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (tappad) return;
    tappad = document.createElement('p');
    tappad.className = 'ritare__fel ritare__fel--tappad'; tappad.setAttribute('role', 'status');
    tappad.innerHTML = '<span>Bilden behöver laddas om.<br><button type="button" class="kf__knapp">Ladda om</button></span>';
    tappad.querySelector('button').addEventListener('click', () => location.reload());
    scen.appendChild(tappad);
  });
  duk.addEventListener('webglcontextrestored', () => { try { spara(); } catch (err) { /* länken var redan rätt */ } setTimeout(() => location.reload(), 150); });
}

// rummens små ikoner (2 px streck, samma stil som verktygsraden)
const RUM_IKON = [
  [/kök/i, '<path d="M4 11h16M6 11v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/><path d="M9 7.5c0-1 1-1.2 1-2.2M13 7.5c0-1 1-1.2 1-2.2"/>'],
  [/allrum|vardag/i, '<path d="M5 12V9.5A2.5 2.5 0 0 1 7.5 7h9A2.5 2.5 0 0 1 19 9.5V12"/><path d="M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V18h-17z"/>'],
  [/sov/i, '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>'],
  [/wc|bad|dusch/i, '<path d="M5 12h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path d="M7 12V6a2 2 0 0 1 3.5-1.3"/>'],
  [/loft/i, '<path d="M5 20h4v-4h4v-4h4V8h3"/>'],
  [/bastu/i, '<path d="M12 4c1.5 2.5 4 4 4 7.5a4 4 0 0 1-8 0c0-1.6.8-2.6 1.6-3.4.3 1.4 1 2 1.9 2.2C11 8.5 11 6.3 12 4z"/>'],
  [/hall|korridor|entr/i, '<path d="M7 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M5 20h14"/><path d="M14 12h.01"/>'],
];
function rumIkon(namn) {
  const t = RUM_IKON.find(([re]) => re.test(namn));
  return t ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + t[1] + '</svg>' : '';
}

// ---- Flikraderna i scenen (rummen, våningarna) på en rad ----
// Tonade kanter där det finns mer att rulla till, och den valda fliken rullas in i bild
// (bara raden rullas, aldrig sidan).
function rullRad(el) {
  if (!el) return;
  const kant = () => {
    const mer = el.scrollWidth - el.clientWidth;
    const v = mer > 1 && el.scrollLeft > 2, h = mer > 1 && el.scrollLeft < mer - 2;
    const n = (v ? 'v' : '') + (h ? 'h' : '');
    if ((el.getAttribute('data-rulla') || '') !== n) { if (n) el.setAttribute('data-rulla', n); else el.removeAttribute('data-rulla'); }
  };
  // rullar man själv i raden får den vara i fred en stund (annars drog den tillbaka mitt i ett
  // tryck, och fingret träffade grannfliken); den valda fliken rullas fram bara när den byts
  let egen = 0, sistVald = null, haller = false;
  ['pointerdown', 'touchstart', 'wheel'].forEach(n => el.addEventListener(n, e => { egen = performance.now(); if (n !== 'wheel') haller = true; }, { passive: true }));
  // medan man håller ned rullar raden aldrig själv; efter släppet gäller vilan ovan
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach(n => window.addEventListener(n, () => { if (haller) { haller = false; egen = performance.now(); } }, { passive: true }));
  const visaVald = () => {
    const b = el.querySelector('[aria-pressed="true"]');
    if (b === sistVald || haller || performance.now() - egen < 2500) { kant(); return; }
    sistVald = b;
    if (b && el.scrollWidth > el.clientWidth + 1) {
      const l = b.offsetLeft, r = l + b.offsetWidth, m = 22;
      if (l - m < el.scrollLeft) el.scrollTo({ left: Math.max(0, l - m), behavior: lugn() ? 'auto' : 'smooth' });
      else if (r + m > el.scrollLeft + el.clientWidth) el.scrollTo({ left: r + m - el.clientWidth, behavior: lugn() ? 'auto' : 'smooth' });
    }
    kant();
  };
  // den gemensamma markören (rumsflikarna): glider till den valda fliken; första gången utan glid
  let mkForst = true;
  const markor = () => {
    const m = el.querySelector(':scope > .kf__rum-markor');
    if (!m) return;
    const b = el.querySelector('[aria-pressed="true"]');
    if (!b) { m.style.opacity = '0'; return; }
    if (mkForst || m.style.opacity === '0') { m.style.transition = 'none'; requestAnimationFrame(() => { m.style.transition = ''; }); mkForst = false; }
    m.style.opacity = '1';
    m.style.width = b.offsetWidth + 'px'; m.style.height = b.offsetHeight + 'px';
    m.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)';
  };
  el.addEventListener('scroll', kant, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { kant(); markor(); }).observe(el);
  new MutationObserver(l => { if (l.some(r => r.type === 'childList')) mkForst = true; requestAnimationFrame(() => { markor(); visaVald(); }); }).observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
  requestAnimationFrame(() => { markor(); visaVald(); });
}
rullRad(inneRumRad);
rullRad(lagerRad);

// ---- Inne på telefon: kartan som knapp, vänd telefonen, liggande fyller skärmen ----
const pekskarm = () => matchMedia('(hover: none), (pointer: coarse)').matches;
if (!FOTO && karta) {
  // kartan hopfälld till en rund knapp (karta-ikon) nere till höger; ett tryck visar den
  // som ett överlägg, tryck utanför stänger (CSS visar knappen bara inne på pekskärm)
  const kk = document.createElement('button');
  kk.type = 'button'; kk.className = 'kf__kartknapp'; kk.setAttribute('aria-label', 'Visa kartan'); kk.setAttribute('aria-expanded', 'false');
  kk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/></svg>';
  // en liten miniatyr av planen med en prick där man står (samma bild och prick som kartan,
  // kopierade när de ändras; inget eget ritande)
  const mini = document.createElement('span');
  mini.className = 'kf__kartknapp-mini'; mini.setAttribute('aria-hidden', 'true');
  mini.innerHTML = '<img alt=""><i hidden></i>';
  kk.appendChild(mini);
  const mImg = mini.querySelector('img'), mPrick = mini.querySelector('i');
  const synkMini = () => {
    const src = kartaBild && kartaBild.getAttribute('src');
    if (!src) { kk.classList.remove('kf__kartknapp--mini'); return; }
    if (mImg.getAttribute('src') !== src) mImg.setAttribute('src', src);
    kk.classList.add('kf__kartknapp--mini');
    const du = kartaPunkter && kartaPunkter.querySelector('.kf__prick--du');
    if (du && du.style.left) { mPrick.style.left = du.style.left; mPrick.style.top = du.style.top; mPrick.hidden = false; } else mPrick.hidden = true;
  };
  if (kartaBild) new MutationObserver(synkMini).observe(kartaBild, { attributes: true, attributeFilter: ['src'] });
  if (kartaPunkter) new MutationObserver(synkMini).observe(kartaPunkter, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  synkMini();
  scen.appendChild(kk);
  // (kartan öppen: vänd-tipset och hjälpen bort; hjälpen tar inte över platsen under kartan)
  const kartaOppen = pa => { if (pa) { if (typeof vandTips !== 'undefined' && vandTips) vandTips.gom(); visaGang(false); } karta.classList.toggle('kf__karta--oppen', pa); kk.setAttribute('aria-expanded', String(pa)); kk.setAttribute('aria-label', pa ? 'Dölj kartan' : 'Visa kartan'); };
  kk.addEventListener('click', e => { e.stopPropagation(); kartaOppen(!karta.classList.contains('kf__karta--oppen')); });
  document.addEventListener('pointerdown', e => { if (karta.classList.contains('kf__karta--oppen') && !e.target.closest('.kf__karta, .kf__kartknapp')) kartaOppen(false); }, true);
  const folj = () => { kk.hidden = karta.hidden; if (karta.hidden) kartaOppen(false); };
  new MutationObserver(folj).observe(karta, { attributes: true, attributeFilter: ['hidden'] });
  folj();
}
// (vänd-tipset är borttaget på användarens begäran: helskärmsknappen framhävs i stället, se nedan)
const vandTips = null;
// Helskärmsknappen på pekskärm: accentfärgad, och när man kommer in pulserar en ring 2–3 gånger
// (sedan en svag glöd) tills man har tryckt på den en gång (localStorage)
// Användarens önskan: knappen glittrar ALLTID utom medan man är i helskärm. Lämnar man helskärm
// (knappen, Esc, vänder telefonen) eller kommer tillbaka till sidan glittrar den igen. Inget minne.
const HEL_NYCKEL = 'legohus-helskarm-tryckt';
const iHelskarm = () => !!(document.fullscreenElement || fyllLage);
function helGlitter() {
  if (INB || FOTO) return;
  const pa = !iHelskarm();
  hk.classList.toggle('kf__vk--lockar', pa);
  hk.classList.toggle('kf__vk--sedd', !pa);
  const g = hk.querySelector('.kf__glitter');
  if (!pa) { if (g) g.remove(); return; }
  if (!g) helPuls();
}
function helPuls() {
  if (INB || FOTO || iHelskarm()) return;   // (mobil och dator)
  // glittrande stjärnor runt knappen: fem gnistor i en egen behållare (tar inga tryck),
  // animerade med CSS (förskjutna i tid), ingen JS per bildruta
  if (!hk.querySelector('.kf__glitter')) {
    // (inte <span>: radens regel som döljer knapptext på smal rad, .kf__vk > span, klippte bort dem)
    const g = document.createElement('i');
    g.className = 'kf__glitter'; g.setAttribute('aria-hidden', 'true');
    [[-4, -3, 0], [34, -5, 0.55], [40, 30, 1.1], [-6, 32, 1.65], [16, -8, 2.2]].forEach(([x, y, d], i) => {
      const s = document.createElement('b');
      s.style.cssText = '--x:' + (x - 1) + 'px;--y:' + (y - 1) + 'px;--d:' + d + 's;--s:' + (i % 2 ? 9 : 13) + 'px';
      g.appendChild(s);
    });
    hk.appendChild(g);
  }
  hk.classList.add('kf__vk--lockar');
}
// följ helskärmsläget: efter klick, när helskärm lämnas (Esc, systemets knapp) och när den egna
// fyll-layouten slås av/på (liggande telefon) – klassen ritare-fyll på <html>
hk.addEventListener('click', () => setTimeout(helGlitter, 0));
document.addEventListener('fullscreenchange', () => setTimeout(helGlitter, 0));
new MutationObserver(helGlitter).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', () => { if (!document.hidden) helGlitter(); });
window.addEventListener('pageshow', helGlitter);
try { localStorage.removeItem(HEL_NYCKEL); sessionStorage.removeItem(HEL_NYCKEL); } catch (e) { /* privat läge */ }
helGlitter();   // glittrar från start, i alla lägen, utom i helskärm
// liggande telefon inne: scenen fyller skärmen; tillbaka till stående = vanlig sida
const liggande = matchMedia('(orientation: landscape) and (max-height: 540px)');
function passaFyll() {
  if (FOTO || INB) return;
  if (inneLage && pekskarm() && liggande.matches) { if (vandTips) vandTips.gom(); fyll(true, 'auto'); }
  else if (fyllLage === 'auto') fyll(false);
}
try { liggande.addEventListener('change', passaFyll); } catch (e) { liggande.addListener(passaFyll); }
new MutationObserver(() => {
  const inne = scen.classList.contains('kf__scen--inne');
  if (inne === passaFyll.inne) return;
  passaFyll.inne = inne;
  passaFyll();
  // vänd-tipset när man har kommit in (efter åkningen genom dörren), sedan hjälpen (visaGang väntar)
  // helskärmsknappen lockar när man har kommit in (efter åkningen genom dörren)
  // (glittret gäller i alla lägen tills man har tryckt på Helskärm, se helPuls nedan)
  if (!inne && vandTips) vandTips.gom();
}).observe(scen, { attributes: true, attributeFilter: ['class'] });

// ---- Styrspaken: gå runt inne på pekskärm ----
// En rund spak nere till vänster (syns bara inne och bara på pekskärm, se husritare.css).
// Tummen drar knoppen; motorn går åt det hållet med samma krock och hinder som W A S D.
// Ett annat finger på bilden ser sig om under tiden.
if (kan('spak') && !FOTO) {
  const spak = document.createElement('div');
  // glasyta, en båge som tänds åt det håll man går, och kulan (fjädrar tillbaka när man släpper)
  spak.className = 'kf__spak'; spak.setAttribute('aria-hidden', 'true'); spak.innerHTML = '<b class="kf__spak-bage"></b><i></i>';
  scen.appendChild(spak);
  const knopp = spak.querySelector('i'), bage = spak.querySelector('.kf__spak-bage');
  let pid = null;
  const dra = e => {
    const r = spak.getBoundingClientRect(), R = r.width / 2, m = Math.max(8, R - 16);
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const l = Math.hypot(dx, dy);
    if (l > m) { dx *= m / l; dy *= m / l; }
    knopp.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    // bågen pekar åt det håll man går och lyser starkare ju längre ut kulan är
    const styrka = Math.min(1, Math.hypot(dx, dy) / m);
    bage.style.transform = 'rotate(' + (Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(1) + 'deg)';
    bage.style.opacity = styrka > 0.2 ? (0.35 + 0.65 * styrka).toFixed(2) : '0';
    try { ritare.spak(-dy / m, dx / m); } catch (err) { console.warn(err); }
  };
  const slapp = e => {
    if (pid === null || (e && e.pointerId !== undefined && e.pointerId !== pid)) return;
    pid = null; spak.classList.remove('kf__spak--drar'); knopp.style.transform = ''; bage.style.opacity = '0';
    try { ritare.spak(0, 0); } catch (err) { console.warn(err); }
  };
  spak.addEventListener('pointerdown', e => {
    if (pid !== null || !inneLage) return;
    pid = e.pointerId; e.preventDefault();
    try { spak.setPointerCapture(pid); } catch (err) { /* äldre webbläsare */ }
    spak.classList.add('kf__spak--drar'); gangRorelse(); dra(e);
  });
  spak.addEventListener('pointermove', e => { if (e.pointerId === pid) dra(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => spak.addEventListener(n, slapp));
  spak.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => slapp());
}

// ---- Verktygsraden klipps aldrig: det som inte ryms flyttas in under Mer (⋯) ----
// Raden mäts i sin naturliga bredd (klassen kf__verktyg--mat) mot scenens bredd. Först
// krymper tidsreglaget (kf__verktyg--trang), sedan flyttas knapparna en i taget, de minst
// viktiga först, till en liten meny. Se inne, Planlösning, Tomt hus och tiden står alltid kvar.
// Knapparna flyttas som de är (samma element), så klick, lägen och genvägar följer med.
(function () {
  const rad = document.querySelector('.kf__verktyg');
  if (!rad || FOTO || typeof ResizeObserver !== 'function') return;
  const grupper = rad.querySelectorAll('.kf__vgrupp'), sista = grupper[grupper.length - 1];
  if (!sista) return;
  const hall = document.createElement('div');
  hall.className = 'kf__meny kf__mer'; hall.hidden = true;
  hall.innerHTML = '<button type="button" class="kf__vk" data-mer aria-haspopup="true" aria-expanded="false" aria-controls="kf-mer" data-tips="Fler verktyg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="2.6"/></svg><span class="sr">Fler verktyg</span></button>' +
    '<div class="kf__popup kf__merlista" id="kf-mer" role="group" aria-label="Fler verktyg" hidden></div>';
  sista.appendChild(hall);
  const knapp = hall.firstChild, lista = hall.lastChild;
  // i den ordning de lämnar raden
  // (Helskärm flyttas aldrig inne på pekskärm: där är den ett framhävt val, se passa)
  // (Kör iväg står kvar längst: den syns annars inte för kunden)
  const ORDNING = ['[data-tangenter]', '[data-liv]', '[data-ladda]', '[data-snurra]', '[data-matt-knapp]', '[data-helskarm]', '[data-hjalp]', '[data-spel]', '[data-lampor]', '[data-oppna]', '[data-plan]', '[data-tomt]', '[data-bil]'];
  const poster = ORDNING.map(s => ({ sel: s, el: rad.querySelector('.kf__vk' + s) })).filter(p => p.el).map((p, i) => { const plats = document.createComment('mer' + i); p.el.after(plats); p.plats = plats; return p; });
  // radens ordning från vänster (för listan i menyn)
  const ORDNING_RAD = poster.slice().sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const oppna = pa => { pa = !!pa; if (lista.hidden === !pa) return; lista.hidden = !pa; knapp.setAttribute('aria-expanded', String(pa)); };
  // ett tryck = ett klick (inget pointerdown här, så att pekskärmen inte öppnar och stänger dubbelt)
  knapp.addEventListener('click', e => { e.stopPropagation(); visaMeny(null); oppna(lista.hidden); });
  lista.addEventListener('click', e => { if (e.target.closest('.kf__vk')) oppna(false); });
  // tryck utanför stänger direkt (även på bilden, där 3D-styrningen annars tar klicket)
  document.addEventListener('pointerdown', e => { if (!lista.hidden && !e.target.closest('.kf__mer')) oppna(false); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lista.hidden) { e.stopPropagation(); oppna(false); knapp.focus(); } }, true);
  // Mätningen görs på en osynlig kopia av raden (aldrig på den riktiga: där startade
  // flyttningarna fram och tillbaka knapparnas övergångar, och menyn hoppade).
  // Kopian får alla knappar på sina platser och sin naturliga bredd; sedan tas knapparna
  // bort ur kopian i ORDNING tills den ryms. Den riktiga raden ändras bara om resultatet ändras.
  const kopiaPost = k => {
    // platshållarna heter mer0, mer1 … efter knappens nummer (de ligger i radens ordning,
    // inte i ORDNING: förut parades de ihop fel och knappar hamnade i fel grupp i kopian)
    const plats = {}, tw = document.createTreeWalker(k, NodeFilter.SHOW_COMMENT);
    while (tw.nextNode()) if (/^mer\d+$/.test(tw.currentNode.data)) plats[tw.currentNode.data] = tw.currentNode;
    return poster.map((p, i) => ({ el: k.querySelector('.kf__vk' + p.sel), plats: plats['mer' + i] }));
  };
  const STEG = ['kf__verktyg--trang', 'kf__verktyg--ikon', 'kf__verktyg--utantid', 'kf__verktyg--utanmiljo'];
  let nuUt = null, vantar = 0;
  // korrektionen (px) som behövdes sist, för samma scenbredd och samma läge: en ny mätning
  // börjar där, annars växlade raden fram och tillbaka (flytten mätte om utan korrektionen)
  let korr = 0, korrNyckel = '';
  // Resultatet sparas per (bredd, läge, vilka knappar som syns och deras text): samma läge igen
  // (t.ex. Se inne fram och tillbaka) sätts direkt, utan kopian och dess mätningar (de tvingade
  // omlayout i en slinga, 150–550 ms per byte). Typsnittet som laddas klart tömmer minnet.
  const minnet = new Map();
  const knappSig = () => [...rad.querySelectorAll('.kf__vk')].map(e => (e.hidden ? '-' : '+') + e.textContent.trim()).sort().join('/');
  function passa(minus = null, varv = 0) {
    vantar = 0;
    const kn = rad.parentNode.clientWidth + '|' + lageNu();
    const sig = kn + '|' + knappSig();
    if (minus === null && minnet.has(sig)) {
      const m = minnet.get(sig);
      if (m.nyckel !== nuUt) { nuUt = m.nyckel; satt(m.ut, m.steg, m.tomma); }
      korr = m.korr; korrNyckel = kn;
      return;
    }
    if (minus === null) minus = kn === korrNyckel ? korr : 0;
    const cs = getComputedStyle(rad), spand = cs.translate === 'none' || cs.translate === '';
    const plats = rad.parentNode.clientWidth - (spand ? 2 * (parseFloat(cs.left) || 8) : 32) + 0.5 - minus;
    const k = rad.cloneNode(true);
    k.removeAttribute('id'); k.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    k.classList.add('kf__verktyg--mat'); k.classList.remove('kf__verktyg--trang');
    k.setAttribute('aria-hidden', 'true');
    k.style.cssText = 'visibility:hidden;pointer-events:none;animation:none;transition:none';
    const kp = kopiaPost(k), kMer = k.querySelector('.kf__mer');
    kp.forEach(p => { if (p.el && p.plats && p.el.parentNode !== p.plats.parentNode) p.plats.before(p.el); });
    kMer.hidden = true;
    STEG.forEach(c => k.classList.remove(c));
    rad.parentNode.appendChild(k);
    // grupper utan något synligt (och deras avdelare) tar ingen plats
    const kg = [...k.querySelectorAll('.kf__vgrupp')];
    const bredd = () => {
      kg.forEach(g => g.classList.remove('kf__vgrupp--tom'));
      const tom = kg.map(g => ![...g.children].some(c => c.offsetWidth > 0));
      kg.forEach((g, i) => { if (tom[i]) g.classList.add('kf__vgrupp--tom'); });
      return k.offsetWidth;
    };
    // stegen i tur och ordning: smalare reglage, knappar till Mer, Se inne som ikon, reglaget bort
    const steg = []; const ut = [];
    if (bredd() > plats) { steg.push('kf__verktyg--trang'); k.classList.add('kf__verktyg--trang'); }
    if (bredd() > plats) {
      kMer.hidden = false;
      for (let i = 0; i < kp.length && bredd() > plats; i++) {
        const e = kp[i].el;
        if (!e || e.hidden || !e.offsetWidth) continue;   // syns inte i det här läget
        // Helskärm flyttas aldrig till ⋯ (högsta prioritet): andra knappar flyttas före den
        if (e.matches('[data-helskarm]')) continue;
        e.remove(); ut.push(i);
      }
      if (!ut.length) kMer.hidden = true;
    }
    if (bredd() > plats) { steg.push('kf__verktyg--ikon'); k.classList.add('kf__verktyg--ikon'); }
    if (bredd() > plats) { steg.push('kf__verktyg--utantid'); k.classList.add('kf__verktyg--utantid'); }
    // allra trängst (inbäddad, 320 px, med Vinklar): miljöknappen, den minst viktiga, går bort
    if (bredd() > plats) { steg.push('kf__verktyg--utanmiljo'); k.classList.add('kf__verktyg--utanmiljo'); }
    bredd();
    const tomma = kg.map(g => g.classList.contains('kf__vgrupp--tom'));
    k.remove();
    const nyckel = ut.join(',') + '|' + steg.join(',') + '|' + tomma.map(Number).join('');
    if (nyckel !== nuUt) { nuUt = nyckel; satt(ut, steg, tomma); }
    // kontroll mot den riktiga raden: spiller den ändå över (kopian är aldrig exakt likadan),
    // mät om med så mycket mindre plats (högst fyra varv, så att det aldrig blir en slinga)
    // (även inne i grupperna: solgruppen får krympa på mobil, och då spillde den över i
    // grannen utan att raden själv blev bredare)
    // Mäts på knapparnas verkliga lägen (scrollWidth räknade med absolut placerade barn, t.ex.
    // tidsbubblan, och larmade fast inget låg fel): utanför raden eller ovanpå varandra
    const R = rad.getBoundingClientRect(), hoger = R.right - (parseFloat(cs.paddingRight) || 0) + 1;
    const lagen = [...rad.querySelectorAll('.kf__vk, .kf__ljusknapp, .ritare__reglage')].filter(e => e.offsetWidth && !e.closest('.kf__popup')).map(e => e.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    let over = 0;
    // (solknappen har avsiktligt negativa marginaler, -4/-6 px: grannar får gå 6 px in i varandra)
    lagen.forEach((r, i) => { over = Math.max(over, r.right - hoger); if (i) over = Math.max(over, lagen[i - 1].right - r.left - 6); });
    if (over > 1 && varv < 4) { passa(minus + over + 2, varv + 1); return; }
    korr = minus; korrNyckel = kn;
    minnet.set(sig, { nyckel, ut, steg, tomma, korr: minus });
  }
  function satt(ut, steg, tomma) {
    STEG.forEach(c => { const pa = steg.includes(c); if (rad.classList.contains(c) !== pa) rad.classList.toggle(c, pa); });
    poster.forEach((p, i) => {
      const ska = ut.includes(i);
      if (ska && p.el.parentNode !== lista) lista.appendChild(p.el);
      else if (!ska && p.el.parentNode === lista) p.plats.before(p.el);
    });
    // listans ordning: som i raden (från vänster), inte i den ordning de lämnade den
    poster.slice().sort((a, b) => ORDNING_RAD.indexOf(a) - ORDNING_RAD.indexOf(b)).forEach(p => { if (p.el.parentNode === lista) lista.appendChild(p.el); });
    rad.querySelectorAll('.kf__vgrupp').forEach((g, i) => { if (g.classList.contains('kf__vgrupp--tom') !== !!tomma[i]) g.classList.toggle('kf__vgrupp--tom', !!tomma[i]); });
    hall.hidden = !ut.length;
    if (hall.hidden) oppna(false);
  }
  // inte medan kameran åker (Se inne, produktkort): efter landningen, när datorn är ledig
  const snart = () => {
    if (vantar) return;
    vantar = 1;
    const kor = () => {
      if (ritare && kan('flyger') && ritare.flyger()) { setTimeout(kor, 180); return; }
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => passa(), { timeout: 400 });
      else requestAnimationFrame(() => passa());
    };
    kor();
  };
  new ResizeObserver(snart).observe(rad.parentNode);
  // gruppernas egen bredd (typsnittet laddas, Se inne blir Se ute, en knapp döljs): mät om.
  // Resultatet är stabilt, så flyttningarna här ger ingen ny omgång.
  const grpObs = new ResizeObserver(snart);
  rad.querySelectorAll('.kf__vgrupp').forEach(g => grpObs.observe(g));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { minnet.clear(); snart(); });
  new MutationObserver(() => { const n = lageNu(); if (n !== sistLage) { sistLage = n; snart(); } }).observe(scen, { attributes: true, attributeFilter: ['class'] });
  // en knapp som döljs eller visas (Spel, Lampor, Hjälp inne) kan ändra vad som ryms
  new MutationObserver(l => { if (l.some(r => r.target !== hall && r.target !== lista && r.target.classList && r.target.classList.contains('kf__vk'))) snart(); }).observe(rad, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  // scenens klass: bara de lägen som byter knappar (inne, tak av, plan), inte t.ex. dragningar
  let sistLage = '';
  const lageNu = () => ['kf__scen--inne', 'kf__scen--oppen', 'kf__scen--plan', 'kf__scen--klar'].map(c => scen.classList.contains(c) ? 1 : 0).join('');
  passa();
})();

// Bottenraden på mobil gömmer sig när man scrollar nedåt (så den inte ligger över innehållet)
// och glider tillbaka när man scrollar uppåt eller är nära sidans topp/botten.
(() => {
  const rad = document.querySelector('.kf__handling');
  if (!rad || INB || FOTO) return;
  const smal = matchMedia('(max-width: 860px)');
  let forra = window.scrollY;
  // Web Animations (CSS-övergångar startade inte pålitligt i alla miljöer); klassen bär slutläget
  const lugn = matchMedia('(prefers-reduced-motion: reduce)');
  const UT = 'translateY(calc(100% + 24px + env(safe-area-inset-bottom, 0px)))';
  const visa = pa => {
    if (rad.classList.contains('kf__handling--gomd') === !pa) return;
    rad.classList.toggle('kf__handling--gomd', !pa);
    if (lugn.matches || !rad.animate) return;
    rad.animate(pa ? [{ transform: UT, opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ transform: 'none', opacity: 1 }, { transform: UT, opacity: 0 }],
      { duration: pa ? 340 : 260, easing: pa ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.55, 0, 0.45, 1)' });
  };
  const kolla = () => {
    const y = window.scrollY, dy = y - forra;
    if (!smal.matches || document.documentElement.classList.contains('ritare-fyll')) { visa(true); forra = y; return; }
    const nraBotten = y + innerHeight > document.documentElement.scrollHeight - 140;
    if (y < 80 || nraBotten) visa(true);
    else if (dy > 6) visa(false);
    else if (dy < -6) visa(true);
    if (Math.abs(dy) > 6) forra = y;
  };
  addEventListener('scroll', kolla, { passive: true });   // billigt: bara scrollY och en klass
  // fokus i raden (tangentbord) visar den alltid
  rad.addEventListener('focusin', () => visa(true));
})();

// ---- Vad ingår?: sprängvyn med paketen (husritare-sprang.js) ----
// Modulen tar knappen, panelen och etiketterna; Se inne, Öppna tak och Planlösning stänger den.
if (ritare && ritare.sprang && !FOTO && !INB) {
  import('./husritare-sprang.js?v=' + MOTOR_V)
    .then(m => m.kopplaSprang({ ritare, scen, knapp: document.querySelector('[data-vadingar]'), tillUte: () => bytLage('ute'), lage: vyLage }))
    .catch(e => console.warn('sprängvyn', e));
}

// ---- Produktkorten: välj en del (listan i panelen, taket i bilden), kameran åker dit ----
// Ute: närbild i motorn (ritare.produkt). Inne: in genom dörren till rätt rum, sedan fram till
// saken. Kortet visas när kameran närmar sig och stängs med X, Esc eller ett klick utanför.
var prodAker = false;   // var: aka() frågar innan raden körts
let prodKort = null, prodSenast = null, prodJobb = 0;
let prodListaVisa = null;   // sätts av produktLista(): markerar raden och öppnar dess grupp
const PROD_RUMVY = { wc: /bad/i, dusch: /bad/i, komod: /bad/i, kylfrys: /kök/i, ugn: /kök/i, flakt: /kök/i, mikro: /kök/i, kok: /kök/i, innerdorr: /hall|korridor/i, trappa: /kök|allrum/i };
const prodSynlig = P => (!P.loft || harLoft()) && (!P.modeller || P.modeller.includes(val.modell));   // trappan bara i hus med loft, mikron bara där den finns
let prodFok = null, prodPa = false;
// Esc medan kameran ännu åker dit (kortet syns inte än): avbryt valet
document.addEventListener('keydown', e => { if (e.key === 'Escape' && prodPa && prodKort && !prodKort.oppen()) { e.stopPropagation(); e.preventDefault(); stangProdukt(false); } }, true);
// genomskärningen (isolering, underlagsduk) och fokusramen bort
function prodStad(snittOcksa = true) {
  if (prodFok) prodFok.gom();
  const sv = ritare && ritare.sprangVy;
  if (snittOcksa && sv && sv.snittStang) { try { sv.snittStang(); } catch (e) { console.warn(e); } }
}
// bildens fria del (andelar): kortet ligger nere till vänster i bilden på bred skärm, verktygsraden nederst
function prodFri() {
  const W = scen.clientWidth, H = scen.clientHeight;
  if (!W || !H) return null;
  const y0 = Math.min(0.2, 64 / H), y1 = Math.max(0.7, (H - 96) / H);
  if (matchMedia('(max-width: 600px)').matches || W < 760) return { x0: 0.04, x1: 0.96, y0, y1 };
  return { x0: Math.min(0.5, (Math.min(360, W - 32) + 36) / W), x1: 1 - 20 / W, y0, y1 };
}
// fokusramen när kameran landat
function prodFokus(jobb) {
  if (!prodFok) prodFok = skapaFokus(scen);
  const t0 = performance.now();
  const f = () => {
    if (jobb !== prodJobb) return;
    const ror = (kan('flyger') && ritare.flyger()) || (kan('upptagen') && ritare.upptagen()) || (kan('gar') && ritare.gar());
    if (ror) { if (performance.now() - t0 < 7000) setTimeout(f, 90); return; }
    const r = kan('produktRuta') && ritare.produktRuta();
    if (r && !r.bakom) prodFok.visa(r);
  };
  setTimeout(f, 150);
}
// listans ordning (grupperna Ute, Stomme, Inne, Kök, Badrum) och dess filter styr Föregående/Nästa
const prodOrdning = () => {
  const rader = [...document.querySelectorAll('[data-produkter] .kprodval:not([hidden])')].map(b => b.getAttribute('data-produkt'));
  const alla = OMRADEN.flatMap(o => o[2]).map(id => PRODUKTER.find(p => p.id === id)).filter(p => p && prodSynlig(p)).map(p => p.id);
  return rader.length && prodKort && rader.includes(prodKort.id()) ? rader : alla;
};
const vantaMotor = (max = 12000) => new Promise(r => {
  const t0 = performance.now();
  const f = () => { if (performance.now() - t0 > max || !(kan('flyger') && ritare.flyger()) && !(kan('arOppen') && ritare.arOppen()) && !(kan('upptagen') && ritare.upptagen())) r(); else setTimeout(f, 120); };
  f();
});
function stangProdukt(tyst) {
  prodJobb++;
  prodStad();
  // på väg (kortet syns ännu inte): målet släpps ändå, kameran stannar där den är
  if (prodPa && !(prodKort && prodKort.oppen())) { prodPa = false; if (kan('produktSlut')) { try { ritare.produktSlut(); } catch (e) { console.warn(e); } } document.querySelectorAll('[data-produkt]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  prodPa = false;
  if (!prodKort || !prodKort.oppen()) return;
  prodKort.dolj();
  if (kan('produktSlut')) { try { ritare.produktSlut(); } catch (e) { console.warn(e); } }
  document.querySelectorAll('[data-produkt]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (!tyst && prodSenast && prodSenast.isConnected) prodSenast.focus({ preventScroll: true });
}
async function oppnaProdukt(id, kalla) {
  const P = PRODUKTER.find(p => p.id === id);
  if (!P || !ritare || !kan('produkt') || FOTO) return;
  if (!prodKort) {
    prodKort = skapaKort(scen, {
      vidStang: () => stangProdukt(false),
      vidByt: steg => { const l = prodOrdning(), i = l.indexOf(prodKort.id()), n = l[(i + steg + l.length) % l.length]; if (n) oppnaProdukt(n, document.querySelector('[data-produkter] .kprodval[data-produkt="' + n + '"]') || prodSenast); },
    });
  }
  const jobb = ++prodJobb;
  prodPa = true;
  prodKort.halla();
  prodStad(!P.snitt);   // byte till en annan del: snittet stängs (till en annan dold del: byts i ett svep)
  if (kalla) prodSenast = kalla;
  document.querySelectorAll('[data-produkt]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-produkt') === id)));
  if (prodListaVisa) prodListaVisa(id, !!(kalla && kalla.closest && kalla.closest('[data-produkter]')));
  // på mobil ligger listan under bilden: bilden upp i fönstret först
  // (smal skärm: bilden överst, kortet är en bottenpanel under den)
  const r = scen.getBoundingClientRect(), smalSk = matchMedia('(max-width: 600px)').matches;
  if (kalla && (smalSk ? Math.abs(r.top - 72) > 24 : r.bottom < 120 || r.top > innerHeight - 160)) {
    if (smalSk) window.scrollTo({ top: Math.max(0, scrollY + r.top - 72), behavior: lugn() ? 'auto' : 'smooth' });
    else scen.scrollIntoView({ behavior: lugn() ? 'auto' : 'smooth', block: 'center' });
  }
  snurrPa = false; sn.setAttribute('aria-pressed', 'false'); if (kan('snurra')) ritare.snurra(false);
  if (planLage) { sattPlan(false, true); ritaLagesknappar(); }
  if (P.plats === 'inne' && kanInne) {
    if (!inneLage) {
      if (oppetLage) sattOppen(false, true);
      const l = inneVyer(), re = PROD_RUMVY[id], i = re ? l.findIndex(v => v && re.test(v.namn || '')) : -1;
      prodAker = true;
      try { await sattInne(true, i >= 0 ? i : 0, DORR); } finally { prodAker = false; }
      ritaLagesknappar();
    }
  } else if (inneLage) {
    prodAker = true;
    try { await sattInne(false, undefined, TONA); } finally { prodAker = false; }
    ritaLagesknappar();
  } else if (oppetLage) { sattOppen(false); ritaLagesknappar(); }
  await vantaMotor();
  if (jobb !== prodJobb) return;
  let svar = false;
  const opt = { fri: prodFri() };
  // dolda delar: en genomskärning i väggen eller taket öppnas, kameran åker till den
  if (P.snitt && ritare.sprangVy && ritare.sprangVy.snitt) { try { const r = ritare.sprangVy.snitt(id); if (r) opt.ram = r; } catch (e) { console.warn(e); } }
  // motorn tackar nej medan kameran fortfarande åker (förra klicket) eller huset byggs: försök igen tills den
  // är ledig (högst ~2,5 s) i stället för att klicket försvinner ("ibland händer inget")
  for (let f = 0; f < 32 && jobb === prodJobb; f++) {
    try { svar = ritare.produkt(id, opt); } catch (e) { console.warn(e); }
    if (svar || !((ritare.flyger && ritare.flyger()) || (ritare.upptagen && ritare.upptagen()))) break;
    await new Promise(r => setTimeout(r, 80));
  }
  if (jobb !== prodJobb) return;
  if (svar) prodFokus(jobb);
  if (svar && svar.ute) { nuVy = null; markeraTumme(null); }
  // kortet när kameran närmar sig (åkningen tar cirka 1,2 s)
  setTimeout(() => { if (jobb === prodJobb) prodKort.visa(P, !!kalla); }, lugn() ? 0 : svar ? 520 : 0);
}
(function produktLista() {
  const ruta = document.querySelector('[data-produkter]');
  if (!ruta || FOTO || !kan('produkt')) { if (ruta) ruta.closest('.kgrupp').hidden = true; return; }
  const PKORT = { klimat: 'Klimatskal', nyckel: 'Nyckelfärdig' };
  const PVALT = { stomme: 'Prefab stomme', klimat: 'Klimatskal', nyckel: 'Nyckelfärdig', entreprenad: 'Nyckelfärdig entreprenad' };
  const PILH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
  const PILN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const minne = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const smal = () => matchMedia('(max-width: 860px)').matches;
  // valt paket från pristeamet: ?paket= i adressen eller sparat val (prefab-stomme, klimatskal,
  // nyckelfardig, nyckelfardig-entreprenad, och de gamla korta klimat/nyckel)
  const valtPaketNamn = () => {
    let v = null;
    try { v = new URLSearchParams(location.search).get('paket'); } catch (e) {}
    if (!v) v = minne('idealhus-paket');
    v = String(v || '').toLowerCase();
    return /^(prefab|stomme)/.test(v) ? 'stomme' : /^klimat/.test(v) ? 'klimat' : /^nyckel.*entrepren/.test(v) ? 'entreprenad' : /^nyckel/.test(v) ? 'nyckel' : null;
  };
  // för listan räcker tre nivåer: entreprenaden innehåller allt som nyckelfärdigt
  const valtPaket = () => { const n = valtPaketNamn(); return n === 'entreprenad' ? 'nyckel' : n; };
  // prefab stomme: allt i listan är tillval; klimatskal: det nyckelfärdiga är tillval
  const arTillval = (P, vp) => vp === 'stomme' || (vp === 'klimat' && P.paket === 'nyckel');
  let filter = 'alla', oppen = minne('idealhus-prodgrupp') || 'ute';
  const omradeFor = id => (OMRADEN.find(o => o[2].includes(id)) || [])[0];
  // paketetiketten för en rad: [klass, text]
  const taggFor = P => {
    const vp = valtPaket(), tillval = arTillval(P, vp);
    return [tillval ? 'tillval' : P.paket, vp ? (tillval ? 'Tillval' : 'Ingår') : PKORT[P.paket]];
  };
  const taggHtml = ([k, t]) => '<span class="kprodval__tagg kprodval__tagg--' + k + '">' + t + '</span>';
  const rad = P => {
    const vp = valtPaket(), tillval = arTillval(P, vp);
    const logga = P.marke ? loggaBild(P.marke, 'kprodval__logga') : '';
    return '<button type="button" class="kprodval' + (tillval ? ' kprodval--tillval' : '') + '" data-produkt="' + P.id + '" data-paket="' + P.paket + '" aria-pressed="false">' +
      '<span class="kprodval__ikon">' + (PROD_IKON[P.id] || '') + '</span>' +
      '<span class="kprodval__text"><b>' + esc(P.del) + '</b>' + (P.marke ? (logga ? '<small class="kprodval__marke" data-logga-hel>' + logga + '</small>' : '<small>' + esc(P.marke) + '</small>') : '<small class="kprodval__ingar">' + (tillval ? 'Tillval' : 'Ingår i ' + PKORT[P.paket]) + '</small>') + '</span>' +
      taggHtml(taggFor(P)) +
      '<span class="kprodval__pil">' + PILH + '</span></button>';
  };
  const filtrera = () => {
    ruta.querySelectorAll('.kprodval__filter').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === filter)));
    ruta.querySelectorAll('.kprodgrupp').forEach(g => {
      let n = 0;
      g.querySelectorAll('.kprodval').forEach(b => { const syns = filter === 'alla' || b.getAttribute('data-paket') === filter; b.hidden = !syns; if (syns) n++; });
      g.hidden = !n;
      const t = g.querySelector('[data-antal]'); if (t) t.textContent = n;
    });
  };
  const oppna = (o, spara) => {
    oppen = o;
    if (spara) minne('idealhus-prodgrupp', o);
    ruta.querySelectorAll('.kprodgrupp').forEach(g => {
      const ja = g.getAttribute('data-omrade') === o;
      g.classList.toggle('kprodgrupp--oppen', ja);
      const rb = g.querySelector('.kprodgrupp__rubrik');
      rb.setAttribute('aria-expanded', String(ja || smal()));
      rb.tabIndex = smal() ? -1 : 0;   // smal skärm: rubriken är bara en etikett över chip-raden
    });
  };
  const rita = () => {
    const vp = valtPaket();
    ruta.innerHTML =
      '<div class="kprodval__filtren" role="group" aria-label="Visa paket">' +
        [['alla', 'Alla'], ['klimat', 'Klimatskal'], ['nyckel', 'Nyckelfärdig']].map(([f, t]) => '<button type="button" class="kprodval__filter" data-filter="' + f + '" aria-pressed="false">' + t + '</button>').join('') + '</div>' +
      (vp ? '<p class="kprodval__paketnot">Du har valt <b>' + PVALT[valtPaketNamn()] + '</b>' + (vp === 'stomme' ? '. Allt i listan är tillval.' : vp === 'klimat' ? '. Det nedtonade är tillval.' : '. Allt i listan ingår.') + '</p>' : '') +
      OMRADEN.map(([o, namn, ids]) => {
        const lista = ids.map(id => PRODUKTER.find(p => p.id === id)).filter(p => p && prodSynlig(p));
        if (!lista.length) return '';
        const marken = [...new Set(lista.map(p => p.marke).filter(Boolean))].join(' · ');
        // samma paket på alla rader: etiketten en gång i rubriken i stället för på varje rad
        const taggar = lista.map(taggFor), en = taggar.every(t => t[0] === taggar[0][0] && t[1] === taggar[0][1]);
        return '<section class="kprodgrupp' + (en ? ' kprodgrupp--entagg' : '') + '" data-omrade="' + o + '">' +
          '<button type="button" class="kprodgrupp__rubrik" aria-expanded="false" aria-controls="kprod-' + o + '"><span class="kprodgrupp__namn">' + esc(namn) + '</span>' +
          '<span class="kprodgrupp__marken">' + esc(marken) + '</span>' + (en ? taggHtml(taggar[0]).replace('kprodval__tagg ', 'kprodval__tagg kprodgrupp__tagg ') : '') + '<span class="kprodgrupp__antal" data-antal>' + lista.length + '</span>' + PILN + '</button>' +
          '<div class="kprodval__rad" id="kprod-' + o + '" role="group" aria-label="' + esc(namn) + '">' + lista.map(rad).join('') + '</div></section>';
      }).join('');
    loggaReserv(ruta, m => { const e = document.createElement('small'); e.textContent = m; return e; });
    filtrera();
    if (!ruta.querySelector('.kprodgrupp[data-omrade="' + oppen + '"]')) oppen = 'ute';
    oppna(oppen);
  };
  rita();
  // siktnätet för kameran (motorn) byggs när pekaren når listan, när datorn är ledig
  ruta.addEventListener('pointerenter', () => { const f = () => { if (kan('produktForbered')) ritare.produktForbered(); }; if ('requestIdleCallback' in window) requestIdleCallback(f, { timeout: 800 }); else setTimeout(f, 200); });
  // markera öppen produkt: öppna dess grupp och scrolla raden in i vy
  // (smal skärm: bara sidledes i chip-raden, sidan ligger still så bilden syns)
  prodListaVisa = (id, franListan) => {
    const o = omradeFor(id), b = ruta.querySelector('.kprodval[data-produkt="' + id + '"]');
    if (!b || !o) return;
    if (b.hidden) { filter = 'alla'; filtrera(); }
    if (o !== oppen) oppna(o, true); else minne('idealhus-prodgrupp', o);
    const r = b.parentElement, beteende = lugn() ? 'auto' : 'smooth';
    requestAnimationFrame(() => {
      if (smal()) {
        const v = b.offsetLeft - r.offsetLeft;
        if (v < r.scrollLeft || v + b.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollTo({ left: Math.max(0, v - (r.clientWidth - b.offsetWidth) / 2), behavior: beteende });
      } else if (!franListan) {
        const br = b.getBoundingClientRect(), topp = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k-topp')) || 96;
        if (br.top < topp || br.bottom > innerHeight - 16) b.scrollIntoView({ block: 'nearest', behavior: beteende });
      }
    });
  };
  ruta.addEventListener('click', e => {
    const f = e.target.closest('.kprodval__filter');
    if (f) { filter = f.getAttribute('data-filter'); filtrera(); return; }
    const g = e.target.closest('.kprodgrupp__rubrik');
    if (g) { if (smal()) return; const o = g.closest('.kprodgrupp').getAttribute('data-omrade'); oppna(o === oppen ? '' : o, true); return; }
    const b = e.target.closest('[data-produkt]'); if (b) oppnaProdukt(b.getAttribute('data-produkt'), b);
  });
  // tangentbord: pilarna går mellan rubriker och rader i listans ordning, Enter/mellanslag öppnar
  ruta.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('.kprodval__filtren')) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const fl = [...ruta.querySelectorAll('.kprodval__filter')], i = fl.indexOf(e.target);
      fl[(i + (e.key === 'ArrowRight' ? 1 : -1) + fl.length) % fl.length].focus(); e.preventDefault(); return;
    }
    const alla = [...ruta.querySelectorAll('.kprodgrupp__rubrik, .kprodval')].filter(x => x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden' && x.tabIndex >= 0);
    const i = alla.indexOf(document.activeElement);
    if (i < 0) return;
    // på datorn öppnar höger och stänger vänster en grupp från dess rubrik
    if (!smal() && e.target.classList.contains('kprodgrupp__rubrik') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const o = e.target.closest('.kprodgrupp').getAttribute('data-omrade');
      oppna(e.key === 'ArrowRight' ? o : (o === oppen ? '' : oppen), true); e.preventDefault(); return;
    }
    const fram = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? alla.length - 1 : Math.min(alla.length - 1, Math.max(0, i + (fram ? 1 : -1)));
    const m = alla[n];
    m.focus({ preventScroll: smal() });
    if (smal()) { const r = m.closest('.kprodval__rad'); if (r) { const v = m.offsetLeft - r.offsetLeft; if (v < r.scrollLeft || v + m.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = v - 16; } }
    e.preventDefault();
  });
  // pristeamets paketval: läs om när det ändras (eget event, annan flik eller bakåt i historiken)
  const omPaket = () => {
    const pa = prodKort && prodKort.oppen() ? prodKort.id() : null;
    rita();
    if (pa) { document.querySelectorAll('[data-produkt]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-produkt') === pa))); prodListaVisa(pa, true); }
  };
  ['husritare:paket', 'popstate'].forEach(t => addEventListener(t, omPaket));
  addEventListener('storage', e => { if (e.key === 'idealhus-paket') omPaket(); });
  matchMedia('(max-width: 860px)').addEventListener('change', () => oppna(oppen));
  // taket och fönstren: en genväg i deras färggrupper
  [['tak', 'tak', 'Om takplåten'], ['detalj', 'fonster', 'Om fönstren']].forEach(([g, id, text]) => {
    const sek = document.querySelector('.kgrupp[data-grupp="' + g + '"] .kgrupp__text'), P = PRODUKTER.find(p => p.id === id);
    if (!sek || !P) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kgrupp__produkt'; b.setAttribute('data-produkt', id);
    b.innerHTML = '<span>' + text + ':</span> <b>' + esc(P.marke + (P.modell ? ' ' + P.modell : '')) + '</b>';
    b.addEventListener('click', () => oppnaProdukt(id, b));
    sek.after(b);
  });
  // husbyte: trappan finns bara i hus med loft
  document.querySelectorAll('input[name="modell"]').forEach(r => r.addEventListener('change', () => { stangProdukt(true); setTimeout(rita, 0); }));
})();
