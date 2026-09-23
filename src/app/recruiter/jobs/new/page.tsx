import Link from "next/link";
import { requireRole } from "@/lib/session";
import { JobForm } from "@/components/JobForm";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Post an opening — ReferIn" };

export default async function NewJobPage() {
  const user = await requireRole("RECRUITER", "ADMIN");

  if (!user.company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          title="You're not linked to a company."
          body="Postings belong to a company. Link yours first."
          action={{ href: "/profile", label: "Go to profile" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-slate-500 hover:text-slate-800">
        ← My postings
      </Link>
      <div className="mt-4">
        <PageHeader
          title="Post an opening"
          subtitle="Once it's live, your employees can refer candidates straight into it."
        />
      </div>
      <JobForm mode="create" companyName={user.company.name} />
    </div>
  );
}
