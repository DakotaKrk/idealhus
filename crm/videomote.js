/* ============================================================
   Legohus CRM – videomöten: data, bokning, inbjudan och sidan #/videomote[/id] (2026-10-29).
   Bokningen skapar ett videomöte i IH.db.videomoten, en kalenderaktivitet (typ 'mote', fältet video) och en
   påminnelse under Att göra (kalAkt). Inbjudan: länk till gästsidan mote-gast.html (allt i #, skickas aldrig till
   servern), mejl via mailto (öppnar mejlprogrammet – inget skickas automatiskt) och kalenderfil (.ics).
   Själva mötet (kamera, väntrum, skärmdelning) sköts av samtal.js (motorn) och samtal-ui.js (lagret .vm);
   den här filen anropar bara IH.samtalUi.oppna och IH.samtalUi.vidSlut och lyssnar på händelsen ih-videomote.
   Prototyp: videomötet fungerar mellan flikar i samma webbläsare. Mötena är direktsamtal (P2P, alla till alla,
   högst fyra personer); mellan datorer behövs bara en liten signalväxel (WebSocket) och TURN som reserv – se KUNSKAP.md.
   ============================================================ */
(function () {
  'use strict';
  var IH = window.IH;
  if (!IH || !IH.G) return;
  var e = IH.e, i = IH.i, G = IH.G;
  var ARLIG = 'Prototyp – videomötet fungerar mellan flikar i den här webbläsaren.';
  var LANGDER = [15, 30, 45, 60];
  var MAX = 4; // direktsamtal (mesh): högst fyra personer

  /* --- Ikon: videokameran ur samtal-ui.js ikonblad, annars en egen ritad ------------------- */
  IH.vmIk = function (namn, klass) {
    namn = namn || 'vm-kam';
    var attr = ' viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">';
    if (document.getElementById(namn)) return '<svg class="i' + (klass ? ' ' + klass : '') + '"' + attr + '<use href="#' + namn + '"/></svg>';
    return '<svg class="i' + (klass ? ' ' + klass : '') + '"' + attr + '<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/></svg>';
  };

  /* --- Data -------------------------------------------------------------------------------- */
  function lista() {
    var d = IH.db;
    if (!Array.isArray(d.videomoten)) d.videomoten = [];
    if (!d.lopnr || typeof d.lopnr !== 'object') d.lopnr = {};
    // Löpnumret följer de möten som finns (äldre data eller import utan lopnr.videomote)
    var hogst = d.videomoten.reduce(function (m, x) { var n = parseInt(String(x && x.id).replace(/^\D+/, ''), 10); return isFinite(n) && n > m ? n : m; }, 0);
    if (!(+d.lopnr.videomote >= hogst)) d.lopnr.videomote = hogst;
    return d.videomoten;
  }
  lista();
  var BOKSTAVER = 'abcdefghjkmnpqrstuvwxyz';
  function rumskod() {
    var b = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(b);
    var s = Array.prototype.map.call(b, function (x) { return BOKSTAVER.charAt(x % BOKSTAVER.length); }).join('');
    return s.slice(0, 3) + '-' + s.slice(3, 7) + '-' + s.slice(7);
  }
  function hamta(id) {
    if (!id) return null;
    return lista().filter(function (v) { return v.id === id || v.rum === id; })[0] || null;
  }
  function aktivitet(id) { return (IH.db.aktiviteter || []).filter(function (h) { return h.id === id; })[0] || null; }
  function forAktivitet(aktId) {
    var h = aktivitet(aktId);
    return h && h.video ? hamta(h.video) : lista().filter(function (v) { return v.aktivitet === aktId; })[0] || null;
  }
  var slut = function (v) { return new Date(new Date(v.start).getTime() + (v.langd || 30) * 6e4); };
  var kl = function (d) { return IH.lokal(d, 't', { hour: '2-digit', minute: '2-digit' }).replace(':', '.'); };
  var kortDag = function (d) { return IH.lokal(d, 'd', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''); };
  var langDag = function (d) { return IH.lokal(d, 'd', { weekday: 'long', day: 'numeric', month: 'long' }); };
  function narText(v) { var s = new Date(v.start); return kortDag(s) + ' kl. ' + kl(s) + '–' + kl(slut(v)); }
  var fornamn = function (n) { return String(n || '').trim().split(/\s+/)[0] || ''; };
  function vardNamn(v) { var u = IH.anvandare(v.vard); return u ? u.namn : 'Legohus'; }
  function deltagarNamn(d) {
    if (d.typ === 'kollega') { var u = IH.anvandare(d.id); return u ? u.namn : 'Kollega'; }
    return d.namn || 'Gäst';
  }
  // Pågår: från 10 minuter före start till längden efter (eller tills någon avslutat det)
  function lage(v) {
    if (v.status === 'avslutat') return 'avslutat';
    var nu = Date.now(), s = new Date(v.start).getTime();
    if (v.status === 'pagar' && nu < slut(v).getTime() + 2 * 36e5) return 'pagar';
    if (nu >= s - 10 * 6e4 && nu <= slut(v).getTime()) return 'nu';
    return nu > slut(v).getTime() ? 'passerat' : 'kommande';
  }

  function skapa(opt) {
    var jag = IH.jag(), id = IH.nyttId('videomote', 'v'), start = new Date(opt.start || Date.now());
    var v = {
      id: id, rum: rumskod(), titel: String(opt.titel || 'Videomöte').slice(0, 120), start: start.toISOString(),
      langd: LANGDER.indexOf(+opt.langd) >= 0 ? +opt.langd : 30, vard: opt.vard || jag.id,
      kund: opt.kund || null, affar: opt.affar || null, kanal: opt.kanal || null, aktivitet: null,
      deltagare: (opt.deltagare || []).slice(0, 8), vantrum: opt.vantrum !== false, direkt: opt.direkt === 'jag' ? 'jag' : 'foretag',
      status: 'bokat', borjade: null, slutade: null, minuter: 0, narvarande: [], chatt: [], anteckning: '', skapad: new Date().toISOString()
    };
    var aid = IH.nyttId('aktivitet', 'h');
    IH.db.aktiviteter.push({ id: aid, tid: v.start, typ: 'mote', text: v.titel, kund: v.kund, affar: v.affar, av: v.vard, video: id });
    v.aktivitet = aid;
    if (start > new Date() && !opt.utanPaminnelse) IH.db.uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: 'Möte: ' + v.titel, forfaller: v.start, klar: false, kund: v.kund, affar: v.affar, ansvarig: v.vard, av: jag.id, kalAkt: aid });
    lista().push(v);
    IH.spara();
    if (IH.uppdateraMeny) IH.uppdateraMeny();
    return v;
  }
  function skapaDirekt(opt) {
    var jag = IH.jag();
    var v = skapa({ titel: opt.titel || 'Videomöte med ' + (opt.kollegor || []).map(function (id) { return fornamn((IH.anvandare(id) || {}).namn); }).filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' och $1'),
      start: new Date(), langd: 30, kanal: opt.kanal || null, vard: jag.id, vantrum: true, direkt: 'foretag', utanPaminnelse: true,
      deltagare: (opt.kollegor || []).filter(function (id) { return id !== jag.id; }).map(function (id) { return { typ: 'kollega', id: id }; }) });
    return v;
  }
  // Ändrat i kalendern: videomötet följer med (anropas från ledning.js)
  function foljAktivitet(h) {
    var v = h && h.video && hamta(h.video); if (!v) return;
    v.start = h.tid; v.titel = h.text; v.kund = h.kund || null; v.vard = h.av || v.vard;
  }
  function taBortForAktivitet(h) {
    if (!h || !h.video) return;
    IH.db.videomoten = lista().filter(function (v) { return v.id !== h.video; });
  }

  /* --- Länkar och inbjudan --------------------------------------------------------------- */
  function lank(id, gast) {
    var v = hamta(id); if (!v) return '';
    if (!gast) return new URL('index.html#/videomote/' + encodeURIComponent(v.id), location.href).href;
    var p = [['m', v.rum], ['n', gast.namn || ''], ['t', v.titel], ['v', vardNamn(v)], ['s', v.start], ['l', String(v.langd)]]
      .filter(function (x) { return x[1]; }).map(function (x) { return x[0] + '=' + encodeURIComponent(String(x[1]).slice(0, 120)); }).join('&');
    return new URL('mote-gast.html#' + p, location.href).href;
  }
  var gastLank = function (v) { return lank(v.id, { namn: '' }); };
  function inbjudningstext(id, d) {
    var v = hamta(id); if (!v) return '';
    d = d || { typ: 'gast', namn: '' };
    var s = new Date(v.start), kollega = d.typ === 'kollega', namn = fornamn(deltagarNamn(d));
    var rader = [
      'Hej' + (namn && namn !== 'Gäst' ? ' ' + namn : '') + '!', '',
      kollega ? 'Välkommen till videomötet ' + v.titel + '.' : 'Välkommen till vårt videomöte' + (v.kund ? ' om ditt hus' : '') + '.', '',
      'När: ' + langDag(s) + ' kl. ' + kl(s) + '–' + kl(slut(v)),
      'Länk: ' + (kollega ? lank(v.id) : lank(v.id, { namn: d.namn || '' })), ''
    ];
    if (kollega) rader.push('Öppna länken när det är dags – du går direkt in i mötet.');
    else rader.push('Så går det till:',
      '1. Öppna länken i Chrome, Edge eller Safari, på dator eller mobil. Du behöver inget konto eller program.',
      '2. Skriv ditt namn och prova kamera och mikrofon.',
      v.vantrum ? '3. Klicka på Be att få gå med – jag släpper in dig.' : '3. Klicka på Gå med.');
    rader.push('', kollega ? 'Vi ses!' : 'Hör av dig om tiden inte passar.', '', 'Hälsningar', vardNamn(v), 'Legohus');
    return rader.join('\r\n');
  }
  function amne(v) { var s = new Date(v.start); return 'Videomöte med Legohus – ' + kortDag(s) + ' kl. ' + kl(s); }
  function mailto(id, d) {
    var v = hamta(id); if (!v) return 'mailto:';
    var till = d && d.typ === 'kollega' ? '' : d && d.epost ? d.epost : '';
    return 'mailto:' + encodeURIComponent(till).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(d && d.typ === 'kollega' ? 'Videomöte: ' + v.titel : amne(v)) + '&body=' + encodeURIComponent(inbjudningstext(id, d));
  }
  function ics(id) {
    var v = hamta(id); if (!v) return;
    var p2 = function (x) { return String(x).padStart(2, '0'); };
    var f = function (d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + '00Z'; };
    var esc = function (t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\r\n|\r|\n/g, '\\n'); };
    var l = gastLank(v);
    var rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Legohus//CRM//SV', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + v.rum + '@legohus-crm', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(new Date(v.start)), 'DTEND:' + f(slut(v)),
      'SUMMARY:' + esc(v.titel), 'LOCATION:' + esc('Videomöte – ' + l), 'URL:' + l,
      'DESCRIPTION:' + esc('Videomöte med ' + vardNamn(v) + ', Legohus.\n\nLänk: ' + l + '\n\nÖppna länken i Chrome, Edge eller Safari. Du behöver inget konto eller program.')];
    v.deltagare.forEach(function (d) { if (d.typ === 'gast' && d.epost && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.epost)) rader.push('ATTENDEE;CN=' + esc(d.namn || d.epost) + ';RSVP=TRUE:mailto:' + d.epost); });
    rader.push('BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(v.titel), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    var vik = IH.icsVik || function (r) { return r; };
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([rader.map(vik).join('\r\n')], { type: 'text/calendar' }));
    a.href = url; a.download = 'videomote-' + IH.dagStr(new Date(v.start)) + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function kopiera(text, rubrik) {
    var klar = function () { IH.toast(rubrik, null, 'bock'); };
    var reserv = function () {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; } t.remove();
      if (ok) klar(); else IH.toast('Det gick inte att kopiera', 'Markera texten och kopiera den själv.', 'varning');
    };
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(klar, reserv); else reserv(); } catch (x) { reserv(); }
  }

  function motesInfo(id) {
    var v = hamta(id); if (!v) return null;
    var k = v.kund && IH.kund(v.kund);
    return { id: v.id, rum: v.rum, titel: v.titel, start: v.start, langd: v.langd, vardNamn: vardNamn(v), vard: v.vard,
      vantrum: v.vantrum, direkt: v.direkt, deltagare: v.deltagare.map(function (d) { return { namn: deltagarNamn(d), typ: d.typ }; }),
      kund: k ? { id: k.id, namn: k.namn } : null, lank: gastLank(v) };
  }
  function markeraPagar(id) {
    var v = hamta(id); if (!v || v.status === 'avslutat') return;
    if (v.status !== 'pagar') { v.status = 'pagar'; v.borjade = v.borjade || new Date().toISOString(); IH.spara(); }
  }
  function sparaSammanfattning(v, s) {
    if (!s) return;
    if (s.borjade && (!v.borjade || s.borjade < v.borjade)) v.borjade = s.borjade;
    if (s.slutade) v.slutade = s.slutade;
    if (+s.minuter > (v.minuter || 0)) v.minuter = Math.round(+s.minuter);
    (s.narvarande || []).forEach(function (n) {
      if (n && n.namn && !v.narvarande.some(function (x) { return x.namn === n.namn; })) v.narvarande.push({ namn: String(n.namn).slice(0, 60), roll: String(n.roll || '').slice(0, 20) });
    });
  }
  function sparaAvslut(id, d) {
    var v = hamta(id); if (!v) return;
    d = d || {};
    var s = d.sammanfattning || {};
    sparaSammanfattning(v, s);
    v.status = 'avslutat';
    v.slutade = v.slutade || new Date().toISOString();
    var min = Math.max(1, v.minuter || Math.round((new Date(v.slutade) - new Date(v.borjade || v.start)) / 6e4) || 1);
    v.minuter = min;
    v.anteckning = String(d.anteckning || '').trim().slice(0, 2000);
    if (d.sparaChatt && Array.isArray(s.chatt)) v.chatt = s.chatt.slice(-200).map(function (m) { return { namn: String(m.namn || '').slice(0, 60), text: String(m.text || '').slice(0, 2000), tid: m.tid || null }; });
    var jag = IH.jag();
    // Den bokade aktiviteten blir mötets post i historiken och kalendern (ingen dubbelpost); saknas den loggas en ny
    var text = 'Videomöte (' + min + ' min)' + (v.anteckning ? ': ' + v.anteckning : ' – ' + v.titel);
    var bokad = aktivitet(v.aktivitet);
    if (bokad) { bokad.text = text.slice(0, 2000); bokad.typ = 'mote'; bokad.video = v.id; if (v.borjade) bokad.tid = v.borjade; }
    else { IH.logga('mote', text, v.kund, v.affar); var logg = IH.db.aktiviteter[IH.db.aktiviteter.length - 1]; if (logg) { logg.video = v.id; v.aktivitet = logg.id; } }
    // Påminnelsen under Att göra är gjord
    IH.db.uppgifter.forEach(function (u) { if (u.kalAkt && u.kalAkt === v.aktivitet && !u.klar) { u.klar = true; u.klarTid = new Date().toISOString(); } });
    var ny = null;
    if (d.uppgift && String(d.uppgift.text || '').trim()) {
      var dag = d.uppgift.datum && /^\d{4}-\d{2}-\d{2}$/.test(d.uppgift.datum) ? new Date(d.uppgift.datum + 'T09:00:00') : new Date(Date.now() + 2 * 864e5);
      ny = { id: IH.nyttId('uppgift', 'u'), text: String(d.uppgift.text).trim().slice(0, 120), forfaller: dag.toISOString(), klar: false, kund: v.kund, affar: v.affar, ansvarig: jag.id, av: jag.id };
      IH.db.uppgifter.push(ny);
    }
    IH.spara();
    if (IH.uppdateraMeny) IH.uppdateraMeny();
    IH.rita();
    var k = v.kund && IH.kund(v.kund);
    IH.toast('Mötet är sparat', (k ? k.namn : v.titel) + (ny ? ' · nästa steg: ' + ny.text : ''), 'bock', k ? { lank: '#/kunder/' + k.id, knapp: 'Visa kunden' } : undefined);
  }

  /* --- Starta mötet ------------------------------------------------------------------------ */
  function jagInfo() { var u = IH.jag(); return { id: u.id, namn: u.namn, initialer: IH.initialer(u.namn) }; }
  function anslut(id) {
    var v = hamta(id);
    if (!v) { IH.toast('Videomötet finns inte längre', 'Det kan ha tagits bort i kalendern.', 'varning'); return; }
    if (v.status === 'avslutat') { IH.toast('Mötet är redan avslutat', v.titel + ' · ' + narText(v), 'info'); return; }
    if (!IH.samtalUi || !IH.samtalUi.oppna) { IH.toast('Videomötet kunde inte startas', 'Videomodulen är inte laddad – ladda om sidan.', 'varning'); return; }
    if (IH.stangArk) IH.stangArk(true);
    IH.samtalUi.oppna({ mote: motesInfo(v.id), roll: v.vard === IH.jag().id ? 'vard' : 'kollega', jag: jagInfo() });
  }
  // Mötet tar slut: det som hänt sparas på mötet även om man hoppar över anteckningen
  function kopplaUi() {
    if (!IH.samtalUi || !IH.samtalUi.vidSlut || kopplaUi.klar) return;
    kopplaUi.klar = true;
    IH.samtalUi.vidSlut(function (s, mote) {
      var v = mote && hamta(mote.id); if (!v) return;
      sparaSammanfattning(v, s);
      if (v.vard === IH.jag().id || (s && /avslut|alla/.test(String(s.orsak || '')))) {
        if (v.status !== 'avslutat') v.status = 'avslutat';
        v.slutade = v.slutade || (s && s.slutade) || new Date().toISOString();
        // Även om anteckningen hoppas över syns mötet i historiken med sin längd (sparaAvslut skriver över med anteckningen)
        var h = aktivitet(v.aktivitet);
        if (h && v.minuter && !/^Videomöte \(/.test(h.text || '')) { h.text = 'Videomöte (' + v.minuter + ' min) – ' + v.titel; if (v.borjade) h.tid = v.borjade; }
        IH.db.uppgifter.forEach(function (u) { if (u.kalAkt && u.kalAkt === v.aktivitet && !u.klar) { u.klar = true; u.klarTid = new Date().toISOString(); } });
      }
      IH.spara();
      if (IH.uppdateraMeny) IH.uppdateraMeny();
    });
  }
  kopplaUi();
  document.addEventListener('DOMContentLoaded', kopplaUi);
  document.addEventListener('ih-videomote', function (ev) {
    var d = ev.detail || {}; kopplaUi();
    if (d.fas === 'mote' && d.id) markeraPagar(d.id);
  });

  /* --- Boka-arket ------------------------------------------------------------------------- */
  function gastRad(namn, epost, med) {
    return '<div class="vm-boka__gast"><label class="vm-boka__med" title="Bjud in"><input type="checkbox" data-vm-med' + (med === false ? '' : ' checked') + ' aria-label="Bjud in"></label>' +
      '<label class="falt"><span>Namn</span><input data-vm-gnamn maxlength="60" value="' + e(namn || '') + '" placeholder="Förnamn Efternamn" autocomplete="off"></label>' +
      '<label class="falt"><span>E-post (valfritt)</span><input data-vm-gepost type="email" maxlength="120" value="' + e(epost || '') + '" placeholder="namn@exempel.se" autocomplete="off"></label>' +
      '<button type="button" class="ch-ruta vm-boka__bort" data-g="vm-gast-bort" title="Ta bort gästen" aria-label="Ta bort gästen">' + i('stang') + '</button></div>';
  }
  function bokaArk(opt) {
    opt = opt || {};
    var jag = IH.jag(), a = opt.affar && IH.affar(opt.affar), k = (opt.kund && IH.kund(opt.kund)) || (a && IH.kund(a.kund)) || null;
    var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    var ds = opt.dag || IH.dagStr(imorgon);
    var kollegor = IH.ANVANDARE.filter(function (u) { return u.id !== jag.id && u.roll !== 'admin' && !u.inaktiv; });
    var titel = 'Videomöte' + (k ? ' – ' + k.namn : '');
    var kropp = '<form id="vm-boka-form" data-vm-boka class="km-form lp-kalform vm-boka"' + (k ? ' data-kund="' + k.id + '"' : '') + (a ? ' data-affar="' + a.id + '"' : '') + ' novalidate>' +
      '<label class="falt"><span>Vad</span><input name="titel" required maxlength="120" value="' + e(titel) + '" autofocus></label>' +
      '<div class="lp-kalform__rad"><label class="falt"><span>Dag</span><input name="datum" type="date" required value="' + e(ds) + '"></label>' +
        '<label class="falt"><span>Tid</span><input name="tid" type="time" required value="' + e(opt.tid || '10:00') + '"></label></div>' +
      '<p class="vm-boka__rub" id="vm-langd-rub">Längd</p><div class="lp-kalform__typ vm-boka__langd" role="radiogroup" aria-labelledby="vm-langd-rub">' + LANGDER.map(function (m) {
        return '<label><input type="radio" name="langd" value="' + m + '"' + (m === 45 ? ' checked' : '') + '><span>' + m + ' min</span></label>'; }).join('') + '</div>' +
      '<p class="vm-boka__rub">Gäster <small>Får en länk – inget konto eller program behövs</small></p>' +
      '<div class="vm-boka__gaster" data-vm-gaster>' + (k ? gastRad(k.namn, k.epost) : '') + '</div>' +
      '<button type="button" class="knapp knapp--liten vm-boka__ny" data-g="vm-gast-ny">' + i('plus') + 'Lägg till gäst</button>' +
      (kollegor.length ? '<p class="vm-boka__rub">Kollegor <small>Går direkt in i mötet</small></p><div class="ch-valj vm-boka__kollegor">' + kollegor.map(function (u) {
        return '<label><input type="checkbox" name="kollega" value="' + u.id + '"><span class="avatar" style="background:' + u.farg + '">' + e(IH.initialer(u.namn)) + '</span><span><b>' + e(u.namn) + '</b><small>' + e(u.titel || '') + '</small></span></label>'; }).join('') + '</div>' : '') +
      '<details class="vm-boka__mer"><summary>' + i('chevron') + 'Mötesinställningar</summary>' +
        '<label class="vm-vaxel"><input type="checkbox" name="vantrum" checked><span>Gäster väntar i väntrummet</span><small>Du släpper in dem när du är redo.</small></label>' +
        '<fieldset class="vm-boka__direkt"><legend>Vem går direkt in?</legend>' +
          '<label><input type="radio" name="direkt" value="foretag" checked><span>Alla i företaget</span></label>' +
          '<label><input type="radio" name="direkt" value="jag"><span>Bara jag</span></label></fieldset></details>' +
      '<p class="vm-boka__fel" data-vm-fel role="alert" hidden></p>' +
      '<p class="vm-arlig">' + i('info') + ARLIG + '</p></form>';
    IH.oppnaArk({ titel: 'Boka videomöte', ikon: 'kalender', under: 'Kunden får en länk – inget konto eller program behövs.', kropp: kropp,
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="vm-boka-form">' + IH.vmIk() + 'Boka och bjud in</button>' });
  }
  document.addEventListener('submit', function (ev) {
    var t = ev.target; if (!t.matches || !t.matches('[data-vm-boka]')) return;
    ev.preventDefault();
    var fel = function (txt, falt) { var p = t.querySelector('[data-vm-fel]'); if (p) { p.textContent = txt; p.hidden = false; } if (falt) falt.focus(); };
    var titel = t.titel.value.trim();
    if (!titel) { fel('Skriv vad mötet gäller.', t.titel); return; }
    if (!t.datum.value) { fel('Välj en dag.', t.datum); return; }
    var start = new Date(t.datum.value + 'T' + (t.tid.value || '10:00') + ':00');
    if (isNaN(start.getTime())) { fel('Dagen eller tiden går inte att läsa.', t.datum); return; }
    var deltagare = [], felFalt = null;
    t.querySelectorAll('.vm-boka__gast').forEach(function (r) {
      var med = r.querySelector('[data-vm-med]'), n = r.querySelector('[data-vm-gnamn]'), ep = r.querySelector('[data-vm-gepost]');
      var namn = n.value.trim().slice(0, 60), epost = ep.value.trim().slice(0, 120);
      if (!med.checked || (!namn && !epost)) return;
      if (epost && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost)) { felFalt = felFalt || ep; return; }
      deltagare.push({ typ: 'gast', namn: namn || epost.split('@')[0], epost: epost, kund: t.getAttribute('data-kund') || null });
    });
    if (felFalt) { fel('E-postadressen ser inte ut att stämma – rätta den eller lämna fältet tomt.', felFalt); return; }
    t.querySelectorAll('input[name=kollega]:checked').forEach(function (c) { deltagare.push({ typ: 'kollega', id: c.value }); });
    if (deltagare.length > MAX - 1) { fel('Ett videomöte rymmer ' + MAX + ' personer – du och ' + (MAX - 1) + ' till. Ta bort någon.'); return; }
    if (!deltagare.length) { fel('Bjud in minst en gäst eller kollega.', t.querySelector('[data-vm-gnamn]') || t.querySelector('[data-g="vm-gast-ny"]')); return; }
    var langd = +(t.querySelector('input[name=langd]:checked') || { value: 45 }).value;
    var v = skapa({ titel: titel, start: start, langd: langd, kund: t.getAttribute('data-kund') || null, affar: t.getAttribute('data-affar') || null,
      deltagare: deltagare, vantrum: t.vantrum.checked, direkt: (t.querySelector('input[name=direkt]:checked') || { value: 'foretag' }).value });
    IH.logga('system', 'Videomöte bokat: ' + v.titel + ' ' + narText(v), v.kund, v.affar);
    IH.spara();
    IH.rita();
    inbjudanArk(v.id, true);
  });
  G['vm-gast-ny'] = function (el) {
    var f = el.closest('form'), yta = f && f.querySelector('[data-vm-gaster]'); if (!yta) return;
    if (yta.children.length >= MAX - 1) { IH.toast('Ett videomöte rymmer ' + MAX + ' personer', 'Du och ' + (MAX - 1) + ' till – mötet är ett direktsamtal mellan datorerna.', 'info'); return; }
    yta.insertAdjacentHTML('beforeend', gastRad('', ''));
    var n = yta.lastElementChild.querySelector('[data-vm-gnamn]'); if (n) n.focus();
  };
  G['vm-gast-bort'] = function (el) {
    var r = el.closest('.vm-boka__gast'), f = el.closest('form'); if (!r) return;
    r.remove();
    var nasta = f && (f.querySelector('[data-vm-gnamn]') || f.querySelector('[data-g="vm-gast-ny"]')); if (nasta) nasta.focus();
  };

  /* --- Inbjudan-arket --------------------------------------------------------------------- */
  function inbjudanHtml(v) {
    var l = gastLank(v);
    return '<div class="vm-inbjudan">' +
      '<label class="falt vm-inbjudan__lank"><span>Möteslänk</span><span class="vm-inbjudan__rad"><input readonly value="' + e(l) + '" aria-label="Möteslänk" data-vm-lankfalt>' +
        '<button type="button" class="knapp knapp--liten" data-g="vm-kopiera-lank" data-id="' + v.id + '">' + i('kopiera') + 'Kopiera länk</button></span></label>' +
      (v.deltagare.length ? '<ul class="vm-inbjudan__lista">' + v.deltagare.map(function (d, n) {
        var namn = deltagarNamn(d), u = d.typ === 'kollega' && IH.anvandare(d.id);
        return '<li><span class="avatar"' + (u ? ' style="background:' + u.farg + '"' : '') + '>' + e(IH.initialer(namn)) + '</span><span class="vm-inbjudan__vem"><b>' + e(namn) + '</b><small>' + (d.typ === 'kollega' ? 'Kollega · går direkt in' : 'Gäst' + (d.epost ? ' · ' + e(d.epost) : '')) + '</small></span>' +
          '<button type="button" class="knapp knapp--liten" data-g="vm-mejla" data-id="' + v.id + '" data-vem="' + n + '">' + i('post') + 'Skicka inbjudan</button></li>';
      }).join('') + '</ul>' : '<p class="vm-inbjudan__tom">Ingen är inbjuden än – kopiera länken och skicka den själv.</p>') +
      '<div class="vm-inbjudan__knappar"><button type="button" class="knapp knapp--liten" data-g="vm-ics" data-id="' + v.id + '">' + i('kalender') + 'Ladda ner kalenderfil</button>' +
        '<button type="button" class="knapp knapp--liten" data-g="vm-kopiera-text" data-id="' + v.id + '">' + i('kopiera') + 'Kopiera inbjudningstext</button></div>' +
      '<p class="vm-arlig">' + i('info') + ARLIG + '</p></div>';
  }
  function inbjudanArk(id, ny) {
    var v = hamta(id); if (!v) return;
    IH.oppnaArk({ titel: ny ? 'Inbjudan är klar' : 'Inbjudan', ikon: 'bock', under: 'Videomöte · ' + e(narText(v)), kropp: inbjudanHtml(v),
      fot: '<button class="knapp" type="button" data-g="stang-ark">Klar</button><button class="knapp knapp--virke" type="button" data-g="vm-anslut" data-id="' + v.id + '">' + IH.vmIk() + 'Anslut nu</button>' });
    if (ny) IH.toast('Videomötet är bokat', v.titel + ' · ' + narText(v), 'kalender');
  }

  /* --- Klick ------------------------------------------------------------------------------ */
  G['vm-boka'] = function (el) {
    bokaArk({ kund: el.getAttribute('data-kund'), affar: el.getAttribute('data-affar'), dag: el.getAttribute('data-dag') });
  };
  G['vm-anslut'] = function (el) { anslut(el.getAttribute('data-id')); };
  G['vm-inbjudan'] = function (el) { inbjudanArk(el.getAttribute('data-id')); };
  G['vm-kopiera-lank'] = function (el) { var v = hamta(el.getAttribute('data-id')); if (v) kopiera(gastLank(v), 'Länken är kopierad'); };
  G['vm-kopiera-text'] = function (el) { var v = hamta(el.getAttribute('data-id')); if (v) kopiera(inbjudningstext(v.id, { typ: 'gast', namn: '' }), 'Inbjudningstexten är kopierad'); };
  G['vm-mejla'] = function (el) {
    var v = hamta(el.getAttribute('data-id')); if (!v) return;
    var d = v.deltagare[+el.getAttribute('data-vem')]; if (!d) return;
    location.href = mailto(v.id, d);
    IH.toast('Mejlet är öppnat i ditt mejlprogram', 'Inget skickas förrän du klickar på Skicka där.', 'post');
  };
  G['vm-ics'] = function (el) { var v = hamta(el.getAttribute('data-id')); if (!v) return; ics(v.id); IH.toast('Kalenderfilen är nedladdad', 'Öppna den för att lägga mötet i din kalender.', 'kalender'); };
  G['vm-chatt-starta'] = function (el) {
    if (IH.visarSom && IH.visarSom()) { IH.toast('Videomöten startas inte i supportläget', 'Lämna supportläget och starta från ditt eget konto.', 'oga-av'); return; }
    var kid = el.getAttribute('data-kanal'), med = IH.chattMedlemmar ? IH.chattMedlemmar(kid) : [];
    var v = skapaDirekt({ kanal: kid, kollegor: med });
    if (IH.chattVideomote) IH.chattVideomote(kid, v.id);
    anslut(v.id);
  };

  /* --- Sidan #/videomote[/id] -------------------------------------------------------------- */
  var LAGE_TEXT = { pagar: 'Pågår', nu: 'Börjar snart', kommande: 'Bokat', passerat: 'Tiden har passerat', avslutat: 'Avslutat' };
  function rad(v) {
    var s = new Date(v.start), k = v.kund && IH.kund(v.kund), l = lage(v);
    return '<li class="vm-lista__rad" data-lage="' + l + '"><span class="vm-lista__datum"><b>' + s.getDate() + '</b><small>' + e(IH.lokal(s, 'd', { month: 'short' }).replace(/\./g, '')) + '</small></span>' +
      '<a class="vm-lista__text" href="#/videomote/' + e(v.id) + '"><b>' + e(v.titel) + '</b><small>' + e(kl(s) + '–' + kl(slut(v))) + (k ? ' · ' + e(k.namn) : '') + ' · ' + e(LAGE_TEXT[l]) + (l === 'avslutat' && v.minuter ? ' · ' + v.minuter + ' min' : '') + '</small></a>' +
      (l === 'avslutat' || l === 'passerat' ? '' : '<button type="button" class="knapp knapp--liten' + (l === 'nu' || l === 'pagar' ? ' knapp--virke' : '') + '" data-g="vm-anslut" data-id="' + v.id + '">' + IH.vmIk() + 'Anslut</button>') + '</li>';
  }
  function synligFor(v) { var j = IH.jag(); return j.roll === 'admin' || j.chef || v.vard === j.id || v.deltagare.some(function (d) { return d.typ === 'kollega' && d.id === j.id; }); }
  function sida(v) {
    var k = v.kund && IH.kund(v.kund), a = v.affar && IH.affar(v.affar), l = lage(v), u = IH.anvandare(v.vard);
    var fakta = '<dl class="vm-fakta"><div><dt>När</dt><dd>' + e(langDag(new Date(v.start)).replace(/^./, function (c) { return c.toUpperCase(); }) + ' kl. ' + kl(new Date(v.start)) + '–' + kl(slut(v))) + '</dd></div>' +
      '<div><dt>Värd</dt><dd>' + e(u ? u.namn : '–') + '</dd></div>' +
      (k ? '<div><dt>Kund</dt><dd><a href="#/kunder/' + k.id + '">' + e(k.namn) + '</a></dd></div>' : '') +
      (a ? '<div><dt>Affär</dt><dd><a href="#/salj/' + a.id + '">' + e(a.titel) + '</a></dd></div>' : '') +
      '<div><dt>Väntrum</dt><dd>' + (v.vantrum ? 'Gäster väntar tills du släpper in dem' : 'Av – gäster går direkt in') + '</dd></div>' +
      '<div><dt>Läge</dt><dd>' + e(LAGE_TEXT[l]) + (v.minuter ? ' · ' + v.minuter + ' min' : '') + '</dd></div></dl>';
    var efter = l === 'avslutat' ? '<section class="kort vm-sida__efter" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('anteckning') + '</span>Efter mötet</h2></header><div class="kort__kropp">' +
      (v.narvarande.length ? '<p class="vm-sida__narv"><b>Med i mötet:</b> ' + e(v.narvarande.map(function (n) { return n.namn + (n.roll === 'gast' ? ' (gäst)' : ''); }).join(', ')) + '</p>' : '') +
      (v.anteckning ? '<p class="vm-sida__ant">' + e(v.anteckning) + '</p>' : '<p class="vm-inbjudan__tom">Ingen anteckning sparades.</p>') +
      (v.chatt.length ? '<details class="vm-sida__chatt"><summary>' + i('chevron') + 'Chatten från mötet (' + v.chatt.length + ')</summary><ol>' + v.chatt.map(function (m) { return '<li><b>' + e(m.namn) + '</b> ' + e(m.text) + '</li>'; }).join('') + '</ol></details>' : '') +
      '</div></section>' : '';
    var html = '<a class="tillbaka" href="#/videomote">' + i('pilv') + 'Videomöten</a>' +
      '<section class="kort vm-sida" data-in><header class="kort__huvud"><h1 class="vm-sida__titel"><span class="kort__ikon">' + IH.vmIk() + '</span>' + e(v.titel) + '</h1>' +
        '<span class="chip vm-sida__lage" data-lage="' + l + '">' + e(LAGE_TEXT[l]) + '</span></header><div class="kort__kropp">' + fakta +
        (l === 'avslutat' ? '' : '<div class="vm-sida__knappar"><button type="button" class="knapp knapp--virke" data-g="vm-anslut" data-id="' + v.id + '">' + IH.vmIk() + 'Anslut</button></div>' + inbjudanHtml(v)) +
      '</div></section>' + efter;
    return { titel: v.titel, html: html };
  }
  var forstaAdress = location.hash, autoStartad = false;
  IH.vyer.videomote = function (del) {
    var jag = IH.jag();
    if (del[0]) {
      var v = hamta(del[0]);
      if (!v) return { titel: 'Videomöten', html: '<a class="tillbaka" href="#/videomote">' + i('pilv') + 'Videomöten</a><section class="kort" data-in><div class="kort__kropp"><p class="vm-inbjudan__tom">Videomötet finns inte – det kan ha tagits bort i kalendern.</p></div></section>' };
      var ut = sida(v);
      // Länken till en kollega (index.html#/videomote/v3) startar förhandsvisningen direkt – bara när sidan öppnades med den
      if (!autoStartad && location.hash === forstaAdress && lage(v) !== 'avslutat') {
        autoStartad = true;
        ut.efter = function () { setTimeout(function () { if (location.hash === forstaAdress) anslut(v.id); }, 400); };
      }
      return ut;
    }
    var alla = lista().filter(synligFor);
    var kommande = alla.filter(function (v) { var l = lage(v); return l !== 'avslutat' && l !== 'passerat'; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    var senaste = alla.filter(function (v) { var l = lage(v); return l === 'avslutat' || l === 'passerat'; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; }).slice(0, 10);
    var kan = jag.roll !== 'admin' || (IH.visarSom && IH.visarSom());
    var html = '<header class="sidhuvud vm-sidhuvud"><div><p class="etikett">Kundmöte</p><h1>Videomöten</h1><p class="vm-sidhuvud__under">Möten med kunder och kollegor via länk – som Teams, direkt i CRM:et.</p></div>' +
        (kan ? '<button type="button" class="knapp knapp--virke" data-g="vm-boka">' + IH.vmIk() + 'Boka videomöte</button>' : '') + '</header>' +
      (alla.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('kalender') + '</span>Kommande</h2>' + (kommande.length ? '<span class="chip">' + kommande.length + '</span>' : '') + '</header><div class="kort__kropp">' +
          (kommande.length ? '<ul class="vm-lista">' + kommande.map(rad).join('') + '</ul>' : '<p class="vm-inbjudan__tom">Inga bokade videomöten.</p>') + '</div></section>' +
        (senaste.length ? '<section class="kort" data-in><header class="kort__huvud"><h2><span class="kort__ikon">' + i('klocka') + '</span>Senaste</h2></header><div class="kort__kropp"><ul class="vm-lista">' + senaste.map(rad).join('') + '</ul></div></section>' : '')
        : '<section class="kort" data-in><div class="kort__kropp vm-tomt">' + IH.vmIk() + '<p>Inga videomöten än. Boka ett från kundsidan eller kalendern.</p>' + (kan ? '<button type="button" class="knapp knapp--virke" data-g="vm-boka">' + IH.vmIk() + 'Boka videomöte</button>' : '') + '</div></section>') +
      '<p class="vm-arlig">' + i('info') + ARLIG + '</p>';
    return { titel: 'Videomöten', html: html };
  };

  IH.videomote = {
    skapa: skapa, skapaDirekt: skapaDirekt, hamta: hamta, forAktivitet: forAktivitet, lank: lank, mailto: mailto,
    inbjudningstext: inbjudningstext, ics: ics, bokaArk: bokaArk, inbjudanArk: inbjudanArk, motesInfo: motesInfo,
    markeraPagar: markeraPagar, sparaAvslut: sparaAvslut, anslut: anslut, lage: lage, narText: narText,
    foljAktivitet: foljAktivitet, taBortForAktivitet: taBortForAktivitet, ARLIG: ARLIG
  };
})();
