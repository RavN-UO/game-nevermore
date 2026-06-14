import Phaser from "phaser";
import { Palette } from "../config/theme";
import { Tex } from "../gfx/TextureFactory";
import { textStyle, displayStyle, iconButton, roundedPanel, getServices } from "../ui/Widgets";
import type { Services } from "../systems/Services";
import type { ScoreEntry } from "../systems/Leaderboard";

/**
 * Leaderboard (BRIEF §1.6) over the decoupled `Leaderboard` service. LOCAL is
 * always available; GLOBAL works when Supabase is configured. Tabs swap content
 * in place (no scene.restart) for snappy input.
 */
export class LeaderboardScene extends Phaser.Scene {
  private svc!: Services;
  private tab: "local" | "global" = "local";
  private body!: Phaser.GameObjects.Container;
  private token = 0;

  constructor() {
    super("Leaderboard");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(1);
    this.add.text(W / 2, 72, "RANKS", displayStyle(48, Palette.bone)).setOrigin(0.5).setDepth(2);
    iconButton(this, 66, 72, "←", () => this.scene.start("Menu"), 72).setDepth(3);

    this.body = this.add.container(0, 0).setDepth(2);
    this.refresh();
    this.cameras.main.fadeIn(200, 5, 5, 12);
  }

  private refresh(): void {
    this.body.removeAll(true);
    const W = this.scale.width;
    this.tabButton(W / 2 - 132, 156, "LOCAL", "local");
    this.tabButton(W / 2 + 132, 156, "GLOBAL", "global");
    void this.loadList();
  }

  private tabButton(x: number, y: number, label: string, key: "local" | "global"): void {
    const active = this.tab === key;
    const c = this.add.container(x, y);
    this.body.add(c);
    const g = this.add.graphics();
    g.fillStyle(active ? Palette.accentSoft : Palette.near, active ? 1 : 0.8);
    g.fillRoundedRect(-128, -32, 256, 64, 16);
    c.add([g, this.add.text(0, 0, label, textStyle(26, active ? Palette.ink : Palette.bone)).setOrigin(0.5)]);
    c.setSize(256, 64).setInteractive(new Phaser.Geom.Rectangle(-128, -32, 256, 64), Phaser.Geom.Rectangle.Contains);
    c.on("pointerup", () => {
      if (this.tab === key) return;
      this.tab = key;
      this.svc.audio.sfxUi();
      this.refresh();
    });
  }

  private async loadList(): Promise<void> {
    const W = this.scale.width;
    const myToken = ++this.token;
    const loading = this.add.text(W / 2, 360, "…", textStyle(30, Palette.smoke)).setDepth(2).setOrigin(0.5);
    this.body.add(loading);

    const result = this.tab === "local"
      ? await this.svc.leaderboard.top(100)
      : await this.svc.leaderboard.topGlobal(100);
    if (myToken !== this.token) return; // a newer tab switch superseded this load
    loading.destroy();

    if (this.tab === "global" && !result.available) { this.renderUnavailable(); return; }
    if (result.entries.length === 0) {
      this.body.add(this.add.text(W / 2, 400, "No scores yet — go fall gracefully.", textStyle(24, Palette.smoke)).setOrigin(0.5).setDepth(2));
      return;
    }
    this.renderEntries(result.entries);
  }

  private renderEntries(entries: ScoreEntry[]): void {
    const W = this.scale.width;
    const top = 224;
    const rowH = 64;
    const max = Math.min(entries.length, 13);
    for (let i = 0; i < max; i++) {
      const e = entries[i];
      const y = top + i * rowH;
      const row = this.add.container(W / 2, y).setDepth(2);
      this.body.add(row);
      const hl = e.isYou;
      row.add(roundedPanel(this, 620, rowH - 10, {
        fill: hl ? Palette.near : Palette.skyMid, fillAlpha: hl ? 0.95 : 0.85,
        stroke: hl ? Palette.accent : Palette.skyBottom, radius: 14,
      }));
      const rankColor = i === 0 ? Palette.gold : i === 1 ? Palette.bone : i === 2 ? Palette.ember : Palette.smoke;
      row.add(this.add.text(-282, 0, `${i + 1}`, displayStyle(28, rankColor)).setOrigin(0.5));
      row.add(this.add.text(-232, 0, e.name, textStyle(26, hl ? Palette.accent : Palette.bone)).setOrigin(0, 0.5));
      row.add(this.add.text(290, 0, e.score.toLocaleString("en-US"), textStyle(26, Palette.gold)).setOrigin(1, 0.5));
    }
    const save = this.svc.save.get();
    this.body.add(this.add.text(W / 2, top + max * rowH + 28, `Your best: ${save.highScore.toLocaleString("en-US")}`, textStyle(24, Palette.accent)).setOrigin(0.5).setDepth(2));
  }

  private renderUnavailable(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const panel = this.add.container(W / 2, H / 2 - 40).setDepth(2);
    this.body.add(panel);
    panel.add(roundedPanel(this, 600, 320, { fill: Palette.skyMid, stroke: Palette.near, radius: 22 }));
    panel.add(this.add.text(0, -110, "🌐", textStyle(56)).setOrigin(0.5));
    panel.add(this.add.text(0, -40, "Global ranks are offline", displayStyle(30, Palette.bone)).setOrigin(0.5));
    panel.add(this.add.text(0, 20, "Set VITE_SUPABASE_URL and\nVITE_SUPABASE_ANON_KEY to enable\nthe worldwide leaderboard.", textStyle(22, Palette.smoke, { align: "center" })).setOrigin(0.5));
    panel.add(this.add.text(0, 110, "Your local scores still count.", textStyle(22, Palette.accent)).setOrigin(0.5));
  }
}
