/* Legohus CRM – chatten (2026-10-28, efter Uperformance CRM:s chatt.js).
   #/chatt[/kanal]: samtalen till vänster (Hela teamet + ett privat samtal per kollega), tråden i mitten med
   datumrubriker och "Nya meddelanden"-linjen, och skrivrutan (Enter skickar, Shift+Enter ny rad). #kund och
   #affär i texten blir klickbara kort. Olästa räknas per konto och syns som bricka i menyn.
   Data i db.chatt = { meddelanden, last } – sparas med resten i webbläsaren. Prototyp: kollegorna svarar inte. */
(function () {
  'use strict';
  var IH = window.IH;
  var e = IH.e, i = IH.i;
  var db = function () { return IH.db; };

  /* 01 Data och exempel ------------------------------------------------------------------------- */
  function chatt() {
    var d = db();
    if (!d.chatt) {
      var t = function (dagar, h, m) { var x = new Date(); x.setDate(x.getDate() + dagar); x.setHours(h, m, 0, 0); return x.toISOString(); };
      var aff = d.affarer.filter(function (a) { return a.steg === 'offert'; })[0];
      d.chatt = {
        meddelanden: [
          { id: 'm1', kanal: 'team', av: 'ab', tid: t(-2, 8, 12), text: 'God morgon! Veckomöte kl 9 som vanligt – ta med det som står still i tavlan.' },
          { id: 'm2', kanal: 'team', av: 'je', tid: t(-2, 8, 31), text: 'Stommarna till nästa montage är klara i verkstaden. Lastbilen är bokad.' },
          { id: 'm3', kanal: 'team', av: 'eb', tid: t(-1, 14, 5), text: 'Platsbesöket i Tyresö gick bra. Bra väg fram för kranen.' },
          { id: 'm4', kanal: 'team', av: 'ab', tid: t(0, 7, 58), text: 'Snyggt jobbat med veckans ordrar allihop!' + (aff ? ' Glöm inte att följa upp [[affar:' + aff.id + ']].' : '') },
          { id: 'm5', kanal: 'p-ab-ml', av: 'ab', tid: t(-1, 16, 40), text: 'Har du hunnit ringa om sjötomten? Säg till om du vill att jag följer med på platsbesöket.' },
          { id: 'm6', kanal: 'p-je-ml', av: 'je', tid: t(0, 9, 15), text: 'Kan du kolla med kunden om grunden är gjuten innan vi bokar montaget?' }
        ],
        last: {}
      };
    }
    return d.chatt;
  }
  var privat = function (a, b) { return 'p-' + [a, b].sort().join('-'); };
  function kanaler() {
    var jag = IH.jag();
    var lista = [{ id: 'team', namn: 'Hela teamet', under: IH.ANVANDARE.length + ' personer', team: true }];
    IH.ANVANDARE.forEach(function (u) { if (u.id !== jag.id) lista.push({ id: privat(jag.id, u.id), namn: u.namn, under: u.titel, u: u }); });
    return lista;
  }
  var iKanal = function (k) { return chatt().meddelanden.filter(function (m) { return m.kanal === k; }); };
  function senastLast(k) { var l = chatt().last[IH.jag().id]; return (l && l[k]) || ''; }
  function olasta(k) {
    var jag = IH.jag().id, last = senastLast(k);
    return iKanal(k).filter(function (m) { return m.av !== jag && m.tid > last; }).length;
  }
  IH.chattOlasta = function () { return kanaler().reduce(function (t, k) { return t + olasta(k.id); }, 0); };
  function markeraLast(k) {
    var c = chatt(), jag = IH.jag().id, m = iKanal(k), sista = m.length ? m[m.length - 1].tid : '';
    c.last[jag] = c.last[jag] || {};
    if (sista && c.last[jag][k] !== sista) { c.last[jag][k] = sista; IH.spara(); IH.uppdateraMeny(); }
  }

  /* 02 Text: radbrytningar, länkar och #-kort ---------------------------------------------------- */
  var URL_RE = /(https?:\/\/[^\s<]+)/g;
  function textHtml(t) {
    return String(t || '').split(/(\[\[(?:kund|affar):[a-z0-9]+\]\])/).map(function (bit) {
      var m = /^\[\[(kund|affar):([a-z0-9]+)\]\]$/.exec(bit);
      if (m) {
        if (m[1] === 'kund') { var k = IH.kund(m[2]); return k ? '<a class="ch-obj" href="#/kunder/' + k.id + '">' + i('kunder') + e(k.namn) + '</a>' : ''; }
        var a = IH.affar(m[2]); return a ? '<a class="ch-obj" href="#/salj/' + a.id + '">' + i('tavla') + e(a.titel) + '</a>' : '';
      }
      return e(bit).replace(URL_RE, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
    }).join('');
  }
  // "#Kundnamn" skrivet för hand blir en länk när namnet finns
  function medLankar(t) {
    var namn = db().kunder.map(function (k) { return ['kund', k.id, k.namn]; }).concat(db().affarer.map(function (a) { return ['affar', a.id, a.titel]; }))
      .sort(function (x, y) { return y[2].length - x[2].length; });
    namn.forEach(function (n) { t = t.split('#' + n[2]).join('[[' + n[0] + ':' + n[1] + ']]'); });
    return t;
  }
  var klartext = function (t) { return String(t || '').replace(/\[\[(kund|affar):([a-z0-9]+)\]\]/g, function (x, typ, id) { var o = typ === 'kund' ? IH.kund(id) : IH.affar(id); return o ? '#' + (o.namn || o.titel) : ''; }); };

  /* 03 Vyn #/chatt[/kanal] ------------------------------------------------------------------------ */
  var valdKanal = null;
  IH.vyer.chatt = function (del) {
    var jag = IH.jag(), lista = kanaler();
    var k = lista.filter(function (x) { return x.id === del[0]; })[0] || lista.filter(function (x) { return x.id === valdKanal; })[0] || lista[0];
    valdKanal = k.id;
    var forraLast = senastLast(k.id);
    var avatar = function (u, liten) { return '<span class="avatar' + (liten ? ' avatar--liten' : '') + '" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(u.id) : '') + '</span>'; };
    var samtal = lista.map(function (x) {
      var m = iKanal(x.id), sista = m[m.length - 1], n = x.id === k.id ? 0 : olasta(x.id); // det öppna samtalet blir läst nu
      return '<a class="ch-samtal' + (x.id === k.id ? ' vald' : '') + '" href="#/chatt/' + x.id + '"' + (x.id === k.id ? ' aria-current="page"' : '') + '>' +
        (x.team ? '<span class="avatar ch-team">' + IH.emo('kunder') + '</span>' : avatar(x.u)) +
        '<span class="ch-samtal__text"><b>' + e(x.namn) + '</b><small>' + (sista ? e((sista.av === jag.id ? 'Du: ' : '') + klartext(sista.text)) : e(x.under)) + '</small></span>' +
        '<span class="ch-samtal__hoger">' + (sista ? '<small>' + tidKort(sista.tid) + '</small>' : '') + (n ? '<i class="ch-olast">' + n + '</i>' : '') + '</span></a>';
    }).join('');
    var msg = iKanal(k.id), forraDag = '', nyLinje = false, forraAv = null, forraTid = 0;
    var trad = msg.length ? msg.map(function (m) {
      var u = IH.anvandare(m.av) || { namn: 'Okänd', farg: '#ccc', id: '' }, egen = m.av === jag.id;
      var dag = new Date(m.tid).toDateString(), h = '';
      if (dag !== forraDag) { h += '<p class="ch-dag"><span>' + dagRubrik(m.tid) + '</span></p>'; forraDag = dag; forraAv = null; }
      if (!nyLinje && !egen && m.tid > forraLast && forraLast) { h += '<p class="ch-ny"><span>Nya meddelanden</span></p>'; nyLinje = true; forraAv = null; }
      var fortsatt = forraAv === m.av && new Date(m.tid) - forraTid < 5 * 60000;
      forraAv = m.av; forraTid = new Date(m.tid);
      return h + '<div class="ch-msg' + (egen ? ' ch-msg--egen' : '') + (fortsatt ? ' ch-msg--fortsatt' : '') + '" data-id="' + m.id + '">' +
        (egen || fortsatt ? '' : avatar(u, true)) + '<div class="ch-bubbla">' + (egen || fortsatt ? '' : '<b class="ch-namn">' + e(u.namn) + '</b>') +
        '<div class="ch-text">' + textHtml(m.text) + '</div><small class="ch-tid">' + klocka(m.tid) + '</small></div></div>';
    }).join('') : '<div class="ch-tomt">' + IH.emo('prat', 'ch-tomt__ikon') + '<b>Inga meddelanden än</b><p>Skriv det första – ' + (k.team ? 'alla i teamet ser det.' : 'bara ni två ser samtalet.') + '</p></div>';
    var html = '<h1 class="dold">Meddelanden</h1><div class="ch kort" data-in>' +
      '<aside class="ch-lista"><header><h2>Meddelanden</h2></header><nav aria-label="Samtal">' + samtal + '</nav></aside>' +
      '<section class="ch-tradyta" aria-label="' + e(k.namn) + '">' +
        '<header class="ch-topp">' + (k.team ? '<span class="avatar ch-team">' + IH.emo('kunder') + '</span>' : avatar(k.u)) +
          '<div><b>' + e(k.namn) + '</b><small>' + (k.team ? IH.ANVANDARE.map(function (u) { return u.namn.split(' ')[0]; }).join(', ') : (IH.narvaro ? e(IH.narvaro(k.u.id).namn) + ' · ' : '') + e(k.under)) + '</small></div>' +
          (k.u ? '<a class="knapp knapp--liten" href="#/profil/' + k.u.id + '">' + i('kunder') + 'Profil</a>' : '') + '</header>' +
        '<div class="ch-trad" data-ch-trad>' + trad + '</div>' +
        '<form class="ch-skriv" data-ch-skriv data-kanal="' + k.id + '"><textarea name="text" rows="1" placeholder="Skriv till ' + e(k.team ? 'hela teamet' : k.namn.split(' ')[0]) + '… (#kund eller #affär länkar)" aria-label="Meddelande"></textarea>' +
          '<button class="knapp knapp--virke" type="submit" aria-label="Skicka">' + i('pil') + '</button></form>' +
        '<p class="ch-tips">Enter skickar · Shift + Enter ny rad · #Kundnamn blir en länk</p>' +
      '</section></div>';
    return { titel: 'Meddelanden', html: html, efter: function (rot) {
      var t = rot.querySelector('[data-ch-trad]');
      if (t) { var ny = t.querySelector('.ch-ny'); t.scrollTop = ny ? ny.offsetTop - 60 : t.scrollHeight; }
      markeraLast(k.id);
      var f = rot.querySelector('[data-ch-skriv] textarea'); if (f && matchMedia('(min-width: 860px)').matches) f.focus({ preventScroll: true });
    } };
  };
  function klocka(iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  // Kalenderdagar, inte timmar: något från i går kväll är "I går" även om det är mindre än ett dygn sedan
  function dagarBak(iso) { var a = new Date(iso), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }
  function dagRubrik(iso) { var n = dagarBak(iso); return n === 0 ? 'I dag' : n === 1 ? 'I går' : IH.datum(iso); }
  function tidKort(iso) { return dagarBak(iso) === 0 ? klocka(iso) : dagRubrik(iso); }

  /* 04 Skicka ------------------------------------------------------------------------------------ */
  function skicka(form) {
    var ruta = form.querySelector('textarea'), text = ruta.value.trim();
    if (!text) return;
    var c = chatt();
    c.meddelanden.push({ id: 'm' + Date.now().toString(36), kanal: form.getAttribute('data-kanal'), av: IH.jag().id, tid: new Date().toISOString(), text: medLankar(text).slice(0, 4000) });
    IH.spara();
    ruta.value = '';
    IH.rita();
  }
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-ch-skriv]'); if (!f) return;
    ev.preventDefault(); skicka(f);
  });
  document.addEventListener('keydown', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-ch-skriv]'); if (!f || ev.target.tagName !== 'TEXTAREA') return;
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); skicka(f); }
  });
  // Skrivrutan växer med texten (högst sex rader)
  document.addEventListener('input', function (ev) {
    if (!(ev.target.closest && ev.target.closest('[data-ch-skriv]')) || ev.target.tagName !== 'TEXTAREA') return;
    var r = ev.target; r.style.height = 'auto'; r.style.height = Math.min(r.scrollHeight, 150) + 'px';
  });
})();
