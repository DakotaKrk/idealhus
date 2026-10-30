/* ============================================================
   Legohus CRM – kärnan (prototyp, 2026-10-01)
   Lagring i webbläsaren, navigering (#/...), skalet (sidomeny,
   toppen, mobilmenyn), sök, panelen från höger, meddelanden och
   konfetti. Vyerna ligger i vyer.js och registreras i IH.vyer;
   knapparna har data-g="namn" och åtgärderna ligger i IH.G.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH;
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  IH.lugn = lugn;
  // Samma ?v= som app.js laddades med – 3D-modulerna importeras med den (och blir då samma modul som en <script type=module>)
  var VER = (function () { var s = document.currentScript, m = s && /\?[^#]*/.exec(s.src || ''); return m ? m[0] : ''; })();
  var $ = IH.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = IH.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* --- Lagring ------------------------------------------------------ */
  // Data från en äldre version (äldre sparad data eller en importerad fil) får det som saknas ifyllt: prislistan och löpnumren
  IH.uppgraderaDb = function (ny) {
    ny.version = IH.VERSION;
    if (!ny.prislista) ny.prislista = JSON.parse(JSON.stringify(IH.PRISLISTA_START));
    var lopnr = ny.lopnr && typeof ny.lopnr === 'object' ? ny.lopnr : {};
    var hogst = function (lista) { return (Array.isArray(lista) ? lista : []).reduce(function (m, x) { var n = parseInt(String(x && x.id).replace(/^\D+/, ''), 10); return isFinite(n) && n > m ? n : m; }, 0); };
    [['kund', 'kunder'], ['affar', 'affarer'], ['forfragan', 'forfragningar'], ['aktivitet', 'aktiviteter'], ['uppgift', 'uppgifter'], ['projekt', 'projekt'], ['offert', 'offerter'], ['dokument', 'dokument']].forEach(function (t) {
      lopnr[t[0]] = Math.max(+lopnr[t[0]] || 0, hogst(ny[t[1]]));
    });
    ny.lopnr = lopnr;
    // Version 4: aviseringar, mallar, taggar, egna fält, förväntat avslut och upprepning (data.js)
    if (IH.fyllStandard) IH.fyllStandard(ny);
    return ny;
  };
  function ladda(franFlik) {
    var db = null, ra = null;
    try { ra = localStorage.getItem(IH.NYCKEL); } catch (e) { ra = null; }
    try { db = JSON.parse(ra); } catch (e) { db = null; }
    // Läsbar data från en äldre version uppgraderas i stället för att bytas mot exempeldatan
    if (db && typeof db === 'object' && +db.version > 0 && +db.version < IH.VERSION && Array.isArray(db.kunder) && Array.isArray(db.affarer)) {
      db = IH.uppgraderaDb(db);
      try { localStorage.setItem(IH.NYCKEL, JSON.stringify(db)); } catch (e) { /* privat läge eller full lagring */ }
    }
    if (!db || db.version !== IH.VERSION) {
      // En annan flik skrev något som inte går att läsa (eller en annan version): behåll det som finns i minnet
      if (franFlik) return null;
      if (ra) {
        // Sparad data som inte går att läsa eller har en annan version skrivs inte över utan en kopia,
        // och data från en nyare version rörs inte alls (exempeldatan används då bara i minnet)
        var kopia = false, nyare = !!db && +db.version > IH.VERSION;
        try { localStorage.setItem(IH.NYCKEL + '-trasig', ra); localStorage.setItem(IH.NYCKEL + '-trasig-tid', new Date().toISOString()); kopia = true; } catch (e) { kopia = false; }
        IH.dataVarning = nyare ? 'Den är från en nyare version och lämnas orörd.' : kopia ? 'En kopia av den finns i ' + IH.NYCKEL + '-trasig.' : 'Kopian gick inte att spara, så den gamla datan lämnas orörd.';
        db = IH.skapaExempeldata();
        if (nyare || !kopia) { IH.dataSkrivsInte = true; return db; }
      } else db = IH.skapaExempeldata();
      try { localStorage.setItem(IH.NYCKEL, JSON.stringify(db)); } catch (e) { /* privat läge */ }
    }
    // Fält som saknas (t.ex. i data som sparats mitt i ett byte) fylls i – inget skrivs över
    if (IH.fyllStandard) IH.fyllStandard(db);
    // Namnbytet till Legohus: sparade offertnummer börjar på LH i stället för IH.
    (db.offerter || []).forEach(function (o) { if (/^IH-/.test(o.nummer || '')) o.nummer = 'LH-' + o.nummer.slice(3); });
    return db;
  }
  IH.db = ladda();
  var fullVarnad = 0;
  IH.spara = function () {
    IH.db.andrad = new Date().toISOString();
    // Nyare eller oläslig data ligger sparad (se ladda) och skrivs inte över
    if (IH.dataSkrivsInte) {
      if (IH.toast && Date.now() - fullVarnad > 4000) {
        fullVarnad = Date.now();
        IH.toast('Ändringen sparades inte', 'Den sparade datan lämnas orörd, så det du ändrar försvinner när sidan laddas om.', 'varning', { tid: 9000 });
      }
      return false;
    }
    try { localStorage.setItem(IH.NYCKEL, JSON.stringify(IH.db)); return true; } catch (e) {
      // Lagringen är full: säg det i stället för att låta det se sparat ut och tappa allt vid nästa laddning
      var full = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
      if (full && IH.toast && Date.now() - fullVarnad > 4000) {
        fullVarnad = Date.now();
        IH.toast('Lagringen är full – ändringen sparades inte', 'Exportera datan och ta bort stora bilagor. Det som inte sparats försvinner när sidan laddas om.', 'varning', { tid: 9000 });
      }
      return false;
    }
  };
  // En annan flik ändrade – läs om och rita om.
  window.addEventListener('storage', function (e) {
    if (e.key === IH.NYCKEL) { var ny = ladda(true); if (ny) { IH.db = ny; IH.uppdateraMeny(); avisPanelRita(); rita(); } }
    if (e.key === 'ih-crm-inloggad' && !e.newValue) location.replace('logga-in.html');
    // Kontobyte eller supportläge i en annan flik: ladda om, så att alla flikar visar samma konto och roll
    if ((e.key === 'ih-crm-jag' || e.key === 'ih-crm-visa-som') && e.newValue !== e.oldValue) location.reload();
  });

  IH.riktigJag = function () {
    var id = null;
    try { id = localStorage.getItem('ih-crm-jag'); } catch (e) { id = null; }
    return IH.ANVANDARE.filter(function (u) { return u.id === id; })[0] || OKANT;
  };
  // Okänt eller ändrat konto-id: ingen roll alls (IH.starta loggar ut), aldrig ett riktigt konto som reserv
  var OKANT = { id: '', namn: 'Okänt konto', titel: '', roll: 'okand', farg: '#8a8f98' };
  IH.kantKonto = function () { return IH.riktigJag() !== OKANT; };
  // Profilbilder sätts i style=url(...): bara en ren data-URL för en bild godtas
  IH.sakerBild = function (b) { return typeof b === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(b) ? b : ''; };
  // Supportläget (stod.js): administratören ser och arbetar i någon annans konto – IH.jag() är då det kontot
  var visaSomId = null;
  try { visaSomId = localStorage.getItem('ih-crm-visa-som'); } catch (e) { visaSomId = null; }
  IH.visarSom = function () {
    if (!visaSomId || IH.riktigJag().roll !== 'admin') return null;
    var u = IH.ANVANDARE.filter(function (x) { return x.id === visaSomId; })[0];
    return u && u.roll !== 'admin' && !u.inaktiv ? u : null;
  };
  IH.sattVisaSom = function (id) {
    visaSomId = id || null;
    try { if (id) localStorage.setItem('ih-crm-visa-som', id); else localStorage.removeItem('ih-crm-visa-som'); } catch (e) { /* privat läge */ }
  };
  IH.jag = function () { return IH.visarSom() || IH.riktigJag(); };
  IH.anvandare = function (id) { return IH.ANVANDARE.filter(function (u) { return u.id === id; })[0] || null; };

  IH.nyttId = function (typ, prefix) {
    IH.db.lopnr[typ] = (IH.db.lopnr[typ] || 0) + 1;
    return prefix + IH.db.lopnr[typ];
  };

  function hitta(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  IH.kund = function (id) { return hitta(IH.db.kunder, id); };
  IH.affar = function (id) { return hitta(IH.db.affarer, id); };
  IH.forfragan = function (id) { return hitta(IH.db.forfragningar, id); };
  IH.projekt = function (id) { return hitta(IH.db.projekt, id); };
  IH.offert = function (id) { return hitta(IH.db.offerter, id); };
  IH.offertFor = function (affarId) {
    var o = IH.db.offerter.filter(function (x) { return x.affar === affarId && x.status !== 'ersatt'; });
    return o[o.length - 1] || null;
  };

  IH.logga = function (typ, text, kund, affar) {
    IH.db.aktiviteter.push({ id: IH.nyttId('aktivitet', 'h'), tid: new Date().toISOString(), typ: typ, text: text,
      kund: kund || null, affar: affar || null, av: IH.jag().id });
  };

  /* --- Text och tid ------------------------------------------------ */
  IH.e = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var MAN = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  // Svenska datum, tider och tal med återanvända Intl-objekt: samma text som d.toLocaleDateString('sv-SE', opt)
  // ('d'), toLocaleTimeString ('t'), toLocaleString ('a') och n.toLocaleString('sv-SE', opt) (IH.lokalTal) –
  // utan att ett nytt formatobjekt byggs vid varje anrop. Standardfälten fylls i som webbläsaren gör.
  var FORMAT = {}, DATUMFALT = ['weekday', 'year', 'month', 'day'], TIDFALT = ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits'];
  function harFalt(o, f) { for (var i = 0; i < f.length; i++) if (o[f[i]] !== undefined) return true; return false; }
  function formatFor(typ, opt) {
    var nyckel = typ + JSON.stringify(opt || {}), f = FORMAT[nyckel];
    if (f) return f;
    var x = {}, k;
    for (k in opt || {}) x[k] = opt[k];
    if (typ === 'n') return (FORMAT[nyckel] = new Intl.NumberFormat('sv-SE', x));
    var behov = !x.dateStyle && !x.timeStyle && !(typ !== 't' && harFalt(x, DATUMFALT)) && !(typ !== 'd' && harFalt(x, TIDFALT));
    if (behov && typ !== 't') { x.year = 'numeric'; x.month = 'numeric'; x.day = 'numeric'; }
    if (behov && typ !== 'd') { x.hour = 'numeric'; x.minute = 'numeric'; x.second = 'numeric'; }
    return (FORMAT[nyckel] = new Intl.DateTimeFormat('sv-SE', x));
  }
  IH.lokal = function (d, typ, opt) {
    var t = d instanceof Date ? d.getTime() : new Date(d).getTime();
    return isNaN(t) ? 'Invalid Date' : formatFor(typ || 'd', opt).format(t);
  };
  IH.lokalTal = function (n, opt) { return formatFor('n', opt).format(n); };
  IH.datum = function (iso, medAr) {
    var d = new Date(iso);
    return d.getDate() + ' ' + MAN[d.getMonth()] + (medAr ? ' ' + d.getFullYear() : '');
  };
  IH.dagarSedan = function (iso) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  };
  IH.sedan = function (iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 0) {
      var a0 = new Date(); a0.setHours(0, 0, 0, 0); var b0 = new Date(iso); b0.setHours(0, 0, 0, 0); var fram = Math.round((b0 - a0) / 864e5);
      return fram <= 0 ? 'i dag' : fram === 1 ? 'i morgon' : 'om ' + fram + ' dagar';
    }
    if (s < 60) return 'nyss';
    if (s < 3600) return 'för ' + Math.floor(s / 60) + ' min sedan';
    if (s < 86400) return 'för ' + Math.floor(s / 3600) + ' h sedan';
    var d = Math.floor(s / 86400);
    return d === 1 ? 'i går' : d < 30 ? 'för ' + d + ' dagar sedan' : IH.datum(iso, new Date(iso).getFullYear() !== new Date().getFullYear());
  };
  IH.initialer = function (namn) {
    var ord = String(namn || '?').trim().split(/\s+/);
    if (ord.length === 1) return ord[0].slice(0, 2).toUpperCase();
    return String(namn || '?').replace(/ (AB|ek\. förening)$/i, '').split(/\s+/).map(function (d) { return d.charAt(0); })
      .slice(0, 2).join('').toUpperCase();
  };
  // Hälsningen (översikten, kontrollcentralen och inloggningen): IH.halsning(d) finns i tema.js, som både
  // CRM:et och inloggningen laddar – samma regler överallt. Reserven här om tema.js inte laddats.
  if (!IH.halsning) IH.halsning = function (d) {
    var h = (d instanceof Date ? d : new Date()).getHours();
    return h < 5 ? 'God kväll' : h < 10 ? 'God morgon' : h < 14 ? 'Hej' : h < 18 ? 'God eftermiddag' : 'God kväll';
  };
  IH.hej = function (d) { return IH.halsning(d); };
  IH.dagStr = function (d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  IH.vecka = function (d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dag);
    var ar = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - ar) / 864e5 + 1) / 7);
  };

  /* --- Ikoner (24×24, linjer) ---------------------------------------- */
  var IKONER = {
    hem: 'M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5',
    inkorg: 'M3 13h5l1.5 3h5L16 13h5|M5.5 5h13L21 13v6H3v-6z',
    tavla: 'M4 4h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z|M4 12h3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z|M10.5 4h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z|M17 4h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z|M17 10h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z',
    kunder: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5|M16 4.5a3.3 3.3 0 0 1 0 6.3|M18 14.8c1.9.7 3.2 2.4 3.5 5.2',
    offert: 'M6 3.5h9l3.5 3.5v13.5H6z|M14.5 3.5V7H18|M9 11h6|M9 14.5h6|M9 18h3.5',
    mote: 'M3 4.5h18v11H3z|M8 20h8|M12 15.5V20|M8.5 11l2.5-2.5 2 2 3-3',
    produktion: 'M3 20h18|M5 20V10l5 3V10l5 3V7l4 2v11',
    uppgift: 'M9 6h11|M9 12h11|M9 18h11|M4 5.5l1.2 1.2L7.5 4.5|M4 11.5l1.2 1.2 2.3-2.2|M4 17.5l1.2 1.2 2.3-2.2',
    installning: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z|M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z',
    sok: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4',
    plus: 'M12 5v14|M5 12h14',
    pil: 'M5 12h14|M13 6l6 6-6 6',
    pilv: 'M19 12H5|M11 6l-6 6 6 6',
    stang: 'M6 6l12 12|M18 6 6 18',
    tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    post: 'M3.5 5.5h17v13h-17z|M4 6l8 6.5L20 6',
    bock: 'M5 12.5l4.5 4.5L19 7.5',
    klocka: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
    kalender: 'M4 5h16v15H4z|M4 9.5h16|M9 3v4|M15 3v4',
    plats: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z|M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    hus: 'M3.5 11.5 12 4.5l8.5 7|M5.5 10v10h13V10|M10 20v-5.5h4V20',
    blixt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    graf: 'M4 19V5|M4 19h16|M7 15l4-4 3 3 5-6',
    trofe: 'M8 4h8v5a4 4 0 0 1-8 0z|M8 6H5a3 3 0 0 0 3 4|M16 6h3a3 3 0 0 1-3 4|M12 13v4|M8.5 20h7',
    anteckning: 'M5 4h14v11l-5 5H5z|M14 20v-5h5',
    prickar: 'M5 12h.01|M12 12h.01|M19 12h.01',
    linjal: 'M3 16.5 16.5 3 21 7.5 7.5 21z|M7 12.5l1.5 1.5|M10 9.5l1.5 1.5|M13 6.5l1.5 1.5',
    gem: 'M20 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9',
    rutnat: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
    larm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M12 9v4l2.5 2|M4 5l3-2|M20 5l-3-2',
    trend: 'M3 17l6-6 4 4 8-8|M15 7h6v6',
    mapp: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z',
    kalkyl: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z|M8 6.5h8v3H8z|M8.5 13h.01|M12 13h.01|M15.5 13h.01|M8.5 16.5h.01|M12 16.5h.01|M15.5 16.5h.01',
    kamera: 'M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z|M12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    meddelande: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V13a2.5 2.5 0 0 1-1-2z|M17 8h.5A2.5 2.5 0 0 1 20 10.5V15a2.5 2.5 0 0 1-1 2v3l-3.5-3H11a2.5 2.5 0 0 1-2-1',
    samtal: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    motesikon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M3 20c.6-3.6 3-5.5 6-5.5|M15 14.5h6v6h-6z',
    system: 'M12 3l7 4v10l-7 4-7-4V7z|M12 12l7-5|M12 12v9|M12 12 5 7',
    dra: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
    utloggning: 'M15 4h4v16h-4|M10 8l-4 4 4 4|M6 12h10',
    aterstall: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.5|M4 4v4.5h4.5',
    chevron: 'M6 9l6 6 6-6',
    kub: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z|M12 12l8-4.5|M12 12v9|M12 12 4 7.5',
    ogon: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    skriv: 'M5 19h14|M13.5 5.5l3 3L9 16H6v-3z',
    skrivut: 'M6 9V3.5h12V9|M6 17H4v-7h16v7h-2|M7 14h10v6.5H7z',
    kopiera: 'M8 8h12v12H8z|M16 8V4H4v12h4',
    stjarna: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
    varning: 'M12 4 2.5 20h19z|M12 10v4.5|M12 17.5h.01',
    lista: 'M8 6h12|M8 12h12|M8 18h12|M4 6h.01|M4 12h.01|M4 18h.01',
    meny: 'M4 7h16|M4 12h16|M4 17h16',
    ljud: 'M4 9v6h4l5 4V5L8 9z|M16 9a4 4 0 0 1 0 6',
    helskarm: 'M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5',
    mark: 'M3 9h18|M3 14h18|M3 19h18|M7 4l2 5|M14 4l-1 5'
  };
  // Namn som bara finns i ikonbladet (index.html) hämtas därifrån – inte ett hus i stället.
  var IKON_ALIAS = { fil: 'dokument' };
  var ikonVarnad = {};
  IH.i = function (namn, klass) {
    var d = IKONER[namn];
    var attr = ' viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">';
    if (!d) {
      var sprite = IKON_ALIAS[namn] || namn;
      if (document.getElementById('i-' + sprite)) return '<svg class="i' + (klass ? ' ' + klass : '') + '"' + attr + '<use href="#i-' + sprite + '"/></svg>';
      if (namn && !ikonVarnad[namn] && window.console) { ikonVarnad[namn] = 1; console.warn('IH.i: okänd ikon', namn); }
      d = IKONER.hem;
    }
    return '<svg class="i' + (klass ? ' ' + klass : '') + '"' + attr +
      d.split('|').map(function (p) { return '<path d="' + p + '"/>'; }).join('') + '</svg>';
  };

  // Linjeikonerna ur ikonbladet i index.html (flyttat från Uperformance) – i stället för emoji.
  IH.emo = function (namn, klass) { return '<svg class="emo-ik' + (klass ? ' ' + klass : '') + '" width="1em" height="1em" fill="none" stroke="currentColor" aria-hidden="true"><use href="#i-' + namn + '"/></svg>'; };

  /* --- Meddelanden och konfetti ------------------------------------- */
  // val: { lank, knapp, tid } ger en åtgärdsknapp och egen visningstid.
  IH.toast = function (rubrik, text, ikon, val) {
    val = val || {};
    var yta = $('.toaster');
    // Kundmötet i helskärm visar bara sig självt: då läggs meddelandet i en egen yta i helskärmen
    var fs = document.fullscreenElement;
    if (fs && !(yta && fs.contains(yta))) {
      yta = fs.querySelector(':scope > .toaster');
      if (!yta) { yta = document.createElement('div'); yta.className = 'toaster'; yta.setAttribute('aria-live', 'polite'); fs.appendChild(yta); }
    }
    if (!yta) return;
    var tid = val.tid || (val.lank ? 6500 : 3800);
    var t = document.createElement('div');
    // Fel och varningar ser inte ut som bekräftelser (val.typ eller ikonen avgör)
    var typ = val.typ || (/^(varning|stang|las|oga-av|papperskorg)$/.test(ikon || '') ? 'fel' : !ikon || ikon === 'bock' ? 'ok' : 'info');
    var knappar = Array.isArray(val.knappar) ? val.knappar.filter(function (k) { return k && k.text; }) : [];
    t.className = 'toast toast--' + typ + (knappar.length > 1 ? ' toast--flera' : '');
    t.setAttribute('role', 'status');
    t.style.setProperty('--tid', tid + 'ms');
    t.innerHTML = '<span class="toast__ikon">' + IH.i(ikon || 'bock') + '</span><span class="toast__text"><b>' + IH.e(rubrik) + '</b>' +
      (text ? '<small>' + IH.e(text) + '</small>' : '') + '</span>' +
      (val.lank ? '<a class="toast__knapp" href="' + IH.e(val.lank) + '">' + IH.e(val.knapp || 'Öppna') + '</a>' : '') +
      // val.knappar: [{ text, gor }] – knappar som kör något (Ångra, Klar, +1 h …); flera knappar läggs på en egen rad
      (knappar.length ? (knappar.length > 1 ? '<span class="toast__knappar">' : '') + knappar.map(function (k, n) {
        return '<button type="button" class="toast__knapp' + (n ? ' toast__knapp--sek' : '') + '" data-toast-knapp="' + n + '">' + IH.e(k.text) + '</button>';
      }).join('') + (knappar.length > 1 ? '</span>' : '') : '') +
      '<i class="toast__tid"></i>';
    yta.appendChild(t);
    var borta = false;
    var bort = function () {
      if (borta) return;
      borta = true;
      // Toasten tonar ut och höjden krymper samtidigt, så att toasterna intill glider på plats i stället för att hoppa
      if (lugn || !t.animate) { t.classList.add('ut'); setTimeout(function () { t.remove(); }, lugn ? 160 : 0); return; }
      var cs = getComputedStyle(t), h = t.offsetHeight;
      t.classList.add('ut');
      t.style.overflow = 'hidden';
      t.animate([{ height: h + 'px', marginTop: '0px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom },
        { height: '0px', marginTop: '-8px', paddingTop: '0px', paddingBottom: '0px' }], { duration: 240, delay: 70, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' }).onfinish = function () { t.remove(); };
    };
    var timer = setTimeout(bort, tid);
    t.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-toast-knapp]');
      clearTimeout(timer); bort();
      var k = b ? knappar[+b.getAttribute('data-toast-knapp')] : null;
      if (k && typeof k.gor === 'function') k.gor();
    });
    t.addEventListener('mouseenter', function () { clearTimeout(timer); t.classList.add('vilar'); });
    t.addEventListener('mouseleave', function () { t.classList.remove('vilar'); timer = setTimeout(bort, 1800); });
    return t;
  };

  // Lyfter fram det som just ändrades: väntar in nästa ritning och
  // sätter klassen en stund – CSS gör resten.
  IH.lysUpp = function (sel, klass) {
    klass = klass || 'bytt';
    var t0 = performance.now();
    (function leta() {
      var el = $(sel);
      if (el) {
        el.classList.remove(klass);
        void el.offsetWidth;
        el.classList.add(klass);
        setTimeout(function () { el.classList.remove(klass); }, 1500);
      } else if (performance.now() - t0 < 1500) requestAnimationFrame(leta);
    })();
  };

  IH.konfetti = function (x, y) {
    if (lugn) return;
    var farger = ['#f0b56e', '#f6c68d', '#7fe0a6', '#b8cde0', '#fbead5', '#8f5424'];
    var lager = document.createElement('div');
    lager.className = 'konfetti';
    lager.setAttribute('aria-hidden', 'true');
    document.body.appendChild(lager);
    for (var i = 0; i < 70; i++) {
      var b = document.createElement('i');
      var vinkel = Math.random() * Math.PI * 2;
      var fart = 160 + Math.random() * 320;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      b.style.background = farger[i % farger.length];
      b.style.setProperty('--dx', (Math.cos(vinkel) * fart).toFixed(0) + 'px');
      b.style.setProperty('--dy', (Math.sin(vinkel) * fart - 160).toFixed(0) + 'px');
      b.style.setProperty('--r', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      b.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      lager.appendChild(b);
    }
    setTimeout(function () { lager.remove(); }, 1900);
  };

  /* --- Gemensamma verktyg: ångra, CSV, aviseringar, sparade filter, sökgrupper (steg 11) ---------------
     Andra moduler anropar dem med en reserv (if (IH.angra) …), så att inget går sönder om något saknas. */

  // Ångra: en toast med knappen Ångra i 8 s. aterstall() lägger tillbaka det som togs bort; sedan sparas och ritas allt om.
  IH.angra = function (rubrik, text, aterstall) {
    var gjort = false;
    return IH.toast(rubrik, text, 'aterstall', { typ: 'info', tid: 8000, knappar: [{ text: 'Ångra', gor: function () {
      if (gjort || typeof aterstall !== 'function') return;
      gjort = true;
      try { aterstall(); } catch (e) {
        IH.toast('Det gick inte att ångra', 'Ladda om sidan och kontrollera att allt finns kvar.', 'varning');
        return;
      }
      IH.spara();
      IH.uppdateraMeny();
      rita();
      IH.toast('Ångrat', rubrik, 'aterstall');
    } }] });
  };

  // CSV: semikolon och BOM (Excel på svenska öppnar då filen rätt), och formelskydd: en text som börjar med
  // = + - @ eller tabb får en apostrof först, så att Excel visar den som text i stället för att räkna den.
  var CSV_FORMEL = /^[=+\-@\t\r]/;
  function csvCell(x) {
    var s = String(x == null ? '' : x);
    if (typeof x !== 'number' && CSV_FORMEL.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  IH.csv = {
    // kolumner: ['Rubrik', …] med rader som listor, eller [{ rubrik, falt }] med rader som objekt
    text: function (kolumner, rader) {
      kolumner = kolumner || [];
      var rubriker = kolumner.map(function (k) { return k && typeof k === 'object' ? k.rubrik || k.namn || k.falt : k; });
      var ut = [rubriker.map(csvCell).join(';')];
      (rader || []).forEach(function (r) {
        var celler = Array.isArray(r) ? r : kolumner.map(function (k) { var f = k && typeof k === 'object' ? k.falt || k.nyckel : k; return r ? r[f] : ''; });
        ut.push(celler.map(csvCell).join(';'));
      });
      return '﻿' + ut.join('\r\n');
    },
    ladda: function (filnamn, kolumner, rader) {
      var namn = String(filnamn || 'export').replace(/[\\/:*?"<>|]+/g, '-');
      if (!/\.csv$/i.test(namn)) namn += '.csv';
      var url = URL.createObjectURL(new Blob([IH.csv.text(kolumner, rader)], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url; a.download = namn; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return namn;
    },
    // Tolkar CSV-text: citattecken, "" inne i fält, radbrytningar i fält, ; , eller tabb som avgränsare
    tolka: function (text) {
      text = String(text || '').replace(/^﻿/, '');
      var forsta = '', ic = false;
      for (var p = 0; p < text.length; p++) { var ch = text[p]; if (ch === '"') ic = !ic; else if (!ic && (ch === '\n' || ch === '\r')) break; forsta += ic ? '' : ch; }
      var rakna = function (c) { return forsta.split(c).length - 1; };
      var avg = [';', ',', '\t'].reduce(function (b, c) { return rakna(c) > rakna(b) ? c : b; }, ';');
      var rader = [], rad = [], falt = '', inne = false, i = 0, n = text.length, harText = false;
      while (i < n) {
        var c = text[i];
        if (inne) {
          if (c === '"') { if (text[i + 1] === '"') { falt += '"'; i += 2; continue; } inne = false; i++; continue; }
          falt += c; i++; continue;
        }
        if (c === '"' && falt === '') { inne = true; harText = true; i++; continue; }
        if (c === avg) { rad.push(falt); falt = ''; harText = true; i++; continue; }
        if (c === '\r' || c === '\n') {
          rad.push(falt); falt = '';
          if (harText || rad.length > 1 || rad[0] !== '') rader.push(rad);
          rad = []; harText = false;
          i += c === '\r' && text[i + 1] === '\n' ? 2 : 1; continue;
        }
        falt += c; harText = true; i++;
      }
      if (falt !== '' || rad.length) { rad.push(falt); rader.push(rad); }
      return { avgransare: avg, rader: rader, oavslutad: inne };
    },
    // Läser en fil: { kolumner, rader (objekt per kolumnnamn), varningar }. Filreglerna (filregler.js) granskar
    // innehållet först – en fil med formler som kör program tas inte emot. Formler i celler görs om till text.
    las: function (fil) {
      return new Promise(function (klar, fel) {
        if (!fil) { fel(new Error('Ingen fil vald.')); return; }
        if (fil.size > 5 * 1024 * 1024) { fel(new Error('Filen är större än 5 MB. Dela upp den i mindre filer.')); return; }
        var r = new FileReader();
        r.onerror = function () { fel(new Error('Filen gick inte att läsa.')); };
        r.onload = function () {
          var bytes = new Uint8Array(r.result), varningar = [];
          var FR = window.IHFilregler;
          if (FR && FR.granska) {
            var g = FR.granska({ namn: fil.name || 'fil.csv', typ: 'text/csv', bytes: bytes });
            var stopp = g.fynd.filter(function (x) { return x.allvar === 'blockera'; });
            if (stopp.length) { fel(new Error(stopp.map(function (x) { return x.text; }).join('. '))); return; }
            g.fynd.forEach(function (x) { varningar.push(x.text); });
          }
          var text;
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) {
            // Excel på Windows sparar ofta CSV i Windows-1252 (ANSI) – då läses den så, med en upplysning
            try { text = new TextDecoder('windows-1252').decode(bytes); varningar.push('Filen var inte UTF-8 och lästes som Windows-1252 (Excel). Kontrollera å, ä och ö i förhandsvisningen.'); }
            catch (e2) { fel(new Error('Filens teckenkodning gick inte att läsa.')); return; }
          }
          var t = IH.csv.tolka(text);
          if (t.oavslutad) varningar.push('Ett citattecken avslutas aldrig – sista raden kan vara ofullständig.');
          if (!t.rader.length) { fel(new Error('Filen är tom.')); return; }
          var sett = {};
          var kolumner = t.rader[0].map(function (k, n) {
            var namn = String(k || '').trim() || 'Kolumn ' + (n + 1);
            if (sett[namn]) namn += ' (' + (n + 1) + ')';
            sett[namn] = 1;
            return namn;
          });
          var formler = 0;
          var rader = t.rader.slice(1).map(function (celler, rn) {
            var o = {};
            if (celler.length !== kolumner.length) varningar.push('Rad ' + (rn + 2) + ' har ' + celler.length + ' fält men rubrikraden ' + kolumner.length + '.');
            kolumner.forEach(function (k, n) {
              var v = String(celler[n] == null ? '' : celler[n]).trim();
              // =, @ eller + och - följt av en bokstav/parentes ser ut som en formel (ett telefonnummer som +46 … gör det inte)
              if (/^[=@]|^[+\-]\s*[A-Za-zÅÄÖåäö_(]/.test(v)) { v = "'" + v; formler++; }
              o[k] = v;
            });
            return o;
          });
          if (formler) varningar.push(formler + (formler === 1 ? ' cell såg ut som en formel och sparas' : ' celler såg ut som formler och sparas') + ' som text (med en apostrof först).');
          klar({ kolumner: kolumner, rader: rader, varningar: varningar, avgransare: t.avgransare });
        };
        r.readAsArrayBuffer(fil);
      });
    }
  };

  // Aviseringar: rader i db.aviseringar per person. Klockan i menyn/toppraden räknar de olästa. Allt finns bara
  // i den här webbläsaren – det står i panelen (aviseringar mellan datorer kräver server).
  var AVIS_MAX = 300;
  function avisLista() { if (!Array.isArray(IH.db.aviseringar)) IH.db.aviseringar = []; return IH.db.aviseringar; }
  IH.avisera = function (o) {
    o = o || {};
    var lista = avisLista(), till = o.till || IH.jag().id, nu = new Date().toISOString();
    var lank = typeof o.lank === 'string' && /^#\/[^\s"'<>]*$/.test(o.lank) ? o.lank : null;
    var rubrik = String(o.rubrik || '').slice(0, 200), text = String(o.text || '').slice(0, 400), rad = null;
    // Samma nyckel (t.ex. en chattkonversation) slås ihop med en oläst rad i stället för en ny rad per händelse
    if (o.nyckel) rad = lista.filter(function (x) { return x.till === till && x.nyckel === o.nyckel && !x.last; })[0] || null;
    if (rad) { rad.rubrik = rubrik; rad.text = text; rad.lank = lank; rad.tid = nu; rad.antal = (rad.antal || 1) + 1; if (o.typ) rad.typ = o.typ; }
    else {
      rad = { id: 'av' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), till: till, typ: o.typ || 'info', rubrik: rubrik, text: text,
        lank: lank, tid: nu, last: false, nyckel: o.nyckel || null, antal: 1, av: IH.jag().id };
      lista.push(rad);
      // Taket: de äldsta lästa går först, sedan de äldsta
      while (lista.length > AVIS_MAX) {
        var n = lista.findIndex(function (x) { return x.last; });
        lista.splice(n >= 0 ? n : 0, 1);
      }
    }
    if (o.spara !== false) IH.spara();
    IH.uppdateraMeny();
    avisPanelRita();
    if (o.skrivbord && till === IH.jag().id) skrivbord(rubrik, text, lank, rad.nyckel || rad.id);
    return rad;
  };
  IH.avisera.lista = function (till) {
    till = till || IH.jag().id;
    return avisLista().filter(function (x) { return x && x.till === till; }).sort(function (a, b) { return a.tid < b.tid ? 1 : a.tid > b.tid ? -1 : 0; });
  };
  IH.avisera.olasta = function (till) { return IH.avisera.lista(till).filter(function (x) { return !x.last; }).length; };
  // Markerar olästa rader med en viss nyckel som lästa (chatten när en konversation läses)
  IH.avisera.las = function (nyckel, till) {
    till = till || IH.jag().id;
    var andrat = false;
    avisLista().forEach(function (x) { if (x.till === till && x.nyckel === nyckel && !x.last) { x.last = true; andrat = true; } });
    if (andrat) { IH.spara(); IH.uppdateraMeny(); avisPanelRita(); }
    return andrat;
  };
  // Skrivbordsaviseringar: samma val och behörighet som chatten (ih-crm-chatt → avisera), så att det finns ett enda val
  var CHATT_PREF = 'ih-crm-chatt';
  function chattPref() { try { return JSON.parse(localStorage.getItem(CHATT_PREF)) || {}; } catch (e) { return {}; } }
  IH.avisera.skrivbordStod = function () { return 'Notification' in window; };
  IH.avisera.skrivbordPa = function () { return IH.avisera.skrivbordStod() && Notification.permission === 'granted' && !!chattPref().avisera; };
  IH.avisera.sattSkrivbord = function (pa) {
    var p = chattPref(); p.avisera = !!pa;
    try { localStorage.setItem(CHATT_PREF, JSON.stringify(p)); } catch (e) { /* privat läge */ }
  };
  function skrivbord(rubrik, text, lank, tagg) {
    // Bara när fliken inte syns eller inte har fokus – annars räcker toasten och klockan
    if (!IH.avisera.skrivbordPa() || (document.visibilityState === 'visible' && document.hasFocus())) return;
    try {
      var n = new Notification(rubrik, { body: text || '', tag: 'ih-' + (tagg || ''), icon: '../images/legohus.svg' });
      n.onclick = function () { try { window.focus(); } catch (e) { /* */ } if (lank) IH.ga(lank); n.close(); };
    } catch (e) { /* t.ex. Android kräver en service worker – klockan och toasten finns ändå */ }
  }
  IH.avisera.skrivbord = skrivbord;

  // Sparade filter per användare och vy (localStorage, aldrig i den delade datan). Högst 20 per vy.
  var FILTER_MAX = 20;
  function filterNyckel() { return 'ih-crm-filter:' + (IH.jag().id || 'gast'); }
  function filterAlla() { try { var o = JSON.parse(localStorage.getItem(filterNyckel())); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function filterSkriv(o) { try { localStorage.setItem(filterNyckel(), JSON.stringify(o)); return true; } catch (e) { return false; } }
  IH.filter = {
    MAX: FILTER_MAX,
    lista: function (vy) { var l = filterAlla()[vy]; return Array.isArray(l) ? l.filter(function (x) { return x && x.id; }) : []; },
    // Returnerar det sparade filtret, eller null (fullt, tomt namn eller lagringen går inte att skriva)
    spara: function (vy, namn, data) {
      namn = String(namn || '').trim().slice(0, 40);
      if (!vy || !namn) return null;
      var alla = filterAlla(), l = Array.isArray(alla[vy]) ? alla[vy] : [];
      var samma = l.filter(function (x) { return x.namn.toLowerCase() === namn.toLowerCase(); })[0];
      if (samma) { samma.data = data; samma.tid = new Date().toISOString(); }
      else {
        if (l.length >= FILTER_MAX) { IH.toast('Du har redan ' + FILTER_MAX + ' sparade filter här', 'Ta bort ett filter innan du sparar ett nytt.', 'varning'); return null; }
        samma = { id: 'sf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), namn: namn, data: data, tid: new Date().toISOString() };
        l.push(samma);
      }
      alla[vy] = l;
      if (!filterSkriv(alla)) { IH.toast('Filtret gick inte att spara', 'Webbläsaren tillåter inte lagring just nu (privat läge eller full lagring).', 'varning'); return null; }
      return samma;
    },
    dopOm: function (vy, id, namn) {
      namn = String(namn || '').trim().slice(0, 40);
      var alla = filterAlla(), x = (alla[vy] || []).filter(function (f) { return f.id === id; })[0];
      if (!x || !namn) return null;
      x.namn = namn; filterSkriv(alla); return x;
    },
    bort: function (vy, id) {
      var alla = filterAlla(), l = alla[vy] || [], x = l.filter(function (f) { return f.id === id; })[0];
      if (!x) return null;
      alla[vy] = l.filter(function (f) { return f.id !== id; }); filterSkriv(alla);
      return x;
    },
    // Lägger tillbaka ett borttaget filter (för Ångra)
    aterstall: function (vy, x) { var alla = filterAlla(); alla[vy] = (alla[vy] || []).filter(function (f) { return f.id !== x.id; }).concat([x]); filterSkriv(alla); }
  };

  // Sökgrupper från andra moduler (t.ex. chatten): fn(q) → [{ mal: 'ga:#/…' | 'g:namn', ikon, rubrik, under, typ, id }]
  var SOK_GRUPPER = [];
  IH.sok = {
    lagg: function (grupp, fn, val) {
      if (!grupp || typeof fn !== 'function') return;
      SOK_GRUPPER = SOK_GRUPPER.filter(function (g) { return g.namn !== grupp; });
      SOK_GRUPPER.push({ namn: grupp, fn: fn, vy: val && val.vy });
    }
  };

  /* --- Panelen från höger ------------------------------------------- */
  var aktivtArk = null;
  // På telefonen är arket ett bottenark: greppstrecket i huvudet drar ner det (stänger vid långt eller snabbt drag)
  var mobilBred = matchMedia('(max-width: 900px)');
  function dragNer(ark) {
    var huvud = ark.querySelector('.ark__huvud');
    if (!huvud) return;
    var start = null;
    huvud.addEventListener('pointerdown', function (e) {
      if (!mobilBred.matches || e.button > 0 || e.target.closest('button, a, input, select, textarea')) return;
      start = { y: e.clientY, t: performance.now(), dy: 0 };
      try { huvud.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    });
    huvud.addEventListener('pointermove', function (e) {
      if (!start) return;
      start.dy = e.clientY - start.y;
      // nedåt följer arket fingret, uppåt bara lite (motstånd); slöjan ljusnar i takt med dragningen
      var dy = start.dy > 0 ? start.dy : Math.max(-24, start.dy * 0.2);
      if (Math.abs(start.dy) > 3) {
        ark.style.transition = 'none'; ark.style.transform = 'translateY(' + dy + 'px)';
        var sl = aktivtArk && aktivtArk.ark === ark ? aktivtArk.slojan : null;
        if (sl) { sl.style.transition = 'none'; sl.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / Math.max(1, ark.offsetHeight))); }
      }
    });
    var slapp = function () {
      if (!start) return;
      var fart = start.dy / Math.max(1, performance.now() - start.t), dy = start.dy;
      start = null;
      ark.style.transition = '';
      var sl = aktivtArk && aktivtArk.ark === ark ? aktivtArk.slojan : null;
      if (sl) { sl.style.transition = ''; sl.style.opacity = ''; }
      if (dy > 90 || (dy > 20 && fart > 0.5)) {
        if (!arkAndrat() || fragaKasta('Dra ner igen för att stänga ändå.')) { ark.style.transform = ''; IH.stangArk(); return; }
      }
      ark.style.transform = '';
    };
    huvud.addEventListener('pointerup', slapp);
    huvud.addEventListener('pointercancel', slapp);
  }
  IH.oppnaArk = function (opt) {
    // Öppnar ett ark ett annat behålls slöjan, och det gamla arket glider undan – sidan bakom blinkar inte
    var slojan = null, arvtFokus = aktivtArk ? aktivtArk.fokus : null;
    if (aktivtArk && !lugn) {
      var gml = aktivtArk;
      aktivtArk = null;
      // samma slöja, men utan det gamla arkets klicklyssnare
      slojan = gml.slojan.cloneNode(false);
      gml.slojan.replaceWith(slojan);
      gml.ark.inert = true;
      gml.ark.classList.add('ut');
      gml.ark.classList.remove('syns');
      setTimeout(function () { gml.ark.remove(); }, 220);
      if (gml.vidStang) gml.vidStang();
    } else IH.stangArk(true);
    var behallSloja = !!slojan;
    if (!slojan) { slojan = document.createElement('div'); slojan.className = 'slojan'; }
    var ark = document.createElement('aside');
    ark.className = 'ark ark--ny' + (opt.bred ? ' ark--bred' : '');
    ark.setAttribute('role', 'dialog');
    ark.setAttribute('aria-modal', 'true');
    ark.setAttribute('aria-label', opt.titel || 'Panel');
    ark.innerHTML = '<header class="ark__huvud">' + (opt.ikon ? '<span class="kort__ikon">' + IH.i(opt.ikon) + '</span>' : '') +
      '<div><h2>' + IH.e(opt.titel) + '</h2>' + (opt.under ? '<p>' + opt.under + '</p>' : '') + '</div>' +
      '<button class="ikonknapp" type="button" data-g="stang-ark" aria-label="Stäng">' + IH.i('stang') + '</button></header>' +
      '<div class="ark__kropp">' + (opt.kropp || '') + '</div>' + (opt.fot ? '<footer class="ark__fot">' + opt.fot + '</footer>' : '');
    Array.prototype.forEach.call(ark.querySelector('.ark__kropp').children, function (ch, k) { ch.style.setProperty('--k', Math.min(k, 6)); });
    if (!behallSloja) document.body.appendChild(slojan);
    document.body.appendChild(ark);
    document.documentElement.setAttribute('data-ark-oppen', '');
    dragNer(ark);
    slojan.addEventListener('click', function () { if (!arkAndrat() || fragaKasta('Klicka utanför igen för att stänga ändå.')) IH.stangArk(); });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { slojan.classList.add('syns'); ark.classList.add('syns'); });
    });
    // Raderna glider in bara när arket öppnas – inte varje gång kroppen skrivs om
    setTimeout(function () { ark.classList.remove('ark--ny'); }, 650);
    // Ersätter arket ett annat ärvs fokus från det, så att det hamnar rätt när kedjan stängs
    var fore = arvtFokus && arvtFokus.isConnected ? arvtFokus : document.activeElement;
    aktivtArk = { ark: ark, slojan: slojan, vidStang: opt.vidStang, fokus: fore && fore !== document.body && !ark.contains(fore) ? fore : arvtFokus };
    bakgrundInert(true);
    setTimeout(function () {
      var f = ark.querySelector('[autofocus]') || ark.querySelector('.ark__huvud .ikonknapp');
      if (f && aktivtArk && aktivtArk.ark === ark) f.focus({ preventScroll: true });
    }, 60);
    if (opt.efter) opt.efter(ark);
    return ark;
  };
  // Bakom ett öppet ark går det inte att tabba eller klicka in i menyn och sidan (aria-modal på riktigt)
  var INERT_SEL = ['.sido', '.sido-kant', '.huvud', '.mobilmeny', '.ihg-knapp', '.ihg-hej', '.ihg-meny'];
  function bakgrundInert(pa) {
    INERT_SEL.forEach(function (sel) {
      var el = $(sel); if (!el) return;
      if (pa) { if (!el.inert) { el.inert = true; el.setAttribute('data-ark-inert', ''); } }
      else if (el.hasAttribute('data-ark-inert')) {
        el.removeAttribute('data-ark-inert');
        // sidomenyn är fortfarande inert när den är infälld på dator
        el.inert = sel === '.sido' ? sidoDold() && datorBred.matches : false;
      }
    });
  }
  // utanFokus: vid sidbyte ska fokus inte tillbaka till en knapp på sidan man lämnar
  IH.stangArk = function (direkt, utanFokus) {
    if (!aktivtArk) return;
    var a = aktivtArk;
    aktivtArk = null;
    a.ark.classList.remove('syns');
    a.slojan.classList.remove('syns');
    var bort = function () { a.ark.remove(); a.slojan.remove(); };
    if (!aktivtArk) document.documentElement.removeAttribute('data-ark-oppen');
    bakgrundInert(false);
    if (direkt || lugn) bort(); else setTimeout(bort, 340);
    if (a.vidStang) a.vidStang();
    if (!direkt && !utanFokus && a.fokus && a.fokus.isConnected && a.fokus.focus) a.fokus.focus({ preventScroll: true });
  };

  /* --- Navigering --------------------------------------------------- */
  IH.vyer = IH.vyer || {};
  IH.G = IH.G || {};
  IH.nuvarande = { vy: 'oversikt', del: [] };

  function lasAdress() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    // En trasig %-kodning (t.ex. ett halvt kopierat %) behåller den råa delen i stället för att stoppa sidan
    var delar = h.split('/').filter(Boolean).map(function (d) { try { return decodeURIComponent(d); } catch (e) { return d; } });
    return { vy: delar[0] || 'oversikt', del: delar.slice(1) };
  }
  IH.ga = function (adress) {
    if (location.hash === adress) rita(); else location.hash = adress;
  };

  var MENY = [
    { rubrik: null, poster: [['oversikt', 'Översikt', 'hem']] },
    { rubrik: 'Sälj', poster: [['forfragningar', 'Förfrågningar', 'inkorg'], ['salj', 'Säljtavla', 'tavla'],
      ['kunder', 'Kunder', 'kunder'], ['offerter', 'Offerter', 'offert'], ['dokument', 'Dokument', 'mapp'], ['mote', 'Kundmöte', 'mote']] },
    { rubrik: 'Produktion', poster: [['produktion', 'Projekt', 'produktion']] },
    { rubrik: 'Verktyg', poster: [['kolla-marken', 'Kolla marken', 'grodd']] },
    { rubrik: 'Mitt', poster: [['chatt', 'Meddelanden', 'meddelande'], ['att-gora', 'Att göra', 'todo'], ['installningar', 'Inställningar', 'installning']] }
  ];
  // Produktionens meny: projekten, kunderna och offerterna – inte förfrågningar, säljtavlan eller kundmötet
  var PROD_MENY = [
    { rubrik: null, poster: [['oversikt', 'Översikt', 'hem']] },
    { rubrik: 'Produktion', poster: [['produktion', 'Projekt', 'produktion']] },
    { rubrik: 'Kunder', poster: [['kunder', 'Kunder', 'kunder'], ['offerter', 'Offerter', 'offert'], ['dokument', 'Dokument', 'mapp']] },
    { rubrik: 'Verktyg', poster: [['kolla-marken', 'Kolla marken', 'grodd']] },
    { rubrik: 'Mitt', poster: [['chatt', 'Meddelanden', 'meddelande'], ['att-gora', 'Att göra', 'todo'], ['installningar', 'Inställningar', 'installning']] }
  ];
  function menyFor(jag) { return jag.roll === 'admin' ? ADMIN_MENY : jag.roll === 'prod' ? PROD_MENY : MENY; }
  // Rollspärren i routern: administratören når säljarnas sidor genom supportläget, produktionen når inte försäljningen
  var SPARR = { admin: /^(forfragningar|salj|kunder|offerter|dokument|mote|produktion|chef)$/, prod: /^(forfragningar|salj|mote|chef)$/ };
  IH.sparrad = function (vy) { var r = SPARR[IH.jag().roll]; return !!r && r.test(vy); };
  // Administratörens meny (som i Uperformance): översikten, ledningen och det egna – säljarnas delar nås via supportläget
  var ADMIN_MENY = [
    { rubrik: null, poster: [['oversikt', 'Översikt', 'hem']] },
    { rubrik: 'Ledning', poster: [['kontroll', 'Kontrollcentral', 'matare'], ['admin', 'Adminpanel', 'nyckelverktyg'], ['sakerhet', 'Säkerhet', 'skold']] },
    { rubrik: 'Mitt', poster: [['chatt', 'Meddelanden', 'meddelande'], ['att-gora', 'Att göra', 'todo'], ['installningar', 'Inställningar', 'installning']] }
  ];

  function brickor() {
    var db = IH.db;
    var nya = db.forfragningar.filter(function (f) { return f.status === 'ny'; }).length;
    var oppna = db.affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).length;
    var proj = db.projekt.filter(function (p) { return p.steg !== 'klart'; }).length;
    var idag = new Date(); idag.setHours(23, 59, 59, 999);
    var jagId = IH.jag().id, uppg = db.uppgifter.filter(function (u) { return !u.klar && (!u.ansvarig || u.ansvarig === jagId) && new Date(u.forfaller) <= idag; }).length;
    return { forfragningar: [nya, true], salj: [oppna], kunder: [db.kunder.length], produktion: [proj], 'att-gora': [uppg, true], chatt: [IH.chattOlasta ? IH.chattOlasta() : 0, true] };
  }

  function sidomeny() {
    var jag = IH.jag();
    var b = brickor();
    var vaxel = IH.vyVaxel ? IH.vyVaxel() : '';
    var nav = menyFor(jag).map(function (grupp) {
      // Försäljningen (chefsvyn) syns bara för chefen, under Översikt som i Uperformance (ledning.js) –
      // men inte när växeln Säljvy/Chefsvy står överst: då finns bara en väg dit
      var poster = !grupp.rubrik && jag.chef && jag.roll === 'salj' && !vaxel ? grupp.poster.concat([['chef', 'Försäljningsledning', 'graf']]) : grupp.poster;
      return (grupp.rubrik ? '<p class="sido__rubrik">' + grupp.rubrik + '</p>' : '') + poster.map(function (p) {
        var br = b[p[0]];
        var bricka = br && br[0] ? '<span class="sido__bricka' + (br[1] ? ' sido__bricka--varm' : '') + '">' + br[0] + '</span>' : '';
        return '<a class="sido__lank" href="#/' + p[0] + '" data-vy="' + p[0] + '">' + IH.i(p[2]) + '<span>' + p[1] + '</span>' + bricka + '</a>';
      }).join('');
    }).join('');
    // Administratören går in i teamets konton härifrån (supportläget, stod.js)
    if (jag.roll === 'admin') nav += '<p class="sido__rubrik">Teamet</p>' + IH.ANVANDARE.filter(function (u) { return u.roll !== 'admin' && !u.inaktiv; }).map(function (u) {
      return '<button class="sido__lank sido__konto" type="button" data-g="visa-som" data-id="' + u.id + '" title="Visa som ' + IH.e(u.namn) + ' (supportläget)">' +
        '<span class="avatar" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(u.id) : '') + '</span><span>' + IH.e(u.namn) + '</span><span class="sido__ga">Gå in</span></button>';
    }).join('');
    return '<a class="sido__logo" href="#/"><img src="../images/legohus_logo.svg" alt="Legohus Stockholm"><span class="sido__crm">CRM <small>· Prototyp</small></span></a>' +
      '<div class="sido__verktyg"><button class="sido__sok" type="button" data-g="palett" aria-haspopup="dialog">' + IH.i('sok') + '<span>Sök…</span><kbd>' + (MAC ? '⌘' : 'Ctrl ') + 'K</kbd></button>' + klocka('sido') +
      (jag.roll === 'admin' ? '' : '<button class="sido__ny" type="button" data-g="ny" aria-label="Skapa ny" title="Skapa ny  N">' + IH.i('plus') + '</button>') + '</div>' +
      vaxel +
      '<nav class="sido__nav" aria-label="Huvudmeny"><span class="sido__markor" aria-hidden="true"></span>' + nav + '</nav>' +
      '<div class="sido__fot"><button class="sido__mer" type="button" tabindex="-1" aria-hidden="true" data-g="sido-mer">Mer ' + IH.i('pil') + '</button>' +
      '<button class="anv" type="button" data-g="konto-meny" aria-haspopup="dialog"><span class="avatar' + (IH.sakerBild(jag.bild) ? ' avatar--bild' : '') + '" style="--av:' + jag.farg + (IH.sakerBild(jag.bild) ? ';background-image:url(' + IH.sakerBild(jag.bild) + ');background-size:cover;color:transparent' : '') + '">' + IH.initialer(jag.namn) +
      (IH.narvaroPrick ? IH.narvaroPrick(jag.id) : '') + '</span>' +
      '<span><b>' + IH.e(jag.namn) + '</b><small class="anv__status">' + (IH.narvaro ? IH.e(IH.narvaro(jag.id).namn) + ' · ' : '') + IH.e(String(jag.titel || '').split(' · ')[0]) + '</small></span><span class="anv__chevron" aria-hidden="true">' + IH.i('chevron') + '</span></button>' +
      '<div class="sido__smalt"><a href="../index.html" data-g="lamna" title="Till hemsidan">' + IH.i('hem') + 'Hemsidan</a>' +
      '<button type="button" data-g="logga-ut" title="Logga ut">' + IH.i('utloggning') + 'Logga ut</button>' +
      (jag.roll === 'admin' ? '<button type="button" class="sido__aterstall" data-g="sido-aterstall" title="Återställ exempeldata" aria-label="Återställ exempeldata">' + IH.i('aterstall') + '</button>' : '') + '</div></div>';
  }

  function mobilmeny() {
    var b = brickor();
    var roll = IH.jag().roll;
    var poster = roll === 'admin' ? [['oversikt', 'Översikt', 'hem'], ['kontroll', 'Kontroll', 'matare'], ['admin', 'Adminpanel', 'nyckelverktyg'], ['sakerhet', 'Säkerhet', 'skold']]
      : roll === 'prod' ? [['oversikt', 'Översikt', 'hem'], ['produktion', 'Projekt', 'produktion'], ['kunder', 'Kunder', 'kunder'], ['offerter', 'Offerter', 'offert']]
      : [['oversikt', 'Översikt', 'hem'], ['forfragningar', 'Förfrågn.', 'inkorg', 'Förfrågningar'], ['salj', 'Säljtavla', 'tavla'], ['kunder', 'Kunder', 'kunder']];
    return poster.map(function (p) {
      var br = b[p[0]];
      // Förfrågningar får inte plats i bottenmenyn: där står kortformen, med hela namnet för skärmläsare
      return '<a href="#/' + p[0] + '" data-vy="' + p[0] + '"' + (p[3] ? ' aria-label="' + p[3] + '" title="' + p[3] + '"' : '') + '>' + IH.i(p[2]) + p[1] + (br && br[1] && br[0] ? '<i>' + br[0] + '</i>' : '') + '</a>';
    }).join('') + '<button type="button" data-g="mer" data-mer>' + IH.i('meny') + 'Mer</button>';
  }

  // Den infällda menyn på dator: sidorna som ikoner i rälsen till vänster (sök och Ny finns i toppen)
  function rals() {
    var jag = IH.jag(), b = brickor();
    // Alla sidor, grupperade som i sidomenyn med en tunn avdelare mellan grupperna. Knappen som fäller
    // ut menyn sitter mitt på kanten – grupperna delas i en övre och en nedre halva runt den.
    var grupper = menyFor(jag).map(function (g) { return !g.rubrik && jag.chef && jag.roll === 'salj' ? g.poster.concat([['chef', 'Försäljningsledning', 'graf']]) : g.poster; });
    var totalt = grupper.reduce(function (n, g) { return n + g.length; }, 0), halvor = [[], []], uppe = 0;
    grupper.forEach(function (g) { var h = uppe && uppe + g.length / 2 > totalt / 2 ? 1 : 0; if (!h) uppe += g.length; halvor[h].push(g); });
    if (!halvor[1].length && halvor[0].length > 1) halvor[1].push(halvor[0].pop());
    var lank = function (p) {
      var br = b[p[0]];
      return '<a href="#/' + p[0] + '" data-vy="' + p[0] + '" title="' + p[1] + '" aria-label="' + p[1] + '">' + IH.i(p[2]) + (br && br[1] && br[0] ? '<i>' + br[0] + '</i>' : '') + '</a>';
    };
    // Klockan (aviseringarna) sist i den nedre halvan, bland det egna (Meddelanden, Att göra, Inställningar)
    var olasta = IH.db && IH.avisera ? IH.avisera.olasta() : 0;
    var klockaRals = '<a href="#/" role="button" class="sido-rals__klocka" data-g="aviseringar" aria-haspopup="dialog" title="Aviseringar" aria-label="Aviseringar' + (olasta ? ', ' + olasta + ' olästa' : '') + '">' +
      IH.i('bjallra') + (olasta ? '<i>' + (olasta > 99 ? '99+' : olasta) + '</i>' : '') + '</a>';
    return halvor.map(function (h, n) {
      return '<div class="sido-rals__halva sido-rals__halva--' + (n ? 'ner' : 'upp') + '">' + h.map(function (g, k) {
        return (k ? '<span class="sido-rals__delare" aria-hidden="true"></span>' : '') + g.map(lank).join('');
      }).join('') + (n ? klockaRals : '') + '</div>';
    }).join('<span class="sido-rals__mitt" aria-hidden="true"></span>');
  }
  // Rälsens stil ligger i grund.css ("Sidomenyn – låda, knapp, räls, docka")
  // Kontot i toppraden när menyn är infälld: avatar med närvaroprick (kontokortet i sidomenyn syns inte då)
  function toppKonto() {
    var jag = IH.jag();
    return '<span class="avatar' + (IH.sakerBild(jag.bild) ? ' avatar--bild' : '') + '" style="--av:' + jag.farg + (IH.sakerBild(jag.bild) ? ';background-image:url(' + IH.sakerBild(jag.bild) + ');background-size:cover;color:transparent' : '') + '">' +
      IH.initialer(jag.namn) + (IH.narvaroPrick ? IH.narvaroPrick(jag.id) : '') + '</span>';
  }
  function skal() {
    var app = $('#app'), h = { '.sido': sidomeny(), '.sido-rals': rals(), '.topp__konto': toppKonto(), '.topp__klocka': klocka('topp'), '.mobilmeny': mobilmeny() };
    app.innerHTML = '<aside class="sido" id="sidomeny">' + h['.sido'] + '</aside>' +
      '<div class="sido-kant"><button class="sido-knapp" type="button" data-sido-knapp aria-controls="sidomeny" aria-expanded="true" aria-label="Dölj menyn" title="Dölj menyn  [">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5 9 12l5.5 5.5"/></svg></button>' +
      '<nav class="sido-rals" aria-label="Meny" inert>' + h['.sido-rals'] + '</nav></div>' +
      '<div class="huvud"><header class="topp">' +
      '<button class="sok" type="button" data-g="palett" aria-haspopup="dialog">' + IH.i('sok') + '<span>Sök eller skriv ett kommando…</span><kbd>' + (MAC ? '⌘' : 'Ctrl ') + 'K</kbd></button>' +
      '<span class="topp__titel" data-topp-titel></span>' +
      '<span class="proto">Prototyp · exempeldata</span>' +
      '<span class="topp__klocka">' + h['.topp__klocka'] + '</span>' +
      (IH.jag().roll === 'admin' ? '' : '<button class="knapp knapp--virke" type="button" data-g="ny">' + IH.i('plus') + 'Ny</button>') +
      '<button class="topp__konto" type="button" data-g="konto-meny" aria-haspopup="dialog" aria-label="Konto och status">' + h['.topp__konto'] + '</button>' +
      '</header><main class="vy" id="vy" tabindex="-1"></main></div>' +
      '<nav class="mobilmeny" aria-label="Meny">' + h['.mobilmeny'] + '</nav>' +
      '<div class="toaster" aria-live="polite"></div>';
    // det som just skrevs är menyernas nuvarande innehåll (IH.uppdateraMeny jämför mot det)
    Object.keys(h).forEach(function (s) { var el = $(s, app); if (el) el.__ihMeny = h[s]; });
  }

  // Sidomenyn kan fällas in på dator (knappen på kanten eller [). Allt som hör till menyn rör sig som EN rörelse:
  // samma tid (GLID) och samma lådkurva, startar i samma bildruta och landar samtidigt. app.js mäter läget före och
  // efter växlingen och spelar upp skillnaden med Web Animations (FLIP – en layoutändring, sedan bara transform och
  // opacitet). CSS-övergångarna är avstängda under glidningen (grund.css, "Sidomenyn – glidningen").
  //   menyn och kanten med knappen och rälsen   glider i sidled
  //   knappen                                     byter form (pill ⇄ rund) och pilen roterar 180°
  //   rälsen och listen                           följer kanten och tonar in/ut
  //   ?-knappen och kontot                        följer med till/från rälsen
  //   innehållet och toppraden                    glider som ett block
  // Ett nytt klick mitt i glidningen fortsätter från där allt står just då, med kortare tid.
  var datorBred = matchMedia('(min-width: 1101px)');
  // Tiden läses ur --glid (grund.css) så att CSS och JS inte kan glida isär. Kurvan hör ihop med lada() nedan.
  var GLID = 460, KURVA = 'cubic-bezier(0.32,0.72,0,1)';
  function glidTid() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--glid').trim(), n = parseFloat(v);
    return isFinite(n) && n > 0 ? Math.round(/ms$/.test(v) ? n : n * 1000) : GLID;
  }
  function sidoDold() { return document.documentElement.hasAttribute('data-sido-dold'); }
  // Lådkurvans förlopp vid en viss tid (för att korta tiden när man vänder mitt i)
  function lada(x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 10; i++) {
      var fx = 0.96 * t * (1 - t) * (1 - t) + t * t * t - x;
      var d = 0.96 * (1 - t) * (1 - t) - 1.92 * t * (1 - t) + 3 * t * t;
      if (Math.abs(fx) < 1e-5 || Math.abs(d) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - fx / d));
    }
    return 2.16 * t * (1 - t) * (1 - t) + 3 * t * t * (1 - t) + t * t * t;
  }
  // Knappens slutläge direkt efter växlingen (utan att vänta på glidningen): en osynlig kopia av kanten
  // utan övergångar mäts.
  function sidoKnappSlut() {
    var kant = $('.sido-kant'), kn = kant && $('.sido-knapp', kant);
    if (!kant || !kn || !datorBred.matches) return null;
    var k = kant.cloneNode(false), kk = kn.cloneNode(false);
    k.style.cssText = 'transition:none!important;animation:none!important;visibility:hidden!important;pointer-events:none!important';
    kk.style.cssText = 'transition:none!important;animation:none!important;translate:none!important';
    k.removeAttribute('id'); k.appendChild(kk); kant.parentNode.appendChild(k);
    var r = kk.getBoundingClientRect(); k.remove();
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  }
  IH.sidoKnappSlut = sidoKnappSlut;
  // När glidningen landat: de som beror på bredden (3D, diagram, kortrutnät) får en resize. IH.sidoResize
  // säger att den kommer från menyn, så att t.ex. chatten och menyerna kan låta bli att bygga om sig.
  function sidoKlar(dold) {
    IH.sidoResize = true;
    try { window.dispatchEvent(new Event('resize')); } finally { IH.sidoResize = false; }
    window.dispatchEvent(new CustomEvent('ih:sido-klar', { detail: { dold: dold } }));
  }

  var glid = null; // pågående glidning: { start, tid, dold, anims, skuggor, frysta }
  var KNAPP_MATT = ['left', 'width', 'height', 'marginTop', 'marginLeft', 'borderRadius'];
  function sidoDelar() {
    var e = { sido: $('.sido'), kant: $('.sido-kant'), knapp: $('.sido-knapp'), rals: $('.sido-rals'), ihg: $('.ihg-knapp'), topp: $('.topp'), konto: $('.topp__konto'), vy: $('#vy') };
    e.svg = e.knapp && $('svg', e.knapp);
    e.ankare = e.vy && (e.vy.firstElementChild || e.vy);
    e.toppBarn = e.topp ? [].slice.call(e.topp.children).filter(function (b) { return b !== e.konto; }) : [];
    return e;
  }
  function syns(el) { return !!el && el.getClientRects().length > 0; }
  function ruta(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function vinkel(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    var m = new DOMMatrixReadOnly(t), a = Math.atan2(m.b, m.a) * 180 / Math.PI;
    return a < -90 ? a + 360 : a;
  }
  function opac(el, pseudo) { var c = getComputedStyle(el, pseudo || null); return c.visibility === 'hidden' || c.display === 'none' ? 0 : +c.opacity; }
  // Läget just nu – med en pågående glidning inräknad
  function sidoMatt(e) {
    var m = { sy: window.scrollY };
    ['sido', 'kant', 'ihg', 'ankare'].forEach(function (k) { if (syns(e[k])) m[k] = ruta(e[k]); });
    if (e.knapp && syns(e.knapp)) { var cs = getComputedStyle(e.knapp); m.knapp = {}; KNAPP_MATT.forEach(function (p) { m.knapp[p] = cs[p]; }); m.knappRuta = ruta(e.knapp); }
    if (e.svg) m.vinkel = vinkel(e.svg);
    if (e.rals) m.rals = opac(e.rals);
    if (e.kant) { m.listen = opac(e.kant, '::after'); m.linjen = opac(e.kant, '::before'); }
    var sk = glid && glid.skuggor;
    m.topp = sk && sk.topp ? opac(sk.topp) : (e.toppBarn.filter(syns)[0] ? opac(e.toppBarn.filter(syns)[0]) : 0);
    m.konto = sk && sk.konto ? opac(sk.konto) : (syns(e.konto) ? opac(e.konto) : 0);
    return m;
  }
  // En skugga av det som försvinner direkt vid växlingen (toppraden och kontot finns bara med infälld meny): en kopia
  // med beräknad stil på samma plats, som tonar bort i takt med resten
  var SKUGG_STIL = ['display', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'outline',
    'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'box-shadow', 'opacity', 'visibility', 'overflow',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'white-space', 'text-overflow',
    'flex-direction', 'flex-wrap', 'flex', 'align-items', 'justify-content', 'gap', 'place-items', 'vertical-align', 'position', 'left', 'top', 'right', 'bottom',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'mask', '-webkit-mask'];
  function skugga(delar, z) {
    var hylla = document.createElement('div');
    hylla.className = 'sido-skugga'; hylla.setAttribute('aria-hidden', 'true'); hylla.inert = true;
    hylla.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;margin:0;padding:0;pointer-events:none;z-index:' + z;
    delar.forEach(function (el) {
      if (!syns(el)) return;
      var r = el.getBoundingClientRect(), k = el.cloneNode(true);
      var kalla = [el].concat([].slice.call(el.querySelectorAll('*'))), mal = [k].concat([].slice.call(k.querySelectorAll('*')));
      kalla.forEach(function (s, i) {
        var cs = getComputedStyle(s), d = mal[i], txt = '';
        for (var j = 0; j < SKUGG_STIL.length; j++) txt += SKUGG_STIL[j] + ':' + cs.getPropertyValue(SKUGG_STIL[j]) + ';';
        d.style.cssText = txt; d.removeAttribute('id'); d.removeAttribute('data-g'); d.removeAttribute('data-sido-knapp');
      });
      k.style.position = 'absolute'; k.style.left = r.left + 'px'; k.style.top = r.top + 'px'; k.style.width = r.width + 'px'; k.style.height = r.height + 'px';
      k.style.margin = '0'; k.style.boxSizing = 'border-box'; k.style.transform = 'none'; k.style.translate = 'none'; k.style.transition = 'none'; k.style.animation = 'none';
      hylla.appendChild(k);
    });
    return hylla; // läggs in i sidan av sattSido, efter att allt annat är mätt
  }
  // Rälsens nedre halva får sin luft av regler som hänger på infälld meny och dockad chatt; medan rälsen tonar ut
  // står den kvar som den var, så att ikonerna inte hoppar
  var RALS_LUFT = ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];
  function frysRals(e) {
    if (!e.rals) return [];
    return [].slice.call(e.rals.querySelectorAll('.sido-rals__halva')).map(function (h) {
      var cs = getComputedStyle(h);
      return [h, RALS_LUFT.map(function (p) { return cs[p]; })];
    });
  }
  function stoppaGlid(slut) {
    if (!glid) return;
    var g = glid; glid = null;
    g.anims.forEach(function (a) { a.cancel(); });
    if (g.skuggor) Object.keys(g.skuggor).forEach(function (k) { if (g.skuggor[k]) g.skuggor[k].remove(); });
    g.frysta.forEach(function (f) { RALS_LUFT.forEach(function (p) { f[0].style[p] = ''; }); });
    if (slut) document.documentElement.classList.remove('sido-glider');
  }
  function sattSido(dold, animera) {
    var rot = document.documentElement;
    var lugnt = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rora = !!animera && datorBred.matches && !lugnt && !!rot.animate;
    if (rora && glid && glid.dold === dold && sidoDold() === dold) return; // redan på väg dit
    var e = sidoDelar(), fore = null, tid = glidTid(), skuggor = null, frysta = [];
    // Magnetens förskjutning ska inte följa med knappen eller chattikonen till det nya läget
    $$('.sido-knapp, .chf-ikon').forEach(function (el) { el.style.translate = ''; });
    if (rora) {
      // Mät före – med en pågående glidning inräknad – och avbryt den sedan, så att ett snabbt andra klick fortsätter därifrån
      fore = sidoMatt(e);
      if (glid) tid = Math.round(tid * (0.4 + 0.6 * lada(Math.min(1, (performance.now() - glid.start) / glid.tid))));
      // Det som försvinner direkt när menyn fälls ut får en skugga som tonar bort (toppraden, kontot)
      if (!dold) {
        skuggor = {};
        if (glid && glid.skuggor) { skuggor = glid.skuggor; glid.skuggor = null; }
        else {
          if (fore.topp > 0) skuggor.topp = skugga(e.toppBarn, 37);
          if (fore.konto > 0) skuggor.konto = skugga([e.konto], 40);
        }
      }
      if (!dold) frysta = frysRals(e);
      stoppaGlid(false);
      frysta.forEach(function (f) { RALS_LUFT.forEach(function (p, i) { f[0].style[p] = f[1][i]; }); });
      if (skuggor) Object.keys(skuggor).forEach(function (n) { if (skuggor[n] && !skuggor[n].isConnected) document.body.appendChild(skuggor[n]); });
      rot.classList.add('sido-glider');
    } else {
      stoppaGlid(true);
    }
    var ankY = !rora && animera && datorBred.matches && e.ankare && window.scrollY > 0 ? e.ankare.getBoundingClientRect().top : null;
    rot.toggleAttribute('data-sido-dold', dold);
    var s = $('.sido'); if (s) s.inert = dold && datorBred.matches;
    var r = $('.sido-rals'); if (r) r.inert = !(dold && datorBred.matches);
    // Kortrutnäten räknas om direkt i den nya bredden, så att de inte hoppar en gång till efter glidningen
    $$('.kundnat').forEach(centreraGrid);
    var k = $('[data-sido-knapp]'), text = dold ? 'Visa menyn' : 'Dölj menyn';
    if (k) { k.setAttribute('aria-expanded', String(!dold)); k.setAttribute('aria-label', text); k.title = text + '  ['; }
    try { localStorage.setItem('ih-crm-sido-dold', dold ? '1' : '0'); } catch (x) { /* ingen lagring */ }

    var anims = [], efter = null;
    if (rora) {
      efter = sidoMatt(e);
      // Rullad sida: toppraden som kommer eller går tas upp av rullningen, så att innehållet står still i höjdled
      if (fore.ankare && efter.ankare) {
        var dy0 = fore.ankare.y - efter.ankare.y;
        if (Math.abs(dy0) > 1 && window.scrollY > 0) { window.scrollTo(0, Math.max(0, window.scrollY - dy0)); efter.ankare = ruta(e.ankare); }
      }
      var spela = function (el, kf, o) {
        if (!el) return null;
        var opt = { duration: tid, easing: KURVA }; if (o) Object.keys(o).forEach(function (n) { opt[n] = o[n]; });
        var a = el.animate(kf, opt); anims.push(a); return a;
      };
      // Tonar in (efter att kanten hunnit en bit) eller ut (under första halvan) – linjärt i tid
      var tona = function (el, fran, till, o) {
        if (fran === till && !o) return null;
        var kf = till > fran ? [{ opacity: fran, offset: 0 }, { opacity: fran, offset: 0.12 }, { opacity: till, offset: 0.62 }, { opacity: till }]
          : [{ opacity: fran }, { opacity: till, offset: 0.42 }, { opacity: till }];
        var opt = { easing: 'linear' }; if (o) Object.keys(o).forEach(function (n) { opt[n] = o[n]; });
        if (opt.synlig) { kf.forEach(function (f) { f.visibility = 'visible'; }); delete opt.synlig; }
        return spela(el, kf, opt);
      };
      var tf = function (el) { var t = getComputedStyle(el).transform; return t && t !== 'none' ? t : ''; };
      // Innehållet
      var vdx = 0, vdy = 0;
      if (fore.ankare && efter.ankare) {
        vdx = fore.ankare.x - efter.ankare.x; vdy = fore.ankare.y - efter.ankare.y;
        if (Math.abs(vdx) > 0.5 || Math.abs(vdy) > 0.5) spela(e.vy, [{ transform: 'translate3d(' + vdx + 'px,' + vdy + 'px,0)' }, { transform: 'none' }]);
      }
      // Menyn och kanten (med knappen och rälsen) glider i sidled
      if (fore.sido && efter.sido) { var ts = tf(e.sido); spela(e.sido, [{ transform: 'translateX(' + (fore.sido.x - efter.sido.x) + 'px) ' + ts, opacity: 1 }, { transform: ts || 'none', opacity: 1 }]); }
      var kdx = fore.kant && efter.kant ? fore.kant.x - efter.kant.x : 0;
      if (kdx) { var tk = tf(e.kant); spela(e.kant, [{ transform: 'translateX(' + kdx + 'px) ' + tk }, { transform: tk || 'none' }]); }
      // Knappen byter form och läge på kanten, pilen vänder
      if (fore.knapp && efter.knapp) {
        var k0 = {}, k1 = {};
        KNAPP_MATT.forEach(function (p) { k0[p] = fore.knapp[p]; k1[p] = efter.knapp[p]; });
        spela(e.knapp, [k0, k1]);
      }
      if (e.svg && fore.vinkel !== efter.vinkel) spela(e.svg, [{ transform: 'rotate(' + fore.vinkel + 'deg)' }, { transform: 'rotate(' + efter.vinkel + 'deg)' }]);
      // Rälsen och listen bakom den följer kanten och tonar
      tona(e.rals, fore.rals, efter.rals, { synlig: true });
      if (e.kant) {
        tona(e.kant, fore.listen, efter.listen, { pseudoElement: '::after' });
        tona(e.kant, fore.linjen, efter.linjen, { pseudoElement: '::before' });
      }
      // ?-knappen flyttar mellan menyns fot och rälsen
      if (fore.ihg && efter.ihg && (Math.abs(fore.ihg.x - efter.ihg.x) > 0.5 || Math.abs(fore.ihg.y - efter.ihg.y) > 0.5)) {
        var cx = fore.ihg.x + fore.ihg.w / 2 - (efter.ihg.x + efter.ihg.w / 2), cy = fore.ihg.y + fore.ihg.h / 2 - (efter.ihg.y + efter.ihg.h / 2);
        spela(e.ihg, [{ transform: 'translate(' + cx + 'px,' + cy + 'px) scale(' + (fore.ihg.w / efter.ihg.w) + ',' + (fore.ihg.h / efter.ihg.h) + ')' }, { transform: 'none' }]);
      }
      if (dold) {
        // Toppraden kommer in tillsammans med innehållet, kontot följer kanten ner i rälsen
        e.toppBarn.filter(syns).forEach(function (b) {
          spela(b, [{ transform: 'translate(' + vdx + 'px,' + vdy + 'px)' }, { transform: 'none' }]);
          tona(b, fore.topp, 1);
        });
        if (syns(e.konto)) {
          spela(e.konto, [{ transform: 'translateX(' + kdx + 'px)' }, { transform: 'none' }]);
          tona(e.konto, fore.konto, 1);
        }
        if (skuggor) Object.keys(skuggor).forEach(function (n) { if (skuggor[n]) skuggor[n].remove(); });
        skuggor = null;
      } else if (skuggor) {
        // Skuggorna glider med innehållet respektive kanten och tonar bort
        var ny = function (sk, dx, dy, op) {
          if (!sk) return;
          var t0 = getComputedStyle(sk).transform, m = t0 && t0 !== 'none' ? new DOMMatrixReadOnly(t0) : { e: 0, f: 0 };
          spela(sk, [{ transform: 'translate(' + m.e + 'px,' + m.f + 'px)' }, { transform: 'translate(' + (m.e + dx) + 'px,' + (m.f + dy) + 'px)' }], { fill: 'forwards' });
          tona(sk, op, 0, { fill: 'forwards' });
        };
        ny(skuggor.topp, -vdx, -vdy, fore.topp);
        ny(skuggor.konto, -kdx, 0, fore.konto);
      }
      var denna = glid = { start: performance.now(), tid: tid, dold: dold, anims: anims, skuggor: skuggor, frysta: frysta };
      Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
        if (glid !== denna) return;
        stoppaGlid(true);
        sidoKlar(dold);
      }, function () { /* avbruten av ett nytt klick */ });
    } else if (ankY != null) {
      // Utan glidning: rullad sida står ändå still i höjdled
      var dyR = ankY - e.ankare.getBoundingClientRect().top;
      if (Math.abs(dyR) > 1) window.scrollTo(0, Math.max(0, window.scrollY - dyR));
    }
    if (!rora && animera && lugnt && datorBred.matches && rot.animate) {
      // Reducerad rörelse: en kort tvärtoning i stället för glidning
      [[$('.huvud'), 0.5], [e.kant, 0], [dold ? null : e.sido, 0], [e.ihg, 0]].forEach(function (p) { if (p[0]) p[0].animate([{ opacity: p[1] }, { opacity: 1 }], { duration: 160, easing: 'linear' }); });
    }
    // Direkt vid växlingen: knappens slutläge, tid och kurva – så att chattikonen kan flyga i takt med menyn
    window.dispatchEvent(new CustomEvent('ih:sido', { detail: { dold: dold, animera: rora, tid: rora ? tid : 0, kurva: KURVA, knapp: efter && efter.knappRuta ? { left: efter.knappRuta.x, top: efter.knappRuta.y, width: efter.knappRuta.w, height: efter.knappRuta.h, right: efter.knappRuta.x + efter.knappRuta.w, bottom: efter.knappRuta.y + efter.knappRuta.h } : sidoKnappSlut() } }));
    // chatt.js läser det här i samma ögonblick (dess observer körs direkt efter växlingen) och låter dockan och
    // bubblan följa knappen; efteråt gäller det inte längre
    IH.sidoGlid = rora && fore.knappRuta && efter.knappRuta ? { tid: tid, kurva: KURVA, knappFran: { left: fore.knappRuta.x, top: fore.knappRuta.y, width: fore.knappRuta.w, height: fore.knappRuta.h },
      knappTill: { left: efter.knappRuta.x, top: efter.knappRuta.y, width: efter.knappRuta.w, height: efter.knappRuta.h, right: efter.knappRuta.x + efter.knappRuta.w, bottom: efter.knappRuta.y + efter.knappRuta.h } } : null;
    if (IH.sidoGlid) setTimeout(function () { IH.sidoGlid = null; }, 0);
    if (!rora) setTimeout(function () { sidoKlar(dold); }, animera && lugnt ? 160 : 0);
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-sido-knapp]')) sattSido(!sidoDold(), true);
  });
  document.addEventListener('keydown', function (ev) {
    // AltGr (svensk [ = AltGr+8) ger ctrlKey och altKey i Windows – den räknas inte som Ctrl/Alt
    var altGr = ev.getModifierState && ev.getModifierState('AltGraph');
    if (ev.key !== '[' || ev.metaKey || ((ev.ctrlKey || ev.altKey) && !altGr) || !datorBred.matches || document.querySelector('.mote')) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    if (document.documentElement.hasAttribute('data-ark-oppen') || document.documentElement.hasAttribute('data-palett-oppen')) return;
    ev.preventDefault(); sattSido(!sidoDold(), true);
  });
  datorBred.addEventListener('change', function () { var s = $('.sido'), r = $('.sido-rals'); if (s) s.inert = sidoDold() && datorBred.matches; if (r) r.inert = !(sidoDold() && datorBred.matches); });
  IH.sattSido = sattSido;
  IH.G['vaxla-sido'] = function () { if (datorBred.matches) sattSido(!sidoDold(), true); };

  // Kortrutnät med en ofullständig sista rad (t.ex. 14 kunder i 3 spalter):
  // sista raden centreras, så att sidan blir symmetrisk. Rutnätet får dubbelt
  // så många spår och varje kort spänner över två – då kan raden flyttas ett
  // halvt kort åt gången.
  function centreraGrid(g) {
    var barn = [].slice.call(g.children);
    g.style.gridTemplateColumns = '';
    barn.forEach(function (c) { c.style.gridColumn = ''; });
    var n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
    var r = barn.length % n;
    if (n < 2 || !r || !datorBred.matches) return;
    g.style.gridTemplateColumns = 'repeat(' + n * 2 + ', minmax(0, 1fr))';
    barn.forEach(function (c) { c.style.gridColumn = 'span 2'; });
    barn[barn.length - r].style.gridColumn = (n - r + 1) + ' / span 2';
  }
  var centreraVantar = 0;
  function centreraAlla() {
    cancelAnimationFrame(centreraVantar);
    centreraVantar = requestAnimationFrame(function () { [].forEach.call(document.querySelectorAll('.kundnat'), centreraGrid); });
  }
  window.addEventListener('resize', centreraAlla);

  // Sidomenyns markör glider till den valda raden.
  function flyttaMarkor(direkt) {
    var nav = $('.sido__nav');
    var m = $('.sido__markor');
    if (!nav || !m) return;
    var a = $('.sido__lank.aktiv', nav);
    if (!a) { m.style.opacity = '0'; return; }
    if (direkt) m.style.transition = 'none';
    m.style.opacity = '1';
    m.style.height = a.offsetHeight + 'px';
    m.style.transform = 'translateY(' + a.offsetTop + 'px)';
    if (direkt) { void m.offsetWidth; m.style.transition = ''; }
    // I låga fönster rullar menyn: den valda raden ska alltid synas.
    if (a.offsetTop < nav.scrollTop || a.offsetTop + a.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: Math.max(0, a.offsetTop - nav.clientHeight / 2 + a.offsetHeight / 2), behavior: direkt ? 'auto' : 'smooth' });
    }
    sidoMer();
  }

  // Visar "Mer" när det finns rader under kanten och skuggan överst när
  // menyn är rullad.
  function sidoMer() {
    var nav = $('.sido__nav'), sido = $('.sido');
    if (!nav || !sido) return;
    sido.classList.toggle('sido--mer', nav.scrollTop + nav.clientHeight < nav.scrollHeight - 6);
    sido.classList.toggle('sido--rullad', nav.scrollTop > 4);
  }
  document.addEventListener('scroll', function (ev) { if (ev.target.classList && ev.target.classList.contains('sido__nav')) sidoMer(); }, true);
  // Menyns egen in-/utfällning ändrar inte menyns bredd – markören står kvar (sparar en tung bildruta när glidningen landar)
  window.addEventListener('resize', function () { if (!IH.sidoResize) flyttaMarkor(true); });

  // Mjuk krusning där man trycker, i menyn och på mobilmenyn.
  document.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest && ev.target.closest('.sido__lank, .anv, .sido__smalt a, .sido__smalt button, .sido__logo, .mobilmeny a, .mobilmeny button');
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    var k = document.createElement('span');
    k.className = 'krusning';
    k.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (ev.clientX - r.left - d / 2) + 'px;top:' + (ev.clientY - r.top - d / 2) + 'px';
    el.appendChild(k);
    setTimeout(function () { k.remove(); }, 750);
  });

  // Menyerna byggs bara om när innehållet faktiskt ändrats (samma HTML som förra gången = samma DOM).
  // Svaret säger om sidomenyn byggdes om – grund.js räknar då om vad som får plats.
  function skrivMeny(el, html) {
    if (el.__ihMeny === html) return false;
    el.innerHTML = html; el.__ihMeny = html;
    return true;
  }
  IH.uppdateraMeny = function () {
    var sido = $('.sido'), mm = $('.mobilmeny'), rl = $('.sido-rals'), tk = $('.topp__konto');
    var sidoNy = !!sido && skrivMeny(sido, sidomeny());
    var mmNy = !!mm && skrivMeny(mm, mobilmeny());
    var rlNy = !!rl && skrivMeny(rl, rals());
    if (sidoNy || mmNy || rlNy) markera(true);
    if (tk) skrivMeny(tk, toppKonto());
    var tkl = $('.topp__klocka');
    if (tkl) skrivMeny(tkl, klocka('topp'));
    return sidoNy;
  };

  function markera(direkt) {
    var vy = IH.nuvarande.vy;
    var mer = $('.mobilmeny [data-mer]'); if (mer) mer.classList.toggle('aktiv', !$('.mobilmeny [data-vy="' + vy + '"]'));
    $$('[data-vy]').forEach(function (a) {
      var ja = a.getAttribute('data-vy') === vy;
      // Ett litet hopp i ikonen när raden blir vald (inte vid omritning).
      if (ja && !direkt && !a.classList.contains('aktiv')) {
        a.classList.remove('hopp'); void a.offsetWidth; a.classList.add('hopp');
        a.addEventListener('animationend', function slut(ev) { if (ev.target === a.firstElementChild) { a.classList.remove('hopp'); a.removeEventListener('animationend', slut); } });
      }
      a.classList.toggle('aktiv', ja);
      if (ja) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    flyttaMarkor(direkt);
  }

  var forraVy = null, rullMinne = {};
  var DETALJ_VY = /^(kunder|salj|offerter|produktion)$/;
  // Den sida man kom ifrån (adress och titel): "← Karin Holm" i stället för alltid "← Säljtavlan"
  var vagen = [];
  var FORRA_OK = /^#\/(?:(kunder|salj|offerter|forfragningar|produktion)\/[^/?]+|oversikt)?$/;
  function tillbakaRatt(yta, titel) {
    // vägen hit: tillbaka till föregående adress plockar bort den senaste, annars läggs sidan till
    var h = location.hash || '#/', n = vagen.length;
    if (n >= 2 && vagen[n - 2].adr === h) vagen.pop();
    else if (!n || vagen[n - 1].adr !== h) vagen.push({ adr: h });
    if (vagen.length > 20) vagen.shift();
    vagen[vagen.length - 1].titel = titel || '';
    IH.forra = vagen.length > 1 ? vagen[vagen.length - 2] : null;
    var tb = yta.querySelector('a.tillbaka'), f = IH.forra;
    if (!tb || !f || !f.adr || f.adr === location.hash || !FORRA_OK.test(f.adr) || tb.getAttribute('href') === f.adr) return;
    var namn = f.adr === '#/' || f.adr === '#/oversikt' ? 'Översikt' : f.titel;
    if (!namn) return;
    tb.setAttribute('href', f.adr);
    tb.innerHTML = IH.i('pilv') + IH.e(namn);
  }
  // Entréanimationen (.vy--in) gäller bara sidbytet. När den har spelats klart tas klassen bort,
  // så att en omritning på plats (dra ett kort, välja filter, spara) inte tonar in hela sidan igen.
  var IN_SEL = '[data-in], [data-stagger] > *, .ord > span, .rad-mask > span';
  function stillaSnart(yta) {
    clearTimeout(stillaSnart.t);
    var kolla = function () {
      if (!yta.classList.contains('vy--in')) return;
      var pagar = yta.getAnimations ? yta.getAnimations({ subtree: true }).some(function (a) {
        var m = a.effect && a.effect.target, t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        return a.playState === 'running' && m && m.matches && m.matches(IN_SEL) && t && t.iterations !== Infinity;
      }) : false;
      if (pagar) stillaSnart.t = setTimeout(kolla, 250); else yta.classList.remove('vy--in');
    };
    stillaSnart.t = setTimeout(kolla, 900);
  }
  // Omritning på plats: alla nya entréanimationer hoppar direkt till slutläget, så att bara det som
  // faktiskt ändrats rör sig (IH.lysUpp, aff--ny och liknande sätts efteråt och spelas som vanligt).
  var BEHALL = /(bytt|lys|ny|vann|puls|andas|snurr|blink|vag)/;
  function stillaNu(yta) {
    if (!yta.getAnimations || !window.CSSAnimation) return;
    yta.getAnimations({ subtree: true }).forEach(function (a) {
      if (!(a instanceof CSSAnimation) || BEHALL.test(a.animationName || '')) return;
      var t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (!t || t.iterations === Infinity || t.endTime === Infinity) return;
      try { a.finish(); } catch (e) { /* */ }
    });
  }
  function rita() {
    var adr = lasAdress();
    var vyfn = IH.vyer[adr.vy] || IH.vyer.oversikt;
    if (!IH.vyer[adr.vy]) { adr.vy = 'oversikt'; if (location.hash && location.hash !== '#/' && location.hash !== '#') history.replaceState(null, '', '#/'); }
    IH.nuvarande = adr;
    var sparr = IH.sparrad(adr.vy);
    if (adr.del[0] && !sparr && /^(kunder|salj|forfragningar|offerter)$/.test(adr.vy)) minnsSenaste('#/' + adr.vy + '/' + adr.del[0]);
    var yta = $('#vy');
    if (!yta) return;
    if (sparr) vyfn = sparrVy;
    else if (TRE_VY[adr.vy] && !adr.del[0]) importera3d(TRE_VY[adr.vy]);
    // Vyerna kan läsa om det här är ett byte eller en omritning på plats
    // (då ska t.ex. husen inte resa sig igen).
    var nyckel = adr.vy + '/' + adr.del.join('/'), forraDel = forraVy === null ? null : forraVy.split('/'), ut;
    // Samma vy med ny del (t.ex. en annan förfrågan i inkorgen) byter bara innehåll. Listorna med egna
    // detaljsidor (kund, affär, offert, projekt) räknar lista -> detalj och tillbaka som ett sidbyte.
    var bytt = forraDel === null || forraDel[0] !== adr.vy || (DETALJ_VY.test(adr.vy) && (forraDel[1] || '') !== (adr.del[0] || ''));
    var vyByte = bytt;
    var rullaTill = 0;
    if (bytt && forraVy !== null) {
      rullMinne[forraVy] = window.scrollY;
      // tillbaka från en detaljsida till samma lista: samma ställe i listan
      if (forraDel[0] === adr.vy && forraDel[1] && !adr.del[0]) rullaTill = rullMinne[nyckel] || 0;
    }
    var gor = function () {
      // Vyn byggs här, så att ett sidbyte först hinner visa klicket i menyn
      IH.vyByte = vyByte;
      ut = vyfn(adr.del);
      yta.innerHTML = ut.html;
      document.title = (ut.titel ? ut.titel + ' · ' : '') + 'Legohus CRM';
      var tt = document.querySelector('[data-topp-titel]'); if (tt) tt.textContent = ut.titel || '';
      if (bytt) {
        yta.classList.remove('vy--in');
        void yta.offsetWidth;
        yta.classList.add('vy--in');
        window.scrollTo(0, rullaTill);
        stillaSnart(yta);
      }
      tillbakaRatt(yta, ut.titel);
      forraVy = nyckel;
      if (!gor.markerad) markera(false);
      delaRubriker(yta);
      IH.efterRitning(yta);
      if (!bytt) stillaNu(yta);
      if (ut.efter) ut.efter(yta);
    };
    if (bytt && forraVy !== null && !lugn && document.startViewTransition) {
      // Menyn markerar den nya sidan direkt (klicket känns levande), sedan byts vyn i nästa bildruta.
      markera(false);
      gor.markerad = true;
      var vantar = ++rita.n;
      requestAnimationFrame(function () {
        if (vantar !== rita.n) return;
        var vt = document.startViewTransition(gor);
        // Ett snabbt nytt klick hoppar över övergången – det är inget fel.
        if (vt) ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); });
      });
    } else { rita.n++; gor(); }
  }

  // Sidan som visas i stället för en spärrad sida: administratören får gå in i ett säljkonto (supportläget) och hamna på samma adress
  function sparrVy() {
    var jag = IH.jag(), adr = location.hash || '#/', namn = (SIDOR.filter(function (x) { return x[0] === IH.nuvarande.vy; })[0] || [0, 'Sidan'])[1];
    if (jag.roll === 'admin') {
      var konton = IH.ANVANDARE.filter(function (u) { return u.roll !== 'admin' && !u.inaktiv && (IH.nuvarande.vy !== 'chef' || u.chef); });
      return { titel: namn, html: '<a class="tillbaka" href="#/">' + IH.i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + IH.emo('las') + namn + ' öppnas i supportläget</h2>' +
        '<p class="ad-not">Administratören skapar och ändrar inte säljarnas och produktionens poster direkt. Välj ett konto nedan – då öppnas samma sida som den personen ser, i supportläget, och allt du gör loggas.</p>' +
        '<div class="ad-knappar">' + konton.map(function (u) { return '<button class="knapp" type="button" data-g="visa-som" data-id="' + u.id + '" data-mal="' + IH.e(adr) + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span>Öppna som ' + IH.e(u.namn) + '</button>'; }).join('') + '</div></section>' };
    }
    return { titel: namn, html: '<a class="tillbaka" href="#/produktion">' + IH.i('pilv') + 'Projekt</a><section class="kort ad-band"><h2>' + IH.emo('las') + namn + ' är för säljarna</h2>' +
      '<p class="ad-not">Produktionen arbetar med projekten, kunderna och offerterna. Förfrågningar, säljtavlan och kundmötet sköts av säljarna.</p></section>' };
  }

  // Sidrubrikerna stiger ord för ord ur en mask.
  function delaRubriker(rot) {
    $$('.vyhuvud h1', rot).forEach(function (h) {
      if (h.querySelector('.ord')) return;
      var text = h.textContent.trim();
      h.setAttribute('aria-label', text);
      h.innerHTML = text.split(/\s+/).map(function (ord, n) {
        return '<span class="ord" aria-hidden="true"><span style="--o:' + n + '">' + IH.e(ord) + '</span></span>';
      }).join(' ');
    });
  }
  rita.n = 0;
  IH.rita = rita;
  IH.ritaOm = function () {
    IH.uppdateraMeny();
    rita();
  };

  // Gemensamt efter varje ritning: entréer, räkneverk och lutning.
  IH.efterRitning = function (rot) {
    var minimal = !!(IH.layout && IH.layout() === 'minimal');
    // Ändlösa animationer i stora block pausas när blocket inte syns (Projekt, Dokument, Profil, Kundmöte)
    if (IH.pausaUtanfor) $$('.prodblock--fabrik, .kal, .nedrakning, .dk-hjalte, .lp-phjalte, .motescen, .lp-chefhjalte', rot).forEach(IH.pausaUtanfor);
    $$('[data-in]', rot).forEach(function (el, n) { el.style.setProperty('--in', Math.min(n, 10)); });
    $$('[data-stagger]', rot).forEach(function (c) {
      Array.prototype.forEach.call(c.children, function (ch, k) { ch.style.setProperty('--k', Math.min(k, 14)); });
    });
    $$('[data-rakna]', rot).forEach(function (el) {
      var mal = Number(el.getAttribute('data-rakna'));
      var format = el.getAttribute('data-format') || 'tal';
      var skriv = function (v) {
        el.textContent = format === 'kort' ? IH.kort(v) : format === 'kr' ? IH.kr(v) : Math.round(v).toString();
      };
      // Minimal är lugnt: inga räkneverk
      if (lugn || !mal || IH.vyByte === false || minimal) { skriv(mal); return; }
      // Kort räkning från 70 % av målet – klar ungefär när sidan har landat, och siffrorna ser aldrig fel ut länge
      var start = performance.now();
      (function steg(nu) {
        var t = Math.min(1, (nu - start) / 700);
        skriv(mal * (0.7 + 0.3 * (1 - Math.pow(1 - t, 4))));
        if (t < 1) requestAnimationFrame(steg);
      })(start);
    });
    // Lutningen efter musen är avstängd (2026-10-29) – korten står still
    if (false) {
      $$('[data-tilt]', rot).forEach(function (k) {
        // Rektangeln mäts en gång när pekaren kommer in (den lutade rutan ändras annars och skakar vid kanterna),
        // och värdena skrivs en gång per bildruta
        var r = null, sist = null, ram = 0;
        k.addEventListener('pointerenter', function () { r = k.getBoundingClientRect(); });
        k.addEventListener('pointermove', function (e) {
          if (!r) r = k.getBoundingClientRect();
          sist = e;
          if (ram) return;
          ram = requestAnimationFrame(function () {
            ram = 0;
            if (!r || !sist) return;
            var x = (sist.clientX - r.left) / r.width - 0.5;
            var y = (sist.clientY - r.top) / r.height - 0.5;
            k.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
            k.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
            k.style.setProperty('--mx', (sist.clientX - r.left) + 'px');
            k.style.setProperty('--my', (sist.clientY - r.top) + 'px');
          });
        });
        k.addEventListener('pointerleave', function () {
          r = null; sist = null;
          k.style.setProperty('--rx', '0deg');
          k.style.setProperty('--ry', '0deg');
        });
      });
    }
  };

  /* --- Sök ------------------------------------------------------------ */
  function sok(q) {
    q = q.trim().toLowerCase();
    var ut = { kunder: [], forfragningar: [], affarer: [] };
    if (q.length < 2) return ut;
    var db = IH.db;
    ut.kunder = db.kunder.filter(function (k) { return (k.namn + ' ' + k.ort + ' ' + k.epost + ' ' + k.telefon).toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
    ut.forfragningar = db.forfragningar.filter(function (f) { return (f.namn + ' ' + f.ort + ' ' + f.beskrivning + ' ' + f.hustyp).toLowerCase().indexOf(q) >= 0; }).slice(0, 4);
    ut.affarer = db.affarer.filter(function (a) {
      var k = IH.kund(a.kund);
      return (a.titel + ' ' + (k ? k.namn : '')).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 4);
    return ut;
  }
  /* --- Kommandopaletten (Ctrl/⌘ K) ------------------------------------ */
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  // Sidorna med sökord, så att t.ex. "prislista" hittar Inställningar och "montage" Projekt
  var SIDOR = [['oversikt', 'Översikt', 'hem', 'start hem i dag'], ['forfragningar', 'Förfrågningar', 'inkorg', 'inkorg leads nya'], ['salj', 'Säljtavla', 'tavla', 'tavla pipeline affärer steg'],
    ['kunder', 'Kunder', 'kunder', 'kundlista kontakter'], ['offerter', 'Offerter', 'offert', 'offert anbud'], ['dokument', 'Dokument', 'mapp', 'filer underlag ritningar arkiv'], ['mote', 'Kundmöte', 'mote', 'presentation möte'],
    ['produktion', 'Projekt', 'produktion', 'produktion montage bygge checklista'], ['kolla-marken', 'Kolla marken', 'grodd', 'tomt mark karta detaljplan'], ['att-gora', 'Att göra', 'todo', 'uppgifter todo'],
    ['chatt', 'Meddelanden', 'meddelande', 'chatt meddelande'], ['profil', 'Min profil', 'anstallda', 'profil konto status'], ['chef', 'Försäljningsledning', 'graf', 'försäljning mål team frånvaro'],
    ['installningar', 'Inställningar', 'installning', 'prislista priser pris tillval'], ['kontroll', 'Kontrollcentral', 'matare', 'hälsa systemhälsa'], ['admin', 'Adminpanel', 'nyckelverktyg', 'konton roller behörigheter import export logg'], ['sakerhet', 'Säkerhet', 'skold', 'säkerhetshubben skanning']];
  var ADMIN_SIDOR = ['oversikt', 'kontroll', 'admin', 'sakerhet', 'chatt', 'att-gora', 'profil', 'installningar'];
  var sidaFor = function (x) { var j = IH.jag(); if (j.roll === 'admin') return ADMIN_SIDOR.indexOf(x[0]) >= 0; if (/^(kontroll|admin|sakerhet)$/.test(x[0]) || IH.sparrad(x[0])) return false; return x[0] !== 'chef' || j.chef; };
  // Kommandon i paletten: [G-namn, rubrik, ikon, förklaring, sökord, bara för admin]
  var KOMMANDON = [['logga-ut', 'Logga ut', 'utloggning', 'Till inloggningen', 'logga ut avsluta'], ['byt-anvandare', 'Byt användare', 'aterstall', 'Exempelkontona', 'byt konto användare'],
    ['vaxla-sido', 'Dölj eller visa menyn', 'meny', 'Kortkommando [', 'meny dölj visa fäll'], ['konto-meny', 'Ändra status', 'trend', 'Kontomenyn', 'status närvaro lunch möte'],
    ['hjalp', 'Kortkommandon', 'nyckel', 'Alla tangenter i CRM:et', 'hjälp kortkommandon tangenter'],
    ['ad-exportera', 'Exportera data', 'skrivut', 'JSON-fil', 'export säkerhetskopia', true], ['sh-skanna-ga', 'Skanna säkerheten', 'radar', 'Alla sju kontroller', 'skanna säkerhet', true],
    ['km-nytt-konto', 'Nytt konto', 'kunder', 'Lägg till en användare', 'konto användare lägg till', true]];
  var ATGARDER = [['ny-kund', 'Ny kund', 'kunder', 'Privatperson eller företag'], ['ny-affar', 'Ny affär', 'tavla', 'Direkt på säljtavlan'],
    ['ny-forfragan', 'Ny förfrågan', 'inkorg', 'Någon ringde eller mejlade'], ['ny-uppgift', 'Ny uppgift', 'todo', 'Något att göra'],
    ['offert-ny', 'Ny offert', 'offert', 'Välj affär och skapa offerten'], ['vm-nytt', 'Nytt videomöte', 'kamera', 'Boka en tid eller starta direkt'],
    ['starta-mote', 'Starta kundmöte', 'mote', 'Presentationen i helskärm']];
  // Snabbåtgärder som finns (en modul som inte laddats visas inte) och som rollen får använda
  function atgarder(jag) {
    return ATGARDER.filter(function (x) { return IH.G[x[0]] && jag.roll !== 'admin' && !(jag.roll === 'prod' && /affar|forfragan|starta-mote/.test(x[0])); });
  }
  var palett = null;

  // De senast öppnade kunderna, affärerna, förfrågningarna och offerterna.
  function senaste() {
    try { return JSON.parse(localStorage.getItem('ih-crm-senaste') || '[]'); } catch (e) { return []; }
  }
  function minnsSenaste(adr) {
    var l = senaste().filter(function (x) { return x !== adr; });
    l.unshift(adr);
    try { localStorage.setItem('ih-crm-senaste', JSON.stringify(l.slice(0, 8))); } catch (e) { /* privat läge */ }
  }
  // En rad i paletten för en adress som #/kunder/k1.
  function senasteRad(adr) {
    var d = adr.replace(/^#\//, '').split('/');
    var id = d[1];
    if (d[0] === 'kunder') { var k = IH.kund(id); return k && rad('ga:' + adr, '<span class="avatar avatar--liten">' + IH.initialer(k.namn) + '</span>', k.namn, k.ort, 'Kund'); }
    if (d[0] === 'salj') { var a = IH.affar(id); var ak = a && IH.kund(a.kund); return a && rad('ga:' + adr, IH.i('tavla'), a.titel, (ak ? ak.namn + ' · ' : '') + IH.kort(a.varde), 'Affär'); }
    if (d[0] === 'forfragningar') { var f = IH.forfragan(id); return f && rad('ga:' + adr, IH.i('inkorg'), f.namn, f.hustyp + ' · ' + f.ort, 'Förfrågan'); }
    if (d[0] === 'offerter') { var o = IH.offert(id); var oa = o && IH.affar(o.affar); var ok = oa && IH.kund(oa.kund); return o && rad('ga:' + adr, IH.i('offert'), o.nummer, ok ? ok.namn : '', 'Offert'); }
    return '';
  }
  function rad(mal, ikon, rubrik, under, typ, id) {
    return '<button type="button" class="palett__rad" role="option" data-g="palett-val" data-mal="' + IH.e(mal) + '"' + (id ? ' data-id="' + IH.e(id) + '"' : '') + '>' +
      '<span class="palett__ikon">' + ikon + '</span><span class="palett__text"><b>' + IH.e(rubrik) + '</b>' + (under ? '<small>' + IH.e(under) + '</small>' : '') + '</span>' +
      (typ ? '<span class="palett__typ">' + typ + '</span>' : '') + '</button>';
  }
  // Ett tema i paletten ("Tema: Mörk"): färgprovet som ikon, bock på det valda
  function temaRad(t) {
    var val = IH.tema.val(), vald = val === t.id;
    return '<button type="button" class="palett__rad" role="option" data-g="palett-val" data-mal="g:tema-val" data-tema-id="' + t.id + '">' +
      '<span class="palett__ikon">' + (IH.tema.ruta || IH.tema.prick)(t.id) + '</span><span class="palett__text"><b>Tema: ' + IH.e(t.namn) + '</b><small>' + IH.e(t.kort) + '</small></span>' +
      '<span class="palett__typ">' + (vald ? 'Valt' : 'Tema') + '</span></button>';
  }
  // Ett layoutläge i paletten ("Layout: Minimal"): liten miniatyr som ikon, "Valt" på det aktiva
  function layoutRad(l) {
    var vald = IH.layout() === l.id;
    return '<button type="button" class="palett__rad" role="option" data-g="palett-val" data-mal="g:layout-val" data-layout-id="' + l.id + '">' +
      '<span class="palett__ikon">' + IH.layout.ikon(l.id) + '</span><span class="palett__text"><b>Layout: ' + IH.e(l.namn) + '</b><small>' + IH.e(l.kort) + '</small></span>' +
      '<span class="palett__typ">' + (vald ? 'Valt' : 'Layout') + '</span></button>';
  }
  function grupp(namn, rader) {
    return rader.length ? '<p class="palett__grupp">' + namn + '</p>' + rader.join('') : '';
  }
  // Träff: texten innehåller söksträngen, eller (från tre tecken) alla
  // dess tecken i rätt ordning – "sgb" hittar Skärgårdsbyn. Den lösa
  // träffen måste börja på ett ord och hålla ihop, annars blir det brus.
  function traff(text, q, namn) {
    text = (text || '').toLowerCase();
    if (text.indexOf(q) >= 0) return true;
    namn = (namn || '').toLowerCase();
    if (q.length < 3 || !namn) return false;
    for (var s = 0; s < namn.length; s++) {
      if (namn[s] !== q[0] || (s && /[a-zåäö0-9]/.test(namn[s - 1]))) continue;
      var p = 1, n = s + 1;
      for (; n < namn.length && p < q.length; n++) if (namn[n] === q[p]) p++;
      if (p === q.length && n - s <= q.length * 3 + 1) return true;
    }
    return false;
  }

  function palettInnehall(q) {
    q = q.trim().toLowerCase();
    var html = '';
    if (!q) {
      html += grupp('Senaste', senaste().filter(function (x) { return x !== location.hash; }).map(senasteRad).filter(Boolean).slice(0, 5));
      if (IH.jag().roll === 'salj') html += grupp('Snabbåtgärder', atgarder(IH.jag()).map(function (x) { return rad('g:' + x[0], IH.i(x[2]), x[1], x[3]); }));
      html += grupp('Gå till', SIDOR.filter(function (x) { return x[0] !== IH.nuvarande.vy && sidaFor(x); }).map(function (x) { return rad('ga:#/' + x[0], IH.i(x[2]), x[1]); }));
    } else {
      var db = IH.db, jag = IH.jag(), far = function (vy) { return !IH.sparrad(vy); };
      var kunder = !far('kunder') ? [] : db.kunder.filter(function (k) { return traff(k.namn + ' ' + k.ort + ' ' + k.epost + ' ' + k.telefon, q, k.namn); }).slice(0, 5);
      var affarer = !far('salj') ? [] : db.affarer.filter(function (a) { var k = IH.kund(a.kund); return traff(a.titel + ' ' + (k ? k.namn : ''), q, a.titel + ' ' + (k ? k.namn : '')); }).slice(0, 4);
      var forfragningar = !far('forfragningar') ? [] : db.forfragningar.filter(function (f) { return traff(f.namn + ' ' + f.ort + ' ' + f.hustyp, q, f.namn); }).slice(0, 4);
      var offerter = !far('offerter') ? [] : db.offerter.filter(function (o) {
        if (o.status === 'ersatt') return false;
        var a = IH.affar(o.affar), k = a && IH.kund(a.kund);
        return traff(o.nummer + ' ' + (k ? k.namn : ''), q, k ? k.namn : '');
      }).slice(0, 4);
      var projNamn = function (p) { var k = IH.kund(p.kund), m = IH.modell ? IH.modell(p.modell) : null; return (k ? k.namn : 'Projekt') + (m && m.namn ? ' · ' + m.namn : ''); };
      var projekt = !far('produktion') ? [] : (db.projekt || []).filter(function (p) { var k = IH.kund(p.kund); return traff(projNamn(p) + ' ' + (k ? k.ort : ''), q, projNamn(p)); }).slice(0, 4);
      var uppgifter = (db.uppgifter || []).filter(function (u) { return !u.klar && (!u.ansvarig || u.ansvarig === jag.id) && traff(u.text, q, u.text); }).slice(0, 4);
      var konton = IH.ANVANDARE.filter(function (u) { return !u.inaktiv && traff(u.namn + ' ' + u.titel, q, u.namn); }).slice(0, 4);
      // Dokumenten (med kundens namn) och anteckningarna och aktiviteterna i kundernas historik, nyast först
      var dokument = !far('dokument') ? [] : (db.dokument || []).filter(function (d) { var k = d && d.kund && IH.kund(d.kund); return d && d.namn && d.sparad !== false && traff(d.namn + ' ' + (k ? k.namn : ''), q, d.namn); })
        .sort(function (a, b) { return (a.tid || '') < (b.tid || '') ? 1 : -1; }).slice(0, 4);
      var aktiviteter = !far('kunder') || q.length < 2 ? [] : (db.aktiviteter || []).filter(function (a) { return a && a.kund && a.text && IH.kund(a.kund) && String(a.text).toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return a.tid < b.tid ? 1 : -1; }).slice(0, 4);
      var AKT_IKON = { samtal: 'tel', mejl: 'post', mote: 'mote', anteckning: 'anteckning', sms: 'meddelande' };
      var kommandon = KOMMANDON.filter(function (x) { return (!x[5] || jag.roll === 'admin') && (x[1] + ' ' + x[4]).toLowerCase().indexOf(q) >= 0; });
      html += grupp('Kunder', kunder.map(function (k) { return rad('ga:#/kunder/' + k.id, '<span class="avatar avatar--liten">' + IH.initialer(k.namn) + '</span>', k.namn, k.ort, 'Kund'); }));
      html += grupp('Affärer', affarer.map(function (a) { var k = IH.kund(a.kund); return rad('ga:#/salj/' + a.id, IH.i('tavla'), a.titel, (k ? k.namn + ' · ' : '') + IH.kort(a.varde), 'Affär'); }));
      html += grupp('Förfrågningar', forfragningar.map(function (f) { return rad('ga:#/forfragningar/' + f.id, IH.i('inkorg'), f.namn, f.hustyp + ' · ' + f.ort, 'Förfrågan'); }));
      html += grupp('Offerter', offerter.map(function (o) { var a = IH.affar(o.affar), k = a && IH.kund(a.kund); return rad('ga:#/offerter/' + o.id, IH.i('offert'), o.nummer, k ? k.namn : '', 'Offert'); }));
      html += grupp('Projekt', projekt.map(function (p) { return rad('ga:#/produktion/' + p.id, IH.i('produktion'), projNamn(p), p.montage ? 'Montage ' + IH.datum(p.montage) : '', 'Projekt'); }));
      html += grupp('Uppgifter', uppgifter.map(function (u) { return rad('ga:#/att-gora', IH.i('todo'), u.text, u.forfaller ? 'Förfaller ' + IH.datum(u.forfaller) : '', 'Uppgift'); }));
      html += grupp('Dokument', dokument.map(function (d) { var k = d.kund && IH.kund(d.kund); return rad('g:dok-fil', IH.i('mapp'), d.namn, (k ? k.namn + ' · ' : '') + (d.tid ? IH.datum(d.tid, true) : ''), 'Dokument', d.id); }));
      html += grupp('Anteckningar och aktiviteter', aktiviteter.map(function (a) {
        var k = IH.kund(a.kund), t = String(a.text);
        return rad('ga:#/kunder/' + a.kund, IH.i(AKT_IKON[a.typ] || 'anteckning'), t.length > 90 ? t.slice(0, 88) + '…' : t, k.namn + ' · ' + IH.datum(a.tid, new Date(a.tid).getFullYear() !== new Date().getFullYear()), 'Historik');
      }));
      // Grupper som andra moduler lagt till (t.ex. Chatt via IH.sok.lagg)
      SOK_GRUPPER.forEach(function (g) {
        if (g.vy && IH.sparrad(g.vy)) return;
        var rader = [];
        try { rader = g.fn(q) || []; } catch (e) { rader = []; }
        html += grupp(IH.e(g.namn), rader.filter(function (r) { return r && r.rubrik && /^(ga:#\/|g:)/.test(String(r.mal || '')); }).slice(0, 5).map(function (r) {
          return rad(r.mal, r.ikon || IH.i('sok'), r.rubrik, r.under || '', r.typ || '', r.id);
        }));
      });
      html += grupp('Konton', konton.map(function (u) { return rad('ga:#/profil/' + u.id, '<span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span>', u.namn, u.titel, 'Konto'); }));
      html += grupp('Snabbåtgärder', atgarder(jag).filter(function (x) { return traff(x[1] + ' ' + x[3], q, x[1]); }).map(function (x) { return rad('g:' + x[0], IH.i(x[2]), x[1], x[3]); }));
      var teman = !IH.tema || !IH.tema.lista || q.length < 2 ? [] : IH.tema.lista.filter(function (t) { var txt = ('tema ' + t.namn + ' ' + t.sok + ' utseende färg färger').toLowerCase(); return q.replace(/:/g, ' ').split(/\s+/).filter(Boolean).every(function (w) { return txt.indexOf(w) >= 0; }); });
      html += grupp('Tema', teman.map(temaRad));
      var lagen = !IH.layout || !IH.layout.lista || q.length < 2 ? [] : IH.layout.lista.filter(function (l) { var txt = ('layout läge lägen täthet ' + l.namn + ' ' + l.sok).toLowerCase(); return q.replace(/:/g, ' ').split(/\s+/).filter(Boolean).every(function (w) { return txt.indexOf(w) >= 0; }); });
      html += grupp('Layout', lagen.map(layoutRad));
      html += grupp('Kommandon', kommandon.map(function (x) { return rad('g:' + x[0], IH.i(x[2]), x[1], x[3]); }));
      html += grupp('Gå till', SIDOR.filter(function (x) { return sidaFor(x) && (x[1] + ' ' + x[3]).toLowerCase().indexOf(q) >= 0; }).map(function (x) { return rad('ga:#/' + x[0], IH.i(x[2]), x[1]); }));
      if (!html) html = '<p class="palett__tom">Inga träffar för ”' + IH.e(q) + '”. Prova ett kortare ord eller ett namn.</p>';
    }
    return html;
  }

  function palettRita(q) {
    var lista = palett.rot.querySelector('[data-palett-lista]');
    lista.innerHTML = palettInnehall(q);
    var rader = lista.querySelectorAll('.palett__rad');
    Array.prototype.forEach.call(rader, function (r, k) { r.style.setProperty('--k', Math.min(k, 16)); r.id = 'palett-rad-' + k; r.setAttribute('aria-selected', 'false'); });
    palettMarkera(rader[0] || null);
  }
  // Den valda raden: klassen vald plus aria-selected och aria-activedescendant, så att skärmläsaren hör pilvalet
  function palettMarkera(ny) {
    if (!palett) return;
    $$('.palett__rad.vald', palett.rot).forEach(function (x) { x.classList.remove('vald'); x.setAttribute('aria-selected', 'false'); });
    var inp = palett.rot.querySelector('input');
    if (ny) { ny.classList.add('vald'); ny.setAttribute('aria-selected', 'true'); inp.setAttribute('aria-activedescendant', ny.id); }
    else inp.removeAttribute('aria-activedescendant');
  }
  function palettVald() { return palett && palett.rot.querySelector('.palett__rad.vald'); }
  function palettFlytta(steg) {
    var rader = Array.prototype.slice.call(palett.rot.querySelectorAll('.palett__rad'));
    if (!rader.length) return;
    var n = rader.indexOf(palettVald());
    var ny = rader[(n + steg + rader.length) % rader.length];
    palettMarkera(ny);
    ny.scrollIntoView({ block: 'nearest' });
  }
  function palettKor(el) {
    var mal = el.getAttribute('data-mal') || '';
    IH.stangPalett(false, true);
    if (mal.indexOf('ga:') === 0) IH.ga(mal.slice(3));
    else if (mal.indexOf('g:') === 0 && IH.G[mal.slice(2)]) IH.G[mal.slice(2)](el);
  }

  IH.oppnaPalett = function () {
    if (palett) { palett.rot.querySelector('input').focus(); return; }
    // Ett ifyllt formulär stängs inte tyst – samma fråga som Esc
    if (arkAndrat() && !fragaKasta('Öppna sökningen igen för att stänga formuläret ändå.')) return;
    IH.stangArk(true);
    var slojan = document.createElement('div');
    slojan.className = 'slojan slojan--palett';
    var rot = document.createElement('div');
    rot.className = 'palett ny';
    rot.setAttribute('role', 'dialog');
    rot.setAttribute('aria-modal', 'true');
    rot.setAttribute('aria-label', 'Sök och kommandon');
    rot.innerHTML = '<label class="palett__sok">' + IH.i('sok') + '<input type="text" placeholder="Sök eller skriv ett kommando…" autocomplete="off" spellcheck="false" aria-label="Sök eller skriv ett kommando" role="combobox" aria-expanded="true" aria-controls="palett-lista" aria-autocomplete="list"><kbd>Esc</kbd>' +
      '<button class="palett__stang" type="button" aria-label="Stäng sökningen">' + IH.i('stang') + '</button></label>' +
      '<div class="palett__lista" id="palett-lista" role="listbox" aria-label="Träffar" data-palett-lista></div>' +
      '<footer class="palett__fot"><span><kbd>↑</kbd><kbd>↓</kbd>välj</span><span><kbd>↵</kbd>öppna</span><span><kbd>Esc</kbd>stäng</span><span class="palett__fot--hoger"><kbd>' + (MAC ? '⌘' : 'Ctrl') + '</kbd><kbd>K</kbd>öppna och stäng</span></footer>';
    document.body.appendChild(slojan);
    document.body.appendChild(rot);
    palett = { rot: rot, slojan: slojan, fokus: document.activeElement };
    bakgrundInert(true);
    document.documentElement.setAttribute('data-palett-oppen', '');
    rot.querySelector('.palett__stang').addEventListener('click', function (e) { e.preventDefault(); IH.stangPalett(); });
    palettRita('');
    var inp = rot.querySelector('input');
    inp.addEventListener('input', function () { rot.classList.remove('ny'); palettRita(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); palettFlytta(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palettFlytta(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); var v = palettVald(); if (v) palettKor(v); }
    });
    rot.addEventListener('mouseover', function (e) {
      var r = e.target.closest('.palett__rad');
      if (!r || r.classList.contains('vald')) return;
      palettMarkera(r);
    });
    slojan.addEventListener('click', function () { IH.stangPalett(); });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { slojan.classList.add('syns'); rot.classList.add('syns'); inp.focus(); });
    });
  };
  IH.stangPalett = function (direkt, utanFokus) {
    if (!palett) return;
    var p = palett;
    palett = null;
    document.documentElement.removeAttribute('data-palett-oppen');
    if (!aktivtArk) bakgrundInert(false);
    p.rot.classList.remove('syns');
    p.slojan.classList.remove('syns');
    var bort = function () { p.rot.remove(); p.slojan.remove(); };
    if (direkt || lugn) bort(); else setTimeout(bort, 260);
    if (!direkt && !utanFokus && p.fokus && p.fokus.isConnected && p.fokus.focus) p.fokus.focus({ preventScroll: true });
  };
  IH.G.palett = function () { IH.oppnaPalett(); };
  IH.G['palett-val'] = function (el) { palettKor(el); };

  /* --- Händelser ------------------------------------------------------ */
  function kopplaHandelser() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-g]');
      if (!el) return;
      var namn = el.getAttribute('data-g');
      // Spärren går före omslagen i andra filer (som annars loggar ett byte som aldrig sker)
      if (namn === 'valj-anvandare' && !IH.fartByta(el.getAttribute('data-id'))) {
        e.preventDefault();
        IH.toast('Bara administratören kan byta till det kontot', 'Logga ut och logga in som administratör.', 'las');
        return;
      }
      if (IH.G[namn]) {
        if (el.tagName === 'A' && namn !== 'lamna' && !(namn === 'stang-ark' && el.getAttribute('href'))) e.preventDefault();
        IH.G[namn](el, e);
      }
    });
    document.addEventListener('keydown', function (e) {
      // Den egna väljaren (valj.js) är en knapp med role=combobox – där skriver man för att välja, som i en select
      var inmatning = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable ||
        !!(e.target.closest && e.target.closest('[role=combobox], [role=listbox], .valj-knapp'));
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        if (moteOppet() && !palett) return;
        e.preventDefault();
        if (palett) IH.stangPalett(); else IH.oppnaPalett();
        return;
      }
      if (e.key === 'Escape') {
        if (palett) { IH.stangPalett(); return; }
        if (aktivtArk) { if (!arkAndrat() || fragaKasta('Tryck Esc igen för att stänga ändå.')) IH.stangArk(); return; }
      }
      if (inmatning || e.metaKey || e.ctrlKey || e.altKey || moteOppet()) return;
      // Listornas tangenter (J/K, pilarna, Enter, X) går före allt annat, även i en panel
      if (radTangent(e)) return;
      // G och sedan en bokstav hoppar direkt till en sida (G Ö översikt, G I förfrågningar, G T tavlan …)
      if (gVantar && Date.now() - gVantar < 1200) {
        gVantar = 0;
        var mal = G_SIDOR[e.key.toLowerCase()];
        if (mal && !IH.sparrad(mal)) {
          e.preventDefault();
          if (arkAndrat()) { IH.toast('Du har ett formulär som inte är sparat', 'Spara eller stäng det först (tryck Esc två gånger).', 'varning'); return; }
          IH.ga('#/' + mal); return;
        }
      }
      if ((e.key === 'g' || e.key === 'G') && !e.shiftKey) { gVantar = Date.now(); return; }
      if (e.key === '/') { e.preventDefault(); IH.oppnaPalett(); }
      if (e.key === '?') {
        e.preventDefault();
        if (arkAndrat()) { IH.toast('Du har ett formulär som inte är sparat', 'Spara eller stäng det först (tryck Esc två gånger).', 'varning'); return; }
        IH.G.hjalp();
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (arkAndrat()) { IH.toast('Du har ett formulär som inte är sparat', 'Spara eller stäng det först (tryck Esc två gånger).', 'varning'); return; }
        IH.G.ny();
      }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-form]');
      if (!f) return;
      e.preventDefault();
      var namn = f.getAttribute('data-form');
      if (IH.FORM && IH.FORM[namn]) IH.FORM[namn](f, new FormData(f));
    });
    window.addEventListener('hashchange', function () {
      IH.stangArk(false, true);
      IH.stangPalett(false, true);
      rita();
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && !inloggad()) location.replace('logga-in.html');
    });
  }

  var gVantar = 0;
  var G_SIDOR = { 'ö': 'oversikt', o: 'offerter', i: 'forfragningar', t: 'salj', k: 'kunder', a: 'att-gora', p: 'produktion', m: 'chatt' };
  // Kundmötets presentation tar tangenterna själv
  function moteOppet() { return !!document.querySelector('.mote:not(.stanger), .mote-presentation, [data-mote-oppen]'); }
  // Har något fält i den öppna panelen ändrats? Då frågar Esc, N och klick utanför först.
  function arkAndrat() {
    if (!aktivtArk) return false;
    return $$('input, textarea, select', aktivtArk.ark).some(function (f) {
      if (f.disabled || /^(hidden|file|search|button|submit)$/.test(f.type)) return false;
      if (f.type === 'checkbox' || f.type === 'radio') return f.checked !== f.defaultChecked;
      if (f.tagName === 'SELECT') { var std = 0; Array.prototype.forEach.call(f.options, function (o, n) { if (o.defaultSelected) std = n; }); return !f.multiple && f.selectedIndex !== std; }
      return f.value !== f.defaultValue;
    });
  }
  IH.arkAndrat = arkAndrat;
  var kastaTid = 0;
  function fragaKasta(hur) {
    if (Date.now() - kastaTid < 4000) { kastaTid = 0; return true; }
    kastaTid = Date.now();
    IH.toast('Det du skrivit sparas inte', hur, 'varning');
    return false;
  }

  function inloggad() {
    try { return !!localStorage.getItem('ih-crm-inloggad'); } catch (e) { return false; }
  }

  /* --- Gemensamma åtgärder --------------------------------------------- */
  IH.G['stang-ark'] = function () { IH.stangArk(); };
  IH.G['logga-ut'] = function () {
    try { localStorage.removeItem('ih-crm-inloggad'); localStorage.removeItem('ih-crm-visa-som'); } catch (e) { /* */ }
    lamna('logga-in.html');
  };
  IH.G.lamna = function (el, e) {
    e.preventDefault();
    lamna(el.getAttribute('href'));
  };
  function lamna(url) {
    document.documentElement.setAttribute('data-lamnar', '');
    setTimeout(function () { location.href = url; }, lugn ? 0 : 380);
  }
  IH.G['byt-anvandare'] = function () {
    var jag = IH.jag();
    IH.oppnaArk({
      titel: 'Byt användare', under: 'Exempelanvändare i prototypen.', ikon: 'kunder',
      kropp: '<div class="lista kort">' + IH.ANVANDARE.filter(function (u) { return !u.inaktiv && IH.fartByta(u.id); }).map(function (u) {
        return '<button class="lista__rad" type="button" data-g="valj-anvandare" data-id="' + u.id + '"><span class="avatar" style="--av:' + IH.e(u.farg) + '">' +
          IH.initialer(u.namn) + '</span><span class="lista__text"><b>' + IH.e(u.namn) + '</b><small>' + IH.e(u.titel) + '</small></span>' +
          (u.id === jag.id ? '<span class="status" style="--s:#7fe0a6">Inloggad</span>' : IH.i('pil')) + '</button>';
      }).join('') + '</div>'
    });
  };
  // Bara administratören får byta till administratörskontot, och okända konton godtas inte
  IH.fartByta = function (id) {
    var mal = IH.anvandare(id);
    return !!mal && (mal.roll !== 'admin' || IH.riktigJag().roll === 'admin');
  };
  IH.G['valj-anvandare'] = function (el) {
    if (!IH.fartByta(el.getAttribute('data-id'))) return;
    try { localStorage.setItem('ih-crm-jag', el.getAttribute('data-id')); } catch (e) { /* */ }
    if (IH.tema && IH.tema.lasOm) IH.tema.lasOm(); // varje konto har sitt eget tema
    if (IH.layout && IH.layout.lasOm) IH.layout.lasOm({ direkt: true }); // … och sin egen layout
    IH.stangArk();
    var u = IH.jag();
    IH.uppdateraMeny();
    IH.ga(u.roll === 'prod' ? '#/produktion' : '#/');
    IH.toast('Inloggad som ' + u.namn, u.titel, 'kunder');
  };
  IH.G['sido-mer'] = function () {
    var nav = $('.sido__nav');
    if (nav) nav.scrollBy({ top: nav.clientHeight * 0.7, behavior: 'smooth' });
  };
  IH.G.mer = function () {
    var jag = IH.jag(), i = IH.i, b = brickor(), vy = IH.nuvarande.vy;
    // Det som redan står i bottenmenyn visas inte en gång till. Rutorna grupperas som i sidomenyn.
    var mitt = ['Mitt', [['chatt', 'Meddelanden', 'meddelande'], ['att-gora', 'Att göra', 'todo'], ['installningar', 'Inställningar', 'installning'], ['profil', 'Min profil', 'anstallda']]];
    var grupper = jag.roll === 'admin' ? [mitt]
      : jag.roll === 'prod' ? [['Kunder', [['dokument', 'Dokument', 'mapp']]], ['Verktyg', [['kolla-marken', 'Kolla marken', 'grodd']]], mitt]
      : [['Sälj', [['offerter', 'Offerter', 'offert'], ['dokument', 'Dokument', 'mapp'], ['mote', 'Kundmöte', 'mote']].concat(jag.chef ? [['chef', 'Försäljningsledning', 'graf']] : [])],
        ['Produktion', [['produktion', 'Projekt', 'produktion'], ['kolla-marken', 'Kolla marken', 'grodd']]], mitt];
    var ruta = function (p) {
      var br = b[p[0]];
      return '<a class="mer-ruta' + (p[0] === vy ? ' aktiv' : '') + '" href="#/' + p[0] + '"' + (p[0] === vy ? ' aria-current="page"' : '') + '><span class="mer-ruta__ikon">' + i(p[2]) + '</span><span class="mer-ruta__namn">' + p[1] + '</span>' +
        (br && br[1] && br[0] ? '<em class="mer-ruta__bricka">' + br[0] + '</em>' : '') + '</a>';
    };
    var team = jag.roll === 'admin' ? IH.ANVANDARE.filter(function (u) { return u.roll !== 'admin' && !u.inaktiv; }) : [];
    var status = IH.narvaro ? IH.narvaro(jag.id).namn : '';
    IH.oppnaArk({
      titel: 'Mer', ikon: 'meny',
      kropp: '<button class="mer-konto" type="button" data-g="konto-meny"><span class="avatar" style="--av:' + jag.farg + '">' + IH.initialer(jag.namn) + (IH.narvaroPrick ? IH.narvaroPrick(jag.id) : '') + '</span>' +
        '<span class="mer-konto__text"><b>' + IH.e(jag.namn) + '</b><small>' + IH.e((status ? status + ' · ' : '') + String(jag.titel || '').split(' · ')[0]) + '</small></span><span class="mer-konto__byt">Ändra status' + i('chevron') + '</span></button>' +
        grupper.map(function (g) { return '<p class="etikett mer-etikett">' + g[0] + '</p><div class="mer-rutnat" style="--n:' + (g[1].length === 4 ? 2 : Math.min(3, g[1].length)) + '">' + g[1].map(ruta).join('') + '</div>'; }).join('') +
        (team.length ? '<p class="etikett mer-etikett">Teamet · supportläget</p><div class="lista kort">' + team.map(function (u) {
          return '<button class="lista__rad" type="button" data-g="visa-som" data-id="' + u.id + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><span class="lista__text"><b>' + IH.e(u.namn) + '</b><small>Visa som</small></span>' + i('pil') + '</button>';
        }).join('') + '</div>' : '') +
        '<div class="mer-fot"><a href="../index.html" data-g="lamna">' + i('hus') + 'Hemsidan</a>' +
        '<button type="button" data-g="byt-anvandare">' + i('aterstall') + 'Byt användare</button>' +
        '<button type="button" data-g="logga-ut">' + i('utloggning') + 'Logga ut</button></div>'
    });
  };
  // Kortkommandona (? eller paletten)
  IH.G.hjalp = function () {
    var tangent = function (k, text) { return '<div class="lista__rad"><span class="lista__text"><b>' + text + '</b></span><kbd>' + k + '</kbd></div>'; };
    var admin = IH.riktigJag().roll === 'admin';
    IH.oppnaArk({ titel: 'Kortkommandon', ikon: 'nyckel', under: 'Fungerar när du inte skriver i ett fält.',
      kropp: '<div class="lista kort">' + tangent((MAC ? '⌘' : 'Ctrl') + ' K', 'Sök eller kör ett kommando') + tangent('/', 'Sök') +
        (IH.jag().roll === 'admin' ? '' : tangent('N', 'Skapa ny')) + tangent('Esc', 'Stäng panelen (tryck två gånger om du har skrivit något)') +
        tangent('[', 'Dölj eller visa menyn (dator)') +
        (IH.jag().roll === 'admin' ? '' : tangent('G Ö · G I · G T', 'Gå till översikten, förfrågningarna eller säljtavlan') + tangent('G K · G O · G A', 'Gå till kunderna, offerterna eller Att göra') + tangent('G P · G M', 'Gå till projekten eller meddelandena')) + (admin ? tangent('Shift Esc', 'Lämna supportläget') : '') +
        tangent('J · K', 'Nästa eller förra raden i en lista (även ↓ ↑ när en rad är vald)') + tangent('Enter', 'Öppna den valda raden') + tangent('X', 'Markera den valda raden (för åtgärder på flera)') +
        tangent('?', 'Den här listan') + '</div>' });
  };

  /* --- Aviseringscentret: klockan och panelen ----------------------------------------------------- */
  // Klockan sitter bredvid Sök i sidomenyn och före Ny i toppraden (infälld meny och mobil)
  function klocka(plats) {
    var n = IH.db && IH.avisera ? IH.avisera.olasta() : 0;
    return '<button class="ih-klocka ih-klocka--' + plats + '" type="button" data-g="aviseringar" aria-haspopup="dialog" aria-label="Aviseringar' + (n ? ', ' + n + ' olästa' : '') + '" title="Aviseringar">' +
      IH.emo('bjallra') + (n ? '<i class="ih-klocka__antal" aria-hidden="true">' + (n > 99 ? '99+' : n) + '</i>' : '') + '</button>';
  }
  var AVIS_IKON = { paminnelse: 'klocka', sammanfattning: 'kalender', chatt: 'meddelande', fordelning: 'kunder', offert: 'offert', uppgift: 'uppgift', mote: 'kamera' };
  var avisArk = null;
  function avisRad(x) {
    var lank = x.lank && /^#\//.test(x.lank) ? x.lank : null;
    var inne = '<b>' + IH.e(x.rubrik || 'Avisering') + (x.antal > 1 ? ' <span class="avis__antal">' + x.antal + '</span>' : '') + '</b>' +
      '<small>' + (x.text ? IH.e(x.text) + ' · ' : '') + '<time datetime="' + IH.e(x.tid) + '">' + IH.e(IH.sedan(x.tid)) + '</time></small>';
    return '<div class="lista__rad avis' + (x.last ? '' : ' avis--ny') + '" data-rad>' +
      '<span class="avis__ikon" aria-hidden="true">' + IH.i(AVIS_IKON[x.typ] || 'bjallra') + '</span>' +
      (lank ? '<a class="lista__text avis__text" href="' + IH.e(lank) + '" data-g="avis-oppna" data-id="' + IH.e(x.id) + '" data-rad-oppna>' + inne + '</a>'
        : '<span class="lista__text avis__text">' + inne + '</span>') +
      '<button class="ch-ruta avis__last" type="button" data-g="avis-last" data-id="' + IH.e(x.id) + '" aria-label="' + (x.last ? 'Markera som oläst' : 'Markera som läst') + '" title="' + (x.last ? 'Markera som oläst' : 'Markera som läst') + '">' +
      IH.i(x.last ? 'post' : 'bock') + '</button></div>';
  }
  function avisInnehall() {
    var lista = IH.avisera.lista(), nya = lista.filter(function (x) { return !x.last; }), lasta = lista.filter(function (x) { return x.last; });
    var stod = IH.avisera.skrivbordStod(), pa = IH.avisera.skrivbordPa(), nekad = stod && Notification.permission === 'denied';
    var skrivbordRad = '<div class="avis-val"><span class="avis-val__text"><b>Skrivbordsaviseringar</b><small>' +
      (!stod ? 'Webbläsaren kan inte visa skrivbordsaviseringar.' : nekad ? 'Blockerade för sidan. Tillåt aviseringar i webbläsarens inställningar för sidan.' :
        pa ? 'På – påminnelser och chatt syns även när fliken inte är framme.' : 'Av – påminnelser syns här och som meddelande i CRM:et.') + '</small></span>' +
      (stod && !nekad ? '<button class="knapp knapp--liten" type="button" data-g="avis-skrivbord" aria-pressed="' + pa + '">' + (pa ? 'Stäng av' : 'Slå på') + '</button>' : '') + '</div>';
    var knappar = lista.length ? '<div class="avis-knappar">' +
      '<button class="knapp knapp--liten" type="button" data-g="avis-alla-lasta"' + (nya.length ? '' : ' disabled') + '>' + IH.i('bock') + 'Markera alla som lästa</button>' +
      '<button class="knapp knapp--liten" type="button" data-g="avis-rensa"' + (lasta.length ? '' : ' disabled') + '>' + IH.i('stang') + 'Ta bort lästa</button></div>' : '';
    var tom = '<div class="avis-tom"><span class="avis__ikon" aria-hidden="true">' + IH.emo('bjallra') + '</span><p><b>Inga aviseringar</b>Påminnelser för uppgifter, dagens sammanfattning och annat som rör dig hamnar här.</p></div>';
    return skrivbordRad + knappar +
      (lista.length ? (nya.length ? '<p class="etikett avis-etikett">Nya · ' + nya.length + '</p><div class="lista kort avis-lista" data-radlista>' + nya.map(avisRad).join('') + '</div>' : '') +
        (lasta.length ? '<p class="etikett avis-etikett">Tidigare</p><div class="lista kort avis-lista" data-radlista>' + lasta.slice(0, 60).map(avisRad).join('') + '</div>' : '') : tom) +
      '<p class="avis-not">' + IH.i('larm') + 'Aviseringar visas när CRM:et är öppet i den här webbläsaren.</p>';
  }
  function avisPanelRita() {
    if (!avisArk || !avisArk.isConnected) { avisArk = null; return; }
    var yta = avisArk.querySelector('[data-avis]');
    if (!yta) return;
    var fokus = document.activeElement, g = fokus && avisArk.contains(fokus) ? fokus.getAttribute('data-g') : null, id = fokus && fokus.getAttribute ? fokus.getAttribute('data-id') : null;
    yta.innerHTML = avisInnehall();
    // Fokus står kvar på samma knapp när panelen ritas om (eller på motsvarande plats)
    if (g) { var ny = yta.querySelector('[data-g="' + g + '"]' + (id ? '[data-id="' + id + '"]' : '')) || yta.querySelector('[data-g="' + g + '"]'); if (ny && !ny.disabled) ny.focus({ preventScroll: true }); }
  }
  IH.G.aviseringar = function () {
    avisArk = IH.oppnaArk({ titel: 'Aviseringar', ikon: 'larm', under: 'Påminnelser och det som rör dig',
      kropp: '<div class="avis-panel" data-avis>' + avisInnehall() + '</div>', vidStang: function () { avisArk = null; } });
  };
  function avisHitta(id) { return avisLista().filter(function (x) { return x.id === id; })[0] || null; }
  IH.G['avis-oppna'] = function (el) {
    var x = avisHitta(el.getAttribute('data-id'));
    if (!x) return;
    if (!x.last) { x.last = true; IH.spara(); IH.uppdateraMeny(); }
    IH.stangArk(false, true);
    if (x.lank) IH.ga(x.lank);
  };
  IH.G['avis-last'] = function (el) {
    var x = avisHitta(el.getAttribute('data-id'));
    if (!x) return;
    x.last = !x.last; IH.spara(); IH.uppdateraMeny(); avisPanelRita();
  };
  IH.G['avis-alla-lasta'] = function () {
    var n = 0;
    IH.avisera.lista().forEach(function (x) { if (!x.last) { x.last = true; n++; } });
    if (!n) return;
    IH.spara(); IH.uppdateraMeny(); avisPanelRita();
    IH.toast(n === 1 ? 'En avisering markerad som läst' : n + ' aviseringar markerade som lästa', null, 'bock');
  };
  IH.G['avis-rensa'] = function () {
    var jag = IH.jag().id, bort = avisLista().filter(function (x) { return x.till === jag && x.last; });
    if (!bort.length) return;
    IH.db.aviseringar = avisLista().filter(function (x) { return bort.indexOf(x) < 0; });
    IH.spara(); IH.uppdateraMeny(); avisPanelRita();
    IH.angra(bort.length === 1 ? 'En läst avisering borttagen' : bort.length + ' lästa aviseringar borttagna', null, function () {
      var finns = {}; avisLista().forEach(function (x) { finns[x.id] = 1; });
      bort.forEach(function (x) { if (!finns[x.id]) avisLista().push(x); });
      avisPanelRita();
    });
  };
  IH.G['avis-skrivbord'] = function () {
    if (!IH.avisera.skrivbordStod()) return;
    if (IH.avisera.skrivbordPa()) { IH.avisera.sattSkrivbord(false); avisPanelRita(); IH.toast('Skrivbordsaviseringar är av', 'Gäller både påminnelser och chatten.', 'bjallra-av'); return; }
    var svar = Notification.requestPermission(function () { /* äldre webbläsare */ });
    var efter = function (p) {
      IH.avisera.sattSkrivbord(p === 'granted'); avisPanelRita();
      if (p === 'granted') IH.toast('Skrivbordsaviseringar är på', 'Gäller både påminnelser och chatten, när CRM:et är öppet i den här webbläsaren.', 'bjallra');
      else IH.toast('Aviseringar är avstängda i webbläsaren', 'Tillåt aviseringar för sidan i webbläsarens inställningar.', 'varning');
    };
    if (svar && svar.then) svar.then(efter); else efter(Notification.permission);
  };

  /* --- Påminnelser: planeraren -------------------------------------------------------------------------
     Vid start, varje minut och när fliken kommer fram: öppna uppgifter för mig vars tid har passerat larmar en gång
     (u.larmat). Toast med Klar, +1 h och Öppna, en rad i aviseringscentret och en skrivbordsavisering om den är på.
     Gäller alla uppgifter, även förfrågans "Påminn mig" och chattens påminnelser (chatten sätter också larmat). */
  function uppgiftPlats(u) {
    var k = u.kund && IH.kund(u.kund);
    return k ? k.namn : '';
  }
  function uppgiftKlar(u) {
    // Salj-modulen sköter upprepning (nästa uppgift skapas) i IH.uppgiftKlar – annars bockas den bara av
    if (IH.uppgiftKlar) { IH.uppgiftKlar(u.id); return; }
    u.klar = true; u.klarTid = new Date().toISOString();
    IH.spara(); IH.uppdateraMeny(); rita();
    IH.toast('Klar', u.text, 'bock');
  }
  function senareEnTimme(u) {
    u.forfaller = new Date(Date.now() + 36e5).toISOString(); u.larmat = null;
    IH.spara(); IH.uppdateraMeny(); rita();
    IH.toast('Påminner igen om en timme', u.text + ' · ' + IH.lokal(u.forfaller, 't', { hour: '2-digit', minute: '2-digit' }), 'klocka');
  }
  function kollaPaminnelser() {
    if (!IH.db || !Array.isArray(IH.db.uppgifter) || !inloggad()) return;
    // I supportläget larmar inget – påminnelserna är kontots egna och ska nå personen själv
    if (IH.visarSom && IH.visarSom()) return;
    var jag = IH.jag().id, nu = Date.now();
    if (!jag) return;
    var nya = IH.db.uppgifter.filter(function (u) {
      if (!u || u.klar || u.larmat || !u.forfaller) return false;
      if (u.ansvarig && u.ansvarig !== jag) return false;
      var t = Date.parse(u.forfaller);
      return isFinite(t) && t <= nu;
    });
    if (!nya.length) return;
    var tid = new Date().toISOString();
    nya.forEach(function (u) {
      u.larmat = tid;
      var plats = uppgiftPlats(u);
      IH.avisera({ typ: 'paminnelse', rubrik: u.text, text: 'Skulle vara klar ' + IH.datum(u.forfaller) + ' kl. ' + IH.lokal(u.forfaller, 't', { hour: '2-digit', minute: '2-digit' }) + (plats ? ' · ' + plats : ''),
        lank: '#/att-gora', nyckel: 'uppgift:' + u.id, spara: false });
    });
    IH.spara();
    if (nya.length === 1) {
      var u = nya[0], plats = uppgiftPlats(u);
      IH.toast('Påminnelse: ' + u.text, (plats ? plats + ' · ' : '') + 'skulle vara klar ' + IH.sedan(u.forfaller), 'klocka', { typ: 'info', tid: 20000, knappar: [
        { text: 'Klar', gor: function () { uppgiftKlar(u); } },
        { text: '+1 h', gor: function () { senareEnTimme(u); } },
        { text: 'Öppna', gor: function () { IH.ga('#/att-gora'); } }] });
      skrivbord('Påminnelse: ' + u.text, plats || 'Uppgift i Legohus CRM', '#/att-gora', 'uppgift:' + u.id);
    } else {
      var text = nya.slice(0, 3).map(function (x) { return x.text; }).join(' · ') + (nya.length > 3 ? ' · och ' + (nya.length - 3) + ' till' : '');
      IH.toast(nya.length + ' uppgifter har passerat sin tid', text, 'klocka', { typ: 'info', tid: 15000, lank: '#/att-gora', knapp: 'Öppna Att göra' });
      skrivbord(nya.length + ' uppgifter har passerat sin tid', text, '#/att-gora', 'uppgifter');
    }
  }
  // Dagens sammanfattning: första gången kontot öppnar CRM:et en dag – uppgifter i dag och offerter som går ut inom 7 dagar
  function dagSammanfattning() {
    if (!IH.db || !inloggad() || (IH.visarSom && IH.visarSom())) return;
    var jag = IH.jag();
    if (!jag.id || jag.roll === 'admin') return;
    var nyckel = 'ih-crm-dagsammanfattning:' + jag.id, idag = IH.dagStr(), forra = null;
    try { forra = localStorage.getItem(nyckel); } catch (e) { forra = idag; }
    if (forra === idag) return;
    try { localStorage.setItem(nyckel, idag); } catch (e) { return; }
    var slut = new Date(); slut.setHours(23, 59, 59, 999);
    var uppg = (IH.db.uppgifter || []).filter(function (u) { return u && !u.klar && u.forfaller && (!u.ansvarig || u.ansvarig === jag.id) && Date.parse(u.forfaller) <= slut.getTime(); });
    var off = (IH.db.offerter || []).filter(function (o) {
      if (!o || o.status !== 'skickad') return false;
      var a = IH.affar(o.affar);
      if (a && a.ansvarig && a.ansvarig !== jag.id) return false;
      var kvar = (o.giltig || 30) - IH.dagarSedan(o.skapad);
      return kvar > 0 && kvar <= 7;
    });
    if (!uppg.length && !off.length) return;
    var delar = [];
    if (uppg.length) delar.push(uppg.length === 1 ? '1 uppgift i dag' : uppg.length + ' uppgifter i dag');
    if (off.length) delar.push(off.length === 1 ? '1 offert går ut inom 7 dagar' : off.length + ' offerter går ut inom 7 dagar');
    var detalj = uppg.slice(0, 2).map(function (u) { return u.text; }).concat(off.slice(0, 2).map(function (o) { var k = IH.kund(o.kund); return (o.nummer || 'Offert') + (k ? ' (' + k.namn + ')' : ''); }));
    IH.avisera({ typ: 'sammanfattning', rubrik: 'Din dag: ' + delar.join(' och '), text: detalj.join(' · '), lank: uppg.length ? '#/att-gora' : '#/offerter', nyckel: 'dag:' + idag });
  }
  var planTimer = 0;
  function startaPlanerare() {
    if (planTimer) return;
    var kor = function () { try { dagSammanfattning(); kollaPaminnelser(); } catch (e) { if (window.console) console.warn('Påminnelserna:', e); } };
    setTimeout(kor, 1200);
    planTimer = setInterval(kor, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') kor(); });
  }
  IH.paminnelser = { kolla: kollaPaminnelser };

  /* --- Tangentbordet i listor: J/K eller pilarna, Enter öppnar, X kryssar ---------------------------------
     En lista med data-radlista och rader med data-rad. Raden som öppnas: [data-rad-oppna], raden själv om den
     är en länk eller har data-g, annars första länken. X kryssar radens kryssruta (input eller role=checkbox).
     Inget händer när man skriver i ett fält. */
  function radOppna(rad) {
    var mal = rad.querySelector('[data-rad-oppna]') || (rad.matches('a[href], [data-g]') ? rad : null) || rad.querySelector('a[href]');
    if (mal) mal.click();
  }
  function radTangent(e) {
    var k = e.key;
    if (e.shiftKey || e.defaultPrevented || aktivtArk && !aktivtArk.ark.contains(document.activeElement) || palett) return false;
    if (!/^(j|k|x|J|K|X|ArrowDown|ArrowUp|Enter)$/.test(k)) return false;
    // G och sedan K/… är ett sidhopp (G K = kunderna), inte ett radbyte
    if (gVantar && Date.now() - gVantar < 1200 && /^[a-zåäö]$/i.test(k)) return false;
    var omrade = aktivtArk ? aktivtArk.ark : $('#vy');
    if (!omrade) return false;
    var akt = document.activeElement, rad = akt && akt.closest ? akt.closest('[data-rad]') : null;
    if (rad && !omrade.contains(rad)) rad = null;
    var lista = rad ? rad.closest('[data-radlista]') : null;
    if (!lista) {
      // Pilarna och Enter gäller bara när man redan står i en lista – annars rullar pilarna sidan som vanligt
      if (/^(Arrow|Enter)/.test(k) || /^[xX]$/.test(k)) return false;
      lista = $$('[data-radlista]', omrade).filter(syns)[0];
      if (!lista) return false;
    }
    var rader = $$('[data-rad]', lista).filter(function (r) { return r.closest('[data-radlista]') === lista && syns(r); });
    if (!rader.length) return false;
    if (k === 'Enter') {
      if (!rad || akt !== rad) return false;
      e.preventDefault(); radOppna(rad); return true;
    }
    if (k === 'x' || k === 'X') {
      var ruta = rad.querySelector('input[type="checkbox"], [role="checkbox"]');
      if (!ruta || ruta.disabled || ruta.getAttribute('aria-disabled') === 'true') return false;
      e.preventDefault();
      var radId = rad.getAttribute('data-id'), radNr = rader.indexOf(rad);
      ruta.click();
      // Listan ritas ofta om när en rad kryssas – behåll fokus på samma rad så att J/K och X fortsätter därifrån
      setTimeout(function () {
        if (rad.isConnected && rad.contains(document.activeElement)) return;
        var ny = rad.isConnected ? rad : null;
        if (!ny && radId) ny = $$('[data-rad]', omrade).filter(function (r) { return r.getAttribute('data-id') === radId; })[0];
        if (!ny) { var l = $$('[data-radlista]', omrade).filter(syns)[0]; ny = l ? $$('[data-rad]', l).filter(syns)[radNr] : null; }
        if (!ny) return;
        if (!ny.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(ny.tagName)) ny.setAttribute('tabindex', '-1');
        ny.focus({ preventScroll: true });
      }, 0);
      return true;
    }
    var steg = /^(j|J|ArrowDown)$/.test(k) ? 1 : -1, n = rad ? rader.indexOf(rad) : -1;
    var ny = rader[n < 0 ? (steg > 0 ? 0 : rader.length - 1) : Math.max(0, Math.min(rader.length - 1, n + steg))];
    e.preventDefault();
    if (!ny.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(ny.tagName)) ny.setAttribute('tabindex', '-1');
    ny.focus({ preventScroll: true });
    ny.scrollIntoView({ block: 'nearest' });
    return true;
  }

  // 3D-scenerna (three.js) laddas först när en sida med en scen visas – modulerna monterar sig själva vid import.
  // Hämtningen börjar redan när man pekar på länken eller när sidan börjar ritas (Projekt, Kundmöte).
  var tre = {}, TRE_VY = { produktion: 'resa3d', mote: 'motesrum3d' };
  function importera3d(namn) {
    if (!tre[namn]) tre[namn] = import('./' + namn + '.js' + VER).catch(function () { tre[namn] = null; });
  }
  // Importen (och scenbygget) startar efter första målningen, så att sidans rubrik och innehåll syns först
  function ladda3d() {
    var vy = $('#vy');
    if (!vy) return;
    var namn = [];
    if (!tre.resa3d && vy.querySelector('[data-resa3d]')) namn.push('resa3d');
    if (!tre.motesrum3d && vy.querySelector('[data-motesrum3d]')) namn.push('motesrum3d');
    if (namn.length) requestAnimationFrame(function () { setTimeout(function () { namn.forEach(importera3d); }, 0); });
  }
  ['pointerover', 'focusin', 'touchstart'].forEach(function (typ) {
    document.addEventListener(typ, function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href^="#/produktion"], a[href^="#/mote"]');
      var namn = a && TRE_VY[(a.getAttribute('href').split('/')[1] || '')];
      if (namn && !tre[namn] && !IH.sparrad(a.getAttribute('href').split('/')[1])) importera3d(namn);
    }, { passive: true });
  });

  /* --- Start ------------------------------------------------------------- */
  IH.starta = function () {
    if (!inloggad()) { location.replace('logga-in.html'); return; }
    // Okänt eller ändrat konto-id: logga ut i stället för att falla tillbaka på ett riktigt konto
    if (!IH.kantKonto()) { try { localStorage.removeItem('ih-crm-inloggad'); } catch (e) { /* */ } location.replace('logga-in.html'); return; }
    skal();
    sattSido(sidoDold(), false);
    new MutationObserver(function () { centreraAlla(); ladda3d(); }).observe($('#vy'), { childList: true, subtree: true });
    kopplaHandelser();
    rita();
    startaPlanerare();
    requestAnimationFrame(function () { flyttaMarkor(true); });
    if (document.fonts) document.fonts.ready.then(function () { flyttaMarkor(true); });
    document.documentElement.classList.add('redo');
    if (IH.dataVarning) IH.toast('Den sparade datan gick inte att läsa', IH.dataVarning + ' Exempeldatan visas i stället.', 'varning', { tid: 12000 });
  };
})();
