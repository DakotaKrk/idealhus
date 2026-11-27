// Husritarens produktkort: vad delen i 3D-vyn är och vem som tillverkar den, efter kundens
// kalkyl (fliken Leverantörer, allt "eller likvärdigt"). Märket visas med tillverkarens egen
// logotyp (MARKE_LOGGA) på en ljus platta; ordmärket i Poppins är reserv om bilden saknas. Texterna är sammanfattade med
// egna ord ur tillverkarens produktsida (länken); inga egna mått, U-värden eller garantier.
// Länkarna är kontrollerade (HTTP 200, rätt produkt) 2026-11-26.
// plats: 'ute' = närbild utifrån, 'inne' = man går fram till saken inne i huset.
// snitt: delen är dold, en genomskärning öppnas (husritare-sprang.js); modeller: bara i de husen
// (mikron finns bara i Pulpet 70:s skafferi), loft: bara i hus med loft.
// paket: 'klimat' = ingår från Klimatskal (och i Nyckelfärdig), 'nyckel' = ingår i Nyckelfärdig.

export const PRODUKTER = [
  { id: 'fonster', del: 'Fönster', plats: 'ute', paket: 'klimat', marke: 'Elitfönster', likv: true,
    info: ['Fönster och partier från Elitfönster, till exempel trä/aluminium med trä inomhus och aluminium utvändigt.',
      'Kulören väljer du under Fönster och plåt.'],
    lank: 'https://www.elitfonster.se/vara-produkter/fonster/',
    alt: [['NorDan', 'https://www.nordan.se/produkter/fonster']] },
  { id: 'ytterdorr', del: 'Ytterdörr', plats: 'ute', paket: 'klimat', marke: 'Elitfönster', likv: true,
    info: ['Ytterdörr och altandörrar levereras tillsammans med fönstren.',
      'Elitfönster har altan-, skjut- och vikdörrar; entrédörrar finns hos systermärket Diplomat Dörrar.'],
    lank: 'https://www.elitfonster.se/vara-produkter/dorrar/',
    alt: [['Diplomat Dörrar', 'https://www.diplomatdorrar.se/vara-produkter/ytterdorr/'], ['NorDan', 'https://www.nordan.se/produkter/ytterdorr']] },
  { id: 'tak', del: 'Yttertak', plats: 'ute', paket: 'klimat', marke: 'Plannja', modell: 'Trend', likv: true,
    info: ['Klickfalsad takplåt med dold infästning, så att inga skruvar syns.',
      'Ger taket ett tydligt linjespel. I 3D-vyn ligger falsarna med samma delning som Trend 475.'],
    lank: 'https://www.plannja.se/konsument/produkter/tak-och-fasad/tak-och-fasad-detaljer/plannja-trend-475_14567',
    alt: [['Areco Easy-Click', 'https://www.areco.se/sortiment/areco-profiles/takprofiler/areco-easy-click-morkgra']] },
  { id: 'takavvattning', del: 'Takavvattning', plats: 'ute', paket: 'klimat', marke: 'Plannja', likv: true,
    info: ['Hängrännor och stuprör i stål eller aluminium.', 'Finns som halvrunt system och som rektangulärt Square.'],
    lank: 'https://www.plannja.se/konsument/produkter/hangrannor-stupror',
    alt: [['Areco', 'https://www.areco.se/sortiment/areco-profiles/takavvattning']] },
  { id: 'underlagsduk', del: 'Underlagsduk', plats: 'ute', snitt: true, paket: 'klimat', marke: 'Mataki', likv: true,
    info: ['Underlagsduken ligger under takplåten på det läktade taket.', 'Exempel ur sortimentet: Haloten PRO, för takpannor, profilerad plåt och shingel.'],
    lank: 'https://mataki.se/underlagstackning/underlagsduk/haloten-pro' },
  { id: 'isolering', del: 'Isolering', plats: 'ute', snitt: true, paket: 'klimat', marke: 'Rockwool', likv: true,
    info: ['Stenull i väggar, bjälklag och tak, dold bakom panelen.', 'Exempel: Flexibatts, där ena kanten fjädrar så att skivan kläms fast mellan reglarna.'],
    lank: 'https://www.rockwool.com/se/produkter/flexibatts/',
    alt: [['Isover']] },
  { id: 'panel', del: 'Invändig panel', plats: 'inne', paket: 'nyckel', marke: 'Moelven', modell: 'Trend Slät Vit', likv: true,
    info: ['Färdigmålad furupanel med slät yta och smalt spår, för väggar och tak inomhus.', 'Lister från Moelven eller UNE.'],
    lank: 'https://www.moelven.com/se/se/tra-inomhus/innerpanel/trend-slat-vit/',
    alt: [['UNE Produkter (lister)', 'https://uneprodukter.se/sebe-listen/']] },
  { id: 'innerdorr', del: 'Innerdörrar', plats: 'inne', paket: 'nyckel', marke: 'Swedoor', modell: 'Easy', likv: true,
    info: ['Målad innerdörr i lätt konstruktion med slät yta, ur serien Clever Line.', 'I 3D-vyn: slät vit dörr utan speglar.'],
    lank: 'https://www.swedoor.se/produkter-sv/innerdoerrar/clever-line-easy/easy' },
  { id: 'golv', del: 'Golv', plats: 'inne', paket: 'nyckel', marke: 'Kährs', likv: true,
    info: ['Parkettgolv i trä från Kährs.', 'Exempel: Ekparkett 3 stav, där varje planka har tre stavar.'],
    lank: 'https://www.kahrs.com/se/golv/ekparkett-3-stav',
    alt: [['Parador', 'https://parador.de/se/parkettgolv']] },
  { id: 'kok', del: 'Kök och vitvaror', plats: 'inne', paket: 'nyckel', marke: 'Siemens', likv: true,
    info: ['Vitvarorna – kyl/frys, spis, ugn, fläkt och mikro – kommer från Siemens eller Electrolux.', 'Köksinredningen ritas efter planlösningen; luckor och leverantör bestäms i offerten.'],
    lank: 'https://www.siemens-home.bsh-group.com/se/sv/category/ugnar-hallar-och-flaktar',
    alt: [['Electrolux']] },
  { id: 'kylfrys', del: 'Kyl och frys', plats: 'inne', paket: 'nyckel', marke: 'Siemens', likv: true,
    info: ['Kyl och frys från Siemens sortiment.', 'I 3D-vyn: integrerad kyl/frys bakom luckor i köksfronten.'],
    lank: 'https://www.siemens-home.bsh-group.com/se/sv/category/kyl-och-frys',
    alt: [['Electrolux']] },
  { id: 'ugn', del: 'Spis och ugn', plats: 'inne', paket: 'nyckel', marke: 'Siemens', likv: true,
    info: ['Inbyggnadsugn och häll från Siemens.', 'Siemens ugnar finns med front i rostfritt stål, svart eller vitt.'],
    lank: 'https://www.siemens-home.bsh-group.com/se/sv/category/ugnar-hallar-och-flaktar/ugn',
    alt: [['Electrolux']] },
  { id: 'flakt', del: 'Köksfläkt', plats: 'inne', paket: 'nyckel', marke: 'Siemens', likv: true,
    info: ['Köksfläkt över hällen från Siemens sortiment.'],
    lank: 'https://www.siemens-home.bsh-group.com/se/sv/category/ugnar-hallar-och-flaktar/koksflakt',
    alt: [['Electrolux']] },
  { id: 'mikro', del: 'Mikrovågsugn', plats: 'inne', modeller: ['pulpet-70'], paket: 'nyckel', marke: 'Siemens', likv: true,
    info: ['Mikrovågsugn från Siemens sortiment.'],
    lank: 'https://www.siemens-home.bsh-group.com/se/sv/category/ugnar-hallar-och-flaktar/mikrovagsugn',
    alt: [['Electrolux']] },
  { id: 'wc', del: 'WC', plats: 'inne', paket: 'nyckel', marke: 'Svedbergs', likv: true,
    info: ['WC-stol från Svedbergs.', 'I 3D-vyn: vägghängd WC med dold cistern.'],
    lank: 'https://www.svedbergs.se/produkter/wc--toalettstolar/',
    alt: [['Ifö', 'https://catalog.ifo.se/sv-SE/series/SC1_1343074'], ['Riva']] },
  { id: 'dusch', del: 'Duschhörna', plats: 'inne', paket: 'nyckel', marke: 'Svedbergs', modell: '90 × 90', likv: true,
    info: ['Duschhörna 90 × 90 cm.', 'Exempel: Skoga hörndusch i härdat glas, med dörrar som kan vikas inåt.'],
    lank: 'https://www.svedbergs.se/produkter/duschar/horndusch/skoga-horndusch/',
    alt: [['Ifö'], ['Riva']] },
  { id: 'komod', del: 'Kommod', plats: 'inne', paket: 'nyckel', marke: 'Svedbergs', modell: 'Bloc 55', likv: true,
    info: ['Badrumskommod Bloc, 55 cm bred, med tvättställ.', 'Bloc har ingen egen sida hos Svedbergs längre; länken går till deras kommoder.'],
    lank: 'https://www.svedbergs.se/produkter/badrumsmobler/kommoder/',
    alt: [['Ifö'], ['Riva']] },
  { id: 'trappa', del: 'Trappa', plats: 'inne', paket: 'nyckel', loft: true,
    info: ['Trappan till loftet byggs efter ritningen.', 'Utförande och leverantör bestäms i offerten.'] },
];
// Tillverkarnas egna logotyper (hämtade från deras officiella webbplatser 2026-11-26, oförändrade
// former och färger; SVG:erna rensade från skript/externa länkar). Isover saknas: sajten spärrar
// automatisk hämtning, så där visas ordmärket. form: 'kvadrat' = nästan kvadratisk symbol (får vara
// högre), 'lang' = mycket långsmal (lägre, så att den inte tar hela bredden), 'ord' = rent ordmärke
// i versaler som fyller hela höjden (lite lägre, så att det väger lika med märken med symbol).
export const MARKE_LOGGA = {
  'Elitfönster': ['elitfonster.svg'], 'NorDan': ['nordan.svg'], 'Diplomat Dörrar': ['diplomat-dorrar.png'],
  'Plannja': ['plannja.jpg'], 'Areco': ['areco.png'], 'Mataki': ['mataki.svg', 'ord'], 'Rockwool': ['rockwool.svg'],
  'Moelven': ['moelven.svg'], 'UNE Produkter': ['une-produkter.png', 'lang'], 'Swedoor': ['swedoor.svg', 'ord'],
  'Kährs': ['kahrs.svg', 'kvadrat'], 'Parador': ['parador.svg', 'ord'], 'Siemens': ['siemens.svg', 'ord'],
  'Electrolux': ['electrolux.svg'], 'Svedbergs': ['svedbergs.png', 'lang'], 'Ifö': ['ifo.svg', 'kvadrat'],
};
// <img> med märkets logotyp, eller '' om den saknas. Texten finns kvar i alt.
// Laddar inte bilden visas ordmärket i stället (se loggaReserv).
export function loggaBild(marke, kl) {
  const l = MARKE_LOGGA[marke];
  if (!l) return '';
  return '<img class="' + kl + (l[1] ? ' ' + kl + '--' + l[1] : '') + '" src="images/marken/' + l[0] + '" alt="' + esc(marke) + '" decoding="async" data-marke="' + esc(marke) + '">';
}
// byt en logotyp som inte laddar mot texten (ett ordmärke) – kallas med en behållare efter innerHTML;
// plattan runt bilden (data-logga-hel) byts ut i sin helhet
export function loggaReserv(rot, ersatt) {
  rot.querySelectorAll('img[data-marke]').forEach(img => {
    const byt = () => { if (img.isConnected) (img.closest('[data-logga-hel]') || img).replaceWith(ersatt(img.getAttribute('data-marke'))); };
    if (img.complete && img.naturalWidth === 0 && img.src) byt(); else img.addEventListener('error', byt, { once: true });
  });
}
export const PAKET = { klimat: 'Ingår från Klimatskal', nyckel: 'Ingår i Nyckelfärdig' };
export const GRUPPER = [['klimat', 'Klimatskal'], ['nyckel', 'Nyckelfärdig']];
// listan "Produkter i huset": var i huset delen sitter (ordningen är även Föregående/Nästa)
export const OMRADEN = [
  ['ute', 'Ute', ['fonster', 'ytterdorr', 'tak', 'takavvattning']],
  ['stomme', 'Stomme och isolering', ['underlagsduk', 'isolering']],
  ['inne', 'Inne', ['panel', 'innerdorr', 'golv', 'trappa']],
  ['kok', 'Kök', ['kok', 'kylfrys', 'ugn', 'flakt', 'mikro']],
  ['bad', 'Badrum', ['wc', 'dusch', 'komod']],
];
// små ikoner per produkt, 24 × 24 i verktygsradens linjestil (stroke, ingen fyllning)
// dx/dy flyttar ritytan så att ritningens mitt (med linjebredden) hamnar exakt i rutans mitt
const ik = (d, dx = 0, dy = 0) => '<svg viewBox="' + dx + ' ' + dy + ' 24 24" aria-hidden="true">' + d + '</svg>';
export const PROD_IKON = {
  fonster: ik('<rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M12 3.5v17M5 12h14"/>'),
  ytterdorr: ik('<path d="M4 20.5h16M6.5 20.5v-17h11v17"/><path d="M9 6.5h6v4H9z"/><path d="M15 14h-1.5"/>'),
  tak: ik('<path d="M2.5 15.5 12 6l9.5 9.5z"/><path d="M8.5 15.5v-6M12 15.5V6M15.5 15.5v-6"/>', 0, -1.25),
  takavvattning: ik('<path d="M3 5.5h16a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 3 5.5z"/><path d="M15.5 8v8.5a3 3 0 0 0 3 3h1.5"/>', -0.5, 0.5),
  underlagsduk: ik('<rect x="3.5" y="4" width="5" height="16" rx="2.5"/><path d="M8.5 6H20.5v12h-12"/><path d="M12 10h5.5M12 14h5.5"/>'),
  isolering: ik('<path d="M3.5 4h17M3.5 20h17"/><path d="M4 12c1.3-5 2.7-5 4 0s2.7 5 4 0 2.7-5 4 0 2.7 5 4 0"/>'),
  panel: ik('<rect x="4" y="3.5" width="16" height="17" rx="1"/><path d="M9.3 3.5v17M14.7 3.5v17"/>'),
  innerdorr: ik('<path d="M6.5 20.5v-17h11v17M4.5 20.5h15"/><path d="M9 6.5h6v5H9zM9 14h6"/><path d="M14.5 16.5h1"/>'),
  golv: ik('<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M3.5 9.2h17M3.5 14.8h17M10 3.5v5.7M15 9.2v5.6M8 14.8v5.7"/>'),
  trappa: ik('<path d="M3.5 20.5h4v-4h4v-4h4v-4h4v-5"/>', -0.5, 0),
  kok: ik('<path d="M3 11h18"/><path d="M4.5 11v9.5h15V11M12 11v9.5"/><path d="M9.5 14.5h.5M14 14.5h.5"/><path d="M15 11V6.5a2 2 0 0 0-4 0"/>', 0, 0.5),
  kylfrys: ik('<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M6 9h12M9 5v2M9 11.5v3"/>'),
  ugn: ik('<rect x="3.5" y="4" width="17" height="16.5" rx="1.5"/><path d="M3.5 8.5h17"/><rect x="7" y="11.5" width="10" height="6" rx="1"/>', 0, 0.25),
  flakt: ik('<path d="M10 3.5h4v5.5l6 5H4l6-5z"/><path d="M4 14v2.5h16V14"/>', 0, -2),
  mikro: ik('<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><rect x="5.5" y="8" width="9.5" height="8" rx="1"/><path d="M18 9v6"/>'),
  wc: ik('<path d="M6 3.5h5v7H6z"/><path d="M4 10.5h15a4.5 4.5 0 0 1-4.5 5H14l1 5H8l1-5H8.5A4.5 4.5 0 0 1 4 10.5z"/>', -0.5, 0),
  dusch: ik('<path d="M5 21V6.5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3V8"/><path d="M10 8h6"/><path d="M11 11.5v1M15 11.5v1M13 14v1M11 16.5v1M15 16.5v1"/>', -1.5, 0.25),
  komod: ik('<path d="M3.5 10h17"/><path d="M5 10v10.5h14V10M12 14v6.5"/><path d="M8 10a4 4 0 0 0 8 0"/><path d="M12 10V6h2.5"/>', 0, 1.25),
};

const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const FORRA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>';
const NASTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
const lank = (url, text, kl) => '<a class="' + kl + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + text + '</a>';

// Kortet: en icke-modal dialog i scenen. visa(P) fyller och visar, dolj() tonar bort.
// vidStang anropas när kortet stängs (X, Esc, klick utanför), vidByt(steg) för pilarna.
export function skapaKort(scen, { vidStang, vidByt } = {}) {
  const kort = document.createElement('section');
  kort.className = 'kprod';
  kort.setAttribute('role', 'dialog');
  kort.setAttribute('aria-labelledby', 'kprod-marke');
  kort.setAttribute('aria-describedby', 'kprod-info');
  kort.tabIndex = -1;
  kort.hidden = true;
  kort.innerHTML = '<div class="kprod__topp"><p class="kprod__del" data-kprod-del></p>' +
    '<div class="kprod__styr"><button type="button" class="kprod__knapp" data-kprod-steg="-1" aria-label="Föregående produkt">' + FORRA + '</button>' +
    '<button type="button" class="kprod__knapp" data-kprod-steg="1" aria-label="Nästa produkt">' + NASTA + '</button>' +
    '<button type="button" class="kprod__knapp kprod__stang" data-kprod-stang aria-label="Stäng produktkortet">' + X + '</button></div></div>' +
    '<h2 class="kprod__marke" id="kprod-marke"></h2>' +
    '<ul class="kprod__info" id="kprod-info"></ul>' +
    '<div class="kprod__fot"><p class="kprod__paket" data-kprod-paket></p><p class="kprod__likv" data-kprod-likv>eller likvärdigt</p></div>' +
    '<div class="kprod__lankar" data-kprod-lankar></div>';
  scen.appendChild(kort);
  const $ = s => kort.querySelector(s);
  let tid = 0, oppnad = 0;
  // smal skärm: en bottenpanel i fönstret (under bilden), inte ovanpå den lilla scenen
  const smal = matchMedia('(max-width: 600px)');
  function visa(P, fokus) {
    clearTimeout(tid);
    const hem = smal.matches ? document.body : scen;
    if (kort.parentNode !== hem) hem.appendChild(kort);
    kort.classList.toggle('kprod--panel', hem === document.body);
    $('[data-kprod-del]').textContent = P.del;
    const ord = m => '<span class="kprod__ord">' + esc(m) + '<i aria-hidden="true"></i></span>';
    const logga = P.marke ? loggaBild(P.marke, 'kprod__logga') : '';
    const mk = $('.kprod__marke');
    mk.innerHTML = P.marke
      ? (logga ? '<span class="kprod__platta" data-logga-hel>' + logga + '</span>' : ord(P.marke)) + (P.modell ? '<span class="kprod__modell">' + esc(P.modell) + '</span>' : '')
      : '<span class="kprod__ord kprod__ord--del">' + esc(P.del) + '</span>';
    mk.classList.toggle('kprod__marke--logga', !!logga);
    loggaReserv(mk, m => { mk.classList.remove('kprod__marke--logga'); const t = document.createElement('template'); t.innerHTML = ord(m); return t.content.firstChild; });
    $('#kprod-info').innerHTML = P.info.map(t => '<li>' + esc(t) + '</li>').join('');
    const pk = $('[data-kprod-paket]');
    pk.textContent = PAKET[P.paket] || '';
    pk.className = 'kprod__paket kprod__paket--' + P.paket;
    $('[data-kprod-likv]').hidden = !P.likv;
    const alt = (P.alt || []).map(([n, u]) => u ? lank(u, esc(n) + '<span class="sr"> (öppnas i ny flik)</span>', 'kprod__alt-lank') : '<span>' + esc(n) + '</span>');
    $('[data-kprod-lankar]').innerHTML =
      (P.lank ? lank(P.lank, '<span>Se produkten hos ' + esc(P.marke) + '</span><span class="sr"> (öppnas i ny flik)</span>' + PIL, 'kprod__lank') : '') +
      (alt.length ? '<p class="kprod__alt">Alternativ: ' + alt.join(', ') + '</p>' : '');
    kort.dataset.produkt = P.id;
    const ny = kort.hidden;
    kort.hidden = false;
    kort.classList.remove('kprod--ut');
    if (ny) { kort.classList.remove('kprod--in'); void kort.offsetWidth; }
    kort.classList.add('kprod--in');
    oppnad = performance.now();
    if (fokus) kort.focus({ preventScroll: true });
  }
  function dolj() {
    if (kort.hidden) return;
    kort.classList.remove('kprod--in'); kort.classList.add('kprod--ut');
    const lugn = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tid = setTimeout(() => { kort.hidden = true; kort.classList.remove('kprod--ut'); }, lugn ? 0 : 200);
  }
  const stang = () => { if (!kort.hidden && typeof vidStang === 'function') vidStang(); };
  kort.addEventListener('click', e => {
    if (e.target.closest('[data-kprod-stang]')) { stang(); return; }
    const b = e.target.closest('[data-kprod-steg]');
    if (b && typeof vidByt === 'function') vidByt(+b.getAttribute('data-kprod-steg'));
  });
  // Esc (före sidans egna Esc: ut ur huset), och ett klick utanför kortet (inte ett drag i bilden)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !kort.hidden) { e.stopPropagation(); e.preventDefault(); stang(); } }, true);
  let ner = null;
  document.addEventListener('pointerdown', e => { ner = kort.hidden ? null : { x: e.clientX, y: e.clientY, t: e.target }; }, true);
  document.addEventListener('pointerup', e => {
    const n = ner; ner = null;
    if (!n || kort.hidden || performance.now() - oppnad < 350) return;
    if (Math.hypot(e.clientX - n.x, e.clientY - n.y) > 6) return;
    if (kort.contains(n.t) || (n.t.closest && n.t.closest('[data-produkt]'))) return;
    // ett klick på taket i bilden byter kort (motorn meddelar det i samma klick)
    setTimeout(() => { if (performance.now() - oppnad > 350) stang(); }, 0);
  }, true);
  // halla(): ett nytt val är på väg (klicket som gjorde det stänger inte kortet)
  return { visa, dolj, halla: () => { oppnad = performance.now(); }, oppen: () => !kort.hidden, el: kort, id: () => (kort.hidden ? null : kort.dataset.produkt) };
}

// Fokusramen: fyra mjuka hörn och ett svagt ljus kring delen i bilden när kameran landat, som en
// kamera som ställer skärpan. visa(r) med rutan i andelar av bilden { x0, x1, y0, y1 }; tonar ut
// av sig själv. Ett drag eller hjul i bilden tar bort den direkt.
export function skapaFokus(scen) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className = 'kprod-fokus';
  const lugn = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', zIndex: '5', pointerEvents: 'none', opacity: '0', borderRadius: '18px',
    background: 'radial-gradient(closest-side, rgba(255, 246, 228, 0.16), rgba(255, 246, 228, 0.05) 70%, rgba(255, 246, 228, 0))', transformOrigin: '50% 50%' });
  const hl = 'rgba(255, 255, 255, 0.95)';
  [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].forEach(([v, h]) => {
    const c = document.createElement('span');
    Object.assign(c.style, { position: 'absolute', [v]: '0', [h]: '0', width: '22px', height: '22px', boxSizing: 'border-box',
      ['border' + v[0].toUpperCase() + v.slice(1)]: '2px solid ' + hl, ['border' + h[0].toUpperCase() + h.slice(1)]: '2px solid ' + hl,
      ['border' + v[0].toUpperCase() + v.slice(1) + h[0].toUpperCase() + h.slice(1) + 'Radius']: '10px', filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))' });
    el.appendChild(c);
  });
  scen.appendChild(el);
  let tid = 0;
  function gom() {
    clearTimeout(tid);
    el.style.transition = 'opacity 0.25s ease, transform 0.4s ease';
    el.style.opacity = '0';
  }
  function visa(r) {
    clearTimeout(tid);
    const duk = scen.querySelector('canvas'), sr = scen.getBoundingClientRect(), dr = duk ? duk.getBoundingClientRect() : sr;
    const luft = 12, x0 = Math.max(6, dr.left - sr.left + r.x0 * dr.width - luft), y0 = Math.max(6, dr.top - sr.top + r.y0 * dr.height - luft);
    const x1 = Math.min(sr.width - 6, dr.left - sr.left + r.x1 * dr.width + luft), y1 = Math.min(sr.height - 6, dr.top - sr.top + r.y1 * dr.height + luft);
    if (x1 - x0 < 30 || y1 - y0 < 30) return;
    el.style.transition = 'none';
    Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px', opacity: '0', transform: lugn() ? 'none' : 'scale(1.07)' });
    void el.offsetWidth;
    el.style.transition = lugn() ? 'opacity 0.2s ease' : 'opacity 0.35s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)';
    el.style.opacity = '1'; el.style.transform = 'none';
    tid = setTimeout(() => { el.style.transition = 'opacity 0.7s ease, transform 0.9s ease'; el.style.opacity = '0'; if (!lugn()) el.style.transform = 'scale(1.02)'; }, 1700);
  }
  scen.addEventListener('pointerdown', gom, true);
  scen.addEventListener('wheel', gom, { capture: true, passive: true });
  return { visa, gom };
}
