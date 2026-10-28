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
  var chefUi = { filter: 'alla', kalVem: 'alla', kalMan: 0, kalTyp: 'alla', kalVy: 'man', agera: 'alla', topp: 90, narvVecka: 0 };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var pct = function (x) { return Math.round(x * 100) + ' %'; };
  var inom = function (iso, d) { return iso && IH.dagarSedan(iso) < d; };
  var BORTA = ['semester', 'sjuk', 'offline', 'osynlig'], UPPTAGEN = ['upptagen', 'mote', 'strax', 'lunch', 'ute'];
  var chefBand = function (nr, rubrik, em, inne, opts) {
    opts = opts || {};
    return '<section class="ao-band kort' + (opts.klass ? ' ' + opts.klass : '') + '"><header class="ao-band__huvud"><div><p class="ao-ogon">' + nr + '</p><h2>' + rubrik + ' <em>' + em + '</em></h2>' + (opts.ingress ? '<p class="ao-band__ingress">' + opts.ingress + '</p>' : '') + '</div>' + (opts.hoger || '') + '</header>' + inne + '</section>';
  };
  // Teamets kalender: alla händelser ur datan, filtrerbara på person och typ; dagar och händelser går att klicka
  // på, nya möten, samtal och uppgifter läggs till direkt, och försenade uppgifter syns tydligt.
  var KAL_TYP = { akt: 'Möten och samtal', uppg: 'Uppgifter', vunnen: 'Vunna affärer' };
  var AKT_NAMN = { mote: 'Möte', samtal: 'Samtal', mejl: 'Mejl', notis: 'Anteckning', system: 'System' };
  var FRANVARO = { semester: ['Semester', 'flyg'], sjuk: ['Sjuk', 'termometer'], ledig: ['Ledig', 'kaffe'], utbildning: ['Utbildning', 'glodlampa'] };
  var franvaroLista = function () { var d = db(); if (!d.franvaro) d.franvaro = []; return d.franvaro; };
  var franvaroPa = function (uid, t) { return franvaroLista().find(function (f) { return f.u === uid && t >= dag0(f.fran).getTime() && t <= dag0(f.till).getTime(); }); };
  var dagISO = function (d) { return IH.dagStr ? IH.dagStr(d) : d.toISOString().slice(0, 10); };
  var veckonr = function (d) { var t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7); var v1 = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - v1) / 864e5 - 3 + (v1.getDay() + 6) % 7) / 7); };
  var kortDatum = function (d) { return d.getDate() + ' ' + d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''); };
  var AKT_IKON = { samtal: 'samtal', mejl: 'post', mote: 'kunder', notis: 'anteckning', system: 'blixt' };
  function senasteHandelser(team) {
    var l = db().aktiviteter.filter(function (h) { return team.some(function (x) { return x.u.id === h.av; }); }).sort(function (a, b) { return new Date(b.tid) - new Date(a.tid); }).slice(0, 4);
    if (!l.length) return '';
    return '<div class="lp-karta__skala" aria-hidden="true">Färre<i style="--a:.15"></i><i style="--a:.35"></i><i style="--a:.6"></i><i style="--a:.85"></i><i style="--a:1"></i>Fler</div>' +
      '<p class="lp-senaste__rubrik">Senaste händelserna</p><ul class="lp-senaste">' + l.map(function (h) {
        var u = IH.anvandare(h.av) || { namn: '' }, k = h.kund && IH.kund(h.kund), dagar = IH.dagarSedan(h.tid);
        return '<li><a href="' + (k ? '#/kunder/' + k.id : '#/') + '"><span class="lp-senaste__ikon" data-typ="' + (h.typ || 'notis') + '">' + i(AKT_IKON[h.typ] || 'anteckning') + '</span><span class="lp-senaste__text"><b>' + e(u.namn.split(' ')[0] + ': ' + h.text) + '</b><small>' + e((AKT_NAMN[h.typ] || 'Aktivitet') + (k ? ' · ' + k.namn : '') + ' · ' + (dagar < 7 ? IH.sedan(h.tid) : IH.datum(h.tid))) + '</small></span><span class="lp-senaste__pil">' + i('pil') + '</span></a></li>';
      }).join('') + '</ul>';
  }
  function narvaroVy(team) {
    var idag = dag0(new Date()), idagT = idag.getTime(), mandag = new Date(idag); mandag.setDate(idag.getDate() - (idag.getDay() + 6) % 7 + (chefUi.narvVecka - 2) * 7);
    var veckor = []; for (var v = 0; v < 4; v++) { var m = new Date(mandag); m.setDate(mandag.getDate() + v * 7); var dd = []; for (var d = 0; d < 7; d++) { var x = new Date(m); x.setDate(m.getDate() + d); dd.push(x); } veckor.push(dd); }
    var dagar = veckor.reduce(function (l, w) { return l.concat(w); }, []);
    var IKON_AKT = function (n) { return n; };
    var celler = function (x) {
      var jobbat = 0, schema = 0, borta = 0;
      var html = veckor.map(function (w) { return '<span class="lp-nv__vecka">' + w.map(function (d) {
        var t = d.getTime(), helg = d.getDay() % 6 === 0, fr = franvaroPa(x.u.id, t), antal = x.akt.filter(function (h) { return dag0(h.tid).getTime() === t; }).length;
        var iTjanst = t === idagT && BORTA.indexOf(narvaro(x.u.id).id) < 0, klass, inne = '', titel;
        if (fr && !helg) { klass = 'f f-' + fr.typ; inne = IH.emo(FRANVARO[fr.typ][1]); titel = FRANVARO[fr.typ][0]; if (t <= idagT) borta++; }
        else if (t > idagT) { klass = helg ? 'helg' : 'plan'; titel = helg ? 'Helg' : 'Planerad arbetsdag'; }
        else if (antal || iTjanst) { klass = 'jobb' + (helg ? ' helg' : ''); inne = '<i></i>'; titel = antal ? plural(antal, 'händelse', 'händelser') + ' i CRM:et' : 'I tjänst'; if (!helg) jobbat++; }
        else { klass = helg ? 'helg' : 'ingen'; titel = helg ? 'Helg' : 'Ingen aktivitet'; }
        if (!helg && t <= idagT && !(fr)) schema++;
        return '<button type="button" class="lp-nv__d ' + klass + (t === idagT ? ' idag' : '') + '" data-g="lp-franvaro" data-uid="' + x.u.id + '" data-dag="' + dagISO(d) + '"' + (fr ? ' data-fid="' + fr.id + '"' : '') + ' title="' + e(x.u.namn + ' · ' + d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' }) + ' · ' + titel) + '">' + inne + '</button>';
      }).join('') + '</span>'; }).join('');
      return { html: html, jobbat: jobbat, schema: schema, borta: borta };
    };
    var huvud = '<span></span>' + veckor.map(function (w) {
      var nu = w.some(function (d) { return d.getTime() === idagT; });
      return '<span class="lp-nv__vecka lp-nv__rubrik' + (nu ? ' nu' : '') + '"><span class="lp-nv__v"><b>V ' + veckonr(w[0]) + '</b><small>' + kortDatum(w[0]) + '–' + kortDatum(w[6]) + '</small></span>' +
        w.map(function (d) { return '<span class="lp-nv__dag' + (d.getDay() % 6 === 0 ? ' helg' : '') + (d.getTime() === idagT ? ' idag' : '') + '"><small>' + 'SMTOTFL'.charAt(d.getDay()) + '</small><b>' + d.getDate() + '</b></span>'; }).join('') + '</span>';
    }).join('') + '<span class="lp-nv__summa">Jobbat</span>';
    var rader = team.map(function (x) {
      var c = celler(x), n = narvaro(x.u.id), kvot = c.schema ? c.jobbat / c.schema : 0;
      var kommande = franvaroLista().filter(function (f) { return f.u === x.u.id && dag0(f.till).getTime() >= idagT; }).length;
      return '<a class="lp-nv__vem" href="#/profil/' + x.u.id + '">' + avatar(x.u) + '<span><b>' + e(x.u.namn.split(' ')[0]) + '</b><small>Mån–fre · ' + e(n.namn.toLowerCase()) + '</small></span></a>' + c.html +
        '<span class="lp-nv__jobbat"><b>' + c.jobbat + '<small>/' + c.schema + '</small></b><i style="--a:' + kvot.toFixed(3) + '"></i>' + (c.borta ? '<small>' + plural(c.borta, 'dag', 'dagar') + ' frånvaro</small>' : kommande ? '<small>frånvaro planerad</small>' : '') + '</span>';
    }).join('');
    // överst: läget i dag och kommande frånvaro
    var bortaIdag = team.filter(function (x) { return franvaroPa(x.u.id, idagT) || BORTA.indexOf(narvaro(x.u.id).id) >= 0; });
    var kommer = franvaroLista().filter(function (f) { return dag0(f.till).getTime() >= idagT && team.some(function (x) { return x.u.id === f.u; }); }).sort(function (a, b) { return new Date(a.fran) - new Date(b.fran); }).slice(0, 4);
    var chips = (bortaIdag.length ? '<span class="lp-nv__chip varm">' + IH.emo('varning') + e(bortaIdag.map(function (x) { return x.u.namn.split(' ')[0]; }).join(', ')) + ' borta i dag</span>' : '<span class="lp-nv__chip ok">' + i('bock') + 'Alla i tjänst i dag</span>') +
      kommer.map(function (f) { var u = IH.anvandare(f.u) || { namn: '' }; return '<button type="button" class="lp-nv__chip f-' + f.typ + '" data-g="lp-franvaro" data-fid="' + f.id + '" data-uid="' + f.u + '" data-dag="' + dagISO(new Date(f.fran)) + '">' + IH.emo(FRANVARO[f.typ][1]) + e(u.namn.split(' ')[0] + ' · ' + FRANVARO[f.typ][0].toLowerCase() + ' ' + kortDatum(new Date(f.fran)) + (f.till !== f.fran ? '–' + kortDatum(new Date(f.till)) : '')) + '</button>'; }).join('');
    return '<div class="lp-nv__topp"><div class="lp-nv__chips">' + chips + '</div><div class="lp-nv__nav"><button type="button" class="ch-ruta" data-g="lp-narv-v" data-d="-1" aria-label="Veckan innan">' + i('pilv') + '</button><button type="button" class="ap-filter" data-g="lp-narv-v" data-d="0" aria-pressed="' + (chefUi.narvVecka === 0) + '">I dag</button><button type="button" class="ch-ruta" data-g="lp-narv-v" data-d="1" aria-label="Veckan efter">' + i('pil') + '</button>' +
        '<button type="button" class="knapp knapp--liten" data-g="lp-franvaro">' + i('plus') + 'Frånvaro</button></div></div>' +
      '<div class="lp-nv" style="--dagar:' + dagar.length + '">' + huvud + rader + '</div>' +
      '<p class="lp-teckenforklaring lp-nv__forkl"><span class="jobb"><i></i>Jobbade</span><span class="plan"><i></i>Planerad</span><span class="ingen"><i></i>Ingen aktivitet</span>' + Object.keys(FRANVARO).map(function (k) { return '<span class="f-' + k + '"><i></i>' + FRANVARO[k][0] + '</span>'; }).join('') + '<span class="lp-kal__tips">Klicka på en dag för att lägga in frånvaro.</span></p>';
  }
  IH.G['lp-narv-v'] = function (el) { var d = +el.getAttribute('data-d'); chefUi.narvVecka = d ? chefUi.narvVecka + d : 0; IH.rita(); };
  IH.G['lp-franvaro'] = function (el) {
    var fid = el.getAttribute('data-fid'), f = fid && franvaroLista().find(function (x) { return x.id === fid; });
    var uid = el.getAttribute('data-uid') || (f && f.u) || IH.jag().id, dag = el.getAttribute('data-dag') || dagISO(new Date());
    var team = IH.ANVANDARE.filter(function (u) { return u.roll === 'salj' && !u.inaktiv; });
    IH.oppnaArk({ titel: f ? 'Ändra frånvaro' : 'Lägg in frånvaro', ikon: 'kalender', under: f ? 'Ändra datum eller ta bort frånvaron.' : 'Syns i Vem jobbar när och räknas bort från arbetsdagarna.',
      kropp: '<form id="lp-fv-form" data-lp-franvaro="' + (f ? f.id : '') + '" class="km-form lp-kalform">' +
        '<div class="lp-kalform__typ lp-fv__typ" role="radiogroup" aria-label="Typ">' + Object.keys(FRANVARO).map(function (k, n) { return '<label><input type="radio" name="typ" value="' + k + '"' + ((f ? f.typ === k : n === 0) ? ' checked' : '') + '><span class="f-' + k + '">' + IH.emo(FRANVARO[k][1]) + FRANVARO[k][0] + '</span></label>'; }).join('') + '</div>' +
        '<label class="falt"><span>Vem</span><select name="vem">' + team.map(function (u) { return '<option value="' + u.id + '"' + (u.id === uid ? ' selected' : '') + '>' + e(u.namn) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lp-kalform__rad"><label class="falt"><span>Från</span><input name="fran" type="date" required value="' + (f ? dagISO(new Date(f.fran)) : dag) + '"></label><label class="falt"><span>Till och med</span><input name="till" type="date" required value="' + (f ? dagISO(new Date(f.till)) : dag) + '"></label></div></form>',
      fot: (f ? '<button class="knapp" type="button" data-g="lp-franvaro-bort" data-fid="' + f.id + '">' + i('stang') + 'Ta bort</button>' : '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button>') + '<button class="knapp knapp--virke" type="submit" form="lp-fv-form">' + i('bock') + 'Spara</button>' });
  };
  IH.G['lp-franvaro-bort'] = function (el) {
    var l = franvaroLista(), n = l.findIndex(function (x) { return x.id === el.getAttribute('data-fid'); }); if (n < 0) return;
    l.splice(n, 1); IH.spara(); IH.stangArk(); IH.rita(); IH.toast('Frånvaron är borttagen', '', 'kalender');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-lp-franvaro]')) return;
    ev.preventDefault();
    var fran = new Date(t.fran.value + 'T00:00:00'), till = new Date(t.till.value + 'T00:00:00'); if (till < fran) { var x = fran; fran = till; till = x; }
    var id = t.getAttribute('data-lp-franvaro'), l = franvaroLista(), f = id && l.find(function (y) { return y.id === id; });
    if (!f) { f = { id: 'fv' + Date.now().toString(36) }; l.push(f); }
    f.u = t.vem.value; f.typ = t.typ.value; f.fran = fran.toISOString(); f.till = till.toISOString();
    IH.spara(); IH.stangArk(); IH.rita();
    var u = IH.anvandare(f.u); IH.toast('Frånvaro sparad', (u ? u.namn.split(' ')[0] : '') + ' · ' + FRANVARO[f.typ][0].toLowerCase() + ' ' + kortDatum(fran) + (till > fran ? '–' + kortDatum(till) : ''), 'kalender');
  });
  function kalHandelser(team) {
    var vem = function (id) { return chefUi.kalVem === 'alla' ? team.some(function (x) { return x.u.id === id; }) : id === chefUi.kalVem; };
    var typ = function (t) { return chefUi.kalTyp === 'alla' || chefUi.kalTyp === t; };
    var idag = dag0(new Date()).getTime(), ut = [];
    if (typ('akt')) db().aktiviteter.forEach(function (h) { if (vem(h.av)) ut.push({ id: h.id, slag: 'akt', dag: dag0(h.tid).getTime(), tid: h.tid, u: h.av, text: h.text, typ: h.typ, kund: h.kund, affar: h.affar }); });
    if (typ('uppg')) db().uppgifter.forEach(function (x) { if (!x.klar && vem(x.ansvarig)) { var d = dag0(x.forfaller).getTime(); ut.push({ id: x.id, slag: 'uppg', dag: d, tid: x.forfaller, u: x.ansvarig, text: x.text, kund: x.kund, affar: x.affar, sen: d < idag }); } });
    if (typ('vunnen')) db().affarer.forEach(function (a) { if (a.steg === 'vunnen' && a.vunnen && vem(a.ansvarig)) ut.push({ id: a.id, slag: 'vunnen', dag: dag0(a.vunnen).getTime(), tid: a.vunnen, u: a.ansvarig, text: 'Vunnen: ' + a.titel, kund: a.kund, affar: a.id }); });
    return ut.sort(function (a, b) { return new Date(a.tid) - new Date(b.tid); });
  }
  var klock = function (iso) { var d = new Date(iso); return d.getHours() || d.getMinutes() ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''; };
  function kalender(team) {
    var nu = new Date(), forsta = new Date(nu.getFullYear(), nu.getMonth() + chefUi.kalMan, 1), man = forsta.getMonth();
    var start = new Date(forsta); start.setDate(1 - ((forsta.getDay() + 6) % 7));
    var alla = kalHandelser(team), idag = dag0(nu).getTime(), celler = '';
    // veckans läge och försenat, räknat ur samma urval
    var vecka = alla.filter(function (x) { return x.dag >= idag && x.dag < idag + 7 * 864e5; });
    var sena = alla.filter(function (x) { return x.sen; });
    var mest = 1; for (var q = 0; q < 42; q++) { var dq = new Date(start); dq.setDate(start.getDate() + q); var c = alla.filter(function (x) { return x.dag === dq.getTime(); }).length; if (c > mest) mest = c; }
    for (var n = 0; n < 42; n++) {
      var d = new Date(start); d.setDate(start.getDate() + n);
      var h = alla.filter(function (x) { return x.dag === d.getTime(); }), ds = IH.dagStr ? IH.dagStr(d) : d.toISOString().slice(0, 10);
      var iVeckan = d.getTime() >= idag - ((nu.getDay() + 6) % 7) * 864e5 && d.getTime() < idag + (7 - (nu.getDay() + 6) % 7) * 864e5;
      celler += '<div class="lp-kal__dag' + (d.getMonth() !== man ? ' utanfor' : '') + (d.getTime() === idag ? ' idag' : '') + (iVeckan ? ' vecka' : '') + (d.getTime() < idag ? ' forbi' : '') + (d.getDay() % 6 === 0 ? ' helg' : '') + (h.some(function (x) { return x.sen; }) ? ' sen' : '') + '" style="--last:' + (h.length / mest).toFixed(2) + '" data-g="lp-kal-dag" data-dag="' + ds + '" role="button" tabindex="0" aria-label="' + e(d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + plural(h.length, 'händelse', 'händelser') + '">' +
        '<span class="lp-kal__topp"><b>' + d.getDate() + '</b>' + (h.length ? '<em>' + h.length + '</em>' : '') + '<i class="lp-kal__plus" data-g="lp-kal-ny" data-dag="' + ds + '" role="button" aria-label="Lägg till ' + e(d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })) + '">+</i></span>' +
        h.slice(0, 3).map(function (x) { var u = IH.anvandare(x.u) || { farg: '#ccc', namn: '' }; return '<span class="lp-kal__h" data-typ="' + x.slag + '"' + (x.sen ? ' data-sen' : '') + (x.slag === 'uppg' ? ' draggable="true" data-uppg="' + x.id + '"' : '') + ' style="--av:' + u.farg + '" title="' + e(u.namn + ': ' + x.text) + (x.slag === 'uppg' ? ' – dra till en annan dag för att flytta' : '') + '"><i>' + e(IH.initialer(u.namn).charAt(0)) + '</i>' + (klock(x.tid) && x.slag === 'akt' ? '<time>' + klock(x.tid) + '</time>' : '') + e(x.text) + '</span>'; }).join('') +
        (h.length > 3 ? '<small>+' + (h.length - 3) + ' till</small>' : '') + '</div>';
    }
    var namn = forsta.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    var ledig = null;
    for (var k = 1; k <= 14 && !ledig; k++) { var lk = new Date(idag + k * 864e5 + 3e6); lk = dag0(lk); if (lk.getDay() % 6 === 0) continue; if (!alla.some(function (x) { return x.slag === 'akt' && x.dag === lk.getTime(); })) ledig = lk; }
    var vyKnapp = function (v, txt, ik) { return '<button type="button" data-g="lp-kal-vy" data-f="' + v + '" aria-pressed="' + (chefUi.kalVy === v) + '">' + i(ik) + txt + '</button>'; };
    var chip = function (t, txt) { return '<button type="button" class="ap-filter" data-g="lp-kal-typ" data-f="' + t + '" aria-pressed="' + (chefUi.kalTyp === t) + '">' + (t !== 'alla' ? '<i class="lp-kal__prick" data-typ="' + t + '"></i>' : '') + txt + '</button>'; };
    return '<div class="lp-kal__verktyg">' +
        '<div class="ap-filterrad" role="group" aria-label="Person">' + [{ id: 'alla', namn: 'Alla' }].concat(team.map(function (x) { return { id: x.u.id, namn: x.u.namn.split(' ')[0], u: x.u }; })).map(function (p) {
          return '<button type="button" class="ap-filter lp-kal__person" data-g="lp-kal-vem" data-f="' + p.id + '" aria-pressed="' + (chefUi.kalVem === p.id) + '">' + (p.u ? '<span class="avatar" style="background:' + p.u.farg + '">' + e(IH.initialer(p.u.namn)) + '</span>' : '') + e(p.namn) + '</button>'; }).join('') + '</div>' +
        '<div class="lp-kal__man"><button type="button" class="ch-ruta" data-g="lp-kal-man" data-d="-1" aria-label="Föregående månad">' + i('pilv') + '</button><b>' + e(namn.charAt(0).toUpperCase() + namn.slice(1)) + '</b>' +
        '<button type="button" class="ch-ruta" data-g="lp-kal-man" data-d="1" aria-label="Nästa månad">' + i('pil') + '</button>' + (chefUi.kalMan ? '<button type="button" class="ap-filter" data-g="lp-kal-man" data-d="0">I dag</button>' : '') +
        '<span class="lp-kal__vy" role="group" aria-label="Vy">' + vyKnapp('man', 'Månad', 'kalender') + vyKnapp('lista', 'Lista', 'lista') + '</span>' +
        '<button type="button" class="knapp knapp--virke lp-kal__ny" data-g="lp-kal-ny">' + i('plus') + 'Lägg till</button></div></div>' +
      '<div class="lp-kal__lage">' +
        '<span><b>' + vecka.filter(function (x) { return x.slag === 'akt'; }).length + '</b> möten och samtal kommande 7 dagar</span>' +
        '<span><b>' + vecka.filter(function (x) { return x.slag === 'uppg'; }).length + '</b> uppgifter förfaller</span>' +
        (sena.length ? '<button type="button" class="lp-kal__sena" data-g="lp-kal-sena">' + i('varning') + plural(sena.length, 'försenad uppgift', 'försenade uppgifter') + '</button>' : '<span class="lp-kal__ok">' + i('bock') + 'Inget försenat</span>') +
        (ledig ? '<button type="button" class="lp-kal__ledig" data-g="lp-kal-ny" data-dag="' + (IH.dagStr ? IH.dagStr(ledig) : ledig.toISOString().slice(0, 10)) + '" title="Första vardagen utan möten' + (chefUi.kalVem !== 'alla' ? ' för ' + e((IH.anvandare(chefUi.kalVem) || {}).namn || '') : ' i teamet') + ' – boka något där">' + i('stjarna') + 'Ledig dag: ' + e(ledig.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })) + '</button>' : '') +
        '<span class="lp-kal__typer">' + chip('alla', 'Allt') + chip('akt', 'Möten') + chip('uppg', 'Uppgifter') + chip('vunnen', 'Vunna') + '</span>' +
        '<button type="button" class="ap-filter" data-g="lp-kal-ics" title="Ladda ner månadens händelser som kalenderfil">' + i('kalender') + 'Exportera</button>' +
      '</div>' +
      (chefUi.kalVy === 'lista' ? kalLista(alla, chefUi.kalMan ? forsta.getTime() : idag, chefUi.kalMan ? new Date(forsta.getFullYear(), forsta.getMonth() + 1, 1).getTime() : idag + 30 * 864e5) :
      '<div class="lp-kal" data-lp-kal-ytan><span>Må</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lö</span><span>Sö</span>' + celler + '</div>') +
      '<p class="lp-teckenforklaring lp-kal__forkl"><span data-typ="akt"><i></i>Möten, samtal och mejl</span><span data-typ="uppg"><i></i>Uppgift förfaller</span><span data-typ="sen"><i></i>Försenad</span><span data-typ="vunnen"><i></i>Vunnen affär</span><span class="lp-kal__tips">Klicka på en dag för att läsa allt, eller på + för att lägga till.</span></p>';
  }
  function kalLista(alla, fran, till) {
    var dagar = {}; alla.forEach(function (x) { if (x.dag >= fran && x.dag < till || x.sen && fran <= dag0(new Date()).getTime()) (dagar[x.dag] = dagar[x.dag] || []).push(x); });
    var nycklar = Object.keys(dagar).map(Number).sort(function (a, b) { return a - b; }), idag = dag0(new Date()).getTime();
    if (!nycklar.length) return '<p class="lp-tom">Inget inplanerat i den här perioden.</p>';
    return '<div class="lp-agenda">' + nycklar.map(function (t) {
      var d = new Date(t), rel = t === idag ? 'I dag' : t === idag + 864e5 ? 'I morgon' : t < idag ? 'Försenat' : '';
      return '<section class="lp-agenda__dag' + (t === idag ? ' idag' : '') + (t < idag ? ' sen' : '') + '"><header><b>' + d.getDate() + '</b><span>' + e(d.toLocaleDateString('sv-SE', { weekday: 'long' })) + '<small>' + e(d.toLocaleDateString('sv-SE', { month: 'long' })) + (rel ? ' · ' + rel : '') + '</small></span>' +
        '<button type="button" class="ch-ruta" data-g="lp-kal-ny" data-dag="' + (IH.dagStr ? IH.dagStr(d) : d.toISOString().slice(0, 10)) + '" aria-label="Lägg till den här dagen">' + i('plus') + '</button></header><ul class="lp-daglista">' + dagar[t].map(kalRad).join('') + '</ul></section>';
    }).join('') + '</div>';
  }
  // en rad i dagens lista: vem, när, vad, och vad man kan göra med den
  function kalRad(x) {
    var u = IH.anvandare(x.u) || { farg: '#ccc', namn: '' }, k = x.kund && IH.kund(x.kund);
    var etikett = x.slag === 'akt' ? (AKT_NAMN[x.typ] || 'Händelse') : x.slag === 'uppg' ? (x.sen ? 'Försenad uppgift' : 'Uppgift') : 'Vunnen affär';
    return '<li class="lp-dagrad" data-typ="' + x.slag + '"' + (x.sen ? ' data-sen' : '') + ' style="--av:' + u.farg + '">' +
      '<span class="avatar" style="background:' + u.farg + '">' + e(IH.initialer(u.namn)) + '</span>' +
      '<span class="lp-dagrad__text"><small>' + e(etikett) + (klock(x.tid) ? ' · ' + klock(x.tid) : '') + ' · ' + e(u.namn) + '</small><b>' + e(x.text) + '</b>' + (k ? '<button type="button" class="lp-lank" data-g="kund-oppna" data-id="' + k.id + '">' + e(k.namn) + '</button>' : '') + '</span>' +
      '<span class="lp-dagrad__knappar">' + (x.slag === 'uppg' ? '<button type="button" class="ap-filter" data-g="lp-kal-klar" data-id="' + x.id + '">' + i('bock') + 'Klar</button><button type="button" class="ch-ruta" data-g="lp-kal-flytta" data-id="' + x.id + '" title="Flytta en dag framåt" aria-label="Flytta en dag framåt">' + i('pil') + '</button>' : '') + '</span></li>';
  }
  function kalForm(ds, team) {
    var jag = IH.jag();
    return '<form id="lp-kal-form" data-lp-kal class="km-form lp-kalform">' +
      '<div class="lp-kalform__typ" role="radiogroup" aria-label="Typ">' + [['mote', 'Möte', 'motesikon'], ['samtal', 'Samtal', 'samtal'], ['uppgift', 'Uppgift', 'uppgift']].map(function (t, n) {
        return '<label><input type="radio" name="typ" value="' + t[0] + '"' + (n === 0 ? ' checked' : '') + '><span>' + i(t[2]) + t[1] + '</span></label>'; }).join('') + '</div>' +
      '<label class="falt"><span>Vad</span><input name="text" required maxlength="120" placeholder="T.ex. Platsbesök hos kunden"></label>' +
      '<div class="lp-kalform__rad"><label class="falt"><span>Dag</span><input name="datum" type="date" required value="' + ds + '"></label><label class="falt"><span>Tid</span><input name="tid" type="time" value="10:00"></label></div>' +
      '<div class="lp-kalform__rad"><label class="falt"><span>Vem</span><select name="vem">' + team.map(function (x) { return '<option value="' + x.u.id + '"' + (x.u.id === (chefUi.kalVem !== 'alla' ? chefUi.kalVem : jag.id) ? ' selected' : '') + '>' + e(x.u.namn) + '</option>'; }).join('') + '</select></label>' +
      '<label class="falt"><span>Kund (valfritt)</span><select name="kund"><option value="">Ingen</option>' + db().kunder.map(function (k) { return '<option value="' + k.id + '">' + e(k.namn) + '</option>'; }).join('') + '</select></label></div></form>';
  }
  var kalTeam = function () { return IH.ANVANDARE.filter(function (u) { return u.roll === 'salj' && !u.inaktiv; }).map(function (u) { return { u: u }; }); };
  function kalDag(ds) {
    var team = kalTeam(), d = new Date(ds + 'T12:00:00'), dt = dag0(d).getTime();
    var h = kalHandelser(team).filter(function (x) { return x.dag === dt; });
    IH.oppnaArk({ titel: d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, function (c) { return c.toUpperCase(); }), ikon: 'kalender',
      under: h.length ? plural(h.length, 'händelse', 'händelser') + (chefUi.kalVem !== 'alla' ? ' för ' + e((IH.anvandare(chefUi.kalVem) || {}).namn || '') : ' för teamet') : 'Inget inplanerat än.',
      kropp: (h.length ? '<ul class="lp-daglista">' + h.map(kalRad).join('') + '</ul>' : '<p class="lp-tom">Dagen är tom – lägg till något nedan.</p>') + '<h3 class="lp-kalform__rubrik">Lägg till den här dagen</h3>' + kalForm(ds, team),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('plus') + 'Lägg till</button>' });
  }
  IH.G['lp-kal-dag'] = function (el) { kalDag(el.getAttribute('data-dag')); };
  IH.G['lp-kal-ny'] = function (el) {
    var ds = el.getAttribute('data-dag') || (IH.dagStr ? IH.dagStr(new Date()) : new Date().toISOString().slice(0, 10));
    IH.oppnaArk({ titel: 'Lägg till i kalendern', ikon: 'kalender', under: 'Möten och samtal loggas på personen, uppgifter hamnar under Att göra.', kropp: kalForm(ds, kalTeam()),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('plus') + 'Lägg till</button>' });
  };
  IH.G['lp-kal-typ'] = function (el) { chefUi.kalTyp = el.getAttribute('data-f'); IH.rita(); };
  IH.G['lp-kal-vy'] = function (el) { chefUi.kalVy = el.getAttribute('data-f'); IH.rita(); };
  // dra en uppgift till en annan dag för att flytta den
  document.addEventListener('dragstart', function (ev) { var c = ev.target.closest && ev.target.closest('[data-uppg]'); if (!c) return; ev.dataTransfer.setData('text/plain', c.getAttribute('data-uppg')); ev.dataTransfer.effectAllowed = 'move'; c.classList.add('drar'); document.documentElement.classList.add('lp-drar'); });
  document.addEventListener('dragend', function () { document.documentElement.classList.remove('lp-drar'); document.querySelectorAll('.lp-kal .drar, .lp-kal .drop').forEach(function (x) { x.classList.remove('drar', 'drop'); }); });
  document.addEventListener('dragover', function (ev) { var d = ev.target.closest && ev.target.closest('[data-lp-kal-ytan] .lp-kal__dag'); if (!d) return; ev.preventDefault(); document.querySelectorAll('.lp-kal .drop').forEach(function (x) { if (x !== d) x.classList.remove('drop'); }); d.classList.add('drop'); });
  document.addEventListener('drop', function (ev) {
    var d = ev.target.closest && ev.target.closest('[data-lp-kal-ytan] .lp-kal__dag'); if (!d) return; ev.preventDefault();
    var u = db().uppgifter.find(function (x) { return x.id === ev.dataTransfer.getData('text/plain'); }); if (!u) return;
    var gammal = new Date(u.forfaller), ny = new Date(d.getAttribute('data-dag') + 'T09:00:00'); ny.setHours(gammal.getHours() || 9, gammal.getMinutes());
    u.forfaller = ny.toISOString(); IH.spara(); IH.uppdateraMeny(); IH.rita();
    IH.toast('Flyttad', u.text + ' – ' + ny.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' }) + '.', 'kalender');
  });
  IH.G['lp-kal-sena'] = function () {
    var sena = kalHandelser(kalTeam()).filter(function (x) { return x.sen; });
    IH.oppnaArk({ titel: 'Försenade uppgifter', ikon: 'varning', under: plural(sena.length, 'uppgift', 'uppgifter') + ' har passerat sitt datum.',
      kropp: '<ul class="lp-daglista">' + sena.map(function (x) { var r = kalRad(x); return r.replace('<small>', '<small>' + e(new Date(x.tid).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })) + ' · '); }).join('') + '</ul>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><button class="knapp knapp--virke" type="button" data-g="lp-kal-allaidag">' + i('kalender') + 'Flytta alla till i dag</button>' });
  };
  var omRita = function (ark) { IH.spara(); IH.uppdateraMeny(); IH.rita(); if (ark) ark(); };
  IH.G['lp-kal-klar'] = function (el) {
    var u = db().uppgifter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!u) return;
    u.klar = true; u.klarTid = new Date().toISOString();
    var rad = el.closest('.lp-dagrad'); if (rad) { rad.classList.add('klar'); setTimeout(function () { rad.remove(); }, 380); }
    omRita(); IH.toast('Klar', u.text, 'bock');
  };
  IH.G['lp-kal-flytta'] = function (el) {
    var u = db().uppgifter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!u) return;
    var d = new Date(u.forfaller), idag = dag0(new Date()); if (d < idag) d = new Date(idag.getTime() + 9 * 36e5); d.setDate(d.getDate() + 1); u.forfaller = d.toISOString();
    var rad = el.closest('.lp-dagrad'); if (rad) { rad.classList.add('klar'); setTimeout(function () { rad.remove(); }, 380); }
    omRita(); IH.toast('Flyttad', u.text + ' – nu ' + d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' }) + '.', 'kalender');
  };
  IH.G['lp-kal-allaidag'] = function () {
    var idag = dag0(new Date()), n = 0;
    kalHandelser(kalTeam()).filter(function (x) { return x.sen; }).forEach(function (x) { var u = db().uppgifter.find(function (y) { return y.id === x.id; }); if (u) { u.forfaller = new Date(idag.getTime() + 9 * 36e5).toISOString(); n++; } });
    IH.stangArk(); omRita(); IH.toast('Flyttade till i dag', plural(n, 'uppgift', 'uppgifter') + ' ligger nu på dagens lista.', 'kalender');
  };
  // kalenderfil (.ics) med månadens händelser i det valda urvalet – går att öppna i Outlook, Google och Apple
  IH.G['lp-kal-ics'] = function () {
    var nu = new Date(), forsta = new Date(nu.getFullYear(), nu.getMonth() + chefUi.kalMan, 1), sista = new Date(forsta.getFullYear(), forsta.getMonth() + 1, 1);
    var h = kalHandelser(kalTeam()).filter(function (x) { return x.dag >= forsta.getTime() && x.dag < sista.getTime(); });
    var p2 = function (v) { return String(v).padStart(2, '0'); }, f = function (d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + '00Z'; };
    var esc = function (t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, ' '); };
    var rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Legohus//CRM//SV'];
    h.forEach(function (x) { var s = new Date(x.tid), u = IH.anvandare(x.u); rader.push('BEGIN:VEVENT', 'UID:' + x.id + '@legohus-crm', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(s), 'DTEND:' + f(new Date(s.getTime() + 36e5)), 'SUMMARY:' + esc(x.text), 'DESCRIPTION:' + esc((u ? u.namn : '') + ' · ' + (KAL_TYP[x.slag] || '')), 'END:VEVENT'); });
    rader.push('END:VCALENDAR');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rader.join('\r\n')], { type: 'text/calendar' }));
    a.download = 'teamets-kalender-' + forsta.toISOString().slice(0, 7) + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Kalenderfilen är klar', plural(h.length, 'händelse', 'händelser') + ' – öppna filen i din kalender.', 'kalender');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-lp-kal]')) return;
    ev.preventDefault();
    var text = t.text.value.trim(), u = IH.anvandare(t.vem.value); if (!text || !u) return;
    var nar = new Date(t.datum.value + 'T' + (t.tid.value || '09:00') + ':00'), typ = t.typ.value, kund = t.kund.value || null;
    if (typ === 'uppgift') db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text, forfaller: nar.toISOString(), klar: false, kund: kund, affar: null, ansvarig: u.id, av: IH.jag().id });
    else db().aktiviteter.push({ id: IH.nyttId('aktivitet', 'h'), tid: nar.toISOString(), typ: typ, text: text, kund: kund, affar: null, av: u.id });
    // hoppa till månaden där det hamnade så att man ser det
    var nu = new Date(); chefUi.kalMan = (nar.getFullYear() - nu.getFullYear()) * 12 + nar.getMonth() - nu.getMonth();
    IH.stangArk(); omRita();
    IH.toast(typ === 'uppgift' ? 'Uppgiften är lagd' : 'Inlagt i kalendern', text + ' · ' + nar.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }), 'kalender');
  });

  // Himlen i hjälten efter tiden på dygnet: månskära med kratrar och tindrande stjärnor på kvällen och natten,
  // en sol som går upp på morgonen och en sol med strålar på dagen
  function himlen(h) {
    var natt = h >= 18 || h < 5, morgon = h >= 5 && h < 10;
    var stjarnor = [[8, 18, 1.1, 0], [86, 10, .8, .7], [94, 62, 1, 1.4], [16, 78, .7, 2.1], [70, 88, .9, .4], [40, 4, .6, 1.8], [100, 30, .7, 2.6]];
    if (natt) return '<span class="lp-himmel lp-himmel--natt" aria-hidden="true">' + stjarnor.map(function (st) { return '<i class="lp-stjarna" style="left:' + st[0] + '%;top:' + st[1] + '%;--s:' + st[2] + ';--d:' + st[3] + 's"></i>'; }).join('') +
      '<i class="lp-fall"></i><span class="lp-mane"><i class="lp-mane__ljus"></i><i class="lp-krater" style="left:24%;top:38%;--k:14%"></i><i class="lp-krater" style="left:16%;top:62%;--k:9%"></i><i class="lp-krater" style="left:34%;top:72%;--k:7%"></i><i class="lp-krater" style="left:30%;top:20%;--k:6%"></i></span></span>';
    return '<span class="lp-himmel lp-himmel--' + (morgon ? 'morgon' : 'dag') + '" aria-hidden="true"><span class="lp-sol">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<i style="--r:' + n * 45 + 'deg"></i>'; }).join('') + '</span></span>';
  }
  IH.himlen = himlen;
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
    var h = new Date().getHours(), hals = IH.hej();
    var tal = function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + (x.ton || 'is') + '"><span class="ao-tal__ikon">' + IH.emo(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(x.varde) + '</strong><em>' + e(x.under) + '</em>' + (x.andel != null ? '<span class="lp-glasmatare" style="--andel:' + x.andel.toFixed(3) + '"><i></i></span>' : '') + '</span></' + (x.href ? 'a' : 'div') + '>'; };
    // kvartalsringen: vunnet mot teamets kvartalsmål, eller vinstgraden om inget mål är satt
    var ringAndel = tot.mal ? Math.min(1, tot.vunnet / tot.mal) : vg || 0;
    var veckorV = []; for (var w = 11; w >= 0; w--) { var vs = Date.now() - (w + 1) * 7 * 864e5, ve = Date.now() - w * 7 * 864e5; veckorV.push(team.reduce(function (t, x) { return t + x.aff.filter(function (a) { return a.steg === 'vunnen' && a.vunnen && new Date(a.vunnen) >= vs && new Date(a.vunnen) < ve; }).reduce(function (s2, a) { return s2 + (a.varde || 0); }, 0); }, 0)); }
    var maxV = Math.max.apply(null, veckorV.concat([1]));
    var ring = '<div class="lp-ring" style="--a:' + ringAndel.toFixed(3) + '"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="lp-ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9a0"/><stop offset="1" stop-color="#e29a4a"/></linearGradient></defs>' +
      '<circle cx="60" cy="60" r="50" class="lp-ring__spar"/><circle cx="60" cy="60" r="50" class="lp-ring__glod"/><circle cx="60" cy="60" r="50" class="lp-ring__bage"/></svg>' +
      '<div class="lp-ring__mitt"><b>' + Math.round(ringAndel * 100) + ' %</b><small>' + (tot.mal ? 'av kvartalsmålet' : 'vinstgrad 90 d') + '</small>' + (tot.mal ? '<em>' + IH.kort(tot.vunnet) + ' / ' + IH.kort(tot.mal) + '</em>' : '<em>Sätt mål för att följa kvartalet</em>') + '</div></div>';
    var lag = '<div class="lp-lag">' + team.map(function (x) { var n = narvaro(x.u.id); return '<a href="#/profil/' + x.u.id + '" title="' + e(x.u.namn) + ': ' + e(n.namn) + ' · ' + IH.kort(x.oppet) + ' öppet">' + avatar(x.u) + '</a>'; }).join('') + '<span>' + plural(aktivaNu, 'i tjänst', 'i tjänst') + '</span></div>';
    var veckoStaplar = '<div class="lp-veckor"><small>Vunnet per vecka · 12 veckor · ' + IH.kort(veckorV.reduce(function (t, v) { return t + v; }, 0)) + '</small><span class="lp-veckor__staplar">' + veckorV.map(function (v, n) {
      var vnr = veckonr(new Date(Date.now() - (11 - n) * 7 * 864e5));
      return '<span title="Vecka ' + vnr + (n === 11 ? ' (den här veckan)' : '') + ': ' + (v ? IH.kr(v) : 'inget vunnet') + '"><em>' + (v ? IH.kort(v) : '') + '</em><i style="--h:' + (v / maxV).toFixed(3) + ';--n:' + n + '" class="' + (v ? 'pa' : '') + (n === 11 ? ' nu' : '') + '"></i><small>v' + vnr + '</small></span>'; }).join('') + '</span></div>';
    var hjalte = '<section class="ap-hjalte ao-hjalte kort lp-chefhjalte lp-mork"><div class="sh-rutnat" aria-hidden="true"></div><i class="lp-mork__glod" aria-hidden="true"></i><i class="lp-mork__glod lp-mork__glod--2" aria-hidden="true"></i>' + himlen(h) +
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
      ].map(tal).join('') + '</div>' + '<div class="lp-mork__mitt">' + ring + lag + '</div>' + veckoStaplar + '</section>';

    // 01 Teamet just nu
    var vald = team.filter(function (x) { var s = narvaro(x.u.id).id; return chefUi.filter === 'alla' || (chefUi.filter === 'tillganglig' ? s === 'online' : chefUi.filter === 'upptagen' ? UPPTAGEN.indexOf(s) >= 0 : BORTA.indexOf(s) >= 0); });
    var kort = vald.map(function (x) {
      var n = narvaro(x.u.id), varn = [];
      if (x.stilla.length) varn.push(plural(x.stilla.length, 'affär står still', 'affärer står still'));
      if (x.sena.length) varn.push(plural(x.sena.length, 'försenad uppgift', 'försenade uppgifter'));
      var perSteg = IH.SALJSTEG.slice(0, -1).map(function (s) { return { s: s, l: x.oppna.filter(function (a) { return a.steg === s.id; }) }; });
      var maxS = Math.max.apply(null, perSteg.map(function (p) { return p.l.length; }).concat([1]));
      var senast = x.akt.slice().sort(function (a, b) { return new Date(b.tid) - new Date(a.tid); })[0];
      var stegIx = function (a) { return IH.SALJSTEG.findIndex(function (s2) { return s2.id === a.steg; }); };
      var nasta = x.oppna.slice().sort(function (a, b) { return stegIx(b) - stegIx(a) || (b.varde || 0) - (a.varde || 0); })[0];
      return '<article class="lp-saljare">' +
        '<header>' + avatar(x.u) + '<div><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small style="--n:' + n.farg + '"><i></i>' + e(n.namn) + (x.u.chef ? ' · Chef' : '') + (senast ? ' · aktiv ' + e(IH.sedan(senast.tid)) : '') + '</small></div>' +
          '<span class="lp-saljare__last" title="Öppna affärer just nu">' + plural(x.oppna.length, 'affär', 'affärer') + '</span></header>' +
        '<div class="lp-saljare__tal"><div><small>Öppet</small><b class="tal">' + IH.kort(x.oppet) + '</b></div><div><small>Viktat</small><b class="tal">' + IH.kort(x.viktat) + '</b></div><div><small>Vunnet 90 d</small><b class="tal">' + IH.kort(x.vunnet90) + '</b></div></div>' +
        (x.malKvartal ? '<p class="lp-saljare__mal">' + pct(Math.min(1, x.vunnet90 / x.malKvartal)) + ' av kvartalsmålet ' + IH.kort(x.malKvartal) + '<span class="lp-mal__spar"><i style="--a:' + Math.min(1, x.vunnet90 / x.malKvartal).toFixed(3) + '"></i></span></p>' : '<p class="lp-saljare__mal lp-saljare__mal--tom">Inget mål satt · <button type="button" class="lp-lank" data-g="lp-mal" data-id="' + x.u.id + '">Sätt mål</button></p>') +
        '<ul class="lp-perSteg">' + perSteg.map(function (p) {
          return '<li style="--f:' + p.s.farg + ';--a:' + (p.l.length / maxS).toFixed(3) + '" title="' + e(p.s.namn) + ': ' + plural(p.l.length, 'affär', 'affärer') + (p.l.length ? ' · ' + IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) + ' · ' + e(p.l.map(function (a) { return a.titel; }).slice(0, 3).join(', ')) : '') + '"><span>' + e(p.s.kort) + '</span><i></i><b>' + p.l.length + '</b><small>' + (p.l.length ? IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) : '–') + '</small></li>';
        }).join('') + '</ul>' +
        (nasta ? '<a class="lp-nasta" href="#/salj/' + nasta.id + '"><small>Närmast att stänga</small><b>' + e(nasta.titel) + '</b><span>' + e(IH.steg(nasta.steg).namn) + ' · ' + IH.kort(nasta.varde || 0) + '</span>' + i('pil') + '</a>' : '') +
        '<div class="lp-vecka"><small>Aktivitet 7 dagar<em>' + plural(perDag(x.akt, 7).reduce(function (t, y) { return t + y.antal; }, 0), 'händelse', 'händelser') + '</em></small>' + staplar(perDag(x.akt, 7), 'lp-staplar lp-staplar--liten') +
          '<span class="lp-vecka__dagar" aria-hidden="true">' + perDag(x.akt, 7).map(function (y) { return '<span class="' + (y.dag.getTime() === dag0(new Date()).getTime() ? 'idag' : '') + '">' + VECKODAG[y.dag.getDay()] + '</span>'; }).join('') + '</span></div>' +
        (varn.length ? '<p class="lp-varning">' + IH.emo('varning') + e(varn.join(' · ')) + '</p>' : '<p class="lp-lugnt">' + IH.emo('klar') + 'Inget som väntar</p>') +
        '<footer><a class="knapp knapp--liten" href="#/profil/' + x.u.id + '">' + i('kunder') + 'Profil</a>' +
          '<button class="knapp knapp--liten" type="button" data-g="lp-uppgift" data-id="' + x.u.id + '">' + IH.emo('todo') + 'Uppgift</button>' +
          (x.u.id !== jag.id ? '<button class="knapp knapp--liten" type="button" data-g="ch-skriv-till" data-uid="' + x.u.id + '">' + i('meddelande') + 'Skriv</button>' : '') + '</footer></article>';
    }).join('') || '<p class="lp-tom">Ingen i teamet har den statusen just nu.</p>';
    var filter = [['alla', 'Alla'], ['tillganglig', 'Tillgängliga'], ['upptagen', 'Upptagna'], ['borta', 'Borta']].map(function (f) { return '<button type="button" class="ap-filter" data-g="lp-chef-filter" data-f="' + f[0] + '" aria-pressed="' + (chefUi.filter === f[0]) + '">' + f[1] + '</button>'; }).join('');

    // 02 Vem jobbar när: två veckor bakåt, den här och nästa. Arbetsdag = mån–fre; jobbat = något loggat i CRM:et
    // den dagen (i dag räknas den som är i tjänst); frånvaro läggs in här och visas med sin ikon.
    var narv = narvaroVy(team);

    // 04 Att agera på – med Fördela och Påminn direkt i raden
    var lista = [];
    team.forEach(function (x) {
      x.stilla.forEach(function (a) { lista.push({ typ: 'Står still', ikon: 'klocka', text: a.titel, under: x.u.namn + ' · ' + IH.dagarSedan(a.andrad) + ' dagar i ' + IH.steg(a.steg).namn.toLowerCase(), href: '#/salj/' + a.id, vikt: IH.dagarSedan(a.andrad), affar: a.id, uid: x.u.id }); });
      x.sena.forEach(function (u) { lista.push({ typ: 'Försenad uppgift', ikon: 'larm', text: u.text, under: x.u.namn + ' · skulle vara klar ' + IH.datum(u.forfaller), href: '#/att-gora', vikt: 20 + IH.dagarSedan(u.forfaller), uid: x.u.id }); });
    });
    utan.forEach(function (a) { lista.push({ typ: 'Ingen ansvarig', ikon: 'portfolj', text: a.titel, under: 'Affär utan ansvarig säljare', href: '#/salj/' + a.id, vikt: 40, affar: a.id }); });
    db().forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).forEach(function (f) {
      lista.push({ typ: 'Ingen ansvarig', ikon: 'inkorg', text: f.namn + (f.ort ? ' · ' + f.ort : ''), under: 'Ny förfrågan ' + IH.sedan(f.tid || f.skapad), href: '#/forfragningar/' + f.id, vikt: 30, forfragan: f.id, alder: IH.dagarSedan(f.tid || f.skapad) });
    });
    lista.sort(function (a, b) { return b.vikt - a.vikt; });
    var AGERA = [['alla', 'Allt', function () { return true; }], ['fordela', 'Fördela', function (r) { return r.typ === 'Ingen ansvarig'; }], ['stilla', 'Står still', function (r) { return r.typ === 'Står still'; }], ['sen', 'Försenat', function (r) { return r.typ === 'Försenad uppgift'; }]];
    var aktivF = (AGERA.find(function (f) { return f[0] === chefUi.agera; }) || AGERA[0])[2], visas = lista.filter(aktivF), oFordelade = lista.filter(AGERA[1][2]).length;
    var ageraFilter = '<div class="lp-agera__verktyg"><div class="ap-filterrad" role="group" aria-label="Visa">' + AGERA.map(function (f) { var n2 = lista.filter(f[2]).length; return (f[0] === 'alla' || n2 ? '<button type="button" class="ap-filter" data-g="lp-agera-f" data-f="' + f[0] + '" aria-pressed="' + (chefUi.agera === f[0]) + '">' + f[1] + ' <em>' + n2 + '</em></button>' : ''); }).join('') + '</div>' +
      (oFordelade > 1 ? '<button type="button" class="knapp knapp--liten knapp--virke" data-g="lp-fordela-smart" title="Fördelar jämnt till den som har minst öppet just nu">' + IH.emo('blixt') + 'Fördela smart</button>' : '') + '</div>';
    var uppm = lista.length ? ageraFilter + '<ul class="ao-upp lp-agera">' + visas.slice(0, 7).map(function (r) {
      var brattom = r.alder != null ? (r.alder >= 2 ? 'het' : r.alder >= 1 ? 'varm' : '') : r.vikt > 30 ? 'het' : r.vikt > 20 ? 'varm' : '';
      return '<li data-brattom="' + brattom + '"><span class="ao-upp__ikon">' + IH.emo(r.ikon) + '</span><a class="ao-upp__text" href="' + r.href + '"><small class="lp-agera__typ">' + e(r.typ) + (r.alder != null ? ' · ' + (r.alder ? plural(r.alder, 'dag', 'dagar') : 'i dag') : '') + '</small><strong>' + e(r.text) + '</strong><small>' + e(r.under) + '</small></a><span class="lp-agera__knappar">' +
        (r.affar || r.forfragan ? '<button type="button" class="knapp knapp--liten" data-g="lp-ta-sjalv"' + (r.affar ? ' data-affar="' + r.affar + '"' : ' data-forfragan="' + r.forfragan + '"') + ' title="Ta den själv">Ta själv</button><button type="button" class="knapp knapp--liten" data-g="lp-fordela"' + (r.affar ? ' data-affar="' + r.affar + '"' : ' data-forfragan="' + r.forfragan + '"') + '>Fördela</button>' : '') +
        (r.uid && r.uid !== jag.id ? '<button type="button" class="knapp knapp--liten" data-g="lp-pamin" data-uid="' + r.uid + '" data-text="' + e(r.typ + ': ' + r.text) + '">Påminn</button>' : '') + '</span></li>';
    }).join('') + '</ul>' + (visas.length > 7 ? '<p class="lp-mer">+' + (visas.length - 7) + ' till</p>' : '') : '<div class="ao-lugnt ao-lugnt--stor">' + IH.emo('skold') + '<div><strong>Inget att agera på</strong><small>Inga affärer står still, inga uppgifter är försenade och allt har en ansvarig.</small></div></div>';

    // 05 Pipeline per säljare
    var maxP = Math.max.apply(null, team.map(function (x) { return x.oppet; }).concat([1]));
    var pipe = '<ul class="lp-pipe">' + team.map(function (x) {
      return '<li><span class="lp-pipe__namn">' + avatar(x.u) + e(x.u.namn.split(' ')[0]) + '</span><span class="lp-pipe__stapel" style="--a:' + (x.oppet / maxP).toFixed(3) + '">' + IH.SALJSTEG.slice(0, -1).map(function (s) {
        var v = x.oppna.filter(function (a) { return a.steg === s.id; }).reduce(function (t, a) { return t + a.varde; }, 0);
        return v ? '<i style="--f:' + s.farg + ';flex:' + v + '" title="' + e(s.namn) + ': ' + IH.kr(v) + '"></i>' : '';
      }).join('') + '</span><b class="tal">' + IH.kort(x.oppet) + '</b><small>viktat ' + IH.kort(x.viktat) + (tot.pipeline ? ' · ' + pct(x.oppet / tot.pipeline) : '') + '</small></li>';
    }).join('') + '</ul><p class="lp-teckenforklaring">' + IH.SALJSTEG.slice(0, -1).map(function (s) { var n3 = team.reduce(function (t, x) { return t + x.oppna.filter(function (a) { return a.steg === s.id; }).length; }, 0); return '<a href="#/salj" style="--f:' + s.farg + '" title="' + plural(n3, 'affär', 'affärer') + ' i ' + e(s.namn.toLowerCase()) + '"><i></i>' + e(s.namn) + ' <b>' + n3 + '</b></a>'; }).join('') + '</p>' +
      (function () { var st = team.reduce(function (l, x) { return l.concat(x.oppna); }, []).sort(function (a, b) { return (b.varde || 0) - (a.varde || 0); })[0]; return st ? '<a class="lp-storst" href="#/salj/' + st.id + '">' + IH.emo('portfolj') + '<span><small>Största öppna affären</small><b>' + e(st.titel) + '</b></span><em>' + IH.kort(st.varde || 0) + ' · ' + e(IH.steg(st.steg).namn) + '</em></a>' : ''; })() +
      '<div class="ao-statrad"><div><small>Öppet</small><strong>' + IH.kort(tot.pipeline) + '</strong><em>' + plural(oppnaN, 'affär', 'affärer') + '</em></div><div><small>Viktat</small><strong>' + IH.kort(tot.viktat) + '</strong><em>prognos</em></div><div><small>Snitt per affär</small><strong>' + (oppnaN ? IH.kort(tot.pipeline / oppnaN) : '–') + '</strong><em>öppet värde</em></div></div>';
    // 06 Aktivitet 14 dagar
    var dagar14 = perDag([], 14), maxA = 1;
    var rader = team.map(function (x) { var dd = perDag(x.akt, 14); dd.forEach(function (y) { if (y.antal > maxA) maxA = y.antal; }); return { x: x, d: dd }; });
    var idagT = dag0(new Date()).getTime();
    var forra = function (akt) { var t2 = Date.now(); return akt.filter(function (h) { var a = (t2 - new Date(h.tid)) / 864e5; return a >= 14 && a < 28; }).length; };
    var karta = '<div class="lp-karta" style="--n:14"><span></span>' + dagar14.map(function (dd) { return '<small class="' + (dd.dag.getDay() % 6 === 0 ? 'helg' : '') + (dd.dag.getTime() === idagT ? ' idag' : '') + (dd.dag.getDay() === 1 ? ' mandag' : '') + '">' + VECKODAG[dd.dag.getDay()] + '<em>' + dd.dag.getDate() + '</em></small>'; }).join('') + '<span class="lp-karta__summa">Summa</span>' +
      rader.map(function (r) {
        var t = r.d.reduce(function (s, y) { return s + y.antal; }, 0), f2 = forra(r.x.akt), tr = f2 ? Math.round((t - f2) / f2 * 100) : null;
        return '<span class="lp-karta__namn">' + avatar(r.x.u) + e(r.x.u.namn.split(' ')[0]) + '</span>' + r.d.map(function (y) {
          return '<i style="--a:' + (y.antal / maxA).toFixed(3) + '" class="' + (y.antal ? 'pa' : '') + (y.dag.getTime() === idagT ? ' idag' : '') + (y.dag.getDay() === 1 ? ' mandag' : '') + '" title="' + e(r.x.u.namn) + ', ' + IH.datum(y.dag.toISOString()) + ': ' + plural(y.antal, 'händelse', 'händelser') + '">' + (y.antal || '') + '</i>';
        }).join('') + '<b>' + t + (tr != null ? '<small class="lp-trend" data-upp="' + (tr >= 0) + '" title="Mot de 14 dagarna innan (' + f2 + ')">' + (tr >= 0 ? '↑' : '↓') + Math.abs(tr) + ' %</small>' : f2 === 0 && t ? '<small class="lp-trend" data-upp="true">ny</small>' : '') + '</b>';
      }).join('') +
      '<span class="lp-karta__namn lp-karta__team">Teamet</span>' + dagar14.map(function (dd, k) { var n4 = rader.reduce(function (t, r) { return t + r.d[k].antal; }, 0); return '<i class="lp-karta__tot' + (n4 ? ' pa' : '') + '" style="--a:' + Math.min(1, n4 / (maxA * Math.max(1, rader.length) * 0.6)).toFixed(3) + '">' + (n4 || '') + '</i>'; }).join('') + '<b>' + rader.reduce(function (t, r) { return t + r.d.reduce(function (s2, y) { return s2 + y.antal; }, 0); }, 0) + '</b></div>';
    // 07 Topplistan 90 dagar
    var arStart = new Date(new Date().getFullYear(), 0, 1), period = chefUi.topp;
    var iPeriod = function (iso) { return iso && (period === 'ar' ? new Date(iso) >= arStart : IH.dagarSedan(iso) < period); };
    var toppRad = team.map(function (x) { var v = x.aff.filter(function (a) { return a.steg === 'vunnen' && iPeriod(a.vunnen); }), f = x.forlorade.filter(function (a) { return iPeriod(a.andrad); }).length; return { x: x, v: v, summa: v.reduce(function (t, a) { return t + (a.varde || 0); }, 0), g: v.length + f }; })
      .sort(function (a, b) { return b.summa - a.summa || b.x.viktat - a.x.viktat; });
    var ledare = Math.max(1, toppRad[0] ? toppRad[0].summa : 1);
    var toppVal = '<div class="lp-kal__vy" role="group" aria-label="Period">' + [[30, '30 d'], [90, '90 d'], ['ar', 'I år']].map(function (p2) { return '<button type="button" data-g="lp-topp-period" data-f="' + p2[0] + '" aria-pressed="' + (String(period) === String(p2[0])) + '">' + p2[1] + '</button>'; }).join('') + '</div>';
    var topplista = '<ol class="lp-topp">' + toppRad.map(function (r, n) {
      return '<li class="' + (n === 0 && r.summa ? 'forst' : '') + '" style="--a:' + (r.summa / ledare).toFixed(3) + '"><span class="lp-topp__plats">' + (n === 0 && r.summa ? IH.emo('medalj') : n + 1) + '</span>' + avatar(r.x.u) + '<span><a href="#/profil/' + r.x.u.id + '"><b>' + e(r.x.u.namn) + '</b></a><small>' + plural(r.v.length, 'order', 'ordrar') + (r.g ? ' · vinstgrad ' + pct(r.v.length / r.g) : '') + (n > 0 && toppRad[0].summa ? ' · ' + IH.kort(toppRad[0].summa - r.summa) + ' efter' : '') + '</small><span class="lp-topp__stapel"><i></i></span></span><b class="tal">' + IH.kort(r.summa) + '</b></li>';
    }).join('') + '</ol>' + '<p class="lp-topp__summa">Teamet: <b>' + IH.kort(toppRad.reduce(function (t, r) { return t + r.summa; }, 0)) + '</b> på ' + plural(toppRad.reduce(function (t, r) { return t + r.v.length; }, 0), 'order', 'ordrar') + '</p>';

    var html = hjalte +
      chefBand('01 · Teamet', 'Teamet', 'just nu', '<div class="lp-team">' + kort + '</div>', { ingress: 'Status, pipeline, kvartalsmålet och veckans aktivitet per säljare – klicka för profilen.', hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + filter + '</div>' }) +
      chefBand('02 · Närvaro', 'Vem jobbar', 'när', narv, { ingress: 'Arbetsdagar enligt schemat, dagar med aktivitet i CRM:et och frånvaro – klicka på en dag för att lägga in frånvaro.' }) +
      chefBand('03 · Kalender', 'Teamets', 'kalender', kalender(team), { ingress: 'Möten, samtal och mejl, uppgifter som förfaller och vunna affärer – för hela teamet eller en person.' }) +
      '<div class="ao-tva">' + chefBand('04 · Att agera på', 'Behöver din', 'uppmärksamhet', uppm, { hoger: lista.length ? '<span class="ao-band__tal">' + lista.length + '</span>' : '', ingress: lista.length ? 'Det viktigaste överst. Ta själv, fördela eller påminn direkt.' : '' }) +
        chefBand('05 · Pipeline', 'Pipeline', 'per säljare', pipe, { ingress: 'Öppet värde per steg – håll musen över en färg för beloppet.' }) + '</div>' +
      '<div class="ao-tva">' + chefBand('06 · Aktivitet', 'Aktivitet', '14 dagar', karta + senasteHandelser(team), { ingress: 'Loggade möten, samtal och mejl per dag. Pilen jämför med de 14 dagarna innan.' }) +
        chefBand('07 · Resultat', 'Topplistan', period === 'ar' ? 'i år' : period + ' dagar', topplista, { hoger: toppVal }) + '</div>';
    var raknaUpp = Date.now() - (IH.vyer.chef.senast || 0) > 15000; IH.vyer.chef.senast = Date.now();
    return { titel: 'Försäljning', html: html, efter: function (yta) {
      if (!raknaUpp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      yta.querySelectorAll('.lp-mork .ao-tal strong, .lp-ring__mitt b').forEach(function (el, n) {
        var txt = el.textContent, m = txt.match(/^([\d\s]+(?:,\d+)?)(.*)$/); if (!m) return;
        var mal = parseFloat(m[1].replace(/\s/g, '').replace(',', '.')), dec = (m[1].split(',')[1] || '').length, t0 = performance.now() + n * 90;
        var steg = function (nu) { var p = Math.min(1, Math.max(0, (nu - t0) / 1100)), v = mal * (1 - Math.pow(1 - p, 3)); el.textContent = v.toLocaleString('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[2]; if (p < 1) requestAnimationFrame(steg); else el.textContent = txt; };
        requestAnimationFrame(steg);
      });
    } };
  };

  /* Chefens verktyg ------------------------------------------------------------------------------ */
  var G = IH.G;
  var valSaljare = function (namn, vald) { return '<label class="falt"><span>Säljare</span><select name="' + namn + '">' + saljare().filter(function (u) { return !u.inaktiv; }).map(function (u) { return '<option value="' + u.id + '"' + (u.id === vald ? ' selected' : '') + '>' + e(u.namn) + '</option>'; }).join('') + '</select></label>'; };
  G['lp-chef-filter'] = function (el) { chefUi.filter = el.getAttribute('data-f'); IH.rita(); };
  G['lp-agera-f'] = function (el) { chefUi.agera = el.getAttribute('data-f'); IH.rita(); };
  G['lp-topp-period'] = function (el) { var f = el.getAttribute('data-f'); chefUi.topp = f === 'ar' ? 'ar' : +f; IH.rita(); };
  var tilldela = function (a, f, till) {
    if (a) { a.ansvarig = till.id; a.andrad = new Date().toISOString(); IH.logga('system', 'Fördelad till ' + till.namn + ' av ' + IH.jag().namn + '.', a.kund, a.id); }
    if (f) f.tilldelad = till.id;
  };
  G['lp-ta-sjalv'] = function (el) {
    var a = IH.affar(el.getAttribute('data-affar')), f = IH.forfragan(el.getAttribute('data-forfragan')), jag = IH.jag();
    tilldela(a, f, jag); IH.spara(); IH.uppdateraMeny(); IH.rita(); IH.toast('Din nu', (a ? a.titel : f ? f.namn : '') + ' ligger hos dig.', 'kunder');
  };
  // jämn fördelning: varje ny post går till den som har minst öppet (affärer plus tilldelade förfrågningar) just då
  G['lp-fordela-smart'] = function () {
    var folk = saljare().filter(function (u) { return !u.inaktiv; }); if (!folk.length) return;
    var last = {}; folk.forEach(function (u) { last[u.id] = db().affarer.filter(function (a) { return a.ansvarig === u.id && a.steg !== 'vunnen' && !a.forlorad; }).length + db().forfragningar.filter(function (f) { return f.tilldelad === u.id && f.status === 'ny'; }).length; });
    var poster = db().forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).map(function (f) { return { f: f }; })
      .concat(db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad && (!a.ansvarig || !IH.anvandare(a.ansvarig) || IH.anvandare(a.ansvarig).inaktiv); }).map(function (a) { return { a: a }; }));
    var fick = {};
    poster.forEach(function (p2) { var u = folk.slice().sort(function (x, y) { return last[x.id] - last[y.id]; })[0]; tilldela(p2.a, p2.f, u); last[u.id]++; fick[u.id] = (fick[u.id] || 0) + 1; });
    IH.spara(); IH.uppdateraMeny(); IH.rita();
    IH.toast('Fördelat jämnt', Object.keys(fick).map(function (id) { return IH.anvandare(id).namn.split(' ')[0] + ' fick ' + fick[id]; }).join(', ') + '.', 'blixt');
  };
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
