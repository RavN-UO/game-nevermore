/**
 * Dependency-free PWA icon generator.
 *
 * Renders the NEVERMORE mark (a flying raven over a cold crescent moon, on a
 * deep-navy gradient) entirely in JS and encodes it to PNG using Node's
 * built-in zlib — no native image libraries required, so it works in any
 * environment. Run with `npm run icons`.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- canvas ----
function makeCanvas(size) {
  return { w: size, h: size, data: new Uint8ClampedArray(size * size * 4) };
}

function blend(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h || a <= 0) return;
  const i = (y * c.w + x) * 4;
  const ia = 1 - a;
  c.data[i] = r * a + c.data[i] * ia;
  c.data[i + 1] = g * a + c.data[i + 1] * ia;
  c.data[i + 2] = b * a + c.data[i + 2] * ia;
  c.data[i + 3] = Math.min(255, c.data[i + 3] + a * 255);
}

// vertical gradient background
function gradient(c, top, bottom) {
  for (let y = 0; y < c.h; y++) {
    const t = y / (c.h - 1);
    const r = top[0] + (bottom[0] - top[0]) * t;
    const g = top[1] + (bottom[1] - top[1]) * t;
    const b = top[2] + (bottom[2] - top[2]) * t;
    for (let x = 0; x < c.w; x++) blend(c, x, y, r, g, b, 1);
  }
}

function radialGlow(c, cx, cy, radius, color, strength) {
  const r2 = radius * radius;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      const a = (1 - Math.sqrt(d2) / radius) ** 2 * strength;
      blend(c, x, y, color[0], color[1], color[2], a);
    }
  }
}

// crescent = bright disc minus an offset disc
function crescent(c, cx, cy, radius, offset, color) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const inMain = x * x + y * y <= radius * radius;
      const dx = x - offset;
      const inCut = dx * dx + y * y <= radius * radius;
      if (inMain && !inCut) blend(c, cx + x, cy + y, color[0], color[1], color[2], 1);
    }
  }
}

// even-odd polygon fill with 2x supersampling for smooth edges
function polygon(c, pts, color, alpha = 1) {
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const ss = 2;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = 0; x < c.w; x++) {
      let hits = 0;
      for (let sx = 0; sx < ss; sx++) {
        for (let sy = 0; sy < ss; sy++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0],
              yi = pts[i][1],
              xj = pts[j][0],
              yj = pts[j][1];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
              inside = !inside;
          }
          if (inside) hits++;
        }
      }
      if (hits) blend(c, x, y, color[0], color[1], color[2], (hits / (ss * ss)) * alpha);
    }
  }
}

// stylized flying raven, normalized coords mapped into the canvas
function raven(c, color) {
  const N = [
    [0.06, 0.42], [0.27, 0.55], [0.4, 0.46], [0.5, 0.53],
    [0.6, 0.46], [0.73, 0.55], [0.94, 0.42], [0.72, 0.64],
    [0.56, 0.58], [0.5, 0.66], [0.44, 0.58], [0.28, 0.64],
  ];
  const pts = N.map(([x, y]) => [x * c.w, y * c.h]);
  polygon(c, pts, color, 1);
}

// ---------------------------------------------------------------- compose ---
function render(size, { pad = 0 } = {}) {
  const c = makeCanvas(size);
  gradient(c, [22, 24, 46], [6, 6, 13]);
  // moon glow + crescent, upper-right
  const mx = size * 0.66,
    my = size * 0.34,
    mr = size * 0.17;
  radialGlow(c, mx, my, mr * 2.4, [120, 200, 230], 0.5);
  crescent(c, mx, my, mr, mr * 0.62, [196, 224, 240]);
  // vignette
  radialGlow(c, size / 2, size / 2, size * 0.72, [0, 0, 0], 0); // (kept subtle via gradient)
  // raven silhouette (scaled down for maskable safe-zone if padded)
  const scaled = makeCanvas(size);
  raven(scaled, [10, 10, 18]);
  const s = 1 - pad * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.round((x - size / 2) / s + size / 2);
      const sy = Math.round((y - size / 2) / s + size / 2);
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      const i = (sy * size + sx) * 4;
      const a = scaled.data[i + 3] / 255;
      if (a > 0) blend(c, x, y, scaled.data[i], scaled.data[i + 1], scaled.data[i + 2], a);
    }
  }
  return c;
}

// ---------------------------------------------------------------- encode ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(c) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // raw scanlines with filter byte 0
  const stride = c.w * 4;
  const raw = Buffer.alloc((stride + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = c.data[y * stride + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#16182e"/><stop offset="1" stop-color="#06060d"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="url(#g)"/>
<circle cx="42" cy="22" r="9" fill="#c4e0f0"/><circle cx="46" cy="20" r="9" fill="#16182e"/>
<path d="M6 28 L18 35 L26 30 L32 34 L38 30 L46 35 L58 28 L46 41 L36 37 L32 42 L28 37 L18 41 Z" fill="#0a0a12"/>
</svg>`;

for (const [name, size, opts] of [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { pad: 0.12 }],
  ["apple-touch-icon.png", 180, {}],
]) {
  writeFileSync(join(OUT, name), encodePNG(render(size, opts)));
  console.log("wrote", name);
}
writeFileSync(join(OUT, "favicon.svg"), FAVICON_SVG);
console.log("wrote favicon.svg");
