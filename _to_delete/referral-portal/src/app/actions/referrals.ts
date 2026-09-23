"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  referrals,
  referralEvents,
  notifications,
  jobs,
  companies,
  companyMembers,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { newId, nowIso } from "@/lib/utils";
import {
  canTransition,
  STATUS_LABEL,
  type ReferralStatus,
  REFERRAL_STATUSES,
} from "@/lib/constants";

export type ActionState = { error?: string; ok?: string } | null;

function notify(userId: string, title: string, body: string, link: string) {
  db.insert(notifications)
    .values({ id: newId(), userId, title, body, link, read: false })
    .run();
}

/* -------------------------------------------------------------------------- */
/* Seeker requests a referral                                                 */
/* -------------------------------------------------------------------------- */

const requestSchema = z.object({
  jobId: z.string().min(1),
  referrerId: z.string().min(1),
  message: z.string().trim().max(2000).optional(),
  resumeUrl: z.string().trim().optional(),
});

export async function requestReferral(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to request a referral." };
  if (user.role !== "SEEKER") {
    return { error: "Only job seeker accounts can request referrals." };
  }

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Something was missing from that request." };
  const { jobId, referrerId, message, resumeUrl } = parsed.data;

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return { error: "That opening no longer exists." };
  if (job.status !== "OPEN") return { error: "That opening is no longer accepting referrals." };

  // The referrer must actually work at the company and be open to referring.
  const member = db
    .select()
    .from(companyMembers)
    .where(
      and(
        eq(companyMembers.userId, referrerId),
        eq(companyMembers.companyId, job.companyId),
      ),
    )
    .get();
  if (!member || !member.openToRefer) {
    return { error: "That person isn't available to refer for this role." };
  }

  const dupe = db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.jobId, jobId),
        eq(referrals.seekerId, user.id),
        eq(referrals.referrerId, referrerId),
      ),
    )
    .get();
  if (dupe) {
    return { error: "You've already asked this person about this role." };
  }

  const id = newId();
  const ts = nowIso();

  db.insert(referrals)
    .values({
      id,
      jobId,
      seekerId: user.id,
      referrerId,
      status: "REQUESTED",
      message: message || null,
      resumeUrl: resumeUrl || null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();

  db.insert(referralEvents)
    .values({
      id: newId(),
      referralId: id,
      actorId: user.id,
      fromStatus: null,
      toStatus: "REQUESTED",
      note: message || null,
      createdAt: ts,
    })
    .run();

  notify(
    referrerId,
    `${user.name} asked you for a referral`,
    `${job.title} — take a look and accept or decline.`,
    `/referrals/${id}`,
  );

  revalidatePath("/my-referrals");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/referrals/${id}?new=1`);
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                         */
/* -------------------------------------------------------------------------- */

const transitionSchema = z.object({
  referralId: z.string().min(1),
  toStatus: z.enum(REFERRAL_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export async function updateReferralStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const parsed = transitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "That status change isn't valid." };
  const { referralId, toStatus, note } = parsed.data;

  const ref = db.select().from(referrals).where(eq(referrals.id, referralId)).get();
  if (!ref) return { error: "Referral not found." };

  const job = db.select().from(jobs).where(eq(jobs.id, ref.jobId)).get()!;

  // Work out what kind of actor this user is on this referral.
  const isReferrer = ref.referrerId === user.id;
  const isCompanyRecruiter =
    user.role === "RECRUITER" && user.company?.id === job.companyId;
  const isAdmin = user.role === "ADMIN";

  if (!isReferrer && !isCompanyRecruiter && !isAdmin) {
    return { error: "You can't change this referral." };
  }

  const from = ref.status as ReferralStatus;
  const actorKind = isReferrer ? "REFERRER" : "TEAM";

  if (!isAdmin && !canTransition(from, toStatus, actorKind)) {
    return {
      error: `A referral can't go from "${STATUS_LABEL[from]}" to "${STATUS_LABEL[toStatus]}" here.`,
    };
  }

  const ts = nowIso();
  db.update(referrals)
    .set({ status: toStatus, updatedAt: ts })
    .where(eq(referrals.id, referralId))
    .run();

  db.insert(referralEvents)
    .values({
      id: newId(),
      referralId,
      actorId: user.id,
      fromStatus: from,
      toStatus,
      note: note || null,
      createdAt: ts,
    })
    .run();

  // Tell the candidate, and the referrer when someone else moved it.
  notify(
    ref.seekerId,
    `Your referral is now "${STATUS_LABEL[toStatus]}"`,
    `${job.title} — updated by ${user.name}.`,
    `/referrals/${referralId}`,
  );
  if (!isReferrer) {
    notify(
      ref.referrerId,
      `Referral moved to "${STATUS_LABEL[toStatus]}"`,
      `${job.title} — updated by ${user.name}.`,
      `/referrals/${referralId}`,
    );
  }

  revalidatePath(`/referrals/${referralId}`);
  revalidatePath("/my-referrals");
  revalidatePath("/referrals/inbox");
  revalidatePath("/recruiter/referrals");
  revalidatePath("/dashboard");

  return { ok: `Moved to ${STATUS_LABEL[toStatus]}.` };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export async function addReferralNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const referralId = String(formData.get("referralId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!referralId || !note) return { error: "Write something first." };

  const ref = db.select().from(referrals).where(eq(referrals.id, referralId)).get();
  if (!ref) return { error: "Referral not found." };

  const job = db.select().from(jobs).where(eq(jobs.id, ref.jobId)).get()!;
  const allowed =
    ref.seekerId === user.id ||
    ref.referrerId === user.id ||
    (user.role === "RECRUITER" && user.company?.id === job.companyId) ||
    user.role === "ADMIN";
  if (!allowed) return { error: "You can't post on this referral." };

  db.insert(referralEvents)
    .values({
      id: newId(),
      referralId,
      actorId: user.id,
      fromStatus: ref.status,
      toStatus: ref.status,
      note,
      createdAt: nowIso(),
    })
    .run();

  const other = ref.seekerId === user.id ? ref.referrerId : ref.seekerId;
  notify(
    other,
    `${user.name} added a note`,
    note.slice(0, 120),
    `/referrals/${referralId}`,
  );

  revalidatePath(`/referrals/${referralId}`);
  return { ok: "Note added." };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, user.id))
    .run();
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
