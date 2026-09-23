import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  listReferralsForSeeker,
  listReferralsForReferrer,
  listReferralsForCompany,
  listJobs,
  listReferrers,
  suggestedJobs,
  countByStatus,
  platformStats,
} from "@/lib/queries";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Stat, EmptyState, Alert, CompanyLogo, StatusPill } from "@/components/ui";
import { JobCardItem } from "@/components/JobCardItem";
import { ReferralListItem } from "@/components/ReferralListItem";
import { PIPELINE, STATUS_LABEL, ROLE_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard — ReferIn" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greeting()}, {user.name.split(" ")[0]}.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {ROLE_LABEL[user.role]}
          {user.company ? ` · ${user.company.name}` : ""}
        </p>
      </div>

      {error === "forbidden" && (
        <div className="mb-6">
          <Alert kind="error">
            That page isn&apos;t available for your account type.
          </Alert>
        </div>
      )}

      {user.role === "SEEKER" && <SeekerDash userId={user.id} />}
      {user.role === "EMPLOYEE" && <ReferrerDash user={user} />}
      {user.role === "RECRUITER" && <RecruiterDash user={user} />}
      {user.role === "ADMIN" && <AdminDash />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* -------------------------------------------------------------------------- */

async function SeekerDash({ userId }: { userId: string }) {
  const refs = listReferralsForSeeker(userId);
  const counts = countByStatus(refs);
  const me = db.select().from(users).where(eq(users.id, userId)).get();
  const suggestions = suggestedJobs(me?.skills ?? null, 3);

  const active = refs.filter(
    (r) => !["HIRED", "REJECTED", "DECLINED"].includes(r.status),
  );
  const needsNothing = counts.REQUESTED ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Requests sent" value={refs.length} />
        <Stat label="Awaiting reply" value={needsNothing} accent="text-amber-600" />
        <Stat
          label="Referred in"
          value={(counts.REFERRED ?? 0) + (counts.INTERVIEWING ?? 0) + (counts.HIRED ?? 0)}
          accent="text-brand-700"
        />
        <Stat label="Interviewing" value={counts.INTERVIEWING ?? 0} accent="text-violet-600" />
      </div>

      {/* Funnel ------------------------------------------------------- */}
      {refs.length > 0 && (
        <section className="card p-5">
          <h2 className="section-title">Your funnel</h2>
          <div className="mt-4 space-y-2">
            {PIPELINE.map((s) => {
              const n = counts[s] ?? 0;
              const pct = refs.length ? Math.round((n / refs.length) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-medium text-slate-600">
                    {STATUS_LABEL[s]}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="section-title">In flight</h2>
          <Link href="/my-referrals" className="text-sm font-medium text-brand-700 hover:underline">
            All referrals →
          </Link>
        </div>
        {active.length === 0 ? (
          <EmptyState
            title="Nothing in flight."
            body="Pick an opening and ask someone inside the company to refer you."
            action={{ href: "/jobs", label: "Browse openings" }}
          />
        ) : (
          <div className="grid gap-4">
            {active.slice(0, 4).map((r) => (
              <ReferralListItem key={r.id} r={r} counterpartLabel="Referrer:" />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="section-title">Openings that fit you</h2>
          <Link href="/jobs" className="text-sm font-medium text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid gap-4">
          {suggestions.map((j) => (
            <JobCardItem key={j.id} job={j} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function ReferrerDash({
  user,
}: {
  user: { id: string; company: { id: string; name: string; slug: string; openToRefer: boolean; verified: boolean } | null };
}) {
  const refs = listReferralsForReferrer(user.id);
  const counts = countByStatus(refs);
  const pending = refs.filter((r) => r.status === "REQUESTED");
  const companyJobs = user.company ? listJobs({ companySlug: user.company.slug }) : [];

  return (
    <div className="space-y-8">
      {user.company && !user.company.openToRefer && (
        <Alert kind="info">
          You&apos;re hidden from {user.company.name}&apos;s job pages right now.{" "}
          <Link href="/profile" className="font-medium underline">
            Make yourself available
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Waiting on you"
          value={pending.length}
          accent={pending.length ? "text-amber-600" : undefined}
          sub={pending.length ? "Respond to keep people moving" : "All caught up"}
        />
        <Stat label="Referred" value={counts.REFERRED ?? 0} />
        <Stat label="Interviewing" value={counts.INTERVIEWING ?? 0} accent="text-violet-600" />
        <Stat label="Hired through you" value={counts.HIRED ?? 0} accent="text-emerald-600" />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="section-title">Needs your response</h2>
          <Link href="/referrals/inbox" className="text-sm font-medium text-brand-700 hover:underline">
            Full inbox →
          </Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState
            title="Inbox zero."
            body="Nothing is waiting on you right now."
          />
        ) : (
          <div className="grid gap-4">
            {pending.slice(0, 5).map((r) => (
              <ReferralListItem key={r.id} r={r} counterpartLabel="Candidate:" />
            ))}
          </div>
        )}
      </section>

      {user.company && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="section-title">Openings at {user.company.name}</h2>
            <Link
              href={`/companies/${user.company.slug}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Company page →
            </Link>
          </div>
          {companyJobs.length === 0 ? (
            <EmptyState title="No open roles at your company right now." />
          ) : (
            <div className="grid gap-4">
              {companyJobs.slice(0, 3).map((j) => (
                <JobCardItem key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function RecruiterDash({
  user,
}: {
  user: { id: string; company: { id: string; name: string; slug: string } | null };
}) {
  if (!user.company) {
    return (
      <EmptyState
        title="You're not linked to a company."
        body="Recruiter accounts manage a company's postings. Add yours to get started."
        action={{ href: "/profile", label: "Go to profile" }}
      />
    );
  }

  const jobs = listJobs({ companySlug: user.company.slug }, true);
  const refs = listReferralsForCompany(user.company.id);
  const counts = countByStatus(refs);
  const referrers = listReferrers(user.company.id);
  const openSeats = jobs
    .filter((j) => j.status === "OPEN")
    .reduce((n, j) => n + j.openings, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open roles" value={jobs.filter((j) => j.status === "OPEN").length} />
        <Stat label="Seats to fill" value={openSeats} />
        <Stat label="Referrals in pipeline" value={refs.length} accent="text-brand-700" />
        <Stat label="Employees referring" value={referrers.length} />
      </div>

      <section className="card p-5">
        <h2 className="section-title">Referral pipeline</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PIPELINE.map((s) => (
            <div key={s} className="rounded-lg bg-slate-50 p-3 text-center">
              <div className="text-xl font-semibold text-slate-900">
                {counts[s] ?? 0}
              </div>
              <div className="text-xs text-slate-500">{STATUS_LABEL[s]}</div>
            </div>
          ))}
        </div>
        <Link
          href="/recruiter/referrals"
          className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Open the full pipeline →
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="section-title">Your postings</h2>
          <div className="flex gap-2">
            <Link href="/recruiter/jobs/new" className="btn-primary btn-sm">
              Post an opening
            </Link>
            <Link href="/recruiter/jobs" className="btn-secondary btn-sm">
              Manage
            </Link>
          </div>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            title="No postings yet."
            body="Post your first opening and your employees can start referring into it."
            action={{ href: "/recruiter/jobs/new", label: "Post an opening" }}
          />
        ) : (
          <div className="grid gap-4">
            {jobs.slice(0, 3).map((j) => (
              <JobCardItem key={j.id} job={j} showStatus />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function AdminDash() {
  const s = platformStats();

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={s.users} />
        <Stat label="Companies" value={s.companies} />
        <Stat label="Roles" value={s.jobs} />
        <Stat label="Openings" value={s.openings} />
        <Stat label="Referrals" value={s.referrals} accent="text-brand-700" />
        <Stat label="Hires" value={s.hired} accent="text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">Companies awaiting verification</h2>
          {s.pendingCompanies.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {s.pendingCompanies.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <CompanyLogo
                    name={c.name}
                    logoText={c.logoText}
                    brandColor={c.brandColor}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      added {timeAgo(c.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Open admin panel →
          </Link>
        </section>

        <section className="card p-5">
          <h2 className="section-title">Employees awaiting verification</h2>
          {s.pendingMembers.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {s.pendingMembers.slice(0, 5).map((m) => (
                <li key={m.memberId} className="text-sm">
                  <span className="font-medium text-slate-800">{m.userName}</span>
                  <span className="text-slate-500">
                    {" "}
                    — {m.title ?? "Employee"} at {m.companyName}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin"
            className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Review them →
          </Link>
        </section>
      </div>
    </div>
  );
}
