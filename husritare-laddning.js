// Bygg online: logotypen på laddningssidan ritas i en egen tråd (2026-11-27, "som Uperformance", "utan hack").
// Samma idé som Uperformance-CRM:ets laddning: husritarens skript och 3D-kompileringen håller huvudtråden upptagen
// i upp till en sekund i taget under de första sekunderna, och en SVG-animation (stroke-dashoffset) står då still.
// Här ritas loggan på en OffscreenCanvas i en Worker, så att uppritningen flyter oavsett vad huvudtråden gör.
// Tidslinjen är densamma som SVG-reserven i husritare-app.css: konturerna dras (taket, väggarna, ordet bokstav för
// bokstav), ytorna fylls, konturerna tonar bort. Delarna, längderna och färgen mäts på sidan (rita-hus.html, skriptet
// efter .bintro) och skickas hit; när ytorna står klara svarar tråden 'ritad'.
'use strict';
let duk = null, ctx = null, kor = false, fart = 1, delar = null, farg = '#1b1915', skala = 1, start = 0, raf = 0, svarat = false, stopp = false;
const NU = () => performance.now();
const ram = typeof requestAnimationFrame === 'function' ? f => requestAnimationFrame(f) : f => setTimeout(() => f(NU()), 16);

// cubic-bezier som i CSS (Newton–Raphson, sedan bisektion)
function bezier(x1, y1, x2, y2) {
  const a = (p1, p2) => 1 - 3 * p2 + 3 * p1, b = (p1, p2) => 3 * p2 - 6 * p1, c = p1 => 3 * p1;
  const kurva = (t, p1, p2) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const lutning = (t, p1, p2) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const s = lutning(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (kurva(t, x1, x2) - x) / s; }
    if (t < 0 || t > 1 || Math.abs(kurva(t, x1, x2) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 24; i++) { const v = kurva(t, x1, x2); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return kurva(t, y1, y2);
  };
}
const RITA = bezier(0.65, 0, 0.35, 1), UT = bezier(0.22, 1, 0.36, 1), TONA = bezier(0.25, 0.1, 0.25, 1);
const del = (t, f, d) => Math.min(1, Math.max(0, (t - f) / d));

// tider i ms, samma som husritare-app.css (.bintro__marke)
function tid(p) {
  if (p.t) return p.t;                              // egen tid från sidan (sajtens entré, logga.js)
  if (p.typ === 'streck') return p.ord ? [280 + p.i * 60, 750] : [80 + p.i * 100, 800];
  if (p.typ === 'tak') return [620, 500];
  if (p.typ === 'vagg') return [550 + p.i * 80, 500];
  if (p.typ === 'ruta') return [850 + p.i * 60, 350];
  return [780 + p.i * 60, 450];                       // bokstav
}
// Bygg onlines tidslinje; sajtens entré (logga.js) skickar en kortare i m.tider
let KLAR = 1700;                                     // konturerna har tonat bort
let RITAD = 1300;                                    // ytorna står klara
let BORT = [1200, 450], TJOCK = [5, 3];              // konturernas toning och tjocklek (hus, ord)

function rita(nu) {
  raf = 0;
  if (stopp || !ctx) return;
  if (!start) start = nu;
  const t = (nu - start) * fart;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, duk.width, duk.height);
  // SVG:ns viewBox är -6 -6 1250 316
  ctx.setTransform(skala, 0, 0, skala, 6 * skala, 6 * skala);
  ctx.fillStyle = farg; ctx.strokeStyle = farg; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const p of delar) {
    if (p.typ === 'streck') continue;
    const [f, d] = tid(p), k = UT(del(t, f, d));
    if (k <= 0) continue;
    const b = p.box;
    let sx = 1, sy = 1, ox = b.x + b.w / 2, oy = b.y + b.h;
    if (p.typ === 'tak') sx = sy = 0.96 + 0.04 * k;
    else if (p.typ === 'vagg') sy = 0.9 + 0.1 * k;
    else if (p.typ === 'ruta') { sx = sy = 0.5 + 0.5 * k; oy = b.y + b.h / 2; }
    ctx.save();
    ctx.globalAlpha = k;
    if (sx !== 1 || sy !== 1) { ctx.translate(ox, oy); ctx.scale(sx, sy); ctx.translate(-ox, -oy); }
    ctx.fill(p.path);
    ctx.restore();
  }
  const bort = 1 - TONA(del(t, BORT[0], BORT[1]));
  if (bort > 0) {
    for (const p of delar) {
      if (p.typ !== 'streck') continue;
      const [f, d] = tid(p), k = RITA(del(t, f, d));
      if (k <= 0) continue;
      ctx.globalAlpha = bort;
      ctx.lineWidth = p.ord ? TJOCK[1] : TJOCK[0];
      for (const s of p.bitar) {
        ctx.setLineDash([s.len, s.len + 1]);
        ctx.lineDashOffset = s.len * (1 - k);
        ctx.stroke(s.path);
      }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  if (!svarat && t >= RITAD) { svarat = true; postMessage({ typ: 'ritad' }); }
  if (t < KLAR) raf = ram(rita);
}

function storlek(b, h) {
  if (!duk) return;
  duk.width = Math.max(1, Math.round(b)); duk.height = Math.max(1, Math.round(h));
  skala = duk.width / 1250;
  if (kor && !raf) raf = ram(rita);                 // en ny bild i rätt storlek (även efter att uppritningen är klar)
}

onmessage = e => {
  const m = e.data || {};
  if (m.typ === 'start') {
    duk = m.duk; ctx = duk.getContext('2d'); farg = m.farg || farg;
    if (m.tider) { const v = m.tider; KLAR = v.klar || KLAR; RITAD = v.ritad || RITAD; BORT = v.bort || BORT; TJOCK = v.tjock || TJOCK; }
    delar = m.delar.map(p => p.typ === 'streck'
      ? Object.assign({}, p, { bitar: p.bitar.map(s => ({ len: s.len, path: new Path2D(s.d) })) })
      : Object.assign({}, p, { path: new Path2D(p.d) }));
    storlek(m.b, m.h);
  } else if (m.typ === 'kor') {
    // sidans första målning (requestAnimationFrame på sidan): först nu syns duken, så uppritningen börjar här
    // fart: sajtens entré målas sent på en långsam sida; då ritas samma tidslinje snabbare och hinner bli färdig
    kor = true; fart = m.fart > 1 ? m.fart : 1; if (!raf) raf = ram(rita);
  } else if (m.typ === 'storlek') storlek(m.b, m.h);
  else if (m.typ === 'stopp') { stopp = true; close(); }
};
