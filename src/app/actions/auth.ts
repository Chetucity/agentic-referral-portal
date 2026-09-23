"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, companies, companyMembers } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/session";
import { newId, slugify, colorFor } from "@/lib/utils";
import { SELF_SERVE_ROLES } from "@/lib/constants";

export type FormState = { error?: string; ok?: boolean } | null;

/* -------------------------------------------------------------------------- */
/* Sign up                                                                    */
/* -------------------------------------------------------------------------- */

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    // Never trust a client-submitted "ADMIN" — see SELF_SERVE_ROLES.
    role: z.enum(SELF_SERVE_ROLES),
    headline: z.string().trim().optional(),
    location: z.string().trim().optional(),
    skills: z.string().trim().optional(),
    experience: z.string().trim().optional(),
    // company fields — required for EMPLOYEE and RECRUITER
    companyName: z.string().trim().optional(),
    companyWebsite: z.string().trim().optional(),
    companyIndustry: z.string().trim().optional(),
    companySize: z.string().trim().optional(),
    companyLocation: z.string().trim().optional(),
    jobTitle: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      d.role === "SEEKER" ||
      (d.companyName && d.companyName.length > 1),
    { message: "Company name is required.", path: ["companyName"] },
  );

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const d = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, d.email))
    .get();
  if (existing) {
    return { error: "An account with that email already exists. Try signing in." };
  }

  const userId = newId();
  await db.insert(users)
    .values({
      id: userId,
      email: d.email,
      passwordHash: await hashPassword(d.password),
      name: d.name,
      role: d.role,
      headline: d.headline || null,
      location: d.location || null,
      skills: d.skills || null,
      experience: d.experience || null,
    })
    .run();

  // Employees and recruiters get attached to a company (created if new).
  if ((d.role === "EMPLOYEE" || d.role === "RECRUITER") && d.companyName) {
    const slug = slugify(d.companyName);
    let company = await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug))
      .get();

    if (!company) {
      const companyId = newId();
      await db.insert(companies)
        .values({
          id: companyId,
          name: d.companyName,
          slug,
          website: d.companyWebsite || null,
          industry: d.companyIndustry || null,
          size: d.companySize || null,
          hqLocation: d.companyLocation || null,
          logoText: d.companyName.slice(0, 2).toUpperCase(),
          brandColor: colorFor(d.companyName),
          verified: false,
          createdById: userId,
        })
        .run();
      company = (await db.select().from(companies).where(eq(companies.id, companyId)).get())!;
    }

    await db.insert(companyMembers)
      .values({
        id: newId(),
        userId,
        companyId: company.id,
        title: d.jobTitle || null,
        isRecruiter: d.role === "RECRUITER",
        openToRefer: d.role === "EMPLOYEE",
        verified: false,
      })
      .run();
  }

  await createSession(userId);
  redirect("/dashboard");
}

/* -------------------------------------------------------------------------- */
/* Log in / out                                                               */
/* -------------------------------------------------------------------------- */

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .get();

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }

  // Block suspended users from signing in
  if (user.suspended) {
    return { error: "Your account has been suspended. Contact support for help." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(2),
  headline: z.string().trim().optional(),
  location: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  experience: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  resumeUrl: z.string().trim().optional(),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in." };

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const d = parsed.data;

  await db.update(users)
    .set({
      name: d.name,
      headline: d.headline || null,
      location: d.location || null,
      skills: d.skills || null,
      experience: d.experience || null,
      bio: d.bio || null,
      linkedinUrl: d.linkedinUrl || null,
      resumeUrl: d.resumeUrl || null,
    })
    .where(eq(users.id, user.id))
    .run();

  revalidatePath("/profile");
  return { ok: true };
}

/** Employee toggles whether they appear as an available referrer. */
export async function toggleOpenToRefer(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.company) return;
  const next = formData.get("value") === "on";

  await db.update(companyMembers)
    .set({ openToRefer: next })
    .where(
      and(
        eq(companyMembers.userId, user.id),
        eq(companyMembers.companyId, user.company.id),
      ),
    )
    .run();

  revalidatePath("/dashboard");
  revalidatePath("/profile");
}
