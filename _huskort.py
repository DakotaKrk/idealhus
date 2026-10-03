# -*- coding: utf-8 -*-
"""Skriver in modelltabellen och lasaren i huskort.html. Kor: python _huskort.py

huskort.html underhalls for hand, men den har biten ska inte skrivas
for hand: den ar samma data som kategorisidornas kort bygger pa. Skriptet
byter ut allt mellan markorerna, resten av sidan ror det inte.

Sedan 2026-10-03 har varje hus en egen sida (sadel-30.html, sadel-30-bred.html,
pulpet-30.html, kupa-40.html, kupa-50.html; _modeller.py SIDA), och
huskort.html ar bara en liten omdirigeringssida utan MODELLER-block: ett
skript skickar gamla lankar huskort.html?typ=...&modell=... vidare, och utan
JavaScript visas en lanklista till de fem sidorna. Skriptet har har darfor
inget kvar att skriva och avbryter. Modellsidorna underhalls for hand:
modellen, texterna och faktaraden star i deras HTML, och deras MODELLER-block
ar en kopia med titel och alt per modell som laser modellen fran
<main data-hus-typ data-hus-nr>. Det har skriptet ror dem inte.
"""
import io
import json
import os

import _modeller as M

os.chdir(os.path.dirname(os.path.abspath(__file__)))

START = "      /* MODELLER:START"
SLUT = "      /* MODELLER:SLUT */"


def komma(v):
    return ("%.2f" % v).replace(".", ",")


def tabell():
    rader = ["        var MODELLER = {"]
    for slug, (namn, modeller) in M.KATEGORIER.items():
        rader.append("          %s: {" % slug)
        rader.append("            namn: '%s'," % namn)
        rader.append("            sida: '%s.html'," % slug)
        rader.append("            modeller: [")
        for mnamn, bild, yta, rum, lev in modeller:
            text = json.dumps([M.BESKRIVNING[mnamn], M.GEMENSAMT], ensure_ascii=False)
            l, b, nock = M.MATT[bild]
            rader.append("              { namn: '%s', bild: '%s', yta: %d, rum: %d, lev: %d, matt: '%s \u00d7 %s', nock: '%s', tak: '%s', text: %s },"
                         % (mnamn, bild, yta, rum, lev, komma(l), komma(b), komma(nock), M.TAK[mnamn], text))
        rader.append("            ]")
        rader.append("          },")
    rader.append("        };")
    return "\n".join(rader)


BLOCK = '''      /* MODELLER:START - skrivs av _huskort.py, andra inte for hand */
      (function () {
%s

        // Korten pa kategorisidorna lankar hit med kategori och nummer.
        // Utan (giltiga) parametrar visas forsta attefallshuset - sidan
        // ar ingen exempelsida langre (2026-09-30).
        var p = new URLSearchParams(window.location.search);
        var slug = p.get('typ');
        var typ = MODELLER[slug];
        var nr = parseInt(p.get('modell'), 10);
        if (!typ || !(nr >= 1 && nr <= typ.modeller.length)) {
          slug = 'attefallshus';
          typ = MODELLER.attefallshus;
          nr = 1;
        }

        var m = typ.modeller[nr - 1];

        // Kategorin med i titeln - "Huskort 2" finns både bland
        // attefallshusen och fritidshusen.
        document.title = m.namn + ' \\u2013 ' + typ.namn + ' | Idealhus';

        // Formulärets modellval var alltid "Huskort 1". Nu är det huset
        // man tittar på som står förvalt.
        var modellval = document.getElementById('field-model');
        if (modellval && modellval.options.length) {
          modellval.options[0].textContent = typ.namn + ', ' + m.namn;
          modellval.selectedIndex = 0;
        }

        document.querySelectorAll('[data-model-title]').forEach(function (element) {
          element.textContent = m.namn;
        });

        var heroBild = document.querySelector('.subpage-hero__image');
        if (heroBild) {
          heroBild.src = 'images/' + m.bild;
          heroBild.alt = m.namn + ', ' + typ.namn.toLowerCase() + ' i svensk natur';
        }

        // Rubriken sager bara "Huskort 3" - metaraden far bara kategorin,
        // annars gar det inte att se vilken av de fyra man tittar pa.
        var meta = document.querySelector('.subpage-hero__meta');
        if (meta) {
          meta.textContent = typ.namn + ' \\u00b7 ' + m.yta + ' m\\u00b2 \\u00b7 '
            + m.rum + ' rum \\u00b7 leverans ' + m.lev + ' veckor';
        }

        // Bara de varden listan faktiskt har. Byggnadsarea och nockhojd
        // star kvar som X tills de ar bestamda.
        var varden = {
          'Yta': m.yta + ' m\\u00b2',
          'Rum': m.rum + ' rum'
        };
        document.querySelectorAll('.model-specs dt').forEach(function (dt) {
          var varde = varden[dt.textContent.trim()];
          if (varde && dt.nextElementSibling) dt.nextElementSibling.textContent = varde;
        });

        var stycken = document.querySelectorAll('.model-intro__text');
        (m.text || []).forEach(function (t, i) {
          if (stycken[i]) stycken[i].textContent = t;
        });

        document.querySelectorAll('.model-price__card').forEach(function (kort) {
          var etikett = kort.querySelector('span');
          var rubrik = kort.querySelector('h3');
          if (etikett && rubrik && etikett.textContent.trim() === 'Leverans') {
            rubrik.textContent = m.lev + ' veckor';
          }
        });

        // Huskortets nya topp och faktarad (2026-10-05): varje ruta med
        // data-hus fylls med sitt värde, bilden och länken tillbaka följer
        // modellen, och huset man tittar på göms bland "Fler hus".
        function satt(namn, varde) {
          document.querySelectorAll('[data-hus="' + namn + '"]').forEach(function (e) { e.textContent = varde; });
        }
        satt('typ', typ.namn);
        satt('yta', m.yta + ' m\u00b2');
        satt('rum', m.rum + ' rum');
        satt('lev', m.lev + ' veckor');
        satt('matt', m.matt + ' m');
        satt('nock', m.nock + ' m');
        satt('tak', m.tak);
        var husBild = document.querySelector('[data-hus-bild]');
        if (husBild) {
          husBild.src = 'images/' + m.bild;
          husBild.alt = m.namn + ', ' + typ.namn.toLowerCase() + ' i svensk natur';
        }
        var tillbaka = document.querySelector('[data-hus-tillbaka]');
        if (tillbaka) {
          tillbaka.href = typ.sida;
          var tt = tillbaka.querySelector('span');
          if (tt) tt.textContent = 'Alla ' + typ.namn.toLowerCase();
        }
        var rymsLank = document.querySelector('[data-ryms]');
        if (rymsLank) {
          rymsLank.href = 'vad-far-jag-bygga.html?yta=' + m.yta + '&namn='
            + encodeURIComponent(typ.namn + ', ' + m.namn);
        }
        // Planen är ett exempel på 30 m², ritad i Sadel 30 Breds mått.
        // Kupa-husen har ingen ritad plan, och mått och rumsytor står bara
        // kvar där de stämmer.
        var plan = document.getElementById('planlosning');
        if (plan) {
          plan.hidden = m.yta !== 30;
          if (m.namn !== 'Sadel 30 Bred') {
            plan.querySelectorAll('.plan-matt, .plan-mattext--hus, .plan-yta-text').forEach(function (e) { e.remove(); });
          }
        }
        document.querySelectorAll('[data-hus-kort]').forEach(function (k) {
          k.hidden = k.getAttribute('data-hus-kort') === slug + '-' + nr;
        });
      })();
      /* MODELLER:SLUT */'''


def main():
    s = io.open("huskort.html", encoding="utf-8", newline="").read().replace("\r\n", "\n")

    # huskort.html ar en omdirigeringssida sedan 2026-10-03 (se ovan).
    if START not in s:
        print("huskort.html har inget MODELLER-block (omdirigeringssida) - inget skrivet")
        return

    nytt = BLOCK % tabell()

    if START in s:
        i = s.index(START)
        j = s.index(SLUT, i) + len(SLUT)
        s = s[:i] + nytt + s[j:]
    else:
        # Forsta gangen: den gamla lasaren som bara kunde modell 1-4 byts ut.
        nyckel = "var nummer = new URLSearchParams"
        i = s.rindex("      (function () {", 0, s.index(nyckel))
        j = s.index("      })();", i) + len("      })();")
        s = s[:i] + nytt + s[j:]

    io.open("huskort.html", "w", encoding="utf-8", newline="\r\n").write(s)
    print("huskort.html: modelltabellen inskriven,",
          sum(len(v[1]) for v in M.KATEGORIER.values()), "modeller")


if __name__ == "__main__":
    main()
