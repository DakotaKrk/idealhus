# Fabriken – riktiga bilder och film

Riktiga foton och film från Legohus husfabrik (november 2026). Inga AI-bilder.
Bilderna har bara fått lätt naturlig korrigering: vitbalans, exponering, lite kontrast och skärpa.

**Logobyte:** På fasadbilderna satt en banderoll från den tidigare ägaren ("Bergslags Hus"). Den har bytts mot
Legohus-loggan (`images/legohus_logo.svg`, samma logga som i sidhuvudet). Loggan följer banderollens vinkel,
med fotots ljus, skuggor och brus. Övriga leverantörsmärken (Sveden Trä-stämpel, XL Bygg-påse, Elitfönster-etiketter)
syns bara i liten skala och har fått vara kvar.

**Filnamn:** `namn-1600.webp`, `-1200`, `-900` och `-800` anger den längsta sidan i pixlar. Använd den stora filen som
`src` och den lilla i `srcset`, till exempel
`srcset="images/fabrik/hall-800.webp 600w, images/fabrik/hall-1600.webp 1200w"`.
Alla bilder har kvalitet 80.

## Bilder

| Fil | Storlek (bxh) | Visar | Rekommenderad plats | Förslag på alt-text |
|---|---|---|---|---|
| `fasad-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Fabrikens röda fasad nära, med Legohus-banderollen, fönsterbandet och en besökare i kanten | Om oss, förtroende ("Vår egen fabrik") | Legohus fabrik: röd träfasad med Legohus-skylt under blå himmel |
| `fasad-oversikt-1600.webp` / `-800` | 900x1600 / 450x800, stående | Hela fabriksbyggnaden från ängen, sommarljus, Legohus-skylt på gaveln | Mobil-hero, om oss | Legohus husfabrik, en stor röd fabrikshall med Legohus-skylt, sedd över en sommaräng |
| `fasad-bred-900.webp` | 900x570, liggande | Samma vy beskuren liggande, bara byggnaden och himlen | Desktop-kort, om oss, sidfot (finns bara i 900 bredd, förstora inte) | Legohus fabrik i sommarsol, röd hall med portar och parkering |
| `hall-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Den långa ljusa produktionshallen med arbetsbord för väggelement | "Så byggs ditt hus", steg 1 (fabriken) | Den ljusa produktionshallen där Legohus väggelement byggs inomhus |
| `hall-langsida-1600.webp` / `-800` | 900x1600 / 450x800, stående | Lång gång i den äldre delen av hallen, stålstomme och travers | Galleri, bakgrund med mörk överton | Lång gång i Legohus fabrikshall med stålstomme och travers |
| `vaggelement-produktion-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Väggelement på byggbordet i förgrunden, röda ytterväggar och personal i varselkläder bakom | "Så byggs ditt hus" (stomme och isolering), förtroende | Väggelement byggs på arbetsbord i Legohus fabrik, med personalen i bakgrunden |
| `team-i-hallen-1200.webp` / `-800` | 1200x760 / 800x507, liggande | Personal i hjälm och varselvästar vid byggborden, virke och material | Om oss ("Människorna bakom"), förtroende | Legohus personal i hjälmar och varselvästar i fabrikshallen |
| `vaggstommar-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Färdiga regelstommar och panelade väggar lutade mot väggen | "Så byggs ditt hus" (stommen), galleri | Färdiga väggstommar i trä står lutade i Legohus fabrik |
| `vaggelement-rod-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Färdigt rött väggelement med fönsterhål, plastskyddat element bakom | "Så byggs ditt hus" (färdigt element), hero-kort | Färdigt rött väggelement med fönsteröppningar, klart för leverans |
| `vaggelement-stallning-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Rött ytterväggselement och ett plastskyddat element med fönster i transportställning | "Så byggs ditt hus" (leverans), galleri | Väggelement med fönster står i transportställning, inplastade inför leverans |
| `vaggelement-lager-1600.webp` / `-800` | 1200x1600 / 600x800, stående | Rad av inplastade väggelement i ställningar, redo för utleverans | Galleri, förtroende ("Lagret") | Inplastade väggelement står på rad i Legohus lager, redo att levereras |
| `vaggelement-montage-1200.webp` / `-800` | 1200x900 / 800x600, liggande | Väggelement med monterade fönster, stagade och inplastade; arbetsbordet är beskuret bort | "Så byggs ditt hus" (fönster monteras) | Väggelement med monterade fönster stagas upp i fabriken |
| `vaggar-med-fonster-1200.webp` / `-800` | 1200x850 / 800x567, liggande | Röda ytterväggar med vita spröjsade fönster, klara för leverans | Hero-kort, "Så byggs ditt hus" (färdigt), startsidans förtroendeband | Röda ytterväggar med vita spröjsade fönster, färdiga i Legohus fabrik |
| `fonster-pall-1200.webp` / `-800` | 1200x700 / 800x467, liggande | Fönster och glaspartier på pall, inplastade | "Så byggs ditt hus" (material), galleri | Nya fönster på pall, inplastade och klara att monteras |

## Film

Källfilmen är stående (576x1024, 9:16) och har därför inte förstorats till 1280 bredd. Den passar bäst i en stående ram,
eller som bakgrund med `object-fit: cover` (bilden beskärs då i höjdled).

| Fil | Storlek | Visar | Rekommenderad plats |
|---|---|---|---|
| `fabrik-loop.mp4` (H.264, ca 1,7 Mbit/s, faststart, ingen ljudspår) | 576x1024, 12 s, ca 2,5 MB | En travers lyfter ett färdigt väggelement genom hallen. Slutet tonas mjukt in i början, så loopen går runt utan hack | Hero eller bakgrund i "Så byggs ditt hus": `autoplay muted loop playsinline` |
| `fabrik-loop.webm` (VP9, inget ljud) | 576x1024, 12 s, ca 1,9 MB | Samma som ovan | Lägg först som `<source>` |
| `fabrik-loop-poster.webp` | 576x1024 | Första bildrutan i loopen | `poster` för loopen |
| `fabrik-film.mp4` (H.264, ca 1 Mbit/s, AAC mono, faststart) | 576x1024, 2:04, ca 15 MB | Hela rundturen i hallen: byggborden, personalen, traversen med väggelementet och de vita väggarna längst in | Om oss / "Besök fabriken" med kontroller (`controls preload="none"`) |
| `fabrik-film.webm` (VP9 + Opus) | 576x1024, 2:04 | Samma som ovan | Lägg först som `<source>` |
| `fabrik-film-poster.webp` | 576x1024 | Bildruta från 0:20, översikt av hallen | `poster` för hela filmen |

Förslag på text till filmen: "Film från Legohus fabrik: väggelement byggs och lyfts med travers i produktionshallen."

Fasadskylten syns inte i filmen. Längst in i hallen finns röda sprejmarkeringar på vita väggar. De är inga loggor
och har fått vara kvar.

## Bortvalt

- **Skärmdumpar med iPhone-gränssnitt:** Fyra bilder var skärmdumpar. Två av dem hade synliga knappar, en galleriremsa
  i nederkant och en textigenkänningsikon. Den rena originalbilden har använts i stället för varje skärmdump.
- **Mörka eller suddiga:** En mörk och oskarp bild på väggstommar valdes bort. `vaggstommar` visar samma motiv skarpare.
- I `vaggelement-produktion` syns en handskriven röd "B"-markering på reglarna. Det är en vanlig snickarmärkning
  för ett väggelement, ingen logga.
