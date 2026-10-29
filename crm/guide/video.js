/* Legohus CRM – videosidan: kapitel som går att klicka på, bandet under videon,
   aktuellt kapitel och "Prova själv" som startar samma guide i CRM:et.
   Kapitlen kommer från video/kapitel.js (window.IH_VIDEO). */
(function () {
  'use strict';
  var data = window.IH_VIDEO || { kapitel: [], langd: 0 };
  var video = document.querySelector('[data-video]');
  var lista = document.querySelector('[data-kapitel]');
  var band = document.querySelector('[data-band]');
  var nuText = document.querySelector('[data-nu]');
  var nuProva = document.querySelector('[data-nu-prova]');
  var langdEl = document.querySelector('[data-langd]');
  var K = data.kapitel || [];
  var PIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  function tid(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function provaLank(k) { return '../index.html?tur=' + encodeURIComponent(k.tur) + '#' + (k.sida || '/'); }
  function langd() { return video.duration && isFinite(video.duration) ? video.duration : data.langd || 0; }
  function slut(n) { return n + 1 < K.length ? K[n + 1].start : langd(); }

  K.forEach(function (k, n) {
    var li = document.createElement('li');
    li.innerHTML = '<button type="button" class="kapitel__hopp" data-n="' + n + '"><span class="kapitel__tid">' + tid(k.start) + '</span><b>' + esc(k.titel) + '</b><small>' + esc(k.text || '') + '</small></button>' +
      (k.tur ? '<a class="kapitel__prova" href="' + provaLank(k) + '">Prova själv' + PIL + '</a>' : '');
    lista.appendChild(li);
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Hoppa till ' + k.titel);
    b.title = k.titel + ' · ' + tid(k.start);
    b.dataset.n = n;
    b.innerHTML = '<i></i>';
    band.appendChild(b);
  });
  function satsBand() {
    var L = langd();
    Array.prototype.forEach.call(band.children, function (b, n) { b.style.setProperty('--l', Math.max(1, slut(n) - K[n].start).toFixed(2)); });
    if (langdEl && L) langdEl.textContent = K.length + ' kapitel · ' + tid(L);
  }
  satsBand();
  video.addEventListener('loadedmetadata', satsBand);

  function hoppa(n) {
    var k = K[n]; if (!k) return;
    video.currentTime = k.start + 0.05;
    var p = video.play(); if (p && p.catch) p.catch(function () { /* kräver ett klick */ });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-n]');
    if (b && (b.closest('[data-kapitel]') || b.closest('[data-band]'))) hoppa(+b.dataset.n);
  });

  var forraN = -1;
  function uppdatera() {
    var t = video.currentTime, n = 0;
    for (var i = 0; i < K.length; i++) if (t >= K[i].start - 0.01) n = i;
    Array.prototype.forEach.call(band.children, function (b, i) {
      var a = t >= slut(i) ? 1 : t <= K[i].start ? 0 : (t - K[i].start) / Math.max(0.1, slut(i) - K[i].start);
      b.style.setProperty('--a', a.toFixed(4));
    });
    if (n !== forraN && K[n]) {
      forraN = n;
      Array.prototype.forEach.call(lista.children, function (li, i) { li.classList.toggle('nu-k', i === n); });
      nuText.textContent = (n + 1) + '. ' + K[n].titel;
      if (K[n].tur) { nuProva.hidden = false; nuProva.href = provaLank(K[n]); nuProva.innerHTML = 'Prova själv' + PIL; }
      else { nuProva.hidden = false; nuProva.href = '../index.html?tur=valkommen#/'; nuProva.innerHTML = 'Starta rundturen' + PIL; }
    }
  }
  video.addEventListener('timeupdate', uppdatera);
  video.addEventListener('seeked', uppdatera);
  uppdatera();

  // Siffertangenterna 1–9 hoppar till ett kapitel.
  document.addEventListener('keydown', function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || (ev.target.closest && ev.target.closest('input, textarea'))) return;
    var n = parseInt(ev.key, 10);
    if (n >= 1 && n <= K.length) { ev.preventDefault(); hoppa(n - 1); }
  });
  // #kapitel-3 i adressen hoppar dit direkt.
  var m = /kapitel-(\d+)/.exec(location.hash);
  if (m) video.addEventListener('loadedmetadata', function () { var k = K[+m[1] - 1]; if (k) video.currentTime = k.start; }, { once: true });
})();
