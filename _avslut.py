# -*- coding: utf-8 -*-
"""Samma slut på alla sidor (2026-11-17), med startsidan som förebild.

Varje sida slutar med kontaktdelen "Låt oss börja med din plats" och
formuläret i två steg, följt av sidfoten. Allt har EN källa:

    _avslut.inc         kontaktdelen (markup, startsidans text)
    _avslutskript.inc   formulärets skript
    _bygg.SIDFOT        sidfoten

Skriptet stämplar in dem i de färdiga sidorna och körs SIST, efter alla
andra byggare. Det kan köras om hur många gånger som helst - det som
ligger mellan markeringarna byts mot källans, inget dubbleras.

    python _avslut.py           stämplar sidorna
    python _avslut.py --prova   visar bara vad som skulle ändras

Det som tas bort eftersom det gemensamma slutet säger samma sak:
  - sidans egen korta kontaktdel (.contact-section med länk till formuläret)
  - hussidornas "Vill du veta mer om ...?" (.nyhus-cta)
  - kontaktsidans egen kopia av formuläret (#forfragan)
Omdirigeringssidorna (utan sidfot) och rita-hus.html rörs inte;
rita-hus.html byggs utanför repot.
"""
import io
import os
import re
import sys

sys.dont_write_bytecode = True
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import _bygg as B  # noqa: E402

PROVA = "--prova" in sys.argv
HOPPA = {"rita-hus.html"}
# Byt när design.css eller premium.js ändras.
VERSION = "20261120a"

A0, A1 = "      <!-- avslut: gemensamt slut, se _avslut.py -->\n", "      <!-- /avslut -->\n"
S0, S1 = "    <!-- avslutskript, se _avslut.py -->\n", "    <!-- /avslutskript -->\n"


def las(fil):
    return io.open(fil, encoding="utf-8", newline="").read()


AVSLUT = A0 + las("_avslut.inc").replace("\r\n", "\n") + A1
SKRIPT = S0 + "    <script>\n" + las("_avslutskript.inc").replace("\r\n", "\n") + "    </script>\n" + S1

SEKTION = r'      <section class="%s\b[^>]*>\n.*?\n      </section>\n'


def stampla(fil):
    ra = las(fil)
    nl = "\r\n" if "\r\n" in ra else "\n"
    s = ra.replace("\r\n", "\n")
    if '<footer class="site-footer">' not in s or "    </main>\n" not in s:
        return None

    # 1. Kontaktdelen sist i <main>.
    if A0 in s:
        a, b = s.index(A0), s.index(A1) + len(A1)
        s = s[:a] + AVSLUT + s[b:]
    else:
        m = re.search(SEKTION % "contact-section", s, flags=re.S)
        if m:
            assert m.group(0).count("<section") == 1, fil
            s = s[:m.start()] + AVSLUT + s[m.end():]
        else:
            a = s.index("    </main>\n")
            s = s[:a].rstrip("\n") + "\n\n" + AVSLUT + s[a:]
    # Hussidornas egen uppmaning säger samma sak som slutet.
    s = re.sub(SEKTION % "nyhus-cta" + r"\n?", "", s, count=1, flags=re.S)

    # 2. Sidfoten ur mallen.
    a = s.index('    <footer class="site-footer">')
    b = s.index("</footer>", a) + len("</footer>\n")
    s = s[:a] + B.SIDFOT + s[b:]
    if fil == "kontakt.html":
        # Sidfotens knapp ska inte ladda om sidan man redan står på.
        s = s.replace('<a class="site-footer__button" href="kontakt.html">',
                      '<a class="site-footer__button" href="#kontaktformular">', 1)

    # 2b. "Rita ditt hus" bland guiderna i menyn och mobilmenyn (2026-11-17).
    for klass in ("main-nav__guider", "mmeny__guider"):
        m = re.search(r'<p class="%s">.*?</p>' % klass, s)
        if m and 'href="rita-hus.html"' not in m.group(0):
            s = s[:m.end() - 4] + '<a href="rita-hus.html">Rita ditt hus</a>' + s[m.end() - 4:]

    # 2c. Ny version på det som ändrats, så ingen sitter kvar med gammal cache.
    s = re.sub(r'(design\.css|premium\.js)\?v=\w+', r'\1?v=' + VERSION, s)

    # 3. Formulärets skript: en gång, sist före </body>. Den gamla kopian
    #    inne i startsidans och kontaktsidans skript tas bort.
    forst = s.find(S0) if S0 in s else len(s)
    a = s.find("      var FORM_ENDPOINT = '';\n")
    if 0 <= a < forst:
        k = s.find("      // Kontaktformularet.\n")
        if 0 <= k < a:
            a = k
        b = s.index("      })();\n", s.index("fetch(FORM_ENDPOINT", a)) + len("      })();\n")
        s = s[:a].rstrip("\n") + "\n" + s[b:]
    if S0 in s:
        a, b = s.index(S0), s.index(S1) + len(S1)
        s = s[:a] + SKRIPT + s[b:]
    else:
        a = s.rindex("  </body>")
        s = s[:a] + SKRIPT + s[a:]

    ut = s.replace("\n", nl)
    if ut != ra and not PROVA:
        io.open(fil, "w", encoding="utf-8", newline="").write(ut)
    return ut != ra


for fil in sorted(f for f in os.listdir(".") if f.endswith(".html") and f not in HOPPA):
    andrad = stampla(fil)
    if andrad is None:
        print("hoppar över", fil)
    elif andrad:
        print("skulle ändra" if PROVA else "stämplad", fil)
