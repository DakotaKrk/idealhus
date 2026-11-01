/* ============================================================
   Legohus CRM – hjälpassistentens figur (2026-11-01).
   Ett litet hus som lever: fönsterögon som blinkar, en dörr som
   pratar och en skorsten som lyser och puffar. Tillstånd: vila,
   lyssnar, tanker, svarar. Figuren är assistentens knapp och kliver upp
   i panelen, så det finns bara en canvas och en WebGL-kontext.
   Den ritar inte hela tiden: i vila står den still och gör en kort
   gest (blinkar, tittar upp) med några sekunders mellanrum, högst 24
   bilder/s. Vinkar när man pekar på den. Andningen i vila sköts av CSS.
   start() och stopp() styr all ritning. Med stilla: true ritas en bild.
   ============================================================ */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';

const LAGE = {
  vila: { lut: 0, sida: 0, studs: 0.018, fart: 1.6, oga: 1, skorsten: 0.25, blick: [0, 0], lock: 0 },
  lyssnar: { lut: 0.16, sida: 0.09, studs: 0.012, fart: 2.2, oga: 1.14, skorsten: 0.8, blick: [0, -0.01], lock: 0.02 },
  tanker: { lut: -0.1, sida: -0.22, studs: 0.01, fart: 1.2, oga: 0.92, skorsten: 1, blick: [0.022, 0.024], lock: 0.05 },
  svarar: { lut: 0.04, sida: 0.04, studs: 0.05, fart: 6.5, oga: 1.04, skorsten: 0.6, blick: [0, 0], lock: 0 }
};
const farg = (namn, reserv) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(namn).trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v.slice(0, 7) : reserv;
};
const narma = (a, b, k) => a + (b - a) * k;

export function skapa(canvas, { stilla: stillaStart = false, sida = 176 } = {}) {
  let stilla = stillaStart;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true }); } catch { return null; }
  r.setPixelRatio(1);
  r.setSize(sida, sida, false);
  r.outputColorSpace = THREE.SRGBColorSpace;

  const sc = new THREE.Scene();
  const kam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  kam.position.set(0, 0.34, 4.5);
  kam.lookAt(0, 0.12, 0);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x9a8870, 1.9));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.1);
  sol.position.set(1.8, 3, 3.2);
  sc.add(sol);

  const mt = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0, ...x });
  const M = {
    kropp: mt(farg('--t-krita', '#f7f5f0')), tak: mt(farg('--t-accent-djup', '#8f5424')), kant: mt(farg('--t-accent', '#e29a4a')),
    oga: mt('#ffffff', { roughness: 0.3 }), pupill: mt('#1b1915', { roughness: 0.25 }), dorr: mt(farg('--t-accent', '#e29a4a')),
    mork: mt('#1b1915'), fot: mt(farg('--t-accent-djup', '#8f5424')),
    lampa: new THREE.MeshStandardMaterial({ color: '#ffc23d', emissive: '#ffaa50', emissiveIntensity: 0.4 }), puff: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
  };
  const nat = (g, m, p, f) => { const x = new THREE.Mesh(g, m); if (p) x.position.set(...p); (f || figur).add(x); return x; };

  const figur = new THREE.Group();
  sc.add(figur);
  const rund = (b, h, d, rad = 0.09) => new RoundedBoxGeometry(b, h, d, 3, rad);

  // Kropp och grund
  nat(rund(1.2, 0.92, 1.02, 0.12), M.kropp, [0, 0, 0]);
  nat(rund(1.28, 0.09, 1.1, 0.04), M.kant, [0, -0.47, 0]);
  // Fötter
  const fotV = nat(rund(0.3, 0.14, 0.42, 0.06), M.fot, [-0.32, -0.58, 0.04]);
  const fotH = nat(rund(0.3, 0.14, 0.42, 0.06), M.fot, [0.32, -0.58, 0.04]);

  // Armen är instoppad längs kroppen och kommer fram när figuren vinkar
  const arm = new THREE.Group(); arm.position.set(0.6, 0.02, 0.12); figur.add(arm);
  nat(rund(0.13, 0.36, 0.13, 0.055), M.kant, [0, -0.16, 0], arm);

  // Taket: två lutande plankor och en gavel, grupperat så att det kan lyfta lite när figuren tänker
  const tak = new THREE.Group();
  tak.position.y = 0.44;
  figur.add(tak);
  const lutning = 0.62;
  const plank = () => rund(0.98, 0.1, 1.28, 0.05);
  const tv = nat(plank(), M.tak, [-0.4, 0.27, 0], tak); tv.rotation.z = lutning;
  const th = nat(plank(), M.tak, [0.4, 0.27, 0], tak); th.rotation.z = -lutning;
  const gavel = new THREE.Shape(); gavel.moveTo(-0.66, 0); gavel.lineTo(0, 0.56); gavel.lineTo(0.66, 0); gavel.closePath();
  const gg = new THREE.ExtrudeGeometry(gavel, { depth: 1.0, bevelEnabled: false }); gg.translate(0, 0, -0.5);
  nat(gg, M.kropp, [0, -0.04, 0], tak);

  // Skorstenen med lampan
  const sk = nat(rund(0.2, 0.34, 0.2, 0.04), M.fot, [0.36, 0.48, -0.12], tak);
  nat(rund(0.26, 0.06, 0.26, 0.02), M.mork, [0.36, 0.66, -0.12], tak);
  const lampa = nat(new THREE.SphereGeometry(0.07, 16, 12), M.lampa, [0.36, 0.73, -0.12], tak);
  void sk;
  const puffar = [0, 1, 2].map(() => { const m = M.puff.clone(); const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), m); p.position.set(0.36, 0.8, -0.12); tak.add(p); return p; });

  // Ögonen är fönster med en rund pupill
  const ogon = [-0.27, 0.27].map((x) => {
    const g = new THREE.Group(); g.position.set(x, 0.14, 0.52); figur.add(g);
    nat(rund(0.31, 0.33, 0.04, 0.05), M.kant, [0, 0, -0.012], g);
    const v = nat(rund(0.25, 0.27, 0.05, 0.05), M.oga, [0, 0, 0], g);
    const p = nat(new THREE.SphereGeometry(0.075, 18, 14), M.pupill, [0, 0, 0.03], g);
    p.scale.z = 0.4;
    return { g, v, p };
  });

  // Dörren är munnen
  const dorr = nat(rund(0.3, 0.24, 0.04, 0.05), M.dorr, [0, -0.26, 0.52]);
  dorr.geometry.translate(0, 0.12, 0); dorr.position.y = -0.38;
  nat(new THREE.SphereGeometry(0.018, 10, 8), M.mork, [0.09, 0.13, 0.03], dorr);

  // Mjuk skugga under figuren
  const sk2 = document.createElement('canvas'); sk2.width = sk2.height = 64;
  const c2 = sk2.getContext('2d'); const gr = c2.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
  const skuggaT = new THREE.CanvasTexture(sk2);
  const skugga = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), new THREE.MeshBasicMaterial({ map: skuggaT, transparent: true, depthWrite: false }));
  skugga.rotation.x = -Math.PI / 2; skugga.position.y = -0.66; sc.add(skugga);

  let lage = 'vila', raf = 0, t = 0, forra = 0, nastaBlink = 2.2, blink = 0, kor = false, aktiv = false, gang = false;
  let gestTill = 0, tittaTill = 0, tittaSida = 0, vinkTill = 0, gestTimer = 0;
  const nu = { lut: 0, sida: 0, studs: 0.018, fart: 1.6, oga: 1, skorsten: 0.25, bx: 0, by: 0, lock: 0, tala: 0, vink: 0 };
  const klocka = () => performance.now();

  function posera(dt) {
    const m = LAGE[lage], k = stilla ? 1 : 1 - Math.pow(0.002, dt);
    nu.lut = narma(nu.lut, m.lut, k); nu.sida = narma(nu.sida, m.sida, k); nu.studs = narma(nu.studs, m.studs, k); nu.fart = narma(nu.fart, m.fart, k);
    nu.oga = narma(nu.oga, m.oga, k); nu.skorsten = narma(nu.skorsten, m.skorsten, k); nu.bx = narma(nu.bx, m.blick[0], k); nu.by = narma(nu.by, m.blick[1], k);
    nu.lock = narma(nu.lock, m.lock, k); nu.tala = narma(nu.tala, lage === 'svarar' ? 1 : 0, k);
    const ms = klocka(), tittar = !stilla && ms < tittaTill;
    if (tittar) { nu.by = narma(nu.by, 0.03, k); nu.bx = narma(nu.bx, tittaSida * 0.028, k); nu.sida = narma(nu.sida, tittaSida * 0.34, k); } else tittaSida = 0;
    nu.vink = narma(nu.vink, !stilla && ms < vinkTill ? 1 : 0, k);
    arm.rotation.z = nu.vink * (2.5 + Math.sin(t * 13) * 0.32);

    const v = stilla ? 0 : t * nu.fart;
    const hopp = Math.abs(Math.sin(v)) * nu.studs * (lage === 'svarar' ? 1 : 0.6);
    figur.position.y = 0.04 + hopp + (stilla ? 0 : Math.sin(t * 1.3) * 0.012);
    figur.rotation.x = nu.lut + (stilla ? 0 : Math.sin(t * 0.9) * 0.012);
    figur.rotation.y = -0.2 + nu.sida + (stilla ? 0 : Math.sin(t * 0.55) * 0.09);
    figur.rotation.z = stilla ? 0 : Math.sin(v * 0.5) * nu.studs * 0.7;
    skugga.material.opacity = 1 - hopp * 3;
    tak.position.y = 0.44 + nu.lock + (lage === 'tanker' && !stilla ? Math.abs(Math.sin(t * 2.6)) * 0.022 : 0);
    fotV.position.y = -0.58 + (stilla ? 0 : Math.max(0, Math.sin(v)) * nu.studs * 0.9);
    fotH.position.y = -0.58 + (stilla ? 0 : Math.max(0, -Math.sin(v)) * nu.studs * 0.9);

    // Blinkningar
    if (!stilla) {
      nastaBlink -= dt;
      if (nastaBlink <= 0) { blink = 1; nastaBlink = 2.2 + Math.random() * 3; }
      blink = Math.max(0, blink - dt * 7);
    }
    const oppet = Math.max(0.08, 1 - Math.sin(blink * Math.PI));
    ogon.forEach((o) => {
      o.g.scale.set(nu.oga, nu.oga * oppet, 1);
      o.p.position.x = nu.bx + (lage === 'tanker' && !stilla ? Math.sin(t * 1.4) * 0.016 : 0);
      o.p.position.y = nu.by;
    });
    // Dörren går upp och ner när figuren pratar
    dorr.scale.y = 1 - nu.tala * (stilla ? 0.1 : 0.34 + Math.sin(t * 11) * 0.3);
    M.lampa.emissiveIntensity = 0.3 + nu.skorsten * (1.4 + (stilla ? 0 : Math.sin(t * 3.4) * 0.5));
    puffar.forEach((p, i) => {
      const fas = stilla || lage !== 'tanker' ? -1 : (t * 0.5 + i / 3) % 1;
      p.visible = fas >= 0;
      if (fas >= 0) { p.position.y = 0.8 + fas * 0.5; p.position.x = 0.36 + Math.sin(fas * 5 + i) * 0.05; const sk3 = 0.6 + fas * 1.1; p.scale.setScalar(sk3); p.material.opacity = 0.75 * (1 - fas); }
    });
  }
  function rita() { r.render(sc, kam); }
  function behovs() { return aktiv || klocka() < gestTill; }
  function vack() {
    if (!kor || stilla) return;
    clearTimeout(gestTimer);
    if (gang) return;
    gang = true; forra = klocka();
    raf = requestAnimationFrame(ruta);
  }
  function ruta(ms) {
    if (!kor) { gang = false; return; }
    if (!behovs()) {
      // Inget händer: ingen ritning alls förrän nästa lilla gest
      gang = false;
      clearTimeout(gestTimer);
      gestTimer = setTimeout(gest, 3200 + Math.random() * 4200);
      return;
    }
    raf = requestAnimationFrame(ruta);
    if (ms - forra < 40) return; // högst 24 bilder i sekunden
    const dt = Math.min(0.08, (ms - forra) / 1000 || 0.04);
    forra = ms; t += dt;
    posera(dt);
    rita();
  }
  function gest() {
    if (!kor || stilla) return;
    const v = Math.random();
    if (v < 0.62) { blink = 1; gestTill = klocka() + 450; }
    else { tittaTill = klocka() + 1100; gestTill = klocka() + 1500; if (v > 0.85) blink = 1; }
    vack();
  }
  const api = {
    satt(l) { if (!LAGE[l] || l === lage) return; lage = l; gestTill = Math.max(gestTill, klocka() + 900); if (stilla) { if (kor) { posera(1); rita(); } } else vack(); },
    // Panelen är öppen: figuren lever hela tiden
    aktiv(p) { aktiv = !!p; if (aktiv) vack(); else gestTill = Math.max(gestTill, klocka() + 700); },
    vinka() { if (stilla) return; vinkTill = klocka() + 1300; gestTill = Math.max(gestTill, klocka() + 1700); vack(); },
    // Tittar mot bubblan (riktning -1 = åt vänster) och vänder sig lite ditåt
    pip(riktning = -1) { if (stilla) return; blink = 1; tittaSida = riktning; tittaTill = klocka() + 2400; gestTill = Math.max(gestTill, klocka() + 2800); vack(); },
    sattStilla(s) { stilla = !!s; if (kor) { api.stopp(); api.start(); } },
    start() {
      if (kor) return;
      kor = true;
      if (stilla) { posera(1); rita(); return; }
      posera(0.04); rita();
      gestTill = klocka() + 300;
      vack();
    },
    stopp() { kor = false; gang = false; cancelAnimationFrame(raf); clearTimeout(gestTimer); },
    ritar() { return gang; },
    igang() { return kor; },
    bild() { posera(0.04); rita(); return canvas.toDataURL('image/png'); },
    frigor() {
      api.stopp();
      sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach((m) => m.dispose());
      skuggaT.dispose();
      r.dispose();
      r.forceContextLoss();
    }
  };
  posera(1);
  return api;
}
