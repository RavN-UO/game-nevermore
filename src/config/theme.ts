/**
 * Central visual theme. Colours, palette and typography live here so the whole
 * look can be re-skinned without touching gameplay code.
 *
 * Colours are stored as integers (0xRRGGBB) for Phaser, with `css()` helpers
 * for DOM/CSS contexts.
 */

export const Palette = {
  // Backdrop — deep gothic night, top → bottom of the abyss
  skyTop: 0x10122a,
  skyMid: 0x0a0a1a,
  skyBottom: 0x05050c,

  // Parallax silhouettes (far → near)
  far: 0x141733,
  mid: 0x191d3e,
  near: 0x21274f,
  ground: 0x0c0d1c,

  // Cold accents
  accent: 0x7be0ff, // cyan glow (souls, UI highlights)
  accentSoft: 0x4a9fd4,
  violet: 0x9a7bff,
  ember: 0xff7a59, // warm contrast for danger / death
  gold: 0xffd76a, // currency / rewards

  // Neutrals
  ink: 0x05050c,
  bone: 0xe8ecff,
  smoke: 0x8189b3,
  dim: 0x4a5080,

  // Crow default
  crow: 0x0d0e1a,
  crowEdge: 0x2a2f5a,

  white: 0xffffff,
  danger: 0xff4d6d,
  good: 0x5dffa0,
} as const;

export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

/** Linearly interpolate between two 0xRRGGBB colours. t in [0,1]. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// Font stack — system fonts on iOS (San Francisco) with a condensed fallback.
export const Fonts = {
  ui: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  display:
    '"Cinzel", "Times New Roman", -apple-system, BlinkMacSystemFont, serif',
  mono: '"SF Mono", ui-monospace, "Roboto Mono", monospace',
} as const;
