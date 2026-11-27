/* Legohus – den animerade loggan (2026-11-26, användaren: "Legohus-loggan ska ritas fram animerat som Uperformance-loggan").
   Samma ritning som images/legohus_logo.svg (viewBox -6 -6 1250 316, fill #82776b), men inline så att delarna kan ritas fram:
   takets kontur dras som en linje och fylls, väggarna växer upp från golvet, golvet dras ut, fönsterrutorna poppar in en och en
   och sist sveps ordmärket fram från vänster (ca 1,7 s). Bara transform, opacity, stroke-dashoffset och clip-path.
   En gång per besök (sessionStorage), aldrig vid prefers-reduced-motion. Stil: logga.css.

   Märkning: data-lh-logga på en <img> (eller på ett element som ska få loggan inuti). Bilden byts mot SVG:n och behåller sina
   klasser, så sajtens storlek och färgfilter (ljust/mörkt tema) gäller som förut. Utan JS syns bilden som vanligt.
   För Bygg online m.fl.: window.LegohusLogga.montera(rot) monterar alla [data-lh-logga] under rot,
   window.LegohusLogga.svg({ klass, etikett, rita }) ger SVG-koden som text. */
(function () {
  'use strict';
  var NYCKEL = 'legohus-logga-ritad';
  var TAK = 'M0 112 L145 0 L260 103 L260 129 L145 27 L0 138 Z';
  var ORD = 'M368.2 252V88H385.6V235.3H463.2V252ZM530.8 255.4Q512.9 255.4 499.6 247.5Q486.4 239.5 479 225Q471.7 210.5 471.7 191.1Q471.7 170.9 478.9 156.2Q486.2 141.5 499.3 133.6Q512.4 125.6 530.2 125.6Q548.4 125.6 561.3 134Q574.3 142.4 580.9 158Q587.5 173.7 586.7 195.4H569V189.2Q568.6 165.5 558.9 153.5Q549.3 141.5 530.7 141.5Q511 141.5 500.6 154.2Q490.3 166.9 490.3 190.5Q490.3 213.5 500.6 226.1Q511 238.8 530.2 238.8Q543.2 238.8 552.8 232.7Q562.5 226.7 568.1 215.5L584.5 221.6Q577.2 237.7 563 246.6Q548.7 255.4 530.8 255.4ZM484.1 195.4V180.9H577.5V195.4ZM657.1 310.1Q647.6 310.1 638.4 307.3Q629.3 304.4 621.5 298.5Q613.8 292.5 608.5 283L624.4 274.3Q629.4 284.3 638.5 288.7Q647.5 293.1 657.1 293.1Q670.1 293.1 678.3 288.3Q686.4 283.5 690.1 274.1Q693.9 264.6 693.8 250.6V217.6H695.8V129H711.4V250.8Q711.4 256 711.1 260.8Q710.8 265.6 710 270.3Q707.7 283.9 700.9 292.7Q694.1 301.5 683.1 305.8Q672 310.1 657.1 310.1ZM655.9 255.4Q638.7 255.4 626.4 246.8Q614.2 238.3 607.7 223.5Q601.2 208.8 601.2 190.4Q601.2 172 607.7 157.3Q614.2 142.7 626.3 134.1Q638.4 125.6 655.3 125.6Q672.7 125.6 684.5 134Q696.4 142.5 702.4 157.1Q708.5 171.8 708.5 190.4Q708.5 208.7 702.5 223.5Q696.4 238.2 684.7 246.8Q672.9 255.4 655.9 255.4ZM657.7 239.3Q670.7 239.3 679.1 232.9Q687.6 226.6 691.7 215.5Q695.8 204.5 695.8 190.4Q695.8 176.1 691.7 165.1Q687.5 154.1 679.2 147.9Q670.8 141.7 658.2 141.7Q645.1 141.7 636.5 148.2Q628 154.6 623.9 165.6Q619.7 176.6 619.7 190.4Q619.7 204.2 624 215.3Q628.2 226.3 636.6 232.8Q645.1 239.3 657.7 239.3ZM790.8 255.4Q772.5 255.4 759.4 247.1Q746.3 238.8 739.4 224.1Q732.4 209.4 732.4 190.4Q732.4 171 739.5 156.4Q746.6 141.8 759.7 133.7Q772.8 125.6 790.8 125.6Q809.2 125.6 822.3 133.9Q835.4 142.1 842.4 156.7Q849.3 171.3 849.3 190.4Q849.3 209.7 842.3 224.3Q835.3 239 822.2 247.2Q809.1 255.4 790.8 255.4ZM790.8 238.8Q811 238.8 820.9 225.3Q830.8 211.8 830.8 190.4Q830.8 168.4 820.8 155.3Q810.9 142.2 790.8 142.2Q777.2 142.2 768.4 148.4Q759.6 154.5 755.2 165.4Q750.9 176.2 750.9 190.4Q750.9 212.3 761 225.5Q771.2 238.8 790.8 238.8ZM959 252V189.4Q959 179.5 957.1 171Q955.3 162.5 951.1 156.1Q946.9 149.7 940.2 146.1Q933.5 142.5 923.8 142.5Q915.2 142.5 908.5 145.5Q901.8 148.4 897.2 154.1Q892.7 159.7 890.3 167.9Q887.9 176.1 887.9 186.6L875.8 183.6Q875.8 164.9 882.3 152.1Q888.9 139.2 900.5 132.6Q912.1 125.9 927.4 125.9Q938.6 125.9 946.9 129.4Q955.1 132.8 960.9 138.7Q966.6 144.6 970 152.2Q973.5 159.7 975 168Q976.6 176.2 976.6 184.3V252ZM870.3 252V88H886.1V180.2H887.9V252ZM1049.1 255.1Q1037.9 255.1 1029.6 251.6Q1021.3 248.2 1015.6 242.3Q1009.9 236.4 1006.4 228.8Q1003 221.3 1001.4 213Q999.9 204.8 999.9 196.7V129H1017.5V191.6Q1017.5 201.4 1019.3 209.9Q1021.2 218.5 1025.4 224.9Q1029.6 231.3 1036.3 234.9Q1043 238.5 1052.7 238.5Q1061.3 238.5 1068 235.5Q1074.7 232.6 1079.2 226.9Q1083.8 221.3 1086.2 213.1Q1088.6 204.9 1088.6 194.4L1100.7 197.4Q1100.7 216.1 1094.1 228.9Q1087.6 241.8 1075.9 248.4Q1064.3 255.1 1049.1 255.1ZM1090.4 252V221.2H1088.6V129H1106.1V252ZM1180 255.3Q1158.3 255.3 1144.3 245.9Q1130.3 236.5 1127.1 219.7L1144.9 216.8Q1147.6 227.2 1157.2 233.3Q1166.8 239.4 1180.9 239.4Q1194.6 239.4 1202.6 233.7Q1210.5 228 1210.5 218.1Q1210.5 212.5 1207.9 208.9Q1205.4 205.4 1197.6 202.4Q1189.8 199.4 1174.4 195.2Q1157.7 190.7 1148.3 186.1Q1138.8 181.5 1134.9 175.5Q1130.9 169.5 1130.9 160.8Q1130.9 150.3 1136.8 142.3Q1142.7 134.4 1153.2 130Q1163.7 125.6 1177.7 125.6Q1191.6 125.6 1202.6 130.1Q1213.6 134.5 1220.3 142.6Q1227.1 150.7 1228.3 161.5L1210.5 164.7Q1208.8 154 1200 147.9Q1191.1 141.7 1177.5 141.4Q1164.7 141.1 1156.6 146.2Q1148.5 151.4 1148.5 160Q1148.5 164.8 1151.4 168.2Q1154.3 171.7 1162.1 174.7Q1169.9 177.7 1184.4 181.3Q1201.2 185.6 1210.8 190.4Q1220.5 195.2 1224.5 201.7Q1228.6 208.3 1228.6 217.8Q1228.6 235.3 1215.6 245.3Q1202.7 255.3 1180 255.3Z';
  var html = document.documentElement;
  var lugn = false;
  try { lugn = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  // Första sidvisningen under besöket ritar loggan; sedan står den stilla.
  var rita = !lugn;
  try { if (sessionStorage.getItem(NYCKEL)) rita = false; } catch (e) {}
  html.classList.add('lh-logga-js');

  // Stilen följer med skriptet, så att en sida bara behöver logga.js (Bygg online m.fl.).
  // Tidslinje: takets linje 0,05–0,75 s → taket fylls 0,55 s → väggarna växer 0,45/0,55 s → golvet 0,7 s
  // → rutorna 0,9–1,4 s → ordmärket sveps 1,0–1,75 s.
  var STIL = ''
    + '.lh-logga{display:block;overflow:visible;fill:var(--lh-logga-farg,#82776b)}'
    // Sajtens ljusa sidfot nollställer filtret på 'img' – samma för SVG:n (design.css, .site-footer img).
    + 'html:not([data-tema="mork"]) .site-footer svg.lh-logga{filter:none}'
    + '.lh-logga .lh-tak-linje{fill:none;stroke:var(--lh-logga-farg,#82776b);stroke-width:8;stroke-linejoin:round;opacity:0}'
    + '.lh-logga .lh-vagg,.lh-logga .lh-golv,.lh-logga .lh-ruta,.lh-logga .lh-tak{transform-box:fill-box}'
    + '@media screen and (prefers-reduced-motion:no-preference){'
    + 'svg.lh-logga[data-lh-rita],svg.lh-logga[data-lh-vantar]{animation:none}'
    + '.lh-logga[data-lh-rita] .lh-tak-linje{opacity:1;stroke-dasharray:1 1;stroke-dashoffset:1}'
    + '.lh-logga[data-lh-rita] .lh-tak{opacity:0;transform:scale(.94);transform-origin:50% 100%}'
    + '.lh-logga[data-lh-rita] .lh-vagg{transform:scaleY(0);transform-origin:50% 100%}'
    + '.lh-logga[data-lh-rita] .lh-golv{transform:scaleX(0);transform-origin:0 50%}'
    + '.lh-logga[data-lh-rita] .lh-ruta{opacity:0;transform:scale(.4);transform-origin:50% 50%}'
    + '.lh-logga[data-lh-rita] .lh-ord{clip-path:inset(0 100% 0 0)}'
    + '.lh-logga[data-lh-rita] .lh-tak-linje{animation:lh-linje .7s cubic-bezier(.65,0,.35,1) .05s forwards,lh-bort .3s cubic-bezier(.22,1,.36,1) .9s forwards}'
    + '.lh-logga[data-lh-rita] .lh-tak{animation:lh-in .5s cubic-bezier(.22,1,.36,1) .55s forwards}'
    + '.lh-logga[data-lh-rita] .lh-vagg-1{animation:lh-in .5s cubic-bezier(.22,1,.36,1) .45s forwards}'
    + '.lh-logga[data-lh-rita] .lh-vagg-2{animation:lh-in .5s cubic-bezier(.22,1,.36,1) .55s forwards}'
    + '.lh-logga[data-lh-rita] .lh-golv{animation:lh-in .45s cubic-bezier(.22,1,.36,1) .7s forwards}'
    + '.lh-logga[data-lh-rita] .lh-ruta{animation:lh-in .32s cubic-bezier(.22,1,.36,1) .9s forwards}'
    + '.lh-logga[data-lh-rita] .lh-ruta-2{animation-delay:.97s}'
    + '.lh-logga[data-lh-rita] .lh-ruta-3{animation-delay:1.04s}'
    + '.lh-logga[data-lh-rita] .lh-ruta-4{animation-delay:1.11s}'
    + '.lh-logga[data-lh-rita] .lh-ord{animation:lh-svep .75s cubic-bezier(.22,1,.36,1) 1s forwards}'
    + '}'
    + '@keyframes lh-linje{to{stroke-dashoffset:0}}'
    + '@keyframes lh-bort{to{opacity:0}}'
    + '@keyframes lh-in{to{opacity:1;transform:none}}'
    + '@keyframes lh-svep{to{clip-path:inset(0 0 0 0)}}';
  if (!document.getElementById('lh-logga-stil')) {
    var st = document.createElement('style');
    st.id = 'lh-logga-stil';
    st.textContent = STIL;
    (document.head || html).appendChild(st);
  }

  function svg(o) {
    o = o || {};
    var namn = o.etikett ? ' role="img" aria-label="' + String(o.etikett).replace(/"/g, '&quot;') + '"' : ' aria-hidden="true"';
    return '<svg class="lh-logga' + (o.klass ? ' ' + o.klass : '') + '" viewBox="-6 -6 1250 316" width="1250" height="316" fill="#82776b"'
      + namn + ' focusable="false" shape-rendering="geometricPrecision"' + (o.rita ? ' data-lh-rita' : '') + '>'
      + '<path class="lh-tak" d="' + TAK + '"/>'
      + '<path class="lh-tak-linje" pathLength="1" d="' + TAK + '"/>'
      + '<rect class="lh-vagg lh-vagg-1" x="30" y="100" width="30" height="152"/>'
      + '<rect class="lh-vagg lh-vagg-2" x="95" y="80" width="30" height="172"/>'
      + '<rect class="lh-golv" x="95" y="222" width="165" height="30"/>'
      + '<rect class="lh-ruta lh-ruta-1" x="170" y="138" width="22" height="22"/>'
      + '<rect class="lh-ruta lh-ruta-2" x="198" y="138" width="22" height="22"/>'
      + '<rect class="lh-ruta lh-ruta-3" x="170" y="166" width="22" height="22"/>'
      + '<rect class="lh-ruta lh-ruta-4" x="198" y="166" width="22" height="22"/>'
      + '<path class="lh-ord" d="' + ORD + '"/></svg>';
  }

  // Loggor långt ner (sidfoten) ritas först strax innan de syns. Tills dess står de färdiga,
  // så att de aldrig blir osynliga om observatören inte hinner (helsideskärmbild, utskrift, ankarhopp).
  var io = null;
  function startaNar(el) {
    var r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) { el.setAttribute('data-lh-rita', ''); return; }
    if (!('IntersectionObserver' in window)) { el.setAttribute('data-lh-rita', ''); return; }
    el.setAttribute('data-lh-vantar', '');
    if (!io) io = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) {
        if (!p.isIntersecting) return;
        io.unobserve(p.target);
        p.target.removeAttribute('data-lh-vantar');
        p.target.setAttribute('data-lh-rita', '');
      });
    }, { rootMargin: '0px 0px 160px 0px' });
    io.observe(el);
  }

  var stilla = false;
  function malad() {
    try { return performance.getEntriesByType('paint').length > 0; } catch (e) { return false; }
  }

  function montera(rot) {
    rot = rot || document;
    var lista = rot.querySelectorAll('[data-lh-logga]:not([data-lh-logga-klar])');
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i], tmp = document.createElement('div'), ny;
      if (el.tagName === 'IMG') {
        // Bilden står synlig tills SVG:n tar dess plats (ingen dold logga som väntar på skriptet).
        // Har sidan redan hunnit målas med bilden ritas loggan inte fram, då skulle den blinka bort.
        if (rita && malad()) stilla = true;
        var alt = el.getAttribute('alt') || '';
        tmp.innerHTML = svg({ klass: el.getAttribute('class') || '', etikett: alt });
        ny = tmp.firstChild;
        ny.setAttribute('data-lh-logga', el.getAttribute('data-lh-logga') || '');
        el.parentNode.replaceChild(ny, el);
      } else {
        tmp.innerHTML = svg({ etikett: el.getAttribute('data-lh-etikett') || '' });
        ny = tmp.firstChild;
        var gamla = el.querySelectorAll(':scope > img, :scope > svg');
        for (var j = 0; j < gamla.length; j++) gamla[j].remove();
        el.insertBefore(ny, el.firstChild);
        el.setAttribute('data-lh-logga-klar', '');
      }
      ny.setAttribute('data-lh-logga-klar', '');
      // under entrén (intro nedan) är det entréns logga som landar i sidhuvudet: sidhuvudets ritas inte fram en gång till
      if (rita && !stilla && !(html.classList.contains('lh-intro') && ny.closest && ny.closest('.site-header'))) startaNar(ny);
      stilla = false;
    }
  }

  // Loggan byts så fort parsern lagt in bilden (före första målningen), inte först vid DOMContentLoaded.
  var mo = null;
  function klar() {
    if (mo) { mo.disconnect(); mo = null; }
    montera(document);
    if (rita) { try { sessionStorage.setItem(NYCKEL, '1'); } catch (e) {} }
  }
  if (document.readyState === 'loading') {
    if ('MutationObserver' in window) {
      mo = new MutationObserver(function () { montera(document); });
      mo.observe(html, { childList: true, subtree: true });
    }
    document.addEventListener('DOMContentLoaded', klar);
  } else klar();

  // ---- Entrén (2026-11-27, användaren: "en animerad laddningssida innan hemsidan, som Uperformance") ----
  // Första sidvisningen under besöket: loggan ritar sig på ben-färgad botten och flyger sedan upp till sidhuvudets logga.
  // Bara ett visuellt lager: sidan under laddas och målas som vanligt (hjältebilden med full prioritet), lagret är
  // aria-hidden och tar inga klick. Uppritningen sker i en egen tråd (husritare-laddning.js, OffscreenCanvas), så att
  // sidans skript inte får den att hacka. Utgången börjar när loggan är ritad (cirka 0,85 s) och hjältebilden är avkodad,
  // senast 1,0 s in i sidan, och är klar 0,55 s senare (allt borta före 1,6 s). Säkerhet: lagret tonar bort av sig självt efter 2 s.
  // Anropas av sidornas första skript i <body> (_avslut.py). Aldrig: andra sidvisningen, sidbyte inom sajten (t.ex. från
  // CRM:et med vy-övergång), bakåt/framåt, omladdning, i en ram, för sökrobotar, vid reducerad rörelse eller utan JS.
  var INTRO = 'legohus-intro';
  var IFARG = '#82776b', IFARG_MORK = '#ece7df';
  STIL += ''
    + '.lhi{position:fixed;inset:0;z-index:2147483000;pointer-events:none;animation:lhi-sakert .3s ease 2s forwards}'
    + '.lhi__bak{position:absolute;inset:0;background:var(--ben,#f7f5f0);will-change:opacity}'
    + 'html[data-tema="mork"] .lhi__bak{background:#161411}'
    + '.lhi__marke{position:absolute;left:50%;top:46%;width:min(280px,62vw);aspect-ratio:1250/316;translate:-50% -50%;transform-origin:0 0;will-change:transform,opacity}'
    + '.lhi__marke svg{display:block;width:100%;height:100%;fill:' + IFARG + ';animation:lhi-in .5s cubic-bezier(.22,1,.36,1) both}'
    + 'html[data-tema="mork"] .lhi__marke svg{fill:' + IFARG_MORK + '}'
    + '.lhi--duk .lhi__marke svg{visibility:hidden;animation:none}'
    + '.lhi__duk{position:absolute;left:0;top:0;width:100%;height:100%;display:block}'
    + '.lhi__linje{position:absolute;left:50%;top:calc(46% + min(62px,15vw));width:64px;height:2px;translate:-50% 0;border-radius:2px;overflow:hidden;background:rgba(27,25,21,.09);will-change:opacity}'
    + 'html[data-tema="mork"] .lhi__linje{background:rgba(247,245,240,.12)}'
    + '.lhi__linje i{display:block;height:100%;border-radius:inherit;background:var(--virke-djup,#8f5424);transform:scaleX(0);transform-origin:left;animation:lhi-fyll 1.1s cubic-bezier(.22,1,.36,1) .12s forwards}'
    + 'html[data-tema="mork"] .lhi__linje i{background:var(--virke,#f0b56e)}'
    // sidhuvudets logga står dold tills entréns logga landar på den (inget dubbelt märke under flygningen)
    + 'html.lh-intro:not(.lh-intro-landat) .site-header .logo__svg{opacity:0}'
    + 'html.lh-intro-landat .site-header .logo__svg{transition:opacity .12s ease}'
    + '@keyframes lhi-fyll{to{transform:scaleX(.92)}}'
    + '@keyframes lhi-in{from{opacity:0;transform:scale(.97)}}'
    + '@keyframes lhi-sakert{to{opacity:0;visibility:hidden}}';
  var stilEl = document.getElementById('lh-logga-stil');
  if (stilEl) stilEl.textContent = STIL;

  function intro() {
    var b = document.body;
    if (!b || lugn || html.classList.contains('lh-intro') || document.querySelector('.lhi')) return;
    try { if (sessionStorage.getItem(INTRO)) return; sessionStorage.setItem(INTRO, '1'); } catch (e) { return; }
    try { if (window.top !== window) return; } catch (e) { return; }
    if (/[?&](inbaddad|foto)=1(&|$)/.test(location.search)) return;
    if (/bot|crawl|spider|slurp|facebookexternalhit|embedly|bingpreview/i.test(navigator.userAgent || '')) return;
    try { if (document.referrer && new URL(document.referrer).origin === location.origin) return; } catch (e) { /* okänd hänvisning */ }
    try { var nav = performance.getEntriesByType('navigation')[0]; if (nav && nav.type && nav.type !== 'navigate') return; } catch (e) { /* äldre webbläsare */ }

    // sidan kom sent (långsamt nät): ingen entré, den skulle bara skjuta upp sidan ytterligare
    if (performance.now() > 700) return;
    html.classList.add('lh-intro');
    var t0 = performance.now(), mork = html.getAttribute('data-tema') === 'mork';
    var el = document.createElement('div');
    el.className = 'lhi';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="lhi__bak"></div><div class="lhi__marke">' + svg({}) + '</div><span class="lhi__linje"><i></i></span>';
    b.insertBefore(el, b.firstChild);
    var bak = el.firstChild, marke = bak.nextSibling, linje = marke.nextSibling, s = marke.firstChild;
    var arb = null, ritad = false;

    // Uppritningen i en egen tråd. Tider i ms från första målningen (kortare än Bygg onlines).
    if (window.Worker && window.OffscreenCanvas && HTMLCanvasElement.prototype.transferControlToOffscreen) {
      try {
        var delar = [], tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var rekt = function (n) {
          var x = +n.getAttribute('x'), y = +n.getAttribute('y'), w = +n.getAttribute('width'), h = +n.getAttribute('height');
          return { d: 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'Z', len: 2 * (w + h), box: { x: x, y: y, w: w, h: h } };
        };
        s.appendChild(tmp);
        tmp.setAttribute('d', TAK);
        delar.push({ typ: 'streck', t: [0, 480], bitar: [{ d: TAK, len: tmp.getTotalLength() }] });
        delar.push({ typ: 'tak', t: [330, 300], d: TAK, box: { x: 0, y: 0, w: 260, h: 138 } });
        var vagg = s.querySelectorAll('.lh-vagg, .lh-golv');
        for (var i = 0; i < vagg.length; i++) {
          var r = rekt(vagg[i]);
          delar.push({ typ: 'streck', t: [60 + i * 40, 420], bitar: [{ d: r.d, len: r.len }] });
          delar.push({ typ: 'vagg', t: [300 + i * 30, 280], d: r.d, box: r.box });
        }
        var rutor = s.querySelectorAll('.lh-ruta');
        for (i = 0; i < rutor.length; i++) { r = rekt(rutor[i]); delar.push({ typ: 'ruta', t: [450 + i * 35, 200], d: r.d, box: r.box }); }
        // ordet: varje delstig (bokstav, inre kontur) dras när pennan kommer dit från vänster
        ORD.split(/(?=M)/).forEach(function (d) {
          tmp.setAttribute('d', d);
          var x = parseFloat(d.slice(1)), k = Math.max(0, Math.min(1, (x - 368) / 860));
          delar.push({ typ: 'streck', ord: true, t: [120 + k * 300, 420], bitar: [{ d: d, len: tmp.getTotalLength() }] });
        });
        delar.push({ typ: 'bokstav', t: [430, 320], d: ORD, box: { x: 0, y: 0, w: 0, h: 0 } });
        s.removeChild(tmp);
        var duk = document.createElement('canvas');
        duk.className = 'lhi__duk';
        marke.insertBefore(duk, s);
        var bredd = marke.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1);
        var off = duk.transferControlToOffscreen();
        var lv = (document.querySelector('script[src*="logga.js"]') || {}).src || '';
        var v = (lv.match(/[?&]v=(\w+)/) || [])[1];
        arb = new Worker('husritare-laddning.js' + (v ? '?v=' + v : ''));
        arb.onmessage = function (m) { if (m.data && m.data.typ === 'ritad') ritad = true; };
        arb.onerror = function () { el.classList.remove('lhi--duk'); duk.remove(); arb = null; ritad = true; };
        arb.postMessage({ typ: 'start', duk: off, farg: mork ? IFARG_MORK : IFARG, delar: delar, b: bredd, h: bredd * 316 / 1250,
          tider: { ritad: 760, klar: 900, bort: [600, 260], tjock: [7, 4.5] } }, [off]);
        el.classList.add('lhi--duk');
        // första målningen: ritningen (760 ms) ska hinna bli klar före utgången (senast 1,0 s in i sidan); målas sidan sent ritas den fortare
        requestAnimationFrame(function () { if (arb) arb.postMessage({ typ: 'kor', fart: 760 / Math.max(220, Math.max(1000, t0 + 600) - performance.now() - 40) }); });
      } catch (e) { el.classList.remove('lhi--duk'); var c = el.querySelector('.lhi__duk'); if (c) c.remove(); arb = null; }
    }
    if (!arb) ritad = true;    // SVG:n tonar in (lhi-in)

    // Hjältebilden (fetchpriority="high"): utgången väntar tills den är avkodad, så att sidan aldrig poppar fram halvladdad
    var hjalte = null, avkodad = false;
    function bildKlar() {
      if (avkodad) return true;
      if (!hjalte) hjalte = document.querySelector('img[fetchpriority="high"]');
      if (!hjalte) return document.readyState !== 'loading';
      if (!hjalte.complete) return false;
      if (!hjalte.naturalWidth || !hjalte.decode) return (avkodad = true);
      if (!hjalte._lhiAvkod) hjalte._lhiAvkod = hjalte.decode().then(function () { avkodad = true; }, function () { avkodad = true; });
      return false;
    }
    var slut = false;
    function koll() {
      if (slut) return;
      var gatt = performance.now() - t0;
      var bild = bildKlar();
      // ritad (tråden: ytorna står klara) och bilden avkodad; senast 1,0 s in i sidan (minst 0,6 s synlig), så att allt är borta före 1,6 s
      if ((ritad && bild && gatt >= 500) || performance.now() >= Math.max(1000, t0 + 600)) { ut(); return; }
      setTimeout(koll, 40);
    }
    setTimeout(koll, 300);

    function stang() {
      slut = true;
      if (arb) { try { arb.postMessage({ typ: 'stopp' }); } catch (e) { /* stängd */ } arb = null; }
      if (el.parentNode) el.parentNode.removeChild(el);
      html.classList.remove('lh-intro', 'lh-intro-ut', 'lh-intro-landat');
    }
    // Utgången: loggan lyfter en aning och flyger upp på sidhuvudets logga, botten tonar bort under tiden,
    // och sist tonar flyglogan ut ovanpå den riktiga (samma plats, samma storlek). Finns ingen synlig sidhuvudlogga:
    // loggan växer en aning och tonar bort (som Bygg online). Allt med Web Animations: transform och opacity.
    function ut() {
      slut = true;
      html.classList.add('lh-intro-ut');
      var E = 'cubic-bezier(.32,.72,0,1)', mal = document.querySelector('.site-header .logo__svg, .site-header .logo img');
      var m = marke.getBoundingClientRect(), r = mal ? mal.getBoundingClientRect() : null, k;
      var nyck;
      if (r && r.width > 8 && r.top >= 0 && r.bottom <= innerHeight && m.width) {
        k = r.width / m.width;
        var dx = r.left - m.left, dy = r.top - m.top, mx = m.width * 0.02, my = m.height * 0.02;
        nyck = [{ transform: 'none', opacity: 1 },
          { transform: 'translate(' + (-mx) + 'px,' + (-my) + 'px) scale(1.04)', opacity: 1, offset: 0.16, easing: E },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', opacity: 1, offset: 0.85 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', opacity: 0 }];
      } else {
        nyck = [{ transform: 'none', opacity: 1 }, { transform: 'translate(-3%,-3%) scale(1.06)', opacity: 0 }];
      }
      try {
        marke.animate(nyck, { duration: 540, easing: 'linear', fill: 'forwards' });
        bak.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
        // landningen: sidhuvudets egen logga tar över på exakt samma plats
        setTimeout(function () { html.classList.add('lh-intro-landat'); }, nyck.length > 2 ? 455 : 0);
        linje.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
      } catch (e) { stang(); return; }
      setTimeout(stang, 560);
    }
    // bakåt till en sida som låg i minnet mitt i entrén: inget lager kvar
    addEventListener('pageshow', function (e) { if (e.persisted) stang(); });
  }
  window.LegohusLogga = { montera: montera, svg: svg, intro: intro };

  // Tillägg 2026-11-27 (crm/vt.js): kommer man tillbaka till hemsidan från CRM:et eller inloggningen är sidbytet "bakåt" (ios.css),
  // och märket ritas inte fram igen – det glider hit från förra sidan.
  if ('onpagereveal' in window) addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var fran = window.navigation && navigation.activation && navigation.activation.from;
    if (!fran || !/\/crm\//.test(new URL(fran.url, location.href).pathname)) return;
    try { e.viewTransition.types.add('bak'); } catch (x) { /* äldre webbläsare */ }
    var l = document.querySelectorAll('[data-lh-rita]'); for (var i = 0; i < l.length; i++) l[i].removeAttribute('data-lh-rita');
    e.viewTransition.finished.then(function () {}, function () {});
  });
})();
