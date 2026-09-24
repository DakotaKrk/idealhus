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


def val(namn, rubrik, alternativ, hjalp=""):
    rader = "\n".join(
        f'''              <label class="kollen__val">
                <input type="radio" name="{namn}" value="{v}"{" checked" if i == 0 else ""}>
                <span>{t}</span>
              </label>''' for i, (v, t) in enumerate(alternativ))
    h = f'\n            <p class="kollen__hjalp">{hjalp}</p>' if hjalp else ""
    return f'''          <fieldset class="kollen__fraga">
            <legend>{rubrik}</legend>{h}
            <div class="kollen__rad">
{rader}
            </div>
          </fieldset>'''


FORMULAR = "\n\n".join([
    val("plan", "Ligger tomten inom detaljplan?",
        [("inom", "Inom detaljplan"), ("utanfor", "Utanför detaljplan"),
         ("vetej", "Vet inte")],
        "Står i kommunens karta, eller fråga bygglovsenheten. Är du osäker "
        "räknar vi med det strängare."),
    f'''          <fieldset class="kollen__fraga">
            <legend>Hur mycket komplementbyggnad finns redan på tomten?</legend>
            <p class="kollen__hjalp">Attefallshus, friggebodar och andra lovbefriade byggnader, sammanlagt.</p>
            <div class="kollen__reglage">
              <input type="range" id="befintligt" name="befintligt" min="0" max="65" step="1" value="0" aria-label="Befintlig komplementbyggnad på tomten, i kvadratmeter" aria-describedby="befintligt-varde">
              <output id="befintligt-varde" for="befintligt">0 m²</output>
            </div>
          </fieldset>''',
    val("grans", "Hur nära tomtgränsen ska huset stå?",
        [("langt", "4,5 m eller mer"), ("medgivande", "Närmare, grannen har sagt ja"),
         ("nara", "Närmare, utan medgivande")]),
    val("bo", "Ska huset ha kök, badrum eller eldstad?",
        [("ja", "Ja, det ska gå att bo i"), ("nej", "Nej, gäststuga, kontor eller förråd")]),
    val("vatten", "Ligger tomten nära vatten?",
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
            prata med kommunen om. Det tar under en minut.
          </p>
        </div>
      </section>

      <section class="kollen">
        <div class="kollen__inner">
          <form class="kollen__form" id="kollen" aria-label="Frågor om tomten">
{FORMULAR}
          </form>

          <aside class="kollen__svar" aria-live="polite">
            <div class="kollen__kort">
              <p class="kollen__etikett">Ditt svar</p>

              <div class="kollen__matare">
                <div class="matarblock">
                  <svg class="matare" viewBox="0 0 120 70" aria-hidden="true" focusable="false">
                    <path class="matare__spar" d="M10 64a50 50 0 0 1 100 0" pathLength="100"/>
                    <path class="matare__varde" id="matare-hus" d="M10 64a50 50 0 0 1 100 0" pathLength="100" style="--varde: 46"/>
                  </svg>
                  <p class="matarblock__tal"><strong id="svar-yta">30</strong><small> m²</small></p>
                  <p class="matarblock__text">största nya hus</p>
                </div>

                <div class="matarblock">
                  <svg class="matare" viewBox="0 0 120 70" aria-hidden="true" focusable="false">
                    <path class="matare__spar" d="M10 64a50 50 0 0 1 100 0" pathLength="100"/>
                    <path class="matare__varde" id="matare-hojd" d="M10 64a50 50 0 0 1 100 0" pathLength="100" style="--varde: 89"/>
                  </svg>
                  <p class="matarblock__tal"><strong id="svar-hojd">4,0</strong><small> m</small></p>
                  <p class="matarblock__text">högsta nockhöjd</p>
                </div>
              </div>

              <p class="kollen__valt" id="svar-valt" hidden></p>

              <p class="kollen__summa" id="svar-summa"></p>

              <ul class="kollen__lista" id="svar-lista"></ul>

              <div class="kollen__knappar">
                <button class="kollen__dela" type="button" id="svar-dela">Kopiera länk till svaret</button>
                <button class="kollen__dela kollen__pdf" type="button" data-skriv-ut>Spara som PDF</button>
              </div>

              <p class="kollen__friskrivning">
                Vägledning, inte ett beslut. Detaljplanen och kommunen har
                sista ordet. <a href="attefallshus-regler.html">Läs hela guiden</a>
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section class="kollen-hus">
        <div class="kollen-hus__inner">
          <div class="kollen-hus__topp">
            <p class="section-label">Hus som ryms</p>
            <h2 class="kollen-hus__titel" id="hus-rubrik">Modeller upp till 30 m²</h2>
          </div>
          <div class="kollen-hus__rutnat" id="hus-lista"></div>
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
        function husKort(m) {
          var med3d = /^hus-r\\d\\.webp$/.test(m.bild);
          return '<a class="kollen-hus__kort" href="huskort.html?typ=' + m.typ + '&amp;modell=' + m.nr + (med3d ? '#i-3d' : '') + '">' +
            '<span class="kollen-hus__bild"><img src="images/' + m.bild + '" alt="" loading="lazy" decoding="async">' +
            (med3d ? '<span class="kollen-hus__3d">Se i 3D</span>' : '') + '</span>' +
            '<span class="kollen-hus__rad"><strong>' + m.kategori + ', ' + m.namn.toLowerCase() + '</strong>' +
            '<span class="kollen-hus__yta">' + m.yta + '<small>m²</small></span></span>' +
            '<span class="kollen-hus__fakta">' + m.rum + ' rum' +'</span></a>';
        }

        function rakna() {
          var plan = vald('plan');
          var regel = REGLER[plan === 'utanfor' ? 'utanfor' : 'inom'];
          var perHus = regel[0], totalt = regel[1], hojd = regel[2];
          var befintligt = parseInt(reglage.value, 10) || 0;
          reglageUt.textContent = befintligt + ' m²';
          var kvar = Math.max(0, totalt - befintligt);
          var yta = Math.min(perHus, kvar);

          document.getElementById('svar-yta').textContent = yta;
          document.getElementById('svar-hojd').textContent = hojd;
          // Mataren ar skalad mot det storsta som gar, 65 m2 och 4,5 m.
          document.getElementById('matare-hus').style.setProperty('--varde', Math.round(yta / 65 * 100));
          document.getElementById('matare-hojd').style.setProperty('--varde', hojd === '4,5' ? 100 : 89);

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

          var ryms = MODELLER.filter(function (m) { return yta > 0 && m.yta <= yta; })
            .sort(function (a, b) { return b.yta - a.yta; });
          document.getElementById('hus-rubrik').textContent = yta > 0
            ? (ryms.length + (ryms.length === 1 ? ' modell' : ' modeller') + ' upp till ' + yta + ' m²')
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
