/**
 * Achievements. Each one is a pure data definition with a `metric` + `threshold`
 * the AchievementSystem evaluates after every run, so adding a new achievement
 * never means writing new logic.
 *
 * Some achievements unlock skins (see skins.ts `unlockedBy`).
 */

export type AchievementMetric =
  | "runDistance" // metres in a single run
  | "runScore" // score in a single run
  | "runCombo" // best multiplier reached in a run
  | "runNearMiss" // near-misses in a run
  | "runSouls" // souls in a run
  | "totalDistance" // lifetime metres
  | "totalSouls" // lifetime souls
  | "totalRuns" // lifetime runs
  | "totalNearMiss" // lifetime near-misses
  | "streak"; // daily streak length

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
  metric: AchievementMetric;
  threshold: number;
  reward: number; // plumes
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "firstflight", name: "First Flight", blurb: "Reach 100 m in a single run.", metric: "runDistance", threshold: 100, reward: 30 },
  { id: "glider", name: "Glider", blurb: "Reach 500 m in a single run.", metric: "runDistance", threshold: 500, reward: 80 },
  { id: "marathon", name: "Marathon of Crows", blurb: "Reach 1500 m in a single run.", metric: "runDistance", threshold: 1500, reward: 250 },
  { id: "abyssal", name: "Abyssal", blurb: "Reach 3000 m in a single run.", metric: "runDistance", threshold: 3000, reward: 600 },

  { id: "grazer", name: "Grazer", blurb: "Pull off 10 near-misses in one run.", metric: "runNearMiss", threshold: 10, reward: 60 },
  { id: "daredevil", name: "Daredevil", blurb: "20 near-misses in one run.", metric: "runNearMiss", threshold: 20, reward: 140 },

  { id: "collector", name: "Collector", blurb: "Gather 25 souls in one run.", metric: "runSouls", threshold: 25, reward: 70 },
  { id: "reaper", name: "Reaper", blurb: "Gather 60 souls in one run.", metric: "runSouls", threshold: 60, reward: 160 },

  { id: "chained", name: "Chained", blurb: "Reach a ×6 combo.", metric: "runCombo", threshold: 6, reward: 80 },
  { id: "combomaster", name: "Unbroken", blurb: "Reach the ×12 combo cap.", metric: "runCombo", threshold: 12, reward: 300 },

  { id: "persistent", name: "Persistent", blurb: "Play 25 runs.", metric: "totalRuns", threshold: 25, reward: 60 },
  { id: "obsessed", name: "Obsessed", blurb: "Play 200 runs.", metric: "totalRuns", threshold: 200, reward: 250 },

  { id: "wanderer", name: "Wanderer", blurb: "Travel 10 km in total.", metric: "totalDistance", threshold: 10000, reward: 120 },
  { id: "hoarder", name: "Soul Hoarder", blurb: "Gather 1000 souls in total.", metric: "totalSouls", threshold: 1000, reward: 200 },

  { id: "devoted", name: "Devoted", blurb: "Keep a 7-day streak.", metric: "streak", threshold: 7, reward: 200 },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export interface AchievementContext {
  runDistance: number;
  runScore: number;
  runCombo: number;
  runNearMiss: number;
  runSouls: number;
  totalDistance: number;
  totalSouls: number;
  totalRuns: number;
  totalNearMiss: number;
  streak: number;
}

export function metricValue(ctx: AchievementContext, m: AchievementMetric): number {
  return ctx[m];
}
