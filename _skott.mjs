// Skärmbilder via headless Edge + CDP. Användning:
//   node skott.mjs <url> <bredd> <höjd> <utmapp> <namn>:<js-före-bild> ...
// js-före-bild körs i sidan (t.ex. scrollTo) och sedan väntar vi en stund.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, bredd, hojd, ut, ...skott] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profil = mkdtempSync(join(tmpdir(), 'edgeprofil-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profil}`, `--window-size=${bredd},${hojd}`, 'about:blank'], { stdio: 'ignore' });

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const svar = new Map();
function skicka(method, params = {}) {
  return new Promise((res) => { const i = ++id; svar.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}
try {
  let lista;
  for (let f = 0; f < 50; f++) {
    try { lista = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (lista.length) break; } catch { }
    await vanta(200);
  }
  const sida = lista.find((t) => t.type === 'page');
  ws = new WebSocket(sida.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && svar.has(m.id)) { svar.get(m.id)(m.result); svar.delete(m.id); } });
  await skicka('Page.enable');
  await skicka('Emulation.setDeviceMetricsOverride', { width: +bredd, height: +hojd, deviceScaleFactor: 1, mobile: +bredd < 600 });
  if (+bredd < 600) await skicka('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await skicka('Page.navigate', { url });
  await vanta(3500);
  for (const s of skott) {
    const k = s.indexOf(':');
    const namn = s.slice(0, k), js = s.slice(k + 1);
    if (js) {
      const r = await skicka('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
      if (r && r.result && r.result.value !== undefined) console.log(namn, JSON.stringify(r.result.value));
    }
    await vanta(1400);
    const bild = await skicka('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    writeFileSync(join(ut, namn + '.jpg'), Buffer.from(bild.data, 'base64'));
  }
} finally {
  try { ws && ws.close(); } catch { }
  edge.kill();
}
