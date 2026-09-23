import Link from "next/link";
import { listJobs, jobLocations } from "@/lib/queries";
import { JobCardItem } from "@/components/JobCardItem";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  WORK_MODES,
  WORK_MODE_LABEL,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_LABEL,
} from "@/lib/constants";

export const metadata = { title: "Openings — ReferIn" };
export const dynamic = "force-dynamic";

type SP = Promise<{
  q?: string;
  location?: string;
  workMode?: string;
  employment?: string;
}>;

export default async function JobsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const jobs = listJobs(sp);
  const locations = jobLocations();
  const seats = jobs.reduce((n, j) => n + j.openings, 0);
  const hasFilters = Boolean(sp.q || sp.location || sp.workMode || sp.employment);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Openings"
        subtitle={`${jobs.length} role${jobs.length === 1 ? "" : "s"} · ${seats} seat${seats === 1 ? "" : "s"} open`}
      />

      {/* Filters ---------------------------------------------------------- */}
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            className="input"
            placeholder="Title, skill or company"
          />
        </div>

        <div>
          <label className="label" htmlFor="location">Location</label>
          <select id="location" name="location" defaultValue={sp.location ?? ""} className="input">
            <option value="">Anywhere</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="workMode">Work mode</label>
          <select id="workMode" name="workMode" defaultValue={sp.workMode ?? ""} className="input">
            <option value="">Any</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>{WORK_MODE_LABEL[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="employment">Type</label>
          <select id="employment" name="employment" defaultValue={sp.employment ?? ""} className="input">
            <option value="">Any</option>
            {EMPLOYMENT_TYPES.map((e) => (
              <option key={e} value={e}>{EMPLOYMENT_LABEL[e]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button className="btn-primary" type="submit">Apply filters</button>
          {hasFilters && (
            <Link href="/jobs" className="btn-ghost">Clear</Link>
          )}
        </div>
      </form>

      {/* Results ---------------------------------------------------------- */}
      {jobs.length === 0 ? (
        <EmptyState
          title="No openings match that."
          body="Try loosening the filters — or check back, new roles get posted often."
          action={{ href: "/jobs", label: "Clear filters" }}
        />
      ) : (
        <div className="grid gap-4">
          {jobs.map((j) => (
            <JobCardItem key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
