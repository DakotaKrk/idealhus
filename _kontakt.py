# Bygger kontakt.html. Kor: python _kontakt.py
# Formularet och dess skript hamtas ur index.html sa de aldrig glider isar.
import _bygg as B

s = open("index.html", encoding="utf-8").read().replace("\r\n", "\n")

a = s.index('          <form class="contact-form"')
b = s.index("</form>", a) + len("</form>\n")
FORMULAR = s[a:b]

a2 = s.index("      // Kontaktformularet.")
b2 = s.index("      })();", s.index("form.addEventListener", a2)) + len("      })();\n")
FORMSKRIPT = "\n" + s[a2:b2]

KROPP = open("_kontaktkropp.inc", encoding="utf-8").read().replace("__FORMULAR__", FORMULAR)

ut = (B.head("Kontakt | Idealhus",
             "Kontakta Idealhus om husmodeller, offert och nästa steg. "
             "Du når oss direkt.",
             "hus-r4.webp", fil="kontakt.html")
      + "\n" + B.header("Kontakt") + "\n" + KROPP + B.SIDFOT + "\n"
      + B.skript(FORMSKRIPT))

open("kontakt.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("kontakt.html")
