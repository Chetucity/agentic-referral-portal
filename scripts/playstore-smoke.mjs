/**
 * Play Store readiness check.
 *
 * Run this against a real deployment before every submission. It is not a unit
 * test — it drives a browser at a running site and asserts the specific things
 * that get a Play submission rejected, or that make a published Trusted Web
 * Activity look broken:
 *
 *   - the PWA is installable (manifest, icons, colours, scope)
 *   - the pages Play requires exist and load *signed out*
 *   - the legal documents name a real operator
 *   - nothing scrolls sideways on a phone
 *   - pinch-zoom is not disabled (Play's accessibility review flags it)
 *   - Digital Asset Links is either correctly published or honestly absent
 *
 *   BASE_URL=https://referin.example.com node scripts/playstore-smoke.mjs
 *
 * Defaults to http://localhost:3000. Against localhost the assetlinks check is
 * expected to report "not configured" — that is a pass locally and a warning
 * against production.
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const EXEC = process.env.CHROMIUM_PATH || undefined;
const isLocal = /localhost|127\.0\.0\.1/.test(BASE);

let pass = 0;
const failures = [];
const warnings = [];

function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${extra ? "  " + extra : ""}`);
  }
}

function warn(name, extra = "") {
  warnings.push(name);
  console.log(`  ! ${name}${extra ? "  " + extra : ""}`);
}

async function json(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  let body = null;
  try { body = await res.json(); } catch { /* not json */ }
  return { status: res.status, body, headers: res.headers };
}

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ["--no-sandbox"],
});

console.log(`\nReadiness check against ${BASE}\n`);

/* ── 1. Web app manifest ────────────────────────────────────────────────── */
console.log("Web app manifest");
{
  const { status, body: m } = await json("/manifest.webmanifest");
  check("manifest is served", status === 200, `→ ${status}`);

  if (m) {
    check("has a name", typeof m.name === "string" && m.name.length > 0);
    check("has a short_name of 12 characters or fewer",
      typeof m.short_name === "string" && m.short_name.length > 0 && m.short_name.length <= 12,
      `→ ${JSON.stringify(m.short_name)}`);
    check("has a description", typeof m.description === "string" && m.description.length > 20);
    check("display is standalone", m.display === "standalone", `→ ${m.display}`);
    check("start_url is set", Boolean(m.start_url));
    check("scope is the origin root", m.scope === "/", `→ ${m.scope}`);
    check("theme_color is a hex colour", /^#[0-9a-f]{6}$/i.test(m.theme_color ?? ""), `→ ${m.theme_color}`);
    check("background_color is a hex colour", /^#[0-9a-f]{6}$/i.test(m.background_color ?? ""), `→ ${m.background_color}`);

    const icons = m.icons ?? [];
    const has = (size, purpose) =>
      icons.some((i) =>
        String(i.sizes).includes(size) &&
        String(i.purpose ?? "any").split(/\s+/).includes(purpose));

    check("has a 192px any icon", has("192x192", "any"));
    check("has a 512px any icon", has("512x512", "any"));
    check("has a 192px maskable icon", has("192x192", "maskable"));
    check("has a 512px maskable icon", has("512x512", "maskable"));
    check("has a 512px monochrome icon", has("512x512", "monochrome"));

    // Every icon the manifest promises must actually be there — a 404 here is
    // why an installed app sometimes shows a blank launcher square.
    let missing = [];
    for (const i of icons) {
      const res = await fetch(new URL(i.src, BASE).href);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) missing.push(`${i.src} (${res.status} ${type})`);
    }
    check("every manifest icon actually loads", missing.length === 0, `→ ${missing.join(", ")}`);
  }
}

/* ── 2. Digital Asset Links ─────────────────────────────────────────────── */
console.log("\nDigital Asset Links");
{
  const { status, body } = await json("/.well-known/assetlinks.json");

  if (status === 404 && body?.error === "not_configured") {
    if (isLocal) {
      check("assetlinks reports 'not configured' before a key exists", true);
    } else {
      warn("assetlinks.json is not configured on this deployment",
        "→ the published app will show a browser URL bar. Set ANDROID_PACKAGE_NAME and ANDROID_SHA256_FINGERPRINTS.");
    }
  } else {
    check("assetlinks.json is served", status === 200, `→ ${status}`);
    check("it is a JSON array of statements", Array.isArray(body));

    if (Array.isArray(body)) {
      const s = body[0] ?? {};
      check("relation is handle_all_urls",
        (s.relation ?? []).includes("delegate_permission/common.handle_all_urls"));
      check("namespace is android_app", s.target?.namespace === "android_app");
      check("names a package", Boolean(s.target?.package_name), `→ ${s.target?.package_name}`);

      const fps = s.target?.sha256_cert_fingerprints ?? [];
      check("has at least one SHA-256 fingerprint", fps.length > 0);
      check("every fingerprint is well formed",
        fps.every((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(f)),
        `→ ${fps.join(" | ")}`);

      // The classic launch-day failure: only the upload key is listed, so the
      // app Google re-signs and ships does not verify.
      if (fps.length < 2) {
        warn("only one fingerprint is listed",
          "→ with Play App Signing you normally need two: your upload key AND Google's app signing key.");
      }
    }
  }
}

/* ── 3. Pages Play requires, signed out ─────────────────────────────────── */
console.log("\nRequired pages (signed out)");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const required = [
    ["/legal/privacy", "Privacy policy"],
    ["/legal/terms", "Terms"],
    ["/account/delete", "Delete your account"],
    ["/contact", "Contact"],
  ];

  for (const [path, needle] of required) {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    check(`${path} loads signed out`, res?.status() === 200 && !page.url().includes("/login"),
      `→ ${res?.status()} ${page.url()}`);
    check(`${path} is the right page`, text.includes(needle));
  }

  // The deletion page has to say what is deleted — Play reads it.
  await page.goto(BASE + "/account/delete", { waitUntil: "domcontentloaded" });
  const del = await page.locator("body").innerText();
  check("deletion page lists what gets deleted", /what gets deleted/i.test(del));
  check("deletion page says what is retained", /kept|retain/i.test(del));

  await ctx.close();
}

/* ── 4. Legal documents name a real operator ────────────────────────────── */
console.log("\nLegal details");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/legal/privacy", { waitUntil: "domcontentloaded" });
  const text = await page.locator("body").innerText();

  const unfilled = (await page.locator("text=needs filling in").count())
    + (await page.locator("text=date needed").count());

  check("privacy policy has no unfilled placeholders", unfilled === 0,
    `→ ${unfilled} placeholder(s). Edit src/lib/legal.ts.`);
  check("privacy policy links the deletion page", text.includes("/account/delete"));
  check("privacy policy mentions what is collected", /what we collect/i.test(text));

  await ctx.close();
}

/* ── 5. Phone layout ────────────────────────────────────────────────────── */
console.log("\nPhone layout (412×915)");
{
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // A job detail page is included because it is the widest layout in the app
  // — two columns on desktop, and the referrer cards inside it are the most
  // likely thing to overflow a narrow phone. The href is read from the
  // rendered board rather than fetched, because a page that has not navigated
  // yet has an opaque origin and cannot fetch anything.
  await page.goto(BASE + "/jobs", { waitUntil: "networkidle" });

  // Sample several openings, not just the first. Overflow on this page depends
  // on the content — a long job title or a wide compensation range — so
  // checking one posting proves very little. Three of the longest-titled ones
  // is a cheap way to catch the realistic worst case.
  const jobHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/jobs/j_"]')]
      .map((a) => ({ href: a.getAttribute("href"), len: (a.textContent ?? "").length }))
      .sort((a, b) => b.len - a.len)
      .slice(0, 3)
      .map((x) => x.href),
  );

  const pages = ["/", "/jobs", "/companies", "/login", "/legal/privacy", "/account/delete", "/contact"];
  if (jobHrefs.length) pages.push(...jobHrefs);
  else warn("no job detail page found to check", "→ is the database seeded?");
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() =>
      Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        0,
      ));
    check(`${path} does not scroll sideways`, overflow <= 1, `→ ${overflow}px of overflow`);
  }

  // Play's accessibility review flags a viewport that blocks zoom.
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const attr = (sel) => page.evaluate((s) => document.querySelector(s)?.getAttribute("content") ?? null, sel);
  const viewport = await attr('meta[name="viewport"]');
  check("viewport meta tag exists", Boolean(viewport), `→ ${viewport}`);
  check("pinch-zoom is not disabled",
    !/user-scalable\s*=\s*(no|0)/i.test(viewport ?? "") && !/maximum-scale\s*=\s*1(\.0)?\b/.test(viewport ?? ""),
    `→ ${viewport}`);
  check("viewport-fit=cover is set (for the notch)", /viewport-fit\s*=\s*cover/i.test(viewport ?? ""),
    `→ ${viewport}`);

  const theme = await attr('meta[name="theme-color"]');
  check("theme-color meta tag is set", Boolean(theme), `→ ${theme}`);

  const manifestLink = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null);
  check("the page links its manifest", Boolean(manifestLink), `→ ${manifestLink}`);

  await ctx.close();
}

/* ── 6. Basic hygiene ───────────────────────────────────────────────────── */
console.log("\nHygiene");
{
  if (!isLocal) {
    check("served over HTTPS", BASE.startsWith("https://"), `→ ${BASE}`);
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  check("landing page raises no uncaught errors", errors.length === 0, `→ ${errors.slice(0, 2).join(" | ")}`);

  const res = await fetch(`${BASE}/icons/icon-512.png`);
  check("the 512px icon is a real PNG",
    res.ok && (res.headers.get("content-type") ?? "").includes("png"),
    `→ ${res.status}`);

  await ctx.close();
}

await browser.close();

console.log(`\n${pass} passed, ${failures.length} failed, ${warnings.length} warning(s)`);
if (warnings.length) console.log("Warnings:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
if (failures.length) {
  console.log("Failures:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
