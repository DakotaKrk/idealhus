# -*- coding: utf-8 -*-
"""Bygger ikonernas rasterformat ur images/legohus.svg. Kor: python _ikoner.py

SVG-ikonen ar redan inkopplad och racker for moderna webblasare. Tva
lagen nas inte av den:
  - /favicon.ico, som webblasare, botar och lasare fragar efter av gammal
    vana aven nar det finns en ikonlank, och som Safari fore 16 kraver.
  - apple-touch-icon, som iOS anvander nar nagon sparar sajten pa
    hemskarmen. Utan den tar iOS en skarmbild av sidan i stallet.

Bada ritas ur samma polygoner som SVG:en, sa market kan inte glida isar
mellan formaten.
"""
import io
import os
import re

from PIL import Image, ImageDraw

os.chdir(os.path.dirname(os.path.abspath(__file__)))

KALLA = "images/legohus.svg"
LOGO = "#82776b"      # --logo
SAND = "#f3f1ed"      # --sand

svg = io.open(KALLA, encoding="utf-8").read()
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
polygoner = [[float(v) for v in p.replace(",", " ").split()]
             for p in re.findall(r'<polygon[^>]*points="([^"]+)"', svg)]
assert polygoner, "hittade inga polygoner i " + KALLA
assert vb[2] == vb[3], "ikonens viewBox ar inte kvadratisk"


def rita(px, bakgrund=None, overprov=4):
    """Ritar market px x px. Pillow kantutjamnar inte polygoner, sa det
    ritas fyra ganger for stort och krymps med Lanczos."""
    s = px * overprov
    bild = Image.new("RGBA", (s, s), bakgrund or (0, 0, 0, 0))
    rit = ImageDraw.Draw(bild)
    for p in polygoner:
        rit.polygon([((p[i] - vb[0]) * s / vb[2], (p[i + 1] - vb[1]) * s / vb[3])
                     for i in range(0, len(p), 2)], fill=LOGO)
    return bild.resize((px, px), Image.LANCZOS)


rita(256).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("favicon.ico 16/32/48")

# iOS komponerar mot svart om ikonen ar genomskinlig - darfor en platta.
rita(180, bakgrund=SAND).convert("RGB").save("apple-touch-icon.png", optimize=True)
print("apple-touch-icon.png 180x180")
