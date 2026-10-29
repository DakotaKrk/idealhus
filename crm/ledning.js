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
    { id: 'mote', namn: 'I möte', kort: 'Möte', farg: '#e8a456' },
    { id: 'upptagen', namn: 'Upptagen', kort: 'Stör ej', farg: '#d9573f' },
    { id: 'strax', namn: 'Strax tillbaka', farg: '#e8c98f' },
    { id: 'lunch', namn: 'Lunch', farg: '#9fc2c9' },
    { id: 'ute', namn: 'Ute på tomt', farg: '#a9c8a4' },
    { id: 'semester', namn: 'Semester', farg: '#b8cde0' },
    { id: 'sjuk', namn: 'Sjuk', farg: '#d7c2e0' },
    { id: 'osynlig', namn: 'Osynlig', farg: '#c9c4bb' }
  ];
  // Exempel: så står kollegorna när prototypen öppnas
  var START = { ah: 'online', sa: 'mote', ad: 'online' };
  var OFFLINE = { id: 'offline', namn: 'Offline', farg: '#c9c4bb' };
  // Frånvaro i kalendern går före den valda statusen (ledig och utbildning har ingen egen status)
  var FV_NARV = { semester: 'semester', sjuk: 'sjuk', ledig: { id: 'ledig', namn: 'Ledig', farg: '#c9d8c4' }, utbildning: { id: 'utbildning', namn: 'Utbildning', farg: '#d8cfa8' } };
  function lasNarvaro() { try { return JSON.parse(localStorage.getItem('ih-crm-narvaro')) || {}; } catch (x) { return {}; } }
  function narvaro(uid) {
    var fv = IH.db && franvaroPa(uid, dag0(new Date()).getTime());
    if (fv) { var fn = FV_NARV[fv.typ]; if (typeof fn === 'object') return fn; if (fn) return NARVARO.filter(function (n) { return n.id === fn; })[0]; }
    // ett konto som aldrig satt någon status är offline – utom den som är inloggad just nu
    var s = lasNarvaro()[uid] || START[uid] || (uid === IH.jag().id ? 'online' : 'offline');
    // Osynlig syns som offline för alla utom en själv
    if (s === 'offline' || (s === 'osynlig' && uid !== IH.jag().id)) return OFFLINE;
    return NARVARO.filter(function (n) { return n.id === s; })[0] || NARVARO[0];
  }
  IH.narvaro = narvaro;
  // Aktiv nu = inloggad och jobbar (online, i möte, upptagen, ute på tomt); i tjänst = inte borta eller frånvarande
  var AKTIV = ['online', 'mote', 'upptagen', 'ute'];
  IH.aktivNu = function (uid) { return AKTIV.indexOf(narvaro(uid).id) >= 0; };
  IH.iTjanst = function (uid) { return BORTA.indexOf(narvaro(uid).id) < 0; };
  IH.narvaroPrick = function (uid) { var n = narvaro(uid); return '<i class="narvaro-prick" style="--n:' + n.farg + '" title="' + e(n.namn) + '"></i>'; };
  IH.narvaroText = function (uid) { var u = IH.anvandare(uid); return e(narvaro(uid).namn) + ' · ' + e(u ? u.titel : ''); };
  function avatar(u, stor) {
    return '<span class="avatar' + (stor ? ' avatar--stor' : '') + (u.bild ? ' avatar--bild' : '') + '" style="--av:' + u.farg + (u.bild ? ';background-image:url(' + e(u.bild) + ')' : '') + '">' + IH.initialer(u.namn) + IH.narvaroPrick(u.id) + '</span>';
  }

  /* 02 Kontomenyn ------------------------------------------------------------------------------- */
  /* Egna konton (Nytt konto): sparas i webbläsaren och läggs till exempelkontona */
  var EGNA = 'ih-crm-konton';
  function egnaKonton() { try { return JSON.parse(localStorage.getItem(EGNA)) || []; } catch (x) { return []; } }
  // Lagrade konton godtas bara med ofarligt id, färg och bild – värdena hamnar i attribut och i style="…"
  var OK_ID = /^[A-Za-z0-9_-]{1,64}$/, OK_FARG = /^(#[0-9a-f]{3,8}|linear-gradient\([#0-9a-z,%(). -]+\))$/i, OK_BILD = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  egnaKonton().forEach(function (u) {
    if (!u || typeof u.id !== 'string' || !OK_ID.test(u.id) || typeof u.namn !== 'string' || IH.anvandare(u.id)) return;
    if (typeof u.farg !== 'string' || !OK_FARG.test(u.farg)) u.farg = '#cfc6b8';
    if (u.bild && (typeof u.bild !== 'string' || !OK_BILD.test(u.bild))) delete u.bild;
    IH.ANVANDARE.push(u);
  });

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
    // den inloggade är aktiv nu, liksom den som är online, i möte, upptagen eller ute på tomt
    if (u.id === IH.jag().id || IH.aktivNu(u.id)) return { text: 'aktiv nu', nu: true };
    var t = db().aktiviteter.filter(function (h) { return h.av === u.id && !h.stod && new Date(h.tid) <= new Date(); }).map(function (h) { return h.tid; }).sort().pop();
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
    var andra = IH.ANVANDARE.filter(function (u) { return u.id !== jag.id && !u.inaktiv && (!IH.fartByta || IH.fartByta(u.id)); });
    var lank = function (attr, ikon, text) { var a = attr.indexOf('href') === 0; return '<' + (a ? 'a' : 'button type="button"') + ' class="km-lank" ' + attr + ' title="' + text + '">' + IH.emo(ikon) + '<span>' + text + '</span></' + (a ? 'a' : 'button') + '>'; };
    return '<header class="km-topp" style="--n:' + nu.farg + '">' +
        '<button type="button" class="km-stang" data-g="km-stang" aria-label="Stäng" title="Stäng (Esc)">' + i('stang') + '</button>' +
        '<span class="km-bild"><span class="km-ring" aria-hidden="true"></span><span class="avatar avatar--stor' + (jag.bild ? ' avatar--bild' : '') + '" style="--av:' + jag.farg + (jag.bild ? ';background-image:url(' + e(jag.bild) + ')' : '') + '">' + IH.initialer(jag.namn) + '</span></span>' +
        '<div class="km-du"><small>Inloggad som</small><strong title="' + e(jag.namn) + '">' + e(jag.namn) + '</strong><span class="km-roller">' + rollerFor(jag).map(function (r) { return '<span class="ap-roll" data-roll="' + r + '">' + r + '</span>'; }).join('') + '</span></div>' +
        '<button type="button" class="km-statusknapp" data-g="km-status" aria-expanded="' + kmStatusOppen + '"><i></i><span>' + e(nu.namn) + '</span>' + IH.emo('redigera') + '</button></header>' +
      '<div class="km-snabb">' + SNABB.map(function (id) { var n = NARVARO.filter(function (x) { return x.id === id; })[0];
        return '<button type="button" class="km-snabbval" data-g="satt-narvaro" data-s="' + id + '" style="--n:' + n.farg + '" title="' + n.namn + '" aria-label="Status: ' + n.namn + '" aria-pressed="' + (vald === id) + '">' + IH.emo(NARV_IKON[id]) + '<small>' + e(n.kort || n.namn) + '</small></button>'; }).join('') + '</div>' +
      (kmStatusOppen ? '<div class="km-statusval">' + NARVARO.map(function (n) {
        return '<button type="button" data-g="satt-narvaro" data-s="' + n.id + '" aria-pressed="' + (vald === n.id) + '" style="--n:' + n.farg + '">' + IH.emo(NARV_IKON[n.id]) + '<span>' + e(n.namn) + '</span></button>';
      }).join('') + '</div>' : '') +
      '<div class="km-grupp"><p class="km-rubrik"><span>Byt konto</span><small>Prototyp: logga in som någon annan i teamet</small></p>' +
        '<div class="km-lista" role="list">' + [jag].concat(andra).map(function (u, n) { return '<div role="listitem" style="--i:' + n + '">' + kontoRad(u, u.id === jag.id) + '</div>'; }).join('') + '</div></div>' +
      (IH.tema && IH.tema.valjare ? '<div class="km-tema"><p class="km-rubrik"><span>Tema</span><small data-tema-namn>' + e(IH.tema.beskrivning()) + '</small></p>' + IH.tema.valjare('liten') + '</div>' : '') +
      (IH.layout && IH.layout.valjare ? '<div class="km-layout"><p class="km-rubrik"><span>Layout</span><small data-layout-namn>' + e(IH.layout.namn()) + '</small></p>' + IH.layout.valjare('liten') + '</div>' : '') +
      '<footer class="km-fot">' + lank('href="#/profil"', 'anstallda', 'Min profil') +
        lank('href="#/installningar"', 'installningar', 'Inställningar') +
        lank('data-g="logga-ut"', 'logga-ut', 'Logga ut') + '</footer>';
  }
  IH.G['konto-meny'] = function () {
    if (km) { stangKm(); return; }
    var sido = document.querySelector('.sido'), r = sido && sido.getBoundingClientRect();
    if (!r || r.width < 200 || !matchMedia('(min-width: 1101px)').matches || document.documentElement.hasAttribute('data-sido-dold')) {
      IH.oppnaArk({ titel: IH.jag().namn, under: e(IH.jag().titel), ikon: 'kunder', kropp: '<div class="km-ark">' + kmHtml() + '</div>' });
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
    IH.oppnaArk({ titel: 'Nytt konto', under: 'Kontot sparas i den här webbläsaren (prototyp).', ikon: 'kunder',
      kropp: '<form id="km-ny-form" data-km-ny class="km-form"><label class="falt"><span>Namn</span><input name="namn" required maxlength="40" placeholder="För- och efternamn"></label>' +
        '<label class="falt"><span>Roll</span><select name="roll"><option value="salj">Sälj</option><option value="prod">Produktion</option>' + (IH.jag().roll === 'admin' ? '<option value="admin">Admin</option>' : '') + '</select></label>' +
        '<label class="km-kryss"><input type="checkbox" name="chef"> Försäljningschef (ser försäljningsledningen, bara Sälj)</label>' +
        '<label class="falt"><span>Årsmål i kronor (bara sälj)</span><input name="mal" type="number" min="0" step="1" placeholder="T.ex. 825 000"></label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="km-ny-form">' + i('plus') + 'Spara konto</button>' });
  };
  // Titeln efter roll – används för nya konton och när titeln töms i Ändra profil
  // RFC 5545: rader längre än 75 oktetter viks med CRLF och ett blanksteg
  IH.icsVik = function (rad) { var ut = '', n = 0; Array.from(String(rad)).forEach(function (t) { var b = unescape(encodeURIComponent(t)).length; if (n + b > 75) { ut += '\r\n '; n = 1; } ut += t; n += b; }); return ut; };
  var standardTitel = function (u) { return u.roll === 'salj' ? 'Sälj' + (u.chef ? ' · Försäljningschef' : '') : u.roll === 'prod' ? 'Produktion' : 'Administratör'; };
  var FARGER = [['#e8c98f', '#a6763a'], ['#9fc2c9', '#3d6a73'], ['#a9c8a4', '#3f6b50'], ['#f0b0a0', '#a8513e']].map(function (p) { return 'linear-gradient(135deg,' + p[0] + ',color-mix(in srgb,' + p[1] + ',' + p[0] + ' var(--t-avatar-ljus,0%)))'; });
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-km-ny]')) return;
    ev.preventDefault();
    var namn = t.namn.value.trim(); if (!namn) return;
    if (IH.ANVANDARE.some(function (u) { return u.namn.toLowerCase() === namn.toLowerCase(); })) { IH.toast('Det finns redan ett konto med det namnet', null, 'varning'); return; }
    if (t.chef.checked && t.roll.value !== 'salj') { IH.toast('Försäljningschef gäller bara Sälj', 'Välj rollen Sälj eller ta bort bocken.', 'varning'); return; }
    var roll = t.roll.value, chef = t.chef.checked && roll === 'salj';
    var u = { id: 'u' + Date.now().toString(36), namn: namn, roll: roll, chef: chef || undefined, egen: true,
      titel: standardTitel({ roll: roll, chef: chef }),
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
    var fv = franvaroPa(jag.id, dag0(new Date()).getTime());
    if (fv) IH.toast('Du har ' + FRANVARO[fv.typ][0].toLowerCase() + ' inlagd i dag', 'Den visas för teamet tills du tar bort frånvaron i kalendern på din profil.', 'kalender');
    else IH.toast('Status: ' + narvaro(jag.id).namn, 'Kollegorna ser den i teamet.', 'kunder');
  };

  /* 01b Bokade möten: kalendern lägger en påminnelse (uppgift med kalAkt) för ett kommande möte. Flyttas påminnelsen
     under Att göra flyttas mötet med; när mötet har varit bockas påminnelsen av, så den aldrig blir en försenad uppgift. */
  function synkaMoten() {
    var d = IH.db; if (!d || !d.uppgifter || !d.aktiviteter) return false;
    var nu = new Date(), andrat = false;
    d.uppgifter.forEach(function (x) {
      if (!x.kalAkt || x.klar) return;
      var h = d.aktiviteter.find(function (y) { return y.id === x.kalAkt; });
      if (h && h.tid !== x.forfaller) { h.tid = x.forfaller; andrat = true; }
      if (!h || new Date(x.forfaller) < nu) { x.klar = true; x.klarTid = h ? x.forfaller : nu.toISOString(); andrat = true; }
    });
    return andrat;
  }
  var sparaForra = IH.spara;
  IH.spara = function () { synkaMoten(); return sparaForra.apply(this, arguments); };
  if (synkaMoten()) sparaForra();

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
    var h = location.hash || '#/', st = history.state;
    if (/^#\/chef/.test(h)) { senastChef = h; lageNu = 'chef'; }
    else if (!/^#\/profil/.test(h)) { lageNu = 'salj'; senastSalj = h; }
    else if (st && st.ihLage) lageNu = st.ihLage;
    try { history.replaceState(Object.assign({}, st || {}, { ihLage: lageNu }), ''); } catch (x) { /* utan historik */ }
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
    // bara det som har hänt räknas som arbete; kontakt = utan systemrader (flyttar, fördelningar …)
    var nuT = new Date();
    var akt = db().aktiviteter.filter(function (h) { return h.av === u.id && !h.stod && new Date(h.tid) <= nuT; });
    var kontakt = akt.filter(function (h) { return h.typ !== 'system'; });
    var uppg = db().uppgifter.filter(function (x) { return x.ansvarig === u.id && !x.klar; });
    var idag = dag0(new Date());
    // ett bokat möte (kalAkt) blir inte en försenad uppgift när dagen har passerat
    var sena = uppg.filter(function (x) { return !x.kalAkt && dag0(x.forfaller) < idag; });
    var stilla = oppna.filter(function (a) { return IH.dagarSedan(a.andrad) > 14; });
    var summa = function (l) { return l.reduce(function (t, a) { return t + (a.varde || 0); }, 0); };
    var viktat = oppna.reduce(function (t, a) { return t + (a.varde || 0) * IH.sannolikhet(a) / 100; }, 0);
    var avslutade = vunna.length + forlorade.length;
    return { u: u, aff: aff, oppna: oppna, vunna: vunna, forlorade: forlorade, akt: akt, kontakt: kontakt, uppg: uppg, sena: sena, stilla: stilla,
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
    // skalan räknar med minst tre händelser, så en enda händelse inte ser ut som en full dag
    var max = Math.max.apply(null, dagar.map(function (d) { return d.antal; }).concat([3])), idag = dag0(new Date()).getTime();
    return '<span class="' + klass + '">' + dagar.map(function (d) {
      return '<i style="--h:' + (d.antal / max).toFixed(3) + '" class="' + (d.antal ? 'pa' : '') + (d.dag.getDay() % 6 === 0 ? ' helg' : '') + (d.dag.getTime() === idag ? ' idag' : '') + '" title="' + e(IH.datum(d.dag.toISOString())) + ': ' + (d.antal ? d.antal + (d.antal === 1 ? ' händelse' : ' händelser') : 'ingen aktivitet') + '">' + (d.antal && klass.indexOf('liten') < 0 ? '<em>' + d.antal + '</em>' : '') + '</i>';
    }).join('') + '</span>';
  }
  var saljare = function () { return IH.ANVANDARE.filter(function (u) { return u.roll === 'salj'; }); };

  /* 04 Profilen #/profil[/id] --------------------------------------------------------------------- */
  IH.vyer.profil = function (del) {
    var u = del[0] ? IH.anvandare(del[0]) : IH.jag();
    if (!u) return { titel: 'Profil', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><p class="lp-tom">Kontot finns inte.</p>' };
    var jag = IH.jag(), ar = u.id === jag.id, st = stat(u), n = narvaro(u.id), salj = u.roll === 'salj', kanAndra = ar || jag.chef || jag.roll === 'admin';
    var fornamn = u.namn.split(' ')[0];
    // nyckeltalen efter roll (säljare: försäljningen, produktionen: projekten, admin: systemet)
    var nu30 = st.akt.filter(function (h) { return IH.dagarSedan(h.tid) < 30; }).length;
    var tal = salj ? [
        ['portfolj', 'Öppna affärer', IH.kort(st.oppet), plural(st.oppna.length, 'affär', 'affärer')],
        ['stapel', 'Viktad prognos', IH.kort(st.viktat), 'värde × chans'],
        ['medalj', 'Vunnet i år', IH.kort(st.vunnet), u.mal ? Math.round(st.vunnet / u.mal * 100) + ' % av ' + IH.kort(u.mal) : 'inget mål satt'],
        ['trend', 'Vinstgrad', st.vinstgrad == null ? '–' : Math.round(st.vinstgrad * 100) + ' %', 'vunna av avgjorda']]
      : u.roll === 'prod' ? [
        ['byggnad', 'Aktiva projekt', db().projekt.filter(function (p) { return p.steg !== 'klart'; }).length, 'i produktion'],
        ['blixt', 'I montage', db().projekt.filter(function (p) { return p.steg === 'montage'; }).length, 'på bygget nu'],
        ['klar', 'Överlämnade', db().projekt.filter(function (p) { return p.steg === 'klart'; }).length, 'klara hus'],
        ['stapel', 'Aktivitet 30 d', nu30, 'händelser']]
      : [
        ['kunder', 'Konton', IH.ANVANDARE.filter(function (x) { return !x.inaktiv; }).length, IH.ANVANDARE.filter(function (x) { return narvaro(x.id).id === 'online'; }).length + ' online nu'],
        ['skold', 'Säkerhet', 'Öppna', 'skanning och logg', '#/sakerhet'],
        ['stapel', 'Poster', ['kunder', 'affarer', 'projekt', 'aktiviteter', 'uppgifter'].reduce(function (t, k) { return t + (db()[k] || []).length; }, 0), 'i CRM:et'],
        ['blixt', 'Händelser 7 d', db().aktiviteter.filter(function (h) { return IH.dagarSedan(h.tid) < 7; }).length, 'i hela teamet']];
    var sedanTxt = u.start ? (iTeamet(u).fram ? 'Börjar i teamet ' + iTeamet(u).datum : 'I teamet ' + iTeamet(u).sedan) : '';
    var senast = senastFor(u);
    var chips = rollerFor(u).map(function (r) { return '<span class="lp-pchip">' + e(r) + '</span>'; }).join('') + '<span class="lp-pchip lp-pchip--narv" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</span>';
    var html = '<a class="tillbaka" href="' + (jag.chef && !ar ? '#/chef' : '#/') + '">' + i('pilv') + (jag.chef && !ar ? 'Försäljningsledning' : 'Översikt') + '</a>' +
      '<section class="lp-phjalte lp-mork kort kort--mork" data-in style="--n:' + n.farg + '"><div class="sh-rutnat" aria-hidden="true"></div><i class="lp-mork__glod" aria-hidden="true"></i><i class="lp-mork__glod lp-mork__glod--2" aria-hidden="true"></i>' +
        '<div class="lp-phjalte__vanster"><div class="lp-phjalte__id">' +
          '<div class="lp-pbild"><span class="lp-pbild__ring" aria-hidden="true"></span>' + avatar(u, true) +
            (kanAndra ? '<label class="lp-kamera" title="Byt profilbild">' + i('kamera') + '<span class="sr">Byt profilbild för ' + e(u.namn) + '</span><input type="file" accept="image/*" data-lp-bild="' + u.id + '" hidden></label>' : '') + '</div>' +
          '<div><p class="etikett"><i class="lp-live" aria-hidden="true"></i>' + (ar ? 'Din profil' : 'Profil') + '</p><h1>' + e(u.namn) + '</h1><p class="lp-phjalte__titel">' + e(u.titel || '') + '</p><p class="lp-phjalte__chips">' + chips + '</p></div></div>' +
          '<p class="lp-phjalte__fakta"><span' + (senast.nu ? ' class="nu"' : '') + '>' + i('klocka') + (senast.nu ? 'Aktiv nu' : 'Senast aktiv ' + e(senast.text)) + '</span>' +
            (sedanTxt ? '<span>' + i('kalender') + e(sedanTxt) + '</span>' : '') +
            (u.epost ? '<a href="mailto:' + e(u.epost) + '">' + i('post') + e(u.epost) + '</a>' : '') +
            (u.tel ? '<a href="tel:' + e(String(u.tel).replace(/[^\d+]/g, '')) + '">' + i('tel') + e(u.tel) + '</a>' : '') + '</p>' +
          '<div class="lp-phjalte__knappar">' +
            (ar ? '<button type="button" class="sh-knapp sh-knapp--accent" data-g="konto-meny">' + i('trend') + 'Ändra status</button>' : '') +
            (kanAndra ? '<button type="button" class="sh-knapp" data-g="lp-andra-profil" data-id="' + u.id + '">' + i('skriv') + 'Ändra profil</button>' : '') +
            (salj ? '<a class="sh-knapp" href="#/salj">' + i('tavla') + (ar ? 'Min säljtavla' : 'Säljtavlan') + '</a>' : '') +
            (!ar ? '<button type="button" class="sh-knapp sh-knapp--accent" data-g="ch-skriv-till" data-uid="' + u.id + '">' + i('meddelande') + 'Skicka meddelande</button>' : '') +
            (ar ? '<button type="button" class="sh-knapp" data-g="lp-egen-uppg" data-id="' + u.id + '">' + i('plus') + 'Ny uppgift</button>' : (jag.chef ? '<button type="button" class="sh-knapp" data-g="lp-uppgift" data-id="' + u.id + '">' + i('plus') + 'Ge uppgift</button>' : '')) +
          '</div></div>' +
        '<div class="lp-phjalte__tal">' + tal.map(function (t, k) {
          var tagg = t[4] ? 'a' : 'div';
          return '<' + tagg + ' class="ao-tal lp-ptal"' + (t[4] ? ' href="' + t[4] + '"' : '') + ' style="--n:' + k + '"><span class="ao-tal__ikon">' + IH.emo(t[0]) + '</span><small>' + t[1] + '</small><strong>' + t[2] + '</strong><em>' + t[3] + '</em></' + tagg + '>';
        }).join('') + '</div>' +
      '</section>' +
      '<div class="lp-tvakol">' + omKort(u, ar, st, kanAndra) + arbeteKort(u, ar, st) + '</div>' +
      (u.roll !== 'admin' ? profilKalender(u, ar) : '');
    return { titel: ar ? 'Min profil' : u.namn, html: html };
  };
  // Tiden i teamet i hela månader (kalendermånader, inte 365,25-dagarsår); ett framtida startdatum visas som Börjar
  function iTeamet(u) {
    if (!u.start) return { tid: '–', sedan: '', datum: '', fram: false };
    var s = new Date(u.start + (String(u.start).length === 10 ? 'T12:00:00' : '')), nu = new Date();
    var datum = IH.lokal(s, 'd', { day: 'numeric', month: 'long', year: 'numeric' });
    if (dag0(s) > dag0(nu)) return { tid: 'Börjar snart', sedan: 'börjar ' + datum, datum: datum, fram: true };
    var man = (nu.getFullYear() - s.getFullYear()) * 12 + nu.getMonth() - s.getMonth() - (nu.getDate() < s.getDate() ? 1 : 0);
    var ar = Math.floor(man / 12), rest = man % 12;
    var tid = man < 1 ? 'Ny i teamet' : (ar ? ar + ' år' : '') + (ar && rest ? ' ' : '') + (rest ? rest + ' mån' : '');
    return { tid: tid, sedan: 'sedan ' + IH.lokal(s, 'd', { month: 'long', year: 'numeric' }), datum: datum, fram: false };
  }
  // Om-kortet: presentationen, kontaktvägarna, rutor (roller, i teamet, årsmålet, frånvaro) och det senaste i tidslinjerna
  function omKort(u, ar, st, kanAndra) {
    var fornamn = u.namn.split(' ')[0], tel = String(u.tel || '').replace(/[^\d+]/g, '');
    var tidTxt = iTeamet(u).tid;
    var kanal = function (ikon, etikett, varde, lank, lankIkon, titel) {
      return '<div class="lp-om-kanal"><span class="lp-om-ikon">' + i(ikon) + '</span><span><small>' + etikett + '</small><strong>' + e(varde) + '</strong></span>' +
        '<a class="lp-om-mini" href="' + e(lank) + '" title="' + titel + '" aria-label="' + titel + '">' + i(lankIkon) + '</a><button type="button" class="lp-om-mini" data-g="lp-kopiera" data-text="' + e(varde) + '" title="Kopiera" aria-label="Kopiera">' + i('kopiera') + '</button></div>';
    };
    var kontakt = (u.epost ? kanal('post', 'E-post', u.epost, 'mailto:' + u.epost, 'post', 'Skicka e-post') : '') + (tel ? kanal('tel', 'Telefon', u.tel, 'tel:' + tel, 'tel', 'Ring') : '') +
      (!ar ? '<button type="button" class="lp-om-chatta" data-g="ch-skriv-till" data-uid="' + u.id + '">' + i('meddelande') + '<span>Skicka meddelande till ' + e(fornamn) + '<small>' + e(narvaro(u.id).namn) + '</small></span>' + i('pil') + '</button>' : '') +
      (!u.epost && !tel && kanAndra ? '<button type="button" class="lp-om-chatta" data-g="lp-andra-profil" data-id="' + u.id + '">' + i('plus') + '<span>Lägg till e-post och telefon<small>Så når teamet ' + (ar ? 'dig' : e(fornamn)) + '</small></span>' + i('pil') + '</button>' : '');
    var ruta = function (ikon, etikett, inne) { return '<div class="lp-om-ruta"><span class="lp-om-ikon">' + IH.emo(ikon) + '</span><div><small>' + etikett + '</small>' + inne + '</div></div>'; };
    var nasta = franvaroLista().filter(function (f) { return f.u === u.id && dag0(f.till).getTime() >= dag0(new Date()).getTime(); }).sort(function (a, c) { return a.fran < c.fran ? -1 : 1; })[0];
    var andel = u.mal ? Math.min(1, st.vunnet / u.mal) : null;
    var rutor = ruta('kunder', 'Roller', '<strong>' + e(rollerFor(u).join(' · ')) + '</strong><em>' + e(u.titel || '') + '</em>') +
      ruta('kalender', 'I teamet', '<strong>' + tidTxt + '</strong><em>' + (u.start ? e(iTeamet(u).sedan) :(kanAndra ? '<button type="button" class="lp-textknapp" data-g="lp-andra-profil" data-id="' + u.id + '">Ange startdatum</button>' : 'inget startdatum')) + '</em>') +
      (u.roll === 'salj' ? ruta('mal', 'Årsmål ' + new Date().getFullYear(), u.mal ? '<strong>' + IH.kort(st.vunnet) + ' <span>av ' + IH.kort(u.mal) + '</span></strong><span class="lp-om-matare" style="--a:' + andel.toFixed(3) + '"><i></i></span><em>' + Math.round(st.vunnet / u.mal * 100) + ' % av målet' + (IH.jag().chef ? ' · <button type="button" class="lp-textknapp" data-g="lp-mal">Ändra</button>' : '') + '</em>' : '<strong>Inget mål</strong>' + (IH.jag().chef ? '<em><button type="button" class="lp-textknapp" data-g="lp-mal">Sätt mål</button></em>' : '')) :
        ruta('blixt', 'Senast aktiv', '<strong>' + e(senastFor(u).text) + '</strong><em>' + e(narvaro(u.id).namn) + '</em>')) +
      ruta('flyg', 'Arbetsdagar', '<span class="lp-vdagar">' + ['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(function (d, k) { return '<i' + (k < 5 ? ' class="pa"' : '') + '>' + d + '</i>'; }).join('') + '</span>' + (nasta ? '<em><b class="lp-fvchip">' + e(FRANVARO[nasta.typ][0]) + '</b> ' + kortDatum(new Date(nasta.fran)) + (nasta.till !== nasta.fran ? '–' + kortDatum(new Date(nasta.till)) : '') + (kanFranvaro(u.id) ? ' · <button type="button" class="lp-textknapp" data-g="lp-franvaro" data-fid="' + nasta.id + '" data-uid="' + u.id + '" data-dag="' + nasta.fran.slice(0, 10) + '">Ändra</button>' : '') + '</em>' : '<em>Ingen frånvaro inlagd' + (kanFranvaro(u.id) ? ' · <button type="button" class="lp-textknapp" data-g="lp-franvaro" data-uid="' + u.id + '">Lägg in</button>' : '') + '</em>'));
    var senaste = db().aktiviteter.filter(function (h) { return h.av === u.id && !h.stod && new Date(h.tid) <= new Date(); }).sort(function (a, c) { return new Date(c.tid) - new Date(a.tid); }).slice(0, 7);
    return '<section class="kort lp-band2 lp-omkort" data-in><header class="lp-band2__huvud"><div><p class="ao-ogon">Om</p><h2>Om <em>' + (ar ? 'dig' : e(fornamn)) + '</em></h2></div>' +
        (kanAndra ? '<button type="button" class="knapp knapp--liten" data-g="lp-andra-profil" data-id="' + u.id + '">' + i('skriv') + 'Ändra</button>' : '') + '</header>' +
      (u.om ? '<blockquote class="lp-om-citat"><span aria-hidden="true">”</span>' + e(u.om) + '</blockquote>' : ar ? '<button type="button" class="lp-om-skriv" data-g="lp-andra-profil" data-id="' + u.id + '" data-fokus="om">' + i('skriv') + '<span><strong>Berätta om dig</strong><small>Några rader om vad du jobbar med och hur man når dig bäst – syns för hela teamet.</small></span>' + i('pil') + '</button>' : '<p class="lp-om-ingen">' + e(fornamn) + ' har inte skrivit någon presentation än.</p>') +
      (kontakt ? '<div class="lp-om-kontakt">' + kontakt + '</div>' : '') +
      '<div class="lp-om-rutor">' + rutor + '</div>' +
      '<p class="lp-del">Senaste händelserna</p>' +
      (senaste.length ? '<ul class="lp-om-senast">' + senaste.map(function (h) {
        var k = h.kund && IH.kund(h.kund);
        return '<li><span class="lp-senaste__ikon" data-typ="' + (h.typ || 'notis') + '">' + i(AKT_IKON[h.typ] || 'anteckning') + '</span><span><strong>' + e(String(h.text).slice(0, 96)) + (String(h.text).length > 96 ? '…' : '') + '</strong><small>' + e((AKT_NAMN[h.typ] || 'Aktivitet') + (k ? ' · ' + k.namn : '') + ' · ' + IH.sedan(h.tid)) + '</small></span>' +
          (k ? '<a class="lp-om-mini" href="#/kunder/' + k.id + '" aria-label="Öppna kunden">' + i('pil') + '</a>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="lp-tom">Inget i tidslinjerna ännu.</p>') +
      '<div class="lp-genvagar"><p class="lp-del">Genvägar</p><div>' + [['#/salj', 'tavla', 'Säljtavlan', plural(st.oppna.length, 'affär', 'affärer')], ['#/kunder', 'kunder', 'Kunder', plural(db().kunder.length, 'kund', 'kunder')], ['#/att-gora', 'uppgift', 'Att göra', plural(st.uppg.length, 'öppen', 'öppna')], ['#/dokument', 'mapp', 'Dokument', 'alla filer']].map(function (g, n) {
        return '<a href="' + g[0] + '" style="--n:' + n + '"><span class="lp-om-ikon">' + i(g[1]) + '</span><b>' + g[2] + '</b><small>' + g[3] + '</small></a>'; }).join('') + '</div></div></section>';
  }
  // Arbetskortet: tre tal, staplarna 30 dagar med fördelning per typ, de största öppna affärerna och att göra
  function arbeteKort(u, ar, st) {
    var dagar = perDag(st.akt, 30), forra = perDag(st.akt, 60).slice(0, 30);
    var nu30 = dagar.reduce(function (t, d) { return t + d.antal; }, 0), fo30 = forra.reduce(function (t, d) { return t + d.antal; }, 0), diff = nu30 - fo30;
    var svit = 0; for (var q = dagar.length - 1; q >= 0; q--) { if (dagar[q].antal) svit++; else if (q < dagar.length - 1) break; }
    var tal = function (ikon, etikett, varde, under, ton) { return '<div class="lp-arb-tal"' + (ton ? ' data-ton="' + ton + '"' : '') + '><span class="lp-om-ikon">' + IH.emo(ikon) + '</span><small>' + etikett + '</small><strong>' + varde + '</strong><em>' + under + '</em></div>'; };
    var proj = db().projekt.filter(function (p) { return p.steg !== 'klart'; });
    var TYP = { samtal: ['Samtal', '#c98a45'], mote: ['Möten', '#5b8a9a'], mejl: ['Mejl', '#8a7bb0'], besok: ['Besök', '#6f9a5b'], notis: ['Anteckningar', '#b9a58a'], anteckning: ['Anteckningar', '#b9a58a'], system: ['System', '#a39a8c'] };
    var per = {}; st.akt.filter(function (h) { return IH.dagarSedan(h.tid) < 30; }).forEach(function (h) { var k = TYP[h.typ] ? TYP[h.typ][0] : 'Övrigt'; per[k] = per[k] || { n: 0, f: TYP[h.typ] ? TYP[h.typ][1] : '#a39a8c' }; per[k].n++; });
    var typer = Object.keys(per).sort(function (a, c) { return per[c].n - per[a].n; });
    var idag0 = dag0(new Date()).getTime();
    var datumChip = function (x) { var d = dag0(x.forfaller).getTime(), n = Math.round((d - idag0) / 864e5); return '<span class="lp-arb-datum" data-lage="' + (n < 0 ? 'sen' : n === 0 ? 'idag' : 'snart') + '">' + (n < 0 ? plural(-n, 'dag', 'dagar') + ' sen' : n === 0 ? 'I dag' : n === 1 ? 'I morgon' : kortDatum(new Date(x.forfaller))) + '</span>'; };
    var uppg = st.uppg.slice().sort(function (a, c) { return a.forfaller < c.forfaller ? -1 : 1; });
    return '<section class="kort lp-band2 lp-arbkort" data-in><header class="lp-band2__huvud"><div><p class="ao-ogon">Arbete</p><h2>Aktivitet <em>och arbete</em></h2></div><span class="lp-h2-chip">Senaste 30 dagarna</span></header>' +
      '<div class="lp-arb-trio">' +
        tal('stapel', 'Händelser', nu30, diff ? (diff > 0 ? '+' : '−') + Math.abs(diff) + ' mot förra 30 d' : 'lika många som förra 30 d', diff > 0 ? 'bra' : diff < 0 ? 'gul' : '') +
        (u.roll === 'salj' ? tal('portfolj', 'Öppna affärer', st.oppna.length, IH.kort(st.oppet) + ' sammanlagt') : tal('byggnad', 'Pågående projekt', proj.length, proj.length ? 'i produktion' : 'inga just nu')) +
        tal('todo', 'Att göra', st.uppg.length, st.sena.length ? plural(st.sena.length, 'försenad', 'försenade') : 'inget försenat', st.sena.length ? 'rod' : '') +
      '</div>' +
      '<div class="lp-arb-graf">' + staplar(dagar, 'lp-staplar') +
        '<span class="lp-staplar__axel" aria-hidden="true">' + dagar.map(function (d, k) { if (k === dagar.length - 1) return '<span>i dag</span>'; if (k % 7 || k >= dagar.length - 4) return ''; var t = Math.min(k + 7, dagar.length - 1); if (dagar.length - 1 - t < 4) t = dagar.length - 1; return '<span style="flex:' + (t - k) + '">' + d.dag.getDate() + '/' + (d.dag.getMonth() + 1) + '</span>'; }).join('') + '</span>' +
        (typer.length ? '<div class="lp-typer"><span class="lp-typer__spar">' + typer.map(function (k) { return '<i style="flex:' + per[k].n + ';--f:' + per[k].f + '" title="' + k + ': ' + per[k].n + '"></i>'; }).join('') + '</span><span class="lp-typer__lista">' + typer.map(function (k) { return '<span style="--f:' + per[k].f + '"><i></i>' + k + ' <b>' + per[k].n + '</b></span>'; }).join('') + (svit > 1 ? '<span class="lp-typer__svit">' + IH.emo('trend') + svit + ' dagar i rad</span>' : '') + '</span></div>' : '') +
      '</div>' +
      (u.roll === 'salj' && st.oppna.length ? '<p class="lp-del">Öppna affärer <small>' + st.oppna.length + '</small></p><ul class="lp-arb-lista">' + st.oppna.slice().sort(function (a, c) { return c.varde - a.varde; }).slice(0, 4).map(function (a) {
          var s2 = IH.steg(a.steg), idx = IH.SALJSTEG.indexOf(s2), k = IH.kund(a.kund), dg = IH.dagarSedan(a.andrad);
          return '<li><a href="#/salj/' + a.id + '"><span class="lp-arb-steg" style="--f:' + s2.farg + '" aria-label="' + e(s2.namn) + '">' + IH.SALJSTEG.slice(0, -1).map(function (x, j) { return '<i' + (j <= idx ? ' class="pa"' : '') + '></i>'; }).join('') + '</span>' +
            '<span class="lp-arb-text"><strong>' + e(a.titel) + '</strong><small>' + e(k ? k.namn : '') + ' · ' + e(s2.namn) + ' · ' + IH.sannolikhet(a) + ' % chans' + (dg > 14 ? ' · <b class="still">står still ' + dg + ' d</b>' : '') + '</small></span><strong class="lp-arb-varde">' + IH.kort(a.varde) + '</strong></a></li>';
        }).join('') + '</ul>' : '') +
      '<p class="lp-del">Att göra' + (uppg.length ? ' <small>' + uppg.length + '</small>' : '') + ((ar || IH.jag().chef) ? '<button type="button" class="lp-h2-plus" data-g="' + (ar ? 'lp-egen-uppg' : 'lp-uppgift') + '" data-id="' + u.id + '" title="Ny uppgift" aria-label="Ny uppgift">' + i('plus') + '</button>' : '') + '</p>' +
      (uppg.length ? '<ul class="lp-arb-lista lp-uppg2">' + uppg.slice(0, 5).map(function (x) {
          var k = x.kund && IH.kund(x.kund);
          return '<li>' + (ar ? '<button type="button" class="lp-bock" data-g="lp-klar" data-id="' + x.id + '" title="Markera som klar" aria-label="Markera som klar">' + i('bock') + '</button>' : '<span class="lp-arb-cirkel" aria-hidden="true"></span>') +
            '<a href="#/att-gora"><span class="lp-arb-text"><strong>' + e(x.text) + '</strong><small>' + (k ? e(k.namn) : 'Ingen kund') + '</small></span>' + datumChip(x) + '</a></li>';
        }).join('') + '</ul>' + (uppg.length > 5 ? '<a class="lp-textlank" href="#/att-gora">+' + (uppg.length - 5) + ' till · visa alla</a>' : '') : '<p class="lp-tom">' + IH.emo('klar') + 'Inga öppna uppgifter.</p>') +
      '</section>';
  }
  // Kalendern på profilen (som Uperformance): månad med veckonummer eller hela året, dagens panel med det som är inbokat,
  // ledighet och sjukanmälan. Allt räknas ur datan för den här personen.
  var pk = { man: 0, vy: 'man', dag: null };
  var PK_TYP = { mote: ['Möte', 'var(--t-diagram-4)'], samtal: ['Samtal', 'var(--t-diagram-2)'], mejl: ['Mejl', 'var(--t-diagram-6)'], besok: ['Besök', 'var(--t-diagram-3)'], notis: ['Anteckning', '#c9b48f'], system: ['Aktivitet', '#7fd1b0'], uppg: ['Uppgift', 'var(--t-diagram-5)'], sen: ['Försenad', '#e8806a'], vunnen: ['Vunnen', 'var(--t-kol-accent)'] };
  function pkHandelser(u) {
    var idag = dag0(new Date()).getTime(), ut = [];
    db().aktiviteter.forEach(function (h) { if (h.av === u.id && !h.stod) ut.push({ id: h.id, dag: dag0(h.tid).getTime(), tid: h.tid, typ: PK_TYP[h.typ] ? h.typ : 'system', text: h.text, kund: h.kund, akt: true }); });
    db().uppgifter.forEach(function (x) { if (!x.klar && !x.kalAkt && x.ansvarig === u.id) { var d = dag0(x.forfaller).getTime(); ut.push({ id: x.id, dag: d, tid: x.forfaller, typ: d < idag ? 'sen' : 'uppg', text: x.text, kund: x.kund, uppg: true }); } });
    db().affarer.forEach(function (x) { if (x.steg === 'vunnen' && x.vunnen && x.ansvarig === u.id) ut.push({ id: x.id, dag: dag0(x.vunnen).getTime(), tid: x.vunnen, typ: 'vunnen', text: 'Vunnen: ' + x.titel, kund: x.kund, affar: x.id }); });
    return ut.sort(function (x, y) { return x.tid < y.tid ? -1 : 1; });
  }
  function pkLedig(u, t) { return franvaroLista().find(function (f) { return f.u === u.id && t >= dag0(f.fran).getTime() && t <= dag0(f.till).getTime(); }); }
  function profilKalender(u, ar) {
    var nu = new Date(), idag = dag0(nu).getTime(), alla = pkHandelser(u), kanLeda = kanFranvaro(u.id);
    var valdT = pk.dag ? dag0(new Date(pk.dag + 'T12:00:00')).getTime() : idag;
    var forsta = new Date(nu.getFullYear(), nu.getMonth() + pk.man, 1), man = forsta.getMonth();
    var rubrik = pk.vy === 'ar' ? String(forsta.getFullYear()) : IH.lokal(forsta, 'd', { month: 'long', year: 'numeric' });
    var huvud = '<div class="pk-huvud"><div class="pk-nav"><button type="button" data-g="pk-man" data-d="-1" aria-label="Föregående">' + i('pilv') + '</button><b>' + e(rubrik.charAt(0).toUpperCase() + rubrik.slice(1)) + '</b><button type="button" data-g="pk-man" data-d="1" aria-label="Nästa">' + i('pil') + '</button></div>' +
      (pk.man || pk.dag ? '<button type="button" class="pk-piller" data-g="pk-man" data-d="0">I dag</button>' : '') +
      '<span class="pk-hoger"><span class="pk-seg" role="group" aria-label="Vy"><button type="button" data-g="pk-vy" data-f="man" aria-pressed="' + (pk.vy === 'man') + '">Månad</button><button type="button" data-g="pk-vy" data-f="ar" aria-pressed="' + (pk.vy === 'ar') + '">År</button></span>' +
      '<button type="button" class="pk-piller" data-g="pk-ics" data-id="' + u.id + '">' + i('kalender') + 'Kalenderfil</button></span></div>';
    var yta;
    if (pk.vy === 'ar') {
      yta = '<div class="pk-ar">' + Array.from({ length: 12 }, function (_, m) {
        var f1 = new Date(forsta.getFullYear(), m, 1), st0 = new Date(f1), celler = '', antal = 0; st0.setDate(1 - ((f1.getDay() + 6) % 7));
        for (var n = 0; n < 42; n++) { var d = new Date(st0); d.setDate(st0.getDate() + n); var t = d.getTime(), c = alla.filter(function (x) { return x.dag === t; }).length, led = pkLedig(u, t); if (d.getMonth() === m) antal += c;
          celler += '<i class="' + (d.getMonth() !== m ? 'ut' : '') + (t === idag ? ' idag' : '') + (led ? ' ledig' : '') + (c && d.getMonth() === m ? ' pa' : '') + '" style="--v:' + Math.min(1, c / 3).toFixed(2) + '" title="' + (d.getMonth() === m ? e(kortDatum(d)) + ': ' + plural(c, 'händelse', 'händelser') : '') + '"></i>'; }
        var mn = IH.lokal(f1, 'd', { month: 'long' });
        return '<button type="button" class="pk-arman' + (m === nu.getMonth() && f1.getFullYear() === nu.getFullYear() ? ' nu' : '') + '" data-g="pk-ga-man" data-m="' + m + '" data-y="' + f1.getFullYear() + '"><span><b>' + e(mn.charAt(0).toUpperCase() + mn.slice(1)) + '</b><small>' + antal + '</small></span><span class="pk-arman__rutor">' + celler + '</span></button>';
      }).join('') + '</div>';
    } else {
      var start = new Date(forsta); start.setDate(1 - ((forsta.getDay() + 6) % 7));
      var rader = '';
      for (var v = 0; v < Math.ceil(((forsta.getDay() + 6) % 7 + new Date(forsta.getFullYear(), man + 1, 0).getDate()) / 7); v++) {
        var m0 = new Date(start); m0.setDate(start.getDate() + v * 7);
        rader += '<span class="pk-v">' + veckonr(m0) + '</span>';
        for (var dd = 0; dd < 7; dd++) {
          var d = new Date(m0); d.setDate(m0.getDate() + dd); var t = d.getTime(), h = alla.filter(function (x) { return x.dag === t; }), led = pkLedig(u, t), jobb = t <= idag && h.some(function (x) { return x.akt; });
          rader += '<button type="button" class="pk-dag' + (d.getMonth() !== man ? ' ut' : '') + (t === idag ? ' idag' : '') + (t === valdT ? ' vald' : '') + (d.getDay() % 6 === 0 ? ' helg' : '') + (t < idag ? ' forbi' : '') + '" data-g="pk-dag" data-dag="' + dagISO(d) + '" style="--n:' + (v * 7 + dd) + '">' +
            '<span class="pk-dag__topp"><b>' + d.getDate() + '</b>' + (jobb ? '<i class="pk-jobb" title="Jobbade"></i>' : '') + '</span>' +
            (led ? '<span class="pk-led f-' + led.typ + '">' + e(FRANVARO[led.typ][0]) + '</span>' : '') +
            h.slice(0, led ? 1 : 2).map(function (x) { var k = x.kund && IH.kund(x.kund); return '<span class="pk-h" style="--k:' + PK_TYP[x.typ][1] + '">' + e(PK_TYP[x.typ][0]) + (k ? ' · ' + e(k.namn) : '') + '</span>'; }).join('') +
            (h.length > (led ? 1 : 2) ? '<small class="pk-fler">+' + (h.length - (led ? 1 : 2)) + '</small>' : '') + '</button>';
        }
      }
      yta = '<div class="pk-rutnat"><span class="pk-v pk-v--rubrik">V</span>' + ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(function (x) { return '<span class="pk-vd">' + x + '</span>'; }).join('') + rader + '</div>';
    }
    // dagens panel
    var vd = new Date(valdT), hd = alla.filter(function (x) { return x.dag === valdT; }), ledV = pkLedig(u, valdT);
    var dtxt = IH.lokal(vd, 'd', { weekday: 'long', day: 'numeric', month: 'long' });
    var panel = '<aside class="pk-panel"><h3>' + (valdT === idag ? 'I dag, ' : '') + e(valdT === idag ? dtxt : dtxt.charAt(0).toUpperCase() + dtxt.slice(1)) + '</h3>' +
      (ledV ? '<div class="pk-panel__led f-' + ledV.typ + '">' + IH.emo(FRANVARO[ledV.typ][1]) + '<span><b>' + e(FRANVARO[ledV.typ][0]) + '</b><small>' + kortDatum(new Date(ledV.fran)) + (ledV.till !== ledV.fran ? '–' + kortDatum(new Date(ledV.till)) : '') + '</small></span>' + (kanLeda ? '<button type="button" class="pk-mini" data-g="lp-franvaro" data-fid="' + ledV.id + '" data-uid="' + u.id + '" aria-label="Ändra frånvaron">' + i('skriv') + '</button>' : '') + '</div>' : '') +
      (hd.length ? '<ul class="pk-lista">' + hd.map(function (x, n) {
        var k = x.kund && IH.kund(x.kund), tid = new Date(x.tid), kl = x.akt ? IH.lokal(tid, 't', { hour: '2-digit', minute: '2-digit' }) : '';
        return '<li style="--k:' + PK_TYP[x.typ][1] + ';--n:' + n + '"><span class="pk-lista__typ">' + e(PK_TYP[x.typ][0]) + (kl ? ' · ' + kl : '') + '</span><b>' + e(x.text) + '</b>' + (k ? '<a href="#/kunder/' + k.id + '">' + e(k.namn) + i('pil') + '</a>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="pk-tom">' + i('kalender') + 'Inget inbokat den här dagen.</p>') +
      (kanLeda ? '<button type="button" class="pk-lagg" data-g="pk-ny" data-dag="' + dagISO(vd) + '" data-id="' + u.id + '">' + i('plus') + 'Lägg till den här dagen</button>' : '') +
      '<div class="pk-panel__fot">' + (kanLeda ? '<button type="button" class="pk-knapp pk-knapp--accent" data-g="lp-franvaro" data-uid="' + u.id + '" data-dag="' + dagISO(vd) + '">' + IH.emo('flyg') + 'Lägg in frånvaro</button>' +
        (pkLedig(u, idag) ? '' : '<button type="button" class="pk-knapp" data-g="pk-sjuk" data-id="' + u.id + '">' + IH.emo('termometer') + (ar ? 'Sjukanmäl i dag' : 'Sjukanmäl ' + e(u.namn.split(' ')[0]) + ' i dag') + '</button>') : '') + '</div></aside>';
    var forkl = '<p class="pk-forkl">' + ['mote', 'samtal', 'mejl', 'besok', 'system', 'uppg', 'sen', 'vunnen'].map(function (k) { return '<span style="--k:' + PK_TYP[k][1] + '"><i></i>' + PK_TYP[k][0] + '</span>'; }).join('') + '<span class="pk-forkl__led"><i></i>Frånvaro</span><span class="pk-forkl__jobb"><i></i>Jobbade</span></p>';
    return '<section class="pk kort kort--mork" data-in><header class="pk-titel"><div><p class="etikett">Kalender</p><h2>' + (ar ? 'Min' : e(u.namn.split(' ')[0]) + 's') + ' <em>kalender</em></h2></div>' +
      '<p>' + plural(alla.filter(function (x) { return x.dag >= idag && x.dag < idag + 7 * 864e5; }).length, 'händelse', 'händelser') + ' de kommande 7 dagarna · ' + plural(alla.filter(function (x) { return x.typ === 'sen'; }).length, 'försenad', 'försenade') + '</p></header>' +
      '<div class="pk-kropp"><div class="pk-vanster">' + huvud + yta + forkl + '</div>' + panel + '</div></section>';
  }
  IH.G['pk-man'] = function (el) { var d = +el.getAttribute('data-d'); if (!d) { pk.man = 0; pk.dag = null; } else pk.man += pk.vy === 'ar' ? d * 12 : d; IH.rita(); };
  IH.G['pk-vy'] = function (el) { pk.vy = el.getAttribute('data-f'); IH.rita(); };
  IH.G['pk-ga-man'] = function (el) { var nu = new Date(); pk.man = (+el.getAttribute('data-y') - nu.getFullYear()) * 12 + (+el.getAttribute('data-m') - nu.getMonth()); pk.vy = 'man'; IH.rita(); };
  IH.G['pk-dag'] = function (el) {
    pk.dag = el.getAttribute('data-dag');
    var y = window.scrollY; IH.rita(); window.scrollTo(0, y);
  };
  IH.G['pk-ny'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    IH.oppnaArk({ titel: 'Lägg till i kalendern', ikon: 'kalender', under: 'Möten och samtal loggas på ' + e(u.namn.split(' ')[0]) + ', uppgifter hamnar under Att göra.', kropp: kalForm(el.getAttribute('data-dag'), [{ u: u }]),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('plus') + 'Lägg till</button>' });
  };
  IH.G['pk-sjuk'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    if (!kanFranvaro(u.id)) { IH.toast('Bara chefen eller administratören kan sjukanmäla en kollega', null, 'las'); return; }
    var d = dag0(new Date()); if (pkLedig(u, d.getTime())) return;
    // statusen Sjuk följer av frånvaron (narvaro()), så den försvinner när sjukanmälan tas bort
    franvaroLista().push({ id: 'fv' + Date.now().toString(36), u: u.id, typ: 'sjuk', fran: d.toISOString(), till: d.toISOString() });
    IH.spara(); IH.rita(); IH.uppdateraMeny();
    IH.toast(u.id === IH.jag().id ? 'Du är sjukanmäld i dag' : u.namn + ' är sjukanmäld i dag', u.id === IH.jag().id ? 'Krya på dig! Det syns i Vem jobbar när.' : 'Det syns i Vem jobbar när.', 'termometer');
  };
  IH.G['pk-ics'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    var nu = new Date(), fran = pk.vy === 'ar' ? new Date(nu.getFullYear() + Math.floor((nu.getMonth() + pk.man) / 12), 0, 1) : new Date(nu.getFullYear(), nu.getMonth() + pk.man, 1);
    var till = pk.vy === 'ar' ? new Date(fran.getFullYear() + 1, 0, 1) : new Date(fran.getFullYear(), fran.getMonth() + 1, 1);
    var h = pkHandelser(u).filter(function (x) { return x.dag >= fran.getTime() && x.dag < till.getTime(); });
    franvaroLista().forEach(function (f) { if (f.u === u.id && dag0(f.till).getTime() >= fran.getTime() && dag0(f.fran).getTime() < till.getTime()) h.push({ id: f.id, tid: f.fran, slut: f.till, heldag: true, typ: 'franvaro', text: FRANVARO[f.typ][0] }); });
    var p2 = function (v) { return String(v).padStart(2, '0'); }, f = function (d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + '00Z'; };
    var esc = function (t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\r\n|\r|\n/g, ' '); };
    var rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Legohus//CRM//SV'];
    var dagF = function (d) { return dagISO(d).replace(/-/g, ''); };
    h.forEach(function (x) { var s2 = new Date(x.tid), k = x.kund && IH.kund(x.kund); var slut2 = x.heldag ? new Date(dag0(x.slut).getTime() + 864e5) : null; rader.push('BEGIN:VEVENT', 'UID:' + String(x.id).replace(/[^A-Za-z0-9_-]/g, '') + '@legohus-crm', 'DTSTAMP:' + f(new Date()), x.heldag ? 'DTSTART;VALUE=DATE:' + dagF(s2) : 'DTSTART:' + f(s2), x.heldag ? 'DTEND;VALUE=DATE:' + dagF(slut2) : 'DTEND:' + f(new Date(s2.getTime() + 36e5)), 'SUMMARY:' + esc(x.typ === 'vunnen' || x.typ === 'franvaro' ? x.text : PK_TYP[x.typ][0] + ': ' + x.text), 'DESCRIPTION:' + esc(k ? k.namn : ''), 'END:VEVENT'); });
    rader.push('END:VCALENDAR');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rader.map(IH.icsVik).join('\r\n')], { type: 'text/calendar' }));
    a.download = 'kalender-' + u.namn.split(' ')[0].toLowerCase() + '-' + (pk.vy === 'ar' ? fran.getFullYear() : dagISO(fran).slice(0, 7)) + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Kalenderfilen är klar', plural(h.length, 'händelse', 'händelser') + ' – öppna filen i din kalender.', 'kalender');
  };

  /* 05 Försäljningsledningen #/chef – samma upplägg som Uperformance visaChef: hjälten med verktygen och fyra tal, sedan
     01 Teamet just nu (filter), 02 Vem jobbar när, 03 Teamets kalender, 04 Att agera på (fördela, påminn), 05 Pipeline per
     säljare, 06 Aktivitet 14 dagar och 07 Topplistan 90 dagar. Allt räknas ur datan – inga påhittade siffror. */
  var chefUi = { filter: 'alla', kalVem: 'alla', kalMan: 0, kalTyp: 'alla', kalVy: 'lista', agera: 'alla', topp: 90, narvVecka: 0 };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var pct = function (x) { return Math.round(x * 100) + ' %'; };
  var inom = function (iso, d) { return iso && IH.dagarSedan(iso) < d; };
  var BORTA = ['semester', 'sjuk', 'ledig', 'utbildning', 'offline', 'osynlig'], UPPTAGEN = ['upptagen', 'mote', 'strax', 'lunch', 'ute'];
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
  var kortDatum = function (d) { return d.getDate() + ' ' + IH.lokal(d, 'd', { month: 'short' }).replace('.', ''); };
  var AKT_IKON = { samtal: 'samtal', mejl: 'post', mote: 'kunder', notis: 'anteckning', system: 'blixt' };
  function senasteHandelser(team) {
    var nu = new Date(), l = db().aktiviteter.filter(function (h) { return new Date(h.tid) <= nu && !h.stod && team.some(function (x) { return x.u.id === h.av; }); }).sort(function (a, b) { return new Date(b.tid) - new Date(a.tid); }).slice(0, 4);
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
        return '<button type="button" class="lp-nv__d ' + klass + (t === idagT ? ' idag' : '') + '" data-g="lp-franvaro" data-uid="' + x.u.id + '" data-dag="' + dagISO(d) + '"' + (fr ? ' data-fid="' + fr.id + '"' : '') + ' title="' + e(x.u.namn + ' · ' + IH.lokal(d, 'd', { weekday: 'long', day: 'numeric', month: 'short' }) + ' · ' + titel) + '">' + inne + '</button>';
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
        '<span class="lp-nv__jobbat"><b>' + c.jobbat + '<small>/' + c.schema + '</small></b><i style="--a:' + kvot.toFixed(3) + '"></i>' + (c.borta ? '<small>' + plural(c.borta, 'dag', 'dagar') + ' frånvaro</small>' : kommande ? '<small>planerad frånvaro</small>' : '') + '</span>';
    }).join('');
    // överst: läget i dag och kommande frånvaro
    var bortaIdag = team.filter(function (x) { return franvaroPa(x.u.id, idagT) || BORTA.indexOf(narvaro(x.u.id).id) >= 0; });
    var kommer = franvaroLista().filter(function (f) { return dag0(f.till).getTime() >= idagT && team.some(function (x) { return x.u.id === f.u; }); }).sort(function (a, b) { return new Date(a.fran) - new Date(b.fran); }).slice(0, 4);
    var chips = (bortaIdag.length ? '<span class="lp-nv__chip varm">' + IH.emo('varning') + e(bortaIdag.map(function (x) { return x.u.namn.split(' ')[0]; }).join(', ')) + ' borta i dag</span>' : '<span class="lp-nv__chip ok">' + i('bock') + 'Alla i tjänst i dag</span>') +
      kommer.map(function (f) { var u = IH.anvandare(f.u) || { namn: '' }; return '<button type="button" class="lp-nv__chip f-' + f.typ + '" data-g="lp-franvaro" data-fid="' + f.id + '" data-uid="' + f.u + '" data-dag="' + dagISO(new Date(f.fran)) + '">' + IH.emo(FRANVARO[f.typ][1]) + e(u.namn.split(' ')[0] + ' · ' + FRANVARO[f.typ][0].toLowerCase() + ' ' + kortDatum(new Date(f.fran)) + (f.till !== f.fran ? '–' + kortDatum(new Date(f.till)) : '')) + '</button>'; }).join('');
    return '<div class="lp-nv__topp"><div class="lp-nv__chips">' + chips + '</div><div class="lp-nv__nav"><button type="button" class="ch-ruta" data-g="lp-narv-v" data-d="-1" aria-label="Föregående vecka">' + i('pilv') + '</button><button type="button" class="ap-filter" data-g="lp-narv-v" data-d="0" aria-pressed="' + (chefUi.narvVecka === 0) + '">I dag</button><button type="button" class="ch-ruta" data-g="lp-narv-v" data-d="1" aria-label="Nästa vecka">' + i('pil') + '</button>' +
        '<button type="button" class="knapp knapp--liten" data-g="lp-franvaro">' + i('plus') + 'Frånvaro</button></div></div>' +
      '<div class="lp-nv" style="--dagar:' + dagar.length + '">' + huvud + rader + '</div>' +
      '<p class="lp-teckenforklaring lp-nv__forkl"><span class="jobb"><i></i>Jobbade</span><span class="plan"><i></i>Planerad</span><span class="ingen"><i></i>Ingen aktivitet</span>' + Object.keys(FRANVARO).map(function (k) { return '<span class="f-' + k + '"><i></i>' + FRANVARO[k][0] + '</span>'; }).join('') + '<span class="lp-kal__tips">Klicka på en dag för att lägga in frånvaro.</span></p>';
  }
  // Egen frånvaro får alla lägga in; för en kollega krävs chef eller admin
  var kanFranvaro = function (uid) { var j = IH.jag(); return uid === j.id || !!j.chef || j.roll === 'admin'; };
  // Supportläget: säljarens egen frånvaro (och därmed status) ändras inte, samma spärr som Sjukanmäl (stod.js)
  var stodSparr = function (uid) {
    var u = IH.visarSom && IH.visarSom(); if (!u || uid !== u.id) return false;
    IH.toast('Statusen ändras inte i supportläget', u.namn + ' lägger in sin frånvaro själv.', 'oga-av'); return true;
  };
  // En gammal status (Sjuk/Semester satt i närvaron) nollställs när frånvaron som gav den tas bort eller ändras
  var nollaStatus = function (f) {
    if (IH.visarSom && IH.visarSom()) return;
    var m = lasNarvaro(); if (m[f.u] !== f.typ) return;
    delete m[f.u]; try { localStorage.setItem('ih-crm-narvaro', JSON.stringify(m)); } catch (x) { /* privat läge */ }
    IH.uppdateraMeny();
  };
  IH.G['lp-narv-v'] = function (el) { var d = +el.getAttribute('data-d'); chefUi.narvVecka = d ? chefUi.narvVecka + d : 0; IH.rita(); };
  IH.G['lp-franvaro'] = function (el) {
    var fid = el.getAttribute('data-fid'), f = fid && franvaroLista().find(function (x) { return x.id === fid; });
    var uid = el.getAttribute('data-uid') || (f && f.u) || IH.jag().id, dag = el.getAttribute('data-dag') || dagISO(new Date());
    if (!kanFranvaro(uid)) { IH.toast('Bara chefen eller administratören kan lägga in frånvaro för en kollega', 'Du kan lägga in din egen på din profil.', 'las'); return; }
    if (stodSparr(uid)) return;
    var jag = IH.jag(), team = jag.chef || jag.roll === 'admin' ? IH.ANVANDARE.filter(function (u) { return u.roll !== 'admin' && !u.inaktiv; }) : [jag];
    if (!team.some(function (u) { return u.id === uid; }) && IH.anvandare(uid)) team.push(IH.anvandare(uid));
    IH.oppnaArk({ titel: f ? 'Ändra frånvaro' : 'Lägg in frånvaro', ikon: 'kalender', under: f ? 'Ändra datum eller ta bort frånvaron.' : 'Syns i Vem jobbar när och räknas bort från arbetsdagarna.',
      kropp: '<form id="lp-fv-form" data-lp-franvaro="' + (f ? f.id : '') + '" class="km-form lp-kalform">' +
        '<div class="lp-kalform__typ lp-fv__typ" role="radiogroup" aria-label="Typ">' + Object.keys(FRANVARO).map(function (k, n) { return '<label><input type="radio" name="typ" value="' + k + '"' + ((f ? f.typ === k : n === 0) ? ' checked' : '') + '><span class="f-' + k + '">' + IH.emo(FRANVARO[k][1]) + FRANVARO[k][0] + '</span></label>'; }).join('') + '</div>' +
        '<label class="falt"><span>Vem</span><select name="vem">' + team.map(function (u) { return '<option value="' + u.id + '"' + (u.id === uid ? ' selected' : '') + '>' + e(u.namn) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lp-kalform__rad"><label class="falt"><span>Från</span><input name="fran" type="date" required value="' + (f ? dagISO(new Date(f.fran)) : dag) + '"></label><label class="falt"><span>Till och med</span><input name="till" type="date" required value="' + (f ? dagISO(new Date(f.till)) : dag) + '"></label></div></form>',
      fot: (f ? '<button class="knapp" type="button" data-g="lp-franvaro-bort" data-fid="' + f.id + '">' + i('stang') + 'Ta bort</button>' : '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button>') + '<button class="knapp knapp--virke" type="submit" form="lp-fv-form">' + i('bock') + 'Spara</button>' });
  };
  IH.G['lp-franvaro-bort'] = function (el) {
    var l = franvaroLista(), n = l.findIndex(function (x) { return x.id === el.getAttribute('data-fid'); }); if (n < 0) return;
    if (!kanFranvaro(l[n].u) || stodSparr(l[n].u)) return;
    nollaStatus(l[n]); l.splice(n, 1); IH.spara(); IH.stangArk(); IH.rita(); IH.toast('Frånvaron är borttagen', '', 'kalender');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-lp-franvaro]')) return;
    ev.preventDefault();
    var fran = new Date(t.fran.value + 'T00:00:00'), till = new Date(t.till.value + 'T00:00:00'); if (till < fran) { var x = fran; fran = till; till = x; }
    var id = t.getAttribute('data-lp-franvaro'), l = franvaroLista(), f = id && l.find(function (y) { return y.id === id; });
    if (!kanFranvaro(t.vem.value) || (f && !kanFranvaro(f.u))) { IH.toast('Bara chefen eller administratören kan lägga in frånvaro för en kollega', null, 'las'); return; }
    if (stodSparr(t.vem.value) || (f && stodSparr(f.u))) return;
    // ingen dubbelbokning: en person kan inte ha två frånvaron samma dag
    var krock = l.find(function (y) { return y !== f && y.u === t.vem.value && dag0(y.fran) <= till && dag0(y.till) >= fran; });
    if (krock) { IH.toast('Krockar med en annan frånvaro', FRANVARO[krock.typ][0] + ' ' + kortDatum(new Date(krock.fran)) + (krock.till !== krock.fran ? '–' + kortDatum(new Date(krock.till)) : '') + ' – ändra den i stället.', 'varning'); return; }
    if (!f) { f = { id: 'fv' + Date.now().toString(36) }; l.push(f); } else nollaStatus(f);
    f.u = t.vem.value; f.typ = t.typ.value; f.fran = fran.toISOString(); f.till = till.toISOString();
    IH.spara(); IH.stangArk(); IH.rita();
    var u = IH.anvandare(f.u); IH.toast('Frånvaron är sparad', (u ? u.namn.split(' ')[0] : '') + ' · ' + FRANVARO[f.typ][0].toLowerCase() + ' ' + kortDatum(fran) + (till > fran ? '–' + kortDatum(till) : ''), 'kalender');
  });
  function kalHandelser(team) {
    var vem = function (id) { return chefUi.kalVem === 'alla' ? team.some(function (x) { return x.u.id === id; }) : id === chefUi.kalVem; };
    var typ = function (t) { return chefUi.kalTyp === 'alla' || chefUi.kalTyp === t; };
    var idag = dag0(new Date()).getTime(), ut = [];
    if (typ('akt')) db().aktiviteter.forEach(function (h) { if (h.typ !== 'system' && !h.stod && vem(h.av)) ut.push({ id: h.id, slag: 'akt', dag: dag0(h.tid).getTime(), tid: h.tid, u: h.av, text: h.text, typ: h.typ, kund: h.kund, affar: h.affar }); });
    if (typ('uppg')) db().uppgifter.forEach(function (x) { if (!x.klar && !x.kalAkt && vem(x.ansvarig)) { var d = dag0(x.forfaller).getTime(); ut.push({ id: x.id, slag: 'uppg', dag: d, tid: x.forfaller, u: x.ansvarig, text: x.text, kund: x.kund, affar: x.affar, sen: d < idag }); } });
    if (typ('vunnen')) db().affarer.forEach(function (a) { if (a.steg === 'vunnen' && a.vunnen && vem(a.ansvarig)) ut.push({ id: a.id, slag: 'vunnen', dag: dag0(a.vunnen).getTime(), tid: a.vunnen, u: a.ansvarig, text: 'Vunnen: ' + a.titel, kund: a.kund, affar: a.id }); });
    return ut.sort(function (a, b) { return new Date(a.tid) - new Date(b.tid); });
  }
  var klock = function (iso) { var d = new Date(iso); return d.getHours() || d.getMinutes() ? IH.lokal(d, 't', { hour: '2-digit', minute: '2-digit' }) : ''; };
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
      celler += '<div class="lp-kal__dag' + (d.getMonth() !== man ? ' utanfor' : '') + (d.getTime() === idag ? ' idag' : '') + (iVeckan ? ' vecka' : '') + (d.getTime() < idag ? ' forbi' : '') + (d.getDay() % 6 === 0 ? ' helg' : '') + (h.some(function (x) { return x.sen; }) ? ' sen' : '') + '" style="--last:' + (h.length / mest).toFixed(2) + '" data-g="lp-kal-dag" data-dag="' + ds + '" role="button" tabindex="0" aria-label="' + e(IH.lokal(d, 'd', { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + plural(h.length, 'händelse', 'händelser') + '">' +
        '<span class="lp-kal__topp"><b>' + d.getDate() + '</b>' + (h.length ? '<em>' + h.length + '</em>' : '') + '<i class="lp-kal__plus" data-g="lp-kal-ny" data-dag="' + ds + '" role="button" aria-label="Lägg till ' + e(IH.lokal(d, 'd', { day: 'numeric', month: 'long' })) + '">+</i></span>' +
        h.slice(0, 3).map(function (x) { var u = IH.anvandare(x.u) || { farg: '#ccc', namn: '' }; return '<span class="lp-kal__h" data-typ="' + x.slag + '"' + (x.sen ? ' data-sen' : '') + (x.slag === 'uppg' ? ' draggable="true" data-uppg="' + x.id + '"' : '') + ' style="--av:' + u.farg + '" title="' + e(u.namn + ': ' + x.text) + (x.slag === 'uppg' ? ' – dra till en annan dag för att flytta' : '') + '"><i>' + e(IH.initialer(u.namn).charAt(0)) + '</i>' + (klock(x.tid) && x.slag === 'akt' ? '<time>' + klock(x.tid) + '</time>' : '') + e(x.text) + '</span>'; }).join('') +
        (h.length > 3 ? '<small>+' + (h.length - 3) + ' till</small>' : '') + '</div>';
    }
    var namn = IH.lokal(forsta, 'd', { month: 'long', year: 'numeric' });
    var ledig = null;
    for (var k = 1; k <= 14 && !ledig; k++) { var lk = new Date(idag + k * 864e5 + 3e6); lk = dag0(lk); if (lk.getDay() % 6 === 0) continue; if (!alla.some(function (x) { return x.slag === 'akt' && x.dag === lk.getTime(); }) && !(chefUi.kalVem !== 'alla' && franvaroPa(chefUi.kalVem, lk.getTime()))) ledig = lk; }
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
        '<span>' + (function (n) { return '<b>' + n + '</b> ' + (n === 1 ? 'möte eller samtal' : 'möten och samtal'); })(vecka.filter(function (x) { return x.slag === 'akt'; }).length) + ' de kommande 7 dagarna</span>' +
        (function (n) { return '<span><b>' + n + '</b> ' + (n === 1 ? 'uppgift förfaller' : 'uppgifter förfaller') + '</span>'; })(vecka.filter(function (x) { return x.slag === 'uppg'; }).length) +
        (sena.length ? '<button type="button" class="lp-kal__sena" data-g="lp-kal-sena">' + i('varning') + plural(sena.length, 'försenad uppgift', 'försenade uppgifter') + '</button>' : '<span class="lp-kal__ok">' + i('bock') + 'Inget försenat</span>') +
        (ledig ? '<button type="button" class="lp-kal__ledig" data-g="lp-kal-ny" data-dag="' + (IH.dagStr ? IH.dagStr(ledig) : ledig.toISOString().slice(0, 10)) + '" title="Första vardagen utan möten' + (chefUi.kalVem !== 'alla' ? ' för ' + e((IH.anvandare(chefUi.kalVem) || {}).namn || '') : ' i teamet') + ' – boka något där">' + i('stjarna') + 'Ledig dag: ' + e(IH.lokal(ledig, 'd', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')) + '</button>' : '') +
        '<span class="lp-kal__typer">' + chip('alla', 'Allt') + chip('akt', 'Möten och samtal') + chip('uppg', 'Uppgifter') + chip('vunnen', 'Vunna') + '</span>' +
        '<button type="button" class="ap-filter" data-g="lp-kal-ics" title="Ladda ner månadens händelser som kalenderfil">' + i('kalender') + 'Kalenderfil</button>' +
      '</div>' +
      (chefUi.kalVy === 'lista' ? kalLista(alla, chefUi.kalMan ? forsta.getTime() : idag, chefUi.kalMan ? new Date(forsta.getFullYear(), forsta.getMonth() + 1, 1).getTime() : idag + 30 * 864e5) :
      '<div class="lp-kal" data-lp-kal-ytan><span>Må</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lö</span><span>Sö</span>' + celler + '</div>') +
      '<p class="lp-teckenforklaring lp-kal__forkl"><span data-typ="akt"><i></i>Möten, samtal och mejl</span><span data-typ="uppg"><i></i>Uppgift förfaller</span><span data-typ="sen"><i></i>Försenad</span><span data-typ="vunnen"><i></i>Vunnen affär</span><span class="lp-kal__tips">Klicka på en dag för att läsa allt, eller på + för att lägga till.</span></p>';
  }
  function kalLista(alla, fran, till) {
    // försenade uppgifter följer bara med när perioden innehåller i dag
    var idag = dag0(new Date()).getTime(), medSena = fran <= idag && idag < till;
    var dagar = {}; alla.forEach(function (x) { if (x.dag >= fran && x.dag < till || x.sen && medSena) (dagar[x.dag] = dagar[x.dag] || []).push(x); });
    var nycklar = Object.keys(dagar).map(Number).sort(function (a, b) { return a - b; });
    if (!nycklar.length) return '<p class="lp-tom">Inget inplanerat i den här perioden.</p>';
    return '<div class="lp-agenda">' + nycklar.map(function (t) {
      var d = new Date(t), sen = dagar[t].some(function (x) { return x.sen; }), rel = t === idag ? 'I dag' : t === idag + 864e5 ? 'I morgon' : sen ? 'Försenat' : '';
      return '<section class="lp-agenda__dag' + (t === idag ? ' idag' : '') + (sen ? ' sen' : '') + '"><header><b>' + d.getDate() + '</b><span>' + e(IH.lokal(d, 'd', { weekday: 'long' })) + '<small>' + e(IH.lokal(d, 'd', { month: 'long' })) + (rel ? ' · ' + rel : '') + '</small></span>' +
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
      '<span class="lp-dagrad__knappar">' + (x.slag === 'akt' && (x.typ === 'mote' || x.typ === 'samtal') ? '<button type="button" class="ap-filter" data-g="lp-kal-andra" data-id="' + x.id + '">' + i('skriv') + 'Ändra</button><button type="button" class="ch-ruta" data-g="lp-kal-bort" data-id="' + x.id + '" title="Ta bort" aria-label="Ta bort">' + i('stang') + '</button>' : '') + (x.slag === 'uppg' ? '<button type="button" class="ap-filter" data-g="lp-kal-klar" data-id="' + x.id + '">' + i('bock') + 'Klar</button><button type="button" class="ch-ruta" data-g="lp-kal-flytta" data-id="' + x.id + '" title="Flytta en dag framåt" aria-label="Flytta en dag framåt">' + i('pil') + '</button>' : '') + '</span></li>';
  }
  // h = ett befintligt möte eller samtal som ändras (då finns inte Uppgift som typ)
  function kalForm(ds, team, h) {
    var jag = IH.jag(), vem = h ? h.av : chefUi.kalVem !== 'alla' ? chefUi.kalVem : jag.id, d = h && new Date(h.tid);
    if (h && !team.some(function (x) { return x.u.id === h.av; }) && IH.anvandare(h.av)) team = team.concat([{ u: IH.anvandare(h.av) }]);
    return '<form id="lp-kal-form" data-lp-kal="' + (h ? h.id : '') + '" class="km-form lp-kalform">' +
      '<div class="lp-kalform__typ" role="radiogroup" aria-label="Typ">' + [['mote', 'Möte', 'motesikon'], ['samtal', 'Samtal', 'samtal'], ['uppgift', 'Uppgift', 'uppgift']].filter(function (t) { return !h || t[0] !== 'uppgift'; }).map(function (t, n) {
        return '<label><input type="radio" name="typ" value="' + t[0] + '"' + ((h ? h.typ === t[0] : n === 0) ? ' checked' : '') + '><span>' + i(t[2]) + t[1] + '</span></label>'; }).join('') + '</div>' +
      '<label class="falt"><span>Vad</span><input name="text" required maxlength="120" value="' + e(h ? h.text : '') + '" placeholder="T.ex. Platsbesök hos kunden"></label>' +
      '<div class="lp-kalform__rad"><label class="falt"><span>Dag</span><input name="datum" type="date" required value="' + (d ? dagISO(d) : ds) + '"></label><label class="falt"><span>Tid</span><input name="tid" type="time" value="' + (d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '10:00') + '"></label></div>' +
      '<div class="lp-kalform__rad"><label class="falt"><span>Vem</span><select name="vem">' + team.map(function (x) { return '<option value="' + x.u.id + '"' + (x.u.id === vem ? ' selected' : '') + '>' + e(x.u.namn) + '</option>'; }).join('') + '</select></label>' +
      '<label class="falt"><span>Kund (valfritt)</span><select name="kund"><option value="">Ingen</option>' + db().kunder.map(function (k) { return '<option value="' + k.id + '"' + (h && h.kund === k.id ? ' selected' : '') + '>' + e(k.namn) + '</option>'; }).join('') + '</select></label></div></form>';
  }
  var kalTeam = function () { return IH.ANVANDARE.filter(function (u) { return u.roll === 'salj' && !u.inaktiv; }).map(function (u) { return { u: u }; }); };
  function kalDag(ds) {
    var team = kalTeam(), d = new Date(ds + 'T12:00:00'), dt = dag0(d).getTime();
    var h = kalHandelser(team).filter(function (x) { return x.dag === dt; });
    IH.oppnaArk({ titel: IH.lokal(d, 'd', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, function (c) { return c.toUpperCase(); }), ikon: 'kalender',
      under: h.length ? plural(h.length, 'händelse', 'händelser') + (chefUi.kalVem !== 'alla' ? ' för ' + e((IH.anvandare(chefUi.kalVem) || {}).namn || '') : ' för teamet') : 'Inget inplanerat än.',
      kropp: (h.length ? '<ul class="lp-daglista" data-dag="' + ds + '">' + h.map(kalRad).join('') + '</ul>' : '<p class="lp-tom">Dagen är tom – lägg till något nedan.</p>') + '<h3 class="lp-kalform__rubrik">Lägg till den här dagen</h3>' + kalForm(ds, team),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('plus') + 'Lägg till</button>' });
  }
  IH.G['lp-kal-dag'] = function (el) { kalDag(el.getAttribute('data-dag')); };
  IH.G['lp-kal-ny'] = function (el) {
    var ds = el.getAttribute('data-dag') || (IH.dagStr ? IH.dagStr(new Date()) : new Date().toISOString().slice(0, 10));
    IH.oppnaArk({ titel: 'Lägg till i kalendern', ikon: 'kalender', under: 'Möten och samtal loggas på personen, uppgifter hamnar under Att göra.', kropp: kalForm(ds, kalTeam()),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('plus') + 'Lägg till</button>' });
  };
  var aktiviteten = function (id) { return db().aktiviteter.find(function (x) { return x.id === id; }) || null; };
  IH.G['lp-kal-andra'] = function (el) {
    var h = aktiviteten(el.getAttribute('data-id')); if (!h) return;
    IH.oppnaArk({ titel: 'Ändra ' + (h.typ === 'samtal' ? 'samtalet' : 'mötet'), ikon: 'kalender', under: 'Flytta till en annan dag eller tid, byt person eller kund.', kropp: kalForm(dagISO(new Date(h.tid)), kalTeam(), h),
      fot: '<button class="knapp" type="button" data-g="lp-kal-bort" data-id="' + h.id + '">' + i('stang') + 'Ta bort</button><button class="knapp knapp--virke" type="submit" form="lp-kal-form">' + i('bock') + 'Spara</button>' });
  };
  // Ta bort kräver två tryck: först frågar knappen, sedan tas mötet och dess påminnelse under Att göra bort
  IH.G['lp-kal-bort'] = function (el) {
    var h = aktiviteten(el.getAttribute('data-id')); if (!h) return;
    if (!el.hasAttribute('data-saker')) { el.setAttribute('data-saker', ''); el.setAttribute('aria-label', 'Klicka igen för att ta bort'); el.title = 'Klicka igen för att ta bort'; if (el.textContent.trim()) el.innerHTML = i('stang') + 'Klicka igen för att ta bort'; else el.classList.add('lp-saker'); return; }
    db().aktiviteter.splice(db().aktiviteter.indexOf(h), 1);
    db().uppgifter = db().uppgifter.filter(function (x) { return !(x.kalAkt === h.id && !x.klar); });
    var lista = el.closest('.lp-daglista'), ds = lista && lista.getAttribute('data-dag');
    IH.stangArk(); omRita(); if (ds) kalDag(ds);
    IH.toast((h.typ === 'samtal' ? 'Samtalet' : 'Mötet') + ' är borttaget', h.text, 'kalender');
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
    IH.toast('Flyttad', u.text + ' – ' + IH.lokal(ny, 'd', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '') + '.', 'kalender');
  });
  IH.G['lp-kal-sena'] = function () {
    var sena = kalHandelser(kalTeam()).filter(function (x) { return x.sen; });
    IH.oppnaArk({ titel: 'Försenade uppgifter', ikon: 'varning', under: plural(sena.length, 'uppgift', 'uppgifter') + ' har passerat sitt datum.',
      kropp: '<ul class="lp-daglista" data-sena>' + sena.map(function (x) { var r = kalRad(x); return r.replace('<small>', '<small>' + e(IH.lokal(new Date(x.tid), 'd', { day: 'numeric', month: 'short' })) + ' · '); }).join('') + '</ul>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Stäng</button><button class="knapp knapp--virke" type="button" data-g="lp-kal-allaidag">' + i('kalender') + 'Flytta alla till i dag</button>' });
  };
  var omRita = function (ark) { IH.spara(); IH.uppdateraMeny(); IH.rita(); if (ark) ark(); };
  IH.G['lp-kal-klar'] = function (el) {
    var u = db().uppgifter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!u) return;
    u.klar = true; u.klarTid = new Date().toISOString();
    var rad = el.closest('.lp-dagrad'); if (rad) { rad.classList.add('klar'); setTimeout(function () { rad.remove(); }, 380); }
    omRita(); IH.toast('Klar', u.text, 'bock'); efterRad(el);
  };
  // Efter Klar eller Flytta i ett ark: dagens ark ritas om för samma dag, arket Försenade stängs först när det är tomt
  function efterRad(el) {
    var lista = el.closest('.lp-daglista'), ds = lista && lista.getAttribute('data-dag');
    if (ds) setTimeout(function () { kalDag(ds); }, 420);
    else if (lista && lista.hasAttribute('data-sena')) setTimeout(function () { if (!lista.querySelector('.lp-dagrad')) IH.stangArk(); }, 420);
  }
  IH.G['lp-kal-flytta'] = function (el) {
    var u = db().uppgifter.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!u) return;
    var d = new Date(u.forfaller), idag = dag0(new Date()); if (d < idag) d = new Date(idag.getTime() + 9 * 36e5); d.setDate(d.getDate() + 1); u.forfaller = d.toISOString();
    var rad = el.closest('.lp-dagrad'); if (rad) { rad.classList.add('klar'); setTimeout(function () { rad.remove(); }, 380); }
    omRita(); efterRad(el);
    IH.toast('Flyttad', u.text + ' – nu ' + IH.lokal(d, 'd', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '') + '.', 'kalender');
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
    var vemFv = function (uid) { return chefUi.kalVem === 'alla' ? kalTeam().some(function (x) { return x.u.id === uid; }) : uid === chefUi.kalVem; };
    franvaroLista().forEach(function (fv) { if (vemFv(fv.u) && dag0(fv.till).getTime() >= forsta.getTime() && dag0(fv.fran).getTime() < sista.getTime()) h.push({ id: fv.id, tid: fv.fran, slut: fv.till, heldag: true, u: fv.u, text: ((IH.anvandare(fv.u) || {}).namn || '') + ': ' + FRANVARO[fv.typ][0], slag: 'franvaro' }); });
    var p2 = function (v) { return String(v).padStart(2, '0'); }, f = function (d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + '00Z'; };
    var esc = function (t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\r\n|\r|\n/g, ' '); };
    var dagF = function (d) { return dagISO(d).replace(/-/g, ''); };
    var rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Legohus//CRM//SV'];
    h.forEach(function (x) { var s = new Date(x.tid), u = IH.anvandare(x.u); rader.push('BEGIN:VEVENT', 'UID:' + String(x.id).replace(/[^A-Za-z0-9_-]/g, '') + '@legohus-crm', 'DTSTAMP:' + f(new Date()), x.heldag ? 'DTSTART;VALUE=DATE:' + dagF(s) : 'DTSTART:' + f(s), x.heldag ? 'DTEND;VALUE=DATE:' + dagF(new Date(dag0(x.slut).getTime() + 864e5 + 3e6)) : 'DTEND:' + f(new Date(s.getTime() + 36e5)), 'SUMMARY:' + esc(x.text), 'DESCRIPTION:' + esc((u ? u.namn : '') + ' · ' + (x.heldag ? 'Frånvaro' : KAL_TYP[x.slag] || '')), 'END:VEVENT'); });
    rader.push('END:VCALENDAR');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rader.map(IH.icsVik).join('\r\n')], { type: 'text/calendar' }));
    a.download = 'teamets-kalender-' + dagISO(forsta).slice(0, 7) + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Kalenderfilen är klar', plural(h.length, 'händelse', 'händelser') + ' – öppna filen i din kalender.', 'kalender');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-lp-kal]')) return;
    ev.preventDefault();
    var text = t.text.value.trim(), u = IH.anvandare(t.vem.value); if (!text || !u) return;
    var nar = new Date(t.datum.value + 'T' + (t.tid.value || '09:00') + ':00'), typ = t.typ.value, kund = t.kund.value || null;
    var andraId = t.getAttribute('data-lp-kal'), gammal = andraId && aktiviteten(andraId);
    if (gammal) {
      // ändrat möte: aktiviteten och påminnelsen under Att göra följer med
      gammal.tid = nar.toISOString(); gammal.typ = typ; gammal.text = text; gammal.kund = kund; gammal.av = u.id;
      db().uppgifter = db().uppgifter.filter(function (x) { return !(x.kalAkt === gammal.id && !x.klar); });
      if (nar > new Date()) db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: (typ === 'mote' ? 'Möte: ' : 'Samtal: ') + text, forfaller: nar.toISOString(), klar: false, kund: kund, affar: gammal.affar || null, ansvarig: u.id, av: IH.jag().id, kalAkt: gammal.id });
      var nu0 = new Date(); chefUi.kalMan = (nar.getFullYear() - nu0.getFullYear()) * 12 + nar.getMonth() - nu0.getMonth();
      IH.stangArk(); omRita();
      IH.toast('Ändrat i kalendern', text + ' · ' + IH.lokal(nar, 'd', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''), 'kalender');
      return;
    }
    if (typ === 'uppgift') db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text, forfaller: nar.toISOString(), klar: false, kund: kund, affar: null, ansvarig: u.id, av: IH.jag().id });
    else {
      var aid = IH.nyttId('aktivitet', 'h');
      db().aktiviteter.push({ id: aid, tid: nar.toISOString(), typ: typ, text: text, kund: kund, affar: null, av: u.id });
      if (nar > new Date()) db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: (typ === 'mote' ? 'Möte: ' : 'Samtal: ') + text, forfaller: nar.toISOString(), klar: false, kund: kund, affar: null, ansvarig: u.id, av: IH.jag().id, kalAkt: aid });
      IH.uppdateraMeny();
    }
    // hoppa till månaden där det hamnade så att man ser det
    var nu = new Date(); chefUi.kalMan = (nar.getFullYear() - nu.getFullYear()) * 12 + nar.getMonth() - nu.getMonth();
    IH.stangArk(); omRita();
    IH.toast(typ === 'uppgift' ? 'Uppgiften är tillagd' : 'Inlagt i kalendern', text + ' · ' + IH.lokal(nar, 'd', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''), 'kalender');
  });

  // Himlen i hjälten efter tiden på dygnet, fritt i kortet utan ram: en mjuk ljusglöd som tonar ut i kortets bakgrund,
  // solen med andande halo och långsamt roterande strålar (morgon lägre och varmare, dag högre och ljusare),
  // månskära med tindrande stjärnor och ett stjärnfall ibland på kvällen och natten, och mjuka moln i två lager.
  // Samma himmel i översiktens hjälte och i chefhjälten. Faserna följer översiktens dygn().
  function dygnFas(h) { return h < 5 || h >= 22 ? 'natt' : h < 10 ? 'morgon' : h < 18 ? 'dag' : 'kvall'; }
  function himlen(h) {
    var fas = dygnFas(h), molnet = function (lager) { return '<span class="hm-moln hm-moln--' + lager + '"><i></i></span>'; };
    var inre;
    if (fas === 'natt' || fas === 'kvall') {
      // [vänster %, topp %, storlek px, takt s, fördröjning s, gnistra]
      var stjarnor = [[12, 20, 3, 5.2, 0, 1], [30, 8, 2, 6.8, 1.4], [86, 14, 2.4, 4.6, 2.2], [94, 52, 2, 7.4, .6], [20, 62, 1.6, 6.2, 3.1], [72, 82, 1.8, 5.6, 1.9],
        [46, 4, 1.6, 7.8, 2.7], [8, 44, 1.4, 6.4, 4.2], [78, 4, 3, 6, 3.6, 1], [58, 92, 1.4, 7, .3], [38, 30, 1.2, 8.4, 5], [98, 30, 1.6, 5.8, 4.6]];
      if (fas === 'kvall') stjarnor = stjarnor.filter(function (st, n) { return n % 2 === 0; });
      inre = '<span class="hm-stjarnor">' + stjarnor.map(function (st) {
        return '<i class="hm-stjarna' + (st[5] ? ' hm-stjarna--gnista' : '') + '" style="left:' + st[0] + '%;top:' + st[1] + '%;--s:' + st[2] + 'px;--t:' + st[3] + 's;--f:-' + st[4] + 's"></i>';
      }).join('') + '</span>' + (fas === 'natt' ? '<i class="hm-fall"></i>' : '') +
        '<span class="hm-mane"><i class="hm-mane__halo"></i><span class="hm-mane__kropp"><i class="hm-mane__sken"></i><i class="hm-mane__skara"></i></span></span>';
    } else {
      inre = '<span class="hm-sol"><i class="hm-sol__stralar"></i><i class="hm-sol__halo"></i><i class="hm-sol__skiva"></i></span>';
    }
    return '<span class="lp-himmel hm hm--' + fas + '" data-fas="' + fas + '" aria-hidden="true"><i class="hm-ljus"></i>' + molnet('bak') + inre + molnet('fram') + '</span>';
  }
  IH.dygnFas = dygnFas;
  IH.himlen = himlen;
  IH.vyer.chef = function () {
    var jag = IH.jag();
    if (!jag.chef) return { titel: 'Försäljningsledning', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort lp-kort"><h2>' + IH.emo('las') + 'Bara för försäljningschefen</h2><p class="lp-tom">Administratören kan göra en säljare till försäljningschef med Ändra i adminpanelen.</p></section>' };
    // summorna räknar med inaktiverade säljare också – deras ordrar och affärer finns kvar; korten visar bara de aktiva
    var allaS = saljare().map(stat), team = allaS.filter(function (x) { return !x.u.inaktiv; });
    var sum = function (f) { return allaS.reduce(function (t, x) { return t + f(x); }, 0); };
    allaS.forEach(function (x) {
      x.vunna90 = x.aff.filter(function (a) { return a.steg === 'vunnen' && inom(a.vunnen, 90); });
      x.vunnet90 = x.vunna90.reduce(function (t, a) { return t + (a.varde || 0); }, 0);
      x.forlorade90 = x.forlorade.filter(function (a) { return inom(a.andrad, 90); }).length;
      x.malKvartal = x.u.mal && !x.u.inaktiv ? x.u.mal / 4 : 0;
      var kv0 = new Date(); kv0 = new Date(kv0.getFullYear(), Math.floor(kv0.getMonth() / 3) * 3, 1);
      x.vunnetKv = x.vunna.filter(function (a) { return a.vunnen && new Date(a.vunnen) >= kv0; }).reduce(function (t, a) { return t + (a.varde || 0); }, 0);
    });
    var tot = { pipeline: sum(function (x) { return x.oppet; }), viktat: sum(function (x) { return x.viktat; }), vunnet: sum(function (x) { return x.vunnet90; }), mal: sum(function (x) { return x.malKvartal; }), vunnetMal: sum(function (x) { return x.malKvartal ? x.vunnetKv : 0; }), vunnetKv: sum(function (x) { return x.vunnetKv; }), ordrar: sum(function (x) { return x.vunna90.length; }) };
    var medMal = team.filter(function (x) { return x.malKvartal; }).length;
    var avgjorda = sum(function (x) { return x.vunna90.length + x.forlorade90; }), vg = avgjorda ? sum(function (x) { return x.vunna90.length; }) / avgjorda : null;
    var bortaIdag = function (id) { return BORTA.indexOf(narvaro(id).id) >= 0 || !!franvaroPa(id, dag0(new Date()).getTime()); };
    var aktivaNu = team.filter(function (x) { return !bortaIdag(x.u.id); }).length;
    var oppnaN = sum(function (x) { return x.oppna.length; });
    var utan = db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad && (!a.ansvarig || !IH.anvandare(a.ansvarig) || IH.anvandare(a.ansvarig).inaktiv); });
    var h = new Date().getHours(), hals = IH.hej();
    var tal = function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + (x.ton || 'is') + '"><span class="ao-tal__ikon">' + IH.emo(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(x.varde) + '</strong><em>' + e(x.under) + '</em>' + (x.andel != null ? '<span class="lp-glasmatare" style="--andel:' + x.andel.toFixed(3) + '"><i></i></span>' : '') + '</span></' + (x.href ? 'a' : 'div') + '>'; };
    // kvartalsringen: vunnet mot teamets kvartalsmål, eller vinstgraden om inget mål är satt
    var ringPct = tot.mal ? tot.vunnetMal / tot.mal : vg || 0, ringAndel = Math.min(1, ringPct);
    var man0 = dag0(new Date()); man0.setDate(man0.getDate() - (man0.getDay() + 6) % 7);
    var veckaStart = function (w) { var d = new Date(man0); d.setDate(man0.getDate() - w * 7); return d; };
    var veckorV = []; for (var w = 11; w >= 0; w--) { var vs = veckaStart(w), ve = veckaStart(w - 1); veckorV.push(allaS.reduce(function (t, x) { return t + x.aff.filter(function (a) { return a.steg === 'vunnen' && a.vunnen && new Date(a.vunnen) >= vs && new Date(a.vunnen) < ve; }).reduce(function (s2, a) { return s2 + (a.varde || 0); }, 0); }, 0)); }
    var maxV = Math.max.apply(null, veckorV.concat([1]));
    var ring = '<div class="lp-ring" style="--a:' + ringAndel.toFixed(3) + '"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="lp-ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--t-3d-lykta)"/><stop offset="1" style="stop-color:var(--t-accent)"/></linearGradient></defs>' +
      '<circle cx="60" cy="60" r="50" class="lp-ring__spar"/><circle cx="60" cy="60" r="50" class="lp-ring__glod"/><circle cx="60" cy="60" r="50" class="lp-ring__bage"/></svg>' +
      '<div class="lp-ring__mitt"><b>' + Math.round(ringPct * 100) + ' %</b><small>' + (tot.mal ? 'av kvartalsmålet' : 'vinstgrad 90 d') + '</small>' + (tot.mal ? '<em>' + IH.kort(tot.vunnetMal) + ' / ' + IH.kort(tot.mal) + (medMal < team.length ? ' · ' + medMal + ' av ' + team.length + ' med mål' : '') + '</em>' : '<em>Sätt mål för att följa kvartalet</em>') + '</div></div>';
    var lag = '<div class="lp-lag">' + team.map(function (x) { var n = narvaro(x.u.id); return '<a href="#/profil/' + x.u.id + '" title="' + e(x.u.namn) + ': ' + e(n.namn) + ' · ' + IH.kort(x.oppet) + ' öppet">' + avatar(x.u) + '</a>'; }).join('') + '<span>' + plural(aktivaNu, 'i tjänst', 'i tjänst') + '</span></div>';
    var veckoStaplar = '<div class="lp-veckor"><small>Vunnet per vecka · 12 veckor · ' + IH.kort(veckorV.reduce(function (t, v) { return t + v; }, 0)) + '</small><span class="lp-veckor__staplar">' + veckorV.map(function (v, n) {
      var vnr = veckonr(veckaStart(11 - n));
      return '<span title="Vecka ' + vnr + (n === 11 ? ' (den här veckan)' : '') + ': ' + (v ? IH.kr(v) : 'inget vunnet') + '"><em>' + (v ? IH.kort(v) : '') + '</em><i style="--h:' + (v / maxV).toFixed(3) + ';--n:' + n + '" class="' + (v ? 'pa' : '') + (n === 11 ? ' nu' : '') + '"></i><small' + ((11 - n) % 2 ? ' class="udda"' : '') + '>v' + vnr + '</small></span>'; }).join('') + '</span></div>';
    var hjalte = '<section class="ap-hjalte ao-hjalte kort lp-chefhjalte lp-mork"><div class="sh-rutnat" aria-hidden="true"></div><i class="lp-mork__glod" aria-hidden="true"></i><i class="lp-mork__glod lp-mork__glod--2" aria-hidden="true"></i>' + himlen(h) +
      '<div class="ao-text"><p class="etikett"><i class="sh-live"></i>Försäljningsledning · live ur CRM:et</p><h1>' + hals + ', ' + e(jag.namn.split(' ')[0]) + '. <em>Så går teamet.</em></h1>' +
        '<p class="ao-ingress">' + plural(team.length, 'säljare', 'säljare') + ' · ' + aktivaNu + ' i tjänst nu · ' + plural(oppnaN, 'öppen affär', 'öppna affärer') + (utan.length ? ' · <strong class="lp-varm">' + plural(utan.length, 'affär', 'affärer') + ' utan ansvarig</strong>' : '') + '</p>' +
        '<div class="sh-knappar"><button type="button" class="sh-knapp sh-knapp--accent" data-g="km-nytt-konto">' + IH.emo('anvandare-plus') + '<span>Nytt konto</span></button>' +
          '<button type="button" class="sh-knapp" data-g="lp-mal">' + IH.emo('mal') + '<span>Sätt mål</span></button><button type="button" class="sh-knapp" data-g="lp-uppgift">' + IH.emo('todo') + '<span>Ge uppgift</span></button>' +
          '<button type="button" class="sh-knapp" data-g="lp-rapport">' + IH.emo('ladda-ner') + '<span>Exportera rapport</span></button></div></div>' +
      '<div class="ap-tal">' + [
        { ikon: 'portfolj', etikett: 'Öppna affärer', varde: IH.kort(tot.pipeline), under: plural(oppnaN, 'affär', 'affärer'), href: '#/salj', ton: 'lila' },
        { ikon: 'stapel', etikett: 'Viktad prognos', varde: IH.kort(tot.viktat), under: 'värde × chans', ton: 'is' },
        { ikon: 'medalj', etikett: 'Vunnet 90 d', varde: IH.kort(tot.vunnet), under: plural(tot.ordrar, 'vunnen affär', 'vunna affärer') + ' · ' + IH.kort(tot.vunnetKv) + ' hittills i kvartalet', ton: 'gron' },
        { ikon: 'trend', etikett: 'Vinstgrad 90 d', varde: vg == null ? '–' : pct(vg), under: 'vunna av avgjorda affärer', ton: 'gul' }
      ].map(tal).join('') + '</div>' + '<div class="lp-mork__mitt">' + ring + lag + '</div>' + veckoStaplar + '</section>';

    // 01 Teamet just nu
    var vald = team.filter(function (x) { var s = narvaro(x.u.id).id; return chefUi.filter === 'alla' || (chefUi.filter === 'tillganglig' ? s === 'online' && !bortaIdag(x.u.id) : chefUi.filter === 'upptagen' ? UPPTAGEN.indexOf(s) >= 0 && !bortaIdag(x.u.id) : bortaIdag(x.u.id)); });
    var kort = vald.map(function (x) {
      var n = narvaro(x.u.id), varn = [];
      if (x.stilla.length) varn.push(plural(x.stilla.length, 'affär står still', 'affärer står still'));
      if (x.sena.length) varn.push(plural(x.sena.length, 'försenad uppgift', 'försenade uppgifter'));
      var perSteg = IH.SALJSTEG.slice(0, -1).map(function (s) { return { s: s, l: x.oppna.filter(function (a) { return a.steg === s.id; }) }; });
      var maxS = Math.max.apply(null, perSteg.map(function (p) { return p.l.length; }).concat([1]));
      var senast = x.akt.filter(function (h) { return new Date(h.tid) <= new Date(); }).sort(function (a, b) { return new Date(b.tid) - new Date(a.tid); })[0];
      var stegIx = function (a) { return IH.SALJSTEG.findIndex(function (s2) { return s2.id === a.steg; }); };
      var nasta = x.oppna.slice().sort(function (a, b) { return stegIx(b) - stegIx(a) || (b.varde || 0) - (a.varde || 0); })[0];
      return '<article class="lp-saljare">' +
        '<header>' + avatar(x.u) + '<div><a href="#/profil/' + x.u.id + '"><b>' + e(x.u.namn) + '</b></a><small style="--n:' + n.farg + '"><i></i>' + e(n.namn) + (x.u.chef ? ' · Chef' : '') + (senast ? ' · ' + e(senastFor(x.u).nu ? 'aktiv nu' : 'aktiv ' + IH.sedan(senast.tid)) : '') + '</small></div>' +
          '<span class="lp-saljare__last" title="Öppna affärer just nu">' + plural(x.oppna.length, 'affär', 'affärer') + '</span></header>' +
        '<div class="lp-saljare__tal"><div><small>Öppet</small><b class="tal">' + IH.kort(x.oppet) + '</b></div><div><small>Viktat</small><b class="tal">' + IH.kort(x.viktat) + '</b></div><div><small>Vunnet 90 d</small><b class="tal">' + IH.kort(x.vunnet90) + '</b></div></div>' +
        (x.malKvartal ? '<p class="lp-saljare__mal">' + pct(x.vunnetKv / x.malKvartal) + ' av kvartalsmålet ' + IH.kort(x.malKvartal) + '<span class="lp-mal__spar"><i style="--a:' + Math.min(1, x.vunnetKv / x.malKvartal).toFixed(3) + '"></i></span></p>' : '<p class="lp-saljare__mal lp-saljare__mal--tom">Inget mål satt · <button type="button" class="lp-lank" data-g="lp-mal" data-id="' + x.u.id + '">Sätt mål</button></p>') +
        '<ul class="lp-perSteg">' + perSteg.map(function (p) {
          return '<li style="--f:' + p.s.farg + ';--a:' + (p.l.length / maxS).toFixed(3) + '" title="' + e(p.s.namn) + ': ' + plural(p.l.length, 'affär', 'affärer') + (p.l.length ? ' · ' + IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) + ' · ' + e(p.l.map(function (a) { return a.titel; }).slice(0, 3).join(', ')) : '') + '"><span>' + e(p.s.kort) + '</span><i></i><b>' + p.l.length + '</b><small>' + (p.l.length ? IH.kort(p.l.reduce(function (t, a) { return t + a.varde; }, 0)) : '–') + '</small></li>';
        }).join('') + '</ul>' +
        (nasta ? '<a class="lp-nasta" href="#/salj/' + nasta.id + '"><small>Närmast avslut</small><b>' + e(nasta.titel) + '</b><span>' + e(IH.steg(nasta.steg).namn) + ' · ' + IH.kort(nasta.varde || 0) + '</span>' + i('pil') + '</a>' : '') +
        '<div class="lp-vecka"><small>Aktivitet 7 dagar<em>' + plural(perDag(x.akt, 7).reduce(function (t, y) { return t + y.antal; }, 0), 'händelse', 'händelser') + '</em></small>' + staplar(perDag(x.akt, 7), 'lp-staplar lp-staplar--liten') +
          '<span class="lp-vecka__dagar" aria-hidden="true">' + perDag(x.akt, 7).map(function (y) { return '<span class="' + (y.dag.getTime() === dag0(new Date()).getTime() ? 'idag' : '') + '">' + VECKODAG[y.dag.getDay()] + '</span>'; }).join('') + '</span></div>' +
        (varn.length ? '<p class="lp-varning">' + IH.emo('varning') + e(varn.join(' · ')) + '</p>' : '<p class="lp-lugnt">' + IH.emo('klar') + 'Inget som väntar</p>') +
        '<footer><a class="knapp knapp--liten" href="#/profil/' + x.u.id + '">' + i('kunder') + 'Profil</a>' +
          '<button class="knapp knapp--liten" type="button" data-g="lp-uppgift" data-id="' + x.u.id + '">' + IH.emo('todo') + 'Ge uppgift</button>' +
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
      x.sena.forEach(function (u) { lista.push({ typ: 'Försenad uppgift', ikon: 'larm', text: u.text, under: x.u.namn + ' · skulle vara klar ' + IH.datum(u.forfaller), href: x.u.id === jag.id ? '#/att-gora' : '#/profil/' + x.u.id, vikt: 20 + IH.dagarSedan(u.forfaller), uid: x.u.id }); });
    });
    // en inaktiverad säljares öppna uppgifter behöver en ny ansvarig
    allaS.filter(function (x) { return x.u.inaktiv; }).forEach(function (x) {
      x.uppg.forEach(function (u) { var sen = dag0(u.forfaller) < dag0(new Date()); lista.push({ typ: 'Ingen ansvarig', ikon: 'todo', text: u.text, under: 'Uppgift hos ' + x.u.namn + ' (inaktiverad) · ' + (sen ? 'skulle vara klar ' : 'förfaller ') + IH.datum(u.forfaller), href: u.affar ? '#/salj/' + u.affar : '#/profil/' + x.u.id, vikt: sen ? 35 : 25, uppgift: u.id }); });
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
    var visaN = chefUi.ageraAlla ? visas.length : 7;
    var uppm = lista.length ? ageraFilter + '<ul class="ao-upp lp-agera">' + visas.slice(0, visaN).map(function (r) {
      var mal = r.affar ? ' data-affar="' + r.affar + '"' : r.forfragan ? ' data-forfragan="' + r.forfragan + '"' : r.uppgift ? ' data-uppgift="' + r.uppgift + '"' : '';
      var brattom = r.alder != null ? (r.alder >= 2 ? 'het' : r.alder >= 1 ? 'varm' : '') : r.vikt > 30 ? 'het' : r.vikt > 20 ? 'varm' : '';
      return '<li data-brattom="' + brattom + '"><span class="ao-upp__ikon">' + IH.emo(r.ikon) + '</span><a class="ao-upp__text" href="' + r.href + '"><small class="lp-agera__typ">' + e(r.typ) + (r.alder != null ? ' · ' + (r.alder ? plural(r.alder, 'dag', 'dagar') : 'i dag') : '') + '</small><strong>' + e(r.text) + '</strong><small>' + e(r.under) + '</small></a><span class="lp-agera__knappar">' +
        (mal ? '<button type="button" class="knapp knapp--liten" data-g="lp-ta-sjalv"' + mal + ' title="Ta den själv">Ta själv</button><button type="button" class="knapp knapp--liten" data-g="lp-fordela"' + mal + '>Fördela</button>' : '') +
        (r.uid && r.uid !== jag.id ? '<button type="button" class="knapp knapp--liten" data-g="lp-pamin" data-uid="' + r.uid + '" data-text="' + e(r.typ + ': ' + r.text) + '">Påminn</button>' : '') + '</span></li>';
    }).join('') + '</ul>' + (visas.length > 7 ? '<p class="lp-mer"><button type="button" class="lp-lank" data-g="lp-agera-alla" aria-expanded="' + !!chefUi.ageraAlla + '">' + (chefUi.ageraAlla ? 'Visa färre' : 'Visa alla ' + visas.length) + '</button></p>' : '') : '<div class="ao-lugnt ao-lugnt--stor">' + IH.emo('skold') + '<div><strong>Inget att agera på</strong><small>Inga affärer står still, inga uppgifter är försenade och allt har en ansvarig.</small></div></div>';

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
    var rader = team.map(function (x) { var dd = perDag(x.kontakt, 14); dd.forEach(function (y) { if (y.antal > maxA) maxA = y.antal; }); return { x: x, d: dd }; });
    var idagT = dag0(new Date()).getTime();
    var forra = function (akt) { var t2 = Date.now(); return akt.filter(function (h) { var a = (t2 - new Date(h.tid)) / 864e5; return a >= 14 && a < 28; }).length; };
    var karta = '<div class="lp-karta" style="--n:14"><span></span>' + dagar14.map(function (dd) { return '<small class="' + (dd.dag.getDay() % 6 === 0 ? 'helg' : '') + (dd.dag.getTime() === idagT ? ' idag' : '') + (dd.dag.getDay() === 1 ? ' mandag' : '') + '">' + VECKODAG[dd.dag.getDay()] + '<em>' + dd.dag.getDate() + '</em></small>'; }).join('') + '<span class="lp-karta__summa">Summa</span>' +
      rader.map(function (r) {
        var t = r.d.reduce(function (s, y) { return s + y.antal; }, 0), f2 = forra(r.x.kontakt), tr = f2 ? Math.round((t - f2) / f2 * 100) : null;
        return '<span class="lp-karta__namn">' + avatar(r.x.u) + e(r.x.u.namn.split(' ')[0]) + '</span>' + r.d.map(function (y) {
          return '<i style="--a:' + (y.antal / maxA).toFixed(3) + '" class="' + (y.antal ? 'pa' : '') + (y.dag.getTime() === idagT ? ' idag' : '') + (y.dag.getDay() === 1 ? ' mandag' : '') + '" title="' + e(r.x.u.namn) + ', ' + IH.datum(y.dag.toISOString()) + ': ' + plural(y.antal, 'händelse', 'händelser') + '">' + (y.antal || '') + '</i>';
        }).join('') + '<b>' + t + (f2 || t ? '<small class="lp-trend" data-upp="' + (t >= f2) + '" title="' + t + ' de senaste 14 dagarna mot ' + f2 + ' de 14 dagarna innan">' + (t === f2 ? '± 0' : (t > f2 ? '↑ ' : '↓ ') + (f2 >= 5 ? Math.abs(tr) + ' %' : (t > f2 ? '+' : '−') + Math.abs(t - f2))) + '</small>' : '') + '</b>';
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
      return '<li class="' + (n === 0 && r.summa ? 'forst' : '') + '" style="--a:' + (r.summa / ledare).toFixed(3) + '"><span class="lp-topp__plats">' + (n === 0 && r.summa ? IH.emo('medalj') : n + 1) + '</span>' + avatar(r.x.u) + '<span><a href="#/profil/' + r.x.u.id + '"><b>' + e(r.x.u.namn) + '</b></a><small>' + plural(r.v.length, 'vunnen affär', 'vunna affärer') + (r.g ? ' · vinstgrad ' + pct(r.v.length / r.g) : '') + (n > 0 && toppRad[0].summa ? ' · ' + IH.kort(toppRad[0].summa - r.summa) + ' efter' : '') + '</small><span class="lp-topp__stapel"><i></i></span></span><b class="tal">' + IH.kort(r.summa) + '</b></li>';
    }).join('') + '</ol>' + '<p class="lp-topp__summa">Teamet: <b>' + IH.kort(toppRad.reduce(function (t, r) { return t + r.summa; }, 0)) + '</b> på ' + plural(toppRad.reduce(function (t, r) { return t + r.v.length; }, 0), 'vunnen affär', 'vunna affärer') + '</p>';

    // Det som kräver handling först, sedan teamet; högerspalten staplar pipeline och topplista så spalterna slutar lika
    var html = hjalte +
      chefBand('01 · Att agera på', 'Behöver din', 'uppmärksamhet', uppm, { klass: 'ao-band--uppm', hoger: lista.length ? '<span class="ao-band__tal">' + lista.length + '</span>' : '', ingress: lista.length ? 'Det viktigaste överst. Ta själv, fördela eller påminn direkt.' : '' }) +
      chefBand('02 · Teamet', 'Teamet', 'just nu', '<div class="lp-team">' + kort + '</div>', { klass: 'ao-band--team', ingress: 'Status, öppna affärer, kvartalsmålet och veckans aktivitet per säljare – klicka på ett namn för att öppna profilen.', hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + filter + '</div>' }) +
      '<div class="ao-tva lp-tva">' + chefBand('03 · Aktivitet', 'Aktivitet', '14 dagar', karta + senasteHandelser(team), { klass: 'ao-band--akt14', ingress: 'Loggade möten, samtal och mejl per dag. Pilen jämför med de 14 dagarna innan.' }) +
        '<div class="lp-stapel">' + chefBand('04 · Öppna affärer', 'Öppna affärer', 'per säljare', pipe, { klass: 'ao-band--pipe', ingress: 'Öppet värde per steg – håll musen över en färg för beloppet.' }) +
        chefBand('05 · Resultat', 'Topplistan', period === 'ar' ? 'i år' : period + ' dagar', topplista, { klass: 'ao-band--topp', hoger: toppVal }) + '</div></div>' +
      chefBand('06 · Närvaro', 'Vem jobbar', 'när', narv, { klass: 'ao-band--narvaro', ingress: 'Arbetsdagar enligt schemat, dagar med aktivitet i CRM:et och frånvaro – klicka på en dag för att lägga in frånvaro.' }) +
      chefBand('07 · Kalender', 'Teamets', 'kalender', kalender(team), { klass: 'ao-band--kal', ingress: 'Möten, samtal och mejl, uppgifter som förfaller och vunna affärer – för hela teamet eller en person.' });
    var raknaUpp = Date.now() - (IH.vyer.chef.senast || 0) > 15000; IH.vyer.chef.senast = Date.now();
    return { titel: 'Försäljningsledning', html: html, efter: function (yta) {
      ['.lp-nv', '.lp-karta'].forEach(function (sel) {
        var g = yta.querySelector(sel), idag = g && g.querySelector('.idag'), r = g; if (!idag) return;
        while (r && r !== yta && r.scrollWidth <= r.clientWidth + 1) r = r.parentElement;
        if (!r || r === yta) return;
        var over = idag.getBoundingClientRect().right - r.getBoundingClientRect().right;
        if (over > 0) r.scrollLeft += over + 24;
      });
      if (!raknaUpp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      yta.querySelectorAll('.lp-mork .ao-tal strong, .lp-ring__mitt b').forEach(function (el, n) {
        var txt = el.textContent, m = txt.match(/^([\d\s]+(?:,\d+)?)(.*)$/); if (!m) return;
        var mal = parseFloat(m[1].replace(/\s/g, '').replace(',', '.')), dec = (m[1].split(',')[1] || '').length, t0 = performance.now() + n * 90;
        var steg = function (nu) { var p = Math.min(1, Math.max(0, (nu - t0) / 1100)), v = mal * (1 - Math.pow(1 - p, 3)); el.textContent = IH.lokalTal(v, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[2]; if (p < 1) requestAnimationFrame(steg); else el.textContent = txt; };
        requestAnimationFrame(steg);
      });
    } };
  };

  /* Chefens verktyg ------------------------------------------------------------------------------ */
  var G = IH.G;
  var valSaljare = function (namn, vald) { return '<label class="falt"><span>Säljare</span><select name="' + namn + '">' + saljare().filter(function (u) { return !u.inaktiv; }).map(function (u) { return '<option value="' + u.id + '"' + (u.id === vald ? ' selected' : '') + '>' + e(u.namn) + '</option>'; }).join('') + '</select></label>'; };
  G['lp-chef-filter'] = function (el) { chefUi.filter = el.getAttribute('data-f'); IH.rita(); };
  G['lp-agera-f'] = function (el) { chefUi.agera = el.getAttribute('data-f'); IH.rita(); };
  G['lp-agera-alla'] = function () { chefUi.ageraAlla = !chefUi.ageraAlla; IH.rita(); };
  G['lp-topp-period'] = function (el) { var f = el.getAttribute('data-f'); chefUi.topp = f === 'ar' ? 'ar' : +f; IH.rita(); };
  var uppgiften = function (id) { return id ? db().uppgifter.find(function (x) { return x.id === id; }) || null : null; };
  var tilldela = function (a, f, till, upg) {
    if (a) {
      a.ansvarig = till.id; a.andrad = new Date().toISOString(); IH.logga('system', 'Fördelad till ' + till.namn + ' av ' + IH.jag().namn + '.', a.kund, a.id);
      // affärens öppna uppgifter hos säljare följer med till den nya ansvariga
      db().uppgifter.forEach(function (x) { var v = IH.anvandare(x.ansvarig); if (x.affar === a.id && !x.klar && (!v || v.roll === 'salj')) x.ansvarig = till.id; });
    }
    if (f) f.tilldelad = till.id;
    if (upg) upg.ansvarig = till.id;
  };
  G['lp-ta-sjalv'] = function (el) {
    var a = IH.affar(el.getAttribute('data-affar')), f = IH.forfragan(el.getAttribute('data-forfragan')), upg = uppgiften(el.getAttribute('data-uppgift')), jag = IH.jag();
    tilldela(a, f, jag, upg); IH.spara(); IH.uppdateraMeny(); IH.rita(); IH.toast('Nu är den din', (a ? a.titel : f ? f.namn : upg ? upg.text : '') + ' ligger hos dig.', 'kunder');
  };
  // jämn fördelning: varje ny post går till den som har minst öppet (affärer plus tilldelade förfrågningar) just då
  // Chefsåtgärder: bara chef eller admin (klientspärr – den riktiga kontrollen hör till servern)
  function kravChef() { var j = IH.jag(); if (j && (j.chef || j.roll === 'admin')) return true; IH.toast('Bara för chefen', 'Den här åtgärden kan bara försäljningschefen göra.', 'varning'); return false; }
  G['lp-fordela-smart'] = function () {
    if (!kravChef()) return;
    var folk = saljare().filter(function (u) { return !u.inaktiv; }); if (!folk.length) return;
    var last = {}; folk.forEach(function (u) { last[u.id] = db().affarer.filter(function (a) { return a.ansvarig === u.id && a.steg !== 'vunnen' && !a.forlorad; }).length + db().forfragningar.filter(function (f) { return f.tilldelad === u.id && f.status === 'ny'; }).length; });
    var poster = db().forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).map(function (f) { return { f: f }; })
      .concat(db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad && (!a.ansvarig || !IH.anvandare(a.ansvarig) || IH.anvandare(a.ansvarig).inaktiv); }).map(function (a) { return { a: a }; }));
    var fick = {};
    poster.forEach(function (p2) { var u = folk.slice().sort(function (x, y) { return last[x.id] - last[y.id]; })[0]; tilldela(p2.a, p2.f, u); last[u.id]++; fick[u.id] = (fick[u.id] || 0) + 1; });
    // uppgifter som ligger kvar hos inaktiverade konton (de som hörde till en affär följde med ovan)
    db().uppgifter.filter(function (x) { var v = IH.anvandare(x.ansvarig); return !x.klar && v && v.inaktiv; }).forEach(function (x) {
      var u = folk.slice().sort(function (p, q) { return last[p.id] - last[q.id]; })[0]; tilldela(null, null, u, x); fick[u.id] = (fick[u.id] || 0) + 1;
    });
    IH.spara(); IH.uppdateraMeny(); IH.rita();
    Object.keys(fick).forEach(function (id) { if (id !== IH.jag().id && IH.chattSkickaTill) IH.chattSkickaTill(id, 'Jag har gett dig ' + fick[id] + (fick[id] === 1 ? ' ny post' : ' nya poster') + ' (förfrågningar, affärer eller uppgifter) – du hittar dem under Förfrågningar, på säljtavlan och under Att göra.'); });
    IH.toast('Fördelat jämnt', Object.keys(fick).map(function (id) { return IH.anvandare(id).namn.split(' ')[0] + ' fick ' + fick[id]; }).join(', ') + '.', 'blixt');
  };
  G['lp-kal-vem'] = function (el) { chefUi.kalVem = el.getAttribute('data-f'); IH.rita(); };
  G['lp-kal-man'] = function (el) { var d = +el.getAttribute('data-d'); chefUi.kalMan = d ? chefUi.kalMan + d : 0; IH.rita(); };
  G['lp-mal'] = function (el) {
    if (!kravChef()) return;
    var id = el.getAttribute('data-id');
    var lista = saljare().filter(function (u) { return !u.inaktiv && (!id || u.id === id); });
    IH.oppnaArk({ titel: 'Säljmål', under: 'Årsmål per säljare – kvartalsmålet är en fjärdedel.', ikon: 'mal',
      kropp: '<form id="lp-mal-form" data-lp-mal class="km-form">' + lista.map(function (u) {
        return '<label class="falt"><span>' + e(u.namn) + ' – årsmål i kronor</span><input name="' + u.id + '" type="number" min="0" step="1" value="' + (u.mal || '') + '" placeholder="T.ex. 825 000"></label>';
      }).join('') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-mal-form">' + i('bock') + 'Spara målen</button>' });
  };
  var sparaKonto = function (u, falt) { if (IH.andraKonto) IH.andraKonto(u.id, falt); else Object.assign(u, falt); };
  G['lp-andra-profil'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    if (u.id !== IH.jag().id && !kravChef()) return;
    var ar = u.id === IH.jag().id;
    IH.oppnaArk({ titel: ar ? 'Ändra din profil' : 'Ändra ' + u.namn, under: 'Titel, kontaktuppgifter, startdatum och presentation.', ikon: 'redigera',
      kropp: '<form id="lp-profil-form" data-lp-profil="' + u.id + '" class="km-form">' +
        '<label class="falt"><span>Titel</span><input name="titel" maxlength="60" value="' + e(u.titel || '') + '" placeholder="T.ex. Säljare"></label>' +
        '<label class="falt"><span>E-post</span><input name="epost" type="email" maxlength="80" value="' + e(u.epost || '') + '" placeholder="namn@foretag.se"></label>' +
        '<label class="falt"><span>Telefon</span><input name="tel" type="tel" maxlength="30" inputmode="tel" value="' + e(u.tel || '') + '" placeholder="070-123 45 67"></label>' +
        '<label class="falt"><span>I teamet sedan</span><input name="start" type="date" max="' + dagISO(new Date(Date.now() + 365 * 864e5)) + '" value="' + e(u.start || '') + '"></label>' +
        '<label class="falt"><span>Om ' + (ar ? 'dig' : e(u.namn.split(' ')[0])) + '</span><textarea name="om" rows="3" maxlength="400" placeholder="Vad du jobbar med och hur man når dig bäst">' + e(u.om || '') + '</textarea></label>' +
        (u.bild ? '<label class="falt falt--kryss"><input type="checkbox" name="utanBild"> <span>Ta bort profilbilden</span></label>' : '') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-profil-form">' + i('bock') + 'Spara</button>' });
    var f = el.getAttribute('data-fokus');
    setTimeout(function () { var x = document.querySelector('#lp-profil-form [name="' + (f || 'titel') + '"]'); if (x) { x.focus(); if (x.setSelectionRange) x.setSelectionRange(x.value.length, x.value.length); } }, 80);
  };
  G['lp-kopiera'] = function (el) {
    var t = el.getAttribute('data-text') || '';
    var klar = function () { IH.toast('Kopierat', t, 'kopiera'); };
    var nej = function () { IH.toast('Kunde inte kopiera', 'Markera texten och kopiera själv: ' + t, 'varning'); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(klar, nej); else nej();
  };
  // Profilbild: beskärs till en kvadrat och skalas till 320 px (JPEG) och sparas på kontot
  document.addEventListener('change', function (ev) {
    var inp = ev.target; if (!inp.matches || !inp.matches('input[type=file][data-lp-bild]') || !inp.files || !inp.files[0]) return;
    var u = IH.anvandare(inp.getAttribute('data-lp-bild')), fil = inp.files[0]; if (!u) return;
    if (!/^image\//.test(fil.type)) { IH.toast('Välj en bildfil', 'JPG, PNG eller WebP.', 'varning'); return; }
    if (fil.size > 15 * 1024 * 1024) { IH.toast('Bilden är för stor', 'Högst 15 MB.', 'varning'); return; }
    var url = URL.createObjectURL(fil), img = new Image();
    img.onload = function () {
      var m = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 320;
      var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, 320, 320);
      URL.revokeObjectURL(url); sparaKonto(u, { bild: c.toDataURL('image/jpeg', 0.86) }); IH.spara(); IH.rita(); if (IH.uppdateraMeny) IH.uppdateraMeny();
      IH.toast(u.id === IH.jag().id ? 'Din profilbild är uppdaterad' : 'Profilbilden för ' + u.namn + ' är uppdaterad', null, 'kamera');
    };
    img.onerror = function () { URL.revokeObjectURL(url); IH.toast('Bilden kunde inte läsas', null, 'varning'); };
    img.src = url; inp.value = '';
  });
  // Gäller: en öppen affär (säljarens egna först) eller en kund – uppgiften får då länk till den under Att göra
  var valKoppling = function (uid) {
    var aff = db().affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).sort(function (a, b) { return (b.ansvarig === uid) - (a.ansvarig === uid); });
    return '<label class="falt"><span>Gäller (valfritt)</span><select name="koppling"><option value="">Ingen kund eller affär</option>' +
      (aff.length ? '<optgroup label="Öppna affärer">' + aff.map(function (a) { var k = IH.kund(a.kund); return '<option value="a:' + a.id + '">' + e(a.titel + (k ? ' · ' + k.namn : '')) + '</option>'; }).join('') + '</optgroup>' : '') +
      '<optgroup label="Kunder">' + db().kunder.map(function (k) { return '<option value="k:' + k.id + '">' + e(k.namn) + '</option>'; }).join('') + '</optgroup></select></label>';
  };
  G['lp-egen-uppg'] = function (el) {
    var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    IH.oppnaArk({ titel: 'Ny uppgift', under: 'Hamnar under Att göra.', ikon: 'todo',
      kropp: '<form id="lp-uppg-form" data-lp-uppgift class="km-form"><input type="hidden" name="vem" value="' + e(el.getAttribute('data-id')) + '">' +
        '<label class="falt"><span>Uppgift</span><input name="text" required maxlength="120" placeholder="T.ex. Ring kunden om grunden"></label>' +
        '<label class="falt"><span>Klar senast</span><input name="datum" type="date" required value="' + dagISO(imorgon) + '"></label>' + valKoppling(el.getAttribute('data-id')) + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-uppg-form">' + i('plus') + 'Lägg till</button>' });
    setTimeout(function () { var x = document.querySelector('#lp-uppg-form input[name="text"]'); if (x) x.focus(); }, 80);
  };
  // Bockar av en uppgift direkt på profilen: raden glider ut, sedan ritas sidan om
  G['lp-klar'] = function (el) {
    var x = db().uppgifter.filter(function (y) { return y.id === el.getAttribute('data-id'); })[0]; if (!x) return;
    x.klar = true; x.klarTid = new Date().toISOString(); IH.spara();
    var li = el.closest('li'); if (li) li.classList.add('lp-klar');
    setTimeout(function () { IH.uppdateraMeny(); IH.rita(); }, IH.lugn ? 0 : 420);
    IH.toast('Klar', x.text, 'bock');
  };
  G['lp-uppgift'] = function (el) {
    var id = el.getAttribute('data-id'), imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    IH.oppnaArk({ titel: 'Ge uppgift', under: 'Hamnar under Att göra hos säljaren.', ikon: 'todo',
      kropp: '<form id="lp-uppg-form" data-lp-uppgift class="km-form">' + valSaljare('vem', id) +
        '<label class="falt"><span>Uppgift</span><input name="text" required maxlength="120" placeholder="T.ex. Ring kunden om grunden"></label>' +
        '<label class="falt"><span>Klar senast</span><input name="datum" type="date" required value="' + dagISO(imorgon) + '"></label>' + valKoppling(id) + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-uppg-form">' + i('plus') + 'Ge uppgiften</button>' });
  };
  G['lp-fordela'] = function (el) {
    if (!kravChef()) return;
    var aid = el.getAttribute('data-affar'), fid = el.getAttribute('data-forfragan'), uid = el.getAttribute('data-uppgift');
    var a = aid && IH.affar(aid), f = fid && IH.forfragan(fid), upg = uppgiften(uid);
    IH.oppnaArk({ titel: 'Fördela', under: e(a ? a.titel + ' – öppna uppgifter på affären följer med' : f ? f.namn : upg ? upg.text : ''), ikon: 'kunder',
      kropp: '<form id="lp-ford-form" data-lp-fordela="' + (aid || '') + '" data-lp-forfragan="' + (fid || '') + '" data-lp-ford-uppg="' + (uid || '') + '" class="km-form">' + valSaljare('vem', a ? a.ansvarig : null) +
        '<label class="km-kryss"><input type="checkbox" name="meddela" checked> Skicka ett meddelande till säljaren</label></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="lp-ford-form">' + i('bock') + 'Fördela</button>' });
  };
  G['lp-pamin'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-uid')); if (!u) return;
    if (IH.chattSkickaTill && IH.chattSkickaTill(u.id, 'Påminnelse – ' + el.getAttribute('data-text') + '. Hör av dig om du behöver hjälp!')) IH.toast('Påminnelsen är skickad', 'Till ' + u.namn + ' i chatten.', 'samtal');
    else IH.toast('Kunde inte skicka', 'Chatten är skrivskyddad i supportläget.', 'varning');
  };
  G['lp-rapport'] = function () {
    // Text som börjar med = + - @ tolkas som formel i Excel – den får en apostrof först
    var q = function (x) { var s = String(x == null ? '' : x); if (typeof x !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    var rader = [['Säljare', 'Öppna affärer', 'Öppet värde', 'Viktat', 'Vunnet 90 d', 'Vunna affärer 90 d', 'Årsmål', 'Händelser 14 d', 'Försenade uppgifter'].map(q).join(';')].concat(saljare().filter(function (u) { return !u.inaktiv; }).map(function (u) {
      var x = stat(u), v90 = x.aff.filter(function (a) { return a.steg === 'vunnen' && inom(a.vunnen, 90); });
      return [u.namn, x.oppna.length, Math.round(x.oppet), Math.round(x.viktat), v90.reduce(function (t, a) { return t + a.varde; }, 0), v90.length, u.mal || '', x.akt.filter(function (h) { return IH.dagarSedan(h.tid) < 14 && new Date(h.tid) <= new Date(); }).length, x.sena.length].map(q).join(';');
    }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rader.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'legohus-forsaljning-' + dagISO(new Date()) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    IH.toast('Rapporten är nedladdad', 'Teamets försäljning som CSV – öppnas i Excel.', 'ladda-ner');
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches) return;
    if (t.matches('[data-lp-mal]')) {
      ev.preventDefault();
      if (!kravChef()) return;
      [].slice.call(t.elements).forEach(function (f) { if (!f.name) return; var u = IH.anvandare(f.name), v = Math.max(0, Math.round(+f.value || 0)); if (u && IH.andraKonto) IH.andraKonto(u.id, { mal: v }); else if (u) u.mal = v || undefined; });
      IH.stangArk(); IH.rita(); IH.toast('Målen är sparade', 'Kvartalsmålet är en fjärdedel av årsmålet.', 'mal');
    }
    if (t.matches('[data-lp-profil]')) {
      ev.preventDefault();
      var pu = IH.anvandare(t.getAttribute('data-lp-profil')); if (!pu) return;
      if (pu.id !== IH.jag().id && !kravChef()) return;
      var falt = { titel: t.titel.value.trim() || standardTitel(pu), epost: t.epost.value.trim(), tel: t.tel.value.trim(), start: t.start.value, om: t.om.value.trim() };
      if (t.utanBild && t.utanBild.checked) falt.bild = '';
      sparaKonto(pu, falt); IH.spara(); IH.stangArk(); IH.rita(); if (IH.uppdateraMeny) IH.uppdateraMeny();
      IH.toast('Profilen är sparad', null, 'bock');
    }
    if (t.matches('[data-lp-uppgift]')) {
      ev.preventDefault();
      var u = IH.anvandare(t.vem.value), text = t.text.value.trim(); if (!u || !text) return;
      var kv = t.koppling ? t.koppling.value : '', ka = kv.indexOf('a:') === 0 ? IH.affar(kv.slice(2)) : null, kk = ka ? ka.kund : kv.indexOf('k:') === 0 ? kv.slice(2) : null;
      db().uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text, forfaller: new Date(t.datum.value + 'T09:00:00').toISOString(), klar: false, kund: kk || null, affar: ka ? ka.id : null, ansvarig: u.id, av: IH.jag().id });
      IH.spara(); IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      if (u.id === IH.jag().id) IH.toast('Uppgiften är tillagd', text, 'todo'); else { IH.toast('Uppgiften är skickad till ' + u.namn, 'Den syns under Att göra.', 'todo'); if (IH.chattSkickaTill) IH.chattSkickaTill(u.id, 'Ny uppgift till dig: ' + text + ' (klar senast ' + kortDatum(new Date(t.datum.value + 'T12:00:00')) + ').'); }
    }
    if (t.matches('[data-lp-fordela]')) {
      ev.preventDefault();
      var till = IH.anvandare(t.vem.value), a = IH.affar(t.getAttribute('data-lp-fordela')), f = IH.forfragan(t.getAttribute('data-lp-forfragan')), upg = uppgiften(t.getAttribute('data-lp-ford-uppg')); if (!till) return;
      tilldela(a, f, till, upg);
      IH.spara();
      if (t.meddela.checked && till.id !== IH.jag().id && IH.chattSkickaTill) IH.chattSkickaTill(till.id, 'Jag har gett dig ' + (a ? 'affären ' + a.titel : f ? 'förfrågan från ' + f.namn : 'uppgiften ' + (upg ? upg.text : '')) + '. Hör av dig om du har frågor!');
      IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      IH.toast('Fördelad', (a ? a.titel : f ? f.namn : upg ? upg.text : '') + ' → ' + till.namn, 'kunder');
    }
  });
})();
