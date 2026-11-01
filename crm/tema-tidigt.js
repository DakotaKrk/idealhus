/* Legohus CRM – temat sätts före första ritningen (laddas synkront först i <head>, ingen blinkning).
   Valet sparas per konto i localStorage 'ih-crm-tema:<id>' (id = 'ih-crm-jag', annars 'gast').
   Inget sparat val eller "system" → systemets ljusa/mörka läge. Resten sköts av tema.js.
   Layoutläget (Minimal/Normal/Full) sätts här också, som data-layout på <html>: sparas per konto i
   'ih-crm-layout:<id>', förval Full. Bytet sköts av layout.js. */
(function () {
  var d = document.documentElement, t = null;
  try { t = localStorage.getItem('ih-crm-tema:' + (localStorage.getItem('ih-crm-jag') || 'gast')); } catch (e) { t = null; }
  if (!/^(original|ljus|mork|fargglad|bygg|office)$/.test(t || '')) {
    try { t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'mork' : 'original'; } catch (e) { t = 'original'; }
  }
  d.setAttribute('data-tema', t);
  var l = null;
  try { l = localStorage.getItem('ih-crm-layout:' + (localStorage.getItem('ih-crm-jag') || 'gast')); } catch (e) { l = null; }
  d.setAttribute('data-layout', /^(minimal|normal|full)$/.test(l || '') ? l : 'full');
  // Glasdesignen är på tills kontot stänger av den ('ih-crm-glas:<id>' = '0')
  var g = null;
  try { g = localStorage.getItem('ih-crm-glas:' + (localStorage.getItem('ih-crm-jag') || 'gast')); } catch (e) { g = null; }
  if (g !== '0') d.setAttribute('data-glas', '');
  // Mobilens adressfält i rätt färg direkt (Original behåller sidans egen; tema.js håller den i takt vid byten).
  var farg = { ljus: '#fcfcfa', mork: '#151311', fargglad: '#fff7ee', bygg: '#e9e7e3', office: '#f3f4f6' }[t];
  try {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) { m.setAttribute('data-original', m.getAttribute('content') || ''); if (farg) m.setAttribute('content', farg); }
  } catch (e) { /* */ }
})();
