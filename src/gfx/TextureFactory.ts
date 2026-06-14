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

  // crescent moon, built on an offscreen canvas so the "dark side" is carved
  // with destination-out (a real crescent) instead of a flat dark disc that
  // reads as a black ball over the glow.
  const mr = 50;
  const moon = document.createElement("canvas");
  moon.width = moon.height = mr * 3;
  const mc = moon.getContext("2d")!;
  const c0 = mr * 1.5;
  mc.fillStyle = "#d8ecff";
  mc.beginPath();
  mc.arc(c0, c0, mr, 0, Math.PI * 2);
  mc.fill();
  mc.globalCompositeOperation = "destination-out";
  mc.beginPath();
  mc.arc(c0 + mr * 0.5, c0 - mr * 0.28, mr * 0.92, 0, Math.PI * 2);
  mc.fill();
  ctx.drawImage(moon, mx - c0, my - c0);

  refresh(scene, Tex.sky);
}

function buildVignette(scene: Phaser.Scene): void {
  const w = DESIGN.width;
  const h = DESIGN.height;
  const ctx = canvas(scene, Tex.vignette, w, h);
  if (!ctx) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.44, w / 2, h / 2, h * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.4)");
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
  const W = 124;
  const H = 96;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Sleek raven in flight, facing right. Drawn in white so the sprite can be
  // tinted by the active skin; the eye/halo are added as separate glows.
  g.fillStyle(0xffffff, 1);
  const body: Phaser.Types.Math.Vector2Like[] = [
    { x: 120, y: 44 }, // beak tip
    { x: 104, y: 39 }, // beak top
    { x: 96, y: 34 }, // forehead
    { x: 86, y: 31 }, // crown
    { x: 72, y: 33 }, // nape
    { x: 50, y: 36 }, // back
    { x: 22, y: 33 }, // upper tail base
    { x: 4, y: 30 }, // upper tail tip
    { x: 16, y: 46 }, // tail fork
    { x: 6, y: 60 }, // lower tail tip
    { x: 30, y: 52 }, // lower tail base
    { x: 58, y: 54 }, // belly
    { x: 84, y: 52 }, // breast
    { x: 98, y: 48 }, // throat
    { x: 104, y: 46 }, // chin
  ];
  g.fillPoints(body, true);
  // smooth the head with a small circle
  g.fillCircle(88, 38, 9);

  // wing — a swept, slightly curved shape that changes per frame
  let wingPts: Phaser.Types.Math.Vector2Like[];
  if (wing === "up") {
    wingPts = [{ x: 44, y: 36 }, { x: 74, y: 34 }, { x: 78, y: 12 }, { x: 60, y: 2 }, { x: 48, y: 22 }];
  } else if (wing === "mid") {
    wingPts = [{ x: 42, y: 38 }, { x: 72, y: 36 }, { x: 92, y: 30 }, { x: 70, y: 26 }, { x: 50, y: 30 }];
  } else {
    wingPts = [{ x: 46, y: 38 }, { x: 72, y: 40 }, { x: 80, y: 64 }, { x: 58, y: 74 }, { x: 48, y: 50 }];
  }
  g.fillPoints(wingPts, true);

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

  // bright cold rim highlight on the silhouette edges so the gap reads clearly
  g.lineStyle(5, Palette.accent, 0.9);
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
  g.lineStyle(5, Palette.accent, 0.85);
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
