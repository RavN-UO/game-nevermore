import Phaser from "phaser";
import { Palette, mixColor } from "../config/theme";
import { eventBus, GameEvent } from "../systems/EventBus";
import { textStyle, displayStyle, getServices } from "../ui/Widgets";

/**
 * Parallel HUD scene drawn above the gameplay (BRIEF §4). It owns no state — it
 * just listens to the EventBus and reflects it: score, distance, the combo
 * multiplier with its decay bar, shield pips, and floating "+pts" / near-miss
 * feedback. UIScene and GameScene share the 720×1280 design space, so world
 * coordinates from gameplay events map straight onto HUD positions.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private distText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboBar!: Phaser.GameObjects.Graphics;
  private comboFreshness = 1;
  private comboMult = 1;
  private shieldPips!: Phaser.GameObjects.Container;
  private hint?: Phaser.GameObjects.Text;

  constructor() {
    super("UI");
  }

  create(): void {
    const W = this.scale.width;

    this.scoreText = this.add
      .text(W / 2, 88, "0", displayStyle(72, Palette.bone))
      .setOrigin(0.5)
      .setDepth(10);
    this.scoreText.setShadow(0, 0, "#7be0ff", 16, false, true);

    this.distText = this.add
      .text(W / 2, 142, "0 m", textStyle(28, Palette.smoke))
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.comboText = this.add
      .text(W / 2, 220, "", displayStyle(56, Palette.accent))
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);
    this.comboBar = this.add.graphics().setDepth(10);

    this.shieldPips = this.add.container(40, 60);

    this.bind();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.unbind, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.unbind, this);
  }

  private bind(): void {
    const bus = eventBus();
    bus.on(GameEvent.RunStart, this.onRunStart, this);
    bus.on(GameEvent.ScoreUpdate, this.onScore, this);
    bus.on(GameEvent.DistanceUpdate, this.onDist, this);
    bus.on(GameEvent.ComboUpdate, this.onCombo, this);
    bus.on(GameEvent.SoulCollect, this.onSoul, this);
    bus.on(GameEvent.NearMiss, this.onNearMiss, this);
    bus.on(GameEvent.Milestone, this.onMilestone, this);
    bus.on(GameEvent.ShieldBreak, this.onShields, this);
    bus.on(GameEvent.Revive, this.onRevive, this);
    bus.on(GameEvent.Death, this.onDeath, this);
  }

  private unbind(): void {
    const bus = eventBus();
    bus.off(GameEvent.RunStart, this.onRunStart, this);
    bus.off(GameEvent.ScoreUpdate, this.onScore, this);
    bus.off(GameEvent.DistanceUpdate, this.onDist, this);
    bus.off(GameEvent.ComboUpdate, this.onCombo, this);
    bus.off(GameEvent.SoulCollect, this.onSoul, this);
    bus.off(GameEvent.NearMiss, this.onNearMiss, this);
    bus.off(GameEvent.Milestone, this.onMilestone, this);
    bus.off(GameEvent.ShieldBreak, this.onShields, this);
    bus.off(GameEvent.Revive, this.onRevive, this);
    bus.off(GameEvent.Death, this.onDeath, this);
  }

  override update(): void {
    // combo decay bar
    this.comboBar.clear();
    if (this.comboMult > 1) {
      const w = 120;
      const x = this.comboText.x - w / 2;
      const y = this.comboText.y + 38;
      this.comboBar.fillStyle(Palette.skyBottom, 0.6);
      this.comboBar.fillRoundedRect(x, y, w, 8, 4);
      const col = mixColor(Palette.danger, Palette.accent, this.comboFreshness);
      this.comboBar.fillStyle(col, 0.95);
      this.comboBar.fillRoundedRect(x, y, w * this.comboFreshness, 8, 4);
    }
  }

  // --------------------------------------------------------- handlers ----
  private onRunStart(): void {
    this.scoreText.setText("0");
    this.distText.setText("0 m");
    this.comboMult = 1;
    this.comboText.setAlpha(0).setText("");
    this.shieldPips.removeAll(true);

    const svc = getServices(this);
    if (svc.save.get().totalRuns === 0 && !this.hint) {
      this.hint = this.add
        .text(this.scale.width / 2, this.scale.height * 0.62, "HOLD TO DIVE — RELEASE TO RISE", textStyle(26, Palette.bone))
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(12);
      this.tweens.add({ targets: this.hint, alpha: 1, duration: 400, yoyo: true, hold: 2200, onComplete: () => this.hint?.destroy() });
    }
  }

  private onScore(score: number): void {
    this.scoreText.setText(this.format(score));
  }

  private onDist(m: number): void {
    this.distText.setText(`${m} m`);
  }

  private onCombo(data: { multiplier: number; freshness: number; popped: boolean }): void {
    this.comboFreshness = data.freshness;
    this.comboMult = data.multiplier;
    if (data.multiplier <= 1) {
      this.tweens.add({ targets: this.comboText, alpha: 0, duration: 200 });
      return;
    }
    this.comboText.setText(`×${data.multiplier}`);
    if (this.comboText.alpha < 1) this.comboText.setAlpha(1);
    if (data.popped) {
      this.comboText.setScale(1.4);
      this.comboText.setColor("#ffffff");
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 220, ease: "Back.out" });
      this.time.delayedCall(120, () => this.comboText.setColor("#7be0ff"));
    }
  }

  private onSoul(data: { value: number; x: number; y: number }): void {
    this.floatText(data.x, data.y, `+${data.value}`, Palette.accent, 24);
  }

  private onNearMiss(data: { points: number; x: number; y: number }): void {
    this.floatText(data.x, data.y - 40, `NEAR MISS  +${data.points}`, Palette.gold, 30);
  }

  private onMilestone(meters: number): void {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height * 0.34, `${meters} m`, displayStyle(64, Palette.violet))
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(11);
    t.setShadow(0, 0, "#9a7bff", 20, false, true);
    this.tweens.add({ targets: t, alpha: 0.9, scale: 1.1, duration: 300, yoyo: true, hold: 500, onComplete: () => t.destroy() });
  }

  private onShields(count: number): void {
    this.shieldPips.removeAll(true);
    for (let i = 0; i < count; i++) {
      const pip = this.add.text(i * 38, 0, "🛡️", textStyle(28)).setOrigin(0, 0.5);
      this.shieldPips.add(pip);
    }
  }

  private onRevive(): void {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height * 0.42, "REBORN", displayStyle(70, Palette.good))
      .setOrigin(0.5)
      .setDepth(12);
    t.setShadow(0, 0, "#5dffa0", 22, false, true);
    this.tweens.add({ targets: t, alpha: 0, scale: 1.6, duration: 900, onComplete: () => t.destroy() });
  }

  private onDeath(): void {
    this.tweens.add({ targets: [this.scoreText, this.distText, this.comboText], alpha: 0.0, duration: 200 });
  }

  // ---------------------------------------------------------- helpers ----
  private floatText(x: number, y: number, msg: string, color: number, size: number): void {
    const t = this.add.text(x, y, msg, textStyle(size, color)).setOrigin(0.5).setDepth(11);
    t.setShadow(0, 0, "#000000", 6, true, true);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 760, ease: "Cubic.out", onComplete: () => t.destroy() });
  }

  private format(n: number): string {
    return n >= 1000 ? n.toLocaleString("en-US") : String(n);
  }
}
