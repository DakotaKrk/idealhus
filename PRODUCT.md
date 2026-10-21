# Product

<!-- impeccable:product-schema 1 -->

> Skriven 2026-10-21 av Claude under `/impeccable init`. Användaren bad Claude svara på intervjufrågorna själv utifrån projektets minne; allt nedan är härlett ur minnet, `llms.txt` och koden, inte bekräftat i en intervju.

## Platform

web

## Users

- **Sajten (idealhus.se):** privatpersoner som vill bygga attefallshus eller fritidshus, och byggföretag/entreprenörer som köper byggelement.
- **CRM:et (`crm/`):** Idealhus egna medarbetare i två roller – **Sälj** (förfrågningar, säljtavla, kunder, offerter, kundmöten) och **Produktion** (projekt, montage, checklistor). De sitter främst vid dator; mobilen ska fungera men desktop är viktigast. CRM:et visas just nu som prototyp för ledningen (användarens chef).

## Product Purpose

Idealhus formger och bygger attefallshus och fritidshus och tillverkar byggelement för proffs, allt under tak i Sverige. Husen kommer i färdiga delar till tomten och monteras på några dagar. CRM:et samlar hela kundresan från förfrågan till nyckel på ett ställe, så att samma kontakt kan följa kunden från första samtalet till besiktningen.

## Positioning

Fem egna husmodeller (Sadel 30, Sadel 30 Bred, Pulpet 30, Kupa 40, Kupa 50), byggda under tak och monterade på dagar, med en och samma kontakt hela vägen. CRM:et är byggt kring just den resan (säljsteg → projektsteg → montage), inte ett generiskt säljverktyg.

## Operating Context

- Säljflödet: Förfrågan → Kontaktad → Platsbesök/kundmöte → Offert (Utkast → Skickad → Godkänd) → Vunnen affär → Projekt.
- Produktionsflödet: projektsteg i fabriken, checklista inför montage (ritning, lov, grund, väg), montage och överlämning.
- Kundmöten hålls i en helskärmsvy (`mote.js`).

## Capabilities and Constraints

- Statisk prototyp: HTML/CSS/vanilla JS, ingen byggkedja, data i `localStorage` (`ih-crm-v1`), demo-inloggning.
- All data är exempeldata (påhittade namn Maja Lind/Jonas Ek, PTS-nummer 070-174 06 xx, `@example.com`). Priserna är exempel, inte Idealhus priser.
- Svenska genomgående. Inga tredjepartstjänster för persondata.
- Skarp version (ej byggd): egen server hos Loopia (PHP + databas) och riktig inloggning.

## Brand Commitments

- Namnet Idealhus och logotypen i `images/idealhus_logo.svg` (varmgrått `#82776b`).
- CRM:et ska vara **ljust, mjukt och varmt** – användaren har uttryckligen avvisat mörka rutor/brickor ("ser billigt ut"). Palett och typsnitt (Poppins + Manrope i `fonts/`) delas med sajten och ska inte bytas utan att fråga.
- Inga stora sidrubriker i CRM-vyerna (användaren: "tar onödig plats").

## Evidence on Hand

- Riktiga husmodeller, ytor och regler i `llms.txt` och `_modeller.py`; husbilder i `images/`.
- Inga riktiga kunder, priser, kundcitat eller siffror finns – får inte hittas på.

## Product Principles

1. Allt ska gå att förstå direkt – en mening om läget före siffrorna.
2. Kundresan från förfrågan till nyckel är ryggraden i varje vy.
3. Ljust och lugnt hellre än tätt och mörkt.
4. Hitta aldrig på fakta, priser eller namn.
