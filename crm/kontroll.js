/* Legohus CRM – kontrollcentralen för admin (#/kontroll), samma upplägg som Uperformance CRM:s visaAdminOversikt.
   Hjälten: hälsningen, "Hela CRM:et i en blick", knapparna, kärnan med fyra ringar (säkerhet, konton, data, drift)
   runt systemhälsan och remsan med sex tal. Sedan banden: 01 Hur kontona mår, 02 Skyddet just nu, 03 Datan och
   kopplingarna, 04 Vem gör vad och när, 05 Senast i CRM:et, 06 System och fel, 07 Bör åtgärdas med snabbåtgärder
   och verktyg. Allt räknas ur datan och säkerhetshubbens kontroller i webbläsaren – inga påhittade siffror. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i, ik = function (n, k) { return IH.emo(n, k); };
  var db = function () { return IH.db; };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var LAGE = { bra: 'Mår bra', se: 'Bör ses över', hjalp: 'Behöver hjälp' };
  var tonFor = function (p) { return p == null ? 'is' : p >= 85 ? 'gron' : p >= 60 ? 'gul' : 'rod'; };
  var dag0 = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  function dagar14() { var ut = [], idag = dag0(new Date()); for (var n = 13; n >= 0; n--) { var d = new Date(idag); d.setDate(idag.getDate() - n); ut.push(d); } return ut; }
  function perDag(uid, dagar) { return dagar.map(function (dag) { var nasta = new Date(dag); nasta.setDate(dag.getDate() + 1); return db().aktiviteter.filter(function (h) { var t = new Date(h.tid); return h.av === uid && t >= dag && t < nasta; }).length; }); }
  function sparkline(v, b, h) {
    var max = Math.max.apply(null, v.concat([1])), dx = b / Math.max(1, v.length - 1);
    var pts = v.map(function (x, n) { return [n * dx, h - (x / max) * (h - 4) - 2]; });
    var d = pts.map(function (p, n) { return (n ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    return '<svg viewBox="0 0 ' + b + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'L' + b + ' ' + h + 'L0 ' + h + 'Z" class="ao-spark__yta"/><path d="' + d + '" class="ao-spark__linje"/></svg>';
  }
  function lagring() { var b = 0; try { for (var n = 0; n < localStorage.length; n++) { var k = localStorage.key(n); if (/^ih-/.test(k)) b += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (x) { /* */ } return b; }
  var kb = function (b) { return b >= 1048576 ? (b / 1048576).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' MB' : Math.round(b / 1024) + ' kB'; };

  /* Lägena ------------------------------------------------------------------------------------------- */
  function kontoHalsa(u, brott) {
    var d = db(), p = 100, punkter = [], idag = dag0(new Date());
    var n = IH.narvaro ? IH.narvaro(u.id) : { id: 'online' }, nu = ['online', 'mote', 'upptagen', 'ute'].indexOf(n.id) >= 0;
    var mina = d.aktiviteter.filter(function (h) { return h.av === u.id; }).sort(function (a, b) { return a.tid < b.tid ? 1 : -1; });
    var ds = mina.length ? IH.dagarSedan(mina[0].tid) : null;
    if (!nu && u.roll !== 'admin') { if (ds == null) p -= 25; else if (ds > 14) p -= 35; else if (ds > 7) p -= 18; }
    punkter.push({ ikon: 'puls', namn: 'Aktivitet', ok: nu || (ds != null && ds <= 7) || u.roll === 'admin', text: nu ? 'Aktiv nu · ' + n.namn : ds == null ? 'Inget loggat' : 'Senast ' + IH.sedan(mina[0].tid) });
    var forf = d.uppgifter.filter(function (x) { return x.ansvarig === u.id && !x.klar && dag0(x.forfaller) < idag; });
    p -= Math.min(30, forf.length * 8);
    punkter.push({ ikon: 'todo', namn: 'Uppgifter', ok: !forf.length, text: forf.length ? plural(forf.length, 'förfallen', 'förfallna') : 'Inga förfallna' });
    if (u.roll === 'salj') {
      var oppna = d.affarer.filter(function (a) { return a.ansvarig === u.id && a.steg !== 'vunnen' && !a.forlorad; }), stilla = oppna.filter(function (a) { return IH.dagarSedan(a.andrad) >= 14; });
      p -= Math.min(24, stilla.length * 6);
      punkter.push({ ikon: 'portfolj', namn: 'Affärer', ok: !stilla.length, text: stilla.length ? stilla.length + ' stilla i 14+ d' : plural(oppna.length, 'öppen', 'öppna') + ', ingen stilla' });
    } else if (u.roll === 'prod') {
      var pr = d.projekt.filter(function (x) { return x.steg !== 'klart'; }), st = pr.filter(function (x) { return IH.dagarSedan(x.andrad) >= 21; });
      p -= Math.min(24, st.length * 6);
      punkter.push({ ikon: 'projekt', namn: 'Projekt', ok: !st.length, text: st.length ? st.length + ' står still 21+ d' : pr.length + ' pågående, inget stilla' });
    } else {
      var hub = IH.sakHub && IH.sakHub.hub().historik[0], ok = !!hub && IH.dagarSedan(hub.tid) <= 7; if (!ok) p -= 10;
      punkter.push({ ikon: 'radar', namn: 'Säkerhet', ok: ok, text: hub ? 'Skannat ' + IH.sedan(hub.tid) : 'Ingen skanning än' });
    }
    var mitt = u.roll === 'salj' ? brott.filter(function (t) { return t.indexOf('Affären') === 0; }).length : 0;
    p -= Math.min(30, mitt * 15);
    punkter.push({ ikon: 'nyckelverktyg', namn: 'Data', ok: !mitt, text: mitt ? plural(mitt, 'trasig koppling', 'trasiga kopplingar') : 'Buggfritt' });
    var saknas = u.roll === 'salj' && !u.mal ? ['årsmål'] : [];
    p -= saknas.length * 3;
    punkter.push({ ikon: 'anstallda', namn: 'Profil', ok: !saknas.length, text: saknas.length ? 'Saknar ' + saknas.join(', ') : 'Komplett' });
    p = Math.max(0, Math.min(100, Math.round(p)));
    return { poang: p, lage: p >= 85 ? 'bra' : p >= 60 ? 'se' : 'hjalp', punkter: punkter };
  }
  function dataLage(brott) {
    var d = db(), dubb = 0;
    ['kunder', 'affarer', 'offerter', 'projekt', 'uppgifter', 'aktiviteter'].forEach(function (s) { var sett = {}; (d[s] || []).forEach(function (x) { if (sett[x.id]) dubb++; sett[x.id] = 1; }); });
    var ogiltiga = d.affarer.filter(function (a) { return !isFinite(a.varde) || a.varde < 0; }).length + d.uppgifter.filter(function (t) { return t.forfaller && isNaN(Date.parse(t.forfaller)); }).length;
    return { brott: brott.length, dubb: dubb, ogiltiga: ogiltiga, poang: Math.max(0, 100 - brott.length * 8 - dubb * 10 - ogiltiga * 6) };
  }
  function driftLage() {
    var fel = IH.sakHub ? IH.sakHub.fel : [], skriv = true;
    try { localStorage.setItem('ih-crm-skrivprov', '1'); localStorage.removeItem('ih-crm-skrivprov'); } catch (x) { skriv = false; }
    var bytes = lagring(), online = navigator.onLine !== false, full = bytes > 4 * 1048576;
    return { fel: fel, skriv: skriv, bytes: bytes, online: online, full: full, poang: Math.max(0, 100 - Math.min(50, fel.length * 10) - (skriv ? 0 : 40) - (full ? 20 : 0) - (online ? 0 : 20)) };
  }
  function karna(delar, total) {
    var R = [104, 88, 72, 56], streck = '';
    var ringar = delar.map(function (x, n) { var r = R[n], l = 2 * Math.PI * r, p = x.p == null ? 0 : x.p / 100;
      return '<circle cx="120" cy="120" r="' + r + '" class="ao-ring-spar"/><circle cx="120" cy="120" r="' + r + '" class="ao-ring-bage" data-del="' + x.id + '" style="animation-delay:' + (n * 0.1) + 's" stroke-dasharray="' + (l * p).toFixed(1) + ' ' + l.toFixed(1) + '"/>'; }).join('');
    for (var n = 0; n < 72; n++) { var v = (n / 72) * Math.PI * 2, r0 = n % 6 ? 114 : 110; streck += 'M' + (120 + Math.cos(v) * r0).toFixed(1) + ' ' + (120 + Math.sin(v) * r0).toFixed(1) + 'L' + (120 + Math.cos(v) * 118).toFixed(1) + ' ' + (120 + Math.sin(v) * 118).toFixed(1); }
    return '<div class="ao-karna" aria-hidden="true"><div class="ao-scen"><i class="ao-golv"></i><i class="ao-orbit ao-o1"><b></b></i><i class="ao-orbit ao-o2"><b></b></i><i class="ao-orbit ao-o3"><b></b></i>' +
      '<svg class="ao-ringar" viewBox="0 0 240 240"><defs><filter id="ao-glod" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4.5"/></filter></defs>' +
        '<path d="' + streck + '" class="ao-streck"/>' +
        // neonen: ett suddigt lager under som andas, de skarpa bågarna över och en komet som löper runt varje ring
        '<g class="ao-glodlager" filter="url(#ao-glod)">' + delar.map(function (x, n) { var r = R[n], l = 2 * Math.PI * r, p = x.p == null ? 0 : x.p / 100; return '<circle cx="120" cy="120" r="' + r + '" class="ao-ring-bage ao-ring-glod" data-del="' + x.id + '" style="animation-delay:' + (n * 0.1) + 's,' + (n * 0.4) + 's" stroke-dasharray="' + (l * p).toFixed(1) + ' ' + l.toFixed(1) + '"/>'; }).join('') + '</g>' +
        ringar +
        delar.map(function (x, n) { var r = R[n], l = 2 * Math.PI * r; return '<circle cx="120" cy="120" r="' + r + '" class="ao-komet" data-del="' + x.id + '" style="--l:' + l.toFixed(1) + ';--t:' + (5 + n * 1.6) + 's" stroke-dasharray="10 ' + (l - 10).toFixed(1) + '"/>'; }).join('') + '</svg>' +
      '<div class="ao-mitt"><strong>' + (total == null ? '–' : total) + '</strong><small>Systemhälsa</small><span>' + (total == null ? 'Kör en skanning' : LAGE[total >= 85 ? 'bra' : total >= 60 ? 'se' : 'hjalp']) + '</span></div></div></div>';
  }
  function forslagLista(brott, dl, dr) {
    var d = db(), inst = IH.sak ? IH.sak.inst() : {}, ut = [], H = IH.sakHub;
    var hist = H && H.hub().historik[0];
    if (!hist) ut.push({ ikon: 'radar', text: 'Ingen säkerhetsskanning gjord', under: 'Kör alla sju kontroller – tar några sekunder', g: 'sh-skanna-ga', knapp: 'Skanna nu' });
    else if (IH.dagarSedan(hist.tid) > 7) ut.push({ ikon: 'radar', text: 'Senaste skanningen är ' + IH.dagarSedan(hist.tid) + ' dagar gammal', under: 'Skanna minst en gång i veckan', g: 'sh-skanna-ga', knapp: 'Skanna' });
    if (H) H.kontroller.forEach(function (k) { var r = H.hub().senast[k.id], hog = r ? r.fynd.filter(function (x) { return x.allvar === 'hog'; }) : []; if (hog.length) ut.push({ ikon: 'skold-larm', text: k.namn + ': fynd med hög allvarlighet', under: hog[0].text, lank: '#/sakerhet', knapp: 'Visa' }); });
    if (!(+inst.utlogg)) ut.push({ ikon: 'klocka', text: 'Utloggning vid inaktivitet är av', under: 'Datorer som lämnas olåsta loggas ut av sig själva', lank: '#/admin', knapp: 'Slå på' });
    if (!inst.kopia || IH.dagarSedan(inst.kopia) > 7) ut.push({ ikon: 'ladda-ner', text: inst.kopia ? 'Säkerhetskopian är ' + IH.dagarSedan(inst.kopia) + ' dagar gammal' : 'Ingen säkerhetskopia', under: 'Exportera all data som JSON', g: 'ad-exportera', knapp: 'Exportera' });
    if (dl.brott) ut.push({ ikon: 'nyckelverktyg', text: plural(dl.brott, 'trasig koppling', 'trasiga kopplingar'), under: brott[0], g: 'sh-skanna-ga', data: 'buggar', knapp: 'Kontrollera' });
    if (dr.fel.length) ut.push({ ikon: 'bugg', text: plural(dr.fel.length, 'fel', 'fel') + ' sedan sidan laddades', under: 'Skript eller filer som inte fungerade', g: 'sh-skanna-ga', data: 'buggar', knapp: 'Kontrollera' });
    IH.ANVANDARE.filter(function (u) { return u.roll === 'salj' && !u.mal; }).forEach(function (u) { ut.push({ ikon: 'mal', text: u.namn + ' saknar årsmål', under: 'Försäljningsledningen räknar mot målet', lank: '#/profil/' + u.id, knapp: 'Profil' }); });
    d.forfragningar.filter(function (f) { return f.status === 'ny' && !f.tilldelad; }).slice(0, 2).forEach(function (f) { ut.push({ ikon: 'inkorg', text: 'Förfrågan utan ansvarig: ' + f.namn, under: 'Kom ' + IH.sedan(f.skapad), lank: '#/forfragningar/' + f.id, knapp: 'Öppna' }); });
    return ut;
  }

  /* Vyn ---------------------------------------------------------------------------------------------- */
  IH.vyer.kontroll = function () {
    if (IH.jag().roll !== 'admin') return { titel: 'Kontrollcentral', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + ik('las') + 'Bara för administratören</h2><p class="ad-not">Byt till kontot Admin i kontomenyn.</p></section>' };
    var d = db(), u0 = IH.jag(), H = IH.sakHub, S = H ? H.hub() : { senast: {}, historik: [] };
    var brott = IH.sak ? IH.sak.kopplingsBrott() : [], dl = dataLage(brott), dr = driftLage();
    var konton = IH.ANVANDARE.map(function (u) { return { u: u, h: kontoHalsa(u, brott) }; });
    var kontoP = Math.round(konton.reduce(function (t, x) { return t + x.h.poang; }, 0) / konton.length);
    var sakP = H ? H.total() : null, senast = S.historik[0];
    var delar = [{ id: 'sakerhet', namn: 'Säkerhet', p: sakP }, { id: 'konton', namn: 'Konton', p: kontoP }, { id: 'data', namn: 'Data', p: dl.poang }, { id: 'drift', namn: 'Drift', p: dr.poang }];
    var giltiga = delar.filter(function (x) { return x.p != null; }), total = giltiga.length ? Math.round(giltiga.reduce(function (t, x) { return t + x.p; }, 0) / giltiga.length) : null;
    var nuN = IH.ANVANDARE.filter(function (u) { return IH.narvaro && ['online', 'mote', 'upptagen', 'ute'].indexOf(IH.narvaro(u.id).id) >= 0; }).length;
    var fyndAlla = H ? H.kontroller.reduce(function (t, k) { var r = S.senast[k.id]; return r ? t.concat(r.fynd) : t; }, []) : [];
    var fyndN = function (a) { return fyndAlla.filter(function (x) { return x.allvar === a; }).length; };
    var h = new Date().getHours(), halsning = h < 5 ? 'God natt' : h < 10 ? 'God morgon' : h < 17 ? 'Hej' : 'God kväll';
    var SAML = [['Kunder', 'kunder'], ['Förfrågningar', 'forfragningar'], ['Affärer', 'affarer'], ['Offerter', 'offerter'], ['Projekt', 'projekt'], ['Aktiviteter', 'aktiviteter'], ['Uppgifter', 'uppgifter']];
    var antal = function (s) { return (d[s] || []).length; };
    var poster = SAML.reduce(function (t, s) { return t + antal(s[1]); }, 0) + ((d.chatt || {}).meddelanden || []).length;
    var handelser7 = d.aktiviteter.filter(function (x) { return IH.dagarSedan(x.tid) < 7; }).length;
    var remsa = [
      { ikon: 'skold', etikett: 'Säkerhet', varde: sakP == null ? '–' : sakP + '/100', under: senast ? IH.sedan(senast.tid) : 'ej skannat', ton: tonFor(sakP), href: '#/sakerhet' },
      { ikon: 'anstallda', etikett: 'I tjänst nu', varde: nuN + '/' + IH.ANVANDARE.length, under: konton.filter(function (x) { return x.h.lage === 'bra'; }).length + ' mår bra', ton: 'is', href: '#/admin' },
      { ikon: 'bugg', etikett: 'Fel i sidan', varde: String(dr.fel.length), under: dr.fel.length ? 'sedan laddning' : 'buggfritt', ton: dr.fel.length ? 'gul' : 'gron' },
      { ikon: 'nyckelverktyg', etikett: 'Kopplingar', varde: dl.brott ? dl.brott + ' fel' : 'OK', under: dl.brott ? 'trasiga' : 'allt hänger ihop', ton: dl.brott ? 'gul' : 'gron' },
      { ikon: 'databas', etikett: 'Poster', varde: poster.toLocaleString('sv-SE'), under: kb(dr.bytes), ton: 'lila' },
      { ikon: 'puls', etikett: 'Händelser', varde: String(handelser7), under: 'senaste 7 dagarna', ton: 'is' }
    ];
    var knapp = function (attr, ikon, text, accent) { var a = attr.indexOf('href') === 0; return '<' + (a ? 'a' : 'button type="button"') + ' class="sh-knapp' + (accent ? ' sh-knapp--accent' : '') + '" ' + attr + '>' + ik(ikon) + '<span>' + text + '</span></' + (a ? 'a' : 'button') + '>'; };
    var hjalte = '<section class="ao-hjalte kort" data-ton="' + tonFor(total) + '"><div class="sh-rutnat" aria-hidden="true"></div>' +
      '<div class="ao-text"><p class="etikett"><i class="sh-live"></i>Kontrollcentralen · demoläget · ' + e(new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p>' +
        '<h1>' + halsning + ', ' + e(u0.namn.split(' ')[0]) + '. <em>Hela CRM:et i en blick.</em></h1>' +
        '<p class="ao-ingress">Säkerheten, kontona, datan och driften – hur allt mår just nu, räknat ur CRM:ets data och säkerhetskontrollerna.</p>' +
        '<div class="sh-knappar">' + knapp('data-g="sh-skanna-ga"', 'radar', 'Skanna allt', true) + knapp('href="#/admin"', 'server', 'Adminpanelen') + knapp('href="#/sakerhet"', 'skold', 'Säkerhet') + knapp('data-g="km-nytt-konto"', 'anvandare-plus', 'Nytt konto') + '</div>' +
        '<p class="sh-senast">' + (senast ? 'Senaste skanningen ' + IH.sedan(senast.tid) + ' av ' + e((IH.anvandare(senast.av) || {}).namn || '') + ' – ' + senast.poang + ' av 100' : 'Ingen säkerhetsskanning gjord ännu – systemhälsan räknar säkerheten först när en finns.') + '</p></div>' +
      '<div class="ao-karnkol">' + karna(delar, total) + '<ul class="ao-delar">' + delar.map(function (x) { return '<li data-del="' + x.id + '"><i></i><span>' + x.namn + '</span><strong>' + (x.p == null ? '–' : x.p) + '</strong></li>'; }).join('') + '</ul></div>' +
      '<div class="ao-remsa">' + remsa.map(function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + x.ton + '"><span class="ao-tal__ikon">' + ik(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(x.varde) + '</strong><em>' + e(x.under) + '</em></span></' + (x.href ? 'a' : 'div') + '>'; }).join('') + '</div></section>';
    var band = function (nr, rubrik, em, inne, opts) {
      opts = opts || {};
      return '<section class="ao-band kort' + (opts.halv ? ' ao-band--halv' : '') + '"><header class="ao-band__huvud"><div><p class="ao-ogon">' + nr + '</p><h2>' + rubrik + ' <em>' + em + '</em></h2>' + (opts.ingress ? '<p class="ao-band__ingress">' + opts.ingress + '</p>' : '') + '</div>' + (opts.hoger || '') + '</header>' + inne + '</section>';
    };
    // 01 Konton
    var dagar = dagar14(), ordning = { hjalp: 0, se: 1, bra: 2 };
    var kort = konton.slice().sort(function (a, b) { return ordning[a.h.lage] - ordning[b.h.lage] || a.h.poang - b.h.poang; }).map(function (x) {
      var u = x.u, hl = x.h, n = IH.narvaro ? IH.narvaro(u.id) : { farg: '#ccc', namn: '' }, pd = perDag(u.id, dagar), l = 2 * Math.PI * 18;
      return '<article class="ao-konto" data-lage="' + hl.lage + '"><header class="ao-konto__topp"><a class="ao-konto__vem" href="#/profil/' + u.id + '"><span class="avatar" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(u.id) : '') + '</span><span><strong>' + e(u.namn) + '</strong><small>' + e(u.titel) + '</small></span></a>' +
        '<span class="ao-matare" title="Hälsa ' + hl.poang + ' av 100"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="ao-matare__spar"/><circle cx="22" cy="22" r="18" class="ao-matare__bage" stroke-dasharray="' + ((hl.poang / 100) * l).toFixed(1) + ' ' + l.toFixed(1) + '"/></svg><b>' + hl.poang + '</b></span></header>' +
        '<div class="ao-konto__rad"><span class="lp-status" style="--n:' + n.farg + '"><i></i>' + e(n.namn) + '</span><span class="ao-lage">' + LAGE[hl.lage] + '</span></div>' +
        '<ul class="ao-punkter">' + hl.punkter.map(function (p) { return '<li data-ok="' + (p.ok ? 1 : 0) + '"><span class="ao-p__ikon">' + ik(p.ikon) + '</span><span class="ao-p__namn">' + p.namn + '</span><em title="' + e(p.text) + '">' + e(p.text) + '</em><i class="ao-lampa"></i></li>'; }).join('') + '</ul>' +
        '<footer class="ao-konto__fot"><span class="ao-spark">' + sparkline(pd, 132, 28) + '</span><small>' + plural(pd.reduce(function (t, v) { return t + v; }, 0), 'händelse', 'händelser') + ' · 14 d</small><a class="ao-pil" href="#/profil/' + u.id + '" aria-label="Profilen för ' + e(u.namn) + '">' + i('pil') + '</a></footer></article>';
    }).join('');
    var antalLage = function (l) { return konton.filter(function (x) { return x.h.lage === l; }).length; };
    var kontoBand = band('01 · Konton', 'Hur kontona', 'mår', '<div class="ao-konton">' + kort + '</div>', { ingress: 'Aktivitet, förfallna uppgifter, affärer eller projekt som står still, kopplingar och profilen – sammanvägt till en hälsa per konto.',
      hoger: '<div class="ao-sammanfatt">' + [['bra', 'mår bra'], ['se', 'bör ses över'], ['hjalp', 'behöver hjälp']].map(function (x) { return '<span data-lage="' + x[0] + '"><b>' + antalLage(x[0]) + '</b>' + x[1] + '</span>'; }).join('') + '</div>' });
    // 02 Säkerhet
    var lista = function (rader) { return '<ul class="ao-lista">' + rader.map(function (x) { return '<li data-lage="' + x.lage + '"><span class="ao-l__ikon">' + ik(x.ikon) + '</span><span class="ao-l__namn">' + x.namn + '</span><em>' + e(x.text) + '</em><i class="ao-lampa"></i></li>'; }).join('') + '</ul>'; };
    var chip = function (p, text) { return '<span class="ao-chip" data-ton="' + tonFor(p) + '">' + text + '</span>'; };
    var sakBand = band('02 · Säkerhet', 'Skyddet', 'just nu',
      '<div class="ao-allvar">' + [['hog', 'Hög'], ['medel', 'Medel'], ['lag', 'Låg']].map(function (x) { return '<span data-allvar="' + x[0] + '"><b>' + fyndN(x[0]) + '</b>' + x[1] + '</span>'; }).join('') + '</div>' +
      lista((H ? H.kontroller : []).map(function (k) { var r = S.senast[k.id], v = r ? r.fynd.filter(function (x) { return x.allvar !== 'info'; }).length : 0; return { lage: H.lageFor(r), ikon: k.ikon, namn: k.namn, text: !r ? 'Inte körd' : v ? plural(v, 'fynd', 'fynd') : 'Inga fynd' }; })) +
      '<div class="ao-fot"><button type="button" class="knapp knapp--virke knapp--liten" data-g="sh-skanna-ga">' + ik('radar') + 'Skanna allt</button><a class="knapp knapp--liten" href="#/sakerhet">' + ik('skold') + 'Säkerhetshubben</a></div>',
      { halv: true, hoger: chip(sakP, sakP == null ? 'Ej skannat' : sakP + ' / 100') });
    // 03 Data
    var lacka = S.senast.lacka, lackaN = lacka ? lacka.fynd.filter(function (x) { return x.allvar === 'hog' || x.allvar === 'medel'; }).length : null;
    var maxS = Math.max.apply(null, SAML.map(function (s) { return antal(s[1]); }).concat([1]));
    var dataBand = band('03 · Data', 'Datan', 'och kopplingarna',
      lista([{ ikon: 'lank', namn: 'Kopplingar mellan posterna', lage: dl.brott ? 'medel' : 'ok', text: dl.brott ? plural(dl.brott, 'trasig', 'trasiga') : 'Alla hänger ihop' },
        { ikon: 'databas', namn: 'Dubbletter', lage: dl.dubb ? 'medel' : 'ok', text: dl.dubb ? plural(dl.dubb, 'dubblett', 'dubbletter') : 'Inga' },
        { ikon: 'kalkyl', namn: 'Ogiltiga värden', lage: dl.ogiltiga ? 'medel' : 'ok', text: dl.ogiltiga ? plural(dl.ogiltiga, 'ogiltigt', 'ogiltiga') : 'Inga' },
        { ikon: 'fingeravtryck', namn: 'Persondata på fel ställe', lage: lackaN == null ? 'ny' : lackaN ? 'medel' : 'ok', text: lackaN == null ? 'Inte kontrollerat' : lackaN ? plural(lackaN, 'fynd', 'fynd') : 'Inga fynd' }]) +
      '<ul class="ao-samlingar">' + SAML.map(function (s) { return '<li><span>' + s[0] + '</span><strong>' + antal(s[1]).toLocaleString('sv-SE') + '</strong><i style="--andel:' + (antal(s[1]) / maxS).toFixed(3) + '"></i></li>'; }).join('') + '</ul>' +
      '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="sh-skanna-ga" data-ids="buggar,lacka">' + ik('nyckelverktyg') + 'Kontrollera datan</button><button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera</button></div>',
      { halv: true, hoger: chip(dl.poang, 'Kvalitet ' + dl.poang + ' %') });
    // 04 Aktivitet
    var varden = IH.ANVANDARE.map(function (u) { return perDag(u.id, dagar); }), maxV = Math.max.apply(null, [].concat.apply([1], varden));
    var VD = ['Sö', 'Må', 'Ti', 'On', 'To', 'Fr', 'Lö'];
    var tot = IH.ANVANDARE.map(function (u, r) { return { u: u, n: varden[r].reduce(function (t, v) { return t + v; }, 0) }; }), mest = tot.slice().sort(function (a, b) { return b.n - a.n; })[0], tysta = tot.filter(function (x) { return !x.n; });
    var karta = band('04 · Aktivitet', 'Vem gör', 'vad och när',
      '<p class="lp-forklaring">Händelser i tidslinjerna per konto och dag – möten, samtal, mejl och anteckningar. Mörkare ruta = fler händelser.</p>' +
      '<div class="ao-karta" style="--dagar:' + dagar.length + '"><span></span>' + dagar.map(function (dd, n) { return '<small class="' + (dd.getDay() % 6 === 0 ? 'helg' : '') + (n === dagar.length - 1 ? ' nu' : '') + '">' + VD[dd.getDay()] + '</small>'; }).join('') +
        IH.ANVANDARE.map(function (u, r) { return '<a class="ao-karta__vem" href="#/profil/' + u.id + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span>' + e(u.namn.split(' ')[0]) + '</a>' + varden[r].map(function (v, c) { return '<i class="' + (dagar[c].getDay() % 6 === 0 ? 'helg' : '') + (c === dagar.length - 1 ? ' nu' : '') + '" style="--v:' + (v / maxV).toFixed(2) + '" title="' + e(u.namn) + ', ' + IH.datum(dagar[c].toISOString()) + ': ' + v + '"></i>'; }).join(''); }).join('') + '</div>' +
      '<div class="ao-skala"><span>Färre</span>' + [0.1, 0.35, 0.6, 0.85, 1].map(function (v) { return '<i style="--v:' + v + '"></i>'; }).join('') + '<span>Fler</span></div>' +
      '<div class="ao-statrad"><div><small>Händelser 14 d</small><strong>' + tot.reduce(function (t, x) { return t + x.n; }, 0) + '</strong><em>i tidslinjerna</em></div><div><small>Mest aktiv</small><strong>' + (mest && mest.n ? e(mest.u.namn.split(' ')[0]) : '–') + '</strong><em>' + (mest && mest.n ? plural(mest.n, 'händelse', 'händelser') : 'ingen aktivitet') + '</em></div>' +
        '<div><small>Tysta 14 d</small><strong>' + tysta.length + '</strong><em>' + (tysta.length ? e(tysta.map(function (x) { return x.u.namn.split(' ')[0]; }).join(', ')) : 'alla har loggat något') + '</em></div></div>',
      { halv: true, hoger: '<span class="ao-band__tal">14 dagar</span>' });
    // 05 Händelser
    var flode = d.aktiviteter.map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: 'crm' }; }).concat((d.sakerhet || []).map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: 'sakerhet' }; }))
      .filter(function (x) { return x.tid; }).sort(function (a, b) { return a.tid < b.tid ? 1 : -1; }).slice(0, 7);
    var flodeBand = band('05 · Händelser', 'Senast', 'i CRM:et', flode.length ? '<ul class="ao-flode">' + flode.map(function (x) { var u = IH.anvandare(x.av) || { namn: '?', farg: '#ccc' }, t = String(x.text || '');
        return '<li data-typ="' + x.typ + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><span>' + e(t.slice(0, 96)) + (t.length > 96 ? '…' : '') + '<small>' + e(u.namn) + ' · ' + IH.sedan(x.tid) + (x.typ === 'sakerhet' ? ' · säkerhetsloggen' : '') + '</small></span></li>'; }).join('') + '</ul>' : '<p class="ad-not">Inga händelser än.</p>',
      { halv: true, hoger: '<a class="knapp knapp--liten" href="#/admin">Hela loggen</a>' });
    // 06 Drift
    var app = document.querySelector('script[src*="app.js"]'), version = ((app && app.getAttribute('src')) || '').split('?v=')[1] || '–';
    var driftBand = band('06 · Drift', 'System', 'och fel',
      lista([{ ikon: 'bugg', namn: 'Fel sedan sidan laddades', lage: dr.fel.length ? 'medel' : 'ok', text: dr.fel.length ? plural(dr.fel.length, 'fel', 'fel') : 'Inga' },
        { ikon: 'databas', namn: 'Lagringen', lage: dr.skriv && !dr.full ? 'ok' : 'medel', text: !dr.skriv ? 'Går inte att skriva' : kb(dr.bytes) + ' av ca 5 MB' },
        { ikon: 'server', namn: 'Läge och version', lage: 'ok', text: 'Demo · v' + version + ' · data ' + (IH.VERSION || '–') },
        { ikon: 'lank', namn: 'Nätverket', lage: dr.online ? 'ok' : 'medel', text: dr.online ? 'Uppkopplad' : 'Ingen uppkoppling' }]) +
      (dr.fel.length ? '<ul class="ao-fel">' + dr.fel.slice(-3).reverse().map(function (t) { return '<li><code>' + e(t) + '</code></li>'; }).join('') + '</ul>' : '<p class="ao-lugnt">' + ik('bock') + 'Inga fel i skript eller filer sedan sidan laddades.</p>') +
      '<div class="ao-fot">' + (dr.fel.length ? '<button type="button" class="knapp knapp--liten" data-g="sh-rensa-fel">' + ik('aterstall') + 'Rensa felloggen</button>' : '') + '<button type="button" class="knapp knapp--liten" data-g="sh-skanna-ga" data-ids="trasigt,uppdatering">' + ik('uppgradera') + 'Sök uppdateringar</button></div>',
      { halv: true, hoger: chip(dr.poang, dr.poang + ' / 100') });
    // 07 Förslag, snabbåtgärder och verktyg
    var forslag = forslagLista(brott, dl, dr);
    var SNABB = [['km-nytt-konto', 'anvandare-plus', 'Lägg till konto'], ['sh-skanna-ga', 'radar', 'Skanna nu'], ['ad-exportera', 'ladda-ner', 'Exportera data'], ['kc-csv', 'anstallda', 'Kontolista (CSV)'],
      ['kc-rapport', 'dokument', 'Systemrapport'], ['kc-rensa-bilder', 'bild', 'Rensa chattfiler'], ['kc-rensa-logg', 'papperskorg', 'Rensa loggen'], ['ad-aterstall', 'aterstall', 'Återställ data']];
    var forslagBand = band('07 · Förslag', 'Bör', 'åtgärdas',
      (forslag.length ? '<ul class="ao-upp">' + forslag.slice(0, 5).map(function (x) {
        return '<li><span class="ao-upp__ikon">' + ik(x.ikon) + '</span><span class="ao-upp__text"><strong>' + e(x.text) + '</strong><small>' + e(x.under || '') + '</small></span>' +
          (x.lank ? '<a class="knapp knapp--liten" href="' + x.lank + '">' + x.knapp + '</a>' : '<button type="button" class="knapp knapp--liten" data-g="' + x.g + '"' + (x.data ? ' data-ids="' + x.data + '"' : '') + '>' + x.knapp + '</button>') + '</li>';
      }).join('') + '</ul>' : '<div class="ao-lugnt ao-lugnt--stor">' + ik('skold') + '<div><strong>Inget att åtgärda</strong><small>Profiler, mål, ansvariga och säkerheten ser bra ut.</small></div></div>') +
      '<p class="ao-ogon ao-ogon--liten">Snabbåtgärder och verktyg</p><div class="ao-snabb">' + SNABB.map(function (x) { return '<button type="button" class="ao-snabbknapp" data-g="' + x[0] + '">' + ik(x[1]) + '<span>' + x[2] + '</span></button>'; }).join('') + '</div>',
      { halv: true, hoger: forslag.length ? '<span class="ao-band__tal">' + forslag.length + '</span>' : '' });
    var html = hjalte + kontoBand + '<div class="ao-tva">' + sakBand + dataBand + '</div><div class="ao-tva">' + karta + flodeBand + '</div><div class="ao-tva">' + driftBand + forslagBand + '</div>';
    return { titel: 'Kontrollcentral', html: html };
  };

  IH.adminForslag = function () { var brott = IH.sak ? IH.sak.kopplingsBrott() : []; return forslagLista(brott, dataLage(brott), driftLage()); };

  /* Verktygen ------------------------------------------------------------------------------------------ */
  var G = IH.G;
  var ladda = function (namn, text, typ) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: typ })); a.download = namn; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  var bekrafta = function (el) {
    if (el.dataset.saker) return true;
    el.dataset.saker = '1'; var s = el.querySelector('span') || el, gammal = s.textContent; s.textContent = 'Klicka igen';
    setTimeout(function () { if (el.isConnected) { delete el.dataset.saker; s.textContent = gammal; } }, 4000);
    return false;
  };
  G['kc-csv'] = function () {
    var d = db(), q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
    var rader = [['Namn', 'Roll', 'Status', 'Öppna affärer', 'Vunnet värde', 'Aktiviteter 30 d'].map(q).join(';')].concat(IH.ANVANDARE.map(function (u) {
      var aff = d.affarer.filter(function (a) { return a.ansvarig === u.id; });
      return [u.namn, u.titel, IH.narvaro ? IH.narvaro(u.id).namn : '', aff.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }).length,
        aff.filter(function (a) { return a.steg === 'vunnen'; }).reduce(function (t, a) { return t + a.varde; }, 0), d.aktiviteter.filter(function (h) { return h.av === u.id && IH.dagarSedan(h.tid) < 30; }).length].map(q).join(';');
    }));
    ladda('legohus-konton-' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + rader.join('\r\n'), 'text/csv;charset=utf-8');
    if (IH.sak) IH.sak.logg('export', 'Kontolistan exporterad som CSV.');
    IH.toast('Kontolistan är nedladdad', IH.ANVANDARE.length + ' konton', 'ladda-ner');
  };
  G['kc-rapport'] = function () {
    var d = db(), t = IH.sakTotal ? IH.sakTotal() : null, inst = IH.sak ? IH.sak.inst() : {};
    var text = ['Legohus CRM – systemrapport ' + new Date().toLocaleString('sv-SE'), '', 'Konton: ' + IH.ANVANDARE.map(function (u) { return u.namn + ' (' + u.titel + ')'; }).join(', '),
      'Kunder: ' + d.kunder.length + ' · Affärer: ' + d.affarer.length + ' · Offerter: ' + d.offerter.length + ' · Projekt: ' + d.projekt.length,
      'Säkerhetspoäng: ' + (t == null ? 'inte skannat' : t + ' av 100'), 'Trasiga kopplingar: ' + (IH.sak ? IH.sak.kopplingsBrott().length : '–'),
      'Utloggning vid inaktivitet: ' + (+inst.utlogg ? inst.utlogg + ' min' : 'av'), 'Senaste export: ' + (inst.kopia ? new Date(inst.kopia).toLocaleString('sv-SE') : 'ingen')].join('\n');
    var klart = function () { IH.toast('Systemrapporten är kopierad', 'Klistra in den i ett mejl eller dokument.', 'dokument'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(klart, function () { ladda('legohus-systemrapport.txt', text, 'text/plain;charset=utf-8'); });
    else ladda('legohus-systemrapport.txt', text, 'text/plain;charset=utf-8');
  };
  G['kc-rensa-bilder'] = function (el) {
    if (!bekrafta(el)) return;
    var n = 0, fore = (localStorage.getItem(IH.NYCKEL) || '').length;
    (((db().chatt || {}).meddelanden) || []).forEach(function (m) { (m.filer || []).forEach(function (f) { if (f.data) { delete f.data; f.rensad = true; n++; } }); });
    IH.spara();
    var sparat = Math.max(0, fore - (localStorage.getItem(IH.NYCKEL) || '').length) * 2;
    if (IH.sak) IH.sak.logg('rensning', 'Chattens filer rensade: ' + n + ' st, ' + Math.round(sparat / 1024) + ' kB frigjort.');
    IH.rita(); IH.toast(n ? 'Filerna är rensade' : 'Inga filer att rensa', n ? n + ' st · ' + Math.round(sparat / 1024) + ' kB frigjort' : null, 'papperskorg');
  };
  G['kc-rensa-logg'] = function (el) {
    if (!bekrafta(el)) return;
    var d = db(), fore = (d.sakerhet || []).length; d.sakerhet = (d.sakerhet || []).slice(0, 10);
    if (IH.sak) IH.sak.logg('rensning', 'Säkerhetsloggen rensad (' + Math.max(0, fore - 10) + ' rader).');
    IH.rita(); IH.toast('Loggen är rensad', 'De tio senaste raderna finns kvar.', 'papperskorg');
  };
})();
