# ReferIn — company referral portal

A job portal built around the thing job boards leave out: **who inside the company can actually refer you, and what happened to your request afterwards.**

Naukri shows you listings. LinkedIn shows you people. This connects the two and then tracks the outcome — every referral moves through a visible pipeline with a timestamped history, so nobody is left wondering.

---

## Run it

```bash
npm install
cp .env.example .env      # then edit SESSION_SECRET
mkdir -p data             # the SQLite file lives here
npm run setup             # creates the database and seeds demo data
npm run dev               # http://localhost:3000
```

`npm run setup` is `db:push` + `db:seed`. To wipe and start over: `npm run db:reset`.

Shipping it as an Android app? See **[PLAYSTORE.md](PLAYSTORE.md)**.

The database is **libSQL**: a local file in development (`DATABASE_URL=file:./data/app.db`),
and Turso in production. See [PLAYSTORE.md](PLAYSTORE.md) §1 for deploying it.

### Demo accounts

Every seeded account uses the password **`password123`**.

| Email | Role | What's interesting about it |
|---|---|---|
| `aisha@example.com` | Job seeker | Referrals at four different stages, including a successful hire |
| `dev@example.com` | Job seeker | One accepted, one rejected downstream |
| `sana@example.com` | Job seeker | One referred, one still pending |
| `karthik@example.com` | Job seeker | Interviewing, accepted, and one polite decline |
| `tara@nimbus.io` | Employee / referrer | **Two requests waiting on her** — best inbox to look at |
| `rohan@nimbus.io` | Employee / referrer | Has an accepted request in flight |
| `imran@kettlehealth.com` | Employee / referrer | Shows how a decline reads |
| `leela@fernpath.design` | Employee / referrer | Made a referral that ended in a hire |
| `arjun@bellweather.dev` | Employee / referrer | Unverified — sits in the admin queue |
| `priya@nimbus.io` | Recruiter | Manages Nimbus postings and pipeline |
| `farah@kettlehealth.com` | Recruiter | Kettle Health |
| `sameer@ardentretail.in` | Recruiter | Ardent Retail |
| `admin@referin.app` | Platform admin | Verification queue and site-wide stats |

Seeded content: 5 companies, 13 postings, 15 users, 9 referrals spread across every pipeline stage.

---

## The four roles

**Job seeker** — browses openings, sees exactly who at that company is open to referring, sends a request with a note, and tracks it. Cannot move their own referral forward; that would defeat the point.

**Employee / referrer** — linked to a company. Appears on that company's job pages when they've opted in (togglable from their profile). Gets an inbox of requests, accepts or declines, and marks a referral as submitted internally.

**Recruiter** — owns a company's postings and profile. Posts, pauses, and closes openings; sees every referral into their company; moves candidates through interview to hired or rejected.

**Platform admin** — verifies companies and employees, changes roles, sees site-wide stats.

---

## The referral pipeline

This is the core of the product. Status lives on the referral; every change writes an immutable `referral_events` row, so the timeline is a real audit trail rather than a derived guess.

```
REQUESTED ──accept──▶ ACCEPTED ──submit──▶ REFERRED ──▶ INTERVIEWING ──▶ HIRED
    │                     │                   │              │
    └──decline──▶ DECLINED └──withdraw──▶     └──────────────┴──▶ REJECTED
```

Who may make each move is enforced server-side in `src/lib/constants.ts` (`TRANSITIONS` and `canTransition`) and checked again in the server action before any write:

| From | To | Who can do it |
|---|---|---|
| `REQUESTED` | `ACCEPTED` / `DECLINED` | The referrer only |
| `ACCEPTED` | `REFERRED` | Referrer or the company's recruiters |
| `ACCEPTED` | `DECLINED` | The referrer (withdraw) |
| `REFERRED` | `INTERVIEWING` / `REJECTED` | Referrer or recruiters |
| `INTERVIEWING` | `HIRED` / `REJECTED` | Referrer or recruiters |

Seekers never get transition controls. Illegal jumps (e.g. `REQUESTED → HIRED`) are rejected server-side even if someone crafts the request by hand — the UI simply never offers them.

Every status change notifies the candidate, and notifies the referrer too when someone else moved it.


---

## The resume builder

A second product folded into this one, because they answer halves of the same
question: a referral needs a resume, and a resume needs somewhere to go.

`/resume` is a full ATS-aware resume editor — three templates, live scoring out
of 100, a writing check that flags weak phrasing and passive voice, job-
description keyword matching, cover letters, and PDF/Word/PNG export. It can
also ingest an existing PDF or Word resume and improve it.

The point of it living here rather than beside here:

- **It knows who you are.** It was a standalone app with its own Supabase
  magic-link sign-in; inside the portal the session already answers that, so
  the sign-in modal, the account chip and the download gating are gone.
- **Resumes persist to your account**, not to a browser tab. A local draft is
  still written on every keystroke, but the document is saved server-side on a
  debounce.
- **A resume attaches to a referral request.** That is the whole integration:
  the employee being asked to put their name on you can read what you sent,
  signed in, rather than following a link to a file-sharing site.

Access is resolved **through the referral**, not through the user
(`src/lib/resume-access.ts`): the owner, the referrer they asked, recruiters at
that company, and admins. Being able to see someone's referral does not grant
access to their other resumes.

### How it was ported

The framework-agnostic half — scoring, the writing checker, the PDF/Word
exporters, the parser — moved across unchanged into `src/lib/resume/`. The
components became client components. Two things needed real work:

- **CSS scoping.** The builder styles bare `body`, `input`, `button` and
  `label` elements, which would have fought Tailwind across the whole app the
  moment its route chunk loaded. `scripts/scope-resume-css.mjs` rewrites every
  selector under a single `.rb` root using PostCSS. `_styles/builder.css` is
  generated — edit `builder.source.css` and re-run it.
- **pdf.js.** The original imported its worker with Vite's `?url` suffix, which
  webpack does not understand. `scripts/copy-pdf-worker.mjs` copies the worker
  into `public/` on install and before every build, so it can never drift out
  of step with the installed `pdfjs-dist` version.

---

## Counting openings and referrers

Two numbers show up everywhere, and both are computed live rather than stored:

- **Openings** — `sum(jobs.openings)` across a company's `OPEN` postings. A single posting can have several seats.
- **Can refer** — count of `company_members` at that company with `open_to_refer = 1`.

Both are correlated subqueries in `src/lib/queries.ts`, so they can never drift from reality.

---

## Stack

- **Next.js 15** (App Router, React 19, Server Components and Server Actions — no separate API layer)
- **Drizzle ORM + libSQL** via `@libsql/client` — a local file in dev, Turso in production
- **Tailwind CSS**
- **jose** for signed session cookies, Node's `scrypt` for password hashing
- **zod** for input validation on every server action

> **A note on the database choice.** The original plan was Prisma, which downloads platform-specific query-engine binaries at install time; that download was blocked in the environment this was built in, so the schema was ported to Drizzle — pure TypeScript, no binary fetch.
>
> It then moved again, from `better-sqlite3` to `@libsql/client`, because `better-sqlite3` is a native module that wants a writable local filesystem and therefore cannot run on Vercel at all. libSQL speaks the same SQL over HTTP, so the schema and every query survived unchanged; the only difference is that the driver is asynchronous, which is why everything in `src/lib/queries.ts` returns a promise.

### Moving to Postgres

Turso covers production, and nothing in the app is SQLite-specific beyond the
driver. If you'd rather have Postgres: swap the driver in `src/db/index.ts` for
`drizzle-orm/node-postgres`, change `dialect` in `drizzle.config.ts` to
`postgresql`, and change the `sqliteTable` imports in `src/db/schema.ts` to
`pgTable`. The queries themselves don't change.

---

## Layout

```
src/
  app/
    actions/          server actions — the only place that writes
      auth.ts           signup, login, profile, referrer availability
      referrals.ts      request a referral, move the pipeline, notes
      jobs.ts           postings, company profile, admin moderation
    page.tsx          landing
    jobs/             board, filters, job detail + referrer picker
    companies/        directory and company profile
    referrals/
      [id]/           the tracking view — pipeline + timeline
      inbox/          referrer's incoming requests
    my-referrals/     seeker's tracker
    recruiter/        postings, pipeline, company profile
    admin/            verification queue, companies, users
    dashboard/        one page, four role-specific views
    resume/           the resume builder (client), its components and styles
    resumes/[id]/     read-only view of a resume attached to a referral
    legal/            privacy, terms
    account/delete/   account deletion — public page and the real thing
    .well-known/      Digital Asset Links, for the Android wrapper
  components/         UI — avatars, pills, pipeline tracker, forms
  db/
    schema.ts         tables, indexes, constraints
    seed.ts           demo data
  lib/
    constants.ts      roles, statuses, and the transition rules
    queries.ts        every read, in one place
    session.ts        cookie session, requireUser / requireRole
    resume/           the builder's framework-agnostic half
    resume-access.ts  who may read a given resume
    legal.ts          operator details, in one place
    env.ts            deployment config

scripts/
  generate-icons.mjs           PWA + Play icons from one SVG mark
  generate-feature-graphic.mjs the 1024x500 store graphic
  capture-store-screenshots.mjs 16 real device-sized screenshots
  scope-resume-css.mjs         rewrites the builder's CSS under .rb
  copy-pdf-worker.mjs          keeps pdf.js's worker in step
  playstore-smoke.mjs          46 readiness checks

store-assets/         everything the Play Console listing needs
```

Reads live in `lib/queries.ts`; writes live in `app/actions/`. Nothing else touches the database.

---

## Tests

`smoke.mjs` drives a real Chromium browser through the whole product — not just page loads, but the actual flows.

```bash
npm run build && npm start        # in one terminal
npx playwright install chromium   # once
node smoke.mjs http://localhost:3000
```

42 assertions covering: public browsing and filters, auth gates, sign-up, requesting a referral, the referrer accepting it, a recruiter moving it interview → hired, the notifications and timeline that result, publishing and pausing a posting, admin verification, and the access-control cases (an unrelated user cannot read someone else's referral; a seeker cannot move their own pipeline; illegal transitions are never offered).

Run it against a freshly seeded database — it creates real records as it goes.

Two more suites sit alongside it:

```bash
node check-integration.mjs http://localhost:3000   # 14 — resume ↔ referral
BASE_URL=http://localhost:3000 \
  node scripts/playstore-smoke.mjs                 # 46 — Play Store readiness
```

`check-integration.mjs` covers building a resume, attaching it to a request,
and the access-control matrix around it — including that an unrelated seeker
and a recruiter at a different company both can't read it.
`scripts/playstore-smoke.mjs` is described in [PLAYSTORE.md](PLAYSTORE.md).

---

## Security notes

Passwords use `scrypt` with a per-user random salt and constant-time comparison. Sessions are HTTP-only signed JWT cookies, `secure` in production. Every server action re-checks identity and authorisation server-side; nothing trusts the client. All input goes through zod.

Two things to change before this faces real users: set a real `SESSION_SECRET`, and replace the "an admin ticks a box" employee-verification step with something automatic — a work-email domain check plus a confirmation link is the usual approach and would fit into `company_members.verified` without a schema change.

---

## Known gaps

Deliberate scope cuts, in rough priority order if you continue:

- **File uploads** — a resume built here attaches natively, but an *externally hosted* one is still just a URL; there is no file storage.
- **Email** — notifications are in-app only.
- **Employee verification** is manual (see above).
- **Search** is `LIKE`-based. Fine at this size; wants a real index later.
- **Multi-company membership** — the schema supports it (`company_members` is a join table), but the UI assumes one company per user.
- **Rate limiting** on referral requests, so nobody can spam every referrer at a company.
