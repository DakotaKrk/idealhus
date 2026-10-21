/* Byggplattformen – Mängdning, den nya hubben.
   Inspirerad av hur de ledande verktygen gör (Togal, STACK, svenska
   kalkylprogram), men med plattformens egen princip: varje siffra visar
   sin källa och inget påstås som inte räknats fram.
   - Snabbmängd: mått in → material ut, live, med huset i 3D skalat efter måtten.
   - Fråga mängderna: sök i alla mängder med vanliga ord (ingen AI – en sökning).
   - Samkapning: virket i pågående projekt kapas tillsammans; visar sparat spill.
   - Jämförelse: kr/m² per materialgrupp mellan projekten, avvikelser flaggas.
   - Släpp en ritning på sidan för att starta en mängdning. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;
  var gammal = BP.vyer.mangdning;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  // Snabbmängdens mått (sessionens senaste värden).
  var snabb = { langd: 7.2, bredd: 4.2, nock: 4.0, tak: 'sadel', lutning: 27, fonster: 3 };
  var BAS = { sadel: D.HUS[1], pulpet: D.HUS[2] };

  function snabbMangd() {
    var h = { langd: snabb.langd, bredd: snabb.bredd, nock: snabb.nock, tak: snabb.tak, lutning: snabb.tak === 'pulpet' ? Math.min(snabb.lutning, 8) : snabb.lutning,
      fonster: [{ typ: 'fonster', bredd: 1.2, hojd: 1.2, antal: snabb.fonster }], dorrar: [{ typ: 'dorr', bredd: 1.0, hojd: 2.1, antal: 1 }] };
    var g = M.delarForHus(h);
    var m = M.mangda(g.delar, BP.recept(), BP.material());
    return { g: g, m: m, yta: snabb.langd * snabb.bredd };
  }

  function nyckelrader(m) {
    var ta = function (fn) { return m.rader.filter(fn); };
    var regel = ta(function (r) { return /^Regel/.test(r.namn); }).reduce(function (t, r) { return t + r.brutto; }, 0);
    var gips = (ta(function (r) { return /^Gipsskiva/.test(r.namn); })[0] || {}).brutto || 0;
    var ull = ta(function (r) { return /^Mineralull/.test(r.namn); }).reduce(function (t, r) { return t + (r.forpackning ? r.forpackning.antal : 0); }, 0);
    var tak = (ta(function (r) { return /^Takplåt|^Ytpapp/.test(r.namn); })[0] || {}).brutto || 0;
    return [
      ['Regelvirke', regel, 'm'],
      ['Gipsskivor', gips, 'st'],
      ['Isolering', ull, 'paket'],
      ['Taktäckning', tak, 'm²']
    ];
  }

  /* ===== Vyn ============================================================= */
  BP.vyer.mangdning = function (del) {
    if (del[0]) return gammal(del);
    var db = BP.db;
    var alla = db.projekt.map(function (p) { var m = BP.mangdFor(p), d = BP.delarFor(p); return { p: p, m: m, d: d, ok: d.filter(function (x) { return x.bekraftad !== false; }).length, h: BP.hus(p.hus) }; });
    var obekr = alla.reduce(function (t, x) { return t + (x.d.length - x.ok); }, 0);
    var totalt = alla.reduce(function (t, x) { return t + x.m.summa; }, 0);
    var s = snabbMangd();

    var html =
      '<div class="titelrad"><div class="titelrad__text"><h1>Mängdning</h1><p class="titelrad__under">' + alla.length + ' mängder · ' + obekr + ' byggdelar att bekräfta · ' + BP.kort(totalt) + ' i material (exempelpriser).</p></div>' +
        '<div class="titelrad__knappar"><a class="knapp knapp--primar" href="#/mangdning/ny">' + i('plus') + 'Ny mängdning</a></div></div>' +

      // --- Snabbmängd + fråga/släpp ---------------------------------------------
      '<div class="mh-topp">' +
        '<section class="mh-snabb" aria-labelledby="snabb-rubrik">' +
          '<div class="mh-snabb__scen"><model-viewer id="snabb-mv" alt="Huset i 3D, byggt efter måtten" camera-controls touch-action="pan-y" interaction-prompt="none" shadow-intensity="0.9" shadow-softness="1" exposure="1.05" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="35deg 70deg 105%" field-of-view="30deg" disable-zoom auto-rotate auto-rotate-delay="4000" rotation-per-second="6deg"></model-viewer>' +
            '<span class="mh-matt mh-matt--l" id="matt-l"></span><span class="mh-matt mh-matt--b" id="matt-b"></span>' +
            '<span class="scen__tips">' + i('vrid') + 'Byggt efter dina mått · dra för att vrida</span></div>' +
          '<div class="mh-snabb__panel">' +
            '<h2 id="snabb-rubrik">Snabbmängd</h2><p class="mh-under">Skriv måtten – materialet räknas ut medan du skriver.</p>' +
            '<div class="mh-falt">' +
              reglage('langd', 'Längd', 3, 15, 0.1, 'm') + reglage('bredd', 'Bredd', 2.5, 8, 0.1, 'm') +
              reglage('nock', 'Nockhöjd', 2.8, 6, 0.05, 'm') + reglage('fonster', 'Fönster', 0, 12, 1, 'st') +
            '</div>' +
            '<div class="segment" role="group" aria-label="Tak"><button type="button" data-snabbtak="sadel" aria-pressed="' + (snabb.tak === 'sadel') + '">Sadeltak</button><button type="button" data-snabbtak="pulpet" aria-pressed="' + (snabb.tak === 'pulpet') + '">Pulpettak</button></div>' +
            '<div class="mh-resultat" id="snabb-resultat">' + snabbResultat(s) + '</div>' +
            '<div class="mh-knappar"><button class="knapp knapp--gul" type="button" data-g="snabb-projekt">' + i('plus') + 'Skapa projekt av detta</button><small id="snabb-antag">' + s.g.antaganden.length + ' antaganden syns i projektet</small></div>' +
          '</div>' +
        '</section>' +

        '<div class="mh-sidokol">' +
          '<section class="kort mh-fraga" aria-labelledby="fraga-rubrik"><header class="kort__huvud"><h2 id="fraga-rubrik">Fråga mängderna</h2><small>sök i era mängder – ingen AI</small></header>' +
            '<div class="kort__kropp"><form class="mh-fraga__form" id="fraga-form"><label class="dold" for="fraga">Fråga</label>' + i('sok') + '<input id="fraga" autocomplete="off" placeholder="t.ex. hur mycket gips behövs?"><button class="knapp knapp--primar knapp--liten" type="submit">Fråga</button></form>' +
            '<div class="mh-forslag">' + ['Hur mycket gips?', 'Vad kostar taket?', 'Hur många reglar 45 × 170?', 'Var är spillet störst?'].map(function (f) { return '<button type="button" class="chip" data-fraga="' + e(f) + '">' + e(f) + '</button>'; }).join('') + '</div>' +
            '<div class="mh-svar" id="fraga-svar" aria-live="polite"></div></div></section>' +
          '<label class="mh-slapp" id="slapp" tabindex="0"><input type="file" accept="image/*" hidden id="slapp-fil">' + i('uppladd') + '<b>Släpp en ritning här</b><small>PNG, JPG eller SVG – blir en ny mängdning med ritverktyget</small></label>' +
        '</div>' +
      '</div>' +

      // --- Mängderna som kort ------------------------------------------------------
      '<div class="mh-rubrik"><h2>Mängderna</h2><small>' + alla.length + ' projekt</small></div>' +
      '<div class="mh-kort" data-stagger>' + alla.map(function (x, n) { return mangdKort(x, n); }).join('') + '</div>' +

      // --- Smarta: samkapning + jämförelse ------------------------------------------
      '<div class="mh-smart">' + samkapning(alla) + jamforelse(alla) + '</div>';

    return { titel: 'Mängdning', html: html, efter: koppla };
  };

  function reglage(id, namn, min, max, steg, enhet) {
    return '<label class="mh-reglage"><span>' + namn + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + steg + '" value="' + snabb[id] + '" data-snabb="' + id + '"><output id="ut-' + id + '">' + BP.tal(snabb[id], steg < 1 ? 2 : 0) + ' ' + enhet + '</output></label>';
  }

  function snabbResultat(s) {
    return '<div class="mh-resultat__stort"><span>Material, exempelpriser</span><b data-rakna-live="' + Math.round(s.m.summa) + '">' + BP.kr(s.m.summa) + '</b><small>' + BP.kr(s.m.summa / s.yta) + '/m² · ' + BP.tal(s.yta, 1) + ' m² byggarea · ' + s.m.rader.length + ' rader</small></div>' +
      '<dl class="mh-resultat__rader">' + nyckelrader(s.m).map(function (r) { return '<div><dt>' + r[0] + '</dt><dd><b>' + BP.tal(r[1], r[2] === 'm' || r[2] === 'm²' ? 0 : 0) + '</b> ' + r[2] + '</dd></div>'; }).join('') + '</dl>';
  }

  function mangdKort(x, n) {
    var p = x.p, m = x.m, andel = x.d.length ? x.ok / x.d.length : 0;
    var yta = x.h ? x.h.yta : BP.delarFor(p).filter(function (d) { return d.typ === 'bjalklag'; }).reduce(function (t, d) { return t + d.langd * d.bredd; }, 0);
    var ritOk = !(p.underlag === 'ritning' && p.ritning && !p.ritning.skala);
    var status = !ritOk ? '<span class="chip chip--tejp">Skala saknas</span>'
      : x.d.length - x.ok ? '<span class="chip chip--tejp">' + (x.d.length - x.ok) + ' att bekräfta</span>'
      : p.steg === 'offert' || p.steg === 'order' ? '<span class="chip chip--gron">' + i('bock') + 'Godkänd</span>' : '<span class="chip chip--gron">' + i('bock') + 'Bekräftad</span>';
    var bild = x.h ? '<img src="' + x.h.bild + '" alt="" loading="lazy" decoding="async">' : '<svg viewBox="0 0 120 75" aria-hidden="true"><rect width="120" height="75" fill="#f4f3ef"/><path d="M0 15H120M0 30H120M0 45H120M0 60H120M20 0V75M40 0V75M60 0V75M80 0V75M100 0V75" stroke="#ece4d8"/><rect x="26" y="20" width="68" height="36" fill="none" stroke="#2b2722" stroke-width="4"/><path d="M64 22V48" stroke="#55534d" stroke-width="2"/></svg>';
    var R = 15, O = 2 * Math.PI * R;
    return '<a class="mh-k" href="#/projekt/' + p.id + '/' + (p.underlag === 'ritning' && !ritOk ? 'ritning' : 'mangd') + '" style="--k:' + n + '">' +
      '<div class="mh-k__bild">' + bild + '<span class="mh-k__ring" role="img" aria-label="' + x.ok + ' av ' + x.d.length + ' byggdelar bekräftade"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="' + R + '"/><circle class="fyll" cx="20" cy="20" r="' + R + '" style="--o:' + O.toFixed(2) + ';--v:' + (O * (1 - andel)).toFixed(2) + '"/></svg><b>' + Math.round(andel * 100) + '<small>%</small></b></span></div>' +
      '<div class="mh-k__text"><div class="mh-k__rad"><b>' + e(p.namn) + '</b></div><small>' + e(p.kund) + ' · ' + (p.underlag === 'ritning' ? 'egen ritning' : e(x.h ? x.h.namn : '')) + '</small>' +
        '<dl class="mh-k__tal"><div><dt>Material</dt><dd>' + (m.rader.length ? BP.kort(m.summa) : '–') + '</dd></div><div><dt>Per m²</dt><dd>' + (m.rader.length && yta ? BP.kort(m.summa / yta) : '–') + '</dd></div><div><dt>Rader</dt><dd>' + m.rader.length + '</dd></div></dl>' +
        '<div class="mh-k__fot">' + status + '<span class="mh-k__gaa">Öppna' + i('pil') + '</span></div></div></a>';
  }

  /* --- Samkapning: virket i valda projekt kapas i samma stänger ----------------------
     Projekten går att slå av och på. Varje material visar spillet var för sig mot
     tillsammans – det är där skillnaden syns – och vad det sparar i kronor. */
  var samAv = {};
  BP.samkapa = function (akt) {
    var mat = BP.material(), per = {};
    akt.forEach(function (x) {
      x.m.rader.forEach(function (r) {
        if (!r.kapning) return;
        var q = per[r.material] || (per[r.material] = { id: r.material, namn: r.namn, bitar: [], var: 0, st: 0, projekt: 0 });
        r.kapning.stanger.forEach(function (st) { q.bitar = q.bitar.concat(st.bitar); });
        q.var += r.kapning.lopmeter; q.st += r.kapning.stanger.length; q.projekt += 1;
      });
    });
    var rader = Object.keys(per).filter(function (k) { return per[k].projekt > 1; }).map(function (k) {
      var q = per[k], ihop = M.kapa(q.bitar, mat[k].langder);
      var netto = q.bitar.reduce(function (t, b) { return t + b; }, 0);
      var spar = Math.max(0, q.var - ihop.lopmeter);
      return { namn: q.namn, var: q.var, ihop: ihop.lopmeter, st: q.st, stIhop: ihop.stanger.length, spillFore: (q.var - netto) / q.var, spillEfter: (ihop.lopmeter - netto) / ihop.lopmeter, spar: spar, kr: Math.round(spar * (mat[k].pris || 0)) };
    }).filter(function (r) { return r.kr > 0; }).sort(function (a, b) { return b.kr - a.kr; });
    return { rader: rader, kr: rader.reduce(function (t, r) { return t + r.kr; }, 0), meter: rader.reduce(function (t, r) { return t + r.spar; }, 0), st: rader.reduce(function (t, r) { return t + r.st - r.stIhop; }, 0) };
  };

  function samkapning(alla) {
    return '<section class="kort mh-sam" aria-labelledby="sam-rubrik"><header class="kort__huvud"><h2 id="sam-rubrik">Samkapning</h2><small>kapa virket för flera projekt i samma stänger</small></header>' +
      '<div class="kort__kropp" id="sam-kropp">' + samKropp(alla) + '</div></section>';
  }
  function samKropp(alla) {
    var kandidat = alla.filter(function (x) { return x.p.steg !== 'order' && x.m.rader.some(function (r) { return r.kapning; }); });
    var med = kandidat.filter(function (x) { return !samAv[x.p.id]; });
    var s = BP.samkapa(med);
    var maxSpill = Math.max.apply(null, s.rader.map(function (r) { return r.spillFore; }).concat([0.01]));
    return '<div class="mh-sam__val" role="group" aria-label="Projekt som kapas ihop">' + kandidat.map(function (x) {
        return '<button type="button" data-samp="' + x.p.id + '" aria-pressed="' + !samAv[x.p.id] + '">' + (x.h ? '<img src="' + x.h.bild + '" alt="">' : '') + e(x.p.kund.split(' ')[0]) + '<small>' + e(x.h ? x.h.namn : 'egen ritning') + '</small></button>';
      }).join('') + '</div>' +
      (med.length < 2 ? '<p class="mh-sam__tom">Välj minst två projekt – då läggs deras virke i samma stänger.</p>'
      : !s.rader.length ? '<p class="mh-sam__tom">Projekten har inget virke som blir billigare att kapa ihop.</p>'
      : '<div class="mh-sam__summa"><div><b data-rakna="' + s.kr + '" data-format="kr">' + BP.kr(s.kr) + '</b><span>mindre virke</span></div><div><b>' + BP.tal(s.meter, 1) + ' m</b><span>kortare löpmeter</span></div><div><b>' + (s.st > 0 ? '−' + s.st : '±0') + '</b><span>stänger att köpa</span></div></div>' +
        '<ul class="mh-sam__lista">' + s.rader.slice(0, 4).map(function (r, n) {
          return '<li style="--r:' + n + '"><div class="mh-sam__rad"><b>' + e(r.namn) + '</b><span class="mh-sam__kr">−' + BP.kr(r.kr) + '</span></div>' +
            '<div class="mh-sam__spill"><span>Var för sig</span><i style="--a:' + (r.spillFore / maxSpill).toFixed(3) + '"></i><small>' + BP.tal(r.spillFore * 100, 1) + ' % spill</small>' +
            '<span>Tillsammans</span><i class="ihop" style="--a:' + (r.spillEfter / maxSpill).toFixed(3) + '"></i><small>' + BP.tal(r.spillEfter * 100, 1) + ' % spill</small></div>' +
            '<p class="mh-sam__mer">' + BP.tal(r.var, 1) + ' m i ' + r.st + ' stänger → ' + BP.tal(r.ihop, 1) + ' m i ' + r.stIhop + ' stänger</p></li>';
        }).join('') + '</ul>') +
      '<p class="mh-not">Bitarna från de valda projekten läggs i samma stänger (first fit, kortaste stång som räcker) – samma kapning som i varje projekt, bara gemensam.</p>';
  }

  /* --- Jämför per m²: värmekarta mot medianen ------------------------------------------
     Varje ruta är projektets kr/m² för gruppen. Färgen visar hur långt från medianen
     den ligger: grönt under, rött över, neutralt nära. Klick öppnar mängden. */
  function jamforelse(alla) {
    var med = alla.filter(function (x) { return x.m.rader.length; });
    var grupper = Object.keys(BP.GRUPP_MAT || {}).filter(function (g) { return g !== 'Fästdon'; });
    var yta = function (x) { return x.h ? x.h.yta : BP.delarFor(x.p).filter(function (d) { return d.typ === 'bjalklag'; }).reduce(function (t, d) { return t + d.langd * d.bredd; }, 0) || 1; };
    var median = function (v) { var s = v.slice().sort(function (a, b) { return a - b; }); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
    var rader = grupper.map(function (g) {
      var v = med.map(function (x) { return x.m.rader.filter(function (r) { return r.grupp === g; }).reduce(function (t, r) { return t + r.summa; }, 0) / yta(x); });
      return { g: g, v: v, med: median(v) };
    }).filter(function (r) { return r.med > 0; });
    var tot = { g: 'Totalt', v: med.map(function (x) { return x.m.summa / yta(x); }) };
    tot.med = median(tot.v);
    // Största avvikelsen, för meningen ovanför
    var bast = null;
    rader.forEach(function (r) { r.v.forEach(function (v, k) { var d = v / r.med - 1; if (!bast || Math.abs(d) > Math.abs(bast.d)) bast = { g: r.g, d: d, v: v, x: med[k] }; }); });
    var cell = function (r, v, k, fet) {
      var d = r.med ? v / r.med - 1 : 0, a = Math.min(1, Math.abs(d) / 0.35);
      var ton = Math.abs(d) < 0.05 ? 'nara' : d > 0 ? 'over' : 'under';
      return '<td><a class="mh-hm mh-hm--' + ton + (fet ? ' mh-hm--fet' : '') + '" href="#/projekt/' + med[k].p.id + '/mangd" style="--t:' + (ton === 'nara' ? 0 : (0.1 + a * 0.32)).toFixed(3) + '" title="' + e(med[k].p.namn) + ' · ' + e(r.g) + '"><b>' + BP.tal(Math.round(v), 0) + '</b><small>' + (Math.abs(d) < 0.005 ? 'median' : (d > 0 ? '+' : '−') + Math.round(Math.abs(d) * 100) + ' %') + '</small></a></td>';
    };
    return '<section class="kort mh-jmf" aria-labelledby="jmf-rubrik"><header class="kort__huvud"><h2 id="jmf-rubrik">Jämför per m²</h2><small>kr/m² per materialgrupp</small></header>' +
      '<div class="kort__kropp mh-jmf__kropp">' +
        (bast && Math.abs(bast.d) >= 0.05 ? '<p class="mh-jmf__insikt">' + i(bast.d > 0 ? 'varning' : 'info') + '<span>Störst skillnad: <b>' + e(bast.g.toLowerCase()) + '</b> i ' + e(bast.x.p.namn) + ' – ' + BP.tal(Math.round(bast.v), 0) + ' kr/m², ' + Math.round(Math.abs(bast.d) * 100) + ' % ' + (bast.d > 0 ? 'över' : 'under') + ' medianen.</span></p>' : '<p class="mh-jmf__insikt">' + i('bock') + '<span>Projekten ligger nära varandra i alla grupper.</span></p>') +
        '<div class="mh-jmf__ram"><table class="mh-jmf__tabell"><thead><tr><th scope="col">Grupp</th>' + med.map(function (x) {
          return '<th scope="col"><span class="mh-jmf__proj">' + (x.h ? '<img src="' + x.h.bild + '" alt="">' : '') + '<b>' + e(x.p.kund.split(' ')[0]) + '</b></span></th>';
        }).join('') + '</tr></thead><tbody>' +
        rader.map(function (r) { return '<tr><th scope="row">' + e(r.g) + '</th>' + r.v.map(function (v, k) { return cell(r, v, k); }).join('') + '</tr>'; }).join('') +
        '</tbody><tfoot><tr><th scope="row">Totalt per m²</th>' + tot.v.map(function (v, k) { return cell(tot, v, k, true); }).join('') + '</tr></tfoot></table></div>' +
        '<div class="mh-jmf__forklaring"><span><i class="mh-hm--under"></i>Under medianen</span><span><i class="mh-hm--nara"></i>Nära (±5 %)</span><span><i class="mh-hm--over"></i>Över medianen</span></div>' +
      '</div></section>';
  }

  /* --- Fråga mängderna ------------------------------------------------------------- */
  var NORM = function (s) { return String(s).toLowerCase().replace(/[×x]/g, 'x').replace(/\s+/g, ' '); };
  function fraga(q) {
    var t = NORM(q);
    var mat = BP.material();
    var projekt = BP.db.projekt.filter(function (p) { return NORM(p.namn + ' ' + p.kund + ' ' + p.ort).split(/[\s,]+/).some(function (o) { return o.length > 3 && t.indexOf(o) !== -1; }); });
    if (!projekt.length) projekt = BP.db.projekt.filter(function (p) { return p.steg !== 'order'; });
    var kostar = /kost|pris|kr\b|kronor|dyr/.test(t), spill = /spill/.test(t);
    var gruppNamn = { tak: 'Tak', fasad: 'Fasad', grund: 'Grund', stomme: 'Stomme', isoler: 'Isolering', skiv: 'Skivor', fönster: 'Fönster och dörrar', dörr: 'Fönster och dörrar', fästdon: 'Fästdon', spik: 'Fästdon', skruv: 'Fästdon' };
    var grupp = null; Object.keys(gruppNamn).forEach(function (k) { if (!grupp && t.indexOf(k) !== -1) grupp = gruppNamn[k]; });
    var ord = t.split(/[^a-zåäö0-9]+/).filter(function (o) { return o.length > 2 && ['hur', 'mycket', 'många', 'vad', 'kostar', 'behövs', 'behöver', 'för', 'alla', 'projekt', 'var', 'är', 'det', 'och', 'till', 'med', 'störst', 'spillet'].indexOf(o) === -1; });
    var matId = Object.keys(mat).filter(function (k) { var n = NORM(mat[k].namn); return ord.some(function (o) { return n.indexOf(o) !== -1; }); });
    var traffar = [];
    projekt.forEach(function (p) {
      BP.mangdFor(p).rader.forEach(function (r) {
        var ok = spill ? !!r.kapning || r.spillProcent > 0 : matId.length ? matId.indexOf(r.material) !== -1 : grupp ? r.grupp === grupp : false;
        if (grupp && matId.length && r.grupp !== grupp && matId.indexOf(r.material) === -1) ok = false;
        if (ok) traffar.push({ p: p, r: r });
      });
    });
    if (!traffar.length) return '<div class="mh-svar__kort mh-svar__kort--tom">' + i('info') + '<span>Hittade inget som matchar "' + e(q) + '". Prova ett material (gips, reglar, isolering) eller en grupp (tak, fasad, grund).</span></div>';
    if (spill) {
      traffar.sort(function (a, b) { return (b.r.brutto - b.r.netto) * b.r.apris - (a.r.brutto - a.r.netto) * a.r.apris; });
      var topp = traffar.slice(0, 4);
      return '<div class="mh-svar__kort"><p class="mh-svar__stort">Störst spill i kronor</p><ul class="mh-svar__lista">' + topp.map(function (x) {
        return '<li><a href="#/projekt/' + x.p.id + '/mangd"><b>' + e(x.r.namn) + '</b><small>' + e(x.p.namn) + ' · ' + BP.tal(x.r.spillProcent, 1) + ' % spill</small></a><span>' + BP.kr((x.r.brutto - x.r.netto) * x.r.apris) + '</span></li>';
      }).join('') + '</ul></div>';
    }
    // Flera material kan matcha (gips → gipsskiva och gipsskruv): huvudmaterialet är det
    // med störst summa, och mängden i rubriken gäller bara det.
    var perMat = {};
    traffar.forEach(function (x) { perMat[x.r.material] = (perMat[x.r.material] || 0) + x.r.summa; });
    var huvud = Object.keys(perMat).sort(function (a, b) { return perMat[b] - perMat[a]; })[0];
    if (!kostar && !(grupp && !matId.length)) traffar.sort(function (a, b) { return (b.r.material === huvud) - (a.r.material === huvud); });
    var huvudRader = traffar.filter(function (x) { return x.r.material === huvud; });
    var enhet = huvudRader[0].r.forpackning ? huvudRader[0].r.forpackning.namn : huvudRader[0].r.enhet;
    var sammaEnhet = !(grupp && !matId.length);
    var summa = traffar.reduce(function (t2, x) { return t2 + x.r.summa; }, 0);
    var mangd = huvudRader.reduce(function (t2, x) { return t2 + (x.r.forpackning ? x.r.forpackning.antal : x.r.brutto); }, 0);
    var rubrik = kostar || !sammaEnhet ? BP.kr(summa) : BP.tal(mangd, 1) + ' ' + enhet;
    var vad = grupp && !matId.length ? grupp : huvudRader[0].r.namn;
    return '<div class="mh-svar__kort"><p class="mh-svar__stort"><b>' + rubrik + '</b><span>' + e(vad) + (function () { var u = traffar.map(function (x) { return x.p; }).filter(function (p, k, a) { return a.indexOf(p) === k; }); return u.length === 1 ? ' i ' + e(u[0].namn) : ' i ' + u.length + ' projekt'; })() + '</span></p>' +
      '<ul class="mh-svar__lista">' + traffar.slice(0, 6).map(function (x) {
        return '<li><a href="#/projekt/' + x.p.id + '/mangd"><b>' + e(x.r.namn) + '</b><small>' + e(x.p.namn) + ' · pos ' + String(x.r.pos).padStart(2, '0') + '</small></a><span>' + (kostar || !sammaEnhet ? BP.kr(x.r.summa) : (x.r.forpackning ? x.r.forpackning.antal + ' ' + x.r.forpackning.namn : BP.tal(x.r.brutto, 1) + ' ' + x.r.enhet)) + '</span></li>';
      }).join('') + (traffar.length > 6 ? '<li class="mh-svar__fler">+ ' + (traffar.length - 6) + ' rader till</li>' : '') + '</ul></div>';
  }

  /* --- Koppla vyn ------------------------------------------------------------------ */
  function koppla(rot) {
    var mv = $('#snabb-mv', rot), res = $('#snabb-resultat', rot);
    var forraSumma = Math.round(snabbMangd().m.summa);

    // Huset byggs om efter måtten (husgeneratorn), kameran ramar in det mjukt.
    function skala() {
      if (!mv) return;
      clearTimeout(skala.t);
      skala.t = setTimeout(function () {
        var gammal = mv.getAttribute('src');
        BP3D.ram(mv, { langd: snabb.langd, bredd: snabb.bredd, nock: snabb.nock }, { vinkel: '36deg 68deg', marg: 1.1 });
        mv.setAttribute('src', Husbygge.url(Husbygge.urMatt(snabb)));
        if (gammal && gammal.indexOf('blob:') === 0) setTimeout(function () { URL.revokeObjectURL(gammal); }, 3000);
      }, 80);
      $('#matt-l', rot).textContent = BP.tal(snabb.langd, 2) + ' m';
      $('#matt-b', rot).textContent = BP.tal(snabb.bredd, 2) + ' m';
    }

    // Summan glider från förra värdet till det nya (rullar, inte hoppar).
    function rakna(el, fran, till) {
      if (lugnt()) { el.textContent = BP.kr(till); return; }
      var t0 = null;
      cancelAnimationFrame(el._raf);
      var steg = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 380); el.textContent = BP.kr(fran + (till - fran) * (1 - Math.pow(1 - p, 3))); if (p < 1) el._raf = requestAnimationFrame(steg); };
      el._raf = requestAnimationFrame(steg);
    }

    function uppdatera() {
      var s = snabbMangd(), ny = Math.round(s.m.summa);
      res.innerHTML = snabbResultat(s);
      rakna($('[data-rakna-live]', res), forraSumma, ny);
      forraSumma = ny;
      $('#snabb-antag', rot).textContent = s.g.antaganden.length + ' antaganden syns i projektet';
      skala();
    }

    $$('[data-snabb]', rot).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-snabb');
        snabb[k] = parseFloat(inp.value);
        $('#ut-' + k, rot).textContent = BP.tal(snabb[k], k === 'fonster' ? 0 : 2) + (k === 'fonster' ? ' st' : ' m');
        uppdatera();
      });
    });
    $$('[data-snabbtak]', rot).forEach(function (b) {
      b.addEventListener('click', function () {
        snabb.tak = b.getAttribute('data-snabbtak');
        $$('[data-snabbtak]', rot).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        uppdatera();
      });
    });
    BP.laddaMV(skala);

    // Samkapning: slå av och på projekt
    var samKoppla = function () {
      $$('[data-samp]', rot).forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-samp');
          samAv[id] = !samAv[id];
          var k = $('#sam-kropp', rot);
          k.innerHTML = samKropp(BP.db.projekt.map(function (p) { return { p: p, m: BP.mangdFor(p), h: BP.hus(p.hus) }; }));
          k.classList.remove('mh-sam--ny'); void k.offsetWidth; k.classList.add('mh-sam--ny');
          BP.rakna(k);
          samKoppla();
          var ny = $('[data-samp="' + id + '"]', k); if (ny) ny.focus();
        });
      });
    };
    samKoppla();

    // Fråga mängderna
    var form = $('#fraga-form', rot), inp = $('#fraga', rot), svar = $('#fraga-svar', rot);
    var svara = function (q) { if (!q.trim()) return; svar.innerHTML = fraga(q); svar.classList.remove('syns'); void svar.offsetWidth; svar.classList.add('syns'); };
    form.addEventListener('submit', function (ev) { ev.preventDefault(); svara(inp.value); });
    $$('[data-fraga]', rot).forEach(function (b) { b.addEventListener('click', function () { inp.value = b.getAttribute('data-fraga'); svara(inp.value); }); });
    // Ett exempelsvar från början, så att man ser vad rutan gör.
    if (!svar.innerHTML) svar.innerHTML = fraga('Vad kostar taket?').replace('mh-svar__kort"', 'mh-svar__kort" data-exempel');

    // Släpp en ritning
    var slapp = $('#slapp', rot), fil = $('#slapp-fil', rot);
    var las = function (f) {
      if (!f || !/^image\//.test(f.type)) { BP.toast('Det där är ingen bild', 'Släpp en PNG, JPG eller SVG'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var p = BP.nyttProjekt({ namn: f.name.replace(/\.[^.]+$/, ''), kund: '', ort: '', hus: null, underlag: 'ritning', ritning: { namn: f.name, bild: rd.result, bredd: img.naturalWidth, hojd: img.naturalHeight, skala: null, element: [] } });
          BP.spara(); BP.toast('Ritningen är inläst', 'Börja med att sätta skalan'); BP.ga('#/projekt/' + p.id + '/ritning');
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    ['dragenter', 'dragover'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.remove('over'); }); });
    slapp.addEventListener('drop', function (ev) { las(ev.dataTransfer.files[0]); });
    slapp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fil.click(); } });
    fil.addEventListener('change', function () { las(fil.files[0]); });
  }

  G['snabb-projekt'] = function () {
    var h = { id: null, namn: 'Snabbmängd ' + BP.tal(snabb.langd, 1) + ' × ' + BP.tal(snabb.bredd, 1) + ' m' };
    var p = BP.nyttProjekt({ namn: h.namn, kund: '', ort: '', hus: snabb.tak === 'pulpet' ? 'pulpet-30' : 'sadel-30-bred' });
    var g = M.delarForHus({ langd: snabb.langd, bredd: snabb.bredd, nock: snabb.nock, tak: snabb.tak, lutning: snabb.tak === 'pulpet' ? Math.min(snabb.lutning, 8) : snabb.lutning, fonster: [{ typ: 'fonster', bredd: 1.2, hojd: 1.2, antal: snabb.fonster }], dorrar: [{ typ: 'dorr', bredd: 1.0, hojd: 2.1, antal: 1 }] });
    g.delar.forEach(function (d) { d.bekraftad = d.typ !== 'vagg'; });
    p.delar = g.delar;
    p.antaganden = g.antaganden.concat(['Måtten kommer från snabbmängden – 3D-modellen är en förhandsvisning av ' + (snabb.tak === 'pulpet' ? 'Pulpet 30' : 'Sadel 30 Bred') + ' skalad efter måtten']);
    BP.handelse(p, 'Skapat ur snabbmängden: ' + BP.tal(snabb.langd, 2) + ' × ' + BP.tal(snabb.bredd, 2) + ' m, nock ' + BP.tal(snabb.nock, 2) + ' m');
    BP.spara();
    BP.toast('Projekt skapat', p.namn);
    BP.ga('#/projekt/' + p.id + '/mangd');
  };
})();
