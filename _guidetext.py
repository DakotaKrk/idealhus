# -*- coding: utf-8 -*-
"""Innehållet till attefallsguiden.

Sektionerna ligger som data, inte som en enda lång sträng: innehålls-
förteckningen i vänsterkanten och rubrikerna i texten byggs ur samma
lista, så de kan aldrig säga olika saker.

Reglerna är kontrollerade 2026-09-08. Ändra dem inte utan att kontrollera
mot en aktuell källa. De skrevs om 1 december 2025 och kan skrivas om igen.
"""

FRAGOR = [
    ("Krävs det bygglov för ett attefallshus?",
     "Nej, inte så länge huset håller sig inom måtten. Sedan 1 december 2025 krävs varken bygglov "
     "eller anmälan för själva byggnaden. Men ska huset ha vatten, avlopp, "
     "ventilation eller eldstad krävs fortfarande en anmälan för de "
     "installationerna, och det gör de flesta hus som ska gå att bo i."),
    ("Hur stort får huset vara?",
     "Inom detaljplan högst 30 m² per byggnad och 45 m² sammanlagt på tomten, "
     "med en nockhöjd på 4,0 meter. Utanför detaljplan är gränserna 50 m² per "
     "byggnad, 65 m² sammanlagt och 4,5 meter i nockhöjd."),
    ("Hur nära tomtgränsen får huset stå?",
     "Minst 4,5 meter, om inte grannen ger sitt skriftliga medgivande. Utan "
     "medgivande krävs bygglov för en placering närmare gränsen."),
    ("Får jag bo i huset året om?",
     "Ja, om det byggs som komplementbostadshus. Då ska det uppfylla kraven "
     "på en fullvärdig bostad, med kök och badrum. En komplementbyggnad utan "
     "de kraven får användas som förråd, gäststuga, kontor eller bastu."),
    ("Finns det platser där reglerna inte gäller?",
     "Ja. Inom strandskyddat område krävs dispens även för en byggnad som "
     "annars är lovbefriad. I områden med särskilt kulturhistoriskt värde, "
     "inom vissa riksintressen och där detaljplanen säger annat krävs bygglov "
     "som vanligt. Kommunen avgör i det enskilda fallet."),
]

FAQ_LD = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": f,
         "acceptedAnswer": {"@type": "Answer", "text": s}}
        for f, s in FRAGOR
    ],
}


def faq_json():
    import json
    return json.dumps(FAQ_LD, ensure_ascii=False, indent=2)


# Ikonerna: 24x24, tunna linjer. pathLength=1 så att premium.js kan
# rita upp dem när korten kommer in (design.css 21).
IKON = {
    "stomme": "M2 19h20|M4 19l8-13 8 13|M8 19l4-6.5 4 6.5|M12 6v13",
    "brand": "M12 3l7 3v5c0 4.6-2.9 7.9-7 10-4.1-2.1-7-5.4-7-10V6z|"
             "M12 16.5c-1.6 0-2.8-1.1-2.8-2.6 0-1.4 1.1-2.2 1.7-3.4.8.7 1 1.5 1 2.1.5-.4.8-1 .9-1.7 1.2.9 2 2 2 3.1 0 1.4-1.2 2.5-2.8 2.5z",
    "eldstad": "M4 21h16|M6 21V10h12v11|M9 21v-5h6v5|M14 10V3h3v7|M8.5 13h7",
    "vvs": "M12 3.5c3.2 4 5 6.6 5 9.2a5 5 0 0 1-10 0c0-2.6 1.8-5.2 5-9.2z|M9.6 13.4a2.5 2.5 0 0 0 2.4 2.4",
    "grans": "M4 4v16|M20 4v16|M7 12h10|M9.5 9.5 7 12l2.5 2.5|M14.5 9.5 17 12l-2.5 2.5",
    "kultur": "M3 20h18|M5 17h14|M12 4l8 4.5H4z|M6.5 9v8|M10 9v8|M14 9v8|M17.5 9v8",
    "plan": "M6 3h8.5L19 7.5V21H6z|M14 3v5h5|M9 12.5h7|M9 16.5h5",
    "bostad": "M3 11.5 12 4l9 7.5|M5.5 9.8V20h13V9.8|M10 20v-5.5h4V20|M16 6.8V4h2.2v4.7",
    "bod": "M4 20V10.5L12 5l8 5.5V20z|M9 20v-5.5h6V20|M2.5 20h19",
    "ritning": "M4 20l1-4.2L16.3 4.5l3.2 3.2L8.2 19z|M14 6.8l3.2 3.2|M4 20h7",
    "du": "M12 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6z|M4.5 20.5c.6-3.9 3.7-6 7.5-6s6.9 2.1 7.5 6",
    "linjal": "M3 16.5 16.5 3 21 7.5 7.5 21z|M7 12.5l2 2|M10 9.5l2 2|M13 6.5l2 2",
    "bock": "M5 12.5l4.5 4.5L19 7.5",
    "pil": "M5 12h14|M13 6l6 6-6 6",
}


def ikon(namn, klass="rg-ikon"):
    return (f'<svg class="{klass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            + "".join(f'<path d="{d}" pathLength="1"/>' for d in IKON[namn].split("|"))
            + '</svg>')


def fragor_html():
    return "\n".join(f'''              <details class="rg-fraga">
                <summary><span class="rg-fraga__nr">0{i}</span><span class="rg-fraga__q">{f}</span><span class="rg-fraga__plus" aria-hidden="true"></span></summary>
                <div class="rg-fraga__svar"><p>{s}</p></div>
              </details>''' for i, (f, s) in enumerate(FRAGOR, 1))


# Genomskärningen i måttpanelen. Huset skalas på höjden runt marken
# (4,0 m -> 4,5 m = 1,125) när man växlar till utanför detaljplan;
# måttlinjen och skylten följer med. 44 px är en meter.
MATTBILD = '''<svg class="rg-rit" viewBox="64 50 552 306" role="img" aria-labelledby="rg-rit-titel">
                  <title id="rg-rit-titel">Genomskärning som visar nockhöjd och avstånd till tomtgräns</title>
                  <defs>
                    <pattern id="rg-rut" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0v22"/></pattern>
                    <pattern id="rg-jord" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v7"/></pattern>
                    <linearGradient id="rg-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1d8"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>
                    <linearGradient id="rg-vagg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b362e"/><stop offset="1" stop-color="#1f1c17"/></linearGradient>
                    <radialGradient id="rg-sken" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f0b56e" stop-opacity=".22"/><stop offset="1" stop-color="#f0b56e" stop-opacity="0"/></radialGradient>
                  </defs>
                  <rect class="rg-rit__rut" width="640" height="360" fill="url(#rg-rut)"/>
                  <ellipse cx="262" cy="236" rx="240" ry="130" fill="url(#rg-sken)"/>

                  <rect class="rg-rit__jord" x="24" y="296" width="592" height="16" fill="url(#rg-jord)"/>
                  <path class="rg-rit__mark" d="M24 296h592"/>

                  <g class="rg-rit__hus">
                    <path class="rg-rit__kropp" d="M160 296V190L260 120l100 70v106z" fill="url(#rg-vagg)"/>
                    <path class="rg-rit__tak" d="M146 200 260 118l114 82"/>
                    <path class="rg-rit__glas" d="M232 177 260 157l28 20z" fill="url(#rg-glas)"/>
                    <rect class="rg-rit__glas" x="182" y="222" width="36" height="48" rx="2" fill="url(#rg-glas)"/>
                    <rect class="rg-rit__glas" x="302" y="222" width="36" height="48" rx="2" fill="url(#rg-glas)"/>
                    <path class="rg-rit__dorr" d="M242 296v-60h36v60"/>
                  </g>

                  <g class="rg-rit__person">
                    <circle cx="420" cy="222" r="7"/>
                    <path d="M412.5 296v-52a7.5 7.5 0 0 1 15 0v52z"/>
                  </g>

                  <g class="rg-rit__hojd">
                    <path class="rg-rit__matt rg-rit__hojdlinje" d="M112 296V118"/>
                    <path class="rg-rit__matt" d="M100 296h24"/>
                    <g class="rg-rit__hojdtopp">
                      <path class="rg-rit__matt" d="M100 118h24"/>
                      <path class="rg-rit__hjalp" d="M128 118h124"/>
                    </g>
                    <g class="rg-rit__skylt rg-rit__skylt--hojd">
                      <rect x="76" y="194" width="72" height="28" rx="14"/>
                      <text x="112" y="212.5" text-anchor="middle" data-inom="4,0" data-utanfor="4,5" data-enhet=" m">4,0 m</text>
                    </g>
                  </g>

                  <path class="rg-rit__grans" d="M558 60v252"/>
                  <text class="rg-rit__etikett" x="578" y="176" text-anchor="middle" transform="rotate(-90 578 176)">Tomtgräns</text>

                  <path class="rg-rit__matt" d="M360 338H558M360 327v22M558 327v22"/>
                  <g class="rg-rit__skylt">
                    <rect x="423" y="324" width="72" height="28" rx="14"/>
                    <text x="459" y="342.5" text-anchor="middle">4,5 m</text>
                  </g>
                </svg>'''


def rubrik(nr, id_, text):
    return f'''          <section class="rg-del" id="{id_}">
            <header class="rg-del__topp">
              <span class="rg-del__nr" aria-hidden="true">{nr:02d}</span>
              <h2>{text}</h2>
            </header>'''


def matt_rad(namn, inom, utanfor, enhet, andel_inom, andel_utanfor, notis=""):
    n = f'\n                    <small>{notis}</small>' if notis else ""
    stapel = (f'\n                    <i class="rg-matt__stapel" aria-hidden="true"><b></b></i>'
              if andel_inom is not None else "")
    stil = (f' style="--inom:{andel_inom};--utanfor:{andel_utanfor}"'
            if andel_inom is not None else "")
    data = (f' data-inom="{inom}" data-utanfor="{utanfor}"' if inom != utanfor else "")
    return f'''                  <div class="rg-matt__rad"{stil}>
                    <dt>{namn}</dt>
                    <dd><b{data}>{inom}</b><small>{enhet}</small></dd>{stapel}{n}
                  </div>'''


SEKTIONER = [
    ("andringen", "Vad som ändrades", '''
            <p>
              Fram till 1 december 2025 krävde ett attefallshus en anmälan
              till kommunen och ett startbesked innan bygget fick börja. Både anmälningsplikten och startbeskedet är nu
              slopade för komplementbyggnader och komplementbostadshus. Orden
              attefallshus och friggebod är samtidigt borta ur lagtexten och
              ersatta av <em>komplementbyggnad</em> och
              <em>komplementbostadshus</em>.
            </p>

            <div class="rg-fore" data-rg-in>
              <div class="rg-fore__kol rg-fore__kol--fore">
                <p class="rg-fore__etikett">Före 1 december 2025</p>
                <ul>
                  <li><span>Anmälan till kommunen</span></li>
                  <li><span>Startbesked innan bygget fick börja</span></li>
                  <li><span>Attefallshus och friggebod i lagtexten</span></li>
                </ul>
              </div>
              <div class="rg-fore__skifte" aria-hidden="true">
                <span class="rg-fore__datum"><b>1 dec</b>2025</span>
              </div>
              <div class="rg-fore__kol rg-fore__kol--efter">
                <p class="rg-fore__etikett">Nu</p>
                <ul>
                  <li>''' + ikon("bock", "rg-bock") + '''<span>Ingen anmälan för själva byggnaden</span></li>
                  <li>''' + ikon("bock", "rg-bock") + '''<span>Inget startbesked</span></li>
                  <li>''' + ikon("bock", "rg-bock") + '''<span>Komplementbyggnad och komplementbostadshus</span></li>
                  <li>''' + ikon("bock", "rg-bock") + '''<span>Större utanför detaljplan än inom</span></li>
                </ul>
              </div>
            </div>

            <p>
              Vi använder ändå ordet attefallshus här, eftersom det är det ordet
              alla söker på och känner igen. Det är samma sorts hus som avses.
            </p>'''),

    ("matten", "Måtten", '''
            <p>
              Den stora nyheten är att gränsen skiljer sig åt beroende på om
              tomten ligger inom detaljplan eller inte. Måttet sammanlagt på
              tomten är en gemensam pott för alla lovfria komplementbyggnader
              på tomten, inte per hus.
            </p>

            <div class="rg-matt" data-plan="inom" data-rg-matt data-rg-in>
              <div class="rg-matt__panel">
                <div class="rg-matt__topp">
                  <p class="rg-matt__etikett">Var ligger tomten?</p>
                  <div class="rg-vaxel" role="group" aria-label="Var ligger tomten?">
                    <span class="rg-vaxel__pill" aria-hidden="true"></span>
                    <button type="button" aria-pressed="true" data-plan="inom">Inom detaljplan</button>
                    <button type="button" aria-pressed="false" data-plan="utanfor">Utanför detaljplan</button>
                  </div>
                </div>

                <div class="rg-matt__yta">
                  <figure class="rg-matt__bild">
                    ''' + MATTBILD + '''
                    <figcaption>
                      Höjden mäts från marken till taknock. Avståndet mäts till
                      närmaste tomtgräns.
                    </figcaption>
                  </figure>

                  <dl class="rg-matt__tal">
''' + "\n".join([
        matt_rad("Per byggnad", "30", "50", "m²", 0.46, 0.77),
        matt_rad("Sammanlagt på tomten", "45", "65", "m²", 0.69, 1),
        matt_rad("Nockhöjd", "4,0", "4,5", "m", 0.89, 1),
        matt_rad("Till tomtgräns", "4,5", "4,5", "m", None, None,
                 "eller närmare med grannens skriftliga medgivande"),
    ]) + '''
                  </dl>
                </div>
              </div>

              <div class="rg-tabell">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Mått</th>
                      <th scope="col" data-kol="inom">Inom detaljplan</th>
                      <th scope="col" data-kol="utanfor">Utanför detaljplan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Per byggnad</th>
                      <td data-kol="inom">30 m²</td>
                      <td data-kol="utanfor">50 m²</td>
                    </tr>
                    <tr>
                      <th scope="row">Sammanlagt på tomten</th>
                      <td data-kol="inom">45 m²</td>
                      <td data-kol="utanfor">65 m²</td>
                    </tr>
                    <tr>
                      <th scope="row">Nockhöjd</th>
                      <td data-kol="inom">4,0 m</td>
                      <td data-kol="utanfor">4,5 m</td>
                    </tr>
                    <tr>
                      <th scope="row">Till tomtgräns</th>
                      <td colspan="2">4,5 m, eller närmare med grannens skriftliga medgivande</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>'''),

    ("anmalan", "När det ändå krävs en anmälan", '''
            <p>
              Anmälningsplikten är borta för byggnaden, men inte för det som
              händer inuti den. Anmälan krävs fortfarande om åtgärden:
            </p>

            <ul class="rg-anmalan">
              <li class="rg-anmalan__kort" data-rg-in>''' + ikon("stomme") + '''<h3>Bärande konstruktion</h3><p>Berör den bärande konstruktionen.</p></li>
              <li class="rg-anmalan__kort" data-rg-in>''' + ikon("brand") + '''<h3>Brandskydd</h3><p>Påverkar brandskyddet väsentligt.</p></li>
              <li class="rg-anmalan__kort" data-rg-in>''' + ikon("eldstad") + '''<h3>Eldstad eller rökkanal</h3><p>Innehåller eldstad eller rökkanal.</p></li>
              <li class="rg-anmalan__kort" data-rg-in>''' + ikon("vvs") + '''<h3>Vatten, avlopp, ventilation</h3><p>Berör installationer för vatten, avlopp eller ventilation.</p></li>
            </ul>

            <figure class="rg-citat" data-rg-in>
              <blockquote>
                <p>
                  Ett hus med kök och badrum har per definition vatten och avlopp.
                  Därför måste de flesta hus man ska bo i ändå anmälas till
                  kommunen – för installationerna, inte för byggnaden.
                </p>
              </blockquote>
              <div class="rg-citat__delat">
                <p class="rg-citat__rad rg-citat__rad--fri"><span>Själva byggnaden</span><b>Ingen anmälan</b></p>
                <p class="rg-citat__rad"><span>Installationerna</span><b>Anmälan till kommunen</b></p>
              </div>
            </figure>'''),

    ("bygglov", "När det krävs bygglov som vanligt", '''
            <ol class="rg-lov">
              <li class="rg-lov__rad" data-rg-in>''' + ikon("grans") + '''<div><h3>Närmare tomtgränsen</h3><p>Om huset placeras närmare tomtgränsen än 4,5 meter utan att grannen har gett sitt medgivande.</p></div></li>
              <li class="rg-lov__rad" data-rg-in>''' + ikon("kultur") + '''<div><h3>Kulturvärden och riksintressen</h3><p>I områden med särskilt kulturhistoriskt värde och inom vissa riksintressen.</p></div></li>
              <li class="rg-lov__rad" data-rg-in>''' + ikon("plan") + '''<div><h3>Detaljplanen säger annat</h3><p>Om detaljplanen för området säger att bygglov krävs.</p></div></li>
            </ol>

            <aside class="rg-vatten" data-rg-in>
              <svg class="rg-vatten__vag" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M0 30c50 0 50-14 100-14s50 14 100 14 50-14 100-14 50 14 100 14 50-14 100-14 50 14 100 14 50-14 100-14 50 14 100 14 50-14 100-14 50 14 100 14 50-14 100-14 50 14 100 14v30H0z"/>
                <path d="M0 40c50 0 50-10 100-10s50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10 50-10 100-10 50 10 100 10v20H0z"/>
              </svg>
              <p class="rg-vatten__etikett">Nära vatten</p>
              <h3 class="rg-vatten__titel">Strandskyddet påverkas inte av ändringen</h3>
              <p>
                Inom strandskyddat område krävs strandskyddsdispens även för en
                byggnad som annars är lovbefriad. Det är en egen prövning hos
                kommunen eller länsstyrelsen.
              </p>
            </aside>'''),

    ("skillnaden", "Komplementbyggnad eller komplementbostadshus?", '''
            <p class="rg-ingress">
              Skillnaden ligger i vad huset ska vara, inte i hur stort det får
              vara.
            </p>

            <div class="rg-vs">
              <div class="rg-vs__kort rg-vs__kort--bo" data-rg-in>
                ''' + ikon("bostad") + '''
                <p class="rg-vs__typ">Komplementbostadshus</p>
                <h3>En fullvärdig bostad</h3>
                <ul class="rg-vs__lista">
                  <li>Kök och badrum</li>
                  <li>Går att bo i året om</li>
                </ul>
              </div>
              <span class="rg-vs__eller" aria-hidden="true">eller</span>
              <div class="rg-vs__kort" data-rg-in>
                ''' + ikon("bod") + '''
                <p class="rg-vs__typ">Komplementbyggnad</p>
                <h3>Utan bostadskraven</h3>
                <ul class="rg-vs__lista rg-vs__lista--chips">
                  <li>Gäststuga</li>
                  <li>Kontor</li>
                  <li>Förråd</li>
                  <li>Bastu</li>
                </ul>
              </div>
              <p class="rg-vs__samma">''' + ikon("linjal") + '''Måtten och avstånden är desamma.</p>
            </div>'''),

    ("fragor", "Vanliga frågor", '''
            <div class="rg-fragor">
''' + fragor_html() + '''
            </div>'''),

    ("vemgorvad", "Vem gör vad", '''
            <div class="rg-roller">
              <div class="rg-roll rg-roll--vi" data-rg-in>
                ''' + ikon("ritning") + '''
                <p class="rg-roll__vem">Vi</p>
                <p>Tar fram ritningar och underlag och säger vad som gäller för just din tomt.</p>
              </div>
              <div class="rg-roll" data-rg-in>
                ''' + ikon("du") + '''
                <p class="rg-roll__vem">Du</p>
                <p>Är byggherre och står för kontakten med kommunen när något ska anmälas.</p>
              </div>
            </div>

            <p>
              Hela ordningen, steg för steg, finns på
              <a href="sa-fungerar-det.html">Så fungerar det</a>.
            </p>

            <p class="rg-kallor">
              ''' + ikon("bock", "rg-kallor__ikon") + '''
              <span>
                Uppgifterna är kontrollerade den 8 september 2026 mot kommunala och
                branschgemensamma sammanställningar av regeländringen. Reglerna kan
                ändras och kommunen avgör i det enskilda fallet. Stäm alltid av med
                din byggnadsnämnd innan du börjar bygga.
              </span>
            </p>'''),
]


def innehallsforteckning():
    return "\n".join(
        f'                <li><a href="#{id_}"><span class="rg-toc__nr">{i:02d}</span>{rubrik_}</a></li>'
        for i, (id_, rubrik_, _) in enumerate(SEKTIONER, 1))


def sektioner_html():
    return "\n\n".join(
        rubrik(i, id_, text) + kropp + "\n          </section>"
        for i, (id_, text, kropp) in enumerate(SEKTIONER, 1))


VIDARE = [
    ("Se våra attefallshus", "Modellerna, storlekarna och vad de innehåller.",
     "attefallshus.html", "vidare-hus.webp"),
    ("Vad ett hus kostar", "Vad som ingår, vad som tillkommer och vad som styr priset.",
     "priser.html", "vidare-pris.webp"),
    ("Så fungerar det", "Sju steg från första samtalet till slutbesiktning.",
     "sa-fungerar-det.html", "vidare-steg.webp"),
]


def vidare_html():
    return "\n".join(f'''              <a class="rg-vidare__kort" href="{lank}" data-rg-in>
                <span class="rg-vidare__bild"><img src="images/tumme/{bild}" width="640" height="420" alt="" loading="lazy" decoding="async"></span>
                <span class="rg-vidare__kropp">
                  <span class="rg-vidare__titel">{titel}</span>
                  <span class="rg-vidare__text">{text}</span>
                </span>
                {ikon("pil", "rg-vidare__pil")}
              </a>''' for titel, text, lank, bild in VIDARE)


GUIDE = f'''    <main id="innehall">
      <section class="guidehero rg-topp">
        <div class="rg-topp__inre">
          <div class="rg-topp__ord">
            <p class="section-label">Guide</p>
            <h1 class="guidehero__titel rg-topp__titel">Attefallshus: vad som gäller efter&nbsp;regeländringen</h1>
            <p class="rg-topp__lead">
              Den 1 december 2025 skrevs reglerna om. Begreppen attefallshus och
              friggebod finns inte längre i lagen, anmälningsplikten för själva
              byggnaden är borta, och du får bygga större utanför detaljplan än
              inom. Här är vad det betyder i praktiken.
            </p>
            <p class="rg-topp__meta">
              <span>Uppdaterad 8 september 2026</span>
              <span>4 minuters läsning</span>
            </p>
          </div>

          <figure class="rg-topp__bild">
            <span class="rg-topp__ram"><img src="images/hus-r1.webp" width="1600" height="1062" loading="eager" decoding="async" alt="Svart attefallshus på en klippa vid vatten"></span>
            <svg class="rg-stampel" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
              <defs><path id="rg-stampel-ring" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>
              <circle cx="60" cy="60" r="58"/>
              <text><textPath href="#rg-stampel-ring" textLength="268" lengthAdjust="spacing">NYA REGLER · 1 DECEMBER 2025 ·</textPath></text>
              <path class="rg-stampel__hus" d="M47 70V56l13-10 13 10v14z"/>
            </svg>
          </figure>
        </div>
      </section>

      <section class="rg-kort" aria-label="Kort svar">
        <div class="rg-kort__inre">
          <div class="rg-kort__svar">
            <p class="rg-kort__etikett"><i aria-hidden="true"></i>Kort svar</p>
            <p class="rg-kort__text">
              Inom måtten behövs varken bygglov eller anmälan för byggnaden.
              Ska den ha vatten, avlopp, ventilation eller eldstad krävs ändå
              anmälan för installationerna, och det gör nästan alla hus man
              ska kunna bo i.
            </p>
            <a class="rg-kort__lank" href="vad-far-jag-bygga.html">Räkna på din tomt{ikon("pil", "rg-kort__pil")}</a>
          </div>
          <ul class="rg-kort__tal">
            <li><p><b data-rg-rakna="30">30</b><small>m²</small></p><span>per byggnad inom detaljplan</span></li>
            <li><p><b data-rg-rakna="50">50</b><small>m²</small></p><span>per byggnad utanför detaljplan</span></li>
            <li><p><b data-rg-rakna="4,0">4,0</b><small>m</small></p><span>nockhöjd inom detaljplan</span></li>
            <li><p><b data-rg-rakna="4,5">4,5</b><small>m</small></p><span>minst, till tomtgränsen</span></li>
          </ul>
        </div>
      </section>

      <section class="rg">
        <div class="rg__inre">
          <aside class="rg__rail">
            <nav class="rg-toc" aria-label="Innehåll på sidan">
              <p class="rg-toc__etikett">På den här sidan</p>
              <div class="rg-toc__lista">
                <span class="rg-toc__spar" aria-hidden="true"><i class="rg-toc__fyll"></i></span>
                <span class="rg-toc__markor" aria-hidden="true"></span>
                <ol>
{innehallsforteckning()}
                </ol>
              </div>
            </nav>
            <a class="rg__prova" href="vad-far-jag-bygga.html">
              <span>Vad får du bygga på din tomt?</span>
              <b>Räkna på din tomt{ikon("pil", "rg__prova-pil")}</b>
            </a>
          </aside>

          <div class="rg__text">
{sektioner_html()}

            <nav class="rg-vidare" aria-label="Vidare härifrån">
              <p class="rg-vidare__etikett">Vidare härifrån</p>
              <div class="rg-vidare__rad">
{vidare_html()}
              </div>
            </nav>
          </div>
        </div>
      </section>

      <section class="rg-slut">
        <div class="rg-slut__inre">
          <p class="section-label section-label--accent">Nästa steg</p>
          <h2 class="rg-slut__titel">Vad får du bygga på din tomt?</h2>
          <p class="rg-slut__text">
            Svara på fem frågor om tomten, så räknar vi ut hur stort
            attefallshus som ryms, hur högt det får bli och vad du behöver
            prata med kommunen om.
          </p>
          <p class="rg-slut__knappar">
            <a class="knapp-fylld" href="vad-far-jag-bygga.html">Räkna på din tomt</a>
            <a class="rg-slut__linje" href="kontakt.html">Begär offert</a>
          </p>
        </div>
      </section>
    </main>

'''

# Innehållsförteckningen, måtten och talen sköts av premium.js
# ("Regelsidan"). Tomt här, men namnet finns kvar för _sidor3.py.
TOC_SKRIPT = ''
