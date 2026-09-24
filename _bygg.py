# Genererar undersidorna ur en gemensam mall, sa header, meny och sidfot
# ar identiska pa alla sidor. Kors om nar mallen andras.
import re, io, os

BAS = "https://dakotakrk.github.io/idealhus/"
CSS_V = "20260924i"

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
    "Attefallshus": ("hus-r2.webp",
                     "Utan bygglov, 30–50 m²"),
    "Fritidshus": ("hus-r3.webp",
                   "För helger och långa somrar"),
    "Proffs": ("generated-craft-cladding-01.webp",
               "Väggar, block och moduler"),
}

MENY = [
    ("Hem", "index.html"),
    ("__DROPDOWN__", None),
    ("Priser", "priser.html"),
    ("Så fungerar det", "sa-fungerar-det.html"),
    ("Om oss", "om-oss.html"),
    ("Kontakt", "kontakt.html"),
]


def kategorirad(namn, fil):
    bild, text = KATEGORI_INFO[namn]
    return (f'              <a href="{fil}">\n'
            f'                <img src="images/{bild}" alt="" loading="lazy" decoding="async">\n'
            f'                <span>\n'
            f'                  <strong>{namn}</strong>\n'
            f'                  <em>{text}</em>\n'
            f'                </span>\n'
            f'              </a>')


# Ett verktyg att prova, sist i husmenyn - som "Prova"-kortet i
# Kasters meny. Den som undrar vilket hus som passar undrar oftast
# forst hur stort hus som far sta pa tomten.
TIPSKORT = (
    '              <a class="main-nav__tips" href="vad-far-jag-bygga.html">\n'
    '                <span class="main-nav__tips-etikett">Prova</span>\n'
    '                <strong>Vad får jag bygga?</strong>\n'
    '                <em>Räkna ut vad som ryms på din tomt</em>\n'
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


def huvudmeny(aktiv):
    rader = []
    for namn, fil in MENY:
        if namn == "__DROPDOWN__":
            rader.append(dropdown(aktiv))
            continue
        k = "main-nav__link main-nav__link--active" if namn == aktiv else "main-nav__link"
        rader.append(f'          <a class="{k}" href="{fil}">{namn}</a>')
    return "\n".join(rader)


def mobilmeny():
    val = "\n".join(
        [f'          <a href="{fil}">{namn}</a>' for namn, fil in KATEGORIER_PRIVAT]
        + [f'          <span class="mobile-nav__under">{PROFFS_ETIKETT}</span>']
        + [f'          <a href="{fil}">{namn}</a>' for namn, fil in KATEGORIER_PROFFS])
    rader = []
    for namn, fil in MENY:
        if namn == "__DROPDOWN__":
            rader.append('        <div class="mobile-nav__grupp">\n'
                         '          <span>Våra hus</span>\n' + val + '\n        </div>')
            continue
        rader.append(f'        <a href="{fil}">{namn}</a>')
    return "\n".join(rader)


def head(titel, beskrivning, forladdad=None, fil=None):
    pre = f'\n    <link rel="preload" as="image" href="images/{forladdad}" fetchpriority="high">' if forladdad else ""
    return f'''<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{titel}</title>
    <meta name="description" content="{beskrivning}">
    <meta name="theme-color" content="#2c2820">
    <link rel="icon" href="images/idealhus.svg" type="image/svg+xml">
    <link rel="icon" href="favicon.ico" sizes="32x32">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <link rel="canonical" href="{BAS}{fil or ''}">

    <meta property="og:type" content="website">
    <meta property="og:locale" content="sv_SE">
    <meta property="og:site_name" content="Idealhus">
    <meta property="og:title" content="{titel}">
    <meta property="og:description" content="{beskrivning}">
    <meta property="og:image" content="{BAS}images/{forladdad or 'hus-r2.webp'}">
    <meta property="og:url" content="{BAS}{fil or ''}">
    <meta name="twitter:card" content="summary_large_image">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..600;1,400..600&amp;family=Source+Sans+3:ital,wght@0,300..700;1,400&amp;display=swap">{pre}
    <link rel="stylesheet" href="styles.css?v={CSS_V}">
    <script src="premium.js?v={CSS_V}" defer></script>
    <script>try{{var t=new URLSearchParams(location.search).get('tema')||localStorage.getItem('idealhus-tema');if(t==='mork')document.documentElement.setAttribute('data-tema','mork')}}catch(e){{}}</script>
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "{BAS}#organisation",
      "name": "Idealhus",
      "legalName": "Idealhus AB",
      "url": "{BAS}",
      "logo": "{BAS}images/idealhus_logo.svg",
      "image": "{BAS}images/hus-r2.webp",
      "email": "info@idealhus.se",
      "description": "Idealhus formger och bygger attefallshus och fritidshus med skandinavisk design och svensk tillverkning.",
      "areaServed": "SE"
    }}
    </script>
  </head>
  <body>'''


def header(aktiv):
    return f'''    <a class="skip" href="#innehall">Hoppa till innehållet</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="logo" href="index.html" aria-label="Till Idealhus startsida">
          <img class="logo__svg" src="images/idealhus_logo.svg" width="1024" height="279" alt="Idealhus">
        </a>

        <nav class="main-nav" aria-label="Huvudmeny">
{huvudmeny(aktiv)}
        </nav>

        <div class="site-header__actions">
          <a class="header-button" href="kontakt.html">Begär offert</a>

          <button class="menu-button" type="button" aria-label="Öppna meny" aria-expanded="false" aria-controls="mobile-nav">
            <span class="menu-button__line"></span>
            <span class="menu-button__line"></span>
            <span class="menu-button__line"></span>
          </button>
        </div>
      </div>

      <nav class="mobile-nav" id="mobile-nav" aria-label="Meny" hidden>
{mobilmeny()}
        <a class="mobile-nav__tips" href="vad-far-jag-bygga.html"><span>Prova</span> Vad får jag bygga?</a>
        <a class="mobile-nav__cta" href="kontakt.html">Begär offert</a>
      </nav>
    </header>
'''


SIDFOT = '''    <footer class="site-footer">
      <div class="site-footer__inner">
        <div>
          <img class="site-footer__logo" src="images/idealhus_logo.svg" width="1024" height="279" loading="lazy" decoding="async" alt="Idealhus">
          <p class="site-footer__text">
            Attefallshus &amp; komplementhus med skandinavisk design och hög kvalitet.
          </p>
        </div>

        <div>
          <h2 class="site-footer__heading">Navigation</h2>
          <nav class="site-footer__nav" aria-label="Sidfot navigation">
            <a href="index.html">Hem</a>
            <a href="attefallshus.html">Våra hus</a>
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
          <nav class="site-footer__nav" aria-label="Sidfot husmodeller">
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
          <a class="site-footer__button" href="kontakt.html">Boka rådgivning</a>
        </div>
      </div>

      <div class="site-footer__bottom">
        <span>© 2026 Idealhus AB. Alla rättigheter förbehållna.</span>
        <a class="site-footer__policy" href="integritetspolicy.html">Integritetspolicy</a>
      </div>
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
