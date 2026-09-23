import { eq, desc } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, companies, companyMembers } from "@/db/schema";
import { platformStats } from "@/lib/queries";
import { adminListCompanies, adminListEmployees } from "@/lib/admin-queries";
import {
  setCompanyVerified,
  setMemberVerified,
  setUserRole,
  deleteUser,
  suspendUser,
  deleteCompany,
  suspendCompany,
} from "@/app/actions/admin";
import { PageHeader } from "@/components/ui";
import { AdminTabs } from "./AdminTabs";

export const metadata = { title: "Admin — ReferIn" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("ADMIN");

  const [stats, allCompanies, allEmployees, rawUsers] = await Promise.all([
    platformStats(),
    adminListCompanies(),
    adminListEmployees(),
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        headline: users.headline,
        suspended: users.suspended,
        createdAt: users.createdAt,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companyMembers, eq(companyMembers.userId, users.id))
      .leftJoin(companies, eq(companies.id, companyMembers.companyId))
      .orderBy(desc(users.createdAt))
      .all(),
  ]);

  // Deduplicate users who belong to multiple companies — keep first match
  const seen = new Set<string>();
  const allUsers = rawUsers.filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Admin"
        subtitle="Full control — users, companies, employees, and verification."
      />

      <AdminTabs
        stats={stats}
        allUsers={allUsers}
        allCompanies={allCompanies}
        allEmployees={allEmployees}
        actions={{
          setCompanyVerified,
          setMemberVerified,
          setUserRole,
          deleteUser,
          suspendUser,
          deleteCompany,
          suspendCompany,
        }}
      />
    </div>
  );
}
