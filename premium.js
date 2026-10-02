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
    $$('main h2').forEach(function (h) {
      // Toppens rubriker får en entré med bara CSS (de syntes annars,
      // försvann och steg igen när skriptet hade laddat).
      if (h.closest('.hero, .ihtopp, .subpage-hero, .guidehero, .kollen-topp, .fyrafyra, .pf-topp') || h.closest('.kollen__svar')) return;
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
  var hero = $('.hero[data-malgrupp], .ihtopp[data-malgrupp]');
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
  // annars bildrutor hela vägen ner genom sidan. Den startas härifrån
  // (inte autoplay), så i telefonens sparläge och vid lugn rörelse
  // laddas den aldrig - då står stillbilden kvar. Mobilen får en
  // mindre fil (720p, ca 2 MB) via <source media> i index.html.
  var film = $('.hero__media, .ihtopp__film');
  var sparaData = !!(navigator.connection && navigator.connection.saveData);
  if (film && film.tagName === 'VIDEO' && window.IntersectionObserver) {
    // Filmen tonar in över stillbilden först när den faktiskt spelar,
    // så det blir ingen hård övergång från stillbild till första rutan.
    film.addEventListener('playing', function () { film.classList.add('spelar'); }, { once: true });
    new IntersectionObserver(function (poster) {
      if (poster[0].isIntersecting) {
        if (!lugn && !sparaData && film.paused) { var p = film.play(); if (p && p.catch) p.catch(function () {}); }
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
    if (img.closest('.hero, .ihtopp, .subpage-hero, .kat-topp, .at-foto, .heroscen, .ordband, .val, .vag, .hus, .kuliss, .bygget, .virke, .pf-tak, .husval, .sprang, .segment')) return;
    // Husfotona (skylten nere till vänster) beskärs aldrig, inte ens
    // under pekaren - de får ett ljuslyft i CSS:en i stället.
    if (/hus-r\d/.test(img.getAttribute('src') || '')) return;
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
     Borttaget 2026-09-30 på kundens begäran - sidan ska se renare ut. */

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
      '<a href="vad-far-jag-bygga.html" target="_blank" rel="noopener">Se vad som ryms på din tomt</a>';
    rad.appendChild(tipsRad);
    $$('input[name="' + attefall.name + '"]', rad).forEach(function (inp) {
      inp.addEventListener('change', function () { tipsRad.hidden = !attefall.checked; });
    });
  }

  /* --- Kontaktstegen --------------------------------------------
     Numren poppar fram och guldlinjen mellan dem ritas när listan
     syns. Stil i design.css 08b. */
  $$('.contact-section .kontakt-tips').forEach(function (lista) {
    if (lugn) { lista.classList.add('tips--inne'); return; }
    narSynligt(lista, function (e) { e.classList.add('tips--inne'); }, 0.3);
  });

  // Vänsterspalten klistrar bredvid formuläret. Är den högre än
  // fönstret klistrar den i underkant i stället, så att kontaktkortet
  // alltid går att se (--klister läses i design.css 08b).
  $$('.contact-section__intro').forEach(function (intro) {
    function satt() {
      var h = intro.offsetHeight;
      intro.style.setProperty('--klister', Math.min(112, window.innerHeight - h - 24) + 'px');
    }
    satt();
    window.addEventListener('resize', satt, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(satt).observe(intro);
  });

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

    /* Jämför upp till tre hus sida vid sida. */
    var bar = $('.jamforbar');
    var ruta = $('.jamforruta');
    if (!bar || !ruta) return;
    var valda = [];
    function uppdateraBar() {
      var antal = $('[data-jamfor-antal]', bar);
      antal.textContent = valda.length;
      // "1 hus valt", "2 hus valda".
      if (antal.nextSibling && antal.nextSibling.nodeType === 3) antal.nextSibling.textContent = valda.length === 1 ? ' hus valt' : ' hus valda';
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
          '<img src="images/' + k.getAttribute('data-bild') + '" srcset="images/' + k.getAttribute('data-bild').replace('.webp', '-800.webp') + ' 800w, images/' + k.getAttribute('data-bild') + ' 1600w" sizes="(max-width: 700px) 92vw, 460px" alt="">' +
          '<h3>' + k.getAttribute('data-namn') + '</h3>' +
          '<dl>' +
          '<div><dt>Boyta</dt><dd>' + stapel(tal(k, 'yta'), storstYta, 'm²') + '</dd></div>' +
          '<div><dt>Rum</dt><dd>' + stapel(tal(k, 'rum'), storstRum, 'rum') + '</dd></div>' +
          '<div><dt>Leverans</dt><dd>' + stapel(tal(k, 'lev'), storstLev, 'v', true) + '</dd></div>' +
          '<div><dt>Pris</dt><dd><strong>I offert</strong></dd></div>' +
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
  $$('.pkort').forEach(function (k) { lutaI3D(k, 3); });

  /* --- Prissidan: storleksskalan ---------------------------------
     Ett reglage över en linjal med måttparenteser för zonerna (lov),
     en bubbla som följer knoppen och märken där vi har hus. Under:
     husen med bild - klick flyttar reglaget dit. Golvytan ritas i
     isometri (samma sätt som byggscenen på startsidan) med en ruta per
     kvadratmeter, en bil på sin bilplats och en person för skalan, och
     växer mjukt till den valda ytan. Inga belopp.
     Stil i design.css 18, märkning i _sidor3.py. */
  (function () {
    var reglage = $('#onskad-yta');
    if (!reglage) return;
    var skala = reglage.closest('.prisskala');
    var linjal = $('.prisskala__linjal', skala);
    var ut = $('[data-yta-ut]', skala);
    var bubbla = $('[data-yta-bubbla]', skala);
    var svar = $('[data-yta-svar]', skala);
    var lov = $('[data-yta-lov]', skala);
    var modeller = $$('.prisskala__modell', skala);
    var hak = $$('.prisskala__hak', skala);
    var chips = $$('.prisskala__chip', skala);
    var zoner = $$('.zon', skala);
    var kortP = $$('.pkort', skala);
    var golvText = $('[data-yta-golv]', skala);
    var bilar = $('[data-yta-bilar]', skala);
    var iso = $('[data-yta-iso]', skala);
    var tips = $('.prisskala__tips', skala);
    var min = Number(reglage.min), max = Number(reglage.max);
    var forraZon = '', forraY = null;

    var PERSON = 'M20 3a8 8 0 1 1 0 16a8 8 0 1 1 0-16zM12 22H28A6 6 0 0 1 34 28V62A3 3 0 0 1 28 62V36H27V115' +
      'A3.25 3.25 0 0 1 20.5 115V70H19.5V115A3.25 3.25 0 0 1 13 115V36H12V62A3 3 0 0 1 6 62V28A6 6 0 0 1 12 22Z';
    // Isometrin: x längs golvets långsida, y på djupet, z uppåt (meter).
    var S = 20, C = 0.8660254;
    function P(x, y, z) { return [(x - y) * C * S, (x + y) * 0.5 * S - z * S]; }
    function pts(lista) {
      return lista.map(function (p) { var q = P(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    }
    function poly(lista, klass) { return '<polygon class="' + klass + '" points="' + pts(lista) + '"/>'; }
    function lin(a, b, klass) {
      var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
      return '<line class="' + klass + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) +
        '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>';
    }
    // En låda: topp och de två sidor som syns (mot +x och +y).
    function lada(x, y, z, w, d, h, klass) {
      return poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], klass + ' iso-sida-x') +
        poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], klass + ' iso-sida-y') +
        poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], klass + ' iso-topp');
    }
    // Golvytan som ett litet rum i genomskärning: golv med en ruta per
    // kvadratmeter, två glasväggar bakom, en säng, en köksbänk och en
    // soffa i verklig storlek, bilen på sin bilplats och en person.
    // viewBox räknas en gång så att största ytan får plats - skalan är
    // densamma för alla storlekar, bara huset växer.
    // En bil i isometri, längs y med fronten mot +y: kaross, kupé med
    // vindruta och sidorutor, hjul, lampor och backspegel.
    function bil(cx, cy) {
      var Lb = 4.4, Bb = 1.8, z0 = 0.28, zk = 0.86, zt = 1.46;
      function hjul(y) {
        var punkter = [], navet = [];
        for (var t = 0; t < 24; t++) {
          var a = t / 24 * Math.PI * 2;
          punkter.push([cx + Bb + 0.01, y + Math.cos(a) * 0.36, 0.36 + Math.sin(a) * 0.36]);
          navet.push([cx + Bb + 0.02, y + Math.cos(a) * 0.18, 0.36 + Math.sin(a) * 0.18]);
        }
        return poly(punkter, 'iso-hjul') + poly(navet, 'iso-nav');
      }
      var s = poly([[cx - 0.15, cy - 0.1, 0], [cx + Bb + 0.35, cy - 0.1, 0], [cx + Bb + 0.35, cy + Lb + 0.2, 0], [cx - 0.15, cy + Lb + 0.2, 0]], 'iso-bilskugga');
      // Karossen.
      s += lada(cx, cy, z0, Bb, Lb, zk - z0, 'iso-kaross');
      // Motorhuv och baklucka sluttar lite.
      s += poly([[cx, cy + 3.35, zk], [cx + Bb, cy + 3.35, zk], [cx + Bb, cy + Lb, zk - 0.08], [cx, cy + Lb, zk - 0.08]], 'iso-kaross iso-huv');
      // Kupén: tak, vindruta, sidoruta.
      var k0 = cx + 0.14, k1 = cx + Bb - 0.14;
      s += poly([[k1, cy + 0.55, zk], [k1, cy + 3.35, zk], [k1 - 0.04, cy + 2.8, zt], [k1 - 0.04, cy + 1.05, zt]], 'iso-kupe-sida');
      s += poly([[k1 + 0.005, cy + 0.85, zk + 0.08], [k1 + 0.005, cy + 3.05, zk + 0.08], [k1 - 0.03, cy + 2.7, zt - 0.08], [k1 - 0.03, cy + 1.15, zt - 0.08]], 'iso-ruta');
      s += lin([k1 + 0.006, cy + 2.0, zk + 0.06], [k1 - 0.02, cy + 2.0, zt - 0.06], 'iso-stolpe');
      s += poly([[k0, cy + 3.35, zk], [k1, cy + 3.35, zk], [k1 - 0.04, cy + 2.8, zt], [k0 + 0.04, cy + 2.8, zt]], 'iso-vindruta');
      s += poly([[k0 + 0.04, cy + 1.05, zt], [k1 - 0.04, cy + 1.05, zt], [k1 - 0.04, cy + 2.8, zt], [k0 + 0.04, cy + 2.8, zt]], 'iso-biltak');
      // Hjulen på den synliga sidan.
      s += hjul(cy + 0.95) + hjul(cy + 3.5);
      // Dörrlinjen och handtaget.
      s += lin([cx + Bb + 0.005, cy + 2.0, z0 + 0.08], [cx + Bb + 0.005, cy + 2.0, zk - 0.02], 'iso-dorrlinje');
      s += lin([cx + Bb + 0.005, cy + 2.3, zk - 0.16], [cx + Bb + 0.005, cy + 2.55, zk - 0.16], 'iso-handtag');
      // Fronten: strålkastare och grill.
      s += poly([[cx + 0.15, cy + Lb + 0.005, zk - 0.3], [cx + 0.55, cy + Lb + 0.005, zk - 0.3], [cx + 0.55, cy + Lb + 0.005, zk - 0.17], [cx + 0.15, cy + Lb + 0.005, zk - 0.17]], 'iso-lampa');
      s += poly([[cx + 1.25, cy + Lb + 0.005, zk - 0.3], [cx + 1.65, cy + Lb + 0.005, zk - 0.3], [cx + 1.65, cy + Lb + 0.005, zk - 0.17], [cx + 1.25, cy + Lb + 0.005, zk - 0.17]], 'iso-lampa');
      s += poly([[cx + 0.65, cy + Lb + 0.005, z0 + 0.1], [cx + 1.15, cy + Lb + 0.005, z0 + 0.1], [cx + 1.15, cy + Lb + 0.005, zk - 0.32], [cx + 0.65, cy + Lb + 0.005, zk - 0.32]], 'iso-grill');
      // Backspegeln.
      s += lada(cx + Bb, cy + 3.05, zk + 0.02, 0.16, 0.1, 0.12, 'iso-spegel');
      return s;
    }
    function rita3d(A, etikett) {
      if (!iso) return;
      var W = Math.sqrt(A * 1.6), D = A / W, h = 0.22, vh = 2.4;
      var x0 = -W / 2, y0 = -D / 2, x1 = W / 2, y1 = D / 2;
      var s = poly([[x0 + 0.5, y0 + 0.5, 0], [x1 + 0.9, y0 + 0.5, 0], [x1 + 0.9, y1 + 0.9, 0], [x0 + 0.5, y1 + 0.9, 0]], 'iso-skugga');
      s += lada(x0, y0, 0, W, D, h, 'iso-golv');
      for (var i = 1; i < W; i++) s += lin([x0 + i, y0, h], [x0 + i, y1, h], 'iso-rut');
      for (var j = 1; j < D; j++) s += lin([x0, y0 + j, h], [x1, y0 + j, h], 'iso-rut');
      // Glasväggarna bakom, med ett fönster.
      var t = h + vh;
      s += poly([[x0, y0, h], [x1, y0, h], [x1, y0, t], [x0, y0, t]], 'iso-vagg iso-vagg--bak');
      s += poly([[x0, y0, h], [x0, y1, h], [x0, y1, t], [x0, y0, t]], 'iso-vagg iso-vagg--sida');
      var fx = x0 + W * 0.42;
      s += poly([[fx, y0, h + 0.9], [fx + 1.4, y0, h + 0.9], [fx + 1.4, y0, h + 2.0], [fx, y0, h + 2.0]], 'iso-fonster');
      s += lin([fx + 0.7, y0, h + 0.9], [fx + 0.7, y0, h + 2.0], 'iso-fonsterpost');
      s += lin([x0, y1, t], [x0, y0, t], 'iso-vaggkant') + lin([x0, y0, t], [x1, y0, t], 'iso-vaggkant') +
        lin([x0, y0, h], [x0, y0, t], 'iso-vaggkant') + lin([x1, y0, h], [x1, y0, t], 'iso-vaggkant') +
        lin([x0, y1, h], [x0, y1, t], 'iso-vaggkant');
      // Möblerna i verklig storlek.
      // Sängen (1,6 x 2,0 m) längs bakväggen, huvudänden mot vänsterväggen.
      var bx0 = x0 + 0.3, by0 = y0 + 0.3;
      s += lada(bx0, by0, h, 2.0, 1.6, 0.28, 'iso-sangram');
      s += lada(bx0 + 0.05, by0 + 0.05, h + 0.28, 1.9, 1.5, 0.18, 'iso-sang');
      s += lada(bx0 + 0.1, by0 + 0.15, h + 0.46, 0.38, 0.55, 0.1, 'iso-kudde') +
        lada(bx0 + 0.1, by0 + 0.85, h + 0.46, 0.38, 0.55, 0.1, 'iso-kudde');
      s += lada(bx0 + 0.95, by0 + 0.05, h + 0.46, 1.0, 1.5, 0.04, 'iso-filt');
      // Köksbänken längs bakväggen till höger.
      var kx = x1 - 2.6;
      s += lada(kx, y0 + 0.05, h, 2.3, 0.6, 0.9, 'iso-bank');
      s += lada(kx - 0.02, y0 + 0.03, h + 0.9, 2.34, 0.64, 0.05, 'iso-bankskiva');
      // Soffan (1,8 m) mot vänsterväggen framför sängen, när den får plats.
      var sy0 = by0 + 1.6 + 0.25;
      if (y1 - 0.3 - sy0 >= 1.8) {
        var sx = x0 + 0.25, sy = y1 - 0.3 - 1.8;
        s += lada(sx, sy, h, 0.9, 1.8, 0.42, 'iso-soffa');
        s += lada(sx, sy, h + 0.42, 0.28, 1.8, 0.4, 'iso-soffa');
        s += lada(sx + 0.32, sy + 0.1, h + 0.42, 0.5, 0.75, 0.08, 'iso-dyna') +
          lada(sx + 0.32, sy + 0.95, h + 0.42, 0.5, 0.75, 0.08, 'iso-dyna');
      }
      // Mattan och bordet mitt i rummet, växten i hörnet vid fönstret.
      s += poly([[-0.35, -0.1, h + 0.01], [1.95, -0.1, h + 0.01], [1.95, 1.6, h + 0.01], [-0.35, 1.6, h + 0.01]], 'iso-matta');
      s += poly([[-0.2, 0.05, h + 0.012], [1.8, 0.05, h + 0.012], [1.8, 1.45, h + 0.012], [-0.2, 1.45, h + 0.012]], 'iso-mattkant');
      s += lada(0.84, 0.54, h, 0.12, 0.12, 0.7, 'iso-bordben');
      s += lada(0.4, 0.1, h + 0.7, 1.0, 1.0, 0.06, 'iso-bord');
      s += lada(0.0, 0.35, h, 0.45, 0.45, 0.42, 'iso-stol') + lada(0.0, 0.35, h + 0.42, 0.08, 0.45, 0.45, 'iso-stol');
      s += lada(1.5, 0.35, h, 0.45, 0.45, 0.42, 'iso-stol') + lada(1.87, 0.35, h + 0.42, 0.08, 0.45, 0.45, 'iso-stol');
      var vx = Math.min(fx + 1.75, x1 - 3.0), vy = y0 + 0.2;
      if (vx > bx0 + 2.2) {
        s += lada(vx, vy, h, 0.36, 0.36, 0.38, 'iso-kruka');
        var v = P(vx + 0.18, vy + 0.18, h + 0.38);
        s += '<path class="iso-blad" d="M' + v[0].toFixed(1) + ' ' + v[1].toFixed(1) +
          'c-10-6-14-16-9-26c6 8 8 16 9 26zm0 0c4-10 12-16 22-16c-4 9-11 14-22 16zm0 0c-2-12 2-22 10-28c2 11-2 20-10 28z"/>';
      }
      // Bilplatsen till höger om golvet, bilen i mitten av den.
      var px = x1 + 1.2, py = y0 - 5.2;
      s += poly([[px, py, 0], [px + 2.5, py, 0], [px + 2.5, py + 5, 0], [px, py + 5, 0]], 'iso-plats');
      s += bil(px + 0.35, py + 0.3);
      // Personen (1,8 m) framför golvets främre långsida.
      var fot = P(x0 + W * 0.3, y1 + 1.7, 0), k = 1.8 * S / 115.25;
      s += '<ellipse class="iso-fotskugga" cx="' + fot[0].toFixed(1) + '" cy="' + fot[1].toFixed(1) + '" rx="9" ry="3.5"/>';
      s += '<path class="iso-person" transform="translate(' + (fot[0] - 20 * k).toFixed(1) + ',' +
        (fot[1] - 118.25 * k).toFixed(1) + ') scale(' + k.toFixed(4) + ')" d="' + PERSON + '"/>';
      // Ytan som en bricka över golvets främre del.
      var c = P(x1, y1, 0), bredd = etikett.length * 7.6 + 26;
      c = [c[0], c[1] + 30];
      s += '<g class="iso-etikett" transform="translate(' + c[0].toFixed(1) + ',' + c[1].toFixed(1) + ')">' +
        '<rect x="' + (-bredd / 2).toFixed(1) + '" y="-14" width="' + bredd.toFixed(1) + '" height="28" rx="14"/>' +
        '<text y="4.5" text-anchor="middle">' + etikett + '</text></g>';
      iso.innerHTML = s;
    }
    // Ramen runt största och minsta ytan, en gång.
    (function () {
      if (!iso) return;
      var mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
      [min, max].forEach(function (A) {
        var W = Math.sqrt(A * 1.6), D = A / W, x0 = -W / 2, y0 = -D / 2, x1 = W / 2, y1 = D / 2;
        [[x0, y0, 2.62], [x0, y1, 0], [x1, y1, 0], [x1, y0, 2.62], [x1 + 3.7, y0 - 5.2, 0], [x1 + 3.7, y0 - 0.2, 0], [x1 + 1.2, y0 - 0.2, 0], [x1 + 1.2, y0 - 5.2, 1.3],
          [x0 + W * 0.3, y1 + 1.7, 1.9], [x0 + W * 0.3, y1 + 1.7, 0], [x1 + 1.6, y1 + 1.6, 0]].forEach(function (q) {
          var p = P(q[0], q[1], q[2]);
          mx = Math.min(mx, p[0]); Mx = Math.max(Mx, p[0]); my = Math.min(my, p[1]); My = Math.max(My, p[1]);
        });
      });
      iso.setAttribute('viewBox', (mx - 16).toFixed(0) + ' ' + (my - 16).toFixed(0) + ' ' +
        (Mx - mx + 32).toFixed(0) + ' ' + (My - my + 32).toFixed(0));
    })();
    var visad = Number(reglage.value), mal = visad, isoRaf = null;
    function tweena() {
      isoRaf = null;
      visad += (mal - visad) * 0.22;
      if (Math.abs(mal - visad) < 0.02) visad = mal;
      rita3d(visad, mal + ' m²');
      if (visad !== mal) isoRaf = requestAnimationFrame(tweena);
    }

    function rita() {
      var y = Number(reglage.value);
      linjal.style.setProperty('--a', ((y - min) / (max - min)).toFixed(4));
      ut.textContent = y;
      bubbla.textContent = y + ' m²';
      golvText.textContent = y + ' m²';
      bilar.textContent = (Math.round(y / 12.5 * 10) / 10).toString().replace('.', ',');
      if (forraY !== null && forraY !== y && !lugn) {
        ut.classList.remove('rulla');
        void ut.offsetWidth;
        ut.classList.add('rulla');
      }
      forraY = y;

      var bast = Infinity;
      modeller.forEach(function (m) { bast = Math.min(bast, Math.abs(Number(m.getAttribute('data-yta')) - y)); });
      function nara(el) { return Math.abs(Number(el.getAttribute('data-yta')) - y) === bast; }
      modeller.forEach(function (m) { m.classList.toggle('aktiv', nara(m)); });
      hak.forEach(function (m) { m.classList.toggle('aktiv', nara(m)); });
      chips.forEach(function (c) { c.hidden = !nara(c); });

      var zon = y <= 30 ? 'a' : y <= 50 ? 'b' : 'c';
      zoner.forEach(function (z) { z.classList.toggle('aktiv', z.classList.contains('zon--' + zon)); });
      if (zon !== forraZon) {
        forraZon = zon;
        lov.setAttribute('data-zon', zon);
        lov.textContent = zon === 'a' ? 'Inget bygglov inom måtten'
          : zon === 'b' ? 'Lovfritt som komplementbostadshus utanför detaljplan, annars bygglov'
          : 'Bygglov';
      }
      svar.textContent = zon === 'a'
        ? 'Vid ' + y + ' m² passar ett attefallshus. Inom detaljplan får det vara 30 m² utan bygglov.'
        : zon === 'b'
          ? 'Våra fritidshus på 40 och 50 m² kräver bygglov. Som komplementbostadshus utanför detaljplan kan ett hus upp till 50 m² vara lovfritt.'
          : 'Vid ' + y + ' m² krävs bygglov.';

      // Gränsmätaren och zonen på svarskortet.
      var gransfyll = $('[data-yta-gransfyll]', skala);
      if (gransfyll) gransfyll.style.transform = 'scaleX(' + (y / max).toFixed(4) + ')';
      var svarKort = $('.prisskala__svar', skala);
      if (svarKort) svarKort.setAttribute('data-zon', zon);
      var bubblaRuta = bubbla.parentNode;
      if (!lugn && bubblaRuta) {
        bubblaRuta.classList.remove('puls');
        void bubblaRuta.offsetWidth;
        bubblaRuta.classList.add('puls');
      }

      var passar = kortP.filter(function (k) {
        return y >= Number(k.getAttribute('data-min')) && y <= Number(k.getAttribute('data-max'));
      });
      if (!passar.length) {
        var avst = Infinity, narmast = null;
        kortP.forEach(function (k) {
          var lo = Number(k.getAttribute('data-min')), hi = Number(k.getAttribute('data-max'));
          var a = y < lo ? lo - y : y - hi;
          if (a < avst) { avst = a; narmast = k; }
        });
        passar = [narmast];
      }
      var bara = !kortP.some(function (k) {
        return y >= Number(k.getAttribute('data-min')) && y <= Number(k.getAttribute('data-max'));
      });
      kortP.forEach(function (k) {
        k.classList.toggle('pkort--passar', passar.indexOf(k) > -1);
        var etikett = $('.pkort__passar', k);
        if (etikett) etikett.textContent = bara ? 'Närmast i storlek' : 'Passar storleken';
      });

      mal = y;
      if (lugn) { visad = y; rita3d(y, y + ' m²'); } else if (!isoRaf) isoRaf = requestAnimationFrame(tweena);
    }
    function rort() { if (tips) tips.classList.add('prisskala__tips--borta'); }
    reglage.addEventListener('input', function () { rort(); rita(); });
    modeller.forEach(function (m) {
      m.addEventListener('click', function () {
        reglage.value = m.getAttribute('data-yta');
        rort();
        rita();
      });
    });
    rita3d(visad, visad + ' m²');
    rita();
  })();

  /* --- Prissidan: stämpeln på offerten slås fast när den syns ----- */
  $$('.offert').forEach(function (o) {
    if (lugn) { o.classList.add('syns'); return; }
    narSynligt(o, function (e) { e.classList.add('syns'); }, 0.3);
  });

  /* --- Prissidan: faktorernas bilder rör sig när de syns ---------- */
  $$('.faktor').forEach(function (f) {
    if (lugn) { f.classList.add('syns'); return; }
    narSynligt(f, function (e) { e.classList.add('syns'); }, 0.35);
  });
  var faktorGrid = $('.prisfaktorer__grid');
  if (faktorGrid && !lugn) pausaUtanforVy(faktorGrid);

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
      var svarEl = $('[data-svar]', li);
      var foreText = svarEl.textContent;
      li.setAttribute('data-niva', status);
      $('[data-status]', li).textContent = ETIKETT[status];
      svarEl.textContent = text;
      // Raden som ändras (status eller förklaring) får ett guldsvep och
      // etiketten poppar (design.css 18).
      if (fore && (fore !== status || foreText !== text) && !lugn) {
        li.classList.remove('orad--ny');
        void li.offsetWidth;
        li.classList.add('orad--ny');
      }
    }
    function rita() {
      var va = vald('va'), lut = vald('lutning'), infart = vald('infart'), vatten = vald('vatten');
      satt('grund', lut === 'sluttar' ? 'stor' : 'medel', lut === 'sluttar'
        ? 'Sluttning eller berg: plintar eller mer schakt, och grunden blir en större post.'
        : 'Plan mark: ofta en enklare platta eller plintar.');
      if (va === 'ja') satt('va', 'liten', 'Framdraget finns – kvar är anslutningen till huset och avgifterna.');
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
      var ORD = ['inga', 'en', 'två', 'tre', 'fyra', 'fem'];
      var stort = function (n) { var o = ORD[n] || String(n); return o.charAt(0).toUpperCase() + o.slice(1); };
      $('[data-karta-summa]').textContent = (stora ? stort(stora) + (stora === 1 ? ' stor post' : ' stora poster') : 'Inga stora poster') +
        ' att räkna med' + (sma ? ' – ' + (ORD[sma] || sma) + ' blir troligen ' + (sma === 1 ? 'liten' : 'små') : '') + '.';
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

  /* Sju scener i isometri, en per steg (Så fungerar det). Samma
     projektion och färgskala som byggscenen på startsidan. Varje scen
     returnerar SVG-innehåll för viewBox 0 0 600 440; rörelserna ligger i
     design.css (klasserna v-*) och körs bara när scenen är aktiv. */
  var SCENER = (function () {
    var S = 26, OX = 300, OY = 250, C = 0.8660254;
    function P(x, y, z) { return [OX + (x - y) * S * C, OY + (x + y) * S * 0.5 - (z || 0) * S]; }
    function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
    function poly(a, fill, extra) { return '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
    function lin(a, farg, b, extra) {
      return '<polyline points="' + pts(a) + '" fill="none" stroke="' + farg + '" stroke-width="' + b +
        '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
    }
    function box(x, y, z, dx, dy, dz, f, extra) {
      var x1 = x + dx, y1 = y + dy, z1 = z + dz;
      return poly([P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)], f.x, extra) +
        poly([P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)], f.y, extra) +
        poly([P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)], f.t, extra);
    }
    function g(klass, inne, stil) {
      return '<g class="' + klass + '"' + (stil ? ' style="' + stil + '"' : '') + '>' + inne + '</g>';
    }
    // Mjuk skugga på marken.
    function skugga(x, y, rx, ry, a) {
      var p = P(x, y, 0);
      return '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="' + (rx * S).toFixed(1) +
        '" ry="' + (ry * S).toFixed(1) + '" fill="url(#v-skugga)" opacity="' + (a || 1) + '"/>';
    }
    // Stående cylinder (bord, koppar, stubbar).
    function cyl(x, y, z, r, h, f) {
      var b = P(x, y, z), t = P(x, y, z + h), rx = r * S * 1.05, ry = r * S * 0.6;
      return '<path d="M' + (b[0] - rx).toFixed(1) + ' ' + b[1].toFixed(1) + 'A' + rx.toFixed(1) + ' ' + ry.toFixed(1) +
        ' 0 0 0 ' + (b[0] + rx).toFixed(1) + ' ' + b[1].toFixed(1) + 'L' + (t[0] + rx).toFixed(1) + ' ' + t[1].toFixed(1) +
        'L' + (t[0] - rx).toFixed(1) + ' ' + t[1].toFixed(1) + 'Z" fill="' + f.x + '"/>' +
        '<ellipse cx="' + t[0].toFixed(1) + '" cy="' + t[1].toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" fill="' + f.t + '"/>';
    }
    function gran(x, y, h) {
      var bas = P(x, y, 0), topp = P(x, y, h), mitt = P(x, y, h * 0.28), b = S * 0.62 * (h / 3);
      return skugga(x + 0.3, y + 0.3, 0.9 * h / 3, 0.45 * h / 3, 0.8) +
        poly([[bas[0] - 2.4, bas[1]], [bas[0] + 2.4, bas[1]], [mitt[0] + 2.4, mitt[1]], [mitt[0] - 2.4, mitt[1]]], '#6b4f36') +
        poly([topp, [mitt[0] - b, mitt[1]], [mitt[0], mitt[1] + b * 0.34]], '#6f9a6a') +
        poly([topp, [mitt[0], mitt[1] + b * 0.34], [mitt[0] + b, mitt[1]]], '#436b4f');
    }
    // Hus med sadeltak: väggar mot +x och +y syns, taknocken går längs x.
    function hus(x0, y0, x1, y1, ze, zr, f, tak, o) {
      o = o || 0.3;
      var ym = (y0 + y1) / 2, h = '';
      h += box(x0, y0, 0, x1 - x0, y1 - y0, ze, f);
      h += poly([P(x1, y0, ze), P(x1, y1, ze), P(x1, ym, zr)], f.x);
      h += poly([P(x0 - o, y0 - o, ze - 0.05), P(x1 + o, y0 - o, ze - 0.05), P(x1 + o, ym, zr), P(x0 - o, ym, zr)], tak.x);
      h += poly([P(x0 - o, ym, zr), P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze - 0.05), P(x0 - o, y1 + o, ze - 0.05)], tak.t);
      h += poly([P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze - 0.05), P(x1 + o, y1 + o, ze - 0.2), P(x1 + o, ym, zr - 0.15)], tak.kant);
      h += poly([P(x1 + o, y0 - o, ze - 0.05), P(x1 + o, ym, zr), P(x1 + o, ym, zr - 0.15), P(x1 + o, y0 - o, ze - 0.2)], tak.kant);
      return h;
    }
    // Fönster i planet y = yv (framsidan) eller x = xv (gaveln).
    function fonsterY(yv, xa, xb, za, zb, fyll) {
      return poly([P(xa, yv, za), P(xb, yv, za), P(xb, yv, zb), P(xa, yv, zb)], fyll, ' stroke="#1b1915" stroke-width="1.6"');
    }
    function fonsterX(xv, ya, yb, za, zb, fyll) {
      return poly([P(xv, ya, za), P(xv, yb, za), P(xv, yb, zb), P(xv, ya, zb)], fyll, ' stroke="#1b1915" stroke-width="1.6"');
    }

    var GRAS = { t: 'url(#v-gras)', x: '#5c7a48', y: '#6f8f58' };
    var JORD = { t: '#a98763', x: '#7a5d41', y: '#8c6c4d' };
    var GOLV = { t: 'url(#v-golv)', x: '#b99a70', y: '#cdb089' };
    var BETONG = { t: '#dcd6cb', x: '#a9a297', y: '#bfb8ad' };
    var VIRKE = { t: '#f3d6a6', x: '#c9975a', y: '#dfb57a' };
    var KOL = { t: '#4a443d', x: '#27231f', y: '#35302a' };
    var FASAD = { t: '#3d3832', x: '#24211d', y: '#302b26' };
    var PAPPER = { t: '#fffdf8', x: '#d8d1c4', y: '#e9e3d7' };
    var TAK = { t: '#3b3631', x: '#2a2622', kant: '#1b1915' };
    var LJUSTAK = { t: '#e9e2d4', x: '#cfc6b5', kant: '#b3a994' };

    var DEFS = '<defs>' +
      '<linearGradient id="v-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9c98e"/><stop offset="1" stop-color="#7ea267"/></linearGradient>' +
      '<linearGradient id="v-golv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6ead6"/><stop offset="1" stop-color="#e6d3b3"/></linearGradient>' +
      '<linearGradient id="v-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f9"/><stop offset="1" stop-color="#b8cde0"/></linearGradient>' +
      '<linearGradient id="v-varm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d9"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>' +
      '<radialGradient id="v-skugga"><stop offset="0" stop-color="#1b1915" stop-opacity=".32"/><stop offset="1" stop-color="#1b1915" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="v-sken"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".65"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="v-sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3d6" stop-opacity=".9"/><stop offset="1" stop-color="#ffd9a0" stop-opacity=".15"/></linearGradient>' +
      '<linearGradient id="v-kon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".75"/><stop offset="1" stop-color="#ffe2b0" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="v-lampa"><stop offset="0" stop-color="#fff1d2" stop-opacity=".95"/><stop offset=".45" stop-color="#ffcf8a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>' +
      '</defs>';

    // Rummets två bakväggar med tjocklek och golvlist.
    function rum() {
      return poly([P(-5.25, -4.25, 0), P(-5.25, 4, 0), P(-5.25, 4, 3.4), P(-5.25, -4.25, 3.4)], '#ece4d7') +
        poly([P(-5.25, -4.25, 0), P(5, -4.25, 0), P(5, -4.25, 3.4), P(-5.25, -4.25, 3.4)], '#dfd6c7') +
        poly([P(-5.25, -4.25, 3.4), P(5, -4.25, 3.4), P(5, -4, 3.4), P(-5, -4, 3.4), P(-5, 4, 3.4), P(-5.25, 4, 3.4)], '#f7f2ea') +
        poly([P(-5.25, 4, 0), P(-5, 4, 0), P(-5, 4, 3.4), P(-5.25, 4, 3.4)], '#c9bca6') +
        poly([P(5, -4.25, 0), P(5, -4, 0), P(5, -4, 3.4), P(5, -4.25, 3.4)], '#bfb19a') +
        lin([P(-5, 4, 0.12), P(-5, -4, 0.12), P(5, -4, 0.12)], '#fffdf8', 2.5);
    }

    function platta(f, tjock) {
      return skugga(0.6, 0.6, 6.4, 3.4, 0.9) + box(-5, -4, -(tjock || 0.45), 10, 8, tjock || 0.45, f);
    }
    // Pratbubbla: en enda kontur med pilen inbyggd (förut en lös pil med
    // en lapp över konturen, som sprack). svans: 'nh'/'nv' = nedåt höger/
    // vänster, 'h'/'v' = åt höger/vänster från mitten av kanten.
    function bubbla(cx, cy, b, h, fyll, text, klass, svans, tagg, taggprick) {
      var x0 = cx - b / 2, y0 = cy - h / 2, x1 = cx + b / 2, y1 = cy + h / 2, r = Math.min(16, h / 2);
      var d = 'M' + (x0 + r) + ' ' + y0 + 'H' + (x1 - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1 + ' ' + (y0 + r);
      var spets;
      if (svans === 'h') { spets = [x1 + 13, cy + 3]; d += 'V' + (cy - 6) + 'L' + spets[0] + ' ' + spets[1] + 'L' + x1 + ' ' + (cy + 7); }
      d += 'V' + (y1 - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x1 - r) + ' ' + y1;
      if (svans === 'nh' || svans === 'nv') {
        var tx = svans === 'nh' ? x1 - r - 14 : x0 + r + 14;
        spets = [tx + (svans === 'nh' ? 5 : -5), y1 + 13];
        d += 'H' + (tx + 7) + 'L' + spets[0] + ' ' + spets[1] + 'L' + (tx - 7) + ' ' + y1;
      }
      d += 'H' + (x0 + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x0 + ' ' + (y1 - r);
      if (svans === 'v') { spets = [x0 - 13, cy + 3]; d += 'V' + (cy + 7) + 'L' + spets[0] + ' ' + spets[1] + 'L' + x0 + ' ' + (cy - 6); }
      d += 'V' + (y0 + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x0 + r) + ' ' + y0 + 'Z';
      var inne = '<path class="v-bubbelform" d="' + d + '" fill="' + fyll + '" stroke="#1b1915" stroke-width="1.6" stroke-linejoin="round"/>' + text;
      if (tagg) {
        var tb = tagg.length * 7 + 26;
        inne += '<g class="v-bubbeltagg"><rect x="' + (x0 + 10) + '" y="' + (y0 - 11) + '" width="' + tb + '" height="20" rx="10" fill="#fffdf8" stroke="#1b1915" stroke-width="1.2"/>' +
          '<circle cx="' + (x0 + 21) + '" cy="' + (y0 - 1) + '" r="3.6" fill="' + (taggprick || '#f0b56e') + '"/>' +
          '<text x="' + (x0 + 29) + '" y="' + (y0 + 3) + '" font-family="Poppins, sans-serif" font-size="11" font-weight="600" fill="#1b1915">' + tagg + '</text></g>';
      }
      return g('v-bubbla ' + klass, inne, 'transform-origin:' + spets[0] + 'px ' + spets[1] + 'px');
    }
    // Etikett som förklarar vad som händer: en prick på saken och ett rakt,
    // kort stift (upp, ner, vänster eller höger) till en liten bricka.
    // Aldrig diagonala linjer genom andra saker. dx flyttar brickan i
    // sidled längs stiftets ände (bara för upp/ner). Göms på mobil (CSS).
    function etikett(tx, ty, text, rikt, d, i, prick, dx) {
      var w = text.length * 6.5 + 32, hh = 22, ex = tx, ey = ty, cx, cy;
      prick = prick || '#f0b56e';
      dx = dx || 0;
      if (rikt === 'upp') { ey = ty - d; cx = tx + dx; cy = ey - hh / 2; }
      else if (rikt === 'ner') { ey = ty + d; cx = tx + dx; cy = ey + hh / 2; }
      else if (rikt === 'vanster') { ex = tx - d; cx = ex - w / 2; cy = ty; }
      else { ex = tx + d; cx = ex + w / 2; cy = ty; }
      var ax = rikt === 'vanster' ? ex : (rikt === 'hoger' ? ex : cx);
      return '<g class="v-etikett" data-rikt="' + rikt + '" data-ax="' + ax.toFixed(1) + '" style="--i:' + i + '">' +
        '<line x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="#1b1915" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>' +
        '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="4.4" fill="' + prick + '" stroke="#fffdf8" stroke-width="2.2"/>' +
        '<rect class="v-etikettruta" x="' + (cx - w / 2).toFixed(1) + '" y="' + (cy - hh / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh + '" rx="11" fill="#fffdf8" stroke="rgba(27,25,21,.14)" stroke-width="1"/>' +
        '<circle cx="' + (cx - w / 2 + 12).toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.6" fill="' + prick + '"/>' +
        '<text x="' + (cx - w / 2 + 21).toFixed(1) + '" y="' + (cy + 3.8).toFixed(1) + '" font-family="Poppins, sans-serif" font-size="11" font-weight="600" fill="#1b1915">' + text + '</text></g>';
    }
    // Krukväxt med breda blad som vajar.
    function vaxt(x, y, hojd) {
      hojd = hojd || 1;
      var h = skugga(x, y, 0.55, 0.28, 0.8) + cyl(x, y, 0, 0.42, 0.62, { x: '#c9975a', t: '#6b4f36' });
      var t = P(x, y, 0.62), blad = '';
      [[-58, 34, '#5f8a5c'], [-28, 44, '#6f9a6a'], [0, 50, '#436b4f'], [26, 42, '#6f9a6a'], [54, 32, '#5a8660'], [-8, 30, '#86ad78']].forEach(function (b) {
        var v = b[0] * Math.PI / 180, l = b[1] * hojd, sx = t[0] + Math.sin(v) * l, sy = t[1] - Math.cos(v) * l;
        var nx = Math.cos(v) * 9, ny = Math.sin(v) * 9;
        blad += '<path d="M' + t[0].toFixed(1) + ' ' + t[1].toFixed(1) + 'Q' + ((t[0] + sx) / 2 + nx).toFixed(1) + ' ' + ((t[1] + sy) / 2 + ny).toFixed(1) + ' ' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
          'Q' + ((t[0] + sx) / 2 - nx).toFixed(1) + ' ' + ((t[1] + sy) / 2 - ny).toFixed(1) + ' ' + t[0].toFixed(1) + ' ' + t[1].toFixed(1) + 'z" fill="' + b[2] + '"/>';
      });
      return h + '<g class="v-vaxt" style="transform-origin:' + t[0].toFixed(1) + 'px ' + t[1].toFixed(1) + 'px">' + blad + '</g>';
    }
    function pk(x, y, z) { return P(x, y, z || 0); }
    function hull(pts) {
      var s = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      function kors(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
      var ned = [], upp = [];
      s.forEach(function (q) { while (ned.length > 1 && kors(ned[ned.length - 2], ned[ned.length - 1], q) <= 0) ned.pop(); ned.push(q); });
      s.slice().reverse().forEach(function (q) { while (upp.length > 1 && kors(upp[upp.length - 2], upp[upp.length - 1], q) <= 0) upp.pop(); upp.push(q); });
      return ned.slice(0, -1).concat(upp.slice(0, -1));
    }

    var TRASTOL = { t: '#e2b47a', x: '#a8743f', y: '#c08a50' };
    var DYNA = { t: '#4a443d', x: '#27231f', y: '#35302a' };
    // Stol: fyra ben, sits och ryggstöd. Ryggen åt 'x' (mot -x) eller 'y' (mot +y).
    function stol(x, y, rygg, mellan) {
      var h = '';
      [[0.05, 0.05], [0.72, 0.05], [0.05, 0.72], [0.72, 0.72]].forEach(function (b) { h += box(x + b[0], y + b[1], 0, 0.1, 0.1, 0.48, TRASTOL); });
      if (rygg === 'x') h += box(x, y, 0.48, 0.12, 0.85, 0.9, TRASTOL);
      h += box(x, y, 0.48, 0.85, 0.85, 0.1, TRASTOL) + box(x + 0.08, y + 0.08, 0.58, 0.7, 0.7, 0.08, DYNA);
      h += mellan || '';
      if (rygg === 'y') h += box(x, y + 0.73, 0.48, 0.85, 0.12, 0.9, TRASTOL);
      return h;
    }
    // En sittande person på en stol vid (x, y). 'x': ryggen mot -x, ser mot +x.
    // 'y': ryggen mot +y, ser mot -y.
    var BYXA = { t: '#4a443d', x: '#27231f', y: '#35302a' };
    function sitter(x, y, rygg, troja, har) {
      var h = '', k;
      if (rygg === 'x') {
        h += box(x + 0.92, y + 0.24, 0, 0.16, 0.36, 0.64, BYXA) + box(x + 0.46, y + 0.22, 0.62, 0.6, 0.4, 0.14, BYXA);
        h += box(x + 0.14, y + 0.2, 0.66, 0.36, 0.46, 0.72, troja);
        k = P(x + 0.32, y + 0.43, 1.66);
      } else {
        h += box(x + 0.24, y - 0.28, 0, 0.36, 0.16, 0.64, BYXA) + box(x + 0.22, y - 0.12, 0.62, 0.4, 0.6, 0.14, BYXA);
        h += box(x + 0.2, y + 0.36, 0.66, 0.46, 0.36, 0.72, troja);
        k = P(x + 0.43, y + 0.54, 1.66);
      }
      h += '<circle cx="' + k[0].toFixed(1) + '" cy="' + k[1].toFixed(1) + '" r="7.4" fill="#e8c19a" stroke="#1b1915" stroke-width="1"/>';
      h += '<path d="M' + (k[0] - 7.4).toFixed(1) + ' ' + (k[1] - 1).toFixed(1) + 'a7.4 7.4 0 0 1 14.8 0c-3-2.4-11.6-2.4-14.8 0z" fill="' + (har || '#4a3424') + '"/>';
      return '<g class="v-sitter">' + h + '</g>';
    }
    // En person: skor, ben, kropp, armar, hals och huvud, med hjälm om
    // färg ges. handV/handH är punkter [x, y, z] som vänster/höger hand
    // når mot (annars hänger armen längs kroppen).
    function arm(fran, till, farg) {
      var a = P(fran[0], fran[1], fran[2]), b = P(till[0], till[1], till[2]);
      var l = ' x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"';
      return '<line' + l + ' stroke="#1b1915" stroke-width="6.2" stroke-linecap="round"/><line' + l + ' stroke="' + farg + '" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="2.6" fill="#e8c19a" stroke="#1b1915" stroke-width=".9"/>';
    }
    function person(x, y, troja, hjalm, klass, handV, handH) {
      var BYX = { t: '#3b3631', x: '#1b1915', y: '#2a2622' }, SKO = { t: '#4a443d', x: '#141210', y: '#1b1915' };
      var h = skugga(x + 0.25, y + 0.2, 0.45, 0.22, 0.9);
      var vS = [x + 0.02, y + 0.09, 1.5], hS = [x + 0.42, y + 0.09, 1.5];
      h += arm(vS, handV || [x - 0.04, y + 0.12, 0.95], troja.x);
      h += box(x, y, 0, 0.17, 0.3, 0.08, SKO) + box(x + 0.25, y, 0, 0.17, 0.3, 0.08, SKO);
      h += box(x, y, 0.08, 0.17, 0.17, 0.74, BYX) + box(x + 0.25, y, 0.08, 0.17, 0.17, 0.74, BYX);
      h += box(x - 0.05, y - 0.06, 0.82, 0.52, 0.3, 0.74, troja);
      h += box(x + 0.15, y + 0.04, 1.56, 0.12, 0.12, 0.1, { t: '#e8c19a', x: '#c99a70', y: '#d8ab82' });
      if (!handH) h += arm(hS, [x + 0.48, y + 0.12, 0.95], troja.x);
      var k = P(x + 0.21, y + 0.1, 1.9);
      h += '<circle cx="' + k[0].toFixed(1) + '" cy="' + k[1].toFixed(1) + '" r="7.4" fill="#e8c19a" stroke="#1b1915" stroke-width="1"/>';
      if (hjalm) h += '<path d="M' + (k[0] - 8.2).toFixed(1) + ' ' + (k[1] - 0.5).toFixed(1) + 'a8.2 8.2 0 0 1 16.4 0z" fill="' + hjalm + '" stroke="#1b1915" stroke-width="1"/><path d="M' + (k[0] - 9.6).toFixed(1) + ' ' + (k[1] - 0.5).toFixed(1) + 'h19.2" stroke="#1b1915" stroke-width="1.6" stroke-linecap="round"/>';
      else h += '<path d="M' + (k[0] - 7.4).toFixed(1) + ' ' + (k[1] - 1).toFixed(1) + 'a7.4 7.4 0 0 1 14.8 0c-3-2.4-11.6-2.4-14.8 0z" fill="#4a3424"/>';
      if (handH) h += arm(hS, handH, troja.x);
      return '<g class="v-person ' + (klass || '') + '">' + h + '</g>';
    }
    // Lastbilshytt med fronten mot +x: kaross, vindruta, sidoruta, dörr,
    // grill, lampor, stötfångare, backspegel och takljus.
    function hytt(x, y, l, b, hz, z0, farg) {
      farg = farg || { t: '#f7f2ea', x: '#cfc6b5', y: '#e9e2d6' };
      var x1 = x + l, y1 = y + b, h = box(x, y, z0, l, b, hz, farg);
      h += box(x + 0.05, y + 0.05, z0 + hz, l - 0.1, b - 0.1, 0.05, { t: '#e9e2d6', x: '#bfb6a5', y: '#d6cdbd' });
      h += poly([P(x1, y + 0.1, z0 + hz * 0.55), P(x1, y1 - 0.1, z0 + hz * 0.55), P(x1, y1 - 0.1, z0 + hz * 0.92), P(x1, y + 0.1, z0 + hz * 0.92)], 'url(#v-glas)', ' stroke="#1b1915" stroke-width="1.2"');
      h += poly([P(x + 0.12, y1, z0 + hz * 0.52), P(x1 - 0.18, y1, z0 + hz * 0.52), P(x1 - 0.18, y1, z0 + hz * 0.9), P(x + 0.12, y1, z0 + hz * 0.9)], 'url(#v-glas)', ' stroke="#1b1915" stroke-width="1.1"');
      h += lin([P(x + 0.08, y1 + 0.002, z0 + 0.08), P(x + 0.08, y1 + 0.002, z0 + hz * 0.9)], 'rgba(27,25,21,.35)', 1);
      h += lin([P(x1 - 0.32, y1 + 0.002, z0 + hz * 0.42), P(x1 - 0.2, y1 + 0.002, z0 + hz * 0.42)], '#1b1915', 1.6);
      h += poly([P(x1 + 0.002, y + 0.28, z0 + 0.12), P(x1 + 0.002, y1 - 0.28, z0 + 0.12), P(x1 + 0.002, y1 - 0.28, z0 + hz * 0.42), P(x1 + 0.002, y + 0.28, z0 + hz * 0.42)], '#3a352d');
      for (var gz = z0 + 0.18; gz < z0 + hz * 0.4; gz += 0.07) h += lin([P(x1 + 0.003, y + 0.3, gz), P(x1 + 0.003, y1 - 0.3, gz)], 'rgba(255,255,255,.18)', 1);
      [[y + 0.06, y + 0.22], [y1 - 0.22, y1 - 0.06]].forEach(function (q) {
        h += poly([P(x1 + 0.003, q[0], z0 + hz * 0.22), P(x1 + 0.003, q[1], z0 + hz * 0.22), P(x1 + 0.003, q[1], z0 + hz * 0.36), P(x1 + 0.003, q[0], z0 + hz * 0.36)], '#fff1d2', ' stroke="#1b1915" stroke-width=".8"');
      });
      h += box(x1, y - 0.03, z0 - 0.1, 0.1, b + 0.06, 0.16, { t: '#4a443d', x: '#1b1915', y: '#2a2622' });
      h += lin([P(x1 - 0.06, y1, z0 + hz * 0.82), P(x1 - 0.06, y1 + 0.2, z0 + hz * 0.82)], '#1b1915', 1.6);
      h += box(x1 - 0.1, y1 + 0.18, z0 + hz * 0.62, 0.06, 0.08, 0.28, { t: '#3a352d', x: '#1b1915', y: '#2a2622' });
      h += box(x + l * 0.3, y + b * 0.3, z0 + hz + 0.05, l * 0.35, b * 0.4, 0.07, { t: '#f6a04d', x: '#c5662a', y: '#dc7834' });
      return h;
    }

    function golvlampa(x, y) {
      var a = P(x, y, 0), b = P(x, y, 2.5), sk = P(x, y, 2.55);
      return skugga(x, y, 0.5, 0.25, 0.8) +
        cyl(x, y, 0, 0.32, 0.06, { x: '#27231f', t: '#4a443d' }) +
        '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#27231f" stroke-width="2.4"/>' +
        '<ellipse class="v-lampsken" cx="' + sk[0].toFixed(1) + '" cy="' + (sk[1] + 6).toFixed(1) + '" rx="46" ry="34" fill="url(#v-lampa)"/>' +
        '<path d="M' + (sk[0] - 12).toFixed(1) + ' ' + (sk[1] + 6).toFixed(1) + 'L' + (sk[0] - 7).toFixed(1) + ' ' + (sk[1] - 10).toFixed(1) + 'H' + (sk[0] + 7).toFixed(1) + 'L' + (sk[0] + 12).toFixed(1) + ' ' + (sk[1] + 6).toFixed(1) + 'z" fill="#f3d6a6" stroke="#1b1915" stroke-width="1.4" stroke-linejoin="round"/>';
    }
    function lovtrad(x, y, h) {
      var bas = P(x, y, 0), topp = P(x, y, h);
      return skugga(x + 0.3, y + 0.3, 1.0, 0.5, 0.8) +
        '<line x1="' + bas[0].toFixed(1) + '" y1="' + bas[1].toFixed(1) + '" x2="' + topp[0].toFixed(1) + '" y2="' + (topp[1] + 12).toFixed(1) + '" stroke="#6b4f36" stroke-width="4" stroke-linecap="round"/>' +
        '<g class="v-krona" style="transform-origin:' + topp[0].toFixed(1) + 'px ' + (topp[1] + 14).toFixed(1) + 'px">' +
        '<circle cx="' + (topp[0] - 9).toFixed(1) + '" cy="' + (topp[1] + 4).toFixed(1) + '" r="15" fill="#6f9a6a"/>' +
        '<circle cx="' + (topp[0] + 9).toFixed(1) + '" cy="' + (topp[1] + 2).toFixed(1) + '" r="14" fill="#5a8660"/>' +
        '<circle cx="' + topp[0].toFixed(1) + '" cy="' + (topp[1] - 8).toFixed(1) + '" r="15" fill="#86ad78"/></g>';
    }
    function buske(x, y) {
      var c = P(x, y, 0.35);
      return skugga(x, y, 0.6, 0.3, 0.7) +
        '<circle cx="' + (c[0] - 6).toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="9" fill="#5a8660"/>' +
        '<circle cx="' + (c[0] + 6).toFixed(1) + '" cy="' + (c[1] + 1).toFixed(1) + '" r="8" fill="#436b4f"/>' +
        '<circle cx="' + c[0].toFixed(1) + '" cy="' + (c[1] - 6).toFixed(1) + '" r="8" fill="#6f9a6a"/>';
    }
    function kon(x, y) {
      var b = P(x, y, 0), t = P(x, y, 0.75);
      return '<path d="M' + (b[0] - 10).toFixed(1) + ' ' + b[1].toFixed(1) + 'L' + t[0].toFixed(1) + ' ' + t[1].toFixed(1) + 'L' + (b[0] + 10).toFixed(1) + ' ' + b[1].toFixed(1) + 'z" fill="#f08a3c" stroke="#1b1915" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M' + (b[0] - 6.5).toFixed(1) + ' ' + (b[1] - 7).toFixed(1) + 'H' + (b[0] + 6.5).toFixed(1) + '" stroke="#fffdf8" stroke-width="3"/>' +
        '<rect x="' + (b[0] - 13).toFixed(1) + '" y="' + (b[1] - 2).toFixed(1) + '" width="26" height="4" rx="2" fill="#1b1915"/>';
    }
    function glitter(cx, cy, r, i) {
      return '<path class="v-glitter" style="--i:' + i + ';transform-origin:' + cx + 'px ' + cy + 'px" d="M' + cx + ' ' + (cy - r) +
        'Q' + cx + ' ' + cy + ' ' + (cx + r) + ' ' + cy + 'Q' + cx + ' ' + cy + ' ' + cx + ' ' + (cy + r) +
        'Q' + cx + ' ' + cy + ' ' + (cx - r) + ' ' + cy + 'Q' + cx + ' ' + cy + ' ' + cx + ' ' + (cy - r) + 'z" fill="#f0b56e"/>';
    }

    // Hjul i planet y = yv (syns från +y) eller x = xv (syns från +x).
    function hjulY(xc, yv, zc, r) {
      var a = [], b = [];
      for (var t = 0; t < 20; t++) {
        var v = t / 20 * Math.PI * 2;
        a.push(P(xc + Math.cos(v) * r, yv, zc + Math.sin(v) * r));
        b.push(P(xc + Math.cos(v) * r * 0.5, yv + 0.01, zc + Math.sin(v) * r * 0.5));
      }
      return poly(a, '#151311') + poly(b, '#c4c8cc', ' stroke="#5f646a" stroke-width=".8"');
    }
    function hjulX(xv, yc, zc, r) {
      var a = [], b = [];
      for (var t = 0; t < 20; t++) {
        var v = t / 20 * Math.PI * 2;
        a.push(P(xv, yc + Math.cos(v) * r, zc + Math.sin(v) * r));
        b.push(P(xv + 0.01, yc + Math.cos(v) * r * 0.5, zc + Math.sin(v) * r * 0.5));
      }
      return poly(a, '#151311') + poly(b, '#c4c8cc', ' stroke="#5f646a" stroke-width=".8"');
    }
    // Fackverk på en yta: sicksack mellan två kanter.
    function fackY(x0, x1, yv, z0, z1, steg, farg) {
      var pts = [], upp = true;
      for (var x = x0; x <= x1 + 0.001; x += steg) { pts.push(P(x, yv, upp ? z1 : z0)); upp = !upp; }
      return lin(pts, farg, 1.2);
    }
    function fackZ(xv, yv, z0, z1, steg, farg, axel) {
      var pts = [], sida = true;
      for (var z = z0; z <= z1 + 0.001; z += steg) {
        pts.push(axel === 'x' ? P(xv + (sida ? 0.5 : 0), yv, z) : P(xv, yv + (sida ? 0.5 : 0), z));
        sida = !sida;
      }
      return lin(pts, farg, 1.1);
    }
    var ORANGE = { t: '#f6a04d', x: '#c5662a', y: '#dc7834' };
    var GRA = { t: '#e8e3da', x: '#bdb5a8', y: '#d2cabd' };

    /* 1 Första samtalet: ett ljust rum, bord med ritning och kaffe. */
    function samtal() {
      var h = DEFS + platta(GOLV);
      for (var i = -4; i < 4; i += 1.1) h += lin([P(-5, i, 0.01), P(5, i, 0.01)], 'rgba(143,84,36,.12)', 1);
      h += rum();
      h += fonsterY(-4, 0.4, 3.8, 1.2, 2.9, 'url(#v-glas)');
      h += lin([P(2.1, -4, 1.2), P(2.1, -4, 2.9)], '#1b1915', 1.6);
      // Solljuset från fönstret på golvet.
      h += poly([P(0.4, -3.95, 0.02), P(3.8, -3.95, 0.02), P(4.8, -1.1, 0.02), P(1.4, -1.1, 0.02)], 'url(#v-sol)', ' class="v-solljus"');
      // Tavla med en husritning på vänstra väggen.
      h += poly([P(-5, -2.8, 1.5), P(-5, -0.4, 1.5), P(-5, -0.4, 2.9), P(-5, -2.8, 2.9)], '#fffdf8', ' stroke="#1b1915" stroke-width="1.6"');
      h += lin([P(-5, -2.3, 1.8), P(-5, -2.3, 2.3), P(-5, -1.6, 2.7), P(-5, -0.9, 2.3), P(-5, -0.9, 1.8), P(-5, -2.3, 1.8)], '#8f5424', 1.6);
      // Hylla med böcker under tavlan.
      h += box(-5, -2.9, 0.9, 0.35, 2.6, 0.08, VIRKE);
      ['#8f5424', '#1b1915', '#6f9a6a', '#f0b56e', '#8fb0cf'].forEach(function (f, k) {
        h += box(-4.95, -2.7 + k * 0.42, 0.98, 0.26, 0.3, 0.42 - (k % 2) * 0.08, { t: f, x: f, y: f }, ' opacity=".95"');
      });
      // Mattan under bordet.
      var m = P(0.35, 0.55, 0.01);
      h += '<ellipse cx="' + m[0].toFixed(1) + '" cy="' + m[1].toFixed(1) + '" rx="' + (3.3 * S).toFixed(1) + '" ry="' + (1.75 * S).toFixed(1) + '" fill="#efe2cb" stroke="#d6c2a0" stroke-width="1.4"/>';
      h += '<ellipse cx="' + m[0].toFixed(1) + '" cy="' + m[1].toFixed(1) + '" rx="' + (2.8 * S).toFixed(1) + '" ry="' + (1.45 * S).toFixed(1) + '" fill="none" stroke="#d6c2a0" stroke-width="1" stroke-dasharray="4 5"/>';
      // Stolen bakom bordet (ryggen mot väggen).
      h += stol(-2.6, 0.0, 'x', sitter(-2.6, 0.0, 'x', { t: '#8fb0cf', x: '#6f90af', y: '#7fa0bf' }, '#6b4f36'));
      // Bordet.
      h += skugga(0.9, 0.9, 2.2, 1.1);
      h += cyl(0.25, 0.35, 0, 0.75, 0.08, { x: '#27231f', t: '#3a352d' });
      h += box(0.1, 0.2, 0.08, 0.3, 0.3, 1.32, KOL);
      h += cyl(0.25, 0.35, 1.4, 1.9, 0.14, { x: '#c9975a', t: '#f3d6a6' });
      // På bordet: ritning, laptop, två koppar.
      h += poly([P(-0.9, -0.4, 1.56), P(0.9, -0.6, 1.56), P(1.2, 0.8, 1.56), P(-0.6, 1.0, 1.56)], '#fffdf8', ' stroke="#c9b391" stroke-width="1"');
      h += lin([P(-0.4, -0.1, 1.57), P(0.6, -0.2, 1.57), P(0.8, 0.5, 1.57), P(-0.2, 0.6, 1.57), P(-0.4, -0.1, 1.57)], '#8f5424', 1.3, ' pathLength="1" class="v-rita"');
      h += box(0.6, 0.8, 1.54, 1.0, 0.7, 0.06, { t: '#b9b3a8', x: '#6f6a62', y: '#8a847a' });
      h += poly([P(0.6, 0.8, 1.6), P(1.6, 0.8, 1.6), P(1.6, 0.8, 2.3), P(0.6, 0.8, 2.3)], '#2a2622');
      h += poly([P(0.7, 0.8, 1.68), P(1.5, 0.8, 1.68), P(1.5, 0.8, 2.22), P(0.7, 0.8, 2.22)], 'url(#v-glas)', ' class="v-skarm"');
      h += cyl(-0.9, 1.0, 1.54, 0.16, 0.26, { x: '#f7f2ea', t: '#6b4f36' });
      h += cyl(0.2, -0.9, 1.54, 0.16, 0.26, { x: '#f0b56e', t: '#6b4f36' });
      var a = P(-0.9, 1.0, 1.95), b = P(0.2, -0.9, 1.95);
      h += '<path class="v-anga" d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'c-4-6 4-10 0-16s4-10 0-14" pathLength="1"/>';
      h += '<path class="v-anga v-anga--2" d="M' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + 'c-4-6 4-10 0-16s4-10 0-14" pathLength="1"/>';
      // Stolen framför bordet (ryggen mot oss).
      h += stol(2.0, 2.2, 'y', sitter(2.0, 2.2, 'y', { t: '#3a352d', x: '#1b1915', y: '#2a2622' }, '#c9975a'));
      // Golvlampan i främre hörnet.
      h += golvlampa(-4.3, 3.3);
      // Pratbubblorna vid personerna: du (blå tröja) berättar, vi svarar.
      h += bubbla(312, 128, 100, 40, '#fffdf8',
        '<circle class="v-prick" cx="290" cy="128" r="4" fill="#1b1915"/><circle class="v-prick v-prick--2" cx="312" cy="128" r="4" fill="#1b1915"/><circle class="v-prick v-prick--3" cx="334" cy="128" r="4" fill="#1b1915"/>',
        'v-bubbla--1', 'nv', 'Du', '#8fb0cf');
      h += bubbla(432, 252, 140, 44, '#f3d6a6',
        '<rect class="v-skriv" x="380" y="242" width="96" height="6" rx="3" fill="#8f5424"/><rect class="v-skriv v-skriv--2" x="380" y="256" width="62" height="6" rx="3" fill="#8f5424" opacity=".55"/>',
        'v-bubbla--2', 'v', 'Vi', '#1b1915');
      return h;
    }

    /* 2 Modell och anpassning: ritbord, husmodell, kulörprover. */
    function modell() {
      var h = DEFS + platta(GOLV) + rum();
      // Hylla med pärmar på bakväggen.
      h += box(-3.8, -4, 2.2, 3.4, 0.5, 0.12, VIRKE);
      ['#8f5424', '#1b1915', '#6f9a6a', '#b8cde0', '#f0b56e'].forEach(function (f, i) {
        h += box(-3.6 + i * 0.55, -3.95, 2.32, 0.4, 0.4, 0.75 - (i % 2) * 0.12, { t: f, x: f, y: f }, ' opacity=".92"');
      });
      // Ritbordet.
      h += skugga(0.8, 0.8, 3.4, 1.7);
      [[-2.6, -1.6], [2.6, -1.6], [2.6, 1.8], [-2.6, 1.8]].forEach(function (k) { h += box(k[0], k[1], 0, 0.22, 0.22, 1.5, KOL); });
      h += box(-2.9, -1.9, 1.5, 5.8, 4.0, 0.16, VIRKE);
      // Ritningen med planen som ritas.
      h += poly([P(-2.5, -1.5, 1.67), P(2.3, -1.5, 1.67), P(2.3, 1.7, 1.67), P(-2.5, 1.7, 1.67)], '#f7fbff', ' stroke="#b8cde0" stroke-width="1"');
      for (var gx = -2.1; gx < 2.3; gx += 0.4) h += lin([P(gx, -1.5, 1.671), P(gx, 1.7, 1.671)], 'rgba(143,176,207,.35)', 0.6);
      h += lin([P(-2.1, -1.1, 1.68), P(0.9, -1.1, 1.68), P(0.9, 1.3, 1.68), P(-2.1, 1.3, 1.68), P(-2.1, -1.1, 1.68)], '#2f4f6f', 1.8, ' pathLength="1" class="v-rita"');
      h += lin([P(-0.6, -1.1, 1.68), P(-0.6, 0.4, 1.68), P(0.9, 0.4, 1.68)], '#2f4f6f', 1.4, ' pathLength="1" class="v-rita v-rita--2"');
      h += lin([P(-2.1, 1.6, 1.68), P(0.9, 1.6, 1.68)], '#8f5424', 1.2, ' pathLength="1" class="v-rita v-rita--3"');
      // Husmodellen, taket lyfts för att visa planen.
      h += skugga(1.9, 0.2, 0.9, 0.45);
      h += box(1.2, -0.7, 1.67, 1.5, 1.0, 0.55, VIRKE);
      h += fonsterY(0.3, 1.5, 2.0, 1.85, 2.08, 'url(#v-glas)');
      h += g('v-modelltak', poly([P(1.1, -0.8, 2.2), P(2.8, -0.8, 2.2), P(2.8, -0.2, 2.6), P(1.1, -0.2, 2.6)], '#2a2622') +
        poly([P(1.1, -0.2, 2.6), P(2.8, -0.2, 2.6), P(2.8, 0.4, 2.2), P(1.1, 0.4, 2.2)], '#3b3631') +
        poly([P(2.7, -0.7, 2.22), P(2.7, 0.3, 2.22), P(2.7, -0.2, 2.56)], '#dfb57a'));
      // Måttband som dras ut längs bordskanten.
      var m0 = P(-2.5, 2.0, 1.66), m1 = P(2.3, 2.0, 1.66);
      h += g('v-matt', '<line x1="' + m0[0].toFixed(1) + '" y1="' + m0[1].toFixed(1) + '" x2="' + m1[0].toFixed(1) + '" y2="' + m1[1].toFixed(1) +
        '" stroke="#f0b56e" stroke-width="5" stroke-linecap="round"/>', 'transform-origin:' + m0[0].toFixed(1) + 'px ' + m0[1].toFixed(1) + 'px');
      h += box(-2.95, 1.75, 1.5, 0.5, 0.5, 0.35, { t: '#f0b56e', x: '#8f5424', y: '#c9975a' });
      // Kulörproverna som fläktas ut.
      var kulor = ['#24211d', '#c9975a', '#e9e2d4', '#6f8f58'];
      var fot = P(4.6, 1.6, 0), mp = P(4.6, 1.6, 0.9), mitt = [Math.round(mp[0]), Math.round(mp[1])];
      h += skugga(4.6, 1.6, 0.4, 0.2, 0.8) + '<path d="M' + fot[0].toFixed(1) + ' ' + fot[1].toFixed(1) + 'V' + mp[1].toFixed(1) + 'M' + (fot[0] - 9).toFixed(1) + ' ' + (fot[1] + 2).toFixed(1) + 'L' + fot[0].toFixed(1) + ' ' + (fot[1] - 4).toFixed(1) + 'L' + (fot[0] + 9).toFixed(1) + ' ' + (fot[1] + 2).toFixed(1) + '" fill="none" stroke="#1b1915" stroke-width="2.2" stroke-linecap="round"/>';
      h += g('v-flakt', kulor.map(function (f, i) {
        return '<g class="v-prov" style="--i:' + i + ';--v:' + ((i - 1.5) * 16) + 'deg;transform-origin:' + mitt[0] + 'px ' + mitt[1] + 'px;transform:rotate(var(--v))">' +
          '<rect x="' + (mitt[0] - 9) + '" y="' + (mitt[1] - 64) + '" width="18" height="66" rx="4" fill="' + f + '" stroke="#1b1915" stroke-width="1.4"/></g>';
      }).join('') + '<circle cx="' + mitt[0] + '" cy="' + (mitt[1] - 4) + '" r="3.5" fill="#1b1915"/>');
      // Skrivbordslampa på ritbordet, en stol och en växt.
      var lb = P(-2.4, -1.5, 1.66), lt = P(-2.4, -1.5, 2.9);
      h += '<ellipse class="v-lampsken" cx="' + (lt[0] + 18).toFixed(1) + '" cy="' + (lt[1] + 30).toFixed(1) + '" rx="54" ry="30" fill="url(#v-lampa)"/>';
      h += '<path d="M' + lb[0].toFixed(1) + ' ' + lb[1].toFixed(1) + 'L' + (lb[0] - 6).toFixed(1) + ' ' + (lt[1] + 6).toFixed(1) + 'L' + (lt[0] + 14).toFixed(1) + ' ' + (lt[1] - 2).toFixed(1) + '" fill="none" stroke="#1b1915" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
      h += '<path d="M' + (lt[0] + 8).toFixed(1) + ' ' + (lt[1] - 8).toFixed(1) + 'l16 4-4 12-16-4z" fill="#f0b56e" stroke="#1b1915" stroke-width="1.4" stroke-linejoin="round"/>';
      h += '<ellipse cx="' + lb[0].toFixed(1) + '" cy="' + lb[1].toFixed(1) + '" rx="8" ry="4" fill="#1b1915"/>';
      h += stol(0.0, 2.55, 'y', sitter(0.0, 2.55, 'y', { t: '#f0b56e', x: '#c9975a', y: '#dfb57a' }, '#1b1915'));
      h += vaxt(-4.2, 3.0, 1.1);
      var pl = P(-1.9, 0.9, 1.68);
      h += etikett(pl[0], pl[1], 'Planlösning', 'upp', 38, 0, null, -30) + etikett(372, 262, 'Kulörer', 'hoger', 40, 1);
      return h;
    }

    /* 3 Bygglov eller anmälan: underlaget stämplas och skickas in. */
    function lov() {
      var h = DEFS + platta(BETONG, 0.4);
      // Torgets plattor.
      for (var i = -5; i <= 5; i += 1) h += lin([P(i, -4, 0.01), P(i, 4, 0.01)], 'rgba(27,25,21,.06)', 1);
      for (var j = -4; j <= 4; j += 1) h += lin([P(-5, j, 0.01), P(5, j, 0.01)], 'rgba(27,25,21,.06)', 1);
      // Gräsremsa bakom kommunhuset.
      h += poly([P(-5, -4, 0.01), P(0.6, -4, 0.01), P(0.6, -3.95, 0.01), P(-5, -3.95, 0.01)], '#7ea267');
      // Kommunhuset: sockel, trappa, kropp, kolonner, gavelfält och tak.
      h += skugga(-2.2, -2.0, 2.8, 1.4);
      h += box(-4.4, -3.8, 0, 3.6, 2.7, 0.3, GRA);
      h += box(-3.4, -1.1, 0, 1.6, 0.5, 0.2, GRA) + box(-3.3, -1.1, 0.2, 1.4, 0.25, 0.1, GRA);
      h += box(-4.2, -3.6, 0.3, 3.2, 2.2, 2.4, { t: '#efe8dc', x: '#cfc6b5', y: '#e2d9ca' });
      // Fönster på framsidan och gaveln, dörren i mitten.
      h += fonsterY(-1.4, -3.95, -3.45, 1.0, 1.9, 'url(#v-glas)') + fonsterY(-1.4, -1.75, -1.25, 1.0, 1.9, 'url(#v-glas)');
      h += poly([P(-2.85, -1.4, 0.3), P(-2.35, -1.4, 0.3), P(-2.35, -1.4, 1.7), P(-2.85, -1.4, 1.7)], '#6b4f36', ' stroke="#1b1915" stroke-width="1.4"');
      h += fonsterX(-1.0, -3.3, -2.7, 1.1, 2.0, 'url(#v-glas)') + fonsterX(-1.0, -2.4, -1.8, 1.1, 2.0, 'url(#v-glas)');
      for (var c = 0; c < 4; c++) h += box(-4.0 + c * 0.9, -1.35, 0.3, 0.22, 0.22, 2.4, { t: '#fffdf8', x: '#d8d1c4', y: '#ece6da' });
      h += box(-4.4, -3.8, 2.7, 3.6, 2.7, 0.18, { t: '#cfc6b5', x: '#a9a297', y: '#bfb8ad' });
      h += poly([P(-4.4, -1.1, 2.88), P(-0.8, -1.1, 2.88), P(-2.6, -1.1, 3.7)], '#efe8dc', ' stroke="#b3a994" stroke-width="1.2"');
      var ur = P(-2.6, -1.1, 3.22);
      h += '<circle cx="' + ur[0].toFixed(1) + '" cy="' + ur[1].toFixed(1) + '" r="7" fill="#fffdf8" stroke="#8f5424" stroke-width="1.4"/>' +
        '<path d="M' + ur[0].toFixed(1) + ' ' + ur[1].toFixed(1) + 'v-4.5M' + ur[0].toFixed(1) + ' ' + ur[1].toFixed(1) + 'h3.5" stroke="#1b1915" stroke-width="1.2" stroke-linecap="round"/>';
      var fl = P(-2.6, -2.5, 2.9);
      h += '<line x1="' + fl[0].toFixed(1) + '" y1="' + fl[1].toFixed(1) + '" x2="' + fl[0].toFixed(1) + '" y2="' + (fl[1] - 46).toFixed(1) + '" stroke="#1b1915" stroke-width="1.5"/>';
      h += '<path class="v-flagga" d="M' + fl[0].toFixed(1) + ' ' + (fl[1] - 46).toFixed(1) + 'h22l-4 6 4 6h-22z" fill="#f0b56e" style="transform-origin:' + fl[0].toFixed(1) + 'px ' + (fl[1] - 40).toFixed(1) + 'px"/>';
      // Träd, gatlykta och en bänk på torget.
      h += lovtrad(1.4, -3.6, 2.6) + lovtrad(-4.7, 0.9, 2.2);
      h += box(-2.1, 2.6, 0, 0.1, 0.35, 0.32, KOL) + box(-0.75, 2.6, 0, 0.1, 0.35, 0.32, KOL) +
        box(-2.2, 2.55, 0.32, 1.6, 0.45, 0.1, VIRKE) + box(-2.2, 2.9, 0.42, 1.6, 0.1, 0.4, VIRKE);
      var gb = P(4.4, -0.7, 0), gt = P(4.4, -0.7, 3.0);
      h += skugga(4.4, -0.7, 0.4, 0.2, 0.8);
      h += '<line x1="' + gb[0].toFixed(1) + '" y1="' + gb[1].toFixed(1) + '" x2="' + gt[0].toFixed(1) + '" y2="' + gt[1].toFixed(1) + '" stroke="#27231f" stroke-width="2.6"/>';
      h += '<ellipse class="v-lampsken" cx="' + gt[0].toFixed(1) + '" cy="' + (gt[1] + 4).toFixed(1) + '" rx="30" ry="22" fill="url(#v-lampa)"/>';
      h += '<rect x="' + (gt[0] - 6).toFixed(1) + '" y="' + (gt[1] - 6).toFixed(1) + '" width="12" height="10" rx="3" fill="#fff1d2" stroke="#1b1915" stroke-width="1.4"/>';
      // Skrivbordet: ben, skiva, lådhurts, lampa och kaffe.
      h += skugga(1.8, 1.9, 2.4, 1.2);
      [[0.25, 0.65], [3.4, 0.65], [0.25, 2.8], [3.4, 2.8]].forEach(function (k) { h += box(k[0], k[1], 0, 0.14, 0.14, 1.08, KOL); });
      h += box(2.3, 0.75, 0.15, 1.15, 2.0, 0.93, { t: '#efe8dc', x: '#cfc6b5', y: '#e2d9ca' });
      [0.42, 0.75].forEach(function (z) { h += lin([P(3.451, 0.95, z), P(3.451, 2.55, z)], '#a9a297', 1.2); });
      h += box(0.2, 0.6, 1.08, 3.4, 2.4, 0.12, VIRKE);
      [0, 1, 2].forEach(function (k) {
        h += box(0.8 + k * 0.08, 0.9 - k * 0.06, 1.2 + k * 0.06, 1.7, 1.25, 0.05, PAPPER);
      });
      for (var r = 0; r < 4; r++) h += lin([P(1.1, 1.15 + r * 0.24, 1.39), P(2.2 - (r === 3 ? 0.5 : 0), 1.15 + r * 0.24, 1.39)], '#c9b391', 1.4);
      h += cyl(3.0, 2.3, 1.2, 0.17, 0.28, { x: '#fffdf8', t: '#6b4f36' });
      var lb = P(0.6, 2.4, 1.2), lt = P(0.6, 2.4, 2.2);
      h += '<path d="M' + lb[0].toFixed(1) + ' ' + lb[1].toFixed(1) + 'L' + (lb[0] + 5).toFixed(1) + ' ' + (lt[1] + 4).toFixed(1) + 'L' + (lt[0] + 18).toFixed(1) + ' ' + (lt[1] + 2).toFixed(1) + '" fill="none" stroke="#1b1915" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      h += '<path d="M' + (lt[0] + 12).toFixed(1) + ' ' + (lt[1] - 4).toFixed(1) + 'l14 4-3 10-14-4z" fill="#f0b56e" stroke="#1b1915" stroke-width="1.3" stroke-linejoin="round"/>';
      // Stämpeln: slår ner, lämnar sitt märke.
      var mark = P(2.05, 1.5, 1.4);
      h += '<g class="v-stampelmark" style="transform-origin:' + mark[0].toFixed(1) + 'px ' + mark[1].toFixed(1) + 'px">' +
        '<ellipse cx="' + mark[0].toFixed(1) + '" cy="' + mark[1].toFixed(1) + '" rx="22" ry="12" fill="none" stroke="#8f5424" stroke-width="2.4"/>' +
        '<path d="M' + (mark[0] - 8).toFixed(1) + ' ' + mark[1].toFixed(1) + 'l5 4 11-8" fill="none" stroke="#8f5424" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>';
      h += '<ellipse class="v-slag" cx="' + mark[0].toFixed(1) + '" cy="' + mark[1].toFixed(1) + '" rx="26" ry="14" fill="none" stroke="#f0b56e" stroke-width="2" style="transform-origin:' + mark[0].toFixed(1) + 'px ' + mark[1].toFixed(1) + 'px"/>';
      h += g('v-stampel', cyl(2.05, 1.5, 1.9, 0.42, 0.22, { x: '#8f5424', t: '#c9975a' }) +
        cyl(2.05, 1.5, 2.12, 0.14, 0.7, { x: '#27231f', t: '#4a443d' }) +
        cyl(2.05, 1.5, 2.82, 0.3, 0.28, { x: '#27231f', t: '#4a443d' }));
      // Kuvertet som flyger till kommunen.
      h += '<g class="v-kuvert" style="transform:translate(262px,150px) scale(.8)"><rect x="-16" y="-11" width="32" height="22" rx="3" fill="#fffdf8" stroke="#1b1915" stroke-width="1.6"/>' +
        '<path d="M-16 -9l16 11 16-11" fill="none" stroke="#1b1915" stroke-width="1.6" stroke-linejoin="round"/></g>';
      var up = P(1.9, 3.0, 1.2), ko = P(-4.3, -1.1, 2.95);
      h += etikett(up[0], up[1], 'Underlaget', 'ner', 20, 0, null, 30) + etikett(ko[0], ko[1], 'Kommunen', 'vanster', 22, 1);
      return h;
    }

    /* 4 Tillverkning: hallen under tak, väggelement på bänken. */
    function tillverkning() {
      var h = DEFS + platta({ t: '#d9d4ca', x: '#a9a297', y: '#bfb8ad' }, 0.4);
      // Hallens väggar: paneler, fönsterband och en industriport.
      h += poly([P(-5, -4, 0), P(5, -4, 0), P(5, -4, 4.2), P(-5, -4, 4.2)], '#e7e1d6');
      h += poly([P(-5, -4, 0), P(-5, 4, 0), P(-5, 4, 4.2), P(-5, -4, 4.2)], '#d9d1c3');
      for (var v = -3.75; v < 5; v += 1.25) h += lin([P(v, -4, 0), P(v, -4, 4.2)], 'rgba(27,25,21,.08)', 1);
      h += poly([P(-4.6, -4, 3.0), P(4.6, -4, 3.0), P(4.6, -4, 3.7), P(-4.6, -4, 3.7)], 'url(#v-glas)', ' stroke="#1b1915" stroke-width="1.2"');
      for (var f = -3.4; f < 4.6; f += 1.2) h += lin([P(f, -4, 3.0), P(f, -4, 3.7)], '#1b1915', 1.2);
      h += poly([P(-5, 0.4, 0), P(-5, 3.4, 0), P(-5, 3.4, 3.0), P(-5, 0.4, 3.0)], '#c3baab', ' stroke="#1b1915" stroke-width="1.2"');
      for (var r = 0.3; r < 3; r += 0.3) h += lin([P(-5, 0.4, r), P(-5, 3.4, r)], 'rgba(27,25,21,.18)', 1);
      // Golvmarkeringar.
      h += lin([P(-4.6, 2.9, 0.01), P(4.6, 2.9, 0.01)], '#f0b56e', 3);
      h += lin([P(-4.6, -3.2, 0.01), P(4.6, -3.2, 0.01)], '#f0b56e', 3);
      // Pelare och takbalkar.
      [[-4.8, -3.8], [4.5, -3.8], [-4.8, 3.5]].forEach(function (k) { h += box(k[0], k[1], 0, 0.3, 0.3, 4.2, KOL); });
      h += box(-4.8, -3.8, 4.2, 9.6, 0.3, 0.3, KOL) + box(-4.8, -3.8, 4.2, 0.3, 7.6, 0.3, KOL);
      for (var t = -2.8; t < 4.6; t += 1.9) h += lin([P(t, -3.6, 4.5), P(t, 3.8, 4.5)], 'rgba(27,25,21,.28)', 1.5);
      // Traversen som åker längs balken.
      h += g('v-travers', box(-4.6, -3.5, 3.95, 0.6, 7.2, 0.25, { t: '#f0b56e', x: '#8f5424', y: '#c9975a' }) +
        lin([P(-4.3, 0.2, 3.95), P(-4.3, 0.2, 2.9)], '#1b1915', 1.4) +
        box(-4.45, 0.05, 2.75, 0.3, 0.3, 0.15, KOL));
      // Stället med färdiga väggelement, fasad och fönster.
      h += skugga(2.6, -2.8, 1.8, 0.8);
      [0, 1, 2].forEach(function (k) { h += box(1.2, -3.7 + k * 0.32, 0, 2.9, 0.14, 2.3, k === 2 ? FASAD : VIRKE); });
      h += fonsterY(-2.92, 1.7, 2.5, 0.9, 1.9, 'url(#v-glas)') + fonsterY(-2.92, 2.9, 3.7, 0.9, 1.9, 'url(#v-glas)');
      // Arbetsbänken med elementet som byggs: reglar och sedan isolering.
      h += skugga(1.4, 1.2, 3.0, 1.4);
      [[-0.9, -0.6], [3.4, -0.6], [3.4, 2.4], [-0.9, 2.4]].forEach(function (k) { h += box(k[0], k[1], 0, 0.2, 0.2, 0.9, KOL); });
      h += box(-1.1, -0.8, 0.9, 4.8, 3.4, 0.14, { t: '#6f6a62', x: '#3a352d', y: '#4f4a42' });
      h += box(-0.8, -0.5, 1.04, 4.2, 0.24, 0.16, VIRKE) + box(-0.8, 2.0, 1.04, 4.2, 0.24, 0.16, VIRKE);
      for (var k = 0; k < 6; k++) h += g('v-regel', box(-0.8 + k * 0.8, -0.26, 1.04, 0.2, 2.26, 0.16, VIRKE), '--i:' + k);
      for (var q = 0; q < 5; q++) h += g('v-isolering', box(-0.58 + q * 0.8, -0.24, 1.05, 0.56, 2.22, 0.13, { t: '#f6dd8f', x: '#d9b95c', y: '#e8c96e' }), '--i:' + q);
      // Snickaren vid bänken.
      h += person(1.2, 2.95, { t: '#f0b56e', x: '#c9975a', y: '#dfb57a' }, '#fffdf8', 'v-arbetare', null, [1.75, 2.05, 1.24]);
      // Trucken som kör fram och tillbaka med en pall reglar.
      // Trucken: motvikt och chassi, förarskydd med tak, säte och ratt,
      // mast med gaffelvagn och gafflar under en pall virke, hjul och
      // en varningslampa som blinkar.
      var MORK = { t: '#3a352d', x: '#1b1915', y: '#2a2622' };
      var tr = box(-4.45, 1.55, 0.18, 0.14, 0.85, 0.55, { t: '#c5662a', x: '#9d4f1f', y: '#b35a24' });
      tr += box(-4.31, 1.55, 0.18, 1.12, 0.85, 0.45, ORANGE);
      tr += box(-4.2, 1.7, 0.63, 0.42, 0.5, 0.1, MORK) + box(-4.2, 1.7, 0.73, 0.09, 0.5, 0.42, MORK);
      var rb = P(-3.62, 1.95, 0.63), rt = P(-3.68, 1.95, 1.02);
      tr += '<line x1="' + rb[0].toFixed(1) + '" y1="' + rb[1].toFixed(1) + '" x2="' + rt[0].toFixed(1) + '" y2="' + rt[1].toFixed(1) + '" stroke="#1b1915" stroke-width="2"/>' +
        '<ellipse cx="' + rt[0].toFixed(1) + '" cy="' + rt[1].toFixed(1) + '" rx="5" ry="2.6" fill="none" stroke="#1b1915" stroke-width="1.6"/>';
      [[-4.28, 1.58], [-4.28, 2.33], [-3.42, 1.58], [-3.42, 2.33]].forEach(function (k) { tr += box(k[0], k[1], 0.63, 0.05, 0.05, 0.95, MORK); });
      tr += box(-4.32, 1.55, 1.58, 0.95, 0.86, 0.05, MORK);
      for (var gx = -4.15; gx < -3.42; gx += 0.18) tr += lin([P(gx, 1.57, 1.635), P(gx, 2.39, 1.635)], 'rgba(255,255,255,.18)', 1);
      tr += cyl(-3.85, 1.95, 1.63, 0.08, 0.1, { x: '#f6a04d', t: '#ffd29a' });
      var bk = P(-3.85, 1.95, 1.75);
      tr += '<ellipse class="v-blink" cx="' + bk[0].toFixed(1) + '" cy="' + bk[1].toFixed(1) + '" rx="14" ry="10" fill="url(#v-lampa)"/>';
      tr += box(-3.19, 1.6, 0.12, 0.07, 0.07, 1.85, MORK) + box(-3.19, 2.27, 0.12, 0.07, 0.07, 1.85, MORK);
      tr += box(-3.19, 1.6, 1.9, 0.07, 0.74, 0.06, MORK) + box(-3.19, 1.6, 0.95, 0.07, 0.74, 0.05, MORK);
      tr += box(-3.12, 1.64, 0.2, 0.04, 0.66, 0.4, MORK);
      tr += box(-3.08, 1.7, 0.2, 1.0, 0.1, 0.04, { t: '#6f6a62', x: '#3a352d', y: '#4f4a42' }) + box(-3.08, 2.12, 0.2, 1.0, 0.1, 0.04, { t: '#6f6a62', x: '#3a352d', y: '#4f4a42' });
      tr += box(-3.02, 1.62, 0.24, 0.92, 0.74, 0.04, { t: '#c9975a', x: '#8f5424', y: '#a96c33' });
      [1.62, 1.95, 2.28].forEach(function (yy) { tr += box(-3.02, yy, 0.28, 0.92, 0.08, 0.07, { t: '#c9975a', x: '#8f5424', y: '#a96c33' }); });
      tr += box(-3.02, 1.62, 0.35, 0.92, 0.74, 0.04, { t: '#c9975a', x: '#8f5424', y: '#a96c33' });
      for (var lv = 0; lv < 3; lv++) tr += box(-2.98, 1.65 + lv * 0.235, 0.39, 0.84, 0.21, 0.28, { t: '#f3d6a6', x: '#c9975a', y: '#dfb57a' });
      tr += hjulY(-4.05, 2.41, 0.2, 0.2) + hjulY(-3.4, 2.41, 0.24, 0.24);
      h += g('v-truck', skugga(-3.6, 2.0, 1.0, 0.45, 0.8) + tr);
      // Termometern: jämn temperatur.
      var tm = P(4.2, -3.8, 2.4);
      h += '<g class="v-termo" transform="translate(' + tm[0].toFixed(1) + ',' + tm[1].toFixed(1) + ')">' +
        '<rect x="-7" y="-34" width="14" height="44" rx="7" fill="#fffdf8" stroke="#1b1915" stroke-width="1.5"/>' +
        '<rect class="v-termofyll" x="-3" y="-26" width="6" height="30" rx="3" fill="#f0b56e"/>' +
        '<circle cx="0" cy="8" r="6" fill="#f0b56e" stroke="#1b1915" stroke-width="1.5"/></g>';
      // Dagsljuset från fönsterbandet faller in över golvet.
      [[-3.4, -1.6], [0.2, 2.0]].forEach(function (k, i) {
        h += '<polygon class="v-ljuskon" style="--i:' + i + '" points="' + [P(k[0], -4, 3.0), P(k[1], -4, 3.0), P(k[1] + 1.2, -1.0, 0.02), P(k[0] + 1.2, -1.0, 0.02)].map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '" fill="url(#v-kon)"/>';
      });
      var be = P(3.4, 1.3, 1.2);
      h += etikett(be[0], be[1], 'Väggarna', 'hoger', 22, 0);
      return h;
    }

    /* 5 Grund och anslutningar: plattan gjuts, ledningarna fram. */
    function ror(pnts, farg, klass) {
      var q = pnts.map(function (k) { return P(k[0], k[1], k[2]); });
      return lin(q, '#1b1915', 5.5) + lin(q, farg, 3.5) + lin(q, 'rgba(255,255,255,.85)', 1.6, ' class="v-flode ' + klass + '"');
    }
    function stigare(x, y, farg) {
      var a = P(x, y, 0.4), b = P(x, y, 0.75);
      var l = ' x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"';
      return '<line' + l + ' stroke="#1b1915" stroke-width="7" stroke-linecap="round"/><line' + l + ' stroke="' + farg + '" stroke-width="4.5" stroke-linecap="round"/>';
    }
    function grund() {
      var h = DEFS + platta(GRAS);
      h += gran(-4.2, -3.2, 2.8) + gran(-3.2, -3.6, 2.2);
      // Betongbilen bakom till höger: chassi, hytt, en avsmalnande trumma
      // som lutar uppåt bakåt med spiralband, tratt och stativ.
      h += skugga(3.7, -3.3, 1.9, 0.7, 0.9);
      h += box(2.25, -3.85, 0.3, 2.1, 1.0, 0.22, KOL);
      h += box(2.6, -2.86, 0.28, 0.6, 0.06, 0.14, { t: '#5f5a52', x: '#3a352d', y: '#4f4a42' });
      // Stativet under trumman.
      [[3.75, 0.95], [2.7, 1.25]].forEach(function (s) {
        h += lin([P(s[0], -3.75, 0.52), P(s[0], -3.35, s[1]), P(s[0], -2.95, 0.52)], '#3a352d', 2.6);
      });
      var dr = [], fram = [3.95, -3.35, 1.32, 0.62], bak = [2.35, -3.35, 1.72, 0.4];
      for (var t = 0; t < 28; t++) {
        var v = t / 28 * Math.PI * 2;
        dr.push(P(fram[0], fram[1] + Math.cos(v) * fram[3], fram[2] + Math.sin(v) * fram[3]));
        dr.push(P(bak[0], bak[1] + Math.cos(v) * bak[3], bak[2] + Math.sin(v) * bak[3]));
      }
      var holje = hull(dr);
      h += '<defs><clipPath id="v-trumklipp"><polygon points="' + holje.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/></clipPath>' +
        '<linearGradient id="v-trumljus" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8f2"/><stop offset=".55" stop-color="#e3dccd"/><stop offset="1" stop-color="#b9b1a2"/></linearGradient></defs>';
      h += poly(holje, 'url(#v-trumljus)', ' stroke="#1b1915" stroke-width="1.4" stroke-linejoin="round"');
      var band = '';
      for (var k = -2; k < 9; k++) {
        var bx = 2.2 + k * 0.32;
        band += lin([P(bx, -3.35 - 0.9, 2.4), P(bx + 0.55, -3.35 + 0.9, 0.5)], '#f0b56e', 6);
      }
      h += '<g clip-path="url(#v-trumklipp)"><g class="v-trumband">' + band + '</g></g>';
      var opp = [];
      for (var t2 = 0; t2 < 24; t2++) { var w = t2 / 24 * Math.PI * 2; opp.push(P(bak[0] - 0.01, bak[1] + Math.cos(w) * bak[3], bak[2] + Math.sin(w) * bak[3])); }
      h += poly(opp, '#cfc6b5', ' stroke="#1b1915" stroke-width="1.2"');
      var inner = [];
      for (var t3 = 0; t3 < 24; t3++) { var w2 = t3 / 24 * Math.PI * 2; inner.push(P(bak[0] - 0.02, bak[1] + Math.cos(w2) * bak[3] * 0.55, bak[2] + Math.sin(w2) * bak[3] * 0.55)); }
      h += poly(inner, '#3a352d');
      // Tratten ovanför öppningen.
      h += poly([P(2.2, -3.6, 2.35), P(2.2, -3.1, 2.35), P(2.35, -3.22, 2.0), P(2.35, -3.48, 2.0)], '#dfb57a', ' stroke="#1b1915" stroke-width="1"');
      h += hytt(4.3, -3.9, 0.8, 1.1, 1.15, 0.3);
      h += hjulY(2.75, -2.79, 0.3, 0.3) + hjulY(3.4, -2.79, 0.3, 0.3) + hjulY(4.65, -2.79, 0.3, 0.3);
      // Rännan som häller betongen i formen.
      var r0 = P(2.25, -3.1, 1.15), r1 = P(1.7, -1.5, 0.55);
      h += '<path d="M' + r0[0].toFixed(1) + ' ' + r0[1].toFixed(1) + 'L' + r1[0].toFixed(1) + ' ' + r1[1].toFixed(1) + '" stroke="#1b1915" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M' + r0[0].toFixed(1) + ' ' + r0[1].toFixed(1) + 'L' + r1[0].toFixed(1) + ' ' + r1[1].toFixed(1) + '" stroke="#a9a297" stroke-width="6" stroke-linecap="round"/>' +
        '<path class="v-hall" d="M' + r0[0].toFixed(1) + ' ' + r0[1].toFixed(1) + 'L' + r1[0].toFixed(1) + ' ' + r1[1].toFixed(1) + 'L' + r1[0].toFixed(1) + ' ' + (r1[1] + 12).toFixed(1) + '" fill="none" stroke="#d6d0c4" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="6 6"/>';
      // Utsättningen: pinnar och snöre.
      var sn = [[-2.8, -2.2], [2.8, -2.2], [2.8, 2.2], [-2.8, 2.2]];
      sn.forEach(function (k) { h += box(k[0] - 0.08, k[1] - 0.08, 0, 0.16, 0.16, 0.7, VIRKE); });
      h += lin(sn.concat([sn[0]]).map(function (k) { return P(k[0], k[1], 0.62); }), '#f0b56e', 1.4, ' stroke-dasharray="5 4"');
      // Material till plattan: en pall cellplast och en bunt armeringsnät.
      h += skugga(-3.9, -1.0, 1.0, 0.55, 0.9);
      h += box(-4.6, -1.6, 0, 1.3, 1.1, 0.14, { t: '#c9975a', x: '#8f5424', y: '#a96c33' });
      for (var ck = 0; ck < 5; ck++) {
        var cz = 0.14 + ck * 0.17;
        h += box(-4.55 + (ck % 2) * 0.03, -1.55, cz, 1.2, 1.0, 0.16, { t: '#fbfaf6', x: '#d9d4ca', y: '#e9e5dc' });
        h += lin([P(-3.35 + (ck % 2) * 0.03, -1.55, cz + 0.08), P(-3.35 + (ck % 2) * 0.03, -0.55, cz + 0.08)], 'rgba(27,25,21,.12)', 1);
      }
      h += lin([P(-3.95, -1.55, 0.98), P(-3.95, -0.55, 0.98), P(-3.95, -0.55, 0.15)], '#5b8fbf', 2.4);
      h += box(-3.3, 0.0, 0, 1.6, 1.1, 0.06, { t: '#8a847a', x: '#5f5a52', y: '#6f6a62' });
      for (var ak = 0; ak < 2; ak++) {
        var az = 0.07 + ak * 0.05;
        for (var ax = -3.25; ax <= -1.75; ax += 0.2) h += lin([P(ax, 0.05, az), P(ax, 1.05, az)], '#6f6a62', 1.2);
        for (var ay = 0.05; ay <= 1.06; ay += 0.2) h += lin([P(-3.25, ay, az), P(-1.75, ay, az)], '#6f6a62', 1.2);
      }
      // Schaktet, formbrädorna bak och rören.
      h += poly([P(-2.4, -1.9, 0.01), P(2.4, -1.9, 0.01), P(2.4, 1.9, 0.01), P(-2.4, 1.9, 0.01)], '#8c6c4d');
      h += box(-2.45, -1.95, 0, 4.9, 0.08, 0.5, VIRKE) + box(-2.45, -1.95, 0, 0.08, 3.9, 0.5, VIRKE);
      h += ror([[5, 0.6, 0.02], [1.2, 0.6, 0.02]], '#5b8fbf', '') +
        ror([[5, -0.6, 0.02], [0.4, -0.6, 0.02]], '#8a847a', 'v-flode--2') +
        ror([[-0.6, 4, 0.02], [-0.6, 1.0, 0.02]], '#f0b56e', 'v-flode--3');
      h += g('v-platta', box(-2.3, -1.8, 0, 4.6, 3.6, 0.4, BETONG) +
        poly([P(-2.3, -1.8, 0.4), P(2.3, -1.8, 0.4), P(2.3, 1.8, 0.4), P(-2.3, 1.8, 0.4)], 'url(#v-glans)', ' class="v-blank"'));
      h += stigare(1.2, 0.6, '#5b8fbf') + stigare(0.4, -0.6, '#8a847a') + stigare(-0.6, 1.0, '#f0b56e');
      // Formbrädorna fram.
      h += box(-2.45, 1.87, 0, 4.9, 0.08, 0.5, VIRKE) + box(2.37, -1.95, 0, 0.08, 3.9, 0.5, VIRKE);
      // Grushögen.
      var gh = P(-3.6, 2.8, 0), gt = P(-3.6, 2.8, 1.1);
      h += skugga(-3.5, 2.9, 1.1, 0.55, 0.9);
      h += '<path d="M' + (gh[0] - 32).toFixed(1) + ' ' + gh[1].toFixed(1) + 'Q' + (gt[0] - 6).toFixed(1) + ' ' + (gt[1] - 6).toFixed(1) + ' ' + gt[0].toFixed(1) + ' ' + gt[1].toFixed(1) + 'L' + gh[0].toFixed(1) + ' ' + (gh[1] + 10).toFixed(1) + 'Q' + (gh[0] - 20).toFixed(1) + ' ' + (gh[1] + 8).toFixed(1) + ' ' + (gh[0] - 32).toFixed(1) + ' ' + gh[1].toFixed(1) + 'z" fill="#c9bfae"/>';
      h += '<path d="M' + gt[0].toFixed(1) + ' ' + gt[1].toFixed(1) + 'Q' + (gt[0] + 8).toFixed(1) + ' ' + (gt[1] - 4).toFixed(1) + ' ' + (gh[0] + 32).toFixed(1) + ' ' + gh[1].toFixed(1) + 'Q' + (gh[0] + 18).toFixed(1) + ' ' + (gh[1] + 8).toFixed(1) + ' ' + gh[0].toFixed(1) + ' ' + (gh[1] + 10).toFixed(1) + 'z" fill="#a39886"/>';
      for (var s = 0; s < 6; s++) h += '<circle cx="' + (gh[0] - 18 + s * 7).toFixed(1) + '" cy="' + (gh[1] - 4 + (s % 2) * 6).toFixed(1) + '" r="1.6" fill="#8a7f6e"/>';
      // Skottkärran med grus.
      h += skugga(-1.7, 3.5, 0.8, 0.4, 0.85);
      h += lin([P(-2.0, 3.3, 0.36), P(-2.0, 3.3, 0)], '#3a352d', 2) + lin([P(-2.0, 3.8, 0.36), P(-2.0, 3.8, 0)], '#3a352d', 2);
      h += box(-2.15, 3.2, 0.32, 0.95, 0.75, 0.34, { t: '#6f9a6a', x: '#3f5a33', y: '#4f7042' });
      h += poly([P(-2.1, 3.25, 0.67), P(-1.25, 3.25, 0.67), P(-1.25, 3.9, 0.67), P(-2.1, 3.9, 0.67)], '#a39886');
      h += hjulY(-0.98, 3.56, 0.2, 0.2);
      h += lin([P(-2.15, 3.28, 0.6), P(-2.95, 3.28, 0.55)], '#6b4f36', 2.4) + lin([P(-2.15, 3.87, 0.6), P(-2.95, 3.87, 0.55)], '#6b4f36', 2.4);
      var va = P(5, 0.6, 0), av = P(5, -0.6, 0), el = P(-0.6, 4, 0), pt = P(0, 0, 0.4);
      h += etikett(va[0], va[1], 'Vatten', 'ner', 47, 0, '#5b8fbf', -10) + etikett(av[0], av[1], 'Avlopp', 'ner', 18, 1, '#8a847a', 20) +
        etikett(el[0], el[1], 'El', 'ner', 40, 2, '#f0b56e') + etikett(pt[0], pt[1], 'Plattan gjuts', 'upp', 14, 3);
      return h.replace('</defs>', '<linearGradient id="v-glans" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>');
    }

    /* 6 Leverans och montage: lastbilen, kranen och väggarna. */
    function montage() {
      var h = DEFS + platta(GRAS);
      h += gran(-4.4, -3.4, 3.0) + gran(4.5, -3.6, 2.4);
      // Plattan med två väggar som redan står, med fönster.
      h += skugga(-0.8, -0.6, 2.8, 1.4);
      h += box(-3.2, -3.0, 0, 4.6, 3.6, 0.35, BETONG);
      h += box(-3.1, -2.9, 0.35, 4.4, 0.22, 2.4, FASAD);
      h += box(-3.1, -2.9, 0.35, 0.22, 3.4, 2.4, FASAD);
      h += fonsterY(-2.68, -1.6, -0.2, 1.1, 2.2, 'url(#v-glas)');
      h += fonsterX(-2.88, -2.2, -1.0, 1.1, 2.2, 'url(#v-glas)');
      for (var s = -3.0; s < 1.3; s += 0.45) h += lin([P(s, -2.68, 0.4), P(s, -2.68, 2.7)], 'rgba(255,255,255,.06)', 1);
      // Tornkranen: fackverkstorn, bom rakt över framkanten, motvikt och löpkatt.
      h += skugga(3.6, 0.5, 0.9, 0.45);
      h += box(3.1, 0.05, 0, 0.9, 0.9, 0.2, BETONG);
      h += box(3.3, 0.25, 0.2, 0.5, 0.5, 5.0, { t: '#f0b56e', x: '#c9975a', y: '#dfb57a' });
      h += fackZ(3.8, 0.25, 0.3, 5.1, 0.45, '#8f5424', 'y') + fackZ(3.3, 0.75, 0.3, 5.1, 0.45, '#8f5424', 'x');
      h += box(3.2, 0.15, 5.2, 0.7, 0.7, 0.55, { t: '#fffdf8', x: '#cfc6b5', y: '#e2d9ca' });
      h += poly([P(3.9, 0.25, 5.3), P(3.9, 0.75, 5.3), P(3.9, 0.75, 5.65), P(3.9, 0.25, 5.65)], 'url(#v-glas)');
      h += box(4.0, 0.25, 5.3, 0.9, 0.5, 0.45, KOL);
      h += box(3.0, -0.05, 0.2, 0.35, 0.35, 0.35, BETONG) + box(3.95, 0.65, 0.2, 0.35, 0.35, 0.35, BETONG);
      var spets = P(3.55, 0.5, 6.85);
      h += lin([P(3.55, 0.5, 5.75), P(3.55, 0.5, 6.85)], '#8f5424', 2.4);
      h += lin([spets, P(-1.4, 0.5, 6.03)], '#1b1915', 1) + lin([spets, P(4.9, 0.5, 5.75)], '#1b1915', 1);
      h += box(-1.6, 0.35, 5.75, 6.6, 0.3, 0.28, { t: '#f0b56e', x: '#c9975a', y: '#dfb57a' });
      h += fackY(-1.5, 4.9, 0.65, 5.76, 6.02, 0.5, '#8f5424');
      h += box(0.0, 0.3, 5.6, 0.4, 0.4, 0.15, KOL);
      var krok = P(0.2, 0.5, 5.6);
      h += '<line class="v-lina" x1="' + krok[0].toFixed(1) + '" y1="' + krok[1].toFixed(1) + '" x2="' + krok[0].toFixed(1) + '" y2="' + (krok[1] + 58.5).toFixed(1) + '" stroke="#1b1915" stroke-width="1.6" style="transform-origin:' + krok[0].toFixed(1) + 'px ' + krok[1].toFixed(1) + 'px"/>';
      // Elementet (en framvägg med fönster) som sänks ned på plattans framkant.
      var kt = P(0.2, 0.5, 3.35);
      h += g('v-last', box(-0.9, 0.38, 0.35, 2.2, 0.22, 2.4, FASAD) +
        poly([P(-0.4, 0.601, 1.1), P(0.8, 0.601, 1.1), P(0.8, 0.601, 2.2), P(-0.4, 0.601, 2.2)], 'url(#v-glas)', ' stroke="#1b1915" stroke-width="1"') +
        lin([P(0.2, 0.5, 3.35), P(-0.9, 0.49, 2.75)], '#1b1915', 1.2) + lin([P(0.2, 0.5, 3.35), P(1.3, 0.49, 2.75)], '#1b1915', 1.2) +
        '<rect x="' + (kt[0] - 5).toFixed(1) + '" y="' + (kt[1] - 9).toFixed(1) + '" width="10" height="9" rx="2" fill="#f0b56e" stroke="#1b1915" stroke-width="1.2"/>');
      // Montören som dirigerar, och koner.
      h += person(-1.7, 1.35, { t: '#f08a3c', x: '#c5662a', y: '#dc7834' }, '#f0b56e', 'v-arbetare', null, [-1.05, 1.3, 2.35]);
      h += kon(-3.4, 2.4) + kon(-0.6, 3.75);
      // Lastbilen: chassi, flak med element i spännband, hytt, hjul och blinkljus.
      var x0 = 0.4, y0 = 2.05;
      h += skugga(x0 + 2.4, y0 + 0.75, 2.8, 1.0, 0.9);
      h += box(x0, y0 + 0.1, 0.3, 4.6, 1.1, 0.22, KOL);
      h += box(x0, y0, 0.52, 3.3, 1.3, 0.12, { t: '#8a6a4b', x: '#5a4330', y: '#6f5440' });
      h += box(x0 + 0.1, y0 + 0.1, 0.64, 3.1, 1.1, 0.22, VIRKE) + box(x0 + 0.15, y0 + 0.15, 0.86, 3.0, 1.0, 0.22, { t: '#f3d6a6', x: '#c9975a', y: '#dfb57a' });
      [0.9, 2.5].forEach(function (u) {
        h += lin([P(x0 + u, y0 + 0.1, 1.09), P(x0 + u, y0 + 1.2, 1.09), P(x0 + u, y0 + 1.3, 0.6)], '#f08a3c', 2.2);
      });
      h += hytt(x0 + 3.35, y0, 1.25, 1.3, 1.5, 0.3);
      h += box(x0 + 3.2, y0 + 1.3, 0.38, 0.6, 0.06, 0.22, { t: '#5f5a52', x: '#3a352d', y: '#4f4a42' });
      var bl = P(x0 + 3.95, y0 + 0.65, 1.86);
      h += '<ellipse class="v-blink" cx="' + bl[0].toFixed(1) + '" cy="' + (bl[1] - 3).toFixed(1) + '" rx="18" ry="11" fill="url(#v-lampa)"/>';
      h += '<rect x="' + (bl[0] - 5).toFixed(1) + '" y="' + (bl[1] - 6).toFixed(1) + '" width="10" height="6" rx="2" fill="#f6a04d" stroke="#1b1915" stroke-width="1"/>';
      h += hjulY(x0 + 0.7, y0 + 1.31, 0.32, 0.32) + hjulY(x0 + 1.5, y0 + 1.31, 0.32, 0.32) + hjulY(x0 + 3.95, y0 + 1.31, 0.32, 0.32);
      var lv = P(5.0, 2.7, 0.3), mo = P(-1.75, 1.45, 1.15);
      h += etikett(lv[0], lv[1], 'Leveransen', 'ner', 40, 0) + etikett(mo[0], mo[1], 'Montaget', 'vanster', 18, 1);
      return h;
    }

    /* 7 Slutbesiktning: det färdiga huset, lampor tända, punktlistan. */
    function besiktning() {
      var h = DEFS + platta(GRAS);
      h += gran(-4.4, -3.4, 3.0) + gran(-3.5, -3.8, 2.2) + gran(4.5, -2.4, 2.4);
      // Grusgången från trappan till kanten.
      h += poly([P(-0.75, 2.72, 0.01), P(0.15, 2.72, 0.01), P(0.15, 4.0, 0.01), P(-0.75, 4.0, 0.01)], '#e6dfcf');
      for (var gk = 0; gk < 14; gk++) {
        var gp = P(-0.65 + (gk * 0.37) % 0.75, 2.85 + gk * 0.085, 0.02);
        h += '<circle cx="' + gp[0].toFixed(1) + '" cy="' + gp[1].toFixed(1) + '" r="1.1" fill="#c9bfae"/>';
      }
      // Huset: sockel, väggar med panel, gavel, tak med falsar, skorsten.
      var x0 = -2.8, y0 = -2.0, x1 = 2.4, y1 = 1.0, ze = 2.5, zr = 3.7, ym = -0.5, o = 0.3;
      h += skugga(0.4, 0.2, 4.0, 2.0);
      h += box(-3.0, -2.2, 0, 5.6, 3.4, 0.25, BETONG);
      h += box(x0, y0, 0.25, x1 - x0, y1 - y0, ze - 0.25, FASAD);
      h += poly([P(x1, y0, ze), P(x1, y1, ze), P(x1, ym, zr)], FASAD.x);
      for (var px = x0 + 0.26; px < x1 - 0.05; px += 0.26) h += lin([P(px, y1, 0.27), P(px, y1, ze - 0.02)], 'rgba(255,255,255,.08)', 1);
      for (var py = y0 + 0.26; py < y1 - 0.05; py += 0.26) {
        var zt = ze + (zr - ze) * (1 - Math.abs(py - ym) / ((y1 - y0) / 2));
        h += lin([P(x1, py, 0.27), P(x1, py, zt - 0.04)], 'rgba(255,255,255,.07)', 1);
      }
      // Taket.
      h += poly([P(x0 - o, y0 - o, ze - 0.05), P(x1 + o, y0 - o, ze - 0.05), P(x1 + o, ym, zr), P(x0 - o, ym, zr)], TAK.x);
      h += poly([P(x0 - o, ym, zr), P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze - 0.05), P(x0 - o, y1 + o, ze - 0.05)], TAK.t);
      for (var sx = x0 - o + 0.32; sx < x1 + o; sx += 0.32) h += lin([P(sx, ym, zr), P(sx, y1 + o, ze - 0.05)], 'rgba(255,255,255,.07)', 1);
      h += poly([P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze - 0.05), P(x1 + o, y1 + o, ze - 0.2), P(x1 + o, ym, zr - 0.15)], TAK.kant);
      h += poly([P(x1 + o, y0 - o, ze - 0.05), P(x1 + o, ym, zr), P(x1 + o, ym, zr - 0.15), P(x1 + o, y0 - o, ze - 0.2)], TAK.kant);
      h += lin([P(x0 - o, ym, zr + 0.02), P(x1 + o, ym, zr + 0.02)], '#5a554e', 2.6);
      h += lin([P(x0 - o, y1 + o, ze - 0.06), P(x1 + o, y1 + o, ze - 0.06)], '#1b1915', 2);
      // Skorstenen på takets framsida, med rök.
      function rz(y) { return zr - (y - ym) / ((y1 + o) - ym) * (zr - (ze - 0.05)); }
      h += poly([P(1.4, 0, rz(0)), P(1.4, 0.4, rz(0.4)), P(1.4, 0.4, 4.35), P(1.4, 0, 4.35)], '#8a847a');
      h += poly([P(1.0, 0.4, rz(0.4)), P(1.4, 0.4, rz(0.4)), P(1.4, 0.4, 4.35), P(1.0, 0.4, 4.35)], '#a39b8e');
      h += box(0.95, -0.05, 4.35, 0.5, 0.5, 0.1, { t: '#5a554e', x: '#3a352d', y: '#4a443d' });
      var rk = P(1.2, 0.2, 4.5);
      [0, 1, 2].forEach(function (i) {
        h += '<circle class="v-rok" style="--i:' + i + '" cx="' + rk[0].toFixed(1) + '" cy="' + rk[1].toFixed(1) + '" r="' + (6 + i * 2) + '" fill="#e9e2d6"/>';
      });
      // Varmt sken framför husets fönster.
      var sk = P(0.2, 1.0, 1.4);
      h += '<ellipse class="v-sken" cx="' + sk[0].toFixed(1) + '" cy="' + (sk[1] + 30).toFixed(1) + '" rx="120" ry="44" fill="url(#v-sken)"/>';
      // Fönster med karm, spröjs och fönsterbänk; dörr med handtag.
      h += fonsterY(y1, -2.3, -1.1, 0.95, 2.1, 'url(#v-varm)');
      h += lin([P(-1.7, y1, 0.95), P(-1.7, y1, 2.1)], '#1b1915', 1.4);
      h += fonsterY(y1, 0.1, 1.9, 0.5, 2.1, 'url(#v-varm)');
      h += lin([P(1.0, y1, 0.5), P(1.0, y1, 2.1)], '#1b1915', 1.6);
      [[-2.35, -1.05, 0.93], [0.05, 1.95, 0.48]].forEach(function (f) { h += lin([P(f[0], y1 + 0.02, f[2]), P(f[1], y1 + 0.02, f[2])], '#e9e2d6', 2.6); });
      h += fonsterX(x1, -1.3, -0.3, 1.1, 2.0, 'url(#v-varm)');
      h += lin([P(x1, -0.8, 1.1), P(x1, -0.8, 2.0)], '#1b1915', 1.2);
      h += poly([P(-0.75, y1, 0.27), P(-0.2, y1, 0.27), P(-0.2, y1, 2.05), P(-0.75, y1, 2.05)], '#6b4f36', ' stroke="#1b1915" stroke-width="1.4"');
      h += lin([P(-0.62, y1, 1.95), P(-0.62, y1, 0.4)], 'rgba(255,255,255,.12)', 1) + lin([P(-0.33, y1, 1.95), P(-0.33, y1, 0.4)], 'rgba(255,255,255,.12)', 1);
      var dh = P(-0.28, y1, 1.15);
      h += '<circle cx="' + dh[0].toFixed(1) + '" cy="' + dh[1].toFixed(1) + '" r="1.8" fill="#f0b56e"/>';
      var vl = P(-0.05, y1, 1.75);
      h += '<ellipse class="v-lampsken" cx="' + vl[0].toFixed(1) + '" cy="' + (vl[1] + 4).toFixed(1) + '" rx="22" ry="16" fill="url(#v-lampa)"/>';
      h += '<rect x="' + (vl[0] - 3).toFixed(1) + '" y="' + (vl[1] - 6).toFixed(1) + '" width="6" height="9" rx="2" fill="#fff1d2" stroke="#1b1915" stroke-width="1"/>';
      // Altanen och trappan.
      h += box(-1.6, y1, 0, 3.6, 1.3, 0.25, VIRKE);
      for (var d = -1.3; d < 2.0; d += 0.4) h += lin([P(d, y1, 0.26), P(d, 2.3, 0.26)], '#c9975a', 1);
      h += box(-0.8, 2.3, 0, 1.0, 0.42, 0.13, VIRKE);
      // Buskar, brevlåda.
      h += buske(2.45, 1.7) + buske(2.95, 0.6);
      h += box(3.35, 3.15, 0, 0.1, 0.1, 0.95, KOL);
      h += box(3.2, 3.0, 0.95, 0.4, 0.45, 0.32, { t: '#4a443d', x: '#27231f', y: '#35302a' });
      var bf = P(3.6, 3.1, 1.2);
      h += '<rect x="' + (bf[0] - 1).toFixed(1) + '" y="' + (bf[1] - 12).toFixed(1) + '" width="2" height="12" fill="#1b1915"/><rect x="' + (bf[0] + 1).toFixed(1) + '" y="' + (bf[1] - 12).toFixed(1) + '" width="8" height="5" rx="1" fill="#f0b56e"/>';
      // Nyckelöverlämningen: kunden och Idealhus, nyckeln mellan dem.
      h += person(-2.7, 2.3, { t: '#8fb0cf', x: '#6f90af', y: '#7fa0bf' }, null, 'v-arbetare', null, [-1.62, 2.66, 1.18]);
      h += person(-0.35, 3.0, { t: '#3a352d', x: '#1b1915', y: '#2a2622' }, '#f0b56e', '', [-1.28, 2.84, 1.18]);
      var ny = P(-1.45, 2.75, 1.16);
      h += '<g class="v-nyckel2" style="transform-origin:' + ny[0].toFixed(1) + 'px ' + ny[1].toFixed(1) + 'px">' +
        '<circle cx="' + (ny[0] - 4).toFixed(1) + '" cy="' + ny[1].toFixed(1) + '" r="3.6" fill="none" stroke="#c98a45" stroke-width="2"/>' +
        '<path d="M' + (ny[0] - 0.5).toFixed(1) + ' ' + ny[1].toFixed(1) + 'h8m-2.5 0v3m-2.5-3v2" fill="none" stroke="#c98a45" stroke-width="1.8" stroke-linecap="round"/></g>';
      h += glitter(ny[0] + 4, ny[1] - 12, 5, 0);
      // Punktlistan som bockas av.
      h += '<g class="v-lista"><rect x="436" y="56" width="124" height="142" rx="16" fill="#fffdf8" stroke="#1b1915" stroke-width="1.6"/>' +
        '<rect x="481" y="48" width="34" height="14" rx="4" fill="#1b1915"/>' +
        '<text x="452" y="82" font-family="Poppins, sans-serif" font-size="10.5" font-weight="600" fill="#8f5424" letter-spacing="1">PUNKTLISTA</text>' +
        [0, 1, 2].map(function (i) {
          var y = 106 + i * 30;
          return '<rect x="452" y="' + (y - 9) + '" width="18" height="18" rx="5" fill="none" stroke="#1b1915" stroke-width="1.5"/>' +
            '<path class="v-bock v-bock--' + (i + 1) + '" d="M455 ' + y + 'l4 4 8-9" fill="none" stroke="#22a35a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>' +
            '<rect x="478" y="' + (y - 3) + '" width="' + (64 - i * 12) + '" height="6" rx="3" fill="#d8d1c4"/>';
        }).join('') + '</g>';
      h += glitter(222, 128, 7, 1) + glitter(396, 116, 6, 2) + glitter(418, 214, 7, 3);
      return h;
    }

    return [samtal, modell, lov, tillverkning, grund, montage, besiktning];
  })();

  /* --- Så fungerar det --------------------------------------------
     Scrollberättelsen (femte versionen, 2026-09-30). Till vänster en
     klistrande scen med sju isometriska miljöer (SCENER nedan), som byter
     mjukt när man rullar: den gamla lyfts undan, den nya glider fram och
     sakerna i den börjar röra sig (bara den aktiva rör sig). Ovanpå:
     skedet, en ring med stegnumret och stegets namn. Till höger stegen
     längs en räls som fylls. I mobilen ligger varje miljö i sitt steg.
     Vem gör vad och hustypen som förut. Stil i design.css 19. */
  (function () {
    $$('.vemkort').forEach(function (v) {
      if (lugn) v.classList.add('syns');
      else narSynligt(v, function (e) { e.classList.add('syns'); }, 0.4);
    });
    var rot = $('[data-berattelse]');
    if (!rot) return;
    var sek = rot.closest('.flode') || document;
    var steg = $$('.berattelse__steg', rot);
    var holder = $('[data-vyer]', rot);
    var ram = $('.berattelse__ram', rot);
    var lista = $('.berattelse__lista', rot);
    var railFyll = $('.berattelse__railfyll', rot);
    var railKula = $('.berattelse__railkula', rot);
    var rail = $('.berattelse__rail', rot);
    var styr = $('.flode__styr', sek);
    var smal = window.matchMedia('(max-width: 900px)');
    var prickar = $$('[data-fard]', sek);
    var nu = $('[data-flode-nu]', sek);
    var hud = {
      skede: $('[data-scen-skede]', rot), nr: $('[data-scen-nr]', rot),
      namn: $('[data-scen-namn]', rot), ring: $('.berattelse__ringfyll', rot)
    };
    var bred = window.matchMedia('(min-width: 1041px)');
    $$('.vemfilter, .hustypval', sek).forEach(glidandeMarkering);
    // Scenramen lutar inte längre efter musen (ritade om hela SVG:n).

    // Scenerna. Varje svg får egna id:n för sina toningar.
    var vyer = SCENER.map(function (f, i) {
      var d = document.createElement('div');
      d.className = 'berattelse__vy';
      d.innerHTML = '<svg viewBox="0 0 600 440" focusable="false">' +
        f().replace(/id="v-/g, 'id="v' + i + '-').replace(/url\(#v-/g, 'url(#v' + i + '-') + '</svg>';
      return d;
    });
    // Brickornas bredd mäts mot den riktiga texten (uppskattningen per
    // tecken räckte inte för t.ex. "Kommunen").
    function passaEtiketter() {
      vyer.forEach(function (v) {
        Array.prototype.forEach.call(v.querySelectorAll('.v-etikett'), function (e) {
          var t = e.querySelector('text'), r = e.querySelector('.v-etikettruta'), pr = r && r.nextElementSibling;
          if (!t || !r || !t.getComputedTextLength) return;
          var tl = t.getComputedTextLength();
          if (!tl) return;
          var w = tl + 35, rikt = e.getAttribute('data-rikt'), ax = parseFloat(e.getAttribute('data-ax'));
          var x0 = rikt === 'vanster' ? ax - w : (rikt === 'hoger' ? ax : ax - w / 2);
          r.setAttribute('x', x0.toFixed(1));
          r.setAttribute('width', w.toFixed(1));
          if (pr) pr.setAttribute('cx', (x0 + 12).toFixed(1));
          t.setAttribute('x', (x0 + 21).toFixed(1));
        });
      });
    }
    var ioVy = null;
    function placera() {
      if (ioVy) { ioVy.disconnect(); ioVy = null; }
      if (bred.matches) {
        vyer.forEach(function (v) { holder.appendChild(v); v.classList.remove('i-vy'); });
      } else {
        vyer.forEach(function (v, i) { $('.berattelse__plats', steg[i]).appendChild(v); });
        // I mobilen rör sig en miljö när den syns.
        if (window.IntersectionObserver && !lugn) {
          ioVy = new IntersectionObserver(function (poster) {
            poster.forEach(function (p) { p.target.classList.toggle('i-vy', p.isIntersecting); });
          }, { threshold: 0.35 });
          vyer.forEach(function (v) { ioVy.observe(v); });
        } else {
          vyer.forEach(function (v) { v.classList.add('i-vy'); });
        }
      }
      aktiv = -1;
      matt = null;
      boka();
    }

    var aktiv = -1;
    function visa(i) {
      if (i === aktiv) return;
      aktiv = i;
      steg.forEach(function (s, j) {
        s.classList.toggle('aktiv', j === i);
        s.classList.toggle('passerad', j <= i);
      });
      vyer.forEach(function (v, j) {
        v.classList.toggle('aktiv', j === i);
        v.classList.toggle('forbi', j < i);
      });
      prickar.forEach(function (d, j) {
        d.classList.toggle('aktiv', j === i);
        d.classList.toggle('klar', j < i);
      });
      var namn = $('h3', steg[i]).textContent;
      if (nu) nu.textContent = '0' + (i + 1) + ' · ' + steg[i].getAttribute('data-namn');
      if (hud.skede) hud.skede.textContent = steg[i].getAttribute('data-skede');
      if (hud.nr) hud.nr.textContent = '0' + (i + 1);
      if (hud.namn) {
        hud.namn.textContent = namn;
        hud.namn.classList.remove('byt');
        void hud.namn.offsetWidth;
        hud.namn.classList.add('byt');
      }
      if (hud.ring) hud.ring.style.strokeDasharray = ((i + 1) / steg.length * 100).toFixed(2) + ' 100';
    }

    // Vilket steg läser man? Det vars ruta korsar mitten av skärmen.
    var matt = null, bokad = false;
    function mat() {
      var y0 = window.scrollY;
      var rr = rail ? rail.getBoundingClientRect() : null;
      matt = {
        lista: { topp: lista.getBoundingClientRect().top + y0, h: lista.offsetHeight },
        rail: rr ? { topp: rr.top + y0, h: rail.offsetHeight } : null,
        steg: steg.map(function (s) {
          var r = s.getBoundingClientRect(), prick;
          if (bred.matches) {
            var k = $('.berattelse__kort', s).getBoundingClientRect();
            prick = k.top + k.height / 2 + y0;
            s.style.setProperty('--prick', (prick - (r.top + y0)).toFixed(1) + 'px');
          } else {
            prick = r.top + y0 + 42;
            s.style.removeProperty('--prick');
          }
          return { topp: r.top + y0, botten: r.bottom + y0, prick: prick };
        })
      };
    }
    function rita() {
      bokad = false;
      if (!matt) mat();
      var y = window.scrollY + window.innerHeight * 0.5;
      var i = 0;
      matt.steg.forEach(function (r, j) { if (y >= r.topp) i = j; });
      visa(i);
      if (matt.rail && matt.rail.h) {
        var sist = matt.steg[matt.steg.length - 1];
        var spets = y >= sist.botten ? matt.rail.h : matt.steg[i].prick - matt.rail.topp;
        spets = Math.min(matt.rail.h, Math.max(0, spets));
        if (railFyll) railFyll.style.transform = 'scaleY(' + (spets / matt.rail.h).toFixed(4) + ')';
        if (railKula) railKula.style.transform = 'translateY(' + spets.toFixed(1) + 'px)';
      } else if (railFyll) {
        var p = Math.min(1, Math.max(0, (y - matt.lista.topp) / matt.lista.h));
        railFyll.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      }
      // Raden ovanför stegen har dockat: en slöja bakom den döljer det som rullar förbi.
      if (styr) {
        var sr = styr.getBoundingClientRect();
        sek.classList.toggle('flode--dockad', !smal.matches && sr.top <= 92.5 && sek.getBoundingClientRect().bottom > sr.bottom + 40);
      }
    }
    function boka() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(rita);
    }
    window.addEventListener('scroll', boka, { passive: true });
    window.addEventListener('resize', function () { matt = null; boka(); });
    if (window.ResizeObserver) new ResizeObserver(function () { matt = null; boka(); }).observe(lista);
    if (bred.addEventListener) bred.addEventListener('change', placera);
    placera();
    passaEtiketter();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(passaEtiketter);

    // Vem gör vad: det som inte gäller tonas ner.
    var vemKnappar = $$('.vemfilter button', sek);
    vemKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        vemKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var vem = b.getAttribute('data-vem');
        steg.forEach(function (s, i) {
          var med = vem === 'alla' || s.getAttribute('data-vem') === vem;
          s.classList.toggle('dampad', !med);
          s.classList.toggle('markerad', med && vem !== 'alla');
          if (prickar[i]) prickar[i].classList.toggle('dampad', !med);
        });
        // Gäller inte steget man läser glider sidan till första som gäller.
        if (vem !== 'alla' && steg[aktiv] && steg[aktiv].classList.contains('dampad')) {
          var forsta = steg.filter(function (s) { return !s.classList.contains('dampad'); })[0];
          if (forsta) forsta.scrollIntoView({ block: 'center', behavior: lugn ? 'auto' : 'smooth' });
        }
      });
    });

    // Pricken man pekar på visar sitt steg i raden, sedan tillbaka.
    if (nu) {
      prickar.forEach(function (d, j) {
        if (!steg[j]) return;
        var etikett = '0' + (j + 1) + ' · ' + steg[j].getAttribute('data-namn');
        if (!d.getAttribute('title')) d.setAttribute('title', 'Steg ' + (j + 1) + ': ' + steg[j].getAttribute('data-namn'));
        var visaPrick = function () { nu.textContent = '0' + (j + 1) + ' · ' + steg[j].getAttribute('data-namn'); nu.classList.add('flode__nu--tittar'); };
        var tillbaka = function () {
          nu.classList.remove('flode__nu--tittar');
          if (steg[aktiv]) nu.textContent = '0' + (aktiv + 1) + ' · ' + steg[aktiv].getAttribute('data-namn');
        };
        d.addEventListener('mouseenter', visaPrick);
        d.addEventListener('focus', visaPrick);
        d.addEventListener('mouseleave', tillbaka);
        d.addEventListener('blur', tillbaka);
      });
    }

    // Hustyp: steg 03 säger vad som gäller, steg 06 får leveranstiden.
    var steg3 = $('#steg-3'), steg6 = $('#steg-6');
    var leverans = {};
    try { leverans = JSON.parse(sek.getAttribute('data-leverans')); } catch (e) { leverans = {}; }
    var orig = steg3 ? { h: $('h3', steg3).textContent, p: $('p', steg3).textContent, namn: steg3.getAttribute('data-namn') } : null;
    var chip = document.createElement('span');
    chip.className = 'flode__leverans';
    chip.hidden = true;
    if (steg6) $('.berattelse__stegtopp', steg6).appendChild(chip);
    var TEXT = {
      attefallshus: ['Anmälan för installationerna',
        'Ett attefallshus inom måtten behöver sedan december 2025 varken bygglov eller anmälan för själva byggnaden. Ska det ha vatten, avlopp, ventilation eller eldstad anmäls installationerna. Vi tar fram underlaget, du lämnar in till kommunen.'],
      annat: ['Bygglov',
        'Fritidshus kräver bygglov. Vi tar fram ritningar och underlag, men det är du som är byggherre och söker lovet hos din kommun.']
    };
    function blinka(el) {
      if (lugn || !el) return;
      el.classList.remove('berattelse__kort--ny');
      void el.offsetWidth;
      el.classList.add('berattelse__kort--ny');
    }
    var typKnappar = $$('.hustypval button', sek);
    typKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        typKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var typ = b.getAttribute('data-typ');
        if (steg3 && orig) {
          var t = typ === 'alla' ? [orig.h, orig.p] : (TEXT[typ] || TEXT.annat);
          $('h3', steg3).textContent = t[0];
          $('p', steg3).textContent = t[1];
          blinka($('.berattelse__kort', steg3));
          steg3.setAttribute('data-namn', typ === 'alla' ? orig.namn : (typ === 'attefallshus' ? 'Anmälan' : 'Bygglov'));
          if (aktiv === 2 && hud.namn) hud.namn.textContent = t[0];
          if (aktiv === 2 && nu) nu.textContent = '03 · ' + steg3.getAttribute('data-namn');
        }
        chip.hidden = typ === 'alla' || !leverans[typ];
        if (!chip.hidden) {
          chip.textContent = 'Leverans ' + leverans[typ] + ' v';
          blinka($('.berattelse__kort', steg6));
        }
      });
    });
  })();

  /* --- Så fungerar det: din checklista ---------------------------
     Det du själv gör, att bocka av. Bockarna sparas i webbläsaren
     (localStorage) - bara för den som tittar, inget skickas någonstans. */
  (function () {
    var lista = $('.checklista');
    if (!lista) return;
    var NYCKEL = 'idealhus-checklista';
    var rutor = $$('[data-check]', lista);
    var antal = $('[data-check-antal]', lista);
    var ring = $('.checklista__ringfyll', lista);
    var sparat = {};
    try { sparat = JSON.parse(lagra.hamta(NYCKEL) || '{}') || {}; } catch (e) { sparat = {}; }
    function rita() {
      var klara = rutor.filter(function (r) { return r.checked; }).length;
      antal.textContent = klara + ' av ' + rutor.length;
      if (ring) ring.style.strokeDasharray = (klara / rutor.length * 100).toFixed(2) + ' 100';
      lista.classList.toggle('checklista--klar', klara === rutor.length);
      lista.classList.toggle('checklista--tom', klara === 0);
    }
    rutor.forEach(function (r) {
      r.checked = !!sparat[r.getAttribute('data-check')];
      r.addEventListener('change', function () {
        sparat[r.getAttribute('data-check')] = r.checked;
        lagra.spara(NYCKEL, JSON.stringify(sparat));
        rita();
      });
    });
    $('[data-check-rensa]', lista).addEventListener('click', function () {
      rutor.forEach(function (r) { r.checked = false; });
      sparat = {};
      lagra.spara(NYCKEL, '{}');
      rita();
    });
    rita();
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

  // 3D-motorn (930 kB) hämtas och kompileras i en lugn stund efter att
  // sidan laddats, inte mitt i rullningen när sektionen närmar sig.
  if ($('#i-3d, [data-studio3d], [data-sprang]') && !(navigator.connection && navigator.connection.saveData)) {
    var forladda3d = function () {
      var vila = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : function (f) { return setTimeout(f, 1200); };
      vila(function () {
        if (window.customElements && customElements.get('model-viewer')) return;
        var l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = 'vendor/model-viewer.min.js';
        document.head.appendChild(l);
      }, { timeout: 4000 });
    };
    if (document.readyState === 'complete') forladda3d();
    else window.addEventListener('load', forladda3d);
  }

  (function () {
    var sek = $('#i-3d');
    var hero = $('[data-hus-bild]') || $('.subpage-hero__image');
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

    // Faktalistan överst stod med X för nockhöjd och byggnadsarea. Nock-
    // höjden och yttermåtten står i ritningen; byggnadsarean räknas inte
    // ut här - den avgör attefallsgränsen och ska komma från ritningen.
    $$('.model-specs > div').forEach(function (rad) {
      var dt = $('dt', rad), dd = $('dd', rad);
      if (!dt || !dd || dd.textContent.indexOf('X') === -1) return;
      var namn = dt.textContent.trim();
      if (namn === 'Nockhöjd') dd.textContent = MATT3D[id][2];
      if (namn === 'Byggnadsarea') {
        dt.textContent = 'Yttermått';
        dd.textContent = MATT3D[id][0].replace(' m', '') + ' × ' + MATT3D[id][1];
      }
    });

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
          var mobil = $('[data-3d-mobil]', sek);
          if (mv.canActivateAR) mobil.hidden = true;
          else if (window.matchMedia('(pointer: coarse)').matches) {
            mobil.textContent = 'Den här webbläsaren kan inte visa huset i AR – prova Chrome eller Safari.';
          }
          konfigurera(mv);
        });
        mv.addEventListener('error', fel);
        // Modellen snurrar bara när den syns - annars ritar den i onödan.
        if (!lugn && window.IntersectionObserver) {
          new IntersectionObserver(function (poster) {
            if (poster[0].isIntersecting) mv.setAttribute('auto-rotate', '');
            else mv.removeAttribute('auto-rotate');
          }).observe(scen);
        }
      }).catch(fel);
    }
    // Gick modellen inte att ladda står fotot kvar, med en knapp för att
    // försöka igen.
    function fel() {
      sek.classList.add('hus3dvy--fel');
      scen.textContent = '';
      var bild = document.createElement('img');
      bild.className = 'hus3dvy__felbild';
      bild.src = 'images/hus-' + id + '.webp';
      bild.alt = '';
      var ruta = document.createElement('div');
      ruta.className = 'hus3dvy__fel';
      ruta.innerHTML = '<p>3D-modellen kunde inte laddas.</p><button type="button">Försök igen</button>';
      $('button', ruta).addEventListener('click', function () {
        sek.classList.remove('hus3dvy--fel');
        scen.textContent = '';
        byggd = false;
        bygg();
      });
      scen.appendChild(bild);
      scen.appendChild(ruta);
    }
    narSynligt(sek, bygg, 0, '0px 0px 600px 0px');
  })();

  /* --- 3D-studion på kategorisidorna ---------------------------------
     De riktiga modellerna (modeller/hus-r*.glb) i model-viewer, i samma
     skala: kameran står på ett avstånd som passar kategorins största
     hus, så att ett mindre hus ser mindre ut. Måttlinjer och en människa
     på 1,8 m ritas ovanpå och följer modellen när man vrider - deras
     ändpunkter är hotspots i modellen som model-viewer räknar om till
     skärmen vid varje kamerarörelse. Tre vyer, zoom med knappar (inte
     med hjulet - då fastnar sidan) och talen räknas fram vid byte.
     Märkning och mått i _sidor.py (studio3d), stil i design.css 17. */
  (function () {
    var sek = $('[data-studio3d]');
    if (!sek) return;
    var scen = $('[data-3d-scen]', sek);
    var knappar = $$('[data-3d-val]', sek);
    var vyKnappar = $$('[data-vy]', sek);
    var progress = $('[data-3d-progress]', sek);
    var person = $('[data-3d-person]', sek);
    var tips = $('.studio3d__tips', sek);
    var mattKnapp = $('[data-3d-matt]', sek);
    var talEl = $$('[data-3d-tal]', sek);
    var linjer = {}, etiketter = {};
    ['l', 'b', 'h'].forEach(function (k) {
      linjer[k] = $$('[data-linje="' + k + '"] line', sek);
      etiketter[k] = $('[data-etikett="' + k + '"]', sek);
    });
    var komma = function (v, dec) { return v.toFixed(dec).replace('.', ','); };
    var alla = knappar.map(function (b) {
      var a = function (n) { return b.getAttribute('data-' + n); };
      return { knapp: b, id: a('id'), namn: a('namn'), yta: +a('yta'), rum: +a('rum'),
        l: +a('l'), b: +a('b'), h: +a('h') };
    });
    if (!alla.length) return;
    var aktiv = alla[0];

    // Samma kameraavstånd för alla hus i kategorin.
    var storst = Math.max.apply(null, alla.map(function (d) { return Math.sqrt(d.l * d.l + d.b * d.b); }));
    var R = storst * 1.2 + 5;
    var VYER = { horn: [-34, 70, 1], fasad: [0, 84, 0.95], ovan: [0, 0, 1.5] };
    var vy = 'horn', zoom = 1;
    // En smal ruta (mobilen) ser mindre på bredden - kameran backar.
    var rad = function () {
      var r = scen.getBoundingClientRect();
      return R * Math.max(1, 1.5 / ((r.width / r.height) || 1.5));
    };
    var orbit = function () {
      var v = VYER[vy];
      return v[0] + 'deg ' + v[1] + 'deg ' + (rad() * v[2] * zoom).toFixed(2) + 'm';
    };

    // Måttlinjerna ligger 0,7 m utanför väggarna, på de sidor kameran
    // ser (sx: vilken gavel, sz: fram- eller baksida): längden längs den
    // synliga långsidan, bredden längs den synliga gaveln, nockhöjden i
    // det bortre hörnet och människan framför huset.
    var PUNKTER = ['l0', 'l1', 'b0', 'b1', 'h0', 'h1', 'p0', 'p1'];
    function positioner(d, sx, sz) {
      var L = d.l / 2, B = d.b / 2, u = 0.7, pz = sz * (B + u + 1.3);
      return {
        l0: [-L, 0, sz * (B + u)], l1: [L, 0, sz * (B + u)],
        b0: [sx * (L + u), 0, -B], b1: [sx * (L + u), 0, B],
        h0: [-sx * (L + u), 0, sz * (B + u)], h1: [-sx * (L + u), d.h, sz * (B + u)],
        p0: [sx * (L - 1.4), 0, pz], p1: [sx * (L - 1.4), 1.8, pz]
      };
    }
    var sida = '', lager = $('.studio3d__lager', sek);

    // Talen räknas fram från förra huset till nästa.
    var nu = { yta: aktiv.yta, l: aktiv.l, b: aktiv.b, h: aktiv.h, rum: aktiv.rum };
    var talRaf = null;
    function raknaTal(d) {
      var fran = {}, till = { yta: d.yta, l: d.l, b: d.b, h: d.h, rum: d.rum };
      Object.keys(nu).forEach(function (k) { fran[k] = nu[k]; });
      var start = performance.now(), T = lugn ? 0 : 750;
      cancelAnimationFrame(talRaf);
      function steg(t) {
        var x = T ? Math.min(1, Math.max(0, (t - start) / T)) : 1;
        var e = 1 - Math.pow(1 - x, 3);
        talEl.forEach(function (el) {
          var k = el.getAttribute('data-3d-tal');
          nu[k] = x === 1 ? till[k] : fran[k] + (till[k] - fran[k]) * e;
          el.textContent = komma(nu[k], Number(el.getAttribute('data-dec')));
        });
        if (x < 1) talRaf = requestAnimationFrame(steg);
      }
      talRaf = requestAnimationFrame(steg);
    }

    var mv = null, laddad = false, bokad = false;
    function satt(el, x1, y1, x2, y2) {
      el.setAttribute('x1', x1.toFixed(1));
      el.setAttribute('y1', y1.toFixed(1));
      el.setAttribute('x2', x2.toFixed(1));
      el.setAttribute('y2', y2.toFixed(1));
    }
    function rita() {
      bokad = false;
      if (!mv || !laddad) return;
      var q = function (n) {
        var h = mv.queryHotspot('hotspot-' + n);
        return h && h.canvasPosition;
      };
      var orb = mv.getCameraOrbit(), phi = orb.phi;
      var ny = (Math.sin(orb.theta) < -0.001 ? '-' : '+') + (Math.cos(orb.theta) < 0 ? '-' : '+');
      if (ny !== sida) {
        // Kameran har gått runt ett hörn: måtten byter sida med en toning.
        sida = ny;
        flyttaPunkter();
        lager.classList.add('studio3d__lager--byt');
        setTimeout(function () { lager.classList.remove('studio3d__lager--byt'); boka(); }, 90);
        return;
      }
      // Golvrutnätet är ritat snett; rakt uppifrån tonar det bort.
      scen.classList.toggle('studio3d--uppifran', phi < 0.6);
      [['l', 'l0', 'l1'], ['b', 'b0', 'b1'], ['h', 'h0', 'h1']].forEach(function (x) {
        var a = q(x[1]), b = q(x[2]);
        var g = linjer[x[0]], et = etiketter[x[0]];
        var dx = a && b ? b.x - a.x : 0, dy = a && b ? b.y - a.y : 0;
        var len = Math.sqrt(dx * dx + dy * dy);
        // Rakt uppifrån syns ingen höjd, och en linje som ses från änden
        // blir en prick - då döljs den.
        var dold = !a || !b || len < 36 || (x[0] === 'h' && phi < 0.5);
        g[0].parentNode.style.opacity = dold ? '0' : '';
        et.style.opacity = dold ? '0' : '';
        if (dold) return;
        satt(g[0], a.x, a.y, b.x, b.y);
        var nx = -dy / len * 6, ny = dx / len * 6;
        satt(g[1], a.x - nx, a.y - ny, a.x + nx, a.y + ny);
        satt(g[2], b.x - nx, b.y - ny, b.x + nx, b.y + ny);
        et.style.transform = 'translate(' + ((a.x + b.x) / 2).toFixed(1) + 'px,' +
          ((a.y + b.y) / 2).toFixed(1) + 'px) translate(-50%,-50%)';
      });
      var fot = q('p0'), huvud = q('p1');
      if (fot && huvud && phi > 0.7) {
        var hojd = Math.sqrt(Math.pow(huvud.x - fot.x, 2) + Math.pow(huvud.y - fot.y, 2));
        person.style.opacity = '';
        person.style.transform = 'translate(' + (fot.x - 17.35).toFixed(1) + 'px,' + (fot.y - 100).toFixed(1) +
          'px) scale(' + (hojd / 100).toFixed(3) + ')';
      } else {
        person.style.opacity = '0';
      }
    }
    function boka() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(rita);
    }
    function flyttaPunkter() {
      var p = positioner(aktiv, sida.charAt(0) === '-' ? -1 : 1, sida.charAt(1) === '-' ? -1 : 1);
      PUNKTER.forEach(function (n) {
        mv.updateHotspot({
          name: 'hotspot-' + n,
          position: p[n].map(function (v) { return v.toFixed(3) + 'm'; }).join(' ')
        });
      });
    }

    function byt(d) {
      if (d === aktiv && laddad) return;
      aktiv = d;
      knappar.forEach(function (b) { b.setAttribute('aria-pressed', String(b === d.knapp)); });
      $('[data-3d-namn]', sek).textContent = d.namn;
      etiketter.l.textContent = komma(d.l, 2) + ' m';
      etiketter.b.textContent = komma(d.b, 2) + ' m';
      etiketter.h.textContent = 'Nock ' + komma(d.h, 2) + ' m';
      raknaTal(d);
      if (!mv) return;
      scen.classList.add('studio3d--byter');
      setTimeout(function () {
        if (aktiv === d) mv.src = 'modeller/hus-' + d.id + '.glb';
      }, lugn ? 0 : 260);
    }
    alla.forEach(function (d) {
      d.knapp.addEventListener('click', function () { byt(d); });
    });
    glidandeMarkering($('.studio3d__val', sek));
    glidandeMarkering($('.studio3d__vyer', sek));

    // Kameran går sakta runt huset tills man själv tar i det. (model-
    // viewers egen auto-rotate vrider modellen i stället för kameran, och
    // då hamnar vyerna och måttens sidor fel.)
    var snurrar = !lugn, synlig = false, snurrRaf = null, senast = 0;
    function snurra(t) {
      snurrRaf = null;
      if (!snurrar || !mv || !laddad || !synlig || document.hidden) { senast = 0; return; }
      if (senast) {
        var o = mv.getCameraOrbit();
        var d = Math.min(64, t - senast) / 1000 * 7 * Math.PI / 180;
        mv.cameraOrbit = (o.theta + d) + 'rad ' + o.phi + 'rad ' + o.radius + 'm';
      }
      senast = t;
      snurrRaf = requestAnimationFrame(snurra);
    }
    function startaSnurr() {
      if (!snurrRaf && snurrar) snurrRaf = requestAnimationFrame(snurra);
    }
    function stoppaSnurr() {
      snurrar = false;
      if (tips) tips.classList.add('studio3d__tips--borta');
    }
    vyKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        vy = b.getAttribute('data-vy');
        vyKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        stoppaSnurr();
        if (mv) mv.cameraOrbit = orbit();
      });
    });
    $$('[data-zoom]', sek).forEach(function (b) {
      b.addEventListener('click', function () {
        zoom = Math.max(0.6, Math.min(1.45, zoom * (b.getAttribute('data-zoom') === '1' ? 1.18 : 0.85)));
        stoppaSnurr();
        if (!mv) return;
        var o = mv.getCameraOrbit();
        mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + (rad() * VYER[vy][2] * zoom).toFixed(2) + 'm';
      });
    });
    $('[data-3d-aterstall]', sek).addEventListener('click', function () {
      vy = 'horn';
      zoom = 1;
      vyKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-vy') === 'horn')); });
      if (mv) mv.cameraOrbit = orbit();
    });
    mattKnapp.addEventListener('click', function () {
      var pa = mattKnapp.getAttribute('aria-pressed') !== 'true';
      mattKnapp.setAttribute('aria-pressed', String(pa));
      sek.classList.toggle('studio3d--utan-matt', !pa);
    });

    function bygg() {
      laddaModelViewer().then(function () {
        mv = document.createElement('model-viewer');
        var attr = {
          src: 'modeller/hus-' + aktiv.id + '.glb',
          alt: '3D-modell av ' + aktiv.namn + ' i skala 1:1',
          'camera-controls': '',
          'disable-zoom': '',
          'touch-action': 'pan-y',
          'camera-orbit': orbit(),
          'camera-target': '0m 1.1m 0m',
          'field-of-view': '30deg',
          'min-camera-orbit': 'auto 0deg ' + (rad() * 0.5).toFixed(1) + 'm',
          'max-camera-orbit': 'auto 88deg ' + (rad() * 1.6).toFixed(1) + 'm',
          'min-field-of-view': '30deg',
          'max-field-of-view': '30deg',
          'interpolation-decay': '160',
          'shadow-intensity': '1.15',
          'shadow-softness': '0.55',
          'environment-image': 'neutral',
          'tone-mapping': 'neutral',
          exposure: '1.05',
          'interaction-prompt': 'none'
        };
        Object.keys(attr).forEach(function (k) { mv.setAttribute(k, attr[k]); });
        PUNKTER.forEach(function (n) {
          var h = document.createElement('div');
          h.slot = 'hotspot-' + n;
          h.className = 'studio3d__punkt';
          h.setAttribute('data-position', '0m 0m 0m');
          h.setAttribute('data-normal', '0 1 0');
          mv.appendChild(h);
        });
        mv.addEventListener('progress', function (e) {
          if (progress) progress.style.transform = 'scaleX(' + (e.detail.totalProgress || 0).toFixed(3) + ')';
        });
        mv.addEventListener('load', function () {
          laddad = true;
          flyttaPunkter();
          mv.setAttribute('alt', '3D-modell av ' + aktiv.namn + ' i skala 1:1');
          sek.classList.add('studio3d--laddad');
          scen.classList.remove('studio3d--byter');
          requestAnimationFrame(function () { requestAnimationFrame(rita); });
          startaSnurr();
        });
        mv.addEventListener('camera-change', function (e) {
          if (e.detail && e.detail.source === 'user-interaction') stoppaSnurr();
          boka();
        });
        window.addEventListener('resize', boka);
        scen.insertBefore(mv, scen.firstChild);
        if (window.IntersectionObserver) {
          new IntersectionObserver(function (poster) {
            synlig = poster[0].isIntersecting && poster[0].intersectionRatio >= 0.45;
            startaSnurr();
          }, { threshold: [0, 0.45, 0.5] }).observe(scen);
        } else {
          synlig = true;
        }
        document.addEventListener('visibilitychange', startaSnurr);
      }).catch(function () {
        sek.classList.add('studio3d--fel');
        var t = $('[data-3d-laddar] span', sek);
        if (t) t.textContent = '3D-modellen kunde inte laddas.';
      });
    }
    narSynligt(sek, bygg, 0, '0px 0px 1200px 0px');
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
    // Knappen står i HTML:en så sidhuvudet inte flyttar sig när skriptet
    // laddat. Saknas den byggs den här.
    var fanns = $('.temaknapp', yta);
    var knapp = fanns || document.createElement('button');
    knapp.type = 'button';
    knapp.className = 'temaknapp';
    if (!fanns) knapp.innerHTML =
      '<svg class="temaknapp__sol" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>' +
      '<svg class="temaknapp__mane" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
    // Samma val finns som en tydlig rad i mobilmenyn - ikonen i
    // sidhuvudet är liten att träffa med tummen och lätt att missa.
    var meny = $('#mobile-nav');
    var rad = null;
    if (meny) {
      rad = document.createElement('button');
      rad.type = 'button';
      rad.className = 'mobile-nav__tema mmeny__tema';
      rad.innerHTML = '<span class="mobile-nav__tema-ikon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>Mörkt läge</span>' +
        '<span class="temavaxel" aria-hidden="true"></span>';
      var cta = $('.mmeny__cta, .mobile-nav__cta', meny);
      rad.style.setProperty('--i', (parseInt(cta.style.getPropertyValue('--i'), 10) || 8) - 1);
      cta.parentNode.insertBefore(rad, cta);
    }
    function uppdatera() {
      var mork = html.getAttribute('data-tema') === 'mork';
      knapp.setAttribute('aria-pressed', String(mork));
      knapp.setAttribute('aria-label', mork ? 'Byt till ljust läge' : 'Byt till mörkt läge');
      if (rad) rad.setAttribute('aria-pressed', String(mork));
      var tc = $('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', mork ? '#141310' : '#1b1915');
    }
    function vaxla() {
      var mork = html.getAttribute('data-tema') !== 'mork';
      if (!lugn) {
        html.classList.add('tema-byte');
        setTimeout(function () { html.classList.remove('tema-byte'); }, 600);
      }
      if (mork) html.setAttribute('data-tema', 'mork'); else html.removeAttribute('data-tema');
      lagra.spara('idealhus-tema', mork ? 'mork' : 'ljust');
      uppdatera();
    }
    knapp.addEventListener('click', vaxla);
    if (rad) rad.addEventListener('click', vaxla);
    if (!fanns) yta.insertBefore(knapp, yta.firstChild);
    uppdatera();
  })();

  /* --- Tal som räknas upp --------------------------------------- */
  // Det riktiga talet står kvar för skärmläsare, översättning och
  // utskrift; bara en synlig kopia räknas upp.
  $$('[data-rakna]').forEach(function (el) {
    var mal = Number(el.getAttribute('data-rakna'));
    if (lugn || !mal) return;
    var vy = document.createElement('span');
    vy.setAttribute('aria-hidden', 'true');
    vy.textContent = '0';
    var sr = document.createElement('span');
    sr.className = 'field__dold';
    sr.textContent = el.textContent;
    el.textContent = '';
    el.appendChild(vy);
    el.appendChild(sr);
    narSynligt(el, function () {
      var start = performance.now();
      (function steg(nu) {
        var t = Math.min(1, (nu - start) / 1400);
        vy.textContent = Math.round(mal * (1 - Math.pow(1 - t, 3)));
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
        }).catch(function () {
          // Webbläsaren nekade: markera adressen så den går att kopiera själv.
          var r = document.createRange();
          r.selectNodeContents(a);
          var val = window.getSelection();
          val.removeAllRanges();
          val.addRange(r);
          knapp.textContent = 'Markerad';
          setTimeout(function () { knapp.textContent = 'Kopiera'; }, 2400);
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
    // Kategorin först i namnet: "Huskort 2" finns i båda kategorierna.
    var meta = $('.subpage-hero__meta');
    var kat = meta ? meta.textContent.split('·')[0].trim() : '';
    var helt = namn ? namn.textContent.trim() : '';
    if (helt && /^(Attefallshus|Fritidshus)$/.test(kat)) helt = kat + ', ' + helt.toLowerCase();
    if (yta) {
      ryms.href = 'vad-far-jag-bygga.html?yta=' + yta +
        (helt ? '&namn=' + encodeURIComponent(helt) : '');
    }
  }

  /* --- Tipset om verktyget -------------------------------------
     Som Kasters lanseringsnotis: visas en gång efter halva sidan,
     aldrig där det redan finns ett formulär eller verktyget självt,
     och inte igen på fjorton dagar efter att man stängt det. */
  var utan = ['index.html', '', 'huskort.html', 'priser.html', 'aga-och-hyra-ut.html', 'vad-far-jag-bygga.html', 'kontakt.html', '404.html', 'integritetspolicy.html', 'attefallshus-regler.html', 'proffs.html'];
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
      // Sidans höjd läses en gång (och vid storleksändring), inte vid
      // varje rullningshändelse.
      var sidhojd = document.documentElement.scrollHeight;
      window.addEventListener('resize', function () { sidhojd = document.documentElement.scrollHeight; });
      var kolla = function () {
        var andel = (window.scrollY + window.innerHeight) / sidhojd;
        if (andel < 0.5) return;
        window.removeEventListener('scroll', kolla);
        tips.hidden = false;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { tips.classList.add('tipsruta--synlig'); });
        });
      };
      window.addEventListener('scroll', kolla, { passive: true });

      // Kontaktsektionen är redan samma uppmaning, och stegen och
      // checklistan på Så fungerar det ska läsas i lugn och ro - där går
      // tipset undan.
      var undan = $$('.contact-section, .flode, .checklista, .segment--tak, .siffror, .site-footer, .studio3d, .ih-fragor');
      if (undan.length && window.IntersectionObserver) {
        var iVagen = [], tipsTimer = 0;
        var io = new IntersectionObserver(function (poster) {
          poster.forEach(function (p) {
            var i = iVagen.indexOf(p.target);
            if (p.isIntersecting && i < 0) iVagen.push(p.target);
            if (!p.isIntersecting && i >= 0) iVagen.splice(i, 1);
          });
          clearTimeout(tipsTimer);
          if (iVagen.length) tips.classList.add('tipsruta--undan');
          else tipsTimer = setTimeout(function () { tips.classList.remove('tipsruta--undan'); }, 500);
        }, { rootMargin: '0px 0px -20% 0px' });
        undan.forEach(function (u) { io.observe(u); });
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
    // Toppbilderna har kopian redan i HTML:en.
    var bak = $('.helbild__bak', ram);
    if (!bak) {
      bak = document.createElement('img');
      bak.className = 'helbild__bak';
      bak.alt = '';
      bak.setAttribute('aria-hidden', 'true');
      bak.decoding = 'async';
      if (img.getAttribute('loading') === 'lazy') bak.loading = 'lazy';
      bak.src = img.getAttribute('src');
      ram.insertBefore(bak, img);
    }
    ram.classList.add('helbild');
    // Huskortet byter bild efter modell - kopian följer med.
    new MutationObserver(function () { bak.src = img.getAttribute('src'); })
      .observe(img, { attributes: true, attributeFilter: ['src'] });
  });
  /* --- Vägen dit: resan i tre skeden -----------------------------
     Scenen till vänster bygger huset i takt med skedet: ritning,
     stomme under tak, klart på tomten. Skedena bläddrar själva när
     de syns, pausar när man pekar på dem och slutar bläddra när man
     väljer själv. Vi/Du/Tillsammans markerar vem som gör vad. */
  (function () {
    var resa = $('[data-resa]');
    if (!resa) return;
    var scen = $('.resa3d', resa);
    var skeden = $$('.resa__skede', resa);
    var etikett = $('[data-resa-etikett]', resa);
    var etikettNr = $('.resa__etikett-nr', resa);
    var ETIKETT = ['Ritning och underlag', 'Stommen reses under tak', 'Klart på tomten'];
    var TID = 7000;
    var aktiv = 0, spelar = !lugn, synlig = false, pekar = false, timer;

    resa.style.setProperty('--resatid', TID + 'ms');
    resa.classList.add('resa--klar');

    function visa(i) {
      aktiv = i;
      scen.setAttribute('data-skede', String(i + 1));
      resa.setAttribute('data-skede', String(i + 1));
      etikett.textContent = ETIKETT[i];
      etikettNr.textContent = '0' + (i + 1);
      skeden.forEach(function (s, j) {
        $('.resa__knapp', s).setAttribute('aria-expanded', String(j === i));
        s.classList.toggle('resa__skede--aktiv', j === i);
        s.classList.toggle('resa__skede--klar', j < i);
      });
      starta();
    }

    // Tidslinjen startar om för varje skede; när den är full kommer nästa.
    function starta() {
      clearTimeout(timer);
      resa.classList.remove('resa--spelar');
      if (!spelar || !synlig || pekar) return;
      void resa.offsetWidth;
      resa.classList.add('resa--spelar');
      timer = setTimeout(function () { visa((aktiv + 1) % skeden.length); }, TID);
    }

    skeden.forEach(function (s, i) {
      $('.resa__knapp', s).addEventListener('click', function () {
        spelar = false;
        visa(i);
      });
    });

    resa.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') { pekar = true; starta(); }
    });
    resa.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') { pekar = false; starta(); }
    });
    resa.addEventListener('focusin', function () { spelar = false; starta(); });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (poster) {
        synlig = poster[0].isIntersecting;
        starta();
      }, { threshold: 0.35 }).observe(resa);
    }
    pausaUtanforVy(resa);
    lutaI3D($('.resa__scen', resa), 10);

    var vemKnappar = $$('.resa__vem button', resa);
    vemKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        var pa = b.getAttribute('aria-pressed') !== 'true';
        vemKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b && pa)); });
        var vem = pa ? b.getAttribute('data-vem') : '';
        if (vem) resa.setAttribute('data-vem', vem); else resa.removeAttribute('data-vem');
        // Hur många moment i varje skede som är ens - syns på knappen.
        skeden.forEach(function (s) {
          var antal = $('.resa__antal', s);
          var n = vem ? $$('.resa__moment [data-vem="' + vem + '"]', s).length : 0;
          antal.textContent = String(n);
          antal.hidden = !n;
        });
      });
    });

    visa(0);
  })();
  /* --- Menyerna: var man är, Esc och bakåtknappen ---------------
     Länken till sidan man står på märks med aria-current, så att både
     skärmläsare och mobilmenyn visar var man är. Esc stänger mobil-
     menyn. Går man bakåt visar webbläsaren sidan ur sitt minne - med
     menyn öppen och sidan låst - så då stängs den. */
  (function () {
    var sidan = location.pathname.split('/').pop() || 'index.html';
    $$('.main-nav a, .mmeny a').forEach(function (a) {
      if (a.getAttribute('href') === sidan) a.setAttribute('aria-current', 'page');
    });
    // Sidornas egna skript slår av och på menyn direkt (hidden). Knappen
    // byts mot en kopia utan deras lyssnare, så att menyn kan glida fram
    // och tillbaka i stället (2026-09-30, design.css 23).
    var gammal = $('.menu-button');
    var panel = $('#mobile-nav');
    if (!gammal || !panel) return;
    var knapp = gammal.cloneNode(true);
    gammal.parentNode.replaceChild(knapp, gammal);
    var html = document.documentElement;
    var timer = 0;
    function oppen() { return knapp.getAttribute('aria-expanded') === 'true'; }
    function satt(oppna, direkt) {
      knapp.setAttribute('aria-expanded', String(oppna));
      knapp.setAttribute('aria-label', oppna ? 'Stäng meny' : 'Öppna meny');
      knapp.classList.toggle('menu-button--open', oppna);
      html.classList.toggle('meny-oppen', oppna);
      // Sidans rullelement är <html>; utan lås rullar sidan bakom menyn.
      html.style.overflow = oppna ? 'hidden' : '';
      clearTimeout(timer);
      // Sidan bakom menyn går inte att nå med tangentbord eller skärmläsare.
      ['main', '.site-footer', '.tipsruta', '#cta-bar'].forEach(function (s) {
        var e = $(s);
        if (e) e.inert = oppna;
      });
      if (oppna) {
        panel.hidden = false;
        void panel.offsetWidth;
        panel.classList.add('mmeny--oppen');
        var p = $('.mmeny__panel', panel);
        if (p) p.scrollTop = 0;
      } else {
        panel.classList.remove('mmeny--oppen');
        if (direkt || lugn) panel.hidden = true;
        else timer = setTimeout(function () { panel.hidden = true; }, 460);
      }
    }
    knapp.addEventListener('click', function () { satt(!oppen()); });
    // Ett tryck utanför kortet stänger; en länk stänger också.
    panel.addEventListener('click', function (e) {
      if (e.target === panel || e.target.closest('a')) satt(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && oppen()) {
        satt(false);
        knapp.focus();
      }
      // Tab går runt mellan menyknappen och menyns länkar.
      if (e.key === 'Tab' && oppen()) {
        var alla = [knapp].concat($$('a[href], button:not([disabled])', panel).filter(function (x) { return x.offsetParent !== null; }));
        var i = alla.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); alla[alla.length - 1].focus(); }
        else if (!e.shiftKey && i === alla.length - 1) { e.preventDefault(); alla[0].focus(); }
      }
    });
    // Bakåt visar sidan ur minnet - med menyn öppen och sidan låst.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && oppen()) satt(false, true);
    });
    var bred = window.matchMedia('(min-width: 1041px)');
    var nyBredd = function (m) { if (m.matches && oppen()) satt(false, true); };
    if (bred.addEventListener) bred.addEventListener('change', nyBredd);
  })();

  /* --- Rullgardinen "Våra hus" --------------------------------------
     Med mus öppnas den redan när pekaren kommer dit; ett klick ska då
     inte stänga den igen. Tabbar man ut ur den stängs den. (Sidornas
     egna skript sköter resten.) */
  (function () {
    var item = $('[data-dropdown]');
    if (!item) return;
    var knapp = $('.main-nav__toggle', item);
    if (!knapp) return;
    var hover = window.matchMedia('(hover: hover)');
    knapp.addEventListener('click', function (e) {
      if (hover.matches && e.detail > 0 && item.classList.contains('main-nav__item--open')) {
        e.stopImmediatePropagation();
      }
    }, true);
    item.addEventListener('focusout', function (e) {
      if (item.contains(e.relatedTarget)) return;
      item.classList.remove('main-nav__item--open');
      knapp.setAttribute('aria-expanded', 'false');
    });
  })();

  /* ============================================================
     Andra upplagan (2026-09-30): Kaster/Uperformance-formen.
     Allt rör bara transform och opacity, pausas utanför vyn och
     stängs av vid prefers-reduced-motion.
     ============================================================ */

  /* --- Toppen: filmen i rubriken ---------------------------------
     Rullningen genom toppen driver ett tal p från 0 till 1:
       0 - 0,45  ytan med rubriken zoomar in genom "l":et, filmen tar över
       0,40 - 0,6  en mörk toning läggs över filmen
       0,48 - 0,7  budskapet tonar fram
     Ytan med de urklippta bokstäverna ritas på en canvas och bara bilden
     skalas (att skala en HTML-yta med mix-blend-mode ritade om texten i
     varje bildruta och hackade kraftigt). När sidan öppnas ritas
     rubriken fram: konturerna dras som med en penna och bokstäverna
     fylls en i taget med filmen medan de glider på plats. Därefter
     sveper en färgvåg i virke och bärnsten genom bokstäverna
     (.film__farg, ren CSS-förflyttning), och filmen i bokstäverna
     följer pekaren en aning. HTML-rubriken står kvar för skärmläsare.
     Vid lugn rörelse står toppen kvar som en vanlig film med rubriken. */
  (function () {
    var topp = $('[data-film]');
    if (!topp || lugn || !window.requestAnimationFrame) return;
    var spar = $('.film__spar', topp);
    var fast = $('.film__fast', topp);
    var mask = $('.film__mask', topp);
    var rubrik = $('.film__rubrik', topp);
    var video = $('.film__video', topp);
    var ui = $('.film__ui', topp);
    var efter = $('.film__efter', topp);
    var slojor = $('.film__slojor', topp);
    var ton = $('.film__ton', topp);
    var farg = $('.film__farg', topp);
    if (!spar || !mask || !rubrik) return;
    topp.classList.add('film--zoom');

    var vagg = document.createElement('div');
    vagg.className = 'film__dukvagg';
    vagg.setAttribute('aria-hidden', 'true');
    var duk = document.createElement('canvas');
    duk.className = 'film__duk';
    vagg.appendChild(duk);
    mask.parentNode.insertBefore(vagg, mask.nextSibling);
    var bak = document.createElement('canvas');
    var overlager = [], introAnim = [];

    var RADER = ['Från virke', 'till verklighet.'];
    // "l":et i "verklighet" - rad 2, efter "till verk".
    var ZOOM_RAD = 1, ZOOM_FORE = 'till verk';
    var maxS = 40, bokad = false, klar = false, forraP = -1;
    var skrivet = new Map();
    var L = null;          // uppmätt layout: bredd, höjd, tecken och deras lägen
    function klamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function mjuk(t) { return 1 - Math.pow(1 - t, 3); }

    // Skriver bara när värdet ändrats - varje skrivning kostar.
    function satt(el, egenskap, varde) {
      var nyckel = skrivet.get(el);
      if (!nyckel) { nyckel = {}; skrivet.set(el, nyckel); }
      if (nyckel[egenskap] === varde) return;
      nyckel[egenskap] = varde;
      el.style[egenskap] = varde;
    }

    function glod(c, x, y, r, f) {
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, f);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Mäter upp allt en gång och ritar bakgrunden (yta, glöd, rutnät)
    // på en egen canvas som sedan bara kopieras in.
    function mat() {
      var w = fast.clientWidth, h = fast.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      [duk, bak].forEach(function (d) {
        d.width = Math.round(w * dpr);
        d.height = Math.round(h * dpr);
      });
      duk.style.width = w + 'px';
      duk.style.height = h + 'px';
      var mork = document.documentElement.getAttribute('data-tema') === 'mork';

      var b = bak.getContext('2d');
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = mork ? '#141310' : '#f7f5f0';
      b.fillRect(0, 0, w, h);
      var st = Math.max(w, h);
      glod(b, w * 0.06, h * 0.04, st * 0.55, mork ? 'rgba(184,205,224,0.10)' : 'rgba(184,205,224,0.55)');
      glod(b, w * 0.98, h * 0.18, st * 0.5, mork ? 'rgba(240,181,110,0.12)' : 'rgba(240,181,110,0.32)');
      b.strokeStyle = mork ? 'rgba(247,245,240,0.05)' : 'rgba(27,25,21,0.06)';
      b.lineWidth = 1;
      b.beginPath();
      for (var x = (w / 2) % 44; x < w; x += 44) { b.moveTo(Math.round(x) + 0.5, 0); b.lineTo(Math.round(x) + 0.5, h); }
      for (var y = (h / 2) % 44; y < h; y += 44) { b.moveTo(0, Math.round(y) + 0.5); b.lineTo(w, Math.round(y) + 0.5); }
      b.stroke();

      var c = duk.getContext('2d');
      var fs = parseFloat(getComputedStyle(rubrik).fontSize);
      var sparr = -0.055 * fs;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.font = '700 ' + fs + 'px Poppins';
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.textBaseline = 'alphabetic';
      var m = c.measureText('Hg');
      var upp = m.actualBoundingBoxAscent || fs * 0.72;
      var ner = m.actualBoundingBoxDescent || fs * 0.2;
      var lh = fs * 0.9;
      var blockTopp = h / 2 - (lh * RADER.length) / 2;
      var tecken = [];
      var ox = w / 2, oy = h / 2, stam = 8;
      RADER.forEach(function (rad, i) {
        var x = 0, pos = [];
        for (var j = 0; j < rad.length; j++) {
          var bb = c.measureText(rad[j]).width;
          pos.push([x, x + bb]);
          x += bb + sparr;
        }
        var x0 = w / 2 - pos[pos.length - 1][1] / 2;
        var bas = blockTopp + lh * i + lh / 2 + (upp - ner) / 2;
        pos.forEach(function (t, j) {
          if (rad[j] !== ' ') tecken.push({ t: rad[j], x: x0 + t[0], y: bas, rad: i, b: t[1] - t[0] });
        });
        if (i === ZOOM_RAD) {
          var l = pos[ZOOM_FORE.length];
          ox = x0 + (l[0] + l[1]) / 2;
          oy = bas - upp * 0.5;
          stam = Math.max(3, (l[1] - l[0]) * 0.42);
        }
      });
      L = { w: w, h: h, dpr: dpr, fs: fs, tecken: tecken, mork: mork };
      maxS = Math.min(90, Math.hypot(w, h) * 2.2 / stam);
      vagg.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
      skrivet.delete(vagg);
    }

    // Ritar ytan EN gång: bakgrunden med bokstäverna urklippta, och
    // konturen i vilotillståndet (kontur = dess opacitet, 0 = ingen).
    function konturFarg() { return L.mork ? 'rgba(247,245,240,0.85)' : 'rgba(27,25,21,0.85)'; }
    function rita_duk(kontur) {
      // En dold flik kan ge ytan storleken 0 – då finns inget att rita.
      if (!L || !bak.width || !bak.height || !duk.width || !duk.height) return;
      var c = duk.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'copy';
      c.globalAlpha = 1;
      c.drawImage(bak, 0, 0);
      c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      c.font = '700 ' + L.fs + 'px Poppins';
      c.textBaseline = 'alphabetic';
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      L.tecken.forEach(function (tk) { c.fillText(tk.t, tk.x, tk.y); });
      if (kontur) {
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = kontur;
        c.strokeStyle = konturFarg();
        c.lineWidth = Math.max(1, L.fs * 0.012);
        L.tecken.forEach(function (tk) { c.strokeText(tk.t, tk.x, tk.y); });
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }

    /* Introt - helt på grafikkortet. Förra versionen ritade om hela ytan
       (full skärm, dubbel upplösning, streckade konturer) i varje
       bildruta i 2,2 s medan filmen och typsnitten laddade, och hackade.
       Nu ritas allt en gång innan det börjar: ytan med hålen, en liten
       täckbit per bokstav (bokstaven fylld med bakgrunden precis där) och
       konturerna per rad. Sedan rör sig bara lagren med transform och
       opacitet (Web Animations), som går på kompositorn även när
       huvudtråden är upptagen: konturen sveps fram rad för rad bakom en
       mjuk kant, täckbitarna krymper uppåt en i taget så att filmen fyller
       bokstaven nerifrån, och konturen tonar ner. Till sist bakas den
       tunna konturen in i ytan och lagren tas bort. */
    function rensaIntro() {
      introAnim.forEach(function (a) { a.cancel(); });
      introAnim = [];
      overlager.forEach(function (el) { el.remove(); });
      overlager = [];
    }
    function avslutaIntro() {
      rensaIntro();
      rita_duk(0.22);
    }
    function spelaIntro() {
      if (!L || !vagg.animate) { avslutaIntro(); return; }
      rensaIntro();
      rita_duk(0);
      var dpr = L.dpr, fs = L.fs, lw = Math.max(1, fs * 0.012), pad = Math.ceil(lw + 3);
      var font = '700 ' + fs + 'px Poppins';
      var matare = duk.getContext('2d');
      matare.setTransform(dpr, 0, 0, dpr, 0, 0);
      matare.font = font;
      var frag = document.createDocumentFragment();

      function lager(klass, x0, y0, x1, y1) {
        var cv = document.createElement('canvas');
        cv.className = klass;
        cv.width = Math.round((x1 - x0) * dpr);
        cv.height = Math.round((y1 - y0) * dpr);
        var g = cv.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
        g.font = font;
        g.textBaseline = 'alphabetic';
        return { cv: cv, g: g };
      }
      function placera(el, x0, y0, x1, y1) {
        el.style.left = x0 + 'px';
        el.style.top = y0 + 'px';
        el.style.width = (x1 - x0) + 'px';
        el.style.height = (y1 - y0) + 'px';
      }

      // Täckbitarna: bokstaven fylld med bakgrunden där den sitter.
      L.tecken.forEach(function (tk) {
        var m = matare.measureText(tk.t);
        var x0 = Math.floor(tk.x - (m.actualBoundingBoxLeft || 0) - pad);
        var x1 = Math.ceil(tk.x + (m.actualBoundingBoxRight || tk.b) + pad);
        var y0 = Math.floor(tk.y - (m.actualBoundingBoxAscent || fs * 0.8) - pad);
        var y1 = Math.ceil(tk.y + (m.actualBoundingBoxDescent || fs * 0.2) + pad);
        var l = lager('film__tacke', x0, y0, x1, y1);
        // Bokstaven plus en tunn kant, så att täckbiten också täcker
        // hålets mjuka kant - annars syns filmen som en skugga runt den.
        l.g.fillText(tk.t, tk.x, tk.y);
        l.g.lineWidth = 2;
        l.g.lineJoin = 'round';
        l.g.strokeText(tk.t, tk.x, tk.y);
        l.g.setTransform(1, 0, 0, 1, 0, 0);
        l.g.globalCompositeOperation = 'source-in';
        l.g.drawImage(bak, Math.round(x0 * dpr), Math.round(y0 * dpr), l.cv.width, l.cv.height, 0, 0, l.cv.width, l.cv.height);
        placera(l.cv, x0, y0, x1, y1);
        frag.appendChild(l.cv);
        overlager.push(l.cv);
        tk.tacke = l.cv;
      });

      // Konturerna: en duk per rad i ett fönster med mjuk högerkant.
      var rader = [];
      L.tecken.forEach(function (tk) { (rader[tk.rad] = rader[tk.rad] || []).push(tk); });
      rader = rader.filter(Boolean).map(function (lista) {
        var sist = lista[lista.length - 1];
        var x0 = Math.floor(lista[0].x - fs * 0.08), x1 = Math.ceil(sist.x + sist.b + fs * 0.08 + 90);
        var y0 = Math.floor(lista[0].y - fs * 1.02), y1 = Math.ceil(lista[0].y + fs * 0.32);
        var fonster = document.createElement('div');
        fonster.className = 'film__konturfonster';
        placera(fonster, x0, y0, x1, y1);
        var l = lager('film__kontur', x0, y0, x1, y1);
        l.g.strokeStyle = konturFarg();
        l.g.lineWidth = lw;
        l.g.lineJoin = 'round';
        lista.forEach(function (tk) { l.g.strokeText(tk.t, tk.x, tk.y); });
        // Dolda från start - rörelsen börjar två bildrutor senare.
        fonster.style.transform = 'translateX(-100%)';
        l.cv.style.transform = 'translateX(100%)';
        fonster.appendChild(l.cv);
        frag.appendChild(fonster);
        overlager.push(fonster);
        return { fonster: fonster, duk: l.cv };
      });
      vagg.appendChild(frag);

      // Två bildrutor senare, när lagren finns på skärmen, börjar rörelsen.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!overlager.length) return;
          var n = L.tecken.length;
          rader.forEach(function (r, i) {
            var d = 60 + i * 280;
            introAnim.push(r.fonster.animate([{ transform: 'translateX(-100%)' }, { transform: 'none' }],
              { duration: 1200, delay: d, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }));
            introAnim.push(r.duk.animate([{ transform: 'translateX(100%)' }, { transform: 'none' }],
              { duration: 1200, delay: d, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }));
            introAnim.push(r.fonster.animate([{ opacity: 1 }, { opacity: 0.22 }],
              { duration: 900, delay: 1650 + i * 140, easing: 'ease-out', fill: 'both' }));
          });
          L.tecken.forEach(function (tk, k) {
            introAnim.push(tk.tacke.animate([
              { transform: 'scaleY(1)', opacity: 1 },
              { transform: 'scaleY(0)', opacity: 0.35 }
            ], { duration: 1000, delay: 380 + (k / n) * 950, easing: 'cubic-bezier(0.7, 0, 0.25, 1)', fill: 'both' }));
          });
          Promise.all(introAnim.map(function (a) { return a.finished; }))
            .then(avslutaIntro, function () {});
        });
      });
    }

    function rita() {
      bokad = false;
      var r = spar.getBoundingClientRect();
      var langd = spar.offsetHeight - fast.offsetHeight;
      var p = langd > 0 ? klamp(-r.top / langd) : 0;
      if (p === forraP) return;
      forraP = p;

      var z = klamp(p / 0.45);
      var e = z * z * z;
      if (klar) {
        satt(vagg, 'transform', 'scale(' + (1 + e * (maxS - 1)).toFixed(3) + ')');
        satt(vagg, 'opacity', z > 0.82 ? (1 - (z - 0.82) / 0.18).toFixed(3) : '1');
        satt(vagg, 'visibility', z >= 1 ? 'hidden' : 'visible');
      }

      var u = klamp(p / 0.12);
      satt(ui, 'opacity', (1 - u).toFixed(3));
      satt(ui, 'transform', 'translate3d(0,' + (-u * 40).toFixed(1) + 'px,0)');
      satt(ui, 'visibility', u >= 1 ? 'hidden' : 'visible');

      var tona = (1 - klamp((z - 0.55) / 0.4)).toFixed(3);
      satt(ton, 'opacity', tona);
      if (farg) {
        satt(farg, 'opacity', tona);
        satt(farg, 'visibility', tona === '0.000' ? 'hidden' : 'visible');
      }
      satt(slojor, 'opacity', klamp((p - 0.4) / 0.2).toFixed(3));

      var ef = klamp((p - 0.48) / 0.22);
      satt(efter, 'opacity', ef.toFixed(3));
      satt(efter, 'transform', 'translate3d(0,' + ((1 - ef) * 40).toFixed(1) + 'px,0)');
      satt(efter, 'visibility', ef <= 0 ? 'hidden' : 'visible');
    }

    function boka() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(rita);
    }

    rita();
    // Canvasen ritas när rubrikens typsnitt finns, annars blir
    // bokstäverna i reservtypsnittet.
    var typsnitt = document.fonts && document.fonts.load
      ? document.fonts.load('700 100px Poppins').catch(function () {}) : Promise.resolve();
    typsnitt.then(function () {
      mat();
      klar = true;
      // Introt spelas bara om man står i toppen - kommer man tillbaka
      // till sidan halvvägs ner är rubriken redan klar.
      if (window.scrollY < window.innerHeight * 0.3) spelaIntro();
      else avslutaIntro();
      topp.classList.add('film--duk');
      forraP = -1;
      rita();
    });

    var storlek = window.innerWidth + 'x' + window.innerHeight;
    window.addEventListener('resize', function () {
      // Mobilens adressfält ändrar höjden lite när man rullar - rita
      // bara om när bredden ändras eller höjden ändras mycket.
      var gammal = storlek.split('x');
      if (+gammal[0] === window.innerWidth && Math.abs(+gammal[1] - window.innerHeight) < 140) return;
      storlek = window.innerWidth + 'x' + window.innerHeight;
      if (klar) { mat(); avslutaIntro(); }
      forraP = -1;
      rita();
    });
    window.addEventListener('scroll', boka, { passive: true });
    // Byter man tema ritas ytan om i rätt färg.
    new MutationObserver(function () { if (klar) { mat(); avslutaIntro(); } })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

    // Filmen i bokstäverna följer pekaren en aning - som fönster.
    if (finPekare && video) {
      var mx = 0, my = 0, vx = 0, vy = 0, gar = false;
      topp.addEventListener('pointermove', function (ev) {
        mx = ev.clientX / window.innerWidth - 0.5;
        my = ev.clientY / window.innerHeight - 0.5;
        if (!gar) { gar = true; requestAnimationFrame(glid); }
      });
      function glid() {
        vx += (mx - vx) * 0.08;
        vy += (my - vy) * 0.08;
        video.style.transform = 'translate3d(' + (-vx * 28).toFixed(2) + 'px,' + (-vy * 18).toFixed(2) + 'px,0) scale(1.06)';
        if (Math.abs(mx - vx) > 0.001 || Math.abs(my - vy) > 0.001) requestAnimationFrame(glid);
        else gar = false;
      }
    }
  })();

  // De mörka elitkorten och kantstrimman pausas när de inte syns.
  $$('.siffror, .film__fast').forEach(pausaUtanforVy);
  $$('#innehall > section, #innehall > div, .site-footer').forEach(pausaUtanforVy);

  /* --- Bildkorten lutar i 3D och ljuset följer pekaren ----------- */
  $$('.vag').forEach(function (k) { lutaI3D(k, 7); });
  $$('.skal').forEach(function (k) { lutaI3D(k, 9); });

  /* --- Banorna: husen och bakom kulisserna -----------------------
     Korten vrider sig efter var de står i banan - det i mitten står
     rakt, de vid kanterna vänder sig inåt som i en karusell. Pilarna
     bläddrar ett kort i taget, och med mus kan man dra banan. */
  $$('[data-bana]').forEach(function (bana) {
    var sektion = bana.closest('section');
    var kort = $$(':scope > li', bana);
    if (!kort.length) return;

    function steg() {
      var a = kort[0].getBoundingClientRect();
      var b = kort[1] ? kort[1].getBoundingClientRect() : a;
      return Math.max(200, b.left - a.left);
    }
    var bak = $('[data-bana-bak]', sektion);
    var fram = $('[data-bana-fram]', sektion);
    if (bak) bak.addEventListener('click', function () { bana.scrollBy({ left: -steg(), behavior: lugn ? 'auto' : 'smooth' }); });
    if (fram) fram.addEventListener('click', function () { bana.scrollBy({ left: steg(), behavior: lugn ? 'auto' : 'smooth' }); });

    function uppdateraPilar() {
      if (bak) bak.disabled = bana.scrollLeft < 4;
      if (fram) fram.disabled = bana.scrollLeft > bana.scrollWidth - bana.clientWidth - 4;
    }

    var bokad = false;
    function vrid() {
      bokad = false;
      uppdateraPilar();
      if (lugn) return;
      var mitt = window.innerWidth / 2;
      kort.forEach(function (k) {
        var r = k.getBoundingClientRect();
        var d = (r.left + r.width / 2 - mitt) / window.innerWidth;
        d = Math.max(-1, Math.min(1, d));
        k.style.setProperty('--vinkel', (-d * 16).toFixed(2) + 'deg');
        k.style.setProperty('--djup', (-Math.abs(d) * 80).toFixed(1) + 'px');
      });
    }
    function boka() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(vrid);
    }
    bana.addEventListener('scroll', boka, { passive: true });
    window.addEventListener('resize', boka);
    vrid();

    // Dra med musen (pekskärmar sveper själva).
    if (bana.hasAttribute('data-dra') && finPekare) {
      var drar = false, startX = 0, startL = 0, flyttat = 0;
      bana.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        drar = true;
        flyttat = 0;
        startX = e.clientX;
        startL = bana.scrollLeft;
        bana.classList.add('drar');
      });
      window.addEventListener('pointermove', function (e) {
        if (!drar) return;
        flyttat = Math.abs(e.clientX - startX);
        bana.scrollLeft = startL - (e.clientX - startX);
      });
      window.addEventListener('pointerup', function () {
        if (!drar) return;
        drar = false;
        bana.classList.remove('drar');
      });
      bana.addEventListener('click', function (e) {
        if (flyttat > 6) { e.preventDefault(); e.stopPropagation(); }
      }, true);
      bana.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }
  });

  /* --- Bygget: bildberättelsen -----------------------------------
     Rullningen genom sektionen driver ett tal från 0 till 4. Nästa bild
     avslöjas nerifrån som en ridå: fönstret (kortet) glider upp och
     bilden inuti glider tillbaka lika mycket, så bilden står still
     medan kanten sveper över - med en guldlinje i kanten. Bilden som
     täcks glider lite uppåt och mörknar, och den som visas zoomar
     långsamt ut. Till vänster rullar siffran fram som ett räkneverk,
     stegets ord reser sig ur en mask (uppifrån när man rullar tillbaka)
     och staplarna fylls - de går att klicka på. Bara transform och
     opacitet per bildruta. Smalt eller lugnt: lista och bildkarusell. */
  (function () {
    var bygget = $('[data-bygget]');
    if (!bygget) return;
    var spar = $('.bygget__spar', bygget);
    var kort = $$('.bygget__kort', bygget);
    var steg = $$('.bygget__steg', bygget);
    var rulle = $('.bygget__rulle', bygget);
    var staplar = $$('[data-bygget-hopp]', bygget);
    var fyllning = staplar.map(function (b) { return $('b', b); });
    var n = kort.length;
    var bred = window.matchMedia('(min-width: 901px)');
    var aktivt = -1, bokad = false, pa = false, forraAndel = -1;

    var bilder = [], skuggor = [], svep = [];
    function lager(k, klass) {
      var el = document.createElement('i');
      el.className = klass;
      el.setAttribute('aria-hidden', 'true');
      k.appendChild(el);
      return el;
    }
    kort.forEach(function (k) {
      bilder.push($('img', k));
      skuggor.push(lager(k, 'bygget__skugga'));
      svep.push(lager(k, 'bygget__svep'));
    });

    // Varje ord i en egen mask.
    steg.forEach(function (s) {
      $$('.bygget__titel, .bygget__text', s).forEach(function (el) {
        var ord = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        ord.forEach(function (o, k) {
          var mask = document.createElement('span');
          mask.className = 'bw';
          var inne = document.createElement('span');
          inne.style.setProperty('--w', k);
          inne.textContent = o;
          mask.appendChild(inne);
          if (k) el.appendChild(document.createTextNode(' '));
          el.appendChild(mask);
        });
      });
    });

    function klamp(v) {
      return Math.min(1, Math.max(0, v));
    }

    function rita() {
      bokad = false;
      if (!pa) return;
      var r = spar.getBoundingClientRect();
      var langd = r.height - window.innerHeight;
      var andel = langd > 0 ? Math.min(1, Math.max(0, -r.top / langd)) : 0;
      if (andel === forraAndel) return;
      forraAndel = andel;
      // Varje steg står still en stor del av sträckan och byter i mitten.
      var q = andel * (n - 1);
      var hel = Math.floor(q);
      var t0 = klamp((q - hel - 0.25) / 0.5);
      var p = Math.min(n - 1, hel + t0 * t0 * (3 - 2 * t0));

      kort.forEach(function (k, i) {
        var d = i - p;
        var zoom = 1.1 - 0.1 * klamp((q - i + 1) / 2);
        var yk = 0, yb = 0, sk = 0, sv = 0, syns = true;
        if (d >= 1) {
          syns = false;
        } else if (d > 0) {
          yk = d * 100;
          yb = -d * 100;
          sv = Math.min(1, d * 6, (1 - d) * 6);
        } else if (d > -1) {
          yb = d * 14;
          sk = -d * 0.7;
        } else {
          syns = false;
        }
        k.style.visibility = syns ? '' : 'hidden';
        if (!syns) return;
        k.style.transform = 'translate3d(0,' + yk.toFixed(2) + '%,0)';
        bilder[i].style.transform = 'translate3d(0,' + yb.toFixed(2) + '%,0) scale(' + zoom.toFixed(4) + ')';
        skuggor[i].style.opacity = sk.toFixed(3);
        svep[i].style.opacity = sv.toFixed(3);
      });

      var akt = Math.min(n - 1, Math.round(p));
      if (akt !== aktivt) {
        aktivt = akt;
        steg.forEach(function (s, j) {
          s.classList.toggle('aktiv', j === akt);
          s.classList.toggle('klar', j < akt);
        });
        staplar.forEach(function (b, j) {
          b.classList.toggle('aktiv', j === akt);
          if (j === akt) b.setAttribute('aria-current', 'step');
          else b.removeAttribute('aria-current');
        });
        if (rulle) rulle.style.transform = 'translate3d(0,' + (-akt * 100 / n).toFixed(3) + '%,0)';
      }
      // Varje stapel fylls medan dess steg är det aktiva.
      fyllning.forEach(function (b, j) {
        if (!b) return;
        var fran = Math.max(0, j - 0.5), till = Math.min(n - 1, j + 0.5);
        b.style.transform = 'scaleX(' + klamp((q - fran) / (till - fran)).toFixed(3) + ')';
      });
    }
    function boka() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(rita);
    }

    // Staplarna hoppar till sitt steg.
    staplar.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!pa) return;
        var i = Number(b.getAttribute('data-bygget-hopp'));
        var r = spar.getBoundingClientRect();
        var langd = r.height - window.innerHeight;
        window.scrollTo({ top: window.scrollY + r.top + langd * (i / (n - 1)), behavior: 'smooth' });
      });
    });

    function lage() {
      pa = bred.matches && !lugn;
      bygget.classList.toggle('bygget--3d', pa);
      aktivt = -1;
      forraAndel = -1;
      kort.forEach(function (k, i) {
        k.style.zIndex = String(i + 1);
        if (!pa) {
          k.style.transform = '';
          k.style.visibility = '';
          bilder[i].style.transform = '';
          skuggor[i].style.opacity = '';
          svep[i].style.opacity = '';
        }
      });
      if (pa) rita();
      else steg.forEach(function (s) { s.classList.add('aktiv'); s.classList.remove('klar'); });
    }
    window.addEventListener('scroll', boka, { passive: true });
    window.addEventListener('resize', boka);
    if (bred.addEventListener) bred.addEventListener('change', lage);
    lage();
  })();

  /* --- Elitlagret -------------------------------------------------
     Bilder som avslöjas, etikettstreck som ritas, kort som glider in,
     magnetiska knappar och en glidande markör i menyn (design.css 15). */
  document.documentElement.classList.add('ih-js');

  // Sidfotens sociala ikoner ritas fram när sidfoten syns.
  $$('.site-footer__sociala').forEach(function (el) {
    if (lugn || !window.IntersectionObserver) { el.classList.add('syns'); return; }
    narSynligt(el, function (e) { e.classList.add('syns'); }, 0.5);
  });

  // Etikettstrecken ritas när de syns.
  $$('.ih-etikett, .section-label').forEach(function (el) {
    if (lugn) { el.classList.add('syns'); return; }
    narSynligt(el, function (e) { e.classList.add('syns'); }, 0.4);
  });

  if (!lugn && window.IntersectionObserver) {
    // Stora bilder i innehållet avslöjas ur en ram.
    var UNDANTAG = '.ihtopp, .subpage-hero, .kat-topp, .guidehero, .heroscen, .ordband, .val, .bildval, .husval, .sprang, ' +
      '.main-nav__sub, .kuliss, .hus, .bygget, .vag, .virke, .helbild__bak, .kollen-hus, ' +
      '.jamforruta, .storlek3d, .hus3dvy, .site-footer, .model-plan, .pf-tak, .model-card__media, .hus-fler, .pkort, .segment__media';
    var bilder = $$('main img').filter(function (img) {
      if (img.closest(UNDANTAG)) return false;
      // Husfotona (skylten nere till vänster) klipps aldrig, inte ens när de visas.
      if (/(^|\/)hus-r\d/.test(img.getAttribute('src') || '')) return false;
      var b = img.getBoundingClientRect().width || img.width;
      return b >= 220;
    });
    var bildObs = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) {
        if (!p.isIntersecting) return;
        p.target.classList.add('ih-avslojd');
        bildObs.unobserve(p.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    bilder.forEach(function (img) {
      img.classList.add('ih-avslojas');
      bildObs.observe(img);
    });

    // Kort och rubrikblock glider in, syskon efter varandra.
    var KORT = '.ih-huvud, .skal, .siffra, .kontakt-direkt__rad, .proffs-hopp a, .styrkort, ' +
      '.priskort, .team-kort, .vidarekort, .fassteg__kort, .ih-fakta__kort, .ih-varde, .ih-fraga';
    var kortObs = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) {
        if (!p.isIntersecting) return;
        p.target.classList.add('ih-inne');
        kortObs.unobserve(p.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    var syskon = new Map();
    $$(KORT).forEach(function (k) {
      if (k.classList.contains('reveal') || k.closest('.ihtopp')) return;
      var f = k.parentElement;
      var i = syskon.get(f) || 0;
      syskon.set(f, i + 1);
      k.style.setProperty('--ih-droj', Math.min(i * 0.08, 0.4).toFixed(2) + 's');
      k.classList.add('ih-in');
      kortObs.observe(k);
    });
  }

  // Magnetiska knappar: följer pekaren några pixlar.
  if (finPekare && !lugn) {
    $$('.ih-knapp--virke, .header-button, .hero__link--solid, .knapp-fylld, .kontaktkort__knapp, ' +
       '.model-price__button, .site-footer__button').forEach(function (k) {
      k.addEventListener('pointermove', function (e) {
        var r = k.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        k.style.translate = (x * 10).toFixed(1) + 'px ' + (y * 8).toFixed(1) + 'px';
      });
      k.addEventListener('pointerleave', function () { k.style.translate = ''; });
    });
  }

  // Glidande markör bakom menylänkarna.
  (function () {
    var nav = $('.main-nav');
    if (!nav || !finPekare) return;
    var markor = document.createElement('span');
    markor.className = 'nav-markor';
    markor.setAttribute('aria-hidden', 'true');
    nav.insertBefore(markor, nav.firstChild);
    nav.classList.add('har-navmarkor');
    var lankar = $$('.main-nav__link', nav);
    function aktiv() {
      return lankar.filter(function (a) {
        return a.getAttribute('aria-current') === 'page' || a.classList.contains('main-nav__link--active');
      })[0];
    }
    function flytta(a, direkt) {
      if (!a) { markor.style.opacity = '0'; return; }
      var nr = nav.getBoundingClientRect();
      var r = a.getBoundingClientRect();
      if (direkt) markor.style.transition = 'none';
      markor.style.width = r.width + 'px';
      markor.style.transform = 'translateX(' + (r.left - nr.left) + 'px)';
      markor.style.opacity = '1';
      if (direkt) { void markor.offsetWidth; markor.style.transition = ''; }
    }
    lankar.forEach(function (a) {
      a.addEventListener('pointerenter', function () { flytta(a); });
      a.addEventListener('focus', function () { flytta(a); });
    });
    nav.addEventListener('pointerleave', function () { flytta(aktiv()); });
    function start() { flytta(aktiv(), true); }
    start();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    window.addEventListener('resize', start);
  })();

  /* --- Sidfotens stora ord ----------------------------------------
     Som på Uperformance: en span per bokstav (--k) för framtoningen,
     och en kopia i ljusfönstret (.ord-ljus) med exakt samma uppdelning,
     så att ljuset hamnar precis på bokstäverna. Stil i design.css 09. */
  (function () {
    var ord = $('.site-footer__ord');
    if (!ord) return;
    var text = ord.textContent.trim();
    function bokstaver(klass) {
      return Array.prototype.map.call(text, function (t, k) {
        return '<span class="' + klass + '" style="--k:' + k + '">' + t + '</span>';
      }).join('');
    }
    ord.innerHTML = bokstaver('ord-bokstav') +
      '<span class="ord-ljus"><span>' + bokstaver('ord-bokstav-ljus') + '</span></span>';
    ord.classList.add('ord-delat');
    if (lugn) { ord.classList.add('ord-synlig'); return; }
    narSynligt(ord, function () { ord.classList.add('ord-synlig'); }, 0.25);
    pausaUtanforVy(ord);
  })();

  /* --- Vägen dit: bygget i isometri --------------------------------
     En byggscen ritad som vektorgrafik i isometrisk projektion: tomten,
     verkstaden, grunden, lastbilen, kranen och huset. Scenen byggs upp
     genom de sju stegen (samma steg och vem-gör-vad som på processidan).
     Varje del av scenen är en grupp med data-fran/data-till - den syns i
     de stegen och tonar/glider in när den kommer. Hustypen ändrar husets
     mått, lovet och leveranstiden. Tidslinjen spelar själv när sektionen
     syns, pausar när man pekar på den och slutar när man väljer själv. */
  (function () {
    var rot = $('[data-resan]');
    if (!rot) return;
    var svg = $('.resan__svg', rot);
    var knappar = $$('.resan__tidslinje button', rot);
    var typKnappar = $$('.resan__hustyp button', rot);
    var vemKnappar = $$('.resan__vem button', rot);
    var infoRuta = $('.resan__info', rot);
    var I = {
      skede: $('[data-resan-skede]', rot), nr: $('[data-resan-nr]', rot),
      titel: $('[data-resan-titel]', rot), vem: $('[data-resan-vem]', rot),
      text: $('[data-resan-text]', rot), meta: $('[data-resan-meta]', rot),
      lank: $('[data-resan-lank]', rot)
    };

    var TYP = {
      attefallshus: { L: 7.14, B: 4.2, nock: 4.0, lev: '10–12', sida: 'attefallshus.html',
        matt: ['7,14 m', '4,20 m'], lov: 'Anmälan · installationer' },
      fritidshus: { L: 10.83, B: 3.9, nock: 4.35, lev: '12–14', sida: 'fritidshus.html',
        matt: ['10,83 m', '3,90 m'], lov: 'Bygglov' }
    };
    var SKEDE = ['Skede 1 · Innan bygget', 'Skede 2 · Medan huset byggs', 'Skede 3 · På plats'];
    var VEMTEXT = { vi: 'Vi gör det', du: 'Du gör det', bada: 'Tillsammans' };
    var STEG = [
      { titel: 'Första samtalet', skede: 0, vem: 'bada', vemText: 'Tillsammans',
        text: 'Du berättar om tomten, hur huset ska användas och ungefär när du vill vara i gång. Vi säger vad som är möjligt och vad som inte är det. Kostar ingenting och förpliktigar inte till något.',
        meta: function () { return 'Kostar ingenting · förpliktigar inte till något'; },
        lank: function () { return ['kontakt.html', 'Boka första samtalet']; } },
      { titel: 'Modell och anpassning', skede: 0, vem: 'bada', vemText: 'Tillsammans',
        text: 'Vi går igenom modellerna och gör de anpassningar som betyder något för just din plats. Du får en offert där det står vad som ingår och vad som tillkommer.',
        meta: function (t) { return 'Offert post för post · planritning ' + t.matt[0] + ' × ' + t.matt[1]; },
        lank: function (t) { return [t.sida, 'Se modellerna']; } },
      { titel: 'Bygglov eller anmälan', skede: 0, vem: 'du', vemText: 'Du lämnar in',
        text: 'Mindre komplementhus behöver sedan december 2025 varken bygglov eller anmälan för själva byggnaden, men installationerna anmäls ändå. Övriga hus kräver bygglov. Vi tar fram ritningar och underlag, men det är du som är byggherre och lämnar in till din kommun.',
        meta: function (t) {
          return t === TYP.attefallshus
            ? 'Attefallshus: inget bygglov för byggnaden inom måtten'
            : 'Fritidshus: bygglov krävs - vi tar fram underlaget';
        },
        lank: function (t) {
          return t === TYP.attefallshus ? ['attefallshus-regler.html', 'Reglerna för attefallshus']
            : ['sa-fungerar-det.html', 'Så går lovet till'];
        } },
      { titel: 'Tillverkning', skede: 1, vem: 'vi', vemText: 'Vi gör det',
        text: 'Huset byggs i Sverige, under tak. Väggar, golv och tak monteras i jämn temperatur och fuktnivå i stället för ute i väder och vind. Du får veta var i processen huset befinner sig.',
        meta: function (t) { return 'Leverans ' + t.lev + ' veckor · byggt under tak i Sverige'; },
        lank: function () { return ['proffs.html', 'Se produktionen']; } },
      { titel: 'Grund och anslutningar', skede: 1, vem: 'du', vemText: 'Du ordnar',
        text: 'Grunden ska vara gjuten och el, vatten och avlopp framdragna innan huset kommer. Vi säger vad som krävs och när det ska vara klart, så att inget står och väntar på varandra.',
        meta: function () { return 'Grund, el, vatten och avlopp klart innan huset kommer'; },
        lank: function () { return ['vad-far-jag-bygga.html', 'Kolla din tomt och mark']; } },
      { titel: 'Leverans och montage', skede: 2, vem: 'vi', vemText: 'Vi gör det',
        text: 'Huset transporteras till tomten och monteras. Framkomlighet för lastbil och kranbil är det vanligaste som behöver lösas i förväg.',
        meta: function () { return 'Montaget tar dagar i stället för månader'; },
        lank: function () { return ['sa-fungerar-det.html', 'Se hela processen']; } },
      { titel: 'Slutbesiktning', skede: 2, vem: 'bada', vemText: 'Tillsammans',
        text: 'Genomgång av huset, punktlista på det som ska rättas, och överlämning. Du har haft samma kontakt hela vägen och vet vem du pratar med.',
        meta: function () { return 'Samma kontakt hela vägen'; },
        lank: function () { return ['kontakt.html', 'Börja med ett samtal']; } }
    ];

    /* Isometrisk projektion: x åt höger-ner, y åt vänster-ner, z uppåt. */
    var S = 30, OX = 500, OY = 445, C = 0.8660254;
    function P(x, y, z) { return [OX + (x - y) * S * C, OY + (x + y) * S * 0.5 - (z || 0) * S]; }
    function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
    function poly(a, fill, extra) { return '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
    function lin(a, farg, b, extra) {
      return '<polyline points="' + pts(a) + '" fill="none" stroke="' + farg + '" stroke-width="' + b +
        '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
    }
    function rita(a, farg, b, extra) { return lin(a, farg, b, ' pathLength="1" class="rs-rita"' + (extra || '')); }
    function box(x, y, z, dx, dy, dz, f) {
      var x1 = x + dx, y1 = y + dy, z1 = z + dz;
      return poly([P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)], f.x) +
        poly([P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)], f.y) +
        poly([P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)], f.t);
    }
    function del(fran, till, inne, stil, klass) {
      return '<g class="rs-del ' + (klass || '') + '" data-fran="' + fran + '" data-till="' + till + '"' +
        (stil ? ' style="' + stil + '"' : '') + '>' + inne + '</g>';
    }
    function etikett(p, text, klass) {
      var b = Math.round(text.length * 7.1 + 26);
      return '<g class="rs-etikett ' + (klass || '') + '" transform="translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')">' +
        '<rect x="' + (-b / 2) + '" y="-15" width="' + b + '" height="30" rx="15"/>' +
        '<text x="0" y="5" text-anchor="middle">' + text + '</text></g>';
    }
    function gran(x, y, h) {
      var bas = P(x, y, 0), topp = P(x, y, h), mitt = P(x, y, h * 0.25), b = S * 0.62 * (h / 3);
      return '<ellipse cx="' + bas[0].toFixed(1) + '" cy="' + (bas[1] + 2).toFixed(1) + '" rx="' + (b * 1.1).toFixed(1) +
        '" ry="' + (b * 0.45).toFixed(1) + '" fill="rgba(0,0,0,.28)"/>' +
        poly([[bas[0] - 2.2, bas[1]], [bas[0] + 2.2, bas[1]], [mitt[0] + 2.2, mitt[1]], [mitt[0] - 2.2, mitt[1]]], '#5b4632') +
        poly([topp, [mitt[0] - b, mitt[1]], [mitt[0], mitt[1] + b * 0.32]], '#4d7d5c') +
        poly([topp, [mitt[0], mitt[1] + b * 0.32], [mitt[0] + b, mitt[1]]], '#2e5541');
    }
    // Rektangel i ett väggplan: planet y=yv (framsidan) eller x=xv (gaveln).
    function iY(yv, x0, x1, z0, z1) { return [P(x0, yv, z0), P(x1, yv, z0), P(x1, yv, z1), P(x0, yv, z1)]; }
    function iX(xv, y0, y1, z0, z1) { return [P(xv, y0, z0), P(xv, y1, z0), P(xv, y1, z1), P(xv, y0, z1)]; }

    var FASAD = { t: '#57504a', x: '#2d2823', y: '#3b352e' };
    var BETONG = { t: '#c9c3b8', x: '#8d877d', y: '#a39d92' };
    var VIRKE = { t: '#f1d3a2', x: '#c79a5f', y: '#dcb57c' };

    function bygg(t) {
      var L = t.L, B = t.B, x0 = -L / 2, x1 = L / 2, y0 = -B / 2, y1 = B / 2;
      var zs = 0.35, H = 2.5, ze = zs + H, zr = t.nock + 0.2, o = 0.35;
      var h = '';
      h += '<defs>' +
        '<linearGradient id="rs-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5f8062"/><stop offset="1" stop-color="#344f3c"/></linearGradient>' +
        '<linearGradient id="rs-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0d6"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>' +
        '<radialGradient id="rs-sken"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="rs-skugga"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
        '</defs>';

      // Tomten och verkstaden (verkstaden flyger in i steg 4).
      h += box(-9, -6.5, -0.7, 18, 13, 0.7, { t: 'url(#rs-gras)', x: '#2a231c', y: '#382e24' });
      var hall = box(-15, -6.3, -0.5, 4.6, 4.6, 0.5, { t: '#4c4740', x: '#2a2622', y: '#353029' }) +
        poly([P(-14.6, -5.9, 0), P(-10.8, -5.9, 0), P(-10.8, -5.9, 2.6), P(-14.6, -5.9, 2.6)], 'rgba(247,245,240,.05)', ' stroke="rgba(247,245,240,.22)" stroke-width="1"') +
        poly([P(-14.6, -5.9, 0), P(-14.6, -2.1, 0), P(-14.6, -2.1, 2.6), P(-14.6, -5.9, 2.6)], 'rgba(247,245,240,.04)', ' stroke="rgba(247,245,240,.18)" stroke-width="1"');
      var hallTak = poly([P(-14.6, -5.9, 2.6), P(-10.8, -5.9, 2.6), P(-10.8, -2.1, 2.6), P(-14.6, -2.1, 2.6)], 'rgba(247,245,240,.07)', ' stroke="rgba(247,245,240,.3)" stroke-width="1"');
      var paneler = '';
      for (var i = 0; i < 4; i++) {
        var px = -14.1 + i * 0.9, pa = [];
        pa.push(poly(iX(px, -5.5, -2.6, 0.05, 2.1), 'rgba(241,211,162,.14)', ' stroke="#e2bf8a" stroke-width="1.6"'));
        for (var s = -5.5 + 0.58; s < -2.6; s += 0.58) pa.push(lin([P(px, s, 0.05), P(px, s, 2.1)], '#e2bf8a', 1.1));
        pa.push(lin([P(px, -5.5, 1.1), P(px, -2.6, 1.1)], '#e2bf8a', 1.1));
        paneler += del(4, 6, pa.join(''), '--in-y:-28px;--d:' + (0.35 + i * 0.22) + 's');
      }
      h += del(4, 99, hall + paneler + hallTak + etikett(P(-12.7, -4, 3.9), 'Verkstaden · under tak'), '--in-y:-50px');

      // Steg 1: tomtgränsen ritas och nålen landar.
      var gr = [P(-8.3, -5.8, 0.02), P(8.3, -5.8, 0.02), P(8.3, 5.8, 0.02), P(-8.3, 5.8, 0.02), P(-8.3, -5.8, 0.02)];
      var pinnar = [[-8.3, -5.8], [8.3, -5.8], [8.3, 5.8], [-8.3, 5.8]].map(function (k) {
        return lin([P(k[0], k[1], 0), P(k[0], k[1], 0.9)], '#f0b56e', 2.4) +
          '<circle cx="' + P(k[0], k[1], 0.9)[0].toFixed(1) + '" cy="' + P(k[0], k[1], 0.9)[1].toFixed(1) + '" r="3" fill="#f0b56e"/>';
      }).join('');
      h += del(1, 99, rita(gr, 'rgba(240,181,110,.75)', 1.6) + pinnar, '--in-y:0px');
      h += del(1, 2, etikett(P(-6.2, 5.8, 0.2), 'Din tomt', 'rs-etikett--ljus'), '--in-y:10px;--d:.7s');

      // Steg 2: planritningen på marken, med mått.
      var ritn = rita([P(x0, y0, 0.03), P(x1, y0, 0.03), P(x1, y1, 0.03), P(x0, y1, 0.03), P(x0, y0, 0.03)], '#f0b56e', 2.2) +
        rita([P(x0 + L * 0.4, y0, 0.03), P(x0 + L * 0.4, y1, 0.03)], '#f0b56e', 1.4, ' style="--d:.5s"') +
        poly([P(x0, y0, 0.03), P(x1, y0, 0.03), P(x1, y1, 0.03), P(x0, y1, 0.03)], 'rgba(240,181,110,.1)') +
        rita([P(x0, y1 + 1, 0.03), P(x1, y1 + 1, 0.03)], 'rgba(247,245,240,.7)', 1.2, ' style="--d:.8s"') +
        rita([P(x1 + 1, y0, 0.03), P(x1 + 1, y1, 0.03)], 'rgba(247,245,240,.7)', 1.2, ' style="--d:.9s"') +
        etikett(P(0, y1 + 1.9, 0.03), t.matt[0], 'rs-etikett--matt') +
        etikett(P(x1 + 2.2, 0, 0.03), t.matt[1], 'rs-etikett--matt');
      h += del(2, 5, ritn, '--in-y:0px');

      // Steg 5: ledningar fram till grunden.
      var led = rita([P(9, -1.2, 0.02), P(x1 + 0.3, -1.2, 0.02)], '#f2b33d', 2.6) +
        rita([P(9, -0.5, 0.02), P(x1 + 0.3, -0.5, 0.02)], '#6aa7d8', 2.6, ' style="--d:.2s"') +
        rita([P(9, 0.2, 0.02), P(x1 + 0.3, 0.2, 0.02)], '#a8a196', 2.6, ' style="--d:.4s"');
      h += del(5, 99, led, '--in-y:0px');

      // Träd bakom huset.
      var baktrad = [[-7.8, -4.6, 3.4], [7.6, -5.3, 3.8], [8.2, -2.4, 2.9], [-8.1, 1.4, 2.6]];
      var framtrad = [[-6.8, 5.3, 2.3], [2.8, 5.6, 2.0]];
      h += baktrad.map(function (g) { return gran(g[0], g[1], g[2]); }).join('');

      // Steg 1-4: nålen.
      var c = P(0, 0, 0);
      var nal = '<ellipse class="rs-puls" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" rx="22" ry="11" fill="none" stroke="#f0b56e" stroke-width="2"/>' +
        '<g class="rs-nal"><path d="M' + c[0] + ' ' + c[1] + 'c-13-20-19-28-19-38a19 19 0 1 1 38 0c0 10-6 18-19 38z" fill="#f0b56e"/>' +
        '<circle cx="' + c[0] + '" cy="' + (c[1] - 38) + '" r="7" fill="#1b1915"/></g>';
      h += del(1, 5, nal, '--in-y:-60px;--d:.35s');

      // Steg 3: handlingarna, stämplade.
      var d = P(4.8, -3.6, 3.4);
      var dok = '<g class="rs-dok" transform="translate(' + d[0].toFixed(1) + ',' + d[1].toFixed(1) + ') rotate(-6)">' +
        '<rect x="-38" y="-48" width="76" height="96" rx="8" fill="#f7f5f0"/>' +
        '<path d="M-24 -30h48M-24 -18h48M-24 -6h32M-24 6h40" stroke="#b9b1a4" stroke-width="3" stroke-linecap="round"/>' +
        '<circle class="rs-stampel" cx="14" cy="28" r="17" fill="none" stroke="#8f5424" stroke-width="3"/>' +
        '<path class="rs-stampel" d="M6 28l6 6 11-12" fill="none" stroke="#8f5424" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g>';
      h += del(3, 5, dok + etikett([d[0], d[1] + 70], t.lov), '--in-y:-40px');

      // Steg 5: grunden reser sig, med en mjuk skugga.
      var sk = P(0.3, 0.3, 0);
      h += del(5, 99, '<ellipse cx="' + sk[0].toFixed(1) + '" cy="' + (sk[1] + 6).toFixed(1) + '" rx="' + (L * S * 0.95).toFixed(1) +
        '" ry="' + (L * S * 0.42).toFixed(1) + '" fill="url(#rs-skugga)"/>' +
        box(x0 - 0.3, y0 - 0.3, 0, L + 0.6, B + 0.6, zs, BETONG), '--in-y:22px');
      h += del(5, 6, etikett(P(8.2, -2.6, 0.4), 'El · vatten · avlopp', 'rs-etikett--liten'), '--in-y:10px;--d:.6s');

      // Steg 6: kranen.
      var kb = P(5.8, -4.4, 0), kt = P(5.8, -4.4, 8.2), km = P(-0.5, 0.2, 8.2), kk = P(-0.5, 0.2, 5.2);
      var kran = box(5.3, -4.9, 0, 1, 1, 0.5, { t: '#f2c14e', x: '#b8891f', y: '#d6a534' }) +
        lin([kb, kt], '#f2c14e', 4) + lin([P(5.8, -4.4, 7.2), km], '#f2c14e', 3) +
        lin([kt, km], '#f2c14e', 2) + lin([km, kk], 'rgba(247,245,240,.7)', 1.2) +
        '<rect x="' + (kk[0] - 4) + '" y="' + kk[1] + '" width="8" height="7" rx="2" fill="#f2c14e"/>';
      h += del(6, 7, kran, '--in-y:-80px');

      // Steg 6-7: väggarna reses (bakifrån) och taket läggs på.
      var vagg = '';
      vagg += del(6, 99, box(x0, y0, zs, L, 0.2, H, FASAD), '--in-y:-70px;--d:.2s');
      vagg += del(6, 99, box(x0, y0, zs, 0.2, B, H, FASAD), '--in-y:-70px;--d:.45s');
      var gavel = box(x1 - 0.2, y0, zs, 0.2, B, H, FASAD) +
        poly(iX(x1 + 0.01, -0.45, 0.45, zs + 0.9, zs + 2.0), '#1c2a33', ' stroke="#8a8074" stroke-width="1"');
      vagg += del(6, 99, gavel, '--in-y:-70px;--d:.7s');
      var fram = box(x0, y1 - 0.2, zs, L, 0.2, H, FASAD);
      for (var bx = x0 + 0.45; bx < x1; bx += 0.45) fram += lin([P(bx, y1 + 0.005, zs), P(bx, y1 + 0.005, ze)], 'rgba(255,255,255,.07)', 1);
      var f1 = [x0 + L * 0.12, x0 + L * 0.12 + 1.3], f2 = [x1 - L * 0.12 - 2.0, x1 - L * 0.12];
      var dorr = [x0 + L * 0.46, x0 + L * 0.46 + 0.95];
      fram += poly(iY(y1 + 0.01, f1[0], f1[1], zs + 0.8, zs + 2.0), '#1c2a33', ' stroke="#8a8074" stroke-width="1"');
      fram += poly(iY(y1 + 0.01, f2[0], f2[1], zs + 0.25, zs + 2.15), '#1c2a33', ' stroke="#8a8074" stroke-width="1"');
      fram += poly(iY(y1 + 0.01, dorr[0], dorr[1], zs, zs + 2.1), '#2a1f17', ' stroke="#8a8074" stroke-width="1"');
      vagg += del(6, 99, fram, '--in-y:-70px;--d:.95s');
      var tak = poly([P(x1, y0, ze), P(x1, y1, ze), P(x1, 0, zr - 0.2)], '#25211d') +
        poly([P(x0 - o, 0, zr), P(x1 + o, 0, zr), P(x1 + o, y0 - o, ze - 0.2), P(x0 - o, y0 - o, ze - 0.2)], '#4a4f55') +
        poly([P(x0 - o, 0, zr), P(x1 + o, 0, zr), P(x1 + o, y1 + o, ze - 0.2), P(x0 - o, y1 + o, ze - 0.2)], '#2c3034') +
        lin([P(x0 - o, 0, zr), P(x1 + o, 0, zr)], 'rgba(255,255,255,.35)', 1.4);
      for (var tx = x0; tx <= x1 + 0.01; tx += 0.55) tak += lin([P(tx, 0.05, zr - 0.02), P(tx, y1 + o - 0.05, ze - 0.18)], 'rgba(255,255,255,.06)', 1);
      vagg += del(6, 99, tak, '--in-y:-110px;--d:1.3s');
      h += vagg;

      // Steg 7: ljuset tänds, trall, skylt och bock.
      var glod = poly(iY(y1 + 0.02, f1[0], f1[1], zs + 0.8, zs + 2.0), 'url(#rs-glas)') +
        poly(iY(y1 + 0.02, f2[0], f2[1], zs + 0.25, zs + 2.15), 'url(#rs-glas)') +
        poly(iX(x1 + 0.02, -0.45, 0.45, zs + 0.9, zs + 2.0), 'url(#rs-glas)');
      var sp = P((f2[0] + f2[1]) / 2, y1 + 2, 0);
      glod = '<ellipse cx="' + sp[0].toFixed(1) + '" cy="' + sp[1].toFixed(1) + '" rx="120" ry="44" fill="url(#rs-sken)"/>' + glod;
      h += del(7, 99, glod, '--in-y:0px;--d:.2s', 'rs-ljus');
      var trall = box(dorr[0] - 0.9, y1, 0, dorr[1] - dorr[0] + 1.8, 1.3, 0.2, VIRKE);
      var skylt = lin([P(x0 - 0.8, y1 + 1.6, 0), P(x0 - 0.8, y1 + 1.6, 1.1)], '#2b241d', 2.4) +
        lin([P(x0 + 0.9, y1 + 1.6, 0), P(x0 + 0.9, y1 + 1.6, 1.1)], '#2b241d', 2.4) +
        poly(iY(y1 + 1.6, x0 - 1.0, x0 + 1.1, 0.8, 1.55), '#c9a06a');
      var sm = P(x0 + 0.05, y1 + 1.6, 1.12);
      skylt += '<text class="rs-skylttext" x="' + sm[0].toFixed(1) + '" y="' + (sm[1] + 3).toFixed(1) + '" text-anchor="middle" transform="rotate(-30 ' + sm[0].toFixed(1) + ' ' + sm[1].toFixed(1) + ')">Idealhus</text>';
      h += del(7, 99, trall + skylt, '--in-y:14px;--d:.5s');
      var bm = P(0, 0, zr + 2.6);
      var bock = '<g class="rs-bock" transform="translate(' + bm[0].toFixed(1) + ',' + bm[1].toFixed(1) + ')">' +
        '<circle r="24" fill="#22a35a"/><path d="M-10 0l7 7 13-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
        etikett([bm[0], bm[1] + 46], 'Slutbesiktning klar', 'rs-etikett--ljus');
      h += del(7, 99, bock, '--in-y:-30px;--d:.9s');

      // Steg 6: lastbilen med väggelement.
      var bil = box(3.4, 3.9, 0.45, 3.6, 1.5, 0.22, { t: '#3a3632', x: '#211e1b', y: '#2c2925' }) +
        box(3.6, 4.1, 0.67, 3.1, 1.1, 0.55, VIRKE) +
        box(7.1, 3.9, 0.3, 1.3, 1.5, 1.45, { t: '#f5c690', x: '#b27a3e', y: '#e0a45f' }) +
        poly(iX(8.41, 4.1, 5.2, 1.05, 1.6), '#1c2a33');
      [[4.2, 5.4], [6.2, 5.4], [7.7, 5.4]].forEach(function (w) {
        var p = P(w[0], w[1] + 0.01, 0.3);
        bil += '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="8" ry="9" fill="#141210" stroke="#57504a" stroke-width="2"/>';
      });
      h += del(6, 7, bil, '--in-x:140px;--in-y:80px');

      // Träd framför huset, sist.
      h += framtrad.map(function (g) { return gran(g[0], g[1], g[2]); }).join('');
      return h;
    }

    var steg = 0, typ = 'attefallshus', spelar = !lugn, synlig = false, pekar = false, timer, vald = false;
    var TID = 5200;
    rot.style.setProperty('--resatid', TID + 'ms');

    function visaSteg(n) {
      steg = n;
      rot.setAttribute('data-steg', String(n));
      $$('.rs-del', svg).forEach(function (g) {
        var pa = +g.getAttribute('data-fran') <= n && n < +g.getAttribute('data-till');
        g.classList.toggle('pa', pa);
      });
      knappar.forEach(function (b, i) {
        if (i + 1 === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        b.classList.toggle('klar', i + 1 < n);
      });
      var t = TYP[typ], s = STEG[n - 1];
      I.skede.textContent = SKEDE[s.skede];
      I.nr.textContent = '0' + n;
      I.titel.textContent = s.titel;
      I.vem.setAttribute('data-vem', s.vem);
      I.vem.innerHTML = '<i class="prick prick--' + s.vem + '"></i><span>' + s.vemText + '</span>';
      I.text.textContent = s.text;
      I.meta.textContent = s.meta(t);
      var l = s.lank(t);
      I.lank.setAttribute('href', l[0]);
      I.lank.firstChild.nodeValue = l[1];
      if (!lugn) {
        infoRuta.classList.remove('resan__info--byt');
        void infoRuta.offsetWidth;
        infoRuta.classList.add('resan__info--byt');
      }
      starta();
    }

    function starta() {
      clearTimeout(timer);
      rot.classList.remove('resan--spelar');
      if (!spelar || !synlig || pekar) return;
      void rot.offsetWidth;
      rot.classList.add('resan--spelar');
      timer = setTimeout(function () { visaSteg(steg % 7 + 1); }, TID);
    }

    function valjSjalv() {
      spelar = false;
      if (!vald) { vald = true; infoRuta.setAttribute('aria-live', 'polite'); }
    }

    function rendera() {
      svg.innerHTML = bygg(TYP[typ]);
      if (steg) {
        // Nya grupper ska tona in - ge webbläsaren en bildruta först. Steget
        // läses när bildrutan kommer, inte nu: hinner man klicka på ett
        // steg under tiden är det det steget som gäller.
        requestAnimationFrame(function () { requestAnimationFrame(function () { visaSteg(steg); }); });
      }
    }

    knappar.forEach(function (b, i) {
      b.addEventListener('click', function () { valjSjalv(); visaSteg(i + 1); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(7, i + 2);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(1, i);
        if (n === null) return;
        e.preventDefault();
        valjSjalv();
        visaSteg(n);
        knappar[n - 1].focus();
      });
    });

    typKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        var ny = b.getAttribute('data-typ');
        if (ny === typ) return;
        typ = ny;
        typKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        valjSjalv();
        rendera();
      });
    });

    vemKnappar.forEach(function (b) {
      b.addEventListener('click', function () {
        var pa = b.getAttribute('aria-pressed') !== 'true';
        vemKnappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b && pa)); });
        if (pa) rot.setAttribute('data-vem', b.getAttribute('data-vem'));
        else rot.removeAttribute('data-vem');
      });
    });

    rot.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { pekar = true; starta(); } });
    rot.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { pekar = false; starta(); } });
    rot.addEventListener('focusin', function () { valjSjalv(); starta(); });

    rendera();
    if (!window.IntersectionObserver || lugn) {
      synlig = true;
      visaSteg(1);
    } else {
      new IntersectionObserver(function (poster) {
        synlig = poster[0].isIntersecting;
        if (synlig && !steg) {
          requestAnimationFrame(function () { visaSteg(1); });
        } else {
          starta();
        }
      }, { threshold: 0.3 }).observe(rot);
    }
    pausaUtanforVy(rot);
    glidandeMarkering($('.resan__hustyp', rot));
  })();

  /* --- Regelsidan: guiden om attefallshus --------------------------
     Innehållsförteckningen med läsmätare och en markör som glider till
     avsnittet man läser, måtten som växlar mellan inom och utanför
     detaljplan, talen i kortsvaret och korten som ritas upp när de
     syns (design.css 21). Utan skriptet står allt stilla men syns. */
  (function () {
    var rot = $('.rg');
    if (!rot) return;

    function somTal(s) { return parseFloat(String(s).replace(',', '.')) || 0; }
    function somText(v, dec) { return dec ? v.toFixed(dec).replace('.', ',') : String(Math.round(v)); }

    // Räknar om ett tal mjukt. Ett nytt anrop tar över ett pågående.
    function tweena(el, fran, till, ms, enhet) {
      var dec = String(till).indexOf(',') >= 0 ? 1 : 0;
      var a = somTal(fran), b = somTal(till);
      var id = (el.rgTween || 0) + 1;
      el.rgTween = id;
      if (lugn || a === b) { el.textContent = somText(b, dec) + (enhet || ''); return; }
      var start = performance.now();
      (function steg(nu) {
        if (el.rgTween !== id) return;
        var t = Math.min(1, (nu - start) / ms);
        var e = 1 - Math.pow(1 - t, 3);
        el.textContent = somText(a + (b - a) * e, dec) + (enhet || '');
        if (t < 1) requestAnimationFrame(steg);
      })(start);
    }

    // Korten tonar in syskon efter syskon; ikoner, bockar och streck ritas.
    if (!lugn && window.IntersectionObserver) {
      var syskon = new Map();
      $$('[data-rg-in]').forEach(function (el) {
        var f = el.parentElement;
        var i = syskon.get(f) || 0;
        syskon.set(f, i + 1);
        el.style.setProperty('--rg-d', Math.min(i * 0.07, 0.2).toFixed(2) + 's');
        el.classList.add('rg-vanta');
        narSynligt(el, function (e) {
          e.classList.remove('rg-vanta');
          setTimeout(function () { e.style.removeProperty('--rg-d'); }, 2000);
        }, 0, '0px 0px -2% 0px');
      });
    }

    // Talen i kortsvaret räknas upp en gång.
    $$('[data-rg-rakna]').forEach(function (el) {
      if (lugn) return;
      var mal = el.getAttribute('data-rg-rakna');
      if (mal.indexOf(',') >= 0) return;
      narSynligt(el, function () { tweena(el, Math.round(Number(mal) * 0.6), mal, 600); }, 0.4);
    });

    $$('.rg-topp, .rg-vatten').forEach(pausaUtanforVy);

    /* Innehållsförteckningen. Linjen på 35 % av skärmhöjden avgör vilket
       avsnitt man läser; mätaren fylls i takt med texten. */
    var lankar = $$('.rg-toc a');
    var delar = lankar.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var markor = $('.rg-toc__markor');
    var fyll = $('.rg-toc__fyll');
    var text = $('.rg__text');
    var aktiv = -1;

    function flyttaMarkor() {
      var a = lankar[aktiv];
      if (!a || !markor) return;
      markor.style.height = a.offsetHeight + 'px';
      markor.style.transform = 'translateY(' + a.offsetTop + 'px)';
    }

    function markera(i) {
      if (i === aktiv) return;
      aktiv = i;
      lankar.forEach(function (a, j) {
        a.classList.toggle('ar-har', j === i);
        if (j === i) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      flyttaMarkor();
      if (markor) markor.classList.add('syns');
    }

    var bokad = false;
    function las() {
      bokad = false;
      var linje = window.innerHeight * 0.35;
      var i = 0;
      for (var j = 0; j < delar.length; j++) {
        if (delar[j] && delar[j].getBoundingClientRect().top <= linje) i = j;
      }
      markera(i);
      if (fyll && text) {
        var r = text.getBoundingClientRect();
        var p = (linje - r.top) / Math.max(1, r.height - window.innerHeight * 0.4);
        fyll.style.transform = 'scaleY(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
      }
    }
    function bokaLas() {
      if (bokad) return;
      bokad = true;
      requestAnimationFrame(las);
    }

    if (lankar.length) {
      window.addEventListener('scroll', bokaLas, { passive: true });
      window.addEventListener('resize', function () { flyttaMarkor(); bokaLas(); });
      if (document.fonts) document.fonts.ready.then(flyttaMarkor);
      las();
    }

    /* Måtten: växeln flyttar pillret, huset växer i ritningen (CSS) och
       talen räknas om. Piltangenterna byter också. */
    var matt = $('[data-rg-matt]');
    if (!matt) return;
    var vaxel = $('.rg-vaxel', matt);
    var pill = $('.rg-vaxel__pill', matt);
    var knappar = $$('button', vaxel);
    var varden = $$('[data-inom]', matt);

    function pillTill(direkt) {
      var b = $('[aria-pressed="true"]', vaxel);
      if (!b || !pill) return;
      if (direkt) pill.style.transition = 'none';
      pill.style.width = b.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + b.offsetLeft + 'px)';
      if (direkt) { void pill.offsetWidth; pill.style.transition = ''; }
    }

    function satt(plan) {
      vaxel.classList.remove('lockar');
      if (matt.getAttribute('data-plan') === plan) return;
      matt.setAttribute('data-plan', plan);
      knappar.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-plan') === plan));
      });
      pillTill(false);
      varden.forEach(function (el) {
        tweena(el, el.textContent, el.getAttribute('data-' + plan), 850, el.getAttribute('data-enhet') || '');
      });
    }

    knappar.forEach(function (b) {
      b.addEventListener('click', function () { satt(b.getAttribute('data-plan')); });
    });
    vaxel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var ny = e.key === 'ArrowRight' ? 'utanfor' : 'inom';
      satt(ny);
      $('[data-plan="' + ny + '"]', vaxel).focus();
    });

    vaxel.classList.add('klar');
    pillTill(true);
    if (window.ResizeObserver) new ResizeObserver(function () { pillTill(true); }).observe(vaxel);
    if (document.fonts) document.fonts.ready.then(function () { pillTill(true); });

    // En diskret inbjudan att prova växeln, en gång, när panelen syns.
    if (!lugn) {
      narSynligt(matt, function () {
        setTimeout(function () {
          if (matt.getAttribute('data-plan') === 'inom') vaxel.classList.add('lockar');
        }, 2200);
      }, 0.5);
    }
  })();

  /* --- Proffssidan ------------------------------------------------
     Utforskaren (tre flikar som bläddrar själva medan de syns, tills
     man väljer själv), bildbandet (pilar, dra med musen, mätare), linjen
     genom de fyra stegen och det som tonar in (design.css 22). */
  (function () {
    var lev = $('[data-pf-lev]');
    if (!lev) return;

    $$('[data-pf-in]').forEach(function (el) {
      if (lugn || !window.IntersectionObserver) return;
      el.classList.add('pf-vanta');
      narSynligt(el, function (e) { e.classList.remove('pf-vanta'); }, 0.3, '0px 0px -8% 0px');
    });
    $$('.pf-topp, .pf-tak, [data-pf-lev]').forEach(pausaUtanforVy);

    /* Utforskaren. */
    var flikar = $$('[role="tab"]', lev);
    var delar = $$('.pf-lev__del', lev);
    var scener = $$('.pf-scen', lev);

    function valj(kod, fokus) {
      flikar.forEach(function (f) {
        var ja = f.getAttribute('data-val') === kod;
        f.setAttribute('aria-selected', String(ja));
        f.tabIndex = ja ? 0 : -1;
        if (ja && fokus) f.focus();
      });
      delar.forEach(function (d) { d.classList.toggle('vald', d.getAttribute('data-del') === kod); });
      scener.forEach(function (s) { s.classList.toggle('vald', s.getAttribute('data-scen') === kod); });
    }
    // Har man själv valt en flik börjar turen inte om.
    var valtSjalv = false;
    function stoppa() { valtSjalv = true; lev.classList.remove('kor'); }

    lev.classList.add('klar');
    flikar.forEach(function (f, i) {
      f.addEventListener('click', function () { stoppa(); valj(f.getAttribute('data-val')); });
      f.addEventListener('keydown', function (e) {
        var n = flikar.length, j = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j < 0) return;
        e.preventDefault();
        stoppa();
        valj(flikar[j].getAttribute('data-val'), true);
      });
      // Mätaren i fliken är klockan: när den är full går turen vidare.
      $('.pf-lev__tid', f).addEventListener('animationend', function () {
        if (!lev.classList.contains('kor')) return;
        valj(flikar[(i + 1) % flikar.length].getAttribute('data-val'));
      });
    });
    if (!lugn) narSynligt(lev, function () { if (!valtSjalv) lev.classList.add('kor'); }, 0.35);
    var levPanel = $('.pf-lev__panel', lev);
    if (levPanel) levPanel.addEventListener('pointerdown', stoppa);

    // Länkarna i toppen (och adresser som #husblock) väljer rätt flik.
    function tillLeverans(kod) {
      stoppa();
      valj(kod);
      (levPanel || lev).scrollIntoView({ behavior: lugn ? 'auto' : 'smooth', block: 'start' });
    }
    $$('[data-hopp]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        tillLeverans(a.getAttribute('data-hopp'));
        if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
      });
    });
    function franAdress() {
      var d = delar.filter(function (x) { return '#' + x.id === location.hash; })[0];
      if (d) tillLeverans(d.getAttribute('data-del'));
    }
    window.addEventListener('hashchange', franAdress);
    franAdress();

    /* Bildbandet. */
    var rad = $('.pf-band__rad');
    if (rad) {
      var matare = $('.pf-band__matare i');
      var bak = $('[data-pf-band="-1"]'), fram = $('[data-pf-band="1"]');
      var bokadBand = false;
      var matBand = function () {
        bokadBand = false;
        var max = rad.scrollWidth - rad.clientWidth;
        var andel = rad.clientWidth / rad.scrollWidth;
        var p = max > 0 ? rad.scrollLeft / max : 0;
        if (matare) {
          matare.style.width = (andel * 100).toFixed(2) + '%';
          matare.style.transform = 'translateX(' + (p * (1 / andel - 1) * 100).toFixed(2) + '%)';
        }
        if (bak) bak.disabled = rad.scrollLeft < 4;
        if (fram) fram.disabled = rad.scrollLeft > max - 4;
      };
      var bokaBand = function () {
        if (bokadBand) return;
        bokadBand = true;
        requestAnimationFrame(matBand);
      };
      rad.addEventListener('scroll', bokaBand, { passive: true });
      window.addEventListener('resize', bokaBand);
      matBand();
      $$('[data-pf-band]').forEach(function (b) {
        b.addEventListener('click', function () {
          var forsta = $('.pf-band__bild', rad);
          var steg = forsta ? forsta.offsetWidth + 14 : rad.clientWidth * 0.8;
          rad.scrollBy({ left: Number(b.getAttribute('data-pf-band')) * steg, behavior: lugn ? 'auto' : 'smooth' });
        });
      });

      // Dra med musen. Ett drag är inget klick.
      var drar = false, startX = 0, startL = 0, flyttat = 0;
      rad.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        drar = true;
        flyttat = 0;
        startX = e.clientX;
        startL = rad.scrollLeft;
        rad.classList.add('drar');
        rad.setPointerCapture(e.pointerId);
      });
      rad.addEventListener('pointermove', function (e) {
        if (!drar) return;
        flyttat = e.clientX - startX;
        rad.scrollLeft = startL - flyttat;
      });
      // Släpp: bandet glider till närmaste bild (eller nästa, om man
      // drog en bit) i stället för att hoppa dit.
      var slapp = function () {
        if (!drar) return;
        drar = false;
        var forsta = $('.pf-band__bild', rad);
        var steg = forsta ? forsta.offsetWidth + 14 : rad.clientWidth * 0.8;
        var nu = rad.scrollLeft;
        var mal = Math.round(nu / steg) * steg;
        if (Math.abs(flyttat) > 40) mal = (flyttat < 0 ? Math.ceil(nu / steg) : Math.floor(nu / steg)) * steg;
        rad.scrollTo({ left: mal, behavior: lugn ? 'auto' : 'smooth' });
        setTimeout(function () { if (!drar) rad.classList.remove('drar'); }, 450);
      };
      rad.addEventListener('pointerup', slapp);
      rad.addEventListener('pointercancel', slapp);
      rad.addEventListener('click', function (e) {
        if (Math.abs(flyttat) > 6) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    }

    /* De fyra stegen: linjen fylls och noderna tänds i takt med sidan. */
    var steglista = $('[data-pf-steg]');
    if (steglista) {
      var fyll = $('.pf-steg__linje i', steglista);
      var stegen = $$('.pf-steg__steg', steglista);
      var bokadSteg = false;
      var matSteg = function () {
        bokadSteg = false;
        var r = steglista.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = lugn ? 1 : Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height * 0.5 + vh * 0.35)));
        fyll.style.setProperty('--p', p.toFixed(4));
        stegen.forEach(function (s, i) {
          s.classList.toggle('klar', p > 0 && p >= i / (stegen.length - 1) - 0.001);
        });
      };
      window.addEventListener('scroll', function () {
        if (bokadSteg) return;
        bokadSteg = true;
        requestAnimationFrame(matSteg);
      }, { passive: true });
      matSteg();
    }
  })();
})();

/* --- Menyraden och toppen (2026-10-03) ---------------------------
   Menyraden blir fastare när sidan rullats en bit, och filmramen i
   toppen lutar lite mot pekaren (bara med pekare, inte vid lugn
   rörelse). */
(function () {
  var html = document.documentElement;
  var arRullad = null;
  function rullat() {
    var ja = (window.scrollY || window.pageYOffset || 0) > 24;
    if (ja === arRullad) return;
    arRullad = ja;
    if (ja) html.setAttribute('data-rullat', '');
    else html.removeAttribute('data-rullat');
  }
  window.addEventListener('scroll', rullat, { passive: true });
  rullat();

  var media = document.querySelector('.topp2__media');
  if (!media) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var tick = null, rx = 0, ry = 0;
  media.addEventListener('pointermove', function (e) {
    var r = media.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    rx = -y * 5;
    ry = x * 7;
    if (tick) return;
    tick = requestAnimationFrame(function () {
      tick = null;
      media.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      media.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    });
  });
  media.addEventListener('pointerleave', function () {
    media.style.setProperty('--rx', '0deg');
    media.style.setProperty('--ry', '0deg');
  });
})();

/* --- Husväljaren och sprängskissen (2026-10-03) -------------------- */
(function () {
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Husväljaren: fem foton som byts, spelar själv tills man klickar. */
  var hv = document.querySelector('[data-husval]');
  if (hv) {
    var knappar = Array.prototype.slice.call(hv.querySelectorAll('.husval__val button'));
    var bilder = Array.prototype.slice.call(hv.querySelectorAll('.husval__bild'));
    var paneler = Array.prototype.slice.call(hv.querySelectorAll('.husval__panel'));
    var aktiv = 0, timer = 0, manuell = false, synlig = false, haller = false;
    function visa(i, fokus) {
      aktiv = (i + knappar.length) % knappar.length;
      knappar.forEach(function (k, n) {
        var ja = n === aktiv;
        k.setAttribute('aria-selected', String(ja));
        k.tabIndex = ja ? 0 : -1;
        if (ja && fokus) k.focus();
      });
      bilder.forEach(function (b, n) { b.classList.toggle('aktiv', n === aktiv); if (n === aktiv) b.loading = 'eager'; });
      paneler.forEach(function (pn, n) { pn.hidden = n !== aktiv; pn.classList.toggle('aktiv', n === aktiv); });
      // Nästa bild får ladda i förväg.
      var nasta = bilder[(aktiv + 1) % bilder.length];
      if (nasta) nasta.loading = 'eager';
    }
    function stopp() {
      clearInterval(timer);
      hv.classList.remove('husval--spelar');
    }
    function spela() {
      stopp();
      if (lugn || manuell || !synlig || haller) return;
      hv.classList.add('husval--spelar');
      timer = setInterval(function () { visa(aktiv + 1, false); }, 5200);
    }
    knappar.forEach(function (k, n) {
      k.addEventListener('click', function () { manuell = true; stopp(); visa(n, false); });
      k.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); manuell = true; stopp(); visa(aktiv + (e.key === 'ArrowRight' ? 1 : -1), true); }
      });
    });
    // Pekaren eller fokus i scenen håller kvar huset man tittar på.
    var scenen = hv.querySelector('.husval__scen') || hv;
    scenen.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { haller = true; stopp(); } });
    scenen.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { haller = false; spela(); } });
    scenen.addEventListener('focusin', function () { haller = true; stopp(); });
    scenen.addEventListener('focusout', function (e) { if (!scenen.contains(e.relatedTarget)) { haller = false; spela(); } });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (poster) {
        synlig = poster.some(function (x) { return x.isIntersecting; });
        if (synlig) { bilder.forEach(function (b) { b.loading = 'eager'; }); spela(); } else stopp();
      }, { rootMargin: '200px 0px' }).observe(hv);
    } else spela();
  }

  /* Sprängskissen: model-viewer laddas när sektionen närmar sig, och
     rullningen spolar animationen "sprang" (tak upp, grund ner). */
  var sp = document.querySelector('[data-sprang]');
  if (!sp) return;
  var scen = sp.querySelector('[data-sprang-scen]');
  var delar = Array.prototype.slice.call(sp.querySelectorAll('.sprang__del'));
  var matare = sp.querySelector('.sprang__matare i');
  var spar = sp.querySelector('.sprang__spar');
  var mv = null, klar = false, p = -1, bokad = false, inne = false;
  var smal = window.matchMedia('(max-width: 900px)');

  function laddaMV() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve();
    return new Promise(function (ok, fel) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = 'vendor/model-viewer.min.js';
      s.onload = ok;
      s.onerror = fel;
      document.head.appendChild(s);
    });
  }

  function bygg() {
    if (mv) return;
    mv = document.createElement('model-viewer');
    var attr = {
      src: 'modeller/hus-r1-sprang.glb?v=20261004q',
      alt: 'Sadel 30 Bred i sprängskiss: grund, väggar och tak',
      'animation-name': 'sprang',
      'camera-orbit': '34deg 72deg 16m',
      'camera-target': '0m 1.7m 0m',
      'field-of-view': '30deg',
      'shadow-intensity': '1.2',
      'shadow-softness': '0.7',
      'environment-image': 'legacy',
      'tone-mapping': 'neutral',
      exposure: '1.1',
      'interaction-prompt': 'none',
      'disable-zoom': '',
      'disable-pan': '',
      'disable-tap': ''
    };
    Object.keys(attr).forEach(function (k) { mv.setAttribute(k, attr[k]); });
    mv.addEventListener('load', function () {
      mv.play();
      mv.pause();
      klar = true;
      mv.classList.add('syns');
      p = -1;
      rita();
    });
    mv.addEventListener('error', function () { sp.classList.add('sprang--utan3d'); });
    scen.appendChild(mv);
  }

  function progress() {
    var vh = window.innerHeight;
    if (smal.matches) {
      var r = scen.getBoundingClientRect();
      return Math.max(0, Math.min(1, (vh * 0.95 - r.top) / (vh * 0.9)));
    }
    var sr = spar.getBoundingClientRect();
    var langd = sr.height - vh;
    return langd > 0 ? Math.max(0, Math.min(1, -sr.top / langd)) : 1;
  }

  function rita() {
    bokad = false;
    var ny = lugn ? 1 : progress();
    if (Math.abs(ny - p) < 0.002) return;
    p = ny;
    // Mjuk start och slut.
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    if (klar && mv) {
      mv.currentTime = Math.min(0.999, Math.max(0, e));
      mv.cameraOrbit = (34 + e * 24).toFixed(2) + 'deg ' + (72 - e * 8).toFixed(2) + 'deg ' + (16 + e * 7).toFixed(2) + 'm';
      mv.cameraTarget = '0m ' + (1.7 + e * 1.4).toFixed(2) + 'm 0m';
    }
    var steg = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
    delar.forEach(function (d, n) { d.classList.toggle('aktiv', n === steg); });
    if (matare) matare.style.setProperty('--p', e.toFixed(3));
  }

  function boka() {
    if (!inne || bokad) return;
    bokad = true;
    requestAnimationFrame(rita);
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (poster) {
      inne = poster.some(function (x) { return x.isIntersecting; });
      if (inne) { laddaMV().then(bygg, function () { sp.classList.add('sprang--utan3d'); }); boka(); }
    }, { rootMargin: '120% 0px' }).observe(sp);
  } else { laddaMV().then(bygg); inne = true; }
  window.addEventListener('scroll', boka, { passive: true });
  window.addEventListener('resize', function () { p = -1; boka(); }, { passive: true });
})();


/* --- Rullningsmarkören i toppen (2026-10-04) ----------------------- */
(function () {
  var pil = document.querySelector('.topp3__rulla');
  if (!pil) return;
  pil.addEventListener('click', function (e) {
    var mal = document.querySelector(pil.getAttribute('href'));
    if (!mal || !mal.scrollIntoView) return;
    e.preventDefault();
    var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mal.scrollIntoView({ behavior: lugn ? 'auto' : 'smooth', block: 'start' });
  });
})();

/* --- Inträdet för löftesrutorna och skedeskorten (2026-10-06) -------
   Grupperna tonas fram en ruta i taget när de syns, och hela inträdet
   spelas klart på en gång (stil i design.css, .glid). */
(function () {
  var grupper = document.querySelectorAll('.contact-section .kontaktkort .tillit, .katsida .tillit, .flode-intro__skeden, .contact-section .kontaktkort');
  if (!grupper.length) return;
  var lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(grupper, function (g) {
    Array.prototype.forEach.call(g.children, function (el, i) {
      el.classList.add('glid');
      el.style.setProperty('--i', i);
    });
  });
  function visa(g) {
    Array.prototype.forEach.call(g.children, function (el) { el.classList.add('glid--in'); });
  }
  if (lugn || !window.IntersectionObserver) { Array.prototype.forEach.call(grupper, visa); return; }
  var io = new IntersectionObserver(function (poster) {
    poster.forEach(function (p) {
      if (p.isIntersecting) { visa(p.target); io.unobserve(p.target); }
    });
  }, { threshold: 0.2 });
  Array.prototype.forEach.call(grupper, function (g) { io.observe(g); });
})();
