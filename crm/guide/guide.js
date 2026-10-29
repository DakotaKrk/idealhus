/* ============================================================
   Legohus CRM – guidemotorn (IH.guide), 2026-10-29.
   Spotlight-turer som i de stora säljsystemen: en mjuk mörk slöja
   med ett urklipp runt det man ska titta på, en pulserande ram, en
   pratbubbla med stegräknare och Föregående/Nästa/Hoppa över.
   Ett steg kan vänta på att användaren själv klickar, byta sida
   (location.hash) och vänta tills elementet finns. Ramen följer
   med vid rullning och storleksändring. Klara turer minns i
   localStorage (ih-guide-klara). Turerna är data i turer.js.

   API:
     IH.guide.registrera(tur | [turer])
     IH.guide.starta(id, { auto, takt, vidSlut })   – auto = autospel (videon)
     IH.guide.stang() · nasta() · forra()
     IH.guide.oppna() / stangMeny() / vaxlaMeny()   – guidemenyn
     IH.guide.turForSidan()  · IH.guide.klara() · IH.guide.lage()
   Start från en länk: index.html?tur=<id>#/<sida>  (&auto=1 för autospel)
   Kortkommando: ? öppnar guidemenyn. I en tur: → nästa, ← föregående, Esc stänger.
   Inga externa bibliotek och inga inbyggda skript (CSP).
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var G = IH.guide = IH.guide || {};
  var TURER = G.turer = G.turer || [];
  var LS_KLARA = 'ih-guide-klara', LS_SETT = 'ih-guide-sett';
  var lugnMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var lugn = function () { return lugnMQ.matches; };
  var mobil = function () { return window.innerWidth <= 640; };

  /* --- Små hjälpare --------------------------------------------------- */
  var SVG = {
    stang: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    pil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    pilv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.5 1.5 0 0 1 2.2-2L9 15"/></svg>',
    bock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    spela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    trofe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/></svg>',
    karta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/></svg>',
    flode: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7"/></svg>',
    sida: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    skold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/></svg>',
    film: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/></svg>',
    bild: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></svg>',
    nollstall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/></svg>',
    vink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11.5V6a1.5 1.5 0 0 1 3 0v4.5M10 10V4.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0v1.5m0 0a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7 6.5 6.5 0 0 1-5.5-3L4 14a1.5 1.5 0 0 1 2.5-1.5L7 13.5"/></svg>',
    mus: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M5 3.5v17.2l4.6-4.3 3 6.6 3.1-1.4-3-6.5 6.4-.4z" fill="#fffdf9" stroke="#1b1915" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  };
  var PILV = '<svg viewBox="0 0 24 24" width="11" height="11" aria-label="vänsterpil" style="fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var PILH = PILV.replace('vänsterpil', 'högerpil').replace('M19 12H5M11 6l-6 6 6 6', 'M5 12h14M13 6l6 6-6 6');
  var GRUPP_IKON = { flode: 'flode', sida: 'sida', admin: 'skold', start: 'karta' };
  function el(tagg, klass, html) { var x = document.createElement(tagg); if (klass) x.className = klass; if (html != null) x.innerHTML = html; return x; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lasJson(n, std) { try { var v = JSON.parse(localStorage.getItem(n)); return v == null ? std : v; } catch (x) { return std; } }
  function skrivJson(n, v) { try { localStorage.setItem(n, JSON.stringify(v)); } catch (x) { /* privat läge */ } }
  function varde(v, ctx) { return typeof v === 'function' ? v(ctx || (aktiv && aktiv.ctx) || {}) : v; }

  // Synligt = har storlek, inte gömt och inte bakom ett annat lager (inert/hidden).
  function synlig(x) {
    if (!x || !x.isConnected) return false;
    var r = x.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var s = getComputedStyle(x);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    if (x.closest('[hidden], [inert]')) return false;
    return true;
  }
  // Ett mål kan vara en väljare, en lista med väljare (första synliga vinner) eller en funktion.
  function hitta(mal, ctx) {
    mal = varde(mal, ctx);
    if (!mal) return null;
    if (mal.nodeType === 1) return synlig(mal) ? mal : null;
    var lista = Array.isArray(mal) ? mal : [mal];
    for (var i = 0; i < lista.length; i++) {
      var s = varde(lista[i], ctx);
      if (!s) continue;
      if (s.nodeType === 1) { if (synlig(s)) return s; continue; }
      var alla;
      try { alla = document.querySelectorAll(s); } catch (x) { continue; }
      for (var j = 0; j < alla.length; j++) {
        if (alla[j].closest('.ihg, .ihg-meny, .ihg-knapp, .ihg-hej')) continue;
        if (synlig(alla[j])) return alla[j];
      }
    }
    return null;
  }

  /* --- Roller ---------------------------------------------------------- */
  function roll() {
    var jag = IH.jag ? IH.jag() : null;
    var riktig = IH.riktigJag ? IH.riktigJag() : jag;
    var support = !!(IH.visarSom && IH.visarSom());
    return {
      jag: jag, support: support,
      admin: !!(riktig && riktig.roll === 'admin' && !support),
      salj: !!(jag && jag.roll !== 'admin'),
      chef: !!(jag && jag.chef && jag.roll !== 'admin')
    };
  }
  // roller: ['salj'] = säljare (och admin i supportläge), ['chef'], ['admin']. Tomt = alla.
  function rollOk(roller) {
    if (!roller || !roller.length) return true;
    var r = roll();
    return roller.some(function (x) { return (x === 'salj' && r.salj) || (x === 'chef' && r.chef) || (x === 'admin' && r.admin) || (x === 'support' && r.support); });
  }
  G.roll = roll;
  G.rollOk = rollOk;

  /* --- Register ---------------------------------------------------------- */
  G.registrera = function (t) {
    (Array.isArray(t) ? t : [t]).forEach(function (tur) {
      var n = TURER.findIndex(function (x) { return x.id === tur.id; });
      if (n >= 0) TURER[n] = tur; else TURER.push(tur);
    });
    if (menyEl) ritaMeny();
  };
  G.tur = function (id) { return TURER.filter(function (t) { return t.id === id; })[0] || null; };
  G.klara = function () { return lasJson(LS_KLARA, {}); };
  function markeraKlar(id) { var k = G.klara(); k[id] = new Date().toISOString(); skrivJson(LS_KLARA, k); }
  G.nollstall = function () { skrivJson(LS_KLARA, {}); try { localStorage.removeItem(LS_SETT); } catch (x) { /* */ } if (menyEl) ritaMeny(); uppdateraKnapp(); };

  // Den tur som hör till sidan man står på (tur.vy = vy, tur.vyDel = true för undersidor).
  G.turForSidan = function () {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var vy = h[0] || 'oversikt', del = !!h[1];
    var passar = TURER.filter(function (t) { return t.vy === vy && rollOk(t.roller) && !t.dold; });
    return passar.filter(function (t) { return !!t.vyDel === del; })[0] || passar[0] || null;
  };

  /* --- Tillstånd ------------------------------------------------------------ */
  var aktiv = null;   // { tur, n, ctx, auto, dom, el, raf, ... }
  var rot, halEl, ringEl, skyltEl, bubbla, pilEl, musEl, sparr = {};

  function byggLager() {
    rot = el('div', 'ihg');
    rot.setAttribute('data-ihg', '');
    ['topp', 'botten', 'vanster', 'hoger', 'las'].forEach(function (k) {
      var s = el('div', 'ihg-sparr ihg-sparr--' + k);
      s.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); skaka(); });
      s.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      sparr[k] = s; rot.appendChild(s);
    });
    halEl = el('div', 'ihg-hal'); rot.appendChild(halEl);
    ringEl = el('div', 'ihg-ring'); rot.appendChild(ringEl);
    skyltEl = el('div', 'ihg-skylt', SVG.hand + '<span>Klicka här</span>'); rot.appendChild(skyltEl);
    bubbla = el('div', 'ihg-bubbla');
    bubbla.setAttribute('role', 'dialog');
    bubbla.setAttribute('aria-modal', 'false');
    bubbla.setAttribute('aria-labelledby', 'ihg-rubrik');
    bubbla.setAttribute('aria-describedby', 'ihg-text');
    bubbla.tabIndex = -1;
    bubbla.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    bubbla.addEventListener('click', klickBubbla);
    rot.appendChild(bubbla);
    musEl = el('div', 'ihg-mus', SVG.mus); rot.appendChild(musEl);
    document.body.appendChild(rot);
    requestAnimationFrame(function () { rot.classList.add('syns'); });
  }
  function rivLager() {
    if (!rot) return;
    var r = rot; rot = null;
    r.classList.remove('syns');
    bubbla && bubbla.classList.remove('syns');
    ringEl && ringEl.classList.remove('syns');
    setTimeout(function () { r.remove(); }, lugn() ? 0 : 380);
  }
  function skaka() {
    if (!bubbla || lugn()) return;
    bubbla.classList.remove('skaka'); void bubbla.offsetWidth; bubbla.classList.add('skaka');
  }

  /* --- Starta och stänga ----------------------------------------------------- */
  G.starta = function (id, opt) {
    opt = opt || {};
    var tur = typeof id === 'object' ? id : G.tur(id);
    if (!tur) { console.warn('IH.guide: ingen tur som heter', id); return false; }
    G.stangMeny(true); stangHej();
    if (aktiv) G.stang(true);
    if (!rollOk(tur.roller)) {
      if (IH.toast) IH.toast('Den här guiden gäller inte ditt konto', tur.rollText || 'Byt konto eller gå in i en säljares konto via supportläget.', 'info');
      return false;
    }
    aktiv = { tur: tur, n: -1, ctx: {}, auto: !!opt.auto, takt: opt.takt || 1, vidSlut: opt.vidSlut || null, stegId: 0, forraVanta: [] };
    try { skrivJson('ih-guide-pagar', { id: tur.id, tid: Date.now() }); } catch (x) { /* */ }
    if (typeof tur.fore === 'function') { try { tur.fore(aktiv.ctx); } catch (x) { console.warn(x); } }
    // Chattfönstret ställs åt sidan under turen, så att inget det pekar på hamnar under fönstret
    if (IH.chattUndan) IH.chattUndan(true);
    byggLager();
    document.addEventListener('keydown', tangent, true);
    document.addEventListener('click', klickFangst, true);
    window.addEventListener('resize', schemalagg);
    aktiv.raf = requestAnimationFrame(folj);
    sand('start');
    visa(0, 1);
    return true;
  };

  G.stang = function (tyst) {
    if (!aktiv) return;
    var a = aktiv; aktiv = null;
    cancelAnimationFrame(a.raf);
    clearTimeout(a.letTimer); clearTimeout(a.autoTimer); clearTimeout(a.vantaTimer);
    document.removeEventListener('keydown', tangent, true);
    document.removeEventListener('click', klickFangst, true);
    window.removeEventListener('resize', schemalagg);
    try { localStorage.removeItem('ih-guide-pagar'); } catch (x) { /* */ }
    rivLager();
    if (IH.chattUndan) IH.chattUndan(false);
    if (!tyst) sand('slut', a);
    if (a.vidSlut) { try { a.vidSlut(a); } catch (x) { /* */ } }
  };
  G.nasta = function () { if (!aktiv || aktiv.pagar === aktiv.stegId) return; var s = steg(); if (s && s.vanta && aktiv.el && !aktiv.fallback) { gorKlick(s, aktiv.el); return; } visa(aktiv.n + 1, 1); };
  G.forra = function () { if (aktiv && kanBakat()) visa(aktiv.n - 1, -1); };
  G.lage = function () {
    if (!aktiv) return { aktiv: false };
    var s = steg();
    return { aktiv: true, tur: aktiv.tur.id, namn: aktiv.tur.namn, n: aktiv.n, antal: aktiv.tur.steg.length, rubrik: s ? varde(s.rubrik) : '', hittad: !!aktiv.el, klar: !!aktiv.klar, fallback: !!aktiv.fallback, visad: aktiv.visadId === aktiv.stegId, harMal: !!(s && s.mal), vanta: !!(s && s.vanta) };
  };
  function steg() { return aktiv && aktiv.tur.steg[aktiv.n]; }
  function sand(typ, a) {
    a = a || aktiv;
    try { window.dispatchEvent(new CustomEvent('ih-guide', { detail: { typ: typ, tur: a && a.tur.id, n: a && a.n } })); } catch (x) { /* */ }
  }
  function kanBakat() {
    if (!aktiv || aktiv.n <= 0) return false;
    // Ett steg där användaren gjorde något (klickade) går inte att ångra – då stannar Föregående.
    var forra = aktiv.tur.steg[aktiv.n - 1];
    return !(forra && (forra.vanta || forra.ingenBakat));
  }

  /* --- Visa ett steg --------------------------------------------------------- */
  function visa(n, riktning) {
    if (!aktiv) return;
    var tur = aktiv.tur;
    clearTimeout(aktiv.letTimer); clearTimeout(aktiv.autoTimer); clearTimeout(aktiv.vantaTimer);
    if (n >= tur.steg.length) { klar(); return; }
    if (n < 0) n = 0;
    var s = tur.steg[n];
    // Steg som inte gäller rollen eller läget hoppas över.
    var hoppa = false;
    try { hoppa = (s.roller && !rollOk(s.roller)) || (s.om && !s.om(aktiv.ctx)); } catch (x) { hoppa = true; }
    if (hoppa) { aktiv.n = n; visa(n + (riktning < 0 ? -1 : 1), riktning); return; }
    aktiv.n = n; aktiv.el = null; aktiv.fallback = false; aktiv.stegId++;
    var mittId = aktiv.stegId;
    aktiv.flytt = true;
    rot.classList.add('ihg--flytt');
    clearTimeout(aktiv.flyttTimer);
    aktiv.flyttTimer = setTimeout(function () { if (rot) rot.classList.remove('ihg--flytt'); }, 650);

    if (typeof s.fore === 'function') { try { s.fore(aktiv.ctx); } catch (x) { console.warn('IH.guide fore', x); } }
    var sida = varde(s.sida, aktiv.ctx);
    if (sida && !paSidan(sida, s.sidaPrefix)) {
      if (!s.behallArk && IH.stangArk) IH.stangArk(true);
      if (location.hash === sida && IH.rita) IH.rita(); else location.hash = sida;
    }
    var mal = s.mal;
    if (!mal) { visaSteg(null); return; }
    // Letar efter elementet (vyn kan behöva ritas, en panel glida in …)
    var start = performance.now(), max = s.vantaMs || 8000, visatLetar = false;
    (function leta() {
      if (!aktiv || aktiv.stegId !== mittId) return;
      var x = hitta(mal, aktiv.ctx);
      if (x) { framfor(x, s, function () { if (aktiv && aktiv.stegId === mittId) visaSteg(x); }); return; }
      if (!visatLetar && performance.now() - start > 600) { visatLetar = true; visaLetar(s); }
      if (s.valfri && performance.now() - start > (s.vantaMs || 2500)) { visa(aktiv.n + (riktning < 0 ? -1 : 1), riktning); return; }
      if (performance.now() - start > max) { aktiv.fallback = true; visaSteg(null, true); return; }
      aktiv.letTimer = setTimeout(leta, 120);
    })();
  }
  function paSidan(sida, prefix) {
    var h = location.hash || '#/';
    var norm = function (x) { return (x === '#' || x === '' ? '#/' : x).replace(/\/$/, '') || '#'; };
    if (norm(h) === norm(sida)) return true;
    return !!prefix && norm(h).indexOf(norm(sida) + '/') === 0;
  }
  // Rullar fram elementet (mitt i fönstret) och väntar tills rullningen har lagt sig.
  function framfor(x, s, klar) {
    if (s.rulla === false) { klar(); return; }
    var r = x.getBoundingClientRect(), H = window.innerHeight, W = window.innerWidth;
    var marg = mobil() ? 120 : 90;
    var inne = r.top >= marg * 0.5 && r.bottom <= H - marg && r.left >= 0 && r.right <= W;
    if (inne || (r.height > H * 0.8 && r.top >= 0 && r.top < H * 0.35)) { klar(); return; }
    x.scrollIntoView({ block: s.block || (r.height > H * 0.7 ? 'start' : 'center'), inline: 'nearest', behavior: lugn() || (aktiv && aktiv.auto && false) ? 'auto' : 'smooth' });
    var forra = null, lika = 0, t0 = performance.now();
    (function vanta() {
      if (!aktiv) return;
      var y = x.getBoundingClientRect().top;
      if (forra !== null && Math.abs(y - forra) < 0.5) lika++; else lika = 0;
      forra = y;
      if (lika >= 4 || performance.now() - t0 > 1400) { klar(); return; }
      requestAnimationFrame(vanta);
    })();
  }

  function knapparHtml(s, sista, fallback) {
    var vanta = s.vanta && !fallback;
    var bak = kanBakat() ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="forra" aria-label="Föregående">' + SVG.pilv + '</button>' : '';
    var fyll = s.fyll && !fallback ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="fyll">Fyll i exempel</button>' : '';
    var fram = vanta
      ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="nasta">Gör det åt mig</button>'
      : '<button type="button" class="ihg-k ihg-k--mork" data-ihg="nasta">' + (sista ? 'Klart' + SVG.bock : (s.knapp || 'Nästa') + SVG.pil) + '</button>';
    return '<div class="ihg-knappar">' + (sista ? '' : '<button type="button" class="ihg-k ihg-k--svag" data-ihg="hoppa">Hoppa över</button>') + '<span class="ihg-tom"></span>' + fyll + bak + fram + '</div>';
  }
  function visaLetar(s) {
    if (!aktiv || !bubbla) return;
    sattHal(null); ringEl.classList.remove('syns'); skyltEl.classList.remove('syns');
    bubbla.className = 'ihg-bubbla ihg-bubbla--mitt syns';
    bubbla.innerHTML = '<div class="ihg-bubbla__inne"><div class="ihg-bubbla__topp"><span class="ihg-tur">' + esc(aktiv.tur.namn) + '</span><span class="ihg-raknare">' + (aktiv.n + 1) + ' / ' + aktiv.tur.steg.length + '</span>' +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng guiden">' + SVG.stang + '</button></div>' +
      '<h3 id="ihg-rubrik">' + varde(s.rubrik) + '</h3><p class="ihg-letar" id="ihg-text"><i></i>Öppnar rätt ställe i CRM:et …</p></div>';
    placeraMitt();
  }

  function visaSteg(x, fallback) {
    if (!aktiv || !rot) return;
    var s = steg(), tur = aktiv.tur, n = aktiv.n, sista = n === tur.steg.length - 1;
    aktiv.el = x;
    aktiv.visadId = aktiv.stegId;
    aktiv.vantaKlick = !!(s.vanta && x);
    var text = varde(s.text, aktiv.ctx) || '';
    if (fallback) text = '<p>' + (varde(s.saknas, aktiv.ctx) || 'Den här delen syns inte just nu – den kan bero på ditt konto, fönstrets storlek eller datan. Gå vidare med Nästa.') + '</p>' + (text ? '<p style="opacity:.75">' + text + '</p>' : '');
    var mitt = !x;
    var framsteg = (n + 1) / tur.steg.length;
    bubbla.className = 'ihg-bubbla ihg-bubbla--ny' + (mitt ? ' ihg-bubbla--mitt' : '');
    bubbla.innerHTML = '<i class="ihg-pil" hidden></i><div class="ihg-bubbla__inne">' +
      '<div class="ihg-bubbla__topp"><span class="ihg-tur">' + esc(tur.namn) + '</span><span class="ihg-raknare">' + (n + 1) + ' / ' + tur.steg.length + '</span>' +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng guiden (Esc)">' + SVG.stang + '</button></div>' +
      '<h3 id="ihg-rubrik">' + varde(s.rubrik, aktiv.ctx) + '</h3>' +
      '<div class="ihg-text" id="ihg-text">' + (/^\s*</.test(text) ? text : '<p>' + text + '</p>') + '</div>' +
      '<p class="ihg-gor"' + (s.vanta && x ? '' : ' hidden') + '>' + SVG.hand + '<span>' + esc(varde(s.gor, aktiv.ctx) || 'Klicka på det markerade för att gå vidare') + '</span></p>' +
      '<div class="ihg-framsteg"><i style="--a:' + framsteg.toFixed(3) + '"></i></div>' +
      knapparHtml(s, sista, fallback) +
      (n === 0 && !mobil() ? '<p class="ihg-tips"><kbd>' + PILV + '</kbd> <kbd>' + PILH + '</kbd> bläddra · <kbd>Esc</kbd> stäng</p>' : '') + '</div>';
    pilEl = bubbla.querySelector('.ihg-pil');
    // Hålet: spärra klick i hålet om steget inte vill att man gör något där.
    var fri = !!(x && (s.vanta || s.fri));
    sparr.las.hidden = fri;
    ringEl.className = 'ihg-ring' + (s.vanta && x ? ' ihg-ring--klicka' : '');
    skyltEl.querySelector('span').textContent = varde(s.skylt, aktiv.ctx) || 'Klicka här';
    placera(true);
    requestAnimationFrame(function () {
      if (!bubbla) return;
      bubbla.classList.add('syns');
      if (x) ringEl.classList.add('syns');
      if (s.vanta && x && !mobil()) skyltEl.classList.add('syns'); else skyltEl.classList.remove('syns');
    });
    // Fokus till bubblan (så att piltangenterna och skärmläsaren hamnar rätt) – utom när man ska skriva i hålet.
    if (!(s.fri && x) && !aktiv.auto) { try { bubbla.focus({ preventScroll: true }); } catch (e) { /* */ } }
    sand('steg');
    if (aktiv.auto) autoSteg(s, x, fallback);
  }

  /* --- Placering -------------------------------------------------------------- */
  var senast = '';
  function schemalagg() { senast = ''; }
  function folj() {
    if (!aktiv) return;
    // Ett fullskärmslager (presentationen) visar bara sina egna barn – flytta in guiden där.
    var fs = document.fullscreenElement;
    var mal = fs && fs !== document.documentElement ? fs : document.body;
    if (rot && rot.parentNode !== mal) mal.appendChild(rot);
    if (aktiv.el && !aktiv.el.isConnected) {
      // Elementet ritades om – leta upp det nya.
      var ny = hitta(steg().mal, aktiv.ctx);
      if (ny) aktiv.el = ny;
    }
    placera(false);
    aktiv.raf = requestAnimationFrame(folj);
  }
  function rekt() {
    var s = steg(), x = aktiv && aktiv.el;
    if (!x || !synlig(x)) return null;
    var r = x.getBoundingClientRect();
    var p = s.luft != null ? s.luft : 8;
    var W = window.innerWidth, H = window.innerHeight;
    var l = Math.max(4, r.left - p), t = Math.max(4, r.top - p), h_ = Math.min(H - 4, r.bottom + p), v = Math.min(W - 4, r.right + p);
    if (v - l < 4 || h_ - t < 4) return { left: r.left, top: r.top, width: 0, height: 0, ute: true };
    var rad = s.rund != null ? s.rund : Math.min(22, parseFloat(getComputedStyle(x).borderTopLeftRadius) + p || 14);
    return { left: l, top: t, width: v - l, height: h_ - t, rad: rad };
  }
  function sattHal(r) {
    if (!halEl) return;
    if (!r) {
      halEl.style.cssText = 'left:50%;top:50%;width:0;height:0;border-radius:50%';
      ringEl.style.cssText = 'left:50%;top:50%;width:0;height:0';
      ['topp', 'botten', 'vanster', 'hoger'].forEach(function (k) { sparr[k].style.cssText = 'left:0;top:0;width:0;height:0'; });
      sparr.topp.style.cssText = 'left:0;top:0;right:0;bottom:0';
      sparr.las.style.cssText = 'left:0;top:0;width:0;height:0';
      return;
    }
    var st = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + r.rad + 'px';
    halEl.style.cssText = st;
    ringEl.style.cssText = st;
    var W = window.innerWidth, H = window.innerHeight;
    sparr.topp.style.cssText = 'left:0;top:0;width:' + W + 'px;height:' + r.top + 'px';
    sparr.botten.style.cssText = 'left:0;top:' + (r.top + r.height) + 'px;width:' + W + 'px;height:' + Math.max(0, H - r.top - r.height) + 'px';
    sparr.vanster.style.cssText = 'left:0;top:' + r.top + 'px;width:' + r.left + 'px;height:' + r.height + 'px';
    sparr.hoger.style.cssText = 'left:' + (r.left + r.width) + 'px;top:' + r.top + 'px;width:' + Math.max(0, W - r.left - r.width) + 'px;height:' + r.height + 'px';
    sparr.las.style.cssText = st;
  }
  function placeraMitt() {
    var W = window.innerWidth, H = window.innerHeight;
    var bw = bubbla.offsetWidth, bh = bubbla.offsetHeight;
    var top = mobil() ? H - bh - 12 : Math.max(12, (H - bh) / 2);
    bubbla.style.left = Math.round((W - bw) / 2) + 'px';
    bubbla.style.top = Math.round(top) + 'px';
    bubbla.style.setProperty('--ihg-ox', '50%'); bubbla.style.setProperty('--ihg-oy', '50%');
    if (pilEl) pilEl.hidden = true;
  }
  function placera(tvinga) {
    if (!aktiv || !bubbla) return;
    var r = rekt();
    var nyckel = r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : 'mitt';
    nyckel += '|' + window.innerWidth + 'x' + window.innerHeight + '|' + bubbla.offsetHeight;
    if (!tvinga && nyckel === senast) return;
    senast = nyckel;
    if (!r || r.ute) {
      sattHal(r && r.ute ? null : null);
      if (aktiv.el && r && r.ute) { ringEl.classList.remove('syns'); }
      placeraMitt();
      skyltEl.style.cssText = 'opacity:0';
      return;
    }
    sattHal(r);
    if (aktiv.el && bubbla.classList.contains('syns')) ringEl.classList.add('syns');
    // Skylten "Klicka här" ovanför ramens högra hörn.
    skyltEl.style.opacity = '';
    skyltEl.style.left = Math.round(Math.min(window.innerWidth - 120, r.left + r.width - 40)) + 'px';
    skyltEl.style.top = Math.round(Math.max(6, r.top - 40)) + 'px';
    var W = window.innerWidth, H = window.innerHeight, gap = 16, kant = 12;
    var bw = bubbla.offsetWidth, bh = bubbla.offsetHeight;
    var s = steg(), sida, x, y;
    if (mobil()) {
      // Mobil: kortet ligger i den kant som inte täcker det markerade.
      var nedre = H - (r.top + r.height), ovre = r.top;
      if (nedre >= bh + gap + kant || nedre >= ovre) { y = Math.max(r.top + r.height + gap, H - bh - kant); if (y + bh > H - kant) y = H - bh - kant; sida = 'under'; }
      else { y = Math.min(r.top - gap - bh, kant); if (y < kant) y = kant; sida = 'over'; }
      x = (W - bw) / 2;
      // Täcker kortet ändå det markerade? Lägg det i motsatt kant.
      if (sida === 'under' && y < r.top + r.height && ovre > nedre) { y = kant; sida = 'over'; }
    } else {
      var ordning = { under: 1, over: 1, hoger: 1, vanster: 1 };
      var vill = s.placering && s.placering !== 'auto' ? [s.placering] : [];
      var forsok = vill.concat(['under', 'over', 'hoger', 'vanster'].filter(function (k) { return vill.indexOf(k) < 0 && ordning[k]; }));
      var passar = function (k) {
        if (k === 'under') return r.top + r.height + gap + bh <= H - kant;
        if (k === 'over') return r.top - gap - bh >= kant;
        if (k === 'hoger') return r.left + r.width + gap + bw <= W - kant;
        return r.left - gap - bw >= kant;
      };
      sida = forsok.filter(passar)[0];
      if (!sida) {
        // Stort mål: lägg bubblan inne i hålets nedre högra hörn.
        sida = 'inne';
        x = Math.min(W - bw - kant, r.left + r.width - bw - 18);
        y = Math.min(H - bh - kant, r.top + r.height - bh - 18);
        x = Math.max(kant, x); y = Math.max(kant, y);
      } else if (sida === 'under' || sida === 'over') {
        x = r.left + r.width / 2 - bw / 2;
        y = sida === 'under' ? r.top + r.height + gap : r.top - gap - bh;
      } else {
        y = r.top + r.height / 2 - bh / 2;
        x = sida === 'hoger' ? r.left + r.width + gap : r.left - gap - bw;
      }
      x = Math.max(kant, Math.min(W - bw - kant, x));
      y = Math.max(kant, Math.min(H - bh - kant, y));
    }
    bubbla.style.left = Math.round(x) + 'px';
    bubbla.style.top = Math.round(y) + 'px';
    // Pilen mot mitten av det markerade.
    if (pilEl) {
      if (sida === 'inne' || mobil()) { pilEl.hidden = true; }
      else {
        pilEl.hidden = false;
        pilEl.setAttribute('data-sida', sida);
        if (sida === 'under' || sida === 'over') {
          var px = Math.max(20, Math.min(bw - 36, r.left + r.width / 2 - x - 8));
          pilEl.style.left = px + 'px'; pilEl.style.top = ''; if (sida === 'under') pilEl.style.top = '-7px'; else pilEl.style.top = '';
          bubbla.style.setProperty('--ihg-ox', px + 'px'); bubbla.style.setProperty('--ihg-oy', sida === 'under' ? '0%' : '100%');
        } else {
          var py = Math.max(20, Math.min(bh - 36, r.top + r.height / 2 - y - 8));
          pilEl.style.top = py + 'px'; pilEl.style.left = '';
          bubbla.style.setProperty('--ihg-ox', sida === 'hoger' ? '0%' : '100%'); bubbla.style.setProperty('--ihg-oy', py + 'px');
        }
      }
    }
  }

  /* --- Klick och tangenter ------------------------------------------------- */
  function klickBubbla(ev) {
    var b = ev.target.closest('[data-ihg]');
    if (!b) return;
    ev.preventDefault();
    var g = b.getAttribute('data-ihg');
    if (g === 'stang' || g === 'hoppa') G.stang();
    else if (g === 'nasta') { if (aktiv && aktiv.klar) G.stang(); else G.nasta(); }
    else if (g === 'forra') G.forra();
    else if (g === 'fyll') { var s = steg(); if (s && aktiv.el) fyllI(s, aktiv.el); }
    else if (g === 'tur') { var id = b.getAttribute('data-id'); G.stang(true); setTimeout(function () { G.starta(id); }, 60); }
  }
  // Användaren klickar själv på det markerade → nästa steg när CRM:et hunnit reagera.
  function klickFangst(ev) {
    if (!aktiv || !aktiv.vantaKlick || !aktiv.el) return;
    var s = steg();
    var traff = s.klick ? ev.target.closest && ev.target.closest(varde(s.klick)) : aktiv.el.contains(ev.target);
    if (!traff) return;
    aktiv.vantaKlick = false;
    var id = aktiv.stegId;
    aktiv.pagar = id;
    aktiv.vantaTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) visa(aktiv.n + 1, 1); }, s.efterKlick || 260);
  }
  function tangent(ev) {
    if (!aktiv) return;
    var skriver = ev.target && ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]');
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); G.stang(); return; }
    var st = steg();
    // Ett steg som väntar på en tangent (t.ex. N i presentationen) går vidare när den trycks.
    if (st && st.vanta && st.tangent && !skriver && aktiv.vantaKlick && ev.key.toLowerCase() === st.tangent) {
      aktiv.vantaKlick = false; var sid = aktiv.stegId; aktiv.pagar = sid;
      aktiv.vantaTimer = setTimeout(function () { if (aktiv && aktiv.stegId === sid) visa(aktiv.n + 1, 1); }, st.efterKlick || 400);
      return;
    }
    // Steg där sidans egna tangenter ska fungera (presentationen): guiden lägger sig inte i.
    if (st && st.tangenter) return;
    if (skriver || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); if (aktiv.klar) G.stang(); else G.nasta(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); G.forra(); }
    else if (/^(n|N|\/|\[|j|J|k|K|u|U| )$/.test(ev.key) && !ev.target.closest('.ihg-bubbla')) {
      // CRM:ets egna kortkommandon tar inte över mitt i en tur (utom när steget vill det).
      var s = steg();
      if (!(s && s.tangenter)) { ev.stopPropagation(); }
    }
  }

  /* --- Gör åt användaren (knappen och autospelet) --------------------------- */
  function satt(inp, v) {
    if (inp.type === 'radio' || inp.type === 'checkbox') { if (!inp.checked) inp.click(); return; }
    var proto = inp.tagName === 'SELECT' ? HTMLSelectElement.prototype : inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(inp, v); else inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function fyllI(s, x) {
    var f = varde(s.fyll, aktiv.ctx) || {};
    Object.keys(f).forEach(function (sel) {
      var inp = x.matches && x.matches(sel) ? x : (x.querySelector(sel) || document.querySelector(sel));
      if (inp) satt(inp, f[sel]);
    });
  }
  function gorKlick(s, x) {
    if (!aktiv) return;
    if (aktiv.pagar === aktiv.stegId) return;
    aktiv.vantaKlick = false;
    aktiv.pagar = aktiv.stegId;
    if (s.fyll) fyllI(s, x);
    var mal = s.klickaPa ? hitta(s.klickaPa, aktiv.ctx) || x : x;
    var id = aktiv.stegId;
    var tryck = function () {
      if (!aktiv || aktiv.stegId !== id) return;
      try { if (typeof s.gorSjalv === 'function') s.gorSjalv(mal, aktiv.ctx); else mal.click(); } catch (e) { console.warn(e); }
      aktiv.vantaTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) visa(aktiv.n + 1, 1); }, s.efterKlick || 320);
    };
    if (aktiv.auto) flyttaMus(mal, tryck); else tryck();
  }
  // Muspekaren i autospelet glider till målet och "trycker".
  var musPos = null;
  function flyttaMus(x, klar) {
    var r = x.getBoundingClientRect();
    var mx = r.left + Math.min(r.width / 2, 60), my = r.top + Math.min(r.height / 2, 28);
    if (!musPos) musPos = { x: window.innerWidth * 0.62, y: window.innerHeight * 0.8 };
    musEl.classList.add('syns');
    var fran = musPos, t0 = performance.now(), tid = lugn() ? 0 : 750;
    (function steg_(nu) {
      if (!aktiv) return;
      var t = tid ? Math.min(1, (nu - t0) / tid) : 1, e = 1 - Math.pow(1 - t, 3);
      var px = fran.x + (mx - fran.x) * e, py = fran.y + (my - fran.y) * e;
      musEl.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
      if (t < 1) { requestAnimationFrame(steg_); return; }
      musPos = { x: mx, y: my };
      musEl.classList.remove('tryck'); void musEl.offsetWidth; musEl.classList.add('tryck');
      setTimeout(klar, 260);
    })(t0);
  }
  function lasTid(s) {
    var t = String(varde(s.text) || '').replace(/<[^>]+>/g, '') + ' ' + String(varde(s.rubrik) || '');
    return Math.max(2600, Math.min(9000, 1400 + t.length * 38));
  }
  function autoSteg(s, x, fallback) {
    var id = aktiv.stegId;
    var tid = (s.tid || lasTid(s)) / (aktiv.takt || 1);
    if (s.vanta && x && !fallback) {
      aktiv.autoTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) gorKlick(s, x); }, Math.min(tid, 3400));
    } else {
      if (s.fyll && x && aktiv.auto) setTimeout(function () { if (aktiv && aktiv.stegId === id) fyllI(s, x); }, 700);
      aktiv.autoTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) visa(aktiv.n + 1, 1); }, tid);
    }
  }

  /* --- Klart! ------------------------------------------------------------- */
  function klar() {
    if (!aktiv) return;
    var tur = aktiv.tur;
    markeraKlar(tur.id);
    uppdateraKnapp();
    aktiv.klar = true; aktiv.el = null;
    sattHal(null); ringEl.classList.remove('syns'); skyltEl.classList.remove('syns'); musEl.classList.remove('syns');
    var nasta = tur.nasta ? G.tur(tur.nasta) : null;
    if (nasta && !rollOk(nasta.roller)) nasta = null;
    var antal = TURER.filter(function (t) { return rollOk(t.roller) && !t.dold; });
    var k = G.klara(), gjorda = antal.filter(function (t) { return k[t.id]; }).length;
    bubbla.className = 'ihg-bubbla ihg-bubbla--mitt ihg-bubbla--ny';
    bubbla.innerHTML = '<div class="ihg-bubbla__inne"><div class="ihg-bubbla__topp"><span class="ihg-tur">' + esc(tur.namn) + '</span><span class="ihg-raknare">' + gjorda + ' / ' + antal.length + ' guider</span>' +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng">' + SVG.stang + '</button></div>' +
      '<span class="ihg-klar-ikon">' + SVG.trofe + '</span><h3 id="ihg-rubrik">' + esc(tur.klarRubrik || 'Snyggt – guiden är klar!') + '</h3>' +
      '<div class="ihg-text" id="ihg-text"><p>' + (tur.klarText || 'Du hittar alla guider under knappen <b>Guide</b> nere i hörnet, eller med <kbd>?</kbd>.') + '</p></div>' +
      '<div class="ihg-framsteg"><i style="--a:1"></i></div><div class="ihg-knappar"><span class="ihg-tom"></span>' +
      '<button type="button" class="ihg-k ihg-k--kant" data-ihg="stang">Stäng</button>' +
      (nasta ? '<button type="button" class="ihg-k ihg-k--barn" data-ihg="tur" data-id="' + esc(nasta.id) + '">Nästa: ' + esc(nasta.namn) + SVG.pil + '</button>' : '') + '</div></div>';
    requestAnimationFrame(function () { if (bubbla) { bubbla.classList.add('syns'); placeraMitt(); } });
    if (IH.konfetti && !aktiv.auto) IH.konfetti(window.innerWidth / 2, window.innerHeight / 2 - 80);
    sand('klar');
    if (aktiv.auto) { var a = aktiv; aktiv.autoTimer = setTimeout(function () { if (aktiv === a) G.stang(); }, 2600); }
    else { try { bubbla.querySelector('.ihg-k--barn, .ihg-k--kant').focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  /* --- Hjälpknappen och guidemenyn --------------------------------------------- */
  var knappEl = null, menyEl = null, hejEl = null;
  function antalFor() {
    var l = TURER.filter(function (t) { return rollOk(t.roller) && !t.dold; }), k = G.klara();
    return { alla: l.length, klara: l.filter(function (t) { return k[t.id]; }).length };
  }
  function uppdateraKnapp() {
    if (!knappEl) return;
    var a = antalFor(), andel = a.alla ? a.klara / a.alla : 0, omkrets = 2 * Math.PI * 18;
    var c = knappEl.querySelector('.ihg-knapp__ring circle:last-child');
    if (c) { c.setAttribute('stroke-dasharray', omkrets.toFixed(1)); c.setAttribute('stroke-dashoffset', (omkrets * (1 - andel)).toFixed(1)); }
    knappEl.title = 'Guider – ' + a.klara + ' av ' + a.alla + ' klara (?)';
  }
  function byggKnapp() {
    if (knappEl || !document.body) return;
    knappEl = el('button', 'ihg-knapp',
      '<span class="ihg-knapp__ikon"><svg class="ihg-knapp__ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="18"/></svg>?</span><span class="ihg-knapp__text">Guide</span>');
    knappEl.type = 'button';
    knappEl.setAttribute('aria-haspopup', 'dialog');
    knappEl.setAttribute('aria-expanded', 'false');
    knappEl.setAttribute('aria-label', 'Guider och rundturer');
    knappEl.addEventListener('click', function () { G.vaxlaMeny(); });
    document.body.appendChild(knappEl);
    uppdateraKnapp();
  }
  function turRad(t, klara) {
    var ok = rollOk(t.roller), klar = !!klara[t.id];
    return '<button type="button" class="ihg-rad' + (klar ? ' ihg-rad--klar' : '') + '" data-ihg-tur="' + esc(t.id) + '"' + (ok ? '' : ' disabled title="' + esc(t.rollText || 'Gäller inte ditt konto') + '"') + '>' +
      '<span class="ihg-rad__ikon">' + (klar ? SVG.bock : SVG[GRUPP_IKON[t.grupp] || 'sida']) + '</span>' +
      '<span class="ihg-rad__text"><b>' + esc(t.namn) + '</b><small>' + esc(ok ? t.beskrivning || '' : (t.rollText || 'Gäller inte ditt konto')) + '</small></span>' +
      '<span class="ihg-rad__tid">' + t.steg.length + ' steg</span></button>';
  }
  function ritaMeny() {
    if (!menyEl) return;
    var a = antalFor(), k = G.klara(), r = roll();
    var har = G.turForSidan();
    var grupper = [['start', 'Kom igång'], ['flode', 'Flöden från start till slut'], ['sida', 'Sidorna en och en'], ['admin', 'Ledning och admin']];
    var kropp = (har ? '<button type="button" class="ihg-har" data-ihg-tur="' + esc(har.id) + '"><span class="ihg-har__ikon">' + SVG.spela + '</span><span><b>Guida mig på den här sidan</b><small>' + esc(har.namn) + ' · ' + har.steg.length + ' steg</small></span></button>' : '') +
      (r.admin ? '<p class="ihg-meny__las">Du är inloggad som administratör. Säljarnas guider körs i en säljares konto – starta guiden <b>Supportläget</b> för att se hur.</p>' : '') +
      grupper.map(function (g) {
        var l = TURER.filter(function (t) { return (t.grupp || 'sida') === g[0] && !t.dold && (rollOk(t.roller) || g[0] !== 'admin' || r.admin); });
        if (!l.length) return '';
        l.sort(function (x, y) { return (rollOk(y.roller) ? 1 : 0) - (rollOk(x.roller) ? 1 : 0); });
        var klara = l.filter(function (t) { return k[t.id]; }).length;
        return '<div class="ihg-grupp"><p><span>' + g[1] + '</span><span>' + klara + ' / ' + l.length + '</span></p>' + l.map(function (t) { return turRad(t, k); }).join('') + '</div>';
      }).join('');
    menyEl.innerHTML = '<div class="ihg-meny__topp"><small>Legohus CRM</small><h2>Guider</h2><p>Korta rundturer med pekare som visar var allt finns – och hela säljflödet från förfrågan till överlämning.</p>' +
      '<button type="button" class="ihg-x" data-ihg-m="stang" aria-label="Stäng">' + SVG.stang + '</button>' +
      '<div class="ihg-meny__framsteg"><span><i style="--a:' + (a.alla ? a.klara / a.alla : 0).toFixed(3) + '"></i></span><b>' + a.klara + ' av ' + a.alla + ' klara</b></div></div>' +
      '<div class="ihg-meny__kropp">' + kropp + '</div>' +
      '<div class="ihg-meny__fot"><a href="guide/presentation.html">' + SVG.bild + 'Presentation</a><a href="guide/video.html">' + SVG.film + 'Video</a>' +
      '<button type="button" class="ihg-hoger" data-ihg-m="nollstall" title="Börja om – alla guider markeras som ej gjorda">' + SVG.nollstall + 'Börja om</button></div>';
  }
  G.oppna = function () {
    if (aktiv) return;
    stangHej();
    if (!menyEl) {
      menyEl = el('aside', 'ihg-meny');
      menyEl.setAttribute('role', 'dialog');
      menyEl.setAttribute('aria-label', 'Guider');
      menyEl.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-ihg-tur]');
        if (t && !t.disabled) { G.starta(t.getAttribute('data-ihg-tur')); return; }
        var m = ev.target.closest('[data-ihg-m]');
        if (!m) return;
        if (m.getAttribute('data-ihg-m') === 'stang') G.stangMeny();
        else if (m.getAttribute('data-ihg-m') === 'nollstall') { G.nollstall(); }
      });
      document.body.appendChild(menyEl);
      document.addEventListener('pointerdown', utanforMeny, true);
    }
    ritaMeny();
    if (knappEl) knappEl.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { if (menyEl) { menyEl.classList.add('syns'); var f = menyEl.querySelector('.ihg-har, .ihg-rad:not(:disabled)'); if (f) f.focus({ preventScroll: true }); } });
  };
  G.stangMeny = function (direkt) {
    if (!menyEl) return;
    var m = menyEl; menyEl = null;
    document.removeEventListener('pointerdown', utanforMeny, true);
    if (knappEl) knappEl.setAttribute('aria-expanded', 'false');
    m.classList.remove('syns');
    setTimeout(function () { m.remove(); }, direkt || lugn() ? 0 : 320);
  };
  G.vaxlaMeny = function () { if (menyEl) G.stangMeny(); else G.oppna(); };
  function utanforMeny(ev) { if (menyEl && !menyEl.contains(ev.target) && !(knappEl && knappEl.contains(ev.target))) G.stangMeny(); }

  // Välkomstkortet första gången – en inbjudan, inget som tar över.
  function visaHej() {
    if (hejEl || aktiv || lasJson(LS_SETT, false) || !G.tur('valkommen') || document.querySelector('.mote')) return;
    hejEl = el('div', 'ihg-hej', '<span class="ihg-hej__vink">' + SVG.vink + '</span><b>Ny i Legohus CRM?</b><p>Ta en rundtur på två minuter – en pekare visar var allt finns. Alla guider ligger under <b>Guide</b>.</p>' +
      '<div class="ihg-knappar"><button type="button" class="ihg-k ihg-k--svag" data-hej="nej">Inte nu</button><button type="button" class="ihg-k ihg-k--barn" data-hej="ja">Starta rundturen' + SVG.pil + '</button></div>');
    hejEl.setAttribute('role', 'dialog');
    hejEl.setAttribute('aria-label', 'Välkommen');
    hejEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-hej]'); if (!b) return;
      skrivJson(LS_SETT, true);
      var ja = b.getAttribute('data-hej') === 'ja';
      stangHej();
      if (ja) G.starta('valkommen');
    });
    document.body.appendChild(hejEl);
    requestAnimationFrame(function () { if (hejEl) hejEl.classList.add('syns'); });
  }
  function stangHej() {
    if (!hejEl) return;
    var h = hejEl; hejEl = null; h.classList.remove('syns');
    setTimeout(function () { h.remove(); }, 400);
  }

  // ? öppnar guidemenyn (utom i fält och i presentationen).
  // Esc i fångstfasen: stänger bara guidemenyn, inte ett ark eller kundmötet bakom den
  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && menyEl) { ev.preventDefault(); ev.stopPropagation(); G.stangMeny(); if (knappEl) knappEl.focus({ preventScroll: true }); }
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '?' || aktiv || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"], .mote')) return;
    ev.preventDefault(); G.vaxlaMeny();
  });

  // Layoutläget byts (Minimal/Normal/Full, layout.js skickar ih:layout): turen fortsätter, men det aktuella steget
  // letar om sitt mål – blocket kan ha dolts eller flyttats. Steg som inte gäller i det nya läget (om: …) hoppas över.
  var layoutTimer = 0;
  window.addEventListener('ih:layout', function () {
    clearTimeout(layoutTimer);
    // Efter omritningen (bytet ritar om vyn, ev. i en kort tvärtoning)
    layoutTimer = setTimeout(letaOm, 120);
  });
  // Utan att köra stegets fore eller byta sida: hoppa vidare om steget inte gäller längre, annars leta upp målet
  // igen om det doldes, byttes ut eller (från reservbubblan) nu syns.
  function letaOm() {
    if (!aktiv || aktiv.n < 0 || aktiv.klar || !rot) return;
    var s = steg(); if (!s) return;
    var hoppa = false;
    try { hoppa = !!(s.om && !s.om(aktiv.ctx)); } catch (x) { hoppa = true; }
    if (hoppa) { visa(aktiv.n + 1, 1); return; }
    if (!s.mal || aktiv.visadId !== aktiv.stegId) return;
    var forst = hitta(s.mal, aktiv.ctx);
    if (forst && forst === aktiv.el) { schemalagg(); return; }
    var id = aktiv.stegId, start = performance.now();
    clearTimeout(aktiv.letTimer); clearTimeout(aktiv.autoTimer);
    (function leta() {
      if (!aktiv || aktiv.stegId !== id) return;
      var x = hitta(s.mal, aktiv.ctx);
      if (x) { visaSteg(x); return; }
      if (performance.now() - start > 1500) { if (aktiv.el || !aktiv.fallback) { aktiv.fallback = true; visaSteg(null, true); } else if (aktiv.auto) autoSteg(s, null, true); return; }
      aktiv.letTimer = setTimeout(leta, 120);
    })();
  }

  /* --- Start ------------------------------------------------------------------ */
  function redo(fn) {
    // Väntar tills CRM:et har ritat sin första vy.
    var t0 = Date.now();
    (function koll() {
      var vy = document.getElementById('vy');
      if (vy && vy.children.length && document.querySelector('.sido, .mobilmeny')) { fn(); return; }
      if (Date.now() - t0 < 15000) setTimeout(koll, 120);
    })();
  }
  redo(function () {
    byggKnapp();
    var q = new URLSearchParams(location.search);
    var id = q.get('tur');
    if (id) {
      var auto = q.get('auto') === '1';
      try { var u = new URL(location.href); u.searchParams.delete('tur'); u.searchParams.delete('auto'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (x) { /* */ }
      skrivJson(LS_SETT, true);
      setTimeout(function () { G.starta(id, { auto: auto }); }, 500);
    } else {
      setTimeout(visaHej, 1600);
    }
  });
})();
