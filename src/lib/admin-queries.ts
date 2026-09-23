import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  companies,
  companyMembers,
  jobs,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/* Companies — admin view with member counts                                  */
/* -------------------------------------------------------------------------- */

export async function adminListCompanies() {
  return await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      industry: companies.industry,
      hqLocation: companies.hqLocation,
      size: companies.size,
      logoText: companies.logoText,
      brandColor: companies.brandColor,
      verified: companies.verified,
      suspended: companies.suspended,
      createdAt: companies.createdAt,
      openJobs: sql<number>`(
        select count(*) from ${jobs}
        where ${jobs.companyId} = ${companies.id} and ${jobs.status} = 'OPEN'
      )`,
      totalOpenings: sql<number>`(
        select coalesce(sum(${jobs.openings}), 0) from ${jobs}
        where ${jobs.companyId} = ${companies.id} and ${jobs.status} = 'OPEN'
      )`,
      referrers: sql<number>`(
        select count(*) from ${companyMembers}
        where ${companyMembers.companyId} = ${companies.id}
          and ${companyMembers.openToRefer} = 1
      )`,
      memberCount: sql<number>`(
        select count(*) from ${companyMembers}
        where ${companyMembers.companyId} = ${companies.id}
      )`,
    })
    .from(companies)
    .orderBy(desc(companies.createdAt))
    .all();
}

/* -------------------------------------------------------------------------- */
/* Employees — all company memberships, for the employee review tab           */
/* -------------------------------------------------------------------------- */

export async function adminListEmployees() {
  return await db
    .select({
      memberId: companyMembers.id,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      title: companyMembers.title,
      companyName: companies.name,
      companyId: companies.id,
      isRecruiter: companyMembers.isRecruiter,
      openToRefer: companyMembers.openToRefer,
      verified: companyMembers.verified,
    })
    .from(companyMembers)
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .orderBy(desc(companyMembers.createdAt))
    .all();
}
