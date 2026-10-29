/* Legohus CRM – supportläget (2026-10-29). Administratören går in i en säljares konto för att guida och rätta saker
   medan säljaren jobbar: CRM:et visas exakt som för säljaren och ändringar i kunder, affärer och uppgifter görs i deras
   konto. Det stör inte säljaren – statusen ändras inte, inget markeras som läst åt dem och inga chattmeddelanden kan
   skickas i deras namn. Varje gång läget börjar och slutar skrivs det i säkerhetsloggen (bara administratören ser den),
   så att det går att följa upp i efterhand. Bandet högst upp visar alltid vems konto som är öppet. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e;
  var G = IH.G;
  var START = 'ih-crm-visa-som-start';
  var logg = function (text) {
    if (!IH.sakLogg) return;
    var d = IH.db; d.sakerhet = d.sakerhet || [];
    d.sakerhet.unshift({ tid: new Date().toISOString(), typ: 'support', text: text, av: IH.riktigJag().id });
    if (d.sakerhet.length > 300) d.sakerhet.length = 300;
    IH.spara();
  };
  function minuter() { var t = 0; try { t = +localStorage.getItem(START) || 0; } catch (x) { /* */ } return t ? Math.max(1, Math.round((Date.now() - t) / 60000)) : 0; }

  function borja(id, mal) {
    var u = IH.anvandare(id); if (!u || u.roll === 'admin' || u.inaktiv || IH.riktigJag().roll !== 'admin') return;
    var forra = IH.visarSom();
    if (forra && forra.id === id) return;
    if (forra) logg('Supportläget: bytte från ' + forra.namn + ' till ' + u.namn + ' (' + minuter() + ' min).');
    else logg('Supportläget: öppnade ' + u.namn + 's konto.');
    IH.sattVisaSom(id);
    try { localStorage.setItem(START, String(Date.now())); } catch (x) { /* */ }
    IH.stangArk(true);
    // Samma startsida som kontot själv har (produktionen börjar på Projekt), eller sidan administratören var på väg till
    IH.uppdateraMeny(); IH.ga(mal && mal.indexOf('#/') === 0 ? mal : u.roll === 'prod' ? '#/produktion' : '#/'); IH.rita(); band();
    IH.toast('Du är i ' + u.namn + 's konto', 'Supportläge – ' + u.namn + ' märker inget. Tillbaka med knappen högst upp.', 'oga-av');
  }
  function sluta(tyst) {
    var u = IH.visarSom(); if (!u) return;
    logg('Supportläget avslutat: ' + u.namn + ' (' + minuter() + ' min).');
    IH.sattVisaSom(null);
    try { localStorage.removeItem(START); } catch (x) { /* */ }
    IH.uppdateraMeny(); band();
    if (!tyst) { IH.ga('#/kontroll'); IH.rita(); IH.toast('Tillbaka som Admin', u.namn + 's konto är stängt.', 'bock'); }
  }
  IH.stod = { borja: borja, sluta: sluta };

  /* Bandet högst upp: vems konto, hur länge, byt till en annan säljare eller tillbaka */
  var bandEl = null, bandTimer = 0;
  function band() {
    var u = IH.visarSom();
    document.documentElement.toggleAttribute('data-support', !!u);
    if (!u) { if (bandEl) { var b = bandEl; bandEl = null; b.setAttribute('data-ut', ''); setTimeout(function () { b.remove(); }, 300); } clearInterval(bandTimer); return; }
    if (!bandEl) { bandEl = document.createElement('div'); bandEl.className = 'stod-band'; bandEl.setAttribute('role', 'status'); document.body.appendChild(bandEl); }
    var andra = IH.ANVANDARE.filter(function (x) { return x.roll !== 'admin' && !x.inaktiv; });
    var n = IH.narvaro ? IH.narvaro(u.id) : { namn: '', farg: '#ccc' };
    bandEl.innerHTML = '<span class="stod-band__ikon" aria-hidden="true">' + IH.emo('oga-av') + '<i></i></span>' +
      '<span class="stod-band__text"><small>Supportläge · ' + e(u.namn) + ' märker inget</small><b>Du ser CRM:et som ' + e(u.namn) + '</b></span>' +
      '<span class="stod-band__val" role="group" aria-label="Byt konto">' + andra.map(function (x) {
        return '<button type="button" data-g="visa-som" data-id="' + x.id + '" aria-pressed="' + (x.id === u.id) + '" title="Visa som ' + e(x.namn) + '"><span class="avatar" style="--av:' + x.farg + '">' + IH.initialer(x.namn) + '</span><span>' + e(x.namn) + '</span></button>';
      }).join('') + '</span>' +
      '<span class="stod-band__fakta"><span class="stod-band__status" style="--n:' + n.farg + '"><i></i>' + e(u.namn) + ' är ' + e(n.namn.toLowerCase()) + '</span><span data-stod-tid>' + IH.emo('klocka') + minuter() + ' min</span></span>' +
      '<button type="button" class="stod-band__ut" data-g="visa-som-sluta" title="Tillbaka till Admin (Shift + Esc)">' + IH.emo('logga-ut') + '<span>Tillbaka till Admin</span></button>';
    placeraBand();
    clearInterval(bandTimer);
    bandTimer = setInterval(function () { var t = bandEl && bandEl.querySelector('[data-stod-tid]'); if (t) t.innerHTML = IH.emo('klocka') + minuter() + ' min'; }, 30000);
  }
  // Bandet ligger över innehållets spalt (inte över menyn), i samma bredd som korten
  function placeraBand() {
    if (!bandEl) return;
    var v = document.querySelector('.vy');
    if (!v || innerWidth <= 720) { bandEl.style.left = bandEl.style.width = ''; return; }
    var r = v.getBoundingClientRect(), cs = getComputedStyle(v);
    var l = r.left + parseFloat(cs.paddingLeft), w = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    bandEl.style.left = l + 'px'; bandEl.style.width = w + 'px';
  }
  addEventListener('resize', placeraBand);
  new MutationObserver(function () { setTimeout(placeraBand, 650); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sido-dold'] });
  addEventListener('hashchange', function () { setTimeout(placeraBand, 0); });
  var forraMeny = IH.uppdateraMeny;
  IH.uppdateraMeny = function () { var r = forraMeny.apply(this, arguments); if (!!IH.visarSom() !== !!bandEl) band(); return r; };
  setTimeout(band, 0);

  G['visa-som'] = function (el) { borja(el.getAttribute('data-id'), el.getAttribute('data-mal')); };
  G['visa-som-sluta'] = function () { sluta(false); };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && ev.shiftKey && IH.visarSom()) sluta(false); });

  // Kontobyten: administratören går in i en säljares konto i supportläget i stället för att logga ut sig själv.
  // I supportläget byter ett klick på en annan säljare konto i läget, och Admin avslutar läget.
  var valj = G['valj-anvandare'];
  G['valj-anvandare'] = function (el) {
    var mal = IH.anvandare(el.getAttribute('data-id'));
    if (IH.riktigJag().roll === 'admin' && mal) {
      if (mal.roll === 'admin') { if (IH.visarSom()) { if (IH.stangKm) IH.stangKm(); sluta(false); } return; }
      if (IH.stangKm) IH.stangKm();
      borja(mal.id); return;
    }
    valj(el);
  };
  // Sådant som skulle synas för säljaren görs inte i supportläget
  var narvaro = G['satt-narvaro'];
  G['satt-narvaro'] = function (el) {
    if (IH.visarSom()) { IH.toast('Statusen ändras inte i supportläget', IH.visarSom().namn + ' styr sin egen status.', 'oga-av'); return; }
    narvaro(el);
  };
  // Sjukanmälan ändrar personens status – det gör inte administratören åt säljaren
  var sjuk = G['pk-sjuk'];
  if (sjuk) G['pk-sjuk'] = function (el) {
    var u = IH.visarSom();
    if (u && el.getAttribute('data-id') === u.id) { IH.toast('Statusen ändras inte i supportläget', u.namn + ' sjukanmäler sig själv.', 'oga-av'); return; }
    sjuk(el);
  };
  // Allt som loggas i supportläget märks med vem som gjorde det och skrivs i säkerhetsloggen
  var loggaForra = IH.logga;
  IH.logga = function (typ, text, kund, affar) {
    loggaForra.apply(this, arguments);
    var u = IH.visarSom(); if (!u) return;
    var h = IH.db.aktiviteter[IH.db.aktiviteter.length - 1]; if (h) h.stod = IH.riktigJag().id;
    logg('Supportläget i ' + u.namn + 's konto: ' + String(text || typ).slice(0, 90));
  };
  var utloggning = G['logga-ut'];
  G['logga-ut'] = function (el) { if (IH.visarSom()) { sluta(false); return; } if (utloggning) utloggning(el); };
})();
