/* ============================================================
   Idealhus CRM – kärnan (prototyp, 2026-10-01)
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
  var $ = IH.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = IH.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* --- Lagring ------------------------------------------------------ */
  function ladda() {
    var db = null;
    try { db = JSON.parse(localStorage.getItem(IH.NYCKEL)); } catch (e) { db = null; }
    if (!db || db.version !== IH.VERSION) {
      db = IH.skapaExempeldata();
      try { localStorage.setItem(IH.NYCKEL, JSON.stringify(db)); } catch (e) { /* privat läge */ }
    }
    return db;
  }
  IH.db = ladda();
  IH.spara = function () {
    IH.db.andrad = new Date().toISOString();
    try { localStorage.setItem(IH.NYCKEL, JSON.stringify(IH.db)); } catch (e) { /* fullt eller privat */ }
  };
  // En annan flik ändrade – läs om och rita om.
  window.addEventListener('storage', function (e) {
    if (e.key === IH.NYCKEL) { IH.db = ladda(); rita(); }
    if (e.key === 'ih-crm-inloggad' && !e.newValue) location.replace('logga-in.html');
  });

  IH.jag = function () {
    var id = null;
    try { id = localStorage.getItem('ih-crm-jag'); } catch (e) { id = null; }
    return IH.ANVANDARE.filter(function (u) { return u.id === id; })[0] || IH.ANVANDARE[0];
  };
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
      var fram = Math.round(-s / 86400);
      return fram <= 0 ? 'i dag' : fram === 1 ? 'i morgon' : 'om ' + fram + ' dagar';
    }
    if (s < 60) return 'nyss';
    if (s < 3600) return Math.floor(s / 60) + ' min sedan';
    if (s < 86400) return Math.floor(s / 3600) + ' h sedan';
    var d = Math.floor(s / 86400);
    return d === 1 ? 'i går' : d < 30 ? d + ' dagar sedan' : IH.datum(iso);
  };
  IH.initialer = function (namn) {
    return String(namn || '?').replace(/ (AB|ek\. förening)$/i, '').split(/\s+/).map(function (d) { return d.charAt(0); })
      .slice(0, 2).join('').toUpperCase();
  };
  IH.hej = function () {
    var h = new Date().getHours();
    return h < 5 ? 'God natt' : h < 10 ? 'God morgon' : h < 14 ? 'Hej' : h < 18 ? 'God eftermiddag' : 'God kväll';
  };
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
    tavla: 'M4 4h5v16H4z|M11 4h5v10h-5z|M18 4h2v7h-2z',
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
    samtal: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    motesikon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M3 20c.6-3.6 3-5.5 6-5.5|M15 14.5h6v6h-6z',
    system: 'M12 3l7 4v10l-7 4-7-4V7z|M12 12l7-5|M12 12v9|M12 12 5 7',
    dra: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
    utloggning: 'M15 4h4v16h-4|M10 8l-4 4 4 4|M6 12h10',
    aterstall: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.5|M4 4v4.5h4.5',
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
    helskarm: 'M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5'
  };
  IH.i = function (namn, klass) {
    var d = IKONER[namn] || IKONER.hem;
    return '<svg class="i' + (klass ? ' ' + klass : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      d.split('|').map(function (p) { return '<path d="' + p + '"/>'; }).join('') + '</svg>';
  };

  /* --- Meddelanden och konfetti ------------------------------------- */
  IH.toast = function (rubrik, text, ikon) {
    var yta = $('.toaster');
    if (!yta) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span class="toast__ikon">' + IH.i(ikon || 'bock') + '</span><span><b>' + IH.e(rubrik) + '</b>' +
      (text ? '<small>' + IH.e(text) + '</small>' : '') + '</span>';
    yta.appendChild(t);
    setTimeout(function () {
      t.classList.add('ut');
      setTimeout(function () { t.remove(); }, 400);
    }, 3800);
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

  /* --- Panelen från höger ------------------------------------------- */
  var aktivtArk = null;
  IH.oppnaArk = function (opt) {
    IH.stangArk(true);
    var slojan = document.createElement('div');
    slojan.className = 'slojan';
    var ark = document.createElement('aside');
    ark.className = 'ark' + (opt.bred ? ' ark--bred' : '');
    ark.setAttribute('role', 'dialog');
    ark.setAttribute('aria-modal', 'true');
    ark.setAttribute('aria-label', opt.titel || 'Panel');
    ark.innerHTML = '<header class="ark__huvud">' + (opt.ikon ? '<span class="kort__ikon">' + IH.i(opt.ikon) + '</span>' : '') +
      '<div><h2>' + IH.e(opt.titel) + '</h2>' + (opt.under ? '<p>' + opt.under + '</p>' : '') + '</div>' +
      '<button class="ikonknapp" type="button" data-g="stang-ark" aria-label="Stäng">' + IH.i('stang') + '</button></header>' +
      '<div class="ark__kropp">' + (opt.kropp || '') + '</div>' + (opt.fot ? '<footer class="ark__fot">' + opt.fot + '</footer>' : '');
    Array.prototype.forEach.call(ark.querySelector('.ark__kropp').children, function (ch, k) { ch.style.setProperty('--k', Math.min(k, 10)); });
    document.body.appendChild(slojan);
    document.body.appendChild(ark);
    slojan.addEventListener('click', function () { IH.stangArk(); });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { slojan.classList.add('syns'); ark.classList.add('syns'); });
    });
    aktivtArk = { ark: ark, slojan: slojan, vidStang: opt.vidStang, fokus: document.activeElement };
    setTimeout(function () {
      var f = ark.querySelector('[autofocus]') || ark.querySelector('.ark__huvud .ikonknapp');
      if (f) f.focus();
    }, 60);
    if (opt.efter) opt.efter(ark);
    return ark;
  };
  IH.stangArk = function (direkt) {
    if (!aktivtArk) return;
    var a = aktivtArk;
    aktivtArk = null;
    a.ark.classList.remove('syns');
    a.slojan.classList.remove('syns');
    var bort = function () { a.ark.remove(); a.slojan.remove(); };
    if (direkt || lugn) bort(); else setTimeout(bort, 500);
    if (a.vidStang) a.vidStang();
    if (a.fokus && a.fokus.focus && !direkt) a.fokus.focus();
  };

  /* --- Navigering --------------------------------------------------- */
  IH.vyer = IH.vyer || {};
  IH.G = IH.G || {};
  IH.nuvarande = { vy: 'oversikt', del: [] };

  function lasAdress() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var delar = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { vy: delar[0] || 'oversikt', del: delar.slice(1) };
  }
  IH.ga = function (adress) {
    if (location.hash === adress) rita(); else location.hash = adress;
  };

  var MENY = [
    { rubrik: null, poster: [['oversikt', 'Översikt', 'hem']] },
    { rubrik: 'Sälj', poster: [['forfragningar', 'Förfrågningar', 'inkorg'], ['salj', 'Säljtavla', 'tavla'],
      ['kunder', 'Kunder', 'kunder'], ['offerter', 'Offerter', 'offert'], ['mote', 'Kundmöte', 'mote']] },
    { rubrik: 'Produktion', poster: [['produktion', 'Projekt', 'produktion']] },
    { rubrik: 'Mitt', poster: [['att-gora', 'Att göra', 'uppgift'], ['installningar', 'Inställningar', 'installning']] }
  ];

  function brickor() {
    var db = IH.db;
    var nya = db.forfragningar.filter(function (f) { return f.status === 'ny'; }).length;
    var oppna = db.affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).length;
    var proj = db.projekt.filter(function (p) { return p.steg !== 'klart'; }).length;
    var idag = new Date(); idag.setHours(23, 59, 59, 999);
    var uppg = db.uppgifter.filter(function (u) { return !u.klar && new Date(u.forfaller) <= idag; }).length;
    return { forfragningar: [nya, true], salj: [oppna], kunder: [db.kunder.length], produktion: [proj], 'att-gora': [uppg, true] };
  }

  function sidomeny() {
    var jag = IH.jag();
    var b = brickor();
    var nav = MENY.map(function (grupp) {
      return (grupp.rubrik ? '<p class="sido__rubrik">' + grupp.rubrik + '</p>' : '') + grupp.poster.map(function (p) {
        var br = b[p[0]];
        var bricka = br && br[0] ? '<span class="sido__bricka' + (br[1] ? ' sido__bricka--varm' : '') + '">' + br[0] + '</span>' : '';
        return '<a class="sido__lank" href="#/' + p[0] + '" data-vy="' + p[0] + '">' + IH.i(p[2]) + '<span>' + p[1] + '</span>' + bricka + '</a>';
      }).join('');
    }).join('');
    return '<a class="sido__logo" href="#/"><img src="../images/idealhus_logo.svg" alt="Idealhus"><small>CRM · prototyp</small></a>' +
      '<nav class="sido__nav" aria-label="CRM"><span class="sido__markor" aria-hidden="true"></span>' + nav + '</nav>' +
      '<div class="sido__fot">' +
      '<button class="anv" type="button" data-g="byt-anvandare"><span class="avatar" style="--av:' + jag.farg + '">' + IH.initialer(jag.namn) + '</span>' +
      '<span><b>' + IH.e(jag.namn) + '</b><small>' + jag.titel + ' · byt användare</small></span>' + IH.i('pil') + '</button>' +
      '<div class="sido__smalt"><a href="../index.html" data-g="lamna">' + IH.i('hem') + 'Hemsidan</a>' +
      '<button type="button" data-g="logga-ut">' + IH.i('utloggning') + 'Logga ut</button></div></div>';
  }

  function mobilmeny() {
    var b = brickor();
    var poster = [['oversikt', 'Översikt', 'hem'], ['forfragningar', 'Inkorg', 'inkorg'], ['salj', 'Tavla', 'tavla'],
      ['produktion', 'Projekt', 'produktion']];
    return poster.map(function (p) {
      var br = b[p[0]];
      return '<a href="#/' + p[0] + '" data-vy="' + p[0] + '">' + IH.i(p[2]) + p[1] + (br && br[1] && br[0] ? '<i>' + br[0] + '</i>' : '') + '</a>';
    }).join('') + '<button type="button" data-g="mer">' + IH.i('meny') + 'Mer</button>';
  }

  function skal() {
    var app = $('#app');
    app.innerHTML = '<aside class="sido">' + sidomeny() + '</aside>' +
      '<div class="huvud"><header class="topp">' +
      '<label class="sok">' + IH.i('sok') + '<span class="dold">Sök</span><input type="search" placeholder="Sök kund, förfrågan eller affär…" autocomplete="off" data-sok><kbd>/</kbd>' +
      '<div class="sokresultat" hidden></div></label>' +
      '<span class="proto">Prototyp · exempeldata</span>' +
      '<button class="knapp knapp--virke" type="button" data-g="ny">' + IH.i('plus') + 'Ny</button>' +
      '</header><main class="vy" id="vy" tabindex="-1"></main></div>' +
      '<nav class="mobilmeny" aria-label="Meny">' + mobilmeny() + '</nav>' +
      '<div class="toaster" aria-live="polite"></div>';
  }

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
  }

  IH.uppdateraMeny = function () {
    var sido = $('.sido');
    if (sido) {
      sido.innerHTML = sidomeny();
      markera(true);
    }
    var mm = $('.mobilmeny');
    if (mm) { mm.innerHTML = mobilmeny(); markera(true); }
  };

  function markera(direkt) {
    var vy = IH.nuvarande.vy;
    $$('[data-vy]').forEach(function (a) {
      var ja = a.getAttribute('data-vy') === vy;
      a.classList.toggle('aktiv', ja);
      if (ja) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    flyttaMarkor(direkt);
  }

  var forraVy = null;
  function rita() {
    var adr = lasAdress();
    var vyfn = IH.vyer[adr.vy] || IH.vyer.oversikt;
    if (!IH.vyer[adr.vy]) adr.vy = 'oversikt';
    IH.nuvarande = adr;
    var yta = $('#vy');
    if (!yta) return;
    // Vyerna kan läsa om det här är ett byte eller en omritning på plats
    // (då ska t.ex. husen inte resa sig igen).
    IH.vyByte = forraVy === null || forraVy.split('/')[0] !== adr.vy;
    var ut = vyfn(adr.del);
    var nyckel = adr.vy + '/' + adr.del.join('/');
    // Samma vy med ny del (t.ex. en annan förfrågan) byter bara innehåll.
    var bytt = forraVy === null || forraVy.split('/')[0] !== adr.vy;
    var gor = function () {
      yta.innerHTML = ut.html;
      document.title = (ut.titel ? ut.titel + ' · ' : '') + 'Idealhus CRM';
      if (bytt) {
        yta.classList.remove('vy--in');
        void yta.offsetWidth;
        yta.classList.add('vy--in');
        window.scrollTo(0, 0);
      }
      forraVy = nyckel;
      markera(false);
      delaRubriker(yta);
      IH.efterRitning(yta);
      if (ut.efter) ut.efter(yta);
    };
    if (bytt && forraVy !== null && !lugn && document.startViewTransition) {
      var vt = document.startViewTransition(gor);
      // Ett snabbt nytt klick hoppar över övergången – det är inget fel.
      if (vt) ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); });
    } else gor();
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
  IH.rita = rita;
  IH.ritaOm = function () {
    IH.uppdateraMeny();
    rita();
  };

  // Gemensamt efter varje ritning: entréer, räkneverk och lutning.
  IH.efterRitning = function (rot) {
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
      if (lugn || !mal) { skriv(mal); return; }
      var start = performance.now();
      (function steg(nu) {
        var t = Math.min(1, (nu - start) / 1300);
        skriv(mal * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(steg);
      })(start);
    });
    if (!lugn && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      $$('[data-tilt]', rot).forEach(function (k) {
        k.addEventListener('pointermove', function (e) {
          var r = k.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          k.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
          k.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
          k.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          k.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
        k.addEventListener('pointerleave', function () {
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
  function visaSok(inp) {
    var ruta = inp.parentNode.querySelector('.sokresultat');
    var r = sok(inp.value);
    var html = '';
    if (r.kunder.length) html += '<p>Kunder</p>' + r.kunder.map(function (k) {
      return '<a href="#/kunder/' + k.id + '"><span class="avatar avatar--liten">' + IH.initialer(k.namn) + '</span>' + IH.e(k.namn) + '<small>' + IH.e(k.ort) + '</small></a>';
    }).join('');
    if (r.forfragningar.length) html += '<p>Förfrågningar</p>' + r.forfragningar.map(function (f) {
      return '<a href="#/forfragningar/' + f.id + '">' + IH.i('inkorg') + IH.e(f.namn) + '<small>' + IH.e(f.hustyp) + '</small></a>';
    }).join('');
    if (r.affarer.length) html += '<p>Affärer</p>' + r.affarer.map(function (a) {
      return '<a href="#/salj/' + a.id + '">' + IH.i('tavla') + IH.e(a.titel) + '<small>' + IH.kort(a.varde) + '</small></a>';
    }).join('');
    if (!html && inp.value.trim().length >= 2) html = '<p>Inga träffar</p>';
    ruta.innerHTML = html;
    ruta.hidden = !html;
  }

  /* --- Händelser ------------------------------------------------------ */
  function kopplaHandelser() {
    document.addEventListener('click', function (e) {
      var r = $('.sokresultat');
      if (r && !e.target.closest('.sok')) r.hidden = true;
      var el = e.target.closest('[data-g]');
      if (!el) return;
      var namn = el.getAttribute('data-g');
      if (IH.G[namn]) {
        if (el.tagName === 'A' && namn !== 'lamna') e.preventDefault();
        IH.G[namn](el, e);
      }
    });
    document.addEventListener('input', function (e) {
      if (e.target.matches('[data-sok]')) visaSok(e.target);
    });
    document.addEventListener('keydown', function (e) {
      var inmatning = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (aktivtArk) { IH.stangArk(); return; }
        var r = $('.sokresultat');
        if (r && !r.hidden) { r.hidden = true; e.target.blur(); }
      }
      if (inmatning || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); var s = $('[data-sok]'); if (s) s.focus(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); IH.G.ny(); }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-form]');
      if (!f) return;
      e.preventDefault();
      var namn = f.getAttribute('data-form');
      if (IH.FORM && IH.FORM[namn]) IH.FORM[namn](f, new FormData(f));
    });
    window.addEventListener('hashchange', function () {
      IH.stangArk(true);
      var r = $('.sokresultat');
      if (r) r.hidden = true;
      var s = $('[data-sok]');
      if (s) { s.value = ''; s.blur(); }
      rita();
    });
    window.addEventListener('resize', function () { flyttaMarkor(true); });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && !inloggad()) location.replace('logga-in.html');
    });
  }

  function inloggad() {
    try { return !!localStorage.getItem('ih-crm-inloggad'); } catch (e) { return true; }
  }

  /* --- Gemensamma åtgärder --------------------------------------------- */
  IH.G['stang-ark'] = function () { IH.stangArk(); };
  IH.G['logga-ut'] = function () {
    try { localStorage.removeItem('ih-crm-inloggad'); } catch (e) { /* */ }
    lamna('logga-in.html');
  };
  IH.G.lamna = function (el, e) {
    e.preventDefault();
    lamna(el.getAttribute('href'));
  };
  function lamna(url) {
    document.documentElement.setAttribute('data-lamnar', '');
    setTimeout(function () { location.href = url; }, lugn ? 0 : 520);
  }
  IH.G['byt-anvandare'] = function () {
    var jag = IH.jag();
    IH.oppnaArk({
      titel: 'Byt användare', under: 'Exempelanvändare i prototypen.', ikon: 'kunder',
      kropp: '<div class="lista kort">' + IH.ANVANDARE.map(function (u) {
        return '<button class="lista__rad" type="button" data-g="valj-anvandare" data-id="' + u.id + '"><span class="avatar" style="--av:' + u.farg + '">' +
          IH.initialer(u.namn) + '</span><span class="lista__text"><b>' + IH.e(u.namn) + '</b><small>' + u.titel + '</small></span>' +
          (u.id === jag.id ? '<span class="status" style="--s:#7fe0a6">Inloggad</span>' : IH.i('pil')) + '</button>';
      }).join('') + '</div>'
    });
  };
  IH.G['valj-anvandare'] = function (el) {
    try { localStorage.setItem('ih-crm-jag', el.getAttribute('data-id')); } catch (e) { /* */ }
    IH.stangArk();
    var u = IH.jag();
    IH.uppdateraMeny();
    IH.ga(u.roll === 'prod' ? '#/produktion' : '#/');
    IH.toast('Inloggad som ' + u.namn, u.titel, 'kunder');
  };
  IH.G.mer = function () {
    var poster = [['kunder', 'Kunder', 'kunder'], ['offerter', 'Offerter', 'offert'], ['mote', 'Kundmöte', 'mote'],
      ['att-gora', 'Att göra', 'uppgift'], ['installningar', 'Inställningar', 'installning']];
    IH.oppnaArk({
      titel: 'Mer', ikon: 'meny',
      kropp: '<div class="lista kort">' + poster.map(function (p) {
        return '<a class="lista__rad" href="#/' + p[0] + '">' + IH.i(p[2]) + '<span class="lista__text"><b>' + p[1] + '</b></span>' + IH.i('pil') + '</a>';
      }).join('') + '<button class="lista__rad" type="button" data-g="byt-anvandare">' + IH.i('kunder') +
        '<span class="lista__text"><b>Byt användare</b><small>' + IH.e(IH.jag().namn) + '</small></span></button>' +
        '<button class="lista__rad" type="button" data-g="logga-ut">' + IH.i('utloggning') + '<span class="lista__text"><b>Logga ut</b></span></button></div>'
    });
  };

  /* --- Start ------------------------------------------------------------- */
  IH.starta = function () {
    if (!inloggad()) { location.replace('logga-in.html'); return; }
    skal();
    kopplaHandelser();
    rita();
    requestAnimationFrame(function () { flyttaMarkor(true); });
    if (document.fonts) document.fonts.ready.then(function () { flyttaMarkor(true); });
    document.documentElement.classList.add('redo');
  };
})();
