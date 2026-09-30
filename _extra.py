# -*- coding: utf-8 -*-
# Bygger 404-sidan, sitemap.xml och robots.txt. Kor: python _extra.py
import datetime
import io

import _bygg as B

SIDOR = [
    ("", "1.0"),
    ("attefallshus.html", "0.9"),
    ("fritidshus.html", "0.9"),
    ("proffs.html", "0.7"),
    ("huskort.html", "0.6"),
    ("sa-fungerar-det.html", "0.7"),
    ("om-oss.html", "0.6"),
    ("kontakt.html", "0.8"),
    ("priser.html", "0.8"),
    ("attefallshus-regler.html", "0.8"),
    ("vad-far-jag-bygga.html", "0.8"),
    ("aga-och-hyra-ut.html", "0.7"),
    ("integritetspolicy.html", "0.3"),
]

# --- 404 ------------------------------------------------------------------
KROPP = '''    <main id="innehall">
      <section class="fyrafyra">
        <div class="fyrafyra__inner">
          <p class="section-label">404</p>
          <h1 class="fyrafyra__titel">Den här sidan finns inte.</h1>
          <p class="fyrafyra__text">
            Adressen kan ha ändrats, eller så blev det ett tecken fel på vägen.
            Härifrån kommer du vidare.
          </p>

          <div class="fyrafyra__lankar">
            <a class="knapp-fylld" href="kontakt.html">Kontakta oss</a>
            <a class="knapp-linje" href="index.html">Till startsidan</a>
          </div>

          <div class="fyrafyra__hus">
            <a href="attefallshus.html">Attefallshus</a>
            <a href="fritidshus.html">Fritidshus</a>
            <a href="proffs.html">Proffs</a>
          </div>
        </div>
      </section>
    </main>

'''

ut = (B.head("Sidan finns inte | Idealhus",
             "Sidan du sökte finns inte. Här hittar du vägen vidare till "
             "våra hus, processen och kontakt.", None, fil="404.html")
      + "\n" + B.header("") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript(""))
# GitHub Pages visar 404-sidan på vilken felaktig adress som helst, även
# djupt ned (/idealhus/hus/villor/...). Då pekade styles.css, loggan och
# alla länkar på fel mapp och sidan kom utan stil. <base> gör att allt
# hämtas från sajtens rot. Hopplänken (#innehall) skulle då gå till
# startsidan, så den hoppar inom sidan med ett litet skript.
ut = ut.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n    <base href="%s">' % B.BAS, 1)
ut = ut.replace("</body>", """    <script>
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var mal = document.getElementById(a.getAttribute('href').slice(1));
          if (!mal) return;
          e.preventDefault();
          mal.setAttribute('tabindex', '-1');
          mal.focus();
          mal.scrollIntoView();
        });
      });
    </script>
  </body>""", 1)
io.open("404.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))

# --- sitemap --------------------------------------------------------------
idag = datetime.date.today().isoformat()
rader = "\n".join(
    "  <url>\n"
    "    <loc>%s%s</loc>\n"
    "    <lastmod>%s</lastmod>\n"
    "    <priority>%s</priority>\n"
    "  </url>" % (B.BAS, fil, idag, pri)
    for fil, pri in SIDOR)

sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + rader + "\n</urlset>\n")
io.open("sitemap.xml", "w", encoding="utf-8", newline="\r\n").write(sitemap)

# --- robots ---------------------------------------------------------------
robots = ("User-agent: *\n"
          "Allow: /\n\n"
          "Sitemap: %ssitemap.xml\n" % B.BAS)
io.open("robots.txt", "w", encoding="utf-8", newline="\r\n").write(robots)

# --- Filerna som ska upp på webbhotellet ----------------------------------
# Bara det sajten faktiskt använder. images/ har gamla bilder kvar (bland
# annat husen som togs bort 2026-09-24) - de ska inte ligga publikt.
# publicera.ps1 laddar upp exakt den här listan.
import os
import re

SIDFILER = sorted(f for f in os.listdir(".") if f.endswith(".html") and not f.startswith("_")) + [
    "styles.css", "design.css", "premium.js", "sitemap.xml", "robots.txt",
    "favicon.ico", "apple-touch-icon.png", ".htaccess"]
text = "".join(io.open(f, encoding="utf-8", errors="ignore").read()
               for f in SIDFILER if f.endswith((".html", ".css", ".js")))
media = set(m.rstrip(".") for m in re.findall(r"(?:images|modeller|vendor|fonts)/[\w./-]+", text))
for namn in re.findall(r"['\"]([\w-]+\.(?:webp|png|jpg|svg|mp4|glb))['\"]", text):
    for mapp in ("images/", "modeller/"):
        media.add(mapp + namn)
media |= {"modeller/hus-r%d.glb" % i for i in range(1, 6)}
media |= {"vendor/model-viewer.min.js", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css"}
media = sorted(m for m in media if os.path.isfile(m))
saknas = [f for f in SIDFILER if not os.path.isfile(f)]
assert not saknas, saknas
io.open("publicera-filer.txt", "w", encoding="utf-8", newline="\r\n").write(
    "# Skrivs av _extra.py - ändra inte för hand.\n" + "\n".join(SIDFILER + media) + "\n")

print("404.html\nsitemap.xml\nrobots.txt\npublicera-filer.txt (%d filer)" % (len(SIDFILER) + len(media)))
