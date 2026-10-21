/* Byggplattformen – kalkyl och offert.
   Nettokalkylen är projektets material till nettopris (prislistan som används, annars
   exempelpriserna) plus tillvalen och de egna kostnader som skrivs in. Ett klick på ett
   TB ger kundpriset: TB är andelen av kundpriset, så kundpris = netto ÷ (1 − TB).
   Offerten sparas på projektet och visas som ett dokument som går att skriva ut. */
(function () {
  'use strict';
  var BP = window.BP;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var TBVAL = [20, 25, 30, 35, 40, 45, 50];
  var MOMS = 0.25;
  var EGNA = [['arbete', 'Arbete', 'Montage och eget arbete'], ['frakt', 'Frakt', 'Leverans till bygget'], ['ovrigt', 'Övrigt', 'Ställning, container …']];
  var vald = null;

  function kalkyl(p) { return p.kalkyl || (p.kalkyl = { tb: 40, arbete: 0, frakt: 0, ovrigt: 0, tillval: true }); }
  function tal(s) { var v = parseFloat(String(s || '').replace(/[\s ]|kr/g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : 0; }
  function pct(v) { return BP.tal(v, v % 1 ? 1 : 0) + ' %'; }

  function berakna(p) {
    var k = kalkyl(p), m = BP.mangdFor(p), g = {};
    m.rader.forEach(function (r) { var x = g[r.grupp] || (g[r.grupp] = { namn: r.grupp, netto: 0, antal: 0 }); x.netto += r.summa; x.antal++; });
    var rader = Object.keys(g).map(function (n) { return g[n]; }).sort(function (a, b) { return b.netto - a.netto; });
    var tv = BP.tillvalSumma(p);
    if (k.tillval && tv) rader.push({ namn: 'Tillval', netto: tv, egen: 'tillval' });
    EGNA.forEach(function (o) { if (k[o[0]] > 0) rader.push({ namn: o[1], netto: k[o[0]], egen: o[0] }); });
    var f = 1 / (1 - k.tb / 100);
    rader.forEach(function (r) { r.pris = Math.round(r.netto * f); });
    var netto = rader.reduce(function (t, r) { return t + r.netto; }, 0);
    var pris = rader.reduce(function (t, r) { return t + r.pris; }, 0);
    var ob = BP.delarFor(p).filter(function (d) { return d.bekraftad === false; }).length;
    return { k: k, rader: rader, netto: netto, pris: pris, tb: pris - netto, moms: Math.round(pris * MOMS), tillval: tv, antal: m.rader.length, obekr: ob, lista: BP.prislista && BP.prislista.aktiv() };
  }

  // Ett tal som glider till sitt nya värde i stället för att hoppa.
  function rulla(el, till, format) {
    var visa = function (v) { el.textContent = format ? format(v) : BP.kr(v); };
    var fran = parseFloat(el.getAttribute('data-v'));
    el.setAttribute('data-v', till);
    if (lugnt() || !isFinite(fran) || fran === till) { visa(till); return; }
    cancelAnimationFrame(el.raf);
    var t0 = null;
    var steg = function (t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 420);
      visa(fran + (till - fran) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) el.raf = requestAnimationFrame(steg);
    };
    el.raf = requestAnimationFrame(steg);
  }
  function nr(n) { return '<span data-v="' + n + '">' + BP.kr(n) + '</span>'; }

  /* ===== Kalkylen ================================================================== */
  BP.vyer.kalkyl = function (del) {
    if (del[0] && del[1] === 'offert') return offertVy(BP.projekt(del[0]), del[2]);
    var alla = BP.db.projekt;
    var p = BP.projekt(del[0]) || BP.projekt(vald) || alla.filter(function (x) { return BP.mangdFor(x).rader.length; })[0] || alla[0];
    var html = BP.sidhuvud({
      vy: 'kalkyl', titel: 'Kalkyl och offert',
      under: 'Utgå från nettokalkylen, klicka i ditt TB och få ett färdigt kundpris. Sedan skapar du offerten med ett klick.',
      knappar: '<a class="knapp knapp--gul" href="#/prislistor">' + i('pris') + 'Prislistor</a>'
    });
    if (!p) return { titel: 'Kalkyl och offert', html: BP.sdOmslag(html + '<p class="tomt">Det finns inga projekt än. <a href="#/mangdning/ny">Starta en mängdning</a></p>') };
    vald = p.id;
    var b = berakna(p), k = b.k;
    var valj = '<nav class="ka-projekt sd-steg" style="--i:0" aria-label="Välj projekt">' + alla.map(function (x) {
      var s = BP.mangdFor(x).summa;
      return '<a href="#/kalkyl/' + x.id + '"' + (x.id === p.id ? ' aria-current="page"' : '') + '><b>' + e(x.namn) + '</b><small>' + e(x.kund) + ' · ' + (s ? BP.kort(s) + ' material' : 'ingen mängd än') + '</small></a>';
    }).join('') + '</nav>';
    if (!b.antal) {
      return { titel: 'Kalkyl och offert', html: BP.sdOmslag(html + valj + '<section class="ka-tom sd-steg" style="--i:1"><h2>Mängden är tom</h2><p>Kalkylen bygger på projektets mängd. Mängda projektet först, så räknas nettot fram här.</p><a class="knapp knapp--primar" href="#/projekt/' + p.id + '/mangd">' + i('mangd') + 'Till mängden</a></section>') };
    }
    var max = Math.max.apply(null, b.rader.map(function (r) { return r.netto; }));
    var radHtml = function (r, n) {
      return '<li class="ka-rad' + (r.egen ? ' ka-rad--egen' : '') + '" style="--r:' + n + '"><span class="ka-rad__namn"><b>' + e(r.namn) + '</b><small>' + (r.antal ? r.antal + ' artiklar' : r.egen === 'tillval' ? 'kundens val' : 'egen kostnad') + '</small></span>' +
        '<span class="ka-rad__stapel" aria-hidden="true"><i style="--a:' + (r.netto / max).toFixed(3) + '"></i></span><span class="ka-rad__netto">' + BP.kr(r.netto) + '</span><span class="ka-rad__pris" data-ka-rad="' + e(r.namn) + '">' + nr(r.pris) + '</span></li>';
    };
    html += valj + '<div class="ka">' +
      '<section class="ka-netto kort sd-steg" style="--i:1" aria-labelledby="ka-netto-rubrik">' +
        '<header class="ka-netto__huvud"><div><h2 id="ka-netto-rubrik">Nettokalkyl</h2><small>' + e(p.namn) + ' · ' + e(p.kund) + (p.ort ? ', ' + e(p.ort) : '') + '</small></div>' +
          '<a class="ka-kalla" href="#/prislistor">' + i('pris') + (b.lista ? 'Nettopriser från <b>' + e(b.lista.namn) + '</b>' : 'Exempelpriser – <b>mata in din prislista</b>') + '</a></header>' +
        (b.obekr ? '<p class="not not--varning ka-not">' + i('varning') + '<span>' + b.obekr + ' byggdelar är inte bekräftade – kalkylen kan ändras. <a href="#/projekt/' + p.id + '/mangd">Bekräfta i mängden</a></span></p>' : '') +
        '<div class="ka-tabell"><div class="ka-tabell__huvud"><span>Del</span><span></span><span>Netto</span><span>Kundpris</span></div><ol class="ka-rader" id="ka-rader">' + b.rader.map(radHtml).join('') + '</ol>' +
          '<div class="ka-summa"><span>Summa</span><span></span><span id="ka-netto">' + nr(b.netto) + '</span><span id="ka-pris-rad">' + nr(b.pris) + '</span></div></div>' +
        '<div class="ka-egna"><h3>Egna kostnader <small>netto, exkl. moms</small></h3><div class="ka-egna__falt">' +
          EGNA.map(function (o) { return '<label class="falt"><span>' + o[1] + '</span><span class="ka-kr"><input inputmode="decimal" data-ka-egen="' + o[0] + '" value="' + (k[o[0]] ? BP.tal(k[o[0]], 0) : '') + '" placeholder="0"><i>kr</i></span><small>' + o[2] + '</small></label>'; }).join('') +
          '</div>' + (b.tillval ? '<label class="ka-vaxel"><input type="checkbox" id="ka-tillval"' + (k.tillval ? ' checked' : '') + '><span class="ka-vaxel__ratt" aria-hidden="true"></span><span>Ta med kundens tillval <b>' + BP.kr(b.tillval) + '</b></span></label>' : '') + '</div>' +
      '</section>' +
      '<aside class="ka-tb kort sd-steg" style="--i:2" aria-labelledby="ka-tb-rubrik">' +
        '<h2 id="ka-tb-rubrik">Välj TB</h2>' +
        '<div class="ka-tbval" role="radiogroup" aria-label="Täckningsbidrag">' + TBVAL.map(function (v) { return '<button type="button" role="radio" data-tb="' + v + '" aria-checked="' + (k.tb === v) + '">' + v + ' %</button>'; }).join('') + '</div>' +
        '<label class="ka-reglage"><span>Eget TB</span><input type="range" min="0" max="70" step="1" id="ka-tb" value="' + k.tb + '" aria-label="Eget TB i procent"><output id="ka-tb-ut">' + pct(k.tb) + '</output></label>' +
        '<div class="ka-stort"><small>Kundpris exkl. moms</small><b id="ka-pris">' + nr(b.pris) + '</b><span id="ka-inkl">' + BP.kr(b.pris + b.moms) + ' inkl. moms</span></div>' +
        '<div class="ka-andel" aria-hidden="true"><i class="ka-andel__netto" id="ka-a-netto" style="--a:' + (b.netto / b.pris).toFixed(4) + '"></i><i class="ka-andel__tb" id="ka-a-tb" style="--a:' + (b.tb / b.pris).toFixed(4) + '"></i></div>' +
        '<dl class="ka-dl"><div><dt><i class="ka-prick ka-prick--netto"></i>Nettokostnad</dt><dd id="ka-d-netto">' + nr(b.netto) + '</dd></div>' +
          '<div><dt><i class="ka-prick ka-prick--tb"></i>Täckningsbidrag</dt><dd id="ka-d-tb">' + nr(b.tb) + '</dd></div>' +
          '<div><dt>Påslag på netto</dt><dd id="ka-d-paslag">' + pct(Math.round(k.tb / (100 - k.tb) * 1000) / 10) + '</dd></div>' +
          '<div><dt>Moms 25 %</dt><dd id="ka-d-moms">' + nr(b.moms) + '</dd></div></dl>' +
        '<p class="ka-forklaring">TB räknas på kundpriset: med <b id="ka-f-tb">' + pct(k.tb) + '</b> TB är så stor del av kundpriset ditt bidrag. Kundpris = netto ÷ (1 − TB).</p>' +
        '<button class="knapp knapp--primar knapp--stor ka-skapa" type="button" data-g="ka-offert" data-id="' + p.id + '">' + i('dokument') + 'Skapa offert</button>' +
        ((p.offerter || []).length ? '<div class="ka-offerter"><h3>Offerter för projektet</h3>' + p.offerter.map(function (o) {
          return '<a href="#/kalkyl/' + p.id + '/offert/' + o.nr + '"><span><b>' + o.nr + '</b><small>' + BP.datum(o.skapad) + ' · TB ' + pct(o.tbProcent) + '</small></span><span>' + BP.kr(o.pris) + '</span>' + i('hoger') + '</a>';
        }).join('') + '</div>' : '') +
      '</aside></div>';

    return {
      titel: 'Kalkyl och offert', html: BP.sdOmslag(html),
      efter: function (rot) {
        var sparTid;
        var uppdatera = function () {
          var n = berakna(p), kk = n.k;
          n.rader.forEach(function (r) { var el = $('[data-ka-rad="' + r.namn + '"] span', rot); if (el) rulla(el, r.pris); });
          rulla($('#ka-pris span', rot), n.pris); rulla($('#ka-pris-rad span', rot), n.pris);
          rulla($('#ka-netto span', rot), n.netto); rulla($('#ka-d-netto span', rot), n.netto);
          rulla($('#ka-d-tb span', rot), n.tb); rulla($('#ka-d-moms span', rot), n.moms);
          $('#ka-inkl', rot).textContent = BP.kr(n.pris + n.moms) + ' inkl. moms';
          $('#ka-d-paslag', rot).textContent = pct(Math.round(kk.tb / (100 - kk.tb) * 1000) / 10);
          $('#ka-f-tb', rot).textContent = pct(kk.tb); $('#ka-tb-ut', rot).textContent = pct(kk.tb);
          $('#ka-a-netto', rot).style.setProperty('--a', (n.netto / n.pris).toFixed(4));
          $('#ka-a-tb', rot).style.setProperty('--a', (n.tb / n.pris).toFixed(4));
          $$('[data-tb]', rot).forEach(function (x) { x.setAttribute('aria-checked', String(+x.getAttribute('data-tb') === kk.tb)); });
          clearTimeout(sparTid); sparTid = setTimeout(BP.spara, 300);
        };
        $$('[data-tb]', rot).forEach(function (x) {
          x.addEventListener('click', function () { k.tb = +x.getAttribute('data-tb'); $('#ka-tb', rot).value = k.tb; uppdatera(); });
        });
        $('#ka-tb', rot).addEventListener('input', function (ev) { k.tb = +ev.target.value; uppdatera(); });
        var omrita = function () { BP.spara(); var y = $('#ark') ? $('#ark').scrollTop : 0; BP.rita(); if ($('#ark')) $('#ark').scrollTop = y; };
        // Egna kostnader ändrar raderna, så listan ritas om när fältet lämnas.
        $$('[data-ka-egen]', rot).forEach(function (f) {
          f.addEventListener('change', function () { k[f.getAttribute('data-ka-egen')] = tal(f.value); omrita(); });
          f.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') f.blur(); });
        });
        var tv = $('#ka-tillval', rot);
        if (tv) tv.addEventListener('change', function () { k.tillval = tv.checked; omrita(); });
      }
    };
  };

  G['ka-offert'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id')), b = berakna(p), r = BP.roll();
    var antal = BP.db.projekt.reduce(function (t, x) { return t + (x.offerter || []).length; }, 0);
    var o = {
      nr: 'OF-' + new Date().getFullYear() + '-' + String(antal + 1).padStart(3, '0'),
      skapad: new Date().toISOString(), giltigDagar: 30,
      tbProcent: b.k.tb, netto: b.netto, tb: b.tb, pris: b.pris, moms: b.moms,
      rader: b.rader.map(function (x) { return { namn: x.namn, pris: x.pris }; }),
      lista: b.lista ? b.lista.namn : null, foretag: r.foretag || 'Exempel Bygg AB', av: r.person
    };
    (p.offerter || (p.offerter = [])).unshift(o);
    BP.handelse(p, 'Offert ' + o.nr + ' skapad – ' + BP.kr(o.pris) + ' exkl. moms, TB ' + pct(o.tbProcent));
    BP.spara();
    BP.ga('#/kalkyl/' + p.id + '/offert/' + o.nr);
    BP.toast('Offerten är skapad', o.nr + ' · ' + BP.kr(o.pris + o.moms) + ' inkl. moms');
  };

  /* ===== Offerten ================================================================== */
  var DAGNAMN = function (iso) { return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }); };
  function offertVy(p, nummer) {
    var o = p && (p.offerter || []).filter(function (x) { return x.nr === nummer; })[0];
    if (!o) return { titel: 'Offerten finns inte', html: '<p class="tomt">Offerten finns inte. <a href="#/kalkyl">Till kalkylen</a></p>' };
    var giltig = new Date(new Date(o.skapad).getTime() + o.giltigDagar * 864e5).toISOString();
    var html =
      '<div class="of-verktyg sd-steg" style="--i:0"><a class="knapp knapp--text" href="#/kalkyl/' + p.id + '">' + i('vanster') + 'Tillbaka till kalkylen</a>' +
        '<div class="of-verktyg__hoger"><span class="of-intern">' + i('ka') + 'Bara för dig: netto ' + BP.kr(o.netto) + ' · TB ' + BP.kr(o.tb) + ' (' + pct(o.tbProcent) + ')</span>' +
        '<button class="knapp knapp--primar" type="button" data-g="of-skriv">' + i('skrivut') + 'Skriv ut eller spara PDF</button></div></div>' +
      '<article class="of-dok sd-steg" style="--i:1" aria-label="Offert ' + o.nr + '">' +
        '<header class="of-dok__huvud"><div><b class="of-firma">' + e(o.foretag) + '</b><small>' + e(o.av) + '</small></div><div class="of-titel"><h1>Offert</h1><dl><div><dt>Nummer</dt><dd>' + o.nr + '</dd></div><div><dt>Datum</dt><dd>' + DAGNAMN(o.skapad) + '</dd></div><div><dt>Gäller till</dt><dd>' + DAGNAMN(giltig) + '</dd></div></dl></div></header>' +
        '<div class="of-till"><div><small>Till</small><b>' + e(p.kund) + '</b></div><div><small>Projekt</small><b>' + e(p.namn) + '</b>' + (p.ort ? '<span>' + e(p.ort) + '</span>' : '') + '</div></div>' +
        '<table class="of-tabell"><thead><tr><th>Avser</th><th class="tal-c">Belopp exkl. moms</th></tr></thead><tbody>' +
          o.rader.map(function (r, n) { return '<tr style="--r:' + n + '"><td>' + e(r.namn) + '</td><td class="tal-c">' + BP.kr(r.pris) + '</td></tr>'; }).join('') +
        '</tbody></table>' +
        '<div class="of-summa"><div><span>Summa exkl. moms</span><b>' + BP.kr(o.pris) + '</b></div><div><span>Moms 25 %</span><b>' + BP.kr(o.moms) + '</b></div><div class="of-summa__att"><span>Att betala inkl. moms</span><b>' + BP.kr(o.pris + o.moms) + '</b></div></div>' +
        '<div class="of-villkor"><h2>Villkor</h2><p>Offerten gäller i ' + o.giltigDagar + ' dagar från datumet ovan. Priset bygger på projektets mängd' + (o.lista ? ' och prislistan ' + e(o.lista) : '') + ' och kan ändras om underlaget ändras.</p></div>' +
        '<footer class="of-fot">Exempel skapat i prototypen – inte en riktig offert.</footer>' +
      '</article>';
    return { titel: 'Offert ' + o.nr, html: BP.sdOmslag(html) };
  }
  G['of-skriv'] = function () { window.print(); };
})();
