# Bygger undersidorna. Kor: python _sidor.py
import _bygg as B
import _modeller as M


KONTAKT_SEKTION = open("_kontaktsektion.inc", encoding="utf-8").read()


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
            <p><strong>{spann_text(min(ytor), max(ytor), "m²")}</strong><span>boyta · {spann_text(min(rum), max(rum), "rum")}</span></p>
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
          </div>
        </div>{extra}
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
    boytefilter = ('\n            <div class="filter" role="group" aria-label="Filtrera på boyta">'
                   '\n              <p class="filter__etikett">Boyta</p>\n' + knappar +
                   '\n            </div>') if len(modeller) >= 4 else ''

    # Varje kort barde tidigare till samma huskort.html utan parameter, sa
    # alla tjugofyra landade pa "Huskort 1". Adressen bar nu kategorin och
    # modellens nummer; huskortssidan slar upp resten i samma tabell.
    typ = M.slug(fil)
    kort = "\n".join(f'''          <article class="model-card" data-yta="{yta}" data-rum="{rum}" data-lev="{lev}" data-nr="{i}" data-namn="{titel}" data-bild="{bild}">
            <a class="model-card__media" href="huskort.html?typ={typ}&amp;modell={i}">
              <img src="images/{bild}" loading="lazy" decoding="async" alt="{titel}, {namn.lower()} i svensk natur">
              <span class="model-card__pill" aria-hidden="true">Se huskortet</span>
            </a>
            <div class="model-card__rad">
              <h3 class="model-card__title"><a href="huskort.html?typ={typ}&amp;modell={i}">{titel}</a></h3>
              <p class="model-card__yta">{yta}<span>m²</span></p>
            </div>
            <p class="model-card__facts"><span>{rum} rum</span><span>Leverans {lev} v</span></p>
            <div class="model-card__fot">
              <p class="model-card__price">Från X kr</p>
              <button class="jamfor-knapp" type="button" aria-pressed="false">Jämför</button>
            </div>
          </article>''' for i, (titel, bild, yta, rum, lev) in enumerate(modeller, 1))

    kropp = f'''    <main id="innehall">
{hero(herobild, namn, meta, namn + " i svensk natur", fakta_bubblor(modeller))}
      <section class="category">
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

      <section class="storlek3d" data-skala="{max(m[2] for m in modeller)}">
        <div class="storlek3d__inner">
          <div class="storlek3d__ord">
            <p class="section-label section-label--accent">Storleken i 3D</p>
            <h2 class="storlek3d__titel">Så stort är <em data-3d-namn>{modeller[0][0].lower()}</em>.</h2>
            <p class="storlek3d__text">
              Peka på en modell ovanför, eller välj här, så växer huset till
              rätt yta. Lyft taket för att se golvet i kvadratmeter.
            </p>
            <div class="storlek3d__val" role="group" aria-label="Välj modell att visa i 3D">
{"".join(f'              <button type="button" data-3d="{i}" aria-pressed="{str(i == 1).lower()}">{yta} m²</button>' + chr(10) for i, (t, b, yta, r, l) in enumerate(modeller, 1))}            </div>
            <dl class="storlek3d__fakta">
              <div><dt>Boyta</dt><dd><strong data-3d-yta>{modeller[0][2]}</strong> m²</dd></div>
              <div><dt>Rum</dt><dd><strong data-3d-rum>{modeller[0][3]}</strong></dd></div>
              <div><dt>Parkeringsrutor</dt><dd>≈ <strong data-3d-p>{round(modeller[0][2] / 12.5, 1)}</strong></dd></div>
            </dl>
            <p class="storlek3d__not">Parkeringsruta 2,5 × 5 m. Måtten och proportionerna i modellen är ungefärliga.</p>
          </div>

          <div class="storlek3d__scen" tabindex="0" role="img" aria-label="3D-modell av huset. Dra eller använd piltangenterna för att vrida.">
            <div class="hus3d">
              <div class="hus3d__mark"></div>
              <div class="hus3d__skugga"></div>
              <div class="hus3d__dack"></div>
              <div class="hus3d__golv"><span data-3d-golvtext></span></div>
              <div class="hus3d__vagg hus3d__vagg--fram">
                <span class="hus3d__glas"></span>
                <span class="hus3d__dorr"></span>
              </div>
              <div class="hus3d__vagg hus3d__vagg--bak"><span class="hus3d__fonster"></span></div>
              <div class="hus3d__vagg hus3d__vagg--vanster"><span class="hus3d__fonster"></span></div>
              <div class="hus3d__vagg hus3d__vagg--hoger"><span class="hus3d__fonster"></span></div>
              <div class="hus3d__tak">
                <div class="hus3d__takyta"></div>
                <div class="hus3d__takkant hus3d__takkant--fram"></div>
                <div class="hus3d__takkant hus3d__takkant--bak"></div>
                <div class="hus3d__takkant hus3d__takkant--vanster"></div>
                <div class="hus3d__takkant hus3d__takkant--hoger"></div>
              </div>
              <span class="hus3d__matt hus3d__matt--bredd" data-3d-bredd></span>
              <span class="hus3d__matt hus3d__matt--djup" data-3d-djup></span>
            </div>
            <p class="storlek3d__tips" aria-hidden="true">Dra för att vrida</p>
            <div class="storlek3d__kontroller">
              <button class="storlek3d__lyft" type="button" aria-pressed="false">Lyft taket</button>
              <button class="storlek3d__ikon" type="button" data-zoom="-1" aria-label="Zooma ut">−</button>
              <button class="storlek3d__ikon" type="button" data-zoom="1" aria-label="Zooma in">+</button>
              <button class="storlek3d__ikon" type="button" data-aterstall aria-label="Återställ vyn">↺</button>
            </div>
          </div>
        </div>
      </section>

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

{KONTAKT_SEKTION}    </main>

'''
    # Ingressen ar brodtext och blir 190-240 tecken i ett description-falt,
    # dar Google klipper vid ~160. Sidorna har darfor en egen kort text.
    kort_text = KORTA_BESKRIVNINGAR.get(fil, ingress)
    ut = (B.head(f"{namn} | Idealhus",
                 f"{namn} från Idealhus. {kort_text}", herobild, fil=fil)
          + "\n" + B.header("Våra hus") + "\n" + kropp + B.SIDFOT + "\n"
          + B.skript())
    open(fil, "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
    return fil


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
    "För helger och långa somrar · från X m²",
    "Modeller för fritidsboende",
    "Fritidshus ger mer plats på tomten än ett attefallshus och kräver bygglov. Här samlar vi modellerna som är gjorda för att bo i över helger, lov och långa somrar.",
    SPANN))

sidor.append(kategorisida(
    "attefallshus.html", "Attefallshus", "hus-r2.webp",
    "Bygglovsbefriat · 30 m² inom detaljplan, 50 m² utanför",
    "Modeller i attefallsstorlek",
    "Sedan december 2025 krävs varken bygglov eller anmälan för själva byggnaden inom måtten, men installationer som vatten och avlopp anmäls fortfarande. Det gör dem till den snabbaste vägen till ett extra hus på tomten.",
    SPANN))

print("\n".join(sidor))
