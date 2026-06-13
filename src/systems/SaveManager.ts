/**
 * Persistent player profile, stored in localStorage as a single versioned blob.
 * Everything meta lives here: currency, unlocks, upgrades, records, streak,
 * daily challenge, achievements, reward track and settings.
 *
 * Writes are debounced so a busy run never thrashes localStorage.
 */

import { Balance } from "../config/balance";

const STORAGE_KEY = "nevermore.save.v1";
const SCHEMA_VERSION = 1;

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  haptics: boolean;
  reducedMotion: boolean;
}

export interface StreakState {
  count: number;
  best: number;
  lastDay: string | null; // YYYY-MM-DD
}

export interface DailyState {
  day: string | null; // YYYY-MM-DD the challenge belongs to
  challengeId: string | null;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface SaveData {
  version: number;
  createdAt: number;
  playerName: string | null;

  plumes: number;
  xp: number;

  highScore: number;
  bestDistanceM: number;
  bestCombo: number;
  bestNearMisses: number;

  totalRuns: number;
  totalDistanceM: number;
  totalSouls: number;
  totalNearMisses: number;
  totalPlumesEarned: number;

  selectedSkin: string;
  unlockedSkins: string[];

  upgrades: Record<string, number>; // upgradeId -> level owned
  achievements: Record<string, boolean>; // achievementId -> unlocked

  streak: StreakState;
  daily: DailyState;
  claimedRewardLevels: number[];

  settings: Settings;
}

function defaults(): SaveData {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    playerName: null,
    plumes: 0,
    xp: 0,
    highScore: 0,
    bestDistanceM: 0,
    bestCombo: 0,
    bestNearMisses: 0,
    totalRuns: 0,
    totalDistanceM: 0,
    totalSouls: 0,
    totalNearMisses: 0,
    totalPlumesEarned: 0,
    selectedSkin: "raven",
    unlockedSkins: ["raven"],
    upgrades: {},
    achievements: {},
    streak: { count: 0, best: 0, lastDay: null },
    daily: { day: null, challengeId: null, target: 0, progress: 0, claimed: false },
    claimedRewardLevels: [],
    settings: {
      music: Balance.audio.musicVolume,
      sfx: Balance.audio.sfxVolume,
      haptics: true,
      reducedMotion: false,
    },
  };
}

export class SaveManager {
  private data: SaveData;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // Shallow-merge over defaults so new fields appear on old saves.
      const merged = { ...defaults(), ...parsed } as SaveData;
      merged.settings = { ...defaults().settings, ...(parsed.settings ?? {}) };
      merged.streak = { ...defaults().streak, ...(parsed.streak ?? {}) };
      merged.daily = { ...defaults().daily, ...(parsed.daily ?? {}) };
      merged.upgrades = { ...(parsed.upgrades ?? {}) };
      merged.achievements = { ...(parsed.achievements ?? {}) };
      if (!merged.unlockedSkins?.includes("raven")) merged.unlockedSkins.push("raven");
      return merged;
    } catch {
      return defaults();
    }
  }

  /** Direct, read-only-ish access. Mutate then call save(). */
  get(): SaveData {
    return this.data;
  }

  /** Debounced persist (use during gameplay). */
  save(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => this.flush(), 250);
  }

  /** Immediate persist (use on menu transitions / important moments). */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full / private mode — fail silently, game still playable */
    }
  }

  reset(): void {
    this.data = defaults();
    this.flush();
  }

  // ----------------------------------------------------------- helpers ----
  addPlumes(amount: number): number {
    this.data.plumes = Math.max(0, Math.round(this.data.plumes + amount));
    return this.data.plumes;
  }

  spendPlumes(amount: number): boolean {
    if (this.data.plumes < amount) return false;
    this.data.plumes -= amount;
    this.flush();
    return true;
  }

  hasSkin(id: string): boolean {
    return this.data.unlockedSkins.includes(id);
  }

  upgradeLevel(id: string): number {
    return this.data.upgrades[id] ?? 0;
  }
}
