import Phaser from "phaser";
import { Palette, Fonts, hex } from "../config/theme";
import type { Services } from "../systems/Services";

/**
 * Small reusable UI widgets shared across the menu / shop / leaderboard / death
 * scenes. Everything is built from Graphics + Text (no image assets).
 */

export function getServices(scene: Phaser.Scene): Services {
  return scene.registry.get("services") as Services;
}

export function textStyle(
  size: number,
  color: number = Palette.bone,
  opts: { weight?: string; font?: string; align?: string } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: opts.font ?? Fonts.ui,
    fontSize: `${size}px`,
    color: hex(color),
    fontStyle: opts.weight ?? "600",
    align: opts.align ?? "center",
  };
}

export function displayStyle(
  size: number,
  color: number = Palette.bone,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: Fonts.display,
    fontSize: `${size}px`,
    color: hex(color),
    fontStyle: "700",
    align: "center",
  };
}

/** Rounded-rect panel as a Graphics centered on (0,0). Add it to a container. */
export function roundedPanel(
  scene: Phaser.Scene,
  w: number,
  h: number,
  opts: { fill?: number; fillAlpha?: number; stroke?: number; strokeAlpha?: number; radius?: number; lineWidth?: number } = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = opts.radius ?? 22;
  g.fillStyle(opts.fill ?? Palette.skyMid, opts.fillAlpha ?? 0.92);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  if (opts.stroke !== undefined) {
    g.lineStyle(opts.lineWidth ?? 2, opts.stroke, opts.strokeAlpha ?? 0.8);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
  return g;
}

export interface ButtonOpts {
  w?: number;
  h?: number;
  fill?: number;
  textColor?: number;
  size?: number;
  stroke?: number;
  display?: boolean;
  glyph?: string;
}

/** A tappable pill button (Container). Returns the container; label is child[1]. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.w ?? 320;
  const h = opts.h ?? 78;
  const fill = opts.fill ?? Palette.near;
  const c = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const draw = (f: number, alpha: number) => {
    bg.clear();
    bg.fillStyle(f, alpha);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    if (opts.stroke !== undefined) {
      bg.lineStyle(2, opts.stroke, 0.9);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
  };
  draw(fill, 0.95);

  const txt = scene.add
    .text(0, 0, label, opts.display ? displayStyle(opts.size ?? 30, opts.textColor ?? Palette.bone) : textStyle(opts.size ?? 28, opts.textColor ?? Palette.bone))
    .setOrigin(0.5);

  c.add([bg, txt]);
  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

  const svc = getServices(scene);
  c.on("pointerover", () => draw(Phaser.Display.Color.IntegerToColor(fill).brighten(15).color, 1));
  c.on("pointerout", () => {
    draw(fill, 0.95);
    c.setScale(1);
  });
  c.on("pointerdown", () => {
    c.setScale(0.95);
    svc?.audio.sfxUi();
    svc?.haptics.fire("tick");
  });
  c.on("pointerup", () => {
    c.setScale(1);
    onClick();
  });
  c.on("pointerupoutside", () => c.setScale(1));
  return c;
}

/** Compact icon/back button. */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  glyph: string,
  onClick: () => void,
  size = 64,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(Palette.near, 0.9);
  bg.fillRoundedRect(-size / 2, -size / 2, size, size, 16);
  const txt = scene.add.text(0, 0, glyph, textStyle(size * 0.46)).setOrigin(0.5);
  c.add([bg, txt]);
  c.setSize(size, size);
  c.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size), Phaser.Geom.Rectangle.Contains);
  const svc = getServices(scene);
  c.on("pointerdown", () => {
    c.setScale(0.9);
    svc?.audio.sfxUi();
    svc?.haptics.fire("tick");
  });
  c.on("pointerup", () => {
    c.setScale(1);
    onClick();
  });
  c.on("pointerout", () => c.setScale(1));
  c.on("pointerupoutside", () => c.setScale(1));
  return c;
}

/** A "🪶 1234" currency badge. Call `setCount` on the returned object. */
export interface PlumesBadge extends Phaser.GameObjects.Container {
  setCount(n: number): void;
}

export function plumesBadge(scene: Phaser.Scene, x: number, y: number, count: number): PlumesBadge {
  const c = scene.add.container(x, y) as PlumesBadge;
  const w = 150;
  const h = 52;
  const bg = scene.add.graphics();
  bg.fillStyle(Palette.skyBottom, 0.7);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  bg.lineStyle(1.5, Palette.gold, 0.5);
  bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const glyph = scene.add.text(-w / 2 + 26, 0, "🪶", textStyle(24)).setOrigin(0.5);
  const txt = scene.add.text(-w / 2 + 48, 0, String(count), textStyle(26, Palette.gold)).setOrigin(0, 0.5);
  c.add([bg, glyph, txt]);
  c.setCount = (n: number) => txt.setText(String(Math.round(n)));
  return c;
}

/** A horizontal slider (tap or drag to set). Value is 0..1. */
export function slider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  value: number,
  onChange: (v: number) => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const h = 10;
  const track = scene.add.graphics();
  const handle = scene.add.circle(0, 0, 16, Palette.accent).setStrokeStyle(2, Palette.bone, 0.6);
  const redraw = (v: number) => {
    track.clear();
    track.fillStyle(Palette.skyBottom, 0.85);
    track.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    track.fillStyle(Palette.accent, 0.9);
    track.fillRoundedRect(-w / 2, -h / 2, w * v, h, h / 2);
    handle.x = -w / 2 + w * v;
  };
  redraw(value);
  const zone = scene.add.zone(0, 0, w + 44, 54).setOrigin(0.5).setInteractive();
  c.add([track, handle, zone]);
  const set = (px: number) => {
    const v = Phaser.Math.Clamp((px - (x - w / 2)) / w, 0, 1);
    redraw(v);
    onChange(v);
  };
  zone.on("pointerdown", (p: Phaser.Input.Pointer) => set(p.worldX));
  zone.on("pointermove", (p: Phaser.Input.Pointer) => {
    if (p.isDown) set(p.worldX);
  });
  return c;
}

/** Briefly flashes a toast message near the top of the screen. */
export function toast(scene: Phaser.Scene, message: string, color: number = Palette.accent): void {
  const { width } = scene.scale;
  const t = scene.add
    .text(width / 2, 150, message, textStyle(26, color))
    .setOrigin(0.5)
    .setDepth(10000)
    .setAlpha(0);
  scene.tweens.add({ targets: t, alpha: 1, y: 130, duration: 220, yoyo: true, hold: 900, onComplete: () => t.destroy() });
}
