// Priskortet i 3D-ritaren: modell · paket och pris, nere till höger ovanför verktygsraden.
// Klick öppnar en väljare med de fyra paketen. Paketen har samma ordning och nummer som
// sprängvyns steg (1 Prefab stomme, 2 Klimatskal, 3 Nyckelfärdig, 4 Entreprenad): "Vad ingår?"
// öppnar sprängvyn på det valda paketets steg, och byter man steg där byts paketet här.
// Valet delas med modellsidorna (premium.js) via localStorage-nyckeln idealhus-paket och
// följer med i adressen (?paket=) och i "Begär offert" (kontakt.html?modell=…&paket=…).
// Priserna: kalkylen (priser.json, inkl. moms). Sadel 90 och Pulpet 70: pris på förfrågan.

export const PAKET = [
  { id: 'prefab-stomme', namn: 'Prefab stomme', kort: 'Prefab stomme' },
  { id: 'klimatskal', namn: 'Klimatskal', kort: 'Klimatskal' },
  { id: 'nyckelfardig', namn: 'Nyckelfärdig modul', kort: 'Nyckelfärdig' },
  { id: 'nyckelfardig-entreprenad', namn: 'Nyckelfärdig modul + entreprenad', kort: 'Entreprenad', lista: 'Nyckelfärdig + entreprenad' },
];
export const STANDARD_PAKET = 'nyckelfardig';
// pris per paket i samma ordning som PAKET
export const PRISER = {
  'kupa-30': [299500, 595000, 995000, 1250000],
  'kupa-40': [450000, 795000, 1250000, 1525000],
  'sadel-50': [495000, 850000, 1325000, 1695000],
};
// besparingen mot en annan husleverantör ("Spara upp till"), samma ordning
export const SPARA = {
  'kupa-30': [113400, 186900, 139900, 164895],
  'kupa-40': [72900, 199900, 214900, 254895],
  'sadel-50': [130900, 246900, 264900, 294895],
};
const NYCKEL = 'idealhus-paket';

export const stegFor = id => Math.max(0, PAKET.findIndex(p => p.id === id));
export const giltigt = id => PAKET.some(p => p.id === id);
const kr = n => n.toLocaleString('sv-SE').replace(/\s/g, ' ') + ' kr';
// "795 000 kr", "från 1 525 000 kr" eller "Pris på förfrågan"
export function prisText(modell, id) {
  const l = PRISER[modell];
  if (!l) return 'Pris på förfrågan';
  const i = stegFor(id);
  return (PAKET[i].id === 'nyckelfardig-entreprenad' ? 'från ' : '') + kr(l[i]);
}
// adressen först, sedan senaste valet (här eller på modellsidan), annars Nyckelfärdig modul
export function lasPaket() {
  let q = null;
  try { q = new URLSearchParams(location.search).get('paket'); } catch (e) { /* gammal webbläsare */ }
  if (giltigt(q)) { sparaPaket(q); return q; }
  try { const v = localStorage.getItem(NYCKEL); if (giltigt(v)) return v; } catch (e) { /* privat läge */ }
  return STANDARD_PAKET;
}
export function sparaPaket(id) { try { localStorage.setItem(NYCKEL, id); } catch (e) { /* privat läge */ } }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PIL_UPP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>';
const PIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// scen: .kf__scen. modell(): adressens modell-id (kupa-40 …), namn(): "Kupa 40",
// sprang(): sprängvyns API (ritare.sprangVy) när den har laddats, tillval(): text för en not
// om något valt i ritaren inte ingår (t.ex. tegeltak), vidByt(id): efter varje byte.
// upptagen(): motorn bygger ett hus (kortet tonas ut vid husbyte och in när det nya står klart).
export function kopplaPris({ scen, modell, namn, sprang = () => null, tillval = () => '', vidByt = () => {}, upptagen = () => false, visa = true }) {
  let paket = lasPaket();
  const S = { oppen: false };
  const el = document.createElement('div');
  el.className = 'kpris';
  el.hidden = !visa;
  el.innerHTML =
    '<div class="kpris__val" id="kpris-val" hidden>' +
      '<p class="kpris__rubrik" id="kpris-rubrik" data-kpris-rubrik></p>' +
      '<div class="kpris__lista" role="radiogroup" aria-labelledby="kpris-rubrik">' +
        PAKET.map((p, i) => '<button type="button" role="radio" aria-checked="false" tabindex="-1" class="kpris__paket" data-kpris-paket="' + p.id + '">' +
          '<b class="kpris__nr" aria-hidden="true">' + (i + 1) + '</b>' +
          '<span class="kpris__pnamn">' + esc(p.lista || p.namn) + '<small class="kpris__spara" data-kpris-spara></small></span>' +
          '<span class="kpris__belopp">' + (p.id === 'nyckelfardig-entreprenad' ? '<small class="kpris__fran" data-kpris-fran>från</small>' : '') + '<em data-kpris-belopp></em></span></button>').join('') +
      '</div>' +
      '<div class="kpris__lankar">' +
        '<button type="button" class="kpris__vad" data-kpris-vad>Vad ingår?</button>' +
        '<a class="kpris__offert" data-kpris-offert href="kontakt.html">Begär offert' + PIL + '</a>' +
      '</div>' +
      '<p class="kpris__moms" data-kpris-moms></p>' +
      '<p class="kpris__sparasum" data-kpris-sparasum hidden></p>' +
    '</div>' +
    '<button type="button" class="kpris__knapp" aria-expanded="false" aria-controls="kpris-val" data-kpris-knapp>' +
      '<b class="kpris__nr" aria-hidden="true" data-kpris-nr></b>' +
      '<span class="kpris__text"><span class="kpris__namn" data-kpris-namn></span><span class="kpris__pris" data-kpris-pris></span></span>' +
      PIL_UPP +
    '</button>' +
    '<p class="kpris__not" data-kpris-not hidden></p>';
  scen.appendChild(el);
  const $ = s => el.querySelector(s);
  const knapp = $('[data-kpris-knapp]'), ruta = $('#kpris-val');
  const knappar = [...el.querySelectorAll('[data-kpris-paket]')];

  function offertHref() { return 'kontakt.html?modell=' + encodeURIComponent(modell()) + '&paket=' + encodeURIComponent(paket); }
  let forraModell = null, byteJobb = 0;
  // husbyte: kortet tonas ut och kommer tillbaka när motorn har byggt det nya huset
  function tonaVidByte() {
    const jobb = ++byteJobb, t0 = performance.now();
    el.classList.add('kpris--byter');
    const koll = () => {
      if (jobb !== byteJobb) return;
      let tagen = false;
      try { tagen = !!upptagen(); } catch (e) { tagen = false; }
      if ((performance.now() - t0 > 450 && !tagen) || performance.now() - t0 > 9000) el.classList.remove('kpris--byter');
      else setTimeout(koll, 150);
    };
    setTimeout(koll, 150);
  }
  function rita() {
    const m = modell(), i = stegFor(paket), P = PAKET[i];
    if (forraModell && m !== forraModell && visa) tonaVidByte();
    forraModell = m;
    $('[data-kpris-nr]').textContent = String(i + 1);
    $('[data-kpris-namn]').textContent = namn() + ' · ' + P.kort;
    $('[data-kpris-pris]').textContent = prisText(m, paket);
    knapp.setAttribute('aria-label', namn() + ', ' + P.namn + ', ' + prisText(m, paket) + '. Byt paket');
    $('[data-kpris-rubrik]').textContent = 'Paket för ' + namn();
    knappar.forEach((b, j) => {
      const v = j === i;
      b.setAttribute('aria-checked', String(v)); b.tabIndex = v ? 0 : -1;
      // "från" står som etikett ovanför beloppet
      b.querySelector('[data-kpris-belopp]').textContent = prisText(m, PAKET[j].id).replace(/^från /, '');
      const fr = b.querySelector('[data-kpris-fran]');
      if (fr) fr.hidden = !PRISER[m];
      const sp = b.querySelector('[data-kpris-spara]');
      sp.hidden = !SPARA[m]; sp.textContent = SPARA[m] ? 'Spara upp till ' + kr(SPARA[m][j]) : '';
    });
    $('[data-kpris-offert]').href = offertHref();
    $('[data-kpris-moms]').textContent = PRISER[m] ? 'Inkl. moms. Leverans tillkommer enligt zon.' : 'Priset räknar vi fram i en offert.';
    const ss = $('[data-kpris-sparasum]');
    ss.hidden = !SPARA[m]; ss.textContent = SPARA[m] ? P.namn + ': spara upp till ' + kr(SPARA[m][i]) : '';
    const not = $('[data-kpris-not]'), t = tillval();
    not.hidden = !t; not.textContent = t ? t + ': tillval – pris i offert' : '';
  }
  // öppna: scale .96 → 1 och opacitet från kortet (css); stäng: en kort toning ut (140 ms) innan
  // rutan döljs. Går att avbryta: öppnas den igen under toningen står den kvar.
  let stangTid = 0;
  function oppna(pa) {
    S.oppen = pa;
    clearTimeout(stangTid);
    knapp.setAttribute('aria-expanded', String(pa));
    el.classList.toggle('kpris--oppen', pa);
    if (pa) { el.classList.remove('kpris--stanger'); ruta.hidden = false; return; }
    if (ruta.hidden) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ruta.hidden = true; return; }
    el.classList.add('kpris--stanger');
    stangTid = setTimeout(() => { el.classList.remove('kpris--stanger'); if (!S.oppen) ruta.hidden = true; }, 140);
  }
  // byt paket; fran = 'sprang' när bytet kom från sprängvyn (då styrs den inte tillbaka)
  function satt(id, fran) {
    if (!giltigt(id)) return;
    const nytt = id !== paket;
    paket = id;
    if (fran !== 'lagring') sparaPaket(id);
    rita();
    const sv = sprang();
    if (fran !== 'sprang' && sv && sv.arOppen()) sv.steg(stegFor(id));
    if (nytt) vidByt(id);
  }

  knapp.addEventListener('click', () => {
    oppna(!S.oppen);
    if (S.oppen) knappar[stegFor(paket)].focus({ preventScroll: true });
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-kpris-paket]');
    if (b) { satt(b.getAttribute('data-kpris-paket')); return; }
    if (e.target.closest('[data-kpris-vad]')) {
      const sv = sprang();
      oppna(false);
      if (sv) sv.oppna(stegFor(paket));
      else { const v = document.querySelector('[data-vadingar]'); if (v && !v.hidden) v.click(); }
    }
  });
  // pilarna byter paket i listan (radiogrupp), Esc stänger
  el.querySelector('.kpris__lista').addEventListener('keydown', e => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(PAKET.length - 1, stegFor(paket) + d));
    satt(PAKET[i].id);
    knappar[i].focus();
  });
  // Esc stänger väljaren (fångas före sprängvyns Esc, som annars tar den först)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !S.oppen) return;
    e.stopImmediatePropagation();
    const inne = el.contains(document.activeElement);
    oppna(false);
    if (inne) knapp.focus();
  }, true);
  document.addEventListener('pointerdown', e => { if (S.oppen && !el.contains(e.target)) oppna(false); }, true);
  // fokusfälla: Tab går runt bland rutans knappar (det valda paketet, Vad ingår?, Begär offert)
  // och kortets egen knapp, så att fokus inte försvinner bakom väljaren
  el.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !S.oppen) return;
    const varv = [knappar[stegFor(paket)], $('[data-kpris-vad]'), $('[data-kpris-offert]'), knapp].filter(b => b && b.offsetParent !== null);
    const i = varv.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    varv[(i + (e.shiftKey ? -1 : 1) + varv.length) % varv.length].focus();
  });
  // fokus lämnar kortet (t.ex. klick i scenen med tangentbordet): väljaren stängs
  el.addEventListener('focusout', e => { if (S.oppen && e.relatedTarget && !el.contains(e.relatedTarget)) oppna(false); });

  // Verktygsradens "Vad ingår?" öppnar sprängvyn på det valda paketet (inte på förra steget).
  scen.addEventListener('click', e => {
    const v = e.target.closest('[data-vadingar]'), sv = sprang();
    if (!v || !sv || sv.arOppen()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    oppna(false);
    sv.oppna(stegFor(paket));
  }, true);
  // Byter man steg i sprängvyn (flikarna, pilarna) följer paketet med. När panelen just har
  // öppnats gäller i stället paketet: vyn ställs på det (om den öppnades på ett annat steg).
  let panelSyns = false;
  new MutationObserver(() => {
    const panel = document.querySelector('.kspr');   // smal skärm: panelen ligger efter scenen
    if (!panel || panel.hidden) { panelSyns = false; return; }
    const f = panel.querySelector('[data-kspr-steg][aria-selected="true"]');
    if (!f) return;
    const i = +f.getAttribute('data-kspr-steg');
    if (!panelSyns) {
      panelSyns = true;
      const sv = sprang();
      if (i !== stegFor(paket) && sv) sv.steg(stegFor(paket));
      return;
    }
    if (PAKET[i] && PAKET[i].id !== paket) satt(PAKET[i].id, 'sprang');
  }).observe(scen.parentNode || scen, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] });
  // valt på modellsidan i en annan flik (eller i den inbäddade ritaren)
  addEventListener('storage', e => { if (e.key === NYCKEL && giltigt(e.newValue)) satt(e.newValue, 'lagring'); });

  rita();
  return { rita, satt, paket: () => paket, steg: () => stegFor(paket), namn: () => PAKET[stegFor(paket)].namn, kort: () => PAKET[stegFor(paket)].kort, offert: offertHref };
}
