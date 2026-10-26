import fs from 'node:fs';
import path from 'node:path';

import { BUZZER_ASSETS, BUZZER_INFOS, SFX_ASSETS, TICK_ASSETS, findBuzzer } from './catalog';

const SOUNDS_DIR = path.resolve(__dirname, '../../assets/sounds');
const all = [...BUZZER_ASSETS, ...Object.values(TICK_ASSETS), ...Object.values(SFX_ASSETS)];

describe('sound catalog', () => {
  it('has 30+ buzzers with unique ids and names', () => {
    expect(BUZZER_ASSETS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BUZZER_ASSETS.map((b) => b.id)).size).toBe(BUZZER_ASSETS.length);
    expect(new Set(BUZZER_ASSETS.map((b) => b.name)).size).toBe(BUZZER_ASSETS.length);
    expect(BUZZER_INFOS.map((b) => b.id)).toEqual(BUZZER_ASSETS.map((b) => b.id));
    expect(findBuzzer('air-horn')?.name).toBe('Air Horn');
    expect(findBuzzer('nope')).toBeUndefined();
  });

  it('has tick, tock and every UI sfx', () => {
    expect(Object.keys(TICK_ASSETS).sort()).toEqual(['tick', 'tock']);
    expect(Object.keys(SFX_ASSETS).sort()).toEqual(['gotIt', 'point', 'skip', 'win']);
  });

  it('every referenced file exists and is a playable WAV or M4A', () => {
    for (const s of all) {
      const file = path.join(SOUNDS_DIR, s.file);
      expect(fs.existsSync(file)).toBe(true);
      const head = fs.readFileSync(file).subarray(0, 44);
      if (s.file.endsWith('.wav')) {
        expect(head.toString('ascii', 0, 4)).toBe('RIFF');
        expect(head.toString('ascii', 8, 12)).toBe('WAVE');
        expect(head.readUInt16LE(20)).toBe(1); // PCM
        expect(head.readUInt16LE(22)).toBe(1); // mono
        expect([22050, 44100]).toContain(head.readUInt32LE(24));
        expect(head.readUInt16LE(34)).toBe(16);
      } else {
        expect(s.file).toMatch(/\.m4a$/);
        expect(head.toString('ascii', 4, 8)).toBe('ftyp');
      }
    }
  });

  it('assets/sounds holds no stray sound files and stays small', () => {
    const referenced = new Set(all.map((s) => s.file));
    const onDisk = fs.readdirSync(SOUNDS_DIR).filter((f) => /\.(wav|m4a|mp3|ogg|caf|aac)$/.test(f));
    expect(onDisk.sort()).toEqual([...referenced].sort());
    const total = onDisk.reduce((sum, f) => sum + fs.statSync(path.join(SOUNDS_DIR, f)).size, 0);
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });

  it('LICENSES.md lists every file as original CC0', () => {
    const licenses = fs.readFileSync(path.join(SOUNDS_DIR, 'LICENSES.md'), 'utf8');
    for (const s of all) {
      const row = licenses.split('\n').find((l) => l.includes(`\`${s.file}\``));
      expect(row).toBeDefined();
      expect(row).toContain('Original, synthesized by scripts/gen-sounds; owned by the project, dedicated to CC0');
    }
  });
});
