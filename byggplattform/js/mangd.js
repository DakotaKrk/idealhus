/* Byggplattformen – mängdningsmotorn.
   Räknar fram en materiallista ur byggdelar (väggar, bjälklag, tak,
   grund, öppningar) och recept. Varje rad bär sin källa: vilka byggdelar
   den kommer ifrån och hur den räknats, så att ingen siffra står utan
   förklaring. Ingen DOM här – samma kod körs i webbläsaren och i node.

   Måtten är meter, ytor m², volymer m³. Recepten och priserna i data.js
   är exempel och ska ersättas med företagets egna. */
(function (rot) {
  'use strict';

  var STANDARDLANGDER = [2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 4.8, 5.1, 5.4];
  var SAGSNITT = 0.004; // sågbladets bredd per kap, meter

  function avrunda(v, d) { var f = Math.pow(10, d == null ? 2 : d); return Math.round(v * f) / f; }
  function grader(v) { return v * Math.PI / 180; }

  /* --- Kapoptimering --------------------------------------------------
     Bitarna sorteras längst först och läggs i första längd där de ryms
     (first fit decreasing). En ny längd väljs som den kortaste standard-
     längd som rymmer biten. Till sist krymps varje längd till den
     kortaste standardlängd som rymmer det som faktiskt ligger i den. */
  function kapa(bitar, langder) {
    langder = (langder || STANDARDLANGDER).slice().sort(function (a, b) { return a - b; });
    var max = langder[langder.length - 1];
    var lista = bitar.filter(function (b) { return b > 0; }).slice().sort(function (a, b) { return b - a; });
    var for_langa = [];
    var stanger = [];
    lista.forEach(function (bit) {
      if (bit > max + 1e-9) { for_langa.push(bit); return; }
      for (var i = 0; i < stanger.length; i++) {
        var s = stanger[i];
        if (s.anvant + SAGSNITT + bit <= s.langd + 1e-9) { s.bitar.push(bit); s.anvant += SAGSNITT + bit; return; }
      }
      // Ny stång: prova varje längd som rymmer biten, fyll den på prov med
      // de bitar som ännu inte är placerade, och välj den med minst spill
      // per använd meter (kortast vid lika).
      var kvar = lista.slice(lista.indexOf(bit) + 1);
      var bast = null;
      langder.forEach(function (x) {
        if (x < bit - 1e-9) return;
        var fyllt = bit;
        kvar.forEach(function (k) { if (fyllt + SAGSNITT + k <= x + 1e-9) fyllt += SAGSNITT + k; });
        var andel = (x - fyllt) / x;
        if (!bast || andel < bast.andel - 1e-9) bast = { langd: x, andel: andel };
      });
      stanger.push({ langd: bast.langd, bitar: [bit], anvant: bit });
    });
    // Försök fylla upp: välj större stång om flera korta bitar då ryms i färre stänger
    // – enkel efterbehandling: krymp varje stång till minsta längd som rymmer innehållet.
    stanger.forEach(function (s) {
      var l = langder.filter(function (x) { return x >= s.anvant - 1e-9; })[0];
      if (l) s.langd = l;
      s.spill = avrunda(s.langd - s.anvant, 3);
    });
    var perLangd = {};
    stanger.forEach(function (s) { perLangd[s.langd] = (perLangd[s.langd] || 0) + 1; });
    var total = stanger.reduce(function (t, s) { return t + s.langd; }, 0);
    var netto = lista.reduce(function (t, b) { return t + b; }, 0) - for_langa.reduce(function (t, b) { return t + b; }, 0);
    return {
      stanger: stanger,
      perLangd: Object.keys(perLangd).map(Number).sort(function (a, b) { return a - b; }).map(function (l) { return { langd: l, antal: perLangd[l] }; }),
      antal: stanger.length,
      lopmeter: avrunda(total, 2),
      netto: avrunda(netto, 2),
      spill: avrunda(total - netto, 2),
      utnyttjande: total ? avrunda(netto / total * 100, 1) : 0,
      forLanga: for_langa
    };
  }

  /* --- Skivor -----------------------------------------------------------
     Skivorna läggs stående i kolumner längs väggen (bredd × längd).
     Varje kolumn behöver så många skivor som höjden kräver; bitar som
     blir över återanvänds inte (räknas som spill och syns). Öppningar
     som täcker en hel kolumn i full höjd drar av den kolumnen. */
  function skivor(ytor, format) {
    var b = format.bredd, l = format.langd;
    var antal = 0, netto = 0;
    ytor.forEach(function (y) {
      var kolumner = Math.ceil(avrunda(y.langd / b, 4));
      var perKolumn = Math.ceil(avrunda(y.hojd / l, 4));
      antal += kolumner * perKolumn * (y.sidor || 1);
      netto += (y.langd * y.hojd - (y.oppning || 0)) * (y.sidor || 1);
    });
    var area = antal * b * l;
    return { antal: antal, netto: avrunda(netto, 2), brutto: avrunda(area, 2), spill: area ? avrunda((1 - netto / area) * 100, 1) : 0 };
  }

  /* --- Geometri ur en byggdel ------------------------------------------ */
  function oppningsyta(del) {
    return (del.oppningar || []).reduce(function (t, o) { return t + o.bredd * o.hojd * (o.antal || 1); }, 0);
  }
  function oppningsantal(del) {
    return (del.oppningar || []).reduce(function (t, o) { return t + (o.antal || 1); }, 0);
  }

  // Takets mått ur typ, bredd, längd, lutning och utsprång.
  function takgeometri(t) {
    var u = t.utsprang == null ? 0.4 : t.utsprang;
    var L = t.langd + 2 * u;
    var lut = grader(t.lutning || 0);
    if (t.form === 'pulpet') {
      var lp = (t.bredd + 2 * u) / Math.cos(lut);
      return { area: L * lp, takfall: [{ langd: L, bredd: lp }], nock: 0, takfot: L, gavel: 2 * lp, sparrlangd: lp };
    }
    var halv = (t.bredd / 2 + u) / Math.cos(lut);
    return { area: 2 * L * halv, takfall: [{ langd: L, bredd: halv }, { langd: L, bredd: halv }], nock: L, takfot: 2 * L, gavel: 4 * halv, sparrlangd: halv };
  }

  /* --- Regler: hur en receptrad blir en mängd --------------------------
     Varje regel tar byggdelen och raden och returnerar
     { mangd, enhet, hur, bitar? } där hur är en läsbar förklaring. */
  var REGLER = {
    // Yta i m² (väggyta minus öppningar, golvyta, takyta) gånger faktor.
    yta: function (d, r) {
      var y = ytaFor(d);
      var f = r.faktor || 1;
      return { mangd: y.varde * f, enhet: 'm²', hur: y.text + (f !== 1 ? ' × ' + tal(f) : '') };
    },
    // Löpmeter ur yta och täckande bredd (panel, råspont, läkt c/c).
    lopmeterYta: function (d, r) {
      var y = ytaFor(d);
      return { mangd: y.varde / r.tackbredd, enhet: 'm', hur: y.text + ' ÷ ' + tal(r.tackbredd) + ' m täckbredd' };
    },
    // Stående reglar c/c: antal ur längden, plus extra vid öppningar.
    reglar: function (d, r) {
      var L = d.langd, h = (d.hojd || 0) - (r.avdrag || 0);
      var cc = r.cc || 0.6;
      var n = Math.ceil(avrunda(L / cc, 4)) + 1 + (r.extraPerOppning || 0) * oppningsantal(d);
      var bitar = []; for (var i = 0; i < n; i++) bitar.push(avrunda(h, 3));
      return { mangd: n, enhet: 'st', bitar: bitar, hur: tal(L) + ' m ÷ c/c ' + tal(cc) + ' + 1' + (r.extraPerOppning && oppningsantal(d) ? ' + ' + r.extraPerOppning + ' × ' + oppningsantal(d) + ' öppningar' : '') + ' = ' + n + ' st à ' + tal(h) + ' m' };
    },
    // Liggande virke längs byggdelen: syll, hammarband, nockbräda, hängränna.
    langs: function (d, r) {
      var L = langsFor(d, r.langs);
      var n = r.antal || 1;
      var bitar = []; for (var i = 0; i < n; i++) dela(L.varde, bitar);
      return { mangd: L.varde * n, enhet: 'm', bitar: bitar, hur: (n > 1 ? n + ' × ' : '') + L.text };
    },
    // Bjälkar/takstolar tvärs: antal ur längden c/c, längd = spännvidd.
    tvars: function (d, r) {
      var cc = r.cc || 0.6;
      var langd = d.langd, spann = r.spann === 'sparr' ? takgeometri(d).sparrlangd : d.bredd;
      var n = Math.ceil(avrunda(langd / cc, 4)) + 1;
      var per = r.spann === 'sparr' ? (d.form === 'pulpet' ? 1 : 2) : 1;
      var bitar = []; for (var i = 0; i < n * per; i++) bitar.push(avrunda(spann, 3));
      return { mangd: n * per, enhet: 'st', bitar: bitar, hur: tal(langd) + ' m ÷ c/c ' + tal(cc) + ' + 1 = ' + n + (per > 1 ? ' × ' + per : '') + ' st à ' + tal(spann) + ' m' };
    },
    // Färdiga takstolar: antal c/c, enhet st (levereras färdiga).
    takstolar: function (d, r) {
      var cc = r.cc || 1.2;
      var n = Math.ceil(avrunda(d.langd / cc, 4)) + 1;
      return { mangd: n, enhet: 'st', hur: tal(d.langd) + ' m ÷ c/c ' + tal(cc) + ' + 1' };
    },
    // Skivor i format bredd × längd.
    skivor: function (d, r) {
      var ytor = d.typ === 'vagg'
        ? [{ langd: d.langd, hojd: d.hojd, oppning: oppningsyta(d), sidor: r.sidor || 1 }]
        : (d.typ === 'tak' ? takgeometri(d).takfall.map(function (f) { return { langd: f.langd, hojd: f.bredd }; }) : [{ langd: d.langd, hojd: d.bredd }]);
      var s = skivor(ytor, r.format);
      return { mangd: s.antal, enhet: 'st', skiva: s, hur: tal(s.netto) + ' m² i ' + tal(r.format.bredd * 1000, 0) + ' × ' + tal(r.format.langd * 1000, 0) + ' mm (' + tal(s.spill, 1) + ' % bit-spill)' };
    },
    // Per styck: per öppning, per byggdel, per m².
    perOppning: function (d, r) {
      var o = (d.oppningar || []).filter(function (x) { return !r.bara || (x.typ || 'fonster') === r.bara; });
      var antal = o.reduce(function (t, x) { return t + (x.antal || 1); }, 0);
      var namn = r.bara === 'dorr' ? (antal === 1 ? 'dörr' : 'dörrar') : r.bara === 'fonster' ? 'fönster' : 'öppningar';
      return { mangd: antal * (r.faktor || 1), enhet: r.enhet || 'st', hur: antal + ' ' + namn + (r.faktor && r.faktor !== 1 ? ' × ' + tal(r.faktor) : '') };
    },
    perYta: function (d, r) {
      var y = ytaFor(d);
      return { mangd: y.varde / r.per, enhet: r.enhet || 'st', hur: y.text + ' ÷ ' + tal(r.per) + ' m² per ' + (r.enhet || 'st') };
    },
    // Plintar i rutnät med högst c/c i båda riktningar.
    plintar: function (d, r) {
      var nx = Math.ceil(avrunda(d.langd / r.cc, 4)) + 1, ny = Math.ceil(avrunda(d.bredd / r.cc, 4)) + 1;
      return { mangd: nx * ny * (r.faktor || 1), enhet: r.enhet || 'st', hur: nx + ' × ' + ny + ' plintar' + (r.faktor && r.faktor !== 1 ? ' × ' + tal(r.faktor) + ' ' + (r.enhet || '') : '') };
    },
    // Volym: yta × tjocklek, eller omkrets × tvärsnitt.
    volym: function (d, r) {
      if (r.kant) {
        var o = 2 * (d.langd + d.bredd);
        return { mangd: o * r.kant, enhet: 'm³', hur: tal(o) + ' m omkrets × ' + tal(r.kant) + ' m²' };
      }
      var y = ytaFor(d);
      return { mangd: y.varde * r.tjocklek, enhet: 'm³', hur: y.text + ' × ' + tal(r.tjocklek) + ' m' };
    },
    // Fast antal per byggdel (t.ex. en dörr, ett beslag).
    fast: function (d, r) {
      return { mangd: r.antal, enhet: r.enhet || 'st', hur: r.antal + ' per ' + (BYGGDEL_NAMN[d.typ] || 'byggdel').toLowerCase() };
    }
  };

  var BYGGDEL_NAMN = { vagg: 'Vägg', bjalklag: 'Bjälklag', tak: 'Tak', grund: 'Grund' };

  function ytaFor(d) {
    if (d.typ === 'vagg') {
      var brutto = d.langd * d.hojd, opp = oppningsyta(d);
      return { varde: brutto - opp, text: tal(d.langd) + ' × ' + tal(d.hojd) + (opp ? ' − ' + tal(opp) + ' öppn.' : '') + ' = ' + tal(brutto - opp) + ' m²' };
    }
    if (d.typ === 'tak') {
      var g = takgeometri(d);
      return { varde: g.area, text: 'takyta ' + tal(g.area) + ' m²' };
    }
    return { varde: d.langd * d.bredd, text: tal(d.langd) + ' × ' + tal(d.bredd) + ' = ' + tal(d.langd * d.bredd) + ' m²' };
  }

  function langsFor(d, vad) {
    if (d.typ === 'tak') {
      var g = takgeometri(d);
      var m = { nock: g.nock, takfot: g.takfot, gavel: g.gavel }[vad || 'takfot'];
      return { varde: m, text: (vad || 'takfot') + ' ' + tal(m) + ' m' };
    }
    if (d.typ === 'grund' || d.typ === 'bjalklag') {
      var o = 2 * (d.langd + d.bredd);
      return { varde: o, text: 'omkrets ' + tal(o) + ' m' };
    }
    return { varde: d.langd, text: tal(d.langd) + ' m vägg' };
  }

  // Delar en lång sträcka i bitar som ryms i längsta standardlängd (skarvas).
  function dela(L, bitar) {
    var max = STANDARDLANGDER[STANDARDLANGDER.length - 1];
    while (L > max + 1e-9) { bitar.push(max); L -= max; }
    if (L > 0.01) bitar.push(avrunda(L, 3));
  }

  function tal(v, d) {
    if (v == null || isNaN(v)) return '–';
    var s = avrunda(v, d == null ? 2 : d).toString().replace('.', ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /* --- Mängda ett projekt -----------------------------------------------
     projekt.delar: byggdelar med recept-id. recept: { id: { namn, rader } }.
     material: { id: { namn, enhet, spill, pris, kapas, artikel } }.
     Returnerar rader per material med källor, kapning och summa. */
  function mangda(delar, recept, material) {
    var rader = {};
    var varningar = [];
    delar.forEach(function (d) {
      var rc = recept[d.recept];
      if (!rc) { varningar.push({ niva: 'fel', del: d.id, text: (d.namn || d.id) + ' saknar recept – ingenting räknas för den.' }); return; }
      if (d.typ === 'vagg' && oppningsyta(d) > d.langd * d.hojd * 0.85) {
        varningar.push({ niva: 'varning', del: d.id, text: (d.namn || d.id) + ': öppningarna tar mer än 85 % av väggen – kontrollera måtten.' });
      }
      if (d.bekraftad === false) varningar.push({ niva: 'obekraftad', del: d.id, text: (d.namn || d.id) + ' är inte bekräftad.' });
      rc.rader.forEach(function (r) {
        var m = material[r.material];
        if (!m) { varningar.push({ niva: 'fel', del: d.id, text: 'Receptet ' + rc.namn + ' pekar på ett material som saknas: ' + r.material }); return; }
        var regel = REGLER[r.regel];
        if (!regel) return;
        var u = regel(d, r);
        var rad = rader[r.material] || (rader[r.material] = { material: r.material, namn: m.namn, enhet: u.enhet, netto: 0, bitar: [], kallor: [], skivspill: [] });
        if (m.kapas && u.bitar) {
          rad.enhet = 'm';
          rad.bitar = rad.bitar.concat(u.bitar);
          rad.netto += u.bitar.reduce(function (t, x) { return t + x; }, 0);
        } else {
          rad.netto += u.mangd;
        }
        if (u.skiva) rad.skivspill.push(u.skiva.spill);
        rad.kallor.push({ del: d.id, delnamn: d.namn || d.id, mangd: avrunda(u.mangd, 3), hur: u.hur, bekraftad: d.bekraftad !== false });
      });
    });

    var lista = Object.keys(rader).map(function (id) {
      var r = rader[id], m = material[id];
      var spill = m.spill || 0;
      var brutto, kap = null;
      if (m.kapas && r.bitar.length) {
        kap = kapa(r.bitar, m.langder);
        brutto = kap.lopmeter;
      } else if (r.enhet === 'st') {
        brutto = Math.ceil(avrunda(r.netto * (1 + spill / 100), 4));
      } else {
        brutto = r.netto * (1 + spill / 100);
      }
      // Förpackningar (rullar, askar, paket): avrunda uppåt till hel förpackning.
      var forp = null;
      if (m.forpackning) {
        forp = { antal: Math.ceil(avrunda(brutto / m.forpackning.innehall, 4)), namn: m.forpackning.namn, innehall: m.forpackning.innehall };
      }
      var prisMangd = forp ? forp.antal : brutto;
      return {
        material: id,
        namn: m.namn,
        grupp: m.grupp || 'Övrigt',
        artikel: m.artikel || '',
        enhet: r.enhet,
        netto: avrunda(r.netto, 2),
        spillProcent: kap ? avrunda(100 - kap.utnyttjande, 1) : spill,
        brutto: avrunda(brutto, 2),
        kapning: kap,
        forpackning: forp,
        apris: m.pris || 0,
        prisEnhet: forp ? forp.namn : r.enhet,
        summa: Math.round(prisMangd * (m.pris || 0)),
        kallor: r.kallor,
        obekraftad: r.kallor.some(function (k) { return !k.bekraftad; })
      };
    });

    // Ordning: gruppernas ordning, sedan namn. Positionsnummer delas ut i den ordningen.
    var GRUPPER = ['Grund', 'Stomme', 'Isolering', 'Skivor', 'Tak', 'Fasad', 'Fönster och dörrar', 'Fästdon', 'Övrigt'];
    lista.sort(function (a, b) {
      var ga = GRUPPER.indexOf(a.grupp), gb = GRUPPER.indexOf(b.grupp);
      return (ga - gb) || a.namn.localeCompare(b.namn, 'sv');
    });
    lista.forEach(function (r, i) { r.pos = i + 1; });

    // Kontroll: vanliga poster som brukar glömmas.
    var finns = function (grupp) { return lista.some(function (r) { return r.grupp === grupp; }); };
    if (delar.some(function (d) { return d.typ === 'vagg'; }) && !finns('Fästdon')) varningar.push({ niva: 'varning', text: 'Inga fästdon i listan – spik och skruv brukar glömmas.' });
    if (!delar.some(function (d) { return d.typ === 'tak'; })) varningar.push({ niva: 'info', text: 'Inget tak är med i mängden.' });
    if (!delar.some(function (d) { return d.typ === 'grund'; })) varningar.push({ niva: 'info', text: 'Ingen grund är med i mängden.' });
    lista.forEach(function (r) {
      if (r.kapning && r.kapning.forLanga.length) varningar.push({ niva: 'varning', text: r.namn + ': ' + r.kapning.forLanga.length + ' bitar är längre än 5,4 m och måste skarvas eller beställas som specialvara.' });
    });

    var summa = lista.reduce(function (t, r) { return t + r.summa; }, 0);
    return { rader: lista, varningar: varningar, summa: summa };
  }

  /* --- Byggdelar ur en husmodell ----------------------------------------
     Kända mått (yttermått, nockhöjd, taklutning) ger byggdelarna direkt.
     Det som ritningen inte anger (vägghöjd när den måste räknas fram,
     antal fönster) markeras som antagande och går att ändra. */
  function delarForHus(h) {
    var ant = [];
    var lut = h.lutning;
    if (lut == null) { lut = 27; ant.push('Taklutning 27° (antagen – ritningen anger takkupa, inte vinkel)'); }
    var vh = h.vagghojd;
    if (vh == null) {
      vh = h.tak === 'pulpet'
        ? h.nock - (h.bredd * Math.tan(grader(lut))) - 0.35
        : h.nock - (h.bredd / 2) * Math.tan(grader(lut)) - 0.35;
      vh = avrunda(Math.min(Math.max(vh, 2.2), 3.2), 2);
      ant.push('Vägghöjd ' + tal(vh) + ' m räknad ur nockhöjd ' + tal(h.nock) + ' m och taklutning, minus 0,35 m för takstol och bjälklag');
    }
    var fonster = h.fonster || [{ typ: 'fonster', bredd: 1.2, hojd: 1.2, antal: 3 }];
    if (!h.fonster) ant.push('3 fönster 12 × 12 (antagna – ange de riktiga)');
    var dorr = h.dorrar || [{ typ: 'dorr', bredd: 1.0, hojd: 2.1, antal: 1 }];
    if (!h.dorrar) ant.push('1 ytterdörr 10 × 21 (antagen)');
    var L = h.langd, B = h.bredd;
    var delar = [
      { id: 'v1', namn: 'Långvägg fram', typ: 'vagg', recept: 'yttervagg-170', langd: L, hojd: vh, oppningar: fonster.concat(dorr) },
      { id: 'v2', namn: 'Långvägg bak', typ: 'vagg', recept: 'yttervagg-170', langd: L, hojd: vh, oppningar: [] },
      { id: 'v3', namn: 'Gavel vänster', typ: 'vagg', recept: 'yttervagg-170', langd: B - 0.34, hojd: vh, oppningar: [] },
      { id: 'v4', namn: 'Gavel höger', typ: 'vagg', recept: 'yttervagg-170', langd: B - 0.34, hojd: vh, oppningar: [] },
      { id: 'b1', namn: 'Golvbjälklag', typ: 'bjalklag', recept: 'golv-195', langd: L, bredd: B },
      { id: 't1', namn: 'Tak', typ: 'tak', recept: h.tak === 'pulpet' ? 'tak-pulpet' : 'tak-sadel', form: h.tak === 'pulpet' ? 'pulpet' : 'sadel', langd: L, bredd: B, lutning: lut, utsprang: 0.4 },
      { id: 'g1', namn: 'Grund', typ: 'grund', recept: 'plintgrund', langd: L, bredd: B }
    ];
    if (h.innervaggar) delar.splice(4, 0, { id: 'v5', namn: 'Innervägg', typ: 'vagg', recept: 'innervagg-70', langd: h.innervaggar, hojd: vh, oppningar: [{ typ: 'dorr', bredd: 0.9, hojd: 2.1, antal: 1 }] });
    delar.forEach(function (d) { d.kalla = 'modell'; d.bekraftad = true; });
    return { delar: delar, antaganden: ant, vagghojd: vh, lutning: lut };
  }

  var Mangd = { kapa: kapa, skivor: skivor, mangda: mangda, delarForHus: delarForHus, takgeometri: takgeometri, tal: tal, avrunda: avrunda, STANDARDLANGDER: STANDARDLANGDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = Mangd; else rot.Mangd = Mangd;
})(typeof window !== 'undefined' ? window : this);
