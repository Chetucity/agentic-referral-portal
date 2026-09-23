# ReferIn — company referral portal

A job portal built around the thing job boards leave out: **who inside the company can actually refer you, and what happened to your request afterwards.**

Naukri shows you listings. LinkedIn shows you people. This connects the two and then tracks the outcome — every referral moves through a visible pipeline with a timestamped history, so nobody is left wondering.

---

## Run it

```bash
npm install
cp .env.example .env      # then edit SESSION_SECRET
npm run setup             # creates the SQLite DB and seeds demo data
npm run dev               # http://localhost:3000
```

`npm run setup` is `db:push` + `db:seed`. To wipe and start over: `npm run db:reset`.

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

## Counting openings and referrers

Two numbers show up everywhere, and both are computed live rather than stored:

- **Openings** — `sum(jobs.openings)` across a company's `OPEN` postings. A single posting can have several seats.
- **Can refer** — count of `company_members` at that company with `open_to_refer = 1`.

Both are correlated subqueries in `src/lib/queries.ts`, so they can never drift from reality.

---

## Stack

- **Next.js 15** (App Router, React 19, Server Components and Server Actions — no separate API layer)
- **Drizzle ORM + SQLite** via `better-sqlite3`
- **Tailwind CSS**
- **jose** for signed session cookies, Node's `scrypt` for password hashing
- **zod** for input validation on every server action

> **A note on the database choice.** The original plan was Prisma. Prisma downloads platform-specific query-engine binaries at install time, and that download was blocked in the environment this was built in, so the schema was ported to Drizzle — which is pure TypeScript with no binary fetch. The result is equivalent and arguably lighter: same tables, same indexes, same constraints, and `drizzle-kit push` plays the role `prisma db push` would have. If you'd rather have Prisma, the schema in `src/db/schema.ts` maps across almost line for line.

### Moving to Postgres

SQLite is the local default. For production, swap the driver in `src/db/index.ts` for `drizzle-orm/node-postgres`, change `dialect` in `drizzle.config.ts` to `postgresql`, and change the `sqliteTable` imports in `src/db/schema.ts` to `pgTable`. The queries themselves don't change.

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
  components/         UI — avatars, pills, pipeline tracker, forms
  db/
    schema.ts         tables, indexes, constraints
    seed.ts           demo data
  lib/
    constants.ts      roles, statuses, and the transition rules
    queries.ts        every read, in one place
    session.ts        cookie session, requireUser / requireRole
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

---

## Security notes

Passwords use `scrypt` with a per-user random salt and constant-time comparison. Sessions are HTTP-only signed JWT cookies, `secure` in production. Every server action re-checks identity and authorisation server-side; nothing trusts the client. All input goes through zod.

Two things to change before this faces real users: set a real `SESSION_SECRET`, and replace the "an admin ticks a box" employee-verification step with something automatic — a work-email domain check plus a confirmation link is the usual approach and would fit into `company_members.verified` without a schema change.

---

## Known gaps

Deliberate scope cuts, in rough priority order if you continue:

- **File uploads** — resumes are URLs, not uploaded files.
- **Email** — notifications are in-app only.
- **Employee verification** is manual (see above).
- **Search** is `LIKE`-based. Fine at this size; wants a real index later.
- **Multi-company membership** — the schema supports it (`company_members` is a join table), but the UI assumes one company per user.
- **Rate limiting** on referral requests, so nobody can spam every referrer at a company.
