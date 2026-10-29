/* Legohus CRM – detaljer flyttade från Uperformance CRM (2026-10-28).
   Antalsfälten: varje tal-ruta i ett formulärfält (.falt) får egna runda − och + i högerkanten i stället
   för webbläsarens små pilar. Knapparna ligger utanför tabbordningen och tar aldrig fokus – rutan är redan
   en spinbutton (piltangenterna fungerar). data-nativ undantar, data-steg ger knapparnas steg. Körs vid start och av en observatör när
   vyerna ritas om. Stil: grund.css. */
(() => {
  'use strict';
  const SVG = { '-1': '<path d="M6 12h12"/>', 1: '<path d="M12 6v12M6 12h12"/>' };
  function forberedAntal(rot = document) {
    rot.querySelectorAll('.falt input[type="number"]:not([data-nativ]):not([data-antal])').forEach((inp) => {
      inp.dataset.antal = '';
      const fokus = document.activeElement === inp;
      const ram = document.createElement('span'); ram.className = 'antal-falt';
      inp.replaceWith(ram); ram.append(inp);
      ram.insertAdjacentHTML('beforeend', ['-1', '1'].map((r) => '<button type="button" class="antal-knapp" data-antal-steg="' + r + '" tabindex="-1" aria-hidden="true" title="' + (r === '1' ? 'Öka' : 'Minska') + '"><svg viewBox="0 0 24 24">' + SVG[r] + '</svg></button>').join(''));
      if (fokus) inp.focus({ preventScroll: true });
    });
  }
  document.addEventListener('mousedown', (ev) => { if (ev.target.closest && ev.target.closest('[data-antal-steg]')) ev.preventDefault(); });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-antal-steg]'); if (!b) return;
    const inp = b.parentElement.querySelector('input'); if (!inp || inp.disabled || inp.readOnly) return;
    // data-steg: knapparnas steg när fältet själv tar vilket tal som helst (step="any")
    const steg = Number(inp.dataset.steg) || Number(inp.step) || 1; const min = inp.min !== '' ? Number(inp.min) : -Infinity; const max = inp.max !== '' ? Number(inp.max) : Infinity;
    const nu = Number(inp.value) || 0; const ny = Math.min(max, Math.max(min, nu + steg * Number(b.dataset.antalSteg)));
    if (ny === nu && inp.value !== '') return;
    inp.value = String(ny); inp.removeAttribute('aria-invalid');
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  let vantar = false;
  const kor = () => { if (vantar) return; vantar = true; queueMicrotask(() => { vantar = false; forberedAntal(); }); };
  if (document.body) new MutationObserver(kor).observe(document.body, { childList: true, subtree: true });
  forberedAntal();
})();

/* Magneten (från Uperformance): menyknappen och den minimerade chatten dras mjukt mot musen när den är nära.
   Vilar medan menyn glider och strax efter ett klick (knappen ska landa rakt), mäter utan sin egen förskjutning
   och glider tillbaka mjukt när musen går därifrån i stället för att hoppa 6 px. */
(() => {
  'use strict';
  if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SEL = '.sido-knapp, .chf-ikon';
  let ram = 0, vilaTill = 0;
  const tillbaka = (el) => {
    const fore = el.style.translate; if (!fore) return;
    el.style.translate = '';
    if (el.animate) el.animate([{ translate: fore }, { translate: '0px 0px' }], { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  };
  const vila = () => { vilaTill = performance.now() + 650; document.querySelectorAll(SEL).forEach((el) => { el.style.translate = ''; }); };
  document.addEventListener('pointerdown', (ev) => { if (ev.target.closest && ev.target.closest(SEL)) vila(); }, true);
  addEventListener('ih:sido', vila);
  document.addEventListener('mousemove', (ev) => {
    if (ram) return;
    ram = requestAnimationFrame(() => {
      ram = 0;
      if (performance.now() < vilaTill || document.documentElement.classList.contains('sido-glider')) return;
      document.querySelectorAll(SEL).forEach((el) => {
        const r = el.getBoundingClientRect(); if (!r.width) return;
        const [tx = 0, ty = 0] = (el.style.translate || '').split(' ').map((v) => parseFloat(v) || 0);
        const dx = ev.clientX - (r.left - tx + r.width / 2), dy = ev.clientY - (r.top - ty + r.height / 2), d = Math.hypot(dx, dy);
        if (d < 90) el.style.translate = `${((dx / 90) * 6).toFixed(2)}px ${((dy / 90) * 6).toFixed(2)}px`;
        else tillbaka(el);
      });
    });
  }, { passive: true });
  document.addEventListener('mouseleave', () => document.querySelectorAll(SEL).forEach(tillbaka));
})();

/* Sidomenyn tätare i steg tills allt får plats (som anpassaSido i Uperformance): först lägre rader, sedan mindre
   rubriker, sist utan rubriker – menyn rullar bara om det ändå inte räcker. */
(function () {
  'use strict';
  var IH = window.IH;
  // Menyn får alltid plats utan att rulla: först luftigt men lite lägre rader, sedan flyttas de rader som
  // inte ryms (nerifrån, aldrig den valda) in under "Mer" – en egen liten meny bredvid sidomenyn.
  function anpassaSido() {
    var nav = document.querySelector('.sido__nav'), html = document.documentElement;
    if (!nav || !nav.getClientRects().length) return;
    var fore = html.getAttribute('data-sido-tat') + '|' + nav.querySelectorAll('[data-sido-dold]').length;
    html.removeAttribute('data-sido-tat');
    nav.querySelectorAll('[data-sido-dold]').forEach(function (el) { el.removeAttribute('data-sido-dold'); });
    var gammal = nav.querySelector('.sido__merknapp'); if (gammal) gammal.remove();
    var over = function () { return nav.scrollHeight > nav.clientHeight + 1; };
    if (over()) html.setAttribute('data-sido-tat', '1');
    if (over()) {
      var mer = document.createElement('button');
      mer.type = 'button'; mer.className = 'sido__lank sido__merknapp'; mer.setAttribute('aria-haspopup', 'menu'); mer.setAttribute('aria-expanded', 'false');
      mer.innerHTML = IH.i('prickar') + '<span>Mer</span><b class="sido__merantal"></b>';
      nav.appendChild(mer);
      // det man använder minst flyttas först; okända rader (t.ex. Teamet) efter dem, nerifrån
      // Att göra används varje dag och har den varma brickan – den göms bland de sista
      var ORDNING = ['installningar', 'kolla-marken', 'dokument', 'mote', 'offerter', 'produktion', 'chef', 'chatt', 'att-gora', 'kunder', 'forfragningar', 'salj', 'oversikt'];
      var vikt = function (el) { var i = ORDNING.indexOf(el.getAttribute('data-vy')); return i < 0 ? -1 : i; };
      var rader = Array.prototype.slice.call(nav.querySelectorAll('.sido__lank:not(.sido__merknapp)')).map(function (el, i) { return { el: el, i: i }; });
      rader.sort(function (a, b) { return vikt(a.el) - vikt(b.el) || b.i - a.i; });
      for (var n = 0; n < rader.length && over(); n++) { if (!rader[n].el.classList.contains('aktiv')) rader[n].el.setAttribute('data-sido-dold', ''); }
      // rubriker utan synliga rader döljs också
      nav.querySelectorAll('.sido__rubrik').forEach(function (r) {
        var el = r.nextElementSibling, syns = false;
        while (el && !el.classList.contains('sido__rubrik')) { if (el.classList.contains('sido__lank') && !el.hasAttribute('data-sido-dold') && !el.classList.contains('sido__merknapp')) syns = true; el = el.nextElementSibling; }
        if (!syns) r.setAttribute('data-sido-dold', '');
      });
      var dolda = nav.querySelectorAll('.sido__lank[data-sido-dold]');
      var olast = Array.prototype.some.call(dolda, function (d) { return d.querySelector('.sido__bricka--varm'); });
      // Brickan på Mer summerar de dolda brickornas tal (t.ex. 2 försenade uppgifter), inte antalet rader
      mer.querySelector('.sido__merantal').textContent = Array.prototype.reduce.call(dolda, function (n, d) { var b = d.querySelector('.sido__bricka--varm'); return n + (b ? parseInt(b.textContent, 10) || 0 : 0); }, 0) || '';
      mer.classList.toggle('sido__merknapp--prick', olast);
      mer.title = 'Fler sidor: ' + Array.prototype.map.call(dolda, function (d) { return (d.querySelector('span') || d).textContent.trim(); }).join(', ');
    }
    nav.dispatchEvent(new Event('scroll'));
    var efter = html.getAttribute('data-sido-tat') + '|' + nav.querySelectorAll('[data-sido-dold]').length;
    if (efter !== fore) dispatchEvent(new Event('resize'));
  }
  // Mer-menyn: kopior av de dolda raderna i ett litet kort som glider fram bredvid knappen
  function stangMer(fokus) {
    var p = document.querySelector('.sido__merpop'); if (!p || p.classList.contains('ut')) return;
    var k = document.querySelector('.sido__merknapp'); if (k) k.setAttribute('aria-expanded', 'false');
    p.classList.add('ut'); setTimeout(function () { p.remove(); }, 180);
    if (fokus && k) k.focus({ preventScroll: true });
  }
  function oppnaMer(knapp) {
    if (document.querySelector('.sido__merpop')) { stangMer(); return; }
    var nav = knapp.closest('.sido__nav'), pop = document.createElement('div');
    pop.className = 'sido__merpop'; pop.setAttribute('role', 'menu');
    var html = '', forraRubrik = '';
    Array.prototype.forEach.call(nav.children, function (el) {
      if (el.classList.contains('sido__rubrik')) { forraRubrik = el.textContent; return; }
      if (!el.hasAttribute('data-sido-dold') || !el.classList.contains('sido__lank')) return;
      if (forraRubrik) { html += '<p class="sido__merrubrik">' + IH.e(forraRubrik) + '</p>'; forraRubrik = ''; }
      var k = el.cloneNode(true); k.removeAttribute('data-sido-dold'); k.classList.remove('aktiv'); k.setAttribute('role', 'menuitem');
      html += k.outerHTML;
    });
    pop.innerHTML = html; document.body.appendChild(pop);
    var r = knapp.getBoundingClientRect(), sido = document.querySelector('.sido').getBoundingClientRect();
    // till höger om menyknappen som sitter i mellanrummet – den ska inte hamna halvt under kortet
    var kn = document.querySelector('.sido-knapp'), knr = kn ? kn.getBoundingClientRect() : null;
    pop.style.left = Math.max(sido.right + 10, knr && knr.width ? knr.right + 10 : 0) + 'px';
    pop.style.top = Math.max(12, Math.min(innerHeight - pop.offsetHeight - 12, r.bottom - pop.offsetHeight)) + 'px';
    knapp.setAttribute('aria-expanded', 'true');
    pop.addEventListener('click', function (ev) { if (ev.target.closest('a, button')) setTimeout(stangMer, 0); });
    var poster = function () { return Array.prototype.slice.call(pop.querySelectorAll('[role="menuitem"]')); };
    pop.addEventListener('keydown', function (ev) {
      var p = poster(), n = p.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); p[(n + (ev.key === 'ArrowDown' ? 1 : -1) + p.length) % p.length].focus(); }
      else if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); p[ev.key === 'Home' ? 0 : p.length - 1].focus(); }
      else if (ev.key === 'Tab') stangMer();
    });
    var forsta = poster()[0]; if (forsta) forsta.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (ev) {
    var k = ev.target.closest && ev.target.closest('.sido__merknapp');
    if (k) { ev.preventDefault(); oppnaMer(k); return; }
    if (!(ev.target.closest && ev.target.closest('.sido__merpop'))) stangMer();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.querySelector('.sido__merpop')) { stangMer(true); ev.stopPropagation(); } }, true);
  // Vid sidbyte räknas menyn bara om när den valda raden ligger under Mer (den får aldrig döljas)
  addEventListener('hashchange', function () { stangMer(); setTimeout(function () { if (document.querySelector('.sido__nav .sido__lank.aktiv[data-sido-dold]')) anpassaSido(); }, 30); });
  var forra = IH.uppdateraMeny;
  IH.uppdateraMeny = function () { var r = forra.apply(this, arguments); anpassaSido(); return r; };
  var t = 0;
  // Menyns egen växling (IH.sidoResize) ändrar inte höjden – då behöver inget räknas om
  addEventListener('resize', function () { stangMer(); if (IH.sidoResize) return; clearTimeout(t); t = setTimeout(anpassaSido, 120); });
  try { document.fonts.ready.then(anpassaSido); } catch (x) { /* äldre webbläsare */ }
  setTimeout(anpassaSido, 0);
})();

/* Förklaringar vid hovring på hela sidan: allt med title (staplar, prickar, ikoner, knappar) visar ett mjukt
   kort direkt ovanför – i stället för webbläsarens sega gula ruta. Titeln flyttas till data-tips medan musen
   är där, så den inbyggda inte också dyker upp; den läggs tillbaka efteråt. Pekskärmar visar den vid tryck. */
(function () {
  'use strict';
  var tips = null, mal = null, visaT = 0, gomT = 0;
  function skapa() { tips = document.createElement('div'); tips.className = 'ih-tips'; tips.setAttribute('role', 'tooltip'); document.body.appendChild(tips); }
  function placera() {
    if (!mal || !tips) return;
    var r = mal.getBoundingClientRect(), b = tips.offsetWidth, h = tips.offsetHeight;
    var x = Math.max(8, Math.min(innerWidth - b - 8, r.left + r.width / 2 - b / 2)), ovan = r.top - h - 10 > 8;
    var y = ovan ? r.top - h - 10 : r.bottom + 10;
    tips.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    tips.classList.toggle('under', !ovan);
    tips.style.setProperty('--pil', Math.round(r.left + r.width / 2 - x) + 'px');
  }
  function visa(el) {
    var text = el.getAttribute('data-tips') || el.getAttribute('title') || el.getAttribute('aria-label'); if (!text) return;
    if (el.hasAttribute('title')) { el.setAttribute('data-tips', text); el.removeAttribute('title'); }
    if (!tips) skapa();
    mal = el; clearTimeout(gomT);
    // kortkommando sist i titeln (två mellanslag + tangent, t.ex. "Dölj menyn  [") visas som en tangent
    var tangent = '', mt = text.match(/^(.*\S)\s{2,}(\S{1,12})$/); if (mt) { text = mt[1]; tangent = mt[2]; }
    var k = text.indexOf(': '), rubrik = k > 0 && k < 40 ? text.slice(0, k) : '', resten = rubrik ? text.slice(k + 2) : text;
    tips.innerHTML = (rubrik ? '<b>' + IH.e(rubrik) + '</b>' : '') + '<span>' + IH.e(resten) + (tangent ? '<kbd>' + IH.e(tangent) + '</kbd>' : '') + '</span>';
    placera();
    clearTimeout(visaT); visaT = setTimeout(function () { if (mal === el) tips.classList.add('syns'); }, tips.classList.contains('syns') ? 0 : 140);
  }
  function gom() {
    clearTimeout(visaT);
    if (mal && mal.hasAttribute('data-tips') && !mal.hasAttribute('title')) mal.setAttribute('title', mal.getAttribute('data-tips'));
    mal = null; if (tips) { tips.classList.remove('syns'); }
  }
  // title, eller aria-label på knappar och länkar som bara är en ikon
  var hittaMal = function (t) {
    var el = t && t.closest && t.closest('[title], [data-tips], button[aria-label], a[aria-label], [role="button"][aria-label]'); if (!el || el.closest('.ih-tips')) return null;
    if (el.getAttribute('title') || el.getAttribute('data-tips')) return el;
    return el.textContent.trim() === '' ? el : null;
  };
  document.addEventListener('pointerover', function (ev) {
    if (ev.pointerType === 'touch') return;
    var el = hittaMal(ev.target); if (el === mal) return;
    if (mal) gom(); if (el) visa(el);
  });
  document.addEventListener('pointerout', function (ev) { if (mal && !mal.contains(ev.relatedTarget)) gom(); });
  document.addEventListener('pointerdown', function (ev) { if (ev.pointerType === 'touch') { var el = hittaMal(ev.target); if (el) { visa(el); clearTimeout(gomT); gomT = setTimeout(gom, 2200); } } else gom(); }, true);
  addEventListener('scroll', function () { if (mal) placera(); }, true);
  addEventListener('hashchange', gom);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') gom(); });
  document.addEventListener('focusin', function (ev) { var el = hittaMal(ev.target); if (el && el.matches(':focus-visible')) visa(el); });
  document.addEventListener('focusout', gom);
})();
