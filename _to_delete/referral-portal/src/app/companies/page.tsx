import Link from "next/link";
import { listCompanies } from "@/lib/queries";
import { CompanyLogo, VerifiedBadge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Companies — ReferIn" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const companies = listCompanies(q);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} compan${companies.length === 1 ? "y" : "ies"} on the platform`}
      />

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Search companies</label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            className="input"
            placeholder="Name, industry or city"
          />
        </div>
        <button className="btn-primary" type="submit">Search</button>
        {q && <Link href="/companies" className="btn-ghost">Clear</Link>}
      </form>

      {companies.length === 0 ? (
        <EmptyState
          title="No companies found."
          body="Try a different search term."
          action={{ href: "/companies", label: "Show all" }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.slug}`}
              className="card block p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex gap-4">
                <CompanyLogo
                  name={c.name}
                  logoText={c.logoText}
                  brandColor={c.brandColor}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{c.name}</h2>
                    {c.verified && <VerifiedBadge />}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {[c.industry, c.hqLocation, c.size && `${c.size} employees`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {c.about && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {c.about}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{c.openJobs}</div>
                  <div className="text-xs text-slate-500">roles</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{c.totalOpenings}</div>
                  <div className="text-xs text-slate-500">openings</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-brand-700">{c.referrers}</div>
                  <div className="text-xs text-slate-500">can refer</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
