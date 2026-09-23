import "server-only";

/**
 * Environment configuration, read once and in one place.
 *
 * Everything here is optional at build time on purpose. The app has to build
 * and run on a fresh clone with no `.env` — a contributor should be able to
 * `npm run setup && npm run dev` and get a working site — so nothing throws
 * here. The two things that genuinely cannot be defaulted (the session secret,
 * and the Android fingerprints) fail loudly at the point of use instead:
 * `lib/session.ts` refuses to sign a cookie without a secret, and the
 * assetlinks route returns 404 rather than publishing an empty statement.
 */

/** Public origin of the deployment, with no trailing slash. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");

export const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "ReferIn";

export const android = {
  /**
   * The Android package this site vouches for. Permanent once published —
   * see PLAYSTORE.md.
   */
  packageName: process.env.ANDROID_PACKAGE_NAME?.trim() || "",

  /**
   * SHA-256 certificate fingerprints, comma-separated.
   *
   * There are normally **two**: the upload key Bubblewrap generated, and the
   * key Google re-signs with under Play App Signing. Listing only the first is
   * the single most common reason a published TWA shows a browser URL bar —
   * the app users install is signed by a key the developer has never held.
   */
  sha256Fingerprints: (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
};

/** True once the site can publish a Digital Asset Links statement. */
export const androidLinked =
  Boolean(android.packageName) && android.sha256Fingerprints.length > 0;

export const env = { siteUrl, appName, android, androidLinked };
