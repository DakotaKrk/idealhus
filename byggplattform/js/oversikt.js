/* Byggplattformen – översikten, premiumversionen.
   Ett inövat ögonblick, en gång per besök: skyltplåten tonar in, hälsningen
   stiger fram ord för ord, "Börja här" glider upp, huset byggs ihop i 3D
   (kranen sänker taket på plats) och projekten åker ut längs linjen till sin
   station. Sedan står allt still; huset dras isär när man håller musen över det. Senare besök och
   reducerad rörelse hoppar över entrén. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;
  var sett = false;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  var DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  var MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var STEG = { underlag: 'Underlag', mangd: 'Mängd', offert: 'Offert', order: 'Order' };
  var skjutna = {};

  function vecka(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  function obekr(p) { return BP.delarFor(p).filter(function (d) { return d.bekraftad === false; }).length; }
  function skalaSaknas(p) { return p.underlag === 'ritning' && p.ritning && !p.ritning.skala; }

  function borjaHar() {
    var kand = [];
    BP.db.projekt.forEach(function (p) {
      var ob = obekr(p);
      if (ob) kand.push({ id: 'b-' + p.id, p: p, ikon: 'mangd', titel: 'Bekräfta ' + ob + (ob === 1 ? ' byggdel' : ' byggdelar'), under: p.namn + ' · ' + p.kund, status: ob + ' avspärrade', knappar: '<a class="knapp knapp--gul" href="#/projekt/' + p.id + '/mangd">' + i('mangd') + 'Öppna mängden</a><button class="knapp knapp--morkplat" type="button" data-g="bekrafta-alla" data-id="' + p.id + '">' + i('bock') + 'Bekräfta alla</button>' });
      if (skalaSaknas(p)) kand.push({ id: 's-' + p.id, p: p, ikon: 'linjal', titel: 'Sätt skalan på ritningen', under: p.namn + ' · ' + p.kund, status: 'Skala saknas', knappar: '<a class="knapp knapp--gul" href="#/projekt/' + p.id + '/ritning">' + i('linjal') + 'Öppna ritningen</a>' });
    });
    BP.db.leads.filter(function (l) { return l.status === 'ny'; }).forEach(function (l) {
      kand.push({ id: 'l-' + l.id, l: l, ikon: 'kund', titel: 'Svara ' + l.namn, under: (BP.hus(l.hus) || {}).namn + ' · ' + l.ort + ' · ' + BP.sedan(l.tid), status: 'Ny förfrågan', knappar: '<button class="knapp knapp--gul" type="button" data-g="lead-projekt" data-id="' + l.id + '">' + i('plus') + 'Skapa projekt</button>' });
    });
    return kand.filter(function (k) { return !skjutna[k.id]; });
  }
  G['skjut-upp'] = function (el) { skjutna[el.getAttribute('data-id')] = true; BP.rita(); };

  /* --- Hero -------------------------------------------------------------------
     Vänster: hälsningen och "Din dag" – allt som väntar, i en lista där en
     uppgift i taget är utfälld. Höger: huset för den valda uppgiften i 3D, med
     dess material som en lagerstapel – hovra ett lager så lyser det i modellen.
     Längs nederkanten nyckeltalen, som på de andra sidorna. */
  var vald = 0;
  var GRUPPTON = ['#7aa98c', '#e9e6dc', '#bdb9ad', '#928e83', '#6c695f', '#a9c2b2', '#a19c8f', '#57554e'];

  function uppgHus(k) { return k.p ? BP.hus(k.p.hus) : k.l ? BP.hus(k.l.hus) : null; }
  function uppgMangd(k, h) {
    if (k.p && BP.mangdFor(k.p).rader.length) return BP.mangdFor(k.p);
    return h ? window.Mangd.mangda(window.Mangd.delarForHus(h).delar, BP.recept(), BP.material()) : null;
  }
  function lagerData(m) {
    if (!m) return [];
    var per = {};
    m.rader.forEach(function (r) { per[r.grupp] = (per[r.grupp] || 0) + r.summa; });
    return Object.keys(BP.GRUPP_MAT).filter(function (g) { return per[g]; }).map(function (g, n) { return { g: g, kr: per[g], ton: GRUPPTON[n % GRUPPTON.length] }; });
  }
  function scenInfo(k, h) {
    var m = uppgMangd(k, h), lager = lagerData(m), tot = lager.reduce(function (t, x) { return t + x.kr; }, 0);
    var egen = k.p && !k.p.hus;
    var href = k.p ? '#/projekt/' + k.p.id + '/' + (egen ? 'ritning' : 'mangd') : h ? '#/bibliotek/' + h.id : '#/projekt';
    return '<div class="ov-scen__info"><b>' + e(egen ? 'Egen ritning' : h ? h.namn : '') + '</b><small>' + e(k.p ? k.p.namn : k.l ? 'Önskat av ' + k.l.namn : (h ? h.kategori : '')) + '</small></div>' +
      '<a class="ov-scen__oppna" href="' + href + '">' + (k.p ? (egen ? 'Öppna ritningen' : 'Öppna mängden') : 'Se huset') + i('pil') + '</a>' +
      (lager.length && !egen
        ? '<div class="ov-scen__lager"><div class="ov-scen__rad"><span class="ov-scen__text" aria-live="polite">' + (k.p ? 'Materialet' : 'Materialet om det mängdas') + ' · ' + BP.kr(tot) + '</span><small>Hovra ett lager</small></div>' +
          '<div class="ov-scen__stapel" role="list" aria-label="Materialet per lager">' + lager.map(function (x) {
            return '<button type="button" role="listitem" data-ovlager="' + e(x.g) + '" data-kr="' + Math.round(x.kr) + '" style="--a:' + (x.kr / tot * 100).toFixed(2) + ';--f:' + x.ton + '" aria-label="' + e(x.g) + ', ' + BP.kr(x.kr) + '"></button>';
          }).join('') + '</div></div>'
        : '<div class="ov-scen__lager"><span class="ov-scen__text">' + (egen ? 'Ritningen saknar skala – därför ingen mängd än' : 'Ingen mängd än') + '</span></div>');
  }

  function hero(r, fraga, db) {
    var nu = new Date(), dag = DAGAR[nu.getDay()];
    var kand = borjaHar();
    if (vald >= Math.min(4, kand.length)) vald = 0;
    var k = kand[vald];
    var aktiv = db.projekt.filter(function (p) { return p.steg !== 'order' && p.hus; })[0];
    var h = (k && uppgHus(k)) || (aktiv && BP.hus(aktiv.hus)) || D.HUS[1];
    var timme = nu.getHours(), halsning = timme < 10 ? 'God morgon' : timme < 18 ? 'Hej' : 'God kväll';
    var ord = (halsning + ',').split(' ').concat([r.person.split(' ')[0] + '.']);
    var visas = kand.slice(0, 4);
    return '<section class="ov-hero" aria-labelledby="ov-rubrik">' +
      '<div class="ov-hero__text">' +
        '<p class="ov-hero__datum">' + (timme < 10 ? '🌅 ' : timme < 18 ? '☀️ ' : '🌙 ') + dag.charAt(0).toUpperCase() + dag.slice(1) + ' ' + nu.getDate() + ' ' + MAN[nu.getMonth()] + ' · vecka ' + vecka(nu) + '</p>' +
        '<h1 id="ov-rubrik">' + ord.map(function (o, n) {
          return '<span class="ov-mask"><span class="ov-ord' + (n === ord.length - 1 ? ' ov-ord--namn' : '') + '" style="--o:' + n + '">' + e(o) + '</span></span>';
        }).join(' ') + '<span class="ov-vink emoji" aria-hidden="true">👋</span></h1>' +
        '<p class="ov-hero__dag">' + fraga + '</p>' +
        (k ? '<div class="ov-dag"><div class="ov-dag__huvud"><b>Din dag</b><small>' + kand.length + (kand.length === 1 ? ' sak' : ' saker') + ' att göra</small></div>' +
          '<ol class="ov-dag__lista">' + visas.map(function (x, n) {
            var oppen = n === vald;
            return '<li class="ov-uppg' + (oppen ? ' ov-uppg--oppen' : '') + '" style="--u:' + n + '">' +
              '<button class="ov-uppg__huvud" type="button" data-uppg="' + n + '" aria-expanded="' + oppen + '" aria-controls="ov-uppg-' + n + '">' +
                '<span class="ov-uppg__nr emoji" aria-hidden="true">' + ({ mangd: '📏', linjal: '📐', kund: '💬' }[x.ikon] || '🔨') + '</span>' +
                '<span class="ov-uppg__text"><b>' + e(x.titel) + '</b><small>' + e(x.under) + '</small></span>' +
                '<span class="chip chip--tejp">' + e(x.status) + '</span>' + i('ned', 'ov-uppg__pil') + '</button>' +
              '<div class="ov-uppg__kropp" id="ov-uppg-' + n + '"><div class="ov-uppg__inre"><div class="ov-uppg__knappar">' + x.knappar +
                '<button class="knapp knapp--text knapp--ljustext" type="button" data-g="skjut-upp" data-id="' + x.id + '">' + i('klocka') + 'Skjut till i morgon</button></div></div></div></li>';
          }).join('') + '</ol>' + (kand.length > 4 ? '<a class="ov-dag__fler" href="#/projekt">+ ' + (kand.length - 4) + ' till i projekten' + i('pil') + '</a>' : '') + '</div>'
          : '<div class="ov-dag ov-dag--klar"><span class="ov-uppg__nr emoji" aria-hidden="true">🎉</span><div><b>Inget väntar på dig</b><small>Alla mängder är bekräftade och alla förfrågningar besvarade.</small></div></div>') +
      '</div>' +
      '<div class="ov-scen" data-hus="' + h.id + '">' +
        '<model-viewer src="' + BP.sprangSrc(h) + '" alt="' + e(h.namn) + ' i 3D" animation-name="sprang" interaction-prompt="none" auto-rotate auto-rotate-delay="0" rotation-per-second="7deg" shadow-intensity="1.2" shadow-softness="0.7" exposure="1.2" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="32deg 66deg 14m" camera-target="0m 1.45m 0m" field-of-view="28deg" disable-zoom disable-pan interpolation-decay="120"></model-viewer>' +
        '<div class="ov-scen__over">' + scenInfo(k || { p: aktiv }, h) + '</div>' +
      '</div>' +
      nyckeltal(db) +
    '</section>';
  }

  /* --- Nyckeltal, i plåtens nederkant ---------------------------------------------- */
  function nyckeltal(db) {
    var aktiva = db.projekt.filter(function (p) { return p.steg !== 'order'; });
    var allaDelar = db.projekt.reduce(function (t, p) { return t + BP.delarFor(p).length; }, 0);
    var ob = db.projekt.reduce(function (t, p) { return t + obekr(p); }, 0);
    var offert = db.projekt.filter(function (p) { return p.steg === 'offert'; }).reduce(function (t, p) { return t + BP.mangdFor(p).summa + BP.tillvalSumma(p); }, 0);
    var leads = db.leads.filter(function (l) { return l.status === 'ny'; }).length;
    var svar = db.projekt.reduce(function (t, p) { return t + p.forfragningar.filter(function (f) { return f.status === 'svar'; }).length; }, 0);
    var kpi = function (namn, varde, format, under, andel, href, n) {
      return '<a class="sh-kpi ov-kpi2" href="' + href + '" style="--k:' + n + '"><small>' + namn + '</small><b><span data-rakna="' + Math.round(varde) + '"' + (format ? ' data-format="' + format + '"' : '') + '>' + (format === 'kort' ? BP.kort(varde) : varde) + '</span></b><span>' + under + '</span>' +
        (andel != null ? '<span class="ov-kpi2__matare" role="img" aria-label="' + Math.round(andel * 100) + ' procent"><i style="--a:' + andel.toFixed(3) + '"></i></span>' : '') + '</a>';
    };
    return '<div class="sh__kpier ov-hero__kpier" style="--n:4">' +
      kpi('Aktiva projekt', aktiva.length, '', db.projekt.length + ' totalt', aktiva.length / Math.max(1, db.projekt.length), '#/projekt', 0) +
      kpi('Bekräftade byggdelar', allaDelar - ob, '', 'av ' + allaDelar + ' · ' + ob + ' avspärrade', (allaDelar - ob) / Math.max(1, allaDelar), '#/mangdning', 1) +
      kpi('Ute på offert', offert, 'kort', 'material + tillval, exempelpriser', null, '#/forfragningar', 2) +
      kpi('Att svara på', svar + leads, '', svar + ' från partner · ' + leads + ' från konsumenter', null, '#/forfragningar', 3) +
    '</div>';
  }

  /* --- Linjen: projekten åker ut till sin station ----------------------------------
     Fyra stationer på en linje. Under varje station hänger projekten som kort med
     bild, värde och nästa steg; obekräftade har tejpkant. */
  function linjen(db) {
    var stationer = ['underlag', 'mangd', 'offert', 'order'];
    var per = {};
    stationer.forEach(function (s) { per[s] = db.projekt.filter(function (p) { return p.steg === s; }); });
    var gora = db.projekt.filter(function (p) { return BP.nastaAtgard && BP.nastaAtgard(p).gora; }).length;
    var n = 0;
    return '<section class="kort ov-linje" aria-labelledby="ov-linje-rubrik"><header class="kort__huvud"><h2 id="ov-linje-rubrik">Linjen</h2><small>' + db.projekt.length + ' projekt · ' + gora + ' väntar på dig</small><a class="knapp knapp--text knapp--liten" href="#/projekt" style="margin-left:auto">Alla projekt' + i('hoger') + '</a></header>' +
      '<div class="ov-linje__bana">' +
      '<div class="ov-linje__spar" aria-hidden="true"><i></i></div>' +
      stationer.map(function (s, k) {
        var sum = per[s].reduce(function (t, p) { var m = BP.mangdFor(p); return t + (m.rader.length ? m.summa + BP.tillvalSumma(p) : 0); }, 0);
        return '<div class="ov-station" style="--s:' + k + '">' +
          '<div class="ov-station__topp"><span class="ov-station__prick" aria-hidden="true">' + (k + 1) + '</span><b>' + STEG[s] + '</b><small>' + per[s].length + ' projekt' + (sum ? ' · ' + BP.kort(sum) : '') + '</small></div>' +
          '<div class="ov-station__brickor">' + (per[s].length ? per[s].map(function (p) {
            var h = BP.hus(p.hus), ob = obekr(p), m = BP.mangdFor(p);
            var nasta = BP.nastaAtgard ? BP.nastaAtgard(p) : null;
            var tejp = skalaSaknas(p) || ob;
            var html = '<a class="ov-bricka' + (tejp ? ' ov-bricka--tejp' : '') + '" href="' + (nasta ? nasta.href : '#/projekt/' + p.id) + '" style="--n:' + n + '">' +
              '<span class="ov-bricka__bild">' + (h ? '<img src="' + h.bild + '" alt="" loading="lazy" decoding="async">' : '<span class="ov-bricka__rit">' + i('ritning') + '</span>') + '</span>' +
              '<span class="ov-bricka__text"><b>' + e(p.namn) + '</b><small>' + e(p.kund) + (m.rader.length ? ' · ' + BP.kort(m.summa + BP.tillvalSumma(p)) : '') + '</small>' +
              (nasta ? '<span class="ov-bricka__nasta' + (nasta.typ ? ' ov-bricka__nasta--' + nasta.typ : '') + '">' + i(nasta.ikon) + e(nasta.text) + '</span>' : '') + '</span></a>';
            n++;
            return html;
          }).join('') : '<p class="ov-station__tom">Inget här just nu</p>') + '</div>' +
        '</div>';
      }).join('') + '</div></section>';
  }

  /* --- Materialet just nu ---------------------------------------------------------------
     Varje grupp en stapel, uppdelad per projekt. Projekten i förklaringen går att
     slå av och på – summorna räknas om direkt. */
  var PTON = ['#2f6a4f', '#7aa98c', '#a7b8a0', '#c98a5a', '#c9c5b9'];
  var avslagna = {};
  function materialData(db) {
    var akt = db.projekt.filter(function (p) { return p.steg !== 'order' && BP.mangdFor(p).rader.length; });
    var per = {};
    akt.forEach(function (p, k) {
      BP.mangdFor(p).rader.forEach(function (r) {
        var g = per[r.grupp] || (per[r.grupp] = { g: r.grupp, tot: 0, p: {} });
        g.p[p.id] = (g.p[p.id] || 0) + r.summa;
      });
    });
    return { akt: akt, per: per };
  }
  function materialKropp(db) {
    var d = materialData(db), med = d.akt.filter(function (p) { return !avslagna[p.id]; });
    var grupper = Object.keys(d.per).map(function (g) {
      var x = d.per[g];
      x.tot = med.reduce(function (t, p) { return t + (x.p[p.id] || 0); }, 0);
      return x;
    }).filter(function (x) { return x.tot > 0; }).sort(function (a, b) { return b.tot - a.tot; });
    var tot = grupper.reduce(function (t, x) { return t + x.tot; }, 0);
    var max = Math.max.apply(null, grupper.map(function (x) { return x.tot; }).concat([1]));
    var topp = grupper[0];
    return '<div class="ov-mat__huvud"><p class="ov-mat__tot"><b data-ovtot="' + Math.round(tot) + '">' + BP.kr(tot) + '</b><span>i material att köpa in' + (topp ? ' · störst är <b>' + e(topp.g.toLowerCase()) + '</b> med ' + Math.round(topp.tot / tot * 100) + ' %' : '') + '</span></p>' +
      '<div class="ov-mat__projekt" role="group" aria-label="Projekt som räknas med">' + d.akt.map(function (p, k) {
        return '<button type="button" data-ovproj="' + p.id + '" aria-pressed="' + !avslagna[p.id] + '" style="--f:' + PTON[k % PTON.length] + '"><i></i>' + e(p.kund.split(' ')[0]) + '<small>' + BP.kort(BP.mangdFor(p).summa) + '</small></button>';
      }).join('') + '</div></div>' +
      (grupper.length ? '<ul class="ov-mat__lista">' + grupper.map(function (x, n) {
        return '<li style="--r:' + n + '"><span class="ov-mat__namn">' + e(x.g) + '</span>' +
          '<span class="ov-mat__stapel" style="--w:' + (x.tot / max * 100).toFixed(2) + '%">' + d.akt.map(function (p, k) {
            var v = avslagna[p.id] ? 0 : x.p[p.id] || 0;
            return v ? '<i data-ovp="' + p.id + '" style="--a:' + (v / x.tot * 100).toFixed(2) + '%;--f:' + PTON[k % PTON.length] + '" title="' + e(p.namn) + ': ' + BP.kr(v) + '"></i>' : '';
          }).join('') + '</span>' +
          '<b>' + BP.kr(x.tot) + '</b><small>' + Math.round(x.tot / tot * 100) + ' %</small></li>';
      }).join('') + '</ul>' + storstaPoster(med) + samTeaser(med) : '<p class="tomt">Slå på ett projekt för att se materialet.</p>');
  }
  // De största raderna i de valda projekten, ihoplagda per artikel.
  function storstaPoster(med) {
    var per = {};
    med.forEach(function (p) { BP.mangdFor(p).rader.forEach(function (r) { var x = per[r.material] || (per[r.material] = { namn: r.namn, kr: 0, n: 0 }); x.kr += r.summa; x.n += 1; }); });
    var topp = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return b.kr - a.kr; }).slice(0, 4);
    return '<div class="ov-poster"><h3>Största posterna</h3><ol>' + topp.map(function (x, n) {
      return '<li><span class="ov-poster__nr">' + (n + 1) + '</span><span class="ov-poster__namn">' + e(x.namn) + '<small>' + (x.n === 1 ? '1 projekt' : x.n + ' projekt') + '</small></span><b>' + BP.kr(x.kr) + '</b></li>';
    }).join('') + '</ol></div>';
  }
  function samTeaser(med) {
    if (!BP.samkapa || med.length < 2) return '';
    var s = BP.samkapa(med.map(function (p) { return { p: p, m: BP.mangdFor(p) }; }));
    if (!s.kr) return '';
    return '<a class="ov-sam" href="#/mangdning">' + i('linjal') + '<span><b>Kapa ihop och spara ' + BP.kr(s.kr) + '</b><small>' + BP.tal(s.meter, 1) + ' m mindre virke om ' + med.map(function (p) { return p.kund.split(' ')[0]; }).join(' och ') + ' beställs tillsammans</small></span>' + i('pil') + '</a>';
  }
  function material(db) {
    return '<section class="kort ov-mat" aria-labelledby="ov-mat-rubrik"><header class="kort__huvud"><h2 id="ov-mat-rubrik">Materialet just nu</h2><small>pågående projekt · exempelpriser</small></header>' +
      '<div class="kort__kropp" id="ov-mat-kropp">' + materialKropp(db) + '</div></section>';
  }

  /* --- Sidokolumnen: kunder som väntar och vad som hänt ------------------------------- */
  function sido(db) {
    var leads = db.leads.filter(function (l) { return l.status === 'ny'; });
    var handelser = db.projekt.reduce(function (a, p) { return a.concat(p.handelser.map(function (h) { return { h: h, p: p }; })); }, []).sort(function (a, b) { return a.h.tid < b.h.tid ? 1 : -1; }).slice(0, 6);
    var dagar = function (iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso)) / 864e5)); };
    return '<div class="ov-sido">' +
      '<section class="kort"><header class="kort__huvud"><h2>Från konsumentsidan</h2>' + (leads.length ? '<span class="chip chip--bla">' + leads.length + ' nya</span>' : '') + '<a class="knapp knapp--text knapp--liten" href="#/forfragningar" style="margin-left:auto">Alla' + i('hoger') + '</a></header>' +
        (leads.length ? '<div class="ov-leads">' + leads.map(function (l) {
          var h = BP.hus(l.hus), d = dagar(l.tid);
          return '<article class="ov-lead">' + (h ? '<img src="' + h.bild + '" alt="">' : '') +
            '<div class="ov-lead__text"><b>' + e(l.namn) + '</b><small>' + e(h ? h.namn : '') + ' · ' + e(l.ort) + '</small><p>' + e(l.text) + '</p></div>' +
            '<div class="ov-lead__fot"><span class="chip' + (d >= 2 ? ' ff-varm' : '') + '">' + (d >= 2 ? 'Väntat ' + d + ' dagar' : BP.sedan(l.tid)) + '</span><button class="knapp knapp--gul knapp--liten" type="button" data-g="lead-projekt" data-id="' + l.id + '">' + i('plus') + 'Skapa projekt</button></div></article>';
        }).join('') + '</div>' : '<div class="kort__kropp"><p class="tomt">Inga nya förfrågningar. De som skickas från konsumentsidan hamnar här.</p></div>') + '</section>' +
      '<section class="kort"><header class="kort__huvud"><h2>Senaste händelser</h2></header><ol class="ov-logg">' + handelser.map(function (x, k) {
        return '<li style="--k:' + k + '"><span class="ov-logg__prick" aria-hidden="true"></span><a href="#/projekt/' + x.p.id + '/handelser"><b>' + e(x.h.text) + '</b><small>' + e(x.p.namn) + ' · ' + e(x.h.av) + '</small></a><time datetime="' + x.h.tid + '">' + BP.sedan(x.h.tid) + '</time></li>';
      }).join('') + '</ol></section>' +
    '</div>';
  }

  /* --- Vyn ----------------------------------------------------------------------------- */
  BP.vyer.oversikt = function () {
    var db = BP.db, r = BP.roll();
    var vantar = db.projekt.map(function (p) { return { p: p, n: obekr(p) + (skalaSaknas(p) ? 1 : 0) }; }).filter(function (x) { return x.n; });
    var nSaker = vantar.reduce(function (t, x) { return t + x.n; }, 0);
    var fraga = vantar.length ? '<b>' + nSaker + (nSaker === 1 ? ' sak' : ' saker') + '</b> väntar på dig i <b>' + vantar.length + ' projekt</b>.' : 'Allt är bekräftat. Bra jobbat.';
    var entre = !sett && !lugnt();
    sett = true;
    var html = '<div class="ov' + (entre ? ' ov--entre' : '') + '">' +
      hero(r, fraga, db) + linjen(db) +
      '<div class="ov-nedre">' + material(db) + sido(db) + '</div></div>';

    return {
      titel: 'Översikt', html: html,
      efter: function (rot) {
        var mv = $('.ov-scen model-viewer', rot);
        // Materialet: slå av och på projekt, summorna räknas om och glider till sitt nya värde.
        var matKropp = $('#ov-mat-kropp', rot);
        var kopplaMat = function () {
          $$('[data-ovproj]', matKropp).forEach(function (b) {
            b.addEventListener('click', function () {
              var id = b.getAttribute('data-ovproj');
              var fore = +($('[data-ovtot]', matKropp) || {}).getAttribute('data-ovtot') || 0;
              avslagna[id] = !avslagna[id];
              if (!Object.keys(avslagna).some(function (k) { return !avslagna[k]; }) && $$('[data-ovproj]', matKropp).every(function (x) { return avslagna[x.getAttribute('data-ovproj')]; })) avslagna = {};
              matKropp.innerHTML = materialKropp(BP.db);
              matKropp.classList.remove('ov-mat--ny'); void matKropp.offsetWidth; matKropp.classList.add('ov-mat--ny');
              var tot = $('[data-ovtot]', matKropp);
              if (tot && !lugnt()) {
                var till = +tot.getAttribute('data-ovtot'), t0 = null;
                var steg = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 420); tot.textContent = BP.kr(fore + (till - fore) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(steg); };
                requestAnimationFrame(steg);
              }
              kopplaMat();
              var ny = $('[data-ovproj="' + id + '"]', matKropp); if (ny) ny.focus();
            });
            b.addEventListener('mouseenter', function () { $$('[data-ovp]', matKropp).forEach(function (x) { x.classList.toggle('ov-ton', x.getAttribute('data-ovp') !== b.getAttribute('data-ovproj')); }); });
            b.addEventListener('mouseleave', function () { $$('[data-ovp]', matKropp).forEach(function (x) { x.classList.remove('ov-ton'); }); });
          });
        };
        kopplaMat();
        // Projekten åker ut längs linjen till sin station (bara vid entrén).
        if (entre && Element.prototype.animate) {
          var spar = $('.ov-linje__spar', rot);
          if (spar && spar.offsetParent) {
            var start = spar.getBoundingClientRect().left;
            $$('.ov-bricka', rot).forEach(function (b, n) {
              var r = b.getBoundingClientRect();
              var dx = Math.min(64, r.left - start + 24);
              b.animate([
                { transform: 'translateX(' + (-dx) + 'px)', opacity: 0 },
                { transform: 'none', opacity: 1 }
              ], { duration: 700, delay: 900 + n * 80, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
            });
          }
        }
        if (!mv) return;
        var scen = $('.ov-scen', rot), over = $('.ov-scen__over', scen);
        var orig = [], laddad = false, hus0 = BP.hus(scen.getAttribute('data-hus'));
        BP3D.ram(mv, hus0, { vinkel: '32deg 66deg', marg: 1.08 });
        var rorelse = null;
        var vidLaddning = function () {
          laddad = true;
          orig = mv.model.materials.map(function (m) { return { f: m.pbrMetallicRoughness.baseColorFactor.slice(), lage: m.getAlphaMode ? m.getAlphaMode() : 'OPAQUE' }; });
        };
        var markera = function (grupp) {
          if (!laddad) return;
          var namn = grupp ? BP.GRUPP_MAT[grupp] || [] : null;
          if (namn && !namn.length) namn = null;
          mv.model.materials.forEach(function (m, n) {
            var traff = namn && namn.indexOf(m.name) !== -1, o = orig[n];
            m.pbrMetallicRoughness.setBaseColorFactor([o.f[0], o.f[1], o.f[2], !namn || traff ? o.f[3] : 0.12]);
            m.setAlphaMode(!namn || traff ? o.lage : 'BLEND');
            m.setEmissiveFactor(traff ? [0.14, 0.28, 0.2] : [0, 0, 0]);
          });
          // Huset dras isär lite när ett lager visas, så att det syns var det sitter.
          if (rorelse) rorelse.mal(grupp ? 0.5 : (scen.matches(':hover') ? 0.42 : 0));
        };
        var kopplaLager = function () {
          var text = $('.ov-scen__text', over), grund = text ? text.textContent : '';
          $$('[data-ovlager]', over).forEach(function (b) {
            var g = b.getAttribute('data-ovlager');
            var pa = function () {
              markera(g);
              $$('[data-ovlager]', over).forEach(function (x) { x.classList.toggle('ov-ton', x !== b); });
              text.textContent = g + ' · ' + BP.kr(+b.getAttribute('data-kr')) + (BP.GRUPP_MAT[g] && BP.GRUPP_MAT[g].length ? '' : ' · syns inte i modellen');
            };
            var av = function () { markera(null); $$('[data-ovlager]', over).forEach(function (x) { x.classList.remove('ov-ton'); }); text.textContent = grund; };
            b.addEventListener('mouseenter', pa); b.addEventListener('focus', pa);
            b.addEventListener('mouseleave', av); b.addEventListener('blur', av);
          });
        };
        kopplaLager();

        // Välj en uppgift: den fälls ut, de andra fälls ihop, och huset byts.
        $$('[data-uppg]', rot).forEach(function (btn) {
          btn.addEventListener('click', function () {
            var n = +btn.getAttribute('data-uppg');
            if (n === vald) return;
            vald = n;
            $$('.ov-uppg', rot).forEach(function (li, k) { li.classList.toggle('ov-uppg--oppen', k === n); $('.ov-uppg__huvud', li).setAttribute('aria-expanded', String(k === n)); });
            var k = borjaHar()[n], h = uppgHus(k) || BP.hus(scen.getAttribute('data-hus'));
            over.classList.add('ov-scen__over--byt');
            setTimeout(function () { over.innerHTML = scenInfo(k, h); over.classList.remove('ov-scen__over--byt'); kopplaLager(); }, 150);
            if (h.id !== scen.getAttribute('data-hus')) {
              scen.setAttribute('data-hus', h.id);
              laddad = false;
              mv.setAttribute('alt', h.namn + ' i 3D');
              BP3D.ram(mv, h, { vinkel: '32deg 66deg', marg: 1.08 });
              mv.setAttribute('src', BP.sprangSrc(h));
              // Det nya huset byggs ihop när det laddats.
              mv.addEventListener('load', function () { if (rorelse) rorelse.bygg(); }, { once: true });
            }
          });
        });

        BP.laddaMV(function () {
          mv.addEventListener('load', vidLaddning);
          if (mv.loaded) vidLaddning();
          rorelse = BP3D.rorelse(mv);
          rorelse.hovra(scen, 0.42);
          // Entrén: lagren landar på plats – grund, golv, väggar, stomme och tak.
          var starta = function () { if (entre) rorelse.bygg(); else rorelse.direkt(0); };
          if (mv.loaded) starta(); else mv.addEventListener('load', starta, { once: true });
        });
      }
    };
  };
})();
