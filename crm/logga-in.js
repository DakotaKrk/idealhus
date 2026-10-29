/* Legohus CRM – inloggningen (prototyp, 2026-10-02).
   Ingen riktig inloggning: rollen sparas i webbläsaren och man
   skickas till CRM:et (eller dit man var på väg, ?nasta=#/...).
   Hälsningen följer tiden på dygnet, och den som varit inne förut
   möts av "Välkommen tillbaka". */
(function () {
  'use strict';
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ROLLER = {
    ah: { namn: 'Ahmed', forsta: 'Ahmed', titel: 'Sälj', av: 'linear-gradient(135deg,#f0b56e,#8f5424)', start: '#/' },
    sa: { namn: 'Sahand', forsta: 'Sahand', titel: 'Sälj', av: 'linear-gradient(135deg,#b8cde0,#4f6f8f)', start: '#/' },
    ad: { namn: 'Admin', forsta: 'Admin', titel: 'Administratör', av: 'linear-gradient(135deg,#c9c4bb,#4f4a42)', start: '#/kontroll' }
  };
  var MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var DAG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

  // Hälsning och datum.
  var nu = new Date(), h = nu.getHours();
  var halsning = h < 5 ? 'God kväll' : h < 10 ? 'God morgon' : h < 14 ? 'Hej' : h < 18 ? 'God eftermiddag' : 'God kväll';
  document.body.classList.add(h < 5 || h >= 22 ? 'li--natt' : h >= 18 ? 'li--kvall' : 'li--dag');
  var hEl = document.querySelector('[data-halsning]');
  var dEl = document.querySelector('[data-datum]');
  if (hEl) hEl.textContent = halsning;
  if (dEl) dEl.textContent = DAG[nu.getDay()].charAt(0).toUpperCase() + DAG[nu.getDay()].slice(1) + ' ' + nu.getDate() + ' ' + MAN[nu.getMonth()];

  function initialer(namn) {
    var ord = namn.split(' ');
    return (ord.length === 1 ? ord[0].slice(0, 2) : ord.map(function (d) { return d.charAt(0); }).join('')).toUpperCase();
  }

  // Inaktiverade konton (adminpanelen sparar dem i webbläsaren)
  function arInaktiv(roll) { try { return !!(((JSON.parse(localStorage.getItem('ih-crm-admin')) || {}).konton || {})[roll] || {}).inaktiv; } catch (x) { return false; } }
  function visaInaktiv(namn, plats) {
    var fel = document.querySelector('[data-inaktiv-fel]');
    if (!fel) {
      fel = document.createElement('p'); fel.setAttribute('data-inaktiv-fel', ''); fel.setAttribute('role', 'alert');
      fel.style.cssText = 'margin:12px 0 0;padding:10px 14px;border-radius:12px;background:#fdecea;color:#a8432f;font-weight:600';
      // Överst, där Fortsätt som annars står – så att beskedet syns utan att man rullar
      var ankare = document.querySelector('[data-igen]');
      if (ankare) ankare.insertAdjacentElement('afterend', fel); else (plats && plats.parentNode ? plats.parentNode : document.body).appendChild(fel);
    }
    fel.textContent = (namn ? namn + 's konto' : 'Kontot') + ' är inaktiverat. Kontakta administratören för att få det aktiverat igen.';
  }

  // Välkommen-ögonblicket, sedan in i CRM:et.
  function logga(roll, knapp) {
    var r = ROLLER[roll];
    if (!r) return;
    if (arInaktiv(roll)) { visaInaktiv(r.forsta, knapp); return; }
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
  // Utloggad för att kontot inaktiverades (adminpanel.js skickar hit med ?inaktiv=1): förklara direkt, ingen Fortsätt som
  if (/[?&]inaktiv=1\b/.test(location.search) || (forra && arInaktiv(forra))) visaInaktiv(ROLLER[forra] ? ROLLER[forra].forsta : '', igen);
  if (igen && ROLLER[forra] && !arInaktiv(forra) && forra !== 'ad') {
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

  // Miniatyren av CRM:et: samma hälsning, talen räknas upp och
  // händelserna kommer in en i taget (högst tre syns).
  document.querySelectorAll('[data-mini-halsning]').forEach(function (el) { el.textContent = halsning; });

  document.querySelectorAll('[data-rakna]').forEach(function (el) {
    var mal = parseFloat(el.getAttribute('data-rakna')), dec = parseInt(el.getAttribute('data-dec'), 10) || 0;
    var skriv = function (v) { el.textContent = v.toFixed(dec).replace('.', ','); };
    if (lugn) { skriv(mal); return; }
    skriv(0);
    setTimeout(function () {
      var t0 = performance.now();
      var steg = function (t) {
        var k = Math.min(1, (t - t0) / 1400);
        skriv(mal * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(steg);
      };
      requestAnimationFrame(steg);
    }, 1100);
  });

  var flode = document.querySelector('[data-flode]');
  if (flode) {
    var IKON = {
      inkorg: '<path d="M4 13.5h4l1.5 2.5h5l1.5-2.5h4"/><path d="M4 13.5 6.5 6h11l2.5 7.5V19H4z"/>',
      plats: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><path d="M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z"/>',
      offert: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M9.5 12h6M9.5 15.5h4"/>',
      klar: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
      kalender: '<path d="M4 5h16v15H4z"/><path d="M4 9.5h16M9 3v4M15 3v4"/>'
    };
    var HANDELSER = [
      ['inkorg', '#f0b56e', 'Ny förfrågan', 'Maria Ek · Hus utanför detaljplan'],
      ['plats', '#a9c8a4', 'Platsbesök bokat', 'Johan Berg · Sadel 30 som kontor'],
      ['offert', '#e8c98f', 'Offert skickad', 'Patrik Sandberg · Kupa 50'],
      ['klar', '#7fe0a6', 'Order signerad', 'Fredrik Sjögren · Sadel 30 Bred'],
      ['kalender', '#9fc2c9', 'Montage bokat', 'Erik Nyström · Kupa 40 i Åre']
    ];
    var TIDER = ['nu', '1 min', '4 min'];
    var nasta = 0;
    var kort = function (h) {
      var el = document.createElement('div');
      el.className = 'handelse';
      el.style.setProperty('--f', h[1]);
      el.innerHTML = '<span class="handelse__ikon"><svg viewBox="0 0 24 24">' + IKON[h[0]] + '</svg></span>' +
        '<span><b>' + h[2] + '</b><small>' + h[3] + '</small></span><time>nu</time>';
      return el;
    };
    var tider = function () {
      Array.prototype.forEach.call(flode.children, function (c, k) {
        var t = c.querySelector('time');
        if (t) t.textContent = TIDER[k] || '';
      });
    };
    // FLIP: korten som redan finns glider mjukt till sin nya plats när ett nytt kommer in eller det sista går,
    // i stället för att hoppa en rad (det gav dubbla, överlappande kort mitt i bytet)
    var glid = function (andra) {
      var fore = [].map.call(flode.children, function (c) { return [c, c.getBoundingClientRect().top]; });
      andra();
      if (lugn) return;
      fore.forEach(function (x) {
        if (!x[0].parentNode || x[0].classList.contains('ut')) return;
        var dy = x[1] - x[0].getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5 && x[0].animate) x[0].animate([{ translate: '0 ' + dy + 'px' }, { translate: '0 0' }], { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)' });
      });
    };
    var ny = function () {
      glid(function () { flode.insertBefore(kort(HANDELSER[nasta]), flode.firstChild); });
      nasta = (nasta + 1) % HANDELSER.length;
      var kvar = flode.children;
      if (kvar.length > 3) {
        var sist = kvar[kvar.length - 1];
        sist.classList.add('ut');
        setTimeout(function () { glid(function () { if (sist.parentNode) sist.parentNode.removeChild(sist); }); tider(); }, lugn ? 0 : 420);
      }
      tider();
    };
    if (lugn) { ny(); ny(); ny(); }
    else {
      setTimeout(ny, 1700);
      setTimeout(ny, 2500);
      setTimeout(function () { ny(); setInterval(function () { if (!document.hidden) ny(); }, 3400); }, 3300);
    }
  }

  // Korten i scenen följer pekaren, olika mycket efter sitt djup.
  var scen = document.querySelector('[data-scen]');
  if (scen) {
    scen.querySelectorAll('[data-djup]').forEach(function (g) { g.style.setProperty('--d', g.getAttribute('data-djup')); });
  }
  // Parallax efter musen avstängd (2026-10-29)
  if (false) {
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
