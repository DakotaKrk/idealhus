/* Byggplattformen – sprängskissen.
   Huset i 3D delat i sina lager (grund, golv, väggar, takstolar, tak),
   kopplat till materiallistan: varje materialgrupp pekar på de material i
   modellen den består av. Hovra en grupp – i listan eller bland lagren –
   så lyser de delarna i skyltgult och resten blir genomskinligt.
   Rörelsen: huset dras isär en gång när det visas (det enda inövade
   ögonblicket), sedan styr reglaget eller rullningen. */
(function () {
  'use strict';
  var BP = window.BP;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$;

  // Materialgrupp i listan → materialnamn i modellen (se _sprang.mjs).
  var GRUPP_MAT = {
    'Grund': ['betong', 'grus', 'gras'],
    'Stomme': ['tra'],
    'Isolering': ['isolering'],
    'Skivor': ['golvskiva'],
    'Tak': ['tak'],
    'Fasad': ['fasad', 'panel', 'fog'],
    'Fönster och dörrar': ['karm', 'glas', 'dorr'],
    'Fästdon': []
  };
  BP.GRUPP_MAT = GRUPP_MAT;
  var GLOD = [0.14, 0.28, 0.2];
  var lugn = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var ut = function (t) { return 1 - Math.pow(1 - t, 3); };

  BP.sprangSrc = function (h) { return h.modell.replace('modeller/', 'modeller/sprang/'); };

  /* Markup för en sprängskiss. o: { hus, mangd (resultat från Mangd.mangda), id, hojd } */
  BP.sprangHtml = function (o) {
    var h = o.hus, m = o.mangd;
    var grupper = Object.keys(GRUPP_MAT).map(function (g) {
      var rader = m ? m.rader.filter(function (r) { return r.grupp === g; }) : [];
      return { g: g, summa: rader.reduce(function (t, r) { return t + r.summa; }, 0), antal: rader.length, obekraftad: rader.some(function (r) { return r.obekraftad; }) };
    }).filter(function (x) { return !m || x.antal; });
    var max = Math.max.apply(null, grupper.map(function (x) { return x.summa; }).concat([1]));
    return '<section class="sprang" id="' + o.id + '" aria-label="Sprängskiss av ' + e(h.namn) + '">' +
      '<div class="sprang__scen"><model-viewer src="' + BP.sprangSrc(h) + '" alt="' + e(h.namn) + ' i sprängskiss: grund, golv, väggar, takstolar och tak" animation-name="sprang" camera-controls disable-zoom touch-action="pan-y" interaction-prompt="none" shadow-intensity="0.8" shadow-softness="1" exposure="1.05" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="32deg 68deg 78%" field-of-view="28deg" style="height:' + (o.hojd || 460) + 'px"></model-viewer>' +
        '<div class="sprang__reglage"><span>Hopsatt</span><input type="range" min="0" max="100" value="0" aria-label="Hur isär huset är" data-sprang-reglage><span>Isär</span></div>' +
        '<span class="scen__tips">' + i('vrid') + 'Dra för att vrida</span>' +
        '<span class="sprang__lager" aria-live="polite"></span></div>' +
      (m ? '<div class="sprang__lista"><div class="sprang__huvud"><h2>Materialet lager för lager</h2><small data-rakna="' + Math.round(m.summa) + '" data-format="kr">' + BP.kr(m.summa) + '</small></div><ul>' + grupper.map(function (x) {
        return '<li><button type="button" data-sprang-grupp="' + e(x.g) + '"><span class="sprang__namn">' + e(x.g) + (x.obekraftad ? ' <span class="chip chip--tejp" style="height:18px">obekräftad</span>' : '') + '</span>' +
          '<span class="sprang__summa" data-rakna="' + Math.round(x.summa) + '" data-format="kr">' + BP.kr(x.summa) + '</span><span class="sprang__stapel"><i style="--a:' + (x.summa / max).toFixed(3) + '"></i></span><small>' + x.antal + (x.antal === 1 ? ' rad' : ' rader') + '</small></button></li>';
      }).join('') + '</ul><p class="sprang__not">Hovra ett lager så lyser det i modellen.</p></div>' : '') +
    '</section>';
  };

  /* Koppla en sprängskiss: laddar model-viewer, spelar intro, reglage och markering. */
  BP.sprangKoppla = function (rot, o) {
    o = o || {};
    var sek = rot.matches && rot.matches('.sprang') ? rot : $('.sprang', rot);
    if (!sek) return null;
    var mv = $('model-viewer', sek), reglage = $('[data-sprang-reglage]', sek), lagerText = $('.sprang__lager', sek);
    var api = { varde: 0, mv: mv };
    var original = {}, nu = {}, mal = {}, rafAlfa = 0, klar = false;

    function satt(v) {
      api.varde = Math.max(0, Math.min(1, v));
      if (klar) mv.currentTime = api.varde * 0.999;
      if (reglage && document.activeElement !== reglage) reglage.value = Math.round(api.varde * 100);
    }
    api.satt = satt;

    // Alfa per material glider mot sitt mål (200 ms-känsla), glöden byts direkt.
    function animeraAlfa() {
      cancelAnimationFrame(rafAlfa);
      var steg = function () {
        var kvar = false;
        mv.model.materials.forEach(function (mat, n) {
          var a = nu[n], b = mal[n];
          if (Math.abs(a - b) < 0.01) { nu[n] = b; } else { nu[n] = a + (b - a) * 0.22; kvar = true; }
          var c = original[n].farg;
          mat.pbrMetallicRoughness.setBaseColorFactor([c[0], c[1], c[2], c[3] * nu[n]]);
          mat.setAlphaMode(nu[n] < 0.999 || original[n].blend ? 'BLEND' : original[n].lage);
        });
        if (kvar) rafAlfa = requestAnimationFrame(steg);
      };
      rafAlfa = requestAnimationFrame(steg);
    }

    api.markera = function (grupp) {
      if (!klar) return;
      var namn = grupp ? GRUPP_MAT[grupp] || [] : null;
      // Fästdon syns inte i modellen – markera inget, men säg det.
      var osynlig = namn && !namn.length;
      if (osynlig) namn = null;
      mv.model.materials.forEach(function (mat, n) {
        var traff = namn && namn.indexOf(mat.name) !== -1;
        mal[n] = !namn || traff ? 1 : 0.12;
        mat.setEmissiveFactor(traff ? GLOD : original[n].glod);
      });
      animeraAlfa();
      if (lagerText) lagerText.textContent = grupp ? grupp + (osynlig ? ' · syns inte i modellen' : '') : '';
      lagerText && lagerText.classList.toggle('syns', !!grupp);
      $$('[data-sprang-grupp]', sek).forEach(function (b) { b.classList.toggle('aktiv', b.getAttribute('data-sprang-grupp') === grupp); });
      // Kopplade rader i materiallistan
      $$('.mangd tr[data-grupp]').forEach(function (tr) { tr.classList.toggle('lyser', !!grupp && tr.getAttribute('data-grupp') === grupp); });
    };

    BP.laddaMV(function () {
      var start = function () {
        mv.model.materials.forEach(function (mat, n) {
          var f = mat.pbrMetallicRoughness.baseColorFactor.slice();
          original[n] = { farg: f, lage: mat.getAlphaMode ? mat.getAlphaMode() : 'OPAQUE', blend: (mat.getAlphaMode && mat.getAlphaMode() === 'BLEND'), glod: (mat.emissiveFactor || [0, 0, 0]).slice() };
          nu[n] = 1; mal[n] = 1;
        });
        mv.play(); mv.pause(); mv.currentTime = 0;
        klar = true;
        sek.classList.add('sprang--klar');
        // Introt: huset dras isär en gång, 1,6 s, mjukt ut. Lugnt läge: direkt till 60 %.
        var slut = o.start == null ? 0.62 : o.start;
        if (lugn() || o.utanIntro) { satt(slut); return; }
        var t0 = null;
        var spela = function (t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / 1600);
          satt(ut(p) * slut);
          if (p < 1 && !api.avbruten) requestAnimationFrame(spela);
        };
        setTimeout(function () { requestAnimationFrame(spela); }, 350);
      };
      if (mv.loaded) start(); else mv.addEventListener('load', start, { once: true });
    });

    if (reglage) reglage.addEventListener('input', function () { api.avbruten = true; satt(reglage.value / 100); });
    $$('[data-sprang-grupp]', sek).forEach(function (b) {
      b.addEventListener('mouseenter', function () { api.markera(b.getAttribute('data-sprang-grupp')); });
      b.addEventListener('focus', function () { api.markera(b.getAttribute('data-sprang-grupp')); });
      b.addEventListener('mouseleave', function () { api.markera(null); });
      b.addEventListener('blur', function () { api.markera(null); });
      b.addEventListener('click', function () {
        // Klick: dra isär helt och visa lagret i listan.
        api.avbruten = true;
        var fran = api.varde, t0 = null;
        var g = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 500); satt(fran + (0.999 - fran) * ut(p)); if (p < 1) requestAnimationFrame(g); };
        if (lugn()) satt(1); else requestAnimationFrame(g);
        var rad = $('.mangd tr.grupprad[data-grupp="' + b.getAttribute('data-sprang-grupp') + '"]');
        if (rad) rad.scrollIntoView({ behavior: lugn() ? 'auto' : 'smooth', block: 'center' });
      });
    });
    return api;
  };
})();
