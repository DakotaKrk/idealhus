# -*- coding: utf-8 -*-
# Engangspatch 2026-09-23: fors in det som mallen (_bygg.py) fick i
# premiumlyftet i de tre sidorna som underhalls for hand - index,
# huskort och proffs. Kan koras igen utan att nagot dubbleras.
import io
import re

import _bygg as B

MOBIL_A = '        <a class="mobile-nav__cta" href="kontakt.html">Begär offert</a>'
MOBIL_B = ('        <a class="mobile-nav__tips" href="vad-far-jag-bygga.html">'
           '<span>Prova</span> Vad får jag bygga?</a>\n' + MOBIL_A)

FOT_A = '            <a href="attefallshus-regler.html">Attefallshus: reglerna</a>\n'
TEMA = ("    <script>try{var t=new URLSearchParams(location.search).get('tema')||"
        "localStorage.getItem('idealhus-tema');if(t==='mork')"
        "document.documentElement.setAttribute('data-tema','mork')}catch(e){}</script>")

FOT_B = FOT_A + '            <a href="vad-far-jag-bygga.html">Vad får jag bygga?</a>\n'
AGA_A = '            <a href="vad-far-jag-bygga.html">Vad får jag bygga?</a>\n          </nav>'
AGA_B = ('            <a href="vad-far-jag-bygga.html">Vad får jag bygga?</a>\n'
         '            <a href="aga-och-hyra-ut.html">Äga och hyra ut</a>\n          </nav>')



AKTIV = {"index.html": "Hem", "huskort.html": "Våra hus", "proffs.html": "Våra hus"}


def patcha(fil):
    s = io.open(fil, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"
    s = s.replace("\r\n", "\n")

    s = re.sub(r'(styles\.css|premium\.js)\?v=\w+', r'\1?v=' + B.CSS_V, s)

    # Menyn och sidfoten tas hela ur mallen (2026-09-24). Att lappa dem
    # rad för rad lämnade en dubbel länk i sidfoten och glömde
    # integritetslänken - nu kan de inte glida isär från undersidorna.
    a = s.index('    <a class="skip"')
    b = s.index('</header>') + len('</header>')
    s = s[:a] + B.header(AKTIV[fil]).rstrip('\n') + s[b:]
    a = s.index('    <footer class="site-footer">')
    b = s.index('</footer>') + len('</footer>')
    s = s[:a] + B.SIDFOT.rstrip('\n') + s[b:]

    if 'class="main-nav__tips"' not in s:
        start = s.index('id="undermeny-hus">')
        slut = s.index('            </div>\n          </div>', start)
        s = s[:slut] + B.TIPSKORT + '\n' + s[slut:]

    if 'class="mobile-nav__tips"' not in s:
        assert s.count(MOBIL_A) == 1, fil
        s = s.replace(MOBIL_A, MOBIL_B)

    # Temat sätts innan sidan ritas, annars blinkar den vit för den som
    # valt mörkt läge.
    if "idealhus-tema" not in s:
        s = re.sub(r'(    <script src="premium\.js\?v=\w+" defer></script>\n)',
                   lambda m: m.group(1) + TEMA + "\n", s, count=1)

    io.open(fil, "w", encoding="utf-8", newline="").write(s.replace("\n", nl))
    print(fil)


for fil in ("index.html", "huskort.html", "proffs.html"):
    patcha(fil)
