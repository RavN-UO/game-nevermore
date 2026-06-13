import Phaser from "phaser";
import { Palette } from "../config/theme";
import { Tex } from "../gfx/TextureFactory";
import { textStyle, displayStyle, iconButton, roundedPanel, getServices } from "../ui/Widgets";
import type { Services } from "../systems/Services";
import type { ScoreEntry } from "../systems/Leaderboard";

/**
 * Leaderboard (BRIEF §1.6) over the decoupled `Leaderboard` service. LOCAL is
 * always available; GLOBAL works when Supabase is configured (otherwise it
 * explains how to enable it). The game stays fully playable offline.
 */
export class LeaderboardScene extends Phaser.Scene {
  private svc!: Services;
  private tab: "local" | "global" = "local";
  private listContainer!: Phaser.GameObjects.Container;

  constructor() {
    super("Leaderboard");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(1);
    this.add.text(W / 2, 70, "RANKS", displayStyle(48, Palette.bone)).setOrigin(0.5).setDepth(2);
    iconButton(this, 60, 70, "←", () => this.scene.start("Menu")).setDepth(3);

    this.tabButton(W / 2 - 130, 150, "LOCAL", "local");
    this.tabButton(W / 2 + 130, 150, "GLOBAL", "global");

    this.listContainer = this.add.container(0, 0).setDepth(2);
    this.loadList();

    this.cameras.main.fadeIn(220, 5, 5, 12);
  }

  private tabButton(x: number, y: number, label: string, key: "local" | "global"): void {
    const active = this.tab === key;
    const c = this.add.container(x, y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(active ? Palette.accentSoft : Palette.near, active ? 0.95 : 0.7);
    g.fillRoundedRect(-120, -28, 240, 56, 16);
    c.add([g, this.add.text(0, 0, label, textStyle(26, active ? Palette.ink : Palette.smoke)).setOrigin(0.5)]);
    c.setSize(240, 56).setInteractive(new Phaser.Geom.Rectangle(-120, -28, 240, 56), Phaser.Geom.Rectangle.Contains);
    c.on("pointerup", () => {
      if (this.tab === key) return;
      this.tab = key;
      this.svc.audio.sfxUi();
      this.scene.restart();
    });
  }

  private async loadList(): Promise<void> {
    const W = this.scale.width;
    const loading = this.add.text(W / 2, 360, "…", textStyle(30, Palette.smoke)).setOrigin(0.5).setDepth(2);

    const result =
      this.tab === "local"
        ? await this.svc.leaderboard.top(100)
        : await this.svc.leaderboard.topGlobal(100);
    loading.destroy();

    if (this.tab === "global" && !result.available) {
      this.renderUnavailable();
      return;
    }
    if (result.entries.length === 0) {
      this.add.text(W / 2, 400, "No scores yet — go fall gracefully.", textStyle(24, Palette.smoke)).setOrigin(0.5).setDepth(2);
      return;
    }
    this.renderEntries(result.entries);
  }

  private renderEntries(entries: ScoreEntry[]): void {
    const W = this.scale.width;
    const top = 220;
    const rowH = 64;
    const max = Math.min(entries.length, 14); // fit without scrolling

    for (let i = 0; i < max; i++) {
      const e = entries[i];
      const y = top + i * rowH;
      const row = this.add.container(W / 2, y).setDepth(2);
      this.listContainer.add(row);
      const highlight = e.isYou;
      row.add(roundedPanel(this, 620, rowH - 10, {
        fill: highlight ? Palette.near : Palette.skyMid,
        fillAlpha: highlight ? 0.95 : 0.8,
        stroke: highlight ? Palette.accent : Palette.skyBottom,
        radius: 14,
      }));

      const rankColor = i === 0 ? Palette.gold : i === 1 ? Palette.bone : i === 2 ? Palette.ember : Palette.smoke;
      row.add(this.add.text(-280, 0, `${i + 1}`, displayStyle(28, rankColor)).setOrigin(0.5));
      row.add(this.add.text(-230, 0, e.name, textStyle(26, highlight ? Palette.accent : Palette.bone)).setOrigin(0, 0.5));
      row.add(this.add.text(290, 0, e.score.toLocaleString("en-US"), textStyle(26, Palette.gold)).setOrigin(1, 0.5));
    }

    const save = this.svc.save.get();
    this.add.text(W / 2, top + max * rowH + 30, `Your best: ${save.highScore.toLocaleString("en-US")}`, textStyle(24, Palette.accent)).setOrigin(0.5).setDepth(2);
  }

  private renderUnavailable(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const panel = this.add.container(W / 2, H / 2 - 40).setDepth(2);
    panel.add(roundedPanel(this, 600, 320, { fill: Palette.skyMid, stroke: Palette.near, radius: 22 }));
    panel.add(this.add.text(0, -110, "🌐", textStyle(56)).setOrigin(0.5));
    panel.add(this.add.text(0, -40, "Global ranks are offline", displayStyle(30, Palette.bone)).setOrigin(0.5));
    panel.add(this.add.text(0, 20, "Set VITE_SUPABASE_URL and\nVITE_SUPABASE_ANON_KEY to enable\nthe worldwide leaderboard.", textStyle(22, Palette.smoke, { align: "center" })).setOrigin(0.5));
    panel.add(this.add.text(0, 110, "Your local scores still count.", textStyle(22, Palette.accent)).setOrigin(0.5));
  }
}
