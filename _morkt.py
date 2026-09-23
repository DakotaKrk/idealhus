# -*- coding: utf-8 -*-
"""Bygger det mörka temat och skriver in det sist i styles.css.
Kor: python _morkt.py  (kan koras om - blocket mellan markeringarna ersätts)

Temat slås på med html[data-tema="mork"] (knappen i headern, premium.js).
Färgerna går mest via variablerna, men sajten har vita och halvgenomskinligt
vita ytor inskrivna direkt i många regler. Skriptet letar upp dem och ger
dem en mörk motsvarighet, i stället för att de listas för hand och glöms.
"""
import io
import re

START = "/* === MÖRKT TEMA START (byggs av _morkt.py) === */"
SLUT = "/* === MÖRKT TEMA SLUT === */"

css = io.open("styles.css", encoding="utf-8", newline="").read()
if START in css:
    css = css[:css.index(START)].rstrip("\r\n") + "\r\n" + css[css.index(SLUT) + len(SLUT):].lstrip("\r\n")

utan_kommentarer = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

# Enkel regelparser: selektor { deklarationer } på innersta nivån.
regler = re.findall(r"([^{}]+)\{([^{}]*)\}", utan_kommentarer)

vit = re.compile(r"background(?:-color)?\s*:[^;]*(#fff\b|#ffffff|\bwhite\b)", re.I)
glas = re.compile(r"background(?:-color)?\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.(\d+)\s*\)", re.I)
varmvit = re.compile(r"background(?:-color)?\s*:[^;]*(#fffaf3|#fbefe1|#fff7ec|#fbecd9|#f6eee3|#fdfaf5)", re.I)

vita, glasiga = set(), set()
for sel, dekl in regler:
    sel = " ".join(sel.split())
    if not sel or sel.startswith("@") or ":root" in sel or "html[data-tema" in sel:
        continue
    # Hero, bildkort och glas över foton ska vara som de är - de ligger på bild.
    if re.search(r"hero|heroscen|malgrupp|house-card__link|model-card__pill|tipsruta__stang|house-card|feature-card|production__|ordband", sel):
        continue
    delar = [s.strip() for s in sel.split(",") if s.strip()]
    if vit.search(dekl) or varmvit.search(dekl):
        vita.update(delar)
    else:
        m = glas.search(dekl)
        if m and int(m.group(1)[:2].ljust(2, "0")) >= 50:
            glasiga.update(delar)

# Valda tillstånd (:checked, aria-pressed) med egen bakgrund ska vinna
# över de mörka ytorna ovan - annars syntes inte vad man valt.
valda = []
for sel, dekl in regler:
    sel = " ".join(sel.split())
    if not re.search(r":checked|aria-pressed=\"true\"", sel) or "html[data-tema" in sel:
        continue
    bg = [d.strip() for d in dekl.split(";") if re.match(r"\s*background", d)]
    if bg and not vit.search(dekl) and not varmvit.search(dekl):
        delar = ",\n".join(f'html[data-tema="mork"] {s.strip()}' for s in sel.split(",") if s.strip())
        valda.append(delar + " {\n  " + ";\n  ".join(bg) + ";\n}")


# Pseudoelement och tillstånd behålls; html-prefixet läggs på varje del.
def prefixa(lista):
    return ",\n".join(f'html[data-tema="mork"] {s}' for s in sorted(lista))

block = f"""
{START}
/* Mörkt tema: varmt och mörkt, som en kvällsbild av huset - inte kallt
   grått. Variablerna gör det mesta; resten är ytor som var vita. */
html[data-tema="mork"] {{
  color-scheme: dark;
  --ink: #f1e9dd;
  --ink-soft: #cfc4b4;
  --ink-faint: #a69b8d;
  --paper: #1d1813;
  --sand: #231d17;
  --line: #3b3229;
  --forest: #0f0c0a;
  --logo: #c2b29d;
  --knapp: #a4602f;
  --knapp-morkare: #8c4f24;
  --varm-papper: #15110d;
  --yta: #241e18;
  --yta-glas: rgba(44, 37, 30, 0.82);
}}

html[data-tema="mork"] body {{
  background: var(--varm-papper);
  color: var(--ink);
}}

{prefixa(vita)} {{
  background-color: var(--yta);
}}

{prefixa(glasiga)} {{
  background-color: var(--yta-glas);
}}

/* Valda tillstånd, återställda ovanpå de mörka ytorna. */
{chr(10).join(valda)}

/* Headerns piller, menyer och paneler. */
html[data-tema="mork"] .site-header__inner {{
  background: rgba(30, 25, 20, 0.84);
  border-color: rgba(255, 255, 255, 0.08);
}}

html[data-tema="mork"] .main-nav__sub,
html[data-tema="mork"] .mobile-nav,
html[data-tema="mork"] .jamforruta,
html[data-tema="mork"] .valj__lista {{
  background: var(--yta);
  border-color: var(--line);
}}

/* Vita knappar och brickor som ligger på foton behåller mörk text -
   annars blev texten ljus mot vitt och försvann. */
html[data-tema="mork"] .hero__link--solid,
html[data-tema="mork"] .house-card__link,
html[data-tema="mork"] .model-card__pill,
html[data-tema="mork"] .hero .malgrupp button[aria-pressed="true"],
html[data-tema="mork"] .hero .malgrupp button[aria-pressed="true"]:hover {{
  color: #232019;
}}

/* Loggan är en SVG-fil i loggans gråbruna ton - ljusare på mörkt. */
html[data-tema="mork"] .logo__svg,
html[data-tema="mork"] .site-footer__logo {{
  filter: brightness(1.75) saturate(0.9);
}}

/* Fält och kort som hade ljusa kanter. */
html[data-tema="mork"] input,
html[data-tema="mork"] textarea,
html[data-tema="mork"] select {{
  background-color: #1b1611;
  border-color: var(--line);
  color: var(--ink);
}}

html[data-tema="mork"] ::placeholder {{
  color: #8a7f72;
}}

/* Glöden i sektionerna blir svagare och varmare. */
html[data-tema="mork"] .glod,
html[data-tema="mork"] .storlek3d,
html[data-tema="mork"] .hus3dvy,
html[data-tema="mork"] .kostnadskarta,
html[data-tema="mork"] .tomtkoll,
html[data-tema="mork"] .kollen-topp {{
  background:
    radial-gradient(55% 80% at 8% 12%, rgba(164, 96, 47, 0.18), transparent 70%),
    radial-gradient(45% 70% at 96% 92%, rgba(217, 162, 98, 0.12), transparent 72%),
    var(--sand);
}}

/* Skimmerordet och koppar håller sig ljusa nog att läsa. */
html[data-tema="mork"] h2 em,
html[data-tema="mork"] .skimmer {{
  background-image: linear-gradient(100deg, #d9a262 0%, #e7b77e 30%, #f6d3a4 50%, #e7b77e 70%, #d9a262 100%);
}}

html[data-tema="mork"] .section-label--accent,
html[data-tema="mork"] .priskort__lov,
html[data-tema="mork"] .val__tips a,
html[data-tema="mork"] .kollen__friskrivning a,
html[data-tema="mork"] .prisvag__steg a {{
  color: #e2a86a;
}}

/* Bilder tonas ned en aning så att de inte bländar i mörkret. */
html[data-tema="mork"] main img:not(.logo__svg) {{
  filter: brightness(0.92);
}}

/* 3D-scenerna: ljusare botten bakom modellen så att svarta hus syns. */
html[data-tema="mork"] .hus3dvy__scen {{
  background: radial-gradient(70% 60% at 50% 40%, rgba(255, 244, 228, 0.16), transparent 75%), rgba(255, 255, 255, 0.04);
}}

/* Övergången mellan teman: färgerna tonar i stället för att slå om. */
html.tema-byte,
html.tema-byte * {{
  transition: background-color 0.45s ease, color 0.45s ease, border-color 0.45s ease !important;
}}
{SLUT}
"""
css = css.rstrip("\r\n") + "\r\n" + block.replace("\n", "\r\n")
io.open("styles.css", "w", encoding="utf-8", newline="").write(css)
print("vita ytor:", len(vita), "glasytor:", len(glasiga))
