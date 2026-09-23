import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getReferralDetail } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import {
  Avatar,
  CompanyLogo,
  StatusPill,
  Alert,
  VerifiedBadge,
} from "@/components/ui";
import { PipelineTracker } from "@/components/PipelineTracker";
import { ReferralActions, AddNoteForm } from "@/components/ReferralActions";
import {
  TRANSITIONS,
  STATUS_LABEL,
  type ReferralStatus,
} from "@/lib/constants";
import { formatDate, timeAgo, splitList } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReferralPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireUser();

  const detail = getReferralDetail(id);
  if (!detail) notFound();

  const { referral, job, company, seeker, referrer, referrerMember, timeline } =
    detail;

  const isSeeker = referral.seekerId === user.id;
  const isReferrer = referral.referrerId === user.id;
  const isCompanyRecruiter =
    user.role === "RECRUITER" && user.company?.id === company.id;
  const isAdmin = user.role === "ADMIN";

  if (!isSeeker && !isReferrer && !isCompanyRecruiter && !isAdmin) {
    redirect("/dashboard?error=forbidden");
  }

  const status = referral.status as ReferralStatus;
  const actorKind = isReferrer ? "REFERRER" : "TEAM";

  // Which buttons this viewer gets.
  const available = (TRANSITIONS[status] ?? [])
    .filter((t) => {
      if (isAdmin) return true;
      if (t.by === "REFERRER") return isReferrer;
      if (t.by === "TEAM") return isReferrer || isCompanyRecruiter;
      return false;
    })
    .map((t) => ({
      to: t.to as string,
      label: t.label,
      tone:
        t.to === "REJECTED" || t.to === "DECLINED"
          ? ("danger" as const)
          : t.to === "HIRED"
            ? ("primary" as const)
            : ("primary" as const),
    }));

  const canAct = available.length > 0 && (isReferrer || isCompanyRecruiter || isAdmin);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={isSeeker ? "/my-referrals" : isReferrer ? "/referrals/inbox" : "/recruiter/referrals"}
        className="text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back
      </Link>

      {isNew && (
        <div className="mt-4">
          <Alert kind="success">
            Request sent to {referrer.name}. You&apos;ll get a notification the
            moment they respond.
          </Alert>
        </div>
      )}

      {/* Header ------------------------------------------------------- */}
      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo
            name={company.name}
            logoText={company.logoText}
            brandColor={company.brandColor}
            size={52}
          />
          <div className="min-w-56 flex-1">
            <Link
              href={`/jobs/${job.id}`}
              className="text-xl font-semibold tracking-tight text-slate-900 hover:underline"
            >
              {job.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <Link href={`/companies/${company.slug}`} className="hover:underline">
                {company.name}
              </Link>
              {company.verified && <VerifiedBadge />}
              {job.location && <span>· {job.location}</span>}
            </div>
          </div>
          <StatusPill status={status} className="text-sm" />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <PipelineTracker status={status} />
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Requested
            </div>
            <div className="mt-0.5 font-medium text-slate-900">
              {formatDate(referral.createdAt)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last update
            </div>
            <div className="mt-0.5 font-medium text-slate-900">
              {timeAgo(referral.updatedAt)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Steps logged
            </div>
            <div className="mt-0.5 font-medium text-slate-900">{timeline.length}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Timeline --------------------------------------------------- */}
        <div className="card p-6">
          <h2 className="section-title">Timeline</h2>

          <ol className="mt-4 space-y-0">
            {timeline.map((e, i) => {
              const isNote = e.fromStatus === e.toStatus;
              return (
                <li key={e.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        isNote
                          ? "mt-1.5 h-2 w-2 rounded-full bg-slate-300"
                          : "mt-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-50"
                      }
                    />
                    {i < timeline.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-slate-200" />
                    )}
                  </div>

                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-slate-900">
                        {isNote
                          ? `${e.actorName ?? "Someone"} added a note`
                          : e.fromStatus
                            ? `${STATUS_LABEL[e.fromStatus as ReferralStatus]} → ${STATUS_LABEL[e.toStatus as ReferralStatus]}`
                            : "Referral requested"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {timeAgo(e.createdAt)}
                      </span>
                    </div>
                    {!isNote && e.actorName && (
                      <div className="text-xs text-slate-500">by {e.actorName}</div>
                    )}
                    {e.note && (
                      <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {e.note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {canAct && (
            <div className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Move this referral
              </h3>
              <ReferralActions referralId={referral.id} actions={available} />
            </div>
          )}

          <AddNoteForm referralId={referral.id} />
        </div>

        {/* People ----------------------------------------------------- */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Candidate
            </h3>
            <div className="mt-3 flex gap-3">
              <Avatar name={seeker.name} size={40} />
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{seeker.name}</div>
                <div className="text-xs text-slate-600">
                  {seeker.headline ?? "Job seeker"}
                </div>
                {(isReferrer || isCompanyRecruiter || isAdmin) && (
                  <div className="mt-1 break-all text-xs text-slate-500">
                    {seeker.email}
                  </div>
                )}
              </div>
            </div>
            {seeker.location && (
              <div className="mt-3 text-xs text-slate-500">📍 {seeker.location}</div>
            )}
            {splitList(seeker.skills).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {splitList(seeker.skills).slice(0, 8).map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
            )}
            {referral.resumeUrl && (isReferrer || isCompanyRecruiter || isAdmin) && (
              <a
                href={referral.resumeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary btn-sm mt-4 w-full"
              >
                Open resume
              </a>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Referrer
            </h3>
            <div className="mt-3 flex gap-3">
              <Avatar name={referrer.name} size={40} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-900">{referrer.name}</span>
                  {referrerMember?.verified && (
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
                <div className="text-xs text-slate-600">
                  {referrerMember?.title ?? "Employee"} at {company.name}
                </div>
              </div>
            </div>
          </div>

          {referral.message && (
            <div className="card p-5">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                The ask
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {referral.message}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
