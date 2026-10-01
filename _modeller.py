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
# Boytorna 30/30/30/40/50 m² är kundens besked 2026-10-05; namnen behölls.
# Namnen (2026-09-30) beskriver taket och boytan - "Huskort 1" läste som
# en platshållare. Byt här om kunden ger modellerna egna namn.
KATEGORIER = {
    "attefallshus": ("Attefallshus", [
        ("Sadel 30", "hus-r2.webp", 30, 1, 10),       # R2: 8,33 x 3,49 m, sadeltak 30°
        ("Sadel 30 Bred", "hus-r1.webp", 30, 2, 10),       # R1: 7,14 x 4,20 m, sadeltak 24°
        ("Pulpet 30", "hus-r5.webp", 30, 2, 12),       # R5: 7,50 x 4,00 m, pulpettak 2°
    ]),
    "fritidshus": ("Fritidshus", [
        ("Kupa 40", "hus-r3.webp", 40, 2, 12),       # R3: 10,83 x 3,90 m, takkupa
        ("Kupa 50", "hus-r4.webp", 50, 2, 14),       # R4: 12,50 x 3,90 m, takkupa
    ]),
}

# Yttermått och nockhöjd i meter ur ritningarna (längd, bredd, nock), per
# bild. Samma tal som MATT3D i premium.js och modellerna i modeller/.
MATT = {
    "hus-r1.webp": (7.14, 4.20, 4.00),
    "hus-r2.webp": (8.33, 3.49, 4.00),
    "hus-r3.webp": (10.83, 3.90, 4.35),
    "hus-r4.webp": (12.50, 3.90, 4.05),
    "hus-r5.webp": (7.50, 4.00, 4.00),
}


# Taket per modell, som det står i ritningarna (huskortets faktarad).
TAK = {
    "Sadel 30": "Sadeltak",
    "Sadel 30 Bred": "Sadeltak",
    "Pulpet 30": "Pulpettak",
    "Kupa 40": "Med takkupa",
    "Kupa 50": "Med takkupa",
}


# Två stycken per modell till huskortssidan (2026-09-30). Bara det
# ritningarna säger: yta, rum, tak och yttermått.
GEMENSAMT = ("Huset byggs under tak i Sverige och kommer i färdiga delar till "
             "tomten, där montaget tar dagar i stället för månader. Planlösning, "
             "fasad och kulörer bestäms tillsammans i offerten.")
BESKRIVNING = {
    "Sadel 30": ("Ett rum på 30 m² under ett brant sadeltak. Den smala formen, "
                 "8,33 × 3,49 meter, gör att huset får plats längs en häck eller "
                 "en tomtgräns - som gästhus, ateljé eller för uthyrning."),
    "Sadel 30 Bred": ("Två rum på 30 m² under ett sadeltak. Den bredare formen, "
                 "7,14 × 4,20 meter, ger plats för ett sovrum och ett allrum - "
                 "ett litet hus som går att bo i på riktigt."),
    "Pulpet 30": ("Två rum på 30 m² under ett nästan platt pulpettak. Formen, "
                  "7,50 × 4,00 meter, och de stora glaspartierna ger ett modernt "
                  "hus med mycket ljus."),
    "Kupa 40": ("Ett fritidshus på 40 m² med takkupa, 10,83 × 3,90 meter. Två rum "
                "och extra takhöjd under kupan, för helger, lov och långa somrar. "
                "Huset kräver bygglov."),
    "Kupa 50": ("Vårt största hus: 50 m² med takkupa, 12,50 × 3,90 meter. Två rum "
                "och plats för både vardag och gäster. Huset kräver bygglov."),
}


def slug(fil):
    """attefallshus.html -> attefallshus"""
    return fil.rsplit(".", 1)[0]


def modeller(fil):
    return KATEGORIER[slug(fil)][1]
