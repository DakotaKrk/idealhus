/* Legohus CRM – ledning, konton och närvaro (2026-10-28, efter Uperformance CRM:s ledning.js).
   - Närvaro: varje konto har en status (online, i möte, lunch …). Den egna sätts i kontomenyn; sparas i
     webbläsaren (ih-crm-narvaro). Osynlig syns som offline för andra.
   - Kontomenyn (kortet i sidomenyn): status, Min profil, Försäljningsledning för chefen, byt konto, logga ut.
   - #/profil[/id]: id-kortet med nyckeltal efter roll, aktiviteten 30 dagar, affärerna och att göra.
   - #/chef (bara chefen): teamet just nu, pipeline per säljare, aktivitet 14 dagar, det som behöver
     uppmärksamhet och topplistan. Allt räknas ur exempeldatan – inga påhittade siffror. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i;
  var db = function () { return IH.db; };

  /* 01 Närvaro ---------------------------------------------------------------------------------- */
  var NARVARO = [
    { id: 'online', namn: 'Online', farg: '#22a35a' },
    { id: 'mote', namn: 'I möte', farg: '#e8a456' },
    { id: 'upptagen', namn: 'Upptagen', farg: '#d9573f' },
    { id: 'strax', namn: 'Strax tillbaka', farg: '#e8c98f' },
    { id: 'lunch', namn: 'Lunch', farg: '#9fc2c9' },
    { id: 'ute', namn: 'Ute på tomt', farg: '#a9c8a4' },
    { id: 'semester', namn: 'Semester', farg: '#b8cde0' },
    { id: 'sjuk', namn: 'Sjuk', farg: '#d7c2e0' },
    { id: 'osynlig', namn: 'Osynlig', farg: '#c9c4bb' }
  ];
  // Exempel: så står kollegorna när prototypen öppnas
  var START = { ml: 'online', ab: 'mote', eb: 'ute', je: 'online' };
  function lasNarvaro() { try { return JSON.parse(localStorage.getItem('ih-crm-narvaro')) || {}; } catch (x) { return {}; } }
  function narvaro(uid) {
    var s = lasNarvaro()[uid] || START[uid] || 'online';
    // Osynlig syns som offline för alla utom en själv
    if (s === 'osynlig' && uid !== IH.jag().id) return { id: 'offline', namn: 'Offline', farg: '#c9c4bb' };
    return NARVARO.filter(function (n) { return n.id === s; })[0] || NARVARO[0];
  }
  IH.narvaro = narvaro;
  IH.narvaroPrick = function (uid) { var n = narvaro(uid); return '<i class="narvaro-prick" style="--n:' + n.farg + '" title="' + e(n.namn) + '"></i>'; };
  IH.narvaroText = function (uid) { var u = IH.anvandare(uid); return e(narvaro(uid).namn) + ' · ' + e(u ? u.titel : ''); };
  function avatar(u, stor) {
    return '<span class="avatar' + (stor ? ' avatar--stor' : '') + '" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + IH.narvaroPrick(u.id) + '</span>';
  }

  /* 02 Kontomenyn ------------------------------------------------------------------------------- */
  IH.G['konto-meny'] = function () {
    var jag = IH.jag(), nu = narvaro(jag.id);
    IH.oppnaArk({
      titel: jag.namn, under: jag.titel + ' · exempelkonto i prototypen', ikon: 'kunder',
      kropp:
        '<section class="km-status kort"><p class="etikett">Din status</p><div class="km-status__val">' + NARVARO.map(function (n) {
          return '<button type="button" data-g="satt-narvaro" data-s="' + n.id + '" aria-pressed="' + (lasNarvaro()[jag.id] ? lasNarvaro()[jag.id] === n.id : nu.id === n.id) + '" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</button>';
        }).join('') + '</div></section>' +
        '<div class="lista kort">' +
          '<a class="lista__rad" href="#/profil">' + i('kunder') + '<span class="lista__text"><b>Min profil</b><small>Nyckeltal, aktivitet och dina affärer</small></span>' + i('pil') + '</a>' +
          (jag.chef ? '<a class="lista__rad" href="#/chef">' + i('graf') + '<span class="lista__text"><b>Försäljningsledning</b><small>Teamet, pipelinen och topplistan</small></span>' + i('pil') + '</a>' : '') +
        '</div>' +
        '<p class="km-rubrik">Byt konto</p><div class="lista kort">' + IH.ANVANDARE.map(function (u) {
          return '<button class="lista__rad" type="button" data-g="valj-anvandare" data-id="' + u.id + '">' + avatar(u) +
            '<span class="lista__text"><b>' + e(u.namn) + '</b><small>' + e(u.titel) + ' · ' + e(narvaro(u.id).namn) + '</small></span>' +
            (u.id === jag.id ? '<span class="status" style="--s:#7fe0a6">Inloggad</span>' : i('pil')) + '</button>';
        }).join('') + '</div>',
      fot: '<button class="knapp" type="button" data-g="logga-ut">' + i('utloggning') + 'Logga ut</button>'
    });
  };
  IH.G['satt-narvaro'] = function (el) {
    var jag = IH.jag(), m = lasNarvaro();
    m[jag.id] = el.getAttribute('data-s');
    try { localStorage.setItem('ih-crm-narvaro', JSON.stringify(m)); } catch (x) { /* privat läge */ }
    IH.stangArk();
    IH.uppdateraMeny();
    if (/^#\/(chef|profil)/.test(location.hash)) IH.rita();
    IH.toast('Status: ' + narvaro(jag.id).namn, 'Kollegorna ser den i teamet.', 'kunder');
  };

  /* 03 Räknare per konto ------------------------------------------------------------------------- */
  var dag0 = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  function stat(u) {
    var aff = db().affarer.filter(function (a) { return a.ansvarig === u.id; });
    var oppna = aff.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; });
    var ar = new Date().getFullYear();
    var vunna = aff.filter(function (a) { return a.steg === 'vunnen' && a.vunnen && new Date(a.vunnen).getFullYear() === ar; });
    var forlorade = aff.filter(function (a) { return a.forlorad; });
    var akt = db().aktiviteter.filter(function (h) { return h.av === u.id; });
    var uppg = db().uppgifter.filter(function (x) { return x.ansvarig === u.id && !x.klar; });
    var idag = dag0(new Date());
    var sena = uppg.filter(function (x) { return dag0(x.forfaller) < idag; });
    var stilla = oppna.filter(function (a) { return IH.dagarSedan(a.andrad) > 14; });
    var summa = function (l) { return l.reduce(function (t, a) { return t + (a.varde || 0); }, 0); };
    var viktat = oppna.reduce(function (t, a) { return t + (a.varde || 0) * IH.sannolikhet(a) / 100; }, 0);
    var avslutade = vunna.length + forlorade.length;
    return { u: u, aff: aff, oppna: oppna, vunna: vunna, forlorade: forlorade, akt: akt, uppg: uppg, sena: sena, stilla: stilla,
      oppet: summa(oppna), vunnet: summa(vunna), viktat: viktat, vinstgrad: avslutade ? vunna.length / avslutade : null };
  }
  // Aktivitet per dag de senaste n dagarna (äldst först)
  function perDag(akt, n) {
    var idag = dag0(new Date()), ut = [];
    for (var d = n - 1; d >= 0; d--) {
      var dag = new Date(idag); dag.setDate(idag.getDate() - d);
      var nasta = new Date(dag); nasta.setDate(dag.getDate() + 1);
      ut.push({ dag: dag, antal: akt.filter(function (h) { var t = new Date(h.tid); return t >= dag && t < nasta; }).length });
    }
    return ut;
  }
  var VECKODAG = ['sö', 'må', 'ti', 'on', 'to', 'fr', 'lö'];
  function staplar(dagar, klass) {
    var max = Math.max.apply(null, dagar.map(function (d) { return d.antal; }).concat([1]));
    return '<span class="' + klass + '" aria-hidden="true">' + dagar.map(function (d) {
      return '<i style="--h:' + (d.antal / max).toFixed(3) + '" class="' + (d.antal ? 'pa' : '') + (d.dag.getDay() % 6 === 0 ? ' helg' : '') + '" title="' + IH.datum(d.dag.toISOString()) + ': ' + d.antal + '"></i>';
    }).join('') + '</span>';
  }
  var saljare = function () { return IH.ANVANDARE.filter(function (u) { return u.roll === 'salj'; }); };

  /* 04 Profilen #/profil[/id] --------------------------------------------------------------------- */
  IH.vyer.profil = function (del) {
    var u = del[0] ? IH.anvandare(del[0]) : IH.jag();
    if (!u) return { titel: 'Profil', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><p class="lp-tom">Kontot finns inte.</p>' };
    var jag = IH.jag(), ar = u.id === jag.id, st = stat(u), n = narvaro(u.id);
    var tal = u.roll === 'prod'
      ? [['Aktiva projekt', db().projekt.filter(function (p) { return p.steg !== 'klart'; }).length], ['I montage', db().projekt.filter(function (p) { return p.steg === 'montage'; }).length], ['Överlämnade', db().projekt.filter(function (p) { return p.steg === 'klart'; }).length]]
      : [['Öppet', IH.kort(st.oppet)], ['Viktat', IH.kort(st.viktat)], ['Vunnet i år', IH.kort(st.vunnet)]];
    var mal = u.mal ? Math.min(1, st.vunnet / u.mal) : null;
    var dagar = perDag(st.akt, 30);
    var html = '<a class="tillbaka" href="' + (jag.chef && !ar ? '#/chef' : '#/') + '">' + i('pilv') + (jag.chef && !ar ? 'Försäljningsledning' : 'Översikt') + '</a>' +
      '<section class="lp-profil kort kort--mork" data-in>' +
        '<div class="lp-id">' + avatar(u, true) + '<div><p class="etikett etikett--ljus">' + (ar ? 'Din profil' : 'Kollega') + '</p><h1>' + e(u.namn) + '</h1>' +
          '<p class="lp-id__rad"><span>' + e(u.titel) + '</span><span class="lp-status" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</span></p>' +
          (ar ? '' : '<button class="knapp knapp--virke knapp--liten lp-skriv" type="button" data-g="ch-skriv-till" data-uid="' + u.id + '">' + i('samtal') + 'Skicka meddelande</button>') + '</div></div>' +
        '<div class="lp-tal">' + tal.map(function (t) { return '<div><small>' + t[0] + '</small><b class="tal">' + t[1] + '</b></div>'; }).join('') + '</div>' +
        (mal !== null ? '<div class="lp-mal"><div class="lp-mal__text"><small>Årets mål</small><b>' + IH.kort(st.vunnet) + ' av ' + IH.kort(u.mal) + '</b><span>' + Math.round(mal * 100) + ' %</span></div>' +
          '<span class="lp-mal__spar"><i style="--a:' + mal.toFixed(3) + '"></i></span></div>' : '') +
      '</section>' +
      '<div class="lp-rutnat">' +
        '<section class="kort lp-kort" data-in><h2>' + IH.emo('stapel') + 'Aktivitet 30 dagar</h2>' +
          '<p class="lp-forklaring">Samtal, möten, mejl och anteckningar som ' + (ar ? 'du' : e(u.namn.split(' ')[0])) + ' har loggat, en stapel per dag.</p>' +
          staplar(dagar, 'lp-staplar') + '<p class="lp-summa"><b>' + st.akt.filter(function (h) { return IH.dagarSedan(h.tid) < 30; }).length + '</b> aktiviteter · <b>' + dagar.filter(function (d) { return d.antal; }).length + '</b> aktiva dagar</p></section>' +
        (u.roll === 'salj' ? '<section class="kort lp-kort" data-in><h2>' + IH.emo('portfolj') + 'Affärer</h2>' + (st.oppna.length ? '<ul class="lp-affarer">' + st.oppna.sort(function (a, b) { return b.varde - a.varde; }).map(function (a) {
            var s = IH.steg(a.steg), idx = IH.SALJSTEG.indexOf(s), k = IH.kund(a.kund);
            return '<li><a href="#/salj/' + a.id + '"><span><b>' + e(a.titel) + '</b><small>' + e(k ? k.namn : '') + ' · ' + e(s.namn) + '</small></span><b class="tal">' + IH.kort(a.varde) + '</b>' +
              '<span class="lp-steg" style="--f:' + s.farg + '">' + IH.SALJSTEG.slice(0, -1).map(function (x, j) { return '<i class="' + (j <= idx ? 'pa' : '') + '"></i>'; }).join('') + '</span></a></li>';
          }).join('') + '</ul>' : '<p class="lp-tom">Inga öppna affärer.</p>') + '</section>' : '') +
        '<section class="kort lp-kort" data-in><h2>' + IH.emo('todo') + 'Att göra</h2>' + (st.uppg.length ? '<ul class="lp-uppg">' + st.uppg.sort(function (a, b) { return a.forfaller < b.forfaller ? -1 : 1; }).map(function (x) {
            var d = new Date(x.forfaller), sen = dag0(d) < dag0(new Date());
            return '<li class="' + (sen ? 'sen' : '') + '"><span class="lp-datum"><b>' + d.getDate() + '</b><small>' + VECKODAG[d.getDay()] + '</small></span><span><b>' + e(x.text) + '</b><small>' + (sen ? 'Försenad' : IH.datum(x.forfaller)) + '</small></span></li>';
          }).join('') + '</ul>' : '<p class="lp-tom">Inget att göra just nu.</p>') + '</section>' +
      '</div>';
    return { titel: ar ? 'Min profil' : u.namn, html: html };
  };

  /* 05 Försäljningsledningen #/chef --------------------------------------------------------------- */
  IH.vyer.chef = function () {
    var jag = IH.jag();
    if (!jag.chef) return { titel: 'Ledning', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort lp-kort"><h2>' + IH.emo('las') + 'Bara för försäljningschefen</h2><p class="lp-tom">Byt till Anders Berg i kontomenyn för att se försäljningsledningen.</p></section>' };
    var team = saljare().map(stat);
    var sum = function (f) { return team.reduce(function (t, x) { return t + f(x); }, 0); };
    var kvartal = Math.floor(new Date().getMonth() / 3) + 1;
    var band = function (nr, titel, forklaring, inne, klass) {
      return '<section class="lp-band kort' + (klass ? ' ' + klass : '') + '" data-in><header><span class="lp-nr">' + nr + '</span><div><h2>' + titel + '</h2><p class="lp-forklaring">' + forklaring + '</p></div></header>' + inne + '</section>';
    };
    // 01 Teamet just nu
    var kort = team.map(function (x) {
      var n = narvaro(x.u.id), varn = [];
      if (x.stilla.length) varn.push(x.stilla.length + (x.stilla.length === 1 ? ' affär står still' : ' affärer står still'));
      if (x.sena.length) varn.push(x.sena.length + (x.sena.length === 1 ? ' försenad uppgift' : ' försenade uppgifter'));
      var perSteg = IH.SALJSTEG.slice(0, -1).map(function (s) { return { s: s, l: x.oppna.filter(function (a) { return a.steg === s.id; }) }; });
      var maxS = Math.max.apply(null, perSteg.map(function (p) { return p.l.length; }).concat([1]));
      return '<article class="lp-saljare">' +
        '<header>' + avatar(x.u) + '<div><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</small></div></header>' +
        '<div class="lp-saljare__tal"><div><small>Öppet</small><b class="tal">' + IH.kort(x.oppet) + '</b></div><div><small>Viktat</small><b class="tal">' + IH.kort(x.viktat) + '</b></div><div><small>Vunnet i år</small><b class="tal">' + IH.kort(x.vunnet) + '</b></div></div>' +
        (x.u.mal ? '<p class="lp-saljare__mal">' + Math.round(Math.min(1, x.vunnet / x.u.mal) * 100) + ' % av årets mål på ' + IH.kort(x.u.mal) + '<span class="lp-mal__spar"><i style="--a:' + Math.min(1, x.vunnet / x.u.mal).toFixed(3) + '"></i></span></p>' : '') +
        '<ul class="lp-perSteg">' + perSteg.map(function (p) {
          return '<li style="--f:' + p.s.farg + ';--a:' + (p.l.length / maxS).toFixed(3) + '"><span>' + e(p.s.kort) + '</span><i></i><b>' + p.l.length + '</b><small>' + (p.l.length ? IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) : '–') + '</small></li>';
        }).join('') + '</ul>' +
        '<div class="lp-vecka"><small>Aktivitet 7 dagar</small>' + staplar(perDag(x.akt, 7), 'lp-staplar lp-staplar--liten') + '</div>' +
        (varn.length ? '<p class="lp-varning">' + IH.emo('varning') + e(varn.join(' · ')) + '</p>' : '<p class="lp-lugnt">' + IH.emo('klar') + 'Inget som väntar</p>') +
        '<footer><a class="knapp knapp--liten" href="#/profil/' + x.u.id + '">' + i('kunder') + 'Profil</a>' + (x.u.id !== jag.id ? '<button class="knapp knapp--liten" type="button" data-g="ch-skriv-till" data-uid="' + x.u.id + '">' + i('samtal') + 'Skriv</button>' : '') + '</footer></article>';
    }).join('');
    // 02 Pipeline per säljare
    var maxP = Math.max.apply(null, team.map(function (x) { return x.oppet; }).concat([1]));
    var pipe = '<ul class="lp-pipe">' + team.map(function (x) {
      return '<li><span class="lp-pipe__namn">' + avatar(x.u) + e(x.u.namn.split(' ')[0]) + '</span><span class="lp-pipe__stapel" style="--a:' + (x.oppet / maxP).toFixed(3) + '">' + IH.SALJSTEG.slice(0, -1).map(function (s) {
        var v = x.oppna.filter(function (a) { return a.steg === s.id; }).reduce(function (t, a) { return t + a.varde; }, 0);
        return v ? '<i style="--f:' + s.farg + ';flex:' + v + '" title="' + e(s.namn) + ': ' + IH.kr(v) + '"></i>' : '';
      }).join('') + '</span><b class="tal">' + IH.kort(x.oppet) + '</b><small>viktat ' + IH.kort(x.viktat) + '</small></li>';
    }).join('') + '</ul><p class="lp-summa">Teamet: <b>' + IH.kort(sum(function (x) { return x.oppet; })) + '</b> öppet · <b>' + IH.kort(sum(function (x) { return x.viktat; })) + '</b> viktat</p>' +
      '<p class="lp-teckenforklaring">' + IH.SALJSTEG.slice(0, -1).map(function (s) { return '<span style="--f:' + s.farg + '"><i></i>' + e(s.namn) + '</span>'; }).join('') + '</p>';
    // 03 Aktivitet 14 dagar
    var dagar14 = perDag([], 14);
    var maxA = 1;
    var rader = team.map(function (x) { var d = perDag(x.akt, 14); d.forEach(function (y) { if (y.antal > maxA) maxA = y.antal; }); return { x: x, d: d }; });
    var karta = '<div class="lp-karta" style="--n:14"><span></span>' + dagar14.map(function (d) { return '<small class="' + (d.dag.getDay() % 6 === 0 ? 'helg' : '') + '">' + VECKODAG[d.dag.getDay()] + '</small>'; }).join('') + '<span class="lp-karta__summa">Summa</span>' +
      rader.map(function (r) {
        var tot = r.d.reduce(function (t, y) { return t + y.antal; }, 0);
        return '<span class="lp-karta__namn">' + e(r.x.u.namn.split(' ')[0]) + '</span>' + r.d.map(function (y) {
          return '<i style="--a:' + (y.antal / maxA).toFixed(3) + '" class="' + (y.antal ? 'pa' : '') + '" title="' + IH.datum(y.dag.toISOString()) + ': ' + y.antal + '">' + (y.antal || '') + '</i>';
        }).join('') + '<b>' + tot + '</b>';
      }).join('') + '</div>';
    // 04 Behöver din uppmärksamhet
    var lista = [];
    team.forEach(function (x) {
      x.stilla.forEach(function (a) { lista.push({ typ: 'Står still', ikon: 'klocka', text: a.titel, under: x.u.namn + ' · ' + IH.dagarSedan(a.andrad) + ' dagar i ' + IH.steg(a.steg).namn.toLowerCase(), href: '#/salj/' + a.id, vikt: IH.dagarSedan(a.andrad) }); });
      x.sena.forEach(function (u) { lista.push({ typ: 'Försenad uppgift', ikon: 'larm', text: u.text, under: x.u.namn + ' · skulle vara klar ' + IH.datum(u.forfaller), href: '#/att-gora', vikt: 20 + IH.dagarSedan(u.forfaller) }); });
    });
    db().forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).forEach(function (f) {
      lista.push({ typ: 'Ingen ansvarig', ikon: 'inkorg', text: f.namn + (f.ort ? ' · ' + f.ort : ''), under: 'Ny förfrågan ' + IH.sedan(f.tid || f.skapad), href: '#/forfragningar/' + f.id, vikt: 30 });
    });
    lista.sort(function (a, b) { return b.vikt - a.vikt; });
    var uppm = lista.length ? '<ul class="lp-uppm">' + lista.slice(0, 8).map(function (r) {
      return '<li><a href="' + r.href + '">' + IH.emo(r.ikon, 'lp-uppm__ikon') + '<span><small>' + e(r.typ) + '</small><b>' + e(r.text) + '</b><em>' + e(r.under) + '</em></span>' + i('pil') + '</a></li>';
    }).join('') + '</ul>' : '<p class="lp-tom">' + IH.emo('klar') + ' Inget som väntar på dig just nu.</p>';
    // 05 Topplistan
    var topp = team.slice().sort(function (a, b) { return b.vunnet - a.vunnet || b.viktat - a.viktat; });
    var topplista = '<ol class="lp-topp">' + topp.map(function (x, n) {
      return '<li class="' + (n === 0 && x.vunnet ? 'forst' : '') + '"><span class="lp-topp__plats">' + (n + 1) + '</span>' + avatar(x.u) + '<span><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small>' + x.vunna.length + (x.vunna.length === 1 ? ' order' : ' ordrar') + (x.vinstgrad !== null ? ' · vinstgrad ' + Math.round(x.vinstgrad * 100) + ' %' : '') + '</small></span><b class="tal">' + IH.kort(x.vunnet) + '</b></li>';
    }).join('') + '</ol>';

    var html = '<section class="lp-hjalte kort kort--mork" data-in><p class="etikett etikett--ljus">Försäljningsledning · kvartal ' + kvartal + '</p>' +
        '<h1>Teamet har <em>' + IH.kort(sum(function (x) { return x.oppet; })) + '</em> i pipelinen</h1>' +
        '<p>' + team.length + ' säljare · ' + IH.kort(sum(function (x) { return x.viktat; })) + ' viktat · ' + IH.kort(sum(function (x) { return x.vunnet; })) + ' vunnet i år' + (lista.length ? ' · <b>' + lista.length + '</b> saker behöver din uppmärksamhet' : '') + '.</p></section>' +
      band('01', 'Teamet just nu', 'Status, siffrorna och affärerna per steg för varje säljare. Varningarna säger var någon behöver hjälp.', '<div class="lp-team">' + kort + '</div>') +
      '<div class="lp-tva">' +
        band('02', 'Behöver din uppmärksamhet', 'Affärer som stått still mer än två veckor, försenade uppgifter och förfrågningar utan ansvarig – det viktigaste först.', uppm) +
        band('03', 'Topplistan', 'Vunnet värde i år. Vinstgraden räknas på avslutade affärer (vunna och förlorade).', topplista) +
      '</div>' +
      band('04', 'Pipeline per säljare', 'Öppet värde per säljare, uppdelat på säljstegen. Håll över en del för beloppet.', pipe) +
      band('05', 'Aktivitet 14 dagar', 'Loggade samtal, möten, mejl och anteckningar per dag. Mörkare ruta = fler.', karta);
    return { titel: 'Försäljningsledning', html: html };
  };
})();
