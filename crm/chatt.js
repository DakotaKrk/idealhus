/* Legohus CRM – chatten (2026-10-28, samma funktioner som Uperformance CRM:s chatt.js, i Legohus kod och färger).
   - #/chatt[/id]: konversationerna (sök med utdrag, Ny grupp, olästa, @-bricka och utkast), tråden och Om konversationen
     (medlemmar, bjud in, byt namn, länkat i konversationen, delade filer, tysta, lämna, simulera ett svar).
     Hela teamet + privata konversationer (räknas fram) + grupper (sparas).
   - Meddelanden: datumrubriker, "Nya meddelanden", reaktioner, svara med citat, kopiera, ändra och ta bort det egna
     (med Ångra), "ändrad", "Läst"/"Sett av", bilder och filer, stora emoji när meddelandet bara är emoji.
     Menyn Mer (och högerklick): skapa uppgift, påminn mig, fäst (högst 3), markera som oläst. Sök i tråden (Ctrl+F),
     "N nya meddelanden ↓", länkkort för #kund och #affär, pilar i tråden (R svara, E ändra, P fäst, T uppgift).
   - Mallar: / först i rutan, Tab hoppar mellan fälten. Ctrl+J går till nästa olästa konversation.
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
    if (!c.fasta || typeof c.fasta !== 'object' || Array.isArray(c.fasta)) c.fasta = {};
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
  // Tystade konversationer räknas bara när någon nämner dig – samma tal i menyn, fliktiteln, bubblan och dockan
  const olastaTotalt = () => kanaler().reduce((t, k) => t + (tystad(k.id) && !olastaNamn(k.id) ? 0 : olasta(k.id)), 0);
  IH.chattOlasta = olastaTotalt;
  const tystad = (id) => (C().tyst[jag()] || []).indexOf(id) >= 0;
  // Fästa meddelanden per konversation (högst 3) – bara de som finns kvar och inte är borttagna
  const fasta = (kid) => { const l = C().fasta[kid]; return (Array.isArray(l) ? l : []).filter((f) => f && typeof f.mid === 'string' && meddelande(f.mid) && !meddelande(f.mid).borttagen); };
  const arFast = (mid, kid) => fasta(kid).some((f) => f.mid === mid);
  function markeraLast(id) {
    // "Markera som oläst": konversationen blir inte läst igen förrän man lämnat den och kommit tillbaka
    if (ui.olastKvar === id) return;
    const c = C(), m = senast(id); if (!m || (IH.visarSom && IH.visarSom())) return; // supportläget: inget blir läst åt säljaren
    c.last[jag()] = c.last[jag()] || {};
    if (!c.last[jag()][id] || c.last[jag()][id] < m.tid) { c.last[jag()][id] = m.tid; IH.spara(); IH.uppdateraMeny(); satTitel(); }
    avisLast(id);
  }
  // Aviseringscentret (IH.avisera i app.js): en rad per konversation som uppdateras i stället för en per meddelande,
  // och raden blir läst samtidigt som konversationen – klockan räknar alltså inte chattens olästa en gång till
  const avisNyckel = (kid) => 'chatt:' + kid;
  function avisLast(kid) {
    if (!IH.avisera || typeof IH.avisera.las !== 'function' || (IH.visarSom && IH.visarSom())) return;
    try { IH.avisera.las(avisNyckel(kid), jag()); } catch (x) { /* aviseringscentret saknas */ }
  }
  function avisera(rad) {
    if (typeof IH.avisera !== 'function' || (IH.visarSom && IH.visarSom())) return;
    try { IH.avisera(Object.assign({ till: jag() }, rad)); } catch (x) { /* aviseringscentret saknas */ }
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
      .replace(/\[\[(kund|affar):([a-z0-9]+)\]\]/g, (m, typ, id) => { const o = objekt(typ, id); return o ? '<a class="ch-obj" href="' + o.href + '" data-ch-obj="' + typ + ':' + id + '" aria-haspopup="dialog">' + ik(o.ikon) + '<span><b>' + e(o.namn) + '</b>' + (o.under ? '<small>' + e(o.under) + '</small>' : '') + '</span></a>' : ''; })
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
  // Sökträffar: <mark> bara i text, aldrig inne i taggar (texten är redan escapad – söket escapas likadant)
  function markera(html, q, aktiv) {
    if (!q) return html;
    const s = e(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(s, 'gi');
    return html.split(/(<[^>]*>)/).map((bit, n) => (n % 2 ? bit : bit.replace(re, (x) => '<mark class="ch-mark' + (aktiv ? ' aktiv' : '') + '">' + x + '</mark>'))).join('');
  }
  const traffar = (kid, q) => { q = String(q || '').trim().toLowerCase(); return !q ? [] : iKanal(kid).filter((m) => !m.system && !m.borttagen && klartext(m.text).toLowerCase().indexOf(q) >= 0); };
  // Utdrag runt träffen i listan: lite text före, träffen märkt
  function utdrag(text, q) {
    const t = klartext(text), n = t.toLowerCase().indexOf(q.toLowerCase()); if (n < 0) return '';
    const fran = Math.max(0, n - 24);
    return (fran ? '…' : '') + markera(e(t.slice(fran, n + q.length + 60)), q);
  }
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
  // nyaIn: nya från andra (annan animation) · nyaUnder: kom in medan man läste längre upp · sokTrad: { q, n } sök i tråden ·
  // markerad: meddelandet med pilfokus · olastKvar: konversationen man just markerade som oläst · pop: reaktionen som just ändrats
  const ui = { sok: '', info: false, emoji: false, svar: null, andrar: null, bilagor: [], utkast: {}, nya: new Set(), nyaIn: new Set(), forslag: null, verktyg: null,
    nyaUnder: 0, sokTrad: null, markerad: null, olastKvar: null, pop: null, egetNytt: false, mallar: null, mall: false, fastOppen: false, skriver: null };
  // Allt som hör till en konversation nollställs när man byter – inget svar, ingen ändring eller bilaga följer med
  // (ui.kanalFor = konversationen som läget hör till – sidan och fönstret delar läget)
  function bytKanal(kid) {
    ui.kanalFor = kid || null;
    ui.svar = ui.andrar = ui.forslag = ui.verktyg = ui.sokTrad = ui.markerad = ui.mallar = null; ui.bilagor = []; ui.emoji = false; ui.mall = false;
    ui.nyaUnder = 0; ui.fastOppen = false; ui.olastKvar = null; stangMeny(); stangObjkort();
  }
  // Mallar för bygg-sälj: / först i rutan. {fält} fylls i med Tab; {kund} och {affär} öppnar #-förslagen
  const MALLAR = [['Bekräfta platsbesök', 'Bekräftar platsbesöket {datum} kl. {tid}.'], ['Offerten är skickad', 'Offerten på {affär} är skickad.'],
    ['Be någon ringa', 'Kan du ringa {kund}? De har frågor om {ämne}.'], ['Grunden är gjuten', 'Grunden är gjuten – montaget kan bokas.'],
    ['Ta över en kund', 'Jag tar över {kund} från och med {datum}.'], ['Ny förfrågan', 'Ny förfrågan från {kund} – vem tar den?']];
  const allaMallar = () => MALLAR.concat((Array.isArray(db().mallar) ? db().mallar : [])
    .filter((m) => m && m.kanal === 'chatt' && typeof m.text === 'string' && m.text.trim())
    .map((m) => [String(m.namn || 'Mall').slice(0, 60), m.text.slice(0, 2000)]));
  const FALT = /\{([a-zåäö_]{2,20})\}/i;
  // Utkasten överlever en omladdning (per konto och konversation)
  (function () { const u = (pref().utkast || {})[IH.jag().id]; if (u && typeof u === 'object') Object.keys(u).forEach((k) => { if (typeof u[k] === 'string') ui.utkast[k] = u[k]; }); })();
  let utkastTimer = 0;
  function sparaUtkast(kid, text) {
    ui.utkast[kid] = text; clearTimeout(utkastTimer);
    const vem = jag(), alla = ui.utkast;
    utkastTimer = setTimeout(() => { const p = pref().utkast || {}, mina = {}; Object.keys(alla).forEach((k) => { if (alla[k] && alla[k].trim()) mina[k] = alla[k].slice(0, 4000); }); p[vem] = mina; satPref('utkast', p); }, 400);
  }
  const EMOJI = [['Vanliga', '👍 ❤️ 😊 😂 🙌 👏 🎉 🔥 ✅ 👀 🙏 💪 😅 🤔 😮 😢 👌 ✨ 💯 🚀'], ['Bygget', '🏠 🏡 🏗️ 🔨 🪵 🧱 🚚 📐 🔑 🌲 🌊 ☀️ 🌧️ ❄️ ☕ 📅 📞 ✉️ 📄 💰']];
  const SNABB = ['👍', '❤️', '😊', '🎉'];

  /* 05 Ritning: listan, tråden och om konversationen------------------------------------------------- */
  const avatar = (u, liten) => '<span class="avatar' + (liten ? ' avatar--liten' : '') + '" style="--av:' + u.farg + '">' + IH.initialer(u.namn) + (IH.narvaroPrick ? IH.narvaroPrick(u.id) : '') + '</span>';
  const kanalAvatar = (k, liten) => (k.typ === 'privat' ? avatar(motpart(k), liten) : '<span class="avatar ch-gruppav' + (liten ? ' avatar--liten' : '') + '">' + ik(k.typ === 'team' ? 'kunder' : 'prat') + '</span>');
  function listaHtml(aktiv) {
    const q = ui.sok.trim().toLowerCase();
    let lista = kanaler().map((k) => ({ k, m: senast(k.id) })).filter((x) => x.m || x.k.typ !== 'privat' || x.k.id === aktiv).sort((a, b) => ((b.m ? b.m.tid : '') > (a.m ? a.m.tid : '') ? 1 : -1));
    if (q) lista = lista.filter((x) => kanalNamn(x.k).toLowerCase().indexOf(q) >= 0 || iKanal(x.k.id).some((m) => klartext(m.text).toLowerCase().indexOf(q) >= 0));
    return lista.map(({ k, m }) => {
      const at = k.id !== aktiv && olastaNamn(k.id), n = k.id === aktiv || (tystad(k.id) && !at) ? 0 : olasta(k.id);
      const forhand = m ? (m.av === jag() ? 'Du: ' : k.typ !== 'privat' && !m.system ? fornamn(anv(m.av)) + ': ' : '') + (m.borttagen ? 'Meddelandet togs bort' : klartext(m.text) || (m.filer && m.filer.length ? 'Fil: ' + m.filer[0].namn : '')) : 'Inga meddelanden än';
      // Sök: utdrag med träffen · utkast: "Utkast:" först (inte i den öppna konversationen – där står det i rutan)
      const traff = q && traffar(k.id, q), utk = k.id !== aktiv && (ui.utkast[k.id] || '').trim();
      const under = traff && traff.length ? '<small class="ch-rad__utdrag">' + utdrag(traff[traff.length - 1].text, q) + '</small>'
        : utk ? '<small><em class="ch-rad__utkast">Utkast:</em> ' + e(utk.slice(0, 80)) + '</small>' : '<small>' + e(forhand) + '</small>';
      return '<a class="ch-rad' + (k.id === aktiv ? ' vald' : '') + (n ? ' olast' : '') + '" href="#/chatt/' + k.id + '" data-ch-kanal="' + k.id + '" title="' + e(kanalNamn(k)) + '"' + (k.id === aktiv ? ' aria-current="page"' : '') + '>' + kanalAvatar(k) +
        '<span class="ch-rad__text"><b>' + e(kanalNamn(k)) + (tystad(k.id) ? ik('bjallra-av') : '') + '</b>' + under + '</span>' +
        '<span class="ch-rad__hoger">' + (m ? '<small>' + listTid(m.tid) + '</small>' : '') + (at ? '<i class="ch-at">@</i>' : n ? '<i class="ch-olast">' + n + '</i>' : '') + '</span></a>';
    }).join('') || '<p class="ch-inga">Inga konversationer matchar.</p>';
  }
  // Märket från filskannern (filskanner.js): grön sköld när filen är ren, gul varning annars
  const skannad = (f) => (f.skanning ? '<span class="ch-skannad" data-status="' + e(f.skanning.status) + '" title="' + (f.skanning.status === 'ren' ? 'Virusskannad – inga hot hittades' : 'Släppt igenom med varning') + '">' + ik(f.skanning.status === 'ren' ? 'skold' : 'varning') + (f.skanning.status === 'ren' ? 'Skannad' : 'Varning') + '</span>' : '');
  // Videomötet som startades i konversationen (videomote.js): "Videomöte · pågår" med Anslut, efteråt längden
  function vmKort(m) {
    if (!m.videomote || m.borttagen || typeof m.videomote !== 'string') return '';
    const vm = IH.videomote, v = vm && vm.hamta(m.videomote), ikon = IH.vmIk ? IH.vmIk() : ik('kamera');
    if (!v) return '<span class="ch-vmkort" data-lage="borta">' + ikon + '<span><b>Videomöte</b><small>Mötet finns inte längre</small></span></span>';
    const l = vm.lage(v), n = (v.deltagare || []).length;
    // hur många som är inne vet bara mötet självt – kortet räknar de inbjudna (värden oräknad)
    const under = l === 'avslutat' ? (v.minuter ? v.minuter + ' min' : 'Avslutat') : l === 'pagar' ? 'pågår' + (n ? ' · ' + n + (n === 1 ? ' inbjuden' : ' inbjudna') : '') : l === 'nu' ? 'börjar nu' : l === 'passerat' ? 'tiden har passerat' : vm.narText(v);
    return '<span class="ch-vmkort" data-lage="' + l + '">' + ikon + '<span><b>Videomöte</b><small>' + e(under) + '</small></span>' +
      (l === 'avslutat' || l === 'passerat' ? '' : '<button type="button" class="knapp knapp--liten knapp--virke" data-g="vm-anslut" data-id="' + e(v.id) + '" tabindex="-1">Anslut</button>') + '</span>';
  }
  function meddHtml(m, foreg, sok) {
    const u = anv(m.av), egen = m.av === jag();
    if (m.system) return '<p class="ch-system">' + e(m.text) + '</p>';
    const fortsatt = foreg && !foreg.system && foreg.av === m.av && new Date(m.tid) - new Date(foreg.tid) < 5 * 60000 && dagNr(foreg.tid) === dagNr(m.tid);
    const bara = !m.borttagen && m.text && BARA_EMOJI.test(m.text) && [...m.text.trim()].length <= 8;
    const orig = m.svar && meddelande(m.svar.mid), bort = m.svar && (!orig || orig.borttagen);
    const svar = m.svar ? '<button type="button" class="ch-citat" data-ch-hoppa="' + e(m.svar.mid) + '" tabindex="-1"><b>' + e(fornamn(anv(m.svar.av))) + '</b><span>' + (bort ? '<i>Meddelandet togs bort</i>' : e(m.svar.text)) + '</span></button>' : '';
    // Bilagor visas bara som data-URL (FileReader/canvas); allt annat ritas utan länk
    const url = (f) => (typeof f.data === 'string' && DATAURL.test(f.data) ? e(f.data) : '');
    const filer = (m.filer || []).map((f) => (f.typ && String(f.typ).indexOf('image/') === 0 && url(f)
      ? '<a class="ch-bild" href="' + url(f) + '" download="' + e(f.namn) + '"><img src="' + url(f) + '" alt="' + e(f.namn) + '" loading="lazy">' + skannad(f) + '</a>'
      : '<a class="ch-fil"' + (url(f) ? ' href="' + url(f) + '" download="' + e(f.namn) + '"' : '') + '>' + ik('gem') + '<span><b>' + e(f.namn) + '</b><small>' + storlek(f.storlek || 0) + '</small></span>' + skannad(f) + '</a>')).join('');
    // Inga reaktioner på ett borttaget meddelande
    const reakt = m.reakt && !m.borttagen ? Object.keys(m.reakt).filter((x) => Array.isArray(m.reakt[x]) && m.reakt[x].length).map((x) => { const min = m.reakt[x].indexOf(jag()) >= 0;
      return '<button type="button" class="ch-reakt' + (min ? ' min' : '') + (ui.pop === m.id + x ? ' pop' : '') + '" data-g="ch-reagera" data-mid="' + e(m.id) + '" data-emoji="' + e(x) + '" aria-pressed="' + min + '" tabindex="-1" title="' + e(m.reakt[x].map((id) => fornamn(anv(id))).join(', ')) + '" aria-label="' + e(x) + ' ' + m.reakt[x].length + (min ? ', du har reagerat' : '') + '">' + e(x) + ' <b>' + m.reakt[x].length + '</b></button>'; }).join('') : '';
    // Verktygen nås med Tab bara på det markerade meddelandet (ett tabbstopp för hela tråden)
    const ti = ui.markerad === m.id ? '' : ' tabindex="-1"';
    const verktyg = m.borttagen ? '' : '<span class="ch-verktyg" role="toolbar" aria-label="Åtgärder">' + SNABB.map((x) => '<button type="button" data-g="ch-reagera" data-mid="' + m.id + '" data-emoji="' + x + '" aria-label="Reagera ' + x + '"' + ti + '>' + x + '</button>').join('') +
      '<button type="button" data-g="ch-svara" data-mid="' + m.id + '" title="Svara (R)" aria-label="Svara"' + ti + '>' + ik('retur') + '</button>' +
      '<button type="button" data-g="ch-mer" data-mid="' + m.id + '" title="Mer" aria-label="Fler åtgärder" aria-haspopup="menu" aria-expanded="' + (menyMid === m.id) + '"' + ti + '>' + ik('mer') + '</button></span>';
    const pam = m.paminn && m.paminn[jag()] && !m.paminn[jag()].visad ? m.paminn[jag()] : null;
    const tidHtml = (iso) => '<time datetime="' + e(iso) + '">' + klocka(iso) + '</time>';
    const ex = m.exempel ? ' · exempel' : '';
    const text = m.borttagen ? '<i>Meddelandet togs bort</i>' : markera(formatera(m.text), sok, sok && ui.sokTrad && ui.sokTrad.aktiv === m.id);
    const fast = arFast(m.id, m.kanal);
    return '<div class="ch-medd' + (egen ? ' egen' : '') + (fortsatt ? ' fortsatt' : '') + (namnerMig(m) && !egen ? ' namner' : '') + (ui.nya.has(m.id) ? ' ny' + (ui.nyaIn.has(m.id) ? ' ny--in' : '') : '') +
      (ui.andrar === m.id ? ' andras' : '') + (ui.verktyg === m.id ? ' visa-verktyg' : '') + (ui.markerad === m.id ? ' markerad' : '') + (fast ? ' fast' : '') + (pam ? ' paminn' : '') + (sok ? ' traff' : '') +
      '" data-mid="' + e(m.id) + '" tabindex="' + (ui.markerad === m.id ? '0' : '-1') + '" aria-label="' + e((egen ? 'Du' : u.namn) + ', ' + klocka(m.tid) + (fast ? ', fäst' : '')) + '">' +
      (egen ? '' : fortsatt ? '<span class="ch-medd__plats"></span>' : avatar(u, true)) +
      '<div class="ch-medd__kropp">' + (egen || fortsatt ? '' : '<b class="ch-medd__namn">' + e(u.namn) + '<small>' + tidHtml(m.tid) + ex + '</small></b>') +
        '<div class="ch-bubbla' + (bara ? ' stor' : '') + (m.borttagen ? ' borta' : '') + '">' + svar + text + vmKort(m) + filer +
          (egen || fortsatt ? '<small class="ch-tid">' + tidHtml(m.tid) + (m.andrad ? ' · ändrad' : '') + ex + '</small>' : m.andrad ? '<small class="ch-tid">ändrad</small>' : '') + '</div>' +
        (reakt ? '<div class="ch-reaktioner">' + reakt + '</div>' : '') +
        (pam ? '<small class="ch-paminn">' + ik('klocka') + 'Påminner ' + e(narText(pam.tid)) + '</small>' : '') + '</div>' + verktyg + '</div>';
  }
  function tradHtml(k) {
    const lista = iKanal(k.id), forra = lastTill(k.id), st = ui.sokTrad && ui.sokTrad.kanal === k.id ? ui.sokTrad : null;
    const traffMid = st ? new Set(traffar(k.id, st.q).map((m) => m.id)) : null;
    // Tom konversation: ett enda block med tre förslag att börja med
    if (!lista.length) {
      const forslag = k.typ === 'privat' ? ['Hej!', 'Har du en minut?', 'Kan vi ta det på telefon?'] : ['Hej allihop!', 'Läget?', 'Någon som har koll på …'];
      return '<div class="ch-tom">' + kanalAvatar(k).replace('class="avatar', 'class="ch-tom__avatar avatar') + '<b>' + e(kanalNamn(k)) + '</b><p>' +
        (k.typ === 'privat' ? 'Början på er konversation – bara ni två ser den.' : 'Inga meddelanden än – alla i konversationen ser det du skriver.') + '</p>' +
        '<div class="ch-tom__forslag">' + forslag.map((x) => '<button type="button" data-g="ch-snabb" data-text="' + e(x) + '">' + e(x) + '</button>').join('') + '</div></div>';
    }
    let html = '<div class="ch-intro">' + kanalAvatar(k) + '<div><b>' + e(kanalNamn(k)) + '</b><small>' + (k.typ === 'privat' ? 'Början på er konversation' : k.typ === 'team' ? 'Alla i teamet · ' + k.medlemmar.length + ' personer' : 'Gruppen · ' + k.medlemmar.length + ' personer') + '</small></div></div>', dag = '', ny = false, foreg = null;
    lista.forEach((m) => {
      const d = new Date(m.tid).toDateString();
      if (d !== dag) { html += (dag ? '</div>' : '') + '<div class="ch-dagblock"><p class="ch-dag"><span>' + dagRubrik(m.tid) + '</span></p>'; dag = d; foreg = null; }
      if (!ny && forra && m.tid > forra && m.av !== jag() && !m.system) { html += '<p class="ch-nya"><span>Nya meddelanden</span></p>'; ny = true; foreg = null; }
      html += meddHtml(m, foreg, traffMid && traffMid.has(m.id) ? st.q : ''); foreg = m;
    });
    if (dag) html += '</div>';
    const sist = lista.filter((m) => !m.system).slice(-1)[0];
    if (sist && sist.av === jag()) {
      // "Läst" i privata konversationer, "Sett av …" i grupper upp till 20 personer (från samma läst-markering)
      if (k.typ === 'privat') { if (lastTill(k.id, motpart(k).id) >= sist.tid) html += '<p class="ch-last">' + ik('bock') + 'Läst</p>'; }
      else if (k.medlemmar.length <= 20) {
        const sett = k.medlemmar.filter((id) => id !== jag() && lastTill(k.id, id) >= sist.tid).map((id) => fornamn(anv(id)));
        if (sett.length) html += '<p class="ch-last ch-sett">' + ik('bock') + 'Sett av ' + e(sett.join(', ').replace(/, ([^,]*)$/, ' och $1')) + '</p>';
      }
    }
    return html;
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
    const snabb = !andrar && !svar && !ui.bilagor.length && iKanal(k.id).length ? snabbsvar(k) : [];
    const ss = IH.visarSom && IH.visarSom(), text = andrar ? klartext(andrar.text) : ui.utkast[k.id] || '';
    // Platshållaren säger bara vem det går till – @ och # står i tipsraden
    const plats = ss ? 'Skrivskyddat i supportläget – ' + e(ss.namn) + ' märker inte att du läser' : andrar ? 'Ändra meddelandet' : k.typ === 'privat' ? 'Skriv till ' + e(fornamn(motpart(k))) + '…' : 'Meddelande till ' + e(kanalNamn(k));
    return (snabb.length ? '<div class="ch-snabb"><span class="ch-snabb__etikett">' + ik('gnista') + 'Snabbsvar</span>' + snabb.map((x) => '<button type="button" data-g="ch-snabb" data-text="' + e(x) + '">' + e(x) + '</button>').join('') + '</div>' : '') +
      (andrar ? '<div class="ch-skriv__lage">' + ik('redigera') + '<span><b>Ändrar meddelandet</b><small>Enter sparar · Esc avbryter</small></span><button type="button" data-g="ch-avbryt" aria-label="Avbryt">' + i('stang') + '</button></div>' : '') +
      (svar ? '<div class="ch-skriv__lage">' + ik('retur') + '<span><b>Svar till ' + e(fornamn(anv(svar.av))) + '</b><small>' + e(klartext(svar.text).slice(0, 90)) + '</small></span><button type="button" data-g="ch-avbryt" aria-label="Avbryt">' + i('stang') + '</button></div>' : '') +
      (bilagor ? '<div class="ch-bilagor">' + bilagor + '</div>' : '') +
      '<form class="ch-skriv" data-ch-skriv data-kanal="' + k.id + '"' + (!text.trim() && !ui.bilagor.length ? ' data-tom' : '') + '>' +
        '<button type="button" class="ch-ikonknapp" data-g="ch-emoji" aria-label="Infoga emoji" aria-expanded="' + ui.emoji + '">' + ik('smiley') + '</button>' +
        '<label class="ch-ikonknapp" title="Bifoga fil eller bild">' + ik('gem') + '<input type="file" multiple data-ch-fil hidden></label>' +
        '<textarea name="text" rows="1"' + (ss ? ' disabled' : '') + ' placeholder="' + plats + '" aria-label="Meddelande till ' + e(kanalNamn(k)) + '"' + (pek() ? ' enterkeyhint="enter"' : ' enterkeyhint="send"') + '>' + e(text) + '</textarea>' +
        '<button class="ch-skicka" type="submit" aria-label="' + (andrar ? 'Spara' : 'Skicka') + '">' + ik(andrar ? 'bock' : 'skicka') + '</button>' +
        (ui.emoji ? '<div class="ch-emojipanel">' + EMOJI.map((g) => '<p>' + g[0] + '</p><div>' + g[1].split(' ').map((x) => '<button type="button" data-g="ch-emoji-in" data-emoji="' + x + '">' + x + '</button>').join('') + '</div>').join('') + '</div>' : '') +
        '<div class="ch-forslag" data-ch-forslag hidden></div>' +
        '<div class="ch-mallar" data-ch-mallar role="listbox" aria-label="Mallar" hidden></div>' +
        '<p class="ch-mallfalt" data-ch-mallfalt hidden></p>' +
      '</form>';
  }
  // Tipsraden under rutan: på pekskärm skickar man med knappen (Enter ger ny rad)
  const tipsHtml = () => (pek() ? 'Skicka med knappen · <kbd>/</kbd> mallar · <kbd>@</kbd> nämn en kollega · <kbd>#</kbd> länka en kund eller affär'
    : '<kbd>Enter</kbd> skickar · <kbd>Shift</kbd> + <kbd>Enter</kbd> ny rad · <kbd>@</kbd> nämn en kollega · <kbd>#</kbd> länka en kund eller affär · <kbd>/</kbd> mallar · <kbd>↑</kbd> ändra ditt senaste · filer virusskannas först');
  function infoHtml(k) {
    const filer = iKanal(k.id).filter((m) => m.filer && !m.borttagen).reduce((t, m) => t.concat(m.filer), []).slice(-8).reverse();
    // Länkat i konversationen: varje kund och affär som nämnts med #, en gång, senast nämnd först
    const sett = new Set(), lankat = [];
    iKanal(k.id).filter((m) => !m.borttagen && m.text).reverse().forEach((m) => { String(m.text).replace(OBJ, (x, typ, id) => { const o = !sett.has(typ + id) && objekt(typ, id); if (o) { sett.add(typ + id); lankat.push(o); } return x; }); });
    return '<aside class="ch-info"><header><b>Om konversationen</b><button type="button" class="ch-ikonknapp" data-g="ch-info" aria-label="Stäng">' + i('stang') + '</button></header>' +
      '<p class="ch-info__rub">Medlemmar · ' + k.medlemmar.length + '</p><ul class="ch-medlemmar">' + k.medlemmar.map((id) => { const u = anv(id); return '<li>' + avatar(u, true) + '<span><b>' + e(u.namn) + (id === jag() ? ' (du)' : '') + '</b><small>' + e(IH.narvaro ? IH.narvaro(id).namn : u.titel) + '</small></span></li>'; }).join('') + '</ul>' +
      (k.typ === 'grupp' ? '<button class="knapp knapp--liten" type="button" data-g="ch-bjud" data-kanal="' + k.id + '">' + ik('anvandare-plus') + 'Bjud in</button>' +
        '<form class="ch-namnform" data-ch-namn data-kanal="' + k.id + '"><label><span>Gruppens namn</span><input name="namn" maxlength="40" value="' + e(k.namn || '') + '"></label><button class="knapp knapp--liten" type="submit">Spara</button></form>' : '') +
      '<p class="ch-info__rub">Länkat i konversationen</p>' + (lankat.length ? '<ul class="ch-delade ch-lankat">' + lankat.slice(0, 8).map((o) => '<li>' + ik(o.ikon) + '<a href="' + o.href + '"><b>' + e(o.namn) + '</b>' + (o.under ? '<small>' + e(o.under) + '</small>' : '') + '</a></li>').join('') + '</ul>' : '<p class="ch-info__tom">Ingen kund eller affär än – skriv # i rutan för att länka.</p>') +
      '<p class="ch-info__rub">Delade filer</p>' + (filer.length ? '<ul class="ch-delade">' + filer.map((f) => '<li>' + ik(f.typ && f.typ.indexOf('image/') === 0 ? 'bild' : 'gem') + '<span>' + e(f.namn) + '</span></li>').join('') + '</ul>' : '<p class="ch-info__tom">Inga filer än.</p>') +
      '<div class="ch-info__knappar"><button class="knapp knapp--liten" type="button" data-g="ch-tyst" data-kanal="' + k.id + '" aria-pressed="' + tystad(k.id) + '">' + ik(tystad(k.id) ? 'bjallra' : 'bjallra-av') + (tystad(k.id) ? 'Slå på aviseringar' : 'Tysta konversationen') + '</button>' +
      (k.typ === 'grupp' ? '<button class="knapp knapp--liten knapp--fara" type="button" data-g="ch-lamna" data-kanal="' + k.id + '">Lämna gruppen</button>' : '') + '</div>' +
      '<p class="ch-info__tom">' + (tystad(k.id) ? 'Tystad: inget ljud och inga märken – utom när någon nämner dig.' : 'Tystar du konversationen blir det inget ljud och inga märken – utom när någon nämner dig.') + '</p>' +
      // Prototyp: det som kräver en server sägs rakt ut, och ett exempelsvar går att prova
      '<p class="ch-info__rub">Prototyp</p><div class="ch-info__proto"><p>Chatten sparas bara i den här webbläsaren. Aviseringar till andra datorer, läskvitton och ”skriver …” mellan olika personer, påminnelser när fliken är stängd och filer på en server kräver en riktig server. Flikar i samma webbläsare är samma konto, så ”skriver …” visas inte mellan dem heller.</p>' +
        '<button class="knapp knapp--liten" type="button" data-g="ch-simulera" data-kanal="' + k.id + '"' + (k.medlemmar.length < 2 ? ' disabled' : '') + '>' + ik('gnista') + 'Simulera ett svar (exempel)</button></div></aside>';
  }
  // Ljudknapparna: trådhuvudets bjällra tystar konversationen (aria-pressed = tystad); listans högtalare är pling för nya meddelanden
  const tystKnapp = (k) => '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-tyst" data-kanal="' + k.id + '" aria-pressed="' + tystad(k.id) + '" title="' + (tystad(k.id) ? 'Slå på aviseringar' : 'Tysta konversationen') + '" aria-label="Tysta konversationen">' + ik(tystad(k.id) ? 'bjallra-av' : 'bjallra') + '</button>';
  const sokKnapp = (k) => '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-sok-tradoppna" data-kanal="' + k.id + '" aria-pressed="' + !!(ui.sokTrad && ui.sokTrad.kanal === k.id) + '" title="Sök i konversationen (Ctrl+F)" aria-label="Sök i konversationen">' + ik('sok') + '</button>';
  const undertext = (k) => { const mot = motpart(k); return mot ? (IH.narvaro ? IH.narvaro(mot.id).namn + ' · ' : '') + mot.titel : k.medlemmar.map((id) => fornamn(anv(id))).join(', '); };
  const vmKnapp = (k) => (IH.videomote ? '<button type="button" class="ch-ikonknapp ch-ruta ch-vmknapp" data-g="vm-chatt-starta" data-kanal="' + k.id + '" title="Starta videomöte" aria-label="Starta videomöte">' + (IH.vmIk ? IH.vmIk() : ik('kamera')) + '</button>' : '');
  function toppHtml(k) {
    return '<header class="ch-topp">' + kanalAvatar(k) +
      '<div class="ch-topp__text"><b>' + e(kanalNamn(k)) + '</b><small>' + e(undertext(k)) + '</small></div>' +
      '<span class="ch-topp__knappar">' + vmKnapp(k) + sokKnapp(k) +
        (k.typ === 'grupp' ? '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-bjud" data-kanal="' + k.id + '" title="Bjud in" aria-label="Bjud in">' + ik('anvandare-plus') + '</button>' : '') +
        tystKnapp(k) +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-info" aria-pressed="' + ui.info + '" title="Om konversationen" aria-label="Om konversationen">' + ik('info') + '</button>' +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-oppna" data-kanal="' + k.id + '" title="Öppna i eget fönster" aria-label="Öppna i eget fönster">' + popout + '</button>' +
        '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-min-sida" data-kanal="' + k.id + '" title="Minimera till en ikon" aria-label="Minimera till en ikon">' + ik('minimera') + '</button></span></header>';
  }
  // Sökraden i tråden (under huvudet): "2 av 5", upp/ned, stäng
  function sokradHtml(k) {
    const st = ui.sokTrad; if (!st || st.kanal !== k.id) return '';
    const l = traffar(k.id, st.q), n = l.findIndex((m) => m.id === st.aktiv);
    return '<div class="ch-sokrad" role="search">' + ik('sok') + '<input type="search" data-ch-tradsok value="' + e(st.q) + '" placeholder="Sök i konversationen…" aria-label="Sök i konversationen">' +
      '<small class="ch-sokrad__antal" aria-live="polite">' + (!st.q.trim() ? '' : l.length ? (n + 1) + ' av ' + l.length : 'Inga träffar') + '</small>' +
      '<button type="button" class="ch-ikonknapp" data-g="ch-sok-upp" title="Äldre träff (Shift+Enter)" aria-label="Äldre träff"' + (l.length > 1 ? '' : ' disabled') + '>' + i('chevron', 'ch-upp') + '</button>' +
      '<button type="button" class="ch-ikonknapp" data-g="ch-sok-ned" title="Nyare träff (Enter)" aria-label="Nyare träff"' + (l.length > 1 ? '' : ' disabled') + '>' + i('chevron') + '</button>' +
      '<button type="button" class="ch-ikonknapp" data-g="ch-sok-stang" title="Stäng sökningen (Esc)" aria-label="Stäng sökningen">' + i('stang') + '</button></div>';
  }
  // Fästa meddelanden överst i tråden: det första syns, +N fäller ut resten
  function fastHtml(k) {
    const l = fasta(k.id); if (!l.length) return '';
    const visa = ui.fastOppen ? l : l.slice(0, 1);
    return '<div class="ch-fast' + (ui.fastOppen ? ' oppen' : '') + '" aria-label="Fästa meddelanden">' + visa.map((f) => {
      const m = meddelande(f.mid), u = anv(m.av), av = anv(f.av);
      return '<button type="button" class="ch-fast__rad" data-g="ch-hoppa-fast" data-mid="' + e(m.id) + '" title="Visa meddelandet">' + ik('nal') + '<b>' + e(fornamn(u)) + '</b><span>' + e(klartext(m.text).slice(0, 140) || (m.filer && m.filer[0] ? m.filer[0].namn : '')) + '</span><small>Fäst av ' + e(f.av === jag() ? 'dig' : fornamn(av)) + '</small></button>' +
        '<button type="button" class="ch-fast__lossa" data-g="ch-fast" data-mid="' + e(m.id) + '" title="Lossa" aria-label="Lossa meddelandet">' + i('stang') + '</button>';
    }).join('') + (l.length > 1 ? '<button type="button" class="ch-fast__fler" data-g="ch-fast-fler" aria-expanded="' + ui.fastOppen + '">' + (ui.fastOppen ? 'Visa färre' : '+' + (l.length - 1)) + '</button>' : '') + '</div>';
  }
  // Tråden med allt runt den: fästa överst, "N nya ↓" nederst, "skriver …" under
  const tradYta = (k) => '<div class="ch-trad-yta">' + fastHtml(k) + '<div class="ch-trad" data-ch-trad role="log" aria-label="Meddelanden i ' + e(kanalNamn(k)) + '" aria-relevant="additions">' + tradHtml(k) + '</div>' +
    '<button type="button" class="ch-hopp" data-g="ch-hopp" tabindex="-1" aria-hidden="true"></button></div>' +
    '<p class="ch-skriver" data-ch-skriver aria-live="polite"' + (ui.skriver && ui.skriver.kanal === k.id ? '' : ' hidden') + '>' + (ui.skriver && ui.skriver.kanal === k.id ? skriverText(ui.skriver) : '') + '</p>';
  const skriverText = (s) => '<span class="ch-skriver__prickar" aria-hidden="true"><i></i><i></i><i></i></span>' + e(s.namn) + ' skriver …';

  /* 06 Sidan #/chatt[/id] ------------------------------------------------------------------------ */
  let sidKanal = null;
  // Var tråden på sidan stod (uppdateras när man rullar) – så att en omritning inte rycker en till botten
  let sidRull = null;
  IH.vyer.chatt = function (del) {
    const lista = kanaler();
    const k = kanal(del[0]) || kanal(sidKanal) || kanal(pref().senast) || lista[0];
    if (sidKanal !== k.id) sidRull = null;
    if (ui.kanalFor !== k.id) {
      bytKanal(k.id);
      // Öppnad från en sökning i listan: söket följer med in i tråden och visar den senaste träffen
      const q = ui.sok.trim(), t = q && traffar(k.id, q);
      if (t && t.length) ui.sokTrad = { kanal: k.id, q, aktiv: t[t.length - 1].id };
    }
    sidKanal = k.id; satPref('senast', k.id);
    if (del[1]) {
      const mm = meddelande(del[1]);
      if (mm && mm.kanal === k.id && !mm.borttagen) ui.hoppa = mm.id;
      try { history.replaceState(null, '', '#/chatt/' + k.id); } catch (x) { /* */ }
    }
    html.setAttribute('data-chatt-sida', '');
    const n = olastaTotalt();
    const out = '<h1 class="dold">Meddelanden</h1><div class="ch' + (ui.info ? ' med-info' : '') + ' kort" data-in>' +
      '<aside class="ch-lista"><header><div><h2>Meddelanden</h2><small>' + (n ? n + (n === 1 ? ' oläst' : ' olästa') : 'Allt är läst') + '</small></div>' +
          '<button type="button" class="ch-ikonknapp ch-ruta" data-g="ch-pling" aria-pressed="' + (pref().pling !== false) + '" title="Ljud för nya meddelanden: ' + (pref().pling !== false ? 'på' : 'av') + '" aria-label="Ljud för nya meddelanden">' + ik(pref().pling !== false ? 'ljud' : 'ljud-av') + '</button>' +
          '<button type="button" class="ch-ikonknapp ch-ruta" data-g="chf-min-sida" data-kanal="' + k.id + '" title="Minimera till en ikon" aria-label="Minimera till en ikon">' + ik('minimera') + '</button>' +
          '<button type="button" class="ch-ikonknapp ch-ny" data-g="ch-ny-grupp" title="Ny grupp" aria-label="Ny grupp">' + ik('plus') + '</button></header>' +
        '<label class="ch-sok">' + ik('sok') + '<input type="search" data-ch-sok placeholder="Sök i konversationerna…" value="' + e(ui.sok) + '" aria-label="Sök i konversationerna"></label>' +
        '<div class="ch-team" role="list" aria-label="Kollegor">' + IH.ANVANDARE.filter((u) => u.id !== jag()).map((u) => {
          const nv = IH.narvaro ? IH.narvaro(u.id) : { namn: '' }, pid = privatId(jag(), u.id);
          return '<a role="listitem" class="ch-teamkort' + (pid === k.id ? ' vald' : '') + '" href="#/chatt/' + pid + '" title="Skriv till ' + e(u.namn) + ' – ' + e(nv.namn) + ' · ' + e(u.titel) + '">' + avatar(u) + '<b>' + e(fornamn(u)) + '</b><small>' + e(nv.namn) + '</small></a>';
        }).join('') + '</div>' +
        '<nav aria-label="Konversationer" data-ch-listan>' + listaHtml(k.id) + '</nav>' +
        installningarHtml() + '</aside>' +
      '<section class="ch-tradyta" data-ch-yta="sida">' + toppHtml(k) + sokradHtml(k) + tradYta(k) +
        '<div class="ch-fot">' + skrivHtml(k) + '<p class="ch-tips">' + tipsHtml() + '</p></div></section>' +
      (ui.info ? infoHtml(k) : '') + '</div>';
    return { titel: 'Meddelanden', html: out, efter: (rot) => efterTrad(rot, k) };
  };
  // Rulläget i en tråd: var den står och om den är vid botten
  const rullLage = (t, kid) => (t ? { kanal: kid, top: t.scrollTop, vidBotten: t.scrollHeight - t.scrollTop - t.clientHeight < 40 } : null);
  // Samma regel på sidan och i fönstret: eget nytt → botten; samma konversation → där man var (botten om man var där);
  // annars vid "Nya meddelanden" eller botten. En sökträff eller ett markerat meddelande visas i mitten.
  function rullRegel(t, kid, fore) {
    const mark = t.querySelector('mark.ch-mark.aktiv'), mal = mark && mark.closest('.ch-medd');
    if (ui.egetNytt || !fore || fore.kanal !== kid) {
      if (mal && !ui.egetNytt) { t.scrollTop += mal.getBoundingClientRect().top - t.getBoundingClientRect().top - t.clientHeight / 2 + mal.offsetHeight / 2; return; }
      const ny = !ui.egetNytt && t.querySelector('.ch-nya');
      t.scrollTop = ny ? t.scrollTop + ny.getBoundingClientRect().top - t.getBoundingClientRect().top - 40 : t.scrollHeight;
      return;
    }
    t.scrollTop = fore.vidBotten ? t.scrollHeight : fore.top;
  }
  function efterTrad(rot, k) {
    const t = rot.querySelector('[data-ch-trad]');
    // Ett sidbyte (från en annan sida) börjar om; en omritning på plats står kvar där man läste
    if (t) { rullRegel(t, k.id, IH.vyByte ? null : sidRull); sidRull = rullLage(t, k.id); uppdateraHopp(t); tabbStopp(rot); }
    if (document.visibilityState === 'visible') markeraLast(k.id);
    ui.nya.clear(); ui.nyaIn.clear(); ui.egetNytt = false; ui.pop = null;
    const ruta = rot.querySelector('[data-ch-skriv] textarea');
    const sok = rot.querySelector('[data-ch-tradsok]');
    if (sok && ui.sokTrad && ui.sokTrad.fokus) { ui.sokTrad.fokus = false; sok.focus({ preventScroll: true }); const l = sok.value.length; sok.setSelectionRange(l, l); }
    const aktivt = document.activeElement;
    const behall = aktivt && aktivt !== document.body && rot.contains(aktivt) && !aktivt.matches('[data-ch-skriv] textarea');
    if (ruta) { vaxa(ruta); if (!pek() && !behall && !ui.markerad) { ruta.focus({ preventScroll: true }); const l = ruta.value.length; ruta.setSelectionRange(l, l); } }
    if (ui.markerad) { const m = rot.querySelector('.ch-medd[data-mid="' + ui.markerad + '"]'); if (m && !behall) m.focus({ preventScroll: true }); }
    if (ui.hoppa && t) { const mid = ui.hoppa; ui.hoppa = null; requestAnimationFrame(() => hoppaTill(rot, mid)); }
  }
  function ritaAllt() {
    if (/^#\/chatt/.test(location.hash)) IH.rita();
    ritaFonster(); IH.uppdateraMeny(); satTitel();
  }
  // Bara tråden (och sökraden) ritas om – för sökningen, så att fokus och markören i sökfältet står kvar
  function ritaTraden() {
    document.querySelectorAll('[data-ch-yta]').forEach((yta) => {
      const kid = yta.closest('.chf') ? fl.kanal : sidKanal, k = kanal(kid), t = yta.querySelector('[data-ch-trad]'); if (!k || !t) return;
      t.innerHTML = tradHtml(k);
      const rot = yta.closest('.chf') || yta, st = ui.sokTrad, antal = rot.querySelector('.ch-sokrad__antal');
      if (st && antal) { const l = traffar(k.id, st.q), n = l.findIndex((m) => m.id === st.aktiv); antal.textContent = !st.q.trim() ? '' : l.length ? (n + 1) + ' av ' + l.length : 'Inga träffar'; rot.querySelectorAll('[data-g="ch-sok-upp"], [data-g="ch-sok-ned"]').forEach((b) => { b.disabled = l.length < 2; }); }
      const mal = t.querySelector('mark.ch-mark.aktiv');
      if (mal) { const m = mal.closest('.ch-medd'); t.scrollTop += m.getBoundingClientRect().top - t.getBoundingClientRect().top - t.clientHeight / 2 + m.offsetHeight / 2; }
      uppdateraHopp(t); tabbStopp(yta);
    });
  }
  // "N nya meddelanden ↓" när något kommit in under det man läser, "Till senaste ↓" när man rullat mer än en skärm upp
  function uppdateraHopp(t) {
    const yta = t.closest('.ch-trad-yta'), b = yta && yta.querySelector('.ch-hopp'); if (!b) return;
    const kvar = t.scrollHeight - t.scrollTop - t.clientHeight;
    if (kvar < 40) ui.nyaUnder = 0;
    const syns = ui.nyaUnder > 0 || kvar > t.clientHeight;
    const text = ui.nyaUnder > 0 ? '<b class="ch-hopp__antal">' + ui.nyaUnder + '</b> ' + (ui.nyaUnder === 1 ? 'nytt meddelande' : 'nya meddelanden') + ' <span aria-hidden="true">↓</span>' : 'Till senaste <span aria-hidden="true">↓</span>';
    if (b.innerHTML !== text) b.innerHTML = text;
    if (b.classList.contains('syns') !== syns) { b.classList.toggle('syns', syns); b.setAttribute('aria-hidden', String(!syns)); b.tabIndex = syns ? 0 : -1; }
  }
  let rullVantar = 0;
  document.addEventListener('scroll', (ev) => {
    const t = ev.target; if (!(t.matches && t.matches('[data-ch-trad]'))) return;
    stangObjkort();
    cancelAnimationFrame(rullVantar);
    rullVantar = requestAnimationFrame(() => {
      if (!t.isConnected) return;
      if (t.closest('[data-ch-yta="sida"]')) sidRull = rullLage(t, sidKanal);
      uppdateraHopp(t);
    });
  }, true);
  // Ute från chattsidan: attributet för mobilreglerna tas bort, och "markera som oläst" släpper
  // Senaste sidan utanför chatten – dit går Minimera från chattsidan (inte alltid till Översikten)
  if (!/^#\/chatt/.test(location.hash)) IH.senasteSida = location.hash || '#/';
  addEventListener('hashchange', () => {
    if (/^#\/chatt/.test(location.hash)) return;
    IH.senasteSida = location.hash || '#/';
    html.removeAttribute('data-chatt-sida'); ui.olastKvar = null; stangMeny(); stangObjkort();
    // Det som hör till det öppna fönstret står kvar (fönstret ritas inte om vid sidbyte); resten släpps
    const iFonster = (kid) => !!(fonster && fl.oppen && !fl.min && kid && kid === fl.kanal);
    if (ui.sokTrad && !iFonster(ui.sokTrad.kanal)) ui.sokTrad = null;
    if (ui.markerad) { const m = meddelande(ui.markerad); if (!m || !iFonster(m.kanal)) ui.markerad = null; }
  });
  const tillbakaSida = () => (IH.senasteSida && !/^#\/chatt/.test(IH.senasteSida) ? IH.senasteSida : '#/');

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
  // Rektangeln utan en ev. style.translate (magneten i grund.js är avstängd – inget följer musen – men skyddet är kvar)
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
      // In i bubblan: krymper till bubblans mått (inte en fast skala) och tonar bort under sista 40 %
      const r = f.getBoundingClientRect(), dx = mal ? mal.left + mal.width / 2 - (r.left + r.width / 2) : 0, dy = mal ? mal.top + mal.height / 2 - (r.top + r.height / 2) : 0;
      const sx = mal ? Math.max(0.05, (mal.width || 44) / r.width) : 1, sy = mal ? Math.max(0.05, (mal.height || 44) / r.height) : 1;
      f.style.setProperty('--chf-dx', dx + 'px'); f.style.setProperty('--chf-dy', dy + 'px'); f.style.setProperty('--chf-sx', sx); f.style.setProperty('--chf-sy', sy);
      const slut = mal ? 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' : 'translateY(10px) scale(.96)';
      const a = f.animate(mal ? [{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .6 }, { transform: slut, opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: slut, opacity: 0 }],
        { duration: mal ? 280 : 180, easing: mal ? KURVA : UT, fill: 'forwards' });
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
    const akt = document.activeElement, fokus = akt && fonster.contains(akt) && akt.tagName === 'TEXTAREA', sokFokus = akt && fonster.contains(akt) && akt.matches('[data-ch-sok]');
    const fore = nytt || fonster.dataset.kanal !== String(k ? k.id : '') ? null : rullLage(fonster.querySelector('[data-ch-trad]'), k && k.id);
    if (k && ui.kanalFor !== k.id) bytKanal(k.id);
    fonster.dataset.kanal = k ? k.id : '';
    const knappar = '<button type="button" class="ch-ikonknapp" data-g="chf-storej" aria-pressed="' + !!pref().storEj + '" title="Stör ej: ' + (pref().storEj ? 'på – inget ljud eller avisering' : 'av') + '" aria-label="Stör ej">' + ik(pref().storEj ? 'mane' : 'bjallra') + '</button>' +
      '<a class="ch-ikonknapp" href="#/chatt' + (k ? '/' + k.id : '') + '" title="Öppna på hela sidan" aria-label="Öppna på hela sidan">' + ik('helskarm') + '</a>' +
      '<button type="button" class="ch-ikonknapp" data-g="chf-min" title="Minimera (Esc)" aria-label="Minimera">' + ik('minimera') + '</button>' +
      '<button type="button" class="ch-ikonknapp" data-g="chf-stang" title="Stäng" aria-label="Stäng chatten">' + i('stang') + '</button>';
    // Trådläget: ett huvud med pil tillbaka, vem och knapparna (ingen andra rubrik under). Listläget: "Meddelanden" + sök.
    fonster.innerHTML = (k
      ? '<header class="chf-huvud trad" data-chf-dra><button type="button" class="ch-ikonknapp" data-g="chf-lista" aria-label="Alla konversationer" title="Alla konversationer">' + i('pilv') + '</button>' + kanalAvatar(k, true) +
          '<div class="chf-huvud__text"><b>' + e(kanalNamn(k)) + '</b><small>' + e(undertext(k)) + '</small></div>' + sokKnapp(k).replace(/ ch-ruta/, '') + knappar + '</header>' +
        sokradHtml(k) +
        '<div class="chf-kropp ch-tradyta" data-ch-yta="fonster">' + tradYta(k) + '<div class="ch-fot">' + skrivHtml(k) + '</div></div>'
      : '<header class="chf-huvud" data-chf-dra>' + ik('prat') + '<b>Meddelanden</b>' + knappar + '</header>' +
        '<div class="chf-sok"><label class="ch-sok">' + ik('sok') + '<input type="search" data-ch-sok placeholder="Sök i konversationerna…" value="' + e(ui.sok) + '" aria-label="Sök i konversationerna"></label>' +
          '<button type="button" class="ch-ikonknapp ch-ny" data-g="ch-ny-grupp" title="Ny grupp" aria-label="Ny grupp">' + ik('plus') + '</button></div>' +
        '<nav class="chf-kropp chf-lista" aria-label="Konversationer" data-ch-listan>' + listaHtml(null) + '</nav>') +
      '<span class="chf-storlek" data-chf-storlek aria-hidden="true"></span>';
    if (k) {
      // Samma rullregel som på sidan: står kvar där man läste i samma konversation
      const t = fonster.querySelector('[data-ch-trad]'); rullRegel(t, k.id, fore); uppdateraHopp(t); tabbStopp(fonster);
      // Läst bara när fliken syns – en dold flik med öppet fönster läser ingenting
      if (document.visibilityState === 'visible') markeraLast(k.id);
      ui.nya.clear(); ui.nyaIn.clear(); ui.egetNytt = false; ui.pop = null;
      const sok = fonster.querySelector('[data-ch-tradsok]');
      if (sok && ui.sokTrad && ui.sokTrad.fokus) { ui.sokTrad.fokus = false; sok.focus({ preventScroll: true }); }
      else { const r = fonster.querySelector('textarea'); if (r) { vaxa(r); if (fokus) r.focus({ preventScroll: true }); } }
      if (ui.markerad) { const m = fonster.querySelector('.ch-medd[data-mid="' + ui.markerad + '"]'); if (m && akt && fonster.contains(akt)) m.focus({ preventScroll: true }); }
    } else if (sokFokus) { const s = fonster.querySelector('[data-ch-sok]'); s.focus({ preventScroll: true }); const l = s.value.length; s.setSelectionRange(l, l); }
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
    if (!ikon) { dockFor(null, false, g); varIDocka = null; document.body.classList.remove('chf-bubbla-plats'); return; }
    const rals = html.hasAttribute('data-sido-dold') && matchMedia('(min-width: 1101px)').matches;
    const kn = [...document.querySelectorAll('[data-sido-knapp], .sido-knapp')].filter((x) => x.getBoundingClientRect().width)[0];
    const fran = ikon.isConnected && varIDocka !== null ? rekt(ikon) : null;
    const franOp = fran ? +getComputedStyle(ikon).opacity : 1;
    stoppa(ikon); // en pågående flygning avbryts – den nya börjar där bubblan står just nu
    const sido = !rals && document.querySelector('.sido'), sr = sido && sido.getBoundingClientRect();
    if (fl.ikonX != null && sr && sr.width && fl.ikonX < sr.right && fl.ikonY + 48 > sr.top && fl.ikonY < sr.bottom) { fl.ikonX = fl.ikonY = null; sparaFl(); }
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
    // Bubblan i hörnet: sidan får luft nedtill så att bubblan inte täcker sista raden
    document.body.classList.toggle('chf-bubbla-plats', !iDocka && fl.ikonX == null);
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
      // Ett klick där musen råkar röra sig några pixlar ska inte räknas som en flytt
      dra(ev, (dx, dy) => { if (!b.dataset.drar && Math.hypot(dx, dy) < 9) return; b.dataset.drar = '1'; b.style.translate = ''; fl.ikonX = Math.max(6, Math.min(innerWidth - 54, r.left + dx)); fl.ikonY = Math.max(6, Math.min(innerHeight - 54, r.top + dy)); b.style.left = fl.ikonX + 'px'; b.style.top = fl.ikonY + 'px'; b.style.right = b.style.bottom = ''; if (dock) { b.removeAttribute('data-i-docka'); dockFor(null); varIDocka = false; } },
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
    // Mer-menyn och länkkortet stängs först (på sidan och i fönstret), och fokus går tillbaka dit det kom ifrån
    if (ev.key === 'Escape' && (menyEl || objEl)) { ev.preventDefault(); ev.stopPropagation(); if (menyEl) stangMeny(true); else stangObjkort(true); return; }
    if (ev.key !== 'Escape' || !fonster || !(ev.target.closest && ev.target.closest('.chf'))) return;
    ev.preventDefault(); ev.stopPropagation();
    if (ui.forslag || ui.mallar) { ui.forslag = ui.mallar = null; fonster.querySelectorAll('[data-ch-forslag], [data-ch-mallar]').forEach((b) => { b.hidden = true; }); return; }
    if (ev.target.closest('.ch-sokrad')) { G['ch-sok-stang'](ev.target); return; }
    if (ev.target.matches('.ch-medd')) { ui.markerad = null; ev.target.classList.remove('markerad'); fokusText(true); return; }
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
  // Supportläget: inget i chatten ändras i säljarens namn (stod.js)
  function skrivskyddat() {
    if (!(IH.visarSom && IH.visarSom())) return false;
    IH.toast('Chatten är skrivskyddad i supportläget', 'Meddelanden skickas inte i ' + IH.visarSom().namn + 's namn. Lämna supportläget och skriv från ditt eget konto.', 'oga-av');
    return true;
  }
  IH.chattMedlemmar = (kid) => { const k = kanal(kid); return k ? k.medlemmar.filter((id) => id !== jag() && !(anv(id).inaktiv)) : []; };
  IH.chattVideomote = (kid, vmId) => {
    if (skrivskyddat() || !kanal(kid)) return;
    const m = { id: nyId('m'), kanal: kid, av: jag(), tid: new Date().toISOString(), text: 'Startade ett videomöte', videomote: String(vmId) };
    C().meddelanden.push(m); kanda.add(m.id); ui.nya.add(m.id);
    const c = C(); c.last[jag()] = c.last[jag()] || {}; c.last[jag()][kid] = m.tid;
    IH.spara(); ritaAllt();
  };
  // Mötet börjar eller slutar (samtal-ui.js): korten i tråden visar det nya läget
  document.addEventListener('ih-videomote', () => { if (document.querySelector('.ch-vmkort')) ritaTraden(); });
  G['ch-reagera'] = (el) => {
    if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.borttagen) return;
    const x = el.getAttribute('data-emoji'); if (!m.reakt || typeof m.reakt !== 'object') m.reakt = {}; const l = m.reakt[x] = Array.isArray(m.reakt[x]) ? m.reakt[x] : [];
    const n = l.indexOf(jag()); if (n >= 0) l.splice(n, 1); else l.push(jag());
    // Chipet som ändrats studsar till (ch-ny-reakt); fokus står kvar på samma chip efter omritningen
    const varChip = el.classList.contains('ch-reakt'); ui.pop = m.id + x;
    ui.verktyg = null; stangMeny(); IH.spara(); ritaAllt();
    if (varChip) { const ny = [...document.querySelectorAll('.ch-reakt')].filter((b) => b.getAttribute('data-mid') === m.id && b.getAttribute('data-emoji') === x)[0]; if (ny) ny.focus({ preventScroll: true }); }
  };
  // Tipset i listan kan stängas – det kommer inte tillbaka
  G['ch-tips-stang'] = () => { satPref('tipsDolt', true); IH.rita(); };
  G['ch-svara'] = (el) => { stangMeny(); ui.markerad = null; ui.svar = el.getAttribute('data-mid'); ui.andrar = null; ui.verktyg = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  // Kopiera: "Kopierat" först när det verkligen gått; annars en dold textruta, och sist ett ärligt fel
  function kopieraText(t) {
    const reserv = () => { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; } ta.remove(); return ok; };
    const klar = (ok) => (ok ? IH.toast('Kopierat', null, 'kopiera') : IH.toast('Kunde inte kopiera', 'Markera texten och tryck Ctrl+C.', 'varning'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => klar(true), () => klar(reserv()));
    else klar(reserv());
  }
  G['ch-kopiera'] = (el) => { const m = meddelande(el.getAttribute('data-mid')); stangMeny(); if (!m) return; kopieraText(klartext(m.text)); ui.verktyg = null; };
  G['ch-andra'] = (el) => { stangMeny(); if (skrivskyddat()) return; const m = meddelande(el.getAttribute('data-mid')); if (!m || m.av !== jag() || m.borttagen) return; ui.markerad = null; ui.andrar = el.getAttribute('data-mid'); ui.svar = null; ui.verktyg = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  G['ch-avbryt'] = (el) => { ui.andrar = null; ui.svar = null; const iF = !!el.closest('.chf'); ritaAllt(); fokusText(iF); };
  let angra = null;
  G['ch-ta-bort'] = (el) => {
    if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.av !== jag()) return;
    // Ångra lägger tillbaka text, filer, reaktioner och fästningen
    const fl0 = C().fasta[m.kanal], fastPlats = Array.isArray(fl0) ? fl0.findIndex((f) => f && f.mid === m.id) : -1, fastPost = fastPlats >= 0 ? fl0[fastPlats] : null;
    const kopia = { text: m.text, filer: m.filer, reakt: m.reakt };
    m.borttagen = true; m.text = ''; delete m.filer; delete m.reakt; if (fastPost) fl0.splice(fastPlats, 1);
    stangMeny(); ui.verktyg = null; if (ui.markerad === m.id) ui.markerad = null; IH.spara(); ritaAllt();
    if (angra) angra.remove();
    angra = document.createElement('div'); angra.className = 'ch-angra'; angra.setAttribute('role', 'status');
    angra.innerHTML = '<span>Meddelandet togs bort</span><button type="button">Ångra</button>';
    const den = angra;
    den.querySelector('button').addEventListener('click', () => {
      m.borttagen = false; m.text = kopia.text; if (kopia.filer) m.filer = kopia.filer; if (kopia.reakt) m.reakt = kopia.reakt;
      if (fastPost) { const l = C().fasta[m.kanal] = Array.isArray(C().fasta[m.kanal]) ? C().fasta[m.kanal] : []; if (l.length < 3 && !l.some((f) => f.mid === m.id)) l.splice(Math.min(fastPlats, l.length), 0, fastPost); }
      IH.spara(); ritaAllt(); den.remove();
    });
    document.body.appendChild(den);
    setTimeout(() => { if (den.isConnected) den.remove(); }, 6000);
  };
  G['ch-emoji'] = () => { ui.emoji = !ui.emoji; ritaAllt(); };
  G['ch-emoji-in'] = (el) => {
    const f = el.closest('form'), r = f.querySelector('textarea'), x = el.getAttribute('data-emoji');
    const a = r.selectionStart == null ? r.value.length : r.selectionStart, b = r.selectionEnd == null ? r.value.length : r.selectionEnd;
    r.value = r.value.slice(0, a) + x + r.value.slice(b); sparaUtkast(f.getAttribute('data-kanal'), r.value); tomLage(f);
    r.focus(); r.setSelectionRange(a + x.length, a + x.length);
  };
  G['ch-snabb'] = (el) => { const f = ytaFor(el).querySelector('[data-ch-skriv]'); if (!f) return; const r = f.querySelector('textarea'); r.value = el.getAttribute('data-text'); sparaUtkast(f.getAttribute('data-kanal'), r.value); tomLage(f); vaxa(r); r.focus(); const l = r.value.length; r.setSelectionRange(l, l); };
  G['ch-bilaga-bort'] = (el) => { ui.bilagor.splice(+el.getAttribute('data-n'), 1); ritaAllt(); };
  G['ch-info'] = () => { ui.info = !ui.info; IH.rita(); };
  G['ch-tyst'] = (el) => {
    if (skrivskyddat()) return;
    const kid = el.getAttribute('data-kanal'), c = C(), l = c.tyst[jag()] = c.tyst[jag()] || [], n = l.indexOf(kid);
    if (n >= 0) l.splice(n, 1); else l.push(kid);
    IH.spara(); ritaAllt(); IH.toast(n >= 0 ? 'Aviseringar är på' : 'Konversationen är tystad', n >= 0 ? null : 'Inget ljud och inga märken – utom när någon nämner dig.', n >= 0 ? 'bjallra' : 'bjallra-av');
  };
  G['ch-lamna'] = (el) => {
    if (skrivskyddat()) return;
    const k = C().kanaler.filter((x) => x.id === el.getAttribute('data-kanal'))[0]; if (!k) return;
    if (!el.dataset.saker) { el.dataset.saker = '1'; el.textContent = 'Klicka igen för att lämna'; return; }
    systemMedd(k.id, fornamn(IH.jag()) + ' lämnade gruppen'); k.medlemmar = k.medlemmar.filter((x) => x !== jag());
    IH.spara(); ui.info = false; sidKanal = 'team'; IH.ga('#/chatt/team');
  };
  G['ch-pling'] = () => { satPref('pling', pref().pling === false); IH.rita(); IH.toast(pref().pling !== false ? 'Ljud för nya meddelanden är på' : 'Ljud för nya meddelanden är av', null, pref().pling !== false ? 'ljud' : 'ljud-av'); };
  G['ch-avisera'] = () => {
    if (!('Notification' in window)) return;
    if (pref().avisera) { satPref('avisera', false); IH.rita(); return; }
    Notification.requestPermission().then((p) => { satPref('avisera', p === 'granted'); IH.rita(); if (p !== 'granted') IH.toast('Aviseringar är avstängda i webbläsaren', 'Tillåt aviseringar för sidan i webbläsarens inställningar.', 'varning'); });
  };
  G['chf-oppna'] = (el) => { fl.oppen = true; fl.min = false; fl.kanal = el.getAttribute('data-kanal'); sparaFl(); IH.ga(tillbakaSida()); };
  G['ch-skriv-till'] = (el) => { const uid = el.getAttribute('data-uid'); if (uid === jag()) return; fl.oppen = true; fl.min = false; fl.kanal = privatId(jag(), uid); sparaFl(); ritaFonster(); fokusText(true); };
  // Ett meddelande från mig till en kollega (chefens påminnelser och fördelningar) – inte i supportläget
  IH.chattSkickaTill = (uid, text) => {
    if ((IH.visarSom && IH.visarSom()) || uid === jag()) return false;
    const m = { id: nyId('m'), kanal: privatId(jag(), uid), av: jag(), tid: new Date().toISOString(), text };
    C().meddelanden.push(m); kanda.add(m.id); IH.spara(); IH.uppdateraMeny(); if (fonster) ritaFonster();
    return true;
  };
  G['chf-min-sida'] = (el) => { fl.oppen = true; fl.min = true; fl.kanal = el.getAttribute('data-kanal'); sparaFl(); IH.ga(tillbakaSida()); };
  G['chf-min'] = () => { fl.min = true; sparaFl(); ritaFonster(); };
  G['chf-stang'] = () => { fl.oppen = false; sparaFl(); ritaFonster(); };
  G['chf-lista'] = () => { fl.kanal = null; sparaFl(); ritaFonster(); const s = fonster && fonster.querySelector('[data-ch-sok]'); if (s && !pek()) s.focus({ preventScroll: true }); };
  G['chf-kanal'] = (el) => { oppnaIFonster(el.getAttribute('data-kanal')); };
  G['chf-storej'] = () => { satPref('storEj', !pref().storEj); ritaFonster(); IH.toast(pref().storEj ? 'Stör ej är på' : 'Stör ej är av', pref().storEj ? 'Inget ljud och ingen avisering från chatten.' : null, pref().storEj ? 'mane' : 'bjallra'); };
  G['ch-ny-grupp'] = () => {
    if (skrivskyddat()) return;
    IH.oppnaArk({
      titel: 'Ny grupp', under: 'Välj kollegor och ge gruppen ett namn.', ikon: 'samtal',
      kropp: '<form id="ch-ny-form" data-ch-ny><label class="falt"><span>Namn</span><input name="namn" maxlength="40" placeholder="T.ex. Montage vecka 46"></label>' +
        '<div class="ch-valj">' + IH.ANVANDARE.filter((u) => u.id !== jag()).map((u) => '<label><input type="checkbox" name="vem" value="' + u.id + '">' + avatar(u, true) + '<span><b>' + e(u.namn) + '</b><small>' + e(u.titel) + '</small></span></label>').join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ch-ny-form">' + ik('plus') + 'Skapa grupp</button>'
    });
  };
  G['ch-bjud'] = (el) => {
    if (skrivskyddat()) return;
    const k = C().kanaler.filter((x) => x.id === el.getAttribute('data-kanal'))[0]; if (!k) return;
    const kvar = IH.ANVANDARE.filter((u) => k.medlemmar.indexOf(u.id) < 0);
    if (!kvar.length) { IH.toast('Alla är redan med', null, 'kunder'); return; }
    IH.oppnaArk({ titel: 'Bjud in till ' + k.namn, ikon: 'kunder',
      kropp: '<form id="ch-bjud-form" data-ch-bjud data-kanal="' + k.id + '"><div class="ch-valj">' + kvar.map((u) => '<label><input type="checkbox" name="vem" value="' + u.id + '">' + avatar(u, true) + '<span><b>' + e(u.namn) + '</b><small>' + e(u.titel) + '</small></span></label>').join('') + '</div></form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ch-bjud-form">Bjud in</button>' });
  };
  function fokusText(iFonster) { requestAnimationFrame(() => { const rot = iFonster && fonster ? fonster : document.querySelector('[data-ch-yta="sida"]') || fonster; const r = rot && rot.querySelector('[data-ch-skriv] textarea'); if (r) { r.focus({ preventScroll: true }); const l = r.value.length; r.setSelectionRange(l, l); } }); }
  const vaxa = (r) => { r.style.height = 'auto'; r.style.height = Math.min(r.scrollHeight, 160) + 'px'; };
  // I fönstret byter raderna konversation i fönstret i stället för att lämna sidan
  document.addEventListener('click', (ev) => {
    const rad = ev.target.closest && ev.target.closest('.chf [data-ch-kanal]');
    if (rad) { ev.preventDefault(); oppnaIFonster(rad.getAttribute('data-ch-kanal')); }
  }, true);

  /* 08b Mer-menyn, länkkort, uppgift, påminnelse, fäst, oläst, sök, hopp och exempelsvar ------------- */
  // Fönstret byter konversation: allt som hörde till den förra nollställs, ett pågående sök i listan följer med
  function oppnaIFonster(kid) {
    if (ui.kanalFor !== kid) { bytKanal(kid); const q = ui.sok.trim(), t = q && traffar(kid, q); if (t && t.length) ui.sokTrad = { kanal: kid, q, aktiv: t[t.length - 1].id }; }
    fl.oppen = true; fl.min = false; fl.kanal = kid; sparaFl(); ritaFonster(); fokusText(true);
  }
  // Tid för påminnelser: "i dag 15:20", "i morgon 08:00", "måndag 08:00", "4 nov 08:00"
  function narText(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const n = -dagNr(iso), k = klocka(iso);
    return n === 0 ? 'i dag ' + k : n === 1 ? 'i morgon ' + k : n > 1 && n < 7 ? IH.lokal(d, 'd', { weekday: 'long' }) + ' ' + k : IH.datum(iso) + ' ' + k;
  }
  const narTid = (v) => {
    const d = new Date();
    if (v === '1h') { d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0); return d; }
    if (v === 'imorgon') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d; }
    d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); d.setHours(8, 0, 0, 0); return d; // nästa måndag
  };
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Kunder och affärer som nämns i ett meddelande, i ordning och en gång var
  const objektI = (m) => { const l = [], sett = new Set(); String(m.text || '').replace(OBJ, (x, typ, id) => { if (!sett.has(typ + id) && objekt(typ, id)) { sett.add(typ + id); l.push([typ, id]); } return x; }); return l; };
  const kundAffar = (o) => { if (!o) return { kund: null, affar: null }; if (o[0] === 'kund') return { kund: o[1], affar: null }; const a = IH.affar(o[1]); return { kund: a ? a.kund || null : null, affar: o[1] }; };

  // Mer-menyn: på ⋯-knappen, vid högerklick på bubblan och med Enter på ett markerat meddelande
  let menyEl = null, menyMid = null, menyFran = null;
  function stangMeny(aterFokus) {
    if (!menyEl) return;
    const m = menyEl; menyEl = null; menyMid = null;
    m.setAttribute('data-ut', ''); setTimeout(() => m.remove(), fart() ? 160 : 0);
    document.removeEventListener('pointerdown', utanforMeny, true);
    document.querySelectorAll('[data-g="ch-mer"][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (aterFokus && menyFran && menyFran.isConnected) menyFran.focus({ preventScroll: true });
    menyFran = null;
  }
  function utanforMeny(ev) { if (menyEl && !menyEl.contains(ev.target) && !(ev.target.closest && ev.target.closest('[data-g="ch-mer"]'))) stangMeny(); }
  function menyHtml(m, lage) {
    const egen = m.av === jag(), fast = arFast(m.id, m.kanal), pam = m.paminn && m.paminn[jag()] && !m.paminn[jag()].visad ? m.paminn[jag()] : null;
    const val = (g, ikon, text, extra, klass) => '<button type="button" role="menuitem" class="ch-meny__val' + (klass ? ' ' + klass : '') + '" data-g="' + g + '" data-mid="' + e(m.id) + '"' + (extra || '') + ' tabindex="-1">' + ikon + '<span>' + text + '</span></button>';
    if (lage === 'paminn') {
      return '<div class="ch-pamin">' + val('ch-meny-tillbaka', i('pilv'), 'Tillbaka') + '<hr>' +
        val('ch-paminn', ik('klocka'), 'Om 1 timme', ' data-nar="1h"') + val('ch-paminn', ik('soluppgang'), 'I morgon 08:00', ' data-nar="imorgon"') + val('ch-paminn', ik('kalender'), 'Nästa måndag 08:00', ' data-nar="mandag"') +
        (pam ? '<hr>' + val('ch-paminn', i('stang'), 'Ta bort påminnelsen', ' data-nar="av"', 'fara') : '') +
        '<p class="ch-meny__not">Påminnelsen syns i Att göra (prototyp – ingen avisering när fliken är stängd).</p></div>';
    }
    return val('ch-svara', ik('retur'), 'Svara <kbd>R</kbd>') + val('ch-uppgift', ik('todo'), 'Skapa uppgift <kbd>T</kbd>') +
      val('ch-paminn-meny', ik('klocka'), pam ? 'Påminner ' + e(narText(pam.tid)) + ' …' : 'Påminn mig …', ' aria-haspopup="menu"') +
      val('ch-fast', ik('nal'), fast ? 'Lossa <kbd>P</kbd>' : 'Fäst <kbd>P</kbd>') +
      (egen ? '' : val('ch-olast', ik('inkorg'), 'Markera som oläst')) + '<hr>' +
      val('ch-kopiera', i('kopiera'), 'Kopiera text') +
      (egen ? val('ch-andra', ik('redigera'), 'Ändra <kbd>E</kbd>') + val('ch-ta-bort', ik('papperskorg'), 'Ta bort', '', 'fara') : '') +
      ((kanal(m.kanal) || { medlemmar: [] }).medlemmar.length > 1 ? '<hr>' + val('ch-simulera', ik('gnista'), 'Simulera ett svar (exempel)', ' data-kanal="' + e(m.kanal) + '"') : '');
  }
  const forstaVal = () => { const b = menyEl && menyEl.querySelector('[role="menuitem"]'); if (b) b.focus({ preventScroll: true }); };
  function oppnaMeny(mid, fran, punkt) {
    const m = meddelande(mid); if (!m || m.borttagen) return;
    if (menyEl && menyMid === mid && !punkt) { stangMeny(true); return; }
    stangMeny(); stangObjkort();
    menyEl = document.createElement('div'); menyEl.className = 'ch-meny'; menyEl.setAttribute('role', 'menu'); menyEl.setAttribute('aria-label', 'Åtgärder för meddelandet');
    menyMid = mid; menyFran = fran || null;
    menyEl.innerHTML = menyHtml(m);
    document.body.appendChild(menyEl);
    placeraMeny(fran, punkt);
    if (fran && fran.matches && fran.matches('[data-g="ch-mer"]')) fran.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('pointerdown', utanforMeny, true), 0);
    forstaVal();
  }
  function placeraMeny(fran, punkt) {
    if (!menyEl) return;
    const r = punkt ? { left: punkt.x, right: punkt.x, top: punkt.y, bottom: punkt.y } : fran.getBoundingClientRect(), mr = menyEl.getBoundingClientRect();
    const under = r.bottom + 6 + mr.height < innerHeight - 8;
    const top = under ? r.bottom + 6 : Math.max(8, r.top - 6 - mr.height);
    const left = Math.max(8, Math.min(innerWidth - mr.width - 8, punkt ? r.left : r.right - mr.width));
    Object.assign(menyEl.style, { left: left + 'px', top: top + 'px', transformOrigin: (punkt ? 'left' : 'right') + ' ' + (under ? 'top' : 'bottom') });
  }
  G['ch-mer'] = (el) => oppnaMeny(el.getAttribute('data-mid'), el);
  G['ch-paminn-meny'] = () => { const m = meddelande(menyMid); if (!m || !menyEl) return; menyEl.innerHTML = menyHtml(m, 'paminn'); forstaVal(); };
  G['ch-meny-tillbaka'] = () => { const m = meddelande(menyMid); if (!m || !menyEl) return; menyEl.innerHTML = menyHtml(m); const b = menyEl.querySelector('[data-g="ch-paminn-meny"]'); if (b) b.focus({ preventScroll: true }); };
  // Pilar, Home/End och Tab i menyn (Esc stänger i fångstfasen ovan)
  addEventListener('keydown', (ev) => {
    if (!menyEl || !menyEl.contains(document.activeElement)) return;
    const knappar = [...menyEl.querySelectorAll('[role="menuitem"]')], n = knappar.indexOf(document.activeElement);
    if (ev.key === 'Tab') { stangMeny(true); ev.preventDefault(); return; }
    if (ev.key === 'ArrowLeft' && menyEl.querySelector('.ch-pamin')) { ev.preventDefault(); G['ch-meny-tillbaka'](); return; }
    if (ev.key === 'ArrowRight' && document.activeElement.matches('[data-g="ch-paminn-meny"]')) { ev.preventDefault(); G['ch-paminn-meny'](); return; }
    const steg = { ArrowDown: 1, ArrowUp: -1 }[ev.key], ytter = { Home: 0, End: knappar.length - 1 }[ev.key];
    if (steg || ytter != null) { ev.preventDefault(); ev.stopPropagation(); (knappar[ytter != null ? ytter : (n + steg + knappar.length) % knappar.length] || knappar[0]).focus({ preventScroll: true }); }
  }, true);
  // Högerklick (eller långt tryck) på ett meddelande öppnar samma meny vid pekaren
  document.addEventListener('contextmenu', (ev) => {
    const m = ev.target.closest && ev.target.closest('.ch-medd'); if (!m || ev.target.closest('a, textarea, input')) return;
    const mid = m.getAttribute('data-mid'), mm = meddelande(mid); if (!mm || mm.borttagen) return;
    ev.preventDefault();
    const tangent = !ev.clientX && !ev.clientY;
    oppnaMeny(mid, tangent ? m.querySelector('[data-g="ch-mer"]') || m : m, tangent ? null : { x: ev.clientX, y: ev.clientY });
  });

  // Länkkortet för #kund och #affär: klick eller Enter på chipet, Esc eller klick utanför stänger
  let objEl = null, objFran = null;
  function stangObjkort(aterFokus) {
    if (!objEl) return;
    const o = objEl; objEl = null; o.setAttribute('data-ut', ''); setTimeout(() => o.remove(), fart() ? 160 : 0);
    document.removeEventListener('pointerdown', utanforObj, true);
    if (aterFokus && objFran && objFran.isConnected) objFran.focus({ preventScroll: true });
    objFran = null;
  }
  function utanforObj(ev) { if (objEl && !objEl.contains(ev.target) && !(ev.target.closest && ev.target.closest('.ch-obj'))) stangObjkort(); }
  // Bara fakta som finns i datan – saknas ett värde skrivs raden inte ut
  function objFakta(typ, id) {
    const d = db(), rad = (dt, dd) => (dd ? '<div><dt>' + dt + '</dt><dd>' + e(dd) + '</dd></div>' : '');
    const nasta = (filt) => (d.uppgifter || []).filter((u) => !u.klar && filt(u)).sort((a, b) => (String(a.forfaller) < String(b.forfaller) ? -1 : 1))[0];
    const nastaText = (u) => (u ? u.text + (u.forfaller && !isNaN(new Date(u.forfaller)) ? ' · ' + IH.datum(u.forfaller) : '') : '');
    if (typ === 'kund') {
      const k = IH.kund(id); if (!k) return null;
      const aff = (d.affarer || []).filter((a) => a.kund === id), oppna = aff.filter((a) => a.steg !== 'vunnen' && !a.forlorad);
      const ansv = (oppna[0] || aff[0] || {}).ansvarig;
      return { rubrik: k.namn, under: 'Kund' + (k.ort ? ' · ' + k.ort : ''), ikon: 'kunder', href: '#/kunder/' + k.id,
        fakta: rad('Affärer', aff.length ? aff.length + (oppna.length ? ' · ' + oppna.length + ' öppna' : '') : '') + rad('Ansvarig', ansv ? anv(ansv).namn : '') + rad('Telefon', k.telefon) + rad('Nästa', nastaText(nasta((u) => u.kund === id))) };
    }
    const a = IH.affar(id); if (!a) return null;
    const k = IH.kund(a.kund), st = IH.steg(a.steg);
    return { rubrik: a.titel, under: 'Affär' + (k ? ' · ' + k.namn : ''), ikon: 'portfolj', href: '#/salj/' + a.id,
      fakta: rad('Steg', a.forlorad ? 'Förlorad' : st ? st.namn : '') + rad('Värde', a.varde ? IH.kr(a.varde) : '') + rad('Ansvarig', a.ansvarig ? anv(a.ansvarig).namn : '') + rad('Nästa', nastaText(nasta((u) => u.affar === id))) };
  }
  function oppnaObjkort(a, tangent) {
    const del = (a.getAttribute('data-ch-obj') || '').split(':'), o = objFakta(del[0], del[1]); if (!o) return false;
    if (objEl && objFran === a) { stangObjkort(true); return true; }
    stangObjkort(); stangMeny();
    objEl = document.createElement('div'); objEl.className = 'ch-objkort'; objEl.setAttribute('role', 'dialog'); objEl.setAttribute('aria-label', (del[0] === 'kund' ? 'Kund: ' : 'Affär: ') + o.rubrik);
    objEl.innerHTML = '<header><span class="ch-objkort__ikon">' + ik(o.ikon) + '</span><b>' + e(o.rubrik) + '</b><small>' + e(o.under) + '</small></header>' +
      (o.fakta ? '<dl class="ch-objkort__fakta">' + o.fakta + '</dl>' : '') +
      '<footer><a class="knapp knapp--liten" href="' + o.href + '">Öppna</a><button type="button" class="knapp knapp--liten" data-g="ch-objkort-stang">Stäng</button></footer>';
    document.body.appendChild(objEl); objFran = a;
    const r = a.getBoundingClientRect(), kr = objEl.getBoundingClientRect(), under = r.bottom + 6 + kr.height < innerHeight - 8;
    Object.assign(objEl.style, { left: Math.max(8, Math.min(innerWidth - kr.width - 8, r.left)) + 'px', top: (under ? r.bottom + 6 : Math.max(8, r.top - 6 - kr.height)) + 'px', transformOrigin: 'left ' + (under ? 'top' : 'bottom') });
    setTimeout(() => document.addEventListener('pointerdown', utanforObj, true), 0);
    if (tangent) { const l = objEl.querySelector('a'); if (l) l.focus({ preventScroll: true }); }
    return true;
  }
  G['ch-objkort-stang'] = () => stangObjkort(true);
  // Tab ut ur kortet stänger det (fokus går tillbaka till chipet)
  document.addEventListener('focusout', (ev) => { if (objEl && objEl.contains(ev.target) && ev.relatedTarget && !objEl.contains(ev.relatedTarget)) stangObjkort(); });

  // Skapa uppgift av ett meddelande: texten, i morgon, jag (chefen kan välja kollega) och första länkade kund/affär
  G['ch-uppgift'] = (el) => {
    stangMeny(); if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.borttagen) return;
    const text = klartext(m.text).replace(/\s+/g, ' ').trim().slice(0, 120) || (m.filer && m.filer[0] ? 'Titta på ' + m.filer[0].namn : '');
    const obj = objektI(m), imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    const valjer = IH.jag().chef || IH.jag().roll === 'admin', k = kanal(m.kanal);
    IH.oppnaArk({ titel: 'Skapa uppgift', ikon: 'todo', under: 'Från ' + (m.av === jag() ? 'ditt meddelande' : fornamn(anv(m.av)) + 's meddelande') + (k ? ' i ' + kanalNamn(k) : '') + '. Hamnar under Att göra.',
      kropp: '<form id="ch-uppgift-form" class="ch-uppgiftform" data-ch-uppgift data-mid="' + e(m.id) + '">' +
        (m.text ? '<blockquote class="ch-uppgiftform__citat">' + e(klartext(m.text).slice(0, 280)) + '</blockquote>' : '') +
        '<label class="falt"><span>Uppgift</span><input name="text" maxlength="200" required value="' + e(text) + '"></label>' +
        '<label class="falt"><span>Förfaller</span><input name="datum" type="date" required value="' + ymd(imorgon) + '"></label>' +
        (valjer ? '<label class="falt"><span>Ansvarig</span><select name="ansvarig">' + IH.ANVANDARE.filter((u) => !u.inaktiv).map((u) => '<option value="' + u.id + '"' + (u.id === jag() ? ' selected' : '') + '>' + e(u.namn) + (u.id === jag() ? ' (du)' : '') + '</option>').join('') + '</select></label>' : '') +
        (obj.length ? '<label class="falt"><span>Kopplad till</span><select name="obj"><option value="">Ingen</option>' + obj.map((o, n) => '<option value="' + o[0] + ':' + o[1] + '"' + (n ? '' : ' selected') + '>' + (o[0] === 'kund' ? 'Kund: ' : 'Affär: ') + e(objekt(o[0], o[1]).namn) + '</option>').join('') + '</select></label>' : '') +
        '</form>',
      fot: '<button class="knapp" type="button" data-g="stang-ark">Avbryt</button><button class="knapp knapp--virke" type="submit" form="ch-uppgift-form">' + ik('todo') + 'Skapa uppgift</button>' });
  };
  function sparaUppgift(f) {
    const m = meddelande(f.getAttribute('data-mid')), text = String(f.text.value || '').trim();
    if (!text) { IH.toast('Skriv vad som ska göras', null, 'varning'); return; }
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(f.datum.value) ? f.datum.value : ymd(new Date(Date.now() + 864e5));
    const nar = new Date(dag + 'T09:00:00');
    const o = f.obj && f.obj.value ? f.obj.value.split(':') : null, ka = kundAffar(o && objekt(o[0], o[1]) ? o : null);
    const ansv = f.ansvarig && IH.anvandare(f.ansvarig.value) ? f.ansvarig.value : jag();
    const d = db(); if (!Array.isArray(d.uppgifter)) d.uppgifter = [];
    d.uppgifter.push({ id: IH.nyttId('uppgift', 'u'), text: text.slice(0, 200), forfaller: nar.toISOString(), klar: false, kund: ka.kund, affar: ka.affar, ansvarig: ansv, av: jag(), chatt: m ? { kanal: m.kanal, mid: m.id } : null });
    IH.spara(); IH.stangArk(); IH.uppdateraMeny();
    IH.toast('Uppgiften ligger under Att göra', text.slice(0, 80) + ' · ' + IH.datum(nar.toISOString()) + (ansv !== jag() ? ' · ' + fornamn(anv(ansv)) : ''), 'todo', { lank: '#/att-gora', knapp: 'Visa' });
  }

  // Påminn mig: en uppgift i Att göra vid tiden + en rad under meddelandet; toast om fliken är öppen när tiden kommer
  G['ch-paminn'] = (el) => {
    const v = el.getAttribute('data-nar'); stangMeny(true); if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.borttagen) return;
    if (!m.paminn || typeof m.paminn !== 'object' || Array.isArray(m.paminn)) m.paminn = {};
    const d = db(), gml = m.paminn[jag()];
    if (!Array.isArray(d.uppgifter)) d.uppgifter = [];
    if (gml && gml.uppg) { const n = d.uppgifter.findIndex((u) => u.id === gml.uppg && !u.klar); if (n >= 0) d.uppgifter.splice(n, 1); }
    if (v === 'av') { delete m.paminn[jag()]; IH.spara(); ritaAllt(); IH.uppdateraMeny(); IH.toast('Påminnelsen är borttagen', null, 'klocka'); return; }
    const nar = narTid(v), id = IH.nyttId('uppgift', 'u'), ka = kundAffar(objektI(m)[0]);
    d.uppgifter.push({ id, text: 'Påminnelse: ' + (klartext(m.text).replace(/\s+/g, ' ').trim().slice(0, 100) || 'meddelande från ' + fornamn(anv(m.av))), forfaller: nar.toISOString(), klar: false, kund: ka.kund, affar: ka.affar, ansvarig: jag(), av: jag(), chatt: { kanal: m.kanal, mid: m.id } });
    m.paminn[jag()] = { tid: nar.toISOString(), uppg: id };
    IH.spara(); ritaAllt(); IH.uppdateraMeny(); planeraPaminnelser();
    IH.toast('Påminner ' + narText(nar.toISOString()), 'Syns i Att göra och i aviseringarna – när CRM:et är öppet i den här webbläsaren.', 'klocka', { lank: '#/att-gora', knapp: 'Att göra' });
  };
  let pamTimer = 0;
  function planeraPaminnelser() {
    clearTimeout(pamTimer); if (IH.visarSom && IH.visarSom()) return;
    const nu = Date.now(); let nasta = Infinity, andrad = false;
    C().meddelanden.forEach((m) => {
      const p = m.paminn && m.paminn[jag()]; if (!p || p.visad) return;
      const t = new Date(p.tid).getTime(); if (!isFinite(t)) return;
      if (t <= nu) {
        p.visad = true; andrad = true;
        const u = p.uppg && (db().uppgifter || []).filter((x) => x.id === p.uppg)[0];
        if (u && (u.klar || u.larmat)) return; // klar redan, eller redan larmad av Att göra
        if (u) u.larmat = new Date().toISOString();
        const txt = klartext(m.text).replace(/\s+/g, ' ').trim().slice(0, 90) || 'Ett meddelande i chatten', lank = '#/chatt/' + m.kanal + '/' + m.id;
        IH.toast('Påminnelse', txt, 'klocka', { lank, knapp: 'Visa', tid: 9000 });
        avisera({ typ: 'paminnelse', rubrik: 'Påminnelse från chatten', text: txt, lank });
        if (pref().avisera && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          try { const n = new Notification('Påminnelse', { body: txt, tag: 'pam-' + m.id, silent: true }); n.onclick = () => { focus(); location.hash = lank; n.close(); }; } catch (x) { /* */ }
        }
      }
      else nasta = Math.min(nasta, t);
    });
    if (andrad) { IH.spara(); ritaAllt(); }
    if (nasta < Infinity) pamTimer = setTimeout(planeraPaminnelser, Math.min(nasta - nu + 50, 2147483000));
  }

  // Fäst: högst 3 per konversation, banner överst i tråden
  G['ch-fast'] = (el) => {
    stangMeny(); if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.borttagen) return;
    const c = C(), l = c.fasta[m.kanal] = (Array.isArray(c.fasta[m.kanal]) ? c.fasta[m.kanal] : []).filter((f) => f && typeof f.mid === 'string');
    const n = l.findIndex((f) => f.mid === m.id);
    if (n >= 0) { l.splice(n, 1); IH.spara(); ritaAllt(); IH.toast('Meddelandet är lossat', null, 'nal'); return; }
    if (fasta(m.kanal).length >= 3) { IH.toast('Lossa ett fäst meddelande först', 'Högst tre fästa meddelanden per konversation.', 'varning'); return; }
    l.unshift({ mid: m.id, av: jag(), tid: new Date().toISOString() }); IH.spara(); ritaAllt(); IH.toast('Fäst överst i konversationen', null, 'nal');
  };
  G['ch-fast-fler'] = () => { ui.fastOppen = !ui.fastOppen; ritaAllt(); };
  function hoppaTill(yta, mid) {
    const m = [...yta.querySelectorAll('.ch-medd')].filter((x) => x.getAttribute('data-mid') === mid)[0]; if (!m) return;
    m.scrollIntoView({ block: 'center', behavior: lugn() ? 'auto' : 'smooth' }); m.classList.remove('blixt'); void m.offsetWidth; m.classList.add('blixt');
  }
  G['ch-hoppa-fast'] = (el) => hoppaTill(ytaFor(el), el.getAttribute('data-mid'));

  // Markera som oläst: läst-markeringen flyttas till strax före meddelandet
  G['ch-olast'] = (el) => {
    stangMeny(); if (skrivskyddat()) return;
    const m = meddelande(el.getAttribute('data-mid')); if (!m || m.av === jag()) return;
    const c = C(); c.last[jag()] = c.last[jag()] || {}; c.last[jag()][m.kanal] = new Date(new Date(m.tid).getTime() - 1).toISOString();
    ui.olastKvar = m.kanal; IH.spara(); ritaAllt(); IH.toast('Markerad som oläst', 'Blir läst igen när du öppnar konversationen nästa gång.', 'inkorg');
  };

  // Sök i tråden: träffarna märks, upp/ned flyttar, "2 av 5"
  function oppnaTradsok(kid) {
    stangMeny(); stangObjkort();
    if (ui.sokTrad && ui.sokTrad.kanal === kid) { const s = document.querySelector('[data-ch-tradsok]'); if (s) { s.focus(); s.select(); } return; }
    ui.sokTrad = { kanal: kid, q: '', aktiv: null, fokus: true }; ritaAllt();
  }
  G['ch-sok-tradoppna'] = (el) => { const kid = el.getAttribute('data-kanal'); if (ui.sokTrad && ui.sokTrad.kanal === kid) G['ch-sok-stang'](el); else oppnaTradsok(kid); };
  G['ch-sok-stang'] = (el) => { const iF = !!(el && el.closest && el.closest('.chf')); ui.sokTrad = null; ritaAllt(); fokusText(iF); };
  function flyttaTraff(steg) {
    const st = ui.sokTrad; if (!st) return;
    const l = traffar(st.kanal, st.q); if (!l.length) return;
    const n = l.findIndex((m) => m.id === st.aktiv);
    st.aktiv = l[n < 0 ? l.length - 1 : (n + steg + l.length) % l.length].id; ritaTraden();
  }
  G['ch-sok-upp'] = () => flyttaTraff(-1);
  G['ch-sok-ned'] = () => flyttaTraff(1);
  // Ctrl+F i chatten söker i tråden (utanför chatten gäller webbläsarens egen sökning)
  document.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || (ev.key !== 'f' && ev.key !== 'F')) return;
    const yta = ev.target.closest && ev.target.closest('.ch-tradyta, .chf, .ch-sokrad'); if (!yta) return;
    const kid = yta.closest('.chf') ? fl.kanal : sidKanal; if (!kid) return;
    ev.preventDefault(); oppnaTradsok(kid);
  });

  // "N nya ↓" / "Till senaste ↓"
  G['ch-hopp'] = (el) => {
    const t = ytaFor(el).querySelector('[data-ch-trad]'); if (!t) return;
    ui.nyaUnder = 0; t.scrollTo({ top: t.scrollHeight, behavior: lugn() ? 'auto' : 'smooth' }); fokusText(!!el.closest('.chf'));
  };

  // Ctrl+J: nästa konversation med olästa (i fönstret om det är öppet, annars på chattsidan)
  function nastaOlast() {
    const pa = /^#\/chatt/.test(location.hash), nu = pa ? sidKanal : fl.oppen && !fl.min ? fl.kanal : null;
    const l = kanaler().filter((k) => k.id !== nu && olasta(k.id) && (!tystad(k.id) || olastaNamn(k.id))).sort((a, b) => (senast(b.id).tid > senast(a.id).tid ? 1 : -1));
    if (!l.length) { IH.toast('Inga olästa konversationer', null, 'bock'); return; }
    if (!pa && fl.oppen && !fl.min) oppnaIFonster(l[0].id); else IH.ga('#/chatt/' + l[0].id);
  }
  document.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || (ev.key !== 'j' && ev.key !== 'J')) return;
    if (html.hasAttribute('data-ark-oppen') || html.hasAttribute('data-palett-oppen') || document.querySelector('.mote:not(.stanger)')) return;
    ev.preventDefault(); nastaOlast();
  });
  IH.chattNastaOlast = nastaOlast;

  // Simulera ett svar (exempel): "skriver …" efter 3 s, ett märkt exempelsvar efter 6 s – samma väg som ett riktigt
  // inkommande meddelande (pling, toast, avisering, bricka, bubbla och "N nya ↓")
  const EXEMPELSVAR = ['Låter bra, jag kollar.', 'Tack – återkommer i eftermiddag.', 'Uppfattat, jag tar det.', 'Jag tittar på det efter lunch.', 'Bra, då kör vi så.'];
  let simTimer = [];
  function visaSkriver() {
    document.querySelectorAll('[data-ch-skriver]').forEach((p) => {
      const kid = p.closest('.chf') ? fl.kanal : sidKanal, s = ui.skriver && ui.skriver.kanal === kid ? ui.skriver : null;
      p.hidden = !s; p.innerHTML = s ? skriverText(s) : '';
    });
  }
  G['ch-simulera'] = (el) => {
    stangMeny(); if (skrivskyddat()) return;
    const k = kanal(el.getAttribute('data-kanal')); if (!k) return;
    const andra = k.medlemmar.filter((id) => id !== jag() && IH.anvandare(id)); if (!andra.length) { IH.toast('Ingen annan i konversationen', null, 'varning'); return; }
    const av = andra[Math.floor(Math.random() * andra.length)], u = anv(av);
    simTimer.forEach(clearTimeout); ui.skriver = null; visaSkriver();
    IH.toast('Ett exempelsvar kommer om några sekunder', 'Byt sida eller minimera chatten och se hur ett nytt meddelande märks. Svaret märks ”exempel”.', 'gnista');
    simTimer = [setTimeout(() => { ui.skriver = { kanal: k.id, namn: fornamn(u) }; visaSkriver(); }, 3000),
      setTimeout(() => {
        ui.skriver = null; visaSkriver();
        if (!kanal(k.id)) return;
        C().meddelanden.push({ id: nyId('m'), kanal: k.id, av, tid: new Date().toISOString(), text: EXEMPELSVAR[Math.floor(Math.random() * EXEMPELSVAR.length)], exempel: true });
        IH.spara();
        if (/^#\/chatt/.test(location.hash)) IH.rita();
        kolla(); ritaFonster(); satTitel();
      }, 6000)];
  };

  // Pilar i tråden: ett tabbstopp, ↑/↓ flyttar markeringen, Home/End; R svara, E ändra, P fäst, T uppgift, Enter meny, Esc till rutan
  function satMarkerad(m) {
    const t = m.closest('[data-ch-trad]'); if (!t) return;
    ui.markerad = m.getAttribute('data-mid');
    t.querySelectorAll('.ch-medd').forEach((x) => {
      const pa = x === m; x.classList.toggle('markerad', pa); x.tabIndex = pa ? 0 : -1;
      x.querySelectorAll('.ch-verktyg button, .ch-reakt, .ch-citat').forEach((b) => { b.tabIndex = pa ? 0 : -1; });
    });
  }
  // Utan markering är det senaste meddelandet tabbstoppet
  function tabbStopp(rot) {
    (rot || document).querySelectorAll('[data-ch-trad]').forEach((t) => {
      if (t.querySelector('.ch-medd[tabindex="0"]')) return;
      const l = t.querySelectorAll('.ch-medd'); if (l.length) l[l.length - 1].tabIndex = 0;
    });
  }
  document.addEventListener('focusin', (ev) => {
    const el = ev.target; if (!el.closest) return;
    const m = el.closest('.ch-medd');
    if (m && m === el && el.matches(':focus-visible')) { satMarkerad(m); return; }
    if (m || !ui.markerad || el.closest('.ch-meny, .ch-objkort, .ark, .slojan')) return;
    // Fokus någon annanstans (t.ex. i rutan): markeringen släpper
    ui.markerad = null; document.querySelectorAll('.ch-medd.markerad').forEach((x) => x.classList.remove('markerad'));
  });
  document.addEventListener('keydown', (ev) => {
    const m = ev.target; if (!(m.matches && m.matches('.ch-medd')) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = m.closest('[data-ch-trad]'), alla = [...t.querySelectorAll('.ch-medd')], n = alla.indexOf(m), mid = m.getAttribute('data-mid'), mm = meddelande(mid);
    const ga = (x) => { ev.preventDefault(); if (!x) return; satMarkerad(x); x.focus({ preventScroll: true }); x.scrollIntoView({ block: 'nearest', behavior: lugn() ? 'auto' : 'smooth' }); };
    const iF = !!m.closest('.chf');
    switch (ev.key) {
      case 'ArrowDown': return ga(alla[n + 1]);
      case 'ArrowUp': return ga(alla[n - 1]);
      case 'Home': return ga(alla[0]);
      case 'End': return ga(alla[alla.length - 1]);
      case 'Escape': if (!iF) { ev.preventDefault(); ui.markerad = null; m.classList.remove('markerad'); fokusText(false); } return;
      case 'Enter': case 'ContextMenu': ev.preventDefault(); oppnaMeny(mid, m.querySelector('[data-g="ch-mer"]') || m); return;
      default:
    }
    if (ev.shiftKey && ev.key === 'F10') { ev.preventDefault(); oppnaMeny(mid, m.querySelector('[data-g="ch-mer"]') || m); return; }
    if (!mm || mm.borttagen || ev.shiftKey) return;
    const k = ev.key.toLowerCase();
    if (k === 'r') { ev.preventDefault(); G['ch-svara'](m); }
    else if (k === 'e' && mm.av === jag()) { ev.preventDefault(); G['ch-andra'](m); }
    else if (k === 'p') { ev.preventDefault(); G['ch-fast'](m); }
    else if (k === 't') { ev.preventDefault(); G['ch-uppgift'](m); }
  });

  /* 09 Skicka, formulär och tangenter ------------------------------------------------------------- */
  function skicka(f) {
    if (skrivskyddat()) return;
    const kid = f.getAttribute('data-kanal'), r = f.querySelector('textarea'), text = r.value.trim(), iF = !!f.closest('.chf');
    // Mallfält som inte fyllts i skickas inte – Enter hoppar till nästa fält i stället
    if (ui.mall && FALT.test(r.value)) { nastaFalt(r); return; }
    ui.mall = false;
    if (ui.andrar) {
      const m = meddelande(ui.andrar); ui.andrar = null;
      if (m && m.av === jag() && text && medLankar(text) !== m.text) { m.text = medLankar(text).slice(0, 4000); m.andrad = new Date().toISOString(); IH.spara(); }
      ritaAllt(); fokusText(iF); return;
    }
    if (!text && !ui.bilagor.length) return;
    const m = { id: nyId('m'), kanal: kid, av: jag(), tid: new Date().toISOString(), text: medLankar(text).slice(0, 4000) };
    if (ui.bilagor.length) m.filer = ui.bilagor.map((b) => ({ id: b.id, namn: b.namn, typ: b.typ, storlek: b.storlek, data: b.data, skanning: b.skanning }));
    const s = ui.svar && meddelande(ui.svar); if (s) m.svar = { mid: s.id, av: s.av, text: klartext(s.text).slice(0, 140) || (s.filer && s.filer[0] ? s.filer[0].namn : '') };
    C().meddelanden.push(m); kanda.add(m.id); ui.nya.add(m.id); ui.bilagor = []; ui.svar = null; ui.emoji = false; ui.markerad = null; ui.egetNytt = true; sparaUtkast(kid, '');
    // Det egna meddelandet är läst direkt – sparas i samma skrivning som meddelandet (en skrivning, inte två)
    const c = C(); c.last[jag()] = c.last[jag()] || {}; const forraLast = c.last[jag()][kid];
    if (!forraLast || forraLast < m.tid) c.last[jag()][kid] = m.tid;
    if (IH.spara() === false && !IH.dataSkrivsInte) { IH.toast('Meddelandet kunde inte sparas', 'Lagringen i webbläsaren är full – ta bort några bilder.', 'varning'); C().meddelanden.pop(); if (forraLast === undefined) delete c.last[jag()][kid]; else c.last[jag()][kid] = forraLast; }
    markeraLast(kid); ritaAllt(); fokusText(iF);
  }
  document.addEventListener('submit', (ev) => {
    const t = ev.target;
    if (t.matches('[data-ch-skriv]')) { ev.preventDefault(); skicka(t); return; }
    if (t.matches('[data-ch-ny], [data-ch-bjud], [data-ch-namn], [data-ch-uppgift]') && skrivskyddat()) { ev.preventDefault(); IH.stangArk(); return; }
    if (t.matches('[data-ch-uppgift]')) { ev.preventDefault(); sparaUppgift(t); return; }
    if (t.matches('[data-ch-ny]')) {
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
    const x = f.lista[n], slut = r.value.slice(r.selectionStart), text = /^[?!.,:;)]/.test(slut) ? x.text.replace(/\s+$/, '') : x.text;
    r.value = r.value.slice(0, f.fran) + text + slut; const p = f.fran + text.length; r.setSelectionRange(p, p);
    ui.forslag = null; r.closest('form').querySelector('[data-ch-forslag]').hidden = true; r.focus();
    sparaUtkast(r.closest('form').getAttribute('data-kanal'), r.value); tomLage(r.closest('form'));
  }
  // Skicka-knappen är dämpad när det inte finns något att skicka
  const tomLage = (f) => { const r = f && f.querySelector('textarea'); if (r) f.toggleAttribute('data-tom', !r.value.trim() && !ui.bilagor.length); };
  // Mallar: / först i rutan visar listan; pilar + Enter/Tab väljer
  function visaMallar(r) {
    const box = r.closest('form').querySelector('[data-ch-mallar]'); if (!box) return;
    const m = /^\/(\S*)$/.exec(r.value), q = m ? m[1].toLowerCase() : '';
    const l = m && !ui.andrar ? allaMallar().map((x, n) => ({ n, namn: x[0], text: x[1] })).filter((x) => (x.namn + ' ' + x.text).toLowerCase().indexOf(q) >= 0) : [];
    if (!l.length) { ui.mallar = null; box.hidden = true; return; }
    const vald = ui.mallar ? Math.min(ui.mallar.vald, l.length - 1) : 0;
    ui.mallar = { lista: l, vald };
    box.hidden = false;
    box.innerHTML = '<p class="ch-mallar__rub">Mallar · <kbd>Enter</kbd> väljer</p>' + l.map((x, j) => '<button type="button" class="ch-mallar__val' + (j === vald ? ' vald' : '') + '" role="option" aria-selected="' + (j === vald) + '" data-ch-mall="' + x.n + '" tabindex="-1"><b>' + e(x.namn) + '</b><small>' + e(x.text) + '</small></button>').join('');
  }
  function valjMall(r, n) {
    const x = allaMallar()[n], f = r.closest('form'); if (!x) return;
    ui.mallar = null; f.querySelector('[data-ch-mallar]').hidden = true;
    r.value = x[1].replace(/\{säljare\}/gi, IH.jag().namn); ui.mall = true; vaxa(r); r.focus();
    if (!nastaFalt(r)) { const l = r.value.length; r.setSelectionRange(l, l); }
    sparaUtkast(f.getAttribute('data-kanal'), r.value); tomLage(f);
  }
  // Markerar nästa {fält} – {kund} och {affär} blir # och öppnar förslagen på kunder och affärer
  function nastaFalt(r) {
    // Nästa fält efter markören (eller det markerade), annars runt till början
    const hint = r.closest('form').querySelector('[data-ch-mallfalt]'), fran = r.selectionEnd || 0, efter = FALT.exec(r.value.slice(fran));
    const m = efter ? { 0: efter[0], 1: efter[1], index: efter.index + fran } : FALT.exec(r.value);
    if (!m) { ui.mall = false; if (hint) hint.hidden = true; return false; }
    r.focus();
    if (/^(kund|affär)$/i.test(m[1])) { r.value = r.value.slice(0, m.index) + '#' + r.value.slice(m.index + m[0].length); r.setSelectionRange(m.index + 1, m.index + 1); visaForslag(r); }
    else r.setSelectionRange(m.index, m.index + m[0].length);
    if (hint) { hint.hidden = false; hint.innerHTML = 'Fyll i <b>' + e(m[1]) + '</b> · <kbd>Tab</kbd> nästa fält'; }
    return true;
  }
  document.addEventListener('mousedown', (ev) => { const b = ev.target.closest && ev.target.closest('[data-ch-mall]'); if (!b) return; ev.preventDefault(); valjMall(b.closest('form').querySelector('textarea'), +b.getAttribute('data-ch-mall')); });
  document.addEventListener('mousedown', (ev) => { const b = ev.target.closest && ev.target.closest('[data-ch-valj]'); if (!b) return; ev.preventDefault(); valjForslag(b.closest('form').querySelector('textarea'), +b.getAttribute('data-ch-valj')); });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('[data-ch-sok]')) {
      ui.sok = t.value;
      document.querySelectorAll('.ch-lista [data-ch-listan]').forEach((n) => { n.innerHTML = listaHtml(sidKanal); });
      document.querySelectorAll('.chf-lista[data-ch-listan]').forEach((n) => { n.innerHTML = listaHtml(null); });
      return;
    }
    if (t.matches && t.matches('[data-ch-tradsok]')) {
      const st = ui.sokTrad; if (!st) return;
      st.q = t.value; const l = traffar(st.kanal, st.q); st.aktiv = l.length ? l[l.length - 1].id : null; ritaTraden(); return;
    }
    if (!(t.closest && t.closest('[data-ch-skriv]')) || t.tagName !== 'TEXTAREA') return;
    const f = t.closest('form');
    vaxa(t); sparaUtkast(f.getAttribute('data-kanal'), t.value); tomLage(f); visaForslag(t); visaMallar(t);
    if (ui.mall && !FALT.test(t.value)) { ui.mall = false; const h = f.querySelector('[data-ch-mallfalt]'); if (h) h.hidden = true; }
  });
  // Enter/Shift+Enter i sökraden går mellan träffarna; Esc stänger (på sidan – i fönstret sköts Esc ovan)
  document.addEventListener('keydown', (ev) => {
    const t = ev.target; if (!(t.matches && t.matches('[data-ch-tradsok]'))) return;
    if (ev.key === 'Enter') { ev.preventDefault(); flyttaTraff(ev.shiftKey ? -1 : 1); }
    else if (ev.key === 'Escape') { ev.preventDefault(); G['ch-sok-stang'](t); }
  });
  document.addEventListener('keydown', (ev) => {
    const r = ev.target; if (!(r.closest && r.closest('[data-ch-skriv]')) || r.tagName !== 'TEXTAREA') return;
    const f = ui.forslag, ml = ui.mallar;
    if (ml && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault(); ml.vald = (ml.vald + (ev.key === 'ArrowDown' ? 1 : -1) + ml.lista.length) % ml.lista.length;
      r.closest('form').querySelectorAll('[data-ch-mall]').forEach((b, j) => { b.classList.toggle('vald', j === ml.vald); b.setAttribute('aria-selected', String(j === ml.vald)); }); return;
    }
    if (ml && (ev.key === 'Enter' || ev.key === 'Tab') && !ev.shiftKey) { ev.preventDefault(); valjMall(r, ml.lista[ml.vald].n); return; }
    if (ml && ev.key === 'Escape') { ui.mallar = null; r.closest('form').querySelector('[data-ch-mallar]').hidden = true; return; }
    if (!f && ui.mall && ev.key === 'Tab' && !ev.shiftKey && FALT.test(r.value)) { ev.preventDefault(); nastaFalt(r); return; }
    if (f && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { ev.preventDefault(); f.vald = (f.vald + (ev.key === 'ArrowDown' ? 1 : -1) + f.lista.length) % f.lista.length; r.closest('form').querySelectorAll('[data-ch-valj]').forEach((b, j) => b.classList.toggle('vald', j === f.vald)); return; }
    if (f && (ev.key === 'Enter' || ev.key === 'Tab')) { ev.preventDefault(); valjForslag(r, f.vald); return; }
    if (ev.key === 'Escape') { if (f) { ui.forslag = null; r.closest('form').querySelector('[data-ch-forslag]').hidden = true; } else if (ui.andrar || ui.svar || ui.emoji) { ui.andrar = ui.svar = null; ui.emoji = false; const iF = !!r.closest('.chf'); ritaAllt(); fokusText(iF); } return; }
    if (ev.key === 'ArrowUp' && !r.value) {
      const kid = r.closest('form').getAttribute('data-kanal'), egna = iKanal(kid).filter((m) => m.av === jag() && !m.borttagen && !m.system);
      if (egna.length) { ev.preventDefault(); ui.andrar = egna[egna.length - 1].id; const iF = !!r.closest('.chf'); ritaAllt(); fokusText(iF); }
      return;
    }
    // Pekskärm: Enter ger ny rad och man skickar med knappen. Ctrl+Enter skickar alltid.
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && (!pek() || ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); skicka(r.closest('form')); }
  });
  // Citatet hoppar till originalet; tryck på ett meddelande (pekskärm) visar verktygen
  document.addEventListener('click', (ev) => {
    const c = ev.target.closest && ev.target.closest('[data-ch-hoppa]');
    if (c) { hoppaTill(ytaFor(c), c.getAttribute('data-ch-hoppa')); return; }
    // #kund och #affär: kortet med fakta (Ctrl/Cmd-klick öppnar sidan direkt)
    const o = ev.target.closest && ev.target.closest('.ch-obj[data-ch-obj]');
    if (o && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button === 0) { if (oppnaObjkort(o, ev.detail === 0)) ev.preventDefault(); return; }
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
  let kanda = new Set(C().meddelanden.map((m) => m.id)), kandaSedan = Date.now(), kandaC = C();
  const lasOmKanda = () => { kanda = new Set(C().meddelanden.map((m) => m.id)); kandaSedan = Date.now(); kandaC = C(); };
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
  // franFlik: datan kom från en annan flik (storage). Utan den betyder utbytt data en import eller återställning –
  // då är bara det som skapats alldeles nyss nytt (t.ex. ett simulerat svar), inte allt som råkar saknas i kanda.
  function kolla(franFlik) {
    const nu = Date.now(), fran = kandaSedan - (franFlik || C() === kandaC ? 120000 : 5000);
    const nya = C().meddelanden.filter((m) => { if (kanda.has(m.id)) return false; const t = Date.parse(m.tid); return t >= fran && t <= nu + 120000; });
    lasOmKanda();
    const franAndra = nya.filter((m) => m.av !== jag() && !m.system && kanal(m.kanal));
    if (!franAndra.length) return;
    // Menybrickan, fliktiteln, bubblan och dockan räknar samma sak
    IH.uppdateraMeny(); satTitel(); uppdateraIkon();
    // Nya från andra glider in (ch-ny-in-mottagen): på sidan direkt på de redan ritade, i fönstret via omritningen
    franAndra.forEach((m) => { ui.nya.add(m.id); ui.nyaIn.add(m.id); document.querySelectorAll('.ch-medd').forEach((x) => { if (x.getAttribute('data-mid') === m.id) x.classList.add('ny', 'ny--in'); }); });
    setTimeout(() => franAndra.forEach((m) => { ui.nya.delete(m.id); ui.nyaIn.delete(m.id); }), 1000);
    // Läser man längre upp i samma tråd: "N nya meddelanden ↓"
    document.querySelectorAll('[data-ch-yta] [data-ch-trad]').forEach((t) => {
      const kid = t.closest('.chf') ? fl.kanal : sidKanal, n = franAndra.filter((m) => m.kanal === kid).length;
      if (n && t.scrollHeight - t.scrollTop - t.clientHeight >= 40) { ui.nyaUnder += n; uppdateraHopp(t); }
    });
    // Tystade konversationer hörs bara när någon nämner dig
    const tillMig = franAndra.filter((m) => !tystad(m.kanal) || namnerMig(m));
    if (!tillMig.length) return;
    const synsKanal = (kid) => document.visibilityState === 'visible' && ((/^#\/chatt/.test(location.hash) && sidKanal === kid) || (fl.oppen && !fl.min && fl.kanal === kid));
    const perKanal = {};
    tillMig.forEach((x) => { (perKanal[x.kanal] = perKanal[x.kanal] || []).push(x); });
    Object.keys(perKanal).forEach((kid) => {
      if (synsKanal(kid)) return;
      const l = perKanal[kid], x = l[l.length - 1], kk = kanal(kid), mig = l.some(namnerMig);
      avisera({ typ: mig ? 'omnamnande' : 'chatt', nyckel: avisNyckel(kid), lank: '#/chatt/' + kid + '/' + x.id,
        rubrik: fornamn(anv(x.av)) + (mig ? ' nämnde dig' : '') + (kk.typ === 'privat' ? '' : ' i ' + kanalNamn(kk)),
        text: (klartext(x.text).replace(/\s+/g, ' ').trim() || 'Skickade en fil').slice(0, 140) });
    });
    const m = tillMig[tillMig.length - 1], u = anv(m.av), k = kanal(m.kanal);
    pling();
    const syns = (/^#\/chatt/.test(location.hash) && sidKanal === m.kanal) || (fl.oppen && !fl.min && fl.kanal === m.kanal);
    if (!syns && !pref().storEj) IH.toast(fornamn(u) + (namnerMig(m) ? ' nämnde dig' : k.typ === 'privat' ? '' : ' i ' + kanalNamn(k)), klartext(m.text).slice(0, 90) || 'Skickade en fil', 'samtal', { lank: '#/chatt/' + m.kanal, knapp: 'Svara' });
    if (pref().avisera && document.visibilityState === 'hidden' && !pref().storEj && 'Notification' in window && Notification.permission === 'granted') {
      try { const n = new Notification(u.namn + (k.typ === 'privat' ? '' : ' · ' + kanalNamn(k)), { body: klartext(m.text).slice(0, 140), tag: m.kanal, silent: true }); n.onclick = () => { focus(); location.hash = '#/chatt/' + m.kanal; n.close(); }; } catch (x) { /* */ }
    }
  }
  addEventListener('storage', (ev) => { if (ev.key === IH.NYCKEL) setTimeout(() => { kolla(true); ritaFonster(); satTitel(); }, 60); });
  // Fliken syns igen: det öppna (sidan eller fönstret) blir läst
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (/^#\/chatt/.test(location.hash) && sidKanal) markeraLast(sidKanal);
    else if (fonster && fl.oppen && !fl.min && fl.kanal) markeraLast(fl.kanal);
    uppdateraIkon(); planeraPaminnelser();
  });

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
    simTimer.forEach(clearTimeout); clearTimeout(utkastTimer); ui.skriver = null; bytKanal();
    ui.sok = ''; ui.utkast = {}; sidKanal = null; sidRull = null; fl.kanal = null; sparaFl();
    valjAnv(el); lasOmKanda();
    // Det nya kontots sparade utkast
    const u = (pref().utkast || {})[jag()]; if (u && typeof u === 'object') Object.keys(u).forEach((k) => { if (typeof u[k] === 'string') ui.utkast[k] = u[k]; });
    ritaFonster(); satTitel(); planeraPaminnelser();
  };
  setTimeout(() => { ritaFonster(); satTitel(); planeraPaminnelser(); }, 0);

  /* 13 Sökpaletten: meddelanden i konversationer jag är med i (IH.sok.lagg i app.js) ----------- */
  function sokMeddelanden(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2 || (IH.sparrad && IH.sparrad('chatt'))) return [];
    const ut = [];
    kanaler().forEach((k) => {
      const kn = kanalNamn(k).toLowerCase();
      iKanal(k.id).forEach((m) => {
        if (m.system || m.borttagen) return;
        const t = klartext(m.text).replace(/\s+/g, ' ').trim(), u = anv(m.av);
        if ((t + ' ' + u.namn + ' ' + kn).toLowerCase().indexOf(q) < 0) return;
        ut.push({ m, k, t, u });
      });
    });
    return ut.sort((a, b) => (a.m.tid < b.m.tid ? 1 : -1)).slice(0, 5).map((x) => {
      const n = x.t.toLowerCase().indexOf(q), fran = n > 30 ? n - 24 : 0;
      return { mal: 'ga:#/chatt/' + x.k.id + '/' + x.m.id, ikon: avatar(x.u, true),
        rubrik: ((fran ? '…' : '') + x.t.slice(fran, fran + 90)) || (x.m.filer && x.m.filer.length ? 'Fil' : 'Meddelande'),
        under: x.u.namn + (x.k.typ === 'privat' ? '' : ' · ' + kanalNamn(x.k)) + ' · ' + listTid(x.m.tid), typ: 'Meddelande' };
    });
  }
  IH.chattSok = sokMeddelanden;
  if (IH.sok && typeof IH.sok.lagg === 'function') { try { IH.sok.lagg('Chatt', sokMeddelanden); } catch (x) { /* paletten saknas */ } }
})();
