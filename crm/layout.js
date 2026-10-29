/* ============================================================
   Legohus CRM – layoutlägen (2026-10-29)
   Tre lägen ovanpå temat: Minimal (tätt och lugnt), Normal (lagom) och Full (förval, som alltid).
   tema-tidigt.js har redan satt data-layout på <html> före första ritningen; här sköts bytet:
   - IH.layout()                  aktuellt läge: 'minimal' | 'normal' | 'full'
   - IH.layout.satt(id, {direkt}) sparar valet för kontot ('ih-crm-layout:<id>') och byter mjukt
                                  (kort tvärtoning med View Transitions, direkt vid prefers-reduced-motion)
   - IH.layout.lasOm({direkt})    efter kontobyte eller när en annan flik ändrat
   - IH.layout.valjare('stor'|'liten')  förhandsbilderna i Inställningar resp. segmentknappen i kontomenyn
   - IH.layout.ikon(id)           liten miniatyr (sökpaletten)
   - eventet 'ih:layout' på window och document, detail { layout, forra }
   All stil ligger i layout*.css bakom html[data-layout="minimal"|"normal"] – Full har inga egna regler.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var d = document.documentElement;
  var NYCKEL = 'ih-crm-layout:';
  var TIPS = 'ih-crm-layout-tips:';
  var GILTIG = /^(minimal|normal|full)$/;
  var LAGEN = [
    { id: 'minimal', namn: 'Minimal', kort: 'Bara det du jobbar med – tätt och lugnt', sok: 'minimal kompakt tät tätt enkel fokus lugn' },
    { id: 'normal', namn: 'Normal', kort: 'Lagom – överblick utan dekor', sok: 'normal lagom mellan mellanläge' },
    { id: 'full', namn: 'Full', kort: 'Allt, med stora bildytor och 3D (förval)', sok: 'full allt standard förval rik luftig' }
  ];
  var lugnMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function konto() { try { return localStorage.getItem('ih-crm-jag') || 'gast'; } catch (e) { return 'gast'; } }
  function lasVal() {
    var v = null;
    try { v = localStorage.getItem(NYCKEL + konto()); } catch (e) { v = null; }
    return GILTIG.test(v || '') ? v : 'full';
  }
  function info(id) { return LAGEN.filter(function (l) { return l.id === id; })[0] || LAGEN[2]; }

  var layout = IH.layout = function () {
    var v = d.getAttribute('data-layout');
    return GILTIG.test(v || '') ? v : 'full';
  };
  layout.lista = LAGEN;
  layout.info = info;
  layout.namn = function (id) { return info(id || layout()).namn; };
  layout.val = lasVal;

  /* --- Bytet -------------------------------------------------------- */
  function skicka(id, forra) {
    var detail = { layout: id, forra: forra };
    try { window.dispatchEvent(new CustomEvent('ih:layout', { detail: detail })); } catch (e) { /* mycket gammal webbläsare */ }
    try { document.dispatchEvent(new CustomEvent('ih:layout', { detail: detail })); } catch (e) { /* */ }
  }
  // Menyn räknas om (radhöjderna skiljer mellan lägena). Det kan skicka ett resize-event som stänger
  // kontomenyn – står den öppen (man byter läge därifrån) väntar omräkningen tills den stängs.
  var menyVakt = null;
  function menyOm() {
    if (!IH.uppdateraMeny) return;
    if (!d.hasAttribute('data-konto-oppen')) { try { IH.uppdateraMeny(); } catch (e) { /* */ } return; }
    if (menyVakt || !window.MutationObserver) return;
    menyVakt = new MutationObserver(function () {
      if (d.hasAttribute('data-konto-oppen')) return;
      menyVakt.disconnect(); menyVakt = null;
      try { IH.uppdateraMeny(); } catch (e) { /* */ }
    });
    menyVakt.observe(d, { attributes: true, attributeFilter: ['data-konto-oppen'] });
  }
  // Ankare för rullläget: hjältar ovanför ändrar höjd mellan lägena, så samma rubrik ska stå kvar på samma
  // ställe i bild. Rubrikerna identifieras på text + ordningsnummer (vyn byggs om, elementen är nya).
  function rubriker() {
    var yta = document.getElementById('vy');
    if (!yta) return [];
    var antal = {};
    return Array.prototype.slice.call(yta.querySelectorAll('h1, h2, h3, h4')).map(function (h) {
      var t = (h.getAttribute('aria-label') || h.textContent || '').replace(/\s+/g, ' ').trim();
      antal[t] = (antal[t] || 0) + 1;
      return { el: h, nyckel: t + '#' + antal[t], synlig: !!h.getClientRects().length };
    }).filter(function (r) { return r.synlig && r.nyckel.length > 2; });
  }
  function tagAnkare() {
    if (window.scrollY < 4) return null;
    var topp = 72, lista = rubriker(), ut = [];
    for (var n = 0; n < lista.length; n++) {
      var top = lista[n].el.getBoundingClientRect().top;
      if (top >= topp || (n + 1 < lista.length && lista[n + 1].el.getBoundingClientRect().top >= window.innerHeight)) ut.push({ nyckel: lista[n].nyckel, top: top });
      if (ut.length >= 8) break;
    }
    return ut.length ? ut : null;
  }
  function anvandAnkare(ankare) {
    if (!ankare) return;
    var lista = rubriker(), karta = {};
    lista.forEach(function (r) { karta[r.nyckel] = r.el; });
    for (var n = 0; n < ankare.length; n++) {
      var el = karta[ankare[n].nyckel];
      if (!el) continue;
      var dy = el.getBoundingClientRect().top - ankare[n].top;
      layout.senasteAnkare = { nyckel: ankare[n].nyckel, fore: ankare[n].top, dy: dy };
      if (Math.abs(dy) > 1) window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: 'instant' });
      return;
    }
  }
  var vantar = 0;
  function tillampa(id, direkt) {
    var forra = layout();
    if (forra === id) { markera(); return; }
    var ankare = null;
    var gor = function () {
      if (!ankare) ankare = tagAnkare();
      d.setAttribute('data-layout', id);
      // Vyerna skriver ut vissa delar bara i Minimal/Normal (t.ex. Snabbt-raden), så sidan ritas om på plats.
      try { if (IH.rita && document.getElementById('vy')) IH.rita(); } catch (e) { if (window.console) console.error(e); }
      anvandAnkare(ankare);
      menyOm();
      markera();
      skicka(id, forra);
    };
    if (direkt || lugnMq.matches || document.hidden || !document.startViewTransition) { vantar++; gor(); return; }
    // Ett sidbyte startar sin egen övergång i nästa bildruta (app.js) – layoutbytet väntar en bildruta till
    // så att de inte avbryter varandra. Ett avbrutet byte är inget fel.
    var nr = ++vantar;
    requestAnimationFrame(function () {
      if (nr !== vantar) return;
      d.classList.add('tema-vt');
      var klar = function () { d.classList.remove('tema-vt'); };
      try {
        var vt = document.startViewTransition(gor);
        ['ready', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); });
        if (vt.finished) vt.finished.then(klar, klar); else setTimeout(klar, 400);
      } catch (e) { klar(); if (layout() !== id) gor(); }
    });
  }
  function forstaGangen(id) {
    var k = TIPS + konto();
    try { if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1'); } catch (e) { return false; }
    if (IH.toast) IH.toast('Layout: ' + info(id).namn, 'Byt tillbaka i kontomenyn eller sök på Layout med ' + (/Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘ K' : 'Ctrl K') + '.', 'installning');
    return true;
  }
  layout.satt = function (id, hur) {
    id = GILTIG.test(id || '') ? id : 'full';
    try { localStorage.setItem(NYCKEL + konto(), id); } catch (e) { /* privat läge: gäller tills sidan laddas om */ }
    var fore = layout();
    tillampa(id, hur && hur.direkt);
    if (fore !== id && !(hur && hur.tyst)) forstaGangen(id);
    markera();
    return id;
  };
  // Efter kontobyte (app.js) eller när en annan flik ändrat: läs kontots val på nytt.
  layout.lasOm = function (hur) { tillampa(lasVal(), hur && hur.direkt); markera(); };

  window.addEventListener('storage', function (e) {
    if (e.key === 'ih-crm-jag' || (e.key && e.key.indexOf(NYCKEL) === 0)) layout.lasOm({ direkt: true });
  });

  /* --- Väljarna ----------------------------------------------------- */
  // Miniatyr av appen i respektive täthet, i aktuellt temas färger: sidomeny, topprad och block.
  function bild(id) {
    var block = { full: '<i class="lb-hjalte"></i><i></i><i></i><i></i><i></i>', normal: '<i class="lb-hjalte"></i><i></i><i></i><i></i><i></i><i></i><i></i>', minimal: '<i class="lb-rad"></i>' + new Array(13).join('<i></i>') }[id];
    return '<span class="layout-bild layout-bild--' + id + '" aria-hidden="true"><i class="lb-sido"><b></b><b></b><b></b><b></b></i>' +
      '<span class="lb-yta"><i class="lb-topp"></i><span class="lb-block">' + block + '</span></span></span>';
  }
  // Liten ikon: tre staplar i olika täthet (kontomenyn och sökpaletten)
  function ikon(id) {
    return '<span class="layout-ikon layout-ikon--' + id + '" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }
  layout.bild = bild;
  layout.ikon = ikon;
  layout.valjare = function (storlek) {
    var val = layout();
    if (storlek === 'liten') {
      return '<div class="layout-valjare layout-valjare--liten" role="group" aria-label="Layout">' + LAGEN.map(function (l) {
        return '<button type="button" class="layout-knapp" data-g="layout-val" data-layout-id="' + l.id + '" aria-pressed="' + (val === l.id) + '" title="' + l.namn + ' – ' + l.kort + '">' + ikon(l.id) + '<span>' + l.namn + '</span></button>';
      }).join('') + '</div>';
    }
    return '<div class="layout-valjare layout-valjare--stor" role="radiogroup" aria-label="Layout" data-layout-radio>' + LAGEN.map(function (l) {
      var p = val === l.id;
      return '<button type="button" role="radio" class="layout-kort" data-g="layout-val" data-layout-id="' + l.id + '" aria-checked="' + p + '" tabindex="' + (p ? 0 : -1) + '">' + bild(l.id) +
        '<span class="layout-kort__text"><b>' + l.namn + '</b><small>' + l.kort + '</small></span>' +
        '<span class="layout-kort__bock" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>';
    }).join('') + '</div>';
  };
  function markera() {
    var val = layout();
    Array.prototype.forEach.call(document.querySelectorAll('[data-g="layout-val"][data-layout-id]'), function (b) {
      if (b.classList.contains('palett__rad')) return;
      var p = b.getAttribute('data-layout-id') === val;
      if (b.getAttribute('role') === 'radio') { b.setAttribute('aria-checked', String(p)); b.setAttribute('tabindex', p ? '0' : '-1'); }
      else b.setAttribute('aria-pressed', String(p));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-layout-namn]'), function (s) { s.textContent = info(val).namn; });
  }
  layout.markera = markera;

  // Piltangenter i radiogruppen (Inställningar): flyttar och väljer, som vanliga radioknappar.
  document.addEventListener('keydown', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-layout-radio] [role="radio"]') : null;
    if (!b) return;
    var steg = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
    if (ev.key === 'Home') steg = -9; if (ev.key === 'End') steg = 9;
    if (!steg) return;
    ev.preventDefault();
    var alla = Array.prototype.slice.call(b.parentNode.querySelectorAll('[role="radio"]'));
    var n = alla.indexOf(b);
    var ny = alla[Math.abs(steg) === 9 ? (steg < 0 ? 0 : alla.length - 1) : (n + steg + alla.length) % alla.length];
    var id = ny.getAttribute('data-layout-id');
    layout.satt(id);
    // Kortet ritas om på plats (sidan ritas om) – fokus till samma val i den nya väljaren.
    var fokus = function () { var f = document.querySelector('[data-layout-radio] [data-layout-id="' + id + '"]'); if (f) f.focus({ preventScroll: true }); };
    fokus(); requestAnimationFrame(function () { requestAnimationFrame(fokus); }); setTimeout(fokus, 360);
  });

  IH.G = IH.G || {};
  IH.G['layout-val'] = function (el) {
    var id = el.getAttribute('data-layout-id');
    var palett = el.classList.contains('palett__rad');
    var forra = layout();
    var radio = el.getAttribute('role') === 'radio';
    layout.satt(id, { tyst: palett });
    if (palett && IH.toast) IH.toast('Layout: ' + info(id).namn, forra === id ? 'Redan valt' : 'Sparas för ditt konto', 'installning');
    if (radio) setTimeout(function () { var f = document.querySelector('[data-layout-radio] [data-layout-id="' + id + '"]'); if (f) f.focus({ preventScroll: true }); }, 360);
  };
})();
