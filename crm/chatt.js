/* Legohus CRM – chatten (2026-10-28, samma funktioner som Uperformance CRM:s chatt.js, i Legohus kod och färger).
   - #/chatt[/id]: samtalen (sök, Ny grupp, olästa och @-bricka), tråden och om samtalet (medlemmar, bjud in, byt namn,
     delade filer, tysta, lämna). Hela teamet + privata samtal (räknas fram) + grupper (sparas).
   - Meddelanden: datumrubriker, "Nya meddelanden", reaktioner, svara med citat, kopiera, ändra och ta bort det egna
     (med Ångra), "ändrad", "Läst" i privata samtal, bilder och filer, stora emoji när meddelandet bara är emoji.
   - Skrivrutan: @ föreslår kollegor, # föreslår kunder och affärer (pilar, Enter/Tab, Esc), emoji-panel, bifoga/dra in/klistra
     in filer (bilder skalas till JPEG), Enter skickar, Shift+Enter ny rad, ↑ i tom ruta ändrar ditt senaste, snabbsvar.
   - Flytande fönster som följer med mellan sidorna: dra i huvudet, ändra storlek i hörnet, Stör ej, helsida, minimera, stäng.
     Minimerat blir det en ikon under menyknappen (infälld meny) eller nere till höger, med olästbricka och puls; ikonen kan
     dras (högerklick lägger tillbaka den).
   - Olästa per konto i menyn och fliktiteln, mjukt pling (WebAudio) och valfri avisering på skrivbordet när fliken inte syns.
   Data i db.chatt = { kanaler, meddelanden, last, tyst } i webbläsaren; flikarna synkar via storage. Prototyp. */
(function () {
  'use strict';
  const IH = window.IH;
  const e = IH.e, i = IH.i, ik = (n) => IH.emo(n);
  // "Öppna i eget fönster": en ruta med pil ut (inte helskärmens inåtpekande hörn, som läses som förminska)
  const popout = '<svg class="emo-ik" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const db = () => IH.db;
  const jag = () => IH.jag().id;
  const anv = (id) => IH.anvandare(id) || { id, namn: 'Okänd', farg: '#ccc', titel: '' };
  const fornamn = (u) => String(u.namn || '').split(' ')[0];
  const lugn = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pek = () => matchMedia('(hover: none), (pointer: coarse)').matches;
  const DATAURL = /^data:[a-z0-9.+\/-]+;base64,[A-Za-z0-9+\/=]*$/i;
  const nyId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const PREF = 'ih-crm-chatt';
  const pref = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (x) { return {}; } };
  const satPref = (k, v) => { const p = pref(); p[k] = v; try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (x) { /* privat läge */ } };

  /* 01 Data ------------------------------------------------------------------------------------- */
  function C() {
    const d = db();
    if (!d.chatt || typeof d.chatt !== 'object' || Array.isArray(d.chatt)) d.chatt = {};
    const c = d.chatt;
    if (!Array.isArray(c.kanaler)) c.kanaler = []; if (!Array.isArray(c.meddelanden)) c.meddelanden = []; c.last = c.last || {}; c.tyst = c.tyst || {};
    if (!c.exempel) {
      c.exempel = true;
      const t = (dagar, h, m) => { const x = new Date(); x.setDate(x.getDate() + dagar); x.setHours(h, m, 0, 0); return x.toISOString(); };
      const aff = d.affarer.filter((a) => a.steg === 'offert')[0];
      const finns = new Set(c.meddelanden.map((m) => m.id));
      [{ id: 'm1', kanal: 'team', av: 'ah', tid: t(-2, 8, 12), text: 'God morgon! Veckomöte kl. 9 som vanligt – ta med det som står still på tavlan.' },
        { id: 'm2', kanal: 'team', av: 'sa', tid: t(-2, 8, 31), text: 'Stommarna till nästa montage är klara i verkstaden. Lastbilen är bokad.', reakt: { '👍': ['ah', 'ad'] } },
        { id: 'm3', kanal: 'team', av: 'sa', tid: t(-1, 14, 5), text: 'Platsbesöket i Tyresö gick bra. Bra väg fram för kranen.' },
        { id: 'm4', kanal: 'team', av: 'ah', tid: t(0, 7, 58), text: 'Snyggt jobbat med veckans affärer, allihop!' + (aff ? ' @Sahand, glöm inte att följa upp [[affar:' + aff.id + ']].' : '') },
        { id: 'm5', kanal: 'p-ah-sa', av: 'ah', tid: t(-1, 16, 40), text: 'Har du hunnit ringa om sjötomten? Säg till om du vill att jag följer med på platsbesöket.' },
        { id: 'm6', kanal: 'p-ah-sa', av: 'sa', tid: t(0, 9, 15), text: 'Kan du kolla med kunden om grunden är gjuten innan vi bokar montaget?' }
      ].forEach((m) => { if (!finns.has(m.id)) c.meddelanden.push(m); });
    }
    return c;
  }
  const privatId = (a, b) => 'p-' + [a, b].sort().join('-');
  function kanaler() {
    const mig = jag(), lista = [{ id: 'team', typ: 'team', namn: 'Hela teamet', medlemmar: IH.ANVANDARE.map((u) => u.id) }];
    IH.ANVANDARE.forEach((u) => { if (u.id !== mig) lista.push({ id: privatId(mig, u.id), typ: 'privat', medlemmar: [mig, u.id] }); });
    C().kanaler.forEach((k) => { if ((k.medlemmar || []).indexOf(mig) >= 0) lista.push(k); });
    return lista;
  }
  const kanal = (id) => kanaler().filter((k) => k.id === id)[0] || null;
  const motpart = (k) => (k.typ === 'privat' ? anv(k.medlemmar.filter((x) => x !== jag())[0]) : null);
  const kanalNamn = (k) => (k.typ === 'privat' ? motpart(k).namn : k.namn || 'Grupp');
  const iKanal = (id) => C().meddelanden.filter((m) => m.kanal === id).sort((a, b) => (a.tid < b.tid ? -1 : 1));
  const senast = (id) => { const l = iKanal(id); return l[l.length - 1] || null; };
  const lastTill = (id, uid) => (C().last[uid || jag()] || {})[id] || '';
  const olasta = (id) => iKanal(id).filter((m) => !m.system && !m.borttagen && m.av !== jag() && m.tid > lastTill(id)).length;
  const namnerMig = (m) => new RegExp('@' + fornamn(IH.jag()) + '\\b', 'i').test(m.text || '');
  const olastaNamn = (id) => iKanal(id).some((m) => m.av !== jag() && m.tid > lastTill(id) && namnerMig(m));
  const olastaTotalt = () => kanaler().reduce((t, k) => t + olasta(k.id), 0);
  IH.chattOlasta = olastaTotalt;
  const tystad = (id) => (C().tyst[jag()] || []).indexOf(id) >= 0;
  function markeraLast(id) {
    const c = C(), m = senast(id); if (!m || (IH.visarSom && IH.visarSom())) return; // supportläget: inget blir läst åt säljaren
    c.last[jag()] = c.last[jag()] || {};
    if (!c.last[jag()][id] || c.last[jag()][id] < m.tid) { c.last[jag()][id] = m.tid; IH.spara(); IH.uppdateraMeny(); satTitel(); }
  }
  function systemMedd(kid, text) { C().meddelanden.push({ id: nyId('s'), kanal: kid, av: jag(), tid: new Date().toISOString(), text, system: true }); }

  /* 02 Text: länkar, @namn, #kort, stora emoji ---------------------------------------------------- */
  const OBJ = /\[\[(kund|affar):([a-z0-9]+)\]\]/g;
  const URL_RE = /\bhttps?:\/\/[^\s<>"'\[\]]+[^\s<>"'\[\].,;:!?)]/g;
  const BARA_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u;
  const objekt = (typ, id) => {
    const o = typ === 'kund' ? IH.kund(id) : IH.affar(id); if (!o) return null;
    return typ === 'kund' ? { namn: o.namn, under: o.ort, href: '#/kunder/' + o.id, ikon: 'kunder' } : { namn: o.titel, under: IH.steg(o.steg).namn, href: '#/salj/' + o.id, ikon: 'portfolj' };
  };
  function bit(t) {
    return e(t).replace(/(^|\s)@([A-ZÅÄÖ][\wåäöÅÄÖ-]+)/g, (m, f, n) => f + '<span class="ch-omn' + (n.toLowerCase() === fornamn(IH.jag()).toLowerCase() ? ' ch-omn--mig' : '') + '">@' + n + '</span>')
      .replace(/\[\[(kund|affar):([a-z0-9]+)\]\]/g, (m, typ, id) => { const o = objekt(typ, id); return o ? '<a class="ch-obj" href="' + o.href + '">' + ik(o.ikon) + '<span><b>' + e(o.namn) + '</b>' + (o.under ? '<small>' + e(o.under) + '</small>' : '') + '</span></a>' : ''; })
      // Ett ensamt skiljetecken direkt efter en länkad kund eller affär hamnar annars ensamt på en rad under kortet
      .replace(/(<\/a>)[.,!?:;](?=\s|$)/g, '$1');
  }
  function formatera(text) {
    const r = String(text || ''); let ut = '', p = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(r))) { ut += bit(r.slice(p, m.index)) + '<a href="' + e(m[0]) + '" target="_blank" rel="noopener noreferrer">' + e(m[0]) + '</a>'; p = m.index + m[0].length; }
    return (ut + bit(r.slice(p))).replace(/\n/g, '<br>');
  }
  const klartext = (t) => String(t || '').replace(OBJ, (m, typ, id) => { const o = objekt(typ, id); return o ? '#' + o.namn : ''; });
  // "#Namn" skrivet för hand (eller valt i förslagen) blir en länk – längsta namnen först
  function medLankar(t) {
    const d = db(), namn = d.kunder.map((k) => ['kund', k.id, k.namn]).concat(d.affarer.map((a) => ['affar', a.id, a.titel])).sort((x, y) => y[2].length - x[2].length);
    namn.forEach((n) => { t = t.split('#' + n[2]).join('[[' + n[0] + ':' + n[1] + ']]'); });
    return t;
  }

  /* 03 Tider ------------------------------------------------------------------------------------- */
  const klocka = (iso) => IH.lokal(new Date(iso), 't', { hour: '2-digit', minute: '2-digit' });
  const dagNr = (iso) => { const a = new Date(iso), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); };
  const dagRubrik = (iso) => { const n = dagNr(iso); return n === 0 ? 'I dag' : n === 1 ? 'I går' : IH.lokal(new Date(iso), 'd', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()); };
  const listTid = (iso) => { const n = dagNr(iso); return n === 0 ? klocka(iso) : n === 1 ? 'I går' : n < 6 ? IH.lokal(new Date(iso), 'd', { weekday: 'short' }) : IH.lokal(new Date(iso), 'd', { day: 'numeric', month: 'short' }); };
  const storlek = (b) => (b >= 1048576 ? (b / 1048576).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB');

  /* 04 Läget i gränssnittet ---------------------------------------------------------------------- */
  const ui = { sok: '', info: false, emoji: false, svar: null, andrar: null, bilagor: [], utkast: {}, nya: new Set(), forslag: null, verktyg: null };
  const EMOJI = [['Vanliga', '👍 ❤️ 😊 😂 🙌 👏 🎉 🔥 ✅ 👀 🙏 💪 😅 🤔 😮 😢 👌 ✨ 💯 🚀'], ['Bygget', '🏠 🏡 🏗️ 🔨 🪵 🧱 🚚 📐 🔑 🌲 🌊 ☀️ 🌧️ ❄️ ☕ 📅 📞 ✉️ 📄 💰']];
  const SNABB = ['👍', '❤️', '😊', '🎉'];

  /* 05 Ritning: listan, tråden och om samtalet ---------------------------------------------------- */
  const avatar = (u, liten) => '<span class="avatar' + (liten ? ' avatar--liten' : '') + '" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(u.id) : '') + '</span>';
  const kanalAvatar = (k, liten) => (k.typ === 'privat' ? avatar(motpart(k), liten) : '<span class="avatar ch-gruppav' + (liten ? ' avatar--liten' : '') + '">' + ik(k.typ === 'team' ? 'kunder' : 'prat') + '</span>');
  function listaHtml(aktiv) {
    const q = ui.sok.trim().toLowerCase();
    let lista = kanaler().map((k) => ({ k, m: senast(k.id) })).filter((x) => x.m || x.k.typ !== 'privat' || x.k.id === aktiv).sort((a, b) => ((b.m ? b.m.tid : '') > (a.m ? a.m.tid : '') ? 1 : -1));
    if (q) lista = lista.filter((x) => kanalNamn(x.k).toLowerCase().indexOf(q) >= 0 || iKanal(x.k.id).some((m) => klartext(m.text).toLowerCase().indexOf(q) >= 0));
    return lista.map(({ k, m }) => {
      const n = k.id === aktiv ? 0 : olasta(k.id), at = k.id !== aktiv && olastaNamn(k.id);
      const forhand = m ? (m.av === jag() ? 'Du: ' : k.typ !== 'privat' && !m.system ? fornamn(anv(m.av)) + ': ' : '') + (m.borttagen ? 'Meddelandet togs bort' : klartext(m.text) || (m.filer && m.filer.length ? 'Fil: ' + m.filer[0].namn : '')) : 'Inga meddelanden än';
      return '<a class="ch-rad' + (k.id === aktiv ? ' vald' : '') + (n ? ' olast' : '') + '" href="#/chatt/' + k.id + '" data-ch-kanal="' + k.id + '">' + kanalAvatar(k) +
        '<span class="ch-rad__text"><b>' + e(kanalNamn(k)) + (tystad(k.id) ? ik('bjallra-av') : '') + '</b><small>' + e(forhand) + '</small></span>' +
        '<span class="ch-rad__hoger">' + (m ? '<small>' + listTid(m.tid) + '</small>' : '') + (at ? '<i class="ch-at">@</i>' : n ? '<i class="ch-olast">' + n + '</i>' : '') + '</span></a>';
    }).join('') || '<p class="ch-inga">Inga konversationer matchar.</p>';
  }
  // Märket från filskannern (filskanner.js): grön sköld när filen är ren, gul varning annars
  const skannad = (f) => (f.skanning ? '<span class="ch-skannad" data-status="' + e(f.skanning.status) + '" title="' + (f.skanning.status === 'ren' ? 'Virusskannad – inga hot hittades' : 'Släppt igenom med varning') + '">' + ik(f.skanning.status === 'ren' ? 'skold' : 'varning') + (f.skanning.status === 'ren' ? 'Skannad' : 'Varning') + '</span>' : '');
  function meddHtml(m, foreg) {
    const u = anv(m.av), egen = m.av === jag();
    if (m.system) return '<p class="ch-system">' + e(m.text) + '</p>';
    const fortsatt = foreg && !foreg.system && foreg.av === m.av && new Date(m.tid) - new Date(foreg.tid) < 5 * 60000 && dagNr(foreg.tid) === dagNr(m.tid);
    const bara = !m.borttagen && m.text && BARA_EMOJI.test(m.text) && [...m.text.trim()].length <= 8;
    const orig = m.svar && meddelande(m.svar.mid), bort = m.svar && (!orig || orig.borttagen);
    const svar = m.svar ? '<button type="button" class="ch-citat" data-ch-hoppa="' + m.svar.mid + '"><b>' + e(fornamn(anv(m.svar.av))) + '</b><span>' + (bort ? '<i>Meddelandet togs bort</i>' : e(m.svar.text)) + '</span></button>' : '';
    // Bilagor visas bara som data-URL (FileReader/canvas); allt annat ritas utan länk
    const url = (f) => (typeof f.data === 'string' && DATAURL.test(f.data) ? e(f.data) : '');
    const filer = (m.filer || []).map((f) => (f.typ && String(f.typ).indexOf('image/') === 0 && url(f)
      ? '<a class="ch-bild" href="' + url(f) + '" download="' + e(f.namn) + '"><img src="' + url(f) + '" alt="' + e(f.namn) + '" loading="lazy">' + skannad(f) + '</a>'
      : '<a class="ch-fil"' + (url(f) ? ' href="' + url(f) + '" download="' + e(f.namn) + '"' : '') + '>' + ik('gem') + '<span><b>' + e(f.namn) + '</b><small>' + storlek(f.storlek || 0) + '</small></span>' + skannad(f) + '</a>')).join('');
    const reakt = m.reakt ? Object.keys(m.reakt).filter((x) => m.reakt[x].length).map((x) => '<button type="button" class="ch-reakt' + (m.reakt[x].indexOf(jag()) >= 0 ? ' min' : '') + '" data-g="ch-reagera" data-mid="' + e(m.id) + '" data-emoji="' + e(x) + '" title="' + e(m.reakt[x].map((id) => fornamn(anv(id))).join(', ')) + '">' + e(x) + ' <b>' + m.reakt[x].length + '</b></button>').join('') : '';
    const verktyg = m.borttagen ? '' : '<span class="ch-verktyg" role="toolbar" aria-label="Åtgärder">' + SNABB.map((x) => '<button type="button" data-g="ch-reagera" data-mid="' + m.id + '" data-emoji="' + x + '" aria-label="Reagera ' + x + '">' + x + '</button>').join('') +
      '<button type="button" data-g="ch-svara" data-mid="' + m.id + '" title="Svara">' + ik('retur') + '</button><button type="button" data-g="ch-kopiera" data-mid="' + m.id + '" title="Kopiera">' + i('kopiera') + '</button>' +
      (egen ? '<button type="button" data-g="ch-andra" data-mid="' + m.id + '" title="Ändra">' + ik('redigera') + '</button><button type="button" data-g="ch-ta-bort" data-mid="' + m.id + '" title="Ta bort">' + ik('papperskorg') + '</button>' : '') + '</span>';
    return '<div class="ch-medd' + (egen ? ' egen' : '') + (fortsatt ? ' fortsatt' : '') + (namnerMig(m) && !egen ? ' namner' : '') + (ui.nya.has(m.id) ? ' ny' : '') + (ui.andrar === m.id ? ' andras' : '') + (ui.verktyg === m.id ? ' visa-verktyg' : '') + '" data-mid="' + m.id + '">' +
      (egen ? '' : fortsatt ? '<span class="ch-medd__plats"></span>' : avatar(u, true)) +
      '<div class="ch-medd__kropp">' + (egen || fortsatt ? '' : '<b class="ch-medd__namn">' + e(u.namn) + '<small>' + klocka(m.tid) + '</small></b>') +
        '<div class="ch-bubbla' + (bara ? ' stor' : '') + (m.borttagen ? ' borta' : '') + '">' + svar + (m.borttagen ? '<i>Meddelandet togs bort</i>' : formatera(m.text)) + filer +
          (egen || fortsatt ? '<small class="ch-tid">' + klocka(m.tid) + (m.andrad ? ' · ändrad' : '') + '</small>' : m.andrad ? '<small class="ch-tid">ändrad</small>' : '') + '</div>' +
        (reakt ? '<div class="ch-reaktioner">' + reakt + '</div>' : '') + '</div>' + verktyg + '</div>';
  }
  function tradHtml(k) {
    const lista = iKanal(k.id), forra = lastTill(k.id);
    let html = '<div class="ch-intro">' + kanalAvatar(k) + '<div><b>' + e(kanalNamn(k)) + '</b><small>' + (k.typ === 'privat' ? 'Början på er konversation' : k.typ === 'team' ? 'Alla i teamet · ' + k.medlemmar.length + ' personer' : 'Gruppen · ' + k.medlemmar.length + ' personer') + '</small></div></div>', dag = '', ny = false, foreg = null;
    lista.forEach((m) => {
      const d = new Date(m.tid).toDateString();
      if (d !== dag) { html += (dag ? '</div>' : '') + '<div class="ch-dagblock" style="display:flex;flex-direction:column;flex:none"><p class="ch-dag"><span>' + dagRubrik(m.tid) + '</span></p>'; dag = d; foreg = null; }
      if (!ny && forra && m.tid > forra && m.av !== jag() && !m.system) { html += '<p class="ch-nya"><span>Nya meddelanden</span></p>'; ny = true; foreg = null; }
      html += meddHtml(m, foreg); foreg = m;
    });
    if (dag) html += '</div>';
    // "Läst" under mitt senaste i ett privat samtal
    const sist = lista[lista.length - 1];
    if (k.typ === 'privat' && sist && sist.av === jag() && lastTill(k.id, motpart(k).id) >= sist.tid) html += '<p class="ch-last">' + ik('bock') + 'Läst</p>';
    return lista.length ? html : html + '<div class="ch-tomt">' + ik('prat') + '<b>Inga meddelanden än</b><p>Skriv det första – ' + (k.typ === 'privat' ? 'bara ni två ser konversationen.' : 'alla i konversationen ser det.') + '</p></div>';
  }
  // Snabbsvar på det senaste meddelandet (enkla regler på svenska, som i Uperformance) – klick lägger texten i rutan
  function snabbsvar(k) {
    const m = senast(k.id); if (!m || m.av === jag() || m.system || m.borttagen) return [];
    const t = klartext(m.text || '').toLowerCase();
    if (/\?\s*$/.test(t)) return ['Ja, det fixar jag', 'Jag kollar och återkommer', 'Nej, tyvärr inte'];
    if (/tack/.test(t)) return ['Varsågod!', 'Inga problem 😊', 'Självklart!'];
    if (/snyggt|bra jobb|grattis|vunnit|order|klar/.test(t)) return ['Toppen, tack!', 'Snyggt jobbat 🙌', 'Perfekt!'];
    if (/god morgon|hej|hallå/.test(t)) return ['God morgon!', 'Hej! 😊', 'Hej, hur går det?'];
    if (/kan du|glöm inte|kolla|boka|ring/.test(t)) return ['Jag tar det!', 'Fixar det i dag', 'Klart, återkommer'];
    return ['👍', 'Toppen, tack!', 'Uppfattat'];
  }
  // Ljud, avisering och tips längst ned i listan (korten med reglage från Uperformance)
  function installningarHtml() {
    const kan = 'Notification' in window, avis = kan && !!pref().avisera && Notification.permission === 'granted';
    const rad = (g, ikon, titel, under, pa) => '<button type="button" class="ch-vaxel" data-g="' + g + '" role="switch" aria-checked="' + pa + '">' +
      '<span class="ch-vaxel__ikon">' + ik(ikon) + '</span><span class="ch-vaxel__text"><b>' + titel + '</b><small>' + under + '</small></span><i class="ch-vaxel__reglage" aria-hidden="true"></i></button>';
    return '<div class="ch-kort">' + (kan ? rad('ch-avisera', 'bjallra', 'Avisering på skrivbordet', avis ? 'På – när fliken inte syns' : 'Av', avis) : '') +
      (pref().tipsDolt ? '' : '<div class="ch-tipskort"><span class="ch-vaxel__ikon">' + ik('glodlampa') + '</span><div><b>Tips</b><p>' + (pek()
        ? 'Tryck på ett meddelande för att svara, reagera eller ändra ditt eget. Bifoga filer med gemet – de virusskannas först.'
        : 'Dra in eller klistra in filer i en konversation – de virusskannas först. Håll musen över ett meddelande för att svara, reagera eller ändra ditt eget. Knappen med minus gör chatten till en ikon som följer med dig.') + '</p></div>' +
        '<button type="button" class="ch-tipskort__stang" data-g="ch-tips-stang" aria-label="Dölj tipset" title="Dölj tipset">' + i('stang') + '</button></div>') + '</div>';
  }
  function skrivHtml(k) {
    const andrar = ui.andrar && C().meddelanden.filter((m) => m.id === ui.andrar)[0];
    const svar = ui.svar && C().meddelanden.filter((m) => m.id === ui.svar)[0];
    const bilagor = ui.bilagor.map((b, n) => '<span class="ch-bilaga">' + (b.data && b.typ.indexOf('image/') === 0 ? '<img src="' + b.data + '" alt="">' : ik('gem')) + '<span>' + e(b.namn) + skannad(b) + '</span><button type="button" data-g="ch-bilaga-bort" data-n="' + n + '" aria-label="Ta bort ' + e(b.namn) + '">' + i('stang') + '</button></span>').join('');
    const snabb = !andrar && !svar && !ui.bilagor.length ? snabbsvar(k) : [];
    return (snabb.length ? '<div class="ch-snabb"><span class="ch-snabb__etikett">' + ik('gnista') + 'Snabbsvar</span>' + snabb.map((x) => '<button type="button" data-g="ch-snabb" data-text="' + e(x) + '">' + e(x) + '</button>').join('') + '</div>' : '') +
      (andrar ? '<div class="ch-skriv__lage">' + ik('redigera') + '<span><b>Ändrar meddelandet</b><small>Enter sparar · Esc avbryter</small></span><button type="button" data-g="ch-avbryt" aria-label="Avbryt">' + i('stang') + '</button></div>' : '') +
      (svar ? '<div class="ch-skriv__lage">' + ik('retur') + '<span><b>Svar till ' + e(fornamn(anv(svar.av))) + '</b><small>' + e(klartext(svar.text).slice(0, 90)) + '</small></span><button type="button" data-g="ch-avbryt" aria-label="Avbryt">' + i('stang') + '</button></div>' : '') +
      (bilagor ? '<div class="ch-bilagor">' + bilagor + '</div>' : '') +
      '<form class="ch-skriv" data-ch-skriv data-kanal="' + k.id + '">' +
        '<button type="button" class="ch-ikonknapp" data-g="ch-emoji" aria-label="Infoga emoji" aria-expanded="' + ui.emoji + '">' + ik('smiley') + '</button>' +
        '<label class="ch-ikonknapp" title="Bifoga fil eller bild">' + ik('gem') + '<input type="file" multiple data-ch-fil hidden></label>' +
        '<textarea name="text" rows="1"' + (IH.visarSom && IH.visarSom() ? ' disabled' : '') + ' placeholder="' + (IH.visarSom && IH.visarSom() ? 'Skrivskyddat i supportläget – ' + e(IH.visarSom().namn) + ' märker inte att du läser' : (andrar ? 'Ändra meddelandet' : 'Skriv till ' + e(k.typ === 'privat' ? fornamn(motpart(k)) : kanalNamn(k))) + '… (@kollega, #kund)') + '" aria-label="Meddelande">' + e(andrar ? klartext(andrar.text) : ui.utkast[k.id] || '') + '</textarea>' +
        '<button class="ch-skicka" type="submit" aria-label="' + (andrar ? 'Spara' : 'Skicka') + '">' + ik(andrar ? 'bock' : 'skicka') + '</button>' +
        (ui.emoji ? '<div class="ch-emojipanel">' + EMOJI.map((g) => '<p>' + g[0] + '</p><div>' + g[1].split(' ').map((x) => '<button type="button" data-g="ch-emoji-in" data-emoji="' + x + '">' + x + '</button>').join('') + '</div>').join('') + '</div>' : '') +
        '<div class="ch-forslag" data-ch-forslag hidden></div>' +
      '</form>';
  }
  function infoHtml(k) {
    const filer = iKanal(k.id).filter((m) => m.filer && !m.borttagen).reduce((t, m) => t.concat(m.filer), []).slice(-8).reverse();
    return '<aside class="ch-info"><header><b>Om konversationen</b><button type="button" class="ch-ikonknapp" data-g="ch-info" aria-label="Stäng">' + i('stang') + '</button></header>' +
      '<p class="ch-info__rub">Medlemmar · ' + k.medlemmar.length + '</p><ul class="ch-medlemmar">' + k.medlemmar.map((id) => { const u = anv(id); return '<li>' + avatar(u, true) + '<span><b>' + e(u.namn) + (id === jag() ? ' (du)' : '') + '</b><small>' + e(IH.narvaro ? IH.narvaro(id).namn : u.titel) + '</small></span></li>'; }).join('') + '</ul>' +
      (k.typ === 'grupp' ? '<button class="knapp knapp--liten" type="button" data-g="ch-bjud" data-kanal="' + k.id + '">' + ik('anvandare-plus') + 'Bjud in</button>' +
        '<form class="ch-namnform" data-ch-namn data-kanal="' + k.id + '"><label><span>Gruppens namn</span><input name="namn" maxlength="40" value="' + e(k.namn || '') + '"></label><button class="knapp knapp--liten" type="submit">Spara</button></form>' : '') +
      '<p class="ch-info__rub">Delade filer</p>' + (filer.length ? '<ul class="ch-delade">' + filer.map((f) => '<li>' + ik(f.typ && f.typ.indexOf('image/') === 0 ? 'bild' : 'gem') + '<span>' + e(f.namn) + '</span></li>').join('') + '</ul>' : '<p class="ch-info__tom">Inga filer än.</p>') +
      '<div class="ch-info__knappar"><button class="knapp knapp--liten" type="button" data-g="ch-tyst" data-kanal="' + k.id + '">' + ik(tystad(k.id) ? 'bjallra' : 'bjallra-av') + (tystad(k.id) ? 'Slå på ljudet' : 'Tysta konversationen') + '</button>' +
      (k.typ === 'grupp' ? '<button class="knapp knapp--liten knapp--fara" type="button" data-g="ch-lamna" data-kanal="' + k.id + '">Lämna gruppen</button>' : '') + '</div></aside>';
  }
  function toppHtml(k, iFonster) {
    const mot = motpart(k);
    return '<header class="ch-topp">' + (iFonster ? '<button type="button" class="ch-ikonknapp" data-g="chf-lista" aria-label="Alla konversationer">' + i('pilv') + '</button>' : '') + kanalAvatar(k) +
      '<div class="ch-topp__text"><b>' + e(kanalNamn(k)) + '</b><small>' + (mot ? e((IH.narvaro ? IH.narvaro(mot.id).namn + ' · ' : '') + mot.titel) : e(k.medlemmar.map((id) => fornamn(anv(id))).join(', '))) + '</small></div>' +
      (iFonster ? '' : '<span class="ch-topp__knappar">' +
        (k.typ === 'grupp' ? '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-bjud" data-kanal="' + k.id + '" title="Bjud in">' + ik('anvandare-plus') + '</button>' : '') +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-tyst" data-kanal="' + k.id + '" aria-pressed="' + tystad(k.id) + '" title="' + (tystad(k.id) ? 'Slå på ljudet' : 'Tysta konversationen') + '">' + ik(tystad(k.id) ? 'ljud-av' : 'ljud') + '</button>' +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-info" aria-pressed="' + ui.info + '" title="Om konversationen">' + ik('info') + '</button>' +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-oppna" data-kanal="' + k.id + '" title="Öppna i eget fönster" aria-label="Öppna i eget fönster">' + popout + '</button>' +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-min-sida" data-kanal="' + k.id + '" title="Minimera till en ikon">' + ik('minimera') + '</button></span>') + '</header>';
  }

  /* 06 Sidan #/chatt[/id] ------------------------------------------------------------------------ */
  let sidKanal = null;
  IH.vyer.chatt = function (del) {
    const lista = kanaler();
    const k = kanal(del[0]) || kanal(sidKanal) || kanal(pref().senast) || lista[0];
    sidKanal = k.id; satPref('senast', k.id);
    const html = '<h1 class="dold">Meddelanden</h1><div class="ch' + (ui.info ? ' med-info' : '') + ' kort" data-in>' +
      '<aside class="ch-lista"><header><div><h2>Meddelanden</h2><small>' + (olastaTotalt() ? olastaTotalt() + (olastaTotalt() === 1 ? ' oläst' : ' olästa') : 'Allt är läst') + '</small></div>' +
          '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-pling" aria-pressed="' + (pref().pling !== false) + '" title="' + (pref().pling !== false ? 'Stäng av ljudet' : 'Slå på ljudet') + '">' + ik(pref().pling !== false ? 'ljud' : 'ljud-av') + '</button>' +
          '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-min-sida" data-kanal="' + k.id + '" title="Minimera till en ikon">' + ik('minimera') + '</button>' +
          '<button type="button" class="ch-ikonknapp ch-ny" data-g="ch-ny-grupp" title="Ny grupp">' + ik('plus') + '</button></header>' +
        '<label class="ch-sok">' + ik('sok') + '<input type="search" data-ch-sok placeholder="Sök i konversationerna…" value="' + e(ui.sok) + '" aria-label="Sök i konversationerna"></label>' +
        '<div class="ch-team" role="list" aria-label="Kollegor">' + IH.ANVANDARE.filter((u) => u.id !== jag()).map((u) => {
          const n = IH.narvaro ? IH.narvaro(u.id) : { namn: '' }, pid = privatId(jag(), u.id);
          return '<a role="listitem" class="ch-teamkort' + (pid === k.id ? ' vald' : '') + '" href="#/chatt/' + pid + '" title="Skriv till ' + e(u.namn) + ' – ' + e(n.namn) + ' · ' + e(u.titel) + '">' + avatar(u) + '<b>' + e(fornamn(u)) + '</b><small>' + e(n.namn) + '</small></a>';
        }).join('') + '</div>' +
        '<nav aria-label="Konversationer" data-ch-listan>' + listaHtml(k.id) + '</nav>' +
        installningarHtml() + '</aside>' +
      '<section class="ch-tradyta" data-ch-yta="sida">' + toppHtml(k) + '<div class="ch-trad" data-ch-trad>' + tradHtml(k) + '</div>' +
        '<div class="ch-fot">' + skrivHtml(k) + '<p class="ch-tips">' + (pek() ? 'Tryck på ett meddelande för att svara eller reagera' : '<kbd>Enter</kbd> skickar · <kbd>Shift</kbd> + <kbd>Enter</kbd> ny rad · <kbd>@</kbd> nämn en kollega · <kbd>#</kbd> länka en kund eller affär · <kbd>↑</kbd> ändra ditt senaste meddelande · filer virusskannas först') + '</p></div></section>' +
      (ui.info ? infoHtml(k) : '') + '</div>';
    return { titel: 'Meddelanden', html, efter: (rot) => efterTrad(rot, k) };
  };
  function efterTrad(rot, k) {
    const t = rot.querySelector('[data-ch-trad]');
    if (t) { const ny = t.querySelector('.ch-nya'); t.scrollTop = ny ? ny.offsetTop - 40 : t.scrollHeight; }
    if (document.visibilityState === 'visible') markeraLast(k.id);
    ui.nya.clear();
    const ruta = rot.querySelector('[data-ch-skriv] textarea');
    if (ruta) { vaxa(ruta); if (!pek() && !(document.activeElement && document.activeElement.matches('[data-ch-sok]'))) { ruta.focus({ preventScroll: true }); const l = ruta.value.length; ruta.setSelectionRange(l, l); } }
  }
  function ritaAllt() {
    if (/^#\/chatt/.test(location.hash)) IH.rita();
    ritaFonster(); IH.uppdateraMeny(); satTitel();
  }

  /* 07 Flytande fönstret ------------------------------------------------------------------------- */
  /* Rörelserna här går i samma takt och kurva som menyns låda (--glid .48s, --ease-drawer), så att menyn, knappen,
     dockan och bubblan rör sig som en enda sak. Fönstret krymper in i bubblan när det minimeras och växer ut ur den
     när det öppnas. Allt hoppas över med reducerad rörelse. */
  const FL = 'ih-crm-chattfonster';
  const fl = (() => { try { return JSON.parse(localStorage.getItem(FL)) || {}; } catch (x) { return {}; } })();
  const sparaFl = () => { try { localStorage.setItem(FL, JSON.stringify(fl)); } catch (x) { /* */ } };
  const GLID = 480, KURVA = 'cubic-bezier(.32, .72, 0, 1)', UT = 'cubic-bezier(.4, 0, 1, 1)';
  const fart = () => !!document.body.animate && !lugn() && !IH.lugn;
  const html = document.documentElement;
  let fonster = null, ikon = null, fokusFore = null;
  // Minimal-läget: bubblan finns alltid nära (även när chatten är stängd), om man inte stängt den i bubblans meny.
  // Visas igen nästa gång man byter till Minimal. Ändrar inget i Normal och Full.
  const minimal = () => html.getAttribute('data-layout') === 'minimal';
  const minBubbla = () => !fl.oppen && minimal() && !fl.dolMin;
  // Rektangeln utan magnetens förskjutning (grund.js sätter style.translate när musen är nära)
  function rekt(el) {
    const r = el.getBoundingClientRect(), t = String(el.style.translate || '').split(' '), tx = parseFloat(t[0]) || 0, ty = parseFloat(t[1]) || 0;
    return { left: r.left - tx, top: r.top - ty, width: r.width, height: r.height, right: r.right - tx, bottom: r.bottom - ty };
  }
  function klam() {
    const w = Math.min(fl.w || 380, innerWidth - 24), h = Math.min(fl.h || 540, innerHeight - 24);
    fl.w = w; fl.h = h;
    fl.x = Math.max(120 - w, Math.min(innerWidth - 120, fl.x == null ? innerWidth - w - 24 : fl.x));
    fl.y = Math.max(12, Math.min(innerHeight - 60, fl.y == null ? innerHeight - h - 24 : fl.y));
  }
  function placeraFonster() {
    if (!fonster) return;
    klam();
    Object.assign(fonster.style, { left: fl.x + 'px', top: fl.y + 'px', width: fl.w + 'px', height: fl.h + 'px' });
  }
  // Fönstret går undan: in i bubblan (mal) eller tonar och sjunker lite (stängt)
  function fonsterUndan(mal) {
    const f = fonster; fonster = null; if (!f) return;
    const hadeFokus = f.contains(document.activeElement);
    f.inert = true; f.setAttribute('data-undan', '');
    if (!fart() || !f.animate) { f.remove(); }
    else {
      const r = f.getBoundingClientRect();
      const slut = mal ? 'translate(' + (mal.left + mal.width / 2 - (r.left + r.width / 2)) + 'px,' + (mal.top + mal.height / 2 - (r.top + r.height / 2)) + 'px) scale(.18)' : 'translateY(10px) scale(.96)';
      const a = f.animate(mal ? [{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .25 }, { transform: slut, opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: slut, opacity: 0 }],
        { duration: mal ? 300 : 180, easing: mal ? KURVA : UT, fill: 'forwards' });
      a.onfinish = () => f.remove();
    }
    if (hadeFokus) {
      if (mal && ikon) ikon.focus({ preventScroll: true });
      else { const m = aterFokus(); if (m) m.focus({ preventScroll: true }); }
    }
    if (!mal) fokusFore = null;
  }
  // Var fokus ska tillbaka när fönstret stängs: samma element, eller samma länk/knapp om menyn har ritats om under tiden
  function aterFokus() {
    const f = fokusFore; if (!f) return null;
    if (f.isConnected) return f;
    const nyckel = ['href', 'data-g', 'data-vy'].filter((a) => f.getAttribute && f.getAttribute(a))[0];
    if (!nyckel) return null;
    const v = f.getAttribute(nyckel);
    return [...document.querySelectorAll('[' + nyckel + ']')].filter((x) => x.getAttribute(nyckel) === v && x.getClientRects().length && !x.closest('[inert]'))[0] || null;
  }
  // Bubblan tonar bort på sin plats (i dockan eller i hörnet) – i stället för att försvinna eller flyga över sidan
  function tonaBort(el, ms) {
    if (!el) return;
    el.inert = true; el.style.pointerEvents = 'none'; el.setAttribute('data-undan', '');
    if (!fart() || !el.animate) { el.remove(); return; }
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.6)' }], { duration: ms || 160, easing: UT, fill: 'forwards' }).onfinish = () => el.remove();
  }
  function uppdateraIkon() {
    if (!ikon) return;
    const n = olastaTotalt();
    // innerHTML bara när antalet ändras – annars studsar siffran in igen vid varje omritning
    if (ikon.dataset.n !== String(n)) { ikon.dataset.n = String(n); ikon.innerHTML = ik('prat') + (n ? '<i class="ch-olast">' + n + '</i>' : ''); }
    ikon.toggleAttribute('data-puls', !!n); ikon.toggleAttribute('data-tyst', !!pref().storEj);
  }
  function ritaFonster(fokusera) {
    const paSidan = /^#\/chatt/.test(location.hash);
    if ((!fl.oppen && !minBubbla()) || paSidan) {
      fonsterUndan(null);
      if (ikon) { const b = ikon; ikon = null; tonaBort(b); }
      placeraIkon(); return;
    }
    if (fl.min || !fl.oppen) {
      if (!ikon) {
        ikon = document.createElement('button'); ikon.type = 'button'; ikon.className = 'chf-ikon'; ikon.setAttribute('aria-label', 'Öppna chatten');
        // När fönstret krymper in i bubblan tonar bubblan fram först när fönstret nästan är där
        if (fonster && fart()) ikon.setAttribute('data-sen', '');
        document.body.appendChild(ikon); kopplaIkon(ikon);
      }
      uppdateraIkon();
      placeraIkon();
      if (fonster) fonsterUndan(rekt(ikon));
      return;
    }
    let fran = null;
    if (ikon) { fran = rekt(ikon); const b = ikon; ikon = null; b.remove(); placeraIkon(); }
    const nytt = !fonster;
    if (nytt) {
      if (!fokusFore) fokusFore = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      fonster = document.createElement('section'); fonster.className = 'chf'; fonster.setAttribute('aria-label', 'Chatten'); fonster.setAttribute('role', 'dialog');
      document.body.appendChild(fonster); kopplaFonster(fonster);
    }
    placeraFonster();
    const k = fl.kanal && kanal(fl.kanal);
    const fokus = document.activeElement && fonster.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA';
    const trad0 = fonster.querySelector('[data-ch-trad]'), vidBotten = !trad0 || trad0.scrollHeight - trad0.scrollTop - trad0.clientHeight < 40, rull = trad0 ? trad0.scrollTop : 0, samma = fonster.dataset.kanal === String(k ? k.id : '');
    fonster.dataset.kanal = k ? k.id : '';
    fonster.innerHTML = '<header class="chf-huvud" data-chf-dra>' + ik('prat') + '<b>' + (k ? e(kanalNamn(k)) : 'Meddelanden') + '</b>' +
      '<button type="button" class="ch-ikonknapp" data-g="chf-storej" aria-pressed="' + !!pref().storEj + '" title="Stör ej">' + ik(pref().storEj ? 'bjallra-av' : 'bjallra') + '</button>' +
      '<a class="ch-ikonknapp" href="#/chatt' + (k ? '/' + k.id : '') + '" title="Öppna på hela sidan">' + ik('helskarm') + '</a>' +
      '<button type="button" class="ch-ikonknapp" data-g="chf-min" title="Minimera (Esc)">' + ik('minimera') + '</button>' +
      '<button type="button" class="ch-ikonknapp" data-g="chf-stang" title="Stäng">' + i('stang') + '</button></header>' +
      (k ? '<div class="chf-kropp ch-tradyta" data-ch-yta="fonster">' + toppHtml(k, true) + '<div class="ch-trad" data-ch-trad>' + tradHtml(k) + '</div><div class="ch-fot">' + skrivHtml(k) + '</div></div>'
        : '<nav class="chf-kropp chf-lista" aria-label="Konversationer" data-ch-listan>' + listaHtml(null) + '</nav>') +
      '<span class="chf-storlek" data-chf-storlek aria-hidden="true"></span>';
    if (k) {
      // Tråden står kvar där man läste om man rullat upp i samma samtal; annars längst ner
      const t = fonster.querySelector('[data-ch-trad]'); t.scrollTop = !nytt && samma && !vidBotten ? rull : t.scrollHeight; markeraLast(k.id); ui.nya.clear();
      const r = fonster.querySelector('textarea'); if (r) { vaxa(r); if (fokus) r.focus({ preventScroll: true }); }
    }
    if (nytt) {
      if (fart()) {
        fonster.style.animation = 'none';
        if (fran) {
          const r = fonster.getBoundingClientRect(), dx = fran.left + fran.width / 2 - (r.left + r.width / 2), dy = fran.top + fran.height / 2 - (r.top + r.height / 2);
          fonster.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.18)', opacity: 0 }, { opacity: 1, offset: .45 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: KURVA });
        } else fonster.animate([{ transform: 'translateY(14px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: KURVA });
      }
      if (fokusera) requestAnimationFrame(() => { if (!fonster) return; const m = fonster.querySelector('[data-ch-skriv] textarea') || fonster.querySelector('[data-ch-kanal], .chf-lista a, .chf-lista button'); if (m) m.focus({ preventScroll: true }); });
    }
  }
  /* Dockan: när menyn är infälld sitter chattikonen under menyknappen i en gemensam kapsel, med en ledning emellan där
     ett ljus vandrar (snabbare och varmare när något är oläst). När menyn fälls in glider bubblan till dockan samtidigt
     som menyn, med samma tid och kurva; när menyn fälls ut tonar den bort ur dockan och fram i hörnet. */
  let dock = null, varIDocka = null, sattTimer = 0;
  // Menyns pågående växling (app.js sattSido): tid, kurva och menyknappens läge före och efter. Finns bara i samma
  // ögonblick som menyn växlar – dockan och bubblan följer då med knappen i samma takt.
  const sidoGlid = () => (IH.sidoGlid && IH.sidoGlid.knappTill && fart() ? IH.sidoGlid : null);
  // Följer med knappen och tonar: in efter att kanten hunnit en bit, ut under första halvan – som rälsen
  function rid(el, fran, till, op0, op1, g, klar) {
    const a = [el.animate([{ transform: fran }, { transform: till }], { duration: g.tid, easing: g.kurva, fill: 'both' }),
      el.animate(op1 > op0 ? [{ opacity: op0, offset: 0 }, { opacity: op0, offset: 0.12 }, { opacity: op1, offset: 0.62 }, { opacity: op1 }]
        : [{ opacity: op0 }, { opacity: op1, offset: 0.42 }, { opacity: op1 }], { duration: g.tid, easing: 'linear', fill: 'both' })];
    a[1].onfinish = () => { if (klar) klar(); else { a.forEach((x) => x.cancel()); if (el.__glid === a) el.__glid = null; } };
    return a;
  }
  const stoppa = (el) => { if (el && el.__glid) { el.__glid.forEach((a) => a.cancel()); el.__glid = null; } };
  const flytt = (el) => { const t = getComputedStyle(el).transform; const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : { e: 0, f: 0 }; return [m.e, m.f]; };
  // Knappens rektangel när menyns pågående glidning är klar: spolar dess övergångar (och kantens) till slutet, mäter
  // och spolar tillbaka – så att målet blir rätt vilka mått CSS:en än ger knappen
  function knappSlut(kn) {
    const spolade = [];
    try {
      for (let n = kn; n && n !== html; n = n.parentElement) {
        getComputedStyle(n).transform; // startar övergångarna innan de spolas
        (n.getAnimations ? n.getAnimations() : []).forEach((a) => {
          const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
          if (a.playState === 'running' && t && isFinite(t.endTime) && t.endTime > 0) { spolade.push([a, a.currentTime]); a.currentTime = t.endTime - 0.01; }
        });
      }
      return rekt(kn);
    } finally { spolade.forEach((x) => { x[0].currentTime = x[1]; }); }
  }
  let dockUt = null;
  function dockFor(kr, sen, g) {
    if (!kr) {
      html.removeAttribute('data-chatt-dockad');
      if (dock) {
        const d = dock; dock = null;
        if (g) {
          // Menyn fälls ut: kapseln följer knappen ut och tonar bort
          const [x, y] = flytt(d), op = +getComputedStyle(d).opacity; stoppa(d);
          d.style.animation = 'none'; dockUt = d;
          d.__glid = rid(d, 'translate(' + x + 'px,' + y + 'px)', 'translate(' + (x + g.knappTill.left - g.knappFran.left) + 'px,' + (y + g.knappTill.top - g.knappFran.top) + 'px)', op, 0, g, () => { d.remove(); if (dockUt === d) dockUt = null; });
        } else { d.setAttribute('data-ut', ''); setTimeout(() => d.remove(), fart() ? 220 : 0); }
      }
      return;
    }
    html.setAttribute('data-chatt-dockad', '');
    if (!dock) {
      // En kapsel som just tonar ut (menyn vände mitt i) ersätts av den nya, som börjar från dess opacitet
      let op0 = 0;
      if (dockUt) { op0 = +getComputedStyle(dockUt).opacity; dockUt.remove(); dockUt = null; }
      dock = document.createElement('div'); dock.className = 'chf-dock'; dock.setAttribute('aria-hidden', 'true'); dock.innerHTML = '<i class="chf-dock__led"><b></b></i>';
      if (sen && !g) dock.setAttribute('data-sen', '');
      document.body.appendChild(dock);
      // Menyn fälls in: kapseln kommer med knappen från menyns kant och tonar fram i takt med rälsen
      if (g) { dock.style.animation = 'none'; dock.__glid = rid(dock, 'translate(' + (g.knappFran.left - g.knappTill.left) + 'px,' + (g.knappFran.top - g.knappTill.top) + 'px)', 'none', op0, 1, g); }
    }
    const t = kr.top - 9, botten = parseFloat(ikon.style.top) + 40 + 9;
    Object.assign(dock.style, { left: (kr.left + kr.width / 2 - 29) + 'px', top: t + 'px', height: (botten - t) + 'px' });
    dock.style.setProperty('--led-top', (kr.height + 11) + 'px'); dock.style.setProperty('--led-botten', (40 + 11) + 'px');
    dock.toggleAttribute('data-olast', ikon.hasAttribute('data-puls'));
  }
  // vaxlar: menyn har just fällts in eller ut (anropas direkt från attributbytet, inte efter glidningen)
  function placeraIkon(vaxlar) {
    const g = vaxlar ? sidoGlid() : null, tid = g ? g.tid : GLID;
    if (!ikon) { dockFor(null, false, g); varIDocka = null; return; }
    const rals = html.hasAttribute('data-sido-dold') && matchMedia('(min-width: 1101px)').matches;
    const kn = [...document.querySelectorAll('[data-sido-knapp], .sido-knapp')].filter((x) => x.getBoundingClientRect().width)[0];
    const fran = ikon.isConnected && varIDocka !== null ? rekt(ikon) : null;
    const franOp = fran ? +getComputedStyle(ikon).opacity : 1;
    stoppa(ikon); // en pågående flygning avbryts – den nya börjar där bubblan står just nu
    const sido = !rals && document.querySelector('.sido'), sr = sido && sido.getBoundingClientRect();
    if (fl.ikonX != null && sr && sr.width && fl.ikonX < sr.right && fl.ikonY + 44 > sr.top && fl.ikonY < sr.bottom) { fl.ikonX = fl.ikonY = null; sparaFl(); }
    const iDocka = !!(rals && kn && fl.ikonX == null);
    const bytt = varIDocka !== null && varIDocka !== iDocka;
    // Ut ur dockan: en kopia tonar bort i dockan och bubblan tonar fram i hörnet (i stället för att flyga tvärs över sidan)
    if (bytt && !iDocka && fart() && fran && fran.width) {
      const kopia = ikon.cloneNode(true); kopia.removeAttribute('id'); kopia.setAttribute('aria-hidden', 'true');
      Object.assign(kopia.style, { left: fran.left + 'px', top: fran.top + 'px', right: 'auto', bottom: 'auto', translate: 'none', animation: 'none', transition: 'none' });
      document.body.appendChild(kopia);
      // Menyn fälls ut: kopian följer knappen ut ur dockan och tonar bort, i takt med rälsen
      if (g) { kopia.inert = true; kopia.style.pointerEvents = 'none'; kopia.setAttribute('data-undan', ''); rid(kopia, 'none', 'translate(' + (g.knappTill.left - g.knappFran.left) + 'px,' + (g.knappTill.top - g.knappFran.top) + 'px)', franOp, 0, g, () => kopia.remove()); }
      else tonaBort(kopia, 150);
    }
    ikon.style.translate = '';
    ikon.style.right = ikon.style.bottom = ikon.style.left = ikon.style.top = '';
    let kr = null;
    if (fl.ikonX != null) { ikon.style.left = fl.ikonX + 'px'; ikon.style.top = fl.ikonY + 'px'; }
    else if (iDocka) {
      kr = g ? g.knappTill : vaxlar ? knappSlut(kn) : rekt(kn);
      ikon.style.left = (kr.left + kr.width / 2 - 20) + 'px'; ikon.style.top = (kr.top + kr.height / 2 + 20 + 14) + 'px';
    } else { ikon.style.right = '22px'; ikon.style.bottom = '22px'; }
    ikon.toggleAttribute('data-i-docka', iDocka);
    dockFor(iDocka ? kr : null, bytt && fart(), bytt ? g : null);
    if (bytt && fran && fran.width && fart()) {
      if (iDocka && g) {
        // In i dockan när menyn fälls in: bubblan i hörnet tonar bort där den står, och i dockan kommer den med knappen
        // från menyns kant och tonar fram i takt med rälsen – i stället för att flyga tvärs över sidan
        const kopia = ikon.cloneNode(true); kopia.removeAttribute('id'); kopia.setAttribute('aria-hidden', 'true'); kopia.inert = true; kopia.removeAttribute('data-i-docka');
        Object.assign(kopia.style, { left: fran.left + 'px', top: fran.top + 'px', width: fran.width + 'px', height: fran.height + 'px', right: 'auto', bottom: 'auto', translate: 'none', animation: 'none', transition: 'none', pointerEvents: 'none' });
        document.body.appendChild(kopia);
        kopia.animate([{ opacity: franOp, transform: 'none' }, { opacity: 0, transform: 'scale(.6)', offset: 0.42 }, { opacity: 0, transform: 'scale(.6)' }], { duration: tid, easing: 'linear', fill: 'forwards' }).onfinish = () => kopia.remove();
        ikon.__glid = rid(ikon, 'translate(' + (g.knappFran.left - g.knappTill.left) + 'px,' + (g.knappFran.top - g.knappTill.top) + 'px)', 'none', 0, 1, g);
        if (dock) { dock.removeAttribute('data-landar'); void dock.offsetWidth; dock.setAttribute('data-landar', ''); }
      } else if (iDocka) {
        // In i dockan: samma glidning som menyn
        const till = rekt(ikon), dx = fran.left - till.left, dy = fran.top - till.top;
        if (Math.hypot(dx, dy) > 3) ikon.__glid = [ikon.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)', opacity: franOp }, { transform: 'none', opacity: 1 }], { duration: tid, easing: KURVA })];
        if (dock) { dock.removeAttribute('data-landar'); void dock.offsetWidth; dock.setAttribute('data-landar', ''); }
      } else ikon.__glid = [ikon.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: Math.round(tid * 0.65), delay: Math.round(tid * 0.35), easing: KURVA, fill: 'backwards' })];
    } else if (!bytt && fran && fran.width && fart()) {
      // Samma läge men en annan plats (t.ex. efter glidningen eller ett annat fönstermått): glid kort dit
      const till = rekt(ikon), dx = fran.left - till.left, dy = fran.top - till.top;
      if (Math.hypot(dx, dy) > 1 && Math.hypot(dx, dy) < 400) ikon.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 220, easing: KURVA });
    }
    varIDocka = iDocka;
    // En kontroll när glidningen är klar: rättar mjukt om menyns mått blev andra än väntat
    clearTimeout(sattTimer);
    if (vaxlar && iDocka) sattTimer = setTimeout(() => placeraIkon(), tid + 60);
  }
  IH.placeraChatt = () => placeraIkon(true);
  addEventListener('resize', () => { placeraFonster(); placeraIkon(); });
  // Menyn fälls in eller ut: placera direkt (observern körs i samma ögonblick som attributet byts, före första bildrutan)
  new MutationObserver((lista) => {
    if (lista.some((m) => m.attributeName === 'data-sido-dold')) placeraIkon(true);
    if (html.hasAttribute('data-ark-oppen') || html.hasAttribute('data-palett-oppen')) stangIkonMeny();
  }).observe(html, { attributes: true, attributeFilter: ['data-sido-dold', 'data-ark-oppen', 'data-palett-oppen'] });
  function dra(ev, flytt, klar) {
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId, mal = ev.target; let rord = false;
    try { mal.setPointerCapture(id); } catch (x) { /* */ }
    const flytta = (e2) => { if (e2.pointerId !== id) return; const dx = e2.clientX - x0, dy = e2.clientY - y0; if (!rord && Math.hypot(dx, dy) < 4) return; rord = true; flytt(dx, dy); };
    const slapp = (e2) => {
      if (e2 && e2.pointerId != null && e2.pointerId !== id) return;
      removeEventListener('pointermove', flytta); removeEventListener('pointerup', slapp); removeEventListener('pointercancel', slapp); mal.removeEventListener('lostpointercapture', slapp);
      klar(rord);
    };
    addEventListener('pointermove', flytta); addEventListener('pointerup', slapp); addEventListener('pointercancel', slapp); mal.addEventListener('lostpointercapture', slapp);
  }
  function kopplaFonster(f) {
    f.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const huvud = ev.target.closest('[data-chf-dra]'), horn = ev.target.closest('[data-chf-storlek]');
      if (huvud && !ev.target.closest('button, a')) {
        const x = fl.x, y = fl.y; f.setAttribute('data-drar', '');
        dra(ev, (dx, dy) => { fl.x = x + dx; fl.y = y + dy; klam(); f.style.left = fl.x + 'px'; f.style.top = fl.y + 'px'; }, () => { f.removeAttribute('data-drar'); sparaFl(); });
      } else if (horn) {
        const w = fl.w, h = fl.h; ev.preventDefault();
        // Storleken hålls inom fönstret redan under dragningen, så att den inte hoppar när man släpper
        dra(ev, (dx, dy) => { fl.w = Math.max(300, Math.min(innerWidth - fl.x - 12, w + dx)); fl.h = Math.max(360, Math.min(innerHeight - fl.y - 12, h + dy)); f.style.width = fl.w + 'px'; f.style.height = fl.h + 'px'; },
          () => { placeraFonster(); sparaFl(); });
      }
    });
  }
  function kopplaIkon(b) {
    b.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const r = rekt(b);
      // Ett klick som rör sig några pixlar (magneten drar ikonen mot musen) ska inte räknas som en flytt
      dra(ev, (dx, dy) => { if (!b.dataset.drar && Math.hypot(dx, dy) < 9) return; b.dataset.drar = '1'; b.style.translate = ''; fl.ikonX = Math.max(6, Math.min(innerWidth - 50, r.left + dx)); fl.ikonY = Math.max(6, Math.min(innerHeight - 50, r.top + dy)); b.style.left = fl.ikonX + 'px'; b.style.top = fl.ikonY + 'px'; b.style.right = b.style.bottom = ''; if (dock) { b.removeAttribute('data-i-docka'); dockFor(null); varIDocka = false; } },
        () => {
          if (!b.dataset.drar) return;
          delete b.dataset.drar; b.dataset.dragen = '1'; setTimeout(() => { delete b.dataset.dragen; }, 50);
          // Släppt nära rälsen när menyn är infälld: tillbaka in i dockan
          if (html.hasAttribute('data-sido-dold') && fl.ikonX < 110) { fl.ikonX = fl.ikonY = null; varIDocka = false; }
          sparaFl(); placeraIkon();
        });
    });
    b.addEventListener('click', () => { if (b.dataset.dragen) return; fl.oppen = true; fl.min = false; sparaFl(); ritaFonster(true); });
    b.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ikonMeny(); });
    b.setAttribute('aria-haspopup', 'menu'); b.title = 'Öppna chatten · högerklicka för fler val';
  }
  /* Menyn på chattbubblan (som i Uperformance): olästa, Öppna chatten, Stör ej, Tillbaka till dockan och Stäng chatten */
  let imeny = null;
  function stangIkonMeny() { if (!imeny) return; const m = imeny; imeny = null; m.setAttribute('data-ut', ''); setTimeout(() => m.remove(), 200); document.removeEventListener('pointerdown', utanforIkonMeny, true); }
  function utanforIkonMeny(ev) { if (imeny && !imeny.contains(ev.target)) stangIkonMeny(); }
  function ikonMeny() {
    if (!ikon) return; if (imeny) { stangIkonMeny(); return; }
    const n = olastaTotalt(), tyst = !!pref().storEj, r = ikon.getBoundingClientRect();
    imeny = document.createElement('div'); imeny.className = 'chf-meny'; imeny.setAttribute('role', 'menu'); imeny.setAttribute('aria-label', 'Chatten');
    imeny.innerHTML = '<header><b>Chatten</b><small>' + (n ? n + (n === 1 ? ' oläst' : ' olästa') : 'Inga olästa') + '</small></header>' +
      '<button type="button" role="menuitem" data-chm="oppna">' + ik('prat') + '<span>Öppna chatten</span></button>' +
      '<button type="button" role="menuitemcheckbox" aria-checked="' + tyst + '" data-chm="tyst">' + ik(tyst ? 'mane' : 'bjallra') + '<span>Stör ej<small>' + (tyst ? 'På – inget ljud eller avisering' : 'Av') + '</small></span><i class="chf-meny__vaxel" aria-hidden="true"></i></button>' +
      (fl.ikonX != null ? '<button type="button" role="menuitem" data-chm="docka">' + ik('retur') + '<span>Flytta tillbaka bubblan</span></button>' : '') +
      '<button type="button" role="menuitem" data-chm="stang" class="chf-meny__stang">' + i('stang') + '<span>Stäng chatten</span></button>';
    document.body.appendChild(imeny);
    const mr = imeny.getBoundingClientRect();
    const vanster = r.left < innerWidth / 2;
    imeny.style.left = Math.max(8, Math.min(innerWidth - mr.width - 8, vanster ? r.right + 12 : r.left - mr.width - 12)) + 'px';
    imeny.style.top = Math.max(8, Math.min(innerHeight - mr.height - 8, r.top + r.height / 2 - mr.height / 2)) + 'px';
    imeny.style.transformOrigin = (vanster ? 'left' : 'right') + ' center';
    imeny.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-chm]'); if (!b) return;
      const v = b.getAttribute('data-chm');
      if (v === 'oppna') { stangIkonMeny(); fl.oppen = true; fl.min = false; sparaFl(); ritaFonster(true); }
      if (v === 'tyst') { satPref('storEj', !pref().storEj); stangIkonMeny(); ritaFonster(); IH.toast(pref().storEj ? 'Stör ej är på' : 'Stör ej är av', pref().storEj ? 'Inget ljud och ingen avisering – olästa räknas ändå.' : null, pref().storEj ? 'mane' : 'bjallra'); if (ikon) ikon.focus({ preventScroll: true }); }
      if (v === 'docka') { fl.ikonX = fl.ikonY = null; sparaFl(); stangIkonMeny(); placeraIkon(); if (ikon) ikon.focus({ preventScroll: true }); }
      if (v === 'stang') { stangIkonMeny(); fl.oppen = false; fl.min = false; if (minimal()) fl.dolMin = true; sparaFl(); ritaFonster(); }
    });
    setTimeout(() => document.addEventListener('pointerdown', utanforIkonMeny, true), 0);
    const forsta = imeny.querySelector('button'); if (forsta) forsta.focus({ preventScroll: true });
  }
  // Esc i fångstfasen, så att bara det översta lagret stängs (inte ett ark eller kundmötet bakom)
  addEventListener('keydown', (ev) => {
    if (imeny) {
      const knappar = [...imeny.querySelectorAll('[role^="menuitem"]')], n = knappar.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); stangIkonMeny(); if (ikon) ikon.focus({ preventScroll: true }); return; }
      if (ev.key === 'Tab') { stangIkonMeny(); return; }
      const steg = { ArrowDown: 1, ArrowUp: -1 }[ev.key], ytter = { Home: 0, End: knappar.length - 1 }[ev.key];
      if (steg || ytter != null) { ev.preventDefault(); (knappar[ytter != null ? ytter : (n + steg + knappar.length) % knappar.length] || knappar[0]).focus({ preventScroll: true }); }
      return;
    }
    if (ev.key !== 'Escape' || !fonster || !(ev.target.closest && ev.target.closest('.chf'))) return;
    ev.preventDefault(); ev.stopPropagation();
    if (ui.forslag) { ui.forslag = null; const b = fonster.querySelector('[data-ch-forslag]'); if (b) b.hidden = true; return; }
    if (ui.andrar || ui.svar || ui.emoji) { ui.andrar = ui.svar = null; ui.emoji = false; ritaAllt(); fokusText(true); return; }
    fl.min = true; sparaFl(); ritaFonster();
  }, true);
  // Layoutbytet (layout.js skickar ih:layout): till Minimal tar fram bubblan igen, från Minimal tar bort den om chatten är stängd
  addEventListener('ih:layout', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.layout === 'minimal' && d.forra !== 'minimal' && fl.dolMin) { fl.dolMin = false; sparaFl(); }
    ritaFonster();
  });
  IH.chattOppna = (kid) => { fl.oppen = true; fl.min = false; if (kid) fl.kanal = kid; sparaFl(); ritaFonster(true); };
  // Guiden ställer chatten åt sidan under en rundtur och tar fram den igen efteråt (sparas inte)
  let undan = false;
  IH.chattUndan = (pa) => {
    if (pa) { if (fonster && fl.oppen && !fl.min) { undan = true; fl.min = true; ritaFonster(); } }
    else if (undan) { undan = false; if (fl.oppen && fl.min) { fl.min = false; ritaFonster(); } }
  };
  // Sidbyte: fönstret står kvar som det är (ritas inte om); bara in/ut på chattsidan ändrar något
  addEventListener('hashchange', () => setTimeout(() => {
    const paSidan = /^#\/chatt/.test(location.hash);
    if (fonster && fl.oppen && !fl.min && !paSidan) return;
    if (ikon && !paSidan && (fl.oppen ? fl.min : minBubbla())) { uppdateraIkon(); return; }
    ritaFonster();
  }, 0));

  /* 08 Åtgärder ---------------------------------------------------------------------------------- */
  const G = IH.G;
  const meddelande = (id) => C().meddelanden.filter((m) => m.id === id)[0];
  const ytaFor = (el) => (el && el.closest('[data-ch-yta]')) || document;
  G['ch-reagera'] = (el) => {
    const m = meddelande(el.getAttribute('data-mid')); if (!m) return;
    const x = el.getAttribute('data-emoji'); m.reakt = m.reakt || {}; const l = m.reakt[x] = m.reakt[x] || [];
    const n = l.indexOf(jag()); if (n >= 0) l.splice(n, 1); else l.push(jag());
    ui.verktyg = null; IH.spara(); ritaAllt();
  };
  // Tipset i samtalslistan kan stängas – det kommer inte tillbaka
  G['ch-tips-stang'] = () => { satPref('tipsDolt', true); IH.rita(); };
  G['ch-svara'] = (el) => { ui.svar = el.getAttribute('data-mid'); ui.andrar = null; ui.verktyg = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  G['ch-kopiera'] = (el) => { const m = meddelande(el.getAttribute('data-mid')); if (!m) return; try { navigator.clipboard.writeText(klartext(m.text)); IH.toast('Kopierat', null, 'kopiera'); } catch (x) { /* */ } ui.verktyg = null; };
  G['ch-andra'] = (el) => { ui.andrar = el.getAttribute('data-mid'); ui.svar = null; ui.verktyg = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  G['ch-avbryt'] = (el) => { ui.andrar = null; ui.svar = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  let angra = null;
  G['ch-ta-bort'] = (el) => {
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.av !== jag()) return;
    const kopia = { text: m.text, filer: m.filer };
    m.borttagen = true; m.text = ''; delete m.filer; ui.verktyg = null; IH.spara(); ritaAllt();
    if (angra) angra.remove();
    angra = document.createElement('div'); angra.className = 'ch-angra'; angra.setAttribute('role', 'status');
    angra.innerHTML = '<span>Meddelandet togs bort</span><button type="button">Ångra</button>';
    const den = angra;
    den.querySelector('button').addEventListener('click', () => { m.borttagen = false; m.text = kopia.text; if (kopia.filer) m.filer = kopia.filer; IH.spara(); ritaAllt(); den.remove(); });
    document.body.appendChild(den);
    setTimeout(() => { if (den.isConnected) den.remove(); }, 6000);
  };
  G['ch-emoji'] = () => { ui.emoji = !ui.emoji; ritaAllt(); };
  G['ch-emoji-in'] = (el) => {
    const f = el.closest('form'), r = f.querySelector('textarea'), x = el.getAttribute('data-emoji');
    const a = r.selectionStart == null ? r.value.length : r.selectionStart, b = r.selectionEnd == null ? r.value.length : r.selectionEnd;
    r.value = r.value.slice(0, a) + x + r.value.slice(b); ui.utkast[f.getAttribute('data-kanal')] = r.value;
    r.focus(); r.setSelectionRange(a + x.length, a + x.length);
  };
  G['ch-snabb'] = (el) => { const f = ytaFor(el).querySelector('[data-ch-skriv]'); const r = f.querySelector('textarea'); r.value = el.getAttribute('data-text'); ui.utkast[f.getAttribute('data-kanal')] = r.value; r.focus(); };
  G['ch-bilaga-bort'] = (el) => { ui.bilagor.splice(+el.getAttribute('data-n'), 1); ritaAllt(); };
  G['ch-info'] = () => { ui.info = !ui.info; IH.rita(); };
  G['ch-tyst'] = (el) => {
    const kid = el.getAttribute('data-kanal'), c = C(), l = c.tyst[jag()] = c.tyst[jag()] || [], n = l.indexOf(kid);
    if (n >= 0) l.splice(n, 1); else l.push(kid);
    IH.spara(); ritaAllt(); IH.toast(n >= 0 ? 'Ljudet är på' : 'Konversationen är tystad', null, 'samtal');
  };
  G['ch-lamna'] = (el) => {
    const k = C().kanaler.filter((x) => x.id === el.getAttribute('data-kanal'))[0]; if (!k) return;
    if (!el.dataset.saker) { el.dataset.saker = '1'; el.textContent = 'Klicka igen för att lämna'; return; }
    systemMedd(k.id, fornamn(IH.jag()) + ' lämnade gruppen'); k.medlemmar = k.medlemmar.filter((x) => x !== jag());
    IH.spara(); ui.info = false; sidKanal = 'team'; IH.ga('#/chatt/team');
  };
  G['ch-pling'] = () => { satPref('pling', pref().pling === false); IH.rita(); };
  G['ch-avisera'] = () => {
    if (!('Notification' in window)) return;
    if (pref().avisera) { satPref('avisera', false); IH.rita(); return; }
    Notification.requestPermission().then((p) => { satPref('avisera', p === 'granted'); IH.rita(); if (p !== 'granted') IH.toast('Aviseringar är avstängda i webbläsaren', 'Tillåt aviseringar för sidan i webbläsarens inställningar.', 'varning'); });
  };
  G['chf-oppna'] = (el) => { fl.oppen = true; fl.min = false; fl.kanal = el.getAttribute('data-kanal'); sparaFl(); IH.ga('#/'); };
  G['ch-skriv-till'] = (el) => { const uid = el.getAttribute('data-uid'); if (uid === jag()) return; fl.oppen = true; fl.min = false; fl.kanal = privatId(jag(), uid); sparaFl(); ritaFonster(); fokusText(true); };
  // Ett meddelande från mig till en kollega (chefens påminnelser och fördelningar) – inte i supportläget
  IH.chattSkickaTill = (uid, text) => {
    if ((IH.visarSom && IH.visarSom()) || uid === jag()) return false;
    const m = { id: nyId('m'), kanal: privatId(jag(), uid), av: jag(), tid: new Date().toISOString(), text };
    C().meddelanden.push(m); kanda.add(m.id); IH.spara(); IH.uppdateraMeny(); if (fonster) ritaFonster();
    return true;
  };
  G['chf-min-sida'] = (el) => { fl.oppen = true; fl.min = true; fl.kanal = el.getAttribute('data-kanal'); sparaFl(); IH.ga('#/'); };
  G['chf-min'] = () => { fl.min = true; sparaFl(); ritaFonster(); };
  G['chf-stang'] = () => { fl.oppen = false; sparaFl(); ritaFonster(); };
  G['chf-lista'] = () => { fl.kanal = null; sparaFl(); ritaFonster(); };
  G['chf-kanal'] = (el) => { fl.kanal = el.getAttribute('data-kanal'); sparaFl(); ritaFonster(); fokusText(true); };
  G['chf-storej'] = () => { satPref('storEj', !pref().storEj); ritaFonster(); IH.toast(pref().storEj ? 'Stör ej är på' : 'Stör ej är av', pref().storEj ? 'Inget ljud och ingen avisering från chatten.' : null, 'samtal'); };
  G['ch-ny-grupp'] = () => {
    IH.oppnaArk({
      titel: 'Ny grupp', under: 'Välj kollegor och ge gruppen ett namn.', ikon: 'samtal',
      kropp: '<form id="ch-ny-form" data-ch-ny><label class="falt"><span>Namn</span><input name="namn" maxlength="40" placeholder="T.ex. Montage vecka 46"></label>' +
        '<div class="ch-valj">' + IH.ANVANDARE.filter((u) => u.id !== jag()).map((u) => '<label><input type="checkbox" name="vem" value="' + u.id + '">' + avatar(u, true) + '<span><b>' + e(u.namn) + '</b><small>' + e(u.titel) + '</small></span></label>').join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ch-ny-form">' + ik('plus') + 'Skapa grupp</button>'
    });
  };
  G['ch-bjud'] = (el) => {
    const k = C().kanaler.filter((x) => x.id === el.getAttribute('data-kanal'))[0]; if (!k) return;
    const kvar = IH.ANVANDARE.filter((u) => k.medlemmar.indexOf(u.id) < 0);
    if (!kvar.length) { IH.toast('Alla är redan med', null, 'kunder'); return; }
    IH.oppnaArk({ titel: 'Bjud in till ' + k.namn, ikon: 'kunder',
      kropp: '<form id="ch-bjud-form" data-ch-bjud data-kanal="' + k.id + '"><div class="ch-valj">' + kvar.map((u) => '<label><input type="checkbox" name="vem" value="' + u.id + '">' + avatar(u, true) + '<span><b>' + e(u.namn) + '</b><small>' + e(u.titel) + '</small></span></label>').join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ch-bjud-form">Bjud in</button>' });
  };
  function fokusText(iFonster) { requestAnimationFrame(() => { const rot = iFonster && fonster ? fonster : document.querySelector('[data-ch-yta="sida"]') || fonster; const r = rot && rot.querySelector('[data-ch-skriv] textarea'); if (r) { r.focus({ preventScroll: true }); const l = r.value.length; r.setSelectionRange(l, l); } }); }
  const vaxa = (r) => { r.style.height = 'auto'; r.style.height = Math.min(r.scrollHeight, 160) + 'px'; };
  // I fönstret byter samtalsraderna samtal i fönstret i stället för att lämna sidan
  document.addEventListener('click', (ev) => {
    const rad = ev.target.closest && ev.target.closest('.chf [data-ch-kanal]');
    if (rad) { ev.preventDefault(); fl.kanal = rad.getAttribute('data-ch-kanal'); sparaFl(); ritaFonster(); fokusText(true); }
  }, true);

  /* 09 Skicka, formulär och tangenter ------------------------------------------------------------- */
  function skicka(f) {
    if (IH.visarSom && IH.visarSom()) { IH.toast('Chatten är skrivskyddad i supportläget', 'Meddelanden skickas inte i ' + IH.visarSom().namn + 's namn. Lämna supportläget och skriv från ditt eget konto.', 'oga-av'); return; }
    const kid = f.getAttribute('data-kanal'), r = f.querySelector('textarea'), text = r.value.trim(), iF = !!f.closest('.chf');
    if (ui.andrar) {
      const m = meddelande(ui.andrar); ui.andrar = null;
      if (m && m.av === jag() && text && medLankar(text) !== m.text) { m.text = medLankar(text).slice(0, 4000); m.andrad = new Date().toISOString(); IH.spara(); }
      ritaAllt(); fokusText(iF); return;
    }
    if (!text && !ui.bilagor.length) return;
    const m = { id: nyId('m'), kanal: kid, av: jag(), tid: new Date().toISOString(), text: medLankar(text).slice(0, 4000) };
    if (ui.bilagor.length) m.filer = ui.bilagor.map((b) => ({ id: b.id, namn: b.namn, typ: b.typ, storlek: b.storlek, data: b.data, skanning: b.skanning }));
    const s = ui.svar && meddelande(ui.svar); if (s) m.svar = { mid: s.id, av: s.av, text: klartext(s.text).slice(0, 140) || (s.filer && s.filer[0] ? s.filer[0].namn : '') };
    C().meddelanden.push(m); kanda.add(m.id); ui.nya.add(m.id); ui.bilagor = []; ui.svar = null; ui.emoji = false; ui.utkast[kid] = '';
    // Det egna meddelandet är läst direkt – sparas i samma skrivning som meddelandet (en skrivning, inte två)
    const c = C(); c.last[jag()] = c.last[jag()] || {}; const forraLast = c.last[jag()][kid];
    if (!forraLast || forraLast < m.tid) c.last[jag()][kid] = m.tid;
    try { IH.spara(); } catch (x) { IH.toast('Meddelandet kunde inte sparas', 'Lagringen i webbläsaren är full – ta bort några bilder.', 'varning'); C().meddelanden.pop(); if (forraLast === undefined) delete c.last[jag()][kid]; else c.last[jag()][kid] = forraLast; }
    markeraLast(kid); ritaAllt(); fokusText(iF);
  }
  document.addEventListener('submit', (ev) => {
    const t = ev.target;
    if (t.matches('[data-ch-skriv]')) { ev.preventDefault(); skicka(t); }
    else if (t.matches('[data-ch-ny]')) {
      ev.preventDefault();
      const vem = [...t.querySelectorAll('input[name=vem]:checked')].map((x) => x.value);
      if (!vem.length) { IH.toast('Välj minst en kollega', null, 'varning'); return; }
      const namn = t.namn.value.trim() || [fornamn(IH.jag())].concat(vem.map((x) => fornamn(anv(x)))).join(', ');
      const k = { id: nyId('g'), typ: 'grupp', namn: namn.slice(0, 40), medlemmar: [jag()].concat(vem), skapad: new Date().toISOString() };
      C().kanaler.push(k); systemMedd(k.id, fornamn(IH.jag()) + ' skapade gruppen'); IH.spara(); IH.stangArk(); IH.ga('#/chatt/' + k.id);
    } else if (t.matches('[data-ch-bjud]')) {
      ev.preventDefault();
      const k = C().kanaler.filter((x) => x.id === t.getAttribute('data-kanal'))[0], vem = [...t.querySelectorAll('input[name=vem]:checked')].map((x) => x.value);
      if (!k || !vem.length) return;
      k.medlemmar = k.medlemmar.concat(vem); systemMedd(k.id, fornamn(IH.jag()) + ' bjöd in ' + vem.map((x) => fornamn(anv(x))).join(', ').replace(/, ([^,]*)$/, ' och $1'));
      IH.spara(); IH.stangArk(); ritaAllt();
    } else if (t.matches('[data-ch-namn]')) {
      ev.preventDefault();
      const k = C().kanaler.filter((x) => x.id === t.getAttribute('data-kanal'))[0], n = t.namn.value.trim().slice(0, 40);
      if (!k || !n || n === k.namn) return;
      k.namn = n; systemMedd(k.id, fornamn(IH.jag()) + ' döpte om gruppen till ' + n); IH.spara(); ritaAllt(); IH.toast('Gruppen har fått nytt namn', null, 'skriv');
    }
  });
  // @ och # – förslag medan man skriver
  function forslagFor(r) {
    const fore = r.value.slice(0, r.selectionStart), m = /(^|\s)([@#])([^\s@#]{0,30})$/.exec(fore);
    if (!m) return null;
    const q = m[3].toLowerCase(), k = kanal(r.closest('form').getAttribute('data-kanal'));
    let lista;
    if (m[2] === '@') lista = (k ? k.medlemmar : []).filter((id) => id !== jag()).map(anv).filter((u) => u.namn.toLowerCase().indexOf(q) >= 0).map((u) => ({ text: '@' + fornamn(u) + ' ', namn: u.namn, under: u.titel, av: u }));
    else lista = db().kunder.filter((x) => x.namn.toLowerCase().indexOf(q) >= 0).map((x) => ({ text: '#' + x.namn + ' ', namn: x.namn, under: 'Kund · ' + (x.ort || ''), ikon: 'kunder' }))
      .concat(db().affarer.filter((a) => a.titel.toLowerCase().indexOf(q) >= 0).map((a) => ({ text: '#' + a.titel + ' ', namn: a.titel, under: 'Affär · ' + IH.steg(a.steg).namn, ikon: 'portfolj' })));
    return lista.length ? { lista: lista.slice(0, 7), fran: fore.length - m[2].length - m[3].length, vald: 0 } : null;
  }
  function visaForslag(r, behallVal) {
    const box = r.closest('form').querySelector('[data-ch-forslag]');
    const vald = behallVal && ui.forslag ? ui.forslag.vald : 0;
    ui.forslag = forslagFor(r);
    if (!ui.forslag) { box.hidden = true; return; }
    ui.forslag.vald = Math.min(vald, ui.forslag.lista.length - 1);
    box.hidden = false;
    box.innerHTML = ui.forslag.lista.map((x, n) => '<button type="button" class="' + (n === ui.forslag.vald ? 'vald' : '') + '" data-ch-valj="' + n + '">' + (x.av ? avatar(x.av, true) : '<span class="ch-forslag__ikon">' + ik(x.ikon) + '</span>') + '<span><b>' + e(x.namn) + '</b><small>' + e(x.under) + '</small></span></button>').join('');
  }
  function valjForslag(r, n) {
    const f = ui.forslag; if (!f) return;
    const x = f.lista[n], slut = r.value.slice(r.selectionStart);
    r.value = r.value.slice(0, f.fran) + x.text + slut; const p = f.fran + x.text.length; r.setSelectionRange(p, p);
    ui.forslag = null; r.closest('form').querySelector('[data-ch-forslag]').hidden = true; r.focus();
    ui.utkast[r.closest('form').getAttribute('data-kanal')] = r.value;
  }
  document.addEventListener('mousedown', (ev) => { const b = ev.target.closest && ev.target.closest('[data-ch-valj]'); if (!b) return; ev.preventDefault(); valjForslag(b.closest('form').querySelector('textarea'), +b.getAttribute('data-ch-valj')); });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('[data-ch-sok]')) { ui.sok = t.value; document.querySelectorAll('.ch-lista [data-ch-listan]').forEach((n) => { n.innerHTML = listaHtml(sidKanal); }); return; }
    if (!(t.closest && t.closest('[data-ch-skriv]')) || t.tagName !== 'TEXTAREA') return;
    vaxa(t); ui.utkast[t.closest('form').getAttribute('data-kanal')] = t.value; visaForslag(t);
  });
  document.addEventListener('keydown', (ev) => {
    const r = ev.target; if (!(r.closest && r.closest('[data-ch-skriv]')) || r.tagName !== 'TEXTAREA') return;
    const f = ui.forslag;
    if (f && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { ev.preventDefault(); f.vald = (f.vald + (ev.key === 'ArrowDown' ? 1 : -1) + f.lista.length) % f.lista.length; r.closest('form').querySelectorAll('[data-ch-valj]').forEach((b, j) => b.classList.toggle('vald', j === f.vald)); return; }
    if (f && (ev.key === 'Enter' || ev.key === 'Tab')) { ev.preventDefault(); valjForslag(r, f.vald); return; }
    if (ev.key === 'Escape') { if (f) { ui.forslag = null; r.closest('form').querySelector('[data-ch-forslag]').hidden = true; } else if (ui.andrar || ui.svar || ui.emoji) { ui.andrar = ui.svar = null; ui.emoji = false; const iF = !!r.closest('.chf'); ritaAllt(); fokusText(iF); } return; }
    if (ev.key === 'ArrowUp' && !r.value) {
      const kid = r.closest('form').getAttribute('data-kanal'), egna = iKanal(kid).filter((m) => m.av === jag() && !m.borttagen && !m.system);
      if (egna.length) { ev.preventDefault(); ui.andrar = egna[egna.length - 1].id; const iF = !!r.closest('.chf'); ritaAllt(); fokusText(iF); }
      return;
    }
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); skicka(r.closest('form')); }
  });
  // Citatet hoppar till originalet; tryck på ett meddelande (pekskärm) visar verktygen
  document.addEventListener('click', (ev) => {
    const c = ev.target.closest && ev.target.closest('[data-ch-hoppa]');
    if (c) { const m = ytaFor(c).querySelector('.ch-medd[data-mid="' + c.getAttribute('data-ch-hoppa') + '"]'); if (m) { m.scrollIntoView({ block: 'center', behavior: lugn() ? 'auto' : 'smooth' }); m.classList.remove('blixt'); void m.offsetWidth; m.classList.add('blixt'); } return; }
    if (pek()) {
      const m = ev.target.closest && ev.target.closest('.ch-medd');
      if (m && !ev.target.closest('button, a')) { ui.verktyg = ui.verktyg === m.getAttribute('data-mid') ? null : m.getAttribute('data-mid'); document.querySelectorAll('.ch-medd').forEach((x) => x.classList.toggle('visa-verktyg', x.getAttribute('data-mid') === ui.verktyg)); }
    }
  });

  /* 10 Filer: välj, dra in, klistra in – bilder skalas till JPEG ---------------------------------- */
  const TAK = 2.5 * 1048576;
  const FARLIG = /\.(exe|bat|cmd|com|js|vbs|ps1|msi|scr|jar|html?|xhtml?|xht|shtml?|svgz?|xml|xsl|xslt|mht|mhtml|hta|lnk)$/i;
  function lasFil(fil) {
    return new Promise((klar) => {
      const r = new FileReader();
      if (FARLIG.test(fil.name)) { klar({ fel: fil.name + ' – filtypen är inte tillåten' }); return; }
      if (fil.type.indexOf('image/') === 0) {
        r.onload = () => {
          const img = new Image();
          img.onload = () => {
            const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            const data = c.toDataURL('image/jpeg', 0.82);
            klar({ id: nyId('f'), namn: fil.name.replace(/\.\w+$/, '') + '.jpg', typ: 'image/jpeg', storlek: Math.round(data.length * 0.75), data });
          };
          img.onerror = () => klar({ fel: fil.name + ' – bilden gick inte att läsa' }); img.src = r.result;
        };
        r.readAsDataURL(fil);
      } else if (fil.size <= 900 * 1024) {
        r.onload = () => klar({ id: nyId('f'), namn: fil.name, typ: fil.type || 'application/octet-stream', storlek: fil.size, data: r.result }); r.readAsDataURL(fil);
      } else klar({ fel: fil.name + ' – större än 900 kB' });
    });
  }
  function laggTill(filer, iF) {
    const sk = (fil) => { const r = window.IHFilskanner && IHFilskanner.resultat(fil); return r ? { status: r.status, tid: r.tid } : undefined; };
    Promise.all([...filer].slice(0, 6).map((fil) => lasFil(fil).then((b) => { if (b && !b.fel && sk(fil)) b.skanning = sk(fil); return b; }))).then((lista) => {
      const fel = lista.filter((x) => x && x.fel).map((x) => x.fel);
      let summa = ui.bilagor.reduce((t, b) => t + b.storlek, 0);
      lista.forEach((b) => { if (b && !b.fel) { if (summa + b.storlek > TAK) fel.push(b.namn + ' – bilagorna blir för stora'); else { ui.bilagor.push(b); summa += b.storlek; } } });
      if (fel.length) IH.toast('Några filer bifogades inte', fel.join(' · '), 'varning');
      ritaAllt(); fokusText(iF);
    });
  }
  document.addEventListener('change', (ev) => { if (ev.target.matches && ev.target.matches('[data-ch-fil]')) { laggTill(ev.target.files, !!ev.target.closest('.chf')); ev.target.value = ''; } });
  const harFiler = (ev) => ev.dataTransfer && [...ev.dataTransfer.types].indexOf('Files') >= 0;
  document.addEventListener('dragover', (ev) => { const z = ev.target.closest && ev.target.closest('[data-ch-yta]'); if (z && harFiler(ev)) { ev.preventDefault(); z.setAttribute('data-slapp', ''); } });
  document.addEventListener('dragleave', (ev) => { const z = ev.target.closest && ev.target.closest('[data-ch-yta]'); if (z && !z.contains(ev.relatedTarget)) z.removeAttribute('data-slapp'); });
  document.addEventListener('drop', (ev) => { const z = ev.target.closest && ev.target.closest('[data-ch-yta]'); if (!z || !harFiler(ev)) return; ev.preventDefault(); z.removeAttribute('data-slapp'); laggTill(ev.dataTransfer.files, !!z.closest('.chf')); });
  document.addEventListener('paste', (ev) => { if (!(ev.target.closest && ev.target.closest('[data-ch-skriv]'))) return; const f = [...((ev.clipboardData || {}).files || [])]; if (f.length) { ev.preventDefault(); const iF = !!ev.target.closest('.chf'); if (window.IHFilskanner) IHFilskanner.granska(f, { kalla: 'chatt' }).then((ok) => { if (ok.length) laggTill(ok, iF); }); else laggTill(f, iF); } });

  /* 11 Nytt från en annan flik: pling, notis och avisering ---------------------------------------- */
  let kanda = new Set(C().meddelanden.map((m) => m.id));
  function pling() {
    if (pref().pling === false || pref().storEj) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), t = ac.currentTime;
      [[880, 0], [1320, 0.12]].forEach(([hz, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = hz;
        g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.08, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
        o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.4);
      });
      setTimeout(() => ac.close(), 900);
    } catch (x) { /* inget ljud */ }
  }
  function kolla() {
    const nya = C().meddelanden.filter((m) => !kanda.has(m.id));
    kanda = new Set(C().meddelanden.map((m) => m.id));
    const tillMig = nya.filter((m) => m.av !== jag() && !m.system && kanal(m.kanal) && !tystad(m.kanal));
    if (!tillMig.length) return;
    const m = tillMig[tillMig.length - 1], u = anv(m.av), k = kanal(m.kanal);
    pling();
    const syns = (/^#\/chatt/.test(location.hash) && sidKanal === m.kanal) || (fl.oppen && !fl.min && fl.kanal === m.kanal);
    if (!syns && !pref().storEj) IH.toast(fornamn(u) + (namnerMig(m) ? ' nämnde dig' : k.typ === 'privat' ? '' : ' i ' + kanalNamn(k)), klartext(m.text).slice(0, 90) || 'Skickade en fil', 'samtal', { lank: '#/chatt/' + m.kanal, knapp: 'Svara' });
    if (pref().avisera && document.visibilityState === 'hidden' && !pref().storEj && 'Notification' in window && Notification.permission === 'granted') {
      try { const n = new Notification(u.namn + (k.typ === 'privat' ? '' : ' · ' + kanalNamn(k)), { body: klartext(m.text).slice(0, 140), tag: m.kanal, silent: true }); n.onclick = () => { focus(); location.hash = '#/chatt/' + m.kanal; n.close(); }; } catch (x) { /* */ }
    }
  }
  addEventListener('storage', (ev) => { if (ev.key === IH.NYCKEL) setTimeout(() => { kolla(); ritaFonster(); satTitel(); }, 60); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && /^#\/chatt/.test(location.hash) && sidKanal) markeraLast(sidKanal); });

  /* 12 Fliktiteln: "(3) Säljtavla · Legohus CRM" ------------------------------------------------- */
  function satTitel() {
    const n = olastaTotalt(), ren = document.title.replace(/^\(\d+\)\s/, '');
    const ny = (n ? '(' + n + ') ' : '') + ren;
    if (document.title !== ny) document.title = ny;
  }
  const titel = document.querySelector('title');
  if (titel) new MutationObserver(satTitel).observe(titel, { childList: true });

  // Kontobyte i demon: ingen gammal tråd, inga utkast eller val följer med
  const valjAnv = G['valj-anvandare'];
  G['valj-anvandare'] = (el) => {
    ui.sok = ''; ui.svar = ui.andrar = null; ui.emoji = false; ui.bilagor = []; ui.utkast = {}; sidKanal = null; fl.kanal = null; sparaFl();
    valjAnv(el); kanda = new Set(C().meddelanden.map((m) => m.id)); ritaFonster(); satTitel();
  };
  setTimeout(() => { ritaFonster(); satTitel(); }, 0);
})();
