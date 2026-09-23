import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — ReferIn" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="mt-3 max-w-md text-slate-600">
          Pick up where you left off — check where your referrals stand, or see
          who is waiting on you.
        </p>

        {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 card p-5">
            <div className="text-sm font-semibold text-slate-800">
              Demo accounts
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Every seeded account uses the password{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">password123</code>
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["aisha@example.com", "Job seeker — has referrals at 4 stages"],
                ["rohan@nimbus.io", "Employee at Nimbus — has an inbox of requests"],
                ["priya@nimbus.io", "Recruiter at Nimbus — manages postings"],
                ["admin@referin.app", "Platform admin"],
              ].map(([email, desc]) => (
                <li key={email} className="flex flex-col">
                  <code className="text-xs font-medium text-brand-700">
                    {email}
                  </code>
                  <span className="text-xs text-slate-500">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">
          New here?{" "}
          <Link href="/signup" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
