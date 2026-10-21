/* Byggplattformen – tillval i 3D, offertförfrågningar, konsulter och
   recept/material. */
(function () {
  'use strict';
  var BP = window.BP, D = window.BP_DATA, M = window.Mangd;
  var e = BP.e, i = BP.i, $ = BP.$, $$ = BP.$$, G = BP.G;

  function linjar(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).concat([1]);
  }
  var TAKFARG = { plat: '#3a3d40', papp: '#1c1c1c', sedum: '#5d7a3a' };

  /* ===== Tillval ================================================================ */
  BP.flikvyer.tillval = function (p) {
    var h = BP.hus(p.hus);
    if (!h) return { html: '<p class="tomt">Tillval i 3D finns för hus ur biblioteket. Det här projektet bygger på en egen ritning.</p>' };
    var summa = BP.tillvalSumma(p);
    var html = '<div class="rutnat rutnat--huvud rutnat--stracka">' +
      '<div class="scen"><model-viewer id="tillval-mv" src="' + h.modell + '" alt="3D-modell av ' + e(h.namn) + ' med valda tillval" camera-controls disable-zoom touch-action="pan-y" interaction-prompt="none" shadow-intensity="0.9" shadow-softness="0.9" exposure="1.05" environment-image="modeller/himmel.png" tone-mapping="aces" camera-orbit="35deg 70deg auto"></model-viewer>' +
        '<span class="scen__tips">' + i('vrid') + 'Dra för att vrida</span></div>' +
      '<div class="rutnat"><section class="kort"><header class="kort__huvud"><h2>Kundens val</h2><small>' + e(p.kund) + '</small></header><div class="kort__kropp val">' +
        D.TILLVAL.map(function (g) {
          return '<div class="val__grupp"><b>' + g.namn + '</b><div class="val__lista" role="group" aria-label="' + g.namn + '">' + g.val.map(function (v) {
            return '<button class="valknapp" type="button" data-g="valj-tillval" data-id="' + p.id + '" data-grupp="' + g.id + '" data-val="' + v.id + '" aria-pressed="' + (p.tillval[g.id] === v.id) + '">' +
              (v.farg ? '<span class="farg" style="--f:' + v.farg + '"></span>' : '') + e(v.namn) + '<small>' + (v.pris ? (v.pris > 0 ? '+' : '−') + BP.kr(Math.abs(v.pris)) : 'ingår') + '</small></button>';
          }).join('') + '</div></div>';
        }).join('') + '</div></section>' +
        '<section class="kort"><div class="kort__kropp"><dl class="grop"><div><dt>Tillval, exempelpriser</dt><dd><b id="tillvalsumma">' + (summa >= 0 ? '+' : '−') + BP.kr(Math.abs(summa)) + '</b></dd></div></dl>' +
          '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="knapp" type="button" data-g="tillvalsbilaga" data-id="' + p.id + '">' + i('skrivut') + 'Tillvalsbilaga</button>' +
          '<button class="knapp" type="button" data-g="kopiera-lank" data-id="' + p.id + '">' + i('kopiera') + 'Länk till kunden</button></div>' +
          '<p style="margin-top:12px;font-size:12px;color:var(--text-3)">Altanen syns inte i modellen men kommer med i bilagan.</p></div></section></div></div>';
    return {
      html: html,
      efter: function (rot) {
        BP.laddaMV(function () {
          var mv = $('#tillval-mv', rot);
          if (!mv) return;
          var farga = function () {
            if (!mv.model) return;
            var f = D.TILLVAL[0].val.filter(function (v) { return v.id === p.tillval.fasad; })[0];
            ['fasad', 'panel'].forEach(function (n) { var mat = mv.model.getMaterialByName(n); if (mat && f) mat.pbrMetallicRoughness.setBaseColorFactor(linjar(f.farg)); });
            var tak = mv.model.getMaterialByName('tak');
            if (tak) tak.pbrMetallicRoughness.setBaseColorFactor(linjar(TAKFARG[p.tillval.tak] || TAKFARG.plat));
          };
          if (mv.loaded) farga(); else mv.addEventListener('load', farga, { once: true });
          BP.fargaTillval = farga;
        });
      }
    };
  };

  G['valj-tillval'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    var g = el.getAttribute('data-grupp'), v = el.getAttribute('data-val');
    p.tillval[g] = v;
    BP.spara();
    $$('[data-grupp="' + g + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
    var s = BP.tillvalSumma(p);
    var ut = $('#tillvalsumma'); if (ut) ut.textContent = (s >= 0 ? '+' : '−') + BP.kr(Math.abs(s));
    if (BP.fargaTillval) BP.fargaTillval();
  };
  G['kopiera-lank'] = function (el) {
    var url = location.href.replace(/#.*$/, '') + '#/projekt/' + el.getAttribute('data-id') + '/tillval';
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { BP.toast('Länken är kopierad', 'Kunden ser sina val i 3D'); }, function () { BP.toast('Kunde inte kopiera', url); });
  };
  G.tillvalsbilaga = function (el) {
    var p = BP.projekt(el.getAttribute('data-id')), h = BP.hus(p.hus);
    var w = window.open('', '_blank');
    if (!w) { BP.toast('Fönstret blockerades', 'Tillåt popup-fönster för att skriva ut'); return; }
    var bas = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    var rader = D.TILLVAL.map(function (g) { var v = g.val.filter(function (x) { return x.id === p.tillval[g.id]; })[0]; return '<tr><td>' + g.namn + '</td><td>' + e(v ? v.namn : '–') + '</td><td class="t">' + (v && v.pris ? (v.pris > 0 ? '+' : '−') + BP.kr(Math.abs(v.pris)) : 'ingår') + '</td></tr>'; }).join('');
    w.document.write('<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>Tillvalsbilaga – ' + e(p.namn) + '</title><style>@font-face{font-family:Barlow;src:url(' + bas + 'fonts/barlow-400.woff2)}@font-face{font-family:Barlow;font-weight:600;src:url(' + bas + 'fonts/barlow-600.woff2)}body{font:13px/1.5 Barlow,sans-serif;color:#2b2722;margin:40px;max-width:720px}h1{margin:0;font-size:24px}p{color:#55534d}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px;border-bottom:1px solid #e6e4de}.t{text-align:right}tfoot td{font-weight:600;border-top:2px solid #2b2722}.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:56px}.sign div{border-top:1px solid #2b2722;padding-top:6px;color:#55534d}img{width:100%;border-radius:8px;margin-top:16px}</style></head><body>' +
      '<h1>Tillvalsbilaga</h1><p>' + e(p.namn) + ' · ' + e(h.namn) + ' · ' + e(p.kund) + ' · ' + new Date().toLocaleDateString('sv-SE') + '</p><img src="' + bas + h.bild + '" alt="">' +
      '<table><tbody>' + rader + '</tbody><tfoot><tr><td colspan="2">Summa tillval (exempelpriser)</td><td class="t">' + BP.kr(BP.tillvalSumma(p)) + '</td></tr></tfoot></table>' +
      '<p>Bilagan hör till kontraktet. Priserna är exempel i prototypen.</p><div class="sign"><div>Kund</div><div>Leverantör</div></div><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  };

  BP.vyer.tillval = function () {
    var lista = BP.db.projekt.filter(function (p) { return p.hus; });
    return {
      titel: 'Tillval',
      html: '<div class="titelrad"><div class="titelrad__text"><h1>Tillval</h1><p class="titelrad__under">Kunden väljer i 3D, valen blir en bilaga till kontraktet.</p></div></div>' +
        '<div class="husnat">' + lista.map(function (p) {
          var h = BP.hus(p.hus), s = BP.tillvalSumma(p);
          var f = D.TILLVAL[0].val.filter(function (v) { return v.id === p.tillval.fasad; })[0];
          return '<a class="hus" href="#/projekt/' + p.id + '/tillval"><div class="hus__bild"><img src="' + h.bild + '" alt="" loading="lazy"></div><div class="hus__text"><div class="hus__rad"><b>' + e(p.kund) + '</b><span class="chip">' + e(h.namn) + '</span></div>' +
            '<div class="hus__fakta"><span style="display:inline-flex;gap:6px;align-items:center"><span class="farg" style="--f:' + (f ? f.farg : '#ccc') + ';width:12px;height:12px"></span>' + e(f ? f.namn : '') + '</span><span>' + (s >= 0 ? '+' : '−') + BP.kr(Math.abs(s)) + '</span></div></div></a>';
        }).join('') + '</div>'
    };
  };

  /* ===== Offertförfrågningar =========================================================== */
  var PARTNER = [
    { id: 'handel', namn: 'Exempel Bygghandel', rabatt: 12, leverans: '2 veckor' },
    { id: 'tra', namn: 'Exempel Trävaruhus', rabatt: 9, leverans: '10 dagar' },
    { id: 'grossist', namn: 'Exempel Grossist', rabatt: 15, leverans: '3 veckor' }
  ];

  BP.flikvyer.forfragningar = function (p) {
    var m = BP.mangdFor(p);
    var ob = BP.delarFor(p).filter(function (d) { return d.bekraftad === false; }).length;
    var svar = p.forfragningar.filter(function (f) { return f.status === 'svar'; });
    var html = '<div class="rutnat rutnat--huvud">' +
      '<section class="kort"><header class="kort__huvud"><h2>Förfrågningar på materialet</h2><small>' + m.rader.length + ' rader · ' + BP.kr(m.summa) + ' i listpris</small></header>' +
        (p.forfragningar.length ? '<table class="tabell tabell--svar"><thead><tr><th style="padding-left:16px">Till</th><th>Skickad</th><th>Status</th><th class="tal-c">Pris</th><th class="tal-c">Leverans</th><th></th></tr></thead><tbody>' +
          p.forfragningar.map(function (f) {
            var pris = f.svar ? Math.round(m.summa * (1 - f.svar.rabatt / 100)) : null;
            var bast = svar.length > 1 && f.svar && pris === Math.min.apply(null, svar.map(function (x) { return Math.round(m.summa * (1 - x.svar.rabatt / 100)); }));
            return '<tr><td style="padding-left:16px"><b>' + e(f.till) + '</b><small>' + (f.svar ? f.svar.rabatt + ' % under listpris' : 'väntar på svar') + '</small></td><td class="dolj-mobil">' + BP.sedan(f.skickad) + '</td>' +
              '<td>' + (f.status === 'svar' ? '<span class="chip chip--gron">Svar</span>' : '<span class="chip chip--bla"><span class="prick"></span>Skickad</span>') + (bast ? ' <span class="chip">Lägst</span>' : '') + '</td>' +
              '<td class="tal-c">' + (pris != null ? '<b>' + BP.kr(pris) + '</b>' : '–') + '</td><td class="tal-c dolj-mobil">' + (f.svar ? e(f.svar.leverans) : '–') + '</td>' +
              '<td style="width:120px">' + (f.svar && p.steg !== 'order' ? '<button class="knapp knapp--liten" type="button" data-g="valj-svar" data-id="' + p.id + '" data-f="' + f.id + '">Välj</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>'
          : '<div class="kort__kropp"><p class="tomt">Inga förfrågningar än. Skicka materiallistan till en eller flera bygghandlar och jämför svaren här.</p></div>') +
      '</section>' +
      '<section class="kort"><header class="kort__huvud"><h2>Skicka förfrågan</h2></header><div class="kort__kropp" style="display:grid;gap:12px">' +
        (ob ? '<div class="not not--tejp"><span>' + ob + ' byggdelar är inte bekräftade. Förfrågan går att skicka, men mängden kan ändras.</span></div>' : '') +
        '<div style="display:grid;gap:8px">' + PARTNER.map(function (x) {
          var redan = p.forfragningar.some(function (f) { return f.till === x.namn; });
          return '<label style="display:flex;gap:10px;align-items:center;min-height:36px"><input type="checkbox" name="partner" value="' + x.id + '"' + (redan ? ' disabled' : '') + '> ' + e(x.namn) + (redan ? ' <small style="color:var(--text-3)">· redan skickad</small>' : '') + '</label>';
        }).join('') + '</div>' +
        '<button class="knapp knapp--primar" type="button" data-g="skicka-forfragan" data-id="' + p.id + '"' + (m.rader.length ? '' : ' disabled') + '>' + i('skicka') + 'Skicka materiallistan</button>' +
        '<p style="font-size:12px;color:var(--text-3)">I prototypen svarar exempelpartnerna själva efter några sekunder.</p></div></section></div>';
    return { html: html };
  };

  G['skicka-forfragan'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    var valda = $$('input[name="partner"]:checked').map(function (x) { return PARTNER.filter(function (y) { return y.id === x.value; })[0]; });
    if (!valda.length) { BP.toast('Välj minst en partner', 'Bocka i vem som ska få listan'); return; }
    valda.forEach(function (x, n) {
      var f = { id: 'f' + Date.now().toString(36) + n, till: x.namn, skickad: new Date().toISOString(), status: 'skickad', svar: null };
      p.forfragningar.unshift(f);
      setTimeout(function () {
        f.status = 'svar'; f.svar = { rabatt: x.rabatt, leverans: x.leverans };
        BP.handelse(p, x.namn + ' svarade på förfrågan');
        BP.spara();
        if (location.hash.indexOf(p.id) !== -1) BP.rita();
        BP.toast(x.namn + ' har svarat', x.rabatt + ' % under listpris · ' + x.leverans);
      }, 2400 + n * 1300);
    });
    BP.handelse(p, 'Skickade materiallistan till ' + valda.map(function (x) { return x.namn; }).join(', '));
    BP.spara(); BP.rita();
    BP.toast('Förfrågan skickad', valda.length + (valda.length === 1 ? ' partner' : ' partner'));
  };
  G['valj-svar'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    var f = p.forfragningar.filter(function (x) { return x.id === el.getAttribute('data-f'); })[0];
    p.steg = 'order';
    BP.handelse(p, 'Order lagd hos ' + f.till);
    BP.spara(); BP.rita(); BP.toast('Order lagd', f.till);
  };

  BP.vyer.forfragningar = function () {
    var alla = [];
    BP.db.projekt.forEach(function (p) { p.forfragningar.forEach(function (f) { alla.push({ p: p, f: f }); }); });
    var leads = BP.db.leads;
    return {
      titel: 'Förfrågningar',
      html: '<div class="titelrad"><div class="titelrad__text"><h1>Förfrågningar</h1><p class="titelrad__under">Materialförfrågningar till partner och förfrågningar från konsumentsidan.</p></div></div>' +
        '<div class="rutnat rutnat--2">' +
          '<section class="kort"><header class="kort__huvud"><h2>Till partner</h2><small>' + alla.length + '</small></header>' + (alla.length ? '<div class="delar">' + alla.map(function (x) {
            return '<a class="del" href="#/projekt/' + x.p.id + '/forfragningar" style="text-decoration:none;grid-template-columns:minmax(0,1fr) auto"><div><b>' + e(x.f.till) + '</b><small>' + e(x.p.namn) + ' · ' + BP.sedan(x.f.skickad) + '</small></div>' + (x.f.status === 'svar' ? '<span class="chip chip--gron">Svar</span>' : '<span class="chip chip--bla">Skickad</span>') + '</a>';
          }).join('') + '</div>' : '<div class="kort__kropp"><p class="tomt">Inga förfrågningar än.</p></div>') + '</section>' +
          '<section class="kort"><header class="kort__huvud"><h2>Från konsumenter</h2><small>' + leads.length + '</small></header><div class="delar">' + leads.map(function (l) {
            var h = BP.hus(l.hus);
            return '<div class="del"><span class="avatar" style="--av:' + BP.avfarg(l.namn) + '">' + BP.initialer(l.namn) + '</span><div><b>' + e(l.namn) + '</b><small>' + e(h ? h.namn : '') + ' · ' + e(l.ort) + ' · ' + BP.sedan(l.tid) + '</small><small style="color:var(--text-2)">' + e(l.text) + '</small></div>' +
              (l.status === 'ny' ? '<button class="knapp knapp--liten" type="button" data-g="lead-projekt" data-id="' + l.id + '">Skapa projekt</button>' : '<span class="chip">Projekt skapat</span>') + '</div>';
          }).join('') + '</div></section></div>'
    };
  };

  /* ===== Konsulter ===================================================================== */
  BP.flikvyer.konsulter = function (p) {
    return { html: '<div class="rutnat rutnat--huvud"><section class="kort"><header class="kort__huvud"><h2>Beställda tjänster</h2></header>' +
      (p.konsulter.length ? '<div class="delar">' + p.konsulter.map(function (k) {
        var t = D.KONSULTER.filter(function (x) { return x.id === k.tjanst; })[0];
        return '<div class="del"><span class="typikon">' + i('konsult') + '</span><div><b>' + e(t.namn) + '</b><small>' + BP.sedan(k.tid) + (k.text ? ' · ' + e(k.text) : '') + '</small></div><span class="chip chip--bla"><span class="prick"></span>Beställd</span></div>';
      }).join('') + '</div>' : '<div class="kort__kropp"><p class="tomt">Inga tjänster beställda till projektet.</p></div>') + '</section>' +
      '<section class="kort"><header class="kort__huvud"><h2>Beställ</h2></header><div class="delar">' + D.KONSULTER.map(function (k) {
        return '<div class="del" style="grid-template-columns:minmax(0,1fr) auto"><div><b>' + e(k.namn) + '</b><small>' + e(k.text) + '</small><small>' + e(k.leverans) + '</small></div><button class="knapp knapp--liten" type="button" data-g="bestall-konsult" data-id="' + p.id + '" data-k="' + k.id + '">Beställ</button></div>';
      }).join('') + '</div></section></div>' };
  };

  G['bestall-konsult'] = function (el) {
    var p = BP.projekt(el.getAttribute('data-id'));
    var k = D.KONSULTER.filter(function (x) { return x.id === el.getAttribute('data-k'); })[0];
    BP.dialog({
      titel: 'Beställ ' + k.namn.toLowerCase(),
      kropp: '<p>' + e(k.text) + ' Underlaget från projektet (modell, ritning och mängd) följer med.</p><label class="falt"><span>Meddelande</span><textarea id="konsulttext" placeholder="Det här behöver vi hjälp med …"></textarea></label><div class="not">' + i('info') + '<span>Prototyp: beställningen skickas inte. ' + e(k.leverans) + '.</span></div>',
      fot: '<button class="knapp" type="button" data-stang>Avbryt</button><button class="knapp knapp--primar" type="button" id="bestall">Beställ</button>',
      efter: function (d) {
        $('#bestall', d).addEventListener('click', function () {
          p.konsulter.unshift({ tjanst: k.id, tid: new Date().toISOString(), text: $('#konsulttext', d).value.trim() });
          BP.handelse(p, 'Beställde ' + k.namn.toLowerCase());
          BP.spara(); d.close(); BP.rita(); BP.toast('Beställt', k.namn + ' · ' + p.namn);
        });
      }
    });
  };

  BP.vyer.konsulter = function () {
    var bestallda = [];
    BP.db.projekt.forEach(function (p) { p.konsulter.forEach(function (k) { bestallda.push({ p: p, k: k }); }); });
    return {
      titel: 'Konsulter',
      html: '<div class="titelrad"><div class="titelrad__text"><h1>Konsulter</h1><p class="titelrad__under">Beställ arkitekt, konstruktion, energiberäkning och KA direkt från projektet.</p></div></div>' +
        '<div class="tal" style="--n:4;margin-bottom:16px">' + D.KONSULTER.map(function (k) {
          return '<div><small>' + e(k.namn) + '</small><b>' + bestallda.filter(function (x) { return x.k.tjanst === k.id; }).length + '<em>beställda</em></b><span>' + e(k.leverans) + '</span></div>';
        }).join('') + '</div>' +
        '<section class="kort"><header class="kort__huvud"><h2>Beställningar</h2></header>' + (bestallda.length ? '<div class="delar">' + bestallda.map(function (x) {
          var t = D.KONSULTER.filter(function (y) { return y.id === x.k.tjanst; })[0];
          return '<a class="del" style="text-decoration:none" href="#/projekt/' + x.p.id + '/konsulter"><span class="typikon">' + i('konsult') + '</span><div><b>' + e(t.namn) + '</b><small>' + e(x.p.namn) + ' · ' + BP.sedan(x.k.tid) + '</small></div><span class="chip chip--bla">Beställd</span></a>';
        }).join('') + '</div>' : '<div class="kort__kropp"><p class="tomt">Inga beställningar än. Öppna ett projekt och välj fliken Konsulter.</p></div>') + '</section>'
    };
  };

  /* ===== Recept och material ============================================================ */
  var REGELTEXT = {
    yta: 'yta i m²', lopmeterYta: 'yta ÷ täckbredd', reglar: 'stående c/c', langs: 'längs byggdelen', tvars: 'tvärs c/c', takstolar: 'takstolar c/c',
    skivor: 'skivor i format', perOppning: 'per öppning', perYta: 'per m²', plintar: 'plintar i rutnät', volym: 'volym', fast: 'fast antal'
  };
  var receptVal = null;

  BP.vyer.recept = function () {
    var R = BP.recept(), MAT = BP.material();
    var ids = Object.keys(R);
    receptVal = receptVal && R[receptVal] ? receptVal : ids[0];
    var rc = R[receptVal];
    var html = '<div class="titelrad"><div class="titelrad__text"><h1>Recept och material</h1><p class="titelrad__under">Varje byggdel räknas med ett recept. Ändra ett pris så räknas alla projekt om. Allt här är exempel.</p></div>' +
      '<div class="titelrad__knappar"><button class="knapp" type="button" data-g="aterstall">' + i('vrid') + 'Återställ exempeldata</button></div></div>' +
      '<div class="rutnat" style="grid-template-columns:260px minmax(0,1fr);align-items:start">' +
        '<nav class="kort" aria-label="Recept"><div class="delar">' + ids.map(function (id) {
          return '<button type="button" class="del" data-g="recept-valj" data-id="' + id + '" style="text-align:left;border-left:0;border-right:0;border-top:0;background:' + (id === receptVal ? 'var(--yta-2)' : 'transparent') + ';grid-template-columns:auto minmax(0,1fr)"><span class="typikon">' + i({ vagg: 'vagg', bjalklag: 'golv', tak: 'tak', grund: 'grund' }[R[id].typ] || 'recept') + '</span><span><b>' + e(R[id].namn) + '</b><small>' + R[id].rader.length + ' rader</small></span></button>';
        }).join('') + '</div><div class="rec-tips"><b>Så räknas det</b><ul><li><b>kapas</b> – virket kapas ur hela längder med så lite spill som möjligt</li><li><b>%</b> – spill som läggs på mängden</li><li>Ett nytt pris räknar om alla projekt direkt</li></ul></div></nav>' +
        '<div class="rutnat">' +
          '<section class="kort"><header class="kort__huvud"><h2>' + e(rc.namn) + '</h2>' + (rc.tjocklek ? '<small>' + BP.tal(rc.tjocklek * 1000, 0) + ' mm</small>' : '') + '</header>' +
            '<div class="kort__kropp"><h3 style="font-size:12px;font-weight:600;color:var(--text-3);margin-bottom:8px">Uppbyggnad, inifrån och ut</h3><div class="kap">' + rc.skikt.map(function (s, n) { return '<span><span class="pos" style="min-width:22px;height:18px;font-size:11px">' + (n + 1) + '</span>' + e(s) + '</span>'; }).join('') + '</div></div>' +
            '<table class="tabell"><thead><tr><th style="padding-left:16px">Material</th><th>Räknas som</th><th>Parametrar</th><th class="tal-c">Spill</th></tr></thead><tbody>' +
            rc.rader.map(function (r) {
              var m = MAT[r.material] || { namn: r.material };
              var par = [];
              if (r.cc) par.push('c/c ' + BP.tal(r.cc) + ' m');
              if (r.tackbredd) par.push('täckbredd ' + BP.tal(r.tackbredd) + ' m');
              if (r.format) par.push(BP.tal(r.format.bredd * 1000, 0) + ' × ' + BP.tal(r.format.langd * 1000, 0) + ' mm' + (r.sidor ? ', ' + r.sidor + ' sidor' : ''));
              if (r.antal) par.push(r.antal + ' st');
              if (r.per) par.push('1 ' + (r.enhet || 'st') + ' per ' + BP.tal(r.per) + ' m²');
              if (r.extraPerOppning) par.push('+' + r.extraPerOppning + ' per öppning');
              if (r.bara) par.push(r.bara === 'dorr' ? 'bara dörrar' : 'bara fönster');
              if (r.not) par.push(r.not);
              return '<tr><td style="padding-left:16px"><b>' + e(m.namn) + '</b><small>' + e(m.artikel || '') + '</small></td><td>' + (REGELTEXT[r.regel] || r.regel) + '</td><td>' + e(par.join(' · ') || '–') + '</td><td class="tal-c">' + (m.kapas ? 'kapoptimeras' : BP.tal(m.spill || 0, 0) + ' %') + '</td></tr>';
            }).join('') + '</tbody></table></section>' +
          '<section class="kort"><header class="kort__huvud"><h2>Material och exempelpriser</h2><small>' + Object.keys(MAT).length + ' artiklar</small></header>' +
            '<table class="tabell tabell--svar"><thead><tr><th style="padding-left:16px">Material</th><th>Grupp</th><th class="tal-c">Spill</th><th class="tal-c">Pris (exempel)</th></tr></thead><tbody>' +
            Object.keys(MAT).map(function (id) {
              var m = MAT[id];
              return '<tr><td style="padding-left:16px"><b>' + e(m.namn) + '</b><small>' + e(m.artikel) + (m.forpackning ? ' · ' + BP.tal(m.forpackning.innehall) + ' ' + m.enhet + ' per ' + m.forpackning.namn : '') + '</small></td><td class="dolj-mobil">' + e(m.grupp) + '</td>' +
                '<td class="tal-c">' + (m.kapas ? 'kapas' : BP.tal(m.spill || 0, 0) + ' %') + '</td><td class="tal-c"><input class="inmatning inmatning--tal" type="number" min="0" step="1" value="' + m.pris + '" data-pris="' + id + '" aria-label="Pris för ' + e(m.namn) + '"> <span class="enhet">kr/' + e(m.forpackning ? m.forpackning.namn : m.enhet) + '</span></td></tr>';
            }).join('') + '</tbody></table></section>' +
        '</div></div>';
    return {
      titel: 'Recept och material', html: html,
      efter: function (rot) {
        $$('[data-pris]', rot).forEach(function (inp) {
          inp.addEventListener('change', function () {
            var v = Math.max(0, parseFloat(inp.value) || 0);
            if (!BP.db.material) BP.db.material = JSON.parse(JSON.stringify(D.MATERIAL));
            BP.db.material[inp.getAttribute('data-pris')].pris = v;
            BP.spara();
            BP.toast('Priset är sparat', BP.db.material[inp.getAttribute('data-pris')].namn + ' · ' + BP.tal(v) + ' kr');
          });
        });
      }
    };
  };
  G['recept-valj'] = function (el) { receptVal = el.getAttribute('data-id'); BP.rita(); };
  G.aterstall = function (el) {
    if (el.getAttribute('data-sakert') !== '1') {
      el.setAttribute('data-sakert', '1');
      el.innerHTML = i('varning') + 'Klicka igen för att återställa';
      setTimeout(function () { if (document.body.contains(el)) { el.removeAttribute('data-sakert'); el.innerHTML = i('vrid') + 'Återställ exempeldata'; } }, 4000);
      return;
    }
    BP.aterstall();
    BP.toast('Exempeldatan är återställd', 'Alla projekt och priser är som från början');
  };
})();
