/* Byggplattformen – 3D-scenerna.
   Gemensamt för alla sidor med ett hus i 3D:
   - ram(mv, hus): kameran ramar in huset så att det fyller scenen (inte tomten).
   - rorelse(mv): huset glider mjukt mellan ihop (0) och isär (1) med en fjäder,
     i stället för att hoppa. mal(v) sätter målet, bygg() spelar entrén där
     lagren landar på plats, hovra(el) drar isär huset när musen är över el.
   Loopen går bara medan något rör sig, och reducerad rörelse hoppar direkt. */
(function () {
  'use strict';
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  function ram(mv, h, o) {
    o = o || {};
    if (!h) return;
    // Ramas in igen när scenen ändrar storlek.
    mv._ram = [h, o];
    if (!mv._ro && window.ResizeObserver) { mv._ro = new ResizeObserver(function () { clearTimeout(mv._rt); mv._rt = setTimeout(function () { if (mv._ram) ram(mv, mv._ram[0], mv._ram[1]); }, 60); }); mv._ro.observe(mv); }
    var vinkel = o.vinkel || '34deg 68deg';
    var fov = parseFloat(o.fov || '28') * Math.PI / 180;
    var asp = (mv.clientWidth || 4) / (mv.clientHeight || 3);
    var az = parseFloat(vinkel) * Math.PI / 180, pol = parseFloat(vinkel.split(' ')[1]) * Math.PI / 180;
    var L = h.langd + 0.7, B = h.bredd + 0.7, H = (h.nock || 4) + 0.3;
    // Husets bredd och höjd sett från kameran, och avståndet där det fyller scenen.
    var bredd = L * Math.abs(Math.cos(az)) + B * Math.abs(Math.sin(az));
    var djup = L * Math.abs(Math.sin(az)) + B * Math.abs(Math.cos(az));
    var hojd = H * Math.sin(pol) + djup * Math.cos(pol);
    var marg = o.marg || 1.12;
    var rB = (bredd / 2 * marg) / Math.tan(Math.atan(Math.tan(fov / 2) * asp));
    var rH = (hojd / 2 * marg) / Math.tan(fov / 2);
    var r = Math.max(rB, rH) + djup / 2;
    mv.setAttribute('camera-target', '0m ' + (o.hojd || H * 0.42).toFixed(2) + 'm 0m');
    mv.setAttribute('camera-orbit', vinkel + ' ' + r.toFixed(2) + 'm');
    mv.setAttribute('field-of-view', (fov * 180 / Math.PI).toFixed(1) + 'deg');
  }

  function rorelse(mv) {
    var nu = 0, fart = 0, mal = 0, raf = 0, klar = false, styvhet = 120, dampning = 22, forra = 0;
    var satt = function (v) { if (klar) mv.currentTime = Math.max(0, Math.min(1, v)) * 0.999; };
    var steg = function (t) {
      var dt = Math.min(0.05, (t - (forra || t)) / 1000); forra = t;
      // Fjäder mot målet: snabbt först, mjukt in i läget, ingen studs.
      var a = styvhet * (mal - nu) - dampning * fart;
      fart += a * dt; nu += fart * dt;
      satt(nu);
      if (Math.abs(mal - nu) > 0.0005 || Math.abs(fart) > 0.0005) raf = requestAnimationFrame(steg);
      else { nu = mal; fart = 0; satt(nu); raf = 0; forra = 0; }
    };
    var api = {
      mal: function (v, opt) {
        mal = v;
        if (opt && opt.mjuk) { styvhet = 26; dampning = 10.2; } else { styvhet = 120; dampning = 22; }
        if (lugnt()) { nu = mal; fart = 0; satt(nu); return; }
        if (!raf) { forra = 0; raf = requestAnimationFrame(steg); }
      },
      direkt: function (v) { nu = mal = v; fart = 0; satt(v); },
      bygg: function () { api.direkt(1); setTimeout(function () { api.mal(0, { mjuk: true }); }, 250); },
      hovra: function (el, isar) {
        el.addEventListener('mouseenter', function () { api.mal(isar || 0.42); });
        el.addEventListener('mouseleave', function () { api.mal(0); });
        el.addEventListener('focusin', function () { api.mal(isar || 0.42); });
        el.addEventListener('focusout', function () { api.mal(0); });
      },
      laddad: function () { klar = true; mv.play(); mv.pause(); satt(nu); }
    };
    if (mv.loaded) api.laddad();
    mv.addEventListener('load', api.laddad);
    return api;
  }

  window.BP3D = { ram: ram, rorelse: rorelse, lugnt: lugnt };
})();
