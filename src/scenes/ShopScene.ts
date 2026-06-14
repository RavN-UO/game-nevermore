import Phaser from "phaser";
import { Palette } from "../config/theme";
import { Tex } from "../gfx/TextureFactory";
import { SKINS, getSkin } from "../data/skins";
import { UPGRADES, nextCost } from "../data/upgrades";
import {
  textStyle,
  displayStyle,
  iconButton,
  plumesBadge,
  roundedPanel,
  toast,
  getServices,
  type PlumesBadge,
} from "../ui/Widgets";
import type { Services } from "../systems/Services";

/**
 * Shop (BRIEF §1.4): cosmetic skins and permanent meta upgrades, bought with
 * Plumes. Two tabs. Everything updates IN PLACE (no scene.restart) so taps feel
 * instant, and whole cards/rows are tappable for big touch targets.
 */
export class ShopScene extends Phaser.Scene {
  private svc!: Services;
  private tab: "skins" | "upgrades" = "skins";
  private badge!: PlumesBadge;
  private body!: Phaser.GameObjects.Container;

  constructor() {
    super("Shop");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(1);

    this.add.text(W / 2, 72, "SHOP", displayStyle(48, Palette.bone)).setOrigin(0.5).setDepth(2);
    iconButton(this, 66, 72, "←", () => this.scene.start("Menu"), 72).setDepth(3);
    this.badge = plumesBadge(this, W - 104, 72, this.svc.save.get().plumes).setDepth(3);

    this.body = this.add.container(0, 0).setDepth(2);
    this.refresh();

    this.cameras.main.fadeIn(200, 5, 5, 12);
  }

  /** Rebuild tabs + content in place (cheap; no scene restart). */
  private refresh(): void {
    this.body.removeAll(true);
    this.badge.setCount(this.svc.save.get().plumes);
    const W = this.scale.width;
    this.tabButton(W / 2 - 132, 156, "SKINS", "skins");
    this.tabButton(W / 2 + 132, 156, "UPGRADES", "upgrades");
    if (this.tab === "skins") this.buildSkins();
    else this.buildUpgrades();
  }

  private tabButton(x: number, y: number, label: string, key: "skins" | "upgrades"): void {
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

  // ----------------------------------------------------------- skins ----
  private buildSkins(): void {
    const W = this.scale.width;
    const cols = 2;
    const cardW = 300;
    const cardH = 188;
    const gapX = 24;
    const gapY = 18;
    const startY = 250;
    SKINS.forEach((skin, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = W / 2 + (col === 0 ? -(cardW / 2 + gapX / 2) : cardW / 2 + gapX / 2);
      const cy = startY + cardH / 2 + row * (cardH + gapY);
      this.skinCard(cx, cy, skin.id, cardW, cardH);
    });
  }

  private skinCard(x: number, y: number, id: string, w: number, h: number): void {
    const skin = getSkin(id);
    const save = this.svc.save.get();
    const owned = save.unlockedSkins.includes(id);
    const selected = save.selectedSkin === id;
    const locked = !owned && skin.price < 0;

    const card = this.add.container(x, y);
    this.body.add(card);
    const border = selected ? Palette.accent : owned ? Palette.near : Palette.dim;
    card.add(roundedPanel(this, w, h, { fill: Palette.skyMid, fillAlpha: 0.95, stroke: border, strokeAlpha: 1, lineWidth: selected ? 3 : 2, radius: 18 }));

    card.add(this.add.image(0, -34, Tex.glow).setScale(2.4).setAlpha(0.3).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD));
    card.add(this.add.image(0, -34, Tex.crow0).setScale(1.15).setTint(skin.bodyColor));
    card.add(this.add.image(22, -42, Tex.eye).setScale(0.6).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD));
    card.add(this.add.text(0, 24, skin.name, displayStyle(26, Palette.bone)).setOrigin(0.5));

    let label: string, color: number;
    if (selected) { label = "EQUIPPED"; color = Palette.accent; }
    else if (owned) { label = "TAP TO EQUIP"; color = Palette.smoke; }
    else if (locked) { label = "🔒 LOCKED"; color = Palette.dim; }
    else { label = `${skin.price} 🪶`; color = save.plumes >= skin.price ? Palette.gold : Palette.danger; }
    card.add(this.add.text(0, 60, label, textStyle(22, color)).setOrigin(0.5));

    card.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    card.on("pointerdown", () => card.setScale(0.97));
    card.on("pointerout", () => card.setScale(1));
    card.on("pointerup", () => { card.setScale(1); this.onSkinTap(id); });
  }

  private onSkinTap(id: string): void {
    const save = this.svc.save.get();
    const skin = getSkin(id);
    if (save.unlockedSkins.includes(id)) {
      this.svc.selectSkin(id);
      this.svc.audio.sfxUi(true);
      this.svc.haptics.fire("light");
      this.refresh();
      return;
    }
    if (skin.price < 0) { toast(this, skin.blurb, Palette.violet); return; }
    if (this.svc.buySkin(id)) {
      this.svc.selectSkin(id);
      this.svc.audio.sfxReward();
      this.svc.haptics.fire("success");
      toast(this, `Unlocked ${skin.name}!`, Palette.gold);
      this.refresh();
    } else {
      toast(this, "Not enough Plumes", Palette.danger);
      this.svc.audio.sfxUi();
      this.svc.haptics.fire("warning");
    }
  }

  // --------------------------------------------------------- upgrades ----
  private buildUpgrades(): void {
    const W = this.scale.width;
    const startY = 244;
    const rowH = 130;
    UPGRADES.forEach((u, i) => this.upgradeRow(W / 2, startY + rowH / 2 + i * (rowH + 12), 640, rowH, u.id));
  }

  private upgradeRow(x: number, y: number, w: number, h: number, id: string): void {
    const def = UPGRADES.find((u) => u.id === id)!;
    const save = this.svc.save.get();
    const owned = save.upgrades[id] ?? 0;
    const cost = nextCost(def, owned);
    const maxed = cost === null;
    const affordable = !maxed && save.plumes >= (cost ?? 0);

    const row = this.add.container(x, y);
    this.body.add(row);
    const border = maxed ? Palette.violet : affordable ? Palette.gold : Palette.near;
    row.add(roundedPanel(this, w, h, { fill: Palette.skyMid, fillAlpha: 0.95, stroke: border, strokeAlpha: 0.9, radius: 18 }));
    row.add(this.add.text(-w / 2 + 52, -24, def.icon, textStyle(42)).setOrigin(0.5));
    row.add(this.add.text(-w / 2 + 102, -34, def.name, displayStyle(26, Palette.bone)).setOrigin(0, 0.5));
    row.add(this.add.text(-w / 2 + 102, 2, def.describe(owned), textStyle(20, Palette.smoke)).setOrigin(0, 0.5));
    for (let i = 0; i < def.maxLevel; i++) {
      row.add(this.add.circle(-w / 2 + 106 + i * 26, 36, 8, i < owned ? Palette.violet : Palette.dim, i < owned ? 1 : 0.5));
    }

    // buy "chip" on the right
    const bx = w / 2 - 116;
    const g = this.add.graphics();
    g.fillStyle(maxed ? Palette.near : affordable ? Palette.gold : Palette.skyBottom, maxed ? 0.6 : 1);
    g.fillRoundedRect(bx - 96, -38, 192, 76, 16);
    row.add(g);
    row.add(this.add.text(bx, 0, maxed ? "MAX" : `${cost} 🪶`, textStyle(26, maxed ? Palette.smoke : affordable ? Palette.ink : Palette.danger)).setOrigin(0.5));

    // whole row is tappable (big target) — buys the next level
    row.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    row.on("pointerdown", () => { if (!maxed) row.setScale(0.99); });
    row.on("pointerout", () => row.setScale(1));
    row.on("pointerup", () => { row.setScale(1); if (!maxed) this.onUpgradeBuy(id); });
  }

  private onUpgradeBuy(id: string): void {
    const def = UPGRADES.find((u) => u.id === id)!;
    if (this.svc.buyUpgrade(id)) {
      this.svc.audio.sfxReward();
      this.svc.haptics.fire("success");
      toast(this, `${def.name} upgraded!`, Palette.gold);
      this.refresh();
    } else {
      toast(this, "Not enough Plumes", Palette.danger);
      this.svc.audio.sfxUi();
      this.svc.haptics.fire("warning");
    }
  }
}
