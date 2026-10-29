/* Legohus CRM – videomotorn (IH.samtal).
 *
 * Fristående: kräver bara window.IH. Rör inte IH.db, IH.toast eller IH.G och ritar inget i dokumentet –
 * gränssnittet (samtal-ui.js) lyssnar på händelserna och ritar.
 *
 * Kamera och mikrofon (getUserMedia), skärmdelning (getDisplayMedia) och WebRTC är på riktigt.
 * Signaleringen går i prototypen över BroadcastChannel, alltså bara mellan flikar i samma webbläsare.
 * Riktiga möten mellan datorer: byt till LiveKit/Daily (SFU) + TURN via IH.samtal.sattSignal(impl).
 * Behörighet (vem får släppa in) ska då avgöras av servern – här litar flikarna på varandra.
 *
 * Bakgrundsoskärpa och bakgrundsbild: MediaPipe ImageSegmenter (lokal kopia i vendor/mediapipe/), laddas först
 * när någon väljer Oskärpa eller Bild. Ingen bild lämnar webbläsaren.
 */
(function () {
  'use strict';
  var IH = window.IH = window.IH || {};
  if (IH.samtal && IH.samtal.__motor) return;

  var SKRIPT = (document.currentScript && document.currentScript.src) || location.href;
  var VENDOR = new URL('vendor/mediapipe/', SKRIPT).href;
  var MAX_DELTAGARE = 4; // direktsamtal (mesh): varje deltagare skickar till alla andra
  var HJARTSLAG_MS = 5000, TYST_MS = 15000, KNACK_MS = 4000, KNACK_MAX_MS = 10 * 60 * 1000;
  var TYPER = ['hej', 'status', 'info-fraga', 'info', 'knackar', 'slapp-in', 'neka', 'sdp', 'ice', 'reaktion', 'chatt',
    'lamnar', 'avsluta-alla', 'ta-bort', 'las', 'tysta', 'ny-vard', 'inspelning', 'omstart', 'innehall', 'innehall-forslag', 'innehall-fil'];
  var VARDKOMMANDON = ['slapp-in', 'neka', 'avsluta-alla', 'ta-bort', 'las', 'tysta', 'ny-vard'];
  var REAKTIONER = ['gilla', 'hjarta', 'applad', 'skratt', 'forvanad'];
  var UPPLOSNING = { 360: [640, 360], 720: [1280, 720], 1080: [1920, 1080] };
  var FELTEXT = {
    nekad: 'Webbläsaren har blockerat kameran. Klicka på kamerasymbolen i adressfältet och välj Tillåt.',
    saknas: 'Ingen kamera hittades – du kan gå med med bara ljud.',
    upptagen: 'Kameran används av ett annat program. Stäng det och klicka på Försök igen.',
    osaker: 'Videomöten kräver en säker anslutning (https).',
    okand: 'Kameran eller mikrofonen kunde inte startas. Försök igen.',
    'bakgrund-fel': 'Bakgrunden kunde inte startas i den här webbläsaren.',
    'skarm-nekad': 'Skärmdelningen avbröts.',
    'skarm-fel': 'Skärmen kunde inte delas i den här webbläsaren.',
    'annan-delar': 'Någon annan delar redan sin skärm.',
    'mik-fel': 'Mikrofonen kunde inte startas.',
    'kam-fel': 'Kameran kunde inte startas.'
  };

  /* ---------- småhjälp ---------- */
  function nu() { return Date.now(); }
  function iso(t) { return new Date(t || nu()).toISOString(); }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function slump(n) {
    var a = new Uint8Array(n || 8); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function initialer(namn) {
    var d = String(namn || '').trim().split(/\s+/).filter(Boolean);
    if (!d.length) return '?';
    return ((d[0][0] || '') + (d.length > 1 ? d[d.length - 1][0] : '')).toUpperCase();
  }
  function fel(kod, text) { return { kod: kod, text: text || FELTEXT[kod] || FELTEXT.okand }; }
  function kopia(o) { return JSON.parse(JSON.stringify(o)); }
  function stoppa(spar) { if (spar) try { spar.stop(); } catch (e) { } }

  /* ---------- händelser ---------- */
  var lyss = {};
  function pa(namn, fn) { (lyss[namn] = lyss[namn] || []).push(fn); return function () { av(namn, fn); }; }
  function av(namn, fn) { var l = lyss[namn]; if (l) { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  function harLyss(namn) { return !!(lyss[namn] && lyss[namn].length); }
  function sand(namn, data) {
    (lyss[namn] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { if (window.console) console.error('[samtal] ' + namn, e); }
    });
  }

  /* ---------- signal (utbytbar) ---------- */
  // Kontrollerar att ett meddelande följer schemat: korta strängar, begränsat djup. sdp får vara längre.
  function giltigData(v, djup, nyckel) {
    if (djup > 6) return false;
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return true;
    if (typeof v === 'string') return v.length <= (nyckel === 'sdp' ? 200000 : nyckel === 'bit' ? 48000 : 2000);
    if (Array.isArray(v)) return v.length <= 50 && v.every(function (x) { return giltigData(x, djup + 1, nyckel); });
    if (typeof v === 'object') {
      var k = Object.keys(v); if (k.length > 40) return false;
      return k.every(function (n) { return n !== '__proto__' && n !== 'constructor' && giltigData(v[n], djup + 1, n); });
    }
    return false;
  }
  function flikSignal() {
    var kanal = null, jagPeer = null, fns = [];
    return {
      namn: 'flikar',
      anslut: function (rum, jag) {
        if (kanal) try { kanal.close(); } catch (e) { }
        jagPeer = jag.peer;
        if (!('BroadcastChannel' in window)) return Promise.reject(fel('okand', 'Webbläsaren saknar stöd för videomöten.'));
        kanal = new BroadcastChannel('ih-videomote-' + rum);
        kanal.onmessage = function (e) {
          var m = e.data;
          if (!m || typeof m !== 'object' || m.v !== 1) return;
          if (typeof m.fran !== 'string' || m.fran.length > 64 || m.fran === jagPeer) return;
          if (m.till !== '*' && m.till !== jagPeer) return;
          if (TYPER.indexOf(m.typ) < 0 || !giltigData(m.data, 0, '')) return;
          fns.slice().forEach(function (fn) { fn({ fran: m.fran, till: m.till, typ: m.typ, data: m.data || {} }); });
        };
        return Promise.resolve();
      },
      skicka: function (till, typ, data) {
        if (!kanal) return;
        try { kanal.postMessage({ v: 1, fran: jagPeer, till: till || '*', typ: typ, data: data || {} }); } catch (e) { }
      },
      lyssna: function (fn) { fns.push(fn); return function () { var i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); }; },
      lamna: function () { if (kanal) try { kanal.close(); } catch (e) { } kanal = null; fns = []; }
    };
  }

  /* ---------- inställningar ---------- */
  var FORVAL = {
    kamera: '', mikrofon: '', hogtalare: '', upplosning: 720, fps: 30, sandning: 'auto', taEmot: 'allt',
    spegla: true, ljus: false, brus: true, eko: true, volym: true,
    bakgrund: { lage: 'ingen', styrka: 'latt', bild: '' }, mikPa: true, kamPa: true, egenHorn: 'nh'
  };
  var inst = kopia(FORVAL), instNyckel = null;
  function nyckel() { return 'ih-crm-videomote:' + (S.jag && S.jag.id ? S.jag.id : 'gast'); }
  function laddaInst() {
    var k = nyckel(); if (k === instNyckel) return;
    instNyckel = k; inst = kopia(FORVAL);
    try {
      var s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s && typeof s === 'object') Object.keys(FORVAL).forEach(function (n) {
        if (n === 'bakgrund') { if (s.bakgrund && typeof s.bakgrund === 'object') inst.bakgrund = {
          lage: ['ingen', 'oskarpa', 'bild'].indexOf(s.bakgrund.lage) >= 0 ? s.bakgrund.lage : 'ingen',
          styrka: s.bakgrund.styrka === 'stark' ? 'stark' : 'latt', bild: str(s.bakgrund.bild, 300) }; }
        else if (s[n] !== undefined && typeof s[n] === typeof FORVAL[n]) inst[n] = s[n];
      });
      if (!UPPLOSNING[inst.upplosning]) inst.upplosning = 720;
      if ([15, 24, 30].indexOf(inst.fps) < 0) inst.fps = 30;
      if (['auto', 'spara', 'ljud'].indexOf(inst.sandning) < 0) inst.sandning = 'auto';
      if (['allt', 'ljud'].indexOf(inst.taEmot) < 0) inst.taEmot = 'allt';
    } catch (e) { }
  }
  function sparaInst() {
    try {
      var s = kopia(inst);
      if (/^blob:/.test(s.bakgrund.bild)) s.bakgrund.bild = ''; // egen uppladdad bild sparas inte
      localStorage.setItem(nyckel(), JSON.stringify(s));
    } catch (e) { }
  }

  /* ---------- tillstånd ---------- */
  var S = {
    fas: 'av', mote: null, jag: null, signal: flikSignal(), avSignal: null,
    peers: {},          // peer → post (alla vi hört av, oavsett fas)
    vantande: {},       // peer → {peer, namn, gast, roll, sedan, sett}
    last: false, vantrum: true, delare: null,
    borjade: null, narvarande: {}, chatt: [],
    knackTimer: null, knackStart: 0, hjartTimer: null, statsTimer: null, nivaTimer: null,
    ljudlage: 'dator', talare: null, kandidat: null, kandidatSedan: 0,
    natverkJag: null, svag: false, svagSedan: 0, braSedan: 0, autoSpara: false
  };
  var M = {             // media
    rakam: null,        // kamerans rå-spår
    mik: null,          // mikrofonspåret
    pipe: null,         // {video, canvas, ctx, spar, ...}
    lokal: null,        // MediaStream (ut-kamera + mik) – samma som skickas
    skarm: null,        // MediaStream för egen skärmdelning
    element: [],        // ljud/video-element från UI (högtalare)
    ac: null, analys: {} // AudioContext och analyser per peer ('jag' = egen)
  };
  // Det kamera-spår som skickas: pipelinens om den är på, annars kamerans eget.
  function utKam() { return M.pipe && M.pipe.spar ? M.pipe.spar : M.rakam; }
  function kamSkickas() { return !!(utKam() && S.jag && S.jag.kam && inst.sandning !== 'ljud'); }

  function sattFas(fas, orsak) {
    if (S.fas === fas) return;
    var forra = S.fas; S.fas = fas;
    if (S.jag) S.jag.fas = fas;
    sand('fas', { fas: fas, forra: forra, orsak: orsak || null });
  }

  function deltagarObj(p) {
    return {
      peer: p.peer, id: p.id || null, namn: p.namn, initialer: initialer(p.namn), roll: p.roll, gast: p.roll === 'gast',
      mik: p.mik, kam: p.kam, hand: p.hand, handTid: p.handTid, delar: p.delar, talar: !!p.talar,
      natverk: p.natverk || null, kamera: p.kamera || null, skarm: p.skarm || null, vantar: false
    };
  }
  function iMotet() {
    return Object.keys(S.peers).map(function (k) { return S.peers[k]; }).filter(function (p) { return p.i === 'mote'; });
  }
  function deltagarLista() { return iMotet().map(deltagarObj); }
  function vantandeLista() {
    return Object.keys(S.vantande).map(function (k) { var v = S.vantande[k]; return { peer: v.peer, namn: v.namn, initialer: initialer(v.namn), gast: v.gast, roll: v.roll, sedan: v.sedan, vantar: true }; })
      .sort(function (a, b) { return a.sedan - b.sedan; });
  }
  function vardIMotet() { return iMotet().some(function (p) { return p.roll === 'vard'; }) || (S.fas === 'mote' && S.jag && S.jag.roll === 'vard'); }
  function jagObj() {
    var j = S.jag; if (!j) return null;
    return { peer: j.peer, id: j.id || null, namn: j.namn, initialer: initialer(j.namn), roll: j.roll, gast: j.roll === 'gast',
      mik: j.mik, kam: j.kam, hand: j.hand, handTid: j.handTid, delar: j.delar, talar: !!j.talar };
  }

  function tillstand() {
    return {
      fas: S.fas, mote: S.mote ? kopia(S.mote) : null, jag: jagObj(), deltagare: deltagarLista(), vantande: vantandeLista(),
      last: S.last, vantrum: S.vantrum, delare: S.delare, vardNarvarande: vardIMotet(), talare: S.talare,
      ljudlage: S.ljudlage, borjade: S.borjade, natverk: S.natverkJag, signal: S.signal.namn,
      innehall: innehallInfo(),
      layoutTips: S.delare || IN.aktiv ? 'delning' : (iMotet().length >= 2 ? 'galleri' : 'talare')
    };
  }

  function stod() {
    var md = navigator.mediaDevices, c = document.createElement('canvas');
    var gl = false;
    try { var c3 = document.createElement('canvas'); gl = !!(c3.getContext('webgl2') || c3.getContext('webgl')); } catch (e) { }
    return {
      media: !!(md && md.getUserMedia), skarm: !!(md && md.getDisplayMedia), sakert: !!window.isSecureContext,
      sinkId: typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype,
      rvfc: typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
      mediaRecorder: typeof MediaRecorder !== 'undefined', captureStream: typeof c.captureStream === 'function',
      canvasFilter: 'filter' in (c.getContext('2d') || {}),
      bakgrund: typeof WebAssembly === 'object' && typeof c.captureStream === 'function' && gl,
      webrtc: typeof RTCPeerConnection !== 'undefined', flikar: 'BroadcastChannel' in window
    };
  }

  /* ---------- media ---------- */
  function mappaFel(e, typ) {
    if (!window.isSecureContext) return fel('osaker');
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return fel('nekad', typ === 'ljud' ? 'Webbläsaren har blockerat mikrofonen. Klicka på symbolen i adressfältet och välj Tillåt.' : null);
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return fel('saknas', typ === 'ljud' ? 'Ingen mikrofon hittades.' : null);
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return fel('upptagen', typ === 'ljud' ? 'Mikrofonen används av ett annat program. Stäng det och klicka på Försök igen.' : null);
    return fel('okand');
  }
  function videoKrav(utanEnhet) {
    var u = UPPLOSNING[inst.upplosning] || UPPLOSNING[720];
    // max på bildfrekvensen: en kamera som klarar 60 bilder/s ska inte dubbla kostnaden för pipeline och kodare
    var v = { width: { ideal: u[0] }, height: { ideal: u[1] }, frameRate: { ideal: inst.fps, max: inst.fps }, aspectRatio: { ideal: 16 / 9 } };
    if (inst.kamera && !utanEnhet) v.deviceId = { exact: inst.kamera };
    return v;
  }
  function stodKrav() { try { return (navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints && navigator.mediaDevices.getSupportedConstraints()) || {}; } catch (e) { return {}; } }
  // levande = applyConstraints på ett befintligt spår: då kan ekosläckningen bli 'all' medan skärmen delas med datorljud
  // (så att det delade ljudet från högtalarna inte går tillbaka i mikrofonen). getUserMedia får alltid ett sant/falskt värde.
  function ljudKrav(utanEnhet, levande) {
    var a = { noiseSuppression: !!inst.brus, echoCancellation: !!inst.eko, autoGainControl: !!inst.volym, channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 } };
    if (stodKrav().voiceIsolation) a.voiceIsolation = !!inst.brus;
    if (levande && inst.eko && ekoAlla()) a.echoCancellation = 'all';
    if (inst.mikrofon && !utanEnhet) a.deviceId = { exact: inst.mikrofon };
    return a;
  }
  function ekoAlla() {
    if (!M.skarm || !M.skarm.getAudioTracks().length || !M.mik || !M.mik.getCapabilities) return false;
    try { var c = M.mik.getCapabilities().echoCancellation; return Array.isArray(c) && c.indexOf('all') >= 0; } catch (e) { return false; }
  }
  // Byter ekosläckning när skärmdelning med ljud börjar eller slutar.
  function ekoForDelning() {
    if (!M.mik || !M.mik.applyConstraints || !inst.eko) return;
    var vill = ekoAlla();
    if (vill === !!M.ekoAlla) return; // rör inte mikrofonen i onödan
    M.ekoAlla = vill;
    M.mik.applyConstraints(ljudKrav(true, true)).catch(function () { });
  }
  // Hämtar ett spår; faller tillbaka till förvald enhet om den sparade saknas.
  function hamtaSpar(typ) {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return Promise.reject(fel(window.isSecureContext ? 'okand' : 'osaker'));
    var krav = function (u) { return typ === 'video' ? { video: videoKrav(u), audio: false } : { audio: ljudKrav(u), video: false }; };
    return md.getUserMedia(krav(false)).catch(function (e) {
      var sparad = typ === 'video' ? inst.kamera : inst.mikrofon;
      if (sparad && e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) return md.getUserMedia(krav(true));
      throw e;
    }).then(function (s) { if (typ !== 'video') M.ekoAlla = false; return typ === 'video' ? s.getVideoTracks()[0] : s.getAudioTracks()[0]; })
      .catch(function (e) { throw e && e.kod ? e : mappaFel(e, typ === 'video' ? 'kamera' : 'ljud'); });
  }

  function lokalStrom() {
    if (!M.lokal) M.lokal = new MediaStream();
    return M.lokal;
  }
  // Ser till att den lokala strömmen innehåller rätt spår och meddelar UI.
  function uppdateraLokal() {
    var s = lokalStrom(), vill = [];
    var v = S.jag ? (S.jag.kam ? utKam() : null) : utKam();
    if (v) vill.push(v);
    if (M.mik) vill.push(M.mik);
    s.getTracks().forEach(function (t) { if (vill.indexOf(t) < 0) s.removeTrack(t); });
    vill.forEach(function (t) { if (s.getTracks().indexOf(t) < 0) s.addTrack(t); });
    sand('strom', { peer: 'jag', typ: 'kamera', strom: s });
  }

  function startaMedia(opt) {
    opt = opt || {};
    laddaInst();
    if (!S.jag) S.jag = nyJag({ namn: '', roll: 'gast' });
    var vilVideo = opt.video !== false && inst.kamPa !== false, vilLjud = opt.ljud !== false;
    var forstaFel = null;
    // Sparad Oskärpa/Bild: börja ladda modulen samtidigt som kameran startar (tar flera sekunder första gången).
    // Tills masken finns skickas och visas hela bilden suddad, aldrig rummet.
    if (inst.bakgrund.lage !== 'ingen' && stod().bakgrund) laddaModul().catch(function () { });
    var pv = vilVideo && !M.rakam ? hamtaSpar('video').then(function (t) { M.rakam = t; bevakaSpar(t, 'kamera'); }, function (e) { forstaFel = e; }) : Promise.resolve();
    // Kameran först, sedan mikrofonen – två frågor i rad blir annars en dubbel dialog i vissa webbläsare.
    return pv.then(function () {
      if (!vilLjud || M.mik) return;
      return hamtaSpar('ljud').then(function (t) { M.mik = t; bevakaSpar(t, 'mikrofon'); }, function (e) { if (!forstaFel || forstaFel.kod === 'saknas') forstaFel = e; });
    }).then(function () {
      if (!M.rakam && !M.mik && forstaFel) { sand('fel', forstaFel); throw forstaFel; }
      S.jag.kam = !!M.rakam; S.jag.mik = !!M.mik && inst.mikPa !== false;
      if (M.mik) M.mik.enabled = S.jag.mik;
      return byggPipeline();
    }).then(function () {
      uppdateraLokal(); kopplaLjudAnalys('jag', lokalStrom());
      bytAllaSpar(); sand('jag', jagObj()); skickaStatus();
      if (forstaFel) sand('fel', forstaFel); // t.ex. ingen kamera men ljud fungerar
      lyssnaEnheter();
      // Sparad bakgrund (Oskärpa/Bild) startas i bakgrunden – modulen laddas först nu
      var b = inst.bakgrund;
      if (b.lage !== 'ingen' && (!bg.fn || (b.lage === 'bild' && !bg.bildEl))) sattBakgrund(b.lage, { styrka: b.styrka, bild: b.bild || 'ton' }).catch(function () { });
      return lokalStrom();
    });
  }
  function bevakaSpar(t, typ) {
    t.addEventListener('ended', function () {
      // Enheten försvann (urkopplad kamera) – stäng av snyggt.
      if (typ === 'kamera' && M.rakam === t) { M.rakam = null; if (S.jag) S.jag.kam = false; byggPipeline().then(function () { uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); }); sand('fel', fel('kam-fel', 'Kameran kopplades bort.')); }
      if (typ === 'mikrofon' && M.mik === t) { M.mik = null; if (S.jag) S.jag.mik = false; uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); sand('fel', fel('mik-fel', 'Mikrofonen kopplades bort.')); }
    });
  }
  function forhandStrom() { return M.lokal && M.lokal.getTracks().length ? M.lokal : (M.lokal || null); }
  function stoppaMedia() {
    stoppa(M.rakam); M.rakam = null; stoppa(M.mik); M.mik = null;
    rivPipeline(); slutaDela(true);
    if (M.lokal) M.lokal.getTracks().forEach(function (t) { M.lokal.removeTrack(t); });
    taBortAnalys('jag');
    if (S.jag) { S.jag.kam = false; S.jag.mik = false; }
    bytAllaSpar();
  }

  function sattMik(paa) {
    paa = !!paa;
    if (!S.jag) return Promise.resolve(false);
    inst.mikPa = paa; sparaInst();
    var klar = function () {
      if (M.mik) M.mik.enabled = paa && S.ljudlage !== 'inget';
      S.jag.mik = !!M.mik && paa;
      sand('jag', jagObj()); skickaStatus();
      return S.jag.mik;
    };
    if (paa && !M.mik) {
      return hamtaSpar('ljud').then(function (t) { M.mik = t; bevakaSpar(t, 'mikrofon'); uppdateraLokal(); kopplaLjudAnalys('jag', lokalStrom()); bytAllaSpar(); return klar(); },
        function (e) { sand('fel', e); return klar(); });
    }
    return Promise.resolve(klar());
  }
  function sattKam(paa) {
    paa = !!paa;
    if (!S.jag) return Promise.resolve(false);
    inst.kamPa = paa; sparaInst();
    if (!paa) {
      // Spåret stoppas så att kamerans lampa släcks.
      stoppa(M.rakam); M.rakam = null; S.jag.kam = false;
      return byggPipeline().then(function () { uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); return false; });
    }
    if (M.rakam) { S.jag.kam = true; uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); return Promise.resolve(true); }
    return hamtaSpar('video').then(function (t) {
      M.rakam = t; bevakaSpar(t, 'kamera'); S.jag.kam = true;
      return byggPipeline();
    }).then(function () { uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); return true; },
      function (e) { S.jag.kam = false; sand('fel', e); sand('jag', jagObj()); return false; });
  }

  function enheter() {
    var md = navigator.mediaDevices;
    if (!md || !md.enumerateDevices) return Promise.resolve({ kameror: [], mikrofoner: [], hogtalare: [] });
    return md.enumerateDevices().then(function (lista) {
      var r = { kameror: [], mikrofoner: [], hogtalare: [] }, n = { videoinput: 0, audioinput: 0, audiooutput: 0 };
      lista.forEach(function (d) {
        if (!(d.kind in n)) return;
        n[d.kind]++;
        var fall = d.kind === 'videoinput' ? 'Kamera ' : d.kind === 'audioinput' ? 'Mikrofon ' : 'Högtalare ';
        var namn = d.label || (d.deviceId === 'default' ? 'Förvald' : fall + n[d.kind]);
        var post = { id: d.deviceId, namn: namn };
        (d.kind === 'videoinput' ? r.kameror : d.kind === 'audioinput' ? r.mikrofoner : r.hogtalare).push(post);
      });
      return r;
    });
  }
  var enhetLyss = false;
  function lyssnaEnheter() {
    var md = navigator.mediaDevices;
    if (enhetLyss || !md || !md.addEventListener) return;
    enhetLyss = true;
    md.addEventListener('devicechange', function () { enheter().then(function (r) { sand('enheter', r); }); });
  }

  function bytEnhet(typ, id) {
    laddaInst();
    id = str(id, 300);
    if (typ === 'hogtalare') { inst.hogtalare = id; sparaInst(); return Promise.all(M.element.map(sattSink)).then(function () { return true; }); }
    if (typ === 'kamera') {
      inst.kamera = id; sparaInst();
      if (!M.rakam) return Promise.resolve(true);
      var gammal = M.rakam;
      stoppa(gammal); M.rakam = null; // vissa kameror kan inte öppnas två gånger
      return hamtaSpar('video').then(function (t) { M.rakam = t; bevakaSpar(t, 'kamera'); return byggPipeline(); })
        .then(function () { uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); return true; },
          function (e) { if (S.jag) S.jag.kam = false; uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); sand('fel', e); throw e; });
    }
    if (typ === 'mikrofon') {
      inst.mikrofon = id; sparaInst();
      if (!M.mik) return Promise.resolve(true);
      var var_pa = M.mik.enabled;
      return hamtaSpar('ljud').then(function (t) {
        stoppa(M.mik); M.mik = t; t.enabled = var_pa; bevakaSpar(t, 'mikrofon');
        uppdateraLokal(); kopplaLjudAnalys('jag', lokalStrom()); bytAllaSpar(); return true;
      }, function (e) { sand('fel', e); throw e; });
    }
    return Promise.reject(fel('okand', 'Okänd enhetstyp.'));
  }

  function sattSink(el) {
    if (!el || typeof el.setSinkId !== 'function' || !inst.hogtalare) return Promise.resolve();
    return el.setSinkId(inst.hogtalare === 'default' ? '' : inst.hogtalare).catch(function () { });
  }
  function kopplaHogtalare(el) {
    if (!el) return;
    laddaInst();
    M.element = M.element.filter(function (x) { return x.isConnected || x === el; });
    if (M.element.indexOf(el) < 0) M.element.push(el);
    if (S.ljudlage === 'inget' && !(el.dataset && el.dataset.vmEgen === '1')) el.muted = true;
    sattSink(el);
  }
  function ljudlage(lage) {
    S.ljudlage = lage === 'inget' ? 'inget' : 'dator';
    M.element.forEach(function (el) { if (!(el.dataset && el.dataset.vmEgen === '1')) el.muted = S.ljudlage === 'inget'; });
    if (S.ljudlage === 'inget') { if (M.mik) M.mik.enabled = false; if (S.jag) S.jag.mik = false; sand('jag', jagObj()); skickaStatus(); }
    return S.ljudlage;
  }

  function installningar() { laddaInst(); var r = kopia(inst); r.faktiska = faktiska(); return r; }
  function faktiska() {
    var r = { bredd: null, hojd: null, fps: null, brus: null, eko: null, volym: null, rost: null, ljusKamera: !!M.ljusHw, fpsLag: false, ut: null };
    if (M.rakam && M.rakam.getSettings) {
      var v = M.rakam.getSettings(); r.bredd = v.width || null; r.hojd = v.height || null; r.fps = v.frameRate ? Math.round(v.frameRate) : null;
      // Många webbkameror går ner till 15 bilder/s i mörker – UI kan visa "mer ljus hjälper"
      r.fpsLag = !!(r.fps && inst.fps > 15 && r.fps <= Math.min(15, inst.fps - 5));
    }
    if (M.pipe && M.pipe.canvas) r.ut = { bredd: M.pipe.canvas.width, hojd: M.pipe.canvas.height, fps: M.pipe.fps || null, ms: M.pipe.ms ? Math.round(M.pipe.ms) : null };
    if (M.mik && M.mik.getSettings) {
      var a = M.mik.getSettings(), krav = { brus: 'noiseSuppression', eko: 'echoCancellation', volym: 'autoGainControl' };
      Object.keys(krav).forEach(function (k) {
        var x = a[krav[k]];
        if (k === 'eko' && typeof x === 'string') x = x !== 'false'; // 'all' / 'remote-only' räknas som på
        r[k] = typeof x === 'boolean' ? (x === !!inst[k] ? x : 'stods-ej') : 'stods-ej';
      });
      r.rost = typeof a.voiceIsolation === 'boolean' ? a.voiceIsolation : null;
    }
    return r;
  }
  function sattInstallningar(delar) {
    laddaInst();
    delar = delar || {};
    var forra = kopia(inst), jobb = [];
    ['spegla', 'ljus', 'brus', 'eko', 'volym'].forEach(function (k) { if (typeof delar[k] === 'boolean') inst[k] = delar[k]; });
    if (UPPLOSNING[delar.upplosning]) inst.upplosning = +delar.upplosning;
    if ([15, 24, 30].indexOf(+delar.fps) >= 0) inst.fps = +delar.fps;
    if (['auto', 'spara', 'ljud'].indexOf(delar.sandning) >= 0) inst.sandning = delar.sandning;
    if (['allt', 'ljud'].indexOf(delar.taEmot) >= 0) inst.taEmot = delar.taEmot;
    if (['nh', 'nv', 'oh', 'ov'].indexOf(delar.egenHorn) >= 0) inst.egenHorn = delar.egenHorn;
    sparaInst();

    if (M.rakam && (forra.upplosning !== inst.upplosning || forra.fps !== inst.fps)) {
      var u = UPPLOSNING[inst.upplosning];
      jobb.push(M.rakam.applyConstraints({ width: { ideal: u[0] }, height: { ideal: u[1] }, frameRate: { ideal: inst.fps, max: inst.fps }, aspectRatio: { ideal: 16 / 9 } }).catch(function () { })
        .then(function () { if (M.pipe) storlekPipeline(); }));
    }
    if (M.mik && (forra.brus !== inst.brus || forra.eko !== inst.eko || forra.volym !== inst.volym)) {
      jobb.push(M.mik.applyConstraints(ljudKrav(true, true)).catch(function () { }).then(function () {
        var f = faktiska();
        // Vissa webbläsare ändrar inte ett levande spår – hämta då ett nytt med de nya kraven.
        if ((typeof f.brus === 'string' && f.brus === 'stods-ej') || f.eko === 'stods-ej' || f.volym === 'stods-ej') {
          // Det gamla spåret stoppas först – annars delar webbläsaren ljudbehandlingen mellan spåren.
          var pa_ = M.mik.enabled, gammal = M.mik;
          M.mik = null; stoppa(gammal);
          return hamtaSpar('ljud').then(function (t) { M.mik = t; t.enabled = pa_; bevakaSpar(t, 'mikrofon'); uppdateraLokal(); kopplaLjudAnalys('jag', lokalStrom()); bytAllaSpar(); },
            function (e) { if (S.jag) S.jag.mik = false; uppdateraLokal(); bytAllaSpar(); sand('jag', jagObj()); skickaStatus(); sand('fel', e); });
        }
      }));
    }
    if (forra.ljus !== inst.ljus) { jobb.push(byggPipeline().then(function () { uppdateraLokal(); bytAllaSpar(); })); }
    if (forra.sandning !== inst.sandning) { jobb.push(Promise.resolve().then(function () { bytAllaSpar(); tillampaSandning(); skickaStatus(); sand('jag', jagObj()); })); }
    if (forra.taEmot !== inst.taEmot) tillampaTaEmot();
    return Promise.all(jobb).then(function () { var f = faktiska(); sand('installningar', f); return f; });
  }

  function testaTon() {
    laddaInst();
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.reject(fel('okand', 'Webbläsaren kan inte spela upp en testton.'));
    var ac = new AC(), dest = ac.createMediaStreamDestination(), el = new Audio();
    M.testEl = el;
    el.srcObject = dest.stream;
    var spela = function (start, frekv) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = frekv;
      g.gain.setValueAtTime(0, ac.currentTime + start);
      g.gain.linearRampToValueAtTime(0.25, ac.currentTime + start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + 0.45);
      o.connect(g); g.connect(dest); o.start(ac.currentTime + start); o.stop(ac.currentTime + start + 0.5);
    };
    return sattSink(el).then(function () { return el.play(); }).then(function () {
      spela(0, 660); spela(0.55, 880);
      return new Promise(function (r) { setTimeout(r, 1200); });
    }).then(function () { el.pause(); el.srcObject = null; ac.close(); M.testEl = null; });
  }
  function spelaInTest(sek) {
    sek = Math.max(1, Math.min(15, +sek || 5));
    var s = forhandStrom();
    if (typeof MediaRecorder === 'undefined') return Promise.reject(fel('okand', 'Webbläsaren kan inte spela in ett test.'));
    if (!s || !s.getTracks().length) return Promise.reject(fel('saknas', 'Slå på kameran eller mikrofonen först.'));
    return new Promise(function (resolve, reject) {
      var bitar = [], typ = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4', 'audio/webm'].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
      var r;
      try { r = new MediaRecorder(new MediaStream(s.getTracks()), typ ? { mimeType: typ } : undefined); } catch (e) { reject(fel('okand', 'Testinspelningen kunde inte starta.')); return; }
      r.ondataavailable = function (e) { if (e.data && e.data.size) bitar.push(e.data); };
      r.onstop = function () { resolve(URL.createObjectURL(new Blob(bitar, { type: r.mimeType || typ || 'video/webm' }))); };
      r.onerror = function () { reject(fel('okand', 'Testinspelningen avbröts.')); };
      r.start(250);
      setTimeout(function () { if (r.state !== 'inactive') r.stop(); }, sek * 1000);
    });
  }

  /* ---------- ljudnivåer och talare ---------- */
  function ac() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!M.ac || M.ac.state === 'closed') M.ac = new AC();
    if (M.ac.state === 'suspended') M.ac.resume().catch(function () { });
    return M.ac;
  }
  function taBortAnalys(peer) {
    var a = M.analys[peer]; if (!a) return;
    try { a.kalla.disconnect(); } catch (e) { }
    delete M.analys[peer];
  }
  function kopplaLjudAnalys(peer, strom) {
    taBortAnalys(peer);
    if (!strom || !strom.getAudioTracks().length) return;
    var c = ac(); if (!c) return;
    try {
      // Egen MediaStream med bara ljudspåret – analysen påverkas då inte av att videospår byts.
      var kalla = c.createMediaStreamSource(new MediaStream([strom.getAudioTracks()[0]]));
      var an = c.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.3;
      kalla.connect(an);
      M.analys[peer] = { kalla: kalla, an: an, buf: new Float32Array(an.fftSize), niva: 0, overSedan: 0, spar: strom.getAudioTracks()[0] };
    } catch (e) { }
    startaNivaer();
  }
  function niva(peer) { var a = M.analys[peer || 'jag']; return a ? a.niva : 0; }
  function startaNivaer() {
    if (S.nivaTimer) return;
    S.nivaTimer = setInterval(mataNivaer, 100);
  }
  function mataNivaer() {
    var t = nu(), ut = {}, nagon = false;
    Object.keys(M.analys).forEach(function (peer) {
      var a = M.analys[peer];
      if (peer === 'jag' && (!M.mik || !M.mik.enabled)) { a.niva = 0; }
      else {
        a.an.getFloatTimeDomainData(a.buf);
        var sum = 0; for (var i = 0; i < a.buf.length; i++) sum += a.buf[i] * a.buf[i];
        var rms = Math.sqrt(sum / a.buf.length);
        a.niva = Math.min(1, rms * 4); // tal ligger runt 0,02–0,2 i RMS
      }
      if (a.niva > 0.06) { if (!a.overSedan) a.overSedan = t; } else a.overSedan = 0;
      var talar = !!a.overSedan && t - a.overSedan >= 300;
      var post = peer === 'jag' ? S.jag : S.peers[peer];
      if (post && !!post.talar !== talar) { post.talar = talar; if (peer !== 'jag') sand('deltagare-andrad', { peer: peer, falt: ['talar'] }); else sand('jag', jagObj()); }
      ut[peer] = Math.round(a.niva * 100) / 100; nagon = true;
    });
    if (nagon && harLyss('nivaer')) sand('nivaer', ut);
    // Huvudtalare: den andra deltagaren som låter mest, byts tidigast efter 1,2 s.
    var bast = null, bastNiva = 0;
    iMotet().forEach(function (p) { var a = M.analys[p.peer]; if (p.talar && a && a.niva > bastNiva) { bast = p.peer; bastNiva = a.niva; } });
    if (bast && bast !== S.talare) {
      if (S.kandidat !== bast) { S.kandidat = bast; S.kandidatSedan = t; }
      else if (t - S.kandidatSedan >= 1200 || !S.talare) { S.talare = bast; S.kandidat = null; sand('talar', { peer: bast }); }
    } else if (bast === S.talare) S.kandidat = null;
    if (S.talare && !S.peers[S.talare]) { S.talare = null; sand('talar', { peer: null }); }
    if (!Object.keys(M.analys).length) { clearInterval(S.nivaTimer); S.nivaTimer = null; }
  }

  /* ---------- pipeline: kamera → canvas → captureStream ---------- */
  var bg = { fn: null, info: null, modul: null, laddar: null, bildEl: null, bildUrl: '', fel: 0 };
  // Pipelinen behövs för Ljus (när kameran inte själv kan ljusa upp) och för Oskärpa/Bild – även medan modulen laddas,
  // så att rummet aldrig visas eller skickas innan masken finns (då ritas hela bilden suddad).
  function pipelineBehovs() { return !!M.rakam && ((inst.ljus && !M.ljusHw) || inst.bakgrund.lage !== 'ingen'); }
  function rivPipeline() {
    var p = M.pipe; if (!p) return;
    p.stopp = true;
    stoppa(p.spar);
    try { p.video.pause(); p.video.srcObject = null; } catch (e) { }
    M.pipe = null;
  }
  // Bakgrundseffekter görs i högst 1280×720 (som Meet) – canvasarbetet växer med antalet pixlar.
  function pipeMal(b, h) {
    var max = inst.bakgrund.lage !== 'ingen' ? 1280 : 1920;
    if (b > max) { h = Math.round(h * max / b); b = max; }
    return [b, h];
  }
  function storlekPipeline() {
    var p = M.pipe; if (!p || !M.rakam) return;
    var s = M.rakam.getSettings ? M.rakam.getSettings() : {};
    var u = UPPLOSNING[inst.upplosning];
    var m = pipeMal(p.video.videoWidth || s.width || u[0], p.video.videoHeight || s.height || u[1]);
    if (p.canvas.width !== m[0]) p.canvas.width = m[0];
    if (p.canvas.height !== m[1]) p.canvas.height = m[1];
  }
  document.addEventListener('visibilitychange', function () { if (M.pipe && !M.pipe.stopp && M.pipe.knuff) M.pipe.knuff(); });
  // Ljus: kamerans egen exponering/ljusstyrka om den går att styra – då behövs ingen canvas-pipeline.
  // Värdena från före ändringen sparas och återställs när Ljus slås av.
  function sattHwLjus() {
    var t = M.rakam;
    if (M.ljusKalla === t && M.ljusOnskat === !!inst.ljus) return Promise.resolve();
    var forraOrig = M.ljusKalla === t ? M.ljusOrig : null;
    M.ljusKalla = t; M.ljusOnskat = !!inst.ljus; M.ljusHw = false; M.ljusOrig = null;
    var aterstall = t && forraOrig ? t.applyConstraints({ advanced: [forraOrig] }).catch(function () { }) : Promise.resolve();
    if (!t || !inst.ljus || !t.getCapabilities) return aterstall;
    var c = {}, s = {};
    try { c = t.getCapabilities() || {}; s = t.getSettings() || {}; } catch (e) { return aterstall; }
    var adv = {}, orig = {}, ok = false;
    var ec = c.exposureCompensation;
    if (ec && typeof ec.max === 'number' && ec.max > ec.min && typeof s.exposureCompensation === 'number') {
      var bas = Math.max(s.exposureCompensation, 0);
      orig.exposureCompensation = s.exposureCompensation;
      adv.exposureCompensation = Math.min(ec.max, bas + Math.min(1, (ec.max - bas) * 0.5));
      if (Array.isArray(c.exposureMode) && c.exposureMode.indexOf('continuous') >= 0 && s.exposureMode) { orig.exposureMode = s.exposureMode; adv.exposureMode = 'continuous'; }
      ok = adv.exposureCompensation > s.exposureCompensation;
    }
    var br = c.brightness;
    if (!ok && br && typeof br.max === 'number' && br.max > br.min && typeof s.brightness === 'number') {
      orig = { brightness: s.brightness }; adv = { brightness: Math.min(br.max, s.brightness + (br.max - br.min) * 0.12) };
      ok = adv.brightness > s.brightness;
    }
    if (!ok) return aterstall;
    return aterstall.then(function () {
      return t.applyConstraints({ advanced: [adv] }).then(function () { if (M.ljusKalla === t) { M.ljusHw = true; M.ljusOrig = orig; } }, function () { });
    });
  }
  function byggPipeline() {
    return sattHwLjus().then(byggPipelineNu, byggPipelineNu);
  }
  function byggPipelineNu() {
    if (!pipelineBehovs()) { rivPipeline(); return Promise.resolve(); }
    if (M.pipe && M.pipe.kalla === M.rakam) { storlekPipeline(); return Promise.resolve(); }
    rivPipeline();
    var video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true;
    video.srcObject = new MediaStream([M.rakam]);
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (typeof canvas.captureStream !== 'function' || !ctx) { return Promise.resolve(); }
    var p = M.pipe = { video: video, canvas: canvas, ctx: ctx, kalla: M.rakam, stopp: false, spar: null, fps: 0, ramar: 0, matt: performance.now() };
    storlekPipeline();
    var u = UPPLOSNING[inst.upplosning]; if (!canvas.width) { canvas.width = u[0]; canvas.height = u[1]; }
    // En utbild per kamerabild: captureStream(0) + requestFrame() efter varje ritning (captureStream(fps) tappar bilder).
    var spar = canvas.captureStream(0).getVideoTracks()[0];
    if (spar && typeof spar.requestFrame === 'function') { p.spar = spar; p.manuell = true; }
    else { stoppa(spar); p.spar = canvas.captureStream(inst.fps).getVideoTracks()[0]; }
    return video.play().catch(function () { }).then(function () {
      if (p.stopp) return;
      storlekPipeline();
      ritaRam(p); // första bilden direkt så att spåret inte är svart
      // Varje schemaläggning får ett nummer. Byter fliken synlighet knuffas loopen igång igen
      // (en rVFC som väntar i en flik som just doldes kommer aldrig) och den gamla väntan ignoreras.
      var gen = 0;
      var schema = function () {
        var g = ++gen;
        var kor = function () { if (g !== gen || p.stopp) return; ritaRam(p); schema(); };
        if (document.hidden) setTimeout(kor, 1000 / inst.fps); // bakgrundsflik: rVFC/rAF stryps
        else if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(kor);
        else requestAnimationFrame(kor);
      };
      p.knuff = schema;
      schema();
    });
  }
  var LJUS = 'brightness(1.15) contrast(1.08) saturate(1.05)';
  // Hela bilden suddad – används tills masken finns och om segmenteringen fallerar (rummet ska aldrig synas).
  var helSudd = null;
  function suddaHela(ctx, v, B, H, ljus) {
    if (!helSudd) helSudd = document.createElement('canvas');
    var sb = Math.max(1, Math.round(B / 8)), sh = Math.max(1, Math.round(H / 8));
    if (helSudd.width !== sb || helSudd.height !== sh) { helSudd.width = sb; helSudd.height = sh; }
    var x = helSudd.getContext('2d');
    x.filter = 'blur(3px)'; x.drawImage(v, 0, 0, sb, sh); x.filter = 'none';
    ctx.filter = ljus || 'none'; ctx.imageSmoothingEnabled = true; ctx.drawImage(helSudd, 0, 0, B, H); ctx.filter = 'none';
  }
  function ritaRam(p) {
    var v = p.video, c = p.canvas, ctx = p.ctx;
    if (v.readyState < 2 || !v.videoWidth) return;
    var m = pipeMal(v.videoWidth, v.videoHeight);
    if (c.width !== m[0] || c.height !== m[1]) { c.width = m[0]; c.height = m[1]; }
    var b = inst.bakgrund, ljus = inst.ljus && !M.ljusHw ? LJUS : '', t0 = performance.now();
    if (b.lage !== 'ingen') {
      var ritat = false;
      if (bg.fn) {
        try {
          // tung = ramarna tar längre tid än kameran ger nya – då segmenteras varannan bild (med extra utvidgning)
          ritat = bg.fn(ctx, v, { lage: b.lage, styrka: b.styrka, bild: bg.bildEl, bredd: c.width, hojd: c.height, tid: t0, ljus: ljus,
            tung: p.ms > 900 / Math.max(15, inst.fps), budget: 1000 / Math.max(15, inst.fps) }) === true;
          bg.fel = 0;
        } catch (e) {
          ritat = false;
          if (++bg.fel === 3) { if (window.console) console.warn('[samtal] bakgrunden', e); sand('fel', fel('bakgrund-fel', 'Bakgrunden fungerar inte just nu – hela bilden suddas tills vidare.')); }
        }
      }
      if (!ritat) suddaHela(ctx, v, c.width, c.height, ljus);
    } else {
      ctx.filter = ljus || 'none';
      ctx.drawImage(v, 0, 0, c.width, c.height);
      ctx.filter = 'none';
    }
    if (p.manuell) try { p.spar.requestFrame(); } catch (e) { }
    // Pipelinens faktiska bildfrekvens (visas i Kvalitet via faktiska().ut.fps)
    p.ramar++;
    var t = performance.now();
    p.ms = p.ms ? p.ms * 0.9 + (t - t0) * 0.1 : t - t0; // snittid per bild
    if (t - p.matt >= 2000) { p.fps = Math.round(p.ramar * 1000 / (t - p.matt)); p.ramar = 0; p.matt = t; }
  }

  /* ---------- bakgrund ---------- */
  function registrera(fn, info) { bg.fn = typeof fn === 'function' ? fn : null; bg.info = info || null; }
  function harModul() { return !!bg.fn; }
  function laddaModul() {
    if (bg.fn) return Promise.resolve(true);
    if (bg.laddar) return bg.laddar;
    var st = stod();
    if (!st.bakgrund) return Promise.reject(fel('bakgrund-fel'));
    bg.laddar = import(VENDOR + 'vision_bundle.mjs').then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(VENDOR + 'wasm').then(function (filer) {
        var skapa = function (delegate) {
          return mp.ImageSegmenter.createFromOptions(filer, {
            baseOptions: { modelAssetPath: VENDOR + 'modell/selfie_segmenter.tflite', delegate: delegate },
            runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false
          });
        };
        // CPU först: skapas på ~0,4 s mot ~3 s för GPU, är lika snabb per bild här och masken behöver
        // ingen synkron läsning från grafikkortet (som stoppar canvas och kodare).
        return skapa('CPU').catch(function () { return skapa('GPU'); });
      });
    }).then(function (seg) {
      tystaLoggning(seg);
      bg.modul = seg;
      registrera(mediapipeRitare(seg), { namn: 'MediaPipe selfie segmenter', lokal: true });
      bg.laddar = null;
      return true;
    }).catch(function (e) {
      bg.laddar = null;
      if (window.console) console.warn('[samtal] bakgrundsmodulen', e);
      var f = fel('bakgrund-fel'); sand('fel', f); throw f;
    });
    return bg.laddar;
  }
  // MediaPipe Tasks skapar en loggare som var 60:e sekund skickar användningsdata till odml.pa.googleapis.com.
  // CSP:n stoppar det ändå, men vi stänger av den så att inget försök görs (och inget CSP-fel hamnar i konsolen).
  // Loggaren känns igen på formen (flush/close, kö i .i och avsändare med send), inte på ett minifierat namn.
  function tystaLoggning(seg) {
    var hittad = false;
    try {
      var sett = [];
      var leta = function (o, djup) {
        if (hittad || !o || typeof o !== 'object' || djup > 3 || sett.indexOf(o) >= 0) return;
        sett.push(o);
        if (typeof o.flush === 'function' && typeof o.close === 'function' && Array.isArray(o.i) && o.o && typeof o.o.send === 'function') {
          o.o.send = function (t, klar) { if (typeof klar === 'function') klar(''); return Promise.resolve(); };
          if (o.h !== undefined) { clearInterval(o.h); o.h = undefined; }
          o.i = []; hittad = true;
          return;
        }
        Object.keys(o).forEach(function (k) {
          var v = o[k];
          if (v && typeof v === 'object' && !(typeof Element !== 'undefined' && v instanceof Element) && !ArrayBuffer.isView(v) && !(v instanceof ArrayBuffer)) leta(v, djup + 1);
        });
      };
      leta(seg, 0);
    } catch (e) { }
    return hittad;
  }
  // Ritar personen skarp ovanpå en suddad eller utbytt bakgrund. Segmenterar varje kamerabild på en liten bild (256 px bred).
  // Masken räknar hellre för mycket än för lite till personen:
  //   temporal utjämning (stiger direkt, sjunker långsamt – inget flimmer, rörelser äts inte upp)
  //   → mjuk tröskel smoothstep(0,15–0,5) (osäkra axlar, hårkant och mörka kläder blir helt skarpa)
  //   → utvidgning med maxfilter (1 cell ≈ 2–5 px vid Oskärpa – fjädringen sköter resten, ingen vid Bild, +1 när masken är en bild gammal)
  //   → lätt fjädring i liten storlek → mjuk uppskalning.
  // Oskärpan är maskad: personen skärs ut innan bakgrunden suddas, så hår och axlar smetas inte ut till en mörk ring.
  function mediapipeRitare(seg) {
    var ny = function () { return document.createElement('canvas'); };
    var liten = ny(), lctx = liten.getContext('2d');
    var maskP = ny(), mpx = maskP.getContext('2d');   // personens mask
    var maskH = ny(), mhx = maskH.getContext('2d');   // hålet i bakgrunden (mer utvidgat)
    var mjuk = ny(), mjx = mjuk.getContext('2d');     // fjädrad personmask
    var person = ny(), pctx = person.getContext('2d');
    var hal = ny(), hx = hal.getContext('2d');
    var bak = ny(), bx = bak.getContext('2d');
    var lb = 0, lh = 0, jamn = null, alfa = null, tmp = null, idP = null, idH = null;
    var senast = -1, harMask = false, hoppa = false, segMs = 0, helMs = 0, tungLage = false;
    function storlek(B, H) {
      var nb = 256, nh = Math.max(1, Math.round(256 * H / B));
      if (nb === lb && nh === lh) return;
      lb = nb; lh = nh;
      [liten, maskP, maskH, mjuk].forEach(function (c) { c.width = lb; c.height = lh; });
      var n = lb * lh;
      jamn = new Float32Array(n); alfa = new Float32Array(n); tmp = new Float32Array(n);
      idP = mpx.createImageData(lb, lh); idH = mhx.createImageData(lb, lh);
      for (var j = 0; j < n * 4; j += 4) { idP.data[j] = idP.data[j + 1] = idP.data[j + 2] = idH.data[j] = idH.data[j + 1] = idH.data[j + 2] = 255; }
      harMask = false;
    }
    // Separerbart maxfilter med radie r celler: alfa → ImageData (alfakanalen).
    function utvidga(r, id) {
      var d = id.data, x, y, k, m, v, a0, a1, rad;
      for (y = 0; y < lh; y++) {
        rad = y * lb;
        for (x = 0; x < lb; x++) {
          m = 0; a0 = x - r < 0 ? 0 : x - r; a1 = x + r >= lb ? lb - 1 : x + r;
          for (k = a0; k <= a1; k++) { v = alfa[rad + k]; if (v > m) m = v; }
          tmp[rad + x] = m;
        }
      }
      for (x = 0; x < lb; x++) {
        for (y = 0; y < lh; y++) {
          m = 0; a0 = y - r < 0 ? 0 : y - r; a1 = y + r >= lh ? lh - 1 : y + r;
          for (k = a0; k <= a1; k++) { v = tmp[k * lb + x]; if (v > m) m = v; }
          d[(y * lb + x) * 4 + 3] = m * 255;
        }
      }
    }
    return function (ctx, video, o) {
      var B = o.bredd, H = o.hojd, start = performance.now(), segmenterade = false;
      storlek(B, H);
      // Segmentera varje kamerabild. Tar en bild med segmentering mer än 60 % av tiden mellan två kamerabilder
      // (då tappar kameran bilder – 30 blir 15–18 bilder/s) hoppas segmenteringen över varannan bild,
      // och då används den förra masken med en cell extra utvidgning så att huvudet inte rör sig utanför den.
      var gammal = false;
      if (hoppa && harMask) { hoppa = false; gammal = true; }
      else {
        var t = Math.max(o.tid, senast + 1), fick = false;
        lctx.drawImage(video, 0, 0, lb, lh);
        var t0 = performance.now();
        seg.segmentForVideo(liten, t, function (res) {
          var mk = res && res.confidenceMasks && res.confidenceMasks[0];
          if (!mk) return;
          var f = mk.getAsFloat32Array();
          if (f.length !== jamn.length) return;
          for (var i = 0; i < f.length; i++) {
            var nv = f[i], q = jamn[i];
            var mm = nv >= q ? nv : q * 0.5 + nv * 0.5;
            jamn[i] = mm;
            var s = (mm - 0.15) / 0.35; s = s < 0 ? 0 : s > 1 ? 1 : s;
            alfa[i] = s * s * (3 - 2 * s);
          }
          fick = true;
        });
        senast = t; segmenterade = true;
        var dt = performance.now() - t0;
        segMs = segMs ? segMs * 0.8 + dt * 0.2 : dt;
        if (fick) harMask = true; else gammal = harMask;
      }
      if (!harMask) return false; // ritaRam suddar då hela bilden
      var bild = o.lage === 'bild' && o.bild && (o.bild.naturalWidth || o.bild.width) ? o.bild : null;
      // En stor utvidgning syns som en ring av den riktiga väggen – vid Bild räcker den mjuka tröskeln, vid Oskärpa 1 cell.
      var r = (bild ? 0 : 1) + (gammal ? 1 : 0);
      utvidga(r, idP); mpx.putImageData(idP, 0, 0);
      mjx.globalCompositeOperation = 'copy'; mjx.filter = 'blur(0.8px)'; mjx.drawImage(maskP, 0, 0); mjx.filter = 'none';
      // 1. Bakgrunden
      if (bild) {
        var iw = bild.naturalWidth || bild.width, ih = bild.naturalHeight || bild.height;
        var sk = Math.max(B / iw, H / ih), w = iw * sk, h = ih * sk;
        ctx.filter = 'none'; ctx.drawImage(bild, (B - w) / 2, (H - h) / 2, w, h);
      } else {
        var sb = Math.max(1, Math.round(B / 4)), sh = Math.max(1, Math.round(H / 4)), R = o.styrka === 'stark' ? 4 : 2;
        if (hal.width !== sb || hal.height !== sh) { hal.width = bak.width = sb; hal.height = bak.height = sh; }
        utvidga(r + 2, idH); mhx.putImageData(idH, 0, 0);
        // videon utan personen (hål)
        hx.globalCompositeOperation = 'copy'; hx.filter = 'none'; hx.drawImage(video, 0, 0, sb, sh);
        hx.globalCompositeOperation = 'destination-out'; hx.drawImage(maskH, 0, 0, sb, sh);
        hx.globalCompositeOperation = 'source-over';
        // sudda: hålet fylls från kanterna med bakgrundens färger, inte personens
        bx.globalCompositeOperation = 'copy'; bx.filter = 'blur(' + R + 'px)'; bx.drawImage(hal, 0, 0);
        bx.globalCompositeOperation = 'destination-over'; bx.filter = 'blur(' + (R * 3) + 'px)'; bx.drawImage(hal, 0, 0);
        // det som är kvar (mitt i personen, täcks ändå) och kanterna fylls med hela bilden
        bx.filter = 'blur(' + R + 'px)'; bx.drawImage(video, 0, 0, sb, sh);
        bx.filter = 'none'; bx.drawImage(video, 0, 0, sb, sh);
        bx.globalCompositeOperation = 'source-over';
        ctx.filter = o.ljus || 'none'; ctx.imageSmoothingEnabled = true; ctx.drawImage(bak, 0, 0, B, H); ctx.filter = 'none';
      }
      // 2. Personen: den fjädrade masken som alfa, sedan videon in i masken
      if (person.width !== B || person.height !== H) { person.width = B; person.height = H; }
      pctx.globalCompositeOperation = 'copy'; pctx.filter = 'none';
      pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
      pctx.drawImage(mjuk, 0, 0, B, H);
      pctx.globalCompositeOperation = 'source-in'; pctx.filter = o.ljus || 'none';
      pctx.drawImage(video, 0, 0, B, H);
      pctx.globalCompositeOperation = 'source-over'; pctx.filter = 'none';
      ctx.drawImage(person, 0, 0);
      if (segmenterade) {
        var hel = performance.now() - start, bud = o.budget || 33;
        helMs = helMs ? helMs * 0.8 + hel * 0.2 : hel;
        // med marginal åt båda håll så att läget inte slår fram och tillbaka
        if (!tungLage && helMs > bud * 0.6) tungLage = true;
        else if (tungLage && helMs < bud * 0.4) tungLage = false;
        if (tungLage || segMs > 40 || o.tung) hoppa = true;
      }
      return true;
    };
  }
  function tonadBild(farg) {
    var c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 1280, 720);
    var f = /^#[0-9a-f]{3,8}$|^rgb/i.test(farg || '') ? farg : '#b8743f';
    g.addColorStop(0, '#2a211b'); g.addColorStop(1, f);
    x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    var r = x.createRadialGradient(900, 160, 40, 900, 160, 700);
    r.addColorStop(0, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = 'rgba(255,255,255,.14)'; x.font = '600 44px Poppins, system-ui, sans-serif'; x.textAlign = 'right';
    x.fillText('Legohus', 1230, 680);
    return c;
  }
  function laddaBild(url, farg) {
    if (!url) return Promise.resolve(null);
    if (url === 'ton') return Promise.resolve(tonadBild(farg));
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () {
        // Skala ner stora bilder till högst 1280 px
        var max = 1280, s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        if (s >= 1) { resolve(im); return; }
        var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); resolve(c);
      };
      im.onerror = function () { reject(fel('bakgrund-fel', 'Bilden kunde inte läsas.')); };
      im.src = url;
    });
  }
  function sattBakgrund(lage, opt) {
    laddaInst();
    opt = opt || {};
    lage = ['ingen', 'oskarpa', 'bild'].indexOf(lage) >= 0 ? lage : 'ingen';
    var forbered = lage === 'ingen' ? Promise.resolve() : laddaModul();
    // Medan modulen laddas (några sekunder första gången) visas och skickas hela bilden suddad – inte rummet.
    if (lage !== 'ingen' && !bg.fn && inst.bakgrund.lage === 'ingen') {
      inst.bakgrund = { lage: lage, styrka: inst.bakgrund.styrka, bild: inst.bakgrund.bild };
      byggPipeline().then(function () { uppdateraLokal(); bytAllaSpar(); });
    }
    return forbered.then(function () {
      if (lage !== 'bild') return null;
      var url = str(opt.bild || inst.bakgrund.bild || 'ton', 2000);
      if (!/^(blob:|data:image\/|ton$|\.{0,2}\/|[a-z0-9_\-\/.]+\.(webp|jpe?g|png)$|https?:)/i.test(url)) url = 'ton';
      return laddaBild(url, opt.farg).then(function (el) { bg.bildEl = el; bg.bildUrl = url; return url; });
    }).then(function (url) {
      inst.bakgrund = { lage: lage, styrka: opt.styrka === 'stark' ? 'stark' : (opt.styrka === 'latt' ? 'latt' : inst.bakgrund.styrka), bild: lage === 'bild' ? url : inst.bakgrund.bild };
      sparaInst();
      return byggPipeline();
    }).then(function () { uppdateraLokal(); bytAllaSpar(); return aktuellt(); }, function (e) {
      inst.bakgrund.lage = 'ingen'; sparaInst();
      return byggPipeline().then(function () { uppdateraLokal(); bytAllaSpar(); throw e && e.kod ? e : fel('bakgrund-fel'); });
    });
  }
  function aktuellt() { laddaInst(); return { lage: inst.bakgrund.lage, styrka: inst.bakgrund.styrka, bild: inst.bakgrund.bild, laddar: !!bg.laddar, modul: !!bg.fn }; }

  /* ---------- WebRTC per deltagare ---------- */
  // STUN behövs först när signalen går mellan datorer (flikar i samma webbläsare klarar sig utan).
  // TURN läggs till här i drift: IH.samtal.iceServrar = [{ urls: 'stun:…' }, { urls: 'turn:…', username, credential }].
  var STUN_FORVAL = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  function iceLista() {
    var egen = IH.samtal.iceServrar && IH.samtal.iceServrar.length ? IH.samtal.iceServrar : IH.samtal.ICE;
    if (Array.isArray(egen) && egen.length) return egen;
    return S.signal.namn === 'flikar' ? [] : STUN_FORVAL;
  }
  function nyPost(peer) {
    return { peer: peer, namn: 'Okänd', roll: 'gast', i: 'forhand', mik: false, kam: false, hand: false, handTid: 0, delar: false, delarTid: 0,
      skarmStrom: '', sett: nu(), pc: null, strommar: {}, kamera: null, skarm: null, talar: false, natverk: null, stats: null, hist: [],
      harStatus: false, pcTid: 0, omstartTid: 0 };
  }
  function oppnaPc(p) {
    if (p.pc || S.fas !== 'mote' || p.i !== 'mote') return;
    var pc = new RTCPeerConnection({ iceServers: iceLista() });
    p.pc = pc; p.polite = S.jag.peer > p.peer; p.making = false; p.ignorera = false; p.pcTid = nu(); p.kedja = null; p.iceRest = []; p.sigTid = nu();
    pc.onsignalingstatechange = function () { p.sigTid = nu(); };
    p.s = { mik: null, kam: null, skarm: null, skarmLjud: null };
    pc.onnegotiationneeded = function () {
      p.making = true;
      pc.setLocalDescription().then(function () {
        p.offerTid = nu();
        S.signal.skicka(p.peer, 'sdp', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      }).catch(function (e) { if (window.console) console.warn('[samtal] förhandling', e); })
        .then(function () { p.making = false; });
    };
    pc.onicecandidate = function (e) {
      var c = e.candidate;
      S.signal.skicka(p.peer, 'ice', { c: c ? { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } : null });
    };
    pc.ontrack = function (e) {
      var s = e.streams && e.streams[0];
      if (!s) { s = p.strommar['spar-' + e.track.id] || new MediaStream([e.track]); }
      p.strommar[s.id] = s;
      s.onremovetrack = function () { if (!s.getTracks().length) { delete p.strommar[s.id]; klassa(p); } };
      e.track.onunmute = function () { klassa(p); };
      klassa(p, true);
      tillampaTaEmot();
    };
    pc.onconnectionstatechange = function () {
      if (p.pc !== pc) return;
      p.pcTid = nu();
      if (pc.connectionState === 'failed' && pc.restartIce) pc.restartIce();
    };
    // Bara en sida gör det första erbjudandet. Krockar två första erbjudanden (båda lägger till spår samtidigt)
    // backar den artiga sidan – och då händer det i Chromium att den sidan aldrig samlar egna kandidater,
    // så anslutningen blir kvar i 'new'. Den artiga sidan (och den som redan har ett erbjudande att svara på)
    // väntar därför med sina spår tills första svaret är skickat, högst 1,5 s.
    var vs = p.vantSdp, vi = p.vantIce || [];
    p.vantSdp = null; p.vantIce = [];
    if (vs || p.polite) {
      p.vantarErbj = true;
      p.vantErbjTimer = setTimeout(function () { if (p.pc === pc) slappSpar(p); }, 1500);
    } else lagSparPaPc(p);
    // Erbjudande och kandidater som kom innan vi var inne (t.ex. värdens erbjudande precis när gästen släpps in)
    // besvaras nu – annars väntar båda på varandra tills vakten startar om.
    if (vs) taEmotSdp(p, vs);
    vi.forEach(function (d) { taEmotIce(p, d); });
  }
  function slappSpar(p) {
    if (!p.vantarErbj) return;
    p.vantarErbj = false; clearTimeout(p.vantErbjTimer);
    if (p.pc) lagSparPaPc(p);
  }
  // Ett erbjudande som inte besvarats på 3 s skickas igen (meddelanden kan ha tappats i en flik som låg i bakgrunden).
  function kollaFastnat() {
    if (S.fas !== 'mote') return;
    var t = nu();
    iMotet().forEach(function (p) {
      var pc = p.pc;
      if (!pc || p.making) return;
      // Båda har beskrivningar men ICE har aldrig startat (t.ex. inga egna kandidater efter en krock):
      // ny anslutning direkt i stället för att vänta på vakten (12 s)
      if (!p.polite && pc.signalingState === 'stable' && pc.remoteDescription && pc.connectionState === 'new' &&
          t - (p.sigTid || t) > 3500 && t - (p.omstartTid || 0) > 8000) { omstart(p, true); return; }
      if (pc.signalingState !== 'have-local-offer' || !pc.localDescription) return;
      if (t - (p.offerTid || t) < 3000) return;
      p.offerTid = t;
      S.signal.skicka(p.peer, 'sdp', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    });
  }
  // Vakt (körs med hjärtslaget): en deltagare i mötet utan fungerande anslutning får en ny.
  // Bara den icke-artiga sidan startar om och meddelar den andra med 'omstart', så att båda inte river samtidigt.
  var VAKT_MS = 12000;
  function vakt() {
    if (S.fas !== 'mote') return;
    var t = nu();
    iMotet().forEach(function (p) {
      if (!p.pc) { oppnaPc(p); return; }
      var cs = p.pc.connectionState, haller = cs === 'new' || cs === 'connecting' || cs === 'disconnected';
      // Utan spår åt något håll finns inget att ansluta (båda utan kamera och mikrofon) – då ingen omstart
      if (p.polite || t - (p.omstartTid || 0) < VAKT_MS + 3000 || !p.pc.getTransceivers().length) return;
      if (cs === 'failed' || (haller && t - p.pcTid > VAKT_MS)) omstart(p, true);
    });
  }
  function omstart(p, meddela) {
    p.omstartTid = nu();
    if (meddela) S.signal.skicka(p.peer, 'omstart', {});
    stangPc(p); oppnaPc(p);
  }
  function stangPc(p) {
    if (!p.pc) return;
    p.vantarErbj = false; clearTimeout(p.vantErbjTimer);
    try { p.pc.close(); } catch (e) { }
    p.pc = null; p.strommar = {}; p.vantSdp = null; p.vantIce = []; p.iceRest = [];
    if (p.kamera) { p.kamera = null; sand('strom', { peer: p.peer, typ: 'kamera', strom: null }); }
    if (p.skarm) { p.skarm = null; sand('strom', { peer: p.peer, typ: 'skarm', strom: null }); }
    taBortAnalys(p.peer);
  }
  // Sorterar inkommande strömmar i kamera och skärm (skärmens ström-id kommer i status).
  function klassa(p, tvinga) {
    var kam = null, sk = null;
    Object.keys(p.strommar).forEach(function (id) {
      var s = p.strommar[id];
      if (!s.getTracks().length) return;
      if (p.delar && p.skarmStrom && id === p.skarmStrom) sk = s;
      else if (id !== p.skarmStrom) kam = kam || s;
    });
    if (p.kamera !== kam || (tvinga && kam)) { p.kamera = kam; sand('strom', { peer: p.peer, typ: 'kamera', strom: kam }); kopplaLjudAnalys(p.peer, kam); }
    if (p.skarm !== sk) { p.skarm = sk; sand('strom', { peer: p.peer, typ: 'skarm', strom: sk }); }
  }
  function lagSparPaPc(p) {
    var pc = p.pc; if (!pc || p.vantarErbj) return;
    var lokal = lokalStrom();
    // Mikrofon
    if (M.mik) { if (p.s.mik) { if (p.s.mik.track !== M.mik) p.s.mik.replaceTrack(M.mik).catch(function () { }); } else p.s.mik = pc.addTrack(M.mik, lokal); }
    else if (p.s.mik && p.s.mik.track) p.s.mik.replaceTrack(null).catch(function () { });
    // Kamera (null = av eller Bara ljud – avsändaren behålls, ingen omförhandling)
    var v = kamSkickas() ? utKam() : null;
    if (v) { if (p.s.kam) { if (p.s.kam.track !== v) p.s.kam.replaceTrack(v).catch(function () { }); } else p.s.kam = pc.addTrack(v, lokal); }
    else if (p.s.kam && p.s.kam.track) p.s.kam.replaceTrack(null).catch(function () { });
    // Skärm
    var sk = M.skarm;
    if (sk) {
      var sv = sk.getVideoTracks()[0], sl = sk.getAudioTracks()[0];
      if (sv && !p.s.skarm) p.s.skarm = pc.addTrack(sv, sk);
      if (sl && !p.s.skarmLjud) p.s.skarmLjud = pc.addTrack(sl, sk);
    } else {
      if (p.s.skarm) { try { pc.removeTrack(p.s.skarm); } catch (e) { } p.s.skarm = null; }
      if (p.s.skarmLjud) { try { pc.removeTrack(p.s.skarmLjud); } catch (e) { } p.s.skarmLjud = null; }
    }
    tillampaSandning(p);
  }
  function bytAllaSpar() { Object.keys(S.peers).forEach(function (k) { if (S.peers[k].pc) lagSparPaPc(S.peers[k]); }); }
  // Något delas (egen eller annans skärm, eller presentation/kalkyl/3D/offert/dokument): videorutorna är då små i kanten.
  function delatAktivt() { return !!(M.skarm || IN.aktiv || IN.extern || IN.externPeer || iMotet().some(function (p) { return p.delar; })); }
  // Sätter parametrar på en avsändare. Avvisar webbläsaren prioritet/degradationPreference försöker vi igen utan dem,
  // så att bitrate och upplösning alltid går igenom.
  function sattParam(snd, fn, pref) {
    if (!snd || !snd.getParameters) return;
    var prova = function (med) {
      var par;
      try { par = snd.getParameters(); } catch (e) { return Promise.resolve(); }
      if (!par.encodings || !par.encodings.length) return Promise.resolve();
      fn(par.encodings[0], med);
      if (!med) par.encodings.forEach(function (e) { delete e.priority; delete e.networkPriority; });
      return snd.setParameters(par).then(function () {
        if (!med || !pref) return;
        // degradationPreference i ett eget anrop – stöds inte överallt
        try { var p2 = snd.getParameters(); if (p2.degradationPreference === pref) return; p2.degradationPreference = pref; return snd.setParameters(p2).catch(function () { }); } catch (e) { }
      });
    };
    prova(true).catch(function () { return prova(false); }).catch(function () { });
  }
  function tillampaSandning(enbart) {
    var spara = inst.sandning === 'spara' || S.autoSpara;
    var delat = delatAktivt();
    // Auto: varje mottagare får en egen ström (mesh) – sänk takten när fler är med.
    var andra = iMotet().length, tak = andra >= 3 ? 600000 : andra === 2 ? 1000000 : 0, skala = andra >= 3 ? 1.5 : 1;
    var kv = utKam(), kh = 0;
    try { kh = kv && kv.getSettings ? (kv.getSettings().height || 0) : 0; } catch (e) { }
    if (M.pipe && M.pipe.canvas && kv === M.pipe.spar) kh = M.pipe.canvas.height || kh;
    var sk = M.skarm && M.skarm.getVideoTracks()[0];
    var skPref = sk && sk.contentHint === 'detail' ? 'maintain-resolution' : 'maintain-framerate';
    (enbart ? [enbart] : Object.keys(S.peers).map(function (k) { return S.peers[k]; })).forEach(function (p) {
      if (!p.pc || !p.s) return;
      // Rösten först: skyddas när nätet är dåligt (viktigast i mesh)
      if (p.s.mik) sattParam(p.s.mik, function (e, med) { if (med) { e.priority = 'high'; e.networkPriority = 'high'; } });
      if (p.s.skarm) sattParam(p.s.skarm, function (e, med) { if (med) { e.priority = 'high'; e.networkPriority = 'high'; } }, skPref);
      if (p.s.kam) sattParam(p.s.kam, function (e, med) {
        if (spara) { e.maxBitrate = 300000; e.scaleResolutionDownBy = Math.max(2, kh > 360 ? kh / 270 : 1); e.maxFramerate = 15; }
        else if (delat) { e.maxBitrate = 350000; e.scaleResolutionDownBy = Math.max(skala, kh > 360 ? kh / 360 : 1); e.maxFramerate = 15; }
        else if (tak) { e.maxBitrate = tak; e.scaleResolutionDownBy = skala; delete e.maxFramerate; }
        else { delete e.maxBitrate; e.scaleResolutionDownBy = 1; delete e.maxFramerate; }
        if (med) { e.priority = delat ? 'low' : 'medium'; e.networkPriority = delat ? 'low' : 'medium'; }
      }, 'balanced');
    });
  }
  function tillampaTaEmot() {
    var paa = inst.taEmot !== 'ljud';
    Object.keys(S.peers).forEach(function (k) {
      var p = S.peers[k]; if (!p.pc) return;
      p.pc.getReceivers().forEach(function (r) { if (r.track && r.track.kind === 'video') r.track.enabled = paa; });
    });
  }
  function taEmotSdp(p, data) {
    var pc = p.pc; if (!pc || !data.sdp || typeof data.sdp.sdp !== 'string' || ['offer', 'answer'].indexOf(data.sdp.type) < 0) return;
    var desc = { type: data.sdp.type, sdp: data.sdp.sdp };
    var kollision = desc.type === 'offer' && (p.making || pc.signalingState !== 'stable');
    p.ignorera = !p.polite && kollision;
    if (p.ignorera) return;
    p.kedja = (p.kedja || Promise.resolve()).then(function () {
      if (pc.signalingState === 'closed') return;
      return pc.setRemoteDescription(desc).then(function () {
        // Kandidater som inte gick att lägga till förut (kom före beskrivningen eller under en krock) prövas igen.
        // Efter en krock skickar webbläsaren inte om kandidaterna – utan detta blir anslutningen kvar i 'new'.
        var rest = p.iceRest || []; p.iceRest = [];
        rest.forEach(function (c) { pc.addIceCandidate(c).catch(function () { }); });
        if (desc.type === 'offer') return pc.setLocalDescription().then(function () {
          S.signal.skicka(p.peer, 'sdp', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
          // Första svaret skickat: nu kan våra egna spår läggas till (en omförhandling utan krock)
          if (p.pc === pc) slappSpar(p);
        });
      });
    }).catch(function (e) { if (window.console) console.warn('[samtal] sdp', e); });
  }
  function taEmotIce(p, data) {
    if (!p.pc) return;
    var c = data.c;
    if (c && (typeof c.candidate !== 'string')) return;
    var pc = p.pc;
    p.kedja = (p.kedja || Promise.resolve()).then(function () {
      if (p.pc !== pc || pc.signalingState === 'closed') return;
      if (c && !pc.remoteDescription) { spara(); return; }
      return pc.addIceCandidate(c || null).catch(function () { if (c) spara(); });
    }).catch(function () { });
    function spara() { if (p.pc === pc && (p.iceRest = p.iceRest || []).length < 60) p.iceRest.push(c); }
  }

  /* ---------- statistik ---------- */
  function nivaAv(forlust, rtt) {
    if (forlust > 5 || rtt > 300) return 'dalig';
    if (forlust >= 2 || rtt >= 150) return 'varning';
    return 'bra';
  }
  function mataStats() {
    var alla = iMotet().filter(function (p) { return p.pc; });
    if (!alla.length) return;
    Promise.all(alla.map(function (p) {
      return p.pc.getStats().then(function (rapport) {
        var f = p.stats || {}, n = { t: nu(), in: {}, ut: {} }, rtt = null, kodek = null, kodekId = null;
        var mottagna = 0, forlorade = 0, inBytes = 0, utBytes = 0;
        rapport.forEach(function (r) {
          if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000;
          if (r.type === 'inbound-rtp') {
            mottagna += r.packetsReceived || 0; forlorade += Math.max(0, r.packetsLost || 0); inBytes += r.bytesReceived || 0;
            if (r.kind === 'video' && r.frameWidth && (!n.in.bredd || r.frameWidth > n.in.bredd)) { n.in.bredd = r.frameWidth; n.in.hojd = r.frameHeight; n.in.fps = Math.round(r.framesPerSecond || 0); kodekId = r.codecId; }
          }
          if (r.type === 'outbound-rtp') {
            utBytes += r.bytesSent || 0;
            if (r.kind === 'video' && r.frameWidth && (!n.ut.bredd || r.frameWidth > n.ut.bredd)) {
              n.ut.bredd = r.frameWidth; n.ut.hojd = r.frameHeight; n.ut.fps = Math.round(r.framesPerSecond || 0);
              n.ut.begransning = ({ cpu: 'processor', bandwidth: 'bandbredd', none: 'inget', other: 'annat' })[r.qualityLimitationReason] || 'inget';
              // Visar om kodningen görs i hårdvara (avgör om VP8/H.264 är bäst på en långsam dator)
              n.ut.kodare = str(r.encoderImplementation, 80) || null;
              n.ut.hardvara = typeof r.powerEfficientEncoder === 'boolean' ? r.powerEfficientEncoder : null;
            }
          }
        });
        if (kodekId) { var k = rapport.get ? rapport.get(kodekId) : null; if (k && k.mimeType) kodek = k.mimeType.replace(/^video\//, ''); }
        var dt = f.t ? (n.t - f.t) / 1000 : 0;
        n.mottagna = mottagna; n.forlorade = forlorade; n.inBytes = inBytes; n.utBytes = utBytes;
        if (dt > 0) {
          n.in.kbps = Math.max(0, Math.round((inBytes - (f.inBytes || 0)) * 8 / 1000 / dt));
          n.ut.kbps = Math.max(0, Math.round((utBytes - (f.utBytes || 0)) * 8 / 1000 / dt));
        }
        var dm = mottagna - (f.mottagna || 0), df = forlorade - (f.forlorade || 0);
        var forlust = dm + df > 0 ? (df / (dm + df)) * 100 : 0;
        p.stats = n;
        p.hist.push({ forlust: forlust, rtt: rtt || 0 }); if (p.hist.length > 5) p.hist.shift(); // medel över 10 s
        var mf = p.hist.reduce(function (s, h) { return s + h.forlust; }, 0) / p.hist.length;
        var mr = p.hist.reduce(function (s, h) { return s + h.rtt; }, 0) / p.hist.length;
        var nv = nivaAv(mf, mr);
        var mat = { peer: p.peer, niva: nv, rtt: rtt === null ? null : Math.round(rtt), forlust: Math.round(mf * 10) / 10, in: n.in, ut: n.ut, kodek: kodek };
        p.senaste = mat;
        if (p.natverk !== nv) { p.natverk = nv; sand('deltagare-andrad', { peer: p.peer, falt: ['natverk'] }); }
        sand('natverk', mat);
        return mat;
      }).catch(function () { return null; });
    })).then(function (lista) {
      lista = lista.filter(Boolean); if (!lista.length) return;
      var ordning = { bra: 0, varning: 1, dalig: 2 };
      var samst = lista.reduce(function (a, b) { return ordning[b.niva] > ordning[a.niva] ? b : a; });
      var jag = { peer: 'jag', niva: samst.niva, rtt: samst.rtt, forlust: samst.forlust, in: samst.in, ut: lista[0].ut, kodek: samst.kodek };
      S.natverkJag = jag; sand('natverk', jag);
      // Svag anslutning: dålig i 6 s → sänk sändkvaliteten (Auto) tills den varit bra i 20 s.
      var t = nu();
      if (jag.niva === 'dalig') { S.braSedan = 0; if (!S.svagSedan) S.svagSedan = t; if (!S.svag && t - S.svagSedan >= 6000) { S.svag = true; sand('svag', { pa: true }); if (inst.sandning === 'auto') { S.autoSpara = true; tillampaSandning(); } } }
      else { S.svagSedan = 0; if (jag.niva === 'bra') { if (!S.braSedan) S.braSedan = t; if (S.svag && t - S.braSedan >= 20000) { S.svag = false; sand('svag', { pa: false }); if (S.autoSpara) { S.autoSpara = false; tillampaSandning(); } } } }
    });
  }
  function stats(peer) {
    if (!peer || peer === 'jag') return S.natverkJag;
    var p = S.peers[peer]; return p ? p.senaste || null : null;
  }

  /* ---------- rummet ---------- */
  function nyJag(jag) {
    jag = jag || {};
    var roll = ['vard', 'kollega', 'gast'].indexOf(jag.roll) >= 0 ? jag.roll : 'gast';
    return { peer: 'p' + slump(8), id: str(jag.id, 40) || null, namn: str(jag.namn, 60).trim() || (roll === 'gast' ? 'Gäst' : 'Kollega'),
      roll: roll, gast: roll === 'gast', mik: false, kam: false, hand: false, handTid: 0, delar: false, delarTid: 0, talar: false, fas: 'av' };
  }
  function motesData(m) {
    m = m || {};
    return {
      id: str(m.id, 40) || null, rum: str(m.rum, 40).replace(/[^a-z0-9-]/gi, ''), titel: str(m.titel, 120) || 'Videomöte',
      start: str(m.start, 40) || null, langd: Math.max(5, Math.min(600, +m.langd || 30)), vardNamn: str(m.vardNamn, 60),
      vantrum: m.vantrum !== false, direkt: m.direkt === 'jag' ? 'jag' : 'foretag',
      deltagare: Array.isArray(m.deltagare) ? m.deltagare.slice(0, 20).map(function (d) { return { namn: str(d && d.namn, 60), typ: d && d.typ === 'gast' ? 'gast' : 'kollega' }; }) : [],
      kund: m.kund || null
    };
  }
  function minStatus() {
    var j = S.jag;
    return { namn: j.namn, id: j.id || '', roll: j.roll, i: S.fas === 'mote' ? 'mote' : (S.fas === 'vantar' ? 'vantar' : 'forhand'),
      mik: !!j.mik, kam: kamSkickas(), hand: !!j.hand, handTid: j.handTid || 0, delar: !!j.delar, delarTid: j.delarTid || 0,
      skarmStrom: M.skarm ? M.skarm.id : '', last: S.last, vantrum: S.vantrum, borjade: S.borjade || '' };
  }
  function skickaStatus(till) {
    if (!S.jag || S.fas === 'av') return;
    S.signal.skicka(till || '*', 'status', minStatus());
  }
  function forbered(mote, jag) {
    // Förbereds samma rum igen från förhandsvisningen (t.ex. nytt namn) behålls vad vi vet om de andra,
    // så att "värden är inne" inte försvinner tills nästa hjärtslag.
    var forraRum = S.mote && S.fas === 'forhand' ? S.mote.rum : null;
    var kanda = S.peers;
    lamnaRum(true);
    S.mote = motesData(mote);
    if (!S.mote.rum) throw fel('okand', 'Mötet saknar rumskod.');
    var gammal = S.jag;
    S.jag = nyJag(jag);
    if (gammal) { S.jag.kam = gammal.kam && !!M.rakam; S.jag.mik = gammal.mik && !!M.mik; }
    instNyckel = null; laddaInst();
    S.vantrum = S.mote.vantrum; S.last = false; S.delare = null; S.borjade = null; S.narvarande = {}; S.chatt = []; S.talare = null;
    S.peers = {}; S.vantande = {}; S.svag = false; S.autoSpara = false;
    nollstallInnehall();
    if (forraRum && forraRum === S.mote.rum) Object.keys(kanda).forEach(function (k) { if (kanda[k].i !== 'vantar') S.peers[k] = kanda[k]; });
    sattFas('forhand');
    S.avSignal = S.signal.lyssna(taEmot);
    S.signal.anslut(S.mote.rum, { peer: S.jag.peer, namn: S.jag.namn, roll: S.jag.roll }).then(function () {
      S.signal.skicka('*', 'hej', minStatus());
      if (S.jag.roll === 'gast') S.signal.skicka('*', 'info-fraga', {});
    }).catch(function (e) { sand('fel', e); });
    S.hjartTimer = setInterval(hjartslag, HJARTSLAG_MS);
    return tillstand();
  }
  function hjartslag() {
    if (S.fas === 'av') return;
    if (['forhand', 'vantar', 'mote'].indexOf(S.fas) >= 0) S.signal.skicka('*', 'hej', minStatus());
    var t = nu(), andrat = false;
    Object.keys(S.peers).forEach(function (k) {
      var p = S.peers[k];
      if (t - p.sett > TYST_MS) {
        var var_i = p.i === 'mote';
        if (p.delar && var_i) sand('delning', { peer: p.peer, pa: false });
        stangPc(p); delete S.peers[k]; if (var_i) andrat = true;
      }
    });
    Object.keys(S.vantande).forEach(function (k) { if (t - S.vantande[k].sett > TYST_MS) { delete S.vantande[k]; sand('vantande', vantandeLista()); } });
    if (andrat) efterDeltagarAndring();
    vakt();
  }
  function efterDeltagarAndring() {
    var lista = deltagarLista();
    sand('deltagare', lista);
    var delare = S.jag && S.jag.delar ? S.jag.peer : null;
    iMotet().forEach(function (p) { if (p.delar && (!delare || p.delarTid > (S.jag.delarTid || 0))) delare = p.peer; });
    if (delare !== S.delare) S.delare = delare;
    kollaInnehallVisare();
    if (S.fas === 'mote') tillampaSandning();
    if (R.pa && !R.egen && R.peer && !(S.peers[R.peer] && S.peers[R.peer].i === 'mote')) { R = { pa: false }; sand('inspelning', { pa: false }); }
    if (S.fas === 'mote') {
      var harVard = vardIMotet();
      if (harVard !== S.forraHarVard) { S.forraHarVard = harVard; if (!harVard) sand('vard', { peer: null }); }
    }
  }
  function gaMed() {
    if (!S.jag || !S.mote) return Promise.reject(fel('okand', 'Mötet är inte förberett.'));
    if (S.fas === 'mote' || S.fas === 'vantar') return Promise.resolve(S.fas);
    if (iMotet().length >= MAX_DELTAGARE) { sattFas('slut', 'fullt'); return Promise.resolve('slut'); }
    ac(); // ljudanalysen får starta i användarens klick
    var r = S.jag.roll, knacka;
    if (r === 'vard') knacka = false;
    else if (r === 'kollega') knacka = S.last || S.mote.direkt === 'jag';
    else knacka = S.last || S.vantrum;
    if (knacka) {
      sattFas('vantar');
      S.knackStart = nu();
      var knack = function () {
        if (S.fas !== 'vantar') return;
        if (nu() - S.knackStart > KNACK_MAX_MS) { stoppaKnack(); sattFas('nekad', 'tidsgrans'); return; }
        S.signal.skicka('*', 'knackar', { namn: S.jag.namn, roll: S.jag.roll });
      };
      knack(); S.knackTimer = setInterval(knack, KNACK_MS);
      return Promise.resolve('vantar');
    }
    gaIn();
    return Promise.resolve('mote');
  }
  function stoppaKnack() { if (S.knackTimer) { clearInterval(S.knackTimer); S.knackTimer = null; } }
  function gaIn() {
    stoppaKnack();
    if (!S.borjade) {
      // Ta över starttiden från dem som redan är inne, annars nu
      var tidigast = null; iMotet().forEach(function (p) { if (p.borjade && (!tidigast || p.borjade < tidigast)) tidigast = p.borjade; });
      S.borjade = tidigast || iso();
    }
    S.narvarande[S.jag.peer] = { namn: S.jag.namn, roll: S.jag.roll };
    sattFas('mote');
    S.signal.skicka('*', 'hej', minStatus());
    iMotet().forEach(function (p) { S.narvarande[p.peer] = { namn: p.namn, roll: p.roll }; oppnaPc(p); });
    if (!S.statsTimer) S.statsTimer = setInterval(function () { kollaFastnat(); mataStats(); }, 2000);
    S.forraHarVard = vardIMotet();
    efterDeltagarAndring();
    sand('jag', jagObj());
    // Värd utan väntrum: släpp in den som redan knackar
    if (S.jag.roll === 'vard' && !S.vantrum && !S.last) slappInAlla();
  }

  function taEmot(m) {
    var data = m.data || {}, p = S.peers[m.fran];
    var arVard = p && p.roll === 'vard';
    if (VARDKOMMANDON.indexOf(m.typ) >= 0 && !arVard) return;

    switch (m.typ) {
      case 'hej': case 'status': {
        var ny = !p;
        if (ny) { p = S.peers[m.fran] = nyPost(m.fran); }
        var forraI = p.i, forraDelar = p.delar, andrat = [];
        p.sett = nu();
        var falt = { namn: str(data.namn, 60) || p.namn, id: str(data.id, 40), roll: ['vard', 'kollega', 'gast'].indexOf(data.roll) >= 0 ? data.roll : 'gast',
          i: ['forhand', 'vantar', 'mote'].indexOf(data.i) >= 0 ? data.i : 'forhand', mik: !!data.mik, kam: !!data.kam, hand: !!data.hand,
          handTid: +data.handTid || 0, delar: !!data.delar, delarTid: +data.delarTid || 0, skarmStrom: str(data.skarmStrom, 80), borjade: str(data.borjade, 40) };
        Object.keys(falt).forEach(function (k) { if (p[k] !== falt[k]) { andrat.push(k); p[k] = falt[k]; } });
        if (p.roll === 'vard' && typeof data.last === 'boolean' && data.last !== S.last) { S.last = data.last; sand('jag', jagObj()); }
        if (p.roll === 'vard' && typeof data.vantrum === 'boolean' && data.vantrum !== S.vantrum) S.vantrum = data.vantrum;
        // Svara den som inte hört oss än – även om posten skapades av 'knackar' eller 'sdp' före första hej
        var svara = (m.typ === 'hej' && (!p.harStatus || data.fraga === true)) || (andrat.indexOf('i') >= 0 && p.i === 'mote');
        p.harStatus = true;
        if (svara) {
          S.signal.skicka(m.fran, 'status', minStatus()); // svara den nya
          // Den som kommer in under en pågående inspelning får veta det direkt
          if (R.pa && R.egen && p.i === 'mote') S.signal.skicka(m.fran, 'inspelning', { pa: true, lage: R.lage });
          // ... och det som visas (presentation, kalkyl, 3D …)
          if (p.i === 'mote') innehallTillNy(m.fran);
        }
        if (p.i !== 'vantar' && S.vantande[p.peer] && p.i === 'mote') { delete S.vantande[p.peer]; sand('vantande', vantandeLista()); }
        if (p.i === 'mote') {
          if (S.fas === 'mote') { S.narvarande[p.peer] = { namn: p.namn, roll: p.roll }; oppnaPc(p); }
          // Ta över skärmen: den som började dela senast vinner
          if (p.delar && !forraDelar && S.jag && S.jag.delar && p.delarTid > S.jag.delarTid) slutaDela();
          if (p.delar && !forraDelar && IN.aktiv && IN.aktiv.egen && p.delarTid > IN.aktiv.tid) slutaInnehall();
        }
        if (forraI === 'mote' && p.i !== 'mote') stangPc(p);
        if (andrat.indexOf('delar') >= 0 || andrat.indexOf('skarmStrom') >= 0) { klassa(p); if (andrat.indexOf('delar') >= 0) sand('delning', { peer: p.peer, pa: p.delar }); }
        if (ny || andrat.indexOf('i') >= 0 || andrat.indexOf('roll') >= 0) efterDeltagarAndring();
        else if (andrat.length && p.i === 'mote') { sand('deltagare-andrad', { peer: p.peer, falt: andrat }); if (andrat.indexOf('delar') >= 0) efterDeltagarAndring(); }
        if (andrat.indexOf('i') >= 0 && p.i === 'mote' && p.roll === 'vard' && S.fas === 'vantar' && S.jag.roll === 'gast' && !S.vantrum && !S.last) gaIn();
        break;
      }
      case 'info-fraga':
        if (S.jag && S.jag.roll === 'vard' && S.mote) {
          var mi = S.mote;
          S.signal.skicka(m.fran, 'info', { titel: mi.titel, start: mi.start || '', langd: mi.langd, vardNamn: mi.vardNamn || S.jag.namn, vantrum: S.vantrum, last: S.last });
        }
        break;
      case 'info':
        if (arVard && S.mote) {
          S.mote.titel = str(data.titel, 120) || S.mote.titel; S.mote.start = str(data.start, 40) || S.mote.start;
          S.mote.langd = Math.max(5, Math.min(600, +data.langd || S.mote.langd)); S.mote.vardNamn = str(data.vardNamn, 60) || S.mote.vardNamn;
          if (typeof data.vantrum === 'boolean') S.vantrum = data.vantrum;
          if (typeof data.last === 'boolean') S.last = data.last;
          sand('mote', kopia(S.mote));
        }
        break;
      case 'knackar': {
        if (!p) { p = S.peers[m.fran] = nyPost(m.fran); }
        p.sett = nu(); p.i = 'vantar';
        if (!p.namn || p.namn === 'Okänd') p.namn = str(data.namn, 60) || 'Gäst';
        var v = S.vantande[m.fran];
        if (!v) {
          v = S.vantande[m.fran] = { peer: m.fran, namn: str(data.namn, 60) || 'Gäst', roll: data.roll === 'kollega' ? 'kollega' : 'gast', gast: data.roll !== 'kollega', sedan: nu(), sett: nu() };
          sand('knackar', { peer: v.peer, namn: v.namn, gast: v.gast });
          sand('vantande', vantandeLista());
          // Svara direkt, så att den som väntar ser att värden redan är inne
          if (S.jag && S.fas !== 'av') S.signal.skicka(m.fran, 'status', minStatus());
        }
        v.sett = nu();
        // Värd i mötet utan väntrum släpper in direkt
        if (S.fas === 'mote' && S.jag.roll === 'vard' && !S.vantrum && !S.last) slappIn(m.fran);
        break;
      }
      case 'slapp-in':
        if (data.peer === (S.jag && S.jag.peer) && S.fas === 'vantar') gaIn();
        if (S.vantande[data.peer]) { delete S.vantande[data.peer]; sand('vantande', vantandeLista()); }
        break;
      case 'neka':
        if (data.peer === (S.jag && S.jag.peer) && S.fas === 'vantar') { stoppaKnack(); sattFas('nekad', 'nekad'); }
        if (S.vantande[data.peer]) { delete S.vantande[data.peer]; sand('vantande', vantandeLista()); }
        break;
      case 'sdp':
        // Erbjudande från någon vi inte hört av än: skapa posten och be om status i stället för att tappa det
        if (!p && S.fas === 'mote' && S.jag) {
          p = S.peers[m.fran] = nyPost(m.fran); p.i = 'mote';
          var fraga = minStatus(); fraga.fraga = true; S.signal.skicka(m.fran, 'hej', fraga);
        }
        if (p && !p.pc && S.fas === 'mote') { p.i = 'mote'; oppnaPc(p); efterDeltagarAndring(); }
        if (p && p.pc) taEmotSdp(p, data);
        else if (p && data.sdp && data.sdp.type === 'offer' && ['forhand', 'vantar'].indexOf(S.fas) >= 0) { p.vantSdp = data; p.vantIce = []; }
        break;
      case 'ice':
        if (p && p.pc) taEmotIce(p, data);
        else if (p && p.vantSdp && (p.vantIce = p.vantIce || []).length < 60) p.vantIce.push(data);
        break;
      case 'innehall': taEmotInnehall(p, data); break;
      case 'innehall-forslag': taEmotForslag(p, data); break;
      case 'innehall-fil': taEmotFilBit(p, data); break;
      case 'omstart':
        if (p && p.i === 'mote' && S.fas === 'mote') omstart(p, false);
        break;
      case 'reaktion':
        if (p && p.i === 'mote' && REAKTIONER.indexOf(data.typ) >= 0 && S.fas === 'mote') sand('reaktion', { peer: p.peer, typ: data.typ });
        break;
      case 'chatt':
        if (p && p.i === 'mote' && S.fas === 'mote' && typeof data.text === 'string' && data.text.trim()) {
          var c = { peer: p.peer, namn: p.namn, text: str(data.text, 2000), tid: iso(), egen: false };
          S.chatt.push({ namn: c.namn, text: c.text, tid: c.tid });
          sand('chatt', c);
        }
        break;
      case 'lamnar':
        if (p) {
          var varInne = p.i === 'mote';
          if (p.delar && varInne) sand('delning', { peer: p.peer, pa: false });
          stangPc(p); delete S.peers[m.fran];
          if (S.vantande[m.fran]) { delete S.vantande[m.fran]; sand('vantande', vantandeLista()); }
          if (varInne) efterDeltagarAndring();
          if (S.talare === m.fran) { S.talare = null; sand('talar', { peer: null }); }
        }
        break;
      case 'avsluta-alla':
        if (S.fas === 'mote' || S.fas === 'vantar' || S.fas === 'forhand') avsluta('slut', 'avslutat-av-vard');
        break;
      case 'ta-bort':
        if (data.peer === (S.jag && S.jag.peer)) avsluta('borttagen', 'borttagen');
        break;
      case 'las':
        if (typeof data.pa === 'boolean') S.last = data.pa;
        if (typeof data.vantrum === 'boolean') S.vantrum = data.vantrum;
        sand('jag', jagObj());
        break;
      case 'inspelning':
        if (p && p.i === 'mote' && p.roll !== 'gast' && S.fas === 'mote' && !R.egen) {
          if (data.pa === true) R = { pa: true, egen: false, peer: p.peer, lage: data.lage === 'ljud' ? 'ljud' : 'bild', sedan: nu(), av: p.namn };
          else R = { pa: false };
          var ii = inspelningInfo(); ii.peer = p.peer; ii.av = p.namn; sand('inspelning', ii);
        }
        break;
      case 'tysta':
        if (data.peer === (S.jag && S.jag.peer)) sand('tysta-begaran', { fran: m.fran, namn: p.namn });
        break;
      case 'ny-vard':
        if (data.peer === (S.jag && S.jag.peer) && S.jag.roll !== 'vard') {
          S.jag.roll = 'vard'; S.jag.gast = false;
          sand('vard', { peer: S.jag.peer }); sand('jag', jagObj()); skickaStatus();
        } else if (S.peers[data.peer]) { S.peers[data.peer].roll = 'vard'; sand('vard', { peer: data.peer }); efterDeltagarAndring(); }
        break;
    }
  }

  function arVard() { return S.jag && S.jag.roll === 'vard'; }
  function slappIn(peer) {
    if (!arVard()) return;
    S.signal.skicka('*', 'slapp-in', { peer: str(peer, 64) });
    if (S.vantande[peer]) { delete S.vantande[peer]; sand('vantande', vantandeLista()); }
  }
  function slappInAlla() { Object.keys(S.vantande).forEach(slappIn); }
  function neka(peer) {
    if (!arVard()) return;
    S.signal.skicka('*', 'neka', { peer: str(peer, 64) });
    if (S.vantande[peer]) { delete S.vantande[peer]; sand('vantande', vantandeLista()); }
  }
  function las(paa) {
    if (!arVard()) return;
    S.last = !!paa; S.signal.skicka('*', 'las', { pa: S.last, vantrum: S.vantrum }); sand('jag', jagObj());
  }
  function vantrum(paa) {
    if (!arVard()) return;
    S.vantrum = !!paa; S.signal.skicka('*', 'las', { pa: S.last, vantrum: S.vantrum }); sand('jag', jagObj());
    if (!S.vantrum && !S.last && S.fas === 'mote') slappInAlla();
  }
  function taBort(peer) { if (arVard()) S.signal.skicka('*', 'ta-bort', { peer: str(peer, 64) }); }
  function bedTysta(peer) { if (arVard()) S.signal.skicka(str(peer, 64), 'tysta', { peer: str(peer, 64) }); }
  function gorTillVard(peer) { if (arVard()) S.signal.skicka('*', 'ny-vard', { peer: str(peer, 64) }); }

  function sammanfattning(orsak) {
    var slutade = iso(), b = S.borjade;
    return {
      borjade: b, slutade: b ? slutade : null, minuter: b ? Math.max(0, Math.round((Date.parse(slutade) - Date.parse(b)) / 60000)) : 0,
      narvarande: Object.keys(S.narvarande).map(function (k) { return S.narvarande[k]; }), chatt: S.chatt.slice(), orsak: orsak || null
    };
  }
  // Lämnar rummet lokalt. tyst = utan händelser (används när ett nytt möte förbereds).
  function lamnaRum(tyst) {
    stoppaKnack();
    if (S.jag && S.fas !== 'av') S.signal.skicka('*', 'lamnar', {});
    Object.keys(S.peers).forEach(function (k) { stangPc(S.peers[k]); });
    if (S.statsTimer) { clearInterval(S.statsTimer); S.statsTimer = null; }
    if (S.hjartTimer && tyst) { clearInterval(S.hjartTimer); S.hjartTimer = null; }
    if (tyst) { if (S.avSignal) { S.avSignal(); S.avSignal = null; } S.signal.lamna(); }
  }
  function avsluta(fas, orsak) {
    var varInne = S.fas === 'mote';
    var sam = sammanfattning(orsak);
    if (S.jag && S.jag.delar) slutaDela(true);
    if (R.pa && R.egen) stoppaInspelning(); else R = { pa: false };
    if (IN.aktiv && IN.aktiv.egen) slutaInnehall(true);
    if (nollstallInnehall()) sand('innehall', { pa: false, typ: null, peer: null, egen: false, andrat: ['typ'] });
    // Värden lämnar: ge värdskapet till en kollega om någon finns kvar
    if (fas === 'lamnat' && arVard() && varInne) {
      var andraVardar = iMotet().some(function (p) { return p.roll === 'vard'; });
      var kollega = iMotet().filter(function (p) { return p.roll === 'kollega'; }).sort(function (a, b) { return a.peer < b.peer ? -1 : 1; })[0];
      if (!andraVardar && kollega) S.signal.skicka('*', 'ny-vard', { peer: kollega.peer });
    }
    lamnaRum(false);
    S.vantande = {};
    if (S.jag) { S.jag.hand = false; S.jag.handTid = 0; }
    stoppaMedia();
    S.talare = null; S.delare = null;
    sattFas(fas, orsak);
    sand('deltagare', []); sand('vantande', []);
    if (varInne || fas !== 'lamnat') sand('slut', sam);
    S.borjade = null; S.narvarande = {}; S.chatt = [];
    // Signalen hålls öppen så att Gå med igen (tillbaka + gaMed) fungerar.
  }
  function lamna() { if (S.fas === 'av') return; avsluta('lamnat', 'lamnade'); }
  function avslutaForAlla() {
    if (!arVard()) return;
    S.signal.skicka('*', 'avsluta-alla', {});
    avsluta('slut', 'avslutat');
  }
  // Kopplar ner helt (UI stänger lagret).
  function nollstall() {
    lamnaRum(true); stoppaMedia();
    if (S.hjartTimer) { clearInterval(S.hjartTimer); S.hjartTimer = null; }
    S.peers = {}; S.vantande = {}; S.mote = null;
    sattFas('av');
  }
  // Förhandsvisningen igen efter att ha lämnat (Gå med igen)
  function tillbaka() {
    if (!S.mote || !S.jag) return;
    sattFas('forhand');
    S.signal.skicka('*', 'hej', minStatus());
  }

  /* ---------- inspelning (lokalt, MediaRecorder) ---------- */
  // Ljud: alla deltagares ljud + egen mikrofon mixas i en AudioContext.
  // Ljud och bild: dessutom en sammanställd bild (canvas 1280×720) av alla rutor och delat innehåll.
  var R = { pa: false };
  function inspelningInfo() { return { pa: !!R.pa, lage: R.lage || null, sedan: R.sedan || null, av: R.av || null, egen: !!R.egen }; }
  function rFarg(n) { var f = ['#b8743f', '#6f8f72', '#5d7aa6', '#a6655d', '#8a6fa6', '#a6905d']; var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return f[h % f.length]; }
  function rVideo(key, strom) {
    var e = R.vid[key];
    if (e && e.strom === strom) return e.el;
    if (!e) { var el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; e = R.vid[key] = { el: el, strom: null }; }
    e.strom = strom; e.el.srcObject = strom || null; if (strom) e.el.play().catch(function () { });
    return e.el;
  }
  function rSynkaLjud() {
    if (!R.pa || !R.egen) return;
    var vill = {};
    if (M.mik) vill[M.mik.id] = M.mik;
    if (M.skarm) M.skarm.getAudioTracks().forEach(function (t) { vill[t.id] = t; });
    iMotet().forEach(function (p) {
      [p.kamera, p.skarm].forEach(function (s) { if (s) s.getAudioTracks().forEach(function (t) { vill[t.id] = t; }); });
    });
    Object.keys(R.ljud).forEach(function (id) { if (!vill[id] || vill[id].readyState === 'ended') { try { R.ljud[id].disconnect(); } catch (e) { } delete R.ljud[id]; } });
    Object.keys(vill).forEach(function (id) {
      if (R.ljud[id] || vill[id].readyState === 'ended') return;
      try { var k = R.ac.createMediaStreamSource(new MediaStream([vill[id]])); k.connect(R.dest); R.ljud[id] = k; } catch (e) { }
    });
  }
  function rRita() {
    var c = R.canvas, x = R.ctx, B = c.width, H = c.height;
    x.fillStyle = '#1c1714'; x.fillRect(0, 0, B, H);
    var rutor = [];
    if (S.jag) rutor.push({ key: 'jag', namn: S.jag.namn, strom: S.jag.kam ? lokalStrom() : null });
    iMotet().forEach(function (p) { rutor.push({ key: p.peer, namn: p.namn, strom: p.kam && inst.taEmot !== 'ljud' ? p.kamera : null }); });
    var delning = null;
    if (M.skarm) delning = { key: 'jag-skarm', strom: M.skarm };
    else iMotet().forEach(function (p) { if (!delning && p.delar && p.skarm) delning = { key: p.peer + '-skarm', strom: p.skarm }; });
    var ruta = function (r, rx, ry, rb, rh) {
      var el = r.strom && r.strom.getVideoTracks().length ? rVideo(r.key, r.strom) : null;
      x.save(); x.beginPath(); if (x.roundRect) x.roundRect(rx, ry, rb, rh, 12); else x.rect(rx, ry, rb, rh); x.clip();
      if (el && el.videoWidth) {
        var s = Math.max(rb / el.videoWidth, rh / el.videoHeight), w = el.videoWidth * s, h = el.videoHeight * s;
        x.drawImage(el, rx + (rb - w) / 2, ry + (rh - h) / 2, w, h);
      } else {
        x.fillStyle = '#2a231e'; x.fillRect(rx, ry, rb, rh);
        var d = Math.min(rb, rh) * 0.34;
        x.fillStyle = rFarg(r.namn); x.beginPath(); x.arc(rx + rb / 2, ry + rh / 2, d / 2, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff'; x.font = '600 ' + Math.round(d * 0.38) + 'px Poppins, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(initialer(r.namn), rx + rb / 2, ry + rh / 2);
      }
      x.restore();
      x.font = '600 15px Manrope, system-ui, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      var tw = x.measureText(r.namn).width;
      x.fillStyle = 'rgba(20,16,13,.66)'; x.fillRect(rx + 10, ry + rh - 34, tw + 20, 24);
      x.fillStyle = '#f6f1ea'; x.fillText(r.namn, rx + 20, ry + rh - 17);
    };
    var g = 10;
    if (delning) {
      var el = rVideo(delning.key, delning.strom), sb = Math.round(B * 0.78);
      if (el.videoWidth) { var s = Math.min((sb - 2 * g) / el.videoWidth, (H - 2 * g) / el.videoHeight), w = el.videoWidth * s, h = el.videoHeight * s; x.drawImage(el, g + (sb - 2 * g - w) / 2, g + (H - 2 * g - h) / 2, w, h); }
      var rb = B - sb - g, rh = Math.min(Math.round(rb * 9 / 16), Math.floor((H - g) / Math.max(1, rutor.length)) - g);
      rutor.forEach(function (r, i) { ruta(r, sb, g + i * (rh + g), rb, rh); });
    } else {
      var n = rutor.length, kol = n <= 1 ? 1 : n <= 4 ? 2 : 3, rad = Math.ceil(n / kol);
      var cb = (B - g * (kol + 1)) / kol, ch = (H - g * (rad + 1)) / rad;
      rutor.forEach(function (r, i) {
        var k = i % kol, rr = Math.floor(i / kol), sista = rr === rad - 1 ? n - rr * kol : kol;
        var off = (kol - sista) * (cb + g) / 2;
        ruta(r, g + off + k * (cb + g), g + rr * (ch + g), cb, ch);
      });
    }
    // Röd prick och tid
    var sek = Math.floor((nu() - R.sedan) / 1000), t = Math.floor(sek / 60) + ':' + ('0' + sek % 60).slice(-2);
    x.fillStyle = 'rgba(20,16,13,.66)'; x.fillRect(B - 120, 14, 106, 28);
    x.fillStyle = '#e0533d'; x.beginPath(); x.arc(B - 104, 28, 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f6f1ea'; x.font = '600 14px Manrope, system-ui, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('REC ' + t, B - 92, 28);
    rSynkaLjud();
  }
  function startaInspelning(opt) {
    opt = opt || {};
    if (R.pa) return Promise.reject(fel('okand', R.egen ? 'En inspelning pågår redan.' : (R.av || 'Någon') + ' spelar redan in mötet.'));
    if (S.fas !== 'mote') return Promise.reject(fel('okand', 'Gå med i mötet först.'));
    if (S.jag.roll === 'gast') return Promise.reject(fel('okand', 'Bara värden och kollegor kan spela in.'));
    if (typeof MediaRecorder === 'undefined') return Promise.reject(fel('okand', 'Webbläsaren kan inte spela in.'));
    var c = ac(); if (!c) return Promise.reject(fel('okand', 'Webbläsaren kan inte spela in ljud.'));
    var lage = opt.lage === 'ljud' ? 'ljud' : 'bild';
    R = { pa: true, egen: true, lage: lage, sedan: nu(), av: S.jag.namn, ac: c, dest: c.createMediaStreamDestination(), ljud: {}, vid: {}, bitar: [] };
    var spar = R.dest.stream.getAudioTracks().slice();
    if (lage === 'bild') {
      R.canvas = document.createElement('canvas'); R.canvas.width = 1280; R.canvas.height = 720;
      R.ctx = R.canvas.getContext('2d');
      if (typeof R.canvas.captureStream !== 'function') { R = { pa: false }; return Promise.reject(fel('okand', 'Webbläsaren kan inte spela in bild.')); }
      rRita();
      spar.unshift(R.canvas.captureStream(15).getVideoTracks()[0]);
      R.timer = setInterval(rRita, 1000 / 15); // setInterval – fortsätter även när fliken ligger i bakgrunden
    } else { rSynkaLjud(); R.timer = setInterval(rSynkaLjud, 1000); }
    var typer = lage === 'ljud' ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    var typ = typer.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
    var o = { audioBitsPerSecond: 128000 }; if (typ) o.mimeType = typ; if (lage === 'bild') o.videoBitsPerSecond = 2500000;
    try { R.rec = new MediaRecorder(new MediaStream(spar), o); }
    catch (e) { clearInterval(R.timer); R = { pa: false }; return Promise.reject(fel('okand', 'Inspelningen kunde inte starta.')); }
    R.typ = R.rec.mimeType || typ || (lage === 'ljud' ? 'audio/webm' : 'video/webm');
    R.rec.ondataavailable = function (e) { if (e.data && e.data.size) R.bitar.push(e.data); };
    R.rec.start(1000);
    S.signal.skicka('*', 'inspelning', { pa: true, lage: lage });
    var info = inspelningInfo(); info.peer = S.jag.peer; sand('inspelning', info);
    return Promise.resolve(info);
  }
  function stoppaInspelning() {
    if (!R.pa || !R.egen) return Promise.resolve(null);
    var r = R;
    return new Promise(function (resolve) {
      var klar = false;
      r.rec.onstop = function () {
        if (klar) return; klar = true;
        clearInterval(r.timer);
        Object.keys(r.ljud).forEach(function (id) { try { r.ljud[id].disconnect(); } catch (e) { } });
        Object.keys(r.vid).forEach(function (k) { r.vid[k].el.srcObject = null; });
        var blob = new Blob(r.bitar, { type: r.typ });
        var ut = { blob: blob, typ: r.typ, lage: r.lage, borjade: iso(r.sedan), slutade: iso(), sekunder: Math.round((nu() - r.sedan) / 1000), storlek: blob.size,
          filnamn: 'motesinspelning-' + iso(r.sedan).slice(0, 16).replace(/[:T]/g, '-') + (/mp4/.test(r.typ) ? '.mp4' : (r.lage === 'ljud' ? '.weba' : '.webm')) };
        if (R === r) R = { pa: false };
        S.signal.skicka('*', 'inspelning', { pa: false });
        sand('inspelning', { pa: false, peer: S.jag ? S.jag.peer : null, av: r.av, egen: true });
        sand('inspelning-klar', ut);
        resolve(ut);
      };
      try { r.rec.stop(); } catch (e) { r.rec.onstop(); }
    });
  }

  /* ---------- delat innehåll: presentation, kalkyl, 3D, offert, dokument ---------- */
  // Synkas som ren data över signalen – ingen video och ingen HTML. Mottagaren ritar själv (med escape).
  // Bara värd och kollegor kan visa. Den som visar styr; med kontroll 'alla' kan de andra skicka förslag
  // (händelsen innehall-forslag hos den som visar, som själv avgör och anropar uppdatera).
  // Bara en sak delas åt gången: skärmdelning och innehåll tar över från varandra (den som började senast vinner).
  var INNEHALL_TYPER = ['presentation', 'kalkyl', '3d', 'offert', 'dokument'];
  var INNEHALL_MAX = 60000;                  // tecken JSON per meddelande (data/steg)
  var FIL_BIT = 48000, FIL_MAX = 12 * 1024 * 1024, FIL_CACHE = 40 * 1024 * 1024;
  var FIL_TYPER = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
  var IN = { aktiv: null, extern: false, externPeer: null, timer: null, vantar: false, medData: false, fTimer: null, forslag: null, filer: {}, mottag: {}, urler: {} };

  function innehallInfo() {
    var a = IN.aktiv; if (!a) return null;
    return { pa: true, id: a.id, peer: a.peer, namn: a.namn, egen: a.egen, typ: a.typ, steg: kopia(a.steg === undefined ? null : a.steg),
      data: kopia(a.data === undefined ? null : a.data), kontroll: a.kontroll, tid: a.tid };
  }
  // Ren data: följer signalens schema och får plats i ett meddelande. false = ogiltig/för stor.
  function rensaData(d) {
    if (d === undefined) return undefined;
    if (!giltigData(d, 0, '')) return false;
    var j; try { j = JSON.stringify(d); } catch (e) { return false; }
    if (typeof j !== 'string' || j.length > INNEHALL_MAX) return false;
    return JSON.parse(j);
  }
  function lika(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function annanDelare() {
    if (IN.aktiv && !IN.aktiv.egen) return { peer: IN.aktiv.peer, namn: IN.aktiv.namn, innehall: true };
    var p = iMotet().filter(function (x) { return x.delar; })[0];
    return p ? { peer: p.peer, namn: p.namn, skarm: true } : null;
  }
  function efterInnehall(andrat, peer, egen) {
    var info = innehallInfo() || { pa: false, typ: null, peer: peer || null, egen: !!egen };
    info.andrat = andrat || [];
    sand('innehall', info);
    if (S.fas === 'mote') tillampaSandning(); // kamerorna sänks medan något delas
  }
  function skickaInnehall(till, medData) {
    var a = IN.aktiv; if (!a || !a.egen) return;
    var m = { pa: true, id: a.id, typ: a.typ, steg: a.steg === undefined ? null : a.steg, kontroll: a.kontroll, tid: a.tid };
    if (medData) m.data = a.data === undefined ? null : a.data;
    S.signal.skicka(till || '*', 'innehall', m);
  }
  // Täta ändringar (t.ex. 3D-vinkeln) skickas högst 10 gånger per sekund – det senaste vinner.
  function skickaStrypt(medData) {
    if (medData) IN.medData = true;
    if (IN.timer) { IN.vantar = true; return; }
    skickaInnehall('*', IN.medData); IN.medData = false;
    IN.timer = setTimeout(function () { IN.timer = null; if (IN.vantar) { IN.vantar = false; skickaStrypt(false); } }, 100);
  }
  function visaInnehall(o) {
    o = o || {};
    if (S.fas !== 'mote' || !S.jag) return Promise.reject(fel('okand', 'Gå med i mötet först.'));
    if (S.jag.roll === 'gast') return Promise.reject(fel('okand', 'Bara värden och kollegor kan visa innehåll.'));
    if (INNEHALL_TYPER.indexOf(o.typ) < 0) return Promise.reject(fel('okand', 'Det här innehållet går inte att visa.'));
    var data = rensaData(o.data === undefined ? null : o.data), steg = rensaData(o.steg === undefined ? 0 : o.steg);
    if (data === false || steg === false) return Promise.reject(fel('okand', 'Innehållet är för stort för att visas i mötet.'));
    var annan = annanDelare();
    if (annan && !o.taOver) {
      var f = fel('annan-delar', annan.namn + (annan.innehall ? ' visar redan något.' : ' delar redan.')); f.peer = annan.peer; f.namn = annan.namn;
      return Promise.reject(f);
    }
    if (M.skarm) slutaDela();
    if (IN.aktiv && IN.aktiv.egen) slutaInnehall(true);
    if (IN.aktiv) { IN.aktiv = null; rensaMottagnaFiler(); } // tar över någon annans
    IN.aktiv = { id: slump(6), peer: S.jag.peer, namn: S.jag.namn, egen: true, typ: o.typ, steg: steg, data: data,
      kontroll: o.kontroll === 'alla' ? 'alla' : 'visare', tid: nu() };
    IN.filer = {};
    skickaInnehall('*', true);
    efterInnehall(['typ', 'steg', 'data', 'kontroll']);
    return Promise.resolve(innehallInfo());
  }
  // Ändrar det som visas: {typ?, steg?, data?, kontroll?}. data skickas bara när den ändras.
  function uppdateraInnehall(d) {
    var a = IN.aktiv; if (!a || !a.egen) return false;
    d = d || {};
    var andrat = [], medData = false;
    if (d.typ !== undefined && d.typ !== a.typ) { if (INNEHALL_TYPER.indexOf(d.typ) < 0) return false; a.typ = d.typ; andrat.push('typ'); }
    if (d.steg !== undefined) { var st = rensaData(d.steg); if (st === false) return false; if (!lika(st, a.steg)) { a.steg = st; andrat.push('steg'); } }
    if (d.data !== undefined) { var dd = rensaData(d.data); if (dd === false) return false; if (!lika(dd, a.data)) { a.data = dd; andrat.push('data'); medData = true; } }
    if (d.kontroll !== undefined) { var k = d.kontroll === 'alla' ? 'alla' : 'visare'; if (k !== a.kontroll) { a.kontroll = k; andrat.push('kontroll'); } }
    if (!andrat.length) return true;
    skickaStrypt(medData);
    var info = innehallInfo(); info.andrat = andrat; sand('innehall', info);
    return true;
  }
  function slutaInnehall(tyst) {
    var a = IN.aktiv; if (!a || !a.egen) return;
    IN.aktiv = null; IN.filer = {};
    if (IN.timer) { clearTimeout(IN.timer); IN.timer = null; } IN.vantar = false; IN.medData = false;
    S.signal.skicka('*', 'innehall', { pa: false, id: a.id });
    if (tyst !== true) efterInnehall(['typ'], S.jag ? S.jag.peer : null, true);
  }
  // Förslag från den som inte visar (kunden ändrar kalkylen, snurrar huset) – bara när kontroll är 'alla'.
  function foreslaInnehall(d) {
    var a = IN.aktiv; d = d || {};
    if (!a || a.egen || a.kontroll !== 'alla' || S.fas !== 'mote') return false;
    var st = rensaData(d.steg), dd = rensaData(d.data);
    if (st === false || dd === false) return false;
    var f = IN.forslag && IN.forslag.id === a.id ? IN.forslag : { id: a.id, till: a.peer };
    if (st !== undefined) f.steg = st;
    if (dd !== undefined) f.data = dd;
    IN.forslag = f;
    if (!IN.fTimer) {
      var skicka = function () {
        var x = IN.forslag; IN.forslag = null;
        if (x) { var m = { id: x.id }; if (x.steg !== undefined) m.steg = x.steg; if (x.data !== undefined) m.data = x.data; S.signal.skicka(x.till, 'innehall-forslag', m); }
      };
      skicka();
      IN.fTimer = setTimeout(function () { IN.fTimer = null; skicka(); }, 100);
    }
    return true;
  }
  function taEmotInnehall(p, data) {
    if (!p || p.i !== 'mote' || S.fas !== 'mote') return;
    // samtal-dela.js eget format ({typ, v, data, styr}, utan pa): motorn läser bara av om något delas,
    // så att kamerorna sänks medan det visas. Ritningen sköter samtal-dela.js själv.
    if (data.pa === undefined) {
      var visar = p.roll !== 'gast' && INNEHALL_TYPER.indexOf(data.typ) >= 0 ? p.peer : null;
      if (visar && IN.externPeer !== visar) { IN.externPeer = visar; tillampaSandning(); }
      else if (!visar && IN.externPeer === p.peer && data.typ === null) { IN.externPeer = null; tillampaSandning(); }
      return;
    }
    if (data.pa === true) {
      if (p.roll === 'gast' || INNEHALL_TYPER.indexOf(data.typ) < 0) return;
      var id = str(data.id, 20), tid = +data.tid || nu();
      var st = rensaData(data.steg), dd = rensaData(data.data);
      if (!id || st === false || dd === false) return;
      if (IN.aktiv && IN.aktiv.egen) { if (tid > IN.aktiv.tid) slutaInnehall(); else return; }
      if (S.jag && S.jag.delar && tid > (S.jag.delarTid || 0)) slutaDela();
      var forra = IN.aktiv && IN.aktiv.id === id && IN.aktiv.peer === p.peer ? IN.aktiv : null;
      if (!forra && IN.aktiv) rensaMottagnaFiler();
      var andrat = forra ? [] : ['typ', 'steg', 'data', 'kontroll'];
      var ny = { id: id, peer: p.peer, namn: p.namn, egen: false, typ: data.typ, tid: tid,
        steg: st === undefined ? (forra ? forra.steg : 0) : st,
        data: dd === undefined ? (forra ? forra.data : null) : dd,
        kontroll: data.kontroll === 'alla' ? 'alla' : 'visare' };
      if (forra) {
        if (forra.typ !== ny.typ) andrat.push('typ');
        if (!lika(forra.steg, ny.steg)) andrat.push('steg');
        if (dd !== undefined && !lika(forra.data, ny.data)) andrat.push('data');
        if (forra.kontroll !== ny.kontroll) andrat.push('kontroll');
      }
      IN.aktiv = ny;
      if (andrat.length) efterInnehall(andrat);
    } else if (IN.aktiv && !IN.aktiv.egen && IN.aktiv.peer === p.peer) {
      IN.aktiv = null; rensaMottagnaFiler(); efterInnehall(['typ'], p.peer, false);
    }
  }
  function taEmotForslag(p, data) {
    var a = IN.aktiv;
    if (!p || p.i !== 'mote' || !a || !a.egen || a.kontroll !== 'alla' || data.id !== a.id) return;
    var st = rensaData(data.steg), dd = rensaData(data.data);
    if (st === false || dd === false) return;
    var ut = { peer: p.peer, namn: p.namn, gast: p.roll === 'gast' };
    if (st !== undefined) ut.steg = st;
    if (dd !== undefined) ut.data = dd;
    sand('innehall-forslag', ut);
  }
  // Den som visar har slutat vara med (lämnat, tystnat) → innehållet försvinner hos de andra.
  function kollaInnehallVisare() {
    if (IN.externPeer && !(S.peers[IN.externPeer] && S.peers[IN.externPeer].i === 'mote')) IN.externPeer = null;
    var a = IN.aktiv;
    if (a && !a.egen && !(S.peers[a.peer] && S.peers[a.peer].i === 'mote')) { IN.aktiv = null; rensaMottagnaFiler(); efterInnehall(['typ'], a.peer, false); }
  }

  /* filer till det delade (dokumentets sidor, bilder, pdf) – skickas i bitar, bara till dem i mötet */
  function tillBase64(kalla) {
    if (typeof kalla === 'string') {
      var m = /^data:([a-z0-9.+\/-]+);base64,([A-Za-z0-9+\/=]+)$/i.exec(kalla);
      return m ? Promise.resolve({ typ: m[1].toLowerCase(), b64: m[2] }) : Promise.reject(fel('okand', 'Filen kunde inte läsas.'));
    }
    if (typeof Blob !== 'undefined' && kalla instanceof Blob) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () { var s = String(r.result || ''), i = s.indexOf(','); resolve({ typ: (kalla.type || '').toLowerCase(), b64: i >= 0 ? s.slice(i + 1) : '' }); };
        r.onerror = function () { reject(fel('okand', 'Filen kunde inte läsas.')); };
        r.readAsDataURL(kalla);
      });
    }
    return Promise.reject(fel('okand', 'Filen kunde inte läsas.'));
  }
  function skickaBitar(till, id) {
    var f = IN.filer[id], a = IN.aktiv;
    if (!f || !a || !a.egen) return Promise.resolve(false);
    var av = Math.ceil(f.b64.length / FIL_BIT) || 1, nr = 0, aktivId = a.id;
    return new Promise(function (resolve) {
      var steg = function () {
        if (!IN.aktiv || IN.aktiv.id !== aktivId || IN.filer[id] !== f) { resolve(false); return; }
        for (var i = 0; i < 8 && nr < av; i++, nr++) {
          S.signal.skicka(till, 'innehall-fil', { aktiv: aktivId, id: id, typ: f.typ, nr: nr, av: av, bit: f.b64.slice(nr * FIL_BIT, (nr + 1) * FIL_BIT) });
        }
        if (nr < av) setTimeout(steg, 0); else resolve(true);
      };
      steg();
    });
  }
  // Skickar en fil som hör till det som visas. kalla = Blob/File eller data:-URL. Gäster läser aldrig IH.db – de får bara detta.
  function skickaFil(id, kalla) {
    var a = IN.aktiv;
    if (!a || !a.egen) return Promise.reject(fel('okand', 'Visa innehållet först.'));
    id = str(id, 40).replace(/[^a-z0-9_-]/gi, '');
    if (!id) return Promise.reject(fel('okand', 'Filen saknar namn.'));
    return tillBase64(kalla).then(function (r) {
      if (FIL_TYPER.indexOf(r.typ) < 0) throw fel('okand', 'Den filtypen kan inte visas i mötet.');
      var storlek = Math.floor(r.b64.length * 3 / 4);
      if (storlek > FIL_MAX) throw fel('okand', 'Filen är för stor för att visas i mötet (högst 12 MB).');
      var summa = 0; Object.keys(IN.filer).forEach(function (k) { if (k !== id) summa += IN.filer[k].storlek; });
      if (summa + storlek > FIL_CACHE) IN.filer = {}; // de äldsta skickas inte igen till den som kommer sent
      IN.filer[id] = { typ: r.typ, b64: r.b64, storlek: storlek };
      return skickaBitar('*', id).then(function () { return { id: id, typ: r.typ, storlek: storlek }; });
    });
  }
  function rensaMottagnaFiler() {
    Object.keys(IN.urler).forEach(function (k) { try { URL.revokeObjectURL(IN.urler[k].url); } catch (e) { } });
    IN.urler = {}; IN.mottag = {};
  }
  function taEmotFilBit(p, d) {
    var a = IN.aktiv;
    if (!p || p.i !== 'mote' || !a || a.egen || a.peer !== p.peer || d.aktiv !== a.id) return;
    var id = str(d.id, 40), typ = str(d.typ, 40), av = +d.av, nr = +d.nr, bit = d.bit;
    if (!id || /[^a-z0-9_-]/i.test(id) || FIL_TYPER.indexOf(typ) < 0) return;
    if (!(av >= 1 && av <= Math.ceil(FIL_MAX * 4 / 3 / FIL_BIT) + 1 && nr >= 0 && nr < av && Math.floor(nr) === nr)) return;
    if (typeof bit !== 'string' || bit.length > FIL_BIT || !/^[A-Za-z0-9+\/=]*$/.test(bit)) return;
    var r = IN.mottag[id];
    if (!r || r.av !== av || r.typ !== typ) r = IN.mottag[id] = { typ: typ, av: av, bitar: new Array(av), fatt: 0 };
    if (r.bitar[nr] === undefined) { r.bitar[nr] = bit; r.fatt++; }
    if (r.fatt < r.av) return;
    delete IN.mottag[id];
    try {
      var bin = atob(r.bitar.join('')), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var blob = new Blob([u], { type: typ }), url = URL.createObjectURL(blob);
      if (IN.urler[id]) try { URL.revokeObjectURL(IN.urler[id].url); } catch (e) { }
      IN.urler[id] = { url: url, typ: typ, storlek: blob.size };
      sand('innehall-fil', { id: id, url: url, typ: typ, storlek: blob.size, peer: p.peer });
    } catch (e) { }
  }
  // Den som kommer in sent får det som visas och filerna.
  function innehallTillNy(peer) {
    if (!IN.aktiv || !IN.aktiv.egen) return;
    skickaInnehall(peer, true);
    Object.keys(IN.filer).forEach(function (id) { skickaBitar(peer, id); });
  }
  function nollstallInnehall() {
    if (IN.timer) clearTimeout(IN.timer);
    if (IN.fTimer) clearTimeout(IN.fTimer);
    var hade = !!IN.aktiv;
    IN.aktiv = null; IN.extern = false; IN.externPeer = null; IN.timer = null; IN.fTimer = null; IN.vantar = false; IN.medData = false; IN.forslag = null; IN.filer = {};
    rensaMottagnaFiler();
    return hade;
  }

  /* ---------- i mötet ---------- */
  function delaSkarm(opt) {
    opt = opt || {};
    var md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia) return Promise.reject(fel('skarm-fel'));
    if (S.fas !== 'mote') return Promise.reject(fel('skarm-fel', 'Gå med i mötet först.'));
    var annan = annanDelare();
    if (annan && !opt.taOver) { var f = fel('annan-delar', annan.namn + (annan.innehall ? ' visar redan något.' : ' delar redan.')); f.peer = annan.peer; f.namn = annan.namn; return Promise.reject(f); }
    var text = opt.lage !== 'video';
    return md.getDisplayMedia({ video: { frameRate: { ideal: text ? 15 : 30 } }, audio: opt.ljud !== false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include' })
      .then(function (s) {
        if (M.skarm) slutaDela(true);
        var v = s.getVideoTracks()[0];
        if (v && 'contentHint' in v) v.contentHint = text ? 'detail' : 'motion';
        if (v) v.addEventListener('ended', function () { if (M.skarm === s) slutaDela(); });
        M.skarm = s;
        S.jag.delar = true; S.jag.delarTid = nu();
        if (IN.aktiv && IN.aktiv.egen) slutaInnehall();
        else if (IN.aktiv) { IN.aktiv = null; rensaMottagnaFiler(); efterInnehall(['typ']); } // tar över någon annans
        bytAllaSpar();
        ekoForDelning();
        efterDeltagarAndring();
        skickaStatus();
        sand('strom', { peer: 'jag', typ: 'skarm', strom: s });
        sand('delning', { peer: S.jag.peer, pa: true, egen: true });
        sand('jag', jagObj());
        return s;
      }, function (e) {
        var f = e && e.name === 'NotAllowedError' ? fel('skarm-nekad') : fel('skarm-fel');
        if (f.kod !== 'skarm-nekad') sand('fel', f);
        throw f;
      });
  }
  function slutaDela(tyst) {
    if (!M.skarm) return;
    var s = M.skarm; M.skarm = null;
    s.getTracks().forEach(stoppa);
    if (S.jag) { S.jag.delar = false; S.jag.delarTid = 0; }
    bytAllaSpar();
    ekoForDelning();
    if (tyst === true) return;
    efterDeltagarAndring();
    skickaStatus();
    sand('strom', { peer: 'jag', typ: 'skarm', strom: null });
    sand('delning', { peer: S.jag.peer, pa: false, egen: true });
    sand('jag', jagObj());
  }
  function hand(paa) {
    if (!S.jag) return;
    S.jag.hand = !!paa; S.jag.handTid = paa ? nu() : 0;
    sand('jag', jagObj()); skickaStatus();
  }
  function reaktion(typ) {
    if (REAKTIONER.indexOf(typ) < 0 || S.fas !== 'mote') return;
    S.signal.skicka('*', 'reaktion', { typ: typ });
    sand('reaktion', { peer: S.jag.peer, typ: typ, egen: true });
  }
  function chatt(text) {
    text = str(text, 2000).trim();
    if (!text || S.fas !== 'mote') return null;
    var c = { peer: S.jag.peer, namn: S.jag.namn, text: text, tid: iso(), egen: true };
    S.chatt.push({ namn: c.namn, text: c.text, tid: c.tid });
    S.signal.skicka('*', 'chatt', { text: text });
    sand('chatt', c);
    return c;
  }

  window.addEventListener('pagehide', function () {
    if (S.jag && S.fas !== 'av') S.signal.skicka('*', 'lamnar', {});
    try { stoppaMedia(); } catch (e) { }
    Object.keys(S.peers).forEach(function (k) { stangPc(S.peers[k]); });
    S.signal.lamna();
  });

  /* ---------- publikt ---------- */
  IH.samtal = {
    __motor: true,
    ICE: (IH.samtal && IH.samtal.ICE) || [], iceServrar: (IH.samtal && IH.samtal.iceServrar) || [], MAX: MAX_DELTAGARE,
    inspelning: { starta: function (o) { return startaInspelning(o); }, stoppa: function () { return stoppaInspelning(); }, aktiv: function () { return inspelningInfo(); } },
    pa: pa, av: av,
    tillstand: tillstand, stod: stod,
    enheter: enheter, startaMedia: startaMedia, forhandStrom: forhandStrom, stoppaMedia: stoppaMedia,
    sattMik: sattMik, sattKam: sattKam, bytEnhet: bytEnhet, kopplaHogtalare: kopplaHogtalare, ljudlage: ljudlage,
    installningar: installningar, sattInstallningar: sattInstallningar, testaTon: testaTon, spelaInTest: spelaInTest, niva: niva,
    bakgrund: { registrera: registrera, harModul: harModul, laddaModul: laddaModul, satt: sattBakgrund, aktuellt: aktuellt,
      forladda: function () { if (stod().bakgrund) laddaModul().catch(function () { }); } },
    innehall: {
      TYPER: INNEHALL_TYPER.slice(), FILTYPER: FIL_TYPER.slice(),
      visa: visaInnehall, uppdatera: uppdateraInnehall, sluta: function () { slutaInnehall(); },
      foresla: foreslaInnehall, aktivt: innehallInfo, skickaFil: skickaFil,
      // För eget protokoll (samtal-dela.js): säg till när du själv visar något, så sänks den egna kameran.
      extern: function (paa) { paa = !!paa; if (IN.extern !== paa) { IN.extern = paa; if (S.fas === 'mote') tillampaSandning(); } },
      fil: function (id) { var f = IN.urler[str(id, 40)]; return f ? { url: f.url, typ: f.typ, storlek: f.storlek } : null; }
    },
    forbered: forbered, gaMed: gaMed, slappIn: slappIn, slappInAlla: slappInAlla, neka: neka,
    las: las, vantrum: vantrum, taBort: taBort, bedTysta: bedTysta, gorTillVard: gorTillVard,
    lamna: lamna, avslutaForAlla: avslutaForAlla, tillbaka: tillbaka, nollstall: nollstall,
    delaSkarm: delaSkarm, slutaDela: function () { slutaDela(); }, hand: hand, reaktion: reaktion, chatt: chatt, stats: stats,
    sattSignal: function (impl) {
      if (!impl || typeof impl.anslut !== 'function' || typeof impl.skicka !== 'function' || typeof impl.lyssna !== 'function' || typeof impl.lamna !== 'function') throw new Error('Signalen saknar anslut/skicka/lyssna/lamna');
      lamnaRum(true); S.signal = impl; IH.samtal.signal = impl;
    }
  };
  IH.samtal.signal = S.signal;
})();
