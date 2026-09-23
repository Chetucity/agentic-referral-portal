import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listReferralsForCompany, countByStatus } from "@/lib/queries";
import { EmptyState, PageHeader, StatusPill, Avatar } from "@/components/ui";
import { PIPELINE, STATUS_LABEL, type ReferralStatus } from "@/lib/constants";
import { timeAgo, cn } from "@/lib/utils";

export const metadata = { title: "Referral pipeline — ReferIn" };
export const dynamic = "force-dynamic";

export default async function RecruiterReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole("RECRUITER", "ADMIN");
  const { status } = await searchParams;

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

  const all = await listReferralsForCompany(user.company.id);
  const counts = countByStatus(all);
  const rows = status ? all.filter((r) => r.status === status) : all;

  const filters: (ReferralStatus | "ALL")[] = [
    "ALL",
    ...PIPELINE,
    "REJECTED",
    "DECLINED",
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Referral pipeline"
        subtitle={`Every referral into ${user.company.name}'s openings.`}
      >
        <Link href="/recruiter/jobs" className="btn-secondary btn-sm">
          My postings
        </Link>
      </PageHeader>

      {/* Pipeline summary ------------------------------------------------ */}
      <div className="card mb-6 grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        {PIPELINE.map((s) => (
          <Link
            key={s}
            href={`/recruiter/referrals?status=${s}`}
            className="rounded-lg bg-slate-50 p-3 text-center transition-colors hover:bg-slate-100"
          >
            <div className="text-xl font-semibold text-slate-900">
              {counts[s] ?? 0}
            </div>
            <div className="text-xs text-slate-500">{STATUS_LABEL[s]}</div>
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const isAll = f === "ALL";
          const n = isAll ? all.length : (counts[f] ?? 0);
          const activeFilter = isAll ? !status : status === f;
          return (
            <Link
              key={f}
              href={isAll ? "/recruiter/referrals" : `/recruiter/referrals?status=${f}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                activeFilter
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {isAll ? "All" : STATUS_LABEL[f]} ({n})
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No referrals yet." : "Nothing in that stage."}
          body={
            all.length === 0
              ? "Once your employees start referring candidates into your openings, they show up here."
              : "Try a different filter."
          }
          action={
            all.length === 0
              ? { href: "/recruiter/jobs", label: "Check your postings" }
              : { href: "/recruiter/referrals", label: "Show all" }
          }
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/referrals/${r.id}`}
              className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-slate-50"
            >
              <Avatar name={r.seekerName} size={36} />
              <div className="min-w-44 flex-1">
                <div className="font-medium text-slate-900">{r.seekerName}</div>
                <div className="text-xs text-slate-500">
                  {r.seekerHeadline ?? r.seekerEmail}
                </div>
              </div>
              <div className="min-w-40 flex-1">
                <div className="text-sm text-slate-800">{r.jobTitle}</div>
                <div className="text-xs text-slate-500">{r.jobLocation ?? "—"}</div>
              </div>
              <div className="text-right">
                <StatusPill status={r.status} />
                <div className="mt-1 text-xs text-slate-400">
                  {timeAgo(r.updatedAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
