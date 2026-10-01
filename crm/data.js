/* ============================================================
   Idealhus CRM – data (prototyp, 2026-10-01)
   Husen, flödena och exempeldatan. Inga riktiga kunder: namn,
   telefonnummer (PTS fiktiva serie 070-174 06 05–99) och
   e-post (@example.com) är påhittade. Priserna är exempel och
   ändras under Inställningar – de är inte Idealhus priser.
   Allt sparas i webbläsaren (localStorage, IH.NYCKEL).
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};

  IH.NYCKEL = 'ih-crm-v1';
  IH.VERSION = 1;

  /* --- Husen (samma som _modeller.py) ------------------------------ */
  IH.MODELLER = [
    { id: 'r2', namn: 'Sadel 26', kategori: 'Attefallshus', yta: 26, rum: 1, bild: '../images/hus-r2.webp',
      tumme: '../images/tumme/meny-attefallshus.webp', glb: '../modeller/hus-r2.glb', matt: '8,33 × 3,49 m', tak: 'Sadeltak 30°',
      text: 'Ett rum under ett brant sadeltak. Smal form som får plats längs en häck eller tomtgräns.' },
    { id: 'r1', namn: 'Sadel 27', kategori: 'Attefallshus', yta: 27, rum: 2, bild: '../images/hus-r1.webp',
      tumme: '../images/tumme/hus-r1.webp', glb: '../modeller/hus-r1.glb', matt: '7,14 × 4,20 m', tak: 'Sadeltak 24°',
      text: 'Två rum, sovrum och allrum. Ett litet hus som går att bo i på riktigt.' },
    { id: 'r5', namn: 'Pulpet 27', kategori: 'Attefallshus', yta: 27, rum: 2, bild: '../images/hus-r5.webp',
      tumme: '../images/tumme/hus-r5.webp', glb: '../modeller/hus-r5.glb', matt: '7,50 × 4,00 m', tak: 'Pulpettak 2°',
      text: 'Två rum under ett nästan platt tak, stora glaspartier och mycket ljus.' },
    { id: 'r3', namn: 'Kupa 38', kategori: 'Fritidshus', yta: 38, rum: 2, bild: '../images/hus-r3.webp',
      tumme: '../images/tumme/meny-fritidshus.webp', glb: '../modeller/hus-r3.glb', matt: '10,83 × 3,90 m', tak: 'Takkupa',
      text: 'Fritidshus med takkupa och extra takhöjd. Kräver bygglov.', lov: true },
    { id: 'r4', namn: 'Kupa 45', kategori: 'Fritidshus', yta: 45, rum: 2, bild: '../images/hus-r4.webp',
      tumme: '../images/tumme/hus-r4.webp', glb: '../modeller/hus-r4.glb', matt: '12,50 × 3,90 m', tak: 'Takkupa',
      text: 'Det största huset, plats för både vardag och gäster. Kräver bygglov.', lov: true },
    { id: 'element', namn: 'Byggelement', kategori: 'Proffs', yta: 0, rum: 0, bild: '../images/foto/lyft-stommar.webp',
      tumme: '../images/tumme/meny-proffs.webp', glb: null, matt: 'Efter ritning', tak: '–',
      text: 'Utfackningsväggar, husblock och moduler efter kundens ritning.' }
  ];
  IH.modell = function (id) {
    for (var i = 0; i < IH.MODELLER.length; i++) if (IH.MODELLER[i].id === id) return IH.MODELLER[i];
    return null;
  };

  /* --- Säljflödet --------------------------------------------------- */
  IH.SALJSTEG = [
    { id: 'ny', namn: 'Ny förfrågan', kort: 'Ny', sannolikhet: 10, farg: '#b8cde0' },
    { id: 'kontakt', namn: 'Kontakt tagen', kort: 'Kontakt', sannolikhet: 20, farg: '#9fc2c9' },
    { id: 'besok', namn: 'Tomt & platsbesök', kort: 'Besök', sannolikhet: 40, farg: '#a9c8a4' },
    { id: 'offert', namn: 'Offert skickad', kort: 'Offert', sannolikhet: 60, farg: '#e8c98f' },
    { id: 'forhandling', namn: 'Förhandling', kort: 'Förhandling', sannolikhet: 75, farg: '#f0b56e' },
    { id: 'vunnen', namn: 'Order signerad', kort: 'Vunnen', sannolikhet: 100, farg: '#7fe0a6' }
  ];
  IH.steg = function (id) {
    for (var i = 0; i < IH.SALJSTEG.length; i++) if (IH.SALJSTEG[i].id === id) return IH.SALJSTEG[i];
    return null;
  };
  IH.FORLUST = ['Priset', 'Valde annan leverantör', 'Fick inte bygglov', 'Projektet skjuts upp', 'Tomten passade inte', 'Annat'];

  /* --- Produktionsflödet (ur Så fungerar det, steg 3–7) -------------- */
  IH.PROJSTEG = [
    { id: 'underlag', namn: 'Ritning & lov', kort: 'Underlag', farg: '#b8cde0', text: 'Ritningar och underlag. Kunden lämnar in bygglov eller anmälan.' },
    { id: 'tillverkning', namn: 'Tillverkning', kort: 'Fabrik', farg: '#e8c98f', text: 'Huset byggs under tak i Sverige.' },
    { id: 'grund', namn: 'Grund & mark', kort: 'Grund', farg: '#a9c8a4', text: 'Kundens grund, el, vatten och avlopp ska vara klart.' },
    { id: 'montage', namn: 'Leverans & montage', kort: 'Montage', farg: '#f0b56e', text: 'Lastbil och kran. Montaget tar dagar.' },
    { id: 'besiktning', namn: 'Slutbesiktning', kort: 'Besiktning', farg: '#9fc2c9', text: 'Genomgång av huset tillsammans, rum för rum.' },
    { id: 'klart', namn: 'Klart', kort: 'Klart', farg: '#7fe0a6', text: 'Överlämnat till kunden.' }
  ];
  IH.projsteg = function (id) {
    for (var i = 0; i < IH.PROJSTEG.length; i++) if (IH.PROJSTEG[i].id === id) return IH.PROJSTEG[i];
    return null;
  };

  /* Förfrågningarnas läge i inkorgen. */
  IH.FSTATUS = [
    { id: 'ny', namn: 'Ny', farg: '#f0b56e' },
    { id: 'kontaktad', namn: 'Kontaktad', farg: '#9fc2c9' },
    { id: 'kvalificerad', namn: 'Blev affär', farg: '#7fe0a6' },
    { id: 'ej', namn: 'Ej aktuell', farg: '#a39b8e' }
  ];

  IH.MILJO = {
    'Vid havet': '../images/hus-r1.webp',
    'I skogen': '../images/hus-r3.webp',
    'På fjället': '../images/hus-r5.webp',
    'I trädgården': '../images/hus-r4.webp'
  };

  /* --- Exempelpriser (ändras under Inställningar) --------------------- */
  IH.PRISLISTA_START = {
    modeller: { r2: 395000, r1: 425000, r5: 445000, r3: 695000, r4: 795000, element: 0 },
    poster: [
      { id: 'frakt', text: 'Frakt till tomten', pris: 28000 },
      { id: 'montage', text: 'Montage på plats', pris: 45000 },
      { id: 'kran', text: 'Kranbil', pris: 12000 },
      { id: 'ritning', text: 'Ritningar och bygglovsunderlag', pris: 18000 },
      { id: 'altan', text: 'Altan i trä, 12 m²', pris: 38000 },
      { id: 'kok', text: 'Kök och badrum', pris: 145000 },
      { id: 'kamin', text: 'Braskamin med skorsten', pris: 42000 }
    ]
  };

  IH.ANVANDARE = [
    { id: 'ml', namn: 'Maja Lind', roll: 'salj', titel: 'Sälj', farg: 'linear-gradient(135deg,#f0b56e,#8f5424)' },
    { id: 'je', namn: 'Jonas Ek', roll: 'prod', titel: 'Produktion', farg: 'linear-gradient(135deg,#7fe0a6,#3f6b50)' }
  ];

  /* --- Exempeldata --------------------------------------------------- */
  // Tiderna räknas från i dag, så datan ser färsk ut varje gång den skapas.
  function dagar(n, timme) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(timme == null ? 10 : timme, (Math.abs(n) * 7) % 60, 0, 0);
    return d.toISOString();
  }

  IH.skapaExempeldata = function () {
    var db = {
      version: IH.VERSION,
      skapad: new Date().toISOString(),
      prislista: JSON.parse(JSON.stringify(IH.PRISLISTA_START)),
      kunder: [], forfragningar: [], affarer: [], aktiviteter: [], uppgifter: [], projekt: [], offerter: [],
      lopnr: { kund: 0, affar: 0, forfragan: 0, aktivitet: 0, uppgift: 0, projekt: 0, offert: 100 }
    };
    function nid(typ, prefix) { db.lopnr[typ] += 1; return prefix + db.lopnr[typ]; }

    var PERSONER = [
      ['Karin Holm', 'Värmdö', 'privat'], ['Lina Svensson', 'Uppsala', 'privat'], ['Erik Nyström', 'Åre', 'privat'],
      ['Sara Lindqvist', 'Visby', 'privat'], ['Johan Berg', 'Nacka', 'privat'], ['Maria Ek', 'Norrtälje', 'privat'],
      ['Patrik Sandberg', 'Sundsvall', 'privat'], ['Anna Forsberg', 'Tyresö', 'privat'], ['Lindbacka Bostäder AB', 'Västerås', 'foretag'],
      ['Olof Strand', 'Orust', 'privat'], ['Emma Åkesson', 'Falun', 'privat'], ['Skärgårdsbyn ek. förening', 'Östhammar', 'foretag'],
      ['Henrik Dahl', 'Borås', 'privat'], ['Fredrik Sjögren', 'Vallentuna', 'privat']
    ];
    var kunder = PERSONER.map(function (p, i) {
      var k = {
        id: nid('kund', 'k'), namn: p[0], ort: p[1], typ: p[2],
        telefon: '070-174 06 ' + (5 + i * 3 < 10 ? '0' : '') + (5 + i * 3),
        epost: p[0].toLowerCase().replace(/ ek\. förening| ab/g, '').replace(/å|ä/g, 'a').replace(/ö/g, 'o')
          .replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.') + '@example.com',
        skapad: dagar(-60 + i * 4)
      };
      db.kunder.push(k);
      return k;
    });

    // Förfrågningarna i inkorgen: samma frågor som formuläret på sajten.
    var F = [
      [0, 'Vid havet', 'Attefallshus', 'Bo året runt', 'Vi har en sjötomt och vill bygga ett litet hus att bo i året runt. Tomten sluttar lite mot vattnet.', -0.1, 'ny', 'Webbformulär'],
      [1, 'I trädgården', 'Attefallshus', 'Uthyrning', 'Vill bygga ett attefallshus i trädgården att hyra ut till studenter. Inom detaljplan.', -0.4, 'kontaktad', 'Webbformulär'],
      [2, 'På fjället', 'Fritidshus', 'Gästhus', 'Fjällstuga på vår tomt i Åre, gärna med braskamin. Har ni bygglovsritningar?', -1.2, 'ny', 'Verktyget'],
      [3, 'Vid havet', 'Fritidshus', 'Gästhus', 'Fritidshus på Gotland nära havet. Undrar om strandskyddet och vad frakten kostar.', -2, 'kvalificerad', 'Webbformulär'],
      [4, 'I trädgården', 'Attefallshus', 'Kontor', 'Behöver ett kontor på tomten, runt 25 m². Hur snabbt kan det stå klart?', -3, 'kvalificerad', 'Telefon'],
      [5, 'I skogen', 'Vet inte än', 'Annat', 'Vi funderar på vad som ryms på vår tomt utanför detaljplan. Vill gärna prata.', -4, 'kvalificerad', 'Verktyget'],
      [6, 'I skogen', 'Fritidshus', 'Bo året runt', 'Vill bygga ett fritidshus som går att bo i året runt, 40–45 m².', -6, 'kvalificerad', 'Webbformulär'],
      [7, 'I trädgården', 'Attefallshus', 'Gästhus', 'Gästhus till föräldrarna, gärna med kök och badrum.', -8, 'kvalificerad', 'Mejl'],
      [8, 'I trädgården', 'Vet inte än', 'Uthyrning', 'Vi utvecklar ett område med tolv tomter och söker husblock eller moduler i serie.', -9, 'kvalificerad', 'Mejl'],
      [9, 'Vid havet', 'Attefallshus', 'Gästhus', 'Sommarhus på Orust, sluttande berg. Går det att bygga på plintar?', -12, 'ej', 'Webbformulär'],
      [12, 'I skogen', 'Attefallshus', 'Kontor', 'Ateljé i skogen bakom huset.', -0.02, 'ny', 'Webbformulär']
    ];
    F.forEach(function (f) {
      var k = kunder[f[0]];
      db.forfragningar.push({
        id: nid('forfragan', 'f'), skapad: dagar(f[5], 9 + (f[0] % 7)), status: f[6], kalla: f[7],
        miljo: f[1], hustyp: f[2], anvandning: f[3], beskrivning: f[4],
        namn: k.namn, telefon: k.telefon, epost: k.epost, ort: k.ort,
        kund: f[6] === 'kvalificerad' || f[6] === 'kontaktad' ? k.id : null, affar: null,
        tilldelad: f[6] === 'ny' ? null : 'ml', last: f[6] !== 'ny'
      });
    });

    // Affärerna på säljtavlan.
    var A = [
      [3, 'r3', 'kontakt', 695000, -2, 'Kupa 38 vid havet'],
      [4, 'r2', 'besok', 423000, -3, 'Sadel 26 som kontor'],
      [6, 'r4', 'offert', 868000, -5, 'Kupa 45, året runt'],
      [7, 'r1', 'forhandling', 612000, -7, 'Sadel 27 med kök och bad'],
      [8, 'element', 'offert', 2640000, -8, 'Husblock, 12 tomter'],
      [10, 'r5', 'kontakt', 470000, -10, 'Pulpet 27 i Falun'],
      [11, 'r2', 'besok', 1580000, -14, 'Fyra Sadel 26 för uthyrning'],
      [5, 'r5', 'ny', 445000, -4, 'Hus utanför detaljplan'],
      [13, 'r1', 'vunnen', 498000, -26, 'Sadel 27 i Vallentuna'],
      [2, 'r3', 'vunnen', 765000, -40, 'Kupa 38 i Åre'],
      [0, 'r2', 'vunnen', 441000, -58, 'Sadel 26 vid sjön'],
      [9, 'r1', 'forlorad', 452000, -30, 'Sommarhus på Orust']
    ];
    A.forEach(function (a, i) {
      var k = kunder[a[0]];
      var aff = {
        id: nid('affar', 'a'), kund: k.id, titel: a[5], modell: a[1], varde: a[3],
        steg: a[2] === 'forlorad' ? 'offert' : a[2], forlorad: a[2] === 'forlorad' ? { orsak: 'Tomten passade inte', tid: dagar(a[4] + 6) } : null,
        skapad: dagar(a[4] - 6), andrad: dagar(a[4] + (a[2] === 'vunnen' ? 2 : 0)),
        ansvarig: 'ml', vunnen: a[2] === 'vunnen' ? dagar(a[4] + 2) : null
      };
      db.affarer.push(aff);
      // Förfrågan som blev affären.
      db.forfragningar.forEach(function (f) { if (f.kund === k.id && f.status === 'kvalificerad' && !f.affar) f.affar = aff.id; });
      if (a[2] === 'offert' || a[2] === 'forhandling' || a[2] === 'vunnen') {
        var m = IH.modell(a[1]);
        var rader = [{ text: m.kategori + ' ' + m.namn + (m.yta ? ', ' + m.yta + ' m²' : ''), antal: a[1] === 'element' ? 12 : 1,
          pris: a[1] === 'element' ? 185000 : db.prislista.modeller[a[1]] }];
        rader.push({ text: 'Frakt till tomten', antal: 1, pris: 28000 });
        rader.push({ text: 'Montage på plats', antal: 1, pris: 45000 });
        if (i % 2) rader.push({ text: 'Altan i trä, 12 m²', antal: 1, pris: 38000 });
        db.lopnr.offert += 1;
        db.offerter.push({ id: 'o' + db.lopnr.offert, nummer: 'IH-' + new Date().getFullYear() + '-' + db.lopnr.offert,
          affar: aff.id, kund: k.id, modell: a[1], rader: rader,
          status: a[2] === 'vunnen' ? 'godkand' : 'skickad', skapad: dagar(a[4] - 1), giltig: 30 });
      }
    });

    // Projekt för vunna affärer.
    var P = [['a9', 'tillverkning', -20, 3], ['a10', 'montage', -34, 1], ['a11', 'klart', -52, 0]];
    P.forEach(function (p, i) {
      var aff = db.affarer.filter(function (x) { return x.id === p[0]; })[0];
      if (!aff) return;
      db.projekt.push({ id: nid('projekt', 'p'), affar: aff.id, kund: aff.kund, modell: aff.modell, steg: p[1],
        start: dagar(p[2]), montage: dagar(p[2] + 70 - i * 20), andrad: dagar(-p[3]),
        check: { ritning: true, lov: i !== 0, grund: i !== 0, framkomlighet: i === 2 } });
    });

    // Aktiviteter och att göra.
    function akt(dag, typ, text, kund, affar) {
      db.aktiviteter.push({ id: nid('aktivitet', 'h'), tid: dagar(dag, 11), typ: typ, text: text, kund: kund, affar: affar, av: 'ml' });
    }
    akt(-2, 'samtal', 'Ringde och gick igenom strandskyddet. Skickar karta över tomten.', 'k4', 'a1');
    akt(-3, 'mote', 'Platsbesök bokat till nästa vecka.', 'k5', 'a2');
    akt(-5, 'mejl', 'Offert skickad för Kupa 45.', 'k7', 'a3');
    akt(-7, 'samtal', 'Vill förhandla om altanen. Återkommer med nytt förslag.', 'k8', 'a4');
    akt(-8, 'mote', 'Digitalt möte om husblock för tolv tomter.', 'k9', 'a5');
    akt(-26, 'system', 'Order signerad.', 'k14', 'a9');
    function uppg(dag, text, kund, affar, klar) {
      db.uppgifter.push({ id: nid('uppgift', 'u'), text: text, forfaller: dagar(dag, 9), klar: !!klar, kund: kund, affar: affar, ansvarig: 'ml' });
    }
    uppg(0, 'Ring Karin Holm om sjötomten', 'k1', null);
    uppg(0, 'Ring Henrik Dahl om ateljén', 'k13', null);
    uppg(1, 'Skicka reviderad offert till Anna Forsberg', 'k8', 'a4');
    uppg(3, 'Platsbesök hos Johan Berg', 'k5', 'a2');
    uppg(-1, 'Boka montage med kranbil', 'k14', 'a9', true);
    return db;
  };

  /* --- Hjälpare ------------------------------------------------------- */
  IH.kr = function (n) {
    n = Math.round(n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr';
  };
  IH.kort = function (n) {
    n = n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' Mkr';
    if (n >= 1e3) return Math.round(n / 1e3) + ' tkr';
    return Math.round(n) + ' kr';
  };
  IH.summaOffert = function (o) {
    return (o && o.rader || []).reduce(function (s, r) { return s + (Number(r.pris) || 0) * (Number(r.antal) || 0); }, 0);
  };
})();
