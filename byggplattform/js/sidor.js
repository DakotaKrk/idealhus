/* Byggplattformen – sidorna i nytt skick.
   Ett gemensamt sidhuvud (mörk skyltplåt): "du är här", vad sidan är till
   för, nyckeltal och var sidan ligger i flödet Välj hus → Mängda → Kundens
   val → Offert och order. Längst ned "Vart härnäst?". Guiden Hitta rätt
   (knappen i menyn eller ?). Smarta funktioner: nästa åtgärd per projekt,
   tavla, sök och sortering; jämför hus och attefallskoll; vad kunderna
   väljer; förfrågningar efter hur bråttom de är och svaren jämförda;
   konsulter per projekt; prisändringar som visar sin påverkan direkt.
   Rörelse: plåten avtäcks, orden stiger fram, innehållet kommer i takt och
   korten lutar mot musen. Bara vid nytt sidbesök, aldrig vid reducerad rörelse. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  var FLODE = [
    { vy: 'bibliotek', namn: 'Välj hus', text: 'Börja från en husmodell i 3D', emoji: '🏡' },
    { vy: 'mangdning', namn: 'Mängda', text: 'Räkna och bekräfta materialet', emoji: '📏' },
    { vy: 'tillval', namn: 'Kundens val', text: 'Färg, tak och altan i 3D', emoji: '🎨' },
    { vy: 'forfragningar', namn: 'Offert och order', text: 'Jämför svaren och lägg order', emoji: '🤝' }
  ];
  var SIDNAMN = { oversikt: 'Översikt', projekt: 'Projekt', mangdning: 'Mängdning', bibliotek: 'Bibliotek', tillval: 'Tillval', forfragningar: 'Förfrågningar', konsulter: 'Konsulter', recept: 'Recept och material', prislistor: 'Prislistor', kalkyl: 'Kalkyl och offert' };
  BP.SIDTEXT = {
    oversikt: 'Dagen i korthet och vad som väntar',
    projekt: 'Alla projekt och nästa steg i varje',
    mangdning: 'Räkna materialet ur ett hus eller en ritning',
    bibliotek: 'Husmodellerna i 3D – jämför och starta här',
    tillval: 'Det kunderna valt och vad de brukar välja',
    forfragningar: 'Kunder som hört av sig och svar från partner',
    konsulter: 'Beställ arkitekt, konstruktion, energi och KA',
    recept: 'Hur byggdelarna räknas och vad materialet kostar',
    prislistor: 'Leverantörernas prislistor – mata in och använd',
    kalkyl: 'Nettokalkyl, ditt TB och kundpriset – skapa offerten'
  };
  var GRUPP = { tillval: 'Kund och partner', forfragningar: 'Kund och partner', konsulter: 'Kund och partner', recept: 'Underlag', prislistor: 'Underlag' };
  var STEGID = ['underlag', 'mangd', 'offert', 'order'];
  var EMOJI = { oversikt: '🏠', projekt: '🏗️', mangdning: '📏', bibliotek: '🏡', tillval: '🎨', forfragningar: '💬', konsulter: '👷', recept: '🧾', prislistor: '🏷️', kalkyl: '🧮' };
  var em = function (t, klass) { return '<span class="emoji' + (klass ? ' ' + klass : '') + '" aria-hidden="true">' + t + '</span>'; };
  var STEGNAMN = { underlag: 'Underlag', mangd: 'Mängd', offert: 'Offert', order: 'Order' };

  // Rörelsen spelas när man kommer till en sida, inte när den ritas om på plats.
  var andrad = true;
  window.addEventListener('hashchange', function () { andrad = true; });
  function forst() { var a = andrad && !lugnt(); andrad = false; return a; }

  /* --- Småhjälpare ------------------------------------------------------------ */
  function obekr(p) { return BP.delarFor(p).filter(function (d) { return d.bekraftad === false; }).length; }
  function senast(p) { return (p.handelser[0] || {}).tid || p.skapad; }
  function dagarSedan(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso)) / 864e5)); }
  function husSumma(h) { return M.mangda(M.delarForHus(h).delar, BP.recept(), BP.material()).summa; }
  function attefall(h) {
    var area = h.langd * h.bredd;
    return { area: area, ok: area <= 30.05 && h.nock <= 4.0 };
  }
  function sd(anim, html) { return '<div class="sd' + (anim ? ' sd--in' : '') + '">' + html + '</div>'; }
  function lista(rader, fn) { return rader.map(fn).join(''); }

  /* --- Så funkar sidan: tre steg per sida, fälls ihop och minns det ---------------- */
  var GUIDE = {
    projekt: [['🔎', 'Hitta projektet', 'Sök eller filtrera på var det står'], ['👉', 'Se nästa steg', 'Knappen på raden visar vad som väntar'], ['🏗️', 'Öppna projektrummet', 'Mängd, ritning, tillval och händelser']],
    mangdning: [['📏', 'Starta en mängdning', 'Ur ett hus, en ritning eller snabbmängd'], ['🚧', 'Bekräfta byggdelarna', 'Det obekräftade är avspärrat'], ['✅', 'Godkänn mängden', 'Sedan räknar du kundpris']],
    bibliotek: [['🏡', 'Bläddra bland husen', 'Riktiga mått, i 3D'], ['⚖️', 'Jämför', 'Bocka i två eller tre hus'], ['📏', 'Mängda direkt', 'Materialet räknas ur modellen']],
    tillval: [['🎨', 'Se vad kunderna valt', 'Färg, tak, altan och insida'], ['💰', 'Vad valen kostar', 'Över eller under grundpriset'], ['📊', 'Vad som är populärt', 'Andelar per val']],
    forfragningar: [['💬', 'Kunder som hört av sig', 'Det som brådskar ligger överst'], ['⚖️', 'Jämför svaren', 'Partnernas pris mot listpris'], ['🤝', 'Välj och lägg order', 'Svaret blir en order']],
    konsulter: [['👷', 'Välj tjänst', 'Arkitekt, konstruktion, energi eller KA'], ['🔗', 'Koppla till projektet', 'Modell och mängd följer med'], ['📨', 'Beställ', 'Status syns här']],
    recept: [['🧱', 'Välj byggdel', 'Väggar, bjälklag, tak och grund'], ['🔍', 'Se hur det räknas', 'Varje rad visar sin regel'], ['✏️', 'Ändra pris eller recept', 'Alla projekt räknas om direkt']],
    prislistor: [['📋', 'Mata in listan', 'Klistra in, ladda upp eller skriv in'], ['🔗', 'Kolla kopplingarna', 'Artikelnummer och namn matchas'], ['✅', 'Använd listan', 'Den blir nettot i kalkylen']],
    kalkyl: [['🏠', 'Välj projekt', 'Nettot räknas ur mängden'], ['🎯', 'Klicka i ditt TB', 'Kundpriset räknas direkt'], ['📄', 'Skapa offert', 'Klar att skriva ut eller spara som PDF']]
  };
  function guideDold(vy) { try { return localStorage.getItem('bp-guide-' + vy) === 'dold'; } catch (err) { return false; } }
  function guide(vy) {
    var g = GUIDE[vy]; if (!g) return '';
    return '<ol class="sh-guide" id="sh-guide"' + (guideDold(vy) ? ' hidden' : '') + '>' + g.map(function (x, n) {
      return '<li style="--g:' + n + '"><span class="sh-guide__nr">' + (n + 1) + '</span>' + em(x[0], 'sh-guide__emoji') + '<span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></li>';
    }).join('') + '</ol>';
  }
  G['sh-guide'] = function (el) {
    var g = $('#sh-guide'), vy = el.getAttribute('data-vy');
    if (!g) return;
    g.hidden = !g.hidden;
    el.setAttribute('aria-expanded', String(!g.hidden));
    try { localStorage.setItem('bp-guide-' + vy, g.hidden ? 'dold' : 'visad'); } catch (err) { /* ingen lagring */ }
  };

  /* --- Huset i sidhuvudet: varje sida visar det som sidan handlar om ------------------ */
  var SCEN = {
    projekt: { isar: 0 },
    mangdning: { isar: 0.5, lager: true },
    bibliotek: { husen: true },
    tillval: { fasad: true },
    forfragningar: { isar: 0 },
    konsulter: { lager: ['Grund', 'Stomme', 'Isolering'], isar: 0.35 },
    recept: { isar: 0.62, lager: true }
  };
  function scenHus() {
    var p = BP.db.projekt.filter(function (x) { return x.hus && BP.hus(x.hus); })[0];
    return p ? BP.hus(p.hus) : D.HUS[0];
  }
  function sidScen(vy) {
    var c = SCEN[vy]; if (!c || !BP.hus3d) return '';
    var h = scenHus();
    return '<div class="sh__scen" data-scen="' + vy + '">' + BP.hus3d.html(h, { etikett: c.husen ? e(h.namn) : c.fasad ? e((FASAD[0] || [''])[0]) : c.lager ? '&nbsp;' : '' }) + '</div>';
  }
  var FASAD = D.TILLVAL[0].val.filter(function (v) { return v.farg; }).map(function (v) { return [v.namn, v.farg]; });
  BP.sidScen = function (rot) {
    var el = $('.sh__scen', rot); if (!el) return;
    var c = SCEN[el.getAttribute('data-scen')] || {};
    var h3 = $('.h3d', el), etikett = $('.h3d__etikett', el);
    var api = BP.hus3d.koppla(h3, { isar: c.isar || 0, marg: 1.02 });
    var n = 0, steg = null;
    if (c.lager) {
      var grupper = c.lager === true ? ['Grund', 'Stomme', 'Isolering', 'Fasad', 'Fönster och dörrar', 'Tak'] : c.lager;
      steg = function () { var g = grupper[n++ % grupper.length]; api.markera(g); if (etikett) etikett.textContent = g; };
    } else if (c.husen) {
      steg = function () { var h = D.HUS[++n % D.HUS.length]; api.byt(h); if (etikett) etikett.textContent = h.namn; };
    } else if (c.fasad) {
      steg = function () { var f = FASAD[++n % FASAD.length]; api.fasad(f[1]); if (etikett) etikett.textContent = f[0]; };
    }
    if (!steg || lugnt()) return;
    var tid = setInterval(function () { if (!document.body.contains(el)) { clearInterval(tid); return; } if (!el.matches(':hover')) steg(); }, c.husen ? 5200 : 2600);
    setTimeout(steg, 1400);
  };

  /* --- Sidhuvudet --------------------------------------------------------------- */
  function sidhuvud(o) {
    var steg = -1;
    FLODE.forEach(function (f, n) { if (f.vy === o.vy) steg = n; });
    var smula = '<a href="#/">Översikt</a>' + (GRUPP[o.vy] ? i('hoger') + '<span>' + GRUPP[o.vy] + '</span>' : '') + (o.foralder ? i('hoger') + '<a href="' + o.foralder[1] + '">' + o.foralder[0] + '</a>' : '') +
      i('hoger') + '<b aria-current="page">' + e(o.titel) + '</b>';
    var scen = o.foralder ? '' : sidScen(o.vy), knappar = o.knappar ? '<div class="sh__knappar">' + o.knappar + '</div>' : '';
    var guideKnapp = GUIDE[o.vy] ? '<button class="sh__hjalp" type="button" data-g="sh-guide" data-vy="' + o.vy + '" aria-controls="sh-guide" aria-expanded="' + !guideDold(o.vy) + '">' + i('info') + 'Så funkar sidan</button>' : '';
    return '<section class="sh' + (scen ? ' sh--scen' : '') + '" aria-labelledby="sh-rubrik">' +
      '<div class="sh__topp"><nav class="sh__smula" aria-label="Du är här">' + smula + '</nav>' + guideKnapp + (steg >= 0 ? flodet(steg) : '') + '</div>' +
      '<div class="sh__rad"><div class="sh__text"><div class="sh__titel">' + (EMOJI[o.vy] ? em(EMOJI[o.vy], 'sh__emoji') : '') + '<h1 id="sh-rubrik">' + o.titel.split(' ').map(function (w, n) {
          return '<span class="sh-mask"><span class="sh-ord" style="--o:' + n + '">' + e(w) + '</span></span>';
        }).join(' ') + '</h1></div><p>' + o.under + '</p>' + (scen ? knappar : '') + '</div>' +
        (scen || knappar) + '</div>' + guide(o.vy) +
      (o.kpi ? '<div class="sh__kpier" style="--n:' + o.kpi.length + '">' + o.kpi.map(function (k, n) {
        return '<div class="sh-kpi" style="--k:' + n + '"><small>' + e(k.namn) + '</small><b>' +
          (k.rakna != null ? '<span data-rakna="' + Math.round(k.rakna) + '"' + (k.format ? ' data-format="' + k.format + '"' : '') + '>' + k.varde + '</span>' : k.varde) +
          '</b>' + (k.under ? '<span>' + e(k.under) + '</span>' : '') + '</div>';
      }).join('') + '</div>' : '') +
    '</section>';
  }

  BP.sidhuvud = sidhuvud;
  BP.sdOmslag = function (html) { return sd(forst(), html); };

  function flodet(steg) {
    return '<ol class="sh__flode" aria-label="Flödet, steg ' + (steg + 1) + ' av ' + FLODE.length + '">' + FLODE.map(function (f, n) {
      return '<li' + (n === steg ? ' class="nu"' : '') + '><a href="#/' + f.vy + '"' + (n === steg ? ' aria-current="step"' : '') + ' title="' + e(f.text) + '"><i>' + (n + 1) + '</i><span>' + f.namn + '</span></a></li>';
    }).join('') + '</ol>';
  }

  function harnast(rader) {
    return '<nav class="vh sd-steg" style="--i:6" aria-labelledby="vh-rubrik"><h2 id="vh-rubrik">Vart härnäst?</h2><div class="vh__lista">' + lista(rader, function (x) {
      return '<a class="vh__kort" href="' + x.href + '" data-sektion="' + ((x.href.match(/#\/(\w+)/) || [])[1] || '') + '">' + em(x.emoji, 'vh__ikon') + '<span class="vh__text"><b>' + e(x.titel) + '</b><small>' + e(x.text) + '</small></span>' + i('pil', 'vh__pil') + '</a>';
    }) + '</div></nav>';
  }
  var VART = {
    bibliotek: { titel: 'Bibliotek', text: 'Välj ett hus och mängda det', ikon: 'bibliotek', emoji: '🏡', href: '#/bibliotek' },
    mangdning: { titel: 'Mängdning', text: 'Räkna och bekräfta materialet', ikon: 'mangd', emoji: '📏', href: '#/mangdning' },
    tillval: { titel: 'Tillval', text: 'Låt kunden välja i 3D', ikon: 'tillval', emoji: '🎨', href: '#/tillval' },
    forfragningar: { titel: 'Förfrågningar', text: 'Svara kunder och jämför priser', ikon: 'forfragan', emoji: '💬', href: '#/forfragningar' },
    projekt: { titel: 'Projekt', text: 'Se var alla projekt står', ikon: 'projekt', emoji: '🏗️', href: '#/projekt' },
    konsulter: { titel: 'Konsulter', text: 'Beställ hjälp till ett projekt', ikon: 'konsult', emoji: '👷', href: '#/konsulter' },
    recept: { titel: 'Recept och material', text: 'Justera priser och recept', ikon: 'recept', emoji: '🧾', href: '#/recept' },
    prislistor: { titel: 'Prislistor', text: 'Mata in leverantörens priser', ikon: 'pris', emoji: '🏷️', href: '#/prislistor' }
  };
  function vart() { return harnast(Array.prototype.slice.call(arguments).map(function (k) { return VART[k]; })); }

  /* --- Rörelse: kort som lutar mot musen och en glans som följer den ------------- */
  function koppla(rot) {
    if (lugnt()) return;
    $$('.tilt', rot).forEach(function (k) {
      k.addEventListener('pointermove', function (ev) {
        if (ev.pointerType !== 'mouse') return;
        var r = k.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        k.style.setProperty('--ry', ((x - 0.5) * 5).toFixed(2) + 'deg');
        k.style.setProperty('--rx', ((0.5 - y) * 4).toFixed(2) + 'deg');
        k.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        k.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      k.addEventListener('pointerleave', function () { k.style.removeProperty('--rx'); k.style.removeProperty('--ry'); });
    });
  }

  // FLIP: korten glider till sina nya platser när man filtrerar eller sorterar.
  function flip(beh, andra) {
    var fore = $$(':scope > *', beh).map(function (k) { return [k, k.hidden ? null : k.getBoundingClientRect()]; });
    andra();
    if (lugnt() || !Element.prototype.animate) return;
    fore.forEach(function (x) {
      var k = x[0], f = x[1];
      if (k.hidden) return;
      var r = k.getBoundingClientRect();
      if (!f) { k.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); return; }
      var dx = f.left - r.left, dy = f.top - r.top;
      if (dx || dy) k.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    });
  }

  /* --- Hitta rätt --------------------------------------------------------------------- */
  G['hitta-ratt'] = function () {
    if ($('dialog[open]')) return;
    var d = BP.dialog({
      titel: 'Hitta rätt',
      kropp: '<p class="hr-intro">Plattformen följer ett hus från idé till order. Det sker i fyra steg, och siffrorna högst upp på varje sida visar var du är.</p>' +
        '<ol class="hr-flode">' + FLODE.map(function (f, n) {
          return '<li><a href="#/' + f.vy + '" data-stang><i class="emoji" aria-hidden="true">' + f.emoji + '</i><b>' + (n + 1) + '. ' + f.namn + '</b><small>' + f.text + '</small><span>' + SIDNAMN[f.vy] + i('pil') + '</span></a></li>';
        }).join('') + '</ol>' +
        '<h3 class="hr-rubrik">Runt omkring</h3><div class="hr-ovrigt">' + ['oversikt', 'projekt', 'konsulter', 'recept'].map(function (v) {
          return '<a href="#/' + (v === 'oversikt' ? '' : v) + '" data-stang><b>' + SIDNAMN[v] + '</b><small>' + BP.SIDTEXT[v] + '</small>' + i('hoger') + '</a>';
        }).join('') + '</div>' +
        '<p class="hr-tips"><kbd>Ctrl K</kbd> söker överallt <span>·</span> <kbd>[</kbd> fäller in menyn <span>·</span> <kbd>?</kbd> öppnar guiden</p>'
    });
    d.classList.add('dialog--bred');
  };
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '?' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]')) return;
    ev.preventDefault(); G['hitta-ratt']();
  });

  /* ===== Projekt ===================================================================== */
  var pv = { q: '', steg: 'alla', vy: 'lista', sort: 'aktivitet' };

  // Nästa åtgärd i projektet, räknad ur dess läge.
  function nasta(p) {
    var ob = obekr(p), bas = '#/projekt/' + p.id + '/';
    if (p.underlag === 'ritning' && p.ritning && !p.ritning.skala) return { text: 'Sätt skalan', href: bas + 'ritning', ikon: 'linjal', typ: 'tejp', gora: true, vikt: 3 };
    if (p.steg === 'underlag') return { text: 'Rita av ritningen', href: bas + 'ritning', ikon: 'ritning', typ: '', gora: true, vikt: 2 };
    if (ob) return { text: 'Bekräfta ' + ob + (ob === 1 ? ' del' : ' delar'), href: bas + 'mangd', ikon: 'mangd', typ: 'tejp', gora: true, vikt: 3 };
    if (p.steg === 'mangd') return { text: 'Godkänn mängden', href: bas + 'mangd', ikon: 'bock', typ: '', gora: true, vikt: 2 };
    if (p.steg === 'offert') {
      var svar = p.forfragningar.filter(function (f) { return f.status === 'svar'; }).length;
      if (!p.forfragningar.length) return { text: 'Skicka förfrågan', href: bas + 'forfragningar', ikon: 'skicka', typ: '', gora: true, vikt: 2 };
      if (!svar) return { text: 'Väntar på svar', href: bas + 'forfragningar', ikon: 'klocka', typ: 'vanta', gora: false, vikt: 1 };
      return { text: 'Välj bland ' + svar + (svar === 1 ? ' svar' : ' svar'), href: bas + 'forfragningar', ikon: 'skicka', typ: '', gora: true, vikt: 2 };
    }
    return { text: 'Order lagd', href: bas + 'handelser', ikon: 'bock', typ: 'klar', gora: false, vikt: 0 };
  }

  BP.nastaAtgard = nasta;

  function projektRader() {
    return BP.db.projekt.map(function (p) {
      var m = BP.mangdFor(p);
      return { p: p, h: BP.hus(p.hus), m: m, varde: m.summa + BP.tillvalSumma(p), n: nasta(p), sen: senast(p) };
    });
  }

  var gammalProjekt = BP.vyer.projekt;
  BP.vyer.projekt = function (del) {
    if (del[0]) return gammalProjekt(del);
    var anim = forst(), rader = projektRader();
    var per = {};
    STEGID.forEach(function (s) { per[s] = rader.filter(function (x) { return x.p.steg === s; }).length; });
    var offert = rader.filter(function (x) { return x.p.steg === 'offert'; }).reduce(function (t, x) { return t + x.varde; }, 0);
    var gora = rader.filter(function (x) { return x.n.gora; }).length;
    var stilla = rader.filter(function (x) { return x.p.steg !== 'order' && dagarSedan(x.sen) > 7; }).length;

    var html = sidhuvud({
      vy: 'projekt', titel: 'Projekt',
      under: 'Varje projekt går från underlag till order. Här ser du var alla står – och vad nästa steg är i vart och ett.',
      knappar: '<a class="knapp knapp--gul" href="#/mangdning/ny">' + i('plus') + 'Nytt projekt</a>',
      kpi: [
        { namn: 'Projekt', rakna: rader.length, varde: rader.length, under: per.order + ' med order lagd' },
        { namn: 'Väntar på dig', rakna: gora, varde: gora, under: 'projekt där nästa steg är ditt' },
        { namn: 'Ute på offert', rakna: offert, format: 'kort', varde: BP.kort(offert), under: 'material + tillval, exempelpriser' },
        { namn: 'Stilla', rakna: stilla, varde: stilla, under: 'ingen händelse på över 7 dagar' }
      ]
    }) +
    '<div class="pl-verktyg sd-steg" style="--i:0">' +
      '<label class="pl-sok">' + i('sok') + '<input type="search" id="pl-q" placeholder="Sök projekt, kund eller ort" value="' + e(pv.q) + '" aria-label="Sök bland projekten" autocomplete="off"></label>' +
      '<div class="pl-filter" role="group" aria-label="Visa projekt i steg">' + [['alla', 'Alla', rader.length]].concat(STEGID.map(function (s) { return [s, STEGNAMN[s], per[s]]; })).map(function (b) {
        return '<button type="button" data-plsteg="' + b[0] + '" aria-pressed="' + (pv.steg === b[0]) + '">' + b[1] + '<span>' + b[2] + '</span></button>';
      }).join('') + '</div>' +
      '<label class="pl-sort">' + i('sortera') + '<span class="dold">Sortera</span><select id="pl-sort">' + [['aktivitet', 'Senast händelse'], ['atgard', 'Mest att göra'], ['varde', 'Störst värde'], ['namn', 'Namn A–Ö']].map(function (o) {
        return '<option value="' + o[0] + '"' + (pv.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      '<div class="pl-vy" role="group" aria-label="Visning"><button type="button" data-plvy="lista" aria-pressed="' + (pv.vy === 'lista') + '">' + i('meny') + 'Lista</button><button type="button" data-plvy="tavla" aria-pressed="' + (pv.vy === 'tavla') + '">' + i('tavla') + 'Tavla</button></div>' +
    '</div>' +
    '<div id="pl-yta" class="sd-steg" style="--i:1">' + projektYta(rader) + '</div>' +
    vart('mangdning', 'forfragningar', 'bibliotek');

    return {
      titel: 'Projekt', html: sd(anim, html),
      efter: function (rot) {
        var yta = $('#pl-yta', rot);
        var om = function () { yta.innerHTML = projektYta(projektRader()); yta.classList.remove('pl-ny'); void yta.offsetWidth; yta.classList.add('pl-ny'); };
        $('#pl-q', rot).addEventListener('input', function (ev) { pv.q = ev.target.value; om(); });
        $('#pl-sort', rot).addEventListener('change', function (ev) { pv.sort = ev.target.value; om(); });
        $$('[data-plsteg]', rot).forEach(function (b) {
          b.addEventListener('click', function () { pv.steg = b.getAttribute('data-plsteg'); $$('[data-plsteg]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); om(); });
        });
        $$('[data-plvy]', rot).forEach(function (b) {
          b.addEventListener('click', function () { pv.vy = b.getAttribute('data-plvy'); $$('[data-plvy]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); om(); });
        });
        // Projektnamnet glider upp och blir skyltens rubrik i projektrummet.
        yta.addEventListener('click', function (ev) {
          var a = ev.target.closest('.pl-lank');
          if (a) BP.delat(a, 'projekt-namn');
        });
        G['pl-rensa'] = function () { pv.q = ''; pv.steg = 'alla'; $('#pl-q', rot).value = ''; $$('[data-plsteg]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-plsteg') === 'alla')); }); om(); };
      }
    };
  };

  function projektYta(rader) {
    var q = pv.q.trim().toLowerCase();
    var urval = rader.filter(function (x) {
      return (pv.steg === 'alla' || x.p.steg === pv.steg) && (!q || (x.p.namn + ' ' + x.p.kund + ' ' + x.p.ort + ' ' + (x.h ? x.h.namn : '')).toLowerCase().indexOf(q) !== -1);
    });
    var sort = {
      aktivitet: function (a, b) { return a.sen < b.sen ? 1 : -1; },
      atgard: function (a, b) { return b.n.vikt - a.n.vikt || (a.sen < b.sen ? 1 : -1); },
      varde: function (a, b) { return b.varde - a.varde; },
      namn: function (a, b) { return a.p.namn.localeCompare(b.p.namn, 'sv'); }
    }[pv.sort];
    urval.sort(sort);
    if (!urval.length) return '<div class="pl-tomt"><b>Inga projekt matchar</b><span>Prova ett annat ord eller visa alla steg.</span><button class="knapp" type="button" data-g="pl-rensa">Visa alla projekt</button></div>';
    if (pv.vy === 'tavla') {
      return '<div class="pl-tavla">' + STEGID.map(function (s) {
        var kol = urval.filter(function (x) { return x.p.steg === s; });
        var sum = kol.reduce(function (t, x) { return t + (x.m.rader.length ? x.varde : 0); }, 0);
        return '<section class="pl-kol" aria-label="' + STEGNAMN[s] + '"><header class="pl-kol__huvud"><b>' + STEGNAMN[s] + '</b><span>' + kol.length + '</span>' + (sum ? '<small>' + BP.kort(sum) + '</small>' : '') + '</header>' +
          (kol.length ? lista(kol, function (x, n) {
            return '<article class="pl-kort" style="--n:' + n + '">' + (x.h ? '<img src="' + x.h.bild + '" alt="" loading="lazy" decoding="async">' : '<span class="pl-kort__rit">' + i('ritning') + 'Egen ritning</span>') +
              '<a class="pl-lank" href="#/projekt/' + x.p.id + '">' + e(x.p.namn) + '</a><small>' + e(x.p.kund) + (x.m.rader.length ? ' · ' + BP.kort(x.varde) : '') + '</small>' + nastaKnapp(x.n) + '</article>';
          }) : '<p class="pl-kol__tom">Inget här just nu</p>') + '</section>';
      }).join('') + '</div>';
    }
    return '<div class="pl-lista" role="list">' + lista(urval, function (x, n) {
      var idx = STEGID.indexOf(x.p.steg), dagar = dagarSedan(x.sen), stilla = x.p.steg !== 'order' && dagar > 7;
      return '<div class="pl-rad" role="listitem" style="--n:' + n + '">' +
        '<span class="pl-bild">' + (x.h ? '<img src="' + x.h.bild + '" alt="" loading="lazy" decoding="async">' : i('ritning')) + '</span>' +
        '<span class="pl-namn"><a class="pl-lank" href="#/projekt/' + x.p.id + '">' + e(x.p.namn) + '</a><small>' + e(x.p.kund) + (x.p.ort ? ' · ' + e(x.p.ort) : '') + '</small></span>' +
        '<span class="pl-steg" aria-label="Steg: ' + STEGNAMN[x.p.steg] + '"><span class="pl-steg__bar">' + STEGID.map(function (s, k) { return '<i class="' + (k < idx ? 'klar' : k === idx ? 'nu' : '') + '"></i>'; }).join('') + '</span><small>' + STEGNAMN[x.p.steg] + (x.h ? ' · ' + e(x.h.namn) : ' · egen ritning') + '</small></span>' +
        '<span class="pl-nastacell">' + nastaKnapp(x.n) + '</span>' +
        '<span class="pl-varde">' + (x.m.rader.length ? BP.kr(x.varde) : '–') + '<small>' + (x.m.rader.length ? 'material + tillval' : 'ingen mängd än') + '</small></span>' +
        '<span class="pl-sen' + (stilla ? ' pl-sen--stilla' : '') + '">' + (stilla ? 'Stilla i ' + dagar + ' dagar' : BP.sedan(x.sen)) + '<small>' + e((x.p.handelser[0] || {}).text || '') + '</small></span>' +
      '</div>';
    }) + '</div>';
  }

  function nastaKnapp(n) {
    return '<a class="pl-nasta' + (n.typ ? ' pl-nasta--' + n.typ : '') + '" href="' + n.href + '">' + i(n.ikon) + '<span>' + e(n.text) + '</span></a>';
  }

  /* ===== Bibliotek ======================================================================= */
  var bv = { kat: 'Alla', sort: 'standard', jamfor: [] };
  var gammalBibl = BP.vyer.bibliotek;
  BP.vyer.bibliotek = function (del) {
    if (del[0]) return gammalBibl(del);
    var anim = forst();
    var hus = D.HUS.map(function (h, n) { return { h: h, n: n, summa: husSumma(h), af: attefall(h) }; });
    var kat = ['Alla'].concat(D.HUS.map(function (h) { return h.kategori; }).filter(function (k, n, a) { return a.indexOf(k) === n; }));
    var billigast = hus.reduce(function (a, b) { return a.summa / a.h.yta < b.summa / b.h.yta ? a : b; });
    var html = sidhuvud({
      vy: 'bibliotek', titel: 'Bibliotek',
      under: 'Husmodellerna i 3D med riktiga mått. Jämför dem, se vilka som håller sig inom attefallsmåtten och mängda direkt ur modellen.',
      kpi: [
        { namn: 'Husmodeller', rakna: hus.length, varde: hus.length, under: kat.slice(1).map(function (k) { return D.HUS.filter(function (h) { return h.kategori === k; }).length + ' ' + k.toLowerCase(); }).join(' · ') },
        { namn: 'Inom attefallsmåtten', rakna: hus.filter(function (x) { return x.af.ok; }).length, varde: hus.filter(function (x) { return x.af.ok; }).length, under: 'byggarea högst 30 m², nock högst 4 m' },
        { namn: 'Lägst material per m²', rakna: billigast.summa / billigast.h.yta, format: 'kr', varde: BP.kr(billigast.summa / billigast.h.yta), under: billigast.h.namn + ' · exempelpriser' },
        { namn: 'Största boyta', rakna: Math.max.apply(null, D.HUS.map(function (h) { return h.yta; })), varde: Math.max.apply(null, D.HUS.map(function (h) { return h.yta; })), under: 'm² · ' + hus.filter(function (x) { return x.h.yta === Math.max.apply(null, D.HUS.map(function (h) { return h.yta; })); })[0].h.namn }
      ]
    }) +
    '<div class="pl-verktyg sd-steg" style="--i:0">' +
      '<div class="pl-filter" role="group" aria-label="Kategori">' + kat.map(function (k) {
        return '<button type="button" data-bkat="' + e(k) + '" aria-pressed="' + (bv.kat === k) + '">' + k + '<span>' + (k === 'Alla' ? D.HUS.length : D.HUS.filter(function (h) { return h.kategori === k; }).length) + '</span></button>';
      }).join('') + '</div>' +
      '<label class="pl-sort">' + i('sortera') + '<span class="dold">Sortera</span><select id="bk-sort">' + [['standard', 'Som i katalogen'], ['yta', 'Störst boyta'], ['kvm', 'Lägst material per m²'], ['summa', 'Lägst material totalt']].map(function (o) {
        return '<option value="' + o[0] + '"' + (bv.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      '<p class="pl-tips">' + i('jamfor') + 'Bocka i <b>Jämför</b> på två eller tre hus</p>' +
    '</div>' +
    '<div class="bk-nat" id="bk-nat">' + lista(hus, function (x) {
      var h = x.h;
      return '<article class="bk tilt sd-steg" style="--i:' + (x.n + 1) + '" data-hus="' + h.id + '" data-kat="' + e(h.kategori) + '">' +
        '<a class="bk__bild" href="#/bibliotek/' + h.id + '" tabindex="-1" aria-hidden="true"><img src="' + h.bild + '" alt="" loading="lazy" decoding="async"><span class="bk__glans"></span></a>' +
        '<div class="bk__text">' +
          '<div class="bk__rad"><h3><a href="#/bibliotek/' + h.id + '">' + e(h.namn) + '</a></h3><span class="chip">' + (h.kategori === 'Attefallshus' ? '🌲 ' : '🏕️ ') + e(h.kategori) + '</span></div>' +
          '<div class="bk__fakta"><span><b>' + h.yta + '</b> m²</span><span><b>' + h.rum + '</b> rum</span><span><b>' + BP.tal(h.langd) + ' × ' + BP.tal(h.bredd) + '</b> m</span><span>nock <b>' + BP.tal(h.nock) + '</b> m</span></div>' +
          '<span class="bk__attefall ' + (x.af.ok ? 'ok' : 'over') + '" title="Byggarean (yttermåtten ' + BP.tal(h.langd) + ' × ' + BP.tal(h.bredd) + ' m ≈ ' + BP.tal(x.af.area, 1) + ' m²) och nockhöjden jämförs med 30 m² och 4,0 m. Kontrollera alltid med kommunen.">' + i(x.af.ok ? 'bock' : 'info') + (x.af.ok ? 'Inom attefallsmåtten' : 'Större än ett attefallshus') + '</span>' +
          '<div class="bk__mangd"><span><small>Material, exempelpriser</small><b>' + BP.kort(x.summa) + '</b></span><span class="bk__kvm">' + BP.kr(x.summa / h.yta) + '<small>per m²</small></span></div>' +
          '<div class="bk__knappar"><button class="knapp knapp--primar knapp--liten" type="button" data-g="hus-mangd" data-hus="' + h.id + '">' + i('mangd') + 'Mängda</button>' +
            '<button class="knapp knapp--liten" type="button" data-g="hus-tillval" data-hus="' + h.id + '">' + i('tillval') + 'Tillval</button>' +
            '<label class="bk__jamfor"><input type="checkbox" data-jamfor="' + h.id + '"' + (bv.jamfor.indexOf(h.id) !== -1 ? ' checked' : '') + '>Jämför</label></div>' +
        '</div></article>';
    }) + '<article class="bk bk--egen" id="bk-egen"><span class="bk-egen__emoji" aria-hidden="true">📐</span><h3>Inget hus som passar?</h3>' +
      '<p>Skriv in egna mått i snabbmängden, eller släpp en ritning och rita väggarna – materialet räknas på samma sätt.</p>' +
      '<div class="bk__knappar"><a class="knapp knapp--primar knapp--liten" href="#/mangdning">' + i('linjal') + 'Egna mått</a><a class="knapp knapp--liten" href="#/mangdning/ny">' + i('ritning') + 'Egen ritning</a></div></article></div>' +
    '<div class="bk-jamfor" id="bk-jamfor" hidden></div>' +
    vart('mangdning', 'tillval', 'projekt');

    return {
      titel: 'Bibliotek', html: sd(anim, html),
      efter: function (rot) {
        var nat = $('#bk-nat', rot), bar = $('#bk-jamfor', rot);
        var ordna = function () {
          var kort = $$('.bk', nat);
          var nyckel = { standard: function (x) { return D.HUS.indexOf(BP.hus(x)); }, yta: function (x) { return -BP.hus(x).yta; }, kvm: function (x) { var h = BP.hus(x); return husSumma(h) / h.yta; }, summa: function (x) { return husSumma(BP.hus(x)); } }[bv.sort];
          kort = kort.filter(function (k) { return !k.classList.contains('bk--egen'); });
          kort.sort(function (a, b) { return nyckel(a.getAttribute('data-hus')) - nyckel(b.getAttribute('data-hus')); }).forEach(function (k) {
            nat.appendChild(k);
            k.hidden = bv.kat !== 'Alla' && k.getAttribute('data-kat') !== bv.kat;
          });
          // Kortet för egna mått står sist och syns bara när raden annars blir halv
          var egen = $('#bk-egen', nat), synliga = kort.filter(function (k) { return !k.hidden; }).length;
          nat.appendChild(egen);
          egen.hidden = synliga % 3 === 0;
        };
        var visaBar = function () {
          bar.hidden = !bv.jamfor.length;
          bar.innerHTML = bv.jamfor.map(function (id) { var h = BP.hus(id); return '<img src="' + h.bild + '" alt="' + e(h.namn) + '">'; }).join('') +
            '<span>' + (bv.jamfor.length < 2 ? 'Välj ett hus till' : bv.jamfor.length + ' hus valda') + '</span>' +
            '<button class="knapp knapp--gul knapp--liten" type="button" data-g="bk-jamfor"' + (bv.jamfor.length < 2 ? ' disabled' : '') + '>' + i('jamfor') + 'Jämför</button>' +
            '<button class="knapp knapp--text knapp--ljustext knapp--liten" type="button" data-g="bk-rensa">Rensa</button>';
          $$('[data-jamfor]', nat).forEach(function (c) { c.disabled = !c.checked && bv.jamfor.length >= 3; });
        };
        ordna();
        visaBar();
        $$('[data-bkat]', rot).forEach(function (b) {
          b.addEventListener('click', function () {
            bv.kat = b.getAttribute('data-bkat');
            $$('[data-bkat]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            flip(nat, ordna);
          });
        });
        $('#bk-sort', rot).addEventListener('change', function (ev) { bv.sort = ev.target.value; flip(nat, ordna); });
        nat.addEventListener('change', function (ev) {
          var c = ev.target.closest('[data-jamfor]');
          if (!c) return;
          var id = c.getAttribute('data-jamfor');
          bv.jamfor = bv.jamfor.filter(function (x) { return x !== id; });
          if (c.checked) bv.jamfor.push(id);
          visaBar();
        });
        G['bk-rensa'] = function () { bv.jamfor = []; $$('[data-jamfor]', nat).forEach(function (c) { c.checked = false; }); visaBar(); };
        koppla(rot);
      }
    };
  };

  G['bk-jamfor'] = function () {
    var hus = bv.jamfor.map(BP.hus);
    if (hus.length < 2) return;
    var data = hus.map(function (h) { var s = husSumma(h); return { h: h, s: s, kvm: s / h.yta, af: attefall(h) }; });
    var bast = function (fn, storst) { var v = data.map(fn); return storst ? Math.max.apply(null, v) : Math.min.apply(null, v); };
    var rad = function (namn, fn, visa, mark) {
      var b = mark ? bast(fn, mark === 'max') : null;
      return '<tr><th scope="row">' + namn + '</th>' + data.map(function (x) { var v = fn(x); return '<td' + (mark && v === b ? ' class="jf-bast"' : '') + '>' + visa(x, v) + '</td>'; }).join('') + '</tr>';
    };
    var d = BP.dialog({
      titel: 'Jämför hus',
      kropp: '<div class="jf"><table class="jf-tabell"><thead><tr><td></td>' + data.map(function (x) {
          return '<th scope="col"><img src="' + x.h.bild + '" alt=""><b>' + e(x.h.namn) + '</b><small>' + e(x.h.kategori) + '</small></th>';
        }).join('') + '</tr></thead><tbody>' +
        rad('Boyta', function (x) { return x.h.yta; }, function (x, v) { return v + ' m²'; }, 'max') +
        rad('Rum', function (x) { return x.h.rum; }, function (x, v) { return v; }, 'max') +
        rad('Yttermått', function (x) { return x.h.langd * x.h.bredd; }, function (x) { return BP.tal(x.h.langd) + ' × ' + BP.tal(x.h.bredd) + ' m'; }) +
        rad('Nockhöjd', function (x) { return x.h.nock; }, function (x, v) { return BP.tal(v) + ' m'; }) +
        rad('Tak', function () { return 0; }, function (x) { return (x.h.tak === 'pulpet' ? 'Pulpettak' : 'Sadeltak') + (x.h.lutning != null ? ' ' + x.h.lutning + '°' : ' med takkupa'); }) +
        rad('Attefallsmåtten', function (x) { return x.af.ok ? 1 : 0; }, function (x) { return x.af.ok ? '<span class="chip chip--gron">' + i('bock') + 'Inom</span>' : '<span class="chip">Större</span>'; }) +
        rad('Material', function (x) { return x.s; }, function (x, v) { return BP.kr(v); }, 'min') +
        rad('Material per m²', function (x) { return Math.round(x.kvm); }, function (x, v) { return BP.kr(v); }, 'min') +
        '</tbody></table></div><p class="jf-not">' + i('info') + 'Material räknat ur modellerna med exempelpriser. Grönt = bäst i jämförelsen.</p>',
      fot: hus.map(function (h) { return '<button class="knapp" type="button" data-g="hus-mangd" data-hus="' + h.id + '" data-stang>' + i('mangd') + 'Mängda ' + e(h.namn) + '</button>'; }).join('')
    });
    d.classList.add('dialog--bred');
  };

  /* ===== Tillval ============================================================================ */
  BP.vyer.tillval = function () {
    var anim = forst();
    var proj = BP.db.projekt.filter(function (p) { return p.hus; });
    var summor = proj.map(function (p) { return BP.tillvalSumma(p); });
    var tot = summor.reduce(function (t, v) { return t + v; }, 0);
    // Vad kunderna väljer: andel per val i varje grupp.
    var insikt = D.TILLVAL.map(function (g) {
      var val = g.val.map(function (v) { return { v: v, n: proj.filter(function (p) { return p.tillval[g.id] === v.id; }).length }; });
      return { g: g, val: val, topp: val.reduce(function (a, b) { return b.n > a.n ? b : a; }) };
    });
    var dyrast = proj.length ? proj.reduce(function (a, b) { return BP.tillvalSumma(b) > BP.tillvalSumma(a) ? b : a; }) : null;

    var html = sidhuvud({
      vy: 'tillval', titel: 'Tillval',
      under: 'Kunden väljer fasadfärg, tak, altan och insida i 3D. Valen blir en bilaga till kontraktet – och här ser du vad kunderna brukar välja.',
      kpi: [
        { namn: 'Kunder med tillval', rakna: proj.length, varde: proj.length, under: 'projekt med hus ur biblioteket' },
        { namn: 'Tillval totalt', rakna: tot, format: 'kort', varde: BP.kort(tot), under: 'exempelpriser' },
        { namn: 'Snitt per kund', rakna: proj.length ? tot / proj.length : 0, format: 'kr', varde: BP.kr(proj.length ? tot / proj.length : 0), under: 'utöver grundpriset' },
        { namn: 'Mest valda fasad', varde: e(insikt[0].topp.v.namn), under: insikt[0].topp.n + ' av ' + proj.length + ' kunder' }
      ]
    }) +
    '<section class="kort tv-insikt sd-steg" style="--i:0" aria-labelledby="tv-insikt-rubrik"><header class="kort__huvud"><h2 id="tv-insikt-rubrik">Vad kunderna väljer</h2><small>' + proj.length + ' kunder · räknat ur projekten</small></header>' +
      '<div class="tv-insikt__nat">' + lista(insikt, function (x) {
        return '<div class="tv-grupp"><h3>' + e(x.g.namn) + '</h3>' + lista(x.val, function (v, k) {
          var a = proj.length ? v.n / proj.length : 0;
          return '<div class="tv-andel' + (v === x.topp && v.n ? ' tv-andel--topp' : '') + '"><span>' + (v.v.farg ? '<span class="farg" style="--f:' + v.v.farg + '"></span>' : '') + e(v.v.namn) + '</span><b>' + v.n + '</b>' +
            '<span class="tv-stapel" role="img" aria-label="' + Math.round(a * 100) + ' procent"><i style="--a:' + a.toFixed(3) + ';--k:' + k + '"></i></span></div>';
        }) + '</div>';
      }) + '</div></section>' +
    '<div class="tv-nat">' + lista(proj, function (p, n) {
      var h = BP.hus(p.hus), s = BP.tillvalSumma(p);
      var valt = D.TILLVAL.map(function (g) { return { g: g, v: g.val.filter(function (v) { return v.id === p.tillval[g.id]; })[0] }; });
      var f = valt[0].v;
      return '<article class="bk tv-kort tilt sd-steg" style="--i:' + (n + 1) + '">' +
        '<a class="bk__bild" href="#/projekt/' + p.id + '/tillval" tabindex="-1" aria-hidden="true"><img src="' + h.bild + '" alt="" loading="lazy" decoding="async"><span class="bk__glans"></span>' +
          (f ? '<span class="tv-farg"><span class="farg" style="--f:' + f.farg + '"></span>' + e(f.namn) + '</span>' : '') + '</a>' +
        '<div class="bk__text">' +
          '<div class="bk__rad"><h3><a href="#/projekt/' + p.id + '/tillval">' + e(p.kund) + '</a></h3><span class="chip">' + e(h.namn) + '</span></div>' +
          '<dl class="tv-val">' + lista(valt.slice(1), function (x) { return '<div><dt>' + e(x.g.namn) + '</dt><dd>' + e(x.v ? x.v.namn : '–') + '</dd></div>'; }) + '</dl>' +
          '<div class="bk__mangd"><span><small>Tillval</small><b>' + (s ? (s > 0 ? '+' : '−') + BP.kr(Math.abs(s)) : 'Inga tillval') + '</b></span>' + (dyrast === p && s > 0 ? '<span class="chip chip--gul">Störst tillval</span>' : '') + '</div>' +
          '<div class="bk__knappar"><a class="knapp knapp--primar knapp--liten" href="#/projekt/' + p.id + '/tillval">' + i('kub') + 'Öppna i 3D</a>' +
            '<button class="knapp knapp--liten" type="button" data-g="tillvalsbilaga" data-id="' + p.id + '">' + i('skrivut') + 'Bilaga</button>' +
            '<button class="knapp knapp--liten knapp--text" type="button" data-g="kopiera-lank" data-id="' + p.id + '" aria-label="Kopiera länk till kunden" title="Kopiera länk till kunden">' + i('kopiera') + '</button></div>' +
        '</div></article>';
    }) + '</div>' +
    vart('forfragningar', 'konsulter', 'bibliotek');
    return { titel: 'Tillval', html: sd(anim, html), efter: koppla };
  };

  /* ===== Förfrågningar ======================================================================= */
  var fv = { flik: 'alla' };
  BP.vyer.forfragningar = function () {
    var anim = forst(), db = BP.db;
    var poster = [];
    db.leads.forEach(function (l) { poster.push({ typ: 'kund', tid: l.tid, l: l, vikt: l.status === 'ny' ? 3 : 0 }); });
    db.projekt.forEach(function (p) {
      p.forfragningar.forEach(function (f) { poster.push({ typ: 'partner', tid: f.skickad, p: p, f: f, vikt: p.steg === 'order' ? 0 : f.status === 'svar' ? 2 : 1 }); });
    });
    // Mest bråttom först: nya kunder (äldst först), svar att välja, sedan det som väntar.
    poster.sort(function (a, b) { return b.vikt - a.vikt || (b.vikt === 3 ? (a.tid < b.tid ? -1 : 1) : (a.tid < b.tid ? 1 : -1)); });
    var nyaKunder = db.leads.filter(function (l) { return l.status === 'ny'; });
    var aldst = nyaKunder.reduce(function (m, l) { return Math.max(m, dagarSedan(l.tid)); }, 0);
    var attValja = db.projekt.filter(function (p) { return p.steg !== 'order' && p.forfragningar.some(function (f) { return f.status === 'svar'; }); });
    var vantar = poster.filter(function (x) { return x.typ === 'partner' && x.f.status !== 'svar'; }).length;
    var spar = attValja.reduce(function (t, p) {
      var m = BP.mangdFor(p).summa, best = Math.max.apply(null, p.forfragningar.filter(function (f) { return f.svar; }).map(function (f) { return f.svar.rabatt; }));
      return t + m * best / 100;
    }, 0);

    var html = sidhuvud({
      vy: 'forfragningar', titel: 'Förfrågningar',
      under: 'Kunder som hört av sig från konsumentsidan och svar från bygghandeln på era materiallistor. Det som brådskar mest ligger överst.',
      kpi: [
        { namn: 'Nya kunder', rakna: nyaKunder.length, varde: nyaKunder.length, under: nyaKunder.length ? 'äldsta har väntat ' + (aldst === 1 ? '1 dag' : aldst + ' dagar') : 'alla har fått svar' },
        { namn: 'Svar att välja', rakna: attValja.length, varde: attValja.length, under: attValja.length === 1 ? 'projekt med prisförslag' : 'projekt med prisförslag' },
        { namn: 'Väntar på partner', rakna: vantar, varde: vantar, under: 'skickade förfrågningar' },
        { namn: 'Att spara', rakna: spar, format: 'kort', varde: BP.kort(spar), under: 'bästa svar mot listpris' }
      ]
    }) +
    '<div class="pl-verktyg sd-steg" style="--i:0"><div class="pl-filter" role="group" aria-label="Visa">' + [['alla', 'Alla', poster.length], ['kund', 'Från kunder', db.leads.length], ['partner', 'Till partner', poster.length - db.leads.length]].map(function (b) {
      return '<button type="button" data-ffflik="' + b[0] + '" aria-pressed="' + (fv.flik === b[0]) + '">' + b[1] + '<span>' + b[2] + '</span></button>';
    }).join('') + '</div></div>' +
    '<div class="ff-yta">' +
      '<section class="kort ff-lista sd-steg" style="--i:1" aria-label="Förfrågningar">' + (poster.length ? lista(poster, function (x) {
        if (x.typ === 'kund') {
          var l = x.l, h = BP.hus(l.hus), d = dagarSedan(l.tid), ny = l.status === 'ny';
          return '<article class="ff-rad" data-fftyp="kund"' + (fv.flik === 'partner' ? ' hidden' : '') + '><span class="avatar" style="--av:' + BP.avfarg(l.namn) + '">' + BP.initialer(l.namn) + '</span>' +
            '<div class="ff-rad__mitt"><h3>' + e(l.namn) + ' <small>· ' + e(l.ort) + '</small></h3><p class="ff-citat">' + e(l.text) + '</p>' +
              (h ? '<a class="ff-hus" href="#/bibliotek/' + h.id + '"><img src="' + h.bild + '" alt=""><span><b>' + e(h.namn) + '</b><small>' + h.yta + ' m² · material ≈ ' + BP.kort(husSumma(h)) + '</small></span>' + i('hoger') + '</a>' : '') + '</div>' +
            '<div class="ff-rad__hoger"><span class="chip' + (ny && d >= 2 ? ' ff-varm' : '') + '">' + (ny ? (d >= 2 ? 'Väntat ' + d + ' dagar' : BP.sedan(l.tid)) : 'Besvarad') + '</span>' +
              (ny ? '<button class="knapp knapp--gul knapp--liten" type="button" data-g="lead-projekt" data-id="' + l.id + '">' + i('plus') + 'Skapa projekt</button>' : '<span class="ff-klar">' + i('bock') + 'Projekt skapat</span>') + '</div></article>';
        }
        var f = x.f, p = x.p, m = BP.mangdFor(p);
        return '<article class="ff-rad" data-fftyp="partner"' + (fv.flik === 'kund' ? ' hidden' : '') + '><span class="ff-ikon">' + i('skicka') + '</span>' +
          '<div class="ff-rad__mitt"><h3>' + e(f.till) + ' <small>· ' + e(p.namn) + '</small></h3><p>' + (f.svar ? f.svar.rabatt + ' % under listpris · leverans ' + e(f.svar.leverans) + ' · ' + BP.kr(m.summa * (1 - f.svar.rabatt / 100)) : 'Materiallistan skickades ' + BP.sedan(f.skickad) + ' · ' + m.rader.length + ' rader') + '</p></div>' +
          '<div class="ff-rad__hoger">' + (p.steg === 'order' ? '<span class="ff-klar">' + i('bock') + 'Order lagd</span>' : f.status === 'svar' ? '<span class="chip chip--gron">Svar</span>' : '<span class="chip chip--bla"><span class="prick"></span>Väntar</span>') +
            '<a class="knapp knapp--liten" href="#/projekt/' + p.id + '/forfragningar">Öppna' + i('hoger') + '</a></div></article>';
      }) : '<p class="tomt" style="margin:16px">Inga förfrågningar än.</p>') + '</section>' +
      '<div class="ff-sido sd-steg" style="--i:2">' +
        (attValja.length ? lista(attValja, function (p) {
          var m = BP.mangdFor(p), svar = p.forfragningar.filter(function (f) { return f.svar; });
          var priser = svar.map(function (f) { return Math.round(m.summa * (1 - f.svar.rabatt / 100)); });
          var min = Math.min.apply(null, priser);
          return '<section class="kort ff-jamfor"><header class="kort__huvud"><h2>Jämför svaren</h2><small>' + e(p.namn) + '</small></header><div class="kort__kropp">' +
            '<p class="ff-jamfor__list">Listpris <b>' + BP.kr(m.summa) + '</b></p>' + lista(svar, function (f, k) {
              var pr = priser[k];
              return '<div class="ff-bud' + (pr === min ? ' ff-bud--bast' : '') + '"><div class="ff-bud__rad"><b>' + e(f.till) + '</b>' + (pr === min && svar.length > 1 ? '<span class="chip chip--gron">Lägst</span>' : '') + '<span class="ff-bud__pris">' + BP.kr(pr) + '</span></div>' +
                '<span class="ff-bud__stapel"><i style="--a:' + (pr / m.summa).toFixed(3) + '"></i></span><small>' + f.svar.rabatt + ' % rabatt · sparar ' + BP.kr(m.summa - pr) + ' · leverans ' + e(f.svar.leverans) + '</small>' +
                '<button class="knapp knapp--liten' + (pr === min ? ' knapp--primar' : '') + '" type="button" data-g="valj-svar" data-id="' + p.id + '" data-f="' + f.id + '">Välj och lägg order</button></div>';
            }) + '</div></section>';
        }) : '<section class="kort"><div class="kort__kropp ff-tomt"><b>Inga svar att jämföra</b><span>När bygghandeln svarar på en materiallista ställs svaren mot varandra här.</span><a class="knapp knapp--liten" href="#/projekt">Välj ett projekt' + i('hoger') + '</a></div></section>') +
      '<section class="kort ff-hur"><header class="kort__huvud"><h2>Så jämförs svaren</h2></header><ul class="ff-hur__lista">' +
        '<li>' + em('🧾') + '<span><b>Mot listpriset</b><small>Materialet i mängden, med prislistan du använder</small></span></li>' +
        '<li>' + em('🏷️') + '<span><b>Rabatt och leverans</b><small>Lägst pris först, med leveranstiden bredvid</small></span></li>' +
        '<li>' + em('🤝') + '<span><b>Ett klick till order</b><small>Det valda svaret blir en order i projektet</small></span></li>' +
      '</ul><a class="ff-hur__lank" href="#/prislistor">' + i('pris') + 'Mata in din prislista' + i('hoger') + '</a></section>' +
      '</div>' +
    '</div>' +
    vart('projekt', 'konsulter', 'tillval');

    return {
      titel: 'Förfrågningar', html: sd(anim, html),
      efter: function (rot) {
        var lst = $('.ff-lista', rot);
        $$('[data-ffflik]', rot).forEach(function (b) {
          b.addEventListener('click', function () {
            fv.flik = b.getAttribute('data-ffflik');
            $$('[data-ffflik]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            flip(lst, function () { $$('.ff-rad', lst).forEach(function (r) { r.hidden = fv.flik !== 'alla' && r.getAttribute('data-fftyp') !== fv.flik; }); });
          });
        });
      }
    };
  };

  /* ===== Konsulter =============================================================================== */
  var KIKON = { arkitekt: 'arkitekt', konstruktion: 'konstruktion', energi: 'energi', ka: 'ka' };
  var KEMOJI = { arkitekt: ['📐', '#f3dccd'], konstruktion: ['🏗️', '#efe8d8'], energi: ['⚡', '#e6e6cc'], ka: ['✅', '#ecd8dc'] };
  BP.vyer.konsulter = function () {
    var anim = forst(), db = BP.db;
    var bestallda = [];
    db.projekt.forEach(function (p) { p.konsulter.forEach(function (k) { bestallda.push({ p: p, k: k }); }); });
    bestallda.sort(function (a, b) { return a.k.tid < b.k.tid ? 1 : -1; });
    var aktiva = db.projekt.filter(function (p) { return p.steg !== 'order'; });
    var utan = aktiva.filter(function (p) { return !p.konsulter.length; });

    var html = sidhuvud({
      vy: 'konsulter', titel: 'Konsulter',
      under: 'Beställ arkitekt, konstruktion, energiberäkning och kontrollansvarig direkt till ett projekt. Modellen, ritningen och mängden följer med.',
      kpi: [
        { namn: 'Tjänster', rakna: D.KONSULTER.length, varde: D.KONSULTER.length, under: 'att beställa i plattformen' },
        { namn: 'Beställda', rakna: bestallda.length, varde: bestallda.length, under: bestallda.length ? 'senast ' + BP.sedan(bestallda[0].k.tid) : 'inga än' },
        { namn: 'Projekt utan konsult', rakna: utan.length, varde: utan.length, under: 'av ' + aktiva.length + ' pågående' }
      ]
    }) +
    '<div class="ko-nat">' + lista(D.KONSULTER, function (k, n) {
      var antal = bestallda.filter(function (x) { return x.k.tjanst === k.id; }).length;
      return '<article class="ko-kort tilt sd-steg" style="--i:' + n + '"><span class="emoji ko-emoji" aria-hidden="true" style="background:' + KEMOJI[k.id][1] + '">' + KEMOJI[k.id][0] + '</span>' +
        '<h3>' + e(k.namn) + '</h3><p>' + e(k.text) + '</p>' +
        '<div class="ko-fot"><span><small>' + e(k.leverans) + '</small><small>' + antal + (antal === 1 ? ' beställd' : ' beställda') + '</small></span>' +
        '<button class="knapp knapp--primar knapp--liten" type="button" data-g="ko-bestall" data-k="' + k.id + '">Beställ' + i('pil') + '</button></div></article>';
    }) + '</div>' +
    '<div class="ko-nedre">' +
      '<section class="kort sd-steg" style="--i:4" aria-labelledby="ko-utan"><header class="kort__huvud"><h2 id="ko-utan">Pågående projekt utan konsulthjälp</h2><small>' + utan.length + '</small></header>' +
        (utan.length ? '<div class="delar">' + lista(utan, function (p) {
          var h = BP.hus(p.hus);
          return '<div class="ko-proj"><span class="pl-bild">' + (h ? '<img src="' + h.bild + '" alt="" loading="lazy">' : i('ritning')) + '</span><span class="pl-namn"><a href="#/projekt/' + p.id + '/konsulter">' + e(p.namn) + '</a><small>' + e(p.kund) + ' · ' + STEGNAMN[p.steg] + '</small></span>' +
            '<span class="ko-snabb">' + lista(D.KONSULTER, function (k) { return '<button class="knapp knapp--liten" type="button" data-g="ko-bestall" data-k="' + k.id + '" data-p="' + p.id + '" title="Beställ ' + e(k.namn.toLowerCase()) + '">' + i(KIKON[k.id], '') + '<span class="dold">Beställ ' + e(k.namn.toLowerCase()) + ' till ' + e(p.namn) + '</span></button>'; }) + '</span></div>';
        }) + '</div>' : '<div class="kort__kropp"><p class="tomt">Alla pågående projekt har beställt konsulthjälp.</p></div>') + '</section>' +
      '<section class="kort sd-steg" style="--i:5" aria-labelledby="ko-best"><header class="kort__huvud"><h2 id="ko-best">Beställningar</h2><small>' + bestallda.length + '</small></header>' +
        (bestallda.length ? '<ol class="ov-logg">' + lista(bestallda, function (x, n) {
          var t = D.KONSULTER.filter(function (y) { return y.id === x.k.tjanst; })[0];
          return '<li style="--k:' + n + '"><span class="ko-loggikon">' + i(KIKON[t.id]) + '</span><a href="#/projekt/' + x.p.id + '/konsulter"><b>' + e(t.namn) + '</b><small>' + e(x.p.namn) + ' · ' + BP.sedan(x.k.tid) + (x.k.text ? ' · ' + e(x.k.text) : '') + '</small></a></li>';
        }) + '</ol>' : '<div class="kort__kropp ff-tomt"><b>Inga beställningar än</b><span>Välj en tjänst ovan eller tryck på en ikon vid ett projekt.</span></div>') + '</section>' +
    '</div>' +
    vart('projekt', 'recept', 'forfragningar');
    return { titel: 'Konsulter', html: sd(anim, html), efter: koppla };
  };

  G['ko-bestall'] = function (el) {
    var k = D.KONSULTER.filter(function (x) { return x.id === el.getAttribute('data-k'); })[0];
    var aktiva = BP.db.projekt.filter(function (p) { return p.steg !== 'order'; });
    var forval = el.getAttribute('data-p') || (aktiva[0] || {}).id;
    BP.dialog({
      titel: 'Beställ ' + k.namn.toLowerCase(),
      kropp: '<p>' + e(k.text) + ' Modellen, ritningen och mängden följer med.</p>' +
        '<label class="falt"><span>Till projekt</span><select id="ko-proj">' + BP.db.projekt.map(function (p) { return '<option value="' + p.id + '"' + (p.id === forval ? ' selected' : '') + '>' + e(p.namn) + ' · ' + e(p.kund) + '</option>'; }).join('') + '</select></label>' +
        '<label class="falt"><span>Meddelande</span><textarea id="ko-text" placeholder="Det här behöver vi hjälp med …"></textarea></label>' +
        '<div class="not">' + i('info') + '<span>Prototyp: beställningen skickas inte. ' + e(k.leverans) + '.</span></div>',
      fot: '<button class="knapp" type="button" data-stang>Avbryt</button><button class="knapp knapp--primar" type="button" id="ko-ok">' + i('bock') + 'Beställ</button>',
      efter: function (d) {
        $('#ko-ok', d).addEventListener('click', function () {
          var p = BP.projekt($('#ko-proj', d).value);
          p.konsulter.unshift({ tjanst: k.id, tid: new Date().toISOString(), text: $('#ko-text', d).value.trim() });
          BP.handelse(p, 'Beställde ' + k.namn.toLowerCase());
          BP.spara(); d.close(); BP.rita(); BP.toast('Beställt', k.namn + ' · ' + p.namn);
        });
      }
    });
  };

  /* ===== Mängdning: samma sidhuvud ovanpå hubben ===================================================== */
  var gammalMangdning = BP.vyer.mangdning;
  BP.vyer.mangdning = function (del) {
    if (del[0] === 'ny') return nyMangdning();
    if (del[0]) return gammalMangdning(del);
    var anim = forst();
    var ut = gammalMangdning(del);
    var k = ut.html.indexOf('<div class="mh-topp">');
    if (k < 0) return ut;
    var alla = BP.db.projekt.map(function (p) { var d = BP.delarFor(p); return { p: p, m: BP.mangdFor(p), d: d, ok: d.filter(function (x) { return x.bekraftad !== false; }).length }; });
    var delar = alla.reduce(function (t, x) { return t + x.d.length; }, 0), ok = alla.reduce(function (t, x) { return t + x.ok; }, 0);
    var tot = alla.reduce(function (t, x) { return t + x.m.summa; }, 0);
    ut.html = sd(anim, sidhuvud({
      vy: 'mangdning', titel: 'Mängdning',
      under: 'Räkna materialet ur ett hus i biblioteket eller en egen ritning. Allt visar sin källa, och det som inte är bekräftat är avspärrat tills någon godkänt det.',
      knappar: '<a class="knapp knapp--gul" href="#/mangdning/ny">' + i('plus') + 'Ny mängdning</a>',
      kpi: [
        { namn: 'Mängder', rakna: alla.length, varde: alla.length, under: alla.filter(function (x) { return x.p.underlag === 'ritning'; }).length + ' ur ritning · resten ur modell' },
        { namn: 'Bekräftade delar', rakna: ok, varde: ok, under: 'av ' + delar + ' · ' + (delar - ok) + ' avspärrade' },
        { namn: 'Material', rakna: tot, format: 'kort', varde: BP.kort(tot), under: 'i alla mängder, exempelpriser' }
      ]
    }) + '<div class="sd-steg" style="--i:0">' + ut.html.slice(k) + '</div>' + vart('tillval', 'forfragningar', 'recept'));
    return ut;
  };

  /* ===== Recept och material: sök och prisändringar som visar sin påverkan ============================ */
  var gammalRecept = BP.vyer.recept;
  BP.vyer.recept = function () {
    var anim = forst();
    var ut = gammalRecept();
    var k = ut.html.indexOf('<div class="rutnat"');
    var R = BP.recept(), MAT = BP.material();
    var tot = BP.db.projekt.reduce(function (t, p) { return t + BP.mangdFor(p).summa; }, 0);
    var html = sidhuvud({
      vy: 'recept', titel: 'Recept och material',
      under: 'Varje byggdel räknas med ett recept. Skriv ett nytt pris så ser du direkt vad det gör med projekten – innan du sparar.',
      knappar: '<button class="knapp knapp--morkplat" type="button" data-g="aterstall">' + i('vrid') + 'Återställ exempeldata</button>',
      kpi: [
        { namn: 'Recept', rakna: Object.keys(R).length, varde: Object.keys(R).length, under: 'väggar, bjälklag, tak och grund' },
        { namn: 'Material', rakna: Object.keys(MAT).length, varde: Object.keys(MAT).length, under: 'artiklar med exempelpriser' },
        { namn: 'Material i projekten', rakna: tot, format: 'kort', varde: BP.kort(tot), under: BP.db.projekt.length + ' projekt räknas om vid prisändring' }
      ]
    }) + (function () {
      var l = BP.prislista && BP.prislista.aktiv();
      if (!l) return '';
      var n = l.rader.filter(function (r) { return r.material; }).length;
      return '<div class="not not--info sd-steg" style="--i:0;margin-bottom:16px">' + i('pris') + '<span>Priserna för ' + n + ' artiklar kommer från prislistan <b>' + e(l.namn) + '</b>. Ändra eller byt lista under <a href="#/prislistor">Prislistor</a>.</span></div>';
    })() + '<div class="sd-steg" style="--i:0">' + ut.html.slice(k) + '</div>' + vart('mangdning', 'prislistor', 'projekt');
    return {
      titel: ut.titel, html: sd(anim, html),
      efter: function (rot) {
        if (ut.efter) ut.efter(rot);
        var inp0 = $('[data-pris]', rot);
        if (!inp0) return;
        var tabell = inp0.closest('table'), huvud = tabell.closest('.kort').querySelector('.kort__huvud');
        huvud.insertAdjacentHTML('beforeend', '<label class="pl-sok rc-sok">' + i('sok') + '<input type="search" placeholder="Sök material eller artikel" aria-label="Sök material" autocomplete="off"></label>');
        $('input', huvud).addEventListener('input', function (ev) {
          var q = ev.target.value.trim().toLowerCase();
          $$('tbody tr', tabell).forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) === -1; });
        });
        // Påverkan: räkna om alla projekt med det nya priset medan man skriver.
        $$('[data-pris]', rot).forEach(function (inp) {
          var ut2 = document.createElement('span');
          ut2.className = 'rc-paverkan';
          ut2.setAttribute('aria-live', 'polite');
          inp.parentNode.appendChild(ut2);
          inp.addEventListener('input', function () {
            var id = inp.getAttribute('data-pris'), v = Math.max(0, parseFloat(inp.value) || 0);
            var mat = JSON.parse(JSON.stringify(BP.material()));
            if (mat[id].pris === v) { ut2.textContent = ''; ut2.className = 'rc-paverkan'; return; }
            mat[id].pris = v;
            var berorda = 0, diff = 0;
            BP.db.projekt.forEach(function (p) {
              var fore = BP.mangdFor(p).summa, efter = M.mangda(BP.delarFor(p), BP.recept(), mat).summa;
              if (Math.round(efter) !== Math.round(fore)) { berorda++; diff += efter - fore; }
            });
            ut2.className = 'rc-paverkan ' + (diff > 0 ? 'rc-upp' : 'rc-ned');
            ut2.textContent = berorda ? (diff > 0 ? '+' : '−') + BP.kr(Math.abs(diff)) + ' i ' + berorda + ' projekt' : 'påverkar inget projekt';
          });
          inp.addEventListener('change', function () { setTimeout(function () { ut2.textContent = ''; ut2.className = 'rc-paverkan'; }, 2400); });
        });
      }
    };
  };

  /* ===== Ny mängdning: tre steg och en sammanfattning som räknar direkt ============== */
  var nm = { underlag: 'modell', hus: 'sadel-30-bred', fil: null };
  function nyMangdning() {
    var anim = forst();
    var husKort = D.HUS.map(function (h) {
      return '<label class="nm-hus"><input type="radio" name="hus" value="' + h.id + '"' + (nm.hus === h.id ? ' checked' : '') + '><span class="nm-hus__bild"><img src="' + h.bild + '" alt="" loading="lazy"></span>' +
        '<span class="nm-hus__text"><b>' + e(h.namn) + '</b><small>' + h.kategori + ' · ' + h.yta + ' m²</small><small>≈ ' + BP.kort(husSumma(h)) + ' material</small></span><span class="nm-bock" aria-hidden="true">' + i('bock') + '</span></label>';
    }).join('');
    var val = function (v, bild, titel, text, mark) {
      return '<label class="nm-val"><input type="radio" name="underlag" value="' + v + '"' + (nm.underlag === v ? ' checked' : '') + '><span class="nm-val__bild">' + bild + '</span><span class="nm-val__text"><b>' + titel + '</b><small>' + text + '</small></span><span class="nm-val__mark">' + mark + '</span><span class="nm-bock" aria-hidden="true">' + i('bock') + '</span></label>';
    };
    var plan = '<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#f4f6f2"/><path d="M0 16H120M0 32H120M0 48H120M0 64H120M20 0V80M40 0V80M60 0V80M80 0V80M100 0V80" stroke="#e2e8df"/><rect x="22" y="18" width="76" height="44" fill="none" stroke="#2b2722" stroke-width="4"/><path d="M62 20V44" stroke="#5c554b" stroke-width="2.5"/><path d="M34 18h16" stroke="#c2c097" stroke-width="5"/></svg>';
    var uppladd = '<span class="nm-val__ikon">' + i('uppladd') + '</span>';
    var html = sidhuvud({
      vy: 'mangdning', titel: 'Ny mängdning', foralder: ['Mängdning', '#/mangdning'],
      under: 'Tre steg: projektet, underlaget och huset. Materialet räknas direkt, och det som inte är bekräftat spärras av tills någon godkänt det.'
    }) +
    '<form class="nm" id="nm" novalidate>' +
      '<div class="nm__vanster">' +
        '<section class="nm-steg sd-steg" style="--i:0"><header><span class="nm-nr">1</span><div><h2>Projektet</h2><small>Namnet föreslås ur huset och orten om du lämnar det tomt</small></div></header>' +
          '<div class="nm-falt"><label class="falt"><span>Projektnamn</span><input name="namn" placeholder="t.ex. Attefallshus, Storgatan 4" autocomplete="off"></label>' +
          '<label class="falt"><span>Kund</span><input name="kund" placeholder="Namn" autocomplete="off"></label><label class="falt"><span>Ort</span><input name="ort" placeholder="Ort" autocomplete="off"></label></div></section>' +
        '<section class="nm-steg sd-steg" style="--i:1"><header><span class="nm-nr">2</span><div><h2>Underlag</h2><small>Vad mängden ska räknas ur</small></div></header>' +
          '<div class="nm-valen" role="radiogroup" aria-label="Underlag">' +
            val('modell', '<img src="' + BP.hus('sadel-30-bred').bild + '" alt="">', 'Hus ur biblioteket', 'Räknas exakt ur husets mått. Det ritningen inte anger blir antaganden du ser.', 'Exakt ur måtten') +
            val('ritning', uppladd, 'Ladda upp ritning', 'Bild eller PDF-utskrift. Sätt skalan, rita av väggar och ytor, bekräfta.', 'Rita av med skala') +
            val('skiss', plan, 'Exempelritning', 'Prova verktyget på en planritning 1:50 som redan ligger inne.', 'Prova direkt') +
          '</div></section>' +
        '<section class="nm-steg sd-steg" style="--i:2" data-visa="modell"><header><span class="nm-nr">3</span><div><h2>Välj hus</h2><small>Idealhus modeller med riktiga mått</small></div></header><div class="nm-husen" role="radiogroup" aria-label="Hus">' + husKort + '</div></section>' +
        '<section class="nm-steg sd-steg" style="--i:2" data-visa="ritning" hidden><header><span class="nm-nr">3</span><div><h2>Ritningen</h2><small>PNG, JPG eller SVG</small></div></header>' +
          '<label class="nm-slapp" id="nm-slapp" tabindex="0"><input type="file" name="fil" accept="image/*" hidden><span class="nm-slapp__tom">' + i('uppladd') + '<b>Släpp ritningen här</b><small>eller klicka för att välja en fil</small></span><img class="nm-slapp__bild" alt="Förhandsvisning av ritningen" hidden></label></section>' +
        '<section class="nm-steg sd-steg" style="--i:2" data-visa="skiss" hidden><header><span class="nm-nr">3</span><div><h2>Exempelritningen</h2><small>Planritning 1:50 med en innervägg</small></div></header><div class="nm-skiss">' + plan + '</div></section>' +
      '</div>' +
      '<aside class="nm__hoger sd-steg" style="--i:3"><div class="nm-sam" id="nm-sam"></div></aside>' +
    '</form>';
    return {
      titel: 'Ny mängdning', html: sd(anim, html),
      efter: function (rot) {
        var form = $('#nm', rot), sam = $('#nm-sam', rot), slapp = $('#nm-slapp', rot);
        var namnForslag = function () {
          var h = BP.hus(nm.hus), ort = form.ort.value.trim();
          if (nm.underlag === 'modell') return h.namn + (ort ? ', ' + ort : '');
          if (nm.underlag === 'skiss') return 'Exempelritning' + (ort ? ', ' + ort : '');
          return nm.fil ? nm.fil.name.replace(/\.[^.]+$/, '') : 'Egen ritning' + (ort ? ', ' + ort : '');
        };
        var rita = function () {
          $$('[data-visa]', form).forEach(function (s) { s.hidden = s.getAttribute('data-visa') !== nm.underlag; });
          var h = BP.hus(nm.hus), namn = form.namn.value.trim() || namnForslag();
          var underlag = { modell: 'Hus ur biblioteket', ritning: 'Egen ritning', skiss: 'Exempelritning 1:50' }[nm.underlag];
          var bild = nm.underlag === 'modell' ? '<img src="' + h.bild + '" alt="">' : nm.underlag === 'ritning' && nm.fil ? '<img src="' + nm.fil.url + '" alt="">' : '<span class="nm-sam__ikon">' + i(nm.underlag === 'ritning' ? 'uppladd' : 'ritning') + '</span>';
          var klar = nm.underlag !== 'ritning' || nm.fil;
          sam.innerHTML = '<div class="nm-sam__bild">' + bild + '</div>' +
            '<div class="nm-sam__kropp"><small>Det här skapas</small><b class="nm-sam__namn">' + e(namn) + '</b>' +
            '<dl><div><dt>Underlag</dt><dd>' + underlag + '</dd></div>' +
            (nm.underlag === 'modell' ? '<div><dt>Hus</dt><dd>' + e(h.namn) + ' · ' + h.yta + ' m²</dd></div><div><dt>Material</dt><dd><b>' + BP.kr(husSumma(h)) + '</b><small> exempelpriser</small></dd></div>' : '') +
            (form.kund.value.trim() ? '<div><dt>Kund</dt><dd>' + e(form.kund.value.trim()) + '</dd></div>' : '') + '</dl>' +
            '<ol class="nm-sen"><li>' + (nm.underlag === 'modell' ? 'Materialet räknas ur husets mått' : 'Du sätter skalan och ritar av') + '</li><li>Väggarna ligger avspärrade tills du bekräftat dem</li><li>Sedan godkänner du mängden och skickar förfrågan</li></ol>' +
            '<button class="knapp knapp--primar knapp--stor nm-sam__knapp" type="submit" form="nm"' + (klar ? '' : ' aria-disabled="true"') + '>Skapa och mängda' + i('pil') + '</button>' +
            '<a class="knapp knapp--text nm-sam__avbryt" href="#/mangdning">Avbryt</a></div>';
        };
        form.addEventListener('change', function (ev) {
          if (ev.target.name === 'underlag') nm.underlag = ev.target.value;
          if (ev.target.name === 'hus') nm.hus = ev.target.value;
          if (ev.target.name === 'fil' && ev.target.files[0]) las(ev.target.files[0]);
          rita();
        });
        form.addEventListener('input', function (ev) { if (ev.target.name !== 'fil') rita(); });
        // Ritningen: släpp eller välj, och se den direkt.
        var las = function (f) {
          if (!/^image\//.test(f.type)) { BP.toast('Det där är ingen bild', 'Välj en PNG, JPG eller SVG'); return; }
          var rd = new FileReader();
          rd.onload = function () {
            var img = new Image();
            img.onload = function () {
              nm.fil = { name: f.name, url: rd.result, bredd: img.naturalWidth, hojd: img.naturalHeight };
              var p = $('.nm-slapp__bild', slapp); p.src = rd.result; p.hidden = false; $('.nm-slapp__tom', slapp).hidden = true;
              rita();
            };
            img.src = rd.result;
          };
          rd.readAsDataURL(f);
        };
        ['dragenter', 'dragover'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.add('over'); }); });
        ['dragleave', 'drop'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.remove('over'); }); });
        slapp.addEventListener('drop', function (ev) { if (ev.dataTransfer.files[0]) las(ev.dataTransfer.files[0]); });
        slapp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); form.fil.click(); } });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          if (nm.underlag === 'ritning' && !nm.fil) { BP.toast('Välj en ritning först', 'Släpp den i rutan eller klicka för att välja'); slapp.focus(); return; }
          var rit = nm.underlag === 'ritning' ? { namn: nm.fil.name, bild: nm.fil.url, bredd: nm.fil.bredd, hojd: nm.fil.hojd, skala: null, element: [] } : nm.underlag === 'skiss' ? BP.exempelRitningTom() : null;
          var p = BP.nyttProjekt({ namn: form.namn.value.trim() || namnForslag(), kund: form.kund.value.trim(), ort: form.ort.value.trim(), hus: nm.underlag === 'modell' ? nm.hus : null, underlag: nm.underlag === 'modell' ? 'modell' : 'ritning', ritning: rit });
          BP.spara();
          BP.toast('Projektet är skapat', p.namn);
          nm.fil = null;
          BP.ga('#/projekt/' + p.id + '/' + (nm.underlag === 'modell' ? 'mangd' : 'ritning'));
        });
        rita();
      }
    };
  }

  /* ===== Byt roll: kort per roll med vad den gör =================================== */
  var ROLLTEXT = {
    bygg: ['projekt', 'Mängdar, räknar offert och håller ihop projekten med kund och partner.'],
    leverantor: ['tillval', 'Låter kunden göra sina val i 3D och har full koll på tillvalen.'],
    handel: ['forfragan', 'Tar emot materiallistor och svarar med pris, rabatt och leveranstid.'],
    konsument: ['kund', 'Följer sitt eget bygge på Mitt bygge – val, byggare och vad som hänt.']
  };
  G['byt-roll'] = function () {
    var d = BP.dialog({
      titel: 'Byt roll',
      kropp: '<p class="rv-intro">Prototypen visar samma plattform från fyra håll. Välj vem du är, så ändras menyn och översikten efter det.</p><div class="rv">' + D.ROLLER.map(function (r, n) {
        var t = ROLLTEXT[r.id] || ['kund', ''], aktiv = r.id === BP.db.roll;
        return '<button type="button" class="rv-kort rv-kort--' + r.id + '" data-roll="' + r.id + '" aria-pressed="' + aktiv + '" style="--n:' + n + '"><span class="rv-ikon">' + i(t[0]) + '</span>' +
          '<span class="rv-text"><b>' + e(r.namn) + '</b><small>' + e(r.person) + (r.foretag ? ' · ' + e(r.foretag) : '') + '</small><span>' + t[1] + '</span></span>' +
          (aktiv ? '<span class="rv-nu">' + i('bock') + 'Nu</span>' : r.id === 'konsument' ? '<span class="rv-nu rv-nu--ut">' + i('extern') + 'Mitt bygge</span>' : '') + '</button>';
      }).join('') + '</div>',
      efter: function (dd) {
        $$('[data-roll]', dd).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-roll');
            if (id === 'konsument') { location.href = 'mitt.html'; return; }
            BP.db.roll = id; BP.spara(); dd.close(); BP.rita(); BP.toast('Du är nu ' + BP.roll().namn.toLowerCase(), BP.roll().person);
          });
        });
      }
    });
    d.classList.add('dialog--roll');
  };
})();
