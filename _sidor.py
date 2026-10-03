# Bygger undersidorna. Kor: python _sidor.py
import _bygg as B
import _modeller as M


KONTAKT_SEKTION = open("_kontaktsektion.inc", encoding="utf-8").read()


def ytetikett(ytor):
    # 30 m²-husen anges med byggnadsarea (yttermåtten), Kupa-husens 40/50 m²
    # är modellens storlek och får den neutrala etiketten Yta.
    return "Byggnadsarea" if max(ytor) <= 30 else "Yta"


def spann_text(a, b, enhet):
    return f"{a} {enhet}" if a == b else f"{a}–{b} {enhet}"


def fakta_bubblor(modeller):
    ytor = [m[2] for m in modeller]
    rum = [m[3] for m in modeller]
    lev = [m[4] for m in modeller]
    return f'''
        <div class="heroscen heroscen--kategori" aria-hidden="true">
          <div class="heroscen__chip heroscen__chip--a">
            <svg class="matare" viewBox="0 0 120 70"><path class="matare__spar" d="M10 64a50 50 0 0 1 100 0" pathLength="100"/><path class="matare__varde" d="M10 64a50 50 0 0 1 100 0" pathLength="100" style="--varde: 100"/></svg>
            <p><strong>{spann_text(min(ytor), max(ytor), "m²")}</strong><span>{ytetikett(ytor).lower()} · {spann_text(min(rum), max(rum), "rum")}</span></p>
          </div>
          <div class="heroscen__chip heroscen__chip--b">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M3 17h13l3-4h2v4M5 17v2M17 17v2M3 13h11V7H3z"/></svg></span>
            <p><strong>Leverans {spann_text(min(lev), max(lev), "v")}</strong><span>tillverkat under tak i Sverige</span></p>
          </div>
        </div>'''


def hero(bild, rubrik, meta, alt, extra=""):
    return f'''      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/{bild}" width="1600" height="900" fetchpriority="high" decoding="async" alt="{alt}">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">{rubrik}</h1>
            <p class="subpage-hero__meta">{meta}</p>
            <div class="subpage-hero__actions">
              <a class="hero__link hero__link--solid" href="#modeller">Se modellerna</a>
              <a class="hero__link" href="#kontakt">Begär offert</a>
            </div>
          </div>
        </div>{extra}
      </section>
'''


def komma(v, dec=2):
    return f"{v:.{dec}f}".replace(".", ",")


def studio3d(modeller):
    """3D-studion (2026-09-30): de riktiga modellerna (modeller/hus-r*.glb)
    i samma skala, med mått, en människa för skalan och tre vyer.
    premium.js laddar visaren när sektionen närmar sig."""
    forsta = modeller[0]
    l0, b0, h0 = M.MATT[forsta[1]]
    val = "".join(
        f'              <button type="button" data-3d-val data-id="{bild[4:6]}" data-namn="{namn}" '
        f'data-yta="{yta}" data-rum="{rum}" data-l="{M.MATT[bild][0]}" data-b="{M.MATT[bild][1]}" '
        f'data-h="{M.MATT[bild][2]}" aria-pressed="{str(i == 0).lower()}">'
        f'<b>{namn}</b><span>{yta} m²</span></button>\n'
        for i, (namn, bild, yta, rum, lev) in enumerate(modeller))
    return f'''      <section class="studio3d" data-studio3d aria-labelledby="studio3d-rubrik">
        <div class="studio3d__inner">
          <div class="studio3d__topp">
            <div class="studio3d__ord">
              <p class="section-label section-label--accent">Storleken i 3D</p>
              <h2 class="studio3d__titel" id="studio3d-rubrik">Så stort är <em data-3d-namn>{forsta[0]}</em>.</h2>
              <p class="studio3d__text">
                Husen är byggda ur ritningarna i skala 1:1 och visas i samma
                skala, så att skillnaden syns. Dra för att vrida.
              </p>
            </div>
            <div class="studio3d__val" role="group" aria-label="Välj hus att visa i 3D">
{val}            </div>
          </div>

          <div class="studio3d__scen" data-3d-scen>
            <span class="ih-kant" aria-hidden="true"></span>
            <div class="studio3d__laddar" data-3d-laddar>
              <span>Laddar 3D-modellen</span>
              <i><b data-3d-progress></b></i>
            </div>
            <div class="studio3d__lager" aria-hidden="true">
              <svg class="studio3d__linjer" data-3d-linjer>
                <g data-linje="l"><line/><line class="studio3d__tick"/><line class="studio3d__tick"/></g>
                <g data-linje="b"><line/><line class="studio3d__tick"/><line class="studio3d__tick"/></g>
                <g data-linje="h"><line/><line class="studio3d__tick"/><line class="studio3d__tick"/></g>
              </svg>
              <span class="studio3d__etikett" data-etikett="l">{komma(l0)} m</span>
              <span class="studio3d__etikett" data-etikett="b">{komma(b0)} m</span>
              <span class="studio3d__etikett studio3d__etikett--h" data-etikett="h">Nock {komma(h0)} m</span>
              <svg class="studio3d__person" data-3d-person viewBox="0 3 40 115.25"><circle cx="20" cy="11" r="8"/><path d="M12 22H28A6 6 0 0 1 34 28V62A3 3 0 0 1 28 62V36H27V115A3.25 3.25 0 0 1 20.5 115V70H19.5V115A3.25 3.25 0 0 1 13 115V36H12V62A3 3 0 0 1 6 62V28A6 6 0 0 1 12 22Z"/></svg>
            </div>

            <div class="studio3d__vyer" role="group" aria-label="Välj vy">
              <button type="button" data-vy="horn" aria-pressed="true">Hörn</button>
              <button type="button" data-vy="fasad" aria-pressed="false">Fasad</button>
              <button type="button" data-vy="ovan" aria-pressed="false">Ovanifrån</button>
            </div>
            <div class="studio3d__kontroller">
              <button class="studio3d__matt" type="button" data-3d-matt aria-pressed="true">Mått</button>
              <button class="studio3d__ikon" type="button" data-zoom="1" aria-label="Zooma ut"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12"/></svg></button>
              <button class="studio3d__ikon" type="button" data-zoom="-1" aria-label="Zooma in"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12M12 6v12"/></svg></button>
              <button class="studio3d__ikon" type="button" data-3d-aterstall aria-label="Återställ vyn"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/></svg></button>
            </div>
            <p class="studio3d__tips" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3"/></svg>Dra för att vrida</p>
          </div>

          <dl class="studio3d__fakta">
            <div><dt>{ytetikett([m[2] for m in modeller])}</dt><dd><strong data-3d-tal="yta" data-dec="0">{forsta[2]}</strong><span>m²</span></dd></div>
            <div><dt>Yttermått</dt><dd><strong data-3d-tal="l" data-dec="2">{komma(l0)}</strong><span>×</span><strong data-3d-tal="b" data-dec="2">{komma(b0)}</strong><span>m</span></dd></div>
            <div><dt>Nockhöjd</dt><dd><strong data-3d-tal="h" data-dec="2">{komma(h0)}</strong><span>m</span></dd></div>
            <div><dt>Rum</dt><dd><strong data-3d-tal="rum" data-dec="0">{forsta[3]}</strong></dd></div>
          </dl>
          <p class="studio3d__not">Yttermåtten och nockhöjden står i ritningarna. Människan bredvid huset är 1,8 m lång.</p>
        </div>
      </section>
'''


def kategorisida(fil, namn, herobild, meta, rubrik, ingress, spann):
    modeller = M.modeller(fil)
    guidelank = ('\n          <p class="category__guide">'
                 '<a href="attefallshus-regler.html">Reglerna för attefallshus ändrades i december 2025: så fungerar de nu</a></p>'
                 '\n          <p class="category__guide"><a href="vad-far-jag-bygga.html">Räkna ut hur stort hus som ryms på din tomt</a></p>'
                 ) if fil == 'attefallshus.html' else (
                 '\n          <p class="category__guide"><a href="aga-och-hyra-ut.html">Samäga eller hyra ut stugan: kalender och uthyrningskalkyl</a></p>'
                 if fil == 'fritidshus.html' else '')
    # Proffs skiljs av med en linje. Den som jamfor attefallshus mot
    # fritidshus jamfor inte utfackningsvaggar i samma rad.
    def pill(n, f):
        return f'          <a href="{f}"{" aria-current=\"page\"" if n == namn else ""}>{n}</a>'

    piller = "\n".join(
        [pill(n, f) for n, f in B.KATEGORIER_PRIVAT]
        + ['          <span class="category-filter__delare" aria-hidden="true"></span>']
        + [pill(n, f) for n, f in B.KATEGORIER_PROFFS])

    ytor = sorted(m[2] for m in modeller)
    halv = len(ytor) // 2
    spann = [("Alla", 0, 99999),
             (spann_text(ytor[0], ytor[halv - 1], "m²"), ytor[0], ytor[halv - 1]),
             (spann_text(ytor[halv], ytor[-1], "m²"), ytor[halv], ytor[-1])]
    if spann[1][2] >= spann[2][1]:
        spann = spann[:1]
    meta = meta.replace("från X m²", f"från {ytor[0]} m²")
    # Med få modeller säger ett storleksfilter ingenting - det visas
    # först när det finns minst fyra hus att sålla bland.
    knappar = "\n".join(
        f'          <button type="button" data-min="{a}" data-max="{b}"'
        f'{" aria-pressed=\"true\"" if i == 0 else " aria-pressed=\"false\""}>{txt}</button>'
        for i, (txt, a, b) in enumerate(spann))
    boytefilter = ('\n            <div class="filter" role="group" aria-label="Filtrera på yta">'
                   '\n              <p class="filter__etikett">Yta</p>\n' + knappar +
                   '\n            </div>') if len(modeller) >= 4 else ''

    # Sedan 2026-10-03 gar korten till modellens egen sida (M.SIDA).
    # Varje kort barde tidigare till samma huskort.html utan parameter, sa
    # alla tjugofyra landade pa "Huskort 1". Adressen bar nu kategorin och
    # modellens nummer; huskortssidan slar upp resten i samma tabell.
    typ = M.slug(fil)
    kort = "\n".join(f'''          <article class="model-card" data-yta="{yta}" data-rum="{rum}" data-lev="{lev}" data-nr="{i}" data-namn="{titel}" data-bild="{bild}">
            <a class="model-card__media" href="{M.SIDA[titel]}">
              <img src="images/{bild}" loading="lazy" decoding="async" alt="{titel}, {namn.lower()} i svensk natur">
              <span class="model-card__pill" aria-hidden="true">Se huskortet</span>
            </a>
            <div class="model-card__rad">
              <h3 class="model-card__title"><a href="{M.SIDA[titel]}">{titel}</a></h3>
              <p class="model-card__yta">{yta}<span>m²</span></p>
            </div>
            <p class="model-card__facts"><span>{rum} rum</span><span>Leverans {lev} v</span></p>
            <div class="model-card__fot">
              <p class="model-card__price">Pris i offert</p>
              <button class="jamfor-knapp" type="button" aria-pressed="false">Jämför</button>
            </div>
          </article>''' for i, (titel, bild, yta, rum, lev) in enumerate(modeller, 1))

    kropp = f'''    <main id="innehall">
{hero(herobild, namn, meta, namn + " i svensk natur", fakta_bubblor(modeller))}
      <section class="category" id="modeller">
        <div class="category__inner">
          <nav class="category-filter" aria-label="Huskategorier">
{piller}
          </nav>

          <div class="category__head">
            <h2>{rubrik}</h2>
            <p class="category__ingress">{ingress}</p>{guidelank}
            <p class="category__count" aria-live="polite">{len(modeller)} modeller</p>
          </div>

          <div class="modellrad">{boytefilter}
            <div class="filter sortering" role="group" aria-label="Sortera modellerna">
              <p class="filter__etikett">Sortera</p>
              <button type="button" data-sort="nr" aria-pressed="true">Förvalt</button>
              <button type="button" data-sort="minst" aria-pressed="false">Minst</button>
              <button type="button" data-sort="storst" aria-pressed="false">Störst</button>
              <button type="button" data-sort="lev" aria-pressed="false">Snabbast</button>
            </div>
          </div>

          <div class="model-grid">
{kort}
          </div>

          <p class="category__prisrad">
            Priserna sätts i offert efter din tomt.
            <a href="priser.html">Så sätts priset</a>
          </p>
        </div>
      </section>

{studio3d(modeller)}
      <div class="jamforbar" hidden>
        <p><strong data-jamfor-antal>0</strong> hus valda</p>
        <button class="jamforbar__oppna" type="button">Jämför sida vid sida</button>
        <button class="jamforbar__rensa" type="button">Rensa</button>
      </div>

      <dialog class="jamforruta" aria-labelledby="jamfor-rubrik">
        <div class="jamforruta__topp">
          <h2 id="jamfor-rubrik">Jämför modeller</h2>
          <button class="jamforruta__stang" type="button" aria-label="Stäng jämförelsen">×</button>
        </div>
        <div class="jamforruta__kolumner"></div>
      </dialog>

{fragor(fil)}
{KONTAKT_SEKTION}    </main>

'''
    # Ingressen ar brodtext och blir 190-240 tecken i ett description-falt,
    # dar Google klipper vid ~160. Sidorna har darfor en egen kort text.
    kort_text = KORTA_BESKRIVNINGAR.get(fil, ingress)
    titel, beskrivning = SEO.get(fil, (f"{namn} | Idealhus", f"{namn} från Idealhus. {kort_text}"))
    ut = (B.head(titel, beskrivning, herobild, fil=fil)
          + "\n" + B.header("Våra hus") + "\n" + kropp + B.SIDFOT + "\n"
          + B.skript())
    open(fil, "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
    return fil


FRAGOR = {
    "attefallshus.html": [
        ("Behöver jag bygglov?",
         "Nej, inte för själva byggnaden om huset håller sig inom måtten. Sedan "
         "december 2025 behövs varken bygglov eller anmälan för den. Ska huset ha "
         "vatten, avlopp, ventilation eller eldstad anmäls installationerna till kommunen."),
        ("Hur stort får huset vara?",
         "30 m² inom detaljplan och 50 m² utanför. Nockhöjden får vara 4,0 m inom "
         "detaljplan och 4,5 m utanför."),
        ("Hur nära tomtgränsen får det stå?",
         "4,5 m från tomtgränsen, eller närmare om grannen ger sitt skriftliga "
         "medgivande."),
        ("Kan jag bo i huset året runt?",
         "Ja, om det byggs som <a href=\"attefallshus-regler.html#skillnaden\">"
         "komplementbostadshus</a>. Då ska det uppfylla kraven på "
         "en fullvärdig bostad, med kök och badrum."),
        ("Vad ingår i priset?",
         "Priset sätts i en offert efter din tomt. I vår del ingår ritningar och "
         "underlag, själva huset, leverans till tomten, montage och slutbesiktning. "
         "Grunden, el, vatten och avlopp, markarbete och kommunens avgifter betalas "
         "till andra, och tillval tillkommer. <a href=\"priser.html\">Så sätts "
         "priset</a>."),
    ],
    "fritidshus.html": [
        ("Behöver ett fritidshus bygglov?",
         "Ja. Våra fritidshus är större än ett attefallshus och kräver bygglov. "
         "Vi tar fram ritningar och underlag, och du som byggherre lämnar in "
         "ansökan till kommunen."),
        ("Kan vi äga stugan tillsammans?",
         "Ja. Samägarkalendern fördelar årets veckor rättvist mellan delägarna, "
         "storhelgerna först."),
        ("Går det att hyra ut stugan när vi inte är där?",
         "Uthyrningskalkylen visar vad uthyrningen kan täcka av kostnaderna, "
         "vecka för vecka."),
        ("Vad ingår i priset?",
         "Priset sätts i en offert efter din tomt. I vår del ingår ritningar och "
         "underlag till bygglovet, själva huset, leverans till tomten, montage och "
         "slutbesiktning. Grunden, el, vatten och avlopp, markarbete och kommunens "
         "avgifter betalas till andra, och tillval tillkommer. <a "
         "href=\"priser.html\">Så sätts priset</a>."),
    ],
}


def fragor(fil):
    rader = FRAGOR.get(fil)
    if not rader:
        return ""
    poster = "\n".join(
        f'''            <details class="ih-fraga"{" open" if i == 0 else ""}>
              <summary>{f}</summary>
              <p>{s}</p>
            </details>''' for i, (f, s) in enumerate(rader))
    return f'''
      <section class="ih-sektion ih-sektion--sand">
        <div class="ih-inre">
          <div class="ih-huvud ih-huvud--mitt">
            <p class="ih-etikett">Vanliga frågor</p>
            <h2 class="ih-rubrik">Det du undrar <em>först.</em></h2>
          </div>
          <div class="ih-fragor">
{poster}
          </div>
        </div>
      </section>
'''


# Title och description för kategorisidorna (2026-10-03): sökordet först,
# varumärket sist, och bara fakta som står på sidan.
SEO = {
    "attefallshus.html": ("Attefallshus på 30 m² – tre modeller i trä | Idealhus",
                          "Tre attefallshus i trä på 30 m², med sadeltak eller pulpettak. Byggda under tak i Sverige och monterade på din tomt. Inget bygglov för huset inom måtten."),
    "fritidshus.html": ("Bygga fritidshus – 40 och 50 m² med takkupa | Idealhus",
                        "Kupa 40 och Kupa 50 är fritidshus på 40 och 50 m² med takkupa. Byggda under tak i Sverige, monterade på din tomt. Kräver bygglov – underlaget tar vi fram."),
}

KORTA_BESKRIVNINGAR = {
    "attefallshus.html":
        "Sedan december 2025 behövs varken bygglov eller anmälan för själva byggnaden – den snabbaste vägen till ett hus till på tomten.",
    "fritidshus.html":
        "Mer plats på tomten än ett attefallshus, byggda för att bo i över helger, lov och långa somrar. Kräver bygglov.",
}

SPANN = [("Alla", 0, 99999), ("Under 30 m²", 0, 29), ("30–60 m²", 30, 60), ("Över 60 m²", 61, 99999)]

sidor = []

sidor.append(kategorisida(
    "fritidshus.html", "Fritidshus", "hus-r3.webp",
    "Mer plats än ett attefallshus, för helger, lov och långa somrar - från X m², byggda under tak i Sverige och monterade på några dagar.",
    "Modeller för fritidsboende",
    "Fritidshus ger mer plats på tomten än ett attefallshus och kräver bygglov. Här samlar vi modellerna som är gjorda för att bo i över helger, lov och långa somrar.",
    SPANN))

sidor.append(kategorisida(
    "attefallshus.html", "Attefallshus", "hus-r2.webp",
    "Smarta småhus för boende, gästhus eller uthyrning. Inom måtten behövs varken bygglov eller anmälan för själva byggnaden: 30 m² inom detaljplan, 50 m² utanför.",
    "Modeller i attefallsstorlek",
    "Sedan december 2025 krävs varken bygglov eller anmälan för själva byggnaden inom måtten, men installationer som vatten och avlopp anmäls fortfarande. Det gör dem till den snabbaste vägen till ett extra hus på tomten.",
    SPANN))

print("\n".join(sidor))
