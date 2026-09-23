import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignupForm } from "./SignupForm";
import { SELF_SERVE_ROLES, ROLE_LABEL, ROLE_BLURB, type Role } from "@/lib/constants";

export const metadata = { title: "Create an account — ReferIn" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { role } = await searchParams;
  const initialRole = (SELF_SERVE_ROLES as readonly string[]).includes(role ?? "")
    ? (role as Role)
    : "SEEKER";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <SignupForm
        initialRole={initialRole}
        roles={SELF_SERVE_ROLES.map((r) => ({
          value: r,
          label: ROLE_LABEL[r],
          blurb: ROLE_BLURB[r],
        }))}
      />
    </div>
  );
}
