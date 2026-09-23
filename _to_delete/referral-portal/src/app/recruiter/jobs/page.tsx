import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listJobs, listReferralsForCompany } from "@/lib/queries";
import { setJobStatus } from "@/app/actions/jobs";
import { EmptyState, PageHeader, CompanyLogo } from "@/components/ui";
import { JOB_STATUS_LABEL, WORK_MODE_LABEL } from "@/lib/constants";
import { timeAgo, salaryLabel } from "@/lib/utils";

export const metadata = { title: "My postings — ReferIn" };
export const dynamic = "force-dynamic";

export default async function RecruiterJobsPage() {
  const user = await requireRole("RECRUITER", "ADMIN");

  if (!user.company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          title="You're not linked to a company."
          body="Recruiter accounts manage one company's postings."
          action={{ href: "/profile", label: "Go to profile" }}
        />
      </div>
    );
  }

  const jobs = listJobs({ companySlug: user.company.slug }, true);
  const refs = listReferralsForCompany(user.company.id);
  const refsByJob = new Map<string, number>();
  for (const r of refs) refsByJob.set(r.jobId, (refsByJob.get(r.jobId) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="My postings"
        subtitle={`${user.company.name} · ${jobs.filter((j) => j.status === "OPEN").length} open`}
      >
        <Link href="/recruiter/company" className="btn-secondary btn-sm">
          Company profile
        </Link>
        <Link href="/recruiter/jobs/new" className="btn-primary btn-sm">
          Post an opening
        </Link>
      </PageHeader>

      {jobs.length === 0 ? (
        <EmptyState
          title="No postings yet."
          body="Post your first opening — employees at your company can then refer candidates straight into it."
          action={{ href: "/recruiter/jobs/new", label: "Post an opening" }}
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center gap-4 p-4">
              <CompanyLogo
                name={j.companyName}
                logoText={j.logoText}
                brandColor={j.brandColor}
                size={36}
              />

              <div className="min-w-48 flex-1">
                <Link
                  href={`/jobs/${j.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {j.title}
                </Link>
                <div className="text-xs text-slate-500">
                  {[
                    j.location,
                    j.workMode && WORK_MODE_LABEL[j.workMode],
                    salaryLabel(j.salaryMin, j.salaryMax, j.currency),
                    `posted ${timeAgo(j.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold text-slate-900">{j.openings}</div>
                <div className="text-xs text-slate-500">openings</div>
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold text-brand-700">
                  {refsByJob.get(j.id) ?? 0}
                </div>
                <div className="text-xs text-slate-500">referrals</div>
              </div>

              <span
                className={
                  j.status === "OPEN"
                    ? "pill bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : j.status === "PAUSED"
                      ? "pill bg-amber-50 text-amber-800 ring-amber-200"
                      : "pill bg-slate-100 text-slate-600 ring-slate-200"
                }
              >
                {JOB_STATUS_LABEL[j.status]}
              </span>

              <div className="flex gap-1.5">
                <Link href={`/recruiter/jobs/${j.id}`} className="btn-secondary btn-sm">
                  Edit
                </Link>
                <form action={setJobStatus}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={j.status === "OPEN" ? "PAUSED" : "OPEN"}
                  />
                  <button className="btn-ghost btn-sm" type="submit">
                    {j.status === "OPEN" ? "Pause" : "Reopen"}
                  </button>
                </form>
                {j.status !== "CLOSED" && (
                  <form action={setJobStatus}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <input type="hidden" name="status" value="CLOSED" />
                    <button className="btn-ghost btn-sm text-rose-600" type="submit">
                      Close
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
