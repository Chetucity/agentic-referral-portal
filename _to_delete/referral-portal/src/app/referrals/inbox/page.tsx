import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listReferralsForReferrer, countByStatus } from "@/lib/queries";
import { ReferralListItem } from "@/components/ReferralListItem";
import { EmptyState, PageHeader, Stat, Alert } from "@/components/ui";
import { STATUS_LABEL, PIPELINE, type ReferralStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Referral requests — ReferIn" };
export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole("EMPLOYEE", "RECRUITER");
  const { status } = await searchParams;

  const all = listReferralsForReferrer(user.id);
  const counts = countByStatus(all);
  const rows = status ? all.filter((r) => r.status === status) : all;
  const waiting = counts.REQUESTED ?? 0;

  const filters: (ReferralStatus | "ALL")[] = [
    "ALL",
    ...PIPELINE,
    "REJECTED",
    "DECLINED",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="Referral requests"
        subtitle="People asking you to put their name forward at your company."
      />

      {!user.company && (
        <div className="mb-6">
          <Alert kind="info">
            You aren&apos;t linked to a company yet, so nobody can request a
            referral from you.{" "}
            <Link href="/profile" className="font-medium underline">
              Add your company
            </Link>
            .
          </Alert>
        </div>
      )}

      {user.company && !user.company.openToRefer && (
        <div className="mb-6">
          <Alert kind="info">
            You&apos;re currently marked as <strong>not available</strong> to
            refer, so you won&apos;t appear on {user.company.name}&apos;s job
            pages.{" "}
            <Link href="/profile" className="font-medium underline">
              Change that
            </Link>
            .
          </Alert>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat
          label="Waiting on you"
          value={waiting}
          accent={waiting > 0 ? "text-amber-600" : undefined}
        />
        <Stat label="Accepted" value={counts.ACCEPTED ?? 0} />
        <Stat
          label="Submitted"
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
              href={isAll ? "/referrals/inbox" : `/referrals/inbox?status=${f}`}
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
              ? "No referral requests yet."
              : "Nothing in that stage."
          }
          body={
            all.length === 0
              ? "When someone asks you to refer them, it lands here — with their note, their skills and their resume."
              : "Try a different filter."
          }
          action={
            all.length === 0
              ? { href: "/jobs", label: "See your company's openings" }
              : { href: "/referrals/inbox", label: "Show all" }
          }
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <ReferralListItem key={r.id} r={r} counterpartLabel="Candidate:" />
          ))}
        </div>
      )}
    </div>
  );
}
