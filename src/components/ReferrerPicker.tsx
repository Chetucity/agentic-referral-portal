"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { requestReferral, type ActionState } from "@/app/actions/referrals";
import { Avatar, StatusPill, Alert } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ReferrerOption = {
  userId: string;
  name: string;
  title: string | null;
  department: string | null;
  yearsAtCo: number | null;
  verified: boolean;
  referralsMade: number;
  hires: number;
  existingStatus: string | null;
  existingId: string | null;
};

function Submit({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full" disabled={pending}>
      {pending ? "Sending…" : `Ask ${name.split(" ")[0]} for a referral`}
    </button>
  );
}

export type ResumeOption = {
  id: string;
  title: string;
  atsScore: number | null;
};

export function ReferrerPicker({
  jobId,
  jobTitle,
  companyName,
  referrers,
  resumes = [],
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  referrers: ReferrerOption[];
  /** Resumes this seeker has built in the portal, newest edit first. */
  resumes?: ResumeOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    requestReferral,
    null,
  );
  const available = referrers.filter((r) => !r.existingStatus);
  const [selected, setSelected] = useState<string | null>(
    available[0]?.userId ?? null,
  );

  const chosen = referrers.find((r) => r.userId === selected) ?? null;

  return (
    <div className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <ul className="space-y-2">
        {referrers.map((r) => {
          const taken = Boolean(r.existingStatus);
          const active = selected === r.userId && !taken;
          return (
            <li key={r.userId}>
              <button
                type="button"
                disabled={taken}
                onClick={() => setSelected(r.userId)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  taken
                    ? "cursor-default border-slate-200 bg-slate-50 opacity-80"
                    : active
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                      : "border-slate-200 hover:bg-slate-50",
                )}
              >
                <Avatar name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {r.name}
                    </span>
                    {r.verified && (
                      <span
                        className="text-emerald-600"
                        title="Verified employee"
                        aria-label="Verified employee"
                      >
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
                  <div className="mt-1 text-xs text-slate-500">
                    {r.referralsMade} referral{r.referralsMade === 1 ? "" : "s"} made
                    {r.hires > 0 && ` · ${r.hires} hired`}
                    {r.yearsAtCo ? ` · ${r.yearsAtCo}y at ${companyName}` : ""}
                  </div>
                </div>
                {taken && r.existingStatus && (
                  <StatusPill status={r.existingStatus} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {available.length === 0 ? (
        <Alert kind="info">
          You&apos;ve already reached out to everyone available for this role.{" "}
          <Link href="/my-referrals" className="font-medium underline">
            Track your requests
          </Link>
          .
        </Alert>
      ) : (
        chosen && (
          <form action={action} className="space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="referrerId" value={chosen.userId} />

            <div>
              <label className="label" htmlFor="message">
                Why you&apos;re a fit
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                className="input resize-y"
                placeholder={`Hi ${chosen.name.split(" ")[0]} — I'm applying for ${jobTitle}. I've spent the last few years doing…`}
              />
              <p className="hint">
                Keep it short and specific. Referrers say the ones that mention
                real projects get picked up first.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="resumeId">
                Resume
              </label>

              {resumes.length > 0 ? (
                <>
                  <select id="resumeId" name="resumeId" className="input" defaultValue={resumes[0].id}>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                        {typeof r.atsScore === "number" ? ` — ATS ${r.atsScore}/100` : ""}
                      </option>
                    ))}
                    <option value="">Don&apos;t attach one</option>
                  </select>
                  <p className="hint">
                    {chosen.name.split(" ")[0]} will be able to read this while
                    deciding, and so will the recruiter if it gets that far.{" "}
                    <Link href="/resume" className="text-brand-700 hover:underline">
                      Edit or add another
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">
                    You haven&apos;t built a resume here yet. A referrer is far
                    more likely to say yes when they can actually read one.
                  </p>
                  <Link href="/resume" className="btn-secondary btn-sm mt-2 inline-flex">
                    Build one now
                  </Link>
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="resumeUrl">
                Or link one <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="resumeUrl"
                name="resumeUrl"
                className="input"
                placeholder="https://drive.google.com/…"
              />
            </div>

            <Submit name={chosen.name} />
          </form>
        )
      )}
    </div>
  );
}
