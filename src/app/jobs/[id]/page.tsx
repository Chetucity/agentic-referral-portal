import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJob,
  listReferrers,
  existingReferralsForJob,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { listResumeOptions } from "@/lib/resume-access";
import { CompanyLogo, VerifiedBadge, StatusPill, Alert } from "@/components/ui";
import { ReferrerPicker } from "@/components/ReferrerPicker";
import {
  WORK_MODE_LABEL,
  EMPLOYMENT_LABEL,
  JOB_STATUS_LABEL,
} from "@/lib/constants";
import { salaryLabel, expLabel, splitList, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getJob(id);
  if (!row) notFound();

  const { job, company } = row;
  const user = await getCurrentUser();
  const referrers = await listReferrers(company.id);
  const existing = user ? await existingReferralsForJob(job.id, user.id) : [];

  // Resumes the viewer can attach to a request. Only seekers ever see the
  // picker, so there is no point loading these for anyone else.
  const myResumes =
    user && user.role === "SEEKER" ? await listResumeOptions(user.id) : [];
  const existingByReferrer = new Map(existing.map((e) => [e.referrerId, e]));

  const salary = salaryLabel(job.salaryMin, job.salaryMax, job.currency);
  const exp = expLabel(job.experienceMin, job.experienceMax);
  const skills = splitList(job.skills);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/jobs" className="text-sm text-slate-500 hover:text-slate-800">
        ← All openings
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main -------------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <div className="card p-6">
            <div className="flex gap-4">
              <CompanyLogo
                name={company.name}
                logoText={company.logoText}
                brandColor={company.brandColor}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900">
                  {job.title}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <Link
                    href={`/companies/${company.slug}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {company.name}
                  </Link>
                  {company.verified && <VerifiedBadge />}
                  {job.status !== "OPEN" && (
                    <span className="chip">{JOB_STATUS_LABEL[job.status]}</span>
                  )}
                </div>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
              {[
                ["Openings", String(job.openings)],
                ["Location", job.location ?? "—"],
                ["Work mode", job.workMode ? WORK_MODE_LABEL[job.workMode] : "—"],
                ["Type", job.employment ? EMPLOYMENT_LABEL[job.employment] : "—"],
                ["Experience", exp ?? "—"],
                ["Compensation", salary ?? "Not disclosed"],
                ["Team", job.department ?? "—"],
                ["Posted", timeAgo(job.createdAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {k}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>

            {skills.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Skills
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="section-title">About the role</h2>
            <div className="prose prose-slate mt-3 max-w-none text-sm leading-relaxed text-slate-700">
              {job.description.split("\n").map((line, i) =>
                line.trim() === "" ? (
                  <br key={i} />
                ) : line.trim().startsWith("- ") ? (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{line.replace(/^\s*-\s*/, "")}</span>
                  </div>
                ) : (
                  <p key={i} className="mb-2">{line}</p>
                ),
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="section-title">About {company.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {company.about ?? "No description yet."}
            </p>
            <Link
              href={`/companies/${company.slug}`}
              className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              View company profile →
            </Link>
          </div>
        </div>

        {/* Referral sidebar -------------------------------------------- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Who can refer you
              </h2>
              <span className="text-sm font-semibold text-brand-700">
                {referrers.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              People at {company.name} who said yes to referring. Pick one and
              tell them why you fit.
            </p>

            <div className="mt-4">
              {!user ? (
                <div className="space-y-3">
                  <Alert kind="info">
                    Sign in as a job seeker to see who can refer you and send a
                    request.
                  </Alert>
                  <div className="flex gap-2">
                    <Link href="/login" className="btn-secondary btn-sm flex-1">Sign in</Link>
                    <Link href="/signup" className="btn-primary btn-sm flex-1">Sign up</Link>
                  </div>
                </div>
              ) : user.role !== "SEEKER" ? (
                <Alert kind="info">
                  You&apos;re signed in as a{" "}
                  {user.role === "EMPLOYEE"
                    ? "referrer"
                    : user.role.toLowerCase()}{" "}
                  account. Referral requests come from job seeker accounts.
                </Alert>
              ) : referrers.length === 0 ? (
                <Alert kind="info">
                  Nobody at {company.name} is open to referring yet. You can still
                  keep an eye on this role.
                </Alert>
              ) : job.status !== "OPEN" ? (
                <Alert kind="info">
                  This opening is {JOB_STATUS_LABEL[job.status].toLowerCase()} —
                  it isn&apos;t taking referrals right now.
                </Alert>
              ) : (
                <ReferrerPicker
                  resumes={myResumes}
                  jobId={job.id}
                  jobTitle={job.title}
                  companyName={company.name}
                  referrers={referrers.map((r) => ({
                    userId: r.userId,
                    name: r.name,
                    title: r.title,
                    department: r.department,
                    yearsAtCo: r.yearsAtCo,
                    verified: r.verified,
                    referralsMade: r.referralsMade,
                    hires: r.hires,
                    existingStatus:
                      existingByReferrer.get(r.userId)?.status ?? null,
                    existingId: existingByReferrer.get(r.userId)?.id ?? null,
                  }))}
                />
              )}
            </div>
          </div>

          {existing.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Your requests for this role
              </h3>
              <ul className="mt-3 space-y-2">
                {existing.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/referrals/${e.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="text-slate-700">Track request</span>
                      <StatusPill status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
