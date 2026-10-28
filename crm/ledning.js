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
  var START = { ah: 'online', sa: 'mote' };
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
  /* Egna konton (Nytt konto): sparas i webbläsaren och läggs till exempelkontona */
  var EGNA = 'ih-crm-konton';
  function egnaKonton() { try { return JSON.parse(localStorage.getItem(EGNA)) || []; } catch (x) { return []; } }
  egnaKonton().forEach(function (u) { if (!IH.anvandare(u.id)) IH.ANVANDARE.push(u); });

  /* Kontomenyn (som kontoMeny i Uperformance): på dator täcker den sidomenyn exakt – samma kanter, hörn och höjd –
     annars ett ark. Dina siffror, snabbstatus, genvägarna, kontona, Nytt konto och Logga ut. */
  var km = null, kmStatusOppen = false;
  function stangKm() {
    if (!km) return;
    var p = km; km = null; p.setAttribute('data-stanger', '');
    document.documentElement.removeAttribute('data-konto-oppen');
    setTimeout(function () { p.remove(); }, IH.lugn ? 0 : 220);
    document.removeEventListener('pointerdown', utanforKm, true);
  }
  IH.stangKm = function () { stangKm(); };
  function utanforKm(ev) { if (km && !km.contains(ev.target) && !ev.target.closest('[data-g="konto-meny"]') && !ev.target.closest('.ark, .slojan')) stangKm(); }
  var NARV_IKON = { online: 'bock', mote: 'mote', upptagen: 'minus-cirkel', strax: 'timglas', lunch: 'kaffe', ute: 'byggnad', semester: 'sol', sjuk: 'termometer', osynlig: 'oga-av' };
  var SNABB = ['online', 'mote', 'upptagen', 'lunch', 'osynlig'];
  var ROLLNAMN = { salj: 'Sälj', prod: 'Produktion', admin: 'Admin' };
  var rollerFor = function (u) { return [ROLLNAMN[u.roll] || u.roll].concat(u.chef ? ['Chef'] : []); };
  function senastFor(u) {
    var n = narvaro(u.id);
    if (['online', 'mote', 'upptagen', 'ute'].indexOf(n.id) >= 0) return { text: 'aktiv nu', nu: true };
    var t = db().aktiviteter.filter(function (h) { return h.av === u.id; }).map(function (h) { return h.tid; }).sort().pop();
    return { text: t ? IH.sedan(t) : '–', nu: false };
  }
  function kontoRad(u, jag) {
    var n = narvaro(u.id), s = senastFor(u), tagg = jag ? 'div' : 'button';
    return '<' + tagg + ' class="km-rad' + (jag ? ' km-rad--jag' : '') + '"' + (jag ? '' : ' type="button" data-g="valj-anvandare" data-id="' + u.id + '"') + ' style="--n:' + n.farg + '">' +
      (jag ? '<span class="km-bock" aria-label="Inloggad">' + IH.emo('bock') + '</span>' : '') + avatar(u) +
      '<span class="km-rad__text"><strong title="' + e(u.namn) + '">' + e(u.namn) + '</strong><small class="km-rad__roller">' + rollerFor(u).join(' · ') + '</small>' +
      '<span class="km-rad__status"><i></i><b>' + e(n.namn) + '</b><span' + (s.nu ? ' class="km-nu"' : '') + '>· ' + e(s.text) + '</span></span></span></' + tagg + '>';
  }
  function kmHtml() {
    var jag = IH.jag(), nu = narvaro(jag.id), vald = lasNarvaro()[jag.id] || nu.id;
    var andra = IH.ANVANDARE.filter(function (u) { return u.id !== jag.id && !u.inaktiv; });
    var lank = function (attr, ikon, text) { var a = attr.indexOf('href') === 0; return '<' + (a ? 'a' : 'button type="button"') + ' class="km-lank" ' + attr + ' title="' + text + '">' + IH.emo(ikon) + '<span>' + text + '</span></' + (a ? 'a' : 'button') + '>'; };
    return '<header class="km-topp" style="--n:' + nu.farg + '">' +
        '<button type="button" class="km-stang" data-g="km-stang" aria-label="Stäng" title="Stäng (Esc)">' + i('stang') + '</button>' +
        '<span class="km-bild"><span class="km-ring" aria-hidden="true"></span><span class="avatar avatar--stor" style="--av:' + jag.farg + '">' + IH.initialer(jag.namn) + '</span></span>' +
        '<div class="km-du"><small>Inloggad som</small><strong title="' + e(jag.namn) + '">' + e(jag.namn) + '</strong><span class="km-roller">' + rollerFor(jag).map(function (r) { return '<span class="ap-roll" data-roll="' + r + '">' + r + '</span>'; }).join('') + '</span></div>' +
        '<button type="button" class="km-statusknapp" data-g="km-status" aria-expanded="' + kmStatusOppen + '"><i></i><span>' + e(nu.namn) + '</span>' + IH.emo('redigera') + '</button></header>' +
      '<div class="km-snabb">' + SNABB.map(function (id) { var n = NARVARO.filter(function (x) { return x.id === id; })[0];
        return '<button type="button" class="km-snabbval" data-g="satt-narvaro" data-s="' + id + '" style="--n:' + n.farg + '" title="' + n.namn + '" aria-label="Status: ' + n.namn + '" aria-pressed="' + (vald === id) + '">' + IH.emo(NARV_IKON[id]) + '</button>'; }).join('') + '</div>' +
      (kmStatusOppen ? '<div class="km-statusval">' + NARVARO.map(function (n) {
        return '<button type="button" data-g="satt-narvaro" data-s="' + n.id + '" aria-pressed="' + (vald === n.id) + '" style="--n:' + n.farg + '">' + IH.emo(NARV_IKON[n.id]) + '<span>' + e(n.namn) + '</span></button>';
      }).join('') + '</div>' : '') +
      '<div class="km-grupp"><p class="km-rubrik"><span>Byt konto</span><small>Demo: logga in som någon annan i teamet</small></p>' +
        '<div class="km-lista" role="list">' + [jag].concat(andra).map(function (u, n) { return '<div role="listitem" style="--i:' + n + '">' + kontoRad(u, u.id === jag.id) + '</div>'; }).join('') + '</div></div>' +
      '<footer class="km-fot">' + lank('href="#/profil"', 'anstallda', 'Min profil') +
        (jag.roll === 'admin' || jag.chef ? lank('data-g="km-nytt-konto"', 'anvandare-plus', 'Nytt konto') : lank('href="#/chatt"', 'prat', 'Meddelanden')) +
        lank('data-g="logga-ut"', 'logga-ut', 'Logga ut') + '</footer>';
  }
  IH.G['konto-meny'] = function () {
    if (km) { stangKm(); return; }
    var sido = document.querySelector('.sido'), r = sido && sido.getBoundingClientRect();
    if (!r || r.width < 200 || !matchMedia('(min-width: 1101px)').matches || document.documentElement.hasAttribute('data-sido-dold')) {
      IH.oppnaArk({ titel: IH.jag().namn, under: IH.jag().titel, ikon: 'kunder', kropp: '<div class="km-ark">' + kmHtml() + '</div>' });
      return;
    }
    km = document.createElement('aside');
    km.className = 'km-panel'; km.setAttribute('role', 'dialog'); km.setAttribute('aria-label', 'Ditt konto');
    km.style.left = r.left + 'px'; km.style.top = r.top + 'px'; km.style.width = r.width + 'px'; km.style.height = r.height + 'px';
    km.innerHTML = kmHtml();
    document.body.appendChild(km);
    anpassaKm();
    document.documentElement.setAttribute('data-konto-oppen', '');
    var f = km.querySelector('[aria-pressed="true"]'); if (f) f.focus({ preventScroll: true });
    setTimeout(function () { document.addEventListener('pointerdown', utanforKm, true); }, 0);
  };
  var valjForra = IH.G['valj-anvandare'];
  IH.G['valj-anvandare'] = function (el) { stangKm(); valjForra(el); };
  IH.G['km-status'] = function () { kmStatusOppen = !kmStatusOppen; if (km) ritaKm(); else { IH.stangArk(true); IH.G['konto-meny'](); } };
  IH.G['km-stang'] = function () { if (km) stangKm(); else IH.stangArk(); };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && km) { stangKm(); var k = document.querySelector('[data-g="konto-meny"]'); if (k) k.focus(); } });
  addEventListener('hashchange', stangKm);
  addEventListener('resize', stangKm);
  // Byter man status eller konto ritas panelen om på plats
  function ritaKm() { if (km) { km.innerHTML = kmHtml(); anpassaKm(); } }
  // Tätare i två steg tills allt får plats – först därefter rullar kontolistan (som i Uperformance)
  function anpassaKm() {
    if (!km) return;
    km.removeAttribute('data-tat'); km.removeAttribute('data-rulla');
    var over = function () { return km.scrollHeight > km.clientHeight + 1; };
    ['1', '2'].forEach(function (steg) { if (over()) km.setAttribute('data-tat', steg); });
    if (over()) km.setAttribute('data-rulla', '');
  }
  IH.G['km-nytt-konto'] = function () {
    stangKm();
    IH.oppnaArk({ titel: 'Nytt konto', under: 'Kontot sparas i den här webbläsaren (demo).', ikon: 'kunder',
      kropp: '<form id="km-ny-form" data-km-ny class="km-form"><label class="falt"><span>Namn</span><input name="namn" required maxlength="40" placeholder="För- och efternamn"></label>' +
        '<label class="falt"><span>Roll</span><select name="roll"><option value="salj">Sälj</option><option value="prod">Produktion</option>' + (IH.jag().roll === 'admin' ? '<option value="admin">Admin</option>' : '') + '</select></label>' +
        '<label class="km-kryss"><input type="checkbox" name="chef"> Försäljningschef (ser försäljningsledningen)</label>' +
        '<label class="falt"><span>Årets mål i kronor (sälj)</span><input name="mal" type="number" min="0" step="50000" placeholder="T.ex. 800000"></label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="km-ny-form">' + i('plus') + 'Skapa konto</button>' });
  };
  var FARGER = ['linear-gradient(135deg,#e8c98f,#a6763a)', 'linear-gradient(135deg,#9fc2c9,#3d6a73)', 'linear-gradient(135deg,#a9c8a4,#3f6b50)', 'linear-gradient(135deg,#f0b0a0,#a8513e)'];
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-km-ny]')) return;
    ev.preventDefault();
    var namn = t.namn.value.trim(); if (!namn) return;
    if (IH.ANVANDARE.some(function (u) { return u.namn.toLowerCase() === namn.toLowerCase(); })) { IH.toast('Det finns redan ett konto med det namnet', null, 'varning'); return; }
    var roll = t.roll.value, chef = t.chef.checked && roll === 'salj';
    var u = { id: 'u' + Date.now().toString(36), namn: namn, roll: roll, chef: chef || undefined, egen: true,
      titel: roll === 'salj' ? 'Sälj' + (chef ? ' · Försäljningschef' : '') : roll === 'prod' ? 'Produktion' : 'Administratör',
      farg: FARGER[egnaKonton().length % FARGER.length], mal: roll === 'salj' && +t.mal.value ? +t.mal.value : undefined };
    var lista = egnaKonton(); lista.push(u); try { localStorage.setItem(EGNA, JSON.stringify(lista)); } catch (x) { /* */ }
    IH.ANVANDARE.push(u);
    if (IH.sakLogg) IH.sakLogg('konto', 'Nytt konto: ' + namn + ' (' + u.titel + ').');
    IH.stangArk(); IH.uppdateraMeny(); if (/^#\/(chef|admin|kontroll)/.test(location.hash)) IH.rita();
    IH.toast('Kontot är skapat', namn + ' · ' + u.titel, 'kunder');
  });
  IH.G['satt-narvaro'] = function (el) {
    var jag = IH.jag(), m = lasNarvaro();
    m[jag.id] = el.getAttribute('data-s');
    try { localStorage.setItem('ih-crm-narvaro', JSON.stringify(m)); } catch (x) { /* privat läge */ }
    kmStatusOppen = false;
    if (km) ritaKm(); else IH.stangArk();
    IH.uppdateraMeny();
    if (/^#\/(chef|profil)/.test(location.hash)) IH.rita();
    IH.toast('Status: ' + narvaro(jag.id).namn, 'Kollegorna ser den i teamet.', 'kunder');
  };

  /* 02b Säljvy och chefsvy (som i Uperformance): för den som är både säljare och chef. Växeln överst i menyn byter
     mellan den egna försäljningen och teamets – var och en minns var man var senast. En kollegas profil som öppnas
     från chefsvyn hör till chefsvyn. */
  var senastSalj = '#/', senastChef = '#/chef', lageNu = /^#\/chef/.test(location.hash || '') ? 'chef' : 'salj';
  var arChefsSaljare = function () { var j = IH.jag(); return !!j.chef && j.roll === 'salj'; };
  var chefslage = function () {
    var h = location.hash || '';
    if (/^#\/chef/.test(h)) return true;
    var m = h.match(/^#\/profil\/([\w-]+)/);
    return !!m && m[1] !== IH.jag().id && lageNu === 'chef';
  };
  IH.vyVaxel = function () {
    if (!arChefsSaljare()) return '';
    var chef = chefslage();
    return '<div class="vy-vaxel" data-vy-vaxel data-lage="' + (chef ? 'chef' : 'salj') + '" role="group" aria-label="Vy"><span class="vy-vaxel__puck" aria-hidden="true"></span>' +
      '<button type="button" data-g="vy-byt" data-vy-till="salj" aria-pressed="' + !chef + '">' + IH.emo('trend') + 'Säljvy</button>' +
      '<button type="button" data-g="vy-byt" data-vy-till="chef" aria-pressed="' + chef + '">' + IH.emo('krona') + 'Chefsvy</button></div>';
  };
  function vaxelLage() {
    var chef = chefslage();
    document.documentElement.toggleAttribute('data-vy-chef', chef && arChefsSaljare());
    document.querySelectorAll('[data-vy-vaxel]').forEach(function (v) {
      v.setAttribute('data-lage', chef ? 'chef' : 'salj');
      v.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-vy-till') === 'chef') === chef)); });
    });
  }
  addEventListener('hashchange', function () {
    var h = location.hash || '#/';
    if (/^#\/chef/.test(h)) { senastChef = h; lageNu = 'chef'; }
    else if (!/^#\/profil/.test(h)) { lageNu = 'salj'; senastSalj = h; }
    vaxelLage();
  });
  IH.G['vy-byt'] = function (el) {
    var chef = el.getAttribute('data-vy-till') === 'chef';
    if (chef === chefslage()) return;
    var vy = document.querySelector('.vy');
    if (vy && !IH.lugn) { vy.setAttribute('data-vy-byte', chef ? 'till-chef' : 'till-salj'); clearTimeout(IH.G['vy-byt'].t); IH.G['vy-byt'].t = setTimeout(function () { vy.removeAttribute('data-vy-byte'); }, 900); }
    lageNu = chef ? 'chef' : 'salj';
    vaxelLage();
    IH.ga(chef ? senastChef : senastSalj);
    IH.toast(chef ? 'Chefsvy – teamets försäljning' : 'Säljvy – din egen försäljning', null, chef ? 'krona' : 'trend');
  };
  setTimeout(vaxelLage, 0);

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

  /* 05 Försäljningsledningen #/chef – samma upplägg som Uperformance visaChef: hjälten med verktygen och fyra tal, sedan
     01 Teamet just nu (filter), 02 Vem jobbar när, 03 Teamets kalender, 04 Att agera på (fördela, påminn), 05 Pipeline per
     säljare, 06 Aktivitet 14 dagar och 07 Topplistan 90 dagar. Allt räknas ur datan – inga påhittade siffror. */
  var chefUi = { filter: 'alla', kalVem: 'alla', kalMan: 0 };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var pct = function (x) { return Math.round(x * 100) + ' %'; };
  var inom = function (iso, d) { return iso && IH.dagarSedan(iso) < d; };
  var BORTA = ['semester', 'sjuk', 'offline', 'osynlig'], UPPTAGEN = ['upptagen', 'mote', 'strax', 'lunch', 'ute'];
  var chefBand = function (nr, rubrik, em, inne, opts) {
    opts = opts || {};
    return '<section class="ao-band kort' + (opts.klass ? ' ' + opts.klass : '') + '"><header class="ao-band__huvud"><div><p class="ao-ogon">' + nr + '</p><h2>' + rubrik + ' <em>' + em + '</em></h2>' + (opts.ingress ? '<p class="ao-band__ingress">' + opts.ingress + '</p>' : '') + '</div>' + (opts.hoger || '') + '</header>' + inne + '</section>';
  };
  function kalender(team) {
    var nu = new Date(), forsta = new Date(nu.getFullYear(), nu.getMonth() + chefUi.kalMan, 1), man = forsta.getMonth();
    var start = new Date(forsta); start.setDate(1 - ((forsta.getDay() + 6) % 7));
    var vem = function (id) { return chefUi.kalVem === 'alla' ? team.some(function (x) { return x.u.id === id; }) : id === chefUi.kalVem; };
    var handelser = [];
    db().aktiviteter.forEach(function (h) { if (vem(h.av)) handelser.push({ dag: dag0(h.tid).getTime(), u: h.av, text: h.text, typ: 'akt' }); });
    db().uppgifter.forEach(function (x) { if (!x.klar && vem(x.ansvarig)) handelser.push({ dag: dag0(x.forfaller).getTime(), u: x.ansvarig, text: x.text, typ: 'uppg' }); });
    db().affarer.forEach(function (a) { if (a.steg === 'vunnen' && a.vunnen && vem(a.ansvarig)) handelser.push({ dag: dag0(a.vunnen).getTime(), u: a.ansvarig, text: 'Vunnen: ' + a.titel, typ: 'vunnen' }); });
    var idag = dag0(nu).getTime(), celler = '';
    for (var n = 0; n < 42; n++) {
      var d = new Date(start); d.setDate(start.getDate() + n);
      var h = handelser.filter(function (x) { return x.dag === d.getTime(); });
      celler += '<div class="lp-kal__dag' + (d.getMonth() !== man ? ' utanfor' : '') + (d.getTime() === idag ? ' idag' : '') + (d.getDay() % 6 === 0 ? ' helg' : '') + '"><b>' + d.getDate() + '</b>' +
        h.slice(0, 3).map(function (x) { var u = IH.anvandare(x.u) || { farg: '#ccc', namn: '' }; return '<span class="lp-kal__h" data-typ="' + x.typ + '" style="--av:' + u.farg + '" title="' + e(u.namn + ': ' + x.text) + '"><i></i>' + e(x.text) + '</span>'; }).join('') +
        (h.length > 3 ? '<small>+' + (h.length - 3) + ' till</small>' : '') + '</div>';
    }
    var namn = forsta.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    return '<div class="lp-kal__verktyg"><div class="ap-filterrad" role="group" aria-label="Person">' + [{ id: 'alla', namn: 'Alla' }].concat(team.map(function (x) { return { id: x.u.id, namn: x.u.namn.split(' ')[0] }; })).map(function (p) {
        return '<button type="button" class="ap-filter" data-g="lp-kal-vem" data-f="' + p.id + '" aria-pressed="' + (chefUi.kalVem === p.id) + '">' + e(p.namn) + '</button>'; }).join('') + '</div>' +
      '<div class="lp-kal__man"><button type="button" class="ch-ruta" data-g="lp-kal-man" data-d="-1" aria-label="Föregående månad">' + i('pilv') + '</button><b>' + e(namn.charAt(0).toUpperCase() + namn.slice(1)) + '</b>' +
        '<button type="button" class="ch-ruta" data-g="lp-kal-man" data-d="1" aria-label="Nästa månad">' + i('pil') + '</button>' + (chefUi.kalMan ? '<button type="button" class="ap-filter" data-g="lp-kal-man" data-d="0">I dag</button>' : '') + '</div></div>' +
      '<div class="lp-kal"><span>Må</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lö</span><span>Sö</span>' + celler + '</div>' +
      '<p class="lp-teckenforklaring lp-kal__forkl"><span data-typ="akt"><i></i>Möten, samtal och mejl</span><span data-typ="uppg"><i></i>Uppgift förfaller</span><span data-typ="vunnen"><i></i>Vunnen affär</span></p>';
  }
  IH.vyer.chef = function () {
    var jag = IH.jag();
    if (!jag.chef) return { titel: 'Försäljning', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort lp-kort"><h2>' + IH.emo('las') + 'Bara för försäljningschefen</h2><p class="lp-tom">Administratören kan göra en säljare till försäljningschef under Ändra i adminpanelen.</p></section>' };
    var team = saljare().filter(function (u) { return !u.inaktiv; }).map(stat);
    var sum = function (f) { return team.reduce(function (t, x) { return t + f(x); }, 0); };
    team.forEach(function (x) {
      x.vunna90 = x.aff.filter(function (a) { return a.steg === 'vunnen' && inom(a.vunnen, 90); });
      x.vunnet90 = x.vunna90.reduce(function (t, a) { return t + (a.varde || 0); }, 0);
      x.forlorade90 = x.forlorade.filter(function (a) { return inom(a.andrad, 90); }).length;
      x.malKvartal = x.u.mal ? x.u.mal / 4 : 0;
    });
    var tot = { pipeline: sum(function (x) { return x.oppet; }), viktat: sum(function (x) { return x.viktat; }), vunnet: sum(function (x) { return x.vunnet90; }), mal: sum(function (x) { return x.malKvartal; }) };
    var avgjorda = sum(function (x) { return x.vunna90.length + x.forlorade90; }), vg = avgjorda ? sum(function (x) { return x.vunna90.length; }) / avgjorda : null;
    var aktivaNu = team.filter(function (x) { return BORTA.indexOf(narvaro(x.u.id).id) < 0; }).length;
    var oppnaN = sum(function (x) { return x.oppna.length; });
    var utan = db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad && (!a.ansvarig || !IH.anvandare(a.ansvarig) || IH.anvandare(a.ansvarig).inaktiv); });
    var h = new Date().getHours(), hals = h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll';
    var tal = function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + (x.ton || 'is') + '"><span class="ao-tal__ikon">' + IH.emo(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(x.varde) + '</strong><em>' + e(x.under) + '</em>' + (x.andel != null ? '<span class="lp-glasmatare" style="--andel:' + x.andel.toFixed(3) + '"><i></i></span>' : '') + '</span></' + (x.href ? 'a' : 'div') + '>'; };
    var hjalte = '<section class="ap-hjalte ao-hjalte kort lp-chefhjalte"><div class="sh-rutnat" aria-hidden="true"></div>' +
      '<div class="ao-text"><p class="etikett"><i class="sh-live"></i>Försäljningsledning · live ur CRM:et</p><h1>' + hals + ', ' + e(jag.namn.split(' ')[0]) + '. <em>Så går teamet.</em></h1>' +
        '<p class="ao-ingress">' + plural(team.length, 'säljare', 'säljare') + ' · ' + aktivaNu + ' i tjänst nu · ' + plural(oppnaN, 'öppen affär', 'öppna affärer') + (utan.length ? ' · <strong class="lp-varm">' + plural(utan.length, 'affär', 'affärer') + ' utan ansvarig</strong>' : '') + '</p>' +
        '<div class="sh-knappar"><button type="button" class="sh-knapp sh-knapp--accent" data-g="km-nytt-konto">' + IH.emo('anvandare-plus') + '<span>Lägg till säljare</span></button>' +
          '<button type="button" class="sh-knapp" data-g="lp-mal">' + IH.emo('mal') + '<span>Sätt mål</span></button><button type="button" class="sh-knapp" data-g="lp-uppgift">' + IH.emo('todo') + '<span>Ge uppgift</span></button>' +
          '<button type="button" class="sh-knapp" data-g="lp-rapport">' + IH.emo('ladda-ner') + '<span>Exportera rapport</span></button></div></div>' +
      '<div class="ap-tal">' + [
        { ikon: 'portfolj', etikett: 'Teamets pipeline', varde: IH.kort(tot.pipeline), under: plural(oppnaN, 'affär', 'affärer') + ' öppna', href: '#/salj', ton: 'lila' },
        { ikon: 'mal', etikett: 'Viktad prognos', varde: IH.kort(tot.viktat), under: 'värde × chansen att vinna', ton: 'is' },
        { ikon: 'medalj', etikett: 'Vunnet 90 dagar', varde: IH.kort(tot.vunnet), under: tot.mal ? pct(tot.vunnet / tot.mal) + ' av kvartalsmålet ' + IH.kort(tot.mal) : 'inget mål satt', ton: 'gron', andel: tot.mal ? Math.min(1, tot.vunnet / tot.mal) : null },
        { ikon: 'trend', etikett: 'Vinstgrad 90 d', varde: vg == null ? '–' : pct(vg), under: 'vunna av avgjorda affärer', ton: 'gul' }
      ].map(tal).join('') + '</div></section>';

    // 01 Teamet just nu
    var vald = team.filter(function (x) { var s = narvaro(x.u.id).id; return chefUi.filter === 'alla' || (chefUi.filter === 'tillganglig' ? s === 'online' : chefUi.filter === 'upptagen' ? UPPTAGEN.indexOf(s) >= 0 : BORTA.indexOf(s) >= 0); });
    var kort = vald.map(function (x) {
      var n = narvaro(x.u.id), varn = [];
      if (x.stilla.length) varn.push(plural(x.stilla.length, 'affär står still', 'affärer står still'));
      if (x.sena.length) varn.push(plural(x.sena.length, 'försenad uppgift', 'försenade uppgifter'));
      var perSteg = IH.SALJSTEG.slice(0, -1).map(function (s) { return { s: s, l: x.oppna.filter(function (a) { return a.steg === s.id; }) }; });
      var maxS = Math.max.apply(null, perSteg.map(function (p) { return p.l.length; }).concat([1]));
      return '<article class="lp-saljare">' +
        '<header>' + avatar(x.u) + '<div><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small style="--n:' + n.farg + '"><i></i>' + e(n.namn) + (x.u.chef ? ' · Chef' : '') + '</small></div></header>' +
        '<div class="lp-saljare__tal"><div><small>Öppet</small><b class="tal">' + IH.kort(x.oppet) + '</b></div><div><small>Viktat</small><b class="tal">' + IH.kort(x.viktat) + '</b></div><div><small>Vunnet 90 d</small><b class="tal">' + IH.kort(x.vunnet90) + '</b></div></div>' +
        (x.malKvartal ? '<p class="lp-saljare__mal">' + pct(Math.min(1, x.vunnet90 / x.malKvartal)) + ' av kvartalsmålet ' + IH.kort(x.malKvartal) + '<span class="lp-mal__spar"><i style="--a:' + Math.min(1, x.vunnet90 / x.malKvartal).toFixed(3) + '"></i></span></p>' : '<p class="lp-saljare__mal lp-saljare__mal--tom">Inget mål satt · <button type="button" class="lp-lank" data-g="lp-mal" data-id="' + x.u.id + '">Sätt mål</button></p>') +
        '<ul class="lp-perSteg">' + perSteg.map(function (p) {
          return '<li style="--f:' + p.s.farg + ';--a:' + (p.l.length / maxS).toFixed(3) + '"><span>' + e(p.s.kort) + '</span><i></i><b>' + p.l.length + '</b><small>' + (p.l.length ? IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) : '–') + '</small></li>';
        }).join('') + '</ul>' +
        '<div class="lp-vecka"><small>Aktivitet 7 dagar</small>' + staplar(perDag(x.akt, 7), 'lp-staplar lp-staplar--liten') + '</div>' +
        (varn.length ? '<p class="lp-varning">' + IH.emo('varning') + e(varn.join(' · ')) + '</p>' : '<p class="lp-lugnt">' + IH.emo('klar') + 'Inget som väntar</p>') +
        '<footer><a class="knapp knapp--liten" href="#/profil/' + x.u.id + '">' + i('kunder') + 'Profil</a>' +
          '<button class="knapp knapp--liten" type="button" data-g="lp-uppgift" data-id="' + x.u.id + '">' + IH.emo('todo') + 'Uppgift</button>' +
          (x.u.id !== jag.id ? '<button class="knapp knapp--liten" type="button" data-g="ch-skriv-till" data-uid="' + x.u.id + '">' + i('samtal') + 'Skriv</button>' : '') + '</footer></article>';
    }).join('') || '<p class="lp-tom">Ingen i teamet har den statusen just nu.</p>';
    var filter = [['alla', 'Alla'], ['tillganglig', 'Tillgängliga'], ['upptagen', 'Upptagna'], ['borta', 'Borta']].map(function (f) { return '<button type="button" class="ap-filter" data-g="lp-chef-filter" data-f="' + f[0] + '" aria-pressed="' + (chefUi.filter === f[0]) + '">' + f[1] + '</button>'; }).join('');

    // 02 Vem jobbar när: status nu och loggat arbete måndag–söndag den här veckan
    var mandag = dag0(new Date()); mandag.setDate(mandag.getDate() - ((mandag.getDay() + 6) % 7));
    var vecka = []; for (var d = 0; d < 7; d++) { var x0 = new Date(mandag); x0.setDate(mandag.getDate() + d); vecka.push(x0); }
    var idag0 = dag0(new Date()).getTime();
    var narv = '<div class="lp-narv"><span></span>' + vecka.map(function (v) { return '<small class="' + (v.getTime() === idag0 ? 'idag' : '') + (v.getDay() % 6 === 0 ? ' helg' : '') + '">' + VECKODAG[v.getDay()] + ' ' + v.getDate() + '</small>'; }).join('') + '<small>Nu</small>' +
      team.map(function (x) {
        var n = narvaro(x.u.id);
        return '<a class="lp-narv__vem" href="#/profil/' + x.u.id + '">' + avatar(x.u) + e(x.u.namn.split(' ')[0]) + '</a>' + vecka.map(function (v) {
          var nasta = new Date(v); nasta.setDate(v.getDate() + 1);
          var antal = x.akt.filter(function (h) { var t = new Date(h.tid); return t >= v && t < nasta; }).length, framtid = v.getTime() > idag0;
          return '<i class="' + (antal ? 'pa' : '') + (framtid ? ' framtid' : '') + (v.getTime() === idag0 ? ' idag' : '') + '" title="' + e(x.u.namn) + ', ' + IH.datum(v.toISOString()) + ': ' + (framtid ? 'kommande' : plural(antal, 'händelse', 'händelser')) + '">' + (antal || '') + '</i>';
        }).join('') + '<span class="lp-status" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</span>';
      }).join('') + '</div>';

    // 04 Att agera på – med Fördela och Påminn direkt i raden
    var lista = [];
    team.forEach(function (x) {
      x.stilla.forEach(function (a) { lista.push({ typ: 'Står still', ikon: 'klocka', text: a.titel, under: x.u.namn + ' · ' + IH.dagarSedan(a.andrad) + ' dagar i ' + IH.steg(a.steg).namn.toLowerCase(), href: '#/salj/' + a.id, vikt: IH.dagarSedan(a.andrad), affar: a.id, uid: x.u.id }); });
      x.sena.forEach(function (u) { lista.push({ typ: 'Försenad uppgift', ikon: 'larm', text: u.text, under: x.u.namn + ' · skulle vara klar ' + IH.datum(u.forfaller), href: '#/att-gora', vikt: 20 + IH.dagarSedan(u.forfaller), uid: x.u.id }); });
    });
    utan.forEach(function (a) { lista.push({ typ: 'Ingen ansvarig', ikon: 'portfolj', text: a.titel, under: 'Affär utan ansvarig säljare', href: '#/salj/' + a.id, vikt: 40, affar: a.id }); });
    db().forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).forEach(function (f) {
      lista.push({ typ: 'Ingen ansvarig', ikon: 'inkorg', text: f.namn + (f.ort ? ' · ' + f.ort : ''), under: 'Ny förfrågan ' + IH.sedan(f.tid || f.skapad), href: '#/forfragningar/' + f.id, vikt: 30, forfragan: f.id });
    });
    lista.sort(function (a, b) { return b.vikt - a.vikt; });
    var uppm = lista.length ? '<ul class="ao-upp lp-agera">' + lista.slice(0, 7).map(function (r) {
      return '<li><span class="ao-upp__ikon">' + IH.emo(r.ikon) + '</span><a class="ao-upp__text" href="' + r.href + '"><small class="lp-agera__typ">' + e(r.typ) + '</small><strong>' + e(r.text) + '</strong><small>' + e(r.under) + '</small></a><span class="lp-agera__knappar">' +
        (r.affar || r.forfragan ? '<button type="button" class="knapp knapp--liten" data-g="lp-fordela"' + (r.affar ? ' data-affar="' + r.affar + '"' : ' data-forfragan="' + r.forfragan + '"') + '>Fördela</button>' : '') +
        (r.uid && r.uid !== jag.id ? '<button type="button" class="knapp knapp--liten" data-g="lp-pamin" data-uid="' + r.uid + '" data-text="' + e(r.typ + ': ' + r.text) + '">Påminn</button>' : '') + '</span></li>';
    }).join('') + '</ul>' : '<div class="ao-lugnt ao-lugnt--stor">' + IH.emo('skold') + '<div><strong>Inget att agera på</strong><small>Inga affärer står still, inga uppgifter är försenade och allt har en ansvarig.</small></div></div>';

    // 05 Pipeline per säljare
    var maxP = Math.max.apply(null, team.map(function (x) { return x.oppet; }).concat([1]));
    var pipe = '<ul class="lp-pipe">' + team.map(function (x) {
      return '<li><span class="lp-pipe__namn">' + avatar(x.u) + e(x.u.namn.split(' ')[0]) + '</span><span class="lp-pipe__stapel" style="--a:' + (x.oppet / maxP).toFixed(3) + '">' + IH.SALJSTEG.slice(0, -1).map(function (s) {
        var v = x.oppna.filter(function (a) { return a.steg === s.id; }).reduce(function (t, a) { return t + a.varde; }, 0);
        return v ? '<i style="--f:' + s.farg + ';flex:' + v + '" title="' + e(s.namn) + ': ' + IH.kr(v) + '"></i>' : '';
      }).join('') + '</span><b class="tal">' + IH.kort(x.oppet) + '</b><small>viktat ' + IH.kort(x.viktat) + '</small></li>';
    }).join('') + '</ul><p class="lp-teckenforklaring">' + IH.SALJSTEG.slice(0, -1).map(function (s) { return '<span style="--f:' + s.farg + '"><i></i>' + e(s.namn) + '</span>'; }).join('') + '</p>' +
      '<div class="ao-statrad"><div><small>Öppet</small><strong>' + IH.kort(tot.pipeline) + '</strong><em>' + plural(oppnaN, 'affär', 'affärer') + '</em></div><div><small>Viktat</small><strong>' + IH.kort(tot.viktat) + '</strong><em>prognos</em></div><div><small>Snitt per affär</small><strong>' + (oppnaN ? IH.kort(tot.pipeline / oppnaN) : '–') + '</strong><em>öppet värde</em></div></div>';
    // 06 Aktivitet 14 dagar
    var dagar14 = perDag([], 14), maxA = 1;
    var rader = team.map(function (x) { var dd = perDag(x.akt, 14); dd.forEach(function (y) { if (y.antal > maxA) maxA = y.antal; }); return { x: x, d: dd }; });
    var karta = '<div class="lp-karta" style="--n:14"><span></span>' + dagar14.map(function (dd) { return '<small class="' + (dd.dag.getDay() % 6 === 0 ? 'helg' : '') + '">' + VECKODAG[dd.dag.getDay()] + '</small>'; }).join('') + '<span class="lp-karta__summa">Summa</span>' +
      rader.map(function (r) {
        var t = r.d.reduce(function (s, y) { return s + y.antal; }, 0);
        return '<span class="lp-karta__namn">' + e(r.x.u.namn.split(' ')[0]) + '</span>' + r.d.map(function (y) {
          return '<i style="--a:' + (y.antal / maxA).toFixed(3) + '" class="' + (y.antal ? 'pa' : '') + '" title="' + IH.datum(y.dag.toISOString()) + ': ' + y.antal + '">' + (y.antal || '') + '</i>';
        }).join('') + '<b>' + t + '</b>';
      }).join('') + '</div>';
    // 07 Topplistan 90 dagar
    var topp = team.slice().sort(function (a, b) { return b.vunnet90 - a.vunnet90 || b.viktat - a.viktat; });
    var topplista = '<ol class="lp-topp">' + topp.map(function (x, n) {
      var g = x.vunna90.length + x.forlorade90;
      return '<li class="' + (n === 0 && x.vunnet90 ? 'forst' : '') + '"><span class="lp-topp__plats">' + (n + 1) + '</span>' + avatar(x.u) + '<span><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small>' + plural(x.vunna90.length, 'order', 'ordrar') + (g ? ' · vinstgrad ' + pct(x.vunna90.length / g) : '') + '</small></span><b class="tal">' + IH.kort(x.vunnet90) + '</b></li>';
    }).join('') + '</ol>';

    var html = hjalte +
      chefBand('01 · Teamet', 'Teamet', 'just nu', '<div class="lp-team">' + kort + '</div>', { ingress: 'Status, pipeline, kvartalsmålet och veckans aktivitet per säljare – klicka för profilen.', hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + filter + '</div>' }) +
      chefBand('02 · Närvaro', 'Vem jobbar', 'när', narv, { ingress: 'Statusen just nu och det som loggats i CRM:et varje dag den här veckan.' }) +
      chefBand('03 · Kalender', 'Teamets', 'kalender', kalender(team), { ingress: 'Möten, samtal och mejl, uppgifter som förfaller och vunna affärer – för hela teamet eller en person.' }) +
      '<div class="ao-tva">' + chefBand('04 · Att agera på', 'Behöver din', 'uppmärksamhet', uppm, { hoger: lista.length ? '<span class="ao-band__tal">' + lista.length + '</span>' : '' }) +
        chefBand('05 · Pipeline', 'Pipeline', 'per säljare', pipe) + '</div>' +
      '<div class="ao-tva">' + chefBand('06 · Aktivitet', 'Aktivitet', '14 dagar', karta) +
        chefBand('07 · Resultat', 'Topplistan', '90 dagar', topplista) + '</div>';
    return { titel: 'Försäljning', html: html };
  };

  /* Chefens verktyg ------------------------------------------------------------------------------ */
  var G = IH.G;
  var valSaljare = function (namn, vald) { return '<label class="falt"><span>Säljare</span><select name="' + namn + '">' + saljare().filter(function (u) { return !u.inaktiv; }).map(function (u) { return '<option value="' + u.id + '"' + (u.id === vald ? ' selected' : '') + '>' + e(u.namn) + '</option>'; }).join('') + '</select></label>'; };
  G['lp-chef-filter'] = function (el) { chefUi.filter = el.getAttribute('data-f'); IH.rita(); };
  G['lp-kal-vem'] = function (el) { chefUi.kalVem = el.getAttribute('data-f'); IH.rita(); };
  G['lp-kal-man'] = function (el) { var d = +el.getAttribute('data-d'); chefUi.kalMan = d ? chefUi.kalMan + d : 0; IH.rita(); };
  G['lp-mal'] = function (el) {
    var id = el.getAttribute('data-id');
    var lista = saljare().filter(function (u) { return !u.inaktiv && (!id || u.id === id); });
    IH.oppnaArk({ titel: 'Säljmål', under: 'Årsmål per säljare – kvartalsmålet är en fjärdedel.', ikon: 'mal',
      kropp: '<form id="lp-mal-form" data-lp-mal class="km-form">' + lista.map(function (u) {
        return '<label class="falt"><span>' + e(u.namn) + ' – årsmål i kronor</span><input name="' + u.id + '" type="number" min="0" step="50000" value="' + (u.mal || '') + '" placeholder="T.ex. 900000"></label>';
      }).join('') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-mal-form">' + i('bock') + 'Spara målen</button>' });
  };
  G['lp-uppgift'] = function (el) {
    var id = el.getAttribute('data-id'), imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    IH.oppnaArk({ titel: 'Ge en uppgift', under: 'Hamnar under Att göra hos säljaren.', ikon: 'todo',
      kropp: '<form id="lp-uppg-form" data-lp-uppgift class="km-form">' + valSaljare('vem', id) +
        '<label class="falt"><span>Uppgift</span><input name="text" required maxlength="120" placeholder="T.ex. Ring kunden om grunden"></label>' +
        '<label class="falt"><span>Klar senast</span><input name="datum" type="date" required value="' + imorgon.toISOString().slice(0, 10) + '"></label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-uppg-form">' + i('plus') + 'Ge uppgiften</button>' });
  };
  G['lp-fordela'] = function (el) {
    var aid = el.getAttribute('data-affar'), fid = el.getAttribute('data-forfragan');
    var a = aid && IH.affar(aid), f = fid && IH.forfragan(fid);
    IH.oppnaArk({ titel: 'Fördela', under: e(a ? a.titel : f ? f.namn : ''), ikon: 'kunder',
      kropp: '<form id="lp-ford-form" data-lp-fordela="' + (aid || '') + '" data-lp-forfragan="' + (fid || '') + '" class="km-form">' + valSaljare('vem', a ? a.ansvarig : null) +
        '<label class="km-kryss"><input type="checkbox" name="meddela" checked> Skicka ett meddelande till säljaren</label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-ford-form">' + i('bock') + 'Fördela</button>' });
  };
  G['lp-pamin'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-uid')); if (!u) return;
    if (IH.chattSkickaTill && IH.chattSkickaTill(u.id, 'Påminnelse – ' + el.getAttribute('data-text') + '. Hör av dig om du behöver hjälp!')) IH.toast('Påminnelsen är skickad', 'Till ' + u.namn + ' i chatten.', 'samtal');
    else IH.toast('Kunde inte skicka', 'Chatten är skrivskyddad i supportläget.', 'varning');
  };
  G['lp-rapport'] = function () {
    var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
    var rader = [['Säljare', 'Öppna affärer', 'Öppet värde', 'Viktat', 'Vunnet 90 d', 'Ordrar 90 d', 'Årsmål', 'Aktiviteter 14 d', 'Försenade uppgifter'].map(q).join(';')].concat(saljare().map(function (u) {
      var x = stat(u), v90 = x.aff.filter(function (a) { return a.steg === 'vunnen' && inom(a.vunnen, 90); });
      return [u.namn, x.oppna.length, Math.round(x.oppet), Math.round(x.viktat), v90.reduce(function (t, a) { return t + a.varde; }, 0), v90.length, u.mal || '', x.akt.filter(function (h) { return IH.dagarSedan(h.tid) < 14; }).length, x.sena.length].map(q).join(';');
    }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rader.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'legohus-forsaljning-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    IH.toast('Rapporten är nedladdad', 'Teamets försäljning som CSV – öppnas i Excel.', 'ladda-ner');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches) return;
    if (t.matches('[data-lp-mal]')) {
      ev.preventDefault();
      [].slice.call(t.elements).forEach(function (f) { if (!f.name) return; var u = IH.anvandare(f.name), v = Math.max(0, Math.round(+f.value || 0)); if (u && IH.andraKonto) IH.andraKonto(u.id, { mal: v }); else if (u) u.mal = v || undefined; });
      IH.stangArk(); IH.rita(); IH.toast('Målen är sparade', 'Kvartalsmålet är en fjärdedel av årsmålet.', 'mal');
    }
    if (t.matches('[data-lp-uppgift]')) {
      ev.preventDefault();
      var u = IH.anvandare(t.vem.value), text = t.text.value.trim(); if (!u || !text) return;
      db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text, forfaller: new Date(t.datum.value + 'T09:00:00').toISOString(), klar: false, kund: null, affar: null, ansvarig: u.id, av: IH.jag().id });
      IH.spara(); IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      IH.toast('Uppgiften är given', u.namn + ' ser den under Att göra.', 'todo');
    }
    if (t.matches('[data-lp-fordela]')) {
      ev.preventDefault();
      var till = IH.anvandare(t.vem.value), a = IH.affar(t.getAttribute('data-lp-fordela')), f = IH.forfragan(t.getAttribute('data-lp-forfragan')); if (!till) return;
      if (a) { a.ansvarig = till.id; a.andrad = new Date().toISOString(); IH.logga('system', 'Fördelad till ' + till.namn + ' av ' + IH.jag().namn + '.', a.kund, a.id); }
      if (f) { f.tilldelad = till.id; }
      IH.spara();
      if (t.meddela.checked && till.id !== IH.jag().id && IH.chattSkickaTill) IH.chattSkickaTill(till.id, 'Jag har gett dig ' + (a ? 'affären ' + a.titel : 'förfrågan från ' + f.namn) + '. Hör av dig om du har frågor!');
      IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      IH.toast('Fördelad', (a ? a.titel : f ? f.namn : '') + ' → ' + till.namn, 'kunder');
    }
  });
})();
