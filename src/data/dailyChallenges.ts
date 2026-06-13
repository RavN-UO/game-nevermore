/**
 * Pool of daily challenges. One is selected per day (deterministically from the
 * date so the choice is stable across reloads). Progress is tracked in the save
 * `daily` state and rewarded once.
 *
 * `scope: "run"` → progress is the best single-run value of the day.
 * `scope: "day"` → progress accumulates across every run that day.
 */

export type DailyMetric =
  | "distance"
  | "souls"
  | "nearMiss"
  | "score"
  | "combo"
  | "runs";

export interface DailyChallengeDef {
  id: string;
  label: string; // {target} is substituted
  metric: DailyMetric;
  target: number;
  scope: "run" | "day";
  reward: number; // plumes
}

export const DAILY_CHALLENGES: DailyChallengeDef[] = [
  { id: "d_souls_50", label: "Gather {target} souls today", metric: "souls", target: 50, scope: "day", reward: 80 },
  { id: "d_souls_120", label: "Gather {target} souls today", metric: "souls", target: 120, scope: "day", reward: 140 },
  { id: "d_dist_800", label: "Reach {target} m in one run", metric: "distance", target: 800, scope: "run", reward: 90 },
  { id: "d_dist_1500", label: "Reach {target} m in one run", metric: "distance", target: 1500, scope: "run", reward: 160 },
  { id: "d_near_15", label: "Land {target} near-misses in one run", metric: "nearMiss", target: 15, scope: "run", reward: 110 },
  { id: "d_near_30", label: "Land {target} near-misses today", metric: "nearMiss", target: 30, scope: "day", reward: 120 },
  { id: "d_combo_8", label: "Reach a ×{target} combo", metric: "combo", target: 8, scope: "run", reward: 100 },
  { id: "d_score_5k", label: "Score {target} in one run", metric: "score", target: 5000, scope: "run", reward: 120 },
  { id: "d_runs_8", label: "Play {target} runs today", metric: "runs", target: 8, scope: "day", reward: 70 },
];

export const DAILY_BY_ID: Record<string, DailyChallengeDef> = Object.fromEntries(
  DAILY_CHALLENGES.map((d) => [d.id, d]),
);

/** Deterministic pick from the date string so it's stable across reloads. */
export function pickDailyForDay(day: string): DailyChallengeDef {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return DAILY_CHALLENGES[h % DAILY_CHALLENGES.length];
}

export function dailyLabel(def: DailyChallengeDef): string {
  return def.label.replace("{target}", String(def.target));
}
