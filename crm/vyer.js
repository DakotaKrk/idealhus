/* ============================================================
   Idealhus CRM – vyerna och åtgärderna (prototyp, 2026-10-01)
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
  function sannolikhet(a) {
    if (a.steg === 'vunnen') return 100;
    var bas = IH.steg(a.steg).sannolikhet;
    var dagar = IH.dagarSedan(a.andrad);
    var o = IH.offertFor(a.id);
    if (o && o.status === 'skickad' && a.steg === 'offert') bas += 5;
    if (dagar > 14) bas -= 10;
    return Math.max(5, Math.min(95, bas));
  }
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
  function ring(p, farg) {
    return '<span class="ring" style="--p:' + Math.round(p) + ';--f:' + (farg || 'var(--virke)') + '"><b>' + Math.round(p) + '</b></span>';
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
      return '<div class="nyckel__cell"><span class="nyckel__etikett"><span class="kort__ikon">' + i(c[0]) + '</span>' + c[1] + '</span>' + tal +
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
        '<span class="stad__lapp"><b>' + IH.kort(s.summa) + '</b><small><i style="background:' + s.farg + '"></i>' + e(s.kort) + ' · ' + s.antal + ' st</small></span></a>';
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

  function intaktsgraf() {
    var nu = new Date();
    var mnamn = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    var man = [];
    for (var n = 5; n >= 0; n--) {
      var d = new Date(nu.getFullYear(), nu.getMonth() - n, 1);
      man.push({ ar: d.getFullYear(), m: d.getMonth(), summa: 0, antal: 0 });
    }
    db().affarer.forEach(function (a) {
      if (a.steg !== 'vunnen' || !a.vunnen) return;
      var d = new Date(a.vunnen);
      man.forEach(function (x) { if (x.ar === d.getFullYear() && x.m === d.getMonth()) { x.summa += a.varde; x.antal += 1; } });
    });
    var max = Math.max.apply(null, man.map(function (x) { return x.summa; }).concat([1]));
    var B = 520, H = 190, top = 26, bas = 160, fack = B / 6, bredd = 46;
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
    return h < 5 || h >= 22 ? 'natt' : h < 10 ? 'morgon' : h < 17 ? 'dag' : 'kvall';
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
    var uppg = db().uppgifter.filter(function (u) { return !u.klar && new Date(u.forfaller) <= idag; });
    var senaste = db().forfragningar.slice().sort(function (a, b) { return b.skapad < a.skapad ? -1 : 1; }).slice(0, 5);
    var akt = db().aktiviteter.slice().sort(function (a, b) { return b.tid < a.tid ? -1 : 1; }).slice(0, 6);
    var fokus = smartaForslag();

    var text = (nya.length ? '<b>' + nya.length + ' ' + (nya.length === 1 ? 'ny förfrågan' : 'nya förfrågningar') + '</b> väntar på svar. ' : 'Inga obesvarade förfrågningar. ') +
      'Pipelinen är på <b>' + IH.kort(summa(oppna)) + '</b> och ' + proj.length + ' ' + (proj.length === 1 ? 'hus är' : 'hus är') + ' i produktion.';

    var html =
      '<section class="hero kort kort--mork hero--' + dygn() + '" data-in><i class="hero__himmel" aria-hidden="true"></i>' + ljusfall() +
        '<div class="hero__ord">' +
          '<p class="hero__datum"><i></i>' + datumrad() + '</p>' +
          '<h1 class="hero__titel"><span class="rad-mask"><span style="--o:0">' + IH.hej() + ',</span></span><span class="rad-mask"><span style="--o:1"><em>' + e(forsta(jag.namn)) + '.</em></span></span></h1>' +
          '<p class="hero__text">' + text + '</p>' +
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
          '<header class="kort__huvud"><h2><span class="kort__ikon">' + i('graf') + '</span>Intäkter</h2><span class="chip">Vunnet per månad</span></header>' +
          '<div class="kort__kropp"><div class="graf__tal"><div><small>Vunnet i år</small><b class="tal" data-rakna="' + Math.round(summa(vunnet)) + '" data-format="kr">' + IH.kr(summa(vunnet)) + '</b></div>' +
          '<div><small>Viktad pipeline</small><b class="tal" data-rakna="' + Math.round(viktat(oppna)) + '" data-format="kr">' + IH.kr(viktat(oppna)) + '</b></div>' +
          '<div><small>Snittorder</small><b class="tal" data-rakna="' + Math.round(vunnet.length ? summa(vunnet) / vunnet.length : 0) + '" data-format="kr">' + IH.kr(vunnet.length ? summa(vunnet) / vunnet.length : 0) + '</b></div></div>' + intaktsgraf() + perHus() + '</div>' +
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
      }
    };
  };

  /* ================================================================
     Förfrågningar – inkorgen
     ================================================================ */
  var fFilter = 'alla';

  // Emoji för miljön, källan och statusen – samma i listan, toppen och läsrutan.
  var MILJO_EMOJI = { 'Vid havet': '🌊', 'I skogen': '🌲', 'På fjället': '🏔️', 'I trädgården': '🌷' };
  var KALLA_EMOJI = { 'Webbformulär': '🌐', 'Verktyget': '🧭', 'Mejl': '✉️', 'Telefon': '📞' };
  var FSTATUS_EMOJI = { alla: '📬', ny: '✨', kontaktad: '📞', kvalificerad: '🤝', ej: '💤' };
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
      return 'Hej ' + forsta(f.namn) + '!\n\nTack för din förfrågan om ' + typ + ' i ' + f.ort + '. ' + fraga + '\n\nNär passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nIdealhus';
    }
    return 'Hej ' + forsta(f.namn) + '!\n\nTack för din förfrågan om ' + typ + (var_ ? ' ' + var_ : '') + ' i ' + f.ort + '. Jag heter ' + forsta(jag.namn) + ' och hjälper dig vidare.\n\n' +
      (stycken.length ? stycken.join('\n\n') + '\n\n' : '') +
      'För att kunna säga vad som ryms och vad det kostar vill jag gärna veta lite mer om tomten. ' + fraga + '\n\n' +
      'När passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nIdealhus';
  }

  // Nästa bästa steg för förfrågan, med åtgärderna direkt i kortet.
  function nastaBasta(f, aff) {
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
      '</header>' + forlopp(f) + nastaBasta(f, aff) +
      '<div class="fd__mitt"><div class="fd__bild" data-tilt><img src="' + (IH.MILJO[f.miljo] || '../images/hus-r2.webp') + '" alt="" decoding="async"><span class="fd__skylt"><small>Var ska huset stå?</small>' + e(f.miljo) + '</span></div>' +
      '<div class="fd__svar">' +
        '<div><i aria-hidden="true">🏠</i><small>Vad funderar du på?</small><b>' + e(f.hustyp) + '</b></div>' +
        '<div><i aria-hidden="true">🎯</i><small>Användning</small><b>' + e(f.anvandning) + '</b></div>' +
        '<div><i aria-hidden="true">📍</i><small>Ort</small><b>' + e(f.ort) + '</b></div>' +
        '<div><i aria-hidden="true">' + (KALLA_EMOJI[f.kalla] || '📨') + '</i><small>Kom via</small><b>' + e(f.kalla) + '</b></div>' +
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
        (kund ? tidslinje(logg, 'Ingen aktivitet än.') : '<p class="fd__logg-tom"><span aria-hidden="true">🕰️</span><span><b>Ingen historik än</b>Den börjar när förfrågan har blivit en kund – markera den som kontaktad så skapas kundkortet.</span></p>') + '</div>' +
      '</section>';
  }

  // Samma fråga som formuläret på sajten: var ska huset stå? Varje svar
  // är en liten miljö i 3D med ett Idealhus på tomten.
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

  function inkorgPuls(alla) {
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
          (nya.length ? 'väntar på svar · äldsta ' + text : 'allt är besvarat ✨') + '</small></span></p>' +
        (forst ? '<a class="ipuls__forst' + (vantat(forst) > SVARSMAL ? ' ipuls__forst--over' : '') + '" href="#/forfragningar/' + forst.id + '">' +
          avatar(forst.namn, false, kundfarg(forst.kund || forst.id)) +
          '<span><small>Börja med</small><b>' + e(forst.namn) + '</b><em>' + (MILJO_EMOJI[forst.miljo] || '🏠') + ' ' + e(forst.ort) + ' · väntat ' + vantatText(vantat(forst)) + '</em></span>' +
          '<i class="ipuls__pil">' + i('pil') + '</i></a>' : '') +
        '<div class="ipuls__vecka"><div class="ipuls__staplar">' + dagar.map(function (x, n) {
          return '<span class="' + (n === 6 ? 'idag' : '') + '" style="--a:' + (x.antal / maxDag).toFixed(3) + ';--n:' + n + '" data-tip="' + (n === 6 ? 'I dag' : DAG[x.d.getDay()] + ' ' + IH.datum(x.d.toISOString())) + ' · ' + (x.antal === 1 ? '1 förfrågan' : x.antal ? x.antal + ' förfrågningar' : 'inga förfrågningar') + '"><b>' + (x.antal || '') + '</b><i></i><small>' + DAG[x.d.getDay()] + '</small></span>';
        }).join('') + '</div><p><b class="tal" data-rakna="' + vecka + '">' + vecka + '</b> in de senaste 7 dagarna</p></div>' +
        '<div class="ipuls__tal">' +
          '<div><small><i aria-hidden="true">🔥</i>Varma just nu</small><b class="tal">' + nya.filter(function (f) { return leadpoang(f).p >= 70; }).length + '<em> av ' + nya.length + '</em></b>' +
            '<span class="ipuls__prickar">' + nya.slice(0, 12).map(function (f) { var p = leadpoang(f).p; return '<i class="' + (p >= 70 ? 'varm' : p >= 50 ? 'ljum' : '') + '"></i>'; }).join('') + '</span></div>' +
          '<div><small><i aria-hidden="true">🤝</i>Blev affär</small><b class="tal">' + konv + '<em> %</em></b><span class="ipuls__mini" style="--a:' + (konv / 100).toFixed(2) + '"><i></i></span></div>' +
        '</div>' +
        '<div class="ipuls__kalla"><small>Kom via</small><span class="kallbar">' + kallLista.map(function (k, n) {
            return '<i style="flex:' + kallor[k] + ';--k:' + KFARG[n % KFARG.length] + ';--n:' + n + '"></i>';
          }).join('') + '</span><span class="kallbar__lista">' + kallLista.map(function (k, n) {
            return '<span style="--k:' + KFARG[n % KFARG.length] + '"><i></i>' + (KALLA_EMOJI[k] ? KALLA_EMOJI[k] + ' ' : '') + e(k) + '<b>' + kallor[k] + '</b></span>';
          }).join('') + '</span></div>' +
      '</div>' +
      '<div class="ipuls__miljo"><div class="ipuls__miljohuvud"><p class="etikett etikett--ljus">Var ska huset stå?</p><small>Samma fråga som i formuläret · klicka för att filtrera</small></div>' +
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
    var html = '<header class="vyhuvud"><div><p class="etikett">Inkorg</p><h1>Förfrågningar</h1><p>' +
      (antal.ny ? '<b>' + antal.ny + ' nya</b> · ' : '') + alla.length + ' totalt · från formuläret på idealhus.se, verktyget, telefon och mejl.</p></div>' +
      '<div class="vyhuvud__knappar"><button class="knapp" type="button" data-g="simulera">' + i('blixt') + 'Simulera ny förfrågan</button>' +
      '<button class="knapp knapp--mork" type="button" data-g="ny-forfragan">' + i('plus') + 'Lägg in förfrågan</button></div></header>' +
      inkorgPuls(alla) +
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
    window.location.href = 'mailto:' + encodeURIComponent(f.epost) + '?subject=' + encodeURIComponent('Din förfrågan till Idealhus') + '&body=' + encodeURIComponent(t.value);
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
      'ligger den inom detaljplan, och finns det redan byggnader på den?\n\nNär passar det att ringa en kvart?\n\nVänliga hälsningar\n' + jag.namn + '\nIdealhus';
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
  var tavlaLage = 'tavla';

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
  var SALJ_EMOJI = { ny: '📥', kontakt: '📞', besok: '📍', offert: '🧾', forhandling: '🤝', vunnen: '🏆' };
  function nastaEmoji(a) {
    switch (a.steg) {
      case 'ny': return '📞';
      case 'kontakt': return '📍';
      case 'besok': return IH.offertFor(a.id) ? '📨' : '🧾';
      case 'offert': return IH.dagarSedan(a.andrad) > 4 ? '📨' : '⏳';
      case 'forhandling': return '✍️';
      default: return '👉';
    }
  }

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
      '<span class="aff__modell">' + (m ? e(m.namn) : '') + '</span>' + (a.steg === 'vunnen' ? '<span class="aff__vunnen">' + i('trofe') + '</span>' : ring(p, s.farg)) + '</div>' +
      '<b class="aff__titel">' + e(a.titel) + '</b>' +
      '<span class="aff__kund">' + kundAvatar(k, true) + e(k ? k.namn : '') + '</span>' +
      '<div class="aff__fot"><span class="tal">' + IH.kort(a.varde) + '</span>' +
        (a.steg === 'vunnen' ? '<span class="tid">vann ' + IH.sedan(a.vunnen) + '</span>'
          : '<span class="aff__tid aff__tid--' + tid + '" title="' + d + (d === 1 ? ' dag' : ' dagar') + ' i steget">' + (d === 0 ? 'I dag' : d + ' d') + (tid === 'still' ? ' · står still' : '') + '</span>') + '</div>' +
      (a.steg !== 'vunnen' ? '<p class="aff__nasta' + (d > 10 ? ' aff__nasta--varm' : '') + '"><span class="aff__nastaemoji" aria-hidden="true">' + nastaEmoji(a) + '</span>' + e(nastaSteg(a)) + '</p>' : '') +
      '</article>';
  }

  // Pipelinen som ett hus i sprängskiss: varje säljsteg är en byggdel,
  // från grunden (ny förfrågan) till taket (förhandling) som hänger i
  // kranen. Delarna sänks på plats en i taget; listan bredvid visar
  // summorna, och hovring på en rad lyfter ut samma byggdel.
  // Ett Idealhus i CSS 3D: långvägg, gavel med glasparti, altan och
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
    var oppna = oppnaAffarer();
    var vunna90 = db().affarer.filter(function (a) { return a.steg === 'vunnen' && IH.dagarSedan(a.vunnen || a.andrad) <= 90; });
    var html = '<header class="vyhuvud"><div><p class="etikett">Sälj</p><h1>Säljtavla</h1><p>Öppen pipeline <b class="tal" data-rakna="' + Math.round(summa(oppna)) + '" data-format="kr">' + IH.kr(summa(oppna)) + '</b> · ' +
      oppna.length + ' affärer · viktad prognos ' + IH.kort(viktat(oppna)) + '</p></div>' +
      '<div class="vyhuvud__knappar"><div class="flikar" data-flikar><button type="button" data-g="tavla-lage" data-l="tavla" aria-pressed="' + (tavlaLage === 'tavla') + '">' + i('tavla') + 'Tavla</button>' +
      '<button type="button" data-g="tavla-lage" data-l="lista" aria-pressed="' + (tavlaLage === 'lista') + '">' + i('lista') + 'Lista</button></div>' +
      '<button class="knapp knapp--mork" type="button" data-g="ny-affar">' + i('plus') + 'Ny affär</button></div></header>' +

      '<section class="puls kort kort--mork" data-in>' + tratt(oppna) +
        '<div class="puls__kpi">' +
          kpi('graf', 'Öppen pipeline', summa(oppna), 'kort', oppna.length + ' affärer', '#/salj') +
          kpi('blixt', 'Viktad prognos', viktat(oppna), 'kort', (summa(oppna) ? Math.round(viktat(oppna) / summa(oppna) * 100) : 0) + ' % av pipelinen', '#/salj') +
          kpi('kub', 'Snitt per affär', oppna.length ? summa(oppna) / oppna.length : 0, 'kort', 'öppna affärer', '#/salj') +
          kpi('trofe', 'Vunnet 90 d', summa(vunna90), 'kort', vunna90.length + ' ordrar', '#/salj') +
        '</div>' +
        '<div class="forslag"><p class="etikett etikett--ljus">' + i('blixt') + 'Smarta förslag</p>' + smartaForslag().map(function (f) {
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
      '<p class="tavla__tips">💡 Dra korten mellan stegen – på mobilen håller du in kortet först. Släpp längst ned för att markera som förlorad.</p>' +
      '<div class="tavla" data-tavla>' + IH.SALJSTEG.map(function (s) {
        var l = (s.id === 'vunnen' ? vunna90 : oppna.filter(function (a) { return a.steg === s.id; }))
          .sort(function (a, b) { return b.andrad < a.andrad ? -1 : 1; });
        return '<section class="spalt" data-steg="' + s.id + '" style="--f:' + s.farg + '" id="spalt-' + s.id + '">' +
          '<header class="spalt__huvud"><div><b><span class="spalt__emoji" aria-hidden="true">' + SALJ_EMOJI[s.id] + '</span>' + e(s.namn) + '</b><span>' + l.length + '</span></div><p class="tal">' + IH.kort(summa(l)) + '</p>' +
          '<small>' + (s.id === 'vunnen' ? 'senaste 90 dagarna' : s.sannolikhet + ' % chans · viktat ' + IH.kort(viktat(l))) + '</small></header>' +
          '<div class="spalt__kort" data-stagger>' + (l.length ? l.map(affKort).join('') : '<p class="spalt__tom"><span aria-hidden="true">✨</span>Dra hit en affär</p>') + '</div></section>';
      }).join('') + '</div>' +
      '<div class="forlustdocka" aria-hidden="true">' + i('stang') + 'Släpp här för att markera som förlorad</div>';
    }
    return {
      titel: 'Säljtavla', html: html,
      efter: function (rot) {
        glidFlikar($('[data-flikar]', rot));
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
    };
    el.addEventListener('scroll', satt, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(satt).observe(el);
    satt();
  }

  G['tavla-lage'] = function (el) { tavlaLage = el.getAttribute('data-l'); IH.rita(); };
  G['till-spalt'] = function (el) {
    var s = $('#spalt-' + el.getAttribute('data-steg'));
    if (!s) return;
    s.scrollIntoView({ behavior: IH.lugn ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    s.classList.remove('spalt--puls');
    void s.offsetWidth;
    s.classList.add('spalt--puls');
  };
  G['aff-oppna'] = function (el) { affArk(el.getAttribute('data-id')); };

  // Dra och släpp med pekaren: kortet lyfts i 3D och lutar efter farten.
  function kopplaDra(tavla) {
    var docka = $('.forlustdocka');
    tavla.addEventListener('pointerdown', function (ev) {
      var kort = ev.target.closest('.aff');
      if (!kort || ev.button !== 0) return;
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
        var nyttMal = iDocka ? 'forlorad' : spalt ? spalt.getAttribute('data-steg') : null;
        if (nyttMal !== mal) {
          $$('.spalt--mal').forEach(function (x) { x.classList.remove('spalt--mal'); });
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
        $$('.spalt--mal').forEach(function (x) { x.classList.remove('spalt--mal'); });
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
      if (!kort || kort.dataset.dragen) return;
      affArk(kort.getAttribute('data-aff'));
    });
    tavla.addEventListener('keydown', function (ev) {
      var kort = ev.target.closest('.aff');
      if (!kort) return;
      if (ev.key === 'Enter') { affArk(kort.getAttribute('data-aff')); return; }
      if (ev.shiftKey && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        ev.preventDefault();
        var a = IH.affar(kort.getAttribute('data-aff'));
        var idx = IH.SALJSTEG.map(function (s) { return s.id; }).indexOf(a.steg) + (ev.key === 'ArrowRight' ? 1 : -1);
        if (idx >= 0 && idx < IH.SALJSTEG.length) flyttaAffar(a.id, IH.SALJSTEG[idx].id);
      }
    });
  }

  function flyttaAffar(id, steg, rect) {
    var a = IH.affar(id);
    if (!a || a.steg === steg) return;
    var fran = IH.steg(a.steg).namn;
    a.steg = steg;
    a.andrad = new Date().toISOString();
    if (steg === 'vunnen') {
      vinn(a, rect);
      return;
    }
    a.vunnen = null;
    IH.logga('system', 'Flyttad från ' + fran + ' till ' + IH.steg(steg).namn + '.', a.kund, a.id);
    IH.spara();
    IH.ritaOm();
    IH.lysUpp('[data-aff="' + id + '"]', 'aff--ny');
    IH.toast('Flyttad till ' + IH.steg(steg).namn, a.titel, 'tavla');
  }

  function vinn(a, rect) {
    a.steg = 'vunnen';
    a.vunnen = new Date().toISOString();
    a.forlorad = null;
    var o = IH.offertFor(a.id);
    if (o) o.status = 'godkand';
    IH.logga('system', 'Order signerad. 🎉', a.kund, a.id);
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

  var kundVy = 'kort', kundSort = 'aktiv', kundSteg = null;

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
      '<span class="kundkort__tal"><span' + (x.oppet ? '' : ' class="noll"') + '><small>💼 Öppet</small><b class="tal">' + (x.oppet ? IH.kort(x.oppet) : '–') + '</b></span>' +
        '<span' + (x.vunnet ? ' class="vunnet"' : ' class="noll"') + '><small>🏆 Vunnet</small><b class="tal">' + (x.vunnet ? IH.kort(x.vunnet) : '–') + '</b></span></span>' +
      '<span class="kundkort__fot"><span>' + (x.senast ? i('klocka') + IH.sedan(x.senast.tid) : 'Ingen aktivitet') + '</span>' +
        (x.vunnen.length ? '<span class="status" style="--s:#7fe0a6">Kund</span>' : x.oppen.length ? '<span class="status" style="--s:#f0b56e">Affär pågår</span>' : '') + '</span>' +
      '<span class="kundkort__snabb">' +
        (k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring">' + i('tel') + '</button>' : '') +
        (k.epost ? '<button type="button" data-g="kund-mejl" data-epost="' + e(k.epost) + '" title="Mejla">' + i('post') + '</button>' : '') +
        '<button type="button" data-g="starta-mote" data-kund="' + k.id + '" title="Kundmöte">' + i('mote') + '</button>' +
        '<button type="button" data-g="ny-affar-kund" data-id="' + k.id + '" title="Ny affär">' + i('plus') + '</button>' +
      '</span></article>';
  }

  function kundrad(x) {
    var k = x.k;
    return '<tr data-g="kund-oppna" data-id="' + k.id + '"><td><span class="tabell__kund">' + kundAvatar(k, true) + '<span><b>' + e(k.namn) + '</b><small>' + e(k.ort) + (k.typ === 'foretag' ? ' · företag' : '') + '</small></span></span></td>' +
      '<td>' + (x.hus && x.hus.tumme ? '<span class="tabell__hus"><img src="' + x.hus.tumme + '" alt="" loading="lazy"><span><b>' + e(x.hus.namn) + '</b></span></span>' : '<span class="tid">–</span>') + '</td>' +
      '<td>' + (x.steg < 0 ? '<span class="tid">Ingen kontakt</span>' : '<span class="status" style="--s:' + ['#b8cde0', '#9fc2c9', '#e8c98f', '#7fe0a6', '#f0b56e', '#7fe0a6'][x.steg] + '">' + RESA_STEG[x.steg][1] + '</span>') + '</td>' +
      '<td class="tal">' + (x.oppet ? IH.kr(x.oppet) : '<span class="tid">–</span>') + '</td><td class="tal">' + (x.vunnet ? IH.kr(x.vunnet) : '<span class="tid">–</span>') + '</td>' +
      '<td class="tid">' + (x.senast ? IH.sedan(x.senast.tid) : 'Ingen aktivitet') + (x.varm ? ' <i class="prick"></i>' : '') + '</td></tr>';
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
      if (kundSort === 'namn') return x.k.namn.localeCompare(y.k.namn, 'sv');
      if (kundSort === 'varde') return (y.oppet + y.vunnet) - (x.oppet + x.vunnet) || x.k.namn.localeCompare(y.k.namn, 'sv');
      var tx = x.senast ? x.senast.tid : '', ty = y.senast ? y.senast.tid : '';
      return ty < tx ? -1 : ty > tx ? 1 : x.k.namn.localeCompare(y.k.namn, 'sv');
    });

    var html = '<header class="vyhuvud"><div><p class="etikett">Sälj</p><h1>Kunder</h1><p>' + alla.length + ' kunder · privatpersoner och företag.</p></div>' +
      '<div class="vyhuvud__knappar"><label class="sok sok--liten">' + i('sok') + '<input type="search" placeholder="Sök namn eller ort…" value="' + e(kundSok) + '" data-kundsok></label>' +
      '<button class="knapp knapp--mork" type="button" data-g="ny-kund">' + i('plus') + 'Ny kund</button></div></header>' +

      '<section class="kundtopp kort kort--mork" data-in>' +
        '<div class="kundtopp__ord">' +
          '<p class="etikett etikett--ljus">Kundbasen</p>' +
          '<p class="kundtopp__stort"><b class="tal" data-rakna="' + alla.length + '">' + alla.length + '</b><span>kunder<small>' + (senasteKund ? 'senast ' + e(forsta(senasteKund.k.namn)) + ' · ' + IH.datum(senasteKund.k.skapad) : 'inga kunder än') + '</small></span></p>' +
          '<div class="kundtopp__tal">' +
            '<div><small><i aria-hidden="true">💼</i>Affär pågår</small><b class="tal" data-rakna="' + antal.pagar + '">' + antal.pagar + '</b></div>' +
            '<div><small><i aria-hidden="true">🏡</i>Har köpt hus</small><b class="tal" data-rakna="' + antal.kund + '">' + antal.kund + '</b></div>' +
            '<div><small><i aria-hidden="true">🏢</i>Företag</small><b class="tal" data-rakna="' + foretag + '">' + foretag + '</b></div>' +
          '</div>' +
          '<div class="kundtopp__typ"><span class="kallbar"><i style="flex:' + (alla.length - foretag) + ';--k:#f0b56e;--n:0"></i><i style="flex:' + Math.max(foretag, 0.001) + ';--k:#9fc2c9;--n:1"></i></span>' +
            '<span class="kallbar__lista"><span style="--k:#f0b56e"><i></i>Privatpersoner<b>' + (alla.length - foretag) + '</b></span><span style="--k:#9fc2c9"><i></i>Företag<b>' + foretag + '</b></span></span></div>' +
          // Behöver uppmärksamhet: vem och varför, de tre första.
          (varma.length ? '<div class="kundtopp__varma"><small>🔔 Behöver uppmärksamhet</small><div class="varmlista">' + varma.slice(0, 3).map(function (x) {
              var skal = x.nyaF ? ['✨', x.nyaF === 1 ? 'Ny förfrågan' : x.nyaF + ' nya förfrågningar']
                : x.sena ? ['⏰', x.sena === 1 ? 'Försenad uppföljning' : x.sena + ' försenade uppföljningar'] : ['📨', 'Följ upp offerten'];
              return '<button type="button" class="varmrad" data-g="kund-oppna" data-id="' + x.k.id + '">' + kundAvatar(x.k, true) +
                '<span><b>' + e(x.k.namn) + '</b><em>' + skal[0] + ' ' + skal[1] + '</em></span>' + i('pil') + '</button>';
            }).join('') + (varma.length > 3 ? '<button type="button" class="varmrad varmrad--fler" data-g="kund-filter" data-f="varm">+' + (varma.length - 3) + ' till · visa alla</button>' : '') + '</div></div>' : '') +
        '</div>' +
        '<div class="kundtopp__resa"><div class="kundtopp__resahuvud"><p class="etikett etikett--ljus">Var på resan?</p><small>' + (kundSteg === null ? 'Klicka på ett steg för att filtrera' : 'Visar ' + RESA_STEG[kundSteg][1].toLowerCase()) + '</small></div>' +
          '<div class="resakol">' + RESA_STEG.map(function (st, n) {
            return '<button type="button" class="resakol__steg' + (kundSteg === n ? ' vald' : '') + '" data-g="kund-steg" data-n="' + n + '" style="--n:' + n + ';--a:' + (perSteg[n] / maxSteg).toFixed(2) + '" aria-pressed="' + (kundSteg === n) + '">' +
              '<b>' + perSteg[n] + '</b><i class="resakol__stapel"></i><span class="resakol__ikon resakol__ikon--emoji" aria-hidden="true">' + RESA_EMOJI[n] + '</span><small>' + st[1] + '</small></button>';
          }).join('') + '</div></div>' +
      '</section>' +

      '<div class="kundverktyg">' +
        '<div class="flikar flikar--filter" data-flikar role="toolbar" aria-label="Filter">' + FILTER.map(function (f) {
          return '<button type="button" data-g="kund-filter" data-f="' + f[0] + '" aria-pressed="' + (kundFilter === f[0]) + '"><i class="flik__emoji" aria-hidden="true">' + KUND_FILTER_EMOJI[f[0]] + '</i>' + f[1] + '<b>' + antal[f[0]] + '</b></button>';
        }).join('') + '</div>' +
        (kundSteg !== null ? '<button class="chip chip--rensa" type="button" data-g="kund-steg" data-n="' + kundSteg + '">' + RESA_STEG[kundSteg][1] + i('stang') + '</button>' : '') +
        '<div class="kundverktyg__hoger"><label class="kundsort">' + i('lista') + '<select data-kundsort aria-label="Sortera">' +
          [['aktiv', 'Senast aktiv'], ['namn', 'Namn A–Ö'], ['varde', 'Störst värde']].map(function (o) { return '<option value="' + o[0] + '"' + (kundSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="flikar flikar--vy" data-flikar2><button type="button" data-g="kund-vy" data-vy="kort" aria-pressed="' + (kundVy === 'kort') + '" title="Kort">' + i('kub') + '</button>' +
          '<button type="button" data-g="kund-vy" data-vy="lista" aria-pressed="' + (kundVy === 'lista') + '" title="Lista">' + i('lista') + '</button></div></div>' +
      '</div>' +

      (lista.length ? (kundVy === 'lista'
        ? '<section class="kort" data-in><table class="tabell tabell--kunder"><thead><tr><th>Kund</th><th>Hus</th><th>På resan</th><th>Öppet</th><th>Vunnet</th><th>Senast</th></tr></thead><tbody data-stagger>' + lista.map(kundrad).join('') + '</tbody></table></section>'
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
        if (so) so.addEventListener('change', function () { kundSort = so.value; IH.rita(); });
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
  G['kund-sok-rensa'] = function () { kundSok = ''; IH.rita(); };
  G['off-sok-rensa'] = function () { offSok = ''; IH.rita(); };
  G['kund-steg'] = function (el) { var n = Number(el.getAttribute('data-n')); kundSteg = kundSteg === n ? null : n; IH.rita(); };

  // Var kunden är på resan: Förfrågan → Affär → Offert → Order → Montage → Nyckel.
  var RESA_STEG = [['inkorg', 'Förfrågan'], ['tavla', 'Affär'], ['offert', 'Offert'], ['trofe', 'Order'], ['produktion', 'Montage'], ['hus', 'Nyckel']];
  var RESA_EMOJI = ['📥', '💼', '🧾', '✍️', '🏗️', '🔑'];
  var KUND_FILTER_EMOJI = { alla: '👥', pagar: '💼', kund: '🏡', foretag: '🏢', varm: '🔔' };
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
    if (!k) return { titel: 'Kunder', html: tomt('kunder', 'Kunden finns inte.') };
    var aff = db().affarer.filter(function (a) { return a.kund === k.id; });
    var off = db().offerter.filter(function (o) { return o.kund === k.id && o.status !== 'ersatt'; });
    var ff = db().forfragningar.filter(function (f) { return f.kund === k.id || f.epost === k.epost; });
    var proj = db().projekt.filter(function (p) { return p.kund === k.id; });
    var logg = db().aktiviteter.filter(function (h) { return h.kund === k.id; });
    var uppg = db().uppgifter.filter(function (u) { return u.kund === k.id && !u.klar; });
    var html = '<a class="tillbaka" href="#/kunder">' + i('pilv') + 'Alla kunder</a>' +
      kundresa(ff, aff, off, proj) +
      '<section class="kundhero kort kort--mork" data-in>' + kundAvatar(k) +
        '<div><p class="etikett etikett--ljus">' + (k.typ === 'foretag' ? 'Företag' : 'Privatperson') + ' · kund sedan ' + IH.datum(k.skapad, true) + '</p><h1>' + e(k.namn) + '</h1>' +
        '<p class="kundhero__rad"><span>' + i('plats') + e(k.ort) + '</span><a href="tel:' + e(k.telefon.replace(/\s/g, '')) + '">' + i('tel') + e(k.telefon) + '</a><a href="mailto:' + e(k.epost) + '">' + i('post') + e(k.epost) + '</a></p></div>' +
        '<div class="kundhero__tal"><div><small>Affärer</small><b class="tal">' + aff.length + '</b></div><div><small>Öppet värde</small><b class="tal">' +
        IH.kort(summa(aff.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }))) + '</b></div><div><small>Vunnet</small><b class="tal">' +
        IH.kort(summa(aff.filter(function (a) { return a.steg === 'vunnen'; }))) + '</b></div></div>' +
        '<div class="kundhero__knappar"><button class="knapp knapp--virke" type="button" data-g="ny-affar-kund" data-id="' + k.id + '">' + i('plus') + 'Ny affär</button>' +
        '<button class="knapp knapp--glas" type="button" data-g="starta-mote" data-kund="' + k.id + '">' + i('mote') + 'Kundmöte</button></div>' +
      '</section>' +
      '<div class="rutnat rutnat--oversikt">' +
        '<div class="rutnat">' +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('tavla') + '</span>Affärer</h2></header><div class="lista" data-stagger>' +
            (aff.length ? aff.map(function (a) {
              var s = IH.steg(a.steg), m = IH.modell(a.modell);
              return '<button class="lista__rad" type="button" data-g="aff-oppna" data-id="' + a.id + '">' + (m ? tumme(m.tumme) : '') + '<span class="lista__text"><b>' + e(a.titel) + '</b><small>' + IH.kr(a.varde) + '</small></span>' +
                (a.forlorad ? statusChip('#a39b8e', 'Förlorad') : statusChip(s.farg, s.namn)) + '</button>';
            }).join('') : tomt('tavla', 'Inga affärer med ' + e(forsta(k.namn)) + ' ännu. En affär följer huset från första samtal till order.', { text: 'Ny affär', g: 'ny-affar-kund', id: k.id })) + '</div></section>' +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('offert') + '</span>Offerter</h2></header><div class="lista" data-stagger>' +
            (off.length ? off.map(function (o) {
              return '<a class="lista__rad" href="#/offerter/' + o.id + '">' + i('offert') + '<span class="lista__text"><b>' + e(o.nummer) + '</b><small>' + IH.datum(o.skapad) + '</small></span><b class="tal">' + IH.kr(IH.summaOffert(o)) + '</b></a>';
            }).join('') : tomt('offert', aff.length ? 'Inga offerter ännu – de skapas från affären när ni vet vilket hus det blir.' : 'Inga offerter ännu. Offerter skapas från en affär.', aff.length ? null : { text: 'Ny affär', g: 'ny-affar-kund', id: k.id })) + '</div></section>' +
          (ff.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('inkorg') + '</span>Förfrågningar</h2></header><div class="lista" data-stagger>' + ff.map(function (f) {
            return '<a class="lista__rad" href="#/forfragningar/' + f.id + '">' + tumme(IH.MILJO[f.miljo]) + '<span class="lista__text"><b>' + e(f.hustyp) + ' · ' + e(f.anvandning) + '</b><small>' + e(f.beskrivning) + '</small></span><span class="tid">' + IH.sedan(f.skapad) + '</span></a>';
          }).join('') + '</div></section>' : '') +
          (proj.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('produktion') + '</span>Projekt</h2></header><div class="lista" data-stagger>' + proj.map(function (p) {
            var s = IH.projsteg(p.steg), m = IH.modell(p.modell);
            return '<button class="lista__rad" type="button" data-g="proj-oppna" data-id="' + p.id + '">' + (m ? tumme(m.tumme) : '') + '<span class="lista__text"><b>' + e(m ? m.namn : '') + '</b><small>Montage v. ' + IH.vecka(new Date(p.montage)) + '</small></span>' + statusChip(s.farg, s.namn) + '</button>';
          }).join('') + '</div></section>' : '') +
        '</div>' +
        '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Historik</h2></header><div class="kort__kropp">' +
          (uppg.length ? '<ul class="uppglista" data-stagger>' + uppg.map(uppgiftRad).join('') + '</ul>' : '') + anteckningsForm(k.id, '') + tidslinje(logg) + '</div></section>' +
      '</div>';
    return { titel: k.namn, html: html };
  }

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
  var OFF_FILTER_EMOJI = { alla: '📄', skickad: '⏳', snart: '⏰', godkand: '✅', utkast: '✏️' };

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
    var giltig = o.status === 'godkand' ? '<span class="tid tid--order">🏆 Blev order</span>' : x.utgangen ? '<span class="tid tid--varm">Gått ut</span>' :
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

    var html = '<header class="vyhuvud"><div><p class="etikett">Sälj</p><h1>Offerter</h1><p>' + alla.length + ' offerter · totalt ' + IH.kort(sum(alla)) + '</p></div>' +
      '<div class="vyhuvud__knappar"><label class="sok sok--liten">' + i('sok') + '<input type="search" placeholder="Sök kund eller nummer…" value="' + e(offSok) + '" data-offsok></label></div></header>' +

      '<section class="offtopp kort kort--mork" data-in>' +
        '<div class="offtopp__ord">' +
          '<p class="etikett etikett--ljus">Offertläget</p>' +
          '<p class="offtopp__stort"><b class="tal" data-rakna="' + Math.round(sum(skickade)) + '" data-format="kort">' + IH.kort(sum(skickade)) + '</b><span>väntar på svar<small>' + skickade.length + (skickade.length === 1 ? ' offert' : ' offerter') + (snart.length ? ' · ' + snart.length + ' går ut inom tio dagar' : '') + '</small></span></p>' +
          '<div class="offtopp__tal">' +
            '<div><small><i aria-hidden="true">🎯</i>Träffsäkerhet</small><b class="tal">' + (traff === null ? '–' : '<span data-rakna="' + traff + '">' + traff + '</span><em> %</em>') + '</b><span>' + (avgjorda ? godkanda.length + ' av ' + avgjorda + ' avgjorda' : 'inga avgjorda än') + '</span></div>' +
            '<div><small><i aria-hidden="true">⏱️</i>Tid till ja</small><b class="tal">' + (snittTid === null ? '–' : '<span data-rakna="' + snittTid + '">' + snittTid + '</span><em> d</em>') + '</b><span>' + (tider.length ? 'snitt för ' + tider.length + ' godkända' : 'inga godkända än') + '</span></div>' +
            '<div><small><i aria-hidden="true">🏆</i>Godkänt värde</small><b class="tal" data-rakna="' + Math.round(sum(godkanda)) + '" data-format="kort">' + IH.kort(sum(godkanda)) + '</b><span>' + godkanda.length + ' blev order</span></div>' +
          '</div>' +
          '<div class="offtopp__vecka"><small>📊 Offererat per vecka<em>' + IH.kort(veckor.reduce(function (t, y) { return t + y.summa; }, 0)) + ' på åtta veckor</em></small><div class="offtopp__staplar">' + veckor.map(function (y, n) {
            return '<span class="' + (y.summa ? 'har' : '') + '" style="--a:' + (y.summa / maxV).toFixed(2) + ';--n:' + n + '" data-tip="Vecka ' + y.v + ' · ' + (y.antal === 1 ? '1 offert' : y.antal + ' offerter') + ' · ' + IH.kort(y.summa) + '">' +
              '<b>' + (y.summa ? IH.kort(y.summa) : '') + '</b><i></i><small>' + (n === veckor.length - 1 ? 'nu' : 'v.' + y.v) + '</small></span>';
          }).join('') + '</div></div>' +
        '</div>' +
        '<div class="offtopp__hoger">' +
          '<div class="snartut"><div class="snartut__huvud"><p class="etikett etikett--ljus">⏰ Går ut snart</p><small>' + (snart.length ? 'Följ upp eller förläng innan tiden går ut' : 'Inget som brådskar') + '</small></div>' +
            (snart.length ? '<div class="snartut__lista" data-stagger>' + snart.slice(0, 3).map(function (x) {
              return '<div class="snartut__rad"><span class="poang poang--kall" style="--p:' + Math.round(x.kvar / x.giltig * 100) + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="poang__fyll" cx="20" cy="20" r="17" pathLength="100"/></svg><b>' + x.kvar + '</b></span>' +
                '<span class="snartut__text"><b>' + e(x.k ? x.k.namn : '') + '</b><small>' + e(x.o.nummer) + ' · ' + IH.kr(x.summa) + ' · ' + (x.kvar === 1 ? '1 dag kvar' : x.kvar + ' dagar kvar') + '</small></span>' +
                '<span class="snartut__knappar"><button class="knapp knapp--liten knapp--mork" type="button" data-g="offert-folj-upp" data-id="' + x.o.id + '">' + i('samtal') + 'Följ upp</button>' +
                '<button class="knapp knapp--liten" type="button" data-g="offert-forlang" data-id="' + x.o.id + '">' + i('klocka') + '+14 d</button></span></div>';
            }).join('') + '</div>' : '<p class="snartut__tom"><span aria-hidden="true">✅</span>Alla skickade offerter har mer än tio dagar kvar.</p>') + '</div>' +
          '<div class="offinsikt">' +
            '<div class="permodell"><p class="etikett etikett--ljus">🏠 Per hus</p>' + (modeller.length ? '<div class="permodell__lista">' + modeller.map(function (x, n) {
              return '<a class="permodell__rad" href="#/offerter" style="--a:' + (x.summa / maxM).toFixed(2) + ';--n:' + n + '">' + (x.m && x.m.tumme ? '<img src="' + x.m.tumme + '" alt="" loading="lazy">' : '<i></i>') +
                '<span><b>' + e(x.m ? x.m.namn : '') + '</b><small>' + x.antal + (x.antal === 1 ? ' offert' : ' offerter') + (x.ja ? ' · ' + x.ja + ' ja' : '') + '</small><i class="permodell__stapel"></i></span><em class="tal">' + IH.kort(x.summa) + '</em></a>';
            }).join('') + '</div>' : '') + '</div>' +
            '<div class="poster"><p class="etikett etikett--ljus">🧩 Vanligaste posterna</p><div class="poster__lista">' + topPoster.map(function (t) {
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
    if (o && o.affar) affArk(o.affar);
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
    var o = { id: 'o' + db().lopnr.offert, nummer: 'IH-' + new Date().getFullYear() + '-' + db().lopnr.offert, affar: a.id, kund: a.kund, modell: a.modell,
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
      '<header class="dok__huvud"><img src="../images/idealhus_logo.svg" alt="Idealhus"><div><b>Offert</b><span>' + e(o.nummer) + '</span></div></header>' +
      (m ? '<div class="dok__bild"><img src="' + m.bild + '" alt=""><span>' + e(m.kategori + ' ' + m.namn) + '</span></div>' : '') +
      '<div class="dok__parter"><div><small>Till</small><b>' + e(k ? k.namn : '') + '</b><span>' + e(k ? k.ort : '') + '</span><span>' + e(k ? k.epost : '') + '</span></div>' +
      '<div><small>Från</small><b>Idealhus</b><span>' + e(jag.namn) + '</span><span>info@idealhus.se</span></div>' +
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
    if (!o) return { titel: 'Offerter', html: tomt('offert', 'Offerten finns inte.') };
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
            return '<div class="offertrader__rad" data-n="' + n + '"><span class="offertrader__emoji" aria-hidden="true">' + (n === 0 ? '🏠' : postEmoji(r.text)) + '</span><input value="' + e(r.text) + '" data-f="text" aria-label="Beskrivning"' + (las ? ' disabled' : '') + '>' +
              '<input type="number" min="0" value="' + r.antal + '" data-f="antal" aria-label="Antal"' + (las ? ' disabled' : '') + '>' +
              '<input type="number" min="0" step="500" value="' + r.pris + '" data-f="pris" aria-label="Pris"' + (las ? ' disabled' : '') + '>' +
              (las ? '' : '<button class="ikonknapp" type="button" data-g="offert-bort" data-id="' + o.id + '" data-n="' + n + '" aria-label="Ta bort">' + i('stang') + '</button>') + '</div>';
          }).join('') + '</div>' +
          (las ? '' : '<div class="offertlagg"><select data-lagg aria-label="Lägg till rad"><option value="">+ Lägg till ur prislistan…</option>' + IH.db.prislista.poster.map(function (p) {
            return '<option value="' + p.id + '">' + e(p.text) + ' · ' + IH.kr(p.pris) + '</option>';
          }).join('') + '<option value="egen">Egen rad…</option></select></div>') +
          '<div class="offertsumma"><span><small>💰 Summa</small>' + o.rader.length + (o.rader.length === 1 ? ' rad' : ' rader') + ' · ändras direkt i offerten</span><b class="tal" data-summa>' + IH.kr(IH.summaOffert(o)) + '</b></div>' +
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
        kundAvatar(kk, true) + '<span>' + e(kk ? forsta(kk.namn) : '') + '</span></button>';
    }).join('');
    var rubrik = a && k ? 'Nästa möte med<br><em>' + e(forsta(k.namn)) + '.</em>' : 'Redo att<br><em>presentera.</em>';
    var text = a && k ? e(a.titel) + (m ? ' · ' + e(m.kategori) + ' ' + e(m.namn) : '') + ' · ' + (f ? e(f.miljo) + ' · ' : '') + e(k.ort) : 'Välj en kund runt bordet, eller kör presentationen generellt.';
    return '<section class="motescen kort kort--mork" data-in>' +
      '<div class="motescen__ord">' +
        '<p class="etikett etikett--ljus">Kundmöte</p>' +
        '<h2 class="motescen__rubrik">' + rubrik + '</h2>' +
        '<p class="motescen__text">' + text + '</p>' +
        '<div class="motescen__chips">' +
          '<span>' + i('mote') + N + (N === 1 ? ' bild' : ' bilder') + ' · ≈ ' + total + ' min</span>' +
          '<span>' + i('klocka') + moten.length + (moten.length === 1 ? ' möte hållet' : ' möten hållna') + (snitt !== null ? ' · snitt ' + snitt + ' min' : '') + '</span>' +
          (besok ? '<span>' + i('kalender') + 'Platsbesök ' + e(IH.sedan(besok.forfaller)) + (besokKund ? ' · ' + e(forsta(besokKund.namn)) : '') + '</span>' : '') +
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

    var html = '<header class="vyhuvud"><div><p class="etikett">Sälj</p><h1>Kundmöte</h1><p>Presentera Idealhus i helskärm – husen i 3D, reglerna och en kalkyl som räknar live. Priserna syns bara här, inte på sajten.</p></div></header>' +

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
            : '<p class="forhand__tom">' + i('kunder') + 'Utan vald affär visas presentationen generellt, utan kundens namn och förfrågan.</p>') +

          '<div class="falt"><span>Upplägg' + (lage ? '' : ' · eget val') + '</span><div class="upplagg" role="toolbar">' + Object.keys(MOTE_LAGEN).map(function (l) {
            var ids = MOTE_LAGEN[l][1].filter(function (id) { return id !== 'er' || f; });
            return '<button type="button" class="upplagg__val' + (lage === l ? ' vald' : '') + '" data-g="mote-lage" data-l="' + l + '" aria-pressed="' + (lage === l) + '"><b>' + MOTE_LAGEN[l][0] + '</b><small>' + ids.length + ' bilder · ' + ids.reduce(function (t, id) { return t + MOTE_MIN[id]; }, 0) + ' min</small></button>';
          }).join('') + '</div></div>' +

          '<fieldset class="falt"><span>Bilder i presentationen – klicka för att ta bort eller lägga till</span><div class="agenda" data-agenda>' + IH.MOTE_BILDER.map(function (bb, n) {
            var med = valda.indexOf(bb.id) >= 0, kan = bb.id !== 'er' || !!f;
            return '<label class="agenda__kort' + (med ? ' med' : '') + (kan ? '' : ' agenda__kort--saknas') + '" style="--n:' + n + '"><input type="checkbox" name="bild" value="' + bb.id + '"' + (med ? ' checked' : '') + (kan ? '' : ' disabled') + '>' +
              '<img src="' + bb.bild + '" alt="" loading="lazy" decoding="async"><span class="agenda__nr">' + (n + 1) + '</span><span class="agenda__text"><b>' + e(bb.namn) + '</b><small>' + (kan ? MOTE_MIN[bb.id] + ' min' : 'kräver förfrågan') + '</small></span><i class="agenda__bock">' + i('bock') + '</i></label>';
          }).join('') + '</div><p class="agenda__summa">Beräknad tid <b data-motetid>≈ ' + total + ' min</b> · <span data-moteantal>' + valda.length + ' bilder</span></p></fieldset>' +

          (a ? '<div class="motecheck"><p class="etikett">Inför mötet</p><ul>' + check.map(function (c) {
            return '<li class="' + (c[0] ? 'klar' : '') + '"><i>' + i(c[0] ? 'bock' : 'klocka') + '</i><span><b>' + c[1] + '</b><small>' + c[2] + '</small></span>' + c[3] + '</li>';
          }).join('') + '</ul></div>' : '') +

          '<div class="formular__knappar"><button class="knapp knapp--mork" type="submit">' + i('mote') + 'Starta presentation</button>' +
          '<button class="knapp" type="button" data-g="starta-mote" data-start="kalkyl"' + (a ? ' data-affar="' + a.id + '"' : '') + '>' + i('kub') + 'Öppna kalkylen direkt</button></div></form></section>' +

        '<div class="rutnat">' +
          '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Tidigare möten</h2>' + (moten.length ? '<span class="chip">' + moten.length + '</span>' : '') + '</header>' +
            '<div class="kort__kropp">' + (moten.length ? '<div class="tidigare" data-stagger>' + moten.slice(0, 6).map(function (h) {
              var kk = IH.kund(h.kund), mins = moteMinuter(h.text), text = String(h.text).replace(/^Kundmöte \(\d+ min\):\s*/, '').replace(/^Platsbesök bokat i kundmötet.*$/, 'Platsbesök bokat i kundmötet');
              return '<a class="tidigare__rad" href="#/kunder/' + (kk ? kk.id : '') + '">' + kundAvatar(kk, true) + '<span><b>' + e(kk ? kk.namn : 'Okänd kund') + '</b><small>' + IH.datum(h.tid) + (mins ? ' · ' + mins + ' min' : '') + '</small><em>' + e(text) + '</em></span></a>';
            }).join('') + '</div>' : '<p class="forhand__tom">' + i('anteckning') + 'Anteckningar från mötena hamnar här. Tryck N under presentationen för att anteckna.</p>') + '</div></section>' +
          '<section class="kort motekort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('blixt') + '</span>Så funkar det</h2></header>' +
            '<div class="kort__kropp"><ul class="motetips"><li>' + i('pil') + '<span><b>Pil höger/vänster</b> eller svep för att byta bild – <b>K</b> hoppar till kalkylen, <b>N</b> öppnar anteckningarna.</span></li>' +
            '<li>' + i('kub') + '<span>Husen visas i <b>3D</b> – dra för att vrida, som på huskortet.</span></li>' +
            '<li>' + i('offert') + '<span>Spara kalkylen som offert och boka platsbesök direkt i mötet.</span></li></ul>' +
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
          $$('.upplagg__val', rot).forEach(function (b) { b.classList.remove('vald'); b.setAttribute('aria-pressed', 'false'); });
        });
      }
    };
  };
  G['mote-valj'] = function (el) { moteAffar = el.getAttribute('data-id'); IH.rita(); window.scrollTo({ top: 0, behavior: lugnRorelse() ? 'auto' : 'smooth' }); };
  G['mote-lage'] = function (el) { moteBilder = MOTE_LAGEN[el.getAttribute('data-l')][1].slice(); IH.rita(); };
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
    ['montage', 'Montage', '🚚', '#f0b56e'],
    ['start', 'Projektstart', '🏁', '#9fc2c9'],
    ['uppgift', 'Att göra', '✅', '#a9c8a4'],
    ['mote', 'Möten', '🤝', '#b8cde0'],
    ['offert', 'Offert går ut', '🧾', '#e8c98f']
  ];
  var STEG_EMOJI = { underlag: '📐', tillverkning: '🏭', grund: '🧱', montage: '🚚', besiktning: '🔍', klart: '🔑' };
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
    ritning: ['Ritningarna är inte klara', 'Vår del', '📐'],
    lov: ['Bygglov eller anmälan är inte inlämnad', 'Kundens del', '📝'],
    grund: ['Grund, el, vatten och avlopp är inte klart', 'Kundens del', '🧱'],
    framkomlighet: ['Vägen för lastbil och kran är inte klar', 'Kundens del', '🚛']
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
        ut.push({ vikt: (bradskar ? 0 : 2) + (s[1] === 'Vår del' ? 1 : 0), emoji: bradskar ? '⚠️' : s[2], text: s[0], del: s[1],
          under: (k ? k.namn : 'Kunden') + ' · ' + (m ? m.namn : 'huset'),
          nar: t === null ? '' : (t > 0 ? 'om ' + t + ' d' : t === 0 ? 'i dag' : 'passerat'), id: p.id, varm: bradskar });
      });
      if (p.montage) { var v = IH.vecka(new Date(p.montage)); (veckor[v] = veckor[v] || []).push(p); }
    });
    Object.keys(veckor).forEach(function (v) {
      if (veckor[v].length > 1) ut.push({ vikt: 0, emoji: '📅', text: veckor[v].length + ' montage samma vecka', del: 'Planering', under: 'Vecka ' + v, nar: 'v. ' + v, id: veckor[v][0].id, varm: true });
    });
    return ut.sort(function (a, b) { return a.vikt - b.vikt; });
  }

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
        ', om <b>' + t + (t === 1 ? ' dag' : ' dagar') + '</b>. ' + (saknas.length ? saknas.length + (saknas.length === 1 ? ' sak' : ' saker') + ' måste bli klara innan dess.' : 'Allt är klart inför montaget. ✨');
      nedrakning = '<button class="nedrakning" type="button" data-g="proj-oppna" data-id="' + nasta.id + '" style="--a:' + andel.toFixed(3) + ';--p:' + Math.round((1 - Math.min(t, 70) / 70) * 100) + '">' +
        '<span class="nedrakning__ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="nedrakning__fyll" cx="60" cy="60" r="52" pathLength="100"/></svg>' +
          '<b class="tal" data-rakna="' + t + '">' + t + '</b><small>' + (t === 1 ? 'dag kvar' : 'dagar kvar') + '</small></span>' +
        '<span class="nedrakning__info">' +
          '<b>' + e(m ? m.kategori + ' ' + m.namn : '') + '</b><em>' + e(k ? k.namn : '') + (k && k.ort ? ' · ' + e(k.ort) : '') + '</em>' +
          '<span class="nedrakning__datum">' + i('kalender') + dagNamn(slut) + ' · v. ' + IH.vecka(slut) + '</span></span>' +
        '<span class="nedrakning__lista"><small>Klart innan lastbilen kommer?</small>' + CHECK.map(function (c) {
            var klar = !!nasta.check[c[0]];
            return '<span class="' + (klar ? 'klar' : 'saknas') + '"><i aria-hidden="true">' + (klar ? '✓' : '✕') + '</i>' + CHECK_KORT[c[0]] +
              '<em>' + (c[0] === 'ritning' ? 'Vi' : 'Kunden') + '</em></span>';
          }).join('') + '</span>' +
        '<span class="nedrakning__vag" aria-hidden="true"><span class="nedrakning__ande nedrakning__ande--start">🏁 Start ' + IH.datum(start.toISOString()) + '</span>' +
          '<span class="nedrakning__ande nedrakning__ande--slut">Montage ' + IH.datum(slut.toISOString()) + ' 🏠</span>' +
          '<i class="nedrakning__spar"></i><span class="nedrakning__bil">🚚</span></span>' +
      '</button>';
    } else {
      mening = aktiva.length ? 'Inga montage är inplanerade framåt ännu. Sätt montagedag i projekten.' : 'Inga hus i produktion just nu. När en affär vinns hamnar den här. 🌱';
      nedrakning = '<p class="prodblock__tom"><span aria-hidden="true">🗓️</span>Inget montage inplanerat.</p>';
    }
    var steg = IH.PROJSTEG;
    var fabrik = '<div class="fabrik" aria-label="Husen per steg"><i class="fabrik__band" aria-hidden="true"></i>' + steg.map(function (s, n) {
      var l = proj.filter(function (p) { return p.steg === s.id; });
      return '<div class="fabrik__station' + (l.length ? ' fabrik__station--har' : '') + '" style="--f:' + s.farg + ';--n:' + n + '" title="' + e(s.text) + '">' +
        '<span class="fabrik__emoji" aria-hidden="true">' + (STEG_EMOJI[s.id] || '🏠') + '<i>' + (n + 1) + '</i></span>' +
        '<b>' + e(s.namn) + '</b><small>' + (l.length ? l.length + ' hus' : 'inga hus') + '</small>' +
        '<span class="fabrik__hus">' + l.map(function (p, j) {
          var m = IH.modell(p.modell), k = IH.kund(p.kund);
          return '<button type="button" data-g="proj-oppna" data-id="' + p.id + '" style="--j:' + j + '" title="' + e(k ? k.namn : '') + ' · ' + e(m ? m.namn : '') + '"><img src="' + (m ? m.tumme : '') + '" alt="' + e(m ? m.namn : '') + '"><span>' + e(k ? forsta(k.namn) : '') + '</span></button>';
        }).join('') + '</span></div>';
    }).join('') + '</div>';
    var block = function (emoji, rubrik, hjalp, inne, klass) {
      return '<div class="prodblock' + (klass ? ' ' + klass : '') + '"><div class="prodblock__huvud"><span class="prodblock__emoji" aria-hidden="true">' + emoji + '</span>' +
        '<span><h3>' + rubrik + '</h3><p>' + hjalp + '</p></span></div>' + inne + '</div>';
    };
    var lista = varn.length ? '<ul class="prodvarn__lista" data-stagger>' + varn.slice(0, 4).map(function (v) {
        return '<li><button type="button" class="prodvarn__rad' + (v.varm ? ' prodvarn__rad--varm' : '') + '" data-g="proj-oppna" data-id="' + v.id + '"><span class="prodvarn__emoji" aria-hidden="true">' + v.emoji + '</span>' +
          '<span><b>' + e(v.text) + '</b><small>' + e(v.under) + '</small></span>' +
          '<span class="prodvarn__meta"><em class="prodvarn__del' + (v.del === 'Vår del' ? ' prodvarn__del--var' : '') + '">' + e(v.del) + '</em>' + (v.nar ? '<small>Montage ' + e(v.nar) + '</small>' : '') + '</span></button></li>';
      }).join('') + '</ul>' + (varn.length > 4 ? '<p class="prodvarn__fler">+' + (varn.length - 4) + ' till – öppna projekten för att se allt</p>' : '')
      : '<p class="prodblock__tom"><span aria-hidden="true">✨</span>Inget saknas inför montagen.</p>';
    return '<section class="prodtopp kort kort--mork" data-in>' +
      '<div class="prodtopp__intro"><p class="etikett etikett--ljus">Läget just nu</p>' +
        '<h2 class="prodtopp__titel"><b class="tal" data-rakna="' + aktiva.length + '">' + aktiva.length + '</b> hus på väg <span class="prodtopp__emoji" aria-hidden="true">🏗️</span></h2>' +
        '<p class="prodtopp__text">' + mening + '</p></div>' +
      (nyckel || '') +
      '<div class="prodtopp__rad">' +
        block('🚚', 'Nästa montage', 'Dagar kvar, och vad som ska vara klart innan lastbilen kommer.', nedrakning, 'prodblock--montage') +
        block('⚠️', 'Att åtgärda', 'Det som saknas inför montagen. Viktigast först – klicka för att öppna projektet.', lista, 'prodblock--varn') +
      '</div>' +
      block('🏭', 'Var husen är just nu', 'Varje hus står på sitt steg, från ritning till nyckel. Klicka på ett hus för att öppna det.', fabrik, 'prodblock--fabrik') +
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
        (veckansMontage ? '<em>' + veckansMontage + ' 🚚</em>' : '') + '</span>' + dagar + '</div>';
    }
    // Sidan: vald dag och de närmaste två veckorna.
    var valdDag = new Date(vald + 'T12:00:00');
    var valdaH = (perDag[vald] || []);
    var rad = function (h, visaDag) {
      var s = slag(h.slag), d = new Date(h.dag + 'T12:00:00');
      var inne = '<span class="kal__radikon" style="--f:' + s[3] + '">' + (h.slag === 'montage' && h.bild ? '<img src="' + h.bild + '" alt="">' : s[2]) + '</span>' +
        '<span class="kal__radtext"><b>' + e(h.titel) + '</b><small>' + (visaDag ? dagNamn(d) + (h.under ? ' · ' : '') : '') + e(h.under) + '</small>' +
        (h.varning ? '<em>⚠️ ' + e(h.varning) + '</em>' : '') + (h.klar ? '<em class="klar">✓ Klart</em>' : '') + '</span>';
      return h.g ? '<button type="button" class="kal__rad" data-g="' + h.g + '" data-id="' + e(h.id) + '">' + inne + i('pil') + '</button>' : '<div class="kal__rad">' + inne + '</div>';
    };
    var snart = synliga.filter(function (h) { var t = dagarTill(h.dag + 'T12:00:00'); return t >= 0 && t <= 14 && h.dag !== vald && !h.klar; })
      .sort(function (a, b) { return a.dag < b.dag ? -1 : a.dag > b.dag ? 1 : ordning[a.slag] - ordning[b.slag]; });
    var t = dagarTill(vald + 'T12:00:00');
    var sida = '<aside class="kal__sida"><div class="kal__sidadel">' +
      '<div class="kal__valdag"><span class="kal__valdatum"><b>' + valdDag.getDate() + '</b><small>' + MANAD[valdDag.getMonth()].slice(0, 3) + '</small></span>' +
        '<span><small>' + (t === 0 ? 'I dag' : t === 1 ? 'I morgon' : t === -1 ? 'I går' : (t > 0 ? 'Om ' + t + ' dagar' : t * -1 + ' dagar sedan')) + ' · v. ' + IH.vecka(valdDag) + '</small><b>' + dagNamn(valdDag) + '</b></span></div>' +
      (valdaH.length ? '<div class="kal__lista" data-stagger>' + valdaH.map(function (h) { return rad(h, false); }).join('') + '</div>'
        : '<p class="kal__tom"><span aria-hidden="true">' + (valdDag.getDay() % 6 === 0 ? '🌿' : '🌤️') + '</span>Inget inplanerat den här dagen.</p>') +
      '</div><div class="kal__sidadel"><p class="etikett etikett--ljus kal__snartrubrik">Närmaste två veckorna</p>' +
      (snart.length ? '<div class="kal__lista kal__lista--snart">' + snart.slice(0, 6).map(function (h) { return rad(h, true); }).join('') + '</div>'
        : '<p class="kal__tom"><span aria-hidden="true">🌱</span>Lugnt framåt.</p>') +
    '</div></aside>';
    var hjalp = '<p class="kal__hjalp"><span>👆 Klicka på en dag för att se allt som händer då.</span><span><b class="kal__hjalpvnr">1 🚚</b> = montage den veckan</span>' +
      '<span><b class="kal__hjalpvarn">!</b> = saker kvar inför montaget</span><span>Knapparna ovanför tänder och släcker.</span></p>';
    return '<section class="kal kort" data-in><div class="kal__ram"><div class="prodblock__huvud kal__rubrik"><span class="prodblock__emoji" aria-hidden="true">📅</span>' +
      '<span><h3>Kalender</h3><p>Montage, projektstarter, uppgifter, möten och offerter som går ut.</p></span></div>' + huvud + hjalp + '<div class="kal__kropp"><div class="kal__rutnat">' + rutor + '</div>' + sida + '</div></div></section>';
  }

  IH.vyer.produktion = function (del) {
    var proj = db().projekt;
    var aktiva = proj.filter(function (p) { return p.steg !== 'klart'; });
    var punkter = aktiva.length * CHECK.length;
    var klaraP = aktiva.reduce(function (s, p) { return s + CHECK.filter(function (c) { return p.check[c[0]]; }).length; }, 0);
    var nasta = aktiva.filter(function (p) { return p.montage && dagarTill(p.montage) >= 0; }).sort(function (a, b) { return a.montage < b.montage ? -1 : 1; })[0];
    var nk = nasta ? IH.kund(nasta.kund) : null;
    var html = '<header class="vyhuvud"><div><p class="etikett">Produktion</p><h1>Projekt</h1><p>' + aktiva.length + ' hus på väg – från ritning till slutbesiktning.</p></div></header>' +
      prodTopp(proj, aktiva, nyckelband([
        ['produktion', 'Aktiva projekt', aktiva.length, 'tal', proj.length - aktiva.length + ' klara'],
        ['kalender', 'Nästa montage', nasta ? 'v. ' + IH.vecka(new Date(nasta.montage)) : '–', 'text', nasta ? e(nk ? nk.namn : '') + ' · om ' + dagarTill(nasta.montage) + ' d' : 'inget planerat'],
        ['bock', 'Checklistor klara', punkter ? klaraP / punkter * 100 : 0, 'pct', klaraP + ' av ' + punkter + ' punkter', punkter ? klaraP / punkter : 0],
        ['kub', 'Värde i produktion', aktiva.reduce(function (s, p) { var a = p.affar ? IH.affar(p.affar) : null; return s + (a ? a.varde : 0); }, 0), 'kort', 'signerade ordrar']
      ])) +
      kalender() +
      '<div class="prodrubrik"><p class="etikett">Alla projekt</p><h2>Från ritning till nyckel</h2><p>Varje kolumn är ett steg. När ett steg är klart flyttar du huset vidare med pilen på kortet, eller öppnar projektet och väljer steg.</p></div>' +
      '<div class="tavla tavla--prod">' + IH.PROJSTEG.map(function (s) {
        var l = proj.filter(function (p) { return p.steg === s.id; });
        return '<section class="spalt" style="--f:' + s.farg + '"><header class="spalt__huvud"><div><b><span class="spalt__emoji" aria-hidden="true">' + (STEG_EMOJI[s.id] || '') + '</span>' + e(s.namn) + '</b><span>' + l.length + '</span></div><small>' + e(s.text) + '</small></header>' +
          '<div class="spalt__kort" data-stagger>' + (l.length ? l.map(projKort).join('') : '<p class="spalt__tom">' + i('hus') + 'Inget här just nu</p>') + '</div></section>';
      }).join('') + '</div>';
    return {
      titel: 'Projekt', html: html,
      efter: function (rot) {
        rot.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('aff--proj')) { ev.preventDefault(); projArk(ev.target.getAttribute('data-id')); }
        });
        if (del[0]) setTimeout(function () { projArk(del[0]); }, 60);
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
    return '<article class="aff aff--proj" data-g="proj-oppna" data-id="' + p.id + '" tabindex="0" role="button" style="--f:' + s.farg + '" aria-label="' + e(k ? k.namn : '') + ', ' + e(m ? m.namn : '') + ', ' + e(s.namn) + '">' +
      '<div class="aff__topp">' + (m ? '<span class="aff__bild"><img src="' + m.tumme + '" alt="" loading="lazy"></span>' : '') + '<span class="aff__modell">' + e(m ? m.namn : '') + '</span>' + ring(klara / CHECK.length * 100, s.farg) + '</div>' +
      '<b class="aff__titel">' + e(k ? k.namn : '') + '</b><span class="aff__kund">' + i('plats') + e(k ? k.ort : '') + '</span>' +
      '<div class="aff__fot"><span>' + i('kalender') + 'Montage v. ' + IH.vecka(new Date(p.montage)) + '</span><span class="tid">' + klara + '/' + CHECK.length + ' klart</span></div>' +
      '<div class="aff__snabb">' +
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
          (c[0] === 'grund' || c[0] === 'framkomlighet' || c[0] === 'lov' ? '<small>Kunden</small>' : '<small>Idealhus</small>') + '</button></li>';
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
    [/offert/i, '🧾', 'Offert'],
    [/platsbesök|besök|tomtkoll/i, '📍', 'Platsbesök'],
    [/^ring|samtal|telefon/i, '📞', 'Samtal'],
    [/mejl|mail|skicka/i, '✉️', 'Mejl'],
    [/möte|träff/i, '🤝', 'Möte'],
    [/boka|montage|kran|leverans/i, '📅', 'Bokning']
  ];
  function uppgTyp(text) {
    for (var n = 0; n < UPPG_TYP.length; n++) if (UPPG_TYP[n][0].test(text || '')) return UPPG_TYP[n];
    return [null, '✅', 'Uppgift'];
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
      (k && !u.klar ? '<span class="uppg__snabb">' +
        (k.telefon ? '<button type="button" data-g="kund-ring" data-tel="' + e(k.telefon) + '" title="Ring ' + e(forsta(k.namn)) + '" aria-label="Ring ' + e(forsta(k.namn)) + '">' + i('tel') + '</button>' : '') +
        '<button type="button" data-g="kund-oppna" data-id="' + k.id + '" title="Kundkortet" aria-label="Kundkortet">' + i('kunder') + '</button></span>' : '') +
      '</li>';
  }

  IH.vyer['att-gora'] = function () {
    var idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    var idag1 = new Date(); idag1.setHours(23, 59, 59, 999);
    var u = db().uppgifter.slice().sort(function (a, b) { return a.forfaller < b.forfaller ? -1 : 1; });
    var grupper = [
      ['Försenade', u.filter(function (x) { return !x.klar && new Date(x.forfaller) < idag0; }), '⏰', 'Det här skulle ha gjorts tidigare.'],
      ['I dag', u.filter(function (x) { return !x.klar && new Date(x.forfaller) >= idag0 && new Date(x.forfaller) <= idag1; }), '☀️', 'Bocka av när det är gjort.'],
      ['Kommande', u.filter(function (x) { return !x.klar && new Date(x.forfaller) > idag1; }), '🗓️', 'Det som väntar de närmaste dagarna.'],
      ['Klara', u.filter(function (x) { return x.klar; }), '✅', 'Bra jobbat. Klicka på bocken för att ångra.']
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
      : (dagens.length ? 'Allt för i dag är klart. ✨' : 'Inget inplanerat i dag.') + (imorgon.length ? ' I morgon väntar ' + imorgon.length + (imorgon.length === 1 ? ' uppgift.' : ' uppgifter.') : '');
    var DAGK = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    var vecka = [];
    for (var v = 0; v < 7; v++) {
      var d = new Date(idag0); d.setDate(d.getDate() + v);
      var d1 = new Date(d); d1.setHours(23, 59, 59, 999);
      vecka.push({ d: d, l: u.filter(function (x) { return !x.klar && new Date(x.forfaller) >= d && new Date(x.forfaller) <= d1; }) });
    }
    var h = new Date().getHours();
    var dygnEmoji = h < 5 || h >= 22 ? '🌙' : h < 10 ? '🌅' : h < 17 ? '☀️' : '🌆';
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
        '<span><b>' + dagKlara + '<em>/' + dagens.length + '</em></b><small>' + (dagens.length && dagKlara === dagens.length ? 'Dagen är klar 🎉' : 'klara i dag') + '</small></span></div>' +
      '<div class="dagtopp__vecka" aria-label="De närmaste sju dagarna">' + vecka.map(function (x, n) {
        var helg = x.d.getDay() % 6 === 0;
        return '<span class="dagkort' + (n === 0 ? ' dagkort--idag' : '') + (helg ? ' dagkort--helg' : '') + (x.l.length ? ' dagkort--har' : '') + '" style="--n:' + n + '">' +
          '<small>' + (n === 0 ? 'I dag' : n === 1 ? 'I morgon' : DAGK[x.d.getDay()]) + '</small><b>' + x.d.getDate() + '</b>' +
          '<span class="dagkort__emoji">' + (x.l.length ? x.l.slice(0, 3).map(function (y) { return uppgTyp(y.text)[1]; }).join('') : '<i>·</i>') + '</span>' +
          '<em>' + (x.l.length ? x.l.length + (x.l.length === 1 ? ' uppgift' : ' uppgifter') : 'fritt') + '</em></span>';
      }).join('') + '</div>' +
    '</section>';
    var html = '<header class="vyhuvud"><div><p class="etikett">Mitt</p><h1>Att göra</h1><p>' + u.filter(function (x) { return !x.klar; }).length + ' uppgifter kvar.</p></div></header>' +
      topp + '<form class="nyuppg kort" data-form="uppgift" data-in><span class="nyuppg__plus" aria-hidden="true">' + i('plus') + '</span><input name="text" placeholder="Ny uppgift – t.ex. Ring Karin om tomten" required autocomplete="off">' +
      '<select name="kund" aria-label="Kund"><option value="">Ingen kund</option>' + db().kunder.map(function (k) { return '<option value="' + k.id + '">' + e(k.namn) + '</option>'; }).join('') + '</select>' +
      '<input type="date" name="datum" value="' + IH.dagStr() + '" aria-label="Datum"><button class="knapp knapp--mork knapp--liten" type="submit">Lägg till</button></form>' +
      '<p class="nyuppg__tips">💡 Skriv som du pratar – "Ring …", "Skicka offert …" eller "Platsbesök …" får rätt ikon av sig själv.</p>' +
      grupper.filter(function (g) { return g[1].length; }).map(function (g) {
        return '<section class="kort uppgrupp' + (g[0] === 'Försenade' ? ' uppgrupp--sen' : '') + (g[0] === 'Klara' ? ' uppgrupp--klara' : '') + '" data-in><header class="kort__huvud"><h2><span class="uppgrupp__emoji" aria-hidden="true">' + g[2] + '</span>' +
          '<span class="uppgrupp__namn">' + g[0] + '<small>' + g[3] + '</small></span><b class="chip">' + g[1].length + '</b></h2></header>' +
          '<div class="kort__kropp"><ul class="uppglista" data-stagger>' + g[1].map(uppgiftRad).join('') + '</ul></div></section>';
      }).join('');
    return { titel: 'Att göra', html: html };
  };
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
      if (!IH.lugn) setTimeout(function () { IH.uppdateraMeny(); }, 50);
      IH.toast('Klart!', u.text, 'bock');
      void r;
    } else IH.uppdateraMeny();
  };
  FORM.uppgift = function (f, d) {
    db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: d.get('text'), forfaller: new Date((d.get('datum') || IH.dagStr()) + 'T09:00:00').toISOString(),
      klar: false, kund: d.get('kund') || null, affar: null, ansvarig: IH.jag().id });
    IH.spara();
    IH.ritaOm();
    IH.toast('Uppgiften är tillagd', d.get('text'), 'uppgift');
  };

  /* ================================================================
     Inställningar
     ================================================================ */
  // Inställningar (omgjord 2026-10-08): priserna med mellanslag, pris per
  // kvadratmeter, ändringar som lyser med skillnaden och en knapp som
  // räknar dem. Tillvalen får emoji efter vad de är. Återställningen
  // kräver ett andra klick.
  var POST_EMOJI = [[/frakt|leverans/i, '🚚'], [/montage/i, '🔧'], [/kran/i, '🏗️'], [/ritning|bygglov/i, '📐'], [/altan|trä/i, '🪵'],
    [/kök|badrum/i, '🛁'], [/kamin|skorsten|eldstad/i, '🔥']];
  function postEmoji(t) { for (var n = 0; n < POST_EMOJI.length; n++) if (POST_EMOJI[n][0].test(t)) return POST_EMOJI[n][1]; return '➕'; }
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
    var html = '<header class="vyhuvud"><div><p class="etikett">Mitt</p><h1>Inställningar</h1><p>Prislistan som offerterna och kalkylen i kundmötet räknar med.</p></div></header>' +
      '<section class="instopp kort kort--mork" data-in>' +
        '<div class="instopp__ord"><p class="etikett etikett--ljus">Prislistan</p><h2>Priserna bakom varje offert <span aria-hidden="true">💰</span></h2>' +
          '<p>Ändra ett pris och spara. Nya offerter och kalkylen i kundmötet räknar med det direkt – offerter som redan är skickade behåller sina priser.</p></div>' +
        '<div class="instopp__tal">' +
          '<div><span aria-hidden="true">🏠</span><small>Husen</small><b>' + (priser.length ? IH.kort(minP) + ' – ' + IH.kort(maxP) : '–') + '</b><em>' + hus.length + ' modeller</em></div>' +
          '<div><span aria-hidden="true">🧩</span><small>Tillval och poster</small><b>' + pl.poster.length + ' st</b><em>' + (pl.poster.length ? 'från ' + IH.kort(Math.min.apply(null, pl.poster.map(function (p) { return p.pris || 0; }))) : 'inga än') + '</em></div>' +
          '<div><span aria-hidden="true">💾</span><small>Senast sparad</small><b>' + sparad + '</b><em>Exempelpriser</em></div>' +
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
      '<section class="kort kort--mork installning__proto" data-in><span class="installning__emoji" aria-hidden="true">🧪</span><div><p class="etikett etikett--ljus">Prototyp</p><h2>Allt sparas i den här webbläsaren</h2>' +
        '<p>Kunderna, förfrågningarna och priserna är påhittade exempel. Den skarpa versionen tar emot riktiga förfrågningar från formuläret på idealhus.se och kräver inloggning med lösenord.</p></div>' +
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
