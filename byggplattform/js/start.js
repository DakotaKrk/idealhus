/* Startsidan: menyn på mobilen, skärmen som rätar upp sig, 3D-huset lager för lager,
   husbiblioteket och kom igång-kortet med siffror ur mängdningsmotorn, och entréerna. */
(function () {
  'use strict';
  var D = window.BP_DATA, M = window.Mangd;
  var lugnt = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var e = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var kr = function (v) { return M.tal(Math.round(v || 0), 0) + ' kr'; };
  var hus = function (id) { return D.HUS.filter(function (h) { return h.id === id; })[0]; };
  var cache = {};
  var mangda = function (h) { return cache[h.id] || (cache[h.id] = M.mangda(M.delarForHus(h).delar, D.RECEPT, D.MATERIAL)); };
  var rakna = function (el, fran, till) {
    if (lugnt || fran === till) { el.textContent = kr(till); return; }
    var t0 = null;
    var steg = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 420); el.textContent = kr(fran + (till - fran) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(steg); };
    requestAnimationFrame(steg);
  };

  if (!lugnt) document.body.classList.add('bh-laddad');
  $$('.bh-ord').forEach(function (o, n) { o.style.setProperty('--o', n); });

  /* --- Menyn på mobilen ---------------------------------------------------------------- */
  var menyKnapp = $('.bh-nav__meny'), meny = $('#bh-meny');
  menyKnapp.addEventListener('click', function () {
    var oppen = !meny.classList.contains('oppen');
    meny.classList.toggle('oppen', oppen); menyKnapp.setAttribute('aria-expanded', String(oppen));
  });
  meny.addEventListener('click', function (ev) { if (ev.target.closest('a')) { meny.classList.remove('oppen'); menyKnapp.setAttribute('aria-expanded', 'false'); } });

  /* --- Skärmen rätar upp sig när man rullar ------------------------------------------------ */
  var skarm = $('#bh-skarm .bh-skarm__ram');
  var bred = hus('sadel-30-bred'), m1 = mangda(bred);
  $('#flyt-summa').textContent = kr(m1.summa);

  /* --- 3D-huset lager för lager -------------------------------------------------------------- */
  var lmv = $('#lager-mv'), grupper = {};
  m1.rader.forEach(function (r) { grupper[r.grupp] = (grupper[r.grupp] || 0) + r.summa; });
  var ordning = Object.keys(grupper).sort(function (a, b) { return grupper[b] - grupper[a]; });
  $('#lager-lista').innerHTML = ordning.map(function (g) { return '<div><dt>' + e(g) + '</dt><dd>' + kr(grupper[g]) + '</dd></div>'; }).join('');
  $('#lager-summa').innerHTML = 'Totalt <b>' + kr(m1.summa) + '</b> · ' + m1.rader.length + ' rader, exempelpriser';
  var STEG = [{ mal: 0, vinkel: '34deg 66deg', nock: 4.2 }, { mal: 0.42, vinkel: '42deg 60deg', nock: 6.2 }, { mal: 1, vinkel: '30deg 70deg', nock: 8.8 }];
  var rorelse = BP3D.rorelse(lmv);
  function visaSteg(k) {
    $$('.bh-segment button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-steg') === k)); });
    BP3D.ram(lmv, { langd: bred.langd, bredd: bred.bredd, nock: STEG[k].nock }, { vinkel: STEG[k].vinkel, marg: 1.1, hojd: 1.6 + STEG[k].mal * 1.9 });
    rorelse.mal(STEG[k].mal, { mjuk: true });
  }
  $$('.bh-segment button').forEach(function (b) { b.addEventListener('click', function () { visaSteg(+b.getAttribute('data-steg')); }); });
  visaSteg(0);

  /* --- Husbiblioteket ------------------------------------------------------------------------- */
  $('#husen-lista').innerHTML = D.HUS.map(function (h) {
    return '<a class="bh-hus" href="konsument.html?hus=' + h.id + '#k-rubrik"><span class="bh-hus__bild"><img src="' + h.bild + '" width="1600" height="1062" alt="' + e(h.namn) + '" loading="lazy"><span class="bh-hus__kat">' + e(h.kategori) + '</span></span>' +
      '<span class="bh-hus__text"><b>' + e(h.namn) + '</b><span>' + h.yta + ' m² · ' + h.rum + ' rum · ' + M.tal(h.langd) + ' × ' + M.tal(h.bredd) + ' m</span><span>Material enligt mängden: ' + kr(mangda(h).summa) + '</span><em>Se huset i 3D →</em></span></a>';
  }).join('');

  /* --- Kom igång: välj hus och färg ----------------------------------------------------------- */
  var FARG = D.TILLVAL[0].val, val = { hus: 'sadel-30-bred', farg: 'falu' }, forra = null;
  var kortHus = $('#kort-hus'), kortFarg = $('#kort-farg');
  kortHus.innerHTML = D.HUS.map(function (h) { return '<button type="button" data-kh="' + h.id + '">' + e(h.namn) + '</button>'; }).join('');
  kortFarg.innerHTML = FARG.map(function (f) { return '<button type="button" data-kf="' + f.id + '" style="--f:' + f.farg + '" aria-label="' + e(f.namn) + '" title="' + e(f.namn) + '"></button>'; }).join('');
  function ritaKort() {
    var h = hus(val.hus), f = FARG.filter(function (x) { return x.id === val.farg; })[0], m = mangda(h);
    $$('[data-kh]', kortHus).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kh') === val.hus)); });
    $$('[data-kf]', kortFarg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-kf') === val.farg)); });
    var bild = $('#kort-bild');
    if (bild.getAttribute('src') !== h.bild) { bild.style.opacity = '0'; setTimeout(function () { bild.src = h.bild; bild.alt = h.namn; bild.style.opacity = '1'; }, 180); }
    $('#kort-rad').innerHTML = '<b>' + e(h.namn) + '</b> i ' + e(f.namn.toLowerCase()) + ', ' + h.yta + ' m². Material enligt mängden: <b data-kr></b> (exempelpriser' + (f.pris ? ', färgen +' + kr(f.pris) : '') + ').';
    rakna($('[data-kr]'), forra == null ? m.summa : forra, m.summa);
    forra = m.summa;
    var k = $('#kort-knapp');
    k.textContent = 'Fortsätt med ' + h.namn;
    k.href = 'konsument.html?hus=' + h.id + '&fasad=' + val.farg + '#k-rubrik';
  }
  kortHus.addEventListener('click', function (ev) { var b = ev.target.closest('[data-kh]'); if (b) { val.hus = b.getAttribute('data-kh'); ritaKort(); } });
  kortFarg.addEventListener('click', function (ev) { var b = ev.target.closest('[data-kf]'); if (b) { val.farg = b.getAttribute('data-kf'); ritaKort(); } });
  ritaKort();

  /* --- Rullningen: skärmen rätar upp sig, flödets linje ritas -------------------------------- */
  var steg = $('.bh-steg'), vantar = 0;
  function rulla() {
    vantar = 0;
    if (lugnt) return;
    var r = skarm.getBoundingClientRect(), p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.9)));
    skarm.style.setProperty('--lut', (12 * (1 - p)).toFixed(2) + 'deg');
    skarm.style.setProperty('--skala', (0.94 + 0.06 * p).toFixed(3));
  }
  window.addEventListener('scroll', function () { if (!vantar) vantar = requestAnimationFrame(rulla); }, { passive: true });
  rulla();

  /* --- Entréer ---------------------------------------------------------------------------------- */
  var mal = $$('.bh-fordel, .bh-huvud, .bh-roll, .bh-funk article, .bh-lager__text, .bh-lager__scen, .bh-hus, .bh-steg li, .bh-fragor__lista details, .bh-cta, .bh-kategorier');
  if (lugnt || !('IntersectionObserver' in window)) { steg.style.setProperty('--linje', 1); return; }
  mal.forEach(function (el) { el.style.setProperty('--i', Array.prototype.indexOf.call(el.parentNode.children, el) % 4); el.classList.add('bh-in'); });
  var io = new IntersectionObserver(function (poster) {
    poster.forEach(function (p) {
      if (!p.isIntersecting) return;
      p.target.classList.add('syns');
      if (p.target === steg) steg.style.setProperty('--linje', 1);
      io.unobserve(p.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  mal.concat([steg]).forEach(function (el) { io.observe(el); });
})();
