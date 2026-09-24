# Bygger proffs, om oss, sa fungerar det, referensprojekt och kontakt.
import re
import _bygg as B


def hero(bild, rubrik, meta, alt):
    return f'''      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/{bild}" width="1600" height="900" fetchpriority="high" decoding="async" alt="{alt}">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">{rubrik}</h1>
            <p class="subpage-hero__meta">{meta}</p>
          </div>
        </div>
      </section>
'''


def skriv(fil, titel, beskrivning, aktiv, kropp, forladdad=None, extra=""):
    ut = (B.head(titel, beskrivning, forladdad) + "\n" + B.header(aktiv) + "\n"
          + kropp + B.SIDFOT + "\n" + B.skript(extra))
    open(fil, "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
    return fil


# ---------------------------------------------------------------- Proffs
SEGMENT = [
    ("Utfackningsväggar", "generated-craft-cladding-01.webp",
     "Färdiga väggblock som levereras till byggarbetsplatsen och monteras på plats. Isolering, ångspärr och beklädnad är gjorda under tak, i jämn temperatur och fuktnivå.",
     ["Tillverkas inomhus, oberoende av väder",
      "Kortare tid på byggarbetsplatsen",
      "Jämnare kvalitet mellan leveranser",
      "Mått och utförande enligt er ritning"]),
    ("Husblock", "generated-production-yard-01.webp",
     "Större volymelement där stomme, ytskikt och delar av installationerna sitter på plats redan vid leverans. Blocken lyfts på plats och kopplas samman.",
     ["Stomme och ytskikt monterade i fabrik",
      "Färre moment kvar på plats",
      "Planeras in i er tidplan",
      "Anpassas efter projektets mått"]),
    ("Moduler", "generated-craft-saw-01.webp",
     "Kompletta enheter för projekt där samma utförande upprepas: personalbostäder, uthyrning eller etappvis utbyggnad. Modulerna kan flyttas och byggas om.",
     ["Samma utförande i serie",
      "Kan flyttas eller byggas om",
      "Lämpar sig för etapper",
      "Levereras klara att koppla in"]),
]

block = "\n\n".join(f'''        <article class="segment__block">
          <div>
            <h2>{namn}</h2>
            <p>{text}</p>
            <ul class="segment__fakta">
{chr(10).join("              <li>" + p + "</li>" for p in punkter)}
            </ul>
            <a class="model-price__button" href="kontakt.html">Fråga om {namn.lower()}</a>
          </div>
          <div class="segment__media">
            <img src="images/{bild}" loading="lazy" decoding="async" alt="{namn} i Idealhus produktion">
          </div>
        </article>''' for namn, bild, text, punkter in SEGMENT)

skriv("proffs.html", "Proffs | Idealhus",
      "Utfackningsväggar, husblock och moduler från Idealhus för byggföretag och entreprenörer.",
      "Våra hus",
      f'''    <main>
{hero("generated-production-yard-01.webp", "Proffs", "Utfackningsväggar · husblock · moduler", "Idealhus produktion med trävirke och husblock")}
      <section class="process">
        <div class="process__head">
          <h2>För dig som bygger åt andra</h2>
          <p>
            Vi tillverkar väggar, block och moduler i Sverige och levererar
            till er byggarbetsplats. Utförandet följer er ritning, och det
            mesta av arbetet är gjort under tak innan leverans.
          </p>
        </div>
      </section>

      <section class="segment">
{block}
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

''', "generated-production-yard-01.webp")


# ---------------------------------------------------------------- Sa fungerar det
STEG = [
    ("Första samtalet", "Du berättar om tomten, hur huset ska användas och ungefär när du vill vara i gång. Vi säger vad som är möjligt och vad som inte är det."),
    ("Modell och anpassning", "Vi går igenom modellerna tillsammans och gör de anpassningar som betyder något för just din plats. Du får en tydlig offert."),
    ("Bygglov eller anmälan", "Mindre komplementhus är sedan december 2025 lov- och anmälningsfria, övriga hus kräver bygglov. Vi tar fram underlaget och du lämnar in till din kommun."),
    ("Tillverkning", "Huset byggs i Sverige, under tak. Du får veta var i processen det befinner sig."),
    ("Leverans och montage", "Huset kommer till tomten och monteras. Grund och anslutningar ska vara förberedda innan dess."),
    ("Inflyttning", "Slutbesiktning, genomgång och överlämning. Du har haft samma kontakt hela vägen."),
]

steg = "\n".join(f'''          <li>
            <span class="process__nr">{i:02d}</span>
            <h3>{rubrik}</h3>
            <p>{text}</p>
          </li>''' for i, (rubrik, text) in enumerate(STEG, 1))

skriv("sa-fungerar-det.html", "Så fungerar det | Idealhus",
      "Från första samtalet till inflyttning. Så går ett husprojekt till hos Idealhus.",
      "Så fungerar det",
      f'''    <main>
{hero("generated-craft-cladding-01.webp", "Så fungerar det", "Från första samtalet till inflyttning", "Händer som arbetar med träpanel i verkstad")}
      <section class="process">
        <div class="process__head">
          <h2>Sex steg, i ordning</h2>
          <p>
            Ordningen spelar roll: du kan inte bygga innan bygglovet är klart,
            och vi kan inte tillverka innan modellen är bestämd. Här är vägen
            från första samtalet till att du flyttar in.
          </p>
        </div>

        <ol class="process__lista">
{steg}
        </ol>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

''', "generated-craft-cladding-01.webp")


# ---------------------------------------------------------------- Om oss
skriv("om-oss.html", "Om oss | Idealhus",
      "Idealhus formger och bygger attefallshus, fritidshus, fjällstugor och villor med svensk tillverkning.",
      "Om oss",
      '''    <main>
      <section class="textsida">
        <h1>Ett hus för dina planer.</h1>
        <p class="textsida__lead">
          Att välja och bygga ett hus innebär många beslut. Idealhus gör det
          enklare att hitta rätt bland våra husmodeller och anpassa dem efter
          dina behov.
        </p>
        <p>
          Vi formger och bygger attefallshus, fritidshus, fjällstugor och
          villor. Husen tillverkas i Sverige, under tak, vilket ger jämnare
          kvalitet och kortare beslutsvägar än när tillverkningen ligger långt
          bort.
        </p>

        <h2>Så tänker vi</h2>
        <p>
          Ett litet hus ska kännas generöst i vardagen. Därför utgår vi från
          platsen, människorna och livet som ska rymmas där, och låter varje
          detalj ha en tydlig funktion. Naturliga material som åldras vackert
          i stället för ytskikt som ska bytas.
        </p>
        <p>
          Vägen dit ska också kännas tydlig. Från första samtalet hjälper vi
          dig att förstå platsens möjligheter, välja rätt modell och göra de
          anpassningar som faktiskt betyder något. Du har en samlad kontakt
          genom hela projektet.
        </p>

        <h2>Vilka vi är</h2>
        <p>
          Idealhus är ett litet företag. Ni når oss direkt, utan
          växel och utan säljorganisation emellan.
        </p>
      </section>

      <section class="team">
        <div class="team__grid">
          <article class="team-kort">
            <h3>Skriv till oss</h3>
            <p class="team-kort__roll">E-post</p>
            <a href="mailto:info@idealhus.se">info@idealhus.se</a>
          </article>
        </div>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

''')


# ---------------------------------------------------------------- Referensprojekt
BILDER = [
    ("generated-house-coast-01.webp", "Attefallshus vid kusten"),
    ("generated-house-winter-01.webp", "Fjällstuga i vintermiljö"),
    ("generated-house-forest-01.webp", "Fritidshus i tallskog"),
    ("generated-house-garden-01.webp", "Gästhus i trädgård"),
    ("generated-house-meadow-01.webp", "Villa i öppet landskap"),
    ("generated-house-gabled-01.webp", "Villa med sadeltak"),
    ("generated-interior-01.webp", "Interiör med smart planlösning"),
]
figurer = "\n".join(f'''          <figure>
            <img src="images/{b}" loading="lazy" decoding="async" alt="{t}">
            <figcaption>{t}</figcaption>
          </figure>''' for b, t in BILDER)

skriv("referensprojekt.html", "Referensprojekt | Idealhus",
      "Hus vi ritat och byggt. Se hur kunderna använder sina hus.",
      "Referensprojekt",
      f'''    <main>
{hero("generated-house-coast-01.webp", "Referensprojekt", "Hus vi ritat och byggt", "Modernt hus pa svenska klippor vid havet")}
      <section class="galleri">
        <div class="process__head">
          <h2>Se hur våra kunder använder sina hus</h2>
          <p>
            Samma modell blir olika hus beroende på plats, väderstreck och vad
            det ska användas till. Här är några exempel.
          </p>
        </div>

        <div class="galleri__grid">
{figurer}
        </div>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

''', "generated-house-coast-01.webp")

print("proffs.html\nsa-fungerar-det.html\nom-oss.html\nreferensprojekt.html")
