/**
 * End-to-end smoke test — drives a real browser through the whole product.
 *
 *   npx playwright install chromium   (once, if not already present)
 *   node smoke.mjs [baseUrl]
 *
 * Covers: public browsing, auth gates, sign-up, requesting a referral,
 * a referrer accepting it, the recruiter moving it down the pipeline,
 * admin verification, and access control between unrelated users.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const PW = "password123";

let pass = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

let browser;

/** A fresh browser context signed in as `email`. */
async function signIn(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  return { ctx, page };
}

async function main() {
  browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });

  /* --- public browsing -------------------------------------------------- */
  console.log("\nPublic browsing");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(BASE);
    check("landing page renders", await page.locator("h1").first().isVisible());
    check(
      "landing shows an openings CTA",
      /Browse \d+ openings/.test(await page.locator("body").innerText()),
    );

    await page.goto(`${BASE}/jobs`);
    const jobCards = await page.locator('a[href^="/jobs/j_"]').count();
    check("jobs list shows seeded openings", jobCards >= 10, `→ ${jobCards}`);

    // Filter narrows results.
    await page.selectOption("#workMode", "REMOTE");
    await page.click('button:has-text("Apply filters")');
    await page.waitForLoadState("networkidle");
    const remoteCount = await page.locator('a[href^="/jobs/j_"]').count();
    check(
      "work-mode filter narrows the list",
      remoteCount > 0 && remoteCount < jobCards,
      `→ ${remoteCount} of ${jobCards}`,
    );

    // Search finds a specific role.
    await page.goto(`${BASE}/jobs?q=Kotlin`);
    const body = await page.locator("body").innerText();
    check("skill search finds the Android role", body.includes("Android Engineer"));

    await page.goto(`${BASE}/companies/nimbus-labs`);
    const co = await page.locator("body").innerText();
    check("company page shows opening totals", co.includes("total openings"));
    check("company page lists real referrers", co.includes("Rohan Desai"));

    await ctx.close();
  }

  /* --- auth gates -------------------------------------------------------- */
  console.log("\nAuth gates (anonymous)");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const p of ["/dashboard", "/my-referrals", "/referrals/inbox", "/admin"]) {
      await page.goto(BASE + p);
      check(`${p} → /login`, page.url().includes("/login"), `→ ${page.url()}`);
    }
    await ctx.close();
  }

  /* --- bad password ------------------------------------------------------ */
  console.log("\nNegative cases");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#email", "aisha@example.com");
    await page.fill("#password", "nope");
    await page.click('button:has-text("Sign in")');
    await page.waitForTimeout(1200);
    check(
      "wrong password is rejected",
      page.url().includes("/login") &&
        (await page.locator("body").innerText()).includes("incorrect"),
    );
    await ctx.close();
  }

  /* --- sign-up ----------------------------------------------------------- */
  console.log("\nSign-up");
  const newEmail = `tester${Date.now()}@example.com`;
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/signup`);
    await page.fill("#name", "Test Seeker");
    await page.fill("#email", newEmail);
    await page.fill("#password", "password123");
    await page.fill("#skills", "React, TypeScript");
    await page.click('button:has-text("Create account")');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    check("new seeker lands on the dashboard", page.url().includes("/dashboard"));
    check(
      "dashboard greets the new user",
      (await page.locator("body").innerText()).includes("Test"),
    );
    await ctx.close();
  }

  /* --- full referral lifecycle ------------------------------------------- */
  console.log("\nReferral lifecycle: request → accept → referred → interviewing → hired");

  // 1. A seeker requests a referral for a role they have not asked about.
  const seeker = await signIn("dev@example.com");
  await seeker.page.goto(`${BASE}/jobs?q=Site%20Reliability`);
  await seeker.page.click('a[href^="/jobs/j_"]');
  await seeker.page.waitForLoadState("networkidle");
  check(
    "job page offers a referrer picker",
    (await seeker.page.locator("body").innerText()).includes("Who can refer you"),
  );

  // Pick a specific referrer rather than whoever happens to be first.
  await seeker.page.click('button:has-text("Rohan Desai")');
  await seeker.page.fill("#message", "Smoke test: 6 years of platform and on-call work.");
  await seeker.page.click('button:has-text("Ask Rohan")');
  await seeker.page.waitForURL("**/referrals/**", { timeout: 15000 });
  const referralUrl = seeker.page.url().split("?")[0];
  const detailText = await seeker.page.locator("body").innerText();
  check("request created and tracked", referralUrl.includes("/referrals/"));
  check("confirmation shown", detailText.includes("Request sent"));
  check("status starts at Requested", detailText.includes("Requested"));
  check("timeline has the first entry", detailText.includes("Referral requested"));

  // Seeker has no controls to move it themselves.
  check(
    "seeker cannot move the pipeline",
    !(await seeker.page.locator('button:has-text("Accept request")').count()),
  );

  // 2. An unrelated seeker cannot read it.
  const stranger = await signIn("karthik@example.com");
  await stranger.page.goto(referralUrl);
  check(
    "unrelated user is blocked from the referral",
    stranger.page.url().includes("forbidden") ||
      !(await stranger.page.locator("body").innerText()).includes("Timeline"),
    `→ ${stranger.page.url()}`,
  );
  await stranger.ctx.close();

  // 3. The referrer sees it in their inbox and accepts.
  const referrer = await signIn("rohan@nimbus.io");
  await referrer.page.goto(`${BASE}/referrals/inbox`);
  const inboxText = await referrer.page.locator("body").innerText();
  check("request appears in the referrer's inbox", inboxText.includes("Dev Patel"));

  await referrer.page.goto(referralUrl);
  await referrer.page.click('button:has-text("Accept request")');
  await referrer.page.fill("#note", "Smoke test: accepting, submitting internally.");
  await referrer.page.click('form button:has-text("Accept request")');
  await referrer.page.waitForTimeout(1500);
  check(
    "referrer accepted",
    (await referrer.page.locator("body").innerText()).includes("Accepted"),
  );

  // 4. Referrer marks it as referred.
  await referrer.page.reload();
  await referrer.page.click('button:has-text("Mark as referred")');
  await referrer.page.click('form button:has-text("Mark as referred")');
  await referrer.page.waitForTimeout(1500);
  check(
    "moved to Referred",
    (await referrer.page.locator("body").innerText()).includes("Referred"),
  );

  // An illegal jump is not offered to the referrer.
  await referrer.page.reload();
  check(
    "no illegal jump straight to Hired",
    !(await referrer.page.locator('button:has-text("Hired")').count()),
  );

  // 5. The company's recruiter moves it through interview to hired.
  const recruiter = await signIn("priya@nimbus.io");
  await recruiter.page.goto(`${BASE}/recruiter/referrals`);
  check(
    "referral shows in the recruiter pipeline",
    (await recruiter.page.locator("body").innerText()).includes("Dev Patel"),
  );

  await recruiter.page.goto(referralUrl);
  await recruiter.page.click('button:has-text("Moved to interview")');
  await recruiter.page.click('form button:has-text("Moved to interview")');
  await recruiter.page.waitForTimeout(1500);
  check(
    "recruiter moved it to Interviewing",
    (await recruiter.page.locator("body").innerText()).includes("Interviewing"),
  );

  await recruiter.page.reload();
  await recruiter.page.click('button:has-text("Hired")');
  await recruiter.page.click('form button:has-text("Hired")');
  await recruiter.page.waitForTimeout(1500);
  const finalText = await recruiter.page.locator("body").innerText();
  check("recruiter marked it Hired", finalText.includes("Hired"));
  check(
    "terminal state offers no further moves",
    finalText.includes("final state") ||
      !(await recruiter.page.locator('button:has-text("Not selected")').count()),
  );

  // 6. The seeker sees the whole history and the notifications.
  await seeker.page.goto(referralUrl);
  const seekerFinal = await seeker.page.locator("body").innerText();
  check("seeker sees the final status", seekerFinal.includes("Hired"));
  check(
    "timeline recorded every step",
    ["Requested", "Accepted", "Referred", "Interviewing"].every((s) =>
      seekerFinal.includes(s),
    ),
  );
  check(
    "referrer's note is visible to the candidate",
    seekerFinal.includes("submitting internally"),
  );

  await seeker.page.goto(`${BASE}/notifications`);
  check(
    "seeker was notified of the status changes",
    (await seeker.page.locator("body").innerText()).includes("Hired"),
  );

  await seeker.page.goto(`${BASE}/my-referrals`);
  check(
    "my-referrals reflects the hire",
    (await seeker.page.locator("body").innerText()).includes("Hired"),
  );

  /* --- recruiter posting a job -------------------------------------------- */
  console.log("\nRecruiter posts an opening");
  await recruiter.page.goto(`${BASE}/recruiter/jobs/new`);
  await recruiter.page.fill("#title", "Smoke Test Engineer");
  await recruiter.page.fill("#location", "Bengaluru, India");
  await recruiter.page.fill("#openings", "4");
  await recruiter.page.fill(
    "#description",
    "A role created by the smoke test to verify that posting works end to end.",
  );
  await recruiter.page.click('button:has-text("Publish opening")');
  await recruiter.page.waitForURL(/^https?:\/\/[^/]+\/jobs\/[a-z0-9_]+$/, {
    timeout: 15000,
  });
  await recruiter.page.waitForLoadState("networkidle");
  const postedText = await recruiter.page.locator("body").innerText();
  check("new posting is live", postedText.includes("Smoke Test Engineer"));
  const openingsValue = await recruiter.page
    .locator("dt", { hasText: "Openings" })
    .locator("xpath=following-sibling::dd[1]")
    .first()
    .innerText();
  check(
    "openings count saved",
    openingsValue.trim() === "4",
    `→ got "${openingsValue.trim()}"`,
  );

  // It shows up on the public board.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/jobs?q=Smoke%20Test`);
    check(
      "new posting appears on the public board",
      (await page.locator("body").innerText()).includes("Smoke Test Engineer"),
    );
    await ctx.close();
  }

  // Pause it, and confirm it drops off the public board.
  await recruiter.page.goto(`${BASE}/recruiter/jobs`);
  const row = recruiter.page
    .locator("div.flex.flex-wrap.items-center")
    .filter({ has: recruiter.page.getByText("Smoke Test Engineer", { exact: true }) })
    .first();
  await row.locator('button:has-text("Pause")').click();
  await recruiter.page.waitForTimeout(1500);
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/jobs?q=Smoke%20Test`);
    check(
      "paused posting is hidden from the public board",
      !(await page.locator("body").innerText()).includes("Smoke Test Engineer"),
    );
    await ctx.close();
  }

  /* --- admin -------------------------------------------------------------- */
  console.log("\nAdmin");
  const admin = await signIn("admin@referin.app");
  await admin.page.goto(`${BASE}/admin`);
  const adminText = await admin.page.locator("body").innerText();
  check("admin panel loads", adminText.includes("Companies"));
  check("unverified company is queued", adminText.includes("Bellweather"));
  check("employee verification queue is shown", adminText.includes("Arjun Bhat"));

  // Verify Bellweather and confirm it shows as verified afterwards.
  const bwRow = admin.page
    .locator("div.flex.flex-wrap.items-center")
    .filter({ has: admin.page.getByRole("link", { name: "Bellweather Analytics" }) })
    .first();
  await bwRow.locator('button:has-text("Verify")').click();
  await admin.page.waitForTimeout(1500);
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/companies/bellweather-analytics`);
    const t = await page.locator("body").innerText();
    check(
      "verification is reflected publicly",
      t.includes("Verified") && !t.includes("Pending verification"),
    );
    await ctx.close();
  }

  await seeker.ctx.close();
  await referrer.ctx.close();
  await recruiter.ctx.close();
  await admin.ctx.close();
  await browser.close();

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failures:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nSmoke test crashed:", e.message);
  if (browser) await browser.close();
  process.exit(1);
});
