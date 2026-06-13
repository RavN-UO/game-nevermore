/**
 * Cosmetic raven skins. Cosmetic-only by design (no pay-to-win — see BRIEF
 * §1.4). Each skin tints the silhouette and, more importantly, recolours the
 * particle trail and eye glow, which is what really reads in motion.
 *
 * Skins are unlocked either by spending Plumes or by earning an achievement.
 */

export interface Skin {
  id: string;
  name: string;
  blurb: string;
  /** Plumes price. 0 = free / starter. -1 = not purchasable (achievement). */
  price: number;
  bodyColor: number;
  edgeColor: number;
  /** Trail + eye accent — the signature colour of the skin. */
  accentColor: number;
  /** Optional achievement id that unlocks this skin for free. */
  unlockedBy?: string;
}

export const SKINS: Skin[] = [
  {
    id: "raven",
    name: "Raven",
    blurb: "The original messenger of the abyss.",
    price: 0,
    bodyColor: 0x0d0e1a,
    edgeColor: 0x2a2f5a,
    accentColor: 0x7be0ff,
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Ash on its wings, fire in its wake.",
    price: 350,
    bodyColor: 0x1a0e0c,
    edgeColor: 0x5a2a1f,
    accentColor: 0xff7a40,
  },
  {
    id: "wraith",
    name: "Wraith",
    blurb: "Half here, half elsewhere.",
    price: 600,
    bodyColor: 0x141430,
    edgeColor: 0x4a4a8a,
    accentColor: 0x9a7bff,
  },
  {
    id: "bone",
    name: "Bone",
    blurb: "Picked clean by the wind.",
    price: 900,
    bodyColor: 0xe8e4d8,
    edgeColor: 0x9a958a,
    accentColor: 0xfff2c4,
  },
  {
    id: "verdigris",
    name: "Verdigris",
    blurb: "Copper feathers gone green with age.",
    price: 1400,
    bodyColor: 0x0c1a16,
    edgeColor: 0x2a5a48,
    accentColor: 0x5dffb0,
  },
  {
    id: "gilded",
    name: "Gilded",
    blurb: "A cathedral relic, taken flight.",
    price: 2400,
    bodyColor: 0x1a1408,
    edgeColor: 0x6a521f,
    accentColor: 0xffd76a,
  },
  {
    id: "void",
    name: "Void",
    blurb: "Unlocked by reaching 1500 m. Light bends around it.",
    price: -1,
    bodyColor: 0x000000,
    edgeColor: 0x1a1a3a,
    accentColor: 0xff3d8a,
    unlockedBy: "marathon",
  },
  {
    id: "seraph",
    name: "Seraph",
    blurb: "Unlocked at a ×12 combo. It should not exist down here.",
    price: -1,
    bodyColor: 0xf4f6ff,
    edgeColor: 0xc4d0ff,
    accentColor: 0x7be0ff,
    unlockedBy: "combomaster",
  },
];

export const SKINS_BY_ID: Record<string, Skin> = Object.fromEntries(
  SKINS.map((s) => [s.id, s]),
);

export function getSkin(id: string): Skin {
  return SKINS_BY_ID[id] ?? SKINS[0];
}
