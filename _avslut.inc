      <section class="contact-section" id="kontakt">
        <div class="contact-section__inner">
          <div class="contact-section__intro">
            <p class="section-label section-label--accent">Första steget</p>
            <h2 class="contact-section__title">Låt oss börja med <em>din plats</em>.</h2>
            <p class="contact-section__text">
              Berätta vad du funderar på, så återkommer vi med nästa tydliga
              steg. Utan krav och utan säljsnack.
            </p>

            <ol class="kontakt-tips">
              <li>
                <strong>Du berättar</strong>
                <span>Svara på det du vet. Modell och budget behöver inte vara bestämda.</span>
              </li>
              <li>
                <strong>Vi läser själva</strong>
                <span>Vi som bygger husen läser förfrågan. Ingen växel emellan.</span>
              </li>
              <li>
                <strong>Du vet var du står</strong>
                <span>Vad som gäller för din tomt och vilka modeller som passar den.</span>
              </li>
            </ol>

            <div class="kontaktkort">
              <span class="ih-kant" aria-hidden="true"></span>
              <p class="kontaktkort__rubrik">Hör av dig direkt</p>
              <div class="contact-section__meta">
                <div>
                  <span class="contact-section__meta-label">E-post</span>
                  <a class="contact-section__meta-value" href="mailto:info@legohusstockholm.se">info@legohusstockholm.se</a>
                </div>
                <div>
                  <span class="contact-section__meta-label">Plats</span>
                  <span class="contact-section__meta-value contact-section__meta-value--tyst">Stockholm, Sverige</span>
                </div>
              </div>
              <ul class="tillit" aria-label="Det du kan räkna med">
                <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5"/></svg>Byggt under tak i Sverige</li>
                <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/></svg>En kontakt hela vägen</li>
                <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.5h9l3.5 3.5v13.5H6zM9 11h6M9 14.5h6M9 18h3.5"/></svg>Offert post för post</li>
                <li><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20h18M6 20V10l6-5 6 5v10M10 20v-5h4v5"/></svg>Anpassat efter din tomt</li>
              </ul>
            </div>
          </div>

          <form class="contact-form" id="kontaktformular" method="post" novalidate>
            <div class="contact-form__topp">
              <p class="contact-form__rubrik">Din förfrågan</p>
              <p class="contact-form__steg" data-raknare hidden>Steg <span>1</span> av 2</p>
              <ol class="contact-form__faser" aria-hidden="true">
                <li><i></i>Om huset</li>
                <li><i></i>Om dig</li>
              </ol>
            </div>

            <div class="contact-form__del" data-del="1">
              <fieldset class="valgrupp valgrupp--bild">
                <legend>Var ska huset stå?</legend>
                <div class="valgrupp__rad bildval__rad">
                <label class="bildval"><input type="radio" name="miljo" value="Vid havet"><span><img src="images/stamning/gront-hus-havet-600.webp" srcset="images/stamning/gront-hus-havet-600.webp 600w, images/stamning/gront-hus-havet.webp 1200w" sizes="(max-width: 700px) 45vw, 280px" width="1200" height="800" alt="" loading="lazy" decoding="async"><em>Vid havet</em></span></label>
                <label class="bildval"><input type="radio" name="miljo" value="I skogen"><span><img src="images/stamning/gront-hus-skog-600.webp" srcset="images/stamning/gront-hus-skog-600.webp 600w, images/stamning/gront-hus-skog.webp 1200w" sizes="(max-width: 700px) 45vw, 280px" width="1200" height="800" alt="" loading="lazy" decoding="async"><em>I skogen</em></span></label>
                <label class="bildval"><input type="radio" name="miljo" value="På fjället"><span><img src="images/stamning/svart-hus-fjallet-600.webp" srcset="images/stamning/svart-hus-fjallet-600.webp 600w, images/stamning/svart-hus-fjallet.webp 1200w" sizes="(max-width: 700px) 45vw, 280px" width="1200" height="800" alt="" loading="lazy" decoding="async"><em>På fjället</em></span></label>
                <label class="bildval"><input type="radio" name="miljo" value="I trädgården"><span><img src="images/stamning/svart-hus-tradgard-600.webp" srcset="images/stamning/svart-hus-tradgard-600.webp 600w, images/stamning/svart-hus-tradgard.webp 1200w" sizes="(max-width: 700px) 45vw, 280px" width="1200" height="800" alt="" loading="lazy" decoding="async"><em>I trädgården</em></span></label>
                </div>
              </fieldset>

              <fieldset class="valgrupp">
                <legend>Vad funderar du på?</legend>
                <div class="valgrupp__rad">
                <label class="val"><input type="radio" name="hustyp" value="Attefallshus"><span>Attefallshus</span></label>
                <label class="val"><input type="radio" name="hustyp" value="Fritidshus"><span>Fritidshus</span></label>
                <label class="val"><input type="radio" name="hustyp" value="Vet inte än"><span>Vet inte än</span></label>
                </div>
              </fieldset>

              <fieldset class="valgrupp">
                <legend>Vad ska huset användas till?</legend>
                <div class="valgrupp__rad valgrupp__rad--piller">
                <label class="val"><input type="radio" name="anvandning" value="Bo året runt"><span>Bo året runt</span></label>
                <label class="val"><input type="radio" name="anvandning" value="Gästhus"><span>Gästhus</span></label>
                <label class="val"><input type="radio" name="anvandning" value="Uthyrning"><span>Uthyrning</span></label>
                <label class="val"><input type="radio" name="anvandning" value="Kontor"><span>Kontor</span></label>
                <label class="val"><input type="radio" name="anvandning" value="Annat"><span>Annat</span></label>
                </div>
              </fieldset>

              <fieldset class="valgrupp valgrupp--falt">
                <legend>I vilken kommun?</legend>
                <p class="field">
                  <label class="field__dold" for="field-city">Kommun eller ort</label>
                  <input id="field-city" type="text" name="city" autocomplete="address-level2" placeholder="Kommun eller ort">
                </p>
              </fieldset>

              <div class="contact-form__vidare">
                <button class="contact-form__nasta" type="button" data-nasta>Nästa</button>
                <p class="contact-form__hjalp">
                  Inget här är obligatoriskt – vet du inte än, hoppa vidare.
                </p>
              </div>
            </div>

            <div class="contact-form__del" data-del="2">
              <div class="contact-form__row">
                <p class="field">
                  <label for="field-name">Namn</label>
                  <input id="field-name" type="text" name="name" autocomplete="name" required placeholder="Vad heter du?">
                </p>
                <p class="field">
                  <label for="field-email">E-postadress</label>
                  <input id="field-email" type="email" name="email" autocomplete="email" required placeholder="namn@exempel.se">
                </p>
              </div>

              <p class="field">
                <label for="field-phone">Telefonnummer <em>(frivilligt)</em></label>
                <input id="field-phone" type="tel" name="phone" autocomplete="tel" placeholder="070-000 00 00">
              </p>

              <p class="field">
                <label for="field-message">Något mer vi bör veta? <em>(frivilligt)</em></label>
                <textarea id="field-message" name="message" placeholder="Sluttande tomt, trång infart, ungefär när det ska stå klart..."></textarea>
              </p>

              <!-- Lockbete for spambottar: doljs for besokare, ska alltid vara tom. -->
              <input class="contact-form__honey" type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">

              <label class="contact-form__check">
                <input type="checkbox" name="consent" required>
                <span>Jag godkänner att Legohus Stockholm kontaktar mig om min förfrågan. Läs mer i vår <a href="integritetspolicy.html">integritetspolicy</a>.</span>
              </label>

              <div class="contact-form__bottom">
                <button class="contact-form__bak" type="button" data-tillbaka><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6 8.5 12l6 6"/></svg>Tillbaka</button>
                <button type="submit">Skicka förfrågan</button>
              </div>
            </div>

            <p class="contact-form__status" role="status" aria-live="polite" hidden></p>
          </form>
        </div>
      </section>
