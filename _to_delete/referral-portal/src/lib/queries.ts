import "server-only";
import { and, eq, like, or, sql, desc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  companies,
  companyMembers,
  jobs,
  referrals,
  referralEvents,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/* Companies                                                                  */
/* -------------------------------------------------------------------------- */

export type CompanyCard = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  hqLocation: string | null;
  size: string | null;
  about: string | null;
  logoText: string | null;
  brandColor: string | null;
  verified: boolean;
  openJobs: number;
  totalOpenings: number;
  referrers: number;
};

/** Company directory with live opening counts and referrer counts. */
export function listCompanies(q?: string): CompanyCard[] {
  const rows = db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      industry: companies.industry,
      hqLocation: companies.hqLocation,
      size: companies.size,
      about: companies.about,
      logoText: companies.logoText,
      brandColor: companies.brandColor,
      verified: companies.verified,
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
    })
    .from(companies)
    .where(
      q
        ? or(
            like(companies.name, `%${q}%`),
            like(companies.industry, `%${q}%`),
            like(companies.hqLocation, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(companies.verified), companies.name)
    .all();

  return rows as CompanyCard[];
}

export function getCompanyBySlug(slug: string) {
  return db.select().from(companies).where(eq(companies.slug, slug)).get();
}

/** Members of a company who are open to referring, newest verified first. */
export function listReferrers(companyId: string) {
  return db
    .select({
      memberId: companyMembers.id,
      userId: users.id,
      name: users.name,
      title: companyMembers.title,
      department: companyMembers.department,
      yearsAtCo: companyMembers.yearsAtCo,
      verified: companyMembers.verified,
      headline: users.headline,
      location: users.location,
      // how many referrals this person has already made that reached REFERRED+
      referralsMade: sql<number>`(
        select count(*) from ${referrals}
        where ${referrals.referrerId} = ${users.id}
          and ${referrals.status} in ('REFERRED','INTERVIEWING','HIRED','REJECTED')
      )`,
      hires: sql<number>`(
        select count(*) from ${referrals}
        where ${referrals.referrerId} = ${users.id} and ${referrals.status} = 'HIRED'
      )`,
    })
    .from(companyMembers)
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .where(
      and(
        eq(companyMembers.companyId, companyId),
        eq(companyMembers.openToRefer, true),
      ),
    )
    // Verified first, then longest-tenured, then by name — stable ordering so
    // the "who can refer you" list doesn't shuffle between page loads.
    .orderBy(desc(companyMembers.verified), desc(companyMembers.yearsAtCo), users.name)
    .all();
}

export function listCompanyTeam(companyId: string) {
  return db
    .select({
      memberId: companyMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      title: companyMembers.title,
      isRecruiter: companyMembers.isRecruiter,
      openToRefer: companyMembers.openToRefer,
      verified: companyMembers.verified,
    })
    .from(companyMembers)
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.companyId, companyId))
    .all();
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export type JobFilters = {
  q?: string;
  companySlug?: string;
  location?: string;
  workMode?: string;
  employment?: string;
};

export type JobCard = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  workMode: string | null;
  employment: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  skills: string | null;
  openings: number;
  status: string;
  createdAt: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  logoText: string | null;
  brandColor: string | null;
  companyVerified: boolean;
  referrerCount: number;
};

export function listJobs(f: JobFilters = {}, includeClosed = false): JobCard[] {
  const conds = [];
  if (!includeClosed) conds.push(eq(jobs.status, "OPEN"));
  if (f.q) {
    conds.push(
      or(
        like(jobs.title, `%${f.q}%`),
        like(jobs.skills, `%${f.q}%`),
        like(jobs.department, `%${f.q}%`),
        like(companies.name, `%${f.q}%`),
      )!,
    );
  }
  if (f.companySlug) conds.push(eq(companies.slug, f.companySlug));
  if (f.location) conds.push(like(jobs.location, `%${f.location}%`));
  if (f.workMode) conds.push(eq(jobs.workMode, f.workMode));
  if (f.employment) conds.push(eq(jobs.employment, f.employment));

  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      department: jobs.department,
      location: jobs.location,
      workMode: jobs.workMode,
      employment: jobs.employment,
      experienceMin: jobs.experienceMin,
      experienceMax: jobs.experienceMax,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      currency: jobs.currency,
      skills: jobs.skills,
      openings: jobs.openings,
      status: jobs.status,
      createdAt: jobs.createdAt,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      logoText: companies.logoText,
      brandColor: companies.brandColor,
      companyVerified: companies.verified,
      referrerCount: sql<number>`(
        select count(*) from ${companyMembers}
        where ${companyMembers.companyId} = ${companies.id}
          and ${companyMembers.openToRefer} = 1
      )`,
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(jobs.createdAt))
    .all() as JobCard[];
}

export function getJob(id: string) {
  return db
    .select({
      job: jobs,
      company: companies,
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.id, id))
    .get();
}

/** Distinct locations across open jobs — powers the filter dropdown. */
export function jobLocations(): string[] {
  const rows = db
    .selectDistinct({ location: jobs.location })
    .from(jobs)
    .where(eq(jobs.status, "OPEN"))
    .all();
  return rows
    .map((r) => r.location)
    .filter((l): l is string => Boolean(l))
    .sort();
}

/* -------------------------------------------------------------------------- */
/* Referrals                                                                  */
/* -------------------------------------------------------------------------- */

const referralSelect = {
  id: referrals.id,
  status: referrals.status,
  message: referrals.message,
  referrerNote: referrals.referrerNote,
  createdAt: referrals.createdAt,
  updatedAt: referrals.updatedAt,
  jobId: jobs.id,
  jobTitle: jobs.title,
  jobLocation: jobs.location,
  jobStatus: jobs.status,
  companyId: companies.id,
  companyName: companies.name,
  companySlug: companies.slug,
  logoText: companies.logoText,
  brandColor: companies.brandColor,
};

export type ReferralRow = {
  id: string;
  status: string;
  message: string | null;
  referrerNote: string | null;
  createdAt: string;
  updatedAt: string;
  jobId: string;
  jobTitle: string;
  jobLocation: string | null;
  jobStatus: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  logoText: string | null;
  brandColor: string | null;
  counterpartId: string;
  counterpartName: string;
  counterpartTitle: string | null;
};

/** Referrals a seeker has requested. */
export function listReferralsForSeeker(seekerId: string): ReferralRow[] {
  return db
    .select({
      ...referralSelect,
      counterpartId: users.id,
      counterpartName: users.name,
      counterpartTitle: companyMembers.title,
    })
    .from(referrals)
    .innerJoin(jobs, eq(referrals.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .innerJoin(users, eq(referrals.referrerId, users.id))
    .leftJoin(
      companyMembers,
      and(
        eq(companyMembers.userId, referrals.referrerId),
        eq(companyMembers.companyId, companies.id),
      ),
    )
    .where(eq(referrals.seekerId, seekerId))
    .orderBy(desc(referrals.updatedAt))
    .all() as ReferralRow[];
}

/** Referral requests pointed at a given employee. */
export function listReferralsForReferrer(referrerId: string): ReferralRow[] {
  return db
    .select({
      ...referralSelect,
      counterpartId: users.id,
      counterpartName: users.name,
      counterpartTitle: users.headline,
    })
    .from(referrals)
    .innerJoin(jobs, eq(referrals.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .innerJoin(users, eq(referrals.seekerId, users.id))
    .where(eq(referrals.referrerId, referrerId))
    .orderBy(desc(referrals.updatedAt))
    .all() as ReferralRow[];
}

/** Every referral against a company's jobs — the recruiter pipeline view. */
export function listReferralsForCompany(companyId: string) {
  return db
    .select({
      id: referrals.id,
      status: referrals.status,
      message: referrals.message,
      createdAt: referrals.createdAt,
      updatedAt: referrals.updatedAt,
      jobId: jobs.id,
      jobTitle: jobs.title,
      jobLocation: jobs.location,
      seekerId: users.id,
      seekerName: users.name,
      seekerHeadline: users.headline,
      seekerEmail: users.email,
      referrerId: referrals.referrerId,
    })
    .from(referrals)
    .innerJoin(jobs, eq(referrals.jobId, jobs.id))
    .innerJoin(users, eq(referrals.seekerId, users.id))
    .where(eq(jobs.companyId, companyId))
    .orderBy(desc(referrals.updatedAt))
    .all();
}

/** Full detail for one referral, including both people and the company. */
export function getReferralDetail(id: string) {
  const seeker = { ...users };
  const row = db
    .select({
      referral: referrals,
      job: jobs,
      company: companies,
    })
    .from(referrals)
    .innerJoin(jobs, eq(referrals.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(referrals.id, id))
    .get();
  if (!row) return null;

  const seekerUser = db
    .select()
    .from(users)
    .where(eq(users.id, row.referral.seekerId))
    .get();
  const referrerUser = db
    .select()
    .from(users)
    .where(eq(users.id, row.referral.referrerId))
    .get();
  const referrerMember = db
    .select()
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.userId, row.referral.referrerId),
        eq(companyMembers.companyId, row.company.id),
      ),
    )
    .get();

  const timeline = db
    .select({
      id: referralEvents.id,
      fromStatus: referralEvents.fromStatus,
      toStatus: referralEvents.toStatus,
      note: referralEvents.note,
      createdAt: referralEvents.createdAt,
      actorId: referralEvents.actorId,
      actorName: users.name,
    })
    .from(referralEvents)
    .leftJoin(users, eq(referralEvents.actorId, users.id))
    .where(eq(referralEvents.referralId, id))
    .orderBy(referralEvents.createdAt)
    .all();

  return {
    ...row,
    seeker: seekerUser!,
    referrer: referrerUser!,
    referrerMember: referrerMember ?? null,
    timeline,
  };
}

/** Referrals this seeker already has for a given job (to avoid duplicates). */
export function existingReferralsForJob(jobId: string, seekerId: string) {
  return db
    .select({ referrerId: referrals.referrerId, status: referrals.status, id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.jobId, jobId), eq(referrals.seekerId, seekerId)))
    .all();
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export function countByStatus(rows: { status: string }[]) {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

export function platformStats() {
  const one = (q: ReturnType<typeof db.get>) => q;
  const count = (table: string) =>
    (db.get(sql.raw(`select count(*) as c from ${table}`)) as { c: number }).c;

  const openings = db.get(
    sql`select coalesce(sum(${jobs.openings}),0) as c from ${jobs} where ${jobs.status} = 'OPEN'`,
  ) as { c: number };

  const hired = db.get(
    sql`select count(*) as c from ${referrals} where ${referrals.status} = 'HIRED'`,
  ) as { c: number };

  const pendingCompanies = db
    .select()
    .from(companies)
    .where(eq(companies.verified, false))
    .all();

  const pendingMembers = db
    .select({
      memberId: companyMembers.id,
      userName: users.name,
      userEmail: users.email,
      title: companyMembers.title,
      companyName: companies.name,
      companyId: companies.id,
    })
    .from(companyMembers)
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.verified, false))
    .all();

  return {
    users: count("users"),
    companies: count("companies"),
    jobs: count("jobs"),
    referrals: count("referrals"),
    openings: openings.c,
    hired: hired.c,
    pendingCompanies,
    pendingMembers,
  };
}

/** Suggested openings for a seeker, matched loosely on their skills. */
export function suggestedJobs(skills: string | null, limit = 4): JobCard[] {
  const all = listJobs();
  if (!skills) return all.slice(0, limit);
  const wanted = skills
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const scored = all.map((j) => {
    const hay = `${j.title} ${j.skills ?? ""} ${j.department ?? ""}`.toLowerCase();
    return { j, score: wanted.filter((w) => hay.includes(w)).length };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.j);
}
