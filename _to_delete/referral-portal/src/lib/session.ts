import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, companyMembers, companies } from "@/db/schema";
import type { Role } from "@/lib/constants";

const COOKIE = "rp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Copy .env.example to .env and set it.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function readUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  headline: string | null;
  /** First company this user belongs to, if any (employees & recruiters). */
  company: {
    id: string;
    name: string;
    slug: string;
    logoText: string | null;
    brandColor: string | null;
    memberId: string;
    title: string | null;
    isRecruiter: boolean;
    openToRefer: boolean;
    verified: boolean;
  } | null;
};

/** Current user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const id = await readUserId();
  if (!id) return null;

  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return null;

  const membership = db
    .select({
      memberId: companyMembers.id,
      title: companyMembers.title,
      isRecruiter: companyMembers.isRecruiter,
      openToRefer: companyMembers.openToRefer,
      verified: companyMembers.verified,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      logoText: companies.logoText,
      brandColor: companies.brandColor,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, id))
    .get();

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    headline: row.headline,
    company: membership
      ? {
          id: membership.companyId,
          name: membership.companyName,
          slug: membership.companySlug,
          logoText: membership.logoText,
          brandColor: membership.brandColor,
          memberId: membership.memberId,
          title: membership.title,
          isRecruiter: membership.isRecruiter,
          openToRefer: membership.openToRefer,
          verified: membership.verified,
        }
      : null,
  };
});

/** Redirects to /login when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires a session with one of the given roles. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?error=forbidden");
  return user;
}
