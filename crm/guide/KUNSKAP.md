# Legohus CRM – kunskapsbasen

Guiden (crm-guide) läser den här filen först. Allt här finns i koden – inget är påhittat. Siffror, namn och priser i CRM:et är **exempeldata** (data.js, `IH.skapaExempeldata`), skapade från dagens datum varje gång datan återställs.

Senast genomgången: 2026-11-01 (guiden och hjälpassistenten, avsnitt 5 och 6), dessförinnan 2026-10-30, steg 11 "bygg klart i klienten" (app.js, vyer.js, ledning.js, kontroll.js, adminpanel.js, admin.js, sakerhet.js, stod.js, chatt.js, mote.js, videomote.js, samtal*.js, tema.js, layout.js, kalender.js, valj.js, grund.js, data.js, index.html). Nytt i steg 11 står samlat i avsnitt 3b.

---

## 1. Grunden

| Sak | Var |
|---|---|
| Startsida | `crm/index.html` (CSP: bara egna externa skript + fyra hashade inbyggda – lägg aldrig till inbyggda skript) |
| Inloggning | `crm/logga-in.html` → `localStorage['ih-crm-inloggad']`, kontot i `ih-crm-jag` (ah, sa, ad) |
| Data | `IH.db` i `localStorage['ih-crm-v1']` (version 4: aviseringar, mallar, taggar, egna fält, förväntat avslut, upprepade uppgifter – äldre data uppgraderas, byts inte ut). `IH.spara()` sparar, `IH.ritaOm()` ritar om meny + vy |
| Vyer | `IH.vyer[namn](del)` → `{ titel, html, efter }`. Adress `#/namn/del` |
| Knappar | `data-g="namn"` → `IH.G[namn](el, ev)` (en klicklyssnare på document i app.js) |
| Formulär | `data-form="namn"` → `IH.FORM[namn](form, FormData)` |
| Panel från höger | `IH.oppnaArk({ titel, under, ikon, kropp, fot, bred })` → `aside.ark` + `.slojan`; `IH.stangArk()` |
| Meddelanden | `IH.toast(rubrik, text, ikon, { lank, knapp, knappar })` i `.toaster` (nere till höger) |
| Ångra | `IH.angra(rubrik, text, aterstall)` – toast med **Ångra** i 8 s. Används när affärer, uppgifter, anteckningar, kunder och importer tas bort |
| Aviseringar | `IH.avisera({ typ, rubrik, text, lank, till })` → `db.aviseringar`; klockan `.ih-klocka` (`data-g="aviseringar"`) |
| CSV | `IH.csv.ladda(fil, kolumner, rader)` (semikolon, BOM, formelskydd) och `IH.csv.las(fil)` |
| Sparade filter | `IH.filter.spara/lista/bort` (per konto och vy, i den här webbläsaren) |
| Konfetti | `IH.konfetti(x, y)` (vunnen affär, klart projekt, alla samtalsfrågor) |
| Lugn rörelse | `IH.lugn` = prefers-reduced-motion |

### Konton och roller (data.js `IH.ANVANDARE`)

| id | Namn | Roll | Ser |
|---|---|---|---|
| `ah` | Ahmed | `salj` + `chef: true` (Sälj · Försäljningschef) | Hela säljmenyn + **Försäljning** (`#/chef`) och växeln **Säljvy / Chefsvy** (`.vy-vaxel`, `data-g="vy-byt"`) |
| `sa` | Sahand | `salj` | Säljmenyn |
| `ad` | Admin | `admin` | Översikt, **Ledning** (Kontrollcentral, Adminpanel, Säkerhet), Mitt (Meddelanden, Att göra, Inställningar) och **Teamet** (gå in i säljarnas konton) |

- Administratören skapar inte säljposter: `G.ny`, `ny-kund`, `ny-affar`, `ny-forfragan` visar en avisering "Administratören skapar inte …" och hänvisar till supportläget.
- **Supportläget** (stod.js): admin klickar en säljare under *Teamet* i menyn (`.sido__konto`, `data-g="visa-som"`). CRM:et visas exakt som för säljaren (`IH.jag()` = säljaren, `IH.riktigJag()` = admin). Ett band högst upp (`.stod-band`) visar vems konto, tid och byt-knappar; **Tillbaka till Admin** = `.stod-band__ut` (`data-g="visa-som-sluta"`) eller **Shift+Esc**. Status kan inte ändras och inga chattmeddelanden kan skickas i säljarens namn. Start och slut loggas i säkerhetsloggen.
- Närvaro (ledning.js): Online, I möte, Upptagen, Strax tillbaka, Lunch, Ute på tomt, Semester, Sjuk, Osynlig. Sätts i kontomenyn.

### Skalet (app.js)

| Del | Väljare | data-g |
|---|---|---|
| Sidomenyn (dator ≥ 1101 px) | `aside.sido`, länkar `.sido__lank[data-vy="…"]`, brickor `.sido__bricka` | – |
| Logga | `.sido__logo` | – |
| Sök (öppnar paletten) | `.sido__sok` (dator), `.topp .sok` (mobil/surfplatta) | `palett` |
| Ny (+) | `.sido__ny`, `.topp [data-g="ny"]` | `ny` |
| Aviseringar (klockan) | `.sido .ih-klocka` (bredvid sök och Ny), `.topp .ih-klocka`, i den infällda listen `.sido-rals__klocka` | `aviseringar` |
| Säljvy/Chefsvy (bara chefen) | `.vy-vaxel` | `vy-byt` |
| Kontokortet | `.anv` | `konto-meny` (panel `.km-panel` på dator, annars ark) |
| Hemsidan / Logga ut | `.sido__smalt a`, `[data-g="logga-ut"]` | `lamna`, `logga-ut` |
| Återställ exempeldata (admin) | `.sido__aterstall` | `sido-aterstall` |
| Fäll in menyn | `[data-sido-knapp]` (kanten) | – (tangent `[`) |
| Infälld meny (list) | `nav.sido-rals`: sidorna som ikoner i grupper (`.sido-rals__halva--upp/--ner`, avdelare), knappen mitt på kanten, klockan sist i nedre halvan. Sök, **Ny** och kontot (`.topp__konto`) sitter då i toppraden `.topp`. Den dockade chatten (`.chf-ikon`/`.chf-dock`) tar plats under knappen | – |
| Mobilmenyn (< 1101 px) | `nav.mobilmeny`: säljare Översikt, Förfrågn. (aria-label Förfrågningar), Säljtavla, Kunder · produktion Översikt, Projekt, Kunder, Offerter · admin Översikt, Kontroll, Admin, Säkerhet – + **Mer** (`[data-mer]`, `data-g="mer"`) | `mer` |
| Vyns yta | `main#vy` | – |

Menyn (säljare): Översikt (+ Försäljning för chefen) · **Försäljning**: Förfrågningar, Säljtavla, Kunder, Offerter, Kundmöte · **Bygg**: Projekt, Dokument, Kolla marken · längst ner: Meddelanden, Att göra, Inställningar. Brickor: nya förfrågningar (varm), öppna affärer, antal kunder, aktiva projekt, uppgifter i dag (varm), olästa (varm).

Kontomenyn (`.km-panel` på dator med utfälld meny, annars ark `.km-ark`; stängs vid klick utanför): status (snabbval `data-g="satt-narvaro"` + alla via `km-status`), **Byt konto** (exempelkontona, `valj-anvandare`), **Tema**, **Layout**, Min profil, Nytt konto (chef/admin, `km-nytt-konto`) eller Meddelanden, Logga ut.

### Kortkommandon

| Tangent | Var | Gör |
|---|---|---|
| **Ctrl K / ⌘ K** | överallt | Öppnar/stänger kommandopaletten |
| **/** | överallt (utom i fält) | Öppnar paletten (på säljtavlan också) |
| **N** | överallt utom i presentationen | Skapa ny (förfrågan, affär, kund, uppgift) |
| **[** | dator | Fäller in/ut sidomenyn |
| **Esc** | | Stänger palett, panel, kontomeny, flyttmeny |
| **J / K** | Förfrågningar | Nästa/föregående förfrågan |
| **U** | Förfrågningar | Svarsutkast för vald förfrågan |
| **Pilar + Enter** | Säljtavlan (fokus på kort) | Flytta fokus mellan kort / öppna |
| **Enter / Mellanslag** | Kunder, Projekt (fokus på kort) | Öppna |
| **← → / PageUp/Down / Mellanslag** | Presentationen | Bläddra |
| **K** | Presentationen | Hoppa till kalkylen |
| **N** | Presentationen | Visa/dölj anteckningar |
| **Home / End** | Presentationen | Första/sista bilden |
| **Esc** | Presentationen | Avsluta (utanför helskärm) |
| **Enter / Shift+Enter / ↑ / @ / #** | Chatten | Skicka / ny rad / ändra ditt senaste / nämn kollega / länka kund eller affär |
| **/ · Tab** | Chatten (i rutan) | Mallar / nästa fält i mallen |
| **Ctrl J / Ctrl F** | Chatten | Nästa olästa konversation / sök i konversationen |
| **↑ ↓ · R · E · P · T · Enter** | Chatten (fokus i tråden) | Flytta / svara / ändra / fäst / uppgift / meny |
| **J / K · ↑ ↓ · Enter · X** | Listor med `data-radlista` (aviseringar, mallar, Ny offert m.fl.) | Nästa/föregående rad, öppna, kryssa (massåtgärder) |
| **Shift + Esc** | Supportläge | Tillbaka till Admin |
| **?** | Guiden | Öppnar Kortkommandon i CRM:et; bokknappen vid menyn öppnar Lär dig CRM:et (guide.js) |

Kommandopaletten (`.palett`): Senaste (kund/affär/förfrågan/offert), **Snabbåtgärder** (Ny kund, Ny affär, Ny förfrågan, Ny uppgift, **Ny offert**, **Nytt videomöte**, Starta kundmöte – inte för admin), tema och layout (skriv t.ex. "tema", "mörk", "layout", "minimal"), **Gå till** (alla sidor rollen får se). Söker kunder, affärer, förfrågningar, offerter, **dokument**, **anteckningar och aktiviteter** och (via `IH.sok.lagg` från chatt.js) **chattmeddelanden**; från tre tecken även i ordning ("sgb" → Skärgårdsbyn).

---

## 2. Datamodellen och stegen

- **Säljsteg** (`IH.SALJSTEG`): `ny` Ny förfrågan 10 % · `kontakt` Kontakt tagen 20 % · `besok` Tomt och platsbesök 40 % · `offert` Offert skickad 60 % · `forhandling` Förhandling 75 % · `vunnen` Order signerad 100 %. Förlorad = `affar.forlorad = { orsak, kommentar, tid }`. Orsaker: Priset, Valde annan leverantör, Fick inte bygglov, Projektet skjuts upp, Tomten passade inte, Annat.
- **Förfrågans status** (`IH.FSTATUS`): `ny` Ny · `kontaktad` Kontaktad · `kvalificerad` Blev affär · `ej` Ej aktuell. Svarsmål (SVARSMAL) 24 timmar.
- **Offertstatus**: `utkast` → `skickad` → `godkand`; `ersatt` (ny version), `avbojd` (affären förlorad). Giltig 30 dagar, förläng +14. Nummer `LH-ÅÅÅÅ-nnn`.
- **Projektsteg** (`IH.PROJSTEG`): `underlag` Ritning och lov · `tillverkning` Tillverkning · `grund` Grund och mark · `montage` Leverans och montage · `besiktning` Slutbesiktning · `klart` Klart. Checklista: ritning (Legohus), lov, grund, framkomlighet (kunden).
- **Husen** (`IH.MODELLER`): Sadel 30 (Attefallshus 30 m², 1 rum), Sadel 30 Bred (2 rum), Pulpet 30, Kupa 40 (Fritidshus, bygglov), Kupa 50 (bygglov), Byggelement (Proffs). Exempelpriser 395–795 tkr; poster: Frakt 28 000, Montage 45 000, Kranbil 12 000, Ritningar 18 000, Altan 38 000, Kök och badrum 145 000, Braskamin 42 000 (ändras under Inställningar).
- Exempeldatan: 14 kunder, 11 förfrågningar, 12 affärer (3 vunna, 1 förlorad), 6 offerter, 3 projekt, 5 uppgifter. Telefonnummer ur PTS fiktiva serie, e-post @example.com.

---

## 3. Sidorna

För varje sida: adress, sektioner (väljare) och knappar (`data-g`).

### Översikt `#/` (vyer.js `IH.vyer.oversikt`)
- `.hero` – hälsning (`.hero__ord`), läget i text, chips `.hero__lagen` (att göra i dag, möten, montage om N d), snabbknappar `.hero__snabb` (`ny-forfragan`, `ny-kund`, `ny-affar`, `ny-uppgift`, `starta-mote` – inte för admin), nyckeltal `.hero__kpi` (Nya förfrågningar, Öppna affärer, Vunnet i år, I produktion), byggarbetsplatsen `.hero__by` (`.stad` + `.pipe`: varje steg ett hus – Utstakad tomt, Grunden gjuten, Stommen rest, Takstolar på, Taket i kranen, Nycklar klara).
- `.oversikt` två spalter med `.kort`: **Senaste förfrågningar**, **Intäkter** (`ik-period` 6/12 mån, `ik-csv` exportera vunna), **Fokus i dag**, **Att göra i dag** (`uppgift-klar`, `ag-skjut`, `kund-ring`, `kund-oppna`), **Senaste aktivitet**.

### Förfrågningar `#/forfragningar[/id]` (inkorgen)
- `.ipuls` – antal som väntar, `.ipuls__forst` (väntat längst), vecka, konvertering, källor; `.ipuls .toppverktyg`: **Simulera ny förfrågan** (`simulera`) och **Lägg in förfrågan** (`ny-forfragan`, formulär `ny-forfragan`: namn, ort, telefon, e-post, miljö, hustyp, användning, kom via, beskrivning).
- `.dioramor` – fyra miljöer (`f-miljo`, data-m): Vid havet, I skogen, På fjället, I trädgården – filter.
- `.inkorg__filter .flikar` – `f-filter`: Alla, Ny, Kontaktad, Blev affär, Ej aktuell.
- `.inkorg__lista` – rader `a.fl` (`.fl--ny`, `.vald`), grupperade I dag/I går/Den här veckan/Tidigare. Tips: J/K, U.
- `.inkorg__las` (läsrutan): `.fd__huvud` med status och **Ta den** (`f-tilldela`) · `.forlopp` · `.nbs` **Nästa bästa steg** (ny: Ring, Svarsutkast `f-utkast`, Kontaktad `f-status[data-status=kontaktad]`, Påminn om 2 h `f-paminn`, Ej aktuell; kontaktad: **Skapa affär** `f-skapa-affar`; blev affär: Öppna affären; ej aktuell: Öppna igen) · `.fd__mitt` (miljöbild + svaren) · `.fd__citat` · `.smart` (poäng + skäl + ämnen ur texten) · `.guide` **Samtalsguiden** (`f-guide`, data-p: detaljplan, byggnader, grans, framkomlighet, grund, strand, anmalan, tidplan – konfetti när alla är klara) · `.fd__kontakt` · `.fd__forslag` (husförslag) · `.fd__logg` (historik + anteckningsformuläret när det finns en kund).
- Kontaktad skapar kundkortet automatiskt (`kundFranForfragan`). Svarsutkastet (ark) har tonerna Personligt/Kort (`utkast-ton`), Kopiera (`utkast-kopiera`), Öppna i mejlen (`utkast-mejl`).

### Säljtavlan `#/salj` och affärssidan `#/salj/id`
- `.puls` – byggets lager (`.bygge`), `.puls__kpi` (Öppna affärer, Viktad prognos, Snitt per affär, Vunnet 90 d), `.forslag` **Smarta förslag** + `tavla-lage` (Tavla/Lista) + **Ny affär** (`ny-affar`).
- `.stegband` – sex knappar `till-spalt` (rullar till spalten).
- `.tv-verktyg` – sök `[data-tv-sok]`, `tv-vem` Alla/Mina, `tv-filter` Allt/Står still (>10 d)/Har uppgift/Över 600 tkr, sortering `[data-tv-sort]` (Senast ändrad, Störst värde, Viktat värde), `tv-forlorade` (lista + **Återuppta** `aff-ateruppta`), `tv-kompakt`.
- `.tv-fokus` – Fokus i dag, tre `.tv-fokus__kort` (`aff-oppna`).
- `.tavla-ram` / `.tavla` – `section.spalt#spalt-<steg>` (summa, chans, viktat, snitt dagar, "står still"), kort `article.aff[data-aff]` (`.aff--farsk/lugn/still`, ring = chans), knappar på kortet: `aff-flyttmeny`, `kund-ring`, `aff-logga`, `aff-uppg`, `aff-vidare` (Vidare → nästa steg). `tavla-rulla` pilar. Dra och släpp; `.forlustdocka` = släpp för förlorad (orsaksformulär `forlora`).
- Listläget: tabell, rad = `aff-oppna`.
- Affärssidan: `a.tillbaka`, `.afhero` (värde, chans med stegets grund, dagar i steget, viktat), `.af-stegare` (`aff-steg`), `.af-rum` med `[data-af="nasta"]` (**Nästa bästa steg**: ny → Ring + Kontakt tagen; kontakt → Platsbesöket är bokat; besök → Skapa offert / Skicka offerten; offert → Vänta på svar / Följ upp + Kunden vill gå vidare / Till förhandling; förhandling → **Order signerad** `aff-vinn` + Kundmöte; vunnen → Öppna projektet; förlorad → Återuppta), `[data-af="offert"]` (`skapa-offert`), `[data-af="hus"]`, `[data-af="historik"]` (anteckningsformulär: Anteckning/Samtal/Mejl/Möte), `[data-af="kund"]`, `[data-af="uppgifter"]` (`uppgift-klar`), `[data-af="atgarder"]` (`starta-mote`, `ny-uppgift`, `aff-forlora`).

### Kunder `#/kunder` och kundsidan `#/kunder/id`
- `.kundtopp` – `.kundtopp__ord` (antal, tal, typ, varma kunder), `.kundtopp__resa` (toppverktyg: `kund-export-alla`, `ny-kund`, `kund-vy` Kort/Lista; kundresan `kund-steg`).
- `.kundverktyg` – `kund-filter` (Alla, Mina, Affär pågår, Kunder, Företag, Behöver uppmärksamhet), sortering `[data-kundsort]`.
- `.kundnat` – `article.kundkort` (`.kundkort--varm`), `.kundkort__snabb`: `kund-ring`, `kund-mejl`, `starta-mote[data-kund]`, `ny-affar-kund`. Listläget: `kund-sort-kol`, `kund-valj`, `kund-valj-alla`, massåtgärder `kund-bulk-mejl`, `kund-bulk-csv`, `kund-bulk-uppg`.
- Ny kund (ark, formulär `ny-kund`: namn, telefon, e-post, ort, typ privat/företag) → `#/kunder/<id>`.
- Kundsidan: `.kh` (`.kh__vem` med `kund-kopiera`, `ny-affar-kund`, `kund-logga`, `kund-uppgift`, `starta-mote`, `kund-ring`; `.kh__halsa` kundhälsa 0–100 (`kundHalsa`: dagar sedan senaste aktivitet ≤3 d 100, ≤7 85, ≤14 65, ≤30 45, annars 25, ingen 30; −15 per försenad uppföljning, +5 öppen affär, +10 vunnen; grön ≥ 75, gul ≥ 50, röd); `.kh__tal`), `.kundresa`, `.kn` (nästa steg), `.kg__vanster` (Huset `.khus`, Affärer, Offerter, Förfrågningar), `.kg__hoger` (`.kkontakt` Kontakter senaste 90 dagarna, Uppgifter, `#kund-historik` med `kund-hist` filter samtal/mejl/möte + anteckningsformulär, Dokument).

### Offerter `#/offerter` och offertsidan `#/offerter/id`
- `.offtopp` – `.offtopp__ord` (väntar på svar, Träffsäkerhet, Tid till ja, Godkänt värde, staplar per vecka), `.offtopp__hoger`: sök `[data-offsok]`, `.snartut` **Går ut snart** (`offert-folj-upp`, `offert-forlang` +14 d), `.offinsikt` (Per hus, Vanligaste posterna).
- `.kundverktyg` – `off-filter` (Alla, Mina, Väntar på svar, Går ut snart, Godkända, Utkast, Avböjda), sortering `[data-offsort]` (Senaste först, Går ut först, Störst summa).
- Tabellen `.tabell--offert` – rad `offert-oppna`, `offert-folj-upp`, `offert-ny-version`, `offert-forlang` (klocka när ≤ 10 d kvar).
- Offertsidan: `.vyhuvud` (länkar `.off-lankar` till affären, kunden och projektet; **Skriv ut / PDF** `skriv-ut`, **Mejl eller SMS** `mall-anvand`, **Skicka offerten** `offert-skicka` för utkast → arket med ämne och följebrev `[data-offmejl]` och knapparna `offert-pdf`, `offert-mejla` Öppna i mejlprogrammet, `offert-markera` **Markera som skickad** – sparar en kopia i dokumentarkivet och loggar "markerad som skickad, mejlutkast öppnat"), `.off-svar` för skickad: **Kunden godkände** `aff-vinn`, **Kunden avböjde** `offert-avbojd`, Följ upp, Förläng 14 d, Ny version; godkänd/avböjd visar utfall och datum, `.ostatus` (Utkast → Skickad → Godkänd + giltighetsring), `.off-not` (skickad: "skapa en ny version" `offert-ny-version`), `.offertred` (modellrad `offert-modell`, rader `.offertrader` text/antal/pris + `offert-bort`, `.offertlagg` `[data-lagg]` ur prislistan eller Egen rad, `.offertsumma`), `.dokyta` (dokumentet `article.dok#dok`). Godkänd/ersatt/avböjd = låst. Summan blir affärens värde.

### Dokument `#/dokument` (arkiv och mallar)
- `.dk-hjalte` – `.dk-hjalte__text` (rubrik, `.dk-flikar` `dok-flik` Arkiv/Mallar, `.dk-hjalte__knappar`: **Ladda upp** `.dk-ladda` (filfält, filskannern kontrollerar), exportera `dok-csv`), `.dk-stats` (`dok-lage`: väntar på svar, godkänt & signerat, går ut inom 7 dagar, svarstid), `.dk-blick` / `.dk-fack` (`dok-fack`: Offerter, Ordrar, Avtal, Ritningar, Bygglov, Checklistor, Foton …; släpp filer), `.dk-verktyg` (sök, `dok-vem` Mina/Alla, år, sortering, gruppering, `.dk-lagen`).
- `.dk-att` **Att hantera** (`prod-check`, `proj-oppna`, `kund-ring`, förläng).
- `.dk-grupp` per fack med `.dk__rad` (`dok-detalj` → ark `.dkd`: värde, ring, tidslinje, fakta; fot: Öppna offerten, **Förläng 14 d** `dok-forlang`, Mejla påminnelse, Ring, Till affären; checklistor: Markera som klar `dok-check-stang`, Öppna projektet). Foton: `dok-foto` (bildbanken), `dok-visa`. Egna filer: `dok-fil` (typ, kund, Öppna, Ladda ner, **Arkivera** `dok-fil-arkiv`, Ta bort `dok-fil-bort`). Inget raderas av sig självt – arkiverat göms från Aktuella.
- **Mallar** (`dok-flik[data-f=mallar]`): "Förslag just nu" + `.ml-grupp` Sälj (Följebrev till offert, Protokoll från platsbesök, Tack för ordern), Bygget (Checklista inför montage, Leveransplan), Överlämning (Egenkontroll efter montage, Överlämningsprotokoll). Knappar: **Fyll i** `dok-mall` (välj kund → skrivs ut, loggas på kunden), **Visa exempel** `mall-exempel` (ark `.ml-exempel`), **Tom mall** `mall-tom`.

### Kundmöte `#/mote` och presentationen (mote.js)
- `.motescen` – 3D-mötesrummet (motesrum3d.js), `.motescen__ord` med **Starta presentation** (`starta-mote[data-bilder]`) och **Bara kalkylen** (`starta-mote[data-start=kalkyl]`).
- `.rutnat--mote`: **Förbered mötet** (formulär `starta-mote`: `mote-valj` välj affär, `.upplagg` `mote-lage` Fullt möte 7 bilder/Kort möte 4/Bara kalkylen 3, bildval `name=bild`, frågor `mote-fraga`, tidsband) · `.komm` **Kommande möten** (`mote-forbered`, `mote-boka`) · `.logga-mote` **Logga mötet** (formulär `mote-logga`: kund, minuter, text, nästa steg → uppgift) · **Tidigare möten** · `.motekort` **Så fungerar det**.
- Presentationen `.mote` (helskärm, dialog): bilder `.mote__bild[data-id]` = titel (Välkommen), er (Er förfrågan, bara med förfrågan), hantverk (Byggt under tak), husen (Husen i 3D), regler (Vad får ni bygga?), resan (Så går det till), kalkyl (Räkna på ert hus), nasta (Nästa steg). Topp: kund, klocka `[data-mtid]`, `[data-mote="anteckna"]`, `[data-mote="helskarm"]`, `[data-mote="stang"]`. Botten `.mote__botten`: prickar `.mote__prick` (aria-label = bildens namn), `[data-mote="bak"]`, `[data-mote="fram"]`. Kalkylen: hus `[data-km]`, tillval `[data-kt]`, **Spara som offert** `[data-mote="spara"]` (skapar offert på affären). Nästa steg: **Boka platsbesök** `[data-mote="boka"]`, **Mejla en sammanfattning** `[data-mote="sammanfattning"]`. Anteckningar `.mote__anteckning` sparas i kundens historik när mötet stängs.

### Projekt `#/produktion[/projektId]`
- `.prodtopp` – `.prodtopp__intro`, `.nyckel` (Aktiva projekt, Nästa montage, Checklistor klara, Värde i produktion), `.prodblock--montage` (nedräkning), `.prodblock--varn` (Att åtgärda: `prod-del` Allt/Kundens del/Vår del, `prod-check`), `.prodblock--fabrik` med `.resa3d` (Husets resa i 3D, sex stationer, nålar = projekt) och `.fabrik`.
- `.kal` – kalendern: `kal-man` föregående/nästa, `kal-slag` (Montage, Projektstart, Att göra, Möten, Offert går ut), `kal-dag`.
- `.tavla--prod` – projekttavlan, kort `article.aff--proj` (`proj-oppna`, `proj-nasta`, `kund-ring`, `kund-oppna`), `steg-hus`.
- Projektpanelen (`IH.projArk`, öppnas av `#/produktion/id` eller `proj-oppna`): `.projark__3d`, `.stegare--prod` (`proj-steg`), `.projark__check` (`proj-check`: Ritningar klara – Legohus; Bygglov eller anmälan, Grund/el/vatten/avlopp, Framkomlighet – Kunden), `.projark__datum` (formulär `proj-montage`). Klart → konfetti "Huset är överlämnat!".

### Att göra `#/att-gora`
- `.dagtopp` (hälsning, typer, ring klara i dag), `.agk` veckokalender (`ag-vy` Vecka/2 veckor/Månad, `ag-off`, `ag-ny-dag`, `ag-dag-visa`), `.agv` (sök, `ag-vem` Mina/Alla, `ag-typ`, `ag-csv`), `form.nyuppg` (formulär `uppgift`: text, kund/affär, datum), `.uppgrupp` I dag / Kommande / `.uppgrupp--klara` (`uppgift-klar`, `ag-skjut`, `ag-sena-idag`, `kund-ring`, `kund-oppna`).

### Meddelanden `#/chatt[/id]` (chatt.js)
- `.ch-lista` (sök med utdrag, `.ch-team`, konversationer med ”Utkast:”, `ch-ny-grupp`, `.ch-kort` avisering `ch-avisera`), `ch-pling` ljud för nya meddelanden. `.ch-tradyta`: `.ch-topp` (`ch-sok-tradoppna` sök i tråden/Ctrl+F → `.ch-sokrad`, `ch-tyst` bjällran tystar, `ch-info`, `chf-oppna` eget fönster, `chf-min-sida` minimera till senaste sidan), `.ch-trad-yta`: `.ch-fast` (fästa, högst 3, `ch-hoppa-fast`, `ch-fast`), `.ch-trad[role=log]` (`ch-reagera`, `ch-svara`, `ch-mer` → `.ch-meny`: `ch-uppgift`, `ch-paminn-meny`/`ch-paminn`, `ch-fast`, `ch-olast`, `ch-kopiera`, `ch-andra`, `ch-ta-bort`, `ch-simulera`; högerklick ger samma meny), `.ch-hopp` ”N nya meddelanden ↓”/”Till senaste ↓”, `.ch-skriver`; `.ch-obj` öppnar `.ch-objkort`; `.ch-fot` skrivrutan (`ch-emoji`, bifoga, @, #, `/` mallar `.ch-mallar`). Tom tråd: `.ch-tom`. Om konversationen: Länkat i konversationen, Delade filer, Prototyp + `ch-simulera` (exempelsvar). Pilar i tråden: ↑/↓, R svara, E ändra, P fäst, T uppgift, Enter meny. **Ctrl+J** nästa olästa. Flytande fönster `.chf` (trådläge `.chf-huvud.trad`, listläge `.chf-sok`), minimerat `.chf-ikon`.
- Prototyp (kräver server, sägs i Om konversationen): notiser och pling till andra datorer (här bara mellan flikar + Simulera ett svar), läskvitton/”Sett av” och ”skriver …” mellan olika personer, påminnelser när fliken är stängd (påminnelsen ligger i Att göra och visas som toast om fliken är öppen), filer på server och riktig virusskanning, sökning i stor historik.

### Videomöten `#/videomote[/id]` (videomote.js, samtal.js, samtal-ui.js, mote-gast.html)
- **Sidan Videomöten** `#/videomote` (nås via **Alla videomöten** `.komm__vm` under Kundmöte): `.vm-sidhuvud` med **Nytt videomöte** (`vm-nytt` – arket med **Starta nu** eller boka en tid), Kommande och Senaste (`.vm-lista`, `vm-anslut`), `.vm-arlig` (prototyptexten). Också i sökpaletten.
- **Boka** (`vm-boka`, arket `#vm-boka-form`): knappen **Videomöte** på kundsidan (`.kh__knappar`), i kundlistan (`.kl__vm`), på affärssidan och affärsarket, **Boka videomöte** under Kundmöte (`.komm__vm`, med länken Alla videomöten) och på sidan Videomöten. I kalendern (Försäljningsledning och profilen, `kalForm`) finns växeln **Videomöte** (`.vm-vaxel`, syns när typen är Möte) – den skapar mötet med kunden som gäst och öppnar inbjudan. Fält: Vad, Dag, Tid, Längd (15/30/45/60 min, förval 45), gäster (namn, e-post valfri, kundens kontakt förifylld), kollegor, **Mötesinställningar**: Gäster väntar i väntrummet (på) och Vem går direkt in (Alla i företaget / Bara jag). Bokningen skapar `IH.db.videomoten` (id `v…`, rumskod som `kqd-mwpz-tfa`), en kalenderaktivitet (typ möte, fältet `video`) och en påminnelse under Att göra.
- **Inbjudan** (`vm-inbjudan`, arket Inbjudan är klar): **Kopiera länk** (`vm-kopiera-lank`, länken till gästsidan `mote-gast.html#m=…` – allt efter # skickas aldrig till servern), **Skicka inbjudan** per deltagare (`vm-mejla`, öppnar mejlprogrammet med färdig text – inget skickas automatiskt), **Ladda ner kalenderfil** (`vm-ics`, .ics med länk och påminnelse 10 min före), **Kopiera inbjudningstext** (`vm-kopiera-text`). Kollegor får CRM-länken `index.html#/videomote/<id>` och går direkt in.
- **Anslut** (`vm-anslut`): på kalenderns dagrader och dagarket, i profilens dagpanel, under Att göra (påminnelsen), i Kommande möten, på översikten (”Videomöte 14.00 · Anslut”, framträdande från 10 min före), på sidan Videomöten och i chattens kort. Öppnar man `#/videomote/<id>` direkt startar förhandsvisningen.
- **Gästen** (kunden) öppnar länken i Chrome, Edge eller Safari utan konto: skriver sitt namn, provar kamera och mikrofon, väljer bakgrund och klickar på **Be att få gå med**. Hen väntar i väntrummet tills värden släpper in (eller nekar).
- **Värden**: förhandsvisningen (kamera, mikrofon, högtalare, Testa ljud och bild, bakgrund) → **Gå med nu**. Aviseringen ”X väntar i väntrummet” med **Släpp in**; panelen Deltagare med **Släpp in alla**, Neka, Be om att stänga av mikrofonen, Ta bort, Gör till värd, Lås mötet.
- **Kontrollraden**: Mikrofon (Ctrl+Shift+M), Kamera (Ctrl+Shift+O), Dela skärm (Ctrl+Shift+E), Räck upp handen (Ctrl+Shift+K), Reaktioner, Mer (Inställningar, Bakgrund och effekter, Galleri/Talare, Helskärm, Dölj egen bild, Anslutning, Kopiera möteslänk, Kortkommandon), Lämna (Ctrl+Shift+H) och för värden Avsluta för alla. Chatt i mötet (Ctrl+Alt+C), Deltagare (Ctrl+Alt+P). Håll mellanslag för att prata när mikrofonen är av. Minimera gör mötet till en liten ruta så att man kan använda CRM:et under tiden.
- **Inställningar** (fungerar på riktigt): upplösning 360p/720p/1080p, bildfrekvens 15/24/30, sändkvalitet Auto/Spara data/Bara ljud, ta emot Allt/Bara ljud, spegla min video, ljusförbättring, brusreducering, ekoreducering och automatisk volym. **Bakgrund**: Ingen, Oskärpa (Lätt/Stark) eller Bild (förval eller egen uppladdad) – räknas fram lokalt i webbläsaren med en segmenteringsmodell (MediaPipe, ligger i `crm/vendor/mediapipe/`); ingen bild skickas iväg.
- **Efter mötet**: värden skriver vad ni kom fram till och nästa steg (blir en uppgift) och kan spara chatten från mötet. **Spara i kundens historik** loggar ”Videomöte (32 min): …” med kameraikon och länken **Visa mötet**; påminnelsen bockas av. Sidan `#/videomote/<id>` visar vilka som var med, anteckningen och chatten.
- **Chatten**: kameraknappen i konversationens topp (`vm-chatt-starta`) startar ett videomöte direkt med alla i konversationen och lägger kortet `.ch-vmkort` (”Videomöte · pågår”, **Anslut**) i tråden.
- **Direktsamtal**: mötet går direkt mellan datorerna (P2P, alla till alla) – gratis och utan minutgräns, högst fyra personer (du och tre till). Kvaliteten sänks automatiskt vid fler deltagare eller svag anslutning.
- **Prototyp** (står i gränssnittet): videomötet fungerar mellan flikar i samma webbläsare (signaleringen går via BroadcastChannel bakom `IH.samtal.signal`). Mellan olika datorer behövs en liten signalväxel (WebSocket, t.ex. Cloudflare Worker) och TURN som reserv, samt https – då byts bara signalen, resten av gränssnittet är detsamma.
- Prova så här: värden i CRM:et i en flik, gästen öppnar inbjudningslänken (mote-gast.html) i en annan flik. Ett möte mellan två kollegor går inte att prova i prototypen – inloggningen delas mellan flikarna, så båda blir samma person. Chattens mötesskort visar "pågår · N inbjudna" (hur många som är inne syns i själva mötet). Från kalendern kan ett videomöte bokas utan kund – kopiera då länken i inbjudan.

### Min profil `#/profil[/id]` (ledning.js)
- `.lp-phjalte` (id-kort `.lp-phjalte__vanster`, `lp-andra-profil`, status via `konto-meny`, tal `.lp-phjalte__tal`), `.lp-tvakol`: **Om dig** (`lp-om-skriv`, kontakt, genvägar) och **Aktivitet och arbete** (graf 30 d, affärer, uppgifter `lp-egen-uppg`, `lp-klar`, `lp-mal`), `.pk` **Min kalender** (`pk-man`, `pk-vy` Månad/År, `pk-ics` kalenderfil, `pk-dag`, `pk-ny`, `pk-sjuk` Sjukanmäl i dag, `lp-franvaro` Lägg in frånvaro).

### Försäljningsledning (chefsvyn, i menyn Försäljning) `#/chef` – bara chefen
- `.ap-hjalte`: `.ao-text` (`km-nytt-konto` Nytt konto, `lp-mal` Sätt mål, `lp-uppgift` Ge uppgift, `lp-rapport` Exportera rapport), `.lp-mork__mitt` (ring mot målet), `.ap-tal`, `.lp-veckor`.
- `.ao-band`: **Teamet just nu** (`lp-chef-filter`, `ch-skriv-till`), **Vem jobbar när** (`lp-narv-v`, `lp-franvaro`), **Teamets kalender** (`lp-kal-vem`, `lp-kal-man`, `lp-kal-vy`, `lp-kal-typ`, `lp-kal-ny`, `lp-kal-dag`, `lp-kal-ics`), **Behöver din uppmärksamhet** (`lp-agera-f`, `lp-fordela-smart` **Fördela smart** fördelar jämnt, `lp-ta-sjalv` Ta själv, `lp-fordela` Fördela), **Öppna affärer per säljare**, **Aktivitet 14 dagar**, **Topplistan** (`lp-topp-period` 30 d/90 d/I år).

### Inställningar `#/installningar`
- `.inst-tema` **Utseende** (sex teman + Följ systemet, `tema-val`), `.inst-layout` **Layout** (Minimal, Normal, Full, `layout-val`), `.inst-mallar` **Mallar för mejl och SMS** (`mall-ny`, `mall-forhand` Visa, `mall-andra` Ändra; fält `{förnamn}` m.fl.; kanal mejl, SMS eller chatt; "CRM:et skickar inget självt"), `.instopp` (prisspann, tillval, ändrad), `.prisrutnat` två `form.prisform[data-form=prislista]` (Husen, Tillval och poster), `.installning__proto` (prototyptexten; för admin **Återställ exempeldata** `aterstall`, kräver andra klick inom 4 s).

### Kolla marken `#/kolla-marken`
- `.verktygtopp` + `iframe.verktygram__ram` med hemsidans verktyg (`vad-far-jag-bygga.html?crm=1`): jordart, vatten och djup till berg från SGU, sök adress eller position. Översiktligt – ingen geoteknik.

### Admin
- **Kontrollcentral** `#/kontroll`: `.ao-hjalte` (ringar säkerhet/konton/data/drift, `sh-skanna-ga`, `km-nytt-konto`, `ad-exportera`), banden Hur kontona mår, Skyddet just nu, Datan och kopplingarna, Vem gör vad och när, Senast i CRM:et, System och fel, Bör åtgärdas (`kc-csv`, `kc-rapport`, `kc-rensa-bilder`, `kc-rensa-logg`, `ad-aterstall`).
- **Adminpanel** `#/admin`: `.ap-hjalte`, Konton och roller (`ap-filter`, `ap-andra`, `valj-anvandare` Visa som, `ap-aktiv` Inaktivera, `km-nytt-konto` Nytt konto), Bör åtgärdas, Vem får göra vad, För den här webbläsaren (utloggning vid inaktivitet), Data och system (export, import, `ad-aterstall`), Granskning och ändringar (`ap-logg`).
- **Säkerhet** `#/sakerhet`: `.sh-hjalte`, `.sh-drift`, `.sh-verktyg` (`sh-rapport`, `sh-auto`, `sh-behorighet`, `sh-kopiera`), Sju kontroller (`sh-skanna[data-ids]`: skadlig kod, uppdateringar, buggar, läckor, intrång, avvikande beteende, trasigt), Skanningens logg (`sh-loggtyp`), Poängen över tid. Poäng = 100 − avdrag (hög −25, medel −10, låg −3).

### Teman och layout (tema.js, layout.js)
- **Teman** (`IH.tema`, sparas per konto i `ih-crm-tema:<id>`): Följ systemet (Original eller Mörk efter datorn), **Original** (varm kräm och bärnsten), **Ljus**, **Mörk**, **Färgglad**, **Bygg** (betong, stål och varselgult), **Office** (stramt, svalt och neutralt). Väljs i Inställningar (`.tema-valjare--stor`), kontomenyn (`.km-tema`, `.tema-valjare--liten`) och sökpaletten.
- **Layout** (`IH.layout()`, `IH.layout.satt(id)`, sparas i `ih-crm-layout:<id>`, attributet `html[data-layout]`): **Minimal** (bara det du jobbar med – tätt och lugnt), **Normal** (överblick utan dekor), **Full** (allt, stora bildytor och 3D – förval). Inget försvinner; det som döljs i Minimal finns i Normal och Full. Väljs i Inställningar (`.inst-layout`), kontomenyn (`.km-layout`) och sökpaletten. Händelsen `ih:layout` skickas vid byte.
- Turerna använder `om: inteMin` och reservlistor för det som döljs i ett läge.

### Gemensamma detaljer
- Datumrutor får CRM:ets egen kalender (kalender.js), rullgardiner egen väljare (valj.js), talrutor −/+ (grund.js). Uppladdade filer kontrolleras av filskannern (filskanner.js + filregler.js).
- `IH.lysUpp(väljare)` lyser upp det som ändrats; toasts med Ångra/Öppna.

---

## 3b. Nytt i steg 11 – färdigt i klienten (2026-10-30)

Allt nedan finns i koden och fungerar i den här webbläsaren. Inget skickas av CRM:et självt – mejl och SMS öppnas i användarens eget program och loggas som "mejlutkast öppnat".

**Skalet**
- **Aviseringar**: klockan (se Skalet) öppnar arket Aviseringar (`.avis-panel`): Nya/Tidigare, klick öppnar det raden gäller (`avis-oppna`), `avis-last`, **Markera alla som lästa** (`avis-alla-lasta`), **Ta bort lästa** (`avis-rensa`), **Skrivbordsaviseringar** Slå på/Stäng av (`avis-skrivbord`). Text: "Aviseringar visas när CRM:et är öppet i den här webbläsaren."
- **Påminnelser som larmar**: vid start, varje minut och när fliken visas igen går öppna uppgifter med förfallotid igenom. Passerad tid → toast med **Klar**, **+1 h**, **Öppna**, en avisering (en gång per uppgift) och skrivbordsavisering om den är på.
- **Dagens sammanfattning**: första gången kontot öppnar CRM:et en dag – uppgifter i dag och offerter som går ut inom 7 dagar.
- **Ångra** i 8 s efter borttagningar; **CSV** med formelskydd; **J/K/X** i listor; sökpaletten med Dokument, Anteckningar, Chatt, Ny offert och Nytt videomöte.

**Sälj**
- **Affär**: **Ändra affären** (`aff-andra`: Titel, Kund, Hus, Uppskattat värde – styrs av offerten när en finns, Ansvarig säljare för chef, **Förväntat avslut**), **Ta bort affären** (`aff-bort`, bara utan godkänd offert, två klick, Ångra), **Skriv ut** (`aff-skriv-ut`). Säljtavlan: **Exportera CSV** (`aff-csv`), massåtgärder i listläget **Flytta steg** (`aff-bulk-steg`) och byt ansvarig (chef, `aff-bulk-ansvarig`).
- **Uppgifter**: Ändra (`uppg-andra`: Vad ska göras?, Datum, Tid, Ansvarig, Kund, Affär, **Upprepa**: Upprepas inte / Varje vecka / Var 14:e dag / Varje månad) och Ta bort med Ångra. En upprepad uppgift som bockas av skapar nästa. Massåtgärder under Att göra: Klar, Skjut, Ta bort (`uppg-bulk-*`).
- **Anteckningar**: egna anteckningar i historiken kan ändras och tas bort (`akt-andra`, `akt-bort`); ändrade visas som ändrade. Systemhändelser går inte att ändra.
- **Offerter**: **Ny offert** (`offert-ny`, välj affär – de utan offert först), **Skicka offerten** (arket ovan), **Kunden avböjde**, **Följ upp** (`offert-folj-upp`: Ring, SMS, Mejl `offert-kontakt` + uppföljning I morgon/Om 3 dagar/Nästa vecka), massåtgärd **Förläng 14 d** (`off-bulk-forlang`), **Exportera** (`off-csv`).
- **Förfrågningar**: dubblettkontroll vid Lägg in förfrågan (telefon/e-post) med **Koppla till …** (`nyf-koppla`); **Välj flera** (`f-valjlage`) → Tilldela (chef, `f-bulk-tilldela`) och Ej aktuell (`f-bulk-ej`); **Annan mall** (`mall-anvand`) för svarsutkastet.
- **Kunder**: **Mer** på kundkortet (`kund-mer`): Mejl eller SMS från mall, **Kolla marken**, Skriv ut kundkortet, Exportera historiken (CSV), **Registerutdrag** (utskrift eller JSON), **Slå ihop med…** (`kund-ihop`). **Taggar** (`kund-tagg-ny` med förslag ur befintliga `kund-tagg-val`, `kund-tagg-bort`; kundlistan kan filtreras på tagg), **egna fält** som admin definierat, **Importera** kunder från CSV (`kund-import`, chef och admin, högst 500 rader, förhandsvisning med dubbletter, Ångra).
- **Sparade filter** (`filter-spara`, `filter-anvand`, `filter-hantera` döp om/ta bort) som flikar på Kunder, Säljtavlan, Förfrågningar och Offerter.
- **Kolla marken** från kund eller affär (`kund-mark` → `#/kolla-marken/<kund>`): kunden står överst och **Spara på kunden/affären** (`km-spara`) sparar resultatet i historiken.
- **Vunnen och klart**: vinsttoasten har **Skriv tackbrev**; när ett projekt blir Klart föreslås **Gör överlämningsprotokollet** och **Uppföljning om 30 dagar**.

**Ledning och admin**
- **Försäljningsledning**: rapporten med period (Denna månad, Förra månaden, Kvartalet, I år, Eget intervall, `lp-rapp-period`), jämförelse, förlustorsaker och CSV (`lp-rapp-csv`); uppgifter i teamets kalender kan ändras och tas bort (`lp-kal-uppg`); fördelning aviserar säljaren.
- **Adminpanelen**: **Börja med tom data** (`ap-tom`: exportera först, skriv TÖM; konton, prislista, mallar och inställningar behålls), **egna kundfält** (`ap-ef-*`), **förlustorsaker** (`ap-fo-*`), **gallring** (av som standard; "Kunder utan aktivitet på N månader" med Registerutdrag och Radera), **Exportera hela aktivitetsloggen** (`logg-csv`).
- **Kontrollcentralen** hittar kunder med samma telefon eller e-post (länk till Slå ihop).

**Kommunikation**
- Chatten: nya meddelanden och omnämnanden blir aviseringar, chattmeddelanden går att söka i paletten, egna chattmallar från Inställningar visas efter de inbyggda.
- `IH.videomote.nytt()` / **Nytt videomöte** (`vm-nytt`): arket med **Starta nu** eller boka en tid, utan förvald kund. Sidan **Videomöten** `#/videomote` (nås via **Alla videomöten** under Kundmöte) visar Kommande och Senaste med **Anslut**. Gränssnittet säger "Prototyp – videomötet fungerar mellan flikar i den här webbläsaren."

### Kräver server (listas, låtsas inte)
Fleranvändare och synk mellan datorer · riktig inloggning och kontoflöden · förfrågningar direkt från hemsidans formulär · skicka mejl/SMS från CRM:et · kunden godkänner offerten själv (signering) · aviseringar när CRM:et är stängt och mellan personer · videomöten mellan datorer (signalväxel + TURN; stora möten senare med LiveKit) · kalendersynk med Outlook/Google · inkommande mejl på kunden · fillagring och riktig virusskanning · säker import/export · GDPR fullt ut (radering i backup, samtyckeslogg) · revisionslogg och behörighet som går att lita på · säkerhetsheaders · säkerhetskopior · eventuell SGU-proxy. Underlag: `.claude/kraver-server.md` och scratchpad `fardig/plan.md` del 2.

---

## 4. Flödena (standard inom försäljning)

1. **Förfrågan** kommer in (hemsidan = Webbformulär/Verktyget, eller **Lägg in förfrågan** när någon ringer/mejlar). Den hamnar överst i inkorgen med poäng och svarsmål.
2. **Ta den** → **Ring** (eller Svarsutkast) → gå igenom **samtalsguiden** → **Kontaktad**. Nu skapas **kunden** (kundkortet) och samtalet loggas.
3. **Skapa affär** (från förfrågan, från kundkortet med Ny affär, med N → Affär, eller Ny affär på säljtavlan): välj hus, värdet hämtas ur prislistan, steg Kontakt tagen. Förfrågan blir "Blev affär".
4. **Säljtavlan**: boka platsbesök → **Tomt och platsbesök** (Platsbesöket är bokat / Boka platsbesök i mötet lägger en uppgift om en vecka). Följ "Nästa bästa steg" och Fokus i dag.
5. **Kundmöte**: välj affär och upplägg, **Starta presentation**, anteckna (N), räkna i **kalkylen** (K) och **Spara som offert**, avsluta med **Boka platsbesök** eller **Mejla en sammanfattning**. Anteckningen sparas när mötet stängs.
6. **Offert**: Skapa offert (huset + frakt + montage ur prislistan) → justera rader och tillval → **Skicka offerten**: Skriv ut / PDF, Öppna i mejlprogrammet och bifoga PDF:en, **Markera som skickad** (affären → Offert skickad, giltig 30 d, kopia i dokumentarkivet). Svar: **Kunden godkände** eller **Kunden avböjde** på offertsidan. Ändringar efter skickad: **Ny version** (gamla = ersatt). Följ upp eller **förläng +14 d** under Offerter/Går ut snart eller i Dokument.
7. **Förhandling** → **Order signerad** (eller Kunden godkände på offerten): affären vunnen, offerten godkänd, konfetti, **projekt** skapas (montage om 12 veckor) och projektvyn öppnas.
8. **Projekt**: checklistan Innan montaget (kundens och vår del), montagedag, stegen Ritning och lov → Tillverkning → Grund och mark → Leverans och montage → Slutbesiktning → **Klart** (överlämnat).
9. **Dokument och mallar** längs vägen: Följebrev till offert, Protokoll från platsbesök, Tack för ordern, Checklista inför montage, Leveransplan, Egenkontroll efter montage, Överlämningsprotokoll.
10. Förlorad: dra till förlustdockan eller **Markera som förlorad** med orsak; **Återuppta** under Förlorade.

---

## 5. Guiderna (crm/guide/) – omgjorda 2026-11-01

| Fil | Innehåll |
|---|---|
| `guide.css` | Slöjan, hålet (`.ihg-hal`), ramen (`.ihg-ring`), rutan (`.ihg-bubbla`), startsidan (`.ihg-meny`, `.ihg-kurs`), hjälpknappen (`.ihg-knapp`), välkomstkortet (`.ihg-hej`). Sista blocket "Guiden omgjord" är den gällande stilen: glas, bara `--t-*`, slöjan bygger på `--t-skugga-rgb` |
| `guide.js` | Motorn `IH.guide`: `registrera`, `starta(id, {auto, fran})`, `stang`, `nasta`, `forra`, `fortsatt`, `peka(mal, {sida, rubrik, text, saknas})`, `oppna` (startsidan), `turForSidan`, `klara`, `lage`, `nollstall`, `nastaTur`. Länk: `index.html?tur=<id>#/<sida>` (&auto=1 = autospel). Händelsen `ih-guide` (start, steg, klar, slut) |
| `turer.js` | Turerna och kurserna (`IH.guide.kurser`) som data |
| `presentation.html/.css/.js` | Bildspelet för nya säljare |
| `video.html/.css/.js`, `video/` | Genomgången `video/genomgang.mp4`. Inspelad före omgörningen: bilderna visar de gamla, längre turerna |

**Guiden stannar aldrig.** Den förbereder skärmen själv och hoppar tyst över det som inte gäller. Det gamla meddelandet "Den här delen syns inte just nu" är borttaget.
- Menyn: ett mål i sidomenyn när menyn är infälld fäller ut den (`fallUt: true` på steget, annars automatiskt när målet är `.sido…`, `.anv` eller `.vy-vaxel`). Menyläget återställs när turen slutar och också vid omladdning (`ih-guide-sido-ater`). Rader under Mer pekas ut med `.sido__merknapp` (hjälparen `meny(vy)` i turer.js).
- Saknas målet efter väntetiden (sidbyte 7 s, valfri 2 s, annars 4,5 s) läggs steget i `aktiv.hoppade` och nästa steg visas. Räknaren visar bara steg som gäller.
- När turen slutar stängs ark, sökpalett, kontomeny och (i övning) presentationen som turen öppnat.

**Steg:** `sida`, `mal` (väljare/lista/funktion, första synliga vinner), `rubrik`, `text`, `vanta` (användaren klickar på det markerade), `prova` + `klar(ctx)` (går vidare när handlingen är gjord), `gor` (uppmaningen), `bra` (berömmet), `gorSjalv` ("Gör det åt mig"), `fri`, `fyll`, `om`, `roller`, `valfri`, `fallUt`, `fore`, `placering`, `luft`, `behallArk`, `efterKlick`, `tangent`, `tangenter`, `klickaPa`.

**Övning:** `ovning: true` på turen tar en kopia av `IH.db` (i `ih-guide-ovning`) och lägger tillbaka den när turen slutar, också om sidan laddas om mitt i. Klarkortet har **Behåll det jag gjorde**. Övningar: forfragningar, saljtavla, affar, kunder, presentation, videomote, projekt, att-gora, flode-ny-kund, flode-offert, flode-mote, flode-overlamning.

**Startsidan Lär dig CRM:et** (bokknappen `.ihg-knapp` vid menyn): ring med procent och antal klara, vad man senast lärde sig, **Fortsätt där du slutade** eller **Nästa**, förslag för sidan och rollen, sökruta bland kurserna, kurskort med ikon, tid kvar och status (Klar, Nästa, Pågår, Inte börjad), **Fråga assistenten**. När en hel kurs blir klar firas det på klarkortet. Framsteg per konto: `ih-guide-klara:<konto>`, var man slutade: `ih-guide-pagar:<konto>` (en övning börjar om, annars fortsätter den från närmaste steg med egen sida).

| Kurs | Turer |
|---|---|
| Kom igång | valkommen (Hitta i CRM:et), oversikt, utseende, aviseringar |
| Från förfrågan till affär | flode-ny-kund, forfragningar, saljtavla, affar |
| Kunder och offerter | kunder, kundsida, flode-offert, offerter, offert |
| Kundmöten | flode-mote, kundmote, presentation, videomote, videomoten |
| Order, bygge och dokument | flode-overlamning, projekt, flode-dokument, dokument |
| Din dag | att-gora, chatt, chatt-verktyg, profil, installningar |
| Försäljningsledning | chef (chefen) |
| Administration | kontroll, adminpanel, sakerhet, supportlage (admin) |

Dokumentsidan minns fliken Arkiv/Mallar – turerna använder `iArkiv(väljare)`.

### Underhåll
- Ändras en klass eller ett `data-g`: sök i `turer.js` och `assistent-kunskap.js`, kör `scratchpad/lg/tur.mjs <jag> <läge> <infälld 0|1> <turer|alla> [bredd] [höjd]`. Raden `HOPPADE` visar steg vars mål saknas.
- Nya sidor: lägg till en tur med `vy` = vyns namn och lägg turen i en kurs.

---

## 6. Hjälpassistenten (crm/assistent*.js) – 2026-11-01

Lokal hjälpassistent, **ingen AI**, och det står i panelen. Ingen server och ingen nyckel i webbläsaren; inget skickas iväg.

| Fil | Innehåll |
|---|---|
| `assistent-kunskap.js` | Handskrivna ämnen ur den här filen (`amnen`), synonymer, spärrord och förslag per sida. Turerna indexeras automatiskt |
| `assistent.js` | Motorn (matchning, avsikter, följdfrågor), verktygen och panelen |
| `assistent3d.js` | Husfiguren i three.js, ES-modul som laddas när sidan ritats |
| `assistent.css` | Figurknappen `.ia-knapp`, panelen `.ia-panel`, bubblan `.ia-bubbla` och valen `.ia-val` |

- **Gränssnitt för riktig AI senare:** `IH.assistent.svara(fraga, sammanhang)` ger en Promise med `{text, rader, knappar, utfor, kalla}`. `IH.assistent.sattMotor({namn, svara})` byter motor. `IH.assistent.verktyg` är de läsande verktygen. Fel i motorn faller tillbaka på den lokala.
- **Ordning:** småprat, följdfråga, rollspärr, handling, sidbyte, guide, data, kund, kunskapsbas. Under 0,34 i poäng säger den att den inte vet och föreslår närmaste ämnen; 0,34–0,55 frågar den vad du menar.
- **Språket:** å/ä/ö vikas, svenska ändelser kapas, stavfel rättas (en bokstav i korta ord, två från sju bokstäver), synonymer, sammansatta ord.
- **Verktyg:** nyaForfragningar, senaUppgifter, uppgifter(dag), offerterVantar, offerterGarUt, moten, storstaAffarer, stillaAffarer, prognos, nastaMontage, hittaKund, teamLage (chef). Alla frågar `far(vy)`, som bygger på `IH.jag()` och `IH.sparrad`.
- **Handlingar:** ny kund, ny uppgift, ny förfrågan, ny affär, ny offert och nytt videomöte öppnar det vanliga formuläret förifyllt. Assistenten sparar aldrig något själv.
- **Roller:** säljare får inte chefens eller adminens delar, administratören får inte säljdelarna (hänvisas till supportläget). Svaret nämner bara vilken del det gäller.
- **Figuren:** husfiguren i 3D är själva knappen (`.ia-knapp`, en canvas och en WebGL-kontext) och kliver upp i panelens huvud när den öppnas. Laddas med `requestIdleCallback` efter första ritningen. Tillstånd: vila, lyssnar, tanker, svarar. I vila ritas inget: en kort gest (blinka, titta upp) var 3–7 s, högst 24 bilder/s; andningen är CSS. Vinkar när musen pekar på den och visar en bubbla (`.ia-bubbla`) med ett eller två klickbara förslag ur läget på sidan, en gång per sida och högst var 45:e sekund. Klick ställer frågan. Stängd med krysset kommer den inte tillbaka på 10 minuter. Figuren tittar på bubblan. `granska()` stoppar vid dold flik, `html[data-presenterar]`, `.mote`, `#vm`, ark, palett, guide och öppet chattfönster. `prefers-reduced-motion` ger en stillbild. Panelen Lär dig CRM:et visar en stillbild av figuren (`IH.assistent.figurBild()`), ingen egen WebGL.
- **Inställningar:** kortet `.inst-assistent`: Levande, Stilla, Liten ikon (ingen 3D alls) och Till höger, Till vänster. Sparas i `ih-crm-assistent:<konto>`.
- **Placering:** nere till höger, till vänster om chattbubblan (`body.chf-bubbla-plats`), på mobil ovanför bottenmenyn. Toasterna lyfts över figuren och sidan får luft nedtill. Dold under presentation och videomöte (`html[data-ia-dold]`).
- Ändras CRM:et: uppdatera `amnen` i `assistent-kunskap.js` tillsammans med den här filen.
