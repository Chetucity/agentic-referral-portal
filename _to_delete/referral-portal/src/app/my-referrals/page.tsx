import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listReferralsForSeeker, countByStatus } from "@/lib/queries";
import { ReferralListItem } from "@/components/ReferralListItem";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { STATUS_LABEL, PIPELINE, type ReferralStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "My referrals — ReferIn" };
export const dynamic = "force-dynamic";

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole("SEEKER");
  const { status } = await searchParams;

  const all = listReferralsForSeeker(user.id);
  const counts = countByStatus(all);
  const rows = status ? all.filter((r) => r.status === status) : all;

  const active = all.filter(
    (r) => !["HIRED", "REJECTED", "DECLINED"].includes(r.status),
  ).length;

  const filters: (ReferralStatus | "ALL")[] = [
    "ALL",
    ...PIPELINE,
    "REJECTED",
    "DECLINED",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="My referrals"
        subtitle="Every request you've sent, and exactly where it stands."
      >
        <Link href="/jobs" className="btn-primary btn-sm">
          Find more openings
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={all.length} />
        <Stat label="In flight" value={active} accent="text-brand-700" />
        <Stat
          label="Referred"
          value={
            (counts.REFERRED ?? 0) +
            (counts.INTERVIEWING ?? 0) +
            (counts.HIRED ?? 0)
          }
        />
        <Stat
          label="Hired"
          value={counts.HIRED ?? 0}
          accent="text-emerald-600"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const isAll = f === "ALL";
          const n = isAll ? all.length : (counts[f] ?? 0);
          const activeFilter = isAll ? !status : status === f;
          return (
            <Link
              key={f}
              href={isAll ? "/my-referrals" : `/my-referrals?status=${f}`}
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
          title={
            all.length === 0
              ? "You haven't asked for a referral yet."
              : "Nothing in that stage."
          }
          body={
            all.length === 0
              ? "Find a role you want, pick someone inside the company, and send them a short note about why you fit."
              : "Try a different filter."
          }
          action={
            all.length === 0
              ? { href: "/jobs", label: "Browse openings" }
              : { href: "/my-referrals", label: "Show all" }
          }
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <ReferralListItem key={r.id} r={r} counterpartLabel="Referrer:" />
          ))}
        </div>
      )}
    </div>
  );
}
