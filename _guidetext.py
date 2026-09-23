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
     "Nej, inte inom måtten nedan. Sedan 1 december 2025 krävs varken bygglov "
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


def fragor_html():
    return "\n".join(f'''              <details class="fraga">
                <summary><span>{f}</span><span class="fraga__pil" aria-hidden="true"></span></summary>
                <p>{s}</p>
              </details>''' for f, s in FRAGOR)


# Måttbilden. Samma linjespråk som planritningen på huskortet: tunna
# svarta linjer för det byggda, varmgrått för måtten.
MATTBILD = '''<svg viewBox="0 0 660 320" role="img" aria-labelledby="mattbild-titel">
              <title id="mattbild-titel">Genomskärning som visar nockhöjd och avstånd till tomtgräns</title>

              <!-- Mark -->
              <path class="mb-mark" d="M30 262h600"/>

              <!-- Huset -->
              <path class="mb-hus" d="M150 262V166l120-72 120 72v96"/>
              <path class="mb-hus" d="M240 262v-56h60v56"/>
              <path class="mb-tunn" d="M186 200h34v30h-34zM320 200h34v30h-34z"/>

              <!-- Nockhöjd -->
              <path class="mb-matt" d="M110 94v168M100 94h20M100 262h20"/>
              <text class="mb-text" x="98" y="178" text-anchor="middle" transform="rotate(-90 98 178)">4,0 m nockhöjd</text>

              <!-- Tomtgräns -->
              <path class="mb-grans" d="M580 74v208"/>
              <text class="mb-text mb-text--grans" x="600" y="178" text-anchor="middle" transform="rotate(-90 600 178)">Tomtgräns</text>

              <!-- Avstånd -->
              <path class="mb-matt" d="M390 292h190M390 282v20M580 282v20"/>
              <text class="mb-text" x="485" y="276" text-anchor="middle">4,5 m</text>
            </svg>'''


SEKTIONER = [
    ("andringen", "Vad som ändrades", '''
            <p>
              Fram till december 2025 var ordningen den att ett attefallshus
              krävde en anmälan till kommunen och ett startbesked innan bygget
              fick börja. Både anmälningsplikten och startbeskedet är nu
              slopade för komplementbyggnader och komplementbostadshus. Orden
              attefallshus och friggebod är samtidigt borta ur lagtexten och
              ersatta av <em>komplementbyggnad</em> och
              <em>komplementbostadshus</em>.
            </p>
            <p>
              Vi använder ändå ordet attefallshus här, eftersom det är det ordet
              alla söker på och känner igen. Det är samma sorts hus som avses.
            </p>'''),

    ("matten", "Måtten", '''
            <p>
              Den stora nyheten är att gränsen skiljer sig åt beroende på om
              tomten ligger inom detaljplan eller inte. Sammanlagt-kolumnen är
              en gemensam pott för alla lovfria komplementbyggnader på tomten,
              inte per hus.
            </p>

            <figure class="mattbild">
              ''' + MATTBILD + '''
              <figcaption>
                Höjden mäts från marken till taknock. Avståndet mäts till
                närmaste tomtgräns.
              </figcaption>
            </figure>

            <div class="matt">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Mått</th>
                    <th scope="col">Inom detaljplan</th>
                    <th scope="col">Utanför detaljplan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Per byggnad</th>
                    <td>30 m²</td>
                    <td>50 m²</td>
                  </tr>
                  <tr>
                    <th scope="row">Sammanlagt på tomten</th>
                    <td>45 m²</td>
                    <td>65 m²</td>
                  </tr>
                  <tr>
                    <th scope="row">Nockhöjd</th>
                    <td>4,0 m</td>
                    <td>4,5 m</td>
                  </tr>
                  <tr>
                    <th scope="row">Till tomtgräns</th>
                    <td colspan="2">4,5 m, eller närmare med grannens skriftliga medgivande</td>
                  </tr>
                </tbody>
              </table>
            </div>'''),

    ("anmalan", "När det ändå krävs en anmälan", '''
            <p>
              Anmälningsplikten är borta för byggnaden, men inte för det som
              händer inuti den. Anmälan krävs fortfarande om åtgärden berör den
              bärande konstruktionen, påverkar brandskyddet väsentligt,
              innehåller eldstad eller rökkanal, eller berör installationer för
              vatten, avlopp eller ventilation.
            </p>

            <blockquote class="citat">
              Ett hus med kök och badrum har per definition vatten och avlopp.
              I praktiken passerar de flesta hus man ska kunna bo i alltså ändå
              kommunen, men för installationerna och inte för byggnaden.
            </blockquote>'''),

    ("bygglov", "När det krävs bygglov som vanligt", '''
            <ul class="guide__lista">
              <li>Om huset placeras närmare tomtgränsen än 4,5 meter utan att grannen har gett sitt medgivande.</li>
              <li>I områden med särskilt kulturhistoriskt värde och inom vissa riksintressen.</li>
              <li>Om detaljplanen för området säger att bygglov krävs.</li>
            </ul>

            <aside class="obs">
              <p class="obs__etikett">Nära vatten</p>
              <p>
                Inom strandskyddat område krävs strandskyddsdispens även för en
                byggnad som annars är lovbefriad. Strandskyddet påverkas inte av
                regeländringen, och det är en egen prövning hos kommunen eller
                länsstyrelsen.
              </p>
            </aside>'''),

    ("skillnaden", "Komplementbyggnad eller komplementbostadshus?", '''
            <p>
              Skillnaden ligger i vad huset ska vara, inte i hur stort det får
              vara. Ett <strong>komplementbostadshus</strong> är en fullvärdig
              bostad med kök och badrum, och får bos i året om. En
              <strong>komplementbyggnad</strong> saknar de kraven och används
              som gäststuga, kontor, förråd eller bastu. Måtten och avstånden är
              desamma.
            </p>'''),

    ("fragor", "Vanliga frågor", '''
            <div class="fragor">
''' + fragor_html() + '''
            </div>'''),

    ("vemgorvad", "Vem gör vad", '''
            <p>
              Vi tar fram ritningar och underlag och säger vad som gäller för
              just din tomt. Det är du som är byggherre och som står för
              kontakten med kommunen när något ska anmälas. Hela ordningen, steg
              för steg, finns på <a href="sa-fungerar-det.html">Så fungerar det</a>.
            </p>

            <p class="guide__kallor">
              Uppgifterna är kontrollerade den 8 september 2026 mot kommunala och
              branschgemensamma sammanställningar av regeländringen. Reglerna kan
              ändras och kommunen avgör i det enskilda fallet. Stäm alltid av med
              din byggnadsnämnd innan du börjar bygga.
            </p>'''),
]


def innehallsforteckning():
    return "\n".join(
        f'                <li><a href="#{id_}">{rubrik}</a></li>'
        for id_, rubrik, _ in SEKTIONER)


def sektioner_html():
    return "\n\n".join(
        f'''          <section class="guide__sektion" id="{id_}">
            <h2>{rubrik}</h2>{kropp}
          </section>''' for id_, rubrik, kropp in SEKTIONER)


VIDARE = [
    ("Se våra attefallshus", "Modellerna, storlekarna och vad de innehåller.", "attefallshus.html"),
    ("Vad ett hus kostar", "Vad som ingår, vad som tillkommer och vad som styr priset.", "priser.html"),
    ("Så fungerar det", "Sju steg från första samtalet till slutbesiktning.", "sa-fungerar-det.html"),
]


def vidare_html():
    return "\n".join(f'''            <a class="vidarekort" href="{lank}">
              <span class="vidarekort__titel">{titel}</span>
              <span class="vidarekort__text">{text}</span>
            </a>''' for titel, text, lank in VIDARE)


GUIDE = f'''    <main id="innehall">
      <section class="guidehero">
        <div class="guidehero__inner">
          <div class="guidehero__ord">
            <p class="section-label">Guide</p>
            <h1 class="guidehero__titel">Attefallshus: vad som gäller efter&nbsp;regeländringen</h1>
            <p class="guidehero__lead">
              Den 1 december 2025 skrevs reglerna om. Begreppen attefallshus och
              friggebod finns inte längre i lagen, anmälningsplikten för själva
              byggnaden är borta, och du får bygga större utanför detaljplan än
              inom. Här är vad det betyder i praktiken.
            </p>
            <p class="guidehero__meta">
              <span>Uppdaterad 8 september 2026</span>
              <span>4 minuters läsning</span>
            </p>
          </div>

          <figure class="guidehero__bild">
            <img src="images/generated-category-attefallshus-02.webp" width="780" height="1170" loading="eager" decoding="async" alt="Attefallshus med mörk träfasad på en klippa vid vatten">
          </figure>
        </div>
      </section>

      <section class="guide">
        <div class="guide__inner">
          <aside class="guide__rail">
            <div class="guide__snabbsvar">
              <p class="guide__snabbsvar-etikett">Kort svar</p>
              <p>
                Inom måtten behövs varken bygglov eller anmälan för byggnaden.
                Ska den ha vatten, avlopp, ventilation eller eldstad krävs ändå
                anmälan för installationerna, och det gör nästan alla hus man
                ska kunna bo i.
              </p>
              <a class="guide__prova" href="vad-far-jag-bygga.html">Räkna på din tomt</a>
            </div>

            <nav class="guide__toc" aria-label="Innehåll på sidan">
              <p class="guide__toc-etikett">På den här sidan</p>
              <ol>
{innehallsforteckning()}
              </ol>
            </nav>
          </aside>

          <div class="guide__text">
{sektioner_html()}

            <div class="vidare">
              <p class="vidare__etikett">Vidare härifrån</p>
              <div class="vidare__kort">
{vidare_html()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

'''

# Markerar vilken rubrik man laser, i innehallsforteckningen.
# OBS: B.skript(extra) klistrar in det har INUTI en redan oppen
# script-tagg. Ingen egen <script> har, da stangs den yttre for
# tidigt och resten av sidan hamnar utanfor.
TOC_SKRIPT = '''      // Innehallsforteckningen markerar det avsnitt man ar i. Observatoren
      // tittar pa ett smalt band mitt i vyn, sa markeringen byter nar
      // rubriken passerar mitten - inte nar den nuddar kanten.
      (function () {
        var lankar = document.querySelectorAll('.guide__toc a');
        if (!lankar.length || !window.IntersectionObserver) return;

        var karta = {};
        Array.prototype.forEach.call(lankar, function (a) {
          karta[a.getAttribute('href').slice(1)] = a;
        });

        var obs = new IntersectionObserver(function (poster) {
          poster.forEach(function (p) {
            var a = karta[p.target.id];
            if (a) a.classList.toggle('guide__toc--i', p.isIntersecting);
          });
        }, { rootMargin: '-45% 0px -45% 0px' });

        document.querySelectorAll('.guide__sektion').forEach(function (s) {
          obs.observe(s);
        });
      })();
'''
