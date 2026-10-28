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
