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

# Modellerna med bild hus-r*.webp är riktiga hus, ritade i ritningarna
# R1-R5 (2026-09-23). Boytan är räknad innanför ytterväggarna, utan loft,
# och rummen är de som ritningen namnger. Leveranstiden är fortfarande
# platshållare som de övriga.
KATEGORIER = {
    "attefallshus": ("Attefallshus", [
        ("Huskort 1", "hus-r2.webp", 26, 1, 10),       # R2: 8,33 x 3,49 m, sadeltak 30°
        ("Huskort 2", "hus-r1.webp", 27, 2, 10),       # R1: 7,14 x 4,20 m, sadeltak 24°
        ("Huskort 3", "hus-r5.webp", 27, 2, 12),       # R5: 7,50 x 4,00 m, pulpettak 2°
        ("Huskort 4", "generated-house-garden-01.webp", 30, 2, 12),
        ("Huskort 5", "generated-category-attefallshus-02.webp", 30, 2, 14),
        ("Huskort 6", "generated-house-winter-01.webp", 30, 3, 14),
    ]),
    "fritidshus": ("Fritidshus", [
        ("Huskort 1", "hus-r3.webp", 38, 2, 12),       # R3: 10,83 x 3,90 m, takkupa
        ("Huskort 2", "hus-r4.webp", 45, 2, 14),       # R4: 12,50 x 3,90 m, takkupa
        ("Huskort 3", "generated-house-coast-01.webp", 62, 3, 14),
        ("Huskort 4", "generated-house-garden-01.webp", 70, 4, 16),
        ("Huskort 5", "generated-house-meadow-01.webp", 78, 4, 16),
        ("Huskort 6", "generated-house-gabled-01.webp", 85, 4, 18),
    ]),
    "fjallstugor": ("Fjällstugor", [
        ("Huskort 1", "generated-category-fjallstuga-card.webp", 38, 2, 14),
        ("Huskort 2", "generated-house-winter-01.webp", 48, 2, 14),
        ("Huskort 3", "generated-category-fjallstuga-01.webp", 56, 3, 16),
        ("Huskort 4", "generated-house-forest-01.webp", 64, 3, 16),
        ("Huskort 5", "generated-house-gabled-01.webp", 72, 4, 18),
        ("Huskort 6", "generated-house-coast-01.webp", 80, 4, 18),
    ]),
    "villor": ("Villor", [
        ("Huskort 1", "generated-house-gabled-01.webp", 95, 4, 20),
        ("Huskort 2", "generated-house-garden-01.webp", 110, 5, 20),
        ("Huskort 3", "generated-house-meadow-01.webp", 125, 5, 22),
        ("Huskort 4", "generated-house-coast-01.webp", 140, 6, 22),
        ("Huskort 5", "generated-house-forest-01.webp", 155, 6, 24),
        ("Huskort 6", "generated-house-winter-01.webp", 170, 7, 24),
    ]),
}


def slug(fil):
    """attefallshus.html -> attefallshus"""
    return fil.rsplit(".", 1)[0]


def modeller(fil):
    return KATEGORIER[slug(fil)][1]
