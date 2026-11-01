/* ============================================================
   Legohus CRM – turerna och kurserna (data till IH.guide), omgjord 2026-11-01.
   Kort och enkelt: 4–7 steg per tur och en tanke per steg.
   En tur: { id, namn, beskrivning, grupp, vy (sidan den hör till), vyDel,
   roller, nasta, ovning, steg }. ovning: true = körs mot en kopia av datan
   och allt återställs när turen slutar.
   Ett steg: { sida, mal, rubrik, text, ... }
     sida   – adressen steget visas på (#/…), eller en funktion
     mal    – väljare, lista (första synliga vinner) eller funktion
     vanta  – användaren klickar själv på det markerade (Prova själv)
     prova  – användaren gör något i det markerade; klar(ctx) säger när det är gjort
     gor    – uppmaningen i Prova själv · bra – berömmet · gorSjalv – "Gör det åt mig"
     fri    – man får klicka och skriva i det markerade
     fyll   – { väljare: värde } som "Fyll i exempel" skriver in
     fallUt – menyn fälls ut om den är infälld
     om     – funktion; steget hoppas över när den ger false
     valfri – hoppas över snabbt om målet saknas (alla mål hoppas över tyst till slut)
   Allt som beskrivs finns i CRM:et (se KUNSKAP.md). Data i CRM:et är exempel.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  if (!IH.guide || !IH.guide.registrera) { console.warn('turer.js: ladda guide.js först'); return; }

  /* --- Hjälpare -------------------------------------------------------- */
  var db = function () { return IH.db || {}; };
  var jagId = function () { return IH.jag ? IH.jag().id : null; };
  var antal = function (k) { return (db()[k] || []).length; };
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var pil = function (d, namn) { return '<svg viewBox="0 0 24 24" width="11" height="11" role="img" aria-label="' + namn + '" style="fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + d + '"/></svg>'; };
  var PV = pil('M19 12H5M11 6l-6 6 6 6', 'vänsterpil'), PH = pil('M5 12h14M13 6l6 6-6 6', 'högerpil');
  var CK = '<kbd>' + (MAC ? '⌘' : 'Ctrl') + '</kbd> <kbd>K</kbd>';
  var lage = function () { return IH.layout ? IH.layout() : 'full'; };
  var inteMin = function () { return lage() !== 'minimal'; };
  var baraMin = function () { return lage() === 'minimal'; };
  var dator = function () { return window.innerWidth > 1100; };

  // Klockan: i sidomenyn, i toppraden eller i den infällda listen.
  var KLOCKA = ['.sido .ih-klocka', '.topp .ih-klocka', '.sido-rals__klocka'];
  var KONTO = ['.anv', '.topp__konto', '.mobilmeny [data-mer]'];
  // En sida i menyn: utfälld, infälld, mobilen. Ligger raden under Mer pekar guiden på Mer.
  function meny(vy) { return ['.sido__lank[data-vy="' + vy + '"]', '.sido-rals a[data-vy="' + vy + '"]', '.mobilmeny [data-vy="' + vy + '"]', '.sido__merknapp', '.mobilmeny [data-mer]']; }
  function paSida(re) { return function () { return re.test(location.hash); }; }
  // Kortet (eller sektionen) vars rubrik innehåller texten.
  function medRubrik(sel, text, rubrikSel) {
    return function () {
      var l = document.querySelectorAll(sel);
      for (var i = 0; i < l.length; i++) {
        var h = l[i].querySelector(rubrikSel || 'h2, h3');
        if (h && h.textContent.replace(/\s+/g, ' ').indexOf(text) >= 0) return l[i];
      }
      return null;
    };
  }
  // Den första öppna affären i något av stegen (helst ens egen), annars vilken öppen som helst.
  function valjAffar(stegLista, utanOffert) {
    var l = (db().affarer || []).filter(function (a) { return !a.forlorad && a.steg !== 'vunnen'; });
    var passar = function (a) { return stegLista.indexOf(a.steg) >= 0 && (!utanOffert || !(IH.offertFor && IH.offertFor(a.id))); };
    var egna = l.filter(function (a) { return a.ansvarig === jagId(); });
    return (egna.filter(passar)[0] || l.filter(passar)[0] || egna[0] || l[0] || {}).id || null;
  }
  function kundMedAffar() {
    var a = (db().affarer || []).filter(function (x) { return !x.forlorad && x.steg !== 'vunnen'; });
    var egen = a.filter(function (x) { return x.ansvarig === jagId(); })[0] || a[0];
    return egen ? egen.kund : ((db().kunder || [])[0] || {}).id;
  }
  function projektFor(affarId) { var p = (db().projekt || []).filter(function (x) { return x.affar === affarId; })[0]; return p ? p.id : null; }
  function forstaProjekt() { var p = (db().projekt || []).filter(function (x) { return x.steg !== 'klart'; })[0] || (db().projekt || [])[0]; return p ? p.id : null; }
  var stangArk = function () { if (IH.stangArk) IH.stangArk(true); };

  // Dokumentsidan minns fliken (Arkiv/Mallar) – guiden börjar alltid i arkivet.
  var arkivKlick = 0;
  function iArkiv(sel) {
    return function () {
      var flik = document.querySelector('[data-g="dok-flik"][data-f="arkiv"]');
      var fack = document.querySelector('.dk-fack');
      var fackSyns = !!(fack && fack.getClientRects().length && getComputedStyle(fack).visibility !== 'hidden');
      // I Minimal är facken dolda – då räcker det att arkivfliken är vald och verktygsraden ritad
      var syns = fackSyns || !!(flik && flik.getAttribute('aria-selected') === 'true' && !(fack && fack.getClientRects().length) && document.querySelector('.dk-verktyg'));
      if (flik && !syns && Date.now() - arkivKlick > 1200) { arkivKlick = Date.now(); flik.click(); }
      return syns ? document.querySelector(sel) : null;
    };
  }

  var T = [];

  /* =====================================================================
     KOM IGÅNG
     ===================================================================== */
  T.push({
    id: 'valkommen', grupp: 'start', vy: 'oversikt-start', namn: 'Hitta i CRM:et', beskrivning: 'Menyn, sökningen och kontot.', nasta: 'oversikt',
    klarText: 'Nu hittar du runt. Fastnar du: fråga assistenten eller öppna boken vid menyn.',
    steg: [
      { sida: '#/', rubrik: 'Välkommen', text: 'Här samlas allt från första förfrågan till nyckeln. Allt du ser är <b>exempeldata</b>, så du kan prova fritt.' },
      { mal: ['.sido__nav', '.mobilmeny', '.sido-rals'], fallUt: true, rubrik: 'Menyn', placering: 'hoger', roller: ['salj'], text: '<b>Försäljning</b> är ditt dagliga arbete. <b>Bygg</b> är projekt och dokument. Längst ner finns det egna: meddelanden, att göra och inställningar.' },
      { mal: ['.sido__nav', '.mobilmeny', '.sido-rals'], fallUt: true, rubrik: 'Menyn', placering: 'hoger', roller: ['admin'], text: '<b>Ledning</b> är Kontrollcentral, Adminpanel och Säkerhet. Under <b>Teamet</b> går du in i en säljares konto.' },
      { mal: meny('salj'), rubrik: 'Byt sida', placering: 'hoger', roller: ['salj'], prova: true, klar: paSida(/^#\/salj/), gor: 'Klicka på Säljtavla', gorSjalv: function () { location.hash = '#/salj'; } },
      { mal: meny('kontroll'), rubrik: 'Byt sida', placering: 'hoger', roller: ['admin'], prova: true, klar: paSida(/^#\/kontroll/), gor: 'Klicka på Kontrollcentral', gorSjalv: function () { location.hash = '#/kontroll'; } },
      { mal: ['.sido__sok', '.topp .sok'], rubrik: 'Sök var du än är', placering: 'hoger', prova: true, efterKlick: 500,
        klar: function () { return document.documentElement.hasAttribute('data-palett-oppen'); }, gor: 'Tryck Ctrl K eller klicka på sökningen', gorSjalv: function () { IH.oppnaPalett(); },
        text: 'Sök på kund, affär eller offert, eller skriv ett kommando som <b>Ny kund</b>.' },
      { mal: '.palett', rubrik: 'Skriv vad du söker', fri: true, placering: 'under', text: 'Testa att skriva något. Enter öppnar första träffen.' },
      { fore: function () { if (IH.stangPalett) IH.stangPalett(true); }, mal: ['.sido__ny', '.topp [data-g="ny"]'], rubrik: 'Skapa nytt', roller: ['salj'], placering: 'hoger', text: 'Plusknappen eller tangenten <kbd>N</kbd> skapar förfrågan, kund, affär eller uppgift.' },
      { fore: function () { if (IH.stangPalett) IH.stangPalett(true); }, mal: KONTO, rubrik: 'Ditt konto', placering: 'hoger', text: 'Här finns status, profil, tema och layout. Klockan bredvid samlar påminnelser.' }
    ]
  });

  T.push({
    id: 'utseende', grupp: 'start', vy: 'installningar-utseende', namn: 'Teman och layout', beskrivning: 'Sex teman, tre layouter och den infällda menyn.', nasta: 'aviseringar',
    steg: [
      { sida: '#/installningar', fore: function (c) { c.tema0 = document.documentElement.getAttribute('data-tema'); }, mal: '.inst-tema', rubrik: 'Välj tema', placering: 'vanster', prova: true,
        klar: function (c) { return document.documentElement.getAttribute('data-tema') !== c.tema0; }, gor: 'Klicka på ett annat tema', bra: 'Snyggt, det sparas för ditt konto.',
        text: 'Sex teman plus Följ systemet. Bytet syns direkt.' },
      { mal: '.inst-layout', rubrik: 'Välj layout', fri: true, placering: 'vanster', text: '<b>Minimal</b> visar bara det du jobbar med. <b>Normal</b> ger överblick. <b>Full</b> visar allt, med bilder och 3D.' },
      { mal: KONTO, rubrik: 'Snabbare väg', placering: 'hoger', text: 'Tema och layout finns också i kontomenyn.' },
      { mal: ['.sido__sok', '.topp .sok'], rubrik: 'Eller sök', placering: 'hoger', text: 'Tryck ' + CK + ' och skriv <b>mörk</b> eller <b>minimal</b>.' },
      { mal: '[data-sido-knapp]', om: dator, rubrik: 'Fäll in menyn', placering: 'hoger', text: 'Knappen på kanten eller <kbd>[</kbd> ger mer plats. Sök, Ny och konto flyttar då upp.' }
    ]
  });

  T.push({
    id: 'aviseringar', grupp: 'start', vy: 'oversikt-aviseringar', namn: 'Aviseringar', beskrivning: 'Klockan, påminnelser och dagens sammanfattning.', nasta: 'oversikt',
    steg: [
      { sida: '#/', mal: KLOCKA, rubrik: 'Klockan', vanta: true, efterKlick: 600, placering: 'hoger', gor: 'Klicka på klockan', text: 'Siffran visar olästa aviseringar.' },
      { mal: '.ark .avis-panel', rubrik: 'Det som rör dig', behallArk: true, placering: 'vanster', text: 'Påminnelser och dagens sammanfattning. Klicka på en rad för att öppna det den gäller.' },
      { mal: '.ark .avis-fot', valfri: true, rubrik: 'På skrivbordet', behallArk: true, placering: 'vanster', text: '<b>Slå på</b> så syns påminnelser även när fliken inte är framme.' },
      { fore: stangArk, rubrik: 'Påminnelsen larmar', text: 'När en uppgift förfaller får du <b>Klar</b>, <b>+1 h</b> och <b>Öppna</b> direkt i meddelandet.' }
    ]
  });

  /* =====================================================================
     SIDORNA
     ===================================================================== */
  T.push({
    id: 'oversikt', grupp: 'sida', vy: 'oversikt', namn: 'Översikten', beskrivning: 'Dagens läge och vad du ska göra först.', nasta: 'forfragningar',
    steg: [
      { sida: '#/', mal: ['.hero__ord', '.ov-snabbt'], rubrik: 'Dagens läge', placering: 'hoger', text: 'Hälsningen sammanfattar dagen och föreslår nästa steg.' },
      { mal: ['.hero__snabb', '.ov-snabbt__ny'], valfri: true, rubrik: 'Snabbknappar', roller: ['salj'], text: 'Skapa förfrågan, kund, affär eller uppgift direkt.' },
      { mal: '.hero__kpi', om: inteMin, valfri: true, rubrik: 'Nyckeltalen', placering: 'hoger', text: 'Klicka på ett tal för att gå till sidan bakom det.' },
      { mal: medRubrik('.oversikt .kort', 'Fokus i dag'), valfri: true, rubrik: 'Fokus i dag', placering: 'vanster', text: 'CRM:et föreslår vad du bör göra först.' },
      { mal: medRubrik('.oversikt .kort', 'Att göra i dag'), valfri: true, rubrik: 'Att göra i dag', placering: 'vanster', text: 'Bocka av, skjut upp en dag eller ring kunden direkt från listan.' },
      { mal: medRubrik('.oversikt .kort', 'Senaste förfrågningar'), valfri: true, rubrik: 'Senaste förfrågningar', text: 'De senaste förfrågningarna. <b>Alla</b> tar dig till inkorgen.' }
    ]
  });

  T.push({
    id: 'forfragningar', grupp: 'sida', vy: 'forfragningar', roller: ['salj'], ovning: true, namn: 'Förfrågningar', beskrivning: 'Inkorgen, poängen och nästa bästa steg.', nasta: 'saljtavla',
    rollText: 'Gäller säljare. Gå in i en säljares konto via supportläget.',
    steg: [
      { sida: '#/forfragningar', mal: ['.ipuls', '.inkorg__filter'], rubrik: 'Läget', text: 'Hur många som väntar på svar och vem som väntat längst.' },
      { mal: '[data-g="simulera"]', valfri: true, rubrik: 'En ny förfrågan', vanta: true, efterKlick: 700, gor: 'Klicka på Simulera ny förfrågan', text: 'Så ser det ut när någon fyller i formuläret på hemsidan.' },
      { mal: '.inkorg__lista', rubrik: 'Inkorgen', placering: 'hoger', text: 'Nyast överst med poäng på varje rad. <kbd>J</kbd> och <kbd>K</kbd> bläddrar, <kbd>U</kbd> ger ett svarsutkast.' },
      { mal: '.nbs', rubrik: 'Nästa bästa steg', text: 'CRM:et säger vad du ska göra nu och hur lång tid som är kvar till svarsmålet på 24 timmar.' },
      { mal: '.inkorg__las .smart', valfri: true, rubrik: 'Poängen', text: 'Räknas fram ur svaren och texten. En fingervisning, inget facit.' },
      { mal: '.inkorg__las .guide', valfri: true, rubrik: 'Samtalsguiden', fri: true, text: 'Frågorna inför första samtalet. Bocka av medan du pratar.' }
    ]
  });

  T.push({
    id: 'saljtavla', grupp: 'sida', vy: 'salj', roller: ['salj'], ovning: true, namn: 'Säljtavlan', beskrivning: 'Stegen, filtren och korten.', nasta: 'affar',
    rollText: 'Gäller säljare. Gå in i en säljares konto via supportläget.',
    steg: [
      { sida: '#/salj', mal: ['.puls', '.tv-verktyg'], rubrik: 'Öppna affärer', text: 'Totalt värde, viktad prognos och vunnet senaste 90 dagarna.' },
      { mal: '.tv-verktyg', rubrik: 'Sök och filter', text: 'Visa <b>Mina</b>, filtrera på <b>Står still</b> och sortera på värde.' },
      { mal: '.tavla .spalt', rubrik: 'Sex säljsteg', placering: 'hoger', text: 'Ny förfrågan, Kontakt tagen, Platsbesök, Offert skickad, Förhandling och Order signerad. Varje spalt visar summan.' },
      { mal: '.tavla .aff', rubrik: 'Affärskortet', placering: 'hoger', text: 'Ringen visar chansen att vinna. Dra kortet mellan stegen, eller använd pilarna och Enter.' },
      { mal: ['.tavla .aff [data-g="aff-vidare"]'], valfri: true, rubrik: 'Flytta en affär', vanta: true, efterKlick: 700, gor: 'Klicka på Vidare', text: 'Affären går till nästa steg.' },
      { mal: '.tavla .aff', rubrik: 'Öppna affären', vanta: true, efterKlick: 600, gor: 'Klicka på kortet', klickaPa: '.tavla .aff' },
      { sida: function () { return /^#\/salj\/./.test(location.hash) ? location.hash : '#/salj/' + valjAffar(['offert', 'besok', 'kontakt']); }, mal: '.afhero', rubrik: 'Affärssidan', text: 'Allt om affären på en sida. Nästa kurssteg går igenom den.' }
    ]
  });

  T.push({
    id: 'affar', grupp: 'sida', vy: 'salj', vyDel: true, roller: ['salj'], ovning: true, namn: 'Affärssidan', beskrivning: 'Värde, nästa steg och historik.', nasta: 'kunder',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.affar = /^#\/salj\/./.test(location.hash) ? location.hash.split('/')[2] : valjAffar(['offert', 'besok', 'kontakt', 'forhandling']); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.afhero', rubrik: 'Affären', text: 'Värde, chans, dagar i steget och viktat värde.' },
      { mal: '.af-stegare', rubrik: 'Stegen', text: 'Klicka på ett steg för att flytta affären. Allt loggas.' },
      { mal: '.af-nasta', rubrik: 'Nästa bästa steg', text: 'Det viktigaste att göra nu, med knappen direkt.' },
      { mal: '[data-af="offert"]', valfri: true, rubrik: 'Offerten', text: 'Senaste offerten, eller <b>Skapa offert</b> om det saknas en.' },
      { mal: ['[data-af="historik"] form', '[data-af="historik"]'], rubrik: 'Logga en rad', prova: true, fore: function (c) { c.akt = antal('aktiviteter'); }, klar: function (c) { return antal('aktiviteter') > c.akt; },
        gor: 'Skriv en anteckning och spara', bra: 'Så enkelt. Den hamnar också på kundkortet.', text: 'Anteckning, samtal, mejl eller möte.' },
      { mal: '[data-af="atgarder"]', valfri: true, rubrik: 'Åtgärder', placering: 'vanster', text: 'Starta kundmöte, lägg en uppgift eller markera som förlorad.' }
    ]
  });

  T.push({
    id: 'kunder', grupp: 'sida', vy: 'kunder', roller: ['salj'], ovning: true, namn: 'Kunder', beskrivning: 'Kundregistret och en ny kund.', nasta: 'kundsida',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/kunder', mal: ['.kundtopp__ord', '.kundtopp'], rubrik: 'Kunderna', placering: 'hoger', text: 'Antal kunder och vilka som är varma just nu.' },
      { mal: '.kundverktyg', rubrik: 'Filter', text: 'Mina, Affär pågår, Företag och <b>Behöver uppmärksamhet</b>.' },
      { mal: '.kundnat .kundkort', valfri: true, rubrik: 'Kundkortet', placering: 'hoger', text: 'Snabbknappar för ring, mejl, kundmöte och ny affär.' },
      { mal: '[data-g="ny-kund"]', rubrik: 'Lägg till en kund', vanta: true, efterKlick: 600, gor: 'Klicka på Ny kund' },
      { mal: '#ny-kund-form', behallArk: true, rubrik: 'Fyll i och spara', prova: true, placering: 'vanster', fore: function (c) { c.kunder = antal('kunder'); }, klar: function (c) { return antal('kunder') > c.kunder; },
        fyll: { '#ny-kund-form input[name=namn]': 'Exempelkund Testsson', '#ny-kund-form input[name=ort]': 'Nacka' }, gor: 'Skriv ett namn och klicka på Spara kund', bra: 'Kunden är skapad.',
        gorSjalv: function (x) { var f = x.closest('form'); if (f) { var s = document.querySelector('.ark__fot [form="ny-kund-form"]'); if (s) s.click(); } } },
      { mal: '.kh', valfri: true, rubrik: 'Kundsidan', text: 'Här samlas allt om kunden. Eftersom det är en övning försvinner kunden när du är klar.' }
    ]
  });

  T.push({
    id: 'kundsida', grupp: 'sida', vy: 'kunder', vyDel: true, roller: ['salj'], namn: 'Kundsidan', beskrivning: 'Hälsan, affärerna och historiken.', nasta: 'flode-offert',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.kund = /^#\/kunder\/./.test(location.hash) ? location.hash.split('/')[2] : kundMedAffar(); },
    steg: [
      { sida: function (c) { return '#/kunder/' + c.kund; }, mal: '.kh__vem', rubrik: 'Kunden', text: 'Kontaktuppgifter och knappar för affär, uppgift och kundmöte.' },
      { mal: '.kh__halsa', valfri: true, rubrik: 'Kundhälsan', text: 'Ett tal 0–100. Grönt är varm relation, rött betyder att kunden behöver höra av er.' },
      { mal: '.kn', valfri: true, rubrik: 'Nästa steg', text: 'Det viktigaste att göra för kunden just nu.' },
      { mal: '.kg__vanster', valfri: true, rubrik: 'Allt som hör till kunden', placering: 'hoger', text: 'Huset, affärer, offerter och förfrågningar.' },
      { mal: '#kund-historik', rubrik: 'Historiken', placering: 'vanster', text: 'Logga med en rad. Anteckningar från kundmöten hamnar också här.' }
    ]
  });

  T.push({
    id: 'offerter', grupp: 'sida', vy: 'offerter', roller: ['salj'], namn: 'Offerter', beskrivning: 'Vad som väntar, går ut och följs upp.', nasta: 'offert',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/offerter', mal: ['.offtopp__ord', '.offtopp'], rubrik: 'Offertläget', placering: 'hoger', text: 'Vad som väntar på svar, träffsäkerhet och tid till ja.' },
      { mal: '.snartut', valfri: true, rubrik: 'Går ut snart', placering: 'vanster', text: '<b>Följ upp</b> ger ring, SMS och mejl. <b>+14 d</b> förlänger.' },
      { mal: '[data-g="offert-ny"]', valfri: true, rubrik: 'Ny offert', text: 'Välj affär så skapas offerten med hus, frakt och montage.' },
      { mal: '.kundverktyg', valfri: true, rubrik: 'Filter', text: 'Väntar på svar, Går ut snart, Godkända, Utkast och Avböjda.' },
      { mal: '.tabell--offert tbody tr', rubrik: 'Öppna en offert', vanta: true, efterKlick: 600, gor: 'Klicka på raden' },
      { sida: function () { return /^#\/offerter\/./.test(location.hash) ? location.hash : '#/offerter/' + ((db().offerter || [])[0] || {}).id; }, mal: '.vyhuvud', rubrik: 'Offerten', text: 'Nästa kurssteg går igenom offertsidan.' }
    ]
  });

  T.push({
    id: 'offert', grupp: 'sida', vy: 'offerter', vyDel: true, roller: ['salj'], namn: 'Offertsidan', beskrivning: 'Rader, status och utskrift.', nasta: 'flode-mote',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.offert = /^#\/offerter\/./.test(location.hash) ? location.hash.split('/')[2] : ((db().offerter || []).filter(function (o) { return o.status === 'skickad'; })[0] || (db().offerter || [])[0] || {}).id; },
    steg: [
      { sida: function (c) { return '#/offerter/' + c.offert; }, mal: '.vyhuvud', rubrik: 'Offerten', text: 'Länkar till affären och kunden, och <b>Skriv ut / PDF</b>.' },
      { mal: '.off-svar', valfri: true, rubrik: 'Vad sa kunden?', text: '<b>Kunden godkände</b> gör affären vunnen. <b>Kunden avböjde</b> markerar den som förlorad.' },
      { mal: '.ostatus', valfri: true, rubrik: 'Status', text: 'Utkast, Skickad, Godkänd. Ringen visar dagar kvar av 30.' },
      { mal: '.offertred', valfri: true, rubrik: 'Innehållet', placering: 'hoger', text: 'Ändra rader så följer summan och affärens värde med. En skickad offert ändrar du med <b>Ny version</b>.' },
      { mal: '.dokyta', valfri: true, rubrik: 'Så ser kunden den', placering: 'vanster', text: 'Det här dokumentet skrivs ut eller sparas som PDF.' }
    ]
  });

  T.push({
    id: 'dokument', grupp: 'sida', vy: 'dokument', roller: ['salj'], namn: 'Dokument och mallar', beskrivning: 'Arkivet, facken och mallarna.', nasta: 'att-gora',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/dokument', mal: iArkiv('.dk-hjalte__text'), rubrik: 'Dokumenten', placering: 'hoger', text: 'Allt på ett ställe. Växla mellan <b>Arkiv</b> och <b>Mallar</b>.' },
      { mal: iArkiv('.dk-fack'), om: inteMin, valfri: true, rubrik: 'Facken', text: 'Klicka för att filtrera, eller släpp en fil på facket.' },
      { mal: iArkiv('.dk-verktyg'), rubrik: 'Hitta rätt', text: 'Sök, välj år, sortering och gruppering.' },
      { mal: iArkiv('[data-g="dok-detalj"]'), rubrik: 'Öppna ett dokument', vanta: true, efterKlick: 600, gor: 'Klicka på raden' },
      { mal: '.ark .dkd', behallArk: true, valfri: true, rubrik: 'Detaljerna', text: 'Tidslinjen och knappar för förläng, påminn och ring.' },
      { fore: stangArk, mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Mallarna', vanta: true, efterKlick: 600, gor: 'Klicka på Mallar' },
      { mal: '.ml-grupp', valfri: true, rubrik: 'Sju mallar', text: '<b>Fyll i</b> väljer kund och skriver ut mallen ifylld.' }
    ]
  });

  T.push({
    id: 'kundmote', grupp: 'sida', vy: 'mote', roller: ['salj'], namn: 'Kundmöte', beskrivning: 'Förbered, välj upplägg och logga mötet.', nasta: 'presentation',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/mote', mal: ['.motescen__ord', '.motescen'], rubrik: 'Mötesrummet', placering: 'hoger', text: '<b>Starta presentation</b> öppnar bildspelet. <b>Bara kalkylen</b> går direkt till priset.' },
      { mal: medRubrik('.rutnat--mote .kort', 'Förbered mötet'), valfri: true, rubrik: 'Förbered', placering: 'hoger', text: 'Välj affär och upplägg: fullt, kort eller bara kalkylen.' },
      { mal: '.komm', valfri: true, rubrik: 'Kommande möten', placering: 'vanster', text: 'Här finns också <b>Boka videomöte</b> och <b>Alla videomöten</b>.' },
      { mal: '.logga-mote', valfri: true, rubrik: 'Logga mötet', placering: 'vanster', text: 'Skriv vad ni kom fram till. Nästa steg blir en uppgift.' }
    ]
  });

  T.push({
    id: 'presentation', grupp: 'sida', vy: 'mote-presentation', roller: ['salj'], ovning: true, namn: 'Presentationen', beskrivning: 'Bläddra, anteckna och räkna.', nasta: 'videomote',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/mote', mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta', vanta: true, efterKlick: 900, gor: 'Klicka på Starta presentation' },
      { mal: '.mote__botten', behallArk: true, tangenter: true, rubrik: 'Bläddra', text: 'Pilarna, prickarna eller <kbd>' + PV + '</kbd> <kbd>' + PH + '</kbd>.' },
      { mal: '.mote [data-mote="anteckna"]', rubrik: 'Anteckna', vanta: true, tangent: 'n', gor: 'Klicka här eller tryck N', text: 'Anteckningen sparas i kundens historik när mötet stängs.' },
      { mal: '.mote__prick[aria-label="Räkna på ert hus"]', rubrik: 'Kalkylen', vanta: true, tangent: 'k', efterKlick: 900, gor: 'Klicka här eller tryck K' },
      { mal: '.mote__bild[data-id="kalkyl"]', rubrik: 'Räkna tillsammans', fri: true, luft: -40, text: 'Välj hus och tillval. <b>Spara som offert</b> gör en offert på affären.' },
      { mal: '.mote [data-mote="stang"]', rubrik: 'Avsluta', vanta: true, efterKlick: 700, gor: 'Stäng presentationen' }
    ]
  });

  T.push({
    id: 'videomote', grupp: 'sida', vy: 'kunder', vyDel: true, roller: ['salj', 'chef'], ovning: true, namn: 'Boka videomöte', beskrivning: 'Boka och bjud in kunden med en länk.', nasta: 'videomoten',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.kund = /^#\/kunder\/./.test(location.hash) ? location.hash.split('/')[2] : kundMedAffar(); },
    steg: [
      { sida: function (c) { return '#/kunder/' + c.kund; }, mal: '.kh__knappar [data-g="vm-boka"]', rubrik: 'Boka', vanta: true, efterKlick: 500, gor: 'Klicka på Videomöte', text: 'Samma knapp finns på affären och under Kundmöte.' },
      { mal: '#vm-boka-form', rubrik: 'Dag, tid och gäster', behallArk: true, fri: true, placering: 'vanster', text: 'Kunden är redan inbjuden. Välj dag, tid och längd.' },
      { mal: '.ark__fot button[form="vm-boka-form"]', rubrik: 'Boka och bjud in', behallArk: true, vanta: true, efterKlick: 600, gor: 'Klicka på Boka och bjud in' },
      { mal: '.ark .vm-inbjudan', rubrik: 'Inbjudan', behallArk: true, placering: 'vanster', text: '<b>Kopiera länk</b> eller <b>Skicka inbjudan</b>. Kunden behöver inget konto.' },
      { fore: stangArk, rubrik: 'Väntrummet', text: 'När kunden öppnar länken får du en avisering. Klicka på <b>Släpp in</b>.' },
      { rubrik: 'Efter mötet', text: 'Skriv vad ni kom fram till. Det hamnar i kundens historik och nästa steg blir en uppgift.' }
    ]
  });

  T.push({
    id: 'videomoten', grupp: 'sida', vy: 'videomote', roller: ['salj'], namn: 'Alla videomöten', beskrivning: 'Listan, Starta nu och från chatten.', nasta: 'projekt',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/mote', mal: ['.komm__vm', '.komm'], valfri: true, rubrik: 'Under Kundmöte', text: '<b>Alla videomöten</b> öppnar listan.' },
      { sida: '#/videomote', mal: ['.vm-sidhuvud [data-g="vm-nytt"]', '.vm-sidhuvud'], rubrik: 'Nytt videomöte', text: 'Boka en tid eller tryck <b>Starta nu</b>.' },
      { mal: ['.vm-lista', '.vm-tomt'], valfri: true, rubrik: 'Kommande och senaste', text: 'Kommande möten har <b>Anslut</b>.' },
      { mal: '.vm-arlig', valfri: true, rubrik: 'Prototyp', text: 'Mötet fungerar mellan flikar i samma webbläsare. Mellan datorer krävs en server.' },
      { sida: '#/chatt', mal: '.ch-topp [data-g="vm-chatt-starta"]', valfri: true, rubrik: 'Från chatten', text: 'Kameran startar ett möte med alla i konversationen.' }
    ]
  });

  T.push({
    id: 'projekt', grupp: 'sida', vy: 'produktion', roller: ['salj'], ovning: true, namn: 'Projekt', beskrivning: 'Montage, checklistor och projekttavlan.', nasta: 'flode-dokument',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/produktion', mal: ['.prodtopp__intro', '.prodtopp'], rubrik: 'Husen på väg', text: 'Varje vunnen affär blir ett projekt här.' },
      { mal: '.prodblock--varn', valfri: true, rubrik: 'Att åtgärda', placering: 'vanster', text: 'Det som saknas före montaget. Bocka av direkt.' },
      { mal: '.kal', valfri: true, rubrik: 'Kalendern', text: 'Montage, uppgifter, möten och offerter som går ut.' },
      { mal: '.tavla--prod', valfri: true, rubrik: 'Projekttavlan', text: 'Från ritning och lov till klart. Pilen på kortet flyttar projektet.' },
      { mal: '.tavla--prod .aff--proj', rubrik: 'Öppna ett projekt', vanta: true, efterKlick: 700, gor: 'Klicka på ett projekt' },
      { mal: '.ark .projark__check', behallArk: true, fri: true, rubrik: 'Innan montaget', text: 'Checklistan för Legohus och kunden.' }
    ]
  });

  T.push({
    id: 'att-gora', grupp: 'sida', vy: 'att-gora', ovning: true, namn: 'Att göra', beskrivning: 'Lägg till, bocka av och skjut upp.', nasta: 'chatt',
    steg: [
      { sida: '#/att-gora', mal: ['.dagtopp', '.uppgrupp', '.agv'], rubrik: 'Dagen', text: 'Allt du ska göra, samlat på ett ställe.' },
      { mal: '.agk', om: inteMin, valfri: true, rubrik: 'Veckan', text: 'Vecka, två veckor eller månad. Plustecknet lägger en uppgift på dagen.' },
      { mal: '.nyuppg', rubrik: 'Lägg till en uppgift', prova: true, roller: ['salj'], fore: function (c) { c.uppg = antal('uppgifter'); }, klar: function (c) { return antal('uppgifter') > c.uppg; },
        fyll: { '.nyuppg input[name=text]': 'Ring Karin om tomten' }, gor: 'Skriv något och tryck Enter', bra: 'Uppgiften ligger i listan.',
        gorSjalv: function (x) { var k = x.querySelector('[type=submit]'); if (k) k.click(); else if (x.requestSubmit) x.requestSubmit(); } },
      { mal: '.uppgrupp', valfri: true, rubrik: 'Bocka av', text: 'Cirkeln bockar av. <b>+1 d</b> skjuter upp en dag.' },
      { mal: '.agv', valfri: true, rubrik: 'Filter', text: 'Sök, visa Mina eller Alla och filtrera på typ.' }
    ]
  });

  T.push({
    id: 'chatt', grupp: 'sida', vy: 'chatt', namn: 'Meddelanden', beskrivning: 'Teamchatten, svar och filer.', nasta: 'chatt-verktyg',
    steg: [
      { sida: '#/chatt', mal: '.ch-lista', rubrik: 'Konversationerna', placering: 'hoger', text: 'Teamet, privata konversationer och grupper.' },
      { mal: '.ch-topp', valfri: true, rubrik: 'Konversationen', text: 'Sök, tysta, se vilka som är med eller öppna i eget fönster.' },
      { mal: '.ch-trad', valfri: true, rubrik: 'Meddelandena', placering: 'vanster', text: 'Håll musen över ett meddelande för att reagera, svara eller göra om det till en uppgift.' },
      { mal: '.ch-fot', valfri: true, rubrik: 'Skriv', fri: true, text: '<b>@</b> nämner en kollega, <b>#</b> länkar en kund eller affär, <b>/</b> ger mallar.' }
    ]
  });

  function sistaMer() {
    var l = document.querySelectorAll('#vy .ch-trad [data-g="ch-mer"]');
    for (var n = l.length - 1; n >= 0; n--) if (l[n].getClientRects().length) return l[n];
    return null;
  }
  T.push({
    id: 'chatt-verktyg', grupp: 'sida', vy: 'chatt-verktyg', namn: 'Chattens verktyg', beskrivning: 'Uppgift av ett meddelande, fästa, söka och mallar.', nasta: 'profil',
    steg: [
      { sida: '#/chatt', mal: sistaMer, valfri: true, rubrik: 'Mer på ett meddelande', vanta: true, efterKlick: 500, gor: 'Klicka på Mer', text: 'Högerklick ger samma meny.' },
      { mal: '.ch-meny', valfri: true, rubrik: 'Gör något av meddelandet', placering: 'vanster', text: 'Svara, skapa uppgift, påminn mig, fäst eller kopiera.' },
      { mal: '.ch-topp [data-g="ch-sok-tradoppna"]', valfri: true, rubrik: 'Sök i konversationen', vanta: true, efterKlick: 400, gor: 'Klicka på förstoringsglaset' },
      { mal: '.ch-sokrad', valfri: true, rubrik: 'Hitta ett meddelande', fri: true, fyll: { '.ch-sokrad input': 'offert' }, text: 'Träffarna markeras i tråden.' },
      { mal: '.ch-fot', valfri: true, rubrik: 'Mallar', fri: true, text: 'Skriv <b>/</b> först i rutan. <kbd>Tab</kbd> hoppar till nästa fält.' },
      { rubrik: 'Tangenter', text: '<kbd>Ctrl</kbd>+<kbd>J</kbd> går till nästa olästa. <kbd>R</kbd> svarar, <kbd>T</kbd> gör en uppgift och <kbd>P</kbd> fäster.' }
    ]
  });

  T.push({
    id: 'profil', grupp: 'sida', vy: 'profil', namn: 'Min profil och kalender', beskrivning: 'Id-kortet, status och din kalender.', nasta: 'installningar',
    steg: [
      { sida: '#/profil', mal: '.lp-phjalte__vanster', rubrik: 'Ditt id-kort', placering: 'hoger', text: 'Namn, roll och status.' },
      { mal: '.lp-phjalte__tal', om: inteMin, valfri: true, rubrik: 'Dina nyckeltal', placering: 'vanster', text: 'Öppna affärer, viktad prognos och vunnet mot målet.' },
      { mal: medRubrik('.lp-band2', 'Aktivitet och arbete'), valfri: true, rubrik: 'Aktivitet och arbete', placering: 'vanster', text: 'Senaste 30 dagarna, dina affärer och uppgifter.' },
      { mal: '.pk', valfri: true, rubrik: 'Min kalender', roller: ['salj'], text: 'Klicka på en dag för att lägga till något. Här finns också frånvaro och kalenderfil.' }
    ]
  });

  T.push({
    id: 'installningar', grupp: 'sida', vy: 'installningar', namn: 'Inställningar', beskrivning: 'Utseende, mallar och prislistan.', nasta: 'flode-ny-kund',
    steg: [
      { sida: '#/installningar', mal: ['.inst-tema', '.instopp'], rubrik: 'Utseende', placering: 'vanster', text: 'Tema, glasdesign och layout.' },
      { mal: '.inst-mallar', valfri: true, rubrik: 'Mallar', text: 'Skriv texten en gång, så fylls kundens uppgifter i. CRM:et skickar inget självt.' },
      { mal: ['.instopp', '.prisform'], valfri: true, rubrik: 'Prislistan', text: 'Priserna bakom varje offert. I prototypen är de exempel.' },
      { mal: '.prisform', valfri: true, rubrik: 'Husen och tillvalen', placering: 'hoger', text: 'Nya offerter och kalkylen räknar med det du sparar här.' },
      { mal: '.installning__proto', valfri: true, rubrik: 'Sparas i webbläsaren', text: 'Prototypen sparar i den här webbläsaren.' }
    ]
  });

  /* =====================================================================
     LEDNING OCH ADMIN
     ===================================================================== */
  T.push({
    id: 'chef', grupp: 'admin', vy: 'chef', roller: ['chef'], namn: 'Försäljningsledning', beskrivning: 'Teamet, fördela förfrågningar och topplistan.',
    rollText: 'Gäller försäljningschefen.',
    steg: [
      { sida: '#/chef', mal: ['.ao-text', '.ap-hjalte'], rubrik: 'Så går teamet', text: 'Nytt konto, Sätt mål, Ge uppgift och Exportera rapport.' },
      { mal: '.ap-tal', valfri: true, rubrik: 'Nyckeltalen', text: 'Öppna affärer, viktad prognos, vunnet 90 dagar och vinstgrad.' },
      { mal: medRubrik('.ao-band', 'Teamet just nu'), valfri: true, rubrik: 'Teamet just nu', text: 'Status, affärer och mål för varje säljare.' },
      { mal: medRubrik('.ao-band', 'Vem jobbar när'), valfri: true, rubrik: 'Vem jobbar när', text: 'Närvaro och frånvaro vecka för vecka.' },
      { mal: medRubrik('.ao-band', 'Behöver din uppmärksamhet'), valfri: true, rubrik: 'Fördela förfrågningar', text: '<b>Fördela smart</b> ger jämnt till den som har minst öppet.' },
      { mal: medRubrik('.ao-band', 'Topplistan'), valfri: true, rubrik: 'Topplistan', placering: 'vanster', text: 'Vunnet per säljare: 30 dagar, 90 dagar eller i år.' }
    ]
  });

  T.push({
    id: 'kontroll', grupp: 'admin', vy: 'kontroll', roller: ['admin'], namn: 'Kontrollcentralen', beskrivning: 'Konton, skydd, data och drift i en blick.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/kontroll', mal: '.ao-hjalte', rubrik: 'Hela CRM:et i en blick', text: 'Säkerhet, konton, data och drift vägs ihop.' },
      { mal: medRubrik('.ao-band', 'Hur kontona mår'), valfri: true, rubrik: 'Kontona', text: 'Ett hälsotal per konto.' },
      { mal: medRubrik('.ao-band', 'Skyddet just nu'), valfri: true, rubrik: 'Skyddet', text: 'De sju kontrollerna och fynden.' },
      { mal: medRubrik('.ao-band', 'Datan och kopplingarna'), valfri: true, rubrik: 'Datan', text: 'Kvalitet, kopplingar och dubbletter.' },
      { mal: medRubrik('.ao-band', 'Bör åtgärdas'), valfri: true, rubrik: 'Bör åtgärdas', text: 'Förslag med knappen direkt.' }
    ]
  });

  T.push({
    id: 'adminpanel', grupp: 'admin', vy: 'admin', roller: ['admin'], namn: 'Adminpanelen', beskrivning: 'Konton, roller, data och loggen.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/admin', mal: '.ap-hjalte', rubrik: 'Kontrollrummet', text: 'Konton, poster, händelser och säkerhetspoäng.' },
      { mal: medRubrik('.ao-band', 'Konton och roller'), valfri: true, rubrik: 'Konton och roller', text: '<b>Ändra</b>, <b>Visa som</b> eller <b>Inaktivera</b> ett konto.' },
      { mal: medRubrik('.ao-band', 'Vem får göra vad'), om: inteMin, valfri: true, rubrik: 'Behörigheter', text: 'Vad Sälj, Chef, Produktion och Admin får göra.' },
      { mal: medRubrik('.ao-band', 'Data och system'), valfri: true, rubrik: 'Data och system', text: 'Exportera, importera och återställ. <b>Börja med tom data</b> inför skarp drift.' },
      { mal: medRubrik('.ao-band', 'Kundregistret'), valfri: true, rubrik: 'Kundregistret', text: 'Egna kundfält, förlustorsaker och gallring.' },
      { mal: function () { return medRubrik('.ao-band', 'Säkerhetsloggen')() || medRubrik('.ao-band', 'Granskning och ändringar')(); }, valfri: true, rubrik: 'Loggen', text: 'Vem ändrade vad och när.' }
    ]
  });

  T.push({
    id: 'sakerhet', grupp: 'admin', vy: 'sakerhet', roller: ['admin'], namn: 'Säkerhet', beskrivning: 'Sju kontroller och poängen över tid.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/sakerhet', mal: '.sh-hjalte', rubrik: 'Säkerhet i realtid', text: 'Poängen är 100 minus avdragen för fynd.' },
      { mal: '.sh-drift', valfri: true, rubrik: 'Driftläget', text: 'Händelser senaste sju dagarna och stoppade filer.' },
      { mal: '.sh-verktyg', valfri: true, rubrik: 'Verktyg', text: 'Rapport, automatisk skanning och behörigheter.' },
      { mal: medRubrik('section, .kort, .ad-band', 'Sju kontroller'), valfri: true, rubrik: 'Sju kontroller', text: 'Varje kontroll kan köras för sig.' },
      { mal: medRubrik('section, .kort, .ad-band', 'Poängen över tid'), valfri: true, rubrik: 'Poängen över tid', text: 'Varje skanning sparas så att du ser trenden.' }
    ]
  });

  T.push({
    id: 'supportlage', grupp: 'admin', vy: 'admin-support', roller: ['admin'], namn: 'Supportläget', beskrivning: 'Gå in i en säljares konto och hjälp till.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/kontroll', rubrik: 'Hjälpa en säljare', text: 'I supportläget ser du en säljares konto. Allt loggas.' },
      { mal: '.sido__konto', rubrik: 'Teamet', vanta: true, efterKlick: 900, placering: 'hoger', gor: 'Klicka på en säljare' },
      { mal: '.stod-band', rubrik: 'Du är i säljarens konto', text: 'Bandet visar alltid vems konto som är öppet.' },
      { mal: '.stod-band__ut', rubrik: 'Tillbaka till Admin', vanta: true, efterKlick: 700, gor: 'Klicka här eller tryck Shift Esc' }
    ]
  });

  /* =====================================================================
     FLÖDEN FRÅN START TILL SLUT (övningar)
     ===================================================================== */
  T.push({
    id: 'flode-ny-kund', grupp: 'flode', vy: 'flode-1', roller: ['salj'], ovning: true, namn: 'Från förfrågan till affär', beskrivning: 'Ta en ny kund hela vägen, steg för steg.', nasta: 'flode-offert',
    rollText: 'Gäller säljare. Gå in i en säljares konto via supportläget.',
    klarText: 'Du tog en förfrågan hela vägen till en affär på säljtavlan.',
    steg: [
      { sida: '#/forfragningar', mal: '[data-g="simulera"]', rubrik: 'En förfrågan kommer in', vanta: true, efterKlick: 700, gor: 'Klicka på Simulera ny förfrågan' },
      { mal: '.fd__huvud [data-g="f-tilldela"]', valfri: true, rubrik: 'Ta den', vanta: true, efterKlick: 500, gor: 'Klicka på Ta den', text: 'Då ser teamet att den är din.' },
      { mal: '.nbs [data-g="f-status"][data-status="kontaktad"]', rubrik: 'Efter samtalet', vanta: true, efterKlick: 600, gor: 'Klicka på Kontaktad', text: 'Kundkortet skapas automatiskt.' },
      { mal: '.nbs [data-g="f-skapa-affar"]', rubrik: 'Skapa affären', vanta: true, efterKlick: 700, gor: 'Klicka på Skapa affär' },
      { mal: '.ark [form="ny-affar-form"][type="submit"]', rubrik: 'Spara', behallArk: true, vanta: true, efterKlick: 800, gor: 'Klicka på Skapa affär', text: 'Huset är föreslaget och värdet hämtas ur prislistan.' },
      { mal: '.afhero', rubrik: 'Affären är skapad', text: 'Kunden, huset, värdet och chansen att vinna.' },
      { mal: meny('salj'), rubrik: 'Till säljtavlan', prova: true, klar: paSida(/^#\/salj$/), efterKlick: 500, gor: 'Klicka på Säljtavla', gorSjalv: function () { location.hash = '#/salj'; } }
    ]
  });

  T.push({
    id: 'flode-offert', grupp: 'flode', vy: 'flode-2', roller: ['salj'], ovning: true, namn: 'Från affär till offert', beskrivning: 'Skapa, justera och markera som skickad.', nasta: 'offerter',
    rollText: 'Gäller säljare.',
    klarText: 'Du skapade en offert och markerade den som skickad.',
    fore: function (c) { c.affar = valjAffar(['besok', 'kontakt', 'ny'], true); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: ['.af-nasta [data-g="skapa-offert"]', '[data-af="offert"] [data-g="skapa-offert"]'], rubrik: 'Skapa offert', vanta: true, efterKlick: 700, gor: 'Klicka på Skapa offert', text: 'Huset, frakt och montage läggs in ur prislistan.' },
      { mal: '.offertlagg', valfri: true, rubrik: 'Lägg till en rad', prova: true, fore: function (c) { c.rader = document.querySelectorAll('.offertrader input').length; }, klar: function (c) { return document.querySelectorAll('.offertrader input').length > c.rader; },
        gor: 'Välj ett tillval i listan', bra: 'Summan räknades om.', text: 'Till exempel altan. Eller <b>Egen rad</b>.' },
      { mal: '.offertsumma', valfri: true, rubrik: 'Summan', text: 'Blir affärens nya värde på säljtavlan.' },
      { mal: '.vyhuvud [data-g="offert-skicka"]', rubrik: 'Skicka offerten', vanta: true, efterKlick: 600, gor: 'Klicka på Skicka offerten' },
      { mal: '.ark__fot [data-g="offert-markera"]', rubrik: 'Markera som skickad', behallArk: true, vanta: true, efterKlick: 700, gor: 'Klicka på Markera som skickad', text: 'CRM:et skickar inget självt. Du skriver ut, mejlar och markerar här.' },
      { mal: '.ostatus', valfri: true, rubrik: 'Skickad', text: 'Giltigheten räknas ned från 30 dagar.' },
      { mal: '.off-svar', valfri: true, rubrik: 'När kunden svarar', text: '<b>Kunden godkände</b> eller <b>Kunden avböjde</b>. Behöver något ändras: <b>Ny version</b>.' }
    ]
  });

  T.push({
    id: 'flode-mote', grupp: 'flode', vy: 'flode-3', roller: ['salj'], ovning: true, namn: 'Hålla ett kundmöte', beskrivning: 'Förbered, presentera och räkna.', nasta: 'kundmote',
    rollText: 'Gäller säljare.',
    klarText: 'Du har hållit ett övningsmöte. Ett bra möte slutar med ett beslut om nästa steg.',
    fore: function (c) { c.affar = valjAffar(['besok', 'kontakt', 'ny', 'offert']); },
    steg: [
      { sida: '#/mote', mal: ['label:has([data-moteaffar])', '[data-moteaffar]'], valfri: true, rubrik: 'Välj affär', fri: true,
        fyll: function (c) { var s = document.querySelector('[data-moteaffar]'); if (!s) return {}; var v = [].slice.call(s.options).map(function (o) { return o.value; }).filter(Boolean); return { '[data-moteaffar]': v.indexOf(c.affar) >= 0 ? c.affar : (v[0] || '') }; },
        text: 'Kunden och huset följer med in i presentationen.' },
      { mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta', vanta: true, efterKlick: 900, gor: 'Klicka på Starta presentation' },
      { mal: '.mote__botten', tangenter: true, rubrik: 'Presentera', text: 'Bläddra med <kbd>' + PV + '</kbd> <kbd>' + PH + '</kbd>.' },
      { mal: '.mote [data-mote="anteckna"]', rubrik: 'Anteckna', vanta: true, tangent: 'n', gor: 'Klicka här eller tryck N' },
      { mal: '.mote__prick[aria-label="Räkna på ert hus"]', rubrik: 'Räkna på huset', vanta: true, tangent: 'k', efterKlick: 900, gor: 'Klicka här eller tryck K' },
      { mal: '.mote__bild[data-id="kalkyl"]', rubrik: 'Kalkylen', fri: true, luft: -40, text: 'Välj hus och tillval tillsammans med kunden.' },
      { mal: '.mote [data-mote="stang"]', rubrik: 'Avsluta', vanta: true, efterKlick: 800, gor: 'Stäng presentationen' }
    ]
  });

  T.push({
    id: 'flode-dokument', grupp: 'flode', vy: 'flode-4', roller: ['salj'], namn: 'Hantera dokument', beskrivning: 'Hitta, öppna och fyll i mallar.', nasta: 'dokument',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/dokument', mal: iArkiv('.dk-att'), valfri: true, rubrik: 'Börja med det som brådskar', text: '<b>Att hantera</b> listar offerter utan svar och underlag som saknas.' },
      { sida: '#/dokument', mal: ['.dk-ladda', '.dk-hjalte__knappar'], rubrik: 'Ladda upp', text: 'Varje fil kontrolleras först, sedan väljer du typ och kund.' },
      { mal: iArkiv('[data-g="dok-detalj"]'), rubrik: 'Öppna en offert', vanta: true, efterKlick: 600, gor: 'Klicka på raden' },
      { mal: '.ark .ark__fot', behallArk: true, valfri: true, rubrik: 'Gör något', text: '<b>Förläng 14 d</b>, mejla en påminnelse eller ring kunden.' },
      { fore: stangArk, mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Mallarna', vanta: true, efterKlick: 600, gor: 'Klicka på Mallar' },
      { mal: '[data-g="mall-exempel"]', rubrik: 'Visa ett exempel', vanta: true, efterKlick: 700, gor: 'Klicka på Visa exempel' },
      { mal: '.ark .ml-exempel', behallArk: true, valfri: true, rubrik: 'Exemplet', text: 'Så ser dokumentet ut. <b>Fyll i</b> skriver ut det för en kund.' }
    ]
  });

  T.push({
    id: 'flode-overlamning', grupp: 'flode', vy: 'flode-5', roller: ['salj'], ovning: true, namn: 'Från order till nyckel', beskrivning: 'Vinn affären och lämna över huset.', nasta: 'projekt',
    rollText: 'Gäller säljare.',
    klarText: 'Hela resan, från order till nyckel. Kunden finns kvar med all historik.',
    fore: function (c) { c.affar = valjAffar(['forhandling', 'offert']); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.af-nasta [data-g="aff-steg"][data-steg="forhandling"]', om: function (c) { var a = IH.affar && IH.affar(c.affar); return !!(a && a.steg === 'offert'); }, rubrik: 'Till förhandling', vanta: true, efterKlick: 700, gor: 'Klicka för att gå till Förhandling' },
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.af-nasta [data-g="aff-vinn"]', rubrik: 'Order signerad', vanta: true, efterKlick: 1000, gor: 'Klicka på Order signerad', text: 'Affären blir vunnen och ett projekt skapas.' },
      { sida: function (c) { return '#/produktion/' + (projektFor(c.affar) || forstaProjekt()); }, mal: '.ark .stegare--prod', behallArk: true, rubrik: 'Projektet', text: 'Sex steg från ritning till nyckel. Montaget planeras om tolv veckor.' },
      { mal: '.ark .projark__check', behallArk: true, fri: true, valfri: true, rubrik: 'Innan montaget', text: 'Bocka av ritningar, lov, grund och framkomlighet.' },
      { mal: '.ark .projark__datum', behallArk: true, fri: true, valfri: true, rubrik: 'Montagedagen', text: 'Ändra när den är bestämd. Kalendern följer med.' },
      { mal: '.ark .stegare--prod li:last-child button', behallArk: true, rubrik: 'Lämna över', vanta: true, efterKlick: 900, gor: 'Klicka på Klart', text: 'När slutbesiktningen är gjord.' }
    ]
  });

  IH.guide.registrera(T);

  /* --- Kurserna på startsidan Lär dig CRM:et -------------------------------- */
  IH.guide.kurser = [
    { ikon: 'karta', id: 'start', namn: 'Kom igång', text: 'Hitta rätt och gör CRM:et till ditt.', turer: ['valkommen', 'oversikt', 'utseende', 'aviseringar'] },
    { ikon: 'inkorg', id: 'lead', namn: 'Från förfrågan till affär', text: 'Svara snabbt och skapa affären.', turer: ['flode-ny-kund', 'forfragningar', 'saljtavla', 'affar'] },
    { ikon: 'folk', id: 'kund', namn: 'Kunder och offerter', text: 'Håll koll på kunden och skicka offerten.', turer: ['kunder', 'kundsida', 'flode-offert', 'offerter', 'offert'] },
    { ikon: 'skarm', id: 'mote', namn: 'Kundmöten', text: 'Presentera, räkna och boka videomöte.', turer: ['flode-mote', 'kundmote', 'presentation', 'videomote', 'videomoten'] },
    { ikon: 'hus', id: 'bygg', namn: 'Order, bygge och dokument', text: 'Från signerad order till nyckel.', turer: ['flode-overlamning', 'projekt', 'flode-dokument', 'dokument'] },
    { ikon: 'dag', id: 'dag', namn: 'Din dag', text: 'Uppgifter, meddelanden och inställningar.', turer: ['att-gora', 'chatt', 'chatt-verktyg', 'profil', 'installningar'] },
    { ikon: 'graf', id: 'led', namn: 'Försäljningsledning', text: 'Teamet, fördelning och topplistan.', turer: ['chef'] },
    { ikon: 'skold', id: 'adm', namn: 'Administration', text: 'Konton, säkerhet och supportläget.', turer: ['kontroll', 'adminpanel', 'sakerhet', 'supportlage'] }
  ];
})();
