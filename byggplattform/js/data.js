/* Byggplattformen – exempeldata.
   Allt här är EXEMPEL för prototypen: företag, personer, projekt,
   recept och priser är påhittade och ska ersättas med riktiga uppgifter.
   Undantaget är husmodellerna, som är Idealhus fem riktiga modeller
   (yttermått, nockhöjd och taklutning ur ritningarna R1–R5). */
(function (rot) {
  'use strict';

  /* --- Material ------------------------------------------------------------
     pris = exempelpris i kr per enhet (eller per förpackning). spill i %.
     kapas = räknas i bitar och kapoptimeras mot standardlängder. */
  var MATERIAL = {
    'regel-45x170': { namn: 'Regel 45 × 170 C24', grupp: 'Stomme', enhet: 'm', pris: 62, kapas: true, artikel: 'EX-1001' },
    'regel-45x70': { namn: 'Regel 45 × 70 C24', grupp: 'Stomme', enhet: 'm', pris: 24, kapas: true, artikel: 'EX-1002' },
    'regel-45x195': { namn: 'Golvbjälke 45 × 195 C24', grupp: 'Stomme', enhet: 'm', pris: 74, kapas: true, artikel: 'EX-1003' },
    'takstol': { namn: 'Takstol, färdig (enligt ritning)', grupp: 'Tak', enhet: 'st', pris: 1450, artikel: 'EX-2001' },
    'sparr-45x220': { namn: 'Takbalk 45 × 220 C24', grupp: 'Tak', enhet: 'm', pris: 89, kapas: true, artikel: 'EX-2002' },
    'mineralull-170': { namn: 'Mineralull 170 mm', grupp: 'Isolering', enhet: 'm²', pris: 118, spill: 5, artikel: 'EX-3001', forpackning: { namn: 'paket', innehall: 3.6 } },
    'mineralull-70': { namn: 'Mineralull 70 mm', grupp: 'Isolering', enhet: 'm²', pris: 52, spill: 5, artikel: 'EX-3002', forpackning: { namn: 'paket', innehall: 7.2 } },
    'mineralull-195': { namn: 'Mineralull 195 mm', grupp: 'Isolering', enhet: 'm²', pris: 132, spill: 5, artikel: 'EX-3003', forpackning: { namn: 'paket', innehall: 3.0 } },
    'plastfolie': { namn: 'Ångspärr PE 0,2 mm', grupp: 'Isolering', enhet: 'm²', pris: 9, spill: 10, artikel: 'EX-3101', forpackning: { namn: 'rulle', innehall: 75 } },
    'vindskydd': { namn: 'Vindskyddsduk', grupp: 'Isolering', enhet: 'm²', pris: 14, spill: 10, artikel: 'EX-3102', forpackning: { namn: 'rulle', innehall: 75 } },
    'gips-13': { namn: 'Gipsskiva 13 mm 1200 × 2700', grupp: 'Skivor', enhet: 'st', pris: 129, artikel: 'EX-4001' },
    'golvspan-22': { namn: 'Golvspånskiva 22 mm 600 × 2400', grupp: 'Skivor', enhet: 'st', pris: 189, artikel: 'EX-4002' },
    'osb-12': { namn: 'Takskiva OSB 12 mm 1200 × 2400', grupp: 'Tak', enhet: 'st', pris: 239, artikel: 'EX-4003' },
    'rasponst-23': { namn: 'Råspont 23 × 95', grupp: 'Tak', enhet: 'm', pris: 16, spill: 8, artikel: 'EX-2101' },
    'underlagspapp': { namn: 'Underlagspapp', grupp: 'Tak', enhet: 'm²', pris: 38, spill: 15, artikel: 'EX-2102', forpackning: { namn: 'rulle', innehall: 15 } },
    'bararlakt': { namn: 'Bärläkt 25 × 38', grupp: 'Tak', enhet: 'm', pris: 8, spill: 10, artikel: 'EX-2103' },
    'stroläkt': { namn: 'Ströläkt 25 × 45', grupp: 'Tak', enhet: 'm', pris: 9, spill: 10, artikel: 'EX-2104' },
    'takplat': { namn: 'Takplåt, profilerad', grupp: 'Tak', enhet: 'm²', pris: 189, spill: 6, artikel: 'EX-2201' },
    'takpapp-pulpet': { namn: 'Ytpapp, svetsbar', grupp: 'Tak', enhet: 'm²', pris: 96, spill: 12, artikel: 'EX-2202', forpackning: { namn: 'rulle', innehall: 7.5 } },
    'nockplat': { namn: 'Nockplåt', grupp: 'Tak', enhet: 'm', pris: 145, spill: 5, artikel: 'EX-2203' },
    'vindskiva': { namn: 'Vindskiva 22 × 145', grupp: 'Tak', enhet: 'm', pris: 34, spill: 10, artikel: 'EX-2204' },
    'hangranna': { namn: 'Hängränna 125 mm', grupp: 'Tak', enhet: 'm', pris: 165, spill: 5, artikel: 'EX-2301' },
    'lakt-28x70': { namn: 'Spikläkt 28 × 70', grupp: 'Fasad', enhet: 'm', pris: 14, kapas: true, artikel: 'EX-5001' },
    'panel-22': { namn: 'Ytterpanel 22 × 145, grundmålad', grupp: 'Fasad', enhet: 'm', pris: 39, spill: 10, artikel: 'EX-5002' },
    'fonster': { namn: 'Fönster, 2-luft (enligt ritning)', grupp: 'Fönster och dörrar', enhet: 'st', pris: 6900, artikel: 'EX-6001' },
    'dorr': { namn: 'Ytterdörr (enligt ritning)', grupp: 'Fönster och dörrar', enhet: 'st', pris: 11900, artikel: 'EX-6002' },
    'innerdorr': { namn: 'Innerdörr med karm', grupp: 'Fönster och dörrar', enhet: 'st', pris: 2490, artikel: 'EX-6003' },
    'foder': { namn: 'Foder och smyg', grupp: 'Fönster och dörrar', enhet: 'sats', pris: 420, artikel: 'EX-6101' },
    'spik-90': { namn: 'Trådspik 90 mm', grupp: 'Fästdon', enhet: 'kg', pris: 64, artikel: 'EX-7001', forpackning: { namn: 'låda', innehall: 5 } },
    'gipsskruv': { namn: 'Gipsskruv 3,9 × 41', grupp: 'Fästdon', enhet: 'st', pris: 395, artikel: 'EX-7002', forpackning: { namn: 'ask', innehall: 1000 } },
    'panelspik': { namn: 'Panelspik, varmförzinkad', grupp: 'Fästdon', enhet: 'kg', pris: 98, artikel: 'EX-7003', forpackning: { namn: 'låda', innehall: 2.5 } },
    'plint': { namn: 'Plintform Ø 250 med armering', grupp: 'Grund', enhet: 'st', pris: 285, artikel: 'EX-8001' },
    'betong': { namn: 'Betong C25/30', grupp: 'Grund', enhet: 'm³', pris: 2150, spill: 8, artikel: 'EX-8002' },
    'balk-90x225': { namn: 'Limträbalk 90 × 225', grupp: 'Grund', enhet: 'm', pris: 285, kapas: true, langder: [3.0, 4.2, 5.4, 6.0, 7.2, 8.4, 9.6, 10.8, 12.0, 13.2], artikel: 'EX-8003' },
    'syllpapp': { namn: 'Syllisolering', grupp: 'Grund', enhet: 'm', pris: 7, spill: 5, artikel: 'EX-8004', forpackning: { namn: 'rulle', innehall: 25 } }
  };

  /* --- Recept ----------------------------------------------------------------
     Uppbyggnaden av en byggdel, inifrån och ut. Varje rad säger hur mängden
     räknas (regel) – samma fasta fält i varje recept. */
  var RECEPT = {
    'yttervagg-170': {
      namn: 'Yttervägg 170, stående panel', typ: 'vagg', tjocklek: 0.245,
      skikt: ['Gips 13', 'Ångspärr', 'Regel 45 × 170 c600 + mineralull', 'Vindskydd', 'Läkt 28 × 70', 'Panel 22 × 145'],
      rader: [
        { material: 'regel-45x170', regel: 'langs', antal: 2, not: 'Syll och hammarband' },
        { material: 'regel-45x170', regel: 'reglar', cc: 0.6, avdrag: 0.09, extraPerOppning: 2, not: 'Stående reglar' },
        { material: 'mineralull-170', regel: 'yta' },
        { material: 'plastfolie', regel: 'yta' },
        { material: 'vindskydd', regel: 'yta' },
        { material: 'gips-13', regel: 'skivor', format: { bredd: 1.2, langd: 2.7 } },
        { material: 'lakt-28x70', regel: 'reglar', cc: 0.6, avdrag: 0 },
        { material: 'panel-22', regel: 'lopmeterYta', tackbredd: 0.12 },
        { material: 'fonster', regel: 'perOppning', bara: 'fonster' },
        { material: 'dorr', regel: 'perOppning', bara: 'dorr' },
        { material: 'foder', regel: 'perOppning' },
        { material: 'spik-90', regel: 'perYta', per: 12, enhet: 'kg' },
        { material: 'gipsskruv', regel: 'perYta', per: 0.04, enhet: 'st' },
        { material: 'panelspik', regel: 'perYta', per: 10, enhet: 'kg' }
      ]
    },
    'innervagg-70': {
      namn: 'Innervägg 70, gips två sidor', typ: 'vagg', tjocklek: 0.096,
      skikt: ['Gips 13', 'Regel 45 × 70 c600 + mineralull', 'Gips 13'],
      rader: [
        { material: 'regel-45x70', regel: 'langs', antal: 2 },
        { material: 'regel-45x70', regel: 'reglar', cc: 0.6, avdrag: 0.09, extraPerOppning: 2 },
        { material: 'mineralull-70', regel: 'yta' },
        { material: 'gips-13', regel: 'skivor', format: { bredd: 1.2, langd: 2.7 }, sidor: 2 },
        { material: 'innerdorr', regel: 'perOppning', bara: 'dorr' },
        { material: 'gipsskruv', regel: 'perYta', per: 0.02, enhet: 'st' }
      ]
    },
    'golv-195': {
      namn: 'Golvbjälklag 195 på balkar', typ: 'bjalklag', tjocklek: 0.24,
      skikt: ['Golvspånskiva 22', 'Ångspärr', 'Bjälke 45 × 195 c600 + mineralull', 'Vindskydd'],
      rader: [
        { material: 'regel-45x195', regel: 'tvars', cc: 0.6 },
        { material: 'regel-45x195', regel: 'langs', antal: 1, not: 'Kantbalk runt om' },
        { material: 'mineralull-195', regel: 'yta' },
        { material: 'plastfolie', regel: 'yta' },
        { material: 'vindskydd', regel: 'yta' },
        { material: 'golvspan-22', regel: 'skivor', format: { bredd: 0.6, langd: 2.4 } },
        { material: 'spik-90', regel: 'perYta', per: 15, enhet: 'kg' }
      ]
    },
    'tak-sadel': {
      namn: 'Sadeltak, plåt på läkt', typ: 'tak',
      skikt: ['Takstolar c1200', 'Råspont 23', 'Underlagspapp', 'Ströläkt', 'Bärläkt', 'Takplåt'],
      rader: [
        { material: 'takstol', regel: 'takstolar', cc: 1.2 },
        { material: 'rasponst-23', regel: 'lopmeterYta', tackbredd: 0.087 },
        { material: 'underlagspapp', regel: 'yta', faktor: 1 },
        { material: 'stroläkt', regel: 'lopmeterYta', tackbredd: 0.6 },
        { material: 'bararlakt', regel: 'lopmeterYta', tackbredd: 0.35 },
        { material: 'takplat', regel: 'yta' },
        { material: 'nockplat', regel: 'langs', langs: 'nock' },
        { material: 'vindskiva', regel: 'langs', langs: 'gavel' },
        { material: 'hangranna', regel: 'langs', langs: 'takfot' }
      ]
    },
    'tak-pulpet': {
      namn: 'Pulpettak, papp på takskiva', typ: 'tak',
      skikt: ['Takbalkar c600', 'Takskiva OSB 12', 'Underlagspapp', 'Ytpapp'],
      rader: [
        { material: 'sparr-45x220', regel: 'tvars', cc: 0.6, spann: 'sparr' },
        { material: 'osb-12', regel: 'skivor', format: { bredd: 1.2, langd: 2.4 } },
        { material: 'underlagspapp', regel: 'yta' },
        { material: 'takpapp-pulpet', regel: 'yta' },
        { material: 'vindskiva', regel: 'langs', langs: 'gavel' },
        { material: 'hangranna', regel: 'langs', langs: 'takfot', antal: 1 }
      ]
    },
    'plintgrund': {
      namn: 'Plintgrund med limträbalkar', typ: 'grund',
      skikt: ['Plintar Ø 250 c ≤ 2,0 m', 'Limträbalk 90 × 225', 'Syllisolering'],
      rader: [
        { material: 'plint', regel: 'plintar', cc: 2.0 },
        { material: 'betong', regel: 'plintar', cc: 2.0, faktor: 0.06, enhet: 'm³' },
        { material: 'balk-90x225', regel: 'langs', antal: 1 },
        { material: 'syllpapp', regel: 'langs', antal: 1 }
      ]
    }
  };

  /* --- Husmodeller (Idealhus, riktiga mått) ---------------------------------- */
  var HUS = [
    { id: 'sadel-30', namn: 'Sadel 30', kategori: 'Attefallshus', yta: 30, rum: 1, langd: 8.33, bredd: 3.49, nock: 4.0, tak: 'sadel', lutning: 30, bild: 'bilder/hus-r2.webp', modell: 'modeller/hus-r2.glb', leverantor: 'Idealhus', text: 'Ett rum under ett brant sadeltak. Smal form som får plats längs en tomtgräns.' },
    { id: 'sadel-30-bred', namn: 'Sadel 30 Bred', kategori: 'Attefallshus', yta: 30, rum: 2, langd: 7.14, bredd: 4.20, nock: 4.0, tak: 'sadel', lutning: 24, bild: 'bilder/hus-r1.webp', modell: 'modeller/hus-r1.glb', leverantor: 'Idealhus', text: 'Två rum under sadeltak – sovrum och allrum.', innervaggar: 4.2 },
    { id: 'pulpet-30', namn: 'Pulpet 30', kategori: 'Attefallshus', yta: 30, rum: 2, langd: 7.50, bredd: 4.00, nock: 4.0, tak: 'pulpet', lutning: 2, bild: 'bilder/hus-r5.webp', modell: 'modeller/hus-r5.glb', leverantor: 'Idealhus', text: 'Två rum under ett nästan platt pulpettak, stora glaspartier.', innervaggar: 4.0 },
    { id: 'kupa-40', namn: 'Kupa 40', kategori: 'Fritidshus', yta: 40, rum: 2, langd: 10.83, bredd: 3.90, nock: 4.35, tak: 'sadel', lutning: null, bild: 'bilder/hus-r3.webp', modell: 'modeller/hus-r3.glb', leverantor: 'Idealhus', text: 'Fritidshus med takkupa och extra takhöjd. Kräver bygglov.', innervaggar: 3.9 },
    { id: 'kupa-50', namn: 'Kupa 50', kategori: 'Fritidshus', yta: 50, rum: 2, langd: 12.50, bredd: 3.90, nock: 4.05, tak: 'sadel', lutning: null, bild: 'bilder/hus-r4.webp', modell: 'modeller/hus-r4.glb', leverantor: 'Idealhus', text: 'Det största huset, med takkupa. Kräver bygglov.', innervaggar: 3.9 }
  ];

  /* --- Tillval (exempel) ------------------------------------------------------ */
  var TILLVAL = [
    { id: 'fasad', namn: 'Fasadfärg', typ: 'farg', val: [
      { id: 'svart', namn: 'Tjärsvart', farg: '#1d1c1a', pris: 0 },
      { id: 'falu', namn: 'Falu rödfärg', farg: '#7b2a20', pris: 0 },
      { id: 'gra', namn: 'Grå', farg: '#7c7f7c', pris: 0 },
      { id: 'vit', namn: 'Vit', farg: '#ecebe6', pris: 2900 }
    ] },
    { id: 'tak', namn: 'Takmaterial', typ: 'lista', val: [
      { id: 'plat', namn: 'Profilerad plåt', pris: 0 },
      { id: 'papp', namn: 'Papp', pris: -4500 },
      { id: 'sedum', namn: 'Sedumtak', pris: 38000 }
    ] },
    { id: 'altan', namn: 'Altan', typ: 'lista', val: [
      { id: 'ingen', namn: 'Ingen', pris: 0 },
      { id: 'a12', namn: 'Altan 12 m² i trä', pris: 38000 },
      { id: 'a20', namn: 'Altan 20 m² i trä', pris: 59000 }
    ] },
    { id: 'invandig', namn: 'Invändigt', typ: 'lista', val: [
      { id: 'gips', namn: 'Gips, målad', pris: 0 },
      { id: 'panel', namn: 'Träpanel, lackad', pris: 14500 }
    ] }
  ];

  /* --- Exempelföretag, personer och projekt ---------------------------------- */
  var ROLLER = [
    { id: 'bygg', namn: 'Byggföretag', foretag: 'Exempel Bygg AB', person: 'Lina Berg', titel: 'Kalkylator' },
    { id: 'leverantor', namn: 'Husleverantör', foretag: 'Exempel Hus AB', person: 'Omar Said', titel: 'Säljare' },
    { id: 'handel', namn: 'Bygghandel', foretag: 'Exempel Bygghandel', person: 'Karin Ek', titel: 'Proffssäljare' },
    { id: 'konsument', namn: 'Konsument', foretag: '', person: 'Erik Holm', titel: 'Privatperson' }
  ];

  var PROJEKT = [
    { id: 'p1', namn: 'Attefallshus, Exempelvägen 4', kund: 'Anna och Johan Lund', ort: 'Uppsala', hus: 'sadel-30-bred', steg: 'mangd', skapad: -9, deltagare: ['Lina Berg', 'Anna Lund', 'Exempel Bygghandel'], tillval: { fasad: 'falu', tak: 'plat', altan: 'a12', invandig: 'gips' } },
    { id: 'p2', namn: 'Fritidshus vid sjön', kund: 'Maria Sund', ort: 'Leksand', hus: 'kupa-40', steg: 'offert', skapad: -21, deltagare: ['Lina Berg', 'Maria Sund', 'Exempel Konstruktion'], tillval: { fasad: 'svart', tak: 'plat', altan: 'a20', invandig: 'panel' } },
    { id: 'p3', namn: 'Ateljé i trädgården', kund: 'Peter Nyman', ort: 'Västerås', hus: 'pulpet-30', steg: 'underlag', skapad: -2, deltagare: ['Lina Berg', 'Peter Nyman'], tillval: { fasad: 'gra', tak: 'papp', altan: 'ingen', invandig: 'gips' } },
    { id: 'p4', namn: 'Gästhus, Exempelgatan 12', kund: 'Sara Wik', ort: 'Örebro', hus: 'sadel-30', steg: 'order', skapad: -48, deltagare: ['Lina Berg', 'Sara Wik', 'Exempel Bygghandel'], tillval: { fasad: 'svart', tak: 'plat', altan: 'ingen', invandig: 'gips' } }
  ];

  var STEG = [
    { id: 'underlag', namn: 'Underlag' },
    { id: 'mangd', namn: 'Mängd' },
    { id: 'offert', namn: 'Offert' },
    { id: 'order', namn: 'Order' }
  ];

  var KONSULTER = [
    { id: 'arkitekt', namn: 'Arkitekt', text: 'Bygglovsritningar och anpassning av en modell.', leverans: 'Exempel: 10 arbetsdagar' },
    { id: 'konstruktion', namn: 'Konstruktion', text: 'Konstruktionsberäkning av stomme och grund.', leverans: 'Exempel: 7 arbetsdagar' },
    { id: 'energi', namn: 'Energiberäkning', text: 'Energiberäkning för bygglov och slutsamråd.', leverans: 'Exempel: 5 arbetsdagar' },
    { id: 'ka', namn: 'Kontrollansvarig', text: 'Certifierad KA för kontrollplan och samråd.', leverans: 'Exempel: enligt överenskommelse' }
  ];

  rot.BP_DATA = { MATERIAL: MATERIAL, RECEPT: RECEPT, HUS: HUS, TILLVAL: TILLVAL, ROLLER: ROLLER, PROJEKT: PROJEKT, STEG: STEG, KONSULTER: KONSULTER };
  if (typeof module !== 'undefined' && module.exports) module.exports = rot.BP_DATA;
})(typeof window !== 'undefined' ? window : this);
