/**
 * Permanent meta upgrades (roguelite-light). Bought with Plumes, effects are
 * permanent and stack. Read by EconomySystem / GameScene through the typed
 * getters at the bottom — never index `upgrades` by raw string in gameplay.
 */

export type UpgradeId =
  | "magnet"
  | "plumeGain"
  | "shield"
  | "revive"
  | "headstart";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  icon: string; // emoji glyph used in the shop card
  maxLevel: number;
  /** Plumes cost for each level (length === maxLevel). */
  costs: number[];
  /** Human-readable effect for a given owned level (0 = none). */
  describe: (level: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "magnet",
    name: "Soul Magnet",
    blurb: "Widen the radius at which drifting souls are drawn to you.",
    icon: "🧲",
    maxLevel: 5,
    costs: [120, 220, 380, 600, 900],
    describe: (l) => (l ? `+${l * 34} px collect radius` : "No magnet"),
  },
  {
    id: "plumeGain",
    name: "Gilded Touch",
    blurb: "Earn more Plumes from every run.",
    icon: "🪶",
    maxLevel: 5,
    costs: [150, 280, 460, 720, 1100],
    describe: (l) => (l ? `+${l * 12}% Plumes earned` : "Base Plumes"),
  },
  {
    id: "shield",
    name: "Aegis",
    blurb: "Begin each run shielded. Each shield soaks one fatal hit.",
    icon: "🛡️",
    maxLevel: 3,
    costs: [400, 900, 1800],
    describe: (l) => (l ? `${l} shield${l > 1 ? "s" : ""} at start` : "No shield"),
  },
  {
    id: "revive",
    name: "Phoenix Token",
    blurb: "Once per run, rise from a fatal blow with a brief grace.",
    icon: "🔥",
    maxLevel: 1,
    costs: [2200],
    describe: (l) => (l ? "1 revive per run" : "No revive"),
  },
  {
    id: "headstart",
    name: "Launched Start",
    blurb: "Skip the slow opening — start further into the abyss.",
    icon: "🚀",
    maxLevel: 4,
    costs: [200, 380, 620, 950],
    describe: (l) => (l ? `+${l * 120} m head start` : "Start at 0 m"),
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

/** Cost of the NEXT level, or null if maxed. */
export function nextCost(def: UpgradeDef, owned: number): number | null {
  if (owned >= def.maxLevel) return null;
  return def.costs[owned];
}

// ---- typed effect getters: the ONLY way gameplay reads upgrade power ----

export interface UpgradeEffects {
  magnetRadius: number;
  plumeMultiplier: number;
  shields: number;
  hasRevive: boolean;
  headstartMeters: number;
}

export function computeEffects(levels: Record<string, number>): UpgradeEffects {
  const lv = (id: UpgradeId) => levels[id] ?? 0;
  return {
    magnetRadius: lv("magnet") * 34,
    plumeMultiplier: 1 + lv("plumeGain") * 0.12,
    shields: lv("shield"),
    hasRevive: lv("revive") > 0,
    headstartMeters: lv("headstart") * 120,
  };
}
