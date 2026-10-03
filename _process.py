# Bygger sa-fungerar-det.html. Kor: python _process.py
#
# Femte versionen (2026-09-30, kunden: "ser billigt och tomt ut"). En
# scrollberattelse: en stor klistrande scen till vanster med sju
# isometriska miljoer (en per steg, ritade i premium.js "SCENER") som byter
# nar man rullar, och stegen till hoger langs en rals. Munken visar vem som
# gor vad, checklistan det du sjalv gor. Stil i design.css 19.
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
     "Du har haft samma kontakt hela vägen och vet vem du pratar med."),
]

KORTNAMN = ["Samtalet", "Modell", "Lov", "Tillverkning", "Grund", "Montage", "Besiktning"]

FASER = [
    ('Innan bygget', (1, 3), 'Vi ritar, räknar och tar fram underlaget. Du är byggherre och lämnar in till kommunen. Vi säger vad som ska med.'),
    ('Medan huset byggs', (4, 5), 'Huset växer fram inomhus, i jämn temperatur. Under tiden gör du marken klar, så att allt är redo när huset kommer.'),
    ('På plats', (6, 7), 'Huset kommer på lastbil och monteras. Sedan går vi igenom det tillsammans, rum för rum.'),
]

# Det du själv gör, ur stegens texter. (nyckel, steg, text)
CHECKLISTA = [
    ("samtal", 1, "Berätta om tomten och hur huset ska användas"),
    ("modell", 2, "Välj modell och de anpassningar som betyder något"),
    ("lov", 3, "Lämna in bygglov eller anmälan till din kommun"),
    ("grund", 5, "Se till att grunden är gjuten innan huset kommer"),
    ("anslutning", 5, "Dra fram el, vatten och avlopp"),
    ("framkomlighet", 6, "Ordna framkomlighet för lastbil och kranbil"),
    ("besiktning", 7, "Gå igenom huset vid slutbesiktningen"),
]


def _lev(typ):
    lev = [m[4] for m in M.KATEGORIER[typ][1]]
    return f"{min(lev)}–{max(lev)}"


# Leveranstiden per hustyp, ur modellerna. Visas på steg 06 när man
# väljer hustyp.
LEVERANS_JSON = json.dumps({typ: _lev(typ) for typ in M.KATEGORIER})

ANTAL = {k: sum(1 for s in STEG if s[2] == k) for k in ("vi", "du", "bada")}
VEMNAMN = {"vi": "Vi", "du": "Du", "bada": "Tillsammans"}


def munk():
    """Munken: en båge per 'vem', lika lång som andelen steg."""
    delar, start, glapp = [], 0.0, 1.6
    for k in ("vi", "du", "bada"):
        langd = ANTAL[k] / len(STEG) * 100
        delar.append(f'<circle class="vemkort__del vemkort__del--{k}" cx="21" cy="21" r="15.9155" '
                     f'stroke-dasharray="{langd - glapp:.3f} {100 - langd + glapp:.3f}" '
                     f'stroke-dashoffset="{-start:.3f}" style="--langd:{langd - glapp:.3f}"/>')
        start += langd
    return "".join(delar)


def steg_html(i, rubrik, vem, klass, text, fas):
    n, namn, spann, ingress = fas
    huvud = ""
    if i == spann[0]:
        huvud = (f'''
              <div class="berattelse__fas" id="skede-{n}">
                <span>Skede {n} · Steg {spann[0]:02d}–{spann[1]:02d}</span>
                <b>{namn}</b>
                <p>{ingress}</p>
              </div>''')
    return f'''            <li class="berattelse__steg" id="steg-{i}" data-steg="{i}" data-vem="{klass}" data-namn="{KORTNAMN[i - 1]}" data-skede="Skede {n} · {namn}">{huvud}
              <div class="berattelse__kort">
                <div class="berattelse__stegtopp">
                  <span class="berattelse__nr" aria-hidden="true">{i:02d}</span>
                  <span class="flode__vem flode__vem--{klass}"><i></i>{vem}</span>
                </div>
                <h3>{rubrik}</h3>
                <p>{text}</p>
              </div>
              <div class="berattelse__plats" aria-hidden="true"></div>
            </li>'''


def _fas_for(i):
    for n, (namn, spann, ingress) in enumerate(FASER, 1):
        if spann[0] <= i <= spann[1]:
            return (n, namn, spann, ingress)


STEG_HTML = "\n".join(steg_html(i, *STEG[i - 1], _fas_for(i)) for i in range(1, len(STEG) + 1))

SKEDEN = "\n".join(
    f'              <a href="#skede-{n}" style="--n:{spann[1] - spann[0] + 1}"><span>{spann[0]:02d}–{spann[1]:02d}</span><b>{namn}</b><i></i></a>'
    for n, (namn, spann, _) in enumerate(FASER, 1))

PRICKAR = "\n".join(
    f'              <a href="#steg-{i}" data-fard="{i}" aria-label="Steg {i}: {STEG[i - 1][0]}"><i></i></a>'
    for i in range(1, len(STEG) + 1))

VEMLISTA = "\n".join(
    f'              <li><i class="vemprick vemprick--{k}"></i>{VEMNAMN[k]}<b>{ANTAL[k]} steg</b></li>'
    for k in ("vi", "du", "bada"))

CHECK_HTML = "\n".join(
    f'''            <li>
              <label class="checklista__rad">
                <input type="checkbox" data-check="{nyckel}">
                <span class="checklista__ruta" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
                <span class="checklista__punkt">{text}</span>
              </label>
              <a class="checklista__steg" href="#steg-{s}">Steg {s:02d}</a>
            </li>''' for nyckel, s, text in CHECKLISTA)

# Kortet som svävar över toppbilden (samma form som offertkortet på
# Priser): de sju stegen med vem som gör vad, ett streck mellan skedena.
SKEDESLUT = {spann[1] for _namn, spann, _t in FASER[:-1]}
HERO_STEG = (
    '        <div class="hoffert hoffert--steg" aria-hidden="true">\n'
    '          <div class="hoffert__huvud"><span class="hoffert__typ">Sju steg · tre skeden</span><span class="hoffert__stampel">I ordning</span></div>\n'
    '          <ul class="hoffert__lista">\n'
    + "".join(f'            <li style="--i:{i}"{' class="hoffert__skede"' if i + 1 in SKEDESLUT else ''}>'
              f'<i class="hoffert__prick hoffert__prick--{klass}"></i><span><b>{i + 1:02d}</b> {rubrik}</span>'
              f'<em class="hoffert__vem hoffert__vem--{klass}">{VEMNAMN[klass]}</em></li>\n'
              for i, (rubrik, _vem, klass, _text) in enumerate(STEG))
    + '          </ul>\n'
    '          <div class="hoffert__fot"><span>Hela vägen</span><strong>En kontakt</strong></div>\n'
    '        </div>'
)

# Under tak: ett kort över bilden som ställer ute mot inne.
TAKKORT = (
    '              <div class="takkort" aria-hidden="true">\n'
    '                <div class="takkort__rad"><span class="takkort__ikon"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 16a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 7.5a3.5 3.5 0 0 1 .5 6.97M9 19l-1 2M13 18l-1 2M16.5 18.5l-1 2"/></svg></span>'
    '<p><strong>Utomhus</strong><span>regn, kyla och fukt</span></p><i class="hoffert__prick"></i></div>\n'
    '                <div class="takkort__rad takkort__rad--inne"><span class="takkort__ikon takkort__ikon--koppar"><svg viewBox="0 0 24 24" focusable="false"><path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5"/></svg></span>'
    '<p><strong>Inomhus</strong><span>jämn temperatur och fuktnivå</span></p><i class="hoffert__bock"></i></div>\n'
    '                <div class="hoffert__fot"><span>Montaget</span><strong>dagar i stället för månader</strong></div>\n'
    '              </div>'
)

KROPP = f'''    <main id="innehall">
      <section class="subpage-hero helbild">
        <img class="helbild__bak" src="images/foto/dronare-montage.webp" alt="" aria-hidden="true" decoding="async">
        <img class="subpage-hero__image" src="images/foto/dronare-montage.webp" width="1600" height="900" fetchpriority="high" decoding="async" alt="Drönarbild av ett hus under montage, med inplastade väggar runt en betongplatta och en kran">
{HERO_STEG}

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Så går husbygget till</h1>
            <p class="subpage-hero__meta">Från första samtalet till slutbesiktningen: sju steg i tre skeden, och i varje steg står det vem som gör vad.</p>
            <div class="subpage-hero__actions">
              <a class="hero__link hero__link--solid" href="#steg-1">Följ stegen</a>
              <a class="hero__link" href="#kontakt">Begär offert</a>
            </div>
          </div>
        </div>

        <div class="heroscen heroscen--kategori" aria-hidden="true">
          <div class="heroscen__chip heroscen__chip--a">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg></span>
            <p><strong>Sju steg</strong><span>i tre skeden, i ordning</span></p>
          </div>
          <div class="heroscen__chip heroscen__chip--b">
            <span class="heroscen__ikon"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/></svg></span>
            <p><strong>En kontakt</strong><span>hela vägen till besiktningen</span></p>
          </div>
        </div>
      </section>

      <section class="flode-intro" aria-labelledby="flode-rubrik">
        <div class="flode-intro__inre">
          <div class="flode-intro__ord">
            <p class="section-label section-label--accent">Tre skeden</p>
            <h2 class="flode-intro__titel" id="flode-rubrik">Sju steg, <em>i ordning.</em></h2>
            <p class="flode-intro__text">
              Ordningen spelar roll. Du kan inte bygga innan bygglovet är klart,
              och vi kan inte tillverka innan modellen är bestämd. I varje steg
              står det vem som gör vad – ingenting ska komma som en
              överraskning halvvägs in.
            </p>
            <nav class="flode-intro__skeden" aria-label="De tre skedena">
{SKEDEN}
            </nav>
          </div>

          <figure class="vemkort">
            <div class="vemkort__munk">
              <svg viewBox="0 0 42 42" aria-hidden="true" focusable="false"><circle class="vemkort__spar" cx="21" cy="21" r="15.9155"/>{munk()}</svg>
              <p class="vemkort__mitt"><strong>7</strong><span>steg</span></p>
            </div>
            <figcaption>
              <p class="vemkort__rubrik">Vem gör vad</p>
              <ul class="vemkort__lista">
{VEMLISTA}
              </ul>
            </figcaption>
          </figure>
        </div>
      </section>

      <section class="flode" data-leverans='{LEVERANS_JSON}' aria-label="Stegen">
        <div class="flode__styr">
          <div class="vemfilter" role="group" aria-label="Visa steg efter vem som gör dem">
            <button type="button" data-vem="alla" aria-pressed="true">Alla <small>7</small></button>
            <button type="button" data-vem="vi" aria-pressed="false"><i class="vemprick vemprick--vi"></i>Vi <small>{ANTAL["vi"]}</small></button>
            <button type="button" data-vem="du" aria-pressed="false"><i class="vemprick vemprick--du"></i>Du <small>{ANTAL["du"]}</small></button>
            <button type="button" data-vem="bada" aria-pressed="false"><i class="vemprick vemprick--bada"></i>Tillsammans <small>{ANTAL["bada"]}</small></button>
          </div>
          <div class="hustypval" role="group" aria-label="Anpassa stegen efter hustyp">
            <button type="button" data-typ="alla" aria-pressed="true">Alla hus</button>
            <button type="button" data-typ="attefallshus" aria-pressed="false">Attefallshus</button>
            <button type="button" data-typ="fritidshus" aria-pressed="false">Fritidshus</button>
          </div>
          <nav class="flode__prickar" aria-label="Hoppa till ett steg">
{PRICKAR}
            <span class="flode__nu" data-flode-nu aria-hidden="true">Start</span>
          </nav>
        </div>

        <div class="berattelse" data-berattelse>
          <div class="berattelse__scen" aria-hidden="true">
            <div class="berattelse__ram">
              <span class="ih-kant"></span>
              <div class="berattelse__vyer" data-vyer></div>
              <p class="berattelse__skede" data-scen-skede>Skede 1 · Innan bygget</p>
              <div class="berattelse__matare">
                <svg viewBox="0 0 42 42" focusable="false"><circle class="berattelse__ringspar" cx="21" cy="21" r="15.9155"/><circle class="berattelse__ringfyll" cx="21" cy="21" r="15.9155"/></svg>
                <span><b data-scen-nr>01</b>/07</span>
              </div>
              <p class="berattelse__namn" data-scen-namn>Första samtalet</p>
            </div>
          </div>

          <div class="berattelse__spar">
            <div class="berattelse__rail" aria-hidden="true"><i class="berattelse__railfyll"></i><i class="berattelse__railkula"></i></div>
            <ol class="berattelse__lista">
{STEG_HTML}
            </ol>
          </div>
        </div>
      </section>

      <section class="checklista" aria-labelledby="checklista-rubrik">
        <div class="checklista__inre">
          <span class="ih-kant" aria-hidden="true"></span>
          <div class="checklista__ord">
            <p class="ih-etikett ih-etikett--ljus">Din del</p>
            <h2 class="checklista__titel" id="checklista-rubrik">Det här <em>gör du.</em></h2>
            <p class="checklista__text">
              Stegen där du själv gör något, som en lista att bocka av. Bockarna
              sparas i den här webbläsaren, så listan finns kvar nästa gång.
            </p>
            <div class="checklista__matare">
              <svg viewBox="0 0 42 42" aria-hidden="true" focusable="false"><circle class="checklista__ringspar" cx="21" cy="21" r="15.9155"/><circle class="checklista__ringfyll" cx="21" cy="21" r="15.9155"/></svg>
              <p><strong data-check-antal>0 av {len(CHECKLISTA)}</strong><span>klara</span></p>
            </div>
            <button class="checklista__rensa" type="button" data-check-rensa>Börja om</button>
          </div>
          <ol class="checklista__lista">
{CHECK_HTML}
          </ol>
        </div>
      </section>

      <section class="segment segment--tak">
        <article class="segment__block">
          <div>
            <p class="section-label section-label--accent">Steg 04 · Tillverkning</p>
            <h2>Under tak, <em>inte under presenning.</em></h2>
            <p>
              Ett hus som byggs utomhus möter regn, kyla och fukt medan det
              växer fram. Våra hus byggs inomhus, i jämn temperatur, och kommer
              färdiga till tomten. Det är därför montaget tar dagar i stället
              för månader.
            </p>
            <p>
              Det ger också jämnare kvalitet mellan husen. Samma modell blir
              samma hus, oavsett vilken vecka på året det tillverkas.
            </p>
            <a class="model-price__button" href="proffs.html#pf-band-titel">Se produktionen</a>
          </div>
          <div class="segment__bildram">
            <div class="segment__media">
              <img src="images/foto/stommar-stapel.webp" width="1800" height="1200" loading="lazy" decoding="async" alt="Färdiga väggstommar i trä staplade på varandra">
            </div>
{TAKKORT}
          </div>
        </article>
      </section>

''' + open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''

ut = (B.head("Bygga attefallshus eller fritidshus i sju steg | Idealhus",
             "Så bygger du ett attefallshus eller fritidshus med Idealhus: sju steg "
             "från första samtalet till slutbesiktning, och vem som gör vad i varje "
             "steg.",
             "foto/dronare-montage.webp", fil="sa-fungerar-det.html")
      + "\n" + B.header("Så fungerar det") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript())

open("sa-fungerar-det.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("sa-fungerar-det.html")
