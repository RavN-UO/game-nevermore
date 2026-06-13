import { Balance } from "../config/balance";

/**
 * Account level + reward track. XP accumulates across runs; crossing a level
 * threshold hands out a reward (Plumes, occasionally a skin). The track is
 * generated procedurally from Balance so it scales to maxLevel for free.
 */

export interface RewardTrackEntry {
  level: number;
  plumes: number;
  skinId?: string;
}

/** Total XP required to be AT (the start of) a given level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let n = 1; n < level; n++) {
    total += Balance.xp.levelBase * n + Balance.xp.levelQuad * n * n;
  }
  return Math.round(total);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < Balance.xp.maxLevel && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  intoLevel: number; // xp earned within the current level
  span: number; // xp needed to reach next level
  fraction: number; // 0..1 toward next level
  maxed: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const maxed = level >= Balance.xp.maxLevel;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - cur);
  const intoLevel = xp - cur;
  return {
    level,
    intoLevel,
    span,
    fraction: maxed ? 1 : Math.min(1, intoLevel / span),
    maxed,
  };
}

// Skins handed out at specific reward-track levels.
const TRACK_SKINS: Record<number, string> = {
  5: "ember",
  12: "wraith",
  22: "verdigris",
  35: "gilded",
};

export function rewardForLevel(level: number): RewardTrackEntry {
  const plumes = 40 + Math.round(level * 14);
  const skinId = TRACK_SKINS[level];
  return { level, plumes, skinId };
}

/** Reward-track entries for the levels gained between two XP totals. */
export function rewardsBetween(prevXp: number, newXp: number): RewardTrackEntry[] {
  const from = levelForXp(prevXp);
  const to = levelForXp(newXp);
  const out: RewardTrackEntry[] = [];
  for (let l = from + 1; l <= to; l++) out.push(rewardForLevel(l));
  return out;
}
