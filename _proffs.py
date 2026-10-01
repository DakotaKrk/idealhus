# -*- coding: utf-8 -*-
"""Skriver proffssidans innehåll (allt i <main>) i proffs.html. Kör: python _proffs.py

proffs.html är en handsida: menyn och sidfoten sköts av _premium.py och
toppens kantljus av _sidtopp.py. Det här skriptet äger bara <main>, så
kör det före dem (2026-09-30). Ritningarna av väggen, blocken och
modulerna räknas fram här i isometri - samma projektion som resten av
sajtens scener - och rörelsen sköts av CSS (design.css 22) och av
"Proffssidan" i premium.js.
"""
import io
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

C = 0.8660254

# --- Isometrin ---------------------------------------------------------


class Iso:
    """P(x, y, z): x åt höger ned, y åt vänster ned, z uppåt."""

    def __init__(self, s):
        self.s = s
        self.pkt = []

    def P(self, x, y, z=0.0, rakna=True):
        p = ((x - y) * self.s * C, (x + y) * self.s * 0.5 - z * self.s)
        if rakna:
            self.pkt.append(p)
        return p

    def vek(self, dx, dy, dz=0.0):
        """En förflyttning i rummet, i bildpunkter (för CSS)."""
        return ((dx - dy) * self.s * C, (dx + dy) * self.s * 0.5 - dz * self.s)

    def pts(self, lista):
        return " ".join("%.1f,%.1f" % self.P(*q) for q in lista)

    def poly(self, lista, klass, extra=""):
        return f'<polygon class="{klass}" points="{self.pts(lista)}"{extra}/>'

    def linje(self, lista, klass):
        d = "M" + "L".join("%.1f %.1f" % self.P(*q) for q in lista)
        return f'<path class="{klass}" d="{d}"/>'

    def box(self, x, y, z, dx, dy, dz, klass, sidor="vht"):
        ut = []
        if "v" in sidor:
            ut.append(self.poly([(x, y + dy, z), (x + dx, y + dy, z), (x + dx, y + dy, z + dz),
                                 (x, y + dy, z + dz)], klass + " v"))
        if "h" in sidor:
            ut.append(self.poly([(x + dx, y, z), (x + dx, y + dy, z), (x + dx, y + dy, z + dz),
                                 (x + dx, y, z + dz)], klass + " h"))
        if "t" in sidor:
            ut.append(self.poly([(x, y, z + dz), (x + dx, y, z + dz), (x + dx, y + dy, z + dz),
                                 (x, y + dy, z + dz)], klass + " t"))
        return "".join(ut)

    def ram(self, x, y, z, dx, dy, dz, klass):
        """En streckad låda: där något ska stå."""
        a = [(x, y + dy, z), (x + dx, y + dy, z), (x + dx, y, z)]
        b = [(x, y + dy, z + dz), (x + dx, y + dy, z + dz), (x + dx, y, z + dz), (x, y, z + dz),
             (x, y + dy, z + dz)]
        c = [(x + dx, y + dy, z), (x + dx, y + dy, z + dz)]
        d = [(x, y + dy, z), (x, y + dy, z + dz)]
        e = [(x + dx, y, z), (x + dx, y, z + dz)]
        return "".join(self.linje(q, klass) for q in (a, b, c, d, e))

    def bbox(self):
        xs = [p[0] for p in self.pkt]
        ys = [p[1] for p in self.pkt]
        return min(xs), min(ys), max(xs), max(ys)


def skylt(x, y, text, klass=""):
    """En etikett i ritningen: en pill med text, x/y är pillens mitt."""
    b = len(text) * 6.6 + 24
    return (f'<g class="pf-skylt {klass}" transform="translate({x:.1f} {y:.1f})"><g class="pf-skylt__inre">'
            f'<rect x="{-b / 2:.1f}" y="-13" width="{b:.1f}" height="26" rx="13"/>'
            f'<text y="4.5" text-anchor="middle">{text}</text></g></g>')


VB_B, VB_H = 600, 430


def centrera(iso, inre, marg=(0, 0)):
    x0, y0, x1, y1 = iso.bbox()
    tx = (VB_B - (x1 - x0)) / 2 - x0 + marg[0]
    ty = (VB_H - (y1 - y0)) / 2 - y0 + marg[1]
    return f'<g transform="translate({tx:.1f} {ty:.1f})">{inre}</g>'


def mark(iso, x, y, dx, dy):
    """Betongplattan scenen står på, med ett svagt rutnät."""
    ut = [iso.box(x, y, -0.3, dx, dy, 0.3, "pf-mark")]
    i = x + 1
    while i < x + dx - 0.2:
        ut.append(iso.linje([(i, y, 0), (i, y + dy, 0)], "pf-mark__rut"))
        i += 1
    j = y + 1
    while j < y + dy - 0.2:
        ut.append(iso.linje([(x, j, 0), (x + dx, j, 0)], "pf-mark__rut"))
        j += 1
    return "".join(ut)


# --- Scen 1: utfackningsväggen, isärplockad --------------------------------

def scen_vagg():
    iso = Iso(36)
    L, H = 6.4, 3.2
    lager = []

    # Stommen: syll, reglar och hammarband.
    ut = [iso.box(0, 0, 0, L, 0.34, 0.16, "pf-tra")]
    for x in (0, 1.25, 2.5, 3.75, 5.0, L - 0.15):
        ut.append(iso.box(x, 0, 0.16, 0.15, 0.34, H - 0.32, "pf-tra"))
    ut.append(iso.box(0, 0, H - 0.16, L, 0.34, 0.16, "pf-tra"))
    lager.append(("Stomme", 0.0, 0.34, "".join(ut)))

    # Isoleringen, med ullens vågor på framsidan.
    y = 2.2
    ut = [iso.box(0.15, y, 0.16, L - 0.3, 0.34, H - 0.32, "pf-ull")]
    for z in (0.55, 1.05, 1.55, 2.05, 2.55):
        punkter = []
        n = 26
        for k in range(n + 1):
            xx = 0.3 + (L - 0.6) * k / n
            zz = z + (0.09 if k % 2 else -0.09)
            punkter.append((xx, y + 0.34, zz))
        ut.append(iso.linje(punkter, "pf-ull__vag"))
    lager.append(("Isolering", y, 0.34, "".join(ut)))

    # Ångspärren: tunn folie med några veck.
    y = 4.3
    ut = [iso.box(0, y, 0, L, 0.05, H, "pf-folie")]
    for x0, x1 in ((1.1, 1.9), (3.4, 4.1), (5.2, 5.9)):
        ut.append(iso.linje([(x0, y + 0.05, 0.3), (x1, y + 0.05, H - 0.3)], "pf-folie__veck"))
    lager.append(("Ångspärr", y, 0.05, "".join(ut)))

    # Beklädnaden: skivor med fogar.
    y = 6.2
    ut = [iso.box(0, y, 0, L, 0.14, H, "pf-skiva")]
    for x in (1.6, 3.2, 4.8):
        ut.append(iso.linje([(x, y + 0.14, 0), (x, y + 0.14, H)], "pf-skiva__fog"))
    lager.append(("Beklädnad", y, 0.14, "".join(ut)))

    delar = []
    for i, (namn, y, t, svg) in enumerate(lager):
        # Lagren börjar ihopfällda som en vägg och vecklas ut.
        ux, uy = iso.vek(0, -(y - i * 0.36))
        px, py = iso.P(0.9, y + t, H)
        delar.append(f'<g class="pf-lager" style="--i:{i};--ux:{ux:.1f}px;--uy:{uy:.1f}px">'
                     f'{svg}{skylt(px, py - 22, namn)}</g>')
    iso.P(0, 0, H + 1.2)
    return centrera(iso, "".join(delar), (10, 6))


# --- Scen 2: husblocken, det ena lyfts på plats --------------------------------

def fasad(iso, x, y, z, dx, dy, dz, fonster, dorr=None):
    ut = [iso.box(x, y, z, dx, dy, dz, "pf-fasad")]
    k = x + 0.4
    while k < x + dx - 0.1:
        ut.append(iso.linje([(k, y + dy, z + 0.05), (k, y + dy, z + dz - 0.05)], "pf-fasad__bradd"))
        k += 0.4
    k = y + 0.4
    while k < y + dy - 0.1:
        ut.append(iso.linje([(x + dx, k, z + 0.05), (x + dx, k, z + dz - 0.05)], "pf-fasad__bradd"))
        k += 0.4
    for f0, f1 in fonster:
        ut.append(iso.poly([(f0, y + dy, z + 0.95), (f1, y + dy, z + 0.95), (f1, y + dy, z + 2.1),
                            (f0, y + dy, z + 2.1)], "pf-glas"))
    if dorr:
        d0, d1 = dorr
        ut.append(iso.poly([(d0, y + dy, z), (d1, y + dy, z), (d1, y + dy, z + 2.05),
                            (d0, y + dy, z + 2.05)], "pf-dorr"))
    # Taket: en tunn kant i virke - stommen syns i skarven.
    ut.append(iso.box(x, y, z + dz, dx, dy, 0.1, "pf-kant"))
    return "".join(ut)


def scen_block():
    iso = Iso(33)
    B, D, H = 4.8, 2.8, 2.7
    ut = [mark(iso, -1.2, -1.2, 2 * B + 2.6, D + 2.6)]
    # Skylten står ovanför blockets bakkant, fri från det lyfta blocket.
    sx = iso.P(B / 2, 0, H)[0] - 30
    sy = iso.P(0, 0, H)[1] - 30
    fot = iso.P(1.6, 1.0, H + 0.1)
    ut.append(f'<g class="pf-block__a">{fasad(iso, 0, 0, 0, B, D, H, [(0.7, 1.9), (2.8, 4.0)])}'
              f'<path class="pf-ledare" d="M{sx:.1f} {sy + 13:.1f}L{fot[0]:.1f} {fot[1]:.1f}"/>'
              f'{skylt(sx, sy, "Stomme och ytskikt från fabrik")}</g>')

    x = B + 0.05
    ut.append(f'<g class="pf-block__spar">{iso.ram(x, 0, 0, B, D, H, "pf-spar")}</g>')
    lyft = iso.vek(0, 0, 2.4)
    krok = iso.P(x + B / 2, D / 2, H + 2.2)
    topp = iso.P(x + B / 2, D / 2, H + 9, rakna=False)
    linor = "".join(
        f'<path class="pf-lina" d="M{krok[0]:.1f} {krok[1]:.1f}L{p[0]:.1f} {p[1]:.1f}"/>'
        for p in (iso.P(x + 0.5, 0.3, H + 0.1), iso.P(x + B - 0.5, 0.3, H + 0.1),
                  iso.P(x + 0.5, D - 0.3, H + 0.1), iso.P(x + B - 0.5, D - 0.3, H + 0.1)))
    ut.append(f'<g class="pf-block__b" style="--ly:{lyft[1]:.1f}px">'
              f'<path class="pf-lina pf-lina--wire" d="M{krok[0]:.1f} {krok[1]:.1f}V{topp[1]:.1f}"/>'
              f'{linor}<circle class="pf-krok" cx="{krok[0]:.1f}" cy="{krok[1]:.1f}" r="5"/>'
              f'{fasad(iso, x, 0, 0, B, D, H, [(x + 2.9, x + 4.1)], (x + 0.8, x + 1.8))}</g>')
    skarv = [iso.P(x - 0.02, D, 0), iso.P(x - 0.02, D, H)]
    ut.append(f'<g class="pf-block__skarv"><path class="pf-skarv" d="M{skarv[0][0]:.1f} {skarv[0][1]:.1f}'
              f'L{skarv[1][0]:.1f} {skarv[1][1]:.1f}"/>'
              f'{skylt(skarv[0][0] - 8, skarv[0][1] + 34, "Kopplas samman", "pf-skylt--virke")}</g>')
    ut.append(f'<g class="pf-block__lyfts">{skylt(krok[0] + 70, krok[1] - 18, "Lyfts på plats")}</g>')
    return centrera(iso, "".join(ut), (0, 22))


# --- Scen 3: modulerna i serie, i två etapper --------------------------------

def modul(iso, x, nr):
    B, D, H = 3.0, 2.5, 2.6
    svg = fasad(iso, x, 0, 0, B, D, H, [(x + 1.6, x + 2.6)], (x + 0.4, x + 1.2))
    p = iso.P(x + B / 2, D / 2, H + 0.1)
    svg += (f'<g class="pf-nr" transform="translate({p[0]:.1f} {p[1]:.1f})">'
            f'<circle r="12"/><text y="4.5" text-anchor="middle">{nr}</text></g>')
    return svg


def scen_modul():
    iso = Iso(34)
    steg = 3.35
    ut = [mark(iso, -1.2, -1.2, 3 * steg + 2.2, 2.5 + 2.6)]
    ut.append(f'<g class="pf-modul" style="--i:0">{modul(iso, 0, 1)}</g>')
    ut.append(f'<g class="pf-modul" style="--i:1">{modul(iso, steg, 2)}</g>')
    x = 2 * steg
    ut.append(f'<g class="pf-modul__spar">{iso.ram(x, 0, 0, 3.0, 2.5, 2.6, "pf-spar")}</g>')
    ux, uy = iso.vek(4.5, 0)
    ut.append(f'<g class="pf-modul pf-modul--ny" style="--i:2;--ux:{ux:.1f}px;--uy:{uy:.1f}px">'
              f'{modul(iso, x, 3)}</g>')
    a = iso.P(steg * 0.95, 0, 3.4)
    b = iso.P(x + 1.5, 0, 3.4)
    ut.append(f'<g class="pf-etapp">{skylt(a[0], a[1] - 6, "Etapp 1")}</g>')
    ut.append(f'<g class="pf-etapp pf-etapp--2">{skylt(b[0], b[1] - 6, "Etapp 2", "pf-skylt--virke")}</g>')
    return centrera(iso, "".join(ut), (0, 16))


RITNING = f'''<svg class="pf-rit" viewBox="0 0 {VB_B} {VB_H}" focusable="false">
                <defs>
                  <linearGradient id="pf-glas-ton" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1d8"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>
                </defs>
                <g class="pf-scen pf-scen--vagg vald" data-scen="vagg">{scen_vagg()}</g>
                <g class="pf-scen pf-scen--block" data-scen="block">{scen_block()}</g>
                <g class="pf-scen pf-scen--modul" data-scen="modul">{scen_modul()}</g>
              </svg>'''


# --- Ikoner --------------------------------------------------------------

IKON = {
    "ritning": "M6 3.5h9l3.5 3.5v13.5H6z|M9 11h6|M9 14.5h6|M9 18h3.5",
    "kalender": "M4 5h16v15H4z|M4 9.5h16|M9 3v4|M15 3v4",
    "hus": "M3.5 11 12 4l8.5 7|M6 9.5V20h12V9.5",
    "bil": "M3 17h13l3-4h2v4|M5 17v2|M17 17v2|M3 13h11V7H3z",
    "bygge": "M4 20h16|M6 20V9l6-3 6 3v11|M9 12h6|M9 15.5h6",
    "kran": "M5 21V5|M5 5h15|M8 5 5 9|M17 5v6|M15.5 11h3v2.5h-3z|M3 21h5",
    "pil": "M5 12h14|M13 6l6 6-6 6",
    "bock": "M5 12.5l4.5 4.5L19 7.5",
    "vagg": "M4 20V5h16v15|M8 5v15|M12 5v15|M16 5v15|M4 12.5h16",
    "block": "M3 9l9-4.5L21 9v9l-9 4.5L3 18z|M3 9l9 4.5L21 9|M12 13.5v9",
    "moduler": "M2.5 10h6v8h-6z|M9 10h6v8H9z|M15.5 10h6v8h-6z|M2.5 13h19",
}


def ikon(namn, klass="pf-ikon"):
    return (f'<svg class="{klass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            + "".join(f'<path d="{d}" pathLength="1"/>' for d in IKON[namn].split("|"))
            + '</svg>')


# --- Innehållet ------------------------------------------------------------

LEVERANS = [
    ("vagg", "utfackningsvaggar", "Utfackningsväggar", "Färdiga väggblock", "vagg",
     "Färdiga väggblock som levereras till byggarbetsplatsen och monteras på plats. "
     "Isolering, ångspärr och beklädnad är gjorda under tak, i jämn temperatur och fuktnivå.",
     ["Tillverkas inomhus, oberoende av väder", "Kortare tid på byggarbetsplatsen",
      "Jämnare kvalitet mellan leveranser", "Mått och utförande enligt er ritning"],
     "Fråga om utfackningsväggar"),
    ("block", "husblock", "Husblock", "Större volymelement", "block",
     "Större volymelement där stomme, ytskikt och delar av installationerna sitter på plats "
     "redan vid leverans. Blocken lyfts på plats och kopplas samman.",
     ["Stomme och ytskikt monterade i fabrik", "Färre moment kvar på plats",
      "Planeras in i er tidplan", "Anpassas efter projektets mått"],
     "Fråga om husblock"),
    ("modul", "moduler", "Moduler", "Kompletta enheter i serie", "moduler",
     "Kompletta enheter för projekt där samma utförande upprepas: personalbostäder, uthyrning "
     "eller etappvis utbyggnad. Modulerna kan flyttas och byggas om.",
     ["Samma utförande i serie", "Kan flyttas eller byggas om", "Lämpar sig för etapper",
      "Levereras klara att koppla in"],
     "Fråga om moduler"),
]


def flikar():
    return "\n".join(
        f'''                <button type="button" role="tab" id="pf-flik-{kod}" aria-controls="{id_}" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}" data-val="{kod}">
                  <span class="pf-lev__nr">0{i + 1}</span>{ikon(ik, "pf-lev__ikon")}
                  <span class="pf-lev__namn">{namn.replace("Utfacknings", "Utfacknings&shy;")}<small>{under}</small></span>
                  <i class="pf-lev__tid" aria-hidden="true"></i>
                </button>'''
        for i, (kod, id_, namn, under, ik, *_rest) in enumerate(LEVERANS))


def delar():
    ut = []
    for i, (kod, id_, namn, under, ik, text, fakta, knapp) in enumerate(LEVERANS):
        punkter = "\n".join(f'                    <li>{ikon("bock", "pf-bock")}{f}</li>' for f in fakta)
        ut.append(f'''              <article class="pf-lev__del{" vald" if i == 0 else ""}" id="{id_}" role="tabpanel" aria-labelledby="pf-flik-{kod}" data-del="{kod}">
                <h3>{namn}</h3>
                <p>{text}</p>
                <ul class="pf-lev__fakta">
{punkter}
                </ul>
                <a class="pf-lev__knapp" href="kontakt.html">{knapp}{ikon("pil", "pf-pil")}</a>
              </article>''')
    return "\n".join(ut)


BILDER = [
    ("stommar-stapel.webp", 1800, 1200, "Färdiga väggstommar i trä staplade på varandra",
     "Färdiga väggstommar i trä"),
    ("reglar.webp", 1200, 800, "Närbild av träreglar i en väggstomme hos Idealhus",
     "Reglarna i en väggstomme"),
    ("arbetare-vattenpass.webp", 1800, 1200, "En snickare i varselkläder håller vattenpass mot en väggstomme",
     "Vattenpass mot en väggstomme"),
    ("dronare-leverans.webp", 1600, 900, "Drönarbild av en lastbil med takstolar och väggstommar vid bygget",
     "Leveransen: takstolar och väggstommar"),
    ("lyft-stommar.webp", 1800, 1200, "En kran lyfter väggstommar i trä förbi en rest vägg",
     "Kranen lyfter stommarna på plats"),
    ("dronare-montage.webp", 1600, 900, "Drönarbild av ett hus under montage, med inplastade väggar runt en betongplatta och en kran",
     "Montaget runt betongplattan"),
    ("dronare-platta.webp", 1600, 900, "Två personer i arbete på betongplattan mellan de resta väggarna",
     "Arbete mellan de resta väggarna"),
]


def bildmatt(fil, b, h):
    try:
        from PIL import Image
        return Image.open("images/foto/" + fil).size
    except Exception:
        return b, h


def bildband():
    ut = []
    for i, (fil, b, h, alt, text) in enumerate(BILDER, 1):
        b, h = bildmatt(fil, b, h)
        ut.append(f'''            <li class="pf-band__bild" style="--ar:{b / h:.3f}">
              <figure>
                <span class="pf-band__ram"><img src="images/foto/{fil}" width="{b}" height="{h}" loading="lazy" decoding="async" alt="{alt}" draggable="false"></span>
                <figcaption><span>{i:02d}</span>{text}</figcaption>
              </figure>
            </li>''')
    return "\n".join(ut)


STEG = [
    ("ritning", "Ritning och förfrågan",
     "Ni skickar ritning och mängder. Vi går igenom vad som passar som väggar, block eller moduler."),
    ("kalender", "Offert och tidplan",
     "Ni får en offert post för post, och leveranserna planeras in i er tidplan."),
    ("hus", "Tillverkning under tak",
     "Elementen byggs inomhus i Sverige, i jämn temperatur och fuktnivå."),
    ("bil", "Leverans till bygget",
     "Elementen kommer på lastbil och lyfts på plats. Färre moment återstår på byggarbetsplatsen."),
]


def steg():
    return "\n".join(f'''            <li class="pf-steg__steg" style="--i:{i}">
              <span class="pf-steg__nod">{ikon(ik)}</span>
              <span class="pf-steg__nr">0{i + 1}</span>
              <h3>{rubrik}</h3>
              <p>{text}</p>
            </li>''' for i, (ik, rubrik, text) in enumerate(STEG))


PIL = ikon("pil", "pf-pil")

MAIN = f'''    <main id="innehall">
      <section class="guidehero pf-topp">
        <div class="pf-topp__inre">
          <div class="pf-topp__ord">
            <p class="ih-etikett ih-etikett--ljus sidtopp__etikett">Våra hus · För dig som bygger</p>
            <h1 class="guidehero__titel pf-topp__titel">Byggelement för proffs</h1>
            <p class="pf-topp__lead">Utfackningsväggar, husblock och moduler, tillverkade under tak i Sverige och levererade till er byggarbetsplats. Utförandet följer er ritning.</p>
            <div class="pf-topp__knappar">
              <a class="ih-knapp ih-knapp--virke" href="#kontakt">Berätta om projektet{PIL}</a>
              <a class="ih-knapp ih-knapp--ljus" href="#leverans">Se vad vi levererar</a>
            </div>
            <ol class="pf-topp__tre">
              <li><a href="#utfackningsvaggar" data-hopp="vagg"><span>01</span>Utfackningsväggar</a></li>
              <li><a href="#husblock" data-hopp="block"><span>02</span>Husblock</a></li>
              <li><a href="#moduler" data-hopp="modul"><span>03</span>Moduler</a></li>
            </ol>
          </div>

          <figure class="pf-topp__bild">
            <span class="pf-topp__ram"><img src="images/foto/dronare-vaggblock.webp" width="1600" height="900" fetchpriority="high" decoding="async" alt="Drönarbild av väggblock i trä bredvid en lastbil med takstolar"></span>
          </figure>
        </div>
      </section>

      <section class="pf-lev" id="leverans" data-pf-lev>
        <div class="pf-lev__inre">
          <header class="pf-lev__huvud">
            <p class="ih-etikett">För dig som bygger åt andra</p>
            <h2 class="pf-lev__titel">Väggar, block <em>och moduler.</em></h2>
            <p class="pf-lev__ingress">
              Vi tillverkar väggar, block och moduler i Sverige och levererar
              till er byggarbetsplats. Utförandet följer er ritning, och det
              mesta av arbetet är gjort under tak innan leverans.
            </p>
          </header>

          <div class="pf-lev__panel">
            <div class="pf-lev__vanster">
              <div class="pf-lev__val" role="tablist" aria-label="Det vi levererar">
{flikar()}
              </div>
              <div class="pf-lev__delar">
{delar()}
              </div>
            </div>

            <div class="pf-lev__scen" aria-hidden="true">
              <span class="ih-kant"></span>
              {RITNING}
            </div>
          </div>
        </div>
      </section>

      <section class="pf-band" aria-labelledby="pf-band-titel">
        <div class="pf-band__huvud">
          <div>
            <p class="ih-etikett">Från fabrik till bygge</p>
            <h2 class="pf-band__titel" id="pf-band-titel">Så ser det ut på bygget.</h2>
          </div>
          <div class="pf-band__pilar">
            <button type="button" data-pf-band="-1" aria-label="Föregående bild"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
            <button type="button" data-pf-band="1" aria-label="Nästa bild"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
          </div>
        </div>
        <ol class="pf-band__rad" tabindex="0" aria-label="Bilder från bygget">
{bildband()}
        </ol>
        <span class="pf-band__matare" aria-hidden="true"><i></i></span>
      </section>

      <section class="pf-tak">
        <img class="pf-tak__bild" src="images/foto/lyft-stommar.webp" width="1800" height="1200" loading="lazy" decoding="async" alt="">
        <div class="pf-tak__inre">
          <div class="pf-tak__ord">
            <p class="ih-etikett ih-etikett--ljus">Varför element</p>
            <h2 class="pf-tak__titel">Mindre tid på bygget. <em>Mer under tak.</em></h2>
            <p class="pf-tak__text">
              Isolering, ångspärr och beklädnad görs inomhus, i jämn temperatur
              och fuktnivå. Kvar på byggarbetsplatsen är att lyfta, koppla samman
              och täta - och det går fort.
            </p>
            <p class="pf-tak__chips">
              <span>Oberoende av väder</span>
              <span>Jämnare kvalitet</span>
              <span>Planeras in i er tidplan</span>
            </p>
          </div>

          <div class="pf-flytt" data-pf-in>
            <div class="pf-flytt__kol pf-flytt__kol--tak">
              <p class="pf-flytt__rubrik">{ikon("hus")}Under tak</p>
              <ul>
                <li>Stomme</li>
                <li>Isolering</li>
                <li>Ångspärr</li>
                <li>Beklädnad</li>
              </ul>
            </div>
            <div class="pf-flytt__vag" aria-hidden="true">
              <span class="pf-flytt__bil">{ikon("bil")}</span>
            </div>
            <div class="pf-flytt__kol pf-flytt__kol--bygge">
              <p class="pf-flytt__rubrik">{ikon("kran")}På bygget</p>
              <ul>
                <li>Lyfta</li>
                <li>Koppla samman</li>
                <li>Täta</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="pf-steg">
        <div class="pf-steg__inre">
          <header class="pf-steg__huvud">
            <p class="ih-etikett">Från ritning till leverans</p>
            <h2 class="pf-steg__titel">Fyra steg. <em>En kontakt.</em></h2>
            <p class="pf-steg__ingress">
              Samma person följer projektet från första frågan till att
              elementen står på plats.
            </p>
          </header>
          <ol class="pf-steg__lista" data-pf-steg>
            <li class="pf-steg__linje" aria-hidden="true"><i></i></li>
{steg()}
          </ol>
        </div>
      </section>

      <section class="contact-section" id="kontakt">
        <div class="contact-section__inner">
          <div class="contact-section__intro">
            <p class="section-label section-label--accent">Första steget</p>
            <h2 class="contact-section__title">Låt oss börja med <em>ert projekt</em>.</h2>
            <p class="contact-section__text">
              Berätta vad du funderar på, så återkommer vi med nästa tydliga
              steg. Utan krav och utan säljsnack.
            </p>
            <ul class="tillit" aria-label="Det du kan räkna med">
              <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5"/></svg>Byggt under tak i Sverige</li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/></svg>En kontakt hela vägen</li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.5h9l3.5 3.5v13.5H6zM9 11h6M9 14.5h6M9 18h3.5"/></svg>Offert post för post</li>
              <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h16M6 20V9l6-3 6 3v11M9 12h6M9 15.5h6"/></svg>Utförande efter er ritning</li>
            </ul>
          </div>

          <div class="kontaktkort">
            <p class="kontaktkort__rubrik">Hör av dig direkt</p>

            <div class="contact-section__meta">
              <div>
                <span class="contact-section__meta-label">E-post</span>
                <a class="contact-section__meta-value" href="mailto:info@idealhus.se">info@idealhus.se</a>
              </div>
              <div>
                <span class="contact-section__meta-label">Plats</span>
                <span class="contact-section__meta-value contact-section__meta-value--tyst">Stockholm, Sverige</span>
              </div>
            </div>

            <a class="kontaktkort__knapp" href="kontakt.html">Till kontaktformuläret</a>
          </div>
        </div>
      </section>
    </main>
'''


def bygg():
    s = io.open("proffs.html", encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    s = s.replace("\r\n", "\n")
    a = s.index('    <main id="innehall">\n')
    b = s.index("    </main>\n", a) + len("    </main>\n")
    ny = s[:a] + MAIN + s[b:]
    if ny != s:
        io.open("proffs.html", "w", encoding="utf-8", newline="").write(ny.replace("\n", nl))
        print("proffs.html")


if __name__ == "__main__":
    bygg()
