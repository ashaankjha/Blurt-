import { PHRASE_RULES } from '../../src/config';
import { normalizePhraseKey, slugify, type Difficulty, type Phrase } from '../../content/schema';

/**
 * Hard blocklist for family packs. The reviewer pass is the real filter; this catches slips.
 * Matches whole normalized words.
 */
const FAMILY_BLOCKLIST = [
  'sex',
  'sexy',
  'porn',
  'nude',
  'naked',
  'boob',
  'boobs',
  'penis',
  'vagina',
  'orgasm',
  'stripper',
  'shit',
  'fuck',
  'bitch',
  'damn',
  'hell',
  'ass',
  'crap',
  'piss',
  'dick',
  'cock',
  'slut',
  'whore',
  'vodka',
  'tequila',
  'whiskey',
  'drunk',
  'hangover',
  'cocaine',
  'weed',
  'marijuana',
  'meth',
  'kill',
  'murder',
  'suicide',
  'terrorist',
  'nazi',
  'hitler',
  'massacre',
  'holocaust',
  'genocide',
];
/** Blocked in every pack, including After Dark. */
const ALWAYS_BLOCKLIST = [
  'nazi',
  'hitler',
  'holocaust',
  'genocide',
  'massacre',
  'suicide',
  'rape',
  'porn',
  'cocaine',
  'meth',
];

export interface ParsedLine {
  line: number;
  text: string;
  difficulty: Difficulty;
  taboo?: [string, string, string];
}

export interface Problem {
  line: number;
  text: string;
  reason: string;
}

/** Collapse whitespace and normalize quotes/dashes. */
export function cleanText(raw: string): string {
  return raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Source format, one phrase per line:
 *   Phrase Text | difficulty [| taboo1, taboo2, taboo3]
 * difficulty defaults to 2 when omitted. Blank lines and lines starting with # are ignored.
 */
export function parseSource(src: string): { parsed: ParsedLine[]; problems: Problem[] } {
  const parsed: ParsedLine[] = [];
  const problems: Problem[] = [];
  src.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [textPart, diffPart, tabooPart] = trimmed.split('|').map((s) => s.trim());
    const text = cleanText(textPart ?? '');
    const difficulty = diffPart ? Number(diffPart) : 2;
    if (![1, 2, 3].includes(difficulty)) {
      problems.push({ line, text, reason: `bad difficulty "${diffPart}"` });
      return;
    }
    let taboo: ParsedLine['taboo'];
    if (tabooPart) {
      const words = tabooPart
        .split(',')
        .map((w) => cleanText(w))
        .filter(Boolean);
      if (words.length !== 3) {
        problems.push({ line, text, reason: 'taboo needs exactly 3 words' });
        return;
      }
      taboo = words as [string, string, string];
    }
    parsed.push({ line, text, difficulty: difficulty as Difficulty, ...(taboo ? { taboo } : {}) });
  });
  return { parsed, problems };
}

export function checkRules(text: string, adult: boolean): string | null {
  if (!text) return 'empty';
  if (text.length > PHRASE_RULES.maxChars) return `over ${PHRASE_RULES.maxChars} chars`;
  const words = text.split(' ').length;
  if (words > PHRASE_RULES.maxWords) return `over ${PHRASE_RULES.maxWords} words`;
  if (!/[a-z0-9]/i.test(text)) return 'no letters';
  const tokens = new Set(normalizePhraseKey(text).split(' '));
  const list = adult ? ALWAYS_BLOCKLIST : FAMILY_BLOCKLIST;
  const hit = list.find((w) => tokens.has(w));
  if (hit) return `blocklisted word "${hit}"`;
  return null;
}

/** Normalize, validate, dedupe (case/punctuation-insensitive) and assign ids. */
export function buildPhrases(
  packId: string,
  lines: ParsedLine[],
  adult: boolean,
): { phrases: Phrase[]; rejected: Problem[]; duplicates: Problem[] } {
  const phrases: Phrase[] = [];
  const rejected: Problem[] = [];
  const duplicates: Problem[] = [];
  const seenKeys = new Set<string>();
  const usedIds = new Set<string>();
  for (const l of lines) {
    const reason = checkRules(l.text, adult);
    if (reason) {
      rejected.push({ line: l.line, text: l.text, reason });
      continue;
    }
    const key = normalizePhraseKey(l.text);
    if (seenKeys.has(key)) {
      duplicates.push({ line: l.line, text: l.text, reason: 'duplicate' });
      continue;
    }
    seenKeys.add(key);
    const base = `${packId}:${slugify(l.text)}`;
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    phrases.push({ id, text: l.text, difficulty: l.difficulty, ...(l.taboo ? { taboo: l.taboo } : {}) });
  }
  return { phrases, rejected, duplicates };
}
