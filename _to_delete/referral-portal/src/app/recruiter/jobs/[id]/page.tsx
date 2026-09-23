import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getJob } from "@/lib/queries";
import { JobForm } from "@/components/JobForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("RECRUITER", "ADMIN");
  const row = getJob(id);
  if (!row) notFound();

  if (user.role !== "ADMIN" && row.company.id !== user.company?.id) {
    redirect("/dashboard?error=forbidden");
  }

  const { job, company } = row;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-slate-500 hover:text-slate-800">
        ← My postings
      </Link>
      <div className="mt-4">
        <PageHeader title="Edit opening" subtitle={job.title}>
          <Link href={`/jobs/${job.id}`} className="btn-secondary btn-sm">
            View public page
          </Link>
        </PageHeader>
      </div>
      <JobForm mode="edit" companyName={company.name} initial={job} />
    </div>
  );
}
