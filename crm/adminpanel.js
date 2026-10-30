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
  var ui = { filter: 'alla', logg: 'alla', loggN: 7 };

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
      if (u.bild && !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u.bild)) u.bild = undefined;
      u.inaktiv = !!x.inaktiv;
    });
  }
  function andra(id, falt) { var a = inst().konton || {}; a[id] = Object.assign(a[id] || {}, falt); sparaInst('konton', a); tillampa(); }
  var ROLLNAMN = { salj: 'Sälj', prod: 'Produktion', admin: 'Admin' };
  tillampa();
  // Ett inaktiverat konto loggas ut direkt (även om det loggades in innan det inaktiverades)
  if (IH.riktigJag().inaktiv) { try { localStorage.removeItem('ih-crm-inloggad'); } catch (x) { /* privat läge */ } location.replace('logga-in.html?inaktiv=1'); }
  IH.andraKonto = andra;
  // Kontoändringar (mål, chefsroll, inaktiverat) från en annan flik läses in här också
  window.addEventListener('storage', function (e) {
    if (e.key !== INST) return;
    tillampa(); if (IH.uppdateraMeny) IH.uppdateraMeny(); IH.rita();
  });
  IH.arAktivt = function (u) { return !!u && !u.inaktiv; };
  var valjForra = IH.G['valj-anvandare'];
  IH.G['valj-anvandare'] = function (el) {
    var u = IH.anvandare(el.getAttribute('data-id'));
    if (u && u.inaktiv) { IH.toast('Kontot för ' + u.namn + ' är inaktiverat', 'Aktivera kontot i adminpanelen först.', 'las'); return; }
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
  var kb = function (b) { return b >= 1048576 ? (b / 1048576).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; };
  var SAML = [['Kunder', 'kunder'], ['Förfrågningar', 'forfragningar'], ['Affärer', 'affarer'], ['Offerter', 'offerter'], ['Projekt', 'projekt'], ['Händelser', 'aktiviteter'], ['Uppgifter', 'uppgifter'], ['Dokument', 'dokument'], ['Frånvaro', 'franvaro']];
  var band = function (nr, rubrik, em, inne, opts) {
    opts = opts || {};
    return '<section class="ao-band kort' + (opts.klass ? ' ' + opts.klass : '') + '"><header class="ao-band__huvud"><div><p class="ao-ogon">' + nr + '</p><h2>' + rubrik + ' <em>' + em + '</em></h2>' + (opts.ingress ? '<p class="ao-band__ingress">' + opts.ingress + '</p>' : '') + '</div>' + (opts.hoger || '') + '</header>' + inne + '</section>';
  };
  var filterKnapp = function (g, id, namn, vald) { return '<button type="button" class="ap-filter" data-g="' + g + '" data-f="' + id + '" aria-pressed="' + (vald === id) + '">' + namn + '</button>'; };

  IH.vyer.admin = function () {
    if (IH.jag().roll !== 'admin') return { titel: 'Adminpanelen', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + ik('las') + 'Bara för administratören</h2><p class="ad-not">' + (IH.visarSom && IH.visarSom() ? 'Du är i supportläget – klicka på Tillbaka till Admin i bandet överst' : 'Byt till kontot Admin i kontomenyn') + ' för att se den här sidan.</p></section>' };
    var d = db(), alla = IH.ANVANDARE, aktiva = alla.filter(IH.arAktivt), mig = IH.jag();
    var nu = aktiva.filter(function (u) { return senastAktiv(u) === 'Aktiv nu'; }).length;
    var poster = SAML.reduce(function (t, s) { return t + (d[s[1]] || []).length; }, 0);
    var sakP = IH.sakHub ? IH.sakHub.total() : null, hist = IH.sakHub ? IH.sakHub.hub().historik[0] : null;
    var tal = function (x) { return '<' + (x.href ? 'a href="' + x.href + '"' : 'div') + ' class="ao-tal" data-ton="' + x.ton + '"><span class="ao-tal__ikon">' + ik(x.ikon) + '</span><span class="ao-tal__text"><small>' + x.etikett + '</small><strong>' + e(String(x.varde)) + '</strong><em>' + e(x.under) + '</em></span></' + (x.href ? 'a' : 'div') + '>'; };
    var hjalte = '<section class="ap-hjalte ao-hjalte kort"><div class="sh-rutnat" aria-hidden="true"></div>' +
      '<div class="ao-text"><p class="etikett"><i class="sh-live"></i>Administration · prototyp</p><h1>Kontrollrummet <em>för CRM:et.</em></h1>' +
        '<p class="ao-ingress">Konton och roller, behörigheter, data och system, loggen och säkerheten – och förslag på det som bör åtgärdas.</p>' +
        '<div class="sh-knappar"><button type="button" class="sh-knapp sh-knapp--accent" data-g="km-nytt-konto">' + ik('anvandare-plus') + '<span>Nytt konto</span></button>' +
          '<a class="sh-knapp" href="#/sakerhet">' + ik('skold') + '<span>Säkerhetshubben</span></a>' +
          '<button type="button" class="sh-knapp" data-g="ad-exportera">' + ik('ladda-ner') + '<span>Exportera data</span></button></div></div>' +
      '<div class="ap-tal">' + [
        { ikon: 'anstallda', etikett: 'Konton', varde: aktiva.length, under: (alla.length - aktiva.length ? plural(alla.length - aktiva.length, 'inaktiverat', 'inaktiverade') + ' · ' : '') + nu + ' aktiva nu', ton: 'is' },
        { ikon: 'databas', etikett: 'Poster i CRM:et', varde: poster.toLocaleString('sv-SE'), under: kb(lagring()) + ' i webbläsaren', ton: 'lila' },
        { ikon: 'puls', etikett: 'Händelser 7 dagar', varde: d.aktiviteter.filter(function (x) { return IH.dagarSedan(x.tid) < 7; }).length, under: 'i tidslinjerna', ton: 'is' },
        { ikon: 'skold', etikett: 'Säkerhetspoäng', varde: sakP == null ? 'Inte skannat' : sakP + '/100', under: hist ? 'skannat ' + IH.sedan(hist.tid) : 'kör en skanning', ton: sakP == null ? 'is' : sakP >= 85 ? 'gron' : sakP >= 60 ? 'gul' : 'rod', href: '#/sakerhet' }
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
          (u.id !== mig.id && !u.inaktiv && u.roll !== 'admin' ? '<button type="button" class="knapp knapp--liten ap-visasom" data-g="valj-anvandare" data-id="' + u.id + '" title="Visa CRM:et som ' + e(u.namn) + '" aria-label="Visa som ' + e(u.namn) + '">' + i('ogon') + '<span class="ap-knapptext">Visa som</span></button>' : '<span class="ap-plats"></span>') +
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
    var SNABB = [['km-nytt-konto', 'anvandare-plus', 'Nytt konto'], ['sh-skanna-ga', 'radar', 'Skanna nu'], ['ad-exportera', 'ladda-ner', 'Exportera data'], ['kc-csv', 'anstallda', 'Kontolista (CSV)']];
    var forslagBand = band('02 · Förslag', 'Bör', 'åtgärdas',
      forslag.length ? '<ul class="ao-upp ap-upp">' + forslag.slice(0, 4).map(function (x) {
        return '<li><span class="ao-upp__ikon">' + ik(x.ikon) + '</span><span class="ao-upp__text"><strong>' + e(x.text) + '</strong><small>' + e(x.under || '') + '</small></span>' +
          (x.lank ? '<a class="knapp knapp--liten" href="' + x.lank + '">' + x.knapp + '</a>' : '<button type="button" class="knapp knapp--liten" data-g="' + x.g + '"' + (x.data ? ' data-ids="' + x.data + '"' : '') + '>' + x.knapp + '</button>') + '</li>';
      }).join('') + '</ul>' + (forslag.length > 4 ? '<a class="ap-alla" href="#/kontroll">Alla ' + forslag.length + ' förslag i Kontrollcentralen' + i('pil') + '</a>' : '') : '<div class="ao-lugnt ao-lugnt--stor">' + ik('skold') + '<div><strong>Inget att åtgärda</strong><small>Profiler, mål, ansvariga och säkerheten ser bra ut.</small></div></div>',
      { hoger: '<div class="ap-snabb">' + SNABB.map(function (x) { return '<button type="button" class="knapp knapp--liten" data-g="' + x[0] + '">' + ik(x[1]) + x[2] + '</button>'; }).join('') + '</div>' });

    // 03 Behörigheter (så som menyn, rollspärren i app.js och knapparna faktiskt fungerar). Admin når säljsidorna i supportläget.
    var RATT = [['Förfrågningar, säljtavlan och kundmötet', ['ja', 'ja', 'nej', 'nej']], ['Kunder, offerter och dokument', ['ja', 'ja', 'ja', 'nej']], ['Projekt och montage', ['ja', 'ja', 'ja', 'nej']],
      ['Säljarnas sidor i supportläget', ['nej', 'nej', 'nej', 'ja']], ['Meddelanden och Att göra', ['ja', 'ja', 'ja', 'ja']], ['Försäljningsledningen', ['nej', 'ja', 'nej', 'nej']],
      ['Sätta säljmål', ['nej', 'ja', 'nej', 'ja']], ['Lägga till konton', ['nej', 'ja', 'nej', 'ja']],
      ['Kontrollcentral, admin och säkerhet', ['nej', 'nej', 'nej', 'ja']], ['Kundfält, förlustorsaker och gallring', ['nej', 'nej', 'nej', 'ja']], ['Exportera, importera, återställa och tömma all data', ['nej', 'nej', 'nej', 'ja']]];
    var behorig = band('03 · Behörigheter', 'Vem får', 'göra vad',
      '<div class="ap-matris" role="table"><div class="ap-matris__rad ap-matris__huvud" role="row"><span></span>' + ['Sälj', 'Chef', 'Prod', 'Admin'].map(function (k) { return '<span role="columnheader">' + k + '</span>'; }).join('') + '</div>' +
        RATT.map(function (r) { return '<div class="ap-matris__rad" role="row"><span role="rowheader">' + e(r[0]) + '</span>' + r[1].map(function (x) { return '<span role="cell" data-ratt="' + x + '">' + (x === 'ja' ? ik('bock') : '<i>–</i>') + '</span>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<p class="ad-not">Alla säljare ser och ändrar teamets affärer och kunder – det finns inga egna, låsta affärer. I prototypen styr rollerna menyn och sidorna i webbläsaren. I skarp drift ska servern kontrollera varje ändring.</p>', { klass: 'ap-halv ap-halv--matris' });

    // 04 Inställningar
    var utlogg = IH.sak.utloggMin(), kopia = inst().kopia;
    var installningar = band('04 · Inställningar', 'För den här', 'webbläsaren',
      '<div class="ap-inst"><div><strong>Logga ut vid inaktivitet</strong><small>Utloggning efter så här lång tid utan klick eller tangenttryck. En minut före visas en nedräkning.</small></div>' +
        '<select class="ap-select" data-ap-inst="utlogg" aria-label="Logga ut vid inaktivitet">' + [[0, 'Aldrig'], [15, '15 minuter'], [30, '30 minuter'], [60, '60 minuter']].map(function (o) { return '<option value="' + o[0] + '"' + (utlogg === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="ap-inst"><div><strong>Säkerhetskopia</strong><small>' + (kopia ? 'Senast exporterad ' + IH.sedan(kopia) + '.' : 'Ingen export gjord än.') + ' Förslagen påminner när den är äldre än en vecka.</small></div>' +
        '<button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera data</button></div>' +
      '<div class="ap-inst"><div><strong>Systemrapport</strong><small>Konton, poster, säkerhetspoäng och inställningar som text – kopieras för att klistra in i ett mejl.</small></div>' +
        '<button type="button" class="knapp knapp--liten" data-g="kc-rapport">' + ik('dokument') + 'Kopiera</button></div>', { klass: 'ap-halv ap-halv--inst' });

    // 05 Data och system
    var max = Math.max.apply(null, SAML.map(function (s) { return (d[s[1]] || []).length; }).concat([1]));
    var app = document.querySelector('script[src*="app.js"]'), version = ((app && app.getAttribute('src')) || '').split('?v=')[1] || '–';
    var system = band('05 · System', 'Data', 'och system',
      '<ul class="ap-data">' + SAML.map(function (s) { var n = (d[s[1]] || []).length; return '<li><span>' + s[0] + '</span><span class="ap-stapel" style="--andel:' + (n / max).toFixed(3) + '"><i></i></span><strong>' + n.toLocaleString('sv-SE') + '</strong></li>'; }).join('') + '</ul>' +
      '<dl class="ap-fakta"><div><dt>Läge</dt><dd>Prototyp – allt i den här webbläsaren</dd></div><div><dt>Version</dt><dd>v' + e(version) + ' · data ' + (IH.VERSION || '–') + '</dd></div><div><dt>Lagring</dt><dd>' + kb(lagring()) + ' av cirka 5 MB</dd></div></dl>' +
      '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera data</button>' +
        '<label class="knapp knapp--liten">' + ik('uppladdning') + 'Importera<input type="file" accept="application/json,.json" data-ap-import hidden></label>' +
        '<button type="button" class="knapp knapp--liten knapp--fara" data-g="ad-aterstall">' + i('aterstall') + 'Återställ exempeldata</button>' +
        '<button type="button" class="knapp knapp--liten knapp--fara" data-g="ap-tom">' + ik('papperskorg') + 'Börja med tom data</button></div>', { klass: 'ap-halv ap-halv--data' });

    // 06 Granskningsloggen
    var typFor = function (t) { return t === 'konto' || t === 'support' ? t : 'sakerhet'; };
    var alltLogg = d.aktiviteter.map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: 'crm' }; })
      .concat((d.sakerhet || []).map(function (x) { return { tid: x.tid, av: x.av, text: x.text, typ: typFor(x.typ) }; }))
      .filter(function (x) { return x.tid && (ui.logg === 'alla' || x.typ === ui.logg); }).sort(function (a, b) { return a.tid < b.tid ? 1 : -1; });
    var TYPNAMN = { crm: 'CRM', konto: 'Konto', support: 'Support', sakerhet: 'Säkerhet' };
    var loggBand = band('06 · Logg', 'Säkerhetsloggen', 'med alla ändringar',
      (alltLogg.length ? '<ul class="ao-flode ap-logg">' + alltLogg.slice(0, ui.loggN).map(function (x) { var u = IH.anvandare(x.av) || { namn: '?', farg: '#ccc' }, t = String(x.text || '');
        return '<li data-typ="' + x.typ + '"><span class="avatar avatar--liten" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + '</span><span>' + e(t.slice(0, 110)) + (t.length > 110 ? '…' : '') + '<small><b class="ap-typ" data-typ="' + x.typ + '">' + TYPNAMN[x.typ] + '</b>' + e(u.namn) + ' · ' + IH.sedan(x.tid) + '</small></span></li>'; }).join('') + '</ul>' : '<p class="ad-not">Inget i loggen med det filtret.</p>') +
      (alltLogg.length > ui.loggN ? '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ap-logg-fler">Visa fler (' + (alltLogg.length - ui.loggN) + ' till)</button></div>' : ''),
      { klass: 'ap-halv ap-halv--logg', hoger: '<div class="ap-filterrad" role="group" aria-label="Visa">' + [['alla', 'Allt'], ['crm', 'CRM'], ['konto', 'Konton'], ['support', 'Support'], ['sakerhet', 'Säkerhet']].map(function (f) { return filterKnapp('ap-logg', f[0], f[1], ui.logg); }).join('') + '</div>' });

    return { titel: 'Adminpanelen', html: hjalte + konton + forslagBand + '<div class="ao-tva ap-tva"><div class="ap-stapel-kol">' + behorig + system + '</div><div class="ap-stapel-kol">' + installningar + loggBand + '</div></div>' + kundregister() };
  };

  /* 07 Kundregister: egna kundfält, förlustorsaker och gallring ------------------------------------- */
  var TYPNAMN_F = { text: 'Text', tal: 'Tal', datum: 'Datum', val: 'Val' };
  // db.installningar (datamodell 4) – skapas här om den saknas, så att panelen fungerar även före uppgraderingen
  function instDb() {
    var d = db(); if (!arObj(d.installningar)) d.installningar = {};
    var s = d.installningar;
    if (!Array.isArray(s.egnaFalt)) s.egnaFalt = [];
    if (!Array.isArray(s.forlustorsaker) || !s.forlustorsaker.length) s.forlustorsaker = (IH.FORLUST || []).slice();
    if (s.gallringManader === undefined || (s.gallringManader !== null && !(+s.gallringManader > 0))) s.gallringManader = null;
    return s;
  }
  IH.instDb = instDb;
  // Senaste spåret av kunden i CRM:et: kortet, händelser, affärer, offerter, förfrågningar, uppgifter, projekt och dokument
  function kopplat(kid) {
    var d = db(), aff = d.affarer.filter(function (a) { return a.kund === kid; }), aid = aff.map(function (a) { return a.id; });
    var med = function (x) { return x.kund === kid || (x.affar && aid.indexOf(x.affar) >= 0); };
    return { affarer: aff, offerter: d.offerter.filter(med), projekt: d.projekt.filter(med), aktiviteter: d.aktiviteter.filter(med), uppgifter: d.uppgifter.filter(med),
      dokument: (d.dokument || []).filter(function (x) { return x.kund === kid; }), forfragningar: d.forfragningar.filter(function (x) { return x.kund === kid; }) };
  }
  function senastSpar(k) {
    var p = kopplat(k.id), tider = [k.skapad, k.andrad];
    p.affarer.forEach(function (a) { tider.push(a.skapad, a.andrad, a.vunnen); });
    p.offerter.forEach(function (o) { tider.push(o.skapad); });
    p.aktiviteter.forEach(function (h) { tider.push(h.tid); });
    p.forfragningar.forEach(function (f) { tider.push(f.skapad); });
    p.uppgifter.forEach(function (u) { tider.push(u.klarTid, u.forfaller); });
    p.projekt.forEach(function (x) { tider.push(x.andrad, x.start, x.montage); });
    p.dokument.forEach(function (x) { tider.push(x.tid, x.skapad); });
    return tider.filter(function (t) { return t && !isNaN(Date.parse(t)); }).sort().pop() || null;
  }
  // Kunder utan aktivitet på N månader – inte de som har en öppen affär, ett pågående projekt eller en öppen uppgift
  function gallras(man) {
    var grans = new Date(); grans.setMonth(grans.getMonth() - man);
    return db().kunder.map(function (k) {
      var p = kopplat(k.id);
      if (p.affarer.some(function (a) { return a.steg !== 'vunnen' && !a.forlorad; }) || p.projekt.some(function (x) { return x.steg !== 'klart'; }) || p.uppgifter.some(function (u) { return !u.klar; })) return null;
      var s = senastSpar(k); return !s || new Date(s) < grans ? { k: k, senast: s } : null;
    }).filter(Boolean).sort(function (a, b) { return (a.senast || '') < (b.senast || '') ? -1 : 1; });
  }
  function kundregister() {
    var s = instDb(), man = s.gallringManader;
    var falt = s.egnaFalt.length ? '<ul class="ap-ef">' + s.egnaFalt.map(function (f) {
      return '<li><span><b>' + e(f.namn) + '</b><small>' + (TYPNAMN_F[f.typ] || 'Text') + (f.typ === 'val' && Array.isArray(f.val) ? ': ' + e(f.val.join(', ')) : '') + (f.krav ? ' · obligatoriskt' : '') + '</small></span>' +
        '<button type="button" class="ch-ruta" data-g="ap-ef-andra" data-id="' + e(f.id) + '" title="Ändra ' + e(f.namn) + '" aria-label="Ändra ' + e(f.namn) + '">' + i('redigera') + '</button>' +
        '<button type="button" class="ch-ruta" data-g="ap-ef-bort" data-id="' + e(f.id) + '" title="Ta bort ' + e(f.namn) + '" aria-label="Ta bort ' + e(f.namn) + '">' + i('stang') + '</button></li>';
    }).join('') + '</ul>' : '<p class="ad-not">Inga egna fält än. Lägg till det verksamheten behöver veta om varje kund, till exempel fastighetsbeteckning.</p>';
    var orsaker = '<ul class="ap-fo">' + s.forlustorsaker.map(function (o, n) {
      return '<li><span>' + e(o) + '</span><button type="button" class="ap-fo__bort" data-g="ap-fo-bort" data-n="' + n + '" aria-label="Ta bort ' + e(o) + '"' + (s.forlustorsaker.length <= 1 ? ' disabled title="Minst en orsak behövs"' : '') + '>' + i('stang') + '</button></li>';
    }).join('') + '</ul><form class="ap-fo__ny" data-ap-fo><input name="orsak" maxlength="40" required placeholder="Ny orsak …" aria-label="Ny förlustorsak"><button class="knapp knapp--liten" type="submit">' + i('plus') + 'Lägg till</button></form>';
    var VAL = [null, 6, 12, 18, 24, 36, 60]; if (man && VAL.indexOf(man) < 0) VAL.push(man);
    var lista = man ? gallras(man) : [], visaN = ui.gallN || 6;
    var gall = '<div class="ap-inst ap-inst--gall"><div><strong>Gallringsgräns</strong><small>Verksamheten bestämmer själv hur länge kunduppgifter behövs. Det här är en inställning, inte ett juridiskt råd.</small></div>' +
      '<select class="ap-select" data-ap-gall aria-label="Gallringsgräns">' + VAL.map(function (v) { return '<option value="' + (v || '') + '"' + (v === man ? ' selected' : '') + '>' + (v ? v + (v === 1 ? ' månad' : ' månader') : 'Av') + '</option>'; }).join('') + '</select></div>' +
      (man ? '<p class="ap-gall__rubrik"><b>Kunder utan aktivitet på ' + plural(man, 'månad', 'månader') + '</b> <em class="rakna">' + lista.length + '</em></p>' +
        (lista.length ? '<ul class="ap-gall">' + lista.slice(0, visaN).map(function (x) {
          return '<li><span><b>' + e(x.k.namn) + '</b><small>' + (x.senast ? 'Senast ' + IH.datum(x.senast) : 'Ingen aktivitet') + (x.k.ort ? ' · ' + e(x.k.ort) : '') + '</small></span>' +
            '<button type="button" class="knapp knapp--liten" data-g="ap-utdrag" data-id="' + e(x.k.id) + '">' + ik('ladda-ner') + 'Registerutdrag</button>' +
            '<button type="button" class="knapp knapp--liten knapp--fara" data-g="ap-gall-bort" data-id="' + e(x.k.id) + '">' + ik('papperskorg') + '<span>Radera</span></button></li>';
        }).join('') + '</ul>' + (lista.length > visaN ? '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ap-gall-fler">Visa alla ' + lista.length + '</button></div>' : '') :
          '<p class="ao-lugnt">' + ik('bock') + 'Inga kunder har varit utan aktivitet så länge.</p>') +
        '<p class="ad-not">Kunder med en öppen affär, ett pågående projekt eller en öppen uppgift visas inte. Radera tar bort kunden och allt som hör till kunden i den här webbläsaren – inte i säkerhetskopior eller exporterade filer.</p>' : '');
    return band('07 · Kundregister', 'Kundregistret', 'och gallring',
      '<div class="ap-kr"><div class="ap-kr__del"><h3 class="ap-kr__rubrik">' + ik('redigera') + 'Egna kundfält</h3>' + falt + '<div class="ao-fot"><button type="button" class="knapp knapp--liten" data-g="ap-ef-andra">' + i('plus') + 'Nytt fält</button></div></div>' +
        '<div class="ap-kr__del"><h3 class="ap-kr__rubrik">' + ik('minus-cirkel') + 'Förlustorsaker</h3><p class="ad-not">Visas när en affär markeras som förlorad. Affärer som redan är förlorade behåller sin orsak.</p>' + orsaker + '</div>' +
        '<div class="ap-kr__del ap-kr__del--gall"><h3 class="ap-kr__rubrik">' + ik('klocka') + 'Gallring</h3>' + gall + '</div></div>',
      { klass: 'ap-band--kr', ingress: 'Fält som säljarna fyller i på kundkortet, orsakerna till förlorade affärer och hur länge kunder utan aktivitet ligger kvar.' });
  }

  /* Händelserna ---------------------------------------------------------------------------------- */
  var G = IH.G;
  G['ap-filter'] = function (el) { ui.filter = el.getAttribute('data-f'); IH.rita(); };
  G['ap-logg'] = function (el) { ui.logg = el.getAttribute('data-f'); ui.loggN = 7; IH.rita(); };
  G['ap-logg-fler'] = function () { ui.loggN += 15; IH.rita(); };

  // Ångra: IH.angra (app.js) om den finns, annars toasten med en egen Ångra-knapp
  var angra = function (rubrik, text, aterstall) {
    var kor = function () { aterstall(); IH.spara(); if (IH.uppdateraMeny) IH.uppdateraMeny(); };
    if (IH.angra) { IH.angra(rubrik, text, kor); return; }
    if (IH.ledAngra) { IH.ledAngra(rubrik, text, aterstall); return; }
    IH.toast(rubrik, text, 'aterstall');
  };
  var tvaKlick = function (el, text) {
    if (el.dataset.saker) return true;
    el.dataset.saker = '1'; var s = el.querySelector('span') || el, gammal = s.textContent; s.textContent = text || 'Klicka igen för att bekräfta';
    setTimeout(function () { if (el.isConnected) { delete el.dataset.saker; s.textContent = gammal; } }, 4000);
    return false;
  };

  /* L1 Börja med tom data: export först, sedan TÖM och två klick. Konton, prislista, mallar, inställningar och teman behålls. */
  var TOMMA = [['kunder', 'kunder'], ['forfragningar', 'förfrågningar'], ['affarer', 'affärer'], ['offerter', 'offerter'], ['projekt', 'projekt'], ['uppgifter', 'uppgifter'], ['aktiviteter', 'händelser och anteckningar'], ['dokument', 'dokument'], ['aviseringar', 'aviseringar'], ['videomoten', 'bokade videomöten']];
  G['ap-tom'] = function () {
    if (!IH.kravAdmin()) return;
    var d = db(), kopia = inst().kopia, n = TOMMA.reduce(function (t, x) { return t + (Array.isArray(d[x[0]]) ? d[x[0]].length : 0); }, 0);
    IH.oppnaArk({ titel: 'Börja med tom data', ikon: 'papperskorg', under: 'Inför skarp drift: kunderna och allt som hör till dem tas bort i den här webbläsaren.',
      kropp: '<ol class="ap-tom">' +
        '<li><b>Exportera först</b><p class="ad-not">' + (kopia ? 'Senast exporterad ' + IH.sedan(kopia) + '. ' : 'Ingen export gjord än. ') + 'Med exporten kan du läsa tillbaka allt under Importera.</p><button type="button" class="knapp knapp--liten" data-g="ad-exportera">' + ik('ladda-ner') + 'Exportera data</button></li>' +
        '<li><b>Det här töms</b><p class="ad-not">' + TOMMA.map(function (x) { return x[1]; }).join(', ') + ' – ' + plural(n, 'post', 'poster') + ' i dag.</p></li>' +
        '<li><b>Det här behålls</b><p class="ad-not">Konton och roller, prislistan, mallarna, inställningarna, teman, meddelandena, frånvaron och säkerhetsloggen. Löpnumren fortsätter, så nya kunder och offerter får nya nummer.</p></li>' +
        '<li><b>Skriv TÖM för att fortsätta</b><p class="ad-not">Det gäller bara den här webbläsaren. Andra datorer och exporterade filer påverkas inte.</p><label class="falt"><span>Bekräfta</span><input data-ap-tom-ord autocomplete="off" spellcheck="false" placeholder="TÖM" aria-label="Skriv TÖM"></label></li></ol>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--fara" type="button" data-g="ap-tom-ok" disabled>' + ik('papperskorg') + '<span>Töm datan</span></button>' });
  };
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ap-tom-ord]')) return;
    var b = document.querySelector('[data-g="ap-tom-ok"]'); if (b) b.disabled = t.value.trim().toUpperCase() !== 'TÖM';
  });
  G['ap-tom-ok'] = function (el) {
    if (!IH.kravAdmin()) { IH.stangArk(); return; }
    var ord = document.querySelector('[data-ap-tom-ord]'); if (!ord || ord.value.trim().toUpperCase() !== 'TÖM') return;
    if (!tvaKlick(el, 'Klicka igen för att tömma')) return;
    var d = db(), fore = {}, n = 0;
    TOMMA.forEach(function (x) { if (Array.isArray(d[x[0]])) { fore[x[0]] = d[x[0]]; n += d[x[0]].length; } d[x[0]] = []; });
    d.tomStart = new Date().toISOString();
    if (IH.spara() === false) { Object.keys(fore).forEach(function (k) { d[k] = fore[k]; }); delete d.tomStart; IH.stangArk(); IH.toast('Datan tömdes inte', 'Den gick inte att spara i webbläsaren. Inget har ändrats.', 'varning'); return; }
    logg('aterstall', 'Började med tom data: ' + plural(n, 'post', 'poster') + ' togs bort (kunder, affärer, offerter och det som hör till dem).');
    IH.stangArk(); IH.uppdateraMeny(); IH.rita();
    angra('Datan är tömd', plural(n, 'post', 'poster') + ' borttagna. Konton, prislista och inställningar finns kvar.', function () {
      Object.keys(fore).forEach(function (k) { db()[k] = fore[k].concat(db()[k] || []); }); delete db().tomStart;
      logg('aterstall', 'Tömningen ångrades.');
    });
  };

  /* L4 Egna kundfält ------------------------------------------------------------------------------ */
  var FALT_ID = /^ef[0-9a-z]{1,20}$/;
  G['ap-ef-andra'] = function (el) {
    if (!IH.kravAdmin()) return;
    var s = instDb(), id = el.getAttribute('data-id'), f = id ? s.egnaFalt.find(function (x) { return x.id === id; }) : null;
    IH.oppnaArk({ titel: f ? 'Ändra fältet' : 'Nytt kundfält', ikon: 'redigera', under: f ? e(f.namn) : 'Visas och fylls i på kundkortet.',
      kropp: '<form id="ap-ef-form" data-ap-ef="' + (f ? e(f.id) : '') + '" class="km-form">' +
        '<label class="falt"><span>Namn</span><input name="namn" required maxlength="40" value="' + e(f ? f.namn : '') + '" placeholder="T.ex. Fastighetsbeteckning"></label>' +
        '<label class="falt"><span>Typ</span><select name="typ">' + Object.keys(TYPNAMN_F).map(function (t) { return '<option value="' + t + '"' + ((f ? f.typ : 'text') === t ? ' selected' : '') + '>' + TYPNAMN_F[t] + '</option>'; }).join('') + '</select></label>' +
        '<label class="falt" data-ap-ef-val' + ((f && f.typ === 'val') ? '' : ' hidden') + '><span>Alternativ, ett per rad</span><textarea name="val" rows="4" maxlength="600">' + e(f && Array.isArray(f.val) ? f.val.join('\n') : '') + '</textarea></label>' +
        '<label class="km-kryss"><input type="checkbox" name="krav"' + (f && f.krav ? ' checked' : '') + '> Obligatoriskt när kunden ändras</label>' +
        (f ? '<p class="ad-not">Byter du typ ligger de värden som redan är ifyllda kvar som text.</p>' : '') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ap-ef-form">' + i('bock') + 'Spara</button>' });
  };
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('#ap-ef-form [name=typ]')) return;
    var v = t.form.querySelector('[data-ap-ef-val]'); if (v) v.hidden = t.value !== 'val';
  });
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches) return;
    if (t.matches('[data-ap-ef]')) {
      ev.preventDefault();
      if (!IH.kravAdmin()) { IH.stangArk(); return; }
      var s = instDb(), id = t.getAttribute('data-ap-ef'), namn = t.namn.value.trim().replace(/\s+/g, ' ').slice(0, 40), typ = TYPNAMN_F[t.typ.value] ? t.typ.value : 'text';
      if (!namn) return;
      if (s.egnaFalt.some(function (x) { return x.id !== id && x.namn.toLowerCase() === namn.toLowerCase(); })) { IH.toast('Det finns redan ett fält med det namnet', null, 'varning'); return; }
      var val = typ === 'val' ? t.val.value.split(/\r?\n/).map(function (x) { return x.trim().slice(0, 60); }).filter(Boolean).filter(function (x, n, l) { return l.indexOf(x) === n; }).slice(0, 30) : undefined;
      if (typ === 'val' && val.length < 2) { IH.toast('Skriv minst två alternativ', 'Ett per rad.', 'varning'); return; }
      var f = id ? s.egnaFalt.find(function (x) { return x.id === id; }) : null;
      if (!f) { var nr = 1; while (s.egnaFalt.some(function (x) { return x.id === 'ef' + nr; })) nr++; f = { id: 'ef' + nr }; s.egnaFalt.push(f); }
      f.namn = namn; f.typ = typ; f.krav = !!t.krav.checked; if (val) f.val = val; else delete f.val;
      IH.spara(); logg('installning', (id ? 'Ändrade' : 'Lade till') + ' kundfältet ”' + namn + '”.');
      IH.stangArk(); IH.rita(); IH.toast(id ? 'Fältet är ändrat' : 'Fältet är tillagt', namn + ' · ' + TYPNAMN_F[typ].toLowerCase(), 'bock');
    }
    if (t.matches('[data-ap-fo]')) {
      ev.preventDefault();
      if (!IH.kravAdmin()) return;
      var s2 = instDb(), o = t.orsak.value.trim().replace(/\s+/g, ' ').slice(0, 40); if (!o) return;
      if (s2.forlustorsaker.some(function (x) { return x.toLowerCase() === o.toLowerCase(); })) { IH.toast('Den orsaken finns redan', null, 'varning'); return; }
      if (s2.forlustorsaker.length >= 12) { IH.toast('Högst 12 orsaker', 'Ta bort en först.', 'varning'); return; }
      s2.forlustorsaker.push(o); IH.spara(); logg('installning', 'Lade till förlustorsaken ”' + o + '”.'); IH.rita();
      IH.toast('Orsaken är tillagd', o, 'bock');
      setTimeout(function () { var x = document.querySelector('[data-ap-fo] input'); if (x) x.focus(); }, 60);
    }
  });
  G['ap-ef-bort'] = function (el) {
    if (!IH.kravAdmin()) return;
    var s = instDb(), n = s.egnaFalt.findIndex(function (x) { return x.id === el.getAttribute('data-id'); }); if (n < 0) return;
    var f = s.egnaFalt.splice(n, 1)[0]; IH.spara(); logg('installning', 'Tog bort kundfältet ”' + f.namn + '”.'); IH.rita();
    angra('Fältet är borttaget', f.namn + ' – värdena på kunderna ligger kvar om du ångrar.', function () { var l = instDb().egnaFalt; if (!l.some(function (x) { return x.id === f.id; })) l.splice(Math.min(n, l.length), 0, f); });
  };
  G['ap-fo-bort'] = function (el) {
    if (!IH.kravAdmin()) return;
    var s = instDb(), n = +el.getAttribute('data-n'); if (!(n >= 0 && n < s.forlustorsaker.length) || s.forlustorsaker.length <= 1) return;
    var o = s.forlustorsaker.splice(n, 1)[0]; IH.spara(); logg('installning', 'Tog bort förlustorsaken ”' + o + '”.'); IH.rita();
    angra('Orsaken är borttagen', o, function () { var l = instDb().forlustorsaker; if (l.indexOf(o) < 0) l.splice(Math.min(n, l.length), 0, o); });
  };

  /* L4 Gallring ------------------------------------------------------------------------------------ */
  G['ap-gall-fler'] = function () { ui.gallN = 1e6; IH.rita(); };
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ap-gall]')) return;
    if (!IH.kravAdmin()) { IH.rita(); return; }
    var v = +t.value || null; instDb().gallringManader = v; ui.gallN = 6; IH.spara();
    logg('installning', 'Gallringsgräns: ' + (v ? v + ' månader' : 'av') + '.'); IH.rita();
    IH.toast('Sparat', v ? 'Kunder utan aktivitet på ' + plural(v, 'månad', 'månader') + ' listas under Gallring.' : 'Gallringen är av.', 'bock');
  });
  // Registerutdrag: kundkortets utdrag (vyer.js) om det finns, annars en JSON-fil med allt om kunden
  var utanFiler = function (x) { var o = {}; Object.keys(x).forEach(function (k) { var v = x[k]; o[k] = typeof v === 'string' && /^data:/.test(v) ? '(fil, ' + Math.round(v.length * 0.75 / 1024) + ' kB)' : v; }); return o; };
  G['ap-utdrag'] = function (el) {
    if (!IH.kravAdmin()) return;
    var k = IH.kund(el.getAttribute('data-id')); if (!k) return;
    if (IH.registerutdrag) { IH.registerutdrag(k.id); return; }
    var p = kopplat(k.id), ut = { registerutdrag: new Date().toISOString(), kalla: 'Legohus CRM – datan i den här webbläsaren', kund: k };
    Object.keys(p).forEach(function (n) { ut[n] = p[n].map(utanFiler); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(ut, null, 2)], { type: 'application/json' }));
    a.download = 'registerutdrag-' + String(k.namn).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + IH.dagStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    IH.logga('system', 'Registerutdrag skapat av ' + IH.jag().namn + '.', k.id, null); IH.spara();
    logg('gdpr', 'Registerutdrag för kund ' + k.id + '.');
    IH.toast('Registerutdraget är nedladdat', k.namn + ' · JSON med allt som finns om kunden i den här webbläsaren.', 'ladda-ner');
  };
  G['ap-gall-bort'] = function (el) {
    if (!IH.kravAdmin()) return;
    var d = db(), k = IH.kund(el.getAttribute('data-id')); if (!k) return;
    if (!tvaKlick(el, 'Klicka igen')) return;
    var p = kopplat(k.id), bort = { kunder: [k] }, n = 0;
    Object.keys(p).forEach(function (s) { bort[s] = p[s]; });
    var sparat = {};
    Object.keys(bort).forEach(function (s) {
      var lista = d[s] || [], ut = bort[s];
      sparat[s] = ut.map(function (x) { return { x: x, ix: lista.indexOf(x) }; }).filter(function (y) { return y.ix >= 0; });
      d[s] = lista.filter(function (x) { return ut.indexOf(x) < 0; }); n += sparat[s].length;
    });
    IH.spara(); logg('gdpr', 'Raderade kund ' + k.id + ' och ' + plural(n - 1, 'kopplad post', 'kopplade poster') + ' (gallring, ' + instDb().gallringManader + ' månader).');
    IH.uppdateraMeny(); IH.rita();
    angra('Kunden är raderad', k.namn + ' och ' + plural(n - 1, 'post', 'poster') + ' som hörde till kunden.', function () {
      Object.keys(sparat).forEach(function (s) { var l = db()[s] = db()[s] || []; sparat[s].forEach(function (y) { if (l.indexOf(y.x) < 0) l.splice(Math.min(y.ix, l.length), 0, y.x); }); });
      logg('gdpr', 'Raderingen av kund ' + k.id + ' ångrades.');
    });
  };
  G['ap-aktiv'] = function (el) {
    if (!IH.kravAdmin()) return;
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u || u.id === IH.jag().id) return;
    var av = !u.inaktiv;
    if (av && u.roll === 'admin' && IH.ANVANDARE.filter(function (x) { return x.roll === 'admin' && !x.inaktiv; }).length <= 1) return;
    andra(u.id, { inaktiv: av });
    logg('konto', (av ? 'Inaktiverade ' : 'Aktiverade ') + u.namn + '.');
    IH.uppdateraMeny(); IH.rita();
    IH.toast(av ? 'Kontot för ' + u.namn + ' är inaktiverat' : 'Kontot för ' + u.namn + ' är aktivt igen', av ? 'Det går inte att logga in på kontot förrän det har aktiverats igen.' : null, av ? 'las' : 'bock');
  };
  G['ap-andra'] = function (el) {
    if (!IH.kravAdmin()) return;
    var u = IH.anvandare(el.getAttribute('data-id')); if (!u) return;
    IH.oppnaArk({ titel: 'Ändra ' + u.namn, under: 'Sparas i den här webbläsaren (prototyp).', ikon: 'redigera',
      kropp: '<form id="ap-andra-form" data-ap-andra="' + u.id + '" class="km-form"><label class="falt"><span>Titel</span><input name="titel" required maxlength="60" value="' + e(u.titel) + '"></label>' +
        (u.roll === 'salj' ? '<label class="km-kryss"><input type="checkbox" name="chef"' + (u.chef ? ' checked' : '') + '> Försäljningschef (ser försäljningsledningen)</label>' +
          '<label class="falt"><span>Årsmål i kronor</span><input name="mal" type="number" min="0" step="any" data-steg="50000" value="' + (u.mal || '') + '" placeholder="T.ex. 800 000"></label>' : '') + '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ap-andra-form">' + i('bock') + 'Spara</button>' });
  };
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-ap-andra]')) return;
    ev.preventDefault();
    if (!IH.kravAdmin()) { IH.stangArk(); return; }
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
    if (!vad.length) { IH.toast('Inget att spara', 'Inget har ändrats.', 'bock'); return; }
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
    if ((t.matches('[data-ap-inst="utlogg"]') || t.matches('[data-ap-import]')) && !IH.kravAdmin()) { t.value = ''; return; }
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
          kropp: '<p class="ad-not">Filen innehåller ' + plural(ny.kunder.length, 'kund', 'kunder') + ', ' + plural(ny.affarer.length, 'affär', 'affärer') + ' och ' + ny.projekt.length + ' projekt. All nuvarande data i den här webbläsaren ersätts – säkerhetsloggen och skanningarna behålls. Exportera först om du vill kunna gå tillbaka.</p>' +
            (aldre ? '<p class="ad-not">Filen är från dataversion ' + e(String(ny.version)) + ' och uppgraderas till version ' + IH.VERSION + '. Det som saknas (prislistan och löpnumren) fylls i.</p>' : ''),
          fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="button" data-g="ap-import-ok">' + ik('uppladdning') + 'Ersätt datan</button>' });
      };
      r.readAsText(fil); t.value = '';
    }
  });
  var vantar = null;
  // Kontrollerar att filen är en export från CRM:et som går att använda. Ger felet som text, eller null.
  var KRAV = ['kunder', 'affarer', 'aktiviteter', 'uppgifter', 'projekt', 'offerter', 'forfragningar'];
  var namnFor = function (k) { var s = SAML.filter(function (x) { return x[1] === k; })[0]; return s ? s[0].toLowerCase() : k; };
  function granskaImport(ny) {
    if (!ny || typeof ny !== 'object' || Array.isArray(ny)) return 'Det ser inte ut som en export från Legohus CRM.';
    var saknas = KRAV.filter(function (k) { return !Array.isArray(ny[k]); });
    if (saknas.length) return 'Det ser inte ut som en export från Legohus CRM (saknar ' + saknas.map(namnFor).join(', ') + ').';
    if (typeof ny.version !== 'number' || ny.version < 1) return 'Filen saknar dataversion – den kommer inte från en export.';
    if (ny.version > IH.VERSION) return 'Filen är från en nyare version (' + ny.version + ') av CRM:et än den här (' + IH.VERSION + ').';
    var trasig = KRAV.filter(function (k) { return ny[k].some(function (x) { return !x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id; }); });
    if (trasig.length) return 'Poster utan id i ' + trasig.map(namnFor).join(', ') + '.';
    if (ny.kunder.some(function (k) { return typeof k.namn !== 'string' || !k.namn.trim(); })) return 'Det finns kunder utan namn i filen.';
    if (ny.affarer.some(function (a) { return typeof a.varde !== 'number' || !isFinite(a.varde); })) return 'Det finns affärer utan giltigt värde i filen.';
    if (ny.prislista && (typeof ny.prislista !== 'object' || typeof ny.prislista.modeller !== 'object' || !Array.isArray(ny.prislista.poster))) return 'Prislistan i filen är trasig.';
    return granskaDjupt(ny);
  }
  // Id:n och hänvisningar sätts in i länkar och attribut på många ställen – de får bara vara korta och ofarliga.
  // Fälten som sidorna räknar med kontrolleras också, så att en trasig fil inte låser CRM:et.
  var ID = /^[A-Za-z0-9_-]{1,64}$/;
  var REF = ['kund', 'affar', 'projekt', 'offert', 'ansvarig', 'tilldelad', 'av', 'u', 'kanal'];
  var TEXT = ['namn', 'titel', 'text', 'steg', 'modell', 'status', 'typ', 'nummer', 'ort', 'epost', 'telefon', 'beskrivning'];
  var DATAURL = /^data:[a-z0-9.+\/-]+;base64,[A-Za-z0-9+\/=]*$/i;
  var arObj = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
  var tomt = function (v) { return v == null || v === ''; };
  var FARLIGA_ID = { __proto__: null, constructor: 1, prototype: 1 }; FARLIGA_ID['__proto__'] = 1;
  function postFel(x, extra) {
    if (!arObj(x) || typeof x.id !== 'string' || !ID.test(x.id) || FARLIGA_ID[x.id]) return 'id';
    for (var n = 0; n < REF.length; n++) { var v = x[REF[n]]; if (!tomt(v) && (typeof v !== 'string' || !ID.test(v) || FARLIGA_ID[v])) return REF[n]; }
    for (var m = 0; m < TEXT.length; m++) { var t = x[TEXT[m]]; if (t != null && typeof t !== 'string' && typeof t !== 'number') return TEXT[m]; }
    return extra ? extra(x) : null;
  }
  // Frånvaron: typ måste vara en av FRANVARO i ledning.js och datumen läsbara – annars kraschar profilen och chefsvyn
  var FV_TYPER = { semester: 1, sjuk: 1, ledig: 1, utbildning: 1 };
  var datumOk = function (v) { return typeof v === 'string' && !isNaN(Date.parse(v)); };
  var franvaroFel = function (f) { return !Object.prototype.hasOwnProperty.call(FV_TYPER, f.typ) ? 'typ' : !datumOk(f.fran) ? 'fran' : !datumOk(f.till) ? 'till' : null; };
  function granskaDjupt(ny) {
    var lista = function (k) { return ny[k] == null ? [] : ny[k]; };
    var samlingar = KRAV.concat(['dokument', 'franvaro']);
    for (var s = 0; s < samlingar.length; s++) {
      var k = samlingar[s];
      if (!Array.isArray(lista(k))) return 'Delen ' + namnFor(k) + ' i filen är inte en lista.';
      var fel = null;
      lista(k).some(function (x) { fel = postFel(x, k === 'offerter' ? function (o) { return o.rader != null && (!Array.isArray(o.rader) || o.rader.some(function (r) { return !arObj(r) || (r.antal != null && (typeof r.antal !== 'number' || !isFinite(r.antal))) || (r.pris != null && (typeof r.pris !== 'number' || !isFinite(r.pris))); })) ? 'rader' : null; } : k === 'franvaro' ? franvaroFel : null); return fel; });
      if (fel) return 'Ogiltigt värde (' + fel + ') i ' + namnFor(k) + ' – filen kan inte importeras.';
    }
    // Prislistan: samma krav på id som övriga poster och priser som riktiga tal (id:t sätts in i option-värden och fältnamn)
    if (ny.prislista != null) {
      if (!arObj(ny.prislista) || (ny.prislista.poster != null && !Array.isArray(ny.prislista.poster))) return 'Prislistan i filen är trasig.';
      var pf = null; (ny.prislista.poster || []).some(function (p) { pf = postFel(p, function (x) { return x.pris != null && (typeof x.pris !== 'number' || !isFinite(x.pris)) ? 'pris' : null; }); return pf; });
      if (pf) return 'Ogiltigt värde (' + pf + ') i prislistan – filen kan inte importeras.';
      if (ny.prislista.modeller != null && (!arObj(ny.prislista.modeller) || Object.keys(ny.prislista.modeller).some(function (k) { return !ID.test(k) || FARLIGA_ID[k]; }))) return 'Prislistans hus i filen är trasiga.';
    }
    if (ny.lopnr != null && !arObj(ny.lopnr)) return 'Löpnumren i filen är trasiga.';
    // Inställningarna (datamodell 4): egna fält, förlustorsaker och gallringsgräns – id och text sätts in i sidan
    if (ny.installningar != null) {
      var st = ny.installningar;
      if (!arObj(st)) return 'Inställningarna i filen är trasiga.';
      if (st.egnaFalt != null && (!Array.isArray(st.egnaFalt) || st.egnaFalt.some(function (f) { return !arObj(f) || typeof f.id !== 'string' || !ID.test(f.id) || FARLIGA_ID[f.id] || typeof f.namn !== 'string' || (f.val != null && (!Array.isArray(f.val) || f.val.some(function (v) { return typeof v !== 'string'; }))); }))) return 'De egna kundfälten i filen är trasiga.';
      if (st.forlustorsaker != null && (!Array.isArray(st.forlustorsaker) || st.forlustorsaker.some(function (o) { return typeof o !== 'string'; }))) return 'Förlustorsakerna i filen är trasiga.';
      if (st.gallringManader != null && (typeof st.gallringManader !== 'number' || !isFinite(st.gallringManader) || st.gallringManader < 0)) return 'Gallringsgränsen i filen är trasig.';
    }
    if (ny.kunder.some(function (k) { return k.falt != null && (!arObj(k.falt) || Object.keys(k.falt).some(function (f) { return !ID.test(f) || FARLIGA_ID[f]; })); })) return 'Kundernas egna fält i filen är trasiga.';
    if (ny.aviseringar != null && !Array.isArray(ny.aviseringar)) return 'Aviseringarna i filen är trasiga.';
    if (ny.chatt != null) {
      var c = ny.chatt;
      if (!arObj(c) || (c.kanaler != null && !Array.isArray(c.kanaler)) || (c.meddelanden != null && !Array.isArray(c.meddelanden)) || (c.last != null && !arObj(c.last)) || (c.tyst != null && !arObj(c.tyst))) return 'Meddelandena i filen är trasiga.';
      var kanalFel = (c.kanaler || []).some(function (x) { return postFel(x) || (x.medlemmar != null && (!Array.isArray(x.medlemmar) || x.medlemmar.some(function (id) { return typeof id !== 'string' || !ID.test(id); }))); });
      var meddFel = (c.meddelanden || []).some(function (m) {
        if (postFel(m)) return true;
        if (m.filer != null && (!Array.isArray(m.filer) || m.filer.some(function (f) { return !arObj(f) || (f.data != null && (typeof f.data !== 'string' || !DATAURL.test(f.data))); }))) return true;
        if (m.reakt != null && (!arObj(m.reakt) || Object.keys(m.reakt).some(function (r) { return r.length > 16 || /[<>"'&\s]/.test(r) || !Array.isArray(m.reakt[r]) || m.reakt[r].some(function (id) { return typeof id !== 'string' || !ID.test(id); }); }))) return true;
        return m.svar != null && (!arObj(m.svar) || !ID.test(String(m.svar.mid)));
      });
      if (kanalFel || meddFel) return 'Meddelandena i filen innehåller ogiltiga värden – filen kan inte importeras.';
    }
    return null;
  }
  // Fyller det som saknas så att datan inte byts ut mot exempeldatan vid nästa laddning (app.js jämför versionen)
  function uppgradera(ny) {
    ny.version = IH.VERSION;
    if (!ny.prislista) ny.prislista = JSON.parse(JSON.stringify(IH.PRISLISTA_START));
    var lopnr = ny.lopnr && typeof ny.lopnr === 'object' ? ny.lopnr : {};
    var hogst = function (lista) { return (Array.isArray(lista) ? lista : []).reduce(function (m, x) { var n = parseInt(String(x.id).replace(/^\D+/, ''), 10); return isFinite(n) && n > m ? n : m; }, 0); };
    [['kund', 'kunder'], ['affar', 'affarer'], ['forfragan', 'forfragningar'], ['aktivitet', 'aktiviteter'], ['uppgift', 'uppgifter'], ['projekt', 'projekt'], ['offert', 'offerter'], ['dokument', 'dokument']].forEach(function (t) {
      lopnr[t[0]] = Math.max(+lopnr[t[0]] || 0, hogst(ny[t[1]]));
    });
    ny.lopnr = lopnr;
    return ny;
  }
  G['ap-import-ok'] = function () {
    if (!vantar) return;
    if (!IH.kravAdmin()) { vantar = null; IH.stangArk(); return; }
    var gammal = db(), logg0 = (gammal.sakerhet || []).slice(), hub0 = gammal.sakHub, fran = vantar.version;
    uppgradera(vantar);
    // Datamodellens nya fält (app.js) fylls i för en fil från en äldre version
    if (fran < IH.VERSION && IH.uppgraderaDb) { vantar.version = fran; IH.uppgraderaDb(vantar); vantar.version = IH.VERSION; }
    IH.db = vantar; IH.db.sakerhet = logg0; if (hub0) IH.db.sakHub = hub0; vantar = null;
    // Provladdning: menyn och sidan ritas en gång innan något sparas – kastar något läggs den gamla datan tillbaka
    try { IH.uppdateraMeny(); IH.rita(); } catch (x) {
      IH.db = gammal; IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      logg('import', 'Importen avbröts – filen gick inte att visa (' + String(x && x.message || x).slice(0, 80) + ').');
      IH.toast('Kunde inte importera filen', 'Datan i filen gick inte att visa. Inget har ändrats.', 'varning'); return;
    }
    if (IH.spara() === false) {
      IH.db = gammal; IH.stangArk(); IH.uppdateraMeny(); IH.rita();
      IH.toast('Kunde inte importera filen', 'Datan gick inte att spara i webbläsaren (lagringen är full). Inget har ändrats.', 'varning'); return;
    }
    logg('import', 'Data importerad: ' + IH.db.kunder.length + ' kunder, ' + IH.db.affarer.length + ' affärer' + (fran !== IH.VERSION ? ' (uppgraderad från dataversion ' + fran + ')' : '') + '.');
    IH.stangArk(); IH.uppdateraMeny(); IH.rita();
    IH.toast('Datan är importerad', null, 'uppladdning');
  };
})();
