import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { resumes, users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  saveResume,
  deleteResume,
  type SaveResult,
} from "@/app/actions/resumes";
import ResumeBuilder from "./_components/ResumeBuilder";

export const dynamic = "force-dynamic";

/**
 * The resume builder route.
 *
 * Everything below the fold is a client-side editor, so this page's job is
 * narrow: work out who is asking, hand the builder their saved resumes and
 * whichever one they were last editing, and pass down the three server
 * actions it needs. The document itself is never inspected here.
 *
 * `?id=` selects a specific resume, which is what the links from
 * `/my-referrals` and the referral detail page point at.
 */
export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireUser();
  const { id } = await searchParams;

  const mine = await db
    .select({
      id: resumes.id,
      title: resumes.title,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.updatedAt))
    .all();

  // Open the requested resume, else the most recently edited, else a blank one.
  const wantedId = id ?? mine[0]?.id ?? null;

  const active = wantedId
    ? await db
        .select()
        .from(resumes)
        .where(and(eq(resumes.id, wantedId), eq(resumes.userId, user.id)))
        .get()
    : undefined;

  let initialDoc: unknown = null;
  if (active) {
    try {
      initialDoc = JSON.parse(active.data);
    } catch {
      // A corrupt document should not take the editor down with it — start
      // blank and let the next save overwrite the bad row.
      initialDoc = null;
    }
  }

  // Seed a brand-new resume from what the portal already knows.
  const profileRow = await db
    .select({
      name: users.name,
      email: users.email,
      headline: users.headline,
      location: users.location,
      skills: users.skills,
      linkedinUrl: users.linkedinUrl,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  /**
   * Server actions are passed as props rather than imported in the client
   * component so that `loadResume` can stay here, next to the query it wraps,
   * and so the client bundle never imports the database module.
   */
  async function loadResume(resumeId: string) {
    "use server";
    const me = await requireUser();
    const row = await db
      .select({
        id: resumes.id,
        title: resumes.title,
        data: resumes.data,
      })
      .from(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, me.id)))
      .get();
    return row ?? null;
  }

  async function save(input: unknown): Promise<SaveResult> {
    "use server";
    return saveResume(input);
  }

  async function remove(resumeId: string) {
    "use server";
    return deleteResume(resumeId);
  }

  return (
    <ResumeBuilder
      initialResumes={mine}
      initialId={active?.id ?? null}
      initialTitle={active?.title ?? "Untitled resume"}
      initialDoc={initialDoc}
      profile={profileRow ?? null}
      actions={{ save, load: loadResume, remove }}
    />
  );
}
