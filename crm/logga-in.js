/* Idealhus CRM – inloggningen (prototyp, 2026-10-02).
   Ingen riktig inloggning: rollen sparas i webbläsaren och man
   skickas till CRM:et (eller dit man var på väg, ?nasta=#/...).
   Hälsningen följer tiden på dygnet, och den som varit inne förut
   möts av "Välkommen tillbaka". */
(function () {
  'use strict';
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ROLLER = {
    ml: { namn: 'Maja Lind', forsta: 'Maja', titel: 'Sälj', av: 'linear-gradient(135deg,#f6c68d,#c98a45)', start: '#/' },
    je: { namn: 'Jonas Ek', forsta: 'Jonas', titel: 'Produktion', av: 'linear-gradient(135deg,#a8ebc3,#3f9a63)', start: '#/produktion' }
  };
  var MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var DAG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

  // Hälsning och datum.
  var nu = new Date(), h = nu.getHours();
  var halsning = h < 5 ? 'God natt' : h < 10 ? 'God morgon' : h < 14 ? 'Hej' : h < 18 ? 'God eftermiddag' : 'God kväll';
  document.body.classList.add(h < 5 || h >= 22 ? 'li--natt' : h >= 18 ? 'li--kvall' : 'li--dag');
  var hEl = document.querySelector('[data-halsning]');
  var dEl = document.querySelector('[data-datum]');
  if (hEl) hEl.textContent = halsning;
  if (dEl) dEl.textContent = DAG[nu.getDay()].charAt(0).toUpperCase() + DAG[nu.getDay()].slice(1) + ' ' + nu.getDate() + ' ' + MAN[nu.getMonth()];

  function initialer(namn) {
    return namn.split(' ').map(function (d) { return d.charAt(0); }).join('').toUpperCase();
  }

  // Välkommen-ögonblicket, sedan in i CRM:et.
  function logga(roll, knapp) {
    var r = ROLLER[roll];
    if (!r) return;
    try {
      localStorage.setItem('ih-crm-inloggad', '1');
      localStorage.setItem('ih-crm-jag', roll);
    } catch (e) { /* privat läge */ }
    if (knapp) knapp.classList.add('vald');
    var av = document.querySelector('[data-va]');
    av.textContent = initialer(r.namn);
    av.style.setProperty('--av', r.av);
    document.querySelector('[data-vtext]').textContent = halsning + ', ' + r.forsta + '.';
    var nasta = new URLSearchParams(location.search).get('nasta') || '';
    if (nasta.indexOf('#/') !== 0) nasta = r.start;
    document.body.classList.add('lamnar');
    setTimeout(function () { location.href = 'index.html' + nasta; }, lugn ? 0 : 1250);
  }

  document.querySelectorAll('[data-roll]').forEach(function (b) {
    b.addEventListener('click', function () { logga(b.getAttribute('data-roll'), b); });
  });

  // Den som varit inne förut får en genväg tillbaka.
  var forra = null;
  try { forra = localStorage.getItem('ih-crm-jag'); } catch (e) { forra = null; }
  var igen = document.querySelector('[data-igen]');
  if (igen && ROLLER[forra]) {
    var r = ROLLER[forra];
    var a = igen.querySelector('[data-igen-avatar]');
    a.textContent = initialer(r.namn);
    a.style.setProperty('--av', r.av);
    igen.querySelector('[data-igen-namn]').textContent = 'Fortsätt som ' + r.forsta + ' · ' + r.titel;
    igen.hidden = false;
    igen.addEventListener('click', function () { logga(forra, igen); });
  }

  document.querySelectorAll('[data-lamna]').forEach(function (l) {
    l.addEventListener('click', function (e) {
      e.preventDefault();
      document.body.classList.add('lamnar-ut');
      setTimeout(function () { location.href = l.getAttribute('href'); }, lugn ? 0 : 300);
    });
  });

  // Huset tonar fram när modellen är laddad (senast efter fyra sekunder).
  var hus = document.querySelector('.scen__hus');
  if (hus) {
    var visa = function () { hus.classList.add('laddad'); };
    hus.addEventListener('load', function () { setTimeout(visa, 150); });
    setTimeout(visa, 4000);
  }

  // Korten i scenen följer pekaren, olika mycket efter sitt djup.
  var scen = document.querySelector('[data-scen]');
  if (scen) {
    scen.querySelectorAll('[data-djup]').forEach(function (g) { g.style.setProperty('--d', g.getAttribute('data-djup')); });
  }
  if (scen && !lugn && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var bokad = false, x = 0, y = 0;
    document.addEventListener('pointermove', function (e) {
      x = e.clientX / window.innerWidth - 0.5;
      y = e.clientY / window.innerHeight - 0.5;
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(function () {
        bokad = false;
        scen.style.setProperty('--px', (x * -14).toFixed(1));
        scen.style.setProperty('--py', (y * -10).toFixed(1));
      });
    });
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.body.classList.remove('lamnar', 'lamnar-ut');
  });
})();
