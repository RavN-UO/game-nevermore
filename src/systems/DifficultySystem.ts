import { Balance } from "../config/balance";

/**
 * Maps how far the player has travelled (in metres) to the live difficulty
 * knobs: scroll speed, gap size, obstacle spacing and the music-intensity tier.
 * Pure derivation from distance + Balance, so the curve is fully tunable.
 */
export interface DifficultyState {
  speed: number; // px/s
  gap: number; // px
  spacing: number; // px
  intensityTier: number; // index into Balance.audio.intensityMeters
  ramp: number; // 0..1 overall difficulty progress
}

export function difficultyFor(meters: number): DifficultyState {
  const o = Balance.obstacles;
  const w = Balance.world;

  const speed = Math.min(w.maxSpeed, w.startSpeed + meters * w.speedPerMeter);
  const gap = Math.max(o.gapMin, o.gapStart - meters * o.gapPerMeter);
  const spacing = Math.max(o.spacingMin, o.spacingStart - meters * o.spacingPerMeter);

  const tiers = Balance.audio.intensityMeters;
  let intensityTier = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (meters >= tiers[i]) intensityTier = i;
  }

  const ramp = Math.min(1, meters / Balance.difficulty.rampMeters);
  return { speed, gap, spacing, intensityTier, ramp };
}
