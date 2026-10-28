/* Legohus CRM – detaljer flyttade från Uperformance CRM (2026-10-28).
   Antalsfälten: varje tal-ruta i ett formulärfält (.falt) får egna runda − och + i högerkanten i stället
   för webbläsarens små pilar. Knapparna ligger utanför tabbordningen och tar aldrig fokus – rutan är redan
   en spinbutton (piltangenterna fungerar). data-nativ undantar. Körs vid start och av en observatör när
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
    const steg = Number(inp.step) || 1; const min = inp.min !== '' ? Number(inp.min) : -Infinity; const max = inp.max !== '' ? Number(inp.max) : Infinity;
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

/* Magneten (från Uperformance): menyknappen och den minimerade chatten dras mjukt mot musen när den är nära. */
(() => {
  'use strict';
  if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SEL = '.sido-knapp, .chf-ikon';
  let ram = 0;
  document.addEventListener('mousemove', (ev) => {
    if (ram) return;
    ram = requestAnimationFrame(() => {
      ram = 0;
      document.querySelectorAll(SEL).forEach((el) => {
        const r = el.getBoundingClientRect(); if (!r.width) return;
        const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
        el.style.translate = d < 90 ? `${(dx / 90) * 6}px ${(dy / 90) * 6}px` : '';
      });
    });
  }, { passive: true });
})();

/* Sidomenyn tätare i steg tills allt får plats (som anpassaSido i Uperformance): först lägre rader, sedan mindre
   rubriker, sist utan rubriker – menyn rullar bara om det ändå inte räcker. */
(function () {
  'use strict';
  var IH = window.IH;
  function anpassaSido() {
    var nav = document.querySelector('.sido__nav'), html = document.documentElement;
    if (!nav || !nav.getClientRects().length) return;
    var fore = html.getAttribute('data-sido-tat');
    html.removeAttribute('data-sido-tat');
    var over = function () { return nav.scrollHeight > nav.clientHeight + 1; };
    ['1', '2', '3'].forEach(function (steg) { if (over()) html.setAttribute('data-sido-tat', steg); });
    nav.dispatchEvent(new Event('scroll'));
    // Markören under valt menyval flyttas med när raderna blir lägre
    if (html.getAttribute('data-sido-tat') !== fore) dispatchEvent(new Event('resize'));
  }
  var forra = IH.uppdateraMeny;
  IH.uppdateraMeny = function () { var r = forra.apply(this, arguments); anpassaSido(); return r; };
  var t = 0;
  addEventListener('resize', function () { clearTimeout(t); t = setTimeout(anpassaSido, 120); });
  try { document.fonts.ready.then(anpassaSido); } catch (x) { /* äldre webbläsare */ }
  setTimeout(anpassaSido, 0);
})();
