/* ============================================================
   Legohus CRM – temamotorn (2026-10-29)
   Sex teman (tema.css) + "Följ systemet". tema-tidigt.js har redan satt
   data-tema på <html> före första ritningen; här sköts bytet:
   - IH.tema.satt(id)  sparar valet för kontot och byter mjukt
                       (View Transitions, annars kort färgövergång;
                       direkt vid prefers-reduced-motion)
   - IH.tema.farg(n) / rgb(n) / tal(n)  läser token --t-<n> (för 3D och diagram)
   - IH.tema.valjare('stor'|'liten')     färgproverna i Inställningar och kontomenyn
   - eventet 'ih:tema' på window (även 'tema-byte'), detail { tema, val, mork }
     – 3D-vyerna och diagrammen lyssnar och ritar om sina färger.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var d = document.documentElement;
  var NYCKEL = 'ih-crm-tema:';

  // Ordningen är den som visas i väljarna. "kort" syns i Inställningar, "sok" används av sökpaletten.
  var TEMAN = [
    { id: 'system', namn: 'Följ systemet', mini: 'Auto', kort: 'Ljust eller mörkt som datorn', sok: 'system automatiskt auto dator följ' },
    { id: 'original', namn: 'Original', mini: 'Original', kort: 'Varm kräm och bärnsten', sok: 'original standard förval kräm bärnsten legohus' },
    { id: 'ljus', namn: 'Ljus', mini: 'Ljus', kort: 'Extra ljust och luftigt', sok: 'ljus ljust luftigt vitt' },
    { id: 'mork', namn: 'Mörk', mini: 'Mörk', kort: 'Skönt för ögonen', sok: 'mörk mörkt dark natt kväll' },
    { id: 'fargglad', namn: 'Färgglad', mini: 'Färgglad', kort: 'Livligare, samma värme', sok: 'färgglad färgglatt glad livlig orange petrol' },
    { id: 'bygg', namn: 'Bygg', mini: 'Bygg', kort: 'Betong, stål och varselgult', sok: 'bygg byggplats betong stål trä varsel gul' },
    { id: 'office', namn: 'Office', mini: 'Office', kort: 'Stramt, svalt och neutralt', sok: 'office kontor neutral stram blå professionell' }
  ];
  var GILTIG = /^(original|ljus|mork|fargglad|bygg|office)$/;
  var mork = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var lugnMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function konto() { try { return localStorage.getItem('ih-crm-jag') || 'gast'; } catch (e) { return 'gast'; } }
  function lasVal() {
    var v = null;
    try { v = localStorage.getItem(NYCKEL + konto()); } catch (e) { v = null; }
    return GILTIG.test(v || '') ? v : 'system';
  }
  function upplos(val) { return GILTIG.test(val || '') ? val : (mork.matches ? 'mork' : 'original'); }
  function info(id) { return TEMAN.filter(function (t) { return t.id === id; })[0] || TEMAN[0]; }

  var tema = IH.tema = IH.tema || {};
  tema.lista = TEMAN;
  tema.info = info;
  tema.val = lasVal; // det sparade valet: 'system' eller ett tema-id
  tema.aktivt = function () { return d.getAttribute('data-tema') || upplos(lasVal()); };
  tema.mork = function () { return tema.aktivt() === 'mork'; };
  // Token: farg('accent') → '#e29a4a', rgb('blaeck-rgb') → '27 25 21', tal('3d-sol-styrka') → 2.1
  tema.farg = function (n, reserv) {
    var v = getComputedStyle(d).getPropertyValue('--t-' + n).trim();
    return v || reserv || '';
  };
  tema.tal = function (n, reserv) { var v = parseFloat(tema.farg(n)); return isNaN(v) ? reserv : v; };

  /* --- Bytet -------------------------------------------------------- */
  var stopp = 0;
  function skicka(t) {
    var detail = { tema: t, val: lasVal(), mork: t === 'mork' };
    try { window.dispatchEvent(new CustomEvent('ih:tema', { detail: detail })); } catch (e) { /* mycket gammal webbläsare */ }
    try { window.dispatchEvent(new CustomEvent('tema-byte', { detail: detail })); } catch (e) { /* */ }
  }
  // Mobilens adressfält följer temat; Original behåller sidans egen färg ur <meta>.
  var metaOrig = null;
  function metaFarg() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) return;
    if (metaOrig === null) metaOrig = m.getAttribute('data-original') || '';
    var f = tema.aktivt() === 'original' && metaOrig ? metaOrig : tema.farg('sand');
    if (f) m.setAttribute('content', f);
  }
  function tillampa(t, direkt) {
    if (d.getAttribute('data-tema') === t) { markera(); return; }
    var gor = function () { d.setAttribute('data-tema', t); metaFarg(); markera(); skicka(t); };
    if (direkt || lugnMq.matches || document.hidden) { gor(); return; }
    if (document.startViewTransition) {
      // Bara roten tonar över – sidans egna övergångsnamn (vyn, chattbubblan) stängs av under tiden.
      d.classList.add('tema-vt');
      var klar = function () { d.classList.remove('tema-vt'); };
      try {
        var vt = document.startViewTransition(gor);
        ['ready', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); });
        if (vt.finished) vt.finished.then(klar, klar); else setTimeout(klar, 400);
      } catch (e) { klar(); gor(); }
      return;
    }
    d.classList.add('tema-byter');
    gor();
    clearTimeout(stopp);
    stopp = setTimeout(function () { d.classList.remove('tema-byter'); }, 320);
  }
  tema.satt = function (val, hur) {
    val = GILTIG.test(val || '') ? val : 'system';
    try { localStorage.setItem(NYCKEL + konto(), val); } catch (e) { /* privat läge: gäller tills sidan laddas om */ }
    tillampa(upplos(val), hur && hur.direkt);
    markera();
    return upplos(val);
  };
  // Efter kontobyte (app.js) eller när en annan flik ändrat: läs kontots val på nytt.
  tema.lasOm = function (hur) { tillampa(upplos(lasVal()), hur && hur.direkt); markera(); };

  if (mork.addEventListener) mork.addEventListener('change', function () { if (lasVal() === 'system') tillampa(upplos('system')); markera(); });
  else if (mork.addListener) mork.addListener(function () { if (lasVal() === 'system') tillampa(upplos('system')); });
  window.addEventListener('storage', function (e) {
    if (e.key === 'ih-crm-jag' || (e.key && e.key.indexOf(NYCKEL) === 0)) tema.lasOm();
  });

  /* --- Väljarna ----------------------------------------------------- */
  // Ett färgprov: data-tema-prov ger elementet det temats token (tema.css), så provet är alltid sant.
  function prick(id) {
    return id === 'system'
      ? '<span class="tema-prick tema-prick--system" aria-hidden="true"><span data-tema-prov="original"></span><span data-tema-prov="mork"></span></span>'
      : '<span class="tema-prick" data-tema-prov="' + id + '" aria-hidden="true"></span>';
  }
  function bild(id) {
    var en = function (t) {
      return '<span class="tema-bild__ram" data-tema-prov="' + t + '"><i class="tb-sido"><b></b><b></b><b></b></i>' +
        '<span class="tb-yta"><i class="tb-hjalte"><b></b><s></s></i><i class="tb-kort"><b></b><s></s><em></em></i><i class="tb-kort"><b></b><s></s></i></span></span>';
    };
    return '<span class="tema-bild' + (id === 'system' ? ' tema-bild--system' : '') + '" aria-hidden="true">' +
      (id === 'system' ? en('original') + en('mork') : en(id)) + '</span>';
  }
  // Kontomenyns prov: ett litet fönster (sidomeny, yta, text och knapp) i temats egna färger.
  function ruta(id) {
    var del = function (t) { return '<span class="tema-ruta__del" data-tema-prov="' + t + '"><i></i><s></s><b></b></span>'; };
    return '<span class="tema-ruta' + (id === 'system' ? ' tema-ruta--system' : '') + '" aria-hidden="true">' + (id === 'system' ? del('original') + del('mork') : del(id)) + '</span>';
  }
  tema.prick = prick;
  tema.ruta = ruta;
  tema.valjare = function (storlek) {
    var val = lasVal();
    if (storlek === 'liten') {
      return '<div class="tema-valjare tema-valjare--liten" role="group" aria-label="Tema">' + TEMAN.map(function (t) {
        return '<button type="button" class="tema-knapp" data-g="tema-val" data-tema-id="' + t.id + '" aria-pressed="' + (val === t.id) + '" aria-label="Tema: ' + t.namn + '" title="' + t.namn + ' – ' + t.kort + '">' + ruta(t.id) + '<span class="tema-knapp__namn">' + t.mini + '</span></button>';
      }).join('') + '</div>';
    }
    return '<div class="tema-valjare tema-valjare--stor" role="group" aria-label="Tema">' + TEMAN.map(function (t, n) {
      return '<button type="button" class="tema-kort" data-g="tema-val" data-tema-id="' + t.id + '" aria-pressed="' + (val === t.id) + '" style="--n:' + n + '">' + bild(t.id) +
        '<span class="tema-kort__text"><b>' + t.namn + '</b><small>' + t.kort + '</small></span>' +
        '<span class="tema-kort__bock" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>';
    }).join('') + '</div>';
  };
  // Texten bredvid väljaren, t.ex. "Mörk · följer systemet"
  tema.beskrivning = function () {
    var val = lasVal();
    return val === 'system' ? info(upplos('system')).namn + ' · följer systemet' : info(val).namn;
  };
  function markera() {
    var val = lasVal();
    Array.prototype.forEach.call(document.querySelectorAll('[data-g="tema-val"][data-tema-id]'), function (b) {
      if (!b.classList.contains('palett__rad')) b.setAttribute('aria-pressed', String(b.getAttribute('data-tema-id') === val));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tema-namn]'), function (s) { s.textContent = tema.beskrivning(); });
  }
  tema.markera = markera;

  IH.G = IH.G || {};
  IH.G['tema-val'] = function (el) {
    var id = el.getAttribute('data-tema-id');
    var t = tema.satt(id);
    if (el.classList.contains('palett__rad') && IH.toast) IH.toast('Tema: ' + info(id).namn, id === 'system' ? 'Just nu ' + info(t).namn + ' – följer datorns läge' : 'Sparas för ditt konto', 'installning');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', metaFarg); else metaFarg();
})();
