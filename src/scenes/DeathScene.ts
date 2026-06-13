import Phaser from "phaser";
import { Palette } from "../config/theme";
import { textStyle, displayStyle, button, iconButton, getServices, roundedPanel } from "../ui/Widgets";
import type { RunSummary } from "../systems/EventBus";
import { ACHIEVEMENTS_BY_ID } from "../data/achievements";
import type { GameScene } from "./GameScene";

/**
 * Death / reward overlay (BRIEF §1.2 variable reward + §1.1 instant restart).
 * Shows the run summary and an animated chest, then the WHOLE screen is a
 * restart button — one tap relaunches a run with zero intermediate menu.
 */
export class DeathScene extends Phaser.Scene {
  private summary!: RunSummary;
  private canRestart = false;

  constructor() {
    super("Death");
  }

  init(data: { summary: RunSummary }): void {
    this.summary = data.summary;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const svc = getServices(this);
    const s = this.summary;

    // dim backdrop
    this.add.rectangle(W / 2, H / 2, W, H, Palette.ink, 0.66).setDepth(0);

    // panel
    const panelH = 760;
    const cx = W / 2;
    const cy = H / 2 - 20;
    const panel = this.add.container(cx, cy).setDepth(2);
    panel.add(roundedPanel(this, 560, panelH, { fill: Palette.skyMid, fillAlpha: 0.96, stroke: Palette.near, strokeAlpha: 0.9, radius: 28 }));

    const title = s.newHighScore ? "NEW BEST" : "YOU FELL";
    const titleColor = s.newHighScore ? Palette.gold : Palette.bone;
    panel.add(this.add.text(0, -panelH / 2 + 64, title, displayStyle(56, titleColor)).setOrigin(0.5));

    // big score
    panel.add(this.add.text(0, -panelH / 2 + 150, this.fmt(s.score), displayStyle(94, Palette.accent)).setOrigin(0.5));
    panel.add(this.add.text(0, -panelH / 2 + 212, "SCORE", textStyle(22, Palette.smoke)).setOrigin(0.5).setLetterSpacing(3));

    // aversion-to-loss line
    if (!s.newHighScore && s.prevHighScore > 0) {
      const gap = s.prevHighScore - s.score;
      const msg = gap <= 400 ? `so close — ${gap} from your best!` : `best: ${this.fmt(s.prevHighScore)}`;
      panel.add(this.add.text(0, -panelH / 2 + 246, msg, textStyle(22, gap <= 400 ? Palette.ember : Palette.dim)).setOrigin(0.5));
    }

    // stat row
    const stats: [string, string][] = [
      [`${s.distanceM}`, "METRES"],
      [`${s.souls}`, "SOULS"],
      [`${s.nearMisses}`, "GRAZES"],
      [`×${s.bestCombo}`, "COMBO"],
    ];
    const sw = 130;
    stats.forEach(([v, label], i) => {
      const x = (i - 1.5) * sw;
      panel.add(this.add.text(x, -40, v, displayStyle(38, Palette.bone)).setOrigin(0.5));
      panel.add(this.add.text(x, -4, label, textStyle(18, Palette.smoke)).setOrigin(0.5).setLetterSpacing(1));
    });

    // chest / plumes earned (animated)
    const chestY = 90;
    panel.add(this.add.text(0, chestY - 36, "🪶  PLUMES EARNED", textStyle(24, Palette.gold)).setOrigin(0.5).setLetterSpacing(2));
    const plumesText = this.add.text(0, chestY + 12, "0", displayStyle(64, Palette.gold)).setOrigin(0.5);
    panel.add(plumesText);
    if (s.chestBonus > 0) {
      panel.add(this.add.text(0, chestY + 60, `+${s.chestBonus} JACKPOT!`, textStyle(24, Palette.good)).setOrigin(0.5));
    }

    this.tweens.addCounter({
      from: 0,
      to: s.plumesEarned,
      duration: 900,
      ease: "Cubic.out",
      onUpdate: (t) => plumesText.setText(this.fmt(Math.round(t.getValue() ?? 0))),
    });
    svc.audio.sfxReward();
    svc.haptics.fire("success");

    // level up + achievements
    let infoY = chestY + 110;
    if (s.leveledUp > 0) {
      panel.add(this.add.text(0, infoY, `LEVEL UP!  +${s.leveledUp} level${s.leveledUp > 1 ? "s" : ""}`, textStyle(26, Palette.violet)).setOrigin(0.5));
      infoY += 40;
    }
    for (const id of s.newAchievements.slice(0, 3)) {
      const a = ACHIEVEMENTS_BY_ID[id];
      if (!a) continue;
      panel.add(this.add.text(0, infoY, `★ ${a.name}  (+${a.reward}🪶)`, textStyle(22, Palette.good)).setOrigin(0.5));
      infoY += 34;
    }

    // submit to leaderboard (local always; global if configured)
    const name = svc.save.get().playerName || "Raven";
    void svc.leaderboard.submit({ name, score: s.score, distance: s.distanceM });

    // restart prompt
    const prompt = this.add
      .text(W / 2, cy + panelH / 2 + 40, "TAP TO PLAY AGAIN", textStyle(30, Palette.accent))
      .setOrigin(0.5)
      .setDepth(3)
      .setLetterSpacing(3)
      .setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, duration: 500, delay: 300 });
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, delay: 800 });

    // bottom nav
    const navY = H - 80;
    iconButton(this, 80, navY, "☰", () => this.gotoMenu()).setDepth(5);
    button(this, W / 2, navY, "SHOP", () => this.goto("Shop"), { w: 200, h: 64, size: 24, fill: Palette.near }).setDepth(5);
    iconButton(this, W - 80, navY, "🏆", () => this.goto("Leaderboard")).setDepth(5);

    // whole-screen restart (enabled after a short guard so the death tap
    // doesn't instantly restart)
    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setDepth(1).setInteractive();
    zone.on("pointerdown", () => {
      if (this.canRestart) this.restart();
    });
    this.time.delayedCall(420, () => (this.canRestart = true));

    this.cameras.main.fadeIn(220, 5, 5, 12);
  }

  private restart(): void {
    const game = this.scene.get("Game") as GameScene;
    getServices(this).audio.sfxUi(true);
    this.scene.stop();
    game.scene.restart();
  }

  private gotoMenu(): void {
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start("Menu");
  }

  private goto(key: string): void {
    this.scene.stop("Game");
    this.scene.stop("UI");
    this.scene.start(key);
  }

  private fmt(n: number): string {
    return n >= 1000 ? n.toLocaleString("en-US") : String(n);
  }
}
