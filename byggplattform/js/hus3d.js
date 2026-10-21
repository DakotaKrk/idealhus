/* Byggplattformen – 3D-huset som byggsten för alla sidor.
   BP.hus3d.html(hus, o) ger en scen; BP.hus3d.koppla(el, o) laddar model-viewer, ramar
   in huset, låter lagren landa på plats och ger ett api:
   - markera(grupp): ett lager lyser, de andra tonas ned och huset dras isär lite
   - farga({ grupp: [r, g, b] }): lagren får varsin glöd (billigare, dyrare …)
   - isar(v): hur isär huset står när ingen pekar på det
   - byt(hus): ett annat hus byggs ihop i samma scen
   Grupperna är materialgrupperna i mängden (BP.GRUPP_MAT knyter dem till modellen). */
(function () {
  'use strict';
  var BP = window.BP, e = BP.e;
  var lugnt = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  function gruppFor(material) {
    var G = BP.GRUPP_MAT;
    for (var g in G) if (G[g].indexOf(material) !== -1) return g;
    return null;
  }

  BP.hus3d = {
    html: function (h, o) {
      o = o || {};
      return '<div class="h3d' + (o.klass ? ' ' + o.klass : '') + '" data-h3d="' + h.id + '">' +
        '<model-viewer src="' + BP.sprangSrc(h) + '" alt="' + e(o.alt || h.namn + ' i 3D') + '" animation-name="sprang" interaction-prompt="none"' +
          (o.rotera === false ? '' : ' auto-rotate auto-rotate-delay="0" rotation-per-second="' + (o.fart || 8) + 'deg"') +
          (o.vrid ? ' camera-controls touch-action="pan-y"' : '') +
          ' shadow-intensity="1.1" shadow-softness="0.8" exposure="1.15" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="32deg 66deg 14m" field-of-view="28deg" disable-zoom disable-pan interpolation-decay="120"></model-viewer>' +
        (o.etikett ? '<span class="h3d__etikett" aria-live="polite">' + o.etikett + '</span>' : '') +
      '</div>';
    },

    koppla: function (el, o) {
      o = o || {};
      var mv = el.querySelector('model-viewer');
      var api = { el: el, mv: mv, laddad: false, orig: [], rorelse: null, vilo: o.isar || 0, karta: null, grupp: null };
      var ram = function (h) { BP3D.ram(mv, h, { vinkel: o.vinkel || '32deg 66deg', marg: o.marg || 1.08 }); };
      ram(BP.hus(el.getAttribute('data-h3d')));

      var spara = function () {
        api.laddad = true;
        api.orig = mv.model.materials.map(function (m) { return { f: m.pbrMetallicRoughness.baseColorFactor.slice(), lage: m.getAlphaMode ? m.getAlphaMode() : 'OPAQUE', g: gruppFor(m.name) }; });
        if (api.fasadHex) api.fasad(api.fasadHex); else mala();
      };
      // Ritar om materialen efter läget: ett markerat lager, annars glöden per lager.
      function mala() {
        if (!api.laddad) return;
        var namn = api.grupp ? BP.GRUPP_MAT[api.grupp] || [] : null;
        if (namn && !namn.length) namn = null;
        mv.model.materials.forEach(function (m, n) {
          var or = api.orig[n]; if (!or) return;
          var traff = namn && namn.indexOf(m.name) !== -1;
          var syns = !namn || traff;
          m.pbrMetallicRoughness.setBaseColorFactor([or.f[0], or.f[1], or.f[2], syns ? or.f[3] : 0.22]);
          m.setAlphaMode(syns ? or.lage : 'BLEND');
          var glod = traff ? (api.karta && api.karta[api.grupp]) || [0.16, 0.13, 0.05] : !namn && api.karta && or.g && api.karta[or.g] ? api.karta[or.g] : [0, 0, 0];
          m.setEmissiveFactor(glod);
        });
      }
      api.markera = function (grupp) {
        api.grupp = grupp || null;
        mala();
        if (api.rorelse) api.rorelse.mal(grupp ? Math.max(0.5, api.vilo) : api.vilo);
      };
      api.farga = function (karta) { api.karta = karta; mala(); };
      // Fasadens färg (hex, som tillvalen) – fasaden och panelen målas om.
      api.fasad = function (hex) {
        api.fasadHex = hex;
        if (!api.laddad) return;
        var c = [1, 3, 5].map(function (k) { return Math.pow(parseInt(hex.slice(k, k + 2), 16) / 255, 2.2); });
        mv.model.materials.forEach(function (m, n) { if (m.name === 'fasad' || m.name === 'panel') api.orig[n].f = [c[0], c[1], c[2], api.orig[n].f[3]]; });
        mala();
      };
      api.isar = function (v) { api.vilo = v; if (api.rorelse && !api.grupp) api.rorelse.mal(v, { mjuk: true }); };
      api.byt = function (h) {
        if (!h || h.id === el.getAttribute('data-h3d')) return;
        el.setAttribute('data-h3d', h.id);
        api.laddad = false;
        mv.setAttribute('alt', h.namn + ' i 3D');
        ram(h);
        mv.setAttribute('src', BP.sprangSrc(h));
        mv.addEventListener('load', function () { if (api.rorelse && !lugnt()) { api.rorelse.direkt(1); setTimeout(function () { api.rorelse.mal(api.vilo, { mjuk: true }); }, 200); } }, { once: true });
      };

      BP.laddaMV(function () {
        mv.addEventListener('load', spara);
        if (mv.loaded) spara();
        api.rorelse = BP3D.rorelse(mv);
        // Entrén: lagren landar på plats, sedan står huset i sitt viloläge.
        var starta = function () {
          if (lugnt() || o.entre === false) { api.rorelse.direkt(api.vilo); return; }
          api.rorelse.direkt(1);
          setTimeout(function () { api.rorelse.mal(api.vilo, { mjuk: true }); }, 300);
        };
        if (mv.loaded) starta(); else mv.addEventListener('load', starta, { once: true });
        if (o.hovra !== false) {
          el.addEventListener('mouseenter', function () { if (!api.grupp) api.rorelse.mal(Math.max(0.42, api.vilo + 0.18)); });
          el.addEventListener('mouseleave', function () { if (!api.grupp) api.rorelse.mal(api.vilo); });
        }
      });
      return api;
    }
  };

  /* Kort som lutar mot muspekaren – lite djup när man hovrar, tillbaka med fjäder. */
  BP.luta = function (rot, valjare) {
    if (lugnt() || !window.matchMedia('(hover: hover)').matches) return;
    BP.$$(valjare, rot).forEach(function (k) {
      if (k._luta) return;
      k._luta = true;
      k.classList.add('lutar');
      k.addEventListener('pointermove', function (ev) {
        var r = k.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
        k.style.setProperty('--lx', (x * 7).toFixed(2) + 'deg');
        k.style.setProperty('--ly', (-y * 6).toFixed(2) + 'deg');
        k.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
        k.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
      });
      k.addEventListener('pointerleave', function () { k.style.setProperty('--lx', '0deg'); k.style.setProperty('--ly', '0deg'); });
    });
  };

  /* Saker som glider in när de rullas fram (en gång). */
  BP.glidIn = function (rot, valjare) {
    if (lugnt() || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (poster) {
      poster.forEach(function (p) { if (p.isIntersecting) { p.target.classList.add('glid--in'); io.unobserve(p.target); } });
    }, { root: document.getElementById('ark'), rootMargin: '0px 0px -40px 0px' });
    BP.$$(valjare, rot).forEach(function (el, n) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight - 40) return; // det som redan syns får vara
      el.classList.add('glid');
      el.style.setProperty('--gd', (n % 4) * 60 + 'ms');
      io.observe(el);
    });
  };
})();
