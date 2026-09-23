import { env } from "@/lib/env";

/**
 * Digital Asset Links — the handshake that makes the Play Store build a
 * Trusted Web Activity rather than a Chrome tab with a URL bar stuck to the
 * top of it.
 *
 * Android fetches `https://<domain>/.well-known/assetlinks.json` when the app
 * launches and hides the browser chrome only if the signing certificate of the
 * installed package appears in this list. Get it wrong and the app still
 * works — it just looks like a browser, which is both the most common way a
 * TWA looks broken on launch day and a thing Play review will flag.
 *
 * Served from a route rather than a static file in `public/` on purpose: the
 * fingerprint is not known until Bubblewrap has generated a signing key, and
 * it differs between a local build and Play App Signing. Both go into
 * `ANDROID_SHA256_FINGERPRINTS` as a comma-separated list — the file is
 * allowed to name several certificates, and it has to during a key rotation.
 *
 * Verify after deploying:
 *   curl https://<domain>/.well-known/assetlinks.json
 *   https://developers.google.com/digital-asset-links/tools/generator
 */

// Nothing here depends on the request, and Android caches it hard anyway.
// Changing the env vars requires a redeploy, same as any other config.
export const dynamic = "force-static";

export function GET() {
  const { packageName, sha256Fingerprints } = env.android;

  // Before the Android package exists, answer honestly rather than serving a
  // statement with empty fields. A malformed assetlinks.json is harder to
  // debug than a missing one, because the verifier reports both as "no
  // matching statement" and only one of them tells you why.
  if (!packageName || sha256Fingerprints.length === 0) {
    return Response.json(
      {
        error: "not_configured",
        detail:
          "Set ANDROID_PACKAGE_NAME and ANDROID_SHA256_FINGERPRINTS to publish a Digital Asset Links statement. See PLAYSTORE.md.",
      },
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  const statements = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: sha256Fingerprints,
      },
    },
  ];

  return Response.json(statements, {
    headers: {
      // Android insists on this exact type. `Response.json` already sets it;
      // being explicit here documents the requirement.
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
