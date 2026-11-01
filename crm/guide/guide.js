/* ============================================================
   Legohus CRM – guidemotorn (IH.guide), omgjord 2026-11-01.
   Spotlight-turer: en mjuk slöja med ett urklipp runt det man ska
   titta på, en lugn ram och en glasruta med stegräknare. Hålet och
   rutan glider mellan stegen (bara transform och opacity).

   Guiden stannar aldrig: den förbereder skärmen själv (fäller ut
   menyn, byter sida, rullar fram målet) och hoppar tyst över steg
   som inte gäller. Menyläget återställs när turen slutar.

   Prova själv: ett steg med prova + klar(ctx) går vidare när
   användaren faktiskt gjort handlingen. En tur med ovning: true
   körs mot en kopia av datan – allt återställs när turen slutar
   (även om sidan laddas om mitt i), om man inte väljer Behåll.

   Framsteg per konto: ih-guide-klara:<konto>, och var man slutade
   i ih-guide-pagar:<konto>. Turerna är data i turer.js.

   API:
     IH.guide.registrera(tur | [turer])
     IH.guide.starta(id, { auto, takt, vidSlut })   – auto = autospel (videon)
     IH.guide.stang() · nasta() · forra()
     IH.guide.oppna() / stangMeny() / vaxlaMeny()   – startsidan Lär dig CRM:et
     IH.guide.fortsatt()                            – fortsätt där man slutade
     IH.guide.peka(mal, { sida, rubrik, text })     – peka ut något en gång (assistenten)
     IH.guide.turForSidan() · klara() · lage() · kurser (data i turer.js)
   Start från en länk: index.html?tur=<id>#/<sida>  (&auto=1 för autospel)
   Kortkommando: ? öppnar guidemenyn. I en tur: → nästa, ← föregående, Esc stänger.
   Inga externa bibliotek och inga inbyggda skript (CSP).
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var G = IH.guide = IH.guide || {};
  var TURER = G.turer = G.turer || [];
  var LS_KLARA = 'ih-guide-klara', LS_SETT = 'ih-guide-sett', LS_PAGAR = 'ih-guide-pagar', LS_OVNING = 'ih-guide-ovning', LS_SIDO = 'ih-guide-sido-ater';
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
    kurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5C6.5 5 9.5 5 12 6.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 6.5V19"/></svg>',
    inkorg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5 6.5 6h11l2.5 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20"/></svg>',
    folk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.5" cy="8.5" r="3.5"/><path d="M3.5 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M15.5 5.300a3.5 3.5 0 0 1 0 6.400M17.5 14.800c1.7.8 2.7 2.5 3 5.2"/></svg>',
    skarm: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M12 16.500V20M8 20h8M9.5 9l5 1.5-5 1.500z"/></svg>',
    hus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4.500l8 7"/><path d="M6.5 9.500V20h11V9.500M10 20v-5.500h4V20"/></svg>',
    dag: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M4 10.500h16M8.5 3.500v4M15.5 3.500v4M9 15l2 2 4-4"/></svg>',
    graf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.500h16M7 16v-4M12 16V7M17 16v-6.5"/></svg>',
    sok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    prat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.500V7.500a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8.500z"/><path d="M9 10.500h.01M12 10.500h.01M15 10.500h.01"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>',
    mus: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M5 3.5v17.2l4.6-4.3 3 6.6 3.1-1.4-3-6.5 6.4-.4z" fill="#fffdf9" stroke="#1b1915" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  };
  var PILV = '<svg viewBox="0 0 24 24" width="11" height="11" aria-label="vänsterpil" style="fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var PILH = PILV.replace('vänsterpil', 'högerpil').replace('M19 12H5M11 6l-6 6 6 6', 'M5 12h14M13 6l6 6-6 6');
  var GRUPP_IKON = { flode: 'flode', sida: 'sida', admin: 'skold', start: 'karta' };
  // Ungefärlig tid: en kvarts minut per steg
  function minuter(t) { return Math.max(1, Math.round(stegFor(t) * 15 / 60)); }
  function vik(x) { return String(x || '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o'); }
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
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    // Kort med data-in tonar in först när de rullats fram: de räknas som synliga så att guiden kan rulla dit
    if (+s.opacity === 0 && !x.hasAttribute('data-in')) return false;
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
  // Framstegen sparas per konto (i supportläget: det konto man är inne i)
  function konto() { var j = IH.jag ? IH.jag() : null; return (j && j.id) || 'x'; }
  G.klara = function () { var k = lasJson(LS_KLARA + ':' + konto(), null); return k || lasJson(LS_KLARA, {}); };
  function markeraKlar(id) { var k = G.klara(); k[id] = new Date().toISOString(); skrivJson(LS_KLARA + ':' + konto(), k); }
  function pagar() { return lasJson(LS_PAGAR + ':' + konto(), null); }
  function sparaPagar(id, n) { skrivJson(LS_PAGAR + ':' + konto(), { id: id, n: n, tid: Date.now() }); }
  function rensaPagar() { try { localStorage.removeItem(LS_PAGAR + ':' + konto()); } catch (x) { /* */ } }
  G.nollstall = function () { skrivJson(LS_KLARA + ':' + konto(), {}); rensaPagar(); try { localStorage.removeItem(LS_SETT); } catch (x) { /* */ } if (menyEl) ritaMeny(); uppdateraKnapp(); };

  // Den tur som hör till sidan man står på (tur.vy = vy, tur.vyDel = true för undersidor).
  G.turForSidan = function () {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var vy = h[0] || 'oversikt', del = !!h[1];
    var passar = TURER.filter(function (t) { return t.vy === vy && rollOk(t.roller) && !t.dold; });
    return passar.filter(function (t) { return !!t.vyDel === del; })[0] || passar[0] || null;
  };

  /* --- Tillstånd ------------------------------------------------------------ */
  var aktiv = null;   // { tur, n, ctx, auto, el, raf, hoppade, ovning, sidoUt, ... }
  var rot, halEl, ringEl, skyltEl, bubbla, pilEl, musEl, sparr = {}, halNu = null;

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
    requestAnimationFrame(function () { if (rot) rot.classList.add('syns'); });
  }
  function rivLager() {
    if (!rot) return;
    var r = rot; rot = null; halNu = null;
    r.classList.remove('syns');
    bubbla && bubbla.classList.remove('syns');
    ringEl && ringEl.classList.remove('syns');
    setTimeout(function () { r.remove(); }, lugn() ? 0 : 320);
  }
  function skaka() {
    if (!bubbla || lugn()) return;
    bubbla.classList.remove('skaka'); void bubbla.offsetWidth; bubbla.classList.add('skaka');
  }

  /* --- Menyn fälls ut när ett steg behöver den och återställs efteråt -------- */
  var I_MENYN = /\.sido(?:__|(?![-\w]))|\.anv\b|\.vy-vaxel/;
  function malText(m) { return Array.isArray(m) ? m.filter(function (x) { return typeof x === 'string'; }).join(' ') : typeof m === 'string' ? m : ''; }
  function sidoInfalld() { return window.innerWidth > 1100 && document.documentElement.hasAttribute('data-sido-dold'); }
  function fallUtMeny() {
    if (!aktiv || !sidoInfalld() || !IH.G || !IH.G['vaxla-sido']) return false;
    aktiv.sidoUt = true; skrivJson(LS_SIDO, true);
    IH.G['vaxla-sido']();
    return true;
  }
  function aterstallMeny(a) {
    if (!a.sidoUt) return;
    try { localStorage.removeItem(LS_SIDO); } catch (x) { /* */ }
    if (window.innerWidth > 1100 && !sidoInfalld() && IH.G && IH.G['vaxla-sido']) IH.G['vaxla-sido']();
  }

  /* --- Övning: turen körs mot en kopia av datan och allt återställs efteråt --- */
  function ovningStart(a) {
    var kopia;
    try { kopia = JSON.stringify(IH.db); } catch (x) { return; }
    a.ovning = kopia;
    try { localStorage.setItem(LS_OVNING, kopia); } catch (x) { try { sessionStorage.setItem(LS_OVNING, kopia); } catch (y) { /* bara i minnet */ } }
  }
  function ovningGlom() {
    try { localStorage.removeItem(LS_OVNING); } catch (x) { /* */ }
    try { sessionStorage.removeItem(LS_OVNING); } catch (x) { /* */ }
  }
  function ovningAter(kopia) {
    try { IH.db = JSON.parse(kopia); } catch (x) { ovningGlom(); return; }
    if (IH.spara) IH.spara();
    ovningGlom();
    if (IH.uppdateraMeny) IH.uppdateraMeny();
    // Stod man på något som bara fanns i övningen: tillbaka till listan
    var h = /^#\/([^/]+)\/(.+)$/.exec(location.hash || '');
    if (h && kopia.indexOf('"' + h[2].split('/')[0] + '"') < 0) { location.hash = '#/' + h[1]; return; }
    if (IH.rita) IH.rita();
  }
  // Sidan laddades om mitt i en övning: ta tillbaka datan från före övningen
  function ovningRester() {
    var t = null;
    try { t = localStorage.getItem(LS_OVNING) || sessionStorage.getItem(LS_OVNING); } catch (x) { /* */ }
    if (!t) return;
    ovningAter(t);
    if (IH.toast) IH.toast('Övningen är avslutad', 'Det du gjorde i guiden är borttaget. Dina data är som innan.', 'info');
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
    aktiv = { tur: tur, n: -1, ctx: {}, auto: !!opt.auto, takt: opt.takt || 1, vidSlut: opt.vidSlut || null, stegId: 0, hoppade: [], arkFore: !!document.querySelector('.ark.syns') };
    if (tur.ovning) ovningStart(aktiv);
    if (typeof tur.fore === 'function') { try { tur.fore(aktiv.ctx); } catch (x) { console.warn(x); } }
    // Chattfönstret ställs åt sidan under turen, så att inget det pekar på hamnar under fönstret
    if (IH.chattUndan) IH.chattUndan(true);
    byggLager();
    document.addEventListener('keydown', tangent, true);
    document.addEventListener('click', klickFangst, true);
    window.addEventListener('resize', schemalagg);
    aktiv.raf = requestAnimationFrame(folj);
    sand('start');
    var fran = opt.fran || 0;
    // Fortsätter man mitt i: börja på närmaste steg som själv tar fram rätt sida
    while (fran > 0 && !tur.steg[fran].sida) fran--;
    visa(fran, 1);
    return true;
  };

  // Stänger det turen har öppnat: ark, sökpalett och kontomeny (och presentationen i en övning)
  function stada(a) {
    var mote = document.querySelector('.mote [data-mote="stang"]');
    if (mote && a.tur.ovning) { try { mote.click(); } catch (x) { /* */ } }
    if (document.documentElement.hasAttribute('data-palett-oppen') && IH.stangPalett) IH.stangPalett();
    if (!a.arkFore && document.querySelector('.ark.syns') && IH.stangArk) IH.stangArk(true);
    if (IH.stangKm) { try { IH.stangKm(); } catch (x) { /* */ } }
  }
  G.stang = function (tyst) {
    if (!aktiv) return;
    var a = aktiv; aktiv = null;
    cancelAnimationFrame(a.raf);
    clearTimeout(a.letTimer); clearTimeout(a.autoTimer); clearTimeout(a.vantaTimer); clearInterval(a.provaTimer);
    document.removeEventListener('keydown', tangent, true);
    document.removeEventListener('click', klickFangst, true);
    window.removeEventListener('resize', schemalagg);
    rivLager();
    stada(a);
    if (a.ovning) ovningAter(a.ovning);
    aterstallMeny(a);
    if (IH.chattUndan) IH.chattUndan(false);
    if (!tyst) sand('slut', a);
    if (a.vidSlut) { try { a.vidSlut(a); } catch (x) { /* */ } }
    uppdateraKnapp();
  };
  G.nasta = function () {
    if (!aktiv || aktiv.pagar === aktiv.stegId) return;
    var s = steg();
    if (s && s.vanta && aktiv.el) { gorKlick(s, aktiv.el); return; }
    if (s && s.prova && s.gorSjalv && aktiv.el) { gorProva(s, aktiv.el); return; }
    visa(aktiv.n + 1, 1);
  };
  G.forra = function () { if (aktiv && kanBakat()) visa(aktiv.n - 1, -1); };
  G.fortsatt = function () {
    var p = pagar(), t = p && G.tur(p.id);
    if (t && rollOk(t.roller)) return G.starta(t.id, { fran: t.ovning ? 0 : p.n });
    var n = nastaTur();
    return n ? G.starta(n.id) : false;
  };
  // Pekar ut något en enda gång (assistentens "visa mig"). Saknas målet stängs det tyst och opt.saknas körs.
  G.peka = function (mal, opt) {
    opt = opt || {};
    return G.starta({ id: 'peka', namn: opt.namn || 'Här', tillfallig: true, dold: true, saknas: opt.saknas,
      steg: [{ sida: opt.sida, sidaPrefix: true, mal: mal, rubrik: opt.rubrik || 'Här är det', text: opt.text || '', knapp: 'Okej', vantaMs: opt.vantaMs || 4000 }] }, { vidSlut: opt.vidSlut });
  };
  G.lage = function () {
    if (!aktiv) return { aktiv: false };
    var s = steg();
    return { aktiv: true, tur: aktiv.tur.id, namn: aktiv.tur.namn, n: aktiv.n, antal: aktiv.tur.steg.length, rubrik: s ? varde(s.rubrik) : '', hittad: !!aktiv.el, klar: !!aktiv.klar, fallback: false, visad: aktiv.visadId === aktiv.stegId, harMal: !!(s && s.mal), vanta: !!(s && s.vanta), prova: !!(s && s.prova), hoppade: aktiv.hoppade.slice(), sidoUt: !!aktiv.sidoUt, ovning: !!aktiv.ovning };
  };
  function steg() { return aktiv && aktiv.tur.steg[aktiv.n]; }
  function sand(typ, a) {
    a = a || aktiv;
    try { window.dispatchEvent(new CustomEvent('ih-guide', { detail: { typ: typ, tur: a && a.tur.id, n: a && a.n } })); } catch (x) { /* */ }
  }
  function kanBakat() {
    if (!aktiv || aktiv.n <= 0) return false;
    // Ett steg där användaren gjorde något går inte att ångra – då stannar Föregående.
    var forra = aktiv.tur.steg[aktiv.n - 1];
    return !(forra && (forra.vanta || forra.prova || forra.ingenBakat));
  }
  // De steg som gäller just nu, för räknaren
  function giltiga() {
    var ut = [];
    aktiv.tur.steg.forEach(function (s, i) {
      if (aktiv.hoppade.indexOf(i) >= 0) return;
      try { if ((s.roller && !rollOk(s.roller)) || (s.om && !s.om(aktiv.ctx))) return; } catch (x) { return; }
      ut.push(i);
    });
    return ut;
  }

  /* --- Visa ett steg --------------------------------------------------------- */
  function visa(n, riktning) {
    if (!aktiv) return;
    var tur = aktiv.tur;
    clearTimeout(aktiv.letTimer); clearTimeout(aktiv.autoTimer); clearTimeout(aktiv.vantaTimer); clearInterval(aktiv.provaTimer);
    if (n >= tur.steg.length) { klar(); return; }
    if (n < 0) { n = 0; riktning = 1; }
    var s = tur.steg[n];
    // Steg som inte gäller rollen eller läget hoppas över.
    var hoppa = false;
    try { hoppa = (s.roller && !rollOk(s.roller)) || (s.om && !s.om(aktiv.ctx)); } catch (x) { hoppa = true; }
    if (hoppa) { aktiv.n = n; visa(n + (riktning < 0 ? -1 : 1), riktning); return; }
    aktiv.n = n; aktiv.el = null; aktiv.stegId++; aktiv.letar = true;
    var mittId = aktiv.stegId;
    if (rot) rot.classList.add('ihg--flytt');

    if (typeof s.fore === 'function') { try { s.fore(aktiv.ctx); } catch (x) { console.warn('IH.guide fore', x); } }
    // Är handlingen redan gjord behöver den inte göras igen
    if (s.prova && s.klar) { var gjord = false; try { gjord = s.klar(aktiv.ctx); } catch (x) { /* */ } if (gjord) { visa(n + 1, 1); return; } }
    var sida = varde(s.sida, aktiv.ctx), bytte = false;
    if (sida && !paSidan(sida, s.sidaPrefix)) {
      if (!s.behallArk && IH.stangArk) IH.stangArk(true);
      bytte = true;
      if (location.hash === sida && IH.rita) IH.rita(); else location.hash = sida;
    }
    if (s.fallUt) fallUtMeny();
    var mal = s.mal;
    if (!mal) { visaSteg(null); return; }
    // Letar efter elementet (vyn kan behöva ritas, en panel glida in …). Hittas det inte hoppas steget tyst över.
    var start = performance.now(), max = s.vantaMs || (bytte ? 7000 : s.valfri ? 2000 : 4500), visatLetar = false;
    (function leta() {
      if (!aktiv || aktiv.stegId !== mittId) return;
      var x = hitta(mal, aktiv.ctx);
      if (x) { framfor(x, s, function () { if (aktiv && aktiv.stegId === mittId) visaSteg(x); }); return; }
      // Målet ligger i den infällda menyn: fäll ut den och leta vidare
      if (!aktiv.sidoUt && sidoInfalld() && I_MENYN.test(malText(mal))) fallUtMeny();
      if (!visatLetar && performance.now() - start > 700) { visatLetar = true; visaLetar(s); }
      if (performance.now() - start > max) { hoppaTyst(riktning); return; }
      aktiv.letTimer = setTimeout(leta, 120);
    })();
  }
  function hoppaTyst(riktning) {
    if (!aktiv) return;
    aktiv.hoppade.push(aktiv.n);
    var n = aktiv.n + (riktning < 0 ? -1 : 1);
    visa(n, n < 0 ? 1 : riktning);
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

  function knapparHtml(s, sista) {
    var gor = (s.vanta || s.prova) && aktiv.el;
    if (aktiv.tur.tillfallig) return '<div class="ihg-knappar"><span class="ihg-tom"></span><button type="button" class="ihg-k ihg-k--mork" data-ihg="nasta">Okej</button></div>';
    var bak = kanBakat() ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="forra" aria-label="Föregående">' + SVG.pilv + '</button>' : '';
    var fyll = s.fyll && aktiv.el ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="fyll">Fyll i exempel</button>' : '';
    var fram = gor
      ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg="nasta">' + (s.vanta || s.gorSjalv ? 'Gör det åt mig' : 'Hoppa över') + '</button>'
      : '<button type="button" class="ihg-k ihg-k--mork" data-ihg="nasta">' + (sista ? 'Klart' + SVG.bock : (s.knapp || 'Nästa') + SVG.pil) + '</button>';
    return '<div class="ihg-knappar"><span class="ihg-tom"></span>' + fyll + bak + fram + '</div>';
  }
  // Letar det länge: rutan står kvar och visar att något händer, och den första rutan säger vad som händer
  function visaLetar(s) {
    if (!aktiv || !bubbla) return;
    if (aktiv.visadId != null) { bubbla.classList.add('ihg-bubbla--laddar'); return; }
    bubbla.className = 'ihg-bubbla ihg-bubbla--direkt ihg-bubbla--mitt syns';
    bubbla.innerHTML = '<div class="ihg-bubbla__inne"><div class="ihg-bubbla__topp"><span class="ihg-tur">' + esc(aktiv.tur.namn) + '</span>' +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng guiden">' + SVG.stang + '</button></div>' +
      '<h3 id="ihg-rubrik">' + varde(s.rubrik, aktiv.ctx) + '</h3><p class="ihg-letar" id="ihg-text"><i></i>Öppnar rätt ställe…</p></div>';
    placeraMitt();
  }

  function visaSteg(x) {
    if (!aktiv || !rot) return;
    var s = steg(), tur = aktiv.tur, n = aktiv.n;
    var forst = aktiv.visadId == null;
    var lista = giltiga(), pos = lista.indexOf(n) + 1, sista = lista[lista.length - 1] === n;
    aktiv.el = x; aktiv.letar = false;
    aktiv.visadId = aktiv.stegId;
    aktiv.vantaKlick = !!(s.vanta && x);
    if (!tur.tillfallig) sparaPagar(tur.id, n);
    var text = varde(s.text, aktiv.ctx) || '', prova = !!((s.vanta || s.prova) && x);
    var hadeSyns = bubbla.classList.contains('syns');
    bubbla.className = 'ihg-bubbla ihg-bubbla--ny' + (x ? '' : ' ihg-bubbla--mitt') + (hadeSyns ? ' syns' : '') + (forst ? ' ihg-bubbla--direkt' : '') + (tur.tillfallig ? ' ihg-bubbla--peka' : '');
    bubbla.innerHTML = '<i class="ihg-pil" hidden></i><div class="ihg-bubbla__inne">' +
      '<div class="ihg-bubbla__topp">' + (prova ? '<span class="ihg-prova">Prova själv</span>' : '<span class="ihg-tur">' + esc(tur.namn) + '</span>') +
      (tur.tillfallig ? '' : '<span class="ihg-raknare">' + pos + ' / ' + lista.length + '</span>') +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng guiden (Esc)">' + SVG.stang + '</button></div>' +
      '<h3 id="ihg-rubrik">' + varde(s.rubrik, aktiv.ctx) + '</h3>' +
      (text ? '<div class="ihg-text" id="ihg-text">' + (/^\s*</.test(text) ? text : '<p>' + text + '</p>') + '</div>' : '') +
      '<p class="ihg-gor"' + (prova ? '' : ' hidden') + '>' + SVG.hand + '<span>' + esc(varde(s.gor, aktiv.ctx) || 'Klicka på det markerade') + '</span></p>' +
      (tur.tillfallig ? '' : '<div class="ihg-framsteg"><i style="--a:' + (pos / lista.length).toFixed(3) + '"></i></div>') +
      knapparHtml(s, sista) +
      (pos === 1 && tur.ovning ? '<p class="ihg-tips">Det här är en övning. Det du gör sparas inte.</p>' : '') + '</div>';
    pilEl = bubbla.querySelector('.ihg-pil');
    // Hålet: spärra klick i hålet om steget inte vill att man gör något där.
    var fri = !!(x && (s.vanta || s.fri || s.prova));
    sparr.las.hidden = fri;
    ringEl.className = 'ihg-ring' + (s.vanta && x ? ' ihg-ring--klicka' : '') + (ringEl.classList.contains('syns') ? ' syns' : '');
    skyltEl.querySelector('span').textContent = varde(s.skylt, aktiv.ctx) || 'Klicka här';
    aktiv.glid = !forst;
    placera(true);
    aktiv.glid = false;
    requestAnimationFrame(function () {
      if (!bubbla) return;
      bubbla.classList.add('syns');
      requestAnimationFrame(function () { if (bubbla) bubbla.classList.remove('ihg-bubbla--direkt'); });
      if (x) ringEl.classList.add('syns'); else ringEl.classList.remove('syns');
      if (s.vanta && x && !mobil()) skyltEl.classList.add('syns'); else skyltEl.classList.remove('syns');
    });
    // Fokus till rutan (så att piltangenterna och skärmläsaren hamnar rätt) – utom när man ska göra något i hålet.
    if (!((s.fri || s.prova) && x) && !aktiv.auto) { try { bubbla.focus({ preventScroll: true }); } catch (e) { /* */ } }
    if (s.prova && x) foljProva(s);
    sand('steg');
    if (aktiv.auto) autoSteg(s, x);
  }

  // Prova själv: steget går vidare när användaren faktiskt har gjort det
  function foljProva(s) {
    if (!s.klar) return;
    var id = aktiv.stegId;
    clearInterval(aktiv.provaTimer);
    aktiv.provaTimer = setInterval(function () {
      if (!aktiv || aktiv.stegId !== id) return;
      var ok = false;
      try { ok = s.klar(aktiv.ctx); } catch (x) { /* */ }
      if (!ok) return;
      clearInterval(aktiv.provaTimer);
      aktiv.pagar = id;
      var g = bubbla && bubbla.querySelector('.ihg-gor');
      if (g) { g.classList.add('ihg-gor--klar'); g.innerHTML = SVG.bock + '<span>' + esc(s.bra || 'Bra gjort!') + '</span>'; }
      aktiv.vantaTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) visa(aktiv.n + 1, 1); }, s.efterKlick || (lugn() ? 300 : 750));
    }, 160);
  }
  function gorProva(s, x) {
    var id = aktiv.stegId;
    aktiv.pagar = id;
    if (s.fyll) fyllI(s, x);
    try { s.gorSjalv(x, aktiv.ctx); } catch (e) { console.warn(e); }
    // Klarvillkoret brukar slå till direkt; annars går steget vidare ändå
    aktiv.vantaTimer = setTimeout(function () { if (aktiv && aktiv.stegId === id) visa(aktiv.n + 1, 1); }, 1400);
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
    // Medan nästa steg letar står hålet och rutan kvar – de glider först när målet är hittat
    if (!aktiv.letar) placera(false);
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
  // Hålet och ramen flyttas bara med transform. Mellan två steg glider de (FLIP med Web Animations), i övrigt följer de direkt.
  function flyttaHal(r, glid) {
    var W = window.innerWidth, H = window.innerHeight;
    var m = r || { left: W / 2 - 1, top: H / 2 - 1, width: 2, height: 2, rad: 2 };
    var till = 'translate3d(' + m.left + 'px,' + m.top + 'px,0)';
    [halEl, ringEl].forEach(function (e) {
      e.style.width = m.width + 'px'; e.style.height = m.height + 'px'; e.style.borderRadius = m.rad + 'px';
      if (glid && halNu && !lugn() && e.animate) {
        // Skuggan runt hålet skalas med, så att den inte får krympa under två tredjedelar (då syns slöjans kant)
        var sx = Math.max(0.66, halNu.width / m.width), sy = Math.max(0.66, halNu.height / m.height);
        e.animate([{ transform: 'translate3d(' + halNu.left + 'px,' + halNu.top + 'px,0) scale(' + sx + ',' + sy + ')' }, { transform: till }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
      e.style.transform = till;
    });
    halNu = m;
  }
  function sattHal(r, glid) {
    if (!halEl) return;
    flyttaHal(r, glid);
    if (!r) {
      ['botten', 'vanster', 'hoger'].forEach(function (k) { sparr[k].style.cssText = 'left:0;top:0;width:0;height:0'; });
      sparr.topp.style.cssText = 'left:0;top:0;right:0;bottom:0';
      sparr.las.style.cssText = 'left:0;top:0;width:0;height:0';
      return;
    }
    var W = window.innerWidth, H = window.innerHeight;
    sparr.topp.style.cssText = 'left:0;top:0;width:' + W + 'px;height:' + r.top + 'px';
    sparr.botten.style.cssText = 'left:0;top:' + (r.top + r.height) + 'px;width:' + W + 'px;height:' + Math.max(0, H - r.top - r.height) + 'px';
    sparr.vanster.style.cssText = 'left:0;top:' + r.top + 'px;width:' + r.left + 'px;height:' + r.height + 'px';
    sparr.hoger.style.cssText = 'left:' + (r.left + r.width) + 'px;top:' + r.top + 'px;width:' + Math.max(0, W - r.left - r.width) + 'px;height:' + r.height + 'px';
    sparr.las.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
  }
  function flyttaBubbla(x, y) { bubbla.style.setProperty('--x', Math.round(x) + 'px'); bubbla.style.setProperty('--y', Math.round(y) + 'px'); }
  function placeraMitt() {
    var W = window.innerWidth, H = window.innerHeight;
    var bw = bubbla.offsetWidth, bh = bubbla.offsetHeight;
    flyttaBubbla((W - bw) / 2, mobil() ? H - bh - 12 : Math.max(12, (H - bh) / 2));
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
      sattHal(null, aktiv.glid);
      ringEl.classList.remove('syns');
      placeraMitt();
      skyltEl.style.cssText = 'opacity:0';
      return;
    }
    sattHal(r, aktiv.glid);
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
    flyttaBubbla(x, y);
    // Pilen mot mitten av det markerade.
    if (pilEl) {
      if (sida === 'inne' || mobil()) { pilEl.hidden = true; }
      else {
        pilEl.hidden = false;
        pilEl.setAttribute('data-sida', sida);
        if (sida === 'under' || sida === 'over') {
          var px = Math.max(20, Math.min(bw - 36, r.left + r.width / 2 - x - 8));
          pilEl.style.left = px + 'px'; pilEl.style.top = ''; if (sida === 'under') pilEl.style.top = '-7px'; else pilEl.style.top = '';
        } else {
          var py = Math.max(20, Math.min(bh - 36, r.top + r.height / 2 - y - 8));
          pilEl.style.top = py + 'px'; pilEl.style.left = '';
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
    if (g === 'stang') G.stang();
    else if (g === 'nasta') { if (aktiv && aktiv.klar) G.stang(); else G.nasta(); }
    else if (g === 'behall') { if (aktiv) { aktiv.ovning = null; ovningGlom(); G.stang(); } }
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
    if (ev.key === 'ArrowRight') {
      ev.preventDefault(); ev.stopPropagation();
      // Pilen gör aldrig ett Prova själv-steg åt användaren
      if (aktiv.klar) G.stang(); else if (!(st && (st.prova || st.vanta) && aktiv.el)) G.nasta();
    }
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
  function autoSteg(s, x) {
    var id = aktiv.stegId;
    var tid = (s.tid || lasTid(s)) / (aktiv.takt || 1);
    if (s.vanta && x) {
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
    if (tur.tillfallig) {
      var saknas = aktiv.hoppade.length && tur.saknas;
      G.stang(true);
      if (saknas) { try { saknas(); } catch (x) { /* */ } }
      return;
    }
    var kursFore = kursKlarFor(tur.id);
    markeraKlar(tur.id);
    G.nyKlar = tur.id;
    rensaPagar();
    uppdateraKnapp();
    clearInterval(aktiv.provaTimer);
    aktiv.klar = true; aktiv.el = null; aktiv.letar = false;
    sattHal(null, true);
    ringEl.classList.remove('syns'); skyltEl.classList.remove('syns'); musEl.classList.remove('syns');
    var nasta = tur.nasta ? G.tur(tur.nasta) : null;
    if (nasta && !rollOk(nasta.roller)) nasta = null;
    if (!nasta) nasta = nastaTur();
    var a = antalFor();
    var hadeSyns = bubbla.classList.contains('syns');
    var kursNu = kursKlarFor(tur.id), firar = kursNu && !kursFore;
    bubbla.className = 'ihg-bubbla ihg-bubbla--mitt ihg-bubbla--ny' + (hadeSyns ? ' syns' : '') + (firar ? ' ihg-bubbla--firar' : '');
    bubbla.innerHTML = '<div class="ihg-bubbla__inne"><div class="ihg-bubbla__topp"><span class="ihg-tur">' + esc(tur.namn) + '</span><span class="ihg-raknare">' + a.klara + ' / ' + a.alla + ' klara</span>' +
      '<button type="button" class="ihg-x" data-ihg="stang" aria-label="Stäng">' + SVG.stang + '</button></div>' +
      '<span class="ihg-klar-ikon">' + SVG.bock + '<i></i><i></i><i></i><i></i><i></i><i></i></span><h3 id="ihg-rubrik">' + esc(firar ? 'Kursen ' + kursNu.namn + ' är klar!' : tur.klarRubrik || 'Snyggt, klart!') + '</h3>' +
      '<div class="ihg-text" id="ihg-text"><p>' + (tur.klarText || 'Du hittar allt under <b>Lär dig CRM:et</b>.') + '</p>' +
      (aktiv.ovning ? '<p>Övningen städas bort när du stänger. Dina data är som innan.</p>' : '') + '</div>' +
      '<div class="ihg-framsteg"><i style="--a:1"></i></div><div class="ihg-knappar">' + (aktiv.ovning ? '<button type="button" class="ihg-k ihg-k--svag" data-ihg="behall">Behåll det jag gjorde</button>' : '') + '<span class="ihg-tom"></span>' +
      '<button type="button" class="ihg-k ihg-k--kant" data-ihg="stang">Stäng</button>' +
      (nasta ? '<button type="button" class="ihg-k ihg-k--barn" data-ihg="tur" data-id="' + esc(nasta.id) + '">Nästa' + SVG.pil + '</button>' : '') + '</div></div>';
    requestAnimationFrame(function () { if (bubbla) { bubbla.classList.add('syns'); placeraMitt(); } });
    if (firar && IH.konfetti && !lugn() && !aktiv.auto) IH.konfetti(window.innerWidth / 2, window.innerHeight / 2 - 80);
    sand('klar');
    if (aktiv.auto) { var av = aktiv; aktiv.autoTimer = setTimeout(function () { if (aktiv === av) G.stang(); }, 2600); }
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
    knappEl.title = 'Lär dig CRM:et: ' + a.klara + ' av ' + a.alla + ' klara';
  }
  function byggKnapp() {
    if (knappEl || !document.body) return;
    knappEl = el('button', 'ihg-knapp',
      '<span class="ihg-knapp__ikon"><svg class="ihg-knapp__ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="18"/></svg><svg class="ihg-knapp__bok" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5C6.5 5 9.5 5 12 6.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 6.5V19"/></svg></span><span class="ihg-knapp__text">Guide</span>');
    knappEl.type = 'button';
    knappEl.setAttribute('aria-haspopup', 'dialog');
    knappEl.setAttribute('aria-expanded', 'false');
    knappEl.setAttribute('aria-label', 'Lär dig CRM:et');
    knappEl.addEventListener('click', function () { G.vaxlaMeny(); });
    document.body.appendChild(knappEl);
    uppdateraKnapp();
  }
  function stegFor(t) { return t.steg.filter(function (s) { return !s.roller || rollOk(s.roller); }).length; }
  function turRad(t, klara, nt, n) {
    var klar = !!klara[t.id], nasta = nt && nt.id === t.id;
    return '<button type="button" class="ihg-rad' + (klar ? ' ihg-rad--klar' : '') + (G.nyKlar === t.id ? ' ihg-rad--ny' : '') + (nasta ? ' ihg-rad--nasta' : '') + '" style="--n:' + (n || 0) + '" data-ihg-tur="' + esc(t.id) + '">' +
      '<span class="ihg-rad__ikon">' + (klar ? SVG.bock : nasta ? SVG.spela : SVG[GRUPP_IKON[t.grupp] || 'sida']) + '</span>' +
      '<span class="ihg-rad__text"><b>' + esc(t.namn) + '</b><small>' + esc(t.beskrivning || '') + '</small></span>' +
      '<span class="ihg-rad__tid">' + (klar ? 'Klar' : nasta ? 'Nästa' : 'ca ' + minuter(t) + ' min') + '</span></button>';
  }
  // Kurserna (data i turer.js) med de turer som gäller kontot
  function kurserFor() {
    return (G.kurser || []).map(function (k) {
      var l = k.turer.map(G.tur).filter(function (t) { return t && !t.dold && rollOk(t.roller); });
      return { kurs: k, turer: l };
    }).filter(function (x) { return x.turer.length; });
  }
  function nastaTur() {
    var k = G.klara(), ut = null;
    kurserFor().some(function (x) { ut = x.turer.filter(function (t) { return !k[t.id]; })[0] || null; return !!ut; });
    return ut;
  }
  G.nastaTur = nastaTur;
  // Kursen turen tillhör, om alla dess turer är klara
  function kursKlarFor(id) {
    var k = G.klara(), x = kurserFor().filter(function (y) { return y.turer.some(function (t) { return t.id === id; }); })[0];
    return x && x.turer.every(function (t) { return k[t.id]; }) ? x.kurs : null;
  }
  function kursKort(x, k, nt, n) {
    var gjorda = x.turer.filter(function (t) { return k[t.id]; }).length, alla = x.turer.length;
    var har = nt && x.turer.indexOf(nt) >= 0, klar = gjorda === alla;
    var tid = x.turer.filter(function (t) { return !k[t.id]; }).reduce(function (m, t) { return m + minuter(t); }, 0);
    var status = klar ? 'Klar' : har ? 'Nästa' : gjorda ? 'Pågår' : 'Inte börjad';
    return '<details class="ihg-kurs' + (har ? ' ihg-kurs--nasta' : '') + (klar ? ' ihg-kurs--klar' : '') + '" style="--n:' + n + '"' + (har ? ' open' : '') + '><summary><span class="ihg-kurs__ikon">' + (klar ? SVG.bock : SVG[x.kurs.ikon] || SVG.kurs) + '</span>' +
      '<span class="ihg-kurs__text"><b>' + esc(x.kurs.namn) + '</b><small>' + esc(x.kurs.text) + '</small>' +
      '<span class="ihg-kurs__meta"><em class="ihg-status">' + status + '</em>' + gjorda + ' av ' + alla + (klar ? '' : ' · ca ' + tid + ' min kvar') + '</span></span>' +
      '<span class="ihg-kurs__pil">' + SVG.chevron + '</span></summary>' +
      '<div class="ihg-kurs__turer">' + x.turer.map(function (t, i) { return turRad(t, k, nt, i); }).join('') + '</div></details>';
  }
  function ritaKurser(q) {
    var yta = menyEl && menyEl.querySelector('.ihg-kurser'); if (!yta) return;
    var k = G.klara(), nt = nastaTur();
    q = vik(q).trim();
    if (!q) { yta.innerHTML = kurserFor().map(function (x, n) { return kursKort(x, k, nt, n); }).join(''); return; }
    // Sökningen tittar i namn, beskrivning och stegens rubriker
    var traff = [];
    kurserFor().forEach(function (x) { x.turer.forEach(function (t) {
      if (traff.indexOf(t) >= 0) return;
      var hela = vik([t.namn, t.beskrivning].concat(t.steg.map(function (s) { return typeof s.rubrik === 'string' ? s.rubrik : ''; })).join(' '));
      if (q.split(/\s+/).every(function (w) { return hela.indexOf(w) >= 0; })) traff.push(t);
    }); });
    yta.innerHTML = traff.length ? traff.map(function (t, i) { return turRad(t, k, nt, i); }).join('')
      : '<div class="ihg-tomt"><p>Ingen kurs handlar om det.</p>' + (IH.assistent ? '<button type="button" class="ihg-k ihg-k--kant" data-ihg-m="fraga">' + SVG.prat + 'Fråga assistenten</button>' : '') + '</div>';
  }
  // Förslag: guiden för sidan man står på, och det som är nytt för rollen
  function forslagFor(nt, pt) {
    var r = roll(), k = G.klara(), l = [], har = G.turForSidan();
    var lagg = function (t, varfor) { if (t && !t.dold && rollOk(t.roller) && !(nt && nt.id === t.id) && !(pt && pt.id === t.id) && !l.some(function (x) { return x.t === t; })) l.push({ t: t, varfor: varfor }); };
    if (har && !k[har.id]) lagg(har, 'För sidan du står på');
    if (r.chef && !k.chef) lagg(G.tur('chef'), 'För dig som chef');
    if (r.admin && !k.supportlage) lagg(G.tur('supportlage'), 'För dig som administratör');
    return l.slice(0, 2);
  }
  // Det man senast lärt sig, ur tidsstämplarna
  function senastLart(k) {
    var id = Object.keys(k).filter(function (x) { return G.tur(x); }).sort(function (a, b) { return k[a] < k[b] ? 1 : -1; })[0];
    return id ? G.tur(id).namn : '';
  }
  function ritaMeny() {
    if (!menyEl) return;
    var a = antalFor(), k = G.klara(), r = roll(), p = pagar(), pt = p && G.tur(p.id), nt = nastaTur();
    if (pt && (!rollOk(pt.roller) || pt.dold)) pt = null;
    var stegNr = pt ? Math.min(p.n + 1, pt.steg.length) : 0;
    var andel = a.alla ? a.klara / a.alla : 0, omkrets = 2 * Math.PI * 21, lart = senastLart(k);
    var fortsatt = pt
      ? '<button type="button" class="ihg-har" data-ihg-m="fortsatt"><span class="ihg-har__ikon">' + SVG.spela + '</span><span><b>Fortsätt där du slutade</b><small>' + esc(pt.namn) + (pt.ovning ? ' · börjar om' : ' · steg ' + stegNr) + '</small></span></button>'
      : nt ? '<button type="button" class="ihg-har" data-ihg-tur="' + esc(nt.id) + '"><span class="ihg-har__ikon">' + SVG.spela + '</span><span><b>' + (a.klara ? 'Nästa' : 'Börja här') + ': ' + esc(nt.namn) + '</b><small>' + stegFor(nt) + ' steg · ca ' + minuter(nt) + ' min</small></span></button>' : '';
    var forslag = forslagFor(nt, pt).map(function (f, i) {
      return '<button type="button" class="ihg-sidan" style="--n:' + (i + 1) + '" data-ihg-tur="' + esc(f.t.id) + '">' + SVG.karta + '<span><small>' + esc(f.varfor) + '</small><b>' + esc(f.t.namn) + '</b></span></button>';
    }).join('');
    menyEl.innerHTML = '<div class="ihg-meny__topp"><div class="ihg-figur" aria-hidden="true"></div>' +
      '<div class="ihg-meny__rubrik"><h2>Lär dig CRM:et</h2><p>Korta kurser där du provar själv. Allt är exempeldata.</p></div>' +
      '<button type="button" class="ihg-x" data-ihg-m="stang" aria-label="Stäng">' + SVG.stang + '</button></div>' +
      '<div class="ihg-meny__kropp">' +
      '<div class="ihg-lage"><span class="ihg-ring-tal"><svg viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="21"/><circle cx="25" cy="25" r="21" stroke-dasharray="' + omkrets.toFixed(1) + '" stroke-dashoffset="' + (omkrets * (1 - andel)).toFixed(1) + '"/></svg><b>' + Math.round(andel * 100) + '%</b></span>' +
      '<span class="ihg-lage__text"><b>' + a.klara + ' av ' + a.alla + ' klara</b><small>' + (lart ? 'Senast lärde du dig: ' + esc(lart) : 'Du har inte börjat än') + '</small></span></div>' +
      fortsatt + forslag +
      (r.admin ? '<p class="ihg-meny__las">Säljarnas kurser körs i en säljares konto. Starta <b>Supportläget</b> för att se hur.</p>' : '') +
      '<label class="ihg-sok">' + SVG.sok + '<input type="search" placeholder="Sök bland kurserna" aria-label="Sök bland kurserna" autocomplete="off"></label>' +
      '<div class="ihg-kurser"></div></div>' +
      '<div class="ihg-meny__fot">' + (IH.assistent ? '<button type="button" class="ihg-fraga" data-ihg-m="fraga">' + SVG.prat + 'Fråga assistenten</button>' : '') +
      '<a href="guide/presentation.html">' + SVG.bild + 'Presentation</a><a href="guide/video.html">' + SVG.film + 'Video</a>' +
      '<button type="button" class="ihg-hoger" data-ihg-m="nollstall" title="Börja om: alla kurser markeras som inte gjorda" aria-label="Börja om">' + SVG.nollstall + '</button></div>';
    ritaKurser('');
    G.nyKlar = null;
    menyFigur();
  }
  // Samma figur som assistenten, som en stillbild: panelen har ingen egen WebGL
  function menyFigur() {
    var y = menyEl && menyEl.querySelector('.ihg-figur'), b = IH.assistent && IH.assistent.figurBild ? IH.assistent.figurBild() : null;
    if (!y) return;
    if (b) { var i = new Image(); i.alt = ''; i.src = b; y.appendChild(i); menyEl.classList.add('ihg-meny--3d'); }
    else menyEl.classList.add('ihg-meny--utan');
  }
  G.oppna = function () {
    if (aktiv) return;
    stangHej();
    if (!menyEl) {
      menyEl = el('aside', 'ihg-meny');
      menyEl.setAttribute('role', 'dialog');
      menyEl.setAttribute('aria-label', 'Lär dig CRM:et');
      menyEl.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-ihg-tur]');
        if (t && !t.disabled) { G.starta(t.getAttribute('data-ihg-tur')); return; }
        var m = ev.target.closest('[data-ihg-m]');
        if (!m) return;
        if (m.getAttribute('data-ihg-m') === 'stang') G.stangMeny();
        else if (m.getAttribute('data-ihg-m') === 'fortsatt') G.fortsatt();
        else if (m.getAttribute('data-ihg-m') === 'fraga') { var q = menyEl.querySelector('.ihg-sok input'), t2 = q && q.value.trim(); G.stangMeny(true); if (IH.assistent) { if (t2) IH.assistent.fraga(t2); else IH.assistent.oppna(); } }
        else if (m.getAttribute('data-ihg-m') === 'nollstall') { G.nollstall(); }
      });
      menyEl.addEventListener('input', function (ev) { if (ev.target.matches('.ihg-sok input')) { ritaKurser(ev.target.value); } });
      document.body.appendChild(menyEl);
      document.addEventListener('pointerdown', utanforMeny, true);
    }
    ritaMeny();
    if (knappEl) knappEl.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { if (menyEl) { menyEl.classList.add('syns'); var f = menyEl.querySelector(window.innerWidth > 640 ? '.ihg-sok input' : '.ihg-x'); if (f) f.focus({ preventScroll: true }); } });
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
    hejEl = el('div', 'ihg-hej', '<span class="ihg-hej__vink">' + SVG.vink + '</span><b>Ny i Legohus CRM?</b><p>Ta en kort rundtur. Du provar själv och allt är exempeldata. Fler kurser finns under boken vid menyn.</p>' +
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
    // I CRM:et äger app.js ? (Kortkommandon, IH.G.hjalp) – öppna inte guidemenyn ovanpå arket eller paletten
    var rot = document.documentElement;
    if (ev.defaultPrevented || (window.IH && IH.G && IH.G.hjalp) || rot.hasAttribute('data-ark-oppen') || rot.hasAttribute('data-palett-oppen')) return;
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
      if (performance.now() - start > 1500) { hoppaTyst(1); return; }
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
    ovningRester();
    if (lasJson(LS_SIDO, false)) {
      try { localStorage.removeItem(LS_SIDO); } catch (x) { /* */ }
      if (window.innerWidth > 1100 && !sidoInfalld() && IH.G && IH.G['vaxla-sido']) IH.G['vaxla-sido']();
    }
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
