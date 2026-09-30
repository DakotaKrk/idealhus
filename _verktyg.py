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
    {"typ": typ, "kategori": namn, "nr": i, "namn": titel,
     "bild": bild, "yta": yta, "rum": rum}
    for typ, (namn, lista) in M.KATEGORIER.items()
    for i, (titel, bild, yta, rum, lev) in enumerate(lista, 1)
]


# Öppna kartor och tjänster för att se vad som finns under marken.
# Adresserna kontrollerade 2026-09-23.
MARKKOLL = [
    ("Tomtgränsen", "Lantmäteriet · Min karta", "https://minkarta.lantmateriet.se/",
     "M4 20 9 4l6 16 5-12M4 20h16",
     "Se var fastighetsgränsen går och mät avståndet till grannen - 4,5 meter är gränsen utan medgivande."),
    ("Jordarter", "SGU · Kartvisaren", "https://apps.sgu.se/kartvisare/kartvisare-jordarter-25-100.html",
     "M3 9h18M3 14h18M3 19h18M7 4l2 5M14 4l-1 5",
     "Visar om marken är berg, lera, sand eller morän. Det styr vilken grund som passar och hur mycket som ska grävas."),
    ("Djup till berg", "SGU · Kartvisaren", "https://apps.sgu.se/kartvisare/kartvisare-jorddjup.html",
     "M12 3v14M7 12l5 5 5-5M4 21h16",
     "Ungefär hur djupt det är ned till berget. Grunt berg kan betyda plintar direkt på berget - eller sprängning."),
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
     "fungera med tjälisolering runt om - på djup lera kan en geoteknisk "
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
        "Står i kommunens karta, eller fråga bygglovsenheten. Är du osäker "
        "räknar vi med det strängare."),
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
        [("nej", "Nej"), ("ja", "Ja, inom 100 m från strand"), ("vetej", "Vet inte")]),
])

KROPP = f'''    <main id="innehall">
      <section class="kollen-topp glod">
        <div class="kollen-topp__inner">
          <p class="section-label section-label--accent">Verktyg</p>
          <h1 class="kollen-topp__titel">Vad får jag <em class="skimmer">bygga</em>?</h1>
          <p class="kollen-topp__text">
            Svara på fem frågor om tomten, så räknar vi ut hur stort
            attefallshus som ryms, hur högt det får bli och vad du behöver
            prata med kommunen om. Tomten ritas upp medan du svarar.
          </p>
          <ul class="kollen-topp__fakta">
            <li><b>5</b> frågor</li>
            <li><b>Under 1</b> minut</li>
            <li><b>Svar</b> direkt</li>
          </ul>
        </div>
      </section>

      <section class="tv" aria-label="Räkna på din tomt">
        <div class="tv__inre">
          <form class="tv__form" id="kollen" aria-label="Frågor om tomten">
{FORMULAR}
          </form>

          <div class="tv__hoger">
            <div class="tv__scen" aria-hidden="true">
              <span class="ih-kant"></span>
              <p class="tv__skylt" id="tv-skylt">Inom detaljplan</p>
              <svg class="tv__svg" id="tv-svg" viewBox="0 0 600 400" focusable="false"></svg>
              <p class="tv__forklaring"><i class="tv__prick tv__prick--nytt"></i>Nytt hus<i class="tv__prick tv__prick--fanns"></i>Befintligt<i class="tv__prick tv__prick--grans"></i>Tomtgräns</p>
            </div>

            <aside class="tv__svar" id="tv-svar" aria-live="polite">
              <p class="tv__summa" id="svar-summa"></p>
              <div class="tv__tal">
                <div>
                  <p><strong id="svar-yta">30</strong><small>m²</small></p>
                  <span>största nya hus</span>
                  <i class="tv__stapel"><b id="matare-hus"></b></i>
                </div>
                <div>
                  <p><strong id="svar-hojd">4,0</strong><small>m</small></p>
                  <span>högsta nockhöjd</span>
                  <i class="tv__stapel"><b id="matare-hojd"></b></i>
                </div>
              </div>

              <p class="kollen__valt" id="svar-valt" hidden></p>
              <ul class="tv__lista" id="svar-lista"></ul>

              <div class="tv__knappar">
                <button class="kollen__dela" type="button" id="svar-dela">Kopiera länk till svaret</button>
                <button class="kollen__dela kollen__pdf" type="button" data-skriv-ut>Spara som PDF</button>
              </div>

              <p class="tv__friskrivning">
                Vägledning, inte ett beslut. Detaljplanen och kommunen har
                sista ordet. <a href="attefallshus-regler.html">Läs hela guiden</a>
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section class="kollen-hus">
        <div class="kollen-hus__inner">
          <div class="kollen-hus__topp">
            <p class="section-label section-label--accent">Hus som ryms</p>
            <h2 class="kollen-hus__titel" id="hus-rubrik">Modeller upp till 30 m²</h2>
          </div>
          <div class="tvhus-rad" id="hus-lista"></div>
          <p class="kollen-hus__tomt" id="hus-tomt" hidden>
            Inget av våra hus ryms utan bygglov med de här svaren. Med
            bygglov kan det bli större -
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
              Det som ligger under marken avgör grunden och markarbetet - och
              är det som oftast överraskar. Skriv tomtens adress, så hämtar vi
              vad Sveriges geologiska undersökning vet om marken just där.
            </p>
          </div>

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

            <div class="tomtrapport__vy" id="tomtrapport-vy" hidden>
              <div class="tomtrapport__karta">
                <div class="tomtrapport__kartyta" id="tomtkarta" role="region" aria-label="Karta med tomten utmärkt"></div>
                <div class="tomtrapport__kartrad">
                  <label class="konfig__spegel">
                    <input type="checkbox" id="jordlager">
                    <span class="konfig__vaxel" aria-hidden="true"></span>
                    Visa jordartskartan
                  </label>
                  <p class="tomtrapport__tips">Står nålen fel? Dra den, eller tryck på kartan där tomten ligger.</p>
                </div>
              </div>

              <div class="tomtrapport__fakta">
                <p class="tomtrapport__plats" id="tomt-plats"></p>
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
                <p class="tomtrapport__kalla">
                  Jordart, genomsläpplighet och jorddjup: SGU, öppna data.
                  Adressök och karta: © OpenStreetMap-bidragsgivare.
                </p>
              </div>
            </div>
          </div>

          <p class="markkoll__mer">Gå djupare i kartorna</p>
          <div class="markkoll__rad">
''' + "\n".join(f'''            <a class="markkort" href="{lank}" target="_blank" rel="noopener">
              <span class="markkort__ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="{ikon}"/></svg></span>
              <span class="markkort__kalla">{kalla}</span>
              <strong>{titel}</strong>
              <span class="markkort__text">{text}</span>
              <span class="markkort__lank">Öppna kartan</span>
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
      /* Tomten i isometri. Ritas om från svaren: huset växer till den
         yta som får byggas (1 ruta = 2 m), avståndet till tomtgränsen får
         färg efter svaret, befintliga byggnader står kvar i hörnet, och
         omgivningen visar detaljplan (grannhus och gata) eller landsbygd
         (skog), och vatten när tomten ligger nära strand. Talen glider
         mjukt mellan lägena. */
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
        function hus(x0, y0, x1, y1, ze, zr, f, tak, extra) {
          var ym = (y0 + y1) / 2, o = 0.18, h = '';
          h += box(x0, y0, 0, x1 - x0, y1 - y0, ze, f, extra);
          h += poly([P(x1, y0, ze), P(x1, y1, ze), P(x1, ym, zr)], f.x, extra);
          h += poly([P(x0 - o, y0 - o, ze), P(x1 + o, y0 - o, ze), P(x1 + o, ym, zr), P(x0 - o, ym, zr)], tak.x, extra);
          h += poly([P(x0 - o, ym, zr), P(x1 + o, ym, zr), P(x1 + o, y1 + o, ze), P(x0 - o, y1 + o, ze)], tak.t, extra);
          return h;
        }
        function gran(x, y, h) {
          var bas = P(x, y, 0), topp = P(x, y, h), mitt = P(x, y, h * 0.28), b = S * 0.6 * (h / 3);
          return '<ellipse cx="' + (bas[0] + 3).toFixed(1) + '" cy="' + (bas[1] + 2).toFixed(1) + '" rx="' + (b * 0.9).toFixed(1) +
            '" ry="' + (b * 0.4).toFixed(1) + '" fill="rgba(27,25,21,.18)"/>' +
            poly([[bas[0] - 2, bas[1]], [bas[0] + 2, bas[1]], [mitt[0] + 2, mitt[1]], [mitt[0] - 2, mitt[1]]], '#6b4f36') +
            poly([topp, [mitt[0] - b, mitt[1]], [mitt[0], mitt[1] + b * 0.34]], '#6f9a6a') +
            poly([topp, [mitt[0], mitt[1] + b * 0.34], [mitt[0] + b, mitt[1]]], '#436b4f');
        }
        function etikett(p, text, klass) {
          var b = Math.round(text.length * 6.6 + 22);
          return '<g class="tv-etikett ' + (klass || '') + '" transform="translate(' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ')">' +
            '<rect x="' + (-b / 2) + '" y="-12" width="' + b + '" height="24" rx="12"/>' +
            '<text x="0" y="4.5" text-anchor="middle">' + text + '</text></g>';
        }
        var GRAS = { t: '#a9c98e', x: '#5c7a48', y: '#6f8f58' };
        var MARK = { t: '#e9e1d2', x: '#b8ab95', y: '#cdbfa8' };
        var FASAD = { t: '#3d3832', x: '#24211d', y: '#302b26' };
        var TAK = { t: '#3b3631', x: '#2a2622' };
        var BOD = { t: '#dfb57a', x: '#a97b45', y: '#c9975a' };
        var GRANNE = { t: '#efe8dc', x: '#cfc6b5', y: '#e2d9ca' };
        var LJUSTAK = { t: '#b3a994', x: '#9a8f79' };
        var komma = function (v, d) { return v.toFixed(d).replace('.', ','); };

        function rita(t) {
          var h = '';
          var PX0 = -5.5, PX1 = 5.5, PY0 = -4, PY1 = 4, IN = 0.3;
          // Marken runt tomten, med vatten bakom när tomten ligger nära strand.
          h += '<ellipse cx="' + OX + '" cy="' + (OY + 30) + '" rx="250" ry="120" fill="url(#tv-skugga)"/>';
          h += box(-8, -6.5, -0.35, 16, 13, 0.35, MARK);
          if (t.vatten !== 'nej') {
            h += poly([P(-8, -6.5, 0.01), P(8, -6.5, 0.01), P(8, -5.1, 0.01), P(-8, -5.1, 0.01)],
              t.vatten === 'ja' ? 'url(#tv-vatten)' : 'rgba(91,143,191,.18)',
              t.vatten === 'ja' ? '' : ' stroke="#5b8fbf" stroke-width="1.4" stroke-dasharray="5 5"');
            if (t.vatten === 'ja') {
              for (var w = -6; w < 7; w += 3) h += lin([P(w, -5.9, 0.02), P(w + 1.2, -5.9, 0.02)], 'rgba(255,255,255,.7)', 1.5, ' class="tv-vag"');
            }
          }
          // Omgivningen: grannhus och gata, eller skog.
          if (t.plan === 'utanfor') {
            h += gran(-7.2, -5.6, 2.6) + gran(-6.2, -5.9, 2.0) + gran(7.0, -4.6, 2.4) + gran(-7.3, 3.8, 2.2) + gran(7.2, 3.2, 2.8) + gran(6.6, 5.2, 2.0);
          } else {
            h += hus(-7.7, -4.2, -6.2, -1.6, 1.0, 1.7, GRANNE, LJUSTAK) + hus(6.2, 1.6, 7.7, 4.4, 1.0, 1.7, GRANNE, LJUSTAK);
            h += poly([P(-8, 5.1, 0.01), P(8, 5.1, 0.01), P(8, 6.5, 0.01), P(-8, 6.5, 0.01)], '#9d978c');
            for (var gx = -7; gx < 8; gx += 2.2) h += lin([P(gx, 5.8, 0.02), P(gx + 1, 5.8, 0.02)], '#f7f2ea', 1.6);
          }
          // Tomten och gränsen.
          h += box(PX0, PY0, 0, PX1 - PX0, PY1 - PY0, 0.12, GRAS);
          if (t.vatten === 'ja') {
            h += poly([P(PX0, PY0, 0.13), P(PX1, PY0, 0.13), P(PX1, PY1, 0.13), P(PX0, PY1, 0.13)], 'rgba(91,143,191,.16)');
          }
          h += lin([P(PX0 + IN, PY0 + IN, 0.14), P(PX1 - IN, PY0 + IN, 0.14), P(PX1 - IN, PY1 - IN, 0.14), P(PX0 + IN, PY1 - IN, 0.14), P(PX0 + IN, PY0 + IN, 0.14)],
            '#f0b56e', 2, ' stroke-dasharray="7 5" class="tv-grans"');
          [[PX0 + IN, PY0 + IN], [PX1 - IN, PY0 + IN], [PX1 - IN, PY1 - IN], [PX0 + IN, PY1 - IN]].forEach(function (k) {
            h += box(k[0] - 0.07, k[1] - 0.07, 0.12, 0.14, 0.14, 0.55, { t: '#f0b56e', x: '#8f5424', y: '#c9975a' });
          });
          // Befintlig byggnad i hörnet bakom (1 ruta = 2 m).
          if (t.befintligt > 0.5) {
            var bb = Math.sqrt(t.befintligt * 1.3) / 2, bd = t.befintligt / 4 / bb;
            var bx0 = PX0 + 0.8, by0 = PY0 + 0.7;
            h += poly([P(bx0 + 0.2, by0 + 0.2, 0.13), P(bx0 + bb + 0.5, by0 + 0.2, 0.13), P(bx0 + bb + 0.5, by0 + bd + 0.5, 0.13), P(bx0 + 0.2, by0 + bd + 0.5, 0.13)], 'rgba(27,25,21,.16)');
            h += box(bx0, by0, 0.12, bb, bd, 1.1, BOD);
            h += box(bx0 - 0.1, by0 - 0.1, 1.22, bb + 0.2, bd + 0.2, 0.1, { t: '#6b4f36', x: '#4a3625', y: '#5a4230' });
            h += etikett(P(bx0 + bb / 2, by0 + bd / 2, 2.1), Math.round(t.befintligt) + ' m² finns', 'tv-etikett--ljus');
          }
          // Det nya huset: yta i m2, 1,6:1, nock efter planen.
          var yta = t.yta > 0.5 ? t.yta : t.perHus;
          var W = Math.sqrt(yta * 1.6) / 2, D = yta / 4 / W;
          var dist = t.dist / 2;
          var hx1 = PX1 - IN - dist, hx0 = hx1 - W;
          var hy0 = -D / 2 + 1.1, hy1 = hy0 + D;
          var ze = 1.3, zr = t.hojd / 2 + 0.12, spok = t.yta <= 0.5;
          h += poly([P(hx0 + 0.25, hy0 + 0.25, 0.13), P(hx1 + 0.6, hy0 + 0.25, 0.13), P(hx1 + 0.6, hy1 + 0.6, 0.13), P(hx0 + 0.25, hy1 + 0.6, 0.13)], spok ? 'none' : 'rgba(27,25,21,.2)');
          if (spok) {
            h += '<g class="tv-spok">' + hus(hx0, hy0, hx1, hy1, ze + 0.12, zr, { t: 'rgba(224,118,74,.08)', x: 'rgba(224,118,74,.12)', y: 'rgba(224,118,74,.1)' },
              { t: 'rgba(224,118,74,.1)', x: 'rgba(224,118,74,.14)' }, ' stroke="#e0764a" stroke-width="1.4" stroke-dasharray="5 4"') + '</g>';
            h += etikett(P((hx0 + hx1) / 2, (hy0 + hy1) / 2, zr + 0.9), 'Kräver bygglov', 'tv-etikett--nej');
          } else {
            h += box(hx0 - 0.15, hy0 - 0.15, 0.12, W + 0.3, D + 0.3, 0.12, { t: '#dcd6cb', x: '#a9a297', y: '#bfb8ad' });
            h += '<g class="tv-hus">' + hus(hx0, hy0, hx1, hy1, ze + 0.12, zr + 0.12, FASAD, TAK);
            var varm = t.bo === 'ja' ? 'url(#tv-varm)' : 'url(#tv-glas)';
            var fy = hy1, fl = Math.min(1.1, W * 0.28);
            h += poly([P(hx0 + 0.35, fy, 0.5), P(hx0 + 0.35 + fl, fy, 0.5), P(hx0 + 0.35 + fl, fy, 1.18), P(hx0 + 0.35, fy, 1.18)], varm, ' stroke="#1b1915" stroke-width="1.2"');
            h += poly([P(hx1 - 0.35 - fl, fy, 0.3), P(hx1 - 0.35, fy, 0.3), P(hx1 - 0.35, fy, 1.18), P(hx1 - 0.35 - fl, fy, 1.18)], varm, ' stroke="#1b1915" stroke-width="1.2"');
            if (t.bo === 'ja') {
              var sx = hx0 + W * 0.3, sy = (hy0 + hy1) / 2 - 0.2;
              h += box(sx, sy, zr - 0.35, 0.28, 0.28, 0.75, { t: '#4a443d', x: '#27231f', y: '#35302a' });
              var rk = P(sx + 0.14, sy + 0.14, zr + 0.45);
              h += '<path class="tv-rok" d="M' + rk[0].toFixed(1) + ' ' + rk[1].toFixed(1) + 'c-5-7 5-11 0-18s5-11 0-16" pathLength="1"/>';
            }
            h += '</g>';
            h += etikett(P((hx0 + hx1) / 2, (hy0 + hy1) / 2, zr + 1.0), komma(t.yta, 0) + ' m²', 'tv-etikett--hus');
          }
          // Nockhöjden vid gaveln.
          var hp0 = P(hx1 + 0.45, hy0 - 0.05, 0.12), hp1 = P(hx1 + 0.45, hy0 - 0.05, zr + 0.12);
          h += lin([hp0, hp1], '#8f5424', 1.5) + lin([[hp0[0] - 5, hp0[1]], [hp0[0] + 5, hp0[1]]], '#8f5424', 1.5) + lin([[hp1[0] - 5, hp1[1]], [hp1[0] + 5, hp1[1]]], '#8f5424', 1.5);
          h += etikett([hp1[0] + 30, (hp0[1] + hp1[1]) / 2], t.hojdText + ' m', 'tv-etikett--matt');
          // Avståndet till tomtgränsen.
          var farg = t.grans === 'nara' ? '#e0764a' : (t.grans === 'medgivande' ? '#d9974f' : '#2f8a52');
          var dy = hy1 + 0.55, a0 = P(hx1, dy, 0.16), a1 = P(PX1 - IN, dy, 0.16);
          h += lin([a0, a1], farg, 2.2) + lin([P(hx1, dy - 0.2, 0.16), P(hx1, dy + 0.2, 0.16)], farg, 2.2) + lin([P(PX1 - IN, dy - 0.2, 0.16), P(PX1 - IN, dy + 0.2, 0.16)], farg, 2.2);
          var avst = t.grans === 'langt' ? '4,5 m' : (t.grans === 'medgivande' ? 'Närmare · ja från grannen' : 'Närmare än 4,5 m');
          h += etikett([(a0[0] + a1[0]) / 2 + 8, (a0[1] + a1[1]) / 2 + 20], avst, 'tv-etikett--' + (t.grans === 'nara' ? 'nej' : (t.grans === 'medgivande' ? 'villkor' : 'ja')));
          if (t.vatten === 'ja') h += etikett(P(0, -6.2, 0.3), 'Strandskydd · dispens krävs', 'tv-etikett--vatten');
          else if (t.vatten === 'vetej') h += etikett(P(0, -6.2, 0.3), 'Strandskydd? Kolla med kommunen', 'tv-etikett--vatten');
          // Ett par granar framför, som ram.
          h += gran(-7.3, 6.0, 2.2);
          svg.innerHTML = DEFS + h;
        }

        var DEFS = '<defs>' +
          '<radialGradient id="tv-skugga"><stop offset="0" stop-color="#1b1915" stop-opacity=".22"/><stop offset="1" stop-color="#1b1915" stop-opacity="0"/></radialGradient>' +
          '<linearGradient id="tv-vatten" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb6d8"/><stop offset="1" stop-color="#5b8fbf"/></linearGradient>' +
          '<linearGradient id="tv-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef4f9"/><stop offset="1" stop-color="#b8cde0"/></linearGradient>' +
          '<linearGradient id="tv-varm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d9"/><stop offset="1" stop-color="#f0b56e"/></linearGradient>' +
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

        // Husen ur ritningarna R1-R5 finns i 3D - dit går kortet direkt.
        function husKort(m, i) {
          var med3d = /^hus-r\\d\\.webp$/.test(m.bild);
          return '<a class="tvhus" style="--i:' + i + '" href="huskort.html?typ=' + m.typ + '&amp;modell=' + m.nr + (med3d ? '#i-3d' : '') + '">' +
            '<span class="tvhus__bild"><img src="images/' + m.bild + '" alt="" loading="lazy" decoding="async">' +
            '<span class="tvhus__ryms">Ryms</span>' + (med3d ? '<span class="tvhus__3d">Se i 3D</span>' : '') + '</span>' +
            '<span class="tvhus__kropp"><span class="tvhus__typ">' + m.kategori + '</span>' +
            '<strong>' + m.namn + '</strong>' +
            '<span class="tvhus__fakta"><b>' + m.yta + ' m²</b><i></i>' + m.rum + ' rum</span></span></a>';
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

          document.getElementById('svar-yta').textContent = yta;
          document.getElementById('svar-hojd').textContent = hojd;
          // Staplarna är skalade mot det största som går, 50 m2 och 4,5 m.
          document.getElementById('matare-hus').style.transform = 'scaleX(' + (yta / 50).toFixed(3) + ')';
          document.getElementById('matare-hojd').style.transform = 'scaleX(' + (hojd === '4,5' ? 1 : 0.89) + ')';

          var p = [];
          var lov = false;
          if (yta <= 0) {
            lov = true;
            p.push(punkt('lov', 'Tomten har redan ' + befintligt + ' m² av ' + totalt + ' m² som får byggas utan lov. Ett hus till kräver bygglov.'));
          } else {
            p.push(punkt('ok', 'Ett hus på upp till ' + yta + ' m² kräver varken bygglov eller anmälan för själva byggnaden.'));
          }
          if (plan === 'vetej') {
            p.push(punkt('info', 'Vi har räknat med inom detaljplan, som är strängast. Utanför kan det bli upp till 50 m².'));
          }
          var grans = vald('grans');
          if (grans === 'nara') {
            lov = true;
            p.push(punkt('lov', 'Närmare än 4,5 m från tomtgränsen utan grannens medgivande kräver bygglov.'));
          } else if (grans === 'medgivande') {
            p.push(punkt('info', 'Be om grannens medgivande skriftligt och spara det.'));
          }
          if (vald('bo') === 'ja') {
            p.push(punkt('anmalan', 'Kök, badrum och eldstad anmäls till kommunen - för installationerna, inte för huset.'));
          }
          var vatten = vald('vatten');
          if (vatten === 'ja') {
            p.push(punkt('lov', 'Inom strandskydd krävs dispens, även för ett annars lovbefriat hus.'));
          } else if (vatten === 'vetej') {
            p.push(punkt('info', 'Kolla strandskyddet med kommunen. Det gäller oftast 100 m från strand.'));
          }
          document.getElementById('svar-lista').innerHTML = p.join('');
          var valt = document.getElementById('svar-valt');
          if (fran) {
            var ok = yta > 0 && fran <= yta;
            valt.hidden = false;
            valt.className = 'kollen__valt kollen__valt--' + (ok ? 'ja' : 'nej');
            valt.textContent = franNamn + ' (' + fran + ' m²) ' +
              (ok ? 'ryms utan bygglov.' : 'ryms inte utan bygglov - det behöver sökas.');
          }
          document.getElementById('svar-summa').textContent = yta <= 0
            ? 'Ett hus till kräver bygglov här.'
            : (lov ? 'Det går, men något av svaren kräver lov eller dispens.'
                   : 'Det här ser ut att gå utan bygglov.');
          document.getElementById('tv-svar').setAttribute('data-status', yta <= 0 ? 'lov' : (lov ? 'villkor' : 'ok'));
          if (window.idealhusTomt) window.idealhusTomt({ plan: plan, yta: yta, perHus: perHus, hojd: hojd,
            befintligt: befintligt, grans: grans, bo: vald('bo'), vatten: vatten });

          var ryms = MODELLER.filter(function (m) { return yta > 0 && m.yta <= yta; })
            .sort(function (a, b) { return b.yta - a.yta; });
          document.getElementById('hus-rubrik').textContent = yta > 0
            ? (ryms.length ? ryms.length + (ryms.length === 1 ? ' modell' : ' modeller') : 'Inga modeller') +
              ' upp till ' + yta + ' m²'
            : 'Hus som kräver bygglov';
          document.getElementById('hus-lista').innerHTML = ryms.map(husKort).join('');
          document.getElementById('hus-tomt').hidden = ryms.length > 0;
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
        form.addEventListener('input', rakna);
        form.addEventListener('change', rakna);
        form.addEventListener('submit', function (e) { e.preventDefault(); });
        rakna();
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
          function ingen() { return undefined; }
          Promise.all([
            jordart(lat, lon).catch(ingen),
            ytlager(lat, lon).catch(ingen),
            jorddjup(lat, lon).catch(ingen)
          ]).then(function (svar) {
            if (nr !== anrop) return;
            tomt = { lat: lat, lon: lon, namn: namn, jord: svar[0], yt: svar[1], djup: svar[2] };
            rita();
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
            '<p class="rapport__kalla">Källa: Sveriges geologiska undersökning (SGU), öppna data. Kartorna är översiktliga och ersätter inte en geoteknisk bedömning på plats.</p>';
          }

          h += '<h2>Dina svar</h2><dl class="rapport__svar">' +
            [].map.call(document.querySelectorAll('#kollen .kollen__fraga'), function (fs) {
              var val = fs.querySelector('input[type=radio]:checked');
              var svar = val ? val.parentNode.textContent : (fs.querySelector('output') || {}).textContent;
              return '<div><dt>' + esc(fs.querySelector('legend').textContent.trim()) + '</dt><dd>' + esc((svar || '').trim()) + '</dd></div>';
            }).join('') + '</dl>';

          var hus = [].map.call(document.querySelectorAll('#hus-lista .kollen-hus__kort'), function (a) {
            return '<li>' + esc(a.querySelector('strong').textContent) + ' · ' + esc(a.querySelector('.kollen-hus__yta').textContent.replace('m²', ' m²')) + '</li>';
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

ut = (B.head("Vad får jag bygga? | Idealhus",
             "Svara på fem frågor om tomten och se hur stort attefallshus som "
             "ryms, hur högt det får bli och vad kommunen behöver veta.",
             None, fil="vad-far-jag-bygga.html")
      + "\n" + B.header("") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript(SKRIPT))

io.open("vad-far-jag-bygga.html", "w", encoding="utf-8",
        newline="").write(ut.replace("\n", "\r\n"))
print("vad-far-jag-bygga.html")
