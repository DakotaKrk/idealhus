# Bygger om-oss.html. Kor: python _omoss.py
# Ombyggd 2026-09-30 i startsidans form: stort budskap, faktakort,
# principerna som berättelserader och ett mörkt fotoband från bygget.
import _bygg as B

PRINCIPER = [
    ("Platsen först", "hus-r1.webp",
     "Vi ritar inte ett hus och letar sedan efter en tomt. Vi börjar i platsen: "
     "väderstreck, utsikt, hur marken lutar och var solen står när ni faktiskt "
     "är där. Samma modell blir olika hus beroende på var den hamnar.",
     "Sadel 30 Bred, svart attefallshus med sadeltak och glasgavel på en klippa vid havet"),
    ("Varje kvadrat räknas", "hus-r5.webp",
     "Ett litet hus ska kännas generöst i vardagen. Det handlar mindre om antal "
     "kvadratmeter och mer om var väggarna står, var ljuset kommer in och vad "
     "man ser när man kommer in genom dörren.",
     "Pulpet 30, svart attefallshus med pulpettak och stora glaspartier i snöig skog"),
    ("Material som får leva", "foto/reglar.webp",
     "Vi väljer naturliga material som åldras vackert i stället för ytskikt som "
     "ska bytas. Trä som gråar jämnt, beslag som håller, detaljer som ser bättre "
     "ut om tio år än dagen de monterades.",
     "Närbild av reglar i en väggstomme"),
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
        <img class="subpage-hero__image" src="images/foto/arbetare-vattenpass.webp" width="1800" height="1200" fetchpriority="high" decoding="async" alt="En snickare i varselkläder håller vattenpass mot en väggstomme">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Idealhus – hus som ska leva länge</h1>
            <p class="subpage-hero__meta">Idealhus AB formger och bygger attefallshus och fritidshus och tillverkar byggelement för proffs, allt under tak i Sverige. Samma kontakt hela vägen.</p>
            <div class="subpage-hero__actions">
              <a class="hero__link hero__link--solid" href="attefallshus.html">Se våra hus</a>
              <a class="hero__link" href="sa-fungerar-det.html">Så går det till</a>
            </div>
          </div>
        </div>
      </section>

      <section class="manifest ih-sektion">
        <div class="ih-inre">
          <p class="ih-etikett">Vår utgångspunkt</p>
          <h2 class="manifest__rubrik">Mindre yta. <em>Mer att leva i.</em></h2>
          <p class="manifest__text">
            Vi tror att ett litet hus ska kännas generöst i vardagen. Därför
            utgår vi från platsen, människorna och livet som ska rymmas där,
            och låter varje detalj ha en tydlig funktion.
          </p>
        </div>
      </section>

      <section class="ih-sektion ih-sektion--tat">
        <div class="ih-inre">
          <div class="siffror__grid siffror__grid--fyra">
            <div class="siffra ih-mork">
              <span class="ih-kant" aria-hidden="true"></span>
              <p class="siffra__tal"><strong>5</strong></p>
              <p class="siffra__text">husmodeller, tre attefallshus och två fritidshus.</p>
            </div>
            <div class="siffra siffra--ljus">
              <p class="siffra__tal">30–50<small> m²</small></p>
              <p class="siffra__text">i våra fem modeller, med ett eller två rum.</p>
            </div>
            <div class="siffra siffra--ljus">
              <p class="siffra__tal"><strong>1</strong></p>
              <p class="siffra__text">kontakt, från första samtalet till besiktningen.</p>
            </div>
            <div class="siffra siffra--ljus">
              <p class="siffra__tal siffra__tal--ord">Under tak</p>
              <p class="siffra__text">– varje hus byggs inomhus i Sverige, i jämn temperatur.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="segment">
{principblock}
      </section>

      <section class="virke">
        <img class="virke__bild" src="images/foto/dronare-bygget.webp" width="1600" height="900" loading="lazy" decoding="async" alt="Drönarbild av en betongplatta med inplastade väggar runt om, en kran och folk som arbetar">
        <div class="virke__inre">
          <p class="ih-etikett ih-etikett--ljus">Bakom varje hus</p>
          <h2 class="virke__rubrik">Från verkstad <em>till tomt.</em></h2>
          <p class="virke__text">
            Varje hus börjar som reglar och skivor i vår produktion och slutar
            på en tomt. Eftersom husen byggs här i Sverige kan vi följa varje
            moment på nära håll – det ger kortare beslutsvägar, jämnare kvalitet och
            bättre kontroll över material och detaljer.
          </p>
          <p class="virke__chips">
            <span class="ih-chip ih-chip--glas">Tillverkning under tak</span>
            <span class="ih-chip ih-chip--glas">Leverans och montage</span>
            <span class="ih-chip ih-chip--glas">Besiktning tillsammans</span>
          </p>
          <div class="ih-knappar">
            <a class="ih-knapp ih-knapp--virke" href="sa-fungerar-det.html">Se hur vi bygger</a>
            <a class="ih-knapp ih-knapp--ljus" href="proffs.html">För proffs</a>
          </div>
        </div>
      </section>

      <section class="kontakt-topp">
        <div>
          <p class="ih-etikett">Vilka vi är</p>
          <h2>Idealhus är ett litet företag. <em>Raka svar.</em></h2>
          <p class="kontakt-topp__lead">
            Du når oss direkt – utan växel och utan säljorganisation
            emellan.
          </p>
          <p class="kontakt-topp__brod">
            Det betyder att den du pratar med i första samtalet är samma person
            som följer ditt hus hela vägen. Du vet vem du pratar med, och vi vet
            vad vi har lovat.
          </p>
        </div>

        <div class="kontakt-direkt">
          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Skriv till oss</span>
            <span class="kontakt-direkt__roll">E-post</span>
            <span class="kontakt-direkt__lankar">
              <a href="mailto:info@idealhus.se">info@idealhus.se</a>
            </span>
          </div>

          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Så går det till</span>
            <span class="kontakt-direkt__roll">Nästa steg</span>
            <span class="kontakt-direkt__lankar">
              <a href="sa-fungerar-det.html">Se hur ett projekt går till</a>
            </span>
          </div>
        </div>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''

ut = (B.head("Om oss – attefallshus, fritidshus och byggelement | Idealhus",
             "Idealhus AB i Stockholm formger och bygger attefallshus och fritidshus "
             "och tillverkar byggelement för proffs, under tak i Sverige. En kontakt "
             "hela vägen.",
             "foto/arbetare-vattenpass.webp", fil="om-oss.html")
      + "\n" + B.header("Om oss") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript())

open("om-oss.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("om-oss.html")
