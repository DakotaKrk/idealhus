/* ============================================================
   Idealhus CRM – kundmötet (prototyp, 2026-10-01)
   Helskärmspresentation som i Uperformance: bilderna vrids in i
   3D, husen visas som riktiga 3D-modeller (model-viewer, samma
   filer som huskortet) och kalkylen räknar live med prislistan.
   Startas med IH.Mote.starta({ affar, bilder, start }).
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e;

  // bild: miniatyren i förberedelsen (hela huset, aldrig beskuret).
  IH.MOTE_BILDER = [
    { id: 'titel', namn: 'Välkommen', bild: '../images/hus-r1.webp' },
    { id: 'er', namn: 'Er förfrågan', bild: '../images/hus-r3.webp', kraver: 'forfragan' },
    { id: 'hantverk', namn: 'Byggt under tak', bild: '../images/hero-video-poster.webp' },
    { id: 'husen', namn: 'Husen i 3D', bild: '../images/hus-r5.webp' },
    { id: 'regler', namn: 'Vad får ni bygga?', bild: '../images/hus-r4.webp' },
    { id: 'resan', namn: 'Så går det till', bild: '../images/hus-r2.webp' },
    { id: 'kalkyl', namn: 'Räkna på ert hus', bild: '../images/hus-r3.webp' },
    { id: 'nasta', namn: 'Nästa steg', bild: '../images/hus-r1.webp' }
  ];

  // [steg, text, vem] – vem gör vad enligt stegens egna texter.
  var RESAN = [
    ['Första samtalet', 'Ni berättar om tomten och hur huset ska användas.', 'tillsammans'],
    ['Modell och anpassning', 'Vi går igenom modellerna och skriver offerten.', 'vi'],
    ['Bygglov eller anmälan', 'Vi tar fram underlaget, ni lämnar in till kommunen.', 'tillsammans'],
    ['Tillverkning', 'Huset byggs under tak i Sverige, i jämn temperatur.', 'vi'],
    ['Grund och mark', 'Grunden gjuts och el, vatten och avlopp dras fram.', 'ni'],
    ['Leverans och montage', 'Huset kommer på lastbil och monteras på dagar.', 'vi'],
    ['Slutbesiktning', 'Vi går igenom huset tillsammans, rum för rum.', 'tillsammans']
  ];
  var VEM = { vi: ['hus', 'Idealhus'], ni: ['plats', 'Ni'], tillsammans: ['kunder', 'Tillsammans'] };

  // Hussiluetten på regelbilden: fasad i skala (53 px per meter,
  // marken på y 300). Nockhöjd 4,0 m inom och 4,5 m utanför detaljplan.
  var SIL = {
    inom: { hus: 'M110 300 V170 L260 88 L410 170 V300 Z', matt: 'M492 300 V88', niva: 'M260 88 H492', y: 88 },
    utanfor: { hus: 'M72 300 V170 L260 62 L448 170 V300 Z', matt: 'M492 300 V62', niva: 'M260 62 H492', y: 62 }
  };
  function husSilhuett() {
    var a = SIL.inom;
    return '<svg viewBox="0 0 540 350">' +
      '<defs><linearGradient id="sil-fasad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b56e" stop-opacity=".28"/><stop offset="1" stop-color="#f0b56e" stop-opacity=".06"/></linearGradient>' +
      '<pattern id="sil-panel" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0 V12" stroke="rgba(247,245,240,.07)" stroke-width="1"/></pattern></defs>' +
      '<path class="hussil__mark" d="M20 300 H520"/>' +
      '<path class="hussil__spok" d="' + a.hus + '"/>' +
      '<path class="hussil__hus" d="' + a.hus + '" pathLength="1"/>' +
      '<path class="hussil__panel" d="' + a.hus + '"/>' +
      '<rect class="hussil__fonster" x="160" y="206" width="44" height="52" rx="4"/><rect class="hussil__fonster" x="316" y="206" width="44" height="52" rx="4"/>' +
      '<rect class="hussil__dorr" x="243" y="232" width="34" height="68" rx="3"/>' +
      '<path class="hussil__niva" d="' + a.niva + '"/>' +
      '<path class="hussil__matt" d="' + a.matt + '"/>' +
      '<g class="hussil__lapp"><rect x="428" y="-34" width="56" height="26" rx="13"/><text x="456" y="-16" text-anchor="middle" data-silhojd>4,0 m</text></g>' +
      '<text class="hussil__bredd" x="260" y="330" text-anchor="middle"><tspan data-silyta>30</tspan> m² per byggnad</text>' +
      '</svg>';
  }

  var TILLVAL = ['ritning', 'altan', 'kok', 'kamin', 'kran'];

  var s = null; // mötets tillstånd

  function bildHtml(id) {
    var k = s.kund, m = IH.modell(s.modell);
    var forn = k ? String(k.namn).split(' ')[0] : '';
    switch (id) {
      case 'titel':
        return '<div class="mb mb--titel"><div class="mb__in mb__in--delad"><div>' +
          '<p class="mb__etikett" data-m-in>Idealhus' + (k ? ' · för ' + e(k.namn) : '') + '</p>' +
          '<h1 class="mb__titel" data-m-in>' + (forn && s.kund.typ !== 'foretag' ? 'Välkommen,<br><em>' + e(forn) + '.</em>' : 'Hus formade<br><em>för platsen.</em>') + '</h1>' +
          '<p class="mb__text" data-m-in>Attefallshus och fritidshus, byggda under tak i Sverige och monterade på tomten på några dagar.</p></div>' +
          '<figure class="mb__foto" data-m-in><img src="' + (m && m.glb ? m.bild : '../images/hus-r1.webp') + '" alt=""></figure></div></div>';
      case 'er':
        var f = s.forfragan;
        if (!f) return '';
        var fm = s.forslag;
        var typ = /^(Attefallshus|Fritidshus)$/.test(f.hustyp) ? f.hustyp.toLowerCase() : 'hus';
        return '<div class="mb mb--er"><div class="mb__in mb__in--delad"><div>' +
          '<p class="mb__etikett" data-m-in>Er förfrågan · ' + e(IH.datum(f.skapad)) + '</p>' +
          '<h2 class="mb__titel mb__titel--mindre" data-m-in>Ert ' + e(typ) + ',<br><em>' + e(String(f.miljo || 'på er tomt').toLowerCase()) + '.</em></h2>' +
          '<blockquote class="er__citat" data-m-in><p>' + e(f.beskrivning) + '</p><cite>' + e(f.namn) + ' · ' + e(f.ort) + '</cite></blockquote>' +
          '<dl class="er__svar" data-m-in>' + [['Användning', f.anvandning], ['Ort', f.ort], ['Kom via', f.kalla]].map(function (x) {
            return '<div><dt>' + x[0] + '</dt><dd>' + e(x[1]) + '</dd></div>';
          }).join('') + '</dl></div>' +
          '<div class="er__bild" data-m-in><figure class="mb__foto"><img src="' + (IH.MILJO[f.miljo] || '../images/hus-r2.webp') + '" alt=""></figure>' +
          (fm ? '<div class="er__forslag"><img src="' + fm.m.tumme + '" alt=""><span><small>' + IH.i('stjarna') + 'Vårt förslag</small><b>' + e(fm.m.namn) + (fm.m.yta ? ' · ' + fm.m.yta + ' m²' : '') + '</b><em>' + e(fm.varfor) + '</em></span></div>' : '') +
          '</div></div></div>';
      case 'hantverk':
        return '<div class="mb mb--hantverk"><video class="mb__bak" muted loop playsinline preload="metadata" poster="../images/hero-video-poster.webp">' +
          '<source src="../images/video/hero-video-720.mp4" type="video/mp4" media="(max-width: 900px)"><source src="../images/video/hero-video-1080.mp4" type="video/mp4"></video>' +
          '<div class="mb__slojan mb__slojan--vanster"></div><div class="mb__in">' +
          '<p class="mb__etikett" data-m-in>Hantverket</p>' +
          '<h2 class="mb__titel" data-m-in>Byggt under tak.<br><em>Monterat på dagar.</em></h2>' +
          '<p class="mb__text" data-m-in>Väggar, golv och tak byggs inomhus i jämn temperatur och fuktnivå. På tomten återstår att lyfta, koppla samman och täta.</p>' +
          '<div class="mb__chips" data-m-in><span>Svensk tillverkning</span><span>En kontakt hela vägen</span><span>Offert post för post</span></div></div></div>';
      case 'husen':
        return '<div class="mb mb--husen"><div class="mb__in mb__in--delad">' +
          '<div class="husval"><p class="mb__etikett" data-m-in>Husen i 3D</p><h2 class="mb__titel mb__titel--mindre" data-m-in>Fem hus.<br><em>Ett formspråk.</em></h2>' +
          '<div class="husval__lista" data-m-in>' + IH.MODELLER.filter(function (x) { return x.glb; }).map(function (x) {
            return '<button type="button" class="husval__kort' + (x.id === (m && m.glb ? m.id : 'r1') ? ' vald' : '') + '" data-m="' + x.id + '"><img src="' + x.tumme + '" alt=""><span><b>' + e(x.namn) + '</b><small>' + e(x.kategori) + ' · ' + x.yta + ' m²</small></span></button>';
          }).join('') + '</div></div>' +
          '<div class="husvisning" data-m-in><div class="husvisning__golv"></div><div class="husvisning__mv" data-mv></div>' +
          '<div class="husvisning__fakta" data-husfakta></div><p class="husvisning__tips">Dra för att vrida huset</p></div></div></div>';
      case 'regler':
        return '<div class="mb mb--regler"><div class="mb__in mb__in--delad"><div>' +
          '<p class="mb__etikett" data-m-in>Reglerna sedan 1 december 2025</p>' +
          '<h2 class="mb__titel mb__titel--mindre" data-m-in>Vad får ni<br><em>bygga?</em></h2>' +
          '<div class="regelvaxel" data-m-in role="group" aria-label="Var ligger tomten?"><span class="regelvaxel__pill"></span>' +
          '<button type="button" data-plan="inom" aria-pressed="true">Inom detaljplan</button><button type="button" data-plan="utanfor" aria-pressed="false">Utanför detaljplan</button></div>' +
          '<div class="regeltal" data-m-in data-plan="inom">' +
          [['Per byggnad', 30, 50, 'm²', 65], ['Sammanlagt på tomten', 45, 65, 'm²', 65], ['Nockhöjd', 4.0, 4.5, 'm', 4.5]].map(function (r) {
            return '<div class="regeltal__ruta" style="--a:' + (r[1] / r[4]).toFixed(3) + ';--b:' + (r[2] / r[4]).toFixed(3) + '"><small>' + r[0] + '</small>' +
              '<b data-inom="' + r[1] + '" data-utanfor="' + r[2] + '">' + String(r[1]).replace('.', ',') + (r[3] === 'm' && r[1] % 1 === 0 ? ',0' : '') + '</b><span>' + r[3] + '</span><i><em></em></i></div>';
          }).join('') + '</div>' +
          '</div><div class="regelbild"><figure class="hussil" data-m-in data-plan="inom" aria-hidden="true">' + husSilhuett() + '</figure>' +
          '<p class="mb__text mb__text--liten" data-m-in>Varken bygglov eller anmälan för själva byggnaden. Kök, badrum och eldstad anmäls ändå – för installationerna. Minst 4,5 m till tomtgräns utan grannens medgivande.</p></div></div></div>';
      case 'resan':
        return '<div class="mb mb--resan"><div class="mb__in">' +
          '<div class="resa__topp"><div><p class="mb__etikett" data-m-in>Så går det till</p><h2 class="mb__titel mb__titel--mindre" data-m-in>Sju steg.<br><em>En kontakt.</em></h2></div>' +
          '<ul class="resa__vem" data-m-in>' + ['vi', 'ni', 'tillsammans'].map(function (v) {
            return '<li class="vem vem--' + v + '">' + IH.i(VEM[v][0]) + VEM[v][1] + '</li>';
          }).join('') + '</ul></div>' +
          '<ol class="resa7">' + RESAN.map(function (r, n) {
            return '<li class="resa7__steg" style="--n:' + n + '" data-m-in><span class="resa7__nr">' + (n + 1) + '</span><b>' + e(r[0]) + '</b><p>' + e(r[1]) + '</p>' +
              '<span class="vem vem--' + r[2] + '">' + IH.i(VEM[r[2]][0]) + VEM[r[2]][1] + '</span></li>';
          }).join('') + '</ol></div></div>';
      case 'kalkyl':
        return '<div class="mb mb--kalkyl"><div class="mb__in mb__in--delad">' +
          '<div class="kalkyl__val"><p class="mb__etikett" data-m-in>Räkna på ert hus</p><h2 class="mb__titel mb__titel--mindre" data-m-in>Ert hus,<br><em>post för post.</em></h2>' +
          '<div class="kalkyl__modeller" data-m-in>' + IH.MODELLER.filter(function (x) { return x.id !== 'element'; }).map(function (x) {
            return '<button type="button" class="kalkyl__modell' + (x.id === s.kalkyl.modell ? ' vald' : '') + '" data-km="' + x.id + '"><img src="' + x.tumme + '" alt=""><b>' + e(x.namn) + '</b><small>' + x.yta + ' m²</small></button>';
          }).join('') + '</div>' +
          '<div class="kalkyl__tillval" data-m-in>' + IH.db.prislista.poster.filter(function (p) { return TILLVAL.indexOf(p.id) >= 0; }).map(function (p) {
            return '<button type="button" class="kalkyl__chip' + (s.kalkyl.tillval[p.id] ? ' vald' : '') + '" data-kt="' + p.id + '" aria-pressed="' + !!s.kalkyl.tillval[p.id] + '">' + IH.i('bock') + e(p.text) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="kalkyl__kvitto" data-m-in><div class="kvitto" data-kvitto></div></div></div></div>';
      case 'nasta':
        return '<div class="mb mb--nasta"><div class="mb__in">' +
          '<p class="mb__etikett" data-m-in>Nästa steg</p><h2 class="mb__titel" data-m-in>Vi börjar<br><em>med platsen.</em></h2>' +
          '<ol class="nasta3">' + [['Platsbesök', 'Vi tittar på tomten, marken och vägen fram.'], ['Offert', 'Post för post – vad som ingår och vad som tillkommer.'], ['Beslut', 'Ni bestämmer i lugn och ro. Sedan planerar vi tillverkningen.']].map(function (x, n) {
            return '<li data-m-in><span>0' + (n + 1) + '</span><b>' + x[0] + '</b><p>' + x[1] + '</p></li>';
          }).join('') + '</ol><div class="nasta__knappar" data-m-in>' +
          (s.affar ? '<button class="knapp knapp--virke knapp--stor" type="button" data-mote="boka">' + IH.i('kalender') + 'Boka platsbesök</button>' : '') +
          (s.kund && s.kund.epost ? '<button class="knapp knapp--glas knapp--stor" type="button" data-mote="sammanfattning">' + IH.i('post') + 'Mejla en sammanfattning</button>' : '') +
          '</div><p class="mb__kontakt" data-m-in>info@idealhus.se · Stockholm, Sverige</p></div></div>';
    }
    return '';
  }

  // Rubrikernas rader stiger ur en mask; övrigt innehåll får sin plats
  // i kön (--mi) så att det lutar in i läsordning.
  function forbered(bild) {
    bild.querySelectorAll('.mb__titel').forEach(function (h) {
      h.innerHTML = h.innerHTML.split(/<br\s*\/?>/i).map(function (rad, n) {
        return '<span class="mrad"><span style="--r:' + n + '">' + rad + '</span></span>';
      }).join('');
      h.removeAttribute('data-m-in');
    });
    bild.querySelectorAll('[data-m-in]').forEach(function (el, n) { el.style.setProperty('--mi', n); });
  }

  /* --- Kalkylen ------------------------------------------------------ */
  function kalkylRader() {
    var pl = IH.db.prislista;
    var m = IH.modell(s.kalkyl.modell);
    var rader = [{ text: m.kategori + ' ' + m.namn + ', ' + m.yta + ' m²', antal: 1, pris: pl.modeller[m.id] || 0 }];
    pl.poster.forEach(function (p) {
      if (p.id === 'frakt' || p.id === 'montage' || s.kalkyl.tillval[p.id]) rader.push({ text: p.text, antal: 1, pris: p.pris });
    });
    return rader;
  }
  function ritaKvitto(animera) {
    var yta = s.el.querySelector('[data-kvitto]');
    if (!yta) return;
    var rader = kalkylRader();
    var sum = rader.reduce(function (t, r) { return t + r.pris * r.antal; }, 0);
    var m = IH.modell(s.kalkyl.modell);
    yta.innerHTML = '<div class="kvitto__huvud"><span class="kvitto__bild"><img src="' + m.bild + '" alt=""></span>' +
      '<span><small>' + e(m.kategori) + '</small><b>' + e(m.namn) + '</b><em>' + m.yta + ' m² · ' + m.rum + ' rum · ' + e(m.matt) + '</em></span></div>' +
      '<ul class="kvitto__rader">' + rader.map(function (r, n) {
        return '<li style="--n:' + n + '"><span>' + e(r.text) + '</span><b class="tal">' + IH.kr(r.pris) + '</b></li>';
      }).join('') + '</ul>' +
      '<div class="kvitto__summa"><span>Totalt</span><b class="tal" data-kvittosumma>' + IH.kr(s.forraSumma || sum) + '</b></div>' +
      '<p class="kvitto__not">Exempelpriser i prototypen. Grund, bygglov och anslutningar tillkommer.</p>' +
      '<div class="kvitto__knappar">' + (s.affar
        ? '<button class="knapp knapp--virke" type="button" data-mote="spara">' + IH.i('offert') + 'Spara som offert</button>'
        : '<span class="kvitto__tips">' + IH.i('varning') + 'Välj en affär när mötet startar för att spara som offert.</span>') + '</div>';
    var el = yta.querySelector('[data-kvittosumma]');
    var fran = s.forraSumma || sum;
    s.forraSumma = sum;
    if (animera && !IH.lugn && fran !== sum) {
      var start = performance.now();
      (function steg(nu) {
        var t = Math.min(1, (nu - start) / 700);
        el.textContent = IH.kr(fran + (sum - fran) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(steg);
      })(start);
      el.classList.remove('blink');
      void el.offsetWidth;
      el.classList.add('blink');
    } else el.textContent = IH.kr(sum);
  }

  /* --- Husen i 3D ------------------------------------------------------ */
  function visaHus(id) {
    var m = IH.modell(id);
    var mv = s.el.querySelector('[data-mv]');
    var fakta = s.el.querySelector('[data-husfakta]');
    if (!mv || !m) return;
    s.husId = id;
    s.el.querySelectorAll('.husval__kort').forEach(function (b) { b.classList.toggle('vald', b.getAttribute('data-m') === id); });
    mv.classList.remove('in');
    setTimeout(function () {
      mv.innerHTML = '<model-viewer src="' + m.glb + '" alt="' + e(m.namn) + ' i 3D" camera-controls auto-rotate auto-rotate-delay="0" rotation-per-second="14deg" ' +
        'camera-orbit="32deg 74deg auto" interaction-prompt="none" shadow-intensity="1.1" shadow-softness="0.9" exposure="1.38" environment-image="neutral" tone-mapping="neutral" disable-zoom></model-viewer>';
      mv.classList.add('in');
    }, IH.lugn ? 0 : 220);
    fakta.innerHTML = '<small>' + e(m.kategori) + '</small><b>' + e(m.namn) + '</b><div class="husvisning__tal"><span><em>' + m.yta + '</em> m²</span><span><em>' + m.rum + '</em> rum</span><span><em>' + e(m.matt) + '</em></span></div>' +
      '<p>' + e(m.text) + '</p>';
    fakta.classList.remove('in');
    void fakta.offsetWidth;
    fakta.classList.add('in');
  }

  /* --- Navigering -------------------------------------------------------- */
  function ga(n, riktning) {
    if (n < 0 || n >= s.bilder.length || n === s.nu) return;
    var gammal = s.el.querySelector('.mote__bild.nu');
    var ny = s.el.querySelector('.mote__bild[data-n="' + n + '"]');
    var fram = riktning != null ? riktning > 0 : n > s.nu;
    if (gammal) {
      gammal.classList.remove('nu');
      gammal.classList.add(fram ? 'ut-v' : 'ut-h');
      var g = gammal;
      setTimeout(function () { g.classList.remove('ut-v', 'ut-h'); }, 900);
      var v = gammal.querySelector('video');
      if (v) v.pause();
    }
    ny.classList.remove('ut-v', 'ut-h');
    ny.classList.add(fram ? 'in-h' : 'in-v');
    void ny.offsetWidth;
    ny.classList.remove('in-h', 'in-v');
    ny.classList.add('nu');
    s.nu = n;
    var id = s.bilder[n];
    var video = ny.querySelector('video');
    if (video && !IH.lugn) { video.playbackRate = 0.7; var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    if (id === 'husen' && !s.husId) { IH.laddaModelViewer(); visaHus(s.modell && IH.modell(s.modell).glb ? s.modell : 'r1'); }
    if (id === 'kalkyl') ritaKvitto(false);
    if (id === 'regler') setTimeout(function () { placeraPill(); }, 60);
    // Botten: namn, prickar och räknare.
    s.el.querySelector('[data-mnamn]').textContent = IH.MOTE_BILDER.filter(function (b) { return b.id === id; })[0].namn;
    s.el.querySelector('[data-mraknare]').textContent = (n + 1) + ' / ' + s.bilder.length;
    s.el.querySelectorAll('.mote__prick').forEach(function (p, k) { p.classList.toggle('nu', k === n); p.setAttribute('aria-current', k === n ? 'step' : 'false'); });
    s.el.querySelector('[data-mote="bak"]').disabled = n === 0;
    s.el.querySelector('[data-mote="fram"]').disabled = n === s.bilder.length - 1;
    s.el.querySelector('.mote__framsteg i').style.transform = 'scaleX(' + ((n + 1) / s.bilder.length).toFixed(3) + ')';
  }

  function placeraPill() {
    var v = s.el.querySelector('.regelvaxel');
    if (!v) return;
    var b = v.querySelector('[aria-pressed="true"]');
    var pill = v.querySelector('.regelvaxel__pill');
    pill.style.width = b.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }

  function sattPlan(plan) {
    var v = s.el.querySelector('.regelvaxel');
    v.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-plan') === plan)); });
    placeraPill();
    var t = s.el.querySelector('.regeltal');
    t.setAttribute('data-plan', plan);
    var sil = s.el.querySelector('.hussil');
    if (sil) {
      sil.setAttribute('data-plan', plan);
      var d = SIL[plan];
      // Attributen också, för webbläsare utan CSS-egenskapen d.
      sil.querySelector('.hussil__hus').setAttribute('d', d.hus);
      sil.querySelector('.hussil__panel').setAttribute('d', d.hus);
      sil.querySelector('.hussil__matt').setAttribute('d', d.matt);
      sil.querySelector('.hussil__niva').setAttribute('d', d.niva);
      sil.querySelector('[data-silhojd]').textContent = plan === 'inom' ? '4,0 m' : '4,5 m';
      sil.querySelector('[data-silyta]').textContent = plan === 'inom' ? '30' : '50';
    }
    t.querySelectorAll('b[data-inom]').forEach(function (b) {
      var fran = parseFloat(b.textContent.replace(',', '.'));
      var till = Number(b.getAttribute('data-' + plan));
      var dec = String(b.getAttribute('data-inom')).indexOf('.') >= 0 || till % 1 ? 1 : 0;
      if (b.parentNode.querySelector('span').textContent === 'm') dec = 1;
      var start = performance.now();
      (function steg(nu) {
        var k = IH.lugn ? 1 : Math.min(1, (nu - start) / 800);
        var v2 = fran + (till - fran) * (1 - Math.pow(1 - k, 3));
        b.textContent = dec ? v2.toFixed(1).replace('.', ',') : Math.round(v2);
        if (k < 1) requestAnimationFrame(steg);
      })(start);
    });
  }

  function minuter() { return Math.max(1, Math.round((Date.now() - s.start) / 60000)); }

  function stang() {
    if (!s) return;
    var el = s.el;
    clearInterval(s.klocka);
    var not = el.querySelector('[data-manteckning]');
    if (not && not.value.trim() && s.kund) {
      IH.logga('mote', 'Kundmöte (' + minuter() + ' min): ' + not.value.trim(), s.kund.id, s.affar ? s.affar.id : null);
      IH.spara();
      IH.toast('Anteckningen är sparad', 'I historiken för ' + s.kund.namn, 'anteckning');
      if (IH.ritaOm) IH.ritaOm();
    }
    document.removeEventListener('keydown', s.tangent);
    el.classList.add('stanger');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    setTimeout(function () { el.remove(); }, IH.lugn ? 0 : 520);
    document.documentElement.style.overflow = '';
    s = null;
  }

  function anteckna(visa) {
    var a = s.el.querySelector('.mote__anteckning');
    var knapp = s.el.querySelector('[data-mote="anteckna"]');
    var pa = visa != null ? visa : !a.classList.contains('oppen');
    a.classList.toggle('oppen', pa);
    s.el.classList.toggle('mote--anteckning', pa);
    knapp.setAttribute('aria-pressed', String(pa));
    if (pa) setTimeout(function () { a.querySelector('textarea').focus(); }, 300);
    else knapp.focus();
  }

  // Platsbesöket: en uppgift om en vecka och affären flyttas till besök.
  function bokaBesok(b) {
    var a = s.affar, k = s.kund;
    var d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0);
    IH.db.uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: 'Platsbesök hos ' + (k ? k.namn : a.titel), forfaller: d.toISOString(), klar: false,
      kund: a.kund, affar: a.id, ansvarig: IH.jag().id });
    var ord = IH.SALJSTEG.map(function (x) { return x.id; });
    if (ord.indexOf(a.steg) < ord.indexOf('besok')) { a.steg = 'besok'; a.andrad = new Date().toISOString(); }
    IH.logga('mote', 'Platsbesök bokat i kundmötet, vecka ' + IH.vecka(d) + '.', a.kund, a.id);
    IH.spara();
    var r = b.getBoundingClientRect();
    IH.konfetti(r.left + r.width / 2, r.top);
    b.innerHTML = IH.i('bock') + 'Bokat · vecka ' + IH.vecka(d);
    b.disabled = true;
    IH.toast('Platsbesöket är bokat', 'Uppgift ' + IH.datum(d.toISOString()) + ' · affären ligger nu i besök', 'kalender');
  }

  // Öppnar e-postprogrammet med en kort sammanfattning (mailto).
  function sammanfattning() {
    var k = s.kund;
    if (!k || !k.epost) return;
    var rader = ['Hej ' + String(k.namn).split(' ')[0] + ',', '', 'Tack för mötet i dag. Här är en kort sammanfattning.', ''];
    if (s.forraSumma) {
      var m = IH.modell(s.kalkyl.modell);
      rader.push('Huset vi räknade på: ' + m.kategori + ' ' + m.namn + ', ' + m.yta + ' m²');
      kalkylRader().forEach(function (r) { rader.push('– ' + r.text + ': ' + IH.kr(r.pris)); });
      rader.push('Totalt: ' + IH.kr(s.forraSumma), 'Grund, bygglov och anslutningar tillkommer.', '');
    }
    rader.push('Nästa steg är ett platsbesök där vi tittar på tomten, marken och vägen fram.', '', 'Vänliga hälsningar', IH.jag().namn, 'Idealhus · info@idealhus.se');
    window.location.href = 'mailto:' + encodeURIComponent(k.epost) + '?subject=' + encodeURIComponent('Sammanfattning av vårt möte') + '&body=' + encodeURIComponent(rader.join('\n'));
  }

  IH.Mote = {
    starta: function (opt) {
      opt = opt || {};
      var affar = opt.affar ? IH.affar(opt.affar) : null;
      var kund = affar ? IH.kund(affar.kund) : null;
      // Förfrågan bakom affären (eller kundens senaste) ger bilden "Er förfrågan".
      var forfragan = affar ? (IH.db.forfragningar.filter(function (f) { return f.affar === affar.id; })[0] ||
        IH.db.forfragningar.filter(function (f) { return f.kund === affar.kund; })[0] || null) : null;
      var forslag = null;
      if (forfragan) {
        forslag = IH.foreslaModell ? IH.foreslaModell(forfragan, kund) : null;
        var am = affar.modell ? IH.modell(affar.modell) : null;
        if (am && (!forslag || forslag.m.id !== am.id)) forslag = { m: am, varfor: am.text };
      }
      var bilder = (opt.bilder && opt.bilder.length ? opt.bilder : IH.MOTE_BILDER.map(function (b) { return b.id; }))
        .filter(function (id) { return id !== 'er' || forfragan; });
      s = {
        affar: affar, kund: kund, modell: affar ? affar.modell : 'r1', forfragan: forfragan, forslag: forslag,
        bilder: bilder, nu: -1, husId: null, forraSumma: 0, start: Date.now(),
        kalkyl: { modell: affar && affar.modell !== 'element' ? affar.modell : 'r1', tillval: {} }
      };
      var el = document.createElement('div');
      el.className = 'mote';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Kundmöte');
      el.innerHTML = '<div class="mote__scen">' + bilder.map(function (id, n) {
        return '<section class="mote__bild" data-n="' + n + '" data-id="' + id + '">' + bildHtml(id) + '</section>';
      }).join('') + '</div>' +
        '<header class="mote__topp"><img src="../images/idealhus_logo.svg" alt="Idealhus">' + (s.kund ? '<span class="mote__kund">' + e(s.kund.namn) + '</span>' : '') +
        '<span class="mote__tid" title="Mötets längd">' + IH.i('klocka') + '<b data-mtid>0:00</b></span>' +
        '<button class="mote__ikon" type="button" data-mote="anteckna" aria-label="Anteckningar (N)" aria-pressed="false">' + IH.i('anteckning') + '</button>' +
        '<button class="mote__ikon" type="button" data-mote="helskarm" aria-label="Helskärm">' + IH.i('helskarm') + '</button>' +
        '<button class="mote__ikon" type="button" data-mote="stang" aria-label="Avsluta mötet">' + IH.i('stang') + '</button></header>' +
        '<footer class="mote__botten"><span class="mote__namn" data-mnamn></span>' +
        '<div class="mote__prickar">' + bilder.map(function (id, n) {
          var b = IH.MOTE_BILDER.filter(function (x) { return x.id === id; })[0];
          return '<button class="mote__prick" type="button" data-mote="till" data-n="' + n + '" aria-label="' + e(b.namn) + '"><i></i></button>';
        }).join('') + '</div><span class="mote__raknare" data-mraknare></span>' +
        '<button class="mote__pil" type="button" data-mote="bak" aria-label="Föregående">' + IH.i('pilv') + '</button>' +
        '<button class="mote__pil mote__pil--fram" type="button" data-mote="fram" aria-label="Nästa">' + IH.i('pil') + '</button>' +
        '<span class="mote__framsteg"><i></i></span></footer>' +
        '<aside class="mote__anteckning" aria-label="Anteckningar"><header><b>' + IH.i('anteckning') + 'Anteckningar</b>' +
        '<small>' + (s.kund ? 'Sparas i historiken för ' + e(s.kund.namn) + ' när mötet avslutas.' : 'Starta mötet från en affär för att spara anteckningen.') + '</small></header>' +
        '<textarea data-manteckning placeholder="Tomten, tidplanen, önskemål, frågor att återkomma om …"></textarea>' +
        '<p class="mote__anteckning-tips">Tryck N för att visa eller dölja</p></aside>';
      document.body.appendChild(el);
      el.querySelectorAll('.mote__bild').forEach(forbered);
      var tid = el.querySelector('[data-mtid]');
      s.klocka = setInterval(function () {
        if (!s) return;
        var sek = Math.floor((Date.now() - s.start) / 1000);
        tid.textContent = Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
      }, 1000);
      s.el = el;
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(function () { el.classList.add('oppen'); });
      if (!IH.lugn && el.requestFullscreen && opt.helskarm !== false) el.requestFullscreen().catch(function () {});

      el.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-mote],[data-m],[data-km],[data-kt],[data-plan]');
        if (!b) return;
        if (b.hasAttribute('data-m')) { visaHus(b.getAttribute('data-m')); return; }
        if (b.hasAttribute('data-km')) {
          s.kalkyl.modell = b.getAttribute('data-km');
          el.querySelectorAll('.kalkyl__modell').forEach(function (x) { x.classList.toggle('vald', x === b); });
          ritaKvitto(true);
          return;
        }
        if (b.hasAttribute('data-kt')) {
          var id = b.getAttribute('data-kt');
          s.kalkyl.tillval[id] = !s.kalkyl.tillval[id];
          b.classList.toggle('vald', s.kalkyl.tillval[id]);
          b.setAttribute('aria-pressed', String(!!s.kalkyl.tillval[id]));
          ritaKvitto(true);
          return;
        }
        if (b.hasAttribute('data-plan')) { sattPlan(b.getAttribute('data-plan')); return; }
        var g = b.getAttribute('data-mote');
        if (g === 'stang') stang();
        else if (g === 'fram') ga(s.nu + 1);
        else if (g === 'bak') ga(s.nu - 1);
        else if (g === 'till') ga(Number(b.getAttribute('data-n')));
        else if (g === 'anteckna') anteckna();
        else if (g === 'boka' && s.affar) bokaBesok(b);
        else if (g === 'sammanfattning') sammanfattning();
        else if (g === 'helskarm') {
          if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
          else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
        } else if (g === 'spara' && s.affar) {
          var o = IH.nyOffert(s.affar, kalkylRader());
          s.affar.varde = IH.summaOffert(o);
          s.affar.modell = s.kalkyl.modell;
          s.affar.andrad = new Date().toISOString();
          IH.spara();
          var r = b.getBoundingClientRect();
          IH.konfetti(r.left + r.width / 2, r.top);
          b.innerHTML = IH.i('bock') + 'Sparad som ' + e(o.nummer);
          b.disabled = true;
          IH.toast('Offerten är sparad', o.nummer + ' · ' + IH.kr(IH.summaOffert(o)), 'offert');
        }
      });

      s.tangent = function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('textarea, input')) {
          if (ev.key === 'Escape') { ev.preventDefault(); anteckna(false); }
          return;
        }
        if (ev.key === 'n' || ev.key === 'N') { anteckna(); return; }
        if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); ga(s.nu + 1); }
        else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); ga(s.nu - 1); }
        else if (ev.key === 'Escape' && !document.fullscreenElement) stang();
        else if (ev.key === 'k' || ev.key === 'K') { var k = s.bilder.indexOf('kalkyl'); if (k >= 0) ga(k); }
        else if (ev.key === 'Home') ga(0);
        else if (ev.key === 'End') ga(s.bilder.length - 1);
      };
      document.addEventListener('keydown', s.tangent);

      // Svep på pekskärm.
      var sx = null;
      el.addEventListener('touchstart', function (ev) { if (!ev.target.closest('model-viewer')) sx = ev.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (ev) {
        if (sx == null) return;
        var dx = ev.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 60) ga(s.nu + (dx < 0 ? 1 : -1));
        sx = null;
      });
      window.addEventListener('resize', function () { if (s) placeraPill(); });

      var startN = opt.start ? Math.max(0, bilder.indexOf(opt.start)) : 0;
      ga(startN, 1);
    }
  };
})();
