import {
  AA_BODY,
  WHITE,
  contrastRatio,
  deltaE,
  hexToRgb,
  readableTextOn,
  rgbToHex,
  shade,
  simulateCvd,
  teamBackground,
  withAlpha,
} from './color';
import { TEAM_COLORS, findTeamColor, palette, type ColorScheme } from './tokens';

const schemes: ColorScheme[] = ['light', 'dark'];

describe('color helpers', () => {
  it('parses and formats hex', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#1B1530')).toEqual([27, 21, 48]);
    expect(rgbToHex([27, 21, 48])).toBe('#1B1530');
    expect(withAlpha('#000000', 0.5)).toBe('#00000080');
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks the more readable text color', () => {
    expect(readableTextOn('#000000')).toBe(WHITE);
    expect(readableTextOn('#FFFF00')).not.toBe(WHITE);
  });

  it('shades darker', () => {
    expect(contrastRatio(shade('#FF0000', 0.5), WHITE)).toBeGreaterThan(contrastRatio('#FF0000', WHITE));
  });
});

describe('palette contrast (WCAG AA body text)', () => {
  const foreground = ['text', 'textMuted', 'primary', 'secondary', 'success', 'danger'] as const;
  const backgrounds = ['background', 'surface'] as const;

  for (const scheme of schemes) {
    const p = palette[scheme];
    for (const fg of foreground) {
      for (const bg of backgrounds) {
        it(`${scheme}: ${fg} on ${bg}`, () => {
          expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(AA_BODY);
        });
      }
    }
    it(`${scheme}: text and textMuted on surfaceAlt / inputBackground`, () => {
      for (const bg of [p.surfaceAlt, p.inputBackground]) {
        expect(contrastRatio(p.text, bg)).toBeGreaterThanOrEqual(AA_BODY);
        expect(contrastRatio(p.textMuted, bg)).toBeGreaterThanOrEqual(AA_BODY);
      }
    });
    it(`${scheme}: labels on fills`, () => {
      expect(contrastRatio(p.primaryText, p.primary)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(p.secondaryText, p.secondary)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(p.successText, p.success)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(p.dangerText, p.danger)).toBeGreaterThanOrEqual(AA_BODY);
    });
  }

  it('both schemes define the same tokens', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
  });
});

describe('team colors', () => {
  it.each(TEAM_COLORS.map((c) => [c.name, c] as const))('%s: text on color is AA', (_n, c) => {
    expect(contrastRatio(c.text, c.hex)).toBeGreaterThanOrEqual(AA_BODY);
    expect(readableTextOn(c.hex)).toBe(c.text);
  });

  it.each(TEAM_COLORS.map((c) => [c.name, c] as const))('%s: deep tint holds white text at 7:1', (_n, c) => {
    expect(contrastRatio(WHITE, c.deep)).toBeGreaterThanOrEqual(7);
    expect(teamBackground(c.hex)).toBe(c.deep);
  });

  it('are unique and looked up case-insensitively', () => {
    expect(new Set(TEAM_COLORS.map((c) => c.hex)).size).toBe(TEAM_COLORS.length);
    expect(findTeamColor(TEAM_COLORS[2].hex.toLowerCase())?.name).toBe(TEAM_COLORS[2].name);
    expect(findTeamColor('#123456')).toBeUndefined();
  });

  it.each(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const)(
    'stay distinguishable with %s (delta E >= 10 for every pair)',
    (kind) => {
      const sim = TEAM_COLORS.map((c) => (kind === 'none' ? c.hex : simulateCvd(c.hex, kind)));
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          expect(deltaE(sim[i], sim[j])).toBeGreaterThanOrEqual(10);
        }
      }
    },
  );
});
