/* ============================================================
   Legohus CRM – vyerna och åtgärderna (prototyp, 2026-10-01)
   Varje vy returnerar { titel, html, efter }. Knappar anropar
   IH.G[namn] via data-g, formulär IH.FORM[namn] via data-form.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i, $ = IH.$, $$ = IH.$$;
  var G = IH.G, FORM = IH.FORM = IH.FORM || {};

  /* ================================================================
     Hjälpare
     ================================================================ */
  function db() { return IH.db; }
  function oppnaAffarer() { return db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }); }
  function summa(lista) { return lista.reduce(function (s, a) { return s + (a.varde || 0); }, 0); }
  function viktat(lista) {
    return lista.reduce(function (s, a) { return s + (a.varde || 0) * sannolikhet(a) / 100; }, 0);
  }
  // Chansen att affären blir order: grundchansen för steget, justerad efter signalerna.
  // sannSkal ger samma räkning i ord – den visas när man håller över ringen på kortet.
  function sannRakna(a) {
    if (a.steg === 'vunnen') return { p: 100, skal: ['Order signerad'] };
    var s = IH.steg(a.steg), bas = s.sannolikhet, skal = ['Grundchans ' + bas + ' % för ' + s.namn.toLowerCase()];
    var dagar = IH.dagarSedan(a.andrad);
    var o = IH.offertFor(a.id);
    if (o && o.status === 'skickad' && a.steg === 'offert') { bas += 5; skal.push('+5 %: offerten är skickad'); }
    if (dagar > 14) { bas -= 10; skal.push('−10 %: ingen rörelse på ' + dagar + ' dagar'); }
    else if (dagar <= 3) { bas += 5; skal.push('+5 %: rörelse de senaste dagarna'); }
    return { p: Math.max(5, Math.min(95, bas)), skal: skal };
  }
  function sannolikhet(a) { return sannRakna(a).p; }
  function sannSkal(a) { return sannRakna(a).skal.join('\n'); }
  IH.sannolikhet = sannolikhet;
  function vunnetIAr() {
    var ar = new Date().getFullYear();
    return db().affarer.filter(function (a) { return a.steg === 'vunnen' && a.vunnen && new Date(a.vunnen).getFullYear() === ar; });
  }
  function fstatus(id) { return IH.FSTATUS.filter(function (s) { return s.id === id; })[0] || IH.FSTATUS[0]; }
  function statusChip(farg, text) { return '<span class="status" style="--s:' + farg + '">' + e(text) + '</span>'; }
  function avatar(namn, liten, farg) {
    return '<span class="avatar' + (liten ? ' avatar--liten' : '') + '"' + (farg ? ' style="--av:' + farg + '"' : '') + '>' + IH.initialer(namn) + '</span>';
  }
  function kundfarg(id) {
    var f = ['linear-gradient(135deg,#f0b56e,#8f5424)', 'linear-gradient(135deg,#b8cde0,#4f6f8f)', 'linear-gradient(135deg,#a9c8a4,#3f6b50)',
      'linear-gradient(135deg,#e8c98f,#a6763a)', 'linear-gradient(135deg,#d7c2e0,#7b5c8f)', 'linear-gradient(135deg,#9fc2c9,#3d6a73)'];
    var n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
    return f[n % f.length];
  }
  function kundAvatar(k, liten) { return avatar(k ? k.namn : '?', liten, kundfarg(k ? k.id : 0)); }
  function tumme(src) { return '<span class="tumme"><img src="' + src + '" alt="" loading="lazy" decoding="async"></span>'; }
  // Ett tomt läge säger vad som saknas och vad man kan göra åt det.
  // knapp: { text, g, id, attr, href, ikon }.
  function tomt(ikon, text, knapp) {
    var k = '';
    if (knapp) {
      var inre = i(knapp.ikon || 'plus') + e(knapp.text);
      k = knapp.href ? '<a class="knapp knapp--liten" href="' + knapp.href + '">' + inre + '</a>'
        : '<button class="knapp knapp--liten" type="button" data-g="' + knapp.g + '"' + (knapp.id ? ' data-id="' + knapp.id + '"' : '') + (knapp.attr ? ' ' + knapp.attr : '') + '>' + inre + '</button>';
    }
    return '<div class="tom">' + i(ikon) + '<p>' + text + '</p>' + k + '</div>';
  }
  function ring(p, farg, titel) {
    return '<span class="ring" style="--p:' + Math.round(p) + ';--f:' + (farg || 'var(--virke)') + '"' + (titel ? ' title="' + e(titel) + '"' : '') + '><b>' + Math.round(p) + '</b></span>';
  }
  function forsta(namn) { return String(namn || '').split(' ')[0]; }
  var DAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  var MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

  // Föreslagen modell ur formulärets svar.
  function foreslaModell(f, kund) {
    if (kund && kund.typ === 'foretag') return { m: IH.modell('element'), varfor: 'Företag som bygger i serie – väggar, block eller moduler efter deras ritning.' };
    if (f.hustyp === 'Fritidshus') {
      return f.anvandning === 'Bo året runt'
        ? { m: IH.modell('r4'), varfor: 'Fritidshus att bo i året runt – Kupa 50 har plats för både vardag och gäster.' }
        : { m: IH.modell('r3'), varfor: 'Fritidshus för helger och lov – Kupa 40 med takkupa och extra takhöjd.' };
    }
    if (f.anvandning === 'Bo året runt') return { m: IH.modell('r1'), varfor: 'Två rum, sovrum och allrum – går att bo i på riktigt, utan bygglov.' };
    if (f.anvandning === 'Uthyrning' || f.anvandning === 'Kontor') return { m: IH.modell('r2'), varfor: 'Ett rum på 30 m² med smal form – enkel att placera, bra för ' + f.anvandning.toLowerCase() + '.' };
    if (f.miljo === 'På fjället' || f.miljo === 'Vid havet') return { m: IH.modell('r5'), varfor: 'Stora glaspartier och mycket ljus – tar vara på utsikten.' };
    return { m: IH.modell('r1'), varfor: 'Två rum under sadeltak – det mest mångsidiga huset.' };
  }

  function aktIkon(typ) { return { samtal: 'samtal', mejl: 'post', mote: 'motesikon', notis: 'anteckning', system: 'blixt' }[typ] || 'anteckning'; }
  function tidslinje(lista, tomText) {
    if (!lista.length) return tomt('klocka', tomText || 'Ingen aktivitet än.');
    return '<ol class="logg" data-stagger>' + lista.slice().sort(function (a, b) { return b.tid < a.tid ? -1 : 1; }).map(function (h) {
      var av = IH.anvandare(h.av);
      return '<li class="logg__rad logg__rad--' + h.typ + '"><span class="logg__ikon">' + i(aktIkon(h.typ)) + '</span>' +
        '<div><p>' + e(h.text) + '</p><small>' + (av ? e(av.namn) + ' · ' : '') + IH.sedan(h.tid) + '</small></div></li>';
    }).join('') + '</ol>';
  }
  function anteckningsForm(kund, affar) {
    return '<form class="anteckna" data-form="anteckning">' +
      '<input type="hidden" name="kund" value="' + (kund || '') + '"><input type="hidden" name="affar" value="' + (affar || '') + '">' +
      '<div class="anteckna__typ" role="radiogroup" aria-label="Typ">' +
      [['notis', 'Anteckning', 'anteckning'], ['samtal', 'Samtal', 'samtal'], ['mejl', 'Mejl', 'post'], ['mote', 'Möte', 'motesikon']].map(function (t, n) {
        return '<label><input type="radio" name="typ" value="' + t[0] + '"' + (n ? '' : ' checked') + '><span>' + i(t[2]) + t[1] + '</span></label>';
      }).join('') + '</div>' +
      '<div class="anteckna__rad"><input name="text" placeholder="Vad hände? Skriv en rad…" required autocomplete="off">' +
      '<button class="knapp knapp--mork knapp--liten" type="submit">' + i('plus') + 'Lägg till</button></div></form>';
  }

  function kpi(ikon, etikett, varde, format, under, href, extra) {
    return '<a class="kpi" href="' + href + '" data-tilt><span class="kpi__etikett"><span class="kpi__ikon">' + i(ikon) + '</span>' + etikett + '</span>' +
      '<b class="kpi__tal tal" data-rakna="' + Math.round(varde) + '" data-format="' + format + '">' + (format === 'kort' ? IH.kort(varde) : Math.round(varde)) + '</b>' +
      '<small>' + under + '</small>' + (extra || '') + '</a>';
  }

  // Ljust band med nyckeltal: [ikon, etikett, värde, format, under, andel 0–1].
  function nyckelband(celler) {
    return '<section class="nyckel kort" data-in>' + celler.map(function (c) {
      var tal = c[3] === 'text' ? '<b class="nyckel__tal">' + e(c[2]) + '</b>'
        : c[3] === 'pct' ? '<b class="nyckel__tal tal"><span data-rakna="' + Math.round(c[2]) + '" data-format="tal">' + Math.round(c[2]) + '</span><em>%</em></b>'
        : '<b class="nyckel__tal tal" data-rakna="' + Math.round(c[2]) + '" data-format="' + c[3] + '">' + (c[3] === 'kort' ? IH.kort(c[2]) : Math.round(c[2])) + '</b>';
      var emoji = !/^[a-z]+$/.test(c[0]);
      return '<div class="nyckel__cell"><span class="nyckel__etikett"><span class="kort__ikon' + (emoji ? ' kort__ikon--emoji' : '') + '">' + (emoji ? c[0] : i(c[0])) + '</span>' + c[1] + '</span>' + tal +
        '<small>' + c[4] + '</small>' + (c[5] !== undefined ? '<i class="nyckel__stapel" style="--a:' + Math.max(0, Math.min(1, c[5])).toFixed(3) + '"></i>' : '') + '</div>';
    }).join('') + '</section>';
  }

  function datumrad() {
    var d = new Date();
    return DAGAR[d.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + d.getDate() + ' ' + MANADER[d.getMonth()] + ' · vecka ' + IH.vecka(d);
  }

  /* ================================================================
     Översikt
     ================================================================ */
  // Översiktens by: varje säljsteg är en tomt längs gatan och huset där
  // är så långt byggt som affärerna har kommit – utstakad tomt, grund,
  // stomme, takstolar, taket i kranen och till sist ett färdigt hus med
  // tänt ljus och vimpel. Bakre raden är de senare stegen (högre hus),
  // främre raden de tidiga, så lapparna inte skymmer varandra. Storleken
  // följer pengarna i steget. Lastbilen kör ut husdelar längs gatan.
  function stad(steg) {
    var max = Math.max.apply(null, steg.map(function (s) { return s.summa; }).concat([1]));
    var ordning = [3, 4, 5, 0, 1, 2];
    var torn = ordning.map(function (n) {
      var s = steg[n], h = Math.max(0.06, s.summa / max);
      return '<a class="stad__torn" href="#/salj" tabindex="-1" data-steg="' + n + '" style="--h:' + h.toFixed(3) + ';--s:' + (0.8 + 0.28 * h).toFixed(3) + ';--i:' + n + ';--f:' + s.farg + '">' +
        '<i class="hus3__tomt"></i>' + hus3() +
        (n === 0 && s.antal ? '<span class="dio__pin stad__pin"><b>' + s.antal + '</b></span>' : '') +
        (n === 5 ? '<i class="vimpel"><i></i><i></i><b></b></i><span class="bil">' + box3('bil-kaross', 20, 10, 5, 0, 0, 1.5) + box3('bil-kupe', 11, 9, 4, 4, 0.5, 6.5) +
          '<i class="bil-hjul" style="left:3px"></i><i class="bil-hjul" style="left:14px"></i></span>' : '') +
        '<span class="stad__lapp"><em class="stad__nr" aria-hidden="true">' + (n + 1) + '</em><b>' + IH.kort(s.summa) + '</b><small><i style="background:' + s.farg + '"></i>' + e(s.kort) + ' · ' + s.antal + ' st</small></span></a>';
    }).join('');
    var lyktor = [[18, 'bak'], [52, 'bak'], [86, 'bak'], [34, 'fram'], [70, 'fram']].map(function (l, n) {
      return '<i class="lykta lykta--' + l[1] + '" style="left:' + l[0] + '%;--n:' + n + '"><i></i><i></i><b></b></i>';
    }).join('');
    var granar = [[2, 4, 1.1], [14, 1, 0.8], [97, 3, 0.9], [99, 30, 1.15], [1, 46, 0.85], [3, 92, 1], [24, 99, 0.75], [62, 99, 0.9], [96, 96, 1.05], [99, 70, 0.8], [46, 1, 0.7]].map(function (t, n) {
      return '<i class="gran" style="left:' + t[0] + '%;top:' + t[1] + '%;--t:' + t[2] + ';--n:' + n + '"><i></i><i></i></i>';
    }).join('');
    var bjorkar = [[8, 24, 1], [92, 50, 0.9], [40, 99, 0.85], [74, 2, 0.95]].map(function (t, n) {
      return '<i class="bjork" style="left:' + t[0] + '%;top:' + t[1] + '%;--t:' + t[2] + ';--n:' + n + '"><i></i><i></i></i>';
    }).join('');
    var lastbil = '<span class="lastbil"><span class="lastbil__kropp"><i class="lb-ljus"></i>' +
      box3('lb-chassi', 46, 14, 3, 0, 0, 3) + box3('lb-flak', 32, 14, 2, 0, 0, 6) + box3('lb-last', 28, 12, 11, 2, 1, 8) +
      box3('lb-hytt', 12, 14, 13, 34, 0, 6) +
      '<i class="lb-hjul" style="left:4px"></i><i class="lb-hjul" style="left:18px"></i><i class="lb-hjul" style="left:36px"></i>' +
      '</span></span>';
    var kran = '<span class="kran"><i class="kran__mast"><i></i><i></i></i><i class="kran__arm"></i><i class="kran__mot"></i><i class="kran__vikt"></i></span>';
    return '<div class="stad" aria-hidden="true"><div class="stad__kamera"><div class="stad__plan' + (IH.vyByte ? '' : ' vaxt stilla') + '">' +
      '<i class="gata"><i class="gata__linje"></i><i class="gata__overgang"></i></i>' + lyktor + granar + bjorkar + torn + kran + lastbil +
      '</div></div></div>';
  }

  // Pipelinen under byn: samma steg som tomterna, hovring tänder tomten.
  function pipeRad(steg) {
    var max = Math.max.apply(null, steg.map(function (s) { return s.summa; }).concat([1]));
    var FAS = ['Utstakad tomt', 'Grunden gjuten', 'Stommen rest', 'Takstolar på', 'Taket i kranen', 'Nycklar klara'];
    return '<div class="pipe">' + steg.map(function (s, n) {
      return '<a class="pipe__rad" href="#/salj" data-steg="' + n + '" style="--f:' + s.farg + ';--a:' + (s.summa / max).toFixed(3) + ';--n:' + n + '">' +
        '<span class="pipe__nr">' + (n + 1) + '</span><span class="pipe__info"><span><b>' + e(n === 5 ? 'Vunnet' : s.kort) + '</b><b>' + IH.kort(s.summa) + '</b></span>' +
        '<span><small>' + FAS[n] + '</small><small>' + s.antal + ' st</small></span></span><i class="pipe__spar"></i></a>';
    }).join('') + '</div>';
  }

  // Vunnet per månad, sex månader bakåt: en stapel per månad, värdet
  // ovanför och den pågående månaden i full färg. Ett mått, en axel.
  // Affärerna per hus: vunnet mörkt och öppet ljust i samma stapel,
  // skalat mot huset med störst summa. Förlorade räknas inte.
  function perHus() {
    var per = {};
    db().affarer.forEach(function (a) {
      if (a.forlorad) return;
      var p = per[a.modell] || (per[a.modell] = { vunnet: 0, oppet: 0, antal: 0 });
      if (a.steg === 'vunnen') p.vunnet += a.varde; else p.oppet += a.varde;
      p.antal += 1;
    });
    var rader = IH.MODELLER.filter(function (m) { return per[m.id]; }).map(function (m) {
      var p = per[m.id];
      return { m: m, vunnet: p.vunnet, oppet: p.oppet, summa: p.vunnet + p.oppet, antal: p.antal };
    }).sort(function (a, b) { return b.summa - a.summa; }).slice(0, 5);
    if (!rader.length) return '';
    var max = rader[0].summa || 1;
    return '<div class="perhus"><p class="perhus__rubrik"><small>Per hus</small>' +
      '<span><i class="perhus__prick perhus__prick--vunnet"></i>Vunnet<i class="perhus__prick perhus__prick--oppet"></i>Öppet</span></p>' +
      rader.map(function (r, n) {
        return '<a class="perhus__rad" href="#/salj" style="--i:' + n + '">' + tumme(r.m.bild) +
          '<span class="perhus__namn"><b>' + e(r.m.namn) + '</b><small>' + r.antal + (r.antal === 1 ? ' affär' : ' affärer') + '</small></span>' +
          '<span class="perhus__stapel"><i class="perhus__del perhus__del--vunnet" style="width:' + (r.vunnet / max * 100).toFixed(1) + '%"></i>' +
          '<i class="perhus__del perhus__del--oppet" style="width:' + (r.oppet / max * 100).toFixed(1) + '%"></i></span>' +
          '<b class="perhus__summa">' + IH.kort(r.summa) + '</b></a>';
      }).join('') + '</div>';
  }

  var intaktPeriod = 6;
  // Läget i en mening: den här månaden mot samma dagar förra månaden, och vad som ligger nära att vinnas (viktat)
  function intaktInsikt(oppna) {
    var nu = new Date(), i0 = new Date(nu.getFullYear(), nu.getMonth(), 1), f0 = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
    var iMan = 0, fMan = 0, fSamma = 0;
    db().affarer.forEach(function (a) { if (a.steg !== 'vunnen' || !a.vunnen) return; var d = new Date(a.vunnen); if (d >= i0) iMan += a.varde || 0; else if (d >= f0) { fMan += a.varde || 0; if (d.getDate() <= nu.getDate()) fSamma += a.varde || 0; } });
    var nara = oppna.filter(function (a) { return a.steg === 'forhandling' || a.steg === 'offert'; }), naraV = nara.reduce(function (t, a) { return t + (a.varde || 0) * sannolikhet(a) / 100; }, 0);
    var mn = nu.toLocaleDateString('sv-SE', { month: 'long' }), fmn = f0.toLocaleDateString('sv-SE', { month: 'long' });
    var jmf = fSamma ? Math.round((iMan - fSamma) / fSamma * 100) : null;
    return '<div class="ik-insikt">' +
      '<span><small>' + mn.charAt(0).toUpperCase() + mn.slice(1) + ' hittills</small><b>' + IH.kort(iMan) + '</b>' + (jmf != null ? '<em data-upp="' + (jmf >= 0) + '" title="Mot samma dagar i ' + fmn + '">' + (jmf >= 0 ? '↑ ' : '↓ ') + Math.abs(jmf) + ' % mot samma dagar i ' + fmn + '</em>' : '<em>Hela ' + fmn + ': ' + IH.kort(fMan) + '</em>') + '</span>' +
      '<a href="#/salj"><small>Nära att vinnas</small><b>' + IH.kort(naraV) + '</b><em>' + nara.length + ' affärer i offert och förhandling, viktat</em></a></div>';
  }
  function intaktsgraf() {
    var nu = new Date();
    var mnamn = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    var man = [];
    for (var n = intaktPeriod - 1; n >= 0; n--) {
      var d = new Date(nu.getFullYear(), nu.getMonth() - n, 1);
      man.push({ ar: d.getFullYear(), m: d.getMonth(), summa: 0, antal: 0 });
    }
    db().affarer.forEach(function (a) {
      if (a.steg !== 'vunnen' || !a.vunnen) return;
      var d = new Date(a.vunnen);
      man.forEach(function (x) { if (x.ar === d.getFullYear() && x.m === d.getMonth()) { x.summa += a.varde; x.antal += 1; } });
    });
    var max = Math.max.apply(null, man.map(function (x) { return x.summa; }).concat([1]));
    var B = 520, H = 152, top = 24, bas = 124, fack = B / 6, bredd = 46;
    var hojd = function (v) { return v / max * (bas - top); };
    var staplar = man.map(function (x, n) {
      var mitt = fack * n + fack / 2, h = hojd(x.summa), y = bas - h, r = Math.min(6, h / 2);
      var nu2 = n === 5 ? ' graf__stapel--nu' : '';
      var form = h > 0
        ? '<path class="graf__stapel' + nu2 + '" data-n="' + n + '" style="--i:' + n + '" d="M' + (mitt - bredd / 2).toFixed(1) + ' ' + bas + 'V' + (y + r).toFixed(1) +
          'Q' + (mitt - bredd / 2).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (mitt - bredd / 2 + r).toFixed(1) + ' ' + y.toFixed(1) +
          'H' + (mitt + bredd / 2 - r).toFixed(1) + 'Q' + (mitt + bredd / 2).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (mitt + bredd / 2).toFixed(1) + ' ' + (y + r).toFixed(1) +
          'V' + bas + 'Z"/>' +
          '<text class="graf__varde" style="--i:' + n + '" x="' + mitt.toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle">' + IH.kort(x.summa) + '</text>'
        : '<text class="graf__noll" x="' + mitt.toFixed(1) + '" y="' + (bas - 8) + '" text-anchor="middle">–</text>';
      return form + '<text class="graf__man' + nu2 + '" x="' + mitt.toFixed(1) + '" y="' + (bas + 22) + '" text-anchor="middle">' + mnamn[x.m] + '</text>' +
        '<rect class="graf__traff" x="' + (fack * n).toFixed(1) + '" y="0" width="' + fack.toFixed(1) + '" height="' + H + '" data-x="' + mitt.toFixed(1) + '" data-y="' + (bas - hojd(x.summa)).toFixed(1) + '"' +
        ' data-n="' + n + '" data-man="' + mnamn[x.m] + ' ' + x.ar + '" data-summa="' + x.summa + '" data-antal="' + x.antal + '"/>';
    }).join('');
    return '<div class="graf__ram"><svg class="graf" viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Vunnet per månad, sex månader: ' +
      man.map(function (x) { return mnamn[x.m] + ' ' + IH.kort(x.summa); }).join(', ') + '">' +
      '<defs><linearGradient id="graf-stapel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c88f"/><stop offset="1" stop-color="#e3a35a"/></linearGradient></defs>' +
      [1 / 3, 2 / 3].map(function (t) { return '<path class="graf__rut" d="M0 ' + (top + t * (bas - top)).toFixed(1) + 'H' + B + '"/>'; }).join('') +
      '<path class="graf__bas" d="M0 ' + bas + 'H' + B + '"/>' + staplar +
      '</svg><div class="graf__tips" role="status" hidden></div></div>';
  }

  // Hovringsrutan: månadens summa och antal ordrar ovanför stapeln.
  function kopplaGraf(rot) {
    var ram = $('.graf__ram', rot);
    if (!ram) return;
    var svg = $('svg', ram), tips = $('.graf__tips', ram);
    var vb = svg.viewBox.baseVal;
    function visa(t) {
      if (t.classList.contains('aktiv')) return;
      $$('.graf__traff', ram).forEach(function (r) { r.classList.toggle('aktiv', r === t); });
      $$('.graf__stapel', ram).forEach(function (p) { p.classList.toggle('aktiv', p.getAttribute('data-n') === t.getAttribute('data-n')); });
      ram.classList.add('pekar');
      var antal = Number(t.getAttribute('data-antal'));
      tips.innerHTML = '<small>' + e(t.getAttribute('data-man')) + '</small><b>' + IH.kr(Number(t.getAttribute('data-summa'))) + '</b>' +
        '<span>' + (antal ? antal + (antal === 1 ? ' order' : ' ordrar') : 'Inga ordrar') + '</span>';
      tips.hidden = false;
      var sk = svg.clientWidth / vb.width;
      var x = Number(t.getAttribute('data-x')) * sk, y = Number(t.getAttribute('data-y')) * sk;
      tips.style.left = Math.max(0, Math.min(ram.clientWidth - tips.offsetWidth, x - tips.offsetWidth / 2)) + 'px';
      tips.style.top = Math.max(0, y - tips.offsetHeight - 26) + 'px';
    }
    svg.addEventListener('pointermove', function (ev) {
      var t = ev.target.closest('.graf__traff');
      if (t) visa(t);
    });
    svg.addEventListener('pointerleave', function () {
      tips.hidden = true;
      ram.classList.remove('pekar');
      $$('.graf__traff', ram).forEach(function (r) { r.classList.remove('aktiv'); });
    });
  }

  // Tid på dygnet styr ljuset i toppen: stjärnor på natten, gryning,
  // dagsljus och kvällsljus.
  function dygn() {
    var h = new Date().getHours();
    return h < 5 || h >= 22 ? 'natt' : h < 10 ? 'morgon' : h < 18 ? 'dag' : 'kvall';
  }

  // Solljuset över byn: strålar från solen, damm som glittrar i ljuset,
  // moln som driver och en flock fåglar som passerar ibland.
  function ljusfall() {
    var damm = '';
    // Dammet ligger i luften nära solen, ovanför byn.
    for (var k = 0; k < 12; k++) {
      damm += '<i style="left:' + (68 + k * 11 % 29) + '%;top:' + (2 + k * 7 % 17) + '%;--d:' + (7 + k % 5 * 1.6).toFixed(1) + 's;--f0:-' + (k * 1.3 % 8).toFixed(1) + 's;--z:' + (1.5 + k % 3) + 'px"></i>';
    }
    return '<span class="ljusfall" aria-hidden="true"><i class="ljusfall__stralar"></i><i class="ljusfall__dis"></i>' +
      '<span class="ljusfall__damm">' + damm + '</span>' +
      '<i class="moln moln--1"></i><i class="moln moln--2"></i></span>' +
      '<span class="faglar" aria-hidden="true"><i></i><i></i><i></i></span>';
  }

  // Byn skalas efter sin kolumn så att den aldrig sticker ut över
  // korten bredvid. Bredden räknas från planets egna mått (rotationen
  // -38° och lite marginal för kamerans lutning), inte från den animerade
  // bilden.
  function passaBy(rot) {
    var by = $('.hero__by', rot), plan = $('.stad__plan', rot);
    if (!by || !plan) return;
    var satt = function () {
      var b = plan.offsetWidth, h = plan.offsetHeight;
      var bredd = b * Math.cos(38 * Math.PI / 180) + h * Math.sin(38 * Math.PI / 180);
      var plats = by.clientWidth * 0.94;
      plan.style.setProperty('--skala', Math.max(0.55, Math.min(1.1, plats / bredd)).toFixed(3));
    };
    satt();
    if (window.ResizeObserver) new ResizeObserver(satt).observe(by);
  }

  // Tomten och raden i pipelinen lyser tillsammans när man pekar på en
  // av dem – en klass på två element i stället för :has() på hela toppen.
  function kopplaLys(rot) {
    var hero = $('.hero', rot);
    if (!hero) return;
    var aktiv = null;
    var satt = function (n) {
      if (n === aktiv) return;
      $$('.lyser', hero).forEach(function (x) { x.classList.remove('lyser'); });
      aktiv = n;
      if (n !== null) $$('[data-steg="' + n + '"]', hero).forEach(function (x) { x.classList.add('lyser'); });
    };
    hero.addEventListener('pointerover', function (ev) {
      var t = ev.target.closest('[data-steg]');
      satt(t ? t.getAttribute('data-steg') : null);
    });
    hero.addEventListener('pointerleave', function () { satt(null); });
  }

  // Lastbilen kör en tur, väntar en stund och kör igen. Mellan turerna
  // står byn helt still.
  function lastbilsTurer(rot) {
    var bil = $('.lastbil', rot);
    if (!bil || IH.lugn) return;
    var kor = function () {
      if (!document.contains(bil)) return;
      bil.classList.remove('kor');
      void bil.offsetWidth;
      bil.classList.add('kor');
    };
    bil.addEventListener('animationend', function (ev) {
      if (ev.target !== bil) return;
      bil.classList.remove('kor');
      setTimeout(kor, 7000);
    });
    setTimeout(kor, 4500);
  }

  // Animationerna i ett kort pausas när kortet inte syns.
  IH.pausaUtanfor = function (el) {
    if (!el || !window.IntersectionObserver) return;
    new IntersectionObserver(function (poster) {
      poster.forEach(function (p) { el.classList.toggle('pausad', !p.isIntersecting); });
    }, { rootMargin: '60px' }).observe(el);
  };

  // Byn följer muspekaren med en mjuk lutning, som en kamera.
  function kameraFoljer(rot) {
    var by = $('.hero__by', rot), kam = $('.stad__kamera', rot);
    if (!by || !kam || IH.lugn || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var mal = null, vantar = false;
    var rita = function () {
      vantar = false;
      kam.style.transform = mal ? 'rotateX(' + mal[1] + 'deg) rotateY(' + mal[0] + 'deg)' : '';
    };
    by.addEventListener('pointermove', function (ev) {
      var r = by.getBoundingClientRect();
      mal = [(((ev.clientX - r.left) / r.width - 0.5) * 7).toFixed(2), ((0.5 - (ev.clientY - r.top) / r.height) * 5).toFixed(2)];
      if (!vantar) { vantar = true; requestAnimationFrame(rita); }
    });
    by.addEventListener('pointerleave', function () {
      mal = null;
      if (!vantar) { vantar = true; requestAnimationFrame(rita); }
    });
  }

  // Nya förfrågningar per dag, sju dagar bakåt, som små staplar.
  function sjuDagar() {
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var antal = [0, 0, 0, 0, 0, 0, 0];
    db().forfragningar.forEach(function (f) {
      var t = new Date(f.skapad); t.setHours(0, 0, 0, 0);
      var n = Math.round((d0 - t) / 864e5);
      if (n >= 0 && n < 7) antal[6 - n] += 1;
    });
    var max = Math.max.apply(null, antal.concat([1]));
    return '<span class="kpi__dagar">' + antal.map(function (a, n) { return '<i style="--a:' + (a / max).toFixed(2) + ';--n:' + n + '"' + (n === 6 ? ' class="idag"' : '') + '></i>'; }).join('') + '</span>';
  }

  // Dagens läge i tre korta rader: vad som förfaller i dag, möten i dag och nästa montage
  function dagensLage(uppg, nastaMontage) {
    var i0 = new Date(); i0.setHours(0, 0, 0, 0); var i1 = new Date(i0.getTime() + 864e5);
    var moten = db().aktiviteter.filter(function (h) { var t = new Date(h.tid); return h.typ === 'mote' && t >= new Date() && t < i1; });
    var sena = uppg.filter(function (u) { return new Date(u.forfaller) < i0; }).length;
    var bit = function (ik, txt, href, varm) { return '<a class="hero__lage' + (varm ? ' varm' : '') + '" href="' + href + '">' + i(ik) + '<span>' + txt + '</span></a>'; };
    return '<div class="hero__lagen">' +
      bit('uppgift', uppg.length ? '<b>' + uppg.length + '</b> att göra i dag' + (sena ? ' · ' + sena + ' sena' : '') : 'Inget att göra i dag', '#/att-gora', sena > 0) +
      bit('kalender', moten.length ? '<b>' + moten.length + '</b> ' + (moten.length === 1 ? 'möte' : 'möten') + ' kvar i dag' : 'Inga fler möten i dag', IH.jag().chef ? '#/chef' : '#/att-gora') +
      (nastaMontage ? bit('produktion', 'Montage om <b>' + Math.max(0, Math.round((new Date(nastaMontage.montage) - new Date()) / 864e5)) + ' d</b>', '#/produktion') : '') + '</div>';
  }
  IH.vyer.oversikt = function () {
    var jag = IH.jag();
    var oppna = oppnaAffarer();
    var nya = db().forfragningar.filter(function (f) { return f.status === 'ny'; });
    var vunnet = vunnetIAr();
    var proj = db().projekt.filter(function (p) { return p.steg !== 'klart'; });
    var nastaMontage = proj.filter(function (p) { return p.montage && new Date(p.montage) > new Date(); })
      .sort(function (a, b) { return a.montage < b.montage ? -1 : 1; })[0];
    var steg = IH.SALJSTEG.map(function (s) {
      var l = s.id === 'vunnen'
        ? db().affarer.filter(function (a) { return a.steg === 'vunnen' && IH.dagarSedan(a.vunnen || a.andrad) <= 90; })
        : oppna.filter(function (a) { return a.steg === s.id; });
      return { namn: s.id === 'vunnen' ? 'Vunnet 90 d' : s.namn, kort: s.id === 'vunnen' ? 'Vunnet' : s.kort, farg: s.farg, summa: summa(l), antal: l.length };
    });
    var idag = new Date(); idag.setHours(23, 59, 59, 999);
    var uppg = db().uppgifter.filter(function (u) { return !u.klar && (!u.ansvarig || u.ansvarig === IH.jag().id) && new Date(u.forfaller) <= idag; });
    var senaste = db().forfragningar.slice().sort(function (a, b) { return b.skapad < a.skapad ? -1 : 1; }).slice(0, 10);
    var akt = db().aktiviteter.slice().sort(function (a, b) { return b.tid < a.tid ? -1 : 1; }).slice(0, 12);
    var fokus = smartaForslag();

    var text = (nya.length ? '<b>' + nya.length + ' ' + (nya.length === 1 ? 'ny förfrågan' : 'nya förfrågningar') + '</b> väntar på svar. ' : 'Inga obesvarade förfrågningar. ') +
      'Pipelinen är på <b>' + IH.kort(summa(oppna)) + '</b> och ' + proj.length + ' ' + (proj.length === 1 ? 'hus är' : 'hus är') + ' i produktion.';

    var html =
      '<section class="hero kort kort--mork hero--' + dygn() + '" data-in><span class="hero__fonster" data-dygn="' + dygn() + '">' + (IH.himlen ? IH.himlen(new Date().getHours()) : '') + '<i class="hero__moln"></i><i class="hero__moln hero__moln--2"></i></span>' + ljusfall() +
        '<div class="hero__ord">' +
          '<p class="hero__datum"><i></i>' + datumrad() + '</p>' +
          '<h1 class="hero__titel"><span class="rad-mask"><span style="--o:0">' + IH.hej() + ',</span></span><span class="rad-mask"><span style="--o:1"><em>' + e(forsta(jag.namn)) + '.</em></span></span></h1>' +
          '<p class="hero__text">' + text + '</p>' +
          dagensLage(uppg, nastaMontage) +
          '<div class="hero__snabb" role="group" aria-label="Snabbt">' + [['ny-forfragan', 'Förfrågan', 'inkorg'], ['ny-kund', 'Kund', 'kunder'], ['ny-affar', 'Affär', 'tavla'], ['ny-uppgift', 'Uppgift', 'uppgift'], ['starta-mote', 'Kundmöte', 'mote']].map(function (b, n) {
            return '<button type="button" data-g="' + b[0] + '" style="--n:' + n + '" title="Ny ' + b[1].toLowerCase() + '">' + i(b[2]) + '<span>' + b[1] + '</span></button>'; }).join('') + '</div>' +
          '<div class="hero__kpi">' +
            kpi('inkorg', 'Nya förfrågningar', nya.length, 'tal', nya.length ? 'senaste ' + IH.sedan(nya.sort(function (a, b) { return b.skapad < a.skapad ? -1 : 1; })[0].skapad) : 'allt besvarat', '#/forfragningar', sjuDagar()) +
            kpi('graf', 'Öppen pipeline', summa(oppna), 'kort', oppna.length + ' affärer · viktat ' + IH.kort(viktat(oppna)), '#/salj',
              '<span class="kpi__band">' + steg.slice(0, 5).map(function (s) { return '<i style="--f:' + s.farg + ';flex:' + Math.max(s.summa, 1) + '"></i>'; }).join('') + '</span>') +
            kpi('trofe', 'Vunnet i år', summa(vunnet), 'kort', vunnet.length + ' signerade ordrar', '#/salj',
              '<svg class="kpi__gnista" viewBox="0 0 100 30" aria-hidden="true"><path d="M2 26 C 20 24, 30 22, 42 18 S 62 16, 70 10 S 88 6, 98 3" pathLength="1"/></svg>') +
            kpi('produktion', 'I produktion', proj.length, 'tal', nastaMontage ? 'nästa montage v. ' + IH.vecka(new Date(nastaMontage.montage)) : 'inga planerade montage', '#/produktion',
              '<span class="kpi__band">' + IH.PROJSTEG.slice(0, 5).map(function (s) {
                var n = proj.filter(function (p) { return p.steg === s.id; }).length;
                return '<i style="--f:' + s.farg + ';flex:' + Math.max(n, 0.35) + '"></i>';
              }).join('') + '</span>') +
          '</div>' +
        '</div><div class="hero__by">' + stad(steg) + pipeRad(steg) + '</div>' +
      '</section>' +

      '<div class="oversikt"><div class="oversikt__kol">' +
        '<section class="kort" data-in>' +
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('inkorg') + '</span>Senaste förfrågningar</h2><a class="knapp knapp--liten" href="#/forfragningar">Alla' + i('pil') + '</a></header>' +
          '<div class="lista" data-stagger>' + senaste.map(function (f) {
            var s = fstatus(f.status);
            return '<a class="lista__rad" href="#/forfragningar/' + f.id + '">' + tumme(IH.MILJO[f.miljo] || '../images/hus-r2.webp') +
              '<span class="lista__text"><b>' + e(f.namn) + (f.status === 'ny' ? ' <i class="prick"></i>' : '') + '</b><small>' + e(f.hustyp) + ' · ' + e(f.anvandning) + ' · ' + e(f.ort) + '</small></span>' +
              '<span class="lista__meta">' + statusChip(s.farg, s.namn) + '<span class="tid">' + IH.sedan(f.skapad) + '</span></span></a>';
          }).join('') + '</div>' +
        '</section>' +
        '<section class="kort" data-in>' +
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('graf') + '</span>Intäkter</h2><span class="ik-verktyg"><span class="tv-seg" role="group" aria-label="Period">' + [[6, '6 mån'], [12, '12 mån']].map(function (x) { return '<button type="button" data-g="ik-period" data-f="' + x[0] + '" aria-pressed="' + (intaktPeriod === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span><button type="button" class="tv-ikon" data-g="ik-csv" title="Exportera vunna affärer som CSV">' + i('skrivut') + '</button></span></header>' +
          '<div class="kort__kropp"><div class="graf__tal"><div><small>Vunnet i år</small><b class="tal" data-rakna="' + Math.round(summa(vunnet)) + '" data-format="kr">' + IH.kr(summa(vunnet)) + '</b></div>' +
          '<div><small>Viktad pipeline</small><b class="tal" data-rakna="' + Math.round(viktat(oppna)) + '" data-format="kr">' + IH.kr(viktat(oppna)) + '</b></div>' +
          '<div><small>Snittorder</small><b class="tal" data-rakna="' + Math.round(vunnet.length ? summa(vunnet) / vunnet.length : 0) + '" data-format="kr">' + IH.kr(vunnet.length ? summa(vunnet) / vunnet.length : 0) + '</b></div></div>' + intaktInsikt(oppna) + intaktsgraf() + perHus() + '</div>' +
        '</section>' +
      '</div><div class="oversikt__kol">' +
        (fokus.length ? '<section class="kort" data-in>' +
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('blixt') + '</span>Fokus i dag</h2><span class="chip">' + fokus.length + '</span></header>' +
          '<div class="fokus" data-stagger>' + fokus.map(function (f) {
            return '<a class="fokus__rad" href="' + f[3] + '"><span class="fokus__ikon">' + i(f[0]) + '</span><span><b>' + e(f[1]) + '</b><small>' + e(f[2]) + '</small></span><em>' + f[4] + '</em></a>';
          }).join('') + '</div>' +
        '</section>' : '') +
        '<section class="kort" data-in>' +
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('uppgift') + '</span>Att göra i dag</h2><a class="knapp knapp--liten" href="#/att-gora">Alla' + i('pil') + '</a></header>' +
          '<div class="kort__kropp">' + (uppg.length ? '<ul class="uppglista" data-stagger>' + uppg.map(uppgiftRad).join('') + '</ul>' : tomt('bock', 'Allt klart för i dag.')) + '</div>' +
        '</section>' +
        '<section class="kort" data-in>' +
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Senaste aktivitet</h2></header>' +
          '<div class="kort__kropp">' + tidslinje(akt) + '</div>' +
        '</section>' +
      '</div></div>';
    return {
      titel: 'Översikt', html: html,
      efter: function (rot) {
        var plan = $('.stad__plan', rot);
        if (plan) requestAnimationFrame(function () { requestAnimationFrame(function () { plan.classList.add('vaxt'); }); });
        passaBy(rot);
        kameraFoljer(rot);
        kopplaLys(rot);
        lastbilsTurer(rot);
        IH.pausaUtanfor($('.hero', rot));
        kopplaGraf(rot);
        balanseraOversikt();
        setTimeout(balanseraOversikt, 700);
      }
    };
  };

  // Översiktens två spalter ska sluta i jämnhöjd oavsett hur mycket data
  // som finns. Högerspalten för långt: korta aktiviteten (minst tre), visa
  // fler förfrågningar till vänster (upp till tio), korta sedan Att göra och
  // Fokus (minst tre var, "Alla" leder vidare). Vänsterspalten för lång: visa
  // fler aktiviteter. Staplade spalter (smalt fönster): fem förfrågningar och
  // sex aktiviteter.
  function balanseraOversikt() {
    var kol = document.querySelectorAll('.oversikt__kol');
    if (kol.length !== 2) return;
    var V = kol[0], H = kol[1];
    var forf = V.querySelectorAll('.lista__rad'), akt = H.querySelectorAll('.logg__rad');
    var uppg = H.querySelectorAll('.uppglista > li'), fok = H.querySelectorAll('.fokus__rad');
    var visa = function (rader, n) { [].forEach.call(rader, function (r, k) { r.hidden = k >= n; }); return Math.min(n, rader.length); };
    var nf = visa(forf, 5), na = visa(akt, 99), nu = visa(uppg, 99), nk = visa(fok, 99);
    if (V.getBoundingClientRect().top !== H.getBoundingClientRect().top) { visa(akt, 6); return; }
    var botten = function (el) { return el.getBoundingClientRect().bottom; };
    var forLang = function () { return botten(H) > botten(V) + 2; };
    while (forLang()) {
      if (na > 3) akt[--na].hidden = true;
      else if (nf < forf.length) forf[nf++].hidden = false;
      else if (nu > 3) uppg[--nu].hidden = true;
      else if (nk > 3) fok[--nk].hidden = true;
      else break;
    }
    // Blev vänster längst: fyll på med aktiviteter så länge de ryms.
    while (na < akt.length) {
      akt[na].hidden = false;
      if (forLang()) { akt[na].hidden = true; break; }
      na++;
    }
  }
  var balansVantar;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(balansVantar);
    balansVantar = requestAnimationFrame(balanseraOversikt);
  });

  /* ================================================================
     Verktyg – Kolla marken
     Hemsidans eget verktyg (vad-far-jag-bygga.html#kolla-marken) visas
     inbäddat, så att 3D-marken, SGU-uppslagen och kartan är exakt samma
     som kunderna ser. Allt annat på sidan döljs, och ramen växer med
     innehållet så att det aldrig blir en rullning i rullningen.
     ================================================================ */
  var VERKTYG_CSS = [
    'html,body{background:transparent!important;overflow:hidden!important;}',
    'body>*:not(main),main>*:not(#kolla-marken){display:none!important;}',
    // Hemsidans läsförloppslinje (body::before) hör till hemsidans meny.
    'body::before,body::after{display:none!important;}',
    'main{padding:0!important;margin:0!important;}',
    '#kolla-marken{margin:0!important;padding:22px 4px 26px!important;background:transparent!important;}',
    '#kolla-marken .markkoll__inner{max-width:none!important;width:auto!important;padding:0 22px!important;}',
    // Hemsidans rubrik, kundtexter och kontaktlänkar – CRM:et har eget toppkort.
    '.markkoll__topp,.markkoll__not,.tomtrapport__prata{display:none!important;}',
    '#kolla-marken .markkoll__scen{margin-top:0!important;}',
    // Knapparna i CRM:ets varma stil i stället för hemsidans svarta.
    '.marksok__knapp{background:linear-gradient(160deg,#f6c88f,#e8a456 55%,#d38f45)!important;color:#1b1915!important;' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 14px 28px -14px rgba(201,128,52,.75)!important;font-weight:600!important;' +
      'transition:transform .16s cubic-bezier(.23,1,.32,1),box-shadow .2s ease!important;}',
    '.marksok__knapp:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 18px 32px -14px rgba(201,128,52,.85)!important;}',
    '.marksok__knapp:active{transform:scale(.97)!important;}',
    '.kollen__pdf{background:#fff!important;color:#8f5424!important;box-shadow:0 0 0 1px rgba(201,138,69,.35),0 10px 22px -14px rgba(143,84,36,.5)!important;}',
    // Etiketterna med CRM:ets korta streck framför.
    '.marksok__etikett,.markkoll__mer{padding-left:26px!important;background:linear-gradient(#c98a45,#c98a45) left center/16px 1.5px no-repeat!important;}',
    '.marksok__etikett,.markkoll__mer{color:#8f5424!important;}',
    ':focus-visible{outline:2px solid #b06a26!important;outline-offset:2px!important;}',
    '::selection{background:rgba(240,181,110,.35);}'
  ].join('');

  // Hemsidans tilltal till kunden byts mot säljarens. Texterna skrivs av
  // verktyget när man söker, så de byts även när de dyker upp senare.
  var VERKTYG_TEXT = [
    ['Din mark i genomskärning', 'Marken i genomskärning'],
    ['Visa oss vad kartan säger, så berättar vi vad det betyder för grunden.', 'Jordarten finns inte i tolkningen – titta i SGU:s kartvisare nedan.']
  ];

  function verktygText(rot) {
    var gang = rot.ownerDocument.createTreeWalker(rot, 4), nod;
    while ((nod = gang.nextNode())) {
      VERKTYG_TEXT.forEach(function (par) {
        if (nod.nodeValue.indexOf(par[0]) !== -1) nod.nodeValue = nod.nodeValue.split(par[0]).join(par[1]);
      });
    }
  }

  IH.vyer['kolla-marken'] = function () {
    var html = '<h1 class="dold">Kolla marken</h1>' +
      '<section class="instopp verktygtopp kort kort--mork" data-in>' +
        '<div class="instopp__ord"><p class="etikett etikett--ljus">Verktyg</p><h2>Vad finns under <span class="ihop">gräset? <span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-grodd"/></svg></span></span></h2>' +
          '<p>Sök på kundens tomt inför platsbesöket eller offerten. Jordart, vatten i marken och djup till berg hämtas från SGU.</p></div>' +
        '<div class="instopp__tal">' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-fjall"/></svg></span><small>Underlag</small><b>SGU</b><em>Öppna data</em></div>' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg></span><small>Sök på</small><b>Adress</b><em>eller din position</em></div>' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-varning"/></svg></span><small>Översiktligt</small><b>Ingen geoteknik</b><em>Bedöm på plats</em></div>' +
        '</div></section>' +
      '<section class="kort verktygram" data-in>' +
        '<p class="verktygram__laddar" aria-hidden="true"><i></i>Hämtar verktyget …</p>' +
        '<iframe class="verktygram__ram" src="../vad-far-jag-bygga.html?crm=1" title="Kolla marken"></iframe>' +
      '</section>';
    return {
      titel: 'Kolla marken', html: html,
      efter: function (rot) {
        var ram = $('.verktygram__ram', rot), kort = $('.verktygram', rot);
        if (!ram) return;
        ram.addEventListener('load', function () {
          var dok;
          try { dok = ram.contentDocument; } catch (err) { dok = null; }
          if (!dok || !dok.body) { kort.classList.add('verktygram--klar'); return; }
          dok.documentElement.removeAttribute('data-tema');
          var stil = dok.createElement('style');
          stil.textContent = VERKTYG_CSS;
          dok.head.appendChild(stil);
          var sek = dok.getElementById('kolla-marken') || dok.body;
          verktygText(sek);
          if (window.MutationObserver) new MutationObserver(function () { verktygText(sek); }).observe(sek, { childList: true, subtree: true, characterData: true });
          // Ramen följer innehållets höjd (sökningen fäller ut kartan och genomskärningen).
          var hojd = function () {
            var h = Math.ceil(sek.getBoundingClientRect().height);
            if (h && Math.abs(ram.offsetHeight - h) > 1) ram.style.height = h + 'px';
          };
          hojd();
          if (window.ResizeObserver) new ResizeObserver(hojd).observe(sek);
          setTimeout(hojd, 400);
          kort.classList.add('verktygram--klar');
        });
      }
    };
  };

  /* ================================================================
     Förfrågningar – inkorgen
     ================================================================ */
  var fFilter = 'alla';

  // Emoji för miljön, källan och statusen – samma i listan, toppen och läsrutan.
  var MILJO_EMOJI = { 'Vid havet': '<svg class="emo-ik" aria-hidden="true"><use href="#i-hav"/></svg>', 'I skogen': '<svg class="emo-ik" aria-hidden="true"><use href="#i-skog"/></svg>', 'På fjället': '<svg class="emo-ik" aria-hidden="true"><use href="#i-fjall"/></svg>', 'I trädgården': '<svg class="emo-ik" aria-hidden="true"><use href="#i-grodd"/></svg>' };
  var KALLA_EMOJI = { 'Webbformulär': '<svg class="emo-ik" aria-hidden="true"><use href="#i-webb"/></svg>', 'Verktyget': '<svg class="emo-ik" aria-hidden="true"><use href="#i-kompass"/></svg>', 'Mejl': '<svg class="emo-ik" aria-hidden="true"><use href="#i-mejl"/></svg>', 'Telefon': '<svg class="emo-ik" aria-hidden="true"><use href="#i-samtal"/></svg>' };
  var FSTATUS_EMOJI = { alla: '<svg class="emo-ik" aria-hidden="true"><use href="#i-inkorg"/></svg>', ny: '<svg class="emo-ik" aria-hidden="true"><use href="#i-gnista"/></svg>', kontaktad: '<svg class="emo-ik" aria-hidden="true"><use href="#i-samtal"/></svg>', kvalificerad: '<svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg>', ej: '<svg class="emo-ik" aria-hidden="true"><use href="#i-minus-cirkel"/></svg>' };
  function vantatText(h) { return h < 1 ? 'under 1 h' : h < 48 ? Math.floor(h) + ' h' : Math.floor(h / 24) + ' dagar'; }

  function fRad(f, vald) {
    var s = fstatus(f.status);
    var h = vantat(f), over = h > SVARSMAL;
    return '<a class="fl' + (f.status === 'ny' ? ' fl--ny' : '') + (vald ? ' vald' : '') + '" href="#/forfragningar/' + f.id + '" data-fid="' + f.id + '">' +
      '<span class="fl__bild"><img src="' + (IH.MILJO[f.miljo] || '../images/hus-r2.webp') + '" alt="" loading="lazy" decoding="async">' +
        (MILJO_EMOJI[f.miljo] ? '<i class="fl__miljo" title="' + e(f.miljo) + '" aria-hidden="true">' + MILJO_EMOJI[f.miljo] + '</i>' : '') +
        (f.status === 'ej' ? '' : poangRing(leadpoang(f))) + '</span>' +
      '<span class="fl__text"><b>' + e(f.namn) + '</b><small>' + e(f.hustyp) + ' · ' + e(f.ort) + '</small><em>' + e(f.beskrivning) + '</em></span>' +
      '<span class="fl__meta"><span class="tid">' + IH.sedan(f.skapad) + '</span>' + statusChip(s.farg, s.namn) +
        (f.status === 'ny' ? '<span class="fl__vantar' + (over ? ' fl__vantar--over' : '') + '" title="Väntat ' + vantatText(h) + ' · mål ' + SVARSMAL + ' h">' + (over ? '⏰ ' : '⏳ ') + vantatText(h) + '</span>' : '') +
      '</span></a>';
  }
  function vantat(f) { return Math.max(0, (Date.now() - new Date(f.skapad)) / 36e5); }

  // Obesvarade förfrågningar: hur länge de väntat mot målet för svar.
  var SVARSMAL = 24;
  function svarstid(f) {
    if (f.status !== 'ny') return '';
    var h = Math.max(0, (Date.now() - new Date(f.skapad)) / 36e5);
    var over = h > SVARSMAL;
    var text = h < 1 ? 'mindre än en timme' : h < 48 ? Math.floor(h) + ' h' : Math.floor(h / 24) + ' dagar';
    return '<div class="sla' + (over ? ' sla--over' : '') + '" style="--a:' + Math.min(1, h / SVARSMAL).toFixed(3) + '">' + i(over ? 'varning' : 'klocka') +
      '<span><b>' + (over ? 'Över svarstiden · väntat ' : 'Väntat ') + text + '</b><small>Mål: svar inom ' + SVARSMAL + ' h</small></span><i class="sla__spar"><i></i></i></div>';
  }

  // Förfrågans väg: inkommen → kontaktad → blev affär (eller ej aktuell).
  function forlopp(f) {
    var steg = [['inkorg', 'Inkom', IH.datum(f.skapad)], ['samtal', 'Kontaktad', ''], [f.status === 'ej' ? 'stang' : 'tavla', f.status === 'ej' ? 'Ej aktuell' : 'Blev affär', '']];
    var nu = { ny: 0, kontaktad: 1, kvalificerad: 2, ej: 2 }[f.status] || 0;
    return '<ol class="forlopp' + (f.status === 'ej' ? ' forlopp--ej' : '') + '" style="--nu:' + nu + '">' + steg.map(function (s, n) {
      return '<li class="' + (n < nu ? 'klar' : n === nu ? 'nu' : '') + '"><span>' + i(n < nu ? 'bock' : s[0]) + '</span><b>' + s[1] + '</b>' + (s[2] ? '<small>' + e(s[2]) + '</small>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  /* ----------------------------------------------------------------
     Smart läsning av förfrågan – allt räknas här i webbläsaren, inget
     skickas iväg. Ämnen hittas i texten, ger poäng, stycken i
     svarsutkastet och punkter i samtalsguiden. Påståendena i utkastet
     bygger på sajtens egna texter (reglerna, resan, prislistans poster).
     ---------------------------------------------------------------- */
  var AMNEN = [
    { id: 'storlek', re: /(\d+(?:\s*[–-]\s*\d+)?)\s*(?:m²|m2|kvm|kvadrat)/i, ikon: 'kub', poang: 10, skal: 'Vet ungefär hur stort',
      namn: function (m) { return m[1].replace(/\s*-\s*/, '–') + ' m²'; } },
    { id: 'serie', re: /tomter|i serie|moduler|husblock|område/i, ikon: 'kub', poang: 16, skal: 'Flera hus', namn: 'Flera hus',
      svar: 'Det låter som flera hus i serie – då vill jag gärna boka ett möte om upplägget.' },
    { id: 'aretrunt', re: /året runt|permanent|flytta ut/i, ikon: 'hus', poang: 8, skal: 'Ska bo i huset', namn: 'Året runt' },
    { id: 'tidplan', re: /leveranstid|hur snabbt|stå klart|hur lång tid|när kan/i, ikon: 'klocka', poang: 10, skal: 'Frågar om tidplan', namn: 'Tidplan',
      svar: 'Tidplanen beror på modell och hur det ser ut i tillverkningen. Det kan jag ge ett tydligare besked om när vi har pratat om projektet.' },
    { id: 'detaljplan', re: /(?:inom |utanför )?detaljplan/i, ikon: 'lista', poang: 8, skal: 'Känner till detaljplanen', namn: 'Detaljplan',
      svar: 'Om tomten ligger inom eller utanför detaljplan avgör hur stort du får bygga: 30 m² per byggnad inom detaljplan och 50 m² utanför.' },
    { id: 'ritning', re: /bygglov|ritning|anmälan/i, ikon: 'skriv', poang: 8, skal: 'Tänker på lov och ritningar', namn: 'Ritningar & lov',
      svar: 'Ritningar och bygglovsunderlag kan ingå som en post i offerten.' },
    { id: 'frakt', re: /frakt|leverera|transport/i, ikon: 'kub', poang: 6, skal: 'Frågar om frakt', namn: 'Frakt',
      svar: 'Frakten beror på avstånd och framkomlighet, så den räknar vi fram i offerten.' },
    { id: 'strand', re: /strandskydd|sjötomt|nära havet|mot vattnet|vid vattnet|strand/i, ikon: 'varning', poang: 4, skal: 'Nära vatten', namn: 'Strandskydd',
      svar: 'Ligger tomten nära vatten kan strandskydd gälla. Det är kommunen som kan svara på det, så hör gärna med dem tidigt.' },
    { id: 'mark', re: /sluttar|plint|berg|lutar|lutning/i, ikon: 'plats', poang: 4, skal: 'Har tänkt på marken', namn: 'Marken',
      svar: 'Du nämner marken – grundläggningen tittar vi på vid ett platsbesök.' },
    { id: 'kok', re: /kök|badrum|dusch|toalett/i, ikon: 'hus', poang: 6, skal: 'Vill ha kök eller bad', namn: 'Kök & bad',
      svar: 'Kök och badrum anmäls till kommunen även när själva huset inte kräver lov.' },
    { id: 'kamin', re: /braskamin|kamin|eldstad/i, ikon: 'blixt', poang: 4, skal: 'Vill ha eldstad', namn: 'Eldstad',
      svar: 'En eldstad behöver anmälas till kommunen.' },
    { id: 'bastu', re: /bastu/i, ikon: 'blixt', poang: 2, skal: 'Vill ha bastu', namn: 'Bastu' },
    { id: 'uthyrning', re: /hyra ut|uthyrning/i, ikon: 'kunder', poang: 4, skal: 'Ska hyra ut', namn: 'Uthyrning' }
  ];

  function amnen(f) {
    var text = String(f.beskrivning || '');
    var ut = [];
    AMNEN.forEach(function (a) {
      var m = text.match(a.re);
      if (m) ut.push({ a: a, m: m, namn: typeof a.namn === 'function' ? a.namn(m) : a.namn });
    });
    return ut;
  }

  // Markerar orden som gav träff, utan att släppa igenom någon html.
  function markera(text) {
    var traff = [];
    AMNEN.forEach(function (a) {
      var re = new RegExp(a.re.source, 'gi'), m;
      while ((m = re.exec(text))) { if (m[0].trim()) traff.push([m.index, m.index + m[0].length]); if (!m[0]) re.lastIndex++; }
    });
    // Hela ord markeras, och träffar som rör vid varandra slås ihop
    // ("bygglovsritningar" blir en markering, inte tre).
    var bokstav = /[0-9A-Za-zÅÄÖåäöÉé²–-]/;
    traff = traff.map(function (t) {
      var a = t[0], b = t[1];
      while (a > 0 && bokstav.test(text[a - 1])) a--;
      while (b < text.length && bokstav.test(text[b])) b++;
      return [a, b];
    }).sort(function (x, y) { return x[0] - y[0]; });
    var hop = [];
    traff.forEach(function (t) {
      var sista = hop[hop.length - 1];
      if (sista && t[0] <= sista[1]) sista[1] = Math.max(sista[1], t[1]); else hop.push(t.slice());
    });
    var ut = '', pos = 0;
    hop.forEach(function (t) {
      ut += e(text.slice(pos, t[0])) + '<mark>' + e(text.slice(t[0], t[1])) + '</mark>';
      pos = t[1];
    });
    return ut + e(text.slice(pos));
  }

  // Leadpoäng: en fingervisning av hur långt kunden har kommit i
  // tankarna, med skälen synliga. Inget facit.
  function leadpoang(f) {
    var skal = [];
    var add = function (n, t) { if (n) skal.push([n, t]); };
    add(/^(Attefallshus|Fritidshus)$/.test(f.hustyp) ? 12 : 0, 'Vet vilken hustyp');
    add({ 'Bo året runt': 10, 'Uthyrning': 6, 'Kontor': 6, 'Gästhus': 4 }[f.anvandning] || 0, 'Användning: ' + String(f.anvandning || '').toLowerCase());
    add({ 'Telefon': 10, 'Verktyget': 8, 'Mejl': 4, 'Webbformulär': 4 }[f.kalla] || 0, f.kalla === 'Verktyget' ? 'Har använt verktyget' : f.kalla === 'Telefon' ? 'Ringde själv' : 'Skrev till oss');
    var text = String(f.beskrivning || '');
    add(text.length > 80 ? 6 : 0, 'Utförlig beskrivning');
    add(Math.min(2, (text.match(/\?/g) || []).length) * 3, 'Ställer frågor');
    var amn = 0;
    amnen(f).forEach(function (x) { if (amn < 30) { var n = Math.min(x.a.poang, 30 - amn); amn += n; add(n, x.a.skal); } });
    var p = Math.max(5, Math.min(98, 30 + skal.reduce(function (s, x) { return s + x[0]; }, 0) - (text.length < 30 ? 6 : 0)));
    var niva = p >= 70 ? ['varm', 'Varm'] : p >= 50 ? ['ljum', 'Ljummen'] : ['kall', 'Sval'];
    return { p: p, niva: niva[0], namn: niva[1], skal: skal.sort(function (a, b) { return b[0] - a[0]; }) };
  }

  function poangRing(l, stor) {
    return '<span class="poang poang--' + l.niva + (stor ? ' poang--stor' : '') + '" style="--p:' + l.p + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/>' +
      '<circle class="poang__fyll" cx="20" cy="20" r="17" pathLength="100"/></svg><b>' + l.p + '</b></span>';
  }

  // Kort sammanfattning i en mening, byggd av svaren och ämnena.
  function kortSagt(f, amn) {
    var vet = /^(Attefallshus|Fritidshus)$/.test(f.hustyp);
    var typ = vet ? 'ett ' + f.hustyp.toLowerCase() : 'ett hus';
    var var_ = String(f.miljo || '').toLowerCase();
    var anv = { 'Bo året runt': 'att bo i året runt', 'Uthyrning': 'att hyra ut', 'Kontor': 'som kontor', 'Gästhus': 'som gästhus' }[f.anvandning] || '';
    var namn = amn.filter(function (x) { return x.a.id !== 'aretrunt' && x.a.id !== 'uthyrning'; }).map(function (x) { return x.namn.toLowerCase(); });
    return forsta(f.namn) + ' vill ha ' + typ + (var_ ? ' ' + var_ : '') + (anv ? ' ' + anv : '') + ' i ' + f.ort + '.' + (vet ? '' : ' Vet inte vilken hustyp än.') +
      (namn.length ? ' Nämner ' + (namn.length > 1 ? namn.slice(0, -1).join(', ') + ' och ' + namn[namn.length - 1] : namn[0]) + '.' : '');
  }

  // Samtalsguiden: frågorna inför första samtalet, efter sajtens regler
  // och resan. Det som redan står i texten markeras som nämnt.
  function guidePunkter(f, amn) {
    var har = {};
    amn.forEach(function (x) { har[x.a.id] = x; });
    var p = [
      ['detaljplan', 'Ligger tomten inom eller utanför detaljplan?', har.detaljplan ? 'Nämnt: "' + har.detaljplan.m[0].trim() + '"' : 'Avgör 30 eller 50 m² per byggnad'],
      ['byggnader', 'Finns det redan byggnader på tomten?', 'Sammanlagt 45 eller 65 m² på tomten'],
      ['grans', 'Blir det minst 4,5 m till tomtgränsen?', 'Annars behövs grannens medgivande'],
      ['framkomlighet', 'Kommer lastbil och kran fram till tomten?', 'Huset levereras på lastbil och lyfts på plats'],
      ['grund', 'Vem gör grund, el, vatten och avlopp?', 'Ska vara klart innan montaget']
    ];
    if (har.strand || f.miljo === 'Vid havet') p.push(['strand', 'Har ni kollat strandskyddet med kommunen?', har.strand ? 'Nämnt i texten' : 'Tomten ligger vid vatten']);
    if (har.kok || har.kamin) p.push(['anmalan', 'Kök, badrum eller eldstad ska anmälas', 'Även när huset inte kräver lov']);
    p.push(['tidplan', 'När vill ni att huset står klart?', har.tidplan ? 'Frågar själv om tidplanen' : 'Bra att veta för planeringen']);
    return p;
  }

  function svarsUtkast(f, ton) {
    var jag = IH.jag();
    var amn = amnen(f);
    var typ = /^(Attefallshus|Fritidshus)$/.test(f.hustyp) ? 'ett ' + f.hustyp.toLowerCase() : 'ett hus';
    var var_ = String(f.miljo || '').toLowerCase();
    var stycken = amn.filter(function (x) { return x.a.svar; }).map(function (x) { return x.a.svar; });
    var harPlan = amn.some(function (x) { return x.a.id === 'detaljplan'; });
    var fraga = harPlan ? 'Finns det redan några byggnader på tomten?' : 'Ligger tomten inom detaljplan, och finns det redan byggnader på den?';
    if (ton === 'kort') {
      return 'Hej ' + forsta(f.namn) + '!\n\nTack för din förfrågan om ' + typ + ' i ' + f.ort + '. ' + fraga + '\n\nNär passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nLegohus Stockholm';
    }
    return 'Hej ' + forsta(f.namn) + '!\n\nTack för din förfrågan om ' + typ + (var_ ? ' ' + var_ : '') + ' i ' + f.ort + '. Jag heter ' + forsta(jag.namn) + ' och hjälper dig vidare.\n\n' +
      (stycken.length ? stycken.join('\n\n') + '\n\n' : '') +
      'För att kunna säga vad som ryms och vad det kostar vill jag gärna veta lite mer om tomten. ' + fraga + '\n\n' +
      'När passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nLegohus Stockholm';
  }

  // Nästa bästa steg för förfrågan, med åtgärderna direkt i kortet.
  function ffNastaBasta(f, aff) {
    var h = vantat(f), kvar = SVARSMAL - h;
    var tel = '<a class="knapp knapp--virke" href="tel:' + e(f.telefon.replace(/\s/g, '')) + '">' + i('tel') + 'Ring ' + e(forsta(f.namn)) + '</a>';
    var utkast = '<button class="knapp knapp--glas" type="button" data-g="f-utkast" data-id="' + f.id + '">' + i('blixt') + 'Svarsutkast</button>';
    var titel, under, knappar, ton = '';
    if (aff) {
      titel = 'Affären är igång'; under = e(aff.titel) + ' · ' + e(IH.steg(aff.steg).namn);
      knappar = '<a class="knapp knapp--virke" href="#/salj/' + aff.id + '">' + i('tavla') + 'Öppna affären</a>';
    } else if (f.status === 'ej') {
      titel = 'Markerad som ej aktuell'; under = 'Öppna igen om kunden hör av sig.';
      knappar = '<button class="knapp knapp--glas" type="button" data-g="f-status" data-id="' + f.id + '" data-status="ny">' + i('aterstall') + 'Öppna igen</button>';
    } else if (f.status === 'ny') {
      ton = kvar < 0 ? ' nbs--brad' : kvar < 6 ? ' nbs--snart' : '';
      titel = kvar < 0 ? 'Över svarstiden – ring så snart du kan' : 'Ring ' + e(forsta(f.namn)) + ' i dag';
      under = kvar < 0 ? 'Har väntat ' + Math.floor(h) + ' h. Ett samtal nu gör mest.' : Math.max(1, Math.round(kvar)) + ' h kvar till svarsmålet på ' + SVARSMAL + ' h.';
      knappar = tel + utkast +
        '<button class="knapp knapp--glas" type="button" data-g="f-status" data-id="' + f.id + '" data-status="kontaktad">' + i('bock') + 'Kontaktad</button>' +
        '<button class="knapp knapp--glas" type="button" data-g="f-paminn" data-id="' + f.id + '">' + i('klocka') + 'Påminn om 2 h</button>';
    } else {
      titel = 'Boka platsbesök eller skapa affär'; under = 'Kontakten är tagen – nästa steg är att titta på tomten.';
      knappar = '<button class="knapp knapp--virke" type="button" data-g="f-skapa-affar" data-id="' + f.id + '">' + i('plus') + 'Skapa affär</button>' + tel +
        '<button class="knapp knapp--glas" type="button" data-g="f-status" data-id="' + f.id + '" data-status="ej">Ej aktuell</button>';
    }
    return '<section class="nbs' + ton + '"><div class="nbs__huvud"><span class="nbs__ikon">' + i('blixt') + '</span><div><small>Nästa bästa steg</small><b>' + titel + '</b><p>' + under + '</p></div></div>' +
      (f.status === 'ny' && !aff ? '<i class="nbs__spar" style="--a:' + Math.min(1, h / SVARSMAL).toFixed(3) + '"></i>' : '') +
      '<div class="nbs__knappar">' + knappar + (f.status === 'ny' ? '<button class="nbs__ej" type="button" data-g="f-status" data-id="' + f.id + '" data-status="ej">Ej aktuell</button>' : '') + '</div></section>';
  }

  function smartKort(f) {
    var amn = amnen(f), l = leadpoang(f);
    var punkter = guidePunkter(f, amn);
    var g = f.guide || {};
    var klara = punkter.filter(function (p) { return g[p[0]]; }).length;
    return '<section class="smart">' +
        '<div class="smart__poang">' + poangRing(l, true) + '<div><small>Leadpoäng</small><b>' + l.namn + '</b><p>' + e(kortSagt(f, amn)) + '</p></div></div>' +
        '<ul class="smart__skal">' + l.skal.slice(0, 5).map(function (s) { return '<li><b>+' + s[0] + '</b>' + e(s[1]) + '</li>'; }).join('') + '</ul>' +
        (amn.length ? '<div class="smart__amnen"><small>' + i('sok') + 'Hittat i texten</small>' + amn.map(function (x) { return '<span>' + i(x.a.ikon) + e(x.namn) + '</span>'; }).join('') + '</div>' : '') +
        '<p class="smart__not">Räknas fram av svaren och texten – en fingervisning, inget facit.</p>' +
      '</section>' +
      '<section class="guide" style="--a:' + (klara / punkter.length).toFixed(3) + '"><header><div><small>Samtalsguide</small><b>Frågorna inför första samtalet</b></div><span class="guide__tal"><b>' + klara + '</b>/' + punkter.length + '</span></header>' +
        '<i class="guide__spar"></i><ul>' + punkter.map(function (p) {
          return '<li><button type="button" class="' + (g[p[0]] ? 'klar' : '') + '" data-g="f-guide" data-id="' + f.id + '" data-p="' + p[0] + '" aria-pressed="' + !!g[p[0]] + '"><i>' + i('bock') + '</i><span><b>' + e(p[1]) + '</b><small>' + e(p[2]) + '</small></span></button></li>';
        }).join('') + '</ul></section>';
  }

  function fLas(f) {
    if (!f) return '<section class="inkorg__las kort">' + tomt('inkorg', 'Välj en förfrågan i listan.') + '</section>';
    var s = fstatus(f.status);
    var kund = f.kund ? IH.kund(f.kund) : null;
    var aff = f.affar ? IH.affar(f.affar) : null;
    var forslag = foreslaModell(f, kund);
    var logg = db().aktiviteter.filter(function (h) { return kund && h.kund === kund.id; });
    var tilldelad = f.tilldelad ? IH.anvandare(f.tilldelad) : null;
    return '<section class="inkorg__las kort" data-in>' +
      '<header class="fd__huvud">' + avatar(f.namn, false, kundfarg(f.kund || f.id)) +
        '<div><h2>' + e(f.namn) + '</h2><p>' + i('plats') + e(f.ort) + ' · ' + e(f.kalla) + ' · ' + IH.sedan(f.skapad) + '</p></div>' +
        '<div class="fd__lage">' + statusChip(s.farg, s.namn) +
          '<button class="knapp knapp--liten" type="button" data-g="f-tilldela" data-id="' + f.id + '">' +
          (tilldelad ? avatar(tilldelad.namn, true, tilldelad.farg) + e(forsta(tilldelad.namn)) : i('kunder') + 'Ta den') + '</button></div>' +
      '</header>' + forlopp(f) + ffNastaBasta(f, aff) +
      '<div class="fd__mitt"><div class="fd__bild" data-tilt><img src="' + (IH.MILJO[f.miljo] || '../images/hus-r2.webp') + '" alt="" decoding="async"><span class="fd__skylt"><small>Var ska huset stå?</small>' + e(f.miljo) + '</span></div>' +
      '<div class="fd__svar">' +
        '<div><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg></i><small>Vad funderar du på?</small><b>' + e(f.hustyp) + '</b></div>' +
        '<div><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-mal"/></svg></i><small>Användning</small><b>' + e(f.anvandning) + '</b></div>' +
        '<div><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg></i><small>Ort</small><b>' + e(f.ort) + '</b></div>' +
        '<div><i aria-hidden="true">' + (KALLA_EMOJI[f.kalla] || '<svg class="emo-ik" aria-hidden="true"><use href="#i-skicka"/></svg>') + '</i><small>Kom via</small><b>' + e(f.kalla) + '</b></div>' +
      '</div></div>' +
      '<blockquote class="fd__citat">' + markera(String(f.beskrivning || '')) + '</blockquote>' + smartKort(f) +
      '<div class="fd__kontakt">' +
        '<a class="fd__kanal" href="tel:' + e(f.telefon.replace(/\s/g, '')) + '"><span>' + i('tel') + '</span><div><small>Telefon</small><b>' + e(f.telefon) + '</b></div></a>' +
        '<a class="fd__kanal" href="mailto:' + e(f.epost) + '"><span>' + i('post') + '</span><div><small>E-post</small><b>' + e(f.epost) + '</b></div></a>' +
        '<button class="fd__kanal" type="button" data-g="f-utkast" data-id="' + f.id + '"><span>' + i('blixt') + '</span><div><small>Svar</small><b>Svarsutkast</b></div></button>' +
      '</div>' +
      '<div class="fd__forslag" data-tilt><img src="' + forslag.m.tumme + '" alt="" loading="lazy">' +
        '<div><small class="etikett">Förslag</small><b>' + e(forslag.m.kategori) + ' ' + e(forslag.m.namn) + (forslag.m.yta ? ' · ' + forslag.m.yta + ' m²' : '') + '</b><p>' + e(forslag.varfor) + '</p></div></div>' +
      '<div class="fd__logg"><h3>Historik</h3>' + (kund ? anteckningsForm(kund.id, aff ? aff.id : '') : '') +
        (kund ? tidslinje(logg, 'Ingen aktivitet än.') : '<p class="fd__logg-tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-klocka"/></svg></span><span><b>Ingen historik än</b>Den börjar när förfrågan har blivit en kund – markera den som kontaktad så skapas kundkortet.</span></p>') + '</div>' +
      '</section>';
  }

  // Samma fråga som formuläret på sajten: var ska huset stå? Varje svar
  // är en liten miljö i 3D med ett Legohus på tomten.
  var fMiljo = null;
  var MILJOER = [
    ['Vid havet', 'hav', '#9fc2c9'],
    ['I skogen', 'skog', '#a9c8a4'],
    ['På fjället', 'fjall', '#d9e3ea'],
    ['I trädgården', 'tradgard', '#c3d98a']
  ];
  function granar(lista) {
    return lista.map(function (t, n) {
      return '<i class="gran" style="left:' + t[0] + '%;top:' + t[1] + '%;--t:' + t[2] + ';--n:' + n + '"><i></i><i></i></i>';
    }).join('');
  }
  function stenar(lista) {
    return lista.map(function (t) {
      return '<i class="dio__sten" style="left:' + t[0] + '%;top:' + t[1] + '%;--t:' + t[2] + '"></i>';
    }).join('');
  }
  function miljoTillbehor(typ) {
    switch (typ) {
      case 'hav': return '<i class="dio__vag"></i><i class="dio__brygga"></i><i class="dio__glitter"></i>' + stenar([[64, 10, 0.8], [8, 78, 0.6]]);
      case 'skog': return '<i class="dio__stig"></i>' + stenar([[70, 70, 1], [12, 46, 0.7], [56, 8, 0.6]]) +
        granar([[6, 10, 1], [30, 4, 0.75], [72, 4, 1.15], [90, 28, 0.85], [88, 58, 1.05], [8, 62, 0.8], [18, 90, 0.7], [66, 92, 0.75], [94, 88, 0.95]]);
      case 'fjall': return '<i class="dio__spar"></i>' +
        '<i class="dio__topp" style="left:80%;top:22%;--t:1.3"><i></i><i></i></i>' +
        '<i class="dio__topp" style="left:56%;top:6%;--t:0.95"><i></i><i></i></i>' +
        '<i class="dio__topp" style="left:92%;top:52%;--t:0.7"><i></i><i></i></i>' +
        '<span class="dio__granar--sno">' + granar([[8, 84, 0.6], [20, 94, 0.5], [4, 60, 0.55]]) + '</span>';
      default: return '<i class="dio__staket dio__staket--bak"></i><i class="dio__staket dio__staket--sida"></i><i class="dio__rabatt"></i><i class="dio__rabatt dio__rabatt--sida"></i>' +
        '<i class="dio__buske" style="left:12%;top:16%;--t:1"><i></i><i></i></i><i class="dio__buske" style="left:86%;top:74%;--t:0.85"><i></i><i></i></i>' +
        '<i class="dio__appel" style="left:14%;top:62%;--t:0.85"><i></i><i></i></i><i class="dio__gang"></i>';
    }
  }

  // Snöflingor med egen fart, storlek och start – inget rutmönster.
  function snofall() {
    var ut = '';
    for (var k = 0; k < 22; k++) {
      ut += '<i style="left:' + (k * 37 % 100) + '%;--d:' + (5 + k * 7 % 6) + 's;--f0:-' + (k * 1.7 % 9).toFixed(1) + 's;--z:' + (1.2 + (k % 3) * 0.7).toFixed(1) + 'px;--x:' + (6 + k * 5 % 14) + 'px"></i>';
    }
    return '<span class="dio__sno">' + ut + '</span>';
  }

  var KORT_TYP = { 'Attefallshus': 'Attefallshus', 'Fritidshus': 'Fritidshus', 'Vet inte än': 'Vet inte än' };
  function dioKort(m, n, alla) {
    var l = alla.filter(function (f) { return f.miljo === m[0]; });
    var ny = l.filter(function (f) { return f.status === 'ny'; }).length;
    var aktiva = l.filter(function (f) { return f.status !== 'ej'; });
    var snitt = aktiva.length ? Math.round(aktiva.reduce(function (s, f) { return s + leadpoang(f).p; }, 0) / aktiva.length) : null;
    var typer = {};
    l.forEach(function (f) { typer[f.hustyp] = (typer[f.hustyp] || 0) + 1; });
    var vanligast = Object.keys(typer).sort(function (a, b) { return typer[b] - typer[a]; })[0];
    return '<button class="dio dio--' + m[1] + (ny ? ' dio--ny' : '') + (fMiljo === m[0] ? ' vald' : '') + '" type="button" data-g="f-miljo" data-m="' + e(m[0]) + '" style="--i:' + n + ';--f:' + m[2] + '" aria-pressed="' + (fMiljo === m[0]) + '">' +
      (ny ? '<span class="dio__ny"><i></i>' + ny + ' ny' + (ny > 1 ? 'a' : '') + '</span>' : '') +
      '<span class="dio__scen" aria-hidden="true">' + (m[1] === 'fjall' ? snofall() : '') +
        '<span class="dio__plan"><i class="dio__golvskugga"></i><span class="dio__inre">' +
          '<i class="dio__mark"></i><i class="dio__sida dio__sida--fram"></i><i class="dio__sida dio__sida--vanster"></i>' +
          miljoTillbehor(m[1]) + '<span class="dio__hus">' + hus3() + '</span>' +
          (ny ? '<span class="dio__pin"><b>' + ny + '</b></span>' : '') +
        '</span></span></span>' +
      '<span class="dio__text"><b>' + e(m[0]) + '</b><small>' + l.length + (l.length === 1 ? ' förfrågan' : ' förfrågningar') + '</small></span>' +
      '<span class="dio__fakta">' +
        '<span><small>Snittpoäng</small><b>' + (snitt === null ? '–' : snitt) + '</b><i style="--a:' + ((snitt || 0) / 100).toFixed(2) + '"></i></span>' +
        '<span><small>Vanligast</small><b>' + e(KORT_TYP[vanligast] || vanligast || '–') + '</b></span>' +
      '</span>' +
      '<span class="dio__folk">' + l.slice(0, 3).map(function (f) { return avatar(f.namn, true, kundfarg(f.kund || f.id)); }).join('') +
        (l.length > 3 ? '<em>+' + (l.length - 3) + '</em>' : '') + '</span>' +
    '</button>';
  }

  function inkorgPuls(alla, verktyg) {
    var nya = alla.filter(function (f) { return f.status === 'ny'; });
    var aldst = nya.reduce(function (m, f) { return Math.max(m, vantat(f)); }, 0);
    // Först i kön: den som väntat längst.
    var forst = nya.slice().sort(function (a, b) { return vantat(b) - vantat(a); })[0] || null;
    var besvarade = alla.filter(function (f) { return f.status !== 'ny'; });
    var affar = alla.filter(function (f) { return f.status === 'kvalificerad'; }).length;
    var konv = besvarade.length ? Math.round(affar / besvarade.length * 100) : 0;
    var dagar = [];
    for (var n = 6; n >= 0; n--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
      dagar.push({ d: d, antal: 0 });
    }
    alla.forEach(function (f) {
      var t = new Date(f.skapad); t.setHours(0, 0, 0, 0);
      dagar.forEach(function (x) { if (x.d.getTime() === t.getTime()) x.antal += 1; });
    });
    var maxDag = Math.max.apply(null, dagar.map(function (x) { return x.antal; }).concat([1]));
    var vecka = dagar.reduce(function (s, x) { return s + x.antal; }, 0);
    var kallor = {};
    alla.forEach(function (f) { kallor[f.kalla] = (kallor[f.kalla] || 0) + 1; });
    var kallLista = Object.keys(kallor).sort(function (a, b) { return kallor[b] - kallor[a]; });
    var KFARG = ['#f0b56e', '#c98a45', '#9fc2c9', '#a9c8a4', '#b8cde0'];
    var DAG = ['sö', 'må', 'ti', 'on', 'to', 'fr', 'lö'];
    var text = aldst < 1 ? 'mindre än en timme' : aldst < 48 ? Math.floor(aldst) + ' h' : Math.floor(aldst / 24) + ' dagar';
    var nu = new Date();
    return '<section class="ipuls kort kort--mork' + (IH.vyByte ? '' : ' vaxt stilla') + '" data-in>' +
      '<div class="ipuls__ord">' +
        '<div class="ipuls__topp"><p class="etikett etikett--ljus">Inkorgen just nu</p><span class="ipuls__live"><i></i>' + String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0') + '</span></div>' +
        '<p class="ipuls__stort"><b class="tal" data-rakna="' + nya.length + '">' + nya.length + '</b><span>' + (nya.length === 1 ? 'ny förfrågan' : 'nya förfrågningar') + '<small>' +
          (nya.length ? 'väntar på svar · äldsta ' + text : 'allt är besvarat') + '</small></span></p>' +
        (forst ? '<a class="ipuls__forst' + (vantat(forst) > SVARSMAL ? ' ipuls__forst--over' : '') + '" href="#/forfragningar/' + forst.id + '">' +
          avatar(forst.namn, false, kundfarg(forst.kund || forst.id)) +
          '<span><small>Börja med</small><b>' + e(forst.namn) + '</b><em>' + (MILJO_EMOJI[forst.miljo] || '<svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg>') + ' ' + e(forst.ort) + ' · väntat ' + vantatText(vantat(forst)) + '</em></span>' +
          '<i class="ipuls__pil">' + i('pil') + '</i></a>' : '') +
        '<div class="ipuls__vecka"><div class="ipuls__staplar">' + dagar.map(function (x, n) {
          return '<span class="' + (n === 6 ? 'idag' : '') + '" style="--a:' + (x.antal / maxDag).toFixed(3) + ';--n:' + n + '" data-tip="' + (n === 6 ? 'I dag' : DAG[x.d.getDay()] + ' ' + IH.datum(x.d.toISOString())) + ' · ' + (x.antal === 1 ? '1 förfrågan' : x.antal ? x.antal + ' förfrågningar' : 'inga förfrågningar') + '"><b>' + (x.antal || '') + '</b><i></i><small>' + DAG[x.d.getDay()] + '</small></span>';
        }).join('') + '</div><p><b class="tal" data-rakna="' + vecka + '">' + vecka + '</b> in de senaste 7 dagarna</p></div>' +
        '<div class="ipuls__tal">' +
          '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-eld"/></svg></i>Varma just nu</small><b class="tal">' + nya.filter(function (f) { return leadpoang(f).p >= 70; }).length + '<em> av ' + nya.length + '</em></b>' +
            '<span class="ipuls__prickar">' + nya.slice(0, 12).map(function (f) { var p = leadpoang(f).p; return '<i class="' + (p >= 70 ? 'varm' : p >= 50 ? 'ljum' : '') + '"></i>'; }).join('') + '</span></div>' +
          '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg></i>Blev affär</small><b class="tal">' + konv + '<em> %</em></b><span class="ipuls__mini" style="--a:' + (konv / 100).toFixed(2) + '"><i></i></span></div>' +
        '</div>' +
        '<div class="ipuls__kalla"><small>Kom via</small><span class="kallbar">' + kallLista.map(function (k, n) {
            return '<i style="flex:' + kallor[k] + ';--k:' + KFARG[n % KFARG.length] + ';--n:' + n + '"></i>';
          }).join('') + '</span><span class="kallbar__lista">' + kallLista.map(function (k, n) {
            return '<span style="--k:' + KFARG[n % KFARG.length] + '"><i></i>' + (KALLA_EMOJI[k] ? KALLA_EMOJI[k] + ' ' : '') + e(k) + '<b>' + kallor[k] + '</b></span>';
          }).join('') + '</span></div>' +
      '</div>' +
      '<div class="ipuls__miljo">' + (verktyg || '') + '<div class="ipuls__miljohuvud"><p class="etikett etikett--ljus">Var ska huset stå?</p><small>Samma fråga som i formuläret · klicka för att filtrera</small></div>' +
        '<div class="dioramor">' + MILJOER.map(function (m, n) { return dioKort(m, n, alla); }).join('') + '</div></div>' +
    '</section>';
  }

  function grupperaDag(lista, vald) {
    var idag = new Date(); idag.setHours(0, 0, 0, 0);
    var grupp = function (f) {
      var d = (idag - new Date(new Date(f.skapad).setHours(0, 0, 0, 0))) / 864e5;
      return d <= 0 ? 'I dag' : d === 1 ? 'I går' : d < 7 ? 'Den här veckan' : 'Tidigare';
    };
    var forra = null;
    return lista.map(function (f) {
      var g = grupp(f), rubrik = g !== forra ? '<p class="inkorg__dag">' + g + '</p>' : '';
      forra = g;
      return rubrik + fRad(f, vald && f.id === vald.id);
    }).join('');
  }

  // J/K bläddrar i inkorgen, U öppnar svarsutkastet.
  document.addEventListener('keydown', function (ev) {
    if (!/^#\/forfragningar/.test(location.hash) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('.ark, .mote')) return;
    var k = ev.key.toLowerCase();
    if (k !== 'j' && k !== 'k' && k !== 'u') return;
    var rader = $$('.inkorg__lista .fl');
    var nu = rader.findIndex(function (r) { return r.classList.contains('vald'); });
    if (k === 'u') { if (rader[nu]) G['f-utkast'](rader[nu]); return; }
    var nasta = rader[Math.max(0, Math.min(rader.length - 1, nu + (k === 'j' ? 1 : -1)))];
    if (nasta) { ev.preventDefault(); location.hash = nasta.getAttribute('href'); }
  });

  IH.vyer.forfragningar = function (del) {
    var alla = db().forfragningar.slice().sort(function (a, b) { return b.skapad < a.skapad ? -1 : 1; });
    var antal = {};
    IH.FSTATUS.forEach(function (s) { antal[s.id] = alla.filter(function (f) { return f.status === s.id; }).length; });
    var lista = (fFilter === 'alla' ? alla : alla.filter(function (f) { return f.status === fFilter; }))
      .filter(function (f) { return !fMiljo || f.miljo === fMiljo; });
    var vald = del[0] ? IH.forfragan(del[0]) : lista[0];
    if (vald && vald.status === 'ny' && del[0] && !vald.last) { vald.last = true; IH.spara(); }
    var flikar = [['alla', 'Alla', alla.length]].concat(IH.FSTATUS.map(function (s) { return [s.id, s.namn, antal[s.id]]; }));
    var html = '<h1 class="dold">Förfrågningar</h1>' +
      inkorgPuls(alla, '<div class="toppverktyg"><button class="knapp knapp--glas" type="button" data-g="simulera">' + i('blixt') + 'Simulera ny förfrågan</button>' +
        '<button class="knapp knapp--mork" type="button" data-g="ny-forfragan">' + i('plus') + 'Lägg in förfrågan</button></div>') +
      '<div class="inkorg__filter"><div class="flikar" data-flikar>' + flikar.map(function (f) {
        return '<button type="button" data-g="f-filter" data-f="' + f[0] + '" aria-pressed="' + (fFilter === f[0]) + '"><i class="flik__emoji" aria-hidden="true">' + (FSTATUS_EMOJI[f[0]] || '') + '</i>' + f[1] + ' <b>' + f[2] + '</b></button>';
      }).join('') + '</div>' +
      (fMiljo ? '<button class="chip chip--rensa" type="button" data-g="f-miljo" data-m="' + e(fMiljo) + '">' + e(fMiljo) + i('stang') + '</button>' : '') + '</div>' +
      '<div class="inkorg">' +
        '<div class="inkorg__lista kort" data-in>' + (lista.length ? grupperaDag(lista, vald) : tomt('inkorg', 'Inga förfrågningar här just nu. Ringer någon in, lägg in den här så hamnar den i flödet.', { text: 'Lägg in förfrågan', g: 'ny-forfragan' })) +
          '<p class="inkorg__tips"><kbd>J</kbd><kbd>K</kbd> bläddra · <kbd>U</kbd> svarsutkast</p></div>' +
        fLas(vald) +
      '</div>';
    return {
      titel: 'Förfrågningar', html: html,
      efter: function (rot) {
        glidFlikar($('[data-flikar]', rot));
        IH.uppdateraMeny();
        var p = $('.ipuls', rot);
        if (p) requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add('vaxt'); }); });
        IH.pausaUtanfor(p);
      }
    };
  };

  G['f-guide'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    if (!f) return;
    var p = el.getAttribute('data-p');
    f.guide = f.guide || {};
    f.guide[p] = !f.guide[p];
    IH.spara();
    el.classList.toggle('klar', f.guide[p]);
    el.setAttribute('aria-pressed', String(f.guide[p]));
    var g = el.closest('.guide');
    var alla = $$('[data-g="f-guide"]', g), klara = alla.filter(function (b) { return b.classList.contains('klar'); }).length;
    g.style.setProperty('--a', (klara / alla.length).toFixed(3));
    $('.guide__tal b', g).textContent = klara;
    if (klara === alla.length) { var r = el.getBoundingClientRect(); IH.konfetti(r.left + r.width / 2, r.top); }
  };
  G['f-paminn'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    if (!f) return;
    db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: 'Ring ' + f.namn + ' om förfrågan', forfaller: new Date(Date.now() + 2 * 36e5).toISOString(),
      klar: false, kund: f.kund || null, affar: null, ansvarig: IH.jag().id });
    IH.spara();
    IH.uppdateraMeny();
    IH.toast('Påminnelse om 2 timmar', 'Ring ' + f.namn + ' · ligger under Att göra', 'klocka');
    el.disabled = true;
    el.innerHTML = i('bock') + 'Påminnelse satt';
  };
  var utkastTon = 'personligt';
  G['f-utkast'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id') || el.getAttribute('data-fid'));
    if (!f) return;
    var amn = amnen(f);
    IH.oppnaArk({
      titel: 'Svarsutkast till ' + forsta(f.namn), ikon: 'blixt',
      under: amn.length ? 'Anpassat efter texten: ' + e(amn.map(function (x) { return x.namn.toLowerCase(); }).join(', ')) + '.' : 'Läs igenom och ändra innan du skickar.',
      kropp: '<div class="flikar utkast__ton" data-flikar>' + [['personligt', 'Personligt'], ['kort', 'Kort']].map(function (t) {
          return '<button type="button" data-g="utkast-ton" data-id="' + f.id + '" data-ton="' + t[0] + '" aria-pressed="' + (utkastTon === t[0]) + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<textarea class="utkast" data-utkast rows="16">' + e(svarsUtkast(f, utkastTon)) + '</textarea>' +
        '<p class="utkast__not">' + i('varning') + 'Utkastet bygger bara på det kunden skrivit och sajtens regler – inga priser eller löften. Läs igenom innan du skickar.</p>',
      fot: '<button class="knapp" type="button" data-g="utkast-kopiera">' + i('kopiera') + 'Kopiera</button>' +
        '<button class="knapp knapp--mork" type="button" data-g="utkast-mejl" data-id="' + f.id + '">' + i('post') + 'Öppna i mejlen</button>',
      efter: function (ark) { glidFlikar($('[data-flikar]', ark)); }
    });
  };
  G['utkast-ton'] = function (el) {
    utkastTon = el.getAttribute('data-ton');
    var f = IH.forfragan(el.getAttribute('data-id'));
    $$('[data-g="utkast-ton"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
    glidFlikar(el.parentNode);
    var t = $('[data-utkast]');
    if (t && f) { t.value = svarsUtkast(f, utkastTon); t.classList.remove('utkast--ny'); void t.offsetWidth; t.classList.add('utkast--ny'); }
  };
  G['utkast-kopiera'] = function () {
    var t = $('[data-utkast]');
    if (!t) return;
    var klar = function () { IH.toast('Utkastet är kopierat', 'Klistra in i ditt mejl.', 'kopiera'); };
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(klar, klar); else { t.select(); klar(); }
  };
  G['utkast-mejl'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    var t = $('[data-utkast]');
    if (!f || !t) return;
    window.location.href = 'mailto:' + encodeURIComponent(f.epost) + '?subject=' + encodeURIComponent('Din förfrågan till Legohus Stockholm') + '&body=' + encodeURIComponent(t.value);
  };

  G['f-filter'] = function (el) { fFilter = el.getAttribute('data-f'); IH.ga('#/forfragningar'); };
  G['f-miljo'] = function (el) {
    var m = el.getAttribute('data-m');
    fMiljo = fMiljo === m ? null : m;
    IH.ga('#/forfragningar');
  };
  G['f-status'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    var st = el.getAttribute('data-status');
    if (!f) return;
    if (st === 'kontaktad' && !f.kund) f.kund = kundFranForfragan(f).id;
    f.status = st;
    f.last = true;
    if (!f.tilldelad) f.tilldelad = IH.jag().id;
    if (f.kund) IH.logga(st === 'kontaktad' ? 'samtal' : 'system', st === 'kontaktad' ? 'Tog kontakt efter förfrågan.' : st === 'ej' ? 'Förfrågan markerad som ej aktuell.' : 'Förfrågan öppnad igen.', f.kund, null);
    IH.spara();
    IH.toast(st === 'kontaktad' ? 'Markerad som kontaktad' : st === 'ej' ? 'Markerad som ej aktuell' : 'Öppnad igen', f.namn, st === 'ej' ? 'stang' : 'bock');
    IH.ritaOm();
  };
  G['f-tilldela'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    if (!f) return;
    f.tilldelad = f.tilldelad === IH.jag().id ? null : IH.jag().id;
    IH.spara();
    IH.rita();
  };
  G.svarsmall = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    if (!f) return;
    var jag = IH.jag();
    var text = 'Hej ' + forsta(f.namn) + '!\n\nTack för din förfrågan om ' + f.hustyp.toLowerCase().replace('vet inte än', 'ett hus') +
      ' i ' + f.ort + '. Jag heter ' + jag.namn + ' och hjälper dig vidare.\n\nFör att kunna säga vad som ryms och vad det kostar vill jag gärna veta lite mer om tomten: ' +
      'ligger den inom detaljplan, och finns det redan byggnader på den?\n\nNär passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nLegohus Stockholm';
    var klar = function () { IH.toast('Svarsmallen är kopierad', 'Klistra in i ditt mejl.', 'kopiera'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(klar, klar); else klar();
  };

  function kundFranForfragan(f) {
    var k = db().kunder.filter(function (x) { return x.epost === f.epost || x.telefon === f.telefon; })[0];
    if (k) return k;
    k = { id: IH.nyttId('kund', 'k'), namn: f.namn, ort: f.ort, typ: / AB$|förening/i.test(f.namn) ? 'foretag' : 'privat',
      telefon: f.telefon, epost: f.epost, skapad: new Date().toISOString() };
    db().kunder.push(k);
    return k;
  }

  G['f-skapa-affar'] = function (el) {
    var f = IH.forfragan(el.getAttribute('data-id'));
    if (!f) return;
    var forslag = foreslaModell(f, f.kund ? IH.kund(f.kund) : null);
    affarsForm({ forfragan: f.id, titel: forslag.m.namn + ' – ' + f.anvandning.toLowerCase() + ' i ' + f.ort, modell: forslag.m.id, steg: 'kontakt' });
  };

  var SIM = [
    ['Tove Bergström', 'Lidingö', 'Vid havet', 'Attefallshus', 'Gästhus', 'Gästhus på sjötomten, gärna med stora fönster mot vattnet.'],
    ['Mikael Öberg', 'Mora', 'I skogen', 'Fritidshus', 'Bo året runt', 'Vi vill flytta ut på landet och bo i ett mindre hus året runt.'],
    ['Linnea Ahl', 'Gävle', 'I trädgården', 'Attefallshus', 'Uthyrning', 'Attefallshus att hyra ut. Hur lång är leveranstiden?'],
    ['Oskar Wikström', 'Härjedalen', 'På fjället', 'Fritidshus', 'Gästhus', 'Fjällstuga nära backarna, med bastu om möjligt.'],
    ['Sofia Hedlund', 'Kalmar', 'I trädgården', 'Vet inte än', 'Kontor', 'Behöver ett kontor hemma. Vad ryms på vår tomt?']
  ];
  G.simulera = function () {
    var s = SIM[(db().lopnr.forfragan || 0) % SIM.length];
    var n = 60 + (db().lopnr.forfragan || 0) % 39;
    var f = { id: IH.nyttId('forfragan', 'f'), skapad: new Date().toISOString(), status: 'ny', kalla: 'Webbformulär',
      miljo: s[2], hustyp: s[3], anvandning: s[4], beskrivning: s[5], namn: s[0], ort: s[1],
      telefon: '070-174 06 ' + n, epost: s[0].toLowerCase().replace(/ö/g, 'o').replace(/[åä]/g, 'a').replace(/ /g, '.') + '@example.com',
      kund: null, affar: null, tilldelad: null, last: false, farsk: true };
    db().forfragningar.push(f);
    IH.spara();
    fFilter = 'alla';
    IH.toast('Ny förfrågan', s[0] + ' · ' + s[3] + ' · ' + s[1], 'inkorg');
    IH.uppdateraMeny();
    IH.rita();
    var rad = $('[data-fid="' + f.id + '"]');
    if (rad) rad.classList.add('fl--in');
    var dio = $('.dio[data-m="' + f.miljo + '"]');
    if (dio) dio.classList.add('dio--ankomst');
    delete f.farsk;
  };

  /* ================================================================
     Säljtavlan
     ================================================================ */
  var tavlaLage = 'tavla', tavlaUi = { sok: '', vem: 'alla', filter: 'alla', sort: 'andrad', kompakt: false };

  function nastaSteg(a) {
    var o = IH.offertFor(a.id);
    switch (a.steg) {
      case 'ny': return 'Ring och boka ett första samtal';
      case 'kontakt': return 'Boka platsbesök eller tomtkoll';
      case 'besok': return o ? 'Skicka offerten' : 'Skapa offert';
      case 'offert': return IH.dagarSedan(a.andrad) > 4 ? 'Följ upp offerten – ' + IH.dagarSedan(a.andrad) + ' d sedan' : 'Vänta på svar, följ upp om några dagar';
      case 'forhandling': return 'Stäm av detaljerna och skicka order';
      default: return '';
    }
  }

  // Emoji för säljstegen och nästa steg – i stegbandet, spalterna och korten.
  var SALJ_EMOJI = { ny: '<svg class="emo-ik" aria-hidden="true"><use href="#i-inkorg"/></svg>', kontakt: '<svg class="emo-ik" aria-hidden="true"><use href="#i-samtal"/></svg>', besok: '<svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg>', offert: '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>', forhandling: '<svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg>', vunnen: '<svg class="emo-ik" aria-hidden="true"><use href="#i-medalj"/></svg>' };
  function nastaEmoji(a) {
    switch (a.steg) {
      case 'ny': return '<svg class="emo-ik" aria-hidden="true"><use href="#i-samtal"/></svg>';
      case 'kontakt': return '<svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg>';
      case 'besok': return IH.offertFor(a.id) ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-skicka"/></svg>' : '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>';
      case 'offert': return IH.dagarSedan(a.andrad) > 4 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-skicka"/></svg>' : '⏳';
      case 'forhandling': return '<svg class="emo-ik" aria-hidden="true"><use href="#i-signera"/></svg>';
      default: return '<svg class="emo-ik" aria-hidden="true"><use href="#i-pil"/></svg>';
    }
  }

  function nastaStegId(a) { var ix = IH.SALJSTEG.findIndex(function (x) { return x.id === a.steg; }); var n = IH.SALJSTEG[ix + 1]; return n ? n.id : null; }
  function tavlaPassar(a) {
    var q = tavlaUi.sok.trim().toLowerCase(), k = IH.kund(a.kund), m = IH.modell(a.modell), d = IH.dagarSedan(a.andrad);
    if (q && (a.titel + ' ' + (k ? k.namn + ' ' + k.ort : '') + ' ' + (m ? m.namn : '')).toLowerCase().indexOf(q) < 0) return false;
    if (tavlaUi.vem === 'mina' && a.ansvarig !== IH.jag().id) return false;
    if (tavlaUi.filter === 'still' && !(d > 10 && a.steg !== 'vunnen')) return false;
    if (tavlaUi.filter === 'stora' && (a.varde || 0) < 600000) return false;
    if (tavlaUi.filter === 'uppg' && !db().uppgifter.some(function (u) { return !u.klar && u.affar === a.id; })) return false;
    return true;
  }
  var tavlaSort = function (l) { return l.sort(function (a, b) { return tavlaUi.sort === 'varde' ? (b.varde || 0) - (a.varde || 0) : tavlaUi.sort === 'chans' ? sannolikhet(b) * b.varde - sannolikhet(a) * a.varde : (b.andrad < a.andrad ? -1 : 1); }); };
  function affKort(a) {
    var k = IH.kund(a.kund);
    var m = IH.modell(a.modell);
    var s = IH.steg(a.steg);
    var p = sannolikhet(a);
    var d = IH.dagarSedan(a.andrad);
    // Hur länge affären legat i steget: färsk, lugn eller står still.
    var tid = d <= 3 ? 'farsk' : d <= 10 ? 'lugn' : 'still';
    return '<article class="aff aff--' + tid + '" data-aff="' + a.id + '" tabindex="0" style="--f:' + s.farg + '" aria-label="' + e(a.titel) + ', ' + IH.kort(a.varde) + '">' +
      '<div class="aff__topp">' + (m ? '<span class="aff__bild"><img src="' + m.tumme + '" alt="" loading="lazy" decoding="async"></span>' : '') +
      '<span class="aff__modell">' + (m ? e(m.namn) : '') + '</span>' + (a.steg === 'vunnen' ? '<span class="aff__vunnen">' + i('trofe') + '</span>' : ring(p, s.farg, sannSkal(a))) +
        (a.steg !== 'vunnen' ? '<button type="button" class="aff__flytta" data-g="aff-flyttmeny" data-id="' + a.id + '" aria-label="Flytta affären" title="Flytta">' + i('pil') + '</button>' : '') + '</div>' +
      '<b class="aff__titel">' + e(a.titel) + '</b>' +
      '<span class="aff__kund">' + kundAvatar(k, true) + e(k ? k.namn : '') + '</span>' +
      '<div class="aff__fot"><span class="tal">' + IH.kort(a.varde) + '</span>' +
        (a.steg === 'vunnen' ? '<span class="tid">vann ' + IH.sedan(a.vunnen) + '</span>'
          : '<span class="aff__tid aff__tid--' + tid + '" title="' + d + (d === 1 ? ' dag' : ' dagar') + ' i steget">' + (d === 0 ? 'I dag' : d + ' d') + '</span>') + '</div>' +
      (a.steg !== 'vunnen' ? '<p class="aff__nasta' + (d > 10 ? ' aff__nasta--varm' : '') + '"><span class="aff__nastaemoji" aria-hidden="true">' + nastaEmoji(a) + '</span>' + e(nastaSteg(a)) + '</p>' : '') +
      (a.steg !== 'vunnen' ? '<div class="aff__verktyg">' + (k && k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring ' + e(k.namn) + '">' + i('tel') + '</button>' : '') +
        '<button type="button" data-g="aff-logga" data-id="' + a.id + '" title="Logga ett samtal eller en anteckning">' + i('anteckning') + '</button>' +
        '<button type="button" data-g="aff-uppg" data-id="' + a.id + '" title="Ny uppgift på affären">' + i('uppgift') + '</button>' +
        (nastaStegId(a) ? '<button type="button" class="aff__vidare" data-g="aff-vidare" data-id="' + a.id + '" title="Flytta till ' + e(IH.steg(nastaStegId(a)).namn) + '">Vidare' + i('pil') + '</button>' : '') + '</div>' : '') +
      '</article>';
  }

  // Pipelinen som ett hus i sprängskiss: varje säljsteg är en byggdel,
  // från grunden (ny förfrågan) till taket (förhandling) som hänger i
  // kranen. Delarna sänks på plats en i taget; listan bredvid visar
  // summorna, och hovring på en rad lyfter ut samma byggdel.
  // Ett Legohus Stockholm i CSS 3D: långvägg, gavel med glasparti, altan och
  // två takfall. Måtten kommer från --W/--D/--Hw/--R/--L hos föräldern.
  function hus3() {
    return '<span class="hus3"><i class="hus3__skugga"></i><i class="hus3__ljus hus3__ljus--gavel"></i><i class="hus3__ljus hus3__ljus--sida"></i>' +
      '<i class="hus3__snore"></i><i class="hus3__pinne" style="left:0;top:0"><i></i></i><i class="hus3__pinne" style="left:100%;top:0"><i></i></i>' +
      '<i class="hus3__pinne" style="left:0;top:100%"><i></i></i><i class="hus3__pinne" style="left:100%;top:100%"><i></i></i>' +
      '<span class="hus3__platta"><i></i><i></i><i></i></span>' +
      '<i class="hus3__sockel"></i><i class="hus3__altan"></i>' +
      '<i class="hus3__vagg hus3__vagg--bak"></i><i class="hus3__gavel hus3__gavel--bak"></i>' +
      '<i class="hus3__vagg hus3__vagg--fram"><i class="hus3__fonster"></i><i class="hus3__fonster hus3__fonster--2"></i></i>' +
      '<i class="hus3__gavel hus3__gavel--fram"><i class="hus3__glas"></i><i class="hus3__dorr"></i></i>' +
      '<i class="hus3__stol" style="top:10%"></i><i class="hus3__stol" style="top:36%"></i><i class="hus3__stol" style="top:62%"></i><i class="hus3__stol" style="top:88%"></i>' +
      '<i class="hus3__tak hus3__tak--v"></i><i class="hus3__tak hus3__tak--h"><i class="hus3__nock"></i></i><i class="hus3__vajer"></i></span>';
  }

  // En låda i CSS 3D med de tre sidor vi ser: ovansida, framsida (y = D)
  // och vänster sida (x = 0). Mått i px i planets koordinater.
  function box3(klass, w, d, h, x, y, z) {
    return '<span class="b3 ' + klass + '" style="--bw:' + w + 'px;--bd:' + d + 'px;--bh:' + h + 'px;--bx:' + x + 'px;--by:' + y + 'px;--bz:' + z + 'px">' +
      '<i class="b3__t"></i><i class="b3__f"></i><i class="b3__v"></i></span>';
  }

  var DELAR = ['Grunden', 'Golvet', 'Väggarna', 'Takstolarna', 'Taket'];
  function lagerHtml(n) {
    var box = '<i class="yta yta--topp"></i><i class="yta yta--fram"></i><i class="yta yta--hoger"></i>';
    switch (n) {
      case 0: case 1: return box;
      case 2: return '<i class="vagg vagg--bak"></i><i class="vagg vagg--hoger"></i>' +
        '<i class="vagg vagg--fram"><i class="lampa lampa--glas"></i></i><i class="vagg vagg--vanster"><i class="lampa"></i><i class="lampa lampa--2"></i></i>';
      case 3: return [8, 29, 50, 71, 92].map(function (y) { return '<i class="stol" style="top:' + y + '%"></i>'; }).join('') + '<i class="nockbalk"></i>';
      default: return '<i class="takfall takfall--v"></i><i class="takfall takfall--h"><i class="takfall__nock"></i></i><i class="vajer"></i>';
    }
  }
  function tratt(oppna) {
    var steg = IH.SALJSTEG.filter(function (s) { return s.id !== 'vunnen'; });
    var rader = steg.map(function (s, n) {
      var l = oppna.filter(function (a) { return a.steg === s.id; });
      return { s: s, n: n, summa: summa(l), antal: l.length };
    });
    var max = Math.max.apply(null, rader.map(function (r) { return r.summa; }).concat([1]));
    return '<div class="bygge" aria-hidden="true"><div class="bygge__scen"><div class="bygge__plan"><i class="bygge__mark"></i>' +
      rader.map(function (r) {
        return '<div class="lager" data-n="' + r.n + '" data-g="till-spalt" data-steg="' + r.s.id + '" style="--n:' + r.n + ';--f:' + r.s.farg + '"><div class="lager__inre">' + lagerHtml(r.n) + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="bygge__lista">' + rader.slice().reverse().map(function (r) {
        return '<button class="bygge__rad" type="button" tabindex="-1" data-n="' + r.n + '" data-g="till-spalt" data-steg="' + r.s.id + '" style="--f:' + r.s.farg + ';--a:' + (r.summa / max).toFixed(3) + ';--k:' + (4 - r.n) + '">' +
          '<i class="bygge__prick"></i><span><small>' + DELAR[r.n] + ' · ' + e(r.s.kort) + '</small><b>' + IH.kort(r.summa) + '<em>' + r.antal + ' st</em></b></span><i class="bygge__stapel"></i></button>';
      }).join('') + '</div></div>';
  }

  function smartaForslag() {
    var ut = [];
    db().forfragningar.filter(function (f) { return f.status === 'ny'; }).slice(0, 2).forEach(function (f) {
      ut.push(['inkorg', 'Ny förfrågan väntar: ' + f.namn, f.hustyp + ' · ' + f.ort + ' · ' + IH.sedan(f.skapad), '#/forfragningar/' + f.id, 'Svara']);
    });
    oppnaAffarer().filter(function (a) { return a.steg === 'offert' && IH.dagarSedan(a.andrad) > 4; }).slice(0, 2).forEach(function (a) {
      var k = IH.kund(a.kund);
      ut.push(['post', 'Följ upp offerten: ' + (k ? k.namn : a.titel), IH.dagarSedan(a.andrad) + ' dagar sedan offerten skickades', '#/salj/' + a.id, 'Följ upp']);
    });
    var stilla = oppnaAffarer().filter(function (a) { return IH.dagarSedan(a.andrad) > 10 && a.steg !== 'offert'; })[0];
    if (stilla) ut.push(['klocka', 'Står still: ' + stilla.titel, IH.dagarSedan(stilla.andrad) + ' d i ' + IH.steg(stilla.steg).namn.toLowerCase(), '#/salj/' + stilla.id, 'Öppna']);
    var bast = oppnaAffarer().sort(function (a, b) { return b.varde * sannolikhet(b) - a.varde * sannolikhet(a); })[0];
    if (bast) ut.push(['stjarna', 'Störst viktat värde: ' + bast.titel, sannolikhet(bast) + ' % av ' + IH.kort(bast.varde), '#/salj/' + bast.id, 'Öppna']);
    return ut.slice(0, 4);
  }

  IH.vyer.salj = function (del) {
    if (del[0]) return affarSida(del[0]);
    var oppna = oppnaAffarer();
    var vunna90 = db().affarer.filter(function (a) { return a.steg === 'vunnen' && IH.dagarSedan(a.vunnen || a.andrad) <= 90; });
    var verktyg = '<div class="toppverktyg"><div class="flikar" data-flikar><button type="button" data-g="tavla-lage" data-l="tavla" aria-pressed="' + (tavlaLage === 'tavla') + '">' + i('tavla') + 'Tavla</button>' +
      '<button type="button" data-g="tavla-lage" data-l="lista" aria-pressed="' + (tavlaLage === 'lista') + '">' + i('lista') + 'Lista</button></div>' +
      '<button class="knapp knapp--mork" type="button" data-g="ny-affar">' + i('plus') + 'Ny affär</button></div>';
    var html = '<h1 class="dold">Säljtavla</h1>' +

      '<section class="puls kort kort--mork" data-in>' + tratt(oppna) +
        '<div class="puls__kpi">' +
          kpi('graf', 'Öppen pipeline', summa(oppna), 'kort', oppna.length + ' affärer', '#/salj') +
          kpi('blixt', 'Viktad prognos', viktat(oppna), 'kort', (summa(oppna) ? Math.round(viktat(oppna) / summa(oppna) * 100) : 0) + ' % av pipelinen', '#/salj') +
          kpi('kub', 'Snitt per affär', oppna.length ? summa(oppna) / oppna.length : 0, 'kort', 'öppna affärer', '#/salj') +
          kpi('trofe', 'Vunnet 90 d', summa(vunna90), 'kort', vunna90.length + ' ordrar', '#/salj') +
        '</div>' +
        '<div class="forslag">' + verktyg + '<p class="etikett etikett--ljus">' + i('blixt') + 'Smarta förslag</p>' + smartaForslag().map(function (f) {
          return '<a class="forslag__rad" href="' + f[3] + '"><span class="forslag__ikon">' + i(f[0]) + '</span><span><b>' + e(f[1]) + '</b><small>' + e(f[2]) + '</small></span><em>' + f[4] + '</em></a>';
        }).join('') + '</div>' +
      '</section>';

    if (tavlaLage === 'lista') {
      html += '<section class="kort" data-in><table class="tabell"><thead><tr><th>Affär</th><th>Kund</th><th>Steg</th><th>Värde</th><th>Sannolikhet</th><th>Ändrad</th></tr></thead><tbody data-stagger>' +
        db().affarer.filter(function (a) { return !a.forlorad; }).sort(function (a, b) { return b.varde - a.varde; }).map(function (a) {
          var k = IH.kund(a.kund), s = IH.steg(a.steg);
          return '<tr data-g="aff-oppna" data-id="' + a.id + '"><td><b>' + e(a.titel) + '</b></td><td>' + e(k ? k.namn : '') + '</td><td>' + statusChip(s.farg, s.namn) +
            '</td><td class="tal">' + IH.kr(a.varde) + '</td><td>' + ring(sannolikhet(a), s.farg) + '</td><td class="tid">' + IH.sedan(a.andrad) + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    } else {
      html += '<div class="stegband" data-in>' + IH.SALJSTEG.map(function (s) {
        var l = s.id === 'vunnen' ? vunna90 : oppna.filter(function (a) { return a.steg === s.id; });
        var andel = summa(oppna.concat(vunna90)) ? summa(l) / summa(oppna.concat(vunna90)) : 0;
        return '<button type="button" data-g="till-spalt" data-steg="' + s.id + '" style="--f:' + s.farg + ';--a:' + andel.toFixed(3) + '">' +
          '<span class="stegband__emoji" aria-hidden="true">' + SALJ_EMOJI[s.id] + '</span><span class="stegband__text"><b>' + e(s.namn) + '</b><small>' + l.length + ' st · ' + IH.kort(summa(l)) + '</small></span><i></i></button>';
      }).join('') + '</div>' +
      (function () {
        var antal = function (f) { var g = tavlaUi.filter; tavlaUi.filter = f; var n = oppna.filter(tavlaPassar).length; tavlaUi.filter = g; return n; };
        return '<div class="tv-verktyg"><label class="sok sok--liten tv-sok">' + i('sok') + '<input type="search" placeholder="Sök affär, kund, ort eller hus…" value="' + e(tavlaUi.sok) + '" data-tv-sok aria-label="Sök på tavlan"></label>' +
          '<div class="tv-seg" role="group" aria-label="Vems">' + [['alla', 'Alla'], ['mina', 'Mina']].map(function (v) { return '<button type="button" data-g="tv-vem" data-f="' + v[0] + '" aria-pressed="' + (tavlaUi.vem === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>' +
          '<div class="ap-filterrad" role="group" aria-label="Filter">' + [['alla', 'Allt'], ['still', 'Står still'], ['uppg', 'Har uppgift'], ['stora', 'Över 600 tkr']].map(function (f) { return '<button type="button" class="ap-filter" data-g="tv-filter" data-f="' + f[0] + '" aria-pressed="' + (tavlaUi.filter === f[0]) + '">' + f[1] + ' <em>' + antal(f[0]) + '</em></button>'; }).join('') + '</div>' +
          '<label class="kundsort">' + i('lista') + '<select data-tv-sort aria-label="Sortera korten">' + [['andrad', 'Senast ändrad'], ['varde', 'Störst värde'], ['chans', 'Viktat värde']].map(function (o) { return '<option value="' + o[0] + '"' + (tavlaUi.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<button type="button" class="tv-ikon" data-g="tv-kompakt" aria-pressed="' + tavlaUi.kompakt + '" title="' + (tavlaUi.kompakt ? 'Visa hela korten' : 'Kompakta kort – fler syns på en gång') + '">' + i(tavlaUi.kompakt ? 'kub' : 'lista') + '</button></div>';
      })() +
      (function () {
        var poang = function (a) { var d = IH.dagarSedan(a.andrad), u = db().uppgifter.some(function (x) { return !x.klar && x.affar === a.id && new Date(x.forfaller) < new Date(); }); return (a.varde || 0) / 1e5 * sannolikhet(a) / 50 + Math.min(d, 30) * 0.6 + (u ? 12 : 0) + (a.steg === 'offert' && d > 4 ? 8 : 0); };
        var topp = oppna.slice().sort(function (a, b) { return poang(b) - poang(a); }).slice(0, 3);
        if (!topp.length) return '';
        return '<div class="tv-fokus"><p><span>' + i('blixt') + '</span>Fokus i dag<small>de affärer som tjänar mest på en kontakt nu</small></p>' + topp.map(function (a, n) {
          var k = IH.kund(a.kund), d = IH.dagarSedan(a.andrad), st = IH.steg(a.steg);
          return '<button type="button" class="tv-fokus__kort" data-g="aff-oppna" data-id="' + a.id + '" style="--f:' + st.farg + ';--n:' + n + '"><b>' + (n + 1) + '</b><span><strong>' + e(a.titel) + '</strong><small>' + e(k ? k.namn : '') + ' · ' + e(st.namn) + ' · ' + (d ? d + ' d sedan' : 'i dag') + '</small><em>' + e(nastaSteg(a)) + '</em></span><i>' + IH.kort(a.varde) + '</i></button>';
        }).join('') + '</div>';
      })() +
      '<p class="tavla__tips"><svg class="emo-ik" aria-hidden="true"><use href="#i-glodlampa"/></svg> Dra korten mellan stegen eller tryck på knappen med nästa steg på kortet. Släpp längst ned för att markera som förlorad.</p>' +
      '<div class="tavla-ram"><button type="button" class="tavla-pil tavla-pil--v" data-g="tavla-rulla" data-d="-1" aria-label="Visa tidigare steg">' + i('pilv') + '</button><button type="button" class="tavla-pil tavla-pil--h" data-g="tavla-rulla" data-d="1" aria-label="Visa fler steg">' + i('pil') + '</button>' +
      '<div class="tavla' + (tavlaUi.kompakt ? ' tavla--kompakt' : '') + '" data-tavla>' + IH.SALJSTEG.map(function (s) {
        var alla = s.id === 'vunnen' ? vunna90 : oppna.filter(function (a) { return a.steg === s.id; });
        var l = tavlaSort(alla.filter(tavlaPassar)), maxV = Math.max.apply(null, alla.map(function (a) { return a.varde || 0; }).concat([1])), still = alla.filter(function (a) { return s.id !== 'vunnen' && IH.dagarSedan(a.andrad) > 10; }).length;
        var snittD = alla.length ? Math.round(alla.reduce(function (t, a) { return t + IH.dagarSedan(a.andrad); }, 0) / alla.length) : 0;
        return '<section class="spalt" data-steg="' + s.id + '" style="--f:' + s.farg + '" id="spalt-' + s.id + '">' +
          '<header class="spalt__huvud"><div><b><span class="spalt__emoji" aria-hidden="true">' + SALJ_EMOJI[s.id] + '</span>' + e(s.namn) + '</b><span>' + l.length + '</span></div><p class="tal">' + IH.kort(summa(l)) + '</p>' +
          '<small>' + (s.id === 'vunnen' ? 'senaste 90 dagarna' : s.sannolikhet + ' % chans · viktat ' + IH.kort(viktat(l))) + '</small>' +
          (s.id !== 'vunnen' && alla.length ? '<div class="spalt__insikt"><span title="Genomsnittlig tid sedan senaste ändringen">' + i('klocka') + 'snitt ' + snittD + ' d</span>' + (still ? '<span class="varm" title="Affärer utan ändring på över 10 dagar">' + i('varning') + still + ' står still</span>' : '<span class="ok">' + i('bock') + 'i rörelse</span>') + '</div>' : '') +
          (l.length < alla.length ? '<p class="spalt__dolda">' + (alla.length - l.length) + ' dolda av filtret</p>' : '') + '</header>' +
          '<i class="spalt__viktat" title="Viktat ' + IH.kort(viktat(alla)) + ' av ' + IH.kort(summa(alla)) + '" style="--a:' + (summa(alla) ? viktat(alla) / summa(alla) : 0).toFixed(3) + '"></i>' +
          '<div class="spalt__kort" data-stagger>' + (l.length ? l.map(function (a) { return affKort(a).replace('class="aff ', 'style="--v:' + ((a.varde || 0) / maxV).toFixed(3) + '" class="aff '); }).join('') : '<p class="spalt__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-gnista"/></svg></span>Dra hit en affär</p>') + '</div></section>';
      }).join('') + '</div>' +
      '</div>' +
      '<div class="forlustdocka" aria-hidden="true">' + i('stang') + 'Släpp här för att markera som förlorad</div>';
    }
    return {
      titel: 'Säljtavla', html: html,
      efter: function (rot) {
        glidFlikar($('[data-flikar]', rot));
        var ts = $('[data-tv-sok]', rot); if (ts) ts.addEventListener('input', function () { tavlaUi.sok = ts.value; var pos = ts.selectionStart; IH.rita(); var n = $('[data-tv-sok]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
        var tso = $('[data-tv-sort]', rot); if (tso) tso.addEventListener('change', function () { tavlaUi.sort = tso.value; IH.rita(); });
        var tavla = $('[data-tavla]', rot);
        if (tavla) { kopplaDra(tavla); kanter(tavla); }
        IH.pausaUtanfor($('.puls', rot));
        if (del[0]) setTimeout(function () { affArk(del[0]); }, 60);
      }
    };
  };

  function kanter(el) {
    var satt = function () {
      el.classList.toggle('kan-vanster', el.scrollLeft > 4);
      el.classList.toggle('kan-hoger', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      var ram = el.parentElement; if (ram && ram.classList.contains('tavla-ram')) { ram.classList.toggle('kan-vanster', el.scrollLeft > 4); ram.classList.toggle('kan-hoger', el.scrollLeft + el.clientWidth < el.scrollWidth - 4); }
    };
    el.addEventListener('scroll', satt, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(satt).observe(el);
    satt();
  }

  G['ik-period'] = function (el) { intaktPeriod = +el.getAttribute('data-f'); IH.rita(); };
  G['ik-csv'] = function () {
    var esc = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rader = [['Vunnen', 'Affär', 'Kund', 'Hus', 'Värde (kr)', 'Säljare']].concat(db().affarer.filter(function (a) { return a.steg === 'vunnen' && a.vunnen; }).sort(function (a, b) { return a.vunnen < b.vunnen ? 1 : -1; }).map(function (a) { var k = IH.kund(a.kund), m = IH.modell(a.modell), u = IH.anvandare(a.ansvarig); return [IH.datum(a.vunnen, true), a.titel, k ? k.namn : '', m ? m.namn : '', a.varde, u ? u.namn : '']; }));
    var l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['\ufeff' + rader.map(function (r) { return r.map(esc).join(';'); }).join('\r\n')], { type: 'text/csv' })); l.download = 'vunna-affarer-' + IH.dagStr() + '.csv'; document.body.appendChild(l); l.click(); l.remove();
    IH.toast('Exporterat', (rader.length - 1) + ' vunna affärer till CSV.', 'skrivut');
  };
  G['tavla-lage'] = function (el) { tavlaLage = el.getAttribute('data-l'); IH.rita(); };
  G['tavla-rulla'] = function (el) { var t = $('[data-tavla]'); if (!t) return; var sp = t.querySelector('.spalt'), w = sp ? sp.getBoundingClientRect().width + 12 : 280; t.scrollBy({ left: +el.getAttribute('data-d') * w * 2, behavior: IH.lugn ? 'auto' : 'smooth' }); };
  G['tv-vem'] = function (el) { tavlaUi.vem = el.getAttribute('data-f'); IH.rita(); };
  G['tv-filter'] = function (el) { tavlaUi.filter = el.getAttribute('data-f'); IH.rita(); };
  G['tv-kompakt'] = function () { tavlaUi.kompakt = !tavlaUi.kompakt; IH.rita(); };
  G['aff-vidare'] = function (el) { var a = IH.affar(el.getAttribute('data-id')), n = a && nastaStegId(a); if (!n) return; var kort = el.closest('.aff'); flyttaAffar(a.id, n, kort ? kort.getBoundingClientRect() : null); };
  G['aff-logga'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id')); if (!a) return; var k = IH.kund(a.kund);
    IH.oppnaArk({ titel: 'Logga på affären', ikon: 'anteckning', under: e(a.titel) + (k ? ' · ' + e(k.namn) : ''), kropp: anteckningsForm(a.kund, a.id), fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button>' });
  };
  G['aff-uppg'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id')); if (!a) return; var imorgon = new Date(Date.now() + 864e5);
    IH.oppnaArk({ titel: 'Ny uppgift', ikon: 'uppgift', under: e(a.titel),
      kropp: '<form class="formular" data-form="aff-uppg" id="aff-uppg-form"><input type="hidden" name="affar" value="' + a.id + '"><label class="falt"><span>Vad ska göras?</span><input name="text" required autofocus placeholder="T.ex. Skicka offert"></label><label class="falt"><span>Klart senast</span><input name="datum" type="date" value="' + IH.dagStr(imorgon) + '"></label>' +
        '<div class="snabbval">' + [['I dag', 0], ['I morgon', 1], ['Om 3 dagar', 3], ['Nästa vecka', 7]].map(function (v) { return '<button type="button" class="ap-filter" data-g="kund-uppg-dag" data-d="' + v[1] + '">' + v[0] + '</button>'; }).join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="aff-uppg-form">' + i('plus') + 'Lägg till</button>' });
  };
  FORM['aff-uppg'] = function (f, d) {
    var a = IH.affar(d.get('affar')); if (!a) return;
    db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: d.get('text'), forfaller: new Date((d.get('datum') || IH.dagStr()) + 'T09:00:00').toISOString(), klar: false, kund: a.kund, affar: a.id, ansvarig: IH.jag().id });
    IH.spara(); IH.stangArk(true); IH.uppdateraMeny(); IH.rita(); IH.toast('Uppgiften är tillagd', d.get('text'), 'uppgift');
  };
  G['till-spalt'] = function (el) {
    var s = $('#spalt-' + el.getAttribute('data-steg'));
    if (!s) return;
    s.scrollIntoView({ behavior: IH.lugn ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    s.classList.remove('spalt--puls');
    void s.offsetWidth;
    s.classList.add('spalt--puls');
  };
  G['aff-oppna'] = function (el) { IH.stangArk(true); IH.ga('#/salj/' + el.getAttribute('data-id')); };

  // Dra och släpp med pekaren: kortet lyfts i 3D och lutar efter farten.
  function kopplaDra(tavla) {
    var docka = $('.forlustdocka');
    tavla.addEventListener('pointerdown', function (ev) {
      var kort = ev.target.closest('.aff');
      if (!kort || ev.button !== 0 || ev.target.closest('button')) return;
      var startX = ev.clientX, startY = ev.clientY, drar = false, flyg = null, forraX = startX, lutning = 0;
      var rect = kort.getBoundingClientRect();
      var id = kort.getAttribute('data-aff');
      var aff = IH.affar(id);
      var mal = null;
      var touch = ev.pointerType === 'touch';
      var timer = touch ? setTimeout(function () { starta(); }, 280) : 0;

      function starta() {
        if (drar) return;
        drar = true;
        flyg = kort.cloneNode(true);
        flyg.classList.add('aff--flyger');
        flyg.style.width = rect.width + 'px';
        flyg.style.left = rect.left + 'px';
        flyg.style.top = rect.top + 'px';
        document.body.appendChild(flyg);
        kort.classList.add('aff--spok');
        document.documentElement.classList.add('drar');
        if (docka && aff.steg !== 'vunnen') docka.classList.add('syns');
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* */ }
      }
      function flytta(e2) {
        var dx = e2.clientX - startX, dy = e2.clientY - startY;
        if (!drar) {
          if (touch) { if (Math.abs(dx) + Math.abs(dy) > 10) { clearTimeout(timer); slapp(); } return; }
          if (Math.abs(dx) + Math.abs(dy) < 6) return;
          starta();
        }
        e2.preventDefault();
        lutning = lutning * 0.8 + (e2.clientX - forraX) * 0.9;
        forraX = e2.clientX;
        var l = Math.max(-18, Math.min(18, lutning));
        flyg.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' + (l * 0.35).toFixed(2) + 'deg) rotateY(' + (l * 0.9).toFixed(1) + 'deg) scale(1.05)';
        flyg.style.pointerEvents = 'none';
        var under = document.elementFromPoint(e2.clientX, e2.clientY);
        var spalt = under && under.closest('.spalt');
        var iDocka = under && under.closest('.forlustdocka');
        var iBand = under && under.closest('.stegband [data-steg]');
        var nyttMal = iDocka ? 'forlorad' : spalt ? spalt.getAttribute('data-steg') : iBand ? iBand.getAttribute('data-steg') : null;
        if (nyttMal !== mal) {
          $$('.spalt--mal, .stegband--mal').forEach(function (x) { x.classList.remove('spalt--mal', 'stegband--mal'); });
          if (iBand && nyttMal !== aff.steg) iBand.classList.add('stegband--mal');
          if (docka) docka.classList.toggle('mal', nyttMal === 'forlorad');
          if (spalt && nyttMal !== aff.steg) spalt.classList.add('spalt--mal');
          mal = nyttMal;
        }
        // Rulla tavlan när kortet närmar sig kanten.
        var tr = tavla.getBoundingClientRect();
        if (e2.clientX > tr.right - 60) tavla.scrollLeft += 12;
        if (e2.clientX < tr.left + 60) tavla.scrollLeft -= 12;
      }
      function slapp() {
        clearTimeout(timer);
        document.removeEventListener('pointermove', flytta);
        document.removeEventListener('pointerup', slapp);
        document.removeEventListener('pointercancel', slapp);
        if (!drar) return;
        document.documentElement.classList.remove('drar');
        $$('.spalt--mal, .stegband--mal').forEach(function (x) { x.classList.remove('spalt--mal', 'stegband--mal'); });
        if (docka) docka.classList.remove('syns', 'mal');
        var klar = function () { if (flyg) flyg.remove(); kort.classList.remove('aff--spok'); };
        if (mal === 'forlorad') { klar(); forloraArk(id); return; }
        if (mal && mal !== aff.steg) {
          var mSpalt = $('.spalt[data-steg="' + mal + '"] .spalt__kort');
          var r = mSpalt.getBoundingClientRect();
          flyg.classList.add('aff--landar');
          flyg.style.transform = 'translate3d(' + (r.left - rect.left + 6) + 'px,' + (r.top - rect.top + 6) + 'px,0) scale(0.98)';
          setTimeout(function () {
            klar();
            flyttaAffar(id, mal, flyg ? flyg.getBoundingClientRect() : null);
          }, IH.lugn ? 0 : 320);
        } else {
          flyg.classList.add('aff--landar');
          flyg.style.transform = 'translate3d(0,0,0)';
          setTimeout(klar, IH.lugn ? 0 : 300);
        }
        kort.dataset.dragen = '1';
        setTimeout(function () { delete kort.dataset.dragen; }, 50);
      }
      document.addEventListener('pointermove', flytta, { passive: false });
      document.addEventListener('pointerup', slapp);
      document.addEventListener('pointercancel', slapp);
    });
    tavla.addEventListener('click', function (ev) {
      var kort = ev.target.closest('.aff');
      if (!kort || kort.dataset.dragen || ev.target.closest('button')) return;
      IH.ga('#/salj/' + kort.getAttribute('data-aff'));
    });
    tavla.addEventListener('keydown', function (ev) {
      var kort = ev.target.closest('.aff');
      if (!kort) return;
      if (ev.target !== kort) return;
      if (ev.key === 'Enter') { IH.ga('#/salj/' + kort.getAttribute('data-aff')); return; }
      if (!ev.shiftKey && /^Arrow(Up|Down|Left|Right)$/.test(ev.key)) {
        var spalt = kort.closest('.spalt'), iSpalt = $$('.aff', spalt), n = iSpalt.indexOf(kort), mal = null;
        if (ev.key === 'ArrowUp') mal = iSpalt[n - 1];
        else if (ev.key === 'ArrowDown') mal = iSpalt[n + 1];
        else {
          var spalter = $$('.spalt', tavla), j = spalter.indexOf(spalt), dir = ev.key === 'ArrowRight' ? 1 : -1;
          for (j += dir; j >= 0 && j < spalter.length && !mal; j += dir) { var l = $$('.aff', spalter[j]); if (l.length) mal = l[Math.min(n, l.length - 1)]; }
        }
        if (mal) { ev.preventDefault(); mal.focus(); mal.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: IH.lugn ? 'auto' : 'smooth' }); }
        return;
      }
      if (ev.shiftKey && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        ev.preventDefault();
        var a = IH.affar(kort.getAttribute('data-aff'));
        var idx = IH.SALJSTEG.map(function (s) { return s.id; }).indexOf(a.steg) + (ev.key === 'ArrowRight' ? 1 : -1);
        if (idx >= 0 && idx < IH.SALJSTEG.length) flyttaAffar(a.id, IH.SALJSTEG[idx].id);
      }
    });
  }

  var projOppnad = null; // adressen vars projektpanel redan öppnats – omritningar öppnar den inte igen
  function flyttaAffar(id, steg, rect) {
    var a = IH.affar(id);
    if (!a || a.steg === steg) return;
    var fran = IH.steg(a.steg).namn;
    var forraKort = rect ? null : $('.aff[data-aff="' + id + '"]');
    var fore = forraKort ? forraKort.getBoundingClientRect() : null;
    a.steg = steg;
    a.andrad = new Date().toISOString();
    if (steg === 'vunnen') {
      vinn(a, rect || fore);
      return;
    }
    if (a.vunnen) {
      var ob = IH.offertFor(a.id); if (ob && ob.status === 'godkand') ob.status = 'skickad';
      var pi = db().projekt.findIndex(function (p) { return p.affar === a.id && p.steg === 'underlag' && !Object.keys(p.check || {}).some(function (c) { return p.check[c]; }); });
      if (pi >= 0) db().projekt.splice(pi, 1);
      else if (db().projekt.some(function (p) { return p.affar === a.id; })) IH.toast('Projektet ligger kvar', 'Det är redan påbörjat i produktionen – ändra det där om det ska bort.', 'varning');
    }
    a.vunnen = null;
    IH.logga('system', 'Flyttad från ' + fran + ' till ' + IH.steg(steg).namn + '.', a.kund, a.id);
    IH.spara();
    IH.ritaOm();
    if (fore) flipFran(id, fore);
    IH.lysUpp('[data-aff="' + id + '"]', 'aff--ny');
    IH.toast('Flyttad till ' + IH.steg(steg).namn, a.titel, 'tavla');
  }

  // Kortet flyger från sin gamla plats till den nya i en båge (samma rörelse som i Uperformance).
  function flipFran(id, fran) {
    var ny = $('.aff[data-aff="' + id + '"]');
    if (!ny || !fran || IH.lugn || !ny.animate) return;
    ny.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    var till = ny.getBoundingClientRect();
    var dx = fran.left - till.left, dy = fran.top - till.top, r = dx >= 0 ? -1 : 1;
    ny.style.zIndex = 60;
    var anim = ny.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.05)' },
      { transform: 'translate(' + (dx * 0.5) + 'px,' + (dy * 0.5 - 50) + 'px) perspective(900px) rotateY(' + (r * 26) + 'deg) rotateZ(' + (-r * 5) + 'deg) scale(1.12)', offset: 0.45 },
      { transform: 'translate(0,0) scale(1)' }
    ], { duration: 850, easing: 'cubic-bezier(.22,1,.36,1)' });
    anim.onfinish = function () { ny.style.zIndex = ''; };
  }

  // 4. Flyttmenyn: en knapp på kortet med alla steg – för pekskärmar och för den som inte vill dra.
  var flyttmeny = null;
  function stangFlyttmeny() {
    if (!flyttmeny) return;
    flyttmeny.remove(); flyttmeny = null;
    document.removeEventListener('pointerdown', utanforFlyttmeny, true);
  }
  function utanforFlyttmeny(ev) { if (flyttmeny && !flyttmeny.contains(ev.target) && !ev.target.closest('[data-g="aff-flyttmeny"]')) stangFlyttmeny(); }
  G['aff-flyttmeny'] = function (el) {
    var id = el.getAttribute('data-id'), a = IH.affar(id);
    var forra = flyttmeny && flyttmeny.getAttribute('data-id');
    stangFlyttmeny();
    if (!a || forra === id) return;
    flyttmeny = document.createElement('div');
    flyttmeny.className = 'flyttmeny';
    flyttmeny.setAttribute('role', 'menu');
    flyttmeny.setAttribute('data-id', id);
    flyttmeny.innerHTML = '<p>Flytta till</p>' + IH.SALJSTEG.map(function (s) {
      return '<button type="button" role="menuitem" data-g="aff-flytta-till" data-id="' + id + '" data-steg="' + s.id + '" style="--f:' + s.farg + '"' + (s.id === a.steg ? ' disabled aria-current="true"' : '') + '>' +
        '<span class="flyttmeny__prick"></span>' + e(s.namn) + (s.id === a.steg ? '<small>nu</small>' : '') + '</button>';
    }).join('') + '<button type="button" role="menuitem" class="flyttmeny__fara" data-g="aff-flytta-till" data-id="' + id + '" data-steg="forlorad">' + i('stang') + 'Förlorad</button>';
    document.body.appendChild(flyttmeny);
    var r = el.getBoundingClientRect(), b = flyttmeny.offsetWidth, h = flyttmeny.offsetHeight;
    flyttmeny.style.left = Math.max(8, Math.min(window.innerWidth - b - 8, r.right - b)) + 'px';
    flyttmeny.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    var forsta = flyttmeny.querySelector('button:not([disabled])');
    if (forsta) forsta.focus({ preventScroll: true });
    setTimeout(function () { document.addEventListener('pointerdown', utanforFlyttmeny, true); }, 0);
  };
  G['aff-flytta-till'] = function (el) {
    var id = el.getAttribute('data-id'), steg = el.getAttribute('data-steg');
    stangFlyttmeny();
    if (steg === 'forlorad') forloraArk(id); else flyttaAffar(id, steg);
  };
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && flyttmeny) { var id = flyttmeny.getAttribute('data-id'); stangFlyttmeny(); var k = $('.aff[data-aff="' + id + '"] .aff__flytta'); if (k) k.focus(); }
    // "/" söker på säljtavlan, som i Uperformance (Ctrl K fungerar överallt)
    if (ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && /^#\/salj/.test(location.hash) &&
      !(ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable], dialog'))) { ev.preventDefault(); if (IH.oppnaPalett) IH.oppnaPalett(); }
  });
  window.addEventListener('hashchange', stangFlyttmeny);

  function vinn(a, rect) {
    a.steg = 'vunnen';
    a.vunnen = new Date().toISOString();
    a.forlorad = null;
    var o = IH.offertFor(a.id);
    if (o) o.status = 'godkand';
    IH.logga('system', 'Order signerad.', a.kund, a.id);
    // Ett projekt till produktionen.
    if (!db().projekt.some(function (p) { return p.affar === a.id; })) {
      var montage = new Date(); montage.setDate(montage.getDate() + 84);
      db().projekt.push({ id: IH.nyttId('projekt', 'p'), affar: a.id, kund: a.kund, modell: a.modell, steg: 'underlag',
        start: new Date().toISOString(), montage: montage.toISOString(), andrad: new Date().toISOString(),
        check: { ritning: false, lov: false, grund: false, framkomlighet: false } });
    }
    IH.spara();
    IH.ritaOm();
    IH.lysUpp('[data-aff="' + a.id + '"]', 'aff--vann');
    var x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    var y = rect ? rect.top + 30 : window.innerHeight / 3;
    IH.konfetti(x, y);
    IH.toast('Affären är vunnen!', a.titel + ' · ' + IH.kr(a.varde), 'trofe');
    var p = db().projekt.filter(function (q) { return q.affar === a.id; })[0];
    var m = IH.modell(a.modell);
    if (!p) return;
    // Sedan projektet som skapades – och projektvyn öppnas av sig själv
    // om användaren inte hunnit göra något annat under tiden.
    var vantar = true;
    var avbryt = function () { vantar = false; };
    document.addEventListener('pointerdown', avbryt, { once: true });
    setTimeout(function () {
      IH.toast('Projekt skapat', (m ? m.namn + ' · ' : '') + 'montage planerat vecka ' + IH.vecka(new Date(p.montage)) + ' · ligger hos produktionen', 'produktion', { lank: '#/produktion/' + p.id, knapp: 'Öppna' });
    }, IH.lugn ? 0 : 900);
    setTimeout(function () {
      document.removeEventListener('pointerdown', avbryt);
      if (vantar && /^#\/salj/.test(location.hash)) {
        IH.ga('#/produktion/' + p.id);
        IH.lysUpp('.aff--proj[data-id="' + p.id + '"]', 'bytt');
      }
    }, IH.lugn ? 1200 : 2800);
  }

  /* Affärssidan (#/salj/<id>) – samma upplägg som Uperformance: en hjälte med glaskorten (värde, chans att vinna med
     stegets grund som streck, dagar i steget som 14 streck), stegaren, och under den två kolumner – huvudkolumnen i
     lägets ordning med Nästa bästa steg först, sidokolumnen med kunden, uppgifterna och åtgärderna. En accentknapp i
     taget: Nästa bästa steg bär lägets huvudåtgärd. Mobil: en kolumn. */
  function glasRing(p, grund) {
    var R = 22, O = 2 * Math.PI * R, v = (grund / 100) * 360 - 90;
    var x = 26 + R * Math.cos(v * Math.PI / 180), y = 26 + R * Math.sin(v * Math.PI / 180);
    return '<svg class="af-ring' + (p < 35 ? ' af-ring--lag' : '') + '" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="' + R + '" class="af-ring__spar"/>' +
      '<circle cx="26" cy="26" r="' + R + '" class="af-ring__bage" style="stroke-dasharray:' + (O * p / 100).toFixed(1) + ' ' + O.toFixed(1) + '"/>' +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4" class="af-ring__grund"/></svg>';
  }
  function glasDagar(d) {
    var h = '';
    for (var n = 1; n <= 14; n++) h += '<i class="' + (n <= Math.min(d, 14) ? (n >= 10 ? 'varm' : 'pa') : '') + (n % 7 === 0 ? ' hog' : '') + '"></i>';
    return '<span class="af-dagar" aria-hidden="true">' + h + '</span>';
  }
  // Lägets huvudåtgärd: text, förklaring och knappen som gör den.
  function nastaBasta(a, k, o) {
    var d = IH.dagarSedan(a.andrad);
    var tel = k && k.telefon ? ' data-tel="' + e(k.telefon) + '"' : '';
    switch (a.steg) {
      case 'ny': return { ikon: 'samtal', rubrik: 'Ring och boka ett första samtal', text: d ? 'Förfrågan kom för ' + d + (d === 1 ? ' dag' : ' dagar') + ' sedan. Ett snabbt samtal avgör om det blir en affär.' : 'Förfrågan kom i dag – ring medan den är färsk.',
        knapp: '<button class="knapp knapp--virke" type="button" data-g="kund-ring"' + tel + '>' + i('tel') + 'Ring ' + e(forsta(k ? k.namn : '')) + '</button>', andra: '<button class="knapp" type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="kontakt">' + i('bock') + 'Kontakt tagen</button>' };
      case 'kontakt': return { ikon: 'plats', rubrik: 'Boka platsbesök eller tomtkoll', text: 'Se tomten, marken och vägen fram innan offerten. Det är där priset avgörs.',
        knapp: '<button class="knapp knapp--virke" type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="besok">' + i('bock') + 'Platsbesöket är bokat</button>', andra: '<button class="knapp" type="button" data-g="ny-uppgift">' + i('plus') + 'Ny uppgift</button>' };
      case 'besok': return o
        ? { ikon: 'skicka', rubrik: 'Skicka offerten', text: 'Offert ' + e(o.nummer) + ' är klar att skickas. Gå igenom posterna med kunden i kundmötet först om ni ses.',
          knapp: '<button class="knapp knapp--virke" type="button" data-g="offert-skicka" data-id="' + o.id + '">' + i('skicka') + 'Skicka offerten</button>', andra: '<button class="knapp" type="button" data-g="offert-oppna" data-id="' + o.id + '">' + i('offert') + 'Öppna offerten</button>' }
        : { ikon: 'dokument', rubrik: 'Skapa offerten', text: 'Platsbesöket är gjort. Räkna fram priset post för post medan detaljerna är färska.',
          knapp: '<button class="knapp knapp--virke" type="button" data-g="skapa-offert" data-id="' + a.id + '">' + i('plus') + 'Skapa offert</button>', andra: '' };
      case 'offert': return d > 4
        ? { ikon: 'samtal', rubrik: 'Följ upp offerten', text: 'Offerten skickades för ' + d + ' dagar sedan. Hör hur kunden tänker och om något behöver ändras.', varm: true,
          knapp: '<button class="knapp knapp--virke" type="button" data-g="kund-ring"' + tel + '>' + i('tel') + 'Ring ' + e(forsta(k ? k.namn : '')) + '</button>', andra: '<button class="knapp" type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="forhandling">' + i('pil') + 'Till förhandling</button>' }
        : { ikon: 'timglas', rubrik: 'Vänta på svar', text: 'Offerten är skickad. Följ upp om några dagar om kunden inte hört av sig.',
          knapp: '<button class="knapp knapp--virke" type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="forhandling">' + i('pil') + 'Kunden vill gå vidare</button>', andra: o ? '<button class="knapp" type="button" data-g="offert-oppna" data-id="' + o.id + '">' + i('offert') + 'Öppna offerten</button>' : '' };
      case 'forhandling': return { ikon: 'signera', rubrik: 'Stäm av detaljerna och signera', text: 'Gå igenom tillval, leverans och montage. När kunden säger ja blir affären en order och ett projekt hos produktionen.',
        knapp: '<button class="knapp knapp--virke" type="button" data-g="aff-vinn" data-id="' + a.id + '">' + i('trofe') + 'Order signerad</button>', andra: '<button class="knapp" type="button" data-g="starta-mote" data-affar="' + a.id + '">' + i('mote') + 'Kundmöte</button>' };
      default: return null;
    }
  }
  function affarSida(id) {
    var a = IH.affar(id);
    if (!a) return { titel: 'Säljtavla', html: '<a class="tillbaka" href="#/salj">' + i('pilv') + 'Säljtavlan</a>' + tomt('tavla', 'Affären finns inte längre.') };
    var k = IH.kund(a.kund), m = IH.modell(a.modell), o = IH.offertFor(a.id), s = IH.steg(a.steg);
    var idx = IH.SALJSTEG.indexOf(s), r = sannRakna(a), d = IH.dagarSedan(a.andrad);
    var logg = db().aktiviteter.filter(function (h) { return h.affar === a.id; });
    var uppg = db().uppgifter.filter(function (u) { return u.affar === a.id && !u.klar; });
    var proj = db().projekt.filter(function (p) { return p.affar === a.id; })[0];
    var last = !!a.forlorad || a.steg === 'vunnen';
    var nb = last ? null : nastaBasta(a, k, o);
    var glas = function (etikett, varde, matt, extra) {
      return '<div class="af-glas"><small>' + etikett + '</small><div class="af-glas__rad"><b class="tal">' + varde + '</b>' + (matt || '') + '</div>' + (extra ? '<span>' + extra + '</span>' : '') + '</div>';
    };
    var hjalte = '<section class="afhero kort kort--mork" data-in>' +
      '<div class="afhero__text"><p class="etikett etikett--ljus">Affär · ' + e(a.forlorad ? 'Förlorad' : s.namn) + '</p>' +
        '<h1>' + e(a.titel) + '</h1>' +
        '<p class="afhero__rad">' + (k ? '<a href="#/kunder/' + k.id + '">' + kundAvatar(k, true) + e(k.namn) + '</a>' + (k.ort ? '<span>' + i('plats') + e(k.ort) + '</span>' : '') : '') +
          (m ? '<span>' + i('hem') + e(m.kategori + ' · ' + m.namn) + '</span>' : '') + '</p></div>' +
      (m ? '<div class="afhero__bild"><img src="' + m.bild + '" alt="' + e(m.namn) + '" decoding="async"></div>' : '') +
      '<div class="afhero__glas">' +
        glas('Affärsvärde', IH.kort(a.varde), '', IH.kr(a.varde)) +
        (a.forlorad ? glas('Orsak', e(a.forlorad.orsak || 'Förlorad'), '', '')
          : a.steg === 'vunnen' ? glas('Vann', IH.sedan(a.vunnen), i('trofe'), IH.datum(a.vunnen))
          : '<div class="af-glas" title="' + e(r.skal.join('\n')) + '"><small>Chans att vinna</small><div class="af-glas__rad"><b class="tal">' + r.p + ' %</b>' + glasRing(r.p, s.sannolikhet) + '</div><span>strecket = stegets grund ' + s.sannolikhet + ' %</span></div>') +
        (last ? glas('Viktat värde', IH.kort(a.steg === 'vunnen' ? a.varde : 0), '', '')
          : glas('Dagar i steget', String(d), glasDagar(d), d > 14 ? 'står still' : d <= 3 ? 'färsk' : 'i rörelse') +
            glas('Viktat värde', IH.kort(a.varde * r.p / 100), '', r.p + ' % av ' + IH.kort(a.varde))) +
      '</div></section>';
    var stegare = a.forlorad ? '' : '<ol class="stegare af-stegare" data-in>' + IH.SALJSTEG.map(function (st, n) {
      return '<li class="' + (n < idx ? 'klar' : n === idx ? 'nu' : '') + '" style="--f:' + st.farg + '"><button type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="' + st.id + '"' + (n === idx ? ' aria-current="step"' : '') + '><i></i><span>' + e(st.namn) + '</span></button></li>';
    }).join('') + '</ol>';
    var kort = function (namn, ikon, rubrik, inne, extra) {
      return '<section class="af-kort kort" data-af="' + namn + '"' + (extra || '') + '><h2>' + IH.emo(ikon) + rubrik + '</h2>' + inne + '</section>';
    };
    var nasta = nb ? '<section class="af-kort af-nasta kort' + (nb.varm ? ' af-nasta--varm' : '') + '" data-af="nasta"><p class="etikett">Nästa bästa steg</p>' +
      '<div class="af-nasta__rad">' + IH.emo(nb.ikon, 'af-nasta__ikon') + '<div><h2>' + nb.rubrik + '</h2><p>' + nb.text + '</p></div></div>' +
      '<div class="af-nasta__knappar">' + nb.knapp + nb.andra + '</div></section>'
      : a.steg === 'vunnen' ? '<section class="af-kort af-nasta kort" data-af="nasta"><p class="etikett">Vunnen</p><div class="af-nasta__rad">' + IH.emo('medalj', 'af-nasta__ikon') +
        '<div><h2>Huset ligger hos produktionen</h2><p>' + (proj ? 'Montage planerat vecka ' + IH.vecka(new Date(proj.montage)) + '.' : 'Projektet skapas när ordern signeras.') + '</p></div></div>' +
        (proj ? '<div class="af-nasta__knappar"><a class="knapp knapp--virke" href="#/produktion/' + proj.id + '">' + i('produktion') + 'Öppna projektet</a></div>' : '') + '</section>'
      : '<section class="af-kort af-nasta kort" data-af="nasta"><p class="etikett">Förlorad</p><div class="af-nasta__rad">' + IH.emo('minus-cirkel', 'af-nasta__ikon') +
        '<div><h2>Affären är markerad som förlorad</h2><p>' + e(a.forlorad.orsak || '') + '</p></div></div><div class="af-nasta__knappar"><button class="knapp knapp--virke" type="button" data-g="aff-ateruppta" data-id="' + a.id + '">' + i('aterstall') + 'Återuppta affären</button></div></section>';
    var offert = kort('offert', 'dokument', 'Offert', o
      ? '<a class="offertrad af-offert" href="#/offerter/' + o.id + '"><span><b>' + e(o.nummer) + '</b><small>' + o.rader.length + ' rader · ' + (o.status === 'godkand' ? 'godkänd' : o.status === 'skickad' ? 'skickad ' + IH.sedan(o.skapad) : 'utkast') + '</small></span><b class="tal">' + IH.kr(o.rader.reduce(function (t, x) { return t + (x.antal || 0) * (x.pris || 0); }, 0)) + '</b>' + i('pil') + '</a>'
      : '<p class="af-tom">Ingen offert än. ' + (a.steg === 'ny' || a.steg === 'kontakt' ? 'Den skapas oftast efter platsbesöket.' : '') + '</p>' + (last ? '' : '<button class="knapp knapp--liten" type="button" data-g="skapa-offert" data-id="' + a.id + '">' + i('plus') + 'Skapa offert</button>'));
    var hus = m ? kort('hus', 'hem', 'Huset', '<div class="af-hus"><img src="' + m.tumme + '" alt="" loading="lazy" decoding="async"><div><b>' + e(m.namn) + '</b><small>' + e(m.kategori) + (m.yta ? ' · ' + m.yta + ' m²' : '') + '</small><p>' + e(m.text) + '</p></div></div>' +
      '<dl class="af-fakta"><div><dt>Yttermått</dt><dd>' + e(m.matt) + '</dd></div><div><dt>Tak</dt><dd>' + e(m.tak) + '</dd></div><div><dt>Rum</dt><dd>' + (m.rum || '–') + '</dd></div><div><dt>Bygglov</dt><dd>' + (m.lov ? 'Krävs' : m.kategori === 'Attefallshus' ? 'Behövs inte' : '–') + '</dd></div></dl>', ' data-af-svang') : '';
    var historik = kort('historik', 'klocka', 'Historik', anteckningsForm(a.kund, a.id) + tidslinje(logg));
    var kund = k ? kort('kund', 'kunder', 'Kunden', '<a class="af-kund" href="#/kunder/' + k.id + '">' + kundAvatar(k) + '<span><b>' + e(k.namn) + '</b><small>' + (k.typ === 'foretag' ? 'Företag' : 'Privatperson') + (k.ort ? ' · ' + e(k.ort) : '') + '</small></span>' + i('pil') + '</a>' +
      '<div class="af-kontakt">' + (k.telefon ? '<a href="tel:' + e(k.telefon.replace(/\s/g, '')) + '">' + i('tel') + e(k.telefon) + '</a>' : '') + (k.epost ? '<a href="mailto:' + e(k.epost) + '">' + i('post') + e(k.epost) + '</a>' : '') + '</div>') : '';
    var uppgifter = kort('uppgifter', 'todo', 'Att göra', uppg.length ? '<ul class="af-uppg">' + uppg.map(function (u) {
      return '<li><button type="button" class="af-uppg__bock" data-g="uppgift-klar" data-id="' + u.id + '" aria-label="Klar: ' + e(u.text) + '"></button><span><b>' + e(u.text) + '</b><small>' + IH.datum(u.forfaller) + '</small></span></li>';
    }).join('') + '</ul>' : '<p class="af-tom">Inga öppna uppgifter för affären.</p>', ' data-af-svang');
    var atgarder = kort('atgarder', 'blixt', 'Åtgärder', '<div class="af-atgarder">' +
      '<button class="knapp" type="button" data-g="starta-mote" data-affar="' + a.id + '">' + i('mote') + 'Kundmöte</button>' +
      '<button class="knapp" type="button" data-g="ny-uppgift">' + i('plus') + 'Ny uppgift</button>' +
      (a.forlorad ? '' : a.steg !== 'vunnen' ? '<button class="knapp knapp--fara" type="button" data-g="aff-forlora" data-id="' + a.id + '">' + i('stang') + 'Markera som förlorad</button>' : '') + '</div>');
    var html = '<a class="tillbaka" href="#/salj">' + i('pilv') + 'Säljtavlan</a>' + hjalte + stegare +
      '<div class="af-rum"><div class="af-kol">' + nasta + offert + hus + historik + '</div><aside class="af-kol af-sida">' + kund + uppgifter + atgarder + '</aside></div>';
    return { titel: a.titel, html: html, efter: balanseraAffar };
  }

  /* Jämna slut (som balanseraAffar i Uperformance): på dator provas alla placeringar av svängkorten (Huset och
     Att göra) i de två kolumnerna, och den där kolumnerna blir jämnast vinner – det kostar lite att flytta ett kort
     från sin hemkolumn. Sedan sträcks kolumnerna och sista kortet i den kortare växer in i det som blir över, så
     att båda slutar i samma linje. Blir skillnaden ändå stor står sidokolumnen kvar och följer med (klistrad). */
  var AF_FLYTT = 24, AF_FYLLER = 320;
  function balanseraAffar(rot) {
    var rum = $('.af-rum', rot);
    if (!rum) return;
    var kol = $$('.af-kol', rum), huvud = kol[0], sida = kol[1];
    var svang = $$('[data-af-svang]', rum);
    // Hemplatsen minns, så att en ny mätning (t.ex. annan fönsterbredd) börjar från samma läge
    svang.forEach(function (k) { if (!k.dataset.afHem) k.dataset.afHem = k.parentNode === sida ? 'sida' : 'huvud'; });
    rum.removeAttribute('data-af-jamn');
    $$('[data-af-sist]', rum).forEach(function (k) { k.removeAttribute('data-af-sist'); });
    var dator = window.matchMedia('(min-width: 1101px)').matches;
    // Tillbaka till hemplatsen (i den ordning korten står i koden) innan mätningen
    svang.forEach(function (k) {
      var hem = k.dataset.afHem === 'sida' ? sida : huvud;
      if (k.parentNode !== hem) hem.appendChild(k);
    });
    if (!dator) return;
    var hojd = function (k) { return k.getBoundingClientRect().height; };
    var gap = parseFloat(getComputedStyle(huvud).rowGap) || 18;
    var summa = function (lista) { return lista.reduce(function (t, k) { return t + hojd(k); }, 0) + Math.max(0, lista.length - 1) * gap; };
    var fastaH = $$(':scope > :not([data-af-svang])', huvud), fastaS = $$(':scope > :not([data-af-svang])', sida);
    var basta = null;
    for (var n = 0; n < (1 << svang.length); n++) {
      var iH = fastaH.slice(), iS = fastaS.slice(), kostnad = 0;
      svang.forEach(function (k, j) {
        var tillSida = !!(n & (1 << j));
        (tillSida ? iS : iH).push(k);
        if ((tillSida ? 'sida' : 'huvud') !== k.dataset.afHem) kostnad += AF_FLYTT;
      });
      var diff = Math.abs(summa(iH) - summa(iS));
      if (!basta || diff + kostnad < basta.varde) basta = { n: n, varde: diff + kostnad, diff: diff };
    }
    svang.forEach(function (k, j) { (basta.n & (1 << j) ? sida : huvud).appendChild(k); });
    if (basta.diff <= AF_FYLLER) {
      rum.setAttribute('data-af-jamn', '');
      [huvud, sida].forEach(function (c) { var sist = c.lastElementChild; if (sist) sist.setAttribute('data-af-sist', ''); });
    }
  }
  var afStorlek = 0;
  window.addEventListener('resize', function () {
    clearTimeout(afStorlek);
    afStorlek = setTimeout(function () { var r = $('.af-rum'); if (r) balanseraAffar(r.parentNode); }, 150);
  });

  function affArk(id) {
    var a = IH.affar(id);
    if (!a) return;
    var k = IH.kund(a.kund);
    var m = IH.modell(a.modell);
    var o = IH.offertFor(a.id);
    var s = IH.steg(a.steg);
    var idx = IH.SALJSTEG.indexOf(s);
    var logg = db().aktiviteter.filter(function (h) { return h.affar === a.id; });
    var kropp =
      '<div class="affark__topp" data-tilt>' + (m ? '<img src="' + m.bild + '" alt="" decoding="async">' : '') +
        '<div class="affark__glas"><small>' + e(a.forlorad ? 'Förlorad' : s.namn) + '</small><b class="tal">' + IH.kr(a.varde) + '</b><span>' +
        (a.forlorad ? e(a.forlorad.orsak) : a.steg === 'vunnen' ? 'Vann ' + IH.sedan(a.vunnen) : sannolikhet(a) + ' % sannolikhet · viktat ' + IH.kort(a.varde * sannolikhet(a) / 100)) + '</span></div></div>' +
      '<ol class="stegare">' + IH.SALJSTEG.map(function (st, n) {
        return '<li class="' + (n < idx ? 'klar' : n === idx ? 'nu' : '') + '" style="--f:' + st.farg + '"><button type="button" data-g="aff-steg" data-id="' + a.id + '" data-steg="' + st.id + '"' + (a.forlorad ? ' disabled' : '') + '><i></i><span>' + e(st.kort) + '</span></button></li>';
      }).join('') + '</ol>' +
      '<div class="rutnat rutnat--2 affark__fakta">' +
        '<a class="affark__ruta" href="#/kunder/' + (k ? k.id : '') + '">' + kundAvatar(k) + '<span><small>Kund</small><b>' + e(k ? k.namn : '') + '</b><em>' + e(k ? k.ort : '') + '</em></span></a>' +
        '<div class="affark__ruta">' + (m ? '<span class="tumme"><img src="' + m.tumme + '" alt=""></span>' : '') + '<span><small>Modell</small><b>' + e(m ? m.kategori + ' ' + m.namn : '–') + '</b><em>' + (m && m.yta ? m.yta + ' m² · ' + m.rum + ' rum · ' + m.matt : e(m ? m.matt : '')) + '</em></span></div>' +
      '</div>' +
      '<section class="affark__offert"><h3>' + i('offert') + 'Offert</h3>' + (o
        ? '<a class="offertrad" href="#/offerter/' + o.id + '"><span><b>' + e(o.nummer) + '</b><small>' + o.rader.length + ' rader · ' + (o.status === 'godkand' ? 'godkänd' : o.status === 'skickad' ? 'skickad ' + IH.sedan(o.skapad) : 'utkast') + '</small></span><b class="tal">' + IH.kr(IH.summaOffert(o)) + '</b>' + i('pil') + '</a>'
        : '<p class="affark__tom">Ingen offert än.</p><button class="knapp knapp--mork knapp--liten" type="button" data-g="skapa-offert" data-id="' + a.id + '">' + i('plus') + 'Skapa offert</button>') +
      '</section>' +
      '<section class="affark__logg"><h3>' + i('klocka') + 'Historik</h3>' + anteckningsForm(a.kund, a.id) + tidslinje(logg) + '</section>';
    var fot = a.forlorad
      ? '<button class="knapp" type="button" data-g="aff-ateruppta" data-id="' + a.id + '">' + i('aterstall') + 'Återuppta</button>'
      : (a.steg !== 'vunnen' ? '<button class="knapp knapp--fara" type="button" data-g="aff-forlora" data-id="' + a.id + '">Förlorad</button>' : '') +
        '<button class="knapp" type="button" data-g="starta-mote" data-affar="' + a.id + '">' + i('mote') + 'Kundmöte</button>' +
        (a.steg !== 'vunnen' ? '<button class="knapp knapp--virke" type="button" data-g="aff-vinn" data-id="' + a.id + '">' + i('trofe') + 'Vunnen</button>' : '');
    IH.oppnaArk({ titel: a.titel, under: e(k ? k.namn : '') + ' · skapad ' + IH.datum(a.skapad), ikon: 'tavla', kropp: kropp, fot: fot, bred: false,
      efter: function (ark) { IH.efterRitning(ark); } });
  }
  IH.affArk = affArk;

  G['aff-steg'] = function (el) {
    var id = el.getAttribute('data-id');
    var st = el.getAttribute('data-steg');
    IH.stangArk(true);
    flyttaAffar(id, st, el.getBoundingClientRect());
    if (st !== 'vunnen') setTimeout(function () { affArk(id); }, 40);
  };
  G['aff-vinn'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id'));
    var r = el.getBoundingClientRect();
    IH.stangArk(true);
    vinn(a, r);
  };
  G['aff-forlora'] = function (el) { forloraArk(el.getAttribute('data-id')); };
  G['aff-ateruppta'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id'));
    a.forlorad = null;
    a.andrad = new Date().toISOString();
    IH.logga('system', 'Affären återupptogs.', a.kund, a.id);
    IH.spara();
    IH.stangArk(true);
    IH.ritaOm();
    affArk(a.id);
  };
  function forloraArk(id) {
    var a = IH.affar(id);
    IH.oppnaArk({
      titel: 'Markera som förlorad', under: e(a.titel), ikon: 'stang',
      kropp: '<form class="formular" data-form="forlora" id="forlora-form"><input type="hidden" name="id" value="' + a.id + '">' +
        '<p>Varför blev det inte av? Orsaken hjälper när vi ser över priser och erbjudande.</p>' +
        '<div class="valrutor">' + IH.FORLUST.map(function (o, n) {
          return '<label><input type="radio" name="orsak" value="' + e(o) + '"' + (n ? '' : ' checked') + '><span>' + e(o) + '</span></label>';
        }).join('') + '</div>' +
        '<label class="falt"><span>Kommentar</span><textarea name="kommentar" placeholder="Valfritt"></textarea></label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--mork" type="submit" form="forlora-form">Markera som förlorad</button>'
    });
  }
  FORM.forlora = function (f, d) {
    var a = IH.affar(d.get('id'));
    a.forlorad = { orsak: d.get('orsak'), kommentar: d.get('kommentar') || '', tid: new Date().toISOString() };
    a.andrad = new Date().toISOString();
    IH.logga('system', 'Förlorad: ' + d.get('orsak') + (d.get('kommentar') ? ' – ' + d.get('kommentar') : ''), a.kund, a.id);
    IH.spara();
    IH.stangArk();
    IH.ritaOm();
    IH.toast('Markerad som förlorad', a.titel, 'stang');
  };

  /* --- Ny affär (från förfrågan eller fritt) ------------------------------ */
  function affarsForm(start) {
    start = start || {};
    var f = start.forfragan ? IH.forfragan(start.forfragan) : null;
    var modellVal = IH.MODELLER.map(function (m) {
      return '<label class="modellval"><input type="radio" name="modell" value="' + m.id + '"' + (m.id === (start.modell || 'r1') ? ' checked' : '') + '>' +
        '<span><img src="' + m.tumme + '" alt="" loading="lazy"><b>' + e(m.namn) + '</b><small>' + e(m.kategori) + (m.yta ? ' · ' + m.yta + ' m²' : '') + '</small></span></label>';
    }).join('');
    var kundVal = f ? '<input type="hidden" name="forfragan" value="' + f.id + '"><div class="affark__ruta">' + avatar(f.namn, false, kundfarg(f.id)) + '<span><small>Kund</small><b>' + e(f.namn) + '</b><em>' + e(f.ort) + '</em></span></div>'
      : '<label class="falt"><span>Kund</span><select name="kund" required>' + db().kunder.map(function (k) {
        return '<option value="' + k.id + '"' + (k.id === start.kund ? ' selected' : '') + '>' + e(k.namn) + ' · ' + e(k.ort) + '</option>';
      }).join('') + '</select></label>';
    IH.oppnaArk({
      titel: 'Ny affär', under: f ? 'Från förfrågan ' + IH.sedan(f.skapad) : 'Läggs på säljtavlan.', ikon: 'tavla', bred: true,
      kropp: '<form class="formular" data-form="ny-affar" id="ny-affar-form">' + kundVal +
        '<label class="falt"><span>Titel</span><input name="titel" value="' + e(start.titel || '') + '" required autofocus></label>' +
        '<fieldset class="falt"><span>Modell</span><div class="modellrad" data-modellrad>' + modellVal + '</div></fieldset>' +
        '<div class="falt-rad"><label class="falt"><span>Värde (kr)</span><input name="varde" type="number" min="0" step="1000" value="' + (IH.db.prislista.modeller[start.modell || 'r1'] || '') + '" data-varde></label>' +
        '<label class="falt"><span>Steg</span><select name="steg">' + IH.SALJSTEG.filter(function (s) { return s.id !== 'vunnen'; }).map(function (s) {
          return '<option value="' + s.id + '"' + (s.id === (start.steg || 'ny') ? ' selected' : '') + '>' + e(s.namn) + '</option>';
        }).join('') + '</select></label></div>' +
        '<p class="formular__not">' + i('varning') + 'Värdet föreslås ur prislistan under Inställningar (exempelpriser i prototypen).</p></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ny-affar-form">' + i('plus') + 'Skapa affär</button>',
      efter: function (ark) {
        $$('input[name="modell"]', ark).forEach(function (r) {
          r.addEventListener('change', function () {
            var p = IH.db.prislista.modeller[r.value];
            var v = $('[data-varde]', ark);
            if (p) v.value = p;
          });
        });
      }
    });
  }
  G['ny-affar'] = function () { affarsForm({}); };
  FORM['ny-affar'] = function (form, d) {
    var f = d.get('forfragan') ? IH.forfragan(d.get('forfragan')) : null;
    var kund = f ? kundFranForfragan(f) : IH.kund(d.get('kund'));
    var a = { id: IH.nyttId('affar', 'a'), kund: kund.id, titel: d.get('titel'), modell: d.get('modell'), varde: Number(d.get('varde')) || 0,
      steg: d.get('steg'), forlorad: null, skapad: new Date().toISOString(), andrad: new Date().toISOString(), ansvarig: IH.jag().id, vunnen: null };
    db().affarer.push(a);
    if (f) { f.status = 'kvalificerad'; f.kund = kund.id; f.affar = a.id; f.last = true; }
    IH.logga('system', 'Affären skapades' + (f ? ' från förfrågan' : '') + '.', kund.id, a.id);
    IH.spara();
    IH.stangArk(true);
    IH.toast('Affären är skapad', a.titel + ' · ' + IH.kr(a.varde), 'tavla');
    IH.ga('#/salj/' + a.id);
    IH.uppdateraMeny();
  };

  /* ================================================================
     Kunder
     ================================================================ */
  var kundSok = '';
  var kundFilter = 'alla';
  function kundLage(k) {
    var aff = db().affarer.filter(function (a) { return a.kund === k.id; });
    return {
      pagar: aff.some(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }),
      kund: aff.some(function (a) { return a.steg === 'vunnen'; }),
      foretag: k.typ === 'foretag'
    };
  }

  var kundVy = 'kort', kundSort = 'aktiv', kundSortUpp = false, kundSteg = null;

  // Allt om en kund på ett ställe: affärer, resan, värden, senaste
  // aktivitet och vad som behöver uppmärksamhet.
  function kundInfo(k) {
    var aff = db().affarer.filter(function (a) { return a.kund === k.id; });
    var ff = db().forfragningar.filter(function (f) { return f.kund === k.id || f.epost === k.epost; });
    var off = db().offerter.filter(function (o) { return o.kund === k.id && o.status !== 'ersatt'; });
    var proj = db().projekt.filter(function (p) { return p.kund === k.id; });
    var oppen = aff.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; });
    var vunnen = aff.filter(function (a) { return a.steg === 'vunnen'; });
    var senast = db().aktiviteter.filter(function (h) { return h.kund === k.id; }).sort(function (x, y) { return y.tid < x.tid ? -1 : 1; })[0];
    var senasteAff = aff.slice().sort(function (x, y) { return y.andrad < x.andrad ? -1 : 1; })[0];
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var sena = db().uppgifter.filter(function (u) { return u.kund === k.id && !u.klar && new Date(u.forfaller) < idag0; }).length;
    var nyaF = ff.filter(function (f) { return f.status === 'ny'; }).length;
    return {
      k: k, aff: aff, oppen: oppen, vunnen: vunnen, senast: senast, hus: senasteAff ? IH.modell(senasteAff.modell) : null,
      steg: resaSteg(ff, aff, off, proj), oppet: summa(oppen), vunnet: summa(vunnen), sena: sena, nyaF: nyaF,
      varm: nyaF > 0 || sena > 0 || oppen.some(function (a) { return a.steg === 'offert' && IH.dagarSedan(a.andrad) > 4; })
    };
  }

  function kundkort(x) {
    var k = x.k;
    return '<article class="kundkort' + (x.varm ? ' kundkort--varm' : '') + '" data-g="kund-oppna" data-id="' + k.id + '" tabindex="0" role="link" aria-label="' + e(k.namn) + '" data-tilt data-in>' +
      '<span class="kundkort__topp">' + kundAvatar(k) +
        '<span class="kundkort__namn"><b>' + e(k.namn) + '</b><small>' + i('plats') + e(k.ort) + (k.typ === 'foretag' ? ' · företag' : '') + '</small></span>' +
        (x.hus && x.hus.tumme ? '<span class="kundkort__hus" title="' + e(x.hus.namn) + '"><img src="' + x.hus.tumme + '" alt="" loading="lazy" decoding="async"></span>' : '') + '</span>' +
      (x.nyaF ? '<span class="kundkort__flagga"><i></i>' + x.nyaF + (x.nyaF === 1 ? ' ny förfrågan' : ' nya förfrågningar') + '</span>' :
        x.sena ? '<span class="kundkort__flagga kundkort__flagga--sen">' + i('varning') + (x.sena === 1 ? 'Försenad uppföljning' : x.sena + ' försenade uppföljningar') + '</span>' : '') +
      '<span class="kundkort__resa" title="' + (x.steg < 0 ? 'Ingen kontakt än' : RESA_STEG[x.steg][1]) + '">' + RESA_STEG.map(function (st, n) {
        return '<i class="' + (n < x.steg ? 'klar' : n === x.steg ? 'nu' : '') + '"></i>';
      }).join('') + '<small>' + (x.steg < 0 ? 'Ingen kontakt' : RESA_EMOJI[x.steg] + ' ' + RESA_STEG[x.steg][1]) + '</small></span>' +
      '<span class="kundkort__tal"><span' + (x.oppet ? '' : ' class="noll"') + '><small><svg class="emo-ik" aria-hidden="true"><use href="#i-portfolj"/></svg> Öppet</small><b class="tal">' + (x.oppet ? IH.kort(x.oppet) : '–') + '</b></span>' +
        '<span' + (x.vunnet ? ' class="vunnet"' : ' class="noll"') + '><small><svg class="emo-ik" aria-hidden="true"><use href="#i-medalj"/></svg> Vunnet</small><b class="tal">' + (x.vunnet ? IH.kort(x.vunnet) : '–') + '</b></span></span>' +
      '<span class="kundkort__fot"><span>' + (x.senast ? i('klocka') + IH.sedan(x.senast.tid) : 'Ingen aktivitet') + '</span>' +
        (x.vunnen.length ? '<span class="status" style="--s:#7fe0a6">Kund</span>' : x.oppen.length ? '<span class="status" style="--s:#f0b56e">Affär pågår</span>' : '') + '</span>' +
      '<span class="kundkort__snabb">' +
        (k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring">' + i('tel') + '</button>' : '') +
        (k.epost ? '<button type="button" data-g="kund-mejl" data-epost="' + e(k.epost) + '" title="Mejla">' + i('post') + '</button>' : '') +
        '<button type="button" data-g="starta-mote" data-kund="' + k.id + '" title="Kundmöte">' + i('mote') + '</button>' +
        '<button type="button" data-g="ny-affar-kund" data-id="' + k.id + '" title="Ny affär">' + i('plus') + '</button>' +
      '</span></article>';
  }

  // Kundhälsa 0–100 ur senaste kontakt, öppna affärer, köp och försenade uppgifter (samma på listan och kundsidan)
  function kundHalsa(x) {
    var d = x.senast ? IH.dagarSedan(x.senast.tid) : null;
    return Math.round(Math.max(0, Math.min(100, (d == null ? 30 : d <= 3 ? 100 : d <= 7 ? 85 : d <= 14 ? 65 : d <= 30 ? 45 : 25) - x.sena * 15 + (x.oppen.length ? 5 : 0) + (x.vunnen.length ? 10 : 0))));
  }
  var RESA_FARG = ['#b8cde0', '#9fc2c9', '#e8c98f', '#7fe0a6', '#f0b56e', '#7fe0a6'];
  var kundValda = {};
  function varfor(x) { return x.nyaF ? (x.nyaF === 1 ? 'Ny förfrågan' : x.nyaF + ' nya förfrågningar') : x.sena ? (x.sena === 1 ? 'Försenad uppföljning' : x.sena + ' försenade uppföljningar') : x.varm ? 'Följ upp offerten' : ''; }
  function kundrad(x) {
    var k = x.k, h = kundHalsa(x), ton = h >= 75 ? 'gron' : h >= 50 ? 'gul' : 'rod', vald = !!kundValda[k.id];
    return '<tr data-g="kund-oppna" data-id="' + k.id + '" class="' + (vald ? 'vald' : '') + (x.varm ? ' varm' : '') + '">' +
      '<td class="kl__val"><button type="button" class="kl__kryss" role="checkbox" aria-checked="' + vald + '" data-g="kund-valj" data-id="' + k.id + '" aria-label="Välj ' + e(k.namn) + '">' + i('bock') + '</button></td>' +
      '<td><span class="tabell__kund">' + kundAvatar(k, true) + '<span><b>' + e(k.namn) + '</b><small>' + e(k.ort) + (k.typ === 'foretag' ? ' · <em class="kl__typ">Företag</em>' : '') + '</small></span></span></td>' +
      '<td>' + (x.hus && x.hus.tumme ? '<span class="tabell__hus"><img src="' + x.hus.tumme + '" alt="" loading="lazy"><span><b>' + e(x.hus.namn) + '</b><small>' + e(x.hus.kategori || '') + '</small></span></span>' : '<span class="tid">–</span>') + '</td>' +
      '<td>' + (x.steg < 0 ? '<span class="tid">Ingen kontakt</span>' : '<span class="kl__resa" title="På resan: ' + RESA_STEG.map(function (st, n) { return (n < x.steg ? '✓ ' : n === x.steg ? '● ' : '') + st[1]; }).join(' → ') + '"><span class="kl__prickar" style="--s:' + RESA_FARG[x.steg] + '">' + RESA_STEG.map(function (st, n) { return '<i class="' + (n < x.steg ? 'klar' : n === x.steg ? 'nu' : '') + '"></i>'; }).join('') + '</span><b>' + RESA_STEG[x.steg][1] + '</b></span>') + '</td>' +
      '<td class="tal">' + (x.oppet ? IH.kr(x.oppet) : '<span class="tid">–</span>') + '</td><td class="tal kl__vunnet">' + (x.vunnet ? IH.kr(x.vunnet) : '<span class="tid">–</span>') + '</td>' +
      '<td><span class="kl__halsa" data-ton="' + ton + '" style="--a:' + (h / 100).toFixed(2) + '" title="Kundhälsa ' + h + ': ' + (h >= 75 ? 'varm relation' : h >= 50 ? 'håll kontakten' : 'behöver kontakt') + '"><i></i>' + h + '</span></td>' +
      '<td class="tid"><span class="kl__senast">' + (x.senast ? IH.sedan(x.senast.tid) : 'Ingen aktivitet') + (x.varm ? '<em title="' + e(varfor(x)) + '"><i class="prick"></i>' + e(varfor(x)) + '</em>' : '') + '</span></td>' +
      '<td class="kl__snabb">' + (k.telefon ? '<a href="tel:' + e(k.telefon.replace(/\s/g, '')) + '" title="Ring ' + e(k.telefon) + '" aria-label="Ring">' + i('tel') + '</a>' : '') + (k.epost ? '<a href="mailto:' + e(k.epost) + '" title="Mejla ' + e(k.epost) + '" aria-label="Mejla">' + i('post') + '</a>' : '') + '<span class="kl__pil" aria-hidden="true">' + i('pil') + '</span></td></tr>';
  }
  var KL_KOL = [['namn', 'Kund'], [null, 'Hus'], ['steg', 'På resan'], ['oppet', 'Öppet'], ['vunnet', 'Vunnet'], ['halsa', 'Hälsa'], ['aktiv', 'Senast']];
  function kundTabell(lista) {
    var valda = lista.filter(function (x) { return kundValda[x.k.id]; }).length, alla = valda && valda === lista.length;
    var sum = function (f) { return lista.reduce(function (t, x) { return t + x[f]; }, 0); };
    return '<section class="kort kl" data-in>' +
      (valda ? '<div class="kl__bulk"><b>' + valda + ' valda</b><button type="button" class="knapp knapp--liten" data-g="kund-bulk-mejl">' + i('post') + 'Mejla</button><button type="button" class="knapp knapp--liten" data-g="kund-bulk-uppg">' + i('uppgift') + 'Ny uppgift</button><button type="button" class="knapp knapp--liten" data-g="kund-bulk-csv">' + i('skrivut') + 'Exportera CSV</button><button type="button" class="kl__avmarkera" data-g="kund-valj-alla" data-av="1">Avmarkera' + i('stang') + '</button></div>' : '') +
      '<table class="tabell tabell--kunder kl__tabell"><thead><tr><th class="kl__val"><button type="button" class="kl__kryss" role="checkbox" aria-checked="' + (alla ? 'true' : valda ? 'mixed' : 'false') + '" data-g="kund-valj-alla" aria-label="Välj alla">' + i('bock') + '</button></th>' +
      KL_KOL.map(function (c) { if (!c[0]) return '<th>' + c[1] + '</th>'; var akt = kundSort === c[0]; return '<th' + (akt ? ' aria-sort="' + (kundSortUpp ? 'ascending' : 'descending') + '"' : '') + '><button type="button" class="kl__sort' + (akt ? ' akt' : '') + '" data-g="kund-sort-kol" data-k="' + c[0] + '">' + c[1] + '<i>' + (akt ? (kundSortUpp ? '↑' : '↓') : '↕') + '</i></button></th>'; }).join('') + '<th></th></tr></thead>' +
      '<tbody data-stagger>' + lista.map(kundrad).join('') + '</tbody>' +
      '<tfoot><tr><td></td><td colspan="3">' + lista.length + ' kunder</td><td class="tal">' + IH.kr(sum('oppet')) + '</td><td class="tal">' + IH.kr(sum('vunnet')) + '</td><td colspan="3"></td></tr></tfoot></table></section>';
  }

  IH.vyer.kunder = function (del) {
    if (del[0]) return kundSida(del[0]);
    var alla = db().kunder.map(kundInfo);
    var FILTER = [['alla', 'Alla'], ['pagar', 'Affär pågår'], ['kund', 'Kunder'], ['foretag', 'Företag'], ['varm', 'Behöver uppmärksamhet']];
    var passar = function (x, f) {
      return f === 'alla' || (f === 'pagar' && x.oppen.length) || (f === 'kund' && x.vunnen.length) || (f === 'foretag' && x.k.typ === 'foretag') || (f === 'varm' && x.varm);
    };
    var antal = {};
    FILTER.forEach(function (f) { antal[f[0]] = alla.filter(function (x) { return passar(x, f[0]); }).length; });
    var perSteg = RESA_STEG.map(function (st, n) { return alla.filter(function (x) { return x.steg === n; }).length; });
    var maxSteg = Math.max.apply(null, perSteg.concat([1]));
    var senasteKund = alla.slice().sort(function (x, y) { return y.k.skapad < x.k.skapad ? -1 : 1; })[0];
    var foretag = alla.filter(function (x) { return x.k.typ === 'foretag'; }).length;
    var varma = alla.filter(function (x) { return x.varm; });

    var lista = alla.filter(function (x) {
      return passar(x, kundFilter) && (kundSteg === null || x.steg === kundSteg) &&
        (!kundSok || (x.k.namn + ' ' + x.k.ort).toLowerCase().indexOf(kundSok.toLowerCase()) >= 0);
    }).sort(function (x, y) {
      var r, namn = x.k.namn.localeCompare(y.k.namn, 'sv');
      if (kundSort === 'namn') r = namn;
      else if (kundSort === 'varde') r = (y.oppet + y.vunnet) - (x.oppet + x.vunnet) || namn;
      else if (kundSort === 'oppet') r = y.oppet - x.oppet || namn;
      else if (kundSort === 'vunnet') r = y.vunnet - x.vunnet || namn;
      else if (kundSort === 'steg') r = y.steg - x.steg || namn;
      else if (kundSort === 'halsa') r = kundHalsa(x) - kundHalsa(y) || namn;
      else { var tx = x.senast ? x.senast.tid : '', ty = y.senast ? y.senast.tid : ''; r = ty < tx ? -1 : ty > tx ? 1 : namn; }
      return kundSortUpp ? -r : r;
    });

    var html = '<h1 class="dold">Kunder</h1>' +

      '<section class="kundtopp kort kort--mork" data-in>' +
        '<div class="kundtopp__ord">' +
          '<p class="etikett etikett--ljus">Kundbasen</p>' +
          '<p class="kundtopp__stort"><b class="tal" data-rakna="' + alla.length + '">' + alla.length + '</b><span>kunder<small>' + (senasteKund ? 'senast ' + e(forsta(senasteKund.k.namn)) + ' · ' + IH.datum(senasteKund.k.skapad) : 'inga kunder än') + '</small></span></p>' +
          '<div class="kundtopp__tal">' +
            '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-portfolj"/></svg></i>Affär pågår</small><b class="tal" data-rakna="' + antal.pagar + '">' + antal.pagar + '</b></div>' +
            '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg></i>Har köpt hus</small><b class="tal" data-rakna="' + antal.kund + '">' + antal.kund + '</b></div>' +
            '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-byggnad"/></svg></i>Företag</small><b class="tal" data-rakna="' + foretag + '">' + foretag + '</b></div>' +
            (function () { var ny30 = alla.filter(function (x) { return x.k.skapad && IH.dagarSedan(x.k.skapad) < 30; }).length; return '<div class="kt-ny"><small><i aria-hidden="true">' + i('plus') + '</i>Nya 30 d</small><b class="tal">' + ny30 + '</b></div>'; })() +
          '</div>' +
          '<div class="kundtopp__typ"><span class="kallbar"><i style="flex:' + (alla.length - foretag) + ';--k:#f0b56e;--n:0"></i><i style="flex:' + Math.max(foretag, 0.001) + ';--k:#9fc2c9;--n:1"></i></span>' +
            '<span class="kallbar__lista"><span style="--k:#f0b56e"><i></i>Privatpersoner<b>' + (alla.length - foretag) + '</b></span><span style="--k:#9fc2c9"><i></i>Företag<b>' + foretag + '</b></span></span></div>' +
          // Behöver uppmärksamhet: vem och varför, de tre första.
          (varma.length ? '<div class="kundtopp__varma"><small><svg class="emo-ik" aria-hidden="true"><use href="#i-bjallra"/></svg> Behöver uppmärksamhet</small><div class="varmlista">' + varma.slice(0, 3).map(function (x) {
              var skal = x.nyaF ? ['<svg class="emo-ik" aria-hidden="true"><use href="#i-gnista"/></svg>', x.nyaF === 1 ? 'Ny förfrågan' : x.nyaF + ' nya förfrågningar']
                : x.sena ? ['⏰', x.sena === 1 ? 'Försenad uppföljning' : x.sena + ' försenade uppföljningar'] : ['<svg class="emo-ik" aria-hidden="true"><use href="#i-skicka"/></svg>', 'Följ upp offerten'];
              return '<div class="varmrad varmrad--rad">' + '<button type="button" class="varmrad__oppna" data-g="kund-oppna" data-id="' + x.k.id + '">' + kundAvatar(x.k, true) +
                '<span><b>' + e(x.k.namn) + '</b><em>' + skal[0] + ' ' + skal[1] + '</em></span></button>' +
                '<span class="varmrad__snabb">' + (x.k.telefon ? '<a href="tel:' + e(x.k.telefon.replace(/\s/g, '')) + '" title="Ring ' + e(x.k.telefon) + '" aria-label="Ring">' + i('tel') + '</a>' : '') + (x.k.epost ? '<a href="mailto:' + e(x.k.epost) + '" title="Mejla ' + e(x.k.epost) + '" aria-label="Mejla">' + i('post') + '</a>' : '') +
                '<button type="button" data-g="kund-oppna" data-id="' + x.k.id + '" aria-label="Öppna kunden">' + i('pil') + '</button></span></div>';
            }).join('') + (varma.length > 3 ? '<button type="button" class="varmrad varmrad--fler" data-g="kund-filter" data-f="varm">+' + (varma.length - 3) + ' till · visa alla</button>' : '') + '</div></div>' : '') +
        '</div>' +
        '<div class="kundtopp__resa"><div class="toppverktyg"><label class="sok sok--liten">' + i('sok') + '<input type="search" placeholder="Sök namn eller ort…" value="' + e(kundSok) + '" data-kundsok aria-label="Sök kund"></label>' +
          '<button class="tv-ikon kt-export" type="button" data-g="kund-export-alla" title="Exportera alla kunder som CSV">' + i('skrivut') + '</button><button class="knapp knapp--mork" type="button" data-g="ny-kund">' + i('plus') + 'Ny kund</button></div><div class="kundtopp__resahuvud"><p class="etikett etikett--ljus">Var på resan?</p><small>' + (kundSteg === null ? 'Klicka på ett steg för att filtrera' : 'Visar ' + RESA_STEG[kundSteg][1].toLowerCase()) + '</small></div>' +
          '<div class="resakol">' + RESA_STEG.map(function (st, n) {
            return '<button type="button" class="resakol__steg' + (kundSteg === n ? ' vald' : '') + '" data-g="kund-steg" data-n="' + n + '" style="--n:' + n + ';--a:' + (perSteg[n] / maxSteg).toFixed(2) + '" aria-pressed="' + (kundSteg === n) + '">' +
              '<b>' + perSteg[n] + '</b><span class="resakol__andel">' + (alla.length ? Math.round(perSteg[n] / alla.length * 100) : 0) + ' %</span><i class="resakol__stapel"></i>' +
              '<span class="resakol__vilka">' + alla.filter(function (x) { return x.steg === n; }).slice(0, 3).map(function (x) { return kundAvatar(x.k, true); }).join('') + '</span>' +
              '<span class="resakol__ikon resakol__ikon--emoji" aria-hidden="true">' + RESA_EMOJI[n] + '</span><small>' + st[1] + '</small></button>';
          }).join('') + '</div></div>' +
      '</section>' +

      '<div class="kundverktyg">' +
        '<div class="flikar flikar--filter" data-flikar role="toolbar" aria-label="Filter">' + FILTER.map(function (f) {
          return '<button type="button" data-g="kund-filter" data-f="' + f[0] + '" aria-pressed="' + (kundFilter === f[0]) + '"><i class="flik__emoji" aria-hidden="true">' + KUND_FILTER_EMOJI[f[0]] + '</i>' + f[1] + '<b>' + antal[f[0]] + '</b></button>';
        }).join('') + '</div>' +
        (kundSteg !== null ? '<button class="chip chip--rensa" type="button" data-g="kund-steg" data-n="' + kundSteg + '">' + RESA_STEG[kundSteg][1] + i('stang') + '</button>' : '') +
        '<div class="kundverktyg__hoger"><label class="kundsort">' + i('lista') + '<select data-kundsort aria-label="Sortera">' +
          [['aktiv', 'Senast aktiv'], ['namn', 'Namn A–Ö'], ['varde', 'Störst värde'], ['halsa', 'Behöver kontakt först']].map(function (o) { return '<option value="' + o[0] + '"' + (kundSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="flikar flikar--vy" data-flikar2><button type="button" data-g="kund-vy" data-vy="kort" aria-pressed="' + (kundVy === 'kort') + '" title="Kort">' + i('kub') + '</button>' +
          '<button type="button" data-g="kund-vy" data-vy="lista" aria-pressed="' + (kundVy === 'lista') + '" title="Lista">' + i('lista') + '</button></div></div>' +
      '</div>' +

      (lista.length ? (kundVy === 'lista'
        ? kundTabell(lista)
        : '<div class="kundnat">' + lista.map(kundkort).join('') + '</div>')
        : (kundSok ? tomt('kunder', 'Ingen kund matchar ”' + e(kundSok) + '”. Prova namn eller ort.', { text: 'Rensa sökningen', g: 'kund-sok-rensa', ikon: 'stang' })
          : kundSteg !== null ? tomt('kunder', 'Ingen kund står i ' + e(RESA_STEG[kundSteg]) + ' just nu.', { text: 'Visa alla kunder', g: 'kund-steg', attr: 'data-n="' + kundSteg + '"', ikon: 'kunder' })
          : tomt('kunder', 'Inga kunder ännu. En kund skapas när en förfrågan blir affär – eller direkt här.', { text: 'Lägg till kund', g: 'ny-kund' })));

    return {
      titel: 'Kunder', html: html,
      efter: function (rot) {
        glidFlikar($('[data-flikar]', rot));
        glidFlikar($('[data-flikar2]', rot));
        var s = $('[data-kundsok]', rot);
        if (s) {
          s.addEventListener('input', function () {
            kundSok = s.value;
            var pos = s.selectionStart;
            IH.rita();
            var n = $('[data-kundsok]');
            if (n) { n.focus(); n.setSelectionRange(pos, pos); }
          });
        }
        var so = $('[data-kundsort]', rot);
        if (so) so.addEventListener('change', function () { kundSort = so.value; kundSortUpp = false; IH.rita(); });
        rot.addEventListener('keydown', function (ev) {
          var kort = ev.target.closest && ev.target.closest('.kundkort');
          if (kort && ev.target === kort && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); IH.ga('#/kunder/' + kort.getAttribute('data-id')); }
        });
      }
    };
  };
  G['kund-oppna'] = function (el) { IH.ga('#/kunder/' + el.getAttribute('data-id')); };
  G['kund-ring'] = function (el) { location.href = 'tel:' + el.getAttribute('data-tel').replace(/\s/g, ''); };
  G['kund-mejl'] = function (el) { location.href = 'mailto:' + el.getAttribute('data-epost'); };
  G['kund-vy'] = function (el) { kundVy = el.getAttribute('data-vy'); IH.rita(); };
  G['kund-export-alla'] = function () { kundValda = {}; db().kunder.forEach(function (k) { kundValda[k.id] = true; }); G['kund-bulk-csv'](); kundValda = {}; };
  G['kund-sort-kol'] = function (el) { var k = el.getAttribute('data-k'); if (kundSort === k) kundSortUpp = !kundSortUpp; else { kundSort = k; kundSortUpp = false; } IH.rita(); };
  G['kund-valj'] = function (el) { var id = el.getAttribute('data-id'); if (kundValda[id]) delete kundValda[id]; else kundValda[id] = true; IH.rita(); };
  G['kund-valj-alla'] = function (el) {
    var synliga = $$('.kl__tabell tbody tr[data-id]').map(function (r) { return r.getAttribute('data-id'); });
    var allaValda = synliga.length && synliga.every(function (id) { return kundValda[id]; });
    if (el.getAttribute('data-av') || allaValda) kundValda = {}; else synliga.forEach(function (id) { kundValda[id] = true; });
    IH.rita();
  };
  var valdaKunder = function () { return Object.keys(kundValda).map(IH.kund).filter(Boolean); };
  G['kund-bulk-mejl'] = function () {
    var l = valdaKunder().filter(function (k) { return k.epost; }); if (!l.length) { IH.toast('Ingen e-post', 'De valda kunderna saknar e-postadress.', 'post'); return; }
    location.href = 'mailto:?bcc=' + l.map(function (k) { return encodeURIComponent(k.epost); }).join(',');
  };
  G['kund-bulk-csv'] = function () {
    var esc = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rader = [['Namn', 'Typ', 'Ort', 'Telefon', 'E-post', 'På resan', 'Öppet (kr)', 'Vunnet (kr)', 'Senaste kontakt']].concat(valdaKunder().map(function (k) { var x = kundInfo(k); return [k.namn, k.typ === 'foretag' ? 'Företag' : 'Privat', k.ort, k.telefon, k.epost, x.steg < 0 ? 'Ingen kontakt' : RESA_STEG[x.steg][1], x.oppet, x.vunnet, x.senast ? IH.datum(x.senast.tid) : '']; }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rader.map(function (r) { return r.map(esc).join(';'); }).join('\r\n')], { type: 'text/csv' }));
    a.download = 'kunder-' + IH.dagStr() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Exporterat', rader.length - 1 + ' kunder till CSV.', 'skrivut');
  };
  G['kund-bulk-uppg'] = function () {
    var l = valdaKunder(), imorgon = new Date(Date.now() + 864e5);
    IH.oppnaArk({ titel: 'Ny uppgift för ' + l.length + ' kunder', ikon: 'uppgift', under: e(l.map(function (k) { return forsta(k.namn); }).join(', ')),
      kropp: '<form class="formular" data-form="kund-bulk-uppg" id="kund-bulk-form"><label class="falt"><span>Vad ska göras?</span><input name="text" required autofocus placeholder="T.ex. Ring och följ upp"></label>' +
        '<label class="falt"><span>Klart senast</span><input name="datum" type="date" value="' + IH.dagStr(imorgon) + '"></label><p class="kund-tom">Kundens namn läggs till sist i varje uppgift.</p></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="kund-bulk-form">' + i('plus') + 'Lägg till ' + l.length + '</button>' });
  };
  FORM['kund-bulk-uppg'] = function (f, d) {
    var l = valdaKunder(), text = String(d.get('text') || '').trim(); if (!text) return;
    l.forEach(function (k) { db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text + ' – ' + k.namn, forfaller: new Date((d.get('datum') || IH.dagStr()) + 'T09:00:00').toISOString(), klar: false, kund: k.id, affar: null, ansvarig: IH.jag().id }); });
    kundValda = {}; IH.spara(); IH.stangArk(true); IH.uppdateraMeny(); IH.rita();
    IH.toast('Uppgifterna är lagda', l.length + ' uppgifter under Att göra.', 'uppgift');
  };
  G['kund-sok-rensa'] = function () { kundSok = ''; IH.rita(); };
  G['off-sok-rensa'] = function () { offSok = ''; IH.rita(); };
  G['kund-steg'] = function (el) { var n = Number(el.getAttribute('data-n')); kundSteg = kundSteg === n ? null : n; IH.rita(); };

  // Var kunden är på resan: Förfrågan → Affär → Offert → Order → Montage → Nyckel.
  var RESA_STEG = [['inkorg', 'Förfrågan'], ['tavla', 'Affär'], ['offert', 'Offert'], ['trofe', 'Order'], ['produktion', 'Montage'], ['hus', 'Nyckel']];
  var RESA_EMOJI = ['<svg class="emo-ik" aria-hidden="true"><use href="#i-inkorg"/></svg>', '<svg class="emo-ik" aria-hidden="true"><use href="#i-portfolj"/></svg>', '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>', '<svg class="emo-ik" aria-hidden="true"><use href="#i-signera"/></svg>', '<svg class="emo-ik" aria-hidden="true"><use href="#i-projekt"/></svg>', '<svg class="emo-ik" aria-hidden="true"><use href="#i-nyckel"/></svg>'];
  var KUND_FILTER_EMOJI = { alla: '<svg class="emo-ik" aria-hidden="true"><use href="#i-kunder"/></svg>', pagar: '<svg class="emo-ik" aria-hidden="true"><use href="#i-portfolj"/></svg>', kund: '<svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg>', foretag: '<svg class="emo-ik" aria-hidden="true"><use href="#i-byggnad"/></svg>', varm: '<svg class="emo-ik" aria-hidden="true"><use href="#i-bjallra"/></svg>' };
  function resaSteg(ff, aff, off, proj) {
    var nu = -1;
    if (ff.length) nu = 0;
    if (aff.length) nu = Math.max(nu, 1);
    if (off.length || aff.some(function (a) { return a.steg === 'offert' || a.steg === 'forhandling'; })) nu = Math.max(nu, 2);
    if (aff.some(function (a) { return a.steg === 'vunnen'; })) nu = Math.max(nu, 3);
    if (proj.some(function (p) { return p.steg === 'montage' || p.steg === 'besiktning'; })) nu = Math.max(nu, 4);
    if (proj.some(function (p) { return p.steg === 'klart'; })) nu = 5;
    return nu;
  }
  function kundresa(ff, aff, off, proj) {
    var STEG = RESA_STEG;
    var nu = resaSteg(ff, aff, off, proj);
    var vad = nu < 0 ? 'Ingen kontakt än' : nu === 5 ? 'Huset är överlämnat' : 'Nu: ' + STEG[nu][1].toLowerCase() + ' · nästa ' + STEG[nu + 1][1].toLowerCase();
    return '<section class="kundresa kort" data-in style="--nu:' + Math.max(0, nu) + '"><div class="kundresa__huvud"><p class="etikett">Kundresan</p><small>' + e(vad) + '</small></div>' +
      '<div class="kundresa__rad"><ol class="kundresa__steg">' + STEG.map(function (st, n) {
        return '<li class="' + (n < nu ? 'klar' : n === nu ? 'nu' : '') + '" style="--n:' + n + '"><span>' + i(n < nu ? 'bock' : st[0]) + '</span><b>' + st[1] + '</b></li>';
      }).join('') + '</ol><i class="kundresa__spar"><i></i></i></div></section>';
  }

  function kundSida(id) {
    var k = IH.kund(id);
    if (!k) return { titel: 'Kunder', html: '<a class="tillbaka" href="#/kunder">' + i('pilv') + 'Alla kunder</a>' + tomt('kunder', 'Kunden finns inte.') };
    var aff = db().affarer.filter(function (a) { return a.kund === k.id; });
    var off = db().offerter.filter(function (o) { return o.kund === k.id && o.status !== 'ersatt'; });
    var ff = db().forfragningar.filter(function (f) { return f.kund === k.id || f.epost === k.epost; });
    var proj = db().projekt.filter(function (p) { return p.kund === k.id; });
    var logg = db().aktiviteter.filter(function (h) { return h.kund === k.id; });
    var uppg = db().uppgifter.filter(function (u) { return u.kund === k.id && !u.klar; });
    // Kundhälsa 0–100: hur nyligen ni pratade, om något är öppet och om något är försenat
    var info = kundInfo(k), senast = info.senast, dSen = senast ? IH.dagarSedan(senast.tid) : null;
    var halsa = kundHalsa(info);
    var halsaText = halsa >= 75 ? 'Varm relation' : halsa >= 50 ? 'Håll kontakten' : 'Behöver kontakt';
    var halsaTon = halsa >= 75 ? 'gron' : halsa >= 50 ? 'gul' : 'rod';
    var n90 = function (typ) { return logg.filter(function (h) { return h.typ === typ && IH.dagarSedan(h.tid) < 90; }).length; };
    // smart nästa steg, ur det som faktiskt finns hos kunden
    var nasta = (function () {
      var sen = uppg.filter(function (u) { return new Date(u.forfaller) < new Date(new Date().setHours(0, 0, 0, 0)); })[0];
      if (sen) return { ikon: 'larm', text: 'Försenad uppgift: ' + sen.text, under: 'Skulle vara klar ' + IH.datum(sen.forfaller), knapp: 'Markera klar', g: 'kund-uppg-klar', id: sen.id, varm: true };
      var nyF = ff.filter(function (f) { return f.status === 'ny'; })[0];
      if (nyF) return { ikon: 'inkorg', text: 'Svara på förfrågan om ' + nyF.hustyp.toLowerCase(), under: 'Kom in ' + IH.sedan(nyF.skapad), knapp: 'Öppna', href: '#/forfragningar/' + nyF.id, varm: true };
      var offS = off.filter(function (o) { return o.status === 'skickad'; }).sort(function (x, y) { return x.skapad < y.skapad ? -1 : 1; })[0];
      if (offS && IH.dagarSedan(offS.skapad) > 3) return { ikon: 'samtal', text: 'Följ upp offert ' + offS.nummer, under: 'Skickad för ' + IH.dagarSedan(offS.skapad) + ' dagar sedan · ' + Math.max(0, (offS.giltig || 30) - IH.dagarSedan(offS.skapad)) + ' dagar kvar', knapp: 'Ring ' + forsta(k.namn), g: 'kund-ring', tel: k.telefon };
      var utanOff = info.oppen.filter(function (a2) { return (a2.steg === 'besok' || a2.steg === 'kontakt') && !off.some(function (o) { return o.affar === a2.id; }); })[0];
      if (utanOff) return { ikon: 'offert', text: 'Ta fram offert för ' + utanOff.titel, under: 'Affären är i ' + IH.steg(utanOff.steg).namn.toLowerCase(), knapp: 'Öppna affären', g: 'aff-oppna', id: utanOff.id };
      var p2 = proj.filter(function (x) { return x.steg !== 'klart'; })[0];
      if (p2) return { ikon: 'produktion', text: 'Projektet: ' + IH.projsteg(p2.steg).namn.toLowerCase(), under: 'Montage v. ' + IH.vecka(new Date(p2.montage)), knapp: 'Öppna projektet', g: 'proj-oppna', id: p2.id };
      if (dSen == null || dSen > 14) return { ikon: 'samtal', text: 'Hör av dig till ' + forsta(k.namn), under: dSen == null ? 'Ingen kontakt loggad ännu' : 'Senaste kontakten för ' + dSen + ' dagar sedan', knapp: 'Ring', g: 'kund-ring', tel: k.telefon };
      return { ikon: 'bock', text: 'Allt är i fas', under: 'Senaste kontakten ' + IH.sedan(senast.tid), knapp: 'Logga kontakt', g: 'kund-logga' };
    })();
    var nastaKnapp = nasta.href ? '<a class="knapp knapp--virke" href="' + nasta.href + '">' + nasta.knapp + i('pil') + '</a>' :
      '<button class="knapp knapp--virke" type="button" data-g="' + nasta.g + '"' + (nasta.id ? ' data-id="' + nasta.id + '"' : '') + (nasta.tel ? ' data-tel="' + e(nasta.tel) + '"' : '') + '>' + nasta.knapp + i('pil') + '</button>';
    var stegIx = function (a2) { var ix = IH.SALJSTEG.findIndex(function (x) { return x.id === a2.steg; }); return Math.max(0, ix); };
    var histTyp = kundHist[k.id] || 'alla', loggVisa = logg.filter(function (h) { return histTyp === 'alla' || h.typ === histTyp; });
    var husNu = info.hus;
    var html = '<a class="tillbaka" href="#/kunder">' + i('pilv') + 'Alla kunder</a>' +
      '<section class="kh kort" data-in>' +
        '<i class="kh__glod" aria-hidden="true"></i>' +
        '<div class="kh__vem">' + kundAvatar(k) + '<div>' +
          '<p class="etikett">' + (k.typ === 'foretag' ? 'Företag' : 'Privatperson') + ' · kund sedan ' + IH.datum(k.skapad, true) + '</p><h1>' + e(k.namn) + '</h1>' +
          '<div class="kh__kontakt">' + (k.ort ? '<span class="kh__chip">' + i('plats') + e(k.ort) + '</span>' : '') +
            (k.telefon ? '<a class="kh__chip" href="tel:' + e(k.telefon.replace(/\s/g, '')) + '">' + i('tel') + e(k.telefon) + '</a><button type="button" class="kh__kopiera" data-g="kund-kopiera" data-text="' + e(k.telefon) + '" title="Kopiera telefonnumret">' + i('kopiera') + '</button>' : '') +
            (k.epost ? '<a class="kh__chip" href="mailto:' + e(k.epost) + '">' + i('post') + e(k.epost) + '</a><button type="button" class="kh__kopiera" data-g="kund-kopiera" data-text="' + e(k.epost) + '" title="Kopiera e-postadressen">' + i('kopiera') + '</button>' : '') + '</div>' +
          '<div class="kh__knappar"><button class="knapp knapp--virke" type="button" data-g="ny-affar-kund" data-id="' + k.id + '">' + i('plus') + 'Ny affär</button>' +
            '<button class="knapp" type="button" data-g="kund-logga" title="Logga ett samtal, mejl eller möte">' + i('samtal') + 'Logga kontakt</button>' +
            '<button class="knapp" type="button" data-g="kund-uppgift" data-id="' + k.id + '">' + i('uppgift') + 'Ny uppgift</button>' +
            '<button class="knapp" type="button" data-g="starta-mote" data-kund="' + k.id + '">' + i('mote') + 'Kundmöte</button></div>' +
        '</div></div>' +
        '<div class="kh__halsa" data-ton="' + halsaTon + '" style="--a:' + (halsa / 100).toFixed(2) + '" title="Kundhälsa: räknas ur senaste kontakten, öppna affärer, köp och försenade uppgifter">' +
          '<i class="kh__aura" aria-hidden="true"></i><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="kh-g-' + k.id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="kh__s1"/><stop offset="1" class="kh__s2"/></linearGradient></defs>' +
            '<circle class="kh__spar" cx="50" cy="50" r="42"/><circle class="kh__glod" cx="50" cy="50" r="42" pathLength="100" stroke="url(#kh-g-' + k.id + ')"/><circle class="kh__bage" cx="50" cy="50" r="42" pathLength="100" stroke="url(#kh-g-' + k.id + ')"/><circle class="kh__komet" cx="50" cy="50" r="42" pathLength="100"/></svg>' +
          '<span><b>' + halsa + '</b><small>' + halsaText + '</small></span></div>' +
        '<div class="kh__tal">' +
          '<div title="Öppna affärer: ' + info.oppen.length + ' st"><small>Öppet värde</small><b class="tal">' + IH.kort(info.oppet) + '</b><em>' + info.oppen.length + ' öppna</em></div>' +
          '<div><small>Vunnet</small><b class="tal">' + IH.kort(info.vunnet) + '</b><em>' + info.vunnen.length + ' order</em></div>' +
          '<div><small>Senaste kontakt</small><b>' + (dSen == null ? '–' : dSen === 0 ? 'I dag' : dSen + ' d') + '</b><em>' + (senast ? e(AKT_NAMN_K[senast.typ] || 'Aktivitet') : 'ingen än') + '</em></div>' +
        '</div>' +
      '</section>' +
      kundresa(ff, aff, off, proj) +
      '<section class="kn kort" data-in data-varm="' + (nasta.varm ? 'ja' : 'nej') + '"><span class="kn__ikon">' + i(nasta.ikon) + '</span><div><small>Nästa steg</small><b>' + e(nasta.text) + '</b><em>' + e(nasta.under) + '</em></div>' + nastaKnapp + '</section>' +
      '<div class="kg">' +
        '<div class="kg__vanster">' +
          (husNu ? '<section class="kort khus" data-in><img src="' + husNu.bild + '" alt="' + e(husNu.namn) + '" loading="lazy"><div><small>Huset ' + e(forsta(k.namn)) + ' tittar på</small><b>' + e(husNu.namn) + '</b><em>' + e([husNu.kategori, husNu.yta ? husNu.yta + ' m²' : '', husNu.matt].filter(Boolean).join(' · ')) + '</em></div></section>' : '') +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('tavla') + '</span>Affärer <em class="rakna">' + aff.length + '</em></h2><button class="knapp knapp--liten" type="button" data-g="ny-affar-kund" data-id="' + k.id + '">' + i('plus') + 'Ny</button></header><div class="ka" data-stagger>' +
            (aff.length ? aff.map(function (a2) {
              var st = IH.steg(a2.steg), m = IH.modell(a2.modell), ix = stegIx(a2), max = IH.SALJSTEG.length - 1;
              return '<button class="ka__rad" type="button" data-g="aff-oppna" data-id="' + a2.id + '" title="' + e(a2.titel) + ': ' + e(st.namn) + ' · ' + IH.kr(a2.varde) + ' · ändrad ' + IH.sedan(a2.andrad) + '">' + (m ? tumme(m.tumme) : '') +
                '<span class="ka__text"><b>' + e(a2.titel) + '</b><small>' + IH.kr(a2.varde) + ' · ' + (a2.steg === 'vunnen' ? 'vann ' + IH.sedan(a2.vunnen) : IH.dagarSedan(a2.andrad) + ' d i steget') + '</small>' +
                '<span class="ka__steg" style="--f:' + st.farg + '">' + IH.SALJSTEG.map(function (x, n) { return '<i class="' + (n <= ix ? 'pa' : '') + '"></i>'; }).join('') + '</span></span>' +
                (a2.forlorad ? statusChip('#a39b8e', 'Förlorad') : statusChip(st.farg, st.namn)) + '</button>';
            }).join('') : tomt('tavla', 'Inga affärer med ' + e(forsta(k.namn)) + ' ännu. En affär följer huset från första samtal till order.', { text: 'Ny affär', g: 'ny-affar-kund', id: k.id })) + '</div></section>' +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('offert') + '</span>Offerter <em class="rakna">' + off.length + '</em></h2></header><div class="lista" data-stagger>' +
            (off.length ? off.map(function (o) {
              var kvar = (o.giltig || 30) - IH.dagarSedan(o.skapad), st2 = o.status === 'godkand' ? ['#7fe0a6', 'Godkänd'] : o.status === 'skickad' ? (kvar <= 0 ? ['#a39b8e', 'Gått ut'] : ['#f0b56e', kvar + ' d kvar']) : ['#b8cde0', 'Utkast'];
              return '<a class="lista__rad" href="#/offerter/' + o.id + '" title="Offert ' + e(o.nummer) + ': skapad ' + IH.datum(o.skapad) + ' · giltig ' + (o.giltig || 30) + ' dagar">' + i('offert') + '<span class="lista__text"><b>' + e(o.nummer) + '</b><small>' + IH.datum(o.skapad) + ' · ' + IH.kr(IH.summaOffert(o)) + '</small></span>' + statusChip(st2[0], st2[1]) + '</a>';
            }).join('') : tomt('offert', aff.length ? 'Inga offerter ännu – de skapas från affären när ni vet vilket hus det blir.' : 'Inga offerter ännu. Offerter skapas från en affär.', aff.length ? null : { text: 'Ny affär', g: 'ny-affar-kund', id: k.id })) + '</div></section>' +
          (proj.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('produktion') + '</span>Projekt</h2></header><div class="lista" data-stagger>' + proj.map(function (p2) {
            var st3 = IH.projsteg(p2.steg), m = IH.modell(p2.modell);
            return '<button class="lista__rad" type="button" data-g="proj-oppna" data-id="' + p2.id + '">' + (m ? tumme(m.tumme) : '') + '<span class="lista__text"><b>' + e(m ? m.namn : '') + '</b><small>Montage v. ' + IH.vecka(new Date(p2.montage)) + '</small></span>' + statusChip(st3.farg, st3.namn) + '</button>';
          }).join('') + '</div></section>' : '') +
          (ff.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('inkorg') + '</span>Förfrågningar</h2></header><div class="lista" data-stagger>' + ff.map(function (f) {
            return '<a class="lista__rad" href="#/forfragningar/' + f.id + '">' + tumme(IH.MILJO[f.miljo]) + '<span class="lista__text"><b>' + e(f.hustyp) + ' · ' + e(f.anvandning) + '</b><small>' + e(f.beskrivning) + '</small></span><span class="tid">' + IH.sedan(f.skapad) + '</span></a>';
          }).join('') + '</div></section>' : '') +
        '</div>' +
        '<div class="kg__hoger">' +
          '<section class="kort kkontakt" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('graf') + '</span>Kontakt 90 dagar</h2></header><div class="kkontakt__tal">' +
            [['samtal', 'Samtal', 'samtal'], ['mejl', 'Mejl', 'post'], ['mote', 'Möten', 'motesikon'], ['notis', 'Anteckningar', 'anteckning']].map(function (t) { return '<button type="button" data-g="kund-hist" data-id="' + k.id + '" data-typ="' + t[0] + '" aria-pressed="' + (histTyp === t[0]) + '" title="Visa bara ' + t[1].toLowerCase() + ' i historiken">' + i(t[2]) + '<b>' + n90(t[0]) + '</b><small>' + t[1] + '</small></button>'; }).join('') + '</div></section>' +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('uppgift') + '</span>Uppgifter <em class="rakna">' + uppg.length + '</em></h2><button class="knapp knapp--liten" type="button" data-g="kund-uppgift" data-id="' + k.id + '">' + i('plus') + 'Ny</button></header><div class="kort__kropp">' +
            (uppg.length ? '<ul class="uppglista" data-stagger>' + uppg.map(uppgiftRad).join('') + '</ul>' : '<p class="kund-tom">Inga öppna uppgifter för ' + e(forsta(k.namn)) + '.</p>') + '</div></section>' +
          '<section class="kort" data-in id="kund-historik"><header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Historik <em class="rakna">' + logg.length + '</em></h2>' +
            (histTyp !== 'alla' ? '<button class="knapp knapp--liten" type="button" data-g="kund-hist" data-id="' + k.id + '" data-typ="alla">Visa allt' + i('stang') + '</button>' : '') + '</header><div class="kort__kropp">' +
            anteckningsForm(k.id, '') + tidslinje(loggVisa, histTyp === 'alla' ? null : 'Inga ' + (AKT_NAMN_K[histTyp] || '').toLowerCase() + ' loggade ännu.') + '</div></section>' +
        '</div>' +
      '</div>';
    return { titel: k.namn, html: html, efter: function (yta) {
      // kundhälsan räknar upp i takt med att ringen ritas
      var tal = yta.querySelector('.kh__halsa b'); if (!tal || IH.lugn) return;
      var mal = +tal.textContent, t0 = performance.now() + 150;
      var steg = function (nu) { var p2 = Math.min(1, Math.max(0, (nu - t0) / 1400)); tal.textContent = Math.round(mal * (1 - Math.pow(1 - p2, 3))); if (p2 < 1) requestAnimationFrame(steg); };
      requestAnimationFrame(steg);
    } };
  }
  var kundHist = {}, AKT_NAMN_K = { samtal: 'Samtal', mejl: 'Mejl', mote: 'Möte', notis: 'Anteckning', system: 'System' };
  G['kund-hist'] = function (el) { var id = el.getAttribute('data-id'), t = el.getAttribute('data-typ'); kundHist[id] = kundHist[id] === t ? 'alla' : t; IH.rita(); };
  G['kund-kopiera'] = function (el) {
    var t = el.getAttribute('data-text'), klar = function () { IH.toast('Kopierat', t, 'kopiera'); };
    try { navigator.clipboard.writeText(t).then(klar, klar); } catch (x) { klar(); }
  };
  G['kund-logga'] = function () { var f = $('#kund-historik .anteckna input[name="text"]'); if (f) { f.scrollIntoView({ behavior: IH.lugn ? 'auto' : 'smooth', block: 'center' }); var r = $('#kund-historik .anteckna input[value="samtal"]'); if (r) r.checked = true; setTimeout(function () { f.focus(); }, 300); } };
  G['kund-uppgift'] = function (el) {
    var id = el.getAttribute('data-id'), k = IH.kund(id), imorgon = new Date(Date.now() + 864e5);
    IH.oppnaArk({ titel: 'Ny uppgift', under: k ? 'För ' + e(k.namn) : '', ikon: 'uppgift',
      kropp: '<form class="formular" data-form="uppgift" id="kund-uppg-form"><input type="hidden" name="kund" value="' + id + '">' +
        '<label class="falt"><span>Vad ska göras?</span><input name="text" required autofocus placeholder="T.ex. Skicka tomtkartan"></label>' +
        '<label class="falt"><span>Klart senast</span><input name="datum" type="date" value="' + IH.dagStr(imorgon) + '"></label>' +
        '<div class="snabbval">' + [['I dag', 0], ['I morgon', 1], ['Om 3 dagar', 3], ['Nästa vecka', 7]].map(function (v) { return '<button type="button" class="ap-filter" data-g="kund-uppg-dag" data-d="' + v[1] + '">' + v[0] + '</button>'; }).join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="kund-uppg-form">' + i('plus') + 'Lägg till</button>' });
  };
  G['kund-uppg-klar'] = function (el) { var u = db().uppgifter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!u) return; u.klar = true; IH.spara(); IH.uppdateraMeny(); IH.rita(); IH.toast('Klart!', u.text, 'bock'); };
  G['kund-uppg-dag'] = function (el) { var f = el.closest('form'); if (f) f.datum.value = IH.dagStr(new Date(Date.now() + (+el.getAttribute('data-d')) * 864e5)); };

  /* ================================================================
     Dokument & avtal (#/dokument) – som Uperformance dokumentarkiv: offerter, ordrar, underlag (ritningar,
     bygglov och kundens förberedelser per projekt) och uppladdade filer, samlade och sökbara på ett ställe.
     Allt räknas ur datan; uppladdade filer sparas bara som namn, storlek och typ (prototyp).
     ================================================================ */
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var dokUi = { fack: 'alla', lage: 'aktuella', sok: '', sort: 'senast', vem: 'alla', grupp: 'typ', flik: 'arkiv', ar: 'alla' };
  var DOK_FACK = [
    { id: 'offert', namn: 'Offerter', ikon: 'offert', ton: '#f0b56e' },
    { id: 'order', namn: 'Ordrar', ikon: 'trofe', ton: '#7fe0a6' },
    { id: 'avtal', namn: 'Avtal', ikon: 'skriv', ton: '#e8c98f' },
    { id: 'ritning', namn: 'Ritningar', ikon: 'linjal', ton: '#9cc3ea' },
    { id: 'bygglov', namn: 'Bygglov', ikon: 'anteckning', ton: '#b8a6ea' },
    { id: 'faktura', namn: 'Fakturor', ikon: 'kalkyl', ton: '#f2a39a' },
    { id: 'underlag', namn: 'Checklistor', ikon: 'bock', ton: '#9fc2c9' },
    { id: 'besiktning', namn: 'Besiktning', ikon: 'sok', ton: '#8fd1c1' },
    { id: 'foto', namn: 'Foton', ikon: 'kamera', ton: '#f6c68d' },
    { id: 'ovrigt', namn: 'Övrigt', ikon: 'gem', ton: '#c9c4bb' }
  ];
  // Kategorier man kan välja för en fil (offert och order skapas annars i CRM:et men kan också laddas upp)
  var DOK_VALBARA = ['ritning', 'avtal', 'bygglov', 'faktura', 'besiktning', 'foto', 'offert', 'order', 'ovrigt'];
  function gissaKat(namn, typ) {
    var n = String(namn || '').toLowerCase();
    if (/faktura|invoice|kvitto|betalning/.test(n)) return 'faktura';
    if (/bygglov|anm[aä]lan|startbesked|kontrollplan|slutbesked/.test(n)) return 'bygglov';
    if (/ritning|planritning|fasad|sektion|situationsplan|\.dwg$|\.dxf$/.test(n)) return 'ritning';
    if (/avtal|kontrakt|villkor|fullmakt/.test(n)) return 'avtal';
    if (/besikt|protokoll|egenkontroll/.test(n)) return 'besiktning';
    if (/offert/.test(n)) return 'offert';
    if (/order/.test(n)) return 'order';
    if (/^image\//.test(typ || '') || /\.(jpe?g|png|heic|webp)$/.test(n)) return 'foto';
    return 'ovrigt';
  }
  // Filerna själva sparas i webbläsarens databas (IndexedDB) så att de alltid finns kvar och kan öppnas igen
  var dokDb = function () { return new Promise(function (ok, fel) { try { var r = indexedDB.open('ih-crm-filer', 1); r.onupgradeneeded = function () { r.result.createObjectStore('filer'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { fel(r.error); }; } catch (x) { fel(x); } }); };
  var dokSparaBlob = function (id, blob) { return dokDb().then(function (d) { return new Promise(function (ok, fel) { var t = d.transaction('filer', 'readwrite'); t.objectStore('filer').put(blob, id); t.oncomplete = ok; t.onerror = function () { fel(t.error); }; }); }); };
  var dokHamtaBlob = function (id) { return dokDb().then(function (d) { return new Promise(function (ok, fel) { var r = d.transaction('filer').objectStore('filer').get(id); r.onsuccess = function () { ok(r.result || null); }; r.onerror = function () { fel(r.error); }; }); }); };
  var DOK_LAGEN = [['aktuella', 'Aktuella'], ['vantar', 'Väntar på svar'], ['klara', 'Klara'], ['utgangna', 'Utgångna'], ['arkiv', 'Arkiverade'], ['alla', 'Alla']];
  var UNDERLAG_NAMN = { ritning: 'Ritningar', lov: 'Bygglov eller anmälan', grund: 'Grund och anslutningar', framkomlighet: 'Väg för lastbil och kran' };
  // Legohus egna byggbilder (images/foto) – samlade under Foton så att de är lätta att hitta och skicka
  var BILDBANK = [['dronare-bygget', 'Drönarbild över bygget'], ['dronare-kran', 'Kranlyft från ovan'], ['dronare-leverans', 'Leverans till tomten'], ['dronare-montage', 'Montage från ovan'], ['dronare-platta', 'Platta och grund från ovan'],
    ['dronare-vaggblock', 'Väggblock på plats'], ['lyft-stommar', 'Stommar lyfts på plats'], ['montor-vaggelement', 'Montör med väggelement'], ['arbetare-vattenpass', 'Montör med vattenpass'], ['reglar', 'Reglar i fabriken'], ['stommar-stapel', 'Staplade stommar']];
  function dokPoster() {
    var ut = [];
    db().offerter.filter(function (o) { return o.status !== 'ersatt'; }).forEach(function (o) {
      var x = offInfo(o), st = o.status === 'godkand' ? ['Godkänd', 'gron', 'klar'] : x.utgangen ? ['Gått ut', 'gra', 'utgangen'] : o.status === 'skickad' ? (x.snart ? ['Går ut om ' + x.kvar + ' d', 'gul', 'vantar'] : ['Väntar på svar', 'bla', 'vantar']) : ['Utkast', 'gra', 'aktuell'];
      ut.push({ ansv: x.a ? x.a.ansvarig : null, id: o.id, fack: 'offert', namn: 'Offert ' + o.nummer, under: x.m ? x.m.kategori + ' ' + x.m.namn : '', k: x.k, varde: x.summa, vardeText: 'offererat', datum: o.skapad,
        datumUnder: o.status === 'skickad' && !x.utgangen ? 'gäller ' + Math.max(0, x.kvar) + ' d till' : '', status: st, href: '#/offerter/' + o.id, kvar: x.kvar, o: o });
      if (o.status === 'godkand' && x.a && x.a.steg === 'vunnen') ut.push({ ansv: x.a.ansvarig, o: o, a: x.a, id: 'ord-' + o.id, fack: 'order', namn: 'Order ' + o.nummer, under: x.a.titel, k: x.k, varde: x.summa, vardeText: 'ordervärde', datum: x.a.vunnen || o.skapad,
        datumUnder: x.dagarTillJa != null ? 'ja efter ' + x.dagarTillJa + ' d' : '', status: ['Signerad', 'gron', 'klar'], g: 'aff-oppna', gid: x.a.id });
    });
    db().projekt.forEach(function (p) {
      var k = IH.kund(p.kund), m = IH.modell(p.modell), t = p.montage ? dagarTill(p.montage) : null;
      CHECK.forEach(function (c) {
        var klar = !!p.check[c[0]];
        var pa = IH.affar(p.affar);
        ut.push({ ansv: pa ? pa.ansvarig : null, id: p.id + '-' + c[0], fack: c[0] === 'ritning' ? 'ritning' : c[0] === 'lov' ? 'bygglov' : 'underlag', namn: UNDERLAG_NAMN[c[0]] || c[1], under: (m ? m.namn : 'Huset') + ' · ' + (c[0] === 'ritning' ? 'vår del' : 'kundens del'), k: k, varde: null, datum: p.andrad || p.start,
          datumUnder: t != null ? (t >= 0 ? 'montage om ' + t + ' d' : 'montage passerat') : '', status: klar ? ['Klart', 'gron', 'klar'] : t != null && t <= 21 ? ['Saknas · bråttom', 'rod', 'vantar'] : ['Saknas', 'gul', 'vantar'], g: 'proj-oppna', gid: p.id, check: c[0], pid: p.id });
      });
    });
    (db().dokument || []).forEach(function (d) {
      var kat = d.kat || gissaKat(d.namn, d.typ), pr = d.projekt ? db().projekt.find(function (x) { return x.id === d.projekt; }) : null, m = pr ? IH.modell(pr.modell) : null;
      ut.push({ ansv: d.av, id: d.id, fack: kat, namn: d.namn, under: [(d.ext || 'fil').toUpperCase(), Math.max(1, Math.round(d.storlek / 1024)) + ' kB', m ? m.namn : ''].filter(Boolean).join(' · '), ext: d.ext, k: d.kund ? IH.kund(d.kund) : null, varde: null, datum: d.tid,
        datumUnder: (IH.anvandare(d.av) || { namn: '' }).namn.split(' ')[0], status: d.arkiv ? ['Arkiverad', 'gra', 'arkiv'] : ['Uppladdad', 'gra', 'klar'], fil: d });
    });
    BILDBANK.forEach(function (x, n) {
      ut.push({ ansv: null, id: 'foto-' + n, fack: 'foto', namn: x[1], under: 'Bildbanken · byggbild från Legohus', ext: 'webp', k: null, varde: null, datum: null, datumUnder: '', status: ['Bildbank', 'gra', 'klar'], foto: '../images/foto/' + x[0] + '.webp' });
    });
    var c = db().chatt;
    ((c && c.meddelanden) || []).forEach(function (msg) {
      if (msg.borttagen || !msg.filer) return;
      msg.filer.forEach(function (f, n) {
        var kanal = (c.kanaler || []).find(function (x) { return x.id === msg.kanal; }), ext = (String(f.namn).split('.').pop() || '').toLowerCase();
        ut.push({ ansv: msg.av, id: 'ch-' + msg.id + '-' + n, fack: gissaKat(f.namn, f.typ), namn: f.namn, under: ext.toUpperCase() + ' · från chatten' + (kanal && kanal.namn ? ' · ' + kanal.namn : ''), ext: ext, k: null, varde: null, datum: msg.tid,
          datumUnder: (IH.anvandare(msg.av) || { namn: '' }).namn.split(' ')[0], status: ['I chatten', 'bla', 'klar'], chatt: f });
      });
    });
    return ut;
  }
  function dokPassar(p, opt) {
    opt = opt || {}; var fack = opt.fack != null ? opt.fack : dokUi.fack, lage = opt.lage != null ? opt.lage : dokUi.lage, sok = opt.sok != null ? opt.sok : dokUi.sok;
    if (fack !== 'alla' && p.fack !== fack) return false;
    if (dokUi.vem === 'mina' && p.ansv !== IH.jag().id) return false;
    var l = p.status[2];
    if (lage === 'aktuella' && (l === 'utgangen' || l === 'arkiv')) return false;
    if (lage === 'arkiv' && l !== 'arkiv') return false;
    if (dokUi.ar !== 'alla' && (!p.datum || String(new Date(p.datum).getFullYear()) !== dokUi.ar)) return false;
    if (lage === 'vantar' && l !== 'vantar') return false;
    if (lage === 'klara' && l !== 'klar') return false;
    if (lage === 'utgangna' && l !== 'utgangen') return false;
    if (sok) { var ff = DOK_FACK.find(function (x) { return x.id === p.fack; }), hay = (p.namn + ' ' + p.under + ' ' + (p.k ? p.k.namn + ' ' + p.k.ort : '') + ' ' + p.status[0] + ' ' + (ff ? ff.namn : '') + ' ' + (p.datum ? IH.datum(p.datum, true) : '')).toLowerCase();
      if (!sok.toLowerCase().split(/\s+/).filter(Boolean).every(function (q) { return hay.indexOf(q) >= 0; })) return false; }
    return true;
  }
  var dokSortera = function (l) {
    return l.sort(function (a, b) {
      if (dokUi.sort === 'kund') return (a.k ? a.k.namn : 'ö').localeCompare(b.k ? b.k.namn : 'ö', 'sv');
      if (dokUi.sort === 'varde') return (b.varde || 0) - (a.varde || 0);
      if (dokUi.sort === 'utgar') return (a.kvar == null ? 999 : a.kvar) - (b.kvar == null ? 999 : b.kvar);
      return new Date(b.datum || 0) - new Date(a.datum || 0);
    });
  };
  function dokRad(p) {
    var f = DOK_FACK.find(function (x) { return x.id === p.fack; });
    var arFil = p.fil || p.chatt;
    var ikon = p.foto ? '<span class="dk__ikon dk__ikon--bild" style="--t:' + f.ton + '"><img src="' + e(p.foto) + '" alt="" loading="lazy"></span>' : arFil ? '<span class="dk__ikon dk__ikon--fil" style="--t:' + f.ton + '">' + e((p.ext || 'fil').slice(0, 4).toUpperCase()) + '</span>' : '<span class="dk__ikon" style="--t:' + f.ton + '">' + i(f.ikon) + '</span>';
    var attr = p.foto ? 'data-g="dok-foto" data-src="' + e(p.foto) + '" data-namn="' + e(p.namn) + '"' : arFil ? 'data-g="dok-fil" data-id="' + p.id + '"' : 'data-g="dok-detalj" data-id="' + p.id + '"';
    return '<li class="dk__rad" ' + attr + ' tabindex="0" role="button">' + ikon +
      '<span class="dk__namn"><b>' + e(p.namn) + '</b><small>' + e(p.under) + '</small></span>' +
      '<span class="dk__kund">' + (p.k ? kundAvatar(p.k, true) + '<span><b>' + e(p.k.namn) + '</b><small>' + e(p.k.ort || '') + '</small></span>' : '<span class="tid">–</span>') + '</span>' +
      '<span class="dk__status"><span class="dk__chip" data-ton="' + p.status[1] + '"><i></i>' + e(p.status[0]) + '</span>' +
        (p.check && p.status[2] !== 'klar' ? '<button type="button" class="dk__bocka" data-g="prod-check" data-id="' + p.pid + '" data-c="' + p.check + '" title="Markera som klart">' + i('bock') + 'Klart</button>' : '') + '</span>' +
      '<span class="dk__varde">' + (p.varde ? '<b>' + IH.kr(p.varde) + '</b><small>' + e(p.vardeText) + '</small>' : '<span class="tid">–</span>') + '</span>' +
      '<span class="dk__datum"><b>' + (p.datum ? IH.datum(p.datum) : '–') + '</b><small>' + e(p.datumUnder || '') + '</small></span></li>';
  }
  function dokAtt(poster) {
    var ut = [];
    poster.forEach(function (p) {
      if (p.fack === 'offert' && p.status[2] === 'vantar' && p.o) {
        var dagar = IH.dagarSedan(p.o.skapad);
        if (p.kvar <= 7) ut.push({ vikt: 0, ikon: 'klocka', ton: 'rod', rubrik: 'Offerten ' + p.o.nummer + ' går ut om ' + Math.max(0, p.kvar) + ' d', text: (p.k ? p.k.namn : '') + ' har inte svarat. Ring eller förläng giltigheten.', knappar: [['dok-forlang', 'Förläng 14 d', 'kalender', p.o.id], p.k && p.k.telefon ? ['kund-ring', 'Ring ' + forsta(p.k.namn), 'tel', p.k.telefon] : null] });
        else if (dagar >= 5) ut.push({ vikt: 1, ikon: 'samtal', ton: 'bla', rubrik: 'Inget svar på offerten ' + p.o.nummer, text: (p.k ? p.k.namn : '') + ' fick den för ' + dagar + ' dagar sedan.', knappar: [p.k && p.k.telefon ? ['kund-ring', 'Ring ' + forsta(p.k.namn), 'tel', p.k.telefon] : null] });
      }
      if (p.check && p.status[1] === 'rod') ut.push({ vikt: 0, ikon: 'varning', ton: 'gul', rubrik: p.namn + ' saknas', text: (p.k ? p.k.namn : '') + ' · ' + p.under + ' · ' + p.datumUnder + '.', knappar: [['prod-check', 'Markera klart', 'bock', p.pid, p.check], ['proj-oppna', 'Öppna projektet', 'pil', p.pid]] });
    });
    return ut.sort(function (a, b) { return a.vikt - b.vikt; });
  }
  IH.vyer.dokument = function () {
    var alla = dokPoster();
    var iLage = alla.filter(function (p) { return dokPassar(p, { fack: 'alla', sok: '' }); });
    var lista = dokSortera(alla.filter(function (p) { return dokPassar(p); }));
    var off = alla.filter(function (p) { return p.fack === 'offert'; }), vantar = off.filter(function (p) { return p.status[2] === 'vantar'; });
    var godk = off.filter(function (p) { return p.o && p.o.status === 'godkand'; }), snart = vantar.filter(function (p) { return p.kvar <= 7; });
    var svarstider = godk.map(function (p) { var a = IH.affar(p.o.affar); return a && a.vunnen ? Math.max(0, Math.round((new Date(a.vunnen) - new Date(p.o.skapad)) / 864e5)) : null; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    var median = svarstider.length ? svarstider[Math.floor(svarstider.length / 2)] : null;
    var sum = function (l) { return l.reduce(function (t, p) { return t + (p.varde || 0); }, 0); };
    var att = dokAtt(alla);
    var stat = function (ikon, etikett, tal, under, ton, lage) { return '<button type="button" class="dk-stat" data-ton="' + ton + '" data-g="dok-lage" data-l="' + lage + '" title="Visa ' + etikett.toLowerCase().replace('&amp;', 'och') + '"><small><span class="dk-stat__ik">' + i(ikon) + '</span>' + etikett + '</small><b data-dok-rakna="' + tal + '">' + tal + '</b><em>' + under + '</em></button>'; };
    var fackUnder = function (f) {
      var l = alla.filter(function (p) { return p.fack === f.id; });
      if (f.id === 'offert') return [vantar.length + ' väntar', godk.length + ' godkända'].join(' · ');
      if (f.id === 'order') return l.length ? IH.kort(sum(l)) + ' i ordervärde' : 'Inga ännu';
      if (f.id === 'underlag' || l.some(function (p) { return p.check; })) { var s = l.filter(function (p) { return p.check && p.status[2] !== 'klar'; }).length, filer = l.filter(function (p) { return !p.check; }).length; return (s ? s + ' saknas · ' : '') + l.filter(function (p) { return p.check && p.status[2] === 'klar'; }).length + ' klara' + (filer ? ' · ' + plural(filer, 'fil', 'filer') : ''); }
      if (f.id === 'foto') { var bb = l.filter(function (p) { return p.foto; }).length; return (l.length - bb ? plural(l.length - bb, 'egen bild', 'egna bilder') + ' · ' : '') + bb + ' i bildbanken'; }
      if (!l.length) return 'Inga ännu · släpp en fil här';
      return l.length ? plural(l.length, 'fil', 'filer') + ' · senast ' + IH.sedan(l.sort(function (a, b) { return new Date(b.datum) - new Date(a.datum); })[0].datum) : 'Inga ännu';
    };
    var grupper;
    if (dokUi.grupp === 'kund') {
      var perK = {}; lista.forEach(function (p) { var id = p.k ? p.k.id : '–'; (perK[id] = perK[id] || []).push(p); });
      grupper = Object.keys(perK).map(function (id) { var k = IH.kund(id); return { f: { id: 'k-' + id, namn: k ? k.namn : 'Utan kund', ikon: 'kunder', ton: '#e8c98f' }, under: plural(perK[id].length, 'dokument', 'dokument') + (k ? ' · ' + e(k.ort || '') : ''), l: perK[id] }; })
        .sort(function (a, b) { return a.f.namn.localeCompare(b.f.namn, 'sv'); });
    } else if (dokUi.grupp === 'ingen' || dokUi.fack !== 'alla') grupper = lista.length ? [{ f: dokUi.fack !== 'alla' ? DOK_FACK.find(function (x) { return x.id === dokUi.fack; }) : { id: 'alla', namn: 'Alla dokument', ikon: 'mapp', ton: '#e8c98f' }, l: lista }] : [];
    else grupper = DOK_FACK.map(function (f) { return { f: f, l: lista.filter(function (p) { return p.fack === f.id; }) }; }).filter(function (g) { return g.l.length; });
    var html = '<h1 class="dold">Dokument</h1>' +
      '<section class="dk-hjalte kort kort--mork" data-in data-uppladdning data-flik="' + dokUi.flik + '"><i class="dk-hjalte__glod" aria-hidden="true"></i>' +
        '<div class="dk-hjalte__text"><p class="etikett"><i class="sh-live"></i>Dokumentarkivet</p><h1>Dokument <em>&amp; avtal</em></h1>' +
          '<p class="dk-hjalte__ingress">Offerter, ordrar, underlag och filer – samlade, sorterade och sökbara på ett ställe. Välj en typ, ett läge eller sök – detaljerna öppnas med ett klick.</p>' +
          '<div class="dk-flikar" role="tablist">' + [['arkiv', 'Arkiv', 'mapp', iLage.length], ['mallar', 'Mallar', 'rutnat', DOK_MALLAR.length]].map(function (f) { return '<button type="button" role="tab" data-g="dok-flik" data-f="' + f[0] + '" aria-selected="' + (dokUi.flik === f[0]) + '">' + i(f[2]) + f[1] + '<b>' + f[3] + '</b></button>'; }).join('') + '</div>' +
          '<div class="dk-hjalte__knappar"><label class="knapp knapp--virke dk-ladda">' + i('plus') + 'Ladda upp<input type="file" multiple data-dok-fil hidden></label>' +
            '<button class="knapp" type="button" data-g="dok-csv">' + i('skrivut') + 'Exportera listan</button></div></div>' +
        (dokUi.flik === 'mallar' ? (function () { var fl = mallForslag().length, anv = db().aktiviteter.filter(function (h) { return / skapad från mall\.$/.test(h.text); });
          var t = function (ik, et, tal, und, ton) { return '<div class="dk-stat" data-ton="' + ton + '"><small><span class="dk-stat__ik">' + i(ik) + '</span>' + et + '</small><b>' + tal + '</b><em>' + und + '</em></div>'; };
          return '<div class="dk-stats ml-stats">' + t('rutnat', 'Mallar', DOK_MALLAR.length, MALL_GRUPPER.length + ' grupper', 'gra') + t('blixt', 'Förslag just nu', fl, fl ? 'dokument som behövs' : 'inget saknas', fl ? 'gul' : 'gron') +
            t('dokument', 'Skapade från mall', anv.length, anv.length ? 'senast ' + IH.sedan(anv.sort(function (x, y) { return new Date(y.tid) - new Date(x.tid); })[0].tid) : 'inga än', 'bla') + '</div>'; })() : '') +
        '<div class="dk-stats">' +
          stat('klocka', 'Väntar på svar', vantar.length, IH.kort(sum(vantar)) + ' i offerter', 'bla', 'vantar') +
          stat('trofe', 'Godkänt & signerat', godk.length, IH.kort(sum(godk)) + ' blev order', 'gron', 'klara') +
          stat('kalender', 'Går ut inom 7 dagar', snart.length, snart.length ? e(snart.map(function (p) { return p.o.nummer; }).join(', ')) : 'inget går ut', snart.length ? 'rod' : 'gra', 'vantar') +
          '<div class="dk-stat dk-stat--bred"><small><span class="dk-stat__ik">' + i('trend') + '</span>Kunderna svarar på</small><b>' + (median == null ? '–' : median + (median === 1 ? ' dag' : ' dagar')) + '</b><em>' + (svarstider.length ? 'median av ' + svarstider.length + ' godkända offerter' : 'ingen offert godkänd ännu') + '</em>' +
            '<span class="dk-tidslinje"><span><i>' + i('offert') + '</i><b>Skickad</b><small>dag 0</small></span><span class="dk-tidslinje__mitt"><em></em></span><span><i>' + i('bock') + '</i><b>Godkänd</b><small>' + (median == null ? '–' : 'dag ' + median) + '</small></span></span></div>' +
        '</div>' +
        '<div class="dk-blick"><p class="etikett">Arkivet i en blick</p><div class="dk-fack">' + DOK_FACK.map(function (f, n) {
          var l = alla.filter(function (p) { return p.fack === f.id; });
          return '<button type="button" class="dk-fack__ruta" data-g="dok-fack" data-f="' + f.id + '" aria-pressed="' + (dokUi.fack === f.id) + '" style="--t:' + f.ton + ';--n:' + n + '"><small><i></i>' + f.namn + '</small><b>' + l.length + '</b><em>' + fackUnder(f) + '</em></button>';
        }).join('') + '<button type="button" class="dk-fack__alla" data-g="dok-fack" data-f="alla" aria-pressed="' + (dokUi.fack === 'alla') + '">' + i('rutnat') + 'Alla<b>' + iLage.length + '</b></button></div></div>' +
        '<div class="dk-verktyg"><label class="sok sok--liten dk-sok">' + i('sok') + '<input type="search" placeholder="Sök nummer, kund, hus eller fil" value="' + e(dokUi.sok) + '" data-dok-sok aria-label="Sök bland dokumenten"></label>' +
          '<span class="dk-vem" role="group" aria-label="Vems">' + [['mina', 'Mina'], ['alla', 'Alla']].map(function (v2) { var n = dokPoster().filter(function (p) { return v2[0] === 'alla' || p.ansv === IH.jag().id; }).length; return '<button type="button" data-g="dok-vem" data-f="' + v2[0] + '" aria-pressed="' + (dokUi.vem === v2[0]) + '">' + v2[1] + '<b>' + n + '</b></button>'; }).join('') + '</span>' +
          '<label class="kundsort">' + i('kalender') + '<select data-dok-ar aria-label="År">' + [['alla', 'Alla år']].concat(dokAr(alla).map(function (y) { return [y, y]; })).map(function (o) { return '<option value="' + o[0] + '"' + (dokUi.ar === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="kundsort">' + i('rutnat') + '<select data-dok-grupp aria-label="Gruppera">' + [['typ', 'Per typ'], ['kund', 'Per kund'], ['ingen', 'Ingen gruppering']].map(function (o) { return '<option value="' + o[0] + '"' + (dokUi.grupp === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="kundsort">' + i('lista') + '<select data-dok-sort aria-label="Sortera">' + [['senast', 'Senast först'], ['utgar', 'Går ut först'], ['varde', 'Störst värde'], ['kund', 'Kund A–Ö']].map(function (o) { return '<option value="' + o[0] + '"' + (dokUi.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<div class="dk-lagen" role="group" aria-label="Läge">' + DOK_LAGEN.map(function (l) { var n = alla.filter(function (p) { return dokPassar(p, { lage: l[0], sok: '' }); }).length; return '<button type="button" class="dk-lage" data-g="dok-lage" data-l="' + l[0] + '" aria-pressed="' + (dokUi.lage === l[0]) + '"' + (l[0] === 'utgangna' && n ? ' data-varm' : '') + '>' + l[1] + '<b>' + n + '</b></button>'; }).join('') + '</div></div>' +
      '</section>' +
      (dokUi.flik === 'mallar' ? dokMallarHtml() : '') + (dokUi.flik === 'mallar' ? '' : (att.length ? '<section class="kort dk-att" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('larm') + '</span>Att hantera <em class="rakna">' + att.length + '</em></h2></header><div class="dk-att__lista">' + att.slice(0, 6).map(function (a) {
        return '<div class="dk-att__rad" data-ton="' + a.ton + '"><span class="dk-att__ikon">' + i(a.ikon) + '</span><span><b>' + e(a.rubrik) + '</b><small>' + e(a.text) + '</small></span><span class="dk-att__knappar">' + a.knappar.filter(Boolean).map(function (k) {
          return '<button type="button" class="knapp knapp--liten" data-g="' + k[0] + '"' + (k[0] === 'kund-ring' ? ' data-tel="' + e(k[3]) + '"' : ' data-id="' + k[3] + '"') + (k[4] ? ' data-c="' + k[4] + '"' : '') + '>' + i(k[2]) + e(k[1]) + '</button>'; }).join('') + '</span></div>';
      }).join('') + '</div></section>' : '') +
      (grupper.length ? grupper.map(function (g) {
        return '<section class="kort dk-grupp" data-in><header class="dk-grupp__huvud"><span class="dk__ikon" style="--t:' + g.f.ton + '">' + i(g.f.ikon) + '</span><span><h2>' + e(g.f.namn) + '</h2><small>' + (g.under || (DOK_FACK.some(function (x) { return x.id === g.f.id; }) ? fackUnder(g.f) : plural(g.l.length, 'dokument', 'dokument'))) + '</small></span><em class="rakna">' + g.l.length + '</em></header>' +
          '<div class="dk__kolumner" aria-hidden="true"><span></span><span>Dokument</span><span>Kund</span><span>Status</span><span>Värde</span><span>Senast</span></div>' +
          '<ul class="dk__lista" data-stagger>' + g.l.slice(0, dokUi.visaAlla === g.f.id ? 999 : 8).map(dokRad).join('') + '</ul>' +
          (g.l.length > 8 && dokUi.visaAlla !== g.f.id ? '<button type="button" class="dk__fler" data-g="dok-visa" data-f="' + g.f.id + '">Visa alla ' + g.l.length + ' ' + g.f.namn.toLowerCase() + i('pil') + '</button>' : '') + '</section>';
      }).join('') : '<section class="kort" data-in>' + tomt('dokument', dokUi.sok ? 'Inget dokument matchar ”' + e(dokUi.sok) + '”. Prova nummer, kund eller hus.' : 'Inga dokument i det här läget.', { text: 'Visa alla aktuella', g: 'dok-nollstall' }) + '</section>'));
    return { titel: 'Dokument', html: html, efter: function (rot) {
      var s = $('[data-dok-sok]', rot);
      if (s) s.addEventListener('input', function () { dokUi.sok = s.value; var pos = s.selectionStart; IH.rita(); var n = $('[data-dok-sok]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
      var so = $('[data-dok-sort]', rot); if (so) so.addEventListener('change', function () { dokUi.sort = so.value; IH.rita(); });
      var gr = $('[data-dok-grupp]', rot); if (gr) gr.addEventListener('change', function () { dokUi.grupp = gr.value; IH.rita(); });
      var ar = $('[data-dok-ar]', rot); if (ar) ar.addEventListener('change', function () { dokUi.ar = ar.value; IH.rita(); });
      // släpp filer var som helst på sidan
      rot.addEventListener('dragover', function (ev) { if (ev.dataTransfer && [].indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0) { ev.preventDefault(); rot.classList.add('dk-slapp'); } });
      rot.addEventListener('dragleave', function (ev) { if (ev.target === rot || !rot.contains(ev.relatedTarget)) rot.classList.remove('dk-slapp'); });
      rot.addEventListener('drop', function (ev) { rot.classList.remove('dk-slapp'); if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) { ev.preventDefault(); dokLaddaUpp(ev.dataTransfer.files); } });
      var fi = $('[data-dok-fil]', rot); if (fi) fi.addEventListener('change', function () { dokLaddaUpp(fi.files); fi.value = ''; });
      rot.addEventListener('keydown', function (ev) { var r = ev.target.closest && ev.target.closest('.dk__rad'); if (r && ev.target === r && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); r.click(); } });
    } };
  };
  // Mallarna: dokument som fylls i med kundens och husets uppgifter och skrivs ut eller sparas som PDF.
  // Bara struktur och fält ur CRM:et – inga påhittade villkor eller priser.
  var DOK_MALLAR = [
    { id: 'foljebrev', grupp: 'salj', namn: 'Följebrev till offert', ikon: 'post', nar: 'När offerten skickas', text: 'Ett personligt brev som skickas med offerten.' },
    { id: 'platsbesok', grupp: 'salj', namn: 'Protokoll från platsbesök', ikon: 'plats', nar: 'Vid besöket på tomten', text: 'Tomten, marken, tillfart och det ni kom fram till.' },
    { id: 'tack', grupp: 'salj', namn: 'Tack för ordern', ikon: 'trofe', nar: 'När affären är vunnen', text: 'Ett tack till kunden med vad som händer härnäst.' },
    { id: 'checklista', grupp: 'bygge', namn: 'Checklista inför montage', ikon: 'bock', nar: 'Några veckor före montage', text: 'Det kunden och vi ska ha klart innan lastbilen kommer.' },
    { id: 'leverans', grupp: 'bygge', namn: 'Leveransplan', ikon: 'kalender', nar: 'Veckan före leverans', text: 'Dag, tid, tillfart, kran och vem som tar emot på plats.' },
    { id: 'egenkontroll', grupp: 'overlamning', namn: 'Egenkontroll efter montage', ikon: 'linjal', nar: 'Direkt efter montage', text: 'Punkterna montörerna går igenom innan överlämningen.' },
    { id: 'overlamning', grupp: 'overlamning', namn: 'Överlämningsprotokoll', ikon: 'hus', nar: 'När huset lämnas över', text: 'Underskrifter när huset lämnas över till kunden.' }
  ];
  var MALL_GRUPPER = [['salj', 'Sälj', 'Från första kontakten till vunnen affär'], ['bygge', 'Bygget', 'Inför leverans och montage'], ['overlamning', 'Överlämning', 'När huset står klart']];
  // Hur ofta mallen använts (räknas ur loggen: "… skapad från mall.")
  var mallAnvand = function (m) { return db().aktiviteter.filter(function (h) { return h.text === m.namn + ' skapad från mall.'; }); };
  // Förslag just nu: dokument som behövs, räknat ur offerterna, uppgifterna och projekten
  function mallForslag() {
    var ut = [], idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var gjord = function (mid, kid) { var m = DOK_MALLAR.find(function (x) { return x.id === mid; }); return db().aktiviteter.some(function (h) { return h.kund === kid && h.text === m.namn + ' skapad från mall.'; }); };
    db().offerter.forEach(function (o) { if (o.status === 'skickad' && !gjord('foljebrev', o.kund)) { var k = IH.kund(o.kund); if (k) ut.push({ mall: 'foljebrev', k: k, rubrik: 'Följebrev till offert ' + o.nummer, text: k.namn + ' · offerten är skickad' }); } });
    db().uppgifter.forEach(function (x) { if (!x.klar && /platsbesök|besök/i.test(x.text) && x.kund && !gjord('platsbesok', x.kund)) { var k = IH.kund(x.kund); if (k) ut.push({ mall: 'platsbesok', k: k, rubrik: 'Protokoll: ' + x.text, text: k.namn + ' · ' + IH.datum(x.forfaller) }); } });
    db().projekt.forEach(function (p) {
      var k = IH.kund(p.kund); if (!k || !p.montage) return; var t = dagarTill(p.montage);
      if (t >= 0 && t <= 21 && CHECK.some(function (c) { return !p.check[c[0]]; }) && !gjord('checklista', k.id)) ut.push({ mall: 'checklista', k: k, rubrik: 'Checklista inför montage', text: k.namn + ' · montage om ' + t + ' d, underlag saknas' });
      else if (t >= 0 && t <= 10 && !gjord('leverans', k.id)) ut.push({ mall: 'leverans', k: k, rubrik: 'Leveransplan', text: k.namn + ' · leverans om ' + t + ' d' });
      if (t < 0 && p.steg !== 'klart' && !gjord('overlamning', k.id)) ut.push({ mall: 'overlamning', k: k, rubrik: 'Överlämningsprotokoll', text: k.namn + ' · montage för ' + (-t) + ' d sedan' });
    });
    return ut.slice(0, 6);
  }
  function dokMallarHtml() {
    var forslag = mallForslag(), exK = db().kunder[0];
    var kort = function (m, n) {
      var anv = mallAnvand(m), senast = anv.slice().sort(function (x, y) { return new Date(y.tid) - new Date(x.tid); })[0];
      return '<article class="ml-kort" style="--n:' + n + '">' +
        '<button type="button" class="ml-mini" data-g="mall-exempel" data-id="' + m.id + '" aria-label="Visa exempel: ' + e(m.namn) + '"><span class="ml-mini__inre" aria-hidden="true">' + (exK ? mallPapper(m, exK) : '') + '</span><span class="ml-mini__etikett">' + i('helskarm') + 'Visa exempel</span></button>' +
        '<div class="ml-topp"><span class="ml-ikon">' + i(m.ikon) + '</span><div><h3>' + e(m.namn) + '</h3><p>' + e(m.nar) + '</p></div></div>' +
        '<p class="ml-text">' + e(m.text) + '</p><div class="ml-format"><span>Utskrift</span><span>PDF</span><span>Ifyllt från CRM:et</span></div>' +
        '<div class="ml-knappar"><button type="button" class="knapp knapp--virke knapp--liten" data-g="dok-mall" data-id="' + m.id + '">' + i('plus') + 'Fyll i</button>' +
          '<button type="button" class="knapp knapp--liten" data-g="mall-tom" data-id="' + m.id + '" title="Skriv ut en tom mall">' + i('skrivut') + 'Tom</button></div>' +
        '<small class="ml-anvand">' + (anv.length ? 'Använd ' + anv.length + (anv.length === 1 ? ' gång' : ' gånger') + ' · senast ' + IH.sedan(senast.tid) : 'Inte använd än') + '</small></article>';
    };
    return '<section class="kort ml-forslag" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + IH.emo('glodlampa') + '</span>Förslag just nu <em class="rakna">' + forslag.length + '</em></h2></header>' +
        (forslag.length ? '<div class="ml-forslag__lista">' + forslag.map(function (x, n) { var m = DOK_MALLAR.find(function (y) { return y.id === x.mall; });
          return '<div class="ml-forslag__rad" style="--n:' + n + '"><span class="ml-ikon">' + i(m.ikon) + '</span><span><b>' + e(x.rubrik) + '</b><small>' + e(x.text) + '</small></span><button type="button" class="knapp knapp--virke knapp--liten" data-g="dok-mall" data-id="' + m.id + '" data-kund="' + x.k.id + '">' + i('plus') + 'Fyll i</button></div>'; }).join('') + '</div>'
          : '<p class="ml-lugnt">' + IH.emo('klar') + '<span><b>Inget saknas just nu.</b> När en affär eller ett bygge behöver ett dokument föreslås det här.</span></p>') + '</section>' +
      MALL_GRUPPER.map(function (g) { var l = DOK_MALLAR.filter(function (m) { return m.grupp === g[0]; });
        return '<section class="ml-grupp" data-in><header class="ml-grupp__huvud"><h2>' + e(g[1]) + '</h2><p>' + e(g[2]) + '</p></header><div class="ml-rutnat">' + l.map(kort).join('') + '</div></section>'; }).join('');
  }
  // Mallens innehåll för en kund (samma till miniatyren, exemplet och utskriften)
  function mallKropp(m, k) {
    var x = kundInfo(k), a = x.oppen[0] || x.vunnen[0] || null, mod = a ? IH.modell(a.modell) : null, p2 = db().projekt.find(function (y) { return y.kund === k.id; });
    var o = a ? db().offerter.find(function (y) { return y.affar === a.id && y.status !== 'ersatt'; }) : null, jag = IH.jag();
    var falt = function (t, v) { return '<p class="f"><span>' + t + '</span>' + (v ? '<b>' + v + '</b>' : '<i></i>') + '</p>'; };
    var hus = e(mod ? mod.kategori + ' ' + mod.namn : '…');
    return {
      foljebrev: '<p>Hej ' + e(forsta(k.namn)) + '!</p><p>Tack för att du är intresserad av ' + (mod ? 'vårt ' + e(mod.kategori.toLowerCase()) + ' <b>' + e(mod.namn) + '</b>' : 'våra hus') + '. Här kommer offerten' + (o ? ' <b>' + e(o.nummer) + '</b>' : '') + ' som vi pratade om.</p><p>' + (o ? 'Offerten gäller i ' + (o.giltig || 30) + ' dagar från ' + IH.datum(o.skapad, true) + '. ' : '') + 'Hör av dig om du har frågor – jag hjälper gärna till.</p><p>Vänliga hälsningar<br><b>' + e(jag.namn) + '</b><br>Legohus</p>',
      platsbesok: falt('Datum') + falt('Kund', e(k.namn)) + falt('Ort', e(k.ort || '')) + falt('Marken och jordarten') + falt('Tillfart för lastbil och kran') + falt('El, vatten och avlopp') + falt('Det vi kom fram till') + falt('Nästa steg'),
      tack: '<p>Hej ' + e(forsta(k.namn)) + '!</p><p>Stort tack för förtroendet' + (mod ? ' – nu börjar resan mot ditt <b>' + e(mod.namn) + '</b>' : '') + '.</p><p><b>Det här händer härnäst</b></p><ol><li>Vi går igenom ritningarna tillsammans.</li><li>Du ordnar bygglov eller anmälan och grunden – vi hjälper till med underlaget.</li><li>Vi bokar leverans och montage.</li></ol><p>Vänliga hälsningar<br><b>' + e(jag.namn) + '</b><br>Legohus</p>',
      checklista: '<p>Hus: <b>' + hus + '</b>' + (p2 && p2.montage ? ' · montage ' + IH.datum(p2.montage, true) : '') + '</p><table><tr><th>Punkt</th><th>Vems</th><th>Klart</th></tr>' + CHECK.map(function (c) { return '<tr><td>' + e(c[1]) + '</td><td>' + (c[0] === 'ritning' ? 'Legohus' : 'Kunden') + '</td><td>' + (p2 && p2.check[c[0]] ? '✓' : '☐') + '</td></tr>'; }).join('') + '</table>',
      leverans: '<p>Hus: <b>' + hus + '</b></p>' + falt('Leveransdag', p2 && p2.montage ? IH.datum(p2.montage, true) : '') + falt('Beräknad tid för lastbilen') + falt('Tillfart och var lastbilen ställer sig') + falt('Kran och lyft') + falt('Vem tar emot på plats') + falt('Telefon på plats', e(k.telefon || '')),
      egenkontroll: '<p>Hus: <b>' + hus + '</b></p><table><tr><th>Kontrollpunkt</th><th>OK</th><th>Anmärkning</th></tr>' + ['Väggblock i lod och våg', 'Tak och takfot', 'Fönster och dörrar', 'Infästning mot grund', 'Tätning och plåt', 'Städat på tomten'].map(function (t) { return '<tr><td>' + t + '</td><td>☐</td><td></td></tr>'; }).join('') + '</table><div class="sign"><p><i></i>Montör</p><p><i></i>Datum</p></div>',
      overlamning: '<p>Hus: <b>' + hus + '</b></p>' + falt('Datum för överlämning') + falt('Nycklar (antal)') + falt('Anmärkningar') + '<div class="sign"><p><i></i>Kund: ' + e(k.namn) + '</p><p><i></i>Legohus: ' + e(jag.namn) + '</p></div>'
    }[m.id];
  }
  var MALL_STIL = 'body{font:15px/1.6 system-ui,sans-serif;color:#1b1915;max-width:720px;margin:48px auto;padding:0 24px}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #c98a45;padding-bottom:12px;margin-bottom:28px}h1{font-size:24px;margin:2px 0 0}small{color:#6b6257}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #e6dccd}.f{display:grid;grid-template-columns:240px 1fr;gap:12px;margin:0 0 14px}.f span{color:#6b6257}.f i{border-bottom:1px solid #b9ad9c;height:20px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:56px}.sign i{display:block;border-bottom:1px solid #1b1915;height:36px;margin-bottom:6px}';
  function mallHuvud(m, k) { return '<header><div><small>Legohus</small><h1>' + e(m.namn) + '</h1></div><div style="text-align:right">' + (k ? '<b>' + e(k.namn) + '</b><br><small>' + e([k.ort, k.telefon, k.epost].filter(Boolean).join(' · ')) + '</small><br>' : '') + '<small>' + IH.datum(new Date().toISOString(), true) + '</small></div></header>'; }
  // Miniatyren och exemplet: samma papper i en skalad ram
  function mallPapper(m, k) { return '<span class="ml-papper">' + mallHuvud(m, k) + mallKropp(m, k) + '</span>'; }
  function mallSkrivUt(m, k, html) {
    var w = window.open('', '_blank'); if (!w) { IH.toast('Fönstret blockerades', 'Tillåt popup-fönster för att skriva ut mallen.', 'varning'); return false; }
    w.document.write('<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>' + e(m.namn) + (k ? ' · ' + e(k.namn) : '') + '</title><style>' + MALL_STIL + '</style></head><body>' + mallHuvud(m, k) + html + '</body></html>');
    w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (x) { /* utskrift blockerad */ } }, 300);
    return true;
  }
  G['mall-exempel'] = function (el) {
    var m = DOK_MALLAR.find(function (x) { return x.id === el.getAttribute('data-id'); }), k = db().kunder[0]; if (!m || !k) return;
    IH.oppnaArk({ titel: m.namn, ikon: m.ikon, under: 'Exempel ifyllt för ' + e(k.namn) + ' (exempeldata)', kropp: '<div class="ml-exempel">' + mallPapper(m, k) + '</div>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><button class="knapp knapp--virke" type="button" data-g="dok-mall" data-id="' + m.id + '">' + i('plus') + 'Fyll i för en kund</button>' });
  };
  G['mall-tom'] = function (el) {
    var m = DOK_MALLAR.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!m) return;
    var f = function (t) { return '<p class="f"><span>' + t + '</span><i></i></p>'; };
    mallSkrivUt(m, null, f('Kund') + f('Datum') + f('Hus') + f('Anteckningar') + f(' ') + f(' ') + '<div class="sign"><p><i></i>Kund</p><p><i></i>Legohus</p></div>');
  };

  G['dok-fack'] = function (el) { var f = el.getAttribute('data-f'); dokUi.fack = dokUi.fack === f && f !== 'alla' ? 'alla' : f; dokUi.flik = 'arkiv'; IH.rita(); };
  G['dok-lage'] = function (el) { dokUi.lage = el.getAttribute('data-l'); dokUi.flik = 'arkiv'; IH.rita(); };
  G['dok-visa'] = function (el) { dokUi.visaAlla = el.getAttribute('data-f'); IH.rita(); };
  G['dok-nollstall'] = function () { dokUi.fack = 'alla'; dokUi.lage = 'aktuella'; dokUi.sok = ''; dokUi.ar = 'alla'; IH.rita(); };
  G['dok-forlang'] = function (el) {
    var o = db().offerter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!o) return;
    o.giltig = (o.giltig || 30) + 14; IH.logga('system', 'Offert ' + o.nummer + ' förlängd 14 dagar.', o.kund, o.affar); IH.spara(); IH.stangArk(true); IH.rita();
    IH.toast('Förlängd', 'Offert ' + o.nummer + ' gäller 14 dagar till.', 'kalender');
  };
  G['dok-flik'] = function (el) { dokUi.flik = el.getAttribute('data-f'); IH.rita(); };
  G['dok-vem'] = function (el) { dokUi.vem = el.getAttribute('data-f'); IH.rita(); };
  G['dok-mall'] = function (el) {
    var m = DOK_MALLAR.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!m) return;
    IH.oppnaArk({ titel: m.namn, ikon: m.ikon, under: e(m.text),
      kropp: '<form class="formular" data-form="dok-mall" id="dok-mall-form"><input type="hidden" name="mall" value="' + m.id + '"><label class="falt"><span>Kund</span><select name="kund" required>' + db().kunder.map(function (k) { return '<option value="' + k.id + '"' + (k.id === el.getAttribute('data-kund') ? ' selected' : '') + '>' + e(k.namn) + '</option>'; }).join('') + '</select></label><p class="kund-tom">Öppnas i ett nytt fönster att skriva ut eller spara som PDF.</p></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="dok-mall-form">' + i('skrivut') + 'Skapa</button>' });
  };
  FORM['dok-mall'] = function (f, d) {
    var m = DOK_MALLAR.find(function (x) { return x.id === d.get('mall'); }), k = IH.kund(d.get('kund')); if (!m || !k) return;
    var x = kundInfo(k), a = x.oppen[0] || x.vunnen[0] || null;
    if (!mallSkrivUt(m, k, mallKropp(m, k))) return;
    IH.stangArk(true); IH.logga('system', m.namn + ' skapad från mall.', k.id, a ? a.id : null); IH.spara(); IH.rita();
  };
  // Detaljen för ett dokument: värde och ring överst, tidslinjen, fakta och knapparna
  G['dok-detalj'] = function (el) {
    var p = dokPoster().find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!p) return;
    var k = p.k, steg = [], fakta = [], knappar = [], ring = null, topp = '';
    var tl = function (namn, iso, klar, ton) { steg.push([namn, iso, klar, ton]); };
    if (p.fack === 'offert' || p.fack === 'order') {
      var o = p.o, x = offInfo(o), a = x.a, ord = p.fack === 'order';
      tl('Skapad', o.skapad, true); tl(ord ? 'Signerad' : 'Godkänd', a && a.vunnen && o.status === 'godkand' ? a.vunnen : '', o.status === 'godkand');
      if (!ord && x.utgangen) tl('Gick ut', new Date(new Date(o.skapad).getTime() + x.giltig * 864e5).toISOString(), true, 'rod');
      topp = '<small>' + (ord ? 'Ordervärde' : 'Offererat värde') + '</small><b>' + IH.kr(x.summa) + '</b><em>' + (o.rader ? plural(o.rader.length, 'rad', 'rader') : '') + '</em>';
      ring = o.status === 'godkand' ? [1, '✓', ord ? 'Signerad' : 'Godkänd', 'gron'] : x.utgangen ? [0, '0', 'Har gått ut', 'rod'] : [Math.max(0, x.kvar) / x.giltig, Math.max(0, x.kvar), 'dagar kvar', x.kvar <= 7 ? 'gul' : 'gron'];
      if (x.m) fakta.push(['Hus', e(x.m.kategori + ' ' + x.m.namn)]);
      if (o.rader) fakta.push(['Innehåll', e(o.rader.map(function (r) { return r.text; }).join(' · '))]);
      if (!ord && o.status === 'skickad' && !x.utgangen) fakta.push(['Gäller till', IH.datum(new Date(new Date(o.skapad).getTime() + x.giltig * 864e5).toISOString(), true) + ' <small>(' + Math.max(0, x.kvar) + ' d kvar)</small>']);
      if (x.dagarTillJa != null) fakta.push(['Svarstid', x.dagarTillJa + ' dagar från offert till ja']);
      if (a) { var u = IH.anvandare(a.ansvarig); if (u) fakta.push(['Säljare', e(u.namn)]); }
      knappar.push('<a class="knapp knapp--virke" href="#/offerter/' + o.id + '">' + i('helskarm') + 'Öppna ' + (ord ? 'ordern' : 'offerten') + '</a>');
      if (!ord && o.status === 'skickad') knappar.push('<button class="knapp" type="button" data-g="dok-forlang" data-id="' + o.id + '">' + i('kalender') + 'Förläng 14 d</button>');
      if (!ord && o.status === 'skickad' && k && k.epost) knappar.push('<a class="knapp" href="mailto:' + e(k.epost) + '?subject=' + encodeURIComponent('Offert ' + o.nummer + ' – Legohus') + '&body=' + encodeURIComponent('Hej ' + forsta(k.namn) + '!\n\nJag ville bara höra hur du tänker kring offerten ' + o.nummer + '. Säg till om du har frågor.\n\nVänliga hälsningar\n' + IH.jag().namn) + '">' + i('post') + 'Påminn via mejl</a>');
      if (k && k.telefon) knappar.push('<button class="knapp" type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '">' + i('tel') + 'Ring ' + e(forsta(k.namn)) + '</button>');
      if (a) knappar.push('<button class="knapp" type="button" data-g="aff-oppna" data-id="' + a.id + '">' + i('tavla') + 'Till affären</button>');
    } else if (p.fack === 'underlag') {
      var pr = db().projekt.find(function (y) { return y.id === p.pid; }), klara = CHECK.filter(function (c) { return pr.check[c[0]]; }).length;
      tl('Projektet startade', pr.start, true); tl(p.namn + ' klart', p.status[2] === 'klar' ? pr.andrad : '', p.status[2] === 'klar'); if (pr.montage) tl('Montage', pr.montage, dagarTill(pr.montage) < 0);
      topp = '<small>Underlaget i projektet</small><b>' + klara + ' av ' + CHECK.length + '</b><em>punkter klara</em>';
      ring = [klara / CHECK.length, Math.round(klara / CHECK.length * 100) + '%', p.status[0], p.status[1] === 'rod' ? 'rod' : klara === CHECK.length ? 'gron' : 'gul'];
      fakta.push(['Vems del', p.check === 'ritning' ? 'Vår' : 'Kundens']); fakta.push(['Alla punkter', CHECK.map(function (c) { return (pr.check[c[0]] ? '✓ ' : '○ ') + e(UNDERLAG_NAMN[c[0]]); }).join('<br>')]);
      if (p.status[2] !== 'klar') knappar.push('<button class="knapp knapp--virke" type="button" data-g="dok-check-stang" data-id="' + pr.id + '" data-c="' + p.check + '">' + i('bock') + 'Markera klart</button>');
      knappar.push('<button class="knapp" type="button" data-g="proj-oppna" data-id="' + pr.id + '">' + i('produktion') + 'Öppna projektet</button>');
    }
    if (k) fakta.unshift(['Kund', '<a href="#/kunder/' + k.id + '">' + e(k.namn) + '</a>' + (k.ort ? ' <small>' + e(k.ort) + '</small>' : '')]);
    var ringHtml = ring ? '<span class="dkd__ring" data-ton="' + ring[3] + '" style="--a:' + ring[0].toFixed(3) + '"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><circle cx="50" cy="50" r="42" pathLength="100"/></svg><b>' + ring[1] + '</b><small>' + e(ring[2]) + '</small></span>' : '';
    IH.oppnaArk({ titel: p.namn, ikon: (DOK_FACK.find(function (f) { return f.id === p.fack; }) || {}).ikon || 'offert', under: e(p.under) + ' · <span class="dk__chip" data-ton="' + p.status[1] + '"><i></i>' + e(p.status[0]) + '</span>',
      kropp: '<div class="dkd"><div class="dkd__topp"><div class="dkd__tal">' + topp + '</div>' + ringHtml + '</div>' +
        '<ol class="dkd__steg">' + steg.map(function (st) { return '<li class="' + (st[2] ? 'klar' : '') + (st[3] ? ' ' + st[3] : '') + '"><i></i><b>' + e(st[0]) + '</b><small>' + (st[1] ? IH.datum(st[1], true) : 'inte än') + '</small></li>'; }).join('') + '</ol>' +
        '<dl class="dkd__fakta">' + fakta.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') + '</dl></div>',
      fot: knappar.join('') });
  };
  G['dok-check-stang'] = function (el) { IH.stangArk(true); G['prod-check'](el); };
  var dokVantar = [];
  function dokLaddaUpp(filer) {
    dokVantar = Array.prototype.slice.call(filer || []); if (!dokVantar.length) return;
    var k0 = dokUi.grupp === 'kund' ? '' : '';
    IH.oppnaArk({ titel: dokVantar.length === 1 ? 'Spara filen' : 'Spara ' + dokVantar.length + ' filer', ikon: 'gem', under: 'Välj vad det är och vem det gäller – då hittar du det lätt igen.',
      kropp: '<form class="formular dk-upp" data-form="dok-upp" id="dok-upp-form">' + dokVantar.map(function (f, n) {
          var g = gissaKat(f.name, f.type); if (g === 'ovrigt' && DOK_VALBARA.indexOf(dokUi.fack) >= 0) g = dokUi.fack;
          return '<div class="dk-upp__rad"><span class="dk__ikon dk__ikon--fil" style="--t:' + DOK_FACK.find(function (x) { return x.id === g; }).ton + '">' + e((f.name.split('.').pop() || '').slice(0, 4).toUpperCase()) + '</span><span class="dk-upp__namn"><b>' + e(f.name) + '</b><small>' + Math.max(1, Math.round(f.size / 1024)) + ' kB</small></span>' +
            '<select name="kat' + n + '" aria-label="Typ av dokument">' + DOK_VALBARA.map(function (id) { var ff = DOK_FACK.find(function (x) { return x.id === id; }); return '<option value="' + id + '"' + (id === g ? ' selected' : '') + '>' + ff.namn + '</option>'; }).join('') + '</select></div>';
        }).join('') +
        '<div class="falt-rad"><label class="falt"><span>Kund</span><select name="kund"><option value="">Ingen kund</option>' + db().kunder.slice().sort(function (a, b) { return a.namn.localeCompare(b.namn, 'sv'); }).map(function (k) { return '<option value="' + k.id + '">' + e(k.namn) + '</option>'; }).join('') + '</select></label>' +
        '<label class="falt"><span>Projekt (valfritt)</span><select name="projekt"><option value="">Inget projekt</option>' + db().projekt.map(function (pr) { var k = IH.kund(pr.kund), m = IH.modell(pr.modell); return '<option value="' + pr.id + '">' + e((k ? k.namn : '') + ' · ' + (m ? m.namn : '')) + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="kund-tom">Filerna sparas i den här webbläsaren och finns kvar tills du själv arkiverar dem.</p></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="dok-upp-form">' + i('bock') + 'Spara i arkivet</button>' });
    void k0;
  }
  FORM['dok-upp'] = function (f, d) {
    var dd = db(); if (!dd.dokument) dd.dokument = [];
    var pr = d.get('projekt') ? dd.projekt.find(function (x) { return x.id === d.get('projekt'); }) : null, kund = d.get('kund') || (pr ? pr.kund : null);
    var nya = dokVantar.map(function (fil, n) { return { fil: fil, rad: { id: IH.nyttId('dokument', 'd'), namn: fil.name, ext: (fil.name.split('.').pop() || '').toLowerCase(), storlek: fil.size, typ: fil.type, tid: new Date().toISOString(), av: IH.jag().id, kund: kund, projekt: pr ? pr.id : null, kat: d.get('kat' + n) || gissaKat(fil.name, fil.type) } }; });
    Promise.all(nya.map(function (x) { return dokSparaBlob(x.rad.id, x.fil).then(function () { x.rad.sparad = true; }, function () { x.rad.sparad = false; }); })).then(function () {
      nya.forEach(function (x) { dd.dokument.push(x.rad); if (kund) IH.logga('system', 'Dokument sparat: ' + x.rad.namn + ' (' + DOK_FACK.find(function (ff) { return ff.id === x.rad.kat; }).namn.toLowerCase() + ').', kund, null); });
      dokVantar = []; IH.spara(); IH.stangArk(true);
      var kat = nya.length && nya.every(function (x) { return x.rad.kat === nya[0].rad.kat; }) ? nya[0].rad.kat : 'alla';
      dokUi.fack = kat; dokUi.lage = 'aktuella'; dokUi.flik = 'arkiv'; IH.rita();
      IH.toast('Sparat i arkivet', plural(nya.length, 'fil', 'filer') + (kund ? ' hos ' + IH.kund(kund).namn : '') + '.', 'gem');
    });
  };
  var dokOppnaBlob = function (blob, namn, ladda) {
    var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u;
    if (ladda) a.download = namn; else a.target = '_blank';
    a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  };
  G['dok-fil-oppna'] = function (el) {
    var id = el.getAttribute('data-id'), ladda = !!el.getAttribute('data-ladda'), p = dokPoster().find(function (x) { return x.id === id; }); if (!p) return;
    if (p.chatt) { if (!p.chatt.data) { IH.toast('Filen finns inte kvar', 'Bara namnet sparades i chatten.', 'varning'); return; } fetch(p.chatt.data).then(function (r) { return r.blob(); }).then(function (b) { dokOppnaBlob(b, p.namn, ladda); }); return; }
    dokHamtaBlob(p.fil.id).then(function (b) { if (b) dokOppnaBlob(b, p.namn, ladda); else IH.toast('Filen finns inte i den här webbläsaren', 'Den laddades upp på en annan dator eller innan arkivet sparade filer.', 'varning'); }, function () { IH.toast('Kunde inte öppna filen', '', 'varning'); });
  };
  G['dok-foto'] = function (el) {
    var src = el.getAttribute('data-src'), namn = el.getAttribute('data-namn') || 'Bild';
    IH.oppnaArk({ titel: namn, under: 'Bildbanken · byggbild från Legohus', ikon: 'kamera', kropp: '<figure class="dk-foto"><img src="' + e(src) + '" alt="' + e(namn) + '"></figure>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><a class="knapp knapp--virke" href="' + e(src) + '" download>' + i('skrivut') + 'Ladda ner</a>' });
  };
  G['dok-fil'] = function (el) {
    var p = dokPoster().find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!p) return;
    var d = p.fil, f = DOK_FACK.find(function (x) { return x.id === p.fack; }), u = IH.anvandare(p.ansv);
    var fakta = [['Typ', e(f.namn)], ['Fil', e((p.ext || '').toUpperCase()) + ' · ' + (d ? Math.max(1, Math.round(d.storlek / 1024)) + ' kB' : 'från chatten')], ['Sparad', IH.datum(p.datum, true) + (u ? ' av ' + e(u.namn) : '')]];
    if (p.k) fakta.push(['Kund', '<a href="#/kunder/' + p.k.id + '">' + e(p.k.namn) + '</a>']);
    var redigera = d ? '<form class="formular" data-form="dok-fil" id="dok-fil-form"><input type="hidden" name="id" value="' + d.id + '"><div class="falt-rad">' +
      '<label class="falt"><span>Typ</span><select name="kat">' + DOK_VALBARA.map(function (id) { return '<option value="' + id + '"' + (id === p.fack ? ' selected' : '') + '>' + DOK_FACK.find(function (x) { return x.id === id; }).namn + '</option>'; }).join('') + '</select></label>' +
      '<label class="falt"><span>Kund</span><select name="kund"><option value="">Ingen</option>' + db().kunder.map(function (k) { return '<option value="' + k.id + '"' + (d.kund === k.id ? ' selected' : '') + '>' + e(k.namn) + '</option>'; }).join('') + '</select></label></div></form>' : '';
    IH.oppnaArk({ titel: p.namn, ikon: f.ikon, under: e(f.namn) + ' · <span class="dk__chip" data-ton="' + p.status[1] + '"><i></i>' + e(p.status[0]) + '</span>',
      kropp: '<div class="dkd"><dl class="dkd__fakta">' + fakta.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>' + redigera + '</div>',
      fot: '<button class="knapp knapp--virke" type="button" data-g="dok-fil-oppna" data-id="' + p.id + '">' + i('helskarm') + 'Öppna</button><button class="knapp" type="button" data-g="dok-fil-oppna" data-ladda="1" data-id="' + p.id + '">' + i('skrivut') + 'Ladda ner</button>' +
        (d ? '<button class="knapp" type="button" data-g="dok-fil-arkiv" data-id="' + d.id + '">' + i(d.arkiv ? 'aterstall' : 'mapp') + (d.arkiv ? 'Återställ' : 'Arkivera') + '</button><button class="knapp" type="submit" form="dok-fil-form">' + i('bock') + 'Spara</button>' : '') });
  };
  FORM['dok-fil'] = function (f, d) { var x = (db().dokument || []).find(function (y) { return y.id === d.get('id'); }); if (x) { x.kund = d.get('kund') || null; x.kat = d.get('kat') || x.kat; } IH.spara(); IH.stangArk(true); IH.rita(); IH.toast('Sparat', x ? x.namn : '', 'gem'); };
  // Ingenting raderas: arkiverade dokument göms från Aktuella men finns kvar under Arkiverade och Alla
  G['dok-fil-arkiv'] = function (el) { var x = (db().dokument || []).find(function (y) { return y.id === el.getAttribute('data-id'); }); if (!x) return; x.arkiv = !x.arkiv; IH.spara(); IH.stangArk(true); IH.rita(); IH.toast(x.arkiv ? 'Arkiverat' : 'Återställt', x.namn + (x.arkiv ? ' finns kvar under Arkiverade.' : ''), 'mapp'); };
  function dokAr(alla) { var y = {}; alla.forEach(function (p) { if (p.datum) y[new Date(p.datum).getFullYear()] = 1; }); return Object.keys(y).sort().reverse(); }
  G['dok-fil-bort'] = function (el) { var l = db().dokument || [], n = l.findIndex(function (x) { return x.id === el.getAttribute('data-id'); }); if (n >= 0) l.splice(n, 1); IH.spara(); IH.stangArk(true); IH.rita(); IH.toast('Borttagen', '', 'stang'); };
  G['dok-csv'] = function () {
    var l = dokSortera(dokPoster().filter(function (p) { return dokPassar(p); }));
    var esc = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rader = [['Typ', 'Dokument', 'Detalj', 'Kund', 'Status', 'Värde (kr)', 'Datum']].concat(l.map(function (p) { return [DOK_FACK.find(function (f) { return f.id === p.fack; }).namn, p.namn, p.under, p.k ? p.k.namn : '', p.status[0], p.varde || '', p.datum ? IH.datum(p.datum) : '']; }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rader.map(function (r) { return r.map(esc).join(';'); }).join('\r\n')], { type: 'text/csv' }));
    a.download = 'dokument-' + IH.dagStr() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Exporterat', l.length + ' dokument till CSV.', 'skrivut');
  };

  G['ny-affar-kund'] = function (el) { affarsForm({ kund: el.getAttribute('data-id') }); };
  G['ny-kund'] = function () {
    IH.oppnaArk({
      titel: 'Ny kund', ikon: 'kunder',
      kropp: '<form class="formular" data-form="ny-kund" id="ny-kund-form">' +
        '<label class="falt"><span>Namn</span><input name="namn" required autofocus></label>' +
        '<div class="falt-rad"><label class="falt"><span>Telefon</span><input name="telefon" type="tel"></label><label class="falt"><span>E-post</span><input name="epost" type="email"></label></div>' +
        '<div class="falt-rad"><label class="falt"><span>Ort</span><input name="ort"></label><label class="falt"><span>Typ</span><select name="typ"><option value="privat">Privatperson</option><option value="foretag">Företag</option></select></label></div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--mork" type="submit" form="ny-kund-form">Spara kund</button>'
    });
  };
  FORM['ny-kund'] = function (f, d) {
    var k = { id: IH.nyttId('kund', 'k'), namn: d.get('namn'), telefon: d.get('telefon') || '', epost: d.get('epost') || '',
      ort: d.get('ort') || '', typ: d.get('typ'), skapad: new Date().toISOString() };
    db().kunder.push(k);
    IH.spara();
    IH.stangArk(true);
    IH.toast('Kunden är sparad', k.namn, 'kunder');
    IH.ga('#/kunder/' + k.id);
    IH.uppdateraMeny();
  };

  FORM.anteckning = function (form, d) {
    var text = String(d.get('text') || '').trim();
    if (!text) return;
    IH.logga(d.get('typ') || 'notis', text, d.get('kund') || null, d.get('affar') || null);
    var a = d.get('affar') ? IH.affar(d.get('affar')) : null;
    if (a) a.andrad = new Date().toISOString();
    IH.spara();
    var iArk = form.closest('.ark');
    if (iArk && a) { IH.stangArk(true); affArk(a.id); } else IH.rita();
    IH.toast('Tillagd i historiken', text, aktIkon(d.get('typ')));
  };

  /* ================================================================
     Offerter
     ================================================================ */
  var offFilter = 'alla', offSort = 'senaste', offSok = '';
  var OFF_ST = { utkast: ['#b8cde0', 'Utkast'], skickad: ['#f0b56e', 'Skickad'], godkand: ['#7fe0a6', 'Godkänd'] };
  var OFF_FILTER_EMOJI = { alla: '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>', skickad: '⏳', snart: '⏰', godkand: '<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg>', utkast: '<svg class="emo-ik" aria-hidden="true"><use href="#i-redigera"/></svg>' };

  // Allt om en offert på ett ställe.
  function offInfo(o) {
    var k = IH.kund(o.kund), m = IH.modell(o.modell), a = IH.affar(o.affar);
    var giltig = o.giltig || 30, kvar = giltig - IH.dagarSedan(o.skapad);
    var utgangen = o.status === 'skickad' && kvar <= 0;
    var dagarTillJa = o.status === 'godkand' && a && a.vunnen ? Math.max(0, Math.round((new Date(a.vunnen) - new Date(o.skapad)) / 864e5)) : null;
    return { o: o, k: k, m: m, a: a, summa: IH.summaOffert(o), giltig: giltig, kvar: kvar, utgangen: utgangen, snart: o.status === 'skickad' && kvar > 0 && kvar <= 10, dagarTillJa: dagarTillJa };
  }

  function offRad(x) {
    var o = x.o, st = x.utgangen ? ['#a39b8e', 'Gått ut'] : OFF_ST[o.status] || OFF_ST.utkast;
    var giltig = o.status === 'godkand' ? '<span class="tid tid--order"><svg class="emo-ik" aria-hidden="true"><use href="#i-medalj"/></svg> Blev order</span>' : x.utgangen ? '<span class="tid tid--varm">Gått ut</span>' :
      '<span class="offgiltig' + (x.snart ? ' offgiltig--varm' : '') + '"><span class="poang poang--' + (x.snart ? 'kall' : 'ljum') + '" style="--p:' + Math.round(Math.max(0, Math.min(1, x.kvar / x.giltig)) * 100) + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="poang__fyll" cx="20" cy="20" r="17" pathLength="100"/></svg><b>' + Math.max(0, x.kvar) + '</b></span><small>' + (x.kvar === 1 ? 'dag kvar' : 'dagar kvar') + '</small></span>';
    return '<tr data-g="offert-oppna" data-id="' + o.id + '" class="' + (x.snart ? 'offrad--snart' : '') + '"><td><span class="tabell__hus">' + (x.m ? '<img src="' + x.m.tumme + '" alt="" loading="lazy">' : '') +
      '<span><b>' + e(o.nummer) + '</b><small>' + (x.m ? e(x.m.namn) + ' · ' : '') + IH.datum(o.skapad) + '</small></span></span></td>' +
      '<td><span class="tabell__kund">' + kundAvatar(x.k, true) + '<span><b>' + e(x.k ? x.k.namn : '') + '</b><small>' + e(x.k ? x.k.ort : '') + '</small></span></span></td>' +
      '<td class="tal">' + IH.kr(x.summa) + '</td><td>' + statusChip(st[0], st[1]) + '</td><td>' + giltig + '</td>' +
      '<td><span class="tabell__snabb">' +
        (o.status === 'skickad' ? '<button type="button" data-g="offert-folj-upp" data-id="' + o.id + '" title="Följ upp i affären">' + i('samtal') + '</button>' : '') +
        (o.status === 'skickad' && x.kvar <= 10 ? '<button type="button" data-g="offert-forlang" data-id="' + o.id + '" title="Förläng 14 dagar">' + i('klocka') + '</button>' : '') +
        (o.status !== 'utkast' ? '<button type="button" data-g="offert-ny-version" data-id="' + o.id + '" title="Ny version">' + i('kopiera') + '</button>' : '') +
        '<button type="button" data-g="offert-oppna" data-id="' + o.id + '" title="Öppna">' + i('pil') + '</button>' +
      '</span></td></tr>';
  }

  IH.vyer.offerter = function (del) {
    if (del[0]) return offertSida(del[0]);
    var alla = db().offerter.filter(function (o) { return o.status !== 'ersatt'; }).map(offInfo);
    var sum = function (l) { return l.reduce(function (t, x) { return t + x.summa; }, 0); };
    var skickade = alla.filter(function (x) { return x.o.status === 'skickad' && !x.utgangen; });
    var godkanda = alla.filter(function (x) { return x.o.status === 'godkand'; });
    var utkast = alla.filter(function (x) { return x.o.status === 'utkast'; });
    var utgangna = alla.filter(function (x) { return x.utgangen; });
    var snart = alla.filter(function (x) { return x.snart; }).sort(function (x, y) { return x.kvar - y.kvar; });
    var avgjorda = godkanda.length + utgangna.length;
    var traff = avgjorda ? Math.round(godkanda.length / avgjorda * 100) : null;
    var tider = godkanda.map(function (x) { return x.dagarTillJa; }).filter(function (d) { return d !== null; });
    var snittTid = tider.length ? Math.round(tider.reduce(function (t, d) { return t + d; }, 0) / tider.length) : null;

    // Vanligaste posterna utöver själva huset (första raden).
    var poster = {};
    alla.forEach(function (x) { x.o.rader.slice(1).forEach(function (r) { poster[r.text] = (poster[r.text] || 0) + 1; }); });
    var topPoster = Object.keys(poster).sort(function (p, q) { return poster[q] - poster[p]; }).slice(0, 6);

    // Per modell.
    var perModell = {};
    alla.forEach(function (x) { var id = x.o.modell; if (!perModell[id]) perModell[id] = { m: x.m, antal: 0, summa: 0, ja: 0 }; perModell[id].antal++; perModell[id].summa += x.summa; if (x.o.status === 'godkand') perModell[id].ja++; });
    var modeller = Object.keys(perModell).map(function (id) { return perModell[id]; }).sort(function (p, q) { return q.summa - p.summa; });
    var maxM = Math.max.apply(null, modeller.map(function (x) { return x.summa; }).concat([1]));

    // Skickat per vecka, åtta veckor bakåt.
    var veckor = [];
    for (var v = 7; v >= 0; v--) { var d = new Date(); d.setDate(d.getDate() - v * 7); veckor.push({ v: IH.vecka(d), antal: 0, summa: 0 }); }
    alla.forEach(function (x) { var w = IH.vecka(new Date(x.o.skapad)); veckor.forEach(function (y) { if (y.v === w) { y.antal++; y.summa += x.summa; } }); });
    var maxV = Math.max.apply(null, veckor.map(function (y) { return y.summa; }).concat([1]));

    var FILTER = [['alla', 'Alla'], ['skickad', 'Väntar på svar'], ['snart', 'Går ut snart'], ['godkand', 'Godkända'], ['utkast', 'Utkast']];
    var passar = function (x, f) {
      return f === 'alla' || (f === 'skickad' && x.o.status === 'skickad') || (f === 'snart' && x.snart) || (f === 'godkand' && x.o.status === 'godkand') || (f === 'utkast' && x.o.status === 'utkast');
    };
    var antal = {};
    FILTER.forEach(function (f) { antal[f[0]] = alla.filter(function (x) { return passar(x, f[0]); }).length; });
    var lista = alla.filter(function (x) {
      return passar(x, offFilter) && (!offSok || ((x.k ? x.k.namn : '') + ' ' + x.o.nummer + ' ' + (x.m ? x.m.namn : '')).toLowerCase().indexOf(offSok.toLowerCase()) >= 0);
    }).sort(function (x, y) {
      if (offSort === 'summa') return y.summa - x.summa;
      if (offSort === 'giltig') return (x.o.status === 'skickad' ? x.kvar : 999) - (y.o.status === 'skickad' ? y.kvar : 999);
      return y.o.skapad < x.o.skapad ? -1 : 1;
    });

    var html = '<h1 class="dold">Offerter</h1>' +

      '<section class="offtopp kort kort--mork" data-in>' +
        '<div class="offtopp__ord">' +
          '<p class="etikett etikett--ljus">Offertläget</p>' +
          '<p class="offtopp__stort"><b class="tal" data-rakna="' + Math.round(sum(skickade)) + '" data-format="kort">' + IH.kort(sum(skickade)) + '</b><span>väntar på svar<small>' + skickade.length + (skickade.length === 1 ? ' offert' : ' offerter') + (snart.length ? ' · ' + snart.length + ' går ut inom tio dagar' : '') + '</small></span></p>' +
          '<div class="offtopp__tal">' +
            '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-mal"/></svg></i>Träffsäkerhet</small><b class="tal">' + (traff === null ? '–' : '<span data-rakna="' + traff + '">' + traff + '</span><em> %</em>') + '</b><span>' + (avgjorda ? godkanda.length + ' av ' + avgjorda + ' avgjorda' : 'inga avgjorda än') + '</span></div>' +
            '<div><small><i aria-hidden="true">⏱️</i>Tid till ja</small><b class="tal">' + (snittTid === null ? '–' : '<span data-rakna="' + snittTid + '">' + snittTid + '</span><em> d</em>') + '</b><span>' + (tider.length ? 'snitt för ' + tider.length + ' godkända' : 'inga godkända än') + '</span></div>' +
            '<div><small><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-medalj"/></svg></i>Godkänt värde</small><b class="tal" data-rakna="' + Math.round(sum(godkanda)) + '" data-format="kort">' + IH.kort(sum(godkanda)) + '</b><span>' + godkanda.length + ' blev order</span></div>' +
          '</div>' +
          '<div class="offtopp__vecka"><small><svg class="emo-ik" aria-hidden="true"><use href="#i-stapel"/></svg> Offererat per vecka<em>' + IH.kort(veckor.reduce(function (t, y) { return t + y.summa; }, 0)) + ' på åtta veckor</em></small><div class="offtopp__staplar">' + veckor.map(function (y, n) {
            return '<span class="' + (y.summa ? 'har' : '') + '" style="--a:' + (y.summa / maxV).toFixed(2) + ';--n:' + n + '" data-tip="Vecka ' + y.v + ' · ' + (y.antal === 1 ? '1 offert' : y.antal + ' offerter') + ' · ' + IH.kort(y.summa) + '">' +
              '<b>' + (y.summa ? IH.kort(y.summa) : '') + '</b><i></i><small>' + (n === veckor.length - 1 ? 'nu' : 'v.' + y.v) + '</small></span>';
          }).join('') + '</div></div>' +
        '</div>' +
        '<div class="offtopp__hoger"><div class="toppverktyg"><label class="sok sok--liten">' + i('sok') + '<input type="search" placeholder="Sök kund eller nummer…" value="' + e(offSok) + '" data-offsok aria-label="Sök offert"></label></div>' +
          '<div class="snartut"><div class="snartut__huvud"><p class="etikett etikett--ljus">⏰ Går ut snart</p><small>' + (snart.length ? 'Följ upp eller förläng innan tiden går ut' : 'Inget som brådskar') + '</small></div>' +
            (snart.length ? '<div class="snartut__lista" data-stagger>' + snart.slice(0, 3).map(function (x) {
              return '<div class="snartut__rad"><span class="poang poang--kall" style="--p:' + Math.round(x.kvar / x.giltig * 100) + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="poang__fyll" cx="20" cy="20" r="17" pathLength="100"/></svg><b>' + x.kvar + '</b></span>' +
                '<span class="snartut__text"><b>' + e(x.k ? x.k.namn : '') + '</b><small>' + e(x.o.nummer) + ' · ' + IH.kr(x.summa) + ' · ' + (x.kvar === 1 ? '1 dag kvar' : x.kvar + ' dagar kvar') + '</small></span>' +
                '<span class="snartut__knappar"><button class="knapp knapp--liten knapp--mork" type="button" data-g="offert-folj-upp" data-id="' + x.o.id + '">' + i('samtal') + 'Följ upp</button>' +
                '<button class="knapp knapp--liten" type="button" data-g="offert-forlang" data-id="' + x.o.id + '">' + i('klocka') + '+14 d</button></span></div>';
            }).join('') + '</div>' : '<p class="snartut__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg></span>Alla skickade offerter har mer än tio dagar kvar.</p>') + '</div>' +
          '<div class="offinsikt">' +
            '<div class="permodell"><p class="etikett etikett--ljus"><svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg> Per hus</p>' + (modeller.length ? '<div class="permodell__lista">' + modeller.map(function (x, n) {
              return '<a class="permodell__rad" href="#/offerter" style="--a:' + (x.summa / maxM).toFixed(2) + ';--n:' + n + '">' + (x.m && x.m.tumme ? '<img src="' + x.m.tumme + '" alt="" loading="lazy">' : '<i></i>') +
                '<span><b>' + e(x.m ? x.m.namn : '') + '</b><small>' + x.antal + (x.antal === 1 ? ' offert' : ' offerter') + (x.ja ? ' · ' + x.ja + ' ja' : '') + '</small><i class="permodell__stapel"></i></span><em class="tal">' + IH.kort(x.summa) + '</em></a>';
            }).join('') + '</div>' : '') + '</div>' +
            '<div class="poster"><p class="etikett etikett--ljus"><svg class="emo-ik" aria-hidden="true"><use href="#i-rutnat"/></svg> Vanligaste posterna</p><div class="poster__lista">' + topPoster.map(function (t) {
              return '<span style="--a:' + (poster[t] / alla.length).toFixed(3) + '"><b class="poster__emoji" aria-hidden="true">' + postEmoji(t) + '</b>' + e(t) + '<small>' + poster[t] + ' st · ' + Math.round(poster[t] / alla.length * 100) + ' %</small><i></i></span>';
            }).join('') + '</div></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<div class="kundverktyg">' +
        '<div class="flikar flikar--filter" data-flikar role="toolbar" aria-label="Filter">' + FILTER.map(function (f) {
          return '<button type="button" data-g="off-filter" data-f="' + f[0] + '" aria-pressed="' + (offFilter === f[0]) + '"><i class="flik__emoji" aria-hidden="true">' + OFF_FILTER_EMOJI[f[0]] + '</i>' + f[1] + '<b>' + antal[f[0]] + '</b></button>';
        }).join('') + '</div>' +
        '<div class="kundverktyg__hoger"><label class="kundsort">' + i('lista') + '<select data-offsort aria-label="Sortera">' +
          [['senaste', 'Senaste först'], ['giltig', 'Går ut först'], ['summa', 'Störst summa']].map(function (o) { return '<option value="' + o[0] + '"' + (offSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
      '</div>' +

      (lista.length ? '<section class="kort" data-in><table class="tabell tabell--offert tabell--offert2"><thead><tr><th>Offert</th><th>Kund</th><th>Summa</th><th>Status</th><th>Giltighet</th><th></th></tr></thead><tbody data-stagger>' +
        lista.map(offRad).join('') + '</tbody></table></section>' : (offSok ? tomt('offert', 'Ingen offert matchar ”' + e(offSok) + '”. Prova kund, nummer eller hus.', { text: 'Rensa sökningen', g: 'off-sok-rensa', ikon: 'stang' })
        : offFilter !== 'alla' ? tomt('offert', 'Inga offerter i det här läget just nu.', { text: 'Visa alla', g: 'off-filter', attr: 'data-f="alla"', ikon: 'offert' })
        : tomt('offert', 'Inga offerter ännu. De skapas från affärer på säljtavlan när ni vet vilket hus det blir.', { text: 'Till säljtavlan', href: '#/salj', ikon: 'tavla' })));

    return {
      titel: 'Offerter', html: html,
      efter: function (rot) {
        glidFlikar($('[data-flikar]', rot));
        var s = $('[data-offsok]', rot);
        if (s) {
          s.addEventListener('input', function () {
            offSok = s.value;
            var pos = s.selectionStart;
            IH.rita();
            var n = $('[data-offsok]');
            if (n) { n.focus(); n.setSelectionRange(pos, pos); }
          });
        }
        var so = $('[data-offsort]', rot);
        if (so) so.addEventListener('change', function () { offSort = so.value; IH.rita(); });
      }
    };
  };
  G['off-filter'] = function (el) { offFilter = el.getAttribute('data-f'); IH.rita(); };
  G['offert-folj-upp'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    if (o && o.affar) IH.ga('#/salj/' + o.affar);
  };
  G['offert-forlang'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    if (!o) return;
    o.giltig = (o.giltig || 30) + 14;
    IH.logga('system', 'Offert ' + o.nummer + ' förlängd med 14 dagar.', o.kund, o.affar);
    IH.spara();
    IH.toast('Offerten är förlängd', o.nummer + ' gäller nu i ' + o.giltig + ' dagar', 'klocka');
    IH.rita();
    IH.lysUpp('tr[data-id="' + o.id + '"]', 'bytt');
  };
  G['offert-ny-version'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    var a = o ? IH.affar(o.affar) : null;
    if (!a) return;
    var ny = nyOffert(a, o.rader.map(function (r) { return { text: r.text, antal: r.antal, pris: r.pris }; }));
    IH.toast('Ny version skapad', ny.nummer + ' utifrån ' + o.nummer, 'kopiera');
    IH.ga('#/offerter/' + ny.id);
  };

  G['kund-filter'] = function (el) { kundFilter = el.getAttribute('data-f'); IH.rita(); };
  G['offert-oppna'] = function (el) { IH.ga('#/offerter/' + el.getAttribute('data-id')); };

  G['skapa-offert'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id'));
    var o = nyOffert(a);
    IH.stangArk(true);
    IH.ga('#/offerter/' + o.id);
  };
  function nyOffert(a, rader) {
    var m = IH.modell(a.modell);
    var pl = IH.db.prislista;
    db().offerter.forEach(function (x) { if (x.affar === a.id && x.status !== 'godkand') x.status = 'ersatt'; });
    db().lopnr.offert += 1;
    var o = { id: 'o' + db().lopnr.offert, nummer: 'LH-' + new Date().getFullYear() + '-' + db().lopnr.offert, affar: a.id, kund: a.kund, modell: a.modell,
      rader: rader || [{ text: m.kategori + ' ' + m.namn + (m.yta ? ', ' + m.yta + ' m²' : ''), antal: 1, pris: pl.modeller[m.id] || 0 }]
        .concat(pl.poster.filter(function (p) { return p.id === 'frakt' || p.id === 'montage'; }).map(function (p) { return { text: p.text, antal: 1, pris: p.pris }; })),
      status: 'utkast', skapad: new Date().toISOString(), giltig: 30 };
    db().offerter.push(o);
    IH.logga('system', 'Offert ' + o.nummer + ' skapad.', a.kund, a.id);
    IH.spara();
    return o;
  }
  IH.nyOffert = nyOffert;
  IH.foreslaModell = foreslaModell;

  function dokument(o) {
    var k = IH.kund(o.kund), m = IH.modell(o.modell);
    var jag = IH.jag();
    var sum = IH.summaOffert(o);
    return '<article class="dok" id="dok">' +
      '<header class="dok__huvud"><img src="../images/legohus_logo.svg" alt="Legohus Stockholm"><div><b>Offert</b><span>' + e(o.nummer) + '</span></div></header>' +
      (m ? '<div class="dok__bild"><img src="' + m.bild + '" alt=""><span>' + e(m.kategori + ' ' + m.namn) + '</span></div>' : '') +
      '<div class="dok__parter"><div><small>Till</small><b>' + e(k ? k.namn : '') + '</b><span>' + e(k ? k.ort : '') + '</span><span>' + e(k ? k.epost : '') + '</span></div>' +
      '<div><small>Från</small><b>Legohus Stockholm</b><span>' + e(jag.namn) + '</span><span>kontakt@legohusstockholm.se</span></div>' +
      '<div><small>Datum</small><b>' + IH.datum(o.skapad, true) + '</b><span>Giltig i ' + o.giltig + ' dagar</span></div></div>' +
      '<table class="dok__rader"><thead><tr><th>Beskrivning</th><th>Antal</th><th>À-pris</th><th>Summa</th></tr></thead><tbody data-stagger>' +
      o.rader.map(function (r) {
        return '<tr><td>' + e(r.text) + '</td><td>' + (r.antal || 0) + '</td><td>' + IH.kr(r.pris) + '</td><td>' + IH.kr((r.pris || 0) * (r.antal || 0)) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="dok__summa"><span>Att betala</span><b class="tal" data-dok-summa>' + IH.kr(sum) + '</b><small>Priserna är exempel i prototypen</small></div>' +
      '<footer class="dok__fot">Huset byggs under tak i Sverige och monteras på tomten. Bygglov, grund och anslutningar ingår inte om inget annat står ovan.</footer>' +
      '</article>';
  }

  // Offertens läge (Utkast → Skickad → Godkänd) och hur länge den gäller.
  function offertband(o) {
    var STEG = [['skriv', 'Utkast'], ['post', 'Skickad'], ['trofe', 'Godkänd']];
    var nu = o.status === 'godkand' ? 2 : o.status === 'skickad' ? 1 : 0;
    var giltig = o.giltig || 30, gatt = IH.dagarSedan(o.skapad), kvar = giltig - gatt;
    var andel = Math.max(0, Math.min(1, kvar / giltig));
    var text = o.status === 'godkand' ? 'Godkänd – blev en order' : kvar > 0 ? kvar + (kvar === 1 ? ' dag kvar' : ' dagar kvar') + ' av ' + giltig : 'Giltighetstiden har gått ut';
    return '<section class="ostatus kort" data-in style="--nu:' + nu + '"><ol class="ostatus__steg">' + STEG.map(function (st, n) {
        return '<li class="' + (n < nu ? 'klar' : n === nu ? 'nu' : '') + '"><span>' + i(n < nu ? 'bock' : st[0]) + '</span><b>' + st[1] + '</b></li>';
      }).join('') + '</ol>' +
      '<div class="ostatus__giltig' + (o.status !== 'godkand' && kvar <= 7 ? ' ostatus__giltig--varm' : '') + '"><span class="poang poang--' + (o.status === 'godkand' ? 'varm' : kvar <= 7 ? 'kall' : 'ljum') + '" style="--p:' + Math.round((o.status === 'godkand' ? 1 : andel) * 100) + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="poang__fyll" cx="20" cy="20" r="17" pathLength="100"/></svg><b>' + (o.status === 'godkand' ? i('bock') : Math.max(0, kvar)) + '</b></span>' +
      '<span><small>Giltighet</small><b>' + text + '</b></span></div></section>';
  }

  function offertSida(id) {
    var o = IH.offert(id);
    if (!o) return { titel: 'Offerter', html: '<a class="tillbaka" href="#/offerter">' + i('pilv') + 'Alla offerter</a>' + tomt('offert', 'Offerten finns inte.') };
    var a = IH.affar(o.affar);
    var las = o.status === 'godkand';
    var html = '<a class="tillbaka" href="#/offerter">' + i('pilv') + 'Alla offerter</a>' +
      '<header class="vyhuvud"><div><p class="etikett">Offert</p><h1>' + e(o.nummer) + '</h1><p>' + e(a ? a.titel : '') + '</p></div>' +
      '<div class="vyhuvud__knappar"><button class="knapp" type="button" data-g="skriv-ut">' + i('skrivut') + 'Skriv ut / PDF</button>' +
      (o.status === 'utkast' ? '<button class="knapp knapp--virke" type="button" data-g="offert-skicka" data-id="' + o.id + '">' + i('post') + 'Markera som skickad</button>' : '') +
      (o.status === 'skickad' ? '<button class="knapp knapp--virke" type="button" data-g="aff-vinn" data-id="' + o.affar + '">' + i('trofe') + 'Kunden godkände</button>' : '') + '</div></header>' +
      offertband(o) +
      '<div class="offertyta">' +
        '<section class="kort offertred" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('skriv') + '</span>Innehåll</h2>' +
          (las ? '<span class="status" style="--s:#7fe0a6">Godkänd – låst</span>' : '<span class="status" style="--s:' + (o.status === 'skickad' ? '#f0b56e' : '#b8cde0') + '">' + (o.status === 'skickad' ? 'Skickad' : 'Utkast') + '</span>') + '</header>' +
          '<div class="kort__kropp">' +
          '<div class="modellrad modellrad--liten">' + IH.MODELLER.map(function (m) {
            return '<button type="button" class="modellknapp' + (m.id === o.modell ? ' vald' : '') + '" data-g="offert-modell" data-id="' + o.id + '" data-m="' + m.id + '"' + (las ? ' disabled' : '') + ' title="' + e(m.namn) + '"><img src="' + m.tumme + '" alt=""><b>' + e(m.namn) + '</b></button>';
          }).join('') + '</div>' +
          '<div class="offertrader" data-rader>' + o.rader.map(function (r, n) {
            return '<div class="offertrader__rad" data-n="' + n + '"><span class="offertrader__emoji" aria-hidden="true">' + (n === 0 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg>' : postEmoji(r.text)) + '</span><input value="' + e(r.text) + '" data-f="text" aria-label="Beskrivning"' + (las ? ' disabled' : '') + '>' +
              '<input type="number" min="0" value="' + r.antal + '" data-f="antal" aria-label="Antal"' + (las ? ' disabled' : '') + '>' +
              '<input type="number" min="0" step="500" value="' + r.pris + '" data-f="pris" aria-label="Pris"' + (las ? ' disabled' : '') + '>' +
              (las ? '' : '<button class="ikonknapp" type="button" data-g="offert-bort" data-id="' + o.id + '" data-n="' + n + '" aria-label="Ta bort">' + i('stang') + '</button>') + '</div>';
          }).join('') + '</div>' +
          (las ? '' : '<div class="offertlagg"><select data-lagg aria-label="Lägg till rad"><option value="">+ Lägg till ur prislistan…</option>' + IH.db.prislista.poster.map(function (p) {
            return '<option value="' + p.id + '">' + e(p.text) + ' · ' + IH.kr(p.pris) + '</option>';
          }).join('') + '<option value="egen">Egen rad…</option></select></div>') +
          '<div class="offertsumma"><span><small><svg class="emo-ik" aria-hidden="true"><use href="#i-pengar"/></svg> Summa</small>' + o.rader.length + (o.rader.length === 1 ? ' rad' : ' rader') + ' · ändras direkt i offerten</span><b class="tal" data-summa>' + IH.kr(IH.summaOffert(o)) + '</b></div>' +
          '</div></section>' +
        '<div class="dokyta" data-in>' + dokument(o) + '</div>' +
      '</div>';
    return {
      titel: o.nummer, html: html,
      efter: function (rot) {
        var rader = $('[data-rader]', rot);
        if (rader) rader.addEventListener('input', function (ev) {
          var rad = ev.target.closest('[data-n]');
          if (!rad) return;
          var r = o.rader[Number(rad.getAttribute('data-n'))];
          var fl = ev.target.getAttribute('data-f');
          r[fl] = fl === 'text' ? ev.target.value : Number(ev.target.value) || 0;
          IH.spara();
          var sum = IH.summaOffert(o);
          $('[data-summa]', rot).textContent = IH.kr(sum);
          $('.dokyta', rot).innerHTML = dokument(o);
          if (a && sum) { a.varde = sum; IH.spara(); }
        });
        var lagg = $('[data-lagg]', rot);
        if (lagg) lagg.addEventListener('change', function () {
          var v = lagg.value;
          if (!v) return;
          if (v === 'egen') o.rader.push({ text: 'Ny rad', antal: 1, pris: 0 });
          else {
            var p = IH.db.prislista.poster.filter(function (x) { return x.id === v; })[0];
            o.rader.push({ text: p.text, antal: 1, pris: p.pris });
          }
          if (a) a.varde = IH.summaOffert(o);
          IH.spara();
          IH.rita();
          var sista = $$('.offertrader__rad').pop();
          if (sista) { sista.classList.add('ny'); var inp = $('input', sista); if (inp && v === 'egen') { inp.focus(); inp.select(); } }
        });
      }
    };
  }
  G['offert-modell'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    var m = IH.modell(el.getAttribute('data-m'));
    o.modell = m.id;
    o.rader[0] = { text: m.kategori + ' ' + m.namn + (m.yta ? ', ' + m.yta + ' m²' : ''), antal: 1, pris: IH.db.prislista.modeller[m.id] || 0 };
    var a = IH.affar(o.affar);
    if (a) { a.modell = m.id; a.varde = IH.summaOffert(o); }
    IH.spara();
    IH.rita();
  };
  G['offert-bort'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    o.rader.splice(Number(el.getAttribute('data-n')), 1);
    var a = IH.affar(o.affar);
    if (a) a.varde = IH.summaOffert(o);
    IH.spara();
    IH.rita();
  };
  G['offert-skicka'] = function (el) {
    var o = IH.offert(el.getAttribute('data-id'));
    o.status = 'skickad';
    o.skapad = new Date().toISOString();
    var a = IH.affar(o.affar);
    if (a && ['ny', 'kontakt', 'besok'].indexOf(a.steg) >= 0) { a.steg = 'offert'; }
    if (a) a.andrad = new Date().toISOString();
    IH.logga('mejl', 'Offert ' + o.nummer + ' skickad (' + IH.kr(IH.summaOffert(o)) + ').', o.kund, o.affar);
    IH.spara();
    IH.ritaOm();
    IH.lysUpp('tr[data-id="' + o.id + '"], .ostatus', 'bytt');
    IH.toast('Offerten är markerad som skickad', 'Affären ligger nu i Offert skickad.', 'post');
  };
  G['skriv-ut'] = function () { window.print(); };

  /* ================================================================
     Kundmöte (presentationen ligger i mote.js)
     ================================================================ */
  // Kundmötets förberedelse: vilka affärer som är redo för ett möte,
  // upplägget med tid per bild, en checklista räknad ur datan och de
  // möten som redan hållits.
  var moteAffar = '', moteBilder = null;
  var MOTE_MIN = { titel: 2, er: 3, hantverk: 3, husen: 8, regler: 5, resan: 4, kalkyl: 10, nasta: 3 };
  var MOTE_LAGEN = {
    fullt: ['Fullt möte', IH.MOTE_BILDER.map(function (b) { return b.id; })],
    kort: ['Kort möte', ['titel', 'er', 'husen', 'kalkyl', 'nasta']],
    kalkyl: ['Bara kalkylen', ['titel', 'kalkyl', 'nasta']]
  };
  function moteMinuter(text) { var m = /\((\d+) min\)/.exec(text || ''); return m ? Number(m[1]) : null; }

  // En låda i bordets 3D-rum: lock, framsida, baksida och två gavlar.
  // Måtten i px; x är lådans läge i sin förälder.
  function lada(klass, w, d, h, x) {
    return '<span class="lada ' + klass + '" style="--w:' + w + 'px;--d:' + d + 'px;--h:' + h + 'px' + (x ? ';--x:' + x + 'px' : '') + '">' +
      '<i class="lada__topp"></i><i class="lada__fram"></i><i class="lada__bak"></i><i class="lada__v"></i><i class="lada__h"></i></span>';
  }

  function motescen(a, k, m, f, valda, total, moten, snitt, redo, besok, besokKund) {
    var N = valda.length || 1;
    // Bunten med presentationens bilder, bläddras på bordet.
    var bunt = valda.map(function (id, n) {
      var bb = IH.MOTE_BILDER.filter(function (x) { return x.id === id; })[0];
      return '<i class="stack__kort" style="--n:' + n + '"><img src="' + bb.bild + '" alt="" loading="lazy" decoding="async"></i>';
    }).join('');
    // Det som ligger på planeringsbordet: ritningar, kontrakt, pennor,
    // linjal, tumstock, måttband, kaffe, lampa, husmodellen och
    // bildbunten. Verktygen är lådor i bordets 3D (lada), koppen en
    // cylinder av stavar. Allt utom ljuspölen och huset får en skugga.
    var stavar = '';
    for (var si = 0; si < 18; si++) {
      var vinkel = si * 20;
      stavar += '<i class="kaffe__stav" style="--a:' + vinkel + 'deg;--l:' + Math.round(76 + 15 * Math.cos((vinkel - 70) * Math.PI / 180)) + '"></i>';
    }
    var skivor = '';
    for (var ki = 0; ki < 8; ki++) skivor += '<b class="' + (ki === 7 ? 'mattband__lock' : '') + '" style="--i:' + ki + '"></b>';
    var saker = [
      ['fasad', '<i class="papper ritning ritning--fasad"></i>'],
      ['plan', '<i class="papper ritning ritning--plan"></i>'],
      ['lapp', '<span class="lapp3"><i class="papper lapp"></i><i class="lapp__vik"></i></span>'],
      ['kontrakt', '<span class="kontrakt3"><i class="papper kontrakt__under kontrakt__under--2"></i><i class="papper kontrakt__under"></i><i class="papper kontrakt"><b></b></i><i class="gem"></i></span>'],
      ['linjal', lada('linjal', 122, 14, 3)],
      ['tumstock', '<span class="tumstock">' + lada('tumstock__led', 64, 10, 3) + lada('tumstock__led tumstock__led--2', 64, 10, 3) + '<b class="tumstock__nit"></b></span>'],
      ['mattband', '<span class="mattband">' + skivor + '<b class="mattband__knapp"></b>' + lada('mattband__band', 38, 6, 1.5) + lada('mattband__krok', 3, 10, 4) + '</span>'],
      ['blyerts', '<span class="penna penna--bly">' + lada('penna__kropp', 54, 6, 6) + lada('penna__hylsa', 4, 6, 6, 54) + lada('penna__sudd', 6, 6, 6, 58) + '<i class="penna__spets"></i></span>'],
      ['penna', '<span class="penna penna--black">' + lada('penna__kropp', 64, 6, 6) + '<i class="penna__spets"></i></span>'],
      ['stack', '<div class="stack" style="--N:' + N + '">' + bunt + '</div>'],
      ['kaffe', '<span class="kaffe"><i class="kaffe__fat"></i><i class="kaffe__fat kaffe__fat--2"></i><i class="kaffe__fat kaffe__fat--3"></i>' + stavar + '<i class="kaffe__rand"></i><i class="kaffe__ora"></i><i class="kaffe__sked"></i><i class="kaffe__anga"><i></i><i></i><i></i></i></span>'],
      ['lampa', '<div class="skrivlampa"><i class="skrivlampa__fot"></i><i class="skrivlampa__kropp"><i class="skrivlampa__sockel"></i><i class="skrivlampa__arm skrivlampa__arm--1"></i><i class="skrivlampa__led"></i><i class="skrivlampa__arm skrivlampa__arm--2"></i><i class="skrivlampa__glod"></i><i class="skrivlampa__skarm"></i></i></div>'],
      ['sken', '<i class="sken"></i>'],
      ['hus', '<div class="bord__hus">' + hus3() + '</div>']
    ].map(function (x, n) {
      var skugga = x[0] === 'sken' || x[0] === 'hus' ? '' : '<i class="skugga"></i>';
      return '<div class="sak sak--' + x[0] + '" style="--n:' + n + '">' + x[1] + skugga + '</div>';
    }).join('');
    var platser = redo.slice(0, 6).map(function (x, n, arr) {
      var kk = IH.kund(x.kund);
      // Platserna längs bordets främre kant, som en publik mot scenen.
      var v = (arr.length === 1 ? 90 : 22 + n * (136 / (arr.length - 1))) * Math.PI / 180;
      var left = 50 + Math.cos(v) * 46, top = 70 + Math.sin(v) * 24;
      return '<button type="button" class="bord__plats' + (x.id === moteAffar ? ' vald' : '') + '" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%;--n:' + n + '" data-g="mote-valj" data-id="' + x.id + '" title="' + e(kk ? kk.namn : '') + ' · ' + e(x.titel) + '">' +
        kundAvatar(kk, true) + '<span>' + e(kk ? forsta(kk.namn) : '') + '<em aria-hidden="true">' + (SALJ_EMOJI[x.steg] || '') + '</em></span></button>';
    }).join('');
    var rubrik = a && k ? 'Nästa möte med<br><em>' + e(forsta(k.namn)) + '.</em>' : 'Redo att<br><em>presentera.</em>';
    var text = a && k ? e(a.titel) + (m ? ' · ' + e(m.kategori) + ' ' + e(m.namn) : '') + ' · ' + (f ? e(f.miljo) + ' · ' : '') + e(k.ort) : 'Välj en kund runt bordet, eller kör presentationen generellt.';
    return '<section class="motescen kort kort--mork" data-in><div class="motesrum3d" data-motesrum3d aria-hidden="true"></div>' +
      '<div class="motescen__ord">' +
        '<p class="etikett etikett--ljus">Kundmöte</p>' +
        '<h2 class="motescen__rubrik">' + rubrik + '</h2>' +
        '<p class="motescen__text">' + text + '</p>' +
        '<div class="motescen__chips">' +
          '<span><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-bild"/></svg></i>' + N + (N === 1 ? ' bild' : ' bilder') + ' · ≈ ' + total + ' min</span>' +
          '<span><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg></i>' + moten.length + (moten.length === 1 ? ' möte hållet' : ' möten hållna') + (snitt !== null ? ' · snitt ' + snitt + ' min' : '') + '</span>' +
          (besok ? '<span><i aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg></i>Platsbesök ' + e(IH.sedan(besok.forfaller)) + (besokKund ? ' · ' + e(forsta(besokKund.namn)) : '') + '</span>' : '') +
        '</div>' +
        '<div class="motescen__knappar">' +
          '<button class="knapp knapp--virke knapp--stor" type="button" data-g="starta-mote"' + (a ? ' data-affar="' + a.id + '"' : '') + ' data-bilder="' + valda.join(',') + '">' + i('mote') + 'Starta presentation</button>' +
          '<button class="knapp knapp--glas knapp--stor" type="button" data-g="starta-mote" data-start="kalkyl"' + (a ? ' data-affar="' + a.id + '"' : '') + '>' + i('kub') + 'Bara kalkylen</button>' +
        '</div>' +
        '<p class="motescen__not">' + (redo.length ? redo.length + (redo.length === 1 ? ' affär väntar' : ' affärer väntar') + ' på ett första möte – klicka på en plats vid bordet.' : 'Inga affärer väntar på ett första möte.') + '</p>' +
      '</div>' +
      '<div class="motescen__rum">' +
        '<div class="rum__scen" aria-hidden="true"><div class="bord"><i class="bord__skugga"></i><i class="bord__tjocklek"></i><i class="bord__skiva"></i><i class="bord__kant"></i><i class="bord__spot"></i>' + saker + '</div></div>' +
        platser +
      '</div>' +
    '</section>';
  }

  // Tidsbandet: de valda bilderna i presentationens ordning, bredd efter
  // minuterna, så man ser var tiden går.
  function tidsband(valda) {
    var med = IH.MOTE_BILDER.map(function (bb, n) { return [bb, n]; }).filter(function (x) { return valda.indexOf(x[0].id) >= 0; });
    if (!med.length) return '<div class="tidsband tidsband--tom" data-tidsband>Inga bilder valda</div>';
    return '<div class="tidsband" data-tidsband aria-label="Tiden per bild">' + med.map(function (x, k) {
      var min = MOTE_MIN[x[0].id] || 1;
      return '<span style="flex:' + min + ';--k:' + k + '" title="' + e(x[0].namn) + ' · ' + min + ' min"><b>' + (x[1] + 1) + '</b>' + (min >= 4 ? '<small>' + min + ' min</small>' : '') + '</span>';
    }).join('') + '</div>';
  }

  // Samtalsstöd för vald affär: det kunden nämnt (med färdiga svar) och frågorna som återstår – bockas av under mötet
  var moteFragor = {};
  function samtalsstod(a, k, f) {
    var am = f ? amnen(f) : [], har = function (id) { return am.some(function (x) { return x.a.id === id; }); };
    var besok = db().uppgifter.some(function (u) { return u.kund === a.kund && /bes[öo]k/i.test(u.text); }), off = IH.offertFor(a.id);
    var fragor = [];
    if (!har('storlek')) fragor.push(['storlek', 'Hur stort vill ni bygga?']);
    if (!har('detaljplan')) fragor.push(['plan', 'Ligger tomten inom eller utanför detaljplan?']);
    if (!har('tidplan')) fragor.push(['tid', 'När vill ni att huset står klart?']);
    if (k && k.typ !== 'foretag' && !har('aretrunt')) fragor.push(['bo', 'Ska huset användas året runt?']);
    if (!besok) fragor.push(['besok', 'När passar ett platsbesök på tomten?']);
    if (!off) fragor.push(['budget', 'Vilken budget har ni tänkt er?']);
    fragor.push(['beslut', 'Vem mer är med och bestämmer?']);
    var bockat = moteFragor[a.id] || {}, klara = fragor.filter(function (x) { return bockat[x[0]]; }).length;
    return '<div class="samtal"><div class="samtal__huvud"><p class="etikett">Samtalsstöd</p><span class="samtal__matare" style="--a:' + (fragor.length ? klara / fragor.length : 0).toFixed(2) + '"><i></i></span><small>' + klara + ' av ' + fragor.length + ' frågor</small></div>' +
      (am.length ? '<div class="samtal__nämnt"><small>Kunden nämnde</small><div>' + am.map(function (x) { return '<span class="samtal__chip" title="' + e(x.a.svar || x.a.skal || '') + '">' + i(x.a.ikon || 'bock') + e(x.namn) + '</span>'; }).join('') + '</div></div>' : '') +
      (am.filter(function (x) { return x.a.svar; }).length ? '<div class="samtal__svar">' + am.filter(function (x) { return x.a.svar; }).slice(0, 3).map(function (x) { return '<p><b>' + e(x.namn) + '</b>' + e(x.a.svar) + '</p>'; }).join('') + '</div>' : '') +
      '<ul class="samtal__fragor">' + fragor.map(function (x) { return '<li><button type="button" data-g="mote-fraga" data-id="' + a.id + '" data-f="' + x[0] + '" aria-pressed="' + !!bockat[x[0]] + '"><i>' + i('bock') + '</i>' + e(x[1]) + '</button></li>'; }).join('') + '</ul></div>';
  }
  // Kommande möten och platsbesök ur uppgifterna, med en knapp som förbereder mötet för kundens affär
  function kommandeMoten() {
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var l = db().uppgifter.filter(function (u) { return !u.klar && /möte|träff|bes[öo]k|visning/i.test(u.text) && new Date(u.forfaller) >= idag0; }).sort(function (x, y) { return x.forfaller < y.forfaller ? -1 : 1; }).slice(0, 4);
    return '<section class="kort komm" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('kalender') + '</span>Kommande möten</h2>' + (l.length ? '<span class="chip">' + l.length + '</span>' : '') + '</header><div class="kort__kropp">' +
      (l.length ? '<ul class="komm__lista">' + l.map(function (u) {
        var kk = u.kund ? IH.kund(u.kund) : null, d = new Date(u.forfaller), t = dagarTill(u.forfaller), af = kk ? oppnaAffarer().filter(function (x) { return x.kund === kk.id; })[0] : null;
        return '<li><span class="komm__datum' + (t === 0 ? ' idag' : '') + '"><b>' + d.getDate() + '</b><small>' + MANAD[d.getMonth()].slice(0, 3) + '</small></span><span class="komm__text"><b>' + e(u.text) + '</b><small>' + (kk ? e(kk.namn) + ' · ' : '') + (t === 0 ? 'i dag' : t === 1 ? 'i morgon' : 'om ' + t + ' dagar') + '</small></span>' +
          (af ? '<button type="button" class="knapp knapp--liten' + (af.id === moteAffar ? ' knapp--virke' : '') + '" data-g="mote-forbered" data-id="' + af.id + '">' + i(af.id === moteAffar ? 'bock' : 'mote') + (af.id === moteAffar ? 'Förberett' : 'Förbered') + '</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="forhand__tom">' + i('kalender') + 'Inga möten eller platsbesök inbokade. Lägg till dem under Att göra.</p>') + '</div></section>';
  }
  // Logga mötet efteråt: anteckning, längd och nästa steg – blir en aktivitet och en uppgift
  function loggaMote(a, k) {
    var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 7);
    return '<section class="kort logga-mote" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('anteckning') + '</span>Logga mötet</h2></header>' +
      '<form class="kort__kropp formular" data-form="mote-logga"><div class="falt-rad"><label class="falt"><span>Kund</span><select name="kund" required><option value="">Välj kund …</option>' + db().kunder.slice().sort(function (x, y) { return x.namn.localeCompare(y.namn, 'sv'); }).map(function (kk) { return '<option value="' + kk.id + '"' + (k && k.id === kk.id ? ' selected' : '') + '>' + e(kk.namn) + '</option>'; }).join('') + '</select></label>' +
        '<label class="falt falt--smal"><span>Minuter</span><input name="min" type="number" min="5" max="480" step="5" value="30"></label></div>' +
        '<label class="falt"><span>Det ni kom fram till</span><textarea name="text" rows="2" required maxlength="400" placeholder="T.ex. Vill ha Sadel 30 med braskamin, tomten är inom detaljplan"></textarea></label>' +
        '<div class="falt-rad"><label class="falt"><span>Nästa steg</span><input name="nasta" maxlength="120" placeholder="T.ex. Skicka offert"></label><label class="falt falt--smal"><span>Senast</span><input name="datum" type="date" value="' + IH.dagStr(imorgon) + '"></label></div>' +
        '<div class="formular__knappar"><button class="knapp knapp--virke" type="submit">' + i('bock') + 'Spara mötet</button></div></form></section>';
  }
  IH.vyer.mote = function () {
    var oppna = oppnaAffarer();
    var a = moteAffar ? IH.affar(moteAffar) : null;
    if (moteAffar && !a) moteAffar = '';
    var k = a ? IH.kund(a.kund) : null, m = a ? IH.modell(a.modell) : null;
    var f = a ? (db().forfragningar.filter(function (x) { return x.affar === a.id; })[0] || db().forfragningar.filter(function (x) { return x.kund === a.kund; })[0]) : null;
    var valda = moteBilder || MOTE_LAGEN.fullt[1].slice();
    if (!f) valda = valda.filter(function (id) { return id !== 'er'; });
    var lage = Object.keys(MOTE_LAGEN).filter(function (l) { var ids = MOTE_LAGEN[l][1].filter(function (id) { return id !== 'er' || f; }); return ids.length === valda.length && ids.every(function (id) { return valda.indexOf(id) >= 0; }); })[0] || null;
    var total = valda.reduce(function (t, id) { return t + (MOTE_MIN[id] || 0); }, 0);

    // Hållna möten ur historiken.
    var moten = db().aktiviteter.filter(function (h) { return h.typ === 'mote'; }).sort(function (x, y) { return y.tid < x.tid ? -1 : 1; });
    var langder = moten.map(function (h) { return moteMinuter(h.text); }).filter(function (n) { return n !== null; });
    var snitt = langder.length ? Math.round(langder.reduce(function (t, n) { return t + n; }, 0) / langder.length) : null;

    // Redo för möte: affärer där nästa steg är ett samtal eller besök.
    var redo = oppna.filter(function (x) { return x.steg === 'ny' || x.steg === 'kontakt' || x.steg === 'besok'; })
      .sort(function (x, y) { return IH.dagarSedan(y.andrad) - IH.dagarSedan(x.andrad); });
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var besok = db().uppgifter.filter(function (u) { return !u.klar && /bes[öo]k/i.test(u.text) && new Date(u.forfaller) >= idag0; })
      .sort(function (x, y) { return x.forfaller < y.forfaller ? -1 : 1; })[0];
    var besokKund = besok && besok.kund ? IH.kund(besok.kund) : null;

    // Checklistan för vald affär.
    var check = [];
    if (a) {
      var uppBesok = db().uppgifter.filter(function (u) { return u.kund === a.kund && !u.klar && /bes[öo]k/i.test(u.text); })[0];
      var off = IH.offertFor(a.id);
      var forra = moten.filter(function (h) { return h.kund === a.kund; })[0];
      var plan = f ? amnen(f).filter(function (x) { return x.a.id === 'detaljplan'; })[0] : null;
      check = [
        [!!f, 'Förfrågan', f ? 'Läst · ' + e(f.hustyp) + ' · ' + e(f.miljo) : 'Ingen förfrågan kopplad', ''],
        [!!uppBesok, 'Platsbesök', uppBesok ? 'Bokat · ' + IH.sedan(uppBesok.forfaller) : 'Inte bokat än', uppBesok ? '' : '<button class="knapp knapp--liten" type="button" data-g="mote-boka" data-id="' + a.id + '">' + i('kalender') + 'Boka</button>'],
        [!!off, 'Offert', off ? 'Finns · ' + e(off.nummer) + ' · ' + IH.kr(IH.summaOffert(off)) : 'Ingen än – kalkylen i mötet kan sparas som offert', ''],
        [!!plan, 'Detaljplan', plan ? 'Nämnt i förfrågan: "' + e(plan.m[0].trim()) + '"' : 'Okänt – fråga under mötet', ''],
        [!!forra, 'Förra mötet', forra ? IH.datum(forra.tid) + (moteMinuter(forra.text) ? ' · ' + moteMinuter(forra.text) + ' min' : '') : 'Första mötet med kunden', '']
      ];
    }

    var html = '<h1 class="dold">Kundmöte</h1>' +

      motescen(a, k, m, f, valda, total, moten, snitt, redo, besok, besokKund) +

      '<div class="rutnat rutnat--mote">' +
        '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('mote') + '</span>Förbered mötet</h2><span class="chip">' + valda.length + ' bilder · ≈ ' + total + ' min</span></header>' +
          '<form class="kort__kropp formular" data-form="starta-mote">' +
          '<label class="falt"><span>Affär</span><select name="affar" data-moteaffar><option value="">Ingen vald – visa generellt</option>' + oppna.map(function (x) {
            var kk = IH.kund(x.kund);
            return '<option value="' + x.id + '"' + (x.id === moteAffar ? ' selected' : '') + '>' + e(kk ? kk.namn : '') + ' · ' + e(x.titel) + '</option>';
          }).join('') + '</select></label>' +
          (a ? '<div class="forhand">' + (m && m.tumme ? '<img class="forhand__hus" src="' + m.tumme + '" alt="">' : '') +
            '<div><small>Mötet öppnar med</small><b>' + (k && k.typ !== 'foretag' ? 'Välkommen, ' + e(forsta(k.namn)) + '.' : 'Hus formade för platsen.') + '</b>' +
            '<span>' + (m ? e(m.kategori) + ' ' + e(m.namn) : '') + (f ? ' · ' + e(f.miljo) : '') + (k ? ' · ' + e(k.ort) : '') + '</span>' +
            (f ? '<em>“' + e(f.beskrivning) + '”</em>' : '<em>Ingen förfrågan kopplad – bilden "Er förfrågan" hoppas över.</em>') + '</div></div>'
            : '<p class="forhand__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-kunder"/></svg></span>Utan vald affär visas presentationen generellt, utan kundens namn och förfrågan.</p>') +

          '<div class="falt"><span>Upplägg' + (lage ? '' : ' · eget val') + '</span><div class="upplagg" role="toolbar">' + Object.keys(MOTE_LAGEN).map(function (l) {
            var ids = MOTE_LAGEN[l][1].filter(function (id) { return id !== 'er' || f; });
            return '<button type="button" class="upplagg__val' + (lage === l ? ' vald' : '') + '" data-g="mote-lage" data-l="' + l + '" aria-pressed="' + (lage === l) + '"><i class="upplagg__emoji" aria-hidden="true">' + ({ fullt: '<svg class="emo-ik" aria-hidden="true"><use href="#i-film"/></svg>', kort: '<svg class="emo-ik" aria-hidden="true"><use href="#i-blixt"/></svg>', kalkyl: '<svg class="emo-ik" aria-hidden="true"><use href="#i-kalkyl"/></svg>' }[l] || '') + '</i><b>' + MOTE_LAGEN[l][0] + '</b><small>' + ids.length + ' bilder · ' + ids.reduce(function (t, id) { return t + MOTE_MIN[id]; }, 0) + ' min</small></button>';
          }).join('') + '</div></div>' +

          '<fieldset class="falt"><span>Bilder i presentationen – klicka för att ta bort eller lägga till</span><div class="agenda" data-agenda>' + IH.MOTE_BILDER.map(function (bb, n) {
            var med = valda.indexOf(bb.id) >= 0, kan = bb.id !== 'er' || !!f;
            return '<label class="agenda__kort' + (med ? ' med' : '') + (kan ? '' : ' agenda__kort--saknas') + '" style="--n:' + n + '"><input type="checkbox" name="bild" value="' + bb.id + '"' + (med ? ' checked' : '') + (kan ? '' : ' disabled') + '>' +
              '<img src="' + bb.bild + '" alt="" loading="lazy" decoding="async"><span class="agenda__nr">' + (n + 1) + '</span><span class="agenda__text"><b>' + e(bb.namn) + '</b><small>' + (kan ? MOTE_MIN[bb.id] + ' min' : 'kräver förfrågan') + '</small></span><i class="agenda__bock">' + i('bock') + '</i></label>';
          }).join('') + '</div>' + tidsband(valda) + '<p class="agenda__summa">⏱️ Beräknad tid <b data-motetid>≈ ' + total + ' min</b> · <span data-moteantal>' + valda.length + ' bilder</span></p></fieldset>' +

          (a ? '<div class="motecheck"><p class="etikett">Inför mötet</p><ul>' + check.map(function (c) {
            return '<li class="' + (c[0] ? 'klar' : '') + '"><i>' + i(c[0] ? 'bock' : 'klocka') + '</i><span><b>' + c[1] + '</b><small>' + c[2] + '</small></span>' + c[3] + '</li>';
          }).join('') + '</ul></div>' : '') +

          (a ? samtalsstod(a, k, f) : '') +
          '<div class="formular__knappar"><button class="knapp knapp--mork" type="submit">' + i('mote') + 'Starta presentation</button>' +
          '<button class="knapp" type="button" data-g="starta-mote" data-start="kalkyl"' + (a ? ' data-affar="' + a.id + '"' : '') + '>' + i('kub') + 'Öppna kalkylen direkt</button></div></form></section>' +

        '<div class="rutnat">' + kommandeMoten() + loggaMote(a, k) +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Tidigare möten</h2>' + (moten.length ? '<span class="chip">' + moten.length + (snitt ? ' · snitt ' + snitt + ' min' : '') + '</span>' : '') + '</header>' +
            '<div class="kort__kropp">' + (moten.length ? '<div class="tidigare" data-stagger>' + moten.slice(0, 6).map(function (h) {
              var kk = IH.kund(h.kund), mins = moteMinuter(h.text), text = String(h.text).replace(/^Kundmöte \(\d+ min\):\s*/, '').replace(/^Platsbesök bokat i kundmötet.*$/, 'Platsbesök bokat i kundmötet');
              return '<a class="tidigare__rad" href="#/kunder/' + (kk ? kk.id : '') + '">' + kundAvatar(kk, true) + '<span><b>' + e(kk ? kk.namn : 'Okänd kund') + '</b><small><svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg> ' + IH.datum(h.tid) + '</small><em>' + e(text) + '</em></span>' + (mins ? '<i class="tidigare__min">' + mins + ' min</i>' : '') + '</a>';
            }).join('') + '</div>' : '<p class="forhand__tom">' + i('anteckning') + 'Anteckningar från mötena hamnar här. Tryck N under presentationen för att anteckna.</p>') + '</div></section>' +
          '<section class="kort motekort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('blixt') + '</span>Så funkar det</h2></header>' +
            '<div class="kort__kropp"><ul class="motetips"><li><i class="motetips__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-pil"/></svg></i><span><b>Pil höger/vänster</b> eller svep för att byta bild – <b>K</b> hoppar till kalkylen, <b>N</b> öppnar anteckningarna.</span></li>' +
            '<li><i class="motetips__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg></i><span>Husen visas i <b>3D</b> – dra för att vrida, som på huskortet.</span></li>' +
            '<li><i class="motetips__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg></i><span>Spara kalkylen som offert och boka platsbesök direkt i mötet.</span></li></ul>' +
            '<div class="tangenter"><p class="etikett etikett--ljus">Kortkommandon i presentationen</p><div class="tangenter__lista">' +
            [['→', 'Nästa bild'], ['←', 'Förra bilden'], ['K', 'Till kalkylen'], ['N', 'Anteckningar'], ['Home', 'Första bilden'], ['End', 'Sista bilden'], ['Esc', 'Stäng']].map(function (t) {
              return '<span><kbd>' + t[0] + '</kbd>' + t[1] + '</span>';
            }).join('') + '</div></div></div></section>' +
        '</div>' +
      '</div>';

    return {
      titel: 'Kundmöte', html: html,
      efter: function (rot) {
        var val = $('[data-moteaffar]', rot);
        if (val) val.addEventListener('change', function () { moteAffar = val.value; IH.rita(); });
        var rum = $('.motescen__rum', rot), bord = rum && $('.bord', rum);
        if (bord && !lugnRorelse() && matchMedia('(hover: hover)').matches) {
          var tick = null;
          rum.addEventListener('mousemove', function (ev) {
            if (tick) return;
            tick = requestAnimationFrame(function () {
              tick = null;
              var r = rum.getBoundingClientRect();
              var dx = (ev.clientX - r.left) / r.width - 0.5, dy = (ev.clientY - r.top) / r.height - 0.5;
              bord.style.transform = 'rotateX(' + (56 - dy * 6).toFixed(2) + 'deg) rotateZ(' + (dx * 5).toFixed(2) + 'deg)';
            });
          });
          rum.addEventListener('mouseleave', function () { bord.style.transform = ''; });
        }
        var ag = $('[data-agenda]', rot);
        if (ag) ag.addEventListener('change', function () {
          var ids = $$('input[name="bild"]:checked', ag).map(function (c) { return c.value; });
          moteBilder = ids;
          $$('.agenda__kort', ag).forEach(function (l) { l.classList.toggle('med', l.querySelector('input').checked); });
          var tot = ids.reduce(function (t, id) { return t + (MOTE_MIN[id] || 0); }, 0);
          $('[data-motetid]', rot).textContent = '≈ ' + tot + ' min';
          $('[data-moteantal]', rot).textContent = ids.length + ' bilder';
          var tb = $('[data-tidsband]', rot);
          if (tb) tb.outerHTML = tidsband(ids);
          $$('.upplagg__val', rot).forEach(function (b) { b.classList.remove('vald'); b.setAttribute('aria-pressed', 'false'); });
        });
      }
    };
  };
  G['mote-valj'] = function (el) { moteAffar = el.getAttribute('data-id'); IH.rita(); window.scrollTo({ top: 0, behavior: lugnRorelse() ? 'auto' : 'smooth' }); };
  G['mote-lage'] = function (el) { moteBilder = MOTE_LAGEN[el.getAttribute('data-l')][1].slice(); IH.rita(); };
  G['mote-fraga'] = function (el) {
    var id = el.getAttribute('data-id'), f = el.getAttribute('data-f'); moteFragor[id] = moteFragor[id] || {}; moteFragor[id][f] = !moteFragor[id][f];
    var y = window.scrollY; IH.rita(); window.scrollTo(0, y);
  };
  G['mote-forbered'] = function (el) {
    moteAffar = el.getAttribute('data-id'); IH.rita();
    setTimeout(function () { var x = $('[data-moteaffar]'); if (x) x.closest('.kort').scrollIntoView({ behavior: IH.lugn ? 'auto' : 'smooth', block: 'start' }); }, 60);
  };
  FORM['mote-logga'] = function (f, d) {
    var k = IH.kund(d.get('kund')); if (!k) return;
    var min = Math.max(5, Math.min(480, +d.get('min') || 30)), text = String(d.get('text') || '').trim(), nasta = String(d.get('nasta') || '').trim();
    var af = oppnaAffarer().filter(function (x) { return x.kund === k.id; })[0] || null;
    IH.logga('mote', 'Kundmöte (' + min + ' min): ' + text, k.id, af ? af.id : null);
    if (af) af.andrad = new Date().toISOString();
    if (nasta) db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: nasta, forfaller: new Date((d.get('datum') || IH.dagStr()) + 'T09:00:00').toISOString(), klar: false, kund: k.id, affar: af ? af.id : null, ansvarig: IH.jag().id });
    IH.spara(); IH.uppdateraMeny(); IH.rita();
    IH.toast('Mötet är sparat', k.namn + (nasta ? ' · nästa steg: ' + nasta : ''), 'mote');
  };
  G['mote-boka'] = function (el) {
    var a = IH.affar(el.getAttribute('data-id'));
    if (!a) return;
    var kk = IH.kund(a.kund);
    var d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0);
    db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: 'Platsbesök hos ' + (kk ? kk.namn : a.titel), forfaller: d.toISOString(), klar: false, kund: a.kund, affar: a.id, ansvarig: IH.jag().id });
    if (a.steg === 'ny' || a.steg === 'kontakt') { a.steg = 'besok'; a.andrad = new Date().toISOString(); }
    IH.logga('mote', 'Platsbesök bokat, vecka ' + IH.vecka(d) + '.', a.kund, a.id);
    IH.spara();
    IH.uppdateraMeny();
    IH.toast('Platsbesöket är bokat', 'Uppgift ' + IH.datum(d.toISOString()) + ' · affären ligger nu i besök', 'kalender');
    IH.rita();
  };
  function lugnRorelse() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  FORM['starta-mote'] = function (form, d) {
    IH.Mote.starta({ affar: d.get('affar') || null, bilder: d.getAll('bild') });
  };
  G['starta-mote'] = function (el) {
    IH.stangArk(true);
    var affar = el.getAttribute('data-affar');
    var kund = el.getAttribute('data-kund');
    if (!affar && kund) {
      var a = oppnaAffarer().filter(function (x) { return x.kund === kund; })[0];
      affar = a ? a.id : null;
    }
    var bilder = el.getAttribute('data-bilder');
    IH.Mote.starta({ affar: affar, start: el.getAttribute('data-start') || null, bilder: bilder ? bilder.split(',') : null });
  };

  /* ================================================================
     Produktion
     ================================================================ */
  /* --- Projekt (omgjord 2026-10-08) ------------------------------------
     Kunden: "gör om den mycket och ge den en cool unik dashboard och en
     cool stor kalender med all info och ikoner, emoji, animeringar och
     smarta saker". Toppen: nedräkning till nästa montage (lastbilen kör
     mot huset i takt med projektet), smarta varningar ur checklistorna
     och byggfabriken där varje hus står på sitt steg. Sedan en stor
     månadskalender med montage, starter, uppgifter, möten och offerter
     som går ut, filter per slag, vald dag och de närmaste två veckorna.
     Projekttavlan ligger kvar längst ned. */
  var kalForskjut = 0, kalVald = null, kalAv = {};
  var KAL_SLAG = [
    ['montage', 'Montage', '<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>', '#f0b56e'],
    ['start', 'Projektstart', '<svg class="emo-ik" aria-hidden="true"><use href="#i-flagga"/></svg>', '#9fc2c9'],
    ['uppgift', 'Att göra', '<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg>', '#a9c8a4'],
    ['mote', 'Möten', '<svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg>', '#b8cde0'],
    ['offert', 'Offert går ut', '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>', '#e8c98f']
  ];
  var STEG_EMOJI = { underlag: '<svg class="emo-ik" aria-hidden="true"><use href="#i-linjal"/></svg>', tillverkning: '<svg class="emo-ik" aria-hidden="true"><use href="#i-fabrik"/></svg>', grund: '<svg class="emo-ik" aria-hidden="true"><use href="#i-tegel"/></svg>', montage: '<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>', besiktning: '<svg class="emo-ik" aria-hidden="true"><use href="#i-sok"/></svg>', klart: '<svg class="emo-ik" aria-hidden="true"><use href="#i-nyckel"/></svg>' };
  var VECKODAG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  var MANAD = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  function slag(id) { for (var n = 0; n < KAL_SLAG.length; n++) if (KAL_SLAG[n][0] === id) return KAL_SLAG[n]; return KAL_SLAG[0]; }
  function dagNamn(d) { var t = VECKODAG[d.getDay()]; return t.charAt(0).toUpperCase() + t.slice(1) + ' ' + d.getDate() + ' ' + MANAD[d.getMonth()]; }
  function dagarTill(iso) { var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(iso); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }

  // Allt som hör hemma i kalendern, ur datan.
  function kalHandelser() {
    var ut = [], d = db();
    d.projekt.forEach(function (p) {
      var k = IH.kund(p.kund), m = IH.modell(p.modell);
      var saknas = CHECK.filter(function (c) { return !p.check[c[0]]; });
      if (p.montage) ut.push({ slag: 'montage', dag: IH.dagStr(p.montage), titel: 'Montage · ' + (m ? m.namn : 'hus'), under: k ? k.namn + ' · ' + k.ort : '',
        g: 'proj-oppna', id: p.id, bild: m ? m.tumme : '', klar: p.steg === 'klart', kort: m ? m.namn : 'Montage',
        varning: p.steg !== 'klart' && saknas.length ? saknas.length + (saknas.length === 1 ? ' punkt kvar' : ' punkter kvar') : '' });
      if (p.start) ut.push({ slag: 'start', dag: IH.dagStr(p.start), titel: 'Start · ' + (m ? m.namn : 'hus'), kort: m ? m.namn : 'Start', under: k ? k.namn : '', g: 'proj-oppna', id: p.id });
    });
    d.uppgifter.forEach(function (u) {
      var k = u.kund ? IH.kund(u.kund) : null;
      ut.push({ slag: 'uppgift', dag: IH.dagStr(u.forfaller), titel: u.text, under: k ? k.namn : '', g: k ? 'kund-oppna' : '', id: k ? k.id : '', klar: u.klar });
    });
    d.aktiviteter.forEach(function (a) {
      if (a.typ !== 'mote') return;
      var k = IH.kund(a.kund);
      ut.push({ slag: 'mote', dag: IH.dagStr(a.tid), titel: a.text, under: k ? k.namn : '', g: k ? 'kund-oppna' : '', id: k ? k.id : '' });
    });
    d.offerter.forEach(function (o) {
      if (o.status !== 'skickad') return;
      var slut = new Date(o.skapad); slut.setDate(slut.getDate() + (o.giltig || 30));
      var k = IH.kund(o.kund);
      ut.push({ slag: 'offert', dag: IH.dagStr(slut), titel: 'Offert ' + o.nummer + ' går ut', kort: k ? forsta(k.namn) : o.nummer, under: k ? k.namn : '', g: k ? 'kund-oppna' : '', id: k ? k.id : '' });
    });
    return ut;
  }

  // Det som saknas, i klartext och med vems del det är (2026-10-08:
  // "gör så man förstår lättare").
  var SAKNAS = {
    ritning: ['Ritningarna är inte klara', 'Vår del', '<svg class="emo-ik" aria-hidden="true"><use href="#i-linjal"/></svg>'],
    lov: ['Bygglov eller anmälan är inte inlämnad', 'Kundens del', '<svg class="emo-ik" aria-hidden="true"><use href="#i-anteckning"/></svg>'],
    grund: ['Grund, el, vatten och avlopp är inte klart', 'Kundens del', '<svg class="emo-ik" aria-hidden="true"><use href="#i-tegel"/></svg>'],
    framkomlighet: ['Vägen för lastbil och kran är inte klar', 'Kundens del', '<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>']
  };
  var CHECK_KORT = { ritning: 'Ritningar', lov: 'Bygglov/anmälan', grund: 'Grund och anslutningar', framkomlighet: 'Väg för lastbil och kran' };

  // Smarta påminnelser: det som saknas inför montaget (viktigast först)
  // och två montage samma vecka.
  function prodVarningar(aktiva) {
    var ut = [], veckor = {};
    aktiva.forEach(function (p) {
      var k = IH.kund(p.kund), m = IH.modell(p.modell), t = p.montage ? dagarTill(p.montage) : null;
      CHECK.forEach(function (c) {
        if (p.check[c[0]]) return;
        var s = SAKNAS[c[0]];
        var bradskar = t !== null && t <= 21;
        ut.push({ vikt: (bradskar ? 0 : 2) + (s[1] === 'Vår del' ? 1 : 0), emoji: bradskar ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-varning"/></svg>' : s[2], text: s[0], del: s[1],
          under: (k ? k.namn : 'Kunden') + ' · ' + (m ? m.namn : 'huset'),
          nar: t === null ? '' : (t > 0 ? 'om ' + t + ' d' : t === 0 ? 'i dag' : 'passerat'), id: p.id, varm: bradskar });
      });
      if (p.montage) { var v = IH.vecka(new Date(p.montage)); (veckor[v] = veckor[v] || []).push(p); }
    });
    Object.keys(veckor).forEach(function (v) {
      if (veckor[v].length > 1) ut.push({ vikt: 0, emoji: '<svg class="emo-ik" aria-hidden="true"><use href="#i-kalender"/></svg>', text: veckor[v].length + ' montage samma vecka', del: 'Planering', under: 'Vecka ' + v, nar: 'v. ' + v, id: veckor[v][0].id, varm: true });
    });
    return ut.sort(function (a, b) { return a.vikt - b.vikt; });
  }

  var prodDel = 'alla';
  G['prod-del'] = function (el) { prodDel = el.getAttribute('data-f'); IH.rita(); };
  // bocka av eller ångra en punkt i checklistan direkt från översikten
  G['prod-check'] = function (el) {
    var p = db().projekt.find(function (x) { return x.id === el.getAttribute('data-id'); }), c = el.getAttribute('data-c'); if (!p) return;
    p.check[c] = !p.check[c]; p.andrad = new Date().toISOString();
    var k = IH.kund(p.kund); IH.logga('system', CHECK_KORT[c] + (p.check[c] ? ' är klart.' : ' är markerat som inte klart.'), p.kund, p.affar);
    IH.spara(); IH.uppdateraMeny(); IH.rita();
    IH.toast(p.check[c] ? 'Klart' : 'Ångrat', CHECK_KORT[c] + ' · ' + (k ? k.namn : ''), p.check[c] ? 'bock' : 'aterstall');
  };
  function prodTopp(proj, aktiva, nyckel) {
    var nasta = aktiva.filter(function (p) { return p.montage && dagarTill(p.montage) >= 0; })
      .sort(function (a, b) { return a.montage < b.montage ? -1 : 1; })[0];
    var varn = prodVarningar(aktiva);
    var mening, nedrakning;
    if (nasta) {
      var k = IH.kund(nasta.kund), m = IH.modell(nasta.modell), t = dagarTill(nasta.montage);
      var saknas = CHECK.filter(function (c) { return !nasta.check[c[0]]; });
      var start = nasta.start ? new Date(nasta.start) : new Date(Date.now() - 30 * 864e5);
      var slut = new Date(nasta.montage);
      var andel = Math.max(0.04, Math.min(1, (Date.now() - start.getTime()) / Math.max(1, slut - start)));
      mening = 'Nästa hus som monteras är <b>' + e(m ? m.namn : 'huset') + '</b> hos ' + e(k ? k.namn : 'kunden') + (k && k.ort ? ' i ' + e(k.ort) : '') +
        ', om <b>' + t + (t === 1 ? ' dag' : ' dagar') + '</b>. ' + (saknas.length ? saknas.length + (saknas.length === 1 ? ' sak' : ' saker') + ' måste bli klara innan dess.' : 'Allt är klart inför montaget.');
      nedrakning = '<div class="nedrakning" style="--a:' + andel.toFixed(3) + ';--p:' + Math.round((1 - Math.min(t, 70) / 70) * 100) + '">' +
        '<span class="nedrakning__ring"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="nedr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9a0"/><stop offset="1" stop-color="#e29a4a"/></linearGradient></defs><circle cx="60" cy="60" r="52"/><circle class="nedrakning__fyll" cx="60" cy="60" r="52" pathLength="100"/></svg>' +
          '<b class="tal" data-rakna="' + t + '">' + t + '</b><small>' + (t === 1 ? 'dag kvar' : 'dagar kvar') + '</small></span>' +
        '<span class="nedrakning__info">' +
          '<b>' + e(m ? m.kategori + ' ' + m.namn : '') + '</b><em>' + e(k ? k.namn : '') + (k && k.ort ? ' · ' + e(k.ort) : '') + '</em>' +
          '<span class="nedrakning__datum">' + i('kalender') + dagNamn(slut) + ' · v. ' + IH.vecka(slut) + '</span>' +
          '<button type="button" class="nedrakning__oppna" data-g="proj-oppna" data-id="' + nasta.id + '">Öppna projektet' + i('pil') + '</button></span>' +
        '<span class="nedrakning__lista"><small>Klart innan lastbilen kommer? <em>Klicka för att bocka av</em></small>' + CHECK.map(function (c) {
            var klar = !!nasta.check[c[0]];
            return '<button type="button" class="' + (klar ? 'klar' : 'saknas') + '" data-g="prod-check" data-id="' + nasta.id + '" data-c="' + c[0] + '" aria-pressed="' + klar + '" title="' + e(CHECK_KORT[c[0]]) + ': ' + (klar ? 'klart – klicka för att ångra' : 'saknas – klicka när det är klart') + '"><i aria-hidden="true">' + (klar ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-bock"/></svg>' : '<svg class="emo-ik" aria-hidden="true"><use href="#i-stang"/></svg>') + '</i>' + CHECK_KORT[c[0]] +
              '<em>' + (c[0] === 'ritning' ? 'Vi' : 'Kunden') + '</em></button>';
          }).join('') + '</span>' +
        '<span class="nedrakning__vag" aria-hidden="true"><span class="nedrakning__ande nedrakning__ande--start"><svg class="emo-ik" aria-hidden="true"><use href="#i-flagga"/></svg> Start ' + IH.datum(start.toISOString()) + '</span>' +
          '<span class="nedrakning__ande nedrakning__ande--slut">Montage ' + IH.datum(slut.toISOString()) + ' <svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg></span>' +
          '<i class="nedrakning__spar"></i><span class="nedrakning__bil"><svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg></span></span>' +
      '</div>';
    } else {
      mening = aktiva.length ? 'Inga montage är inplanerade framåt ännu. Sätt montagedag i projekten.' : 'Inga hus i produktion just nu. När en affär vinns hamnar den här.';
      nedrakning = '<p class="prodblock__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-kalender"/></svg></span>Inget montage inplanerat.</p>';
    }
    var steg = IH.PROJSTEG;
    // husen i ett steg: ett hus visas med bild och namn, flera som en stapel med +N; stapeln öppnar en lista
    var stegHus = function (s, l) {
      if (!l.length) return '<span class="fabrik__hus"></span>';
      var namn = function (p) { var k = IH.kund(p.kund); return k ? forsta(k.namn) : 'Projekt'; };
      if (l.length === 1) {
        var m = IH.modell(l[0].modell), k = IH.kund(l[0].kund);
        return '<span class="fabrik__hus"><button type="button" data-g="proj-oppna" data-id="' + l[0].id + '" style="--j:0" title="' + e(k ? k.namn : '') + ' · ' + e(m ? m.namn : '') + '"><img src="' + (m ? m.tumme : '') + '" alt="' + e(m ? m.namn : '') + '"><span>' + e(namn(l[0])) + '</span><small class="fabrik__vecka">' + e(m ? m.namn : '') + (l[0].montage ? ' · v. ' + IH.vecka(new Date(l[0].montage)) : '') + '</small></button></span>';
      }
      var visa = l.slice(0, 3), mer = l.length - visa.length;
      return '<span class="fabrik__hus"><button type="button" class="fabrik__stapel" data-g="steg-hus" data-steg="' + s.id + '" title="Visa alla ' + l.length + ' hus i ' + e(s.namn.toLowerCase()) + '">' +
        '<span class="fabrik__bilder">' + visa.map(function (p, j) { var m = IH.modell(p.modell); return '<img src="' + (m ? m.tumme : '') + '" alt="" style="--j:' + j + '">'; }).join('') + (mer > 0 ? '<i>+' + mer + '</i>' : '') + '</span>' +
        '<span>' + e(namn(l[0])) + ' +' + (l.length - 1) + '</span></button></span>';
    };
    var fabrik = '<div class="fabrik" aria-label="Husen per steg"><i class="fabrik__band" aria-hidden="true"></i>' + steg.map(function (s, n) {
      var l = proj.filter(function (p) { return p.steg === s.id; });
      return '<div class="fabrik__station' + (l.length ? ' fabrik__station--har' : '') + '" style="--f:' + s.farg + ';--n:' + n + '" title="' + e(s.text) + '">' +
        '<span class="fabrik__emoji" aria-hidden="true">' + (STEG_EMOJI[s.id] || '<svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg>') + '<i>' + (n + 1) + '</i></span>' +
        '<b>' + e(s.namn) + '</b><small>' + (l.length ? l.length + ' hus' : 'inga hus') + '</small>' +
        stegHus(s, l) + '</div>';
    }).join('') + '</div>';
    var block = function (emoji, rubrik, hjalp, inne, klass) {
      return '<div class="prodblock' + (klass ? ' ' + klass : '') + '"><div class="prodblock__huvud"><span class="prodblock__emoji" aria-hidden="true">' + emoji + '</span>' +
        '<span><h3>' + rubrik + '</h3><p>' + hjalp + '</p></span></div>' + inne + '</div>';
    };
    var perProj = aktiva.map(function (p) {
      var saknas = CHECK.filter(function (c) { return !p.check[c[0]] && (prodDel === 'alla' || (prodDel === 'var') === (c[0] === 'ritning')); });
      return { p: p, k: IH.kund(p.kund), m: IH.modell(p.modell), t: p.montage ? dagarTill(p.montage) : null, saknas: saknas };
    }).filter(function (x) { return x.saknas.length; }).sort(function (a, b) { return (a.t == null ? 999 : a.t) - (b.t == null ? 999 : b.t); });
    var veckoKrock = varn.filter(function (v) { return v.del === 'Planering'; });
    var antalDel = function (d) { return aktiva.reduce(function (t, p) { return t + CHECK.filter(function (c) { return !p.check[c[0]] && (d === 'alla' || (d === 'var') === (c[0] === 'ritning')); }).length; }, 0); };
    var lista = '<div class="prodvarn__verktyg" role="group" aria-label="Visa">' + [['alla', 'Allt'], ['kund', 'Kundens del'], ['var', 'Vår del']].map(function (f) { return '<button type="button" class="ap-filter" data-g="prod-del" data-f="' + f[0] + '" aria-pressed="' + (prodDel === f[0]) + '">' + f[1] + ' <em>' + antalDel(f[0]) + '</em></button>'; }).join('') + '</div>' +
      (veckoKrock.map(function (v) { return '<p class="prodvarn__krock">' + i('kalender') + e(v.text) + ' – ' + e(v.under) + '. Se över lastbil och montörer.</p>'; }).join('')) +
      (perProj.length ? '<ul class="prodvarn__projlista" data-stagger>' + perProj.slice(0, 4).map(function (x) {
        var brad = x.t != null && x.t <= 21, kundDel = x.saknas.filter(function (c) { return c[0] !== 'ritning'; });
        return '<li class="prodvarn__proj' + (brad ? ' prodvarn__proj--varm' : '') + '"><header><button type="button" class="prodvarn__namn" data-g="proj-oppna" data-id="' + x.p.id + '">' + (x.m ? '<img src="' + x.m.tumme + '" alt="">' : '') + '<span><b>' + e(x.k ? x.k.namn : 'Kunden') + '</b><small>' + e(x.m ? x.m.namn : '') + '</small></span></button>' +
          '<span class="prodvarn__nar' + (brad ? ' varm' : '') + '" title="Montage ' + (x.p.montage ? IH.datum(x.p.montage) : 'inte satt') + '">' + (x.t == null ? 'Inget datum' : x.t > 0 ? 'Montage om ' + x.t + ' d' : x.t === 0 ? 'Montage i dag' : 'Passerat') + '</span></header>' +
          '<div class="prodvarn__punkter">' + x.saknas.map(function (c) { var sx = SAKNAS[c[0]]; return '<button type="button" data-g="prod-check" data-id="' + x.p.id + '" data-c="' + c[0] + '" title="' + e(sx[0]) + ' (' + e(sx[1].toLowerCase()) + ') – klicka när det är klart"><span>' + sx[2] + '</span>' + e(CHECK_KORT[c[0]]) + '<em>' + (c[0] === 'ritning' ? 'Vi' : 'Kunden') + '</em><i>' + i('bock') + '</i></button>'; }).join('') + '</div>' +
          (kundDel.length && x.k && x.k.epost ? '<a class="prodvarn__pamin" href="mailto:' + e(x.k.epost) + '?subject=' + encodeURIComponent('Inför montaget av ditt ' + (x.m ? x.m.namn : 'hus')) + '&body=' + encodeURIComponent('Hej ' + forsta(x.k.namn) + '!\n\nInför montaget behöver följande vara klart på er sida:\n' + kundDel.map(function (c) { return '– ' + CHECK_KORT[c[0]]; }).join('\n') + '\n\nHör av dig om du har frågor.\n\nVänliga hälsningar\n' + IH.jag().namn + ', Legohus') + '">' + i('post') + 'Påminn ' + e(forsta(x.k.namn)) + ' om ' + (kundDel.length === 1 ? 'det' : 'de ' + kundDel.length) + '</a>' : '') + '</li>';
      }).join('') + '</ul>' + (perProj.length > 4 ? '<p class="prodvarn__fler">+' + (perProj.length - 4) + ' projekt till – öppna dem under Projekt</p>' : '')
      : '<p class="prodblock__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-gnista"/></svg></span>' + (prodDel === 'alla' ? 'Inget saknas inför montagen.' : 'Inget saknas här.') + '</p>');
    return '<section class="prodtopp kort kort--mork" data-in>' +
      '<div class="prodtopp__intro"><p class="etikett etikett--ljus">Läget just nu</p>' +
        '<h2 class="prodtopp__titel"><b class="tal" data-rakna="' + aktiva.length + '">' + aktiva.length + '</b> hus på väg <span class="prodtopp__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-projekt"/></svg></span></h2>' +
        '<p class="prodtopp__text">' + mening + '</p></div>' +
      (nyckel || '') +
      '<div class="prodtopp__rad">' +
        block('<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>', 'Nästa montage', 'Dagar kvar, och vad som ska vara klart innan lastbilen kommer.', nedrakning, 'prodblock--montage') +
        block('<svg class="emo-ik" aria-hidden="true"><use href="#i-varning"/></svg>', 'Att åtgärda', 'Det som saknas inför montagen. Viktigast först – klicka för att öppna projektet.', lista, 'prodblock--varn') +
      '</div>' +
      block('<svg class="emo-ik" aria-hidden="true"><use href="#i-fabrik"/></svg>', 'Husets resa', 'Från ritning till nyckel i 3D – resan spelas upp av sig själv. Klicka på ett steg för att flyga dit och på ett hus för att öppna det.', '<div class="resa3d" data-resa3d role="img" aria-label="Husets resa i 3D, från ritning till nyckel"></div>' + fabrik, 'prodblock--fabrik') +
    '</section>';
  }

  function kalender() {
    var idag = new Date(); idag.setHours(0, 0, 0, 0);
    var forsta = new Date(idag.getFullYear(), idag.getMonth() + kalForskjut, 1);
    var start = new Date(forsta); start.setDate(1 - ((forsta.getDay() + 6) % 7));
    var allaH = kalHandelser();
    var synliga = allaH.filter(function (h) { return !kalAv[h.slag]; });
    var perDag = {};
    synliga.forEach(function (h) { (perDag[h.dag] = perDag[h.dag] || []).push(h); });
    var ordning = { montage: 0, start: 1, offert: 2, uppgift: 3, mote: 4 };
    Object.keys(perDag).forEach(function (k) { perDag[k].sort(function (a, b) { return ordning[a.slag] - ordning[b.slag]; }); });
    var idagStr = IH.dagStr(idag);
    var vald = kalVald || idagStr;
    var iManad = function (h) { var d = new Date(h.dag); return d.getMonth() === forsta.getMonth() && d.getFullYear() === forsta.getFullYear(); };
    var filter = '<div class="kal__filter" role="group" aria-label="Visa i kalendern">' + KAL_SLAG.map(function (s) {
      var antal = allaH.filter(function (h) { return h.slag === s[0] && iManad(h); }).length;
      return '<button type="button" data-g="kal-slag" data-s="' + s[0] + '" aria-pressed="' + !kalAv[s[0]] + '" style="--f:' + s[3] + '"><span aria-hidden="true">' + s[2] + '</span>' + s[1] + '<b>' + antal + '</b></button>';
    }).join('') + '</div>';
    var huvud = '<div class="kal__huvud"><div class="kal__nav"><button type="button" data-g="kal-man" data-d="-1" aria-label="Förra månaden">' + i('pil') + '</button>' +
      '<h2>' + MANAD[forsta.getMonth()].charAt(0).toUpperCase() + MANAD[forsta.getMonth()].slice(1) + ' <span>' + forsta.getFullYear() + '</span></h2>' +
      '<button type="button" data-g="kal-man" data-d="1" aria-label="Nästa månad">' + i('pil') + '</button>' +
      (kalForskjut ? '<button type="button" class="kal__idag" data-g="kal-man" data-d="0">I dag</button>' : '') + '</div>' + filter + '</div>';
    var rutor = '<div class="kal__dagnamn"><span></span>' + ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
    for (var w = 0; w < 6; w++) {
      var mand = new Date(start); mand.setDate(start.getDate() + w * 7);
      if (w > 3 && mand.getMonth() !== forsta.getMonth()) break;
      var veckansMontage = 0;
      var dagar = '';
      for (var dd = 0; dd < 7; dd++) {
        var dag = new Date(mand); dag.setDate(mand.getDate() + dd);
        var ds = IH.dagStr(dag), l = perDag[ds] || [];
        veckansMontage += l.filter(function (h) { return h.slag === 'montage'; }).length;
        var cls = 'kal__dag' + (dag.getMonth() !== forsta.getMonth() ? ' kal__dag--utanfor' : '') + (ds === idagStr ? ' kal__dag--idag' : '') +
          (dd >= 5 ? ' kal__dag--helg' : '') + (dag < idag ? ' kal__dag--forbi' : '') + (ds === vald ? ' vald' : '') + (l.some(function (h) { return h.slag === 'montage'; }) ? ' kal__dag--montage' : '');
        dagar += '<button type="button" class="' + cls + '" data-g="kal-dag" data-dag="' + ds + '" style="--n:' + (w * 7 + dd) + '" aria-label="' + dagNamn(dag) + (l.length ? ', ' + l.length + ' händelser' : '') + '">' +
          '<span class="kal__nr">' + dag.getDate() + (ds === idagStr ? '<em>i dag</em>' : '') + '</span>' +
          l.slice(0, 3).map(function (h) {
            var s = slag(h.slag);
            return '<span class="kal__h kal__h--' + h.slag + (h.klar ? ' kal__h--klar' : '') + '" style="--f:' + s[3] + '" title="' + e(s[1] + ': ' + h.titel + (h.under ? ' · ' + h.under : '') + (h.varning ? ' · ' + h.varning : '')) + '">' +
              (h.slag === 'montage' && h.bild ? '<img src="' + h.bild + '" alt="">' : '<i aria-hidden="true">' + s[2] + '</i>') +
              '<b>' + e(h.kort || h.titel) + '</b>' + (h.varning ? '<em class="kal__varn" title="' + e(h.varning) + '">!</em>' : '') + '</span>';
          }).join('') + (l.length > 3 ? '<span class="kal__fler">+' + (l.length - 3) + ' till</span>' : '') + '</button>';
      }
      rutor += '<div class="kal__vecka' + (veckansMontage > 1 ? ' kal__vecka--full' : '') + '"><span class="kal__vnr" title="Vecka ' + IH.vecka(mand) + '">v.' + IH.vecka(mand) +
        (veckansMontage ? '<em>' + veckansMontage + ' <svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg></em>' : '') + '</span>' + dagar + '</div>';
    }
    // Sidan: vald dag och de närmaste två veckorna.
    var valdDag = new Date(vald + 'T12:00:00');
    var valdaH = (perDag[vald] || []);
    var rad = function (h, visaDag) {
      var s = slag(h.slag), d = new Date(h.dag + 'T12:00:00');
      var inne = '<span class="kal__radikon" style="--f:' + s[3] + '">' + (h.slag === 'montage' && h.bild ? '<img src="' + h.bild + '" alt="">' : s[2]) + '</span>' +
        '<span class="kal__radtext"><b>' + e(h.titel) + '</b><small>' + (visaDag ? dagNamn(d) + (h.under ? ' · ' : '') : '') + e(h.under) + '</small>' +
        (h.varning ? '<em><svg class="emo-ik" aria-hidden="true"><use href="#i-varning"/></svg> ' + e(h.varning) + '</em>' : '') + (h.klar ? '<em class="klar"><svg class="emo-ik" aria-hidden="true"><use href="#i-bock"/></svg> Klart</em>' : '') + '</span>';
      return h.g ? '<button type="button" class="kal__rad" data-g="' + h.g + '" data-id="' + e(h.id) + '">' + inne + i('pil') + '</button>' : '<div class="kal__rad">' + inne + '</div>';
    };
    var snart = synliga.filter(function (h) { var t = dagarTill(h.dag + 'T12:00:00'); return t >= 0 && t <= 14 && h.dag !== vald && !h.klar; })
      .sort(function (a, b) { return a.dag < b.dag ? -1 : a.dag > b.dag ? 1 : ordning[a.slag] - ordning[b.slag]; });
    var t = dagarTill(vald + 'T12:00:00');
    var sida = '<aside class="kal__sida"><div class="kal__sidadel">' +
      '<div class="kal__valdag"><span class="kal__valdatum"><b>' + valdDag.getDate() + '</b><small>' + MANAD[valdDag.getMonth()].slice(0, 3) + '</small></span>' +
        '<span><small>' + (t === 0 ? 'I dag' : t === 1 ? 'I morgon' : t === -1 ? 'I går' : (t > 0 ? 'Om ' + t + ' dagar' : t * -1 + ' dagar sedan')) + ' · v. ' + IH.vecka(valdDag) + '</small><b>' + dagNamn(valdDag) + '</b></span></div>' +
      (valdaH.length ? '<div class="kal__lista" data-stagger>' + valdaH.map(function (h) { return rad(h, false); }).join('') + '</div>'
        : '<p class="kal__tom"><span aria-hidden="true">' + (valdDag.getDay() % 6 === 0 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-grodd"/></svg>' : '<svg class="emo-ik" aria-hidden="true"><use href="#i-sol"/></svg>') + '</span>Inget inplanerat den här dagen.</p>') +
      '</div><div class="kal__sidadel"><p class="etikett etikett--ljus kal__snartrubrik">Närmaste två veckorna</p>' +
      (snart.length ? '<div class="kal__lista kal__lista--snart">' + snart.slice(0, 6).map(function (h) { return rad(h, true); }).join('') + '</div>'
        : '<p class="kal__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-grodd"/></svg></span>Lugnt framåt.</p>') +
    '</div></aside>';
    var hjalp = '<p class="kal__hjalp"><span><svg class="emo-ik" aria-hidden="true"><use href="#i-pil"/></svg> Klicka på en dag för att se allt som händer då.</span><span><b class="kal__hjalpvnr">1 <svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg></b> = montage den veckan</span>' +
      '<span><b class="kal__hjalpvarn">!</b> = saker kvar inför montaget</span><span>Knapparna ovanför tänder och släcker.</span></p>';
    return '<section class="kal kort" data-in><div class="kal__ram"><div class="prodblock__huvud kal__rubrik"><span class="prodblock__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-kalender"/></svg></span>' +
      '<span><h3>Kalender</h3><p>Montage, projektstarter, uppgifter, möten och offerter som går ut.</p></span></div>' + huvud + hjalp + '<div class="kal__kropp"><div class="kal__rutnat">' + rutor + '</div>' + sida + '</div></div></section>';
  }

  IH.vyer.produktion = function (del) {
    var proj = db().projekt;
    var aktiva = proj.filter(function (p) { return p.steg !== 'klart'; });
    var punkter = aktiva.length * CHECK.length;
    var klaraP = aktiva.reduce(function (s, p) { return s + CHECK.filter(function (c) { return p.check[c[0]]; }).length; }, 0);
    var nasta = aktiva.filter(function (p) { return p.montage && dagarTill(p.montage) >= 0; }).sort(function (a, b) { return a.montage < b.montage ? -1 : 1; })[0];
    var nk = nasta ? IH.kund(nasta.kund) : null;
    var html = '<h1 class="dold">Projekt</h1>' +
      prodTopp(proj, aktiva, nyckelband([
        ['<svg class="emo-ik" aria-hidden="true"><use href="#i-projekt"/></svg>', 'Aktiva projekt', aktiva.length, 'tal', proj.length - aktiva.length + ' klara'],
        ['<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>', 'Nästa montage', nasta ? 'v. ' + IH.vecka(new Date(nasta.montage)) : '–', 'text', nasta ? e(nk ? nk.namn : '') + ' · om ' + dagarTill(nasta.montage) + ' d' : 'inget planerat'],
        ['<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg>', 'Checklistor klara', punkter ? klaraP / punkter * 100 : 0, 'pct', klaraP + ' av ' + punkter + ' punkter', punkter ? klaraP / punkter : 0],
        ['<svg class="emo-ik" aria-hidden="true"><use href="#i-pengar"/></svg>', 'Värde i produktion', aktiva.reduce(function (s, p) { var a = p.affar ? IH.affar(p.affar) : null; return s + (a ? a.varde : 0); }, 0), 'kort', 'signerade ordrar']
      ])) +
      kalender() +
      '<div class="prodrubrik"><p class="etikett">Alla projekt</p><h2>Från ritning till nyckel</h2><p>Varje kolumn är ett steg. När ett steg är klart flyttar du huset vidare med pilen på kortet, eller öppnar projektet och väljer steg.</p></div>' +
      '<div class="tavla tavla--prod">' + IH.PROJSTEG.map(function (s) {
        var l = proj.filter(function (p) { return p.steg === s.id; });
        return '<section class="spalt" style="--f:' + s.farg + '"><header class="spalt__huvud"><div><b><span class="spalt__emoji" aria-hidden="true">' + (STEG_EMOJI[s.id] || '') + '</span>' + e(s.namn) + '</b><span>' + l.length + '</span></div><small>' + e(s.text) + '</small></header>' +
          '<div class="spalt__kort" data-stagger>' + (l.length ? l.map(projKort).join('') : '<p class="spalt__tom"><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-gnista"/></svg></span>Inget här just nu</p>') + '</div></section>';
      }).join('') + '</div>';
    return {
      titel: 'Projekt', html: html,
      efter: function (rot) {
        rot.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('aff--proj')) { ev.preventDefault(); projArk(ev.target.getAttribute('data-id')); }
        });
        if (del[0] && projOppnad !== location.hash) { projOppnad = location.hash; setTimeout(function () { projArk(del[0]); }, 60); }
        if (!del[0]) projOppnad = null;
      }
    };
  };

  // Kalenderns knappar: månad, slag och dag ritar om vyn på plats.
  G['kal-man'] = function (el) {
    var d = parseInt(el.getAttribute('data-d'), 10);
    kalForskjut = d === 0 ? 0 : kalForskjut + d;
    if (d === 0) kalVald = null;
    IH.ritaOm();
  };
  G['kal-slag'] = function (el) {
    var s = el.getAttribute('data-s');
    kalAv[s] = !kalAv[s];
    IH.ritaOm();
  };
  G['kal-dag'] = function (el) {
    kalVald = el.getAttribute('data-dag');
    IH.ritaOm();
  };

  var CHECK = [['ritning', 'Ritningar klara'], ['lov', 'Bygglov eller anmälan inlämnad'], ['grund', 'Grund, el, vatten och avlopp klart'], ['framkomlighet', 'Framkomlighet för lastbil och kran']];
  function projKort(p) {
    var m = IH.modell(p.modell), k = IH.kund(p.kund), s = IH.projsteg(p.steg);
    var klara = CHECK.filter(function (c) { return p.check[c[0]]; }).length;
    var ids = IH.PROJSTEG.map(function (x) { return x.id; });
    var nasta = ids[ids.indexOf(p.steg) + 1];
    var dagar = dagarTill(p.montage);
    return '<article class="aff aff--proj" data-g="proj-oppna" data-id="' + p.id + '" tabindex="0" role="button" style="--f:' + s.farg + '" aria-label="' + e(k ? k.namn : '') + ', ' + e(m ? m.namn : '') + ', ' + e(s.namn) + '">' +
      '<div class="aff__topp">' + (m ? '<span class="aff__bild"><img src="' + m.tumme + '" alt="" loading="lazy"></span>' : '') + '<span class="aff__modell">' + e(m ? m.namn : '') + '</span>' + ring(klara / CHECK.length * 100, s.farg) + '</div>' +
      '<b class="aff__titel">' + e(k ? k.namn : '') + '</b><span class="aff__kund"><svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg> ' + e(k ? k.ort : '') + '</span>' +
      '<div class="aff__fot proj__fot">' + (p.steg === 'klart'
        ? '<span class="proj__montage proj__montage--klar"><svg class="emo-ik" aria-hidden="true"><use href="#i-nyckel"/></svg> Överlämnat</span>'
        : '<span class="proj__montage' + (dagar >= 0 && dagar <= 21 ? ' proj__montage--snart' : '') + '"><svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg> v. ' + IH.vecka(new Date(p.montage)) + (dagar >= 0 ? ' · om ' + dagar + ' d' : '') + '</span>') +
        '<span class="proj__check' + (klara === CHECK.length ? ' proj__check--klar' : '') + '" title="' + klara + ' av ' + CHECK.length + ' punkter klara"><i style="--a:' + (klara / CHECK.length).toFixed(2) + '"></i><small>' + (klara === CHECK.length ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg> Allt klart' : klara + '/' + CHECK.length + ' klart') + '</small></span></div>' +
      '<div class="aff__verktyg">' +
        (k && k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring ' + e(forsta(k.namn)) + '" aria-label="Ring ' + e(forsta(k.namn)) + '">' + i('tel') + '</button>' : '') +
        (k ? '<button type="button" data-g="kund-oppna" data-id="' + k.id + '" title="Kundkortet" aria-label="Kundkortet">' + i('kunder') + '</button>' : '') +
        (nasta ? '<button type="button" data-g="proj-nasta" data-id="' + p.id + '" title="Nästa steg: ' + e(IH.projsteg(nasta).namn) + '" aria-label="Nästa steg: ' + e(IH.projsteg(nasta).namn) + '">' + i('pil') + '</button>' : '') +
        '<button type="button" data-g="proj-oppna" data-id="' + p.id + '" title="Öppna projektet" aria-label="Öppna projektet">' + i('ogon') + '</button>' +
      '</div></article>';
  }

  function projArk(id) {
    var p = IH.projekt(id);
    if (!p) return;
    var m = IH.modell(p.modell), k = IH.kund(p.kund), a = IH.affar(p.affar);
    var idx = IH.PROJSTEG.map(function (s) { return s.id; }).indexOf(p.steg);
    var montage = new Date(p.montage);
    var kropp = '<div class="projark__3d">' + (m && m.glb ? '<model-viewer src="' + m.glb + '" alt="' + e(m.namn) + ' i 3D" camera-orbit="35deg 72deg auto" auto-rotate auto-rotate-delay="0" rotation-per-second="12deg" camera-controls interaction-prompt="none" shadow-intensity="1.1" exposure="1.38" tone-mapping="neutral" environment-image="neutral"></model-viewer>'
        : (m ? '<img src="' + m.bild + '" alt="">' : '')) +
        '<div class="projark__glas"><small>' + e(IH.projsteg(p.steg).namn) + '</small><b>' + e(m ? m.kategori + ' ' + m.namn : '') + '</b><span>Montage vecka ' + IH.vecka(montage) + ' · ' + IH.datum(p.montage) + '</span></div></div>' +
      '<ol class="stegare stegare--prod">' + IH.PROJSTEG.map(function (st, n) {
        return '<li class="' + (n < idx ? 'klar' : n === idx ? 'nu' : '') + '" style="--f:' + st.farg + '"><button type="button" data-g="proj-steg" data-id="' + p.id + '" data-steg="' + st.id + '"><i></i><span>' + e(st.kort) + '</span></button></li>';
      }).join('') + '</ol>' +
      '<section class="projark__check"><h3>' + i('uppgift') + 'Innan montaget</h3><ul>' + CHECK.map(function (c) {
        return '<li><button type="button" class="checkrad' + (p.check[c[0]] ? ' klar' : '') + '" data-g="proj-check" data-id="' + p.id + '" data-c="' + c[0] + '" aria-pressed="' + !!p.check[c[0]] + '"><span>' + i('bock') + '</span>' + e(c[1]) +
          (c[0] === 'grund' || c[0] === 'framkomlighet' || c[0] === 'lov' ? '<small>Kunden</small>' : '<small>Legohus</small>') + '</button></li>';
      }).join('') + '</ul></section>' +
      '<form class="formular projark__datum" data-form="proj-montage"><input type="hidden" name="id" value="' + p.id + '"><label class="falt"><span>Montagedag</span>' +
      '<input type="date" name="montage" value="' + IH.dagStr(montage) + '"></label><button class="knapp knapp--liten" type="submit">Spara datum</button></form>' +
      '<div class="rutnat rutnat--2 affark__fakta"><a class="affark__ruta" href="#/kunder/' + (k ? k.id : '') + '">' + kundAvatar(k) + '<span><small>Kund</small><b>' + e(k ? k.namn : '') + '</b><em>' + e(k ? k.telefon : '') + '</em></span></a>' +
      '<div class="affark__ruta"><span class="kort__ikon">' + i('offert') + '</span><span><small>Ordervärde</small><b class="tal">' + IH.kr(a ? a.varde : 0) + '</b><em>' + e(a ? a.titel : '') + '</em></span></div></div>';
    IH.oppnaArk({ titel: (k ? k.namn : 'Projekt'), under: e(m ? m.namn : '') + ' · ' + e(k ? k.ort : ''), ikon: 'produktion', kropp: kropp, bred: true });
    laddaModelViewer();
  }
  IH.projArk = projArk;
  G['proj-oppna'] = function (el) { projArk(el.getAttribute('data-id')); };
  // alla hus i ett steg, när de är fler än ett
  G['steg-hus'] = function (el) {
    var id = el.getAttribute('data-steg'), st = IH.PROJSTEG.find(function (x) { return x.id === id; }) || { namn: 'Steget' };
    var l = (IH.db.projekt || []).filter(function (p) { return p.steg === id; });
    IH.oppnaArk({
      titel: st.namn, ikon: 'fabrik', under: l.length + ' hus i det här steget',
      kropp: '<div class="lista">' + l.map(function (p) {
        var m = IH.modell(p.modell), k = IH.kund(p.kund);
        return '<button class="lista__rad" type="button" data-g="proj-oppna" data-id="' + p.id + '">' + (m ? tumme(m.tumme) : '') + '<span class="lista__text"><b>' + e(k ? k.namn : 'Projekt') + '</b><small>' + e(m ? m.namn : '') + (p.montage ? ' · montage v. ' + IH.vecka(new Date(p.montage)) : '') + '</small></span></button>';
      }).join('') + '</div>'
    });
  };
  // Nästa steg direkt från kortet.
  G['proj-nasta'] = function (el) {
    var p = IH.projekt(el.getAttribute('data-id'));
    var ids = IH.PROJSTEG.map(function (x) { return x.id; });
    var n = p ? ids.indexOf(p.steg) : -1;
    if (n < 0 || n >= ids.length - 1) return;
    var st = ids[n + 1];
    p.steg = st;
    p.andrad = new Date().toISOString();
    IH.logga('system', 'Projektet flyttat till ' + IH.projsteg(st).namn + '.', p.kund, p.affar);
    IH.spara();
    var r = el.getBoundingClientRect();
    IH.ritaOm();
    IH.lysUpp('.aff--proj[data-id="' + p.id + '"]', 'aff--ny');
    var k = IH.kund(p.kund);
    if (st === 'klart') { IH.konfetti(r.left + r.width / 2, r.top); IH.toast('Huset är överlämnat!', 'Projektet är klart.', 'trofe'); }
    else IH.toast('Flyttat till ' + IH.projsteg(st).namn, k ? k.namn : '', 'produktion');
  };
  G['proj-steg'] = function (el) {
    var p = IH.projekt(el.getAttribute('data-id'));
    var st = el.getAttribute('data-steg');
    p.steg = st;
    p.andrad = new Date().toISOString();
    IH.logga('system', 'Projektet flyttat till ' + IH.projsteg(st).namn + '.', p.kund, p.affar);
    IH.spara();
    var r = el.getBoundingClientRect();
    IH.stangArk(true);
    IH.ritaOm();
    if (st === 'klart') { IH.konfetti(r.left + r.width / 2, r.top); IH.toast('Huset är överlämnat!', 'Projektet är klart.', 'trofe'); }
    else setTimeout(function () { projArk(p.id); }, 30);
  };
  G['proj-check'] = function (el) {
    var p = IH.projekt(el.getAttribute('data-id'));
    var c = el.getAttribute('data-c');
    p.check[c] = !p.check[c];
    IH.spara();
    el.classList.toggle('klar', p.check[c]);
    el.setAttribute('aria-pressed', String(p.check[c]));
    var kort = $('[data-g="proj-oppna"][data-id="' + p.id + '"] .ring');
    if (kort) {
      var klara = CHECK.filter(function (x) { return p.check[x[0]]; }).length;
      kort.style.setProperty('--p', klara / CHECK.length * 100);
      $('b', kort).textContent = Math.round(klara / CHECK.length * 100);
    }
  };
  FORM['proj-montage'] = function (f, d) {
    var p = IH.projekt(d.get('id'));
    p.montage = new Date(d.get('montage') + 'T08:00:00').toISOString();
    IH.logga('system', 'Montage flyttat till ' + IH.datum(p.montage) + '.', p.kund, p.affar);
    IH.spara();
    IH.stangArk(true);
    IH.ritaOm();
    IH.toast('Montagedagen är sparad', 'Vecka ' + IH.vecka(new Date(p.montage)), 'kalender');
  };

  var mvLaddad = false;
  function laddaModelViewer() {
    if (mvLaddad || window.customElements && customElements.get('model-viewer')) return;
    mvLaddad = true;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = '../vendor/model-viewer.min.js';
    document.head.appendChild(s);
  }
  IH.laddaModelViewer = laddaModelViewer;

  /* ================================================================
     Att göra
     ================================================================ */
  // Att göra (omgjord 2026-10-08): typen läses ur texten och visas som
  // emoji, tiden står i klartext ("I dag", "I morgon", "Försenad 2 dagar")
  // och raden har snabbknappar för att ringa eller öppna kunden.
  var UPPG_TYP = [
    [/offert/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-dokument"/></svg>', 'Offert'],
    [/platsbesök|besök|tomtkoll/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-plats"/></svg>', 'Platsbesök'],
    [/^ring|samtal|telefon/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-samtal"/></svg>', 'Samtal'],
    [/mejl|mail|skicka/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-mejl"/></svg>', 'Mejl'],
    [/möte|träff/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-handslag"/></svg>', 'Möte'],
    [/boka|montage|kran|leverans/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-kalender"/></svg>', 'Bokning']
  ];
  function uppgTyp(text) {
    for (var n = 0; n < UPPG_TYP.length; n++) if (UPPG_TYP[n][0].test(text || '')) return UPPG_TYP[n];
    return [null, '<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg>', 'Uppgift'];
  }
  function uppgNar(u) {
    var t = dagarTill(u.forfaller);
    if (u.klar) return ['klar', 'Klar'];
    if (t < 0) return ['sen', 'Försenad ' + (-t) + (t === -1 ? ' dag' : ' dagar')];
    if (t === 0) return ['idag', 'I dag'];
    if (t === 1) return ['morgon', 'I morgon'];
    return ['', 'Om ' + t + ' dagar'];
  }
  function uppgiftRad(u) {
    var k = u.kund ? IH.kund(u.kund) : null;
    var typ = uppgTyp(u.text), nar = uppgNar(u);
    var sen = nar[0] === 'sen';
    return '<li class="uppg' + (u.klar ? ' uppg--klar' : '') + (sen ? ' uppg--sen' : '') + '">' +
      '<button class="uppg__bock" type="button" data-g="uppgift-klar" data-id="' + u.id + '" aria-pressed="' + u.klar + '" aria-label="Markera klar">' + i('bock') + '</button>' +
      '<span class="uppg__typ" title="' + typ[2] + '" aria-hidden="true">' + typ[1] + '</span>' +
      '<span class="uppg__text"><b>' + e(u.text) + '</b><small>' + (k ? '<a href="#/kunder/' + k.id + '">' + e(k.namn) + '</a> · ' : '') + typ[2] + '</small></span>' +
      '<span class="uppg__nar' + (nar[0] ? ' uppg__nar--' + nar[0] : '') + '">' + nar[1] + '</span>' +
      (!u.klar ? '<button type="button" class="uppg__skjut" data-g="ag-skjut" data-id="' + u.id + '" title="Skjut upp en dag" aria-label="Skjut upp en dag">+1 d</button>' : '') +
      (k && !u.klar ? '<span class="uppg__snabb">' +
        (k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring ' + e(forsta(k.namn)) + '" aria-label="Ring ' + e(forsta(k.namn)) + '">' + i('tel') + '</button>' : '') +
        '<button type="button" data-g="kund-oppna" data-id="' + k.id + '" title="Kundkortet" aria-label="Kundkortet">' + i('kunder') + '</button></span>' : '') +
      '</li>';
  }

  // Planeringen på Att göra: vy (vecka, två veckor, månad), förskjutning och filter. Allt räknas ur uppgifterna.
  var agUi = { vy: 'vecka', off: 0, vem: 'mina', typ: 'alla', sok: '' };
  var agFilter = function (x) {
    if (agUi.vem === 'mina' && x.ansvarig && x.ansvarig !== IH.jag().id) return false;
    if (agUi.typ !== 'alla' && uppgTyp(x.text)[2] !== agUi.typ) return false;
    if (agUi.sok) { var k = x.kund && IH.kund(x.kund), q = agUi.sok.toLowerCase(); if ((x.text + ' ' + (k ? k.namn : '')).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  };
  function agKalender(alla) {
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var start, dagar, rubrik;
    if (agUi.vy === 'man') {
      var f = new Date(idag0.getFullYear(), idag0.getMonth() + agUi.off, 1);
      start = new Date(f); start.setDate(1 - ((f.getDay() + 6) % 7));
      dagar = Math.ceil((((f.getDay() + 6) % 7) + new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()) / 7) * 7;
      rubrik = f.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    } else {
      var n = agUi.vy === 'tva' ? 14 : 7;
      start = new Date(idag0); start.setDate(idag0.getDate() - ((idag0.getDay() + 6) % 7) + agUi.off * n);
      dagar = n;
      var slut = new Date(start); slut.setDate(start.getDate() + n - 1);
      rubrik = 'Vecka ' + veckaNr(start) + (n === 14 ? '–' + veckaNr(slut) : '') + ' · ' + start.getDate() + ' ' + MANAD[start.getMonth()].slice(0, 3) + ' – ' + slut.getDate() + ' ' + MANAD[slut.getMonth()].slice(0, 3);
    }
    var max = 1, celler = [], tot = 0, sena = 0;
    for (var d = 0; d < dagar; d++) {
      var dag = new Date(start); dag.setDate(start.getDate() + d);
      var dag1 = new Date(dag); dag1.setHours(23, 59, 59, 999);
      var l = alla.filter(function (x) { var t = new Date(x.forfaller); return t >= dag && t <= dag1; });
      if (l.filter(function (x) { return !x.klar; }).length > max) max = l.filter(function (x) { return !x.klar; }).length;
      celler.push({ d: dag, l: l });
    }
    var tyngst = null;
    celler.forEach(function (c) { var k = c.l.filter(function (x) { return !x.klar; }).length; tot += k; if (c.d < idag0) sena += k; if (k && (!tyngst || k > tyngst.k)) tyngst = { d: c.d, k: k }; });
    var visa = agUi.vy === 'man' ? 2 : agUi.vy === 'tva' ? 3 : 5;
    var dagHtml = celler.map(function (c, n) {
      var t = c.d.getTime(), ut = agUi.vy === 'man' && c.d.getMonth() !== new Date(idag0.getFullYear(), idag0.getMonth() + agUi.off, 1).getMonth();
      var oppna = c.l.filter(function (x) { return !x.klar; }), klara = c.l.length - oppna.length, ds = IH.dagStr(c.d);
      return '<div class="agk__dag' + (t === idag0.getTime() ? ' idag' : '') + (t < idag0.getTime() ? ' forbi' : '') + (c.d.getDay() % 6 === 0 ? ' helg' : '') + (ut ? ' ut' : '') + (oppna.some(function (x) { return t < idag0.getTime(); }) ? ' sen' : '') + '" data-ag-dag="' + ds + '" style="--n:' + n + ';--last:' + (oppna.length / max).toFixed(2) + '">' +
        '<header><span><small>' + VECKODAG[c.d.getDay()].slice(0, 3) + '</small><b>' + c.d.getDate() + '</b></span>' +
          (oppna.length ? '<em>' + oppna.length + '</em>' : klara ? '<em class="klar">' + i('bock') + '</em>' : '') +
          '<button type="button" class="agk__plus" data-g="ag-ny-dag" data-dag="' + ds + '" aria-label="Ny uppgift ' + e(dagNamn(c.d)) + '" title="Ny uppgift den här dagen">' + i('plus') + '</button></header>' +
        '<i class="agk__last" aria-hidden="true"></i>' +
        '<div class="agk__lista">' + c.l.slice(0, visa).map(function (x) {
          var typ = uppgTyp(x.text), k = x.kund && IH.kund(x.kund);
          return '<span class="agk__u' + (x.klar ? ' klar' : '') + (!x.klar && t < idag0.getTime() ? ' sen' : '') + '" draggable="' + !x.klar + '" data-ag-uppg="' + x.id + '" title="' + e(x.text + (k ? ' · ' + k.namn : '')) + '">' + typ[1] + '<span>' + e(x.text) + '</span></span>';
        }).join('') + (c.l.length > visa ? '<button type="button" class="agk__fler" data-g="ag-dag-visa" data-dag="' + ds + '">+' + (c.l.length - visa) + ' till</button>' : '') +
        (!c.l.length && !ut ? '<span class="agk__fritt">' + (c.d.getDay() % 6 === 0 ? 'Helg' : 'Fritt') + '</span>' : '') + '</div></div>';
    }).join('');
    var seg = function (v, t) { return '<button type="button" data-g="ag-vy" data-f="' + v + '" aria-pressed="' + (agUi.vy === v) + '">' + t + '</button>'; };
    return '<section class="kort agk" data-in><header class="agk__huvud">' +
        '<div><p class="etikett">Planering</p><h2>' + e(rubrik.charAt(0).toUpperCase() + rubrik.slice(1)) + '</h2>' +
          '<p class="agk__lage"><span><b>' + tot + '</b> öppna i perioden</span>' + (tyngst ? '<span>Mest på <b>' + VECKODAG[tyngst.d.getDay()] + ' ' + tyngst.d.getDate() + '/' + (tyngst.d.getMonth() + 1) + '</b> (' + tyngst.k + ')</span>' : '') + (sena ? '<span class="sen"><b>' + sena + '</b> försenade</span>' : '') + '</p></div>' +
        '<div class="agk__verktyg"><span class="agk__nav"><button type="button" data-g="ag-off" data-d="-1" aria-label="Föregående">' + i('pilv') + '</button>' + (agUi.off ? '<button type="button" class="agk__idag" data-g="ag-off" data-d="0">I dag</button>' : '') + '<button type="button" data-g="ag-off" data-d="1" aria-label="Nästa">' + i('pil') + '</button></span>' +
          '<span class="tv-seg" role="group" aria-label="Vy">' + seg('vecka', 'Vecka') + seg('tva', '2 veckor') + seg('man', 'Månad') + '</span></div></header>' +
      '<div class="agk__rutnat agk__rutnat--' + agUi.vy + '"' + (agUi.vy !== 'vecka' ? '' : '') + '>' + (agUi.vy === 'man' ? ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(function (x) { return '<span class="agk__vd">' + x + '</span>'; }).join('') : '') + dagHtml + '</div>' +
      '<p class="agk__tips">' + IH.emo('glodlampa') + 'Dra en uppgift till en annan dag för att flytta den. Tryck på + för att lägga till en uppgift den dagen.</p></section>';
  }
  function veckaNr(d) { var t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7); var v1 = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - v1) / 864e5 - 3 + (v1.getDay() + 6) % 7) / 7); }

  IH.vyer['att-gora'] = function () {
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var idag1 = new Date(); idag1.setHours(23, 59, 59, 999);
    var allaU = db().uppgifter.slice().sort(function (a, b) { return a.forfaller < b.forfaller ? -1 : 1; });
    var u = allaU.filter(agFilter);
    var grupper = [
      ['Försenade', u.filter(function (x) { return !x.klar && new Date(x.forfaller) < idag0; }), '⏰', 'Det här skulle ha gjorts tidigare.'],
      ['I dag', u.filter(function (x) { return !x.klar && new Date(x.forfaller) >= idag0 && new Date(x.forfaller) <= idag1; }), '<svg class="emo-ik" aria-hidden="true"><use href="#i-sol"/></svg>', 'Bocka av när det är gjort.'],
      ['Kommande', u.filter(function (x) { return !x.klar && new Date(x.forfaller) > idag1; }), '<svg class="emo-ik" aria-hidden="true"><use href="#i-kalender"/></svg>', 'Det som väntar de närmaste dagarna.'],
      ['Klara', u.filter(function (x) { return x.klar; }), '<svg class="emo-ik" aria-hidden="true"><use href="#i-klar"/></svg>', 'Bra jobbat. Klicka på bocken för att ångra.']
    ];
    var dagens = u.filter(function (x) { return new Date(x.forfaller) <= idag1 && (!x.klar || (x.klarTid && new Date(x.klarTid) >= idag0)); });
    var dagKlara = dagens.filter(function (x) { return x.klar; }).length;
    var andel = dagens.length ? dagKlara / dagens.length : 1;
    var kvarIdag = dagens.filter(function (x) { return !x.klar; });
    var sena = grupper[0][1].length;
    // Dagens uppgifter per typ, till meningen och brickorna.
    var perTyp = {};
    kvarIdag.forEach(function (x) { var t = uppgTyp(x.text); (perTyp[t[2]] = perTyp[t[2]] || [t[1], t[2], 0])[2] += 1; });
    var typLista = Object.keys(perTyp).map(function (k) { return perTyp[k]; }).sort(function (a, b) { return b[2] - a[2]; });
    var imorgon = u.filter(function (x) { return !x.klar && dagarTill(x.forfaller) === 1; });
    var jag = IH.jag();
    var mening = kvarIdag.length
      ? 'Du har <b>' + kvarIdag.length + (kvarIdag.length === 1 ? ' uppgift' : ' uppgifter') + ' kvar i dag</b>' + (sena ? ', varav ' + sena + ' försenad' + (sena === 1 ? '' : 'e') : '') + '.' +
        (imorgon.length ? ' I morgon väntar ' + imorgon.length + (imorgon.length === 1 ? ' till.' : ' till.') : '')
      : (dagens.length ? 'Allt för i dag är klart.' : 'Inget inplanerat i dag.') + (imorgon.length ? ' I morgon väntar ' + imorgon.length + (imorgon.length === 1 ? ' uppgift.' : ' uppgifter.') : '');
    var DAGK = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    var vecka = [];
    for (var v = 0; v < 7; v++) {
      var d = new Date(idag0); d.setDate(d.getDate() + v);
      var d1 = new Date(d); d1.setHours(23, 59, 59, 999);
      vecka.push({ d: d, l: u.filter(function (x) { return !x.klar && new Date(x.forfaller) >= d && new Date(x.forfaller) <= d1; }) });
    }
    var h = new Date().getHours();
    var dygnEmoji = h < 5 || h >= 22 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-mane"/></svg>' : h < 10 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-soluppgang"/></svg>' : h < 17 ? '<svg class="emo-ik" aria-hidden="true"><use href="#i-sol"/></svg>' : '<svg class="emo-ik" aria-hidden="true"><use href="#i-mane"/></svg>';
    var topp = '<section class="dagtopp kort kort--mork" data-in>' +
      '<div class="dagtopp__ord"><p class="etikett etikett--ljus">Din dag · ' + dagNamn(idag0) + '</p>' +
        '<h2>' + IH.hej() + ', ' + e(forsta(jag.namn)) + '. <span class="dagtopp__emoji" aria-hidden="true">' + dygnEmoji + '</span></h2>' +
        '<p class="dagtopp__text">' + mening + '</p>' +
        (typLista.length ? '<div class="dagtopp__typer">' + typLista.map(function (t) {
          var fler = { Offert: 'offerter', 'Möte': 'möten', Bokning: 'bokningar', Uppgift: 'uppgifter' };
          return '<span><i aria-hidden="true">' + t[0] + '</i><b>' + t[2] + '</b> ' + (t[2] > 1 && fler[t[1]] ? fler[t[1]] : t[1].toLowerCase()) + '</span>';
        }).join('') + '</div>' : '') + '</div>' +
      '<div class="dagtopp__ring' + (dagens.length && dagKlara === dagens.length ? ' dagtopp__ring--klar' : '') + (dagKlara ? '' : ' dagtopp__ring--noll') + '" style="--p:' + (andel * 100).toFixed(1) + '">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle class="dagtopp__fyll" cx="60" cy="60" r="50" pathLength="100"/></svg>' +
        '<span><b>' + dagKlara + '<em>/' + dagens.length + '</em></b><small>' + (dagens.length && dagKlara === dagens.length ? 'Dagen är klar' : 'klara i dag') + '</small></span></div>' +
      '<div class="dagtopp__vecka" aria-label="De närmaste sju dagarna">' + vecka.map(function (x, n) {
        var helg = x.d.getDay() % 6 === 0;
        return '<span class="dagkort' + (n === 0 ? ' dagkort--idag' : '') + (helg ? ' dagkort--helg' : '') + (x.l.length ? ' dagkort--har' : '') + '" style="--n:' + n + '">' +
          '<small>' + (n === 0 ? 'I dag' : n === 1 ? 'I morgon' : DAGK[x.d.getDay()]) + '</small><b>' + x.d.getDate() + '</b>' +
          '<span class="dagkort__emoji">' + (x.l.length ? x.l.slice(0, 3).map(function (y) { return uppgTyp(y.text)[1]; }).join('') : '<i>·</i>') + '</span>' +
          '<em>' + (x.l.length ? x.l.length + (x.l.length === 1 ? ' uppgift' : ' uppgifter') : 'fritt') + '</em></span>';
      }).join('') + '</div>' +
    '</section>';
    var typer = ['alla'].concat(UPPG_TYP.map(function (t) { return t[2]; })).concat(['Uppgift']);
    var verktyg = '<div class="agv" data-in>' +
      '<label class="agv__sok">' + i('sok') + '<input type="search" data-ag-sok placeholder="Sök uppgift eller kund" value="' + e(agUi.sok) + '" aria-label="Sök"></label>' +
      '<span class="tv-seg" role="group" aria-label="Vems">' + [['mina', 'Mina'], ['alla', 'Alla']].map(function (x) { return '<button type="button" data-g="ag-vem" data-f="' + x[0] + '" aria-pressed="' + (agUi.vem === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span>' +
      '<span class="agv__typer">' + typer.map(function (t) { var n = allaU.filter(function (x) { return !x.klar && (agUi.vem !== 'mina' || !x.ansvarig || x.ansvarig === IH.jag().id) && (t === 'alla' || uppgTyp(x.text)[2] === t); }).length; if (t !== 'alla' && !n) return ''; return '<button type="button" class="ap-filter" data-g="ag-typ" data-f="' + t + '" aria-pressed="' + (agUi.typ === t) + '">' + (t === 'alla' ? 'Allt' : t) + ' <b>' + n + '</b></button>'; }).join('') + '</span>' +
      '<span class="agv__hoger">' + (grupper[0][1].length ? '<button type="button" class="ap-filter agv__flytta" data-g="ag-sena-idag">' + i('klocka') + 'Flytta ' + grupper[0][1].length + ' försenade till i dag</button>' : '') +
        '<button type="button" class="tv-ikon" data-g="ag-csv" title="Exportera uppgifterna som CSV">' + i('skrivut') + '</button></span></div>';
    var html = '<h1 class="dold">Att göra</h1>' +
      topp + agKalender(u) + verktyg + '<form class="nyuppg kort" data-form="uppgift" data-in><span class="nyuppg__plus" aria-hidden="true">' + i('plus') + '</span><input name="text" placeholder="Ny uppgift – t.ex. Ring Karin om tomten" required autocomplete="off">' +
      '<select name="kund" aria-label="Kund"><option value="">Ingen kund</option>' + db().kunder.map(function (k) { return '<option value="' + k.id + '">' + e(k.namn) + '</option>'; }).join('') + '</select>' +
      '<input type="date" name="datum" value="' + IH.dagStr() + '" aria-label="Datum"><button class="knapp knapp--mork knapp--liten" type="submit">Lägg till</button></form>' +
      '<p class="nyuppg__tips"><svg class="emo-ik" aria-hidden="true"><use href="#i-glodlampa"/></svg> Skriv som du pratar – "Ring …", "Skicka offert …" eller "Platsbesök …" får rätt ikon av sig själv.</p>' +
      grupper.filter(function (g) { return g[1].length; }).map(function (g) {
        return '<section class="kort uppgrupp' + (g[0] === 'Försenade' ? ' uppgrupp--sen' : '') + (g[0] === 'Klara' ? ' uppgrupp--klara' : '') + '" data-in><header class="kort__huvud"><h2><span class="uppgrupp__emoji" aria-hidden="true">' + g[2] + '</span>' +
          '<span class="uppgrupp__namn">' + g[0] + '<small>' + g[3] + '</small></span><b class="chip">' + g[1].length + '</b></h2></header>' +
          '<div class="kort__kropp"><ul class="uppglista" data-stagger>' + g[1].map(uppgiftRad).join('') + '</ul></div></section>';
      }).join('');
    return { titel: 'Att göra', html: html };
  };
  G['ag-vy'] = function (el) { agUi.vy = el.getAttribute('data-f'); agUi.off = 0; IH.rita(); };
  G['ag-off'] = function (el) { var d = +el.getAttribute('data-d'); agUi.off = d ? agUi.off + d : 0; IH.rita(); };
  G['ag-vem'] = function (el) { agUi.vem = el.getAttribute('data-f'); IH.rita(); };
  G['ag-typ'] = function (el) { agUi.typ = el.getAttribute('data-f'); IH.rita(); };
  G['ag-ny-dag'] = function (el) {
    var f = $('.nyuppg'); if (!f) return;
    f.datum.value = el.getAttribute('data-dag'); f.datum.dispatchEvent(new Event('change', { bubbles: true }));
    f.scrollIntoView({ behavior: IH.lugn ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function () { f.text.focus(); }, IH.lugn ? 0 : 350);
    f.classList.remove('nyuppg--puls'); void f.offsetWidth; f.classList.add('nyuppg--puls');
  };
  G['ag-dag-visa'] = function (el) {
    var ds = el.getAttribute('data-dag'), d0 = new Date(ds + 'T00:00:00'), d1 = new Date(ds + 'T23:59:59');
    var l = db().uppgifter.filter(function (x) { var t = new Date(x.forfaller); return t >= d0 && t <= d1 && agFilter(x); });
    IH.oppnaArk({ titel: dagNamn(d0), under: l.length + (l.length === 1 ? ' uppgift' : ' uppgifter'), ikon: 'kalender', kropp: '<ul class="uppglista">' + l.map(uppgiftRad).join('') + '</ul>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button>' });
  };
  var flyttaTill = function (u, ds) { var t = new Date(u.forfaller), n = new Date(ds + 'T00:00:00'); n.setHours(t.getHours() || 9, t.getMinutes()); u.forfaller = n.toISOString(); };
  G['ag-skjut'] = function (el) {
    var u = db().uppgifter.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!u) return;
    var bas = new Date(Math.max(new Date(u.forfaller).getTime(), new Date().setHours(0, 0, 0, 0))); bas.setDate(bas.getDate() + 1);
    flyttaTill(u, IH.dagStr(bas)); IH.spara(); IH.rita(); IH.uppdateraMeny();
    IH.toast('Uppskjuten', u.text + ' · ' + dagNamn(bas), 'klocka');
  };
  G['ag-sena-idag'] = function () {
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var l = db().uppgifter.filter(function (x) { return !x.klar && new Date(x.forfaller) < idag0 && agFilter(x); });
    l.forEach(function (x) { flyttaTill(x, IH.dagStr()); });
    IH.spara(); IH.rita(); IH.uppdateraMeny();
    IH.toast('Flyttade till i dag', l.length + (l.length === 1 ? ' uppgift' : ' uppgifter') + ' ligger nu på i dag.', 'kalender');
  };
  G['ag-csv'] = function () {
    var esc = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rader = [['Datum', 'Uppgift', 'Typ', 'Kund', 'Ansvarig', 'Klar']].concat(db().uppgifter.filter(agFilter).sort(function (a, b) { return a.forfaller < b.forfaller ? -1 : 1; }).map(function (x) {
      var k = x.kund && IH.kund(x.kund), a = x.ansvarig && IH.anvandare(x.ansvarig); return [IH.dagStr(new Date(x.forfaller)), x.text, uppgTyp(x.text)[2], k ? k.namn : '', a ? a.namn : '', x.klar ? 'Ja' : 'Nej']; }));
    var l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['\ufeff' + rader.map(function (r) { return r.map(esc).join(';'); }).join('\r\n')], { type: 'text/csv' })); l.download = 'att-gora-' + IH.dagStr() + '.csv'; document.body.appendChild(l); l.click(); l.remove();
    IH.toast('Exporterat', (rader.length - 1) + ' uppgifter till CSV.', 'skrivut');
  };
  // sök medan man skriver (ritar om efter en kort paus och behåller markören)
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ag-sok]')) return;
    clearTimeout(G['ag-csv'].t); G['ag-csv'].t = setTimeout(function () { agUi.sok = t.value.trim(); IH.rita(); var n = $('[data-ag-sok]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 220);
  });
  // dra uppgifter mellan dagarna i planeringen
  document.addEventListener('dragstart', function (ev) { var c = ev.target.closest && ev.target.closest('[data-ag-uppg]'); if (!c) return; ev.dataTransfer.setData('text/ag-uppg', c.getAttribute('data-ag-uppg')); ev.dataTransfer.effectAllowed = 'move'; c.classList.add('drar'); document.documentElement.classList.add('ag-drar'); });
  document.addEventListener('dragend', function () { document.documentElement.classList.remove('ag-drar'); document.querySelectorAll('.agk .drar, .agk .drop').forEach(function (x) { x.classList.remove('drar', 'drop'); }); });
  document.addEventListener('dragover', function (ev) { var d = ev.target.closest && ev.target.closest('[data-ag-dag]'); if (!d || !document.documentElement.classList.contains('ag-drar')) return; ev.preventDefault(); document.querySelectorAll('.agk .drop').forEach(function (x) { if (x !== d) x.classList.remove('drop'); }); d.classList.add('drop'); });
  document.addEventListener('drop', function (ev) {
    var d = ev.target.closest && ev.target.closest('[data-ag-dag]'); if (!d) return;
    var id = ev.dataTransfer.getData('text/ag-uppg'); if (!id) return; ev.preventDefault();
    var u = db().uppgifter.filter(function (x) { return x.id === id; })[0]; if (!u) return;
    var ds = d.getAttribute('data-ag-dag'); flyttaTill(u, ds); IH.spara(); IH.rita(); IH.uppdateraMeny();
    IH.toast('Flyttad', u.text + ' · ' + dagNamn(new Date(ds + 'T12:00:00')), 'kalender');
  });
  G['uppgift-klar'] = function (el) {
    var u = db().uppgifter.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (!u) return;
    u.klar = !u.klar;
    u.klarTid = u.klar ? new Date().toISOString() : null;
    IH.spara();
    var rad = el.closest('.uppg');
    rad.classList.toggle('uppg--klar', u.klar);
    el.setAttribute('aria-pressed', String(u.klar));
    el.classList.remove('bytt'); void el.offsetWidth; el.classList.add('bytt');
    if (u.klar) {
      var r = el.getBoundingClientRect();
      rad.classList.add('uppg--pang');
      IH.toast('Klart!', u.text, 'bock');
      void r;
    }
    IH.uppdateraMeny();
    clearTimeout(G['uppgift-klar'].t); G['uppgift-klar'].t = setTimeout(function () { var y = window.scrollY; IH.rita(); window.scrollTo(0, y); }, IH.lugn ? 0 : 650);
  };
  FORM.uppgift = function (f, d) {
    db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: d.get('text'), forfaller: new Date((d.get('datum') || IH.dagStr()) + 'T09:00:00').toISOString(),
      klar: false, kund: d.get('kund') || null, affar: null, ansvarig: IH.jag().id });
    IH.spara();
    if (f.closest && f.closest('.ark')) IH.stangArk(true);
    IH.ritaOm(); IH.uppdateraMeny();
    IH.toast('Uppgiften är tillagd', d.get('text'), 'uppgift');
  };

  /* ================================================================
     Inställningar
     ================================================================ */
  // Inställningar (omgjord 2026-10-08): priserna med mellanslag, pris per
  // kvadratmeter, ändringar som lyser med skillnaden och en knapp som
  // räknar dem. Tillvalen får emoji efter vad de är. Återställningen
  // kräver ett andra klick.
  var POST_EMOJI = [[/frakt|leverans/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-lastbil"/></svg>'], [/montage/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-nyckelverktyg"/></svg>'], [/kran/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-projekt"/></svg>'], [/ritning|bygglov/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-linjal"/></svg>'], [/altan|trä/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-virke"/></svg>'],
    [/kök|badrum/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-bad"/></svg>'], [/kamin|skorsten|eldstad/i, '<svg class="emo-ik" aria-hidden="true"><use href="#i-eld"/></svg>']];
  function postEmoji(t) { for (var n = 0; n < POST_EMOJI.length; n++) if (POST_EMOJI[n][0].test(t)) return POST_EMOJI[n][1]; return '<svg class="emo-ik" aria-hidden="true"><use href="#i-plus"/></svg>'; }
  function prisText(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function prisTal(v) { return Number(String(v || '').replace(/[^0-9]/g, '')) || 0; }

  IH.vyer.installningar = function () {
    var pl = IH.db.prislista;
    var hus = IH.MODELLER.filter(function (m) { return m.id !== 'element'; });
    var priser = hus.map(function (m) { return pl.modeller[m.id] || 0; }).filter(function (p) { return p > 0; });
    var minP = priser.length ? Math.min.apply(null, priser) : 0, maxP = priser.length ? Math.max.apply(null, priser) : 0;
    var sparad = pl.sparad ? (dagarTill(pl.sparad) === 0 ? 'i dag ' + new Date(pl.sparad).toTimeString().slice(0, 5) : IH.datum(pl.sparad)) : 'inte ändrade än';
    var rad = function (namn, inne, emojiEllerBild, typ, org, extra) {
      return '<label class="prisrad" data-prisrad>' + emojiEllerBild +
        '<span class="prisrad__namn"><b>' + e(namn) + '</b>' + (inne ? '<small>' + inne + '</small>' : '') + '</span>' +
        '<span class="prisrad__falt"><input type="text" inputmode="numeric" autocomplete="off" name="' + typ + '" value="' + prisText(org) + '" data-org="' + org + '"' + (extra || '') + ' aria-label="Pris för ' + e(namn) + '"><em>kr</em></span>' +
        '<span class="prisrad__diff" data-diff aria-live="polite"></span></label>';
    };
    var html = '<h1 class="dold">Inställningar</h1>' +
      '<section class="instopp kort kort--mork" data-in>' +
        '<div class="instopp__ord"><p class="etikett etikett--ljus">Prislistan</p><h2>Priserna bakom varje <span class="ihop">offert <span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-pengar"/></svg></span></span></h2>' +
          '<p>Ändra ett pris och spara. Nya offerter och kalkylen i kundmötet räknar med det direkt – offerter som redan är skickade behåller sina priser.</p></div>' +
        '<div class="instopp__tal">' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-hem"/></svg></span><small>Husen</small><b>' + (priser.length ? IH.kort(minP) + ' – ' + IH.kort(maxP) : '–') + '</b><em>' + hus.length + ' modeller</em></div>' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-rutnat"/></svg></span><small>Tillval och poster</small><b>' + pl.poster.length + ' st</b><em>' + (pl.poster.length ? 'från ' + IH.kort(Math.min.apply(null, pl.poster.map(function (p) { return p.pris || 0; }))) : 'inga än') + '</em></div>' +
          '<div><span aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-ladda-ner"/></svg></span><small>Senast sparad</small><b>' + sparad + '</b><em>Exempelpriser</em></div>' +
        '</div></section>' +
      '<div class="rutnat rutnat--2 prisrutnat">' +
      '<form class="kort prisform" data-form="prislista" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('hus') + '</span>Husen</h2><span class="chip">Pris per hus</span></header><div class="kort__kropp prislista">' +
        hus.map(function (m) {
          var p = pl.modeller[m.id] || 0;
          return rad(m.namn, e(m.kategori) + ' · ' + m.yta + ' m² · <span data-perkvm>' + (m.yta ? prisText(p / m.yta) + ' kr/m²' : '') + '</span>', tumme(m.tumme), 'm-' + m.id, p, ' data-yta="' + (m.yta || 0) + '"');
        }).join('') + '<div class="formular__knappar"><button class="knapp knapp--mork prisform__spara" type="submit" data-spara>Spara priserna</button></div></div></form>' +
      '<form class="kort prisform" data-form="prislista" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('lista') + '</span>Tillval och poster</h2><span class="chip">Läggs till i offerten</span></header><div class="kort__kropp prislista">' +
        pl.poster.map(function (p) {
          return rad(p.text, '', '<span class="prisrad__emoji" aria-hidden="true">' + postEmoji(p.text) + '</span>', 'p-' + p.id, p.pris || 0);
        }).join('') + '<div class="formular__knappar"><button class="knapp knapp--mork prisform__spara" type="submit" data-spara>Spara priserna</button></div></div></form>' +
      '</div>' +
      '<section class="kort kort--mork installning__proto" data-in><span class="installning__emoji" aria-hidden="true"><svg class="emo-ik" aria-hidden="true"><use href="#i-kolv"/></svg></span><div><p class="etikett etikett--ljus">Prototyp</p><h2>Allt sparas i den här webbläsaren</h2>' +
        '<p>Kunderna, förfrågningarna och priserna är påhittade exempel. Den skarpa versionen tar emot riktiga förfrågningar från formuläret på legohusstockholm.se och kräver inloggning med lösenord.</p></div>' +
        '<button class="knapp knapp--glas" type="button" data-g="aterstall">' + i('aterstall') + '<span>Återställ exempeldata</span></button></section>';
    return {
      titel: 'Inställningar', html: html,
      efter: function (rot) {
        // Live: mellanslag i talen, kr/m², skillnaden och antal ändringar.
        $$('.prisform', rot).forEach(function (form) {
          var knapp = $('[data-spara]', form);
          var rakna = function () {
            var n = $$('[data-prisrad].andrad', form).length;
            knapp.textContent = n ? 'Spara ' + n + (n === 1 ? ' ändring' : ' ändringar') : 'Spara priserna';
            form.classList.toggle('prisform--andrad', n > 0);
          };
          $$('input[data-org]', form).forEach(function (inp) {
            var radEl = inp.closest('[data-prisrad]');
            var diffEl = $('[data-diff]', radEl);
            var kvm = $('[data-perkvm]', radEl);
            var uppdatera = function () {
              var v = prisTal(inp.value), org = Number(inp.getAttribute('data-org')) || 0, d = v - org;
              radEl.classList.toggle('andrad', d !== 0);
              diffEl.textContent = d ? (d > 0 ? '+' : '−') + prisText(Math.abs(d)) + ' kr' : '';
              diffEl.classList.toggle('upp', d > 0);
              if (kvm) { var y = Number(inp.getAttribute('data-yta')) || 0; kvm.textContent = y ? prisText(v / y) + ' kr/m²' : ''; }
              rakna();
            };
            inp.addEventListener('input', uppdatera);
            inp.addEventListener('blur', function () { inp.value = prisText(prisTal(inp.value)); });
            inp.addEventListener('focus', function () { setTimeout(function () { inp.select(); }, 0); });
          });
        });
      }
    };
  };
  FORM.prislista = function (f, d) {
    var pl = IH.db.prislista;
    var andrade = 0;
    d.forEach(function (v, k) {
      var tal = prisTal(v);
      if (k.indexOf('m-') === 0) { if (pl.modeller[k.slice(2)] !== tal) andrade += 1; pl.modeller[k.slice(2)] = tal; }
      if (k.indexOf('p-') === 0) pl.poster.forEach(function (p) { if (p.id === k.slice(2)) { if (p.pris !== tal) andrade += 1; p.pris = tal; } });
    });
    pl.sparad = new Date().toISOString();
    IH.spara();
    IH.ritaOm();
    IH.toast(andrade ? 'Priserna är sparade' : 'Inget att spara', andrade ? andrade + (andrade === 1 ? ' pris ändrat.' : ' priser ändrade.') + ' Nya offerter och kalkyler räknar med dem.' : 'Priserna var redan sparade.', 'bock');
  };
  // Återställ kräver ett andra klick inom fyra sekunder.
  var aterstallTimer = null;
  G.aterstall = function (el) {
    if (!el.classList.contains('bekrafta')) {
      el.classList.add('bekrafta');
      var t = el.querySelector('span');
      if (t) t.textContent = 'Säker? Klicka igen';
      clearTimeout(aterstallTimer);
      aterstallTimer = setTimeout(function () {
        el.classList.remove('bekrafta');
        if (t) t.textContent = 'Återställ exempeldata';
      }, 4000);
      return;
    }
    clearTimeout(aterstallTimer);
    IH.db = IH.skapaExempeldata();
    IH.spara();
    IH.ritaOm();
    IH.toast('Exempeldatan är återställd', 'Allt är som från början.', 'aterstall');
  };

  /* ================================================================
     Ny – snabbmenyn och formulären
     ================================================================ */
  G.ny = function () {
    var val = [['ny-forfragan', 'inkorg', 'Förfrågan', 'Någon ringde eller mejlade'], ['ny-affar', 'tavla', 'Affär', 'Direkt på säljtavlan'],
      ['ny-kund', 'kunder', 'Kund', 'Privatperson eller företag'], ['ny-uppgift', 'uppgift', 'Uppgift', 'Något att göra']];
    IH.oppnaArk({
      titel: 'Skapa ny', ikon: 'plus',
      kropp: '<div class="nyval">' + val.map(function (v, n) {
        return '<button type="button" class="nyval__kort" data-g="' + v[0] + '" style="--n:' + n + '" data-tilt><span class="kort__ikon">' + i(v[1]) + '</span><b>' + v[2] + '</b><small>' + v[3] + '</small></button>';
      }).join('') + '</div><p class="formular__not">' + i('blixt') + 'Kortkommando: tryck <b>N</b> var som helst.</p>',
      efter: function (ark) { IH.efterRitning(ark); }
    });
  };
  G['ny-uppgift'] = function () { IH.stangArk(true); IH.ga('#/att-gora'); setTimeout(function () { var x = $('.nyuppg input[name="text"]'); if (x) x.focus(); }, 80); };
  G['ny-forfragan'] = function () {
    IH.oppnaArk({
      titel: 'Lägg in förfrågan', under: 'När någon ringer eller mejlar – samma frågor som formuläret på sajten.', ikon: 'inkorg', bred: true,
      kropp: '<form class="formular" data-form="ny-forfragan" id="nyf-form">' +
        '<div class="falt-rad"><label class="falt"><span>Namn</span><input name="namn" required autofocus></label><label class="falt"><span>Ort</span><input name="ort" required></label></div>' +
        '<div class="falt-rad"><label class="falt"><span>Telefon</span><input name="telefon" type="tel"></label><label class="falt"><span>E-post</span><input name="epost" type="email"></label></div>' +
        '<fieldset class="falt"><span>Var ska huset stå?</span><div class="miljoval">' + Object.keys(IH.MILJO).map(function (m, n) {
          return '<label><input type="radio" name="miljo" value="' + m + '"' + (n ? '' : ' checked') + '><span><img src="' + IH.MILJO[m] + '" alt=""><b>' + m + '</b></span></label>';
        }).join('') + '</div></fieldset>' +
        '<div class="falt-rad"><label class="falt"><span>Vad funderar kunden på?</span><select name="hustyp"><option>Attefallshus</option><option>Fritidshus</option><option>Vet inte än</option></select></label>' +
        '<label class="falt"><span>Användning</span><select name="anvandning"><option>Bo året runt</option><option>Gästhus</option><option>Uthyrning</option><option>Kontor</option><option>Annat</option></select></label></div>' +
        '<div class="falt-rad"><label class="falt"><span>Kom via</span><select name="kalla"><option>Telefon</option><option>Mejl</option><option>Mässa</option><option>Rekommendation</option></select></label><span></span></div>' +
        '<label class="falt"><span>Vad berättade kunden?</span><textarea name="beskrivning" required></textarea></label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="nyf-form">' + i('plus') + 'Lägg in</button>'
    });
  };
  FORM['ny-forfragan'] = function (form, d) {
    var f = { id: IH.nyttId('forfragan', 'f'), skapad: new Date().toISOString(), status: 'ny', kalla: d.get('kalla'), miljo: d.get('miljo'),
      hustyp: d.get('hustyp'), anvandning: d.get('anvandning'), beskrivning: d.get('beskrivning'), namn: d.get('namn'), ort: d.get('ort'),
      telefon: d.get('telefon') || '', epost: d.get('epost') || '', kund: null, affar: null, tilldelad: IH.jag().id, last: true };
    db().forfragningar.push(f);
    IH.spara();
    IH.stangArk(true);
    IH.toast('Förfrågan är inlagd', f.namn + ' · ' + f.hustyp, 'inkorg');
    IH.ga('#/forfragningar/' + f.id);
    IH.uppdateraMeny();
  };

  /* --- Glidande markör i flikraderna ------------------------------------- */
  function glidFlikar(grupp) {
    if (!grupp) return;
    var m = document.createElement('span');
    m.className = 'flikar__markor';
    grupp.insertBefore(m, grupp.firstChild);
    var flytta = function (direkt) {
      var b = $('[aria-pressed="true"]', grupp);
      if (!b) { m.style.width = '0'; return; }
      if (direkt) m.style.transition = 'none';
      m.style.width = b.offsetWidth + 'px';
      m.style.transform = 'translateX(' + b.offsetLeft + 'px)';
      if (direkt) { void m.offsetWidth; m.style.transition = ''; }
    };
    flytta(true);
    if (document.fonts) document.fonts.ready.then(function () { flytta(true); });
  }
})();
