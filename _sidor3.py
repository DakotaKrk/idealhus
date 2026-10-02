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
              oss på <a href="mailto:info@idealhus.se">info@idealhus.se</a>.
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
    ("Attefallshus", "attefallshus.html", "Pris i offert"),
    ("Fritidshus", "fritidshus.html", "Pris i offert"),
]

# Vad som krävs, sagt utan belopp. Attefallshus inom måtten är lovfria;
# övriga kategorier kräver bygglov (se guiden och kategorisidorna).
LOV = {
    "Attefallshus": "Inget bygglov inom måtten",
    "Fritidshus": "Kräver bygglov",
}

INGAR = [
    ("Ritningar och underlag", "Det vi tar fram för att du ska kunna anmäla eller söka lov.",
     "M5 3.5h9.5L19 8v12.5H5zM14.5 3.5V8H19M8.5 12.5h7M8.5 16h5"),
    ("Själva huset", "Tillverkat i Sverige, under tak, med de material och den nivå vi kommit överens om.",
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
    ("grund", "Grunden", "Plattan eller plintarna ska vara gjutna innan huset kommer. Vad grunden kostar beror på marken."),
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
    spann = f"{min(ytor)} m²" if min(ytor) == max(ytor) else f"{min(ytor)}–{max(ytor)} m²"
    return (namn, lank, pris, bild, min(ytor), max(ytor), spann, len(lista))


KATEGORIER_PRIS = [_kategori(*p) for p in PRISER]


# --- Prissidan, tredje versionen (2026-09-30) -------------------------------
# Kunden: "super elit och super premium och smart och snygga animeringar".
# Tre delar: en storleksskala med zoner för lov och husen utmärkta, en levande
# offert som fylls i när man svarar om tomten, och fem faktorer med egna
# animerade bilder. Stil i design.css 18, skript i premium.js (Prissidan).

YMIN, YMAX = 20, 60


def _p(yta):
    return f"{(yta - YMIN) / (YMAX - YMIN):.4f}"


def _alla_hus():
    """(namn, yta, länk, bild, kategori) för alla modeller, i kortens ordning."""
    ut = []
    for kat, lank, *_ in PRISER:
        for i, m in enumerate(M.modeller(lank), 1):
            typ = lank.replace(".html", "")
            ut.append((m[0], m[2], f"huskort.html?typ={typ}&amp;modell={i}", m[1], kat))
    return ut


def skalans_hak():
    """Ett litet märke på spåret per storlek där vi har ett hus."""
    return "".join(f'<span class="prisskala__hak" data-yta="{yta}" style="--p:{_p(yta)}"></span>'
                   for yta in sorted({h[1] for h in _alla_hus()}))


def skalans_modeller():
    return "\n".join(
        f'                <button class="prisskala__modell" type="button" data-yta="{yta}">'
        f'<img src="images/tumme/{bild}" width="192" height="144" alt="" loading="lazy" decoding="async">'
        f'<span><b>{namn}</b><small>{yta} m² · {kat}</small></span></button>'
        for namn, yta, lank, bild, kat in _alla_hus())


def skalans_chips():
    return "\n".join(
        f'                  <a class="prisskala__chip" data-yta="{yta}" href="{lank}" hidden>{namn}<span>{yta} m²</span></a>'
        for namn, yta, lank, bild, kat in _alla_hus())


# Hela husfotot (med skylten) i kategorikorten.
HELA = {'attefallshus.html': 'hus-r2', 'fritidshus.html': 'hus-r3'}


def priskort():
    ut = []
    for namn, lank, pris, bild, lo, hi, spann, antal in KATEGORIER_PRIS:
        modeller = " ".join(f'<span>{m[0]}</span>' for m in M.modeller(lank))
        ut.append(f"""          <article class="pkort" data-min="{lo}" data-max="{hi}" data-namn="{namn}">
            <a class="pkort__bild" href="{lank}" tabindex="-1" aria-hidden="true"><img class="pkort__bak" src="images/{HELA[lank]}-800.webp" alt="" loading="lazy" decoding="async"><img class="pkort__foto" src="images/{HELA[lank]}-800.webp" srcset="images/{HELA[lank]}-800.webp 800w, images/{HELA[lank]}.webp 1600w" sizes="(max-width: 900px) 92vw, 320px" width="1600" height="1062" alt="" loading="lazy" decoding="async"></a>
            <span class="pkort__passar">Passar storleken</span>
            <div class="pkort__kropp">
              <p class="pkort__spann">{spann} · {antal} modeller</p>
              <h3 class="pkort__namn"><a href="{lank}">{namn}</a></h3>
              <p class="pkort__modeller">{modeller}</p>
              <dl class="pkort__rader">
                <div><dt>Lov</dt><dd>{LOV[namn]}</dd></div>
                <div><dt>Pris</dt><dd><strong>{pris}</strong></dd></div>
              </dl>
              <a class="pkort__lank" href="{lank}">Se modellerna<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
            </div>
          </article>""")
    return "\n".join(ut)


def ingar_html():
    return "\n".join(f"""                <li class="orad orad--ingar">
                  <span class="orad__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{d}"/></svg></span>
                  <span class="orad__text"><strong>{a}</strong><span>{b}</span></span>
                  <span class="orad__status orad__status--ingar">Ingår</span>
                </li>""" for a, b, d in INGAR)


def tillkommer_html():
    return "\n".join(f"""                <li class="orad orad--andra" data-post="{k}">
                  <span class="orad__prick" aria-hidden="true"></span>
                  <span class="orad__text"><strong>{a}</strong><span>{b}</span><em class="orad__svar" data-svar></em></span>
                  <span class="orad__status" data-status>Räkna med</span>
                </li>""" for k, a, b in TILLKOMMER)


def kartfraga(nr, namn, fraga, val):
    knappar = "\n".join(
        f'                  <label class="tval"><input type="radio" name="{namn}" value="{v}"{" checked" if i == 0 else ""}><span>{t}</span></label>'
        for i, (v, t) in enumerate(val))
    return f"""              <fieldset class="tfraga">
                <legend><span class="tfraga__nr" aria-hidden="true">0{nr}</span>{fraga}</legend>
                <div class="tfraga__rad">
{knappar}
                </div>
              </fieldset>"""


KARTFRAGOR = "\n".join([
    kartfraga(1, "va", "Finns vatten och avlopp framdraget till tomten?",
              [("ja", "Ja"), ("nej", "Nej"), ("vetej", "Vet inte")]),
    kartfraga(2, "lutning", "Hur ser marken ut där huset ska stå?",
              [("plan", "Plan"), ("sluttar", "Sluttande eller berg")]),
    kartfraga(3, "infart", "Kommer en lastbil ända fram?",
              [("ja", "Ja"), ("nej", "Nej, eller osäkert")]),
    kartfraga(4, "vatten", "Ligger tomten nära vatten?",
              [("nej", "Nej"), ("ja", "Ja")]),
])

# Bilderna till de fem faktorerna: små ritningar som rör sig (design.css 18).
FAKTORBILD = [
    '<line class="f-mark" x1="18" y1="112" x2="222" y2="112"/>'
    '<path class="f-spok" d="M40 112V82L82 62L124 82V112Z"/>'
    '<g class="f-vaxer"><path class="f-hus" d="M40 112V62L110 30L180 62V112Z"/><path class="f-dorr" d="M101 112V86h18v26"/>'
    '<path class="f-matt" d="M40 126H180M40 121v10M180 121v10"/></g>',

    '<rect class="f-hus" x="32" y="22" width="176" height="96" rx="3"/>'
    '<path class="f-vagg f-vagg--1" pathLength="1" d="M96 22V78"/>'
    '<path class="f-vagg f-vagg--2" pathLength="1" d="M96 78H208"/>'
    '<path class="f-vagg f-vagg--3" pathLength="1" d="M150 78V118"/>'
    '<path class="f-vagg f-vagg--4" pathLength="1" d="M96 96a18 18 0 0 1 18-18"/>'
    '<path class="f-vagg f-vagg--5" pathLength="1" d="M58 118a20 20 0 0 1 20-20"/>',

    '<g class="f-lager f-lager--1"><path class="f-sida f-sida--sand" d="M52 96v9l68 30 68-30v-9l-68 30z"/><path class="f-yta f-yta--sand" d="M52 96l68-30 68 30-68 30z"/></g>'
    '<g class="f-lager f-lager--2"><path class="f-sida f-sida--kol" d="M52 76v9l68 30 68-30v-9l-68 30z"/><path class="f-yta f-yta--kol" d="M52 76l68-30 68 30-68 30z"/></g>'
    '<g class="f-lager f-lager--3"><path class="f-sida f-sida--virke" d="M52 56v9l68 30 68-30v-9l-68 30z"/><path class="f-yta f-yta--virke" d="M52 56l68-30 68 30-68 30z"/></g>',

    '<g class="f-mark-grupp"><line class="f-mark" x1="10" y1="96" x2="232" y2="96"/></g>'
    '<path class="f-hus" d="M70 84V52L120 28L170 52V84Z"/>'
    '<line class="f-plint f-plint--1" x1="85" y1="84" x2="85" y2="96"/>'
    '<line class="f-plint f-plint--2" x1="120" y1="84" x2="120" y2="96"/>'
    '<line class="f-plint f-plint--3" x1="155" y1="84" x2="155" y2="96"/>',

    '<path class="f-vag" d="M24 104L216 46"/>'
    '<circle class="f-start" cx="24" cy="104" r="6"/>'
    '<path class="f-nal" d="M216 46c-8-9-12-15-12-21a12 12 0 0 1 24 0c0 6-4 12-12 21z"/>'
    '<g class="f-bil"><path class="f-lastbil" d="M-20-20h24v14h-24zM4-15h9l5 5v4H4z"/>'
    '<circle class="f-hjul" cx="-13" cy="-4" r="3.2"/><circle class="f-hjul" cx="11" cy="-4" r="3.2"/></g>',
]


def faktorer_html():
    return "\n".join(f"""            <article class="faktor faktor--{i}">
              <div class="faktor__bild" aria-hidden="true"><svg viewBox="0 0 240 140" focusable="false">{FAKTORBILD[i - 1]}</svg></div>
              <div class="faktor__ord">
                <span class="faktor__nr">0{i}</span>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            </article>""" for i, (a, b) in enumerate(STYR, 1))


# Offertkortet som svävar över toppbilden: posterna bockas av en i taget.
HERO_OFFERT = (
    '        <div class="hoffert" aria-hidden="true">\n'
    '          <div class="hoffert__huvud"><span class="hoffert__typ">Offert · utkast</span><span class="hoffert__stampel">Post för post</span></div>\n'
    '          <ul class="hoffert__lista">\n'
    + "".join(f'            <li style="--i:{i}"><i class="hoffert__bock"></i><span>{a}</span><em>Ingår</em></li>\n'
              for i, (a, _b, _d) in enumerate(INGAR))
    + f'            <li class="hoffert__andra" style="--i:{len(INGAR)}"><i class="hoffert__prick"></i><span>Grund, el och VA, mark, avgifter</span><em>Hos andra</em></li>\n'
    '          </ul>\n'
    '          <div class="hoffert__fot"><span>Summa</span><strong>Sätts i offerten</strong></div>\n'
    '        </div>'
)

PRISSIDA = f'''    <main id="innehall">
      <section class="subpage-hero helbild">
        <img class="helbild__bak" src="images/foto/stommar-stapel.webp" alt="" aria-hidden="true" decoding="async">
        <img class="subpage-hero__image" src="images/foto/stommar-stapel.webp" width="1800" height="1200" fetchpriority="high" decoding="async" alt="Färdiga väggstommar i trä staplade på varandra">
{HERO_OFFERT}

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Vad ett hus kostar</h1>
            <p class="subpage-hero__meta">Inget listpris, men inga gissningar heller. Här ser du vad som ingår, vad som tillkommer och vad som flyttar summan – innan du ber om en offert.</p>
            <div class="subpage-hero__actions">
              <a class="hero__link hero__link--solid" href="#ingar">Se vad som ingår</a>
              <a class="hero__link" href="#kontakt">Begär offert</a>
            </div>
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

      <section class="prisskala" id="prisnivaer" aria-labelledby="prisskala-rubrik">
        <div class="prisskala__inner">
          <div class="prisskala__topp">
            <div>
              <p class="section-label section-label--accent">Storlek och lov</p>
              <h2 class="prisskala__titel" id="prisskala-rubrik">Välj storlek.<br> <em>Se vad som gäller.</em></h2>
            </div>
            <p class="prisskala__text">
              Ett hus har inget listpris som en bil. Dra i reglaget så ser du
              vilka hus som ligger närmast och vad som gäller för lov.
            </p>
          </div>

          <div class="prisskala__panel">
            <span class="ih-kant" aria-hidden="true"></span>

            <div class="prisskala__matare">
              <div class="prisskala__huvud">
                <label class="prisskala__fraga" for="onskad-yta">Hur stort hus vill du ha?</label>
                <p class="prisskala__tips" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3"/></svg>Dra i reglaget eller välj ett hus</p>
              </div>
              <div class="prisskala__linjal">
                <div class="prisskala__zoner" aria-hidden="true">
                  <span class="zon zon--a" style="--fran:0;--till:0.25"><b><span class="lang">Attefallshus</span><span class="kort">Attefall</span></b></span>
                  <span class="zon zon--b" style="--fran:0.25;--till:0.75"><b><span class="lang">Utanför detaljplan, upp till 50 m²</span><span class="kort">Utanför detaljplan</span></b></span>
                  <span class="zon zon--c" style="--fran:0.75;--till:1"><b>Bygglov</b></span>
                </div>
                <div class="prisskala__bubbla" aria-hidden="true"><span data-yta-bubbla>30 m²</span></div>
                <div class="prisskala__spar" aria-hidden="true"><i></i>{skalans_hak()}</div>
                <input type="range" id="onskad-yta" min="{YMIN}" max="{YMAX}" step="1" value="30" aria-describedby="yta-svar">
                <div class="prisskala__siffror" aria-hidden="true">
                  <span style="--p:0">20</span><span style="--p:0.25">30</span><span style="--p:0.5">40</span><span style="--p:0.75">50</span><span style="--p:1">60 m²</span>
                </div>
              </div>
              <div class="prisskala__modeller" role="group" aria-label="Våra hus på skalan">
{skalans_modeller()}
              </div>
            </div>

            <div class="prisskala__yta">
              <div class="prisskala__ytahuvud">
                <p class="prisskala__ytarubrik">Golvytan i skala</p>
                <p class="prisskala__ytatal"><strong data-yta-golv>30 m²</strong> ≈ <strong data-yta-bilar>2,4</strong> bilplatser</p>
              </div>
              <svg class="prisskala__iso" data-yta-iso viewBox="-190 -100 430 225" aria-hidden="true" focusable="false"></svg>
              <p class="prisskala__ytanot">Varje ruta är en kvadratmeter. Bredvid står en bil på en bilplats, 2,5 × 5 m, och en person på 1,8 m.</p>
            </div>

            <div class="prisskala__svar">
              <p class="prisskala__varde"><output for="onskad-yta" data-yta-ut>30</output><span>m²</span></p>
              <p class="prisskala__regel" id="yta-svar" data-yta-svar aria-live="polite">Vid 30 m² passar ett attefallshus. Inom detaljplan får det vara 30 m² utan bygglov.</p>
              <div class="prisskala__granser" aria-hidden="true">
                <p class="granser__rubrik">Lovgränserna</p>
                <div class="granser__spar"><i data-yta-gransfyll></i>
                  <span class="granser__mark" style="--p:0.5"><b>30 m²</b><small>inom detaljplan</small></span>
                  <span class="granser__mark" style="--p:0.8333"><b>50 m²</b><small>utanför detaljplan</small></span>
                </div>
              </div>
              <dl class="prisskala__fakta">
                <div>
                  <dt>Närmast i storlek</dt>
                  <dd class="prisskala__chips">
{skalans_chips()}
                  </dd>
                </div>
                <div><dt>Lov</dt><dd class="prisskala__lov" data-yta-lov data-zon="a">Inget bygglov inom måtten</dd></div>
                <div><dt>Pris</dt><dd>I offerten, post för post</dd></div>
              </dl>
            </div>
          </div>

          <div class="pkort-rad">
{priskort()}
          </div>
        </div>
      </section>

      <section class="prisoffert" id="ingar" aria-labelledby="prisoffert-rubrik">
        <div class="prisoffert__inner">
          <span class="ih-kant" aria-hidden="true"></span>
          <div class="prisoffert__ord">
            <p class="ih-etikett ih-etikett--ljus">Din kostnadskarta</p>
            <h2 class="prisoffert__titel" id="prisoffert-rubrik">Offerten, <em>post för post.</em></h2>
            <p class="prisoffert__text">
              Svara på fyra frågor om tomten, så fylls utkastet i: vad som
              ingår hos oss, och vilka poster hos andra som troligen blir
              stora eller små. Inga belopp – de står i offerten.
            </p>
            <form class="tfragor" id="kostnadskarta" aria-label="Frågor om tomten">
{KARTFRAGOR}
            </form>
            <p class="prisoffert__lank">
              <a href="vad-far-jag-bygga.html#kolla-marken">Kolla din mark: tomtgräns, jordarter, djup till berg och ledningar</a>
            </p>
          </div>

          <div class="offert">
            <div class="offert__papper">
              <div class="offert__huvud">
                <div class="offert__avsandare">
                  <img class="offert__logo" src="images/idealhus_logo.svg" width="1024" height="279" alt="Idealhus">
                  <span class="offert__typ">Offert · utkast</span>
                </div>
                <span class="offert__stampel" aria-hidden="true">Post för post</span>
              </div>

              <h3 class="offert__rubrik"><span class="offert__prick offert__prick--ingar"></span>Det här ingår hos oss</h3>
              <ul class="offert__lista">
{ingar_html()}
              </ul>

              <h3 class="offert__rubrik"><span class="offert__prick"></span>Det här betalas till andra</h3>
              <p class="offert__summa" data-karta-summa aria-live="polite"></p>
              <ul class="offert__lista">
{tillkommer_html()}
              </ul>

              <div class="offert__fot">
                <span>Summa</span>
                <strong>Sätts i offerten</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="prisfaktorer" id="styr" aria-labelledby="prisfaktorer-rubrik">
        <div class="prisfaktorer__inner">
          <div class="prisfaktorer__topp">
            <p class="section-label section-label--accent">Vad som styr priset</p>
            <h2 class="prisfaktorer__titel" id="prisfaktorer-rubrik">Fem saker <em>flyttar summan.</em></h2>
          </div>
          <div class="prisfaktorer__grid">
{faktorer_html()}
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
            <li><span class="prisvag__nr">1</span><div class="prisvag__kort"><span class="prisvag__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/></svg></span><h3>Första samtalet</h3><p>Du berättar om tomten och vad huset ska användas till. Du behöver inte ha bestämt modell eller budget.</p></div></li>
            <li><span class="prisvag__nr">2</span><div class="prisvag__kort"><span class="prisvag__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5"/></svg></span><h3>Val av modell</h3><p>Vi går igenom modellerna som passar tomten och vad som behöver anpassas.</p></div></li>
            <li><span class="prisvag__nr">3</span><div class="prisvag__kort"><span class="prisvag__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 3.5h9.5L19 8v12.5H5zM14.5 3.5V8H19M9 14l2 2 4-4.2"/></svg></span><h3>Offert post för post</h3><p>Det står vad som ingår och vad som tillkommer, innan du bestämmer dig. Hela ordningen finns på <a href="sa-fungerar-det.html">Så fungerar det</a>.</p></div></li>
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
                   "foto/stommar-stapel.webp", fil="priser.html")
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
