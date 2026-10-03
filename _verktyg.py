# -*- coding: utf-8 -*-
# Bygger vad-far-jag-bygga.html. Kor: python _verktyg.py
#
# Idén kommer fran Kasters tidskalkylator: ett verktyg dar besokaren
# svarar pa nagra fragor och far ett svar som galler just hen, i
# stallet for en regeltext att tolka sjalv. Svaret ritas som ringmatare.
#
# Reglerna ar desamma som i guiden (_guidetext.py) - andras de dar ska
# de andras har ocksa. Kontrollerade mot kommunernas egna sidor
# 2026-09-08 (regelandringen 1 december 2025).
import io
import json
import re

import _bygg as B
import _modeller as M

REGLER = {
    # per byggnad, sammanlagt, nockhojd
    "inom": (30, 45, "4,0"),
    "utanfor": (50, 65, "4,5"),
}

# Modellerna som JSON, sa sidan kan visa vilka hus som ryms. Samma
# lista som korten och huskortet bygger pa - de kan inte glida isar.
MODELLER = [
    {"typ": typ, "kategori": namn, "nr": i, "namn": titel, "sida": M.SIDA[titel],
     "bild": bild, "yta": yta, "rum": rum}
    for typ, (namn, lista) in M.KATEGORIER.items()
    for i, (titel, bild, yta, rum, lev) in enumerate(lista, 1)
]


# Husen som ryms i standardläget (inom detaljplan, inget befintligt på
# tomten: 30 m²) står i HTML från början, så att korten och länkarna till
# modellsidorna finns även utan JavaScript (2026-10-03). Samma HTML som
# husKort() i skriptet ger, och satt() byter dem bara om svaren skiljer sig.
def hus_kort(m, i, ok):
    med3d = re.fullmatch(r"hus-r\d\.webp", m["bild"]) is not None
    if med3d:
        liten = "images/" + m["bild"].replace(".webp", "-800.webp")
        bild = (f'src="{liten}" srcset="{liten} 800w, images/{m["bild"]} 1600w"'
                ' sizes="(max-width: 700px) 92vw, 320px"')
    else:
        bild = f'src="images/{m["bild"]}"'
    lov = "" if ok else " tvhus--lov"
    ankare = "#i-3d" if med3d else ""
    ryms = "Ryms" if ok else "Kräver bygglov"
    tre_d = '<span class="tvhus__3d">Se i 3D</span>' if med3d else ""
    return (f'<a class="tvhus{lov}" style="--i:{i}" href="{m["sida"]}{ankare}">'
            f'<span class="tvhus__bild"><img {bild} alt="" loading="lazy" decoding="async">'
            f'<span class="tvhus__ryms">{ryms}</span>{tre_d}</span>'
            f'<span class="tvhus__kropp"><span class="tvhus__typ">{m["kategori"]}</span>'
            f'<strong>{m["namn"]}</strong>'
            f'<span class="tvhus__fakta"><b>{m["yta"]} m²</b><i></i>{m["rum"]} rum</span>'
            f'<span class="tvhus__pil" aria-hidden="true"></span></span></a>')


STANDARD_YTA = REGLER["inom"][0]
_RYMS = sorted((m for m in MODELLER if m["yta"] <= STANDARD_YTA), key=lambda m: -m["yta"])
_INTE = sorted((m for m in MODELLER if m["yta"] > STANDARD_YTA), key=lambda m: m["yta"])
FORRENDERAD = ("".join(hus_kort(m, i, True) for i, m in enumerate(_RYMS))
               + "".join(hus_kort(m, len(_RYMS) + i, False) for i, m in enumerate(_INTE)))
HUS_RUBRIK = f"{len(_RYMS)} {'modell' if len(_RYMS) == 1 else 'modeller'} upp till {STANDARD_YTA} m²"


# Öppna kartor och tjänster för att se vad som finns under marken.
# Adresserna kontrollerade 2026-09-23.
MARKKOLL = [
    ("Tomtgränsen", "Lantmäteriet · Min karta", "https://minkarta.lantmateriet.se/",
     "M4 20 9 4l6 16 5-12M4 20h16",
     "Se var fastighetsgränsen går och mät avståndet till grannen – 4,5 meter är gränsen utan medgivande."),
    ("Jordarter", "SGU · Kartvisaren", "https://apps.sgu.se/kartvisare/kartvisare-jordarter-25-100.html",
     "M3 9h18M3 14h18M3 19h18M7 4l2 5M14 4l-1 5",
     "Visar om marken är berg, lera, sand eller morän. Det styr vilken grund som passar och hur mycket som ska grävas."),
    ("Djup till berg", "SGU · Kartvisaren", "https://apps.sgu.se/kartvisare/kartvisare-jorddjup.html",
     "M12 3v14M7 12l5 5 5-5M4 21h16",
     "Ungefär hur djupt det är ned till berget. Grunt berg kan betyda plintar direkt på berget – eller sprängning."),
    ("Ledningar i marken", "Ledningskollen", "https://www.ledningskollen.se/",
     "M3 12h4l2-5 3 10 2-5h7",
     "Gratis: ledningsägarna svarar med var el, fiber, vatten och avlopp går under tomten. Gör det innan grunden grävs."),
]


# Tomtrapporten: vad jordarten brukar betyda för grunden. Första
# mönstret som passar SGU:s jordartsnamn vinner, så ordningen spelar
# roll - lerig morän ska inte landa i ren morän. Hållet allmänt och
# försiktigt; en geoteknisk bedömning på plats har sista ordet.
JORDTOLKNING = [
    ("torv|gyttja|dy\\b|kärr|mosse",
     "Torv och gyttja är lösa jordar som trycks ihop under last. Grunden "
     "behöver oftast gå ned till fast botten, och en geoteknisk "
     "undersökning behövs."),
    ("fyllning",
     "Påfylld mark, vanlig i tätorter. Vad fyllningen består av varierar, "
     "så bärigheten behöver kontrolleras på plats."),
    ("morän.*(ler|silt)|(ler|silt).*morän",
     "Morän med mycket lera eller silt. Den bär oftast bra men tjälar "
     "lätt, så grunden behöver isoleras mot tjäle."),
    ("lera|silt",
     "Lera och silt bär sämre och kan sätta sig. De tjälar också lätt, "
     "det vill säga fryser och lyfter på vintern. Platta på mark brukar "
     "fungera med tjälisolering runt om – på djup lera kan en geoteknisk "
     "bedömning behövas."),
    ("morän",
     "Morän är en blandning av sten, grus, sand och finare jord. Den bär "
     "oftast bra, och både platta och plintar brukar fungera."),
    ("sand|grus|isälv|svall|rullsten",
     "Sand och grus bär bra, släpper igenom vatten och tjälar sällan. En "
     "av de enklaste markerna att bygga på."),
    ("berg|häll",
     "Berget ligger i eller nära ytan. Huset kan stå på plintar som "
     "förankras i berget, men ledningar i marken kan kräva sprängning."),
    ("block|sten",
     "Stenig och blockig mark. Den bär bra men är tung att gräva i."),
    ("vatten",
     "Enligt kartan ligger punkten i vatten. Flytta nålen till tomten."),
]

# Ritningen av marken: vilket material ett jordartsnamn från SGU ritas
# som. Samma ordning som JORDTOLKNING, så lerig morän inte blir ren morän
# och lera inte blir berg. "Okand" ritas utan material.
JORDBILD = [
    ("torv|gyttja|dy\\b|kärr|mosse", "torv"),
    ("fyllning", "fyllning"),
    ("morän.*(ler|silt)|(ler|silt).*morän", "moranlera"),
    ("lera|ler\\b|ler-", "lera"),
    ("silt", "silt"),
    ("morän", "moran"),
    ("grus|rullsten", "grus"),
    ("sand|isälv|svall", "sand"),
    ("berg|häll", "berg"),
    ("block|sten", "block"),
    ("vatten", "vatten"),
]

GENOMSLAPP = {
    "3": "Regnvatten sjunker snabbt undan i marken.",
    "2": "Vatten sjunker undan i måttlig takt.",
    "1": "Vatten sjunker långsamt undan, så det är viktigt att dränera "
         "runt grunden.",
}


def val(nr, namn, rubrik, alternativ, hjalp=""):
    rader = "\n".join(
        f'''              <label class="tv__alt">
                <input type="radio" name="{namn}" value="{v}"{" checked" if i == 0 else ""}>
                <span>{t}</span>
              </label>''' for i, (v, t) in enumerate(alternativ))
    h = f'\n            <p class="tv__hjalp">{hjalp}</p>' if hjalp else ""
    return f'''          <fieldset class="tv__fraga">
            <legend><span class="tv__nr" aria-hidden="true">0{nr}</span>{rubrik}</legend>{h}
            <div class="tv__val">
{rader}
            </div>
          </fieldset>'''


FORMULAR = "\n\n".join([
    val(1, "plan", "Ligger tomten inom detaljplan?",
        [("inom", "Inom detaljplan"), ("utanfor", "Utanför detaljplan"),
         ("vetej", "Vet inte")],
        "Det syns i kommunens karta över detaljplaner – eller fråga "
        "bygglovsenheten. Är du osäker räknar vi med det strängare."),
    f'''          <fieldset class="tv__fraga">
            <legend><span class="tv__nr" aria-hidden="true">02</span>Hur mycket komplementbyggnad finns redan på tomten?</legend>
            <p class="tv__hjalp">Attefallshus, friggebodar och andra lovbefriade byggnader, sammanlagt.</p>
            <div class="tv__reglage">
              <input type="range" id="befintligt" name="befintligt" min="0" max="65" step="1" value="0" aria-label="Befintlig komplementbyggnad på tomten, i kvadratmeter" aria-describedby="befintligt-varde">
              <output id="befintligt-varde" for="befintligt">0 m²</output>
            </div>
          </fieldset>''',
    val(3, "grans", "Hur nära tomtgränsen ska huset stå?",
        [("langt", "4,5 m eller mer"), ("medgivande", "Närmare, grannen har sagt ja"),
         ("nara", "Närmare, utan medgivande")]),
    val(4, "bo", "Ska huset ha kök, badrum eller eldstad?",
        [("ja", "Ja, det ska gå att bo i"), ("nej", "Nej, gäststuga, kontor eller förråd")]),
    val(5, "vatten", "Ligger tomten nära vatten?",
        [("nej", "Nej"), ("ja", "Ja, inom 100 m från stranden"), ("vetej", "Vet inte")]),
])

KROPP = f'''    <main id="innehall">
      <section class="kollen-topp glod vf-topp">
        <span class="ih-kant" aria-hidden="true"></span>
        <div class="kollen-topp__inner vf-topp__inner">
          <div class="vf-topp__text">
            <p class="section-label section-label--accent">Verktyg</p>
            <h1 class="kollen-topp__titel">Vad får jag <em class="skimmer">bygga</em> på min tomt?</h1>
            <p class="kollen-topp__text">
              Fem frågor om tomten. Sedan ser du hur stort hus som ryms utan
              bygglov, hur högt det får bli och vad kommunen behöver veta –
              medan tomten ritas upp.
            </p>
            <div class="vf-topp__knappar">
              <a class="ih-knapp ih-knapp--virke" href="#rakna">Börja räkna<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
              <a class="ih-knapp ih-knapp--kontur" href="#kolla-marken">Kolla marken</a>
            </div>
            <ul class="kollen-topp__fakta">
              <li><b>5</b> frågor</li>
              <li><b>Under 1</b> minut</li>
              <li><b>Svar</b> direkt</li>
            </ul>
          </div>
          <div class="vf3d vf3d--hus" data-vf3d="hus" aria-hidden="true">
            <svg class="vf3d__svg" viewBox="0 0 600 450" focusable="false">
              <defs>
                <linearGradient id="vfh-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfdaa3"/><stop offset="1" stop-color="#8db676"/></linearGradient>
                <linearGradient id="vfh-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4dc"/><stop offset=".55" stop-color="#f7cf93"/><stop offset="1" stop-color="#e3a35a"/></linearGradient>
                <radialGradient id="vfh-krona" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#a2c88a"/><stop offset="1" stop-color="#5f9064"/></radialGradient>
                <radialGradient id="vfh-golv"><stop offset="0" stop-color="#5a3c1e" stop-opacity=".3"/><stop offset="1" stop-color="#5a3c1e" stop-opacity="0"/></radialGradient>
                <filter id="vfh-mjuk" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
              </defs>
              <ellipse class="vf3d__golv" cx="300" cy="396" rx="268" ry="42" fill="url(#vfh-golv)"/>
              <g class="vf3d__varld"></g>
            </svg>
            <span class="vf3d__chip vf3d__chip--upp vf3d__chip--mork" data-chip="yta"><span class="vf3d__chip-in"><i></i><b>30 m²</b><em>byggarea</em></span></span>
            <span class="vf3d__chip vf3d__chip--vanster vf3d__chip--brun" data-chip="hojd"><span class="vf3d__chip-in"><i></i><b>4,0 m</b><em>nockhöjd</em></span></span>
            <span class="vf3d__chip vf3d__chip--ner vf3d__chip--gron" data-chip="avstand"><span class="vf3d__chip-in"><i></i><b>4,5 m</b><em>till gränsen</em></span></span>
            <p class="vf3d__tips"><svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 13a7.5 7.5 0 0 1 13.2-4.9M19.5 11a7.5 7.5 0 0 1-13.2 4.9M18 4.5v4h-4M6 19.5v-4h4"/></svg>Dra för att vrida</p>
          </div>
        </div>
      </section>

      <section class="tv" id="rakna" aria-label="Räkna på din tomt">
        <div class="tv__inre">
          <form class="tv__form" id="kollen" aria-label="Frågor om tomten">
{FORMULAR}
          </form>

          <div class="tv__hoger">
            <div class="tv__scen" aria-hidden="true">
              <span class="ih-kant"></span>
              <p class="tv__skylt" id="tv-skylt">Inom detaljplan</p>
              <svg class="tv__svg" id="tv-svg" viewBox="0 0 600 400" focusable="false"></svg>
              <p class="tv__forklaring"><i class="tv__prick tv__prick--nytt"></i>Nytt hus<i class="tv__prick tv__prick--bostad"></i>Bostadshus<i class="tv__prick tv__prick--fanns"></i>Befintligt<i class="tv__prick tv__prick--grans"></i>Tomtgräns</p>
            </div>

            <aside class="tv__svar" id="tv-svar" aria-live="polite">
              <p class="tv__summa" id="svar-summa"></p>
              <p class="kollen__valt" id="svar-valt" hidden></p>
              <div class="tv__tal">
                <div class="tv__talkort">
                  <p><strong id="svar-yta">30</strong><small>m²</small></p>
                  <span>största nya hus</span>
                  <div class="tv__ytbar" aria-hidden="true"><i class="tv__ytdel tv__ytdel--fanns" id="yta-fanns"></i><i class="tv__ytdel tv__ytdel--nytt" id="yta-nytt"></i><i class="tv__ytdel tv__ytdel--kvar" id="yta-kvar"></i></div>
                  <p class="tv__talinfo" id="svar-ytinfo"></p>
                </div>
                <div class="tv__talkort">
                  <p><strong id="svar-hojd">4,0</strong><small>m</small></p>
                  <span>högsta nockhöjd</span>
                  <svg class="tv__nock" id="svar-nock" viewBox="0 0 132 56" aria-hidden="true" focusable="false">
                    <line class="tv__nock-mark" x1="6" y1="50.5" x2="126" y2="50.5"/>
                    <g class="tv__nock-hus">
                      <path class="tv__nock-kropp" d="M30 50V27L52 10l22 17v23Z"/>
                      <path class="tv__nock-tak" d="M26 30 52 9.5 78 30"/>
                      <rect class="tv__nock-fonster" x="36" y="33" width="10" height="9" rx="1"/>
                      <rect class="tv__nock-dorr" x="56" y="34" width="8" height="16" rx="1"/>
                      <line class="tv__nock-streck" x1="54" y1="10" x2="96" y2="10"/>
                      <line class="tv__nock-matt" x1="92" y1="10" x2="92" y2="50"/>
                      <line class="tv__nock-matt" x1="87" y1="10" x2="97" y2="10"/>
                      <line class="tv__nock-matt" x1="87" y1="50" x2="97" y2="50"/>
                    </g>
                  </svg>
                  <p class="tv__talinfo" id="svar-hojdinfo"></p>
                </div>
              </div>

              <ul class="tv__status" id="svar-status" aria-label="Det här gäller"></ul>
              <a class="tv__ryms" id="svar-ryms" href="#husen"></a>

              <ul class="tv__lista" id="svar-lista"></ul>

              <div class="tv__knappar">
                <button class="kollen__dela" type="button" id="svar-dela">Kopiera länk till svaret</button>
                <button class="kollen__dela kollen__pdf" type="button" data-skriv-ut>Spara som PDF</button>
              </div>

              <p class="tv__friskrivning">
                Vägledning, inte ett beslut. Detaljplanen och kommunen har
                sista ordet. <a href="attefallshus-regler.html">Läs guiden om reglerna</a>
              </p>
            </aside>
          </div>

          <aside class="tv__regler" id="tv-regler" data-vald="inom" aria-label="Reglerna som verktyget räknar med">
            <p class="tv__regler-rubrik"><span class="tv__regler-ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 19.5h16M6.5 19.5V9.8L12 5l5.5 4.8v9.7M10 19.5v-5h4v5"/></svg></span>Så räknar vi</p>
            <table class="tv__regeltabell">
              <thead>
                <tr><td></td><th scope="col" data-plan="inom">Inom detaljplan</th><th scope="col" data-plan="utanfor">Utanför</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Största nya hus</th><td data-plan="inom">30 m²</td><td data-plan="utanfor">50 m²</td></tr>
                <tr><th scope="row">Utan lov sammanlagt</th><td data-plan="inom">45 m²</td><td data-plan="utanfor">65 m²</td></tr>
                <tr><th scope="row">Högsta nockhöjd</th><td data-plan="inom">4,0 m</td><td data-plan="utanfor">4,5 m</td></tr>
                <tr><th scope="row">Till tomtgränsen</th><td data-plan="inom">4,5 m</td><td data-plan="utanfor">4,5 m</td></tr>
              </tbody>
            </table>
            <p class="tv__regler-not">Närmare gränsen går med grannens medgivande. Måtten är kontrollerade den 2 oktober 2026 mot <a href="https://www.boverket.se/sv/PBL-kunskapsbanken/lov--byggande/anmalningsplikt/byggnader/nybyggnad/komplementbyggnad/" target="_blank" rel="noopener">Boverkets vägledning</a>. <a href="attefallshus-regler.html">Läs guiden om reglerna</a></p>
          </aside>
        </div>
      </section>

      <section class="kollen-hus" id="husen">
        <div class="kollen-hus__inner">
          <div class="kollen-hus__topp">
            <p class="section-label section-label--accent">Hus som ryms</p>
            <h2 class="kollen-hus__titel" id="hus-rubrik">{HUS_RUBRIK}</h2>
          </div>
          <div class="tvhus-rad" id="hus-lista" data-forrenderad>{FORRENDERAD}</div>
          <p class="kollen-hus__tomt" id="hus-tomt" hidden>
            Inget av våra hus ryms utan bygglov med de här svaren. Med
            bygglov kan det bli större –
            <a href="fritidshus.html">se fritidshusen</a> eller
            <a href="kontakt.html">prata med oss</a>.
          </p>
        </div>
      </section>

      <section class="markkoll" id="kolla-marken">
        <div class="markkoll__inner">
          <div class="markkoll__topp">
            <p class="section-label section-label--accent">Kolla din mark</p>
            <h2 class="markkoll__titel">Vad finns <em>under gräset</em>?</h2>
            <p class="markkoll__text">
              Det som ligger under marken avgör grunden och markarbetet – och
              är det som oftast överraskar. Skriv tomtens adress, så hämtar vi
              vad Sveriges geologiska undersökning (SGU) vet om marken just där.
            </p>
          </div>

          <div class="markkoll__scen">
          <div class="tomtrapport" id="tomtrapport">
            <form class="marksok" id="marksok" role="search" aria-label="Sök tomtens adress" novalidate>
              <label class="marksok__etikett" for="marksok-adress">Tomtens adress</label>
              <div class="marksok__rad">
                <input id="marksok-adress" name="adress" type="text" autocomplete="street-address" placeholder="T.ex. Storgatan 12, Umeå" aria-describedby="marksok-status">
                <button class="marksok__knapp" type="submit">Kolla marken</button>
              </div>
              <button class="marksok__plats" type="button" id="marksok-plats" hidden>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>
                Använd min position
              </button>
              <p class="marksok__status" id="marksok-status" role="status"></p>
            </form>
            <ul class="marksok__far" aria-label="Det här får du veta">
              <li><span class="marksok__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 9h18M3 14h18M3 19h18M7 4l2 5M14 4l-1 5"/></svg></span><span><strong>Jordart</strong>Berg, lera, sand eller morän</span></li>
              <li><span class="marksok__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3c3 4.2 5.5 7.4 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 10.4 9 7.2 12 3Z"/></svg></span><span><strong>Vatten i marken</strong>Hur fort regnet sjunker undan</span></li>
              <li><span class="marksok__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3v14M7 12l5 5 5-5M4 21h16"/></svg></span><span><strong>Djup till berg</strong>Ungefär hur långt ned berget ligger</span></li>
            </ul>

            <div class="tomtrapport__vy" id="tomtrapport-vy" hidden>
              <section class="tomtskarning" id="tomt-skarning" aria-labelledby="tomt-plats">
                <header class="tomtskarning__huvud">
                  <div class="tomtskarning__titel">
                    <p class="tomtskarning__etikett">Din mark i genomskärning</p>
                    <p class="tomtrapport__plats" id="tomt-plats"></p>
                    <p class="tomtskarning__text" id="tomtskarning-text" aria-live="polite"></p>
                  </div>
                  <ul class="tomtskarning__kallor" aria-label="Underlag">
                    <li><i aria-hidden="true"></i>SGU · jordartskarta</li>
                    <li><i aria-hidden="true"></i>SGU · jorddjup 10 × 10 m</li>
                    <li><i aria-hidden="true"></i>Öppna data</li>
                  </ul>
                </header>
                <div class="tomtskarning__kropp">
                  <div class="tomtskarning__bild" id="tomtskarning-bild">
                    <p class="tomtskarning__laddar" aria-hidden="true"><i></i>Läser av marken …</p>
                  </div>
                  <div class="tomtskarning__fakta">
                    <div class="tomtfakta">
                      <span class="tomtfakta__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 9h18M3 14h18M3 19h18M7 4l2 5M14 4l-1 5"/></svg></span>
                      <div class="tomtfakta__innehall" id="tomt-jord"></div>
                    </div>
                    <div class="tomtfakta">
                      <span class="tomtfakta__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3c3 4.2 5.5 7.4 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 10.4 9 7.2 12 3Z"/></svg></span>
                      <div class="tomtfakta__innehall" id="tomt-vatten"></div>
                    </div>
                    <div class="tomtfakta">
                      <span class="tomtfakta__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3v14M7 12l5 5 5-5M4 21h16"/></svg></span>
                      <div class="tomtfakta__innehall" id="tomt-djup"></div>
                    </div>
                    <div class="tomtrapport__knappar">
                      <button class="kollen__dela kollen__pdf" type="button" data-skriv-ut>Spara tomtrapporten som PDF</button>
                      <a class="tomtrapport__prata" href="#kontakt">Fråga oss vad det betyder</a>
                    </div>
                  </div>
                </div>
                <ul class="tomtskarning__noter">
                  <li><span class="tomtskarning__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg></span><span>Ritad för just den här punkten. Kartan visar det översta jordlagret, modellen djupet till berg.</span></li>
                  <li data-not="skala" hidden><span class="tomtskarning__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg></span><span>Berget ligger djupt, så djupet är hoptryckt i bilden – brottet visar var.</span></li>
                  <li><span class="tomtskarning__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 12h4l2-5 3 10 2-5h7"/></svg></span><span>Ledningar finns inte i öppna kartor. <a href="https://www.ledningskollen.se/" target="_blank" rel="noopener">Fråga gratis via Ledningskollen</a> innan ni gräver.</span></li>
                </ul>
              </section>

              <div class="tomtrapport__karta">
                <div class="tomtrapport__kartrubrik">
                  <p class="tomtskarning__etikett">Tomten på kartan</p>
                  <p class="tomtrapport__tips">Står nålen fel? Dra den eller tryck där tomten ligger – genomskärningen ovanför ritas om.</p>
                </div>
                <div class="tomtrapport__kartyta" id="tomtkarta" role="region" aria-label="Karta med tomten utmärkt"></div>
                <div class="tomtrapport__kartrad">
                  <label class="konfig__spegel">
                    <input type="checkbox" id="jordlager">
                    <span class="konfig__vaxel" aria-hidden="true"></span>
                    Visa jordartskartan
                  </label>
                  <p class="tomtrapport__kalla">
                    Jordart, genomsläpplighet och jorddjup: SGU, öppna data.
                    Adressök och karta: © OpenStreetMap-bidragsgivare.
                  </p>
                </div>
              </div>
            </div>
          </div>
            <div class="vf3d vf3d--mark" data-vf3d="mark" aria-hidden="true">
              <svg class="vf3d__svg" viewBox="0 0 640 400" focusable="false">
                <defs>
                  <linearGradient id="vfm-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfdaa3"/><stop offset="1" stop-color="#8db676"/></linearGradient>
                  <linearGradient id="vfm-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4dc"/><stop offset=".55" stop-color="#f7cf93"/><stop offset="1" stop-color="#e3a35a"/></linearGradient>
                  <radialGradient id="vfm-krona" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#a2c88a"/><stop offset="1" stop-color="#5f9064"/></radialGradient>
                  <radialGradient id="vfm-golv"><stop offset="0" stop-color="#5a3c1e" stop-opacity=".26"/><stop offset="1" stop-color="#5a3c1e" stop-opacity="0"/></radialGradient>
                  <linearGradient id="vfm-nal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c88f"/><stop offset="1" stop-color="#c47a32"/></linearGradient>
                  <linearGradient id="vfm-hall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9bcc1"/><stop offset="1" stop-color="#8b8f97"/></linearGradient>
                  <linearGradient id="vfm-mosse" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9bf86"/><stop offset="1" stop-color="#7b9a62"/></linearGradient>
                  <linearGradient id="vfm-vatten" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9cfe8"/><stop offset="1" stop-color="#6ea4cf"/></linearGradient>
                  <filter id="vfm-mjuk" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
                </defs>
                <g class="vf3d__varld"></g>
              </svg>
              <span class="vf3d__chip vf3d__chip--vanster vf3d__chip--lager vf3d__chip--matjord" data-chip="matjord"><span class="vf3d__chip-in"><i></i><b>Matjord</b></span></span>
              <span class="vf3d__chip vf3d__chip--vanster vf3d__chip--lager vf3d__chip--lera" data-chip="lera"><span class="vf3d__chip-in"><i></i><b>Lera</b></span></span>
              <span class="vf3d__chip vf3d__chip--vanster vf3d__chip--lager vf3d__chip--moran" data-chip="moran"><span class="vf3d__chip-in"><i></i><b>Morän</b></span></span>
              <span class="vf3d__chip vf3d__chip--vanster vf3d__chip--lager vf3d__chip--berg" data-chip="berg"><span class="vf3d__chip-in"><i></i><b>Berg</b></span></span>
              <span class="vf3d__chip vf3d__chip--hoger vf3d__chip--ledning" data-chip="ledningar"><span class="vf3d__chip-in"><i></i><b>Ledningar</b></span></span>
              <span class="vf3d__chip vf3d__chip--hoger vf3d__chip--brun" data-chip="djup"><span class="vf3d__chip-in"><i></i><b>Djup till berg</b></span></span>
              <p class="vf3d__tips"><svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 13a7.5 7.5 0 0 1 13.2-4.9M19.5 11a7.5 7.5 0 0 1-13.2 4.9M18 4.5v4h-4M6 19.5v-4h4"/></svg>Dra för att vrida</p>
            </div>
          </div>

          <p class="markkoll__mer" id="markkoll-mer">Gå djupare i kartorna</p>
          <div class="markkoll__rad">
''' + "\n".join(f'''            <a class="markkort" href="{lank}" target="_blank" rel="noopener" data-karta="{lank}">
              <span class="markkort__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{ikon}"/></svg></span>
              <span class="markkort__kalla">{kalla}</span>
              <strong>{titel}</strong>
              <span class="markkort__text">{text}</span>
              <span class="markkort__lank" data-lanktext>{"Gå till Ledningskollen" if kalla == "Ledningskollen" else "Öppna kartan"}</span>
            </a>''' for titel, kalla, lank, ikon, text in MARKKOLL) + '''
          </div>
          <p class="markkoll__not">
            Kartorna är översiktliga och ersätter inte en geoteknisk bedömning
            på plats. Visa gärna vad du hittat när vi pratar, så säger vi vad
            det betyder för grunden.
          </p>
        </div>
      </section>

''' + io.open("_kontaktsektion.inc", encoding="utf-8").read() + '''
      <!-- Tomtrapporten som PDF: syns bara vid utskrift och fylls i av
           skriptet precis innan. Loggan ligger här från början så att den
           hunnit laddas när utskriften görs. -->
      <div class="rapport" id="rapport">
        <div class="rapport__topp">
          <img class="rapport__logo" src="images/idealhus_logo.svg" width="1024" height="279" alt="Idealhus">
          <p class="rapport__datum" id="rapport-datum"></p>
        </div>
        <div id="rapport-innehall"></div>
      </div>
    </main>

'''

SKRIPT = '''
      /* Tomten i isometri (omgjord 2026-10-07). Ritas om från svaren:
         det nya huset växer till den yta som får byggas (1 ruta = 2 m),
         avståndet till tomtgränsen får färg efter svaret, befintliga
         byggnader står i hörnet bakom och bostadshuset står framme till
         vänster. Inom detaljplan: grannhus, trottoar, gata med bil och
         gatlykta. Utanför: skog, äng, stenmur och grusväg. Nära vatten:
         strand, vass, brygga och vågor. Talen glider mjukt mellan lägena,
         och brickornas bredd mäts mot den riktiga texten. Livet på tomten
         (bilen, den som går med hunden, fåglarna, molnskuggorna, rådjuret)
         ligger i ett eget lager som bara byggs om när planen byts, så att
         rörelserna inte börjar om när man drar i reglaget. */
      (function () {
        var svg = document.getElementById('tv-svg');
        var skylt = document.getElementById('tv-skylt');
        if (!svg) return;
        var S = 21, OX = 300, OY = 206, C = 0.8660254;
        function P(x, y, z) { return [OX + (x - y) * S * C, OY + (x + y) * S * 0.5 - (z || 0) * S]; }
        function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
        function poly(a, fill, extra) { return '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
        function lin(a, farg, b, extra) {
          return '<polyline points="' + pts(a) + '" fill="none" stroke="' + farg + '" stroke-width="' + b +
            '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
        }
        function box(x, y, z, dx, dy, dz, f, extra) {
          var x1 = x + dx, y1 = y + dy, z1 = z + dz;
          return poly([P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)], f.x, extra) +
            poly([P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)], f.y, extra) +
            poly([P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)], f.t, extra);
        }
        function hus(x0, y0, x1, y1, ze, zr, f, tak, extra, o) {
          var ym = (y0 + y1) / 2, h = '';
          o = o === undefined ? 0.18 : o;
          h += box(x0, y0, 0, x1 - x0, y1 - y0, ze, f, extra);
          h += poly([P(x1, y0, ze), P(x1, y1, ze), P(x1, ym, zr)], f.x, extra);
          h += poly([P(x0 - o, y0 - o, ze), P(x1 + o, y0 - o, ze), P(x1 + o, ym, zr), P(x0 - o, ym, zr)], tak.x, extra);
          h += poly([P(x0 - o, ym, zr), P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze), P(x0 - o, y1 + o, ze)], tak.t, extra);
          return h;
        }
        function skugga(x, y, rx, ry, a) {
          var p = P(x, y, 0);
          return '<ellipse cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" rx="' + (rx * S).toFixed(1) + '" ry="' + (ry * S).toFixed(1) + '" fill="url(#tv-skugga)" opacity="' + (a || 1) + '"/>';
        }
        function gran(x, y, h) {
          var bas = P(x, y, 0), topp = P(x, y, h), mitt = P(x, y, h * 0.28), b = S * 0.6 * (h / 3);
          return skugga(x + 0.25, y + 0.25, 0.75 * h / 3, 0.38 * h / 3, 0.9) +
            poly([[bas[0] - 2, bas[1]], [bas[0] + 2, bas[1]], [mitt[0] + 2, mitt[1]], [mitt[0] - 2, mitt[1]]], '#6b4f36') +
            '<g class="tv-krona tv-krona--gran" style="transform-origin:' + bas[0].toFixed(1) + 'px ' + bas[1].toFixed(1) + 'px">' +
            poly([topp, [mitt[0] - b, mitt[1]], [mitt[0], mitt[1] + b * 0.34]], '#6f9a6a') +
            poly([topp, [mitt[0], mitt[1] + b * 0.34], [mitt[0] + b, mitt[1]]], '#436b4f') + '</g>';
        }
        function lovtrad(x, y, h) {
          var bas = P(x, y, 0), topp = P(x, y, h);
          return skugga(x + 0.3, y + 0.3, 0.9, 0.45, 0.9) +
            '<line x1="' + bas[0].toFixed(1) + '" y1="' + bas[1].toFixed(1) + '" x2="' + topp[0].toFixed(1) + '" y2="' + (topp[1] + 10).toFixed(1) + '" stroke="#6b4f36" stroke-width="3.4" stroke-linecap="round"/>' +
            '<g class="tv-krona" style="transform-origin:' + topp[0].toFixed(1) + 'px ' + (topp[1] + 12).toFixed(1) + 'px">' +
            '<circle cx="' + (topp[0] - 8).toFixed(1) + '" cy="' + (topp[1] + 3).toFixed(1) + '" r="12" fill="#6f9a6a"/>' +
            '<circle cx="' + (topp[0] + 8).toFixed(1) + '" cy="' + (topp[1] + 2).toFixed(1) + '" r="11" fill="#5a8660"/>' +
            '<circle cx="' + topp[0].toFixed(1) + '" cy="' + (topp[1] - 6).toFixed(1) + '" r="12" fill="#86ad78"/></g>';
        }
        function buske(x, y) {
          var c = P(x, y, 0.3);
          return skugga(x, y, 0.5, 0.25, 0.7) +
            '<circle cx="' + (c[0] - 5).toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="7" fill="#5a8660"/>' +
            '<circle cx="' + (c[0] + 5).toFixed(1) + '" cy="' + (c[1] + 1).toFixed(1) + '" r="6.4" fill="#436b4f"/>' +
            '<circle cx="' + c[0].toFixed(1) + '" cy="' + (c[1] - 5).toFixed(1) + '" r="6.4" fill="#6f9a6a"/>';
        }
        // Fönster i planet y = yv (framsidan) eller x = xv (gaveln).
        function fonY(yv, xa, xb, za, zb, fyll) {
          return poly([P(xa, yv, za), P(xb, yv, za), P(xb, yv, zb), P(xa, yv, zb)], fyll, ' stroke="#1b1915" stroke-width="1"');
        }
        function fonX(xv, ya, yb, za, zb, fyll) {
          return poly([P(xv, ya, za), P(xv, yb, za), P(xv, yb, zb), P(xv, ya, zb)], fyll, ' stroke="#1b1915" stroke-width="1"');
        }
        // Ett ljust bostadshus (bostadshuset på tomten och grannarna).
        function villa(x0, y0, x1, y1, ze, zr, farg, rok) {
          var h = skugga((x0 + x1) / 2 + 0.4, (y0 + y1) / 2 + 0.4, (x1 - x0) / 2 + 0.6, (y1 - y0) / 2 + 0.4, 0.9);
          h += hus(x0, y0, x1, y1, ze, zr, farg || GRANNE, LJUSTAK, '', 0.2);
          var ym = (y0 + y1) / 2;
          h += lin([P(x0 - 0.2, ym, zr + 0.02), P(x1 + 0.2, ym, zr + 0.02)], '#8a7f6b', 1.8);
          var l = x1 - x0;
          for (var i = 0; i < 3; i++) {
            var fx = x0 + l * (0.12 + i * 0.3);
            h += fonY(y1, fx, fx + l * 0.16, ze * 0.35, ze * 0.8, 'url(#tv-glas)');
          }
          h += poly([P(x0 + l * 0.44, y1, 0), P(x0 + l * 0.56, y1, 0), P(x0 + l * 0.56, y1, ze * 0.72), P(x0 + l * 0.44, y1, ze * 0.72)], '#8a6a4b', ' stroke="#1b1915" stroke-width="1"');
          h += fonX(x1, y0 + (y1 - y0) * 0.3, y0 + (y1 - y0) * 0.7, ze * 0.4, ze * 0.85, 'url(#tv-glas)');
          h += box(x0 + l * 0.7, ym - 0.6, zr - 0.5, 0.28, 0.28, 0.8, { t: '#8a847a', x: '#5f5a52', y: '#6f6a62' });
          if (rok) h += rokpuffar(P(x0 + l * 0.7 + 0.14, ym - 0.46, zr + 0.42), 'tv-rok--ljus');
          return h;
        }
        // En bil längs x, fronten mot +x.
        function bil(x, y, farg) {
          var hjul = function (xc) {
            var a = [];
            for (var t = 0; t < 16; t++) { var v = t / 16 * Math.PI * 2; a.push(P(xc + Math.cos(v) * 0.22, y + 0.86, 0.22 + Math.sin(v) * 0.22)); }
            return poly(a, '#151311');
          };
          var h = skugga(x + 1.1, y + 0.45, 1.3, 0.5, 0.9) + '<g class="tv-gung">';
          h += box(x, y, 0.14, 2.2, 0.85, 0.36, farg);
          h += box(x + 0.55, y + 0.06, 0.5, 1.05, 0.73, 0.32, { t: farg.t, x: farg.x, y: farg.y });
          h += poly([P(x + 1.6, y + 0.1, 0.52), P(x + 1.6, y + 0.75, 0.52), P(x + 1.6, y + 0.75, 0.8), P(x + 1.6, y + 0.1, 0.8)], 'url(#tv-glas)', ' stroke="#1b1915" stroke-width=".8"');
          h += poly([P(x + 0.62, y + 0.79, 0.54), P(x + 1.52, y + 0.79, 0.54), P(x + 1.52, y + 0.79, 0.78), P(x + 0.62, y + 0.79, 0.78)], 'url(#tv-glas)', ' stroke="#1b1915" stroke-width=".8"');
          h += lin([P(x + 1.07, y + 0.79, 0.54), P(x + 1.07, y + 0.79, 0.78)], '#1b1915', 1.2);
          h += poly([P(x + 2.2, y + 0.08, 0.32), P(x + 2.2, y + 0.24, 0.32), P(x + 2.2, y + 0.24, 0.42), P(x + 2.2, y + 0.08, 0.42)], '#fff1d2');
          h += poly([P(x + 2.2, y + 0.61, 0.32), P(x + 2.2, y + 0.77, 0.32), P(x + 2.2, y + 0.77, 0.42), P(x + 2.2, y + 0.61, 0.42)], '#fff1d2');
          return h + '</g>' + hjul(x + 0.45) + hjul(x + 1.75);
        }
        // Rök som stiger ur en skorsten (punkten p är skorstenens topp).
        function rokpuffar(p, klass) {
          var h = '';
          [0, 1, 2].forEach(function (i) {
            h += '<circle class="tv-rok ' + (klass || '') + '" style="--i:' + i + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (2.6 + i * 0.9) + '" fill="#f1ece3" stroke="rgba(27,25,21,.14)" stroke-width=".8"/>';
          });
          return h;
        }
        // En människa i skärmplanet med fötterna i f. Hon kan vinka,
        // gå (benen och armen svänger) eller bara stå.
        function manniska(f, troja, byxor, har, satt) {
          var x = f[0], y = f[1], h = '';
          var o = function (dx, dy) { return (x + dx).toFixed(1) + 'px ' + (y + dy).toFixed(1) + 'px'; };
          var l = function (x1, y1, x2, y2, farg, b, klass) {
            return '<line' + (klass ? ' class="' + klass + '" style="transform-origin:' + o(x1, y1) + '"' : '') +
              ' x1="' + (x + x1).toFixed(1) + '" y1="' + (y + y1).toFixed(1) + '" x2="' + (x + x2).toFixed(1) + '" y2="' + (y + y2).toFixed(1) +
              '" stroke="' + farg + '" stroke-width="' + b + '" stroke-linecap="round"/>';
          };
          var gar = satt === 'gar';
          h += '<ellipse cx="' + x.toFixed(1) + '" cy="' + (y + 0.6).toFixed(1) + '" rx="5" ry="1.8" fill="rgba(27,25,21,.18)"/>';
          h += l(-1.1, -7.6, -1.1, -0.6, byxor, 2.3, gar ? 'tv-ben' : '') + l(1.1, -7.6, 1.1, -0.6, byxor, 2.3, gar ? 'tv-ben tv-ben--b' : '');
          h += '<g' + (gar ? ' class="tv-studs"' : '') + '>';
          h += l(-2.5, -13.4, -3.4, -8.4, troja, 1.9, gar ? 'tv-armsving' : '');
          h += '<rect x="' + (x - 2.8).toFixed(1) + '" y="' + (y - 14.6).toFixed(1) + '" width="5.6" height="7.8" rx="2.5" fill="' + troja + '"/>';
          if (satt === 'vinkar') h += l(2.5, -13.4, 4.6, -18.6, troja, 1.9, 'tv-vinka');
          else if (gar) h += l(-2.2, -13.2, -4.6, -10.6, troja, 1.9);
          else h += l(2.5, -13.4, 3.4, -8.4, troja, 1.9);
          h += '<circle cx="' + x.toFixed(1) + '" cy="' + (y - 17.4).toFixed(1) + '" r="2.8" fill="#e6c09a"/>';
          h += '<path d="M' + (x - 2.9).toFixed(1) + ' ' + (y - 17.6).toFixed(1) + 'a2.9 2.9 0 0 1 5.8 0c-1.6-.9-3.9-1-5.8 0Z" fill="' + har + '"/>';
          return h + '</g>';
        }
        function lugnt() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        // Vimpeln vajar: formen räknas fram i sex lägen och SMIL glider mellan dem.
        function vimpel(fx, fy, z) {
          var L = 1.15, N = 9, lagen = [], linjer = [];
          for (var k = 0; k <= 6; k++) {
            var fv = k / 6 * Math.PI * 2, ovre = [], undre = [], mitt = [];
            for (var i = 0; i <= N; i++) {
              var u = i / N, v = Math.sin(u * 5.2 - fv) * 0.085 * (0.25 + u) - u * u * 0.12;
              var bred = 0.27 * (1 - u * 0.8);
              ovre.push(P(fx + u * L, fy, z + v));
              undre.unshift(P(fx + u * L, fy, z + v - bred));
              mitt.push(P(fx + u * L, fy, z + v - bred / 2));
            }
            lagen.push('M' + pts(ovre.concat(undre)).split(' ').join('L') + 'Z');
            linjer.push('M' + pts(mitt).split(' ').join('L'));
          }
          var s0 = P(fx, fy, 0.12), s1 = P(fx, fy, z + 0.08), rorlig = !lugnt();
          return skugga(fx + 0.1, fy + 0.1, 0.25, 0.12, 0.8) +
            '<line x1="' + s0[0].toFixed(1) + '" y1="' + s0[1].toFixed(1) + '" x2="' + s1[0].toFixed(1) + '" y2="' + s1[1].toFixed(1) + '" stroke="#f4f0e8" stroke-width="2.2" stroke-linecap="round"/>' +
            '<line x1="' + (s0[0] + 0.9).toFixed(1) + '" y1="' + s0[1].toFixed(1) + '" x2="' + (s1[0] + 0.9).toFixed(1) + '" y2="' + s1[1].toFixed(1) + '" stroke="rgba(27,25,21,.2)" stroke-width=".8"/>' +
            '<circle cx="' + s1[0].toFixed(1) + '" cy="' + (s1[1] - 1.6).toFixed(1) + '" r="2.3" fill="#e3b25a"/>' +
            '<path d="' + lagen[0] + '" fill="#2f6fae">' + (rorlig ? '<animate attributeName="d" dur="2.4s" repeatCount="indefinite" values="' + lagen.join(';') + '"/>' : '') + '</path>' +
            '<path d="' + linjer[0] + '" fill="none" stroke="#f2c84b" stroke-width="2" stroke-linecap="round">' + (rorlig ? '<animate attributeName="d" dur="2.4s" repeatCount="indefinite" values="' + linjer.join(';') + '"/>' : '') + '</path>';
        }
        // En liten roddbåt vid bryggan, i x-led med fören mot -x.
        function roddbat(x, y) {
          var m = P(x + 0.45, y, 0.02);
          var h = '<ellipse class="tv-ring" style="transform-origin:' + m[0].toFixed(1) + 'px ' + m[1].toFixed(1) + 'px" cx="' + m[0].toFixed(1) + '" cy="' + m[1].toFixed(1) + '" rx="17" ry="6" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>';
          h += '<g class="tv-bat" style="transform-origin:' + m[0].toFixed(1) + 'px ' + m[1].toFixed(1) + 'px">';
          h += poly([P(x, y, 0.16), P(x + 0.22, y + 0.17, 0.16), P(x + 0.9, y + 0.17, 0.16), P(x + 0.9, y + 0.15, 0.02), P(x + 0.26, y + 0.12, 0.02), P(x + 0.04, y, 0.05)], '#f4f0e8', ' stroke="#8a847a" stroke-width=".7"');
          h += poly([P(x, y, 0.16), P(x + 0.22, y - 0.17, 0.16), P(x + 0.9, y - 0.17, 0.16), P(x + 0.9, y + 0.17, 0.16), P(x + 0.22, y + 0.17, 0.16)], '#b98a5a', ' stroke="#6b4f36" stroke-width=".8"');
          h += lin([P(x + 0.55, y - 0.16, 0.17), P(x + 0.55, y + 0.16, 0.17)], '#8a6a4b', 2);
          h += lin([P(x + 0.24, y + 0.17, 0.1), P(x + 0.88, y + 0.17, 0.1)], '#2f6fae', 1.4);
          return h + '</g>';
        }
        // På smal skärm blir bilden liten, så brickorna förstoras för att
        // texten ska gå att läsa (etikettSkala). Då visas bara husets,
        // höjdens och avståndets brickor – strandskyddet och det som redan
        // finns står i rutorna under bilden. Brickorna hålls innanför
        // bilden och flyttas isär om de skulle hamna på varandra.
        var etikettSkala = 1;
        function flytta(x, y) {
          return 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' + (etikettSkala !== 1 ? ' scale(' + etikettSkala + ')' : '');
        }
        function etikett(p, text, klass) {
          var b = Math.round(text.length * 6.6 + 34);
          return '<g class="tv-etikett ' + (klass || '') + '" data-x="' + p[0].toFixed(1) + '" data-y="' + p[1].toFixed(1) + '" transform="' + flytta(p[0], p[1]) + '">' +
            '<rect x="' + (-b / 2) + '" y="-13" width="' + b + '" height="26" rx="13"/>' +
            '<circle class="tv-etikett__prick" cx="' + (-b / 2 + 13) + '" cy="0" r="3.6"/>' +
            '<text x="' + (-b / 2 + 22) + '" y="4.3">' + text + '</text></g>';
        }
        // Ett läge där brickan inte krockar med dem som redan står: där den
        // hör hemma, annars strax under eller över den den krockar med.
        function ledig(x, y, hw, hh, lagda) {
          function krock(ny) {
            return lagda.some(function (b) { return Math.abs(b.x - x) < b.hw + hw + 2 && Math.abs(b.y - ny) < b.hh + hh + 2; });
          }
          if (!krock(y)) return y;
          var bast = y, avst = Infinity;
          lagda.forEach(function (b) {
            [b.y + b.hh + hh + 4, b.y - b.hh - hh - 4].forEach(function (ny) {
              if (ny < hh + 4 || ny > 396 - hh || krock(ny) || Math.abs(ny - y) >= avst) return;
              avst = Math.abs(ny - y);
              bast = ny;
            });
          });
          return bast;
        }
        function passa() {
          var lagda = [];
          Array.prototype.forEach.call(svg.querySelectorAll('.tv-etikett'), function (e) {
            var t = e.querySelector('text'), r = e.querySelector('rect'), c = e.querySelector('circle');
            if (!t || !t.getComputedTextLength) return;
            var tl = t.getComputedTextLength();
            if (!tl) return;
            var w = tl + 34;
            r.setAttribute('x', (-w / 2).toFixed(1));
            r.setAttribute('width', w.toFixed(1));
            c.setAttribute('cx', (-w / 2 + 13).toFixed(1));
            t.setAttribute('x', (-w / 2 + 22).toFixed(1));
            var x = parseFloat(e.getAttribute('data-x')), y = parseFloat(e.getAttribute('data-y'));
            var hw = w / 2 * etikettSkala, hh = 13 * etikettSkala;
            var nx = Math.max(6 + hw, Math.min(594 - hw, x)), ny = ledig(nx, y, hw, hh, lagda);
            lagda.push({ x: nx, y: ny, hw: hw, hh: hh });
            var tf = flytta(nx, ny);
            if (e.getAttribute('transform') !== tf) e.setAttribute('transform', tf);
          });
        }
        var GRAS = { t: 'url(#tv-gras)', x: '#5c7a48', y: '#6f8f58' };
        var MARK = { t: '#e9e1d2', x: '#b8ab95', y: '#cdbfa8' };
        var ANG = { t: '#d9dcc0', x: '#a9ad8d', y: '#bfc3a3' };
        var FASAD = { t: '#3d3832', x: '#24211d', y: '#302b26' };
        var TAK = { t: '#3b3631', x: '#2a2622' };
        var BOD = { t: '#dfb57a', x: '#a97b45', y: '#c9975a' };
        var GRANNE = { t: '#efe8dc', x: '#cfc6b5', y: '#e2d9ca' };
        var BOSTAD = { t: '#f6efe3', x: '#d6cbb7', y: '#e9dfcd' };
        var LJUSTAK = { t: '#b3a994', x: '#9a8f79' };
        var HACK = { t: '#6f9a6a', x: '#3f5f3a', y: '#4f7346' };
        var VIRKE = { t: '#e8c48f', x: '#b7884d', y: '#cfa064' };
        var komma = function (v, d) { return v.toFixed(d).replace('.', ','); };

        var PX0 = -5.5, PX1 = 5.5, PY0 = -4, PY1 = 4, IN = 0.3;
        // Tomten ritas i lager som byggs om bara när det de visar har
        // ändrats: marken och omgivningen när planen eller vattnet byts,
        // förrådet, huset och måtten medan de glider mot nya värden.
        function ritaMark(ute, vatten) {
          var h = '';
          h += '<ellipse cx="' + OX + '" cy="' + (OY + 36) + '" rx="262" ry="126" fill="url(#tv-skugga)"/>';
          h += box(-8, -6.5, -0.35, 16, 13, 0.35, ute ? ANG : MARK);
          // Vattnet bakom tomten.
          if (vatten !== 'nej') {
            h += poly([P(-8, -6.5, 0.01), P(8, -6.5, 0.01), P(8, -5.1, 0.01), P(-8, -5.1, 0.01)],
              vatten === 'ja' ? 'url(#tv-vatten)' : 'rgba(91,143,191,.16)',
              vatten === 'ja' ? '' : ' stroke="#5b8fbf" stroke-width="1.4" stroke-dasharray="5 5"');
            if (vatten === 'ja') {
              h += lin([P(-8, -5.1, 0.02), P(8, -5.1, 0.02)], 'rgba(255,255,255,.75)', 2);
              for (var w = -7; w < 8; w += 2.4) h += lin([P(w, -5.85, 0.02), P(w + 1.0, -5.85, 0.02)], 'rgba(255,255,255,.7)', 1.5, ' class="tv-vag"');
              for (var w2 = -6; w2 < 8; w2 += 2.4) h += lin([P(w2, -6.25, 0.02), P(w2 + 0.8, -6.25, 0.02)], 'rgba(255,255,255,.5)', 1.3, ' class="tv-vag tv-vag--2"');
              h += roddbat(1.0, -5.72);
              h += lin([P(1.9, -5.58, 0.1), P(2.02, -5.52, 0.1)], '#8a6a4b', 1);
              [[-6.4, -5.9], [-3.8, -6.1], [-1.2, -5.7], [4.1, -6.0], [6.4, -5.8], [0.2, -6.3]].forEach(function (g, i) {
                var gp = P(g[0], g[1], 0.03), gx = gp[0].toFixed(1), gy = gp[1].toFixed(1);
                h += '<g transform="translate(' + gx + ',' + gy + ')"><path class="tv-glitter" style="--i:' + i + '" d="M0-3.4L.7 0 0 3.4-.7 0ZM-3.4 0 0-.7 3.4 0 0 .7Z" fill="#fff"/></g>';
              });
              h += box(2.0, -6.2, 0.06, 0.55, 1.2, 0.06, VIRKE);
              [[2.0, -6.2], [2.5, -6.2], [2.0, -5.5], [2.5, -5.5]].forEach(function (k) { h += box(k[0], k[1], -0.2, 0.06, 0.06, 0.28, { t: '#8a6a4b', x: '#5a4330', y: '#6f5440' }); });
              [-6.6, -6.2, -5.8, 4.8, 5.3, 5.8].forEach(function (rx, i) {
                var r0 = P(rx, -5.05, 0.02), r1 = P(rx + 0.05, -5.05, 0.7 + (i % 2) * 0.2);
                h += '<g class="tv-vass" style="--i:' + i + ';transform-origin:' + r0[0].toFixed(1) + 'px ' + r0[1].toFixed(1) + 'px">' + '<line x1="' + r0[0].toFixed(1) + '" y1="' + r0[1].toFixed(1) + '" x2="' + r1[0].toFixed(1) + '" y2="' + r1[1].toFixed(1) + '" stroke="#6f8f58" stroke-width="1.6" stroke-linecap="round"/>' +
                  '<ellipse cx="' + r1[0].toFixed(1) + '" cy="' + (r1[1] + 3).toFixed(1) + '" rx="1.8" ry="4" fill="#8a6a4b"/></g>';
              });
            }
          }
          // Gata och trottoar framför (detaljplan), eller grusväg och stenmur (landsbygd).
          if (ute) {
            h += poly([P(-8, 5.3, 0.01), P(8, 5.3, 0.01), P(8, 6.4, 0.01), P(-8, 6.4, 0.01)], '#cfc4ae');
            h += lin([P(-8, 5.65, 0.02), P(8, 5.65, 0.02)], 'rgba(143,120,90,.35)', 1.2) + lin([P(-8, 6.05, 0.02), P(8, 6.05, 0.02)], 'rgba(143,120,90,.35)', 1.2);
          } else {
            h += poly([P(-8, 4.5, 0.02), P(8, 4.5, 0.02), P(8, 5.05, 0.02), P(-8, 5.05, 0.02)], '#e3ddd1');
            for (var sx = -7.5; sx < 8; sx += 0.9) h += lin([P(sx, 4.5, 0.03), P(sx, 5.05, 0.03)], 'rgba(27,25,21,.08)', 1);
            h += poly([P(-8, 5.1, 0.01), P(8, 5.1, 0.01), P(8, 6.5, 0.01), P(-8, 6.5, 0.01)], '#8f8a80');
            for (var gx = -7; gx < 8; gx += 2.2) h += lin([P(gx, 5.8, 0.02), P(gx + 1, 5.8, 0.02)], '#f7f2ea', 1.6);
          }
          // Häcken bakom tomten.
          h += box(PX0, -4.45, 0, PX1 - PX0, 0.3, 0.42, HACK);
          for (var hx = PX0 + 0.3; hx < PX1; hx += 0.55) {
            var hp = P(hx, -4.3, 0.44);
            h += '<circle cx="' + hp[0].toFixed(1) + '" cy="' + hp[1].toFixed(1) + '" r="3.2" fill="#86ad78" opacity=".7"/>';
          }
          // Tomten: gräs med klippränder, gränsen med stolpar.
          h += box(PX0, PY0, 0, PX1 - PX0, PY1 - PY0, 0.12, GRAS);
          for (var st = PY0; st < PY1; st += 1.6) {
            h += poly([P(PX0, st, 0.121), P(PX1, st, 0.121), P(PX1, st + 0.8, 0.121), P(PX0, st + 0.8, 0.121)], 'rgba(255,255,255,.07)');
          }
          if (vatten === 'ja') h += poly([P(PX0, PY0, 0.13), P(PX1, PY0, 0.13), P(PX1, PY1, 0.13), P(PX0, PY1, 0.13)], 'rgba(91,143,191,.12)');
          h += lin([P(PX0 + IN, PY0 + IN, 0.14), P(PX1 - IN, PY0 + IN, 0.14), P(PX1 - IN, PY1 - IN, 0.14), P(PX0 + IN, PY1 - IN, 0.14), P(PX0 + IN, PY0 + IN, 0.14)],
            '#f0b56e', 2, ' stroke-dasharray="7 5" class="tv-grans"');
          [[PX0 + IN, PY0 + IN], [PX1 - IN, PY0 + IN], [PX1 - IN, PY1 - IN], [PX0 + IN, PY1 - IN]].forEach(function (k) {
            h += box(k[0] - 0.07, k[1] - 0.07, 0.12, 0.14, 0.14, 0.55, { t: '#f0b56e', x: '#8f5424', y: '#c9975a' });
          });
          // Omgivningen bakom och till vänster.
          if (ute) {
            [[-7.2, -4.6, 2.6], [-6.6, -2.4, 2.0], [-7.3, 0.2, 2.4], [-6.7, 2.4, 2.0], [6.8, -4.4, 2.6], [7.3, -2.2, 2.2]].forEach(function (g) { h += gran(g[0], g[1], g[2]); });
            [[-6.3, -3.4], [6.4, -0.6], [-6.2, 1.2]].forEach(function (s, i) {
              var sp = P(s[0], s[1], 0.05);
              h += '<ellipse cx="' + sp[0].toFixed(1) + '" cy="' + sp[1].toFixed(1) + '" rx="' + (7 + i) + '" ry="' + (4.4 + i * 0.5) + '" fill="#b9b1a2" stroke="#8a847a" stroke-width="1"/>';
            });
            for (var bl = 0; bl < 18; bl++) {
              var bp = P(-7.6 + (bl * 2.3) % 15.4, 4.3 + (bl % 3) * 0.25, 0.02);
              h += '<circle cx="' + bp[0].toFixed(1) + '" cy="' + bp[1].toFixed(1) + '" r="1.6" fill="' + (bl % 2 ? '#f0b56e' : '#fffdf8') + '"/>';
            }
          } else {
            h += villa(-7.8, -4.0, -6.1, -1.6, 1.1, 1.8, GRANNE);
            h += lovtrad(-6.8, 0.8, 2.0);
            h += lovtrad(6.9, -2.8, 2.2);
          }
          // Lövträdet i trädgården bakom, till höger.
          h += lovtrad(4.75, -3.15, 2.1);
          return h;
        }
        function ritaFanns(befintligt) {
          var h = '';
          // Befintlig byggnad i hörnet bakom (1 ruta = 2 m).
          if (befintligt > 0.5) {
            var bb = Math.sqrt(befintligt * 1.3) / 2, bd = befintligt / 4 / bb;
            var bx0 = PX0 + 0.8, by0 = PY0 + 0.7;
            h += poly([P(bx0 + 0.2, by0 + 0.2, 0.13), P(bx0 + bb + 0.5, by0 + 0.2, 0.13), P(bx0 + bb + 0.5, by0 + bd + 0.5, 0.13), P(bx0 + 0.2, by0 + bd + 0.5, 0.13)], 'rgba(27,25,21,.16)');
            h += box(bx0, by0, 0.12, bb, bd, 1.1, BOD);
            for (var bp2 = bx0 + 0.25; bp2 < bx0 + bb - 0.1; bp2 += 0.25) h += lin([P(bp2, by0 + bd, 0.14), P(bp2, by0 + bd, 1.2)], 'rgba(143,84,36,.25)', 1);
            h += box(bx0 - 0.1, by0 - 0.1, 1.22, bb + 0.2, bd + 0.2, 0.1, { t: '#6b4f36', x: '#4a3625', y: '#5a4230' });
            if (bb > 0.9) h += poly([P(bx0 + bb * 0.4, by0 + bd, 0.14), P(bx0 + bb * 0.4 + 0.45, by0 + bd, 0.14), P(bx0 + bb * 0.4 + 0.45, by0 + bd, 0.95), P(bx0 + bb * 0.4, by0 + bd, 0.95)], '#8a6a4b', ' stroke="#1b1915" stroke-width="1"');
          }
          return h;
        }
        function husGeo(t) {
          // Det nya huset: yta i m2, 1,6:1, nock efter planen.
          var yta = t.yta > 0.5 ? t.yta : t.perHus;
          var W = Math.sqrt(yta * 1.6) / 2, D = yta / 4 / W;
          var dist = t.dist / 2;
          var hx1 = PX1 - IN - dist, hx0 = hx1 - W;
          var hy0 = -D / 2 + 1.1, hy1 = hy0 + D;
          var ze = 1.3, zr = t.hojd / 2 + 0.12, spok = t.yta <= 0.5;
          return { W: W, D: D, hx0: hx0, hx1: hx1, hy0: hy0, hy1: hy1, ze: ze, zr: zr, spok: spok };
        }
        function ritaHus(t, g) {
          var h = '', W = g.W, D = g.D, hx0 = g.hx0, hx1 = g.hx1, hy0 = g.hy0, hy1 = g.hy1, ze = g.ze, zr = g.zr, spok = g.spok;
          h += poly([P(hx0 + 0.25, hy0 + 0.25, 0.13), P(hx1 + 0.6, hy0 + 0.25, 0.13), P(hx1 + 0.6, hy1 + 0.6, 0.13), P(hx0 + 0.25, hy1 + 0.6, 0.13)], spok ? 'none' : 'rgba(27,25,21,.2)');
          if (spok) {
            h += '<g class="tv-spok">' + hus(hx0, hy0, hx1, hy1, ze + 0.12, zr, { t: 'rgba(224,118,74,.08)', x: 'rgba(224,118,74,.12)', y: 'rgba(224,118,74,.1)' },
              { t: 'rgba(224,118,74,.1)', x: 'rgba(224,118,74,.14)' }, ' stroke="#e0764a" stroke-width="1.4" stroke-dasharray="5 4"') + '</g>';
          } else {
            h += box(hx0 - 0.15, hy0 - 0.15, 0.12, W + 0.3, D + 0.3, 0.12, { t: '#dcd6cb', x: '#a9a297', y: '#bfb8ad' });
            h += '<g class="tv-hus">' + hus(hx0, hy0, hx1, hy1, ze + 0.12, zr + 0.12, FASAD, TAK);
            for (var px = hx0 + 0.22; px < hx1 - 0.05; px += 0.22) h += lin([P(px, hy1, 0.26), P(px, hy1, ze + 0.1)], 'rgba(255,255,255,.08)', 1);
            var ym = (hy0 + hy1) / 2;
            for (var sx2 = hx0; sx2 < hx1 + 0.18; sx2 += 0.3) h += lin([P(sx2, ym, zr + 0.12), P(sx2, hy1 + 0.18, ze + 0.12)], 'rgba(255,255,255,.06)', 1);
            h += lin([P(hx0 - 0.18, ym, zr + 0.13), P(hx1 + 0.18, ym, zr + 0.13)], '#5a554e', 2);
            var varm = t.bo === 'ja' ? 'url(#tv-varm)' : 'url(#tv-glas)';
            var fy = hy1, fl = Math.min(1.1, W * 0.28);
            h += poly([P(hx0 + 0.35, fy, 0.5), P(hx0 + 0.35 + fl, fy, 0.5), P(hx0 + 0.35 + fl, fy, 1.18), P(hx0 + 0.35, fy, 1.18)], varm, ' stroke="#1b1915" stroke-width="1.2"');
            h += poly([P(hx1 - 0.35 - fl, fy, 0.3), P(hx1 - 0.35, fy, 0.3), P(hx1 - 0.35, fy, 1.18), P(hx1 - 0.35 - fl, fy, 1.18)], varm, ' stroke="#1b1915" stroke-width="1.2"');
            h += lin([P(hx1 - 0.35 - fl / 2, fy, 0.3), P(hx1 - 0.35 - fl / 2, fy, 1.18)], '#1b1915', 1);
            var dx0 = hx0 + 0.45 + fl, dx1 = Math.min(dx0 + 0.32, hx1 - 0.45 - fl);
            if (dx1 - dx0 > 0.2) h += poly([P(dx0, fy, 0.24), P(dx1, fy, 0.24), P(dx1, fy, 1.05), P(dx0, fy, 1.05)], '#6b4f36', ' stroke="#1b1915" stroke-width="1"');
            if (W > 1.6) h += fonX(hx1, hy0 + D * 0.3, hy0 + D * 0.7, 0.55, 1.15, varm);
            if (t.bo === 'ja') {
              var cx = hx0 + W * 0.3, cy = ym - 0.2;
              h += box(cx, cy, zr - 0.35, 0.28, 0.28, 0.75, { t: '#4a443d', x: '#27231f', y: '#35302a' });
              h += rokpuffar(P(cx + 0.14, cy + 0.14, zr + 0.45));
            }
            h += '</g>';
            // Altanen framför.
            h += box(hx0 + 0.3, hy1, 0.12, Math.min(W - 0.6, 2.4), 0.55, 0.1, VIRKE);
            h += manniska(P(hx0 + 0.72, hy1 + 0.3, 0.22), '#f0b56e', '#2f3a48', '#3a2c22', 'vinkar');
          }
          return h;
        }
        function ritaFram(ute) {
          var h = '';
          // Bostadshuset framme till vänster, gången ut till gatan och buskar.
          h += poly([P(-3.55, 3.3, 0.125), P(-3.1, 3.3, 0.125), P(-3.1, PY1, 0.125), P(-3.55, PY1, 0.125)], '#e6dfcf');
          h += villa(-5.0, 0.9, -1.9, 3.3, 1.4, 2.45, BOSTAD, true);
          h += buske(-1.6, 3.5) + buske(-5.1, 3.6);
          // Omgivningen framme: grannhus, bil och gatlykta, eller träd och stenmur.
          if (ute) {
            h += box(-8, 4.45, 0, 16, 0.3, 0.32, { t: '#b9b1a2', x: '#8a847a', y: '#a39b8e' });
            for (var sm = -7.6; sm < 8; sm += 0.6) h += lin([P(sm, 4.75, 0.02), P(sm, 4.75, 0.3)], 'rgba(27,25,21,.15)', 1);
            [[6.7, 0.6, 2.4], [7.3, 3.0, 2.0], [-7.4, 4.0, 2.2], [6.5, 3.8, 2.6]].forEach(function (g) { h += gran(g[0], g[1], g[2]); });
          } else {
            h += villa(6.1, 1.4, 7.8, 3.9, 1.1, 1.8, GRANNE);
            var lp = P(-2.4, 4.75, 0), lt = P(-2.4, 4.75, 2.6);
            h += '<line x1="' + lp[0].toFixed(1) + '" y1="' + lp[1].toFixed(1) + '" x2="' + lt[0].toFixed(1) + '" y2="' + lt[1].toFixed(1) + '" stroke="#27231f" stroke-width="2.2"/>' +
              '<ellipse class="tv-lampa" cx="' + lt[0].toFixed(1) + '" cy="' + (lt[1] + 3).toFixed(1) + '" rx="22" ry="15" fill="url(#tv-lampa)"/>' +
              '<rect x="' + (lt[0] - 5).toFixed(1) + '" y="' + (lt[1] - 5).toFixed(1) + '" width="10" height="8" rx="2.5" fill="#fff1d2" stroke="#1b1915" stroke-width="1.2"/>';
            h += gran(-7.4, 4.0, 2.0);
          }
          return h;
        }
        function ritaMatt(t, g) {
          var h = '', hx1 = g.hx1, hy0 = g.hy0, hy1 = g.hy1, zr = g.zr;
          // Nockhöjden vid gaveln.
          var hp0 = P(hx1 + 0.45, hy0 - 0.05, 0.12), hp1 = P(hx1 + 0.45, hy0 - 0.05, zr + 0.12);
          h += lin([hp0, hp1], '#8f5424', 1.5) + lin([[hp0[0] - 5, hp0[1]], [hp0[0] + 5, hp0[1]]], '#8f5424', 1.5) + lin([[hp1[0] - 5, hp1[1]], [hp1[0] + 5, hp1[1]]], '#8f5424', 1.5);
          // Avståndet till tomtgränsen.
          var farg = t.grans === 'nara' ? '#e0764a' : (t.grans === 'medgivande' ? '#d9974f' : '#2f8a52');
          var dy = hy1 + 0.55, a0 = P(hx1, dy, 0.16), a1 = P(PX1 - IN, dy, 0.16);
          h += lin([a0, a1], farg, 2.2) + lin([P(hx1, dy - 0.2, 0.16), P(hx1, dy + 0.2, 0.16)], farg, 2.2) + lin([P(PX1 - IN, dy - 0.2, 0.16), P(PX1 - IN, dy + 0.2, 0.16)], farg, 2.2);
          return h;
        }
        // Brickorna i eget lager överst.
        function etiketter(t, g) {
          var hx0 = g.hx0, hx1 = g.hx1, hy0 = g.hy0, hy1 = g.hy1, zr = g.zr;
          var hp0 = P(hx1 + 0.45, hy0 - 0.05, 0.12), hp1 = P(hx1 + 0.45, hy0 - 0.05, zr + 0.12);
          var dy = hy1 + 0.55, a0 = P(hx1, dy, 0.16), a1 = P(PX1 - IN, dy, 0.16);
          var avst = t.grans === 'langt' ? '4,5 m' : (t.grans === 'medgivande' ? 'Närmare · ja från grannen' : 'Närmare än 4,5 m');
          var e = g.spok ? etikett(P((hx0 + hx1) / 2, (hy0 + hy1) / 2, zr + 0.9), 'Kräver bygglov', 'tv-etikett--nej')
            : etikett(P((hx0 + hx1) / 2, (hy0 + hy1) / 2, zr + 1.0), komma(t.yta, 0) + ' m²', 'tv-etikett--hus');
          e += etikett([hp1[0] + 32, (hp0[1] + hp1[1]) / 2], t.hojdText + ' m', 'tv-etikett--matt');
          e += etikett([(a0[0] + a1[0]) / 2 + 8, (a0[1] + a1[1]) / 2 + 22], avst, 'tv-etikett--' + (t.grans === 'nara' ? 'nej' : (t.grans === 'medgivande' ? 'villkor' : 'ja')));
          // På smal skärm står de här två bara i rutorna under bilden.
          if (etikettSkala > 1) return e;
          if (t.befintligt > 0.5) {
            var bb2 = Math.sqrt(t.befintligt * 1.3) / 2, bd2 = t.befintligt / 4 / bb2;
            e += etikett(P(PX0 + 0.8 + bb2 / 2, PY0 + 0.7 + bd2 / 2, 2.1), Math.round(t.befintligt) + ' m² finns', 'tv-etikett--ljus');
          }
          if (t.vatten === 'ja') e += etikett(P(0.5, -6.0, 0.3), 'Strandskydd · dispens krävs', 'tv-etikett--vatten');
          else if (t.vatten === 'vetej') e += etikett(P(0.5, -6.0, 0.3), 'Strandskydd? Kolla med kommunen', 'tv-etikett--vatten');
          return e;
        }
        function lagret(namn, nyckel, bygg) {
          if (lager.nycklar[namn] === nyckel) return;
          lager.nycklar[namn] = nyckel;
          lager[namn].innerHTML = bygg();
        }
        function rita(t) {
          var ute = t.plan === 'utanfor';
          if (!lager) {
            svg.innerHTML = DEFS + '<g class="tv-varld"><g></g><g></g><g></g><g></g><g></g><g></g></g><g class="tv-liv"></g><g class="tv-brickor"></g>';
            var v = svg.querySelector('.tv-varld').children;
            lager = { mark: v[0], fanns: v[1], vimpel: v[2], hus: v[3], fram: v[4], matt: v[5],
              liv: svg.querySelector('.tv-liv'), brickor: svg.querySelector('.tv-brickor'), nycklar: {} };
          }
          var g = husGeo(t);
          var husNyckel = [t.yta.toFixed(1), t.perHus, t.dist.toFixed(2), t.hojd.toFixed(2), t.bo].join('|');
          lagret('mark', (ute ? 'ute|' : 'inne|') + t.vatten, function () { return ritaMark(ute, t.vatten); });
          lagret('fanns', t.befintligt.toFixed(1), function () { return ritaFanns(t.befintligt); });
          // Vimpeln bakom huset, till höger om förrådet.
          lagret('vimpel', '1', function () { return vimpel(2.3, -3.35, 3.55); });
          lagret('hus', husNyckel, function () { return ritaHus(t, g); });
          lagret('fram', ute ? 'ute' : 'inne', function () { return ritaFram(ute); });
          lagret('matt', husNyckel + '|' + t.grans, function () { return ritaMatt(t, g); });
          lagret('liv', ute ? 'ute' : 'inne', function () { return livet(ute); });
          var e = etiketter(t, g);
          if (lager.nycklar.brickor !== e) {
            lager.nycklar.brickor = e;
            lager.brickor.innerHTML = e;
            passa();
          }
        }
        var lager = null;

        // Livet på tomten. Allt ritas där det står när rörelserna är
        // avstängda; med rörelse glider det in från ena kanten.
        function fard(fran, till) {
          return '--fx:' + (fran * S * C).toFixed(1) + 'px;--fy:' + (fran * S * 0.5).toFixed(1) + 'px;--tx:' +
            (till * S * C).toFixed(1) + 'px;--ty:' + (till * S * 0.5).toFixed(1) + 'px';
        }
        function livet(ute) {
          var h = '';
          // Molnskuggor som driver över marken.
          h += '<g clip-path="url(#tv-markklipp)">' +
            '<ellipse class="tv-moln" cx="300" cy="206" rx="96" ry="44" fill="url(#tv-moln)"/>' +
            '<ellipse class="tv-moln tv-moln--2" cx="300" cy="206" rx="70" ry="32" fill="url(#tv-moln)"/></g>';
          h += '<g>';
          if (ute) {
            // Bil på grusvägen, damm bakom.
            h += '<g class="tv-fard tv-fard--bil" style="' + fard(-10.0, 3.8) + '">';
            var dp = P(1.9, 5.95, 0.12);
            [0, 1, 2, 3].forEach(function (i) {
              h += '<circle class="tv-damm" style="--i:' + i + ';transform-origin:' + dp[0].toFixed(1) + 'px ' + dp[1].toFixed(1) + 'px" cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="5" fill="#d8ccb4"/>';
            });
            h += bil(2.0, 5.45, { t: '#a5523d', x: '#6e3426', y: '#874232' }) + '</g>';
          } else {
            // Någon går med hunden på trottoaren, mot vänster.
            var gp = P(-3.0, 4.84, 0.02), hp = P(-3.62, 4.84, 0.02), hx = hp[0], hy = hp[1];
            var tass = function (dx, b) {
              return '<line class="tv-tass' + (b ? ' tv-tass--b' : '') + '" style="transform-origin:' + (hx + dx).toFixed(1) + 'px ' + (hy - 3.4).toFixed(1) + 'px" x1="' + (hx + dx).toFixed(1) + '" y1="' + (hy - 3.4).toFixed(1) + '" x2="' + (hx + dx).toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#7a5536" stroke-width="1.5" stroke-linecap="round"/>';
            };
            h += '<g class="tv-fard tv-fard--gang" style="' + fard(10.6, -3.98) + '">';
            h += '<g class="tv-hund">' +
              '<ellipse cx="' + hx.toFixed(1) + '" cy="' + (hy + 0.5).toFixed(1) + '" rx="5" ry="1.6" fill="rgba(27,25,21,.16)"/>' +
              tass(-2.6) + tass(2.4, true) +
              '<line class="tv-svans" style="transform-origin:' + (hx + 4).toFixed(1) + 'px ' + (hy - 4.8).toFixed(1) + 'px" x1="' + (hx + 4).toFixed(1) + '" y1="' + (hy - 4.8).toFixed(1) + '" x2="' + (hx + 6.4).toFixed(1) + '" y2="' + (hy - 7.8).toFixed(1) + '" stroke="#a06a3f" stroke-width="1.5" stroke-linecap="round"/>' +
              '<ellipse cx="' + hx.toFixed(1) + '" cy="' + (hy - 4.4).toFixed(1) + '" rx="4.6" ry="2.4" fill="#a06a3f"/>' +
              '<circle cx="' + (hx - 4.6).toFixed(1) + '" cy="' + (hy - 6.6).toFixed(1) + '" r="2.2" fill="#a06a3f"/>' +
              '<path d="M' + (hx - 4.2).toFixed(1) + ' ' + (hy - 8.4).toFixed(1) + 'l.9 2.6-2-.5Z" fill="#7a5536"/>' +
              '<circle cx="' + (hx - 6.6).toFixed(1) + '" cy="' + (hy - 6.3).toFixed(1) + '" r=".8" fill="#1b1915"/></g>';
            h += '<line x1="' + (gp[0] - 4.6).toFixed(1) + '" y1="' + (gp[1] - 10.6).toFixed(1) + '" x2="' + (hx - 3.2).toFixed(1) + '" y2="' + (hy - 6.2).toFixed(1) + '" stroke="#8f5424" stroke-width=".9"/>';
            h += manniska(gp, '#5b8fbf', '#3d3832', '#6b4f36', 'gar') + '</g>';
            // Bilen kör förbi på gatan.
            h += '<g class="tv-fard tv-fard--bil" style="' + fard(-10.0, 3.8) + '">' + bil(2.0, 5.35, { t: '#4d6b86', x: '#2f4559', y: '#3b546b' }) + '</g>';
          }
          h += '</g>';
          if (ute) {
            // Rådjuret i skogskanten betar.
            var rd = P(-6.35, -1.15, 0.02), rx = rd[0], ry = rd[1];
            var rl = function (x1, y1, x2, y2) {
              return '<line x1="' + (rx + x1).toFixed(1) + '" y1="' + (ry + y1).toFixed(1) + '" x2="' + (rx + x2).toFixed(1) + '" y2="' + (ry + y2).toFixed(1) + '" stroke="#7a5536" stroke-width="1.5" stroke-linecap="round"/>';
            };
            h += '<g class="tv-radjur">' +
              '<ellipse cx="' + rx.toFixed(1) + '" cy="' + (ry + 0.6).toFixed(1) + '" rx="7" ry="2" fill="rgba(27,25,21,.16)"/>' +
              rl(-4, -6, -4.4, 0) + rl(-2.4, -6, -2.2, 0) + rl(3, -6, 3.4, 0) + rl(4.4, -6, 4.8, 0) +
              '<ellipse cx="' + rx.toFixed(1) + '" cy="' + (ry - 7.4).toFixed(1) + '" rx="6.4" ry="3.2" fill="#b07a4c"/>' +
              '<ellipse cx="' + (rx + 6).toFixed(1) + '" cy="' + (ry - 8.2).toFixed(1) + '" rx="1.6" ry="1.4" fill="#fff8ec"/>' +
              '<g class="tv-radjur__huvud" style="transform-origin:' + (rx - 4.6).toFixed(1) + 'px ' + (ry - 9).toFixed(1) + 'px">' +
              '<path d="M' + (rx - 5.8).toFixed(1) + ' ' + (ry - 8.6).toFixed(1) + 'l-2.2-5.8 3 .2 1.8 5Z" fill="#b07a4c"/>' +
              '<ellipse cx="' + (rx - 8.4).toFixed(1) + '" cy="' + (ry - 14.4).toFixed(1) + '" rx="2.8" ry="1.9" fill="#b07a4c"/>' +
              '<path d="M' + (rx - 7.6).toFixed(1) + ' ' + (ry - 16).toFixed(1) + 'l.6-2.6 1 2Z" fill="#8a5a36"/>' +
              '<circle cx="' + (rx - 10.9).toFixed(1) + '" cy="' + (ry - 14.1).toFixed(1) + '" r=".8" fill="#1b1915"/></g></g>';
            // Fjärilar över ängen.
            [[-3.4, 4.25, '#f0b56e', 0], [3.2, 4.15, '#fffdf8', 1]].forEach(function (f) {
              var fp = P(f[0], f[1], 0.75);
              h += '<g class="tv-fjaril" style="--i:' + f[3] + '"><g transform="translate(' + fp[0].toFixed(1) + ',' + fp[1].toFixed(1) + ')">' +
                '<g class="tv-fjaril__vingar"><ellipse cx="-1.9" cy="0" rx="2" ry="2.8" fill="' + f[2] + '" stroke="rgba(27,25,21,.35)" stroke-width=".5"/>' +
                '<ellipse cx="1.9" cy="0" rx="2" ry="2.8" fill="' + f[2] + '" stroke="rgba(27,25,21,.35)" stroke-width=".5"/></g>' +
                '<line x1="0" y1="-2" x2="0" y2="2" stroke="#3d3832" stroke-width=".9" stroke-linecap="round"/></g></g>';
            });
          }
          // Fåglar högt upp.
          [[70, 40, 0], [100, 30, 1], [124, 46, 2]].forEach(function (f) {
            h += '<g class="tv-flyg" style="--i:' + f[2] + '"><g transform="translate(' + f[0] + ',' + f[1] + ')">' +
              '<path class="tv-flaxa" style="--i:' + f[2] + '" d="M-7 0Q-3.5-4.4 0 0Q3.5-4.4 7 0" fill="none" stroke="#4a453f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g></g>';
          });
          return h;
        }

        var DEFS = '<defs>' +
          '<radialGradient id="tv-skugga"><stop offset="0" stop-color="#1b1915" stop-opacity=".22"/><stop offset="1" stop-color="#1b1915" stop-opacity="0"/></radialGradient>' +
          '<linearGradient id="tv-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6d39a"/><stop offset="1" stop-color="#8fb375"/></linearGradient>' +
          '<linearGradient id="tv-vatten" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9cc1e0"/><stop offset="1" stop-color="#5b8fbf"/></linearGradient>' +
          '<linearGradient id="tv-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f9"/><stop offset="1" stop-color="#b8cde0"/></linearGradient>' +
          '<linearGradient id="tv-varm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d9"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>' +
          '<radialGradient id="tv-moln"><stop offset="0" stop-color="#3d4a30" stop-opacity=".16"/><stop offset=".6" stop-color="#3d4a30" stop-opacity=".07"/><stop offset="1" stop-color="#3d4a30" stop-opacity="0"/></radialGradient>' +
          '<clipPath id="tv-markklipp"><polygon points="' + pts([P(-8, -6.5, 0), P(8, -6.5, 0), P(8, 6.5, 0), P(-8, 6.5, 0)]) + '"/></clipPath>' +
          '<radialGradient id="tv-lampa"><stop offset="0" stop-color="#fff1d2" stop-opacity=".95"/><stop offset=".5" stop-color="#ffcf8a" stop-opacity=".4"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>' +
          '</defs>';

        var lugn = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var nu = null, mal = null, raf = null;
        function steg() {
          raf = null;
          var klar = true;
          ['yta', 'dist', 'befintligt', 'hojdTal'].forEach(function (k) {
            var d = mal[k] - nu[k];
            if (Math.abs(d) > 0.02) { nu[k] += d * 0.2; klar = false; } else nu[k] = mal[k];
          });
          rita(Object.assign({}, mal, { yta: nu.yta, dist: nu.dist, befintligt: nu.befintligt, hojd: nu.hojdTal }));
          if (!klar) raf = requestAnimationFrame(steg);
        }
        window.idealhusTomt = function (s) {
          var hojdTal = parseFloat(String(s.hojd).replace(',', '.'));
          mal = { plan: s.plan, yta: s.yta, perHus: s.perHus, hojdText: s.hojd, hojdTal: hojdTal,
            befintligt: s.befintligt, grans: s.grans, bo: s.bo, vatten: s.vatten,
            dist: s.grans === 'langt' ? 4.5 : 1.6 };
          if (skylt) {
            skylt.textContent = s.plan === 'utanfor' ? 'Utanför detaljplan' : (s.plan === 'vetej' ? 'Vet inte · räknat som inom detaljplan' : 'Inom detaljplan');
          }
          if (!nu || lugn) { nu = { yta: mal.yta, dist: mal.dist, befintligt: mal.befintligt, hojdTal: hojdTal }; steg(); return; }
          if (!raf) raf = requestAnimationFrame(steg);
        };
        // Brickornas storlek följer bildens verkliga skala – på mobilen är
        // det höjden som tar slut först – och de mäts om när typsnittet har
        // laddats.
        function nyBredd() {
          var b = svg.getBoundingClientRect(), s = Math.min(b.width / 600, b.height / 400);
          var k = s > 0 ? Math.round(Math.max(1, Math.min(1.5, 0.7 / s)) * 20) / 20 : 1;
          if (k === etikettSkala) return;
          etikettSkala = k;
          if (lager) lager.nycklar.brickor = '';
          if (mal && !raf) steg();
        }
        if (window.ResizeObserver) new ResizeObserver(nyBredd).observe(svg);
        else window.addEventListener('resize', nyBredd);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (lager) passa(); });
      })();

      (function () {
        var form = document.getElementById('kollen');
        if (!form) return;
        var REGLER = ''' + json.dumps(REGLER) + ''';
        var MODELLER = ''' + json.dumps(MODELLER, ensure_ascii=False) + ''';
        var reglage = document.getElementById('befintligt');
        var reglageUt = document.getElementById('befintligt-varde');

        function vald(namn) {
          var el = form.querySelector('input[name="' + namn + '"]:checked');
          return el ? el.value : '';
        }

        function punkt(typ, text) {
          return '<li class="kollen__punkt kollen__punkt--' + typ + '">' + text + '</li>';
        }

        // Husbilderna finns också 800 px breda, i samma format (ingen
        // beskärning). Kortet tar den lilla och den stora bara vid behov.
        function bild(m, sizes) {
          if (!/^hus-r\\d\\.webp$/.test(m.bild)) return 'src="images/' + m.bild + '"';
          var liten = 'images/' + m.bild.replace('.webp', '-800.webp');
          return 'src="' + liten + '"' + (sizes ? ' srcset="' + liten + ' 800w, images/' + m.bild + ' 1600w" sizes="' + sizes + '"' : '');
        }

        // Husen ur ritningarna R1-R5 finns i 3D – dit går kortet direkt.
        function husKort(m, i, ok) {
          var med3d = /^hus-r\\d\\.webp$/.test(m.bild);
          return '<a class="tvhus' + (ok ? '' : ' tvhus--lov') + '" style="--i:' + i + '" href="' + m.sida + (med3d ? '#i-3d' : '') + '">' +
            '<span class="tvhus__bild"><img ' + bild(m, '(max-width: 700px) 92vw, 320px') + ' alt="" loading="lazy" decoding="async">' +
            '<span class="tvhus__ryms">' + (ok ? 'Ryms' : 'Kräver bygglov') + '</span>' + (med3d ? '<span class="tvhus__3d">Se i 3D</span>' : '') + '</span>' +
            '<span class="tvhus__kropp"><span class="tvhus__typ">' + m.kategori + '</span>' +
            '<strong>' + m.namn + '</strong>' +
            '<span class="tvhus__fakta"><b>' + m.yta + ' m²</b><i></i>' + m.rum + ' rum</span>' +
            '<span class="tvhus__pil" aria-hidden="true"></span></span></a>';
        }

        // Talen rullar fram till sitt nya värde.
        var lugnSvar = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Byter innehåll bara när det ändrats, så att korten inte gör
        // entré på nytt för varje steg i reglaget.
        function satt(el, html) {
          // #hus-lista är förrenderad i HTML. Första gången: byt bara om
          // innehållet faktiskt skiljer sig, så att korten inte gör entré två gånger.
          if (el.senast === undefined && el.hasAttribute('data-forrenderad')) {
            var t = document.createElement('template');
            t.innerHTML = html;
            el.removeAttribute('data-forrenderad');
            if (t.innerHTML === el.innerHTML) { el.senast = html; return; }
          }
          if (el.senast !== html) { el.innerHTML = html; el.senast = html; }
        }
        function rulla(el, mal, dec) {
          var fran = parseFloat(el.textContent.replace(',', '.')) || 0;
          var text = function (v) { return v.toFixed(dec).replace('.', ','); };
          if (el.rullar) cancelAnimationFrame(el.rullar);
          if (lugnSvar || Math.abs(fran - mal) < 0.001) { el.textContent = text(mal); return; }
          var t0 = performance.now();
          var steg = function (nu) {
            var k = Math.min(1, (nu - t0) / 750), e = 1 - Math.pow(1 - k, 3);
            el.textContent = text(fran + (mal - fran) * e);
            el.rullar = k < 1 ? requestAnimationFrame(steg) : 0;
          };
          el.rullar = requestAnimationFrame(steg);
        }

        function rakna() {
          var plan = vald('plan');
          var regel = REGLER[plan === 'utanfor' ? 'utanfor' : 'inom'];
          var perHus = regel[0], totalt = regel[1], hojd = regel[2];
          var befintligt = parseInt(reglage.value, 10) || 0;
          reglageUt.textContent = befintligt + ' m²';
          reglage.style.setProperty('--a', (befintligt / 65).toFixed(3));
          var kvar = Math.max(0, totalt - befintligt);
          var yta = Math.min(perHus, kvar);

          rulla(document.getElementById('svar-yta'), yta, 0);
          rulla(document.getElementById('svar-hojd'), parseFloat(hojd.replace(',', '.')), 1);
          // Tomtens lovfria yta som en stapel: det som finns, det nya huset
          // och det som blir kvar, av det som får byggas utan lov.
          var fanns = Math.min(befintligt, totalt), rest = Math.max(0, totalt - befintligt - yta);
          document.getElementById('yta-fanns').style.width = (fanns / totalt * 100).toFixed(2) + '%';
          document.getElementById('yta-nytt').style.width = (yta / totalt * 100).toFixed(2) + '%';
          document.getElementById('yta-kvar').style.width = (rest / totalt * 100).toFixed(2) + '%';
          satt(document.getElementById('svar-ytinfo'),
            '<span><i class="tv__ytprick tv__ytprick--fanns"></i>Finns ' + befintligt + '</span>' +
            '<span><i class="tv__ytprick tv__ytprick--nytt"></i>Nytt ' + yta + '</span>' +
            '<span><i class="tv__ytprick tv__ytprick--kvar"></i>Kvar ' + rest + '</span>' +
            '<em>av ' + totalt + ' m² utan lov</em>');
          // Huset i höjdrutan växer till nocken (4,5 m är fullt).
          document.getElementById('svar-nock').style.setProperty('--nock', (parseFloat(hojd.replace(',', '.')) / 4.5).toFixed(3));
          document.getElementById('tv-regler').setAttribute('data-vald', plan === 'utanfor' ? 'utanfor' : 'inom');
          document.getElementById('svar-hojdinfo').textContent = plan === 'utanfor' ? 'Utanför detaljplan'
            : (plan === 'vetej' ? 'Räknat som inom detaljplan' : 'Inom detaljplan');

          // Det som kräver lov eller dispens oavsett storlek, och om huset
          // man kom från ryms. Första punkten säger inte "utan lov" när
          // något längre ned säger emot.
          var grans = vald('grans'), vatten = vald('vatten');
          var villkor = grans === 'nara' || vatten === 'ja';
          var minsta = Math.min.apply(null, MODELLER.map(function (m) { return m.yta; }));
          var franOk = !fran || (yta > 0 && fran <= yta);
          var p = [];
          if (yta <= 0) {
            p.push(punkt('lov', 'Tomten har redan ' + befintligt + ' m² – ' +
              (befintligt > totalt ? 'mer än de ' + totalt + ' m² som får byggas utan lov.' : 'hela den yta som får byggas utan lov.') +
              ' Ett hus till kräver bygglov.'));
          } else if (yta < minsta) {
            p.push(punkt('info', 'Det finns ' + yta + ' m² kvar utan lov – för lite för något av våra hus.'));
          } else if (villkor) {
            p.push(punkt('info', 'Storleken, upp till ' + yta + ' m², klarar sig utan lov – men se nedan.'));
          } else {
            p.push(punkt('ok', 'Ett hus på upp till ' + yta + ' m² kräver varken bygglov eller anmälan för själva byggnaden.'));
          }
          if (plan === 'vetej') {
            p.push(punkt('info', 'Vi har räknat med inom detaljplan, som är strängast. Utanför kan det bli upp till 50 m².'));
          }
          if (grans === 'nara') {
            p.push(punkt('lov', 'Närmare än 4,5 m från tomtgränsen utan grannens medgivande kräver bygglov.'));
          } else if (grans === 'medgivande') {
            p.push(punkt('info', 'Be om grannens medgivande skriftligt och spara det.'));
          }
          if (vald('bo') === 'ja') {
            p.push(punkt('anmalan', 'Kök, badrum och eldstad anmäls till kommunen – för installationerna, inte för huset.'));
          }
          if (vatten === 'ja') {
            p.push(punkt('lov', 'Inom strandskydd krävs dispens, även för ett annars lovbefriat hus.'));
          } else if (vatten === 'vetej') {
            p.push(punkt('info', 'Kolla strandskyddet med kommunen. Det gäller oftast 100 m från stranden.'));
          }
          satt(document.getElementById('svar-lista'), p.join(''));
          var valt = document.getElementById('svar-valt');
          if (fran) {
            valt.hidden = false;
            valt.className = 'kollen__valt kollen__valt--' + (franOk ? 'ja' : 'nej');
            valt.textContent = franNamn + ' (' + fran + ' m²) ' + (!franOk ? 'ryms inte utan bygglov – det behöver sökas.'
              : (villkor ? 'ryms till ytan – men se nedan.' : 'ryms utan bygglov.'));
          }
          // Det strängaste svaret styr. Kräver något svar lov eller dispens
          // oavsett storlek läggs det till i stället för att ta över.
          var ocksa = villkor ? ', och något av svaren kräver lov eller dispens.' : '.';
          var summa = 'Det här ser ut att gå utan bygglov.', status = 'ok';
          if (yta <= 0) { summa = 'Ett hus till kräver bygglov här.'; status = 'lov'; }
          else if (yta < minsta) { summa = 'Bara ' + yta + ' m² kvar utan lov – våra hus kräver bygglov här' + ocksa; status = 'villkor'; }
          else if (!franOk) { summa = franNamn + ' kräver bygglov här' + (villkor ? ocksa : ' – ett hus på upp till ' + yta + ' m² går utan.'); status = 'villkor'; }
          else if (villkor) { summa = 'Det går, men något av svaren kräver lov eller dispens.'; status = 'villkor'; }
          document.getElementById('svar-summa').textContent = summa;
          document.getElementById('tv-svar').setAttribute('data-status', status);
          if (window.idealhusTomt) window.idealhusTomt({ plan: plan, yta: yta, perHus: perHus, hojd: hojd,
            befintligt: befintligt, grans: grans, bo: vald('bo'), vatten: vatten });

          var ryms = MODELLER.filter(function (m) { return yta > 0 && m.yta <= yta; })
            .sort(function (a, b) { return b.yta - a.yta; });
          document.getElementById('hus-rubrik').textContent = ryms.length
            ? ryms.length + (ryms.length === 1 ? ' modell' : ' modeller') + ' upp till ' + yta + ' m²'
            : 'Hus som kräver bygglov';
          // Husen som inte ryms står efter, nedtonade, med vad som krävs.
          var inte = MODELLER.filter(function (m) { return ryms.indexOf(m) === -1; })
            .sort(function (a, b) { return a.yta - b.yta; });
          satt(document.getElementById('hus-lista'), ryms.map(function (m, i) { return husKort(m, i, true); }).join('') +
            inte.map(function (m, i) { return husKort(m, ryms.length + i, false); }).join(''));
          document.getElementById('hus-tomt').hidden = ryms.length > 0;

          // Fyra rutor med det som gäller, i samma ordning som frågorna.
          var bo = vald('bo');
          var rutor = [
            ['Bygglov', yta <= 0 || grans === 'nara' ? ['nej', 'Krävs']
              : (!franOk ? ['villkor', 'Krävs för ' + (franModell ? franModell.namn : fran + ' m²')]
                : (yta < minsta ? ['villkor', 'Krävs för våra hus'] : ['ok', 'Behövs inte'])), 'M6.5 3.5h8L18.5 7.5v13h-12zM9.5 12h6M9.5 15.5h4'],
            ['Anmälan', bo === 'ja' ? ['villkor', 'För kök, bad, eldstad'] : ['ok', 'Behövs inte'], 'M4 7h16v11H4zM4.5 7.5l7.5 6 7.5-6'],
            ['Grannen', grans === 'langt' ? ['ok', 'Behövs inte'] : (grans === 'medgivande' ? ['villkor', 'Skriftligt medgivande'] : ['nej', 'Medgivande saknas']), 'M3 20v-8l4.5-3.5L12 12v8M12 20v-5.5l4.5-3.5 4.5 3.5V20M2 20h20'],
            ['Strandskydd', vatten === 'ja' ? ['nej', 'Dispens krävs'] : (vatten === 'vetej' ? ['villkor', 'Kolla med kommunen'] : ['ok', 'Inte aktuellt']), 'M2.5 14c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.7-2 2.4 2 4.8 2M2.5 18.5c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.7-2 2.4 2 4.8 2M12 3.5v5M9.5 6l2.5-2.5L14.5 6']
          ];
          satt(document.getElementById('svar-status'), rutor.map(function (r, i) {
            return '<li class="tv__stat tv__stat--' + r[1][0] + '" style="--i:' + i + '">' +
              '<span class="tv__stat-ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="' + r[2] + '"/></svg></span>' +
              '<span class="tv__stat-namn">' + r[0] + '</span><strong>' + r[1][1] + '</strong></li>';
          }).join(''));

          // Vilka av våra hus som ryms, med en länk ned till korten.
          var rymsLank = document.getElementById('svar-ryms');
          satt(rymsLank, '<span class="tv__ryms-bilder">' + (ryms.length ? ryms : MODELLER).slice(0, 3).map(function (m) {
              return '<img ' + bild(m) + ' alt="" loading="lazy" decoding="async">';
            }).join('') + '</span>' +
            '<span class="tv__ryms-text"><strong>' + (ryms.length
              ? (ryms.length === MODELLER.length ? 'Alla våra hus ryms' : ryms.length + ' av våra ' + MODELLER.length + ' hus ryms')
              : 'Inget av våra hus ryms utan lov') + '</strong>' +
            '<em>' + (ryms.length ? ryms.map(function (m) { return m.namn; }).join(', ') : 'Se vad som går med bygglov') + '</em></span>' +
            '<span class="tv__ryms-pil" aria-hidden="true"></span>');
          rymsLank.classList.toggle('tv__ryms--inga', !ryms.length);
        }

        var adress = new URLSearchParams(location.search);
        ['plan', 'grans', 'bo', 'vatten'].forEach(function (namn) {
          var v = adress.get(namn);
          var el = v && form.querySelector('input[name="' + namn + '"][value="' + v.replace(/[^a-z]/g, '') + '"]');
          if (el) el.checked = true;
        });
        var bef = parseInt(adress.get('befintligt'), 10);
        if (bef >= 0 && bef <= 65) reglage.value = bef;
        var fran = parseInt(adress.get('yta'), 10);
        var franNamn = (adress.get('namn') || 'Huset du tittade på').slice(0, 60);
        var franModell = MODELLER.filter(function (m) { return franNamn.toLowerCase().indexOf(m.namn.toLowerCase()) !== -1; })
          .sort(function (a, b) { return b.namn.length - a.namn.length; })[0];
        if (franModell) franNamn = franModell.namn;

        function skrivAdress() {
          var q = new URLSearchParams();
          ['plan', 'grans', 'bo', 'vatten'].forEach(function (n) { q.set(n, vald(n)); });
          q.set('befintligt', reglage.value);
          if (fran) { q.set('yta', fran); q.set('namn', franNamn); }
          history.replaceState(null, '', '?' + q.toString());
        }

        var dela = document.getElementById('svar-dela');
        if (!navigator.clipboard) dela.hidden = true;
        dela.addEventListener('click', function () {
          skrivAdress();
          navigator.clipboard.writeText(location.href).then(function () {
            dela.textContent = 'Länken är kopierad';
            setTimeout(function () { dela.textContent = 'Kopiera länk till svaret'; }, 2000);
          });
        });

        form.addEventListener('change', skrivAdress);
        reglage.addEventListener('change', skrivAdress);
        // PDF:en visar länken till svaret, så adressen ska vara aktuell.
        window.addEventListener('beforeprint', skrivAdress);
        var vantar = 0;
        function planera() {
          if (!vantar) vantar = requestAnimationFrame(function () { vantar = 0; rakna(); });
        }
        form.addEventListener('input', planera);
        form.addEventListener('change', planera);
        form.addEventListener('submit', function (e) { e.preventDefault(); });
        rakna();
      })();

      /* Två scener i riktig 3D (2026-10-07): huset i toppen och marken i
         genomskärning vid markkollen. Allt mäts i meter, vrids runt
         lodaxeln och ritas med parallellprojektion. Ytor som vänder sig
         bort ritas inte och resten ritas bakifrån och fram, så scenen kan
         vridas fritt inom sina gränser. Scenerna byggs upp när de syns,
         vaggar sakta och går att vrida med musen eller fingret. När
         rörelser är avstängda står de färdiga och stilla. */
      (function () {
        var scener = document.querySelectorAll('[data-vf3d]');
        if (!scener.length || !window.requestAnimationFrame) return;
        var lugn = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var GRAD = Math.PI / 180;
        var SE = Math.sin(30 * GRAD), CE = Math.cos(30 * GRAD);
        var LJ = enhet([-0.3, 0.75, 0.65]);
        var SOL = [0.3, -0.55];

        function enhet(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
        function klamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
        function mjuk(t) { t = klamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
        function fas(t, fran, langd) { return mjuk((t - fran) / langd); }
        // Livet i scenen (vaggning, vind, rök och regn) pågår en stund efter
        // bygget och saktar sedan mjukt in tills allt står still.
        var VILA = 5.5, LANGD = 3, LIV_SLUT = VILA + LANGD;
        function livTid(t) {
          if (t <= VILA) return t;
          var u = Math.min(1, (t - VILA) / LANGD);
          return VILA + LANGD * (u - u * u * u + u * u * u * u / 2);
        }
        function svaj(t) { var u = klamp((t - VILA) / LANGD, 0, 1); return 1 - u * u * (3 - 2 * u); }
        function ton(c, n, a) {
          n = enhet(n);
          var d = n[0] * LJ[0] + n[1] * LJ[1] + n[2] * LJ[2];
          var f = klamp(0.56 + 0.58 * d, 0.42, 1.16);
          return 'rgba(' + Math.round(klamp(c[0] * f, 0, 255)) + ',' + Math.round(klamp(c[1] * f, 0, 255)) + ',' +
            Math.round(klamp(c[2] * f, 0, 255)) + ',' + (a === undefined ? 1 : a) + ')';
        }

        function Kamera(vinkel, S, cx, cy) {
          var c = Math.cos(vinkel), s = Math.sin(vinkel);
          this.p = function (x, y, z) { return [cx + (x * c - y * s) * S, cy + ((x * s + y * c) * SE - z * CE) * S]; };
          this.djup = function (x, y, z) { return (x * s + y * c) * CE + (z || 0) * SE; };
          this.mot = function (n) { n = enhet(n); return (n[0] * s + n[1] * c) * CE + n[2] * SE; };
          this.S = S;
        }
        function pkt(K, a) { var q = K.p(a[0], a[1], a[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }
        function yta(K, lista, fyll, extra) {
          return '<polygon points="' + lista.map(function (a) { return pkt(K, a); }).join(' ') + '" fill="' + fyll + '"' + (extra || '') + '/>';
        }
        function linje(K, lista, farg, b, extra) {
          return '<polyline points="' + lista.map(function (a) { return pkt(K, a); }).join(' ') + '" fill="none" stroke="' + farg +
            '" stroke-width="' + b + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
        }
        // En cirkel i ett plan: 'z' liggande, 'x' eller 'y' stående.
        function ring(cx, cy, cz, r, axel, n) {
          var a = [];
          for (var i = 0; i < n; i++) {
            var v = i / n * Math.PI * 2, u = Math.cos(v) * r, w = Math.sin(v) * r;
            a.push(axel === 'z' ? [cx + u, cy + w, cz] : (axel === 'x' ? [cx, cy + u, cz + w] : [cx + u, cy, cz + w]));
          }
          return a;
        }
        // Konvext hölje av punkter i planet (för skuggor och rör).
        function holje(p) {
          p = p.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
          var kryss = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
          var ned = [], upp = [], i;
          for (i = 0; i < p.length; i++) { while (ned.length > 1 && kryss(ned[ned.length - 2], ned[ned.length - 1], p[i]) <= 0) ned.pop(); ned.push(p[i]); }
          for (i = p.length - 1; i >= 0; i--) { while (upp.length > 1 && kryss(upp[upp.length - 2], upp[upp.length - 1], p[i]) <= 0) upp.pop(); upp.push(p[i]); }
          return ned.slice(0, -1).concat(upp.slice(0, -1));
        }
        function plan2d(pts2) { return pts2.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '); }
        // Skugga på marken av en samling 3D-punkter, mjuk.
        function skugga(K, punkter, a, filter) {
          var mark = punkter.map(function (q) { return [q[0] + SOL[0] * q[2], q[1] + SOL[1] * q[2]]; });
          var h = holje(mark);
          return '<polygon points="' + h.map(function (q) { return pkt(K, [q[0], q[1], 0.005]); }).join(' ') +
            '" fill="rgba(52,38,24,' + a + ')" filter="url(#' + filter + ')"/>';
        }
        // En låda: sidor som syns, sedan toppen.
        function lada(K, x0, x1, y0, y1, z0, z1, farg, topp, extra) {
          var h = '';
          [[[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
           [[-1, 0, 0], [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]]],
           [[0, 1, 0], [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]]],
           [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]]].forEach(function (f) {
            if (K.mot(f[0]) > 0.001) h += yta(K, f[1], ton(farg, f[0]), extra);
          });
          return h + yta(K, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], topp || ton(farg, [0, 0, 1]), extra);
        }

        /* --- Ett hus med sadeltak, nock längs x ------------------------- */
        var FASAD = [44, 39, 35], TAK = [58, 53, 48], LIST = [30, 27, 24], SOCKEL = [150, 145, 138], VIRKE = [205, 156, 106];
        function hus(K, o, k, kFon, tid) {
          if (k < 0.01) return '';
          var x0 = o.x0, x1 = o.x1, b = o.b, e = o.e * k, r = o.r * k, ov = o.ov, oy = o.oy;
          var lut = (r - e) / b, h = '', i;
          var takZ = function (y) { return e + (b - Math.abs(y)) * lut; };
          var vy = K.mot([0, 1, 0]) > 0 ? 1 : -1;
          var vx = K.mot([-1, 0, 0]) > 0 ? -1 : 1;
          var gx = vx < 0 ? x0 : x1;
          var fonster = function (lista) {
            var f = '';
            lista.forEach(function (w) {
              var p;
              if (w.v === 'y') {
                if (w.s !== vy) return;
                p = [[w.a0, vy * b, w.z0 * k], [w.a1, vy * b, w.z0 * k], [w.a1, vy * b, w.z1 * k], [w.a0, vy * b, w.z1 * k]];
              } else {
                if (w.s !== vx) return;
                p = [[gx, w.a0, w.z0 * k], [gx, w.a1, w.z0 * k], [gx, w.a1, w.z1 * k], [gx, w.a0, w.z1 * k]];
              }
              if (w.t === 'dorr') {
                f += yta(K, p, ton(VIRKE, w.v === 'y' ? [0, vy, 0] : [vx, 0, 0]), ' stroke="#15120f" stroke-width="1.2"');
                var hp = w.v === 'y' ? [w.a1 - 0.18, vy * b, 1.0 * k] : [gx, w.a1 - 0.18, 1.0 * k];
                var hq = K.p(hp[0], hp[1], hp[2]);
                f += '<circle cx="' + hq[0].toFixed(1) + '" cy="' + hq[1].toFixed(1) + '" r="1.6" fill="#e3b25a"/>';
              } else {
                f += yta(K, p, 'url(#' + o.id + '-glas)', ' stroke="#15120f" stroke-width="1.6"');
                // En reflex snett över glaset.
                var t0 = 0.3, t1 = 0.52, za = w.z0 * k, zb = w.z1 * k, dz = zb - za;
                var ref = w.v === 'y'
                  ? [[w.a0 + (w.a1 - w.a0) * t0, vy * b, zb], [w.a0 + (w.a1 - w.a0) * t1, vy * b, zb], [w.a0 + (w.a1 - w.a0) * (t1 - 0.22), vy * b, za + dz * 0.3], [w.a0 + (w.a1 - w.a0) * (t0 - 0.22), vy * b, za + dz * 0.3]]
                  : [[gx, w.a0 + (w.a1 - w.a0) * t0, zb], [gx, w.a0 + (w.a1 - w.a0) * t1, zb], [gx, w.a0 + (w.a1 - w.a0) * (t1 - 0.22), za + dz * 0.3], [gx, w.a0 + (w.a1 - w.a0) * (t0 - 0.22), za + dz * 0.3]];
                f += yta(K, ref, 'rgba(255,255,255,.22)');
                if (w.post) {
                  var m = (w.a0 + w.a1) / 2;
                  f += linje(K, w.v === 'y' ? [[m, vy * b, w.z0 * k], [m, vy * b, w.z1 * k]] : [[gx, m, w.z0 * k], [gx, m, w.z1 * k]], '#15120f', 1.6);
                }
              }
            });
            return f;
          };
          var altan = function () {
            if (!o.altan) return '';
            var a = o.altan, ka = a.k;
            if (ka < 0.01) return '';
            var zt = 0.24 * ka, f = lada(K, a.x0, a.x1, b, b + a.d, 0, zt, VIRKE);
            for (var py = b + 0.2; py < b + a.d - 0.05; py += 0.2) f += linje(K, [[a.x0, py, zt + 0.002], [a.x1, py, zt + 0.002]], 'rgba(120,80,40,.28)', 0.9);
            if (a.kruka) {
              var kx = a.x1 - 0.35, ky = b + a.d - 0.35;
              f += lada(K, kx - 0.16, kx + 0.16, ky - 0.16, ky + 0.16, zt, zt + 0.36 * ka, [190, 110, 70]);
              var kq = K.p(kx, ky, zt + 0.62 * ka);
              f += '<circle cx="' + kq[0].toFixed(1) + '" cy="' + kq[1].toFixed(1) + '" r="' + (0.3 * K.S * ka).toFixed(1) + '" fill="url(#' + o.id + '-krona)"/>';
            }
            return f;
          };
          var altanFram = o.altan && K.mot([0, 1, 0]) > 0;
          if (o.altan && !altanFram) h += altan();

          // Långväggen som syns.
          var nY = [0, vy, 0];
          h += yta(K, [[x0, vy * b, 0], [x1, vy * b, 0], [x1, vy * b, e], [x0, vy * b, e]], ton(FASAD, nY));
          h += yta(K, [[x0, vy * b, 0], [x1, vy * b, 0], [x1, vy * b, 0.22 * k], [x0, vy * b, 0.22 * k]], ton(SOCKEL, nY));
          var panel = '';
          for (i = x0 + 0.3; i < x1 - 0.05; i += 0.3) panel += pkt(K, [i, vy * b, 0.22 * k]) + ' ' + pkt(K, [i, vy * b, e]) + ' ';
          // Gaveln som syns, femhörning upp till nocken.
          var nX = [vx, 0, 0];
          h += yta(K, [[gx, -b, 0], [gx, b, 0], [gx, b, e], [gx, 0, r], [gx, -b, e]], ton(FASAD, nX));
          h += yta(K, [[gx, -b, 0], [gx, b, 0], [gx, b, 0.22 * k], [gx, -b, 0.22 * k]], ton(SOCKEL, nX));
          var gpanel = '';
          for (i = -b + 0.3; i < b - 0.05; i += 0.3) gpanel += pkt(K, [gx, i, 0.22 * k]) + ' ' + pkt(K, [gx, i, takZ(i) - 0.04]) + ' ';
          h += '<path d="' + (panel + gpanel).trim().split(' ').map(function (q, j) { return (j % 2 ? 'L' : 'M') + q; }).join('') + '" stroke="rgba(255,255,255,.07)" stroke-width="1" fill="none"/>';
          // Hörnlister.
          h += linje(K, [[x0, vy * b, 0.22 * k], [x0, vy * b, e]], 'rgba(255,255,255,.12)', 1.4) + linje(K, [[x1, vy * b, 0.22 * k], [x1, vy * b, e]], 'rgba(255,255,255,.12)', 1.4);
          if (kFon > 0.01) h += '<g opacity="' + kFon.toFixed(2) + '">' + fonster(o.fonster) + '</g>';
          if (o.altan && altanFram) h += altan();

          // Taket: planet som vänder sig minst mot oss först.
          var plan = [-1, 1].map(function (s) {
            var n = [0, s * (r - e), b];
            var ze = e - oy * lut;
            return { s: s, n: n, mot: K.mot(n), p: [[x0 - ov, s * (b + oy), ze], [x1 + ov, s * (b + oy), ze], [x1 + ov, 0, r], [x0 - ov, 0, r]] };
          }).sort(function (a, c) { return a.mot - c.mot; });
          var skorsten = function () {
            if (!o.skorsten) return '';
            var sx = o.skorsten[0], sy = o.skorsten[1], zb = takZ(sy) - 0.1, zt = r + 0.5 * k;
            var f = lada(K, sx - 0.13, sx + 0.13, sy - 0.13, sy + 0.13, zb, zt, [40, 36, 32]);
            f += lada(K, sx - 0.17, sx + 0.17, sy - 0.17, sy + 0.17, zt, zt + 0.05, [60, 55, 50]);
            if (k > 0.98 && tid !== null) {
              for (var j = 0; j < 5; j++) {
                var fs = ((tid / 4.2) + j / 5) % 1;
                var rp = K.p(sx + fs * 0.6 + Math.sin(fs * 6 + j) * 0.08, sy - fs * 0.3, zt + 0.1 + fs * 1.5);
                f += '<circle cx="' + rp[0].toFixed(1) + '" cy="' + rp[1].toFixed(1) + '" r="' + ((0.07 + fs * 0.17) * K.S).toFixed(1) +
                  '" fill="#ede7dd" stroke="rgba(27,25,21,.12)" stroke-width=".8" opacity="' + (Math.sin(Math.min(1, fs * 1.3) * Math.PI) * 0.8).toFixed(2) + '"/>';
              }
            }
            return f;
          };
          plan.forEach(function (pl, j) {
            if (pl.mot > 0) {
              h += yta(K, pl.p, ton(TAK, pl.n));
              var fals = '';
              for (var fx = x0 - ov + 0.42; fx < x1 + ov - 0.1; fx += 0.42) fals += 'M' + pkt(K, [fx, pl.s * (b + oy), e - oy * lut]) + 'L' + pkt(K, [fx, 0, r]);
              h += '<path d="' + fals + '" stroke="rgba(255,255,255,.08)" stroke-width="1" fill="none"/>';
            }
            if (o.skorsten && (o.skorsten[1] < 0 ? -1 : 1) === pl.s) h += skorsten();
          });
          // Taklister: takfoten på sidan som syns och vindskivorna på gaveln.
          var ze2 = e - oy * lut;
          h += yta(K, [[x0 - ov, vy * (b + oy), ze2], [x1 + ov, vy * (b + oy), ze2], [x1 + ov, vy * (b + oy), ze2 - 0.15], [x0 - ov, vy * (b + oy), ze2 - 0.15]], ton(LIST, nY));
          var gv = vx < 0 ? x0 - ov : x1 + ov;
          h += yta(K, [[gv, -(b + oy), ze2], [gv, 0, r], [gv, 0, r - 0.16], [gv, -(b + oy), ze2 - 0.15]], ton(LIST, nX));
          h += yta(K, [[gv, b + oy, ze2], [gv, 0, r], [gv, 0, r - 0.16], [gv, b + oy, ze2 - 0.15]], ton(LIST, nX));
          h += linje(K, [[x0 - ov, 0, r + 0.02], [x1 + ov, 0, r + 0.02]], 'rgba(255,255,255,.22)', 2);
          return h;
        }

        /* --- Träd, buskar och annat i skärmplanet ----------------------- */
        function lovtrad(K, id, x, y, hojd, rad, g, tid) {
          if (g < 0.01) return '';
          var bas = K.p(x, y, 0), topp = K.p(x, y, hojd * 0.62 * g), kr = K.p(x, y, hojd * 0.72 * g), R = rad * K.S * g;
          var vind = tid === null ? 0 : Math.sin(tid * 0.9 + x) * 1.4;
          return '<line x1="' + bas[0].toFixed(1) + '" y1="' + bas[1].toFixed(1) + '" x2="' + topp[0].toFixed(1) + '" y2="' + topp[1].toFixed(1) + '" stroke="#6b4f36" stroke-width="' + (0.16 * K.S).toFixed(1) + '" stroke-linecap="round"/>' +
            '<circle cx="' + (kr[0] - R * 0.55 + vind).toFixed(1) + '" cy="' + (kr[1] + R * 0.18).toFixed(1) + '" r="' + (R * 0.74).toFixed(1) + '" fill="#5a8660"/>' +
            '<circle cx="' + (kr[0] + R * 0.5 + vind).toFixed(1) + '" cy="' + (kr[1] + R * 0.12).toFixed(1) + '" r="' + (R * 0.7).toFixed(1) + '" fill="#4f7a55"/>' +
            '<circle cx="' + (kr[0] + vind * 1.3).toFixed(1) + '" cy="' + (kr[1] - R * 0.32).toFixed(1) + '" r="' + (R * 0.82).toFixed(1) + '" fill="url(#' + id + '-krona)"/>';
        }
        function gran(K, x, y, hojd, g, tid) {
          if (g < 0.01) return '';
          var h = '', bas = K.p(x, y, 0), stam = K.p(x, y, hojd * 0.18 * g), vind = tid === null ? 0 : Math.sin(tid * 0.8 + y) * 1.1;
          h += '<line x1="' + bas[0].toFixed(1) + '" y1="' + bas[1].toFixed(1) + '" x2="' + stam[0].toFixed(1) + '" y2="' + stam[1].toFixed(1) + '" stroke="#6b4f36" stroke-width="' + (0.14 * K.S).toFixed(1) + '" stroke-linecap="round"/>';
          [[0.15, 0.62, 0.9], [0.4, 0.84, 0.68], [0.62, 1, 0.46]].forEach(function (v) {
            var b0 = K.p(x, y, hojd * v[0] * g), t0 = K.p(x, y, hojd * v[1] * g), w = v[2] * K.S * g;
            var tx = t0[0] + vind * v[1];
            h += '<polygon points="' + tx.toFixed(1) + ',' + t0[1].toFixed(1) + ' ' + (b0[0] - w).toFixed(1) + ',' + b0[1].toFixed(1) + ' ' + b0[0].toFixed(1) + ',' + (b0[1] + w * 0.22).toFixed(1) + '" fill="#6f9a6a"/>' +
              '<polygon points="' + tx.toFixed(1) + ',' + t0[1].toFixed(1) + ' ' + b0[0].toFixed(1) + ',' + (b0[1] + w * 0.22).toFixed(1) + ' ' + (b0[0] + w).toFixed(1) + ',' + b0[1].toFixed(1) + '" fill="#436b4f"/>';
          });
          return h;
        }
        function buske(K, id, x, y, rad, g) {
          if (g < 0.01) return '';
          var c = K.p(x, y, rad * 0.7 * g), R = rad * K.S * g;
          return '<circle cx="' + (c[0] - R * 0.5).toFixed(1) + '" cy="' + (c[1] + R * 0.15).toFixed(1) + '" r="' + (R * 0.72).toFixed(1) + '" fill="#4f7a55"/>' +
            '<circle cx="' + (c[0] + R * 0.5).toFixed(1) + '" cy="' + (c[1] + R * 0.2).toFixed(1) + '" r="' + (R * 0.66).toFixed(1) + '" fill="#436b4f"/>' +
            '<circle cx="' + c[0].toFixed(1) + '" cy="' + (c[1] - R * 0.25).toFixed(1) + '" r="' + (R * 0.75).toFixed(1) + '" fill="url(#' + id + '-krona)"/>';
        }
        function stolpe(K, x, y, g) {
          if (g < 0.01) return '';
          var a = K.p(x, y, 0), b = K.p(x, y, 0.62 * g);
          return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#c9975a" stroke-width="3.2" stroke-linecap="round"/>' +
            '<circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="2.6" fill="#f0b56e"/>';
        }
        // Del av en sluten linje, för gränsen som ritas fram.
        function delAv(lista, k) {
          if (k >= 1) return lista;
          var langd = 0, i, d = [];
          for (i = 1; i < lista.length; i++) { var l = Math.hypot(lista[i][0] - lista[i - 1][0], lista[i][1] - lista[i - 1][1]); d.push(l); langd += l; }
          var kvar = langd * k, ut = [lista[0]];
          for (i = 1; i < lista.length && kvar > 0; i++) {
            if (d[i - 1] <= kvar) { ut.push(lista[i]); kvar -= d[i - 1]; } else {
              var f = kvar / d[i - 1];
              ut.push([lista[i - 1][0] + (lista[i][0] - lista[i - 1][0]) * f, lista[i - 1][1] + (lista[i][1] - lista[i - 1][1]) * f, lista[i - 1][2]]);
              kvar = 0;
            }
          }
          return ut;
        }
        function matt(K, a, b, farg, tick) {
          var h = linje(K, [a, b], farg, 1.8);
          [a, b].forEach(function (q) { h += linje(K, [[q[0] - tick[0], q[1] - tick[1], q[2] - tick[2]], [q[0] + tick[0], q[1] + tick[1], q[2] + tick[2]]], farg, 1.8); });
          return h;
        }

        /* --- Scenen i toppen: huset på tomten ---------------------------- */
        function husScen(K, t, tid) {
          var h = '', id = 'vfh';
          var X = 7, Y = 5.5, D = 0.55, G = 6.4, GY = 4.9;
          // Plattan: sidorna med gräskant och jord, sedan gräset.
          [[[1, 0, 0], X, 'x'], [[-1, 0, 0], -X, 'x'], [[0, 1, 0], Y, 'y'], [[0, -1, 0], -Y, 'y']].forEach(function (f) {
            if (K.mot(f[0]) <= 0.001) return;
            var v = f[1], p = function (u, z) { return f[2] === 'x' ? [v, u, z] : [u, v, z]; }, m = f[2] === 'x' ? Y : X;
            h += yta(K, [p(-m, -D), p(m, -D), p(m, -0.14), p(-m, -0.14)], ton([128, 96, 66], f[0]));
            h += yta(K, [p(-m, -0.14), p(m, -0.14), p(m, 0), p(-m, 0)], ton([112, 158, 90], f[0]));
            h += linje(K, [p(-m, -0.36), p(m, -0.36)], 'rgba(60,40,20,.18)', 1);
            h += linje(K, [p(-m, 0), p(m, 0)], 'rgba(255,255,255,.4)', 1.2);
          });
          h += yta(K, [[-X, -Y, 0], [X, -Y, 0], [X, Y, 0], [-X, Y, 0]], 'url(#' + id + '-gras)');
          for (var sx = -X; sx < X; sx += 1.75 * 2) h += yta(K, [[sx, -Y, 0], [sx + 1.75, -Y, 0], [sx + 1.75, Y, 0], [sx, Y, 0]], 'rgba(255,255,255,.07)');

          // Gränsen ritas fram, stolparna kommer upp.
          var kG = fas(t, 0.2, 1.4);
          if (kG > 0) h += linje(K, delAv([[-G, -GY, 0.01], [G, -GY, 0.01], [G, GY, 0.01], [-G, GY, 0.01], [-G, -GY, 0.01]], kG), '#e8a456', 2.2, ' stroke-dasharray="8 6"');
          // Stigen från dörren.
          [-2.55, -3.3, -4.05, -4.8, -5.55].forEach(function (px, i) {
            var g = fas(t, 1.6 + i * 0.06, 0.4);
            if (g > 0) h += yta(K, ring(px, 1.0 + (i % 2 ? 0.1 : -0.08), 0.01, 0.3 * g, 'z', 10), '#ddd5c6', ' stroke="rgba(27,25,21,.12)" stroke-width=".8"');
          });

          var kFot = fas(t, 0.5, 0.6), kHus = fas(t, 0.9, 1.4), kFon = fas(t, 2.0, 0.6), kM = fas(t, 2.3, 0.9);
          var o = { id: id, x0: -1.9, x1: 4.1, b: 2.5, e: 2.6, r: 4.0, ov: 0.28, oy: 0.3, skorsten: [2.9, -1.05],
            altan: { x0: -0.4, x1: 3.6, d: 1.25, k: fas(t, 1.8, 0.6), kruka: true },
            fonster: [
              { v: 'y', s: 1, a0: -0.1, a1: 1.5, z0: 0.22, z1: 2.3, post: true },
              { v: 'y', s: 1, a0: 1.9, a1: 3.5, z0: 0.22, z1: 2.3, post: true },
              { v: 'y', s: -1, a0: 0.4, a1: 1.8, z0: 1.0, z1: 2.0 },
              { v: 'x', s: -1, a0: 0.55, a1: 1.45, z0: 0.22, z1: 2.05, t: 'dorr' },
              { v: 'x', s: -1, a0: -1.75, a1: -0.65, z0: 1.0, z1: 1.9 },
              { v: 'x', s: -1, a0: -0.32, a1: 0.32, z0: 2.75, z1: 3.3 },
              { v: 'x', s: 1, a0: -0.8, a1: 0.8, z0: 0.9, z1: 2.0 }
            ] };
          // Skuggor och fotavtrycket.
          if (kHus > 0.01) {
            h += skugga(K, [[o.x0, -2.5, 0], [o.x1, -2.5, 0], [o.x1, 2.5, 0], [o.x0, 2.5, 0], [o.x0 - 0.3, -2.8, 2.45 * kHus], [o.x1 + 0.3, -2.8, 2.45 * kHus], [o.x1 + 0.3, 2.8, 2.45 * kHus], [o.x0 - 0.3, 2.8, 2.45 * kHus], [o.x0 - 0.3, 0, 4 * kHus], [o.x1 + 0.3, 0, 4 * kHus]], 0.2, id + '-mjuk');
            h += yta(K, [[o.x0 - 0.25, -2.75, 0.005], [o.x1 + 0.25, -2.75, 0.005], [o.x1 + 0.25, 2.75, 0.005], [o.x0 - 0.25, 2.75, 0.005]], 'rgba(40,28,16,.22)', ' filter="url(#' + id + '-mjuk)"');
          }
          var fotA = kFot * (1 - kHus * 0.85);
          if (fotA > 0.02) h += yta(K, [[o.x0, -2.5, 0.01], [o.x1, -2.5, 0.01], [o.x1, 2.5, 0.01], [o.x0, 2.5, 0.01]], 'rgba(240,181,110,' + (0.3 * fotA).toFixed(2) + ')', ' stroke="#e8a456" stroke-width="2" stroke-dasharray="6 4" opacity="' + Math.min(1, fotA * 1.4).toFixed(2) + '"');
          // Avståndet till gränsen, på marken.
          if (kM > 0) h += matt(K, [o.x0, -1.0, 0.02], [o.x0 + (-G - o.x0) * kM, -1.0, 0.02], '#2f8a52', [0, 0.3, 0]);

          // Det som står upp, bakifrån och fram.
          var saker = [];
          var lagg = function (x, y, html) { saker.push({ d: K.djup(x, y, 0), h: html }); };
          [[-G, -GY], [G, -GY], [G, GY], [-G, GY]].forEach(function (q, i) { lagg(q[0], q[1], stolpe(K, q[0], q[1], fas(t, 0.6 + i * 0.25, 0.5))); });
          [[5.3, -3.9, 4.4, 1.25, 'lov'], [-5.7, -3.9, 4.6, 0, 'gran'], [6.0, 3.6, 3.0, 0.85, 'lov'], [-6.25, -1.75, 2.6, 0, 'gran']].forEach(function (q, i) {
            var x = q[0], y = q[1], g = fas(t, 1.2 + i * 0.15, 0.8);
            var sk = g > 0.01 ? yta(K, ring(x + 0.5, y - 0.9, 0.006, (q[3] || 0.8) * g, 'z', 14), 'rgba(52,38,24,.16)', ' filter="url(#' + id + '-mjuk)"') : '';
            lagg(x, y, sk + (q[4] === 'lov' ? lovtrad(K, id, x, y, q[2], q[3], g, lugn ? null : tid) : gran(K, x, y, q[2], g, lugn ? null : tid)));
          });
          [[-1.0, 3.35, 0.45], [4.65, 3.0, 0.5], [1.6, -3.35, 0.55], [-3.0, -3.7, 0.4]].forEach(function (q, i) { lagg(q[0], q[1], buske(K, id, q[0], q[1], q[2], fas(t, 1.5 + i * 0.1, 0.6))); });
          lagg(1.1, 0, hus(K, o, kHus, kFon, lugn ? null : tid));
          // Nockhöjden vid gaveln, med en streckad linje från nocken.
          var hx = o.x0 - 0.3, hy = -3.55;
          var synG = klamp((K.mot([-1, 0, 0]) - 0.05) / 0.15, 0, 1);
          if (kM > 0 && synG > 0) {
            var mh = '<g opacity="' + synG.toFixed(2) + '">' + linje(K, [[o.x0 - o.ov, 0, 4 * kHus], [hx, hy, 4 * kHus]], 'rgba(143,84,36,.55)', 1.2, ' stroke-dasharray="3 3" opacity="' + kM.toFixed(2) + '"');
            mh += matt(K, [hx, hy, 0], [hx, hy, 4 * kHus * kM], '#8f5424', [0.25, 0, 0]) + '</g>';
            lagg(hx, hy, mh);
          }
          saker.sort(function (a, b) { return a.d - b.d; }).forEach(function (s) { h += s.h; });
          return {
            h: h,
            ankare: {
              yta: [1.1, 0, 4 * kHus + 0.15],
              hojd: [hx, hy, 2 * kHus],
              avstand: [(o.x0 - G) / 2, -1.0, 0.02]
            },
            synlig: { yta: true, hojd: K.mot([-1, 0, 0]) > 0.12, avstand: K.mot([-1, 0, 0]) > 0.12 },
            start: { yta: 2.4, hojd: 2.7, avstand: 2.9 }
          };
        }

        /* --- Marken i genomskärning -------------------------------------- */
        // Innan någon sökt visar blocket fyra typiska lager. Efter en
        // sökning ritas tomtens egen profil (window.idealhusMark): det
        // översta jordlagret ur SGU:s karta med rätt material, ett tunt
        // ytlager om kartan har ett, berget på det djup modellen anger
        // (hoptryckt när det är djupt), vattnet som sjunker i den takt
        // genomsläppligheten säger och ledningarna som okända.
        var MATERIAL = {
          matjord: [112, 80, 54], lera: [178, 142, 106], silt: [192, 168, 132], moranlera: [152, 136, 114],
          moran: [158, 149, 132], sand: [218, 186, 130], grus: [192, 166, 126], torv: [96, 70, 48],
          fyllning: [148, 128, 106], block: [138, 133, 124], berg: [116, 119, 126], vatten: [106, 160, 206],
          okand: [170, 156, 136]
        };
        var PRICK = {
          matjord: '#70503a', lera: '#b28e6a', silt: '#bfa684', moranlera: '#988872', moran: '#9e9584',
          sand: '#d6b47c', grus: '#bea47c', torv: '#604630', fyllning: '#94806a', block: '#8a857c',
          berg: '#74777e', vatten: '#6aa0ce', okand: '#aa9c88'
        };
        var STANDARD = [
          { id: 'matjord', typ: 'matjord', tj: 0.7 },
          { id: 'lera', typ: 'lera', tj: 1.3 },
          { id: 'moran', typ: 'moran', tj: 1.4 },
          { id: 'berg', typ: 'berg', tj: 1.2 }
        ];
        var VATTENFART = { 3: [1.7, 1], 2: [2.9, 0.68], 1: [4.6, 0.32] };
        var profil = null;
        var STENAR = [];
        (function () {
          var fro = 7;
          var slump = function () { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; };
          for (var i = 0; i < 26; i++) STENAR.push([slump(), slump(), 0.1 + slump() * 0.16, slump()]);
        })();

        // Djupet i bilden: meter till en höjd som får plats. Upp till några
        // meter nästan skalenligt, sedan allt mer hoptryckt.
        function visDjup(m) { return m <= 0 ? 0.32 : klamp(0.55 + 0.9 * Math.log(1 + m), 0.55, 3.6); }

        // Tomtens profil ur SGU-svaret (se tomtrapporten).
        function byggProfil(d) {
          var lager = [], berg = d.klass === 'berg', vatten = d.klass === 'vatten';
          var djup = berg ? 0 : (typeof d.djup === 'number' ? d.djup : null);
          if (vatten) {
            lager.push({ id: 'l0', typ: 'vatten', tj: 1.6, etikett: d.namn || 'Vatten' });
            lager.push({ id: 'l1', typ: 'berg', tj: 1.15, etikett: 'Berg', berg: true, okant: true });
            return { lager: lager, djup: null, vatten: 0, skalbrott: false, topp: 'vatten', jord: false };
          }
          if (!berg) {
            var tot = djup === null ? 2.3 : visDjup(djup);
            if (d.ytKlass && d.ytKlass !== d.klass && tot > 0.7) {
              var tt = Math.min(0.34, tot * 0.28);
              lager.push({ id: 'l' + lager.length, typ: d.ytKlass, tj: tt, etikett: d.ytNamn, tunt: true });
              tot -= tt;
            }
            lager.push({ id: 'l' + lager.length, typ: d.klass || 'okand', tj: Math.max(0.3, tot), etikett: d.namn || 'Jordart okänd', huvud: true });
          }
          lager.push({ id: 'l' + lager.length, typ: 'berg', tj: berg ? 2.4 : 1.15, etikett: berg ? (d.namn || 'Berg') : 'Berg', berg: true, okant: djup === null });
          var topp = berg ? 'hall' : (lager[0].typ === 'torv' ? 'mosse' : 'gras');
          return { lager: lager, djup: djup, vatten: d.vatten || 0, skalbrott: djup !== null && djup > 6, topp: topp, jord: !berg };
        }

        function profilBrickor(P) {
          var ut = P.lager.map(function (L) {
            return { namn: L.id, klass: 'vf3d__chip--vanster vf3d__chip--lager', prick: PRICK[L.typ] || '#aa9c88', b: L.etikett };
          });
          ut.push({ namn: 'ledningar', klass: 'vf3d__chip--hoger vf3d__chip--ledning vf3d__chip--okand', b: 'Ledningar', em: 'okänt läge' });
          if (P.vatten && P.jord) ut.push({ namn: 'vatten', klass: 'vf3d__chip--hoger vf3d__chip--vatten', b: { 3: 'Snabb', 2: 'Måttlig', 1: 'Långsam' }[P.vatten], em: 'dränering' });
          ut.push({ namn: 'djup', klass: 'vf3d__chip--hoger vf3d__chip--brun', b: P.djup === null ? 'Okänt' : (P.djup === 0 ? 'Berg i ytan' : '≈ ' + P.djup + ' m'), em: P.djup === null ? 'djup till berg' : (P.djup === 0 ? '' : 'till berg') });
          return ut;
        }

        // Stenar, block och grus på sidorna som syns (och några på toppen).
        function stenar(K, L, T, sidor, X, Y, o) {
          var g = '';
          STENAR.forEach(function (st, n) {
            if (n % o.var !== 0) return;
            var s = sidor[n % 2], m = s[1] === 'x' ? Y : X;
            var r = st[2] * o.storlek, u = -m + 0.35 + st[0] * (2 * m - 0.7), zz = T.botten + 0.12 + r + st[1] * Math.max(0.05, L.tj - 0.24 - 2 * r);
            var pt = ring(0, 0, 0, r, 'y', 9).map(function (q) { return s[1] === 'x' ? [s[0], u + q[0], zz + q[2] * 0.75] : [u + q[0], s[0], zz + q[2] * 0.75]; });
            g += yta(K, pt, st[3] > 0.5 ? o.ljus : o.mork, ' stroke="rgba(27,25,21,.18)" stroke-width=".6"');
            if (n < 12 && o.topp) {
              var tp = ring(-X + 0.5 + st[1] * (2 * X - 1), -Y + 0.5 + st[0] * (2 * Y - 1), T.topp + 0.002, r * 0.9, 'z', 8);
              g += yta(K, tp, st[3] > 0.5 ? o.toppLjus : o.toppMork);
            }
          });
          return g;
        }
        // Små korn som prickar, för sand och silt.
        function korn(K, L, T, sidor, X, Y, farg, antal) {
          var g = '', fro = 11;
          var slump = function () { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; };
          sidor.forEach(function (s) {
            var m = s[1] === 'x' ? Y : X;
            for (var i = 0; i < antal; i++) {
              var u = -m + 0.15 + slump() * (2 * m - 0.3), zz = T.botten + 0.06 + slump() * (L.tj - 0.12);
              var q = K.p(s[1] === 'x' ? s[0] : u, s[1] === 'x' ? u : s[0], zz);
              g += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (0.6 + slump() * 0.9).toFixed(1) + '" fill="' + (slump() > 0.5 ? farg[0] : farg[1]) + '"/>';
            }
          });
          return g;
        }

        // Lagrets yta efter material.
        function textur(K, L, T, sidor, p, X, Y) {
          var g = '', typ = L.typ;
          var rader = function (fr, farg, lut) {
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              fr.forEach(function (f) { g += linje(K, [p(s, -m, T.topp - L.tj * f), p(s, m, T.topp - L.tj * f + lut)], farg, 1); });
            });
          };
          if (typ === 'lera') {
            rader([0.3, 0.55, 0.8], 'rgba(255,255,255,.14)', 0.06);
            g += linje(K, [[-X, -Y + 1.2, T.topp + 0.002], [X, -Y + 1.6, T.topp + 0.002]], 'rgba(255,255,255,.12)', 1);
          } else if (typ === 'silt') {
            rader([0.18, 0.36, 0.54, 0.72, 0.9], 'rgba(255,255,255,.13)', 0.03);
            g += korn(K, L, T, sidor, X, Y, ['rgba(255,255,255,.35)', 'rgba(90,70,50,.22)'], 14);
          } else if (typ === 'moranlera') {
            rader([0.35, 0.7], 'rgba(255,255,255,.12)', 0.05);
            g += stenar(K, L, T, sidor, X, Y, { var: 2, storlek: 0.8, ljus: '#c4bcac', mork: '#857d70', topp: true, toppLjus: '#cdc5b6', toppMork: '#938b7e' });
          } else if (typ === 'moran') {
            g += stenar(K, L, T, sidor, X, Y, { var: 1, storlek: 1, ljus: '#c9c2b4', mork: '#8e877a', topp: true, toppLjus: '#d2cbbd', toppMork: '#9a9385' });
          } else if (typ === 'block') {
            g += stenar(K, L, T, sidor, X, Y, { var: 3, storlek: 2.1, ljus: '#b9b4ab', mork: '#7d786f', topp: true, toppLjus: '#c4bfb6', toppMork: '#8a857c' });
          } else if (typ === 'grus') {
            g += stenar(K, L, T, sidor, X, Y, { var: 1, storlek: 0.42, ljus: '#e4d7bd', mork: '#9a8a6c', topp: true, toppLjus: '#ebdfc7', toppMork: '#a5957a' });
            g += korn(K, L, T, sidor, X, Y, ['rgba(255,255,255,.4)', 'rgba(110,85,50,.25)'], 22);
          } else if (typ === 'sand') {
            g += korn(K, L, T, sidor, X, Y, ['rgba(255,255,255,.5)', 'rgba(140,100,50,.28)'], 40);
            // Snedskiktning, som i en sandbank.
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              [-0.45, 0.1, 0.6].forEach(function (f) {
                g += linje(K, [p(s, m * f - 0.5, T.botten + L.tj * 0.25), p(s, m * f + 0.6, T.topp - L.tj * 0.2)], 'rgba(255,255,255,.18)', 1);
              });
            });
          } else if (typ === 'torv') {
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              [0.25, 0.45, 0.65, 0.85].forEach(function (f, i) {
                var pts = [];
                for (var u = -m; u <= m + 0.01; u += 0.4) pts.push(p(s, u, T.topp - L.tj * f + Math.sin(u * 3 + i) * 0.05));
                g += linje(K, pts, i % 2 ? 'rgba(255,225,180,.16)' : 'rgba(20,12,6,.3)', 1.1);
              });
            });
          } else if (typ === 'fyllning') {
            var BITAR = ['#b5654a', '#8d8a84', '#c8b48c', '#6f6a64'];
            STENAR.forEach(function (st, n) {
              var s = sidor[n % 2], m = s[1] === 'x' ? Y : X;
              var u = -m + 0.3 + st[0] * (2 * m - 0.6), zz = T.botten + 0.12 + st[1] * (L.tj - 0.24), w = 0.12 + st[2] * 0.6, hh = 0.07 + st[3] * 0.08;
              g += yta(K, [p(s, u, zz), p(s, u + w, zz + 0.03), p(s, u + w, zz + hh + 0.03), p(s, u, zz + hh)], BITAR[n % 4], ' stroke="rgba(27,25,21,.18)" stroke-width=".5"');
            });
            g += korn(K, L, T, sidor, X, Y, ['rgba(255,255,255,.3)', 'rgba(40,30,20,.25)'], 16);
          } else if (typ === 'berg') {
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              g += linje(K, [p(s, -m * 0.6, T.topp), p(s, -m * 0.5, T.topp - 0.4), p(s, -m * 0.56, T.topp - 0.75), p(s, -m * 0.4, T.botten + 0.15)], 'rgba(27,25,21,.28)', 1.1);
              g += linje(K, [p(s, m * 0.3, T.topp), p(s, m * 0.38, T.topp - 0.5), p(s, m * 0.3, T.topp - 0.95)], 'rgba(27,25,21,.24)', 1);
              g += linje(K, [p(s, m * 0.1, T.botten + 0.2), p(s, m * 0.62, T.topp - 0.3)], 'rgba(255,255,255,.12)', 1);
            });
            g += linje(K, [[-X + 0.8, -Y + 0.6, T.topp + 0.002], [-0.6, -0.3, T.topp + 0.002], [0.4, 0.8, T.topp + 0.002], [2.6, Y - 0.3, T.topp + 0.002]], 'rgba(27,25,21,.22)', 1.1);
          } else if (typ === 'vatten') {
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              [0.3, 0.6].forEach(function (f, i) {
                var pts = [];
                for (var u = -m; u <= m + 0.01; u += 0.3) pts.push(p(s, u, T.topp - L.tj * f + Math.sin(u * 4 + i * 2) * 0.04));
                g += linje(K, pts, 'rgba(255,255,255,.3)', 1.2);
              });
            });
          } else if (typ === 'okand') {
            // Okänd jordart: bara en svag snedstreckning, inget material.
            sidor.forEach(function (s) {
              var m = s[1] === 'x' ? Y : X;
              for (var u = -m; u < m; u += 0.45) g += linje(K, [p(s, u, T.botten + 0.05), p(s, u + Math.min(0.45, L.tj * 0.6), Math.min(T.topp - 0.05, T.botten + 0.05 + L.tj * 0.9))], 'rgba(255,255,255,.16)', 1);
            });
          }
          return g;
        }

        // Rör där ledningar kan gå: i färg på standardbilden, som streckade
        // ringar med frågetecken på tomtens bild (ingen öppen data finns).
        function ror(K, lz, vy, Y, t, tid, okant) {
          var g = '';
          // Okänt läge: en streckad zon där ledningar brukar ligga, ingen gissning om var.
          if (okant) {
            var kz = fas(t, 1.6, 0.7);
            if (kz > 0.01) {
              var fy0 = vy * Y + vy * 0.008, za = lz + 0.26, zb = lz - 0.26, x0 = -3.6, x1 = x0 + 7.2 * kz;
              var puls = tid === null ? 0.75 : 0.6 + 0.25 * Math.sin(tid * 2.2);
              g += yta(K, [[x0, fy0, zb], [x1, fy0, zb], [x1, fy0, za], [x0, fy0, za]], 'rgba(75,143,209,.10)',
                ' stroke="rgba(75,143,209,' + (puls * kz).toFixed(2) + ')" stroke-width="1.3" stroke-dasharray="5 3.5"');
              for (var hx = x0 + 0.35; hx < x1 - 0.1; hx += 0.55) g += linje(K, [[hx, fy0, zb + 0.06], [hx + 0.3, fy0, za - 0.06]], 'rgba(75,143,209,.22)', 1);
            }
          }
          [[1.0, [229, 154, 60]], [1.75, [63, 163, 107]], [2.5, [75, 143, 209]]].forEach(function (rr, n) {
            var rx = rr[0], fy = vy * Y, rad = 0.2;
            if (okant) return;
            var ut = fy + vy * 0.42 * fas(t, 1.6 + n * 0.12, 0.6);
            var a1 = ring(rx, fy, lz, rad, 'y', 16), a2 = ring(rx, ut, lz, rad, 'y', 16);
            var skal = holje(a1.concat(a2).map(function (q) { return K.p(q[0], q[1], q[2]); }));
            g += '<polygon points="' + plan2d(skal) + '" fill="' + ton(rr[1], [0, vy, 0.4]) + '"/>';
            g += yta(K, a2, ton(rr[1], [0, vy, 0.2]));
            g += yta(K, ring(rx, ut, lz, rad * 0.55, 'y', 14), 'rgba(27,25,21,.55)');
          });
          return g;
        }

        // Regnet: streck som faller mot gräset och droppar som sjunker in i
        // jorden på framsidan, i den takt genomsläppligheten säger.
        function regn(K, vy, Y, X, zMark, T, L, v, t, tid) {
          var fart = VATTENFART[v];
          if (!fart) return '';
          var g = '', k = fas(t, 2.2, 0.8);
          if (k < 0.01) return '';
          var fy = vy * Y, zA = T.topp, zB = T.topp - (L.tj - 0.12) * fart[1];
          for (var i = 0; i < 5; i++) {
            var u = -X + 0.9 + i * (2 * X - 1.8) / 4 + (i % 2 ? 0.18 : -0.12);
            var f = tid === null ? ((i * 0.37 + 0.2) % 1) : ((tid / fart[0]) + i * 0.37) % 1;
            if (f < 0.3) {
              // Strecket i luften, ovanför gräset nära framkanten.
              var zf = zMark + 1.5 * (1 - f / 0.3), yy = fy - vy * 0.25;
              var a = K.p(u, yy, zf + 0.32), b = K.p(u, yy, zf);
              g += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
                '" stroke="rgba(90,150,215,' + (0.55 * k).toFixed(2) + ')" stroke-width="1.6" stroke-linecap="round"/>';
            } else {
              var ff = (f - 0.3) / 0.7, zz = zA - (zA - zB) * ff, syn = k * (ff < 0.85 ? 1 : (1 - ff) / 0.15);
              var q = K.p(u, fy + vy * 0.012, zz), q0 = K.p(u, fy + vy * 0.012, zA);
              g += '<line x1="' + q0[0].toFixed(1) + '" y1="' + q0[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) +
                '" stroke="rgba(75,143,209,' + (0.28 * syn).toFixed(2) + ')" stroke-width="2.4" stroke-linecap="round"/>';
              var x = q[0], y = q[1];
              g += '<path d="M' + x.toFixed(1) + ' ' + (y - 5).toFixed(1) + 'C' + (x + 3.4).toFixed(1) + ' ' + (y - 0.6).toFixed(1) + ' ' + (x + 3.4).toFixed(1) + ' ' + (y + 3).toFixed(1) + ' ' + x.toFixed(1) + ' ' + (y + 3).toFixed(1) +
                'C' + (x - 3.4).toFixed(1) + ' ' + (y + 3).toFixed(1) + ' ' + (x - 3.4).toFixed(1) + ' ' + (y - 0.6).toFixed(1) + ' ' + x.toFixed(1) + ' ' + (y - 5).toFixed(1) + 'Z" fill="rgba(90,155,220,' + (0.95 * syn).toFixed(2) + ')" stroke="rgba(255,255,255,' + (0.8 * syn).toFixed(2) + ')" stroke-width=".8"/>';
            }
          }
          // Lite vatten blir stående på ytan när marken släpper igenom dåligt.
          if (v === 1) {
            g += yta(K, ring(-1.9, vy * (Y - 1.0), zMark + 0.006, 0.62 * k, 'z', 20), 'rgba(90,150,210,.32)', ' stroke="rgba(255,255,255,.5)" stroke-width=".8"');
            g += yta(K, ring(-2.05, vy * (Y - 1.05), zMark + 0.008, 0.18 * k, 'z', 10), 'rgba(255,255,255,.45)');
          }
          return g;
        }

        // Ett brott i blocket när djupet är hoptryckt i bilden.
        function brott(K, z, sidor, p, X, Y) {
          var g = '';
          sidor.forEach(function (s) {
            var m = s[1] === 'x' ? Y : X, a = [], b = [];
            for (var u = -m, i = 0; u <= m + 0.01; u += 0.4, i++) {
              var dz = i % 2 ? 0.09 : -0.09;
              a.push(p(s, u, z + 0.1 + dz));
              b.push(p(s, u, z - 0.1 + dz));
            }
            g += yta(K, a.concat(b.slice().reverse()), 'rgba(250,246,238,.94)');
            g += linje(K, a, 'rgba(143,84,36,.55)', 1.2) + linje(K, b, 'rgba(143,84,36,.55)', 1.2);
          });
          return g;
        }

        function markScen(K, t, tid, isar) {
          var h = '', id = 'vfm', X = 4, Y = 3, i;
          var lager = profil ? profil.lager : STANDARD, n = lager.length, iB = n - 1;
          var gap = 0.5 + 1.1 * (1 - fas(t, 0.5, 1.6)) + isar;
          // Blocket står mitt i bilden oavsett hur högt det blir.
          var hojd = lager.reduce(function (s, L) { return s + L.tj; }, 0) + 0.5 * (n - 1);
          var toppar = [], z = profil ? (hojd - 6.1) / 2 : 0;
          lager.forEach(function (L, j) {
            var k = n - 1 - j;
            var flyg = -2.4 * (1 - fas(t, 0.1 + k * 0.2, 0.9));
            toppar.push({ topp: z + flyg, botten: z - L.tj + flyg, a: fas(t, 0.1 + k * 0.2, 0.5) });
            z -= L.tj + gap;
          });
          var vy = K.mot([0, 1, 0]) > 0 ? 1 : -1, vx = K.mot([-1, 0, 0]) > 0 ? -1 : 1;
          var topptyp = profil ? profil.topp : 'gras';
          // Skuggan under blocket.
          var bot = toppar[iB].botten;
          h += '<ellipse cx="' + K.p(0, 0, bot)[0].toFixed(1) + '" cy="' + (K.p(0, 0, bot)[1] + 26).toFixed(1) + '" rx="' + (5.4 * K.S).toFixed(1) + '" ry="' + (1.5 * K.S).toFixed(1) + '" fill="url(#' + id + '-golv)"/>';
          // Var ledningarna ritas: lerlagret på standardbilden, annars det
          // översta lagret som inte är ett tunt ytlager.
          var iL = 1;
          if (profil) { iL = 0; while (iL < iB && lager[iL].tunt) iL++; }
          var iH = -1;
          if (profil) lager.forEach(function (L, j) { if (L.huvud) iH = j; });
          // Lagren nerifrån och upp.
          for (var j = iB; j >= 0; j--) {
            var L = lager[j], T = toppar[j], farg = MATERIAL[L.typ] || MATERIAL.okand;
            if (T.a < 0.01) continue;
            var g = '<g opacity="' + (T.a * (L.okant ? 0.55 : 1)).toFixed(2) + '">';
            var topp = ton(farg, [0, 0, 1]);
            if (j === 0) topp = topptyp === 'hall' ? 'url(#' + id + '-hall)' : (topptyp === 'mosse' ? 'url(#' + id + '-mosse)' : (topptyp === 'vatten' ? 'url(#' + id + '-vatten)' : 'url(#' + id + '-gras)'));
            g += lada(K, -X, X, -Y, Y, T.botten, T.topp, farg, topp);
            var sidor = [[vx * X, 'x', [vx, 0, 0]], [vy * Y, 'y', [0, vy, 0]]];
            var p = function (s, u, zz) { return s[1] === 'x' ? [s[0], u, zz] : [u, s[0], zz]; };
            // Gräskanten och rötterna överst.
            if (j === 0 && (topptyp === 'gras' || topptyp === 'mosse')) {
              sidor.forEach(function (s) {
                var m = s[1] === 'x' ? Y : X;
                g += yta(K, [p(s, -m, T.topp - 0.14), p(s, m, T.topp - 0.14), p(s, m, T.topp), p(s, -m, T.topp)], ton(topptyp === 'mosse' ? [96, 128, 78] : [112, 158, 90], s[2]));
                for (var r = -m + 0.25; r < m; r += 0.55) g += linje(K, [p(s, r, T.topp - 0.16), p(s, r + 0.08, T.topp - Math.min(0.42, L.tj - 0.04))], 'rgba(60,40,20,.25)', 1);
              });
            }
            // Berg i dagen: mossa och sprickor på hällen.
            if (j === 0 && topptyp === 'hall') {
              [[-2.6, -1.4, 0.5], [2.9, 1.8, 0.42], [-0.6, 2.2, 0.36], [1.4, -2.3, 0.3]].forEach(function (mq) {
                g += yta(K, ring(mq[0], mq[1], T.topp + 0.004, mq[2], 'z', 14), 'rgba(110,150,90,.55)');
              });
            }
            g += textur(K, L, T, sidor, p, X, Y);
            if (L.okant) g += linje(K, [[-X, vy * Y, T.topp], [X, vy * Y, T.topp]], 'rgba(255,255,255,.7)', 1.4, ' stroke-dasharray="5 4"');
            if (profil && j === iH && profil.skalbrott && T.a > 0.6) g += brott(K, (T.topp + T.botten) / 2, sidor, p, X, Y);
            if (j === iL && T.a > 0.01) g += ror(K, T.topp - Math.min(L.tj * 0.5, profil ? 0.62 : 9), vy, Y, t, tid, !!profil);
            h += g + '</g>';
          }
          // Skanningen: ett ljust band som sveper ned genom lagren när
          // tomtens data har kommit.
          if (profil && !lugn) {
            var kS = (t - 1.1) / 1.3;
            if (kS > 0 && kS < 1) {
              var zs = toppar[0].topp + (toppar[iB].botten - toppar[0].topp) * mjuk(kS), aS = Math.sin(kS * Math.PI);
              var ram = [[vx * X, -vy * Y, zs], [vx * X, vy * Y, zs], [-vx * X, vy * Y, zs]];
              h += linje(K, ram, 'rgba(246,200,143,' + (0.35 * aS).toFixed(2) + ')', 7) + linje(K, ram, 'rgba(255,250,240,' + (0.95 * aS).toFixed(2) + ')', 1.6);
            }
          }
          // På ytan: gränsen, huset, träd och en nål för adressen.
          var T0 = toppar[0], kT = fas(t, 1.5, 0.8);
          if (kT > 0.01 && T0.a > 0.5) {
            var zt = T0.topp;
            h += linje(K, [[-X + 0.4, -Y + 0.4, zt + 0.01], [X - 0.4, -Y + 0.4, zt + 0.01], [X - 0.4, Y - 0.4, zt + 0.01], [-X + 0.4, Y - 0.4, zt + 0.01], [-X + 0.4, -Y + 0.4, zt + 0.01]], '#e8a456', 1.8, ' stroke-dasharray="6 5" opacity="' + kT.toFixed(2) + '"');
            var lyft = function (html) { return '<g transform="translate(0,' + (-zt * CE * K.S).toFixed(1) + ')">' + html + '</g>'; };
            if (topptyp !== 'vatten') {
              var mini = { id: id, x0: 0.1, x1: 2.6, b: 1.0, e: 1.15, r: 1.85, ov: 0.15, oy: 0.15, skorsten: null, altan: null,
                fonster: [{ v: 'y', s: 1, a0: 0.4, a1: 1.2, z0: 0.15, z1: 0.95, post: true }, { v: 'y', s: 1, a0: 1.6, a1: 2.2, z0: 0.15, z1: 0.95 },
                  { v: 'y', s: -1, a0: 0.8, a1: 1.6, z0: 0.45, z1: 0.9 }, { v: 'x', s: -1, a0: -0.3, a1: 0.3, z0: 0.15, z1: 0.95, t: 'dorr' },
                  { v: 'x', s: 1, a0: -0.35, a1: 0.35, z0: 0.4, z1: 0.9 }] };
              var saker = [];
              var lagg = function (x, y, html) { saker.push({ d: K.djup(x, y, 0), h: html }); };
              lagg(1.35, -0.4, lyft(hus(K, mini, kT, kT, null)));
              lagg(-3.0, -2.0, lyft(gran(K, -3.0, -2.0, 1.9, kT, lugn ? null : tid)));
              if (topptyp !== 'hall') lagg(3.3, -1.9, lyft(lovtrad(K, id, 3.3, -1.9, 1.8, 0.55, kT, lugn ? null : tid)));
              lagg(-3.2, 2.1, lyft(buske(K, id, -3.2, 2.1, 0.32, kT)));
              var sk = lyft(yta(K, [[0.1 - 0.15, -1.15, 0.005], [2.75, -1.15, 0.005], [2.75, 1.15, 0.005], [0.1 - 0.15, 1.15, 0.005]], 'rgba(40,28,16,.2)', ' filter="url(#' + id + '-mjuk)"'));
              h += sk;
              saker.sort(function (a, b) { return a.d - b.d; }).forEach(function (s) { h += s.h; });
            }
            // Nålen studsar över tomten.
            var kN = fas(t, 2.0, 0.6), studs = lugn ? 0 : Math.abs(Math.sin(tid * 2.2)) * 0.35;
            if (kN > 0.01) {
              var nb = K.p(-1.6, 0.9, zt), nt = K.p(-1.6, 0.9, zt + (1.6 + studs) * kN), nr = 0.42 * K.S;
              h += '<ellipse cx="' + nb[0].toFixed(1) + '" cy="' + nb[1].toFixed(1) + '" rx="' + (nr * (0.9 - studs * 0.6)).toFixed(1) + '" ry="' + (nr * 0.36 * (0.9 - studs * 0.6)).toFixed(1) + '" fill="rgba(52,38,24,.25)"/>';
              h += '<g opacity="' + kN.toFixed(2) + '" transform="translate(' + nt[0].toFixed(1) + ',' + nt[1].toFixed(1) + ')">' +
                '<path d="M0 ' + (nr * 1.25).toFixed(1) + 'C' + (-nr * 0.3).toFixed(1) + ' ' + (nr * 0.6).toFixed(1) + ' ' + (-nr).toFixed(1) + ' ' + (nr * 0.2).toFixed(1) + ' ' + (-nr).toFixed(1) + ' ' + (-nr * 0.55).toFixed(1) +
                'A' + nr.toFixed(1) + ' ' + nr.toFixed(1) + ' 0 0 1 ' + nr.toFixed(1) + ' ' + (-nr * 0.55).toFixed(1) +
                'C' + nr.toFixed(1) + ' ' + (nr * 0.2).toFixed(1) + ' ' + (nr * 0.3).toFixed(1) + ' ' + (nr * 0.6).toFixed(1) + ' 0 ' + (nr * 1.25).toFixed(1) + 'Z" fill="url(#' + id + '-nal)" stroke="rgba(120,70,20,.35)" stroke-width="1"/>' +
                '<circle cx="0" cy="' + (-nr * 0.55).toFixed(1) + '" r="' + (nr * 0.36).toFixed(1) + '" fill="#fffaf2"/></g>';
            }
          }
          // Regnet ovanpå och i jorden.
          if (profil && profil.jord && iH >= 0 && toppar[iH].a > 0.9) h += regn(K, vy, Y, X, toppar[0].topp, toppar[iH], lager[iH], profil.vatten, t, lugn ? null : tid);
          // Djupet till berget, till höger om blocket.
          var kD = fas(t, 2.2, 0.8);
          var dx = X + 0.45, dy = Y + 0.3, zb = toppar[iB].topp, z0 = toppar[0].topp;
          if (kD > 0 && !(profil && profil.djup === 0)) {
            var okant = profil && profil.djup === null;
            h += matt(K, [dx, dy, z0], [dx, dy, z0 + (zb - z0) * kD], '#8f5424', [0.22, 0, 0]);
            if (profil) {
              var q0 = K.p(dx + 0.34, dy, z0);
              h += '<text x="' + q0[0].toFixed(1) + '" y="' + (q0[1] + 3.5).toFixed(1) + '" font-size="10.5" font-weight="700" fill="#8f5424" opacity="' + kD.toFixed(2) + '">0 m</text>';
            }
            if (okant) h += linje(K, [[dx, dy, z0], [dx, dy, z0 + (zb - z0) * kD]], 'rgba(250,246,238,.95)', 1.4, ' stroke-dasharray="3 4"');
            if (profil && profil.skalbrott && kD > 0.6) {
              var zm = (z0 + zb) / 2;
              h += linje(K, [[dx - 0.28, dy, zm + 0.02], [dx + 0.28, dy, zm + 0.14]], '#8f5424', 1.6) + linje(K, [[dx - 0.28, dy, zm - 0.14], [dx + 0.28, dy, zm - 0.02]], '#8f5424', 1.6);
            }
            h += linje(K, [[X, Y, zb], [dx + 0.2, dy, zb]], 'rgba(143,84,36,.5)', 1, ' stroke-dasharray="3 3"');
          }
          // Hörn för brickornas linjer.
          var minX = 1e9, maxX = -1e9;
          [[-X, -Y], [X, -Y], [X, Y], [-X, Y]].forEach(function (q) { var s = K.p(q[0], q[1], 0)[0]; minX = Math.min(minX, s); maxX = Math.max(maxX, s); });
          var ank = {}, syn = {}, start = {};
          lager.forEach(function (L, j) {
            var T = toppar[j];
            ank[L.id] = [vx * X, 0.5, (T.topp + T.botten) / 2];
            syn[L.id] = T.a > 0.9;
            start[L.id] = 2.0 + (n - 1 - j) * 0.12;
          });
          var lzL = toppar[iL].topp - Math.min(lager[iL].tj * 0.5, profil ? 0.62 : 9);
          ank.ledningar = [2.5, vy * (Y + (profil ? 0.05 : 0.42)), lzL];
          syn.ledningar = vy > 0;
          start.ledningar = 2.4;
          if (profil && iH >= 0) {
            var TH = toppar[iH];
            ank.vatten = [-X + 0.9 + 3 * (2 * X - 1.8) / 4 + 0.18, vy * Y, TH.topp - lager[iH].tj * 0.64];
            syn.vatten = TH.a > 0.9;
            start.vatten = 2.6;
          }
          ank.djup = profil && profil.djup === 0 ? [dx - 0.45, dy - 0.3, z0] : [dx, dy, zb];
          syn.djup = true;
          start.djup = 2.7;
          return { h: h, ankare: ank, synlig: syn, start: start, kant: [minX, maxX] };
        }

        /* --- Motorn: bygg, vagga, vrid ----------------------------------- */
        scener.forEach(function (el) {
          var typ = el.getAttribute('data-vf3d');
          var svg = el.querySelector('svg');
          var varld = svg && svg.querySelector('.vf3d__varld');
          if (!varld) return;
          var vb = svg.viewBox.baseVal;
          var conf = typ === 'mark'
            ? { S: 30, cx: 300, cy: 150, bas: -33 * GRAD, min: -72 * GRAD, max: -8 * GRAD, scen: markScen }
            : { S: 30, cx: vb.width / 2, cy: 280, bas: -35 * GRAD, min: -100 * GRAD, max: 18 * GRAD, scen: husScen };
          var brickor = [];
          function lasBrickor() {
            brickor = [].map.call(el.querySelectorAll('[data-chip]'), function (b) { return { el: b, namn: b.getAttribute('data-chip'), in: false }; });
          }
          lasBrickor();
          var skala = 1, vrid = 0, drar = false, dragX = 0, dragV = 0, isar = 0, isarMal = 0;
          var t0 = null, synlig = false, raf = 0, senast = 0, borjat = false, stilla = false;
          function matSkala() { skala = (svg.getBoundingClientRect().width || vb.width) / vb.width; }
          function rita(t) {
            var tid = lugn ? 0 : livTid(t);
            var vinkel = klamp(conf.bas + vrid + (lugn ? 0 : Math.sin(tid * Math.PI * 2 / 18) * 9 * GRAD * svaj(t)), conf.min, conf.max);
            var K = new Kamera(vinkel, conf.S, conf.cx, conf.cy);
            isar += (isarMal - isar) * 0.08;
            var r = conf.scen(K, t, tid, isar);
            varld.innerHTML = r.h;
            // På tomtens bild får brickorna till höger inte krocka: djupet
            // går före ledningarna, som går före vattnet (som också står i
            // texten bredvid).
            var tagna = [], PRIO = { djup: 1, ledningar: 2, vatten: 3 };
            brickor.slice().sort(function (x, y) { return (PRIO[x.namn] || 9) - (PRIO[y.namn] || 9); }).forEach(function (b) {
              var a = r.ankare[b.namn];
              if (!a) return;
              var q = K.p(a[0], a[1], a[2]);
              b.el.style.transform = 'translate(' + ((q[0] - vb.x) * skala).toFixed(1) + 'px,' + ((q[1] - vb.y) * skala).toFixed(1) + 'px)';
              if (r.kant) {
                var stam = b.el.classList.contains('vf3d__chip--vanster') ? q[0] - r.kant[0] + 18 : r.kant[1] - q[0] + 18;
                b.el.style.setProperty('--stam', Math.max(14, stam * skala).toFixed(1) + 'px');
              }
              var ska = t >= r.start[b.namn] && r.synlig[b.namn];
              if (profil && typ === 'mark' && r.synlig[b.namn] && b.el.classList.contains('vf3d__chip--hoger')) {
                if (tagna.some(function (y) { return Math.abs(y - q[1]) * skala < 34; })) ska = false;
                else tagna.push(q[1]);
              }
              if (ska !== b.in) { b.in = ska; b.el.classList.toggle('vf3d__chip--in', ska); }
            });
          }
          // Bygget och livet pågår en stund. Sedan står scenen still och
          // ritas bara om när någon vrider den eller den byter storlek.
          function ram(nu) {
            raf = 0;
            if (t0 === null) t0 = nu;
            var t = (nu - t0) / 1000;
            var ror = t < LIV_SLUT || drar || Math.abs(isarMal - isar) > 0.002;
            if (ror ? (nu - senast > 30 || drar) : !stilla) { rita(t); senast = nu; stilla = !ror; }
            if (ror && synlig && !document.hidden) raf = requestAnimationFrame(ram);
          }
          function kor() { if (!raf && synlig) raf = requestAnimationFrame(ram); }
          function vack() { stilla = false; kor(); }
          matSkala();
          if (lugn) {
            rita(99);
            el.classList.add('vf3d--klar');
          } else {
            el.classList.add('vf3d--rorlig');
            var io = window.IntersectionObserver ? new IntersectionObserver(function (poster) {
              synlig = poster[0].isIntersecting;
              if (synlig && !borjat) { borjat = true; el.classList.add('vf3d--klar'); }
              kor();
            }, { rootMargin: '80px 0px' }) : null;
            if (io) io.observe(el); else { synlig = true; borjat = true; el.classList.add('vf3d--klar'); kor(); }
            document.addEventListener('visibilitychange', kor);
          }
          var omRita = function () { matSkala(); if (lugn) rita(99); else vack(); };
          if (window.ResizeObserver) new ResizeObserver(omRita).observe(svg);
          else window.addEventListener('resize', omRita);

          // Vrid med musen eller fingret (lodrätt drag skrollar sidan).
          el.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            drar = true; dragX = e.clientX; dragV = vrid;
            el.classList.add('vf3d--drar', 'vf3d--provat');
            try { el.setPointerCapture(e.pointerId); } catch (x) {}
            kor();
          });
          el.addEventListener('pointermove', function (e) {
            if (!drar) return;
            vrid = klamp(dragV + (e.clientX - dragX) * 0.007, conf.min - conf.bas, conf.max - conf.bas);
            if (lugn) rita(99);
          });
          var slapp = function () { drar = false; el.classList.remove('vf3d--drar'); };
          el.addEventListener('pointerup', slapp);
          el.addEventListener('pointercancel', slapp);
          el.addEventListener('pointerenter', function () { isarMal = typ === 'mark' ? 0.35 : 0; kor(); });
          el.addEventListener('pointerleave', function () { isarMal = 0; kor(); });

          // Tomtrapporten ritar om marken med tomtens egen profil, och
          // PDF:en får en färdig bild av den.
          if (typ === 'mark') {
            var standardBrickor = [].map.call(el.querySelectorAll('[data-chip]'), function (b) { return b.outerHTML; }).join('');
            // På smal skärm zoomas tomtens bild in på blocket.
            var smalMQ = window.matchMedia ? window.matchMedia('(max-width: 560px)') : null;
            var satRam = function () { svg.setAttribute('viewBox', !profil ? '0 0 640 400' : (smalMQ && smalMQ.matches ? '112 22 396 350' : '104 12 600 372')); matSkala(); };
            if (smalMQ) {
              var vidByte = function () { satRam(); if (lugn) rita(99); else vack(); };
              if (smalMQ.addEventListener) smalMQ.addEventListener('change', vidByte); else if (smalMQ.addListener) smalMQ.addListener(vidByte);
            }
            var escT = function (x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
            window.idealhusMark = {
              visa: function (d) {
                profil = d ? byggProfil(d) : null;
                [].forEach.call(el.querySelectorAll('[data-chip]'), function (b) { b.parentNode.removeChild(b); });
                var html = profil ? profilBrickor(profil).map(function (c) {
                  return '<span class="vf3d__chip ' + c.klass + '" data-chip="' + c.namn + '"' + (c.prick ? ' style="--prick:' + c.prick + '"' : '') + '>' +
                    '<span class="vf3d__chip-in"><i></i><b>' + escT(c.b) + '</b>' + (c.em ? '<em>' + escT(c.em) + '</em>' : '') + '</span></span>';
                }).join('') : standardBrickor;
                var tips = el.querySelector('.vf3d__tips');
                if (tips) tips.insertAdjacentHTML('beforebegin', html); else el.insertAdjacentHTML('beforeend', html);
                lasBrickor();
                el.classList.toggle('vf3d--egen', !!profil);
                t0 = null;
                vrid = 0;
                satRam();
                if (lugn) rita(99); else vack();
              },
              bild: function () {
                var K = new Kamera(conf.bas, conf.S, conf.cx, conf.cy);
                var defs = svg.querySelector('defs');
                // Egna id:n i PDF:en - sidans scen är dold vid utskrift, och
                // toningar som pekar dit ritas då inte.
                return ('<svg class="rapport__mark" viewBox="60 10 520 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                  (defs ? defs.outerHTML : '') + conf.scen(K, 99, null, 0).h + '</svg>').split('vfm-').join('vfr-');
              },
              lager: function () {
                return profil ? profil.lager.map(function (L) { return { namn: L.etikett, farg: PRICK[L.typ] || '#aa9c88' }; }) : [];
              }
            };
          }
        });
      })();

      /* Tomtrapporten. Adressen slås upp hos OpenStreetMap (Nominatim),
         och punkten skickas till SGU:s öppna tjänster för jordart,
         genomsläpplighet och jorddjup. Inget sparas, och adressen hamnar
         aldrig i länken. Kartan (Leaflet, i vendor/) laddas först när
         någon söker, så ingen tredje part anropas bara för att sidan visas. */
      (function () {
        var sok = document.getElementById('marksok');
        if (!sok) return;
        var JORD = ''' + json.dumps(JORDTOLKNING, ensure_ascii=False) + ''';
        var VATTEN = ''' + json.dumps(GENOMSLAPP, ensure_ascii=False) + ''';
        var BILD = ''' + json.dumps(JORDBILD, ensure_ascii=False) + ''';
        var SGU = 'https://api.sgu.se/oppnadata/';
        var falt = document.getElementById('marksok-adress');
        var knapp = sok.querySelector('.marksok__knapp');
        var status = document.getElementById('marksok-status');
        var platsKnapp = document.getElementById('marksok-plats');
        var ruta = document.getElementById('tomtrapport');
        var vy = document.getElementById('tomtrapport-vy');
        var karta = null, nal = null, jordLager = null;
        var tomt = null;
        var anrop = 0;
        var cache = {};

        function esc(s) {
          return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
        }

        function hamta(url, ms) {
          var ac = window.AbortController ? new AbortController() : null;
          var t = ac ? setTimeout(function () { ac.abort(); }, ms) : 0;
          return fetch(url, ac ? { signal: ac.signal } : {}).then(function (r) {
            clearTimeout(t);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r;
          }, function (e) { clearTimeout(t); throw e; });
        }

        // --- Adressen ---------------------------------------------------
        function kortNamn(t) {
          var a = t.address || {};
          var gata = [a.road, a.house_number].filter(Boolean).join(' ');
          var ort = a.city || a.town || a.village || a.hamlet || a.municipality || '';
          return [gata, ort].filter(Boolean).join(', ') || t.display_name.split(',').slice(0, 2).join(',');
        }

        function sokAdress(q) {
          var nyckel = q.toLowerCase();
          if (cache[nyckel]) return Promise.resolve(cache[nyckel]);
          return hamta('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se' +
            '&accept-language=sv&addressdetails=1&q=' + encodeURIComponent(q), 10000)
            .then(function (r) { return r.json(); })
            .then(function (lista) {
              if (!lista.length) throw new Error('hittade inte');
              var t = lista[0];
              var svar = { lat: +t.lat, lon: +t.lon, namn: kortNamn(t),
                           exakt: !!(t.address && t.address.house_number) };
              cache[nyckel] = svar;
              return svar;
            });
        }

        function iSverige(lat, lon) {
          return lat > 55 && lat < 69.2 && lon > 10.5 && lon < 24.3;
        }

        // --- SGU ----------------------------------------------------------
        // Bara ytan som punkten ligger i hämtas, inte allt runt omkring.
        function punkt(lat, lon) {
          return '&filter-lang=cql2-text&filter=' +
            encodeURIComponent('S_INTERSECTS(geom,POINT(' + lon.toFixed(6) + ' ' + lat.toFixed(6) + '))');
        }

        function jordart(lat, lon) {
          return hamta(SGU + 'genomslapplighet/ogc/features/v1/collections/genomslapplighet/items?f=json&limit=1' +
            punkt(lat, lon), 12000)
            .then(function (r) { return r.json(); })
            .then(function (fc) { return fc.features && fc.features[0] ? fc.features[0].properties : null; });
        }

        function ytlager(lat, lon) {
          return hamta(SGU + 'jordarter25k-100k/ogc/features/v1/collections/ytlager/items?f=json&limit=1' +
            punkt(lat, lon), 12000)
            .then(function (r) { return r.json(); })
            .then(function (fc) { return fc.features && fc.features[0] ? fc.features[0].properties.jy1_tx : null; });
        }

        // Jorddjupsmodellen är ett rutnät på 10 x 10 m. Vi hämtar rutorna
        // närmast punkten och tar medianen; 255 betyder att uppgift saknas.
        function jorddjup(lat, lon) {
          var d = 0.0002;
          return hamta(SGU + 'jorddjupsmodell/wcs?service=WCS&version=2.0.1&request=GetCoverage' +
            '&coverageId=jorddjupsmodell__jorddjupsmodell-10x10m&format=' + encodeURIComponent('application/gml+xml') +
            '&subsettingCrs=http://www.opengis.net/def/crs/EPSG/0/4326' +
            '&subset=Long(' + (lon - d).toFixed(6) + ',' + (lon + d).toFixed(6) + ')' +
            '&subset=Lat(' + (lat - d).toFixed(6) + ',' + (lat + d).toFixed(6) + ')', 12000)
            .then(function (r) { return r.text(); })
            .then(function (xml) {
              var m = xml.match(/<(?:\\w+:)?tupleList[^>]*>([^<]*)</);
              if (!m) return null;
              var v = m[1].trim().split(/[\\s,]+/).map(Number)
                .filter(function (x) { return x >= 0 && x < 255; })
                .sort(function (a, b) { return a - b; });
              return v.length ? v[Math.floor(v.length / 2)] : null;
            });
        }

        // --- Kartan -------------------------------------------------------
        function laddaKarta() {
          if (window.L) return Promise.resolve();
          return new Promise(function (klar, fel) {
            var css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'vendor/leaflet/leaflet.css';
            document.head.appendChild(css);
            var s = document.createElement('script');
            s.src = 'vendor/leaflet/leaflet.js';
            s.onload = klar;
            s.onerror = fel;
            document.head.appendChild(s);
          });
        }

        var pilTimer;
        function visaKarta(lat, lon) {
          return laddaKarta().then(function () {
            vy.hidden = false;
            if (!karta) {
              karta = L.map('tomtkarta', {
                center: [lat, lon],
                zoom: 17,
                scrollWheelZoom: false,
                // På mobilen rullar ett finger sidan, inte kartan. Nålen
                // flyttas genom att trycka på kartan eller dra i den.
                dragging: !L.Browser.mobile
              });
              karta.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
              L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare'
              }).addTo(karta);
              jordLager = L.tileLayer.wms('https://maps3.sgu.se/geoserver/jord/ows', {
                layers: 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K',
                format: 'image/png',
                transparent: true,
                version: '1.3.0',
                opacity: 0.6,
                attribution: 'Jordarter &copy; <a href="https://www.sgu.se/">SGU</a>'
              });
              nal = L.marker([lat, lon], {
                draggable: true,
                keyboard: true,
                title: 'Tomten',
                icon: L.divIcon({
                  className: 'tomtnal',
                  html: '<span class="tomtnal__ring"></span><span class="tomtnal__ring"></span><span class="tomtnal__prick"></span>',
                  iconSize: [34, 34],
                  iconAnchor: [17, 17]
                })
              }).addTo(karta);
              var el = nal.getElement();
              el.setAttribute('aria-label', 'Tomten. Flytta med piltangenterna.');
              el.addEventListener('keydown', function (e) {
                var d = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
                if (!d) return;
                e.preventDefault();
                e.stopPropagation();
                var p = nal.getLatLng();
                var steg = e.shiftKey ? 0.0003 : 0.00006;
                var ny = L.latLng(p.lat + d[0] * steg, p.lng + d[1] * steg / Math.cos(p.lat * Math.PI / 180));
                nal.setLatLng(ny);
                karta.panTo(ny);
                clearTimeout(pilTimer);
                pilTimer = setTimeout(function () { kolla(ny.lat, ny.lng, null); }, 600);
              });
              nal.on('dragend', function () {
                var p = nal.getLatLng();
                kolla(p.lat, p.lng, null);
              });
              karta.on('click', function (e) {
                nal.setLatLng(e.latlng);
                kolla(e.latlng.lat, e.latlng.lng, null);
              });
              document.getElementById('jordlager').addEventListener('change', function () {
                if (this.checked) jordLager.addTo(karta); else karta.removeLayer(jordLager);
              });
            }
            karta.invalidateSize();
            karta.setView([lat, lon], 17);
            nal.setLatLng([lat, lon]);
          });
        }

        // --- Svaret -------------------------------------------------------
        function tolka(namn) {
          for (var i = 0; i < JORD.length; i++) {
            if (new RegExp(JORD[i][0], 'i').test(namn)) return JORD[i][1];
          }
          return 'Visa oss vad kartan säger, så berättar vi vad det betyder för grunden.';
        }

        function djupText(m) {
          if (m === 0) return 'Enligt modellen går berget i dagen eller ligger precis under ytan.';
          if (m <= 2) return 'Grunt till berget. Plintar kan ofta ställas direkt på berget.';
          return 'Grunden bärs av jordlagren, inte av berget.';
        }

        var SAKNAS = 'Kunde inte hämtas just nu. Prova igen om en stund, eller öppna SGU:s karta här nedanför.';

        // Tomtens fakta som [rubrik, värde, förklaring] - samma till sidan och PDF:en.
        function faktarader(t) {
          var j = t.jord, rader = [];
          if (j === undefined) {
            rader.push(['Jordart', 'Ingen uppgift', SAKNAS]);
          } else if (!j) {
            rader.push(['Jordart', 'Ingen uppgift', 'SGU:s detaljerade jordartskarta täcker inte just den här platsen.']);
          } else {
            var text = tolka(j.jg2_tx);
            if (t.yt && t.yt !== j.jg2_tx) text = 'Överst ett tunt lager ' + t.yt.toLowerCase() + '. ' + text;
            rader.push(['Jordart', j.jg2_tx, text]);
          }
          if (j === undefined) {
            rader.push(['Genomsläpplighet', 'Ingen uppgift', SAKNAS]);
          } else if (!j || !j.genomslapp_tx) {
            rader.push(['Genomsläpplighet', 'Ingen uppgift', 'Följer jordartskartan, som saknas här.']);
          } else {
            rader.push(['Genomsläpplighet', j.genomslapp_tx, VATTEN[String(j.genomslapp)] || '']);
          }
          if (t.djup === undefined) {
            rader.push(['Djup till berg', 'Ingen uppgift', SAKNAS]);
          } else if (t.djup === null) {
            rader.push(['Djup till berg', 'Ingen uppgift', 'Jorddjupsmodellen har inget värde för just den här punkten.']);
          } else {
            rader.push(['Djup till berg', t.djup === 0 ? 'Berg i ytan' : 'Ungefär ' + t.djup + ' m',
              djupText(t.djup) + ' Modellen är grov, så det verkliga djupet kan skilja flera meter.']);
          }
          return rader;
        }

        // --- Genomskärningen ----------------------------------------------
        function jordKlass(namn) {
          for (var i = 0; i < BILD.length; i++) {
            if (new RegExp(BILD[i][0], 'i').test(namn)) return BILD[i][1];
          }
          return 'okand';
        }
        // SGU skriver intervall med två bindestreck ("ler--block").
        function snyggNamn(namn) { return String(namn).split('--').join('–'); }

        function markData(t) {
          var j = t.jord, d = {};
          if (j && j.jg2_tx) {
            d.namn = snyggNamn(j.jg2_tx);
            d.klass = jordKlass(j.jg2_tx);
          } else {
            d.namn = j === null ? 'Ej kartlagt' : 'Jordart okänd';
            d.klass = 'okand';
          }
          if (t.yt && (!j || t.yt !== j.jg2_tx)) {
            d.ytNamn = snyggNamn(t.yt);
            d.ytKlass = jordKlass(t.yt);
          }
          d.djup = typeof t.djup === 'number' ? t.djup : null;
          d.vatten = j && j.genomslapp ? +j.genomslapp : 0;
          return d;
        }

        function skarningText(d) {
          if (d.klass === 'vatten') return 'Enligt kartan står nålen i vatten. Flytta den till tomten, så ritas marken där.';
          var s = [];
          if (d.klass === 'okand') {
            s.push(d.namn === 'Ej kartlagt'
              ? 'SGU:s detaljerade jordartskarta täcker inte just den här punkten, så jordlagret är ritat utan material.'
              : 'Jordarten kunde inte hämtas just nu, så jordlagret är ritat utan material.');
          } else if (d.klass === 'berg') {
            s.push('Här är det ' + d.namn.toLowerCase() + ' i ytan.');
          } else {
            s.push('Överst ' + (d.ytNamn ? 'ett tunt lager ' + d.ytNamn.toLowerCase() + ' och därunder ' : '') + d.namn.toLowerCase() + '.');
          }
          if (d.klass !== 'berg') {
            if (d.djup === null) s.push('Hur djupt berget ligger finns inte i modellen här.');
            else if (d.djup === 0) s.push('Enligt modellen ligger berget precis under ytan.');
            else s.push('Berget ligger ungefär ' + d.djup + ' meter ned' + (d.djup > 6 ? ', så grunden bärs av jordlagren.' : '.'));
          }
          if (d.vatten && d.klass !== 'berg') s.push(VATTEN[String(d.vatten)] || '');
          return s.join(' ');
        }

        var skarning = document.getElementById('tomt-skarning');
        // Blocket flyttar in i svaret så fort kartan visas; där står det
        // tonat tills tomtens data har kommit.
        function flyttaScen() {
          var bild = document.getElementById('tomtskarning-bild');
          var scen = document.querySelector('.vf3d--mark');
          if (scen && bild && scen.parentNode !== bild) bild.appendChild(scen);
        }
        // SWEREF 99 TM (EPSG:3006) för länkarna till SGU och Lantmäteriet.
        function sweref(lat, lon) {
          var a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, lon0 = 15 * Math.PI / 180;
          var e2 = f * (2 - f), n = f / (2 - f), ah = a / (1 + n) * (1 + n * n / 4 + n * n * n * n / 64);
          var A = e2, B = (5 * e2 * e2 - e2 * e2 * e2) / 6, C = (104 * Math.pow(e2, 3) - 45 * Math.pow(e2, 4)) / 120, D = 1237 * Math.pow(e2, 4) / 1260;
          var b1 = n / 2 - 2 * n * n / 3 + 5 * Math.pow(n, 3) / 16 + 41 * Math.pow(n, 4) / 180, b2 = 13 * n * n / 48 - 3 * Math.pow(n, 3) / 5 + 557 * Math.pow(n, 4) / 1440;
          var b3 = 61 * Math.pow(n, 3) / 240 - 103 * Math.pow(n, 4) / 140, b4 = 49561 * Math.pow(n, 4) / 161280;
          var phi = lat * Math.PI / 180, sp = Math.sin(phi), dl = lon * Math.PI / 180 - lon0;
          var ps = phi - sp * Math.cos(phi) * (A + B * sp * sp + C * Math.pow(sp, 4) + D * Math.pow(sp, 6));
          var xi = Math.atan(Math.tan(ps) / Math.cos(dl)), tt = Math.cos(ps) * Math.sin(dl), eta = 0.5 * Math.log((1 + tt) / (1 - tt));
          var N = k0 * ah * (xi + b1 * Math.sin(2 * xi) * Math.cosh(2 * eta) + b2 * Math.sin(4 * xi) * Math.cosh(4 * eta) + b3 * Math.sin(6 * xi) * Math.cosh(6 * eta) + b4 * Math.sin(8 * xi) * Math.cosh(8 * eta));
          var E = k0 * ah * (eta + b1 * Math.cos(2 * xi) * Math.sinh(2 * eta) + b2 * Math.cos(4 * xi) * Math.sinh(4 * eta) + b3 * Math.cos(6 * xi) * Math.sinh(6 * eta) + b4 * Math.cos(8 * xi) * Math.sinh(8 * eta)) + 500000;
          return [Math.round(E), Math.round(N)];
        }
        // Korten under kartan öppnar SGU:s och Lantmäteriets kartor vid tomten.
        function lankaKort(t) {
          var p = sweref(t.lat, t.lon), E = p[0], N = p[1], antal = 0;
          [].forEach.call(document.querySelectorAll('.markkort[data-karta]'), function (k) {
            var bas = k.getAttribute('data-karta'), ny = null;
            if (bas.indexOf('apps.sgu.se/kartvisare/') >= 0) ny = bas.split('?')[0] + '?zoom=' + (E - 300) + ',' + (N - 200) + ',' + (E + 300) + ',' + (N + 200);
            else if (bas.indexOf('minkarta.lantmateriet.se') >= 0) ny = 'https://minkarta.lantmateriet.se/plats/3006/v2.0/?e=' + E + '&n=' + N + '&z=12&mapprofile=karta&layers=%5B%5B%223%22%5D%2C%5B%221%22%5D%5D';
            var txt = k.querySelector('[data-lanktext]');
            if (ny) {
              k.href = ny;
              k.classList.add('markkort--tomt');
              if (txt) txt.textContent = 'Öppna vid tomten';
              antal++;
            }
          });
          var mer = document.getElementById('markkoll-mer');
          if (mer && antal) mer.innerHTML = 'Gå djupare i kartorna <span>· ' + esc(t.namn) + '</span>';
        }
        var fokusEfter = false;
        function visaSkarning() {
          if (!skarning) return;
          var d = markData(tomt);
          flyttaScen();
          document.getElementById('tomtskarning-text').textContent = skarningText(d);
          var skala = skarning.querySelector('[data-not="skala"]');
          if (skala) skala.hidden = !(d.djup !== null && d.djup > 6 && d.klass !== 'berg' && d.klass !== 'vatten');
          if (window.idealhusMark) window.idealhusMark.visa(d);
          lankaKort(tomt);
        }

        function koordinater(t) {
          return t.lat.toFixed(5).replace('.', ',') + ' N, ' + t.lon.toFixed(5).replace('.', ',') + ' E';
        }

        var FAKTA = ['tomt-jord', 'tomt-vatten', 'tomt-djup'];
        var RUBRIK = ['Jordart', 'Genomsläpplighet', 'Djup till berg'];

        function visaPlats(p) {
          document.getElementById('tomt-plats').innerHTML =
            '<strong>' + esc(p.namn) + '</strong><span>' + koordinater(p) + '</span>';
        }

        function rita() {
          visaPlats(tomt);
          var rader = faktarader(tomt);
          FAKTA.forEach(function (id, i) {
            var r = rader[i];
            document.getElementById(id).innerHTML =
              '<p class="tomtfakta__rubrik">' + r[0] + '</p>' +
              '<p class="tomtfakta__varde">' + esc(r[1]) + '</p>' +
              (r[2] ? '<p class="tomtfakta__text">' + esc(r[2]) + '</p>' : '');
          });
        }

        // Första gången finns inget att visa medan SGU svarar - då står
        // rubrikerna med tomma rader som skimrar tills svaret kommer.
        function ritaLaddar() {
          FAKTA.forEach(function (id, i) {
            document.getElementById(id).innerHTML =
              '<p class="tomtfakta__rubrik">' + RUBRIK[i] + '</p>' +
              '<p class="tomtfakta__varde"><span class="tomtfakta__skelett"></span></p>' +
              '<p class="tomtfakta__text"><span class="tomtfakta__skelett tomtfakta__skelett--lang"></span></p>';
          });
        }

        function kolla(lat, lon, namn) {
          var nr = ++anrop;
          if (namn === null) namn = 'Punkt vald på kartan';
          visaPlats({ lat: lat, lon: lon, namn: namn });
          if (!tomt) ritaLaddar();
          // Kartan centreras på nålen, så att radarn sveper runt tomten.
          if (karta) karta.panTo([lat, lon]);
          ruta.classList.add('tomtrapport--laddar');
          ruta.setAttribute('aria-busy', 'true');
          flyttaScen();
          // Efter en sökning hamnar genomskärningen i fokus.
          if (fokusEfter && skarning) {
            fokusEfter = false;
            requestAnimationFrame(function () {
              var lugnt = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              skarning.scrollIntoView({ behavior: lugnt ? 'auto' : 'smooth', block: 'start' });
            });
          }
          function ingen() { return undefined; }
          Promise.all([
            jordart(lat, lon).catch(ingen),
            ytlager(lat, lon).catch(ingen),
            jorddjup(lat, lon).catch(ingen)
          ]).then(function (svar) {
            if (nr !== anrop) return;
            tomt = { lat: lat, lon: lon, namn: namn, jord: svar[0], yt: svar[1], djup: svar[2] };
            rita();
            visaSkarning();
            ruta.classList.remove('tomtrapport--laddar');
            ruta.removeAttribute('aria-busy');
          });
        }

        sok.addEventListener('submit', function (e) {
          e.preventDefault();
          var q = falt.value.trim();
          if (q.length < 3) {
            status.textContent = 'Skriv gata och ort, till exempel Storgatan 12, Umeå.';
            falt.focus();
            return;
          }
          knapp.disabled = true;
          status.textContent = 'Letar upp adressen …';
          sokAdress(q).then(function (a) {
            status.textContent = a.exakt
              ? 'Hittade ' + a.namn + '. Flytta nålen om den inte står på tomten.'
              : 'Hittade ' + a.namn + ', men inte exakt var huset ligger. Dra nålen till tomten.';
            fokusEfter = true;
            return visaKarta(a.lat, a.lon).then(function () { kolla(a.lat, a.lon, a.namn); });
          }).catch(function (err) {
            if (window.console) console.error(err);
            status.textContent = err && err.message === 'hittade inte'
              ? 'Vi hittade inte adressen. Prova med gata och ort, eller bara orten.'
              : 'Sökningen svarade inte. Prova igen om en stund.';
          }).then(function () { knapp.disabled = false; });
        });

        if (navigator.geolocation && window.isSecureContext) {
          platsKnapp.hidden = false;
          platsKnapp.addEventListener('click', function () {
            status.textContent = 'Hämtar din position …';
            navigator.geolocation.getCurrentPosition(function (p) {
              var lat = p.coords.latitude, lon = p.coords.longitude;
              if (!iSverige(lat, lon)) {
                status.textContent = 'Positionen verkar ligga utanför Sverige, och SGU:s kartor gäller bara Sverige.';
                return;
              }
              status.textContent = 'Nålen står där du är nu. Flytta den om tomten ligger en bit bort.';
              fokusEfter = true;
              visaKarta(lat, lon).then(function () { kolla(lat, lon, 'Din position'); }, function () {
                status.textContent = 'Kartan gick inte att ladda. Prova igen om en stund.';
              });
            }, function () {
              status.textContent = 'Vi fick inte tillgång till positionen. Skriv adressen i stället.';
            }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
          });
        }

        /* --- PDF:en -------------------------------------------------------
           Webbläsarens egen utskrift, med en egen mall (se styles.css,
           @media print). Ingen extern tjänst, och texten blir skarp. */
        document.documentElement.classList.add('rapportlage');

        function text(sel) {
          var el = document.querySelector(sel);
          return el ? el.textContent.trim() : '';
        }

        function bygRapport() {
          document.getElementById('rapport-datum').textContent = 'Tomtrapport · ' +
            new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
          var h = '<h1 class="rapport__titel">Vad får jag bygga?</h1>';
          if (tomt) h += '<p class="rapport__adress">' + esc(tomt.namn) + ' · ' + koordinater(tomt) + '</p>';

          h += '<div class="rapport__siffror">' +
            '<div><strong>' + esc(text('#svar-yta')) + ' m²</strong><span>största nya hus</span></div>' +
            '<div><strong>' + esc(text('#svar-hojd')) + ' m</strong><span>högsta nockhöjd</span></div></div>';
          if (text('#svar-summa')) h += '<p class="rapport__summa">' + esc(text('#svar-summa')) + '</p>';
          var valt = document.getElementById('svar-valt');
          if (valt && !valt.hidden) h += '<p class="rapport__valt">' + esc(valt.textContent) + '</p>';
          h += '<ul class="rapport__punkter">' + [].map.call(document.querySelectorAll('#svar-lista li'), function (li) {
            return '<li class="' + li.className.replace('kollen__punkt', 'rapport__punkt') + '">' + esc(li.textContent) + '</li>';
          }).join('') + '</ul>';

          if (tomt) {
            h += '<h2>Marken</h2><dl class="rapport__fakta">' + faktarader(tomt).map(function (r) {
              return '<div><dt>' + r[0] + '</dt><dd><strong>' + esc(r[1]) + '</strong>' + (r[2] ? ' ' + esc(r[2]) : '') + '</dd></div>';
            }).join('') + '</dl>' +
            (window.idealhusMark ? '<figure class="rapport__skarning">' + window.idealhusMark.bild() +
              '<figcaption><ul class="rapport__lager">' + window.idealhusMark.lager().map(function (L) {
                return '<li><i style="background:' + L.farg + '"></i>' + esc(L.namn) + '</li>';
              }).join('') + '</ul>' + esc(text('#tomtskarning-text')) + '</figcaption></figure>' : '') +
            '<p class="rapport__kalla">Källa: Sveriges geologiska undersökning (SGU), öppna data. Kartorna är översiktliga och ersätter inte en geoteknisk bedömning på plats.</p>';
          }

          h += '<h2>Dina svar</h2><dl class="rapport__svar">' +
            [].map.call(document.querySelectorAll('#kollen .tv__fraga'), function (fs) {
              var val = fs.querySelector('input[type=radio]:checked');
              var svar = val ? val.parentNode.textContent : (fs.querySelector('output') || {}).textContent;
              return '<div><dt>' + esc(fs.querySelector('legend').textContent.trim().replace(/^[0-9]+/, '')) + '</dt><dd>' + esc((svar || '').trim()) + '</dd></div>';
            }).join('') + '</dl>';

          var hus = [].map.call(document.querySelectorAll('#hus-lista .tvhus:not(.tvhus--lov)'), function (a) {
            return '<li>' + esc(a.querySelector('strong').textContent) + ' · ' + esc(a.querySelector('.tvhus__fakta b').textContent) + '</li>';
          });
          if (hus.length) h += '<h2>Hus som ryms</h2><ul class="rapport__hus">' + hus.join('') + '</ul>';

          var kontakt = [].map.call(document.querySelectorAll('.site-footer a[href^="mailto:"], .site-footer a[href^="tel:"]'), function (a) {
            return esc(a.textContent.trim());
          });
          h += '<div class="rapport__fot">' +
            '<p><strong>Idealhus</strong> · ' + kontakt.join(' · ') + '</p>' +
            '<p>Svaren som länk: ' + esc(location.href) + '</p>' +
            '<p>Vägledning, inte ett beslut. Detaljplanen och kommunen har sista ordet.</p></div>';
          document.getElementById('rapport-innehall').innerHTML = h;
        }

        window.addEventListener('beforeprint', bygRapport);
        if (window.matchMedia) {
          var utskrift = window.matchMedia('print');
          var vidUtskrift = function (e) { if (e.matches) bygRapport(); };
          if (utskrift.addEventListener) utskrift.addEventListener('change', vidUtskrift);
          else if (utskrift.addListener) utskrift.addListener(vidUtskrift);
        }
        [].forEach.call(document.querySelectorAll('[data-skriv-ut]'), function (b) {
          if (!window.print) { b.hidden = true; return; }
          b.addEventListener('click', function () { window.print(); });
        });
      })();
'''

ut = (B.head("Vad får jag bygga på min tomt? Se storlek och höjd | Idealhus",
             "Fem frågor om tomten visar hur stort attefallshus som ryms utan "
             "bygglov, hur högt det får bli och vilka av våra hus som passar. Tar "
             "under en minut.",
             None, fil="vad-far-jag-bygga.html")
      + "\n" + B.header(B.VERKTYG_NAMN) + "\n" + KROPP + B.SIDFOT + "\n" + B.skript(SKRIPT))

io.open("vad-far-jag-bygga.html", "w", encoding="utf-8",
        newline="").write(ut.replace("\n", "\r\n"))
print("vad-far-jag-bygga.html")
