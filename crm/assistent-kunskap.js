/* ============================================================
   Legohus CRM – hjälpassistentens kunskapsbas (2026-11-01).
   Handskriven ur crm/guide/KUNSKAP.md: korta svar på vanliga frågor.
   Turerna i turer.js läggs till automatiskt när assistenten startar,
   så att guiderna också går att hitta (assistent.js).
   Ett ämne: { id, t: titel, o: sökord, s: svar (html), sida, visa, tur,
   vy: sidan rollen måste få se, roller: ['chef'|'admin'] }.
     visa: { mal, sida, rubrik, text } = "Visa mig" pekar ut det med guiden
   Ändras CRM:et: uppdatera KUNSKAP.md och den här filen.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  var A = IH.assistentKunskap = {};

  // Synonymer: ord man skriver -> ordet som står i kunskapsbasen (utan å, ä, ö)
  A.synonymer = {
    lead: 'forfragan', leads: 'forfragan', intresseanmalan: 'forfragan', intressent: 'forfragan', inkorg: 'forfragan', inkorgen: 'forfragan', ansokan: 'forfragan',
    deal: 'affar', deals: 'affar', arende: 'affar', pipeline: 'saljtavla', pipen: 'saljtavla', kanban: 'saljtavla', tavlan: 'saljtavla', tavla: 'saljtavla', saljtavlan: 'saljtavla',
    klient: 'kund', kopare: 'kund', bestallare: 'kund', kontakt: 'kund', kontakter: 'kund', kundkort: 'kund', kundkortet: 'kund',
    anbud: 'offert', prisforslag: 'offert', kostnadsforslag: 'offert', pris: 'prislista', priser: 'prislista', priset: 'prislista', kostar: 'prislista', kostnad: 'prislista',
    todo: 'uppgift', task: 'uppgift', uppdrag: 'uppgift', paminnelse: 'paminn', paminna: 'paminn', paminnelser: 'paminn', notis: 'avisering', notiser: 'avisering', larm: 'paminn', klocka: 'avisering', klockan: 'avisering',
    chatt: 'meddelande', chatta: 'meddelande', chatten: 'meddelande', meddelanden: 'meddelande', teams: 'videomote', zoom: 'videomote', video: 'videomote', videosamtal: 'videomote', samtal: 'ring',
    presentera: 'presentation', bildspel: 'presentation', presentationen: 'presentation', kalkyl: 'kalkyl', kalkylen: 'kalkyl', rakna: 'kalkyl',
    darkmode: 'mork', morkt: 'mork', morka: 'mork', farg: 'tema', farger: 'tema', utseende: 'tema', ljust: 'ljus', glaset: 'glas', genomskinlig: 'glas',
    bygge: 'projekt', bygget: 'projekt', produktion: 'projekt', montaget: 'montage', leverans: 'montage', overlamna: 'overlamning', nyckel: 'overlamning', nycklar: 'overlamning',
    utskrift: 'pdf', exportera: 'export', excel: 'csv', importera: 'import', ladda: 'ladda upp', fil: 'dokument', filer: 'dokument', ritning: 'dokument', ritningar: 'dokument',
    genvag: 'kortkommando', genvagar: 'kortkommando', tangent: 'kortkommando', tangenter: 'kortkommando', snabbtangent: 'kortkommando', kortkommandon: 'kortkommando',
    profilen: 'profil', lonenummer: 'profil', sjuk: 'franvaro', sjukanmal: 'franvaro', semester: 'franvaro', ledig: 'franvaro',
    logga: 'logga', utloggning: 'logga ut', loggaut: 'logga ut', losenord: 'inloggning', konton: 'konto', anvandare: 'konto', behorighet: 'roller', rattigheter: 'roller', gdpr: 'registerutdrag',
    backup: 'export', sakerhetskopia: 'export', bygglov: 'lov', marken: 'mark', tomt: 'mark', tomten: 'mark', jord: 'mark', markkoll: 'mark', sgu: 'mark',
    forlorat: 'forlorad', forlora: 'forlorad', tappat: 'forlorad', vinna: 'vunnen', vann: 'vunnen', signera: 'order', signerad: 'order', ordern: 'order', dubblett: 'dubblett', dubbletter: 'dubblett',
    sok: 'sok', soka: 'sok', hitta: 'sok', palett: 'sok', meny: 'meny', menyn: 'meny', sidomeny: 'meny', sidomenyn: 'meny', chefsvy: 'chef', ledning: 'chef', support: 'supportlage', supportlaget: 'supportlage'
  };

  A.amnen = [
    /* --- Hitta runt --- */
    { id: 'meny', t: 'Menyn', o: 'meny sidor navigera hitta runt forsaljning bygg', s: 'Menyn har <b>Översikt</b>, <b>Försäljning</b> (Förfrågningar, Säljtavla, Kunder, Offerter, Kundmöte) och <b>Bygg</b> (Projekt, Dokument, Kolla marken). Längst ner finns Meddelanden, Att göra och Inställningar.', tur: 'valkommen', visa: { mal: ['.sido__nav', '.mobilmeny', '.sido-rals'], rubrik: 'Menyn', text: 'Här finns alla sidor.' } },
    { id: 'meny-infalld', t: 'Fälla in menyn', o: 'falla in dolj menyn smal list mer plats infalld', s: 'Fäll in menyn med knappen på kanten eller tangenten <b>[</b>. Då blir den en smal list med ikoner. Sök, Ny och konto flyttar upp i toppraden.', visa: { mal: '[data-sido-knapp]', rubrik: 'Fäll in menyn' } },
    { id: 'sok', t: 'Sökningen', o: 'sok hitta palett kommando ctrl k snabbt', s: 'Tryck <b>Ctrl K</b> eller <b>/</b> var du än är. Sök på kund, affär, förfrågan, offert, dokument och anteckningar, eller skriv ett kommando som <b>Ny kund</b>.', visa: { mal: ['.sido__sok', '.topp .sok'], rubrik: 'Sök', text: 'Ctrl K öppnar sökningen.' }, tur: 'valkommen' },
    { id: 'kortkommando', t: 'Kortkommandon', o: 'kortkommando tangentbord snabbtangenter', s: '<b>Ctrl K</b> sök, <b>N</b> skapa nytt, <b>[</b> fäll in menyn, <b>Esc</b> stäng. I förfrågningar: <b>J</b> och <b>K</b> bläddrar, <b>U</b> ger svarsutkast. <b>?</b> visar alla kortkommandon.' },
    { id: 'ny', t: 'Skapa något nytt', o: 'skapa ny lagga till plus knappen', s: 'Plusknappen eller tangenten <b>N</b> skapar förfrågan, kund, affär eller uppgift. Säg till exempel <b>ny kund Anna Berg</b> så öppnar jag formuläret.', visa: { mal: ['.sido__ny', '.topp [data-g="ny"]'], rubrik: 'Skapa nytt', text: 'N gör samma sak.' }, vy: 'kunder' },
    { id: 'oversikt', t: 'Översikten', o: 'oversikt startsida hem dagens lage nyckeltal', s: '<b>Översikten</b> sammanfattar dagen: nästa steg, nyckeltal, fokus i dag och att göra i dag.', sida: '#/', tur: 'oversikt' },
    { id: 'lar', t: 'Guiderna', o: 'guide guider lar kurs kurser utbildning rundtur hjalp tur lara', s: 'Under boken vid menyn finns <b>Lär dig CRM:et</b> med korta kurser där du provar själv. Framstegen sparas för ditt konto.' },
    { id: 'layout', t: 'Layout', o: 'layout minimal normal full plats tat', s: 'Tre layouter: <b>Minimal</b> visar bara det du jobbar med, <b>Normal</b> ger överblick och <b>Full</b> visar allt med bilder och 3D. Välj under Inställningar, i kontomenyn eller sök på <b>layout</b>.', sida: '#/installningar', tur: 'utseende', visa: { sida: '#/installningar', mal: '.inst-layout', rubrik: 'Layout' } },
    { id: 'tema', t: 'Tema', o: 'tema farg mork ljus fargglad bygg office original utseende', s: 'Sex teman: Original, Ljus, Mörk, Färgglad, Bygg och Office, plus Följ systemet. Välj under Inställningar, i kontomenyn eller sök på <b>mörk</b>.', sida: '#/installningar', tur: 'utseende', visa: { sida: '#/installningar', mal: '.inst-tema', rubrik: 'Tema' } },
    { id: 'glas', t: 'Glasdesign', o: 'glas glasdesign genomskinlig frostat', s: 'Glasdesignen slås på och av under Inställningar, vid temat, och i kontomenyn. Valet sparas för ditt konto.', sida: '#/installningar', visa: { sida: '#/installningar', mal: '.inst-tema .glas-vaxel', rubrik: 'Glasdesign' } },
    { id: 'konto', t: 'Kontomenyn', o: 'konto kontomeny status narvaro online lunch', s: 'Klicka på ditt konto längst ned i menyn. Där väljer du <b>status</b> (Online, I möte, Upptagen, Lunch med flera), tema, layout och Min profil.', visa: { mal: ['.anv', '.topp__konto', '.mobilmeny [data-mer]'], rubrik: 'Ditt konto' } },
    { id: 'logga-ut', t: 'Logga ut', o: 'logga ut utloggning byta konto', s: '<b>Logga ut</b> finns längst ned i menyn. <b>Byt konto</b> finns i kontomenyn.', visa: { mal: ['.sido [data-g="logga-ut"]', '.anv', '.topp__konto'], rubrik: 'Logga ut' } },
    { id: 'aviseringar', t: 'Aviseringar', o: 'avisering klocka notis paminn skrivbord olast', s: 'Klockan samlar påminnelser och det som rör dig. <b>Slå på</b> skrivbordsaviseringar i panelen. De visas när CRM:et är öppet i webbläsaren.', tur: 'aviseringar', visa: { mal: ['.sido .ih-klocka', '.topp .ih-klocka', '.sido-rals__klocka'], rubrik: 'Klockan' } },
    /* --- Förfrågningar --- */
    { id: 'forfragan', t: 'Förfrågningar', o: 'forfragan forfragningar inkorg svarsmal poang', s: 'Inkorgen samlar förfrågningar med poäng och svarsmål på <b>24 timmar</b>. Öppna en, följ <b>Nästa bästa steg</b> och markera <b>Kontaktad</b> när ni pratat.', sida: '#/forfragningar', tur: 'forfragningar', vy: 'forfragningar' },
    { id: 'forfragan-ny', vag: 'forfragan', t: 'Lägga in en förfrågan', o: 'lagga in forfragan ringde mejlade manuellt ny forfragan', s: 'Under Förfrågningar klickar du på <b>Lägg in förfrågan</b> när någon ringer eller mejlar. Dubbletter upptäcks på telefon och e-post.', vy: 'forfragningar', visa: { sida: '#/forfragningar', mal: '[data-g="ny-forfragan"]', rubrik: 'Lägg in förfrågan' } },
    { id: 'forfragan-svar', t: 'Svara på en förfrågan', o: 'svara forfragan svarsutkast mejl utkast ta den', s: 'Öppna förfrågan, klicka på <b>Ta den</b>, ring eller välj <b>Svarsutkast</b> (tangenten U) och markera sedan <b>Kontaktad</b>. Då skapas kundkortet.', vy: 'forfragningar', tur: 'flode-ny-kund', visa: { sida: '#/forfragningar', mal: '.nbs', rubrik: 'Nästa bästa steg' } },
    { id: 'samtalsguide', t: 'Samtalsguiden', o: 'samtalsguide fragor forsta samtalet detaljplan', s: 'I förfrågan finns <b>Samtalsguiden</b>: detaljplan, byggnader, tomtgräns, framkomlighet, grund, strandskydd, anmälan och tidplan. Bocka av medan du pratar.', vy: 'forfragningar', visa: { sida: '#/forfragningar', mal: '.inkorg__las .guide', rubrik: 'Samtalsguiden' } },
    { id: 'poang', t: 'Poängen', o: 'poang score vardering varm', s: 'Poängen räknas fram ur svaren och texten. Skälen står bredvid. Den är en fingervisning, inget facit.', vy: 'forfragningar' },
    { id: 'simulera', t: 'Simulera en förfrågan', o: 'simulera testa exempel forfragan prova', s: '<b>Simulera ny förfrågan</b> visar hur det ser ut när någon fyller i hemsidans formulär.', vy: 'forfragningar', visa: { sida: '#/forfragningar', mal: '[data-g="simulera"]', rubrik: 'Simulera' } },
    /* --- Affärer --- */
    { id: 'saljtavla', t: 'Säljtavlan', o: 'saljtavla tavla steg spalter affarer pipeline', s: 'Säljtavlan har sex steg: Ny förfrågan 10 %, Kontakt tagen 20 %, Tomt och platsbesök 40 %, Offert skickad 60 %, Förhandling 75 % och Order signerad.', sida: '#/salj', tur: 'saljtavla', vy: 'salj' },
    { id: 'affar-ny', vag: 'affar', t: 'Skapa en affär', o: 'skapa ny affar', s: 'Klicka på <b>Skapa affär</b> på förfrågan, <b>Ny affär</b> på kundkortet eller på säljtavlan. Värdet hämtas ur prislistan.', vy: 'salj', tur: 'flode-ny-kund', visa: { sida: '#/salj', mal: '[data-g="ny-affar"]', rubrik: 'Ny affär' } },
    { id: 'affar-flytta', t: 'Flytta en affär', o: 'flytta affar steg dra slapp vidare', s: 'Dra kortet till nästa spalt eller klicka på <b>Vidare</b> på kortet. På affärssidan klickar du på steget.', vy: 'salj', tur: 'saljtavla', visa: { sida: '#/salj', mal: '.tavla .aff', rubrik: 'Affärskortet' } },
    { id: 'viktat', t: 'Viktad prognos', o: 'viktat varde prognos chans procent', s: 'Viktat värde är affärens värde gånger chansen i steget. Summan är den viktade prognosen.', vy: 'salj', visa: { sida: '#/salj', mal: '.puls__kpi', rubrik: 'Prognosen' } },
    { id: 'star-still', t: 'Står still', o: 'star still stilla gammal fastnat affar', s: '<b>Står still</b> betyder att affären inte ändrats på över 14 dagar. Filtret finns på säljtavlan.', vy: 'salj', visa: { sida: '#/salj', mal: '.tv-verktyg', rubrik: 'Filter' } },
    { id: 'forlorad', t: 'Förlorad affär', o: 'forlorad affar markera aterupppta orsak dra forlustdocka', s: 'Dra affären till förlustdockan eller välj <b>Markera som förlorad</b> med orsak. <b>Återuppta</b> finns under Förlorade på säljtavlan.', vy: 'salj' },
    { id: 'vunnen', t: 'Vinna en affär', o: 'vunnen vinna order signerad godkand', s: 'Klicka på <b>Order signerad</b> på affären eller <b>Kunden godkände</b> på offerten. Då blir affären vunnen och ett projekt skapas med montage om 12 veckor.', vy: 'salj', tur: 'flode-overlamning' },
    { id: 'affar-andra', t: 'Ändra eller ta bort en affär', o: 'andra ta bort radera affar titel forvantat avslut', s: 'På affärssidan finns <b>Ändra affären</b> och <b>Ta bort affären</b>. Borttagning går bara utan godkänd offert och kan ångras i 8 sekunder.', vy: 'salj' },
    /* --- Kunder --- */
    { id: 'kunder', t: 'Kunder', o: 'kunder kundregister lista varma filter', s: 'Under Kunder ser du alla kunder som kort eller lista. Filtrera på <b>Mina</b>, <b>Affär pågår</b> och <b>Behöver uppmärksamhet</b>.', sida: '#/kunder', tur: 'kunder', vy: 'kunder' },
    { id: 'kund-ny', vag: 'kund', t: 'Skapa en kund', o: 'skapa ny lagga till kund', s: 'Klicka på <b>Ny kund</b> under Kunder, eller säg <b>ny kund Anna Berg</b> så öppnar jag formuläret. En kund skapas också automatiskt när en förfrågan markeras Kontaktad.', vy: 'kunder', tur: 'kunder', visa: { sida: '#/kunder', mal: '[data-g="ny-kund"]', rubrik: 'Ny kund' } },
    { id: 'kundhalsa', t: 'Kundhälsan', o: 'kundhalsa halsa tal gron rod', s: 'Kundhälsan är ett tal 0–100 utifrån senaste kontakt, försenade uppföljningar och affärer. Grönt från 75, gult från 50, annars rött.', vy: 'kunder', tur: 'kundsida' },
    { id: 'kund-bort', t: 'Ta bort en kund', o: 'ta bort radera kund', s: 'Öppna kunden och välj <b>Ändra</b>. Där finns <b>Ta bort</b> om kunden inte är bunden till affärer eller projekt. Det går att ångra i 8 sekunder.', vy: 'kunder' },
    { id: 'dubblett', t: 'Slå ihop dubbletter', o: 'dubblett sla ihop sammanfoga kunder', s: 'Öppna kunden, klicka på <b>Mer</b> och välj <b>Slå ihop med…</b>.', vy: 'kunder' },
    { id: 'taggar', t: 'Taggar', o: 'tagg taggar etikett markera kund', s: 'Lägg till taggar på kundsidan. Kundlistan kan filtreras på tagg.', vy: 'kunder' },
    { id: 'registerutdrag', t: 'Registerutdrag', o: 'registerutdrag gdpr personuppgifter utdrag', s: 'På kundsidan: <b>Mer</b> och <b>Registerutdrag</b>, som utskrift eller JSON.', vy: 'kunder' },
    { id: 'import', t: 'Importera kunder', o: 'import importera csv lasa in kunder', s: 'Chef och admin kan <b>Importera</b> kunder från CSV under Kunder, högst 500 rader, med förhandsvisning och Ångra.', vy: 'kunder' },
    { id: 'export', t: 'Exportera', o: 'export exportera csv ladda ner lista', s: 'CSV-export finns på Kunder, Säljtavlan, Offerter, Dokument och Att göra.' },
    { id: 'historik', t: 'Logga samtal och anteckningar', o: 'logga anteckning samtal mejl mote historik skriva', s: 'På kund- eller affärssidan skriver du en rad under <b>Historik</b> och väljer Anteckning, Samtal, Mejl eller Möte.', vy: 'kunder', tur: 'affar' },
    /* --- Offerter --- */
    { id: 'offerter', t: 'Offerter', o: 'offerter lista traffsakerhet gar ut', s: 'Under Offerter ser du vad som väntar på svar och går ut snart. Offerter gäller i 30 dagar och kan förlängas 14 dagar i taget.', sida: '#/offerter', tur: 'offerter', vy: 'offerter' },
    { id: 'offert-ny', vag: 'offert', t: 'Skapa en offert', o: 'skapa ny offert hur', s: 'Klicka på <b>Skapa offert</b> på affären, eller <b>Ny offert</b> under Offerter. Huset, frakt och montage läggs in ur prislistan.', vy: 'offerter', tur: 'flode-offert', visa: { sida: '#/offerter', mal: '[data-g="offert-ny"]', rubrik: 'Ny offert' } },
    { id: 'offert-skicka', t: 'Skicka en offert', o: 'skicka offert mejla kund markera skickad', s: 'Klicka på <b>Skicka offerten</b>: skriv ut som PDF, öppna i mejlprogrammet, bifoga och klicka på <b>Markera som skickad</b>. CRM:et skickar inget själv.', vy: 'offerter', tur: 'flode-offert' },
    { id: 'offert-andra', t: 'Ändra en skickad offert', o: 'andra skickad offert ny version ersatt', s: 'En skickad offert ändras inte. Klicka på <b>Ny version</b>, ändra och skicka den. Den gamla markeras som ersatt.', vy: 'offerter', tur: 'offert' },
    { id: 'offert-forlang', t: 'Förlänga en offert', o: 'forlanga offert giltig giltighet 14 dagar', s: '<b>Förläng 14 d</b> finns på offerten, i listan och under Dokument.', vy: 'offerter', visa: { sida: '#/offerter', mal: ['.snartut', '.kundverktyg'], rubrik: 'Går ut snart' } },
    { id: 'offert-svar', t: 'När kunden svarar', o: 'kunden godkande avbojde svar offert', s: 'På offerten klickar du på <b>Kunden godkände</b> eller <b>Kunden avböjde</b>. Godkänd ger vunnen affär och projekt, avböjd ger förlorad affär med orsak.', vy: 'offerter' },
    { id: 'pdf', t: 'PDF och utskrift', o: 'pdf skriv ut utskrift dokument', s: 'Öppna offerten och klicka på <b>Skriv ut / PDF</b>. Välj Spara som PDF i utskriftsrutan.', vy: 'offerter' },
    { id: 'prislista', t: 'Prislistan', o: 'prislista pris priser tillval kostar frakt montage kranbil', s: 'Priserna ändras under <b>Inställningar</b>. Nya offerter och kalkylen räknar med dem. I prototypen är det exempelpriser.', sida: '#/installningar', visa: { sida: '#/installningar', mal: '.prisform', rubrik: 'Prislistan' } },
    { id: 'husen', t: 'Husen', o: 'hus husen modeller sadel pulpet kupa attefallshus fritidshus element', s: 'Modellerna är Sadel 30, Sadel 30 Bred, Pulpet 30, Kupa 40, Kupa 50 och Byggelement. Kupa 40 och 50 kräver bygglov.' },
    { id: 'lov', t: 'Bygglov', o: 'lov bygglov anmalan attefall', s: 'Kupa 40 och Kupa 50 kräver bygglov. Bygglov eller anmälan är en punkt i projektets checklista. Se också <b>Kolla marken</b>.' },
    /* --- Möten --- */
    { id: 'kundmote', t: 'Kundmöte', o: 'kundmote mote forbered upplagg fullt kort', s: 'Under Kundmöte väljer du affär och upplägg och klickar på <b>Starta presentation</b>. <b>Bara kalkylen</b> går direkt till priset.', sida: '#/mote', tur: 'kundmote', vy: 'mote' },
    { id: 'presentation', t: 'Presentationen', o: 'presentation presentera bildspel anteckningar helskarm', s: 'Bläddra med pilarna. <b>N</b> visar anteckningar och <b>K</b> hoppar till kalkylen. Anteckningen sparas i kundens historik när mötet stängs.', vy: 'mote', tur: 'presentation', visa: { sida: '#/mote', mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta presentation' } },
    { id: 'kalkyl', t: 'Kalkylen', o: 'kalkyl rakna pris mote spara som offert', s: 'I presentationen väljer du hus och tillval. <b>Spara som offert</b> skapar offerten på affären.', vy: 'mote', tur: 'flode-mote' },
    { id: 'logga-mote', t: 'Logga ett möte', o: 'logga mote efterhand anteckna', s: 'Under Kundmöte finns <b>Logga mötet</b>: kund, minuter, text och nästa steg, som blir en uppgift.', vy: 'mote', visa: { sida: '#/mote', mal: '.logga-mote', rubrik: 'Logga mötet' } },
    { id: 'videomote', t: 'Videomöten', o: 'videomote boka inbjudan lank gast kamera', s: 'Klicka på <b>Videomöte</b> på kund eller affär, eller säg <b>nytt videomöte</b>. Kunden får en länk och behöver inget konto. Prototypen fungerar mellan flikar i samma webbläsare.', tur: 'videomote', vy: 'mote', sida: '#/videomote' },
    { id: 'videomote-fel', t: 'Videomöte mellan datorer', o: 'videomote andra datorer fungerar inte signal server', s: 'Mellan olika datorer behövs en signalväxel och https. Det kräver en server. Nu fungerar mötet mellan flikar i samma webbläsare.', vy: 'mote' },
    /* --- Bygg --- */
    { id: 'projekt', t: 'Projekt', o: 'projekt produktion montage checklista steg bygge', s: 'Varje vunnen affär blir ett projekt: Ritning och lov, Tillverkning, Grund och mark, Leverans och montage, Slutbesiktning, Klart.', sida: '#/produktion', tur: 'projekt', vy: 'produktion' },
    { id: 'checklista', t: 'Checklistan', o: 'checklista innan montaget ritningar grund framkomlighet', s: 'Öppna projektet. Checklistan <b>Innan montaget</b> har ritningar (Legohus), lov, grund och framkomlighet (kunden).', vy: 'produktion', tur: 'projekt' },
    { id: 'overlamning', t: 'Lämna över huset', o: 'overlamning lamna over klart nyckel protokoll', s: 'Sätt projektet till <b>Klart</b>. CRM:et föreslår då överlämningsprotokollet och en uppföljning om 30 dagar.', vy: 'produktion', tur: 'flode-overlamning' },
    { id: 'dokument', t: 'Dokument', o: 'dokument arkiv fack ladda upp fil ritning foto', s: 'Under Dokument finns allt per fack. <b>Ladda upp</b> kontrollerar filen först. Inget raderas av sig självt.', sida: '#/dokument', tur: 'dokument', vy: 'dokument', visa: { sida: '#/dokument', mal: ['.dk-ladda', '.dk-hjalte__knappar'], rubrik: 'Ladda upp' } },
    { id: 'mallar', t: 'Dokumentmallar', o: 'mall mallar dokumentmall tack for ordern protokoll', s: 'Fliken <b>Mallar</b> under Dokument har sju mallar. <b>Fyll i</b> väljer kund och skriver ut.', vy: 'dokument', tur: 'dokument', visa: { sida: '#/dokument', mal: '[data-g="dok-flik"][data-f="mallar"]', rubrik: 'Mallar' } },
    { id: 'mejlmallar', t: 'Mallar för mejl och SMS', o: 'mejlmall smsmall mall mallar text', s: 'Under Inställningar skapar du mallar med fält som <b>{förnamn}</b>. CRM:et skickar inget själv, mallen öppnas i ditt eget program.', sida: '#/installningar', visa: { sida: '#/installningar', mal: '.inst-mallar', rubrik: 'Mallar' } },
    { id: 'mark', t: 'Kolla marken', o: 'mark kolla marken jordart berg vatten tomt sgu', s: '<b>Kolla marken</b> visar jordart, vatten och djup till berg från SGU. Det är översiktligt och ingen geoteknik. Från en kund kan resultatet sparas i historiken.', sida: '#/kolla-marken', vy: 'kunder' },
    /* --- Min dag --- */
    { id: 'att-gora', t: 'Att göra', o: 'att gora uppgift uppgifter lista vecka', s: 'Under Att göra lägger du till uppgifter, bockar av och skjuter upp med <b>+1 d</b>. Säg <b>ny uppgift ring Anna i morgon</b> så fyller jag i.', sida: '#/att-gora', tur: 'att-gora' },
    { id: 'uppgift-ny', vag: 'uppgift', t: 'Lägga till en uppgift', o: 'lagga till skapa ny uppgift gora', s: 'Under <b>Att göra</b> skriver du uppgiften, väljer kund och dag och klickar på <b>Lägg till</b>. Säg <b>ny uppgift ring Anna i morgon</b> så fyller jag i.', sida: '#/att-gora', tur: 'att-gora', visa: { sida: '#/att-gora', mal: '.nyuppg', rubrik: 'Ny uppgift' } },
    { id: 'upprepa', t: 'Upprepade uppgifter', o: 'upprepa upprepad aterkommande varje vecka uppgift', s: 'Ändra uppgiften och välj <b>Upprepa</b>: varje vecka, var 14:e dag eller varje månad. När den bockas av skapas nästa.' },
    { id: 'paminn', t: 'Påminnelser', o: 'paminn paminnelse larma uppgift', s: 'En uppgift med tid larmar när tiden passerat, med <b>Klar</b>, <b>+1 h</b> och <b>Öppna</b>. Det gäller när CRM:et är öppet.', tur: 'aviseringar' },
    { id: 'meddelande', t: 'Meddelanden', o: 'meddelande chatt skicka kollega grupp teamet', s: 'Under Meddelanden chattar du med teamet. <b>@</b> nämner en kollega, <b>#</b> länkar en kund eller affär och <b>/</b> ger mallar. I prototypen syns meddelanden bara i den här webbläsaren.', sida: '#/chatt', tur: 'chatt' },
    { id: 'chatt-uppgift', t: 'Uppgift av ett meddelande', o: 'uppgift av meddelande chatt skapa fast pinna', s: 'Klicka på <b>Mer</b> på meddelandet: skapa uppgift, påminn mig, fäst eller kopiera.', tur: 'chatt-verktyg' },
    { id: 'profil', t: 'Min profil', o: 'profil kalender bild namn andra', s: 'Under Min profil finns id-kort, aktivitet och kalender. Du når den via kontomenyn.', sida: '#/profil', tur: 'profil' },
    { id: 'kalender', t: 'Kalendern', o: 'kalender ics outlook google synka', s: 'Din kalender finns under Min profil. <b>Kalenderfil</b> ger en .ics. Automatisk synk med Outlook eller Google kräver en server.', sida: '#/profil' },
    { id: 'franvaro', t: 'Frånvaro', o: 'franvaro sjuk sjukanmal semester ledig', s: 'Under Min profil finns <b>Sjukanmäl i dag</b> och <b>Lägg in frånvaro</b>.', sida: '#/profil', visa: { sida: '#/profil', mal: '.pk', rubrik: 'Min kalender' } },
    /* --- Begränsningar --- */
    { id: 'prototyp', t: 'Vad är en prototyp här?', o: 'prototyp server sparas var data webblasare fleranvandare synk', s: 'Allt sparas i den här webbläsaren. Synk mellan datorer, riktig inloggning, utskick av mejl och SMS och aviseringar när CRM:et är stängt kräver en server.', sida: '#/installningar' },
    { id: 'mejl', t: 'Skicka mejl och SMS', o: 'mejl sms skicka skickar epost automatiskt utskick crm', s: 'CRM:et skickar inget självt. Mejl och SMS öppnas i ditt eget program och loggas som utkast öppnat.' },
    { id: 'angra', t: 'Ångra', o: 'angra anger tagit bort misstag radera', s: 'När något tas bort visas <b>Ångra</b> i 8 sekunder. Uppgifter, affärer, anteckningar, kunder och importer går att ångra.' },
    /* --- Chef --- */
    { id: 'chef', t: 'Försäljningsledning', o: 'chef ledning forsaljningsledning teamet chefsvy', s: 'Försäljningsledningen visar teamets siffror, närvaro, kalender, fördelning och topplistan.', sida: '#/chef', tur: 'chef', roller: ['chef'] },
    { id: 'chef-fordela', t: 'Fördela förfrågningar', o: 'fordela tilldela forfragningar smart saljare', s: 'Under <b>Behöver din uppmärksamhet</b>: <b>Ta själv</b>, <b>Fördela</b> eller <b>Fördela smart</b>, som ger jämnt till den som har minst öppet.', roller: ['chef'], tur: 'chef', visa: { sida: '#/chef', mal: '[data-g="lp-fordela-smart"]', rubrik: 'Fördela smart' } },
    { id: 'chef-mal', t: 'Sätta mål', o: 'satta mal malsattning kvartal', s: '<b>Sätt mål</b> finns överst under Försäljningsledning.', roller: ['chef'], visa: { sida: '#/chef', mal: '[data-g="lp-mal"]', rubrik: 'Sätt mål' } },
    { id: 'chef-rapport', t: 'Rapporten', o: 'rapport exportera period jamforelse forlustorsaker', s: '<b>Exportera rapport</b> under Försäljningsledning: välj period, se jämförelse och förlustorsaker, och ladda ner CSV.', roller: ['chef'], visa: { sida: '#/chef', mal: '[data-g="lp-rapport"]', rubrik: 'Rapporten' } },
    { id: 'chef-topp', t: 'Topplistan', o: 'topplista topplistan basta saljare', s: 'Topplistan visar vunnet per säljare: 30 dagar, 90 dagar eller i år.', roller: ['chef'], sida: '#/chef' },
    /* --- Admin --- */
    { id: 'kontroll', t: 'Kontrollcentralen', o: 'kontrollcentral kontroll systemhalsa drift', s: 'Kontrollcentralen visar säkerhet, konton, data och drift i en blick.', sida: '#/kontroll', tur: 'kontroll', roller: ['admin'] },
    { id: 'adminpanel', t: 'Adminpanelen', o: 'adminpanel admin konton roller nytt konto inaktivera', s: 'Adminpanelen har konton, roller, behörigheter, export, import och loggen.', sida: '#/admin', tur: 'adminpanel', roller: ['admin'] },
    { id: 'sakerhet', t: 'Säkerhet', o: 'sakerhet skanna kontroller poang logg', s: 'Säkerhetssidan har sju kontroller. Poängen är 100 minus avdrag: hög 25, medel 10, låg 3.', sida: '#/sakerhet', tur: 'sakerhet', roller: ['admin'] },
    { id: 'supportlage', t: 'Supportläget', o: 'supportlage ga in saljares konto visa som hjalpa', s: 'Klicka på en säljare under <b>Teamet</b> i menyn. Allt loggas. Tillbaka med <b>Shift Esc</b>.', tur: 'supportlage', roller: ['admin'], visa: { mal: '.sido__konto', rubrik: 'Teamet' } },
    { id: 'tom-data', t: 'Börja med tom data', o: 'tom data rensa exempeldata borja aterstall', s: 'I Adminpanelen: <b>Börja med tom data</b>. Exportera först och skriv TÖM. Konton, prislista, mallar och inställningar behålls.', roller: ['admin'], sida: '#/admin' },
    { id: 'aterstall', t: 'Återställ exempeldata', o: 'aterstall exempeldata nollstall', s: 'Under Inställningar eller i Adminpanelen: <b>Återställ exempeldata</b>. Det kräver ett andra klick.', roller: ['admin'], sida: '#/admin' },
    { id: 'konto-ny', t: 'Nytt konto', o: 'nytt konto skapa konto anvandare ny saljare', s: '<b>Nytt konto</b> finns i kontomenyn för chef och administratör och i Adminpanelen.', roller: ['chef', 'admin'] },
    { id: 'figur', t: 'Assistentens figur', o: 'figur figuren assistent assistenten huset stang av flytta undan dolj stilla ikon', s: 'Under <b>Inställningar</b> väljer du Levande, Stilla eller Liten ikon, och om figuren ska stå till höger eller vänster.', sida: '#/installningar', visa: { sida: '#/installningar', mal: '.inst-assistent', rubrik: 'Hjälpassistenten' } },
    { id: 'hitta-assistent', t: 'Vad assistenten kan öppna', o: 'oppna hitta navigera assistenten sidor poster filter', s: 'Säg till exempel <b>öppna Karin Holm</b>, <b>ta mig till prislistan</b>, <b>visa offerter som väntar</b>, <b>visa hur jag skapar en offert</b> eller <b>vad är nästa steg</b>.' },
    { id: 'roller', t: 'Roller', o: 'roller behorighet rattigheter vem far gora', s: 'Säljare ser säljmenyn. Chefen ser också Försäljningsledning. Administratören ser Ledning och går in hos säljare via supportläget.' }
  ];

  // Ord som hör till delar bara vissa roller ser, för att kunna svara rakt utan att visa innehållet
  A.sparrOrd = [
    { re: /topplist|fordela|forsaljningsledning|chefsvy|\bchef\b|satt mal|satta mal|teamets|\brapport/, roller: ['chef'], namn: 'Försäljningsledningen', till: 'din försäljningschef' },
    { re: /nytt konto|skapa (ett )?konto/, roller: ['chef', 'admin'], namn: 'administrationen', till: 'din chef eller administratören' },
    { re: /adminpanel|kontrollcentral|sakerhetslogg|sakerhetspoang|inaktivera|tom data|aterstall exempeldata|supportlage|\bskanna/, roller: ['admin'], namn: 'administrationen', till: 'administratören' }
  ];

  // Vägvisningar: assistenten leder genom stegen på riktigt med guidens motor. ord = vad man kan skriva.
  // Inget steg klickar åt användaren, och sparandet gör användaren själv.
  var antal = function (k) { return ((IH.db || {})[k] || []).length; };
  A.vagar = [
    { id: 'offert', namn: 'Skapa en offert', ord: /offert/, vy: 'offerter', slut: 'Offerten är ett utkast tills du markerar den som skickad.', steg: function () { return [
      { sida: '#/offerter', mal: '[data-g="offert-ny"]', rubrik: 'Ny offert', vanta: true, efterKlick: 600, gor: 'Klicka på Ny offert' },
      { mal: '.ark .kort, .ark [data-radlista]', behallArk: true, rubrik: 'Välj affären', prova: true, klar: function () { return /^#\/offerter\/./.test(location.hash); }, gor: 'Klicka på affären som offerten gäller', text: 'Då skapas ett utkast med hus, frakt och montage.' },
      { mal: '.offertlagg', valfri: true, rubrik: 'Lägg till rader', fri: true, fritt: true, text: 'Välj tillval ur prislistan eller lägg en egen rad. Summan räknas om direkt.' },
      { mal: '.vyhuvud [data-g="offert-skicka"]', valfri: true, rubrik: 'Skicka när du är klar', text: 'Knappen öppnar utskrift och mejl. CRM:et skickar inget självt.' }
    ]; } },
    { id: 'kund', namn: 'Skapa en kund', ord: /\bkund/, vy: 'kunder', slut: 'Kunden finns nu under Kunder.', steg: function () { var n = antal('kunder'); return [
      { sida: '#/kunder', mal: '[data-g="ny-kund"]', rubrik: 'Ny kund', vanta: true, efterKlick: 600, gor: 'Klicka på Ny kund' },
      { mal: '#ny-kund-form', behallArk: true, fritt: true, placering: 'vanster', rubrik: 'Fyll i och spara', prova: true, klar: function () { return antal('kunder') > n; }, gor: 'Skriv namnet och klicka på Spara kund' }
    ]; } },
    { id: 'affar', namn: 'Skapa en affär', ord: /affar/, vy: 'salj', slut: 'Affären ligger på säljtavlan.', steg: function () { var n = antal('affarer'); return [
      { sida: '#/salj', mal: '[data-g="ny-affar"]', rubrik: 'Ny affär', vanta: true, efterKlick: 600, gor: 'Klicka på Ny affär' },
      { mal: '#ny-affar-form', behallArk: true, fritt: true, placering: 'vanster', rubrik: 'Välj kund och hus', prova: true, klar: function () { return antal('affarer') > n; }, gor: 'Fyll i och klicka på Skapa affär', text: 'Värdet hämtas ur prislistan.' }
    ]; } },
    { id: 'forfragan', namn: 'Lägga in en förfrågan', ord: /forfragan|forfragningar/, vy: 'forfragningar', slut: 'Förfrågan ligger i inkorgen.', steg: function () { var n = antal('forfragningar'); return [
      { sida: '#/forfragningar', mal: '[data-g="ny-forfragan"]', rubrik: 'Lägg in förfrågan', vanta: true, efterKlick: 600, gor: 'Klicka på Lägg in förfrågan' },
      { mal: '#nyf-form', behallArk: true, fritt: true, placering: 'vanster', rubrik: 'Fyll i och lägg in', prova: true, klar: function () { return antal('forfragningar') > n; }, gor: 'Fyll i och klicka på Lägg in' }
    ]; } },
    { id: 'uppgift', namn: 'Lägga till en uppgift', ord: /uppgift/, vy: 'att-gora', salj: true, slut: 'Uppgiften ligger under Att göra.', steg: function () { var n = antal('uppgifter'); return [
      { sida: '#/att-gora', mal: '.nyuppg', fri: true, fritt: true, rubrik: 'Skriv uppgiften', prova: true, klar: function () { return antal('uppgifter') > n; }, gor: 'Skriv vad som ska göras och klicka på Lägg till' }
    ]; } },
    { id: 'videomote', namn: 'Boka ett videomöte', ord: /video ?mote/, vy: 'mote', steg: function () { return [
      { sida: '#/videomote', mal: '.vm-sidhuvud [data-g="vm-nytt"]', rubrik: 'Nytt videomöte', vanta: true, efterKlick: 600, gor: 'Klicka på Nytt videomöte' },
      { mal: '.ark', behallArk: true, fri: true, fritt: true, placering: 'vanster', rubrik: 'Starta eller boka', text: 'Tryck på <b>Starta nu</b> eller välj en tid och boka. Kunden får en länk.' }
    ]; } },
    { id: 'kundmote', namn: 'Hålla ett kundmöte', ord: /kundmote|presentation/, vy: 'mote', steg: function () { return [
      { sida: '#/mote', mal: ['label:has([data-moteaffar])', '[data-moteaffar]'], valfri: true, fri: true, fritt: true, rubrik: 'Välj affär', text: 'Kunden och huset följer med in i presentationen.' },
      { mal: '.motescen [data-g="starta-mote"]', rubrik: 'Starta', text: 'Klicka på <b>Starta presentation</b> när du är redo.', fri: true }
    ]; } },
    { id: 'tema', namn: 'Byta tema', ord: /tema|utseende/, steg: function () { return [
      { sida: '#/installningar', mal: '.inst-tema', fri: true, fritt: true, placering: 'vanster', rubrik: 'Välj tema', text: 'Bytet syns direkt och sparas för ditt konto.' }
    ]; } },
    { id: 'ladda', namn: 'Ladda upp en fil', ord: /ladda upp|fil\b|dokument/, vy: 'dokument', steg: function () { return [
      { sida: '#/dokument', mal: ['.dk-ladda', '.dk-hjalte__knappar'], fri: true, rubrik: 'Ladda upp', text: 'Klicka här och välj filen. Den kontrolleras först, sedan väljer du typ och kund.' }
    ]; } }
  ];

  // Vad man kan göra på varje sida
  A.plats = {
    oversikt: 'Här ser du dagens läge och vad du bör göra först.',
    forfragningar: 'Här svarar du på förfrågningar: öppna en, följ Nästa bästa steg och markera Kontaktad.',
    salj: 'Här flyttar du affärer mellan stegen och ser prognosen.',
    kunder: 'Här hittar du kunder, filtrerar och skapar nya.',
    offerter: 'Här ser du vad som väntar på svar och går ut snart, och skapar nya offerter.',
    mote: 'Här förbereder du kundmötet och startar presentationen.',
    videomote: 'Här bokar och startar du videomöten.',
    produktion: 'Här följer du projekten, checklistorna och montagen.',
    dokument: 'Här finns arkivet och mallarna, och här laddar du upp filer.',
    'kolla-marken': 'Här kollar du jordart, vatten och djup till berg.',
    'att-gora': 'Här lägger du till, bockar av och skjuter upp uppgifter.',
    chatt: 'Här skriver du till teamet. @ nämner en kollega och # länkar en kund.',
    installningar: 'Här väljer du utseende, ställer in assistenten, mallar och prislistan.',
    profil: 'Här finns ditt id-kort, din aktivitet och din kalender.',
    chef: 'Här följer du teamet, fördelar förfrågningar och exporterar rapporten.',
    kontroll: 'Här ser du konton, skydd, data och drift i en blick.',
    admin: 'Här hanterar du konton, roller, data och loggen.',
    sakerhet: 'Här kör du kontrollerna och följer säkerhetspoängen.'
  };

  // Förslag efter sidan man står på
  A.forslag = {
    oversikt: ['Vad ska jag göra i dag?', 'Har jag sena uppgifter?', 'När är nästa möte?'],
    forfragningar: ['Hur många nya förfrågningar?', 'Hur svarar jag på en förfrågan?', 'Visa samtalsguiden'],
    salj: ['Vad är nästa steg?', 'Affärer som står still', 'Vilka är de största affärerna?'],
    kunder: ['Ny kund', 'Visa hur jag skapar en kund', 'Vad kan jag göra här?'],
    offerter: ['Visa offerter som väntar', 'Visa hur jag skapar en offert', 'Hur ändrar jag en skickad offert?'],
    mote: ['När är nästa möte?', 'Nytt videomöte', 'Hur fungerar kalkylen?'],
    videomote: ['Nytt videomöte', 'Varför fungerar det inte mellan datorer?'],
    produktion: ['När är nästa montage?', 'Vad är checklistan?', 'Hur lämnar jag över huset?'],
    dokument: ['Hur laddar jag upp en fil?', 'Vilka mallar finns?'],
    'att-gora': ['Har jag sena uppgifter?', 'Ny uppgift ring Anna i morgon', 'Hur fungerar påminnelser?'],
    chatt: ['Hur gör jag en uppgift av ett meddelande?', 'Hur startar jag ett videomöte?'],
    installningar: ['Hur byter jag tema?', 'Vad är Minimal?', 'Hur ändrar jag priserna?'],
    profil: ['Hur sjukanmäler jag mig?', 'Kan jag synka kalendern?'],
    chef: ['Hur går teamet?', 'Hur fördelar jag förfrågningar?', 'Hur sätter jag mål?'],
    kontroll: ['Vad är supportläget?', 'Hur börjar jag med tom data?'],
    admin: ['Hur skapar jag ett konto?', 'Vad är supportläget?'],
    sakerhet: ['Hur räknas poängen?', 'Vad är supportläget?'],
    _: ['Vad kan du hjälpa till med?', 'Starta en guide', 'Var hittar jag prislistan?']
  };
})();
