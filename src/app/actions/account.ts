"use server";

import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  resumes,
  referrals,
  referralEvents,
  notifications,
  companyMembers,
} from "@/db/schema";
import { getCurrentUser, destroySession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

/**
 * Account deletion.
 *
 * Google Play requires that any app with accounts offers deletion from inside
 * the app *and* from a public web page, and a reviewer will follow the link
 * and try it. So this has to actually work, not open a support-email form.
 *
 * What makes it more than a `DELETE FROM users` is that a referral is a shared
 * record. Three people can see it, and two of them are not the person leaving.
 * Deleting the row outright would tear a hole in the other two's history — a
 * referrer's inbox would lose a request they acted on, and a recruiter's
 * pipeline would lose a candidate they interviewed.
 *
 * So deletion is split:
 *
 *   - everything that is only about this person — profile, resumes,
 *     notifications, company membership — is deleted outright;
 *   - the referrals they were party to are deleted too, because they are
 *     mostly *about* the person and keeping them would mean keeping their name
 *     and their message;
 *   - the immutable timeline rows are kept but their actor is unlinked, so the
 *     shape of what happened survives without identifying who it was.
 *
 * This is what the privacy policy promises, and the two should be changed
 * together.
 */

export type DeleteState = { error: string } | null;

export async function deleteMyAccount(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (confirm.toUpperCase() !== "DELETE") {
    return { error: 'Type DELETE in the confirmation box to continue.' };
  }

  // Re-authenticate. Deletion is irreversible, and a session cookie on a
  // borrowed phone should not be enough to trigger it.
  const row = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return { error: "That password is incorrect." };
  }

  const uid = user.id;

  // Unlink this person from the audit trail before their rows go, so the
  // timeline keeps its shape without naming them. `referral_events.actor_id`
  // is nullable for exactly this case.
  await db
    .update(referralEvents)
    .set({ actorId: null })
    .where(eq(referralEvents.actorId, uid));

  // Referrals they were either side of. The cascade on referral_events takes
  // the timeline rows belonging to these referrals with them.
  await db
    .delete(referrals)
    .where(or(eq(referrals.seekerId, uid), eq(referrals.referrerId, uid)));

  await db.delete(notifications).where(eq(notifications.userId, uid));
  await db.delete(resumes).where(eq(resumes.userId, uid));
  await db.delete(companyMembers).where(eq(companyMembers.userId, uid));

  // Finally the account itself.
  await db.delete(users).where(eq(users.id, uid));

  await destroySession();
  redirect("/?deleted=1");
}
