/**
 * THE single source of truth for every gameplay tuning value.
 *
 * Golden rule (see BRIEF §4): never hardcode a gameplay number anywhere else.
 * Everything that affects feel, difficulty or economy lives here so the game
 * can be re-tuned without touching logic.
 *
 * All speeds/accelerations are expressed in **units per second** (and per
 * second²) and are applied with delta-time, so the game feels identical on a
 * 60 Hz and a 120 Hz ProMotion display.
 *
 * The design resolution is portrait 720 × 1280; the renderer scales to fit.
 */

export const DESIGN = {
  width: 720,
  height: 1280,
} as const;

export const Balance = {
  // ---------------------------------------------------------------- crow ----
  crow: {
    x: 0.28, // fraction of width where the raven sits
    startY: 0.42, // fraction of height at run start
    radius: 26, // collision radius (forgiving — smaller than the sprite)
    // Vertical feel. Released = natural lift (drifts UP); hold = dive (DOWN).
    liftAccel: 1500, // upward acceleration when NOT pressing (px/s²)
    diveAccel: 4200, // downward acceleration while pressing (px/s²)
    maxRise: 720, // clamp upward velocity (px/s)
    maxFall: 1150, // clamp downward velocity (px/s)
    drag: 1.6, // velocity damping per second (silky settle)
    tiltUp: -22, // sprite angle at full rise (deg)
    tiltDown: 62, // sprite angle at full dive (deg)
    tiltLerp: 12, // how fast the sprite rotates toward target tilt
    flapFps: 14,
  },

  // -------------------------------------------------------------- world ----
  world: {
    startSpeed: 360, // initial scroll speed (px/s)
    maxSpeed: 920, // hard cap on scroll speed
    speedPerMeter: 0.55, // speed gained per metre travelled
    pixelsPerMeter: 90, // distance → metres conversion
    ceilingDeath: true, // touching top/bottom kills
    edgeGrace: 14, // px of forgiveness at the very edges
  },

  // ----------------------------------------------------------- obstacles ----
  obstacles: {
    width: 110, // visual/collision column width
    collisionInset: 18, // shrink hitbox horizontally for fairness
    gapStart: 430, // starting vertical gap (px)
    gapMin: 250, // smallest gap at max difficulty
    gapPerMeter: 0.22, // gap shrink per metre
    spacingStart: 460, // horizontal spacing between obstacles (px)
    spacingMin: 320,
    spacingPerMeter: 0.18,
    gapWander: 0.62, // how far (0..1 of free space) the gap centre can roam
    poolSize: 14,
    firstSpawnDelay: 520, // px of clear runway before the first obstacle
  },

  // --------------------------------------------------------- near-miss ----
  nearMiss: {
    margin: 46, // px clearance that still counts as a frôlement
    points: 25, // base points (× combo)
    slowMoScale: 0.45, // time scale during the slow-mo
    slowMoMs: 180, // real-time duration of the slow-mo
    cooldownMs: 120, // min gap between two near-miss triggers
  },

  // ------------------------------------------------------------- souls ----
  souls: {
    radius: 16,
    baseValue: 1, // souls added to combo meter / score base
    points: 12, // score per soul (× combo)
    plumes: 1, // raw plumes per soul (× plume multipliers)
    spawnChance: 0.82, // chance a gap contains souls
    minPerGap: 1,
    maxPerGap: 4,
    spacing: 54, // spacing when arranged in a line
    magnetBaseRadius: 0, // extra collect radius from upgrades adds to this
    bob: 6, // float bob amplitude (px)
  },

  // ------------------------------------------------------------- combo ----
  combo: {
    perSouls: 3, // souls needed to raise the multiplier by 1 step
    step: 1, // multiplier increment per step
    max: 12, // multiplier cap
    decayMs: 2600, // time without a soul before the meter starts dropping
    drainMs: 1400, // once decaying, time to lose one step
  },

  // ----------------------------------------------------------- scoring ----
  scoring: {
    distanceWeight: 1, // points per metre
  },

  // --------------------------------------------------------- economy ----
  economy: {
    plumesPerScore: 0.04, // plumes from final score
    plumesPerMeter: 0.06, // plumes from distance
    chestBase: 12, // guaranteed plumes in the post-run chest
    chestPerMilestone: 6, // bonus per 250 m milestone reached
    bonusChance: 0.22, // chance of a variable jackpot in the chest
    bonusMin: 25,
    bonusMax: 120,
    milestoneMeters: 250, // distance between milestone rewards
  },

  // ------------------------------------------------------------- xp ----
  xp: {
    perScore: 0.05,
    perMeter: 0.04,
    perSoul: 2,
    perNearMiss: 3,
    // reward-track level n requires base * n + quad * n²
    levelBase: 120,
    levelQuad: 18,
    maxLevel: 60,
  },

  // ---------------------------------------------------- game feel / juice ----
  feel: {
    shakeDeath: { duration: 360, intensity: 0.018 },
    shakeNearMiss: { duration: 90, intensity: 0.004 },
    hitStopMs: 90, // micro-freeze on death impact
    trailQuantity: 1, // particles per frame behind the crow
    flashMs: 90,
    comboPopScale: 1.55,
  },

  // ------------------------------------------------------------ audio ----
  audio: {
    musicVolume: 0.7, // 0..1 default music slider
    sfxVolume: 0.85, // 0..1 default sfx slider
    masterDb: -3, // limiter ceiling-ish trim on master
    // music intensity layers unlock at these metre thresholds
    intensityMeters: [0, 180, 450, 850, 1400],
  },

  // ------------------------------------------------------------ revive ----
  revive: {
    invulnMs: 1400, // grace window after a revive
    cooldownRuns: 1, // (reserved) regen pacing
  },

  // --------------------------------------------------------- difficulty ----
  // Convenience: distance at which the game is considered "max difficulty".
  difficulty: {
    rampMeters: 1600,
  },
} as const;

export type BalanceConfig = typeof Balance;
