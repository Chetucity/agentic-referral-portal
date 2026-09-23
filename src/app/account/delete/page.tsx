import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LEGAL } from "@/lib/legal";
import { Fill } from "@/components/legal";
import { env } from "@/lib/env";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Delete your account",
  description: `How to delete your ${env.appName} account and what happens to your data.`,
};

/**
 * Account deletion, as a page anyone can reach.
 *
 * Google Play asks for two things for any app with accounts: a way to delete
 * from inside the app, and a public web page describing it that a reviewer can
 * open without installing anything or signing in. This page is both — signed
 * out it explains the process, signed in it does it.
 *
 * The explanation is not filler. Play expects the page to state what is
 * deleted and what, if anything, is retained, and it has to match the privacy
 * policy.
 */
export default async function DeleteAccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Delete your account
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        You can delete your {env.appName} account at any time. This page
        explains exactly what happens, and lets you do it.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-slate-900">
          What gets deleted
        </h2>
        <ul className="mt-2 ml-5 list-disc space-y-1.5 text-sm text-slate-700">
          <li>Your profile — name, email, headline, location, skills, bio and links.</li>
          <li>Every resume you built here, and any drafts.</li>
          <li>Your notifications.</li>
          <li>
            Every referral you requested, and every referral request sent to
            you — including the messages and notes on them.
          </li>
          <li>Your link to a company, if you had one.</li>
          <li>Your sign-in credentials.</li>
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-slate-900">
          What is kept, and why
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          A referral involves more than one person. Where a status change is
          part of someone else&apos;s history — a referrer&apos;s record of the
          referrals they made, a company&apos;s record of who it interviewed —
          the fact that the change happened is retained, but it is unlinked from
          you first. It no longer carries your name, your email or anything else
          that identifies you.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Nothing retained this way can be traced back to your account, and your
          account cannot be restored from it.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-slate-900">How long it takes</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Immediately. There is no grace period and no recovery window — once
          you confirm, it is done, and you will be signed out.
        </p>
      </section>

      <section className="mt-9 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
        {user ? (
          <>
            <h2 className="text-base font-semibold text-rose-900">
              Delete {user.email}
            </h2>
            <p className="mt-1 text-sm text-rose-800">
              This cannot be undone. Confirm with your password.
            </p>
            <DeleteAccountForm />
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-slate-900">
              Sign in to delete your account
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              We ask you to sign in and re-enter your password first, so that
              nobody else can delete your account from a device you left open.
            </p>
            <Link href="/login?next=/account/delete" className="btn-primary mt-4 inline-flex">
              Sign in
            </Link>
            <p className="mt-4 text-sm text-slate-600">
              Can&apos;t sign in? Email <Fill value={LEGAL.supportEmail} /> from
              the address on the account and we will delete it for you.
            </p>
          </>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-500">
        See the{" "}
        <Link href="/legal/privacy" className="underline hover:text-slate-700">
          privacy policy
        </Link>{" "}
        for how your data is handled while the account exists.
      </p>
    </div>
  );
}
