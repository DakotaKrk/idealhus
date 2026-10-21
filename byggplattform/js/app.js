/* Byggplattformen – kärnan: lagring, navigering, skal, ikoner,
   sökpalett, meddelanden och dialoger. Vyerna ligger i vyer.js. */
(function () {
  'use strict';
  var D = window.BP_DATA, M = window.Mangd;
  var BP = window.BP = { vyer: {}, G: {} };
  var NYCKEL = 'bp-v1', VERSION = 3;

  /* --- Småhjälpare ------------------------------------------------------ */
  var $ = BP.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = BP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var e = BP.e = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  BP.tal = M.tal;
  BP.kr = function (v) { return M.tal(Math.round(v || 0), 0) + ' kr'; };
  BP.kort = function (v) {
    var a = Math.abs(v || 0);
    if (a >= 1e6) return M.tal(v / 1e6, 1) + ' Mkr';
    if (a >= 1e3) return M.tal(Math.round(v / 1e3), 0) + ' tkr';
    return M.tal(Math.round(v), 0) + ' kr';
  };
  BP.initialer = function (n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); };
  var MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  BP.datum = function (iso) { var d = new Date(iso); return d.getDate() + ' ' + MANAD[d.getMonth()]; };
  BP.sedan = function (iso) {
    var dagar = Math.round((Date.now() - new Date(iso)) / 864e5);
    if (dagar <= 0) return 'i dag';
    if (dagar === 1) return 'i går';
    if (dagar < 7) return dagar + ' dagar sedan';
    return BP.datum(iso);
  };
  BP.hus = function (id) { return D.HUS.filter(function (h) { return h.id === id; })[0]; };
  // Avatarfärger: blek ton per person, stabil, minst 60° isär.
  BP.avfarg = function (namn) {
    var h = 0; for (var i = 0; i < namn.length; i++) h = (h * 31 + namn.charCodeAt(i)) % 360;
    return 'hsl(' + (Math.round(h / 60) * 60 + 20) % 360 + ' 45% 88%)';
  };

  /* --- Ikoner: en uppsättning, 1,6 px linje ------------------------------- */
  var IKONER = {
    oversikt: 'M4 4h7v7H4z|M13 4h7v4h-7z|M13 10h7v10h-7z|M4 13h7v7H4z',
    projekt: 'M3 7h18v13H3z|M8 7V4h8v3|M3 12h18',
    mangd: 'M4 6h16|M4 10h10|M4 14h16|M4 18h7|M17 16l2 2 3-4',
    bibliotek: 'M3 10.5 12 4l9 6.5|M5.5 9v11h13V9|M10 20v-5h4v5',
    tillval: 'M12 3l2.5 5.2 5.5.8-4 3.9.9 5.6L12 15.9 7.1 18.5l.9-5.6-4-3.9 5.5-.8z',
    forfragan: 'M4 5h16v11H8l-4 4z|M8 9h8|M8 12h5',
    konsult: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M3 19c.5-3 2.6-5 5-5s4.5 2 5 5|M16 4h5v5|M21 4l-6 6',
    recept: 'M5 4h14v16H5z|M8 8h8|M8 12h8|M8 16h5',
    sok: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4',
    plus: 'M12 5v14|M5 12h14',
    pil: 'M5 12h14|M13 6l6 6-6 6',
    pilv: 'M19 12H5|M11 6l-6 6 6 6',
    hoger: 'M9 6l6 6-6 6',
    vanster: 'M15 6l-6 6 6 6',
    ned: 'M6 9l6 6 6-6',
    bock: 'M5 12.5l4.5 4.5L19 7.5',
    stang: 'M6 6l12 12|M18 6 6 18',
    varning: 'M12 4 2.5 20h19z|M12 10v4.5|M12 17.5h.01',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 11v5|M12 8h.01',
    vagg: 'M3 6h18v4H3z|M3 14h18v4H3z',
    golv: 'M3 9l9-5 9 5-9 5z|M3 14l9 5 9-5',
    tak: 'M2 13 12 5l10 8|M5 11v8h14v-8',
    grund: 'M3 15h18v5H3z|M6 15v-4|M12 15v-4|M18 15v-4',
    oppning: 'M5 4h14v16H5z|M12 4v16|M5 12h14',
    ritning: 'M4 4h16v16H4z|M4 9h6v11|M10 13h10',
    linjal: 'M3 17 17 3l4 4L7 21z|M7 13l2 2|M10 10l2 2|M13 7l2 2',
    hand: 'M8 11V5.5a1.5 1.5 0 0 1 3 0V11|M11 10V4.5a1.5 1.5 0 0 1 3 0V11|M14 10.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S5 18 4 15l-1.2-3a1.4 1.4 0 0 1 2.5-1.2L8 14',
    pekare: 'M5 3l14 7-6 2-2 6z',
    uppladd: 'M12 16V4|M7 9l5-5 5 5|M4 16v4h16v-4',
    ladda: 'M12 4v12|M7 11l5 5 5-5|M4 20h16',
    skrivut: 'M6 9V3.5h12V9|M6 17H4v-7h16v7h-2|M7 14h10v6.5H7z',
    kub: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z|M12 12l8-4.5|M12 12v9|M12 12 4 7.5',
    vrid: 'M4.5 13a7.5 7.5 0 0 1 13.2-4.9M19.5 11a7.5 7.5 0 0 1-13.2 4.9|M18 4.5v4h-4|M6 19.5v-4h4',
    zoomin: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4|M8 11h6|M11 8v6',
    zoomut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4|M8 11h6',
    anpassa: 'M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5',
    kund: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5',
    dokument: 'M6 3.5h9l3.5 3.5v13.5H6z|M14.5 3.5V7H18',
    klocka: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
    meny: 'M4 7h16|M4 12h16|M4 17h16',
    extern: 'M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6',
    radera: 'M5 7h14|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
    kopiera: 'M8 8h12v12H8z|M16 8V4H4v12h4',
    skicka: 'M4 12 20 4l-6 16-3-7z|M11 13l9-9',
    arkitekt: 'M4 20l4-1 11-11-3-3L5 16z|M14 6l3 3',
    konstruktion: 'M3 19h18|M5 19V9h14v10|M5 9l7 10 7-10',
    energi: 'M13 3 5 13h6l-1 8 8-10h-6z',
    ka: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z|M9 12l2 2 4-4',
    kompass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M15.5 8.5l-2 5-5 2 2-5z',
    tavla: 'M4 5h16v14H4z|M9.33 5v14|M14.67 5v14',
    jamfor: 'M4 5h7v14H4z|M13 5h7v14h-7z',
    sortera: 'M7 4v16|M4 17l3 3 3-3|M17 20V4|M14 7l3-3 3 3',
    pris: 'M3 12V4h8l9 9-8 8z|M7.5 7.5h.01',
    kalkyl: 'M6 3h12v18H6z|M9 7h6v3H9z|M9 14h.01|M12 14h.01|M15 14h.01|M9 17.5h.01|M12 17.5h.01|M15 17.5h.01'
  };
  BP.i = function (namn, klass) {
    var d = IKONER[namn] || IKONER.info;
    return '<svg class="i' + (klass ? ' ' + klass : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      d.split('|').map(function (p) { return '<path d="' + p + '"/>'; }).join('') + '</svg>';
  };
  BP.marke = '<svg viewBox="0 0 26 26" aria-hidden="true"><rect x="2" y="3" width="22" height="14" rx="2.5" fill="#2b2722"/><path d="M7 21v-4M19 21v-4" stroke="#2b2722" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 13.2 13 7.2l6.5 6" fill="none" stroke="#a8a873" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.2 12v2.4h7.6V12" fill="none" stroke="#a8a873" stroke-width="1.8"/></svg>';

  /* --- Lagring ---------------------------------------------------------------- */
  function dagar(n) { var d = new Date(); d.setDate(d.getDate() + n); d.setHours(9 + (Math.abs(n) % 7), 12, 0, 0); return d.toISOString(); }
  BP.dagar = dagar;

  // Exempelritningen: Pulpet 30 (7,50 × 4,00 m) med en innervägg, i skala 1:50
  // på ett papper där 1 m = 60 px. Delvis avritad, inget bekräftat.
  function exempelRitning() {
    var s = 60, ox = 120, oy = 110;
    var p = function (x, y) { return [ox + x * s, oy + y * s]; };
    return {
      namn: 'Exempelritning – planritning 1:50.svg',
      bredd: 720, hojd: 480,
      skala: null,
      kalibrering: null,
      element: [
        { id: 'r1', typ: 'vagg', recept: 'yttervagg-170', hojd: 2.5, pts: [p(0, 0), p(7.5, 0)], oppningar: [{ typ: 'fonster', bredd: 2.4, hojd: 1.2, antal: 1, pos: 0.32 }], bekraftad: false },
        { id: 'r2', typ: 'vagg', recept: 'yttervagg-170', hojd: 2.5, pts: [p(7.5, 0), p(7.5, 4)], oppningar: [], bekraftad: false }
      ],
      plan: { ox: ox, oy: oy, s: s }
    };
  }

  function seed() {
    var proj = D.PROJEKT.map(function (p) {
      var h = BP.hus(p.hus);
      var g = M.delarForHus(h);
      var allaBekr = p.steg === 'offert' || p.steg === 'order';
      g.delar.forEach(function (d) { d.bekraftad = allaBekr || d.typ !== 'vagg'; });
      var proj = {
        id: p.id, namn: p.namn, kund: p.kund, ort: p.ort, hus: p.hus, steg: p.steg, skapad: dagar(p.skapad),
        deltagare: p.deltagare.slice(), tillval: JSON.parse(JSON.stringify(p.tillval)),
        underlag: p.steg === 'underlag' ? 'ritning' : 'modell',
        delar: p.steg === 'underlag' ? [] : g.delar,
        antaganden: p.steg === 'underlag' ? [] : g.antaganden,
        ritning: p.steg === 'underlag' ? exempelRitning() : null,
        forfragningar: [], konsulter: [],
        handelser: [
          { tid: dagar(p.skapad), text: 'Projektet skapades', av: 'Lina Berg' }
        ]
      };
      if (p.steg !== 'underlag') proj.handelser.unshift({ tid: dagar(p.skapad + 1), text: 'Mängden räknades ur modellen ' + h.namn, av: 'Lina Berg' });
      if (p.steg === 'offert' || p.steg === 'order') {
        proj.handelser.unshift({ tid: dagar(p.skapad + 3), text: 'Alla byggdelar bekräftade', av: 'Lina Berg' });
        proj.forfragningar.push({ id: 'f-' + p.id, till: 'Exempel Bygghandel', skickad: dagar(p.skapad + 4), status: 'svar', svar: { summa: null, rabatt: 12, leverans: '2 veckor' } });
        proj.handelser.unshift({ tid: dagar(p.skapad + 6), text: 'Exempel Bygghandel svarade på förfrågan', av: 'Exempel Bygghandel' });
      }
      if (p.steg === 'order') proj.handelser.unshift({ tid: dagar(p.skapad + 12), text: 'Order lagd hos Exempel Bygghandel', av: 'Lina Berg' });
      return proj;
    });
    return { version: VERSION, roll: 'bygg', projekt: proj, leads: [
      { id: 'l1', namn: 'Erik Holm', ort: 'Norrtälje', hus: 'kupa-50', text: 'Vill bygga fritidshus på sjötomt, har bygglov på gång.', tid: dagar(-1), status: 'ny' },
      { id: 'l2', namn: 'Hanna Strand', ort: 'Lund', hus: 'sadel-30', text: 'Gästhus i trädgården, vill ha prisförslag.', tid: dagar(-3), status: 'ny' }
    ], recept: null, material: null };
  }

  function las() {
    try {
      var s = JSON.parse(localStorage.getItem(NYCKEL));
      if (s && s.version === VERSION) return s;
    } catch (err) { /* börja om */ }
    return seed();
  }
  BP.db = las();
  // Förfrågningar från konsumentsidan väntar i en egen inkorg.
  try {
    var inkorg = JSON.parse(localStorage.getItem('bp-inkorg') || '[]');
    if (inkorg.length) { BP.db.leads = inkorg.reverse().concat(BP.db.leads); localStorage.removeItem('bp-inkorg'); }
  } catch (err) { /* ingen lagring */ }
  BP.spara = function () { try { localStorage.setItem(NYCKEL, JSON.stringify(BP.db)); } catch (err) { /* ingen lagring */ } };
  BP.aterstall = function () { BP.db = seed(); BP.spara(); rita(); };
  BP.recept = function () { return BP.db.recept || D.RECEPT; };
  BP.material = function () { return BP.db.material || D.MATERIAL; };
  BP.projekt = function (id) { return BP.db.projekt.filter(function (p) { return p.id === id; })[0]; };
  BP.roll = function () { return D.ROLLER.filter(function (r) { return r.id === BP.db.roll; })[0] || D.ROLLER[0]; };
  BP.handelse = function (p, text) { p.handelser.unshift({ tid: new Date().toISOString(), text: text, av: BP.roll().person }); };

  // Projektets mängd: byggdelar ur modellen eller ritningen.
  BP.delarFor = function (p) {
    if (p.underlag === 'ritning' && p.ritning) return BP.ritDelar(p.ritning);
    return p.delar;
  };
  BP.mangdFor = function (p) { return M.mangda(BP.delarFor(p), BP.recept(), BP.material()); };
  BP.tillvalSumma = function (p) {
    return D.TILLVAL.reduce(function (t, g) {
      var v = g.val.filter(function (x) { return x.id === p.tillval[g.id]; })[0];
      return t + (v ? v.pris : 0);
    }, 0);
  };

  // Ritningens element blir byggdelar när skalan är satt.
  BP.ritDelar = function (r) {
    if (!r.skala) return [];
    return r.element.map(function (el, n) {
      if (el.typ === 'vagg') {
        var a = el.pts[0], b = el.pts[1];
        var L = Math.hypot(b[0] - a[0], b[1] - a[1]) / r.skala;
        return { id: el.id, namn: (el.recept === 'innervagg-70' ? 'Innervägg ' : 'Yttervägg ') + (n + 1), typ: 'vagg', recept: el.recept, langd: M.avrunda(L, 2), hojd: el.hojd, oppningar: el.oppningar || [], bekraftad: el.bekraftad, kalla: 'ritning' };
      }
      if (el.typ === 'yta') {
        var xs = el.pts.map(function (q) { return q[0]; }), ys = el.pts.map(function (q) { return q[1]; });
        var L2 = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / r.skala, B = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / r.skala;
        var delar = [{ id: el.id + '-b', namn: 'Golvbjälklag ' + (n + 1), typ: 'bjalklag', recept: 'golv-195', langd: M.avrunda(L2, 2), bredd: M.avrunda(B, 2), bekraftad: el.bekraftad, kalla: 'ritning' }];
        if (el.tak) delar.push({ id: el.id + '-t', namn: 'Tak ' + (n + 1), typ: 'tak', recept: el.tak === 'pulpet' ? 'tak-pulpet' : 'tak-sadel', form: el.tak, langd: M.avrunda(L2, 2), bredd: M.avrunda(B, 2), lutning: el.lutning || 2, utsprang: 0.4, bekraftad: el.bekraftad, kalla: 'ritning' });
        if (el.grund) delar.push({ id: el.id + '-g', namn: 'Grund ' + (n + 1), typ: 'grund', recept: 'plintgrund', langd: M.avrunda(L2, 2), bredd: M.avrunda(B, 2), bekraftad: el.bekraftad, kalla: 'ritning' });
        return delar;
      }
      return [];
    }).reduce(function (a, b) { return a.concat(b); }, []);
  };

  /* --- Navigering ------------------------------------------------------------ */
  function adress() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var d = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { vy: d[0] || 'oversikt', del: d.slice(1) };
  }
  BP.ga = function (a) { if (location.hash === a) rita(); else location.hash = a; };

  var MENY = [
    { rubrik: null, poster: [['oversikt', 'Översikt', 'oversikt'], ['projekt', 'Projekt', 'projekt'], ['mangdning', 'Mängdning', 'mangd'], ['kalkyl', 'Kalkyl och offert', 'kalkyl'], ['bibliotek', 'Bibliotek', 'bibliotek']] },
    { rubrik: 'Kund och partner', poster: [['tillval', 'Tillval', 'tillval'], ['forfragningar', 'Förfrågningar', 'forfragan'], ['konsulter', 'Konsulter', 'konsult']] },
    { rubrik: 'Underlag', poster: [['recept', 'Recept och material', 'recept'], ['prislistor', 'Prislistor', 'pris']] }
  ];

  function antal() {
    var obekr = BP.db.projekt.reduce(function (t, p) { return t + BP.delarFor(p).filter(function (d) { return d.bekraftad === false; }).length + (p.underlag === 'ritning' && p.ritning && !p.ritning.skala ? 1 : 0); }, 0);
    var leads = BP.db.leads.filter(function (l) { return l.status === 'ny'; }).length;
    var fr = BP.db.projekt.reduce(function (t, p) { return t + p.forfragningar.filter(function (f) { return f.status === 'svar'; }).length; }, 0);
    return { mangdning: obekr, forfragningar: fr + leads };
  }

  // Senast öppnade projekt, så att man hittar tillbaka.
  function senastLank() {
    var id = null;
    try { id = localStorage.getItem('bp-senast'); } catch (err) { /* ingen lagring */ }
    var p = id && BP.projekt(id);
    if (!p || location.hash.indexOf('#/projekt/' + id) === 0) return '';
    return '<a class="sida__senast" href="#/projekt/' + p.id + '">' + BP.i('klocka') + '<span><small>Fortsätt där du var</small><b>' + e(p.namn) + '</b></span></a>';
  }

  function sidomeny() {
    var r = BP.roll(), a = antal(), k = 0;
    return '<div class="sida__topp"><a class="marke" href="#/">' + BP.marke + '<b>Byggplattformen</b></a>' +
      '<a class="sida__ny" href="#/mangdning/ny" aria-label="Ny mängdning" data-tips="Ny mängdning">' + BP.i('plus') + '</a></div>' +
      '<button class="sida__sok" type="button" data-g="palett" aria-haspopup="dialog">' + BP.i('sok') + '<span>Sök eller gör något …</span><kbd>Ctrl K</kbd></button>' +
      '<nav class="nav" aria-label="Huvudmeny">' + MENY.map(function (g) {
        return (g.rubrik ? '<p class="nav__rubrik" style="--n:' + (k++) + '">' + g.rubrik + '</p>' : '') + g.poster.map(function (p) {
          var n = a[p[0]];
          return '<a href="#/' + p[0] + '" data-vy="' + p[0] + '" style="--n:' + (k++) + '">' + BP.i(p[2]) + '<span>' + p[1] + '</span>' + (n ? '<span class="nav__antal" aria-label="' + n + ' att hantera">' + n + '</span>' : '') + '</a>';
        }).join('');
      }).join('') + '</nav>' +
      '<div class="sida__fot">' + senastLank() +
        '<div class="sida__verktyg" role="group" aria-label="Genvägar">' +
          '<button class="sida__ikon" type="button" data-g="hitta-ratt" aria-label="Hitta rätt" data-tips="Hitta rätt  ?">' + BP.i('kompass') + '</button>' +
          '<a class="sida__ikon" href="konsument.html" target="_blank" rel="noopener" aria-label="Sidan för privatpersoner" data-tips="Sidan för privatpersoner">' + BP.i('extern') + '</a>' +
        '</div>' +
        '<button class="anv" type="button" data-g="byt-roll" aria-label="Byt roll, nu ' + e(r.namn) + '"><span class="avatar" style="--av:' + BP.avfarg(r.person) + '">' + BP.initialer(r.person) + '</span><span class="anv__text"><b>' + e(r.person) + ' <i class="anv__proto">prototyp</i></b><small>' + e(r.foretag ? r.foretag + ' · ' + r.namn : r.namn) + '</small></span>' + BP.i('ned') + '</button></div>';
  }

  function skal() {
    document.getElementById('app').innerHTML =
      '<aside class="sida sida--in" id="sida" aria-label="Meny">' + sidomeny() + '</aside>' +
      '<header class="topp"><button class="topp__meny" type="button" data-g="meny" aria-label="Öppna menyn" aria-controls="sida">' + BP.i('meny') + '</button>' +
        '<button class="sok" type="button" data-g="palett" aria-haspopup="dialog">' + BP.i('sok') + '<span>Sök projekt, hus, material …</span><kbd>Ctrl K</kbd></button>' +
        '<div class="topp__hoger"><span class="proto" title="All data är exempel">Prototyp · exempeldata</span></div></header>' +
      '<button class="sida-knapp" type="button" data-g="sida-dold" aria-controls="sida" aria-expanded="true" aria-label="Fäll in menyn" title="Fäll in menyn  [">' + BP.i('vanster') + '</button>' +
      '<main class="ark" id="ark" tabindex="-1"></main>' +
      '<div class="toaster" aria-live="polite"></div>';
  }

  // Markeringen i menyn är en egen bricka som glider från förra sidan till den nya.
  var markorY = null;
  function placeraMarkor(glid) {
    var nav = $('.nav'), akt = $('.nav a[aria-current="page"]');
    if (!nav) return;
    var m = $('.nav__markor', nav);
    if (!m) { m = document.createElement('i'); m.className = 'nav__markor'; m.setAttribute('aria-hidden', 'true'); nav.insertBefore(m, nav.firstChild); }
    if (!akt) { m.style.opacity = '0'; markorY = null; return; }
    var y = akt.offsetTop;
    if (glid && markorY !== null && markorY !== y && !lugnt()) {
      m.style.transition = 'none'; m.style.transform = 'translateY(' + markorY + 'px)'; void m.offsetWidth; m.style.transition = '';
    } else { m.style.transition = 'none'; void m.offsetWidth; requestAnimationFrame(function () { m.style.transition = ''; }); }
    var stil = getComputedStyle(akt);
    m.style.setProperty('--ton', stil.getPropertyValue('--ton'));
    m.style.setProperty('--tonfarg', stil.getPropertyValue('--tonfarg'));
    m.style.height = akt.offsetHeight + 'px';
    m.style.transform = 'translateY(' + y + 'px)';
    m.style.opacity = '1';
    markorY = y;
  }
  window.addEventListener('resize', function () { placeraMarkor(false); });
  function markeraMeny(vy) {
    var map = { projekt: 'projekt', mangdning: 'mangdning', ritning: 'mangdning' };
    $$('.nav a').forEach(function (a) {
      var v = a.getAttribute('data-vy');
      if (v === vy || (map[vy] && map[vy] === v)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    placeraMarkor(true);
  }

  // Sidokolumner som är kortare än innehållet bredvid följer med när man rullar. En kolumn
  // som är högre än fönstret fastnar med nederkanten i fönstret, så att inget göms.
  var KLIBBA = '.rutnat--huvud > .rutnat:last-child, .vy .rutnat:not(.rutnat--huvud) > .kort:first-child:has(> .delar), .ka-tb, .pl-listor, .ff-sido';
  function klibba(rot) {
    var satt = function () {
      $$(KLIBBA, rot).forEach(function (el) {
        var bredvid = el.parentElement && Array.prototype.some.call(el.parentElement.children, function (b) { return b !== el && b.offsetHeight > el.offsetHeight + 40; });
        el.classList.toggle('klibbig', !!bredvid && window.innerWidth > 1100);
        el.style.top = Math.min(16, window.innerHeight - el.offsetHeight - 16) + 'px';
      });
    };
    satt();
    setTimeout(satt, 600);
  }
  window.addEventListener('resize', function () { klibba($('#ark')); });

  var forraVy = null, forraAdress = null;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  function rita() {
    var a = adress();
    var fn = BP.vyer[a.vy] || BP.vyer.oversikt;
    var nyckel = a.vy + '/' + (a.del[0] || '');
    var ny = forraVy !== nyckel;
    var byte = forraAdress !== null && forraAdress !== location.hash;
    if (a.vy === 'projekt' && a.del[0]) { try { localStorage.setItem('bp-senast', a.del[0]); } catch (err) { /* ingen lagring */ } }
    var kor = function () {
      var ut = fn(a.del) || {};
      var ark = $('#ark');
      ark.innerHTML = '<div class="vy' + (ut.bred ? ' vy--bred' : '') + (ny && !byte ? ' vy--in' : '') + '">' + (ut.html || '') + '</div>';
      // Varje del av plattformen har sin pastell (samma som ikonen i menyn)
      ark.setAttribute('data-sektion', a.vy === 'ritning' ? 'mangdning' : a.vy);
      document.title = (ut.titel ? ut.titel + ' · ' : '') + 'Byggplattformen';
      if (ny) ark.scrollTop = 0;
      $('#sida').innerHTML = sidomeny();
      markeraMeny(a.vy);
      document.documentElement.classList.remove('meny-oppen');
      if (ut.efter) ut.efter(ark);
      if (BP.sidScen) BP.sidScen(ark);
      klibba(ark);
      // Kort lutar mot pekaren och det som ligger längre ned glider in när det rullas fram
      if (BP.luta) BP.luta(ark, '.vh__kort, .bk, .ko-kort, .pl-kort, .ov-snabb__kort, .pl-satt__kort, .ka-projekt a, .ov-bricka, .mh-k');
      if (BP.glidIn && ny) BP.glidIn(ark, '.vy > .sd > .kort, .vy > .sd > section:not(.sh), .ov-nedre > *, .vh, .ka-rad, .bk');
      if (ny) BP.rakna(ark);
    };
    forraVy = nyckel;
    forraAdress = location.hash;
    // Sidbyten är View Transitions: arket tonar över, delade element (projektnamnet,
    // menymarkeringen, flikmarkören) glider till sin nya plats. Inte vid omritning på
    // plats, inte med reducerad rörelse.
    if (byte && document.startViewTransition && !lugnt() && !BP.utanOvergang) {
      var vt = document.startViewTransition(kor);
      vt.finished.finally(function () { $$('[data-vt]').forEach(function (el) { el.style.viewTransitionName = ''; el.removeAttribute('data-vt'); }); });
    } else kor();
  }

  /* Tal som rullar fram: [data-rakna] räknar upp till sitt värde när en vy öppnas.
     Lika breda siffror gör att talet står still medan det räknas. */
  BP.rakna = function (rot) {
    if (lugnt()) return;
    $$('[data-rakna]', rot).forEach(function (el, n) {
      var mal = parseFloat(el.getAttribute('data-rakna'));
      if (!isFinite(mal) || mal === 0) return;
      var format = el.getAttribute('data-format') || 'tal';
      var visa = function (v) { el.textContent = format === 'kr' ? BP.kr(v) : format === 'kort' ? BP.kort(v) : M.tal(Math.round(v), 0); };
      var t0 = null, langd = 700 + Math.min(n, 6) * 40;
      visa(0);
      var steg = function (t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / langd);
        visa(mal * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(steg); else visa(mal);
      };
      requestAnimationFrame(steg);
    });
  };

  // Flikmarkören i en flikrad som inte ritas om: flytta den till vald flik och
  // låt den glida dit (FLIP, 260 ms).
  BP.glidMarkor = function (till) {
    var mark = till.parentNode.querySelector('.flikmarkor');
    if (!mark || mark.parentNode === till) return;
    var fore = mark.getBoundingClientRect();
    till.appendChild(mark);
    var efter = mark.getBoundingClientRect();
    if (lugnt() || !mark.animate) return;
    mark.animate([
      { transform: 'translateX(' + (fore.left - efter.left) + 'px) scaleX(' + (fore.width / efter.width) + ')' },
      { transform: 'none' }
    ], { duration: 260, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
  };

  // Märk ett element som ska glida till sin plats i nästa vy.
  BP.delat = function (el, namn) { if (el) { el.style.viewTransitionName = namn; el.setAttribute('data-vt', ''); } };
  BP.rita = rita;

  /* --- Händelser: data-g på vilket element som helst ---------------------------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-g]');
    if (!el) return;
    var g = BP.G[el.getAttribute('data-g')];
    if (g) { ev.preventDefault(); g(el, ev); }
  });

  BP.G.meny = function () { document.documentElement.classList.toggle('meny-oppen'); };

  // Menyn fälls in med knappen på kanten eller [ (som i Idealhus CRM och Uperformance).
  // Spalten krymper mjukt; [ växlar utan rörelse.
  function sattSida(dold, animera) {
    var rot = document.documentElement;
    rot.classList.toggle('sida-glider', !!animera && !lugnt());
    clearTimeout(sattSida.t);
    sattSida.t = setTimeout(function () { rot.classList.remove('sida-glider'); }, 480);
    rot.toggleAttribute('data-sida-dold', dold);
    var k = document.querySelector('.sida-knapp');
    if (k) { k.setAttribute('aria-expanded', String(!dold)); k.setAttribute('aria-label', dold ? 'Visa menyn' : 'Fäll in menyn'); k.title = (dold ? 'Visa menyn' : 'Fäll in menyn') + '  ['; }
    var s = document.getElementById('sida'); if (s) s.inert = dold && window.innerWidth > 860;
    try { localStorage.setItem('bp-sida-dold', dold ? '1' : ''); } catch (err) { /* ingen lagring */ }
  }
  BP.G['sida-dold'] = function () { sattSida(!document.documentElement.hasAttribute('data-sida-dold'), true); };
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '[' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, dialog, svg.lager')) return;
    ev.preventDefault(); sattSida(!document.documentElement.hasAttribute('data-sida-dold'), false);
  });
  BP.sattSida = sattSida;
  // Mobilmenyn stängs av ett klick utanför den eller med Esc.
  document.addEventListener('click', function (ev) {
    if (document.documentElement.classList.contains('meny-oppen') && !ev.target.closest('.sida, .topp__meny')) document.documentElement.classList.remove('meny-oppen');
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') document.documentElement.classList.remove('meny-oppen'); });
  BP.G['byt-roll'] = function () {
    BP.dialog({
      titel: 'Byt roll',
      kropp: '<p>Prototypen visar samma plattform från fyra håll. Välj vem du är:</p><div class="val__lista">' + D.ROLLER.map(function (r) {
        return '<button class="valknapp" type="button" data-roll="' + r.id + '" aria-pressed="' + (r.id === BP.db.roll) + '">' + e(r.namn) + '<small>' + e(r.person) + '</small></button>';
      }).join('') + '</div>',
      efter: function (d) {
        $$('[data-roll]', d).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-roll');
            if (id === 'konsument') { location.href = 'mitt.html'; return; }
            BP.db.roll = id; BP.spara(); d.close(); rita(); BP.toast('Du är nu ' + BP.roll().namn.toLowerCase(), BP.roll().person);
          });
        });
      }
    });
  };

  /* --- Meddelanden --------------------------------------------------------------- */
  BP.toast = function (rubrik, text) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = BP.i('bock') + '<span><b>' + e(rubrik) + '</b>' + (text ? '<br><span>' + e(text) + '</span>' : '') + '</span>';
    $('.toaster').appendChild(t);
    var bort = function () { t.classList.add('ut'); setTimeout(function () { t.remove(); }, 200); };
    var tid = setTimeout(bort, 3600);
    t.addEventListener('mouseenter', function () { clearTimeout(tid); });
    t.addEventListener('mouseleave', function () { tid = setTimeout(bort, 1600); });
    t.addEventListener('click', bort);
  };

  /* --- Dialog (native <dialog>, fokus och Esc sköts av webbläsaren) ---------------- */
  BP.dialog = function (o) {
    var d = document.createElement('dialog');
    d.className = 'ark-dialog';
    d.innerHTML = '<div class="dialog__huvud"><h2>' + e(o.titel) + '</h2><button class="knapp knapp--text knapp--ikon" type="button" data-stang aria-label="Stäng" style="margin-left:auto">' + BP.i('stang') + '</button></div>' +
      '<div class="dialog__kropp">' + o.kropp + '</div>' + (o.fot ? '<div class="dialog__fot">' + o.fot + '</div>' : '');
    document.body.appendChild(d);
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 250); });
    d.addEventListener('click', function (ev) { if (ev.target === d || ev.target.closest('[data-stang]')) d.close(); });
    d.showModal();
    if (o.efter) o.efter(d);
    return d;
  };

  /* --- Sökpaletten (Ctrl K) – öppnas utan rörelse ----------------------------------- */
  BP.G.palett = function () { oppnaPalett(); };
  function poster(q) {
    q = (q || '').trim().toLowerCase();
    var traff = function (t) { return !q || t.toLowerCase().indexOf(q) !== -1; };
    var ut = [];
    [['Räkna kundpris med TB', 'kalkyl', '#/kalkyl'], ['Mata in prislista', 'pris', '#/prislistor'], ['Ny mängdning', 'plus', '#/mangdning/ny'], ['Nytt projekt', 'plus', '#/mangdning/ny'], ['Hitta rätt – så hänger sidorna ihop', 'kompass', '#hitta-ratt'], ['Jämför hus', 'jamfor', '#/bibliotek']].forEach(function (x) { if (traff(x[0])) ut.push({ grupp: 'Gör', text: x[0], ikon: x[1], href: x[2] }); });
    MENY.forEach(function (g) { g.poster.forEach(function (p) { if (traff(p[1])) ut.push({ grupp: 'Gå till', text: p[1], ikon: p[2], href: '#/' + p[0], sub: BP.SIDTEXT && BP.SIDTEXT[p[0]] }); }); });
    BP.db.projekt.forEach(function (p) { if (traff(p.namn + ' ' + p.kund + ' ' + p.ort)) ut.push({ grupp: 'Projekt', text: p.namn, sub: p.kund, ikon: 'projekt', href: '#/projekt/' + p.id }); });
    D.HUS.forEach(function (h) { if (traff(h.namn + ' ' + h.kategori)) ut.push({ grupp: 'Hus', text: h.namn, sub: h.kategori + ' · ' + h.yta + ' m²', ikon: 'bibliotek', href: '#/bibliotek/' + h.id }); });
    var mat = BP.material();
    if (q) Object.keys(mat).forEach(function (id) { if (traff(mat[id].namn)) ut.push({ grupp: 'Material', text: mat[id].namn, sub: mat[id].artikel, ikon: 'recept', href: '#/recept' }); });
    return ut.slice(0, 40);
  }
  function oppnaPalett() {
    if ($('.palett-bakgrund')) return;
    var bak = document.createElement('div');
    bak.className = 'palett-bakgrund';
    bak.innerHTML = '<div class="palett" role="dialog" aria-modal="true" aria-label="Sök"><input type="text" placeholder="Sök projekt, hus, material …" aria-label="Sök" autocomplete="off"><ul role="listbox"></ul></div>';
    document.body.appendChild(bak);
    var inp = $('input', bak), ul = $('ul', bak), val = 0, lista = [];
    var visa = function () {
      lista = poster(inp.value);
      var g = null;
      ul.innerHTML = lista.length ? lista.map(function (p, n) {
        var rubrik = p.grupp !== g ? '<li class="palett__grupp" role="presentation">' + e(p.grupp) + '</li>' : '';
        g = p.grupp;
        return rubrik + '<li role="presentation"><a role="option" href="' + p.href + '" aria-selected="' + (n === val) + '" data-n="' + n + '">' + BP.i(p.ikon) + e(p.text) + (p.sub ? '<small>' + e(p.sub) + '</small>' : '') + '</a></li>';
      }).join('') : '<li class="palett__grupp">Inget hittades för "' + e(inp.value) + '"</li>';
    };
    var stang = function () { bak.remove(); document.removeEventListener('keydown', tangent, true); };
    var tangent = function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); stang(); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); val = Math.max(0, Math.min(lista.length - 1, val + (ev.key === 'ArrowDown' ? 1 : -1))); visa(); var s = $('[aria-selected="true"]', ul); if (s) s.scrollIntoView({ block: 'nearest' }); }
      else if (ev.key === 'Enter' && lista[val]) { ev.preventDefault(); stang(); if (lista[val].href === '#hitta-ratt') BP.G['hitta-ratt'](); else BP.ga(lista[val].href); }
    };
    inp.addEventListener('input', function () { val = 0; visa(); });
    bak.addEventListener('click', function (ev) { var l = ev.target.closest('a'); if (ev.target === bak) stang(); else if (l) { stang(); if (l.getAttribute('href') === '#hitta-ratt') { ev.preventDefault(); BP.G['hitta-ratt'](); } } });
    document.addEventListener('keydown', tangent, true);
    visa(); inp.focus();
  }
  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); oppnaPalett(); }
  });

  /* --- Start ---------------------------------------------------------------------- */
  BP.starta = function () {
    BP.spara();
    skal();
    try { if (localStorage.getItem('bp-sida-dold') === '1') sattSida(true, false); } catch (err) { /* ingen lagring */ }
    window.addEventListener('hashchange', rita);
    rita();
    // Menyns intåg spelas en gång; sedan ritas den om utan rörelse.
    setTimeout(function () { var sd = $('#sida'); if (sd) sd.classList.remove('sida--in'); }, 900);
  };
})();
