/* Idealhus CRM – inloggningen (prototyp, 2026-10-01).
   Ingen riktig inloggning: rollen sparas i webbläsaren och man
   skickas till CRM:et (eller dit man var på väg, ?nasta=#/...). */
(function () {
  'use strict';
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lamna(url) {
    document.body.setAttribute('data-lamnar', '');
    setTimeout(function () { location.href = url; }, lugn ? 0 : 900);
  }

  document.querySelectorAll('[data-roll]').forEach(function (b) {
    b.addEventListener('click', function () {
      try {
        localStorage.setItem('ih-crm-inloggad', '1');
        localStorage.setItem('ih-crm-jag', b.getAttribute('data-roll'));
      } catch (e) { /* privat läge */ }
      b.classList.add('vald');
      var nasta = new URLSearchParams(location.search).get('nasta') || '';
      if (nasta.indexOf('#/') !== 0) nasta = b.getAttribute('data-roll') === 'je' ? '#/produktion' : '#/';
      lamna('index.html' + nasta);
    });
  });

  document.querySelectorAll('[data-lamna]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); lamna(a.getAttribute('href')); });
  });

  // Scenen lutar efter pekaren – glaskorten ligger på olika djup.
  var scen = document.querySelector('[data-scen]');
  if (scen && !lugn && window.matchMedia('(hover: hover)').matches) {
    var bokad = false, x = 0, y = 0;
    document.addEventListener('pointermove', function (e) {
      x = e.clientX / window.innerWidth - 0.5;
      y = e.clientY / window.innerHeight - 0.5;
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(function () {
        bokad = false;
        scen.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        scen.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      });
    });
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.body.removeAttribute('data-lamnar');
  });
})();
