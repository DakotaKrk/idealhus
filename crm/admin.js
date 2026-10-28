/* Legohus CRM – admin: adminpanelen och säkerhetshubben (2026-10-28, efter Uperformance CRM:s sakerhet.js).
   - Adminkontot (roll admin) får Admin och Säkerhet i menyn.
   - #/admin: kontona, behörigheterna per roll, inställningar (utloggning vid inaktivitet), system (lagring,
     export, återställ exempeldata) och säkerhetsloggen.
   - #/sakerhet: kontroller som körs på riktigt i webbläsaren – kopplingar i datan, skript på sidan, https,
     utloggning vid inaktivitet, säkerhetskopia och lagring – med en ring per kontroll och en samlad poäng.
   - Utloggning vid inaktivitet gäller alla konton: en minut före visas en nedräkning med Fortsätt.
   Prototyp: allt ligger i webbläsaren. Skarp drift kräver server, riktig inloggning och serverns logg. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i;
  var db = function () { return IH.db; };
  var arAdmin = function () { return IH.jag().roll === 'admin'; };

  /* 01 Säkerhetsloggen ---------------------------------------------------------------------------- */
  function logg(typ, text) {
    var d = db();
    d.sakerhet = d.sakerhet || [];
    d.sakerhet.unshift({ tid: new Date().toISOString(), typ: typ, text: text, av: IH.jag().id });
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
    if (arAdmin()) IH.ga('#/admin');
  };

  /* 02 Inställningar och utloggning vid inaktivitet --------------------------------------------- */
  var INST = 'ih-crm-admin';
  function inst() { try { return JSON.parse(localStorage.getItem(INST)) || {}; } catch (x) { return {}; } }
  function sparaInst(nyckel, varde) { var o = inst(); o[nyckel] = varde; try { localStorage.setItem(INST, JSON.stringify(o)); } catch (x) { /* privat läge */ } }
  var UTLOGG = [[0, 'Av'], [15, '15 min'], [30, '30 min'], [60, '1 timme']];
  var senast = Date.now(), varnad = null, varnTimer = 0;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { document.addEventListener(t, function () { senast = Date.now(); if (varnad) stangVarning(); }, { passive: true, capture: true }); });
  function stangVarning() { if (varnad) { varnad.remove(); varnad = null; clearInterval(varnTimer); } }
  setInterval(function () {
    var min = +inst().utlogg || 0;
    if (!min || !localStorage.getItem('ih-crm-inloggad')) return;
    var kvar = min * 60000 - (Date.now() - senast);
    if (kvar <= 0) { stangVarning(); logg('inaktiv', 'Utloggad efter ' + min + ' minuter utan aktivitet.'); IH.G['logga-ut'](); return; }
    if (kvar <= 60000 && !varnad) {
      varnad = document.createElement('div');
      varnad.className = 'ad-varning'; varnad.setAttribute('role', 'alertdialog');
      varnad.innerHTML = IH.emo('klocka', 'ad-varning__ikon') + '<div><b>Du loggas snart ut</b><small>Ingen aktivitet på en stund. <span data-ad-kvar>60</span> s kvar.</small></div><button class="knapp knapp--virke knapp--liten" type="button">Fortsätt</button>';
      varnad.querySelector('button').addEventListener('click', function () { senast = Date.now(); stangVarning(); });
      document.body.appendChild(varnad);
      varnTimer = setInterval(function () { var s = varnad && varnad.querySelector('[data-ad-kvar]'); if (s) s.textContent = Math.max(0, Math.ceil((min * 60000 - (Date.now() - senast)) / 1000)); }, 500);
    }
  }, 5000);

  /* 03 Kontrollerna (säkerhetshubben) ------------------------------------------------------------- */
  var KANDA = ['data.js', 'app.js', 'mote.js', 'vyer.js', 'ledning.js', 'chatt.js', 'admin.js', 'valj.js', 'kalender.js', 'overgang.js', 'grund.js'];
  function kopplingsBrott() {
    var d = db(), fel = [];
    var finns = function (lista, id) { return !id || lista.some(function (x) { return x.id === id; }); };
    d.affarer.forEach(function (a) { if (!finns(d.kunder, a.kund)) fel.push('Affären "' + a.titel + '" pekar på en kund som saknas.'); });
    d.offerter.forEach(function (o) { if (!finns(d.affarer, o.affar)) fel.push('Offert ' + o.nummer + ' pekar på en affär som saknas.'); });
    d.projekt.forEach(function (p) { if (!finns(d.affarer, p.affar)) fel.push('Ett projekt pekar på en affär som saknas.'); });
    d.uppgifter.forEach(function (u) { if (!finns(d.kunder, u.kund) || !finns(d.affarer, u.affar)) fel.push('Uppgiften "' + u.text + '" pekar på något som saknas.'); });
    return fel;
  }
  function kontroller() {
    var skript = Array.prototype.map.call(document.scripts, function (s) { return s.src ? s.src.split('/').pop().split('?')[0] : null; }).filter(Boolean);
    var okanda = skript.filter(function (s) { return KANDA.indexOf(s) < 0; });
    var brott = kopplingsBrott();
    var storlek = 0; try { storlek = (localStorage.getItem(IH.NYCKEL) || '').length * 2; } catch (x) { /* */ }
    var kopia = inst().kopia, dagarKopia = kopia ? IH.dagarSedan(kopia) : null;
    var https = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var utlogg = +inst().utlogg || 0;
    return [
      { id: 'kopplingar', namn: 'Kopplingar i datan', farg: '#22a35a', ok: !brott.length, varn: false, text: brott.length ? brott.length + ' trasiga kopplingar' : 'Alla affärer, offerter, projekt och uppgifter pekar rätt', detaljer: brott.slice(0, 5) },
      { id: 'skript', namn: 'Skript på sidan', farg: '#4f6f8f', ok: !okanda.length, varn: false, text: okanda.length ? 'Okända skript: ' + okanda.join(', ') : skript.length + ' kända skript, inga okända' },
      { id: 'https', namn: 'Krypterad anslutning', farg: '#8f5424', ok: https, varn: false, text: location.protocol === 'https:' ? 'Sidan går över https' : https ? 'Lokal förhandsvisning – https krävs i drift' : 'Sidan går inte över https' },
      { id: 'utlogg', namn: 'Utloggning vid inaktivitet', farg: '#e8a456', ok: !!utlogg, varn: !utlogg, text: utlogg ? 'Efter ' + utlogg + ' minuter utan aktivitet' : 'Av – slå på under Inställningar' },
      { id: 'kopia', namn: 'Säkerhetskopia', farg: '#7b5c8f', ok: dagarKopia !== null && dagarKopia <= 7, varn: dagarKopia === null || dagarKopia > 7, text: dagarKopia === null ? 'Ingen export gjord än' : 'Senaste export ' + IH.sedan(kopia) },
      { id: 'lagring', namn: 'Lagring', farg: '#3d6a73', ok: storlek < 4e6, varn: storlek >= 4e6, text: Math.round(storlek / 1024) + ' kB av webbläsarens cirka 5 MB' }
    ];
  }
  function poang(k) { return Math.round(k.reduce(function (t, x) { return t + (x.ok ? 1 : x.varn ? 0.5 : 0); }, 0) / k.length * 100); }

  /* 04 Säkerhetshubben #/sakerhet ----------------------------------------------------------------- */
  IH.vyer.sakerhet = function () {
    if (!arAdmin()) return spar('Säkerhet');
    var k = kontroller(), p = poang(k);
    var R0 = 34, steg = 9;
    var ringar = k.map(function (x, n) {
      var r = R0 + n * steg, O = 2 * Math.PI * r;
      return '<circle cx="100" cy="100" r="' + r + '" class="ad-ring__spar"/><circle cx="100" cy="100" r="' + r + '" class="ad-ring__bage' + (x.ok ? '' : x.varn ? ' varn' : ' fel') + '" style="--f:' + x.farg + ';stroke-dasharray:' + (O * (x.ok ? 1 : x.varn ? 0.5 : 0.15)).toFixed(1) + ' ' + O.toFixed(1) + ';--d:' + (n * 90) + 'ms"/>';
    }).join('');
    var html = '<section class="ad-hjalte kort kort--mork" data-in>' +
        '<svg class="ad-ring" viewBox="0 0 200 200" aria-hidden="true">' + ringar + '</svg>' +
        '<div><p class="etikett etikett--ljus">Säkerhetshubben</p><h1>' + p + ' <small>av 100</small></h1><p>' + k.filter(function (x) { return x.ok; }).length + ' av ' + k.length + ' kontroller är gröna. Kontrollerna körs i din webbläsare varje gång sidan öppnas.</p>' +
        '<button class="knapp knapp--virke" type="button" data-g="ad-skanna">' + i('aterstall') + 'Kör kontrollerna igen</button></div></section>' +
      '<div class="ad-kontroller">' + k.map(function (x) {
        return '<article class="ad-kontroll kort' + (x.ok ? ' ok' : x.varn ? ' varn' : ' fel') + '" style="--f:' + x.farg + '" data-in><header><i></i><b>' + e(x.namn) + '</b><span>' + (x.ok ? 'OK' : x.varn ? 'Bör ses över' : 'Åtgärda') + '</span></header>' +
          '<p>' + e(x.text) + '</p>' + (x.detaljer && x.detaljer.length ? '<ul>' + x.detaljer.map(function (t) { return '<li>' + e(t) + '</li>'; }).join('') + '</ul>' : '') + '</article>';
      }).join('') + '<article class="ad-kontroll ad-kontroll--alla kort" data-in><header>' + IH.emo('skold') + '<b>Hela skyddet</b></header><p>Det här är en prototyp: data ligger i webbläsaren. Skarp drift behöver server, riktig inloggning med tvåstegsverifiering, behörigheter i databasen, kryptering och daglig säkerhetskopia.</p></article></div>';
    return { titel: 'Säkerhet', html: html };
  };
  IH.G['ad-skanna'] = function () {
    var k = kontroller();
    logg('skanning', 'Kontrollerna körda: ' + poang(k) + ' av 100.');
    IH.rita();
    IH.toast('Kontrollerna är klara', poang(k) + ' av 100', 'system');
  };

  /* 05 Adminpanelen #/admin ----------------------------------------------------------------------- */
  var ROLLER = [['salj', 'Sälj'], ['prod', 'Produktion'], ['admin', 'Admin']];
  var BEHORIG = [
    ['Förfrågningar och säljtavla', ['salj', 'admin']], ['Kunder och offerter', ['salj', 'prod', 'admin']], ['Projekt och montage', ['salj', 'prod', 'admin']],
    ['Försäljningsledning', ['chef']], ['Meddelanden', ['salj', 'prod', 'admin']], ['Adminpanelen och säkerheten', ['admin']]
  ];
  IH.vyer.admin = function () {
    if (!arAdmin()) return spar('Admin');
    var d = db(), utlogg = +inst().utlogg || 0;
    var konton = '<table class="ad-tabell"><thead><tr><th>Konto</th><th>Roll</th><th>Status</th><th>Affärer</th><th>Aktiviteter 30 d</th></tr></thead><tbody>' + IH.ANVANDARE.map(function (u) {
      var n = IH.narvaro ? IH.narvaro(u.id) : { namn: '–', farg: '#ccc' };
      return '<tr><td><span class="ad-konto"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><b>' + e(u.namn) + '</b></span></td><td>' + e(u.titel) + '</td>' +
        '<td><span class="ad-status" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</span></td><td class="tal">' + d.affarer.filter(function (a) { return a.ansvarig === u.id; }).length + '</td>' +
        '<td class="tal">' + d.aktiviteter.filter(function (h) { return h.av === u.id && IH.dagarSedan(h.tid) < 30; }).length + '</td></tr>';
    }).join('') + '</tbody></table>';
    var behorig = '<table class="ad-tabell ad-tabell--matris"><thead><tr><th>Del av CRM:et</th><th>Sälj</th><th>Produktion</th><th>Chef</th><th>Admin</th></tr></thead><tbody>' + BEHORIG.map(function (b) {
      var har = function (r) { return b[1].indexOf(r) >= 0 || (r === 'chef' && b[1].indexOf('salj') >= 0); };
      return '<tr><td>' + e(b[0]) + '</td>' + ['salj', 'prod', 'chef', 'admin'].map(function (r) { return '<td>' + (har(r) ? '<span class="ad-ja">' + IH.emo('bock') + '</span>' : '<span class="ad-nej">–</span>') + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table><p class="ad-not">Prototyp: rollerna styr menyn. I skarp drift ska behörigheten kontrolleras i databasen, inte bara i webbläsaren.</p>';
    var storlek = 0; try { storlek = (localStorage.getItem(IH.NYCKEL) || '').length * 2; } catch (x) { /* */ }
    var logg = (d.sakerhet || []).slice(0, 12);
    var html = '<section class="ad-hjalte ad-hjalte--panel kort kort--mork" data-in><div><p class="etikett etikett--ljus">Adminpanelen</p><h1>System och konton</h1>' +
        '<p>' + IH.ANVANDARE.length + ' konton · ' + d.kunder.length + ' kunder · ' + d.affarer.length + ' affärer · ' + Math.round(storlek / 1024) + ' kB data. Säkerhetspoäng <b>' + poang(kontroller()) + '</b> av 100.</p></div>' +
        '<a class="knapp knapp--virke" href="#/sakerhet">' + IH.emo('skold') + 'Säkerhetshubben</a></section>' +
      '<section class="ad-band kort" data-in><h2>' + IH.emo('kunder') + 'Konton</h2>' + konton + '</section>' +
      '<div class="ad-tva">' +
        '<section class="ad-band kort" data-in><h2>' + IH.emo('las') + 'Behörigheter</h2>' + behorig + '</section>' +
        '<section class="ad-band kort" data-in><h2>' + IH.emo('installningar') + 'Inställningar</h2>' +
          '<p class="ad-etikett">Logga ut vid inaktivitet</p><div class="ad-val">' + UTLOGG.map(function (u) {
            return '<button type="button" data-g="ad-utlogg" data-v="' + u[0] + '" aria-pressed="' + (utlogg === u[0]) + '">' + u[1] + '</button>';
          }).join('') + '</div><p class="ad-not">Gäller alla konton i den här webbläsaren. En minut före visas en nedräkning.</p>' +
          '<p class="ad-etikett">Data</p><div class="ad-knappar"><button class="knapp" type="button" data-g="ad-exportera">' + i('skrivut') + 'Exportera allt (JSON)</button>' +
          '<button class="knapp knapp--fara" type="button" data-g="ad-aterstall">' + i('aterstall') + 'Återställ exempeldata</button></div>' +
          '<p class="ad-not">Senaste export: ' + (inst().kopia ? IH.sedan(inst().kopia) : 'ingen än') + '.</p></section>' +
      '</div>' +
      '<section class="ad-band kort" data-in><h2>' + IH.emo('anteckning') + 'Säkerhetsloggen</h2>' + (logg.length ? '<ol class="ad-logg">' + logg.map(function (h) {
        var u = IH.anvandare(h.av);
        return '<li><span class="ad-logg__typ">' + e(h.typ) + '</span><span>' + e(h.text) + '</span><small>' + e(u ? u.namn : '') + ' · ' + IH.sedan(h.tid) + '</small></li>';
      }).join('') + '</ol>' : '<p class="ad-not">Inga händelser än. Kontobyten, exporter, inställningar och kontroller loggas här.</p>') + '</section>';
    return { titel: 'Admin', html: html };
  };
  function spar(titel) {
    return { titel: titel, html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + IH.emo('las') + 'Bara för administratören</h2><p class="ad-not">Byt till kontot Admin i kontomenyn för att se den här sidan.</p></section>' };
  }
  IH.G['ad-utlogg'] = function (el) {
    var v = +el.getAttribute('data-v');
    sparaInst('utlogg', v);
    logg('installning', 'Utloggning vid inaktivitet: ' + (v ? v + ' min' : 'av') + '.');
    IH.rita();
    IH.toast('Sparat', v ? 'Utloggning efter ' + v + ' min utan aktivitet.' : 'Utloggning vid inaktivitet är av.', 'bock');
  };
  IH.G['ad-exportera'] = function () {
    var blob = new Blob([JSON.stringify(db(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'legohus-crm-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    sparaInst('kopia', new Date().toISOString());
    logg('export', 'All data exporterad som JSON.');
    IH.rita();
  };
  IH.G['ad-aterstall'] = function (el) {
    if (!el.dataset.saker) { el.dataset.saker = '1'; el.innerHTML = i('varning') + 'Klicka igen för att återställa'; setTimeout(function () { if (el.isConnected) { delete el.dataset.saker; el.innerHTML = i('aterstall') + 'Återställ exempeldata'; } }, 4000); return; }
    var gammal = (db().sakerhet || []).slice();
    IH.db = IH.skapaExempeldata();
    IH.db.sakerhet = gammal;
    logg('aterstall', 'Exempeldatan återställdes.');
    IH.uppdateraMeny();
    IH.rita();
    IH.toast('Exempeldatan är återställd', 'Säkerhetsloggen är kvar.', 'aterstall');
  };
})();
