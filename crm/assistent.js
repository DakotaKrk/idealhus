/* ============================================================
   Legohus CRM – hjälpassistenten (2026-11-01).
   En LOKAL hjälpassistent, ingen AI: den matchar frågan mot
   kunskapsbasen (assistent-kunskap.js + turerna i turer.js) och
   läser IH.db med verktygen nedan. Ingen data lämnar webbläsaren.

   Gränssnittet som en riktig modell (t.ex. via Supabase) kopplas till:
     IH.assistent.svara(fraga, sammanhang) -> Promise<svar>
     IH.assistent.sattMotor({ namn, svara(fraga, sammanhang) })
     IH.assistent.verktyg – läsande verktyg som respekterar rollen
     sammanhang: { sida, vy, jag: {id, namn, roll, chef}, senaste }
     svar: { text (html), rader: [{titel, under, lank}], knappar: [
       {etikett, typ: 'ga'|'visa'|'tur'|'guide'|'fraga'|'form', ...}],
       utfor: en knapp som körs direkt, kalla: 'data'|'kunskap'|'okand',
       senaste: det nästa följdfråga ska kunna hänga på }
   Allt språkligt ligger i motorn. Allt nedanför "Panelen" är gränssnitt.
   Assistenten ändrar aldrig data: handlingar öppnar det vanliga
   formuläret förifyllt, och användaren sparar själv.
   3D-figuren (assistent3d.js) är själva knappen. Den laddas när sidan
   är ritad (requestIdleCallback), kliver upp i panelen när den öppnas
   och stoppas helt vid dold flik, presentation och videomöte.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var K = IH.assistentKunskap || { amnen: [], synonymer: {}, sparrOrd: [], forslag: {} };
  var A = IH.assistent = IH.assistent || {};

  /* =====================================================================
     MOTORN: språket (lokal matchning)
     ===================================================================== */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e').replace(/[^a-z0-9@.+\- ]+/g, ' ').replace(/[.]+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var STOPP = {};
  ('hur gor gora gjort jag man en ett det den de dem vad var vart kan ska vill har ar att och i pa till for med om som mig min mitt mina du dig hej tack snalla '
    + 'nagon nagot nagra finns vilken vilka vilket nar varfor sa da eller men av ur vi oss er ni sin sitt sina inte ej bara alla allt mycket lite nu har ju val '
    + 'kunna fa far fick ga gar ge ger ta tar lage laget byta byter fungera fungerar funkar visa visar kolla se ser hittar hjalp hjalpa behover maste borde skulle kanske ni dar denna detta dessa fran under over vid').split(' ').forEach(function (w) { STOPP[w] = 1; });
  var ANDELSER = ['ningarna', 'ningar', 'ningen', 'arnas', 'ernas', 'ornas', 'arna', 'erna', 'orna', 'ning', 'ande', 'aren', 'erat', 'erad', 'ade', 'ar', 'er', 'or', 'an', 'en', 'et', 'na', 'at', 'a', 'e', 'n'];
  function stam(w) {
    for (var i = 0; i < ANDELSER.length; i++) { var a = ANDELSER[i]; if (w.length - a.length >= 3 && w.slice(-a.length) === a) return w.slice(0, -a.length); }
    return w;
  }
  function ordOf(s) { return norm(s).split(' ').filter(function (w) { return w && !STOPP[w]; }); }
  // Damerau-Levenshtein med tak, så att en bokstav för mycket eller bytta bokstäver inte stör
  function dist(a, b, tak) {
    if (Math.abs(a.length - b.length) > tak) return tak + 1;
    var f = [], i, j;
    for (i = 0; i <= a.length; i++) { f[i] = [i]; }
    for (j = 0; j <= b.length; j++) f[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var rad = tak + 1;
      for (j = 1; j <= b.length; j++) {
        var k = a[i - 1] === b[j - 1] ? 0 : 1;
        f[i][j] = Math.min(f[i - 1][j] + 1, f[i][j - 1] + 1, f[i - 1][j - 1] + k);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) f[i][j] = Math.min(f[i][j], f[i - 2][j - 2] + 1);
        if (f[i][j] < rad) rad = f[i][j];
      }
      if (rad > tak) return tak + 1;
    }
    return f[a.length][b.length];
  }

  /* --- Index över ämnen och turer ------------------------------------------- */
  var DOK = null, DF = {}, N = 1;
  function lagg(v, text, vikt) { ordOf(text).forEach(function (w) { var s = stam(w); if (!v[s] || v[s] < vikt) v[s] = vikt; }); }
  function byggIndex() {
    if (DOK) return;
    DOK = []; DF = {};
    K.amnen.forEach(function (a) {
      var v = {};
      lagg(v, a.s.replace(/<[^>]+>/g, ' '), 1); lagg(v, a.o, 3); lagg(v, a.t, 3);
      DOK.push({ a: a, v: v, faktor: 1 });
    });
    // Turerna blir ämnen av sig själva: guiderna går att hitta så fort de finns i turer.js
    ((IH.guide && IH.guide.turer) || []).forEach(function (t) {
      var v = {};
      lagg(v, t.steg.map(function (s) { return [typeof s.text === 'string' ? s.text : '', typeof s.gor === 'string' ? s.gor : ''].join(' '); }).join(' ').replace(/<[^>]+>/g, ' '), 1);
      lagg(v, t.steg.map(function (s) { return typeof s.rubrik === 'string' ? s.rubrik : ''; }).join(' '), 2);
      lagg(v, t.namn + ' ' + (t.beskrivning || ''), 3);
      DOK.push({ a: { id: 'tur:' + t.id, t: 'Guiden ' + t.namn, s: esc(t.beskrivning || t.namn) + ' Vill du gå igenom det steg för steg?', tur: t.id, turRoller: t.roller }, v: v, faktor: 0.82 });
    });
    N = DOK.length;
    DOK.forEach(function (d) { Object.keys(d.v).forEach(function (w) { DF[w] = (DF[w] || 0) + 1; }); });
  }
  function idf(w) { return Math.log(1 + N / (DF[w] || 0.5)); }
  // Rättar ett ord mot ordförrådet: en bokstav fel i korta ord, två i långa
  function ratta(w) {
    if (DF[w]) return w;
    if (w.length < 5) return w;
    var tak = w.length >= 7 ? 2 : 1, bast = w, bastD = tak + 1;
    Object.keys(DF).forEach(function (v) {
      if (v.length < 3) return;
      var d = dist(w, v, tak);
      if (d < bastD || (d === bastD && d <= tak && (DF[v] > (DF[bast] || 0)))) { bast = v; bastD = d; }
    });
    return bastD <= tak ? bast : w;
  }
  function tokens(q) {
    var ut = [];
    norm(q).split(' ').forEach(function (w) {
      if (!w || STOPP[w]) return;
      var syn = K.synonymer[w];
      (syn ? syn.split(' ') : [w]).forEach(function (x) { if (!STOPP[x]) ut.push(ratta(stam(x))); });
    });
    return ut.filter(function (w, i) { return ut.indexOf(w) === i; });
  }
  function matcha(t, d) {
    var w = d.v[t];
    if (w) return Math.min(1, w / 3);
    if (t.length < 5) return 0;
    // Sammansatta ord: offertmall hittar offert, kundlista hittar kund
    var bast = 0;
    Object.keys(d.v).forEach(function (v) { if (v.length >= 4 && (t.indexOf(v) >= 0 || v.indexOf(t) >= 0)) bast = Math.max(bast, Math.min(1, d.v[v] / 3) * 0.7); });
    return bast;
  }
  function sok(q) {
    byggIndex();
    var tk = tokens(q);
    if (!tk.length) return { tk: tk, lista: [] };
    var tot = tk.reduce(function (n, t) { return n + idf(t); }, 0);
    var lista = DOK.map(function (d) {
      var s = 0, tr = 0;
      tk.forEach(function (t) { var m = matcha(t, d); if (m) tr++; s += idf(t) * m; });
      var po = (s / tot) * d.faktor;
      // Rubrikens ord i frågan väger lite extra
      var ti = tokens(d.a.t); if (ti.length && ti.every(function (x) { return tk.indexOf(x) >= 0; })) po += 0.12;
      return { d: d, po: po, tr: tr };
    }).filter(function (x) { return x.po > 0; }).sort(function (a, b) { return b.po - a.po; });
    return { tk: tk, lista: lista };
  }

  /* --- Roller ------------------------------------------------------------------ */
  function jag() { return IH.jag ? IH.jag() : { id: '', namn: '', roll: '' }; }
  function far(vy) {
    var j = jag();
    if (vy === 'chef') return !!j.chef && j.roll !== 'admin';
    if (/^(kontroll|admin|sakerhet)$/.test(vy)) return j.roll === 'admin';
    return !(IH.sparrad && IH.sparrad(vy));
  }
  function rollerOk(r) {
    if (!r || !r.length) return true;
    var j = jag();
    return r.some(function (x) { return (x === 'chef' && j.chef && j.roll !== 'admin') || (x === 'admin' && j.roll === 'admin') || (x === 'salj' && j.roll !== 'admin'); });
  }
  function tillats(a) {
    if (a.turRoller && !(IH.guide && IH.guide.rollOk(a.turRoller))) return false;
    if (a.roller && !rollerOk(a.roller)) return false;
    if (a.vy && !far(a.vy)) return false;
    return true;
  }
  function saljSparr(sak) {
    return svar(jag().roll === 'admin'
      ? esc(sak) + ' hör till säljarnas del. Gå in i en säljares konto via <b>Teamet</b> i menyn, så kan jag svara där.'
      : esc(sak) + ' ingår inte i ditt konto.', { kalla: 'sparr' });
  }

  /* --- Hjälpare ---------------------------------------------------------------- */
  function esc(s) { return IH.e ? IH.e(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function kr(n) { return IH.lokalTal ? IH.lokalTal(Math.round(n)) + ' kr' : Math.round(n) + ' kr'; }
  function dagar(iso) { var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(iso); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }
  function narText(iso) { var d = dagar(iso); return d === 0 ? 'i dag' : d === 1 ? 'i morgon' : d === -1 ? 'i går' : d < 0 ? 'för ' + (-d) + ' dagar sedan' : 'om ' + d + ' dagar'; }
  function kundNamn(id) { var k = id && IH.kund ? IH.kund(id) : null; return k ? k.namn : ''; }
  function svar(text, opt) { var s = opt || {}; s.text = text; return s; }
  function plural(n, en, fler) { return n + ' ' + (n === 1 ? en : fler); }
  function summaAff(a) { var o = IH.offertFor ? IH.offertFor(a.id) : null; return o && IH.summaOffert ? IH.summaOffert(o) : (a.varde || 0); }
  function oppna() { return IH.db.affarer.filter(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }); }
  function egen(u) { var id = jag().id; return !u.ansvarig || u.ansvarig === id; }

  /* =====================================================================
     VERKTYGEN: läser IH.db, ändrar ingenting och respekterar rollen.
     Varje verktyg ger { antal, rader } eller { nekad: 'vy' }.
     ===================================================================== */
  var V = A.verktyg = {
    nyaForfragningar: function () {
      if (!far('forfragningar')) return { nekad: 'Förfrågningar' };
      var l = IH.db.forfragningar.filter(function (f) { return f.status === 'ny'; }).sort(function (a, b) { return a.skapad < b.skapad ? -1 : 1; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (f) { return { titel: f.namn, under: (f.ort || '') + ' · ' + (IH.sedan ? IH.sedan(f.skapad) : ''), lank: '#/forfragningar/' + f.id }; }) };
    },
    senaUppgifter: function () {
      var nu = new Date(), l = IH.db.uppgifter.filter(function (u) { return !u.klar && egen(u) && new Date(u.forfaller) < nu && dagar(u.forfaller) < 0; }).sort(function (a, b) { return a.forfaller < b.forfaller ? -1 : 1; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (u) { return { titel: u.text, under: 'Försenad, ' + narText(u.forfaller) + (u.kund ? ' · ' + kundNamn(u.kund) : ''), lank: '#/att-gora' }; }) };
    },
    uppgifter: function (dag) {
      var l = IH.db.uppgifter.filter(function (u) { return !u.klar && egen(u) && dagar(u.forfaller) === dag; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (u) { return { titel: u.text, under: u.kund ? kundNamn(u.kund) : narText(u.forfaller), lank: '#/att-gora' }; }) };
    },
    offerterVantar: function () {
      if (!far('offerter')) return { nekad: 'Offerter' };
      var id = jag().id, l = IH.db.offerter.filter(function (o) { return o.status === 'skickad'; }).sort(function (a, b) { return a.skapad < b.skapad ? -1 : 1; });
      var mina = l.filter(function (o) { var a = IH.affar(o.affar); return a && a.ansvarig === id; }).length;
      return { antal: l.length, mina: mina, rader: l.slice(0, 5).map(function (o) { return { titel: o.nummer + ' · ' + kundNamn(o.kund), under: kr(IH.summaOffert ? IH.summaOffert(o) : 0) + ' · skickad ' + (IH.sedan ? IH.sedan(o.skapad) : ''), lank: '#/offerter/' + o.id }; }) };
    },
    offerterGarUt: function () {
      if (!far('offerter')) return { nekad: 'Offerter' };
      var l = IH.db.offerter.filter(function (o) { return o.status === 'skickad'; }).map(function (o) { return { o: o, kvar: (o.giltig || 30) - IH.dagarSedan(o.skapad) }; }).filter(function (x) { return x.kvar <= 10; }).sort(function (a, b) { return a.kvar - b.kvar; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (x) { return { titel: x.o.nummer + ' · ' + kundNamn(x.o.kund), under: x.kvar > 0 ? 'Går ut om ' + plural(x.kvar, 'dag', 'dagar') : 'Har gått ut', lank: '#/offerter/' + x.o.id }; }) };
    },
    moten: function () {
      var j = jag(), i0 = new Date(); i0.setHours(0, 0, 0, 0);
      var l = IH.db.uppgifter.filter(function (u) { return !u.klar && egen(u) && /möte|träff|bes[öo]k|visning/i.test(u.text) && new Date(u.forfaller) >= i0; }).map(function (u) { return { tid: u.forfaller, titel: u.text, under: kundNamn(u.kund), lank: '#/att-gora' }; });
      (IH.db.videomoten || []).forEach(function (v) { if (v.vard === j.id && new Date(v.start) >= i0 && !v.avslutat) l.push({ tid: v.start, titel: v.titel, under: 'Videomöte', lank: '#/videomote/' + v.id }); });
      var sedda = {}; l = l.filter(function (x) { var n = x.titel + x.tid.slice(0, 10); if (sedda[n]) return false; sedda[n] = 1; return true; });
      l.sort(function (a, b) { return a.tid < b.tid ? -1 : 1; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (x) { return { titel: x.titel, under: narText(x.tid) + (x.under ? ' · ' + x.under : ''), lank: x.lank }; }), forsta: l[0] };
    },
    storstaAffarer: function () {
      if (!far('salj')) return { nekad: 'Säljtavlan' };
      var l = oppna().map(function (a) { return { a: a, v: summaAff(a) }; }).sort(function (x, y) { return y.v - x.v; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (x) { var s = IH.steg ? IH.steg(x.a.steg) : null; return { titel: x.a.titel, under: kr(x.v) + (s ? ' · ' + s.namn : '') + ' · ' + kundNamn(x.a.kund), lank: '#/salj/' + x.a.id }; }) };
    },
    stillaAffarer: function () {
      if (!far('salj')) return { nekad: 'Säljtavlan' };
      var l = oppna().filter(function (a) { return IH.dagarSedan(a.andrad) > 10; }).sort(function (a, b) { return a.andrad < b.andrad ? -1 : 1; });
      return { antal: l.length, rader: l.slice(0, 5).map(function (a) { return { titel: a.titel, under: 'Ingen ändring på ' + IH.dagarSedan(a.andrad) + ' dagar · ' + kundNamn(a.kund), lank: '#/salj/' + a.id }; }) };
    },
    prognos: function () {
      if (!far('salj')) return { nekad: 'Säljtavlan' };
      // Samma räkning som säljtavlan och översikten
      var l = oppna();
      return { antal: l.length, totalt: l.reduce(function (n, a) { return n + (a.varde || 0); }, 0), viktat: IH.viktat ? IH.viktat(l) : 0 };
    },
    nastaMontage: function () {
      if (!far('produktion')) return { nekad: 'Projekt' };
      var l = IH.db.projekt.filter(function (p) { return p.steg !== 'klart' && p.montage && new Date(p.montage) >= new Date(); }).sort(function (a, b) { return a.montage < b.montage ? -1 : 1; });
      return { antal: l.length, rader: l.slice(0, 3).map(function (p) { return { titel: kundNamn(p.kund) || 'Projekt', under: 'Montage ' + IH.datum(p.montage) + ', ' + narText(p.montage), lank: '#/produktion/' + p.id }; }) };
    },
    hittaKund: function (q) {
      if (!far('kunder')) return { nekad: 'Kunder' };
      var t = norm(q).split(' ').filter(function (w) { return w.length >= 3 && !STOPP[w]; }), bast = [];
      IH.db.kunder.forEach(function (k) {
        var delar = norm(k.namn).split(' ').filter(function (d) { return d.length >= 3 && !/^(ab|hb|kb)$/.test(d); }), p = 0;
        delar.forEach(function (d) { t.forEach(function (w) { if (w === d) p += 2; else if (w.length >= 5 && dist(w, d, 1) <= 1) p += 1; }); });
        if (p) bast.push({ k: k, p: p });
      });
      bast.sort(function (a, b) { return b.p - a.p; });
      return { antal: bast.length, kunder: bast.slice(0, 3).map(function (x) { return x.k; }) };
    },
    husPris: function (q) {
      var n = norm(q), l = (IH.MODELLER || []).filter(function (m) { return n.indexOf(norm(m.namn)) >= 0; }).sort(function (a, b) { return b.namn.length - a.namn.length; });
      var m = l[0]; if (!m) return { antal: 0 };
      var p = IH.db.prislista && IH.db.prislista.modeller ? IH.db.prislista.modeller[m.id] : null;
      return { antal: 1, modell: m, pris: p };
    },
    mittVunnet: function () {
      if (!far('salj')) return { nekad: 'Säljtavlan' };
      var ar = new Date().getFullYear(), l = IH.db.affarer.filter(function (a) { return a.steg === 'vunnen' && a.ansvarig === jag().id && new Date(a.vunnen || a.andrad).getFullYear() === ar; });
      return { antal: l.length, summa: l.reduce(function (n, a) { return n + summaAff(a); }, 0) };
    },
    teamLage: function () {
      if (!far('chef')) return { nekad: 'Försäljningsledningen' };
      var ut = {};
      IH.db.affarer.forEach(function (a) { var n = a.ansvarig || '-'; ut[n] = ut[n] || { oppna: 0, vunnet: 0 }; if (a.steg === 'vunnen') ut[n].vunnet += summaAff(a); else if (!a.forlorad) ut[n].oppna += summaAff(a); });
      var r = Object.keys(ut).map(function (id) { var u = IH.anvandare(id); return { titel: u ? u.namn : 'Utan säljare', under: 'Öppet ' + kr(ut[id].oppna) + ' · vunnet ' + kr(ut[id].vunnet), lank: '#/chef', v: ut[id].vunnet }; }).sort(function (a, b) { return b.v - a.v; });
      return { antal: r.length, rader: r };
    }
  };

  /* =====================================================================
     AVSIKTERNA
     ===================================================================== */
  function smaprat(q) {
    if (!q) return svar('Skriv en fråga, till exempel <b>hur skapar jag en offert?</b>');
    if (/^(hej|hejsan|tjena|hallå|halla|god morgon|god dag|hallo)\b[ !]*$/.test(q)) return svar('Hej ' + esc(String(jag().namn).split(' ')[0]) + '! Fråga om CRM:et eller läget, till exempel <b>vad ska jag göra i dag?</b>', { figur: 'svarar' });
    if (/^(tack|tusen tack|tackar|bra|toppen|perfekt|okej|ok)( sa mycket| for hjalpen)?[ !]*$/.test(q)) return svar('Varsågod!');
    if (/(vem ar du|vad ar du|ar du (en )?(ai|robot|chatgpt|claude|manniska)|vad heter du|vilken modell|ar du smart)/.test(q)) return svar('Jag är en lokal hjälpassistent i din webbläsare. Jag är ingen AI: jag jämför din fråga med CRM:ets hjälptexter och läser data här på datorn. Inget skickas iväg.');
    if (/(vad kan du|vad kan jag fraga|hjalp mig|vad gor du|vad klarar du|hur fungerar du)/.test(q) || q === 'hjalp') {
      return svar('Jag kan svara på hur saker fungerar, ta dig till rätt sida, peka ut knappar, starta guider, läsa läget (förfrågningar, uppgifter, offerter, möten, affärer) och öppna formulär förifyllda.', { knappar: [{ etikett: 'Vad ska jag göra i dag?', typ: 'fraga' }, { etikett: 'Starta en guide', typ: 'guide' }] });
    }
    return null;
  }
  // Följdfrågor hänger på det senaste svaret
  function foljd(q, s) {
    var f = s.senaste; if (!f) return null;
    var m;
    if (f.rader && (m = /(?:^|\s)(forsta|1|andra|2|tredje|3|fjarde|4|femte|5)(?:\s|$)/.exec(q)) && q.split(' ').length <= 5) {
      var n = { forsta: 0, 1: 0, andra: 1, 2: 1, tredje: 2, 3: 2, fjarde: 3, 4: 3, femte: 4, 5: 4 }[m[1]], r = f.rader[n];
      if (r) return svar('Jag öppnar <b>' + esc(r.titel) + '</b>.', { utfor: { typ: 'ga', adress: r.lank } });
    }
    if (/^(visa( mig)?( det| den| var| dar)?|peka( ut)?( den| det)?|var( ar| finns)?( den| det| da)?|var da)$/.test(q)) {
      if (f.visa) return svar('Jag pekar ut det.', { utfor: { typ: 'visa', visa: f.visa } });
      if (f.sida) return svar('Jag tar dig dit.', { utfor: { typ: 'ga', adress: f.sida } });
    }
    if (/^(ta mig dit|ga dit|oppna( den| det| sidan)?|dit|ta mig( dit)?)$/.test(q) && f.sida) return svar('Jag tar dig dit.', { utfor: { typ: 'ga', adress: f.sida } });
    if (/^(starta( guiden| den)?|guida mig|lar mig|ja gora guiden|ja guida)$/.test(q) && f.tur) return svar('Jag startar guiden.', { utfor: { typ: 'tur', tur: f.tur } });
    if (/^(ja|ja tack|gor det|absolut|garna|kor)$/.test(q)) {
      if (f.tur) return svar('Jag startar guiden.', { utfor: { typ: 'tur', tur: f.tur } });
      if (f.visa) return svar('Jag pekar ut det.', { utfor: { typ: 'visa', visa: f.visa } });
      if (f.sida) return svar('Jag tar dig dit.', { utfor: { typ: 'ga', adress: f.sida } });
    }
    if (/^(nej|nej tack|inget|nix)$/.test(q)) return svar('Okej. Säg till om det är något annat.');
    if (/^(hur da|mer|beratta mer|hur menar du|forklara|och sen|fortsatt)$/.test(q)) {
      if (f.tur) return svar('Guiden visar det steg för steg.', { knappar: [{ etikett: 'Starta guiden', typ: 'tur', tur: f.tur }] , senaste: f });
      return svar('Mer än så vet jag inte om det. Prova att fråga på ett annat sätt.', { senaste: f });
    }
    if (f.verktyg === 'uppgifter') {
      if (/(och )?(i )?morgon/.test(q) && q.length < 18) return uppgifterDag(1, 'i morgon');
      if (/(och )?(i )?dag$/.test(q) && q.length < 14) return uppgifterDag(0, 'i dag');
    }
    return null;
  }
  function sparr(q) {
    var j = jag();
    if (j.roll !== 'admin' && !j.chef && /(hur (mycket|manga) .*(sahand|ahmed|kolleg)|(sahand|ahmed).*(salt|vunnit|affarer|siffror)|per saljare|vem .*(salt|vunnit|flest|mest)|hur gar (det for )?teamet)/.test(q)) {
      return svar('Teamets siffror finns i Försäljningsledningen, som ditt konto inte har tillgång till. Prata med din försäljningschef.', { kalla: 'sparr' });
    }
    for (var i = 0; i < K.sparrOrd.length; i++) {
      var x = K.sparrOrd[i];
      if (x.re.test(q) && !rollerOk(x.roller)) return svar('Det hör till ' + esc(x.namn) + ', som ditt konto inte har tillgång till. Prata med ' + esc(x.till) + '.', { kalla: 'sparr' });
    }
    return null;
  }

  /* --- Datum och namn ur fritext ---------------------------------------------- */
  var VECKODAGAR = { sondag: 0, mandag: 1, tisdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lordag: 6 };
  function plockaDag(t) {
    var n = norm(t), d = new Date(), bort = null, m;
    if (/\bi overmorgon\b/.test(n)) { d.setDate(d.getDate() + 2); bort = /\bi övermorgon\b/i; }
    else if (/\bi ?morgon\b/.test(n)) { d.setDate(d.getDate() + 1); bort = /\bi ?morgon\b/i; }
    else if (/\bi ?dag\b/.test(n)) { bort = /\bi ?dag\b/i; }
    else if (/\bnasta vecka\b/.test(n)) { d.setDate(d.getDate() + 7); bort = /\bnästa vecka\b/i; }
    else if ((m = /\bom (\d{1,2}) dagar?\b/.exec(n))) { d.setDate(d.getDate() + (+m[1])); bort = /\bom \d{1,2} dagar?\b/i; }
    else if ((m = /\b(?:pa )?(sondag|mandag|tisdag|onsdag|torsdag|fredag|lordag)\b/.exec(n))) {
      var mal = VECKODAGAR[m[1]], steg = (mal - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + steg);
      bort = /\b(?:på )?(?:söndag|måndag|tisdag|onsdag|torsdag|fredag|lördag)\b/i;
    } else return null;
    return { dag: IH.dagStr(d), rest: t.replace(bort, ' ').replace(/\s+/g, ' ').trim() };
  }
  function plockaTid(t) { var m = /\b(?:kl\.?|klockan)\s*(\d{1,2})(?:[.:](\d{2}))?\b/i.exec(t); if (!m) return null; return { tid: String(m[1]).padStart(2, '0') + ':' + (m[2] || '00'), rest: t.replace(m[0], ' ').replace(/\s+/g, ' ').trim() }; }

  /* --- Handlingar: öppnar det vanliga formuläret, ändrar aldrig data ----------- */
  function handling(fraga, q) {
    if (/^(hur|var|vad|varfor|nar|kan|vilken|vilka|finns)\b/.test(q) || /\b(guide|guiden|guida|kurs|kursen|rundtur)\b/.test(q)) return null;
    var ar = /^(ny|nytt|nya|skapa|lagg till|lagg in|registrera|boka|starta|gor|lagga till|skapa en|lagg upp)\b/.test(q) || /^(jag )?(vill|behover|ska) (ha |skapa |lagga till |boka |starta |gora )/.test(q);
    if (!ar) return null;
    var j = jag(), admin = j.roll === 'admin';
    var saljForm = function () { return admin ? svar('Administratören skapar inte säljposter. Gå in i en säljares konto via <b>Teamet</b> i menyn.', { kalla: 'sparr' }) : null; };
    var m;
    if (/video ?mote|videosamtal/.test(q)) {
      if (!far('mote')) return saljForm() || saljSparr('Videomöten');
      var k = V.hittaKund(fraga.replace(/video ?möte/ig, ' ')), dt = plockaDag(fraga), tt = plockaTid(fraga), kk = k.kunder && k.kunder[0];
      return svar(kk ? 'Jag öppnar bokningen för <b>' + esc(kk.namn) + '</b>. Du väljer tid och bokar själv.' : 'Jag öppnar <b>Nytt videomöte</b>. Du väljer deltagare och tid.', { utfor: { typ: 'form', form: 'videomote', falt: { kund: kk ? kk.id : null, dag: dt && dt.dag, tid: tt && tt.tid } }, kalla: 'form' });
    }
    if (/\bkundmote\b|\bpresentation\b/.test(q)) {
      if (!far('mote')) return saljForm() || saljSparr('Kundmöte');
      return svar('Jag tar dig till Kundmöte. Välj affär och klicka på <b>Starta presentation</b>.', { utfor: { typ: 'ga', adress: '#/mote' } });
    }
    if (/\buppgift|\bpaminnelse\b|\bpaminn\b/.test(q)) {
      if (admin) return saljForm();
      var t = fraga.replace(/^.*?\b(uppgift(?:en)?|påminnelse|påminn(?: mig)?)\b(?:\s+(?:om|att))?[:\s]*/i, '');
      var dag = plockaDag(t); if (dag) t = dag.rest;
      var kn = V.hittaKund(t), kund = kn.kunder && kn.kunder[0];
      return svar('Jag fyller i uppgiften under <b>Att göra</b>. Tryck på <b>Lägg till</b> om den stämmer.', { utfor: { typ: 'form', form: 'uppgift', falt: { text: t ? t.charAt(0).toUpperCase() + t.slice(1) : '', dag: dag && dag.dag, kund: kund ? kund.id : null } }, kalla: 'form' });
    }
    if (/\bforfragan\b/.test(q)) {
      if (admin) return saljForm();
      if (!far('forfragningar')) return saljSparr('Förfrågningar');
      m = /förfrågan\s*(?:från|av|med|:)?\s*(.*)$/i.exec(fraga);
      return svar('Jag öppnar <b>Lägg in förfrågan</b>. Du sparar själv.', { utfor: { typ: 'form', form: 'forfragan', falt: { namn: m ? m[1].trim() : '' } }, kalla: 'form' });
    }
    if (/\bkund\b/.test(q)) {
      if (admin) return saljForm();
      if (!far('kunder')) return saljSparr('Kunder');
      m = /kund(?:en)?\s*(?:som heter|med namnet|med namn|vid namn|:|-)?\s*(.*)$/i.exec(fraga);
      var namn = m ? m[1].trim() : '', ort = '', ml = /\b(?:i|från)\s+([A-ZÅÄÖ][\wåäöÅÄÖ-]+)\s*$/.exec(namn);
      if (ml) { ort = ml[1]; namn = namn.slice(0, ml.index).trim(); }
      var tel = /(\+?\d[\d\s-]{6,})/.exec(namn); if (tel) { namn = namn.replace(tel[0], '').trim(); }
      var mejl = /([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(namn); if (mejl) { namn = namn.replace(mejl[0], '').trim(); }
      return svar('Jag öppnar <b>Ny kund</b>' + (namn ? ' med <b>' + esc(namn) + '</b> ifyllt' : '') + '. Du sparar själv.', { utfor: { typ: 'form', form: 'kund', falt: { namn: namn, ort: ort, telefon: tel ? tel[1].trim() : '', epost: mejl ? mejl[1] : '' } }, kalla: 'form' });
    }
    if (/\baffar\b/.test(q)) {
      if (admin) return saljForm();
      if (!far('salj')) return saljSparr('Säljtavlan');
      var ka = V.hittaKund(fraga.replace(/affär(en)?/ig, ' ')), kb = ka.kunder && ka.kunder[0];
      return svar('Jag öppnar <b>Ny affär</b>' + (kb ? ' för ' + esc(kb.namn) : '') + '. Du sparar själv.', { utfor: { typ: 'form', form: 'affar', falt: { kund: kb ? kb.id : null } }, kalla: 'form' });
    }
    if (/\boffert\b/.test(q)) {
      if (admin) return saljForm();
      if (!far('offerter')) return saljSparr('Offerter');
      return svar('Jag öppnar <b>Ny offert</b>. Välj affären den gäller.', { utfor: { typ: 'form', form: 'offert', falt: {} }, kalla: 'form' });
    }
    return null;
  }

  /* --- Sidor ------------------------------------------------------------------- */
  var SIDOR = [
    ['oversikt', '#/', 'Översikt', 'oversikt oversikten startsidan start hem hemsidan i crm'],
    ['forfragningar', '#/forfragningar', 'Förfrågningar', 'forfragningar forfragan forfragningarna inkorg inkorgen leads'],
    ['salj', '#/salj', 'Säljtavlan', 'saljtavla saljtavlan tavlan pipeline affarer affarerna'],
    ['kunder', '#/kunder', 'Kunder', 'kunder kunderna kundlistan kundregistret'],
    ['offerter', '#/offerter', 'Offerter', 'offerter offerterna'],
    ['mote', '#/mote', 'Kundmöte', 'kundmote kundmoten moten'],
    ['videomote', '#/videomote', 'Videomöten', 'videomote videomoten'],
    ['produktion', '#/produktion', 'Projekt', 'projekt projekten produktion produktionen'],
    ['dokument', '#/dokument', 'Dokument', 'dokument dokumenten arkivet mallar'],
    ['kolla-marken', '#/kolla-marken', 'Kolla marken', 'kolla marken marken'],
    ['att-gora', '#/att-gora', 'Att göra', 'att gora uppgifter uppgifterna'],
    ['chatt', '#/chatt', 'Meddelanden', 'meddelanden chatt chatten'],
    ['installningar', '#/installningar', 'Inställningar', 'installningar installningarna prislistan'],
    ['profil', '#/profil', 'Min profil', 'profil profilen min profil kalender kalendern'],
    ['chef', '#/chef', 'Försäljningsledning', 'forsaljningsledning chefsvyn chefsvy'],
    ['kontroll', '#/kontroll', 'Kontrollcentralen', 'kontrollcentral kontrollcentralen'],
    ['admin', '#/admin', 'Adminpanelen', 'adminpanel adminpanelen admin'],
    ['sakerhet', '#/sakerhet', 'Säkerhet', 'sakerhet sakerheten']
  ];
  function sidaI(text) {
    var bast = null;
    SIDOR.forEach(function (s) { s[3].split(' ').concat(s[3].indexOf('att gora') >= 0 ? ['att gora'] : [], s[3].indexOf('kolla marken') >= 0 ? ['kolla marken'] : [], s[3].indexOf('min profil') >= 0 ? ['min profil'] : []).forEach(function (o) {
      if (o.length < 3 || o === 'att' || o === 'gora' || o === 'min') return;
      var re = new RegExp('(^| )' + o + '( |$)');
      if (re.test(text) && (!bast || o.length > bast.o.length)) bast = { s: s, o: o };
      else if (!bast && o.length >= 6) text.split(' ').forEach(function (w) { if (w.length >= 5 && dist(w, o, o.length >= 8 ? 2 : 1) <= (o.length >= 8 ? 2 : 1)) bast = { s: s, o: o }; });
    }); });
    return bast && bast.s;
  }
  function navigera(q) {
    var m = /^(?:kan du )?(?:ta mig till|ga till|ga in pa|oppna|navigera till|byt till|till|hoppa till)\s+(?:sidan\s+|min\s+|mina\s+|fliken\s+)?(.+)$/.exec(q);
    if (!m) return null;
    var s = sidaI(m[1]);
    if (!s) return null;
    if (!far(s[0])) return sparr(s[0]) || saljSparrSida(s);
    return svar('Jag öppnar <b>' + esc(s[2]) + '</b>.', { utfor: { typ: 'ga', adress: s[1] } });
  }
  function saljSparrSida(s) {
    if (s[0] === 'chef') return svar('Försäljningsledningen ingår inte i ditt konto. Prata med din försäljningschef.', { kalla: 'sparr' });
    if (/^(kontroll|admin|sakerhet)$/.test(s[0])) return svar('Det hör till administrationen, som ditt konto inte har tillgång till. Prata med administratören.', { kalla: 'sparr' });
    return saljSparr(s[2]);
  }

  /* --- Guider ------------------------------------------------------------------- */
  function guider(fraga, q) {
    if (!/\b(guide|guiden|guida|guider|rundtur|rundturen|kurs|kurser|kursen|lar mig|visa hur|tur)\b/.test(q)) return null;
    if (/^(starta|oppna|visa|ge mig)?\s*(en |nagon )?(guide|guiderna|guider|kurs|kurser|kurserna|rundtur)$/.test(q) || /^vilka (guider|kurser)/.test(q)) return svar('Här är kurserna. Du provar själv med exempeldata.', { utfor: { typ: 'guide' } });
    var l = sok(fraga.replace(/guid(?:en|a|er|erna)?|starta|mig|rundtur(?:en)?|kurs(?:en)?|lär/ig, ' ')).lista.filter(function (x) { return x.d.a.tur && tillats(x.d.a); });
    var t = l[0] && l[0].po >= 0.5 && IH.guide.tur(l[0].d.a.tur);
    if (t && IH.guide.rollOk(t.roller)) return svar('Jag startar guiden <b>' + esc(t.namn) + '</b>.', { utfor: { typ: 'tur', tur: t.id } });
    return svar('Här är kurserna.', { utfor: { typ: 'guide' } });
  }

  /* --- Läget ur datan ------------------------------------------------------------ */
  function nekat(r) { return saljSparr(r.nekad); }
  function uppgifterDag(d, ord) {
    var r = V.uppgifter(d);
    return svar(r.antal ? 'Du har <b>' + plural(r.antal, 'uppgift', 'uppgifter') + '</b> ' + ord + '.' : 'Du har inga uppgifter ' + ord + '.', { rader: r.rader, kalla: 'data', sida: '#/att-gora', knappar: [{ etikett: 'Öppna Att göra', typ: 'ga', adress: '#/att-gora' }], verktyg: 'uppgifter' });
  }
  function dataFraga(q) {
    var r;
    var uppg = /uppgift|att gora|to ?do/.test(q);
    if ((/\bsen|forsen|missat|ligger efter|forfallna/.test(q) && (uppg || /^(ar|har) jag /.test(q)))) {
      r = V.senaUppgifter();
      return svar(r.antal ? 'Du har <b>' + plural(r.antal, 'försenad uppgift', 'försenade uppgifter') + '</b>.' : 'Du har inga försenade uppgifter.', { rader: r.rader, kalla: 'data', sida: '#/att-gora', knappar: [{ etikett: 'Öppna Att göra', typ: 'ga', adress: '#/att-gora' }], verktyg: 'uppgifter' });
    }
    if (uppg && /i ?morgon/.test(q)) return uppgifterDag(1, 'i morgon');
    if ((uppg && /(i ?dag|dagens|hur manga|vilka|mina|har jag)/.test(q) && !/^(hur (skapar|gor|lagger|andrar|tar)|kan jag)/.test(q))) return uppgifterDag(0, 'i dag');
    if (/(vad ska jag gora|vad borde jag gora|vad ska jag borja|var ska jag borja|vad ar viktigast|dagens lage|laget i dag|hur ser (dagen|min dag|laget)|sammanfatta|vad ar det for lage|^(laget|hur ar laget)$|vad galler i dag|min dag)/.test(q)) return dagen();
    if (/forfrag|\bleads?\b|inkorg/.test(q) && /\b(ny|nya)\b|vantar|obesvar|hur manga|antal|har jag|finns det|oppna/.test(q) && !/^(hur (svarar|lagger|skapar|gor|tar)|hur kan)/.test(q)) {
      r = V.nyaForfragningar(); if (r.nekad) return nekat(r);
      return svar(r.antal ? '<b>' + plural(r.antal, 'ny förfrågan', 'nya förfrågningar') + '</b> väntar på svar. Den som väntat längst står först.' : 'Inga nya förfrågningar väntar.', { rader: r.rader, kalla: 'data', sida: '#/forfragningar', knappar: [{ etikett: 'Öppna Förfrågningar', typ: 'ga', adress: '#/forfragningar' }] });
    }
    if (/offert/.test(q) && /(gar ut|gar snart|utgar|snart ut|forfaller|gamla|loper ut)/.test(q) && !/^hur /.test(q)) {
      r = V.offerterGarUt(); if (r.nekad) return nekat(r);
      return svar(r.antal ? '<b>' + plural(r.antal, 'offert', 'offerter') + '</b> går ut inom tio dagar.' : 'Ingen offert går ut inom tio dagar.', { rader: r.rader, kalla: 'data', sida: '#/offerter', knappar: [{ etikett: 'Öppna Offerter', typ: 'ga', adress: '#/offerter' }] });
    }
    if (/offert/.test(q) && /(vantar|svar|obesvar|skickade|ute hos|hur manga|antal)/.test(q) && !/^(hur (ser|svarar|gor|skickar)|nar)/.test(q)) {
      r = V.offerterVantar(); if (r.nekad) return nekat(r);
      return svar(r.antal ? '<b>' + plural(r.antal, 'offert', 'offerter') + '</b> väntar på svar' + (r.mina ? ', ' + r.mina + ' av dem är dina' : '') + '.' : 'Inga offerter väntar på svar.', { rader: r.rader, kalla: 'data', sida: '#/offerter', knappar: [{ etikett: 'Öppna Offerter', typ: 'ga', adress: '#/offerter' }] });
    }
    if (/(nasta|narmaste|kommande|forsta|mina) (mote|moten|platsbesok|videomote|bokning)|(har jag|finns det) (nagot|nagra)? ?(mote|moten|platsbesok)|moten i (dag|morgon)|nar ska jag traffa/.test(q) || /^nar ar (mitt )?(nasta )?mote/.test(q)) {
      r = V.moten();
      var fm = r.forsta;
      return svar(fm ? 'Ditt nästa möte: <b>' + esc(fm.titel) + '</b>, ' + narText(fm.tid) + '.' : 'Du har inga möten inbokade.', { rader: r.rader, kalla: 'data', sida: far('mote') ? '#/mote' : '#/att-gora' });
    }
    if (/(storsta|storst|hogsta|tyngsta|basta|dyraste|viktigaste) (oppna )?affar/.test(q) || /affar.*(storst|hogst)/.test(q) || /topp ?(3|5|tre|fem) affar/.test(q)) {
      r = V.storstaAffarer(); if (r.nekad) return nekat(r);
      return svar(r.antal ? 'De största öppna affärerna:' : 'Det finns inga öppna affärer.', { rader: r.rader, kalla: 'data', sida: '#/salj', knappar: [{ etikett: 'Öppna Säljtavlan', typ: 'ga', adress: '#/salj' }] });
    }
    if (/affar/.test(q) && /(star still|stilla|fastnat|gamla|ingen hant|inte hant|inaktiv)/.test(q) && !/^vad (betyder|ar)/.test(q)) {
      r = V.stillaAffarer(); if (r.nekad) return nekat(r);
      return svar(r.antal ? '<b>' + plural(r.antal, 'affär', 'affärer') + '</b> har inte ändrats på över tio dagar.' : 'Ingen affär står still.', { rader: r.rader, kalla: 'data', sida: '#/salj' });
    }
    if (/(prognos|pipen|pipeline|oppna affarer|hur mycket .*(oppet|affarer)|affarer .*(varda|vart)|varde pa)/.test(q) && !/^vad (betyder|ar) /.test(q)) {
      r = V.prognos(); if (r.nekad) return nekat(r);
      return svar('<b>' + plural(r.antal, 'öppen affär', 'öppna affärer') + '</b> värda ' + kr(r.totalt) + '. Viktat ' + kr(r.viktat) + '.', { kalla: 'data', sida: '#/salj', knappar: [{ etikett: 'Öppna Säljtavlan', typ: 'ga', adress: '#/salj' }] });
    }
    if (/montage/.test(q) && /(nar|nasta|narmaste|kommande)/.test(q)) {
      r = V.nastaMontage(); if (r.nekad) return nekat(r);
      return svar(r.antal ? 'Nästa montage:' : 'Inget montage är inplanerat.', { rader: r.rader, kalla: 'data', sida: '#/produktion' });
    }
    if (/hur manga|antal/.test(q)) {
      var fall = [[/kunder/, 'kunder', 'kund', 'kunder', 'kunder', 'Kunder'], [/affarer/, 'salj', 'öppen affär', 'öppna affärer', null, 'Säljtavlan'], [/projekt/, 'produktion', 'aktivt projekt', 'aktiva projekt', null, 'Projekt']];
      for (var i = 0; i < fall.length; i++) if (fall[i][0].test(q)) {
        if (!far(fall[i][1])) return saljSparr(fall[i][5]);
        var n = fall[i][1] === 'kunder' ? IH.db.kunder.length : fall[i][1] === 'salj' ? oppna().length : IH.db.projekt.filter(function (p) { return p.steg !== 'klart'; }).length;
        return svar('Det finns <b>' + plural(n, fall[i][2], fall[i][3]) + '</b>.', { kalla: 'data' });
      }
    }
    if ((/(teamet|per saljare|hur gar det for|topplista|vem .*(salt|vunnit|mest)|vem ligger)/.test(q) || /(sahand|ahmed).*(salt|vunnit|siffror)/.test(q)) && far('chef')) {
      r = V.teamLage();
      return svar('Så ligger säljarna, störst vunnet först:', { rader: r.rader, kalla: 'data', sida: '#/chef', knappar: [{ etikett: 'Öppna Försäljningsledning', typ: 'ga', adress: '#/chef' }] });
    }
    if (/pris|kostar|kosta\b/.test(q)) {
      r = V.husPris(q);
      if (r.antal && r.pris != null) return svar('<b>' + esc(r.modell.namn) + '</b> står i prislistan för ' + kr(r.pris) + '. Det är ett exempelpris.', { kalla: 'data', sida: '#/installningar', knappar: [{ etikett: 'Öppna prislistan', typ: 'ga', adress: '#/installningar' }] });
    }
    if (/(har jag (salt|vunnit)|mitt vunna|mina vunna|vunnet i ar)/.test(q)) {
      r = V.mittVunnet(); if (r.nekad) return nekat(r);
      return svar(r.antal ? 'Du har vunnit <b>' + plural(r.antal, 'affär', 'affärer') + '</b> i år, värda ' + kr(r.summa) + '.' : 'Du har inga vunna affärer i år.', { kalla: 'data', sida: '#/salj' });
    }
    if (/(olasta|oppna aviseringar|hur manga aviseringar)/.test(q) && IH.avisera && IH.avisera.olasta) { var o = IH.avisera.olasta(); return svar(o ? 'Du har <b>' + plural(o, 'oläst avisering', 'olästa aviseringar') + '</b>.' : 'Inga olästa aviseringar.', { kalla: 'data' }); }
    return null;
  }
  function dagen() {
    var del = [], rader = [], sena = V.senaUppgifter(), idag = V.uppgifter(0), m = V.moten();
    if (sena.antal) { del.push(plural(sena.antal, 'försenad uppgift', 'försenade uppgifter')); rader = rader.concat(sena.rader.slice(0, 2)); }
    if (idag.antal) { del.push(plural(idag.antal, 'uppgift', 'uppgifter') + ' i dag'); rader = rader.concat(idag.rader.slice(0, 2)); }
    if (far('forfragningar')) { var f = V.nyaForfragningar(); if (f.antal) { del.push(plural(f.antal, 'ny förfrågan', 'nya förfrågningar')); rader = rader.concat(f.rader.slice(0, 1)); } }
    if (far('offerter')) { var g = V.offerterGarUt(); if (g.antal) { del.push(plural(g.antal, 'offert', 'offerter') + ' som går ut snart'); rader = rader.concat(g.rader.slice(0, 1)); } }
    if (m.forsta && dagar(m.forsta.tid) <= 1) del.push('möte ' + narText(m.forsta.tid));
    return svar(del.length ? 'Så här ser det ut: <b>' + del.map(esc).join('</b>, <b>') + '</b>. Börja med det som är försenat.' : 'Det är lugnt. Inget är försenat och inget väntar just nu.', { rader: rader.slice(0, 5), kalla: 'data', sida: '#/att-gora', verktyg: 'uppgifter' });
  }
  function kundFraga(fraga, q) {
    if (!far('kunder')) return null;
    if (!/(vem ar|info om|uppgifter om|telefon|nummer|mejl|epost|e-post|kund|ring|oppna|visa|hitta|sok)/.test(q)) return null;
    if (/^hur /.test(q)) return null;
    var r = V.hittaKund(fraga.replace(/\b(kund(en)?|telefon(nummer)?|nummer|mejl|e-?post|info|uppgifter|ring|öppna|visa|hitta|sök|vem|är)\b/ig, ' '));
    if (!r.antal) return null;
    var k = r.kunder[0], aff = IH.db.affarer.filter(function (a) { return a.kund === k.id && !a.forlorad && a.steg !== 'vunnen'; }), bit = [];
    if (k.ort) bit.push(esc(k.ort));
    if (k.telefon) bit.push(esc(k.telefon));
    if (k.epost) bit.push(esc(k.epost));
    return svar('<b>' + esc(k.namn) + '</b>' + (bit.length ? ': ' + bit.join(' · ') : '') + '.' + (aff.length ? ' ' + plural(aff.length, 'öppen affär', 'öppna affärer') + '.' : ''), { kalla: 'data', sida: '#/kunder/' + k.id, knappar: [{ etikett: 'Öppna kundkortet', typ: 'ga', adress: '#/kunder/' + k.id }] });
  }

  /* --- Kunskapsbasen -------------------------------------------------------------- */
  function kunskap(fraga, q) {
    var r = sok(fraga), tillat = r.lista.filter(function (x) { return tillats(x.d.a); });
    var bast = tillat[0];
    var visaNu = /^(visa mig|visa var|peka( ut| pa)?|var (ar|finns|hittar jag|ligger)|vart (ar|finns))/.test(q);
    // Finns svaret bara i en del rollen inte får se: säg det, utan innehållet
    var dolt = r.lista[0];
    if (dolt && dolt.po >= 0.5 && !tillats(dolt.d.a) && (!bast || dolt.po > bast.po)) return dolt.d.a.vy ? saljSparr('Det') : svar('Det hör till en del av CRM:et som ditt konto inte har tillgång till.', { kalla: 'sparr' });
    if (bast && bast.po >= 0.55) {
      var tva = tillat[1];
      // Två ämnen lika nära och frågan är vag: fråga vilket
      if (tva && tva.po > bast.po * 0.94 && bast.po < 0.7 && tva.d.a.tur !== bast.d.a.tur) return osakerSvar(tillat);
      return amneSvar(bast.d.a, visaNu);
    }
    if (bast && bast.po >= 0.34) return osakerSvar(tillat);
    return okant(tillat);
  }
  function amneSvar(a, visaNu) {
    var kn = [];
    if (a.visa) kn.push({ etikett: 'Visa mig', typ: 'visa', visa: a.visa });
    if (a.sida) kn.push({ etikett: 'Ta mig dit', typ: 'ga', adress: a.sida });
    if (a.tur && IH.guide && IH.guide.tur(a.tur)) kn.push({ etikett: 'Starta guiden', typ: 'tur', tur: a.tur });
    if (a.id === 'lar') kn.push({ etikett: 'Öppna kurserna', typ: 'guide' });
    var ut = svar(a.s, { knappar: kn, kalla: 'kunskap', visa: a.visa, sida: a.sida, tur: a.tur, amne: a.id });
    if (visaNu && a.visa) ut.utfor = { typ: 'visa', visa: a.visa };
    else if (visaNu && a.sida) ut.utfor = { typ: 'ga', adress: a.sida };
    return ut;
  }
  function namnFor(x) { return x.d.a.t.replace(/^Guiden /, ''); }
  function osakerSvar(l) {
    var val = l.slice(0, 3);
    return svar('Jag är inte säker på vad du menar. Är det något av det här?', { kalla: 'osaker', knappar: val.map(function (x) { return { etikett: namnFor(x), typ: 'fraga', fraga: x.d.a.t }; }) });
  }
  function okant(l) {
    var val = l.filter(function (x) { return x.po >= 0.22; }).slice(0, 3);
    return svar('Det vet jag inte. Jag kan bara svara på sådant som finns i CRM:et.' + (val.length ? ' Närmast är:' : ''), {
      kalla: 'okand',
      knappar: val.length ? val.map(function (x) { return { etikett: namnFor(x), typ: 'fraga', fraga: x.d.a.t }; }) : [{ etikett: 'Vad kan du hjälpa till med?', typ: 'fraga' }, { etikett: 'Öppna kurserna', typ: 'guide' }]
    });
  }

  /* --- Motorn ---------------------------------------------------------------------- */
  var lokalMotor = {
    namn: 'lokal',
    svara: function (fraga, s) {
      var q = norm(fraga);
      return smaprat(q) || foljd(q, s) || sparr(q) || handling(fraga, q) || navigera(q) || guider(fraga, q) || dataFraga(q) || kundFraga(fraga, q) || kunskap(fraga, q);
    }
  };
  var motor = lokalMotor;
  A.sattMotor = function (m) { motor = m || lokalMotor; };
  A.motor = function () { return motor.namn; };
  A.svara = function (fraga, s) {
    s = s || sammanhang();
    return Promise.resolve().then(function () { return motor.svara(String(fraga || ''), s); }).catch(function (e) {
      console.warn('Assistenten', e);
      return lokalMotor.svara(String(fraga || ''), s);
    });
  };
  function sammanhang() {
    var j = jag(), h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    return { sida: location.hash || '#/', vy: h[0] || 'oversikt', jag: { id: j.id, namn: j.namn, roll: j.roll, chef: !!j.chef }, senaste: A.senaste || null };
  }
  A.sammanhang = sammanhang;

  /* =====================================================================
     PANELEN: gränssnitt, figur och körning av handlingar
     ===================================================================== */
  var SVG = {
    hus: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 15 16 5l11 10" /><path d="M8 13.5V26h16V13.5"/><circle class="ia-oga" cx="12.5" cy="17" r="1.6"/><circle class="ia-oga" cx="19.5" cy="17" r="1.6"/><path d="M13.5 22h5"/></svg>',
    stang: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    skicka: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
  };
  var knapp, panel, logg, forslagEl, falt, figur = null, figurLaddar = false, oppen = false, lugn = matchMedia('(prefers-reduced-motion: reduce)'), html = document.documentElement;
  var kontoId = null, stadTimer = 0, svarTimer = 0, bubbla = null, tipsTimer = 0, tipsSedda = {}, tipsSenast = 0, tipsStangd = 0;
  var SIDA = 176, LS = 'ih-crm-assistent:';
  function installning() { var v = {}; try { v = JSON.parse(localStorage.getItem(LS + jag().id)) || {}; } catch (e) { /* */ } return { lage: v.lage || 'levande', sida: v.sida || 'hoger' }; }
  function stillaNu() { return lugn.matches || installning().lage === 'stilla'; }

  function bygg() {
    if (knapp) return;
    knapp = document.createElement('button');
    knapp.type = 'button'; knapp.className = 'ia-knapp';
    knapp.setAttribute('aria-label', 'Hjälpassistenten'); knapp.setAttribute('aria-haspopup', 'dialog'); knapp.setAttribute('aria-expanded', 'false'); knapp.title = 'Hjälpassistenten';
    knapp.innerHTML = '<span class="ia-knapp__ikon">' + SVG.hus + '</span><canvas class="ia-knapp__figur" width="' + SIDA + '" height="' + SIDA + '"></canvas>';
    knapp.addEventListener('click', function () { dolTips(); A.vaxla(); });
    knapp.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse' && figur && !oppen) figur.vinka(); });
    document.body.appendChild(knapp);
    tillampa();
    addEventListener('hashchange', function () { ritaForslag(); dolTips(); planeraTips(4500); });
    addEventListener('resize', function () { if (oppen) flyttaKnapp(); });
    lugn.addEventListener('change', function () { if (figur) figur.sattStilla(stillaNu()); });
    document.addEventListener('visibilitychange', granska);
    new MutationObserver(granska).observe(html, { attributes: true, attributeFilter: ['data-presenterar', 'data-ark-oppen', 'data-palett-oppen', 'data-konto-oppen'] });
    new MutationObserver(granska).observe(document.body, { childList: true });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && oppen && panel && panel.contains(document.activeElement)) { ev.stopPropagation(); A.stang(); knapp.focus({ preventScroll: true }); } }, true);
    granska();
    // Figuren laddas när CRM:et har ritat klart och webbläsaren har tid över, så att starten inte blir långsammare
    var ladda = function () { laddaFigur(); planeraTips(7000); };
    setTimeout(function () { if (window.requestIdleCallback) requestIdleCallback(ladda, { timeout: 3000 }); else ladda(); }, 900);
  }
  function tillampa() {
    var v = installning();
    html.toggleAttribute('data-ia-vanster', v.sida === 'vanster');
    html.toggleAttribute('data-ia-ikon', v.lage === 'ikon');
    if (v.lage === 'ikon') { if (figur) { figur.frigor(); figur = null; byttCanvas(); } knapp.classList.remove('ia-knapp--3d'); }
    else if (figur) figur.sattStilla(stillaNu());
    else laddaFigur();
    html.toggleAttribute('data-ia-stilla', stillaNu());
    if (oppen) flyttaKnapp();
  }
  function byttCanvas() { var c = knapp.querySelector('canvas'); if (c) { var ny = c.cloneNode(false); c.replaceWith(ny); } }
  function byggPanel() {
    if (panel) return;
    panel = document.createElement('aside');
    panel.className = 'ia-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Hjälpassistenten'); panel.hidden = true;
    panel.innerHTML = '<header class="ia-topp"><div class="ia-figur" aria-hidden="true"></div>' +
      '<div class="ia-topp__text"><h2>Hjälpassistenten</h2><p>Lokal hjälp i webbläsaren. Inte AI.</p></div>' +
      '<button type="button" class="ia-x" data-ia="stang" aria-label="Stäng">' + SVG.stang + '</button></header>' +
      '<div class="ia-logg" role="log" aria-live="polite" tabindex="-1"></div>' +
      '<div class="ia-forslag"></div>' +
      '<form class="ia-rad"><input type="text" name="fraga" autocomplete="off" maxlength="300" placeholder="Fråga om CRM:et" aria-label="Din fråga"><button type="submit" class="ia-skicka" aria-label="Skicka">' + SVG.skicka + '</button></form>';
    logg = panel.querySelector('.ia-logg'); forslagEl = panel.querySelector('.ia-forslag'); falt = panel.querySelector('input');
    panel.addEventListener('click', klick);
    panel.querySelector('form').addEventListener('submit', function (ev) { ev.preventDefault(); var t = falt.value.trim(); if (!t) return; falt.value = ''; A.fraga(t); });
    falt.addEventListener('input', function () { sattFigur(falt.value ? 'lyssnar' : 'vila'); });
    falt.addEventListener('blur', function () { if (!falt.value) sattFigur('vila'); });
    document.body.appendChild(panel);
  }
  function halsa() {
    logg.innerHTML = '';
    meddelande('ia', svar('Hej ' + esc(String(jag().namn).split(' ')[0]) + '! Fråga om CRM:et eller om läget, så svarar jag utifrån hjälptexterna och din data här i webbläsaren. Jag är ingen AI och kan missa saker.'));
  }
  function ritaForslag() {
    if (!forslagEl) return;
    var vy = sammanhang().vy, l = (K.forslag[vy] || K.forslag._).filter(function (f) { return !sparr(norm(f)) && !(jag().roll === 'admin' && /^(ny kund|nytt videom)/i.test(f)); });
    if (!l.length) l = K.forslag._;
    forslagEl.innerHTML = l.slice(0, 3).map(function (f) { return '<button type="button" data-ia="fraga" data-t="' + esc(f) + '">' + esc(f) + '</button>'; }).join('');
  }
  function meddelande(vem, s) {
    var d = document.createElement('div');
    d.className = 'ia-medd ia-medd--' + vem;
    if (vem === 'jag') { d.textContent = s; logg.appendChild(d); rulla(); return; }
    var h = '<div class="ia-medd__text">' + s.text + '</div>';
    if (s.rader && s.rader.length) h += '<ul class="ia-rader">' + s.rader.map(function (r) { return '<li><a href="' + esc(r.lank) + '" data-ia="ga" data-a="' + esc(r.lank) + '"><b>' + esc(r.titel) + '</b>' + (r.under ? '<small>' + esc(r.under) + '</small>' : '') + '</a></li>'; }).join('') + '</ul>';
    if (s.knappar && s.knappar.length) h += '<div class="ia-knappar">' + s.knappar.map(function (k, i) { return '<button type="button" data-ia="k" data-i="' + i + '">' + esc(k.etikett) + '</button>'; }).join('') + '</div>';
    d.innerHTML = h;
    d.__svar = s;
    logg.appendChild(d);
    rulla();
  }
  function rulla() { logg.scrollTo({ top: logg.scrollHeight, behavior: lugn.matches ? 'auto' : 'smooth' }); }
  function klick(ev) {
    var b = ev.target.closest('[data-ia]'); if (!b) return;
    var g = b.getAttribute('data-ia');
    if (g === 'stang') { A.stang(); knapp.focus({ preventScroll: true }); }
    else if (g === 'fraga') A.fraga(b.getAttribute('data-t'));
    else if (g === 'ga') { ev.preventDefault(); utfor({ typ: 'ga', adress: b.getAttribute('data-a') }); }
    else if (g === 'k') { var m = b.closest('.ia-medd'), k = m && m.__svar && m.__svar.knappar[+b.getAttribute('data-i')]; if (!k) return; if (k.typ === 'fraga') A.fraga(k.fraga || k.etikett); else utfor(k); }
  }

  /* --- Handlingarna ------------------------------------------------------------------ */
  function fyll(sel, v) {
    if (v == null || v === '') return;
    var x = document.querySelector(sel); if (!x) return;
    var p = x.tagName === 'SELECT' ? HTMLSelectElement.prototype : x.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p, 'value').set.call(x, v);
    x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function attr(o) { return { getAttribute: function (n) { return o[n] || null; } }; }
  function formular(f, v) {
    v = v || {};
    if (f === 'kund') { IH.G['ny-kund'](); setTimeout(function () { fyll('#ny-kund-form [name=namn]', v.namn); fyll('#ny-kund-form [name=ort]', v.ort); fyll('#ny-kund-form [name=telefon]', v.telefon); fyll('#ny-kund-form [name=epost]', v.epost); }, 60); }
    else if (f === 'forfragan') { IH.G['ny-forfragan'](); setTimeout(function () { fyll('#nyf-form [name=namn]', v.namn); }, 60); }
    else if (f === 'affar') { if (v.kund) IH.G['ny-affar-kund'](attr({ 'data-id': v.kund })); else IH.G['ny-affar'](); }
    else if (f === 'offert') IH.G['offert-ny']();
    else if (f === 'videomote') {
      if (v.kund) { IH.G['vm-boka'](attr({ 'data-kund': v.kund, 'data-dag': v.dag })); setTimeout(function () { fyll('#vm-boka-form [name=tid]', v.tid); }, 60); }
      else if (IH.videomote) IH.videomote.nytt();
    } else if (f === 'uppgift') {
      IH.stangArk(true); IH.ga('#/att-gora');
      var n = 0;
      (function vanta() {
        if (!document.querySelector('.nyuppg input[name=text]')) { if (n++ < 30) setTimeout(vanta, 100); return; }
        fyll('.nyuppg input[name=text]', v.text); fyll('.nyuppg [name=datum]', v.dag); fyll('.nyuppg select[name=kund]', v.kund);
        var x = document.querySelector('.nyuppg input[name=text]'); try { x.focus({ preventScroll: true }); x.scrollIntoView({ block: 'center' }); } catch (e) { /* */ }
      })();
    }
  }
  function utfor(k) {
    if (!k) return;
    if (k.typ === 'ga') { if (mobilbredd() || /^#\/kunder\//.test(k.adress)) A.stang(); IH.ga ? IH.ga(k.adress) : (location.hash = k.adress); return; }
    if (k.typ === 'tur') { A.stang(); if (IH.guide) IH.guide.starta(k.tur); return; }
    if (k.typ === 'guide') { A.stang(); if (IH.guide) setTimeout(function () { IH.guide.oppna(); }, 60); return; }
    if (k.typ === 'form') { A.stang(); formular(k.form, k.falt); return; }
    if (k.typ === 'visa') {
      A.stang();
      if (IH.guide && IH.guide.peka) IH.guide.peka(k.visa.mal, { sida: k.visa.sida, rubrik: k.visa.rubrik, text: k.visa.text,
        saknas: function () { if (IH.toast) IH.toast('Den syns inte här', 'Det kan bero på sidan eller layouten.', 'info'); } });
    }
  }
  function mobilbredd() { return window.innerWidth <= 640; }

  A.fraga = function (t) {
    if (!oppen) A.oppna();
    meddelande('jag', t);
    sattFigur('tanker');
    var start = performance.now();
    A.svara(t, sammanhang()).then(function (s) {
      setTimeout(function () {
        if (!panel) return;
        s = s || svar('Det vet jag inte.');
        A.senaste = s.senaste || (/^(data|kunskap|form)$/.test(s.kalla || '') || s.visa || s.sida || s.tur || s.rader ? s : A.senaste);
        A.sistaSvar = s;
        meddelande('ia', s);
        sattFigur('svarar');
        clearTimeout(svarTimer); svarTimer = setTimeout(function () { sattFigur('vila'); }, lugn.matches ? 0 : 1700);
        if (s.utfor) setTimeout(function () { utfor(s.utfor); }, lugn.matches ? 150 : 650);
      }, Math.max(0, (lugn.matches ? 0 : 380) - (performance.now() - start)));
    });
  };

  /* --- Figuren: en canvas och en WebGL-kontext för knapp och panel --------------------- */
  function sattFigur(t) { if (figur) figur.satt(t); }
  function laddaFigur() {
    if (figur || figurLaddar || !knapp || installning().lage === 'ikon') return;
    figurLaddar = true;
    import('./assistent3d.js?v=20261112h').then(function (m) {
      figurLaddar = false;
      if (figur || installning().lage === 'ikon') return;
      var c = knapp.querySelector('canvas');
      figur = m.skapa(c, { stilla: stillaNu(), sida: SIDA });
      if (!figur) return; // ingen WebGL: den ritade ikonen står kvar
      knapp.classList.add('ia-knapp--3d');
      if (oppen) figur.aktiv(true);
      granska();
    }).catch(function (e) { figurLaddar = false; console.warn('Assistentens figur', e); });
  }
  // Figuren kliver upp i panelens huvud: bara transform, samma element hela vägen
  function flyttaKnapp() {
    var f = panel && panel.querySelector('.ia-figur');
    if (!oppen || !f) { knapp.style.removeProperty('--ia-x'); knapp.style.removeProperty('--ia-y'); knapp.style.removeProperty('--ia-s'); return; }
    var x = panel.offsetLeft + f.parentNode.offsetLeft + f.offsetLeft + f.offsetWidth / 2, y = panel.offsetTop + f.parentNode.offsetTop + f.offsetTop + f.offsetHeight / 2;
    knapp.style.setProperty('--ia-x', Math.round(x - (knapp.offsetLeft + knapp.offsetWidth / 2)) + 'px');
    knapp.style.setProperty('--ia-y', Math.round(y - (knapp.offsetTop + knapp.offsetHeight / 2)) + 'px');
    knapp.style.setProperty('--ia-s', (f.offsetWidth / knapp.offsetWidth).toFixed(3));
  }

  /* --- Bubblan med förslag: en eller två klickbara rader utifrån sidan och läget -------- */
  function tipsFor(vy) {
    var ut = [], lagg = function (text, fraga) { if (ut.length < 2) ut.push({ text: text, fraga: fraga }); };
    try {
      if (vy === 'forfragningar' || vy === 'oversikt') { if (far('forfragningar')) { var n = V.nyaForfragningar().antal; if (n) lagg(plural(n, 'förfrågan väntar', 'förfrågningar väntar') + ', visa dem', 'nya förfrågningar'); } }
      if (vy === 'att-gora' || vy === 'oversikt') { var s = V.senaUppgifter().antal; if (s) lagg('Du har ' + plural(s, 'försenad uppgift', 'försenade uppgifter'), 'har jag sena uppgifter'); else { var d = V.uppgifter(0).antal; if (d) lagg(plural(d, 'uppgift', 'uppgifter') + ' i dag, visa', 'vilka uppgifter har jag i dag'); } }
      if ((vy === 'offerter' || vy === 'oversikt') && far('offerter')) { var g = V.offerterGarUt().antal; if (g) lagg(plural(g, 'offert går', 'offerter går') + ' ut snart', 'vilka offerter går ut snart'); else if (vy === 'offerter') { var o = V.offerterVantar().antal; if (o) lagg(plural(o, 'offert väntar', 'offerter väntar') + ' på svar', 'vilka offerter väntar på svar'); } }
      if (vy === 'salj' && far('salj')) { var t = V.stillaAffarer().antal; if (t) lagg(plural(t, 'affär står', 'affärer står') + ' still', 'vilka affärer står still'); }
      if (vy === 'produktion' && far('produktion')) { var m = V.nastaMontage(); if (m.antal) lagg('Nästa montage: ' + m.rader[0].titel, 'när är nästa montage'); }
      var mo = V.moten().forsta; if (mo && dagar(mo.tid) <= 1 && vy !== 'installningar') lagg('Möte ' + narText(mo.tid), 'när är nästa möte');
    } catch (e) { /* */ }
    (K.forslag[vy] || []).filter(function (f) { return !sparr(norm(f)); }).forEach(function (f) { if (!ut.length || (ut.length === 1 && ut[0].fraga !== f)) lagg(f, f); });
    return ut.slice(0, 2);
  }
  function planeraTips(ms) { clearTimeout(tipsTimer); tipsTimer = setTimeout(visaTips, ms); }
  // Texten kommer in ord för ord
  function ordFor(t, start) { return t.split(' ').map(function (w, i) { return '<span style="--o:' + (start + i) + '">' + esc(w) + '</span>'; }).join(' '); }
  function visaTips() {
    var vy = sammanhang().vy, nu = Date.now();
    if (!knapp || oppen || bubbla || tipsSedda[vy] || nu - tipsSenast < 45000 || nu < tipsStangd || document.hidden || installning().lage === 'ikon') return;
    if (html.hasAttribute('data-ia-dold') || html.hasAttribute('data-ia-guide') || html.hasAttribute('data-ia-undan') || html.hasAttribute('data-ark-oppen') || html.hasAttribute('data-palett-oppen') || html.hasAttribute('data-konto-oppen') || document.querySelector('.toast, .ihg-meny')) return;
    var l = tipsFor(vy); if (!l.length) return;
    tipsSedda[vy] = 1; tipsSenast = nu;
    bubbla = document.createElement('div');
    bubbla.className = 'ia-bubbla'; bubbla.setAttribute('role', 'status');
    var o = 0;
    bubbla.innerHTML = '<div class="ia-bubbla__rader">' + l.map(function (x, i) { var h = '<button type="button" data-i="' + i + '">' + ordFor(x.text, o) + '</button>'; o += x.text.split(' ').length + 1; return h; }).join('') + '</div>' +
      '<button type="button" class="ia-bubbla__x" aria-label="Stäng förslaget">' + SVG.stang + '</button>';
    bubbla.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.classList.contains('ia-bubbla__x')) { tipsStangd = Date.now() + 600000; dolTips(); return; }
      var t = l[+b.getAttribute('data-i')]; dolTips(); if (t) A.fraga(t.fraga);
    });
    var tid = function () { clearTimeout(bubbla.__t); bubbla.__t = setTimeout(dolTips, 9000); };
    bubbla.addEventListener('pointerenter', function () { clearTimeout(bubbla.__t); });
    bubbla.addEventListener('pointerleave', tid);
    document.body.appendChild(bubbla);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (bubbla) bubbla.classList.add('syns'); }); });
    if (figur) figur.pip(installning().sida === 'vanster' ? 1 : -1);
    tid();
  }
  function dolTips() {
    if (!bubbla) return;
    var b = bubbla; bubbla = null; clearTimeout(b.__t); b.classList.remove('syns'); b.classList.add('ut');
    setTimeout(function () { b.remove(); }, lugn.matches ? 0 : 240);
  }
  // En toast tar plats: bubblan lämnar direkt
  if (IH.toast) { var toast0 = IH.toast; IH.toast = function () { dolTips(); return toast0.apply(this, arguments); }; }

  // Här avgörs allt som syns och ritar: presentation, videomöte, guide, ark och dold flik
  function granska() {
    if (!knapp) return;
    var mote = !!document.querySelector('.mote'), vm = !!document.getElementById('vm');
    var dold = html.hasAttribute('data-presenterar') || mote || vm;
    var guide = !!document.querySelector('.ihg'), undan = !!document.querySelector('.chf:not([data-undan]):not([hidden])');
    html.toggleAttribute('data-ia-dold', dold);
    html.toggleAttribute('data-ia-guide', guide);
    html.toggleAttribute('data-ia-undan', undan && !oppen);
    if (dold && oppen) A.stang();
    var skymd = html.hasAttribute('data-ark-oppen') || html.hasAttribute('data-palett-oppen') || guide || (!oppen && (undan || html.hasAttribute('data-konto-oppen')));
    if (dold || skymd) dolTips();
    if (figur) { if (!document.hidden && !dold && !skymd) figur.start(); else figur.stopp(); }
  }

  /* --- Öppna och stänga ----------------------------------------------------------------- */
  A.oppna = function () {
    if (oppen || html.hasAttribute('data-ia-dold')) return;
    byggPanel();
    dolTips();
    if (kontoId !== jag().id) { kontoId = jag().id; A.senaste = null; halsa(); }
    ritaForslag();
    clearTimeout(stadTimer);
    panel.hidden = false;
    oppen = true;
    knapp.setAttribute('aria-expanded', 'true');
    html.setAttribute('data-ia-oppen', '');
    flyttaKnapp();
    requestAnimationFrame(function () { if (panel) panel.classList.add('syns'); });
    laddaFigur();
    if (figur) figur.aktiv(true);
    granska();
    if (window.innerWidth > 640) setTimeout(function () { try { falt.focus({ preventScroll: true }); } catch (e) { /* */ } }, 60);
    rulla();
  };
  A.stang = function () {
    if (!oppen) return;
    oppen = false;
    knapp.setAttribute('aria-expanded', 'false');
    html.removeAttribute('data-ia-oppen');
    panel.classList.remove('syns');
    flyttaKnapp();
    if (figur) figur.aktiv(false);
    stadTimer = setTimeout(function () { if (panel && !oppen) panel.hidden = true; }, lugn.matches ? 0 : 260);
    granska();
  };
  // Inställningar: Levande, Stilla eller Liten ikon, och vilken sida figuren står på
  A.instHtml = function () {
    var v = installning();
    var val = function (g, k, t) { return '<button type="button" data-g="' + g + '" data-v="' + k + '" aria-pressed="' + (v[g === 'ia-lage' ? 'lage' : 'sida'] === k) + '">' + t + '</button>'; };
    return '<section class="kort inst-assistent" data-in aria-labelledby="inst-ia-rubrik"><header class="kort__huvud"><h2 id="inst-ia-rubrik"><span class="kort__ikon">' + IH.i('blixt') + '</span>Hjälpassistenten</h2></header><div class="kort__kropp">' +
      '<div class="ia-val" role="group" aria-label="Figuren">' + val('ia-lage', 'levande', 'Levande') + val('ia-lage', 'stilla', 'Stilla') + val('ia-lage', 'ikon', 'Liten ikon') + '</div>' +
      '<div class="ia-val" role="group" aria-label="Plats">' + val('ia-sida', 'hoger', 'Till höger') + val('ia-sida', 'vanster', 'Till vänster') + '</div>' +
      '<p class="ia-val__not">Liten ikon stänger av 3D-figuren helt. Sparas för ditt konto.</p></div></section>';
  };
  function sparaVal(n, v) {
    var o = installning(); o[n] = v;
    try { localStorage.setItem(LS + jag().id, JSON.stringify(o)); } catch (e) { /* */ }
    [].forEach.call(document.querySelectorAll('.ia-val [data-g="ia-' + n + '"]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); });
    tillampa();
  }
  if (IH.G) {
    IH.G['ia-lage'] = function (el) { sparaVal('lage', el.getAttribute('data-v')); };
    IH.G['ia-sida'] = function (el) { sparaVal('sida', el.getAttribute('data-v')); };
  }
  A.figurBild = function () { try { return figur && figur.bild ? figur.bild() : null; } catch (e) { return null; } };
  A.vaxla = function () { if (oppen) A.stang(); else A.oppna(); };
  A.oppen = function () { return oppen; };
  A.figur = function () { return figur; };

  // Knappen kommer när CRM:et har ritat sin första vy
  (function koll(n) {
    var vy = document.getElementById('vy');
    if (vy && vy.children.length && IH.jag && IH.db) { bygg(); return; }
    if (n < 200) setTimeout(function () { koll(n + 1); }, 120);
  })(0);
})();
