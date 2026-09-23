import Link from "next/link";
import { listCompanies, listJobs } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { CompanyLogo } from "@/components/ui";
import { JobCardItem } from "@/components/JobCardItem";

export default async function Home() {
  const user = await getCurrentUser();
  const jobs = listJobs().slice(0, 4);
  const companies = listCompanies().slice(0, 6);

  const totalOpenings = listJobs().reduce((n, j) => n + j.openings, 0);

  return (
    <>
      {/* Hero ------------------------------------------------------------- */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="max-w-3xl">
            <span className="pill bg-brand-50 text-brand-700 ring-brand-200">
              Referrals, tracked end to end
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              See the opening. See who can refer you.
              <br className="hidden sm:block" />
              <span className="text-brand-600">Then watch it move.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600">
              Job boards show you a listing and a black hole. ReferIn shows you
              the people inside the company who can actually put your name
              forward — and gives you a status you can check, from request to
              hired.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/jobs" className="btn-primary">
                Browse {totalOpenings} openings
              </Link>
              {!user && (
                <Link href="/signup?role=EMPLOYEE" className="btn-secondary">
                  I want to refer people
                </Link>
              )}
              {user && (
                <Link href="/dashboard" className="btn-secondary">
                  Go to dashboard
                </Link>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {[
              {
                n: "1",
                t: "Find an opening",
                d: "Filter by role, location and work mode. Every listing shows how many seats are open and how many employees are available to refer.",
              },
              {
                n: "2",
                t: "Pick your referrer",
                d: "See the actual people at that company who said yes to referring — their team, their title, how many referrals they have made.",
              },
              {
                n: "3",
                t: "Track it honestly",
                d: "Requested → Accepted → Referred → Interviewing → Hired. Every change is timestamped. No more wondering.",
              },
            ].map((s) => (
              <div key={s.n} className="card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                  {s.n}
                </span>
                <div className="mt-3 font-semibold text-slate-900">{s.t}</div>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest openings -------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="section-title">Latest openings</h2>
          <Link href="/jobs" className="text-sm font-medium text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid gap-4">
          {jobs.map((j) => (
            <JobCardItem key={j.id} job={j} />
          ))}
        </div>
      </section>

      {/* Companies -------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="section-title">Companies hiring</h2>
          <Link href="/companies" className="text-sm font-medium text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.slug}`}
              className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
            >
              <CompanyLogo
                name={c.name}
                logoText={c.logoText}
                brandColor={c.brandColor}
              />
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.totalOpenings} opening{c.totalOpenings === 1 ? "" : "s"} ·{" "}
                  {c.referrers} referrer{c.referrers === 1 ? "" : "s"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
