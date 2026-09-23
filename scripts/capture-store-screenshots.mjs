/**
 * Captures the Play Store listing screenshots from the running app.
 *
 *   BASE_URL=http://localhost:3300 node scripts/capture-store-screenshots.mjs
 *
 * These are real captures at real device sizes, not a phone shot stretched to
 * tablet dimensions — the layout genuinely reflows, and a reviewer (and anyone
 * reading the listing) can tell the difference.
 *
 * Phone   1080 × 1920  (360 css px @ 3x)
 * Tablet  1440 × 2560  (720 css px @ 2x)
 *
 * Both satisfy Play's rules: phone screenshots want a 9:16-ish ratio with
 * sides between 320 and 3,840 px; the same tablet files satisfy both the
 * 7-inch and the 10-inch boxes.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3300").replace(/\/+$/, "");
const EXEC = process.env.CHROMIUM_PATH || undefined;
const OUT = process.env.OUT_DIR ?? "store-assets";
const PW = "password123";

const DEVICES = {
  phone: { dir: "phone-screenshots", viewport: { width: 360, height: 640 }, dsf: 3 },
  tablet: { dir: "tablet-screenshots", viewport: { width: 720, height: 1280 }, dsf: 2 },
};

/**
 * The eight shots, in the order they are uploaded. They are meant to read as
 * a story: the problem, the thing nobody else shows you, the request, the
 * tracking, then the other two sides of the product.
 */
const SHOTS = [
  { file: "01-home", as: null, path: "/", note: "See the opening. See who can refer you." },
  { file: "02-openings", as: null, path: "/jobs", note: "Every opening, with how many can refer" },
  { file: "03-referrers", as: "aisha@example.com", path: null, note: "Who can refer you — actual people" },
  { file: "04-tracking", as: "aisha@example.com", path: null, note: "The pipeline, timestamped" },
  { file: "05-my-referrals", as: "aisha@example.com", path: "/my-referrals", note: "Every request in one place" },
  { file: "06-resume", as: "aisha@example.com", path: "/resume", note: "Build a resume, attach it" },
  { file: "07-inbox", as: "tara@nimbus.io", path: "/referrals/inbox", note: "Referrers get a real inbox" },
  { file: "08-recruiter", as: "priya@nimbus.io", path: "/recruiter/referrals", note: "Recruiters see one pipeline" },
];

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });

async function contextFor(kind, email) {
  const d = DEVICES[kind];
  const ctx = await browser.newContext({
    viewport: d.viewport,
    deviceScaleFactor: d.dsf,
    isMobile: kind === "phone",
    hasTouch: true,
  });
  const page = await ctx.newPage();
  if (email) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", PW);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL("**/dashboard", { timeout: 25000 });
  }
  return { ctx, page };
}

/** Finds a good job detail page and, from it, a referral to show. */
async function navigateSpecial(page, file) {
  if (file === "03-referrers") {
    // Read the href and navigate to it rather than clicking: job cards nest
    // a company link inside the card, and on a narrow viewport the click can
    // land on that instead, quietly taking the shot on the wrong page.
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });

    // Pick the opening with the most people open to referring, so the shot
    // shows a list rather than a single name. Each card prints "N can refer".
    const href = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('a[href^="/jobs/j_"]')];
      let best = null;
      let bestN = -1;
      for (const c of cards) {
        const m = (c.textContent ?? "").match(/(\d+)\s+can refer/i);
        const n = m ? Number(m[1]) : 0;
        if (n > bestN) { bestN = n; best = c.getAttribute("href"); }
      }
      return best;
    });
    await page.goto(BASE + href, { waitUntil: "networkidle" });
    // Scroll the "Who can refer you" block to the top — that block is the
    // whole reason this product exists, so it is the shot worth taking.
    // Playwright's own scrolling is used rather than injected JS: it waits for
    // the element and reports honestly when it is not there.
    const heading = page.getByRole("heading", { name: /who can refer you/i });
    if (await heading.count()) {
      await heading.first().scrollIntoViewIfNeeded();
      // scrollIntoViewIfNeeded will scroll sideways as well as down if it
      // thinks that helps, which silently produces a shot of a page shoved
      // off its left edge. Put the horizontal scroll back.
      await page.evaluate(() => window.scrollTo({ left: 0 }));
      await page.waitForTimeout(150);
    } else {
      console.warn("    (no 'Who can refer you' heading found — is anyone open to refer?)");
    }
    await page.waitForTimeout(500);
    return true;
  }
  if (file === "04-tracking") {
    await page.goto(`${BASE}/my-referrals`, { waitUntil: "networkidle" });
    const link = page.locator('a[href^="/referrals/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState("networkidle");
    }
    return true;
  }
  return false;
}

for (const kind of Object.keys(DEVICES)) {
  const dir = join(OUT, DEVICES[kind].dir);
  mkdirSync(dir, { recursive: true });
  console.log(`\n${kind} → ${dir}`);

  for (const shot of SHOTS) {
    const { ctx, page } = await contextFor(kind, shot.as);
    try {
      const special = await navigateSpecial(page, shot.file);
      if (!special && shot.path) {
        await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
      }
      // Let fonts settle so text is not captured mid-swap.
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(dir, `${shot.file}.png`) });
      console.log(`  ${shot.file}.png — ${shot.note}`);
    } catch (err) {
      console.warn(`  ! ${shot.file} failed: ${err.message}`);
    } finally {
      await ctx.close();
    }
  }
}

await browser.close();
console.log("\ndone");
