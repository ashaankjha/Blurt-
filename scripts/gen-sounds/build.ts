/**
 * Synthesize every Blurt! sound and write it into assets/sounds/.
 *
 *   npx tsx scripts/gen-sounds/build.ts              # all sounds
 *   npx tsx scripts/gen-sounds/build.ts kaboom tick  # only these ids (manifest still lists all)
 *   npx tsx scripts/gen-sounds/build.ts --keep-wav   # also keep 16-bit WAV masters in scripts/gen-sounds/out/
 *
 * Pipeline per sound: render (float, 44.1 kHz mono) -> master (DC block, fades, loudness match,
 * peak normalize; never clips) -> 16-bit PCM WAV. Latency-critical short sounds (tick, tock and
 * the quick UI sfx) ship as WAV (no codec priming delay, no decoder on Android); everything else
 * is transcoded with ffmpeg to AAC .m4a (96 kbps), which both iOS and Android play natively.
 *
 * Also writes src/audio/sounds.generated.ts (static requires for Metro) and assets/sounds/LICENSES.md.
 * Output is deterministic: each recipe has its own seeded PRNG.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { drive, gain, hashSeed, master, peak, rms, rng, SR, type Buf } from './dsp';
import { ALL_RECIPES, BUZZERS, SFX, TICKS, type Recipe } from './recipes';

const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'assets/sounds');
const MANIFEST = path.join(ROOT, 'src/audio/sounds.generated.ts');
const LICENSES = path.join(OUT_DIR, 'LICENSES.md');
const WAV_KEEP_DIR = path.join(__dirname, 'out');
const LICENSE_TEXT = 'Original, synthesized by scripts/gen-sounds; owned by the project, dedicated to CC0';

/** Sounds that must start instantly ship as WAV. */
const WAV_IDS = new Set(['tick', 'tock', 'gotIt', 'skip', 'point']);

const kebab = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

export function fileNameFor(recipe: Recipe): string {
  const ext = WAV_IDS.has(recipe.id) ? 'wav' : 'm4a';
  const prefix = recipe.kind === 'buzzer' ? 'buzzer-' : recipe.kind === 'sfx' ? 'sfx-' : '';
  return `${prefix}${kebab(recipe.id)}.${ext}`;
}

/** Lift quiet sounds toward a common loudness using a soft (tanh) limiter, max +6 dB. */
function loudnessMatch(b: Buf, targetRms: number): Buf {
  const current = rms(b);
  const g = Math.min(2, targetRms / Math.max(1e-6, current));
  if (g <= 1) return b;
  return drive(gain(b, g), 1.1);
}

function render(recipe: Recipe): Buf {
  const raw = recipe.render(rng(hashSeed(recipe.id)));
  for (let i = 0; i < raw.length; i++) if (!Number.isFinite(raw[i])) throw new Error(`${recipe.id}: non-finite sample`);
  if (recipe.kind === 'buzzer') {
    const first = master(raw, { peakTarget: 1, fadeOut: 0.04 });
    // AAC can overshoot by a fraction of a dB; leave ~1.4 dB of headroom.
    return master(loudnessMatch(first, 0.25), { peakTarget: 0.85, fadeOut: 0.03 });
  }
  if (recipe.kind === 'tick') return master(raw, { peakTarget: 0.8, fadeOut: 0.01 });
  return master(raw, { peakTarget: recipe.id === 'win' ? 0.85 : 0.8, fadeOut: 0.03 });
}

function wav(b: Buf): Buffer {
  const data = Buffer.alloc(b.length * 2);
  for (let i = 0; i < b.length; i++) {
    const v = Math.max(-1, Math.min(1, b[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function toM4a(wavPath: string, outPath: string) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '1',
      '-ar',
      String(SR),
      '-movflags',
      '+faststart',
      outPath,
    ],
    { stdio: 'inherit' },
  );
}

/** Decoded sample peaks must stay below this (linear, about -0.5 dBFS). */
const MAX_DECODED_PEAK = 0.94;

/** Decode with ffmpeg to float and return the true sample peak. */
function decodePeak(file: string): number {
  const raw = execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-'],
    {
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const f = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  return peak(f);
}

function writeManifest() {
  const entry = (r: Recipe, indent: string) => {
    const file = fileNameFor(r);
    return [
      `${indent}{`,
      `${indent}  id: '${r.id}',`,
      `${indent}  name: '${r.name.replace(/'/g, "\\'")}',`,
      `${indent}  file: '${file}',`,
      `${indent}  source: require('../../assets/sounds/${file}'),`,
      `${indent}}`,
    ].join('\n');
  };
  const keyed = (list: Recipe[]) => list.map((r) => `  ${r.id}: ${entry(r, '  ').trimStart()},`).join('\n');
  const src = `// GENERATED by scripts/gen-sounds/build.ts. Do not edit by hand; rerun the script.
import type { SoundAsset } from './catalog';

export const BUZZER_ASSETS: readonly SoundAsset[] = [
${BUZZERS.map((r) => `${entry(r, '  ')},`).join('\n')}
];

export const TICK_ASSETS: Record<'tick' | 'tock', SoundAsset> = {
${keyed(TICKS)}
};

export const SFX_ASSETS: Record<'gotIt' | 'skip' | 'win' | 'point', SoundAsset> = {
${keyed(SFX)}
};
`;
  fs.writeFileSync(MANIFEST, src);
}

function writeLicenses(sizes: Map<string, number>) {
  const rows = ALL_RECIPES.map((r) => {
    const file = fileNameFor(r);
    const kb = ((sizes.get(file) ?? fs.statSync(path.join(OUT_DIR, file)).size) / 1024).toFixed(1);
    return `| \`${file}\` | ${r.name} | ${r.description} | ${kb} KB | ${LICENSE_TEXT} |`;
  });
  const md = `# Sound licenses

Every sound in this folder is original: synthesized from scratch (oscillators, filtered noise,
envelopes) by \`scripts/gen-sounds/\`. No samples, recordings or third-party sounds are used.
All files are owned by the project and dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Regenerate with \`npx tsx scripts/gen-sounds/build.ts\` (requires ffmpeg for the .m4a files).

| File | Name | Description | Size | License |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
  fs.writeFileSync(LICENSES, md);
}

function main() {
  const args = process.argv.slice(2);
  const keepWav = args.includes('--keep-wav');
  const only = args.filter((a) => !a.startsWith('--'));
  const unknown = only.filter((id) => !ALL_RECIPES.some((r) => r.id === id));
  if (unknown.length) throw new Error(`unknown sound id(s): ${unknown.join(', ')}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blurt-sounds-'));
  if (keepWav) fs.mkdirSync(WAV_KEEP_DIR, { recursive: true });
  const sizes = new Map<string, number>();
  const lines: string[] = [];

  for (const recipe of ALL_RECIPES) {
    if (only.length && !only.includes(recipe.id)) continue;
    const b = render(recipe);
    const file = fileNameFor(recipe);
    const wavBytes = wav(b);
    const outPath = path.join(OUT_DIR, file);
    let decodedPeak = peak(b);
    if (file.endsWith('.wav')) {
      fs.writeFileSync(outPath, wavBytes);
    } else {
      // AAC overshoots the source peak; re-encode with less gain until the decoded peak is safe.
      const tmpWav = path.join(tmp, `${recipe.id}.wav`);
      let scale = 1;
      for (let attempt = 0; attempt < 6; attempt++) {
        fs.writeFileSync(tmpWav, attempt === 0 ? wavBytes : wav(gain(b, scale)));
        toM4a(tmpWav, outPath);
        decodedPeak = decodePeak(outPath);
        if (decodedPeak <= MAX_DECODED_PEAK) break;
        scale *= (MAX_DECODED_PEAK / decodedPeak) * 0.98;
      }
      if (decodedPeak > 0.999) throw new Error(`${recipe.id}: decoded AAC still clips (${decodedPeak.toFixed(3)})`);
    }
    if (keepWav) fs.writeFileSync(path.join(WAV_KEEP_DIR, `${recipe.id}.wav`), wavBytes);
    const size = fs.statSync(outPath).size;
    sizes.set(file, size);
    const db = (x: number) => (20 * Math.log10(x)).toFixed(1).padStart(6);
    lines.push(
      `${file.padEnd(30)} ${(b.length / SR).toFixed(2)}s  peak ${db(decodedPeak)} dB  rms ${db(rms(b))} dB  ${(size / 1024).toFixed(1).padStart(6)} KB`,
    );
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  // Remove stale generated files that no recipe produces any more.
  const expected = new Set(ALL_RECIPES.map(fileNameFor));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/\.(wav|m4a)$/.test(f) && !expected.has(f)) fs.rmSync(path.join(OUT_DIR, f));
  }

  writeManifest();
  writeLicenses(sizes);
  // Keep generated text files in the repo's Prettier style so regenerating causes no diff noise.
  try {
    execFileSync(process.execPath, [require.resolve('prettier/bin/prettier.cjs'), '--write', MANIFEST, LICENSES], {
      stdio: 'ignore',
    });
  } catch {
    console.warn('prettier not available; generated files left unformatted');
  }

  const total = [...expected].reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(lines.join('\n'));
  console.log(
    `\n${BUZZERS.length} buzzers, ${TICKS.length} ticks, ${SFX.length} sfx; total ${(total / 1024).toFixed(0)} KB in assets/sounds/`,
  );
}

main();
