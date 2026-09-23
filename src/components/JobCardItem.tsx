import Link from "next/link";
import { CompanyLogo, VerifiedBadge } from "./ui";
import type { JobCard } from "@/lib/queries";
import {
  WORK_MODE_LABEL,
  EMPLOYMENT_LABEL,
  JOB_STATUS_LABEL,
} from "@/lib/constants";
import { salaryLabel, expLabel, splitList, timeAgo } from "@/lib/utils";

export function JobCardItem({
  job,
  showStatus = false,
}: {
  job: JobCard;
  showStatus?: boolean;
}) {
  const salary = salaryLabel(job.salaryMin, job.salaryMax, job.currency);
  const exp = expLabel(job.experienceMin, job.experienceMax);
  const skills = splitList(job.skills).slice(0, 5);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card block p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex gap-4">
        <CompanyLogo
          name={job.companyName}
          logoText={job.logoText}
          brandColor={job.brandColor}
          size={44}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {job.title}
            </h3>
            {showStatus && job.status !== "OPEN" && (
              <span className="chip">{JOB_STATUS_LABEL[job.status]}</span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span className="font-medium">{job.companyName}</span>
            {job.companyVerified && <VerifiedBadge />}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {job.location && <span>📍 {job.location}</span>}
            {job.workMode && <span>{WORK_MODE_LABEL[job.workMode]}</span>}
            {job.employment && <span>{EMPLOYMENT_LABEL[job.employment]}</span>}
            {exp && <span>{exp}</span>}
            {salary && <span className="font-medium text-slate-700">{salary}</span>}
          </div>

          {skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-between text-right sm:flex">
          <div>
            <div className="text-xl font-semibold text-slate-900">
              {job.openings}
            </div>
            <div className="text-xs text-slate-500">
              opening{job.openings === 1 ? "" : "s"}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-semibold text-brand-700">
              {job.referrerCount}
            </div>
            <div className="text-xs text-slate-500">can refer</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>Posted {timeAgo(job.createdAt)}</span>
        <span className="font-medium text-brand-700 sm:hidden">
          {job.openings} open · {job.referrerCount} can refer
        </span>
      </div>
    </Link>
  );
}
