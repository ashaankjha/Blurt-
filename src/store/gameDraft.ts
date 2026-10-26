/**
 * Pure helpers for the game draft (Setup / Pack Picker): default teams, team colors, seating.
 * No React or zustand here so they are trivially unit-testable.
 */
import { DEFAULTS, EVERYTHING_MIX_ID, LIMITS } from '../config';
import type { GameSettings, Team } from '../engine/types';
import { TEAM_COLORS } from '../ui/tokens';
import type { DefaultRules } from './settingsTypes';

/** Rules part of GameSettings, taken from the saved defaults. */
export function rulesFrom(rules: DefaultRules): Omit<GameSettings, 'teams' | 'packIds'> {
  return {
    mode: rules.mode,
    targetScore: rules.targetScore,
    skipsPerTurn: rules.skipsPerTurn,
    fuseMinMs: rules.fuseMinMs,
    fuseMaxMs: rules.fuseMaxMs,
    showFuse: rules.showFuse,
  };
}

/** Lowest `team-N` id not already used. Ids stay stable while teams are added and removed. */
function freeTeamId(teams: readonly Team[]): string {
  const used = new Set(teams.map((t) => t.id));
  for (let i = 1; ; i++) {
    const id = `team-${i}`;
    if (!used.has(id)) return id;
  }
}

/**
 * A new team using the first TEAM_COLORS entry no existing team uses (not index-based, so a color
 * the user picked by hand is never duplicated). Returns null when every color is taken.
 */
export function makeNextTeam(teams: readonly Team[]): Team | null {
  const used = new Set(teams.map((t) => t.color.toLowerCase()));
  const color = TEAM_COLORS.find((c) => !used.has(c.hex.toLowerCase()));
  if (!color) return null;
  return { id: freeTeamId(teams), name: `Team ${color.name}`, color: color.hex, players: [] };
}

/** `count` default teams with distinct colors (Team Blue, Team Orange, ...). */
export function defaultTeams(count: number = DEFAULTS.teamCount): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i < count; i++) {
    const t = makeNextTeam(teams);
    if (t) teams.push(t);
  }
  return teams;
}

/** Draft for a fresh Custom Game: default teams, saved default rules and last pack selection. */
export function draftFromSettings(rules: DefaultRules, lastPackIds: readonly string[]): GameSettings {
  return { ...rulesFrom(rules), teams: defaultTeams(), packIds: [...lastPackIds] };
}

/** Quick Play settings: 2 default teams, Everything Mix (family only, never adult), saved rules. */
export function quickPlaySettings(rules: DefaultRules): GameSettings {
  return { ...rulesFrom(rules), teams: defaultTeams(DEFAULTS.teamCount), packIds: [EVERYTHING_MIX_ID] };
}

/** In-place-free Fisher-Yates shuffle. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const cleanPlayers = (players: readonly string[]): string[] => players.map((p) => p.trim()).filter(Boolean);

/**
 * Random seating: shuffles every entered player name and deals them round-robin across the
 * teams, so team sizes differ by at most one. The Setup seat-order helper then alternates teams.
 * Team names, colors and ids are kept. Blank names are dropped.
 */
export function shuffleSeats(teams: readonly Team[], rng: () => number): Team[] {
  const pool = shuffled(
    teams.flatMap((t) => cleanPlayers(t.players)),
    rng,
  );
  const dealt: string[][] = teams.map(() => []);
  // Random starting team so the "extra" player of an uneven split doesn't always land on team 1.
  const offset = teams.length > 0 ? Math.min(teams.length - 1, Math.floor(rng() * teams.length)) : 0;
  pool.forEach((name, i) => dealt[(i + offset) % teams.length].push(name));
  return teams.map((t, i) => ({ ...t, players: dealt[i] }));
}

/**
 * Normalizes a draft into settings the engine can run: trims player names, clamps team count and
 * target score, and orders the fuse range. Returns null when the draft can't start a game.
 */
export function finalizeSettings(draft: GameSettings): GameSettings | null {
  const teams = draft.teams.slice(0, LIMITS.maxTeams).map((t) => ({ ...t, players: cleanPlayers(t.players) }));
  const packIds = [...new Set(draft.packIds)];
  if (teams.length < LIMITS.minTeams || packIds.length === 0) return null;
  const lo = Math.min(draft.fuseMinMs, draft.fuseMaxMs);
  const hi = Math.max(draft.fuseMinMs, draft.fuseMaxMs);
  return {
    ...draft,
    teams,
    packIds,
    targetScore: Math.max(LIMITS.minTargetScore, Math.round(draft.targetScore)),
    fuseMinMs: lo,
    fuseMaxMs: hi,
  };
}
