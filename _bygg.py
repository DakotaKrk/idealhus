# Genererar undersidorna ur en gemensam mall, sa header, meny och sidfot
# ar identiska pa alla sidor. Kors om nar mallen andras.
import re, io, os

BAS = "https://idealhus.se/"
CSS_V = "20261010l"

# Husen for den som ska bo i dem, och det vi levererar till andra som
# bygger. De sag likadana ut i menyn tidigare, som fem jamnstallda val.
KATEGORIER_PRIVAT = [
    ("Attefallshus", "attefallshus.html"),
    ("Fritidshus", "fritidshus.html"),
]

KATEGORIER_PROFFS = [
    ("Proffs", "proffs.html"),
]

# Sammanslagen, for det som fortfarande vill ha hela listan.
KATEGORIER = KATEGORIER_PRIVAT + KATEGORIER_PROFFS

PRIVAT_ETIKETT = "För dig som ska bo"
PROFFS_ETIKETT = "För dig som bygger"

# Bild och en rad om varje kategori. En rullgardin med bara namn
# tvingar besokaren att gissa vad skillnaden ar.
KATEGORI_INFO = {
    "Attefallshus": ("tumme/meny-attefallshus.webp",
                     "Tre modeller, utan bygglov"),
    "Fritidshus": ("tumme/meny-fritidshus.webp",
                   "För helger och långa somrar"),
    "Proffs": ("tumme/meny-proffs.webp",
               "Väggar, block och moduler"),
}

MENY = [
    ("Hem", "./"),
    ("__DROPDOWN__", None),
    ("Priser", "priser.html"),
    ("Så fungerar det", "sa-fungerar-det.html"),
    ("Om oss", "om-oss.html"),
    ("Kontakt", "kontakt.html"),
]


# Modellerna direkt i menyn (2026-10-02): en rad små länkar under
# Attefallshus och Fritidshus, och samma rad i mobilmenyn. Sedan
# 2026-10-03 går de till modellernas egna sidor (_modeller.py SIDA).
MENY_MODELLER = {
    "attefallshus.html": [("Sadel 30", "sadel-30.html"), ("Sadel 30 Bred", "sadel-30-bred.html"), ("Pulpet 30", "pulpet-30.html")],
    "fritidshus.html": [("Kupa 40", "kupa-40.html"), ("Kupa 50", "kupa-50.html")],
}


def modellankar(fil):
    return "".join(f'<a href="{sida}">{namn}</a>' for namn, sida in MENY_MODELLER.get(fil, []))


GUIDELANKAR = ('<a href="attefallshus-regler.html">Attefallshus: reglerna</a>'
               '<a href="aga-och-hyra-ut.html">Äga och hyra ut</a>')


def kategorirad(namn, fil):
    bild, text = KATEGORI_INFO[namn]
    rad = (f'              <a href="{fil}">\n'
           f'                <img src="images/{bild}" alt="" loading="lazy" decoding="async">\n'
           f'                <span>\n'
           f'                  <strong>{namn}</strong>\n'
           f'                  <em>{text}</em>\n'
           f'                </span>\n'
           f'              </a>')
    if fil in MENY_MODELLER:
        rad += f'\n              <p class="main-nav__modeller">{modellankar(fil)}</p>'
    return rad


# Ett verktyg att prova, sist i husmenyn - som "Prova"-kortet i
# Kasters meny. Den som undrar vilket hus som passar undrar oftast
# forst hur stort hus som far sta pa tomten.
TIPSKORT = (
    '              <a class="main-nav__tips" href="vad-far-jag-bygga.html">\n'
    '                <span class="main-nav__tips-bild" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'
    '<path d="M8 15.3 3.5 17.4 12 21.4l8.5-4L16 15.3"/><path d="M8 17.5v-6.3l4-3.6 4 3.6v6.3M11 17.5v-3h2v3"/>'
    '<path d="M18.6 3v3.4M16.9 4.7h3.4"/></svg></span>\n'
    '                <span class="main-nav__tips-text">\n'
    '                  <span class="main-nav__tips-etikett">Prova</span>\n'
    '                  <strong>Vad får jag bygga?</strong>\n'
    '                  <em>Räkna ut vad som ryms på din tomt</em>\n'
    '                </span>\n'
    '                <svg class="main-nav__tips-pil" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    '<path d="M5 12h14M13 6l6 6-6 6"/></svg>\n'
    '              </a>')


def dropdown(aktiv):
    # Raden "Se alla modeller" ar borta. Den gick till attefallshus.html,
    # alltsa en av kategorierna - inte till alla - och stod dessutom
    # direkt under samma lank.
    rader = [f'              <p class="main-nav__sub-etikett">{PRIVAT_ETIKETT}</p>']
    rader += [kategorirad(n, f) for n, f in KATEGORIER_PRIVAT]
    rader.append('              <p class="main-nav__sub-etikett '
                 f'main-nav__sub-etikett--delad">{PROFFS_ETIKETT}</p>')
    rader += [kategorirad(n, f) for n, f in KATEGORIER_PROFFS]
    rader.append('              <p class="main-nav__sub-etikett main-nav__sub-etikett--delad">Bra att veta</p>')
    rader.append(f'              <p class="main-nav__guider">{GUIDELANKAR}</p>')
    rader.append(TIPSKORT)
    val = "\n".join(rader)
    klass = "main-nav__link main-nav__toggle"
    if aktiv == "Våra hus":
        klass = "main-nav__link main-nav__link--active main-nav__toggle"
    return (f'          <div class="main-nav__item" data-dropdown>\n'
            f'            <button class="{klass}" type="button" aria-expanded="false" '
            f'aria-controls="undermeny-hus">Våra hus<span class="main-nav__pil" aria-hidden="true"></span></button>\n'
            f'            <div class="main-nav__sub" id="undermeny-hus">\n{val}\n'
            f'            </div>\n          </div>')


# Verktyget står som en egen, utmärkt länk i menyn (2026-10-08).
VERKTYG_NAMN = "Vad får jag bygga?"
VERKTYG_IKON = ('<span class="main-nav__verktyg-ikon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path class="mv-mark" pathLength="1" d="M8 15.3 3.5 17.4 12 21.4l8.5-4L16 15.3"/><path class="mv-hus" pathLength="1" d="M8 17.5v-6.3l4-3.6 4 3.6v6.3M11 17.5v-3h2v3"/><path class="mv-matt" pathLength="1" d="M18.6 3v3.4M16.9 4.7h3.4"/></svg></span>')


def verktygslank(aktiv):
    k = "main-nav__link main-nav__verktyg" + (" main-nav__link--active" if aktiv else "")
    cur = ' aria-current="page"' if aktiv else ""
    return (f'          <a class="{k}" href="vad-far-jag-bygga.html"{cur}>{VERKTYG_IKON}'
            '<span class="main-nav__verktyg-text">Vad får jag bygga?</span></a>')


def huvudmeny(aktiv):
    rader = []
    for namn, fil in MENY:
        if namn == "__DROPDOWN__":
            rader.append(dropdown(aktiv))
            rader.append(verktygslank(aktiv == VERKTYG_NAMN))
            continue
        k = "main-nav__link main-nav__link--active" if namn == aktiv else "main-nav__link"
        rader.append(f'          <a class="{k}" href="{fil}">{namn}</a>')
    return "\n".join(rader)


MMENY_PIL = ('<svg class="mmeny__pil" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
             '<path d="M5 12h14M13 6l6 6-6 6"/></svg>')


def mmeny_kort(namn, fil, bred=False):
    bild, text = KATEGORI_INFO[namn]
    klass = "mmeny__kort mmeny__kort--bred" if bred else "mmeny__kort"
    return (f'            <a class="{klass}" href="{fil}">'
            f'<span class="mmeny__bild"><img src="images/{bild}" width="480" height="320" alt="" '
            f'loading="lazy" decoding="async"></span>'
            f'<span class="mmeny__korttext"><strong>{namn}</strong><em>{text}</em></span></a>')


def mobilmeny():
    """Mobilmenyn (2026-09-30): husen som kort överst, sedan sidorna som
    stora länkar, verktyget, temat (läggs in av premium.js), offerten
    och mejlen. --i styr i vilken ordning raderna glider fram."""
    hus = "\n".join(mmeny_kort(n, f) for n, f in KATEGORIER_PRIVAT)
    proffs = "\n".join(mmeny_kort(n, f, True) for n, f in KATEGORIER_PROFFS)
    rader = [f'''          <div class="mmeny__grupp" style="--i:0">
            <p class="mmeny__etikett">{PRIVAT_ETIKETT}</p>
            <div class="mmeny__hus">
{hus}
            </div>
            <p class="mmeny__modeller">{modellankar("attefallshus.html")}{modellankar("fritidshus.html")}</p>
            <p class="mmeny__etikett">{PROFFS_ETIKETT}</p>
{proffs}
            <p class="mmeny__etikett">Bra att veta</p>
            <p class="mmeny__guider">{GUIDELANKAR}</p>
          </div>''']
    i = 1
    for namn, fil in MENY:
        if namn == "__DROPDOWN__":
            continue
        rader.append(f'          <a class="mmeny__lank" href="{fil}" style="--i:{i}"><span>{namn}</span>{MMENY_PIL}</a>')
        i += 1
    # Verktyget står direkt efter husen i HTML:en också, så att tab-
    # ordningen följer det man ser.
    rader.insert(1,
        f'          <a class="mmeny__tips" href="vad-far-jag-bygga.html" style="--i:{i}">'
        '<span class="mmeny__tipsbild" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'
        '<path pathLength="1" d="M8 15.3 3.5 17.4 12 21.4l8.5-4L16 15.3"/><path pathLength="1" d="M8 17.5v-6.3l4-3.6 4 3.6v6.3M11 17.5v-3h2v3"/>'
        '<path pathLength="1" d="M18.6 3v3.4M16.9 4.7h3.4"/></svg></span>'
        '<span class="mmeny__tipstext"><span class="mmeny__prova">Prova</span>'
        '<strong>Vad får jag bygga?</strong><em class="mmeny__tipsrad">Fem frågor · svar direkt</em></span>' + MMENY_PIL + '</a>')
    rader.append(f'          <a class="mmeny__cta" href="kontakt.html" style="--i:{i + 2}">Börja här</a>')
    rader.append(f'          <p class="mmeny__kontakt" style="--i:{i + 3}">'
                 '<a href="mailto:info@idealhus.se">info@idealhus.se</a><span>Stockholm, Sverige</span></p>')
    return "\n".join(rader)


# Temat sätts innan sidan ritas, annars blinkar den vit för den som valt
# mörkt läge. Har man inte valt följer sidan telefonens eller datorns
# eget läge (2026-09-25). _premium.py för in samma rad i handsidorna.
TEMASKRIPT = ("<script>try{var t=new URLSearchParams(location.search).get('tema')||"
              "localStorage.getItem('idealhus-tema');if(t==='mork'||(!t&&window.matchMedia&&"
              "matchMedia('(prefers-color-scheme: dark)').matches))"
              "document.documentElement.setAttribute('data-tema','mork')}catch(e){}</script>")

# Menyradens intro spelas bara första gången under besöket och på
# startsidan (2026-10-05) - inte vid varje sidbyte.
MENYSKRIPT = (r"<script>try{var s=sessionStorage,h=/(^|\/)(index\.html)?$/.test(location.pathname);"
              "if(s.getItem('idealhus-meny')&&!h)document.documentElement.classList.add('meny-stilla');"
              "s.setItem('idealhus-meny','1')}catch(e){}</script>")
# Menyraden får sitt övergångsnamn bara under sidbytet - ett namn hela
# tiden gör raden till en backdrop root och stänger av glaset (2026-10-06).
VTSKRIPT = ("<script>(function(){function n(){var h=document.querySelector('.site-header');"
            "if(h)h.style.viewTransitionName='sidhuvud';return h}addEventListener('pageswap',"
            "function(e){if(e.viewTransition)n()});addEventListener('pagereveal',function(e){"
            "if(!e.viewTransition)return;document.documentElement.classList.add('meny-stilla');"
            "var h=n(),t=function(){if(h)h.style.viewTransitionName=''};"
            "e.viewTransition.finished.then(t,t)})})()</script>")
TEMASKRIPT = TEMASKRIPT + MENYSKRIPT + VTSKRIPT


# Typsnitten ligger i fonts/ sedan 2026-09-30 (Poppins och Manrope, som
# Uperformance) - inga anrop till Google. De två som syns direkt
# förladdas, så rubriken inte hinner ritas i reservtypsnittet.
TYPSNITT = (
    '    <link rel="preload" href="fonts/poppins-600.woff2" as="font" type="font/woff2" crossorigin>\n'
    '    <link rel="preload" href="fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>')


def delningsbild(kalla):
    """JPG i 1200 x 630 för länkförhandsvisningar (2026-10-01).

    iMessage, WhatsApp och flera andra visar inte WebP som delningsbild,
    så varje sida får en JPG gjord ur sin bild. Husbilderna beskärs
    nerifrån (skylten sitter i nedre vänstra hörnet), övriga på mitten.
    Filen skapas bara om den saknas.
    """
    import os
    namn = os.path.splitext(os.path.basename(kalla))[0]
    ut = f"delning/{namn}.jpg"
    if not os.path.exists("images/" + ut):
        from PIL import Image
        os.makedirs("images/delning", exist_ok=True)
        im = Image.open("images/" + kalla).convert("RGB")
        b, h = im.size
        nh = round(b * 630 / 1200)
        if nh <= h:
            top = h - nh if namn.startswith("hus-r") else (h - nh) // 2
            im = im.crop((0, top, b, top + nh))
        else:
            nb = round(h * 1200 / 630)
            im = im.crop(((b - nb) // 2, 0, (b - nb) // 2 + nb, h))
        im.resize((1200, 630), Image.LANCZOS).save("images/" + ut, "JPEG", quality=82,
                                                   optimize=True, progressive=True)
    return ut


# Alt-text för delningsbilderna (og:image:alt), samma text som husbilderna
# har på sidorna. Nycklarna är filerna i images/delning/ (2026-10-03).
DELNINGSALT = {
    "hus-r1.jpg": "Sadel 30 Bred, svart attefallshus med sadeltak och glasgavel på en klippa vid havet",
    "hus-r2.jpg": "Sadel 30, attefallshus i ljust trä med svart sadeltak på en äng vid vatten",
    "hus-r3.jpg": "Kupa 40, svart fritidshus med takkupa och trädäck i en tallskog",
    "hus-r4.jpg": "Kupa 50, ljusgrått fritidshus med takkupa på en gräsmatta bland björkar",
    "hus-r5.jpg": "Pulpet 30, svart attefallshus med pulpettak och stora glaspartier i snöig skog",
    "stommar-stapel.jpg": "Färdiga väggstommar i trä staplade på varandra",
    "dronare-montage.jpg": "Drönarbild av ett hus under montage, med inplastade väggar runt en betongplatta och en kran",
    "dronare-vaggblock.jpg": "Drönarbild av ett bygge med väggstommar i trä på marken och en lastbil med takstolar",
    "lyft-stommar.jpg": "En kranarm lyfter en bunt väggstommar i trä ovanför väggar som redan står resta",
    "dronare-platta.jpg": "Två personer i arbete på betongplattan mellan de resta väggarna",
    "arbetare-vattenpass.jpg": "En snickare i varselkläder håller vattenpass mot en väggstomme",
}

# Organisationen och webbplatsen i strukturerad data (2026-10-03). Bara det
# som står synligt på sajten: ingen gatuadress, inget telefonnummer, inget
# organisationsnummer, inga sociala profiler (adresserna är okända) och
# ingen areaServed. Sidornas egna noder (WebPage m.m.) underhålls i html.
ORG = {
    "@type": "Organization",
    "@id": BAS + "#organisation",
    "name": "Idealhus",
    "legalName": "Idealhus AB",
    "url": BAS,
    "logo": BAS + "images/idealhus.svg",
    "image": BAS + "images/hus-r2.webp",
    "email": "info@idealhus.se",
    "description": "Idealhus formger och bygger attefallshus och fritidshus och tillverkar byggelement för proffs, allt under tak i Sverige.",
    "address": {"@type": "PostalAddress", "addressLocality": "Stockholm", "addressCountry": "SE"},
}
WEB = {
    "@type": "WebSite",
    "@id": BAS + "#webbplats",
    "url": BAS,
    "name": "Idealhus",
    "inLanguage": "sv-SE",
    "publisher": {"@id": BAS + "#organisation"},
}


def jsonld(noder=()):
    """Ett enda JSON-LD-block med ORG, WEB och sidans egna noder."""
    import json
    g = {"@context": "https://schema.org", "@graph": [ORG, WEB] + list(noder)}
    return "\n".join("    " + r for r in json.dumps(g, ensure_ascii=False, indent=2).split("\n"))


def head(titel, beskrivning, forladdad=None, fil=None, ogtyp="website", delning=None, noder=()):
    # delning: bilden som delningsbilden görs av, om den inte är forladdad.
    # noder: sidans egna JSON-LD-noder efter ORG och WEB.
    pre = f'\n    <link rel="preload" as="image" href="images/{forladdad}" fetchpriority="high">' if forladdad else ""
    bild = delningsbild(delning or forladdad or 'hus-r2.webp')
    bildalt = DELNINGSALT.get(bild.split("/")[-1], "")
    return f'''<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{titel}</title>
    <meta name="description" content="{beskrivning}">
    <meta name="theme-color" content="#1b1915">
    <link rel="icon" href="images/idealhus.svg" type="image/svg+xml">
    <link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <link rel="canonical" href="{BAS}{fil or ''}">

    <meta property="og:type" content="{ogtyp}">
    <meta property="og:locale" content="sv_SE">
    <meta property="og:site_name" content="Idealhus">
    <meta property="og:title" content="{titel}">
    <meta property="og:description" content="{beskrivning}">
    <meta property="og:image" content="{BAS}images/{bild}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{bildalt}">
    <meta property="og:url" content="{BAS}{fil or ''}">
    <meta name="twitter:card" content="summary_large_image">

{TYPSNITT}{pre}
    <link rel="stylesheet" href="styles.css?v={CSS_V}">
    <link rel="stylesheet" href="design.css?v={CSS_V}">
    <script src="premium.js?v={CSS_V}" defer></script>
    {TEMASKRIPT}
    <script type="application/ld+json">
{jsonld(noder)}
    </script>
  </head>
  <body>'''


def header(aktiv):
    return f'''    <a class="skip" href="#innehall">Hoppa till innehållet</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="logo" href="./" aria-label="Till Idealhus startsida">
          <img class="logo__svg" src="images/idealhus_logo.svg" width="1024" height="279" alt="Idealhus">
        </a>

        <nav class="main-nav" aria-label="Huvudmeny">
{huvudmeny(aktiv)}
        </nav>

        <div class="site-header__actions">
          <button class="temaknapp" type="button" aria-pressed="false" aria-label="Byt till mörkt läge"><svg class="temaknapp__sol" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg><svg class="temaknapp__mane" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button>
          <a class="header-button" href="kontakt.html">Börja här</a>

          <button class="menu-button" type="button" aria-label="Öppna meny" aria-expanded="false" aria-controls="mobile-nav">
            <span class="menu-button__line"></span>
            <span class="menu-button__line"></span>
            <span class="menu-button__line"></span>
          </button>
        </div>
      </div>

      <nav class="mmeny" id="mobile-nav" aria-label="Meny" hidden>
        <div class="mmeny__panel">
{mobilmeny()}
        </div>
      </nav>
    </header>
'''


SIDFOT = '''    <footer class="site-footer">
      <div class="site-footer__inner">
        <div>
          <img class="site-footer__logo" src="images/idealhus_logo.svg" width="1024" height="279" loading="lazy" decoding="async" alt="Idealhus">
          <p class="site-footer__text">
            Attefallshus, fritidshus och byggelement, byggda under tak i Sverige.
          </p>
          <ul class="site-footer__sociala" aria-label="Idealhus i sociala medier">
            <li style="--i:0"><a class="social social--instagram" href="https://www.instagram.com/idealhus.se/" target="_blank" rel="noopener" aria-label="Idealhus på Instagram"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect class="social__drag" pathLength="1" x="3.5" y="3.5" width="17" height="17" rx="5"/><circle class="social__drag" pathLength="1" cx="12" cy="12" r="4"/><circle class="social__prick" cx="17.2" cy="6.8" r="1.1"/></svg></a></li>
            <li style="--i:1"><a class="social social--facebook" href="#" target="_blank" rel="noopener" aria-label="Idealhus på Facebook"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="social__drag" pathLength="1" d="M14.6 21v-7.3h2.6l.4-3.1h-3V8.7c0-.9.3-1.5 1.6-1.5h1.6V4.4a21 21 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.2H8.8v3.1h2.6V21"/></svg></a></li>
            <li style="--i:2"><a class="social social--tiktok" href="#" target="_blank" rel="noopener" aria-label="Idealhus på TikTok"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="social__drag" pathLength="1" d="M13.6 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3"/><path class="social__drag" pathLength="1" d="M13.6 3.5c.4 2.6 2.1 4.3 4.7 4.5"/></svg></a></li>
          </ul>
        </div>

        <div>
          <h2 class="site-footer__heading">Navigation</h2>
          <nav class="site-footer__nav" aria-label="Sidfotens navigering">
            <a href="./">Hem</a>
            <a href="priser.html">Priser</a>
            <a href="sa-fungerar-det.html">Så fungerar det</a>
            <a href="om-oss.html">Om oss</a>
            <a href="kontakt.html">Kontakt</a>
            <a href="attefallshus-regler.html">Attefallshus: reglerna</a>
            <a href="vad-far-jag-bygga.html">Vad får jag bygga?</a>
            <a href="aga-och-hyra-ut.html">Äga och hyra ut</a>
          </nav>
        </div>

        <div>
          <h2 class="site-footer__heading">Våra hus</h2>
          <nav class="site-footer__nav" aria-label="Sidfotens husmodeller">
''' + "\n".join(
    [f'            <a href="{fil}">{namn}</a>' for namn, fil in KATEGORIER_PRIVAT]
    + [f'            <span class="site-footer__etikett">{PROFFS_ETIKETT}</span>']
    + [f'            <a href="{fil}">{namn}</a>' for namn, fil in KATEGORIER_PROFFS]) + '''
          </nav>
        </div>

        <div>
          <h2 class="site-footer__heading">Kontakta oss</h2>
          <p class="site-footer__text">
            <a href="mailto:info@idealhus.se">info@idealhus.se</a><br>
            Stockholm, Sverige
          </p>
          <a class="site-footer__button" href="kontakt.html">Hör av dig</a>
        </div>
      </div>

      <div class="site-footer__bottom">
        <span>© 2026 Idealhus AB. Alla rättigheter förbehållna.</span>
        <a class="site-footer__policy" href="integritetspolicy.html">Integritetspolicy</a>
      </div>

      <p class="site-footer__ord" aria-hidden="true">Idealhus</p>
    </footer>
'''


def skript(extra=""):
    return '''    <script>
      // Teckningarna i skedeskorten ritar upp sig nar de kommer i vy.
      // Langden mats per linje, annars drar korta och langa streck i
      // olika takt. Fyllda delar tonas in i stallet.
      (function () {
        if (!window.IntersectionObserver) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        var teckningar = document.querySelectorAll('.skede__bild svg, .fas__bild svg');
        if (!teckningar.length) return;

        Array.prototype.forEach.call(teckningar, function (svg) {
          var nr = 0;
          Array.prototype.forEach.call(svg.querySelectorAll('path, rect'), function (el) {
            el.style.setProperty('--i', nr);
            nr += 1;
            if (el.classList.contains('accentfyll')) return;
            var langd = 0;
            try { langd = el.getTotalLength(); } catch (e) { langd = 0; }
            if (langd) el.style.setProperty('--len', Math.ceil(langd));
          });
          svg.classList.add('teckning');
        });

        // Ritas en gang, men vaken-klassen foljer med in och ut ur vyn:
        // evighetsrorelsen ska inte rulla nar teckningen inte syns.
        var obs = new IntersectionObserver(function (poster) {
          poster.forEach(function (p) {
            p.target.classList.toggle('teckning--vaken', p.isIntersecting);
            if (p.isIntersecting) p.target.classList.add('teckning--ritad');
          });
        }, { threshold: 0.15 });

        Array.prototype.forEach.call(teckningar, function (svg) { obs.observe(svg); });

        // Skyddsnat: en teckning som inte hunnit bli uppritad ska inte
        // sta kvar som en tom ruta. Det som syns ritas anda.
        window.setTimeout(function () {
          Array.prototype.forEach.call(teckningar, function (svg) {
            var r = svg.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) {
              svg.classList.add('teckning--ritad');
            }
          });
        }, 2500);
      })();
    </script>
    <script>
      // En sidovergang som hoppas over avvisar sina loften. Utan
      // detta hamnar "Transition was skipped" i konsolen pa varje
      // sidbyte som webblasaren valjer bort.
      (function () {
        function tyst(e) {
          if (e.viewTransition) e.viewTransition.finished.catch(function () {});
        }
        window.addEventListener('pageswap', tyst);
        window.addEventListener('pagereveal', tyst);
      })();
    </script>
    <script>
      (function () {
        var item = document.querySelector('[data-dropdown]');
        if (!item) return;
        var knapp = item.querySelector('.main-nav__toggle');
        var stangTimer;
        function satt(oppen) {
          item.classList.toggle('main-nav__item--open', oppen);
          knapp.setAttribute('aria-expanded', String(oppen));
        }
        knapp.addEventListener('click', function () {
          satt(!item.classList.contains('main-nav__item--open'));
        });
        item.addEventListener('mouseenter', function () {
          window.clearTimeout(stangTimer);
          if (window.matchMedia('(hover: hover)').matches) satt(true);
        });
        item.addEventListener('mouseleave', function () {
          if (!window.matchMedia('(hover: hover)').matches) return;
          stangTimer = window.setTimeout(function () { satt(false); }, 160);
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && item.classList.contains('main-nav__item--open')) {
            satt(false); knapp.focus();
          }
        });
        document.addEventListener('click', function (e) {
          if (!item.contains(e.target)) satt(false);
        });
      })();

      (function () {
        var knapp = document.querySelector('.menu-button');
        var panel = document.getElementById('mobile-nav');
        if (!knapp || !panel) return;
        knapp.addEventListener('click', function () {
          var oppen = knapp.getAttribute('aria-expanded') === 'true';
          knapp.setAttribute('aria-expanded', String(!oppen));
          knapp.setAttribute('aria-label', oppen ? 'Öppna meny' : 'Stäng meny');
          knapp.classList.toggle('menu-button--open', !oppen);
          panel.hidden = oppen;
          // Sidans rullelement ar <html>. Utan last rullar sidan bakom
          // en meny som tacker nastan hela skarmen.
          document.documentElement.style.overflow = oppen ? '' : 'hidden';
        });
      })();

      (function () {
        if (!window.IntersectionObserver) return;
        var valjare = ['.subpage-hero__content', '.category-filter', '.filter', '.category__head',
          '.model-card', '.process__head', '.process__lista li', '.team-kort',
          '.galleri figure', '.segment__block', '.contact-page-hero__inner',
          '.contact-person', '.textsida > *', '.contact-section__intro', '.contact-form'].join(',');
        var element = Array.prototype.slice.call(document.querySelectorAll(valjare));
        if (!element.length) return;
        document.documentElement.classList.add('js-reveal');
        var raknare = new Map();
        element.forEach(function (el) {
          el.classList.add('reveal');
          var f = el.parentElement;
          var i = raknare.get(f) || 0;
          raknare.set(f, i + 1);
          if (i) el.style.setProperty('--reveal-delay', (i * 0.06).toFixed(2) + 's');
        });
        element.forEach(function (el) {
          if (el.getBoundingClientRect().top < window.innerHeight) {
            el.style.setProperty('--reveal-delay', '0s');
            el.classList.add('reveal--inne');
          }
        });
        var obs = new IntersectionObserver(function (poster) {
          poster.forEach(function (p) {
            if (!p.isIntersecting) return;
            p.target.classList.add('reveal--inne');
            obs.unobserve(p.target);
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        element.forEach(function (el) { obs.observe(el); });
        // Skyddsnatet mater bara det som ar kvar, hogst fyra ganger i
        // sekunden, och kopplar bort sig sjalvt nar allt ar framme. Att
        // mata alla element i varje bildruta tvingade fram en layout per
        // bildruta - det var det som hackade under rullning.
        var kvar = element.filter(function (el) {
          return !el.classList.contains('reveal--inne');
        });
        var senast = 0;
        function kolla() {
          var nu = Date.now();
          if (nu - senast < 250) return;
          senast = nu;
          for (var i = kvar.length - 1; i >= 0; i--) {
            var el = kvar[i];
            if (el.classList.contains('reveal--inne')) {
              kvar.splice(i, 1);
              continue;
            }
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) {
              el.classList.add('reveal--inne');
              obs.unobserve(el);
              kvar.splice(i, 1);
            }
          }
          if (!kvar.length) window.removeEventListener('scroll', kolla);
        }
        if (kvar.length) window.addEventListener('scroll', kolla, { passive: true });
      })();

      (function () {
        var rad = document.querySelector('.category-filter');
        if (!rad) return;
        function uppdatera() {
          var mer = rad.scrollWidth - rad.clientWidth - rad.scrollLeft > 8;
          rad.classList.toggle('category-filter--mer', mer);
        }
        uppdatera();
        rad.addEventListener('scroll', uppdatera, { passive: true });
        window.addEventListener('resize', uppdatera);
      })();

      // Egen rullgardin. Systemets egen lista gar inte att forma, sa den
      // byggs om har. Selecten ligger kvar dold och bar vardet, vilket
      // gor att formularets ovriga kod inte behover veta om det har.
      (function () {
        var listor = document.querySelectorAll('.contact-form select');
        var lopnr = 0;
        Array.prototype.forEach.call(listor, function (select) {
          if (!select.options.length) return;
          lopnr += 1;
          var skal = document.createElement('div');
          skal.className = 'valj';
          select.parentNode.insertBefore(skal, select);
          skal.appendChild(select);

          var knapp = document.createElement('button');
          knapp.type = 'button';
          knapp.className = 'valj__knapp';
          knapp.setAttribute('aria-haspopup', 'listbox');
          knapp.setAttribute('aria-expanded', 'false');
          var etikett = select.id
            ? document.querySelector('label[for="' + select.id + '"]')
            : null;
          if (etikett) {
            if (!etikett.id) etikett.id = 'valj-etikett-' + lopnr;
            knapp.setAttribute('aria-labelledby', etikett.id + ' valj-text-' + lopnr);
          }

          var text = document.createElement('span');
          text.className = 'valj__text';
          text.id = 'valj-text-' + lopnr;
          var pil = document.createElement('span');
          pil.className = 'valj__pil';
          knapp.appendChild(text);
          knapp.appendChild(pil);

          var lista = document.createElement('ul');
          lista.className = 'valj__lista';
          lista.id = 'valj-lista-' + lopnr;
          lista.setAttribute('role', 'listbox');
          lista.hidden = true;
          knapp.setAttribute('aria-controls', lista.id);

          var val = [];
          Array.prototype.forEach.call(select.options, function (o, i) {
            var li = document.createElement('li');
            li.className = 'valj__val';
            li.id = 'valj-' + lopnr + '-' + i;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', String(i === select.selectedIndex));
            li.textContent = o.textContent;
            lista.appendChild(li);
            val.push(li);
          });

          skal.appendChild(knapp);
          skal.appendChild(lista);

          var markerad = select.selectedIndex < 0 ? 0 : select.selectedIndex;

          function visaValt() {
            var o = select.options[select.selectedIndex];
            text.textContent = o ? o.textContent : '';
            text.classList.toggle('valj__text--tom', !select.value);
          }

          function markera(i) {
            if (i < 0) i = 0;
            if (i > val.length - 1) i = val.length - 1;
            markerad = i;
            val.forEach(function (li, n) {
              li.classList.toggle('valj__val--markerad', n === i);
            });
            knapp.setAttribute('aria-activedescendant', val[i].id);
            if (!lista.hidden && val[i].scrollIntoView) {
              val[i].scrollIntoView({ block: 'nearest' });
            }
          }

          function oppna() {
            lista.hidden = false;
            knapp.setAttribute('aria-expanded', 'true');
            markera(select.selectedIndex < 0 ? 0 : select.selectedIndex);
          }

          function stang(aterfokus) {
            lista.hidden = true;
            knapp.setAttribute('aria-expanded', 'false');
            knapp.removeAttribute('aria-activedescendant');
            if (aterfokus) knapp.focus();
          }

          function valj(i) {
            select.selectedIndex = i;
            val.forEach(function (li, n) {
              li.setAttribute('aria-selected', String(n === i));
            });
            visaValt();
            var h = document.createEvent('HTMLEvents');
            h.initEvent('change', true, false);
            select.dispatchEvent(h);
          }

          knapp.addEventListener('click', function () {
            if (lista.hidden) oppna(); else stang(false);
          });

          knapp.addEventListener('keydown', function (e) {
            var k = e.key;
            if (lista.hidden) {
              if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
                e.preventDefault();
                oppna();
              }
              return;
            }
            if (k === 'ArrowDown') { e.preventDefault(); markera(markerad + 1); }
            else if (k === 'ArrowUp') { e.preventDefault(); markera(markerad - 1); }
            else if (k === 'Home') { e.preventDefault(); markera(0); }
            else if (k === 'End') { e.preventDefault(); markera(val.length - 1); }
            else if (k === 'Enter' || k === ' ') {
              e.preventDefault();
              valj(markerad);
              stang(true);
            } else if (k === 'Escape') { e.preventDefault(); stang(true); }
            else if (k === 'Tab') { stang(false); }
          });

          lista.addEventListener('mousedown', function (e) { e.preventDefault(); });

          lista.addEventListener('click', function (e) {
            var i = val.indexOf(e.target);
            if (i < 0) return;
            valj(i);
            stang(true);
          });

          lista.addEventListener('mousemove', function (e) {
            var i = val.indexOf(e.target);
            if (i > -1 && i !== markerad) markera(i);
          });

          document.addEventListener('click', function (e) {
            if (!lista.hidden && !skal.contains(e.target)) stang(false);
          });

          visaValt();
        });
      })();

''' + extra + '''    </script>
  </body>
</html>
'''
