// Gör en sprängskiss-version av ett hus i GLB. Det som texten på
// startsidan säger ska synas på huset:
//   Grunden  – tomten, grusbädden och plintarna (kundens del) sjunker.
//   Väggarna – väggblocken (fogar i fasaden), fönster och dörrar står
//              kvar; när taket lyfter syns isoleringen och träramen uppe
//              på väggarna.
//   Taket    – takstolarna (tvärbalk + två sparrar per stol) följer en
//              bit efter taket, och ett lyftok med slingor kommer ner
//              från kranen och fäster i nocken.
// Balkar, isolering, plattor och lyftoket finns inte i originalet - de
// byggs här som enkla lådor som är osynliga när huset står ihop (inuti
// huset, eller ovanför bilden) och syns när delarna dras isär. Materialen
// justeras så att fasad, plåttak, glas och betong läses som material.
// Noderna i originalet har en matris - den delas upp i translation,
// rotation och skala så att en animation får styra translationen.
// Resultatet får en animation "sprang" på 1 s som sidan spolar med
// rullningen.
//   node _sprang.mjs in.glb ut.glb
import { readFileSync, writeFileSync } from 'node:fs';

const [inn, ut] = process.argv.slice(2);
const LYFT = { tak: 2.8, balk: 1.4, vagg: 0, golv: -0.6, grund: -1.25, kran: -2.2 };
const b = readFileSync(inn);
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jsonLen).toString());
const binLen = b.readUInt32LE(20 + jsonLen);
const bin = b.slice(28 + jsonLen, 28 + jsonLen + binLen);

function dela(m) {
  const t = [m[12], m[13], m[14]];
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const m00 = m[0] / sx, m10 = m[1] / sx, m20 = m[2] / sx, m01 = m[4] / sy, m11 = m[5] / sy, m21 = m[6] / sy, m02 = m[8] / sz, m12 = m[9] / sz, m22 = m[10] / sz;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return { t, q, s: [sx, sy, sz] };
}

// --- Materialen: läsbara ytor i stället för nästan svart överallt.
const matNamn = j.materials.map((m) => (m.name || '').toLowerCase());
const takMat = matNamn.indexOf('tak');
function satt(i, farg, metall, grov, namn) {
  const m = j.materials[i];
  m.pbrMetallicRoughness = m.pbrMetallicRoughness || {};
  m.pbrMetallicRoughness.baseColorFactor = farg;
  m.pbrMetallicRoughness.metallicFactor = metall;
  m.pbrMetallicRoughness.roughnessFactor = grov;
  if (namn && !m.name) m.name = namn;
}
// Ordningen i Idealhus GLB: 0 plintar, 1 fasad, 2 tak, 3 panel, 4 karmar, 5 glas, 6 dörr.
if (j.materials[0]) satt(0, [0.64, 0.62, 0.59, 1], 0, 0.9, 'betong');
if (j.materials[1]) satt(1, [0.045, 0.042, 0.04, 1], 0, 0.82, 'fasad');
if (j.materials[2]) satt(2, [0.13, 0.14, 0.16, 1], 0.5, 0.4, 'tak');
if (j.materials[3]) satt(3, [0.065, 0.06, 0.055, 1], 0, 0.78, 'panel');
if (j.materials[4]) satt(4, [0.07, 0.07, 0.07, 1], 0.1, 0.6, 'karm');
if (j.materials[5]) satt(5, [0.52, 0.64, 0.7, 1], 0.3, 0.06, 'glas');
if (j.materials[6]) satt(6, [0.09, 0.085, 0.08, 1], 0, 0.7, 'dorr');
function nyttMaterial(name, farg, metall, grov) {
  return j.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: farg, metallicFactor: metall, roughnessFactor: grov } }) - 1;
}
const MAT_TRA = nyttMaterial('tra', [0.80, 0.64, 0.42, 1], 0, 0.85);
const MAT_SKIVA = nyttMaterial('golvskiva', [0.86, 0.76, 0.58, 1], 0, 0.9);
const MAT_ISO = nyttMaterial('isolering', [0.93, 0.9, 0.82, 1], 0, 1);
const MAT_FOG = nyttMaterial('fog', [0.16, 0.15, 0.14, 1], 0, 0.8);
const MAT_GRAS = nyttMaterial('gras', [0.58, 0.68, 0.52, 1], 0, 1);
const MAT_GRUS = nyttMaterial('grus', [0.72, 0.7, 0.66, 1], 0, 1);
const MAT_STAL = nyttMaterial('stal', [0.22, 0.22, 0.23, 1], 0.7, 0.45);
const MAT_SLING = nyttMaterial('slinga', [0.85, 0.6, 0.15, 1], 0, 0.8);

// --- Husets mått ur geometrin.
let gmin = [Infinity, Infinity, Infinity], gmax = [-Infinity, -Infinity, -Infinity];
let vmin = [Infinity, Infinity, Infinity], vmax = [-Infinity, -Infinity, -Infinity];
let takMin = Infinity, takZ = [Infinity, -Infinity];
j.nodes.forEach((n) => {
  if (n.mesh === undefined) return;
  const p = j.meshes[n.mesh].primitives[0];
  const a = j.accessors[p.attributes.POSITION];
  const t = n.matrix ? [n.matrix[12], n.matrix[13], n.matrix[14]] : (n.translation || [0, 0, 0]);
  for (let k = 0; k < 3; k++) { gmin[k] = Math.min(gmin[k], a.min[k] + t[k]); gmax[k] = Math.max(gmax[k], a.max[k] + t[k]); }
  if (p.material === 1) for (let k = 0; k < 3; k++) { vmin[k] = Math.min(vmin[k], a.min[k] + t[k]); vmax[k] = Math.max(vmax[k], a.max[k] + t[k]); }
  if (p.material === takMat) { takMin = Math.min(takMin, a.min[1] + t[1]); takZ = [Math.min(takZ[0], a.min[2] + t[2]), Math.max(takZ[1], a.max[2] + t[2])]; }
});
function lager(n) {
  if (n.mesh === undefined) return 'vagg';
  const p = j.meshes[n.mesh].primitives[0];
  const a = j.accessors[p.attributes.POSITION];
  if (p.material === takMat) return 'tak';
  if (a.max[1] <= gmin[1] + 0.25) return 'grund';
  return 'vagg';
}

// --- Ny binärdata.
const extra = [];
let offset = (binLen + 3) & ~3;
const pad = offset - binLen;
function lagg(buf) { const o = offset; extra.push(buf); offset += buf.length; const rest = (4 - (buf.length % 4)) % 4; if (rest) { extra.push(Buffer.alloc(rest)); offset += rest; } return o; }
function bufferView(byteLength, byteOffset, target) { j.bufferViews.push({ buffer: 0, byteOffset, byteLength, target }); return j.bufferViews.length - 1; }

// En låda centrerad i origo, med normaler, som egen nod på plats (cx, cy, cz),
// eventuellt vriden kring x-axeln (vinkel i radianer).
const nyaNoder = [];
function lada(cx, cy, cz, sx, sy, sz, material, lagerNamn, namn, rotX) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const sidor = [
    [[1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]]
  ];
  const pos = Buffer.alloc(24 * 12), nor = Buffer.alloc(24 * 12), idx = Buffer.alloc(36 * 2);
  let vi = 0, ii = 0;
  sidor.forEach(([n, hörn]) => {
    const start = vi;
    hörn.forEach((h) => { h.forEach((v, k) => pos.writeFloatLE(v, (vi * 3 + k) * 4)); n.forEach((v, k) => nor.writeFloatLE(v, (vi * 3 + k) * 4)); vi++; });
    [0, 1, 2, 0, 2, 3].forEach((o) => { idx.writeUInt16LE(start + o, ii * 2); ii++; });
  });
  const pv = bufferView(pos.length, lagg(pos), 34962), nv = bufferView(nor.length, lagg(nor), 34962), iv = bufferView(idx.length, lagg(idx), 34963);
  j.accessors.push({ bufferView: pv, componentType: 5126, count: 24, type: 'VEC3', min: [-hx, -hy, -hz], max: [hx, hy, hz] });
  const pa = j.accessors.length - 1;
  j.accessors.push({ bufferView: nv, componentType: 5126, count: 24, type: 'VEC3' });
  const na = j.accessors.length - 1;
  j.accessors.push({ bufferView: iv, componentType: 5123, count: 36, type: 'SCALAR' });
  const ia = j.accessors.length - 1;
  j.meshes.push({ name: namn, primitives: [{ attributes: { POSITION: pa, NORMAL: na }, indices: ia, material }] });
  const rot = rotX ? [Math.sin(rotX / 2), 0, 0, Math.cos(rotX / 2)] : [0, 0, 0, 1];
  j.nodes.push({ name: namn, mesh: j.meshes.length - 1, translation: [cx, cy, cz], rotation: rot, scale: [1, 1, 1] });
  const ni = j.nodes.length - 1;
  j.scenes[0].nodes.push(ni);
  nyaNoder.push({ ni, lager: lagerNamn });
}

// Väggarnas fotavtryck och höjder.
const x0 = vmin[0], x1 = vmax[0], z0 = vmin[2], z1 = vmax[2];
const golvY = gmin[1] + 0.2;          // ovanpå plintarna
const nock = gmax[1];                 // takets topp
const bredd = x1 - x0, djup = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
const IN = 0.2;

// --- Grunden: gräsmatta, grusbädd (kundens del) under plintarna.
lada(mx, gmin[1] - 0.11, mz, bredd + 3.6, 0.06, djup + 3.2, MAT_GRAS, 'grund', 'tomt');
lada(mx, gmin[1] - 0.04, mz, bredd + 0.6, 0.08, djup + 0.6, MAT_GRUS, 'grund', 'grusbadd');

// --- Golvbjälklag: bjälkar tvärs över, isolering emellan, skiva ovanpå.
const bj = 0.045, bjH = 0.2;
const antalBj = Math.max(6, Math.round(bredd / 0.6));
for (let i = 0; i <= antalBj; i++) {
  const x = x0 + IN + (bredd - 2 * IN) * (i / antalBj);
  lada(x, golvY + bjH / 2, mz, bj, bjH, djup - 2 * IN, MAT_TRA, 'golv', 'bjalke' + i);
}
lada(mx, golvY + bjH / 2, mz, bredd - 2 * IN - 0.04, bjH - 0.06, djup - 2 * IN - 0.04, MAT_ISO, 'golv', 'golvisolering');
lada(mx, golvY + bjH + 0.012, mz, bredd - 2 * IN, 0.024, djup - 2 * IN, MAT_SKIVA, 'golv', 'golvskiva');
lada(mx, golvY + bjH / 2, z0 + IN, bredd - 2 * IN, bjH, bj, MAT_TRA, 'golv', 'kantbalk0');
lada(mx, golvY + bjH / 2, z1 - IN, bredd - 2 * IN, bjH, bj, MAT_TRA, 'golv', 'kantbalk1');

// --- Väggarna: fogar mellan väggblocken på långsidorna, och uppe på
// väggarna en träram med isolering som syns när taket lyfter.
const block = Math.max(2, Math.round(bredd / 2.4));
for (let i = 1; i < block; i++) {
  const x = x0 + bredd * (i / block);
  lada(x, (golvY + takMin) / 2, z0 - 0.004, 0.03, takMin - golvY - 0.2, 0.02, MAT_FOG, 'vagg', 'fog' + i + 'a');
  lada(x, (golvY + takMin) / 2, z1 + 0.004, 0.03, takMin - golvY - 0.2, 0.02, MAT_FOG, 'vagg', 'fog' + i + 'b');
}
const ramY = takMin - 0.19;           // ramen strax under takfoten
lada(mx, ramY, z0 + IN, bredd - 2 * IN, 0.1, 0.045, MAT_TRA, 'vagg', 'syll0');
lada(mx, ramY, z1 - IN, bredd - 2 * IN, 0.1, 0.045, MAT_TRA, 'vagg', 'syll1');
lada(x0 + IN, ramY, mz, 0.045, 0.1, djup - 2 * IN, MAT_TRA, 'vagg', 'syll2');
lada(x1 - IN, ramY, mz, 0.045, 0.1, djup - 2 * IN, MAT_TRA, 'vagg', 'syll3');
lada(mx, ramY - 0.005, mz, bredd - 2 * IN - 0.05, 0.09, djup - 2 * IN - 0.05, MAT_ISO, 'vagg', 'vindsisolering');

// --- Taket: takstolar (tvärbalk + två sparrar) och nockbalk. Sparrarna
// följer takets undersida, som läses ur takmaskens hörn: för ett avstånd
// från nocken tas den lägsta punkten på taket där.
function horn(ni) {
  const n = j.nodes[ni];
  const p = j.meshes[n.mesh].primitives[0];
  const a = j.accessors[p.attributes.POSITION];
  const bv = j.bufferViews[a.bufferView];
  const steg = bv.byteStride || 12;
  const bas = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const t = n.matrix ? [n.matrix[12], n.matrix[13], n.matrix[14]] : (n.translation || [0, 0, 0]);
  const ut = [];
  for (let i = 0; i < a.count; i++) {
    const o = bas + i * steg;
    ut.push([bin.readFloatLE(o) + t[0], bin.readFloatLE(o + 4) + t[1], bin.readFloatLE(o + 8) + t[2]]);
  }
  return ut;
}
const takNod = j.nodes.findIndex((n) => n.mesh !== undefined && j.meshes[n.mesh].primitives[0].material === takMat);
const takHorn = horn(takNod);
function undersida(avstand) {
  // Lägsta takpunkt på ungefär det här avståndet från nocken (symmetriskt).
  let y = Infinity, bast = Infinity;
  takHorn.forEach((h) => {
    const d = Math.abs(Math.abs(h[2] - mz) - avstand);
    if (d < bast - 1e-6 || (Math.abs(d - bast) < 1e-6 && h[1] < y)) { bast = d; y = h[1]; }
  });
  // Ta alla punkter på samma avstånd och välj den lägsta.
  takHorn.forEach((h) => { if (Math.abs(Math.abs(h[2] - mz) - avstand) < bast + 0.02) y = Math.min(y, h[1]); });
  return y;
}
// Takets undersida är ett plan från nockens undersida (vid z = 0) ner till
// takfotens lägsta punkt (vid takets ytterkant). Sparrarna läggs 17 cm
// under det planet, från en bit innanför väggen upp till strax före nocken.
const halvDjup = (takZ[1] - takZ[0]) / 2;
const nockUnder = undersida(0), fotUnder = undersida(halvDjup);
const underLinje = (z) => nockUnder + (fotUnder - nockUnder) * (z / halvDjup);
const yttre = djup / 2 - IN - 0.15, inre = 0.22;
const yUte = underLinje(yttre) - 0.17, yInne = underLinje(inre) - 0.17;
const sparrLangd = Math.hypot(yttre - inre, yInne - yUte);
const vinkel = Math.atan2(yInne - yUte, yttre - inre);
const antalB = Math.max(5, Math.round(bredd / 1.2));
for (let i = 0; i <= antalB; i++) {
  const x = x0 + IN + (bredd - 2 * IN) * (i / antalB);
  lada(x, takMin - 0.06, mz, 0.045, 0.12, djup - 2 * IN, MAT_TRA, 'balk', 'tvarbalk' + i);
  const zMitt = (yttre + inre) / 2, yMitt = (yUte + yInne) / 2;
  lada(x, yMitt, mz + zMitt, 0.045, 0.14, sparrLangd, MAT_TRA, 'balk', 'sparre' + i + 'a', -vinkel);
  lada(x, yMitt, mz - zMitt, 0.045, 0.14, sparrLangd, MAT_TRA, 'balk', 'sparre' + i + 'b', vinkel);
}
lada(mx, undersida(0) - 0.12, mz, bredd - 2 * IN, 0.14, 0.05, MAT_TRA, 'balk', 'nockbalk');
console.log('takets undersida: vid vägg', undersida(yttre).toFixed(2), 'vid nock', undersida(0).toFixed(2), 'lutning', (vinkel * 180 / Math.PI).toFixed(1) + '°');

// --- Kranen: lyftok och slingor som kommer ner till nocken. Står ovanför
// bilden när huset är helt och sänks medan taket lyfter.
const okY = nock + LYFT.tak + 0.9 - LYFT.kran;   // hamnar 0,9 m över nocken när allt är isär
lada(mx, okY, mz, bredd * 0.6, 0.12, 0.12, MAT_STAL, 'kran', 'lyftok');
lada(mx, okY + 1.6, mz, 0.05, 3.2, 0.05, MAT_STAL, 'kran', 'kranlina');
lada(mx, okY + 0.2, mz, 0.3, 0.3, 0.3, MAT_STAL, 'kran', 'krok');
[-1, 1].forEach((s, i) => {
  // Slingor från okets ändar snett ner mot nocken.
  const dx = bredd * 0.3 - bredd * 0.18, dy = 0.9 - 0.06;
  const l = Math.hypot(dx, dy);
  const v = Math.atan2(dx, dy);
  const node = j.nodes.length;
  lada(mx + s * (bredd * 0.3 - dx / 2), okY - dy / 2, mz, 0.04, l, 0.04, MAT_SLING, 'kran', 'slinga' + i);
  // Vridningen kring z-axeln sätts direkt på noden (lada vrider bara kring x).
  j.nodes[node].rotation = [0, 0, Math.sin(s * v / 2), Math.cos(s * v / 2)];
});

// --- Animationen: en translation-bana per rörlig nod.
const tider = Buffer.alloc(8); tider.writeFloatLE(0, 0); tider.writeFloatLE(1, 4);
const tidAcc = (j.accessors.push({ bufferView: bufferView(8, lagg(tider)), componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] }), j.accessors.length - 1);
const kanaler = [], samplers = [];
const antal = { tak: 0, balk: 0, vagg: 0, golv: 0, grund: 0, kran: 0 };
function bana(ni, lagerNamn) {
  const n = j.nodes[ni];
  const dy = LYFT[lagerNamn];
  antal[lagerNamn]++;
  if (!dy) return;
  const t0 = n.translation || [0, 0, 0];
  const buf = Buffer.alloc(24);
  [t0[0], t0[1], t0[2], t0[0], t0[1] + dy, t0[2]].forEach((v, k) => buf.writeFloatLE(v, k * 4));
  j.accessors.push({ bufferView: bufferView(24, lagg(buf)), componentType: 5126, count: 2, type: 'VEC3' });
  samplers.push({ input: tidAcc, output: j.accessors.length - 1, interpolation: 'LINEAR' });
  kanaler.push({ sampler: samplers.length - 1, target: { node: ni, path: 'translation' } });
}
const antalGamla = j.nodes.length - nyaNoder.length;
for (let i = 0; i < antalGamla; i++) {
  const n = j.nodes[i];
  if (n.matrix) { const d = dela(n.matrix); delete n.matrix; n.translation = d.t; n.rotation = d.q; n.scale = d.s; }
  bana(i, lager(n));
}
nyaNoder.forEach((x) => bana(x.ni, x.lager));
j.animations = [{ name: 'sprang', samplers, channels: kanaler }];
j.buffers[0].byteLength = offset;

const nyBin = Buffer.concat([bin, Buffer.alloc(pad), ...extra]);
let jsonStr = JSON.stringify(j);
while (jsonStr.length % 4) jsonStr += ' ';
const jsonBuf = Buffer.from(jsonStr);
const huvud = Buffer.alloc(12); huvud.write('glTF', 0); huvud.writeUInt32LE(2, 4); huvud.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + nyBin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(nyBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(ut, Buffer.concat([huvud, jh, jsonBuf, bh, nyBin]));
console.log('skrev', ut, 'noder', j.nodes.length, 'lager', JSON.stringify(antal), 'kanaler', kanaler.length,
  'lutning', (vinkel * 180 / Math.PI).toFixed(1) + '°', 'takfot', takMin.toFixed(2), 'nock', nock.toFixed(2), 'bytes', 12 + 8 + jsonBuf.length + 8 + nyBin.length);
