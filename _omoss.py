# Bygger om-oss.html. Kor: python _omoss.py
import _bygg as B

PRINCIPER = [
    ("Platsen först", "hus-r1.webp",
     "Vi ritar inte ett hus och letar sedan efter en tomt. Vi börjar i platsen: "
     "väderstreck, utsikt, hur marken lutar och var solen står när ni faktiskt "
     "är där. Samma modell blir olika hus beroende på var den hamnar.",
     "Svart attefallshus på klippor vid havet"),
    ("Varje kvadrat räknas", "generated-interior-01.webp",
     "Ett litet hus ska kännas generöst i vardagen. Det handlar mindre om antal "
     "kvadratmeter och mer om var väggarna står, var ljuset kommer in och vad "
     "man ser när man kommer in genom dörren.",
     "Ljus interiör i ett litet hus med smart planering"),
    ("Material som får leva", "generated-materials-01.webp",
     "Vi väljer naturliga material som åldras vackert i stället för ytskikt som "
     "ska bytas. Trä som gråar jämnt, beslag som håller, detaljer som ser bättre "
     "ut om tio år än dagen de monterades.",
     "Materialprover med träpanel och fönsterdetalj"),
]

principblock = "\n\n".join(f'''        <article class="segment__block">
          <div>
            <h2>{rubrik}</h2>
            <p>{text}</p>
          </div>
          <div class="segment__media">
            <img src="images/{bild}" loading="lazy" decoding="async" alt="{alt}">
          </div>
        </article>''' for rubrik, bild, text, alt in PRINCIPER)

KROPP = f'''    <main id="innehall">
      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/hus-r2.webp" width="1600" height="1062" fetchpriority="high" decoding="async" alt="Attefallshus med lärkpanel på en äng vid vattnet">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Om oss</h1>
            <p class="subpage-hero__meta">Ritas här · byggs i Sverige · under tak</p>
          </div>
        </div>
      </section>

      <section class="kontakt-topp">
        <div>
          <h2>Ett hus för <em>dina planer</em>.</h2>
          <p class="kontakt-topp__lead">
            Att välja och bygga ett hus innebär många beslut. Idealhus gör det
            enklare att hitta rätt bland våra husmodeller och anpassa dem efter
            dina behov.
          </p>
          <p class="kontakt-topp__brod">
            Vi formger och bygger attefallshus och fritidshus. Husen tillverkas i Sverige, under tak, vilket ger jämnare
            kvalitet och kortare beslutsvägar än när tillverkningen ligger långt
            bort. Från första samtalet till inflyttning har du samma kontakt.
          </p>
        </div>

        <div class="kontakt-direkt">
          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Sverige</span>
            <span class="kontakt-direkt__roll">Tillverkning</span>
            <span class="kontakt-direkt__lankar">
              <a href="proffs.html">Se produktionen</a>
            </span>
          </div>

          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Fem hus</span>
            <span class="kontakt-direkt__roll">Husmodeller</span>
            <span class="kontakt-direkt__lankar">
              <a href="attefallshus.html">Attefallshus och fritidshus</a>
            </span>
          </div>

          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">En kontakt</span>
            <span class="kontakt-direkt__roll">Genom hela projektet</span>
            <span class="kontakt-direkt__lankar">
              <a href="sa-fungerar-det.html">Så går ett projekt till</a>
            </span>
          </div>
        </div>
      </section>

      <section class="segment">
{principblock}
      </section>

      <section class="team">
        <div class="process__head">
          <h2>Vilka vi är</h2>
          <p>
            Idealhus är ett litet företag. Ni når oss direkt, utan växel
            och utan säljorganisation emellan.
          </p>
        </div>

        <div class="kontakt-direkt" style="max-width:560px">
          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Skriv till oss</span>
            <span class="kontakt-direkt__roll">E-post</span>
            <span class="kontakt-direkt__lankar">
              <a href="mailto:info@idealhus.se">info@idealhus.se</a>
            </span>
          </div>
        </div>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''

ut = (B.head("Om oss | Idealhus",
             "Idealhus formger och bygger attefallshus och fritidshus "
             "med svensk tillverkning.",
             "hus-r2.webp", fil="om-oss.html")
      + "\n" + B.header("Om oss") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript())

open("om-oss.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("om-oss.html")
