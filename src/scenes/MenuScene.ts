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
} from "../ui/Widgets";
import type { Services } from "../systems/Services";

/**
 * Home screen (BRIEF §4): best score, currency, account level, the big PLAY
 * button, shop / leaderboard access, the daily challenge card, the daily-streak
 * reward on first open of the day, and a settings panel.
 */
export class MenuScene extends Phaser.Scene {
  private svc!: Services;
  private ridgeNear!: Phaser.GameObjects.TileSprite;
  private ridgeMid!: Phaser.GameObjects.TileSprite;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.ridgeMid = this.add.tileSprite(0, H, W, 420, Tex.ridgeMid).setOrigin(0, 1).setAlpha(0.7);
    this.ridgeNear = this.add.tileSprite(0, H, W, 420, Tex.ridgeNear).setOrigin(0, 1);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(2);

    if (this.svc.audio.isReady) this.svc.audio.playMenu();

    // drifting raven with the active skin
    const skin = getSkin(this.svc.save.get().selectedSkin);
    const crow = this.add.image(W / 2, H * 0.33, Tex.crow0).setScale(1.8).setTint(skin.bodyColor).setDepth(3);
    this.add.image(crow.x + 34, crow.y - 8, Tex.eye).setScale(0.8).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.tweens.add({ targets: crow, y: crow.y - 16, angle: 5, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // title
    const title = this.add.text(W / 2, H * 0.46, "NEVERMORE", displayStyle(72, Palette.bone)).setOrigin(0.5).setLetterSpacing(8).setDepth(3);
    title.setShadow(0, 0, "#7be0ff", 22, false, true);

    const save = this.svc.save.get();
    this.add.text(W / 2, H * 0.52, `BEST  ${save.highScore.toLocaleString("en-US")}`, textStyle(28, Palette.accent)).setOrigin(0.5).setLetterSpacing(2).setDepth(3);

    // top bar: level (left) + plumes (right)
    const badge = plumesBadge(this, W - 95, 56, save.plumes).setDepth(5);
    void badge;
    this.buildLevelBadge();

    // PLAY
    button(this, W / 2, H * 0.65, "PLAY", () => this.play(), {
      w: 360,
      h: 96,
      size: 44,
      display: true,
      fill: Palette.accentSoft,
      textColor: Palette.ink,
    }).setDepth(4);

    // secondary nav
    button(this, W / 2 - 100, H * 0.74, "SHOP", () => this.scene.start("Shop"), { w: 180, h: 70, size: 26 }).setDepth(4);
    button(this, W / 2 + 100, H * 0.74, "RANKS", () => this.scene.start("Leaderboard"), { w: 180, h: 70, size: 26 }).setDepth(4);
    iconButton(this, W - 56, H - 56, "⚙", () => this.openSettings()).setDepth(4);

    this.buildDailyCard();
    this.handleStreak();

    this.cameras.main.fadeIn(260, 5, 5, 12);
  }

  override update(_t: number, dt: number): void {
    this.ridgeMid.tilePositionX += 0.006 * dt;
    this.ridgeNear.tilePositionX += 0.015 * dt;
  }

  private play(): void {
    this.cameras.main.fadeOut(180, 5, 5, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Game"));
  }

  // ---------------------------------------------------------- level ----
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
    card.add(roundedPanel(this, 520, 130, { fill: Palette.skyMid, fillAlpha: 0.9, stroke: Palette.near, radius: 20 }));
    card.add(this.add.text(-235, -42, "DAILY CHALLENGE", textStyle(20, Palette.gold)).setOrigin(0, 0.5).setLetterSpacing(2));
    card.add(this.add.text(-235, -8, dailyLabel(def), textStyle(24, Palette.bone)).setOrigin(0, 0.5));

    const barW = 360;
    const bar = this.add.graphics();
    const frac = Phaser.Math.Clamp(progress / def.target, 0, 1);
    bar.fillStyle(Palette.skyBottom, 0.8);
    bar.fillRoundedRect(-235, 28, barW, 12, 6);
    bar.fillStyle(done ? Palette.good : Palette.accent, 0.95);
    bar.fillRoundedRect(-235, 28, Math.max(8, barW * frac), 12, 6);
    card.add(bar);
    card.add(this.add.text(-235 + barW + 14, 34, `${Math.min(progress, def.target)}/${def.target}`, textStyle(20, Palette.smoke)).setOrigin(0, 0.5));

    if (done && !claimed) {
      const claim = button(this, W / 2 + 175, H * 0.88 - 8, `+${def.reward} 🪶`, () => {
        const got = this.svc.claimDaily();
        if (got > 0) {
          toast(this, `Daily claimed! +${got} 🪶`, Palette.gold);
          this.svc.audio.sfxReward();
          this.scene.restart();
        }
      }, { w: 150, h: 56, size: 22, fill: Palette.gold, textColor: Palette.ink }).setDepth(6);
      void claim;
    } else if (claimed) {
      card.add(this.add.text(175, 0, "CLAIMED ✓", textStyle(22, Palette.good)).setOrigin(0.5));
    }
  }

  // --------------------------------------------------------- streak ----
  private handleStreak(): void {
    const res = this.svc.updateStreakOnLaunch();
    if (!res.advanced) return;
    const W = this.scale.width;
    const H = this.scale.height;

    const overlay = this.add.container(W / 2, H / 2).setDepth(50);
    overlay.add(this.add.rectangle(0, 0, W, H, Palette.ink, 0.7).setInteractive());
    overlay.add(roundedPanel(this, 460, 340, { fill: Palette.skyMid, stroke: Palette.gold, radius: 26 }));
    overlay.add(this.add.text(0, -120, "DAILY STREAK", displayStyle(40, Palette.gold)).setOrigin(0.5));
    overlay.add(this.add.text(0, -40, `${res.count}`, displayStyle(110, Palette.bone)).setOrigin(0.5));
    overlay.add(this.add.text(0, 40, res.broken ? "streak restarted — welcome back" : "days in a row", textStyle(24, Palette.smoke)).setOrigin(0.5));
    overlay.add(this.add.text(0, 96, `+${res.reward} 🪶`, displayStyle(44, Palette.gold)).setOrigin(0.5));

    this.svc.audio.sfxReward();
    this.svc.haptics.fire("success");

    overlay.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: overlay, scale: 1, alpha: 1, duration: 300, ease: "Back.out" });
    this.time.delayedCall(400, () => {
      overlay.list[0].once("pointerdown", () => {
        this.tweens.add({ targets: overlay, alpha: 0, duration: 200, onComplete: () => { overlay.destroy(); this.scene.restart(); } });
      });
    });
  }

  // -------------------------------------------------------- settings ----
  private openSettings(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = this.svc.save.get();
    const layer = this.add.container(0, 0).setDepth(60);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, Palette.ink, 0.78).setInteractive();
    layer.add(bg);

    const panel = this.add.container(W / 2, H / 2);
    panel.add(roundedPanel(this, 540, 560, { fill: Palette.skyMid, stroke: Palette.near, radius: 26 }));
    panel.add(this.add.text(0, -230, "SETTINGS", displayStyle(44, Palette.bone)).setOrigin(0.5));
    layer.add(panel);

    panel.add(this.add.text(-220, -140, "Music", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    layer.add(slider(this, W / 2 + 40, H / 2 - 140, 240, s.settings.music, (v) => {
      s.settings.music = v;
      this.svc.audio.setMusicVolume(v);
      this.svc.save.save();
    }));

    panel.add(this.add.text(-220, -60, "SFX", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    layer.add(slider(this, W / 2 + 40, H / 2 - 60, 240, s.settings.sfx, (v) => {
      s.settings.sfx = v;
      this.svc.audio.setSfxVolume(v);
      this.svc.save.save();
    }));

    // haptics toggle
    const hapticLabel = this.add.text(-220, 30, "Haptics", textStyle(26, Palette.bone)).setOrigin(0, 0.5);
    panel.add(hapticLabel);
    const hapticBtn = button(this, W / 2 + 120, H / 2 + 30, s.settings.haptics ? "ON" : "OFF", () => {
      s.settings.haptics = !s.settings.haptics;
      this.svc.haptics.setEnabled(s.settings.haptics);
      this.svc.save.save();
      (hapticBtn.list[1] as Phaser.GameObjects.Text).setText(s.settings.haptics ? "ON" : "OFF");
      if (s.settings.haptics) this.svc.haptics.fire("medium");
    }, { w: 120, h: 56, size: 24 });
    layer.add(hapticBtn);

    // name
    panel.add(this.add.text(-220, 120, "Name", textStyle(26, Palette.bone)).setOrigin(0, 0.5));
    const nameVal = this.add.text(40, 120, s.playerName || "Raven", textStyle(26, Palette.accent)).setOrigin(0, 0.5);
    panel.add(nameVal);
    const editBtn = button(this, W / 2 + 160, H / 2 + 120, "EDIT", () => {
      const entered = window.prompt("Your name (max 16 chars):", s.playerName || "Raven");
      if (entered) {
        s.playerName = entered.slice(0, 16);
        this.svc.save.flush();
        nameVal.setText(s.playerName);
      }
    }, { w: 110, h: 50, size: 22 });
    layer.add(editBtn);

    // close + reset
    layer.add(button(this, W / 2, H / 2 + 210, "CLOSE", () => layer.destroy(), { w: 200, h: 60, size: 26 }));
    panel.add(this.add.text(0, 250, "↺ resets all progress", textStyle(16, Palette.dim)).setOrigin(0.5));
    layer.add(iconButton(this, W / 2 + 230, H / 2 - 250, "↺", () => {
      if (window.confirm("Reset ALL progress? This cannot be undone.")) {
        this.svc.save.reset();
        layer.destroy();
        this.scene.restart();
      }
    }, 48));
  }
}
