/* ============================================================
   premium.js - rörelse och smarta detaljer, idéer från Kaster
   (2026-09-23). Laddas med defer på alla sidor, efter sidans egna
   skript. Allt är tillägg: utan filen fungerar sidan som förut.
   Regeln om rörelse gäller: det som loopar pausas när det inte syns,
   och prefers-reduced-motion stänger av allt som rör sig.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finPekare = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var sida = (location.pathname.split('/').pop() || 'index.html');
  var lagra = {
    hamta: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    spara: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privat läge */ } }
  };

  // Kör fn en gång när elementet syns.
  function narSynligt(el, fn, troskel, marginal) {
    if (!window.IntersectionObserver) { fn(el); return; }
    var io = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) {
        if (!p.isIntersecting) return;
        fn(p.target);
        io.unobserve(p.target);
      });
    }, { threshold: troskel || 0, rootMargin: marginal || '0px' });
    io.observe(el);
  }

  // Växlar .pausad när elementet lämnar skärmen, så loopar inte kostar.
  function pausaUtanforVy(el) {
    if (!window.IntersectionObserver) return;
    new IntersectionObserver(function (poster) {
      el.classList.toggle('pausad', !poster[0].isIntersecting);
    }).observe(el);
  }

  /* --- Skimmer och ringmätare ------------------------------------ */
  $$('h2 em, .skimmer, .matare').forEach(function (el) {
    if (lugn) { el.classList.add('syns'); return; }
    narSynligt(el, function (e) { e.classList.add('syns'); }, 0.6);
  });

  /* --- Rubriker reser sig ord för ord ----------------------------
     Som Kasters rubriker: varje ord stiger ur sin egen mask. Rubriker
     med kursivt skimmerord eller innehåll som byts av skript (huskortet,
     verktyget) delas inte - de stiger som en helhet i stället. */
  function delaIOrd(h) {
    var text = h.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    h.setAttribute('aria-label', text);
    h.innerHTML = text.split(' ').map(function (ord, i) {
      var s = ord.replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
      return '<span class="ord" aria-hidden="true"><span style="--i:' + i + '">' + s + '</span></span>';
    }).join(' ');
    h.classList.add('delad');
  }

  if (!lugn && window.IntersectionObserver) {
    $$('main h2, .subpage-hero__title, .kollen-topp__titel, .fyrafyra__titel, .guidehero__titel').forEach(function (h) {
      if (h.closest('.hero') || h.closest('.kollen__svar')) return;
      if (h.id || h.hasAttribute('data-model-title') || h.querySelector('[data-model-title]')) return;
      var bara = Array.prototype.every.call(h.childNodes, function (n) {
        return n.nodeType === 3;
      });
      if (bara) delaIOrd(h); else h.classList.add('stiger');
      h.classList.add('rorelse');
      narSynligt(h, function (e) { e.classList.add('uppe'); }, 0.2, '0px 0px -6% 0px');
    });
  }

  /* --- Ljuskägla som följer pekaren över korten ------------------ */
  if (finPekare && !lugn) {
    $$('.house-card, .feature-card, .model-card__media, .kollen-hus__kort, .vidarekort, ' +
       '.tomtkoll .matarblock, .kontaktkort, .main-nav__tips, .segment__media, .team-kort, .proffs-hopp a')
      .forEach(function (kort) {
        var ljus = document.createElement('span');
        ljus.className = 'ljuskagla';
        ljus.setAttribute('aria-hidden', 'true');
        kort.classList.add('har-ljus');
        kort.appendChild(ljus);
        var bokad = false, x = 0, y = 0;
        kort.addEventListener('pointermove', function (e) {
          var r = kort.getBoundingClientRect();
          x = e.clientX - r.left;
          y = e.clientY - r.top;
          if (bokad) return;
          bokad = true;
          requestAnimationFrame(function () {
            bokad = false;
            kort.style.setProperty('--mx', x + 'px');
            kort.style.setProperty('--my', y + 'px');
          });
        });
      });
  }

  /* --- Glidande markering i växlar och filter -------------------- */
  function glidandeMarkering(grupp) {
    var markor = document.createElement('span');
    markor.className = 'markor';
    markor.setAttribute('aria-hidden', 'true');
    grupp.insertBefore(markor, grupp.firstChild);
    grupp.classList.add('har-markor');
    var forra = null;
    function flytta(direkt) {
      var vald = $('[aria-pressed="true"]', grupp);
      if (!vald) return;
      if (direkt) markor.style.transition = 'none';
      markor.style.width = vald.offsetWidth + 'px';
      markor.style.height = vald.offsetHeight + 'px';
      markor.style.transform = 'translate(' + vald.offsetLeft + 'px, ' + vald.offsetTop + 'px)';
      if (direkt) { void markor.offsetWidth; markor.style.transition = ''; }
      // Markören trycks ihop i farten och studsar tillbaka när den
      // landar - som en vattendroppe, inte en låda som skjuts.
      if (!direkt && forra && forra !== vald && !lugn && markor.animate) {
        var hoger = vald.offsetLeft > forra.offsetLeft;
        markor.style.transformOrigin = hoger ? 'right center' : 'left center';
        markor.animate([
          { scale: '1 1' },
          { scale: '1.12 0.86', offset: 0.35 },
          { scale: '0.97 1.04', offset: 0.7 },
          { scale: '1 1' }
        ], { duration: 650, easing: 'ease-out' });
        var ikon = $('svg', vald);
        if (ikon && ikon.animate) {
          ikon.animate([
            { transform: 'translateY(0) rotate(0)' },
            { transform: 'translateY(-4px) rotate(-8deg)', offset: 0.4 },
            { transform: 'translateY(0) rotate(0)' }
          ], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
        grupp.classList.remove('glans');
        void grupp.offsetWidth;
        grupp.classList.add('glans');
      }
      forra = vald;
    }
    flytta(true);
    new MutationObserver(function () { flytta(false); })
      .observe(grupp, { subtree: true, attributeFilter: ['aria-pressed'] });
    if (window.ResizeObserver) new ResizeObserver(function () { flytta(true); }).observe(grupp);
    if (document.fonts) document.fonts.ready.then(function () { flytta(true); });
  }

  /* --- Målgruppsväxeln på startsidan ----------------------------- */
  var hero = $('.hero[data-malgrupp]');
  if (hero) {
    var knappar = $$('.malgrupp button', hero);
    var satt = function (varde, spara) {
      hero.setAttribute('data-malgrupp', varde);
      knappar.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-malgrupp') === varde));
      });
      if (spara) lagra.spara('idealhus-malgrupp', varde);
    };
    knappar.forEach(function (b) {
      b.addEventListener('click', function () { satt(b.getAttribute('data-malgrupp'), true); });
    });
    if (lagra.hamta('idealhus-malgrupp') === 'proffs') satt('proffs', false);
    pausaUtanforVy(hero);
  }

  // Filmen i heron spelas bara när den syns - avkodningen kostar
  // annars bildrutor hela vägen ner genom sidan.
  var film = $('.hero__media');
  if (film && film.tagName === 'VIDEO' && window.IntersectionObserver) {
    new IntersectionObserver(function (poster) {
      if (poster[0].isIntersecting) {
        if (!lugn && film.paused) { var p = film.play(); if (p && p.catch) p.catch(function () {}); }
      } else if (!film.paused) {
        film.pause();
      }
    }).observe(film);
  }

  $$('.malgrupp, .filter, .samagare .hustypval').forEach(glidandeMarkering);

  /* --- Mjuk zoom på alla bilder ---------------------------------
     Samma effekt som referensbilderna på startsidan: bilden växer
     lite inne i sin ram när man för pekaren över kortet den sitter
     i. Ramen klipper, så bilden aldrig går utanför sina hörn. */
  $$('main img').forEach(function (img) {
    if (img.closest('.hero, .subpage-hero, .heroscen, .ordband, .val')) return;
    var ram = img.parentElement;
    if (!ram || img.getBoundingClientRect().width < 120) return;
    var kort = img.closest('a, article, figure, .segment__block, .quiet-break__bild, .guidehero__bild') || ram;
    var radie = getComputedStyle(img).borderRadius;
    ram.classList.add('zoomklipp');
    if (radie && radie !== '0px' && getComputedStyle(ram).borderRadius === '0px') {
      ram.style.borderRadius = radie;
    }
    img.classList.add('zoombild');
    kort.classList.add('zoomkort');
  });

  /* --- Ordbandet ------------------------------------------------
     Kasters marquee, i antikva: husen och det som gör dem, i en rad
     som glider förbi. Står still utanför skärmen och vid lugn rörelse. */
  (function () {
    var ord = ['Attefallshus', 'Fritidshus', 'Byggt under tak', 'Svensk tillverkning',
      'Offert post för post', 'Anpassat efter din tomt', 'En kontakt hela vägen'];
    var rad = ord.map(function (o) {
      return '<span>' + o + '</span><i>✦</i>';
    }).join('');
    var band = document.createElement('div');
    band.className = 'ordband';
    band.setAttribute('aria-hidden', 'true');
    band.innerHTML = '<div class="ordband__spar"><div>' + rad + '</div><div>' + rad + '</div></div>';
    var efter = $('main > .hero');
    var fore = $('main > .contact-section') || $('.site-footer');
    if (efter) efter.insertAdjacentElement('afterend', band);
    else if (fore && sida !== '404.html') fore.parentNode.insertBefore(band, fore);
    else return;
    pausaUtanforVy(band);
  })();

  /* --- Svarskorten i formuläret --------------------------------
     Varje val får en ikon, lutar i 3D efter pekaren som korten på
     Kaster, och svarar med en studs och en krusning när det väljs.
     Frågan som är besvarad får en bock i stället för sitt nummer. */
  var IKONER = {
    'Attefallshus': 'M4 11.5 12 5l8 6.5M6.5 10v9.5h11V10M10.5 19.5v-4h3v4',
    'Fritidshus': 'M3 12 10 6l7 6M5 10.5v9h10v-9M19 4.5v2M22 7.5h-2M16 7.5h-2M17 5.2l1.4 1.4M20.6 5.2l-1.4 1.4',
    'Vet inte än': 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.1-1.5 2.1v.7M12 17.8v.2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'Bo året runt': 'M12 3v2M12 19v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'Gästhus': 'M3 18v-7M3 14h18v4M21 18v-4a3 3 0 0 0-3-3h-7v3M7 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'Uthyrning': 'M14.5 9.5a4.5 4.5 0 1 1-2.3-3.9L20 13.4V17h-3v-2h-2v-2l-2.4-2.4M8.5 9.5h.01',
    'Kontor': 'M4 6.5h16v9.5H4zM2.5 19h19M10 16v3M14 16v3',
    'Annat': 'M6 12h.01M12 12h.01M18 12h.01'
  };

  $$('.valgrupp').forEach(function (grupp) {
    grupp.classList.add('valgrupp--levande');
    var kort = $$('.val, .bildval', grupp);

    kort.forEach(function (etikett, i) {
      var input = $('input', etikett);
      var yta = $('span', etikett);
      if (!input || !yta) return;
      yta.style.setProperty('--i', i);

      var d = IKONER[input.value];
      if (d) {
        var ikon = document.createElement('i');
        ikon.className = 'val__ikon';
        ikon.setAttribute('aria-hidden', 'true');
        ikon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="' + d + '"/></svg>';
        yta.insertBefore(ikon, yta.firstChild);
      }
      var glans = document.createElement('i');
      glans.className = 'val__glans';
      glans.setAttribute('aria-hidden', 'true');
      yta.appendChild(glans);

      if (finPekare && !lugn) {
        var bokad = false, px = 0, py = 0;
        yta.addEventListener('pointermove', function (e) {
          var r = yta.getBoundingClientRect();
          px = (e.clientX - r.left) / r.width;
          py = (e.clientY - r.top) / r.height;
          if (bokad) return;
          bokad = true;
          requestAnimationFrame(function () {
            bokad = false;
            yta.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
            yta.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
            yta.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
            yta.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          });
        });
        yta.addEventListener('pointerleave', function () {
          yta.style.setProperty('--rx', '0deg');
          yta.style.setProperty('--ry', '0deg');
        });
      }

      // Krusningen startar där man tryckte, eller i mitten vid tangentbord.
      var senastX = null, senastY = null;
      etikett.addEventListener('pointerdown', function (e) {
        var r = yta.getBoundingClientRect();
        senastX = e.clientX - r.left;
        senastY = e.clientY - r.top;
      });
      input.addEventListener('change', function () {
        if (!input.checked) return;
        grupp.classList.add('valgrupp--besvarad');
        if (lugn) return;
        yta.classList.remove('val--pop');
        void yta.offsetWidth;
        yta.classList.add('val--pop');
        var r = yta.getBoundingClientRect();
        var krus = document.createElement('i');
        krus.className = 'val__krus';
        krus.setAttribute('aria-hidden', 'true');
        krus.style.left = (senastX === null ? r.width / 2 : senastX) + 'px';
        krus.style.top = (senastY === null ? r.height / 2 : senastY) + 'px';
        yta.appendChild(krus);
        setTimeout(function () { krus.remove(); }, 800);
        senastX = senastY = null;
      });
      if (input.checked) grupp.classList.add('valgrupp--besvarad');
    });

    if (!lugn) {
      narSynligt(grupp, function (g) { g.classList.add('valgrupp--inne'); }, 0.15);
    } else {
      grupp.classList.add('valgrupp--inne');
    }
  });

  // Smart tips: den som väljer attefallshus undrar oftast hur stort
  // det får bli. Svaret står direkt under frågan, med länk till verktyget.
  var attefall = $('.valgrupp input[value="Attefallshus"]');
  if (attefall) {
    var rad = attefall.closest('.valgrupp');
    var tipsRad = document.createElement('p');
    tipsRad.className = 'val__tips';
    tipsRad.hidden = true;
    tipsRad.innerHTML = 'Attefallshus får vara 30 m² inom detaljplan och 50 m² utanför. ' +
      '<a href="vad-far-jag-bygga.html">Se vad som ryms på din tomt</a>';
    rad.appendChild(tipsRad);
    $$('input[name="' + attefall.name + '"]', rad).forEach(function (inp) {
      inp.addEventListener('change', function () { tipsRad.hidden = !attefall.checked; });
    });
  }

  /* --- Kategorisidan ------------------------------------------- */
  (function () {
    var grid = $('.model-grid');
    if (!grid) return;
    var kort = $$('.model-card', grid);
    var raknare = $('.category__count');
    var tomt = document.createElement('p');
    tomt.className = 'model-grid__tomt';
    tomt.hidden = true;
    tomt.textContent = 'Ingen modell i det spannet. Prova ett annat, eller hör av dig så letar vi tillsammans.';
    grid.appendChild(tomt);

    var tal = function (el, n) { return Number(el.getAttribute('data-' + n)); };
    var min = 0, max = 99999, sort = 'nr';

    // FLIP: mät var korten står, ändra ordningen, och låt dem glida
    // från den gamla platsen till den nya i stället för att hoppa.
    function ordna() {
      var fore = new Map();
      kort.forEach(function (k) { if (!k.hidden) fore.set(k, k.getBoundingClientRect()); });

      var ordning = kort.slice().sort(function (a, b) {
        if (sort === 'minst') return tal(a, 'yta') - tal(b, 'yta') || tal(a, 'nr') - tal(b, 'nr');
        if (sort === 'storst') return tal(b, 'yta') - tal(a, 'yta') || tal(a, 'nr') - tal(b, 'nr');
        if (sort === 'lev') return tal(a, 'lev') - tal(b, 'lev') || tal(a, 'nr') - tal(b, 'nr');
        return tal(a, 'nr') - tal(b, 'nr');
      });
      var kvar = 0;
      ordning.forEach(function (k) {
        var yta = tal(k, 'yta');
        var med = yta >= min && yta <= max;
        k.hidden = !med;
        if (med) kvar++;
        grid.insertBefore(k, tomt);
      });
      tomt.hidden = kvar > 0;
      if (raknare) raknare.textContent = kvar === 1 ? '1 modell' : kvar + ' modeller';

      if (lugn) return;
      ordning.forEach(function (k, i) {
        if (k.hidden) return;
        var efter = k.getBoundingClientRect();
        var f = fore.get(k);
        if (!f) {
          k.animate([
            { opacity: 0, transform: 'perspective(900px) rotateX(24deg) translateY(30px)' },
            { opacity: 1, transform: 'none' }
          ], { duration: 650, delay: i * 50, easing: 'cubic-bezier(.22,1.2,.36,1)', fill: 'backwards' });
          return;
        }
        var dx = f.left - efter.left, dy = f.top - efter.top;
        if (!dx && !dy) return;
        k.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
          { transform: 'none' }
        ], { duration: 700, easing: 'cubic-bezier(.34,1.25,.64,1)' });
      });
    }

    $$('.filter:not(.sortering) button', document).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.filter:not(.sortering) button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        min = parseInt(b.getAttribute('data-min'), 10) || 0;
        max = parseInt(b.getAttribute('data-max'), 10) || 99999;
        ordna();
      });
    });
    $$('.sortering button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.sortering button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        sort = b.getAttribute('data-sort');
        ordna();
      });
    });

    // 3D-lutning på korten, som svarskorten och Kasters kort.
    if (finPekare && !lugn) {
      kort.forEach(function (k) {
        var bokad = false, px = 0, py = 0;
        k.addEventListener('pointermove', function (e) {
          var r = k.getBoundingClientRect();
          px = (e.clientX - r.left) / r.width;
          py = (e.clientY - r.top) / r.height;
          if (bokad) return;
          bokad = true;
          requestAnimationFrame(function () {
            bokad = false;
            k.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
            k.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
          });
        });
        k.addEventListener('pointerleave', function () {
          k.style.setProperty('--rx', '0deg');
          k.style.setProperty('--ry', '0deg');
        });
      });
    }

    /* 3D-huset. Ytan blir en rektangel med proportionen 1,6:1, skalad
       mot kategorins största hus så att skillnaderna syns. Vridningen
       sköts här i stället för i CSS: man drar i huset, det glider vidare
       med tröghet när man släpper, och börjar snurra sakta igen efter en
       stund. Loopen går bara när sektionen syns. */
    var sek = $('.storlek3d');
    if (sek) {
      var hus = $('.hus3d', sek);
      var scen = $('.storlek3d__scen', sek);
      var skala = Number(sek.getAttribute('data-skala')) || 30;
      var pxPerM = 280 / Math.sqrt(skala * 1.6);
      var komma = function (n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); };
      var visa = function (k) {
        var yta = tal(k, 'yta');
        var bredd = Math.sqrt(yta * 1.6), djup = yta / bredd;
        hus.style.setProperty('--w', (bredd * pxPerM).toFixed(1) + 'px');
        hus.style.setProperty('--d', (djup * pxPerM).toFixed(1) + 'px');
        hus.style.setProperty('--h', (2.7 * pxPerM).toFixed(1) + 'px');
        hus.style.setProperty('--m', pxPerM.toFixed(2) + 'px');
        $('[data-3d-yta]', sek).textContent = yta;
        $('[data-3d-rum]', sek).textContent = tal(k, 'rum');
        $('[data-3d-p]', sek).textContent = komma(yta / 12.5);
        $('[data-3d-namn]', sek).textContent = k.getAttribute('data-namn').toLowerCase();
        $('[data-3d-golvtext]', sek).textContent = yta + ' m²';
        $('[data-3d-bredd]', sek).textContent = '≈ ' + komma(bredd) + ' m';
        $('[data-3d-djup]', sek).textContent = '≈ ' + komma(djup) + ' m';
        $$('[data-3d]', sek).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-3d') === k.getAttribute('data-nr')));
        });
      };
      var efterNr = function (nr) {
        return kort.filter(function (k) { return k.getAttribute('data-nr') === String(nr); })[0];
      };
      visa(kort[0]);
      $$('[data-3d]', sek).forEach(function (b) {
        b.addEventListener('click', function () { visa(efterNr(b.getAttribute('data-3d'))); });
      });
      kort.forEach(function (k) {
        k.addEventListener('pointerenter', function () { visa(k); });
        k.addEventListener('focusin', function () { visa(k); });
      });
      glidandeMarkering($('.storlek3d__val', sek));

      var lyft = $('.storlek3d__lyft', sek);
      lyft.addEventListener('click', function () {
        var upp = lyft.getAttribute('aria-pressed') !== 'true';
        lyft.setAttribute('aria-pressed', String(upp));
        lyft.textContent = upp ? 'Sänk taket' : 'Lyft taket';
        sek.classList.toggle('storlek3d--oppen', upp);
      });

      var START = { vrid: -35, lut: 60, zoom: 1 };
      var vrid = START.vrid, lut = START.lut, zoom = START.zoom;
      var fartV = 0, fartL = 0, drar = false, senX = 0, senY = 0;
      var stilla = performance.now(), synlig = false, raf = null;
      var begr = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
      var rita = function () {
        hus.style.transform = 'rotateX(' + lut.toFixed(2) + 'deg) rotateZ(' + vrid.toFixed(2) + 'deg) scale3d(' +
          zoom + ',' + zoom + ',' + zoom + ')';
      };
      var loop = function (t) {
        raf = null;
        if (!drar) {
          if (Math.abs(fartV) > 0.02 || Math.abs(fartL) > 0.02) {
            vrid += fartV;
            lut = begr(lut + fartL, 30, 78);
            fartV *= 0.94;
            fartL *= 0.88;
          } else if (!lugn && t - stilla > 2600) {
            vrid += 0.1;
          }
        }
        rita();
        if (synlig && !document.hidden) raf = requestAnimationFrame(loop);
      };
      var starta = function () { if (!raf && synlig) raf = requestAnimationFrame(loop); };
      rita();

      var tips = $('.storlek3d__tips', sek);
      var borjat = function () {
        stilla = performance.now();
        if (tips) tips.classList.add('storlek3d__tips--borta');
      };

      scen.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        drar = true;
        senX = e.clientX; senY = e.clientY;
        fartV = fartL = 0;
        scen.setPointerCapture(e.pointerId);
        scen.classList.add('storlek3d__scen--drar');
        borjat();
        starta();
      });
      scen.addEventListener('pointermove', function (e) {
        if (!drar) return;
        var dx = e.clientX - senX, dy = e.clientY - senY;
        senX = e.clientX; senY = e.clientY;
        vrid += dx * 0.45;
        lut = begr(lut - dy * 0.3, 30, 78);
        // Farten tas från draget men har ett tak - ett snabbt svep
        // ska ge ett halvt varv, inte fem.
        fartV = begr(dx * 0.45, -9, 9);
        fartL = begr(-dy * 0.3, -3, 3);
      });
      var slapp = function () {
        if (!drar) return;
        drar = false;
        stilla = performance.now();
        scen.classList.remove('storlek3d__scen--drar');
      };
      scen.addEventListener('pointerup', slapp);
      scen.addEventListener('pointercancel', slapp);
      scen.addEventListener('lostpointercapture', slapp);

      scen.addEventListener('keydown', function (e) {
        var steg = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
        if (!steg) return;
        e.preventDefault();
        fartV = steg[0] * 0.25;
        fartL = steg[1] * 0.25;
        borjat();
        starta();
      });

      $$('[data-zoom]', sek).forEach(function (b) {
        b.addEventListener('click', function () {
          zoom = begr(Math.round((zoom + Number(b.getAttribute('data-zoom')) * 0.15) * 100) / 100, 0.7, 1.6);
          hus.classList.add('hus3d--mjuk');
          borjat();
          rita();
        });
      });
      $('[data-aterstall]', sek).addEventListener('click', function () {
        vrid = START.vrid; lut = START.lut; zoom = START.zoom; fartV = fartL = 0;
        hus.classList.add('hus3d--mjuk');
        borjat();
        rita();
      });
      hus.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'transform') hus.classList.remove('hus3d--mjuk');
      });

      if (window.IntersectionObserver) {
        new IntersectionObserver(function (poster) {
          synlig = poster[0].isIntersecting;
          starta();
        }).observe(sek);
      }
      document.addEventListener('visibilitychange', starta);
    }

    /* Jämför upp till tre hus sida vid sida. */
    var bar = $('.jamforbar');
    var ruta = $('.jamforruta');
    if (!bar || !ruta) return;
    var valda = [];
    function uppdateraBar() {
      $('[data-jamfor-antal]', bar).textContent = valda.length;
      $('.jamforbar__oppna', bar).disabled = valda.length < 2;
      if (valda.length && bar.hidden) {
        bar.hidden = false;
        requestAnimationFrame(function () { bar.classList.add('jamforbar--synlig'); });
      } else if (!valda.length) {
        bar.classList.remove('jamforbar--synlig');
        setTimeout(function () { if (!valda.length) bar.hidden = true; }, 350);
      }
      kort.forEach(function (k) {
        var knapp = $('.jamfor-knapp', k);
        var med = valda.indexOf(k) > -1;
        knapp.setAttribute('aria-pressed', String(med));
        knapp.textContent = med ? 'Vald' : 'Jämför';
        knapp.disabled = !med && valda.length >= 3;
      });
    }
    kort.forEach(function (k) {
      $('.jamfor-knapp', k).addEventListener('click', function () {
        var i = valda.indexOf(k);
        if (i > -1) valda.splice(i, 1); else if (valda.length < 3) valda.push(k);
        uppdateraBar();
      });
    });
    $('.jamforbar__rensa', bar).addEventListener('click', function () { valda = []; uppdateraBar(); });

    function stapel(varde, storst, enhet, lagreArBattre) {
      var andel = Math.max(8, Math.round(varde / storst * 100));
      return '<span class="jamforruta__stapel' + (lagreArBattre ? ' jamforruta__stapel--lag' : '') +
        '" style="--andel:' + andel + '%"><span></span></span><strong>' + varde + ' ' + enhet + '</strong>';
    }
    $('.jamforbar__oppna', bar).addEventListener('click', function () {
      var storstYta = Math.max.apply(null, valda.map(function (k) { return tal(k, 'yta'); }));
      var storstRum = Math.max.apply(null, valda.map(function (k) { return tal(k, 'rum'); }));
      var storstLev = Math.max.apply(null, valda.map(function (k) { return tal(k, 'lev'); }));
      $('.jamforruta__kolumner', ruta).innerHTML = valda.map(function (k) {
        var lank = $('.model-card__media', k).getAttribute('href');
        return '<article class="jamforruta__hus">' +
          '<img src="images/' + k.getAttribute('data-bild') + '" alt="">' +
          '<h3>' + k.getAttribute('data-namn') + '</h3>' +
          '<dl>' +
          '<div><dt>Boyta</dt><dd>' + stapel(tal(k, 'yta'), storstYta, 'm²') + '</dd></div>' +
          '<div><dt>Rum</dt><dd>' + stapel(tal(k, 'rum'), storstRum, 'rum') + '</dd></div>' +
          '<div><dt>Leverans</dt><dd>' + stapel(tal(k, 'lev'), storstLev, 'v', true) + '</dd></div>' +
          '<div><dt>Pris</dt><dd><strong>Från X kr</strong></dd></div>' +
          '</dl>' +
          '<a class="jamforruta__lank" href="' + lank + '">Se huskortet</a>' +
          '</article>';
      }).join('');
      ruta.style.setProperty('--antal', valda.length);
      if (ruta.showModal) ruta.showModal(); else ruta.setAttribute('open', '');
      requestAnimationFrame(function () { ruta.classList.add('jamforruta--fylld'); });
    });
    $('.jamforruta__stang', ruta).addEventListener('click', function () { ruta.close(); });
    ruta.addEventListener('click', function (e) { if (e.target === ruta) ruta.close(); });
    ruta.addEventListener('close', function () { ruta.classList.remove('jamforruta--fylld'); });
  })();

  /* --- 3D-lutning för kort i allmänhet -------------------------- */
  function lutaI3D(el, max) {
    if (!finPekare || lugn) return;
    var bokad = false, px = 0, py = 0;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width;
      py = (e.clientY - r.top) / r.height;
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(function () {
        bokad = false;
        el.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - py) * max * 0.8).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }
  $$('.priskort, .styrkort').forEach(function (k) { lutaI3D(k, 10); });

  /* --- Prissidan: storleksväljaren ------------------------------
     Som Kasters prisväljare: ett reglage, och korten svarar med vilken
     kategori som passar. Inga belopp - bara storlek och vad som krävs. */
  (function () {
    var reglage = $('#onskad-yta');
    if (!reglage) return;
    var ut = $('[data-yta-ut]');
    var svar = $('[data-yta-svar]');
    var kortP = $$('.priskort');
    function rita() {
      var y = Number(reglage.value);
      ut.textContent = y + ' m²';
      reglage.style.setProperty('--andel', ((y - reglage.min) / (reglage.max - reglage.min) * 100).toFixed(1) + '%');
      var passar = kortP.filter(function (k) {
        return y >= Number(k.getAttribute('data-min')) && y <= Number(k.getAttribute('data-max'));
      });
      if (!passar.length) {
        var bast = null, avst = Infinity;
        kortP.forEach(function (k) {
          var lo = Number(k.getAttribute('data-min')), hi = Number(k.getAttribute('data-max'));
          var a = y < lo ? lo - y : y - hi;
          if (a < avst) { avst = a; bast = k; }
        });
        passar = [bast];
      }
      kortP.forEach(function (k) {
        var med = passar.indexOf(k) > -1;
        if (med && !k.classList.contains('priskort--passar') && !lugn && k.animate) {
          k.animate([{ scale: '1' }, { scale: '1.035' }, { scale: '1' }],
            { duration: 500, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
        k.classList.toggle('priskort--passar', med);
      });
      var namn = passar.map(function (k) { return k.getAttribute('data-namn').toLowerCase(); });
      var lista = namn.length > 1 ? namn.slice(0, -1).join(', ') + ' och ' + namn[namn.length - 1] : namn[0];
      if (y <= 30) {
        svar.textContent = 'Vid ' + y + ' m² passar ett attefallshus. Inom detaljplan får det vara 30 m² utan bygglov.';
      } else if (y <= 50) {
        svar.textContent = 'Som komplementbostadshus kan huset vara lovfritt upp till 50 m², men bara utanför detaljplan. Närmast i storlek: ' + lista + '.';
      } else {
        svar.textContent = 'Vid ' + y + ' m² krävs bygglov. Närmast i storlek: ' + lista + '.';
      }
    }
    reglage.addEventListener('input', rita);
    rita();
  })();

  /* --- Prissidan: kostnadskartan ------------------------------- */
  (function () {
    var form = $('#kostnadskarta');
    if (!form) return;
    var ETIKETT = { stor: 'Stor post', medel: 'Räkna med', liten: 'Troligen liten', kolla: 'Kolla först', val: 'Ditt val' };
    function vald(n) { var el = $('input[name="' + n + '"]:checked', form); return el ? el.value : ''; }
    function satt(post, status, text) {
      var li = $('[data-post="' + post + '"]');
      if (!li) return;
      var fore = li.getAttribute('data-niva');
      li.setAttribute('data-niva', status);
      $('[data-status]', li).textContent = ETIKETT[status];
      $('[data-svar]', li).textContent = text;
      if (fore && fore !== status && !lugn && li.animate) {
        li.animate([
          { transform: 'perspective(800px) rotateX(0)' },
          { transform: 'perspective(800px) rotateX(-14deg)', offset: 0.35 },
          { transform: 'perspective(800px) rotateX(0)' }
        ], { duration: 600, easing: 'cubic-bezier(.34,1.4,.64,1)' });
      }
    }
    function rita() {
      var va = vald('va'), lut = vald('lutning'), infart = vald('infart'), vatten = vald('vatten');
      satt('grund', lut === 'sluttar' ? 'stor' : 'medel', lut === 'sluttar'
        ? 'Sluttning eller berg: plintar eller mer schakt, och grunden blir en större post.'
        : 'Plan mark: ofta en enklare platta eller plintar.');
      if (va === 'ja') satt('va', 'liten', 'Framdraget finns - kvar är anslutningen till huset och avgifterna.');
      else if (va === 'nej') satt('va', 'stor', 'Ingen framdragning: ledningarna ska dras till tomten, ofta en av de större posterna.');
      else satt('va', 'kolla', 'Fråga kommunen eller föreningen var närmaste anslutningspunkt finns.');
      if (infart === 'nej') satt('mark', 'stor', 'Infart eller plats för kranbil behöver ordnas innan leverans.');
      else if (lut === 'sluttar') satt('mark', 'medel', 'Fri väg, men sluttningen kan kräva schakt.');
      else satt('mark', 'liten', 'Fri väg och plan mark: ofta lite markarbete.');
      satt('avgift', 'medel', vatten === 'ja'
        ? 'Nära vatten söks strandskyddsdispens, utöver anmälan eller bygglov.'
        : 'Avgiften för anmälan eller bygglov, enligt kommunens taxa.');
      satt('tillval', 'val', 'Bara det du själv väljer till.');
      var poster = $$('[data-post]');
      var stora = poster.filter(function (p) { return p.getAttribute('data-niva') === 'stor'; }).length;
      var sma = poster.filter(function (p) { return p.getAttribute('data-niva') === 'liten'; }).length;
      $('[data-karta-summa]').textContent = (stora ? stora + (stora === 1 ? ' stor post' : ' stora poster') : 'Inga stora poster') +
        ' att räkna med' + (sma ? ', ' + sma + ' som troligen blir ' + (sma === 1 ? 'liten' : 'små') : '') + '.';
    }
    form.addEventListener('change', rita);
    rita();
  })();

  /* --- Steglinjen fylls när man rullar förbi ----------------------
     Kasters steglinje: linjen följer rullningen och varje steg tänds
     när linjen når det. Läs allt först, skriv sedan. */
  $$('[data-steglinje]').forEach(function (spar) {
    var steg = $$('li', spar);
    var aktiv = false, bokad = false;
    function rita() {
      bokad = false;
      var r = spar.getBoundingClientRect();
      var andel = Math.min(1, Math.max(0, (window.innerHeight * 0.72 - r.top) / r.height));
      spar.style.setProperty('--fyll', andel.toFixed(3));
      steg.forEach(function (li, i) {
        li.classList.toggle('tand', andel >= (i + 0.35) / steg.length);
      });
    }
    function vid() { if (!bokad) { bokad = true; requestAnimationFrame(rita); } }
    if (lugn || !window.IntersectionObserver) {
      spar.style.setProperty('--fyll', 1);
      steg.forEach(function (li) { li.classList.add('tand'); });
      return;
    }
    new IntersectionObserver(function (poster) {
      var inne = poster[0].isIntersecting;
      if (inne && !aktiv) { aktiv = true; window.addEventListener('scroll', vid, { passive: true }); }
      if (!inne && aktiv) { aktiv = false; window.removeEventListener('scroll', vid); }
      rita();
    }).observe(spar);
  });

  /* --- Så fungerar det ------------------------------------------ */
  (function () {
    var sek = $('.process--faser');
    if (!sek) return;
    var kortS = $$('.fassteg__kort', sek);
    kortS.forEach(function (k) { lutaI3D(k, 7); });
    $$('.vemfilter, .hustypval', sek).forEach(glidandeMarkering);

    // Vem gör vad: stegen som inte matchar tonas ner, de som matchar
    // lyfts fram. Filtret ändrar inget innehåll, bara betoningen.
    var vemKnappar = $$('.vemfilter button', sek);
    vemKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        vemKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var vem = b.getAttribute('data-vem');
        kortS.forEach(function (k, i) {
          var med = vem === 'alla' || k.getAttribute('data-vem') === vem;
          k.classList.toggle('dampad', !med);
          k.classList.toggle('markerad', med && vem !== 'alla');
          if (med && vem !== 'alla' && !lugn && k.animate) {
            k.animate([
              { transform: 'perspective(900px) rotateX(18deg) translateY(10px)', opacity: 0.6 },
              { transform: 'none', opacity: 1 }
            ], { duration: 600, delay: i * 40, easing: 'cubic-bezier(.34,1.4,.64,1)' });
          }
        });
        $$('[data-fard]', sek).forEach(function (a) {
          var k = $('#steg-' + a.getAttribute('data-fard'));
          a.classList.toggle('dampad', k.classList.contains('dampad'));
        });
      });
    });

    // Hustyp: steg 03 säger vad som faktiskt gäller för det huset, och
    // steg 06 får modellernas leveranstid.
    var steg3 = $('#steg-3'), steg6 = $('#steg-6');
    var leverans = {};
    try { leverans = JSON.parse(sek.getAttribute('data-leverans')); } catch (e) { leverans = {}; }
    var orig = steg3 ? { h: $('h3', steg3).textContent, p: $('p', steg3).textContent } : null;
    var chip = document.createElement('span');
    chip.className = 'fassteg__leverans';
    chip.hidden = true;
    if (steg6) $('.fassteg__topp', steg6).appendChild(chip);
    var TEXT = {
      attefallshus: ['Anmälan för installationerna',
        'Ett attefallshus inom måtten behöver sedan december 2025 varken bygglov eller anmälan för själva byggnaden. Ska det ha vatten, avlopp, ventilation eller eldstad anmäls installationerna. Vi tar fram underlaget, du lämnar in till kommunen.'],
      annat: ['Bygglov',
        'Fritidshus kräver bygglov. Vi tar fram ritningar och underlag, men det är du som är byggherre och söker lovet hos din kommun.']
    };
    var typKnappar = $$('.hustypval button', sek);
    typKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        typKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var typ = b.getAttribute('data-typ');
        if (steg3 && orig) {
          var t = typ === 'alla' ? [orig.h, orig.p] : (TEXT[typ] || TEXT.annat);
          $('h3', steg3).textContent = t[0];
          $('p', steg3).textContent = t[1];
          if (!lugn && steg3.animate) {
            steg3.animate([
              { transform: 'perspective(900px) rotateY(-12deg)', opacity: 0.4 },
              { transform: 'none', opacity: 1 }
            ], { duration: 650, easing: 'cubic-bezier(.34,1.4,.64,1)' });
          }
        }
        chip.hidden = typ === 'alla' || !leverans[typ];
        if (!chip.hidden) {
          chip.textContent = 'Leverans ' + leverans[typ] + ' v';
          chip.classList.remove('fassteg__leverans--ny');
          void chip.offsetWidth;
          chip.classList.add('fassteg__leverans--ny');
        }
      });
    });

    // Färdplanen: markerar steget man läser och fyller spåret dit.
    var fard = $$('[data-fard]', sek);
    var spar = $('.fardplan__spar span', sek);
    function markera(nr) {
      fard.forEach(function (a) {
        var n = Number(a.getAttribute('data-fard'));
        a.classList.toggle('aktiv', n === nr);
        a.classList.toggle('klar', n < nr);
      });
      if (spar) spar.style.transform = 'scaleX(' + ((nr - 1) / (fard.length - 1)).toFixed(3) + ')';
      kortS.forEach(function (k) {
        if (Number(k.getAttribute('data-steg')) <= nr) k.classList.add('tand');
      });
    }
    markera(1);
    if (window.IntersectionObserver) {
      // Läsbandet är mitten av skärmen. Står flera kort där (de ligger
      // bredvid varandra) räknas det sista, så spåret hinner fram.
      var synliga = new Map();
      var obs = new IntersectionObserver(function (poster) {
        poster.forEach(function (p) { synliga.set(p.target, p.isIntersecting); });
        var inne = kortS.filter(function (k) { return synliga.get(k); });
        if (inne.length) markera(Number(inne[inne.length - 1].getAttribute('data-steg')));
      }, { rootMargin: '-35% 0px -45% 0px' });
      kortS.forEach(function (k) { obs.observe(k); });
    }
  })();

  /* --- Huset i 3D och AR ------------------------------------------
     De fem husen i ritningarna R1-R5 finns som 3D-modeller i skala 1:1
     (modeller/hus-r*.glb, byggda av _3dmodeller.py). Visaren är Googles
     model-viewer, som ligger på sajten själv (vendor/) och bara laddas
     på sidor där det finns en modell att visa. */
  var MATT3D = {
    r1: ['7,14 m', '4,20 m', '4,00 m'],
    r2: ['8,33 m', '3,49 m', '4,00 m'],
    r3: ['10,83 m', '3,90 m', '4,35 m'],
    r4: ['12,50 m', '3,90 m', '4,05 m'],
    r5: ['7,50 m', '4,00 m', '4,00 m']
  };

  function laddaModelViewer() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve();
    return new Promise(function (klar, fel) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = 'vendor/model-viewer.min.js';
      s.onload = klar;
      s.onerror = fel;
      document.head.appendChild(s);
    });
  }

  (function () {
    var sek = $('#i-3d');
    var hero = $('.subpage-hero__image');
    if (!sek || !hero) return;
    var m = (hero.getAttribute('src') || '').match(/hus-(r\d)\.webp/);
    if (!m || !MATT3D[m[1]]) return;
    var id = m[1];
    sek.hidden = false;
    // Länkar från verktyget går hit (#i-3d). Sektionen var dold när
    // webbläsaren letade efter ankaret, så vi hoppar dit själva.
    if (location.hash === '#i-3d') {
      requestAnimationFrame(function () { sek.scrollIntoView({ block: 'start' }); });
    }
    $('[data-3d-langd]', sek).textContent = MATT3D[id][0];
    $('[data-3d-bredd]', sek).textContent = MATT3D[id][1];
    $('[data-3d-nock]', sek).textContent = MATT3D[id][2];

    // En knapp i heron, bredvid Planlösningar och Pris.
    var heroKnappar = $$('.subpage-hero a[href^="#"]');
    if (heroKnappar.length) {
      var ny = heroKnappar[heroKnappar.length - 1].cloneNode(false);
      ny.setAttribute('href', '#i-3d');
      ny.textContent = 'Se i 3D';
      heroKnappar[heroKnappar.length - 1].insertAdjacentElement('afterend', ny);
    }

    /* Konfiguratorn: fasadens och takets kulör och spegelvänd planlösning.
       Kulörerna sätts direkt på modellens material (fasad, panel, tak);
       panelen följer fasaden, lite mörkare. glTF vill ha linjära värden. */
    var FASAD_START = { r1: 'svart', r2: 'lärk', r3: 'svart', r4: 'ljusgrå', r5: 'svart' };
    function linjar(hex, faktor) {
      return [1, 3, 5].map(function (i) {
        var c = parseInt(hex.substr(i, 2), 16) / 255 * (faktor || 1);
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      }).concat([1]);
    }
    function konfigurera(mv) {
      var mat = {};
      (mv.model && mv.model.materials || []).forEach(function (m) { mat[m.name] = m; });
      if (!mat.fasad || !mat.tak) return;
      function valjare(rad, namnEl, tillampa) {
        var knappar = $$('button', rad);
        knappar.forEach(function (b) {
          b.addEventListener('click', function () {
            knappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            namnEl.textContent = '· ' + b.getAttribute('data-namn');
            tillampa(b.getAttribute('data-farg'));
            if (!lugn && b.animate) {
              b.animate([{ scale: '1' }, { scale: '1.25' }, { scale: '1' }],
                { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
            }
          });
        });
        var start = knappar.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
        if (start) namnEl.textContent = '· ' + start.getAttribute('data-namn');
      }
      var fasadRad = $('[data-konfig-fasad]', sek);
      var forsta = FASAD_START[id];
      $$('button', fasadRad).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-namn') === forsta));
      });
      valjare(fasadRad, $('[data-konfig-fasadnamn]', sek), function (hex) {
        mat.fasad.pbrMetallicRoughness.setBaseColorFactor(linjar(hex));
        if (mat.panel) mat.panel.pbrMetallicRoughness.setBaseColorFactor(linjar(hex, 0.72));
      });
      valjare($('[data-konfig-tak]', sek), $('[data-konfig-taknamn]', sek), function (hex) {
        mat.tak.pbrMetallicRoughness.setBaseColorFactor(linjar(hex));
      });
      var spegel = $('[data-konfig-spegel]', sek);
      spegel.addEventListener('change', function () {
        mv.setAttribute('scale', spegel.checked ? '-1 1 1' : '1 1 1');
      });
    }

    var scen = $('[data-3d-scen]', sek);
    var byggd = false;
    function bygg() {
      if (byggd) return;
      byggd = true;
      laddaModelViewer().then(function () {
        var mv = document.createElement('model-viewer');
        mv.setAttribute('src', 'modeller/hus-' + id + '.glb');
        mv.setAttribute('alt', '3D-modell av huset i skala 1:1');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('touch-action', 'pan-y');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('shadow-softness', '0.8');
        mv.setAttribute('exposure', '1.05');
        mv.setAttribute('environment-image', 'neutral');
        mv.setAttribute('camera-orbit', '35deg 72deg auto');
        mv.setAttribute('interaction-prompt', 'auto');
        mv.setAttribute('ar', '');
        mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
        mv.setAttribute('ar-scale', 'fixed');
        mv.setAttribute('ar-placement', 'floor');
        if (!lugn) {
          mv.setAttribute('auto-rotate', '');
          mv.setAttribute('auto-rotate-delay', '1500');
          mv.setAttribute('rotation-per-second', '12deg');
        }
        var ar = document.createElement('button');
        ar.slot = 'ar-button';
        ar.className = 'hus3dvy__ar';
        ar.type = 'button';
        ar.textContent = 'Se huset på din tomt';
        mv.appendChild(ar);
        var laddar = document.createElement('div');
        laddar.slot = 'poster';
        laddar.className = 'hus3dvy__laddar';
        laddar.textContent = 'Laddar 3D-modellen';
        mv.appendChild(laddar);
        scen.appendChild(mv);
        mv.addEventListener('load', function () {
          sek.classList.add('hus3dvy--laddad');
          if (mv.canActivateAR) $('[data-3d-mobil]', sek).hidden = true;
          konfigurera(mv);
        });
      }).catch(function () {
        scen.textContent = '3D-modellen kunde inte laddas.';
      });
    }
    narSynligt(sek, bygg, 0, '0px 0px 300px 0px');
  })();

  // Korten för husen som finns i 3D får en liten märkning.
  $$('.model-card[data-bild^="hus-r"] .model-card__media').forEach(function (a) {
    var m = document.createElement('span');
    m.className = 'model-card__3d';
    m.textContent = '3D · AR';
    a.appendChild(m);
  });

  /* --- Mörkt läge -----------------------------------------------
     En knapp i headern. Valet sparas, och ett litet skript i sidhuvudet
     sätter temat innan sidan ritas, så den inte blinkar vit. */
  (function () {
    var yta = $('.site-header__actions');
    if (!yta) return;
    var html = document.documentElement;
    var knapp = document.createElement('button');
    knapp.type = 'button';
    knapp.className = 'temaknapp';
    knapp.innerHTML =
      '<svg class="temaknapp__sol" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>' +
      '<svg class="temaknapp__mane" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
    function uppdatera() {
      var mork = html.getAttribute('data-tema') === 'mork';
      knapp.setAttribute('aria-pressed', String(mork));
      knapp.setAttribute('aria-label', mork ? 'Byt till ljust läge' : 'Byt till mörkt läge');
      var tc = $('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', mork ? '#15110d' : '#2c2820');
    }
    knapp.addEventListener('click', function () {
      var mork = html.getAttribute('data-tema') !== 'mork';
      if (!lugn) {
        html.classList.add('tema-byte');
        setTimeout(function () { html.classList.remove('tema-byte'); }, 600);
      }
      if (mork) html.setAttribute('data-tema', 'mork'); else html.removeAttribute('data-tema');
      lagra.spara('idealhus-tema', mork ? 'mork' : 'ljust');
      uppdatera();
    });
    yta.insertBefore(knapp, yta.firstChild);
    uppdatera();
  })();

  /* --- Tal som räknas upp --------------------------------------- */
  $$('[data-rakna]').forEach(function (el) {
    var mal = Number(el.getAttribute('data-rakna'));
    if (lugn || !mal) return;
    el.textContent = '0';
    narSynligt(el, function () {
      var start = performance.now();
      (function steg(nu) {
        var t = Math.min(1, (nu - start) / 1400);
        el.textContent = Math.round(mal * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(steg);
      })(start);
    }, 0.6);
  });

  /* --- Drivande ljus i kontaktsektionen -------------------------- */
  $$('.contact-section, .tomtkoll, .kollen-topp').forEach(function (s) {
    if (lugn) return;
    var ljus = document.createElement('span');
    ljus.className = 'drivljus';
    ljus.setAttribute('aria-hidden', 'true');
    s.classList.add('har-drivljus');
    s.insertBefore(ljus, s.firstChild);
    pausaUtanforVy(s);
  });

  /* --- Kopiera mejladressen ------------------------------------- */
  if (navigator.clipboard) {
    $$('.contact-section__meta a[href^="mailto:"], .kontakt-direkt__lankar a[href^="mailto:"]').forEach(function (a) {
      var knapp = document.createElement('button');
      knapp.type = 'button';
      knapp.className = 'kopiera';
      knapp.textContent = 'Kopiera';
      var adress = a.getAttribute('href').replace('mailto:', '');
      knapp.setAttribute('aria-label', 'Kopiera ' + adress);
      // Länk och knapp i en egen rad, annars sträcks knappen ut i
      // kontaktlistornas rutnät.
      var rad = document.createElement('span');
      rad.className = 'kopiera-rad';
      a.parentNode.insertBefore(rad, a);
      rad.appendChild(a);
      rad.appendChild(knapp);
      knapp.addEventListener('click', function () {
        navigator.clipboard.writeText(adress).then(function () {
          knapp.textContent = 'Kopierad';
          knapp.classList.add('kopiera--klar');
          setTimeout(function () {
            knapp.textContent = 'Kopiera';
            knapp.classList.remove('kopiera--klar');
          }, 1800);
        });
      });
    });
  }

  /* --- Huskortet: ryms huset på min tomt? ----------------------- */
  var ryms = $('[data-ryms]');
  if (ryms) {
    var dt = $$('.model-specs dt').filter(function (d) { return d.textContent.trim() === 'Boyta'; })[0];
    var yta = dt && parseInt(dt.nextElementSibling.textContent, 10);
    var namn = $('.subpage-hero__title');
    if (yta) {
      ryms.href = 'vad-far-jag-bygga.html?yta=' + yta +
        (namn ? '&namn=' + encodeURIComponent(namn.textContent.trim()) : '');
    }
  }

  /* --- Tipset om verktyget -------------------------------------
     Som Kasters lanseringsnotis: visas en gång efter halva sidan,
     aldrig där det redan finns ett formulär eller verktyget självt,
     och inte igen på fjorton dagar efter att man stängt det. */
  var utan = ['vad-far-jag-bygga.html', 'kontakt.html', '404.html', 'integritetspolicy.html'];
  if (utan.indexOf(sida) < 0) {
    var senast = Number(lagra.hamta('idealhus-tips') || 0);
    if (Date.now() - senast > 14 * 864e5) {
      var tips = document.createElement('aside');
      tips.className = 'tipsruta';
      tips.setAttribute('aria-label', 'Tips');
      tips.hidden = true;
      tips.innerHTML =
        '<p class="tipsruta__etikett">Prova</p>' +
        '<p class="tipsruta__text">Hur stort hus får stå på din tomt? Svara på fem frågor.</p>' +
        '<a class="tipsruta__lank" href="vad-far-jag-bygga.html">Räkna på din tomt</a>' +
        '<button class="tipsruta__stang" type="button" aria-label="Stäng tipset">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
      document.body.appendChild(tips);
      var stang = function () {
        lagra.spara('idealhus-tips', String(Date.now()));
        tips.classList.remove('tipsruta--synlig');
        setTimeout(function () { tips.hidden = true; }, 400);
      };
      $('.tipsruta__stang', tips).addEventListener('click', stang);
      $('a', tips).addEventListener('click', function () {
        lagra.spara('idealhus-tips', String(Date.now()));
      });
      var kolla = function () {
        var andel = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
        if (andel < 0.5) return;
        window.removeEventListener('scroll', kolla);
        tips.hidden = false;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { tips.classList.add('tipsruta--synlig'); });
        });
      };
      window.addEventListener('scroll', kolla, { passive: true });

      // Kontaktsektionen är redan samma uppmaning - där går tipset undan.
      var kontakt = $('.contact-section');
      if (kontakt && window.IntersectionObserver) {
        new IntersectionObserver(function (poster) {
          tips.classList.toggle('tipsruta--undan', poster[0].isIntersecting);
        }, { rootMargin: '0px 0px -20% 0px' }).observe(kontakt);
      }
    }
  }

  /* --- Hela bilden ---------------------------------------------
     Husbilderna har en skylt i nedre vänstra hörnet och ska synas
     hela. Toppbilderna, startsidans höga kort och fördelskorten har
     en annan form än bilden; där får bilden stå hel och en suddig
     kopia av samma bild fylla resten (styles.css, .helbild). Kopian
     är samma fil, så inget laddas två gånger. */
  $$('.subpage-hero__image, .house-card__image, .feature-card__image').forEach(function (img) {
    var ram = img.parentNode;
    var bak = document.createElement('img');
    bak.className = 'helbild__bak';
    bak.alt = '';
    bak.setAttribute('aria-hidden', 'true');
    bak.decoding = 'async';
    if (img.getAttribute('loading') === 'lazy') bak.loading = 'lazy';
    bak.src = img.getAttribute('src');
    ram.insertBefore(bak, img);
    ram.classList.add('helbild');
    // Huskortet byter bild efter modell - kopian följer med.
    new MutationObserver(function () { bak.src = img.getAttribute('src'); })
      .observe(img, { attributes: true, attributeFilter: ['src'] });
  });
})();
