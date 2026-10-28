/* Legohus CRM – säkerhetshubben (#/sakerhet), samma upplägg som Uperformance CRM:s sakerhet.js (visaSakerhet).
   Sju kontroller körs på riktigt i webbläsaren mot sidans kod och CRM:ets data – skadlig kod, uppdateringar, buggar,
   läckor, intrång, avvikande beteende och sådant som är trasigt. Varje kontroll ger fynd med allvarlighet (hög −25,
   medel −10, låg −3, info 0) och poängen är 100 minus avdragen. Kärnan: en ring per kontroll i kontrollens färg (full =
   inga fynd), under skanningen löper en komet runt ringen som kontrolleras och mitten visar förloppet; den lutar efter
   musen. Skanningens logg skrivs live, poängen sparas över tid. Data: db.sakHub = { senast, historik }. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i, ik = function (n) { return IH.emo(n); };
  var db = function () { return IH.db; };
  var arAdmin = function () { return IH.jag().roll === 'admin'; };
  var lugn = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var vila = function () { return new Promise(function (r) { setTimeout(r, lugn() ? 20 : 180 + Math.random() * 220); }); };
  var plural = function (n, en, flera) { return n + ' ' + (n === 1 ? en : flera); };

  // Fel i sidan sedan den laddades (kontrollen Buggar)
  var felLista = [];
  addEventListener('error', function (ev) { felLista.push((ev.message || 'Fel') + (ev.filename ? ' (' + ev.filename.split('/').pop() + ')' : '')); }, true);
  addEventListener('unhandledrejection', function (ev) { var m = ev.reason && (ev.reason.message || String(ev.reason)); if (!/Transition was skipped/.test(m || '')) felLista.push('Ohanterat löfte: ' + m); });
  // Innehållspolicyn stoppar främmande skript, ramar och anrop utåt – varje stopp loggas som ett intrångsförsök
  document.addEventListener('securitypolicyviolation', function (ev) { felLista.push('Stoppat av innehållspolicyn: ' + ev.violatedDirective + ' ' + (ev.blockedURI || 'inbyggd kod')); if (IH.sakLogg) IH.sakLogg('intrang', 'Innehållspolicyn stoppade ' + (ev.blockedURI || 'inbyggd kod') + ' (' + ev.violatedDirective + ').'); });
  // Försök att öppna adminsidor utan att vara admin loggas (kontrollen Intrång)
  addEventListener('hashchange', function () {
    if (/^#\/(admin|sakerhet|kontroll)/.test(location.hash) && !arAdmin() && !(IH.visarSom && IH.visarSom()) && IH.sakLogg) IH.sakLogg('atkomst', IH.jag().namn + ' försökte öppna ' + location.hash.slice(2) + ' utan behörighet.');
  });

  var ALLVAR = { hog: { namn: 'Hög', minus: 25 }, medel: { namn: 'Medel', minus: 10 }, lag: { namn: 'Låg', minus: 3 }, info: { namn: 'Info', minus: 0 } };
  var FARG = { kod: '#3f6b50', uppdatering: '#4f6f8f', buggar: '#7b5c8f', lacka: '#c4577e', intrang: '#3d8a96', beteende: '#e8a456', trasigt: '#8f5424' };
  var KORT = { kod: 'Skadlig kod', uppdatering: 'Uppdatering', buggar: 'Buggar', lacka: 'Läckor', intrang: 'Intrång', beteende: 'Beteende', trasigt: 'Trasigt' };
  var KANDA = /^(data|app|mote|vyer|ledning|chatt|admin|adminpanel|kontroll|sakerhet|stod|valj|kalender|overgang|grund|filregler|filskanner|resa3d|motesrum3d|three\.module\.min|[A-Za-z]+(Pass|Loader|Geometry|Environment|Composer|Utils|Shader))\.js$/;
  var FARLIGT = [[/<\s*script/i, 'Skripttagg'], [/javascript:/i, 'javascript:-länk'], [/\bon(error|load|click|mouseover)\s*=/i, 'Händelseattribut'], [/<\s*iframe/i, 'Inbäddad ram']];
  // Alla textfält i datan (kunder, affärer, aktiviteter, uppgifter, chatten)
  function strangar() {
    var d = db(), ut = [];
    ['kunder', 'affarer', 'aktiviteter', 'uppgifter', 'forfragningar', 'offerter'].forEach(function (s) { (d[s] || []).forEach(function (x) { Object.keys(x).forEach(function (f) { if (typeof x[f] === 'string' && x[f].length > 3) ut.push({ samling: s, id: x.id, falt: f, text: x[f] }); }); }); });
    ((d.chatt || {}).meddelanden || []).forEach(function (m) { if (m.text) ut.push({ samling: 'chatt', id: m.id, falt: 'text', text: m.text }); });
    return ut;
  }
  var luhn = function (s) { var t = 0; for (var n = 0; n < s.length; n++) { var x = +s[s.length - 1 - n]; if (n % 2) { x *= 2; if (x > 9) x -= 9; } t += x; } return t % 10 === 0; };
  var SAML = { kunder: 'Kund', affarer: 'Affär', aktiviteter: 'Aktivitet', uppgifter: 'Uppgift', forfragningar: 'Förfrågan', offerter: 'Offert', chatt: 'Chatten' };

  var KONTROLLER = [
    { id: 'kod', namn: 'Skadlig kod', under: 'Okända skript, ramar och farlig kod i sidan och i lagrad data', ikon: 'bugg',
      steg: ['Sidans skript och stilmallar', 'Ramar och händelseattribut', 'Lagrad data – farliga mönster', 'Service workers och lagring'],
      kor: async function (logg) {
        var f = [], skript = [].slice.call(document.scripts);
        logg('Kontrollerar ' + skript.length + ' skript och ' + document.querySelectorAll('link[rel=stylesheet]').length + ' stilmallar');
        skript.forEach(function (s) { if (!s.src) return; var u = new URL(s.src, location.href), fil = u.pathname.split('/').pop();
          if (u.origin !== location.origin) f.push({ allvar: 'hog', text: 'Skript från en annan webbplats: ' + u.host + u.pathname }); else if (!KANDA.test(fil)) f.push({ allvar: 'medel', text: 'Okänt skript: ' + u.pathname }); });
        await vila();
        logg('Letar efter ramar, händelseattribut och javascript:-länkar');
        var ramar = document.querySelectorAll('iframe, object, embed').length; if (ramar) f.push({ allvar: 'hog', text: plural(ramar, 'inbäddad ram', 'inbäddade ramar') + ' i sidan (förväntat: inga)' });
        var attr = [].slice.call(document.querySelectorAll('body *')).filter(function (x) { return [].some.call(x.attributes, function (a) { return /^on/i.test(a.name); }); }).length;
        if (attr) f.push({ allvar: 'hog', text: plural(attr, 'element', 'element') + ' med händelseattribut (on…=) – sidan använder inga' });
        var jsl = document.querySelectorAll('a[href^="javascript:" i]').length; if (jsl) f.push({ allvar: 'hog', text: plural(jsl, 'javascript:-länk', 'javascript:-länkar') + ' i sidan' });
        await vila();
        var st = strangar(); logg('Söker efter farliga mönster i ' + st.length.toLocaleString('sv-SE') + ' textfält i datan');
        st.forEach(function (s) { FARLIGT.forEach(function (p) { if (p[0].test(s.text)) f.push({ allvar: 'hog', text: p[1] + ' i lagrad text (' + SAML[s.samling] + ', ' + s.falt + ')', atgard: { g: 'sh-rensa-text', text: 'Rensa' } }); }); });
        var csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        logg('Kontrollerar innehållspolicyn (CSP)');
        if (!csp) f.push({ allvar: 'hog', text: 'Ingen innehållspolicy – främmande skript kan köras' }); else if (/unsafe-eval|script-src[^;]*\*/.test(csp.content)) f.push({ allvar: 'medel', text: 'Innehållspolicyn tillåter för mycket' }); else logg('Innehållspolicyn är på: bara egna skript, inga ramar, inga anrop utåt', 'ok');
        await vila();
        logg('Kontrollerar service workers och webbläsarens lagring');
        try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) { var r = await navigator.serviceWorker.getRegistrations(); if (r.length) f.push({ allvar: 'medel', text: plural(r.length, 'service worker', 'service workers') + ' registrerade – CRM:et använder inga' }); } } catch (x) { /* */ }
        try { var okanda = []; for (var n = 0; n < localStorage.length; n++) { var k = localStorage.key(n); if (!/^ih-/.test(k)) okanda.push(k); } if (okanda.length) f.push({ allvar: 'info', text: plural(okanda.length, 'okänd nyckel', 'okända nycklar') + ' i webbläsarens lagring (från andra sidor på samma adress)' }); } catch (x) { /* */ }
        return f;
      } },
    { id: 'uppdatering', namn: 'Uppdateringar', under: 'Versionerna på servern jämförs med det som är laddat', ikon: 'uppgradera',
      steg: ['Hämtar senaste versionen', 'Jämför skript och stilmallar', 'Datamodellens version'],
      kor: async function (logg) {
        var f = [], html = '';
        logg('Hämtar index.html från servern (utan cache)');
        try { var r = await fetch('index.html?kontroll=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) html = await r.text(); else f.push({ allvar: 'lag', text: 'Servern svarade ' + r.status + ' – kunde inte kontrollera uppdateringar' }); } catch (x) { f.push({ allvar: 'lag', text: 'Servern gick inte att nå – kontrollen kunde inte köras' }); }
        if (html) {
          logg('Jämför versionerna (?v=) med de laddade filerna');
          var pa = {}, m, re = /(?:src|href)="([\w./-]+\.(?:js|css))\?v=([\w]+)"/g; while ((m = re.exec(html))) pa[m[1].split('/').pop()] = m[2];
          var laddat = {}; [].forEach.call(document.querySelectorAll('script[src], link[rel=stylesheet]'), function (x) { var t = String(x.getAttribute('src') || x.getAttribute('href') || '').match(/([\w.-]+\.(?:js|css))\?v=([\w]+)/); if (t) laddat[t[1]] = t[2]; });
          var nya = Object.keys(pa).filter(function (fil) { return laddat[fil] && laddat[fil] !== pa[fil]; });
          if (nya.length) f.push({ allvar: 'medel', text: 'Ny version finns på servern: ' + nya.slice(0, 4).join(', ') + (nya.length > 4 ? ' …' : ''), atgard: { g: 'sh-uppdatera', text: 'Uppdatera nu' } });
          else logg('Alla ' + Object.keys(laddat).length + ' filer har senaste versionen', 'ok');
        }
        await vila();
        logg('Kontrollerar datamodellens version');
        if ((db().version || 0) < IH.VERSION) f.push({ allvar: 'lag', text: 'Datan har version ' + db().version + ' – senaste är ' + IH.VERSION });
        return f;
      } },
    { id: 'buggar', namn: 'Buggar och fel', under: 'Fel sedan sidan laddades och trasiga kopplingar i datan', ikon: 'nyckelverktyg',
      steg: ['Fel i skript och filer', 'Kopplingar mellan posterna', 'Dubbletter och ogiltiga värden', 'Lagringen går att skriva'],
      kor: async function (logg) {
        var f = [], d = db();
        logg('Läser felen sedan sidan laddades');
        felLista.slice(-6).forEach(function (t) { f.push({ allvar: 'medel', text: t }); });
        if (felLista.length > 6) f.push({ allvar: 'lag', text: plural(felLista.length - 6, 'fel till', 'fel till') });
        await vila();
        logg('Kontrollerar kopplingarna mellan kunder, affärer, offerter, projekt och uppgifter');
        (IH.sak && IH.sak.kopplingsBrott ? IH.sak.kopplingsBrott() : []).forEach(function (t) { f.push({ allvar: 'medel', text: t }); });
        await vila();
        logg('Letar efter dubbletter och ogiltiga värden');
        var epost = {}; d.kunder.forEach(function (k) { if (k.epost) { var x = k.epost.toLowerCase(); if (epost[x]) f.push({ allvar: 'lag', text: 'Två kunder med samma e-post: ' + k.epost }); epost[x] = 1; } });
        d.affarer.forEach(function (a) { if (!(a.varde >= 0) || isNaN(a.varde)) f.push({ allvar: 'medel', text: 'Affären "' + a.titel + '" har ett ogiltigt värde' }); if (!a.titel) f.push({ allvar: 'lag', text: 'En affär saknar titel' }); });
        await vila();
        logg('Provar att skriva till webbläsarens lagring');
        try { localStorage.setItem('ih-crm-skrivprov', '1'); localStorage.removeItem('ih-crm-skrivprov'); } catch (x) { f.push({ allvar: 'hog', text: 'Lagringen går inte att skriva – ändringar sparas inte' }); }
        return f;
      } },
    { id: 'lacka', namn: 'Läckor', under: 'Personnummer, kortnummer och lösenord i data och adresser', ikon: 'fingeravtryck',
      steg: ['Personnummer i lagrad text', 'Kortnummer i lagrad text', 'Lösenord i klartext', 'Persondata i adressen'],
      kor: async function (logg) {
        var f = [], st = strangar();
        logg('Söker efter personnummer (Luhn-kontroll) i ' + st.length.toLocaleString('sv-SE') + ' textfält');
        st.forEach(function (s) { (s.text.match(/\b(?:19|20)?\d{6}[-+]?\d{4}\b/g) || []).forEach(function (x) { var d10 = x.replace(/\D/g, '').slice(-10); if (luhn(d10)) f.push({ allvar: 'hog', text: 'Möjligt personnummer i ' + SAML[s.samling].toLowerCase() + ' (' + s.falt + ')' }); }); });
        await vila();
        logg('Söker efter kortnummer');
        st.forEach(function (s) { (s.text.match(/\b(?:\d[ -]?){13,19}\b/g) || []).forEach(function (x) { var y = x.replace(/\D/g, ''); if (y.length >= 13 && luhn(y)) f.push({ allvar: 'hog', text: 'Möjligt kortnummer i ' + SAML[s.samling].toLowerCase() }); }); });
        await vila();
        logg('Söker efter lösenord i klartext');
        st.forEach(function (s) { if (/(lösenord|password|lösen)\s*[:=]\s*\S+/i.test(s.text)) f.push({ allvar: 'hog', text: 'Lösenord i klartext i ' + SAML[s.samling].toLowerCase() }); });
        await vila();
        logg('Kontrollerar att adressen inte bär persondata');
        if (/@|\b\d{6}[-+]?\d{4}\b/.test(decodeURIComponent(location.search + location.hash))) f.push({ allvar: 'medel', text: 'Adressen innehåller e-post eller personnummer', atgard: { g: 'sh-rensa-adress', text: 'Rensa adressen' } });
        f.forEach(function (x) { if (!x.atgard && /personnummer|kortnummer|lösenord/i.test(x.text)) x.atgard = { g: 'sh-maska', text: 'Maskera' }; });
        return f;
      } },
    { id: 'intrang', namn: 'Intrångsförsök', under: 'Okända konton, behörighetsförsök och inloggningen', ikon: 'skold-larm',
      steg: ['Okända konton i datan', 'Försök att nå adminsidor', 'Inloggningens tillstånd'],
      kor: async function (logg) {
        var f = [], d = db(), kanda = IH.ANVANDARE.map(function (u) { return u.id; });
        logg('Kontrollerar att alla poster pekar på kända konton');
        var okanda = {}; d.affarer.forEach(function (a) { if (a.ansvarig && kanda.indexOf(a.ansvarig) < 0) okanda[a.ansvarig] = 1; }); d.aktiviteter.forEach(function (h) { if (h.av && kanda.indexOf(h.av) < 0) okanda[h.av] = 1; });
        if (Object.keys(okanda).length) f.push({ allvar: 'hog', text: 'Poster skapade av okända konton: ' + Object.keys(okanda).join(', ') });
        await vila();
        logg('Läser försök att öppna adminsidor utan behörighet (senaste dygnet)');
        var forsok = (d.sakerhet || []).filter(function (h) { return h.typ === 'atkomst' && IH.dagarSedan(h.tid) < 1; });
        if (forsok.length >= 3) f.push({ allvar: 'medel', text: plural(forsok.length, 'försök', 'försök') + ' att öppna adminsidor utan behörighet senaste dygnet' });
        else if (forsok.length) f.push({ allvar: 'lag', text: plural(forsok.length, 'försök', 'försök') + ' att öppna en adminsida utan behörighet' });
        await vila();
        logg('Kontrollerar inloggningen');
        var jag = null; try { jag = localStorage.getItem('ih-crm-jag'); } catch (x) { /* */ }
        if (jag && kanda.indexOf(jag) < 0) f.push({ allvar: 'hog', text: 'Inloggad med ett konto som inte finns: ' + jag });
        f.push({ allvar: 'info', text: 'Demoläget har ingen riktig inloggning – skarp drift behöver tvåstegsverifiering på servern' });
        return f;
      } },
    { id: 'beteende', namn: 'Avvikande beteende', under: 'Ovanliga mängder, tider och massändringar', ikon: 'radar',
      steg: ['Exporter och återställningar', 'Aktivitet på ovanliga tider', 'Många ändringar på kort tid'],
      kor: async function (logg) {
        var f = [], d = db(), sl = d.sakerhet || [];
        logg('Räknar exporter och återställningar senaste dygnet');
        var exp = sl.filter(function (h) { return (h.typ === 'export' || h.typ === 'aterstall') && IH.dagarSedan(h.tid) < 1; }).length;
        if (exp >= 3) f.push({ allvar: 'medel', text: plural(exp, 'export eller återställning', 'exporter eller återställningar') + ' senaste dygnet' });
        await vila();
        logg('Letar efter aktivitet mitt i natten (00–05)');
        var natt = d.aktiviteter.filter(function (h) { var t = new Date(h.tid).getHours(); return t < 5 && IH.dagarSedan(h.tid) < 14; }).length;
        if (natt) f.push({ allvar: 'lag', text: plural(natt, 'aktivitet', 'aktiviteter') + ' loggade mellan 00 och 05 de senaste två veckorna' });
        await vila();
        logg('Letar efter massändringar (fler än 30 på en timme)');
        var timme = d.aktiviteter.filter(function (h) { return Date.now() - new Date(h.tid) < 36e5; }).length;
        if (timme > 30) f.push({ allvar: 'medel', text: plural(timme, 'ändring', 'ändringar') + ' den senaste timmen' });
        return f;
      } },
    { id: 'trasigt', namn: 'Trasigt', under: 'Bilder, filer och lagring som inte fungerar', ikon: 'varning',
      steg: ['Bilder på sidan', 'Husens bilder och modeller', 'Lagringens utrymme'],
      kor: async function (logg) {
        var f = [];
        logg('Kontrollerar bilderna på sidan');
        var trasiga = [].filter.call(document.images, function (b) { return b.complete && b.naturalWidth === 0 && b.getAttribute('src'); });
        if (trasiga.length) f.push({ allvar: 'medel', text: plural(trasiga.length, 'bild', 'bilder') + ' laddas inte: ' + trasiga.slice(0, 3).map(function (b) { return b.getAttribute('src').split('/').pop(); }).join(', ') });
        await vila();
        logg('Kontrollerar husens bilder och 3D-modeller på servern');
        var filer = []; (IH.MODELLER || []).forEach(function (m) { if (m.bild) filer.push(m.bild); if (m.glb) filer.push(m.glb); });
        var svar = await Promise.all(filer.map(function (u) { return fetch(u, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok ? null : u; }, function () { return u; }); }));
        svar.filter(Boolean).forEach(function (u) { f.push({ allvar: 'medel', text: 'Filen saknas på servern: ' + u.split('/').pop() }); });
        if (!svar.filter(Boolean).length) logg(filer.length + ' filer finns på servern', 'ok');
        await vila();
        logg('Mäter lagringen');
        var b = 0; try { for (var n = 0; n < localStorage.length; n++) { var k = localStorage.key(n); if (/^ih-/.test(k)) b += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (x) { /* */ }
        if (b > 4e6) f.push({ allvar: 'medel', text: 'Lagringen är nästan full: ' + Math.round(b / 1024) + ' kB av cirka 5 MB' }); else if (b > 3e6) f.push({ allvar: 'lag', text: 'Lagringen fylls: ' + Math.round(b / 1024) + ' kB' });
        return f;
      } }
  ];

  /* 02 Läget ------------------------------------------------------------------------------------- */
  function hub() { var d = db(); d.sakHub = d.sakHub || {}; d.sakHub.senast = d.sakHub.senast || {}; d.sakHub.historik = d.sakHub.historik || []; return d.sakHub; }
  var poang = function (fynd) { return Math.max(0, 100 - fynd.reduce(function (t, x) { return t + (ALLVAR[x.allvar] || ALLVAR.info).minus; }, 0)); };
  function total() { var S = hub(), alla = KONTROLLER.map(function (k) { return S.senast[k.id]; }).filter(Boolean); return alla.length ? poang(alla.reduce(function (t, x) { return t.concat(x.fynd); }, [])) : null; }
  IH.sakTotal = total;
  var lageFor = function (r) { return !r ? 'ny' : r.fynd.some(function (x) { return x.allvar === 'hog'; }) ? 'hog' : r.fynd.some(function (x) { return x.allvar === 'medel'; }) ? 'medel' : r.fynd.some(function (x) { return x.allvar === 'lag'; }) ? 'lag' : 'ok'; };
  var skan = { kor: false, nu: null, logg: [], pct: 0 };
  var ui = { oppen: null };

  /* 03 Skanningen -------------------------------------------------------------------------------- */
  var ETIKETT = { start: 'START', ok: ' OK ', medel: 'VARN', hog: 'FEL ', '': 'INFO' };
  function radHtml(x) { return '<time>' + e(x.tid || '') + '</time><b class="sh-tagg sh-tagg--' + (x.ton || 'info') + '">' + (ETIKETT[x.ton || ''] || 'INFO') + '</b><span>' + e(x.text) + '</span>'; }
  async function skanna(ids) {
    if (skan.kor) return;
    var valda = ids && ids.length ? KONTROLLER.filter(function (k) { return ids.indexOf(k.id) >= 0; }) : KONTROLLER;
    skan.kor = true; skan.logg = []; skan.pct = 0;
    var skriv = function (text, ton) {
      var tid = new Date().toLocaleTimeString('sv-SE'); skan.logg.push({ text: text, ton: ton || '', tid: tid });
      var t = document.querySelector('[data-sh-terminal]');
      if (t) { var p = document.createElement('p'); p.className = 'sh-rad' + (ton ? ' sh-rad--' + ton : ''); p.innerHTML = radHtml({ text: text, ton: ton, tid: tid }); t.appendChild(p); while (t.children.length > 70) t.firstElementChild.remove(); t.scrollTop = t.scrollHeight; }
    };
    skriv('Startar ' + (valda.length === KONTROLLER.length ? 'full skanning – sju kontroller' : valda.map(function (k) { return k.namn.toLowerCase(); }).join(', ')), 'start');
    var S = hub();
    for (var n = 0; n < valda.length; n++) {
      var k = valda[n]; skan.nu = k.id; if (/^#\/sakerhet/.test(location.hash)) IH.rita();
      skriv(k.namn + ' …', 'rubrik');
      var steg = 0, kort = document.querySelector('[data-sh-kontroll="' + k.id + '"]');
      var stegLogg = function (text, ton) { steg++; skriv(text, ton); var andel = Math.min(0.95, steg / (k.steg.length + 1)); skan.pct = Math.round(((n + andel) / valda.length) * 100); var el = document.querySelector('[data-sh-pct]'); if (el) el.textContent = skan.pct + ' %'; var kk = document.querySelector('[data-sh-kontroll="' + k.id + '"]'); if (kk) kk.style.setProperty('--forlopp', andel); };
      var fynd; try { fynd = await k.kor(stegLogg); } catch (x) { fynd = [{ allvar: 'lag', text: 'Kontrollen avbröts: ' + (x.message || x) }]; }
      S.senast[k.id] = { tid: new Date().toISOString(), fynd: fynd, av: IH.jag().id };
      var viktiga = fynd.filter(function (x) { return x.allvar !== 'info'; });
      skriv(k.namn + ': ' + (viktiga.length ? plural(viktiga.length, 'fynd', 'fynd') + ' – ' + poang(fynd) + ' av 100' : 'inga fynd'), viktiga.length ? (viktiga.some(function (x) { return x.allvar === 'hog'; }) ? 'hog' : 'medel') : 'ok');
    }
    var p = total();
    S.historik.unshift({ tid: new Date().toISOString(), poang: p, vad: valda.length === KONTROLLER.length ? 'allt' : valda.map(function (k) { return k.id; }).join(','), av: IH.jag().id });
    if (S.historik.length > 40) S.historik.length = 40;
    if (IH.sakLogg) IH.sakLogg('skanning', (valda.length === KONTROLLER.length ? 'Full skanning' : 'Skanning') + ': ' + p + ' av 100.'); else IH.spara();
    skriv('Klart. Säkerhetspoäng ' + p + ' av 100.', p >= 90 ? 'ok' : p >= 70 ? 'medel' : 'hog');
    skan.kor = false; skan.nu = null; skan.pct = 0;
    IH.spara(); if (/^#\/(sakerhet|kontroll)/.test(location.hash)) IH.rita();
    IH.toast('Skanningen är klar', p + ' av 100', 'system');
  }

  /* 04 Kärnan ------------------------------------------------------------------------------------ */
  function karna(S, p, status) {
    var R = [108, 98.5, 89, 79.5, 70, 60.5, 51], streck = '';
    for (var n = 0; n < 72; n++) { var v = (n / 72) * Math.PI * 2, r0 = n % 6 ? 115 : 111; streck += 'M' + (120 + Math.cos(v) * r0).toFixed(1) + ' ' + (120 + Math.sin(v) * r0).toFixed(1) + 'L' + (120 + Math.cos(v) * 119).toFixed(1) + ' ' + (120 + Math.sin(v) * 119).toFixed(1); }
    var ringar = KONTROLLER.map(function (k, j) {
      var r = R[j], l = 2 * Math.PI * r, rk = S.senast[k.id], andel = rk ? poang(rk.fynd) / 100 : 1, d = FARG[k.id];
      return '<g class="sh-ring' + (skan.nu === k.id ? ' skannas' : '') + '" data-lage="' + lageFor(rk) + '"><circle cx="120" cy="120" r="' + r + '" class="sh-ring__spar"/>' +
        '<circle cx="120" cy="120" r="' + r + '" class="sh-ring__bage" style="--d:' + d + ';animation-delay:' + (j * 0.08).toFixed(2) + 's" stroke-dasharray="' + (l * andel).toFixed(1) + ' ' + l.toFixed(1) + '"/>' +
        '<g class="sh-komet"><circle cx="120" cy="120" r="' + r + '" class="sh-komet__bage" style="--d:' + d + '" stroke-dasharray="' + (l * 0.18).toFixed(1) + ' ' + l.toFixed(1) + '"/></g></g>';
    }).join('');
    var mitt = skan.kor ? '<small>Skannar</small><strong data-sh-pct>' + skan.pct + ' %</strong><span>' + e(skan.nu ? KORT[skan.nu] : 'Sju kontroller') + '</span>'
      : p == null ? '<span class="sh-mitt__ikon">' + ik('skold') + '</span><small>Säkerhet</small><span>Redo att skanna</span>'
      : '<strong>' + p + '</strong><small>Säkerhetspoäng</small><span>' + e(status) + '</span>';
    var noder = ''; for (var q = 0; q < 12; q++) { var vv = q / 12 * Math.PI * 2; noder += '<i class="sh-nod" style="left:' + (50 + Math.cos(vv) * 49).toFixed(1) + '%;top:' + (50 + Math.sin(vv) * 49).toFixed(1) + '%;--n:' + q + '"></i>'; }
    var blipp = ''; [[0.62, 0.3], [0.28, 0.4], [0.7, 0.68], [0.36, 0.74], [0.5, 0.2], [0.8, 0.46]].forEach(function (x, q) { var v = Math.atan2(x[1] - 0.5, x[0] - 0.5); blipp += '<i class="sh-blipp" style="left:' + (x[0] * 100) + '%;top:' + (x[1] * 100) + '%;--f:' + (((v * 180 / Math.PI) + 450) % 360 / 360).toFixed(3) + '"></i>'; });
    return '<div class="sh-karna" data-sh-tilt aria-hidden="true"><div class="sh-scen"><i class="sh-golv"></i><i class="sh-svep"></i>' + blipp + '<i class="sh-puls"></i><i class="sh-puls sh-puls--2"></i><i class="sh-puls sh-puls--3"></i>' + noder + '<i class="sh-orbit sh-o1"><b></b></i><i class="sh-orbit sh-o2"><b></b></i>' +
      '<svg class="sh-ringar" viewBox="0 0 240 240"><path d="' + streck + '" class="sh-streck"/>' + ringar + '</svg><div class="sh-mitt">' + mitt + '</div></div></div>';
  }

  /* 05 Vyn #/sakerhet ---------------------------------------------------------------------------- */
  function sparkline(v, b, h) {
    if (v.length < 2) return '';
    var max = 100, min = Math.max(0, Math.min.apply(null, v) - 10), dx = b / (v.length - 1);
    var pts = v.map(function (x, n) { return [n * dx, h - ((x - min) / (max - min || 1)) * (h - 8) - 4]; });
    var d = pts.map(function (p, n) { return (n ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    return '<svg viewBox="0 0 ' + b + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'L' + b + ' ' + h + 'L0 ' + h + 'Z" class="sh-spark__yta"/><path d="' + d + '" class="sh-spark__linje"/>' +
      pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" class="sh-spark__prick"/>'; }).join('') + '</svg>';
  }
  IH.vyer.sakerhet = function () {
    if (!arAdmin()) return { titel: 'Säkerhet', html: '<a class="tillbaka" href="#/">' + i('pilv') + 'Översikt</a><section class="kort ad-band"><h2>' + ik('las') + 'Bara för administratören</h2><p class="ad-not">Byt till kontot Admin i kontomenyn för att se säkerhetshubben.</p></section>' };
    var S = hub(), p = total(), senast = S.historik[0];
    var ton = p == null ? 'is' : p >= 90 ? 'gron' : p >= 70 ? 'gul' : 'rod';
    var status = p == null ? 'Inte skannat ännu' : p >= 90 ? 'Skyddat' : p >= 70 ? 'Bör ses över' : 'Åtgärda nu';
    var knapp = function (ids, ikon, text, accent) { return '<button type="button" class="sh-knapp' + (accent ? ' sh-knapp--accent' : '') + '" data-g="sh-skanna" data-ids="' + ids + '"' + (skan.kor ? ' disabled' : '') + '>' + ik(ikon) + '<span>' + text + '</span></button>'; };
    var delar = '<ul class="sh-delar">' + KONTROLLER.map(function (k) { var r = S.senast[k.id]; return '<li data-lage="' + lageFor(r) + '" style="--d:' + FARG[k.id] + '"><i></i><span>' + KORT[k.id] + '</span><strong>' + (r ? poang(r.fynd) : '–') + '</strong></li>'; }).join('') +
      '<li class="sh-delar__total" data-ton="' + ton + '">' + ik(p == null ? 'radar' : p >= 90 ? 'skold' : 'skold-larm') + '<span>' + status + '</span><strong>' + (p == null ? '–' : p) + '</strong></li></ul>';
    var hjalte = '<section class="sh-hjalte sh-mork kort kort--mork" data-ton="' + ton + '"' + (skan.kor ? ' data-skannar' : '') + '><div class="sh-rutnat" aria-hidden="true"></div><i class="sh-skanlinje" aria-hidden="true"></i>' +
      '<div class="sh-text"><p class="etikett"><i class="sh-live"></i>Säkerhetshubben · demoläget</p><h1>Säkerhet <em>i realtid.</em></h1>' +
        '<p class="sh-ingress">Kontrollerna körs i webbläsaren mot sidans kod och CRM:ets data – skadlig kod, uppdateringar, buggar, läckor, intrångsförsök, avvikande beteende och sådant som är trasigt.</p>' +
        '<div class="sh-knappar">' + knapp('', 'radar', 'Skanna allt', true) + knapp('uppdatering', 'uppgradera', 'Sök uppdateringar') + knapp('buggar', 'nyckelverktyg', 'Kontrollera buggar') + knapp('lacka', 'fingeravtryck', 'Läckkontroll') + knapp('intrang,beteende', 'skold-larm', 'Intrång och beteende') + '</div>' +
        delar + '<p class="sh-senast">' + (senast ? 'Senast skannat ' + IH.sedan(senast.tid) + ' av ' + e((IH.anvandare(senast.av) || {}).namn || '') : 'Ingen skanning gjord ännu – kör en för att få säkerhetspoängen.') + '</p></div>' +
      '<div class="sh-karnkol">' + karna(S, p, status) + '</div></section>';
    var kontroller = KONTROLLER.map(function (k) {
      var r = S.senast[k.id], f = r ? r.fynd : [], lage = lageFor(r), viktiga = f.filter(function (x) { return x.allvar !== 'info'; });
      var text = !r ? 'Inte körd ännu' : viktiga.length ? plural(viktiga.length, 'fynd', 'fynd') : 'Inga fynd', oppen = ui.oppen === k.id;
      return '<article class="sh-kontroll' + (skan.nu === k.id ? ' skannas' : '') + '" data-sh-kontroll="' + k.id + '" data-lage="' + lage + '" style="--d:' + FARG[k.id] + '">' +
        '<span class="sh-forlopp" aria-hidden="true"><i></i></span>' +
        '<header><span class="sh-kontroll__ikon">' + ik(k.ikon) + '</span><div><h3>' + k.namn + '</h3><p>' + k.under + '</p></div><span class="sh-lampa" title="' + text + '"></span></header>' +
        '<div class="sh-kontroll__fot"><strong>' + (skan.nu === k.id ? 'Kontrolleras…' : text) + '</strong><small>' + (r ? IH.sedan(r.tid) : '') + '</small>' +
          '<button type="button" class="knapp knapp--liten" data-g="sh-skanna" data-ids="' + k.id + '"' + (skan.kor ? ' disabled' : '') + '>' + ik('radar') + 'Kör</button>' +
          (r ? '<button type="button" class="knapp knapp--liten sh-spok" data-g="sh-visa" data-id="' + k.id + '" aria-expanded="' + oppen + '">' + (oppen ? 'Dölj' : 'Detaljer') + '</button>' : '') + '</div>' +
        (oppen && r ? '<ul class="sh-steg">' + k.steg.map(function (s) { return '<li>' + ik('bock') + s + '</li>'; }).join('') + '</ul>' +
          (f.length ? '<ul class="sh-fynd">' + f.map(function (x) { return '<li data-allvar="' + x.allvar + '"><span class="sh-allvar">' + ALLVAR[x.allvar].namn + '</span><span>' + e(x.text) + '</span>' + (x.atgard ? '<button type="button" class="knapp knapp--liten" data-g="' + x.atgard.g + '">' + e(x.atgard.text) + '</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="sh-inga">Inga fynd.</p>') : '') +
        '</article>';
    }).join('') +
      '<article class="sh-kontroll sh-kontroll--total" data-lage="' + (p == null ? 'ny' : p >= 90 ? 'ok' : p >= 70 ? 'medel' : 'hog') + '"><header><span class="sh-kontroll__ikon">' + ik('skold') + '</span><div><h3>Hela skyddet</h3><p>Alla sju kontroller i en skanning – tar några sekunder.</p></div><span class="sh-lampa"></span></header>' +
        '<div class="sh-kontroll__fot"><strong>' + (p == null ? 'Inte skannat' : p + ' av 100') + '</strong><small>' + (senast ? IH.sedan(senast.tid) : '') + '</small><button type="button" class="knapp knapp--virke knapp--liten" data-g="sh-skanna" data-ids=""' + (skan.kor ? ' disabled' : '') + '>' + ik('radar') + 'Skanna allt</button></div></article>';
    var hist = S.historik.slice(0, 12).reverse();
    var vilo = []; if (senast) { var st = new Date(senast.tid).toLocaleTimeString('sv-SE'); vilo.push({ tid: st, ton: 'start', text: 'Senaste skanningen ' + new Date(senast.tid).toLocaleDateString('sv-SE') + ' av ' + ((IH.anvandare(senast.av) || {}).namn || '') });
      KONTROLLER.forEach(function (k) { var r = S.senast[k.id]; if (!r) return; var vk = r.fynd.filter(function (x) { return x.allvar !== 'info'; }); vilo.push({ tid: new Date(r.tid).toLocaleTimeString('sv-SE'), ton: !vk.length ? 'ok' : vk.some(function (x) { return x.allvar === 'hog'; }) ? 'hog' : 'medel', text: (k.namn + ' ').padEnd(22, '.') + ' ' + poang(r.fynd) + '/100' + (vk.length ? '  ' + vk[0].text.slice(0, 60) + (vk.length > 1 ? ' (+' + (vk.length - 1) + ')' : '') : '') }); });
      vilo.push({ tid: st, ton: senast.poang >= 90 ? 'ok' : senast.poang >= 70 ? 'medel' : 'hog', text: 'Säkerhetspoäng ' + senast.poang + ' av 100' }); }
    else vilo.push({ tid: new Date().toLocaleTimeString('sv-SE'), ton: 'start', text: 'Redo. Tryck på Skanna allt eller kör en kontroll.' });
    var rader = skan.logg.length ? skan.logg : vilo;
    var terminal = '<section class="ad-band kort sh-terminalkort"><h2>' + ik('server') + 'Skanningens logg' + (skan.kor ? '<small class="sh-antal sh-antal--live"><i></i>Skannar ' + skan.pct + ' %</small>' : '') + '</h2>' +
      '<div class="sh-konsol"><div class="sh-konsol__list"><i></i><i></i><i></i><span>legohus-crm · säkerhet</span><em>' + (skan.kor ? 'kör' : 'redo') + '</em></div>' +
      '<div class="sh-terminal" data-sh-terminal role="log" aria-live="polite">' + rader.map(function (x) { return '<p class="sh-rad' + (x.ton ? ' sh-rad--' + x.ton : '') + '">' + radHtml(x) + '</p>'; }).join('') + '</div>' +
      '<div class="sh-konsol__status"><span>' + plural(KONTROLLER.length, 'kontroll', 'kontroller') + '</span><span>' + (senast ? 'senast ' + IH.sedan(senast.tid) : 'aldrig skannat') + '</span><span>' + (p == null ? '–' : p + '/100') + '</span>' +
        '<button type="button" data-g="sh-skanna" data-ids=""' + (skan.kor ? ' disabled' : '') + '>' + ik('radar') + 'Kör igen</button><button type="button" data-g="sh-kopiera">' + ik('skold') + 'Kopiera</button></div></div></section>';
      (skan.logg.length ? skan.logg : [{ text: senast ? 'Senaste skanningen: ' + senast.poang + ' av 100 (' + new Date(senast.tid).toLocaleString('sv-SE') + ')' : 'Redo. Tryck på Skanna allt.', ton: 'start' }]).map(function (x) { return '<p class="sh-rad' + (x.ton ? ' sh-rad--' + x.ton : '') + '">› ' + e(x.text) + '</p>'; }).join('') + '</div></section>';
    // Poängen över tid: diagram 0–100 med zonerna (åtgärda, bör ses över, skyddat), punkter med värde och datum,
    // trend mot förra skanningen; säkerhetsloggen med typfilter, ikon per typ och Visa fler
    var serie = S.historik.slice(0, 12).reverse(), BB = 520, HH = 160, PL = 34, PR = 14, PT = 22, PB = 26, IN = 26;
    var xv = function (n) { return serie.length < 2 ? PL + (BB - PL - PR) / 2 : PL + IN + n * (BB - PL - PR - IN * 2) / (serie.length - 1); }, yv = function (v) { return PT + (100 - v) / 100 * (HH - PT - PB); };
    var zon = function (fran, till, cls, text) { return '<rect x="' + PL + '" y="' + yv(till) + '" width="' + (BB - PL - PR) + '" height="' + (yv(fran) - yv(till)) + '" class="sh-zon sh-zon--' + cls + '"/><text x="' + (BB - PR - 4) + '" y="' + (yv(till) + 11) + '" class="sh-zon__text">' + text + '</text>'; };
    var diagram = serie.length ? '<svg class="sh-diagram" viewBox="0 0 ' + BB + ' ' + HH + '" role="img" aria-label="Säkerhetspoängen över tid">' +
      zon(0, 70, 'rod', 'Åtgärda') + zon(70, 90, 'gul', 'Se över') + zon(90, 100, 'gron', 'Skyddat') +
      [0, 70, 90, 100].map(function (v) { return '<line x1="' + PL + '" x2="' + (BB - PR) + '" y1="' + yv(v) + '" y2="' + yv(v) + '" class="sh-diagram__grid"/><text x="' + (PL - 6) + '" y="' + (yv(v) + 3) + '" class="sh-diagram__y">' + v + '</text>'; }).join('') +
      (serie.length > 1 ? '<path class="sh-diagram__yta" d="M' + xv(0) + ' ' + yv(0) + serie.map(function (x, n) { return 'L' + xv(n).toFixed(1) + ' ' + yv(x.poang || 0).toFixed(1); }).join('') + 'L' + xv(serie.length - 1) + ' ' + yv(0) + 'Z"/><path class="sh-diagram__linje" pathLength="1" d="' + serie.map(function (x, n) { return (n ? 'L' : 'M') + xv(n).toFixed(1) + ' ' + yv(x.poang || 0).toFixed(1); }).join('') + '"/>' : '') +
      serie.map(function (x, n) { var t = x.poang >= 90 ? 'gron' : x.poang >= 70 ? 'gul' : 'rod', d = new Date(x.tid); return '<g class="sh-diagram__punkt" data-ton="' + t + '" style="--n:' + n + '"><title>' + x.poang + ' av 100 · ' + d.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</title><circle cx="' + xv(n).toFixed(1) + '" cy="' + yv(x.poang || 0).toFixed(1) + '" r="5"/><text x="' + xv(n).toFixed(1) + '" y="' + (yv(x.poang || 0) - 10).toFixed(1) + '" class="sh-diagram__v">' + x.poang + '</text>' +
        (n === 0 || n === serie.length - 1 || serie.length <= 6 ? '<text x="' + xv(n).toFixed(1) + '" y="' + (HH - 6) + '" class="sh-diagram__x">' + d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + (serie.length <= 3 ? ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '') + '</text>' : '') + '</g>'; }).join('') + '</svg>' : '';
    var TYPER = [['alla', 'Allt'], ['skanning', 'Skanning'], ['filskanning', 'Filer'], ['konto', 'Konton'], ['support', 'Support'], ['atkomst', 'Åtkomst'], ['intrang', 'Intrång'], ['export', 'Export'], ['aterstall', 'Återställning']];
    var TYPIKON = { skanning: 'radar', filskanning: 'dokument', konto: 'anvandare-plus', support: 'kunder', atkomst: 'las' };
    var hLogg = (db().sakerhet || []).filter(function (h) { return !ui.typ || ui.typ === 'alla' || h.typ === ui.typ; }), visa = ui.fler ? 30 : 6;
    var historik = '<section class="ad-band kort sh-histkort"><h2>' + ik('stapel') + 'Poängen över tid' + (S.historik.length ? '<small class="sh-antal">' + plural(S.historik.length, 'skanning', 'skanningar') + '</small>' : '') + '</h2>' +
      (diagram ? diagram + (function () { var v = S.historik.map(function (x) { return x.poang || 0; }), snitt = Math.round(v.reduce(function (t, x) { return t + x; }, 0) / v.length);
        return '<div class="sh-diagram__fakta"><span><small>Senast</small><b>' + v[0] + '</b></span><span><small>Snitt</small><b>' + snitt + '</b></span><span><small>Bäst</small><b>' + Math.max.apply(null, v) + '</b></span><span><small>Lägst</small><b>' + Math.min.apply(null, v) + '</b></span></div>' +
          '<p class="sh-diagram__forkl">Varje punkt är en skanning (0–100). <i class="gron"></i>90 och uppåt är skyddat, <i class="gul"></i>70–89 bör ses över, <i class="rod"></i>under 70 behöver åtgärdas. Håll musen över en punkt för tiden.</p>'; })() : '<p class="ad-not">Ingen skanning gjord ännu – kör en så ritas kurvan här.</p>') +
      (S.historik.length ? '<ul class="sh-histlista">' + S.historik.slice(0, 4).map(function (x, n) { var t = x.poang >= 90 ? 'gron' : x.poang >= 70 ? 'gul' : 'rod', f = S.historik[n + 1], diff = f ? x.poang - f.poang : null;
        return '<li><strong data-ton="' + t + '">' + x.poang + '</strong><span>' + (x.vad === 'allt' ? 'Full skanning' : x.vad.split(',').map(function (id) { return KORT[id] || id; }).join(', ')) + '<small>' + e((IH.anvandare(x.av) || {}).namn || '') + ' · ' + IH.sedan(x.tid) + '</small></span>' +
          (diff == null ? '<em class="sh-trend">första</em>' : '<em class="sh-trend" data-riktning="' + (diff > 0 ? 'upp' : diff < 0 ? 'ner' : 'lika') + '">' + (diff > 0 ? '↑ +' + diff : diff < 0 ? '↓ ' + diff : '± 0') + '</em>') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="sh-logghuvud"><p class="ad-etikett">Säkerhetsloggen</p><div class="ap-filterrad" role="group" aria-label="Typ">' + TYPER.filter(function (t) { return t[0] === 'alla' || (db().sakerhet || []).some(function (h) { return h.typ === t[0]; }); }).map(function (t) { return '<button type="button" class="ap-filter" data-g="sh-loggtyp" data-f="' + t[0] + '" aria-pressed="' + ((ui.typ || 'alla') === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      (hLogg.length ? '<ol class="sh-logg">' + hLogg.slice(0, visa).map(function (h) { return '<li data-typ="' + e(h.typ) + '"><span class="sh-logg__ikon">' + ik(TYPIKON[h.typ] || 'info') + '</span><span class="sh-logg__text"><b>' + e(String(h.text).slice(0, 110)) + '</b><small>' + e(h.typ) + ' · ' + e((IH.anvandare(h.av) || {}).namn || 'systemet') + '</small></span><time title="' + new Date(h.tid).toLocaleString('sv-SE') + '">' + IH.sedan(h.tid) + '</time></li>'; }).join('') + '</ol>' +
        (hLogg.length > 6 ? '<button type="button" class="sh-fler" data-g="sh-loggfler">' + (ui.fler ? 'Visa färre' : 'Visa alla ' + Math.min(30, hLogg.length)) + '</button>' : '') : '<p class="ad-not">Inga händelser ' + (ui.typ && ui.typ !== 'alla' ? 'av den typen ' : '') + 'ännu.</p>') + '</section>';
    var logg = db().sakerhet || [], nu0 = Date.now(), inom = function (h, d) { return nu0 - new Date(h.tid) < d * 864e5; };
    var vecka = []; for (var dd = 6; dd >= 0; dd--) { var d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - dd); var d1 = new Date(d0.getTime() + 864e5); vecka.push({ d: d0, n: logg.filter(function (h) { var t = new Date(h.tid); return t >= d0 && t < d1; }).length }); }
    var vmax = Math.max.apply(null, vecka.map(function (x) { return x.n; }).concat([1]));
    var stoppade = logg.filter(function (h) { return h.typ === 'filskanning' && /Stoppad/.test(h.text); }).length, granskade = logg.filter(function (h) { return h.typ === 'filskanning'; }).length;
    var konton = logg.filter(function (h) { return (h.typ === 'konto' || h.typ === 'atkomst') && inom(h, 30); }).length;
    var drift = '<section class="sh-drift kort" data-in><header><span class="sh-drift__live"><i></i>Live</span><h2>Driftläget <em>just nu</em></h2><small>Räknat ur säkerhetsloggen i den här webbläsaren</small></header>' +
      '<div class="sh-drift__tal">' + [
        ['skold', 'Säkerhetspoäng', p == null ? '–' : p, p == null ? 'kör en skanning' : status, ton],
        ['fingeravtryck', 'Händelser 7 dagar', logg.filter(function (h) { return inom(h, 7); }).length, plural(logg.length, 'händelse', 'händelser') + ' totalt', 'is'],
        ['skold-larm', 'Stoppade filer', stoppade, plural(granskade, 'fil granskad', 'filer granskade'), stoppade ? 'rod' : 'gron'],
        ['anvandare-plus', 'Konto och åtkomst', konton, 'ändringar 30 dagar', 'gul']
      ].map(function (x, n) { return '<div class="sh-drift__ruta" data-ton="' + x[4] + '" style="--n:' + n + '"><span>' + ik(x[0]) + '</span><small>' + x[1] + '</small><b>' + x[2] + '</b><em>' + e(x[3]) + '</em></div>'; }).join('') + '</div>' +
      '<div class="sh-drift__nedre"><div class="sh-vecka"><small>Händelser per dag</small><div>' + vecka.map(function (x, n) { return '<span style="--h:' + (x.n / vmax).toFixed(3) + ';--n:' + n + '" title="' + x.d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' }) + ': ' + plural(x.n, 'händelse', 'händelser') + '"><i></i><b>' + 'SMTOTFL'.charAt(x.d.getDay()) + '</b></span>'; }).join('') + '</div></div>' +
        '<div class="sh-ticker" aria-label="Senaste händelserna"><small>Senaste händelserna</small><div class="sh-ticker__band"><div class="sh-ticker__rull' + (logg.length < 4 ? ' sh-ticker__rull--still' : '') + '">' + (logg.length ? (logg.length < 4 ? logg.slice(0, 3) : logg.slice(0, 8).concat(logg.slice(0, 8))).map(function (h) { return '<p><span class="sh-ticker__typ">' + e(h.typ) + '</span>' + e(String(h.text).slice(0, 90)) + '<time>' + IH.sedan(h.tid) + '</time></p>'; }).join('') : '<p>Inga händelser ännu – skanna, ladda upp en fil eller ändra ett konto så syns det här.</p>') + '</div></div></div></div></section>';
    var auto = !!S.auto, nastaAuto = senast ? Math.max(0, 24 - Math.floor((Date.now() - new Date(senast.tid)) / 36e5)) : 0;
    var verktyg = '<section class="sh-verktyg kort" data-in><header><h2>' + ik('nyckelverktyg') + 'Verktyg</h2><small>Allt körs i den här webbläsaren</small></header><div class="sh-verktyg__rutnat">' +
      '<button type="button" class="sh-vk" data-g="sh-rapport" style="--n:0"><span>' + ik('ladda-ner') + '</span><b>Säkerhetsrapport</b><small>Poäng, fynd per kontroll och loggen som textfil</small></button>' +
      '<button type="button" class="sh-vk" data-g="sh-auto" aria-pressed="' + auto + '" style="--n:1"><span>' + ik('radar') + '</span><b>Automatisk skanning</b><small>' + (auto ? 'På – skannar när sidan öppnas om det gått ett dygn' + (senast ? ' (nästa om ' + nastaAuto + ' h)' : '') : 'Av – slå på för en skanning om dygnet') + '</small><i class="sh-vk__brytare"></i></button>' +
      '<button type="button" class="sh-vk" data-g="sh-behorighet" style="--n:2"><span>' + ik('anvandare-plus') + '</span><b>Granska behörigheter</b><small>Vem har vilken roll, vem är admin och vilka konton är inaktiva</small></button>' +
      '<button type="button" class="sh-vk" data-g="sh-kopiera" style="--n:3"><span>' + ik('skold') + '</span><b>Kopiera läget</b><small>En kort sammanfattning att klistra in i ett mejl eller chatten</small></button>' +
      '</div></section>';
    // ritas sidan om (under en skanning eller efter ett klick) spelas inte intoningarna och uppräkningen igen
    var omritning = Date.now() - (ui.ritad || 0) < 4000 && location.hash.indexOf('sakerhet') >= 0 && !!document.querySelector('.sh-drift'); ui.ritad = Date.now();
    if (omritning) { drift = drift.replace('class="sh-drift kort" data-in', 'class="sh-drift kort sh-stilla"'); verktyg = verktyg.replace('class="sh-verktyg kort" data-in', 'class="sh-verktyg kort sh-stilla"'); }
    var html = hjalte + drift + verktyg + '<section class="ad-band kort sh-kontrollband"><h2>' + ik('skold') + 'Sju kontroller<small class="sh-antal">Varje kontroll kan köras för sig. Fynd med åtgärd har en knapp.</small></h2><div class="sh-kontroller">' + kontroller + '</div></section>' +
      '<div class="ad-tva">' + terminal + historik + '</div>';
    return { titel: 'Säkerhet', html: html, efter: function (rot) { var t = rot.querySelector('[data-sh-terminal]'); if (t) t.scrollTop = t.scrollHeight;
      if (S.auto && !skan.kor && (!senast || Date.now() - new Date(senast.tid) > 864e5)) setTimeout(function () { if (!skan.kor) { IH.toast('Automatisk skanning', 'Det har gått över ett dygn sedan senaste skanningen.', 'radar'); skanna(null); } }, 900);
      if (!omritning) rot.querySelectorAll('.sh-drift__ruta b').forEach(function (el, n) { var mal = parseInt(el.textContent, 10); if (isNaN(mal) || lugn()) return; var t0 = performance.now() + n * 80; var steg = function (nu) { var q = Math.min(1, Math.max(0, (nu - t0) / 900)); el.textContent = Math.round(mal * (1 - Math.pow(1 - q, 3))); if (q < 1) requestAnimationFrame(steg); }; requestAnimationFrame(steg); });
    } };
  };
  // Kontrollcentralen läser kontrollerna, felen och läget härifrån, och kan starta en skanning
  IH.sakHub = { kontroller: KONTROLLER, lageFor: lageFor, poang: poang, fel: felLista, hub: hub, skanna: skanna, total: total };
  IH.G['sh-skanna-ga'] = function (el) { var ids = el.getAttribute('data-ids'); IH.ga('#/sakerhet'); setTimeout(function () { skanna(ids ? ids.split(',') : null); }, 350); };
  IH.G['sh-rensa-fel'] = function () { felLista.length = 0; IH.rita(); IH.toast('Felloggen är rensad', null, 'aterstall'); };
  IH.G['sh-skanna'] = function (el) { var ids = el.getAttribute('data-ids'); skanna(ids ? ids.split(',') : null); };
  // Rensar farliga mönster ur all lagrad text (skripttaggar, javascript:-länkar, händelseattribut, ramar)
  // Maskerar läckor i lagrad text: personnummer och kortnummer (bara de som klarar Luhn) och lösenord i klartext
  IH.G['sh-maska'] = function () {
    var n = 0, d = db();
    var maska = function (t) {
      var u = String(t)
        .replace(/\b(?:19|20)?\d{6}[-+]?\d{4}\b/g, function (x) { var d10 = x.replace(/\D/g, '').slice(-10); return luhn(d10) ? 'ÅÅMMDD-XXXX' : x; })
        .replace(/\b(?:\d[ -]?){13,19}\b/g, function (x) { var y = x.replace(/\D/g, ''); return y.length >= 13 && luhn(y) ? '**** **** **** ' + y.slice(-4) + (/\s$/.test(x) ? ' ' : '') : x; })
        .replace(/(lösenord|password|lösen)(\s*[:=]\s*)\S+/gi, '$1$2••••••');
      if (u !== t) n++; return u;
    };
    ['kunder', 'affarer', 'aktiviteter', 'uppgifter', 'forfragningar', 'offerter'].forEach(function (sm) { (d[sm] || []).forEach(function (x) { Object.keys(x).forEach(function (f) { if (typeof x[f] === 'string') x[f] = maska(x[f]); }); }); });
    ((d.chatt || {}).meddelanden || []).forEach(function (m) { if (m.text) m.text = maska(m.text); });
    if (IH.sakLogg) IH.sakLogg('skanning', 'Maskerade läckor i ' + plural(n, 'fält', 'fält') + '.'); IH.spara();
    IH.toast(n ? 'Maskerat' : 'Inget att maskera', n ? plural(n, 'fält', 'fält') + ' maskerades.' : 'Inga läckor hittades.', 'skold'); skanna(['lacka']);
  };
  IH.G['sh-rensa-adress'] = function () { history.replaceState(null, '', location.pathname + '#/sakerhet'); IH.toast('Adressen är rensad', null, 'skold'); skanna(['lacka']); };
  IH.G['sh-rensa-text'] = function () {
    var n = 0, d = db(), tvatta = function (t) { var u = String(t).replace(/<\s*\/?\s*(script|iframe|object|embed)[^>]*>/gi, '').replace(/javascript:/gi, '').replace(/\bon(error|load|click|mouseover)\s*=/gi, ''); if (u !== t) n++; return u; };
    ['kunder', 'affarer', 'aktiviteter', 'uppgifter', 'forfragningar', 'offerter'].forEach(function (sm) { (d[sm] || []).forEach(function (x) { Object.keys(x).forEach(function (f) { if (typeof x[f] === 'string') x[f] = tvatta(x[f]); }); }); });
    ((d.chatt || {}).meddelanden || []).forEach(function (m) { if (m.text) m.text = tvatta(m.text); });
    if (IH.sakLogg) IH.sakLogg('skanning', 'Rensade farlig text i ' + plural(n, 'fält', 'fält') + '.'); IH.spara();
    IH.toast(n ? 'Rensat' : 'Inget att rensa', n ? plural(n, 'fält', 'fält') + ' tvättades.' : 'Ingen farlig text hittades.', 'skold'); skanna(['kod']);
  };
  IH.G['sh-loggtyp'] = function (el) { ui.typ = el.getAttribute('data-f'); ui.fler = false; IH.rita(); };
  IH.G['sh-loggfler'] = function () { ui.fler = !ui.fler; IH.rita(); };
  IH.G['sh-visa'] = function (el) { var id = el.getAttribute('data-id'); ui.oppen = ui.oppen === id ? null : id; IH.rita(); };
  IH.G['sh-uppdatera'] = function () { location.reload(); };
  IH.G['sh-auto'] = function () { var S = hub(); S.auto = !S.auto; IH.spara(); IH.rita(); IH.toast(S.auto ? 'Automatisk skanning på' : 'Automatisk skanning av', S.auto ? 'Sidan skannar själv när det gått ett dygn.' : '', 'radar'); };
  var sammanfattning = function () {
    var S = hub(), p = total(), senast = S.historik[0];
    return ['Säkerhetsläget i Legohus CRM – ' + new Date().toLocaleString('sv-SE'), 'Poäng: ' + (p == null ? 'inte skannat' : p + ' av 100'), senast ? 'Senast skannat: ' + new Date(senast.tid).toLocaleString('sv-SE') : '',
      KONTROLLER.map(function (k) { var r = S.senast[k.id]; return '– ' + k.namn + ': ' + (r ? poang(r.fynd) + ' av 100' + (r.fynd.filter(function (x) { return x.allvar !== 'info'; }).length ? ' (' + r.fynd.filter(function (x) { return x.allvar !== 'info'; }).map(function (x) { return x.text; }).join('; ') + ')' : '') : 'inte körd'); }).join('\n')].filter(Boolean).join('\n');
  };
  IH.G['sh-kopiera'] = function () { var t = sammanfattning(), ok = function () { IH.toast('Kopierat', 'Säkerhetsläget ligger i urklipp.', 'kopiera'); }; try { navigator.clipboard.writeText(t).then(ok, ok); } catch (x) { ok(); } };
  IH.G['sh-rapport'] = function () {
    var t = sammanfattning() + '\n\nSäkerhetsloggen (senaste 50):\n' + (db().sakerhet || []).slice(0, 50).map(function (h) { return new Date(h.tid).toLocaleString('sv-SE') + '  ' + h.typ + '  ' + h.text; }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' })); a.download = 'sakerhetsrapport-' + IH.dagStr() + '.txt'; document.body.appendChild(a); a.click(); a.remove();
    IH.toast('Rapporten är sparad', 'Textfilen ligger bland dina hämtade filer.', 'ladda-ner');
  };
  IH.G['sh-behorighet'] = function () {
    var konton = IH.ANVANDARE.slice(), admins = konton.filter(function (u) { return u.roll === 'admin' && !u.inaktiv; }).length;
    IH.oppnaArk({ titel: 'Behörigheter', ikon: 'anvandare-plus', under: plural(konton.length, 'konto', 'konton') + ' · ' + plural(admins, 'administratör', 'administratörer'),
      kropp: '<ul class="sh-beh">' + konton.map(function (u) { var roll = u.roll === 'admin' ? 'Administratör' : u.chef ? 'Säljare och chef' : u.roll === 'prod' ? 'Produktion' : 'Säljare'; return '<li data-inaktiv="' + !!u.inaktiv + '"><span class="avatar" style="background:' + (u.farg || '#ccc') + '">' + e(IH.initialer(u.namn)) + '</span><span><b>' + e(u.namn) + '</b><small>' + roll + (u.inaktiv ? ' · inaktiverat' : '') + '</small></span><em data-roll="' + u.roll + '">' + (u.roll === 'admin' ? 'Full åtkomst' : u.chef ? 'Teamets data' : 'Egna affärer') + '</em></li>'; }).join('') + '</ul>' +
        (admins > 1 ? '<p class="sh-beh__tips">' + admins + ' administratörer – se över om alla behöver full åtkomst.</p>' : '<p class="sh-beh__tips sh-beh__tips--ok">En administratör – bra.</p>'),
      fot: '<a class="knapp" href="#/admin">' + ik('installningar') + 'Till adminpanelen</a><button class="knapp knapp--virke" type="button" data-g="stang-ark">Klar</button>' });
  };

  // Kärnan lutar efter musen (som i Uperformance)
  document.addEventListener('mousemove', function (ev) {
    var k = document.querySelector('[data-sh-tilt]'); if (!k || lugn()) return;
    var r = k.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
    if (Math.abs(x) > 1.5 || Math.abs(y) > 1.5) { k.style.setProperty('--tx', '0deg'); k.style.setProperty('--ty', '0deg'); return; }
    k.style.setProperty('--tx', (-y * 14).toFixed(2) + 'deg'); k.style.setProperty('--ty', (x * 18).toFixed(2) + 'deg');
  }, { passive: true });
})();
