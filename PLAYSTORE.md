# Putting ReferIn on the Play Store

The app ships as a **Trusted Web Activity** (TWA): a real Android package whose
whole UI is this website, running full-screen with no browser chrome. There is
no second codebase — you ship the site, the store listing points at it, and an
update to the site *is* an update to the app.

That only works if three things line up:

1. The site is installable as a PWA (manifest, icons, theme, no sideways scroll
   on a phone) — **done**, and `scripts/playstore-smoke.mjs` keeps it that way.
2. The site is actually deployed somewhere public over HTTPS — **needs a
   database**, see §1 below. This app can no longer run off a local file in
   production.
3. The site publicly vouches for the Android package, at
   `/.well-known/assetlinks.json` — **needs the two env vars in §4**, which you
   cannot know until Bubblewrap has generated a signing key.

Until step 3 is done the app still installs and runs, but Android can't verify
it owns the domain, so **it draws a browser URL bar across the top of your
app**. That's the single most common way a TWA looks broken on launch day.

---

## What's already in the repo

| Thing | Where | Note |
|---|---|---|
| Web manifest | `src/app/manifest.ts` | Served at `/manifest.webmanifest`. Bubblewrap reads this to name the app, pick the colours and pull the icons |
| Icons | `public/icons/` | 192/512 `any`, 192/512 `maskable`, 512 `monochrome`, apple-touch, favicon. Regenerate with `npm run icons` |
| Theme + viewport | `src/app/layout.tsx` | `viewport-fit=cover` so safe-area insets work; pinch-zoom deliberately **not** disabled, because Play's accessibility review flags that |
| Digital Asset Links | `src/app/.well-known/assetlinks.json/route.ts` | Driven by env, 404s until configured |
| Privacy policy | `/legal/privacy` | Play requires a public URL, reachable signed-out |
| Terms | `/legal/terms` | |
| Contact | `/contact` | |
| Account deletion | `/account/delete` | Play requires **both** an in-app path (it's on `/profile`) and a public web page. This is the public page, and it really deletes |
| Operator details | `src/lib/legal.ts` | One file feeding every legal page |
| Readiness check | `scripts/playstore-smoke.mjs` | 46 checks. Run it against the deployment before every submission |
| Store listing assets | `store-assets/` | Icon, feature graphic, 16 screenshots, listing copy, and a guide to which Play Console box each goes in |

Run the check against production, not localhost:

```bash
BASE_URL=https://<your-domain> node scripts/playstore-smoke.mjs
```

---

## 1. The blocker: this app needs a real database

The app used to run on `better-sqlite3`, reading a file in `data/`. **That
cannot work on Vercel** — it's a native module that wants a writable local
filesystem, and serverless functions have neither a persistent one nor a shared
one between invocations.

It now runs on **libSQL** (`@libsql/client` + `drizzle-orm/libsql`), which
speaks the same SQL over HTTP. Locally that still points at a file. In
production it points at [Turso](https://turso.tech).

```bash
# once
npm install -g @tursodatabase/cli
turso auth login
turso db create referin
turso db show referin --url          # → libsql://referin-<org>.turso.io
turso db tokens create referin       # → the auth token
```

Then in Vercel → Settings → Environment Variables:

```
DATABASE_URL=libsql://referin-<org>.turso.io
DATABASE_AUTH_TOKEN=<token>
SESSION_SECRET=<a long random string — generate a new one, do not reuse the dev value>
NEXT_PUBLIC_SITE_URL=https://<your-domain>
```

Push the schema to it once:

```bash
DATABASE_URL=libsql://referin-<org>.turso.io \
DATABASE_AUTH_TOKEN=<token> \
  npm run db:push
```

Seeding production is optional and probably a bad idea — the demo accounts all
share one password. If you want a populated demo, seed it and say so on the
listing.

> **Local development is unchanged.** `DATABASE_URL=file:./data/app.db` in
> `.env` keeps working, and so does the older `DATABASE_FILE` name.

---

## 2. Before you start: the other blockers

These are not Play mechanics, they're facts about your business that Play
checks. Nothing below can be finished without them.

- **Check `src/lib/legal.ts`.** The operator name, address, phone and support
  email were carried across from the Personalise project because the same
  person operates both. Confirm they're right for this product — in particular
  whether the support address should be dedicated to ReferIn. Anything left
  starting with `TODO:` renders as an amber "needs filling in" badge on the
  page, and `playstore-smoke.mjs` fails on it.
- **A Google Play developer account** — one-time US$25, and identity
  verification that can take a few days. Start this first; it's the longest
  lead time on the list.
- **A domain, if you want one.** The Vercel URL works, but changing the host
  later means a new assetlinks entry and a rebuilt wrapper, so decide before
  you publish rather than after.

---

## 3. Build the Android package

Bubblewrap is Google's own tool for this. It needs **Node 20+** and the
**Java 17 JDK** — it will offer to download the Android SDK and JDK itself the
first time, which is the easier path.

```bash
npm install -g @bubblewrap/cli
mkdir -p ~/referin-android && cd ~/referin-android

bubblewrap init --manifest https://<your-domain>/manifest.webmanifest
```

It reads the manifest and asks you to confirm each value. The ones that matter:

| Prompt | Answer | Why |
|---|---|---|
| Application ID / package | `com.koshcloud.referin` | **Permanent.** It can never be changed once published, and it must be globally unique |
| Host | `<your-domain>` | Changing it later means a new assetlinks entry |
| Start URL | `/` | |
| Display mode | `standalone` | |
| Status bar colour | `#05060c` | Matches the manifest `theme_color` |
| Signing key | let it generate one | Writes `android.keystore` |

> **Back up `android.keystore` and its passwords somewhere you will still have
> them in three years.** With Play App Signing enabled a lost upload key is
> recoverable by asking Google to reset it, which takes days. Without it,
> losing the key means you can never update the app again — you'd have to
> publish a new listing and every install would be orphaned.

Then:

```bash
bubblewrap build
```

You get `app-release-bundle.aab` (upload this to Play) and
`app-release-signed.apk` (sideload this to test on your own phone).

---

## 4. Wire up Digital Asset Links

You now need **two** SHA-256 fingerprints, and getting this wrong is the
classic failure: it works perfectly on your own phone and shows a URL bar for
everyone who installs from the store.

**Your upload key** — what `bubblewrap build` signed with:

```bash
keytool -list -v -keystore android.keystore -alias android | grep SHA256
```

**Google's Play App Signing key** — Play re-signs your upload with its own key
before distributing, so the app users install is signed by a key you have never
held. After your first upload, find it in
**Play Console → your app → Test and release → Setup → App signing**, under
"App signing key certificate".

Set both in Vercel → Settings → Environment Variables, comma-separated, then
redeploy:

```
ANDROID_PACKAGE_NAME=com.koshcloud.referin
ANDROID_SHA256_FINGERPRINTS=AA:BB:...:ZZ,11:22:...:99
```

Verify it's live:

```bash
curl https://<your-domain>/.well-known/assetlinks.json
```

One statement, both fingerprints, `"namespace": "android_app"`. Before those
vars are set the route returns **404 by design** — a 200 with empty fields
would be worse, because Android reports both cases as "no matching statement"
and only one of them tells you why. `playstore-smoke.mjs` warns when only one
fingerprint is listed.

Then install the APK on a real phone and open it. **No URL bar across the top**
is the whole test. If there is one, the fingerprint doesn't match — re-check
which key signed the build you installed.

---

## 5. The Play Console listing

Everything you need is in `store-assets/`:

- `WHERE-EACH-FILE-GOES.txt` — which Play Console box each file belongs in
- `store-listing-copy.txt` — app name, descriptions, category, tags, contact
  details, the Data safety answers, and the content-rating answers
- `app-icon-512.png`, `feature-graphic-1024x500.png`
- `phone-screenshots/` (8 × 1080×1920), `tablet-screenshots/` (8 × 1440×2560)

Beyond those, the things that get submissions rejected:

- **Privacy policy URL** — `https://<your-domain>/legal/privacy`. Must load
  signed-out. It does; the check verifies it.
- **Account deletion URL** — `https://<your-domain>/account/delete`. Required
  for any app that lets people create an account, and a reviewer will follow it
  and try it. It genuinely deletes.
- **Data safety form** — must agree with what the privacy policy says. The
  answers are written out in `store-listing-copy.txt`.
- **Target audience** — 18+, unless you specifically want minors, because the
  Families policy requirements are substantial.
- **Target API level** — Bubblewrap sets this from the version it generated
  with. Google raises the floor for new submissions roughly every August, so
  before you submit run `bubblewrap update` in the project folder and rebuild.
  Check the current floor at
  <https://support.google.com/googleplay/android-developer/answer/11926878>.

Submit to **internal testing** first, not production. Internal testing installs
in minutes with no review, which is how you find the URL-bar problem before a
reviewer does.

---

## 6. Shipping updates

Two different things now update independently:

- **Content and features** — deploy the site. Every installed app picks it up
  on next launch. No store review, no version bump. This is the whole point of
  a TWA.
- **The wrapper** — only needed when the package name, host, icons, splash
  colours or target API level change:

  ```bash
  bubblewrap update    # pulls the current manifest + bumps the wrapper
  bubblewrap build
  ```

  then upload the new `.aab` and increment the version in `twa-manifest.json`.

If you change the manifest's `name`, icons or `theme_color` in
`src/app/manifest.ts`, the *installed app* keeps the old ones until you rebuild
the wrapper — only the web content updates on its own.

---

## 7. What the readiness check covers

`scripts/playstore-smoke.mjs` drives a real browser and asserts 46 things:

- the manifest exists, is well formed, and every icon it names actually loads
- assetlinks is either correctly published or honestly absent — and warns if
  only one fingerprint is listed
- `/legal/privacy`, `/legal/terms`, `/account/delete` and `/contact` all load
  **signed out**, and are the pages they claim to be
- the deletion page says what is deleted and what is retained
- no legal placeholder is left unfilled
- nothing scrolls sideways at 412 × 915 — including three job detail pages,
  which is where overflow actually showed up during development
- pinch-zoom is not disabled and `viewport-fit=cover` is set
- the landing page raises no uncaught errors

It is not a substitute for installing the APK on a real phone, which is the
only way to see the URL bar.
