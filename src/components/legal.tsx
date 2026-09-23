import { isTodo } from "@/lib/legal";

/**
 * Shared furniture for the legal pages.
 *
 * `Fill` is the important one: it renders a placeholder as a visible amber
 * badge instead of printing the literal string "TODO: ...". A policy with a
 * blank where the operator's name should be still reads as a finished
 * sentence, which is exactly how an unfinished policy gets submitted and
 * rejected.
 */

export function Fill({ value, label }: { value: string; label?: string }) {
  if (!isTodo(value)) return <>{value}</>;
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[0.8em] font-medium text-amber-800">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path
          fillRule="evenodd"
          d="M8.5 3.3a1.7 1.7 0 013 0l6 10.6A1.7 1.7 0 0116 16.5H4a1.7 1.7 0 01-1.5-2.6zM10 7a.8.8 0 00-.8.8v3a.8.8 0 001.6 0v-3A.8.8 0 0010 7zm0 7.2a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      {label ?? "needs filling in"}
    </span>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Last updated: <Fill value={updated} label="date needed" />
      </p>
      <div className="legal-body mt-8">{children}</div>
    </div>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}
