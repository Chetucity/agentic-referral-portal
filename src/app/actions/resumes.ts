"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { resumes, referrals } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { newId } from "@/lib/utils";

/**
 * Server actions for the resume builder.
 *
 * The builder is a client-side editor: it holds the whole document in React
 * state and renders the preview locally. These actions exist so that work
 * survives a closed tab and — the point of putting the builder in this portal
 * at all — so a resume can be attached to a referral request without the
 * seeker having to host a PDF somewhere first.
 *
 * The document itself is stored as opaque JSON. The server deliberately does
 * not model the builder's field shape: it changes as the editor grows, and
 * nothing here needs to read inside it. Only the handful of values shown in
 * lists and on referral cards are lifted out into real columns.
 */

/** Ceiling on a stored document. A full resume is a few KB; 512 KB is a wall, not a budget. */
const MAX_DOC_BYTES = 512 * 1024;

const SaveSchema = z.object({
  // Absent on first save; present once the client knows its row.
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(120).default("Untitled resume"),
  data: z.string().min(2).max(MAX_DOC_BYTES),
  fullName: z.string().trim().max(200).optional(),
  headline: z.string().trim().max(300).optional(),
  atsScore: z.number().int().min(0).max(100).optional(),
});

export type SaveResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string };

/**
 * Creates or updates a resume.
 *
 * Called on a debounce from the editor, so it is written to be cheap and
 * idempotent: the client sends the whole document every time and the server
 * overwrites. There is no merge and no conflict resolution, because a resume
 * has exactly one editor — its owner, in one tab.
 */
export async function saveResume(input: unknown): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "That resume could not be saved." };
  }
  const d = parsed.data;

  // The document must at least be JSON — a corrupt blob would break the
  // editor on next load, and failing here is much easier to diagnose.
  try {
    JSON.parse(d.data);
  } catch {
    return { ok: false, error: "The resume document was malformed." };
  }

  const updatedAt = new Date().toISOString();

  if (d.id) {
    // Ownership is checked in the WHERE clause rather than with a prior read,
    // so there is no window between the check and the write.
    const rows = await db
      .update(resumes)
      .set({
        title: d.title,
        data: d.data,
        fullName: d.fullName ?? null,
        headline: d.headline ?? null,
        atsScore: d.atsScore ?? null,
        updatedAt,
      })
      .where(and(eq(resumes.id, d.id), eq(resumes.userId, user.id)))
      .returning({ id: resumes.id });

    if (rows.length === 0) {
      return { ok: false, error: "That resume no longer exists." };
    }
    revalidatePath("/resume");
    return { ok: true, id: d.id, updatedAt };
  }

  const id = `res_${newId()}`;
  await db.insert(resumes).values({
    id,
    userId: user.id,
    title: d.title,
    data: d.data,
    fullName: d.fullName ?? null,
    headline: d.headline ?? null,
    atsScore: d.atsScore ?? null,
    createdAt: updatedAt,
    updatedAt,
  });

  revalidatePath("/resume");
  return { ok: true, id, updatedAt };
}

/** Renames a resume without touching its document. */
export async function renameResume(id: string, title: string) {
  const user = await requireUser();
  const clean = title.trim().slice(0, 120) || "Untitled resume";

  await db
    .update(resumes)
    .set({ title: clean, updatedAt: new Date().toISOString() })
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));

  revalidatePath("/resume");
  return { ok: true as const };
}

/**
 * Deletes a resume.
 *
 * Referrals that pointed at it keep their history — the foreign key is
 * `on delete set null` — so a referrer sees "resume removed" rather than the
 * referral vanishing from their inbox.
 */
export async function deleteResume(id: string) {
  const user = await requireUser();

  await db
    .delete(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));

  revalidatePath("/resume");
  revalidatePath("/my-referrals");
  return { ok: true as const };
}

/** Every resume belonging to the signed-in user, newest edit first. */
export async function listMyResumes() {
  const user = await requireUser();
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      fullName: resumes.fullName,
      headline: resumes.headline,
      atsScore: resumes.atsScore,
      updatedAt: resumes.updatedAt,
      createdAt: resumes.createdAt,
    })
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.updatedAt))
    .all();
}

/**
 * Attaches (or detaches, with `null`) a built resume on an existing referral.
 *
 * Only the seeker who owns the referral may do this, and only with a resume
 * they own — both are enforced here rather than trusted from the form.
 */
export async function attachResumeToReferral(
  referralId: string,
  resumeId: string | null,
) {
  const user = await requireUser();

  const ref = await db
    .select({ id: referrals.id, seekerId: referrals.seekerId })
    .from(referrals)
    .where(eq(referrals.id, referralId))
    .get();

  if (!ref) return { ok: false as const, error: "Referral not found." };
  if (ref.seekerId !== user.id) {
    return { ok: false as const, error: "That isn't your referral." };
  }

  if (resumeId) {
    const owned = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, user.id)))
      .get();
    if (!owned) return { ok: false as const, error: "That isn't your resume." };
  }

  await db
    .update(referrals)
    .set({ resumeId, updatedAt: new Date().toISOString() })
    .where(eq(referrals.id, referralId));

  revalidatePath(`/referrals/${referralId}`);
  revalidatePath("/my-referrals");
  return { ok: true as const };
}
