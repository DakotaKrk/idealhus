// Planlösningens överlägg i husritaren: väggarnas snitt, fönster, mått och rumsnamn ritas
// som en ritning ovanpå 3D-bilden. Allt är HTML och SVG (inga nya shaders, inga ritanrop),
// lägena projiceras från husets koordinater varje ruta som kameran rör sig, och hela
// uppritningen är en ren funktion av t (0 = inget syns, 1 = allt framme), så att den kan
// spelas baklänges och vändas mitt i.
//
// data = { L, W, vaggar: [{ x0, z0, x1, z1, i }], glas: [{ x0, z0, x1, z1 }],
//   rum: [{ namn, yta, x, z, w, d, vy }], loft: [{ x0, z0, x1, z1 }], loftYta, matt: [{ a, b, text, ut }] }
// proj(x, z, ut): husets punkt (i snitthöjd) till bildpunkter i ut[0], ut[1].

const NS = 'http://www.w3.org/2000/svg';
const klam = (x, a, b) => Math.min(b, Math.max(a, x));
const del = (t, a, b) => klam((t - a) / (b - a), 0, 1);
const utKub = x => 1 - (1 - x) ** 3;
const inUt = x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const sv = (v, n = 1) => String(Math.round(v * 10 ** n) / 10 ** n).replace('.', ',');

export function skapaPlanlager(duk, vidRum) {
  const rot = document.createElement('div');
  rot.className = 'kplanvy'; rot.hidden = true;
  rot.setAttribute('role', 'group'); rot.setAttribute('aria-label', 'Planlösning');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'kplanvy__ritning');
  const gLoft = document.createElementNS(NS, 'g'), gVagg = document.createElementNS(NS, 'g'), gGlas = document.createElementNS(NS, 'g'), gMatt = document.createElementNS(NS, 'g');
  gLoft.setAttribute('class', 'kplanvy__loft'); gVagg.setAttribute('class', 'kplanvy__vaggar'); gGlas.setAttribute('class', 'kplanvy__glas'); gMatt.setAttribute('class', 'kplanvy__matt');
  svg.append(gLoft, gVagg, gGlas, gMatt);
  const lappar = document.createElement('div');
  lappar.className = 'kplanvy__lappar';
  rot.append(svg, lappar);
  (duk.parentNode || document.body).insertBefore(rot, duk.nextSibling);
  rot.addEventListener('click', e => {
    const b = e.target.closest('[data-plan-rum]');
    if (b && typeof vidRum === 'function') vidRum(+b.getAttribute('data-plan-rum'));
  });

  let D = null, syns = false;
  const el = { vagg: [], glas: [], loft: [], matt: [], rum: [], loftLapp: null };
  const p = [0, 0], q = [0, 0], r = [0, 0], s = [0, 0];
  const bana = (tag, grupp) => { const e = document.createElementNS(NS, tag); grupp.appendChild(e); return e; };

  function satt(data) {
    D = data;
    gLoft.textContent = ''; gVagg.textContent = ''; gGlas.textContent = ''; gMatt.textContent = ''; lappar.textContent = '';
    // två banor för alla väggar: en ljus kontur underst och den mörka snittytan överst
    // (konturen syns då aldrig i skarvarna mellan väggbitarna)
    el.vagg = [bana('path', gVagg), bana('path', gVagg)];
    el.vagg[0].setAttribute('class', 'kplanvy__kontur'); el.vagg[1].setAttribute('class', 'kplanvy__snitt');
    el.glas = D.glas.map(() => bana('path', gGlas));
    el.loft = D.loft.map(() => bana('path', gLoft));
    el.matt = D.matt.map(m => {
      const g = bana('g', gMatt), linje = bana('path', g);
      const lapp = document.createElement('span');
      lapp.className = 'kplanvy__mattal'; lapp.textContent = m.text;
      lappar.appendChild(lapp);
      return { g, linje, lapp };
    });
    el.rum = D.rum.map((R, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kplanvy__rum'; b.setAttribute('data-plan-rum', String(i));
      b.setAttribute('aria-label', R.namn + (R.yta ? ', ' + sv(R.yta) + ' kvadratmeter' : '') + '. Gå in i rummet');
      const n = document.createElement('b'); n.textContent = R.namn; b.appendChild(n);
      if (R.yta) { const y = document.createElement('span'); y.textContent = sv(R.yta) + ' m²'; b.appendChild(y); }
      lappar.appendChild(b);
      return b;
    });
    el.loftLapp = null;
    if (D.loft.length) {
      const l = document.createElement('span');
      l.className = 'kplanvy__lofttext'; l.textContent = 'Loft ovanför' + (D.loftYta ? ' · ' + sv(D.loftYta) + ' m²' : '');
      lappar.appendChild(l); el.loftLapp = l;
    }
  }

  // en rektangel i planet, uppritad från sin ena kortsida till andelen k
  function rekt(proj, o, k) {
    let { x0, z0, x1, z1 } = o;
    if (k < 1) { if (x1 - x0 >= z1 - z0) x1 = x0 + (x1 - x0) * k; else z1 = z0 + (z1 - z0) * k; }
    proj(x0, z0, p); proj(x1, z0, q); proj(x1, z1, r); proj(x0, z1, s);
    return 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + 'L' + r[0].toFixed(1) + ' ' + r[1].toFixed(1) + 'L' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'Z';
  }

  // t 0..1: väggarna ritas upp (0,36–0,78), fönster och loft (0,6–0,85), mått (0,62–0,9),
  // rumsnamnen ett efter ett (0,66–1). B, H: bildens storlek i CSS-pixlar.
  function rita(proj, t, B, H) {
    if (!D) return;
    const visa = t > 0.34;
    if (visa !== syns) { syns = visa; rot.hidden = !visa; }
    if (!visa) return;
    let vd = '';
    for (let i = 0; i < D.vaggar.length; i++) {
      const o = D.vaggar[i], a = 0.36 + 0.3 * (o.i / Math.max(1, D.nOrdning)), k = inUt(del(t, a, a + 0.12));
      if (k > 0) vd += rekt(proj, o, k);
    }
    el.vagg[0].setAttribute('d', vd); el.vagg[1].setAttribute('d', vd);
    const kg = utKub(del(t, 0.6, 0.85));
    gGlas.style.opacity = kg; gLoft.style.opacity = kg;
    if (kg > 0) {
      for (let i = 0; i < el.glas.length; i++) el.glas[i].setAttribute('d', rekt(proj, D.glas[i], 1));
      for (let i = 0; i < el.loft.length; i++) el.loft[i].setAttribute('d', rekt(proj, D.loft[i], 1));
    }
    // måttlinjerna: växer ut från mitten, talet tonar in
    for (let i = 0; i < el.matt.length; i++) {
      const m = D.matt[i], E = el.matt[i], k = utKub(del(t, 0.62 + i * 0.05, 0.88 + i * 0.05));
      E.g.style.opacity = k; E.lapp.style.opacity = utKub(del(t, 0.74 + i * 0.05, 0.94 + i * 0.05));
      if (k <= 0) continue;
      const mx = (m.a[0] + m.b[0]) / 2, mz = (m.a[1] + m.b[1]) / 2;
      proj(mx + (m.a[0] - mx) * k, mz + (m.a[1] - mz) * k, p); proj(mx + (m.b[0] - mx) * k, mz + (m.b[1] - mz) * k, q);
      // tvärstreck i ändarna (6 px), vinkelrätt mot linjen
      const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy) || 1, nx = -dy / n * 6, ny = dx / n * 6;
      E.linje.setAttribute('d', 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) +
        'M' + (p[0] - nx).toFixed(1) + ' ' + (p[1] - ny).toFixed(1) + 'L' + (p[0] + nx).toFixed(1) + ' ' + (p[1] + ny).toFixed(1) +
        'M' + (q[0] - nx).toFixed(1) + ' ' + (q[1] - ny).toFixed(1) + 'L' + (q[0] + nx).toFixed(1) + ' ' + (q[1] + ny).toFixed(1));
      proj(mx + m.ut[0], mz + m.ut[1], r);
      E.lapp.style.transform = 'translate(' + r[0].toFixed(1) + 'px,' + r[1].toFixed(1) + 'px) translate(-50%,-50%)';
    }
    // rumsnamnen: en efter en, 10 px upp på plats; små rum får en mindre lapp
    const nR = el.rum.length, steg = Math.min(0.045, 0.2 / Math.max(1, nR));
    proj(0, 0, p); proj(1, 0, q);
    const pxm = Math.hypot(q[0] - p[0], q[1] - p[1]);   // bildpunkter per meter
    for (let i = 0; i < nR; i++) {
      const R = D.rum[i], b = el.rum[i], k = utKub(del(t, 0.66 + i * steg, 0.84 + i * steg));
      b.style.opacity = k;
      b.style.pointerEvents = k > 0.6 ? '' : 'none';
      if (k <= 0) continue;
      proj(R.x, R.z, p);
      // håll lappen inom bilden (smal vy)
      const x = klam(p[0], 34, B - 34), y = klam(p[1], 20, H - 20);
      b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y + (1 - k) * 10).toFixed(1) + 'px) translate(-50%,-50%) scale(' + (0.94 + 0.06 * k).toFixed(3) + ')';
      const liten = Math.min(R.w, R.d * 1.6) * pxm < 86;
      if (liten !== b.classList.contains('kplanvy__rum--liten')) b.classList.toggle('kplanvy__rum--liten', liten);
    }
    if (el.loftLapp) {
      const L0 = D.loft[0];
      el.loftLapp.style.opacity = utKub(del(t, 0.8, 1));
      // utanför norra ytterväggen, mitt för loftet (inne i huset krockar den med rumsnamnen)
      // (skjuts ut från väggen i bildens led, så att den går fri även när huset är vridet)
      proj((L0.x0 + L0.x1) / 2, -D.W / 2, p); proj((L0.x0 + L0.x1) / 2, 0, q);
      const ux = p[0] - q[0], uy = p[1] - q[1], un = Math.hypot(ux, uy) || 1, ut = Math.abs(ux / un) * 74 + Math.abs(uy / un) * 12 + 9;
      el.loftLapp.style.transform = 'translate(' + (p[0] + ux / un * ut).toFixed(1) + 'px,' + (p[1] + uy / un * ut).toFixed(1) + 'px) translate(-50%,-50%)';
    }
  }
  function gom() { if (syns) { syns = false; rot.hidden = true; } }
  return { satt, rita, gom, rot };
}
