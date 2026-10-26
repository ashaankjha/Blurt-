import * as fc from 'fast-check';

import { fitPhrase, measureBaloo, splitWords, wrapWords } from './phraseFit';
import { fontSizes } from './tokens';

// Typical phone content widths (portrait) and Round-screen phrase box heights.
const PHONE = { width: 343, height: 420 };

describe('measureBaloo', () => {
  it('scales linearly with font size and handles unknown chars', () => {
    expect(measureBaloo('Hello', 20)).toBeCloseTo(measureBaloo('Hello', 10) * 2);
    expect(measureBaloo('é', 10)).toBeGreaterThan(0);
    expect(measureBaloo('🎉', 10)).toBeGreaterThan(measureBaloo('i', 10));
    expect(measureBaloo('W', 10)).toBeGreaterThan(measureBaloo('i', 10));
  });
});

describe('wrapWords', () => {
  it('greedily packs words onto lines', () => {
    const measure = (t: string) => t.length; // 1 px per char
    expect(wrapWords(['aa', 'bb', 'cc'], 1, 5, measure)).toEqual(['aa bb', 'cc']);
    expect(wrapWords(['toolongword'], 1, 5, measure)).toEqual(['toolongword']);
    expect(splitWords('  a   b ')).toEqual(['a', 'b']);
  });
});

describe('fitPhrase', () => {
  it('uses the max size for a short word in a big box', () => {
    const r = fitPhrase('Pizza', { width: 1000, height: 1000 });
    expect(r.fontSize).toBe(fontSizes.phraseMax);
    expect(r.lines).toEqual(['Pizza']);
    expect(r.overflow).toBe(false);
  });

  it('shrinks long phrases, wrapping onto several lines', () => {
    const short = fitPhrase('Pizza', PHONE);
    const long = fitPhrase('The Great Wall of China', PHONE);
    expect(long.fontSize).toBeLessThan(short.fontSize);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(long.fontSize).toBeGreaterThanOrEqual(fontSizes.phraseMin);
  });

  it('never goes below phraseMin, flagging overflow instead', () => {
    const r = fitPhrase('Supercalifragilisticexpialidocious', { width: 200, height: 100 });
    expect(r.fontSize).toBe(fontSizes.phraseMin);
    expect(r.overflow).toBe(true);
  });

  it('picks the largest size that fits (one step up does not)', () => {
    const text = 'Hot air balloon';
    const r = fitPhrase(text, PHONE);
    const width = PHONE.width * 0.92;
    const up = r.fontSize + 1;
    const lines = wrapWords(splitWords(text), up, width);
    const widest = Math.max(...splitWords(text).map((w) => measureBaloo(w, up)));
    const fitsUp = widest <= width && lines.length * up * 1.2 <= PHONE.height;
    expect(fitsUp).toBe(false);
  });

  it('handles empty text and zero-size boxes', () => {
    expect(fitPhrase('', PHONE)).toMatchObject({ fontSize: fontSizes.phraseMin, lines: [], overflow: false });
    expect(fitPhrase('Hi', { width: 0 }).overflow).toBe(true);
  });

  it('property: result is within bounds and fits whenever it reports no overflow', () => {
    const word = fc.stringMatching(/^[A-Za-z']{1,12}$/);
    fc.assert(
      fc.property(
        fc.array(word, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 200, max: 900 }),
        fc.integer({ min: 120, max: 900 }),
        (words, width, height) => {
          const text = words.join(' ');
          const r = fitPhrase(text, { width, height });
          expect(r.fontSize).toBeGreaterThanOrEqual(fontSizes.phraseMin);
          expect(r.fontSize).toBeLessThanOrEqual(fontSizes.phraseMax);
          if (!r.overflow) {
            for (const line of r.lines) {
              const lineWords = line.split(' ');
              if (lineWords.length > 1) expect(measureBaloo(line, r.fontSize)).toBeLessThanOrEqual(width);
            }
            expect(r.lines.length * r.fontSize * 1.2).toBeLessThanOrEqual(height + 1);
          }
          expect(r.lines.join(' ')).toBe(words.join(' '));
        },
      ),
    );
  });
});
