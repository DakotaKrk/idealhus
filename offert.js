// Offertsidan (offert.html): sista steget i Bygg online. Huset kommer från ritaren via
// sessionStorage (bygg-offert: kundens vy som stillbild, namn, paket och alla val); saknas det
// (direkt länk, privat läge) läses modell, paket och ritat ur adressen.
// Bilden: studiobilden från ritaren (husritare-app.js, bygg-offert.produkt) som platshållare, sedan
// en levande 3D-modell av samma hus i ritarens motor i studioläge (se "live 3D" längst ned).
// "Din vy" visar vinkeln kunden hade i ritaren.
// Skicka: ingen extern tjänst, besökarens e-postprogram öppnas med förfrågan ifylld (mailto).
// Sätts FORM_ENDPOINT någon gång skickas förfrågan i bakgrunden i stället.
import { PAKET, prisText, giltigt, STANDARD_PAKET } from './husritare-pris.js?v=20261126t';

const FORM_ENDPOINT = '';
const FORM_MOTTAGARE = 'info@legohusstockholm.se';
const $ = (s, r = document) => r.querySelector(s);
const H = document.documentElement;
const lugn = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// modellerna: namn, bild i images/hus3d, nyckel i prislistan, yta och mått (husritare.js HUS)
const MODELLER = {
  'kupa-30': ['Kupa 30', 'sadel-30', 'kupa-30', 30, '7,5 × 4 m'], 'sadel-30': ['Kupa 30', 'sadel-30', 'kupa-30', 30, '7,5 × 4 m'],
  'kupa-40': ['Kupa 40', 'sadel-40', 'kupa-40', 40, '10 × 4 m'], 'sadel-40': ['Kupa 40', 'sadel-40', 'kupa-40', 40, '10 × 4 m'],
  'sadel-50': ['Sadel 50', 'sadel-50', 'sadel-50', 50, '12,5 × 4 m'],
  'pulpet-70': ['Pulpet 70', 'pulpet-70', 'pulpet-70', 70, '10 × 7 m'],
  'sadel-90': ['Sadel 90', 'sadel-90', 'sadel-90', 90, '12 × 7 m'],
};
// kulörerna med namn (husritare.js FARGER), för direkta länkar där bara namnet står i ritat
const KULORER = {
  Fasad: { 'Svart': '#232220', 'Falu rödfärg': '#7b2c22', 'Mossgrön': '#3d4a31', 'Gråblå': '#6c7a88', 'Grånad gran': '#9b8f80', 'Ljusgrå': '#c3c0b7', 'Vit': '#e9e6de' },
  Tak: { 'Svart': '#252628', 'Antracit': '#3c3f43', 'Grå': '#7f8388', 'Röd': '#842620', 'Tegelröd': '#9a4529' },
  'Fönster och plåt': { 'Svart': '#1e1e1d', 'Vit': '#ecebe6', 'Grågrön': '#8d968a', 'Salvia': '#a8b399', 'Beige': '#d9cdb5', 'Röd': '#7b2c22' },
};
// vad som ingår i varje paket (samma lista som sprängvyn "Vad ingår?" i husritare-sprang.js)
const INGAR = [
  { intro: '', delar: [['Väggelement 170 mm', 'Med ytterpanel'], ['Takkassetter', 'Med råspont och papp'], ['Bjälklag/loft'], ['Innerväggsstomme']], not: 'Levereras vid tomtgräns.' },
  { intro: 'Allt i Prefab stomme, och dessutom:', delar: [['Isolering', 'Rockwool/Isover el. likv.'], ['Fönster', 'Elitfönster/NorDan el. likv.'], ['Ytterdörr', 'Elitfönster/NorDan el. likv.'], ['Plåttak med takavvattning', 'Plannja/Areco el. likv.'], ['Montering']] },
  { intro: 'Allt i Klimatskal, och dessutom:', delar: [['El och VVS'], ['Invändig panel', 'Moelven el. likv.'], ['Innerdörrar', 'Swedoor el. likv.'], ['Golv', 'Kährs/Parador el. likv.'], ['Kök och vitvaror', 'Siemens/Electrolux'], ['Badrum', 'Svedbergs el. likv.'], ['Transport och kranlyft'], ['Slutkontroll']] },
  { intro: 'Allt i Nyckelfärdig modul, och dessutom:', delar: [['Bygglov/bygganmälan'], ['Mark och grund', 'Enligt avtal'], ['Inkoppling el och VA'], ['Slutbesiktning'], ['Ansvarsförsäkring']] },
];

// ---- läget: sparat från ritaren, annars adressen ----
const q = new URLSearchParams(location.search);
let data = null;
try { data = JSON.parse(sessionStorage.getItem('bygg-offert') || 'null'); } catch (e) { data = null; }
const modellQ = q.get('modell') || (data && data.modell) || 'kupa-40';
if (data && q.get('modell') && data.modell && data.modell !== q.get('modell')) data = null;   // ett annat hus än det sparade
const M = MODELLER[modellQ] || MODELLER['kupa-40'];
const paket = giltigt(q.get('paket')) ? q.get('paket') : (data && giltigt(data.paket) ? data.paket : STANDARD_PAKET);
const stegNr = Math.max(0, PAKET.findIndex(p => p.id === paket));
const P = PAKET[stegNr];
const pris = prisText(M[2], paket);   // priserna: husritare-pris.js (kalkylen, inkl. moms)
const ritat = (data && data.ritat) || q.get('ritat') || '';
const hus = {
  namn: (data && data.namn) || M[0],
  paketNamn: P.namn,
  pris,
  adress: (data && data.adress) || ('rita-hus.html?modell=' + encodeURIComponent(modellQ) + '&paket=' + encodeURIComponent(paket)),
  vy: (data && data.bild) || '',
  produkt: (data && data.produkt) || '',   // studiobilden, tagen i ritaren vid Begär offert
};
const rader = (data && Array.isArray(data.rader) && data.rader.length) ? data.rader
  : ritat ? ritat.replace(/^Från husritaren:\s*/, '').split(/\.\s+/).filter(Boolean).map(t => { const i = t.indexOf(':'); return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1).replace(/\.$/, '').trim(), ''] : ['Hus', t.replace(/\.$/, ''), '']; }) : [];

// ---- sammanfattningen ----
$('[data-off-namn]').textContent = hus.namn;
const storlek = (rader.find(r => r[0] === 'Storlek') || [])[1] || (M[3] + ' m² · ' + M[4]);
const rum = (rader.find(r => r[0] === 'Rum') || [])[1];
$('[data-off-matt]').innerHTML = storlek.split(/\s*·\s*/).concat(rum ? rum.split(/,\s*/).map((t, i) => (i === 0 && /^\d+ st$/.test(t) ? t.replace(' st', ' rum') : t)) : []).map(t => '<span>' + esc(t) + '</span>').join('');
$('[data-off-paket]').textContent = hus.paketNamn;
const fran = /^från /.test(pris);
$('[data-off-fran]').hidden = !fran;
$('[data-off-pris]').textContent = pris.replace(/^från /, '');
$('[data-off-pris]').closest('.off-pris__belopp').classList.toggle('off-pris__belopp--fraga', !/kr/.test(pris));
$('[data-off-moms]').textContent = /kr/.test(pris) ? 'Inkl. moms. Frakt tillkommer enligt zon.' : 'Priset räknar vi fram i offerten, inkl. moms.';
const I = INGAR[stegNr];
$('[data-off-ingar-intro]').textContent = I.intro;
$('[data-off-ingar-intro]').hidden = !I.intro;
$('[data-off-ingar]').innerHTML = I.delar.map(([t, s]) => '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><span>' + esc(t) + (s ? '<small>' + esc(s) + '</small>' : '') + '</span></li>').join('') +
  (I.not ? '<li class="off-ingar__not"><span>' + esc(I.not) + '</span></li>' : '');
const kulorRader = rader.filter(r => r[2] || KULORER[r[0]]);
$('[data-off-kulorer]').innerHTML = kulorRader.map(([dt, dd, f]) => {
  const hex = f || (KULORER[dt] && KULORER[dt][dd]) || '';
  return '<li><i style="--f:' + esc(hex || 'transparent') + '"' + (hex ? '' : ' class="off-kulorer__tom"') + '></i><span><small>' + esc(dt) + '</small>' + esc(dd) + '</span></li>';
}).join('');
const DOLJ = ['Hus', 'Storlek', 'Rum', 'Paket', 'Miljö', 'Ljus'];
const ovriga = rader.filter(r => !r[2] && !KULORER[r[0]] && !DOLJ.includes(r[0]));
if (ovriga.length) { const o = $('[data-off-ovrigt]'); o.hidden = false; o.innerHTML = ovriga.map(([dt, dd]) => '<div><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>').join(''); }
if (!kulorRader.length && !ovriga.length) $('[data-off-kulor-del]').hidden = true;

document.querySelectorAll('[data-off-andra], [data-off-tillbaka]').forEach(a => {
  a.href = hus.adress;
  // tillbaka i historiken när man kom från ritaren (då står ritaren kvar som den var)
  a.addEventListener('click', e => {
    let franRitaren = false;
    try { franRitaren = !!document.referrer && new URL(document.referrer).origin === location.origin && /rita-hus\.html/.test(new URL(document.referrer).pathname); } catch (x) { franRitaren = false; }
    if (franRitaren && history.length > 1 && !H.classList.contains('off-klar')) { e.preventDefault(); history.back(); }
  });
});

// ---- bilden: studiobild från ritaren > kundens vy > modellens foto (platshållare för 3D-vyn) ----
const bild = $('[data-off-bild]'), bildNy = $('[data-off-bild-ny]'), scen = $('[data-off-scen]');
const altHus = hus.namn + ' i dina kulörer';
const vyer = { produkt: hus.produkt, kund: hus.vy };
function visaBild(src, alt) {
  bild.alt = alt;
  if (bild.getAttribute('src') === src) return;
  bild.src = src;
}
bild.addEventListener('load', () => scen.classList.add('off-scen--syns'));
if (hus.produkt) {
  visaBild(hus.produkt, hus.namn + ' i dina kulörer');
  if (hus.vy) $('[data-off-vyer]').hidden = false;
  H.dataset.offBild = 'produkt';
} else visaBild(hus.vy || 'images/hus3d/' + M[1] + '.webp', hus.vy ? hus.namn + ', din vy från ritaren' : hus.namn);
if (bild.complete && bild.naturalWidth) scen.classList.add('off-scen--syns');

// Byt bild med en mjuk övertoning (den nya bilden läggs ovanpå och tonas in)
function tonaTill(src, alt) {
  return new Promise(klar => {
    if (lugn()) { visaBild(src, alt); klar(); return; }
    bildNy.onload = () => {
      bildNy.hidden = false;
      bildNy.getBoundingClientRect();
      scen.classList.add('off-scen--byter');
      setTimeout(() => { visaBild(src, alt); bildNy.hidden = true; scen.classList.remove('off-scen--byter'); bildNy.removeAttribute('src'); klar(); }, 420);
    };
    bildNy.onerror = () => klar();
    bildNy.src = src;
  });
}
const vyKnappar = [...document.querySelectorAll('[data-off-vy]')];
vyKnappar.forEach(k => k.addEventListener('click', () => {
  const vad = k.dataset.offVy;
  if (k.getAttribute('aria-pressed') === 'true') return;
  if (visaVy(vad)) { vyKnappar.forEach(b => b.setAttribute('aria-pressed', String(b === k))); return; }
  if (!vyer[vad]) return;
  vyKnappar.forEach(b => b.setAttribute('aria-pressed', String(b === k)));
  tonaTill(vyer[vad], vad === 'kund' ? hus.namn + ', din vy från ritaren' : altHus);
}));

const vanta = ms => new Promise(r => setTimeout(r, ms));

// Formulärkortet klistras under topraden. Är det högre än fönstret (fel, liten skärm) får det
// i stället följa med sidan och stanna med nederkanten synlig: top blir negativt.
const kortet = $('[data-off-kort]');
function klister() {
  const topp = $('.off-topp').offsetHeight;
  const h = kortet.offsetHeight;
  kortet.style.setProperty('--o-klister', Math.min(topp + 24, innerHeight - h - 24) + 'px');
}
if ('ResizeObserver' in window) new ResizeObserver(klister).observe(kortet);
addEventListener('resize', klister);
klister();

// ---- formuläret: utkastet sparas i fliken, inline-validering, samma utskick som kontaktsidan ----
const form = $('[data-off-form]'), felRuta = $('[data-off-fel]'), knapp = $('[data-off-skicka]');
const UTKAST = 'bygg-offert-utkast';
try { const u = JSON.parse(sessionStorage.getItem(UTKAST) || '{}'); Object.entries(u).forEach(([k, v]) => { const f = form.elements[k]; if (!f || k === '_honey') return; if (f.type === 'checkbox') f.checked = !!v; else f.value = v; }); } catch (e) { /* inget utkast */ }
function sparaUtkast() {
  const u = {};
  ['namn', 'epost', 'telefon', 'plats', 'start', 'meddelande', 'samtycke'].forEach(k => { const f = form.elements[k]; u[k] = f.type === 'checkbox' ? f.checked : f.value; });
  try { sessionStorage.setItem(UTKAST, JSON.stringify(u)); } catch (e) { /* privat läge */ }
}
const KRAV = {
  namn: f => (f.value.trim() ? '' : 'Skriv ditt namn.'),
  epost: f => (!f.value.trim() ? 'Skriv din e-postadress.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim()) ? '' : 'E-postadressen ser ofullständig ut, till exempel namn@exempel.se.'),
  telefon: f => (!f.value.trim() || /^[+\d][\d\s()-]{5,}$/.test(f.value.trim()) ? '' : 'Telefonnumret ska bara ha siffror, gärna med riktnummer.'),
  samtycke: f => (f.checked ? '' : 'Kryssa i rutan så att vi får höra av oss.'),
};
function visaFel(f, text) {
  const ruta = f.closest('.off-falt');
  let p = ruta.querySelector('.off-falt__fel');
  if (!text) {
    ruta.classList.remove('off-falt--fel'); f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby');
    if (p) { p.classList.add('off-falt__fel--ut'); setTimeout(() => { if (p.classList.contains('off-falt__fel--ut')) p.remove(); }, lugn() ? 0 : 160); }
    if (f.value && f.type !== 'checkbox' && KRAV[f.name]) ruta.classList.add('off-falt--ok');
    return;
  }
  ruta.classList.remove('off-falt--ok');
  ruta.classList.add('off-falt--fel'); f.setAttribute('aria-invalid', 'true');
  if (!p) { p = document.createElement('span'); p.className = 'off-falt__fel'; p.id = 'fel-' + f.name; ruta.appendChild(p); }
  p.classList.remove('off-falt__fel--ut');
  p.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>' + esc(text);
  f.setAttribute('aria-describedby', p.id);
}
const kolla = f => { const k = KRAV[f.name]; const t = k ? k(f) : ''; visaFel(f, t); return t; };
Object.keys(KRAV).forEach(n => {
  const f = form.elements[n];
  f.addEventListener('blur', () => { if (f.value || f.getAttribute('aria-invalid')) kolla(f); });
  f.addEventListener('input', () => { if (f.getAttribute('aria-invalid')) kolla(f); else f.closest('.off-falt').classList.remove('off-falt--ok'); });
  f.addEventListener('change', () => { if (f.type === 'checkbox' || f.getAttribute('aria-invalid')) kolla(f); });
});
form.addEventListener('input', sparaUtkast);
form.addEventListener('change', sparaUtkast);

const v = n => (form.elements[n] && form.elements[n].value ? form.elements[n].value.trim() : '');
function brodtext() {
  return [
    'Offertförfrågan från Bygg online',
    '',
    'Hus: ' + hus.namn + ' (' + storlek + ')',
    'Paket: ' + hus.paketNamn + ' (' + hus.pris + ')',
    ...rader.filter(r => !['Hus', 'Paket', 'Storlek'].includes(r[0])).map(r => r[0] + ': ' + r[1]),
    '',
    'Namn: ' + v('namn'),
    'E-post: ' + v('epost'),
    'Telefon: ' + (v('telefon') || '-'),
    'Kommun eller adress: ' + (v('plats') || '-'),
    'Önskad byggstart: ' + (v('start') || '-'),
    '',
    v('meddelande') || '(inget meddelande)',
    '',
    'Länk till huset: ' + new URL(hus.adress.replace(/[?&]prov=1/, ''), location.href).href,
  ].join('\n');
}
const amne = () => 'Offertförfrågan: ' + hus.namn + ' · ' + P.kort + ' – ' + v('namn');
const mailto = () => 'mailto:' + FORM_MOTTAGARE + '?subject=' + encodeURIComponent(amne()) + '&body=' + encodeURIComponent(brodtext());

function laddar(pa) {
  knapp.disabled = pa;
  knapp.classList.toggle('off-skicka--laddar', pa);
  knapp.setAttribute('aria-busy', String(pa));
  $('[data-off-lage]').textContent = pa ? 'Förfrågan förbereds' : '';
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (knapp.disabled) return;
  const fel = Object.keys(KRAV).map(n => form.elements[n]).filter(f => kolla(f));
  if (fel.length) {
    felRuta.textContent = fel.length === 1 ? 'Ett fält behöver ses över.' : fel.length + ' fält behöver ses över.';
    felRuta.hidden = false;
    felRuta.classList.remove('off-form__fel--puls'); void felRuta.offsetWidth; felRuta.classList.add('off-form__fel--puls');
    fel[0].focus();
    return;
  }
  felRuta.hidden = true;
  if (form.elements._honey.value) { tack(true); return; }   // lockbetet: tyst som skickat
  laddar(true);
  if (FORM_ENDPOINT) {
    try {
      const r = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      if (!r.ok) throw new Error(r.status);
      tack(true);
    } catch (x) {
      laddar(false);
      felRuta.textContent = 'Det gick inte att skicka just nu. Mejla oss på ' + FORM_MOTTAGARE + '.';
      felRuta.hidden = false;
    }
    return;
  }
  await vanta(lugn() ? 0 : 380);   // laddningsläget hinner synas innan e-postprogrammet tar fokus
  location.href = mailto();
  tack(false);
});

// kopiera förfrågan (om e-postprogrammet inte öppnades)
$('[data-off-kopiera]').addEventListener('click', async () => {
  const t = 'Till: ' + FORM_MOTTAGARE + '\nÄmne: ' + amne() + '\n\n' + brodtext();
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { ok = false; }
  const s = $('[data-off-kopiera-text]');
  s.textContent = ok ? 'Kopierad' : 'Gick inte att kopiera';
  $('[data-off-kopiera]').classList.toggle('off-kopiera--ok', ok);
  setTimeout(() => { s.textContent = 'Kopiera förfrågan'; $('[data-off-kopiera]').classList.remove('off-kopiera--ok'); }, 2400);
});

// ---- tack: bocken ritas, huset kommer i fokus med ett varmt ljus, texten kommer fram ord för ord ----
function ordVis(el, text, start) {
  el.innerHTML = text.split(' ').map((o, i) => '<span class="off-ord" style="--d:' + (start + i * 45) + 'ms">' + esc(o) + '</span>').join(' ');
  el.setAttribute('aria-label', text);
}
function tack(skickat) {
  const fornamn = v('namn').split(/\s+/)[0] || '';
  ordVis($('[data-off-tack-rubrik]'), 'Tack' + (fornamn ? ', ' + fornamn : '') + '!', 380);
  $('[data-off-tack-text]').textContent = skickat
    ? 'Din förfrågan om ' + hus.namn + ' · ' + P.kort + ' är skickad till oss.'
    : 'Ditt e-postprogram öppnas med förfrågan om ' + hus.namn + ' · ' + P.kort + ' ifylld. Tryck skicka där, så når den oss.';
  $('.off-tack__hjalp').hidden = !!skickat;
  const t = $('[data-off-tack]'), kort = $('[data-off-kort]');
  const visa = () => {
    form.hidden = true; t.hidden = false;
    laddar(false);
    H.classList.add('off-klar');
    t.focus({ preventScroll: true });
    // huset i fokus: syns det inte rullas det fram (på mobil ligger det ovanför formuläret)
    const r = scen.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) {
      const y = scrollY + r.top - $('.off-topp').offsetHeight - 12;
      scrollTo({ top: Math.max(0, y), behavior: lugn() ? 'auto' : 'smooth' });
    }
  };
  try { sessionStorage.removeItem(UTKAST); } catch (e) { /* privat läge */ }
  if (lugn() || !kort.animate) { visa(); return; }
  kort.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(0.99)' }], { duration: 160, easing: 'ease-out' }).finished.then(() => {
    visa();
    kort.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  });
}

// ---- live 3D: exakt kundens hus i ritarens egen motor (husritare.js), i studioläge ----
// Bilden ovan står kvar som platshållare tills motorns första bildruta är klar; då tonas duken
// in ovanpå, i samma ram (ingen layoutförskjutning). Samma modell och kulörer som i ritaren:
// valen läses ur ritarens adress (bygg-offert.adress) eller sidans egen adress (direktlänk).
// Dra vrider (mus), på pekskärm vrider ett finger i sidled medan ett lodrätt drag rullar sidan
// (touch-action: pan-y, som karuseller i iOS), två fingrar nyper. Hjulet zoomar först när man
// har tagit tag i modellen (eller med Ctrl/nyp på styrplattan), så att sidan går att rulla förbi.
// Dubbelklick/dubbeltryck återställer, piltangenterna vrider. Ritar bara när något rör sig.
const live = { R: null, duk: null, start: null, kund: null, rest: null, lever: false, tagit: false, startar: false };
const kundLage = data && Array.isArray(data.kamera) && data.kamera.length >= 6 ? data.kamera.slice(0, 6) : null;
const tips = $('[data-off-tips]');

function liveVal() {
  let s = new URLSearchParams();
  try { s = new URL(hus.adress, location.href).searchParams; } catch (e) { /* standardvalen */ }
  const g = k => s.get(k) || q.get(k) || null;
  return { fasad: g('fasad'), tak: g('tak'), detalj: g('detalj'), taktyp: g('taktyp') };
}
function kanLive() {
  if (navigator.connection && navigator.connection.saveData) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

// studion: ingen omgivning, fast eftermiddagsljus, samma ljusa toning som bildytan, mjuk skugga
function studio(R) {
  const s = R.sprang, T = s.THREE, sc = s.scene, rnd = s.renderer, h = s.hus();
  const miljo = sc.getObjectByName('miljo');
  if (miljo) miljo.visible = false;
  if (s.sno) s.sno.value = 0;
  if (typeof R.liv === 'function') R.liv(false);
  R.satt('tid', 15);
  rnd.toneMappingExposure = Math.abs(rnd.toneMappingExposure);
  const bc = document.createElement('canvas'); bc.width = 2; bc.height = 256;
  const bg = bc.getContext('2d'), lg = bg.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, '#f6f3ee'); lg.addColorStop(1, '#e9e4db'); bg.fillStyle = lg; bg.fillRect(0, 0, 2, 256);
  const bakgrund = new T.CanvasTexture(bc); bakgrund.colorSpace = T.SRGBColorSpace;
  sc.background = bakgrund;
  if (sc.fog) { sc.fog.near = 1e4; sc.fog.far = 2e4; }
  const e = h.userData.ext;
  const golv = new T.Mesh(new T.PlaneGeometry(120, 120), new T.ShadowMaterial({ opacity: 0.14, depthWrite: false }));
  golv.rotation.x = -Math.PI / 2; golv.position.y = 0.002; golv.receiveShadow = true;
  const fc = document.createElement('canvas'); fc.width = fc.height = 128;
  const g0 = fc.getContext('2d'), gr = g0.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(40,30,20,0.32)'); gr.addColorStop(0.55, 'rgba(40,30,20,0.12)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
  g0.fillStyle = gr; g0.fillRect(0, 0, 128, 128);
  const ftex = new T.CanvasTexture(fc);
  const flack = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ftex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  flack.rotation.x = -Math.PI / 2; flack.position.set((e.x0 + e.x1) / 2, 0.003, (e.z0 + e.z1) / 2);
  flack.scale.set((e.x1 - e.x0) * 1.7, (e.z1 - e.z0) * 1.9, 1);
  sc.add(golv, flack);
  if (s.skuggRam) s.skuggRam();
  rnd.shadowMap.needsUpdate = true;
}

// startvyn: 3/4 framifrån (entrén syns), lite ovanför, huset fyller ca 78 % av rutan
function startVy(R) {
  const s = R.sprang, T = s.THREE, kam = s.kamera, h = s.hus(), e = h.userData.ext, hojd = h.userData.hojd;
  const box = new T.Box3(new T.Vector3(e.x0, 0, e.z0), new T.Vector3(e.x1, hojd + 0.3, e.z1));
  const c = box.getCenter(new T.Vector3()), mal = new T.Vector3(c.x, c.y * 0.8, c.z);
  const az = 0.6, el = 0.22, rikt = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const horn = [];
  for (let i = 0; i < 8; i++) horn.push(new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const prov = new T.PerspectiveCamera(kam.fov, kam.aspect, 0.1, 500);
  let d = box.getSize(new T.Vector3()).length() * 1.4;
  for (let k = 0; k < 4; k++) {
    prov.position.copy(mal).addScaledVector(rikt, d); prov.lookAt(mal); prov.updateMatrixWorld(); prov.updateProjectionMatrix();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
    horn.forEach(v => { const p = v.clone().project(prov); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    d *= Math.max((x1 - x0) / 2 / 0.8, (y1 - y0) / 2 / 0.72);
  }
  return { pos: mal.clone().addScaledVector(rikt, d), mal, d };
}

function aka(pos, mal, tid = 0.9) {
  const s = live.R && live.R.sprang;
  if (!s) return;
  s.akTill(pos.clone ? pos.clone() : pos, mal.clone ? mal.clone() : mal, lugn() ? 0 : tid);
}
function aterstall() { if (live.start) aka(live.start.pos, live.start.mal); }

function tagit() {
  if (live.tagit) return;
  live.tagit = true;
  const s = live.R && live.R.sprang;
  if (s) s.styr.autoRotate = false;
  if (tips && !tips.hidden) { tips.classList.add('off-scen__tips--ut'); setTimeout(() => { tips.hidden = true; }, 320); }
}

async function startaLive() {
  if (live.startar || live.R || !kanLive()) return;
  live.startar = true;
  const t0 = performance.now();
  const ram = scen.querySelector('.off-scen__ram');
  const duk = document.createElement('canvas');
  duk.className = 'off-scen__3d';
  duk.tabIndex = 0;
  duk.setAttribute('role', 'img');
  duk.setAttribute('aria-label', hus.namn + ' i 3D. Dra för att vrida, nyp eller scrolla för att zooma, piltangenterna vrider, dubbelklicka för att återställa.');
  ram.insertBefore(duk, ram.querySelector('.off-scen__ljus'));
  live.duk = duk;
  try {
    const { skapaRitare } = await import('./husritare.js?v=20261126t');
    if (!live.duk) return;   // sidan lämnades under laddningen
    const R = await skapaRitare(duk, { modell: M[1], montera: false, miljo: 'studio', anpassa: true });
    if (!live.duk) { try { R.sprang.renderer.dispose(); R.sprang.renderer.forceContextLoss(); } catch (e) { /* redan borta */ } return; }
    live.R = R;
    const val = liveVal();
    ['fasad', 'tak', 'detalj', 'taktyp'].forEach(k => { if (val[k]) R.satt(k, val[k]); });
    if (R.redo && R.redo.then) await Promise.race([R.redo, vanta(8000)]);
    if (typeof R.starta === 'function') R.starta();
    studio(R);
    const s = R.sprang;
    live.start = startVy(R);
    R.kameraProv(live.start.pos.toArray(), live.start.mal.toArray());
    s.styr.minDistance = live.start.d * 0.5; s.styr.maxDistance = live.start.d * 1.8;
    s.styr.dispatchEvent({ type: 'start' }); s.styr.dispatchEvent({ type: 'end' });   // motorns startvy följer inte längre rutans storlek
    s.styr.autoRotateSpeed = 0.5;
    if (typeof R.snurra === 'function') R.snurra(!lugn());
    if (kundLage) live.kund = { pos: new s.THREE.Vector3(...kundLage.slice(0, 3)), mal: new s.THREE.Vector3(...kundLage.slice(3, 6)) };
    // pekskärm: lodrätt drag rullar sidan, vågrätt vrider (OrbitControls sätter annars none)
    duk.style.touchAction = 'pan-y';
    s.styr.enableZoom = false;
    s.styr.addEventListener('start', tagit);
    // första bildrutan: vänta tills huset står och skuggan är ritad (högst 3 s)
    const t1 = performance.now();
    while (performance.now() - t1 < 3000 && !(R.fardig && R.fardig()) && !(R.upptagen && !R.upptagen())) await vanta(60);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!live.duk) return;
    scen.classList.add('off-scen--live');
    H.dataset.offLive = String(Math.round(performance.now() - t0));
    if (tips) { tips.hidden = false; tips.querySelector('span').textContent = matchMedia('(pointer: coarse)').matches ? 'Dra i sidled för att vrida' : 'Dra för att vrida'; }
    if (kundLage || hus.vy) $('[data-off-vyer]').hidden = false;
    kopplaLive(duk);
  } catch (e) {
    console.info('offert: 3D-vyn kunde inte startas', e && e.message);
    stangLive();
  } finally { live.startar = false; }
}

function kopplaLive(duk) {
  const s = live.R.sprang;
  // hjulet: zoomar när man har tagit tag i modellen eller med Ctrl (nyp på styrplattan)
  let greppet = false;
  duk.addEventListener('pointerdown', () => { greppet = true; tagit(); });
  duk.addEventListener('pointerleave', () => { greppet = false; });
  scen.addEventListener('wheel', e => { if (live.R) s.styr.enableZoom = greppet || e.ctrlKey; }, { capture: true, passive: true });
  duk.addEventListener('focus', () => { greppet = true; });
  duk.addEventListener('blur', () => { greppet = false; });
  // pekskärm: två fingrar zoomar och vrider alltid
  duk.addEventListener('touchstart', e => { if (e.touches.length > 1) s.styr.enableZoom = true; }, { passive: true });
  // dubbelklick och dubbeltryck återställer
  duk.addEventListener('dblclick', e => { e.preventDefault(); aterstall(); });
  let sistTryck = null;
  duk.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const nu = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (sistTryck && nu.t - sistTryck.t < 320 && Math.hypot(nu.x - sistTryck.x, nu.y - sistTryck.y) < 30) { aterstall(); sistTryck = null; return; }
    sistTryck = nu;
  });
  // tangenterna: pilarna vrider, + och − zoomar, 0 återställer
  duk.addEventListener('keydown', e => {
    const T = s.THREE, steg = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    const zoom = e.key === '+' || e.key === '=' ? 0.85 : e.key === '-' || e.key === '_' ? 1.18 : 0;
    if (e.key === '0' || e.key === 'Home') { e.preventDefault(); tagit(); aterstall(); return; }
    if (!steg && !zoom) return;
    e.preventDefault(); tagit();
    const o = s.kamera.position.clone().sub(s.styr.target), sf = new T.Spherical().setFromVector3(o);
    if (steg) { sf.theta += steg[0] * 0.26; sf.phi = Math.min(s.styr.maxPolarAngle, Math.max(s.styr.minPolarAngle, sf.phi + steg[1] * 0.14)); }
    if (zoom) sf.radius = Math.min(s.styr.maxDistance, Math.max(s.styr.minDistance, sf.radius * zoom));
    aka(new T.Vector3().setFromSpherical(sf).add(s.styr.target), s.styr.target.clone(), 0.32);
  });
}

// "Ditt hus" / "Din vy": i 3D åker kameran till vinkeln kunden hade i ritaren; utan den visas bilden
function visaVy(vad) {
  if (!live.R) return false;
  tagit();
  if (vad === 'kund' && live.kund) { scen.classList.remove('off-scen--bild'); aka(live.kund.pos, live.kund.mal, 1.1); return true; }
  if (vad === 'kund' && vyer.kund) { visaBild(vyer.kund, hus.namn + ', din vy från ritaren'); scen.classList.add('off-scen--bild'); return true; }
  scen.classList.remove('off-scen--bild');
  aterstall();
  return true;
}

function stangLive() {
  const R = live.R, duk = live.duk;
  live.R = null; live.duk = null; live.tagit = false;
  scen.classList.remove('off-scen--live', 'off-scen--bild');
  if (tips) tips.hidden = true;
  if (R) { try { R.snurra && R.snurra(false); R.sprang.renderer.dispose(); R.sprang.renderer.forceContextLoss(); } catch (e) { /* redan borta */ } }
  if (duk) duk.remove();
}
addEventListener('pagehide', stangLive);
addEventListener('pageshow', e => { if (e.persisted && !live.R) startaLive(); });
// direkt efter första målningen: platshållaren syns medan motorn laddas
requestAnimationFrame(() => setTimeout(startaLive, 0));
