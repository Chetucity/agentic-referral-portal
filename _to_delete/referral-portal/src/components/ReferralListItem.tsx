import Link from "next/link";
import { CompanyLogo, Avatar, StatusPill } from "./ui";
import type { ReferralRow } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

export function ReferralListItem({
  r,
  counterpartLabel,
}: {
  r: ReferralRow;
  counterpartLabel: string;
}) {
  return (
    <Link
      href={`/referrals/${r.id}`}
      className="card block p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start gap-3">
        <CompanyLogo
          name={r.companyName}
          logoText={r.logoText}
          brandColor={r.brandColor}
          size={40}
        />

        <div className="min-w-48 flex-1">
          <div className="font-medium text-slate-900">{r.jobTitle}</div>
          <div className="text-sm text-slate-500">
            {r.companyName}
            {r.jobLocation ? ` · ${r.jobLocation}` : ""}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Avatar name={r.counterpartName} size={20} />
            <span className="text-xs text-slate-600">
              {counterpartLabel}{" "}
              <span className="font-medium text-slate-800">
                {r.counterpartName}
              </span>
              {r.counterpartTitle ? ` — ${r.counterpartTitle}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={r.status} />
          <span className="text-xs text-slate-400">
            updated {timeAgo(r.updatedAt)}
          </span>
        </div>
      </div>

      {r.message && (
        <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {r.message}
        </p>
      )}
    </Link>
  );
}
