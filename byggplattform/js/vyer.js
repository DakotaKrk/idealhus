/* Byggplattformen – vyerna: översikt, projekt, projektrummet med
   mängden, mängdning, bibliotek och husdetalj. Ritverktyget ligger i
   ritning.js, tillval/förfrågningar/konsulter/recept i ovrigt.js. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;

  var TYPIKON = { vagg: 'vagg', bjalklag: 'golv', tak: 'tak', grund: 'grund' };
  var STEGNAMN = { underlag: 'Underlag', mangd: 'Mängd', offert: 'Offert', order: 'Order' };

  function stegChip(steg) {
    var k = { underlag: '', mangd: 'chip--gul', offert: 'chip--bla', order: 'chip--gron' }[steg];
    return '<span class="chip ' + k + '"><span class="prick"></span>' + STEGNAMN[steg] + '</span>';
  }

  function linje(steg) {
    var n = D.STEG.map(function (s) { return s.id; }).indexOf(steg);
    return '<ol class="linje" aria-label="Projektets väg">' + D.STEG.map(function (s, k) {
      return '<li class="' + (k < n ? 'klar' : k === n ? 'nu' : '') + '"' + (k === n ? ' aria-current="step"' : '') + '><i></i>' + s.namn + '</li>';
    }).join('') + '</ol>';
  }

  function obekraftade(p) {
    return BP.delarFor(p).filter(function (d) { return d.bekraftad === false; });
  }

  /* ===== Översikt ======================================================== */
  BP.vyer.oversikt = function () {
    var db = BP.db, r = BP.roll();
    var aktiva = db.projekt.filter(function (p) { return p.steg !== 'order'; });
    var vantar = db.projekt.map(function (p) { return { p: p, n: obekraftade(p).length + (p.underlag === 'ritning' && p.ritning && !p.ritning.skala ? 1 : 0) }; }).filter(function (x) { return x.n; });
    var offertVarde = db.projekt.filter(function (p) { return p.steg === 'offert'; }).reduce(function (t, p) { return t + BP.mangdFor(p).summa + BP.tillvalSumma(p); }, 0);
    var svar = db.projekt.reduce(function (t, p) { return t + p.forfragningar.filter(function (f) { return f.status === 'svar'; }).length; }, 0);
    var leads = db.leads.filter(function (l) { return l.status === 'ny'; });
    var perSteg = D.STEG.map(function (s) { return { s: s, l: db.projekt.filter(function (p) { return p.steg === s.id; }) }; });
    var handelser = db.projekt.reduce(function (a, p) { return a.concat(p.handelser.map(function (h) { return { h: h, p: p }; })); }, []).sort(function (a, b) { return a.h.tid < b.h.tid ? 1 : -1; }).slice(0, 6);
    var fraga = vantar.length
      ? vantar.reduce(function (t, x) { return t + x.n; }, 0) + ' byggdelar väntar på att bekräftas i ' + vantar.length + (vantar.length === 1 ? ' projekt' : ' projekt') + '.'
      : 'Alla mängder är bekräftade.';

    var html = valkommen(r, fraga) +
      '<div class="tal" style="--n:4;margin-bottom:16px">' +
        '<div><small>Aktiva projekt</small><b><span data-rakna="' + aktiva.length + '">' + aktiva.length + '</span></b><span>' + db.projekt.length + ' totalt</span></div>' +
        '<div><small>Att bekräfta</small><b><span data-rakna="' + vantar.reduce(function (t, x) { return t + x.n; }, 0) + '">' + vantar.reduce(function (t, x) { return t + x.n; }, 0) + '</span><em>delar</em></b><span>' + (vantar.length ? 'i ' + vantar.map(function (x) { return x.p.kund.split(' ')[0]; }).join(', ') : 'inget avspärrat') + '</span></div>' +
        '<div><small>Ute på offert</small><b><span data-rakna="' + Math.round(offertVarde) + '" data-format="kort">' + BP.kort(offertVarde) + '</span></b><span>material + tillval, exempelpriser</span></div>' +
        '<div><small>Nya svar och förfrågningar</small><b><span data-rakna="' + (svar + leads.length) + '">' + (svar + leads.length) + '</span></b><span>' + svar + ' från partner · ' + leads.length + ' från konsumenter</span></div>' +
      '</div>' +
      '<div class="rutnat rutnat--huvud"><div class="rutnat">' +
        '<section class="kort"><header class="kort__huvud"><h2>Projekten på linjen</h2><a class="knapp knapp--text knapp--liten" href="#/projekt" style="margin-left:auto">Alla projekt' + i('hoger') + '</a></header>' +
          '<table class="tabell tabell--svar"><thead><tr><th style="padding-left:16px">Projekt</th><th>Hus</th><th>Var</th><th class="tal-c">Material</th><th style="width:140px">Att bekräfta</th></tr></thead><tbody>' +
          db.projekt.map(function (p) {
            var h = BP.hus(p.hus), m = BP.mangdFor(p), ob = obekraftade(p).length;
            var ritOkalib = p.underlag === 'ritning' && p.ritning && !p.ritning.skala;
            return '<tr class="klickbar" data-g="ga" data-href="#/projekt/' + p.id + '"><td style="padding-left:16px"><b>' + e(p.namn) + '</b><small>' + e(p.kund) + ' · ' + e(p.ort) + '</small></td>' +
              '<td class="dolj-mobil">' + e(h ? h.namn : 'Egen ritning') + '</td><td>' + stegChip(p.steg) + '</td>' +
              '<td class="tal-c">' + (m.rader.length ? BP.kr(m.summa) : '<span style="color:var(--text-3)">–</span>') + '</td>' +
              '<td>' + (ritOkalib ? '<span class="chip chip--tejp">Skala saknas</span>' : ob ? '<span class="chip chip--tejp">' + ob + ' delar</span>' : '<span class="chip chip--gron">' + i('bock') + 'Klart</span>') + '</td></tr>';
          }).join('') + '</tbody></table></section>' +
          '<section class="kort"><header class="kort__huvud"><h2>Senaste händelser</h2></header><div class="delar">' + handelser.map(function (x) {
            return '<a class="del" href="#/projekt/' + x.p.id + '/handelser" style="text-decoration:none;grid-template-columns:auto minmax(0,1fr) auto;min-height:52px"><span class="avatar" style="--av:' + BP.avfarg(x.h.av) + '">' + BP.initialer(x.h.av) + '</span><div><b style="font-weight:500">' + e(x.h.text) + '</b><small>' + e(x.p.namn) + ' · ' + e(x.h.av) + '</small></div><small>' + BP.sedan(x.h.tid) + '</small></a>';
          }).join('') + '</div></section></div>' +
        '<div class="rutnat">' +
          '<section class="kort"><header class="kort__huvud"><h2>Linjen</h2><small style="margin-left:auto">' + db.projekt.length + ' projekt</small></header><div class="kort__kropp"><ol class="stationer">' + perSteg.map(function (x, n) {
            return '<li class="' + (x.l.length ? 'har' : '') + '"><i></i><div><b>' + x.s.namn + '</b><span class="chip">' + x.l.length + '</span></div>' +
              (x.l.length ? '<ul>' + x.l.map(function (p) { return '<li><a href="#/projekt/' + p.id + '">' + e(p.namn) + '</a><small>' + e(p.kund) + '</small></li>'; }).join('') + '</ul>' : '<small class="stationer__tom">Inga projekt här</small>') + '</li>';
          }).join('') + '</ol></div></section>' +
          '<section class="kort"><header class="kort__huvud"><h2>Från konsumentsidan</h2>' + (leads.length ? '<span class="chip chip--bla">' + leads.length + ' nya</span>' : '') + '</header>' +
            (leads.length ? '<div class="delar">' + leads.map(function (l) {
              var h = BP.hus(l.hus);
              return '<div class="del"><span class="avatar" style="--av:' + BP.avfarg(l.namn) + '">' + BP.initialer(l.namn) + '</span><div><b>' + e(l.namn) + '</b><small>' + e(h ? h.namn : '') + ' · ' + e(l.ort) + ' · ' + BP.sedan(l.tid) + '</small></div>' +
                '<button class="knapp knapp--liten" type="button" data-g="lead-projekt" data-id="' + l.id + '">Skapa projekt</button></div>';
            }).join('') + '</div>' : '<div class="kort__kropp"><p class="tomt">Inga nya förfrågningar. De som skickas från konsumentsidan hamnar här.</p></div>') + '</section>' +
        '</div></div>';
    return {
      titel: 'Översikt', html: html,
      efter: function (rot) {
        // Huset i välkomstkortet andas: det glider isär och ihop i lugn takt medan det snurrar.
        var mv = $('.valkommen model-viewer', rot);
        if (!mv) return;
        BP.laddaMV(function () {
          var start = function () {
            mv.play(); mv.pause();
            if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { mv.currentTime = 0.5; mv.removeAttribute('auto-rotate'); return; }
            var t0 = performance.now();
            var steg = function (t) {
              if (!document.body.contains(mv)) return;
              var fas = ((t - t0) / 9000) % 1;
              mv.currentTime = (0.05 + 0.32 * (0.5 - 0.5 * Math.cos(fas * Math.PI * 2))) * 0.999;
              requestAnimationFrame(steg);
            };
            requestAnimationFrame(steg);
          };
          if (mv.loaded) start(); else mv.addEventListener('load', start, { once: true });
        });
      }
    };
  };

  /* Välkomstkortet (som i Idealhus CRM och Uperformance): hälsning, dagen i en
     mening, "Börja här" med det viktigaste att göra, och huset i 3D. */
  var DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  var MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var skjutna = {};
  function vecka(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }

  function borjaHar() {
    var db = BP.db, kand = [];
    db.projekt.forEach(function (p) {
      var ob = obekraftade(p).length;
      if (ob) kand.push({ id: 'b-' + p.id, p: p, ikon: 'mangd', titel: 'Bekräfta ' + ob + (ob === 1 ? ' byggdel' : ' byggdelar'), under: p.namn + ' · ' + p.kund, status: ob + ' avspärrade', knappar: '<a class="knapp knapp--gul" href="#/projekt/' + p.id + '/mangd">' + i('mangd') + 'Öppna mängden</a><button class="knapp" type="button" data-g="bekrafta-alla" data-id="' + p.id + '">' + i('bock') + 'Bekräfta alla</button>' });
      if (p.underlag === 'ritning' && p.ritning && !p.ritning.skala) kand.push({ id: 's-' + p.id, p: p, ikon: 'linjal', titel: 'Sätt skalan på ritningen', under: p.namn + ' · ' + p.kund, status: 'Skala saknas', knappar: '<a class="knapp knapp--gul" href="#/projekt/' + p.id + '/ritning">' + i('linjal') + 'Öppna ritningen</a>' });
    });
    db.leads.filter(function (l) { return l.status === 'ny'; }).forEach(function (l) {
      kand.push({ id: 'l-' + l.id, ikon: 'kund', titel: 'Svara ' + l.namn, under: (BP.hus(l.hus) || {}).namn + ' · ' + l.ort + ' · ' + BP.sedan(l.tid), status: 'Ny förfrågan', knappar: '<button class="knapp knapp--gul" type="button" data-g="lead-projekt" data-id="' + l.id + '">' + i('plus') + 'Skapa projekt</button>' });
    });
    return kand.filter(function (k) { return !skjutna[k.id]; });
  }

  function valkommen(r, fraga) {
    var nu = new Date(), dag = DAGAR[nu.getDay()];
    var kand = borjaHar(), k = kand[0];
    var aktiv = BP.db.projekt.filter(function (p) { return p.steg !== 'order' && p.hus; })[0];
    var hus = (k && k.p && BP.hus(k.p.hus)) || (aktiv && BP.hus(aktiv.hus)) || window.BP_DATA.HUS[1];
    var timme = nu.getHours(), halsning = timme < 10 ? 'God morgon' : timme < 18 ? 'Hej' : 'God kväll';
    return '<section class="valkommen" aria-labelledby="valkommen-rubrik">' +
      '<div class="valkommen__text">' +
        '<h1 id="valkommen-rubrik">' + halsning + ', <em>' + e(r.person.split(' ')[0]) + '.</em></h1>' +
        '<p class="valkommen__dag">' + dag.charAt(0).toUpperCase() + dag.slice(1) + ' ' + nu.getDate() + ' ' + MAN[nu.getMonth()] + ', vecka ' + vecka(nu) + '. ' + e(fraga) + '</p>' +
        (k ? '<article class="borja" aria-label="Börja här">' +
            '<div class="borja__rad"><span class="borja__ikon">' + i(k.ikon) + '</span><div class="borja__text"><b>' + e(k.titel) + '</b><small>' + e(k.under) + '</small></div><span class="chip chip--tejp">' + e(k.status) + '</span></div>' +
            '<div class="borja__knappar">' + k.knappar + '<button class="knapp knapp--text" type="button" data-g="skjut-upp" data-id="' + k.id + '">Skjut till i morgon</button>' +
            (kand.length > 1 ? '<small class="borja__fler">+ ' + (kand.length - 1) + ' till att göra</small>' : '') + '</div></article>'
          : '<article class="borja borja--klar"><div class="borja__rad"><span class="borja__ikon">' + i('bock') + '</span><div class="borja__text"><b>Inget väntar på dig</b><small>Alla mängder är bekräftade och alla förfrågningar besvarade.</small></div></div></article>') +
      '</div>' +
      '<a class="valkommen__scen" href="' + (k && k.p ? '#/projekt/' + k.p.id + '/mangd' : '#/bibliotek/' + hus.id) + '" aria-label="Öppna ' + e(hus.namn) + '">' +
        '<model-viewer src="' + BP.sprangSrc(hus) + '" alt="' + e(hus.namn) + ' i 3D" animation-name="sprang" interaction-prompt="none" auto-rotate auto-rotate-delay="0" rotation-per-second="9deg" shadow-intensity="0.8" shadow-softness="1" exposure="1.05" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="32deg 72deg 66%" camera-target="auto 1.6m auto" field-of-view="26deg" disable-zoom disable-pan></model-viewer>' +
        '<span class="valkommen__hus"><b>' + e(hus.namn) + '</b><small>' + (k && k.p ? e(k.p.namn) : hus.kategori + ' · ' + hus.yta + ' m²') + '</small></span></a>' +
    '</section>';
  }

  G['skjut-upp'] = function (el) { skjutna[el.getAttribute('data-id')] = true; BP.rita(); };

  G.ga = function (el) {
    // Projektnamnet i raden glider upp och blir skyltens rubrik.
    if (/#\/projekt\/[^/]+/.test(el.getAttribute('data-href'))) BP.delat(el.querySelector('b'), 'projekt-namn');
    BP.ga(el.getAttribute('data-href'));
  };
  G['lead-projekt'] = function (el) {
    var l = BP.db.leads.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (!l) return;
    var p = BP.nyttProjekt({ namn: (BP.hus(l.hus) || {}).namn + ' åt ' + l.namn, kund: l.namn, ort: l.ort, hus: l.hus });
    l.status = 'projekt';
    l.projekt = p.id;
    if (l.tillval) Object.keys(l.tillval).forEach(function (k) { p.tillval[k] = l.tillval[k]; });
    BP.handelse(p, 'Skapat från konsumentsidan: "' + l.text + '"');
    BP.spara();
    BP.toast('Projekt skapat', p.namn);
    BP.ga('#/projekt/' + p.id);
  };

  BP.nyttProjekt = function (o) {
    var h = BP.hus(o.hus);
    var g = h ? M.delarForHus(h) : { delar: [], antaganden: [] };
    g.delar.forEach(function (d) { d.bekraftad = d.typ !== 'vagg'; });
    var p = {
      id: 'p' + Date.now().toString(36), namn: o.namn, kund: o.kund || 'Ny kund', ort: o.ort || '', hus: o.hus || null,
      steg: o.underlag === 'ritning' ? 'underlag' : 'mangd', skapad: new Date().toISOString(),
      deltagare: [BP.roll().person].concat(o.kund ? [o.kund] : []), tillval: { fasad: 'svart', tak: 'plat', altan: 'ingen', invandig: 'gips' },
      underlag: o.underlag || 'modell', delar: o.underlag === 'ritning' ? [] : g.delar, antaganden: o.underlag === 'ritning' ? [] : g.antaganden,
      ritning: o.ritning || null, forfragningar: [], konsulter: [], handelser: []
    };
    BP.handelse(p, 'Projektet skapades');
    BP.db.projekt.unshift(p);
    return p;
  };

  /* ===== Projektlistan ======================================================== */
  BP.vyer.projekt = function (del) {
    if (del[0]) return projektrum(del[0], del[1] || 'mangd');
    var db = BP.db;
    var html = '<div class="titelrad"><div class="titelrad__text"><h1>Projekt</h1><p class="titelrad__under">' + db.projekt.length + ' projekt, från underlag till order.</p></div>' +
      '<div class="titelrad__knappar"><a class="knapp knapp--primar" href="#/mangdning/ny">' + i('plus') + 'Nytt projekt</a></div></div>' +
      '<section class="kort"><table class="tabell tabell--svar"><thead><tr><th style="padding-left:16px">Projekt</th><th>Kund</th><th>Hus</th><th>Var</th><th class="tal-c">Material</th><th class="tal-c">Tillval</th><th>Skapat</th></tr></thead><tbody>' +
      db.projekt.map(function (p) {
        var h = BP.hus(p.hus), m = BP.mangdFor(p);
        return '<tr class="klickbar" data-g="ga" data-href="#/projekt/' + p.id + '"><td style="padding-left:16px"><b>' + e(p.namn) + '</b><small>' + e(p.ort) + '</small></td><td class="dolj-mobil">' + e(p.kund) + '</td>' +
          '<td class="dolj-mobil">' + e(h ? h.namn : 'Egen ritning') + '</td><td>' + stegChip(p.steg) + '</td>' +
          '<td class="tal-c">' + (m.rader.length ? BP.kr(m.summa) : '–') + '</td><td class="tal-c dolj-mobil">' + (BP.tillvalSumma(p) ? '+' + BP.kr(BP.tillvalSumma(p)) : '0 kr') + '</td><td class="dolj-mobil">' + BP.datum(p.skapad) + '</td></tr>';
      }).join('') + '</tbody></table></section>';
    return { titel: 'Projekt', html: html };
  };

  /* ===== Projektrummet ========================================================== */
  function skylt(p, knappar) {
    var h = BP.hus(p.hus), r = BP.roll();
    return '<section class="skylt" aria-label="Projektets skylt"><div>' +
        '<h1><span class="skylt__plat" aria-hidden="true"></span><span class="skylt__namn">' + e(p.namn) + '</span></h1>' +
        '<div class="skylt__falt"><div><small>Byggherre</small><b>' + e(p.kund) + '</b></div><div><small>Ort</small><b>' + e(p.ort || '–') + '</b></div>' +
        '<div><small>Underlag</small><b>' + (p.underlag === 'ritning' ? 'Egen ritning' : e(h ? h.kategori + ' · ' + h.namn : '–')) + '</b></div>' +
        '<div><small>Entreprenör</small><b>' + e(r.foretag || '–') + '</b></div><div><small>Kontakt</small><b>' + e(r.person) + '</b></div></div>' +
      '</div><div class="skylt__hoger">' + linje(p.steg) + '<div class="titelrad__knappar">' + knappar + '</div></div>' + stampel(p) + '</section>';
  }

  // Stämpeln GODKÄND: slås på skylten när mängden godkänns (en gång, med
  // landning och duns) och sitter sedan kvar med datum och namn.
  function stampel(p) {
    if (p.steg !== 'offert' && p.steg !== 'order') return '';
    var tid = p.godkand || (p.handelser.filter(function (h) { return /bekräftade|godkändes/i.test(h.text); })[0] || {}).tid || p.skapad;
    var av = p.godkandAv || 'Lina Berg';
    var ny = BP.stampla === p.id;
    if (ny) BP.stampla = null;
    return '<div class="stampel' + (ny ? ' stampel--ny' : '') + '" role="img" aria-label="Mängden godkänd ' + BP.datum(tid) + ' av ' + e(av) + '"><b>Mängd godkänd</b><small>' + BP.datum(tid) + ' · ' + e(av) + '</small></div>';
  }

  function flikar(p, flik) {
    var f = [['mangd', 'Mängd'], ['ritning', 'Ritning'], ['tillval', 'Tillval'], ['forfragningar', 'Förfrågningar'], ['konsulter', 'Konsulter'], ['handelser', 'Händelser']];
    var ob = obekraftade(p).length;
    return '<nav class="flikar" aria-label="Projektets delar">' + f.map(function (x) {
      var extra = x[0] === 'mangd' && ob ? '<span class="chip chip--tejp">' + ob + '</span>' : x[0] === 'forfragningar' && p.forfragningar.length ? '<span class="chip">' + p.forfragningar.length + '</span>' : '';
      return '<a href="#/projekt/' + p.id + '/' + x[0] + '"' + (x[0] === flik ? ' aria-current="page"' : '') + '>' + x[1] + extra + (x[0] === flik ? '<i class="flikmarkor" aria-hidden="true"></i>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  function projektrum(id, flik) {
    var p = BP.projekt(id);
    if (!p) return { titel: 'Projektet finns inte', html: '<p class="tomt">Projektet finns inte längre. <a href="#/projekt">Till projekten</a></p>' };
    var vyn = BP.flikvyer[flik] || BP.flikvyer.mangd;
    var ut = vyn(p);
    var ob = obekraftade(p).length;
    var knappar = p.steg === 'mangd' || p.steg === 'underlag'
      ? '<button class="knapp knapp--primar" type="button" data-g="godkann-mangd" data-id="' + p.id + '"' + (ob || !BP.mangdFor(p).rader.length ? ' aria-disabled="true" data-tips="' + (ob ? ob + ' byggdelar är inte bekräftade' : 'Mängden är tom') + '"' : '') + '>' + i('bock') + 'Godkänn mängd</button>'
      : p.steg === 'offert'
        ? '<button class="knapp knapp--primar" type="button" data-g="lagg-order" data-id="' + p.id + '">' + i('skicka') + 'Lägg order</button>'
        : '<span class="chip chip--gron">' + i('bock') + 'Order lagd</span>';
    knappar = '<a class="knapp" href="#/kalkyl/' + p.id + '">' + i('kalkyl') + 'Kalkyl och offert</a>' + knappar;
    return {
      titel: p.namn,
      bred: flik === 'ritning',
      html: '<div class="smula"><a href="#/projekt">Projekt</a>' + i('hoger') + '<span>' + e(p.namn) + '</span></div><div style="height:8px"></div>' +
        skylt(p, knappar) + flikar(p, flik) + ut.html,
      efter: ut.efter
    };
  }

  G['godkann-mangd'] = function (el) {
    if (el.getAttribute('aria-disabled') === 'true') {
      BP.toast('Inte än', el.getAttribute('data-tips'));
      var forsta = $('tr.obekraftad, .del.obekraftad');
      if (forsta) forsta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var p = BP.projekt(el.getAttribute('data-id'));
    p.steg = 'offert';
    p.godkand = new Date().toISOString();
    p.godkandAv = BP.roll().person;
    BP.stampla = p.id;
    BP.handelse(p, 'Mängden godkändes – ' + BP.mangdFor(p).rader.length + ' rader, ' + BP.kr(BP.mangdFor(p).summa));
    BP.spara(); BP.rita(); BP.toast('Mängden är godkänd', 'Projektet ligger nu på Offert');
  };
  G['lagg-order'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    p.steg = 'order';
    BP.handelse(p, 'Order lagd');
    BP.spara(); BP.rita(); BP.toast('Order lagd', p.namn);
  };

  BP.flikvyer = {};

  /* --- Fliken Mängd: signaturen ------------------------------------------------ */
  var oppna = {};
  var gruppera = true;
  // Introt spelas en gång per projekt och session; sedan står huset där man lämnade det.
  var sprangSett = {};

  BP.flikvyer.mangd = function (p) {
    var delar = BP.delarFor(p);
    var m = BP.mangdFor(p);
    var h = BP.hus(p.hus);
    if (p.underlag === 'ritning' && (!p.ritning || !p.ritning.skala)) {
      return { html: '<div class="not not--tejp" style="max-width:720px">' + i('linjal') + '<span><b>Ritningen saknar skala.</b> Ange skalan med två punkter och ett känt mått, så räknas mängden fram. <a href="#/projekt/' + p.id + '/ritning">Öppna ritningen</a></span></div>' };
    }
    var ob = delar.filter(function (d) { return d.bekraftad === false; });
    var yta = h ? h.yta : delar.filter(function (d) { return d.typ === 'bjalklag'; }).reduce(function (t, d) { return t + d.langd * d.bredd; }, 0);
    var grupper = {};
    m.rader.forEach(function (r) { (grupper[r.grupp] = grupper[r.grupp] || []).push(r); });

    function rad(r) {
      var andel = r.brutto ? Math.max(0, Math.min(1, r.netto / r.brutto)) : 1;
      var best = r.forpackning ? r.forpackning.antal + ' ' + r.forpackning.namn + (r.forpackning.antal === 1 ? '' : (r.forpackning.namn === 'ask' ? 'ar' : r.forpackning.namn === 'låda' ? 'or' : 'ar')) : BP.tal(r.brutto) + '<span class="enhet">' + r.enhet + '</span>';
      if (r.forpackning && /paket$/.test(r.forpackning.namn)) best = r.forpackning.antal + ' paket';
      var kap = r.kapning ? '<span class="kap">' + r.kapning.perLangd.map(function (x) { return '<span>' + x.antal + ' × ' + BP.tal(x.langd, 1) + ' m</span>'; }).join('') + '</span>' : '';
      var oppen = oppna[p.id + r.material];
      return '<tr class="' + (r.obekraftad ? 'obekraftad ' : '') + (oppen ? 'oppen' : '') + '" data-rad="' + r.material + '" data-grupp="' + e(r.grupp) + '">' +
        '<td class="pos-c"><span class="pos">' + String(r.pos).padStart(2, '0') /* taste-skill-ignore: positionsnummer är data */ + '</span></td>' +
        '<td class="namn-c"><b>' + e(r.namn) + '</b><small>' + e(r.artikel) + (r.obekraftad ? '<span class="dold"> · bygger på obekräftade delar</span>' : '') + '</small></td>' +
        '<td class="tal-c dolj-mobil">' + BP.tal(r.netto) + '<span class="enhet">' + r.enhet + '</span></td>' +
        '<td class="dolj-mobil stapel-c"><div class="stapel" role="img" aria-label="Netto ' + BP.tal(r.netto) + ' av ' + BP.tal(r.brutto) + ', spill ' + BP.tal(r.spillProcent, 1) + ' procent"><i style="width:' + (andel * 100).toFixed(1) + '%"></i><i class="spill" style="left:' + (andel * 100).toFixed(1) + '%;width:' + ((1 - andel) * 100).toFixed(1) + '%"></i></div><small style="margin-top:4px">' + BP.tal(r.spillProcent, 1) + ' % spill</small></td>' +
        '<td class="tal-c best-c"><b>' + best + '</b>' + (kap ? '<div class="best-kap">' + kap + '</div>' : '') + '</td>' +
        '<td class="tal-c dolj-mobil">' + BP.kr(r.summa) + '<small>' + BP.tal(r.apris) + ' kr/' + e(r.prisEnhet) + '</small></td>' +
        '<td class="vik-c" style="width:44px"><button class="vik" type="button" data-g="vik-rad" data-id="' + p.id + '" data-mat="' + r.material + '" aria-expanded="' + !!oppen + '" aria-label="Visa hur ' + e(r.namn) + ' räknats">' + i('hoger') + '</button></td></tr>' +
        (oppen ? detalj(r) : '');
    }

    function detalj(r) {
      var vansterKol = '<div><h3>Var mängden kommer ifrån</h3><ul class="kallor">' + r.kallor.map(function (k) {
        return '<li><span><b>' + e(k.delnamn) + '</b>' + (k.bekraftad ? '' : ' <span class="chip chip--tejp" style="height:18px">obekräftad</span>') + '<small>' + e(k.hur) + '</small></span><b>' + BP.tal(k.mangd) + '</b></li>';
      }).join('') + '</ul></div>';
      var hoger = '';
      if (r.kapning) {
        var langd = Math.max.apply(null, r.kapning.stanger.map(function (s) { return s.langd; }));
        var visa = r.kapning.stanger.slice(0, 8);
        hoger = '<div><h3>Kapning – ' + r.kapning.antal + ' stänger, ' + BP.tal(r.kapning.utnyttjande, 1) + ' % utnyttjat</h3><div class="stanger">' + visa.map(function (s) {
          return '<div class="stang-rad"><b>' + BP.tal(s.langd, 1) + ' m</b><div class="stang" style="width:' + (s.langd / langd * 100).toFixed(1) + '%">' + s.bitar.map(function (b) { return '<i style="width:' + (b / s.langd * 100).toFixed(2) + '%" title="' + BP.tal(b) + ' m"></i>'; }).join('') + '</div><span>' + BP.tal(s.spill, 2) + ' m spill</span></div>';
        }).join('') + (r.kapning.stanger.length > 8 ? '<small style="color:var(--text-3)">+ ' + (r.kapning.stanger.length - 8) + ' stänger till</small>' : '') + '</div></div>';
      } else if (r.forpackning) {
        hoger = '<div><h3>Förpackning</h3><dl class="grop"><div><dt>Behov med spill</dt><dd><b>' + BP.tal(r.brutto) + ' ' + r.enhet + '</b></dd></div><div><dt>Per ' + r.forpackning.namn + '</dt><dd><b>' + BP.tal(r.forpackning.innehall) + ' ' + r.enhet + '</b></dd></div><div><dt>Att beställa</dt><dd><b>' + r.forpackning.antal + ' ' + r.forpackning.namn + '</b></dd></div></dl></div>';
      } else {
        hoger = '<div><h3>Spill</h3><dl class="grop"><div><dt>Netto</dt><dd><b>' + BP.tal(r.netto) + ' ' + r.enhet + '</b></dd></div><div><dt>Spill enligt materialet</dt><dd><b>' + BP.tal(r.spillProcent, 1) + ' %</b></dd></div><div><dt>Att beställa</dt><dd><b>' + BP.tal(r.brutto) + ' ' + r.enhet + '</b></dd></div></dl></div>';
      }
      return '<tr class="detalj"><td colspan="7"><div class="detalj__rutnat">' + vansterKol + hoger + '</div></td></tr>';
    }

    var tabell = '<div class="tabellram"><table class="tabell mangd tabell--svar"><thead><tr><th style="padding-left:16px">Pos</th><th>Material</th><th class="tal-c">Netto</th><th class="dolj-mobil stapel-c">Netto och spill</th><th class="tal-c">Att beställa</th><th class="tal-c dolj-mobil">Summa</th><th><span class="dold">Visa</span></th></tr></thead><tbody>' +
      (gruppera
        ? Object.keys(grupper).map(function (g) {
          var s = grupper[g].reduce(function (t, r) { return t + r.summa; }, 0);
          return '<tr class="grupprad" data-grupp="' + e(g) + '"><td colspan="5" style="padding-left:16px">' + e(g) + '</td><td class="tal-c dolj-mobil">' + BP.kr(s) + '</td><td></td></tr>' + grupper[g].map(rad).join('');
        }).join('')
        : m.rader.map(rad).join('')) +
      '</tbody></table></div>';

    var antagHtml = p.antaganden && p.antaganden.length && p.underlag !== 'ritning'
      ? '<section class="kort"><header class="kort__huvud"><h2>Antaganden</h2><small>ändra så räknas allt om</small></header><div class="kort__kropp"><div class="noter">' +
        p.antaganden.map(function (a) { return '<div class="not not--varning">' + i('info') + '<span>' + e(a) + '</span></div>'; }).join('') + '</div>' +
        '<div class="falt-rad" style="margin-top:14px"><label class="falt"><span>Vägghöjd, m</span><input class="inmatning inmatning--tal" type="number" step="0.05" min="2" max="4" value="' + (delar.filter(function (d) { return d.typ === 'vagg'; })[0] || {}).hojd + '" data-antag="vh"></label>' +
        '<label class="falt"><span>Fönster, st</span><input class="inmatning inmatning--tal" type="number" step="1" min="0" max="20" value="' + ((((delar[0] || {}).oppningar || []).filter(function (o) { return o.typ === 'fonster'; })[0]) || { antal: 0 }).antal + '" data-antag="fonster"></label></div></div></section>'
      : '';

    var kontroll = '<section class="kort"><header class="kort__huvud"><h2>Kontroller</h2>' + (m.varningar.filter(function (v) { return v.niva !== 'obekraftad'; }).length ? '' : '<span class="chip chip--gron">' + i('bock') + 'Inga fel</span>') + '</header><div class="kort__kropp"><div class="noter">' +
      m.varningar.filter(function (v) { return v.niva !== 'obekraftad'; }).map(function (v) {
        return '<div class="not not--' + (v.niva === 'fel' ? 'fel' : v.niva === 'info' ? 'info' : 'varning') + '">' + i(v.niva === 'info' ? 'info' : 'varning') + '<span>' + e(v.text) + '</span></div>';
      }).join('') +
      '<div class="not">' + i('info') + '<span>Rimlighet: <b>' + BP.kr(yta ? m.summa / yta : 0) + '/m²</b> i material för ' + BP.tal(yta) + ' m². Jämför med husen i biblioteket: ' + BP.kr(minMax().min) + '–' + BP.kr(minMax().max) + '/m².</span></div>' +
      '</div></div></section>';

    var delkort = '<section class="kort"><header class="kort__huvud"><h2>Byggdelar</h2>' + (ob.length ? '<span class="chip chip--tejp">' + ob.length + ' att bekräfta</span>' : '<span class="chip chip--gron">' + i('bock') + 'Alla bekräftade</span>') + '</header><div class="delar">' +
      delar.map(function (d) {
        var matt = d.typ === 'vagg' ? BP.tal(d.langd) + ' × ' + BP.tal(d.hojd) + ' m' + ((d.oppningar || []).length ? ' · ' + d.oppningar.reduce(function (t, o) { return t + (o.antal || 1); }, 0) + ' öppn.' : '') : BP.tal(d.langd) + ' × ' + BP.tal(d.bredd) + ' m' + (d.typ === 'tak' ? ' · ' + BP.tal(d.lutning, 0) + '°' : '');
        return '<div class="del' + (d.bekraftad === false ? ' obekraftad' : '') + '" data-del="' + d.id + '"><span class="typikon">' + i(TYPIKON[d.typ] || 'vagg') + '</span><div><b>' + e(d.namn) + '</b><small>' + matt + ' · ' + e((BP.recept()[d.recept] || {}).namn || 'inget recept') + '</small></div>' +
          '<button class="bock" type="button" data-g="bekrafta" data-id="' + p.id + '" data-del="' + d.id + '" aria-pressed="' + (d.bekraftad !== false) + '" aria-label="' + (d.bekraftad !== false ? 'Bekräftad: ' : 'Bekräfta ') + e(d.namn) + '">' + i('bock') + '</button></div>';
      }).join('') + '</div>' +
      (ob.length > 1 ? '<div class="kort__kropp" style="border-top:1px solid var(--regel)"><button class="knapp" type="button" data-g="bekrafta-alla" data-id="' + p.id + '">' + i('bock') + 'Bekräfta alla ' + ob.length + '</button></div>' : '') + '</section>';

    var html = (h ? BP.sprangHtml({ hus: h, mangd: m, id: 'sprang-' + p.id, hojd: 420 }) : '') +
      '<div class="rutnat rutnat--huvud">' +
      '<section class="kort"><header class="kort__huvud"><h2>Materiallista</h2><small>' + m.rader.length + ' rader · ' + BP.kr(m.summa) + ' i exempelpriser</small>' +
        '<div class="kort__verktyg"><div class="segment" role="group" aria-label="Visning"><button type="button" data-g="gruppera" aria-pressed="' + gruppera + '">Grupper</button><button type="button" data-g="gruppera" data-av="1" aria-pressed="' + !gruppera + '">Lista</button></div>' +
        '<button class="knapp knapp--liten" type="button" data-g="exportera" data-id="' + p.id + '" data-format="csv">' + i('ladda') + 'Excel</button><button class="knapp knapp--liten" type="button" data-g="exportera" data-id="' + p.id + '" data-format="pdf">' + i('skrivut') + 'PDF</button><button class="knapp knapp--liten" type="button" data-g="exportera" data-id="' + p.id + '" data-format="json">JSON</button></div></header>' +
        (ob.length ? '<div class="kort__kropp" style="padding-bottom:0"><div class="not not--tejp"><span><b>' + ob.length + ' byggdelar är avspärrade.</b> Rader med tejp bygger på mått som ingen bekräftat än. Kontrollera måtten under Byggdelar och bocka av.</span></div></div>' : '') +
        tabell + '</section>' +
      '<div class="rutnat">' + delkort + antagHtml + kontroll + '</div></div>';
    return {
      html: html,
      efter: function (rot) {
        var sp = h ? BP.sprangKoppla(rot, { utanIntro: !!sprangSett[p.id], start: sprangSett[p.id] }) : null;
        if (sp) {
          sprangSett[p.id] = sprangSett[p.id] || 0.62;
          $$('.mangd tr[data-grupp]', rot).forEach(function (tr) {
            tr.addEventListener('mouseenter', function () { sp.markera(tr.getAttribute('data-grupp')); });
            tr.addEventListener('mouseleave', function () { sp.markera(null); });
          });
          var reg = $('[data-sprang-reglage]', rot);
          if (reg) reg.addEventListener('change', function () { sprangSett[p.id] = reg.value / 100 || 0.001; });
        }
        $$('[data-antag]', rot).forEach(function (inp) {
          inp.addEventListener('change', function () {
            var v = parseFloat(inp.value);
            if (isNaN(v)) return;
            p.delar.forEach(function (d) {
              if (d.typ !== 'vagg') return;
              if (inp.getAttribute('data-antag') === 'vh') { d.hojd = v; d.bekraftad = false; }
              if (inp.getAttribute('data-antag') === 'fonster') (d.oppningar || []).forEach(function (o) { if (o.typ === 'fonster') { o.antal = Math.max(0, Math.round(v)); d.bekraftad = false; } });
            });
            p.antaganden = p.antaganden.map(function (a) {
              if (inp.getAttribute('data-antag') === 'vh' && /^Vägghöjd/.test(a)) return 'Vägghöjd ' + BP.tal(v) + ' m (ändrad för hand – bekräfta väggarna)';
              if (inp.getAttribute('data-antag') === 'fonster' && /fönster/.test(a)) return Math.round(v) + ' fönster 12 × 12 (ändrat för hand)';
              return a;
            });
            BP.handelse(p, 'Antagande ändrat: ' + (inp.getAttribute('data-antag') === 'vh' ? 'vägghöjd ' + BP.tal(v) + ' m' : Math.round(v) + ' fönster'));
            BP.spara(); BP.rita();
          });
        });
      }
    };
  };

  var mm = null;
  function minMax() {
    if (mm) return mm;
    var v = D.HUS.map(function (h) { var g = M.delarForHus(h); return M.mangda(g.delar, BP.recept(), BP.material()).summa / h.yta; });
    mm = { min: Math.min.apply(null, v), max: Math.max.apply(null, v) };
    return mm;
  }

  G['vik-rad'] = function (el) { var k = el.getAttribute('data-id') + el.getAttribute('data-mat'); oppna[k] = !oppna[k]; BP.rita(); };
  G.gruppera = function (el) { gruppera = !el.getAttribute('data-av'); BP.rita(); };

  // Bekräfta en byggdel: tejpen dras bort först (220 ms), sedan ritas listan om.
  G.bekrafta = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    var id = el.getAttribute('data-del');
    var d = BP.delarFor(p).filter(function (x) { return x.id === id; })[0];
    var kalla = p.underlag === 'ritning' ? p.ritning.element.filter(function (x) { return x.id === id || id.indexOf(x.id + '-') === 0; })[0] : d;
    if (!kalla) return;
    var ny = kalla.bekraftad === false;
    kalla.bekraftad = ny;
    el.setAttribute('aria-pressed', String(ny));
    var rad = el.closest('.del');
    if (ny && rad) rad.classList.add('bekraftas');
    if (ny) {
      $$('tr.obekraftad').forEach(function (tr) { tr.classList.add('bekraftas'); });
    }
    BP.handelse(p, (ny ? 'Bekräftade ' : 'Tog bort bekräftelsen på ') + (d ? d.namn : id).toLowerCase());
    BP.spara();
    setTimeout(BP.rita, ny ? 240 : 0);
  };
  G['bekrafta-alla'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    $$('.del.obekraftad').forEach(function (r) { r.classList.add('bekraftas'); });
    $$('tr.obekraftad').forEach(function (r) { r.classList.add('bekraftas'); });
    if (p.underlag === 'ritning') p.ritning.element.forEach(function (x) { x.bekraftad = true; });
    else p.delar.forEach(function (x) { x.bekraftad = true; });
    BP.handelse(p, 'Bekräftade alla byggdelar');
    BP.spara();
    setTimeout(function () { BP.rita(); BP.toast('Alla byggdelar bekräftade', 'Tejpen är borta – mängden kan godkännas'); }, 240);
  };

  /* --- Export ---------------------------------------------------------------- */
  function ladda(namn, typ, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: typ }));
    a.download = namn;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  G.exportera = function (el) {
    var p = BP.projekt(el.getAttribute('data-id')), m = BP.mangdFor(p), f = el.getAttribute('data-format');
    var fil = p.namn.replace(/[^\wåäöÅÄÖ]+/g, '-').replace(/-+$/, '') + '-materiallista';
    if (f === 'csv') {
      var rader = [['Pos', 'Grupp', 'Artikel', 'Material', 'Netto', 'Enhet', 'Spill %', 'Att beställa', 'Förpackning', 'Kapning', 'À-pris (exempel)', 'Summa (exempel)', 'Bekräftad', 'Källa']];
      m.rader.forEach(function (r) {
        rader.push([r.pos, r.grupp, r.artikel, r.namn, BP.tal(r.netto), r.enhet, BP.tal(r.spillProcent, 1), BP.tal(r.brutto), r.forpackning ? r.forpackning.antal + ' ' + r.forpackning.namn : '',
          r.kapning ? r.kapning.perLangd.map(function (x) { return x.antal + ' × ' + BP.tal(x.langd, 1) + ' m'; }).join(', ') : '', r.apris, r.summa, r.obekraftad ? 'nej' : 'ja',
          r.kallor.map(function (k) { return k.delnamn + ': ' + k.hur; }).join(' | ')]);
      });
      var csv = '﻿' + rader.map(function (r) { return r.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n');
      ladda(fil + '.csv', 'text/csv;charset=utf-8', csv);
      BP.toast('Excel-filen är sparad', fil + '.csv');
    } else if (f === 'json') {
      ladda(fil + '.json', 'application/json', JSON.stringify({ projekt: { namn: p.namn, kund: p.kund, ort: p.ort, hus: p.hus }, byggdelar: BP.delarFor(p), rader: m.rader, varningar: m.varningar, summa: m.summa, exempelpriser: true }, null, 2));
      BP.toast('JSON-filen är sparad', fil + '.json');
    } else {
      var w = window.open('', '_blank');
      if (!w) { BP.toast('Fönstret blockerades', 'Tillåt popup-fönster för att skriva ut'); return; }
      w.document.write('<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>' + e(p.namn) + ' – materiallista</title><style>@font-face{font-family:Barlow;src:url(' + location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') + 'fonts/barlow-400.woff2)}@font-face{font-family:Barlow;font-weight:600;src:url(' + location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') + 'fonts/barlow-600.woff2)}body{font:12px/1.4 Barlow,sans-serif;color:#2b2722;margin:32px;font-variant-numeric:tabular-nums}h1{font-size:22px;margin:0}p{margin:4px 0 16px;color:#55534d}table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #e6e4de;text-align:left}th{font-weight:500;color:#6b6963}.t{text-align:right}.pos{display:inline-block;background:#2b2722;color:#fff;border-radius:4px;padding:1px 5px;font-weight:600}.g td{background:#f7f6f2;font-weight:600}tfoot td{font-weight:600;border-top:2px solid #2b2722}.ex{margin-top:16px;color:#6b6963}</style></head><body>' +
        '<h1>' + e(p.namn) + '</h1><p>Materiallista · ' + e(p.kund) + ' · ' + e(p.ort) + ' · ' + new Date().toLocaleDateString('sv-SE') + '</p><table><thead><tr><th>Pos</th><th>Material</th><th>Artikel</th><th class="t">Netto</th><th class="t">Att beställa</th><th class="t">Summa</th></tr></thead><tbody>' +
        m.rader.map(function (r) { return '<tr><td><span class="pos">' + String(r.pos).padStart(2, '0') + '</span></td><td>' + e(r.namn) + (r.kapning ? '<br><small>' + r.kapning.perLangd.map(function (x) { return x.antal + ' × ' + BP.tal(x.langd, 1) + ' m'; }).join(', ') + '</small>' : '') + '</td><td>' + e(r.artikel) + '</td><td class="t">' + BP.tal(r.netto) + ' ' + r.enhet + '</td><td class="t">' + (r.forpackning ? r.forpackning.antal + ' ' + r.forpackning.namn : BP.tal(r.brutto) + ' ' + r.enhet) + '</td><td class="t">' + BP.kr(r.summa) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="5">Summa material (exempelpriser)</td><td class="t">' + BP.kr(m.summa) + '</td></tr></tfoot></table><p class="ex">Priserna är exempel. Varje rad visar i plattformen hur den räknats.</p><script>window.onload=function(){window.print()}<\/script></body></html>');
      w.document.close();
    }
  };

  /* --- Fliken Händelser ------------------------------------------------------------ */
  BP.flikvyer.handelser = function (p) {
    return { html: '<section class="kort" style="max-width:820px"><div class="delar">' + p.handelser.map(function (h) {
      return '<div class="del"><span class="avatar" style="--av:' + BP.avfarg(h.av) + '">' + BP.initialer(h.av) + '</span><div><b style="font-weight:500">' + e(h.text) + '</b><small>' + e(h.av) + '</small></div><small>' + BP.sedan(h.tid) + '</small></div>';
    }).join('') + '</div></section>' };
  };

  /* ===== Mängdning: alla mängder och "Ny mängdning" ============================== */
  BP.vyer.mangdning = function (del) {
    if (del[0] === 'ny') return nyMangdning();
    var lista = BP.db.projekt;
    var html = '<div class="titelrad"><div class="titelrad__text"><h1>Mängdning</h1><p class="titelrad__under">Från underlag till kontrollerad materiallista. Avspärrade delar är inte bekräftade.</p></div>' +
      '<div class="titelrad__knappar"><a class="knapp knapp--primar" href="#/mangdning/ny">' + i('plus') + 'Ny mängdning</a></div></div>' +
      '<section class="kort"><table class="tabell tabell--svar"><thead><tr><th style="padding-left:16px">Projekt</th><th>Underlag</th><th class="tal-c">Rader</th><th class="tal-c">Material</th><th style="width:150px">Bekräftat</th><th></th></tr></thead><tbody>' +
      lista.map(function (p) {
        var m = BP.mangdFor(p), d = BP.delarFor(p), ok = d.filter(function (x) { return x.bekraftad !== false; }).length;
        var h = BP.hus(p.hus);
        var under = p.underlag === 'ritning' ? i('ritning') + ' Ritning' + (p.ritning && !p.ritning.skala ? ' · skala saknas' : '') : i('kub') + ' Modell ' + e(h ? h.namn : '');
        return '<tr class="klickbar" data-g="ga" data-href="#/projekt/' + p.id + '/' + (p.underlag === 'ritning' ? 'ritning' : 'mangd') + '"><td style="padding-left:16px"><b>' + e(p.namn) + '</b><small>' + e(p.kund) + '</small></td>' +
          '<td class="dolj-mobil"><span style="display:inline-flex;gap:6px;align-items:center">' + under + '</span></td><td class="tal-c">' + m.rader.length + '</td><td class="tal-c">' + (m.rader.length ? BP.kr(m.summa) : '–') + '</td>' +
          '<td>' + (d.length ? '<div class="stapel" style="width:100px" role="img" aria-label="' + ok + ' av ' + d.length + ' bekräftade"><i style="width:' + (ok / d.length * 100) + '%;background:' + (ok === d.length ? 'var(--gron)' : 'var(--text)') + '"></i></div><small style="margin-top:4px">' + ok + ' av ' + d.length + '</small>' : '<span class="chip chip--tejp">Inget avritat</span>') + '</td>' +
          '<td style="width:44px">' + i('hoger') + '</td></tr>';
      }).join('') + '</tbody></table></section>';
    return { titel: 'Mängdning', html: html };
  };

  function nyMangdning() {
    var html = '<div class="smula"><a href="#/mangdning">Mängdning</a>' + i('hoger') + '<span>Ny</span></div>' +
      '<div class="titelrad" style="margin-top:6px"><div class="titelrad__text"><h1>Ny mängdning</h1><p class="titelrad__under">Välj underlag. Allt som räknas visar sin källa, och det som inte är bekräftat spärras av tills någon godkänt det.</p></div></div>' +
      '<form class="kort" id="nyform" style="max-width:880px"><div class="kort__kropp" style="display:grid;gap:20px">' +
        '<div class="falt-rad"><label class="falt" style="flex:1;min-width:220px"><span>Projektnamn</span><input name="namn" required placeholder="t.ex. Attefallshus, Storgatan 4"></label>' +
        '<label class="falt" style="flex:1;min-width:180px"><span>Kund</span><input name="kund" placeholder="Namn"></label><label class="falt" style="width:180px"><span>Ort</span><input name="ort" placeholder="Ort"></label></div>' +
        '<fieldset style="border:0;margin:0;padding:0;display:grid;gap:10px"><legend style="font-weight:500;font-size:13px;margin-bottom:8px">Underlag</legend>' +
          '<div class="rutnat rutnat--3">' +
            underlagsval('modell', 'kub', 'Hus ur biblioteket', 'Exakt ur husets mått. Det ritningen inte anger blir antaganden du ser.', true) +
            underlagsval('ritning', 'uppladd', 'Ladda upp ritning', 'Bild eller PDF-utskrift. Sätt skalan, rita av väggar och ytor, bekräfta.', false) +
            underlagsval('skiss', 'ritning', 'Exempelritning', 'Prova verktyget på en planritning 1:50 som redan ligger inne.', false) +
          '</div></fieldset>' +
        '<label class="falt" data-visa="modell"><span>Hus</span><select name="hus">' + D.HUS.map(function (h) { return '<option value="' + h.id + '">' + e(h.namn) + ' · ' + h.kategori + ' · ' + h.yta + ' m²</option>'; }).join('') + '</select></label>' +
        '<label class="falt" data-visa="ritning" hidden><span>Ritning (PNG, JPG eller SVG)</span><input type="file" name="fil" accept="image/*"></label>' +
      '</div><div class="dialog__fot"><a class="knapp" href="#/mangdning">Avbryt</a><button class="knapp knapp--primar" type="submit">Skapa och mängda' + i('pil') + '</button></div></form>';
    return {
      titel: 'Ny mängdning', html: html,
      efter: function (rot) {
        var form = $('#nyform', rot);
        var val = function () { return form.underlag.value; };
        form.addEventListener('change', function () {
          $$('[data-visa]', form).forEach(function (f) { f.hidden = f.getAttribute('data-visa') !== val(); });
          $$('.underlagsval', form).forEach(function (l) { l.classList.toggle('vald', $('input', l).checked); });
        });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var namn = form.namn.value.trim() || 'Nytt projekt';
          var skapa = function (rit) {
            var p = BP.nyttProjekt({ namn: namn, kund: form.kund.value.trim(), ort: form.ort.value.trim(), hus: val() === 'modell' ? form.hus.value : null, underlag: val() === 'modell' ? 'modell' : 'ritning', ritning: rit });
            BP.spara();
            BP.ga('#/projekt/' + p.id + '/' + (val() === 'modell' ? 'mangd' : 'ritning'));
          };
          if (val() === 'ritning') {
            var f = form.fil.files[0];
            if (!f) { BP.toast('Välj en ritning först', 'PNG, JPG eller SVG'); return; }
            var rd = new FileReader();
            rd.onload = function () {
              var img = new Image();
              img.onload = function () { skapa({ namn: f.name, bild: rd.result, bredd: img.naturalWidth, hojd: img.naturalHeight, skala: null, element: [] }); };
              img.src = rd.result;
            };
            rd.readAsDataURL(f);
          } else if (val() === 'skiss') {
            var r = BP.exempelRitningTom();
            skapa(r);
          } else skapa(null);
        });
      }
    };
  }

  function underlagsval(v, ikon, titel, text, vald) {
    return '<label class="underlagsval' + (vald ? ' vald' : '') + '"><input type="radio" name="underlag" value="' + v + '"' + (vald ? ' checked' : '') + '><span class="typikon">' + i(ikon) + '</span><b>' + titel + '</b><small>' + text + '</small></label>';
  }

  /* ===== Biblioteket =========================================================== */
  BP.vyer.bibliotek = function (del) {
    if (del[0]) return husDetalj(del[0]);
    var kat = ['Alla'].concat(D.HUS.map(function (h) { return h.kategori; }).filter(function (k, n, a) { return a.indexOf(k) === n; }));
    var html = '<div class="titelrad"><div class="titelrad__text"><h1>Bibliotek</h1><p class="titelrad__under">' + D.HUS.length + ' husmodeller i 3D. Mängda direkt ur modellen eller låt kunden göra tillval.</p></div></div>' +
      '<nav class="flikar flikar--glid" aria-label="Kategori">' + kat.map(function (k, n) { return '<button type="button" data-g="bibl-kat" data-kat="' + k + '" aria-selected="' + (n === 0) + '">' + k + '<span class="chip">' + (k === 'Alla' ? D.HUS.length : D.HUS.filter(function (h) { return h.kategori === k; }).length) + '</span>' + (n === 0 ? '<i class="flikmarkor flikmarkor--lokal" aria-hidden="true"></i>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="husnat">' + D.HUS.map(function (h) {
        return '<a class="hus" href="#/bibliotek/' + h.id + '" data-kat="' + h.kategori + '"><div class="hus__bild"><img src="' + h.bild + '" alt="' + e(h.namn) + '" loading="lazy" decoding="async"></div>' +
          '<div class="hus__text"><div class="hus__rad"><b>' + e(h.namn) + '</b><span class="chip">' + h.kategori + '</span></div>' +
          '<div class="hus__fakta"><span>' + h.yta + ' m²</span><span>' + h.rum + (h.rum === 1 ? ' rum' : ' rum') + '</span><span>' + BP.tal(h.langd) + ' × ' + BP.tal(h.bredd) + ' m</span></div>' +
          '<small style="color:var(--text-3)">' + e(h.leverantor) + ' · 3D-modell</small></div></a>';
      }).join('') + '</div>';
    return { titel: 'Bibliotek', html: html };
  };
  G['bibl-kat'] = function (el) {
    var k = el.getAttribute('data-kat');
    BP.glidMarkor(el);
    $$('[data-g="bibl-kat"]').forEach(function (b) { b.setAttribute('aria-selected', String(b === el)); });
    $$('.hus').forEach(function (h) { h.hidden = k !== 'Alla' && h.getAttribute('data-kat') !== k; });
  };

  BP.laddaMV = function (klar) {
    if (window.customElements && customElements.get('model-viewer')) { klar(); return; }
    if (!document.getElementById('mv-skript')) {
      var s = document.createElement('script');
      s.type = 'module'; s.id = 'mv-skript'; s.src = 'vendor/model-viewer.min.js';
      document.head.appendChild(s);
    }
    customElements.whenDefined('model-viewer').then(klar);
  };

  function husDetalj(id) {
    var h = BP.hus(id);
    if (!h) return { html: '<p class="tomt">Huset finns inte.</p>' };
    var g = M.delarForHus(h), m = M.mangda(g.delar, BP.recept(), BP.material());
    var html = '<div class="smula"><a href="#/bibliotek">Bibliotek</a>' + i('hoger') + '<span>' + e(h.namn) + '</span></div>' +
      '<div class="titelrad" style="margin-top:6px"><div class="titelrad__text"><h1>' + e(h.namn) + '</h1><p class="titelrad__under">' + e(h.text) + '</p></div>' +
        '<div class="titelrad__knappar"><button class="knapp" type="button" data-g="hus-tillval" data-hus="' + h.id + '">' + i('tillval') + 'Gör tillval</button><button class="knapp knapp--primar" type="button" data-g="hus-mangd" data-hus="' + h.id + '">' + i('mangd') + 'Mängda huset</button></div></div>' +
      BP.sprangHtml({ hus: h, mangd: m, id: 'sprang-bibl', hojd: 480 }) +
      '<div class="rutnat rutnat--2">' +
          '<section class="kort"><header class="kort__huvud"><h2>Fakta ur ritningen</h2></header><div class="kort__kropp"><dl class="grop">' +
            '<div><dt>Kategori</dt><dd><b>' + h.kategori + '</b></dd></div><div><dt>Storlek</dt><dd><b>' + h.yta + ' m²</b></dd></div><div><dt>Rum</dt><dd><b>' + h.rum + '</b></dd></div>' +
            '<div><dt>Yttermått</dt><dd><b>' + BP.tal(h.langd) + ' × ' + BP.tal(h.bredd) + ' m</b></dd></div><div><dt>Nockhöjd</dt><dd><b>' + BP.tal(h.nock) + ' m</b></dd></div>' +
            '<div><dt>Tak</dt><dd><b>' + (h.tak === 'pulpet' ? 'Pulpettak' : 'Sadeltak') + (h.lutning != null ? ' ' + h.lutning + '°' : ' med takkupa') + '</b></dd></div></dl></div></section>' +
          '<section class="kort"><header class="kort__huvud"><h2>Mängden i korthet</h2><small>' + m.rader.length + ' rader</small></header><div class="kort__kropp"><dl class="grop">' +
            '<div><dt>Material, exempelpriser</dt><dd><b>' + BP.kr(m.summa) + '</b></dd></div><div><dt>Per m²</dt><dd><b>' + BP.kr(m.summa / h.yta) + '</b></dd></div>' +
            '<div><dt>Regelvirke</dt><dd><b>' + BP.tal((m.rader.filter(function (r) { return /^Regel/.test(r.namn); }).reduce(function (t, r) { return t + r.brutto; }, 0))) + ' m</b></dd></div>' +
            '<div><dt>Antaganden</dt><dd><b>' + g.antaganden.length + '</b></dd></div></dl>' +
            '<div class="noter" style="margin-top:12px">' + g.antaganden.map(function (a) { return '<div class="not not--varning">' + i('info') + '<span>' + e(a) + '</span></div>'; }).join('') + '</div></div></section>' +
        '</div>';
    return { titel: h.namn, html: html, efter: function (rot) { BP.sprangKoppla(rot, {}); } };
  }

  function valjProjektForHus(h, flik) {
    var p = BP.nyttProjekt({ namn: h.namn + ' – ny kalkyl', kund: '', ort: '', hus: h.id });
    BP.spara();
    BP.ga('#/projekt/' + p.id + '/' + flik);
  }
  G['hus-mangd'] = function (el) { valjProjektForHus(BP.hus(el.getAttribute('data-hus')), 'mangd'); BP.toast('Projekt skapat', 'Mängden räknades ur modellen'); };
  G['hus-tillval'] = function (el) { valjProjektForHus(BP.hus(el.getAttribute('data-hus')), 'tillval'); };
})();
