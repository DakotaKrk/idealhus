# -*- coding: utf-8 -*-
# Bygger 404-sidan, sitemap.xml och robots.txt. Kor: python _extra.py
import datetime
import io

import _bygg as B

SIDOR = [
    ("", "1.0"),
    ("attefallshus.html", "0.9"),
    ("fritidshus.html", "0.9"),
    ("fjallstugor.html", "0.9"),
    ("villor.html", "0.9"),
    ("proffs.html", "0.7"),
    ("huskort.html", "0.6"),
    ("sa-fungerar-det.html", "0.7"),
    ("referensprojekt.html", "0.7"),
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
            <a href="fjallstugor.html">Fjällstugor</a>
            <a href="villor.html">Villor</a>
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

print("404.html\nsitemap.xml\nrobots.txt")
