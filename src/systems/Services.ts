import { SaveManager } from "./SaveManager";
import { AudioManager } from "./AudioManager";
import { HapticsManager } from "./HapticsManager";
import { Leaderboard } from "./Leaderboard";
import { computeEffects, type UpgradeEffects, UPGRADES_BY_ID, nextCost } from "../data/upgrades";
import { computeRunReward, type RunStats } from "./EconomySystem";
import { rewardsBetween, levelForXp } from "./ProgressionSystem";
import {
  ACHIEVEMENTS,
  type AchievementContext,
  metricValue,
} from "../data/achievements";
import { SKINS, getSkin } from "../data/skins";
import {
  pickDailyForDay,
  DAILY_BY_ID,
  type DailyChallengeDef,
} from "../data/dailyChallenges";
import type { RunSummary } from "./EventBus";
import { Balance } from "../config/balance";

/** Local calendar day key, e.g. "2026-06-13". */
export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface StreakResult {
  advanced: boolean; // first open of a new day
  broken: boolean; // a missed day reset the streak
  count: number;
  reward: number; // plumes granted for advancing today
}

/**
 * Application service container. Owns every meta system and is the single place
 * that turns a finished run into persisted progress (economy, XP, achievements,
 * daily/streak). Registered on the Phaser registry as "services".
 */
export class Services {
  readonly save: SaveManager;
  readonly audio: AudioManager;
  readonly haptics: HapticsManager;
  readonly leaderboard: Leaderboard;

  constructor() {
    this.save = new SaveManager();
    const s = this.save.get();
    this.audio = new AudioManager(s.settings.music, s.settings.sfx);
    this.haptics = new HapticsManager(s.settings.haptics);
    this.leaderboard = new Leaderboard();
  }

  effects(): UpgradeEffects {
    return computeEffects(this.save.get().upgrades);
  }

  // ----------------------------------------------------- daily streak ----
  /** Call when the player opens the game (menu). Advances/breaks the streak. */
  updateStreakOnLaunch(): StreakResult {
    const s = this.save.get();
    const today = dayKey();
    const streak = s.streak;

    if (streak.lastDay === today) {
      return { advanced: false, broken: false, count: streak.count, reward: 0 };
    }

    const yesterday = dayKey(new Date(Date.now() - 86400000));
    let broken = false;
    if (streak.lastDay === yesterday) {
      streak.count += 1;
    } else {
      broken = streak.lastDay !== null;
      streak.count = 1;
    }
    streak.lastDay = today;
    streak.best = Math.max(streak.best, streak.count);

    // Reward grows with the streak, capped so it stays cosmetic-ish.
    const reward = Math.min(200, 20 + (streak.count - 1) * 15);
    this.save.addPlumes(reward);
    this.ensureDaily(today);
    this.save.flush();
    return { advanced: true, broken, count: streak.count, reward };
  }

  // ------------------------------------------------------- daily quest ----
  ensureDaily(today = dayKey()): { def: DailyChallengeDef; progress: number; claimed: boolean } {
    const s = this.save.get();
    if (s.daily.day !== today) {
      const def = pickDailyForDay(today);
      s.daily = {
        day: today,
        challengeId: def.id,
        target: def.target,
        progress: 0,
        claimed: false,
      };
      this.save.save();
    }
    const def = DAILY_BY_ID[s.daily.challengeId ?? ""] ?? pickDailyForDay(today);
    return { def, progress: s.daily.progress, claimed: s.daily.claimed };
  }

  private updateDaily(stats: { distanceM: number; souls: number; nearMisses: number; score: number; bestCombo: number }): void {
    const s = this.save.get();
    this.ensureDaily();
    const def = DAILY_BY_ID[s.daily.challengeId ?? ""];
    if (!def || s.daily.claimed) return;

    const runValue: Record<DailyChallengeDef["metric"], number> = {
      distance: stats.distanceM,
      souls: stats.souls,
      nearMiss: stats.nearMisses,
      score: stats.score,
      combo: stats.bestCombo,
      runs: 1,
    };
    const v = runValue[def.metric];
    if (def.scope === "run") s.daily.progress = Math.max(s.daily.progress, v);
    else s.daily.progress += v;
  }

  /** Claim the daily reward if completed. Returns plumes granted (0 if not). */
  claimDaily(): number {
    const s = this.save.get();
    const def = DAILY_BY_ID[s.daily.challengeId ?? ""];
    if (!def || s.daily.claimed || s.daily.progress < def.target) return 0;
    s.daily.claimed = true;
    this.save.addPlumes(def.reward);
    this.save.flush();
    return def.reward;
  }

  // --------------------------------------------------------- end of run ----
  finishRun(input: {
    score: number;
    distanceM: number;
    souls: number;
    nearMisses: number;
    bestCombo: number;
  }): RunSummary {
    const s = this.save.get();
    const stats: RunStats = {
      score: input.score,
      distanceM: input.distanceM,
      souls: input.souls,
      nearMisses: input.nearMisses,
    };

    const prevHighScore = s.highScore;
    const newHighScore = input.score > prevHighScore;

    // Economy
    const reward = computeRunReward(stats, this.effects());

    // XP + reward track
    const xpEarned = Math.round(
      input.score * Balance.xp.perScore +
        input.distanceM * Balance.xp.perMeter +
        input.souls * Balance.xp.perSoul +
        input.nearMisses * Balance.xp.perNearMiss,
    );
    const prevXp = s.xp;
    s.xp += xpEarned;
    const trackRewards = rewardsBetween(prevXp, s.xp);
    let trackPlumes = 0;
    for (const r of trackRewards) {
      trackPlumes += r.plumes;
      if (r.skinId && !s.unlockedSkins.includes(r.skinId)) s.unlockedSkins.push(r.skinId);
    }
    const leveledUp = levelForXp(s.xp) - levelForXp(prevXp);

    // Currency
    s.plumes = Math.max(0, Math.round(s.plumes + reward.total + trackPlumes));

    // Records
    s.highScore = Math.max(s.highScore, input.score);
    s.bestDistanceM = Math.max(s.bestDistanceM, input.distanceM);
    s.bestCombo = Math.max(s.bestCombo, input.bestCombo);
    s.bestNearMisses = Math.max(s.bestNearMisses, input.nearMisses);

    // Lifetime totals
    s.totalRuns += 1;
    s.totalDistanceM += input.distanceM;
    s.totalSouls += input.souls;
    s.totalNearMisses += input.nearMisses;
    s.totalPlumesEarned += reward.total + trackPlumes;

    // Achievements
    const ctx: AchievementContext = {
      runDistance: input.distanceM,
      runScore: input.score,
      runCombo: input.bestCombo,
      runNearMiss: input.nearMisses,
      runSouls: input.souls,
      totalDistance: s.totalDistanceM,
      totalSouls: s.totalSouls,
      totalRuns: s.totalRuns,
      totalNearMiss: s.totalNearMisses,
      streak: s.streak.count,
    };
    const newAchievements: string[] = [];
    let achievementPlumes = 0;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id]) continue;
      if (metricValue(ctx, a.metric) >= a.threshold) {
        s.achievements[a.id] = true;
        achievementPlumes += a.reward;
        newAchievements.push(a.id);
        // Skins unlocked by this achievement
        for (const skin of SKINS) {
          if (skin.unlockedBy === a.id && !s.unlockedSkins.includes(skin.id)) {
            s.unlockedSkins.push(skin.id);
          }
        }
      }
    }
    s.plumes += achievementPlumes;
    s.totalPlumesEarned += achievementPlumes;

    // Daily
    this.updateDaily({
      distanceM: input.distanceM,
      souls: input.souls,
      nearMisses: input.nearMisses,
      score: input.score,
      bestCombo: input.bestCombo,
    });

    this.save.flush();

    return {
      score: input.score,
      distanceM: input.distanceM,
      souls: input.souls,
      nearMisses: input.nearMisses,
      bestCombo: input.bestCombo,
      plumesEarned: reward.total + trackPlumes + achievementPlumes,
      xpEarned,
      chestBonus: reward.jackpot,
      newHighScore,
      prevHighScore,
      newAchievements,
      leveledUp,
    };
  }

  // ------------------------------------------------------------- shop ----
  buySkin(id: string): boolean {
    const skin = getSkin(id);
    const s = this.save.get();
    if (s.unlockedSkins.includes(id)) return false;
    if (skin.price < 0) return false; // achievement-only
    if (!this.save.spendPlumes(skin.price)) return false;
    s.unlockedSkins.push(id);
    this.save.flush();
    return true;
  }

  selectSkin(id: string): void {
    const s = this.save.get();
    if (s.unlockedSkins.includes(id)) {
      s.selectedSkin = id;
      this.save.flush();
    }
  }

  buyUpgrade(id: string): boolean {
    const def = UPGRADES_BY_ID[id];
    if (!def) return false;
    const s = this.save.get();
    const owned = s.upgrades[id] ?? 0;
    const cost = nextCost(def, owned);
    if (cost === null) return false;
    if (!this.save.spendPlumes(cost)) return false;
    s.upgrades[id] = owned + 1;
    this.save.flush();
    return true;
  }
}
