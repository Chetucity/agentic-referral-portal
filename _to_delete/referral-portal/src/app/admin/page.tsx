import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, companies } from "@/db/schema";
import { platformStats, listCompanies } from "@/lib/queries";
import {
  setCompanyVerified,
  setMemberVerified,
  setUserRole,
} from "@/app/actions/jobs";
import {
  Stat,
  PageHeader,
  CompanyLogo,
  Avatar,
  VerifiedBadge,
} from "@/components/ui";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Admin — ReferIn" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("ADMIN");

  const s = platformStats();
  const allCompanies = listCompanies();
  const allUsers = db.select().from(users).orderBy(desc(users.createdAt)).all();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Admin"
        subtitle="Verification queue, companies and users."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={s.users} />
        <Stat label="Companies" value={s.companies} />
        <Stat label="Roles" value={s.jobs} />
        <Stat label="Openings" value={s.openings} />
        <Stat label="Referrals" value={s.referrals} accent="text-brand-700" />
        <Stat label="Hires" value={s.hired} accent="text-emerald-600" />
      </div>

      {/* Verification queue --------------------------------------------- */}
      <section className="mb-8">
        <h2 className="section-title mb-3">
          Employees awaiting verification{" "}
          <span className="font-normal text-slate-400">
            ({s.pendingMembers.length})
          </span>
        </h2>
        {s.pendingMembers.length === 0 ? (
          <div className="card p-5 text-sm text-slate-500">
            Queue is clear.
          </div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {s.pendingMembers.map((m) => (
              <div key={m.memberId} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={m.userName} size={36} />
                <div className="min-w-44 flex-1">
                  <div className="font-medium text-slate-900">{m.userName}</div>
                  <div className="text-xs text-slate-500">{m.userEmail}</div>
                </div>
                <div className="min-w-36 flex-1 text-sm text-slate-700">
                  {m.title ?? "Employee"}
                  <div className="text-xs text-slate-500">{m.companyName}</div>
                </div>
                <form action={setMemberVerified}>
                  <input type="hidden" name="memberId" value={m.memberId} />
                  <input type="hidden" name="verified" value="true" />
                  <button className="btn-primary btn-sm" type="submit">
                    Verify
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Companies ------------------------------------------------------- */}
      <section className="mb-8">
        <h2 className="section-title mb-3">
          Companies{" "}
          <span className="font-normal text-slate-400">({allCompanies.length})</span>
        </h2>
        <div className="card divide-y divide-slate-100">
          {allCompanies.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <CompanyLogo
                name={c.name}
                logoText={c.logoText}
                brandColor={c.brandColor}
                size={36}
              />
              <div className="min-w-44 flex-1">
                <Link
                  href={`/companies/${c.slug}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {c.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {c.openJobs} roles · {c.totalOpenings} openings · {c.referrers}{" "}
                  referrers
                </div>
              </div>
              {c.verified ? <VerifiedBadge /> : (
                <span className="pill bg-amber-50 text-amber-800 ring-amber-200">
                  Unverified
                </span>
              )}
              <form action={setCompanyVerified}>
                <input type="hidden" name="companyId" value={c.id} />
                <input
                  type="hidden"
                  name="verified"
                  value={c.verified ? "false" : "true"}
                />
                <button
                  className={c.verified ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                  type="submit"
                >
                  {c.verified ? "Un-verify" : "Verify"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* Users ----------------------------------------------------------- */}
      <section>
        <h2 className="section-title mb-3">
          Users <span className="font-normal text-slate-400">({allUsers.length})</span>
        </h2>
        <div className="card divide-y divide-slate-100">
          {allUsers.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={u.name} size={36} />
              <div className="min-w-44 flex-1">
                <div className="font-medium text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <div className="text-xs text-slate-400">
                joined {timeAgo(u.createdAt)}
              </div>
              <form action={setUserRole} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="input w-40 py-1 text-xs"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary btn-sm" type="submit">
                  Save
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
