import Phaser from "phaser";
import { DESIGN } from "../config/balance";
import { Palette, css, hex } from "../config/theme";

/**
 * Generates every visual asset procedurally, once, at boot (BRIEF §2 / §2 bis).
 * Nothing is loaded from disk and nothing is redrawn per frame — gameplay just
 * uses these baked textures (sprites / tile-sprites / particle textures).
 *
 * - Soft, glowing things (souls, particles, eye, vignette, sky) use a real
 *   Canvas2D radial/linear gradient for clean falloff.
 * - Hard silhouettes (crow frames, spires, ridges) use Phaser Graphics polygons.
 */

export const Tex = {
  sky: "tex-sky",
  vignette: "tex-vignette",
  fog: "tex-fog",
  ridgeFar: "tex-ridge-far",
  ridgeMid: "tex-ridge-mid",
  ridgeNear: "tex-ridge-near",
  crow0: "tex-crow0",
  crow1: "tex-crow1",
  crow2: "tex-crow2",
  eye: "tex-eye",
  spire: "tex-spire",
  fang: "tex-fang",
  soul: "tex-soul",
  glow: "tex-glow",
  shard: "tex-shard",
  ring: "tex-ring",
} as const;

export const CROW_FRAMES = [Tex.crow0, Tex.crow1, Tex.crow2];

export function generateTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(Tex.sky)) return; // already built
  buildSky(scene);
  buildVignette(scene);
  buildFog(scene);
  buildRidges(scene);
  buildCrow(scene);
  buildEye(scene);
  buildSpire(scene);
  buildFang(scene);
  buildGlow(scene, Tex.soul, 64, hex(Palette.accent));
  buildGlow(scene, Tex.glow, 48, "#ffffff");
  buildShard(scene);
  buildRing(scene);
}

// ----------------------------------------------------------------- canvas ----
function canvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): CanvasRenderingContext2D | null {
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return null;
  const ctx = t.getContext();
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function refresh(scene: Phaser.Scene, key: string): void {
  const t = scene.textures.get(key);
  if (t && "refresh" in t) (t as Phaser.Textures.CanvasTexture).refresh();
}

function buildSky(scene: Phaser.Scene): void {
  const w = DESIGN.width;
  const h = DESIGN.height;
  const ctx = canvas(scene, Tex.sky, w, h);
  if (!ctx) return;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hex(Palette.skyTop));
  grad.addColorStop(0.55, hex(Palette.skyMid));
  grad.addColorStop(1, hex(Palette.skyBottom));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // faint stars in the upper half
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.6;
    const r = Math.random() * 1.4 + 0.3;
    const a = Math.random() * 0.5 + 0.1;
    ctx.fillStyle = css(Palette.bone, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // a cold moon glow, upper right
  const mx = w * 0.72;
  const my = h * 0.16;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
  mg.addColorStop(0, css(0x9ad6ff, 0.5));
  mg.addColorStop(0.4, css(0x4a86c4, 0.18));
  mg.addColorStop(1, css(0x4a86c4, 0));
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(0xd6ecff, 0.9);
  ctx.beginPath();
  ctx.arc(mx, my, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hex(Palette.skyTop);
  ctx.beginPath();
  ctx.arc(mx + 22, my - 12, 44, 0, Math.PI * 2);
  ctx.fill();

  refresh(scene, Tex.sky);
}

function buildVignette(scene: Phaser.Scene): void {
  const w = DESIGN.width;
  const h = DESIGN.height;
  const ctx = canvas(scene, Tex.vignette, w, h);
  if (!ctx) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  refresh(scene, Tex.vignette);
}

function buildFog(scene: Phaser.Scene): void {
  const w = DESIGN.width;
  const h = 260;
  const ctx = canvas(scene, Tex.fog, w, h);
  if (!ctx) return;
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = h * 0.3 + Math.random() * h * 0.6;
    const r = 70 + Math.random() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(Palette.near, 0.1));
    g.addColorStop(1, css(Palette.near, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  refresh(scene, Tex.fog);
}

// ----------------------------------------------------------------- ridges ----
function buildRidges(scene: Phaser.Scene): void {
  ridge(scene, Tex.ridgeFar, Palette.far, 0.55, 120, 7);
  ridge(scene, Tex.ridgeMid, Palette.mid, 0.62, 180, 9);
  ridge(scene, Tex.ridgeNear, Palette.near, 0.72, 240, 6);
}

/** A jagged gothic skyline strip, tileable horizontally (edges match). */
function ridge(
  scene: Phaser.Scene,
  key: string,
  color: number,
  fillRatio: number,
  amp: number,
  peaks: number,
): void {
  const w = DESIGN.width;
  const h = 420;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);

  const baseY = h * (1 - fillRatio);
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: h }];
  const seg = w / peaks;
  const firstY = baseY + amp * 0.3;
  for (let i = 0; i <= peaks; i++) {
    const x = i * seg;
    // sharp gothic spikes: alternate tall/short, last == first for seamless tile
    let y: number;
    if (i === 0 || i === peaks) y = firstY;
    else {
      const tall = i % 2 === 0;
      y = baseY - (tall ? amp : amp * 0.4) - Math.random() * amp * 0.25;
    }
    // add the peak point and a small notch before it for a spiky look
    pts.push({ x: x - seg * 0.18, y: y + amp * 0.5 });
    pts.push({ x, y });
  }
  pts.push({ x: w, y: h });
  g.fillPoints(pts, true);

  // subtle top rim
  g.lineStyle(2, color + 0x0a0a0a, 0.6);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ------------------------------------------------------------------ crow ----
function buildCrow(scene: Phaser.Scene): void {
  buildCrowFrame(scene, Tex.crow0, "up");
  buildCrowFrame(scene, Tex.crow1, "mid");
  buildCrowFrame(scene, Tex.crow2, "down");
}

function buildCrowFrame(scene: Phaser.Scene, key: string, wing: "up" | "mid" | "down"): void {
  const W = 112;
  const H = 84;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // body silhouette in white so the sprite can be tinted by the active skin
  g.fillStyle(0xffffff, 1);
  const body: Phaser.Types.Math.Vector2Like[] = [
    { x: 8, y: 40 }, // tail tip
    { x: 36, y: 30 },
    { x: 70, y: 28 }, // back
    { x: 92, y: 32 }, // head top
    { x: 108, y: 40 }, // beak tip
    { x: 92, y: 46 }, // beak under
    { x: 72, y: 46 },
    { x: 44, y: 54 }, // belly
    { x: 18, y: 52 }, // tail bottom
    { x: 22, y: 44 }, // tail notch
  ];
  g.fillPoints(body, true);

  // wing
  const base1 = { x: 40, y: 34 };
  const base2 = { x: 66, y: 32 };
  let tip: Phaser.Types.Math.Vector2Like;
  if (wing === "up") tip = { x: 52, y: 2 };
  else if (wing === "mid") tip = { x: 60, y: 26 };
  else tip = { x: 50, y: 64 };
  g.fillPoints([base1, base2, tip], true);

  g.generateTexture(key, W, H);
  g.destroy();
}

function buildEye(scene: Phaser.Scene): void {
  buildGlow(scene, Tex.eye, 20, "#ffffff");
}

// ----------------------------------------------------------------- spires ----
function buildSpire(scene: Phaser.Scene): void {
  const W = 110;
  const H = DESIGN.height; // tall enough to cover any column; tip at TOP
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const tip = 200;

  // baked vertical gradient (lighter near the tip, darker into the depths)
  g.fillGradientStyle(Palette.near, Palette.near, Palette.ground, Palette.ground, 1);

  // main spire (triangle) + column
  g.fillPoints(
    [
      { x: W * 0.5, y: 0 },
      { x: W * 0.5 - W * 0.34, y: tip },
      { x: W * 0.5 + W * 0.34, y: tip },
    ],
    true,
  );
  g.fillRect(W * 0.16, tip - 6, W * 0.68, H - tip);

  // flanking mini-pinnacles
  g.fillPoints([{ x: W * 0.12, y: tip + 40 }, { x: W * 0.04, y: tip + 120 }, { x: W * 0.2, y: tip + 120 }], true);
  g.fillPoints([{ x: W * 0.88, y: tip + 40 }, { x: W * 0.8, y: tip + 120 }, { x: W * 0.96, y: tip + 120 }], true);

  // cornice band
  g.fillStyle(Palette.mid, 1);
  g.fillRect(W * 0.1, tip + 6, W * 0.8, 18);

  // darker pointed-arch "windows" down the column for texture
  g.fillStyle(Palette.ground, 0.9);
  for (let y = tip + 70; y < H - 80; y += 150) {
    g.fillPoints(
      [
        { x: W * 0.5, y: y },
        { x: W * 0.32, y: y + 30 },
        { x: W * 0.32, y: y + 90 },
        { x: W * 0.68, y: y + 90 },
        { x: W * 0.68, y: y + 30 },
      ],
      true,
    );
  }

  // cold rim highlight on the silhouette edges (reads against the dark sky)
  g.lineStyle(3, Palette.accentSoft, 0.5);
  g.beginPath();
  g.moveTo(W * 0.5, 0);
  g.lineTo(W * 0.5 - W * 0.34, tip);
  g.lineTo(W * 0.16, tip);
  g.lineTo(W * 0.16, H);
  g.moveTo(W * 0.5, 0);
  g.lineTo(W * 0.5 + W * 0.34, tip);
  g.lineTo(W * 0.84, tip);
  g.lineTo(W * 0.84, H);
  g.strokePath();

  g.generateTexture(Tex.spire, W, H);
  g.destroy();
}

function buildFang(scene: Phaser.Scene): void {
  const W = 110;
  const H = DESIGN.height;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(Palette.near, Palette.near, Palette.ground, Palette.ground, 1);
  // a smooth, slightly curved tapering spike (stalactite), tip at top
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x: W * 0.5, y: 0 }];
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = t * 360;
    const half = W * 0.5 * Math.pow(t, 0.7);
    pts.push({ x: W * 0.5 - half, y });
  }
  // straight column to the bottom on the left, then back up the right
  pts.push({ x: W * 0.5 - W * 0.42, y: H });
  pts.push({ x: W * 0.5 + W * 0.42, y: H });
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const y = t * 360;
    const half = W * 0.5 * Math.pow(t, 0.7);
    pts.push({ x: W * 0.5 + half, y });
  }
  g.fillPoints(pts, true);
  g.lineStyle(3, Palette.accentSoft, 0.45);
  g.beginPath();
  g.moveTo(W * 0.5, 0);
  g.lineTo(W * 0.5 - W * 0.42, H);
  g.moveTo(W * 0.5, 0);
  g.lineTo(W * 0.5 + W * 0.42, H);
  g.strokePath();
  g.generateTexture(Tex.fang, W, H);
  g.destroy();
}

// ------------------------------------------------------------- particles ----
function buildGlow(scene: Phaser.Scene, key: string, size: number, color: string): void {
  const ctx = canvas(scene, key, size, size);
  if (!ctx) return;
  const r = size / 2;
  const gg = ctx.createRadialGradient(r, r, 0, r, r, r);
  gg.addColorStop(0, hexToRgba(color, 1));
  gg.addColorStop(0.3, hexToRgba(color, 0.7));
  gg.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  refresh(scene, key);
}

function buildShard(scene: Phaser.Scene): void {
  const s = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    [
      { x: s / 2, y: 0 },
      { x: s, y: s / 2 },
      { x: s / 2, y: s },
      { x: 0, y: s / 2 },
    ],
    true,
  );
  g.generateTexture(Tex.shard, s, s);
  g.destroy();
}

function buildRing(scene: Phaser.Scene): void {
  const s = 96;
  const ctx = canvas(scene, Tex.ring, s, s);
  if (!ctx) return;
  ctx.strokeStyle = css(Palette.accent, 0.9);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  ctx.stroke();
  refresh(scene, Tex.ring);
}

function hexToRgba(color: string, a: number): string {
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
