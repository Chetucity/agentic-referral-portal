import Link from "next/link";
import { cn, initials, colorFor } from "@/lib/utils";
import {
  STATUS_LABEL,
  STATUS_STYLE,
  type ReferralStatus,
} from "@/lib/constants";

/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: colorFor(name),
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function CompanyLogo({
  name,
  logoText,
  brandColor,
  size = 48,
  className,
}: {
  name: string;
  logoText?: string | null;
  brandColor?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: brandColor || colorFor(name),
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {(logoText || initials(name)).slice(0, 3)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export function StatusPill({
  status,
  className,
}: {
  status: ReferralStatus | string;
  className?: string;
}) {
  const s = status as ReferralStatus;
  return (
    <span className={cn("pill", STATUS_STYLE[s] ?? STATUS_STYLE.DECLINED, className)}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="pill bg-emerald-50 text-emerald-700 ring-emerald-200">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path
          fillRule="evenodd"
          d="M16.4 6.3a1 1 0 010 1.4l-6.5 6.5a1 1 0 01-1.4 0L4.6 10.3a1 1 0 111.4-1.4l2.6 2.6 5.8-5.8a1 1 0 011.4 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cn("mt-1 text-2xl font-semibold", accent ?? "text-slate-900")}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-base font-medium text-slate-800">{title}</div>
      {body && <p className="max-w-md text-sm text-slate-500">{body}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-3">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[kind];
  return (
    <div className={cn("rounded-lg px-3 py-2 text-sm ring-1 ring-inset", styles)}>
      {children}
    </div>
  );
}
