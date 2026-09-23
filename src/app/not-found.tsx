import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-6xl font-semibold text-slate-200">404</div>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">
        We couldn&apos;t find that.
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        The page, opening or company may have been removed.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/jobs" className="btn-primary">Browse openings</Link>
        <Link href="/" className="btn-secondary">Go home</Link>
      </div>
    </div>
  );
}
