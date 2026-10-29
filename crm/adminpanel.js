/* Legohus CRM – adminpanelen (#/admin), samma upplägg som Uperformance CRM:s visaAdmin.
   Hjälten "Kontrollrummet för CRM:et" med fyra tal, sedan 01 Konton och roller (filter, sök, ändra, logga in som,
   inaktivera), 02 Bör åtgärdas, 03 Behörigheter, 04 Inställningar, 05 Data och system (export, import, återställ)
   och 06 Granskningsloggen med filter. Ändringar på konton sparas i den här webbläsaren (demo). */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i, ik = function (n) { return IH.emo(n); };
  var db = function () { return IH.db; };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };
  var INST = 'ih-crm-admin';
  var inst = function () { try { return JSON.parse(localStorage.getItem(INST)) || {}; } catch (x) { return {}; } };
  var sparaInst = function (k, v) { var o = inst(); o[k] = v; try { localStorage.setItem(INST, JSON.stringify(o)); } catch (x) { /* privat läge */ } };
  var logg = function (typ, text) { if (IH.sakLogg) IH.sakLogg(typ, text); };
  var ui = { filter: 'alla', logg: 'alla', loggN: 10 };

  /* Kontoändringar (titel, mål, chef, inaktiverat) läggs ovanpå exempelkontona */
  function tillampa() {
    var a = inst().konton || {};
    IH.ANVANDARE.forEach(function (u) {
      if (!u.grundTitel) u.grundTitel = u.titel || ROLLNAMN[u.roll] || '';
      var x = a[u.id]; if (!x) return;
      if ('titel' in x) u.titel = x.titel || u.grundTitel;
      if ('mal' in x) u.mal = x.mal || undefined;
      if ('chef' in x) u.chef = x.chef || undefined;
      ['epost', 'tel', 'om', 'bild', 'start'].forEach(function (f) { if (f in x) u[f] = x[f] || undefined; });
      u.inaktiv = !!x.inaktiv;
    });
  }
  function andra(id, falt) { var a = inst().konton || {}; a[id] = Object.assign(a[id] || {}, falt); sparaInst('konton', a); tillampa(); }
  var ROLLNAMN = { salj: 'Sälj', prod: 'Produktion', admin: 'Admin' };
  tillampa();
  // Ett inaktiverat konto loggas ut direkt (även om det loggades in innan det inaktiverades)
  if (IH.riktigJag().inaktiv) { try { localStorage.removeItem('ih-crm-inloggad'); } catch (x) { /* privat läge */ } location.replace('logga-in.html?inaktiv=1'); }
  IH.andraKonto = andra;
  IH.arAktivt = function (u) { return !!u && !u.inaktiv; };
  var valjForra = IH.G['valj-anvandare'];
  IH.G['valj-anvandare'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id'));
    if (u && u.inaktiv) { IH.toast(u.namn + ' är inaktiverat', 'Aktivera kontot i adminpanelen först.', 'las'); return; }
    valjForra(el);
  };

  var roller = function (u) { return [ROLLNAMN[u.roll] || u.roll].concat(u.chef ? ['Chef'] : []); };
  function senastAktiv(u) {
    if (!u.inaktiv && IH.aktivNu && IH.aktivNu(u.id)) return 'Aktiv nu';
    var t = db().aktiviteter.filter(function (h) { return h.av === u.id && !h.stod && new Date(h.tid) <= new Date(); }).concat((db().sakerhet || []).filter(function (h) { return h.av === u.id; }))
      .map(function (h) { return h.tid; }).sort().pop();
    return t ? IH.sedan(t) : 'Aldrig';
  }
  var lagring = function () { var b = 0; try { for (var n = 0; n < localStorage.length; n++) { var k = localStorage.key(n); if (/^ih-/.test(k)) b += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (x) { /* */ } return b; };
  var kb = function (b) { return b >= 1048576 ? (b / 1048576).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' MB' : Math.round(b / 1024) + ' kB'; };
  var SAML = [['Kunder', 'kunder'], ['Förfrågningar', 'forfragningar'], ['Affärer', 'affarer'], ['Offerter', 'offerter'], ['Projekt', 'projekt'], ['Aktiviteter', 'aktiviteter'], ['Uppgifter', 'uppgifter'], ['Dokument', 'dokument'], ['Frånvaro', 'franvaro']];
  var band = function (nr, rubrik, em, inne, opts) {
    opts = opts || {};
    return '<section class="ao-band kort' + (opts.klass ? ' ' + opts.klass : '') + '"><header class="ao-band__huvud"><div><p class="ao-ogon">' + nr + '</p><h2>' + rubrik + ' <em>' + em + '</em></h2>' + (opts.ingress ? '<p class="ao-band__ingress">' + opts.ingress + '</p>' : '') + '</div>' + (opts.hoger || '') + '</header>' + inne + '</section>';
  };
  var filterKnapp = function (g, id, namn, vald) { return '<button type="button" class="ap-filter" data-g="' + g + '" data-f="' + id + '" aria-pressed="' + (vald === id) + '">' + namn + '</button>'; };

  IH.vyer.admin = function () {
    if (IH.jag().roll !== 'admin') return { titel: 'Admin', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + ik('las') + 'Bara för administratören</h2><p class="ad-not">' + (IH.visarSom && IH.visarSom() ? 'Du är i supportläget – tryck Tillbaka till Admin i bandet överst' : 'Byt till kontot Admin i kontomenyn') + ' för att se den här sidan.</p></section>' };
    var d = db(), alla = IH.ANVANDARE, aktiva = alla.filter(IH.arAktivt), mig = IH.jag();
    var nu = aktiva.filter(function (u) { return senastAktiv(u) === 'Aktiv nu'; }).length;
    var poster = SAML.reduce(function (t, s) { return t + (d[s[1]] || []).length; }, 0);
    var sakP = IH.sakHub ? IH.sakHub.total() : null, hist = IH.sakHub ? IH.sakHub.hub().historik[0] : null;
    var tal = function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + x.ton + '"><span class="ao-tal__ikon">' + ik(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(String(x.varde)) + '</strong><em>' + e(x.under) + '</em></span></' + (x.href ? 'a' : 'div') + '>'; };
    var hjalte = '<section class="ap-hjalte ao-hjalte kort"><div class="sh-rutnat" aria-hidden="true"></div>' +
      '<div class="ao-text"><p class="etikett"><i class="sh-live"></i>Administration · demoläget</p><h1>Kontrollrummet <em>för CRM:et.</em></h1>' +
        '<p class="ao-ingress">Konton och roller, behörigheter, data och system, loggen och säkerheten – och förslag på det som bör åtgärdas.</p>' +
        '<div class="sh-knappar"><button type="button" class="sh-knapp sh-knapp--accent" data-g="km-nytt-konto">' + ik('anvandare-plus') + '<span>Lägg till konto</span></button>' +
          '<a class="sh-knapp" href="#/sakerhet">' + ik('radar') + '<span>Säkerhetshubben</span></a>' +
          '<button type="button" class="sh-knapp" data-g="ad-exportera">' + ik('ladda-ner') + '<span>Exportera data</span></button></div></div>' +
      '<div class="ap-tal">' + [
        { ikon: 'anstallda', etikett: 'Konton', varde: aktiva.length, under: (alla.length - aktiva.length ? plural(alla.length - aktiva.length, 'inaktiverat', 'inaktiverade') + ' · ' : '') + nu + ' aktiva nu', ton: 'is' },
        { ikon: 'databas', etikett: 'Poster i CRM:et', varde: poster.toLocaleString('sv-SE'), under: kb(lagring()) + ' i webbläsaren', ton: 'lila' },
        { ikon: 'puls', etikett: 'Händelser 7 dagar', varde: d.aktiviteter.filter(function (x) { return IH.dagarSedan(x.tid) < 7; }).length, under: 'i tidslinjerna', ton: 'is' },
        { ikon: 'skold', etikett: 'Säkerhetspoäng', varde: sakP == null ? 'Ej skannat' : sakP + ' / 100', under: hist ? 'skannat ' + IH.sedan(hist.tid) : 'kör en skanning', ton: sakP == null ? 'is' : sakP >= 85 ? 'gron' : sakP >= 60 ? 'gul' : 'rod', href: '#/sakerhet' }
      ].map(tal).join('') + '</div></section>';

    // 01 Konton och roller
    var admins = aktiva.filter(function (u) { return u.roll === 'admin'; });
    var visa = alla.filter(function (u) { return ui.filter === 'alla' ? true : ui.filter === 'inaktiva' ? u.inaktiv : ui.filter === 'ledning' ? (u.chef || u.roll === 'admin') : u.roll === ui.filter; });
    var rader = visa.map(function (u) {
      var n = IH.narvaro ? IH.narvaro(u.id) : { farg: '#ccc', namn: '' }, sista = u.roll === 'admin' && admins.length <= 1 && !u.inaktiv;
      return '<div class="ap-rad' + (u.inaktiv ? ' ap-inaktiv' : '') + '" role="row" data-sok="' + e((u.namn + ' ' + u.titel).toLowerCase()) + '">' +
        '<a class="ap-vem" role="cell" href="#/profil/' + u.id + '"><span class="avatar" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><span><strong>' + e(u.namn) + (u.id === mig.id ? ' <small class="ap-du">du</small>' : '') + '</strong><small>' + e(u.titel) + (u.egen ? ' · eget konto' : '') + '</small></span></a>' +
        '<span role="cell" class="ap-roller">' + roller(u).map(function (r) { return '<span class="ap-roll" data-roll="' + r + '">' + r + '</span>'; }).join('') + '</span>' +
        '<span role="cell"><span class="lp-status" style="--n:' + (u.inaktiv ? '#b9b2a6' : n.farg) + '"><i></i>' + e(u.inaktiv ? 'Inaktiverat' : n.namn) + '</span></span>' +
        '<span role="cell" class="ap-senast">' + e(senastAktiv(u)) + '</span>' +
        '<span role="cell" class="ap-atgarder"><button type="button" class="knapp knapp--liten" data-g="ap-andra" data-id="' + u.id + '" title="Ändra ' + e(u.namn) + '">' + ik('redigera') + '<span class="ap-knapptext">Ändra</span></button>' +
          (u.id !== mig.id && !u.inaktiv && u.roll !== 'admin' ? '<button type="button" class="knapp knapp--liten ap-ikonknapp" data-g="valj-anvandare" data-id="' + u.id + '" title="Logga in som ' + e(u.namn) + '">' + ik('logga-ut') + '</button>' : '<span class="ap-plats"></span>') +
          (u.id !== mig.id ? '<button type="button" class="knapp knapp--liten" data-g="ap-aktiv" data-id="' + u.id + '"' + (sista ? ' disabled title="Det måste finnas minst en aktiv administratör"' : '') + '>' + ik(u.inaktiv ? 'bock' : 'las') + '<span class="ap-knapptext">' + (u.inaktiv ? 'Aktivera' : 'Inaktivera') + '</span></button>' : '<span class="ap-plats ap-plats--bred"></span>') +
        '</span></div>';
    }).join('');
    var konton = band('01 · Konton', 'Konton', 'och roller',
      '<div class="ap-tabell" role="table" aria-label="Konton"><div class="ap-rad ap-rad--huvud" role="row"><span role="columnheader">Konto</span><span role="columnheader">Roller</span><span role="columnheader">Status</span><span role="columnheader">Senast aktiv</span><span role="columnheader"></span></div>' +
        (rader || '<p class="ad-not ap-tom">Inga konton med det filtret.</p>') + '</div>',
      { ingress: 'Vem som finns i CRM:et, vilka roller de har, deras status och när de senast var aktiva.',
        hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + [['alla', 'Alla'], ['salj', 'Sälj'], ['prod', 'Produktion'], ['ledning', 'Ledning'], ['inaktiva', 'Inaktiverade']].map(function (f) { return filterKnapp('ap-filter', f[0], f[1], ui.filter); }).join('') +
          '<input class="ap-sok" type="search" placeholder="Sök konto …" data-ap-sok aria-label="Sök konto"></div>' });

    // 02 Förslag
    var forslag = IH.adminForslag ? IH.adminForslag() : [];
    var SNABB = [['km-nytt-konto', 'anvandare-plus', 'Lägg till konto'], ['sh-skanna-ga', 'radar', 'Skanna nu'], ['ad-exportera', 'ladda-ner', 'Exportera data'], ['kc-csv', 'anstallda', 'Kontolista (CSV)']];
    var forslagBand = band('02 · Förslag', 'Bör', 'åtgärdas',
      forslag.length ? '<ul class="ao-upp ap-upp">' + forslag.map(function (x) {
        return '<li><span class="ao-upp__ikon">' + ik(x.ikon) + '</span><span class="ao-upp__text"><strong>' + e(x.text) + '</strong><small>' + e(x.under || '') + '</small></span>' +
          (x.lank ? '<a class="knapp knapp--liten" href="' + x.lank + '">' + x.knapp + '</a>' : '<button type="button" class="knapp knapp--liten" data-g="' + x.g + '"' + (x.data ? ' data-ids="' + x.data + '"' : '') + '>' + x.knapp + '</button>') + '</li>';
      }).join('') + '</ul>' : '<div class="ao-lugnt ao-lugnt--stor">' + ik('skold') + '<div><strong>Inget att åtgärda</strong><small>Profiler, mål, ansvariga och säkerheten ser bra ut.</small></div></div>',
      { hoger: '<div class="ap-snabb">' + SNABB.map(function (x) { return '<button type="button" class="knapp knapp--liten" data-g="' + x[0] + '">' + ik(x[1]) + x[2] + '</button>'; }).join('') + '</div>' });

    // 03 Behörigheter (så som menyn, rollspärren i app.js och knapparna faktiskt fungerar). Admin når säljsidorna i supportläget.
    var RATT = [['Förfrågningar, säljtavlan och kundmötet', ['ja', 'ja', 'nej', 'nej']], ['Kunder, offerter och dokument', ['ja', 'ja', 'ja', 'nej']], ['Projekt och montage', ['ja', 'ja', 'ja', 'nej']],
      ['Säljarnas sidor i supportläget', ['nej', 'nej', 'nej', 'ja']], ['Meddelanden och Att göra', ['ja', 'ja', 'ja', 'ja']], ['Försäljningsledningen', ['nej', 'ja', 'nej', 'nej']],
      ['Sätta säljmål', ['nej', 'ja', 'nej', 'ja']], ['Lägga till konton', ['nej', 'ja', 'nej', 'ja']],
      ['Kontrollcentral, admin och säkerhet', ['nej', 'nej', 'nej', 'ja']], ['Exportera, importera och återställa all data', ['nej', 'nej', 'nej', 'ja']]];
    var behorig = band('03 · Behörigheter', 'Vem får', 'göra vad',
      '<div class="ap-matris" role="table"><div class="ap-matris__rad ap-matris__huvud" role="row"><span></span>' + ['Sälj', 'Chef', 'Prod', 'Admin'].map(function (k) { return '<span role="columnheader">' + k + '</span>'; }).join('') + '</div>' +
        RATT.map(function (r) { return '<div class="ap-matris__rad" role="row"><span role="rowheader">' + e(r[0]) + '</span>' + r[1].map(function (x) { return '<span role="cell" data-ratt="' + x + '">' + (x === 'ja' ? ik('bock') : '<i>–</i>') + '</span>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<p class="ad-not">Alla säljare ser och ändrar teamets affärer och kunder – det finns inga egna, låsta affärer. Demoläget: rollerna styr menyn och sidorna i webbläsaren. Skarpt ska servern kontrollera varje ändring.</p>', { klass: 'ap-halv' });

    // 04 Inställningar
    var utlogg = +inst().utlogg || 0, kopia = inst().kopia;
    var installningar = band('04 · Inställningar', 'För den här', 'webbläsaren',
      '<div class="ap-inst"><div><strong>Logga ut vid inaktivitet</strong><small>Utloggning efter så här lång tid utan klick eller tangenttryck. En minut före visas en nedräkning.</small></div>' +
        '<select class="ap-select" data-ap-inst="utlogg" aria-label="Logga ut vid inaktivitet">' + [[0, 'Aldrig'], [15, '15 minuter'], [30, '30 minuter'], [60, 'En timme']].map(function (o) { return '<option value="' + o[0] + '"' + (utlogg === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="ap-inst"><div><strong>Säkerhetskopia</strong><small>' + (kopia ? 'Senast exporterad ' + IH.sedan(kopia) + '.' : 'Ingen export gjord än.') + ' Förslagen påminner när den är äldre än en vecka.</small></div>' +
        '<button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera nu</button></div>' +
      '<div class="ap-inst"><div><strong>Systemrapport</strong><small>Konton, poster, säkerhetspoäng och inställningar som text – kopieras för att klistra in i ett mejl.</small></div>' +
        '<button type="button" class="knapp knapp--liten" data-g="kc-rapport">' + ik('dokument') + 'Kopiera</button></div>', { klass: 'ap-halv' });

    // 05 Data och system
    var max = Math.max.apply(null, SAML.map(function (s) { return (d[s[1]] || []).length; }).concat([1]));
    var app = document.querySelector('script[src*="app.js"]'), version = ((app && app.getAttribute('src')) || '').split('?v=')[1] || '–';
    var system = band('05 · System', 'Data', 'och system',
      '<ul class="ap-data">' + SAML.map(function (s) { var n = (d[s[1]] || []).length; return '<li><span>' + s[0] + '</span><span class="ap-stapel" style="--andel:' + (n / max).toFixed(3) + '"><i></i></span><strong>' + n.toLocaleString('sv-SE') + '</strong></li>'; }).join('') + '</ul>' +
      '<dl class="ap-fakta"><div><dt>Läge</dt><dd>Demo – allt i den här webbläsaren</dd></div><div><dt>Version</dt><dd>v' + e(version) + ' · data ' + (IH.VERSION || '–') + '</dd></div><div><dt>Lagring</dt><dd>' + kb(lagring()) + ' av ca 5 MB</dd></div></dl>' +
      '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera (JSON)</button>' +
        '<label class="knapp knapp--liten">' + ik('uppladdning') + 'Importera<input type="file" accept="application/json,.json" data-ap-import hidden></label>' +
        '<button type="button" class="knapp knapp--liten knapp--fara" data-g="ad-aterstall">' + i('aterstall') + 'Återställ exempeldata</button></div>', { klass: 'ap-halv' });

    // 06 Granskningsloggen
    var typFor = function (t) { return t === 'konto' || t === 'support' ? t : 'sakerhet'; };
    var alltLogg = d.aktiviteter.map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: 'crm' }; })
      .concat((d.sakerhet || []).map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: typFor(x.typ) }; }))
      .filter(function (x) { return x.tid && (ui.logg === 'alla' || x.typ === ui.logg); }).sort(function (a, b) { return a.tid < b.tid ? 1 : -1; });
    var TYPNAMN = { crm: 'CRM', konto: 'Konto', support: 'Support', sakerhet: 'Säkerhet' };
    var loggBand = band('06 · Logg', 'Granskning', 'och ändringar',
      (alltLogg.length ? '<ul class="ao-flode ap-logg">' + alltLogg.slice(0, ui.loggN).map(function (x) { var u = IH.anvandare(x.av) || { namn: '?', farg: '#ccc' }, t = String(x.text || '');
        return '<li data-typ="' + x.typ + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><span>' + e(t.slice(0, 110)) + (t.length > 110 ? '…' : '') + '<small><b class="ap-typ" data-typ="' + x.typ + '">' + TYPNAMN[x.typ] + '</b>' + e(u.namn) + ' · ' + IH.sedan(x.tid) + '</small></span></li>'; }).join('') + '</ul>' : '<p class="ad-not">Inget i loggen med det filtret.</p>') +
      (alltLogg.length > ui.loggN ? '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ap-logg-fler">Visa fler (' + (alltLogg.length - ui.loggN) + ' till)</button></div>' : ''),
      { klass: 'ap-halv', hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + [['alla', 'Allt'], ['crm', 'CRM'], ['konto', 'Konton'], ['support', 'Support'], ['sakerhet', 'Säkerhet']].map(function (f) { return filterKnapp('ap-logg', f[0], f[1], ui.logg); }).join('') + '</div>' });

    return { titel: 'Admin', html: hjalte + konton + forslagBand + '<div class="ao-tva">' + behorig + installningar + '</div><div class="ao-tva">' + system + loggBand + '</div>' };
  };

  /* Händelserna ---------------------------------------------------------------------------------- */
  var G = IH.G;
  G['ap-filter'] = function (el) { ui.filter = el.getAttribute('data-f'); IH.rita(); };
  G['ap-logg'] = function (el) { ui.logg = el.getAttribute('data-f'); ui.loggN = 10; IH.rita(); };
  G['ap-logg-fler'] = function () { ui.loggN += 15; IH.rita(); };
  G['ap-aktiv'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u || u.id === IH.jag().id) return;
    var av = !u.inaktiv;
    if (av && u.roll === 'admin' && IH.ANVANDARE.filter(function (x) { return x.roll === 'admin' && !x.inaktiv; }).length <= 1) return;
    andra(u.id, { inaktiv: av });
    logg('konto', (av ? 'Inaktiverade ' : 'Aktiverade ') + u.namn + '.');
    IH.uppdateraMeny(); IH.rita();
    IH.toast(av ? u.namn + ' är inaktiverat' : u.namn + ' är aktivt igen', av ? 'Kontot kan inte loggas in på förrän det aktiveras.' : null, av ? 'las' : 'bock');
  };
  G['ap-andra'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    IH.oppnaArk({ titel: 'Ändra ' + u.namn, under: 'Sparas i den här webbläsaren (demo).', ikon: 'redigera',
      kropp: '<form id="ap-andra-form" data-ap-andra="' + u.id + '" class="km-form"><label class="falt"><span>Titel</span><input name="titel" required maxlength="60" value="' + e(u.titel) + '"></label>' +
        (u.roll === 'salj' ? '<label class="km-kryss"><input type="checkbox" name="chef"' + (u.chef ? ' checked' : '') + '> Försäljningschef (ser försäljningsledningen)</label>' +
          '<label class="falt"><span>Årets mål i kronor</span><input name="mal" type="number" min="0" step="any" data-steg="50000" value="' + (u.mal || '') + '" placeholder="T.ex. 800000"></label>' : '') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ap-andra-form">' + i('bock') + 'Spara</button>' });
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ap-andra]')) return;
    ev.preventDefault();
    var u = IH.anvandare(t.getAttribute('data-ap-andra')); if (!u) return;
    var falt = { titel: t.titel.value.trim() || u.titel }, vad = [];
    if (t.chef) {
      falt.chef = t.chef.checked;
      // Grundtiteln (Sälj / Sälj · Försäljningschef) följer chefsrollen; en egen titel lämnas som den är
      if (falt.chef !== !!u.chef && /^Sälj( · Försäljningschef)?$/.test(falt.titel)) falt.titel = falt.chef ? 'Sälj · Försäljningschef' : 'Sälj';
      if (falt.chef !== !!u.chef) vad.push(falt.chef ? 'blev försäljningschef' : 'är inte längre försäljningschef');
    }
    if (t.mal) { falt.mal = Math.max(0, Math.round(+t.mal.value || 0)) || 0; if (falt.mal !== (u.mal || 0)) vad.push(falt.mal ? 'mål ' + IH.kort(falt.mal) : 'inget mål'); }
    if (falt.titel !== u.titel) vad.unshift('titel ' + falt.titel);
    IH.stangArk();
    if (!vad.length) { IH.toast('Inget att spara', 'Inget var ändrat.', 'bock'); return; }
    andra(u.id, falt);
    logg('konto', 'Ändrade ' + u.namn + ': ' + vad.join(', ') + '.');
    IH.uppdateraMeny(); IH.rita();
    IH.toast('Sparat', u.namn + ' · ' + u.titel, 'bock');
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ap-sok]')) return;
    var q = t.value.trim().toLowerCase();
    document.querySelectorAll('.ap-rad[data-sok]').forEach(function (r) { r.hidden = !!q && r.getAttribute('data-sok').indexOf(q) < 0; });
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.matches) return;
    if (t.matches('[data-ap-inst="utlogg"]')) {
      var v = +t.value; sparaInst('utlogg', v);
      logg('installning', 'Utloggning vid inaktivitet: ' + (v ? v + ' min' : 'av') + '.');
      IH.toast('Sparat', v ? 'Utloggning efter ' + v + ' min utan aktivitet.' : 'Utloggning vid inaktivitet är av.', 'bock');
    }
    if (t.matches('[data-ap-import]') && t.files && t.files[0]) {
      var fil = t.files[0], r = new FileReader();
      if (fil.size > 5 * 1048576) { IH.toast('Filen är för stor', 'Högst 5 MB.', 'varning'); return; }
      r.onload = function () {
        var ny; try { ny = JSON.parse(r.result); } catch (x) { ny = null; }
        var fel = granskaImport(ny);
        if (fel) { IH.toast('Kunde inte läsa filen', fel, 'varning'); return; }
        var aldre = ny.version !== IH.VERSION;
        vantar = ny;
        IH.oppnaArk({ titel: 'Importera data', under: e(fil.name), ikon: 'uppladdning',
          kropp: '<p class="ad-not">Filen innehåller ' + ny.kunder.length + ' kunder, ' + ny.affarer.length + ' affärer och ' + ny.projekt.length + ' projekt. All nuvarande data i den här webbläsaren ersätts – säkerhetsloggen och skanningarna behålls. Exportera först om du vill kunna gå tillbaka.</p>' +
            (aldre ? '<p class="ad-not">Filen är från dataversion ' + e(String(ny.version)) + ' och uppgraderas till version ' + IH.VERSION + '. Det som saknas (prislistan och löpnumren) fylls i.</p>' : ''),
          fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="button" data-g="ap-import-ok">' + ik('uppladdning') + 'Ersätt datan</button>' });
      };
      r.readAsText(fil); t.value = '';
    }
  });
  var vantar = null;
  // Kontrollerar att filen är en export från CRM:et som går att använda. Ger felet som text, eller null.
  var KRAV = ['kunder', 'affarer', 'aktiviteter', 'uppgifter', 'projekt', 'offerter', 'forfragningar'];
  function granskaImport(ny) {
    if (!ny || typeof ny !== 'object' || Array.isArray(ny)) return 'Det ser inte ut som en export från Legohus CRM.';
    var saknas = KRAV.filter(function (k) { return !Array.isArray(ny[k]); });
    if (saknas.length) return 'Det ser inte ut som en export från Legohus CRM (saknar ' + saknas.join(', ') + ').';
    if (typeof ny.version !== 'number' || ny.version < 1) return 'Filen saknar dataversion – den kommer inte från en export.';
    if (ny.version > IH.VERSION) return 'Filen är från en nyare version (' + ny.version + ') av CRM:et än den här (' + IH.VERSION + ').';
    var trasig = KRAV.filter(function (k) { return ny[k].some(function (x) { return !x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id; }); });
    if (trasig.length) return 'Poster utan id i ' + trasig.join(', ') + '.';
    if (ny.kunder.some(function (k) { return typeof k.namn !== 'string' || !k.namn.trim(); })) return 'Det finns kunder utan namn i filen.';
    if (ny.affarer.some(function (a) { return typeof a.varde !== 'number' || !isFinite(a.varde); })) return 'Det finns affärer utan giltigt värde i filen.';
    if (ny.prislista && (typeof ny.prislista !== 'object' || typeof ny.prislista.modeller !== 'object' || !Array.isArray(ny.prislista.poster))) return 'Prislistan i filen är trasig.';
    return null;
  }
  // Fyller det som saknas så att datan inte byts ut mot exempeldatan vid nästa laddning (app.js jämför versionen)
  function uppgradera(ny) {
    ny.version = IH.VERSION;
    if (!ny.prislista) ny.prislista = JSON.parse(JSON.stringify(IH.PRISLISTA_START));
    var lopnr = ny.lopnr && typeof ny.lopnr === 'object' ? ny.lopnr : {};
    var hogst = function (lista) { return (lista || []).reduce(function (m, x) { var n = parseInt(String(x.id).replace(/^\D+/, ''), 10); return isFinite(n) && n > m ? n : m; }, 0); };
    [['kund', 'kunder'], ['affar', 'affarer'], ['forfragan', 'forfragningar'], ['aktivitet', 'aktiviteter'], ['uppgift', 'uppgifter'], ['projekt', 'projekt'], ['offert', 'offerter'], ['dokument', 'dokument']].forEach(function (t) {
      lopnr[t[0]] = Math.max(+lopnr[t[0]] || 0, hogst(ny[t[1]]));
    });
    ny.lopnr = lopnr;
    return ny;
  }
  G['ap-import-ok'] = function () {
    if (!vantar) return;
    var logg0 = (db().sakerhet || []).slice(), hub0 = db().sakHub, fran = vantar.version;
    IH.db = uppgradera(vantar); IH.db.sakerhet = logg0; if (hub0) IH.db.sakHub = hub0; vantar = null;
    IH.spara();
    logg('import', 'Data importerad: ' + IH.db.kunder.length + ' kunder, ' + IH.db.affarer.length + ' affärer' + (fran !== IH.VERSION ? ' (uppgraderad från dataversion ' + fran + ')' : '') + '.');
    IH.stangArk(); IH.uppdateraMeny(); IH.rita();
    IH.toast('Datan är importerad', null, 'uppladdning');
  };
})();
