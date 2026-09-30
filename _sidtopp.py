# -*- coding: utf-8 -*-
"""Lägger in etiketten över rubriken och kantljuset i undersidornas toppar.

Körs SIST i bygget, efter alla sidgeneratorer och _premium.py (2026-09-30).
Topparna skrivs av flera olika generatorer och två handsidor - i stället
för att lappa varje mall läggs de gemensamma bitarna in här. Kan köras
om hur många gånger som helst: det som redan finns läggs inte in igen.
"""
import io
import os
import re

os.chdir(os.path.dirname(os.path.abspath(__file__)))

ETIKETT = {
    "attefallshus.html": "Våra hus · För dig som ska bo",
    "fritidshus.html": "Våra hus · För dig som ska bo",
    "proffs.html": "Våra hus · För dig som bygger",
    "huskort.html": "Husmodell",
    "priser.html": "Priser och offert",
    "sa-fungerar-det.html": "Processen",
    "om-oss.html": "Om Idealhus",
    "kontakt.html": "Kontakt",
    "aga-och-hyra-ut.html": "Verktyg för ägare",
}

KANT = '<span class="ih-kant" aria-hidden="true"></span>'
TOPPAR = r'(<section class="(?:subpage-hero|kollen-topp|guidehero|guide-topp|fyrafyra)\b[^"]*">)'

for fil in sorted(f for f in os.listdir(".") if f.endswith(".html")):
    s = io.open(fil, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    s = s.replace("\r\n", "\n")
    fore = s

    # Kantljuset direkt efter toppens öppningstagg.
    s = re.sub(TOPPAR + r'\n(?!\s*<span class="ih-kant")',
               lambda m: m.group(1) + "\n        " + KANT + "\n", s, count=1)

    # Etiketten före rubriken.
    etikett = ETIKETT.get(fil)
    if etikett and 'class="ih-etikett ih-etikett--ljus sidtopp__etikett"' not in s:
        s = re.sub(r'(\s*)(<h1 class="subpage-hero__title")',
                   lambda m: m.group(1) + '<p class="ih-etikett ih-etikett--ljus sidtopp__etikett">'
                   + etikett + '</p>' + m.group(1) + m.group(2), s, count=1)

    # De svävande etiketterna flyttas in i textspalten, under knapparna.
    # Som egen ruta över bilden täckte de skylten, och i vänsterspalten
    # hamnade de över knapparna när ingressen blev längre.
    m = re.search(r'\n        <div class="heroscen heroscen--kategori" aria-hidden="true">\n.*?\n        </div>(?=\n)',
                  s, flags=re.S)
    if m and '<section class="subpage-hero' in s[:m.start()] and 'heroscen--inne' not in s:
        block = m.group(0)
        s = s[:m.start()] + s[m.end():]
        inne = block.replace('class="heroscen heroscen--kategori"', 'class="heroscen heroscen--kategori heroscen--inne"')
        inne = "\n".join(("    " + r) if r.strip() else r for r in inne.split("\n"))
        slut = s.index('\n          </div>\n        </div>', s.index('<div class="subpage-hero__content">'))
        s = s[:slut] + inne + s[slut:]

    if s != fore:
        io.open(fil, "w", encoding="utf-8", newline="").write(s.replace("\n", nl))
        print(fil)
