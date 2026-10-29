/* Legohus CRM – gästsidan för videomöten (mote-gast.html).
   Läser mötesinfo ur adressens #-del (skickas aldrig till servern), begränsar längderna och öppnar
   videomötet som gäst: förhandsvisning → Be att få gå med → väntrum → mötet → tack.
   Laddar inte app.js/data.js och läser aldrig IH.db. Adress:
   mote-gast.html#m=<rumskod>&n=<namn>&t=<titel>&v=<värdens namn>&s=<start ISO>&l=<längd i minuter> */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  if (!IH.e) {
    IH.e = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
  }
  // Bara tecken som kan stå i en text – inga styrtecken
  function ren(v, max) {
    var ut = '';
    String(v || '').split('').forEach(function (c) { var k = c.charCodeAt(0); ut += (k < 32 || k === 127 || k === 8232 || k === 8233) ? ' ' : c; });
    return ut.replace(/ +/g, ' ').trim().slice(0, max);
  }
  function lasParametrar() {
    var h = location.hash.replace(/^#/, ''), p = {};
    h.split('&').forEach(function (del) {
      var i = del.indexOf('='); if (i < 1) return;
      var k = del.slice(0, i), v = del.slice(i + 1);
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { v = ''; }
      if (/^[mntvsl]$/.test(k)) p[k] = v;
    });
    var start = ren(p.s, 40), d = start ? new Date(start) : null;
    return {
      rum: ren(p.m, 40).toLowerCase().replace(/[^a-z0-9-]/g, ''),
      namn: ren(p.n, 60),
      titel: ren(p.t, 120) || 'Videomöte med Legohus',
      vardNamn: ren(p.v, 60),
      start: d && !isNaN(d) ? d.toISOString() : null,
      langd: Math.max(5, Math.min(600, parseInt(p.l, 10) || 45))
    };
  }
  function visaFel() {
    var h = document.getElementById('gast-huvud');
    if (!h) return;
    h.innerHTML = '<div class="gast-fel" role="alert"><h1>Länken är ofullständig</h1><p>Be den som bjöd in dig om en ny länk.</p></div>';
    document.title = 'Länken är ofullständig · Legohus';
  }
  function start() {
    var p = lasParametrar();
    if (!p.rum || p.rum.length < 6) { visaFel(); return; }
    var sparat = '';
    try { sparat = localStorage.getItem('ih-crm-videomote:gast-namn') || ''; } catch (e) { sparat = ''; }
    document.title = p.titel + ' · Legohus';
    if (!IH.samtalUi) { visaFel(); return; }
    IH.samtalUi.oppna({
      mote: { rum: p.rum, titel: p.titel, start: p.start, langd: p.langd, vardNamn: p.vardNamn, vantrum: true },
      roll: 'gast',
      jag: { namn: p.namn || ren(sparat, 60) }
    });
  }
  // Ny länk i samma flik (t.ex. inklistrad): börja om
  window.addEventListener('hashchange', function () { location.reload(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
