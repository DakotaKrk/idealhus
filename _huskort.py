# -*- coding: utf-8 -*-
"""Skriver in modelltabellen och lasaren i huskort.html. Kor: python _huskort.py

huskort.html underhalls for hand, men den har biten ska inte skrivas
for hand: den ar samma data som kategorisidornas kort bygger pa. Skriptet
byter ut allt mellan markorerna, resten av sidan ror det inte.
"""
import io
import os

import _modeller as M

os.chdir(os.path.dirname(os.path.abspath(__file__)))

START = "      /* MODELLER:START"
SLUT = "      /* MODELLER:SLUT */"


def tabell():
    rader = ["        var MODELLER = {"]
    for slug, (namn, modeller) in M.KATEGORIER.items():
        rader.append("          %s: {" % slug)
        rader.append("            namn: '%s'," % namn)
        rader.append("            modeller: [")
        for mnamn, bild, yta, rum, lev in modeller:
            rader.append("              { namn: '%s', bild: '%s', yta: %d, rum: %d, lev: %d },"
                         % (mnamn, bild, yta, rum, lev))
        rader.append("            ]")
        rader.append("          },")
    rader.append("        };")
    return "\n".join(rader)


BLOCK = '''      /* MODELLER:START - skrivs av _huskort.py, andra inte for hand */
      (function () {
%s

        // Korten pa kategorisidorna lankar hit med kategori och nummer.
        // Utan parametrar star sidan kvar som den exempelsida den ar.
        var p = new URLSearchParams(window.location.search);
        var typ = MODELLER[p.get('typ')];
        var nr = parseInt(p.get('modell'), 10);
        if (!typ || !(nr >= 1 && nr <= typ.modeller.length)) return;

        var m = typ.modeller[nr - 1];

        // Kategorin med i titeln - "Huskort 2" finns både bland
        // attefallshusen och fritidshusen.
        document.title = m.namn + ' \\u2013 ' + typ.namn + ' | Idealhus';

        // Formulärets modellval var alltid "Huskort 1". Nu är det huset
        // man tittar på som står förvalt.
        var modellval = document.getElementById('field-model');
        if (modellval && modellval.options.length) {
          modellval.options[0].textContent = typ.namn + ', ' + m.namn.toLowerCase();
          modellval.selectedIndex = 0;
        }

        document.querySelectorAll('[data-model-title]').forEach(function (element) {
          var gemener = element.tagName === 'EM' || element.tagName === 'SPAN';
          element.textContent = gemener ? m.namn.toLowerCase() : m.namn;
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
          'Boyta': m.yta + ' m\\u00b2',
          'Rum': m.rum + ' rum'
        };
        document.querySelectorAll('.model-specs dt').forEach(function (dt) {
          var varde = varden[dt.textContent.trim()];
          if (varde && dt.nextElementSibling) dt.nextElementSibling.textContent = varde;
        });

        document.querySelectorAll('.model-price__card').forEach(function (kort) {
          var etikett = kort.querySelector('span');
          var rubrik = kort.querySelector('h3');
          if (etikett && rubrik && etikett.textContent.trim() === 'Leverans') {
            rubrik.textContent = m.lev + ' veckor';
          }
        });
      })();
      /* MODELLER:SLUT */'''


def main():
    s = io.open("huskort.html", encoding="utf-8", newline="").read().replace("\r\n", "\n")

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
