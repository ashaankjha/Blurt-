/**
 * CI content validation: every bundled pack passes the Zod schema, the manifest matches the
 * pack files, and launch thresholds hold (30+ packs incl. the virtual Everything Mix,
 * 10,000+ unique phrases across all packs).
 *
 *   npx tsx scripts/gen-packs/validate.ts                      # full launch check
 *   npx tsx scripts/gen-packs/validate.ts --allow-incomplete   # schema only (pre-content)
 */
import fs from 'node:fs';
import path from 'node:path';

import { normalizePhraseKey, PackSchema, type Pack, type PackMeta } from '../../content/schema';
import { checkRules } from './lib';
import { PACKS } from './packs';

const OUT_DIR = path.resolve(__dirname, '../../content/packs');
const MIN_PACKS = 30;
const MIN_UNIQUE = 10_000;

const allowIncomplete = process.argv.includes('--allow-incomplete');
const errors: string[] = [];
const unique = new Set<string>();

const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
const manifest: PackMeta[] = fs.existsSync(path.join(OUT_DIR, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'manifest.json'), 'utf8'))
  : [];
const known = new Map(PACKS.map((p) => [p.id, p]));

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
  const res = PackSchema.safeParse(raw);
  if (!res.success) {
    errors.push(
      `${f}: ${res.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
    continue;
  }
  const pack: Pack = res.data;
  if (`${pack.id}.json` !== f) errors.push(`${f}: id "${pack.id}" does not match filename`);
  if (!known.has(pack.id)) errors.push(`${f}: not listed in scripts/gen-packs/packs.ts`);
  const adult = pack.tags.includes('adult');
  for (const p of pack.phrases) {
    const reason = checkRules(p.text, adult);
    if (reason) errors.push(`${f}: "${p.text}" ${reason}`);
    unique.add(normalizePhraseKey(p.text));
  }
  const meta = manifest.find((m) => m.id === pack.id);
  if (!meta) errors.push(`${f}: missing from manifest.json (run build.ts)`);
  else if (meta.phraseCount !== pack.phrases.length || meta.version !== pack.version)
    errors.push(`${f}: manifest.json is stale (run build.ts)`);
}
for (const m of manifest) if (!files.includes(`${m.id}.json`)) errors.push(`manifest.json lists missing pack ${m.id}`);

const packCount = files.length + 1; // + virtual everything-mix
if (!allowIncomplete) {
  if (packCount < MIN_PACKS) errors.push(`only ${packCount} packs (need ${MIN_PACKS}+)`);
  if (unique.size < MIN_UNIQUE) errors.push(`only ${unique.size} unique phrases (need ${MIN_UNIQUE}+)`);
}

console.log(`${files.length} pack files (+1 virtual) · ${unique.size} unique phrases`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('✓ content valid');
