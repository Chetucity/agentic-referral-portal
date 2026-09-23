import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getCompanyBySlug, listCompanyTeam } from "@/lib/queries";
import { CompanyForm } from "@/components/CompanyForm";
import { PageHeader, EmptyState, Avatar, VerifiedBadge } from "@/components/ui";

export const metadata = { title: "Company profile — ReferIn" };
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const user = await requireRole("RECRUITER", "ADMIN");

  if (!user.company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          title="You're not linked to a company."
          action={{ href: "/profile", label: "Go to profile" }}
        />
      </div>
    );
  }

  const company = getCompanyBySlug(user.company.slug)!;
  const team = listCompanyTeam(company.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-slate-500 hover:text-slate-800">
        ← My postings
      </Link>
      <div className="mt-4">
        <PageHeader
          title={company.name}
          subtitle="What candidates see on your company page."
        >
          <Link href={`/companies/${company.slug}`} className="btn-secondary btn-sm">
            View public page
          </Link>
        </PageHeader>
      </div>

      <CompanyForm initial={company} />

      <section className="mt-8">
        <h2 className="section-title mb-3">
          Team on ReferIn{" "}
          <span className="font-normal text-slate-400">({team.length})</span>
        </h2>
        <div className="card divide-y divide-slate-100">
          {team.map((m) => (
            <div key={m.memberId} className="flex items-center gap-3 p-4">
              <Avatar name={m.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{m.name}</span>
                  {m.verified && <VerifiedBadge />}
                </div>
                <div className="text-xs text-slate-500">
                  {m.title ?? "Employee"} · {m.email}
                </div>
              </div>
              <div className="flex gap-1.5">
                {m.isRecruiter && <span className="chip">Recruiter</span>}
                {m.openToRefer ? (
                  <span className="pill bg-brand-50 text-brand-700 ring-brand-200">
                    Referring
                  </span>
                ) : (
                  <span className="chip">Not referring</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
