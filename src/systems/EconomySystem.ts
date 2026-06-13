import { Balance } from "../config/balance";
import type { UpgradeEffects } from "../data/upgrades";

/**
 * End-of-run economy: turns a run's stats into Plumes, including the variable
 * post-run chest (the dopamine knob — BRIEF §1.2). Pure functions; the caller
 * persists the result.
 */
export interface RunStats {
  score: number;
  distanceM: number;
  souls: number;
  nearMisses: number;
}

export interface RunReward {
  base: number; // plumes from score + distance + souls
  chest: number; // guaranteed chest plumes (incl. milestone bonuses)
  jackpot: number; // variable bonus (often 0)
  total: number; // grand total after the plume multiplier
  milestones: number; // milestones reached this run
  jackpotHit: boolean;
}

export function computeRunReward(
  stats: RunStats,
  effects: UpgradeEffects,
  rng: () => number = Math.random,
): RunReward {
  const e = Balance.economy;

  const fromScore = stats.score * e.plumesPerScore;
  const fromDist = stats.distanceM * e.plumesPerMeter;
  const fromSouls = stats.souls * Balance.souls.plumes;
  const base = fromScore + fromDist + fromSouls;

  const milestones = Math.floor(stats.distanceM / e.milestoneMeters);
  const chest = e.chestBase + milestones * e.chestPerMilestone;

  let jackpot = 0;
  const jackpotHit = rng() < e.bonusChance;
  if (jackpotHit) {
    jackpot = Math.round(e.bonusMin + rng() * (e.bonusMax - e.bonusMin));
  }

  const total = Math.round((base + chest + jackpot) * effects.plumeMultiplier);

  return {
    base: Math.round(base),
    chest,
    jackpot,
    total,
    milestones,
    jackpotHit,
  };
}
