/* Byggplattformen – ritverktyget (fliken Ritning i projektrummet).
   Ritningen ligger i sitt eget koordinatsystem (bildens pixlar). Skalan
   sätts med två punkter och ett känt mått. Väggar ritas som linjer som
   snäpper till 90° och till befintliga hörn, ytor som polygoner, öppningar
   klickas fast på en vägg. Allt nytt är obekräftat (tejpat) tills någon
   bekräftar det, och mängden räknas om medan man ritar.
   Tangenter: V välj · S skala · Y yttervägg · I innervägg · G golvyta ·
   O öppning · H panorera · Enter avsluta/bekräfta · Esc avbryt · Delete ta bort
   · + / − zoom · 0 anpassa. */
(function () {
  'use strict';
  var BP = window.BP, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;

  var VERKTYG = [
    ['valj', 'Välj', 'pekare', 'V'],
    ['skala', 'Sätt skala', 'linjal', 'S'],
    ['yttervagg', 'Yttervägg', 'vagg', 'Y'],
    ['innervagg', 'Innervägg', 'vagg', 'I'],
    ['yta', 'Golvyta', 'golv', 'G'],
    ['oppning', 'Fönster/dörr', 'oppning', 'O'],
    ['panorera', 'Panorera', 'hand', 'H']
  ];
  var HINT = {
    valj: 'Klicka på en vägg eller yta för att välja den. Enter bekräftar, Delete tar bort.',
    skala: 'Klicka på två punkter med känt avstånd – till exempel måttlinjens ändar.',
    yttervagg: 'Klicka där väggen börjar och där den slutar. Fortsätt klicka för nästa vägg, Esc avslutar.',
    innervagg: 'Klicka där innerväggen börjar och slutar. Esc avslutar.',
    yta: 'Klicka i hörnen runt golvytan. Klicka på första punkten eller tryck Enter för att stänga.',
    oppning: 'Klicka på en vägg där fönstret eller dörren sitter.',
    panorera: 'Dra för att flytta ritningen. Mushjulet zoomar.'
  };

  // Den tomma exempelritningen (samma plan som i seed, utan avritning).
  BP.exempelRitningTom = function () {
    return { namn: 'Exempelritning – planritning 1:50.svg', bredd: 720, hojd: 480, skala: null, kalibrering: null, element: [], plan: { ox: 120, oy: 110, s: 60 } };
  };

  // Planritningen som SVG: Pulpet 30, 7,50 × 4,00 m, innervägg, fönster, dörr och måttlinje.
  function planSvg(pl) {
    var s = pl.s, ox = pl.ox, oy = pl.oy, t = 0.245 * s;
    var x = function (m) { return ox + m * s; }, y = function (m) { return oy + m * s; };
    var g = '<rect width="720" height="480" fill="#fff"/>';
    for (var gx = 0; gx <= 720; gx += 20) g += '<path d="M' + gx + ' 0V480" stroke="#eef2f7" stroke-width="1"/>';
    for (var gy = 0; gy <= 480; gy += 20) g += '<path d="M0 ' + gy + 'H720" stroke="#eef2f7" stroke-width="1"/>';
    // Ytterväggar som dubbla linjer med fyllnad
    g += '<path d="M' + x(0) + ' ' + y(0) + 'H' + x(7.5) + 'V' + y(4) + 'H' + x(0) + 'Z" fill="none" stroke="#2b3a55" stroke-width="' + t + '" stroke-opacity=".22"/>';
    g += '<path d="M' + (x(0) - t / 2) + ' ' + (y(0) - t / 2) + 'H' + (x(7.5) + t / 2) + 'V' + (y(4) + t / 2) + 'H' + (x(0) - t / 2) + 'Z" fill="none" stroke="#2b3a55" stroke-width="1.6"/>';
    g += '<path d="M' + (x(0) + t / 2) + ' ' + (y(0) + t / 2) + 'H' + (x(7.5) - t / 2) + 'V' + (y(4) - t / 2) + 'H' + (x(0) + t / 2) + 'Z" fill="none" stroke="#2b3a55" stroke-width="1.2"/>';
    // Innervägg vid 4,2 m
    g += '<rect x="' + (x(4.2) - 0.048 * s) + '" y="' + (y(0) + t / 2) + '" width="' + (0.096 * s) + '" height="' + (4 * s - t - 0.9 * s) + '" fill="#d9dee8" stroke="#2b3a55" stroke-width="1"/>';
    // Fönster i långväggen fram (2,4 m) och gaveln (1,2 m)
    var fon = function (x1, y1, x2, y2) { return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="#fff" stroke-width="' + (t + 2) + '"/><path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="#2b3a55" stroke-width="1.2"/>' + '<path d="M' + x1 + ' ' + (y1 - t / 2) + 'L' + x2 + ' ' + (y2 - t / 2) + 'M' + x1 + ' ' + (y1 + t / 2) + 'L' + x2 + ' ' + (y2 + t / 2) + '" stroke="#2b3a55" stroke-width="1"/>'; };
    g += fon(x(1.2), y(0), x(3.6), y(0));
    g += fon(x(5.2), y(4), x(6.4), y(4));
    // Dörr i långväggen bak med slagbåge
    g += '<path d="M' + x(2.0) + ' ' + y(4) + 'L' + x(3.0) + ' ' + y(4) + '" stroke="#fff" stroke-width="' + (t + 2) + '"/>';
    g += '<path d="M' + x(2.0) + ' ' + y(4) + 'L' + x(2.0) + ' ' + y(3.0) + 'M' + x(2.0) + ' ' + y(3.0) + 'A' + s + ' ' + s + ' 0 0 1 ' + x(3.0) + ' ' + y(4) + '" fill="none" stroke="#2b3a55" stroke-width="1"/>';
    // Måttlinje överst: 7 500
    var my = y(0) - 46;
    g += '<path d="M' + x(0) + ' ' + (my - 8) + 'V' + (my + 8) + 'M' + x(7.5) + ' ' + (my - 8) + 'V' + (my + 8) + 'M' + x(0) + ' ' + my + 'H' + x(7.5) + '" stroke="#2b3a55" stroke-width="1"/>';
    g += '<path d="M' + (x(0) - 5) + ' ' + (my + 5) + 'L' + (x(0) + 5) + ' ' + (my - 5) + 'M' + (x(7.5) - 5) + ' ' + (my + 5) + 'L' + (x(7.5) + 5) + ' ' + (my - 5) + '" stroke="#2b3a55" stroke-width="1.4"/>';
    g += '<text x="' + x(3.75) + '" y="' + (my - 8) + '" text-anchor="middle" font-family="Barlow, sans-serif" font-size="14" fill="#2b3a55">7 500</text>';
    // Måttlinje gavel: 4 000
    var mx = x(7.5) + 46;
    g += '<path d="M' + (mx - 8) + ' ' + y(0) + 'H' + (mx + 8) + 'M' + (mx - 8) + ' ' + y(4) + 'H' + (mx + 8) + 'M' + mx + ' ' + y(0) + 'V' + y(4) + '" stroke="#2b3a55" stroke-width="1"/>';
    g += '<text x="' + (mx + 12) + '" y="' + y(2) + '" font-family="Barlow, sans-serif" font-size="14" fill="#2b3a55" transform="rotate(90 ' + (mx + 12) + ' ' + y(2) + ')" text-anchor="middle">4 000</text>';
    // Rumsnamn och ritningshuvud
    g += '<text x="' + x(2.1) + '" y="' + y(1.9) + '" text-anchor="middle" font-family="Barlow, sans-serif" font-size="13" fill="#2b3a55">ALLRUM</text>';
    g += '<text x="' + x(5.85) + '" y="' + y(1.9) + '" text-anchor="middle" font-family="Barlow, sans-serif" font-size="13" fill="#2b3a55">SOVRUM</text>';
    g += '<rect x="476" y="402" width="220" height="56" fill="#fff" stroke="#2b3a55"/><path d="M476 424H696" stroke="#2b3a55"/>';
    g += '<text x="486" y="418" font-family="Barlow, sans-serif" font-size="12" fill="#2b3a55">EXEMPELRITNING · PLAN</text>';
    g += '<text x="486" y="444" font-family="Barlow, sans-serif" font-size="12" fill="#2b3a55">Skala 1:50 · Mått i mm</text>';
    return g;
  }

  /* --- Fliken Ritning ------------------------------------------------------------ */
  var tillstand = {};
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  BP.flikvyer.ritning = function (p) {
    if (p.underlag !== 'ritning' || !p.ritning) {
      return { html: '<div class="tomt" style="max-width:720px">' + i('kub') + '<b>Det här projektet räknas ur en husmodell.</b><span>Måtten kommer från modellens ritning, så det finns inget att rita av. Vill du mängda ett eget underlag, skapa en ny mängdning med en ritning.</span><a class="knapp" href="#/mangdning/ny">' + i('plus') + 'Ny mängdning från ritning</a></div>' };
    }
    var r = p.ritning;
    var forsta = !tillstand[p.id];
    var st = tillstand[p.id] || (tillstand[p.id] = { verktyg: r.skala ? 'yttervagg' : 'skala', vald: null, punkter: [], hojd: 2.5, oppTyp: 'fonster', oppB: 1.2, oppH: 1.2, takPaYta: true, ritas: {} });
    // Första gången ritningen öppnas ritas de avritade väggarna fram en i taget.
    if (forsta && !lugnt()) r.element.forEach(function (el, k) { if (el.typ === 'vagg') st.ritas[el.id] = performance.now() + 260 + k * 90; });
    var html = '<div class="ritbord">' +
      '<aside class="ritpanel" aria-label="Verktyg"><div class="ritpanel__kropp" style="display:grid;gap:16px;align-content:start">' +
        '<div class="verktyg" role="toolbar" aria-label="Ritverktyg">' + VERKTYG.map(function (v) {
          return '<button type="button" data-verktyg="' + v[0] + '" aria-pressed="' + (st.verktyg === v[0]) + '">' + i(v[2]) + v[1] + '<kbd>' + v[3] + '</kbd></button>';
        }).join('') + '</div>' +
        '<div id="inst" style="display:grid;gap:12px"></div>' +
      '</div></aside>' +
      '<div class="duk" id="duk" data-verktyg="' + st.verktyg + '"><svg class="lager" id="ritsvg" role="application" aria-label="Ritning: ' + e(r.namn) + '" tabindex="0"></svg>' +
        '<div class="duk__info"><span class="chip" style="background:#fff;border:1px solid var(--kant)">' + i('ritning') + e(r.namn) + '</span>' +
          (r.skala ? '<span class="chip chip--gron">Skala satt · ' + BP.tal(r.skala, 1) + ' px/m</span>' : '<span class="chip chip--tejp">Skala saknas</span>') + '</div>' +
        '<div class="duk__zoom"><button type="button" data-zoom="1.25" aria-label="Zooma in">' + i('zoomin') + '</button><button type="button" data-zoom="0.8" aria-label="Zooma ut">' + i('zoomut') + '</button><button type="button" data-zoom="0" aria-label="Anpassa">' + i('anpassa') + '</button></div>' +
        '<div class="duk__hint" id="hint" aria-live="polite"></div></div>' +
      '<aside class="ritpanel" aria-label="Avritat"><div class="kort__huvud"><h2>Avritat</h2><small id="raknare" style="margin-left:auto"></small></div><div class="ritpanel__kropp"><ul class="ellista" id="ellista"></ul></div>' +
        '<div class="kort__kropp" style="border-top:1px solid var(--regel);display:grid;gap:10px" id="summering"></div></aside>' +
    '</div>';
    return { html: html, efter: function (rot) { koppla(rot, p, st); } };
  };

  function koppla(rot, p, st) {
    var r = p.ritning;
    var svg = $('#ritsvg', rot), duk = $('#duk', rot);
    var NS = 'http://www.w3.org/2000/svg';
    var vb = st.vb || { x: -20, y: -20, w: r.bredd + 40, h: r.hojd + 40 };
    st.vb = vb;
    var mus = null, drag = null;

    function satVb() { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
    function pkt(ev) {
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      var q = pt.matrixTransform(svg.getScreenCTM().inverse());
      return [q.x, q.y];
    }
    function pxPerSkarm() { var ctm = svg.getScreenCTM(); return ctm ? 1 / ctm.a : 1; }

    // Snäpp: till befintliga hörn inom 10 skärmpixlar, sedan till 0/90° från startpunkten.
    function snapp(q, fran, fri) {
      var tol = 10 * pxPerSkarm(), bast = null;
      r.element.forEach(function (el) { el.pts.forEach(function (h) { var d = Math.hypot(h[0] - q[0], h[1] - q[1]); if (d < tol && (!bast || d < bast.d)) bast = { d: d, p: h }; }); });
      st.punkter.forEach(function (h) { var d = Math.hypot(h[0] - q[0], h[1] - q[1]); if (d < tol && (!bast || d < bast.d)) bast = { d: d, p: h }; });
      if (bast) return { p: [bast.p[0], bast.p[1]], hörn: true };
      if (fran && !fri) {
        var dx = q[0] - fran[0], dy = q[1] - fran[1];
        var vinkel = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90;
        if (vinkel < 6 || vinkel > 84) return { p: Math.abs(dx) > Math.abs(dy) ? [q[0], fran[1]] : [fran[0], q[1]], ortho: true };
      }
      return { p: q };
    }

    function matt(a, b) {
      var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return r.skala ? BP.tal(d / r.skala, 2) + ' m' : Math.round(d) + ' px';
    }

    function tjocklek(el) {
      var rc = BP.recept()[el.recept];
      return r.skala && rc && rc.tjocklek ? rc.tjocklek * r.skala : (el.recept === 'innervagg-70' ? 6 : 12);
    }

    function rita() {
      var h = '<defs><pattern id="tejpmonster" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="#7aa98c"/><rect x="7" width="7" height="14" fill="#2b2722"/></pattern></defs>';
      h += r.bild ? '<image href="' + r.bild + '" x="0" y="0" width="' + r.bredd + '" height="' + r.hojd + '"/>' : planSvg(r.plan);
      // Ytor först, väggar ovanpå.
      r.element.filter(function (el) { return el.typ === 'yta'; }).forEach(function (el) {
        h += '<polygon class="el-yta' + (el.bekraftad === false ? ' obekraftad' : '') + (st.vald === el.id ? ' el-vald' : '') + (st.ritas[el.id] != null && performance.now() - st.ritas[el.id] < 500 ? '" style="animation:yta-in 360ms cubic-bezier(0.23,1,0.32,1) ' + Math.round(st.ritas[el.id] - performance.now()) + 'ms both' : '') + '" data-el="' + el.id + '" points="' + el.pts.map(function (q) { return q.join(','); }).join(' ') + '"/>';
        // Ytans mått i det inre övre vänstra hörnet, så det inte krockar med väggarnas mått.
        var minx = Math.min.apply(null, el.pts.map(function (q) { return q[0]; })), miny = Math.min.apply(null, el.pts.map(function (q) { return q[1]; }));
        var d = BP.ritDelar({ skala: r.skala, element: [el] })[0];
        h += '<text class="el-matt" x="' + (minx + 22) + '" y="' + (miny + 40) + '" style="fill:#174a88">' + (d ? 'Golv ' + BP.tal(d.langd * d.bredd, 1) + ' m²' : 'yta') + '</text>';
      });
      var tid = performance.now();
      r.element.filter(function (el) { return el.typ === 'vagg'; }).forEach(function (el) {
        var a = el.pts[0], b = el.pts[1], t = tjocklek(el);
        // Väggen ritas fram från sin startpunkt. Starttiden ligger i st.ritas, så att
        // omritningar vid varje musrörelse fortsätter animationen i stället för att börja om.
        var fram = '';
        if (st.ritas[el.id] != null) {
          var Lr = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (tid - st.ritas[el.id] > 700) delete st.ritas[el.id];
          else fram = ' style="stroke-dasharray:' + Lr.toFixed(1) + ';stroke-dashoffset:' + Lr.toFixed(1) + ';animation:vagg-fram 320ms cubic-bezier(0.23,1,0.32,1) ' + Math.round(st.ritas[el.id] - tid) + 'ms forwards"';
        }
        h += '<line class="el-vagg' + (el.recept === 'innervagg-70' ? ' inner' : '') + (el.bekraftad === false ? ' obekraftad' : '') + (st.vald === el.id ? ' el-vald' : '') + '" data-el="' + el.id + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke-width="' + t + '"' + fram + '/>';
        // Öppningar som vita luckor med etikett.
        var L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        (el.oppningar || []).forEach(function (o) {
          if (o.pos == null) return;
          var bredd = r.skala ? o.bredd * r.skala : 40;
          var ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
          var mx = a[0] + ux * o.pos * L, my = a[1] + uy * o.pos * L;
          h += '<line class="el-oppning" x1="' + (mx - ux * bredd / 2) + '" y1="' + (my - uy * bredd / 2) + '" x2="' + (mx + ux * bredd / 2) + '" y2="' + (my + uy * bredd / 2) + '" stroke-width="' + (t * 0.55) + '"/>';
          h += '<text class="el-matt" x="' + (mx - uy * (t + 10)) + '" y="' + (my + ux * (t + 10) + 4) + '" text-anchor="middle" style="font-size:11px">' + (o.typ === 'dorr' ? 'D ' : 'F ') + BP.tal(o.bredd * 10, 0) + '×' + BP.tal(o.hojd * 10, 0) + '</text>';
        });
        var nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
        h += '<text class="el-matt" x="' + ((a[0] + b[0]) / 2 + nx * (t / 2 + 14)) + '" y="' + ((a[1] + b[1]) / 2 + ny * (t / 2 + 14) + 4) + '" text-anchor="middle">' + matt(a, b) + '</text>';
      });
      // Kalibreringen
      if (r.kalibrering) {
        var k = r.kalibrering;
        h += '<line class="el-kalib" x1="' + k.a[0] + '" y1="' + k.a[1] + '" x2="' + k.b[0] + '" y2="' + k.b[1] + '" stroke-dasharray="6 4"/>';
      }
      // Pågående ritning
      if (st.punkter.length) {
        var sista = st.punkter[st.punkter.length - 1];
        if (st.verktyg === 'yta') h += '<polyline class="el-guide" points="' + st.punkter.concat(mus ? [mus.p] : []).map(function (q) { return q.join(','); }).join(' ') + '"/>';
        if (mus) {
          h += '<line class="' + (st.verktyg === 'skala' ? 'el-kalib' : 'el-guide') + '" x1="' + sista[0] + '" y1="' + sista[1] + '" x2="' + mus.p[0] + '" y2="' + mus.p[1] + '"/>';
          h += '<text class="el-matt" x="' + (mus.p[0] + 12) + '" y="' + (mus.p[1] - 12) + '">' + matt(sista, mus.p) + (mus.ortho ? ' · 90°' : '') + '</text>';
        }
        st.punkter.forEach(function (q) { h += '<circle class="el-punkt" cx="' + q[0] + '" cy="' + q[1] + '" r="' + (5 * pxPerSkarm()) + '"/>'; });
      }
      if (mus && mus.hörn) h += '<circle cx="' + mus.p[0] + '" cy="' + mus.p[1] + '" r="' + (9 * pxPerSkarm()) + '" fill="none" stroke="#1f5fad" stroke-width="' + (2 * pxPerSkarm()) + '"/>';
      svg.innerHTML = h;
      panel();
    }

    function panel() {
      var delar = BP.ritDelar(r), m = M.mangda(delar, BP.recept(), BP.material());
      var ob = r.element.filter(function (el) { return el.bekraftad === false; }).length;
      $('#raknare', rot).textContent = r.element.length + ' element';
      $('#ellista', rot).innerHTML = r.element.length ? r.element.map(function (el, n) {
        var d = BP.ritDelar({ skala: r.skala, element: [el] })[0];
        var namn = el.typ === 'yta' ? 'Golvyta ' + (n + 1) : (el.recept === 'innervagg-70' ? 'Innervägg ' : 'Yttervägg ') + (n + 1);
        var info = !r.skala ? 'skala saknas' : el.typ === 'yta' ? BP.tal(d.langd) + ' × ' + BP.tal(d.bredd) + ' m' + (el.tak ? ' · tak och grund' : '') : BP.tal(d.langd) + ' m × ' + BP.tal(el.hojd) + ' m' + ((el.oppningar || []).length ? ' · ' + el.oppningar.length + ' öppn.' : '');
        return '<li class="' + (el.bekraftad === false ? 'obekraftad ' : '') + (st.vald === el.id ? 'vald' : '') + '" data-valj="' + el.id + '"><span><b>' + namn + '</b><small>' + info + '</small></span>' +
          '<button class="bock" type="button" data-bekr="' + el.id + '" aria-pressed="' + (el.bekraftad !== false) + '" aria-label="' + (el.bekraftad !== false ? 'Bekräftad' : 'Bekräfta') + ' ' + namn + '">' + i('bock') + '</button>' +
          '<button class="vik" type="button" data-ta-bort="' + el.id + '" aria-label="Ta bort ' + namn + '">' + i('radera') + '</button></li>';
      }).join('') : '<li style="cursor:default;padding-left:6px;color:var(--text-3)">Inget avritat än.</li>';
      $('#summering', rot).innerHTML = !r.skala
        ? '<div class="not not--tejp"><span><b>Börja med skalan.</b> Välj Sätt skala och klicka på måttlinjens två ändar.</span></div>'
        : '<dl class="grop"><div><dt>Materialrader</dt><dd><b>' + m.rader.length + '</b></dd></div><div><dt>Material, exempelpriser</dt><dd><b>' + BP.kr(m.summa) + '</b></dd></div><div><dt>Obekräftat</dt><dd><b>' + ob + '</b></dd></div></dl>' +
          '<a class="knapp knapp--primar" href="#/projekt/' + p.id + '/mangd" style="width:100%">' + i('mangd') + 'Till materiallistan</a>';
      $$('[data-valj]', rot).forEach(function (li) { li.addEventListener('click', function (ev) { if (ev.target.closest('button')) return; st.vald = li.getAttribute('data-valj'); satVerktyg('valj'); }); });
      $$('[data-bekr]', rot).forEach(function (b) { b.addEventListener('click', function () { var el = hitta(b.getAttribute('data-bekr')); el.bekraftad = el.bekraftad === false; BP.handelse(p, (el.bekraftad ? 'Bekräftade ' : 'Tog bort bekräftelse på ') + 'ett avritat element'); spara(); }); });
      $$('[data-ta-bort]', rot).forEach(function (b) { b.addEventListener('click', function () { taBort(b.getAttribute('data-ta-bort')); }); });
    }

    function installningar() {
      var h = '';
      if (st.verktyg === 'yttervagg' || st.verktyg === 'innervagg') h = '<label class="falt"><span>Vägghöjd, m</span><input class="inmatning" type="number" step="0.05" min="2" max="5" value="' + st.hojd + '" data-inst="hojd"></label><p style="font-size:12px;color:var(--text-3)">Recept: ' + e(BP.recept()[st.verktyg === 'innervagg' ? 'innervagg-70' : 'yttervagg-170'].namn) + '</p>';
      if (st.verktyg === 'oppning') h = '<div class="segment" role="group" aria-label="Typ"><button type="button" data-opp="fonster" aria-pressed="' + (st.oppTyp === 'fonster') + '">Fönster</button><button type="button" data-opp="dorr" aria-pressed="' + (st.oppTyp === 'dorr') + '">Dörr</button></div>' +
        '<div class="falt-rad"><label class="falt"><span>Bredd, m</span><input class="inmatning inmatning--tal" type="number" step="0.1" min="0.4" max="5" value="' + st.oppB + '" data-inst="oppB"></label><label class="falt"><span>Höjd, m</span><input class="inmatning inmatning--tal" type="number" step="0.1" min="0.4" max="3" value="' + st.oppH + '" data-inst="oppH"></label></div>';
      if (st.verktyg === 'yta') h = '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-inst="takPaYta"' + (st.takPaYta ? ' checked' : '') + '> Räkna tak och grund på ytan</label>';
      if (st.verktyg === 'valj' && st.vald) {
        var el = hitta(st.vald);
        if (el) h = '<div class="not">' + i('info') + '<span>Vald: ' + (el.typ === 'yta' ? 'golvyta' : el.recept === 'innervagg-70' ? 'innervägg' : 'yttervägg') + '. Enter bekräftar, Delete tar bort.</span></div>' +
          (el.typ === 'vagg' ? '<label class="falt"><span>Vägghöjd, m</span><input class="inmatning" type="number" step="0.05" min="2" max="5" value="' + el.hojd + '" data-elhojd></label>' : '');
      }
      var box = $('#inst', rot);
      box.innerHTML = h;
      $$('[data-inst]', box).forEach(function (inp) {
        inp.addEventListener('change', function () { var k = inp.getAttribute('data-inst'); st[k] = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value); });
      });
      $$('[data-opp]', box).forEach(function (b) { b.addEventListener('click', function () { st.oppTyp = b.getAttribute('data-opp'); if (st.oppTyp === 'dorr') { st.oppB = 1.0; st.oppH = 2.1; } else { st.oppB = 1.2; st.oppH = 1.2; } installningar(); }); });
      var eh = $('[data-elhojd]', box);
      if (eh) eh.addEventListener('change', function () { var el = hitta(st.vald); el.hojd = parseFloat(eh.value) || el.hojd; el.bekraftad = false; spara(); });
      $('#hint', rot).textContent = !r.skala && st.verktyg !== 'skala' && st.verktyg !== 'panorera' && st.verktyg !== 'valj' ? 'Sätt skalan först, annars blir måtten i pixlar.' : HINT[st.verktyg];
    }

    function hitta(id) { return r.element.filter(function (el) { return el.id === id; })[0]; }
    function nyId() { return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 100); }
    function spara() { BP.spara(); rita(); installningar(); }
    function taBort(id) {
      r.element = r.element.filter(function (el) { return el.id !== id; });
      if (st.vald === id) st.vald = null;
      BP.handelse(p, 'Tog bort ett avritat element');
      spara();
    }

    function satVerktyg(v) {
      st.verktyg = v; st.punkter = []; mus = null;
      duk.setAttribute('data-verktyg', v);
      $$('[data-verktyg]', rot).forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute('data-verktyg') === v)); });
      rita(); installningar();
    }

    function fragaSkala(a, b) {
      var px = Math.hypot(b[0] - a[0], b[1] - a[1]);
      BP.dialog({
        titel: 'Hur långt är det?',
        kropp: '<p>Du klickade två punkter ' + Math.round(px) + ' px isär på ritningen. Skriv det verkliga måttet.</p><label class="falt"><span>Mått i meter</span><input class="inmatning" type="number" step="0.01" min="0.1" id="skalamatt" value="7.5" style="width:160px"></label>',
        fot: '<button class="knapp" type="button" data-stang>Avbryt</button><button class="knapp knapp--primar" type="button" id="skalaok">Sätt skala</button>',
        efter: function (d) {
          var inp = $('#skalamatt', d); inp.select();
          var ok = function () {
            var m = parseFloat(String(inp.value).replace(',', '.'));
            if (!m || m <= 0) { inp.focus(); return; }
            r.skala = px / m; r.kalibrering = { a: a, b: b, m: m };
            BP.handelse(p, 'Satte skalan: ' + BP.tal(m) + ' m = ' + Math.round(px) + ' px');
            d.close(); BP.toast('Skalan är satt', BP.tal(r.skala, 1) + ' px per meter'); satVerktyg('yttervagg'); BP.spara();
            $('.duk__info', rot).innerHTML = '<span class="chip" style="background:#fff;border:1px solid var(--kant)">' + i('ritning') + e(r.namn) + '</span><span class="chip chip--gron">Skala satt · ' + BP.tal(r.skala, 1) + ' px/m</span>';
          };
          $('#skalaok', d).addEventListener('click', ok);
          inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ok(); } });
        }
      });
    }

    function narmasteVagg(q) {
      var bast = null;
      r.element.forEach(function (el) {
        if (el.typ !== 'vagg') return;
        var a = el.pts[0], b = el.pts[1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
        var t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2));
        var d = Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]);
        if (!bast || d < bast.d) bast = { el: el, t: t, d: d };
      });
      return bast && bast.d < Math.max(tjocklek(bast.el), 14 * pxPerSkarm()) ? bast : null;
    }

    function klick(ev) {
      var q = pkt(ev);
      var v = st.verktyg;
      if (v === 'valj') {
        var t = ev.target.closest('[data-el]');
        st.vald = t ? t.getAttribute('data-el') : null;
        rita(); installningar(); return;
      }
      if (v === 'skala') {
        var s1 = snapp(q, st.punkter[0], true).p;
        st.punkter.push(s1);
        if (st.punkter.length === 2) { var a = st.punkter[0], b = st.punkter[1]; st.punkter = []; mus = null; rita(); fragaSkala(a, b); }
        else rita();
        return;
      }
      if (v === 'yttervagg' || v === 'innervagg') {
        var sn = snapp(q, st.punkter[st.punkter.length - 1], ev.shiftKey).p;
        if (st.punkter.length) {
          var fran = st.punkter[st.punkter.length - 1];
          if (Math.hypot(sn[0] - fran[0], sn[1] - fran[1]) < 4 * pxPerSkarm()) { st.punkter = []; rita(); return; }
          var nytt = { id: nyId(), typ: 'vagg', recept: v === 'innervagg' ? 'innervagg-70' : 'yttervagg-170', hojd: st.hojd, pts: [fran, sn], oppningar: [], bekraftad: false };
          r.element.push(nytt);
          if (!lugnt()) st.ritas[nytt.id] = performance.now();
          st.punkter = [sn];
          BP.spara();
        } else st.punkter = [sn];
        rita(); return;
      }
      if (v === 'yta') {
        var sy = snapp(q, st.punkter[st.punkter.length - 1], ev.shiftKey).p;
        if (st.punkter.length > 2 && Math.hypot(sy[0] - st.punkter[0][0], sy[1] - st.punkter[0][1]) < 10 * pxPerSkarm()) { stangYta(); return; }
        st.punkter.push(sy); rita(); return;
      }
      if (v === 'oppning') {
        var w = narmasteVagg(q);
        if (!w) { BP.toast('Ingen vägg där', 'Klicka på en avritad vägg'); return; }
        w.el.oppningar = w.el.oppningar || [];
        w.el.oppningar.push({ typ: st.oppTyp, bredd: st.oppB, hojd: st.oppH, antal: 1, pos: w.t });
        w.el.bekraftad = false;
        BP.handelse(p, 'La till ' + (st.oppTyp === 'dorr' ? 'en dörr' : 'ett fönster') + ' ' + BP.tal(st.oppB * 10, 0) + '×' + BP.tal(st.oppH * 10, 0));
        spara();
      }
    }

    function stangYta() {
      if (st.punkter.length < 3) return;
      var yta = { id: nyId(), typ: 'yta', pts: st.punkter.slice(), tak: st.takPaYta ? 'pulpet' : null, grund: st.takPaYta, lutning: 2, bekraftad: false };
      r.element.push(yta);
      if (!lugnt()) st.ritas[yta.id] = performance.now();
      st.punkter = []; mus = null;
      BP.handelse(p, 'Ritade av en golvyta');
      spara();
    }

    svg.addEventListener('pointermove', function (ev) {
      if (drag) {
        var ctm = svg.getScreenCTM();
        vb.x = drag.vx - (ev.clientX - drag.x) / ctm.a; vb.y = drag.vy - (ev.clientY - drag.y) / ctm.d;
        satVb(); return;
      }
      if (st.verktyg === 'valj' || st.verktyg === 'panorera') return;
      var s = snapp(pkt(ev), st.punkter[st.punkter.length - 1], ev.shiftKey || st.verktyg === 'skala');
      mus = s; rita();
    });
    svg.addEventListener('pointerdown', function (ev) {
      if (st.verktyg === 'panorera' || ev.button === 1) { drag = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; svg.setPointerCapture(ev.pointerId); duk.style.cursor = 'grabbing'; return; }
      if (ev.button !== 0) return;
      klick(ev);
    });
    svg.addEventListener('pointerup', function () { drag = null; duk.style.cursor = ''; });
    svg.addEventListener('dblclick', function () { if (st.verktyg === 'yta') stangYta(); else { st.punkter = []; rita(); } });
    svg.addEventListener('pointerleave', function () { mus = null; if (st.punkter.length) rita(); });
    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      zooma(ev.deltaY < 0 ? 1.15 : 1 / 1.15, pkt(ev));
    }, { passive: false });

    function zooma(f, kring) {
      if (!f) { vb.x = -20; vb.y = -20; vb.w = r.bredd + 40; vb.h = r.hojd + 40; satVb(); rita(); return; }
      kring = kring || [vb.x + vb.w / 2, vb.y + vb.h / 2];
      var nw = Math.max(80, Math.min(r.bredd * 4, vb.w / f)), nh = vb.h * nw / vb.w;
      vb.x = kring[0] - (kring[0] - vb.x) * nw / vb.w; vb.y = kring[1] - (kring[1] - vb.y) * nh / vb.h;
      vb.w = nw; vb.h = nh; satVb(); rita();
    }

    $$('[data-zoom]', rot).forEach(function (b) { b.addEventListener('click', function () { zooma(parseFloat(b.getAttribute('data-zoom'))); }); });
    $$('.verktyg [data-verktyg]', rot).forEach(function (b) { b.addEventListener('click', function () { satVerktyg(b.getAttribute('data-verktyg')); svg.focus({ preventScroll: true }); }); });

    // Tangentbordet: bara när ingen skriver i ett fält. Inga animationer på genvägar.
    function tangent(ev) {
      if (!document.body.contains(svg)) { document.removeEventListener('keydown', tangent); return; }
      if ((ev.target.closest && ev.target.closest('input, textarea, select, dialog')) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var k = ev.key.toLowerCase();
      var map = { v: 'valj', s: 'skala', y: 'yttervagg', i: 'innervagg', g: 'yta', o: 'oppning', h: 'panorera' };
      if (map[k]) { ev.preventDefault(); satVerktyg(map[k]); return; }
      if (k === 'escape') { st.punkter = []; mus = null; rita(); return; }
      if (k === 'enter') {
        if (st.verktyg === 'yta' && st.punkter.length > 2) { stangYta(); return; }
        if (st.vald) { var el = hitta(st.vald); if (el) { el.bekraftad = true; BP.handelse(p, 'Bekräftade ett avritat element'); spara(); } }
        return;
      }
      if ((k === 'delete' || k === 'backspace') && st.vald) { ev.preventDefault(); taBort(st.vald); return; }
      if (k === '+' || k === '=') zooma(1.25);
      if (k === '-') zooma(0.8);
      if (k === '0') zooma(0);
    }
    document.addEventListener('keydown', tangent);

    satVb(); rita(); installningar();
  }
})();
