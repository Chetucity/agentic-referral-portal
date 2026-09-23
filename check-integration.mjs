/**
 * End-to-end check of the resume builder integration.
 *
 * Covers the thing the two products were merged for: a seeker builds a resume
 * in the portal, attaches it to a referral request, and the people that
 * referral involves — and only those people — can read it.
 *
 *   node check-integration.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const PW = "password123";

let pass = 0;
const fail = [];
const check = (n, c, x = "") => {
  if (c) { pass++; console.log("  ✓ " + n); }
  else { fail.push(n); console.log("  ✗ " + n + " " + x); }
};

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

async function signIn(email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  return { ctx, page };
}

console.log("\nResume builder");
const seeker = await signIn("dev@example.com");
check("Resume appears in the seeker's nav", (await seeker.page.locator('a[href="/resume"]').count()) > 0);

await seeker.page.goto(`${BASE}/resume`);
await seeker.page.waitForLoadState("networkidle");
check("profile prefills a new resume", (await seeker.page.locator("#name").inputValue()).length > 0);

await seeker.page.locator("input.resume-title").fill("SRE application");
await seeker.page.locator("textarea").first()
  .fill("Site reliability engineer with six years of platform and on-call experience across large fleets.");
await seeker.page.waitForTimeout(4000);
await seeker.page.reload();
await seeker.page.waitForLoadState("networkidle");
check("resume survived a reload (server-side save)",
  (await seeker.page.locator("input.resume-title").inputValue()) === "SRE application");

console.log("\nAttaching it to a referral");
await seeker.page.goto(`${BASE}/jobs?q=Site%20Reliability`);
await seeker.page.click('a[href^="/jobs/j_"]');
await seeker.page.waitForLoadState("networkidle");
await seeker.page.click('button:has-text("Rohan Desai")');
check("resume picker offered on the request form", (await seeker.page.locator("#resumeId").count()) > 0);

const opts = await seeker.page.locator("#resumeId option").allInnerTexts();
const mine = opts.find((o) => o.includes("SRE application"));
check("the built resume is selectable", Boolean(mine), `→ ${JSON.stringify(opts)}`);
check("the picker shows its ATS score", Boolean(mine && /ATS \d+\/100/.test(mine)), `→ ${mine}`);

await seeker.page.selectOption("#resumeId", { label: mine });
await seeker.page.fill("#message", "Six years of platform and on-call work — resume attached.");
await seeker.page.click('button:has-text("Ask Rohan")');
await seeker.page.waitForURL("**/referrals/**", { timeout: 20000 });
const refUrl = seeker.page.url().split("?")[0];
check("referral created", refUrl.includes("/referrals/"));
check("seeker sees the attached resume", (await seeker.page.locator('a:has-text("Read resume")').count()) > 0);

console.log("\nThe referrer can read it");
const referrer = await signIn("rohan@nimbus.io");
await referrer.page.goto(refUrl);
check("referrer sees a Read resume link", (await referrer.page.locator('a:has-text("Read resume")').count()) > 0);

await referrer.page.click('a:has-text("Read resume")');
await referrer.page.waitForLoadState("networkidle");
const resumeUrl = referrer.page.url();
const docText = await referrer.page.locator("body").innerText();
check("the document renders for the referrer",
  docText.includes("Site reliability engineer with six years"));
check("it explains why they can see it", docText.includes("attached it to a referral"));
await referrer.page.screenshot({ path: "resume-view.png" });

console.log("\nAccess control");
const stranger = await signIn("karthik@example.com");
await stranger.page.goto(resumeUrl);
check("an unrelated seeker cannot read it",
  !(await stranger.page.locator("body").innerText()).includes("Site reliability engineer with six years"),
  `→ ${stranger.page.url()}`);

const recruiter = await signIn("priya@nimbus.io");
await recruiter.page.goto(resumeUrl);
check("the company's recruiter can read it",
  (await recruiter.page.locator("body").innerText()).includes("Site reliability engineer with six years"));

const otherRecruiter = await signIn("farah@kettlehealth.com");
await otherRecruiter.page.goto(resumeUrl);
check("a recruiter at another company cannot",
  !(await otherRecruiter.page.locator("body").innerText()).includes("Site reliability engineer with six years"));

await b.close();
console.log(`\n${pass} passed, ${fail.length} failed`);
if (fail.length) {
  console.log("Failures:\n" + fail.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
