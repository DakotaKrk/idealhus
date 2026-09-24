# -*- coding: utf-8 -*-
# Bygger integritetspolicyn och attefallsguiden. Kor: python _sidor3.py
#
# Reglerna i guiden ar kontrollerade 2026-09-08 mot Nykopings kommun och
# Bygglov24, som bada beskriver andringen som tradde i kraft 1 december
# 2025: den sarskilda anmalningsplikten och startbeskedet for
# komplementbyggnader och komplementbostadshus ar slopade, och areorna
# skiljer sig nu inom och utanfor detaljplan. Skriv inte om siffrorna
# har utan att kontrollera dem igen - de andras.
import io

import _bygg as B

from _guidetext import GUIDE, TOC_SKRIPT, faq_json  # noqa: E402

POLICY = '''    <main id="innehall">
      <section class="guide-topp">
        <div class="guide-topp__inner">
          <p class="section-label">Uppdaterad 24 september 2026</p>
          <h1 class="guide-topp__titel">Integritetspolicy</h1>
          <p class="guide-topp__lead">
            Här står vad som händer med uppgifterna du lämnar när du hör av
            dig till oss. Kort sagt: de går direkt till oss, de lagras inte
            på webbplatsen, och vi lämnar dem inte vidare.
          </p>
        </div>
      </section>

      <section class="guide">
        <div class="guide__inner">
          <aside class="guide__snabbsvar">
            <p class="guide__snabbsvar-etikett">Kort svar</p>
            <p>
              Webbplatsen sätter inga kakor och samlar ingen statistik.
              Kontaktformuläret skickas med ditt eget e-postprogram, så
              uppgifterna passerar aldrig någon tredje part.
            </p>
          </aside>

          <div class="guide__text">
            <h2>Vem som ansvarar</h2>
            <p>
              Idealhus AB, organisationsnummer 559123-4567, Stockholm, är
              personuppgiftsansvarig för behandlingen som beskrivs här. Du når
              oss på <a href="mailto:ahmed@idealhus.se">ahmed@idealhus.se</a>
              eller <a href="mailto:sahand@idealhus.se">sahand@idealhus.se</a>.
            </p>

            <h2>Vilka uppgifter vi behandlar</h2>
            <p>
              Om du fyller i kontaktformuläret lämnar du namn, e-postadress
              och, om du vill, telefonnummer, ort, vilken husmodell du är
              intresserad av och det du skriver i meddelandet. Vi behandlar
              bara det du själv skriver.
            </p>

            <h2>Hur formuläret fungerar</h2>
            <p>
              Formuläret skickas inte via någon formulärtjänst. När du trycker
              på skicka öppnas ditt eget e-postprogram med meddelandet ifyllt,
              och du skickar det som ett vanligt mejl. Uppgifterna sparas
              alltså inte på webbplatsen och passerar ingen tredje part på
              vägen. De hamnar i vår inkorg, hos vår e-postleverantör.
            </p>

            <h2>Varför vi behandlar dem</h2>
            <p>
              För att kunna svara på din fråga och lämna offert. Den lagliga
              grunden är vårt berättigade intresse av att besvara den som
              kontaktar oss, och ditt samtycke när du kryssar i rutan i
              formuläret. Du kan när som helst höra av dig och be oss sluta.
            </p>

            <h2>Hur länge vi sparar dem</h2>
            <p>
              Förfrågningar sparas i 12 månader efter senaste kontakten,
              och därefter raderas de. Blir det ett avtal sparas de uppgifter
              som hör till affären så länge bokförings- och garantiregler
              kräver det.
            </p>

            <h2>Vilka som kan se uppgifterna</h2>
            <p>
              Vi lämnar inte ut uppgifter till någon annan för deras egna
              ändamål, och vi säljer dem inte vidare. Vår e-postleverantör
              behandlar dem åt oss som personuppgiftsbiträde.
            </p>

            <h2>Kakor och statistik</h2>
            <p>
              Webbplatsen använder inga kakor och har inget verktyg för
              besöksstatistik. Därför finns här inte heller någon ruta om
              kakor att klicka bort.
            </p>
            <p>
              Däremot kommer webbplatsen ihåg tre val i din webbläsare (i
              så kallad localStorage), så att du slipper göra om dem: om du
              valt ljust eller mörkt läge, om du valt "Jag bygger åt andra"
              på startsidan och när du senast stängde tipsrutan. De stannar i
              din webbläsare, skickas aldrig till oss och försvinner om du
              rensar webbplatsdata.
            </p>

            <h2>Uppgifter som lämnar din webbläsare ändå</h2>
            <p>
              Några saker sker automatiskt eller när du själv använder en
              funktion, och dem vill vi att du ska känna till:
            </p>
            <ul class="guide__lista">
              <li>Webbplatsen ligger hos GitHub Pages. Din IP-adress syns i
                deras loggar, som alla webbservrar har.</li>
              <li>Typsnitten hämtas från Google Fonts, vilket innebär att din
                IP-adress skickas till Google när sidan laddas.</li>
              <li>Trycker du på "Se huset på din tomt" på en Android-telefon
                öppnas Googles AR-visare, som hämtar husets 3D-modell från
                sajten. På iPhone sker det i telefonen utan någon tredje part.
                3D-visningen i webbläsaren använder ingen extern tjänst.</li>
              <li>Söker du på en adress under "Kolla din mark" på sidan
                Vad får jag bygga? skickas adressen till OpenStreetMap
                Foundations söktjänst Nominatim, som svarar med en punkt på
                kartan. Kartbilderna hämtas från OpenStreetMap, och punkten
                skickas till Sveriges geologiska undersökning (SGU) för att
                hämta uppgifterna om marken. Trycker du på "Använd min
                position" frågar webbläsaren dig först, och positionen går
                samma väg. Ingenting av detta sparas på webbplatsen, och vi
                ser aldrig adressen.</li>
            </ul>

            <h2>Dina rättigheter</h2>
            <p>
              Du har rätt att få veta vilka uppgifter vi har om dig, att få dem
              rättade eller raderade, att invända mot behandlingen och att
              begära att den begränsas. Hör av dig till någon av adresserna
              ovan, så ordnar vi det. Är du inte nöjd med hur vi hanterar
              saken kan du vända dig till Integritetsskyddsmyndigheten, IMY.
            </p>
          </div>
        </div>
      </section>
    </main>

'''



# ---------------------------------------------------------------------------
# Prissidan. FYLL I HÄR när priserna är satta - inget annat på sidan behöver
# röras. Skriv hela strängen, till exempel "Från 450 000 kr".
# ---------------------------------------------------------------------------
import _modeller as M  # noqa: E402

# Priset per kategori. Storleken räknas ur modellerna, så den kan inte
# glida isär från korten. Skriv hela prissträngen, t.ex. "Från 450 000 kr".
PRISER = [
    ("Attefallshus", "attefallshus.html", "Från X kr"),
    ("Fritidshus", "fritidshus.html", "Från X kr"),
    ("Fjällstugor", "fjallstugor.html", "Från X kr"),
    ("Villor", "villor.html", "Från X kr"),
]

# Vad som krävs, sagt utan belopp. Attefallshus inom måtten är lovfria;
# övriga kategorier kräver bygglov (se guiden och kategorisidorna).
LOV = {
    "Attefallshus": "Inget bygglov inom måtten",
    "Fritidshus": "Kräver bygglov",
    "Fjällstugor": "Kräver bygglov",
    "Villor": "Kräver bygglov",
}

INGAR = [
    ("Ritningar och underlag", "Det vi tar fram för att du ska kunna anmäla eller söka lov.",
     "M5 3.5h9.5L19 8v12.5H5zM14.5 3.5V8H19M8.5 12.5h7M8.5 16h5"),
    ("Själva huset", "Tillverkat i Sverige, under tak, med de material och den nivå ni kommit överens om.",
     "M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5"),
    ("Leverans till tomten", "Transport och lyft på plats, när framkomligheten är löst.",
     "M3 17h13l3-4h2v4M5 17v2M17 17v2M3 13h11V7H3z"),
    ("Montage", "Huset monteras av oss när det kommit fram.",
     "M14.5 5.5l4 4-9 9H5.5v-4zM12.5 7.5l4 4"),
    ("Slutbesiktning", "Genomgång av huset, punktlista och överlämning.",
     "M9 12.5l2 2 4-4.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"),
]

# Posterna som tillkommer. Varje post har en nyckel som kostnadskartan
# använder för att säga "räkna med" eller "troligen liten" utifrån svaren.
TILLKOMMER = [
    ("grund", "Grunden", "Platta eller plintar ska vara gjuten innan huset kommer. Vad den kostar beror på marken."),
    ("va", "El, vatten och avlopp", "Framdragning till huset, och anslutningsavgifter till kommunen eller föreningen."),
    ("mark", "Markarbete", "Röjning, schakt och infart om det behövs för att lastbil och kran ska komma fram."),
    ("avgift", "Kommunens avgifter", "Avgift för anmälan eller bygglov, och för eventuell strandskyddsdispens."),
    ("tillval", "Tillval", "Ändringar i planlösning, ytskikt och inredning utöver det som ingår."),
]

STYR = [
    ("Storleken", "Den enskilt största posten. Priset per kvadratmeter sjunker något med större hus, men totalen stiger."),
    ("Planlösningen", "Fler väggar, fler våtrum och fler öppningar kostar mer än en öppen yta."),
    ("Nivån på material", "Kök, badrum och ytskikt är där spannet mellan lägsta och högsta nivå är störst."),
    ("Tomten", "Lutning, mark och framkomlighet för lastbil och kranbil avgör både grund och montage."),
    ("Avståndet", "Transporten är en verklig kostnad, och den växer med milen."),
]


def _kategori(namn, lank, pris):
    lista = M.modeller(lank)
    ytor = [m[2] for m in lista]
    bild = B.KATEGORI_INFO[namn][0]
    spann = f"{min(ytor)}–{max(ytor)} m²"
    return (namn, lank, pris, bild, min(ytor), max(ytor), spann, len(lista))


KATEGORIER_PRIS = [_kategori(*p) for p in PRISER]


def priskort():
    return "\n".join(f"""          <article class="priskort" data-min="{lo}" data-max="{hi}" data-namn="{namn}">
            <span class="priskort__passar" aria-hidden="true">Passar dig</span>
            <a class="priskort__bild" href="{lank}"><img src="images/{bild}" alt="" loading="lazy" decoding="async"></a>
            <div class="priskort__kropp">
              <h3 class="priskort__namn"><a href="{lank}">{namn}</a></h3>
              <p class="priskort__spann">{spann} · {antal} modeller</p>
              <p class="priskort__pris">{pris}</p>
              <p class="priskort__lov">{LOV[namn]}</p>
              <a class="priskort__lank" href="{lank}">Se modellerna</a>
            </div>
          </article>""" for namn, lank, pris, bild, lo, hi, spann, antal in KATEGORIER_PRIS)


def ingar_html():
    return "\n".join(f"""            <li>
              <span class="ingar__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{d}"/></svg></span>
              <span><strong>{a}</strong>{b}</span>
            </li>""" for a, b, d in INGAR)


def tillkommer_html():
    return "\n".join(f"""            <li class="post" data-post="{k}">
              <span class="post__status" data-status>Räkna med</span>
              <strong>{a}</strong>
              <span class="post__text">{b}</span>
              <span class="post__svar" data-svar></span>
            </li>""" for k, a, b in TILLKOMMER)


def styr_html():
    return "\n".join(f"""          <article class="styrkort">
            <span class="styrkort__nr">0{i}</span>
            <h3>{a}</h3>
            <p>{b}</p>
          </article>""" for i, (a, b) in enumerate(STYR, 1))


def kartfraga(namn, fraga, val):
    knappar = "\n".join(
        f'                <label class="kartval"><input type="radio" name="{namn}" value="{v}"{" checked" if i == 0 else ""}><span>{t}</span></label>'
        for i, (v, t) in enumerate(val))
    return f"""            <fieldset class="kartfraga">
              <legend>{fraga}</legend>
              <div class="kartfraga__rad">
{knappar}
              </div>
            </fieldset>"""


KARTFRAGOR = "\n".join([
    kartfraga("va", "Finns vatten och avlopp framdraget till tomten?",
              [("ja", "Ja"), ("nej", "Nej"), ("vetej", "Vet inte")]),
    kartfraga("lutning", "Hur ser marken ut där huset ska stå?",
              [("plan", "Plan"), ("sluttar", "Sluttande eller berg")]),
    kartfraga("infart", "Kommer en lastbil ända fram?",
              [("ja", "Ja"), ("nej", "Nej, eller osäkert")]),
    kartfraga("vatten", "Ligger tomten nära vatten?",
              [("nej", "Nej"), ("ja", "Ja")]),
])


PRISSIDA = f'''    <main id="innehall">
      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/generated-materials-01.webp" width="1600" height="900" fetchpriority="high" decoding="async" alt="Materialprover med träpanel och fönsterdetalj">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Vad ett hus kostar</h1>
            <p class="subpage-hero__meta">Vad som ingår, vad som tillkommer och vad som styr summan</p>
          </div>
        </div>

        <div class="heroscen heroscen--kategori" aria-hidden="true">
          <div class="heroscen__chip heroscen__chip--a">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M5 3.5h9.5L19 8v12.5H5zM8.5 12.5h7M8.5 16h5"/></svg></span>
            <p><strong>Offert post för post</strong><span>vad som ingår och vad som tillkommer</span></p>
          </div>
          <div class="heroscen__chip heroscen__chip--b">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/></svg></span>
            <p><strong>Hus, leverans, montage</strong><span>ingår i vår del</span></p>
          </div>
        </div>
      </section>

      <section class="prisintro">
        <div class="prisintro__inner">
          <p class="section-label section-label--accent">Priser</p>
          <h2 class="prisintro__titel">Inget listpris, men <em>inga gissningar</em>.</h2>
          <p class="prisintro__text">
            Ett hus har inget listpris på samma sätt som en bil. Men det går
            att säga vad som ingår, vad som tillkommer och vad som får summan
            att röra sig, så att du vet vad du jämför när du får offerten.
          </p>
        </div>
      </section>

      <section class="prisvaljare" id="prisnivaer">
        <div class="prisvaljare__inner">
          <div class="prisvaljare__topp">
            <div>
              <h2 class="prisvaljare__titel">Prisnivåer</h2>
              <p class="prisvaljare__text">
                Startpriser per kategori. Vad just ditt hus kostar står i
                offerten, och den skriver vi när vi vet hur tomten ser ut.
              </p>
            </div>
            <div class="prisvaljare__reglage">
              <label for="onskad-yta">Hur stort hus vill du ha?</label>
              <div class="prisvaljare__rad">
                <input type="range" id="onskad-yta" min="20" max="170" step="1" value="30">
                <output for="onskad-yta" data-yta-ut>30 m²</output>
              </div>
              <p class="prisvaljare__svar" data-yta-svar aria-live="polite"></p>
            </div>
          </div>

          <div class="priskort-rad">
{priskort()}
          </div>
        </div>
      </section>

      <section class="kostnadskarta" id="ingar">
        <div class="kostnadskarta__inner">
          <div class="kostnadskarta__topp">
            <p class="section-label section-label--accent">Din kostnadskarta</p>
            <h2 class="kostnadskarta__titel">Vad ingår, och vad ska du <em>räkna med</em>?</h2>
            <p class="kostnadskarta__text">
              Svara på fyra frågor om tomten, så markerar vi vilka poster som
              troligen blir stora och vilka som kan bli små. Inga belopp - de
              står i offerten.
            </p>
            <p class="kostnadskarta__lank">
              <a href="vad-far-jag-bygga.html#kolla-marken">Kolla din mark: tomtgräns, jordarter, djup till berg och ledningar</a>
            </p>
          </div>

          <form class="kartfragor" id="kostnadskarta" aria-label="Frågor om tomten">
{KARTFRAGOR}
          </form>

          <div class="kostnadskarta__kolumner">
            <div class="ingar">
              <h3 class="kolumnrubrik"><span class="kolumnrubrik__prick kolumnrubrik__prick--ingar"></span>Det här ingår i vår offert</h3>
              <ul>
{ingar_html()}
              </ul>
            </div>

            <div class="tillkommer" id="tillkommer">
              <h3 class="kolumnrubrik"><span class="kolumnrubrik__prick"></span>Det här betalas till andra</h3>
              <p class="tillkommer__summa" data-karta-summa aria-live="polite"></p>
              <ul>
{tillkommer_html()}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="styr" id="styr">
        <div class="styr__inner">
          <div class="styr__topp">
            <p class="section-label">Vad som styr priset</p>
            <h2 class="styr__titel">Fem saker flyttar summan.</h2>
          </div>
          <div class="styr__rad">
{styr_html()}
          </div>
        </div>
      </section>

      <section class="prisvag" id="offert">
        <div class="prisvag__inner">
          <div class="prisvag__topp">
            <p class="section-label">När du får ett pris</p>
            <h2 class="prisvag__titel">Tre steg till en offert.</h2>
          </div>
          <div class="prisvag__spar" data-steglinje>
          <span class="prisvag__linje" aria-hidden="true"><span></span></span>
          <ol class="prisvag__steg">
            <li><span class="prisvag__nr">1</span><h3>Första samtalet</h3><p>Du berättar om tomten och vad huset ska användas till. Du behöver inte ha bestämt modell eller budget.</p></li>
            <li><span class="prisvag__nr">2</span><h3>Val av modell</h3><p>Vi går igenom modellerna som passar tomten och vad som behöver anpassas.</p></li>
            <li><span class="prisvag__nr">3</span><h3>Offert post för post</h3><p>Det står vad som ingår och vad som tillkommer, innan du bestämmer dig. Hela ordningen finns på <a href="sa-fungerar-det.html">Så fungerar det</a>.</p></li>
          </ol>
          </div>
          <p class="prisvag__knappar">
            <a class="knapp-fylld" href="kontakt.html">Begär offert</a>
            <a class="knapp-linje" href="vad-far-jag-bygga.html">Vad får jag bygga?</a>
          </p>
        </div>
      </section>

''' + io.open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''


def bygg():
    ut = []

    sida = (B.head("Attefallshus: reglerna efter 1 december 2025 | Idealhus",
                   "Vad som gäller för attefallshus efter regeländringen: mått "
                   "inom och utanför detaljplan, när anmälan krävs och när det "
                   "behövs bygglov.",
                   None, fil="attefallshus-regler.html")
            + "\n" + B.header("Våra hus") + "\n" + GUIDE + B.SIDFOT + "\n"
            + B.skript(TOC_SKRIPT))
    sida = sida.replace("  </body>",
                        '    <script type="application/ld+json">\n'
                        + faq_json() + "\n    </script>\n  </body>")
    io.open("attefallshus-regler.html", "w", encoding="utf-8",
            newline="").write(sida.replace("\n", "\r\n"))
    ut.append("attefallshus-regler.html")

    sida = (B.head("Priser | Idealhus",
                   "Vad ett hus fr\u00e5n Idealhus kostar: vad som ing\u00e5r, vad som "
                   "tillkommer och vad som styr priset.",
                   "generated-materials-01.webp", fil="priser.html")
            + "\n" + B.header("Priser") + "\n" + PRISSIDA + B.SIDFOT + "\n"
            + B.skript())
    io.open("priser.html", "w", encoding="utf-8",
            newline="").write(sida.replace("\n", "\r\n"))
    ut.append("priser.html")

    sida = (B.head("Integritetspolicy | Idealhus",
                   "Så behandlar Idealhus personuppgifter. Inga kakor, ingen "
                   "besöksstatistik, och kontaktformuläret skickas med ditt "
                   "eget e-postprogram.",
                   None, fil="integritetspolicy.html")
            + "\n" + B.header("") + "\n" + POLICY + B.SIDFOT + "\n"
            + B.skript(""))
    io.open("integritetspolicy.html", "w", encoding="utf-8",
            newline="").write(sida.replace("\n", "\r\n"))
    ut.append("integritetspolicy.html")

    return ut


if __name__ == "__main__":
    print("\n".join(bygg()))
