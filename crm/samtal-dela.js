/* ============================================================
   Legohus CRM – dela innehåll i videomötet (2026-10-29)
   Som "Dela innehåll" i Teams: säljaren visar presentationen från
   Förbered mötet, kalkylen, husen i 3D, offerten eller kundens bilder.
   Det delade visas stort och videorutorna i en remsa vid sidan.
   Allt går som ren data över IH.samtal.signal (händelserna innehall,
   innehall-forslag och innehall-fil) – ingen HTML och ingen skärmbild.
   Mottagaren escapar varje text och godtar bara bild-URL:er under
   ../images och ../modeller. Gästsidan läser aldrig IH.db.
   Laddas efter samtal.js och samtal-ui.js (index.html och mote-gast.html).
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var D = document;
  var GAST = D.documentElement.hasAttribute('data-vm-gast');
  var lugnMq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function e(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 300) : typeof v === 'number' && isFinite(v) ? String(v) : ''; }
  function tal(v, min, max) { var n = Number(v); if (!isFinite(n)) n = 0; return Math.max(min, Math.min(max, n)); }
  var URL_RE = /^\.\.\/(images|modeller)\/[A-Za-z0-9_\/.-]+\.(webp|jpe?g|png|svg|glb)$/;
  function sakerUrl(u) { u = str(u, 200); return URL_RE.test(u) && u.indexOf('..', 3) < 0 && u.indexOf('//') < 0 ? u : ''; }
  function kr(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr'; }
  function fornamn(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  function M() { return IH.samtal || null; }
  function tillst() { var m = M(); try { return m && m.tillstand ? m.tillstand() : null; } catch (x) { return null; } }

  /* ---------- Ikoner (egen sprite, så att gästsidan har dem) ---------- */
  var IKONER = {
    'vmd-pres': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M7 8.5h6M7 11.5h4"/>',
    'vmd-kalk': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5"/>',
    'vmd-hus': '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    'vmd-offert': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    'vmd-dok': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    'vmd-v': '<path d="M15 18l-6-6 6-6"/>',
    'vmd-h': '<path d="M9 18l6-6-6-6"/>',
    'vmd-stopp': '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    'vmd-styr': '<path d="M5 3l13 6.5-5.5 1.8L10.7 17z"/><path d="M13 13l5 5"/>',
    'vmd-bock': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'vmd-las': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'vmd-anteckning': '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'vmd-skarm': '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };
  function ik(namn, klass) {
    return '<svg class="vm-ik vmd-ik' + (klass ? ' ' + klass : '') + '" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#' + namn + '"/></svg>';
  }
  function laggSprite() {
    if (D.getElementById('vmd-sprite')) return;
    var s = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('id', 'vmd-sprite'); s.setAttribute('class', 'vmd-sprite'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = Object.keys(IKONER).map(function (k) { return '<symbol id="' + k + '" viewBox="0 0 24 24">' + IKONER[k] + '</symbol>'; }).join('');
    (D.body || D.documentElement).appendChild(s);
  }

  var TYPER = {
    presentation: { namn: 'Presentationen', ikon: 'vmd-pres', bestamd: 'presentationen' },
    kalkyl: { namn: 'Kalkylen', ikon: 'vmd-kalk', bestamd: 'kalkylen' },
    '3d': { namn: 'Husen i 3D', ikon: 'vmd-hus', bestamd: 'husen i 3D' },
    offert: { namn: 'Offerten', ikon: 'vmd-offert', bestamd: 'offerten' },
    dokument: { namn: 'Bilder', ikon: 'vmd-dok', bestamd: 'bilderna' }
  };

  /* ---------- Tillstånd ---------- */
  // A = det som visas just nu (eget eller någon annans). H = säljarens eget arbetsläge (bara den som delar).
  var A = null, H = null, avLyss = null, valdAffar = null;
  var filer = {}; // id → {delar:[], antal, typ, url}
  var mvLaddad = false;

  function sig() { var m = M(); return m && m.signal || null; }
  function iMote() { var t = tillst(); return !!(t && t.fas === 'mote'); }
  function jag() { var t = tillst(); return t && t.jag || null; }
  function kanVisa() { var j = jag(); return !GAST && iMote() && !!j && j.roll !== 'gast' && !!(IH.db && IH.Mote && IH.Mote.kontext); }
  function deltagare(peer) { var t = tillst(); return t && (t.deltagare || []).filter(function (d) { return d.peer === peer; })[0] || null; }
  function vm() { return D.getElementById('vm'); }

  /* ---------- Signalen ---------- */
  function koppla() {
    if (avLyss) { try { avLyss(); } catch (x) { /* */ } avLyss = null; }
    var s = sig(); if (!s || typeof s.lyssna !== 'function') return;
    avLyss = s.lyssna(taEmot);
  }
  function skicka(till, typ, data) { var s = sig(); if (s) try { s.skicka(till || '*', typ, data); } catch (x) { /* */ } }
  function sandTillstand(till) {
    if (!A || !A.egen) return;
    skicka(till || '*', 'innehall', { typ: A.typ, v: A.v, data: A.data, styr: A.styr });
  }
  function sandSlut() { skicka('*', 'innehall', { typ: null, v: Date.now() }); }

  function taEmot(m) {
    if (!m || !m.data) return;
    var d = m.data;
    if (m.typ === 'innehall') {
      var dl = deltagare(m.fran);
      if (!dl || dl.roll === 'gast') return; // bara värd och kollegor visar innehåll
      if (d.typ === null || !TYPER[d.typ]) {
        if (A && !A.egen && A.peer === m.fran) { A = null; rensaFiler(); rita(); live(fornamn(dl.namn) + ' slutade visa.'); }
        return;
      }
      if (A && A.egen) { stoppaEgen(false); live(fornamn(dl.namn) + ' tog över visningen.'); }
      var ny = !A || A.peer !== m.fran || A.typ !== d.typ;
      if (!ny && tal(d.v, 0, 9e15) < A.v) return;
      A = { typ: d.typ, egen: false, peer: m.fran, namn: dl.namn, v: tal(d.v, 0, 9e15), data: d.data && typeof d.data === 'object' ? d.data : {}, styr: d.styr && typeof d.styr === 'object' ? d.styr : {} };
      if (ny) live(fornamn(dl.namn) + ' visar ' + TYPER[d.typ].bestamd + '.');
      rita();
    } else if (m.typ === 'innehall-forslag') {
      if (!A || !A.egen || !H) return;
      var fran = deltagare(m.fran); if (!fran) return;
      forslag(d, fran);
    } else if (m.typ === 'innehall-fil') {
      if (!A || A.egen || A.peer !== m.fran) return;
      taEmotFil(d);
    }
  }

  // Den som går med sent får det som visas
  var kanda = {};
  function nyaDeltagare(lista) {
    var nu = {};
    (lista || []).forEach(function (d) { nu[d.peer] = 1; if (!kanda[d.peer] && A && A.egen) { sandTillstand(d.peer); if (A.typ === 'dokument') sandFil(d.peer); } });
    kanda = nu;
  }

  /* ---------- Säljarens källor ---------- */
  function motetsVideomote() {
    var t = tillst(), id = t && t.mote && t.mote.id;
    return id && IH.videomote && IH.videomote.hamta ? IH.videomote.hamta(id) : null;
  }
  function affarerFor(kundId) {
    if (!IH.db || !kundId) return [];
    return IH.db.affarer.filter(function (a) { return a.kund === kundId; })
      .sort(function (a, b) { var ao = !a.forlorad && a.steg !== 'vunnen', bo = !b.forlorad && b.steg !== 'vunnen'; if (ao !== bo) return ao ? -1 : 1; return String(b.andrad || b.skapad || '') < String(a.andrad || a.skapad || '') ? -1 : 1; });
  }
  function kalla() {
    if (!IH.db) return { affar: null, kund: null, affarer: [] };
    var v = motetsVideomote(), f = IH.moteForberett ? IH.moteForberett() : null;
    var affar = valdAffar && IH.affar(valdAffar) || (v && v.affar && IH.affar(v.affar)) || null;
    var kundId = affar ? affar.kund : v && v.kund || null;
    if (!affar && !kundId && f && f.affar) { affar = IH.affar(f.affar); kundId = affar && affar.kund; }
    var lista = affarerFor(kundId);
    if (!affar && lista.length) affar = lista[0];
    return { affar: affar, kund: kundId ? IH.kund(kundId) : null, affarer: lista };
  }
  function bilderValda(affar) {
    var f = IH.moteForberett ? IH.moteForberett() : null;
    var alla = (IH.MOTE_BILDER || []).map(function (b) { return b.id; });
    var val = f && f.bilder && f.bilder.length ? f.bilder : alla;
    return val.filter(function (id) { return alla.indexOf(id) >= 0; });
  }
  function bildDokument(kund) {
    if (!kund || !IH.db || !Array.isArray(IH.db.dokument)) return [];
    return IH.db.dokument.filter(function (d) { return d.kund === kund.id && !d.arkiv && d.sparad !== false && /^image\/(png|jpeg|webp|gif)$/.test(String(d.typ || '')); }).slice(-24).reverse();
  }

  /* ---------- Starta och stoppa en egen visning ---------- */
  function visa(typ, opt) {
    opt = opt || {};
    if (!TYPER[typ]) return;
    if (!kanVisa()) { if (IH.toast) IH.toast('Inget videomöte pågår', 'Visa innehåll när du är med i ett videomöte.', 'varning'); return; }
    var t = tillst(), j = t.jag;
    // Skärmdelningen och innehållet tar samma plats – bara en sak visas åt gången
    if (j.delar) { var m = M(); try { m.slutaDela(); } catch (x) { /* */ } }
    var annan = (t.deltagare || []).filter(function (d) { return d.delar; })[0];
    if (annan) { live(fornamn(annan.namn) + ' delar sin skärm – vänta tills den är klar.'); if (IH.toast) IH.toast(fornamn(annan.namn) + ' delar sin skärm', 'Du kan visa innehåll när delningen är slut.', 'varning'); return; }
    if (opt.affar) valdAffar = opt.affar;
    var k = kalla();
    if (typ === 'offert' && !k.affar) { if (IH.toast) IH.toast('Ingen affär', 'Mötet har ingen affär med en offert.', 'varning'); return; }
    var c = IH.Mote.kontext({ affar: k.affar ? k.affar.id : null, kund: k.kund ? k.kund.id : null, bilder: opt.bilder || bilderValda(k.affar) });
    c.kalla = 'videomötet';
    var forra = H, sammaAffar = !!(forra && forra.c.affar === c.affar);
    if (sammaAffar) c.sparad = forra.c.sparad;
    // Kalkylen och anteckningarna följer med när man byter mellan presentationen och kalkylen
    H = { typ: typ, c: c, nu: 0, plan: 'inom', anteckning: forra ? forra.anteckning : '',
      kalkyl: sammaAffar && forra.kalkyl ? forra.kalkyl : JSON.parse(JSON.stringify(c.kalkyl)),
      hus: c.modell && IH.modell(c.modell) && IH.modell(c.modell).glb ? c.modell : 'r1', orbit: '32deg 74deg auto', dok: null, kundKan: false };
    if (typ === 'presentation' && opt.start) H.nu = Math.max(0, c.bilder.indexOf(opt.start));
    if (typ === 'dokument') { var l = bildDokument(c.kund); H.dok = l[0] ? l[0].id : null; }
    A = { typ: typ, egen: true, peer: j.peer, namn: j.namn, v: Date.now(), data: {}, styr: {} };
    bygg();
    rita();
    if (typ === 'dokument') sandFil('*');
    live('Du visar ' + TYPER[typ].bestamd + '.');
    // Minimerat möte (t.ex. från Kundmöte-sidan): öppna mötet så att man ser vad kunden ser
    var ui = IH.samtalUi && IH.samtalUi.tillstand && IH.samtalUi.tillstand();
    if (ui && ui.mini && IH.samtalUi.minimera) try { IH.samtalUi.minimera(false); } catch (x) { /* */ }
  }
  function stoppaEgen(meddela) {
    if (!A || !A.egen) return;
    A = null;
    if (meddela !== false) sandSlut();
    rita();
  }
  function stoppa() { if (A && A.egen) { stoppaEgen(true); live('Du slutade visa.'); } }

  // Bygger datan som skickas av säljarens arbetsläge och skickar den
  function bygg() {
    if (!A || !A.egen || !H) return;
    var c = H.c, d = {};
    A.styr = { kund: !!H.kundKan };
    if (A.typ === 'presentation') {
      var id = c.bilder[H.nu], b = IH.Mote.bildData(id, c) || { id: id, namn: id };
      d = { nu: H.nu, antal: c.bilder.length, bild: b, plan: H.plan };
      if (id === 'kalkyl') d.kalkyl = kalkylData();
    } else if (A.typ === 'kalkyl') {
      d = kalkylData();
    } else if (A.typ === '3d') {
      d = { hus: IH.MODELLER.filter(function (x) { return x.glb; }).map(function (x) { return { id: x.id, namn: x.namn, kategori: x.kategori, yta: x.yta, rum: x.rum, matt: x.matt, bild: x.tumme, glb: x.glb }; }), vald: H.hus, orbit: H.orbit };
    } else if (A.typ === 'offert') {
      var o = c.affar ? (c.sparad && IH.db.offerter.indexOf(c.sparad) >= 0 ? c.sparad : IH.offertFor(c.affar.id)) : null;
      d = o ? { nummer: o.nummer, status: o.status, skapad: o.skapad, giltig: o.giltig || 30, rader: (o.rader || []).slice(0, 40).map(function (r) { return { text: str(r.text, 160), antal: Number(r.antal) || 0, pris: Number(r.pris) || 0 }; }),
        summa: IH.summaOffert(o), kund: c.kund ? c.kund.namn : '', affar: c.affar.titel } : { tom: true, affar: c.affar ? c.affar.titel : '' };
    } else if (A.typ === 'dokument') {
      var l = bildDokument(c.kund);
      d = { lista: l.map(function (x) { return { id: x.id, namn: str(x.namn, 120) }; }), vald: H.dok, fil: H.dok ? { id: H.dok } : null };
    }
    A.data = d;
    A.v = Math.max(A.v + 1, Date.now());
    sandTillstand('*');
  }
  function kalkylData() {
    var c = H.c, k = H.kalkyl, m = IH.modell(k.modell);
    var rader = IH.Mote.kalkylRader(k);
    return {
      modell: k.modell, antal: k.antal || 1, tillval: Object.keys(k.tillval || {}).filter(function (x) { return k.tillval[x]; }),
      modeller: IH.MODELLER.filter(function (x) { return x.id !== 'element'; }).map(function (x) { return { id: x.id, namn: x.namn, yta: x.yta, bild: x.tumme }; }),
      tillvalLista: IH.Mote.tillvalLista(),
      hus: { namn: m.namn, kategori: m.kategori, yta: m.yta, rum: m.rum, matt: m.matt, bild: m.bild },
      rader: rader.map(function (r) { return { text: str(r.text, 160), antal: r.antal, pris: r.pris }; }),
      summa: rader.reduce(function (t, r) { return t + r.pris * r.antal; }, 0),
      las: c.affar ? c.las || '' : 'Mötet har ingen affär – kalkylen kan inte sparas som offert.',
      sparad: c.sparad ? c.sparad.nummer : '', affar: c.affar ? c.affar.titel : ''
    };
  }

  /* ---------- Ändringar (säljaren direkt, kunden som förslag) ---------- */
  function andra(a) {
    if (!A) return;
    if (A.egen) { tillampa(a); return; }
    if (!A.styr || !A.styr.kund) return;
    skicka(A.peer, 'innehall-forslag', { typ: A.typ, andring: a });
    // Kunden ser sin ändring direkt; säljarens svar skriver över
    if (A.typ === '3d' && a.orbit) A.data.orbit = a.orbit;
  }
  function forslag(d, fran) {
    if (!d || d.typ !== A.typ || !H.kundKan) return;
    var a = d.andring && typeof d.andring === 'object' ? d.andring : {};
    // Kunden får bara ändra det som styrs: bild, kalkylens val och kameran
    var ok = {};
    if (A.typ === 'presentation' && a.nu != null) ok.nu = a.nu;
    if (A.typ === 'kalkyl') ['modell', 'tillval', 'antal'].forEach(function (k) { if (a[k] != null) ok[k] = a[k]; });
    if (A.typ === '3d') ['orbit', 'hus'].forEach(function (k) { if (a[k] != null) ok[k] = a[k]; });
    if (Object.keys(ok).length) { tillampa(ok, 'kund'); if (ok.modell || ok.tillval || ok.antal) live(fornamn(fran.namn) + ' ändrade kalkylen.'); }
  }
  function tillampa(a, fran) {
    if (!H) return;
    var c = H.c;
    if (a.nu != null) H.nu = Math.max(0, Math.min(c.bilder.length - 1, Math.round(tal(a.nu, 0, 99))));
    if (a.plan === 'inom' || a.plan === 'utanfor') H.plan = a.plan;
    if (a.modell && IH.modell(a.modell) && a.modell !== 'element') H.kalkyl.modell = a.modell;
    if (a.tillval) { var tv = str(a.tillval, 30); if (IH.Mote.tillvalLista().some(function (x) { return x.id === tv; })) { H.kalkyl.tillval[tv] = !H.kalkyl.tillval[tv]; } }
    if (a.antal != null) H.kalkyl.antal = Math.max(1, Math.min(50, (H.kalkyl.antal || 1) + (Number(a.antal) > 0 ? 1 : -1)));
    if (a.hus && IH.modell(a.hus) && IH.modell(a.hus).glb) H.hus = a.hus;
    if (a.orbit) { var ob = orbitRen(a.orbit); if (ob) { H.orbit = ob; if (A.typ === '3d') { A.data.orbit = ob; A.v = Math.max(A.v + 1, Date.now()); sandTillstand('*'); if (fran === 'kund') satt3dOrbit(ob); return; } } }
    if (a.dok) { var finns = bildDokument(c.kund).some(function (x) { return x.id === a.dok; }); if (finns) { H.dok = a.dok; bygg(); rita(); sandFil('*'); return; } }
    if (a.kundKan != null) H.kundKan = !!a.kundKan;
    bygg();
    rita();
  }
  function orbitRen(o) {
    var m = /^(-?\d{1,4}(?:\.\d{1,3})?)deg (\d{1,3}(?:\.\d{1,3})?)deg (auto|\d{1,3}(?:\.\d{1,4})?m)$/.exec(str(o, 60));
    return m ? m[1] + 'deg ' + m[2] + 'deg ' + m[3] : '';
  }
  function sparaOffert(knapp) {
    if (!H || !H.c.affar || H.c.las) return;
    var sv = IH.Mote.sparaOffert(H.c, H.kalkyl);
    if (!sv) return;
    var o = sv.offert;
    if (knapp && IH.konfetti && !lugnMq.matches) { var r = knapp.getBoundingClientRect(); IH.konfetti(r.left + r.width / 2, r.top); }
    if (IH.toast) IH.toast('Offerten är sparad', o.nummer + ' · ' + kr(IH.summaOffert(o)) + (sv.vantar ? ' · utkast – den skickade offerten gäller tills du skickar den nya.' : ''), 'offert');
    if (IH.ritaOm) try { IH.ritaOm(); } catch (x) { /* */ }
    bygg(); rita();
  }

  /* ---------- Bilder (dokument) skickas i bitar ---------- */
  var BIT = 1800;
  function sandFil(till) {
    if (!A || !A.egen || A.typ !== 'dokument' || !H || !H.dok) return;
    var id = H.dok;
    hamtaBild(id).then(function (url) {
      if (!A || !A.egen || A.typ !== 'dokument' || H.dok !== id) return;
      if (!url) {
        // Filen finns inte i den här webbläsarens arkiv (uppladdad på en annan dator) – säg det i stället för att snurra
        filer[id] = { fel: true }; rita();
        skicka(till, 'innehall-fil', { id: id, fel: true });
        return;
      }
      filer[id] = { url: url, klar: true };
      rita();
      var b64 = url.slice(url.indexOf(',') + 1), antal = Math.ceil(b64.length / BIT), del = 0;
      (function skickaNasta() {
        if (!A || !A.egen || H.dok !== id) return;
        for (var n = 0; n < 40 && del < antal; n++, del++) skicka(till, 'innehall-fil', { id: id, del: del, antal: antal, typ: 'image/jpeg', bit: b64.slice(del * BIT, (del + 1) * BIT) });
        if (del < antal) setTimeout(skickaNasta, 16);
      })();
    });
  }
  // Bilden skalas om till högst 1600 px och kodas som JPEG – mindre att skicka och inga dolda metadata följer med
  function hamtaBild(id) {
    if (filer[id] && filer[id].url) return Promise.resolve(filer[id].url);
    return new Promise(function (ok) {
      try {
        var r = indexedDB.open('ih-crm-filer', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('filer'); };
        r.onerror = function () { ok(null); };
        r.onsuccess = function () {
          try {
            var q = r.result.transaction('filer').objectStore('filer').get(id);
            q.onerror = function () { ok(null); };
            q.onsuccess = function () {
              var blob = q.result; if (!blob) { ok(null); return; }
              var u = URL.createObjectURL(blob), img = new Image();
              img.onload = function () {
                var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = D.createElement('canvas');
                c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
                var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(u);
                try { ok(c.toDataURL('image/jpeg', 0.86)); } catch (err) { ok(null); }
              };
              img.onerror = function () { URL.revokeObjectURL(u); ok(null); };
              img.src = u;
            };
          } catch (err) { ok(null); }
        };
      } catch (err) { ok(null); }
    });
  }
  function taEmotFil(d) {
    var id = str(d.id, 40), del = Math.round(tal(d.del, 0, 20000)), antal = Math.round(tal(d.antal, 1, 20000));
    if (id && d.fel === true) { filer[id] = { fel: true }; rita(); return; }
    if (!id || typeof d.bit !== 'string' || !/^[A-Za-z0-9+/=]*$/.test(d.bit)) return;
    var f = filer[id];
    if (!f || f.antal !== antal) f = filer[id] = { delar: [], antal: antal, fatt: 0, url: '' };
    if (f.url) return;
    if (f.delar[del] == null) { f.delar[del] = d.bit; f.fatt++; }
    if (f.fatt >= antal) { f.url = 'data:image/jpeg;base64,' + f.delar.join(''); f.delar = []; rita(); }
    else if (f.fatt % 25 === 0) ritaFilProcent(id);
  }
  function rensaFiler() { filer = {}; }

  /* ---------- Rita ---------- */
  function live(text) {
    var v = vm(), l = v && v.querySelector('.vm-live');
    if (l) { l.textContent = ''; setTimeout(function () { l.textContent = text; }, 30); }
  }
  function titelRader(t) {
    var r = Array.isArray(t) ? t.slice(0, 3).map(function (x) { return str(x, 80); }) : [str(t, 120)];
    return r.map(function (x, n) { return n === r.length - 1 && r.length > 1 ? '<em>' + e(x) + '</em>' : e(x); }).join('<br>');
  }
  function bildHtml(b, d) {
    b = b && typeof b === 'object' ? b : {};
    var id = str(b.id, 20), bild = sakerUrl(b.bild);
    var text = '<p class="vmd-b__etikett">' + e(str(b.etikett, 120)) + '</p><h2 class="vmd-b__titel">' + titelRader(b.titel) + '</h2>';
    var h = '';
    if (id === 'er') {
      text += (b.citat ? '<blockquote class="vmd-b__citat"><p>' + e(str(b.citat, 600)) + '</p><cite>' + e(str(b.kalla, 120)) + '</cite></blockquote>' : '') +
        '<dl class="vmd-b__fakta">' + (Array.isArray(b.fakta) ? b.fakta.slice(0, 4) : []).map(function (x) { return '<div><dt>' + e(str(x && x[0], 40)) + '</dt><dd>' + e(str(x && x[1], 80)) + '</dd></div>'; }).join('') + '</dl>';
      var fs = b.forslag && typeof b.forslag === 'object' ? b.forslag : null;
      h = '<div class="vmd-b__delad"><div class="vmd-b__text">' + text + '</div><div class="vmd-b__bildkol">' + (bild ? '<figure class="vmd-b__foto"><img src="' + bild + '" alt=""></figure>' : '') +
        (fs ? '<div class="vmd-b__forslag">' + (sakerUrl(fs.bild) ? '<img src="' + sakerUrl(fs.bild) + '" alt="">' : '') + '<span><small>Vårt förslag</small><b>' + e(str(fs.namn, 80)) + '</b><em>' + e(str(fs.varfor, 200)) + '</em></span></div>' : '') + '</div></div>';
    } else if (id === 'hantverk') {
      h = (bild ? '<img class="vmd-b__bak" src="' + bild + '" alt="">' : '') + '<div class="vmd-b__slojan"></div><div class="vmd-b__text vmd-b__text--over">' + text +
        '<p class="vmd-b__brod">' + e(str(b.text, 400)) + '</p><div class="vmd-b__chips">' + (Array.isArray(b.chips) ? b.chips.slice(0, 5) : []).map(function (c) { return '<span>' + e(str(c, 40)) + '</span>'; }).join('') + '</div></div>';
    } else if (id === 'husen') {
      h = '<div class="vmd-b__text">' + text + '</div><ul class="vmd-b__hus">' + (Array.isArray(b.hus) ? b.hus.slice(0, 8) : []).map(function (x) {
        x = x || {};
        return '<li' + (x.id === b.vald ? ' class="vald"' : '') + '>' + (sakerUrl(x.bild) ? '<img src="' + sakerUrl(x.bild) + '" alt="">' : '') + '<b>' + e(str(x.namn, 40)) + '</b><small>' + e(str(x.kategori, 40)) + ' · ' + e(str(x.yta, 6)) + ' m²</small></li>';
      }).join('') + '</ul>';
    } else if (id === 'regler') {
      var plan = d && d.plan === 'utanfor' ? 'utanfor' : 'inom', styr = A && (A.egen || (A.styr && A.styr.kund));
      h = '<div class="vmd-b__delad"><div class="vmd-b__text">' + text +
        '<div class="vmd-b__vaxel" role="group" aria-label="Var ligger tomten?">' + [['inom', 'Inom detaljplan'], ['utanfor', 'Utanför detaljplan']].map(function (p) {
          return '<button type="button" data-vmd-plan="' + p[0] + '" aria-pressed="' + (plan === p[0]) + '"' + (A && A.egen ? '' : ' disabled') + '>' + p[1] + '</button>';
        }).join('') + '</div><p class="vmd-b__brod">' + e(str(b.text, 400)) + '</p></div>' +
        '<div class="vmd-b__tal">' + (Array.isArray(b.tal) ? b.tal.slice(0, 4) : []).map(function (r) {
          r = Array.isArray(r) ? r : [];
          return '<div><small>' + e(str(r[0], 40)) + '</small><b>' + e(str(plan === 'inom' ? r[1] : r[2], 8)) + '</b><span>' + e(str(r[3], 4)) + '</span></div>';
        }).join('') + '</div></div>';
      void styr;
    } else if (id === 'resan') {
      h = '<div class="vmd-b__text">' + text + '</div><ol class="vmd-b__steg vmd-b__steg--sju">' + (Array.isArray(b.steg) ? b.steg.slice(0, 8) : []).map(function (s, n) {
        s = Array.isArray(s) ? s : [];
        return '<li><span class="vmd-b__nr">' + (n + 1) + '</span><b>' + e(str(s[0], 40)) + '</b><p>' + e(str(s[1], 120)) + '</p><small>' + e(str(s[2], 20)) + '</small></li>';
      }).join('') + '</ol>';
    } else if (id === 'kalkyl') {
      h = '<div class="vmd-b__delad"><div class="vmd-b__text">' + text + '</div><div class="vmd-b__bildkol">' + kvittoHtml(d && d.kalkyl, false) + '</div></div>';
    } else if (id === 'nasta') {
      h = '<div class="vmd-b__text">' + text + '</div><ol class="vmd-b__steg">' + (Array.isArray(b.steg) ? b.steg.slice(0, 4) : []).map(function (s, n) {
        s = Array.isArray(s) ? s : [];
        return '<li><span class="vmd-b__nr">0' + (n + 1) + '</span><b>' + e(str(s[0], 40)) + '</b><p>' + e(str(s[1], 160)) + '</p></li>';
      }).join('') + '</ol><p class="vmd-b__kontakt">' + e(str(b.text, 120)) + '</p>';
    } else {
      h = '<div class="vmd-b__delad"><div class="vmd-b__text">' + text + (b.text ? '<p class="vmd-b__brod">' + e(str(b.text, 400)) + '</p>' : '') + '</div>' +
        (bild ? '<div class="vmd-b__bildkol"><figure class="vmd-b__foto"><img src="' + bild + '" alt=""></figure></div>' : '') + '</div>';
    }
    return '<article class="vmd-bild vmd-bild--' + e(id) + '" aria-label="' + e(str(b.namn, 60)) + '">' + h + '</article>';
  }

  function kvittoHtml(k, verktyg) {
    if (!k || typeof k !== 'object') return '';
    var hus = k.hus && typeof k.hus === 'object' ? k.hus : {};
    var rader = Array.isArray(k.rader) ? k.rader.slice(0, 30) : [];
    var egen = A && A.egen;
    var knapp = '';
    if (verktyg && egen) {
      knapp = k.las ? '<p class="vmd-kvitto__las">' + ik('vmd-las') + e(str(k.las, 160)) + '</p>'
        : '<button type="button" class="vmd-knapp vmd-knapp--accent" data-vmd="spara-offert">' + ik('vmd-offert') + '<span>' + (k.sparad ? 'Uppdatera ' + e(str(k.sparad, 30)) : 'Spara som offert') + '</span></button>' +
          (k.sparad ? '<p class="vmd-kvitto__sparad">' + ik('vmd-bock') + 'Sparad som ' + e(str(k.sparad, 30)) + '</p>' : '');
    } else if (verktyg && k.sparad) knapp = '<p class="vmd-kvitto__sparad">' + ik('vmd-bock') + 'Sparad som offert ' + e(str(k.sparad, 30)) + '</p>';
    return '<div class="vmd-kvitto">' +
      '<div class="vmd-kvitto__huvud">' + (sakerUrl(hus.bild) ? '<span class="vmd-kvitto__bild"><img src="' + sakerUrl(hus.bild) + '" alt=""></span>' : '') +
        '<span><small>' + e(str(hus.kategori, 40)) + '</small><b>' + e(str(hus.namn, 40)) + '</b><em>' + e(str(hus.yta, 6)) + ' m² · ' + e(str(hus.rum, 4)) + ' rum · ' + e(str(hus.matt, 40)) + '</em></span></div>' +
      '<ul class="vmd-kvitto__rader">' + rader.map(function (r) {
        r = r || {}; var antal = Math.round(tal(r.antal, 0, 999));
        return '<li><span>' + (antal > 1 ? antal + ' × ' : '') + e(str(r.text, 160)) + '</span><b>' + kr(tal(r.pris, -1e9, 1e9) * antal) + '</b></li>';
      }).join('') + '</ul>' +
      '<div class="vmd-kvitto__summa"><span>Totalt</span><b>' + kr(tal(k.summa, -1e10, 1e10)) + '</b></div>' +
      '<p class="vmd-kvitto__not">Exempelpriser i prototypen. Grund, bygglov och anslutningar tillkommer.</p>' + knapp + '</div>';
  }

  function kalkylHtml(k) {
    var kan = A.egen || (A.styr && A.styr.kund);
    var dis = kan ? '' : ' disabled';
    var tv = Array.isArray(k.tillval) ? k.tillval : [];
    return '<div class="vmd-kalkyl">' +
      '<div class="vmd-kalkyl__val"><div class="vmd-styrplats"></div>' +
        '<p class="vmd-rubrik">Hus</p><div class="vmd-kalkyl__modeller">' + (Array.isArray(k.modeller) ? k.modeller.slice(0, 10) : []).map(function (x) {
          x = x || {};
          return '<button type="button" class="vmd-modell' + (x.id === k.modell ? ' vald' : '') + '" data-vmd-modell="' + e(str(x.id, 20)) + '" aria-pressed="' + (x.id === k.modell) + '"' + dis + '>' +
            (sakerUrl(x.bild) ? '<img src="' + sakerUrl(x.bild) + '" alt="">' : '') + '<b>' + e(str(x.namn, 40)) + '</b><small>' + e(str(x.yta, 6)) + ' m²</small></button>';
        }).join('') + '</div>' +
        '<p class="vmd-rubrik">Antal hus</p><div class="vmd-kalkyl__antal" role="group" aria-label="Antal hus"><button type="button" class="vmd-chip" data-vmd-antal="-1" aria-label="Ett hus färre"' + dis + '>−</button>' +
          '<span class="vmd-chip vald" aria-live="polite">' + Math.round(tal(k.antal, 1, 50)) + ' hus</span><button type="button" class="vmd-chip" data-vmd-antal="1" aria-label="Ett hus till"' + dis + '>+</button></div>' +
        '<p class="vmd-rubrik">Tillval</p><div class="vmd-kalkyl__tillval">' + (Array.isArray(k.tillvalLista) ? k.tillvalLista.slice(0, 12) : []).map(function (p) {
          p = p || {}; var pa = tv.indexOf(p.id) >= 0;
          return '<button type="button" class="vmd-chip' + (pa ? ' vald' : '') + '" data-vmd-tillval="' + e(str(p.id, 20)) + '" aria-pressed="' + pa + '"' + dis + '>' + ik('vmd-bock') + e(str(p.text, 60)) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="vmd-kalkyl__kvitto">' + kvittoHtml(k, true) + '</div></div>';
  }

  function offertHtml(o) {
    if (!o || o.tom) return '<div class="vmd-tomt">' + ik('vmd-offert') + '<b>Ingen offert än</b><p>' + (o && o.affar ? 'Affären ' + e(str(o.affar, 80)) + ' har ingen offert. Räkna i kalkylen och spara den som offert.' : 'Mötet har ingen affär.') + '</p></div>';
    var STATUS = { utkast: 'Utkast', skickad: 'Skickad', godkand: 'Godkänd', avbojd: 'Avböjd' };
    var sk = new Date(str(o.skapad, 40)), gilt = isNaN(sk) ? null : new Date(sk.getTime() + tal(o.giltig, 1, 365) * 864e5);
    var dag = function (d) { return d ? d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'; };
    var rader = Array.isArray(o.rader) ? o.rader.slice(0, 40) : [];
    return '<article class="vmd-offert"><header class="vmd-offert__huvud"><div><p class="vmd-rubrik">Offert</p><h2>' + e(str(o.nummer, 30)) + '</h2><p>' + e(str(o.kund, 80)) + ' · ' + e(str(o.affar, 80)) + '</p></div>' +
      '<dl><div><dt>Status</dt><dd>' + e(STATUS[o.status] || 'Utkast') + '</dd></div><div><dt>Datum</dt><dd>' + e(dag(isNaN(sk) ? null : sk)) + '</dd></div><div><dt>Giltig till</dt><dd>' + e(dag(gilt)) + '</dd></div></dl></header>' +
      '<table class="vmd-offert__rader"><thead><tr><th scope="col">Post</th><th scope="col">Antal</th><th scope="col">Pris</th><th scope="col">Summa</th></tr></thead><tbody>' + rader.map(function (r) {
        r = r || {}; var a = Math.round(tal(r.antal, 0, 999)), p = tal(r.pris, -1e9, 1e9);
        return '<tr><td>' + e(str(r.text, 160)) + '</td><td>' + a + '</td><td>' + kr(p) + '</td><td>' + kr(a * p) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><th scope="row" colspan="3">Totalt inkl. moms</th><td>' + kr(tal(o.summa, -1e10, 1e10)) + '</td></tr></tfoot></table>' +
      '<p class="vmd-kvitto__not">Exempelpriser i prototypen. Grund, bygglov och anslutningar tillkommer.</p></article>';
  }

  function dokumentHtml(d) {
    var lista = Array.isArray(d.lista) ? d.lista.slice(0, 24) : [], vald = str(d.vald, 40), f = vald && filer[vald];
    var stor = !vald ? '<div class="vmd-tomt">' + ik('vmd-dok') + '<b>Inga bilder hos kunden</b><p>Bilder som laddats upp under Dokument visas här. PDF:er och andra filer visar du med Dela skärm.</p></div>'
      : f && f.fel ? '<div class="vmd-tomt">' + ik('vmd-dok') + '<b>Bilden kunde inte visas</b><p>' + (A.egen ? 'Den finns inte i den här webbläsaren – den laddades upp på en annan dator. Välj en annan bild eller visa den med Dela skärm.' : 'Den som visar får välja en annan bild.') + '</p></div>'
      : f && f.url ? '<figure class="vmd-dok__bild"><img src="' + e(f.url) + '" alt="' + e(namnFor(lista, vald)) + '"><figcaption>' + e(namnFor(lista, vald)) + '</figcaption></figure>'
      : '<div class="vmd-tomt" data-vmd-fil="' + e(vald) + '"><span class="vmd-laddar" aria-hidden="true"></span><b>Bilden laddas …</b><p class="vmd-procent">' + procent(vald) + '</p></div>';
    var sida = A.egen && lista.length > 1 ? '<ul class="vmd-dok__lista" aria-label="Kundens bilder">' + lista.map(function (x) {
      return '<li><button type="button" data-vmd-dok="' + e(str(x.id, 40)) + '" aria-pressed="' + (x.id === vald) + '"' + (x.id === vald ? ' class="vald"' : '') + '>' + ik('vmd-dok') + '<span>' + e(str(x.namn, 120)) + '</span></button></li>';
    }).join('') + '</ul>' : '';
    return '<div class="vmd-dok' + (sida ? ' vmd-dok--lista' : '') + '">' + sida + '<div class="vmd-dok__yta">' + stor + '</div></div>';
  }
  function namnFor(lista, id) { var x = lista.filter(function (y) { return y && y.id === id; })[0]; return x ? str(x.namn, 120) : 'Bild'; }
  function procent(id) { var f = filer[id]; return f && f.antal ? Math.round(f.fatt / f.antal * 100) + ' %' : ''; }
  function ritaFilProcent(id) { var v = vm(), p = v && v.querySelector('[data-vmd-fil="' + id + '"] .vmd-procent'); if (p) p.textContent = procent(id); }

  function laddaModelViewer() {
    if (window.customElements && customElements.get('model-viewer')) return;
    if (IH.laddaModelViewer) { IH.laddaModelViewer(); return; }
    if (mvLaddad) return;
    mvLaddad = true;
    var s = D.createElement('script'); s.type = 'module'; s.src = '../vendor/model-viewer.min.js'; D.head.appendChild(s);
  }
  function tredHtml(d) {
    var hus = Array.isArray(d.hus) ? d.hus.slice(0, 8) : [], kan = A.egen || (A.styr && A.styr.kund);
    return '<div class="vmd-3d"><div class="vmd-3d__sida"><div class="vmd-styrplats"></div><ul class="vmd-3d__lista" aria-label="Husen">' + hus.map(function (x) {
      x = x || {};
      return '<li><button type="button" data-vmd-hus="' + e(str(x.id, 20)) + '" aria-pressed="' + (x.id === d.vald) + '"' + (x.id === d.vald ? ' class="vald"' : '') + (kan ? '' : ' disabled') + '>' +
        (sakerUrl(x.bild) ? '<img src="' + sakerUrl(x.bild) + '" alt="">' : '') + '<span><b>' + e(str(x.namn, 40)) + '</b><small>' + e(str(x.kategori, 40)) + ' · ' + e(str(x.yta, 6)) + ' m²</small></span></button></li>';
    }).join('') + '</ul></div><div class="vmd-3d__scen" data-vmd-mv></div></div>';
  }
  function ritaMv(rot) {
    var d = A.data, scen = rot.querySelector('[data-vmd-mv]'); if (!scen) return;
    var hus = (Array.isArray(d.hus) ? d.hus : []).filter(function (x) { return x && x.id === d.vald; })[0], glb = hus && sakerUrl(hus.glb);
    var kan = A.egen || (A.styr && A.styr.kund);
    var mv = scen.querySelector('model-viewer');
    if (!glb) { scen.innerHTML = ''; return; }
    laddaModelViewer();
    if (!mv || mv.getAttribute('src') !== glb) {
      scen.innerHTML = '<model-viewer src="' + e(glb) + '" alt="' + e(str(hus.namn, 40)) + ' i 3D" interaction-prompt="none" shadow-intensity="1.1" shadow-softness="0.9" exposure="1.38" environment-image="neutral" tone-mapping="neutral" disable-zoom' +
        ' camera-orbit="' + e(orbitRen(d.orbit) || '32deg 74deg auto') + '" interpolation-decay="' + (lugnMq.matches ? '40' : '120') + '"></model-viewer>' +
        '<div class="vmd-3d__fakta"><small>' + e(str(hus.kategori, 40)) + '</small><b>' + e(str(hus.namn, 40)) + '</b><span>' + e(str(hus.yta, 6)) + ' m² · ' + e(str(hus.rum, 4)) + ' rum · ' + e(str(hus.matt, 40)) + '</span></div>' +
        '<p class="vmd-3d__tips">' + (kan ? 'Dra för att vrida huset – ' + (A.egen ? 'kunden ser samma vinkel' : 'säljaren ser samma vinkel') : 'Du ser samma vinkel som ' + e(fornamn(A.namn))) + '</p>';
      mv = scen.querySelector('model-viewer');
      var skickad = 0, vantar = null;
      mv.addEventListener('pointerdown', function () { mv.__vmdDrar = true; });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (h) { mv.addEventListener(h, function () { setTimeout(function () { mv.__vmdDrar = false; }, 250); }); });
      mv.addEventListener('camera-change', function (ev) {
        if (!ev.detail || ev.detail.source !== 'user-interaction' || !A) return;
        var orb = orbitAv(mv); if (!orb) return;
        var nu = Date.now();
        var gor = function () { skickad = Date.now(); vantar = null; if (A) andra({ orbit: orbitAv(mv) || orb }); };
        if (nu - skickad >= 100) gor(); else if (!vantar) vantar = setTimeout(gor, 100 - (nu - skickad));
      });
    }
    mv.toggleAttribute('camera-controls', !!kan);
    var tips = scen.querySelector('.vmd-3d__tips'); if (tips) tips.textContent = kan ? 'Dra för att vrida huset – ' + (A.egen ? 'kunden ser samma vinkel' : 'säljaren ser samma vinkel') : 'Du ser samma vinkel som ' + fornamn(A.namn);
    if (!A.egen && d.orbit) satt3dOrbit(d.orbit);
  }
  function orbitAv(mv) {
    // Zoomen är avstängd, så bara vinkeln skickas – avståndet räknar model-viewer fram själv
    try { var o = mv.getCameraOrbit(); return orbitRen((o.theta * 180 / Math.PI).toFixed(1) + 'deg ' + (o.phi * 180 / Math.PI).toFixed(1) + 'deg auto'); } catch (x) { return ''; }
  }
  function satt3dOrbit(o) {
    var v = vm(), mv = v && v.querySelector('.vmd-yta model-viewer'); if (!mv) return;
    var ren = orbitRen(o); if (!ren) return;
    // Egen dragning pågår: skriv inte över den med ett äldre läge
    if (mv.__vmdDrar) return;
    if (mv.getAttribute('camera-orbit') !== ren) mv.setAttribute('camera-orbit', ren);
  }

  // "Låt kunden ändra" hos säljaren, "Du kan ändra" / "Ahmed styr" hos de andra. Grans banderoll (.vm-delar) visar vem som visar vad.
  var STYR = { presentation: ['Kunden kan bläddra', 'Du kan bläddra', 'Kunden kan byta bild själv'], kalkyl: ['Låt kunden ändra', 'Du kan ändra kalkylen', 'Kunden kan välja hus och tillval'], '3d': ['Ge kunden kontroll', 'Du kan vrida huset', 'Kunden kan vrida huset och byta hus'] };
  function styrHtml() {
    var s = STYR[A.typ]; if (!s) return '';
    if (A.egen) return '<label class="vmd-brytare" title="' + e(s[2]) + '"><input type="checkbox" data-vmd-kund' + (A.styr && A.styr.kund ? ' checked' : '') + '><span class="vmd-brytare__spar" aria-hidden="true"></span><span>' + e(s[0]) + '</span></label>';
    return '<p class="vmd-styr' + (A.styr && A.styr.kund ? ' vmd-styr--pa' : '') + '">' + ik(A.styr && A.styr.kund ? 'vmd-styr' : 'vmd-las') + '<span>' + e(A.styr && A.styr.kund ? s[1] : fornamn(A.namn) + ' styr') + '</span></p>';
  }
  function ritaStyr(rot) {
    rot.querySelectorAll('.vmd-styrplats').forEach(function (p) {
      var f = p.contains(D.activeElement);
      p.innerHTML = styrHtml();
      if (f) { var i = p.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
    });
  }

  // Presentatörsvyn: nästa bild, anteckningar och bildlistan (bara säljaren)
  function presentatorHtml() {
    var c = H.c;
    var nasta = c.bilder[H.nu + 1], nb = nasta && (IH.MOTE_BILDER || []).filter(function (x) { return x.id === nasta; })[0];
    return '<aside class="vmd-pres" aria-label="Presentatörsvy">' +
      '<div class="vmd-styrplats"></div><div class="vmd-pres__nav"><button type="button" class="vmd-knapp vmd-knapp--ikon" data-vmd="bak" aria-label="Föregående bild"' + (H.nu === 0 ? ' disabled' : '') + '>' + ik('vmd-v') + '</button>' +
        '<span class="vmd-pres__nr"><b>' + (H.nu + 1) + '</b> / ' + c.bilder.length + '</span>' +
        '<button type="button" class="vmd-knapp vmd-knapp--ikon" data-vmd="fram" aria-label="Nästa bild"' + (H.nu >= c.bilder.length - 1 ? ' disabled' : '') + '>' + ik('vmd-h') + '</button></div>' +
      '<p class="vmd-rubrik">Nästa bild</p>' +
      (nb ? '<button type="button" class="vmd-pres__nasta" data-vmd="fram"><img src="' + e(sakerUrl(nb.bild)) + '" alt=""><span>' + e(nb.namn) + '</span></button>' : '<p class="vmd-pres__slut">Det här är sista bilden.</p>') +
      '<label class="vmd-pres__ant"><span class="vmd-rubrik">' + ik('vmd-anteckning') + 'Anteckningar <small>bara du ser dem</small></span><textarea data-vmd-anteckning rows="5" maxlength="4000" placeholder="Tomten, tidplanen, frågor att återkomma om…">' + e(H.anteckning || '') + '</textarea></label>' +
      '<p class="vmd-rubrik">Bilder</p><ol class="vmd-pres__lista">' + c.bilder.map(function (id, n) {
        var bb = (IH.MOTE_BILDER || []).filter(function (x) { return x.id === id; })[0] || { namn: id };
        return '<li><button type="button" data-vmd-till="' + n + '"' + (n === H.nu ? ' aria-current="step" class="nu"' : '') + '><span>' + (n + 1) + '</span>' + e(bb.namn) + '</button></li>';
      }).join('') + '</ol></aside>';
  }

  var ritadNyckel = '';
  function rita() {
    var v = vm(); if (!v) return;
    var yta = v.querySelector('.vm-yta');
    var visas = !!(A && iMote() && yta);
    var rot = yta && yta.querySelector(':scope > .vmd-yta');
    if (!visas) {
      meddela();
      if (rot) { var gammal = rot; gammal.classList.add('vmd-yta--ut'); setTimeout(function () { gammal.remove(); }, lugnMq.matches ? 0 : 180); }
      v.removeAttribute('data-vmd'); v.removeAttribute('data-vmd-egen');
      ritadNyckel = '';
      return;
    }
    laggSprite();
    v.setAttribute('data-vmd', A.typ);
    v.toggleAttribute('data-vmd-egen', !!A.egen);
    if (!rot || rot.classList.contains('vmd-yta--ut')) {
      rot = D.createElement('div'); rot.className = 'vmd-yta'; rot.setAttribute('role', 'region');
      rot.innerHTML = '<div class="vmd-huvud"><div class="vmd-kropp" tabindex="-1"></div></div>';
      yta.insertBefore(rot, yta.firstChild);
    }
    rot.setAttribute('aria-label', TYPER[A.typ].namn);
    rot.setAttribute('data-typ', A.typ);
    var kropp = rot.querySelector('.vmd-kropp'), d = A.data || {};
    var nyckel = A.typ + '|' + A.peer;
    var huvud = rot.querySelector('.vmd-huvud');
    if (A.typ === 'presentation') {
      var bnyckel = nyckel + '|' + str(d.bild && d.bild.id, 20) + '|' + Math.round(tal(d.nu, 0, 99));
      var html = bildHtml(d.bild, d);
      // Kunden med kontroll får egna pilar; säljaren bläddrar i presentatörsvyn
      var gastNav = !A.egen ? '<div class="vmd-gastnav">' + '<div class="vmd-styrplats"></div>' + (A.styr && A.styr.kund ? '<button type="button" class="vmd-knapp vmd-knapp--ikon" data-vmd="bak" aria-label="Föregående bild"' + (tal(d.nu, 0, 99) <= 0 ? ' disabled' : '') + '>' + ik('vmd-v') + '</button><span class="vmd-pres__nr"><b>' + (Math.round(tal(d.nu, 0, 99)) + 1) + '</b> / ' + Math.round(tal(d.antal, 1, 99)) + '</span><button type="button" class="vmd-knapp vmd-knapp--ikon" data-vmd="fram" aria-label="Nästa bild"' + (tal(d.nu, 0, 99) >= tal(d.antal, 1, 99) - 1 ? ' disabled' : '') + '>' + ik('vmd-h') + '</button>' : '') + '</div>' : '';
      if (bnyckel !== ritadNyckel) {
        var fram = ritadNyckel.split('|')[0] === 'presentation' && tal(d.nu, 0, 99) < Number(ritadNyckel.split('|')[3] || 0) ? 'vmd-in-v' : 'vmd-in-h';
        kropp.innerHTML = '<div class="vmd-scenbild ' + fram + '">' + html + '</div>' + gastNav;
      } else {
        var sb = kropp.querySelector('.vmd-scenbild'); if (sb) sb.innerHTML = html;
        var gn = kropp.querySelector('.vmd-gastnav'); if (gn) gn.outerHTML = gastNav; else if (gastNav) kropp.insertAdjacentHTML('beforeend', gastNav);
      }
      ritadNyckel = bnyckel;
      var pres = huvud.querySelector('.vmd-pres');
      if (A.egen && H) {
        var ta = pres && pres.querySelector('textarea'), fokus = ta && D.activeElement === ta, val = ta ? ta.value : H.anteckning, sel = ta ? [ta.selectionStart, ta.selectionEnd] : null;
        var tmp = D.createElement('div'); tmp.innerHTML = presentatorHtml();
        var ny = tmp.firstChild;
        if (pres) pres.replaceWith(ny); else huvud.appendChild(ny);
        var nyTa = ny.querySelector('textarea'); nyTa.value = val || '';
        if (fokus) { nyTa.focus({ preventScroll: true }); try { nyTa.setSelectionRange(sel[0], sel[1]); } catch (x) { /* */ } }
        var nu = ny.querySelector('.vmd-pres__lista .nu'), l = ny.querySelector('.vmd-pres__lista');
        if (nu && l) { var lr = l.getBoundingClientRect(), nr = nu.getBoundingClientRect(); l.scrollTop = Math.max(0, l.scrollTop + nr.top - lr.top - (l.clientHeight - nr.height) / 2); }
      } else if (pres) pres.remove();
    } else {
      var p2 = huvud.querySelector('.vmd-pres'); if (p2) p2.remove();
      if (A.typ === '3d') {
        if (ritadNyckel !== nyckel) kropp.innerHTML = tredHtml(d);
        else {
          kropp.querySelectorAll('[data-vmd-hus]').forEach(function (b) { var pa = b.getAttribute('data-vmd-hus') === d.vald; b.classList.toggle('vald', pa); b.setAttribute('aria-pressed', String(pa)); b.disabled = !(A.egen || (A.styr && A.styr.kund)); });
        }
        ritadNyckel = nyckel;
        ritaMv(kropp);
      } else {
        var fokusAttr = null, ae = D.activeElement;
        if (ae && kropp.contains(ae)) { fokusAttr = ['data-vmd-modell', 'data-vmd-tillval', 'data-vmd-antal', 'data-vmd-dok', 'data-vmd'].filter(function (x) { return ae.hasAttribute(x); }).map(function (x) { return '[' + x + '="' + ae.getAttribute(x) + '"]'; })[0]; }
        kropp.innerHTML = A.typ === 'kalkyl' ? kalkylHtml(d) : A.typ === 'offert' ? offertHtml(d) : dokumentHtml(d);
        if (ritadNyckel !== nyckel) { kropp.classList.remove('vmd-kropp--in'); void kropp.offsetWidth; kropp.classList.add('vmd-kropp--in'); }
        ritadNyckel = nyckel;
        if (fokusAttr) { var f = kropp.querySelector(fokusAttr); if (f) f.focus({ preventScroll: true }); }
      }
    }
    ritaStyr(rot);
    meddela();
  }
  // Lagret (samtal-ui.js) ritar om knappen Dela/Sluta visa, banderollen och minirutan
  var forraMeddelat = '';
  function meddela() {
    var a = aktuellt(), k = JSON.stringify(a);
    if (k === forraMeddelat) return;
    forraMeddelat = k;
    try { D.dispatchEvent(new CustomEvent('ih-videomote-innehall', { detail: a })); } catch (x) { /* */ }
  }
  function aktuellt() {
    if (!A || !iMote()) return { pa: false };
    var d = A.data || {}, steg = A.typ === 'presentation' && d.antal ? 'bild ' + (Math.round(tal(d.nu, 0, 99)) + 1) + ' av ' + Math.round(tal(d.antal, 1, 99)) : '';
    return { pa: true, egen: !!A.egen, typ: A.typ, titel: TYPER[A.typ].namn, namn: A.namn || '', steg: steg, kund: !!(A.styr && A.styr.kund) };
  }

  /* ---------- Facket i Dela-menyn ---------- */
  function fackHtml() {
    var k = kalla(), t = tillst(), annan = t && (t.deltagare || []).filter(function (d) { return d.delar; })[0];
    var bilder = bilderValda(k.affar).filter(function (id) { return id !== 'er' || (k.affar || k.kund); });
    var off = k.affar && IH.offertFor ? IH.offertFor(k.affar.id) : null, dok = bildDokument(k.kund);
    var kc = k.affar ? IH.Mote.kontext({ affar: k.affar.id }) : null;
    var summa = kc ? IH.Mote.kalkylRader(kc.kalkyl).reduce(function (s, r) { return s + r.pris * r.antal; }, 0) : 0;
    var kort = [
      ['presentation', 'Presentationen', bilder.length + (bilder.length === 1 ? ' bild' : ' bilder') + ', med anteckningar', true],
      ['kalkyl', 'Kalkylen', k.affar ? (IH.kort ? IH.kort(summa) : kr(summa)) : 'Räkna utan affär', true],
      ['3d', 'Husen i 3D', IH.MODELLER.filter(function (x) { return x.glb; }).length + ' hus att vrida', true],
      ['offert', 'Offerten', off ? off.nummer : k.affar ? 'Ingen offert än' : 'Ingen affär', !!k.affar],
      ['dokument', 'Bilder', dok.length ? dok.length + (dok.length === 1 ? ' bild' : ' bilder') + ' i arkivet' : 'Inga bilder än', dok.length > 0]
    ];
    var affarRad = k.affarer.length > 1
      ? '<label class="vmd-fack__affar"><span class="sr-only">Affär</span><select data-vmd-affar>' + k.affarer.map(function (a) { return '<option value="' + e(a.id) + '"' + (k.affar && a.id === k.affar.id ? ' selected' : '') + '>' + e(a.titel) + '</option>'; }).join('') + '</select></label>'
      : '<p class="vmd-fack__affar">' + (k.affar ? e(k.affar.titel) + (k.kund ? ' · ' + e(k.kund.namn) : '') : k.kund ? e(k.kund.namn) + ' · ingen affär' : 'Mötet har ingen kund') + '</p>';
    var stopp = A && A.egen ? '<button type="button" role="menuitem" class="vm-meny__rad vm-meny__rad--fara" data-vmd="stoppa">' + ik('vmd-stopp') + '<span class="vm-meny__text">Sluta visa ' + e(TYPER[A.typ].bestamd) + '</span></button><hr>' : '';
    return '<div class="vmd-fack">' + stopp + '<p class="vm-meny__rubrik">Från affären</p>' + affarRad +
      (annan ? '<p class="vmd-fack__info">' + e(fornamn(annan.namn)) + ' delar sin skärm – du kan visa innehåll när delningen är slut.</p>' : '') +
      '<div class="vmd-fack__kort">' + kort.map(function (x) {
        var pa = A && A.egen && A.typ === x[0];
        return '<button type="button" role="menuitem" class="vmd-kort' + (pa ? ' vald' : '') + '" data-vmd-visa="' + x[0] + '"' + (x[3] && !annan ? '' : ' disabled') + '>' +
          '<span class="vmd-kort__ikon">' + ik(TYPER[x[0]].ikon) + '</span><b>' + e(x[1]) + '</b><small>' + e(x[2]) + '</small></button>';
      }).join('') + '</div><hr></div>';
  }
  function fyllPlats(plats) {
    if (GAST || !plats) return;
    if (!kanVisa()) { plats.innerHTML = ''; plats.hidden = true; return; }
    plats.hidden = false;
    laggSprite();
    plats.innerHTML = fackHtml();
  }
  D.addEventListener('ih-videomote-dela-meny', function (ev) { fyllPlats(ev.detail && ev.detail.el); });

  function stangMeny() {
    if (IH.samtalUi && typeof IH.samtalUi.stangMeny === 'function') { IH.samtalUi.stangMeny(); return; }
    var v = vm(), m = v && v.querySelector('.vm-meny'); if (!m || m.hidden) return;
    var typ = m.getAttribute('data-typ');
    var k = v.querySelector('.vm-kontroller [data-vm="' + (typ === 'mer' ? 'mer' : 'dela') + '"]');
    if (k) k.click(); else m.hidden = true;
  }

  /* ---------- Klick och tangenter ---------- */
  D.addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    var v = vm(); if (!v || !v.contains(t)) return;
    var b = t.closest('[data-vmd-visa],[data-vmd],[data-vmd-modell],[data-vmd-tillval],[data-vmd-antal],[data-vmd-hus],[data-vmd-plan],[data-vmd-till],[data-vmd-dok]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-vmd-visa')) { var typ = b.getAttribute('data-vmd-visa'); stangMeny(); visa(typ); return; }
    if (b.hasAttribute('data-vmd-modell')) { andra({ modell: b.getAttribute('data-vmd-modell') }); return; }
    if (b.hasAttribute('data-vmd-tillval')) { andra({ tillval: b.getAttribute('data-vmd-tillval') }); return; }
    if (b.hasAttribute('data-vmd-antal')) { andra({ antal: Number(b.getAttribute('data-vmd-antal')) }); return; }
    if (b.hasAttribute('data-vmd-hus')) { andra({ hus: b.getAttribute('data-vmd-hus') }); return; }
    if (b.hasAttribute('data-vmd-plan')) { if (A && A.egen) andra({ plan: b.getAttribute('data-vmd-plan') }); return; }
    if (b.hasAttribute('data-vmd-till')) { if (A && A.egen) andra({ nu: Number(b.getAttribute('data-vmd-till')) }); return; }
    if (b.hasAttribute('data-vmd-dok')) { if (A && A.egen) andra({ dok: b.getAttribute('data-vmd-dok') }); return; }
    var g = b.getAttribute('data-vmd');
    if (g === 'stoppa') { stangMeny(); stoppa(); }
    else if (g === 'fram') bladdra(1);
    else if (g === 'bak') bladdra(-1);
    else if (g === 'spara-offert') sparaOffert(b);
  });
  function bladdra(steg) {
    if (!A || A.typ !== 'presentation') return;
    if (A.egen && H) { andra({ nu: H.nu + steg }); return; }
    if (A.styr && A.styr.kund) andra({ nu: Math.round(tal(A.data.nu, 0, 99)) + steg });
  }
  D.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.matches) return;
    if (t.matches('[data-vmd-kund]') && A && A.egen) { andra({ kundKan: t.checked }); live(t.checked ? 'Kunden kan styra.' : 'Bara du styr.'); }
    else if (t.matches('[data-vmd-affar]')) {
      valdAffar = t.value;
      var m = t.closest('.vm-meny'), f = m && m.querySelector('.vmd-fack');
      var plats = m && m.querySelector('[data-vm-plats="affar"]');
      if (f && plats) { fyllPlats(plats); var s = plats.querySelector('[data-vmd-affar]'); if (s) s.focus(); }
      if (A && A.egen && A.typ !== '3d') visa(A.typ, { affar: valdAffar });
    }
  });
  D.addEventListener('input', function (ev) {
    if (ev.target && ev.target.matches && ev.target.matches('[data-vmd-anteckning]') && H) H.anteckning = ev.target.value.slice(0, 4000);
  });
  // ← och → bläddrar när fokus är i det delade (inte i textfält) – krockar inte med kundmötets tangenter, som bara gäller dess eget lager
  D.addEventListener('keydown', function (ev) {
    if (!A || A.typ !== 'presentation' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target, rot = t && t.closest && t.closest('.vmd-yta');
    if (!rot || t.closest('textarea, input, select')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); bladdra(1); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); bladdra(-1); }
  });

  /* ---------- Koppla in mot motorn och lagret ---------- */
  var observ = null, sedd = null;
  function bevaka() {
    var v = vm();
    if (!v || v === sedd) return;
    sedd = v;
    if (observ) observ.disconnect();
    observ = new MutationObserver(function (lista) {
      lista.forEach(function (r) {
        // Slutskärmen: anteckningarna från presentatörsvyn följer med till mötets anteckning
        var s = r.target && r.target.classList && r.target.classList.contains('vm-slut') ? r.target : null;
        if (s && !s.hidden && H && H.anteckning) { var ta = s.querySelector('textarea[name="anteckning"]'); if (ta && !ta.value) ta.value = H.anteckning; }
      });
      // Lagret ritades om (t.ex. rutorna) – se till att ytan finns kvar
      if (A && iMote()) { var yta = v.querySelector('.vm-yta'); if (yta && !yta.querySelector(':scope > .vmd-yta')) { ritadNyckel = ''; rita(); } }
    });
    observ.observe(v, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-typ'] });
  }

  function startaLyssning() {
    var m = M(); if (!m || typeof m.pa !== 'function') return false;
    m.pa('fas', function (d) {
      koppla();
      bevaka();
      if (d.fas !== 'mote' && A) { A = null; rensaFiler(); }
      ritadNyckel = '';
      rita();
    });
    m.pa('deltagare', function (lista) { nyaDeltagare(lista); if (A && !A.egen && !deltagare(A.peer)) { A = null; rensaFiler(); rita(); } });
    m.pa('delning', function (d) {
      // Skärmdelning tar över platsen
      if (d && d.pa && A) { if (A.egen) stoppaEgen(true); }
    });
    m.pa('vard', function () { /* rollen kan ha bytts */ });
    koppla();
    return true;
  }

  if (!startaLyssning()) D.addEventListener('DOMContentLoaded', startaLyssning);
  D.addEventListener('ih-videomote', function () { bevaka(); });
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', bevaka); else bevaka();

  IH.samtalDela = {
    kanVisa: kanVisa,
    visa: visa,
    stoppa: stoppa,
    sluta: stoppa,
    aktuellt: aktuellt,
    // för testerna
    _data: function () { return A ? JSON.parse(JSON.stringify({ typ: A.typ, data: A.data, styr: A.styr })) : null; }
  };
})();
