/* Legohus CRM – presentationen för nya säljare: bläddra med pilar, mellanslag,
   svep, prickarna eller översikten (O). Adressen #3 öppnar bild 3. */
(function () {
  'use strict';
  var bilder = Array.prototype.slice.call(document.querySelectorAll('.bild'));
  var prickar = document.querySelector('[data-prickar]');
  var raknare = document.querySelector('[data-raknare]');
  var framsteg = document.querySelector('[data-framsteg]');
  var rutnat = document.querySelector('[data-rutnat]');
  var rutnatLista = document.querySelector('[data-rutnat-lista]');
  var zoom = document.querySelector('[data-zoom]');
  var zoomBild = document.querySelector('[data-zoom-bild]');
  var forra = document.querySelector('[data-p="forra"]');
  var nastaK = document.querySelector('.fot [data-p="nasta"]');
  var nu = -1;

  bilder.forEach(function (b, n) {
    b.setAttribute('aria-label', (n + 1) + ' av ' + bilder.length + ': ' + (b.getAttribute('data-namn') || ''));
    b.id = 'bild-' + (n + 1);
    var p = document.createElement('button');
    p.type = 'button';
    p.setAttribute('role', 'tab');
    p.setAttribute('aria-label', b.getAttribute('data-namn') || 'Bild ' + (n + 1));
    p.setAttribute('aria-controls', b.id);
    p.addEventListener('click', function () { ga(n); });
    prickar.appendChild(p);
    Array.prototype.forEach.call(b.querySelectorAll('.flodet li'), function (li, k) { li.style.setProperty('--n', k); });
  });

  function ga(n, tyst) {
    n = Math.max(0, Math.min(bilder.length - 1, n));
    if (n === nu) return;
    var bak = n < nu;
    bilder.forEach(function (b, k) {
      b.classList.toggle('nu', k === n);
      b.classList.toggle('forbi', k < n || (bak && k === nu));
      b.setAttribute('aria-hidden', k === n ? 'false' : 'true');
      if (k === n) b.removeAttribute('inert'); else b.setAttribute('inert', '');
    });
    nu = n;
    Array.prototype.forEach.call(prickar.children, function (p, k) { p.setAttribute('aria-selected', String(k === n)); });
    raknare.textContent = (n + 1) + ' / ' + bilder.length;
    framsteg.style.setProperty('--a', ((n + 1) / bilder.length).toFixed(3));
    forra.disabled = n === 0;
    nastaK.disabled = n === bilder.length - 1;
    bilder[n].scrollTop = 0;
    if (!tyst) try { history.replaceState(null, '', '#' + (n + 1)); } catch (x) { /* fil:// */ }
    document.title = (bilder[n].getAttribute('data-namn') || 'Presentation') + ' · Legohus CRM';
  }
  function hoppaTill(id) {
    var n = bilder.findIndex(function (b) { return b.getAttribute('data-id') === id; });
    if (n >= 0) ga(n);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-p], [data-till], .ram img');
    if (!t) return;
    if (t.matches('.ram img')) { visaZoom(t); return; }
    if (t.hasAttribute('data-till')) { hoppaTill(t.getAttribute('data-till')); return; }
    var p = t.getAttribute('data-p');
    if (p === 'nasta') ga(nu + 1);
    else if (p === 'forra') ga(nu - 1);
    else if (p === 'oversikt') visaRutnat();
    else if (p === 'stang-rutnat') stangRutnat();
  });

  function visaZoom(img) {
    zoomBild.src = img.currentSrc || img.src;
    zoomBild.alt = img.alt;
    zoom.hidden = false;
    zoom.focus();
  }
  zoom.tabIndex = -1;
  zoom.addEventListener('click', function () { zoom.hidden = true; });

  function visaRutnat() {
    rutnatLista.innerHTML = '';
    bilder.forEach(function (b, n) {
      var k = document.createElement('button');
      k.type = 'button';
      if (n === nu) k.setAttribute('aria-current', 'true');
      var img = b.querySelector('.ram img');
      if (img) { var i = document.createElement('img'); i.src = img.getAttribute('src'); i.alt = ''; i.loading = 'lazy'; k.appendChild(i); }
      else { var t = document.createElement('span'); t.className = 'rutnat__tom'; k.appendChild(t); }
      var s = document.createElement('span'); s.textContent = (n + 1) + '. ' + (b.getAttribute('data-namn') || '');
      var h = b.querySelector('h1, h2'); var sm = document.createElement('small'); sm.textContent = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
      s.appendChild(document.createElement('br')); s.appendChild(sm);
      k.appendChild(s);
      k.addEventListener('click', function () { stangRutnat(); ga(n); });
      rutnatLista.appendChild(k);
    });
    rutnat.hidden = false;
    var c = rutnatLista.querySelector('[aria-current]'); if (c) c.focus();
  }
  function stangRutnat() { rutnat.hidden = true; }

  document.addEventListener('keydown', function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (!zoom.hidden) { if (ev.key === 'Escape' || ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); zoom.hidden = true; } return; }
    if (!rutnat.hidden) { if (ev.key === 'Escape' || ev.key === 'o' || ev.key === 'O') { ev.preventDefault(); stangRutnat(); } return; }
    var iKnapp = ev.target.closest && ev.target.closest('a, button');
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || (ev.key === ' ' && !iKnapp)) { ev.preventDefault(); ga(nu + 1); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); ga(nu - 1); }
    else if (ev.key === 'Home') { ev.preventDefault(); ga(0); }
    else if (ev.key === 'End') { ev.preventDefault(); ga(bilder.length - 1); }
    else if (ev.key === 'o' || ev.key === 'O') { ev.preventDefault(); visaRutnat(); }
  });

  // Svep på pekskärm (vågrätt).
  var sx = null, sy = null;
  document.addEventListener('touchstart', function (ev) { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (ev) {
    if (sx == null) return;
    var dx = ev.changedTouches[0].clientX - sx, dy = ev.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) ga(nu + (dx < 0 ? 1 : -1));
    sx = sy = null;
  });

  window.addEventListener('hashchange', function () { var n = parseInt(location.hash.slice(1), 10); if (n) ga(n - 1, true); });
  var start = parseInt((location.hash || '').slice(1), 10);
  ga(start ? start - 1 : 0, true);
})();
