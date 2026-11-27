// Bygg online: rita-hus.html som helskärmsapp (html.byggapp, satt i <head> utom i inbäddat
// läge och fotoläge). Inga nya funktioner: de befintliga kontrollerna flyttas in i en topprad
// och i nio steg i en sidopanel (mobil: bottenpanel), och det som bor i verktygsradens menyer
// (miljö, ljus, bil, Se inne …) speglas i stegen: stegets knapp klickar på originalet, och
// originalets läge (aria-pressed, aria-checked, hidden) följer med tillbaka.
// Laddningssidan (.bintro) följer husritarens egen laddning: förloppet läses från
// .ritare__laddar-linje i (--p, motorns mätmärken), texten från [data-laddar-text], och när
// husritaren-sida.js sätter .klar öppnar sig slöjan in i scenen.
// Körs före husritare-sida.js (moduler körs i dokumentordning) så att layouten står klar när
// sidan mäter; det som sidan bygger senare (priskortet, miljöerna) plockas upp med observatörer.

const H = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lugn = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobil = matchMedia('(max-width: 860px)');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PIL_H = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PIL_V = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const FALL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';


// ---------------------------------------------------------------------------------------------
// Minnet: varje val står i adressen (husritare-sida.js skriver den med history.replaceState) och
// sparas här också i localStorage. Omladdning och bakåtknappen behåller adressen som den är
// (husritarens vanliga "börja om vid omladdning" gäller inte i appen), och kommer man tillbaka
// utan val i adressen (Rita ditt hus utan modell) tas förra husets val fram.
// ---------------------------------------------------------------------------------------------
const MINNE = 'bygg-online-val';
const VAL_NYCKLAR = ['modell', 'fasad', 'tak', 'detalj', 'tid', 'miljo', 'vy', 'rum', 'matt', 'oppen', 'lager', 'tomt', 'plan', 'bil', 'paket', 'taktyp'];
function minne() {
  // husritare-sida.js återställer standardutseendet när adressen är dess egen vid omladdning
  try { sessionStorage.removeItem('rita-hus-egen'); } catch (e) { /* privat läge */ }
  const q = new URLSearchParams(location.search);
  if (!VAL_NYCKLAR.some(k => q.has(k))) {
    let sparat = '';
    try { sparat = localStorage.getItem(MINNE) || ''; } catch (e) { sparat = ''; }
    if (sparat) {
      const ny = new URLSearchParams(sparat);
      q.forEach((v, k) => { if (!VAL_NYCKLAR.includes(k)) ny.set(k, v); });
      try { history.replaceState(history.state, '', '?' + ny.toString() + location.hash); } catch (e) { /* förhandsvisning */ }
    }
  }
  const spara = () => {
    const n = new URLSearchParams(location.search), ut = new URLSearchParams();
    VAL_NYCKLAR.forEach(k => { if (n.has(k)) ut.set(k, n.get(k)); });
    if (!ut.has('modell')) return;
    try { localStorage.setItem(MINNE, ut.toString()); } catch (e) { /* fullt eller privat läge */ }
  };
  ['replaceState', 'pushState'].forEach(f => {
    const org = history[f];
    if (typeof org !== 'function') return;
    history[f] = function () { const r = org.apply(this, arguments); try { spara(); } catch (e) { /* ingen fara */ } return r; };
  });
  spara();
}

// ---------------------------------------------------------------------------------------------
// Laddningssidan
// ---------------------------------------------------------------------------------------------
function slappIntro() {
  const el = $('[data-bintro]');
  if (el) el.remove();
  H.classList.remove('bintro-pa');
  document.body.removeAttribute('aria-busy');
}
function intro() {
  const el = $('[data-bintro]'), laddar = $('.ritare__laddar');
  if (!el || !laddar) { slappIntro(); return; }
  const linje = $('.ritare__laddar-linje i', laddar), text = $('[data-laddar-text]', laddar);
  const bar = $('.bintro__linje', el), pct = $('[data-bintro-pct]', el), status = $('[data-bintro-text]', el);
  // Logotypen ritar sig från första målningen; ytorna står klara cirka 1,35 s senare (husritare-app.css).
  // Slöjan öppnas aldrig mitt i uppritningen, utom när 3D inte går (då ska beskedet synas direkt).
  let malad = 0;
  try { const f = performance.getEntriesByName('first-contentful-paint')[0]; malad = f ? f.startTime : 0; } catch (e) { malad = 0; }
  const RITAD = malad + 1350;
  let p = 0, visad = -1, oppnad = false;
  function satt(v) {
    if (!(v > p)) return;
    p = Math.min(1, v);
    // linjen glider själv (transition på transform); den behöver bara nya mål när något syns ändras
    if (p - visad >= 0.01 || p === 1) { visad = p; bar.style.setProperty('--p', p.toFixed(3)); }
    const n = Math.round(p * 100);
    if (String(n) !== bar.getAttribute('aria-valuenow')) { bar.setAttribute('aria-valuenow', String(n)); pct.textContent = n + ' %'; }
    // fönstren i loggan tänds ett i taget: en fjärdedel, hälften, tre fjärdedelar, klart
    const steg = String(p >= 1 ? 4 : p >= 0.75 ? 3 : p >= 0.5 ? 2 : p >= 0.25 ? 1 : 0);
    if (el.getAttribute('data-steg') !== steg) el.setAttribute('data-steg', steg);
    el.classList.add('bintro--matt');
  }
  if (linje) new MutationObserver(() => satt(parseFloat(linje.style.getPropertyValue('--p')))).observe(linje, { attributes: true, attributeFilter: ['style'] });
  if (text) new MutationObserver(() => {
    const t = text.textContent.trim();
    if (!t || t === status.textContent) return;
    if (lugn()) { status.textContent = t; return; }
    status.classList.add('byt');
    setTimeout(() => { status.textContent = t; status.classList.remove('byt'); }, 180);
  }).observe(text, { childList: true, characterData: true, subtree: true });
  function oppna(direkt) {
    if (oppnad) return;
    oppnad = true;
    satt(1);
    status.textContent = 'Klart';
    const ut = () => {
      el.classList.add('bintro--ut');
      el.setAttribute('aria-hidden', 'true');          // skärmläsaren lämnar slöjan direkt
      document.body.removeAttribute('aria-busy');
      H.classList.add('bapp-in');
      H.classList.remove('bintro-pa');
      const bort = () => {
        if (el._arbetare) { try { el._arbetare.postMessage({ typ: 'stopp' }); } catch (e) { /* redan stängd */ } el._arbetare = null; }
        el.remove(); H.classList.remove('bapp-in');
      };
      setTimeout(bort, lugn() ? 400 : 1150);
    };
    // två bildrutor till, så att scenens första bild säkert står på skärmen innan slöjan tonar
    const ga = v => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(ut)), v);
    if (direkt || lugn()) { ga(0); return; }
    // det sista fönstret hinner tändas (ett andetag), och loggan är färdigritad: i tråden svarar den 'ritad'
    // (data-ritad), annars följer SVG:n tidslinjen från första målningen. Högst 2,5 s efter målningen.
    const vantaRitad = () => {
      if (!el.classList.contains('bintro--duk') || el.hasAttribute('data-ritad') || performance.now() > malad + 2500) { ga(Math.max(0, RITAD - performance.now())); return; }
      setTimeout(vantaRitad, 50);
    };
    setTimeout(vantaRitad, 280);
  }
  const koll = () => {
    if (laddar.classList.contains('klar')) oppna(false);
    else if (laddar.getAttribute('role') === 'alert') oppna(true);   // ingen 3D: beskedet ska synas
  };
  new MutationObserver(koll).observe(laddar, { attributes: true, attributeFilter: ['class', 'role'] });
  koll();
  setTimeout(() => oppna(true), 25000);
}

// ---------------------------------------------------------------------------------------------
// Layouten: topraden, stegen, panelen
// ---------------------------------------------------------------------------------------------
function bygg() {
  const panel = $('.kf__panel'), yta = $('.kf__yta'), vanster = $('.kf__vanster'), scen = $('.kf__scen');
  const topp = $('[data-btopp]');
  // topraden: husets länkar (Byt hus, Spara, Mina hus, Kopiera länk, Börja om)
  const lankar = $('.kf__lankar');
  if (lankar && topp) $('[data-bplats="lankar"]', topp).appendChild(lankar);
  // Börja om och Byt hus får korta etiketter i raden (knapparna och deras tips är desamma)
  // designteamets animerade logotyp (logga.js, window.LegohusLogga) om sidan har den; annars den statiska
  // (bilderna har data-lh-logga; logga.js monterar dem själv vid DOMContentLoaded, det här tar
  // dem som eventuellt kom efter)
  const loggaNy = () => {
    const L = window.LegohusLogga;
    if (!L || typeof L.montera !== 'function') return;
    try { if (topp) L.montera(topp); const bi = $('[data-bintro]'); if (bi) L.montera(bi); } catch (e) { console.warn('logga', e); }
  };
  loggaNy();
  const stang = topp && $('[data-bstang]', topp);
  if (stang) stang.addEventListener('click', () => {
    let egen = false;
    try { egen = !!document.referrer && new URL(document.referrer).origin === location.origin && !/(rita-hus|offert)\.html/.test(new URL(document.referrer).pathname); } catch (e) { egen = false; }
    if (egen && history.length > 1) history.back(); else location.href = './';
  });

  const STEG = [
    { id: 'hus', namn: 'Hus', rubrik: 'Välj hus' },
    { id: 'paket', namn: 'Paket', rubrik: 'Välj paket' },
    { id: 'fasad', namn: 'Fasad', rubrik: 'Fasad' },
    { id: 'tak', namn: 'Tak', rubrik: 'Tak' },
    { id: 'fonster', namn: 'Fönster', rubrik: 'Fönster och dörrar' },
    { id: 'inne', namn: 'Inne', rubrik: 'Inne i huset' },
    { id: 'miljo', namn: 'Miljö', rubrik: 'Miljö och ljus' },
    { id: 'produkter', namn: 'Produkter', rubrik: 'Produkter i huset' },
    { id: 'summa', namn: 'Sammanfattning', rubrik: 'Sammanfattning' },
  ];
  const N = STEG.length;
  // panelens ram
  const huvud = document.createElement('div');
  huvud.className = 'bpanel__huvud';
  huvud.innerHTML =
    '<div class="bflikar-ram">' +
      '<div class="bflikar" role="tablist" aria-label="Stegen i Bygg online">' +
        STEG.map((s, i) => '<button type="button" role="tab" class="bflik" id="bflik-' + s.id + '" aria-controls="bsteg-' + s.id + '" aria-selected="false" aria-label="' + (i + 1) + ' ' + esc(s.namn) + '" tabindex="-1" data-bflik="' + i + '" data-btips="' + esc(s.namn) + '"><b>' + (i + 1) + '</b><span>' + esc(s.namn) + '</span></button>').join('') +
        '<span class="bflikar__markor" aria-hidden="true"></span>' +
      '</div>' +
      '<button type="button" class="bflikar__pil bflikar__pil--v" data-bflikpil="-1" tabindex="-1" aria-hidden="true">' + FALL + '</button>' +
      '<button type="button" class="bflikar__pil bflikar__pil--h" data-bflikpil="1" tabindex="-1" aria-hidden="true">' + FALL + '</button>' +
    '</div>' +
    '<span class="bpanel__forlopp" aria-hidden="true"><i></i></span>' +
    '<button type="button" class="bpanel__fall bpanel__fall--mobil" data-bfall aria-expanded="true" aria-controls="bpanel-steg" aria-label="Fäll ihop valen">' + FALL + '</button>';
  const lista = document.createElement('div');
  lista.className = 'bpanel__steg'; lista.id = 'bpanel-steg';
  const fot = document.createElement('div');
  fot.className = 'bpanel__fot';
  fot.innerHTML = '<button type="button" class="bfot__forra" data-bforra>' + PIL_V + '<span>Föregående</span></button>' +
    '<button type="button" class="bfot__nasta" data-bnasta><span data-bnasta-text>Nästa</span>' + PIL_H + '</button>' +
    '<a class="bfot__nasta bfot__offert" href="kontakt.html#kontaktformular" data-skicka hidden><span>Begär offert</span>' + PIL_H + '</a>' +
    // mobil: priskortet och Begär offert i foten (stegen byts med flikarna eller ett svep)
    '<div class="bpanel__mobil" data-bplats="mobil"></div>';
  const sektioner = STEG.map((s, i) => {
    const sek = document.createElement('section');
    sek.className = 'bsteg bsteg--' + s.id; sek.id = 'bsteg-' + s.id;
    sek.setAttribute('role', 'tabpanel'); sek.setAttribute('aria-labelledby', 'bflik-' + s.id); sek.hidden = true;
    sek.innerHTML = '<header class="bsteg__topp"><p class="bsteg__nr">Steg ' + (i + 1) + ' av ' + N + '</p><h2 class="bsteg__rubrik">' + esc(s.rubrik) + '</h2></header><div class="bsteg__inne"></div>';
    lista.appendChild(sek);
    return sek;
  });
  const inne = i => $('.bsteg__inne', sektioner[i]);
  const flytta = (i, ...el) => el.forEach(e => { if (e) inne(i).appendChild(e); });

  // 1 Hus: namnet, nyckeltalen och husvalet
  flytta(0, $('.kf__huvud', panel), $('#kgrupp-modell'));
  // 2 Paket: speglas från priskortet när det finns (husritare-pris.js bygger det senare)
  inne(1).innerHTML = '<div class="bpaket" role="radiogroup" aria-label="Paket" data-bpaket></div>' +
    '<p class="bpaket__not" data-bpaket-not hidden></p><p class="bpaket__moms" data-bpaket-moms></p>' +
    '<div class="bverktyg" data-bverktyg="paket"></div>';
  // 3–5: färggrupperna (färdiga kombinationer läggs av husritare-sida.js före fasaden)
  flytta(2, $('.kgrupp[data-grupp="fasad"]'));
  flytta(3, $('.kgrupp[data-grupp="tak"]'));
  flytta(4, $('.kgrupp[data-grupp="detalj"]'));
  // 6 Inne: verktygen för inne och planen
  inne(5).innerHTML = '<p class="bsteg__text">Gå in genom dörren, lyft av taket eller se planen ovanifrån. Allt finns också i verktygsraden.</p><div class="bverktyg" data-bverktyg="inne"></div>';
  flytta(5, $('.kplan'));
  // 7 Miljö: miljöerna, ljuset, bilen och vinklarna
  inne(6).innerHTML =
    '<p class="bgrupp__rubrik">Miljö</p><div class="bmiljoer" data-bmiljoer role="radiogroup" aria-label="Miljö"></div>' +
    '<p class="bgrupp__rubrik">Tid på dygnet</p><div class="bljus" data-bljus role="radiogroup" aria-label="Ljus"></div>' +
    '<label class="btid"><span>Klockan</span><input type="range" min="6" max="22" step="0.05" data-btid aria-label="Tid på dagen"><output data-btid-ut>14:00</output></label>' +
    '<p class="bgrupp__rubrik" data-bbil-rubrik hidden>Bil</p><div class="bbilar" data-bbilar role="radiogroup" aria-label="Bil" hidden></div>' +
    '<div class="bverktyg" data-bverktyg="miljo"></div>' +
    '<p class="bgrupp__rubrik">Vinklar</p>';
  flytta(6, $('.kf__tummar'));
  // 8 Produkter
  flytta(7, $('#kgrupp-produkter'));
  // 9 Sammanfattning: valen, paketet och priset, Begär offert, de 3D-modeller vi lånat
  const summa = $('.ksumma');
  flytta(8, summa);
  if (summa) {
    const lis = $('[data-summa-lista]', summa);
    if (lis) lis.insertAdjacentHTML('afterend', '<dl class="bsumma" data-bsumma></dl>');
    $$('[data-skicka]', summa).forEach(a => { a.textContent = 'Begär offert'; });
    const etikett = $('.k-etikett', summa), rubrik = $('h2', summa);
    if (etikett) etikett.hidden = true;
    if (rubrik) rubrik.classList.add('sr');
    const summaKnapp = $('[data-oppna-summa]');
    if (summaKnapp) { summaKnapp.classList.add('bsumma__knapp'); summa.appendChild(summaKnapp); $('span', summaKnapp).textContent = 'Visa sammanfattningen med bild'; }
  }
  // varianter: spara den här och jämför med andra i Mina hus (samma knappar som i raden)
  inne(8).insertAdjacentHTML('beforeend', '<p class="bgrupp__rubrik bgrupp__rubrik--varianter">Varianter</p><div class="bverktyg" data-bverktyg="summa"></div>');
  flytta(8, $('.kkredit'));

  panel.prepend(huvud);
  huvud.after(lista);
  lista.after(fot);
  panel.setAttribute('aria-label', 'Bygg ditt hus, steg för steg');
  // fäll ihop (dator: handtaget på panelens kant, mobil: knappen i panelens huvud)
  const handtag = document.createElement('button');
  handtag.type = 'button'; handtag.className = 'bpanel__fall bpanel__fall--kant'; handtag.setAttribute('data-bfall', '');
  handtag.setAttribute('aria-controls', 'bpanel-steg'); handtag.setAttribute('aria-expanded', 'true'); handtag.setAttribute('aria-label', 'Fäll ihop panelen');
  handtag.innerHTML = FALL;
  yta.appendChild(handtag);
  // iPadOS-handtaget (husritare-ios.css): kapseln fjädrar ut till en rund knapp när musen närmar sig (< 60 px)
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = handtag.getBoundingClientRect();
    if (!r.width) return;
    const nara = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 60;
    if (nara !== handtag.hasAttribute('data-nara')) handtag.toggleAttribute('data-nara', nara);
  }, { passive: true });

  // ---- stegen ----
  const flikar = $$('.bflik', huvud), markor = $('.bflikar__markor', huvud), flikRad = $('.bflikar', huvud);
  const forra = $('[data-bforra]', fot), nasta = $('[data-bnasta]', fot), nastaText = $('[data-bnasta-text]', fot), offertFot = $('.bfot__offert', fot);
  let nu = -1;
  const flikRam = flikRad.parentNode, forlopp = $('.bpanel__forlopp i', huvud);
  // toningar och pilar bara åt det håll där raden har mer
  function kanter() {
    const max = flikRad.scrollWidth - flikRad.clientWidth;
    flikRam.classList.toggle('bflikar-ram--v', max > 2 && flikRad.scrollLeft > 2);
    flikRam.classList.toggle('bflikar-ram--h', max > 2 && flikRad.scrollLeft < max - 2);
  }
  flikRad.addEventListener('scroll', kanter, { passive: true });
  $$('[data-bflikpil]', flikRam).forEach(b => b.addEventListener('click', () => {
    flikRad.scrollBy({ left: +b.getAttribute('data-bflikpil') * flikRad.clientWidth * 0.6, behavior: lugn() ? 'auto' : 'smooth' });
  }));
  // markören följer flikens storlek medan namnet glider fram (bredden ändras under 300 ms),
  // och raden rullar så att den valda står i mitten
  let markorJobb = 0;
  function satsMarkor() {
    const f = flikar[nu];
    if (!f || !markor) return;
    markor.style.width = f.offsetWidth + 'px';
    markor.style.transform = 'translateX(' + f.offsetLeft + 'px)';
  }
  function centrera(mjukt) {
    const f = flikar[nu];
    if (!f) return;
    const mal = Math.max(0, Math.min(flikRad.scrollWidth - flikRad.clientWidth, f.offsetLeft + f.offsetWidth / 2 - flikRad.clientWidth / 2));
    if (Math.abs(mal - flikRad.scrollLeft) > 1) flikRad.scrollTo({ left: mal, behavior: mjukt && !lugn() ? 'smooth' : 'auto' });
    kanter();
  }
  function flyttaMarkor(direkt) {
    const f = flikar[nu];
    if (!f || !markor) return;
    const jobb = ++markorJobb;
    if (direkt || lugn()) {
      markor.style.transition = 'none'; satsMarkor(); void markor.offsetWidth; markor.style.transition = '';
      centrera(false);
      return;
    }
    // under namnets glidning får markören ett nytt mål i varje bild (dess egen övergång jagar
    // flikens läge och storlek mjukt), sedan centreras raden
    const t0 = performance.now();
    const bild = () => {
      if (jobb !== markorJobb) return;
      satsMarkor();
      if (performance.now() - t0 < 250) requestAnimationFrame(bild);   // namnets glidning: var(--m-ui), 240 ms
      else centrera(true);
    };
    bild();
    requestAnimationFrame(() => { if (jobb === markorJobb) centrera(true); });
  }
  function kamera(sek) {
    // samma signal som när gruppen fälls ut: husritare-sida.js låter kameran åka till delen
    const g = $('.kgrupp[data-kamera]', sek);
    if (!g || !g.open) return;
    const forst = !g.dataset.klar;
    g.dispatchEvent(new Event('toggle'));
    if (forst) g.dispatchEvent(new Event('toggle'));
  }
  function visaSteg(i, { fokus = false, aka = true } = {}) {
    i = Math.max(0, Math.min(N - 1, i));
    const byte = i !== nu, forraSteg = nu;
    nu = i;
    flikar.forEach((f, j) => { f.setAttribute('aria-selected', String(j === i)); f.tabIndex = j === i ? 0 : -1; f.classList.toggle('bflik--klar', j < i); });
    sektioner.forEach((s, j) => { s.hidden = j !== i; });
    if (byte) {
      lista.scrollTop = 0;
      if (!lugn()) { const s = sektioner[i]; s.classList.remove('bsteg--in', 'bsteg--bak'); void s.offsetWidth; s.classList.add('bsteg--in'); if (i < forraSteg) s.classList.add('bsteg--bak'); }
    }
    forra.disabled = i === 0;
    const sist = i === N - 1;
    nasta.hidden = sist; offertFot.hidden = !sist;
    // Nästa säger vart den leder: "Steg 6 av 9" och stegets rubrik
    if (!sist) {
      nastaText.innerHTML = '<small>Nästa · steg ' + (i + 2) + ' av ' + N + '</small><b>' + esc(STEG[i + 1].rubrik) + '</b>';
      nasta.setAttribute('aria-label', 'Nästa steg: ' + STEG[i + 1].rubrik + ', steg ' + (i + 2) + ' av ' + N);
    }
    forra.setAttribute('aria-label', i ? 'Föregående steg: ' + STEG[i - 1].rubrik : 'Föregående');
    if (forlopp) forlopp.style.setProperty('--p', ((i + 1) / N).toFixed(4));
    flyttaMarkor(!byte);
    if (fokus) flikar[i].focus();
    if (aka && byte) kamera(sektioner[i]);
    H.dataset.bsteg = STEG[i].id;
    try { sessionStorage.setItem('bygg-steg', STEG[i].id); localStorage.setItem('bygg-steg', STEG[i].id); } catch (e) { /* privat läge */ }
  }
  flikar.forEach((f, i) => f.addEventListener('click', () => { visaPanel(true); visaSteg(i); }));
  flikRad.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); visaSteg(e.key === 'Home' ? 0 : N - 1, { fokus: true }); return; }
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    visaSteg((nu + d + N) % N, { fokus: true });
  });
  forra.addEventListener('click', () => visaSteg(nu - 1));
  // pekskärm: svep i sidled över stegen byter steg (inte i rader som själva rullar i sidled)
  let svep = null;
  lista.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.target.closest('input, .kf__tummar, .kprodval__rad, .bflikar')) { svep = null; return; }
    svep = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });
  lista.addEventListener('pointerup', e => {
    if (!svep) return;
    const dx = e.clientX - svep.x, dy = e.clientY - svep.y, dt = performance.now() - svep.t;
    svep = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.5 && dt < 700) visaSteg(nu + (dx < 0 ? 1 : -1));
  }, { passive: true });
  lista.addEventListener('pointercancel', () => { svep = null; }, { passive: true });
  nasta.addEventListener('click', () => visaSteg(nu + 1));
  if ('ResizeObserver' in window) new ResizeObserver(() => flyttaMarkor(true)).observe(flikRad);
  // panelens rullning: toning upptill/nedtill bara när det finns mer åt det hållet
  const rull = () => {
    const max = lista.scrollHeight - lista.clientHeight;
    lista.classList.toggle('bsteg-mer-upp', lista.scrollTop > 2);
    lista.classList.toggle('bsteg-mer-ned', max > 2 && lista.scrollTop < max - 2);
  };
  lista.addEventListener('scroll', rull, { passive: true });
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(rull); ro.observe(lista); sektioner.forEach(s => ro.observe(s)); }
  // tipset på flikarna (bara nummer syns): första gången efter 400 ms, sedan direkt medan
  // pekaren glider vidare mellan flikarna; borta vid klick, rullning och när pekaren går
  const tips = document.createElement('div');
  tips.className = 'btips'; tips.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tips);
  let tipsTid = 0, tipsVarm = 0, tipsPa = null;
  function visaTipsFor(el) {
    tipsPa = el;
    tips.textContent = el.getAttribute('data-btips');
    const r = el.getBoundingClientRect();
    tips.style.left = '0px'; tips.style.top = '0px';
    const b = tips.offsetWidth, x = Math.max(8, Math.min(innerWidth - b - 8, r.left + r.width / 2 - b / 2));
    tips.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(r.bottom + 8) + 'px)';
    tips.classList.toggle('btips--direkt', performance.now() - tipsVarm < 600);
    tips.classList.add('btips--syns');
  }
  function gomTips() { clearTimeout(tipsTid); if (tipsPa) tipsVarm = performance.now(); tipsPa = null; tips.classList.remove('btips--syns'); }
  flikRad.addEventListener('pointerover', e => {
    const f = e.target.closest('[data-btips]');
    if (!f || e.pointerType !== 'mouse' || f === tipsPa) return;
    clearTimeout(tipsTid);
    if (f.getAttribute('aria-selected') === 'true') { gomTips(); return; }
    if (performance.now() - tipsVarm < 600 || tipsPa) visaTipsFor(f);
    else tipsTid = setTimeout(() => visaTipsFor(f), 400);
  });
  flikRad.addEventListener('pointerleave', gomTips);
  flikRad.addEventListener('pointerdown', gomTips);
  flikRad.addEventListener('scroll', () => { if (tipsPa) gomTips(); }, { passive: true });
  // länkar inne i sidan som pekade på sektioner längre ned (Byt hus, Planritning, Sammanfattning)
  const ANKARE = { '#kgrupp-modell': 0, '#planen': 5, '#sammanfattning': 8, '#kgrupp-produkter': 7 };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !(a.getAttribute('href') in ANKARE)) return;
    const i = ANKARE[a.getAttribute('href')];
    visaPanel(true);
    visaSteg(i, { aka: !a.hasAttribute('data-byt') });   // Byt hus: husritare-sida.js åker själv
    if (!a.hasAttribute('data-byt')) {
      e.preventDefault();
      const mal = $(a.getAttribute('href'));
      if (mal && i !== 0) requestAnimationFrame(() => mal.scrollIntoView({ block: 'start', behavior: lugn() ? 'auto' : 'smooth' }));
    }
  }, true);
  let start = 0;
  try { const id = sessionStorage.getItem('bygg-steg') || localStorage.getItem('bygg-steg'); const j = STEG.findIndex(s => s.id === id); if (j >= 0) start = j; } catch (e) { /* privat läge */ }
  visaSteg(start, { aka: false });

  // ---- panelen fälls ihop och ut ----
  const fallKnappar = () => $$('[data-bfall]');
  let panelOppen = true;
  function visaPanel(pa) {
    if (pa === panelOppen) return;
    panelOppen = pa;
    fallKnappar().forEach(b => {
      b.setAttribute('aria-expanded', String(pa));
      b.setAttribute('aria-label', pa ? (b.classList.contains('bpanel__fall--mobil') ? 'Fäll ihop valen' : 'Fäll ihop panelen') : (b.classList.contains('bpanel__fall--mobil') ? 'Visa valen' : 'Visa panelen'));
    });
    // dator: panelen glider undan först, sedan växer scenen (en enda storleksändring av bilden)
    if (!pa && !mobil.matches && !lugn()) {
      H.classList.add('bpanel-ut');
      setTimeout(() => { if (!panelOppen) { H.classList.add('bpanel-dold'); H.classList.remove('bpanel-ut'); } }, 260);
    } else {
      H.classList.remove('bpanel-ut');
      H.classList.toggle('bpanel-dold', !pa);
      if (pa && !lugn()) { panel.classList.remove('bpanel--in'); void panel.offsetWidth; panel.classList.add('bpanel--in'); }
    }
    if (pa) requestAnimationFrame(() => flyttaMarkor(true));
  }
  fallKnappar().forEach(b => b.addEventListener('click', () => visaPanel(!panelOppen)));

  // ---- priskortet och Begär offert: topraden på dator, panelens huvud på mobil ----
  const platsPris = $('[data-bplats="pris"]'), platsMobil = $('[data-bplats="mobil"]'), offert = $('[data-boffert]');
  let pris = null;
  function placera() {
    const fyll = H.classList.contains('ritare-fyll') || document.fullscreenElement === scen;
    if (pris) {
      // helskärm: kortet tillbaka i scenen (där det har sin plats ovanför verktygsraden)
      const hem = fyll ? scen : mobil.matches ? platsMobil : platsPris;
      if (pris.parentNode !== hem) hem.appendChild(pris);
      pris.classList.toggle('kpris--topp', !fyll);
    }
    if (offert) {
      const hem = mobil.matches ? platsMobil : platsPris.parentNode;
      if (mobil.matches) { if (offert !== platsMobil.lastElementChild) platsMobil.appendChild(offert); }
      else if (!mobil.matches && offert.parentNode !== hem) platsPris.after(offert);
    }
  }
  mobil.addEventListener('change', () => { placera(); requestAnimationFrame(() => flyttaMarkor(true)); });
  document.addEventListener('fullscreenchange', placera);
  new MutationObserver(placera).observe(H, { attributes: true, attributeFilter: ['class'] });
  function hittaPris() {
    const k = $('.kpris');
    if (!k || k === pris) return;
    pris = k;
    placera();
    speglaPaket(k);
  }
  new MutationObserver(hittaPris).observe(scen, { childList: true });
  hittaPris();
  placera();

  // ---- 2 Paket: de fyra paketen från priskortet ----
  function speglaPaket(k) {
    const ruta = $('[data-bpaket]'), not = $('[data-bpaket-not]'), moms = $('[data-bpaket-moms]');
    const rita = () => {
      const org = $$('[data-kpris-paket]', k);
      if (!org.length) return;
      const html = org.map((b, i) => {
        const valt = b.getAttribute('aria-checked') === 'true';
        const namn = ($('.kpris__pnamn', b) || b).firstChild.textContent;
        const spara = $('[data-kpris-spara]', b), fran = $('[data-kpris-fran]', b), belopp = $('[data-kpris-belopp]', b);
        return '<button type="button" role="radio" class="bpaket__val" data-bpaket-id="' + esc(b.getAttribute('data-kpris-paket')) + '" aria-checked="' + valt + '" tabindex="' + (valt ? 0 : -1) + '">' +
          '<b class="bpaket__nr" aria-hidden="true">' + (i + 1) + '</b><span class="bpaket__namn">' + esc(namn) +
          (spara && !spara.hidden && spara.textContent ? '<small>' + esc(spara.textContent) + '</small>' : '') + '</span>' +
          '<span class="bpaket__pris">' + (fran && !fran.hidden ? '<small>från</small>' : '') + esc(belopp ? belopp.textContent : '') + '</span>' +
          '<span class="bpaket__bock" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></span></button>';
      }).join('');
      if (ruta.innerHTML !== html) {
        const fokus = ruta.contains(document.activeElement) ? document.activeElement.getAttribute('data-bpaket-id') : null;
        ruta.innerHTML = html;
        if (fokus) { const f = $('[aria-checked="true"]', ruta) || $('[data-bpaket-id="' + fokus + '"]', ruta); if (f) f.focus({ preventScroll: true }); }
      }
      const n = $('[data-kpris-not]', k), m = $('[data-kpris-moms]', k);
      not.hidden = !n || n.hidden; not.textContent = n ? n.textContent : '';
      moms.textContent = m ? m.textContent : '';
      ritaSumma();
    };
    ruta.addEventListener('click', e => {
      const b = e.target.closest('[data-bpaket-id]');
      if (!b) return;
      const o = $('[data-kpris-paket="' + b.getAttribute('data-bpaket-id') + '"]', k);
      if (o) o.click();
    });
    ruta.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const alla = $$('[data-bpaket-id]', ruta), i = alla.findIndex(b => b.getAttribute('aria-checked') === 'true');
      const ny = alla[Math.max(0, Math.min(alla.length - 1, i + d))];
      if (ny) { ny.click(); requestAnimationFrame(() => { const f = $('[aria-checked="true"]', ruta); if (f) f.focus(); }); }
    });
    new MutationObserver(rita).observe(k, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-checked', 'hidden'] });
    rita();
    // Vad ingår? öppnar sprängvyn på det valda paketet (samma som priskortets knapp)
    const vad = $('[data-kpris-vad]', k), plats = $('[data-bverktyg="paket"]');
    if (vad && plats && !$('[data-bvad]', plats)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bverktyg__knapp bverktyg__knapp--bred'; b.setAttribute('data-bvad', '');
      const ik = $('[data-vadingar] svg');
      b.innerHTML = (ik ? ik.outerHTML : '') + '<span><b>Vad ingår?</b><small>Huset isärtaget, del för del</small></span>';
      b.addEventListener('click', () => vad.click());
      plats.appendChild(b);
    }
  }
  // sammanfattningen: paketet och priset under valen
  function ritaSumma() {
    const dl = $('[data-bsumma]'), k = pris;
    if (!dl || !k) return;
    const v = $('[data-kpris-paket][aria-checked="true"]', k);
    if (!v) return;
    const namn = ($('.kpris__pnamn', v) || v).firstChild.textContent, belopp = $('[data-kpris-belopp]', v), fran = $('[data-kpris-fran]', v);
    const html = '<div><dt>Paket</dt><dd>' + esc(namn) + '</dd></div><div><dt>Pris</dt><dd><b>' + (fran && !fran.hidden ? 'från ' : '') + esc(belopp ? belopp.textContent : '') + '</b></dd></div>';
    if (dl.innerHTML !== html) dl.innerHTML = html;
  }

  // ---- speglade verktyg: stegets knapp klickar på verktygsradens ----
  function spegel(sel, plats, text, under) {
    const org = $(sel), hem = $('[data-bverktyg="' + plats + '"]');
    if (!org || !hem) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bverktyg__knapp';
    const ik = $('svg', org);
    b.innerHTML = (ik ? ik.outerHTML : '') + '<span><b></b><small>' + esc(under || '') + '</small></span><i class="bverktyg__lage" aria-hidden="true"></i>';
    const etikett = $('b', b);
    const synk = () => {
      b.hidden = org.hidden;
      const p = org.getAttribute('aria-pressed');
      if (p === null) b.removeAttribute('aria-pressed'); else b.setAttribute('aria-pressed', p);
      if (org.hasAttribute('aria-busy')) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
      const s = [...org.querySelectorAll(':scope > span')].pop();
      etikett.textContent = (s && s.textContent.trim()) || text;
    };
    new MutationObserver(synk).observe(org, { attributes: true, attributeFilter: ['hidden', 'aria-pressed', 'aria-busy'], subtree: true, childList: true, characterData: true });
    synk();
    b.addEventListener('click', () => { org.click(); requestAnimationFrame(() => { if (!b.hidden) b.focus({ preventScroll: true }); }); });
    hem.appendChild(b);
  }
  spegel('[data-inne]', 'inne', 'Se inne', 'In och ut genom dörren');
  spegel('[data-oppna]', 'inne', 'Öppna tak', 'Taket lyfts av, se ned i rummen');
  spegel('[data-plan]', 'inne', 'Planlösning', 'Rakt ovanifrån');
  spegel('[data-tomt]', 'inne', 'Tomt hus', 'Möblerna av och på');
  spegel('[data-lampor]', 'inne', 'Alla lampor', 'Tänd eller släck');
  spegel('[data-bil]', 'miljo', 'Kör iväg', 'Bilen kör från huset');
  spegel('[data-liv]', 'miljo', 'Liv', 'Vind, moln och fåglar');
  spegel('[data-spara]', 'summa', 'Spara', 'Lägg varianten i Mina hus');
  spegel('[data-mina]', 'summa', 'Mina hus', 'Öppna och jämför varianterna');
  // Mina hus öppnas i raden: klicket får inte bubbla vidare (listan stängs av klick utanför den)
  const minaSpegel = $('[data-bverktyg="summa"]') && $('[data-bverktyg="summa"]').lastElementChild;
  if (minaSpegel) minaSpegel.addEventListener('click', e => e.stopPropagation());

  // ---- 7 Miljö: miljöerna (med bilder), bilen och ljuset ur verktygsradens menyer ----
  const mpopup = $('#kf-miljo'), ljusPopup = $('#kf-ljus');
  const miljoer = $('[data-bmiljoer]'), bilar = $('[data-bbilar]'), bilRubrik = $('[data-bbil-rubrik]'), ljus = $('[data-bljus]');
  function valLista(org, attr, egen, kort) {
    return org.map(b => {
      const id = b.getAttribute(attr), valt = b.getAttribute('aria-checked') === 'true';
      const i = $('i', b), f = i ? i.style.getPropertyValue('--f') : '';
      return '<button type="button" role="radio" aria-checked="' + valt + '" tabindex="' + (valt ? 0 : -1) + '" data-bval="' + esc(id) + '">' + kort(id, b, f) + '</button>';
    }).join('');
  }
  const synkVal = (ruta, html) => { if (ruta.innerHTML !== html) ruta.innerHTML = html; };
  function ritaMiljo() {
    if (!mpopup) return;
    const m = $$('[data-miljo]', mpopup);
    synkVal(miljoer, valLista(m, 'data-miljo', miljoer, (id, b, f) =>
      '<span class="bmiljo__bild" style="--f:' + esc(f || '#8a8378') + ';--s:url(images/miljo/' + esc(id) + '.webp?v=1)"></span><span class="bmiljo__namn">' + esc(b.textContent.trim()) + '</span>'));
    const bl = $$('[data-bilval]', mpopup);
    bilar.hidden = bilRubrik.hidden = !bl.length;
    synkVal(bilar, valLista(bl, 'data-bilval', bilar, (id, b, f) => '<i style="--f:' + esc(f) + '"' + (id === 'ingen' ? ' class="bbil--ingen"' : '') + '></i>' + esc(b.textContent.trim())));
  }
  function ritaLjus() {
    if (!ljusPopup) return;
    synkVal(ljus, valLista($$('[data-ljus]', ljusPopup), 'data-ljus', ljus, (id, b, f) => {
      const t = $('small', b);
      return '<i style="--f:' + esc(f) + '"></i><span>' + esc(b.firstChild && b.childNodes[1] ? b.childNodes[1].textContent : b.textContent) + '</span>' + (t ? '<small>' + esc(t.textContent) + '</small>' : '');
    }));
  }
  function valKlick(ruta, popup, attr) {
    ruta.addEventListener('click', e => {
      const b = e.target.closest('[data-bval]');
      if (!b || !popup) return;
      const o = $('[' + attr + '="' + b.getAttribute('data-bval') + '"]', popup);
      if (!o) return;
      const id = b.getAttribute('data-bval');
      o.click();   // menyn väljer och lämnar fokus på sin knapp: tillbaka hit
      requestAnimationFrame(() => { const f = $('[data-bval="' + id + '"]', ruta); if (f) f.focus({ preventScroll: true }); });
    });
    ruta.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const alla = $$('[data-bval]', ruta), i = Math.max(0, alla.indexOf(document.activeElement));
      const ny = alla[(i + d + alla.length) % alla.length];
      if (ny) ny.focus();
    });
  }
  valKlick(miljoer, mpopup, 'data-miljo');
  valKlick(bilar, mpopup, 'data-bilval');
  valKlick(ljus, ljusPopup, 'data-ljus');
  if (mpopup) new MutationObserver(ritaMiljo).observe(mpopup, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
  if (ljusPopup) new MutationObserver(ritaLjus).observe(ljusPopup, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
  ritaMiljo(); ritaLjus();
  // klockan: samma reglage som i verktygsraden (input-händelsen styr motorn)
  const tid = $('#rit-tid'), tidUt = $('[data-tid]'), btid = $('[data-btid]'), btidUt = $('[data-btid-ut]');
  if (tid && btid) {
    const synk = () => { if (document.activeElement !== btid) btid.value = tid.value; btidUt.textContent = tidUt ? tidUt.textContent : ''; };
    btid.addEventListener('input', () => { tid.value = btid.value; tid.dispatchEvent(new Event('input', { bubbles: true })); btidUt.textContent = tidUt ? tidUt.textContent : ''; });
    btid.addEventListener('change', () => { tid.dispatchEvent(new Event('change', { bubbles: true })); });
    if (tidUt) new MutationObserver(synk).observe(tidUt, { childList: true, characterData: true, subtree: true });
    synk();
  }

  // ---- helskärm för hela appen (topraden): Fullscreen API, annars (iPhone Safari) en egen
  // helskärm där raden och panelen göms och scenen fyller 100dvh. Esc eller knappen lämnar. ----
  const helKnapp = $('[data-bhel]');
  const kanHelDok = !!(document.documentElement.requestFullscreen && document.fullscreenEnabled !== false);
  const helUt = document.createElement('button');
  helUt.type = 'button'; helUt.className = 'bhel-ut'; helUt.hidden = true;
  helUt.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg><span>Lämna helskärm</span>';
  vanster.appendChild(helUt);
  const arHel = () => document.fullscreenElement === document.documentElement || H.classList.contains('bapp-hel');
  function ritaHel() {
    const pa = arHel();
    if (helKnapp) { helKnapp.setAttribute('aria-pressed', String(pa)); helKnapp.setAttribute('aria-label', pa ? 'Lämna helskärm' : 'Helskärm'); helKnapp.title = pa ? 'Lämna helskärm' : 'Helskärm'; }
    helUt.hidden = !H.classList.contains('bapp-hel');
  }
  function egenHel(pa) {
    H.classList.toggle('bapp-hel', pa);
    ritaHel();
    if (pa) helUt.focus({ preventScroll: true }); else if (helKnapp) helKnapp.focus({ preventScroll: true });
  }
  function hel(pa) {
    if (H.classList.contains('bapp-hel') && !pa) { egenHel(false); return; }
    if (kanHelDok) {
      if (pa && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => egenHel(true));
      else if (!pa && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else egenHel(pa);
  }
  if (helKnapp) helKnapp.addEventListener('click', () => hel(!arHel()));
  helUt.addEventListener('click', () => hel(false));
  document.addEventListener('fullscreenchange', ritaHel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && H.classList.contains('bapp-hel') && !document.querySelector('dialog[open]')) egenHel(false); });
  ritaHel();

  // ---- mobil: bottenpanelen som ett ark; dra i huvudet nedåt för att fälla ihop, uppåt för att
  // fälla ut (följer fingret, släpper med fart eller efter en bit) ----
  const grepp = document.createElement('span');
  grepp.className = 'bpanel__grepp'; grepp.setAttribute('aria-hidden', 'true');
  huvud.prepend(grepp);
  let drag = null;
  huvud.addEventListener('pointerdown', e => {
    if (!mobil.matches || e.pointerType === 'mouse' || e.target.closest('.bflikar, button')) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId, prov: [[performance.now(), e.clientY]] };
  });
  // gummiband: åt "fel" håll följer arket allt trögare (som iOS), högst ca 40 px
  const gummi = x => Math.sign(x) * 40 * (1 - 1 / (Math.abs(x) / 120 + 1));
  huvud.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = e.clientY - drag.y;
    drag.prov.push([performance.now(), e.clientY]); if (drag.prov.length > 6) drag.prov.shift();
    const d = panelOppen ? (drag.dy > 0 ? drag.dy : gummi(drag.dy)) : (drag.dy < 0 ? drag.dy * 0.35 : gummi(drag.dy));
    if (Math.abs(d) > 3) { panel.style.transition = 'none'; panel.style.transform = 'translateY(' + d.toFixed(1) + 'px)'; }
  });
  const slapp = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    // farten de sista ~100 ms (inte medel över hela draget): en snabb snärt i slutet räknas
    const nu = performance.now(), pr = drag.prov.filter(q => nu - q[0] < 110), f0 = pr[0] || drag.prov[0], f1 = drag.prov[drag.prov.length - 1];
    const dy = drag.dy, fart = f1 && f0 && f1[0] > f0[0] ? (f1[1] - f0[1]) / (f1[0] - f0[0]) : dy / Math.max(1, nu - drag.t);
    drag = null;
    panel.style.transition = ''; panel.style.transform = '';
    if (panelOppen && (dy > 70 || fart > 0.5)) visaPanel(false);
    else if (!panelOppen && (dy < -24 || fart < -0.4)) visaPanel(true);
  };
  huvud.addEventListener('pointerup', slapp);
  huvud.addEventListener('pointercancel', slapp);

  // ---- Ångra senaste val: kulörerna, paketet och miljön ----
  // Läget läses före varje tryck (pekare eller tangent) och strax efter; ändrades något läggs det
  // gamla på en stack. Ångra klickar på samma kontroller som en kund (inget eget sätt att sätta
  // val), så adressen, minnet och 3D-scenen följer med precis som vanligt. Husbyte tömmer stacken.
  const angraStack = [];
  let angrar = false, foreLage = null, angraTid = 0;
  const NAMN = { fasad: 'Fasad', tak: 'Tak', detalj: 'Fönster och dörrar', paket: 'Paket', miljo: 'Miljö' };
  function lage() {
    const g = n => { const i = $('.kgrupp[data-grupp="' + n + '"] input:checked'); return i ? i.value : null; };
    const pk = pris && $('[data-kpris-paket][aria-checked="true"]', pris), m = $('#kf-miljo [data-miljo][aria-checked="true"]');
    return { modell: new URLSearchParams(location.search).get('modell'), fasad: g('fasad'), tak: g('tak'), detalj: g('detalj'), paket: pk ? pk.getAttribute('data-kpris-paket') : null, miljo: m ? m.getAttribute('data-miljo') : null };
  }
  const angraRad = document.createElement('div');
  angraRad.className = 'bangra'; angraRad.hidden = true; angraRad.setAttribute('role', 'status');
  angraRad.innerHTML = '<span data-bangra-text></span><button type="button" data-bangra>Ångra<kbd>Ctrl Z</kbd></button>';
  scen.appendChild(angraRad);
  function visaAngra(text) {
    clearTimeout(angraTid);
    $('[data-bangra-text]', angraRad).textContent = text;
    angraRad.classList.remove('bangra--ut');
    if (angraRad.hidden) { angraRad.hidden = false; } else if (!lugn()) { angraRad.style.animation = 'none'; void angraRad.offsetWidth; angraRad.style.animation = ''; }
    angraTid = setTimeout(gomAngra, 6000);
  }
  function gomAngra() {
    clearTimeout(angraTid);
    if (angraRad.hidden) return;
    if (lugn()) { angraRad.hidden = true; return; }
    angraRad.classList.add('bangra--ut');
    angraTid = setTimeout(() => { angraRad.hidden = true; angraRad.classList.remove('bangra--ut'); }, 160);
  }
  angraRad.addEventListener('pointerenter', () => clearTimeout(angraTid));
  angraRad.addEventListener('pointerleave', () => { if (!angraRad.hidden) angraTid = setTimeout(gomAngra, 2500); });
  const fore = () => { if (!angrar) foreLage = lage(); };
  document.addEventListener('pointerdown', fore, true);
  document.addEventListener('keydown', fore, true);
  function efter() {
    if (angrar || !foreLage) return;
    const f = foreLage, n = lage();
    foreLage = n;
    if (f.modell !== n.modell) { angraStack.length = 0; gomAngra(); return; }
    const andrat = Object.keys(NAMN).filter(k => f[k] && n[k] && f[k] !== n[k]);
    if (!andrat.length) return;
    const post = {};
    andrat.forEach(k => { post[k] = f[k]; });
    angraStack.push(post);
    if (angraStack.length > 30) angraStack.shift();
    // i sprängvyn byter flikarna paket hela tiden: stacken får det, men raden visas inte
    if (scen.classList.contains('kf__scen--sprang')) return;
    visaAngra(andrat.map(k => NAMN[k]).join(', ') + ' ändrat');
  }
  const efterSnart = () => setTimeout(efter, 80);
  document.addEventListener('click', efterSnart, true);
  document.addEventListener('change', efterSnart, true);
  function angra() {
    const post = angraStack.pop();
    if (!post) { gomAngra(); return false; }
    angrar = true;
    Object.keys(post).forEach(k => {
      let el = null;
      if (k === 'paket') el = pris && $('[data-kpris-paket="' + post[k] + '"]', pris);
      else if (k === 'miljo') el = $('#kf-miljo [data-miljo="' + post[k] + '"]');
      else el = $('.kgrupp[data-grupp="' + k + '"] input[value="' + CSS.escape(post[k]) + '"]');
      if (el && !(el.checked || el.getAttribute('aria-checked') === 'true')) el.click();
    });
    setTimeout(() => { angrar = false; foreLage = lage(); }, 120);
    if (angraStack.length) visaAngra('Ångrat. ' + angraStack.length + ' val till att ångra');
    else { $('[data-bangra-text]', angraRad).textContent = 'Ångrat'; clearTimeout(angraTid); angraTid = setTimeout(gomAngra, 1600); }
    return true;
  }
  $('[data-bangra]', angraRad).addEventListener('click', e => { e.stopPropagation(); angra(); });

  // ---- tangenterna i Bygg online: [ och ] byter steg, Ctrl+Z ångrar; de visas i Kortkommandon ----
  const skrivFalt = el => !!el && (el.isContentEditable || el.matches('textarea, select, input:not([type="radio"]):not([type="checkbox"]):not([type="range"])'));
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || document.querySelector('dialog[open]') || skrivFalt(document.activeElement)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') { if (angraStack.length) { e.preventDefault(); angra(); } return; }
    if (e.ctrlKey || e.metaKey || e.repeat) return;
    if (e.key === ']' || e.key === '[') { e.preventDefault(); visaPanel(true); visaSteg(nu + (e.key === ']' ? 1 : -1)); }
  });
  const tangentLista = $('[data-tangent-dialog] .ktang__kolumner');
  if (tangentLista && !$('#ktang-bygg')) tangentLista.insertAdjacentHTML('beforeend',
    '<section aria-labelledby="ktang-bygg"><h3 id="ktang-bygg">Bygg online</h3><dl>' +
    '<div><dt><kbd>[</kbd><kbd>]</kbd></dt><dd>Föregående och nästa steg</dd></div>' +
    '<div><dt><kbd>Ctrl</kbd><kbd>Z</kbd></dt><dd>Ångra senaste valet (kulör, paket, miljö)</dd></div>' +
    '<div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>Byt steg med fokus på stegens flikar</dd></div>' +
    '</dl></section>');

  // ---- Begär offert: till offertsidan med en stillbild av huset och alla val ----
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-skicka], a[data-kpris-offert]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    tillOffert();
  }, true);
  let paVag = false;
  async function tillOffert() {
    if (paVag) return;
    paVag = true;
    H.classList.add('bapp-ut');
    const skicka = $('[data-skicka]');
    let q = new URLSearchParams();
    try { q = new URL(skicka.getAttribute('href'), location.href).searchParams; } catch (e) { /* standardadressen */ }
    const k = pris, v = k && $('[data-kpris-paket][aria-checked="true"]', k);
    const rader = $$('[data-summa-lista] > div').map(d => {
      const i = $('dd i', d);
      return [$('dt', d).textContent, $('dd', d).textContent.trim(), i ? i.style.getPropertyValue('--f') : ''];
    });
    const miljo = $('#kf-miljo [data-miljo][aria-checked="true"]'), tidUt = $('[data-tid]');
    if (miljo) rader.push(['Miljö', miljo.textContent.trim(), '']);
    if (tidUt) rader.push(['Ljus', 'Klockan ' + tidUt.textContent, '']);
    const fran = v && $('[data-kpris-fran]', v);
    const data = {
      namn: ($('.btopp__namn') || {}).textContent || '',
      modell: q.get('modell') || '', paket: q.get('paket') || '',
      paketNamn: v ? ($('.kpris__pnamn', v) || v).firstChild.textContent : '',
      pris: v ? ((fran && !fran.hidden ? 'från ' : '') + $('[data-kpris-belopp]', v).textContent) : '',
      moms: k && $('[data-kpris-moms]', k) ? $('[data-kpris-moms]', k).textContent : '',
      ritat: q.get('ritat') || '', rader, adress: location.pathname.split('/').pop() + location.search, tid: Date.now(), bild: '',
      // kundens kameravinkel (x, y, z, mål x, y, z, fov): "Din vy" i offertens 3D-vy
      kamera: (() => { try { const d = motorDuk(); return d && !(d.__ritare.arInne && d.__ritare.arInne()) ? d.__ritare.kameraLage() : null; } catch (e) { return null; } })(),
    };
    try { data.bild = vyFranMotor() || await stillbild(); } catch (e) { data.bild = ''; }
    try { data.produkt = await produktbild(); } catch (e) { console.warn('bygg online: studiobilden', e); data.produkt = ''; }
    try { sessionStorage.setItem('bygg-offert', JSON.stringify(data)); }
    catch (e) { try { data.bild = ''; sessionStorage.setItem('bygg-offert', JSON.stringify(data)); } catch (e2) { try { data.produkt = ''; sessionStorage.setItem('bygg-offert', JSON.stringify(data)); } catch (e3) { /* privat läge: sidan läser adressen */ } } }
    const ut = new URLSearchParams();
    ['modell', 'paket', 'ritat'].forEach(n => { if (q.get(n)) ut.set(n, q.get(n)); });
    setTimeout(() => { location.href = 'offert.html?' + ut.toString(); }, lugn() ? 0 : 180);
    setTimeout(() => { paVag = false; H.classList.remove('bapp-ut'); }, 2500);
  }
  // Studiobilden till offerten: samma produktbild som sammanfattningen (husritare-sida.js,
  // duk.__produktbild) men i offertens format: 1600 × 1200 (4:3), fast 3/4-vinkel framifrån där
  // entrén syns, ljus botten även i mörkt tema, fast eftermiddagsljus utan snö och utemöbler.
  // Ritas och återställs i samma uppgift, så kunden ser aldrig bytet. Inne, i planen eller med
  // taket lyft hoppas den över; offertsidan visar då kundens vy eller tar bilden själv.
  const motorDuk = () => $$('.kf__scen canvas').find(c => c.__ritare);
  // kundens vy ("Din vy" på offertsidan): ritas om och kopieras direkt, ingen PNG-kodning
  function vyFranMotor() {
    const duk = motorDuk(), s = duk && duk.__ritare.sprang;
    if (!s || !s.renderer) return '';
    s.renderer.render(s.scene, s.kamera);
    const k = s.renderer.domElement, b = Math.min(1400, k.width), h = Math.round(k.height * b / k.width);
    const c = document.createElement('canvas'); c.width = b; c.height = h;
    c.getContext('2d').drawImage(k, 0, 0, b, h);
    return c.toDataURL('image/jpeg', 0.84);
  }
  async function produktbild() {
    const duk = motorDuk(), R = duk && duk.__ritare;
    if (!R || typeof duk.__produktbild !== 'function') return '';
    const kan = n => typeof R[n] === 'function';
    if ((kan('arInne') && R.arInne()) || (kan('plan') && R.plan()) || (kan('arOppen') && R.arOppen())) return '';
    // huset monteras eller kameran åker: vänta en kort stund (högst 1,5 s)
    for (let i = 0; i < 10 && kan('upptagen') && R.upptagen(); i++) await new Promise(r => setTimeout(r, 150));
    const c = document.createElement('canvas');
    if (!duk.__produktbild(c, { bredd: 1600, hojd: 1200, vinkel: 0.6, ljus: true, studio: true, skarp: true })) return '';
    return c.toDataURL('image/jpeg', 0.9);   // JPEG: kodas på en bråkdel av tiden för WebP
  }
  // husritarens egen "Ladda ned bild" ritar bilden; länken den skapar fångas i stället för att laddas ned
  function stillbild() {
    const knapp = $('[data-ladda]');
    if (!knapp) return Promise.resolve('');
    const org = HTMLAnchorElement.prototype.click;
    let url = '';
    HTMLAnchorElement.prototype.click = function () { if (this.download && /^legohus-/.test(this.download)) { url = this.href; return undefined; } return org.call(this); };
    try { knapp.click(); } finally { HTMLAnchorElement.prototype.click = org; }
    if (!url) return Promise.resolve('');
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const b = Math.min(1400, img.naturalWidth), h = Math.round(img.naturalHeight * b / img.naturalWidth);
          const c = document.createElement('canvas'); c.width = b; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, b, h);
          res(c.toDataURL('image/jpeg', 0.86));
        } catch (e) { res(''); }
      };
      img.onerror = () => res('');
      img.src = url;
    });
  }
}

// start (sist i filen: konstanterna ovan måste finnas först)
if (H.classList.contains('byggapp') && $('.kf__panel')) {
  try { minne(); } catch (e) { console.warn('bygg online: minnet', e); }
  try { intro(); } catch (e) { console.warn('bygg online: laddningen', e); slappIntro(); }
  try { bygg(); } catch (e) { console.warn('bygg online', e); }
}
