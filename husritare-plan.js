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
  // lapparnas storlekar: hel, liten, bara namnet
  const KLASS = ['', ' kplanvy__rum--liten', ' kplanvy__rum--mini'];
  let matB = 0, matH = 0, block = [], rumMatt = [], mattMatt = [], loftMatt = [0, 0], lage = [];
  const lador = [];   // lappar som redan står på plats den här rutan
  const el = { vagg: [], glas: [], loft: [], matt: [], rum: [], loftLapp: null };
  const p = [0, 0], q = [0, 0], r = [0, 0], s = [0, 0];
  const bana = (tag, grupp) => { const e = document.createElementNS(NS, tag); grupp.appendChild(e); return e; };

  function satt(data) {
    D = data; matB = 0;
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
    if (matB !== B || matH !== H) matUpp(B, H);
    lador.length = 0;
    // hela ritningens skyltar i samma skala: 1 på datorn, mindre i en mindre scen (som en
    // förminskad ritning), men aldrig så små att texten blir svår att läsa
    const skala = klam(Math.min(B / 820, H / 500), 0.86, 1);
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
      // talet vid linjens mitt; ligger något i vägen (hörnknapp, bildkant) glider det längs linjen
      proj(mx + m.ut[0], mz + m.ut[1], r);
      const lw = (mattMatt[i] || [44, 22])[0] * skala, lh = (mattMatt[i] || [44, 22])[1] * skala;
      let lx = r[0], ly = r[1];
      if (!fri(lx, ly, lw, lh, B, H)) {
        // längs linjen, sedan på linjens insida (mellan linjen och väggen), också längs linjen
        proj(mx - m.ut[0] * 0.75, mz - m.ut[1] * 0.75, s);
        let hitt = false;
        for (const [bx, by] of [[r[0], r[1]], [s[0], s[1]]]) {
          for (const f of [0, 0.18, -0.18, 0.32, -0.32, 0.44, -0.44]) { if (fri(bx + dx * f, by + dy * f, lw, lh, B, H)) { lx = bx + dx * f; ly = by + dy * f; hitt = true; break; } }
          if (hitt) break;
        }
      }
      lx = klam(lx, lw / 2 + 4, B - lw / 2 - 4); ly = klam(ly, lh / 2 + 4, H - lh / 2 - 4);
      lador.push([lx - lw / 2, ly - lh / 2, lx + lw / 2, ly + lh / 2]);
      E.lapp.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) translate(-50%,-50%) scale(' + skala.toFixed(3) + ')';
    }
    // rumsnamnen: en efter en, 10 px upp på plats; små rum får en mindre lapp
    const nR = el.rum.length, steg = Math.min(0.045, 0.2 / Math.max(1, nR));
    proj(0, 0, p); proj(1, 0, q);
    const pxm = Math.hypot(q[0] - p[0], q[1] - p[1]);   // bildpunkter per meter
    // 1) alla rum får samma sorts lapp som på datorn (namn och yta), i rummets mitt; på en
    // mindre skärm är hela ritningen mindre (skala s), inte lapparna olika
    for (let i = 0; i < nR; i++) {
      const R = D.rum[i], L = lage[i];
      proj(R.x, R.z, p); proj(R.x - R.w / 2, R.z - R.d / 2, q); proj(R.x + R.w / 2, R.z + R.d / 2, r);
      L.x = p[0]; L.y = p[1]; L.k = 0; L.a = Math.abs(r[0] - q[0]) * Math.abs(r[1] - q[1]);
    }
    // 2) lappar som krockar flyttas isär (den i det mindre rummet flyttas mest)
    const mattLapp = i => [rumMatt[i][0][0] * skala, rumMatt[i][0][1] * skala];
    for (let varv = 0; varv < 8; varv++) {
      let krock = false;
      for (let i = 0; i < nR; i++) for (let j = i + 1; j < nR; j++) {
        const A = lage[i], C = lage[j], sa = mattLapp(i), sc = mattLapp(j);
        const ox = (sa[0] + sc[0]) / 2 + 4 - Math.abs(A.x - C.x), oy = (sa[1] + sc[1]) / 2 + 4 - Math.abs(A.y - C.y);
        if (ox <= 0 || oy <= 0) continue;
        krock = true;
        const fa = A.a <= C.a ? 0.7 : 0.3;   // andelen av flytten som det mindre rummets lapp tar
        if (ox < oy) { const d = (ox + 0.5) * (A.x < C.x ? -1 : 1); A.x += d * fa; C.x -= d * (1 - fa); }
        else { const d = (oy + 0.5) * (A.y < C.y ? -1 : 1); A.y += d * fa; C.y -= d * (1 - fa); }
      }
      if (!krock) break;
    }
    // 3) inom bilden, fria från knappar i hörnen, verktygsraden och måttalen; sedan på plats
    const hinder = block.concat(lador.map(l => [l[0] - 3, l[1] - 3, l[2] + 3, l[3] + 3]));
    for (let i = 0; i < nR; i++) {
      const b = el.rum[i], L = lage[i], [w, h] = mattLapp(i), k = utKub(del(t, 0.66 + i * steg, 0.84 + i * steg));
      // (upp till tre varv: en flytt bort från ett hinder kan hamna i ett annat, t.ex. ett måttal)
      for (let varv = 0; varv < 3; varv++) {
        let flytt = false;
        for (const bl of hinder.concat(lador)) {
          const ox = Math.min(L.x + w / 2, bl[2]) - Math.max(L.x - w / 2, bl[0]), oy = Math.min(L.y + h / 2, bl[3]) - Math.max(L.y - h / 2, bl[1]);
          if (ox > 0 && oy > 0) { flytt = true; if (oy <= ox) L.y += (L.y < (bl[1] + bl[3]) / 2 ? -oy - 1 : oy + 1); else L.x += (L.x < (bl[0] + bl[2]) / 2 ? -ox - 1 : ox + 1); }
        }
        if (!flytt) break;
      }
      L.x = klam(L.x, w / 2 + 4, B - w / 2 - 4); L.y = klam(L.y, h / 2 + 4, H - h / 2 - 4);
      lador.push([L.x - w / 2, L.y - h / 2, L.x + w / 2, L.y + h / 2]);
      b.style.opacity = k;
      b.style.pointerEvents = k > 0.6 ? '' : 'none';
      if (k > 0) b.style.transform = 'translate(' + L.x.toFixed(1) + 'px,' + (L.y + (1 - k) * 10).toFixed(1) + 'px) translate(-50%,-50%) scale(' + (skala * (0.94 + 0.06 * k)).toFixed(3) + ')';
    }
    // loftets text i ritningens marginal, fri från ytterväggen: ovanför huset mitt för loftet,
    // annars under huset, annars vid sidan; aldrig på väggen
    if (el.loftLapp) {
      el.loftLapp.style.opacity = utKub(del(t, 0.8, 1));
      let hx0 = 1e9, hy0 = 1e9, hx1 = -1e9, hy1 = -1e9, lx0 = 1e9, lx1 = -1e9;
      for (const [x, z] of [[-D.L / 2, -D.W / 2], [D.L / 2, -D.W / 2], [D.L / 2, D.W / 2], [-D.L / 2, D.W / 2]]) { proj(x, z, p); hx0 = Math.min(hx0, p[0]); hx1 = Math.max(hx1, p[0]); hy0 = Math.min(hy0, p[1]); hy1 = Math.max(hy1, p[1]); }
      for (const o of D.loft) for (const [x, z] of [[o.x0, o.z0], [o.x1, o.z1]]) { proj(x, z, p); lx0 = Math.min(lx0, p[0]); lx1 = Math.max(lx1, p[0]); }
      const w = loftMatt[0] * skala, h = loftMatt[1] * skala, cx = klam((lx0 + lx1) / 2, hx0 + w / 2, hx1 - w / 2), u = 10;
      const val = [[cx, hy0 - u - h / 2], [B / 2, hy0 - u - h / 2], [cx, hy1 + u + h / 2], [B / 2, hy1 + u + h / 2], [hx1 + u + w / 2, (hy0 + hy1) / 2], [hx0 - u - w / 2, (hy0 + hy1) / 2]];
      const pl = val.find(v => fri(v[0], v[1], w, h, B, H)) || val[0];
      lador.push([pl[0] - w / 2, pl[1] - h / 2, pl[0] + w / 2, pl[1] + h / 2]);
      el.loftLapp.style.transform = 'translate(' + klam(pl[0], w / 2 + 4, B - w / 2 - 4).toFixed(1) + 'px,' + klam(pl[1], h / 2 + 4, H - h / 2 - 4).toFixed(1) + 'px) translate(-50%,-50%) scale(' + skala.toFixed(3) + ')';
    }
  }
  // ligger en lapp (mitt x, y; bredd, höjd) fritt: inom bilden och inte över knappar eller andra lappar
  function fri(x, y, w, h, B, H) {
    const a = x - w / 2, b = y - h / 2, c = x + w / 2, d = y + h / 2;
    if (a < 4 || b < 4 || c > B - 4 || d > H - 4) return false;
    for (const l of block) if (a < l[2] && c > l[0] && b < l[3] && d > l[1]) return false;
    for (const l of lador) if (a < l[2] + 3 && c > l[0] - 3 && b < l[3] + 3 && d > l[1] - 3) return false;
    return true;
  }
  // Mäts en gång per bildstorlek: lapparnas mått i sina tre storlekar, måttalens och loftets
  // mått, och det som ligger i vägen i scenen (verktygsraden, hörnknappen, kartan).
  function matUpp(B, H) {
    matB = B; matH = H;
    const r0 = rot.getBoundingClientRect();
    block = [];
    (rot.parentNode || document).querySelectorAll('.kf__verktyg, .kf__full, .kf__karta, .kf__rum > div').forEach(e => {
      if (e.closest('[hidden]')) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
      const rr = e.getBoundingClientRect();
      if (rr.width > 1 && rr.height > 1) block.push([rr.left - r0.left - 6, rr.top - r0.top - 6, rr.right - r0.left + 6, rr.bottom - r0.top + 6]);
    });
    // en storlek för alla (som på datorn); skalan läggs på vid placeringen
    rumMatt = el.rum.map(b => { b.className = 'kplanvy__rum'; return [[b.offsetWidth, b.offsetHeight]]; });
    mattMatt = el.matt.map(E => [E.lapp.offsetWidth, E.lapp.offsetHeight]);
    loftMatt = el.loftLapp ? [el.loftLapp.offsetWidth, el.loftLapp.offsetHeight] : [0, 0];
    lage = el.rum.map(() => ({ x: 0, y: 0, k: 0, a: 0 }));
  }
  function gom() { if (syns) { syns = false; rot.hidden = true; } }
  return { satt, rita, gom, rot };
}
