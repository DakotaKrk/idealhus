      // Kontaktformularet.
      //
      // Medvetet val: ingen extern formulartjanst. Formularet oppnar
      // besokarens e-postprogram med forfragan ifylld, sa ingen
      // persondata passerar en tredje part. Priset ar att besokare utan
      // konfigurerat e-postprogram maste mejla manuellt - darfor visas
      // adressen alltid som en klickbar lank i kvittensen.
      //
      // Om valet nagon gang andras: klistra in en endpoint (Formspree,
      // FormSubmit eller liknande) i FORM_ENDPOINT nedan, sa skickas
      // formularet i bakgrunden i stallet. Ingen annan andring behovs.
      var FORM_ENDPOINT = '';
      var FORM_MOTTAGARE = 'info@legohusstockholm.se';

      (function () {
        var form = document.getElementById('kontaktformular');
        if (!form) return;

        var button = form.querySelector('button[type="submit"]');
        var status = form.querySelector('.contact-form__status');
        var knappText = button.textContent;

        // Tva steg. Utan skript star bada oppna, sa formularet fungerar
        // anda - doljningen gors har, inte i markupen.
        var delar = form.querySelectorAll('.contact-form__del');
        var raknare = form.querySelector('[data-raknare]');
        var knappNasta = form.querySelector('[data-nasta]');
        var knappTillbaka = form.querySelector('[data-tillbaka]');

        function visaSteg(nr) {
          delar[0].hidden = nr !== 1;
          delar[1].hidden = nr !== 2;
          form.setAttribute('data-steg', nr);
          if (raknare) {
            raknare.hidden = false;
            raknare.querySelector('span').textContent = nr;
          }
        }

        // Framstegslinjen i toppen: första delen fylls fråga för fråga,
        // andra delen fält för fält (namn, e-post, samtycke).
        var faser = form.querySelectorAll('.contact-form__faser i');
        function framsteg() {
          if (faser.length !== 2 || delar.length !== 2) return;
          var fragor = delar[0].querySelectorAll('fieldset');
          var svar = 0;
          Array.prototype.forEach.call(fragor, function (f) {
            var text = f.querySelector('input[type="text"]');
            if (text) f.classList.toggle('valgrupp--besvarad', !!text.value.trim());
            if (f.querySelector('input:checked') || (text && text.value.trim())) svar++;
          });
          var e = form.elements;
          var fyllda = [e.name.value.trim(), e.email.value.trim(), e.consent.checked].filter(Boolean).length;
          faser[0].style.setProperty('--klar', fragor.length ? svar / fragor.length : 0);
          faser[1].style.setProperty('--klar', fyllda / 3);
        }
        form.addEventListener('input', framsteg);
        form.addEventListener('change', framsteg);
        framsteg();

        if (delar.length === 2 && knappNasta) {
          visaSteg(1);
          knappNasta.addEventListener('click', function () {
            visaSteg(2);
            form.elements.name.focus();
          });
          if (knappTillbaka) {
            knappTillbaka.addEventListener('click', function () {
              visaSteg(1);
              // Tillbaka till formulärets topp, med fokus på det man valde.
              var lugnt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              form.scrollIntoView({ block: 'start', behavior: lugnt ? 'auto' : 'smooth' });
              var forsta = delar[0].querySelector('input:checked') || delar[0].querySelector('input');
              if (forsta) forsta.focus({ preventScroll: true });
            });
          }
        }

        function visaFel(falt, meddelande) {
          var wrap = falt.closest('.field') || falt.closest('.contact-form__check');
          if (!wrap) return;
          wrap.classList.add('field--error');
          // Skärmläsare ska höra felet på fältet, inte bara se det rött.
          falt.setAttribute('aria-invalid', 'true');
          if (wrap.querySelector('.field__error')) return;
          var p = document.createElement('span');
          p.className = 'field__error';
          p.id = 'fel-' + (falt.name || falt.id);
          p.textContent = meddelande;
          wrap.appendChild(p);
          falt.setAttribute('aria-describedby', p.id);
        }

        function rensaFel(falt) {
          var wrap = falt.closest('.field') || falt.closest('.contact-form__check');
          if (!wrap) return;
          wrap.classList.remove('field--error');
          falt.removeAttribute('aria-invalid');
          falt.removeAttribute('aria-describedby');
          var p = wrap.querySelector('.field__error');
          if (p) p.remove();
        }

        function validera() {
          var fel = [];
          var namn = form.elements.name;
          var epost = form.elements.email;
          var samtycke = form.elements.consent;

          [namn, epost, samtycke].forEach(rensaFel);

          if (!namn.value.trim()) {
            visaFel(namn, 'Fyll i ditt namn.');
            fel.push(namn);
          }
          if (!epost.value.trim()) {
            visaFel(epost, 'Fyll i din e-postadress.');
            fel.push(epost);
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epost.value.trim())) {
            visaFel(epost, 'Kontrollera e-postadressen.');
            fel.push(epost);
          }
          if (!samtycke.checked) {
            visaFel(samtycke, 'Du behöver godkänna att vi kontaktar dig.');
            fel.push(samtycke);
          }
          return fel;
        }

        // medMejllank lagger till en klickbar adress sist i meddelandet,
        // sa besokaren aldrig hamnar i en atervandsgrand.
        function visaStatus(text, typ, medMejllank) {
          status.textContent = text;
          if (medMejllank) {
            var lank = document.createElement('a');
            lank.href = 'mailto:' + FORM_MOTTAGARE;
            lank.textContent = FORM_MOTTAGARE;
            status.appendChild(document.createTextNode(' '));
            status.appendChild(lank);
            status.appendChild(document.createTextNode('.'));
          }
          status.className = 'contact-form__status contact-form__status--' + typ;
          status.hidden = false;
        }

        function byggMailto() {
          var v = function (namn) {
            var f = form.elements[namn];
            return f && f.value ? f.value.trim() : '';
          };
          var rader = [
            'Namn: ' + v('name'),
            'E-post: ' + v('email'),
            'Telefon: ' + (v('phone') || '-'),
            'Ort: ' + (v('city') || '-'),
            'Miljö: ' + (v('miljo') || '-'),
            'Funderar på: ' + (v('hustyp') || '-'),
            'Ska användas till: ' + (v('anvandning') || '-'),
            '',
            v('message') || '(inget meddelande)'
          ];
          return 'mailto:' + FORM_MOTTAGARE +
            '?subject=' + encodeURIComponent('Förfrågan från legohusstockholm.se: ' + v('name')) +
            '&body=' + encodeURIComponent(rader.join('\n'));
        }

        ['name', 'email', 'consent'].forEach(function (namn) {
          var falt = form.elements[namn];
          if (falt) {
            falt.addEventListener('input', function () { rensaFel(falt); });
            falt.addEventListener('change', function () { rensaFel(falt); });
          }
        });

        form.addEventListener('submit', function (event) {
          event.preventDefault();

          var fel = validera();
          if (fel.length) {
            visaStatus('Kontrollera de markerade fälten.', 'fail');
            fel[0].focus();
            return;
          }

          // Boten fyllde i lockbetet - las tyst som skickat.
          if (form.elements._honey && form.elements._honey.value) {
            visaStatus('Tack! Vi hör av oss inom kort.', 'ok');
            return;
          }

          if (!FORM_ENDPOINT) {
            window.location.href = byggMailto();
            visaStatus(
              'Ditt e-postprogram öppnas nu med förfrågan ifylld. Tryck skicka där. ' +
              'Händer ingenting kan du mejla oss direkt på',
              'ok',
              true
            );
            return;
          }

          button.disabled = true;
          button.textContent = 'Skickar …';
          status.hidden = true;

          fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: new FormData(form)
          })
            .then(function (svar) {
              if (!svar.ok) throw new Error('HTTP ' + svar.status);
              form.reset();
              visaStatus('Tack! Din förfrågan är skickad. Vi hör av oss inom kort.', 'ok');
            })
            .catch(function () {
              visaStatus(
                'Något gick fel när förfrågan skulle skickas. Mejla oss gärna direkt på',
                'fail',
                true
              );
            })
            .then(function () {
              button.disabled = false;
              button.textContent = knappText;
            });
        });
      })();
