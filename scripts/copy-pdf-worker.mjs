/**
 * Copies the pdf.js worker into `public/`.
 *
 * The resume builder parses uploaded PDFs in the browser, and pdf.js does that
 * work in a separate worker script that it fetches at runtime. Bundling the
 * worker is not an option — it has to be a real URL — so it is copied out of
 * node_modules on install and before every build. Doing it that way rather
 * than committing the file means the worker can never drift out of step with
 * the pdfjs-dist version in package.json, which fails at runtime with a
 * version-mismatch error that is genuinely hard to read.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

try {
  const pkg = require.resolve("pdfjs-dist/package.json");
  const root = dirname(pkg);

  // pdfjs-dist has moved this file between releases.
  const candidates = [
    join(root, "build", "pdf.worker.min.js"),
    join(root, "build", "pdf.worker.min.mjs"),
    join(root, "build", "pdf.worker.js"),
  ];
  const src = candidates.find(existsSync);
  if (!src) throw new Error(`no worker found under ${join(root, "build")}`);

  mkdirSync("public", { recursive: true });
  copyFileSync(src, join("public", "pdf.worker.min.js"));
  console.log(`pdf worker -> public/pdf.worker.min.js (from ${src})`);
} catch (err) {
  // A missing worker breaks PDF upload but nothing else, so this must not fail
  // the build for someone who only wants to run the referral side.
  console.warn(`[copy-pdf-worker] skipped: ${err.message}`);
}
