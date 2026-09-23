/**
 * Generates every icon the PWA and the Play listing need, from one definition.
 *
 *   node scripts/generate-icons.mjs
 *
 * Why generate rather than commit a folder of PNGs: there are six of them, in
 * three variants, and they have to stay in step with each other and with the
 * brand colour in `src/app/manifest.ts`. Hand-exporting six files from a design
 * tool is exactly the sort of thing that silently drifts — you change the
 * colour, update four of them, and ship a maskable icon in last month's blue.
 *
 * The three variants exist because Android uses them differently:
 *
 *   any         drawn as-is, on a launcher that does not mask
 *   maskable    the launcher crops this to a circle, squircle or teardrop, so
 *               everything meaningful must sit inside the centre 80% — the
 *               "safe zone". The artwork is therefore the same glyph, smaller,
 *               on a full-bleed background.
 *   monochrome  Android 13+ themed icons. Only the alpha channel is read; the
 *               launcher supplies the colour. Drawn white-on-transparent.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join("public", "icons");
const BRAND = "#bd8326";
const BRAND_DARK = "#5c3d17";

/**
 * The mark: a rounded tile with a chevron-into-door glyph — the "referred
 * through" idea the whole product is about. Drawn as SVG so it scales to any
 * size without a resampling step.
 *
 * @param size    pixel size of the square
 * @param inset   0–0.5, how far in from the edge the glyph is drawn. Higher
 *                values keep the glyph inside a maskable safe zone.
 * @param mode    "brand" | "mono"
 * @param bleed   true for a full-bleed background (maskable), false for a
 *                rounded tile with transparent corners.
 */
function markSVG({ size, inset = 0.22, mode = "brand", bleed = false }) {
  const s = size;
  const fg = mode === "mono" ? "#ffffff" : "#ffffff";
  const radius = bleed ? 0 : s * 0.22;

  const bg =
    mode === "mono"
      ? "none"
      : `url(#g)`;

  // Glyph geometry, in a 0..1 box, then scaled into the safe area.
  const pad = s * inset;
  const box = s - pad * 2;
  const x = (v) => pad + v * box;
  const y = (v) => pad + v * box;
  const stroke = Math.max(2, box * 0.11);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND}"/>
      <stop offset="100%" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  ${mode === "mono" ? "" : `<rect width="${s}" height="${s}" rx="${radius}" ry="${radius}" fill="${bg}"/>`}

  <!-- door frame: the company you are being referred into -->
  <path d="M ${x(0.58)} ${y(0.06)} H ${x(0.96)} V ${y(0.94)} H ${x(0.58)}"
        fill="none" stroke="${fg}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-linejoin="round" opacity="${mode === "mono" ? 1 : 0.9}"/>

  <!-- arrow through it: the referral -->
  <path d="M ${x(0.04)} ${y(0.5)} H ${x(0.66)}"
        fill="none" stroke="${fg}" stroke-width="${stroke}" stroke-linecap="round"/>
  <path d="M ${x(0.44)} ${y(0.28)} L ${x(0.68)} ${y(0.5)} L ${x(0.44)} ${y(0.72)}"
        fill="none" stroke="${fg}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, file));
  console.log(`  ${file}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("icons ->", OUT);

  // `any` — rounded tile, generous glyph.
  await png(markSVG({ size: 192, inset: 0.24 }), 192, "icon-192.png");
  await png(markSVG({ size: 512, inset: 0.24 }), 512, "icon-512.png");

  // `maskable` — full bleed, glyph pulled into the centre 80% safe zone.
  await png(markSVG({ size: 192, inset: 0.32, bleed: true }), 192, "icon-maskable-192.png");
  await png(markSVG({ size: 512, inset: 0.32, bleed: true }), 512, "icon-maskable-512.png");

  // `monochrome` — alpha only; the launcher colours it.
  await png(markSVG({ size: 512, inset: 0.3, mode: "mono" }), 512, "icon-monochrome-512.png");

  // iOS home screen. No transparency — iOS composites it onto black.
  await png(markSVG({ size: 180, inset: 0.24, bleed: true }), 180, "apple-touch-icon.png");

  // Browser tab.
  await png(markSVG({ size: 32, inset: 0.2, bleed: true }), 32, "favicon-32.png");

  // The Play Console wants a 512 icon uploaded separately from the app.
  await png(markSVG({ size: 512, inset: 0.24, bleed: true }), 512, "play-icon-512.png");

  // Keep the raw SVG next to the PNGs so the mark can be reused at any size.
  writeFileSync(join(OUT, "mark.svg"), markSVG({ size: 512, inset: 0.24 }));
  console.log("  mark.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
