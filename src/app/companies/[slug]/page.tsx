import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug, listJobs, listReferrers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { CompanyLogo, VerifiedBadge, Avatar, EmptyState } from "@/components/ui";
import { JobCardItem } from "@/components/JobCardItem";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const user = await getCurrentUser();
  const jobs = await listJobs({ companySlug: slug });
  const referrers = await listReferrers(company.id);
  const seats = jobs.reduce((n, j) => n + j.openings, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/companies" className="text-sm text-slate-500 hover:text-slate-800">
        ← All companies
      </Link>

      {/* Header ------------------------------------------------------- */}
      <div className="card mt-4 p-6">
        <div className="flex flex-wrap gap-5">
          <CompanyLogo
            name={company.name}
            logoText={company.logoText}
            brandColor={company.brandColor}
            size={72}
          />
          <div className="min-w-56 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {company.name}
              </h1>
              {company.verified ? (
                <VerifiedBadge />
              ) : (
                <span className="pill bg-amber-50 text-amber-800 ring-amber-200">
                  Pending verification
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {[company.industry, company.hqLocation, company.size && `${company.size} employees`]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6 self-start text-center">
            <div>
              <div className="text-2xl font-semibold text-slate-900">{jobs.length}</div>
              <div className="text-xs text-slate-500">open roles</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900">{seats}</div>
              <div className="text-xs text-slate-500">total openings</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-brand-700">{referrers.length}</div>
              <div className="text-xs text-slate-500">can refer</div>
            </div>
          </div>
        </div>

        {company.about && (
          <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-700">
            {company.about}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Openings --------------------------------------------------- */}
        <div>
          <h2 className="section-title mb-4">
            Open roles{" "}
            <span className="font-normal text-slate-400">({jobs.length})</span>
          </h2>
          {jobs.length === 0 ? (
            <EmptyState
              title={`${company.name} isn't hiring right now.`}
              body="Check back later, or look at other companies."
              action={{ href: "/jobs", label: "Browse all openings" }}
            />
          ) : (
            <div className="grid gap-4">
              {jobs.map((j) => (
                <JobCardItem key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>

        {/* Referrers -------------------------------------------------- */}
        <aside>
          <h2 className="section-title mb-4">
            Members who refer{" "}
            <span className="font-normal text-slate-400">({referrers.length})</span>
          </h2>

          {referrers.length === 0 ? (
            <div className="card p-5 text-sm text-slate-500">
              No one from {company.name} has opted in to referring yet.
              {user?.company?.id === company.id && (
                <>
                  {" "}
                  <Link href="/profile" className="font-medium text-brand-700 hover:underline">
                    Turn it on in your profile
                  </Link>
                  .
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {referrers.map((r) => (
                <li key={r.userId} className="card p-4">
                  <div className="flex gap-3">
                    <Avatar name={r.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-slate-900">
                          {r.name}
                        </span>
                        {r.verified && (
                          <span className="text-emerald-600" title="Verified employee">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path
                                fillRule="evenodd"
                                d="M16.4 6.3a1 1 0 010 1.4l-6.5 6.5a1 1 0 01-1.4 0L4.6 10.3a1 1 0 111.4-1.4l2.6 2.6 5.8-5.8a1 1 0 011.4 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-600">
                        {r.title ?? "Employee"}
                        {r.department ? ` · ${r.department}` : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="chip">{r.referralsMade} referred</span>
                        {r.hires > 0 && (
                          <span className="pill bg-emerald-50 text-emerald-700 ring-emerald-200">
                            {r.hires} hired
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {jobs.length > 0 && referrers.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Open a role above to pick a referrer and send a request.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
