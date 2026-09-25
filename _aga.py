# -*- coding: utf-8 -*-
# Bygger aga-och-hyra-ut.html. Kor: python _aga.py
#
# Tva verktyg for den som ska samaga eller hyra ut sin stuga:
#  - Samagarkalendern fordelar arets veckor rattvist mellan delagarna,
#    med storhelgerna i rotation ar for ar, och kan laddas ner till
#    telefonens kalender (.ics).
#  - Uthyrningskalkylen raknar pa vad uthyrningen tacker av arskostnaden,
#    med Skatteverkets schablon for uthyrning av privatbostad (40 000 kr
#    + 20 % av hyran per fastighet och ar, overskottet beskattas med 30 %;
#    kontrollerat 2026-09-23). Siffrorna fyller besokaren i sjalv - vi har
#    ingen marknadsdata for hyror.
import io

import _bygg as B

SKATT_KALLA = ("https://www.skatteverket.se/privat/fastigheterochbostad/inkomsterfranbostad/"
               "hyrautprivatbostadbostadsrattsmahusochhyresratt.4.233f91f71260075abe8800033479.html")


def reglage(id_, etikett, mn, mx, steg, varde, enhet, hjalp=""):
    h = f'<span class="kalkyl__hjalp">{hjalp}</span>' if hjalp else ""
    return f'''              <div class="kalkyl__falt">
                <label for="{id_}">{etikett}{h}</label>
                <div class="kalkyl__rad">
                  <input type="range" id="{id_}" min="{mn}" max="{mx}" step="{steg}" value="{varde}" data-enhet="{enhet}">
                  <output for="{id_}" data-ut="{id_}"></output>
                </div>
              </div>'''


KALKYL_FALT = "\n".join([
    reglage("k-kostnad", "Vad huset kostar totalt", 300000, 4000000, 50000, 1200000, "kr",
            "hus, grund, anslutningar och markarbete"),
    reglage("k-insats", "Kontantinsats", 15, 100, 5, 15, "%"),
    reglage("k-ranta", "Ränta på lånet", 0, 10, 0.1, 4, "%"),
    reglage("k-drift", "Drift per år", 5000, 80000, 1000, 24000, "kr",
            "el, försäkring, sophämtning, underhåll"),
    reglage("k-hyra", "Hyra per vecka", 1000, 25000, 500, 6500, "kr"),
    reglage("k-veckor", "Uthyrda veckor per år", 0, 40, 1, 10, "v"),
    reglage("k-avgift", "Avgifter på hyran", 0, 40, 1, 20, "%",
            "förmedling och städning"),
])

KROPP = f'''    <main id="innehall">
      <section class="subpage-hero">
        <img class="subpage-hero__image" src="images/hus-r3.webp" width="1600" height="1062" fetchpriority="high" decoding="async" alt="Svart fritidshus med takkupa i en tallskog">

        <div class="subpage-hero__content-wrap">
          <div class="subpage-hero__content">
            <h1 class="subpage-hero__title">Äga och hyra ut</h1>
            <p class="subpage-hero__meta">Samäga stugan · räkna på uthyrningen</p>
          </div>
        </div>
      </section>

      <section class="againtro">
        <div class="againtro__inner">
          <p class="section-label section-label--accent">Verktyg</p>
          <h2 class="againtro__titel">Stugan blir lättare att äga <em>tillsammans</em>.</h2>
          <p class="againtro__text">
            Många köper fritidshuset tillsammans med syskon
            eller vänner, eller hyr ut de veckor de inte själva är där. Här är
            två verktyg för just det: en kalender som fördelar veckorna
            rättvist, och en kalkyl som visar vad uthyrningen täcker.
          </p>
          <nav class="againtro__hopp" aria-label="Verktygen på sidan">
            <a href="#samagare">Samägarkalendern</a>
            <a href="#kalkyl">Uthyrningskalkylen</a>
          </nav>
        </div>
      </section>

      <section class="samagare glod" id="samagare">
        <div class="samagare__inner">
          <div class="samagare__topp">
            <p class="section-label section-label--accent">Samägarkalendern</p>
            <h2 class="samagare__titel">Rättvis fördelning av <em>årets veckor</em>.</h2>
            <p class="samagare__text">
              Välj hur många ni är och skriv era namn. Storhelgerna fördelas
              först och byter ägare ett steg varje år, sedan sommarveckorna
              och sist resten, så att alla får lika många.
            </p>
          </div>

          <div class="samagare__kontroller">
            <div class="samagare__grupp">
              <p class="processverktyg__etikett">Antal delägare</p>
              <div class="hustypval" role="group" aria-label="Antal delägare" data-antal>
                <button type="button" data-n="2" aria-pressed="false">2</button>
                <button type="button" data-n="3" aria-pressed="true">3</button>
                <button type="button" data-n="4" aria-pressed="false">4</button>
                <button type="button" data-n="5" aria-pressed="false">5</button>
                <button type="button" data-n="6" aria-pressed="false">6</button>
              </div>
            </div>
            <div class="samagare__grupp">
              <p class="processverktyg__etikett">År</p>
              <div class="hustypval" role="group" aria-label="År" data-ar>
                <button type="button" data-ar="2027" aria-pressed="true">2027</button>
                <button type="button" data-ar="2028" aria-pressed="false">2028</button>
                <button type="button" data-ar="2029" aria-pressed="false">2029</button>
              </div>
            </div>
            <div class="samagare__grupp">
              <p class="processverktyg__etikett">Sportlovsvecka</p>
              <div class="hustypval" role="group" aria-label="Sportlovsvecka" data-sportlov>
                <button type="button" data-v="7" aria-pressed="false">v 7</button>
                <button type="button" data-v="8" aria-pressed="false">v 8</button>
                <button type="button" data-v="9" aria-pressed="true">v 9</button>
                <button type="button" data-v="10" aria-pressed="false">v 10</button>
              </div>
            </div>
          </div>

          <div class="samagare__namn" data-namnfalt></div>

          <div class="samagare__resultat">
            <ul class="samagare__legend" data-legend aria-label="Delägare och deras veckor"></ul>
            <div class="samagare__rutnat" data-rutnat role="grid" aria-label="Årets veckor och vem som har dem"></div>
            <p class="samagare__detalj" data-detalj aria-live="polite">Peka på en vecka för att se datum och vem som har den.</p>
          </div>

          <div class="samagare__knappar">
            <button class="knapp-fylld" type="button" data-ics>Ladda ner till kalendern</button>
            <button class="kollen__dela" type="button" data-dela-kalender>Kopiera länk till schemat</button>
          </div>
          <p class="samagare__not">
            Kalenderfilen (.ics) fungerar i telefonens kalender, Google och
            Outlook. Den skapas här i webbläsaren - inget skickas till oss.
          </p>
        </div>
      </section>

      <section class="kalkyl" id="kalkyl">
        <div class="kalkyl__inner">
          <div class="kalkyl__topp">
            <p class="section-label section-label--accent">Uthyrningskalkylen</p>
            <h2 class="kalkyl__titel">Hur mycket betalar <em>hyresgästerna</em>?</h2>
            <p class="kalkyl__text">
              Dra i reglagen med dina egna siffror. Kalkylen visar vad
              uthyrningen täcker av årskostnaden efter avgifter och skatt.
            </p>
          </div>

          <div class="kalkyl__uppslag">
            <div class="kalkyl__reglage">
{KALKYL_FALT}
            </div>

            <div class="kalkyl__svar" aria-live="polite">
              <div class="kalkyl__siffror">
                <div class="kalkyl__siffra">
                  <span>Uthyrningen täcker</span>
                  <strong data-k-tacker>–</strong>
                  <small>av årskostnaden</small>
                </div>
                <div class="kalkyl__siffra">
                  <span data-k-kvar-etikett>Kvar att betala</span>
                  <strong data-k-kvar>–</strong>
                  <small>per månad</small>
                </div>
                <div class="kalkyl__siffra">
                  <span>För att gå jämnt</span>
                  <strong data-k-jamnt>–</strong>
                  <small>uthyrda veckor per år</small>
                </div>
              </div>

              <figure class="kalkyl__graf">
                <figcaption>Per år</figcaption>
                <div class="stapel" data-stapel-kostnad>
                  <span class="stapel__etikett">Årskostnad</span>
                  <div class="stapel__spar">
                    <span class="stapel__del stapel__del--ranta" data-del-ranta></span>
                    <span class="stapel__del stapel__del--drift" data-del-drift></span>
                  </div>
                  <span class="stapel__varde" data-v-kostnad></span>
                </div>
                <div class="stapel" data-stapel-hyra>
                  <span class="stapel__etikett">Hyra kvar</span>
                  <div class="stapel__spar">
                    <span class="stapel__del stapel__del--hyra" data-del-hyra></span>
                  </div>
                  <span class="stapel__varde" data-v-hyra></span>
                </div>
                <p class="stapel__forklaring">
                  <span><i class="stapel__prov stapel__prov--ranta"></i>Ränta</span>
                  <span><i class="stapel__prov stapel__prov--drift"></i>Drift</span>
                  <span><i class="stapel__prov stapel__prov--hyra"></i>Hyra efter avgifter och skatt</span>
                </p>
                <div class="stapel__tips" data-stapel-tips hidden></div>
              </figure>

              <table class="kalkyl__tabell">
                <caption>Uträkningen per år</caption>
                <tbody data-k-tabell></tbody>
              </table>
            </div>
          </div>

          <p class="kalkyl__not">
            En egen räkneövning, inte ett finansiellt råd. Amortering och
            ränteavdrag ingår inte. Skatten är räknad med Skatteverkets schablon
            för uthyrning av privatbostad: 40 000 kr plus 20 procent av hyran är
            skattefritt per fastighet och år, och överskottet beskattas med 30
            procent. Äger ni huset tillsammans delas avdraget mellan er.
            <a href="{SKATT_KALLA}" target="_blank" rel="noopener">Läs mer hos Skatteverket</a>
          </p>
        </div>
      </section>

''' + io.open("_kontaktsektion.inc", encoding="utf-8").read() + '''    </main>

'''

SKRIPT = r'''
      (function () {
        var sek = document.getElementById('samagare');
        if (!sek) return;
        var $ = function (s, r) { return (r || document).querySelector(s); };
        var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
        var MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        var adress = new URLSearchParams(location.search);
        var n = Math.min(6, Math.max(2, parseInt(adress.get('n'), 10) || 3));
        var ar = parseInt(adress.get('ar'), 10) || 2027;
        var sportlov = parseInt(adress.get('sportlov'), 10) || 9;
        var namn = (adress.get('namn') || '').split('|').filter(Boolean).slice(0, 6);

        function isoVecka(d) {
          var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          var dag = t.getUTCDay() || 7;
          t.setUTCDate(t.getUTCDate() + 4 - dag);
          var start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
          return { ar: t.getUTCFullYear(), v: Math.ceil(((t - start) / 864e5 + 1) / 7) };
        }
        function mandag(ar, v) {
          var jan4 = new Date(Date.UTC(ar, 0, 4));
          var d = new Date(jan4);
          d.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (v - 1) * 7);
          return d;
        }
        function antalVeckor(ar) { return isoVecka(new Date(ar, 11, 28)).v; }
        function pask(ar) {
          var a = ar % 19, b = Math.floor(ar / 100), c = ar % 100, d = Math.floor(b / 4), e = b % 4,
            f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
            i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
            man = Math.floor((h + l - 7 * m + 114) / 31), dag = ((h + l - 7 * m + 114) % 31) + 1;
          return new Date(ar, man - 1, dag);
        }
        function midsommarafton(ar) {
          for (var d = 19; d <= 25; d++) { var x = new Date(ar, 5, d); if (x.getDay() === 5) return x; }
        }
        function storhelger(ar) {
          var lista = [
            ['Sportlov', sportlov],
            ['Påsk', isoVecka(pask(ar)).v],
            ['Midsommar', isoVecka(midsommarafton(ar)).v],
            ['Jul', isoVecka(new Date(ar, 11, 24)).v]
          ];
          // Nyårsveckan är veckan med nyårsafton. Hamnar den i nästa års
          // vecka 1 räknas i stället årets vecka 1 (förra årets nyår).
          var ny = isoVecka(new Date(ar, 11, 31));
          if (ny.ar === ar) {
            if (ny.v !== lista[3][1]) lista.push(['Nyår', ny.v]);
          } else {
            var ny1 = isoVecka(new Date(ar, 0, 1));
            lista.unshift(['Nyår', ny1.ar === ar ? ny1.v : 1]);
          }
          return lista;
        }

        function fordela() {
          var N = antalVeckor(ar);
          var agare = new Array(N + 1);
          var helg = {};
          var rakna = [], sommar = [], helger = [];
          for (var i = 0; i < n; i++) { rakna.push(0); sommar.push(0); helger.push(0); }
          storhelger(ar).forEach(function (h, i) {
            var o = (i + ar) % n;
            agare[h[1]] = o; helg[h[1]] = h[0];
            rakna[o]++; helger[o]++;
          });
          function minst(fran, kriterier) {
            var bast = -1;
            for (var j = 0; j < n; j++) {
              var o = (fran + j) % n;
              if (bast < 0) { bast = o; continue; }
              for (var k = 0; k < kriterier.length; k++) {
                var a = kriterier[k][o], b = kriterier[k][bast];
                if (a < b) { bast = o; break; }
                if (a > b) break;
              }
            }
            return bast;
          }
          var tur = ar % n;
          for (var v = 26; v <= 32; v++) {
            if (agare[v] !== undefined) continue;
            var o = minst(tur, [sommar, rakna]);
            agare[v] = o; sommar[o]++; rakna[o]++; tur = (o + 1) % n;
          }
          for (v = 1; v <= N; v++) {
            if (agare[v] !== undefined) continue;
            o = minst(tur, [rakna]);
            agare[v] = o; rakna[o]++; tur = (o + 1) % n;
          }
          return { N: N, agare: agare, helg: helg, rakna: rakna, sommar: sommar, helger: helger };
        }

        var namnfalt = $('[data-namnfalt]', sek);
        function namnAv(i) {
          var f = $('input[data-i="' + i + '"]', namnfalt);
          var t = f && f.value.trim();
          return t || 'Delägare ' + (i + 1);
        }
        // Bokstaven i veckan: namnets första bokstav, eller numret om
        // namnet saknas. Delar två delägare bokstav får de numret efter.
        function initialAv(i) {
          var f = $('input[data-i="' + i + '"]', namnfalt);
          var t = f && f.value.trim();
          if (!t) return String(i + 1);
          var b = t.charAt(0).toUpperCase();
          var samma = $$('input', namnfalt).filter(function (x) {
            return x.value.trim().charAt(0).toUpperCase() === b;
          }).length;
          return samma > 1 ? b + (i + 1) : b;
        }
        function byggNamnfalt() {
          var gamla = $$('input', namnfalt).map(function (f) { return f.value; });
          namnfalt.innerHTML = '';
          for (var i = 0; i < n; i++) {
            var l = document.createElement('label');
            l.className = 'samagare__namnrad';
            l.style.setProperty('--farg', 'var(--del' + (i + 1) + ')');
            l.innerHTML = '<span class="samagare__prick" aria-hidden="true"></span><span class="field__dold">Namn på delägare ' + (i + 1) + '</span>';
            var inp = document.createElement('input');
            inp.type = 'text';
            inp.maxLength = 24;
            inp.placeholder = 'Delägare ' + (i + 1);
            inp.setAttribute('data-i', i);
            inp.value = gamla[i] || namn[i] || '';
            inp.addEventListener('input', rita);
            l.appendChild(inp);
            namnfalt.appendChild(l);
          }
        }

        var senast = null;
        function datum(d) { return d.getUTCDate() + ' ' + MANAD[d.getUTCMonth()]; }
        function rita() {
          var r = fordela();
          senast = r;
          var legend = $('[data-legend]', sek);
          legend.innerHTML = '';
          for (var i = 0; i < n; i++) {
            var li = document.createElement('li');
            li.style.setProperty('--farg', 'var(--del' + (i + 1) + ')');
            li.innerHTML = '<span class="samagare__prick" aria-hidden="true"></span><strong></strong>' +
              '<span>' + r.rakna[i] + ' veckor · ' + r.sommar[i] + ' sommar · ' + r.helger[i] + ' storhelger</span>';
            li.querySelector('strong').textContent = namnAv(i);
            legend.appendChild(li);
          }
          var nat = $('[data-rutnat]', sek);
          nat.innerHTML = '';
          for (var v = 1; v <= r.N; v++) {
            var o = r.agare[v];
            var m = mandag(ar, v), s = new Date(m); s.setUTCDate(m.getUTCDate() + 6);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'vecka' + (r.helg[v] ? ' vecka--helg' : '') + (v >= 26 && v <= 32 ? ' vecka--sommar' : '');
            b.style.setProperty('--farg', 'var(--del' + (o + 1) + ')');
            b.style.setProperty('--i', v);
            var nm = namnAv(o);
            var info = 'Vecka ' + v + ' · ' + datum(m) + ' – ' + datum(s) + ' · ' + nm + (r.helg[v] ? ' · ' + r.helg[v] : '');
            b.setAttribute('aria-label', info);
            b.setAttribute('data-info', info);
            b.innerHTML = '<span class="vecka__nr">' + v + '</span><span class="vecka__ini" aria-hidden="true"></span>' +
              (r.helg[v] ? '<span class="vecka__helg" aria-hidden="true">★</span>' : '');
            b.querySelector('.vecka__ini').textContent = initialAv(o);
            nat.appendChild(b);
          }
          var q = new URLSearchParams();
          q.set('n', n); q.set('ar', ar); q.set('sportlov', sportlov);
          var nn = []; for (i = 0; i < n; i++) nn.push(($('input[data-i="' + i + '"]', namnfalt) || {}).value || '');
          if (nn.some(Boolean)) q.set('namn', nn.join('|'));
          history.replaceState(null, '', '?' + q.toString() + location.hash);
        }

        var detalj = $('[data-detalj]', sek);
        $('[data-rutnat]', sek).addEventListener('pointerover', function (e) {
          var b = e.target.closest('.vecka'); if (b) detalj.textContent = b.getAttribute('data-info');
        });
        $('[data-rutnat]', sek).addEventListener('focusin', function (e) {
          var b = e.target.closest('.vecka'); if (b) detalj.textContent = b.getAttribute('data-info');
        });
        $('[data-rutnat]', sek).addEventListener('click', function (e) {
          var b = e.target.closest('.vecka'); if (b) detalj.textContent = b.getAttribute('data-info');
        });

        function valjare(sel, attr, satt, start) {
          var knappar = $$(sel + ' button', sek);
          knappar.forEach(function (b) {
            b.setAttribute('aria-pressed', String(Number(b.getAttribute(attr)) === start));
            b.addEventListener('click', function () {
              knappar.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
              satt(Number(b.getAttribute(attr)));
            });
          });
        }
        valjare('[data-antal]', 'data-n', function (v) { n = v; byggNamnfalt(); rita(); }, n);
        valjare('[data-ar]', 'data-ar', function (v) { ar = v; rita(); }, ar);
        valjare('[data-sportlov]', 'data-v', function (v) { sportlov = v; rita(); }, sportlov);

        $('[data-ics]', sek).addEventListener('click', function () {
          var r = senast; if (!r) return;
          var p = function (x) { return (x < 10 ? '0' : '') + x; };
          var f = function (d) { return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); };
          var rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Idealhus//Samagarkalender//SV', 'CALSCALE:GREGORIAN'];
          for (var v = 1; v <= r.N; v++) {
            var m = mandag(ar, v), s = new Date(m); s.setUTCDate(m.getUTCDate() + 7);
            var titel = 'Stugan: ' + namnAv(r.agare[v]) + (r.helg[v] ? ' (' + r.helg[v] + ')' : '');
            rader.push('BEGIN:VEVENT', 'UID:idealhus-' + ar + '-v' + v + '@idealhus.se',
              'DTSTAMP:' + f(new Date()) + 'T000000Z', 'DTSTART;VALUE=DATE:' + f(m), 'DTEND;VALUE=DATE:' + f(s),
              'SUMMARY:' + titel.replace(/[,;\\]/g, ' '), 'TRANSP:TRANSPARENT', 'END:VEVENT');
          }
          rader.push('END:VCALENDAR');
          var blob = new Blob([rader.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'stugkalender-' + ar + '.ics';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        });

        var dela = $('[data-dela-kalender]', sek);
        if (!navigator.clipboard) dela.hidden = true;
        dela.addEventListener('click', function () {
          navigator.clipboard.writeText(location.href.split('#')[0] + '#samagare').then(function () {
            dela.textContent = 'Länken är kopierad';
            setTimeout(function () { dela.textContent = 'Kopiera länk till schemat'; }, 2000);
          });
        });

        byggNamnfalt();
        rita();
      })();

      (function () {
        var sek = document.getElementById('kalkyl');
        if (!sek) return;
        var $ = function (s, r) { return (r || document).querySelector(s); };
        var kr = function (x) { return Math.round(x).toLocaleString('sv-SE') + ' kr'; };
        var falt = ['kostnad', 'insats', 'ranta', 'drift', 'hyra', 'veckor', 'avgift'];
        var el = {};
        falt.forEach(function (f) { el[f] = document.getElementById('k-' + f); });

        function visaVarde(f) {
          var i = el[f], v = Number(i.value), e = i.getAttribute('data-enhet');
          var txt = e === 'kr' ? kr(v) : e === '%' ? String(v).replace('.', ',') + ' %' : v + ' v';
          $('[data-ut="k-' + f + '"]', sek).textContent = txt;
          i.style.setProperty('--andel', ((v - i.min) / (i.max - i.min) * 100).toFixed(1) + '%');
        }

        function rakna(veckor) {
          var v = {};
          falt.forEach(function (f) { v[f] = Number(el[f].value); });
          if (veckor !== undefined) v.veckor = veckor;
          var lan = v.kostnad * (1 - v.insats / 100);
          var ranta = lan * v.ranta / 100;
          var brutto = v.hyra * v.veckor;
          var avgift = brutto * v.avgift / 100;
          var overskott = Math.max(0, brutto - 40000 - brutto * 0.2);
          var skatt = overskott * 0.3;
          var netto = brutto - avgift - skatt;
          return { lan: lan, ranta: ranta, drift: v.drift, brutto: brutto, avgift: avgift, skatt: skatt,
            netto: netto, kostnad: ranta + v.drift };
        }

        var tips = $('[data-stapel-tips]', sek);
        function rita() {
          falt.forEach(visaVarde);
          var r = rakna();
          var tacker = r.kostnad > 0 ? r.netto / r.kostnad : 0;
          $('[data-k-tacker]', sek).textContent = Math.round(tacker * 100) + ' %';
          var kvar = (r.kostnad - r.netto) / 12;
          $('[data-k-kvar-etikett]', sek).textContent = kvar >= 0 ? 'Kvar att betala' : 'Överskott';
          $('[data-k-kvar]', sek).textContent = kr(Math.abs(kvar));
          var jamnt = '> 52';
          for (var w = 0; w <= 52; w++) { if (rakna(w).netto >= r.kostnad) { jamnt = String(w); break; } }
          $('[data-k-jamnt]', sek).textContent = jamnt;

          var skala = Math.max(r.kostnad, r.netto, 1);
          var satt = function (sel, varde, text) {
            var d = $(sel, sek);
            d.style.width = (varde / skala * 100).toFixed(2) + '%';
            d.setAttribute('data-tips', text);
          };
          satt('[data-del-ranta]', r.ranta, 'Ränta: ' + kr(r.ranta) + ' per år');
          satt('[data-del-drift]', r.drift, 'Drift: ' + kr(r.drift) + ' per år');
          satt('[data-del-hyra]', Math.max(0, r.netto), 'Hyra efter avgifter och skatt: ' + kr(r.netto) + ' per år');
          $('[data-v-kostnad]', sek).textContent = kr(r.kostnad);
          $('[data-v-hyra]', sek).textContent = kr(r.netto);

          var rader = [
            ['Lån', kr(r.lan)],
            ['Ränta', '− ' + kr(r.ranta)],
            ['Drift', '− ' + kr(r.drift)],
            ['Hyra före avgifter', '+ ' + kr(r.brutto)],
            ['Avgifter', '− ' + kr(r.avgift)],
            ['Skatt enligt schablon', '− ' + kr(r.skatt)],
            [(r.netto - r.kostnad) >= 0 ? 'Överskott per år' : 'Kvar att betala per år', kr(Math.abs(r.netto - r.kostnad))]
          ];
          $('[data-k-tabell]', sek).innerHTML = rader.map(function (x, i) {
            return '<tr' + (i === rader.length - 1 ? ' class="kalkyl__summa"' : '') + '><th scope="row">' + x[0] + '</th><td>' + x[1] + '</td></tr>';
          }).join('');
        }
        falt.forEach(function (f) { el[f].addEventListener('input', rita); });

        // Tooltip på staplarna, som en förklaring av varje del.
        sek.addEventListener('pointerover', function (e) {
          var d = e.target.closest('.stapel__del');
          if (!d) { tips.hidden = true; return; }
          tips.textContent = d.getAttribute('data-tips');
          tips.hidden = false;
        });
        sek.addEventListener('pointerleave', function () { tips.hidden = true; });
        rita();
      })();
'''

ut = (B.head("Äga och hyra ut | Idealhus",
             "Samäga stugan och räkna på uthyrningen: en kalender som fördelar "
             "årets veckor rättvist och en kalkyl över vad uthyrningen täcker.",
             "hus-r3.webp", fil="aga-och-hyra-ut.html")
      + "\n" + B.header("") + "\n" + KROPP + B.SIDFOT + "\n" + B.skript(SKRIPT))

io.open("aga-och-hyra-ut.html", "w", encoding="utf-8", newline="").write(ut.replace("\n", "\r\n"))
print("aga-och-hyra-ut.html")
