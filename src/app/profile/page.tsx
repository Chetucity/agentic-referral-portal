import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { toggleOpenToRefer } from "@/app/actions/auth";
import { ProfileForm } from "@/components/ProfileForm";
import {
  PageHeader,
  Avatar,
  CompanyLogo,
  VerifiedBadge,
  Alert,
} from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata = { title: "Profile — ReferIn" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  const me = (await db.select().from(users).where(eq(users.id, session.id)).get())!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Your profile" subtitle={ROLE_LABEL[session.role]} />

      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={me.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-900">{me.name}</div>
          <div className="text-sm text-slate-500">{me.email}</div>
          {me.headline && (
            <div className="mt-1 text-sm text-slate-600">{me.headline}</div>
          )}
        </div>
      </div>

      {/* Company block ---------------------------------------------------- */}
      {session.company && (
        <div className="card mb-6 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <CompanyLogo
              name={session.company.name}
              logoText={session.company.logoText}
              brandColor={session.company.brandColor}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/companies/${session.company.slug}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {session.company.name}
                </Link>
                {session.company.verified ? (
                  <VerifiedBadge label="Verified employee" />
                ) : (
                  <span className="pill bg-amber-50 text-amber-800 ring-amber-200">
                    Verification pending
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500">
                {session.company.title ?? "Employee"}
              </div>
            </div>

            {!session.company.isRecruiter && (
              <form action={toggleOpenToRefer} className="flex items-center gap-2">
                <input
                  type="hidden"
                  name="value"
                  value={session.company.openToRefer ? "off" : "on"}
                />
                <button
                  className={
                    session.company.openToRefer
                      ? "btn-secondary btn-sm"
                      : "btn-primary btn-sm"
                  }
                  type="submit"
                >
                  {session.company.openToRefer
                    ? "Stop appearing as a referrer"
                    : "Make me available to refer"}
                </button>
              </form>
            )}
          </div>

          {!session.company.isRecruiter && (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
              {session.company.openToRefer ? (
                <>
                  You&apos;re listed as available to refer on{" "}
                  {session.company.name}&apos;s openings. Candidates can send you
                  requests.
                </>
              ) : (
                <>
                  You&apos;re hidden from {session.company.name}&apos;s openings.
                  Nobody can send you new referral requests.
                </>
              )}
            </p>
          )}

          {session.company.isRecruiter && (
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <Link href="/recruiter/company" className="btn-secondary btn-sm">
                Edit company profile
              </Link>
              <Link href="/recruiter/jobs" className="btn-secondary btn-sm">
                Manage postings
              </Link>
            </div>
          )}
        </div>
      )}

      {session.role === "EMPLOYEE" && !session.company && (
        <div className="mb-6">
          <Alert kind="info">
            You aren&apos;t linked to a company, so you won&apos;t show up as a
            referrer anywhere. Company linking happens at signup in this demo —
            an admin can also attach you.
          </Alert>
        </div>
      )}

      <ProfileForm initial={me} showSeekerFields={session.role === "SEEKER"} />

      {/*
        Play requires account deletion to be reachable from inside the app, not
        only from a public web page. This is that path.
      */}
      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Delete your account</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Removes your profile, your resumes and your referral history. This
          cannot be undone.
        </p>
        <Link
          href="/account/delete"
          className="mt-3 inline-flex rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
        >
          Delete account
        </Link>
      </section>
    </div>
  );
}
