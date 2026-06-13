import Phaser from "phaser";

/**
 * A single global event emitter that decouples the gameplay scene from the HUD,
 * the audio engine and the meta systems. Scenes never reach into each other —
 * they talk through these events.
 */

export const GameEvent = {
  RunStart: "run:start",
  RunEnd: "run:end",
  ScoreUpdate: "score:update",
  DistanceUpdate: "distance:update",
  ComboUpdate: "combo:update",
  ComboBreak: "combo:break",
  SoulCollect: "soul:collect",
  NearMiss: "near:miss",
  Milestone: "milestone",
  ShieldBreak: "shield:break",
  Revive: "revive",
  Death: "death",
  PlumesUpdate: "plumes:update",
  XpUpdate: "xp:update",
  LevelUp: "level:up",
  AchievementUnlock: "achievement:unlock",
  IntensityUpdate: "intensity:update",
  Flash: "fx:flash",
} as const;

export type GameEventKey = (typeof GameEvent)[keyof typeof GameEvent];

export interface RunSummary {
  score: number;
  distanceM: number;
  souls: number;
  nearMisses: number;
  bestCombo: number;
  plumesEarned: number;
  xpEarned: number;
  chestBonus: number;
  newHighScore: boolean;
  prevHighScore: number;
  newAchievements: string[];
  leveledUp: number; // how many levels gained this run (0 if none)
}

/** Lightweight singleton wrapper around a Phaser emitter. */
class Bus extends Phaser.Events.EventEmitter {}

let bus: Bus | null = null;

export function eventBus(): Bus {
  if (!bus) bus = new Bus();
  return bus;
}
