/* Legohus CRM – admin: grunden under adminpanelen (adminpanel.js) och säkerhetshubben (sakerhet.js), 2026-10-28.
   - Säkerhetsloggen (IH.sakLogg) och loggning av kontobyten.
   - Utloggning vid inaktivitet gäller alla konton: en minut före visas en nedräkning med Fortsätt.
   - Kopplingarna i datan (IH.sak.kopplingsBrott), export och återställning av exempeldatan (bara administratören).
   Prototyp: allt ligger i webbläsaren. Skarp drift kräver server, riktig inloggning och serverns logg. */
(function () {
  'use strict';
  var IH = window.IH;
  var i = IH.i;
  var db = function () { return IH.db; };
  var arAdmin = function () { return IH.jag().roll === 'admin'; };
  // Vakt för adminåtgärder: knapparna ritas bara på adminsidorna, men dispatchern kör vilken IH.G-funktion som helst
  // som ett data-g pekar på. Prototyp – i skarp drift måste servern kontrollera rollen vid varje anrop.
  IH.kravAdmin = function () {
    if (arAdmin()) return true;
    IH.toast('Bara administratören kan göra det', IH.visarSom && IH.visarSom() ? 'Lämna supportläget först.' : null, 'las');
    if (IH.sakLogg) IH.sakLogg('atkomst', IH.jag().namn + ' försökte köra en adminåtgärd utan behörighet.');
    return false;
  };

  /* 01 Säkerhetsloggen ---------------------------------------------------------------------------- */
  function logg(typ, text) {
    var d = db();
    d.sakerhet = d.sakerhet || [];
    d.sakerhet.unshift({ tid: new Date().toISOString(), typ: typ, text: text, av: (IH.riktigJag || IH.jag)().id });
    if (d.sakerhet.length > 300) d.sakerhet.length = 300;
    IH.spara();
  }
  IH.sakLogg = logg;
  // Kontobyten loggas
  var valj = IH.G['valj-anvandare'];
  IH.G['valj-anvandare'] = function (el) {
    var fran = IH.jag().namn;
    valj(el);
    logg('konto', 'Kontobyte: ' + fran + ' → ' + IH.jag().namn + '.');
    if (arAdmin()) IH.ga('#/kontroll');
  };

  /* 02 Inställningar och utloggning vid inaktivitet --------------------------------------------- */
  var INST = 'ih-crm-admin';
  function inst() { try { return JSON.parse(localStorage.getItem(INST)) || {}; } catch (x) { return {}; } }
  function sparaInst(nyckel, varde) { var o = inst(); o[nyckel] = varde; try { localStorage.setItem(INST, JSON.stringify(o)); } catch (x) { /* privat läge */ } }
  // Standard 30 minuter tills administratören har valt något (0 = aldrig)
  function utloggMin() { var v = inst().utlogg; return v == null ? 30 : (+v || 0); }
  // Senaste aktivitet delas mellan flikarna, så att en orörd flik inte loggar ut en flik som används
  var SENAST = 'ih-crm-senast';
  var senast = Date.now(), varnad = null, varnTimer = 0, delad = 0;
  var delaSenast = function () { if (senast - delad < 10000) return; delad = senast; try { localStorage.setItem(SENAST, String(senast)); } catch (x) { /* privat läge */ } };
  var hamtaSenast = function () { try { var v = +localStorage.getItem(SENAST); if (v > senast && v <= Date.now() + 60000) senast = v; } catch (x) { /* privat läge */ } };
  delaSenast();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { document.addEventListener(t, function () { senast = Date.now(); delaSenast(); if (varnad) stangVarning(); }, { passive: true, capture: true }); });
  function stangVarning() { if (varnad) { varnad.remove(); varnad = null; clearInterval(varnTimer); } }
  setInterval(function () {
    var min = utloggMin();
    if (!min || !localStorage.getItem('ih-crm-inloggad')) return;
    hamtaSenast();
    var kvar = min * 60000 - (Date.now() - senast);
    if (kvar <= 0) {
      stangVarning();
      if (IH.stod && IH.visarSom && IH.visarSom()) IH.stod.sluta(true);
      logg('inaktiv', 'Utloggad efter ' + min + ' minuter utan aktivitet.');
      IH.G['logga-ut'](); return;
    }
    if (kvar <= 60000 && !varnad) {
      varnad = document.createElement('div');
      varnad.className = 'ad-varning'; varnad.setAttribute('role', 'alertdialog');
      varnad.innerHTML = IH.emo('klocka', 'ad-varning__ikon') + '<div><b>Du loggas snart ut</b><small>Ingen aktivitet på en stund. <span data-ad-kvar>60</span> s kvar.</small></div><button class="knapp knapp--virke knapp--liten" type="button">Fortsätt</button>';
      varnad.querySelector('button').addEventListener('click', function () { senast = Date.now(); delad = 0; delaSenast(); stangVarning(); });
      document.body.appendChild(varnad);
      varnTimer = setInterval(function () { var s = varnad && varnad.querySelector('[data-ad-kvar]'); if (s) s.textContent = Math.max(0, Math.ceil((min * 60000 - (Date.now() - senast)) / 1000)); }, 500);
    }
  }, 5000);

  /* 03 Kopplingarna i datan (säkerhetshubben och kontrollcentralen) ------------------------------- */
  function kopplingsBrott() {
    var d = db(), fel = [];
    var finns = function (lista, id) { return !id || lista.some(function (x) { return x.id === id; }); };
    d.affarer.forEach(function (a) { if (!finns(d.kunder, a.kund)) fel.push('Affären ”' + a.titel + '” pekar på en kund som saknas.'); });
    d.affarer.forEach(function (a) { if (a.ansvarig && !IH.anvandare(a.ansvarig)) fel.push('Affären ”' + a.titel + '” har en ansvarig som inte finns.'); });
    d.offerter.forEach(function (o) { if (!finns(d.affarer, o.affar)) fel.push('Offert ' + o.nummer + ' pekar på en affär som saknas.'); });
    d.projekt.forEach(function (p) { if (!finns(d.affarer, p.affar)) fel.push('Ett projekt pekar på en affär som saknas.'); });
    d.uppgifter.forEach(function (u) { if (!finns(d.kunder, u.kund) || !finns(d.affarer, u.affar)) fel.push('Uppgiften ”' + u.text + '” pekar på något som saknas.'); });
    return fel;
  }
  IH.sak = { inst: inst, kopplingsBrott: kopplingsBrott, logg: logg, utloggMin: utloggMin };

  /* 04 Export och återställning ------------------------------------------------------------------- */
  IH.G['ad-exportera'] = function () {
    if (!IH.kravAdmin()) return;
    var blob = new Blob([JSON.stringify(db(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'legohus-crm-' + IH.dagStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    sparaInst('kopia', new Date().toISOString());
    logg('export', 'All data exporterad som JSON.');
    IH.rita();
  };
  // Återställ-knappen i sidomenyn: två klick inom fyra sekunder, sedan samma återställning som i adminpanelen
  IH.G['sido-aterstall'] = function (el) {
    if (IH.jag().roll !== 'admin') { IH.toast('Bara administratören kan återställa', null, 'las'); return; }
    if (!el.dataset.saker) { el.dataset.saker = '1'; el.classList.add('vill'); IH.toast('Klicka igen för att återställa', 'Exempeldatan läggs tillbaka som den var från början. Säkerhetsloggen finns kvar.', 'aterstall');
      setTimeout(function () { if (el.isConnected) { delete el.dataset.saker; el.classList.remove('vill'); } }, 4000); return; }
    IH.G['ad-aterstall']({ dataset: { saker: '1' }, isConnected: false });
  };
  IH.G['ad-aterstall'] = function (el) {
    if (IH.jag().roll !== 'admin') { IH.toast('Bara administratören kan återställa', null, 'las'); return; }
    if (!el.dataset.saker) { el.dataset.saker = '1'; el.dataset.fore = el.innerHTML; el.innerHTML = i('varning') + 'Klicka igen för att återställa'; setTimeout(function () { if (el.isConnected) { delete el.dataset.saker; el.innerHTML = el.dataset.fore || (i('aterstall') + 'Återställ exempeldata'); } }, 4000); return; }
    var gammal = (db().sakerhet || []).slice(), gammalHub = db().sakHub;
    IH.db = IH.skapaExempeldata();
    IH.db.sakerhet = gammal; if (gammalHub) IH.db.sakHub = gammalHub;
    logg('aterstall', 'Exempeldatan återställdes.');
    IH.uppdateraMeny();
    IH.rita();
    IH.toast('Exempeldatan är återställd', 'Säkerhetsloggen är kvar.', 'aterstall');
  };
  // Återställ-knappen under Inställningar (vyer.js): bara administratören, och säkerhetsloggen och skanningarna behålls
  var aterstallVy = IH.G.aterstall;
  IH.G.aterstall = function (el) {
    if (IH.jag().roll !== 'admin') { IH.toast('Bara administratören kan återställa', IH.visarSom && IH.visarSom() ? 'Lämna supportläget först.' : 'Be administratören om du behöver börja om med exempeldatan.', 'las'); return; }
    if (!el.classList.contains('bekrafta')) { if (aterstallVy) aterstallVy(el); return; }
    el.classList.remove('bekrafta');
    IH.G['ad-aterstall']({ dataset: { saker: '1' }, isConnected: false });
  };
})();
