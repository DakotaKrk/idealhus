/* Legohus CRM – kontrollcentralen för admin (#/kontroll), efter Uperformance CRM:s visaAdminOversikt.
   En 3D-kärna med fyra ringar (säkerhet, konton, data, drift) runt systemhälsan, en remsa med sex tal, ett kort per
   konto som säger hur kontot mår (aktivitet, försenade uppgifter, affärer som står still → Mår bra / Bör ses över /
   Behöver hjälp), förslag till admin, de senaste händelserna i säkerhetsloggen och driften (lagring, webbläsare).
   Allt räknas ur datan i webbläsaren – inga påhittade siffror. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i;
  var db = function () { return IH.db; };

  function kontoHalsa(u) {
    var d = db(), idag = new Date(); idag.setHours(0, 0, 0, 0);
    var akt = d.aktiviteter.filter(function (h) { return h.av === u.id && IH.dagarSedan(h.tid) < 14; }).length;
    var sena = d.uppgifter.filter(function (x) { return x.ansvarig === u.id && !x.klar && new Date(x.forfaller) < idag; }).length;
    var stilla = d.affarer.filter(function (a) { return a.ansvarig === u.id && a.steg !== 'vunnen' && !a.forlorad && IH.dagarSedan(a.andrad) > 14; }).length;
    var p = 100;
    if (u.roll === 'salj' && !akt) p -= 30; else if (u.roll === 'salj' && akt < 3) p -= 10;
    p -= Math.min(30, sena * 10); p -= Math.min(30, stilla * 10);
    p = Math.max(0, p);
    var skal = [];
    if (u.roll === 'salj') skal.push(akt + (akt === 1 ? ' aktivitet' : ' aktiviteter') + ' på 14 dagar');
    if (sena) skal.push(sena + (sena === 1 ? ' försenad uppgift' : ' försenade uppgifter'));
    if (stilla) skal.push(stilla + (stilla === 1 ? ' affär står still' : ' affärer står still'));
    if (!skal.length) skal.push('Inget som väntar');
    return { p: p, lage: p >= 80 ? ['bra', 'Mår bra'] : p >= 55 ? ['ses', 'Bör ses över'] : ['hjalp', 'Behöver hjälp'], skal: skal, sena: sena, stilla: stilla };
  }

  IH.vyer.kontroll = function () {
    if (IH.jag().roll !== 'admin') return { titel: 'Kontrollcentral', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + IH.emo('las') + 'Bara för administratören</h2><p class="ad-not">Byt till kontot Admin i kontomenyn.</p></section>' };
    var d = db(), S = IH.sak, k = S.kontroller(), inst = S.inst();
    // Säkerhetspoängen från säkerhetshubbens senaste skanning, annars snabbkontrollerna
    var sak = IH.sakTotal && IH.sakTotal() != null ? IH.sakTotal() : S.poang(k);
    var brott = S.kopplingsBrott();
    var storlek = 0; try { storlek = (localStorage.getItem(IH.NYCKEL) || '').length * 2; } catch (x) { /* */ }
    var konton = IH.ANVANDARE.map(function (u) { return { u: u, h: kontoHalsa(u) }; });
    var kontoPoang = Math.round(konton.reduce(function (t, x) { return t + x.h.p; }, 0) / konton.length);
    var dataPoang = Math.max(0, 100 - brott.length * 15);
    var driftPoang = Math.max(0, Math.round(100 - Math.max(0, storlek / 5e6 - 0.5) * 200));
    var ringar = [['Säkerhet', sak, '#8f5424'], ['Konton', kontoPoang, '#4f6f8f'], ['Data', dataPoang, '#3f6b50'], ['Drift', driftPoang, '#7b5c8f']];
    var halsa = Math.round(ringar.reduce(function (t, r) { return t + r[1]; }, 0) / ringar.length);
    var online = IH.ANVANDARE.filter(function (u) { return IH.narvaro && IH.narvaro(u.id).id === 'online'; }).length;
    // Förslag till admin (som adminForslag i Uperformance)
    var forslag = [];
    if (!(+inst.utlogg)) forslag.push(['klocka', 'Slå på utloggning vid inaktivitet', 'Datorer som lämnas olåsta loggas ut av sig själva.', '#/admin']);
    if (!inst.kopia || IH.dagarSedan(inst.kopia) > 7) forslag.push(['ladda-ner', 'Gör en säkerhetskopia', inst.kopia ? 'Senaste exporten är ' + IH.dagarSedan(inst.kopia) + ' dagar gammal.' : 'Ingen export är gjord än.', '#/admin']);
    if (brott.length) forslag.push(['varning', brott.length + ' trasiga kopplingar i datan', brott[0], '#/sakerhet']);
    konton.filter(function (x) { return x.h.lage[0] !== 'bra'; }).forEach(function (x) { forslag.push(['anstallda', x.u.namn + ' ' + x.h.lage[1].toLowerCase(), x.h.skal.join(' · '), '#/profil/' + x.u.id]); });
    if (storlek > 3.5e6) forslag.push(['databas', 'Lagringen börjar bli full', Math.round(storlek / 1024) + ' kB – rensa bilder i chatten eller exportera.', '#/admin']);
    var logg = (d.sakerhet || []).slice(0, 6);

    var karna = '<div class="kc-karna" aria-hidden="true"><div class="kc-scen">' + ringar.map(function (r, n) {
      return '<span class="kc-ring" style="--f:' + r[2] + ';--p:' + r[1] + ';--n:' + n + '"><i></i></span>';
    }).join('') + '</div><div class="kc-mitt"><b>' + halsa + '</b><small>systemhälsa</small></div></div>';
    var html = '<section class="kc-hjalte kort kort--mork" data-in>' + karna +
        '<div class="kc-text"><p class="etikett etikett--ljus">Kontrollcentralen</p><h1>Systemet ' + (halsa >= 85 ? 'mår bra' : halsa >= 65 ? 'behöver lite tillsyn' : 'behöver åtgärdas') + '</h1>' +
          '<p>' + (forslag.length ? forslag.length + (forslag.length === 1 ? ' förslag väntar' : ' förslag väntar') + ' på dig.' : 'Inga förslag just nu.') + ' Ringarna visar säkerhet, konton, data och drift – full ring är 100.</p>' +
          '<ul class="kc-ringlista">' + ringar.map(function (r) { return '<li style="--f:' + r[2] + '"><i></i>' + r[0] + '<b>' + r[1] + '</b></li>'; }).join('') + '</ul>' +
          '<div class="kc-knappar"><a class="knapp knapp--virke" href="#/sakerhet">' + IH.emo('skold') + 'Säkerhetshubben</a><a class="knapp" href="#/admin">' + i('installning') + 'Adminpanelen</a></div></div></section>' +
      '<div class="kc-remsa" data-in>' + [
        ['Konton', IH.ANVANDARE.length, online + ' online nu'], ['Kunder', d.kunder.length, d.forfragningar.filter(function (f) { return f.status === 'ny'; }).length + ' nya förfrågningar'],
        ['Öppna affärer', d.affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).length, IH.kort(d.affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).reduce(function (t, a) { return t + a.varde; }, 0))],
        ['Projekt', d.projekt.filter(function (p) { return p.steg !== 'klart'; }).length, 'i produktion'], ['Säkerhet', sak, 'av 100'], ['Data', Math.round(storlek / 1024) + ' kB', 'av cirka 5 MB']
      ].map(function (t) { return '<div><small>' + t[0] + '</small><b class="tal">' + t[1] + '</b><span>' + e(String(t[2])) + '</span></div>'; }).join('') + '</div>' +
      '<section class="ad-band kort" data-in><h2>' + IH.emo('anstallda') + 'Hur kontona mår</h2><div class="kc-konton">' + konton.map(function (x) {
        var n = IH.narvaro ? IH.narvaro(x.u.id) : { namn: '', farg: '#ccc' };
        return '<article class="kc-konto kc-konto--' + x.h.lage[0] + '"><header><span class="avatar" style="--av:' + x.u.farg + '">' + IH.initialer(x.u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(x.u.id) : '') + '</span>' +
          '<div><b>' + e(x.u.namn) + '</b><small>' + e(x.u.titel) + ' · ' + e(n.namn) + '</small></div><span class="kc-lage">' + x.h.lage[1] + '</span></header>' +
          '<span class="kc-matare"><i style="--a:' + (x.h.p / 100).toFixed(2) + '"></i></span><p>' + e(x.h.skal.join(' · ')) + '</p>' +
          (x.u.roll !== 'admin' ? '<a class="knapp knapp--liten" href="#/profil/' + x.u.id + '">' + i('kunder') + 'Profil</a>' : '') + '</article>';
      }).join('') + '</div></section>' +
      '<div class="ad-tva">' +
        '<section class="ad-band kort" data-in><h2>' + IH.emo('glodlampa') + 'Förslag</h2>' + (forslag.length ? '<ul class="kc-forslag">' + forslag.map(function (f) {
          return '<li><a href="' + f[3] + '">' + IH.emo(f[0], 'kc-forslag__ikon') + '<span><b>' + e(f[1]) + '</b><small>' + e(f[2]) + '</small></span>' + i('pil') + '</a></li>';
        }).join('') + '</ul>' : '<p class="ad-not">' + IH.emo('klar') + ' Inga förslag – allt ser bra ut.</p>') + '</section>' +
        '<section class="ad-band kort" data-in><h2>' + IH.emo('server') + 'Drift</h2><dl class="kc-drift">' +
          '<div><dt>Lagring</dt><dd><span class="kc-matare"><i style="--a:' + Math.min(1, storlek / 5e6).toFixed(3) + '"></i></span>' + Math.round(storlek / 1024) + ' kB</dd></div>' +
          '<div><dt>Datamodell</dt><dd>Version ' + (d.version || '–') + '</dd></div>' +
          '<div><dt>Anslutning</dt><dd>' + (location.protocol === 'https:' ? 'Krypterad (https)' : 'Lokal förhandsvisning') + '</dd></div>' +
          '<div><dt>Utloggning</dt><dd>' + (+inst.utlogg ? 'Efter ' + inst.utlogg + ' min' : 'Av') + '</dd></div>' +
          '<div><dt>Senaste export</dt><dd>' + (inst.kopia ? IH.sedan(inst.kopia) : 'Ingen') + '</dd></div></dl>' +
          '<p class="ad-etikett">Senaste händelserna</p>' + (logg.length ? '<ol class="ad-logg">' + logg.map(function (h) { var u = IH.anvandare(h.av); return '<li><span class="ad-logg__typ">' + e(h.typ) + '</span><span>' + e(h.text) + '</span><small>' + e(u ? u.namn : '') + ' · ' + IH.sedan(h.tid) + '</small></li>'; }).join('') + '</ol>' : '<p class="ad-not">Inga händelser än.</p>') +
        '</section></div>';
    return { titel: 'Kontrollcentral', html: html };
  };
})();
