// husritare-blommor.js – riktiga svenska trädgårdsblommor och rabatter i husritarens miljöer.
//
// Blommor och blad är alfakort (korsade och lutade quads, böjda remsor för funkians blad) med en procedurellt målad
// texturatlas (canvas, 2048 px; 1024 på svaga enheter): kronblad med ljusgradient och ådring, bladformer per art,
// mjuka kanter och alfa. Vita och grå delar i atlasen (rosor, pioner, pelargon, lupiner, prästkragar) färgas per
// planta i skuggaren; färgade delar (blad, lavendel, salvia, tagetes, gula mittar) behåller sin färg.
// Arter: lavendel, stäppsalvia, kattmynta, buskros, pion, prästkrage, margerit, pelargon, funkia, lupin, tagetes,
// ringblomma, prydnadsgräs. Varje art har tre varianter (två detaljnivåer); plantorna bakas ihop till ETT nät per
// grupp (ett ritanrop för alla blommor i miljön), med vind i hörnskuggaren och lätt genomlysning.
// Rabatterna: mörk mylla med barkflis (målad, upprepad textur) i ett nät med mjuk, organisk kant (avståndsfält per
// hörn + kornig kant i fragmentskuggaren), lätt kupad mot mitten. Stenarna är Poly Havens skannade block (natur).
//
// API (skapaBlommor(THREE, { VU, LJUS, ANISO, MSAA }) i husritare-miljo.js; övriga moduler importerar { blommor }):
//   blommor.klar()                         true när modulen startats (annars används de gamla blommorna)
//   blommor.grupp(poster, namn)            poster [{ art, x, y, z, s?, ry?, f?: [r, g, b], lod? }] → Mesh (ett ritanrop)
//   blommor.rabattRand(o) / rabattRund(o)  → { poster, badd, stenar } (se funktionerna)
//   blommor.baddar(lista, namn)            bäddarna → Mesh (ett ritanrop)
//   blommor.av()                           true med ?blommor=0 (för jämförelser)
let THREE = null, K = null, ATLAS = null, MAT = null, JMAT = null;
const AV = (() => { try { return /[?&]blommor=0/.test(location.search); } catch (e) { return false; } })();
const SVAG = (() => { try { return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 760; } catch (e) { return false; } })();
function slump(s) { s = (s >>> 0) % 2147483646 + 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ---- atlasens rutor: [kolumn, rad, bredd, höjd] i enheter om 256 px (8 × 8) ----
const CELL = {
  lavAx: [0, 0, 1, 2], salAx: [1, 0, 1, 2], lupAx: [2, 0, 1, 2], lavBlad: [3, 0, 1, 2], gronTuva: [4, 0, 1, 2], katt: [5, 0, 2, 2],
  ros: [7, 0, 1, 1], rosKnopp: [7, 1, 1, 1],
  rosBlad: [0, 2, 2, 2], pion: [2, 2, 2, 2], pionBlad: [4, 2, 2, 2], funkia: [6, 2, 2, 2],
  prast: [0, 4, 1, 1], tagetes: [1, 4, 1, 1], ringbl: [2, 4, 1, 1], pelBlom: [3, 4, 1, 1], pelBlad: [4, 4, 1, 1], lupBlad: [5, 4, 1, 1],
  stjalk: [6, 4, 1, 1], tagBlad: [7, 4, 1, 1], salBlad: [0, 5, 1, 1], pionKnopp: [1, 5, 1, 1], grasTuva: [2, 5, 1, 2], vippa: [3, 5, 1, 2],
  kattTopp: [4, 5, 2, 2],
};
// stjälkrutans remsor (u-intervall inom rutan): grön, mörkt lila (salvia), gråáltal (lavendel), rödbrun (ros, pion)
const STJ = { gron: [0.04, 0.2], lila: [0.29, 0.45], gra: [0.54, 0.7], rod: [0.79, 0.95] };

// ---- målning ----
const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0])) | 0},${Math.max(0, Math.min(255, c[1])) | 0},${Math.max(0, Math.min(255, c[2])) | 0},${a})`;
const ljus = (c, k) => c.map(v => v * k);
// blad/kronblad längs en böjd mittlinje: bas (x, y), riktning ang (0 = uppåt), längd, halv bredd, profil p(t),
// böj (sidledes, andel av längden), färg vid basen → spetsen; nerv: mittnerv och sidonerver; tand: sågtandad kant
function blad(g, x, y, ang, len, wid, prof, bk, c0, c1, o = {}) {
  const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx, n = 18, L = [], R = [], M = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mx = x + dx * len * t + nx * bk * len * t * t, my = y + dy * len * t + ny * bk * len * t * t;
    let w = wid * prof(t);
    if (o.tand) w *= 1 + o.tand * (Math.abs(Math.sin(t * Math.PI * (o.tandN || 7))) - 0.5);
    if (o.flik) w *= 1 + o.flik * Math.sin(t * Math.PI * (o.flikN || 3));
    const tx = dx + 2 * nx * bk * t, ty = dy + 2 * ny * bk * t, tl = Math.hypot(tx, ty), px = -ty / tl, py = tx / tl;
    L.push([mx + px * w, my + py * w]); R.push([mx - px * w, my - py * w]); M.push([mx, my, px, py, w]);
  }
  const gr = g.createLinearGradient(x, y, x + dx * len, y + dy * len);
  gr.addColorStop(0, css(c0)); gr.addColorStop(1, css(c1));
  if (o.mitt) gr.addColorStop(0.5, css(o.mitt));
  g.fillStyle = gr; g.beginPath(); g.moveTo(...L[0]);
  for (const p of L) g.lineTo(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath(); g.fill();
  // kantljus (blanka blad) eller mörk kant
  if (o.kant) { g.strokeStyle = css(o.kant, 0.35); g.lineWidth = Math.max(0.8, wid * 0.08); g.stroke(); }
  if (o.nerv) {
    g.strokeStyle = css(o.nerv, o.nervA || 0.55); g.lineWidth = Math.max(0.7, wid * (o.nervB || 0.09)); g.beginPath();
    M.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    if (o.sido) {
      g.lineWidth = Math.max(0.5, wid * 0.045); g.strokeStyle = css(o.nerv, (o.nervA || 0.55) * 0.6);
      for (let i = 2; i < n - 1; i += o.sidoSteg || 2) for (const s of [-1, 1]) {
        const p = M[i], q = M[Math.min(n, i + (o.sidoVinkel || 3))];
        g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + s * p[2] * p[4] * 0.5, p[1] + s * p[3] * p[4] * 0.5, q[0] + s * q[2] * q[4] * 0.9, q[1] + s * q[3] * q[4] * 0.9); g.stroke();
      }
    }
  }
}
const P = {
  lans: t => Math.pow(Math.sin(Math.PI * t), 0.8) * (1 - 0.35 * t),
  smal: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * (1 - 0.6 * t),
  oval: t => Math.pow(Math.sin(Math.PI * t), 0.6),
  agg: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.55),            // äggrund, bredast nära basen (funkia)
  kron: t => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.25)), 0.55),           // kronblad, bredast ute
  spets: t => (1 - t) * Math.pow(Math.min(1, t * 6), 0.5),
};
function ell(g, x, y, rx, ry, rot, fill) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot, 0, Math.PI * 2); g.fill(); }
// kronblad som pekar ut från (cx, cy) i vinkel a: bas mörkare, spets ljus, fina ådror
function kron(g, cx, cy, a, len, wid, c0, c1, r, adra = 0.12) {
  blad(g, cx, cy, a, len, wid, P.kron, (r() - 0.5) * 0.12, c0, c1, { kant: ljus(c1, 1.05) });
  if (adra) {
    g.strokeStyle = css(ljus(c0, 0.85), adra); g.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { const b = a + k * wid / len * 0.35; g.beginPath(); g.moveTo(cx + Math.sin(a) * len * 0.1, cy - Math.cos(a) * len * 0.1); g.lineTo(cx + Math.sin(b) * len * 0.85, cy - Math.cos(b) * len * 0.85); g.stroke(); }
  }
}

const MALA = {
  // lavendel: kransar av små lila blommor med grålila foder, glesare nertill, spetsig topp
  lavAx(g, W, H, r) {
    for (let k = 0; k < 3; k++) {
      const x0 = W * (0.22 + k * 0.28), n = 10;
      g.strokeStyle = css(hx('#7d8a6c')); g.lineWidth = 3; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H * 0.06); g.stroke();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), y = H * (0.97 - 0.9 * Math.pow(t, 0.85)) - (i === 0 ? 0 : H * 0.05), bw = W * 0.09 * (1 - 0.55 * t) + 3;
        for (let j = 0; j < 9; j++) {
          const u = (j / 8 - 0.5) * 2, x = x0 + u * bw + (r() - 0.5) * 3, yy = y + (r() - 0.5) * H * 0.03 - Math.abs(u) * 4;
          const fo = mix(hx('#4e3f6e'), hx('#66548a'), r()), bl = mix(hx('#6a3fb4'), hx('#9877da'), r());
          ell(g, x, yy + 5, 5, 9, u * 0.4, css(fo));
          ell(g, x + u * 2, yy - 3, 6.5 + r() * 2.5, 8, u * 0.5, css(bl));
          ell(g, x + u * 2 - 1, yy - 5, 2.2, 2.4, 0, css(ljus(bl, 1.18), 0.8));
        }
      }
    }
  },
  // stäppsalvia: mörklila stjälk med blåvioletta läppblommor parvis och rödlila högblad
  salAx(g, W, H, r) {
    for (let k = 0; k < 3; k++) {
      const x0 = W * (0.2 + k * 0.3), n = 13;
      g.strokeStyle = css(hx('#4a2f52')); g.lineWidth = 3.5; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H * 0.03); g.stroke();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), y = H * (0.95 - 0.9 * t), s = 1 - 0.45 * t;
        ell(g, x0, y + 3, 7 * s, 4 * s, 0, css(hx('#6a2f6e')));
        for (const sd of [-1, 1]) {
          if (t > 0.85 && r() < 0.5) continue;
          const c = mix(hx('#4b36a6'), hx('#7a5ed6'), r()), a = sd * (0.9 + r() * 0.4);
          blad(g, x0 + sd * 3, y, a, 20 * s, 5.5 * s, P.oval, -sd * 0.15, ljus(c, 0.8), c, {});
          ell(g, x0 + sd * 15 * s, y - 2, 4 * s, 3 * s, 0, css(ljus(c, 1.15)));
        }
      }
    }
  },
  // lupin: konisk spira av ärtblommor (vit/grå, färgas per planta), gröna knoppar i toppen
  lupAx(g, W, H, r) {
    const x0 = W / 2, n = 15;
    g.strokeStyle = css(hx('#5a7a3a')); g.lineWidth = 6; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H * 0.02); g.stroke();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), y = H * (0.96 - 0.92 * t), bw = W * 0.36 * (1 - 0.72 * t) + 4, knopp = t > 0.78;
      for (let j = 0; j < 6; j++) {
        const u = (j / 5 - 0.5) * 2, x = x0 + u * bw + (r() - 0.5) * 4, s = (1 - 0.55 * t) * (0.9 + r() * 0.2);
        if (knopp) { ell(g, x, y, 7 * s, 9 * s, u * 0.3, css(mix(hx('#b7c49a'), hx('#d8dcc6'), r()))); continue; }
        ell(g, x, y + 8 * s, 15 * s, 11 * s, u * 0.2, css(hx('#9a9a9e')));              // kölen (skugga)
        ell(g, x, y - 2 * s, 17 * s, 15 * s, u * 0.3, css(mix(hx('#d6d4da'), hx('#f4f2f6'), r())));   // fanan
        ell(g, x - 2 * s, y - 5 * s, 5 * s, 4 * s, 0, css(hx('#ffffff'), 0.65));
      }
    }
  },
  // lavendelns blad: fontän av smala silvergröna blad
  lavBlad(g, W, H, r) {
    for (let i = 0; i < 110; i++) {
      const a = (r() - 0.5) * 1.7, len = H * (0.4 + r() * 0.55) * (1 - Math.abs(a) * 0.3), c = mix(hx('#56684c'), hx('#93a386'), r());
      blad(g, W / 2 + (r() - 0.5) * W * 0.3, H, a, len, 3.6 + r() * 2.2, P.smal, a * 0.35, ljus(c, 0.7), c, { nerv: ljus(c, 1.15), nervA: 0.35 });
    }
  },
  // basblad (prästkrage, salvia, margerit): mörkare gröna lansettlika blad
  gronTuva(g, W, H, r) {
    for (let i = 0; i < 26; i++) {
      const a = (r() - 0.5) * 1.8, len = H * (0.35 + r() * 0.45) * (1 - Math.abs(a) * 0.25), c = mix(hx('#3d6129'), hx('#6a9244'), r());
      blad(g, W / 2 + (r() - 0.5) * W * 0.3, H, a, len, 9 + r() * 6, P.lans, a * 0.4, ljus(c, 0.65), c, { nerv: ljus(c, 1.25), nervA: 0.4, tand: r() < 0.5 ? 0.25 : 0, tandN: 9 });
    }
  },
  // kattmynta: luftiga bågar av stjälkar med små gråaktiga hjärtblad och blålila blomkransar
  katt(g, W, H, r) {
    for (let i = 0; i < 34; i++) {
      const a = (r() - 0.5) * 2.2, len = H * (0.5 + r() * 0.45), x0 = W / 2 + (r() - 0.5) * 40, bk = (r() - 0.5) * 0.6 + a * 0.2;
      const pt = t => { const dx = Math.sin(a), dy = -Math.cos(a); return [x0 + dx * len * t - dy * bk * len * t * t, H + dy * len * t + dx * bk * len * t * t]; };
      g.strokeStyle = css(hx('#6d7d5c')); g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 12; k++) { const p = pt(k / 12); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.stroke();
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, p = pt(t);
        if (t < 0.5) for (const s of [-1, 1]) { const c = mix(hx('#6a7f60'), hx('#9aab8e'), r()); blad(g, p[0], p[1], a + s * 1.1, 17 + r() * 7, 8, P.oval, 0, ljus(c, 0.8), c, { tand: 0.3, tandN: 5 }); }
        else for (let j = 0; j < 9; j++) {
          const c = mix(hx('#6560c4'), hx('#a29ce8'), r());
          ell(g, p[0] + (r() - 0.5) * 20, p[1] + (r() - 0.5) * 14, 5 + r() * 2.5, 3.5 + r() * 1.5, r() * 3, css(c));
          ell(g, p[0] + (r() - 0.5) * 10, p[1] + (r() - 0.5) * 8, 2, 1.5, 0, css(hx('#5f6e58'), 0.7));
        }
      }
    }
  },
  // kattmyntan uppifrån: samma blomkransar i ett runt moln (lutade kort i toppen)
  kattTopp(g, W, H, r) {
    for (let i = 0; i < 380; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.46, x = W / 2 + Math.cos(a) * d, y = H / 2 + Math.sin(a) * d;
      if (r() < 0.45) { const c = mix(hx('#728669'), hx('#a3b298'), r()); blad(g, x, y, r() * 6.28, 14 + r() * 6, 6.5, P.oval, 0, ljus(c, 0.8), c, { tand: 0.3, tandN: 5 }); }
      else for (let j = 0; j < 4; j++) ell(g, x + (r() - 0.5) * 12, y + (r() - 0.5) * 12, 3.5 + r() * 2, 2.6, r() * 3, css(mix(hx('#6e6ac0'), hx('#aaa4ea'), r())));
    }
  },
  // fylld ros uppifrån (ljus, färgas per planta): yttre breda kronblad, kupade inre kransar, mörk spiral i mitten
  ros(g, W, H, r) {
    const cx = W / 2, cy = H / 2, R = W * 0.46;
    for (let k = 0; k < 4; k++) {   // fyra kransar utifrån och in
      const n = [6, 7, 7, 6][k], rr = R * [1, 0.8, 0.6, 0.4][k], off = r() * 6.28;
      for (let i = 0; i < n; i++) kron(g, cx, cy, off + i / n * 6.283, rr, rr * 0.48, mix(hx('#a8999b'), hx('#c9bcbe'), k / 3), mix(hx('#f6f0f0'), hx('#fffafa'), k / 3), r, 0.1);
      g.fillStyle = css(hx('#6a5a5c'), 0.18); g.beginPath(); g.arc(cx, cy, rr * 0.35, 0, 6.283); g.fill();
    }
    g.strokeStyle = css(hx('#8a7a7c'), 0.7); g.lineWidth = 2.2;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx + (r() - 0.5) * 6, cy + (r() - 0.5) * 6, R * (0.05 + i * 0.045), r() * 6, r() * 6 + 3.6); g.stroke(); }
  },
  // halvöppen ros från sidan: kupa av kronblad, gröna foderblad under
  rosKnopp(g, W, H, r) {
    const cx = W / 2, by = H * 0.8;
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4 - 0.5) * 2.2; blad(g, cx, by - 6, a, H * 0.28, 7, P.smal, (r() - 0.5) * 0.5, hx('#2f4c22'), hx('#4f7536'), {}); }
    for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * (1.6 - k * 0.4), c0 = mix(hx('#b5a8aa'), hx('#d8cdce'), k / 2), c1 = mix(hx('#f8f2f2'), hx('#fffcfc'), k / 2);
      blad(g, cx + (i / 4 - 0.5) * W * (0.35 - k * 0.1), by, a, H * (0.62 - k * 0.1), W * (0.2 - k * 0.03), P.oval, (r() - 0.5) * 0.2, c0, c1, { kant: hx('#ffffff') });
    }
  },
  // rosens blad: parbladiga med 5–7 sågtandade, blanka småblad, rödbruna skott
  rosBlad(g, W, H, r) {
    for (let i = 0; i < 26; i++) {
      const a = (r() - 0.5) * 2.6, x0 = W / 2 + (r() - 0.5) * W * 0.35, len = H * (0.25 + r() * 0.3), y0 = H - r() * H * 0.35;
      const dx = Math.sin(a), dy = -Math.cos(a), ung = r() < 0.06;
      g.strokeStyle = css(hx('#4a3a26')); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
      for (let k = 0; k < 3; k++) {
        const t = 0.35 + k * 0.28, px = x0 + dx * len * t, py = y0 + dy * len * t;
        for (const s of [-1, 1]) {
          const c = ung ? mix(hx('#5a4a2a'), hx('#7a6a3a'), r()) : mix(hx('#22401c'), hx('#3f6a2e'), r());
          blad(g, px, py, a + s * 1.05, 30 + r() * 10, 12 + r() * 3, P.lans, s * 0.1, ljus(c, 0.75), c, { nerv: ljus(c, 1.35), nervA: 0.45, sido: true, tand: 0.22, tandN: 8, kant: hx('#c8d8b0') });
        }
      }
      const c = mix(hx('#22401c'), hx('#3f6a2e'), r());
      blad(g, x0 + dx * len, y0 + dy * len, a, 34 + r() * 8, 13, P.lans, 0, ljus(c, 0.75), c, { nerv: ljus(c, 1.35), nervA: 0.45, sido: true, tand: 0.22, tandN: 8, kant: hx('#c8d8b0') });
    }
  },
  // fylld pion uppifrån: breda skyddsblad ytterst och en kupol av krusiga, tätt packade kronblad
  pion(g, W, H, r) {
    const cx = W / 2, cy = H / 2, R = W * 0.47;
    for (let i = 0; i < 8; i++) kron(g, cx, cy, i / 8 * 6.283 + r() * 0.3, R, R * 0.5, hx('#a39a9c'), hx('#f4efef'), r, 0.14);
    for (let i = 0; i < 150; i++) {
      const t = Math.pow(i / 150, 0.8), a = r() * 6.283, d = R * 0.78 * (1 - t) * Math.sqrt(r() * 0.5 + 0.5), l = R * (0.32 - 0.16 * t) * (0.7 + r() * 0.5);
      const x = cx + Math.cos(a) * d * 0.5, y = cy + Math.sin(a) * d * 0.5, k = 0.72 + 0.28 * t;
      blad(g, x, y, a + Math.PI / 2 + (r() - 0.5) * 2, l, l * 0.5, P.kron, (r() - 0.5) * 0.6, ljus(hx('#c9bfc1'), k * 0.85), ljus(hx('#fffafa'), Math.min(1, k * 1.04)), { tand: 0.18, tandN: 6, kant: hx('#ffffff') });
    }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,45,0.18)');
    g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  },
  pionKnopp(g, W, H, r) {
    const cx = W / 2, cy = H * 0.55;
    for (let i = 0; i < 4; i++) blad(g, cx, cy + 30, Math.PI + (i / 3 - 0.5) * 2.4, 60, 16, P.oval, 0, hx('#3a5a28'), hx('#5d823e'), { nerv: hx('#7d9a5a') });
    const gr = g.createRadialGradient(cx - 20, cy - 25, 5, cx, cy, 80); gr.addColorStop(0, css(hx('#fff8f8'))); gr.addColorStop(1, css(hx('#b5a6a8')));
    ell(g, cx, cy, 72, 80, 0, gr);
    for (let i = 0; i < 6; i++) { g.strokeStyle = css(hx('#9a8a8c'), 0.4); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy + 10, 30 + i * 8, Math.PI * 1.1 + r() * 0.3, Math.PI * 1.6 + r() * 0.4); g.stroke(); }
  },
  // pionens blad: djupt flikade, gröna med rödaktiga skaft
  pionBlad(g, W, H, r) {
    for (let i = 0; i < 16; i++) {
      const a = (r() - 0.5) * 2.4, x0 = W / 2 + (r() - 0.5) * W * 0.3, y0 = H - r() * H * 0.2, len = H * (0.3 + r() * 0.25), dx = Math.sin(a), dy = -Math.cos(a);
      g.strokeStyle = css(hx('#6a3a2c')); g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
      for (const [da, l] of [[-0.75, 0.75], [0, 1], [0.75, 0.75], [-1.5, 0.55], [1.5, 0.55]]) {
        const c = mix(hx('#2f5a28'), hx('#4f7d3a'), r());
        blad(g, x0 + dx * len, y0 + dy * len, a + da, H * 0.22 * l * (0.8 + r() * 0.4), 14, P.lans, (r() - 0.5) * 0.3, ljus(c, 0.75), c, { nerv: ljus(c, 1.3), nervA: 0.5, kant: hx('#a0b890') });
      }
    }
  },
  // funkia: ett stort äggrunt blågrönt blad med djupa bågnerver och dagg
  funkia(g, W, H, r) {
    const c = hx('#4f6e62');
    blad(g, W / 2, H * 0.99, 0, H * 0.96, W * 0.42, P.agg, 0.02, ljus(c, 0.72), ljus(c, 1.08), { mitt: c, nerv: hx('#93b3aa'), nervA: 0.5, nervB: 0.05 });
    g.lineWidth = 2.4;
    for (let k = 1; k <= 7; k++) for (const s of [-1, 1]) {
      const w = W * 0.42 * k / 8;
      g.strokeStyle = css(hx('#3d625c'), 0.55); g.beginPath(); g.moveTo(W / 2 + s * 4, H * 0.95);
      g.bezierCurveTo(W / 2 + s * w * 1.25, H * 0.75, W / 2 + s * w * 1.1, H * 0.35, W / 2 + s * 2, H * 0.06 + k * 6); g.stroke();
      g.strokeStyle = css(hx('#b4d2c8'), 0.3); g.beginPath(); g.moveTo(W / 2 + s * 8, H * 0.95);
      g.bezierCurveTo(W / 2 + s * (w * 1.25 + 6), H * 0.75, W / 2 + s * (w * 1.1 + 6), H * 0.35, W / 2 + s * 6, H * 0.06 + k * 6); g.stroke();
    }
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 900; i++) ell(g, r() * W, r() * H, 1 + r() * 2, 1 + r() * 2, 0, css(hx('#c8dcd8'), 0.08));
    g.globalCompositeOperation = 'source-over';
  },
  // prästkrage: vita strålblommor (lätt tandad spets), gul upphöjd mitt med prickar
  prast(g, W, H, r) {
    const cx = W / 2, cy = H / 2, n = 22;
    for (let i = 0; i < n; i++) blad(g, cx, cy, i / n * 6.283 + r() * 0.08, W * (0.42 + r() * 0.05), W * 0.042, P.kron, (r() - 0.5) * 0.12, hx('#c8c8c0'), hx('#fbfbf6'), { nerv: hx('#d8d8d0'), nervA: 0.4, kant: hx('#ffffff') });
    const gr = g.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, W * 0.13); gr.addColorStop(0, css(hx('#f8d04a'))); gr.addColorStop(1, css(hx('#c4870e')));
    ell(g, cx, cy, W * 0.12, W * 0.12, 0, gr);
    for (let i = 0; i < 70; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.11; ell(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.6, 0, css(hx('#a86c08'), 0.6)); }
  },
  // tagetes: krusig, fylld orange blomma med rödorange bas
  tagetes(g, W, H, r) {
    const cx = W / 2, cy = H / 2;
    for (let k = 0; k < 4; k++) {
      const n = 14 - k * 2, rr = W * (0.46 - k * 0.09);
      for (let i = 0; i < n; i++) blad(g, cx, cy, i / n * 6.283 + k * 0.4 + r() * 0.2, rr, rr * 0.35, P.kron, (r() - 0.5) * 0.3, hx('#b8420e'), mix(hx('#f08a12'), hx('#ffb020'), r()), { tand: 0.3, tandN: 5, kant: hx('#ffd060') });
    }
    ell(g, cx, cy, W * 0.06, W * 0.06, 0, css(hx('#8a5010')));
  },
  // ringblomma: två kransar gulorange strålar, mörkbrun mitt
  ringbl(g, W, H, r) {
    const cx = W / 2, cy = H / 2;
    for (let k = 0; k < 2; k++) for (let i = 0, n = 18; i < n; i++) blad(g, cx, cy, i / n * 6.283 + k * 0.17, W * (0.46 - k * 0.1), W * 0.06, P.kron, (r() - 0.5) * 0.1, hx('#d8700a'), mix(hx('#f5a01a'), hx('#ffc23a'), r()), { nerv: hx('#e08a10'), nervA: 0.4, tand: 0.15, tandN: 3 });
    ell(g, cx, cy, W * 0.11, W * 0.11, 0, css(hx('#6a3a12')));
    for (let i = 0; i < 40; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.1; ell(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.8, 1.8, 0, css(hx('#3a200a'), 0.6)); }
  },
  // pelargonens blomklase: 18 femtaliga blommor i en kupol (ljus, färgas röd eller rosa per planta)
  pelBlom(g, W, H, r) {
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.3, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, s = W * (0.1 + r() * 0.025), off = r() * 6.28;
      for (let p = 0; p < 5; p++) blad(g, x, y, off + p / 5 * 6.283, s, s * 0.62, P.kron, 0, hx('#9c9496'), mix(hx('#f0eaea'), hx('#fffcfc'), r()), { kant: hx('#ffffff') });
      ell(g, x, y, 2.5, 2.5, 0, css(hx('#d8e0b0')));
    }
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.45); gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(40,30,30,0.25)');
    g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  },
  // pelargonens blad: runt, njurformat med krusig kant, mörk hästskozon och strålande nerver
  pelBlad(g, W, H, r) {
    const cx = W / 2, cy = H / 2, R = W * 0.46, c = hx('#4f7d34');
    g.beginPath();
    for (let i = 0; i <= 96; i++) { const a = i / 96 * 6.283, k = Math.abs(Math.sin(a * 4.5)) * 0.06 + 0.94 - (Math.abs(((a + Math.PI / 2) % 6.283) - 0) < 0.25 ? 0.35 : 0); const x = cx + Math.cos(a) * R * k, y = cy + Math.sin(a) * R * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, R); gr.addColorStop(0, css(ljus(c, 1.1))); gr.addColorStop(0.45, css(c)); gr.addColorStop(0.62, css(hx('#34502a'))); gr.addColorStop(0.75, css(c)); gr.addColorStop(1, css(ljus(c, 1.15)));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = css(hx('#86ac62'), 0.5); g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + 0.4 + i / 8 * (6.283 - 0.8); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); g.stroke(); }
  },
  // lupinens blad uppifrån: nio smala småblad i en stjärna
  lupBlad(g, W, H, r) {
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 9; i++) { const c = mix(hx('#3f6a2e'), hx('#5e8a42'), r()); blad(g, cx, cy, i / 9 * 6.283, W * 0.45, W * 0.06, P.lans, (r() - 0.5) * 0.1, ljus(c, 0.8), c, { nerv: ljus(c, 1.3), nervA: 0.5 }); }
  },
  // stjälkar: fyra lodräta remsor (grön, mörklila, gråaktig, rödbrun) med ljus mitt
  stjalk(g, W, H) {
    [['#3e6228', '#6a8c45'], ['#3a2440', '#6a4a70'], ['#6c7a5c', '#9aa88a'], ['#4a2c22', '#7a4c3a']].forEach(([a, b], i) => {
      const x0 = W * (i * 0.25 + 0.04), w = W * 0.16, gr = g.createLinearGradient(x0, 0, x0 + w, 0);
      gr.addColorStop(0, css(hx(a))); gr.addColorStop(0.5, css(hx(b))); gr.addColorStop(1, css(hx(a)));
      g.fillStyle = gr; g.fillRect(x0, 0, w, H);
    });
  },
  // tagetesens fjäderlika, mörkgröna blad
  tagBlad(g, W, H, r) {
    for (let i = 0; i < 14; i++) {
      const a = (r() - 0.5) * 2.6, x0 = W / 2 + (r() - 0.5) * 30, len = H * (0.4 + r() * 0.45), dx = Math.sin(a), dy = -Math.cos(a);
      g.strokeStyle = css(hx('#2f4f22')); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0 + dx * len, H + dy * len); g.stroke();
      for (let k = 2; k < 12; k++) for (const s of [-1, 1]) { const t = k / 12, c = mix(hx('#24421c'), hx('#3f6a2c'), r()); blad(g, x0 + dx * len * t, H + dy * len * t, a + s * 1.2, 12 * (1.1 - t * 0.5), 3.2, P.lans, 0, ljus(c, 0.8), c, { tand: 0.4, tandN: 4 }); }
    }
  },
  // salvians bladrosett uppifrån: skrynkliga lansettlika blad
  salBlad(g, W, H, r) {
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 14; i++) { const c = mix(hx('#3c5a2c'), hx('#5f7f44'), r()); blad(g, cx + (r() - 0.5) * 10, cy + (r() - 0.5) * 10, i / 14 * 6.283 + r() * 0.3, W * (0.32 + r() * 0.14), W * 0.07, P.lans, (r() - 0.5) * 0.3, ljus(c, 0.75), c, { nerv: ljus(c, 1.3), nervA: 0.5, sido: true, sidoSteg: 1, tand: 0.25, tandN: 11 }); }
  },
  // prydnadsgräs (rörflen/ Karl Foerster): täta, upprätta smala blad
  grasTuva(g, W, H, r) {
    for (let i = 0; i < 70; i++) {
      const a = (r() - 0.5) * 0.9, len = H * (0.55 + r() * 0.43), c = mix(hx('#4a6a2c'), hx('#8a9a52'), r());
      blad(g, W / 2 + (r() - 0.5) * W * 0.3, H, a, len, 2.6 + r(), P.smal, a * 0.6 + (r() - 0.5) * 0.15, ljus(c, 0.6), mix(c, hx('#b8b070'), r() * 0.4), {});
    }
  },
  // gräsets vippor: smala, fjäriga, halmgula ax på tunna strån
  vippa(g, W, H, r) {
    for (let k = 0; k < 4; k++) {
      const x0 = W * (0.15 + k * 0.23) + (r() - 0.5) * 10;
      g.strokeStyle = css(hx('#a09060')); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H * 0.05); g.stroke();
      for (let i = 0; i < 90; i++) { const t = r(), y = H * (0.05 + t * 0.42); ell(g, x0 + (r() - 0.5) * 16 * (1 - t * 0.3), y, 1.6, 5, (r() - 0.5) * 0.6, css(mix(hx('#b49a62'), hx('#e8d8a8'), r()))); }
    }
  },
};

// ---- atlas: målas en gång, kanterna fylls med närliggande färg (inga mörka mipkanter), DataTexture ----
// atlas() i ett svep; atlasG stegvis (en växt eller några rader per steg, se blommor.forberedG)
let ATLAS_J = null;
function atlas() {
  if (!ATLAS) { const j = ATLAS_J || (ATLAS_J = atlasG()); while (!j.next().done); }
  return ATLAS;
}
function* atlasG() {
  const S = SVAG ? 1024 : 2048, k = S / 2048, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }), r = slump(7171);
  g.scale(k, k);
  for (const [namn, [cx, cy, cw, ch]] of Object.entries(CELL)) {
    const f = MALA[namn]; if (!f) continue;
    g.save(); g.beginPath(); g.rect(cx * 256, cy * 256, cw * 256, ch * 256); g.clip(); g.translate(cx * 256 + 2, cy * 256 + 2);
    f(g, cw * 256 - 4, ch * 256 - 4, r);
    g.restore();
    yield;
  }
  try { if (/[?&]prov=1/.test(location.search)) window.__blomAtlas = cv; } catch (e) { /* */ }   // (provbilder)
  const id = g.getImageData(0, 0, S, S), d = id.data, B = 8, nb = S / B, bc = new Float32Array(nb * nb * 4);
  yield;
  for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
    if (!bx && !(by & 15)) yield;
    let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) { const i = (y * S + x) * 4, a = d[i + 3]; if (a > 60) { sr += d[i] * a; sg += d[i + 1] * a; sb += d[i + 2] * a; sw += a; } }
    const j = (by * nb + bx) * 4; if (sw > 0) { bc[j] = sr / sw; bc[j + 1] = sg / sw; bc[j + 2] = sb / sw; bc[j + 3] = 1; }
  }
  for (let pass = 0; pass < 6; pass++) {   // tomma block tar grannarnas färg
    const ny = bc.slice();
    for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
      const j = (by * nb + bx) * 4; if (bc[j + 3]) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = bx + ox, y = by + oy; if (x < 0 || y < 0 || x >= nb || y >= nb) continue; const q = (y * nb + x) * 4; if (bc[q + 3]) { sr += bc[q]; sg += bc[q + 1]; sb += bc[q + 2]; n++; } }
      if (n) { ny[j] = sr / n; ny[j + 1] = sg / n; ny[j + 2] = sb / n; ny[j + 3] = 1; }
    }
    bc.set(ny);
    yield;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!x && !(y & 63)) yield;
    const i = (y * S + x) * 4; if (d[i + 3] > 8) continue;
    const j = ((y / B | 0) * nb + (x / B | 0)) * 4;
    if (bc[j + 3]) { d[i] = bc[j]; d[i + 1] = bc[j + 1]; d[i + 2] = bc[j + 2]; } else { d[i] = 70; d[i + 1] = 95; d[i + 2] = 50; }
  }
  const t = new THREE.DataTexture(new Uint8Array(d.buffer), S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = K.ANISO || 4; t.flipY = false; t.needsUpdate = true;
  ATLAS = { t, S };
}

// ---- material: Lambert, tvåsidigt med normalen kvar på baksidan, vind, färgning av vita delar, genomlysning ----
function material() {
  if (MAT) return MAT;
  const { VU, LJUS } = K, A = atlas();
  const m = new THREE.MeshLambertMaterial({ map: A.t, vertexColors: true, alphaTest: 0.45, alphaToCoverage: !!K.MSAA, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTid: VU.uTid, uVind: VU.uVind, miljoLjus: LJUS, uSSS: VU.uSSS, uNatt: VU.uNatt });
    s.vertexShader = 'uniform float uTid;\nuniform vec2 uVind;\nattribute float aH;\nattribute float aV;\nattribute float aTon;\nvarying float vH;\nvarying float vTon;\n' + s.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vH = aH; vTon = aTon;
          float fas = position.x * 0.53 + position.z * 0.41;
          float by = 0.55 + 0.45 * sin( uTid * 0.23 + fas * 0.6 ) * sin( uTid * 0.137 + fas * 0.4 + 1.3 );
          transformed.xz += ( uVind * ( 0.7 * by + 0.3 * sin( uTid * 1.7 + fas * 2.3 ) ) + 0.35 * vec2( sin( uTid * 2.6 + fas * 5.1 ), cos( uTid * 2.2 + fas * 4.3 ) ) ) * aV;
        }`);
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform vec3 uSSS;\nuniform float uNatt;\nvarying float vH;\nvarying float vTon;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 dd = max( abs( dFdx( vMapUv ) ), abs( dFdy( vMapUv ) ) ) * ${A.S.toFixed(1)};
          diffuseColor.a *= 1.0 + 0.3 * log2( max( max( dd.x, dd.y ), 1.0 ) );
        }`)
      .replace('#include <color_fragment>', `
        {
          // vita och grå delar (kronblad) färgas med plantans färg; gröna och färgade delar behåller sin
          vec3 c = diffuseColor.rgb; float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) );
          float vit = 1.0 - smoothstep( 0.1, 0.28, ( mx - mn ) / max( mx, 1e-3 ) );
          diffuseColor.rgb *= mix( vec3( 1.0 ), vColor, vit ) * vTon;
          diffuseColor.rgb *= 0.55 + 0.45 * smoothstep( 0.0, 0.6, vH );   // mörkare inne vid basen
          diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );
        }`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );')   // baksidan behåller normalen (ingen svart baksida)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * ( miljoLjus + uSSS * 0.6 * vH );');
  };
  m.customProgramCacheKey = () => 'blommor-v1';
  return (MAT = m);
}

// ---- geometri: en planta byggs av kort i lokala koordinater (foten i origo, y uppåt) ----
function bygg() {
  const B = { P: [], U: [], A: [] };   // A: [lokal höjd] per hörn (vindens och mörkrets andel räknas efteråt)
  const uvR = (namn, sub) => { const [cx, cy, cw, ch] = CELL[namn]; let u0 = cx / 8, u1 = (cx + cw) / 8; if (sub) { const w = u1 - u0; u1 = u0 + w * sub[1]; u0 = u0 + w * sub[0]; } return [u0, u1, cy / 8 + 0.002, (cy + ch) / 8 - 0.002]; };
  // fyrhörning: hörn a (nere vä), b (nere hö), c (uppe hö), d (uppe vä)
  B.quad = (a, b, c, d, namn, sub, vv) => {
    const [u0, u1, vt, vb] = uvR(namn, sub), [v0, v1] = vv || [vb, vt];
    B.P.push(...a, ...b, ...c, ...a, ...c, ...d);
    B.U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };
  // kort med foten mitt i p, bredd w längs vinkel ang (runt y), uppvektor up (längd = höjd)
  B.kort = (p, ang, w, up, namn, sub) => {
    const rx = Math.cos(ang) * w / 2, rz = -Math.sin(ang) * w / 2;
    B.quad([p[0] - rx, p[1], p[2] - rz], [p[0] + rx, p[1], p[2] + rz], [p[0] + rx + up[0], p[1] + up[1], p[2] + rz + up[2]], [p[0] - rx + up[0], p[1] + up[1], p[2] - rz + up[2]], namn, sub);
  };
  // lutat kort: höjd h, lutar vinkeln lut (0 = lodrätt) ut åt riktningen ang + π/2
  B.lut = (p, ang, w, h, lut, namn, sub) => { const fx = Math.sin(ang), fz = Math.cos(ang); B.kort(p, ang, w, [fx * Math.sin(lut) * h, Math.cos(lut) * h, fz * Math.sin(lut) * h], namn, sub); };
  B.kors = (p, ang, w, h, lut, namn) => { B.lut(p, ang, w, h, lut, namn); B.lut(p, ang + Math.PI / 2, w, h, lut, namn); };
  // blomhuvud: kvadrat med mitten i p som vänder sig mot riktningen n
  B.huvud = (p, n, s, namn) => {
    const l = Math.hypot(...n), N = n.map(v => v / l); let a = [N[2], 0, -N[0]]; const al = Math.hypot(...a);
    a = al < 1e-3 ? [1, 0, 0] : a.map(v => v / al);
    const b = [N[1] * a[2] - N[2] * a[1], N[2] * a[0] - N[0] * a[2], N[0] * a[1] - N[1] * a[0]], h = s / 2;
    const C = (i, j) => [p[0] + a[0] * h * i + b[0] * h * j, p[1] + a[1] * h * i + b[1] * h * j, p[2] + a[2] * h * i + b[2] * h * j];
    B.quad(C(-1, -1), C(1, -1), C(1, 1), C(-1, 1), namn);
  };
  // stjälk från p0 till p1 (smal remsa, vänd mot vinkel ang)
  B.stjalk = (p0, p1, w, ang, sub) => B.kort(p0, ang, w, [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], 'stjalk', STJ[sub]);
  // böjd remsa genom punkterna pts (från foten mot spetsen), bredd w(t), vänd mot vinkel ang
  B.remsa = (pts, wf, ang, namn) => {
    const rx = Math.cos(ang), rz = -Math.sin(ang), [u0, u1, vt, vb] = uvR(namn), n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1], w0 = wf(i / n) / 2, w1 = wf((i + 1) / n) / 2, v0 = vb + (vt - vb) * i / n, v1 = vb + (vt - vb) * (i + 1) / n;
      const a = [p[0] - rx * w0, p[1], p[2] - rz * w0], b = [p[0] + rx * w0, p[1], p[2] + rz * w0], c = [q[0] + rx * w1, q[1], q[2] + rz * w1], d = [q[0] - rx * w1, q[1], q[2] - rz * w1];
      B.P.push(...a, ...b, ...c, ...a, ...c, ...d);
      B.U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  };
  return B;
}
const rund = (r, R) => { const a = r() * 6.283, d = Math.sqrt(r()) * R; return [Math.cos(a) * d, Math.sin(a) * d, a]; };
const rikt = (a, lut) => [Math.sin(a) * Math.sin(lut), Math.cos(lut), Math.cos(a) * Math.sin(lut)];
const pl = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l];

// Arterna: H = höjd vid s = 1, R = radie, vind = svaj i toppen (m vid full vind); bygg(B, r, n) där n = detaljandel (1 eller ~0,55)
const ARTER = {
  lavendel: { H: 0.55, R: 0.32, vind: 0.05, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.34, 0.32, 0, 'lavBlad');
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + r() * 0.4; B.lut([Math.sin(a) * 0.1, -0.02, Math.cos(a) * 0.1], a, 0.3, 0.3, 0.5, 'lavBlad'); }
    for (let i = 0; i < 2; i++) B.lut([0, 0.13 + i * 0.05, 0], r() * 6.28, 0.36, 0.34, 1.2, 'lavBlad');
    for (let i = 0, m = Math.round(40 * n); i < m; i++) {
      const [x, z, a] = rund(r, 0.15), lut = 0.06 + Math.sqrt(r()) * 0.55, d = rikt(Math.atan2(x, z) + (r() - 0.5) * 0.6, lut), p0 = [x, 0.14, z], len = 0.24 + r() * 0.14, p1 = pl(p0, d, len);
      B.stjalk(p0, p1, 0.007, a, 'gra');
      const al = 0.1 + r() * 0.045, w = 0.042;
      const SUB = [[0.07, 0.37], [0.35, 0.65], [0.63, 0.93]], k = r() * 3 | 0;
      B.kort(pl(p1, d, -0.01), a, w, d.map(v => v * al), 'lavAx', SUB[k]);
      B.kort(pl(p1, d, -0.01), a + Math.PI / 2, w, d.map(v => v * al), 'lavAx', SUB[(k + 1) % 3]);
    }
  } },
  salvia: { H: 0.5, R: 0.25, vind: 0.05, bygg(B, r, n) {
    B.lut([0, 0.01, 0], r() * 3, 0.36, 0.34, 1.35, 'salBlad');
    B.kors([0, -0.02, 0], r() * 3, 0.26, 0.2, 0.1, 'gronTuva');
    for (let i = 0, m = Math.round(15 * n); i < m; i++) {
      const [x, z, a] = rund(r, 0.1), d = rikt(Math.atan2(x, z), 0.05 + r() * 0.3), p0 = [x, 0.1, z], len = 0.18 + r() * 0.1, p1 = pl(p0, d, len), al = 0.14 + r() * 0.07, w = 0.04;
      B.stjalk(p0, p1, 0.008, a, 'lila');
      const k = r() * 3 | 0, sub = [[0.04, 0.36], [0.35, 0.65], [0.64, 0.96]][k];
      B.kort(pl(p1, d, -0.01), a, w, d.map(v => v * al), 'salAx', sub);
      B.kort(pl(p1, d, -0.01), a + Math.PI / 2, w, d.map(v => v * al), 'salAx', sub);
    }
  } },
  kattmynta: { H: 0.42, R: 0.38, vind: 0.06, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.5, 0.42, 0, 'katt');
    B.kors([0.05, -0.02, -0.04], r() * 3 + 0.7, 0.46, 0.38, 0.1, 'katt');
    for (let i = 0, m = Math.round(10 * n) + 1; i < m; i++) { const a = i / m * 6.283 + r() * 0.4; B.lut([Math.sin(a) * 0.12, -0.02, Math.cos(a) * 0.12], a, 0.42, 0.36 + r() * 0.06, 0.55 + r() * 0.2, 'katt'); }
    for (let i = 0; i < 3; i++) { const a = r() * 6.28; B.lut([Math.sin(a) * 0.08, 0.16 + i * 0.06, Math.cos(a) * 0.08], a, 0.6 - i * 0.08, 0.55 - i * 0.08, 1.3, 'kattTopp'); }
  } },
  ros: { H: 0.85, R: 0.4, vind: 0.03, bygg(B, r, n) {
    for (let i = 0; i < 4; i++) { const [x, z, a] = rund(r, 0.08); B.stjalk([x, 0, z], [x * 2, 0.45, z * 2], 0.012, a, 'rod'); }
    B.kors([0, 0, 0], r() * 3, 0.5, 0.6, 0, 'rosBlad');
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + r() * 0.5; B.lut([Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12], a, 0.45, 0.5, 0.5, 'rosBlad'); }
    for (let i = 0; i < 3; i++) { const a = r() * 6.28; B.lut([Math.sin(a) * 0.1, 0.4 + i * 0.06, Math.cos(a) * 0.1], a, 0.5, 0.5, 1.3, 'rosBlad'); }
    for (let i = 0, m = Math.round(11 * n); i < m; i++) {
      const a = r() * 6.283, e = 0.35 + r() * 0.9, d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)], R = 0.3 + r() * 0.05;
      const p = [d[0] * R, 0.4 + d[1] * 0.38, d[2] * R], s = 0.085 + r() * 0.03;
      if (r() < 0.25) { B.kort(pl(p, [0, 1, 0], -s * 0.5), a, s, [d[0] * 0.03, s, d[2] * 0.03], 'rosKnopp'); continue; }
      B.huvud(p, d, s, 'ros'); B.huvud(pl(p, d, -0.012), [d[0] * 0.3, 1, d[2] * 0.3], s * 0.92, 'ros');
    }
  } },
  pion: { H: 0.8, R: 0.42, vind: 0.04, bygg(B, r, n) {
    B.kors([0, 0, 0], r() * 3, 0.6, 0.58, 0, 'pionBlad');
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + r() * 0.5; B.lut([Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1], a, 0.5, 0.5, 0.55, 'pionBlad'); }
    B.lut([0, 0.3, 0], r() * 3, 0.6, 0.55, 1.3, 'pionBlad');
    for (let i = 0, m = Math.round(6 * n) + 1; i < m; i++) {
      const [x, z, a] = rund(r, 0.2), d = rikt(Math.atan2(x, z), 0.2 + r() * 0.5), p = [x * 1.2, 0.52 + r() * 0.18, z * 1.2], s = 0.15 + r() * 0.05;
      B.stjalk([x * 0.3, 0.2, z * 0.3], p, 0.01, a, 'rod');
      if (r() < 0.25) { B.huvud(p, [d[0], 0.6, d[2]], s * 0.45, 'pionKnopp'); continue; }
      B.huvud(pl(p, [0, 1, 0], 0.02), d, s, 'pion'); B.huvud(p, [d[0] * 0.4, 1, d[2] * 0.4], s * 0.9, 'pion');
    }
  } },
  prastkrage: { H: 0.6, R: 0.2, vind: 0.07, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.26, 0.24, 0.15, 'gronTuva');
    B.lut([0, 0, 0], r() * 3, 0.24, 0.2, 0.7, 'gronTuva');
    for (let i = 0, m = Math.round(11 * n); i < m; i++) {
      const [x, z, a] = rund(r, 0.08), d = rikt(Math.atan2(x, z), 0.05 + r() * 0.3), p0 = [x, 0.04, z], p1 = pl(p0, d, 0.38 + r() * 0.2), s = 0.05 + r() * 0.014;
      B.stjalk(p0, p1, 0.005, a, 'gron');
      const v = r() * 6.28, f = 0.35 + r() * 0.5; B.huvud(pl(p1, [0, 1, 0], 0.004), [Math.sin(v) * f, 1, Math.cos(v) * f], s, 'prast');
    }
  } },
  margerit: { H: 0.42, R: 0.24, vind: 0.04, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.32, 0.26, 0.2, 'gronTuva');
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); B.lut([0, 0.02, 0], a, 0.3, 0.24, 0.9, 'gronTuva'); }
    for (let i = 0, m = Math.round(20 * n); i < m; i++) {
      const [x, z, a] = rund(r, 0.14), d = rikt(Math.atan2(x, z), 0.15 + r() * 0.5), p0 = [x * 0.5, 0.1, z * 0.5], p1 = pl(p0, d, 0.2 + r() * 0.12), s = 0.06 + r() * 0.015;
      B.stjalk(p0, p1, 0.005, a, 'gron');
      B.huvud(pl(p1, [0, 1, 0], 0.004), [d[0] * 1.3, 1, d[2] * 1.3], s, 'prast');
    }
  } },
  pelargon: { H: 0.38, R: 0.24, vind: 0.025, bygg(B, r, n) {
    // bladkulle: inre blad högre och flackare, yttre lägre och lutade ut över krukkanten
    for (let i = 0; i < 24; i++) { const [x, z] = rund(r, 0.17), d = Math.hypot(x, z) / 0.17, y = 0.05 + (1 - d) * 0.13 + r() * 0.04, s = 0.11 + r() * 0.05, v = r() * 6.28; B.huvud([x, y, z], [x * 9 * d + Math.sin(v) * 0.25, 1, z * 9 * d + Math.cos(v) * 0.25], s, 'pelBlad'); }
    for (let i = 0, m = Math.round(7 * n) + 1; i < m; i++) {
      const [x, z, a] = rund(r, 0.1), d = rikt(Math.atan2(x, z), 0.1 + r() * 0.4), p0 = [x * 0.5, 0.1, z * 0.5], p1 = pl(p0, d, 0.2 + r() * 0.1), s = 0.12 + r() * 0.03;
      B.stjalk(p0, p1, 0.006, a, 'gron');
      B.kors(pl(p1, [0, 1, 0], -s * 0.4), a, s, s * 0.85, 0, 'pelBlom');
      B.huvud(pl(p1, [0, 1, 0], s * 0.2), [d[0] * 0.5, 1, d[2] * 0.5], s * 0.95, 'pelBlom');
    }
  } },
  funkia: { H: 0.42, R: 0.42, vind: 0.02, bygg(B, r, n) {
    for (let i = 0, m = Math.round(11 * n) + 2; i < m; i++) {
      const a = i / m * 6.283 + r() * 0.4, dx = Math.sin(a), dz = Math.cos(a), inre = i % 3 === 0, l = (inre ? 0.26 : 0.34) + r() * 0.06, h0 = (inre ? 0.2 : 0.13) + r() * 0.05;
      const pts = [[dx * 0.02, 0, dz * 0.02], [dx * 0.06, h0, dz * 0.06], [dx * (0.06 + l * 0.45), h0 + l * 0.28, dz * (0.06 + l * 0.45)], [dx * (0.06 + l * 0.8), h0 + l * 0.22, dz * (0.06 + l * 0.8)], [dx * (0.06 + l), h0 + l * 0.02, dz * (0.06 + l)]];
      // skaftet smalt, sedan bladet (rutans nedre del är bladets bas)
      B.remsa(pts, t => (t < 0.2 ? 0.03 : 0.04 + 0.28 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.2) / 0.8 * 0.92 + 0.04)), 0.7)) * (inre ? 0.85 : 1), a, 'funkia');
    }
  } },
  lupin: { H: 1.0, R: 0.3, vind: 0.07, bygg(B, r, n) {
    for (let i = 0; i < 6; i++) { const [x, z] = rund(r, 0.14), y = 0.12 + r() * 0.22, s = 0.17 + r() * 0.05; B.huvud([x, y, z], [x * 2 + (r() - 0.5) * 0.4, 1, z * 2 + (r() - 0.5) * 0.4], s, 'lupBlad'); }
    B.kors([0, -0.02, 0], r() * 3, 0.24, 0.3, 0.1, 'gronTuva');
    for (let i = 0, m = Math.round(3 * n + r() * 2); i < m; i++) {
      const [x, z, a] = rund(r, 0.08), d = rikt(Math.atan2(x, z), r() * 0.15), h = 0.7 + r() * 0.32, sh = h * (0.36 + r() * 0.1), p0 = [x, 0, z], p1 = pl(p0, d, h - sh);
      B.stjalk(p0, p1, 0.012, a, 'gron');
      B.kors(pl(p1, d, -0.02), a, 0.1 + r() * 0.02, sh, 0, 'lupAx');
    }
  } },
  tagetes: { H: 0.3, R: 0.18, vind: 0.02, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.3, 0.24, 0.2, 'tagBlad');
    for (let i = 0; i < 2; i++) B.lut([0, 0.05, 0], r() * 6.28, 0.28, 0.22, 1.0, 'tagBlad');
    for (let i = 0, m = Math.round(8 * n) + 1; i < m; i++) { const [x, z] = rund(r, 0.11), v = r() * 6.28; B.huvud([x, 0.2 + r() * 0.08, z], [x * 3 + Math.sin(v) * 0.2, 1, z * 3 + Math.cos(v) * 0.2], 0.055 + r() * 0.015, 'tagetes'); }
  } },
  ringblomma: { H: 0.4, R: 0.2, vind: 0.04, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.3, 0.26, 0.2, 'gronTuva');
    for (let i = 0, m = Math.round(7 * n) + 1; i < m; i++) {
      const [x, z, a] = rund(r, 0.1), d = rikt(Math.atan2(x, z), 0.1 + r() * 0.4), p1 = pl([x * 0.5, 0.08, z * 0.5], d, 0.2 + r() * 0.1);
      B.stjalk([x * 0.5, 0.08, z * 0.5], p1, 0.006, a, 'gron'); B.huvud(pl(p1, [0, 1, 0], 0.004), [d[0], 1, d[2]], 0.065 + r() * 0.015, 'ringbl');
    }
  } },
  gras: { H: 0.95, R: 0.3, vind: 0.09, bygg(B, r, n) {
    B.kors([0, -0.02, 0], r() * 3, 0.42, 0.65, 0, 'grasTuva');
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); B.lut([Math.sin(a) * 0.05, -0.02, Math.cos(a) * 0.05], a, 0.38, 0.55, 0.35, 'grasTuva'); }
    for (let i = 0, m = Math.round(4 * n) + 1; i < m; i++) { const a = r() * 6.28; B.lut([Math.sin(a) * 0.03, 0.3, Math.cos(a) * 0.03], a, 0.16, 0.62, 0.05 + r() * 0.12, 'vippa'); }
  } },
};
// tre varianter per art och detaljnivå: platta arrayer (position, uv, höjdandel)
const VAR = {};
function variant(art, v, lod) {
  const k = art + v + lod;
  if (VAR[k]) return VAR[k];
  const A = ARTER[art], B = bygg();
  A.bygg(B, slump(1000 + v * 97 + art.length * 13 + art.charCodeAt(0) * 7), lod ? 0.55 : 1);
  const n = B.P.length / 3, H = new Float32Array(n);
  let top = 0.05; for (let i = 0; i < n; i++) top = Math.max(top, B.P[i * 3 + 1]);
  for (let i = 0; i < n; i++) H[i] = Math.max(0, Math.min(1, B.P[i * 3 + 1] / top));
  return (VAR[k] = { P: new Float32Array(B.P), U: new Float32Array(B.U), H, n, top });
}

// ---- myllan: tålig, upprepad textur av mörk jord, klumpar, barkflis och några gruskorn ----
function jordTex() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = slump(4242);
  g.fillStyle = '#211710'; g.fillRect(0, 0, S, S);
  const runt = f => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); f(); g.restore(); } };
  for (let i = 0; i < 4200; i++) { const x = r() * S, y = r() * S, rr = 0.8 + r() * 3.2, c = mix(hx('#140d08'), hx('#3e2d1f'), r()); runt(() => ell(g, x, y, rr, rr * (0.6 + r() * 0.4), r() * 3, css(c, 0.8))); }
  for (let i = 0; i < 150; i++) {   // barkflis: kantiga, avlånga flagor, ljusare ovansida och mörk kant
    const x = r() * S, y = r() * S, l = 5 + r() * 10, w = 2 + r() * 3.5, a = r() * 3.14, c = mix(hx('#3a2618'), hx('#6a4c34'), r());
    runt(() => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = css(ljus(c, 0.55)); g.beginPath(); g.moveTo(-l, -w * 0.4); g.lineTo(-l * 0.3, -w); g.lineTo(l, -w * 0.5); g.lineTo(l * 0.8, w); g.lineTo(-l * 0.6, w * 0.8); g.closePath(); g.fill();
      g.fillStyle = css(c); g.beginPath(); g.moveTo(-l * 0.9, -w * 0.35); g.lineTo(-l * 0.25, -w * 0.85); g.lineTo(l * 0.85, -w * 0.4); g.lineTo(l * 0.6, w * 0.6); g.closePath(); g.fill();
      g.strokeStyle = css(ljus(c, 1.25), 0.4); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-l * 0.7, -w * 0.2); g.lineTo(l * 0.6, -w * 0.15); g.stroke(); g.restore(); });
  }
  for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S, rr = 1.5 + r() * 2.5, c = mix(hx('#6a645c'), hx('#a49c90'), r()); runt(() => ell(g, x, y, rr, rr * 0.8, r() * 3, css(c, 0.9))); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = K.ANISO || 4;
  return t;
}
function jordMat() {
  if (JMAT) return JMAT;
  const { VU, LJUS } = K;
  const m = new THREE.MeshLambertMaterial({ map: jordTex(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { miljoLjus: LJUS, uNatt: VU.uNatt });
    s.vertexShader = 'attribute float aD;\nvarying float vD;\nvarying vec2 vXZ;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vD = aD; vXZ = position.xz;');
    s.fragmentShader = 'uniform vec3 miljoLjus;\nuniform float uNatt;\nvarying float vD;\nvarying vec2 vXZ;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 jt = texture2D( map, vXZ * 1.45 ), jt2 = texture2D( map, vXZ * 0.53 + 0.37 );
        vec3 jc = mix( jt.rgb, jt2.rgb, 0.3 );
        // kornig kant: myllan smular ut i gräset (texturens ljushet + ett finare brus)
        float kn = dot( jc, vec3( 0.4 ) ) + 0.5 * texture2D( map, vXZ * 3.1 ).r;
        if ( vD + ( kn - 0.3 ) * 0.07 < 0.0 ) discard;
        diffuseColor.rgb *= jc * mix( 0.78, 1.0, smoothstep( 0.0, 0.2, vD ) );`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, min( diffuseColor.rgb, vec3( 0.26, 0.3, 0.42 ) ), uNatt * 0.8 );')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * miljoLjus;');
  };
  m.customProgramCacheKey = () => 'blommor-jord-v1';
  return (JMAT = m);
}

// ---- planteringen: drivor (grupper om 3–5 av samma art) i höjdskikt; djup 0 = framkant (lågt), 1 = bakkant (högt) ----
const SKIKT = {
  sol: [   // [art, vikt, skala, avstånd] per skikt
    [['ros', 3.5, 0.95, 0.62], ['pion', 2.5, 1, 0.66], ['gras', 1.2, 1, 0.5], ['salvia', 1.2, 1.05, 0.38], ['lupin', 0.8, 0.95, 0.42]],
    [['lavendel', 2, 1, 0.42], ['salvia', 1.4, 1, 0.36], ['kattmynta', 1.5, 1, 0.55], ['prastkrage', 2.5, 1, 0.3], ['funkia', 0.8, 0.9, 0.55]],
    [['kattmynta', 2, 0.8, 0.48], ['lavendel', 2.6, 0.8, 0.38], ['tagetes', 0.8, 1, 0.26], ['ringblomma', 0.6, 1, 0.28]],
  ],
  gang: [   // längs gången: lavendel tätt mot plattorna, rosor och salvia bakom
    [['ros', 3, 0.9, 0.62], ['salvia', 1.6, 1, 0.38], ['pion', 1.2, 0.95, 0.66], ['prastkrage', 1, 1.05, 0.3]],
    [['lavendel', 5, 0.9, 0.36], ['kattmynta', 1.2, 0.85, 0.5]],
  ],
  rund: [
    [['ros', 3, 1, 0.62], ['gras', 1.2, 1.05, 0.5], ['pion', 2.5, 1, 0.66]],
    [['salvia', 1.5, 1, 0.36], ['lavendel', 1.3, 1, 0.42], ['prastkrage', 2.2, 1, 0.3], ['funkia', 1.2, 1, 0.55]],
    [['kattmynta', 2, 0.85, 0.5], ['lavendel', 1.5, 0.8, 0.38], ['tagetes', 0.6, 1, 0.26]],
  ],
  grann: [
    [['ros', 2, 0.95, 0.62], ['pion', 1.5, 1, 0.66], ['lupin', 0.8, 0.9, 0.42], ['gras', 1, 1, 0.5]],
    [['lavendel', 2, 1, 0.42], ['kattmynta', 2, 1, 0.55], ['salvia', 1.5, 1, 0.38], ['prastkrage', 1.5, 1, 0.3], ['funkia', 1, 1, 0.55]],
  ],
};
const ROSF = [[1.0, 0.42, 0.55], [1.0, 0.62, 0.7], [1.0, 0.97, 0.92], [0.95, 0.25, 0.3], [1.0, 0.78, 0.72]];
const PIONF = [[1.0, 0.55, 0.68], [1.0, 0.75, 0.8], [1.0, 0.98, 0.95], [0.9, 0.3, 0.48]];
const LUPF = [[0.3, 0.2, 0.92], [0.46, 0.18, 0.82], [0.92, 0.26, 0.58], [1.0, 0.48, 0.72], [1.0, 0.98, 0.95]];
const PELF = [[1.0, 0.18, 0.16], [1.0, 0.32, 0.45], [1.0, 0.55, 0.7], [0.95, 0.12, 0.22]];
function farg(art, r, k) {
  const v = 0.94 + r() * 0.12;
  if (art === 'ros') return ROSF[k % ROSF.length];
  if (art === 'pion') return PIONF[k % PIONF.length];
  if (art === 'lupin') return LUPF[k % LUPF.length];
  if (art === 'pelargon') return PELF[k % PELF.length];
  return [v, v, v];
}
// plantera(f, ram, stil): f(x, z) = avstånd in i bädden (m, > 0 inne); djup(x, z) 0..1; ledig(x, z) → bool
function plantera({ f, djup, ram, stil, r, ledig, glesa = 1, lod = 0, yta }) {
  const sk = SKIKT[stil] || SKIKT.sol, ut = [], fria = [], nS = sk.length;
  const [x0, z0, x1, z1] = ram, ramYta = (x1 - x0) * (z1 - z0);
  // drivcentra: slumpade punkter i bädden, varje får ett skikt efter djupet och en art; plantorna placeras tätt runt
  const nDriv = Math.max(3, Math.round(yta * 3.4 * glesa));
  for (let i = 0, tries = 0; i < nDriv && tries < nDriv * 25 + ramYta * 20; tries++) {
    const cx = x0 + r() * (x1 - x0), cz = z0 + r() * (z1 - z0);
    if (f(cx, cz) < 0.12) continue;
    i++;
    const s = Math.min(nS - 1, Math.floor((1 - djup(cx, cz)) * nS * 0.999)), lista = sk[s], sum = lista.reduce((a, b) => a + b[1], 0);
    let q = r() * sum, val = lista[0]; for (const e of lista) { q -= e[1]; if (q <= 0) { val = e; break; } }
    const [art, , skala, avst] = val, fk = r() * 10 | 0, n = art === 'ros' || art === 'pion' || art === 'funkia' ? 1 + (r() * 2 | 0) : 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) {
      const a = r() * 6.283, d = j ? avst * (0.75 + r() * 0.5) * Math.sqrt(j) : 0, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const s2 = skala * (0.82 + r() * 0.3), rad = ARTER[art].R * s2 * 0.75;
      if (f(x, z) < Math.min(0.1, rad * 0.35)) continue;
      if (fria.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < (pr + rad) * 0.52)) continue;
      if (ledig && !ledig(x, z, rad * 0.5)) continue;
      fria.push([x, z, rad]);
      ut.push({ art, x, z, s: s2, ry: r() * 6.283, f: farg(art, r, fk), lod });
    }
  }
  // luckor fylls med låga marktäckare (kattmynta) så att jorden inte syns i stora fläckar
  for (let i = 0, n = Math.round(ramYta * 3); i < n; i++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0), rad = 0.2;
    if (f(x, z) < 0.1 || fria.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < (pr + rad) * 0.7)) continue;
    if (ledig && !ledig(x, z, 0.1)) continue;
    const lista = sk[Math.min(nS - 1, Math.floor((1 - djup(x, z)) * nS * 0.999))].filter(e => ARTER[e[0]].R < 0.4), art = lista.length ? lista[r() * lista.length | 0][0] : 'kattmynta';
    fria.push([x, z, rad]); ut.push({ art, x, z, s: 0.75 + r() * 0.2, ry: r() * 6.283, f: farg(art, r, 0), lod });
  }
  return ut;
}

export const blommor = {
  klar: () => !!THREE && !AV,
  // atlasen i förväg, i små steg (miljöns stegvisa bygge); material() använder den sedan direkt
  *forberedG() { if (!THREE || AV || ATLAS) return; const j = ATLAS_J || (ATLAS_J = atlasG()); while (!j.next().done) yield; },
  av: () => AV,
  arter: () => Object.keys(ARTER),
  // poster [{ art, x, y, z, s, ry, f, lod }] → ett nät (eller null). Plantornas hörn transformeras till världen.
  grupp(poster, namn = 'blommor') {
    if (!THREE || AV) return null;
    const lista = poster.filter(p => ARTER[p.art] && (!SVAG || p.viktig || ((p.x * 7.3 + p.z * 3.1) % 1 + 1) % 1 > 0.4));   // svaga enheter: 60 %
    if (!lista.length) return null;
    let n = 0;
    const V = lista.map((p, i) => { const v = variant(p.art, i % 3, p.lod || (SVAG ? 1 : 0)); n += v.n; return v; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), aH = new Float32Array(n), aV = new Float32Array(n), aT = new Float32Array(n);
    let o = 0;
    lista.forEach((p, i) => {
      const v = V[i], A = ARTER[p.art], s = p.s || 1, c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0), f = p.f || [1, 1, 1], ton = 0.88 + (((p.x * 12.9898 + p.z * 78.233) % 1 + 1) % 1) * 0.22, sy = s * (p.sy || 1);
      const R = A.R * s, Ht = v.top * sy;
      for (let k = 0; k < v.n; k++, o++) {
        const lx = v.P[k * 3] * s, ly = v.P[k * 3 + 1] * sy, lz = v.P[k * 3 + 2] * s, wx = lx * c + lz * sn, wz = -lx * sn + lz * c;
        pos[o * 3] = p.x + wx; pos[o * 3 + 1] = p.y + ly; pos[o * 3 + 2] = p.z + wz;
        // normalen: mjukt klot runt plantan, mest uppåt (ljus topp, lite skugga på sidorna)
        const nx = wx / Math.max(R, 0.05) * 0.55, ny = 0.75 + 0.35 * (ly / Math.max(Ht, 0.05)), nz = wz / Math.max(R, 0.05) * 0.55, l = Math.hypot(nx, ny, nz) || 1;
        nor[o * 3] = nx / l; nor[o * 3 + 1] = ny / l; nor[o * 3 + 2] = nz / l;
        uv[o * 2] = v.U[k * 2]; uv[o * 2 + 1] = v.U[k * 2 + 1];
        col[o * 3] = f[0]; col[o * 3 + 1] = f[1]; col[o * 3 + 2] = f[2];
        aH[o] = v.H[k]; aV[o] = v.H[k] * v.H[k] * A.vind * sy; aT[o] = ton;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); g.setAttribute('aV', new THREE.BufferAttribute(aV, 1)); g.setAttribute('aTon', new THREE.BufferAttribute(aT, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material());
    m.name = namn; m.userData.egen = true; m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; m.frustumCulled = true;
    try { console.info('blommor', namn, lista.length, 'plantor', n / 3 | 0, 'trianglar'); } catch (e) { /* */ }
    return m;
  },
  // Rabatt längs en linje: a, b = ändpunkterna [x, z]; br = bredd; lag = enhetsvektor [x, z] mot den låga framkanten;
  // rak = vilken långsida som är rak (−1 = baksidan mot staket/gång, +1 = framsidan mot gången, 0 = båda mjuka);
  // stil 'sol' | 'gang' | 'grann'; ledig(x, z, m) valfri. → { poster, badd, stenar }
  rabattRand({ a, b, br, lag, rak = -1, stil = 'sol', r, ledig, hy, glesa = 1, lod = 0, stenar = 0 }) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.6) return { poster: [], badd: null, stenar: [] };
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], fi = r() * 6.28, fi2 = r() * 6.28, h = br / 2;
    // lokala koordinater: t längs linjen, w tvärs (+ mot framkanten)
    const lok = (x, z) => { const dx = x - a[0], dz = z - a[1]; return [dx * u[0] + dz * u[1], dx * lag[0] + dz * lag[1]]; };
    const vag = t => 0.06 * Math.sin(t * 1.3 + fi) + 0.025 * Math.sin(t * 3.1 + fi2);
    const f = (x, z) => {
      const [t, w] = lok(x, z), fram = (rak === 1 ? h : h + vag(t)) - w, bak = w + (rak === -1 ? h : h + vag(t + 7)), ande = Math.min(t, len - t) + 0.12;
      // mjuka hörn: rundad sammanslagning av fram/bak och ändarna
      const m = Math.min(fram, bak), k = 0.18, e = Math.max(k - m, 0), q = Math.max(k - ande, 0);
      return Math.min(m, ande) > k ? Math.min(m, ande) : k - Math.hypot(e, q);
    };
    const djup = (x, z) => { const w = lok(x, z)[1]; return Math.max(0, Math.min(1, 0.5 - w / br)); };
    const xs = [a[0], b[0]], zs = [a[1], b[1]], m = h + 0.25, ram = [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m];
    const poster = plantera({ f, djup, ram, stil, r, ledig, glesa, lod, yta: len * br });
    if (hy) poster.forEach(p => { p.y = hy(p.x, p.z) - 0.015; });
    const st = [];
    for (let i = 0; i < stenar; i++) { const t = len * (0.2 + 0.6 * r()), w = (r() - 0.2) * h * 0.6, x = a[0] + u[0] * t + lag[0] * w, z = a[1] + u[1] * t + lag[1] * w; if (!ledig || ledig(x, z, 0.3)) st.push(sten(x, z, r, hy)); }
    return { poster, badd: { f, ram }, stenar: st };
  },
  // Rund rabatt: c = [x, z], R = radie; stenar = antal block i kanten
  rabattRund({ c, R, stil = 'rund', r, ledig, hy, stenar = 4, lod = 0 }) {
    const fi = r() * 6.28, fi2 = r() * 6.28;
    const f = (x, z) => { const dx = x - c[0], dz = z - c[1], v = Math.atan2(dz, dx); return R * (1 + 0.07 * Math.sin(v * 3 + fi) + 0.04 * Math.sin(v * 5 + fi2)) - Math.hypot(dx, dz); };
    const djup = (x, z) => Math.max(0, Math.min(1, 1 - Math.hypot(x - c[0], z - c[1]) / R));
    const ram = [c[0] - R * 1.2, c[1] - R * 1.2, c[0] + R * 1.2, c[1] + R * 1.2];
    const st = [];
    for (let i = 0; i < stenar; i++) {
      const v = fi + i / stenar * 6.283 * 0.8 + r() * 0.5, d = R * (0.62 + r() * 0.2), x = c[0] + Math.cos(v) * d, z = c[1] + Math.sin(v) * d;
      st.push(sten(x, z, r, hy, i === 0 ? 1.4 : 1));
    }
    const fri = (x, z, m) => !st.some(s => Math.hypot(s.x - x, s.z - z) < s.b * 0.55 + m) && (!ledig || ledig(x, z, m));
    const poster = plantera({ f, djup, ram, stil, r, ledig: fri, lod, yta: Math.PI * R * R });
    if (hy) poster.forEach(p => { p.y = hy(p.x, p.z) - 0.015; });
    return { poster, badd: { f, ram }, stenar: st };
  },
  // bäddarna som ett nät: rutnät (8 cm) över varje bädds ram, bara rutor nära eller i bädden; aD = avståndet in
  baddar(lista, hy, namn = 'rabatt-jord') {
    if (!THREE || AV) return null;
    const P = [], D = [], I = [], S = 0.14;   // (14 cm: kanten avgörs per pixel i skuggaren)
    for (const bd of lista) {
      if (!bd) continue;
      const [x0, z0, x1, z1] = bd.ram, nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S), bas = P.length / 3, idx = new Int32Array((nx + 1) * (nz + 1)).fill(-1), fv = new Float32Array((nx + 1) * (nz + 1));
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) fv[j * (nx + 1) + i] = bd.f(x0 + i * S, z0 + j * S);
      const vx = (i, j) => {
        const k = j * (nx + 1) + i; if (idx[k] >= 0) return idx[k];
        const x = x0 + i * S, z = z0 + j * S, d = fv[k];
        P.push(x, hy(x, z) + 0.008 + 0.035 * Math.min(1, Math.max(0, d) / 0.35), z); D.push(d);
        return (idx[k] = P.length / 3 - 1);
      };
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * (nx + 1) + i;
        if (Math.max(fv[k], fv[k + 1], fv[k + nx + 1], fv[k + nx + 2]) < -0.02) continue;
        const a = vx(i, j), b = vx(i + 1, j), c = vx(i + 1, j + 1), d = vx(i, j + 1);
        I.push(a, d, c, a, c, b);
      }
      void bas;
    }
    if (!I.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(D, 1));
    const N = new Float32Array(P.length); for (let i = 1; i < N.length; i += 3) N[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
    g.setIndex(I); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, jordMat());
    m.name = namn; m.userData.egen = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
    return m;
  },
};
// ett granitblock (Poly Haven-skanning via husritare-natur.js): post { id, x, y, z, ry, s, lx, lz } och bredd b
function sten(x, z, r, hy, k = 1) {
  const id = r() < 0.5 ? 'rock_07' : 'rock_09', B = id === 'rock_07' ? 0.9 : 1.1, b = (0.42 + r() * 0.25) * k;
  return { id, x, y: hy ? hy(x, z) - 0.02 : 0, z, ry: r() * 6.283, s: b / B, sy: 0.7 + r() * 0.25, lx: (r() - 0.5) * 0.2, lz: (r() - 0.5) * 0.2, b };
}

export function skapaBlommor(T, ctx) {
  THREE = T; K = ctx;
  return blommor;
}
