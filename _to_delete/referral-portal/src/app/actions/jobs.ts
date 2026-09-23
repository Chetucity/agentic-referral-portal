"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, companies, companyMembers, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { newId } from "@/lib/utils";
import {
  WORK_MODES,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  COMPANY_SIZES,
} from "@/lib/constants";

export type ActionState = { error?: string; ok?: string } | null;

const optNum = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v !== "" ? Number(v) : null))
  .refine((v) => v === null || !Number.isNaN(v), "Must be a number.");

const jobSchema = z.object({
  title: z.string().trim().min(2, "Give the role a title."),
  department: z.string().trim().optional(),
  location: z.string().trim().optional(),
  workMode: z.enum(WORK_MODES).optional().or(z.literal("")),
  employment: z.enum(EMPLOYMENT_TYPES).optional().or(z.literal("")),
  experienceMin: optNum,
  experienceMax: optNum,
  salaryMin: optNum,
  salaryMax: optNum,
  currency: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  description: z.string().trim().min(20, "Add a real description — at least a couple of sentences."),
  openings: optNum,
  status: z.enum(JOB_STATUSES).optional(),
});

/** Recruiters (and admins) may manage a company's postings. */
async function requireRecruiter() {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." as const, user: null };
  if (user.role !== "RECRUITER" && user.role !== "ADMIN") {
    return { error: "Only recruiter accounts can manage postings." as const, user: null };
  }
  if (user.role === "RECRUITER" && !user.company) {
    return { error: "Link your account to a company first." as const, user: null };
  }
  return { error: null, user };
}

export async function createJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { error, user } = await requireRecruiter();
  if (error || !user) return { error: error ?? "Not allowed." };

  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;

  const companyId = user.company?.id ?? String(formData.get("companyId") ?? "");
  if (!companyId) return { error: "No company to post under." };

  const id = newId();
  db.insert(jobs)
    .values({
      id,
      companyId,
      postedById: user.id,
      title: d.title,
      department: d.department || null,
      location: d.location || null,
      workMode: d.workMode || null,
      employment: d.employment || null,
      experienceMin: d.experienceMin,
      experienceMax: d.experienceMax,
      salaryMin: d.salaryMin,
      salaryMax: d.salaryMax,
      currency: d.currency || "INR",
      skills: d.skills || null,
      description: d.description,
      openings: d.openings && d.openings > 0 ? d.openings : 1,
      status: d.status ?? "OPEN",
    })
    .run();

  revalidatePath("/jobs");
  revalidatePath("/recruiter/jobs");
  redirect(`/jobs/${id}`);
}

export async function updateJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { error, user } = await requireRecruiter();
  if (error || !user) return { error: error ?? "Not allowed." };

  const jobId = String(formData.get("jobId") ?? "");
  const existing = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!existing) return { error: "That posting no longer exists." };
  if (user.role !== "ADMIN" && existing.companyId !== user.company?.id) {
    return { error: "That posting belongs to another company." };
  }

  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;

  db.update(jobs)
    .set({
      title: d.title,
      department: d.department || null,
      location: d.location || null,
      workMode: d.workMode || null,
      employment: d.employment || null,
      experienceMin: d.experienceMin,
      experienceMax: d.experienceMax,
      salaryMin: d.salaryMin,
      salaryMax: d.salaryMax,
      currency: d.currency || "INR",
      skills: d.skills || null,
      description: d.description,
      openings: d.openings && d.openings > 0 ? d.openings : 1,
      status: d.status ?? existing.status,
    })
    .where(eq(jobs.id, jobId))
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/recruiter/jobs");
  return { ok: "Posting updated." };
}

/** Quick status flip from the manage list. */
export async function setJobStatus(formData: FormData) {
  const { user } = await requireRecruiter();
  if (!user) return;

  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return;

  const existing = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!existing) return;
  if (user.role !== "ADMIN" && existing.companyId !== user.company?.id) return;

  db.update(jobs).set({ status }).where(eq(jobs.id, jobId)).run();

  revalidatePath("/recruiter/jobs");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

/* -------------------------------------------------------------------------- */
/* Company profile                                                            */
/* -------------------------------------------------------------------------- */

const companySchema = z.object({
  website: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  size: z.enum(COMPANY_SIZES).optional().or(z.literal("")),
  hqLocation: z.string().trim().optional(),
  about: z.string().trim().optional(),
});

export async function updateCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user?.company) return { error: "You aren't linked to a company." };
  if (user.role !== "RECRUITER" && user.role !== "ADMIN") {
    return { error: "Only recruiters can edit the company profile." };
  }

  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the form." };
  const d = parsed.data;

  db.update(companies)
    .set({
      website: d.website || null,
      industry: d.industry || null,
      size: d.size || null,
      hqLocation: d.hqLocation || null,
      about: d.about || null,
    })
    .where(eq(companies.id, user.company.id))
    .run();

  revalidatePath(`/companies/${user.company.slug}`);
  revalidatePath("/recruiter/company");
  return { ok: "Company profile saved." };
}

/* -------------------------------------------------------------------------- */
/* Admin moderation                                                           */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function setCompanyVerified(formData: FormData) {
  if (!(await requireAdmin())) return;
  const companyId = String(formData.get("companyId") ?? "");
  const verified = formData.get("verified") === "true";

  db.update(companies).set({ verified }).where(eq(companies.id, companyId)).run();

  revalidatePath("/admin");
  revalidatePath("/companies");
  revalidatePath("/dashboard");
}

export async function setMemberVerified(formData: FormData) {
  if (!(await requireAdmin())) return;
  const memberId = String(formData.get("memberId") ?? "");
  const verified = formData.get("verified") === "true";

  db.update(companyMembers)
    .set({ verified })
    .where(eq(companyMembers.id, memberId))
    .run();

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setUserRole(formData: FormData) {
  if (!(await requireAdmin())) return;
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["SEEKER", "EMPLOYEE", "RECRUITER", "ADMIN"].includes(role)) return;

  db.update(users).set({ role }).where(eq(users.id, userId)).run();
  revalidatePath("/admin");
}
