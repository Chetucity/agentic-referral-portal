"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  companies,
  companyMembers,
  jobs,
  referrals,
  referralEvents,
  resumes,
  notifications,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

/* -------------------------------------------------------------------------- */
/* Guard                                                                      */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Admin access required.");
  }
  return user;
}

/* -------------------------------------------------------------------------- */
/* Existing moderation actions (moved from jobs.ts)                           */
/* -------------------------------------------------------------------------- */

export async function setCompanyVerified(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const verified = formData.get("verified") === "true";
  await db.update(companies).set({ verified }).where(eq(companies.id, companyId)).run();
  revalidatePath("/admin");
  revalidatePath("/companies");
  revalidatePath("/dashboard");
}

export async function setMemberVerified(formData: FormData) {
  await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const verified = formData.get("verified") === "true";
  await db.update(companyMembers).set({ verified }).where(eq(companyMembers.id, memberId)).run();
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setUserRole(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["SEEKER", "EMPLOYEE", "RECRUITER", "ADMIN"].includes(role)) return;
  await db.update(users).set({ role }).where(eq(users.id, userId)).run();
  revalidatePath("/admin");
}

/* -------------------------------------------------------------------------- */
/* Suspend / unsuspend                                                        */
/* -------------------------------------------------------------------------- */

export async function suspendUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const suspended = formData.get("suspended") === "true";
  await db.update(users).set({ suspended }).where(eq(users.id, userId)).run();
  revalidatePath("/admin");
}

export async function suspendCompany(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const suspended = formData.get("suspended") === "true";
  await db.update(companies).set({ suspended }).where(eq(companies.id, companyId)).run();
  revalidatePath("/admin");
  revalidatePath("/companies");
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Permanently delete a user and all their associated data.
 *
 * Cascade in the schema covers most FKs, but we do an explicit sweep of
 * referral_events whose actorId points at this user (set null, not cascade)
 * and notifications, so there are no dangling refs.
 */
export async function deleteUser(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  if (userId === admin.id) {
    return { error: "You cannot delete your own account from here." };
  }

  const target = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!target) return { error: "User not found." };

  // Nullify actorId in referral events rather than losing timeline history
  await db.update(referralEvents).set({ actorId: null }).where(eq(referralEvents.actorId, userId)).run();

  // Delete cascading data that isn't covered by FK cascade
  await db.delete(notifications).where(eq(notifications.userId, userId)).run();
  await db.delete(resumes).where(eq(resumes.userId, userId)).run();

  // Referrals where this user is seeker or referrer — cascade will handle via FK,
  // but let's be explicit for referral events on those referrals
  const userReferrals = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.seekerId, userId))
    .all();
  const userReferrals2 = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referrerId, userId))
    .all();
  for (const r of [...userReferrals, ...userReferrals2]) {
    await db.delete(referralEvents).where(eq(referralEvents.referralId, r.id)).run();
    await db.delete(referrals).where(eq(referrals.id, r.id)).run();
  }

  // Company memberships
  await db.delete(companyMembers).where(eq(companyMembers.userId, userId)).run();

  // Finally delete the user
  await db.delete(users).where(eq(users.id, userId)).run();

  revalidatePath("/admin");
  revalidatePath("/companies");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Permanently delete a company and all associated data (jobs, members, referrals
 * on those jobs).
 */
export async function deleteCompany(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");

  const target = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).get();
  if (!target) return { error: "Company not found." };

  // Find all jobs belonging to this company
  const companyJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .all();

  // Delete referral events and referrals for each job
  for (const j of companyJobs) {
    const jobReferrals = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.jobId, j.id))
      .all();
    for (const r of jobReferrals) {
      await db.delete(referralEvents).where(eq(referralEvents.referralId, r.id)).run();
      await db.delete(referrals).where(eq(referrals.id, r.id)).run();
    }
    await db.delete(jobs).where(eq(jobs.id, j.id)).run();
  }

  // Delete members
  await db.delete(companyMembers).where(eq(companyMembers.companyId, companyId)).run();

  // Delete company
  await db.delete(companies).where(eq(companies.id, companyId)).run();

  revalidatePath("/admin");
  revalidatePath("/companies");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return {};
}
