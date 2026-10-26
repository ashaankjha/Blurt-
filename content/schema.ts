/**
 * Pack + phrase contract (PRD section 7). Shared by the app and scripts/gen-packs.
 * FROZEN after Phase 0: changes go through the orchestrator.
 */
import { z } from 'zod';

import { PHRASE_RULES } from '../src/config';

export type Difficulty = 1 | 2 | 3;

export type PackTag = 'family' | 'adult' | 'kids' | 'hard' | 'local' | 'custom';

export interface Phrase {
  /** `${packId}:${slug}` */
  id: string;
  /** 1-5 words, <= 32 chars */
  text: string;
  difficulty: Difficulty;
  taboo?: [string, string, string];
}

export interface Pack {
  /** kebab-case */
  id: string;
  name: string;
  emoji: string;
  description: string;
  tags: PackTag[];
  version: number;
  phrases: Phrase[];
}

/** Pack without its phrases; what the pack picker lists. */
export type PackMeta = Omit<Pack, 'phrases'> & { phraseCount: number };

export const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PackTagSchema = z.enum(['family', 'adult', 'kids', 'hard', 'local', 'custom']);

export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const PhraseSchema = z
  .object({
    id: z.string().min(3),
    text: z
      .string()
      .min(1)
      .max(PHRASE_RULES.maxChars)
      .refine((t) => t.trim() === t, 'no leading/trailing whitespace')
      .refine((t) => {
        const words = t.split(/\s+/).filter(Boolean).length;
        return words >= 1 && words <= PHRASE_RULES.maxWords;
      }, `1-${PHRASE_RULES.maxWords} words`),
    difficulty: DifficultySchema,
    taboo: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]).optional(),
  })
  .strict();

export const PackSchema = z
  .object({
    id: z.string().regex(KEBAB_RE, 'kebab-case'),
    name: z.string().min(1).max(40),
    emoji: z.string().min(1).max(16),
    description: z.string().min(1).max(140),
    tags: z.array(PackTagSchema),
    version: z.number().int().min(1),
    phrases: z.array(PhraseSchema).min(1),
  })
  .strict()
  .superRefine((pack, ctx) => {
    const seenIds = new Set<string>();
    const seenText = new Set<string>();
    pack.phrases.forEach((p, i) => {
      if (!p.id.startsWith(`${pack.id}:`)) {
        ctx.addIssue({ code: 'custom', path: ['phrases', i, 'id'], message: `id must start with "${pack.id}:"` });
      }
      if (seenIds.has(p.id)) {
        ctx.addIssue({ code: 'custom', path: ['phrases', i, 'id'], message: `duplicate id ${p.id}` });
      }
      seenIds.add(p.id);
      const key = normalizePhraseKey(p.text);
      if (seenText.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['phrases', i, 'text'], message: `duplicate phrase "${p.text}"` });
      }
      seenText.add(key);
    });
  });

/**
 * Case- and punctuation-insensitive key used for dedupe (PRD section 4).
 * "Rock 'n' Roll!" and "rock n roll" collide.
 */
export function normalizePhraseKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** kebab-case slug for phrase ids. */
export function slugify(text: string): string {
  return normalizePhraseKey(text).replace(/\s+/g, '-');
}

// Compile-time check that the Zod schemas and the frozen interfaces agree.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _phraseOk: Equals<z.infer<typeof PhraseSchema>, Phrase> = true;
const _packOk: Equals<z.infer<typeof PackSchema>, Pack> = true;
void _phraseOk;
void _packOk;
