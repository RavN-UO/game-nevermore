import Phaser from "phaser";
import { Palette } from "../config/theme";
import { Tex } from "../gfx/TextureFactory";
import { getSkin } from "../data/skins";
import { dailyLabel } from "../data/dailyChallenges";
import { levelProgress } from "../systems/ProgressionSystem";
import {
  textStyle,
  displayStyle,
  button,
  iconButton,
  plumesBadge,
  roundedPanel,
  slider,
  toast,
  getServices,
  type PlumesBadge,
} from "../ui/Widgets";
import type { Services } from "../systems/Services";

/**
 * Home screen (BRIEF §4): best score, currency (tap to open the shop), account
 * level, the big PLAY button, ranks access, the daily challenge card, the
 * daily-streak reward on first open of the day, and a settings panel.
 *
 * Modals here are self-contained overlays that destroy themselves on dismiss —
 * they never call scene.restart(), so they can't leave the menu unclickable.
 */
export class MenuScene extends Phaser.Scene {
  private svc!: Services;
  private ridgeNear!: Phaser.GameObjects.TileSprite;
  private ridgeMid!: Phaser.GameObjects.TileSprite;
  private badge!: PlumesBadge;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    // Resolve the daily streak FIRST so the currency shown is already updated.
    const streakRes = this.svc.updateStreakOnLaunch();

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.ridgeMid = this.add.tileSprite(0, H, W, 420, Tex.ridgeMid).setOrigin(0, 1).setAlpha(0.7);
    this.ridgeNear = this.add.tileSprite(0, H, W, 420, Tex.ridgeNear).setOrigin(0, 1);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(2);

    if (this.svc.audio.isReady) this.svc.audio.playMenu();

    // drifting raven with the active skin
    const skin = getSkin(this.svc.save.get().selectedSkin);
    this.add.image(W / 2, H * 0.33, Tex.glow).setScale(5).setAlpha(0.3).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    const crow = this.add.image(W / 2, H * 0.33, Tex.crow0).setScale(1.7).setTint(skin.bodyColor).setDepth(3);
    this.add.image(crow.x + 30, crow.y - 12, Tex.eye).setScale(0.8).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.tweens.add({ targets: crow, y: crow.y - 16, angle: 5, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // title
    const title = this.add.text(W / 2, H * 0.46, "NEVERMORE", displayStyle(72, Palette.bone)).setOrigin(0.5).setLetterSpacing(8).setDepth(3);
    title.setShadow(0, 0, "#7be0ff", 22, false, true);

    const save = this.svc.save.get();
    this.add.text(W / 2, H * 0.52, `BEST  ${save.highScore.toLocaleString("en-US")}`, textStyle(28, Palette.accent)).setOrigin(0.5).setLetterSpacing(2).setDepth(3);

    // top bar: level (left) + plumes (right, taps to open the shop)
    this.buildPlumesButton(save.plumes);
    this.buildLevelBadge();

    // PLAY
    button(this, W / 2, H * 0.64, "PLAY", () => this.play(), {
      w: 360,
      h: 96,
      size: 44,
      display: true,
      fill: Palette.accentSoft,
      textColor: Palette.ink,
    }).setDepth(4);

    // secondary nav — shop is reached via the Plumes counter, so only RANKS here
    button(this, W / 2, H * 0.735, "RANKS", () => this.scene.start("Leaderboard"), { w: 240, h: 76, size: 26 }).setDepth(4);
    iconButton(this, W - 72, H - 96, "⚙", () => this.openSettings(), 78).setDepth(4);

    this.buildDailyCard();

    if (streakRes.advanced) this.showStreakBanner(streakRes.count, streakRes.reward, streakRes.broken);

    this.cameras.main.fadeIn(260, 5, 5, 12);
  }

  override update(_t: number, dt: number): void {
    this.ridgeMid.tilePositionX += 0.006 * dt;
    this.ridgeNear.tilePositionX += 0.015 * dt;
  }

  private play(): void {
    this.scene.start("Game");
  }

  // ----------------------------------------------------- currency / shop ----
  private buildPlumesButton(plumes: number): void {
    const W = this.scale.width;
    this.badge = plumesBadge(this, W - 100, 56, plumes).setDepth(5) as PlumesBadge;
    this.badge.setSize(160, 60);
    this.badge.setInteractive(new Phaser.Geom.Rectangle(-80, -30, 160, 60), Phaser.Geom.Rectangle.Contains);
    this.badge.on("pointerover", () => this.badge.setScale(1.06));
    this.badge.on("pointerout", () => this.badge.setScale(1));
    this.badge.on("pointerup", () => {
      this.svc.audio.sfxUi();
      this.scene.start("Shop");
    });
    // tiny affordance so it's obvious the counter is tappable
    this.add.text(W - 100, 92, "tap → shop", textStyle(16, Palette.smoke)).setOrigin(0.5).setDepth(5);
  }

  private buildLevelBadge(): void {
    const xp = this.svc.save.get().xp;
    const lp = levelProgress(xp);
    const x = 30;
    const y = 44;
    const w = 200;
    this.add.text(x, y - 18, `LV ${lp.level}`, textStyle(24, Palette.violet)).setOrigin(0, 0.5).setDepth(5);
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(Palette.skyBottom, 0.7);
    g.fillRoundedRect(x, y + 6, w, 10, 5);
    g.fillStyle(Palette.violet, 0.95);
    g.fillRoundedRect(x, y + 6, Math.max(6, w * lp.fraction), 10, 5);
  }

  // ---------------------------------------------------------- daily ----
  private buildDailyCard(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const { def, progress, claimed } = this.svc.ensureDaily();
    const done = progress >= def.target;

    const card = this.add.container(W / 2, H * 0.88).setDepth(4);
    card.add(roundedPanel(this, 560, 130, { fill: Palette.skyMid, fillAlpha: 0.9, stroke: Palette.near, radius: 20 }));
    card.add(this.add.text(-255, -42, "DAILY CHALLENGE", textStyle(20, Palette.gold)).setOrigin(0, 0.5).setLetterSpacing(2));
    card.add(this.add.text(-255, -8, dailyLabel(def), textStyle(24, Palette.bone)).setOrigin(0, 0.5));

    const barW = 330;
    const bar = this.add.graphics();
    const frac = Phaser.Math.Clamp(progress / def.target, 0, 1);
    bar.fillStyle(Palette.skyBottom, 0.8);
    bar.fillRoundedRect(-255, 28, barW, 12, 6);
    bar.fillStyle(done ? Palette.good : Palette.accent, 0.95);
    bar.fillRoundedRect(-255, 28, Math.max(8, barW * frac), 12, 6);
    card.add(bar);
    card.add(this.add.text(-255 + barW + 12, 34, `${Math.min(progress, def.target)}/${def.target}`, textStyle(20, Palette.smoke)).setOrigin(0, 0.5));

    const statusText = this.add.text(200, 0, "", textStyle(22, Palette.good)).setOrigin(0.5);
    card.add(statusText);

    if (claimed) {
      statusText.setText("CLAIMED ✓");
    } else if (done) {
      const claim = button(this, W / 2 + 200, H * 0.88, `+${def.reward} 🪶`, () => {
        const got = this.svc.claimDaily();
        if (got > 0) {
          this.badge.setCount(this.svc.save.get().plumes);
          this.svc.audio.sfxReward();
          this.svc.haptics.fire("success");
          toast(this, `Daily claimed! +${got} 🪶`, Palette.gold);
          claim.destroy();
          statusText.setText("CLAIMED ✓");
        }
      }, { w: 150, h: 56, size: 22, fill: Palette.gold, textColor: Palette.ink }).setDepth(6);
      void claim;
    } else {
      statusText.setText("");
    }
  }

  // --------------------------------------------------------- streak ----
  /**
   * A celebratory banner for the daily streak. It is purely informational
   * (the reward is already granted) and NON-INTERACTIVE, so it never blocks the
   * menu — it animates in near the top, holds, then fades itself out.
   */
  private showStreakBanner(count: number, reward: number, broken: boolean): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const c = this.add.container(W / 2, H * 0.22).setDepth(40);
    c.add(roundedPanel(this, 440, 168, { fill: Palette.skyMid, fillAlpha: 0.96, stroke: Palette.gold, radius: 24 }));
    c.add(this.add.text(0, -54, "DAILY STREAK", displayStyle(30, Palette.gold)).setOrigin(0.5));
    c.add(this.add.text(-70, 6, `${count}`, displayStyle(64, Palette.bone)).setOrigin(0.5));
    c.add(this.add.text(38, -6, broken ? "restarted" : "day streak", textStyle(22, Palette.smoke)).setOrigin(0.5));
    c.add(this.add.text(38, 26, `+${reward} 🪶`, displayStyle(30, Palette.gold)).setOrigin(0.5));

    this.badge.setCount(this.svc.save.get().plumes);
    this.svc.audio.sfxReward();
    this.svc.haptics.fire("success");

    c.setAlpha(0).setY(H * 0.18).setScale(0.9);
    this.tweens.add({ targets: c, alpha: 1, y: H * 0.22, scale: 1, duration: 360, ease: "Back.out" });
    this.tweens.add({ targets: c, alpha: 0, y: H * 0.18, delay: 2800, duration: 400, onComplete: () => c.destroy() });
  }

  // -------------------------------------------------------- settings ----
  private openSettings(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = this.svc.save.get();
    const layer = this.add.container(0, 0).setDepth(100);
    const block = this.add.rectangle(W / 2, H / 2, W, H, Palette.ink, 0.8).setInteractive();
    layer.add(block);

    const panel = this.add.container(W / 2, H / 2);
    panel.add(roundedPanel(this, 540, 580, { fill: Palette.skyMid, stroke: Palette.near, radius: 26 }));
    panel.add(this.add.text(0, -244, "SETTINGS", displayStyle(44, Palette.bone)).setOrigin(0.5));
    layer.add(panel);

    panel.add(this.add.text(-220, -150, "Music", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    layer.add(slider(this, W / 2 + 40, H / 2 - 150, 240, s.settings.music, (v) => {
      s.settings.music = v;
      this.svc.audio.setMusicVolume(v);
      this.svc.save.save();
    }));

    panel.add(this.add.text(-220, -78, "SFX", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    layer.add(slider(this, W / 2 + 40, H / 2 - 78, 240, s.settings.sfx, (v) => {
      s.settings.sfx = v;
      this.svc.audio.setSfxVolume(v);
      this.svc.save.save();
    }));

    panel.add(this.add.text(-220, 0, "Haptics", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    const hapticBtn = button(this, W / 2 + 120, H / 2, s.settings.haptics ? "ON" : "OFF", () => {
      s.settings.haptics = !s.settings.haptics;
      this.svc.haptics.setEnabled(s.settings.haptics);
      this.svc.save.save();
      (hapticBtn.list[1] as Phaser.GameObjects.Text).setText(s.settings.haptics ? "ON" : "OFF");
      if (s.settings.haptics) this.svc.haptics.fire("medium");
    }, { w: 120, h: 56, size: 24 });
    layer.add(hapticBtn);

    panel.add(this.add.text(-220, 78, "Name", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    const nameVal = this.add.text(20, 78, s.playerName || "Raven", textStyle(26, Palette.accent)).setOrigin(0, 0.5);
    panel.add(nameVal);
    layer.add(button(this, W / 2 + 160, H / 2 + 78, "EDIT", () => {
      const entered = window.prompt("Your name (max 16 chars):", s.playerName || "Raven");
      if (entered) {
        s.playerName = entered.slice(0, 16);
        this.svc.save.flush();
        nameVal.setText(s.playerName);
      }
    }, { w: 110, h: 50, size: 22 }));

    layer.add(button(this, W / 2, H / 2 + 175, "CLOSE", () => layer.destroy(), { w: 220, h: 64, size: 28, fill: Palette.accentSoft, textColor: Palette.ink }));
    layer.add(button(this, W / 2, H / 2 + 250, "↺ reset all progress", () => {
      if (window.confirm("Reset ALL progress? This cannot be undone.")) {
        this.svc.save.reset();
        layer.destroy();
        this.scene.restart();
      }
    }, { w: 320, h: 48, size: 20, fill: Palette.near, textColor: Palette.danger }));
  }
}
