/**
 * Generates the 1024 × 500 Play Store feature graphic.
 *
 *   node scripts/generate-feature-graphic.mjs
 *
 * Play shows this at the top of the listing and crops it on some surfaces, so
 * everything that has to survive lives in the middle ~80%. It is generated
 * rather than exported by hand for the same reason the icons are: it has to
 * stay in step with the brand colour and the mark, and a stale feature graphic
 * is the sort of thing nobody notices for six months.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = process.env.OUT_DIR ?? "store-assets";
const W = 1024;
const H = 500;

const BRAND = "#bd8326";
const BRAND_DARK = "#5c3d17";
const INK = "#05060c";

/** The same five pipeline colours the product uses for referral status. */
const PIPE = ["#f59e0b", "#38bdf8", "#6366f1", "#a78bfa", "#34d399"];

function svg() {
  // The mark, reused from the icon generator's output so the two cannot drift.
  const mark = readFileSync(join("public", "icons", "mark.svg"), "utf8")
    .replace(/^<\?xml[^>]*\?>\s*/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

  // Pipeline chips, echoing the motif used across the app and the documents.
  const chipW = 62;
  const chipGap = 9;
  const chips = PIPE.map(
    (c, i) =>
      `<rect x="${96 + i * (chipW + chipGap)}" y="150" width="${chipW}" height="8" rx="4" fill="${c}"/>`,
  ).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${INK}"/>
      <stop offset="55%" stop-color="${BRAND_DARK}"/>
      <stop offset="100%" stop-color="${BRAND}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="markClip">
      <rect x="0" y="0" width="512" height="512"/>
    </clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  ${chips}

  <text x="96" y="228" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff" letter-spacing="-1">
    See who can refer you.
  </text>
  <text x="96" y="292" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#f3d78c" letter-spacing="-1">
    Then watch it move.
  </text>

  <!-- Both lines stay left of x≈690 so neither runs under the mark. -->
  <text x="96" y="352" font-family="Helvetica, Arial, sans-serif" font-size="25" fill="#e7d9b8">
    The people inside who can put your name
  </text>
  <text x="96" y="386" font-family="Helvetica, Arial, sans-serif" font-size="25" fill="#e7d9b8">
    forward — and every referral, tracked.
  </text>

  <!-- The mark, large and softly inset on the right. Cropped surfaces lose
       part of it, which is fine — no text sits under it. -->
  <g transform="translate(742, 118) scale(0.515)" opacity="0.97">
    <g clip-path="url(#markClip)">${mark}</g>
  </g>
</svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, "feature-graphic-1024x500.png");
  // Play wants an opaque graphic; a transparent one is composited onto white
  // on some surfaces and onto the listing background on others.
  await sharp(Buffer.from(svg()))
    .flatten({ background: INK })
    .png()
    .toFile(file);
  console.log(`feature graphic -> ${file}`);

  // Play also wants the app icon uploaded separately from the package.
  await sharp(join("public", "icons", "play-icon-512.png"))
    .flatten({ background: BRAND_DARK }) // must be opaque; Play applies its own mask
    .png()
    .toFile(join(OUT, "app-icon-512.png"));
  console.log(`app icon      -> ${join(OUT, "app-icon-512.png")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
