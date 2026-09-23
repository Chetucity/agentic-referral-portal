import {
  PIPELINE,
  STATUS_LABEL,
  STATUS_HINT,
  type ReferralStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Horizontal progress tracker for a referral.
 * REJECTED / DECLINED are drawn as a stopped state at the step they died on.
 */
export function PipelineTracker({ status }: { status: ReferralStatus | string }) {
  const s = status as ReferralStatus;
  const stopped = s === "REJECTED" || s === "DECLINED";
  const currentIdx = stopped
    ? s === "DECLINED"
      ? 0
      : 2
    : Math.max(0, PIPELINE.indexOf(s));

  return (
    <div>
      <ol className="flex items-center">
        {PIPELINE.map((step, i) => {
          const done = i < currentIdx || (!stopped && i === currentIdx && s === "HIRED");
          const active = i === currentIdx && !stopped;
          const dead = stopped && i === currentIdx;
          const future = i > currentIdx;

          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-2",
                    dead
                      ? "bg-rose-500 text-white ring-rose-200"
                      : done
                        ? "bg-emerald-500 text-white ring-emerald-200"
                        : active
                          ? "bg-brand-600 text-white ring-brand-200"
                          : "bg-white text-slate-400 ring-slate-200",
                  )}
                >
                  {dead ? "✕" : done ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "mt-1.5 whitespace-nowrap text-[11px] font-medium",
                    future ? "text-slate-400" : "text-slate-700",
                  )}
                >
                  {STATUS_LABEL[step]}
                </span>
              </div>

              {i < PIPELINE.length - 1 && (
                <span
                  className={cn(
                    "mx-1 mb-5 h-0.5 flex-1 rounded",
                    i < currentIdx ? "bg-emerald-400" : "bg-slate-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-sm text-slate-600">
        {stopped ? STATUS_HINT[s] : STATUS_HINT[PIPELINE[currentIdx]!]}
      </p>
    </div>
  );
}
