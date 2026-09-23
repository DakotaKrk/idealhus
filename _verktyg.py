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

              <button class="kollen__dela" type="button" id="svar-dela">Kopiera länk till svaret</button>

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
            bygglov kan det bli betydligt större -
            <a href="villor.html">se villorna</a> eller
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
              är det som oftast överraskar. Fyra öppna kartor och tjänster ger
              en första bild av din tomt. Sök på din adress i var och en.
            </p>
          </div>
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

''' + io.open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

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

        function husKort(m) {
          return '<a class="kollen-hus__kort" href="huskort.html?typ=' + m.typ + '&amp;modell=' + m.nr + '">' +
            '<img src="images/' + m.bild + '" alt="" loading="lazy" decoding="async">' +
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
        form.addEventListener('input', rakna);
        form.addEventListener('change', rakna);
        form.addEventListener('submit', function (e) { e.preventDefault(); });
        rakna();
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
