/* Byggplattformen – husgeneratorn.
   Bygger ett hus i 3D (GLB) ur en beskrivning: mått, väggarnas överkant,
   takets form, öppningar och plintar. Huset byggs av riktiga delar i lager:
     mark   – gräsmatta (rund, som en modell på ett bord) och grusbädd
     grund  – plintar
     golv   – bjälklag och golvskiva
     vagg   – väggar med stående panel och läkt, fönster, dörrar, knutar, stuprör
     stomme – hammarband, isolering och takstolar som ligger precis under taket
     tak    – falsat plåttak, vindskivor, takfot, nockplåt, hängrännor, takkupa
   Vilopositionen är huset ihop. Animationen "sprang" (0–1 s) drar isär lagren.
   Materialnamnen är desamma som förut (fasad, panel, tak, karm, glas, dorr,
   betong, tra, golvskiva, isolering, gras, grus, stal) så att markering och
   tillval fungerar. Körs både i webbläsaren och i node. */
(function (rot) {
  'use strict';

  var MATERIAL = {
    fasad: [[0.035, 0.033, 0.031], 0, 0.88],
    panel: [[0.05, 0.047, 0.044], 0, 0.8],
    tak: [[0.12, 0.125, 0.135], 0.6, 0.38],
    karm: [[0.06, 0.062, 0.065], 0.35, 0.45],
    glas: [[0.09, 0.12, 0.14], 1.0, 0.04],
    dorr: [[0.11, 0.075, 0.05], 0, 0.6],
    betong: [[0.62, 0.61, 0.58], 0, 0.92],
    tra: [[0.78, 0.6, 0.38], 0, 0.82],
    golvskiva: [[0.8, 0.66, 0.44], 0, 0.88],
    isolering: [[0.93, 0.84, 0.52], 0, 1],
    gras: [[0.25, 0.38, 0.16], 0, 1],
    jord: [[0.3, 0.22, 0.15], 0, 1],
    grus: [[0.6, 0.58, 0.54], 0, 1],
    stal: [[0.42, 0.43, 0.45], 0.85, 0.35],
    fog: [[0.03, 0.03, 0.03], 0, 0.9]
  };
  var LAGER = ['mark', 'grund', 'golv', 'vagg', 'stomme', 'tak'];
  var ISAR = { mark: 0, grund: -0.9, golv: -0.45, vagg: 0, stomme: 1.35, tak: 2.7 };

  /* --- Geometri ------------------------------------------------------------ */
  function Byggare() { this.g = {}; }
  Byggare.prototype.del = function (lager, mat) {
    var k = lager + '|' + mat;
    return this.g[k] || (this.g[k] = { lager: lager, mat: mat, pos: [], nor: [], idx: [] });
  };
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function kors(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function medel(pts) { var c = [0, 0, 0]; pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length]; }

  // En plan, konvex yta (3+ punkter). Normalen vänds utåt från kroppens mitt.
  Byggare.prototype.yta = function (lager, mat, pts, mitt) {
    var d = this.del(lager, mat);
    var n = norm(kors(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (!isFinite(n[0]) || (n[0] === 0 && n[1] === 0 && n[2] === 0)) return;
    var c = medel(pts), ut = sub(c, mitt);
    if (n[0] * ut[0] + n[1] * ut[1] + n[2] * ut[2] < 0) { pts = pts.slice().reverse(); n = [-n[0], -n[1], -n[2]]; }
    var bas = d.pos.length / 3;
    pts.forEach(function (p) { d.pos.push(p[0], p[1], p[2]); d.nor.push(n[0], n[1], n[2]); });
    for (var i = 1; i < pts.length - 1; i++) d.idx.push(bas, bas + i, bas + i + 1);
  };
  // Kropp ur två motstående, lika stora konvexa polygoner (fram och bak).
  Byggare.prototype.prisma = function (lager, mat, fram, bak) {
    var mitt = medel(fram.concat(bak)), self = this;
    this.yta(lager, mat, fram, mitt);
    this.yta(lager, mat, bak, mitt);
    fram.forEach(function (p, i) { var j = (i + 1) % fram.length; self.yta(lager, mat, [p, fram[j], bak[j], bak[i]], mitt); });
  };
  // Hexaeder: åtta hörn, p0–p3 undersida och p4–p7 översida i samma ordning.
  Byggare.prototype.hexa = function (lager, mat, p) { this.prisma(lager, mat, [p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]]); };
  Byggare.prototype.lada = function (lager, mat, x0, y0, z0, x1, y1, z1) {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    this.hexa(lager, mat, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
  };
  Byggare.prototype.cylinder = function (lager, mat, cx, cz, r, y0, y1, seg, matSida) {
    var ned = [], upp = [], self = this;
    for (var i = 0; i < seg; i++) { var a = i / seg * Math.PI * 2; ned.push([cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r]); upp.push([cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r]); }
    var mitt = [cx, (y0 + y1) / 2, cz];
    this.yta(lager, mat, upp, mitt);
    this.yta(lager, matSida || mat, ned, mitt);
    // Sidorna med mjuka normaler så att cylindern ser rund ut.
    var d = this.del(lager, matSida || mat);
    for (var k = 0; k < seg; k++) {
      var j = (k + 1) % seg, bas = d.pos.length / 3;
      [ned[k], ned[j], upp[j], upp[k]].forEach(function (p) { var n = norm([p[0] - cx, 0, p[2] - cz]); d.pos.push(p[0], p[1], p[2]); d.nor.push(n[0], n[1], n[2]); });
      d.idx.push(bas, bas + 2, bas + 1, bas, bas + 3, bas + 2);
    }
  };

  /* --- Väggar ---------------------------------------------------------------
     En vägg beskrivs i egna koordinater: u längs väggen, y uppåt och d inåt
     (0 = fasadens yta). pt(u, y, d) ger världskoordinater. */
  function vaggSida(s, L, B) {
    if (s === 'f') return { W: L, pt: function (u, y, d) { return [u, y, B / 2 - d]; } };
    if (s === 'b') return { W: L, pt: function (u, y, d) { return [u, y, -B / 2 + d]; } };
    if (s === 'h') return { W: B, pt: function (u, y, d) { return [L / 2 - d, y, u]; } };
    return { W: B, pt: function (u, y, d) { return [-L / 2 + d, y, u]; } };
  }
  // Lådan [u0,u1]×[y0,y1]×[d0,d1], med valfritt sned överkant (ytop0/ytop1 vid u0/u1).
  function vlada(b, lager, mat, v, u0, u1, y0, y1a, y1b, d0, d1) {
    if (u1 - u0 < 1e-3 || Math.max(y1a, y1b) - y0 < 1e-3) return;
    b.hexa(lager, mat, [v.pt(u0, y0, d0), v.pt(u1, y0, d0), v.pt(u1, y0, d1), v.pt(u0, y0, d1), v.pt(u0, y1a, d0), v.pt(u1, y1b, d0), v.pt(u1, y1b, d1), v.pt(u0, y1a, d1)]);
  }
  // Delar ett intervall [y0, ytop] runt öppningar som täcker u-intervallet.
  function fria(y0, ytop, hal) {
    var ut = [], y = y0;
    hal.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (h) { if (h[0] > y + 1e-3) ut.push([y, Math.min(h[0], ytop)]); y = Math.max(y, h[1]); });
    if (ytop > y + 1e-3) ut.push([y, ytop]);
    return ut.filter(function (s) { return s[1] - s[0] > 1e-3; });
  }

  function byggVagg(b, lager, v, o) {
    // o: { u0, u1, yBas, topp(u), oppningar:[{u0,u1,y0,y1,typ,spojs:[], tvars:[]}], kant: bool }
    var T = 0.16, KARM = 0.07;
    // Öppningar som når nästan upp till taket följer takets lutning (glasgavlar).
    var hal = o.oppningar.map(function (h) {
      var lagst = Math.min(o.topp(h.u0 - KARM), o.topp(h.u1 + KARM));
      return h.y1 > lagst - 0.3 ? Object.assign({}, h, { y1: 99, tillTak: true }) : h;
    });
    var hTopp = function (h, u) { return h.tillTak ? o.topp(u) - KARM - 0.01 : h.y1; };
    var kanter = [o.u0, o.u1].concat(o.knack || []);
    hal.forEach(function (h) { kanter.push(h.u0, h.u1); });
    kanter = kanter.filter(function (u) { return u >= o.u0 - 1e-6 && u <= o.u1 + 1e-6; }).sort(function (a, c) { return a - c; })
      .filter(function (u, i, a) { return i === 0 || u - a[i - 1] > 1e-4; });
    // Stommen i väggen (fasadskivan), runt hålen.
    for (var i = 0; i < kanter.length - 1; i++) {
      var a = kanter[i], c = kanter[i + 1], m = (a + c) / 2;
      var tA = o.topp(a), tC = o.topp(c), ytop = Math.max(tA, tC);
      var tackande = hal.filter(function (h) { return h.u0 <= m && h.u1 >= m; }).map(function (h) { return [h.y0, h.y1]; });
      fria(o.yBas, ytop, tackande).forEach(function (s) {
        var ovre = Math.abs(s[1] - ytop) < 1e-6;
        vlada(b, lager, 'fasad', v, a, c, s[0], ovre ? tA : s[1], ovre ? tC : s[1], 0, T);
      });
    }
    // Stående läkt var 20:e cm, avbruten vid öppningarna.
    var steg = 0.2, bredd = 0.045;
    for (var u = o.u0 + 0.12; u < o.u1 - 0.08; u += steg) {
      var ua = u - bredd / 2, ub = u + bredd / 2;
      var t0 = o.topp(ua), t1 = o.topp(ub);
      var stopp = hal.filter(function (h) { return h.u0 - KARM - 0.01 <= ub && h.u1 + KARM + 0.01 >= ua; }).map(function (h) { return [h.y0 - KARM - 0.04, h.y1 + KARM]; });
      fria(o.yBas + 0.02, Math.max(t0, t1) - 0.02, stopp).forEach(function (s) {
        var ovre = Math.abs(s[1] - (Math.max(t0, t1) - 0.02)) < 1e-6;
        vlada(b, lager, 'panel', v, ua, ub, s[0], ovre ? t0 - 0.02 : s[1], ovre ? t1 - 0.02 : s[1], -0.026, 0);
      });
    }
    // Fönster och dörrar: karm, bleck, glas, spröjs och handtag.
    hal.forEach(function (h) {
      var dj = h.typ === 'dorr' ? 0.03 : 0.05, ta = hTopp(h, h.u0), tb = hTopp(h, h.u1);
      var botten = h.y0 - (h.typ === 'dorr' ? 0 : KARM);
      vlada(b, lager, 'karm', v, h.u0 - KARM, h.u0, botten, hTopp(h, h.u0 - KARM) + KARM, ta + KARM, -0.035, 0.11);
      vlada(b, lager, 'karm', v, h.u1, h.u1 + KARM, botten, tb + KARM, hTopp(h, h.u1 + KARM) + KARM, -0.035, 0.11);
      // Punkterna längs överkanten: öppningens kanter och gavelns knäck (nocken) emellan.
      var us = [h.u0].concat((o.knack || []).filter(function (k) { return h.tillTak && k > h.u0 && k < h.u1; })).concat([h.u1]);
      for (var q = 0; q < us.length - 1; q++) {
        var ua = us[q], ub = us[q + 1], ya = hTopp(h, ua), yb = hTopp(h, ub);
        b.hexa(lager, 'karm', [v.pt(ua, ya, -0.035), v.pt(ub, yb, -0.035), v.pt(ub, yb, 0.11), v.pt(ua, ya, 0.11), v.pt(ua, ya + KARM, -0.035), v.pt(ub, yb + KARM, -0.035), v.pt(ub, yb + KARM, 0.11), v.pt(ua, ya + KARM, 0.11)]);
      }
      var glasPoly = function (d) { return [v.pt(h.u0, h.y0, d), v.pt(h.u1, h.y0, d)].concat(us.slice().reverse().map(function (u) { return v.pt(u, hTopp(h, u), d); })); };
      if (h.typ !== 'dorr') {
        vlada(b, lager, 'karm', v, h.u0, h.u1, h.y0 - KARM, h.y0, h.y0, -0.035, 0.11);
        vlada(b, lager, 'stal', v, h.u0 - KARM - 0.03, h.u1 + KARM + 0.03, h.y0 - KARM - 0.025, h.y0 - KARM, h.y0 - KARM, -0.085, 0);
      }
      if (h.typ === 'dorr') {
        vlada(b, lager, 'dorr', v, h.u0, h.u1, h.y0, ta, tb, dj, dj + 0.05);
        var hu = h.u1 - 0.1;
        vlada(b, lager, 'stal', v, hu - 0.015, hu + 0.015, h.y0 + 0.95, h.y0 + 1.1, h.y0 + 1.1, dj - 0.06, dj);
        vlada(b, lager, 'stal', v, hu - 0.13, hu + 0.015, h.y0 + 1.06, h.y0 + 1.09, h.y0 + 1.09, dj - 0.08, dj - 0.05);
      } else {
        if (us.length > 2) b.prisma(lager, 'glas', glasPoly(dj), glasPoly(dj + 0.012)); else vlada(b, lager, 'glas', v, h.u0, h.u1, h.y0, ta, tb, dj, dj + 0.012);
        (h.spojs || []).forEach(function (su) { vlada(b, lager, 'karm', v, su - 0.03, su + 0.03, h.y0, hTopp(h, su - 0.03), hTopp(h, su + 0.03), dj - 0.03, dj + 0.02); });
        (h.tvars || []).forEach(function (sy) { if (sy < Math.min(ta, tb) - 0.05) vlada(b, lager, 'karm', v, h.u0, h.u1, sy - 0.03, sy + 0.03, sy + 0.03, dj - 0.03, dj + 0.02); });
      }
    });
  }

  /* --- Huset ------------------------------------------------------------------ */
  function bygg(s) {
    var b = new Byggare();
    var L = s.L, B = s.B, H0 = 0.2;
    var zo = s.tak.zo, xo = s.tak.xo, TT = 0.1;
    // Takets ovansida som funktion av z.
    var takY = s.tak.form === 'pulpet'
      ? function (z) { return s.tak.yLag + (s.tak.yHog - s.tak.yLag) * (z * s.tak.riktning + zo) / (2 * zo); }
      : function (z) { return s.tak.yNock - (s.tak.yNock - s.tak.yFot) * Math.abs(z) / zo; };
    var under = function (z) { return takY(z) - TT; };
    var vaggTopp = function (z) { return under(z) - 0.03; };

    // Mark: rund gräsmatta med jordkant, grusbädd under huset.
    var R = Math.max(L, B) * 0.5 + 1.5;
    b.cylinder('mark', 'gras', 0, 0, R, -0.18, -0.02, 72, 'jord');
    b.lada('mark', 'grus', -L / 2 - 0.45, -0.02, -B / 2 - 0.45, L / 2 + 0.45, 0.01, B / 2 + 0.45);
    // Plintar
    (s.plintar || []).forEach(function (p) { b.cylinder('grund', 'betong', p[0], p[1], 0.15, 0.0, H0, 20); });
    // Golv: syllar, bjälkar var 60:e cm och golvskiva – inne i väggen när huset står ihop.
    b.lada('golv', 'tra', -L / 2 + 0.05, H0, B / 2 - 0.22, L / 2 - 0.05, H0 + 0.2, B / 2 - 0.05);
    b.lada('golv', 'tra', -L / 2 + 0.05, H0, -B / 2 + 0.05, L / 2 - 0.05, H0 + 0.2, -B / 2 + 0.22);
    for (var bx = -L / 2 + 0.12; bx < L / 2 - 0.05; bx += 0.6) b.lada('golv', 'tra', bx, H0, -B / 2 + 0.22, bx + 0.045, H0 + 0.195, B / 2 - 0.22);
    b.lada('golv', 'golvskiva', -L / 2 + 0.17, H0 + 0.2, -B / 2 + 0.17, L / 2 - 0.17, H0 + 0.222, B / 2 - 0.17);

    // Väggar
    var opp = function (sida) { return (s.oppningar || []).filter(function (o) { return o.sida === sida && !o.kupa; }); };
    ['f', 'b'].forEach(function (sida) {
      var z = sida === 'f' ? B / 2 : -B / 2, t = vaggTopp(z);
      byggVagg(b, 'vagg', vaggSida(sida, L, B), { u0: -L / 2, u1: L / 2, yBas: H0, topp: function () { return t; }, oppningar: opp(sida).map(function (o) { return sida === 'b' ? o : o; }) });
    });
    ['h', 'v'].forEach(function (sida) {
      var T = 0.16;
      byggVagg(b, 'vagg', vaggSida(sida, L, B), { u0: -B / 2 + T, u1: B / 2 - T, yBas: H0, topp: function (u) { return vaggTopp(u); }, knack: s.tak.form === 'pulpet' ? [] : [0], oppningar: opp(sida) });
    });
    // Knutbrädor och stuprör
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (k) {
      var x = k[0] * L / 2, z = k[1] * B / 2, t = vaggTopp(z);
      b.lada('vagg', 'panel', Math.min(x, x + k[0] * 0.03) - (k[0] > 0 ? 0.12 : 0), H0, Math.min(z, z + k[1] * 0.03) - (k[1] > 0 ? 0.12 : 0), Math.max(x, x + k[0] * 0.03) + (k[0] < 0 ? 0.12 : 0), t, Math.max(z, z + k[1] * 0.03) + (k[1] < 0 ? 0.12 : 0));
    });
    if (s.tak.form !== 'pulpet') [[1, 1], [-1, -1]].forEach(function (k) {
      var x = k[0] * (L / 2 - 0.25), z = k[1] * (B / 2 + 0.07);
      b.cylinder('vagg', 'stal', x, z, 0.04, 0.12, takY(k[1] * zo) - 0.22, 14);
    });
    // Trappsteg framför dörrarna
    (s.oppningar || []).filter(function (o) { return o.typ === 'dorr' && (o.sida === 'f' || o.sida === 'b'); }).forEach(function (o) {
      var z = o.sida === 'f' ? 1 : -1;
      b.lada('vagg', 'tra', o.u0 - 0.25, 0.02, z > 0 ? B / 2 : -B / 2 - 0.6, o.u1 + 0.25, H0 - 0.02, z > 0 ? B / 2 + 0.6 : -B / 2);
    });

    // Stomme: hammarband, isolering och takstolar under taket.
    var tF = vaggTopp(B / 2), tB = vaggTopp(-B / 2), tl = Math.min(tF, tB);
    b.lada('stomme', 'tra', -L / 2 + 0.02, tF - 0.045, B / 2 - 0.15, L / 2 - 0.02, tF, B / 2 - 0.02);
    b.lada('stomme', 'tra', -L / 2 + 0.02, tB - 0.045, -B / 2 + 0.02, L / 2 - 0.02, tB, -B / 2 + 0.15);
    b.lada('stomme', 'isolering', -L / 2 + 0.17, tl - 0.24, -B / 2 + 0.17, L / 2 - 0.17, tl - 0.05, B / 2 - 0.17);
    for (var x = -L / 2 + 0.1; x < L / 2 - 0.05; x += 0.6) {
      var x1 = x + 0.045;
      var spar = function (za, zb) {
        b.hexa('stomme', 'tra', [[x, under(za) - 0.17, za], [x1, under(za) - 0.17, za], [x1, under(zb) - 0.17, zb], [x, under(zb) - 0.17, zb], [x, under(za), za], [x1, under(za), za], [x1, under(zb), zb], [x, under(zb), zb]]);
      };
      if (s.tak.form === 'pulpet') spar(-zo + 0.05, zo - 0.05);
      else { spar(-zo + 0.05, -0.02); spar(0.02, zo - 0.05); b.lada('stomme', 'tra', x, tl - 0.05, -B / 2 + 0.05, x1, tl + 0.1, B / 2 - 0.05); }
    }

    // Tak: plåt med falsar, takfot, vindskivor, nockplåt och hängrännor.
    var takPlan = function (za, zb) {
      b.hexa('tak', 'tak', [[-xo, takY(za) - TT, za], [xo, takY(za) - TT, za], [xo, takY(zb) - TT, zb], [-xo, takY(zb) - TT, zb], [-xo, takY(za), za], [xo, takY(za), za], [xo, takY(zb), zb], [-xo, takY(zb), zb]]);
      for (var fx = -xo + 0.25; fx < xo - 0.1; fx += 0.5) {
        b.hexa('tak', 'tak', [[fx, takY(za), za], [fx + 0.022, takY(za), za], [fx + 0.022, takY(zb), zb], [fx, takY(zb), zb], [fx, takY(za) + 0.032, za], [fx + 0.022, takY(za) + 0.032, za], [fx + 0.022, takY(zb) + 0.032, zb], [fx, takY(zb) + 0.032, zb]]);
      }
    };
    if (s.tak.form === 'pulpet') takPlan(-zo, zo);
    else {
      takPlan(-zo, 0); takPlan(0, zo);
      var yn = takY(0);
      b.hexa('tak', 'tak', [[-xo, yn - 0.02, -0.16], [xo, yn - 0.02, -0.16], [xo, yn - 0.02, 0.16], [-xo, yn - 0.02, 0.16], [-xo, yn + 0.05, -0.16], [xo, yn + 0.05, -0.16], [xo, yn + 0.05, 0.16], [-xo, yn + 0.05, 0.16]]);
    }
    // Vindskivor längs gavlarna
    [-1, 1].forEach(function (sx) {
      var x0 = sx * xo - (sx > 0 ? 0 : 0.03), x1 = x0 + 0.03;
      var bit = function (za, zb) { b.hexa('tak', 'panel', [[x0, takY(za) - 0.24, za], [x1, takY(za) - 0.24, za], [x1, takY(zb) - 0.24, zb], [x0, takY(zb) - 0.24, zb], [x0, takY(za) + 0.035, za], [x1, takY(za) + 0.035, za], [x1, takY(zb) + 0.035, zb], [x0, takY(zb) + 0.035, zb]]); };
      if (s.tak.form === 'pulpet') bit(-zo, zo); else { bit(-zo, 0); bit(0, zo); }
    });
    // Takfotsbrädor och hängrännor
    [-1, 1].forEach(function (sz) {
      var z = sz * zo, y = takY(z);
      b.lada('tak', 'panel', -xo, y - 0.26, Math.min(z, z - sz * 0.03), xo, y - TT + 0.01, Math.max(z, z - sz * 0.03));
      if (s.tak.form !== 'pulpet' || (s.tak.riktning * sz) < 0) {
        b.lada('tak', 'stal', -xo + 0.05, y - 0.27, Math.min(z + sz * 0.01, z + sz * 0.13), xo - 0.05, y - 0.15, Math.max(z + sz * 0.01, z + sz * 0.13));
      }
    });

    // Takkupa
    if (s.kupa) {
      var k = s.kupa, dT = 0.1;
      var kTak = function (z) { return k.yBak + (k.yFram - k.yBak) * (z - k.zTakBak) / (k.zTakFram - k.zTakBak); };
      var kUnder = function (z) { return kTak(z) - dT - 0.02; };
      var kv = vaggSida('f', L, B);
      k = Object.assign({}, k, { yBas: Math.min(k.yBas, vaggTopp(B / 2) - 0.02) });
      byggVagg(b, 'tak', kv, { u0: k.x0, u1: k.x1, yBas: k.yBas, topp: function () { return kUnder(k.zFram); }, oppningar: (s.oppningar || []).filter(function (o) { return o.kupa; }) });
      // Sidorna: från huvudtaket upp till kupans tak.
      [k.x0, k.x1].forEach(function (x, i) {
        var xa = i ? x - 0.16 : x, xb = xa + 0.16;
        var zf = k.zFram - 0.16, zb = k.zBak;
        var poly = function (xx) { return [[xx, k.yBas, zf], [xx, kUnder(zf), zf], [xx, kUnder(zb), zb], [xx, takY(zb) - 0.02, zb]]; };
        b.prisma('tak', 'fasad', poly(xa), poly(xb));
        for (var zz = zb + 0.1; zz < zf; zz += 0.2) {
          var xs = i ? xb : xa - 0.026, xe = xs + 0.026;
          var y0 = Math.max(k.yBas, takY(zz + 0.05)), y1 = kUnder(zz + 0.0225) - 0.02;
          if (y1 > y0) b.lada('tak', 'panel', xs, y0, zz, xe, y1, zz + 0.045);
        }
      });
      var kx0 = k.x0 - 0.12, kx1 = k.x1 + 0.12;
      b.hexa('tak', 'tak', [[kx0, kTak(k.zTakBak) - dT, k.zTakBak], [kx1, kTak(k.zTakBak) - dT, k.zTakBak], [kx1, kTak(k.zTakFram) - dT, k.zTakFram], [kx0, kTak(k.zTakFram) - dT, k.zTakFram], [kx0, kTak(k.zTakBak), k.zTakBak], [kx1, kTak(k.zTakBak), k.zTakBak], [kx1, kTak(k.zTakFram), k.zTakFram], [kx0, kTak(k.zTakFram), k.zTakFram]]);
      for (var fx = kx0 + 0.2; fx < kx1 - 0.1; fx += 0.5) {
        b.hexa('tak', 'tak', [[fx, kTak(k.zTakBak), k.zTakBak], [fx + 0.022, kTak(k.zTakBak), k.zTakBak], [fx + 0.022, kTak(k.zTakFram), k.zTakFram], [fx, kTak(k.zTakFram), k.zTakFram], [fx, kTak(k.zTakBak) + 0.03, k.zTakBak], [fx + 0.022, kTak(k.zTakBak) + 0.03, k.zTakBak], [fx + 0.022, kTak(k.zTakFram) + 0.03, k.zTakFram], [fx, kTak(k.zTakFram) + 0.03, k.zTakFram]]);
      }
      b.lada('tak', 'panel', kx0, kTak(k.zTakFram) - 0.22, k.zTakFram - 0.03, kx1, kTak(k.zTakFram) - dT + 0.01, k.zTakFram);
      b.lada('tak', 'stal', kx0 + 0.04, kTak(k.zTakFram) - 0.24, k.zTakFram, kx1 - 0.04, kTak(k.zTakFram) - 0.13, k.zTakFram + 0.12);
    }
    return b;
  }

  /* --- GLB ---------------------------------------------------------------------- */
  function glb(b, s) {
    // Bara material som används – oanvända laddas aldrig och går inte att färga.
    var anv = {}; Object.keys(b.g).forEach(function (k) { if (b.g[k].idx.length) anv[b.g[k].mat] = true; });
    var matNamn = Object.keys(MATERIAL).filter(function (n) { return anv[n]; });
    var json = { asset: { version: '2.0', generator: 'Byggplattformen husbygge' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'hus', children: [] }], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [], animations: [] };
    matNamn.forEach(function (n) { var m = MATERIAL[n]; json.materials.push({ name: n, pbrMetallicRoughness: { baseColorFactor: m[0].concat([1]), metallicFactor: m[1], roughnessFactor: m[2] } }); });
    var bitar = [], langd = 0;
    function lagg(typed, target) {
      var pad = (4 - (langd % 4)) % 4; if (pad) { bitar.push(new Uint8Array(pad)); langd += pad; }
      var u8 = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
      json.bufferViews.push({ buffer: 0, byteOffset: langd, byteLength: u8.byteLength, target: target });
      bitar.push(u8); langd += u8.byteLength;
      return json.bufferViews.length - 1;
    }
    function acc(typed, typ, komp, target, minmax) {
      var bv = lagg(typed, target), a = { bufferView: bv, componentType: komp, count: typed.length / ({ SCALAR: 1, VEC3: 3 }[typ]), type: typ };
      if (minmax) { a.min = minmax[0]; a.max = minmax[1]; }
      json.accessors.push(a); return json.accessors.length - 1;
    }
    var lagerNod = {};
    LAGER.forEach(function (l) { json.nodes.push({ name: l, children: [] }); lagerNod[l] = json.nodes.length - 1; json.nodes[0].children.push(lagerNod[l]); });
    Object.keys(b.g).forEach(function (k) {
      var d = b.g[k]; if (!d.idx.length) return;
      var pos = new Float32Array(d.pos), nor = new Float32Array(d.nor), idx = new Uint32Array(d.idx);
      var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (var i = 0; i < pos.length; i += 3) for (var r = 0; r < 3; r++) { mn[r] = Math.min(mn[r], pos[i + r]); mx[r] = Math.max(mx[r], pos[i + r]); }
      var aP = acc(pos, 'VEC3', 5126, 34962, [mn, mx]), aN = acc(nor, 'VEC3', 5126, 34962), aI = acc(idx, 'SCALAR', 5125, 34963);
      json.meshes.push({ name: k, primitives: [{ attributes: { POSITION: aP, NORMAL: aN }, indices: aI, material: matNamn.indexOf(d.mat) }] });
      json.nodes.push({ name: k, mesh: json.meshes.length - 1 });
      json.nodes[lagerNod[d.lager]].children.push(json.nodes.length - 1);
    });
    // Animationen "sprang": lagren dras isär på 1 s.
    var tider = new Float32Array([0, 1]), aT = acc(tider, 'SCALAR', 5126, undefined, [[0], [1]]);
    var anim = { name: 'sprang', samplers: [], channels: [] };
    LAGER.forEach(function (l) {
      var dy = ISAR[l] * (s.isar || 1);
      var ut = new Float32Array([0, 0, 0, 0, dy, 0]), aU = acc(ut, 'VEC3', 5126);
      anim.samplers.push({ input: aT, output: aU, interpolation: 'LINEAR' });
      anim.channels.push({ sampler: anim.samplers.length - 1, target: { node: lagerNod[l], path: 'translation' } });
    });
    json.animations.push(anim);
    json.buffers.push({ byteLength: langd });
    // Sätt ihop: rubrik, JSON-chunk, BIN-chunk.
    var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    var jtxt = JSON.stringify(json);
    var jb = enc ? enc.encode(jtxt) : Buffer.from(jtxt, 'utf8');
    var jpad = (4 - (jb.length % 4)) % 4, bpad = (4 - (langd % 4)) % 4;
    var total = 12 + 8 + jb.length + jpad + 8 + langd + bpad;
    var ut = new ArrayBuffer(total), dv = new DataView(ut), u8 = new Uint8Array(ut), p = 0;
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); p = 12;
    dv.setUint32(p, jb.length + jpad, true); dv.setUint32(p + 4, 0x4E4F534A, true); p += 8;
    u8.set(jb, p); p += jb.length; for (var q = 0; q < jpad; q++) u8[p++] = 0x20;
    dv.setUint32(p, langd + bpad, true); dv.setUint32(p + 4, 0x004E4942, true); p += 8;
    bitar.forEach(function (bit) { u8.set(bit, p); p += bit.byteLength; });
    return ut;
  }

  /* Beskrivning ur enkla mått – för snabbmängden. */
  function urMatt(o) {
    var L = o.langd, B = o.bredd, pul = o.tak === 'pulpet', vagg = 2.45, xo = L / 2 + 0.32, zo = B / 2 + 0.3;
    var tak = pul ? { form: 'pulpet', zo: zo, xo: xo, yLag: vagg + 0.22, yHog: Math.max(vagg + 0.5, o.nock), riktning: -1 }
      : { form: 'sadel', zo: zo, xo: xo, yFot: vagg + 0.12, yNock: Math.max(vagg + 0.8, o.nock) };
    var opp = [], n = Math.max(0, Math.round(o.fonster || 0));
    // Dörren i mitten av framsidan, fönstren jämnt fördelade runt den.
    opp.push({ sida: 'f', typ: 'dorr', u0: -0.5, u1: 0.5, y0: 0.24, y1: 2.3 });
    var fram = Math.min(n, Math.max(0, Math.floor((L - 1.6) / 1.7))), resten = n - fram;
    for (var i = 0; i < fram; i++) {
      var sida = i % 2 ? 1 : -1, nr = Math.floor(i / 2), c = sida * (1.25 + nr * 1.55);
      if (Math.abs(c) + 0.6 > L / 2 - 0.25) continue;
      opp.push({ sida: 'f', typ: 'glas', u0: c - 0.55, u1: c + 0.55, y0: 1.0, y1: 2.15 });
    }
    var gav = ['h', 'v', 'b', 'b'];
    for (var g = 0; g < resten; g++) {
      var s2 = gav[g % gav.length];
      if (s2 === 'b') { var cb = (g % 2 ? 1 : -1) * Math.min(L / 4, 1.6); opp.push({ sida: 'b', typ: 'glas', u0: cb - 0.45, u1: cb + 0.45, y0: 1.1, y1: 2.1 }); }
      else opp.push({ sida: s2, typ: 'glas', u0: -0.45, u1: 0.45, y0: 1.0, y1: 2.1 });
    }
    var plintar = [], nx = Math.max(2, Math.round((L - 0.3) / 1.75) + 1);
    for (var k = 0; k < nx; k++) { var px = -L / 2 + 0.15 + k * (L - 0.3) / (nx - 1); plintar.push([px, -B / 2 + 0.15], [px, B / 2 - 0.15]); }
    return { L: L, B: B, tak: tak, oppningar: opp, plintar: plintar };
  }

  var Husbygge = {
    glb: function (spec) { return glb(bygg(spec), spec); },
    urMatt: urMatt,
    MATERIAL: MATERIAL,
    url: function (spec) { return URL.createObjectURL(new Blob([Husbygge.glb(spec)], { type: 'model/gltf-binary' })); }
  };
  rot.Husbygge = Husbygge;
  if (typeof module !== 'undefined' && module.exports) module.exports = Husbygge;
})(typeof window !== 'undefined' ? window : globalThis);
