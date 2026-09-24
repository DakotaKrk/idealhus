# -*- coding: utf-8 -*-
"""Modellerna, pa ett stalle.

Korten pa kategorisidorna och huskortssidan visade samma sex namn men
levde i var sin fil: _sidor.py byggde korten, huskort.html bar en egen
liten tabell over fyra bilder som ingen lankade till. Nu star bade
korten och huskortet pa den har listan - _sidor.py laser den nar
kategorisidorna byggs, _huskort.py skriver in den i huskort.html.

Varje modell ar (namn, bild, boyta i m2, rum, leveransveckor).
Ordningen ar samma som pa sidan: modell 1 ar forst.
"""

# Bara de fem riktiga husen, ritade i ritningarna R1-R5 (2026-09-23).
# De påhittade modellerna och kategorierna fjällstugor och villor togs
# bort 2026-09-24 på kundens begäran. Boytan är räknad innanför
# ytterväggarna, utan loft, och rummen är de som ritningen namnger.
# Leveranstiden är fortfarande en platshållare.
KATEGORIER = {
    "attefallshus": ("Attefallshus", [
        ("Huskort 1", "hus-r2.webp", 26, 1, 10),       # R2: 8,33 x 3,49 m, sadeltak 30°
        ("Huskort 2", "hus-r1.webp", 27, 2, 10),       # R1: 7,14 x 4,20 m, sadeltak 24°
        ("Huskort 3", "hus-r5.webp", 27, 2, 12),       # R5: 7,50 x 4,00 m, pulpettak 2°
    ]),
    "fritidshus": ("Fritidshus", [
        ("Huskort 1", "hus-r3.webp", 38, 2, 12),       # R3: 10,83 x 3,90 m, takkupa
        ("Huskort 2", "hus-r4.webp", 45, 2, 14),       # R4: 12,50 x 3,90 m, takkupa
    ]),
}


def slug(fil):
    """attefallshus.html -> attefallshus"""
    return fil.rsplit(".", 1)[0]


def modeller(fil):
    return KATEGORIER[slug(fil)][1]
