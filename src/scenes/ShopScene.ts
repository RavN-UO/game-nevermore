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
 * Plumes. Two tabs, laid out so everything fits without scrolling.
 */
export class ShopScene extends Phaser.Scene {
  private svc!: Services;
  private tab: "skins" | "upgrades" = "skins";
  private badge!: PlumesBadge;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super("Shop");
  }

  create(): void {
    this.svc = getServices(this);
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.image(W / 2, H / 2, Tex.sky).setDisplaySize(W, H);
    this.add.image(W / 2, H / 2, Tex.vignette).setDisplaySize(W, H).setDepth(1);

    this.add.text(W / 2, 70, "SHOP", displayStyle(48, Palette.bone)).setOrigin(0.5).setDepth(2);
    iconButton(this, 60, 70, "←", () => this.scene.start("Menu")).setDepth(3);
    this.badge = plumesBadge(this, W - 100, 70, this.svc.save.get().plumes).setDepth(3);

    // tabs
    this.tabButton(W / 2 - 130, 150, "SKINS", "skins");
    this.tabButton(W / 2 + 130, 150, "UPGRADES", "upgrades");

    this.content = this.add.container(0, 0).setDepth(2);
    if (this.tab === "skins") this.buildSkins();
    else this.buildUpgrades();

    this.cameras.main.fadeIn(220, 5, 5, 12);
  }

  private tabButton(x: number, y: number, label: string, key: "skins" | "upgrades"): void {
    const active = this.tab === key;
    const c = this.add.container(x, y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(active ? Palette.accentSoft : Palette.near, active ? 0.95 : 0.7);
    g.fillRoundedRect(-120, -28, 240, 56, 16);
    const t = this.add.text(0, 0, label, textStyle(26, active ? Palette.ink : Palette.smoke)).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(240, 56).setInteractive(new Phaser.Geom.Rectangle(-120, -28, 240, 56), Phaser.Geom.Rectangle.Contains);
    c.on("pointerup", () => {
      if (this.tab === key) return;
      this.tab = key;
      this.svc.audio.sfxUi();
      this.scene.restart();
    });
  }

  // ----------------------------------------------------------- skins ----
  private buildSkins(): void {
    const W = this.scale.width;
    const cols = 2;
    const cardW = 300;
    const cardH = 186;
    const gapX = 24;
    const gapY = 18;
    const startY = 296;

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
    this.content.add(card);
    const border = selected ? Palette.accent : owned ? Palette.near : Palette.dim;
    card.add(roundedPanel(this, w, h, { fill: Palette.skyMid, fillAlpha: 0.92, stroke: border, strokeAlpha: 0.95, lineWidth: selected ? 3 : 2, radius: 18 }));

    // crow preview
    const crow = this.add.image(0, -34, Tex.crow0).setScale(1.15).setTint(skin.bodyColor);
    const eye = this.add.image(22, -40, Tex.eye).setScale(0.6).setTint(skin.accentColor).setBlendMode(Phaser.BlendModes.ADD);
    card.add([crow, eye]);

    card.add(this.add.text(0, 24, skin.name, displayStyle(26, Palette.bone)).setOrigin(0.5));

    let statusLabel: string;
    let statusColor: number;
    if (selected) {
      statusLabel = "EQUIPPED";
      statusColor = Palette.accent;
    } else if (owned) {
      statusLabel = "TAP TO EQUIP";
      statusColor = Palette.smoke;
    } else if (locked) {
      statusLabel = "🔒 LOCKED";
      statusColor = Palette.dim;
    } else {
      statusLabel = `${skin.price} 🪶`;
      statusColor = save.plumes >= skin.price ? Palette.gold : Palette.danger;
    }
    card.add(this.add.text(0, 60, statusLabel, textStyle(22, statusColor)).setOrigin(0.5));

    card.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    card.on("pointerup", () => this.onSkinTap(id));
    if (locked) {
      card.on("pointerover", () => toast(this, skin.blurb, Palette.violet));
    }
  }

  private onSkinTap(id: string): void {
    const save = this.svc.save.get();
    const skin = getSkin(id);
    if (save.unlockedSkins.includes(id)) {
      this.svc.selectSkin(id);
      this.svc.audio.sfxUi(true);
      this.svc.haptics.fire("light");
      this.scene.restart();
      return;
    }
    if (skin.price < 0) {
      toast(this, skin.blurb, Palette.violet);
      return;
    }
    if (this.svc.buySkin(id)) {
      this.svc.selectSkin(id);
      this.svc.audio.sfxReward();
      this.svc.haptics.fire("success");
      toast(this, `Unlocked ${skin.name}!`, Palette.gold);
      this.scene.restart();
    } else {
      toast(this, "Not enough Plumes", Palette.danger);
      this.svc.audio.sfxUi();
      this.svc.haptics.fire("warning");
    }
  }

  // --------------------------------------------------------- upgrades ----
  private buildUpgrades(): void {
    const W = this.scale.width;
    const startY = 290;
    const rowH = 128;
    UPGRADES.forEach((u, i) => {
      this.upgradeRow(W / 2, startY + i * (rowH + 14), 620, rowH, u.id);
    });
  }

  private upgradeRow(x: number, y: number, w: number, h: number, id: string): void {
    const def = UPGRADES.find((u) => u.id === id)!;
    const save = this.svc.save.get();
    const owned = save.upgrades[id] ?? 0;
    const cost = nextCost(def, owned);
    const maxed = cost === null;

    const row = this.add.container(x, y);
    this.content.add(row);
    row.add(roundedPanel(this, w, h, { fill: Palette.skyMid, fillAlpha: 0.92, stroke: Palette.near, radius: 18 }));

    row.add(this.add.text(-w / 2 + 50, -22, def.icon, textStyle(42)).setOrigin(0.5));
    row.add(this.add.text(-w / 2 + 100, -34, def.name, displayStyle(26, Palette.bone)).setOrigin(0, 0.5));
    row.add(this.add.text(-w / 2 + 100, 0, def.describe(owned), textStyle(20, Palette.smoke)).setOrigin(0, 0.5));

    // level pips
    for (let i = 0; i < def.maxLevel; i++) {
      const filled = i < owned;
      row.add(this.add.circle(-w / 2 + 104 + i * 26, 34, 8, filled ? Palette.violet : Palette.dim, filled ? 1 : 0.5));
    }

    // buy button
    const bx = w / 2 - 110;
    const btn = this.add.container(bx, 0);
    const g = this.add.graphics();
    const affordable = !maxed && save.plumes >= (cost ?? 0);
    const fill = maxed ? Palette.near : affordable ? Palette.gold : Palette.near;
    g.fillStyle(fill, 0.95);
    g.fillRoundedRect(-90, -34, 180, 68, 16);
    const label = maxed ? "MAX" : `${cost} 🪶`;
    btn.add([g, this.add.text(0, 0, label, textStyle(24, maxed ? Palette.smoke : affordable ? Palette.ink : Palette.danger)).setOrigin(0.5)]);
    row.add(btn);

    if (!maxed) {
      btn.setSize(180, 68).setInteractive(new Phaser.Geom.Rectangle(-90, -34, 180, 68), Phaser.Geom.Rectangle.Contains);
      btn.on("pointerup", () => this.onUpgradeBuy(id));
    }
  }

  private onUpgradeBuy(id: string): void {
    const def = UPGRADES.find((u) => u.id === id)!;
    if (this.svc.buyUpgrade(id)) {
      this.svc.audio.sfxReward();
      this.svc.haptics.fire("success");
      toast(this, `${def.name} upgraded!`, Palette.gold);
      this.badge.setCount(this.svc.save.get().plumes);
      this.scene.restart();
    } else {
      toast(this, "Not enough Plumes", Palette.danger);
      this.svc.audio.sfxUi();
      this.svc.haptics.fire("warning");
    }
  }
}
