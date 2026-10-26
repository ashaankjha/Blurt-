/**
 * Dev tool: prints advance widths (em) for printable ASCII from a TTF, used to regenerate
 * BALOO_EXTRABOLD_ADVANCE in ../phraseFit.ts if the phrase font changes.
 *   npx tsx src/ui/dev/fontMetrics.ts node_modules/@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf
 * Not imported by the app.
 */
import { readFileSync } from 'fs';

const file = process.argv[2];
const buf = readFileSync(file);
const u16 = (o: number) => buf.readUInt16BE(o);
const i16 = (o: number) => buf.readInt16BE(o);
const u32 = (o: number) => buf.readUInt32BE(o);
const numTables = u16(4);
const tables: Record<string, number> = {};
for (let i = 0; i < numTables; i++) {
  const rec = 12 + i * 16;
  const tag = buf.toString('ascii', rec, rec + 4);
  tables[tag] = u32(rec + 8);
}
const unitsPerEm = u16(tables.head + 18);
const numHMetrics = u16(tables.hhea + 34);
const ascender = i16(tables.hhea + 4);
const descender = i16(tables.hhea + 6);
const lineGap = i16(tables.hhea + 8);
const adv = (gid: number) => u16(tables.hmtx + 4 * Math.min(gid, numHMetrics - 1));

// cmap format 4
const cmap = tables.cmap;
const n = u16(cmap + 2);
let sub = -1;
for (let i = 0; i < n; i++) {
  const pid = u16(cmap + 4 + i * 8);
  const eid = u16(cmap + 6 + i * 8);
  const off = u32(cmap + 8 + i * 8);
  if (pid === 3 && eid === 1) sub = cmap + off;
}
if (sub < 0 || u16(sub) !== 4) throw new Error('no fmt4');
const segX2 = u16(sub + 6);
const endO = sub + 14;
const startO = endO + segX2 + 2;
const deltaO = startO + segX2;
const rangeO = deltaO + segX2;
function gid(cp: number): number {
  for (let i = 0; i < segX2 / 2; i++) {
    const end = u16(endO + i * 2);
    if (cp > end) continue;
    const start = u16(startO + i * 2);
    if (cp < start) return 0;
    const delta = i16(deltaO + i * 2);
    const ro = u16(rangeO + i * 2);
    if (ro === 0) return (cp + delta) & 0xffff;
    const g = u16(rangeO + i * 2 + ro + (cp - start) * 2);
    return g === 0 ? 0 : (g + delta) & 0xffff;
  }
  return 0;
}
const out: Record<string, number> = {};
for (let cp = 32; cp < 127; cp++) out[String.fromCharCode(cp)] = +(adv(gid(cp)) / unitsPerEm).toFixed(3);
console.log(JSON.stringify({ unitsPerEm, ascender, descender, lineGap, out }));
