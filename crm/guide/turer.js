/* ============================================================
   Legohus CRM – turerna (data till IH.guide), 2026-10-29.
   En tur: { id, namn, beskrivning, grupp (start|flode|sida|admin),
   vy (sidan den hör till), vyDel (undersida), roller, nasta, steg }.
   Ett steg: { sida, mal, rubrik, text, vanta, fri, fyll, om, fore,
   placering, luft, gor, skylt, saknas }.
     sida   – adressen steget visas på (#/…), eller en funktion
     mal    – väljare, lista med väljare (första synliga vinner) eller funktion
     vanta  – användaren klickar själv på det markerade för att gå vidare
     fri    – man får klicka och skriva i det markerade (formulär)
     fyll   – { väljare: värde } som "Fyll i exempel" och autospelet skriver in
     om     – funktion; steget hoppas över när den ger false
   Allt som beskrivs finns i CRM:et (se KUNSKAP.md). Siffror och namn
   i CRM:et är exempeldata.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  if (!IH.guide || !IH.guide.registrera) { console.warn('turer.js: ladda guide.js först'); return; }

  /* --- Hjälpare -------------------------------------------------------- */
  var db = function () { return IH.db || {}; };
  var jagId = function () { return IH.jag ? IH.jag().id : null; };
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var pil = function (d, namn) { return '<svg viewBox="0 0 24 24" width="11" height="11" role="img" aria-label="' + namn + '" style="fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="' + d + '"/></svg>'; };
  var PV = pil('M19 12H5M11 6l-6 6 6 6', 'vänsterpil'), PH = pil('M5 12h14M13 6l6 6-6 6', 'högerpil'), PU = pil('M12 19V5M6 11l6-6 6 6', 'uppil');
  var CK = '<kbd>' + (MAC ? '⌘' : 'Ctrl') + '</kbd> <kbd>K</kbd>';

  // Länken i menyn (dator) eller i mobilmenyn.
  function meny(vy) { return ['.sido__lank[data-vy="' + vy + '"]', '.mobilmeny [data-vy="' + vy + '"]']; }
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

  // Dokumentsidan minns fliken (Arkiv/Mallar) – guiden börjar alltid i arkivet.
  var arkivKlick = 0;
  function iArkiv(sel) {
    return function () {
      var flik = document.querySelector('[data-g="dok-flik"][data-f="arkiv"]');
      var fack = document.querySelector('.dk-fack');
      var syns = !!(fack && fack.getClientRects().length && getComputedStyle(fack).visibility !== 'hidden');
      if (flik && !syns && Date.now() - arkivKlick > 1200) { arkivKlick = Date.now(); flik.click(); }
      return syns ? document.querySelector(sel) : null;
    };
  }

  var T = [];

  /* =====================================================================
     KOM IGÅNG
     ===================================================================== */
  T.push({
    id: 'valkommen', grupp: 'start', vy: 'oversikt-start', namn: 'Rundtur: hitta i CRM:et',
    beskrivning: 'Menyn, sökningen, Ny-knappen, kontot och kortkommandona.', nasta: 'oversikt',
    steg: [
      { sida: '#/', rubrik: 'Välkommen till Legohus CRM', text: '<p>Här samlas allt från första förfrågan till nyckelöverlämningen: kunder, affärer, offerter, kundmöten, projekt och dokument.</p><p>Guiden pekar ut var allt finns. Allt du ser är <b>exempeldata</b> – du kan inte förstöra något.</p>' },
      { mal: ['.sido__nav', '.mobilmeny'], rubrik: 'Menyn', placering: 'hoger',
        text: '<p>Menyn är ordnad efter arbetet:</p><ul><li><b>Sälj</b> – förfrågningar, säljtavlan, kunder, offerter, dokument och kundmöte</li><li><b>Produktion</b> – projekten efter vunnen affär</li><li><b>Mitt</b> – meddelanden, att göra och inställningar</li></ul>', roller: ['salj'] },
      { mal: ['.sido__nav', '.mobilmeny'], rubrik: 'Menyn för administratören', placering: 'hoger', roller: ['admin'],
        text: '<p>Som administratör ser du <b>Ledning</b>: Kontrollcentral, Adminpanel och Säkerhet. Under <b>Teamet</b> går du in i en säljares konto (supportläge).</p>' },
      { mal: meny('forfragningar').concat(meny('salj')), rubrik: 'Brickorna visar vad som väntar', roller: ['salj'],
        text: 'Siffran bredvid en sida är det som väntar på dig: nya förfrågningar, öppna affärer, uppgifter i dag och olästa meddelanden. Orange bricka = något som vill ha svar.' },
      { mal: ['.sido__sok', '.topp .sok'], rubrik: 'Sök och kommandon', placering: 'hoger',
        text: '<p>Tryck ' + CK + ' var du än är (eller <kbd>/</kbd>). Sök på kund, affär, förfrågan eller offertnummer – eller skriv ett kommando som <b>Ny kund</b> eller <b>Starta kundmöte</b>.</p><p>Paletten visar också de senast öppnade.</p>' },
      { mal: ['.sido__ny', '.topp [data-g="ny"]'], rubrik: 'Skapa något nytt', roller: ['salj'], placering: 'hoger',
        text: 'Plus-knappen (eller <kbd>N</kbd> var som helst) skapar en <b>förfrågan</b>, <b>affär</b>, <b>kund</b> eller <b>uppgift</b>.' },
      { mal: '.vy-vaxel', valfri: true, rubrik: 'Säljvy och chefsvy', roller: ['chef'], placering: 'hoger',
        text: 'Du är både säljare och chef. Växla mellan ditt eget säljarbete och <b>Chefsvyn</b> (Försäljning) med teamets siffror.' },
      { mal: ['.anv', '.mobilmeny [data-mer]'], rubrik: 'Ditt konto', placering: 'hoger',
        text: 'Kortet längst ned öppnar kontomenyn: din <b>status</b> (Online, I möte, Ute på tomt …), <b>Min profil</b>, byta konto i demon och <b>Logga ut</b>.' },
      { mal: '[data-sido-knapp]', rubrik: 'Mer plats', placering: 'hoger', om: function () { return window.innerWidth > 1100; },
        text: 'Fäll in menyn med knappen på kanten eller med <kbd>[</kbd> när du vill ha mer plats för tavlan eller kalendern.' },
      { rubrik: 'Guiderna finns alltid här', text: '<p>Knappen <b>Guide</b> nere i hörnet (eller <kbd>?</kbd>) öppnar alla guider: en för varje sida och flödena från förfrågan till överlämning.</p><p>Nästa guide går igenom Översikten.</p>' }
    ]
  });

  /* =====================================================================
     SIDORNA
     ===================================================================== */
  T.push({
    id: 'oversikt', grupp: 'sida', vy: 'oversikt', namn: 'Översikt', beskrivning: 'Dagens läge, nyckeltal och vad du ska göra först.', nasta: 'forfragningar',
    steg: [
      { sida: '#/', mal: '.hero__ord', rubrik: 'Dagens läge', placering: 'hoger', text: 'Hälsningen sammanfattar dagen: nya förfrågningar som väntar på svar, hur stor pipelinen är och hur många hus som är i produktion.' },
      { mal: '.hero__lagen', rubrik: 'I dag', text: 'Chipsen visar hur många uppgifter du har i dag, om du har fler möten och hur länge det är till nästa montage.' },
      { mal: '.hero__snabb', rubrik: 'Snabbknappar', roller: ['salj'], text: 'Skapa en <b>förfrågan</b>, <b>kund</b>, <b>affär</b> eller <b>uppgift</b> – eller starta ett <b>kundmöte</b> – direkt härifrån.' },
      { mal: '.hero__kpi', rubrik: 'Nyckeltalen', placering: 'hoger', text: 'Nya förfrågningar, öppen pipeline (med viktat värde), vunnet i år och antal hus i produktion. Klicka för att gå till sidan bakom talet.' },
      { mal: '.hero__by', rubrik: 'Pipelinen som en byggarbetsplats', placering: 'vanster', text: 'Varje hus på tomten är ett säljsteg – från utstakad tomt (Ny) till nycklar klara (Vunnen). Rutorna under visar värde och antal per steg.' },
      { mal: medRubrik('.oversikt .kort', 'Senaste förfrågningar'), rubrik: 'Senaste förfrågningar', text: 'De senaste som kommit in från hemsidan, telefon och mejl. <b>Alla</b> tar dig till inkorgen.' },
      { mal: medRubrik('.oversikt .kort', 'Intäkter'), rubrik: 'Intäkter', text: 'Vunna affärer per månad. Växla mellan <b>6</b> och <b>12 månader</b> och exportera de vunna affärerna som CSV.' },
      { mal: medRubrik('.oversikt .kort', 'Fokus i dag'), rubrik: 'Fokus i dag', placering: 'vanster', text: 'CRM:et föreslår vad du bör göra först: förfrågningar som väntar, offerter att följa upp och affärer som står still.' },
      { mal: medRubrik('.oversikt .kort', 'Att göra i dag'), rubrik: 'Att göra i dag', placering: 'vanster', text: 'Bocka av, skjut upp en dag, ring kunden eller öppna kundkortet direkt från listan.' },
      { mal: medRubrik('.oversikt .kort', 'Senaste aktivitet'), rubrik: 'Senaste aktivitet', placering: 'vanster', text: 'Samtal, mejl, möten och ändringar i hela CRM:et – det senaste överst.' }
    ]
  });

  T.push({
    id: 'forfragningar', grupp: 'sida', vy: 'forfragningar', roller: ['salj'], namn: 'Förfrågningar', beskrivning: 'Inkorgen: leadpoäng, nästa bästa steg och samtalsguiden.', nasta: 'saljtavla',
    rollText: 'Gäller säljare – gå in i en säljares konto via supportläget.',
    steg: [
      { sida: '#/forfragningar', mal: '.ipuls', rubrik: 'Inkorgen', text: 'Överst ser du hur många som väntar på svar, vem som väntat längst, veckans förfrågningar, hur många som blivit affärer och varifrån de kommer.' },
      { mal: '.dioramor', rubrik: 'Var ska huset stå?', text: 'Samma fråga som formuläret på hemsidan. Klicka på en miljö – vid havet, i skogen, på fjället eller i trädgården – för att bara se de förfrågningarna.' },
      { mal: '.ipuls .toppverktyg', rubrik: 'Lägg in eller prova', text: '<b>Lägg in förfrågan</b> när någon ringer eller mejlar. <b>Simulera ny förfrågan</b> visar hur det ser ut när en kommer in från hemsidan.' },
      { mal: '.inkorg__filter .flikar', rubrik: 'Status', text: 'Filtrera på <b>Ny</b>, <b>Kontaktad</b>, <b>Blev affär</b> och <b>Ej aktuell</b>.' },
      { mal: '.inkorg__lista', rubrik: 'Listan', placering: 'hoger', text: 'Grupperad per dag med leadpoängen på varje rad. Bläddra med <kbd>J</kbd> och <kbd>K</kbd>, och tryck <kbd>U</kbd> för ett svarsutkast.' },
      { mal: '.fd__huvud', rubrik: 'Ta förfrågan', text: '<b>Ta den</b> tilldelar förfrågan till dig så att kollegorna ser att den är din.' },
      { mal: '.nbs', rubrik: 'Nästa bästa steg', text: 'CRM:et säger vad du ska göra nu – och hur lång tid som är kvar till svarsmålet. Härifrån ringer du, skriver ett <b>svarsutkast</b>, markerar <b>Kontaktad</b> eller sätter en <b>påminnelse om 2 h</b>.' },
      { mal: '.inkorg__las .smart', rubrik: 'Leadpoäng', text: 'Poängen räknas fram ur svaren och texten och visar vad som höjer den. Ämnen som strandskydd eller kök hittas automatiskt. En fingervisning, inget facit.' },
      { mal: '.inkorg__las .guide', rubrik: 'Samtalsguiden', text: 'Frågorna inför första samtalet: detaljplan, byggnader på tomten, avstånd till gränsen, framkomlighet, grund och tidplan. Bocka av medan du pratar.' },
      { mal: '.fd__kontakt', rubrik: 'Kontakt', text: 'Ring, mejla eller öppna ett färdigt <b>svarsutkast</b> anpassat efter vad kunden skrev (personligt eller kort).' },
      { mal: '.fd__forslag', rubrik: 'Husförslag', text: 'CRM:et föreslår ett hus utifrån svaren – bra att ha med i första samtalet.' },
      { mal: '.fd__logg', rubrik: 'Historik', text: 'När förfrågan har blivit en kund loggar du samtal, mejl och möten här. Historiken följer med till kundkortet.' }
    ]
  });

  T.push({
    id: 'saljtavla', grupp: 'sida', vy: 'salj', roller: ['salj'], namn: 'Säljtavlan', beskrivning: 'Pipelinen, stegen, filter och korten.', nasta: 'affar',
    rollText: 'Gäller säljare – gå in i en säljares konto via supportläget.',
    steg: [
      { sida: '#/salj', mal: '.puls', rubrik: 'Pipelinen', text: 'Huset till vänster byggs av pipelinen – grunden är Ny, taket är Förhandling. Bredvid: öppen pipeline, viktad prognos, snitt per affär och vunnet senaste 90 dagarna.' },
      { mal: '.forslag', valfri: true, rubrik: 'Smarta förslag', placering: 'vanster', text: 'Förfrågningar att svara på, offerter att följa upp och affärer som står still. Här växlar du också mellan <b>Tavla</b> och <b>Lista</b> och skapar en <b>Ny affär</b>.' },
      { mal: '.stegband', rubrik: 'Sex säljsteg', text: '<p>Ny förfrågan (10 %) → Kontakt tagen (20 %) → Tomt &amp; platsbesök (40 %) → Offert skickad (60 %) → Förhandling (75 %) → Order signerad.</p><p>Procenten är chansen att vinna. Klicka på ett steg för att hoppa till spalten.</p>' },
      { mal: '.tv-verktyg', rubrik: 'Sök och filter', text: 'Sök på affär, kund, ort eller hus. Visa <b>Alla</b> eller <b>Mina</b>, filtrera på <b>Står still</b>, <b>Har uppgift</b> och <b>Över 600 tkr</b>, sortera och öppna de <b>Förlorade</b>.' },
      { mal: '.tv-fokus', valfri: true, rubrik: 'Fokus i dag', text: 'De tre affärer som tjänar mest på en kontakt nu – med nästa steg på varje.' },
      { mal: '.tavla .spalt', rubrik: 'En spalt per steg', placering: 'hoger', text: 'Summan, chansen och det viktade värdet. <b>Snitt</b> är dagar sedan senaste ändringen och <b>står still</b> varnar för affärer utan ändring på över tio dagar.' },
      { mal: '.tavla .aff', rubrik: 'Affärskortet', placering: 'hoger', text: 'Huset, värdet och ringen med chansen. Dagarna i steget färgas: färsk, lugn eller står still. Knapparna på kortet: ring kunden, logga, ny uppgift och flytta till nästa steg.' },
      { mal: '.tavla__tips', rubrik: 'Dra och släpp', text: 'Dra korten mellan stegen. Släpp längst ned för att markera som förlorad – då frågar CRM:et efter orsaken. Med tangentbordet: piltangenterna och Enter.' },
      { mal: '.tavla .aff', rubrik: 'Öppna en affär', vanta: true, efterKlick: 500, text: 'Klicka på kortet för att öppna affären.' },
      { sida: function () { return /^#\/salj\/./.test(location.hash) ? location.hash : '#/salj/' + valjAffar(['offert', 'besok', 'kontakt']); }, mal: '.afhero', rubrik: 'Affärssidan', text: 'Allt om affären på en sida. Nästa guide går igenom den.' }
    ]
  });

  T.push({
    id: 'affar', grupp: 'sida', vy: 'salj', vyDel: true, roller: ['salj'], namn: 'Affärssidan', beskrivning: 'Värde, chans, steg, nästa bästa steg och historik.', nasta: 'kunder',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.affar = /^#\/salj\/./.test(location.hash) ? location.hash.split('/')[2] : valjAffar(['offert', 'besok', 'kontakt', 'forhandling']); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.afhero', rubrik: 'Affären', text: 'Kunden, huset och fyra tal: affärsvärdet, chansen att vinna (strecket är stegets grund), dagar i steget och det viktade värdet.' },
      { mal: '.af-stegare', rubrik: 'Stegen', text: 'Klicka på ett steg för att flytta affären. Allt loggas i historiken.' },
      { mal: '.af-nasta', rubrik: 'Nästa bästa steg', text: 'Det viktigaste att göra nu, med knappen direkt: ringa, boka platsbesök, skapa eller skicka offerten, följa upp eller signera ordern.' },
      { mal: '[data-af="offert"]', rubrik: 'Offerten', text: 'Den senaste offerten med status och summa – eller knappen <b>Skapa offert</b> om det inte finns någon.' },
      { mal: '[data-af="historik"]', rubrik: 'Historik', text: 'Logga en <b>anteckning</b>, ett <b>samtal</b>, ett <b>mejl</b> eller ett <b>möte</b> med en rad. Allt hamnar även på kundkortet.' },
      { mal: '[data-af="kund"]', rubrik: 'Kunden', placering: 'vanster', text: 'Kundkortet ett klick bort, med telefon och e-post.' },
      { mal: '[data-af="uppgifter"]', valfri: true, rubrik: 'Att göra', text: 'Öppna uppgifter för affären. Bocka av direkt här.' },
      { mal: '[data-af="atgarder"]', rubrik: 'Åtgärder', placering: 'vanster', text: 'Starta ett <b>kundmöte</b>, lägg till en <b>uppgift</b> eller <b>markera som förlorad</b> (med orsak – går att återuppta).' },
      { mal: '[data-af="hus"]', rubrik: 'Huset', text: 'Fakta om modellen: yttermått, tak, rum och om det krävs bygglov.' }
    ]
  });

  T.push({
    id: 'kunder', grupp: 'sida', vy: 'kunder', roller: ['salj'], namn: 'Kunder', beskrivning: 'Kundregistret, kundresan, filter och kundkorten.', nasta: 'kundsida',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/kunder', mal: '.kundtopp__ord', rubrik: 'Kunderna', placering: 'hoger', text: 'Antal kunder, hur många som har affärer, privat eller företag – och de <b>varma</b> kunderna som är värda ett samtal nu.' },
      { mal: '.kundtopp__resa', valfri: true, rubrik: 'Kundresan', placering: 'vanster', text: 'Var kunderna befinner sig: förfrågan, affär, offert och vidare. Klicka på ett steg för att se vilka. Här finns också <b>Ny kund</b>, export och växeln Kort/Lista.' },
      { mal: '.kundverktyg', rubrik: 'Filter och sortering', text: 'Alla, Mina, Affär pågår, Kunder, Företag och <b>Behöver uppmärksamhet</b> – och sortering.' },
      { mal: '.kundnat .kundkort', rubrik: 'Kundkortet', placering: 'hoger', text: 'Värdet, senaste kontakt och snabbknapparna: <b>Ring</b>, <b>Mejla</b>, <b>Kundmöte</b> och <b>Ny affär</b>. I listläget kan du markera flera och mejla, exportera eller ge dem en uppgift.' },
      { mal: '.kundnat .kundkort', rubrik: 'Öppna kunden', vanta: true, efterKlick: 500, klickaPa: '.kundnat .kundkort .kundkort__topp', text: 'Klicka på kortet för att öppna kundsidan.' },
      { sida: function () { return /^#\/kunder\/./.test(location.hash) ? location.hash : '#/kunder/' + kundMedAffar(); }, mal: '.kh', rubrik: 'Kundsidan', text: 'Allt om kunden på en sida – nästa guide går igenom den.' }
    ]
  });

  T.push({
    id: 'kundsida', grupp: 'sida', vy: 'kunder', vyDel: true, roller: ['salj'], namn: 'Kundsidan', beskrivning: 'Hälsan, kundresan, affärer, offerter och historiken.', nasta: 'offerter',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.kund = /^#\/kunder\/./.test(location.hash) ? location.hash.split('/')[2] : kundMedAffar(); },
    steg: [
      { sida: function (c) { return '#/kunder/' + c.kund; }, mal: '.kh__vem', rubrik: 'Kunden', text: 'Namn, ort och kontaktuppgifter – klicka för att kopiera telefon eller e-post. Härifrån skapar du en <b>Ny affär</b>, loggar ett samtal, lägger en <b>uppgift</b> eller startar ett <b>kundmöte</b>.' },
      { mal: '.kh__halsa', rubrik: 'Kundhälsan', text: 'Ett tal 0–100: hur nyligen ni hördes, minus försenade uppföljningar, plus för en öppen eller vunnen affär. Grönt (75+) är en varm relation, gult betyder håll kontakten och rött att kunden behöver höra av er.' },
      { mal: '.kh__tal', rubrik: 'Talen', placering: 'vanster', text: 'Öppet affärsvärde, vunnet och dagar sedan senaste kontakt.' },
      { mal: '.kundresa', rubrik: 'Kundresan', text: 'Var kunden är på vägen från förfrågan till klart hus.' },
      { mal: '.kn', valfri: true, rubrik: 'Nästa steg', text: 'Det viktigaste att göra för kunden just nu – med knappen direkt.' },
      { mal: '.kg__vanster', rubrik: 'Huset, affärer, offerter och förfrågningar', placering: 'hoger', text: 'Allt som hör till kunden. Klicka för att öppna affären eller offerten.' },
      { mal: '.kkontakt', rubrik: 'Kontakt 90 dagar', placering: 'vanster', text: 'Samtal, mejl och möten senaste 90 dagarna – syns det ett glapp är det dags att höra av sig.' },
      { mal: '#kund-historik', rubrik: 'Historiken', placering: 'vanster', text: 'Logga med en rad och filtrera på samtal, mejl eller möten. Anteckningar från kundmöten hamnar också här.' }
    ]
  });

  T.push({
    id: 'offerter', grupp: 'sida', vy: 'offerter', roller: ['salj'], namn: 'Offerter', beskrivning: 'Läget, går ut snart, förläng, ny version och filter.', nasta: 'offert',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/offerter', mal: '.offtopp__ord', rubrik: 'Offertläget', placering: 'hoger', text: 'Vad som väntar på svar, <b>träffsäkerheten</b> (andel godkända), <b>tid till ja</b> och godkänt värde. Staplarna visar offererat per vecka.' },
      { mal: '.snartut', rubrik: 'Går ut snart', placering: 'vanster', text: 'Skickade offerter med tio dagar eller mindre kvar. <b>Följ upp</b> öppnar affären, <b>+14 d</b> förlänger giltigheten.' },
      { mal: '.offinsikt', rubrik: 'Per hus och vanligaste posterna', placering: 'vanster', text: 'Vilka hus som offereras mest och vilka tillval som brukar komma med.' },
      { mal: '.kundverktyg', rubrik: 'Filter', text: 'Alla, Väntar på svar, Går ut snart, Godkända och Utkast. Sortera på senaste, går ut först eller störst summa. Sök på kund eller nummer.' },
      { mal: '.tabell--offert tbody tr', rubrik: 'En offert', text: 'Nummer, kund, summa, status och giltighet. <b>Följ upp i affären</b> och <b>Ny version</b> finns på raden.' },
      { mal: '.tabell--offert tbody tr', rubrik: 'Öppna offerten', vanta: true, efterKlick: 500, text: 'Klicka på raden för att öppna offerten.' },
      { sida: function () { return /^#\/offerter\/./.test(location.hash) ? location.hash : '#/offerter/' + ((db().offerter || [])[0] || {}).id; }, mal: '.vyhuvud', rubrik: 'Offerten', text: 'Nästa guide går igenom offertsidan.' }
    ]
  });

  T.push({
    id: 'offert', grupp: 'sida', vy: 'offerter', vyDel: true, roller: ['salj'], namn: 'Offertsidan', beskrivning: 'Rader, prislistan, summan, PDF och status.', nasta: 'dokument',
    rollText: 'Gäller säljare.',
    fore: function (c) { c.offert = /^#\/offerter\/./.test(location.hash) ? location.hash.split('/')[2] : ((db().offerter || []).filter(function (o) { return o.status === 'skickad'; })[0] || (db().offerter || [])[0] || {}).id; },
    steg: [
      { sida: function (c) { return '#/offerter/' + c.offert; }, mal: '.vyhuvud', rubrik: 'Offerten', text: 'Offertnumret (LH-år-nummer) och affären. <b>Skriv ut / PDF</b> ger dokumentet att skicka. Utkast markeras som skickat härifrån, en skickad offert markeras som godkänd med <b>Kunden godkände</b>.' },
      { mal: '.ostatus', rubrik: 'Status och giltighet', text: 'Utkast → Skickad → Godkänd. Ringen visar hur många av de 30 dagarna som är kvar.' },
      { mal: '.off-not', rubrik: 'Redan skickad?', om: function () { return !!document.querySelector('.off-not'); }, text: 'Ändrar du en skickad offert ser kunden inte ändringen – skapa en <b>Ny version</b> och skicka den i stället. Den gamla markeras som ersatt.' },
      { mal: '.offertred', rubrik: 'Innehållet', placering: 'hoger', text: 'Välj hus överst. Ändra text, antal och pris på raderna – summan och affärens värde följer med direkt. Godkända offerter är låsta.' },
      { mal: '.offertlagg', rubrik: 'Prislistan', om: function () { return !!document.querySelector('.offertlagg'); }, text: 'Lägg till frakt, montage, kranbil, ritningar, altan, kök och badrum eller braskamin ur prislistan – eller en egen rad. Priserna ställs in under Inställningar.' },
      { mal: '.dokyta', rubrik: 'Så ser kunden den', placering: 'vanster', text: 'Förhandsvisningen uppdateras medan du skriver. Det här är dokumentet som skrivs ut eller sparas som PDF.' }
    ]
  });

  T.push({
    id: 'dokument', grupp: 'sida', vy: 'dokument', roller: ['salj'], namn: 'Dokument och mallar', beskrivning: 'Arkivet, facken, detaljerna och mallarna.', nasta: 'kundmote',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/dokument', mal: iArkiv('.dk-hjalte__text'), rubrik: 'Dokument & avtal', placering: 'hoger', text: 'Alla offerter, ordrar, ritningar, bygglov, checklistor och foton på ett ställe. <b>Arkiv</b> och <b>Mallar</b> växlar du mellan här, och <b>Ladda upp</b> sparar egna filer.' },
      { mal: iArkiv('.dk-stats'), rubrik: 'Läget', placering: 'vanster', text: 'Väntar på svar, godkänt och signerat, går ut inom sju dagar och svarstiden. Klicka för att filtrera.' },
      { mal: iArkiv('.dk-fack'), rubrik: 'Facken', text: 'Ett fack per typ. Klicka för att bara visa den typen – eller släpp en fil på facket.' },
      { mal: iArkiv('.dk-verktyg'), rubrik: 'Hitta rätt', text: 'Sök, visa Mina eller Alla, välj år, sortering och gruppering (typ eller kund). Exportera listan som CSV.' },
      { mal: iArkiv('.dk-att'), valfri: true, rubrik: 'Att hantera', text: 'Det som behöver göras: offerter utan svar, underlag som saknas inför montaget. Knapparna gör det direkt.' },
      { mal: iArkiv('[data-g="dok-detalj"]'), rubrik: 'Öppna ett dokument', vanta: true, efterKlick: 600, text: 'Klicka på raden för att se detaljerna.' },
      { mal: '.ark .dkd', rubrik: 'Detaljerna', behallArk: true, text: 'Värdet, ringen med dagar kvar, tidslinjen (skapad, godkänd, går ut) och fakta. Knapparna nedanför: öppna, <b>Förläng 14 d</b>, mejla en påminnelse, ring eller gå till affären.' },
      { fore: function () { if (IH.stangArk) IH.stangArk(true); }, mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Mallarna', vanta: true, efterKlick: 600, text: 'Klicka på <b>Mallar</b>.' },
      { mal: medRubrik('.dk-grupp, .kort, section', 'Förslag just nu'), valfri: true, rubrik: 'Förslag just nu', text: 'CRM:et föreslår mallar utifrån var kunderna är – t.ex. ett följebrev när en offert ska skickas.' },
      { mal: '.ml-grupp', rubrik: 'Sju mallar i tre grupper', text: '<b>Sälj</b>: följebrev, protokoll från platsbesök, tack för ordern. <b>Bygget</b>: checklista inför montage, leveransplan. <b>Överlämning</b>: egenkontroll och överlämningsprotokoll.' },
      { mal: '[data-g="dok-mall"]', rubrik: 'Fyll i för en kund', text: '<b>Fyll i</b> väljer kund och skriver ut mallen ifylld. <b>Visa exempel</b> och <b>Skriv ut en tom mall</b> finns på varje mall.' }
    ]
  });

  T.push({
    id: 'kundmote', grupp: 'sida', vy: 'mote', roller: ['salj'], namn: 'Kundmöte', beskrivning: 'Förbered, välj upplägg och logga mötet.', nasta: 'presentation',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/mote', mal: '.motescen__ord', rubrik: 'Mötesrummet', placering: 'hoger', text: '<b>Starta presentation</b> öppnar bildspelet i helskärm. <b>Bara kalkylen</b> hoppar direkt till priset.' },
      { mal: medRubrik('.rutnat--mote .kort', 'Förbered mötet'), rubrik: 'Förbered mötet', placering: 'hoger', text: 'Välj affär (kunden och huset följer med), upplägg – <b>Fullt möte</b>, <b>Kort möte</b> eller <b>Bara kalkylen</b> – och vilka bilder som ska med. Tidsbandet visar hur lång tid mötet tar.' },
      { mal: '.komm', valfri: true, rubrik: 'Kommande möten', placering: 'vanster', text: 'Affärer som är redo för ett möte. <b>Förbered</b> väljer affären åt dig.' },
      { mal: '.logga-mote', rubrik: 'Logga mötet', placering: 'vanster', text: 'Höll ni mötet utan presentationen? Skriv vad ni kom fram till och nästa steg – nästa steg blir en uppgift.' },
      { mal: medRubrik('.rutnat--mote .kort', 'Tidigare möten'), valfri: true, rubrik: 'Tidigare möten', placering: 'vanster', text: 'Hållna möten ur historiken med längd.' },
      { mal: '.motekort', rubrik: 'Så funkar det', placering: 'vanster', text: 'Kortkommandona i presentationen: <kbd>' + PV + '</kbd> <kbd>' + PH + '</kbd> bläddra, <kbd>K</kbd> kalkylen, <kbd>N</kbd> anteckningar, <kbd>Esc</kbd> avsluta.' }
    ]
  });

  T.push({
    id: 'presentation', grupp: 'sida', vy: 'mote-presentation', roller: ['salj'], namn: 'Presentationen', beskrivning: 'Bildspelet för kunden, kalkylen och anteckningarna.', nasta: 'projekt',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/mote', mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta presentationen', vanta: true, efterKlick: 900, text: 'Klicka på <b>Starta presentation</b>.' },
      { mal: '.mote__botten', rubrik: 'Bläddra', behallArk: true, tangenter: true, text: 'Pilarna, prickarna eller <kbd>' + PV + '</kbd> <kbd>' + PH + '</kbd> (svep på pekskärm). Klockan uppe till höger visar mötets längd.' },
      { mal: '.mote [data-mote="anteckna"]', rubrik: 'Anteckningar', vanta: true, tangent: 'n', text: 'Öppna anteckningarna (eller tryck <kbd>N</kbd>).' },
      { mal: '.mote__anteckning', rubrik: 'Skriv under mötet', fri: true, placering: 'vanster', text: 'Tomten, tidplanen, önskemål. När mötet avslutas sparas anteckningen i kundens historik.' },
      { mal: '.mote__prick[aria-label="Räkna på ert hus"]', rubrik: 'Kalkylen', vanta: true, tangent: 'k', efterKlick: 900, text: 'Gå till <b>Räkna på ert hus</b> (eller tryck <kbd>K</kbd>).' },
      { mal: '.mote__bild[data-id="kalkyl"]', rubrik: 'Räkna tillsammans', fri: true, luft: -40, text: 'Välj hus och tillval – kvittot räknar live med prislistan. <b>Spara som offert</b> gör en offert på affären direkt.' },
      { mal: '.mote__prick[aria-label="Nästa steg"]', rubrik: 'Nästa steg', vanta: true, efterKlick: 900, text: 'Gå till sista bilden.' },
      { mal: '.mote__bild[data-id="nasta"]', rubrik: 'Avsluta med ett beslut', luft: -40, text: '<b>Boka platsbesök</b> lägger en uppgift om en vecka och flyttar affären till besök. <b>Mejla en sammanfattning</b> öppnar ett mejl till kunden.' },
      { mal: '.mote [data-mote="stang"]', rubrik: 'Avsluta mötet', vanta: true, efterKlick: 700, text: 'Stäng presentationen – anteckningen sparas i historiken.' },
      { mal: '.logga-mote', rubrik: 'Klart', text: 'Mötet finns nu i historiken. Här kan du alltid logga ett möte i efterhand.' }
    ]
  });

  T.push({
    id: 'projekt', grupp: 'sida', vy: 'produktion', roller: ['salj'], namn: 'Projekt och produktion', beskrivning: 'Nästa montage, husets resa, kalendern och projekttavlan.', nasta: 'att-gora',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/produktion', mal: '.prodtopp__intro', rubrik: 'Husen på väg', text: 'Varje vunnen affär blir ett projekt här. Överst: hur många hus som är på väg.' },
      { mal: '.nyckel', rubrik: 'Nyckeltalen', text: 'Aktiva projekt, nästa montage (vecka), andel klara punkter i checklistorna och värdet i produktion.' },
      { mal: '.prodblock--montage', valfri: true, rubrik: 'Nästa montage', placering: 'hoger', text: 'Nedräkningen till nästa montage – lastbilen kör mot huset i takt med projektet.' },
      { mal: '.prodblock--varn', valfri: true, rubrik: 'Att åtgärda', placering: 'vanster', text: 'Det som saknas innan montaget, uppdelat på <b>Kundens del</b> (bygglov, grund, framkomlighet) och <b>Vår del</b> (ritningar). Bocka av direkt.' },
      { mal: '.resa3d', rubrik: 'Husets resa i 3D', text: 'Sex stationer från ritning till nyckel. Kundernas hus står som nålar på sitt steg – klicka för att öppna projektet.' },
      { mal: '.kal', rubrik: 'Kalendern', text: 'Montage, projektstarter, uppgifter, möten och offerter som går ut. Filtrera per slag och klicka på en dag för detaljer.' },
      { mal: '.tavla--prod', rubrik: 'Projekttavlan', text: 'Ritning & lov → Tillverkning → Grund & mark → Leverans & montage → Slutbesiktning → Klart. Pilen på kortet flyttar projektet ett steg.' },
      { mal: '.tavla--prod .aff--proj', rubrik: 'Öppna ett projekt', vanta: true, efterKlick: 700, text: 'Klicka på ett projekt.' },
      { mal: '.ark .stegare--prod', rubrik: 'Projektpanelen', behallArk: true, text: 'Huset i 3D, stegen (klicka för att flytta), checklistan <b>Innan montaget</b> och montagedagen.' },
      { mal: '.ark .projark__check', rubrik: 'Innan montaget', behallArk: true, fri: true, text: 'Ritningar (Legohus), bygglov eller anmälan, grund med el, vatten och avlopp samt framkomlighet för lastbil och kran (kunden).' }
    ]
  });

  T.push({
    id: 'att-gora', grupp: 'sida', vy: 'att-gora', namn: 'Att göra', beskrivning: 'Veckan, nya uppgifter, bocka av och skjuta upp.', nasta: 'chatt',
    steg: [
      { sida: '#/att-gora', mal: '.dagtopp', rubrik: 'Dagen', text: 'Ringen visar hur mycket av dagens uppgifter som är klara.' },
      { mal: '.agk', rubrik: 'Veckan', text: 'Vecka, två veckor eller månad. Plus på en dag lägger en uppgift den dagen; klicka på en uppgift för att se den.' },
      { mal: '.agv', rubrik: 'Filter', text: 'Sök, visa <b>Mina</b> eller <b>Alla</b>, filtrera på typ (offert, platsbesök, samtal …) och exportera som CSV.' },
      { mal: '.nyuppg', rubrik: 'Ny uppgift', fri: true, text: 'Skriv vad som ska göras, koppla till en kund eller affär, välj dag och tryck Lägg till.' },
      { mal: '.uppgrupp', valfri: true, rubrik: 'I dag', text: 'Bocka av med cirkeln. <b>Skjut upp en dag</b>, ring kunden eller öppna kundkortet direkt från raden.' },
      { mal: '.uppgrupp--klara', valfri: true, rubrik: 'Klara', text: 'Det som är gjort. Klicka på bocken för att ångra.' }
    ]
  });

  T.push({
    id: 'chatt', grupp: 'sida', vy: 'chatt', namn: 'Meddelanden', beskrivning: 'Teamchatten, grupper, svar, reaktioner och filer.', nasta: 'profil',
    steg: [
      { sida: '#/chatt', mal: '.ch-lista', rubrik: 'Samtalen', placering: 'hoger', text: 'Hela teamet, privata samtal och grupper. Sök, starta en <b>Ny grupp</b> och se olästa och @-omnämnanden.' },
      { mal: '.ch-topp', rubrik: 'Samtalet', text: 'Tysta samtalet, se <b>Om samtalet</b> (medlemmar, delade filer) eller öppna det i ett eget flytande fönster som följer med mellan sidorna.' },
      { mal: '.ch-trad', rubrik: 'Meddelandena', placering: 'vanster', text: 'Hovra över ett meddelande för att reagera, <b>svara</b> med citat, kopiera, ändra eller ta bort ditt eget.' },
      { mal: '.ch-fot', rubrik: 'Skriv', fri: true, text: '<b>@</b> nämner en kollega, <b>#</b> länkar en kund eller affär. Bifoga eller dra in filer. <kbd>Enter</kbd> skickar, <kbd>Shift</kbd>+<kbd>Enter</kbd> ny rad, <kbd>' + PU + '</kbd> ändrar ditt senaste.' }
    ]
  });

  T.push({
    id: 'profil', grupp: 'sida', vy: 'profil', namn: 'Min profil och kalender', beskrivning: 'Id-kortet, status, aktiviteten och din kalender.', nasta: 'installningar',
    steg: [
      { sida: '#/profil', mal: '.lp-phjalte__vanster', rubrik: 'Ditt id-kort', placering: 'hoger', text: 'Namn, roll och status. <b>Ändra profil</b> och ändra status härifrån.' },
      { mal: '.lp-phjalte__tal', rubrik: 'Dina nyckeltal', placering: 'vanster', text: 'Pipeline, viktad prognos (värde × chans), vunnet i år mot ditt mål och vinstgrad.' },
      { mal: medRubrik('.lp-band2', 'Om dig'), rubrik: 'Om dig', placering: 'hoger', text: 'Berätta om dig, kontaktuppgifter och genvägar.' },
      { mal: medRubrik('.lp-band2', 'Aktivitet och arbete'), rubrik: 'Aktivitet och arbete', placering: 'vanster', text: 'Aktiviteten senaste 30 dagarna, dina affärer och dina uppgifter (lägg till med <b>Ny uppgift</b>).' },
      { mal: '.pk', rubrik: 'Min kalender', roller: ['salj'], text: 'Månad eller år. Lägg till på en dag, <b>ansök om ledighet</b>, <b>sjukanmäl</b> dig och ladda ner en <b>kalenderfil</b> (.ics) till din vanliga kalender.' }
    ]
  });

  T.push({
    id: 'installningar', grupp: 'sida', vy: 'installningar', namn: 'Inställningar och prislistan', beskrivning: 'Priserna bakom varje offert och exempeldatan.', nasta: 'flode-ny-kund',
    steg: [
      { sida: '#/installningar', mal: '.instopp', rubrik: 'Priserna bakom varje offert', text: 'Prisspannet på husen, antal tillval och om prislistan är ändrad. Priserna i prototypen är exempelpriser.' },
      { mal: '.prisform', rubrik: 'Husen', placering: 'hoger', text: 'Grundpriset per modell. Nya offerter och kalkylen i kundmötet räknar med det du sparar här.' },
      { mal: function () { var f = document.querySelectorAll('.prisform'); return f[1] || null; }, rubrik: 'Tillval och poster', placering: 'vanster', text: 'Frakt, montage, kranbil, ritningar, altan, kök och badrum, braskamin – posterna som läggs till i offerten.' },
      { mal: '.installning__proto', rubrik: 'Allt sparas i webbläsaren', text: 'Prototypen sparar i den här webbläsaren. <b>Återställ exempeldata</b> (två klick) tar tillbaka allt som från början.' }
    ]
  });

  /* =====================================================================
     LEDNING OCH ADMIN
     ===================================================================== */
  T.push({
    id: 'chef', grupp: 'admin', vy: 'chef', roller: ['chef'], namn: 'Chefsvyn: försäljningen', beskrivning: 'Teamet, närvaro, kalender, fördela förfrågningar och topplistan.',
    rollText: 'Gäller försäljningschefen.',
    steg: [
      { sida: '#/chef', mal: '.vy-vaxel', valfri: true, rubrik: 'Säljvy och chefsvy', placering: 'hoger', text: 'Växla mellan ditt eget säljarbete och teamets siffror.' },
      { mal: '.ao-text', rubrik: 'Så går teamet', text: '<b>Lägg till säljare</b>, <b>sätt mål</b>, <b>ge uppgift</b> och <b>exportera rapport</b>.' },
      { mal: '.lp-mork__mitt', rubrik: 'Mot målet', placering: 'vanster', text: 'Ringen visar teamets vinstgrad senaste 90 dagarna. Med ett mål satt följer du kvartalet här.' },
      { mal: '.ap-tal', rubrik: 'Nyckeltalen', text: 'Teamets pipeline, viktad prognos, vunnet 90 dagar och vinstgrad. Staplarna under visar veckorna.' },
      { mal: medRubrik('.ao-band', 'Teamet just nu'), rubrik: 'Teamet just nu', text: 'Varje säljare med status, pipeline och mål. Filtrera på tillgängliga eller upptagna, <b>skriv</b> till någon eller ge en uppgift.' },
      { mal: medRubrik('.ao-band', 'Vem jobbar när'), rubrik: 'Vem jobbar när', text: 'Närvaro och frånvaro vecka för vecka. Klicka på en dag för att lägga in frånvaro.' },
      { mal: medRubrik('.ao-band', 'Teamets kalender'), rubrik: 'Teamets kalender', text: 'Allas möten och uppgifter. Filtrera per säljare och typ, växla månad/lista och ladda ner som kalenderfil.' },
      { mal: medRubrik('.ao-band', 'Behöver din uppmärksamhet'), rubrik: 'Fördela förfrågningar', text: 'Nya förfrågningar utan säljare. <b>Ta den själv</b>, <b>Fördela</b> till en säljare – eller fördela jämnt till den som har minst öppet.' },
      { mal: medRubrik('.ao-band', 'Pipeline per säljare'), rubrik: 'Pipeline per säljare', placering: 'vanster', text: 'Öppet värde per säljare och steg, och den största affären.' },
      { mal: medRubrik('.ao-band', 'Topplistan'), rubrik: 'Topplistan', placering: 'vanster', text: 'Vunnet per säljare – 30 dagar, 90 dagar eller i år.' }
    ]
  });

  T.push({
    id: 'kontroll', grupp: 'admin', vy: 'kontroll', roller: ['admin'], namn: 'Kontrollcentralen', beskrivning: 'Hela CRM:et i en blick: konton, skydd, data och drift.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/kontroll', mal: '.ao-hjalte', rubrik: 'Hela CRM:et i en blick', text: 'Säkerhet, konton, data och drift vägs ihop till systemhälsan. Knapparna: <b>Skanna allt</b>, Adminpanelen, Säkerhet och <b>Nytt konto</b>.' },
      { mal: medRubrik('.ao-band', 'Hur kontona mår'), rubrik: 'Kontona', text: 'En hälsa per konto ur aktivitet, förfallna uppgifter, affärer eller projekt som står still, kopplingar och profilen.' },
      { mal: medRubrik('.ao-band', 'Skyddet just nu'), rubrik: 'Skyddet', text: 'De sju kontrollerna och fynden (hög, medel, låg). <b>Skanna allt</b> kör dem.' },
      { mal: medRubrik('.ao-band', 'Datan och kopplingarna'), rubrik: 'Datan', text: 'Kvalitet, kopplingar mellan posterna, dubbletter och ogiltiga värden – och antal poster per typ. <b>Kontrollera datan</b> eller exportera.' },
      { mal: medRubrik('.ao-band', 'Vem gör vad och när'), rubrik: 'Aktiviteten', text: 'Händelser per konto och dag senaste 14 dagarna – mörkare ruta betyder fler.' },
      { mal: medRubrik('.ao-band', 'Senast i CRM:et'), rubrik: 'Senast i CRM:et', text: 'De senaste händelserna i hela CRM:et. <b>Hela loggen</b> öppnar granskningen.' },
      { mal: medRubrik('.ao-band', 'System och fel'), rubrik: 'System och fel', text: 'Fel sedan sidan laddades, lagringen, version och nätverket.' },
      { mal: medRubrik('.ao-band', 'Bör åtgärdas'), rubrik: 'Bör åtgärdas', text: 'Förslag med knappen direkt: skanna, slå på utloggning vid inaktivitet, exportera en säkerhetskopia, sätta mål. Längst ned: kontolista (CSV), systemrapport, rensa chattfiler, rensa loggen och återställ data.' }
    ]
  });

  T.push({
    id: 'adminpanel', grupp: 'admin', vy: 'admin', roller: ['admin'], namn: 'Adminpanelen', beskrivning: 'Konton, roller, behörigheter, data och granskningsloggen.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/admin', mal: '.ap-hjalte', rubrik: 'Kontrollrummet', text: 'Konton, poster i CRM:et, händelser senaste 7 dagarna och säkerhetspoängen. Knapparna: <b>Lägg till konto</b>, Säkerhetshubben och <b>Exportera data</b>.' },
      { mal: medRubrik('.ao-band', 'Konton och roller'), rubrik: 'Konton och roller', text: 'Filtrera på Alla, Sälj, Produktion, Ledning eller Inaktiverade. <b>Ändra</b>, <b>Logga in som</b> (demo) eller <b>Inaktivera</b> ett konto.' },
      { mal: medRubrik('.ao-band', 'Bör åtgärdas'), rubrik: 'Bör åtgärdas', text: 'Förslag med knappen direkt – samma som i Kontrollcentralen.' },
      { mal: medRubrik('.ao-band', 'Vem får göra vad'), rubrik: 'Behörigheter', text: 'En tabell över vad Sälj, Chef, Produktion och Admin får göra.' },
      { mal: medRubrik('.ao-band', 'För den här webbläsaren'), rubrik: 'Inställningar', text: '<b>Logga ut vid inaktivitet</b> (Aldrig, 15 min, 30 min, en timme – en minut före visas en nedräkning), säkerhetskopia och systemrapport.' },
      { mal: medRubrik('.ao-band', 'Data och system'), rubrik: 'Data och system', text: 'Antal poster, läge, version och lagring. <b>Exportera (JSON)</b>, <b>Importera</b> och <b>Återställ exempeldata</b>.' },
      { mal: medRubrik('.ao-band', 'Granskning och ändringar'), rubrik: 'Granskningsloggen', text: 'Vem ändrade vad och när – filtrera på Allt, CRM, Konton, Support och Säkerhet.' }
    ]
  });

  T.push({
    id: 'sakerhet', grupp: 'admin', vy: 'sakerhet', roller: ['admin'], namn: 'Säkerhet', beskrivning: 'Sju kontroller, skanningens logg och poängen över tid.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/sakerhet', mal: '.sh-hjalte', rubrik: 'Säkerhet i realtid', text: 'En ring per kontroll runt den samlade poängen (100 minus avdragen för fynd).' },
      { mal: '.sh-drift', rubrik: 'Driftläget', text: 'Säkerhetspoängen, händelser senaste 7 dagarna, stoppade filer, konto och åtkomst – och de senaste händelserna.' },
      { mal: '.sh-verktyg', rubrik: 'Verktyg', text: 'Säkerhetsrapport, automatisk skanning, granska behörigheter och kopiera läget.' },
      { mal: medRubrik('section, .kort, .ad-band', 'Sju kontroller'), rubrik: 'Sju kontroller', text: 'Skadlig kod, uppdateringar, buggar och fel, läckor, intrångsförsök, avvikande beteende och trasigt. Varje kontroll kan köras för sig.' },
      { mal: medRubrik('section, .kort, .ad-band', 'Skanningens logg'), rubrik: 'Loggen', text: 'Skanningen skrivs live här.' },
      { mal: medRubrik('section, .kort, .ad-band', 'Poängen över tid'), rubrik: 'Poängen över tid', text: 'Varje skanning sparas så att du ser trenden.' }
    ]
  });

  T.push({
    id: 'supportlage', grupp: 'admin', vy: 'admin-support', roller: ['admin'], namn: 'Supportläget', beskrivning: 'Gå in i en säljares konto för att hjälpa till.',
    rollText: 'Gäller administratören.',
    steg: [
      { sida: '#/kontroll', rubrik: 'Hjälpa en säljare', text: 'Administratören skapar inga säljposter själv. I <b>supportläget</b> ser och arbetar du i en säljares konto – säljaren märker inget och allt loggas i säkerhetsloggen.' },
      { mal: '.sido__konto', rubrik: 'Teamet', vanta: true, efterKlick: 900, placering: 'hoger', text: 'Klicka på en säljare under <b>Teamet</b> för att gå in i kontot.' },
      { mal: '.stod-band', rubrik: 'Du är i säljarens konto', text: 'Bandet högst upp visar alltid vems konto som är öppet och hur länge. Härifrån kan du byta säljare. Nu fungerar säljarnas guider också.' },
      { mal: '.stod-band__ut', rubrik: 'Tillbaka till Admin', vanta: true, efterKlick: 700, text: 'Klicka här (eller <kbd>Shift</kbd>+<kbd>Esc</kbd>) för att lämna supportläget.' },
      { rubrik: 'Klart', text: 'Du är tillbaka som administratör i Kontrollcentralen.' }
    ]
  });

  /* =====================================================================
     FLÖDEN FRÅN START TILL SLUT
     ===================================================================== */
  T.push({
    id: 'flode-ny-kund', grupp: 'flode', vy: 'flode-1', roller: ['salj'], namn: '1. Ny kund från start till slut', beskrivning: 'Förfrågan → ta den → kontakt → kund → affär på tavlan.', nasta: 'flode-offert',
    rollText: 'Gäller säljare – gå in i en säljares konto via supportläget.',
    klarText: 'Förfrågan är nu en kund med en affär på säljtavlan. Nästa flöde: från affär till offert.',
    steg: [
      { sida: '#/forfragningar', rubrik: 'Från förfrågan till affär', text: '<p>Så här tar du en ny kund hela vägen: förfrågan → första kontakt → kundkort → affär på säljtavlan.</p><p>Guiden skapar en exempelförfrågan åt dig.</p>' },
      { mal: '[data-g="simulera"]', rubrik: 'En förfrågan kommer in', vanta: true, efterKlick: 700, text: 'Klicka på <b>Simulera ny förfrågan</b> – så ser det ut när någon fyller i formuläret på hemsidan. Ringer någon in använder du <b>Lägg in förfrågan</b>.' },
      { mal: '.inkorg__lista .fl.vald', rubrik: 'Överst i inkorgen', placering: 'hoger', text: 'Den nya förfrågan ligger överst med sin leadpoäng och är vald till höger.' },
      { mal: '.fd__huvud [data-g="f-tilldela"]', rubrik: 'Ta den', vanta: true, efterKlick: 500, text: 'Klicka på <b>Ta den</b> så att teamet ser att förfrågan är din.' },
      { mal: '.nbs', rubrik: 'Ring inom svarsmålet', text: 'Nästa bästa steg är att ringa. Strecket visar hur mycket av svarsmålet som gått. Hinner du inte? <b>Påminn om 2 h</b> lägger en uppgift.' },
      { mal: '.inkorg__las .guide', rubrik: 'Under samtalet', fri: true, text: 'Gå igenom samtalsguiden och bocka av: detaljplan, byggnader, tomtgräns, framkomlighet, grund och tidplan.' },
      { mal: '.nbs [data-g="f-status"][data-status="kontaktad"]', rubrik: 'Markera som kontaktad', vanta: true, efterKlick: 600, text: 'Efter samtalet: klicka <b>Kontaktad</b>. Då skapas kundkortet automatiskt och samtalet loggas.' },
      { mal: '.nbs [data-g="f-skapa-affar"]', rubrik: 'Skapa affären', vanta: true, efterKlick: 700, text: 'Nästa steg är en affär. Klicka på <b>Skapa affär</b>.' },
      { mal: '.ark [data-modellrad]', rubrik: 'Välj hus', behallArk: true, fri: true, text: 'Huset är föreslaget utifrån förfrågan. Värdet hämtas ur prislistan när du byter.' },
      { mal: '.ark #ny-affar-form .falt-rad', rubrik: 'Värde och steg', behallArk: true, fri: true, text: 'Affären läggs i <b>Kontakt tagen</b> eftersom du redan pratat med kunden. Ändra titel och värde om du vill.' },
      { mal: '.ark [form="ny-affar-form"][type="submit"]', rubrik: 'Spara', behallArk: true, vanta: true, efterKlick: 800, text: 'Klicka på <b>Skapa affär</b>.' },
      { mal: '.afhero', rubrik: 'Affären är skapad', text: 'Kunden, huset, värdet och chansen att vinna. Förfrågan är markerad <b>Blev affär</b>.' },
      { mal: '.af-nasta', rubrik: 'Nästa: platsbesöket', text: 'Nu föreslår CRM:et att boka ett platsbesök. När det är bokat klickar du <b>Platsbesöket är bokat</b> så flyttas affären vidare.' },
      { mal: '[data-af="kund"]', rubrik: 'Kundkortet finns', placering: 'vanster', text: 'Kunden skapades när du markerade förfrågan som kontaktad. Allt du loggar hamnar där.' },
      { mal: meny('salj'), rubrik: 'Till säljtavlan', vanta: true, efterKlick: 700, text: 'Klicka på <b>Säljtavla</b>.' },
      { mal: '#spalt-kontakt', rubrik: 'Här är den', placering: 'hoger', text: 'Affären ligger i <b>Kontakt tagen</b>. Dra den vidare när ni bokat besöket – eller använd knappen på kortet.' }
    ]
  });

  T.push({
    id: 'flode-offert', grupp: 'flode', vy: 'flode-2', roller: ['salj'], namn: '2. Från affär till offert', beskrivning: 'Skapa offert, rader ur prislistan, PDF, skicka, ny version och förläng.', nasta: 'flode-mote',
    rollText: 'Gäller säljare.',
    klarText: 'Offerten är skickad och affären ligger i Offert skickad. Nästa flöde: hålla ett kundmöte.',
    fore: function (c) { c.affar = valjAffar(['besok', 'kontakt', 'ny'], true); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.afhero', rubrik: 'Från affär till offert', text: 'Efter platsbesöket vet du vilket hus det blir och vad som ska med. Då är det dags för offerten.' },
      { mal: ['.af-nasta [data-g="skapa-offert"]', '[data-af="offert"] [data-g="skapa-offert"]'], rubrik: 'Skapa offert', vanta: true, efterKlick: 700, text: 'Klicka på <b>Skapa offert</b>. Huset, frakt och montage läggs in ur prislistan.',
        saknas: 'Affären har redan en offert – öppna den från offertkortet.' },
      { mal: '.ostatus', rubrik: 'Ett utkast', text: 'Offerten är ett <b>utkast</b> tills du markerar den som skickad. Den gäller i 30 dagar.' },
      { mal: '.offertred .modellrad', rubrik: 'Huset', text: 'Byt hus här – första raden och priset byts automatiskt.' },
      { mal: '.offertrader', rubrik: 'Raderna', fri: true, text: 'Ändra text, antal och pris direkt. Krysset tar bort en rad.' },
      { mal: '.offertlagg', rubrik: 'Lägg till ur prislistan', fri: true, fyll: { '[data-lagg]': 'altan' }, text: 'Välj ett tillval, t.ex. <b>Altan i trä, 12 m²</b>. Eller <b>Egen rad</b> för något som inte finns i listan.' },
      { mal: '.offertsumma', rubrik: 'Summan', text: 'Summan räknas om direkt och blir affärens nya värde på säljtavlan.' },
      { mal: '.dokyta', rubrik: 'Dokumentet', placering: 'vanster', text: 'Så här ser kunden offerten. <b>Skriv ut / PDF</b> sparar den som PDF att skicka.' },
      { mal: '[data-g="offert-skicka"]', rubrik: 'Markera som skickad', vanta: true, efterKlick: 600, text: 'Har du skickat PDF:en? Klicka <b>Markera som skickad</b>. Affären flyttas till <b>Offert skickad</b> och mejlet loggas.' },
      { mal: '.ostatus', rubrik: 'Skickad', text: 'Nu räknas giltigheten ned. Ringen blir varm när det är sju dagar kvar.' },
      { mal: '.off-not', rubrik: 'Behöver något ändras?', text: 'En skickad offert ändras inte – kunden har redan sin. Klicka <b>Ny version</b>: en kopia skapas som du ändrar och skickar, den gamla markeras som ersatt.' },
      { mal: '.vyhuvud [data-g="aff-vinn"]', rubrik: 'När kunden säger ja', text: '<b>Kunden godkände</b> gör affären vunnen och skapar projektet. Det går vi igenom i flödet <b>Från vunnen affär till överlämning</b>.' },
      { sida: '#/offerter', mal: '.snartut', rubrik: 'Följ upp och förläng', placering: 'vanster', text: 'Under Offerter samlas de som går ut snart. <b>Följ upp</b> öppnar affären, <b>+14 d</b> förlänger giltigheten.' }
    ]
  });

  T.push({
    id: 'flode-mote', grupp: 'flode', vy: 'flode-3', roller: ['salj'], namn: '3. Hålla ett kundmöte', beskrivning: 'Förbered, presentera, räkna, anteckna och boka nästa steg.', nasta: 'flode-dokument',
    rollText: 'Gäller säljare.',
    klarText: 'Mötet är hållet och anteckningen ligger i kundens historik. Nästa flöde: dokumenten.',
    fore: function (c) { c.affar = valjAffar(['besok', 'kontakt', 'ny', 'offert']); },
    steg: [
      { sida: '#/mote', rubrik: 'Kundmötet', text: 'Ett bra möte har ett mål: ett beslut om nästa steg. Så här förbereder du, presenterar och följer upp.' },
      { mal: '[data-g="mote-valj"]', rubrik: 'Välj kund', vanta: true, efterKlick: 600, text: 'Välj affären mötet gäller. Kunden, förfrågan och huset följer med in i presentationen.' },
      { mal: '.upplagg', rubrik: 'Upplägget', fri: true, text: '<b>Fullt möte</b> (alla bilder), <b>Kort möte</b> eller <b>Bara kalkylen</b>. Bocka i och ur bilder – tidsbandet visar längden.' },
      { mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta', vanta: true, efterKlick: 900, text: 'Klicka på <b>Starta presentation</b>.' },
      { mal: '.mote__botten', rubrik: 'Presentera', tangenter: true, text: 'Bläddra med <kbd>' + PV + '</kbd> <kbd>' + PH + '</kbd>. Bilderna: välkommen, er förfrågan, byggt under tak, husen i 3D, vad ni får bygga, så går det till, kalkylen och nästa steg.' },
      { mal: '.mote [data-mote="anteckna"]', rubrik: 'Anteckna', vanta: true, tangent: 'n', text: 'Öppna anteckningarna (<kbd>N</kbd>).' },
      { mal: '.mote__anteckning textarea', rubrik: 'Skriv', fri: true, fyll: { 'textarea': 'Tomten sluttar lite. Vill ha altan. Återkommer om tidplanen.' }, text: 'Skriv det viktiga medan ni pratar.' },
      { mal: '.mote__prick[aria-label="Räkna på ert hus"]', rubrik: 'Räkna på huset', vanta: true, tangent: 'k', efterKlick: 900, text: 'Gå till kalkylen (<kbd>K</kbd>).' },
      { mal: '.mote__bild[data-id="kalkyl"]', rubrik: 'Kalkylen', fri: true, luft: -40, text: 'Välj hus och tillval tillsammans med kunden. <b>Spara som offert</b> skapar offerten direkt på affären.' },
      { mal: '.mote__prick[aria-label="Nästa steg"]', rubrik: 'Nästa steg', vanta: true, efterKlick: 900, text: 'Avsluta på sista bilden.' },
      { mal: '.mote__bild[data-id="nasta"]', rubrik: 'Ett beslut', luft: -40, text: '<b>Boka platsbesök</b> (uppgift om en vecka, affären flyttas till besök) eller <b>mejla en sammanfattning</b>.' },
      { mal: '.mote [data-mote="stang"]', rubrik: 'Avsluta', vanta: true, efterKlick: 800, text: 'Stäng presentationen. Anteckningen sparas i kundens historik med mötets längd.' },
      { mal: '.logga-mote', rubrik: 'Uppföljning', text: 'Logga möten du håller utan presentationen här – nästa steg blir en uppgift under Att göra.' }
    ]
  });

  T.push({
    id: 'flode-dokument', grupp: 'flode', vy: 'flode-4', roller: ['salj'], namn: '4. Hantera dokument', beskrivning: 'Hitta, öppna, förläng, ladda upp och fyll i mallar.', nasta: 'flode-overlamning',
    rollText: 'Gäller säljare.',
    steg: [
      { sida: '#/dokument', mal: iArkiv('.dk-hjalte__text'), rubrik: 'Dokumenten', placering: 'hoger', text: 'Offerter, ordrar, ritningar, bygglov, checklistor och foton – allt som hör till en affär. Inget raderas: det du inte behöver arkiveras.' },
      { mal: iArkiv('.dk-att'), valfri: true, rubrik: 'Börja med det som brådskar', text: '<b>Att hantera</b> listar offerter utan svar och underlag som saknas. Knapparna gör det direkt.' },
      { mal: iArkiv('.dk-fack'), rubrik: 'Facken', text: 'Klicka på ett fack för att bara se den typen.' },
      { mal: '.dk-ladda', rubrik: 'Ladda upp', text: 'Ladda upp eller dra in filer. Varje fil kontrolleras först (filskannern), sedan väljer du typ, kund och projekt.' },
      { mal: iArkiv('[data-g="dok-detalj"]'), rubrik: 'Öppna en offert', vanta: true, efterKlick: 600, text: 'Klicka på den första offerten.' },
      { mal: '.ark .dkd', rubrik: 'Tidslinjen', behallArk: true, text: 'Skapad, godkänd eller går ut – och dagarna som är kvar.' },
      { mal: '.ark .ark__fot', rubrik: 'Gör något', behallArk: true, text: '<b>Förläng 14 d</b>, mejla en påminnelse, ring kunden eller gå till affären.' },
      { fore: function () { if (IH.stangArk) IH.stangArk(true); }, mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Mallarna', vanta: true, efterKlick: 600, text: 'Klicka på <b>Mallar</b>.' },
      { mal: '[data-g="mall-exempel"]', rubrik: 'Visa ett exempel', vanta: true, efterKlick: 700, text: 'Klicka för att se mallen ifylld med exempeldata.' },
      { mal: '.ark .ml-exempel', rubrik: 'Exemplet', behallArk: true, text: 'Så ser dokumentet ut. <b>Fyll i för en kund</b> väljer kund och skriver ut det.' },
      { fore: function () { if (IH.stangArk) IH.stangArk(true); }, mal: '[data-g="dok-mall"]', rubrik: 'Fyll i', text: '<b>Fyll i</b> på en mall väljer kund och skriver ut. Det loggas på kunden. <b>Skriv ut en tom mall</b> när du vill fylla i för hand.' }
    ]
  });

  T.push({
    id: 'flode-overlamning', grupp: 'flode', vy: 'flode-5', roller: ['salj'], namn: '5. Från vunnen affär till överlämning', beskrivning: 'Order signerad → projekt → checklistor → montage → klart.',
    rollText: 'Gäller säljare.',
    klarText: 'Huset är överlämnat! Det är hela resan – från förfrågan till nyckel.',
    fore: function (c) { c.affar = valjAffar(['forhandling', 'offert']); },
    steg: [
      { sida: function (c) { return '#/salj/' + c.affar; }, mal: '.af-nasta', rubrik: 'Stäm av och signera', text: 'I förhandlingen går ni igenom tillval, leverans och montage. När kunden säger ja signeras ordern.' },
      { mal: '.af-nasta [data-g="aff-steg"][data-steg="forhandling"]', rubrik: 'Till förhandling', vanta: true, efterKlick: 700,
        om: function (c) { var a = IH.affar && IH.affar(c.affar); return !!(a && a.steg === 'offert'); },
        text: 'Affären ligger i Offert skickad. Kunden vill gå vidare – klicka för att flytta den till <b>Förhandling</b>.' },
      { mal: '.af-nasta [data-g="aff-vinn"]', rubrik: 'Order signerad', vanta: true, efterKlick: 900, text: 'Klicka på <b>Order signerad</b>. Affären blir vunnen, offerten godkänd och ett projekt skapas hos produktionen – med konfetti.' },
      { sida: function (c) { return '#/produktion/' + (projektFor(c.affar) || forstaProjekt()); }, mal: '.ark .projark__3d', rubrik: 'Projektet', behallArk: true, text: 'Projektet skapades med montage planerat om tolv veckor. Huset syns i 3D.' },
      { mal: '.ark .stegare--prod', rubrik: 'Sex steg till nyckel', behallArk: true, text: 'Ritning &amp; lov → Tillverkning → Grund &amp; mark → Leverans &amp; montage → Slutbesiktning → Klart.' },
      { mal: '.ark .projark__check', rubrik: 'Innan montaget', behallArk: true, fri: true, text: 'Bocka av när ritningarna är klara, bygglovet eller anmälan inlämnad, grunden klar och vägen fram fungerar för lastbil och kran.' },
      { mal: '.ark .projark__datum', rubrik: 'Montagedagen', behallArk: true, fri: true, text: 'Ändra montagedagen när den är bestämd – kalendern följer med.' },
      { fore: function () { if (IH.stangArk) IH.stangArk(true); }, sida: '#/dokument', mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Dokumenten till kunden', vanta: true, efterKlick: 600, text: 'Klicka på <b>Mallar</b>.' },
      { mal: medRubrik('.ml-grupp', 'Sälj'), rubrik: 'Tack för ordern', text: 'Skicka <b>Tack för ordern</b> – vad som händer härnäst.' },
      { mal: medRubrik('.ml-grupp', 'Bygget'), rubrik: 'Inför leveransen', text: '<b>Checklista inför montage</b> några veckor före och <b>Leveransplan</b> veckan före: dag, tid, tillfart, kran och vem som tar emot.' },
      { mal: medRubrik('.ml-grupp', 'Överlämning'), rubrik: 'Överlämningen', text: '<b>Egenkontroll efter montage</b> och <b>Överlämningsprotokoll</b> med underskrifter när huset lämnas över.' },
      { sida: function (c) { return '#/produktion/' + (projektFor(c.affar) || forstaProjekt()); },
        mal: function (c) {
          // Projektpanelen öppnas av adressen – men inte om samma projekt redan var öppet nyss. Då öppnar guiden den.
          var k = document.querySelector('.ark .stegare--prod li:last-child button');
          if (!k && !document.querySelector('.ark') && IH.projArk && !c.oppnadPanel) { c.oppnadPanel = true; setTimeout(function () { if (!document.querySelector('.ark')) IH.projArk(projektFor(c.affar) || forstaProjekt()); }, 700); }
          return k;
        }, rubrik: 'Lämna över', behallArk: true, vanta: true, efterKlick: 900, text: 'När slutbesiktningen är gjord: klicka på <b>Klart</b>.' },
      { rubrik: 'Huset är överlämnat', text: 'Projektet ligger under Klart och kunden finns kvar i CRM:et – med hela historiken från första förfrågan.' }
    ]
  });

  IH.guide.registrera(T);
})();
