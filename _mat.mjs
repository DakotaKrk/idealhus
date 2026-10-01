// Mäter bildrutor medan sidan rullar bakåt upp genom toppen.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9900 + Math.floor(Math.random() * 90);
const edge = spawn(EDGE, ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'm-'))}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
let lista; for (let f = 0; f < 50; f++) { try { lista = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (lista.length) break; } catch {} await vanta(200); }
const ws = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const svar = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && svar.has(m.id)) { svar.get(m.id)(m.result); svar.delete(m.id); } });
const skicka = (method, params = {}) => new Promise((res) => { const i = ++id; svar.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await skicka('Page.enable');
await skicka('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await skicka('Page.navigate', { url }); await vanta(4000);
if (process.argv[3]) await skicka('Runtime.evaluate', { expression: process.argv[3], awaitPromise: true });
const js = `(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  const s = document.querySelector('.film__spar');
  const slut = s.offsetHeight + 1400;
  window.scrollTo(0, slut); await new Promise(r => setTimeout(r, 800));
  const tider = []; let forra = performance.now();
  let lang = 0;
  const po = new PerformanceObserver(l => { for (const e of l.getEntries()) lang += e.duration; });
  try { po.observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}
  for (let y = slut; y >= 0; y -= 22) {
    window.scrollTo(0, y);
    await new Promise(r => requestAnimationFrame(r));
    const nu = performance.now(); tider.push(nu - forra); forra = nu;
  }
  po.disconnect();
  tider.shift();
  tider.sort((a, b) => a - b);
  const snitt = tider.reduce((a, b) => a + b, 0) / tider.length;
  return { rutor: tider.length, snitt: +snitt.toFixed(1), median: +tider[tider.length >> 1].toFixed(1),
    p95: +tider[Math.floor(tider.length * 0.95)].toFixed(1), max: +tider[tider.length - 1].toFixed(1),
    over25: tider.filter(t => t > 25).length, langaRutorMs: Math.round(lang) };
})()`;
for (let k = 0; k < 1; k++) {
  const r = await skicka('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.value));
}
ws.close(); edge.kill();
