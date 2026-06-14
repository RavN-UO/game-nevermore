/**
 * Central visual theme. Colours, palette and typography live here so the whole
 * look can be re-skinned without touching gameplay code.
 *
 * Colours are stored as integers (0xRRGGBB) for Phaser, with `css()` helpers
 * for DOM/CSS contexts.
 */

export const Palette = {
  // Backdrop — gothic night, but bright enough to stay readable in daylight.
  skyTop: 0x2a3066,
  skyMid: 0x191d42,
  skyBottom: 0x0e1130,

  // Parallax silhouettes (far → near) — clearly stepped for depth.
  far: 0x323a72,
  mid: 0x424c8a,
  near: 0x5563a8,
  ground: 0x252a4a,

  // Cold accents
  accent: 0x8fe8ff, // cyan glow (souls, UI highlights)
  accentSoft: 0x6fc8ee,
  violet: 0xa98cff,
  ember: 0xff8a63, // warm contrast for danger / death
  gold: 0xffd76a, // currency / rewards

  // Neutrals
  ink: 0x0e1130,
  bone: 0xeef1ff,
  smoke: 0x9aa2cc,
  dim: 0x5a6296,

  // Crow default
  crow: 0x161a36,
  crowEdge: 0x3a4480,

  white: 0xffffff,
  danger: 0xff5d7a,
  good: 0x6dffaa,
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
