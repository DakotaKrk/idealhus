/* Byggplattformen – prislistor.
   En prislista är en leverantörs priser: artikelnummer, namn, pris och enhet.
   Den matas in genom att klistra in från Excel, ladda upp en CSV-fil eller skriva
   in raderna. Varje rad kopplas till ett material – först på artikelnummer, sedan
   på namnet – och kopplingen går att ändra. När en lista används ersätter dess
   priser exempelpriserna för de matchade artiklarna, och alla mängder räknas om. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;

  /* --- Lagring ---------------------------------------------------------------------- */
  function listor() { return BP.db.prislistor || (BP.db.prislistor = []); }
  function aktiv() { return listor().filter(function (l) { return l.aktiv; })[0] || null; }
  function hitta(id) { return listor().filter(function (l) { return l.id === id; })[0]; }
  function andrad(l) { l.andrad = Date.now(); BP.spara(); }

  /* --- Prismotorn: den använda listan ersätter priserna för matchade artiklar ----------- */
  var basMaterial = BP.material;
  function medLista(bas, l) {
    if (!l) return bas;
    var ut = {};
    Object.keys(bas).forEach(function (k) { ut[k] = bas[k]; });
    l.rader.forEach(function (r) {
      if (r.material && ut[r.material] && r.pris > 0) ut[r.material] = Object.assign({}, ut[r.material], { pris: r.pris, prislista: l.namn });
    });
    return ut;
  }
  var cache = null, nyckel = '';
  BP.material = function () {
    var bas = basMaterial(), l = aktiv();
    if (!l) return bas;
    var sig = l.id + ':' + l.andrad + ':' + Object.keys(bas).reduce(function (t, k) { return t + bas[k].pris; }, 0);
    if (sig !== nyckel) { cache = medLista(bas, l); nyckel = sig; }
    return cache;
  };
  BP.prislista = { aktiv: aktiv, listor: listor };

  /* --- Tolkning av inklistrad text och filer ------------------------------------------------ */
  function tal(s) {
    var t = String(s == null ? '' : s).replace(/[\s ]|kr|sek|:-/gi, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
    t = t.replace(',', '.');
    var v = parseFloat(t);
    return isFinite(v) ? v : null;
  }
  var ROLLER = ['artikel', 'namn', 'pris', 'enhet'];
  var ROLLNAMN = { artikel: 'Artikelnummer', namn: 'Namn', pris: 'Pris', enhet: 'Enhet' };
  function tolka(text) {
    var rader = String(text || '').split(/\r?\n/).map(function (r) { return r.replace(/\s+$/, ''); }).filter(function (r) { return r.trim(); });
    if (!rader.length) return null;
    var antal = function (d) { return rader.slice(0, 12).reduce(function (t, r) { return t + (r.split(d).length - 1); }, 0) / Math.min(rader.length, 12); };
    var delim = antal('\t') >= 1 ? '\t' : antal(';') >= 1 ? ';' : antal(',') >= 1 ? ',' : '\t';
    var celler = rader.map(function (r) { return r.split(delim).map(function (c) { return c.trim().replace(/^"(.*)"$/, '$1'); }); });
    var bredd = Math.max.apply(null, celler.map(function (r) { return r.length; }));
    // Rubrikrad: ord som artikel, namn, pris, enhet och inga priser
    var forsta = celler[0].join(' ').toLowerCase();
    var harRubrik = /art|ben[äa]m|namn|produkt|pris|enhet|beskr/.test(forsta) && celler[0].every(function (c) { return tal(c) === null || /^\d{4}$/.test(c) === false; });
    var rubriker = harRubrik ? celler[0] : celler[0].map(function (c, k) { return 'Kolumn ' + (k + 1); });
    var data = harRubrik ? celler.slice(1) : celler;
    var kol = { artikel: -1, namn: -1, pris: -1, enhet: -1 };
    if (harRubrik) {
      rubriker.forEach(function (r, k) {
        var t = r.toLowerCase();
        if (kol.artikel < 0 && /art|nr|nummer|sku|kod/.test(t)) kol.artikel = k;
        else if (kol.pris < 0 && /pris|kr|belopp|à|netto/.test(t)) kol.pris = k;
        else if (kol.enhet < 0 && /enh|unit|st\/|förp/.test(t)) kol.enhet = k;
        else if (kol.namn < 0 && /ben[äa]m|namn|produkt|beskr|text|artikelnamn/.test(t)) kol.namn = k;
      });
    }
    // Det som inte hittades gissas ur innehållet
    for (var k = 0; k < bredd; k++) {
      if (Object.keys(kol).some(function (r) { return kol[r] === k; })) continue;
      var v = data.slice(0, 20).map(function (r) { return r[k] || ''; });
      var siffror = v.filter(function (x) { return tal(x) !== null && /\d/.test(x) && !/[a-zåäö]{3,}/i.test(x); }).length;
      var koder = v.filter(function (x) { return /^[A-ZÅÄÖ]{0,4}[-\s]?\d{3,}[A-Z0-9-]*$/i.test(x); }).length;
      var kort = v.filter(function (x) { return /^(st|m|m²|m2|m³|m3|kg|paket|rulle|ask|låda|sats|pkt|frp)$/i.test(x); }).length;
      var langd = v.reduce(function (t, x) { return t + x.length; }, 0) / Math.max(1, v.length);
      if (kol.artikel < 0 && koder >= v.length * 0.6) kol.artikel = k;
      else if (kol.enhet < 0 && kort >= v.length * 0.5) kol.enhet = k;
      else if (kol.pris < 0 && siffror >= v.length * 0.6) kol.pris = k;
      else if (kol.namn < 0 && langd > 6) kol.namn = k;
    }
    return { rubriker: rubriker, data: data, kol: kol, delim: delim };
  }
  function tillRader(t) {
    return t.data.map(function (r) {
      var g = function (roll) { return t.kol[roll] >= 0 ? (r[t.kol[roll]] || '').trim() : ''; };
      return { artikel: g('artikel'), namn: g('namn'), pris: tal(g('pris')), enhet: g('enhet') };
    }).filter(function (r) { return (r.artikel || r.namn) && r.pris !== null; });
  }

  /* --- Matchning mot materialen --------------------------------------------------------------- */
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[×*]/g, 'x').replace(/(\d),(\d)/g, '$1.$2'); };
  var ord = function (s) { return norm(s).split(/[^a-z0-9åäö.]+/).filter(function (o) { return o && (o.length > 1 || /\d/.test(o)); }); };
  function matcha(r) {
    var mat = basMaterial(), art = norm(r.artikel).replace(/[\s-]/g, '');
    if (art) { var id = Object.keys(mat).filter(function (k) { return norm(mat[k].artikel).replace(/[\s-]/g, '') === art; })[0]; if (id) return { material: id, hur: 'artikel' }; }
    var bast = basta(r);
    return bast && bast.p >= 0.5 ? { material: bast.k, hur: 'namn' } : { material: null, hur: null };
  }
  // Ett förslag för en okopplad rad: närmaste namnet, även när det inte räckte för en säker koppling.
  function forslag(r) { var b = basta(r); return b && b.p >= 0.25 ? b : null; }
  function basta(r) {
    var mat = basMaterial(), a = ord(r.namn); if (!a.length) return null;
    var bast = null;
    Object.keys(mat).forEach(function (k) {
      var b = ord(mat[k].namn), gemen = a.filter(function (o) { return b.indexOf(o) !== -1; });
      var siffror = gemen.filter(function (o) { return /\d/.test(o); }).length;
      var poang = (gemen.length + siffror) / (Math.max(a.length, b.length) + siffror);
      if (!bast || poang > bast.p) bast = { k: k, p: poang };
    });
    return bast;
  }

  /* --- Exempellistan: exempelpriserna med leverantörens avvikelser, märkt som exempel ------------ */
  function exempelText() {
    var mat = D.MATERIAL;
    var rader = Object.keys(mat).map(function (k, n) {
      var m = mat[k], f = 1 + (((n * 37) % 17) - 8) / 100;
      var pris = Math.round(m.pris * f * (m.pris > 500 ? 1 : 100)) / (m.pris > 500 ? 1 : 100);
      // Några rader utan artikelnummer, så att namnmatchningen syns
      return [n % 9 === 4 ? '' : m.artikel, m.namn, String(pris).replace('.', ','), m.forpackning ? m.forpackning.namn : m.enhet].join('\t');
    });
    rader.push(['EX-9101', 'Trallskruv 4,2 × 42 rostfri', '389', 'ask'].join('\t'));
    rader.push(['EX-9102', 'Fasadfärg, svart, 10 l', '1195', 'st'].join('\t'));
    rader.push(['EX-9103', 'Bygglim utomhus 750 ml', '119', 'st'].join('\t'));
    return 'Artikelnr\tBenämning\tPris\tEnhet\n' + rader.join('\n');
  }

  /* --- Påverkan på projekten --------------------------------------------------------------------- */
  function summaMed(mat) { return BP.db.projekt.reduce(function (t, p) { return t + M.mangda(BP.delarFor(p), BP.recept(), mat).summa; }, 0); }
  function paverkan(l) { var bas = basMaterial(); return { fore: summaMed(bas), efter: summaMed(medLista(bas, l)) }; }

  /* ===== Vyn ======================================================================================= */
  var vy = { vald: null, filter: 'alla', q: '' };
  // Raderna glider in när man kommer till sidan eller byter filter, inte vid omritning.
  var nySida = true;
  window.addEventListener('hashchange', function () { nySida = true; });
  // Listpriser kan ha ören
  function krPris(v) { return Math.round(v) === v ? BP.kr(v) : M.tal(v, 2) + ' kr'; }
  function enhetFor(m) { return m.forpackning ? m.forpackning.namn : m.enhet; }
  function procent(d) { return (d > 0 ? '+' : '−') + BP.tal(Math.abs(d) * 100, 1) + ' %'; }
  function diffChip(r, m) {
    if (!m) return '<span class="pl-chip pl-chip--ingen">Ingen koppling</span>';
    var d = (r.pris - m.pris) / m.pris;
    if (Math.abs(d) < 0.005) return '<span class="pl-chip">Samma</span>';
    return '<span class="pl-chip ' + (d > 0 ? 'pl-chip--upp' : 'pl-chip--ned') + '">' + procent(d) + '</span>';
  }
  // Skillnaden som en stapel från mitten: vänster billigare, höger dyrare (full längd = 10 %).
  function diffCell(r, m) {
    if (!m) return diffChip(r, m);
    var d = (r.pris - m.pris) / m.pris;
    return '<span class="pl-diff"><span class="pl-diff__spar ' + (d > 0 ? 'upp' : 'ned') + '" aria-hidden="true"><i style="--w:' + Math.min(1, Math.abs(d) / 0.1).toFixed(3) + '"></i></span>' + diffChip(r, m) + '</span>';
  }
  function enhetFel(r, m) { return m && r.enhet && r.enhet.toLowerCase().replace('m2', 'm²').replace('m3', 'm³') !== enhetFor(m).toLowerCase(); }

  // Hur mycket av varje material projekten använder – för att räkna vad en prisändring betyder i kronor.
  var forbrukCache = null, forbrukNyckel = '';
  function forbruk() {
    var bas = basMaterial(), sig = JSON.stringify(BP.db.projekt.map(function (p) { return [p.id, BP.delarFor(p).length]; }));
    if (sig === forbrukNyckel && forbrukCache) return forbrukCache;
    var ut = {};
    BP.db.projekt.forEach(function (p) {
      M.mangda(BP.delarFor(p), BP.recept(), bas).rader.forEach(function (r) { if (r.apris) ut[r.material] = (ut[r.material] || 0) + r.summa / r.apris; });
    });
    forbrukNyckel = sig; forbrukCache = ut;
    return ut;
  }
  function kronor(r, bas, fb) { var m = r.material && bas[r.material]; return m && fb[r.material] ? fb[r.material] * (r.pris - m.pris) : 0; }

  function filtrera(l, bas) {
    var q = vy.q.trim().toLowerCase();
    return l.rader.map(function (r, k) { return { r: r, k: k, m: r.material ? bas[r.material] : null }; }).filter(function (x) {
      if (q && (x.r.artikel + ' ' + x.r.namn + ' ' + (x.m ? x.m.namn : '')).toLowerCase().indexOf(q) === -1) return false;
      if (vy.filter === 'dyrare') return x.m && x.r.pris > x.m.pris * 1.005;
      if (vy.filter === 'billigare') return x.m && x.r.pris < x.m.pris * 0.995;
      if (vy.filter === 'ingen') return !x.m;
      if (vy.filter === 'kolla') return !x.m || enhetFel(x.r, x.m);
      return true;
    });
  }

  // Raderna grupperade som materialen (Stomme, Isolering …), de okopplade sist.
  function tabellRader(l, bas, anim) {
    var visa = filtrera(l, bas), fb = forbruk();
    if (!visa.length) return '<tr><td colspan="5" class="pl-ingenrad">' + (vy.q ? 'Inget matchar "' + e(vy.q) + '".' : 'Inga rader här – bra jobbat.') + '</td></tr>';
    var grupper = {}, ordning = [];
    visa.forEach(function (x) { var g = x.m ? x.m.grupp || 'Övrigt' : 'Utan koppling'; if (!grupper[g]) { grupper[g] = []; ordning.push(g); } grupper[g].push(x); });
    ordning.sort(function (a, b) { return (a === 'Utan koppling') - (b === 'Utan koppling'); });
    var val = Object.keys(bas).map(function (k) { return '<option value="' + k + '">' + e(bas[k].namn) + '</option>'; }).join('');
    var n = 0;
    return ordning.map(function (g) {
      var kr = grupper[g].reduce(function (t, x) { return t + kronor(x.r, bas, fb); }, 0);
      return '<tr class="pl-grupp' + (anim ? ' pl-in' : '') + '" style="--r:' + Math.min(n++, 16) + '"><th colspan="5"><span>' + e(g) + '</span><small>' + grupper[g].length + ' rader' + (Math.abs(kr) >= 1 ? ' · <b class="' + (kr > 0 ? 'upp' : 'ned') + '">' + (kr > 0 ? '+' : '−') + BP.kr(Math.abs(kr)) + '</b> i projekten' : '') + '</small></th></tr>' +
        grupper[g].map(function (x) {
          var m = x.m, f = !m ? forslag(x.r) : null;
          return '<tr class="prl-rad' + (m ? '' : ' prl-rad--ingen') + (anim ? ' pl-in' : '') + '" style="--r:' + Math.min(n++, 16) + '"><td style="padding-left:16px"><b>' + e(x.r.namn || '–') + '</b><small>' + e(x.r.artikel || 'inget artikelnummer') + (x.r.hur ? ' · ' + (x.r.hur === 'artikel' ? 'kopplad på artikelnummer' : x.r.hur === 'namn' ? 'kopplad på namn' : 'kopplad för hand') : '') + '</small></td>' +
            '<td>' + (f ? '<button class="pl-forslag" type="button" data-forslag="' + x.k + '" data-mat="' + f.k + '">' + i('bock') + '<span>Koppla till <b>' + e(bas[f.k].namn) + '</b>?</span></button>' : '') +
              '<select class="pl-koppla" data-rad="' + x.k + '" aria-label="Koppla ' + e(x.r.namn) + ' till material"><option value="">Ingen koppling</option>' + val.replace('value="' + (x.r.material || '') + '"', 'value="' + (x.r.material || '') + '" selected') + '</select></td>' +
            '<td class="tal-c"><b>' + krPris(x.r.pris) + '</b><small>per ' + e(x.r.enhet || (m ? enhetFor(m) : 'st')) + (enhetFel(x.r, m) ? ' · <span class="pl-varn">kolla enheten</span>' : '') + '</small></td>' +
            '<td class="tal-c">' + (m ? krPris(m.pris) + '<small>per ' + e(enhetFor(m)) + '</small>' : '–') + '</td><td class="tal-c">' + diffCell(x.r, m) + '</td></tr>';
        }).join('');
    }).join('');
  }

  // Tom sida: en liten film där tre rader ur en prislista hittar sina material.
  function tomSida() {
    var demo = [['EX-1001', 'Regel 45 × 170 C24', '57,04', 'Regel 45 × 170'], ['EX-3001', 'Mineralull 170 mm', '126,26', 'Mineralull 170'], ['', 'Råspont 23 × 95', '15,52', 'Råspont 23 × 95']];
    return '<section class="pl-tom sd-steg" style="--i:0">' +
      '<div class="pl-demo" aria-hidden="true"><div class="pl-demo__lista"><small>Leverantörens lista</small>' + demo.map(function (d, n) {
        return '<div class="pl-demo__rad" style="--d:' + n + '"><span>' + (d[0] || '—') + '</span><b>' + d[1] + '</b><span>' + d[2] + '</span></div>';
      }).join('') + '</div><div class="pl-demo__flode">' + demo.map(function (d, n) { return '<i style="--d:' + n + '"></i>'; }).join('') + '</div><div class="pl-demo__mat"><small>Dina material</small>' + demo.map(function (d, n) {
        return '<div class="pl-demo__chip" style="--d:' + n + '">' + i('bock') + '<span>' + d[3] + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="pl-tom__text"><h2>Mata in din första prislista</h2><p>Raderna kopplas till dina material på artikelnummer och namn. Du ser vad listan betyder för projekten innan du använder den – och sedan räknar du kundpriset med ditt TB.</p></div>' +
      '<div class="pl-satt">' + [['klistra', 'kopiera', 'Klistra in', 'Markera i Excel, kopiera och klistra in'], ['fil', 'uppladd', 'Ladda upp fil', 'CSV eller textfil från leverantören'], ['skriv', 'recept', 'Skriv in', 'Några rader för hand']].map(function (s, n) {
        return '<button class="pl-satt__kort" type="button" data-g="pl-ny" data-satt="' + s[0] + '" style="--k:' + n + '"><span class="pl-satt__ikon">' + i(s[1]) + '</span><b>' + s[2] + '</b><small>' + s[3] + '</small>' + i('pil', 'pl-satt__pil') + '</button>';
      }).join('') + '</div>' +
      '<button class="knapp knapp--text" type="button" data-g="pl-exempel">' + i('dokument') + 'Eller lägg in en exempellista och prova</button></section>';
  }

  BP.vyer.prislistor = function () {
    var alla = listor(), a = aktiv(), bas = basMaterial();
    var anim = nySida; nySida = false;
    if (!vy.vald || !hitta(vy.vald)) vy.vald = (a || alla[0] || {}).id || null;
    var l = vy.vald ? hitta(vy.vald) : null;
    var tot = summaMed(BP.material());
    var html = BP.sidhuvud({
      vy: 'prislistor', titel: 'Prislistor',
      under: 'Mata in leverantörens nettopriser. Den lista du använder ersätter exempelpriserna i alla mängder – och blir nettot i kalkylen där du sätter ditt TB.',
      knappar: '<a class="knapp" href="#/kalkyl">' + i('dokument') + 'Kalkyl och offert</a><button class="knapp knapp--gul" type="button" data-g="pl-ny">' + i('plus') + 'Mata in prislista</button>',
      kpi: [
        { namn: 'Prislistor', rakna: alla.length, varde: alla.length, under: alla.length ? 'inmatade' : 'inga än' },
        { namn: 'Används nu', varde: e(a ? a.namn : 'Exempelpriser'), under: a ? (a.leverantor || 'egen lista') : 'ingen prislista vald' },
        { namn: 'Material i projekten', rakna: tot, format: 'kort', varde: BP.kort(tot), under: a ? 'netto med ' + a.namn : 'med exempelpriser' }
      ]
    });
    if (!alla.length) return { titel: 'Prislistor', html: BP.sdOmslag(html + tomSida()) };

    var detalj = '';
    if (l) {
      var fb = forbruk();
      var mt = l.rader.filter(function (r) { return r.material; }).length;
      var antal = {
        alla: l.rader.length,
        dyrare: l.rader.filter(function (r) { return r.material && r.pris > bas[r.material].pris * 1.005; }).length,
        billigare: l.rader.filter(function (r) { return r.material && r.pris < bas[r.material].pris * 0.995; }).length,
        kolla: l.rader.filter(function (r) { return !r.material || enhetFel(r, bas[r.material]); }).length
      };
      var p = paverkan(l), dp = p.efter - p.fore, storst = Math.max(p.fore, p.efter);
      // Stegen för listan: vad som är klart och vad som återstår
      var steg = [
        { klar: true, namn: 'Inmatad', text: l.rader.length + ' rader' },
        { klar: !antal.kolla, namn: 'Kopplingarna', text: antal.kolla ? antal.kolla + ' att kolla' : 'alla klara', g: 'data-plf="kolla"' },
        { klar: l.aktiv, namn: 'Används', text: l.aktiv ? 'i alla mängder' : 'inte än', g: l.aktiv ? '' : 'data-g="pl-anvand" data-id="' + l.id + '"' },
        { klar: false, namn: 'Kundpris med TB', text: 'kalkyl och offert', href: '#/kalkyl' }
      ];
      var nasta = steg.filter(function (s) { return !s.klar; })[0];
      var stegHtml = '<ol class="pl-stegen" aria-label="Så långt har listan kommit">' + steg.map(function (s, n) {
        var inre = '<i>' + (s.klar ? i('bock') : n + 1) + '</i><span><b>' + s.namn + '</b><small>' + s.text + '</small></span>';
        var klass = (s.klar ? 'klar' : '') + (s === nasta ? ' nasta' : '');
        return '<li class="' + klass + '" style="--s:' + n + '">' + (s.href ? '<a href="' + s.href + '">' + inre + '</a>' : s.g ? '<button type="button" ' + s.g + '>' + inre + '</button>' : '<div>' + inre + '</div>') + '</li>';
      }).join('') + '</ol>';

      // Insikterna: störst påverkan i kronor på projekten
      var medKr = l.rader.map(function (r) { return { r: r, kr: kronor(r, bas, fb) }; }).filter(function (x) { return Math.abs(x.kr) >= 1; });
      var topp = function (tecken) { return medKr.filter(function (x) { return x.kr * tecken > 0; }).sort(function (a, b) { return Math.abs(b.kr) - Math.abs(a.kr); }).slice(0, 3); };
      var insikt = function (rubrik, emoji, rader, klass) {
        return '<div class="pl-insikt pl-insikt--' + klass + '"><h3><span aria-hidden="true">' + emoji + '</span>' + rubrik + '</h3>' + (rader.length ? '<ol>' + rader.map(function (x) {
          return '<li><span>' + e(x.r.namn) + '</span><b>' + (x.kr > 0 ? '+' : '−') + BP.kr(Math.abs(x.kr)) + '</b></li>';
        }).join('') + '</ol>' : '<p>Inga i den här listan.</p>') + '</div>';
      };
      var ingen = l.rader.filter(function (r) { return !r.material; }).length, enh = l.rader.filter(function (r) { return r.material && enhetFel(r, bas[r.material]); }).length;
      var insikter = '<div class="pl-insikter">' + insikt('Sparar mest', '💚', topp(-1), 'ned') + insikt('Kostar mer', '📈', topp(1), 'upp') +
        '<div class="pl-insikt pl-insikt--kolla"><h3><span aria-hidden="true">🔎</span>Att kolla</h3>' + (antal.kolla ? '<ul>' + (ingen ? '<li><span>Utan koppling</span><b>' + ingen + '</b></li>' : '') + (enh ? '<li><span>Annan enhet än materialet</span><b>' + enh + '</b></li>' : '') + '</ul><button class="knapp knapp--liten" type="button" data-plf="kolla">Visa dem</button>' : '<p>Allt är kopplat och enheterna stämmer.</p>') + '</div></div>';

      detalj =
        '<section class="kort pl-detalj sd-steg" style="--i:1">' +
          '<header class="pl-detalj__huvud"><div><h2>' + e(l.namn) + '</h2><small>' + e(l.leverantor || 'Egen lista') + ' · inmatad ' + BP.datum(l.skapad) + ' · ' + mt + ' av ' + l.rader.length + ' kopplade</small></div>' +
            '<div class="pl-detalj__knappar">' + (l.aktiv ? '<span class="pl-anvands-stor">' + i('bock') + 'Används</span><button class="knapp knapp--text" type="button" data-g="pl-sluta" data-id="' + l.id + '">Sluta använda</button>' : '<button class="knapp knapp--primar" type="button" data-g="pl-anvand" data-id="' + l.id + '">' + i('bock') + 'Använd listan</button>') +
            '<button class="knapp knapp--text" type="button" data-g="pl-export" data-id="' + l.id + '">' + i('ladda') + 'CSV</button><button class="knapp knapp--text" type="button" data-g="pl-bort" data-id="' + l.id + '">' + i('radera') + 'Ta bort</button></div></header>' +
          stegHtml +
          '<div class="pl-paverkan' + (l.aktiv ? ' pl-paverkan--aktiv' : '') + '">' +
            '<div class="pl-paverkan__text"><small>' + (l.aktiv ? 'Materialet i alla projekt med listan' : 'Om du använder listan blir materialet i alla projekt') + '</small><b><span data-rakna="' + Math.round(p.efter) + '" data-format="kr">' + BP.kr(p.efter) + '</span></b>' +
              '<span class="pl-chip ' + (dp > 0 ? 'pl-chip--upp' : dp < 0 ? 'pl-chip--ned' : '') + '">' + (Math.abs(dp) >= 1 ? (dp > 0 ? '+' : '−') + BP.kr(Math.abs(dp)) + ' (' + procent(dp / p.fore) + ')' : 'ingen skillnad') + '</span></div>' +
            '<div class="pl-staplar" aria-hidden="true"><div><small>Exempelpriser</small><span><i style="--a:' + (p.fore / storst).toFixed(4) + '"></i></span><b>' + BP.kort(p.fore) + '</b></div><div class="med"><small>Med listan</small><span><i style="--a:' + (p.efter / storst).toFixed(4) + '"></i></span><b>' + BP.kort(p.efter) + '</b></div></div>' +
          '</div>' +
          insikter +
          '<div class="pl-verktyg"><label class="pl-sok">' + i('sok') + '<input type="search" id="pl-sok" placeholder="Sök artikel eller namn" value="' + e(vy.q) + '" aria-label="Sök i prislistan"></label>' +
            '<div class="pl-filter" role="group" aria-label="Visa"><i class="pl-filter__markor" aria-hidden="true"></i>' + [['alla', 'Alla'], ['billigare', 'Billigare'], ['dyrare', 'Dyrare'], ['kolla', 'Att kolla']].map(function (f) { return '<button type="button" data-plf="' + f[0] + '" aria-pressed="' + (vy.filter === f[0]) + '">' + f[1] + '<span>' + antal[f[0]] + '</span></button>'; }).join('') + '</div></div>' +
          '<div class="tabellram"><table class="tabell pl-tabell"><thead><tr><th style="padding-left:16px">Artikel i listan</th><th>Kopplas till material</th><th class="tal-c">Listpris</th><th class="tal-c">Exempelpris nu</th><th class="tal-c">Skillnad</th></tr></thead><tbody id="pl-kropp">' +
            tabellRader(l, bas, anim) +
          '</tbody></table></div></section>';
    }
    html += '<div class="pl-yta">' +
      '<aside class="pl-listor sd-steg" style="--i:0" aria-label="Prislistorna"><small class="pl-listor__rubrik">Dina listor</small>' +
        '<button class="prl-lista' + (!a ? ' prl-lista--aktiv' : '') + '" type="button" data-g="pl-grund"><span class="prl-lista__ikon">' + i('recept') + '</span><span><b>Exempelpriser</b><small>' + Object.keys(bas).length + ' artiklar · grunden</small></span>' + (!a ? '<span class="pl-anvands">Används</span>' : '') + '</button>' +
        alla.map(function (x) {
          var mt = x.rader.filter(function (r) { return r.material; }).length;
          return '<button class="prl-lista' + (x.id === vy.vald ? ' prl-lista--vald' : '') + (x.aktiv ? ' prl-lista--aktiv' : '') + '" type="button" data-plv="' + x.id + '"><span class="prl-lista__ikon">' + i('pris') + '</span><span><b>' + e(x.namn) + '</b><small>' + e(x.leverantor || 'Egen lista') + ' · ' + mt + ' av ' + x.rader.length + ' kopplade</small><i class="prl-lista__stapel"><i style="--a:' + (mt / Math.max(1, x.rader.length)).toFixed(3) + '"></i></i></span>' + (x.aktiv ? '<span class="pl-anvands">Används</span>' : '') + '</button>';
        }).join('') +
        '<button class="prl-lista prl-lista--ny" type="button" data-g="pl-ny"><span class="prl-lista__ikon">' + i('plus') + '</span><span><b>Mata in prislista</b><small>Klistra in, ladda upp eller skriv in</small></span></button>' +
      '</aside>' + detalj + '</div>';
    return {
      titel: 'Prislistor', html: BP.sdOmslag(html),
      efter: function (rot) {
        $$('[data-plv]', rot).forEach(function (b) { b.addEventListener('click', function () { vy.vald = b.getAttribute('data-plv'); vy.filter = 'alla'; vy.q = ''; nySida = true; BP.rita(); }); });
        if (!l) return;
        var kropp = $('#pl-kropp', rot), filter = $('.pl-filter', rot), markor = $('.pl-filter__markor', rot);
        // Markören glider till det valda filtret
        var flytta = function (direkt) {
          var b = $('[data-plf][aria-pressed="true"]', filter);
          if (!b || !markor) return;
          if (direkt) markor.style.transition = 'none';
          markor.style.width = b.offsetWidth + 'px';
          markor.style.transform = 'translateX(' + b.offsetLeft + 'px)';
          if (direkt) { markor.offsetWidth; markor.style.transition = ''; }
        };
        requestAnimationFrame(function () { flytta(true); });
        var visa = function () { kropp.innerHTML = tabellRader(l, bas, true); };
        $$('[data-plf]', rot).forEach(function (b) {
          b.addEventListener('click', function () {
            vy.filter = b.getAttribute('data-plf');
            $$('[data-plf]', filter).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-plf') === vy.filter)); });
            flytta(); visa();
            if (!filter.contains(b)) filter.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
        var sok = $('#pl-sok', rot);
        sok.addEventListener('input', function () { vy.q = sok.value; clearTimeout(sok.t); sok.t = setTimeout(visa, 120); });
        var omrita = function (rubrik, text) { andrad(l); var y = $('#ark') ? $('#ark').scrollTop : 0; BP.rita(); if ($('#ark')) $('#ark').scrollTop = y; BP.toast(rubrik, text); };
        kropp.addEventListener('change', function (ev) {
          var s = ev.target.closest('.pl-koppla'); if (!s) return;
          var r = l.rader[+s.getAttribute('data-rad')];
          r.material = s.value || null; r.hur = s.value ? 'hand' : null;
          omrita(s.value ? 'Kopplingen är ändrad' : 'Kopplingen är borttagen', r.namn);
        });
        kropp.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-forslag]'); if (!b) return;
          var r = l.rader[+b.getAttribute('data-forslag')];
          r.material = b.getAttribute('data-mat'); r.hur = 'hand';
          omrita('Kopplad', r.namn + ' → ' + bas[r.material].namn);
        });
      }
    };
  };

  G['pl-anvand'] = function (el) {
    var l = hitta(el.getAttribute('data-id'));
    listor().forEach(function (x) { x.aktiv = x === l; });
    andrad(l); BP.rita();
    BP.toast('Prislistan används', l.namn + ' · alla mängder räknas om');
  };
  G['pl-sluta'] = function () { listor().forEach(function (x) { x.aktiv = false; }); BP.spara(); BP.rita(); BP.toast('Exempelpriserna används igen', 'Ingen prislista är vald'); };
  G['pl-grund'] = function () { if (aktiv()) G['pl-sluta'](); };
  G['pl-bort'] = function (el) {
    if (el.getAttribute('data-sakert') !== '1') {
      el.setAttribute('data-sakert', '1'); el.innerHTML = i('varning') + 'Klicka igen för att ta bort';
      setTimeout(function () { if (document.body.contains(el)) { el.removeAttribute('data-sakert'); el.innerHTML = i('radera') + 'Ta bort'; } }, 4000);
      return;
    }
    var l = hitta(el.getAttribute('data-id'));
    BP.db.prislistor = listor().filter(function (x) { return x !== l; });
    vy.vald = null; BP.spara(); BP.rita(); BP.toast('Prislistan är borttagen', l.namn);
  };
  G['pl-export'] = function (el) {
    var l = hitta(el.getAttribute('data-id'));
    var csv = 'Artikelnr;Benämning;Pris;Enhet\n' + l.rader.map(function (r) { return [r.artikel, r.namn, String(r.pris).replace('.', ','), r.enhet].join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = l.namn.replace(/[^\wåäöÅÄÖ -]+/g, '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };
  G['pl-exempel'] = function () { spara({ namn: 'Exempel Bygghandel 2026', leverantor: 'Exempel Bygghandel', rader: tillRader(tolka(exempelText())) }, false); };

  function spara(o, anvand) {
    var l = { id: 'pl' + Date.now().toString(36), namn: o.namn, leverantor: o.leverantor, skapad: new Date().toISOString(), andrad: Date.now(), aktiv: false,
      rader: o.rader.map(function (r) { var m = matcha(r); return { artikel: r.artikel, namn: r.namn, pris: r.pris, enhet: r.enhet, material: m.material, hur: m.hur }; }) };
    listor().unshift(l);
    if (anvand) listor().forEach(function (x) { x.aktiv = x === l; });
    vy.vald = l.id; vy.filter = 'alla'; vy.q = '';
    BP.spara();
    if (location.hash !== '#/prislistor') BP.ga('#/prislistor'); else BP.rita();
    var mt = l.rader.filter(function (r) { return r.material; }).length;
    BP.toast(anvand ? 'Prislistan är sparad och används' : 'Prislistan är sparad', mt + ' av ' + l.rader.length + ' rader kopplade till material');
  }

  /* ===== Mata in en prislista ===================================================================== */
  G['pl-ny'] = function (el) {
    var st = { satt: 'klistra', text: '', tolkad: null, manuella: [{}, {}, {}] };
    var d = BP.dialog({
      titel: 'Mata in prislista',
      kropp:
        '<div class="pi-satt" role="tablist" aria-label="Hur listan matas in">' +
          '<button type="button" role="tab" data-pi="klistra" aria-selected="true">' + i('kopiera') + 'Klistra in</button>' +
          '<button type="button" role="tab" data-pi="fil" aria-selected="false">' + i('uppladd') + 'Ladda upp fil</button>' +
          '<button type="button" role="tab" data-pi="skriv" aria-selected="false">' + i('recept') + 'Skriv in</button>' +
        '</div>' +
        '<div class="pi-panel" data-panel="klistra"><label class="falt"><span>Markera raderna i Excel (eller leverantörens fil) och klistra in här</span><textarea id="pi-text" rows="7" placeholder="Artikelnr&#9;Benämning&#9;Pris&#9;Enhet&#10;EX-1001&#9;Regel 45 × 170 C24&#9;64,50&#9;m"></textarea></label>' +
          '<button class="knapp knapp--text knapp--liten pi-exempel" type="button" id="pi-exempel">' + i('dokument') + 'Fyll i ett exempel</button></div>' +
        '<div class="pi-panel" data-panel="fil" hidden><label class="pi-slapp" id="pi-slapp" tabindex="0"><input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" hidden id="pi-fil">' + i('uppladd') + '<b>Släpp en CSV-fil här</b><small>eller klicka för att välja · semikolon, tabb eller komma</small></label></div>' +
        '<div class="pi-panel" data-panel="skriv" hidden><div class="pi-manuell" id="pi-manuell"></div><button class="knapp knapp--liten" type="button" id="pi-rad">' + i('plus') + 'Lägg till rad</button></div>' +
        '<div class="pi-kolumner" id="pi-kolumner" hidden></div>' +
        '<div class="pi-forhand" id="pi-forhand"></div>' +
        '<div class="pi-namn"><label class="falt"><span>Namn på listan</span><input id="pi-namn" placeholder="t.ex. Bygghandeln, oktober 2026"></label><label class="falt"><span>Leverantör</span><input id="pi-lev" placeholder="t.ex. Exempel Bygghandel"></label></div>',
      fot: '<button class="knapp" type="button" data-stang>Avbryt</button><button class="knapp" type="button" id="pi-spara" disabled>Spara</button><button class="knapp knapp--primar" type="button" id="pi-anvand" disabled>' + i('bock') + 'Spara och använd</button>'
    });
    d.classList.add('dialog--bred', 'dialog--pris');
    var forhand = $('#pi-forhand', d), kolumner = $('#pi-kolumner', d), text = $('#pi-text', d), manuell = $('#pi-manuell', d);
    var rader = function () {
      if (st.satt === 'skriv') return st.manuella.map(function (r) { return { artikel: (r.artikel || '').trim(), namn: (r.namn || '').trim(), pris: tal(r.pris), enhet: (r.enhet || '').trim() }; }).filter(function (r) { return (r.artikel || r.namn) && r.pris !== null; });
      return st.tolkad ? tillRader(st.tolkad) : [];
    };
    function ritaKolumner() {
      var t = st.tolkad;
      kolumner.hidden = !t || st.satt === 'skriv';
      if (kolumner.hidden) return;
      kolumner.innerHTML = '<p><b>Kolumnerna</b> · hittade automatiskt, ändra om något blev fel</p><div class="pi-kol">' + ROLLER.map(function (roll) {
        return '<label class="falt"><span>' + ROLLNAMN[roll] + '</span><select data-roll="' + roll + '"><option value="-1">' + (roll === 'enhet' || roll === 'artikel' ? 'Saknas' : 'Välj kolumn') + '</option>' + t.rubriker.map(function (r, k) { return '<option value="' + k + '"' + (t.kol[roll] === k ? ' selected' : '') + '>' + e(r || 'Kolumn ' + (k + 1)) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div>';
      $$('select', kolumner).forEach(function (s) { s.addEventListener('change', function () { t.kol[s.getAttribute('data-roll')] = +s.value; ritaForhand(); }); });
    }
    function ritaForhand() {
      var r = rader();
      var ok = r.length > 0;
      $('#pi-spara', d).disabled = !ok; $('#pi-anvand', d).disabled = !ok;
      if (!ok) { forhand.innerHTML = st.satt === 'skriv' ? '' : '<p class="pi-tom">Förhandsvisningen visas här när raderna har tolkats.</p>'; return; }
      var m = r.map(matcha), mt = m.filter(function (x) { return x.material; }).length, bas = basMaterial();
      forhand.innerHTML = '<p class="pi-sammanf"><b>' + r.length + (r.length === 1 ? ' rad' : ' rader') + '</b> · ' + mt + ' kopplas till material' + (r.length - mt ? ' · ' + (r.length - mt) + ' utan koppling (går att koppla sen)' : '') + '</p>' +
        '<div class="pi-tabell"><table class="tabell"><thead><tr><th style="padding-left:12px">Artikel</th><th>Kopplas till</th><th class="tal-c">Pris</th><th class="tal-c">Skillnad</th></tr></thead><tbody>' +
        r.slice(0, 8).map(function (x, k) {
          var mm = m[k].material ? bas[m[k].material] : null;
          return '<tr><td style="padding-left:12px"><b>' + e(x.namn || x.artikel) + '</b><small>' + e(x.artikel || '') + '</small></td><td>' + (mm ? e(mm.namn) + '<small>på ' + (m[k].hur === 'artikel' ? 'artikelnummer' : 'namn') + '</small>' : '<span class="pl-chip pl-chip--ingen">Ingen koppling</span>') + '</td><td class="tal-c">' + krPris(x.pris) + '</td><td class="tal-c">' + diffChip(x, mm) + '</td></tr>';
        }).join('') + '</tbody></table>' + (r.length > 8 ? '<p class="pi-fler">+ ' + (r.length - 8) + ' rader till</p>' : '') + '</div>';
    }
    function ritaManuell() {
      manuell.innerHTML = '<div class="pi-mrad pi-mrad--huvud"><span>Artikelnr</span><span>Namn</span><span>Pris (kr)</span><span>Enhet</span><span></span></div>' + st.manuella.map(function (r, k) {
        return '<div class="pi-mrad"><input data-m="' + k + '" data-f="artikel" value="' + e(r.artikel || '') + '" placeholder="EX-1001" aria-label="Artikelnummer, rad ' + (k + 1) + '"><input data-m="' + k + '" data-f="namn" value="' + e(r.namn || '') + '" placeholder="Regel 45 × 170 C24" aria-label="Namn, rad ' + (k + 1) + '"><input data-m="' + k + '" data-f="pris" value="' + e(r.pris || '') + '" inputmode="decimal" placeholder="64,50" aria-label="Pris, rad ' + (k + 1) + '"><input data-m="' + k + '" data-f="enhet" value="' + e(r.enhet || '') + '" placeholder="m" aria-label="Enhet, rad ' + (k + 1) + '"><button type="button" class="knapp knapp--text knapp--ikon" data-mbort="' + k + '" aria-label="Ta bort rad ' + (k + 1) + '">' + i('stang') + '</button></div>';
      }).join('');
    }
    var tolkaText = function (t) { st.text = t; st.tolkad = tolka(t); ritaKolumner(); ritaForhand(); };
    text.addEventListener('input', function () { clearTimeout(text.t); text.t = setTimeout(function () { tolkaText(text.value); }, 150); });
    $('#pi-exempel', d).addEventListener('click', function () {
      text.value = exempelText(); tolkaText(text.value);
      if (!$('#pi-namn', d).value) $('#pi-namn', d).value = 'Exempel Bygghandel 2026';
      if (!$('#pi-lev', d).value) $('#pi-lev', d).value = 'Exempel Bygghandel';
    });
    $$('[data-pi]', d).forEach(function (b) {
      b.addEventListener('click', function () {
        st.satt = b.getAttribute('data-pi');
        $$('[data-pi]', d).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        $$('[data-panel]', d).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== st.satt; });
        if (st.satt === 'skriv') ritaManuell();
        ritaKolumner(); ritaForhand();
      });
    });
    // Fil
    var slapp = $('#pi-slapp', d), fil = $('#pi-fil', d);
    var lasFil = function (f) {
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        tolkaText(String(rd.result));
        if (!$('#pi-namn', d).value) $('#pi-namn', d).value = f.name.replace(/\.[^.]+$/, '');
        slapp.classList.add('klar'); $('b', slapp).textContent = f.name;
      };
      rd.readAsText(f, 'utf-8');
    };
    fil.addEventListener('change', function () { lasFil(fil.files[0]); });
    ['dragenter', 'dragover'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { slapp.addEventListener(t, function (ev) { ev.preventDefault(); slapp.classList.remove('over'); }); });
    slapp.addEventListener('drop', function (ev) { lasFil(ev.dataTransfer.files[0]); });
    slapp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fil.click(); } });
    // Skriv in
    manuell.addEventListener('input', function (ev) { var t = ev.target; if (t.hasAttribute('data-m')) { st.manuella[+t.getAttribute('data-m')][t.getAttribute('data-f')] = t.value; ritaForhand(); } });
    manuell.addEventListener('click', function (ev) { var b = ev.target.closest('[data-mbort]'); if (b) { st.manuella.splice(+b.getAttribute('data-mbort'), 1); if (!st.manuella.length) st.manuella.push({}); ritaManuell(); ritaForhand(); } });
    $('#pi-rad', d).addEventListener('click', function () { st.manuella.push({}); ritaManuell(); var f = $$('input[data-f="artikel"]', manuell).pop(); if (f) f.focus(); });
    // Spara
    var klar = function (anvand) {
      var r = rader(); if (!r.length) return;
      spara({ namn: $('#pi-namn', d).value.trim() || 'Prislista ' + new Date().toLocaleDateString('sv-SE'), leverantor: $('#pi-lev', d).value.trim(), rader: r }, anvand);
      d.close();
    };
    $('#pi-spara', d).addEventListener('click', function () { klar(false); });
    $('#pi-anvand', d).addEventListener('click', function () { klar(true); });
    ritaForhand();
    var start = el && el.getAttribute && el.getAttribute('data-satt');
    if (start && start !== 'klistra') $('[data-pi="' + start + '"]', d).click(); else text.focus();
  };
})();
