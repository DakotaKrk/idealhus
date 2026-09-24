# Bygger sa-fungerar-det.html. Kor: python _process.py
import _bygg as B
import json
import _modeller as M

# (rubrik, vem, klass, text)
STEG = [
    ("Första samtalet", "Tillsammans", "bada",
     "Du berättar om tomten, hur huset ska användas och ungefär när du vill "
     "vara i gång. Vi säger vad som är möjligt och vad som inte är det. "
     "Kostar ingenting och förpliktigar inte till något."),
    ("Modell och anpassning", "Tillsammans", "bada",
     "Vi går igenom modellerna och gör de anpassningar som betyder något för "
     "just din plats. Du får en offert där det står vad som ingår och vad som "
     "tillkommer."),
    ("Bygglov eller anmälan", "Du lämnar in", "du",
     "Mindre komplementhus behöver sedan december 2025 varken bygglov eller "
     "anmälan för själva byggnaden, men installationerna anmäls ändå. Övriga "
     "hus kräver bygglov. Vi tar fram ritningar och underlag, men det är du "
     "som är byggherre och lämnar in till din kommun."),
    ("Tillverkning", "Vi", "vi",
     "Huset byggs i Sverige, under tak. Väggar, golv och tak monteras i jämn "
     "temperatur och fuktnivå i stället för ute i väder och vind. Du får veta "
     "var i processen huset befinner sig."),
    ("Grund och anslutningar", "Du ordnar", "du",
     "Grunden ska vara gjuten och el, vatten och avlopp framdragna innan huset "
     "kommer. Vi säger vad som krävs och när det ska vara klart, så att inget "
     "står och väntar på varandra."),
    ("Leverans och montage", "Vi", "vi",
     "Huset transporteras till tomten och monteras. Framkomlighet för lastbil "
     "och kranbil är det vanligaste som behöver lösas i förväg."),
    ("Slutbesiktning", "Tillsammans", "bada",
     "Genomgång av huset, punktlista på det som ska rättas, och överlämning. "
     "Du har haft samma kontakt hela vägen och vet vem du ringer."),
]

import re as _re


def _teckningar():
    """Hamtar de tre teckningarna ur startsidan. En kopia har i filen
    slutade folja med sa fort nagot andrades i index.html."""
    html = open("index.html", encoding="utf-8").read().replace("\r\n", "\n")
    svgar = _re.findall(r'<svg viewBox="0 0 320 150".*?</svg>', html, _re.S)
    assert len(svgar) == 3, "hittade %d teckningar i index.html" % len(svgar)
    return ["\n".join(rad[10:] if rad.startswith(" " * 10) else rad
                      for rad in svg.split("\n")) for svg in svgar]


TECKNINGAR = _teckningar()

FASER = [('Innan bygget', (1, 3), 'Vi ritar, räknar och tar fram underlaget. Du är byggherre och lämnar in till kommunen. Vi säger vad som ska med.'), ('Medan huset byggs', (4, 5), 'Huset växer fram inomhus, i jämn temperatur. Under tiden ska marken vara redo när det kommer.'), ('På plats', (6, 7), 'Huset kommer på lastbil och monteras. Sedan går vi igenom det tillsammans, rum för rum.')]


def fas(namn, spann, ingress, teckning, steg):
    kort = "\n".join(f'''            <li class="fassteg__kort" id="steg-{i}" data-vem="{klass}" data-steg="{i}">
              <span class="fassteg__nr">{i:02d}</span>
              <div class="fassteg__kropp">
                <div class="fassteg__topp">
                  <h3>{rubrik}</h3>
                  <span class="process__vem process__vem--{klass}">{vem}</span>
                </div>
                <p>{text}</p>
              </div>
            </li>''' for i, (rubrik, vem, klass, text) in steg)

    return f'''        <section class="fas">
          <div class="fas__huvud">
            <span class="fas__bild">
{teckning}
            </span>

            <div>
              <p class="fas__spann">Steg {spann[0]:02d}–{spann[1]:02d}</p>
              <h2 class="fas__titel">{namn}</h2>
              <p class="fas__text">{ingress}</p>
            </div>
          </div>

          <ol class="fassteg">
{kort}
          </ol>
        </section>'''


def _lev(typ):
    lev = [m[4] for m in M.KATEGORIER[typ][1]]
    return f"{min(lev)}–{max(lev)}"


# Leveranstiden per hustyp, ur modellerna. Visas på steg 06 när man
# väljer hustyp i verktygsraden.
LEVERANS_JSON = json.dumps({typ: _lev(typ) for typ in M.KATEGORIER})

KORTNAMN = ["Samtalet", "Modell", "Lov", "Tillverkning", "Grund", "Montage", "Besiktning"]

FARDPLAN = "\n".join(
    f'            <a href="#steg-{i}" data-fard="{i}"><span>{i:02d}</span><em>{n}</em></a>'
    for i, n in enumerate(KORTNAMN, 1))

ANTAL = {k: sum(1 for s in STEG if s[2] == k) for k in ("vi", "du", "bada")}

faser = "\n\n".join(
    fas(namn, spann, ingress, TECKNINGAR[n],
        [(i, STEG[i - 1]) for i in range(spann[0], spann[1] + 1)])
    for n, (namn, spann, ingress) in enumerate(FASER))

KROPP = f'''    <main id="innehall">
      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/generated-craft-cladding-01.webp" width="1600" height="900" fetchpriority="high" decoding="async" alt="Händer som arbetar med träpanel i verkstad">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Så fungerar det</h1>
            <p class="subpage-hero__meta">Från första samtalet till inflyttning</p>
          </div>
        </div>

        <div class="heroscen heroscen--kategori" aria-hidden="true">
          <div class="heroscen__chip heroscen__chip--a">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg></span>
            <p><strong>Sju steg</strong><span>i tre skeden, i ordning</span></p>
          </div>
          <div class="heroscen__chip heroscen__chip--b">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/></svg></span>
            <p><strong>En kontakt</strong><span>hela vägen till nyckeln</span></p>
          </div>
        </div>
      </section>

      <section class="kontakt-topp">
        <div>
          <h2>Sju steg, <em>i ordning</em>.</h2>
          <p class="kontakt-topp__lead">
            Ordningen spelar roll. Du kan inte bygga innan bygglovet är klart,
            och vi kan inte tillverka innan modellen är bestämd.
          </p>
          <p class="kontakt-topp__brod">
            Vi har markerat vem som gör vad i varje steg, för det är den fråga
            de flesta faktiskt har. En del ligger på oss, en del på dig, och en
            del gör vi tillsammans. Ingenting av det ska komma som en
            överraskning halvvägs in.
          </p>
        </div>

        <div class="kontakt-direkt">
          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Lovfritt</span>
            <span class="kontakt-direkt__roll">Attefallshus</span>
            <span class="kontakt-direkt__lankar">
              <a href="vad-far-jag-bygga.html">30 m² inom detaljplan, 50 m² utanför</a>
            </span>
          </div>

          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">Bygglov</span>
            <span class="kontakt-direkt__roll">Övriga hus</span>
            <span class="kontakt-direkt__lankar">
              <a href="fritidshus.html">Fritidshus</a>
            </span>
          </div>

          <div class="kontakt-direkt__rad">
            <span class="kontakt-direkt__namn">En kontakt</span>
            <span class="kontakt-direkt__roll">Hela vägen</span>
            <span class="kontakt-direkt__lankar">
              <a href="kontakt.html">Kontakta oss</a>
            </span>
          </div>
        </div>
      </section>

      <section class="process process--faser" data-leverans='{LEVERANS_JSON}'>
        <div class="process__inre">
          <div class="processverktyg">
            <div class="processverktyg__grupp">
              <p class="processverktyg__etikett">Vem gör vad</p>
              <div class="vemfilter" role="group" aria-label="Visa steg efter vem som gör dem">
                <button type="button" data-vem="alla" aria-pressed="true">Alla <small>7</small></button>
                <button type="button" data-vem="vi" aria-pressed="false"><i class="prick prick--vi"></i>Vi <small>{ANTAL["vi"]}</small></button>
                <button type="button" data-vem="du" aria-pressed="false"><i class="prick prick--du"></i>Du <small>{ANTAL["du"]}</small></button>
                <button type="button" data-vem="bada" aria-pressed="false"><i class="prick prick--bada"></i>Tillsammans <small>{ANTAL["bada"]}</small></button>
              </div>
            </div>
            <div class="processverktyg__grupp">
              <p class="processverktyg__etikett">Visa för</p>
              <div class="hustypval" role="group" aria-label="Anpassa stegen efter hustyp">
                <button type="button" data-typ="alla" aria-pressed="true">Alla hus</button>
                <button type="button" data-typ="attefallshus" aria-pressed="false">Attefallshus</button>
                <button type="button" data-typ="fritidshus" aria-pressed="false">Fritidshus</button>
              </div>
            </div>
          </div>

          <nav class="fardplan" aria-label="Stegen">
            <span class="fardplan__spar" aria-hidden="true"><span></span></span>
{FARDPLAN}
          </nav>

{faser}
        </div>
      </section>

      <section class="segment">
        <article class="segment__block">
          <div>
            <h2>Under tak, inte under presenning</h2>
            <p>
              Ett hus som byggs utomhus möter regn, kyla och fukt medan det
              växer fram. Våra hus byggs inomhus, i jämn temperatur, och kommer
              färdiga till tomten. Det är därför montaget tar dagar i stället
              för månader.
            </p>
            <p>
              Det ger också jämnare kvalitet mellan husen. Samma modell blir
              samma hus, oavsett vilken vecka på året det tillverkades.
            </p>
            <a class="model-price__button" href="proffs.html">Se produktionen</a>
          </div>
          <div class="segment__media">
            <img src="images/generated-craft-saw-01.webp" loading="lazy" decoding="async" alt="Händer som kapar ett trästycke i verkstaden">
          </div>
        </article>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''

ut = (B.head("Så fungerar det | Idealhus",
             "Från första samtalet till inflyttning. Sju steg, och vem som gör "
             "vad i varje steg.",
             "generated-craft-cladding-01.webp", fil="sa-fungerar-det.html")
      + "\n" + B.header("Så fungerar det") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript())

open("sa-fungerar-det.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("sa-fungerar-det.html")
