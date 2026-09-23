import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { SessionUser } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { Avatar } from "./ui";
import { ROLE_LABEL } from "@/lib/constants";

function navFor(user: SessionUser | null) {
  const base = [
    { href: "/jobs", label: "Openings" },
    { href: "/companies", label: "Companies" },
  ];
  if (!user) return base;

  switch (user.role) {
    case "SEEKER":
      return [...base, { href: "/my-referrals", label: "My referrals" }];
    case "EMPLOYEE":
      return [...base, { href: "/referrals/inbox", label: "Referral requests" }];
    case "RECRUITER":
      return [
        ...base,
        { href: "/recruiter/jobs", label: "My postings" },
        { href: "/recruiter/referrals", label: "Referral pipeline" },
      ];
    case "ADMIN":
      return [...base, { href: "/admin", label: "Admin" }];
    default:
      return base;
  }
}

export async function NavBar({ user }: { user: SessionUser | null }) {
  const links = navFor(user);

  let unread = 0;
  if (user) {
    const rows = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.read, false),
        ),
      )
      .all();
    unread = rows.length;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span className="text-base font-semibold tracking-tight">ReferIn</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                aria-label="Notifications"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M10 2a5 5 0 00-5 5v2.6l-1.3 2.6A1 1 0 004.6 14h10.8a1 1 0 00.9-1.8L15 9.6V7a5 5 0 00-5-5zM7.5 15.5a2.5 2.5 0 005 0h-5z" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <Link
                href="/dashboard"
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block"
              >
                Dashboard
              </Link>

              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
                title={ROLE_LABEL[user.role]}
              >
                <Avatar name={user.name} size={30} />
                <span className="hidden text-sm font-medium text-slate-700 md:block">
                  {user.name.split(" ")[0]}
                </span>
              </Link>

              <form action={logout}>
                <button className="btn-ghost btn-sm" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary btn-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {/* mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {l.label}
          </Link>
        ))}
        {user && (
          <Link
            href="/dashboard"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Dashboard
          </Link>
        )}
      </nav>
    </header>
  );
}
