import Phaser from "phaser";
import { Balance, DESIGN } from "../config/balance";
import { Palette } from "../config/theme";
import { Tex, CROW_FRAMES } from "../gfx/TextureFactory";
import { ObjectPool } from "../systems/ObjectPool";
import { ComboSystem } from "../systems/ComboSystem";
import { difficultyFor } from "../systems/DifficultySystem";
import { eventBus, GameEvent } from "../systems/EventBus";
import { getSkin } from "../data/skins";
import type { UpgradeEffects } from "../data/upgrades";
import { getServices } from "../ui/Widgets";
import type { Services } from "../systems/Services";

type ParticleEmitter = Phaser.GameObjects.Particles.ParticleEmitter;

interface Obstacle {
  top: Phaser.GameObjects.Image;
  bottom: Phaser.GameObjects.Image;
  x: number;
  gapCenter: number;
  gapHalf: number;
  passed: boolean;
  nearMissDone: boolean;
  active: boolean;
}

interface Soul {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  baseY: number;
  phase: number;
  collected: boolean;
  active: boolean;
}

/**
 * The core loop (BRIEF §1 / Phase 1) — the thing everything else hangs off.
 * Custom delta-time physics for a weighty-but-responsive raven, pooled
 * obstacles + souls, near-miss detection with slow-mo, combo, and an instant,
 * menu-free restart.
 */
export class GameScene extends Phaser.Scene {
  private svc!: Services;
  private effects!: UpgradeEffects;

  // background
  private ridgeFar!: Phaser.GameObjects.TileSprite;
  private ridgeMid!: Phaser.GameObjects.TileSprite;
  private ridgeNear!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;

  // crow
  private crow!: Phaser.GameObjects.Container;
  private crowBody!: Phaser.GameObjects.Sprite;
  private crowX = 0;
  private crowY = 0;
  private vy = 0;
  private targetTilt = 0;

  // particles
  private trail!: ParticleEmitter;
  private deathBurst!: ParticleEmitter;
  private collectBurst!: ParticleEmitter;
  private ringPool: Phaser.GameObjects.Image[] = [];
  private ringIndex = 0;

  // input
  private diving = false;
  private pointerCount = 0;

  // obstacles + souls
  private obstaclePool!: ObjectPool<Obstacle>;
  private soulPool!: ObjectPool<Soul>;
  private obstacles: Obstacle[] = [];
  private souls: Soul[] = [];
  private nextSpawnX = 0;

  // run state
  private combo = new ComboSystem();
  private running = false;
  private dead = false;
  private distancePx = 0;
  private meters = 0;
  private bonusScore = 0;
  private score = 0;
  private soulsCollected = 0;
  private nearMisses = 0;
  private intensityTier = -1;
  private lastMilestone = 0;
  private invuln = 0;
  private shields = 0;
  private reviveUsed = false;
  private slowFactor = 1;
  private slowTimer = 0;
  private nearMissCd = 0;

  constructor() {
    super("Game");
  }

  create(): void {
    this.svc = getServices(this);
    this.effects = this.svc.effects();
    const W = DESIGN.width;
    const H = DESIGN.height;

    this.cameras.main.setBackgroundColor(Palette.ink);
    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H).setDepth(0);

    // parallax (tile-sprites — efficient, no per-frame redraw)
    this.ridgeFar = this.add.tileSprite(0, H, W, 420, Tex.ridgeFar).setOrigin(0, 1).setDepth(1).setAlpha(0.7);
    this.ridgeMid = this.add.tileSprite(0, H, W, 420, Tex.ridgeMid).setOrigin(0, 1).setDepth(2).setAlpha(0.85);
    this.fog = this.add.tileSprite(0, H * 0.72, W, 260, Tex.fog).setOrigin(0, 0.5).setDepth(3);
    this.ridgeNear = this.add.tileSprite(0, H, W, 420, Tex.ridgeNear).setOrigin(0, 1).setDepth(4);

    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(60);

    this.buildCrow();
    this.buildParticles();
    this.buildPools();

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);
    const space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    space?.on("down", () => this.setDiving(true));
    space?.on("up", () => this.setDiving(false));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.startRun();
  }

  // ----------------------------------------------------------- build ----
  private buildCrow(): void {
    const skin = getSkin(this.svc.save.get().selectedSkin);
    if (!this.anims.exists("flap")) {
      this.anims.create({
        key: "flap",
        frames: CROW_FRAMES.map((key) => ({ key })).concat([{ key: CROW_FRAMES[1] }]),
        frameRate: Balance.crow.flapFps,
        repeat: -1,
      });
    }
    // soft accent halo so the (deliberately dark) raven always reads against
    // the dark sky — and it looks suitably ghostly.
    const backlight = this.add
      .image(2, 0, Tex.glow)
      .setScale(2.6)
      .setAlpha(0.38)
      .setTint(skin.accentColor)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.crowBody = this.add.sprite(0, 0, CROW_FRAMES[1]).setTint(skin.bodyColor);
    this.crowBody.play("flap");
    const eye = this.add
      .image(30, -6, Tex.eye)
      .setScale(0.7)
      .setTint(skin.accentColor)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.crow = this.add.container(0, 0, [backlight, this.crowBody, eye]).setDepth(20);
    this.tweens.add({ targets: backlight, alpha: 0.55, scale: 2.9, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  private buildParticles(): void {
    const skin = getSkin(this.svc.save.get().selectedSkin);
    this.trail = this.add
      .particles(0, 0, Tex.glow, {
        lifespan: 440,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.6, end: 0 },
        speedX: { min: -50, max: -12 },
        speedY: { min: -10, max: 10 },
        frequency: 20,
        quantity: 1,
        blendMode: "ADD",
        tint: skin.accentColor,
      })
      .setDepth(15);
    this.trail.startFollow(this.crow, -14, 4);

    this.deathBurst = this.add
      .particles(0, 0, Tex.shard, {
        lifespan: 800,
        speed: { min: 120, max: 460 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: "ADD",
        emitting: false,
        tint: [skin.accentColor, Palette.ember, Palette.bone],
      })
      .setDepth(40);

    this.collectBurst = this.add
      .particles(0, 0, Tex.glow, {
        lifespan: 460,
        speed: { min: 40, max: 160 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.9, end: 0 },
        blendMode: "ADD",
        emitting: false,
        tint: Palette.accent,
      })
      .setDepth(18);

    for (let i = 0; i < 6; i++) {
      const r = this.add.image(0, 0, Tex.ring).setDepth(19).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
      this.ringPool.push(r);
    }
  }

  private buildPools(): void {
    this.obstaclePool = new ObjectPool<Obstacle>(
      () => {
        const top = this.add.image(0, 0, Tex.spire).setOrigin(0.5, 1).setFlipY(true).setDepth(5).setVisible(false);
        const bottom = this.add.image(0, 0, Tex.spire).setOrigin(0.5, 0).setDepth(5).setVisible(false);
        return { top, bottom, x: 0, gapCenter: 0, gapHalf: 0, passed: false, nearMissDone: false, active: false };
      },
      Balance.obstacles.poolSize,
      (o) => {
        o.active = false;
        o.top.setVisible(false);
        o.bottom.setVisible(false);
      },
    );

    this.soulPool = new ObjectPool<Soul>(
      () => {
        const img = this.add
          .image(0, 0, Tex.soul)
          .setDepth(8)
          .setVisible(false)
          .setBlendMode(Phaser.BlendModes.ADD);
        return { img, x: 0, y: 0, baseY: 0, phase: 0, collected: false, active: false };
      },
      24,
      (s) => {
        s.active = false;
        s.img.setVisible(false);
      },
    );
  }

  // ------------------------------------------------------------ run ----
  private startRun(): void {
    const W = DESIGN.width;
    const H = DESIGN.height;
    this.crowX = W * Balance.crow.x;
    this.crowY = H * Balance.crow.startY;
    this.vy = 0;
    this.targetTilt = 0;
    this.crow.setPosition(this.crowX, this.crowY).setAngle(0).setScale(1).setAlpha(1);
    this.crowBody.setAlpha(1);
    this.trail.emitting = true;

    // recycle any leftover entities
    this.obstacles.forEach((o) => this.obstaclePool.release(o));
    this.souls.forEach((s) => this.soulPool.release(s));
    this.obstacles.length = 0;
    this.souls.length = 0;

    this.distancePx = 0;
    this.meters = 0;
    this.bonusScore = 0;
    this.score = 0;
    this.soulsCollected = 0;
    this.nearMisses = 0;
    this.lastMilestone = 0;
    this.intensityTier = -1;
    this.nextSpawnX = W + Balance.obstacles.firstSpawnDelay;
    this.combo.reset();

    this.shields = this.effects.shields;
    this.reviveUsed = false;
    this.invuln = Balance.world.startGraceMs;
    this.slowFactor = 1;
    this.slowTimer = 0;
    this.nearMissCd = 0;

    this.dead = false;
    this.running = true;

    // head-start upgrade
    const head = this.effects.headstartMeters;
    if (head > 0) {
      this.meters = head;
      this.distancePx = head * Balance.world.pixelsPerMeter;
    }

    // carry the restart tap into the first dive if a finger is already down
    this.pointerCount = this.input.activePointer.isDown ? 1 : 0;
    this.diving = this.pointerCount > 0;

    if (!this.scene.isActive("UI")) this.scene.launch("UI");
    eventBus().emit(GameEvent.RunStart, { shields: this.shields, hasRevive: this.effects.hasRevive });
    if (this.shields > 0) eventBus().emit(GameEvent.ShieldBreak, this.shields); // initial shield count
    this.svc.audio.playGame();
  }

  // ---------------------------------------------------------- input ----
  private onPointerDown(): void {
    this.pointerCount++;
    this.setDiving(true);
  }

  private onPointerUp(): void {
    this.pointerCount = Math.max(0, this.pointerCount - 1);
    if (this.pointerCount === 0) this.setDiving(false);
  }

  private setDiving(on: boolean): void {
    this.diving = on;
  }

  // --------------------------------------------------------- update ----
  override update(_time: number, delta: number): void {
    if (!this.running) return;
    const dtReal = Math.min(delta, 50) / 1000; // clamp huge frames (tab switch)

    // slow-mo handling (near-miss)
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    const dt = dtReal * this.slowFactor;

    if (this.invuln > 0) this.invuln -= delta;
    if (this.nearMissCd > 0) this.nearMissCd -= delta;

    if (this.dead) {
      this.updateBackground(dt * 0.2);
      return;
    }

    const diff = difficultyFor(this.meters);

    this.updatePhysics(dt);
    this.updateBackground(dt * (diff.speed / Balance.world.startSpeed));
    this.updateWorld(dt, diff);
    this.combo.update(delta * this.slowFactor);
    this.updateScore();
    this.updateIntensity(diff.intensityTier);
    this.checkBoundsDeath();
  }

  private updatePhysics(dt: number): void {
    const c = Balance.crow;
    const accel = this.diving ? c.diveAccel : -c.liftAccel;
    this.vy += accel * dt;
    this.vy -= this.vy * c.drag * dt; // gentle damping
    this.vy = Phaser.Math.Clamp(this.vy, -c.maxRise, c.maxFall);
    this.crowY += this.vy * dt;

    // tilt from velocity, smoothed for silkiness
    const t = Phaser.Math.Clamp(this.vy / c.maxFall, -1, 1);
    this.targetTilt = t >= 0 ? t * c.tiltDown : t * -c.tiltUp;
    const cur = this.crow.angle;
    this.crow.setAngle(cur + (this.targetTilt - cur) * Math.min(1, c.tiltLerp * dt));
    this.crow.setPosition(this.crowX, this.crowY);
  }

  private updateBackground(dt: number): void {
    const base = Balance.world.startSpeed;
    this.ridgeFar.tilePositionX += base * 0.08 * dt;
    this.ridgeMid.tilePositionX += base * 0.18 * dt;
    this.fog.tilePositionX += base * 0.32 * dt;
    this.ridgeNear.tilePositionX += base * 0.5 * dt;
  }

  private updateWorld(dt: number, diff: ReturnType<typeof difficultyFor>): void {
    const move = diff.speed * dt;
    this.distancePx += move;
    this.meters = this.distancePx / Balance.world.pixelsPerMeter;

    // scroll + recycle obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x -= move;
      o.top.x = o.x;
      o.bottom.x = o.x;

      // near-miss check at the moment the column passes the crow
      if (!o.nearMissDone && o.x <= this.crowX) {
        o.nearMissDone = true;
        this.checkNearMiss(o);
      }
      if (!o.passed && o.x < this.crowX) o.passed = true;

      // collision
      if (this.invuln <= 0) this.checkObstacleCollision(o);

      if (o.x < -Balance.obstacles.width) {
        this.obstaclePool.release(o);
        this.obstacles.splice(i, 1);
      }
    }
    this.nextSpawnX -= move;

    // souls
    const collectR = Balance.crow.radius + Balance.souls.radius;
    const pullR = collectR + this.effects.magnetRadius;
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const s = this.souls[i];
      s.x -= move;
      s.phase += dt * 4;
      let sy = s.baseY + Math.sin(s.phase) * Balance.souls.bob;
      const dx = this.crowX - s.x;
      const dy = this.crowY - sy;
      const dist = Math.hypot(dx, dy);
      if (this.effects.magnetRadius > 0 && dist < pullR) {
        // magnet pull
        const pull = (1 - dist / pullR) * 600 * dt;
        s.x += (dx / (dist || 1)) * pull;
        s.baseY += (dy / (dist || 1)) * pull;
        sy = s.baseY + Math.sin(s.phase) * Balance.souls.bob;
      }
      s.y = sy;
      s.img.setPosition(s.x, s.y);
      s.img.setScale(0.85 + Math.sin(s.phase * 1.5) * 0.12);

      if (!s.collected && dist < collectR) {
        this.collectSoul(s);
      }
      if (s.x < -40 || s.collected) {
        this.soulPool.release(s);
        this.souls.splice(i, 1);
      }
    }

    // spawn ahead
    if (this.nextSpawnX <= DESIGN.width) {
      this.spawnObstacle(diff);
    }
  }

  private spawnObstacle(diff: ReturnType<typeof difficultyFor>): void {
    const H = DESIGN.height;
    const o = this.obstaclePool.obtain();
    const margin = 120; // keep gap away from very top/bottom
    const half = diff.gap / 2;
    const minC = margin + half;
    const maxC = H - margin - half;
    // gap centre wanders within an allowed band
    const span = (maxC - minC) * Balance.obstacles.gapWander;
    const mid = (minC + maxC) / 2;
    const gapCenter = Phaser.Math.Clamp(
      mid + (Math.random() - 0.5) * span * 2,
      minC,
      maxC,
    );

    const tex = Math.random() < 0.5 ? Tex.spire : Tex.fang;
    o.x = DESIGN.width + Balance.obstacles.width;
    o.gapCenter = gapCenter;
    o.gapHalf = half;
    o.passed = false;
    o.nearMissDone = false;
    o.active = true;

    o.top.setTexture(tex).setPosition(o.x, gapCenter - half).setVisible(true);
    o.bottom.setTexture(tex).setPosition(o.x, gapCenter + half).setVisible(true);
    this.obstacles.push(o);

    this.maybeSpawnSouls(o);

    this.nextSpawnX = o.x + diff.spacing;
  }

  private maybeSpawnSouls(o: Obstacle): void {
    if (Math.random() > Balance.souls.spawnChance) return;
    const count = Phaser.Math.Between(Balance.souls.minPerGap, Balance.souls.maxPerGap);
    const totalH = (count - 1) * Balance.souls.spacing;
    const start = o.gapCenter - totalH / 2;
    for (let i = 0; i < count; i++) {
      const s = this.soulPool.obtain();
      s.x = o.x;
      s.baseY = Phaser.Math.Clamp(start + i * Balance.souls.spacing, o.gapCenter - o.gapHalf + 20, o.gapCenter + o.gapHalf - 20);
      s.phase = Math.random() * Math.PI * 2;
      s.y = s.baseY;
      s.collected = false;
      s.active = true;
      s.img.setPosition(s.x, s.y).setScale(0.85).setAlpha(1).setVisible(true).setTint(Palette.accent);
      this.souls.push(s);
    }
  }

  // ------------------------------------------------------- collisions ----
  private checkObstacleCollision(o: Obstacle): void {
    const halfW = Balance.obstacles.width / 2 - Balance.obstacles.collisionInset;
    const r = Balance.crow.radius;
    if (this.crowX + r < o.x - halfW || this.crowX - r > o.x + halfW) return;
    const gapTop = o.gapCenter - o.gapHalf;
    const gapBottom = o.gapCenter + o.gapHalf;
    if (this.crowY - r < gapTop || this.crowY + r > gapBottom) {
      this.onLethalHit();
    }
  }

  private checkNearMiss(o: Obstacle): void {
    if (this.nearMissCd > 0) return;
    const r = Balance.crow.radius;
    const gapTop = o.gapCenter - o.gapHalf;
    const gapBottom = o.gapCenter + o.gapHalf;
    const clearTop = this.crowY - r - gapTop;
    const clearBottom = gapBottom - (this.crowY + r);
    const clearance = Math.min(clearTop, clearBottom);
    if (clearance >= 0 && clearance <= Balance.nearMiss.margin) {
      this.triggerNearMiss();
    }
  }

  private triggerNearMiss(): void {
    this.nearMisses++;
    this.nearMissCd = Balance.nearMiss.cooldownMs;
    const pts = Math.round(Balance.nearMiss.points * this.combo.multiplier);
    this.bonusScore += pts;

    // slow-mo
    this.slowFactor = Balance.nearMiss.slowMoScale;
    this.slowTimer = Balance.nearMiss.slowMoMs;

    // ring + shake + sfx + haptic
    this.popRing();
    this.cameras.main.shake(Balance.feel.shakeNearMiss.duration, Balance.feel.shakeNearMiss.intensity);
    this.svc.audio.sfxNearMiss();
    this.svc.haptics.fire("light");
    eventBus().emit(GameEvent.NearMiss, { count: this.nearMisses, points: pts, x: this.crowX, y: this.crowY });
  }

  private popRing(): void {
    const r = this.ringPool[this.ringIndex];
    this.ringIndex = (this.ringIndex + 1) % this.ringPool.length;
    r.setPosition(this.crowX, this.crowY).setScale(0.4).setAlpha(0.9).setVisible(true);
    this.tweens.add({
      targets: r,
      scale: 1.8,
      alpha: 0,
      duration: 360,
      ease: "Cubic.out",
      onComplete: () => r.setVisible(false),
    });
  }

  private collectSoul(s: Soul): void {
    s.collected = true;
    this.soulsCollected++;
    this.combo.collect();
    const pts = Math.round(Balance.souls.points * this.combo.multiplier);
    this.bonusScore += pts;

    this.collectBurst.explode(7, s.x, s.y);
    this.svc.audio.sfxCollect(Math.round((this.combo.multiplier - 1)));
    this.svc.haptics.fire("tick");
    eventBus().emit(GameEvent.SoulCollect, { value: pts, x: s.x, y: s.y, total: this.soulsCollected });
  }

  private checkBoundsDeath(): void {
    if (this.invuln > 0) return;
    const r = Balance.crow.radius;
    const g = Balance.world.edgeGrace;
    if (this.crowY - r < g || this.crowY + r > DESIGN.height - g) {
      this.onLethalHit(true);
    }
  }

  // ----------------------------------------------------------- death ----
  private onLethalHit(_bounds = false): void {
    // Shield soak
    if (this.shields > 0) {
      this.shields--;
      this.invuln = 700;
      this.vy = -Balance.crow.maxRise * 0.4;
      this.svc.audio.sfxShield();
      this.svc.haptics.fire("medium");
      this.cameras.main.flash(120, 122, 200, 255);
      eventBus().emit(GameEvent.ShieldBreak, this.shields);
      return;
    }
    // Revive token
    if (this.effects.hasRevive && !this.reviveUsed) {
      this.reviveUsed = true;
      this.invuln = Balance.revive.invulnMs;
      this.crowY = DESIGN.height * 0.45;
      this.vy = 0;
      // clear obstacles overlapping the crow so the revive is fair
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const o = this.obstacles[i];
        if (Math.abs(o.x - this.crowX) < 260) {
          this.obstaclePool.release(o);
          this.obstacles.splice(i, 1);
        }
      }
      this.svc.audio.sfxRevive();
      this.svc.haptics.fire("success");
      this.cameras.main.flash(260, 200, 160, 255);
      eventBus().emit(GameEvent.Revive, {});
      return;
    }
    this.die();
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.running = true; // keep update alive for fx, but `dead` gates gameplay
    this.diving = false;
    this.trail.emitting = false;

    // juice: hit-stop, shake, flash, burst
    this.deathBurst.explode(30, this.crowX, this.crowY);
    this.cameras.main.shake(Balance.feel.shakeDeath.duration, Balance.feel.shakeDeath.intensity);
    this.cameras.main.flash(Balance.feel.flashMs, 255, 80, 90);
    this.svc.audio.sfxDeath();
    this.svc.haptics.fire("heavy");
    this.svc.audio.stopMusic(0.4);

    // knocked from the sky: a short upward kick, then tumble and fall away
    this.tweens.add({ targets: this.crow, y: this.crowY - 40, duration: 180, ease: "Quad.out" });
    this.tweens.add({ targets: this.crow, angle: this.crow.angle + 220, duration: 900, ease: "Linear" });
    this.tweens.add({ targets: this.crow, y: DESIGN.height + 120, delay: 160, duration: 820, ease: "Quad.in" });
    this.tweens.add({ targets: this.crow, alpha: 0, delay: 520, duration: 500 });

    eventBus().emit(GameEvent.Death, {});

    const summary = this.svc.finishRun({
      score: this.score,
      distanceM: Math.floor(this.meters),
      souls: this.soulsCollected,
      nearMisses: this.nearMisses,
      bestCombo: this.combo.bestMultiplier,
    });

    // small delay (hit-stop feel) before the reward overlay
    this.time.delayedCall(Balance.feel.hitStopMs + 260, () => {
      this.scene.launch("Death", { summary });
    });
  }

  // ---------------------------------------------------------- score ----
  private updateScore(): void {
    const distScore = Math.floor(this.meters * Balance.scoring.distanceWeight);
    const newScore = distScore + this.bonusScore;
    if (newScore !== this.score) {
      this.score = newScore;
      eventBus().emit(GameEvent.ScoreUpdate, this.score);
    }
    eventBus().emit(GameEvent.DistanceUpdate, Math.floor(this.meters));

    const ms = Math.floor(this.meters / Balance.economy.milestoneMeters);
    if (ms > this.lastMilestone) {
      this.lastMilestone = ms;
      this.svc.audio.sfxMilestone();
      eventBus().emit(GameEvent.Milestone, ms * Balance.economy.milestoneMeters);
    }
  }

  private updateIntensity(tier: number): void {
    if (tier !== this.intensityTier) {
      this.intensityTier = tier;
      this.svc.audio.setIntensity(tier);
      eventBus().emit(GameEvent.IntensityUpdate, tier);
    }
  }

  private onShutdown(): void {
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointerup", this.onPointerUp, this);
  }
}
