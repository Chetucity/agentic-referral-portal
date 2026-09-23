import "server-only";
import { eq, and, or } from "drizzle-orm";
import { db } from "@/db";
import { resumes, referrals, jobs, users } from "@/db/schema";
import type { SessionUser } from "@/lib/session";

/**
 * Who may read a given resume.
 *
 * A resume is private by default. It becomes visible to one more person only
 * by being attached to a referral, and then only to the people that referral
 * already involves:
 *
 *   - the owner, always;
 *   - the employee being asked to refer them — they are being asked to put
 *     their name on this person, so they need to read it;
 *   - recruiters at the company the referral points into, because the resume
 *     is the candidate's application;
 *   - platform admins.
 *
 * Note what is *not* here: being able to see someone's referral does not mean
 * being able to see every resume they own, only the one attached to it. That
 * is why this resolves through the referral rather than through the user.
 */
export async function canReadResume(
  resumeId: string,
  viewer: SessionUser,
): Promise<boolean> {
  const row = await db
    .select({ userId: resumes.userId })
    .from(resumes)
    .where(eq(resumes.id, resumeId))
    .get();

  if (!row) return false;
  if (row.userId === viewer.id) return true;
  if (viewer.role === "ADMIN") return true;

  // Is this resume attached to a referral that the viewer is party to?
  const link = await db
    .select({
      referrerId: referrals.referrerId,
      companyId: jobs.companyId,
    })
    .from(referrals)
    .innerJoin(jobs, eq(referrals.jobId, jobs.id))
    .where(eq(referrals.resumeId, resumeId))
    .all();

  return link.some(
    (l) =>
      l.referrerId === viewer.id ||
      (viewer.role === "RECRUITER" && viewer.company?.id === l.companyId),
  );
}

/** A resume plus its owner, for the read-only view. */
export async function getResumeForViewing(resumeId: string) {
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      data: resumes.data,
      fullName: resumes.fullName,
      headline: resumes.headline,
      atsScore: resumes.atsScore,
      updatedAt: resumes.updatedAt,
      ownerId: resumes.userId,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(resumes)
    .innerJoin(users, eq(resumes.userId, users.id))
    .where(eq(resumes.id, resumeId))
    .get();
}

/** Resume summaries for a picker — enough to choose between them, no document. */
export async function listResumeOptions(userId: string) {
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      atsScore: resumes.atsScore,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .all();
}
