/* Legohus CRM – videomötets gränssnitt (samtal-ui.js, byggare B "gräns", 2026-10-29).
   Ritar förhandsvisningen, väntrummet, mötet (scen, rutor, kontroller, paneler), minimerat läge och slutskärmen
   i ett eget lager <div class="vm" id="vm"> direkt under <body> – utanför .huvud, så IH.rita() aldrig river det.
   Används både i CRM:et (index.html) och på gästsidan (mote-gast.html). Kräver bara motorn IH.samtal (samtal.js)
   och använder IH.videomote / IH.toast / IH.e bara om de finns. Synlig text säger alltid "videomöte"/"mötet",
   aldrig "samtal" (ordlistan reserverar det för telefonsamtal). Inga effekter följer muspekaren; animationer
   bara med transform/opacity, och prefers-reduced-motion ger tvärtoning. */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var D = document;
  var GAST = D.documentElement.hasAttribute('data-vm-gast');
  var ARLIG = 'Prototyp – videomötet fungerar mellan flikar i den här webbläsaren.';
  var lugnMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var mobilMq = window.matchMedia ? window.matchMedia('(max-width: 639px)') : { matches: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function e(s) { return IH.e ? IH.e(s) : esc(s); }
  function M() { return IH.samtal || null; }
  // Anropar motorn utan att gränssnittet faller om en funktion saknas eller kastar
  function kor(namn) {
    var m = M(), args = Array.prototype.slice.call(arguments, 1);
    if (!m || typeof m[namn] !== 'function') return undefined;
    try { return m[namn].apply(m, args); } catch (err) { console.warn('videomöte:', namn, err); return undefined; }
  }
  function korP(namn) {
    var r;
    try { r = kor.apply(null, arguments); } catch (err) { return Promise.reject(err); }
    return Promise.resolve(r);
  }
  function bg(namn) {
    var m = M(), b = m && m.bakgrund, args = Array.prototype.slice.call(arguments, 1);
    if (!b || typeof b[namn] !== 'function') return undefined;
    try { return b[namn].apply(b, args); } catch (err) { console.warn('videomöte bakgrund:', namn, err); return undefined; }
  }
  function tillstand() { return kor('tillstand') || {}; }
  function stod() { return kor('stod') || { media: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), skarm: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) }; }
  function inst() { return kor('installningar') || {}; }

  /* ---------- Ikoner (egen sprite, används även av videomote.js) ---------- */
  var IKONER = {
    'vm-mik': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    'vm-mik-av': '<path d="m2 2 20 20M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12M12 19v3"/>',
    'vm-kam': '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    'vm-kam-av': '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.25-3.06a.5.5 0 0 1 .75.43v8.2M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M2 2l20 20"/>',
    'vm-dela': '<path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3M8 21h8M12 17v4M17 8l5-5M17 3h5v5"/>',
    'vm-dela-av': '<path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3M8 21h8M12 17v4M22 3l-5 5M17 3l5 5"/>',
    'vm-hand': '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    'vm-reakt': '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    'vm-mer': '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    'vm-lamna': '<path d="M10.1 13.9a14 14 0 0 0 3.73 2.67 1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23l.24.47M22 2 2 22"/>',
    'vm-chatt': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'vm-deltagare': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'vm-info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    'vm-install': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    'vm-helskarm': '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    'vm-helskarm-ut': '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
    'vm-minimera': '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><rect x="12" y="12" width="6.5" height="5" rx="1"/>',
    'vm-las': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'vm-las-upp': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'vm-lank': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'vm-fast': '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    'vm-bakgrund': '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M6.5 21a6 6 0 0 1 11 0"/>',
    'vm-hogtalare': '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    'vm-natverk': '<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>',
    'vm-bock': '<path d="M20 6 9 17l-5-5"/>',
    'vm-stang': '<path d="M18 6 6 18M6 6l12 12"/>',
    'vm-chevron': '<path d="m6 9 6 6 6-6"/>',
    'vm-pil': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'vm-anvandare': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'vm-galleri': '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    'vm-talare': '<rect x="3" y="3" width="18" height="12" rx="2"/><rect x="3" y="18" width="5" height="3" rx="1"/><rect x="10" y="18" width="5" height="3" rx="1"/><rect x="17" y="18" width="4" height="3" rx="1"/>',
    'vm-tangent': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8M10 13h4"/>',
    'vm-skicka': '<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.02.93l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
    'vm-kopiera': '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    'vm-ladda-upp': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    'vm-flytta': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    'vm-ingen': '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    'vm-rec': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
    'vm-ladda-ner': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    'vm-oskarpa': '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8" stroke-dasharray="1.5 3"/>',
    'vm-r-gilla': '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    'vm-r-hjarta': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'vm-r-applad': '<path d="M5.8 11.3 2 22l10.7-3.79M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
    'vm-r-skratt': '<circle cx="12" cy="12" r="10"/><path d="M7.5 13a4.5 4.5 0 0 0 9 0ZM9 9h.01M15 9h.01"/>',
    'vm-r-forvanad': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="15.5" r="2.2"/><path d="M9 9h.01M15 9h.01"/>'
  };
  function sprite() {
    if (D.getElementById('vm-ikoner') || !D.body) return;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" id="vm-ikoner" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">';
    for (var k in IKONER) s += '<symbol id="' + k + '" viewBox="0 0 24 24">' + IKONER[k] + '</symbol>';
    D.body.insertAdjacentHTML('afterbegin', s + '</svg>');
  }
  if (D.body) sprite(); else D.addEventListener('DOMContentLoaded', sprite);
  function ik(namn, klass) {
    return '<svg class="vm-ik' + (klass ? ' ' + klass : '') + '" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#' + namn + '"/></svg>';
  }

  /* ---------- Text och tid ---------- */
  var DAG = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
  var MAN = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tv(n) { return (n < 10 ? '0' : '') + n; }
  function klock(d) { return tv(d.getHours()) + '.' + tv(d.getMinutes()); }
  function nar(mote) {
    if (!mote || !mote.start) return '';
    var s = new Date(mote.start);
    if (isNaN(s)) return '';
    var t = DAG[s.getDay()] + ' ' + s.getDate() + ' ' + MAN[s.getMonth()] + ' kl. ' + klock(s);
    var l = +mote.langd;
    if (l > 0) t += '–' + klock(new Date(s.getTime() + l * 60000));
    return t;
  }
  function langd(sek) {
    sek = Math.max(0, Math.floor(sek));
    var h = Math.floor(sek / 3600), m = Math.floor(sek / 60) % 60, s = sek % 60;
    return (h ? h + ':' + tv(m) : tv(m)) + ':' + tv(s);
  }
  function initialer(namn) {
    var d = String(namn || '').trim().split(/\s+/).filter(Boolean);
    if (!d.length) return '?';
    return ((d[0][0] || '') + (d.length > 1 ? d[d.length - 1][0] : '')).toUpperCase();
  }
  function fornamn(namn) { return String(namn || '').trim().split(/\s+/)[0] || 'Värden'; }
  function antal(n, en, fler) { return n + ' ' + (n === 1 ? en : fler); }
  function rollText(d) { return d.roll === 'vard' ? 'Värd' : d.gast || d.roll === 'gast' ? 'Gäst' : ''; }

  /* ---------- Tillstånd för lagret ---------- */
  var S = null;
  var vidSlutFn = [];

  function nyS(opt) {
    var jag = opt.jag || {};
    return {
      mote: opt.mote || {}, roll: opt.roll || 'gast',
      jag: { id: jag.id || null, namn: String(jag.namn || '').slice(0, 60), roll: opt.roll || 'gast', initialer: jag.initialer || initialer(jag.namn) },
      fas: 'forhand', orsak: null, mini: false, layout: 'galleri', fast: null, panel: null, flik: 'ljud', meny: null,
      rutor: {}, ljud: {}, strom: {}, chatt: [], olasta: 0, vantande: [], deltagare: [], natverk: {}, talare: null,
      inTid: 0, sek: null, avbryt: [], media: 'ingen', mediaFel: null, faktiska: {}, enheter: { kameror: [], mikrofoner: [], hogtalare: [] },
      lamnaKlick: 0, avslutaKlick: 0, taBortKlick: null, doljEgen: false, sammanfattning: null, svag: 0, svagVisad: false,
      fokusFore: D.activeElement, testar: false, bgFel: null, bgLaddar: false, egenBild: null, kontrollerTimer: 0, ptt: false,
      nivaRaf: 0, nivaer: null, sparat: false, inspelning: { pa: false }
    };
  }

  /* ---------- Ljud (ton när någon knackar) ---------- */
  var ac = null;
  function pling() {
    if (tillstand().ljudlage === 'inget') return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach(function (t0) {
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
        o.type = 'sine'; o.frequency.value = t0 ? 880 : 660;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (err) { /* inget ljud */ }
  }

  function live(text) {
    if (!S || !S.el) return;
    var l = S.el.querySelector('.vm-live');
    if (!l) return;
    l.textContent = '';
    setTimeout(function () { l.textContent = text; }, 40);
  }
  function toast(rubrik, text, ikon) {
    if (IH.toast && !GAST) { try { IH.toast(rubrik, text, ikon || 'bock'); return; } catch (err) { /* */ } }
    avis({ text: '<b>' + e(rubrik) + '</b>' + (text ? ' ' + e(text) : ''), tid: 3500 });
  }

  /* ---------- Bygg lagret ---------- */
  function bygg() {
    var el = D.createElement('div');
    el.className = 'vm';
    el.id = 'vm';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Videomöte');
    el.setAttribute('data-fas', 'forhand');
    el.setAttribute('data-layout', 'galleri');
    if (GAST) el.setAttribute('data-gast-sida', '');
    el.innerHTML =
      (GAST ? '' : '<div class="vm-slojan"></div>') +
      '<section class="vm-forhand" aria-label="Förhandsvisning">' +
        '<div class="vm-forhand__kort">' +
          '<div class="vm-forhand__bild">' +
            '<video class="vm-video vm-video--egen" autoplay playsinline muted></video>' +
            '<div class="vm-forhand__tom">' + ik('vm-kam-av') + '<span>Kameran är av</span></div>' +
            '<div class="vm-forhand__test" hidden></div>' +
            '<div class="vm-niva" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
            '<div class="vm-forhand__vaxlar"></div>' +
          '</div>' +
          '<div class="vm-forhand__val"></div>' +
        '</div>' +
      '</section>' +
      '<section class="vm-scen" aria-label="Mötet">' +
        '<header class="vm-topp">' +
          '<span class="vm-topp__titel"></span>' +
          '<span class="vm-topp__meta"><time class="vm-topp__klocka"></time><span class="vm-topp__tid"></span></span>' +
          '<span class="vm-topp__las" hidden>' + ik('vm-las') + '<span>Låst</span></span>' +
          '<span class="vm-topp__rec" hidden><i aria-hidden="true"></i><span class="vm-topp__rectext">Spelas in</span><button type="button" class="vm-topp__recstopp" data-vm="inspelning-stopp" hidden>Sluta spela in</button></span>' +
          '<span class="vm-natverk" data-niva="bra" title="Anslutningen är bra" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
          '<span class="vm-topp__knappar">' +
            '<button type="button" class="vm-knapp vm-knapp--liten" data-vm="helskarm" aria-label="Helskärm">' + ik('vm-helskarm') + '</button>' +
            (GAST ? '' : '<button type="button" class="vm-knapp vm-knapp--liten" data-vm="minimera" aria-label="Minimera mötet (Esc)">' + ik('vm-minimera') + '</button>') +
          '</span>' +
        '</header>' +
        '<div class="vm-delar" hidden></div>' +
        '<div class="vm-yta">' +
          '<div class="vm-rutnat"></div>' +
          '<div class="vm-scenyta"></div>' +
          '<div class="vm-remsa"></div>' +
          '<div class="vm-ensam" hidden></div>' +
        '</div>' +
        '<article class="vm-egen" data-horn="nh" aria-label="Du">' +
          '<video class="vm-video vm-video--egen" autoplay playsinline muted></video>' +
          '<div class="vm-ruta__initialer"><span></span></div>' +
          '<div class="vm-ruta__namn"><span>Du</span></div>' +
          '<span class="vm-ruta__mik" hidden>' + ik('vm-mik-av') + '</span>' +
          '<button type="button" class="vm-egen__flytta" data-vm="flytta-egen" aria-label="Flytta din bild till nästa hörn">' + ik('vm-flytta') + '</button>' +
        '</article>' +
        '<div class="vm-reaktioner" aria-hidden="true"></div>' +
        '<nav class="vm-kontroller" role="toolbar" aria-label="Mötets kontroller"></nav>' +
      '</section>' +
      '<div class="vm-avisering-yta"></div>' +
      '<section class="vm-mini" aria-label="Pågående videomöte" hidden></section>' +
      '<section class="vm-slut" hidden></section>' +
      '<aside class="vm-panel" role="complementary" aria-labelledby="vm-panel-rubrik" hidden></aside>' +
      '<div class="vm-meny" role="menu" hidden></div>' +
      '<div class="vm-ljud" hidden></div>' +
      '<div class="vm-live sr-only" aria-live="polite"></div>';
    return el;
  }

  /* ---------- Knappar i kontrollraden ---------- */
  function knapp(vm, ikon, etikett, opt) {
    opt = opt || {};
    var a = ' type="button" class="vm-knapp' + (opt.klass ? ' ' + opt.klass : '') + '" data-vm="' + vm + '" aria-label="' + e(opt.aria || etikett) + '"' +
      (opt.pressed != null ? ' aria-pressed="' + (opt.pressed ? 'true' : 'false') + '"' : '') + (opt.panel ? ' data-panel="' + opt.panel + '"' : '') +
      (opt.meny ? ' aria-haspopup="menu" aria-expanded="false"' : '') + (GAST ? ' title="' + e(opt.aria || etikett) + '"' : '');
    return '<button' + a + '>' + ik(ikon) + '<span class="vm-knapp__text">' + e(etikett) + '</span>' + (opt.bricka != null ? '<span class="vm-bricka"' + (opt.bricka ? '' : ' hidden') + '>' + e(opt.bricka || '') + '</span>' : '') + '</button>';
  }
  function pil(vm, aria) {
    return '<button type="button" class="vm-knapp__pil" data-vm="' + vm + '" aria-label="' + e(aria) + '" aria-haspopup="menu" aria-expanded="false"' + (GAST ? ' title="' + e(aria) + '"' : '') + '>' + ik('vm-chevron') + '</button>';
  }
  function ritaKontroller() {
    if (!S) return;
    var t = tillstand(), j = t.jag || {}, st = stod();
    var mik = !!j.mik, kam = !!j.kam, delar = !!j.delar, hand = !!j.hand;
    var vard = S.roll === 'vard';
    var antalD = (S.deltagare.length || 0) + 1;
    var nav = S.el.querySelector('.vm-kontroller');
    nav.innerHTML =
      '<div class="vm-kontroller__vanster"><b>' + e(S.mote.titel || 'Videomöte') + '</b><span class="vm-kontroller__tid"></span></div>' +
      '<div class="vm-kontroller__mitt">' +
        '<div class="vm-delad' + (mik ? '' : ' vm-delad--av') + '">' + knapp('mik', mik ? 'vm-mik' : 'vm-mik-av', mik ? 'Mikrofon' : 'Ljud av', { aria: mik ? 'Stäng av mikrofonen (Ctrl+Shift+M)' : 'Slå på mikrofonen (Ctrl+Shift+M)', pressed: !mik, klass: mik ? '' : 'vm-knapp--av' }) + pil('meny-mik', 'Välj mikrofon och högtalare') + '</div>' +
        '<div class="vm-delad' + (kam ? '' : ' vm-delad--av') + '">' + knapp('kam', kam ? 'vm-kam' : 'vm-kam-av', kam ? 'Kamera' : 'Kamera av', { aria: kam ? 'Stäng av kameran (Ctrl+Shift+O)' : 'Slå på kameran (Ctrl+Shift+O)', pressed: !kam, klass: kam ? '' : 'vm-knapp--av' }) + pil('meny-kam', 'Välj kamera och bakgrund') + '</div>' +
        (st.skarm === false ? '' : knapp('dela', delar ? 'vm-dela-av' : 'vm-dela', delar ? 'Sluta dela' : 'Dela', { aria: delar ? 'Sluta dela skärmen (Ctrl+Shift+E)' : 'Dela skärm (Ctrl+Shift+E)', pressed: delar, klass: 'vm-k-extra' + (delar ? ' vm-knapp--pa' : ''), meny: !delar })) +
        knapp('hand', 'vm-hand', hand ? 'Sänk' : 'Räck upp', { aria: hand ? 'Sänk handen (Ctrl+Shift+K)' : 'Räck upp handen (Ctrl+Shift+K)', pressed: hand, klass: 'vm-k-extra' + (hand ? ' vm-knapp--pa' : '') }) +
        knapp('reakt', 'vm-reakt', 'Reagera', { aria: 'Reaktioner', klass: 'vm-k-extra', meny: true }) +
        knapp('mer', 'vm-mer', 'Mer', { aria: 'Fler alternativ', meny: true }) +
        '<div class="vm-delad vm-delad--lamna">' + knapp('lamna', 'vm-lamna', S.lamnaKlick ? 'Klicka igen för att lämna' : 'Lämna', { aria: 'Lämna mötet (Ctrl+Shift+H)', klass: 'vm-knapp--lamna' }) + (vard ? pil('meny-lamna', 'Fler sätt att avsluta') : '') + '</div>' +
      '</div>' +
      '<div class="vm-kontroller__hoger">' +
        knapp('chatt', 'vm-chatt', 'Chatt', { aria: 'Chatt i mötet (Ctrl+Alt+C)', panel: 'chatt', pressed: S.panel === 'chatt', bricka: S.olasta ? String(S.olasta > 9 ? '9+' : S.olasta) : '', klass: 'vm-k-extra' }) +
        knapp('deltagare', 'vm-deltagare', 'Personer', { aria: 'Deltagare, ' + antalD + ' i mötet' + (S.vantande.length ? ', ' + S.vantande.length + ' väntar' : '') + ' (Ctrl+Alt+P)', panel: 'deltagare', pressed: S.panel === 'deltagare', bricka: S.vantande.length ? String(S.vantande.length) : '', klass: 'vm-k-extra' + (S.vantande.length ? ' vm-knapp--vantar' : '') }) +
        knapp('anslutning', 'vm-info', 'Info', { aria: 'Mötesinfo och anslutning', panel: 'anslutning', pressed: S.panel === 'anslutning', klass: 'vm-k-extra' }) +
      '</div>';
    tickTid();
  }

  /* ---------- Förhandsvisning och väntrum ---------- */
  function rubrikHtml() {
    var m = S.mote, t = nar(m), d = (m.deltagare || []).map(function (x) { return x.namn + (x.typ === 'gast' ? ' (gäst)' : ''); }).filter(Boolean);
    return '<p class="vm-overrubrik">' + ik('vm-kam') + '<span>Videomöte</span></p>' +
      '<h2 class="vm-rubrik" id="vm-rubrik">' + e(m.titel || 'Videomöte') + '</h2>' +
      '<p class="vm-under">' + e([t, m.vardNamn && S.roll === 'gast' ? 'värd: ' + m.vardNamn : ''].filter(Boolean).join(' · ')) + '</p>' +
      (d.length && S.roll !== 'gast' ? '<p class="vm-under vm-under--deltagare">' + ik('vm-deltagare') + '<span>' + e(d.join(', ')) + '</span></p>' : '');
  }
  function felHtml(f) {
    var kod = f.kod || 'okand';
    var T = {
      nekad: ['Webbläsaren har blockerat kameran', 'Klicka på kamerasymbolen i adressfältet och välj Tillåt. Klicka sedan på Försök igen.'],
      saknas: ['Ingen kamera hittades', 'Du kan gå med med bara ljud.'],
      upptagen: ['Kameran används av ett annat program', 'Stäng det och klicka på Försök igen.'],
      osaker: ['Videomöten kräver en säker anslutning (https)', 'Öppna länken med https:// i början.'],
      motor: ['Videomotorn är inte laddad', 'Ladda om sidan. Hjälper det inte, be den som bjöd in dig om en ny länk.']
    }[kod] || ['Kameran kunde inte startas', f.text || 'Försök igen, eller gå med utan kamera.'];
    return '<div class="vm-fel" data-kod="' + e(kod) + '" role="alert">' + ik(kod === 'saknas' ? 'vm-kam-av' : 'vm-info') +
      '<div><b>' + e(T[0]) + '</b><p>' + e(T[1]) + '</p>' +
      '<div class="vm-fel__knappar">' + (kod !== 'osaker' && kod !== 'motor' ? '<button type="button" class="vm-sek" data-vm="media-start">Försök igen</button>' : '') +
      (kod !== 'motor' ? '<button type="button" class="vm-lank-knapp" data-vm="utan-kamera">Gå med utan kamera</button>' : '') + '</div></div></div>';
  }
  function enhetSelect(typ, lista, vald, etikett, extra) {
    if (!lista || !lista.length) return '';
    return '<label class="vm-falt"><span>' + e(etikett) + '</span><span class="vm-falt__rad"><select data-vm-enhet="' + typ + '">' +
      lista.map(function (x, i) { return '<option value="' + e(x.id) + '"' + (x.id === vald ? ' selected' : '') + '>' + e(x.namn || (etikett + ' ' + (i + 1))) + '</option>'; }).join('') +
      '</select>' + (extra || '') + '</span></label>';
  }
  function ritaForhandVaxlar() {
    var v = S.el.querySelector('.vm-forhand__vaxlar'), j = tillstand().jag || {};
    var harMedia = S.media === 'pa';
    var mik = harMedia && j.mik !== false, kam = harMedia && j.kam !== false && !S.utanKamera;
    v.innerHTML = harMedia ?
      '<button type="button" class="vm-knapp vm-knapp--rund' + (mik ? '' : ' vm-knapp--av') + '" data-vm="mik" aria-pressed="' + !mik + '" aria-label="' + (mik ? 'Stäng av mikrofonen' : 'Slå på mikrofonen') + '"' + (GAST ? ' title="' + (mik ? 'Stäng av mikrofonen' : 'Slå på mikrofonen') + '"' : '') + '>' + ik(mik ? 'vm-mik' : 'vm-mik-av') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--rund' + (kam ? '' : ' vm-knapp--av') + '" data-vm="kam" aria-pressed="' + !kam + '" aria-label="' + (kam ? 'Stäng av kameran' : 'Slå på kameran') + '"' + (GAST ? ' title="' + (kam ? 'Stäng av kameran' : 'Slå på kameran') + '"' : '') + '>' + ik(kam ? 'vm-kam' : 'vm-kam-av') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--rund vm-knapp--text" data-vm="oppna-bakgrund" aria-label="Bakgrund och effekter"' + (kam ? '' : ' disabled') + '>' + ik('vm-bakgrund') + '<span>Bakgrund</span></button>' +
      '<button type="button" class="vm-knapp vm-knapp--rund" data-vm="oppna-install" aria-label="Inställningar för ljud och bild"' + (GAST ? ' title="Inställningar för ljud och bild"' : '') + '>' + ik('vm-install') + '</button>' : '';
    S.el.querySelector('.vm-forhand__bild').toggleAttribute('data-kam-av', !kam);
  }
  function ritaForhand() {
    if (!S) return;
    var val = S.el.querySelector('.vm-forhand__val');
    var t = tillstand(), m = S.mote, gast = S.roll === 'gast';
    var html = '';
    ritaForhandVaxlar();
    if (S.fas === 'vantar' || S.fas === 'nekad') {
      var vardInne = t.vardNarvarande != null ? !!t.vardNarvarande : (t.deltagare || []).length > 0;
      var nekad = S.fas === 'nekad', tids = S.orsak === 'tidsgrans';
      html = '<div class="vm-vantar" role="status">' +
        (nekad ? '<span class="vm-vantar__ikon">' + ik(tids ? 'vm-info' : 'vm-stang') + '</span>' :
          '<span class="vm-vantar__ring" aria-hidden="true"><i></i><i></i><b>' + ik('vm-anvandare') + '</b></span>') +
        '<h2 class="vm-rubrik">' + (nekad ? (tids ? 'Ingen släppte in dig' : 'Du fick inte gå med i mötet') : t.last ? 'Mötet är låst' : 'Du väntar i väntrummet') + '</h2>' +
        '<p class="vm-under">' + e(nekad ? (tids ? 'Försök igen – värden kanske inte såg dig.' : 'Hör av dig till ' + fornamn(m.vardNamn) + ' om det blev fel.') :
          !vardInne ? 'Mötet har inte börjat än. Du kommer in när ' + fornamn(m.vardNamn) + ' ansluter.' :
          fornamn(m.vardNamn) + ' släpper in dig snart.') + '</p>' +
        '<p class="vm-vantar__mote">' + e(m.titel || 'Videomöte') + (nar(m) ? ' · ' + e(nar(m)) : '') + '</p>' +
        '<div class="vm-vantar__knappar">' + (nekad ? '<button type="button" class="vm-primar" data-vm="ga-med">' + (tids ? 'Be igen' : 'Försök igen') + '</button>' : '') +
        '<button type="button" class="vm-sek" data-vm="lamna-vantrum">' + (nekad ? 'Stäng' : 'Lämna väntrummet') + '</button></div>' +
        '</div><p class="vm-arlig">' + e(ARLIG) + '</p>';
      val.innerHTML = html;
      return;
    }
    html = rubrikHtml();
    if (!M()) {
      html += felHtml({ kod: 'motor' });
    } else if (S.media === 'fraga') {
      html += '<div class="vm-fraga">' + ik('vm-kam') + '<div><b>Vi behöver din kamera och mikrofon</b><p>Så att de andra ser och hör dig. Webbläsaren frågar om lov – välj Tillåt.</p></div></div>' +
        '<div class="vm-knapprad"><button type="button" class="vm-primar" data-vm="media-start">' + ik('vm-kam') + '<span>Slå på kamera och mikrofon</span></button>' +
        '<button type="button" class="vm-lank-knapp" data-vm="utan-kamera">Gå med utan kamera</button></div>';
    } else if (S.media === 'startar') {
      html += '<div class="vm-fraga vm-fraga--laddar" role="status"><span class="vm-snurr" aria-hidden="true"></span><div><b>Startar kameran …</b><p>Välj Tillåt om webbläsaren frågar.</p></div></div>';
    } else if (S.mediaFel) {
      html += felHtml(S.mediaFel);
    }
    if (S.media === 'pa' || S.media === 'ingen' || S.mediaFel) {
      if (gast) {
        html += '<label class="vm-falt vm-falt--namn"><span>Ditt namn</span><input type="text" data-vm-namn maxlength="60" autocomplete="name" value="' + e(S.jag.namn) + '" placeholder="Förnamn och efternamn" aria-describedby="vm-namn-hjalp"></label>' +
          '<p class="vm-hjalp" id="vm-namn-hjalp"' + (S.jag.namn.trim() ? ' hidden' : '') + '>Skriv ditt namn så att värden vet vem du är.</p>';
      }
      if (S.media === 'pa') {
        var I = inst(), en = S.enheter, sink = stod().sinkId;
        html += '<div class="vm-enheter">' +
          enhetSelect('kamera', en.kameror, I.kamera, 'Kamera') +
          enhetSelect('mikrofon', en.mikrofoner, I.mikrofon, 'Mikrofon', '<span class="vm-niva vm-niva--liten" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>') +
          (sink ? enhetSelect('hogtalare', en.hogtalare, I.hogtalare, 'Högtalare', '<button type="button" class="vm-sek vm-sek--liten" data-vm="testa-ton">' + ik('vm-hogtalare') + '<span>Testa</span></button>') : '') +
          '</div>' +
          (stod().mediaRecorder === false ? '' : '<button type="button" class="vm-lank-knapp vm-test-knapp" data-vm="testa-inspelning">' + ik('vm-kam') + '<span>Testa ljud och bild</span></button>');
      }
      var namnSaknas = gast && !S.jag.namn.trim();
      html += '<div class="vm-knapprad vm-knapprad--ga">' +
        '<button type="button" class="vm-primar vm-primar--stor" data-vm="ga-med"' + (namnSaknas ? ' disabled aria-describedby="vm-namn-hjalp"' : '') + '>' +
        (gast && t.vantrum !== false && m.vantrum !== false ? 'Be att få gå med' : 'Gå med nu') + '</button>' +
        (gast ? '' : '<button type="button" class="vm-sek" data-vm="avbryt">Avbryt</button>') + '</div>';
      if (!gast && S.roll === 'vard' && (S.vantande.length)) html += '<p class="vm-vantar-rad">' + ik('vm-anvandare') + '<span>' + e(S.vantande.length === 1 ? (S.vantande[0].namn || 'En gäst') + ' väntar redan i väntrummet' : S.vantande.length + ' väntar redan i väntrummet') + '</span></p>';
      if (gast) {
        var ll = (tillstand().ljudlage || 'dator');
        html += '<fieldset class="vm-ljudlage"><legend>Ljud</legend>' +
          '<label><input type="radio" name="vm-ljudlage" value="dator"' + (ll !== 'inget' ? ' checked' : '') + '><span>Datorljud</span></label>' +
          '<label><input type="radio" name="vm-ljudlage" value="inget"' + (ll === 'inget' ? ' checked' : '') + '><span>Inget ljud</span></label></fieldset>';
      }
      if (S.roll === 'vard') {
        html += '<details class="vm-motesinst"><summary>' + ik('vm-install') + '<span>Mötesinställningar</span>' + ik('vm-chevron', 'vm-ik--chevron') + '</summary>' +
          vaxel('vantrum', 'Gäster väntar i väntrummet', t.vantrum !== false && m.vantrum !== false, 'Du släpper in dem när du är redo.') +
          vaxel('las', 'Lås mötet', !!t.last, 'Ingen ny kan gå med, inte ens kollegor.') + '</details>';
      }
    }
    html += '<p class="vm-arlig">' + e(ARLIG) + '</p>';
    val.innerHTML = html;
  }
  function vaxel(namn, text, pa, hjalp, avstangd) {
    return '<label class="vm-brytare' + (avstangd ? ' vm-brytare--av' : '') + '"><input type="checkbox" role="switch" data-vm-brytare="' + namn + '"' + (pa ? ' checked' : '') + (avstangd ? ' disabled' : '') + '>' +
      '<span class="vm-brytare__spar" aria-hidden="true"></span><span class="vm-brytare__text">' + e(text) + (hjalp ? '<small>' + e(hjalp) + '</small>' : '') + '</span></label>';
  }

  /* ---------- Media ---------- */
  function startaMedia(video) {
    if (!M()) { S.media = 'ingen'; ritaForhand(); return Promise.resolve(); }
    var st = stod();
    if (st.media === false) { S.mediaFel = { kod: location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'saknas' : 'osaker' }; S.media = 'ingen'; ritaForhand(); return Promise.resolve(); }
    S.media = 'startar'; S.mediaFel = null; S.utanKamera = video === false;
    ritaForhand();
    return korP('startaMedia', { video: video !== false, ljud: true }).then(function () {
      if (!S) return;
      S.media = 'pa';
      kopplaEgen();
      return hamtaEnheter();
    }).catch(function (f) {
      if (!S) return;
      S.media = 'ingen';
      S.mediaFel = f && f.kod ? f : { kod: 'okand', text: f && f.message };
      // Saknas kamera men mikrofon finns: försök med bara ljud
      if (S.mediaFel.kod === 'saknas' && video !== false) return startaMedia(false).then(function () { if (S && S.media === 'pa') { S.mediaFel = { kod: 'saknas' }; } });
    }).then(function () { if (S) { ritaForhand(); fokusForhand(); } });
  }
  function fokusForhand() {
    if (!S || S.fas !== 'forhand' || S.mini) return;
    var a = D.activeElement;
    if (a && S.el.contains(a) && a !== D.body && a.isConnected) return;
    var f = S.el.querySelector('[data-vm-namn]') || S.el.querySelector('.vm-forhand__val .vm-primar:not([disabled])') || S.el.querySelector('.vm-forhand__val button');
    if (f) f.focus({ preventScroll: true });
  }
  function hamtaEnheter() {
    return korP('enheter').then(function (en) { if (S && en) S.enheter = en; }).catch(function () { /* */ });
  }
  function egenStrom() { return kor('forhandStrom') || null; }
  function kopplaEgen(tvinga) {
    if (!S) return;
    var s = egenStrom(), I = inst(), spegla = I.spegla !== false;
    S.el.querySelectorAll('video.vm-video--egen').forEach(function (v) {
      if (v.hasAttribute('data-test')) return;
      v.setAttribute('data-vm-egen', '1');
      if (tvinga === true && v.srcObject === s) v.srcObject = null;
      if (v.srcObject !== s) { v.srcObject = s; if (s) spela(v); }
      v.toggleAttribute('data-spegla', spegla);
    });
    var mv = S.el.querySelector('.vm-mini video[data-egen]');
    if (mv && mv.srcObject !== s) { mv.srcObject = s; if (s) spela(mv); }
  }
  function spela(v) { try { var p = v.play(); if (p && p.catch) p.catch(function () { /* autoplay – försöker igen vid nästa klick */ }); } catch (err) { /* */ } }
  function harVideo(strom) {
    if (!strom || !strom.getVideoTracks) return false;
    return strom.getVideoTracks().some(function (t) { return t.readyState === 'live' && t.enabled !== false; });
  }

  /* ---------- Rutor ---------- */
  function rutaNyckel(peer, typ) { return peer + ':' + (typ || 'kamera'); }
  function skapaRuta(peer, typ) {
    var a = D.createElement('article');
    a.className = 'vm-ruta vm-ruta--ny';
    a.setAttribute('data-peer', peer);
    a.setAttribute('data-typ', typ);
    a.setAttribute('role', 'group');
    a.setAttribute('tabindex', '-1');
    a.innerHTML = '<video class="vm-video" autoplay playsinline muted></video>' +
      '<div class="vm-ruta__initialer"><span></span></div>' +
      '<div class="vm-ruta__namn"><span class="vm-ruta__namntext"></span><em class="vm-ruta__marke" hidden></em></div>' +
      '<span class="vm-ruta__mik" hidden>' + ik('vm-mik-av') + '</span>' +
      '<span class="vm-ruta__hand" hidden>' + ik('vm-hand') + '<b></b></span>' +
      '<span class="vm-ruta__fast" hidden>' + ik('vm-fast') + '</span>' +
      '<span class="vm-natverk vm-natverk--ruta" hidden><i></i><i></i><i></i><i></i></span>' +
      '<span class="vm-ruta__reakt" hidden></span>' +
      (typ === 'kamera' ? '<button type="button" class="vm-ruta__mer" data-vm="meny-ruta" aria-haspopup="menu" aria-expanded="false" aria-label="Fler val">' + ik('vm-mer') + '</button>' : '');
    setTimeout(function () { a.classList.remove('vm-ruta--ny'); }, 400);
    return a;
  }
  function handPlats(peer) {
    var lista = [];
    var t = tillstand(), j = t.jag || {};
    S.deltagare.forEach(function (d) { if (d.hand) lista.push({ peer: d.peer, t: d.handTid || 0 }); });
    if (j.hand) lista.push({ peer: j.peer, t: j.handTid || 0 });
    lista.sort(function (a, b) { return a.t - b.t; });
    for (var i = 0; i < lista.length; i++) if (lista[i].peer === peer) return i + 1;
    return 0;
  }
  function uppdateraRuta(r, d, typ) {
    var namn = d.namn || 'Gäst';
    var strom = typ === 'skarm' ? (S.strom[d.peer] && S.strom[d.peer].skarm) || d.skarm : (S.strom[d.peer] && S.strom[d.peer].kamera) || d.kamera;
    var v = r.querySelector('video');
    if (v.srcObject !== (strom || null)) { v.srcObject = strom || null; if (strom) spela(v); }
    var taEmotLjud = inst().taEmot === 'ljud';
    var kamAv = typ === 'kamera' && (!d.kam || !harVideo(strom) || taEmotLjud);
    r.toggleAttribute('data-kam-av', kamAv);
    r.toggleAttribute('data-gast', !!(d.gast || d.roll === 'gast'));
    r.toggleAttribute('data-talar', typ === 'kamera' && !!d.talar && d.mik !== false);
    r.toggleAttribute('data-fast', S.fast === d.peer && typ === 'kamera');
    r.querySelector('.vm-ruta__initialer span').textContent = d.initialer || initialer(namn);
    r.querySelector('.vm-ruta__namntext').textContent = typ === 'skarm' ? namn + ' delar skärmen' : namn;
    var marke = r.querySelector('.vm-ruta__marke'), rt = typ === 'kamera' ? rollText(d) : '';
    marke.hidden = !rt; marke.textContent = rt;
    if (typ === 'kamera') {
      r.querySelector('.vm-ruta__mik').hidden = d.mik !== false;
      var hp = d.hand ? handPlats(d.peer) : 0, h = r.querySelector('.vm-ruta__hand');
      h.hidden = !d.hand; h.querySelector('b').textContent = hp ? String(hp) : '';
      r.querySelector('.vm-ruta__fast').hidden = S.fast !== d.peer;
      var n = S.natverk[d.peer], nv = r.querySelector('.vm-natverk');
      var niva = d.natverk || (n && n.niva) || null;
      nv.hidden = !(niva === 'varning' || niva === 'dalig');
      nv.setAttribute('data-niva', niva || 'bra');
    }
    var al = [typ === 'skarm' ? namn + ' delar skärmen' : namn];
    if (typ === 'kamera') {
      if (rt) al.push(rt.toLowerCase());
      if (d.mik === false) al.push('mikrofon av');
      if (kamAv) al.push('kamera av');
      if (d.hand) al.push('räcker upp handen');
      if (d.talar) al.push('talar');
      if (S.fast === d.peer) al.push('fäst');
    }
    r.setAttribute('aria-label', al.join(', '));
  }
  function ritaRutor() {
    if (!S || S.fas !== 'mote') return;
    var t = tillstand(), j = t.jag || {};
    var lista = S.deltagare.filter(function (d) { return d && d.peer && d.peer !== j.peer && !d.vantar; });
    var behov = {};
    lista.forEach(function (d) {
      behov[rutaNyckel(d.peer, 'kamera')] = { d: d, typ: 'kamera' };
      var sk = (S.strom[d.peer] && S.strom[d.peer].skarm) || d.skarm;
      if (sk && d.delar !== false) behov[rutaNyckel(d.peer, 'skarm')] = { d: d, typ: 'skarm' };
    });
    // ta bort rutor som inte behövs
    Object.keys(S.rutor).forEach(function (k) {
      if (!behov[k]) {
        var r = S.rutor[k]; delete S.rutor[k];
        if (lugnMq.matches || !r.animate) r.remove();
        else { r.classList.add('vm-ruta--ut'); setTimeout(function () { r.remove(); }, 200); }
      }
    });
    Object.keys(behov).forEach(function (k) {
      var b = behov[k];
      if (!S.rutor[k]) S.rutor[k] = skapaRuta(b.d.peer, b.typ);
      uppdateraRuta(S.rutor[k], b.d, b.typ);
    });
    // layout
    var skarmNyckel = Object.keys(behov).filter(function (k) { return behov[k].typ === 'skarm'; })[0];
    var fastNyckel = S.fast && behov[rutaNyckel(S.fast, 'kamera')] ? rutaNyckel(S.fast, 'kamera') : null;
    var layout = skarmNyckel ? 'delning' : fastNyckel ? 'talare' : S.layout;
    if (lista.length < 2 && layout === 'talare' && !fastNyckel) layout = 'galleri';
    S.el.setAttribute('data-layout', layout);
    var rutnat = S.el.querySelector('.vm-rutnat'), scenyta = S.el.querySelector('.vm-scenyta'), remsa = S.el.querySelector('.vm-remsa');
    var kameror = lista.map(function (d) { return rutaNyckel(d.peer, 'kamera'); });
    function flytta(el, foralder, index) {
      if (el.parentNode !== foralder || foralder.children[index] !== el) {
        foralder.insertBefore(el, foralder.children[index] || null);
        var v = el.querySelector('video'); if (v && v.srcObject) spela(v);
      }
    }
    if (layout === 'galleri') {
      kameror.forEach(function (k, i) { flytta(S.rutor[k], rutnat, i); });
      var n = kameror.length, smal = mobilMq.matches || innerWidth < innerHeight * 0.9;
      var kol = n <= 1 ? 1 : smal ? (n <= 2 ? 1 : 2) : n <= 4 ? 2 : 3;
      var rader = Math.ceil(n / kol) || 1;
      rutnat.style.setProperty('--vm-kol', String(kol));
      rutnat.style.setProperty('--vm-rader', String(rader));
      rutnat.setAttribute('data-antal', String(n));
    } else {
      var stor = skarmNyckel || fastNyckel || (S.talare && behov[rutaNyckel(S.talare, 'kamera')] ? rutaNyckel(S.talare, 'kamera') : kameror[0]);
      if (stor) flytta(S.rutor[stor], scenyta, 0);
      var i2 = 0;
      kameror.forEach(function (k) { if (k !== stor) flytta(S.rutor[k], remsa, i2++); });
      remsa.setAttribute('data-antal', String(i2));
    }
    // ensam i mötet
    var ensam = S.el.querySelector('.vm-ensam');
    ensam.hidden = lista.length > 0;
    if (!lista.length) {
      var vard = S.roll === 'vard';
      ensam.innerHTML = '<div class="vm-ensam__kort"><span class="vm-ensam__ikon">' + ik('vm-deltagare') + '</span>' +
        '<b>' + (S.vantande.length && vard ? e(antal(S.vantande.length, 'person väntar', 'personer väntar')) + ' i väntrummet' : 'Du är ensam i mötet just nu') + '</b>' +
        '<p>' + (S.vantande.length && vard ? 'Släpp in dem när du är redo.' : 'De andra syns här när de ansluter.') + '</p>' +
        '<div class="vm-ensam__knappar">' + (S.vantande.length && vard ? '<button type="button" class="vm-primar" data-vm="slapp-in-alla">Släpp in ' + (S.vantande.length === 1 ? e(fornamn(S.vantande[0].namn)) : 'alla') + '</button>' : '') +
        '<button type="button" class="vm-sek vm-sek--scen" data-vm="kopiera-lank">' + ik('vm-lank') + '<span>Kopiera möteslänk</span></button></div></div>';
    }
    ritaEgen();
    ritaDelar();
    ritaMini();
  }
  function ritaEgen() {
    var t = tillstand(), j = t.jag || {}, eg = S.el.querySelector('.vm-egen');
    var I = inst();
    eg.setAttribute('data-horn', I.egenHorn || S.horn || 'nh');
    eg.hidden = !!S.doljEgen;
    var kamAv = !j.kam || !harVideo(egenStrom());
    eg.toggleAttribute('data-kam-av', kamAv);
    eg.toggleAttribute('data-talar', !!j.talar);
    eg.querySelector('.vm-ruta__initialer span').textContent = S.jag.initialer || initialer(S.jag.namn);
    eg.querySelector('.vm-ruta__mik').hidden = j.mik !== false;
    eg.querySelector('.vm-ruta__namn span').textContent = j.delar ? 'Du (delar skärmen)' : j.hand ? 'Du · hand uppe' : 'Du';
    kopplaEgen();
  }
  function ritaDelar() {
    var t = tillstand(), j = t.jag || {}, b = S.el.querySelector('.vm-delar');
    var delare = null;
    S.deltagare.forEach(function (d) { if (d.delar) delare = d; });
    if (j.delar) {
      b.hidden = false;
      b.innerHTML = '<span class="vm-delar__prick" aria-hidden="true"></span><span>Du delar din skärm</span><button type="button" class="vm-delar__knapp" data-vm="sluta-dela">Sluta dela</button>';
    } else if (delare) {
      b.hidden = false;
      b.innerHTML = '<span class="vm-delar__prick" aria-hidden="true"></span><span>' + e(fornamn(delare.namn)) + ' delar sin skärm</span>';
    } else b.hidden = true;
  }

  /* ---------- Ljud från de andra (dolda audio-element) ---------- */
  function ritaLjud() {
    if (!S) return;
    var yta = S.el.querySelector('.vm-ljud'), behov = {};
    if (S.fas === 'mote') {
      Object.keys(S.strom).forEach(function (peer) {
        ['kamera', 'skarm'].forEach(function (typ) {
          var s = S.strom[peer][typ];
          if (s && s.getAudioTracks && s.getAudioTracks().length) behov[peer + ':' + typ] = s;
        });
      });
    }
    Object.keys(S.ljud).forEach(function (k) { if (!behov[k]) { S.ljud[k].srcObject = null; S.ljud[k].remove(); delete S.ljud[k]; } });
    Object.keys(behov).forEach(function (k) {
      var a = S.ljud[k];
      if (!a) { a = D.createElement('audio'); a.autoplay = true; a.setAttribute('data-nyckel', k); yta.appendChild(a); S.ljud[k] = a; kor('kopplaHogtalare', a); }
      if (a.srcObject !== behov[k]) { a.srcObject = behov[k]; spela(a); }
      a.muted = tillstand().ljudlage === 'inget';
    });
  }

  /* ---------- Topp och tid ---------- */
  function tickTid() {
    if (!S || !S.el) return;
    var nu = new Date();
    var k = S.el.querySelector('.vm-topp__klocka');
    if (k) { k.textContent = klock(nu); k.setAttribute('datetime', nu.toISOString()); }
    var tid = S.inTid ? langd((Date.now() - S.inTid) / 1000) : '';
    var tt = S.el.querySelector('.vm-topp__tid'); if (tt) tt.textContent = tid;
    tickTidRec();
    var kt = S.el.querySelector('.vm-kontroller__tid'); if (kt) kt.textContent = tid;
    var mt = S.el.querySelector('.vm-mini__tid'); if (mt) mt.textContent = tid;
  }
  function ritaTopp() {
    var t = tillstand();
    S.el.querySelector('.vm-topp__titel').textContent = S.mote.titel || 'Videomöte';
    S.el.querySelector('.vm-topp__las').hidden = !t.last;
    ritaInspelning();
    var hel = !!D.fullscreenElement;
    var hk = S.el.querySelector('[data-vm="helskarm"]');
    if (hk) { hk.innerHTML = ik(hel ? 'vm-helskarm-ut' : 'vm-helskarm'); hk.setAttribute('aria-label', hel ? 'Lämna helskärm' : 'Helskärm'); }
    var samlad = (S.natverkJag && S.natverkJag.niva) || 'bra';
    var nv = S.el.querySelector('.vm-topp .vm-natverk');
    nv.setAttribute('data-niva', samlad);
    nv.setAttribute('title', { bra: 'Anslutningen är bra', varning: 'Anslutningen är ojämn', dalig: 'Anslutningen är svag' }[samlad]);
    tickTid();
  }

  /* ---------- Minimerat läge ---------- */
  function ritaMini() {
    if (!S) return;
    var mini = S.el.querySelector('.vm-mini');
    mini.hidden = !(S.mini && S.fas === 'mote');
    if (mini.hidden) { var v0 = mini.querySelector('video'); if (v0) v0.srcObject = null; return; }
    var t = tillstand(), j = t.jag || {};
    var visa = null;
    var lista = S.deltagare.filter(function (d) { return d.peer !== j.peer && !d.vantar; });
    lista.forEach(function (d) { if (d.delar && S.strom[d.peer] && S.strom[d.peer].skarm) visa = { d: d, s: S.strom[d.peer].skarm, skarm: true }; });
    if (!visa) {
      var tal = lista.filter(function (d) { return d.peer === (S.fast || S.talare); })[0] || lista[0];
      if (tal) visa = { d: tal, s: S.strom[tal.peer] && S.strom[tal.peer].kamera };
    }
    if (!mini.firstChild) {
      mini.innerHTML = '<div class="vm-mini__bild"><video class="vm-video" autoplay playsinline muted></video><div class="vm-ruta__initialer"><span></span></div></div>' +
        '<div class="vm-mini__info"><b class="vm-mini__namn"></b><span class="vm-mini__tid"></span><span class="vm-mini__vantar" hidden></span></div>' +
        '<div class="vm-mini__knappar"></div>';
    }
    mini.setAttribute('data-horn', S.miniHorn || 'nh');
    var v = mini.querySelector('video'), egen = !visa;
    var strom = visa ? visa.s : egenStrom();
    if (v.srcObject !== (strom || null)) { v.srcObject = strom || null; if (strom) spela(v); }
    v.toggleAttribute('data-egen', egen);
    v.toggleAttribute('data-spegla', egen && inst().spegla !== false);
    var kamAv = visa ? (!visa.skarm && (!visa.d.kam || !harVideo(strom))) : (!j.kam || !harVideo(strom));
    mini.toggleAttribute('data-kam-av', kamAv);
    mini.toggleAttribute('data-talar', !!(visa && visa.d.talar));
    mini.querySelector('.vm-ruta__initialer span').textContent = visa ? (visa.d.initialer || initialer(visa.d.namn)) : S.jag.initialer;
    mini.querySelector('.vm-mini__namn').textContent = visa ? (visa.skarm ? fornamn(visa.d.namn) + ' delar skärmen' : visa.d.namn) : 'Du är ensam i mötet';
    var vt = mini.querySelector('.vm-mini__vantar');
    vt.hidden = !(S.roll === 'vard' && S.vantande.length);
    vt.textContent = S.vantande.length ? antal(S.vantande.length, 'väntar', 'väntar') : '';
    var mik = !!j.mik, kam = !!j.kam;
    mini.querySelector('.vm-mini__knappar').innerHTML =
      '<button type="button" class="vm-knapp vm-knapp--liten' + (mik ? '' : ' vm-knapp--av') + '" data-vm="mik" aria-pressed="' + !mik + '" aria-label="' + (mik ? 'Stäng av mikrofonen' : 'Slå på mikrofonen') + '">' + ik(mik ? 'vm-mik' : 'vm-mik-av') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--liten' + (kam ? '' : ' vm-knapp--av') + '" data-vm="kam" aria-pressed="' + !kam + '" aria-label="' + (kam ? 'Stäng av kameran' : 'Slå på kameran') + '">' + ik(kam ? 'vm-kam' : 'vm-kam-av') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--liten" data-vm="flytta-mini" aria-label="Flytta rutan till nästa hörn">' + ik('vm-flytta') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--liten vm-knapp--tillbaka" data-vm="tillbaka" aria-label="Tillbaka till mötet">' + ik('vm-helskarm') + '</button>' +
      '<button type="button" class="vm-knapp vm-knapp--liten vm-knapp--lamna" data-vm="lamna-direkt" aria-label="Lämna mötet">' + ik('vm-lamna') + '</button>';
    tickTid();
  }

  /* ---------- Aviseringar i scenen ---------- */
  function avis(opt) {
    if (!S) return null;
    var yta = S.el.querySelector('.vm-avisering-yta');
    if (opt.nyckel) { var g = yta.querySelector('[data-nyckel="' + opt.nyckel + '"]'); if (g) g.remove(); }
    var a = D.createElement('div');
    a.className = 'vm-avis' + (opt.typ ? ' vm-avis--' + opt.typ : '');
    a.setAttribute('role', 'status');
    if (opt.nyckel) a.setAttribute('data-nyckel', opt.nyckel);
    a.innerHTML = (opt.ikon ? '<span class="vm-avis__ikon">' + ik(opt.ikon) + '</span>' : '') + '<div class="vm-avis__text">' + opt.text + '</div>' +
      (opt.knappar ? '<div class="vm-avis__knappar">' + opt.knappar + '</div>' : '') +
      '<button type="button" class="vm-avis__stang" data-vm="stang-avis" aria-label="Stäng">' + ik('vm-stang') + '</button>';
    yta.appendChild(a);
    while (yta.children.length > 3) yta.firstChild.remove();
    if (opt.tid) setTimeout(function () { stangAvis(a); }, opt.tid);
    return a;
  }
  function annanDelar() {
    var t = tillstand() || {}, j = t.jag || {};
    if (t.delare != null) return !!t.delare && t.delare !== j.peer;
    return (t.deltagare || []).some(function (x) { return x.peer !== j.peer && (x.delar || x.skarm); });
  }
  function stangTaOver(peer) {
    if (!S) return;
    var a = S.el.querySelector('.vm-avisering-yta [data-nyckel="taover"]');
    if (!a) return;
    var ap = a.getAttribute('data-peer');
    if (!peer || !ap || ap === peer) { S.taOver = false; stangAvis(a); }
  }
  function stangAvis(a) {
    if (!a || !a.isConnected) return;
    if (lugnMq.matches) { a.remove(); return; }
    a.classList.add('vm-avis--ut');
    setTimeout(function () { a.remove(); }, 200);
  }

  /* ---------- Reaktioner ---------- */
  var REAKT = [['gilla', 'Gilla'], ['hjarta', 'Hjärta'], ['applad', 'Applåd'], ['skratt', 'Skratt'], ['forvanad', 'Förvånad']];
  function visaReaktion(peer, typ) {
    if (!S || S.fas !== 'mote') return;
    var namn = 'vm-r-' + typ;
    if (!IKONER[namn]) return;
    var t = tillstand(), j = t.jag || {};
    var mal = peer === j.peer ? S.el.querySelector('.vm-egen') : S.rutor[rutaNyckel(peer, 'kamera')];
    if (lugnMq.matches) {
      if (!mal) return;
      var b = mal.querySelector('.vm-ruta__reakt') || null;
      if (!b) { b = D.createElement('span'); b.className = 'vm-ruta__reakt'; mal.appendChild(b); }
      b.hidden = false; b.innerHTML = ik(namn);
      clearTimeout(b._t); b._t = setTimeout(function () { b.hidden = true; }, 3000);
      return;
    }
    var yta = S.el.querySelector('.vm-reaktioner'), scen = S.el.querySelector('.vm-scen').getBoundingClientRect();
    if (yta.children.length >= 6) yta.firstChild.remove();
    var x = scen.width / 2, y = scen.height - 120;
    if (mal && !mal.hidden) { var r = mal.getBoundingClientRect(); x = r.left - scen.left + r.width / 2; y = r.bottom - scen.top - 30; }
    var s = D.createElement('span');
    s.className = 'vm-reaktion vm-reaktion--' + typ;
    s.style.left = Math.round(x + (Math.random() * 40 - 20)) + 'px';
    s.style.top = Math.round(y) + 'px';
    s.innerHTML = ik(namn);
    yta.appendChild(s);
    setTimeout(function () { s.remove(); }, 2500);
  }

  /* ---------- Menyer (popover) ---------- */
  function menyRad(vm, ikon, text, opt) {
    opt = opt || {};
    return '<button type="button" role="' + (opt.check != null ? 'menuitemcheckbox' : 'menuitem') + '" class="vm-meny__rad' + (opt.klass ? ' ' + opt.klass : '') + '" data-vm="' + vm + '"' +
      (opt.data ? ' ' + opt.data : '') + (opt.check != null ? ' aria-checked="' + !!opt.check + '"' : '') + (opt.av ? ' disabled' : '') + '>' +
      (ikon ? ik(ikon) : '<span class="vm-ik"></span>') + '<span class="vm-meny__text">' + e(text) + (opt.under ? '<small>' + e(opt.under) + '</small>' : '') + '</span>' +
      (opt.check ? ik('vm-bock', 'vm-meny__bock') : '') + (opt.tangent ? '<kbd>' + e(opt.tangent) + '</kbd>' : '') + '</button>';
  }
  function oppnaMeny(typ, knappEl, data) {
    if (!S) return;
    if (S.meny && S.meny.typ === typ && S.meny.data === data) { stangMeny(true); return; }
    stangMeny(false);
    var t = tillstand(), j = t.jag || {}, I = inst(), en = S.enheter, vard = S.roll === 'vard';
    var h = '', rubrik = '';
    if (typ === 'meny-mik') {
      rubrik = 'Mikrofon';
      h += '<p class="vm-meny__rubrik">Mikrofon</p>' + (en.mikrofoner || []).map(function (x) { return menyRad('valj-enhet', null, x.namn || 'Mikrofon', { check: x.id === I.mikrofon, data: 'data-typ="mikrofon" data-id="' + e(x.id) + '"' }); }).join('');
      if (stod().sinkId && en.hogtalare && en.hogtalare.length) h += '<p class="vm-meny__rubrik">Högtalare</p>' + en.hogtalare.map(function (x) { return menyRad('valj-enhet', null, x.namn || 'Högtalare', { check: x.id === I.hogtalare, data: 'data-typ="hogtalare" data-id="' + e(x.id) + '"' }); }).join('');
      h += '<hr>' + menyRad('oppna-install', 'vm-install', 'Ljudinställningar');
    } else if (typ === 'meny-kam') {
      rubrik = 'Kamera';
      h += '<p class="vm-meny__rubrik">Kamera</p>' + (en.kameror || []).map(function (x) { return menyRad('valj-enhet', null, x.namn || 'Kamera', { check: x.id === I.kamera, data: 'data-typ="kamera" data-id="' + e(x.id) + '"' }); }).join('');
      h += '<hr>' + menyRad('oppna-bakgrund', 'vm-bakgrund', 'Bakgrund och effekter') + menyRad('oppna-kvalitet', 'vm-install', 'Videoinställningar');
    } else if (typ === 'dela') {
      rubrik = 'Dela';
      h += '<p class="vm-meny__rubrik">Dela skärm</p>' +
        menyRad('dela-text', 'vm-dela', 'Skärm, fönster eller flik', { under: 'Skarpast för ritningar, offerter och text' }) +
        menyRad('dela-video', 'vm-kam', 'Video med ljud', { under: 'Mjukast rörelse, ljudet följer med' });
    } else if (typ === 'reakt') {
      rubrik = 'Reaktioner';
      h += '<div class="vm-meny__reakt">' + REAKT.map(function (r) { return '<button type="button" role="menuitem" class="vm-reakt-knapp vm-reakt-knapp--' + r[0] + '" data-vm="reaktion" data-typ="' + r[0] + '" aria-label="' + r[1] + '"' + (GAST ? ' title="' + r[1] + '"' : '') + '>' + ik('vm-r-' + r[0]) + '</button>'; }).join('') + '</div>';
    } else if (typ === 'mer') {
      rubrik = 'Mer';
      var st = stod();
      h += '<div class="vm-meny__mobil">' +
        (st.skarm === false ? '' : menyRad(j.delar ? 'sluta-dela' : 'dela-text', j.delar ? 'vm-dela-av' : 'vm-dela', j.delar ? 'Sluta dela skärmen' : 'Dela skärm')) +
        menyRad('hand', 'vm-hand', j.hand ? 'Sänk handen' : 'Räck upp handen') +
        menyRad('panel', 'vm-chatt', 'Chatt i mötet' + (S.olasta ? ' (' + S.olasta + ' nya)' : ''), { data: 'data-panel="chatt"' }) +
        menyRad('panel', 'vm-deltagare', 'Deltagare' + (S.vantande.length ? ' (' + S.vantande.length + ' väntar)' : ''), { data: 'data-panel="deltagare"' }) +
        '<div class="vm-meny__reakt">' + REAKT.map(function (r) { return '<button type="button" role="menuitem" class="vm-reakt-knapp vm-reakt-knapp--' + r[0] + '" data-vm="reaktion" data-typ="' + r[0] + '" aria-label="' + r[1] + '">' + ik('vm-r-' + r[0]) + '</button>'; }).join('') + '</div><hr></div>' +
        menyRad('oppna-install', 'vm-install', 'Inställningar') +
        menyRad('oppna-bakgrund', 'vm-bakgrund', 'Bakgrund och effekter') +
        (S.roll !== 'gast' && inspelningKan() ? (S.inspelning.pa ? (S.inspelning.egen ? menyRad('inspelning-stopp', 'vm-rec', 'Sluta spela in', { klass: 'vm-meny__rad--fara', under: 'Filen sparas i den här webbläsaren' }) : menyRad('', 'vm-rec', (S.inspelning.av || 'Någon') + ' spelar in', { av: true })) : menyRad('meny-inspelning', 'vm-rec', 'Spela in', { under: 'Ljud, eller ljud och bild' })) : '') +
        '<hr><p class="vm-meny__rubrik">Layout</p>' +
        menyRad('layout', 'vm-galleri', 'Galleri', { check: S.layout === 'galleri' && !S.fast, data: 'data-layout="galleri"', under: 'Alla lika stora' }) +
        menyRad('layout', 'vm-talare', 'Talare', { check: S.layout === 'talare' || !!S.fast, data: 'data-layout="talare"', under: 'Den som pratar syns stort' }) +
        '<hr>' +
        menyRad('helskarm', D.fullscreenElement ? 'vm-helskarm-ut' : 'vm-helskarm', D.fullscreenElement ? 'Lämna helskärm' : 'Helskärm') +
        menyRad('dolj-egen', 'vm-anvandare', S.doljEgen ? 'Visa egen bild' : 'Dölj egen bild') +
        menyRad('kopiera-lank', 'vm-lank', 'Kopiera möteslänk') +
        menyRad('panel', 'vm-info', 'Mötesinfo och anslutning', { data: 'data-panel="anslutning"' }) +
        menyRad('panel', 'vm-tangent', 'Kortkommandon', { data: 'data-panel="kortkommandon"', tangent: 'Shift+?' }) +
        (vard ? '<hr>' + menyRad('las', t.last ? 'vm-las-upp' : 'vm-las', t.last ? 'Lås upp mötet' : 'Lås mötet', { under: t.last ? 'Nya kan knacka igen' : 'Ingen ny kan gå med' }) : '');
    } else if (typ === 'meny-inspelning') {
      rubrik = 'Spela in mötet';
      h += '<p class="vm-meny__rubrik">Spela in mötet</p>' +
        '<p class="vm-meny__info">' + ik('vm-info') + '<span>Alla i mötet ser att det spelas in. Fråga kunden om det är okej innan du startar.</span></p>' +
        menyRad('inspelning-start', 'vm-kam', 'Ljud och bild', { data: 'data-lage="bild"', under: 'Rutorna och den delade skärmen' }) +
        menyRad('inspelning-start', 'vm-mik', 'Bara ljud', { data: 'data-lage="ljud"', under: 'Mindre fil' }) +
        '<p class="vm-meny__fot">Prototyp – inspelningar sparas i den här webbläsaren.</p>';
    } else if (typ === 'meny-lamna') {
      rubrik = 'Lämna';
      h += menyRad('lamna-direkt', 'vm-lamna', 'Lämna mötet', { under: 'Mötet fortsätter för de andra' }) +
        menyRad('avsluta-alla', 'vm-stang', S.avslutaKlick ? 'Klicka igen för att avsluta för alla' : 'Avsluta för alla', { klass: 'vm-meny__rad--fara', under: 'Alla lämnar mötet' });
    } else if (typ === 'meny-ruta' || typ === 'meny-dlt') {
      var d = S.deltagare.filter(function (x) { return x.peer === data; })[0];
      if (!d) return;
      rubrik = d.namn;
      var gast = d.gast || d.roll === 'gast';
      h += '<p class="vm-meny__rubrik">' + e(d.namn) + '</p>' +
        menyRad('fast', 'vm-fast', S.fast === d.peer ? 'Lossa' : 'Fäst för mig', { data: 'data-peer="' + e(d.peer) + '"' });
      if (vard) {
        h += (d.mik !== false ? menyRad('be-tysta', 'vm-mik-av', 'Be om att stänga av mikrofonen', { data: 'data-peer="' + e(d.peer) + '"' }) : '') +
          (!gast && d.roll !== 'vard' ? menyRad('gor-vard', 'vm-anvandare', 'Gör till värd', { data: 'data-peer="' + e(d.peer) + '"' }) : '') +
          menyRad('ta-bort', 'vm-stang', S.taBortKlick === d.peer ? 'Klicka igen för att ta bort' : 'Ta bort från mötet', { data: 'data-peer="' + e(d.peer) + '"', klass: 'vm-meny__rad--fara' });
      }
    }
    var m = S.el.querySelector('.vm-meny');
    m.innerHTML = h;
    m.setAttribute('aria-label', rubrik);
    m.setAttribute('data-typ', typ);
    m.hidden = false;
    m.classList.toggle('vm-meny--ark', mobilMq.matches && (typ === 'mer' || typ === 'meny-mik' || typ === 'meny-kam' || typ === 'meny-lamna' || typ === 'meny-inspelning'));
    S.meny = { typ: typ, knapp: knappEl, data: data };
    if (knappEl) knappEl.setAttribute('aria-expanded', 'true');
    placeraMeny(m, knappEl);
    var forsta = m.querySelector('[role^="menuitem"]:not([disabled])');
    if (forsta) forsta.focus({ preventScroll: true });
  }
  function placeraMeny(m, knappEl) {
    // Knappen kan ha ritats om (t.ex. "Klicka igen …") – leta upp den nya, annars hamnar menyn i hörnet
    if (knappEl && !knappEl.isConnected) {
      var vmNamn = knappEl.getAttribute('data-vm');
      knappEl = vmNamn ? S.el.querySelector('.vm-kontroller [data-vm="' + vmNamn + '"], .vm-topp [data-vm="' + vmNamn + '"]') : null;
      if (S.meny) S.meny.knapp = knappEl;
    }
    if (m.classList.contains('vm-meny--ark') || !knappEl) { m.style.left = ''; m.style.top = ''; m.style.bottom = ''; return; }
    var r = knappEl.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    m.style.left = '0px'; m.style.top = '0px'; m.style.bottom = '';
    var mw = m.offsetWidth, mh = m.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - mw / 2), vw - mw - 8);
    var y = r.top - mh - 10;
    if (y < 8) y = Math.min(r.bottom + 10, vh - mh - 8);
    m.style.left = Math.round(x) + 'px';
    m.style.top = Math.round(Math.max(8, y)) + 'px';
    m.style.setProperty('--vm-ursprung', (r.top > y ? '50% 100%' : '50% 0%'));
  }
  function stangMeny(fokusTillbaka) {
    if (!S || !S.meny) return;
    var m = S.el.querySelector('.vm-meny'), k = S.meny.knapp;
    m.hidden = true; m.innerHTML = '';
    if (k && k.isConnected) { k.setAttribute('aria-expanded', 'false'); if (fokusTillbaka) k.focus({ preventScroll: true }); }
    S.meny = null;
  }

  /* ---------- Paneler ---------- */
  var PANEL_TITEL = { chatt: 'Chatt i mötet', deltagare: 'Deltagare', installningar: 'Inställningar', anslutning: 'Mötesinfo och anslutning', kortkommandon: 'Kortkommandon' };
  function oppnaPanel(namn, flik) {
    if (!S) return;
    if (!PANEL_TITEL[namn]) return;
    if (S.panel === namn && !flik) { stangPanel(); return; }
    stangMeny(false);
    var forra = S.panel;
    S.panel = namn;
    if (flik) S.flik = flik;
    if (namn === 'chatt') S.olasta = 0;
    S.panelFokus = S.panelFokus && forra ? S.panelFokus : D.activeElement;
    S.el.setAttribute('data-panel', namn);
    ritaPanel(true);
    if (S.fas === 'mote') ritaKontroller();
    var p = S.el.querySelector('.vm-panel');
    p.hidden = false;
    setTimeout(function () {
      var f = namn === 'chatt' ? p.querySelector('.vm-chatt__falt textarea') : p.querySelector('.vm-panel__kropp button, .vm-panel__kropp input, .vm-panel__kropp select, .vm-panel__huvud button');
      if (f) f.focus({ preventScroll: true });
      if (namn === 'chatt') { var l = p.querySelector('.vm-chatt__lista'); if (l) l.scrollTop = l.scrollHeight; }
    }, 30);
  }
  function stangPanel() {
    if (!S || !S.panel) return;
    S.panel = null;
    S.el.removeAttribute('data-panel');
    var p = S.el.querySelector('.vm-panel');
    p.hidden = true; p.innerHTML = '';
    if (S.fas === 'mote') ritaKontroller();
    var f = S.panelFokus; S.panelFokus = null;
    if (f && f.isConnected && S.el.contains(f)) f.focus({ preventScroll: true });
    else { var k = S.el.querySelector('.vm-kontroller [data-vm="mer"]') || S.el.querySelector('.vm-forhand__val button'); if (k) k.focus({ preventScroll: true }); }
  }
  function ritaPanel(forsta) {
    if (!S || !S.panel) return;
    var p = S.el.querySelector('.vm-panel'), namn = S.panel;
    var kropp = { chatt: panelChatt, deltagare: panelDeltagare, installningar: panelInstallningar, anslutning: panelAnslutning, kortkommandon: panelKortkommandon }[namn]();
    // Behåll det man skriver i chatten när panelen ritas om
    var utkast = null, fokusVm = null;
    var ta = p.querySelector('.vm-chatt__falt textarea'); if (ta) utkast = ta.value;
    var a = D.activeElement; if (a && p.contains(a)) fokusVm = a.getAttribute('data-vm') || a.getAttribute('data-vm-inst') || a.getAttribute('data-vm-enhet') || (a.tagName === 'TEXTAREA' ? 'ta' : null);
    var scroll = p.querySelector('.vm-panel__kropp'); var st = scroll ? scroll.scrollTop : 0;
    p.innerHTML = '<header class="vm-panel__huvud"><h2 id="vm-panel-rubrik">' + e(PANEL_TITEL[namn]) + '</h2>' +
      '<button type="button" class="vm-knapp vm-knapp--liten vm-panel__stang" data-vm="stang-panel" aria-label="Stäng panelen (Esc)">' + ik('vm-stang') + '</button></header>' +
      '<div class="vm-panel__kropp" data-panel-namn="' + namn + '">' + kropp + '</div>';
    if (namn === 'chatt') {
      var nyTa = p.querySelector('.vm-chatt__falt textarea');
      if (utkast != null && nyTa) nyTa.value = utkast;
      var l = p.querySelector('.vm-chatt__lista'); if (l) l.scrollTop = l.scrollHeight;
    } else if (!forsta) { var ns = p.querySelector('.vm-panel__kropp'); if (ns) ns.scrollTop = st; }
    if (fokusVm && !forsta) {
      var f = fokusVm === 'ta' ? p.querySelector('textarea') : p.querySelector('[data-vm="' + fokusVm + '"], [data-vm-inst="' + fokusVm + '"], [data-vm-enhet="' + fokusVm + '"]');
      if (f) f.focus({ preventScroll: true });
    }
    if (namn === 'installningar') kopplaInstallningsTest();
  }
  function panelChatt() {
    var lista = S.chatt.length ? S.chatt.map(function (m, i) {
      if (m.system) return '<p class="vm-chatt__system">' + ik(m.ikon || 'vm-info') + '<span>' + e(m.text) + '</span><time>' + klock(new Date(m.tid)) + '</time></p>';
      var forra = S.chatt[i - 1], fort = forra && !forra.system && forra.peer === m.peer && (m.tid - forra.tid) < 120000;
      return '<div class="vm-chatt__rad' + (m.egen ? ' vm-chatt__rad--egen' : '') + (fort ? ' vm-chatt__rad--fort' : '') + '">' +
        (fort ? '' : '<p class="vm-chatt__vem"><b>' + e(m.egen ? 'Du' : m.namn) + '</b><time>' + klock(new Date(m.tid)) + '</time></p>') +
        '<p class="vm-chatt__bubbla">' + e(m.text) + '</p></div>';
    }).join('') : '<div class="vm-tomt">' + ik('vm-chatt') + '<b>Inga meddelanden än</b><p>Det du skriver här ser alla i mötet.' + (S.roll === 'gast' ? '' : ' Chatten sparas med mötets anteckning om du vill.') + '</p></div>';
    return '<div class="vm-chatt__lista" role="log" aria-live="polite" aria-label="Meddelanden i mötet">' + lista + '</div>' +
      '<form class="vm-chatt__falt" data-vm-form="chatt"><label class="sr-only" for="vm-chatt-text">Skriv ett meddelande</label>' +
      '<textarea id="vm-chatt-text" rows="1" maxlength="1000" placeholder="Skriv ett meddelande…" enterkeyhint="send"></textarea>' +
      '<button type="submit" class="vm-knapp vm-knapp--liten vm-chatt__skicka" aria-label="Skicka">' + ik('vm-skicka') + '</button></form>';
  }
  function dltRad(d, jag) {
    var gast = d.gast || d.roll === 'gast', rt = rollText(d);
    var hp = d.hand ? handPlats(d.peer) : 0;
    return '<li class="vm-dlt__rad"><span class="vm-dlt__av' + (gast ? ' vm-dlt__av--gast' : '') + '" aria-hidden="true">' + e(d.initialer || initialer(d.namn)) + '</span>' +
      '<span class="vm-dlt__namn"><b>' + e(d.namn || 'Gäst') + (jag ? ' (du)' : '') + '</b>' + (rt ? '<small>' + e(rt) + '</small>' : '') + '</span>' +
      '<span class="vm-dlt__status">' + (d.hand ? '<span class="vm-dlt__hand" title="Räcker upp handen">' + ik('vm-hand') + (hp ? '<b>' + hp + '</b>' : '') + '</span>' : '') +
      (d.delar ? '<span title="Delar skärmen">' + ik('vm-dela') + '</span>' : '') +
      '<span class="vm-dlt__mik' + (d.mik === false ? ' vm-dlt__mik--av' : '') + '" aria-label="' + (d.mik === false ? 'Mikrofon av' : 'Mikrofon på') + '">' + ik(d.mik === false ? 'vm-mik-av' : 'vm-mik') + '</span></span>' +
      (jag ? '<span class="vm-dlt__plats"></span>' : '<button type="button" class="vm-knapp vm-knapp--liten vm-dlt__mer" data-vm="meny-dlt" data-peer="' + e(d.peer) + '" aria-haspopup="menu" aria-expanded="false" aria-label="Fler val för ' + e(d.namn) + '">' + ik('vm-mer') + '</button>') + '</li>';
  }
  function panelDeltagare() {
    var t = tillstand(), j = t.jag || {}, vard = S.roll === 'vard', h = '';
    if (S.vantande.length) {
      h += '<section class="vm-dlt__grupp vm-dlt__grupp--vantar"><header><h3>Väntar (' + S.vantande.length + ')</h3>' + (vard && S.vantande.length > 1 ? '<button type="button" class="vm-sek vm-sek--liten" data-vm="slapp-in-alla">Släpp in alla</button>' : '') + '</header><ul>' +
        S.vantande.map(function (v) {
          return '<li class="vm-dlt__rad"><span class="vm-dlt__av vm-dlt__av--gast" aria-hidden="true">' + e(initialer(v.namn)) + '</span>' +
            '<span class="vm-dlt__namn"><b>' + e(v.namn || 'Gäst') + '</b><small>' + (v.gast === false ? 'Kollega' : 'Gäst') + '</small></span>' +
            (vard ? '<span class="vm-dlt__val"><button type="button" class="vm-sek vm-sek--liten" data-vm="neka" data-peer="' + e(v.peer) + '">Neka</button><button type="button" class="vm-primar vm-primar--liten" data-vm="slapp-in" data-peer="' + e(v.peer) + '">Släpp in</button></span>' : '') + '</li>';
        }).join('') + '</ul></section>';
    }
    var inne = S.deltagare.filter(function (d) { return d.peer !== j.peer && !d.vantar; });
    var jagRad = { peer: j.peer, namn: S.jag.namn || 'Du', initialer: S.jag.initialer, roll: S.roll, gast: S.roll === 'gast', mik: j.mik, hand: j.hand, handTid: j.handTid, delar: j.delar };
    h += '<section class="vm-dlt__grupp"><header><h3>I mötet (' + (inne.length + 1) + ')</h3></header><ul>' + dltRad(jagRad, true) + inne.map(function (d) { return dltRad(d, false); }).join('') + '</ul></section>';
    h += '<button type="button" class="vm-sek vm-sek--bred" data-vm="kopiera-lank">' + ik('vm-lank') + '<span>Kopiera möteslänk</span></button>';
    if (vard) h += '<section class="vm-dlt__grupp vm-dlt__grupp--inst"><header><h3>Mötesinställningar</h3></header>' +
      vaxel('vantrum', 'Gäster väntar i väntrummet', t.vantrum !== false, 'Du släpper in dem själv.') +
      vaxel('las', 'Lås mötet', !!t.last, 'Ingen ny kan gå med, inte ens kollegor.') + '</section>';
    return h;
  }
  function radioRad(namn, varden, vald) {
    return '<div class="vm-segment" role="radiogroup">' + varden.map(function (v) {
      return '<label><input type="radio" name="vm-' + namn + '" data-vm-inst="' + namn + '" value="' + e(v[0]) + '"' + (String(vald) === String(v[0]) ? ' checked' : '') + '><span>' + e(v[1]) + '</span></label>';
    }).join('') + '</div>';
  }
  function stodText(v) { return v === 'stods-ej' ? '<small class="vm-install__stod">Stöds inte i den här webbläsaren</small>' : ''; }
  var BG_BILDER = [
    ['../images/foto/reglar.webp', 'Reglar'], ['../images/foto/dronare-bygget.webp', 'Bygget från ovan'],
    ['../images/hus-r1-800.webp', 'Hus 1'], ['../images/hus-r2-800.webp', 'Hus 2'], ['../images/hus-r4-800.webp', 'Hus 4'], ['ton', 'Legohus']
  ];
  function panelInstallningar() {
    var I = inst(), f = (S.faktiska && S.faktiska.bredd !== undefined ? S.faktiska : I.faktiska) || {}, en = S.enheter, st = stod(), j = tillstand().jag || {};
    var flikar = [['ljud', 'Ljud och bild'], ['bakgrund', 'Bakgrund'], ['kvalitet', 'Kvalitet']];
    var h = '<div class="vm-flikar" role="tablist" aria-label="Inställningar">' + flikar.map(function (fl) {
      return '<button type="button" role="tab" id="vm-flik-' + fl[0] + '" aria-controls="vm-flikyta" aria-selected="' + (S.flik === fl[0]) + '" tabindex="' + (S.flik === fl[0] ? '0' : '-1') + '" data-vm="flik" data-flik="' + fl[0] + '">' + e(fl[1]) + '</button>';
    }).join('') + '</div><div class="vm-flikyta" id="vm-flikyta" role="tabpanel" aria-labelledby="vm-flik-' + S.flik + '">';
    if (S.media !== 'pa' && S.flik !== 'kvalitet') {
      h += '<div class="vm-tomt">' + ik('vm-kam-av') + '<b>Kamera och mikrofon är inte på</b><p>Slå på dem för att välja enheter, bakgrund och effekter.</p><button type="button" class="vm-primar vm-primar--liten" data-vm="media-start">Slå på kamera och mikrofon</button></div></div>';
      return h;
    }
    if (S.flik === 'ljud') {
      h += '<section class="vm-install__grupp"><h3>Enheter</h3>' +
        enhetSelect('kamera', en.kameror, I.kamera, 'Kamera') +
        enhetSelect('mikrofon', en.mikrofoner, I.mikrofon, 'Mikrofon', '<span class="vm-niva vm-niva--liten" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>') +
        (st.sinkId ? enhetSelect('hogtalare', en.hogtalare, I.hogtalare, 'Högtalare', '<button type="button" class="vm-sek vm-sek--liten" data-vm="testa-ton">' + ik('vm-hogtalare') + '<span>Testa</span></button>') : '<p class="vm-install__not">Ljudet spelas i datorns förvalda högtalare.</p>') +
        (st.mediaRecorder === false ? '' : '<div class="vm-install__test"><button type="button" class="vm-sek" data-vm="testa-inspelning">' + ik('vm-kam') + '<span>Testa ljud och bild</span></button><small>Spelar in 5 sekunder och spelar upp dem för dig. Inget sparas.</small></div>') +
        '</section><section class="vm-install__grupp"><h3>Ljud</h3>' +
        vaxel('brus', 'Brusreducering', I.brus !== false && f.brus !== 'stods-ej', 'Dämpar fläktar, tangentbord och trafik.', f.brus === 'stods-ej') + stodText(f.brus) +
        vaxel('eko', 'Ekoreducering', I.eko !== false && f.eko !== 'stods-ej', 'Hindrar att de andra hör sig själva.', f.eko === 'stods-ej') + stodText(f.eko) +
        vaxel('volym', 'Automatisk volym', I.volym !== false && f.volym !== 'stods-ej', 'Jämnar ut när du pratar högt eller lågt.', f.volym === 'stods-ej') + stodText(f.volym) +
        '</section><section class="vm-install__grupp"><h3>Bild</h3>' +
        vaxel('spegla', 'Spegla min video', I.spegla !== false, 'Bara du ser spegelbilden.') +
        vaxel('ljus', 'Ljusförbättring', !!I.ljus, 'Lyfter en mörk bild lite – bra i ett dunkelt rum.') +
        '</section>';
    } else if (S.flik === 'bakgrund') {
      var b = bg('aktuellt') || {}, lage = b.lage || (I.bakgrund && I.bakgrund.lage) || 'ingen';
      var styrka = b.styrka || (I.bakgrund && I.bakgrund.styrka) || 'latt', bild = b.bild || (I.bakgrund && I.bakgrund.bild) || null;
      var kamAv = !j.kam, fel = S.bgFel, laddar = S.bgLaddar || b.laddar;
      var av = kamAv || !!fel || st.bakgrund === false;
      h += '<p class="vm-install__intro">Bakgrunden räknas fram i din dator – bilden skickas ingenstans.</p>';
      if (kamAv) h += '<p class="vm-install__not">' + ik('vm-kam-av') + '<span>Slå på kameran för att välja bakgrund.</span></p>';
      if (fel || st.bakgrund === false) h += '<p class="vm-install__not vm-install__not--fel">' + ik('vm-info') + '<span>Bakgrunden kunde inte startas i den här webbläsaren.</span></p>';
      if (laddar) h += '<p class="vm-install__not" role="status"><span class="vm-snurr" aria-hidden="true"></span><span>Laddar bakgrunden … första gången tar det några sekunder.</span></p>';
      function bgKnapp(l, s, bi, etikett, inner, klass) {
        var vald = lage === l && (l !== 'oskarpa' || styrka === s) && (l !== 'bild' || bild === bi);
        return '<button type="button" class="vm-bg' + (klass ? ' ' + klass : '') + '" data-vm="bakgrund" data-lage="' + l + '"' + (s ? ' data-styrka="' + s + '"' : '') + (bi ? ' data-bild="' + e(bi) + '"' : '') +
          ' aria-pressed="' + vald + '"' + (av && l !== 'ingen' ? ' disabled' : '') + '><span class="vm-bg__bild">' + inner + '</span><span class="vm-bg__namn">' + e(etikett) + '</span></button>';
      }
      h += '<section class="vm-install__grupp"><h3>Effekt</h3><div class="vm-bg__rutnat">' +
        bgKnapp('ingen', null, null, 'Ingen', ik('vm-ingen')) +
        bgKnapp('oskarpa', 'latt', null, 'Lätt oskärpa', '<i class="vm-bg__oskarpa vm-bg__oskarpa--latt"></i>', 'vm-bg--oskarpa') +
        bgKnapp('oskarpa', 'stark', null, 'Stark oskärpa', '<i class="vm-bg__oskarpa vm-bg__oskarpa--stark"></i>', 'vm-bg--oskarpa') +
        '</div></section><section class="vm-install__grupp"><h3>Bilder</h3><div class="vm-bg__rutnat">' +
        BG_BILDER.map(function (x) {
          if (x[0] === 'ton') return bgKnapp('bild', null, 'ton', x[1], '<i class="vm-bg__ton">Legohus</i>');
          return bgKnapp('bild', null, x[0], x[1], '<img src="' + e(x[0]) + '" alt="" loading="lazy" decoding="async">');
        }).join('') +
        (S.egenBild ? bgKnapp('bild', null, S.egenBild, 'Din bild', '<img src="' + e(S.egenBild) + '" alt="">') : '') +
        '<label class="vm-bg vm-bg--ladda' + (av ? ' vm-bg--av' : '') + '"><input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" data-vm-fil="bakgrund"' + (av ? ' disabled' : '') + '>' +
        '<span class="vm-bg__bild">' + ik('vm-ladda-upp') + '</span><span class="vm-bg__namn">Ladda upp egen</span></label>' +
        '</div><small class="vm-install__smatt">Din egen bild sparas inte – den gäller bara det här mötet.</small></section>';
    } else {
      var res = String(I.upplosning || '720'), fps = String(I.fps || '30');
      h += '<section class="vm-install__grupp"><h3>Video som skickas</h3>' +
        '<div class="vm-install__rad"><span>Upplösning</span>' + radioRad('upplosning', [['360', '360p'], ['720', '720p'], ['1080', '1080p']], res) + '</div>' +
        '<div class="vm-install__rad"><span>Bildfrekvens</span>' + radioRad('fps', [['15', '15'], ['24', '24'], ['30', '30']], fps) + '</div>' +
        (f.bredd ? '<p class="vm-install__fakta" role="status">' + ik('vm-kam') + '<span>Kameran levererar ' + f.bredd + ' × ' + f.hojd + (f.fps ? ', ' + Math.round(f.fps) + ' bilder/s' : '') + '</span></p>' : '') +
        '</section><section class="vm-install__grupp"><h3>Sändkvalitet</h3>' +
        radioRad('sandning', [['auto', 'Auto'], ['spara', 'Spara data'], ['ljud', 'Bara ljud']], I.sandning || 'auto') +
        '<small class="vm-install__smatt">' + e({ auto: 'Anpassas efter din anslutning.', spara: 'Lägre upplösning och bildfrekvens – bra på mobilnät.', ljud: 'Din video skickas inte. De andra hör dig som vanligt.' }[I.sandning || 'auto']) + '</small>' +
        '</section><section class="vm-install__grupp"><h3>Ta emot</h3>' +
        radioRad('taEmot', [['allt', 'Allt'], ['ljud', 'Bara ljud']], I.taEmot || 'allt') +
        '<small class="vm-install__smatt">' + (I.taEmot === 'ljud' ? 'De andras video visas inte – sparar data och batteri.' : 'Du ser och hör alla.') + '</small></section>';
    }
    return h + '</div>';
  }
  function kopplaInstallningsTest() { /* nivåmätaren uppdateras av nivaer-händelsen */ }
  function panelAnslutning() {
    var t = tillstand(), m = S.mote, h = '';
    h += '<section class="vm-install__grupp"><h3>Mötet</h3><dl class="vm-info-lista">' +
      '<div><dt>Titel</dt><dd>' + e(m.titel || 'Videomöte') + '</dd></div>' +
      (nar(m) ? '<div><dt>När</dt><dd>' + e(nar(m)) + '</dd></div>' : '') +
      (m.vardNamn ? '<div><dt>Värd</dt><dd>' + e(m.vardNamn) + '</dd></div>' : '') +
      (m.rum ? '<div><dt>Möteskod</dt><dd class="vm-mono">' + e(m.rum) + '</dd></div>' : '') +
      '</dl><button type="button" class="vm-sek vm-sek--bred" data-vm="kopiera-lank">' + ik('vm-lank') + '<span>Kopiera möteslänk</span></button></section>';
    var peers = Object.keys(S.natverk);
    var NIVA = { bra: 'Bra', varning: 'Ojämn', dalig: 'Svag' };
    if (S.fas !== 'mote' || !peers.length) {
      h += '<section class="vm-install__grupp"><h3>Anslutning</h3><p class="vm-install__smatt">' + (S.fas === 'mote' ? 'Mätningen startar när någon mer har anslutit.' : 'Mätningen startar när du har gått med.') + '</p></section>';
    } else {
      h += '<section class="vm-install__grupp"><h3>Anslutning</h3>';
      peers.forEach(function (p) {
        var n = S.natverk[p], d = S.deltagare.filter(function (x) { return x.peer === p; })[0];
        var ut = n.ut || {}, inn = n.in || {};
        h += '<table class="vm-status"><caption>' + e(d ? d.namn : 'Deltagare') + '</caption><tbody>' +
          '<tr><th scope="row">Kvalitet</th><td><span class="vm-status__niva" data-niva="' + e(n.niva || 'bra') + '">' + e(NIVA[n.niva] || 'Bra') + '</span></td></tr>' +
          '<tr><th scope="row">Fördröjning</th><td>' + (n.rtt != null ? Math.round(n.rtt) + ' ms' : '–') + '</td></tr>' +
          '<tr><th scope="row">Paketförlust</th><td>' + (n.forlust != null ? (Math.round(n.forlust * 10) / 10).toLocaleString('sv-SE') + ' %' : '–') + '</td></tr>' +
          '<tr><th scope="row">Skickar</th><td>' + (ut.bredd ? ut.bredd + ' × ' + ut.hojd + ', ' + Math.round(ut.fps || 0) + ' bilder/s, ' + Math.round(ut.kbps || 0) + ' kbit/s' : ut.kbps ? Math.round(ut.kbps) + ' kbit/s (ljud)' : '–') +
            (ut.begransning && ut.begransning !== 'none' && ut.begransning !== 'inget' ? '<small>begränsas av ' + e({ cpu: 'processorn', processor: 'processorn', bandwidth: 'bandbredden', bandbredd: 'bandbredden' }[ut.begransning] || ut.begransning) + '</small>' : '') + '</td></tr>' +
          '<tr><th scope="row">Tar emot</th><td>' + (inn.bredd ? inn.bredd + ' × ' + inn.hojd + ', ' + Math.round(inn.fps || 0) + ' bilder/s, ' + Math.round(inn.kbps || 0) + ' kbit/s' : inn.kbps ? Math.round(inn.kbps) + ' kbit/s (ljud)' : '–') + '</td></tr>' +
          (n.kodek ? '<tr><th scope="row">Kodek</th><td class="vm-mono">' + e(n.kodek) + '</td></tr>' : '') +
          '</tbody></table>';
      });
      h += '<p class="vm-install__smatt">Uppdateras varannan sekund.</p></section>';
    }
    h += '<p class="vm-arlig">' + e(ARLIG) + ' Riktiga möten mellan datorer kopplas in när CRM:et kommer upp på nätet.</p>';
    return h;
  }
  function panelKortkommandon() {
    var K = [['Ctrl+Shift+M', 'Mikrofon av/på'], ['Ctrl+Shift+O', 'Kamera av/på'], ['Håll mellanslag', 'Prata när mikrofonen är av'], ['Ctrl+Shift+E', 'Dela skärm'],
      ['Ctrl+Shift+K', 'Räck upp eller sänk handen'], ['Ctrl+Alt+C', 'Chatt i mötet'], ['Ctrl+Alt+P', 'Deltagare'], ['Ctrl+Shift+H', 'Lämna mötet'],
      ['Esc', GAST ? 'Stäng meny eller panel' : 'Stäng meny eller panel, annars minimera'], ['Shift+?', 'Kortkommandon']];
    return '<dl class="vm-tangenter">' + K.map(function (k) { return '<div><dt>' + k[0].split('+').map(function (x) { return '<kbd>' + e(x) + '</kbd>'; }).join('<span>+</span>') + '</dt><dd>' + e(k[1]) + '</dd></div>'; }).join('') + '</dl>';
  }

  /* ---------- Slutskärmar ---------- */
  function ritaSlut() {
    if (!S) return;
    var s = S.el.querySelector('.vm-slut'), sm = S.sammanfattning || {}, m = S.mote;
    var crm = !GAST && S.roll !== 'gast';
    var lamnat = S.fas === 'lamnat';
    var min = sm.minuter != null ? sm.minuter : S.inTid ? Math.max(1, Math.round((Date.now() - S.inTid) / 60000)) : 0;
    var narv = (sm.narvarande || []).filter(function (x) { return x && x.namn && x.namn !== S.jag.namn; }).map(function (x) { return x.namn + (x.roll === 'gast' ? ' (gäst)' : ''); });
    var rubrik, text, h;
    if (S.fas === 'borttagen' || S.orsak === 'borttagen') { rubrik = 'Du har tagits bort från mötet'; text = 'Värden tog bort dig. Hör av dig om det blev fel.'; }
    else if (S.orsak === 'fullt') { var max = (M() && M().MAX) || 4; rubrik = 'Mötet är fullt'; text = 'Ett videomöte rymmer ' + (max === 4 ? 'fyra' : max) + ' deltagare åt gången. Försök igen när någon har lämnat.'; }
    else if (lamnat) { rubrik = 'Du har lämnat mötet'; text = 'Mötet fortsätter för de andra.'; }
    else if (S.orsak === 'avslutat-av-vard') { rubrik = 'Mötet är slut'; text = fornamn(m.vardNamn) + ' avslutade mötet.'; }
    else { rubrik = 'Mötet är slut'; text = ''; }
    var meta = (min ? antal(min, 'minut', 'minuter') : '') + (narv.length ? (min ? ' · ' : '') + narv.join(', ') : '');
    h = '<div class="vm-slut__kort">' +
      '<span class="vm-slut__ikon">' + ik(S.orsak === 'fullt' || S.fas === 'borttagen' ? 'vm-info' : 'vm-bock') + '</span>' +
      '<h2 class="vm-rubrik">' + e(rubrik) + (min && crm && !lamnat ? ' · ' + antal(min, 'min', 'min') : '') + '</h2>' +
      (text ? '<p class="vm-under">' + e(text) + '</p>' : '') +
      (meta && crm ? '<p class="vm-under vm-under--deltagare">' + ik('vm-deltagare') + '<span>' + e(meta) + '</span></p>' : '');
    var anteckna = crm && IH.videomote && typeof IH.videomote.sparaAvslut === 'function' && (S.roll === 'vard' || S.varVard) && !S.sparat && m.id;
    if (anteckna) {
      var kundNamn = m.kund && (m.kund.namn || m.kundNamn) || m.kundNamn || null;
      var forsta = (m.deltagare || []).filter(function (x) { return x.typ === 'gast'; })[0];
      var uppg = 'Följ upp med ' + (forsta ? fornamn(forsta.namn) : 'kunden');
      var om2 = new Date(Date.now() + 2 * 86400000), datum = om2.getFullYear() + '-' + tv(om2.getMonth() + 1) + '-' + tv(om2.getDate());
      var nChatt = (sm.chatt || S.chatt).length;
      h += '<form class="vm-slut__form" data-vm-form="slut">' +
        '<label class="vm-falt"><span>Anteckning</span><textarea class="vm-slut__anteckning" name="anteckning" rows="4" maxlength="4000" placeholder="Vad kom ni fram till?"></textarea></label>' +
        '<fieldset class="vm-slut__steg"><legend>Nästa steg</legend>' +
        '<label class="vm-check"><input type="checkbox" name="uppgift" checked><span>Skapa uppgift</span></label>' +
        '<div class="vm-slut__uppgift"><input type="text" name="uppgiftText" maxlength="160" value="' + e(uppg) + '" aria-label="Uppgiftens text"><input type="date" name="uppgiftDatum" value="' + datum + '" aria-label="Datum för uppgiften"></div>' +
        (nChatt ? '<label class="vm-check"><input type="checkbox" name="sparaChatt" checked><span>Spara chatten från mötet (' + antal(nChatt, 'meddelande', 'meddelanden') + ')</span></label>' : '') +
        '</fieldset>' +
        '<div class="vm-knapprad vm-knapprad--slut">' + (lamnat ? '<button type="button" class="vm-lank-knapp" data-vm="ga-med-igen">Gå med igen</button>' : '') +
        '<button type="button" class="vm-sek" data-vm="hoppa-over">Hoppa över</button>' +
        '<button type="submit" class="vm-primar">' + (m.kund || m.kundNamn ? 'Spara i kundens historik' : 'Spara anteckningen') + '</button></div></form>';
      void kundNamn;
    } else {
      h += '<div class="vm-knapprad vm-knapprad--slut">' +
        (lamnat || (GAST && S.orsak !== 'borttagen' && S.fas !== 'borttagen' && S.orsak !== 'avslutat-av-vard' && S.fas !== 'slut') ? '<button type="button" class="vm-primar" data-vm="ga-med-igen">Gå med igen</button>' : '') +
        (GAST ? '' : '<button type="button" class="' + (lamnat ? 'vm-sek' : 'vm-primar') + '" data-vm="stang">Stäng</button>') + '</div>' +
        (GAST ? '<p class="vm-under vm-slut__tack">' + (S.fas === 'slut' && S.orsak !== 'fullt' ? 'Tack för att du var med! ' : '') + 'Du kan stänga fliken.</p>' : '');
    }
    h += '</div>';
    s.innerHTML = h;
    s.hidden = false;
    setTimeout(function () {
      var f = s.querySelector('textarea') || s.querySelector('.vm-primar') || s.querySelector('button');
      if (f) f.focus({ preventScroll: true });
    }, 60);
  }

  /* ---------- Fasbyten ---------- */
  var FAS_DOM = { av: 'forhand', forhand: 'forhand', vantar: 'vantar', nekad: 'vantar', mote: 'mote', lamnat: 'lamnat', slut: 'slut', borttagen: 'slut' };
  function sattFas(fas, orsak) {
    if (!S) return;
    var forra = S.fas;
    S.fas = fas; S.orsak = orsak || null;
    S.el.setAttribute('data-fas', FAS_DOM[fas] || fas);
    if (fas !== 'mote') { stangMeny(false); }
    if (fas !== forra) stangTaOver(null);
    if (fas === 'mote' && forra !== 'mote') {
      S.inTid = S.inTid || Date.now();
      if (S.roll === 'vard') S.varVard = true;
      ritaKontroller(); ritaTopp(); ritaRutor(); ritaLjud();
      S.el.querySelector('.vm-scen').classList.add('vm-scen--in');
      setTimeout(function () { if (S) S.el.querySelector('.vm-scen').classList.remove('vm-scen--in'); }, 700);
      clearInterval(S.sek); S.sek = setInterval(tickTid, 1000);
      live('Du är med i mötet.');
      setTimeout(function () { var k = S && S.el.querySelector('.vm-kontroller [data-vm="mik"]'); if (k && !S.mini) k.focus({ preventScroll: true }); }, 80);
      S.el.querySelector('.vm-slut').hidden = true;
    }
    if (fas === 'vantar' || fas === 'nekad' || fas === 'forhand') {
      S.el.querySelector('.vm-slut').hidden = true;
      ritaForhand();
      if (fas === 'vantar') live('Du väntar i väntrummet.');
      if (fas === 'nekad') live(orsak === 'tidsgrans' ? 'Ingen släppte in dig.' : 'Du fick inte gå med i mötet.');
      setTimeout(function () { var b = S && S.el.querySelector('.vm-forhand__val .vm-primar, .vm-forhand__val .vm-sek'); if (b && S.fas !== 'forhand') b.focus({ preventScroll: true }); }, 60);
    }
    if (fas === 'lamnat' || fas === 'slut' || fas === 'borttagen') {
      clearInterval(S.sek);
      if (D.fullscreenElement) { try { D.exitFullscreen(); } catch (err) { /* */ } }
      stangPanel();
      if (S.mini) minimera(false);
      Object.keys(S.rutor).forEach(function (k) { var v = S.rutor[k].querySelector('video'); if (v) v.srcObject = null; S.rutor[k].remove(); });
      S.rutor = {}; S.strom = {};
      ritaLjud();
      ritaSlut();
      live(fas === 'lamnat' ? 'Du har lämnat mötet.' : 'Mötet är slut.');
    }
    try { D.dispatchEvent(new CustomEvent('ih-videomote', { detail: { fas: fas, id: S.mote.id || null, rum: S.mote.rum || null, orsak: orsak || null } })); } catch (err) { /* */ }
  }

  /* ---------- Motorns händelser ---------- */
  function lyssna() {
    var m = M(); if (!m || typeof m.pa !== 'function') return;
    function pa(namn, fn) { try { var av = m.pa(namn, function (d) { if (S) { try { fn(d || {}); } catch (err) { console.warn('videomöte ui', namn, err); } } }); if (typeof av === 'function') S.avbryt.push(av); } catch (err) { /* */ } }
    pa('fas', function (d) { sattFas(d.fas, d.orsak); });
    pa('jag', function () {
      if (S.fas === 'mote') { ritaKontroller(); ritaEgen(); ritaMini(); if (S.panel === 'deltagare') ritaPanel(); }
      else if (S.fas === 'forhand' || S.fas === 'vantar') { ritaForhandVaxlar(); kopplaEgen(); }
      if (S.panel === 'installningar' && S.flik === 'bakgrund') ritaPanel();
    });
    pa('deltagare', function (lista) {
      var gamla = {}; S.deltagare.forEach(function (d) { gamla[d.peer] = d; });
      var ny = Array.isArray(lista) ? lista : [];
      var j = tillstand().jag || {};
      if (S.fas === 'mote') {
        ny.forEach(function (d) { if (!gamla[d.peer] && d.peer !== j.peer && !d.vantar) live((d.namn || 'Någon') + ' gick med i mötet.'); });
        S.deltagare.forEach(function (d) { if (d.peer !== j.peer && !ny.some(function (x) { return x.peer === d.peer; })) { live((d.namn || 'Någon') + ' lämnade mötet.'); delete S.strom[d.peer]; delete S.natverk[d.peer]; if (S.fast === d.peer) S.fast = null; } });
      }
      S.deltagare = ny;
      ny.forEach(function (d) { if (d.kamera || d.skarm) { S.strom[d.peer] = S.strom[d.peer] || {}; if (d.kamera && !S.strom[d.peer].kamera) S.strom[d.peer].kamera = d.kamera; if (d.skarm && !S.strom[d.peer].skarm) S.strom[d.peer].skarm = d.skarm; } });
      if (S.fas === 'mote') { ritaRutor(); ritaLjud(); ritaKontroller(); }
      else if (S.fas === 'vantar') ritaForhand();
      if (S.panel === 'deltagare') ritaPanel();
    });
    pa('deltagare-andrad', function (d) {
      var t = tillstand();
      if (Array.isArray(t.deltagare)) S.deltagare = t.deltagare;
      if (S.fas === 'mote') { ritaRutor(); if ((d.falt || []).indexOf('delar') >= 0) ritaKontroller(); }
      if (S.panel === 'deltagare') ritaPanel();
    });
    pa('strom', function (d) {
      var jj = tillstand().jag || {};
      if (!d.peer || d.peer === 'jag' || d.peer === jj.peer) { if ((d.typ || 'kamera') === 'kamera') kopplaEgen(true); if (S.fas === 'mote') { ritaEgen(); ritaDelar(); } return; }
      S.strom[d.peer] = S.strom[d.peer] || {};
      S.strom[d.peer][d.typ || 'kamera'] = d.strom || null;
      if (d.strom && d.strom.addEventListener) {
        d.strom.addEventListener('removetrack', function () { if (S) ritaRutor(); });
        d.strom.addEventListener('addtrack', function () { if (S) { ritaRutor(); ritaLjud(); } });
      }
      if (S.fas === 'mote') { ritaRutor(); ritaLjud(); }
    });
    pa('knackar', function (d) {
      var vard = S.roll === 'vard';
      if (!vard) return;
      pling();
      var namn = d.namn || 'En gäst';
      live(namn + ' väntar i väntrummet.');
      if (S.mini || S.fas !== 'mote') {
        if (S.fas === 'mote' && IH.toast && !GAST) { try { IH.toast(namn + ' väntar i väntrummet', 'Öppna mötet för att släppa in.', 'kalender'); } catch (err) { /* */ } }
      }
      if (S.fas === 'mote') {
        avis({ nyckel: 'knackar-' + d.peer, ikon: 'vm-anvandare', typ: 'knackar',
          text: '<b>' + e(namn) + '</b> väntar i väntrummet' + (d.gast !== false ? ' · Gäst' : ''),
          knappar: '<button type="button" class="vm-primar vm-primar--liten" data-vm="slapp-in" data-peer="' + e(d.peer) + '">Släpp in</button><button type="button" class="vm-sek vm-sek--liten vm-sek--scen" data-vm="panel" data-panel="deltagare">Visa</button>' });
      }
    });
    pa('vantande', function (lista) {
      var forra = S.vantande.map(function (v) { return v.peer; });
      S.vantande = Array.isArray(lista) ? lista : [];
      // aviseringar för den som inte väntar längre försvinner
      forra.forEach(function (p) { if (!S.vantande.some(function (v) { return v.peer === p; })) { var a = S.el.querySelector('[data-nyckel="knackar-' + (window.CSS && CSS.escape ? CSS.escape(p) : p) + '"]'); if (a) stangAvis(a); } });
      if (S.fas === 'mote') { ritaKontroller(); ritaRutor(); }
      else if (S.fas === 'forhand') ritaForhand();
      if (S.panel === 'deltagare') ritaPanel();
    });
    pa('chatt', function (d) {
      S.chatt.push({ peer: d.peer, namn: d.namn, text: String(d.text || '').slice(0, 2000), tid: d.tid ? +new Date(d.tid) : Date.now(), egen: !!d.egen });
      if (S.panel === 'chatt') ritaPanel();
      else if (!d.egen) {
        S.olasta++;
        if (S.fas === 'mote') {
          ritaKontroller();
          avis({ nyckel: 'chatt', ikon: 'vm-chatt', text: '<b>' + e(d.namn || 'Någon') + '</b> ' + e(String(d.text || '').slice(0, 90)), tid: 5000,
            knappar: '<button type="button" class="vm-sek vm-sek--liten vm-sek--scen" data-vm="panel" data-panel="chatt">Svara</button>' });
        }
      }
      if (!d.egen) live((d.namn || 'Någon') + ' skrev: ' + String(d.text || '').slice(0, 140));
    });
    pa('reaktion', function (d) { visaReaktion(d.peer, d.typ); });
    pa('inspelning', function (d) {
      var forra = !!S.inspelning.pa;
      S.inspelning = { pa: !!d.pa, egen: !!d.egen, av: d.av || null, lage: d.lage || null, sedan: d.sedan || (d.pa ? Date.now() : null) };
      if (d.pa && !forra) {
        var vem = d.egen ? 'Du' : (d.av || 'Någon');
        systemrad(vem + ' startade inspelningen' + (d.lage === 'ljud' ? ' (bara ljud).' : '.'), 'vm-rec');
        live(d.egen ? 'Du spelar in mötet.' : 'Mötet spelas in av ' + (d.av || 'en deltagare') + '.');
        if (!d.egen) avis({ nyckel: 'inspelning', ikon: 'vm-rec', typ: 'rec', text: '<b>Mötet spelas in</b> av ' + e(d.av || 'en deltagare') + '. Säg till om du inte vill det.', tid: 9000 });
      } else if (!d.pa && forra) {
        systemrad((d.egen ? 'Du' : (d.av || S.inspelning.av || 'Någon')) + ' slutade spela in.', 'vm-rec');
        live('Inspelningen är avslutad.');
        var a = S.el.querySelector('[data-nyckel="inspelning"]'); if (a) stangAvis(a);
      }
      if (S.fas === 'mote') ritaTopp();
    });
    pa('talar', function (d) { S.talare = d.peer || null; if (S.fas === 'mote' && (S.el.getAttribute('data-layout') === 'talare' || S.mini)) ritaRutor(); });
    pa('nivaer', function (d) {
      S.nivaer = d;
      if (S.nivaRaf) return;
      S.nivaRaf = requestAnimationFrame(function () {
        if (!S) return;
        S.nivaRaf = 0;
        var n = S.nivaer || {}, jn = Math.max(0, Math.min(1, +n.jag || 0));
        var j = tillstand().jag || {};
        if (j.mik === false) jn = 0;
        S.el.querySelectorAll('.vm-niva').forEach(function (m) {
          var ii = m.children;
          for (var i = 0; i < ii.length; i++) ii[i].classList.toggle('pa', jn > (i + 0.5) / (ii.length + 1.5));
        });
        // talarring i rutorna direkt (mjukare än att vänta på talar-händelsen)
        Object.keys(S.rutor).forEach(function (k) {
          var r = S.rutor[k], p = r.getAttribute('data-peer');
          if (r.getAttribute('data-typ') !== 'kamera') return;
          var d2 = S.deltagare.filter(function (x) { return x.peer === p; })[0];
          r.toggleAttribute('data-talar', (+n[p] || 0) > 0.06 && !(d2 && d2.mik === false));
        });
        var eg = S.el.querySelector('.vm-egen'); if (eg) eg.toggleAttribute('data-talar', jn > 0.06);
      });
    });
    pa('natverk', function (d) {
      if (!d.peer) return;
      if (d.peer === 'jag') { S.natverkJag = d; if (S.fas === 'mote') ritaTopp(); return; }
      S.natverk[d.peer] = d;
      if (S.fas !== 'mote') return;
      var r = S.rutor[rutaNyckel(d.peer, 'kamera')];
      if (r) { var nv = r.querySelector('.vm-natverk'); nv.hidden = !(d.niva === 'varning' || d.niva === 'dalig'); nv.setAttribute('data-niva', d.niva || 'bra'); }
      if (S.panel === 'anslutning') ritaPanel();
    });
    // svag anslutning i 6 s (motorn avgör) → avisering; motorn sänker själv sändkvaliteten i Auto
    pa('svag', function (d) {
      if (S.fas !== 'mote') return;
      if (d.pa) avis({ nyckel: 'svag', ikon: 'vm-natverk', typ: 'varning', text: '<b>Din anslutning är svag</b> – vi sänker videokvaliteten.', knappar: '<button type="button" class="vm-sek vm-sek--liten vm-sek--scen" data-vm="kam">Stäng av kameran</button>' });
      else { var a = S.el.querySelector('[data-nyckel="svag"]'); if (a) stangAvis(a); live('Anslutningen är bra igen.'); }
    });
    pa('delning', function (d) {
      var j = tillstand().jag || {};
      if (S.fas === 'mote') { ritaRutor(); ritaKontroller(); }
      // Frågan "X delar redan. Ta över?" gäller bara så länge någon annan delar
      if (!d.pa && d.peer !== j.peer) stangTaOver(d.peer);
      if (d.peer === j.peer && !d.pa) live('Skärmdelningen avslutades.');
      else if (d.peer !== j.peer) { var dd = S.deltagare.filter(function (x) { return x.peer === d.peer; })[0]; live((dd ? fornamn(dd.namn) : 'Någon') + (d.pa ? ' delar sin skärm.' : ' slutade dela.')); }
      startaKontrollTimer();
    });
    pa('enheter', function (en) { if (en) S.enheter = en; if (S.fas === 'forhand') ritaForhand(); if (S.panel === 'installningar') ritaPanel(); });
    pa('installningar', function (f) {
      S.faktiska = f || {};
      kopplaEgen();
      if (S.panel === 'installningar') ritaPanel();
    });
    pa('tysta-begaran', function () {
      if (S.fas !== 'mote') return;
      live('Värden ber dig stänga av mikrofonen.');
      avis({ nyckel: 'tysta', ikon: 'vm-mik-av', text: '<b>Värden ber dig stänga av mikrofonen.</b>',
        knappar: '<button type="button" class="vm-primar vm-primar--liten" data-vm="tysta-ja">Stäng av</button><button type="button" class="vm-sek vm-sek--liten vm-sek--scen" data-vm="stang-avis">Inte nu</button>' });
    });
    pa('vard', function (d) {
      var j = tillstand().jag || {};
      if (d.peer && d.peer === j.peer) {
        S.roll = 'vard'; S.jag.roll = 'vard'; S.varVard = true;
        avis({ ikon: 'vm-anvandare', text: '<b>Du är nu värd för mötet.</b> Du släpper in gäster och kan avsluta för alla.', tid: 6000 });
        live('Du är nu värd för mötet.');
      } else if (S.roll === 'vard' && d.peer) {
        S.roll = S.jag.id ? 'kollega' : 'gast'; S.jag.roll = S.roll;
      }
      if (S.fas === 'mote') ritaKontroller();
      if (S.panel === 'deltagare') ritaPanel();
    });
    pa('slut', function (d) {
      S.sammanfattning = d;
      if (!d.chatt || !d.chatt.length) S.sammanfattning.chatt = S.chatt.map(function (c) { return { namn: c.egen ? S.jag.namn : c.namn, text: c.text, tid: new Date(c.tid).toISOString() }; });
      vidSlutFn.forEach(function (fn) { try { fn(S.sammanfattning, S.mote); } catch (err) { console.warn(err); } });
      if (S.fas === 'lamnat' || S.fas === 'slut' || S.fas === 'borttagen') ritaSlut();
    });
    pa('fel', function (f) {
      var kod = f.kod || '';
      if (/^bakgrund/.test(kod)) { S.bgFel = f; S.bgLaddar = false; if (S.panel === 'installningar') ritaPanel(); avis({ ikon: 'vm-info', typ: 'varning', text: 'Bakgrunden kunde inte startas i den här webbläsaren.', tid: 6000 }); return; }
      if (S.fas === 'mote') avis({ ikon: 'vm-info', typ: 'varning', text: e(f.text || 'Något gick fel.'), tid: 6000 });
      else if (S.fas === 'forhand' && /^(nekad|saknas|upptagen|osaker|okand|kam-fel|mik-fel)$/.test(kod)) { S.mediaFel = f; ritaForhand(); }
    });
  }

  /* ---------- Åtgärder ---------- */
  function kopieraLank() {
    var url = '';
    var m = S.mote;
    try {
      if (IH.videomote && typeof IH.videomote.lank === 'function' && m.id) url = IH.videomote.lank(m.id, { namn: '' });
    } catch (err) { url = ''; }
    if (!url) {
      if (GAST) url = location.href.replace(/([#&])n=[^&]*/, '$1n=').replace(/&n=(&|$)/, '$1');
      else {
        var q = ['m=' + encodeURIComponent(m.rum || ''), 't=' + encodeURIComponent(m.titel || ''), 'v=' + encodeURIComponent(m.vardNamn || '')];
        if (m.start) q.push('s=' + encodeURIComponent(m.start));
        if (m.langd) q.push('l=' + encodeURIComponent(m.langd));
        url = new URL('mote-gast.html#' + q.join('&'), location.href).href;
      }
    }
    var klar = function () { toast('Länken är kopierad', 'Skicka den till den du vill bjuda in.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(klar, function () { reservKopiera(url) ? klar() : avis({ text: 'Länken kunde inte kopieras: ' + e(url), tid: 9000 }); });
    else if (reservKopiera(url)) klar();
  }
  function reservKopiera(text) {
    try { var t = D.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; S.el.appendChild(t); t.select(); var ok = D.execCommand('copy'); t.remove(); return ok; } catch (err) { return false; }
  }
  function gaMed() {
    if (!M()) return;
    if (S.roll === 'gast') {
      var inp = S.el.querySelector('[data-vm-namn]');
      if (inp) S.jag.namn = inp.value.trim().slice(0, 60);
      if (!S.jag.namn) { if (inp) inp.focus(); return; }
      S.jag.initialer = initialer(S.jag.namn);
      try { localStorage.setItem('ih-crm-videomote:gast-namn', S.jag.namn); } catch (err) { /* */ }
      // motorn fick namnet i forbered – har gästen ändrat det förbereds rummet om (kameran och mikrofonen behålls)
      var tj = tillstand().jag || {};
      if (tj.namn !== S.jag.namn) kor('forbered', S.mote, S.jag);
    }
    var b = S.el.querySelector('[data-vm="ga-med"]');
    if (b) { b.disabled = true; b.textContent = S.roll === 'gast' ? 'Knackar …' : 'Ansluter …'; }
    korP('gaMed').catch(function (f) {
      if (!S) return;
      avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Det gick inte att gå med. Försök igen.'), tid: 6000 });
      ritaForhand();
    });
  }
  function sattInst(delar) {
    return korP('sattInstallningar', delar).then(function (f) {
      if (!S) return;
      if (f) S.faktiska = f;
      kopplaEgen();
      if (S.panel === 'installningar') ritaPanel();
      if (S.fas === 'mote') { ritaEgen(); ritaRutor(); }
    }).catch(function (f) { if (S) avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Inställningen kunde inte ändras.'), tid: 5000 }); });
  }
  function valjBakgrund(lage, styrka, bild) {
    var j = tillstand().jag || {};
    if (lage !== 'ingen' && !j.kam) return;
    var forts = function () {
      var pr = bg('satt', lage, { styrka: styrka || 'latt', bild: bild || null });
      if (!pr) return Promise.reject({ kod: 'bakgrund-fel' });
      return Promise.resolve(pr).then(function () {
        if (!S) return;
        S.bgLaddar = false; kopplaEgen();
        if (S.panel === 'installningar') ritaPanel();
        live(lage === 'ingen' ? 'Ingen bakgrundseffekt.' : lage === 'oskarpa' ? 'Bakgrunden är suddig.' : 'Bakgrundsbilden är vald.');
      });
    };
    if (lage !== 'ingen' && !bg('harModul')) { S.bgLaddar = true; if (S.panel === 'installningar') ritaPanel(); }
    var p = forts();
    p.catch(function (f) {
      if (!S) return;
      S.bgLaddar = false; S.bgFel = f || { kod: 'bakgrund-fel' };
      if (S.panel === 'installningar') ritaPanel();
      avis({ ikon: 'vm-info', typ: 'varning', text: 'Bakgrunden kunde inte startas i den här webbläsaren.', tid: 6000 });
    });
  }
  function laddaEgenBild(fil) {
    if (!fil || !/^image\/(png|jpeg|webp)$/.test(fil.type)) { avis({ ikon: 'vm-info', typ: 'varning', text: 'Välj en bild i PNG, JPEG eller WebP.', tid: 5000 }); return; }
    if (fil.size > 15 * 1024 * 1024) { avis({ ikon: 'vm-info', typ: 'varning', text: 'Bilden är för stor (högst 15 MB).', tid: 5000 }); return; }
    var url = URL.createObjectURL(fil), img = new Image();
    img.onload = function () {
      var max = 1280, sk = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var c = D.createElement('canvas'); c.width = Math.round(img.naturalWidth * sk); c.height = Math.round(img.naturalHeight * sk);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) {
        if (!S || !b) return;
        if (S.egenBild) URL.revokeObjectURL(S.egenBild);
        S.egenBild = URL.createObjectURL(b);
        valjBakgrund('bild', null, S.egenBild);
      }, 'image/jpeg', 0.9);
    };
    img.onerror = function () { URL.revokeObjectURL(url); avis({ ikon: 'vm-info', typ: 'varning', text: 'Bilden kunde inte läsas.', tid: 5000 }); };
    img.src = url;
  }
  function testaInspelning(knappEl) {
    if (!S || S.testar) return;
    S.testar = true;
    var bild = S.el.querySelector('.vm-forhand__bild'), ruta = bild.querySelector('.vm-forhand__test');
    var synligForhand = S.fas === 'forhand' && !S.el.querySelector('.vm-forhand').hidden;
    var visa = function (txt) {
      if (synligForhand) { ruta.hidden = false; ruta.textContent = txt; }
      if (knappEl && knappEl.isConnected) { var sp = knappEl.querySelector('span'); if (sp) sp.textContent = txt; }
    };
    var kvar = 5; visa('Spelar in … ' + kvar);
    var iv = setInterval(function () { kvar--; if (kvar > 0) visa('Spelar in … ' + kvar); }, 1000);
    korP('spelaInTest', 5).then(function (url) {
      clearInterval(iv);
      if (!S || !url) throw new Error('ingen inspelning');
      visa('Spelar upp …');
      var v = synligForhand ? bild.querySelector('video') : D.createElement('video');
      var gammal = v.srcObject;
      v.setAttribute('data-test', '');
      v.srcObject = null; v.src = url; v.muted = false; v.removeAttribute('data-spegla');
      if (!synligForhand) { v.className = 'vm-test-uppspelning'; v.setAttribute('playsinline', ''); var yta = S.el.querySelector('.vm-panel__kropp'); if (yta) yta.prepend(v); }
      var klar = function () {
        v.removeAttribute('data-test'); v.removeAttribute('src'); v.muted = true; try { v.load(); } catch (err) { /* */ }
        URL.revokeObjectURL(url);
        if (synligForhand) { v.srcObject = gammal; spela(v); ruta.hidden = true; kopplaEgen(); } else v.remove();
        S.testar = false;
        if (knappEl && knappEl.isConnected) { var sp = knappEl.querySelector('span'); if (sp) sp.textContent = 'Testa ljud och bild'; }
      };
      v.onended = klar;
      setTimeout(function () { if (S && S.testar) klar(); }, 9000);
      spela(v);
    }).catch(function () {
      clearInterval(iv);
      if (!S) return;
      S.testar = false; ruta.hidden = true;
      if (knappEl && knappEl.isConnected) { var sp = knappEl.querySelector('span'); if (sp) sp.textContent = 'Testa ljud och bild'; }
      avis({ ikon: 'vm-info', typ: 'varning', text: 'Testet kunde inte spelas in i den här webbläsaren.', tid: 5000 });
    });
  }
  function dela(lage) {
    var taOver = !!S.taOver;
    S.taOver = false;
    korP('delaSkarm', { lage: lage, ljud: lage === 'video', taOver: taOver }).then(function () { if (S) { ritaKontroller(); live('Du delar din skärm.'); } }).catch(function (f) {
      if (!S) return;
      if (f && f.kod === 'annan-delar') {
        avis({ nyckel: 'taover', ikon: 'vm-dela', text: '<b>' + e(fornamn(f.namn || 'Någon')) + ' delar redan.</b> Ta över?',
          knappar: '<button type="button" class="vm-primar vm-primar--liten" data-vm="ta-over" data-lage="' + lage + '">Ta över</button><button type="button" class="vm-sek vm-sek--liten vm-sek--scen" data-vm="stang-avis">Avbryt</button>' });
        var ta = S.el.querySelector('.vm-avisering-yta [data-nyckel="taover"]');
        var delare = f.peer || (tillstand().deltagare || []).filter(function (x) { return x.delar; }).map(function (x) { return x.peer; })[0];
        if (ta && delare) ta.setAttribute('data-peer', delare);
        return;
      }
      if (f && (f.kod === 'skarm-nekad' || f.name === 'NotAllowedError')) return; // användaren valde Avbryt i webbläsarens ruta
      avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Skärmdelningen kunde inte startas.'), tid: 5000 });
    });
  }
  function lamna() {
    kor('lamna');
    // motorn sätter fasen; om den inte gör det inom kort visar vi ändå lämnat-skärmen
    setTimeout(function () { if (S && S.fas === 'mote') sattFas('lamnat'); }, 600);
  }

  /* ---------- Inspelning (motorn spelar in, här visas och sparas den) ---------- */
  function inspelningKan() { var m = M(); return !!(m && m.inspelning && typeof m.inspelning.starta === 'function' && typeof MediaRecorder !== 'undefined'); }
  function korInsp(namn, opt) {
    var m = M();
    if (!m || !m.inspelning || typeof m.inspelning[namn] !== 'function') return Promise.reject({ text: 'Inspelning finns inte i den här webbläsaren.' });
    try { return Promise.resolve(m.inspelning[namn](opt)); } catch (err) { return Promise.reject(err); }
  }
  function systemrad(text, ikon) {
    if (!S) return;
    S.chatt.push({ system: true, text: text, ikon: ikon, tid: Date.now() });
    if (S.panel === 'chatt') ritaPanel();
  }
  function ritaInspelning() {
    if (!S || !S.el) return;
    var b = S.el.querySelector('.vm-topp__rec'), ins = S.inspelning;
    if (!b) return;
    b.hidden = !ins.pa;
    b.querySelector('.vm-topp__recstopp').hidden = !(ins.pa && ins.egen);
    S.el.toggleAttribute('data-spelar-in', !!ins.pa);
    tickTidRec();
  }
  function tickTidRec() {
    var rt = S && S.el.querySelector('.vm-topp__rectext'), ins = S && S.inspelning;
    if (rt && ins && ins.pa) rt.textContent = (ins.egen ? 'Du spelar in' : 'Spelas in') + (ins.sedan ? ' · ' + langd((Date.now() - ins.sedan) / 1000) : '');
  }

  /* ---------- Klick ---------- */
  function klick(ev) {
    if (!S) return;
    var el = ev.target.closest('[data-vm]');
    // klick på en ruta (inte dess knappar) fäster den
    if (!el) {
      var r = ev.target.closest('.vm-ruta[data-typ="kamera"]');
      if (r && S.fas === 'mote' && ev.detail === 1) { var p = r.getAttribute('data-peer'); S.fast = S.fast === p ? null : p; ritaRutor(); live(S.fast ? 'Fäst.' : 'Lossad.'); }
      if (S.meny && !ev.target.closest('.vm-meny')) stangMeny(false);
      if (ev.target.classList.contains('vm-slojan') && S.fas === 'forhand') stang();
      return;
    }
    var vm = el.getAttribute('data-vm');
    if (S.meny && !el.closest('.vm-meny') && !/^meny-|^(reakt|mer|dela)$/.test(vm)) stangMeny(false);
    if (vm !== 'lamna' && S.lamnaKlick) { S.lamnaKlick = 0; }
    var peer = el.getAttribute('data-peer');
    var t = tillstand(), j = t.jag || {};
    switch (vm) {
      case 'mik': kor('sattMik', !j.mik); if (S.fas !== 'mote') ritaForhandVaxlar(); live(j.mik ? 'Mikrofonen är av.' : 'Mikrofonen är på.'); break;
      case 'kam':
        if (S.media !== 'pa' && S.fas === 'forhand') { startaMedia(true); break; }
        korP('sattKam', !j.kam).then(function () { if (S) { kopplaEgen(); if (S.fas === 'mote') ritaEgen(); else ritaForhandVaxlar(); } });
        live(j.kam ? 'Kameran är av.' : 'Kameran är på.');
        var sv = el.closest('.vm-avis'); if (sv) stangAvis(sv);
        break;
      case 'meny-inspelning': oppnaMeny('meny-inspelning', S.meny && S.meny.knapp || el); break;
      case 'inspelning-start':
        stangMeny(true);
        korInsp('starta', { lage: el.getAttribute('data-lage') === 'ljud' ? 'ljud' : 'bild' }).catch(function (f) { if (S) avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Inspelningen kunde inte starta.'), tid: 6000 }); });
        break;
      case 'inspelning-stopp': stangMeny(false); korInsp('stoppa'); break;
      case 'ladda-ner-inspelning': { var nk = el.getAttribute('data-nyckel'); inspelningar.laddaNer(nk, senasteFil[nk]); break; }
      case 'meny-mik': case 'meny-kam': case 'meny-lamna': case 'reakt': case 'mer':
        hamtaEnheter().then(function () { oppnaMeny(vm, el); }); break;
      case 'dela':
        if (j.delar) { kor('slutaDela'); break; }
        oppnaMeny('dela', el); break;
      case 'dela-text': stangMeny(false); dela('text'); break;
      case 'dela-video': stangMeny(false); dela('video'); break;
      case 'ta-over': if (!annanDelar()) { stangAvis(el.closest('.vm-avis')); live('Ingen delar längre.'); break; } S.taOver = true; stangAvis(el.closest('.vm-avis')); dela(el.getAttribute('data-lage') || 'text'); break;
      case 'sluta-dela': stangMeny(false); kor('slutaDela'); break;
      case 'hand': stangMeny(false); kor('hand', !j.hand); live(j.hand ? 'Handen är nere.' : 'Du räcker upp handen.'); break;
      case 'reaktion': kor('reaktion', el.getAttribute('data-typ')); stangMeny(true); break;
      case 'lamna':
        lamna(); break;
      case 'lamna-direkt': stangMeny(false); lamna(); break;
      case 'avsluta-alla':
        if (!S.avslutaKlick) { S.avslutaKlick = 1; el.querySelector('.vm-meny__text').firstChild.textContent = 'Klicka igen för att avsluta för alla'; setTimeout(function () { if (S) S.avslutaKlick = 0; }, 4000); break; }
        S.avslutaKlick = 0; stangMeny(false); kor('avslutaForAlla');
        setTimeout(function () { if (S && S.fas === 'mote') sattFas('slut'); }, 800);
        break;
      case 'panel': stangMeny(false); oppnaPanel(el.getAttribute('data-panel')); break;
      case 'chatt': case 'deltagare': case 'anslutning': oppnaPanel(el.getAttribute('data-panel') || vm); break;
      case 'stang-panel': stangPanel(); break;
      case 'oppna-install': stangMeny(false); oppnaPanel('installningar', 'ljud'); break;
      case 'oppna-bakgrund': stangMeny(false); oppnaPanel('installningar', 'bakgrund'); break;
      case 'oppna-kvalitet': stangMeny(false); oppnaPanel('installningar', 'kvalitet'); break;
      case 'flik': S.flik = el.getAttribute('data-flik'); ritaPanel(); var ff = S.el.querySelector('[data-flik="' + S.flik + '"]'); if (ff) ff.focus(); break;
      case 'valj-enhet':
        stangMeny(true);
        korP('bytEnhet', el.getAttribute('data-typ'), el.getAttribute('data-id')).then(function () { if (S) { kopplaEgen(); if (S.panel === 'installningar') ritaPanel(); } })
          .catch(function (f) { if (S) avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Enheten kunde inte väljas.'), tid: 5000 }); });
        break;
      case 'layout': S.layout = el.getAttribute('data-layout'); S.fast = null; stangMeny(true); ritaRutor(); break;
      case 'helskarm': stangMeny(false); helskarm(); break;
      case 'minimera': minimera(true); break;
      case 'tillbaka': minimera(false); break;
      case 'dolj-egen': S.doljEgen = !S.doljEgen; stangMeny(true); ritaEgen(); break;
      case 'flytta-egen': {
        var H = ['nh', 'nv', 'ov', 'oh'], nu = (inst().egenHorn || S.horn || 'nh');
        S.horn = H[(H.indexOf(nu) + 1) % 4]; sattInst({ egenHorn: S.horn });
        S.el.querySelector('.vm-egen').setAttribute('data-horn', S.horn);
        break;
      }
      case 'flytta-mini': {
        var H2 = ['nh', 'nv', 'ov', 'oh'];
        S.miniHorn = H2[(H2.indexOf(S.miniHorn || 'nh') + 1) % 4];
        S.el.querySelector('.vm-mini').setAttribute('data-horn', S.miniHorn);
        try { localStorage.setItem('ih-crm-videomote:mini-horn', S.miniHorn); } catch (err) { /* */ }
        break;
      }
      case 'kopiera-lank': stangMeny(false); kopieraLank(); break;
      case 'las': stangMeny(false); kor('las', !t.last); live(t.last ? 'Mötet är upplåst.' : 'Mötet är låst.'); setTimeout(function () { if (S) { ritaTopp(); if (S.panel === 'deltagare') ritaPanel(); } }, 50); break;
      case 'slapp-in': kor('slappIn', peer); var a1 = el.closest('.vm-avis'); if (a1) stangAvis(a1); break;
      case 'slapp-in-alla': kor('slappInAlla'); break;
      case 'neka': kor('neka', peer); break;
      case 'meny-ruta': oppnaMeny('meny-ruta', el, el.closest('.vm-ruta').getAttribute('data-peer')); break;
      case 'meny-dlt': oppnaMeny('meny-dlt', el, peer); break;
      case 'fast': S.fast = S.fast === peer ? null : peer; stangMeny(true); ritaRutor(); break;
      case 'be-tysta': kor('bedTysta', peer); stangMeny(true); toast('Förfrågan är skickad', 'Personen väljer själv om mikrofonen stängs av.'); break;
      case 'gor-vard': kor('gorTillVard', peer); stangMeny(true); break;
      case 'ta-bort':
        if (S.taBortKlick !== peer) { S.taBortKlick = peer; el.querySelector('.vm-meny__text').firstChild.textContent = 'Klicka igen för att ta bort'; setTimeout(function () { if (S) S.taBortKlick = null; }, 4000); break; }
        S.taBortKlick = null; kor('taBort', peer); stangMeny(false); break;
      case 'tysta-ja': kor('sattMik', false); stangAvis(el.closest('.vm-avis')); break;
      case 'stang-avis': stangAvis(el.closest('.vm-avis')); break;
      case 'media-start': startaMedia(true); break;
      case 'utan-kamera': S.mediaFel = null; startaMedia(false); break;
      case 'ga-med': gaMed(); break;
      case 'avbryt': stang(); break;
      case 'lamna-vantrum':
        if (!GAST) { stang(true); break; }
        if (S.fas === 'vantar') kor('lamna');
        kor('tillbaka');
        if (S.fas !== 'forhand') sattFas('forhand');
        startaMedia(!S.utanKamera);
        break;
      case 'testa-ton': korP('testaTon').catch(function () { /* */ }); break;
      case 'testa-inspelning': testaInspelning(el); break;
      case 'bakgrund': valjBakgrund(el.getAttribute('data-lage'), el.getAttribute('data-styrka'), el.getAttribute('data-bild')); break;
      case 'ga-med-igen':
        S.sammanfattning = null; S.sparat = false; S.inTid = 0; S.chatt = []; S.olasta = 0;
        S.el.querySelector('.vm-slut').hidden = true;
        kor('tillbaka');
        if (S.fas !== 'forhand') sattFas('forhand');
        startaMedia(!S.utanKamera);
        break;
      case 'hoppa-over': S.sparat = true; stang(true); break;
      case 'stang': stang(true); break;
    }
  }
  function andring(ev) {
    if (!S) return;
    var t = ev.target;
    if (t.matches('[data-vm-enhet]')) {
      korP('bytEnhet', t.getAttribute('data-vm-enhet'), t.value).then(function () { if (S) kopplaEgen(); })
        .catch(function (f) { if (S) avis({ ikon: 'vm-info', typ: 'varning', text: e(f && f.text || 'Enheten kunde inte väljas.'), tid: 5000 }); });
    } else if (t.matches('[data-vm-brytare]')) {
      var n = t.getAttribute('data-vm-brytare');
      if (n === 'vantrum') kor('vantrum', t.checked);
      else if (n === 'las') { kor('las', t.checked); setTimeout(function () { if (S) ritaTopp(); }, 50); }
      else { var o = {}; o[n] = t.checked; sattInst(o); }
    } else if (t.matches('[data-vm-inst]')) {
      var o2 = {}, k = t.getAttribute('data-vm-inst');
      o2[k] = (k === 'upplosning' || k === 'fps') ? +t.value : t.value;
      sattInst(o2);
    } else if (t.matches('[name="vm-ljudlage"]')) {
      S.ljudlage = t.value; kor('ljudlage', t.value);
    } else if (t.matches('[data-vm-fil]')) {
      laddaEgenBild(t.files && t.files[0]); t.value = '';
    }
  }
  function inmatning(ev) {
    if (!S) return;
    var t = ev.target;
    if (t.matches('[data-vm-namn]')) {
      S.jag.namn = t.value.slice(0, 60);
      var tom = !t.value.trim();
      var b = S.el.querySelector('[data-vm="ga-med"]'); if (b) { b.disabled = tom; if (tom) b.setAttribute('aria-describedby', 'vm-namn-hjalp'); else b.removeAttribute('aria-describedby'); }
      var h = S.el.querySelector('#vm-namn-hjalp'); if (h) h.hidden = !tom;
    } else if (t.matches('.vm-chatt__falt textarea')) {
      t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px';
    }
  }
  function skicka(ev) {
    if (!S) return;
    var f = ev.target;
    if (f.matches('[data-vm-form="chatt"]')) {
      ev.preventDefault();
      var ta = f.querySelector('textarea'), txt = ta.value.trim();
      if (!txt) return;
      // Töm fältet först – kor('chatt') ritar om panelen och tar med fältets text som utkast
      ta.value = ''; ta.style.height = 'auto';
      kor('chatt', txt.slice(0, 1000));
      var nyTa = S && S.el.querySelector('.vm-chatt__falt textarea');
      if (nyTa) { nyTa.value = ''; nyTa.style.height = 'auto'; nyTa.focus(); }
    } else if (f.matches('[data-vm-form="slut"]')) {
      ev.preventDefault();
      var fd = new FormData(f), sm = S.sammanfattning || {};
      var d = {
        anteckning: String(fd.get('anteckning') || '').trim(),
        uppgift: fd.get('uppgift') ? { text: String(fd.get('uppgiftText') || '').trim() || 'Följ upp videomötet', datum: String(fd.get('uppgiftDatum') || '') } : null,
        sparaChatt: !!fd.get('sparaChatt'),
        sammanfattning: { borjade: sm.borjade || (S.inTid ? new Date(S.inTid).toISOString() : null), slutade: sm.slutade || new Date().toISOString(), minuter: sm.minuter != null ? sm.minuter : Math.max(1, Math.round((Date.now() - (S.inTid || Date.now())) / 60000)), narvarande: sm.narvarande || [], chatt: sm.chatt || [] }
      };
      try { IH.videomote.sparaAvslut(S.mote.id, d); S.sparat = true; } catch (err) { console.warn(err); avis({ ikon: 'vm-info', typ: 'varning', text: 'Anteckningen kunde inte sparas.', tid: 5000 }); return; }
      stang(true); // sparaAvslut visar själv toasten "Mötet är sparat"
    }
  }

  /* ---------- Tangenter ---------- */
  function iText(el) { return el && (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range)$/.test(el.type) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable); }
  function tangent(ev) {
    if (!S || !S.el || !S.el.isConnected) return;
    var k = (ev.key || '').toLowerCase(), c = ev.ctrlKey || ev.metaKey, sh = ev.shiftKey, alt = ev.altKey;
    var t = tillstand(), j = t.jag || {};
    // Esc: meny → panel → minimera (CRM) / avbryt förhandsvisningen
    // CRM:ets egna kortkommandon (sökningen Ctrl K, guiden ?) skulle hamna bakom lagret – de väntar tills mötet är minimerat
    var stopp = function () { ev.preventDefault(); ev.stopImmediatePropagation(); };
    if (k === 'escape' && !S.mini) {
      if (ev.target && ev.target.closest && ev.target.closest('.valj-panel')) return;
      if (S.meny) { stopp(); stangMeny(true); return; }
      if (S.panel) { stopp(); stangPanel(); return; }
      if (D.fullscreenElement) return;
      if (S.fas === 'mote' && !GAST) { stopp(); minimera(true); return; }
      if (S.fas === 'forhand' && !GAST) { stopp(); stang(); return; }
      ev.stopImmediatePropagation();
      return;
    }
    if (S.mini) return;
    if ((c && !sh && !alt && k === 'k') || (k === '?' && !iText(ev.target) && S.fas !== 'mote')) { stopp(); return; }
    // menyn: piltangenter
    if (S.meny && (k === 'arrowdown' || k === 'arrowup' || k === 'arrowleft' || k === 'arrowright' || k === 'home' || k === 'end')) {
      var rader = Array.prototype.slice.call(S.el.querySelectorAll('.vm-meny [role^="menuitem"]:not([disabled])'));
      if (!rader.length) return;
      ev.preventDefault();
      var i = rader.indexOf(D.activeElement), fram = k === 'arrowdown' || k === 'arrowright';
      i = k === 'home' ? 0 : k === 'end' ? rader.length - 1 : i < 0 ? 0 : (i + (fram ? 1 : -1) + rader.length) % rader.length;
      rader[i].focus();
      return;
    }
    if (S.meny && k === 'tab') { stangMeny(false); }
    // flikar i inställningar
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('role') === 'tab' && (k === 'arrowleft' || k === 'arrowright')) {
      ev.preventDefault();
      var fl = ['ljud', 'bakgrund', 'kvalitet'], ix = fl.indexOf(S.flik);
      S.flik = fl[(ix + (k === 'arrowright' ? 1 : -1) + 3) % 3]; ritaPanel();
      var nf = S.el.querySelector('[data-flik="' + S.flik + '"]'); if (nf) nf.focus();
      return;
    }
    // chattfältet: Enter skickar, Shift+Enter ny rad
    if (k === 'enter' && !sh && ev.target.matches && ev.target.matches('.vm-chatt__falt textarea')) {
      ev.preventDefault(); ev.target.form.requestSubmit ? ev.target.form.requestSubmit() : ev.target.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      return;
    }
    if (k === 'tab') { fanga(ev); return; }
    if (S.fas !== 'mote') return;
    var text = iText(ev.target);
    var gjort = true;
    if (c && sh && k === 'm' || c && !sh && !alt && k === 'd') kor('sattMik', !j.mik);
    else if (c && sh && k === 'o' || c && !sh && !alt && k === 'e') { kor('sattKam', !j.kam); setTimeout(function () { if (S) ritaEgen(); }, 120); }
    else if (c && sh && k === 'e') { if (j.delar) kor('slutaDela'); else dela('text'); }
    else if (c && sh && k === 'k' || c && alt && k === 'h') kor('hand', !j.hand);
    else if (c && sh && k === 'h') {
      if (S.lamnaKlick) { S.lamnaKlick = 0; lamna(); }
      else { S.lamnaKlick = 1; ritaKontroller(); var lk = S.el.querySelector('[data-vm="lamna"]'); if (lk) lk.focus(); live('Tryck Ctrl+Shift+H igen för att lämna mötet.'); setTimeout(function () { if (S && S.lamnaKlick) { S.lamnaKlick = 0; ritaKontroller(); } }, 4000); }
    }
    else if (c && alt && k === 'c') oppnaPanel('chatt');
    else if (c && alt && k === 'p') oppnaPanel('deltagare');
    else if (!text && !c && !alt && (k === '?' || (sh && ev.code === 'Slash'))) oppnaPanel('kortkommandon');
    else if (!text && !c && !alt && !sh && k === ' ' && !ev.repeat && j.mik === false && !(ev.target.closest && ev.target.closest('button, a, [role="menuitem"], summary'))) { S.ptt = true; kor('sattMik', true); live('Mikrofonen är på medan du håller mellanslag.'); }
    else gjort = false;
    if (gjort) { stopp(); visaKontroller(); }
  }
  function tangentUpp(ev) {
    if (!S || !S.ptt) return;
    if (ev.key === ' ') { S.ptt = false; kor('sattMik', false); ev.preventDefault(); }
  }
  function fanga(ev) {
    if (S.mini) return;
    var yta = S.panel && mobilMq.matches ? S.el.querySelector('.vm-panel') : S.el;
    var f = Array.prototype.slice.call(yta.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter(function (x) {
      return !x.disabled && x.offsetParent !== null && !x.closest('[hidden]') && getComputedStyle(x).visibility !== 'hidden';
    });
    if (!f.length) return;
    var forsta = f[0], sista = f[f.length - 1];
    if (ev.shiftKey && (D.activeElement === forsta || !S.el.contains(D.activeElement))) { ev.preventDefault(); sista.focus(); }
    else if (!ev.shiftKey && (D.activeElement === sista || !S.el.contains(D.activeElement))) { ev.preventDefault(); forsta.focus(); }
  }

  /* ---------- Kontrollraden döljs i helskärm och vid delning ---------- */
  function visaKontroller() {
    if (!S) return;
    if (S.el.hasAttribute('data-kontroller')) S.el.removeAttribute('data-kontroller');
    startaKontrollTimer();
  }
  function startaKontrollTimer() {
    if (!S) return;
    clearTimeout(S.kontrollerTimer);
    var dolj = S.fas === 'mote' && (D.fullscreenElement || S.el.getAttribute('data-layout') === 'delning');
    if (!dolj) { S.el.removeAttribute('data-kontroller'); return; }
    S.kontrollerTimer = setTimeout(function () {
      if (!S) return;
      var a = D.activeElement;
      if (S.meny || S.panel || (a && a.closest && (a.closest('.vm-kontroller') || a.closest('.vm-avis')))) { startaKontrollTimer(); return; }
      S.el.setAttribute('data-kontroller', 'dolda');
    }, 3000);
  }
  function helskarm(el) {
    if (!S) return;
    if (D.fullscreenElement) { try { D.exitFullscreen(); } catch (err) { /* */ } return; }
    var mal = S.el;
    if (mal.requestFullscreen) mal.requestFullscreen().catch(function () { avis({ ikon: 'vm-info', text: 'Helskärm är inte tillåten här.', tid: 4000 }); });
    void el;
  }

  /* ---------- Minimera ---------- */
  function minimera(pa) {
    if (!S || GAST) return;
    if (pa && S.fas !== 'mote') return;
    S.mini = !!pa;
    stangMeny(false);
    if (pa && D.fullscreenElement) { try { D.exitFullscreen(); } catch (err) { /* */ } }
    if (pa) {
      S.el.setAttribute('data-mini', '');
      S.el.removeAttribute('role'); S.el.removeAttribute('aria-modal');
      ritaMini();
      var f = S.fokusFore; if (f && f.isConnected && !S.el.contains(f)) f.focus({ preventScroll: true });
      live('Mötet är minimerat. Det fortsätter i rutan nere i hörnet.');
    } else {
      S.el.removeAttribute('data-mini');
      S.el.setAttribute('role', 'dialog'); S.el.setAttribute('aria-modal', 'true');
      S.fokusFore = D.activeElement && !S.el.contains(D.activeElement) ? D.activeElement : S.fokusFore;
      ritaMini(); ritaRutor(); ritaKontroller();
      setTimeout(function () { var k = S && S.el.querySelector('.vm-kontroller [data-vm="mik"]'); if (k) k.focus({ preventScroll: true }); }, 40);
    }
    D.documentElement.toggleAttribute('data-vm-oppen', !S.mini);
  }

  /* ---------- Öppna och stäng ---------- */
  function oppna(opt) {
    opt = opt || {};
    sprite();
    if (S && S.el && S.el.isConnected) {
      // ett möte pågår redan i fliken: visa det
      if (S.fas === 'mote' || S.fas === 'vantar') { if (S.mini) minimera(false); return; }
      stang(true);
    }
    S = nyS(opt);
    try { S.miniHorn = localStorage.getItem('ih-crm-videomote:mini-horn') || 'nh'; } catch (err) { S.miniHorn = 'nh'; }
    if (!/^(nh|nv|oh|ov)$/.test(S.miniHorn)) S.miniHorn = 'nh';
    var el = bygg();
    S.el = el;
    D.body.appendChild(el);
    D.documentElement.setAttribute('data-vm-oppen', '');
    el.addEventListener('click', klick);
    el.addEventListener('dblclick', function (ev) {
      var r = ev.target.closest('.vm-ruta');
      if (!r || ev.target.closest('button') || !S || S.fas !== 'mote') return;
      S.fast = r.getAttribute('data-peer'); ritaRutor();
      if (!D.fullscreenElement) helskarm();
    });
    el.addEventListener('change', andring);
    el.addEventListener('input', inmatning);
    el.addEventListener('submit', skicka);
    el.addEventListener('pointermove', visaKontroller, { passive: true });
    el.addEventListener('pointerdown', visaKontroller, { passive: true });
    el.addEventListener('focusin', visaKontroller);
    D.addEventListener('keydown', tangent, true);
    D.addEventListener('keyup', tangentUpp, true);
    D.addEventListener('fullscreenchange', vidHelskarm);
    window.addEventListener('resize', vidStorlek);
    // stäng menyer vid klick utanför lagret (minimerat)
    if (!M()) { S.media = 'ingen'; ritaForhand(); return S; }
    S.avbryt = [];
    lyssna();
    kor('forbered', S.mote, S.jag);
    var tf = tillstand();
    if (tf.vantande) S.vantande = tf.vantande;
    if (tf.deltagare) S.deltagare = tf.deltagare;
    // Har sidan redan fått lov till kameran startar den direkt, annars frågar vi först (webbläsarens fråga kommer då väntat)
    S.media = 'fraga';
    ritaForhand();
    var per = navigator.permissions && navigator.permissions.query ? Promise.all([
      navigator.permissions.query({ name: 'camera' }).then(function (r) { return r.state; }, function () { return 'prompt'; }),
      navigator.permissions.query({ name: 'microphone' }).then(function (r) { return r.state; }, function () { return 'prompt'; })
    ]) : Promise.resolve(['prompt', 'prompt']);
    per.then(function (st) {
      if (!S) return;
      if (st[0] === 'granted' || st[1] === 'granted') startaMedia(st[0] === 'granted' || st[0] !== 'denied');
      else if (st[0] === 'denied' && st[1] === 'denied') { S.media = 'ingen'; S.mediaFel = { kod: 'nekad' }; ritaForhand(); }
      else fokusForhand();
    });
    setTimeout(fokusForhand, 30);
    return S;
  }
  function vidHelskarm() {
    if (!S) return;
    S.el.toggleAttribute('data-helskarm', D.fullscreenElement === S.el);
    if (S.fas === 'mote') ritaTopp();
    startaKontrollTimer();
  }
  var storTimer = 0;
  function vidStorlek() {
    clearTimeout(storTimer);
    storTimer = setTimeout(function () {
      if (!S) return;
      if (S.fas === 'mote') ritaRutor();
      if (S.meny) placeraMeny(S.el.querySelector('.vm-meny'), S.meny.knapp);
    }, 100);
  }
  function stang(tvinga) {
    if (!S) return false;
    if (S.fas === 'mote' && !tvinga) { minimera(true); return false; }
    if (S.fas === 'mote' || S.fas === 'vantar') kor('lamna');
    if (M() && typeof M().nollstall === 'function') kor('nollstall'); else kor('stoppaMedia');
    if (D.fullscreenElement) { try { D.exitFullscreen(); } catch (err) { /* */ } }
    S.avbryt.forEach(function (f) { try { f(); } catch (err) { /* */ } });
    clearInterval(S.sek); clearTimeout(S.kontrollerTimer); cancelAnimationFrame(S.nivaRaf);
    D.removeEventListener('keydown', tangent, true);
    D.removeEventListener('keyup', tangentUpp, true);
    D.removeEventListener('fullscreenchange', vidHelskarm);
    window.removeEventListener('resize', vidStorlek);
    S.el.querySelectorAll('video, audio').forEach(function (v) { v.srcObject = null; });
    if (S.egenBild) { try { URL.revokeObjectURL(S.egenBild); } catch (err) { /* */ } }
    var el = S.el, f = S.fokusFore;
    D.documentElement.removeAttribute('data-vm-oppen');
    S = null;
    if (GAST) { el.remove(); return true; }
    if (lugnMq.matches) el.remove();
    else { el.classList.add('vm--ut'); setTimeout(function () { el.remove(); }, 220); }
    if (f && f.isConnected && f.focus) f.focus({ preventScroll: true });
    return true;
  }

  /* ---------- Inspelningarna sparas i IndexedDB (inte localStorage) ----------
     Prototyp: filerna ligger bara i den här webbläsaren. Högst 500 MB per fil och 2 GB totalt;
     större filer laddas bara ner. C kopplar dem till kundens historik via händelsen
     'ih-videomote-inspelning' på document (detail: {nyckel, id, rum, titel, lage, sekunder, storlek, filnamn, typ, borjade, slutade})
     eller IH.videomote.sparaInspelning(id, info) om den finns. */
  var DB_NAMN = 'ih-crm-inspelningar', MAX_FIL = 500 * 1024 * 1024, MAX_TOTALT = 2 * 1024 * 1024 * 1024;
  function oppnaDb() {
    return new Promise(function (ok, nej) {
      if (!window.indexedDB) { nej(new Error('IndexedDB saknas')); return; }
      var q = indexedDB.open(DB_NAMN, 1);
      q.onupgradeneeded = function () { var db = q.result; if (!db.objectStoreNames.contains('filer')) db.createObjectStore('filer', { keyPath: 'nyckel' }); };
      q.onsuccess = function () { ok(q.result); };
      q.onerror = function () { nej(q.error); };
    });
  }
  function dbGor(lage, fn) {
    return oppnaDb().then(function (db) {
      return new Promise(function (ok, nej) {
        var tx = db.transaction('filer', lage), st = tx.objectStore('filer'), ut;
        var q = fn(st);
        if (q) q.onsuccess = function () { ut = q.result; };
        tx.oncomplete = function () { db.close(); ok(ut); };
        tx.onerror = tx.onabort = function () { db.close(); nej(tx.error); };
      });
    });
  }
  function storlekText(b) { return b >= 1048576 ? (Math.round(b / 104857.6) / 10).toLocaleString('sv-SE') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; }
  var inspelningar = {
    lista: function () { return dbGor('readonly', function (st) { return st.getAll(); }).then(function (l) { return (l || []).map(function (x) { var y = {}; for (var k in x) if (k !== 'blob') y[k] = x[k]; return y; }); }); },
    hamta: function (nyckel) { return dbGor('readonly', function (st) { return st.get(String(nyckel)); }); },
    taBort: function (nyckel) { return dbGor('readwrite', function (st) { return st.delete(String(nyckel)); }); },
    laddaNer: function (nyckel, post) {
      var gor = function (x) {
        if (!x || !x.blob) { toast('Inspelningen finns inte längre', 'Den kan ha tagits bort i den här webbläsaren.', 'varning'); return; }
        var url = URL.createObjectURL(x.blob), a = D.createElement('a');
        a.href = url; a.download = x.filnamn || 'inspelning.webm'; a.rel = 'noopener'; D.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        toast('Inspelningen är nedladdad', x.filnamn || '');
      };
      if (post) { gor(post); return Promise.resolve(); }
      return inspelningar.hamta(nyckel).then(gor, function () { gor(null); });
    }
  };
  var senasteFil = {};
  function sparaInspelning(ut) {
    if (!ut || !ut.blob) return;
    var mote = (S && S.mote) || senasteMote || {};
    var nyckel = 'rec-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    var post = { nyckel: nyckel, id: mote.id || null, rum: mote.rum || null, titel: mote.titel || 'Videomöte', lage: ut.lage, typ: ut.typ, filnamn: ut.filnamn || ('inspelning-' + nyckel + '.webm'),
      sekunder: ut.sekunder || 0, storlek: ut.storlek || ut.blob.size, borjade: ut.borjade || null, slutade: ut.slutade || new Date().toISOString(), blob: ut.blob };
    senasteFil[nyckel] = post;
    var sek = Math.round(post.sekunder || 0), meta = (sek < 60 ? sek + ' s' : Math.round(sek / 60) + ' min') + ' · ' + storlekText(post.storlek);
    var visa = function (sparad) {
      var knapp = '<button type="button" class="vm-primar vm-primar--liten" data-vm="ladda-ner-inspelning" data-nyckel="' + e(nyckel) + '">' + ik('vm-ladda-ner') + '<span>Ladda ner</span></button>';
      if (S && S.el) avis({ nyckel: 'rec-klar', ikon: 'vm-rec', typ: 'rec', text: '<b>' + (sparad ? 'Inspelningen är sparad' : 'Inspelningen är klar') + '</b> · ' + e(meta) + '<small>' + (sparad ? 'Prototyp – inspelningar sparas i den här webbläsaren.' : 'Den är för stor för att sparas här – ladda ner den nu.') + '</small>', knappar: knapp });
      else toast(sparad ? 'Inspelningen är sparad' : 'Inspelningen är klar', meta + (sparad ? ' · i den här webbläsaren' : ' · ladda ner den från mötet'));
      if (sparad) {
        var info = {}; for (var k in post) if (k !== 'blob') info[k] = post[k];
        try { if (IH.videomote && typeof IH.videomote.sparaInspelning === 'function' && post.id) IH.videomote.sparaInspelning(post.id, info); } catch (err) { console.warn(err); }
        try { D.dispatchEvent(new CustomEvent('ih-videomote-inspelning', { detail: info })); } catch (err) { /* */ }
      }
    };
    if (post.storlek > MAX_FIL) { visa(false); return; }
    inspelningar.lista().then(function (l) {
      var totalt = l.reduce(function (a, x) { return a + (x.storlek || 0); }, 0);
      if (totalt + post.storlek > MAX_TOTALT) throw new Error('fullt');
      return dbGor('readwrite', function (st) { return st.put(post); });
    }).then(function () { visa(true); }, function (err) { console.warn('inspelningen kunde inte sparas', err); visa(false); });
  }
  // Lyssnar hela tiden – inspelningen blir klar först efter att man lämnat, även om lagret hunnit stängas
  var senasteMote = null;
  D.addEventListener('ih-videomote', function (ev) { if (S && S.mote) senasteMote = S.mote; void ev; });
  (function () { var m = M(); if (m && typeof m.pa === 'function') { try { m.pa('inspelning-klar', sparaInspelning); } catch (err) { /* */ } } })();

  IH.samtalUi = {
    oppna: oppna,
    stang: function () { return stang(false); },
    minimera: minimera,
    oppnaPanel: function (namn) { if (namn === 'installningar') oppnaPanel('installningar', S && S.flik || 'ljud'); else oppnaPanel(namn); },
    vidSlut: function (fn) { if (typeof fn === 'function' && vidSlutFn.indexOf(fn) < 0) vidSlutFn.push(fn); },
    // för gästsidan och testerna
    tillstand: function () { return S ? { fas: S.fas, mini: S.mini, panel: S.panel, layout: S.el.getAttribute('data-layout'), media: S.media, roll: S.roll, inspelning: S.inspelning } : null; },
    inspelningar: inspelningar,
    ikon: ik
  };
})();
