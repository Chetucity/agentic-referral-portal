"use client";

import { useState, useTransition } from "react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Tab = "overview" | "users" | "companies" | "employees";

type PendingMember = {
  memberId: string;
  userName: string;
  userEmail: string;
  title: string | null;
  companyName: string;
  companyId: string;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  hqLocation: string | null;
  size: string | null;
  logoText: string | null;
  brandColor: string | null;
  verified: boolean;
  suspended: boolean;
  openJobs: number;
  totalOpenings: number;
  referrers: number;
  memberCount: number;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  headline: string | null;
  suspended: boolean;
  createdAt: string;
  companyName: string | null;
};

type Stats = {
  users: number;
  companies: number;
  jobs: number;
  referrals: number;
  openings: number;
  hired: number;
  pendingMembers: PendingMember[];
};

type EmployeeRow = {
  memberId: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string | null;
  companyName: string;
  companyId: string;
  isRecruiter: boolean;
  openToRefer: boolean;
  verified: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${((h % 360) + 360) % 360}, 55%, 50%)`;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

function CompanyLogo({ name, logoText, brandColor, size = 36 }: {
  name: string; logoText?: string | null; brandColor?: string | null; size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, background: brandColor || colorFor(name), fontSize: size * 0.36 }}
    >
      {(logoText || initials(name)).slice(0, 3)}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab bar                                                                    */
/* -------------------------------------------------------------------------- */

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "users", label: "Users", icon: "👤" },
  { key: "companies", label: "Companies", icon: "🏢" },
  { key: "employees", label: "Employees", icon: "🔗" },
];

/* -------------------------------------------------------------------------- */
/* Confirm modal                                                              */
/* -------------------------------------------------------------------------- */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card mx-4 w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? "btn-sm rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700" : "btn-primary btn-sm"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export function AdminTabs({
  stats,
  allUsers,
  allCompanies,
  allEmployees,
  actions,
}: {
  stats: Stats;
  allUsers: UserRow[];
  allCompanies: CompanyRow[];
  allEmployees: EmployeeRow[];
  actions: {
    setCompanyVerified: (fd: FormData) => Promise<void>;
    setMemberVerified: (fd: FormData) => Promise<void>;
    setUserRole: (fd: FormData) => Promise<void>;
    deleteUser: (fd: FormData) => Promise<{ error?: string }>;
    suspendUser: (fd: FormData) => Promise<void>;
    deleteCompany: (fd: FormData) => Promise<{ error?: string }>;
    suspendCompany: (fd: FormData) => Promise<void>;
  };
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [isPending, startTransition] = useTransition();

  /* search / filter state */
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [companySearch, setCompanySearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<"ALL" | "VERIFIED" | "UNVERIFIED" | "SUSPENDED">("ALL");
  const [employeeSearch, setEmployeeSearch] = useState("");

  /* confirm dialog */
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  /* feedback */
  const [toast, setToast] = useState<string | null>(null);
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  /* ----- action wrappers ----- */

  function doAction(action: (fd: FormData) => Promise<void | { error?: string }>, fd: FormData, msg: string) {
    startTransition(async () => {
      const result = await action(fd);
      if (result && typeof result === "object" && "error" in result && result.error) {
        flash(`Error: ${result.error}`);
      } else {
        flash(msg);
      }
    });
  }

  function askConfirmThenDo(
    title: string, message: string, confirmLabel: string,
    action: (fd: FormData) => Promise<void | { error?: string }>, fd: FormData, successMsg: string,
    danger = true,
  ) {
    setConfirm({
      title, message, confirmLabel, danger,
      onConfirm: () => { setConfirm(null); doAction(action, fd, successMsg); },
    });
  }

  /* ----- filtered data ----- */

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = userRoleFilter === "ALL" || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredCompanies = allCompanies.filter((c) => {
    const q = companySearch.toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q);
    const matchesFilter =
      companyFilter === "ALL" ||
      (companyFilter === "VERIFIED" && c.verified && !c.suspended) ||
      (companyFilter === "UNVERIFIED" && !c.verified && !c.suspended) ||
      (companyFilter === "SUSPENDED" && c.suspended);
    return matchesSearch && matchesFilter;
  });

  const filteredEmployees = allEmployees.filter((e) => {
    const q = employeeSearch.toLowerCase();
    return !q || e.userName.toLowerCase().includes(q) || e.userEmail.toLowerCase().includes(q) || e.companyName.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        danger={confirm?.danger}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onCancel={() => setConfirm(null)}
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Updating…
        </div>
      )}

      {/* ================================================================== */}
      {/* OVERVIEW                                                           */}
      {/* ================================================================== */}
      {tab === "overview" && (
        <>
          <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Users" value={stats.users} />
            <Stat label="Companies" value={stats.companies} />
            <Stat label="Roles" value={stats.jobs} />
            <Stat label="Openings" value={stats.openings} />
            <Stat label="Referrals" value={stats.referrals} accent="text-brand-700" />
            <Stat label="Hires" value={stats.hired} accent="text-emerald-600" />
          </div>

          {/* Pending employees */}
          <section className="mb-8">
            <h2 className="section-title mb-3">
              Employees awaiting verification{" "}
              <span className="font-normal text-slate-400">({stats.pendingMembers.length})</span>
            </h2>
            {stats.pendingMembers.length === 0 ? (
              <div className="card p-5 text-sm text-slate-500">Queue is clear.</div>
            ) : (
              <div className="card divide-y divide-slate-100">
                {stats.pendingMembers.map((m) => (
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
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("memberId", m.memberId);
                        fd.set("verified", "true");
                        doAction(actions.setMemberVerified, fd, `Verified ${m.userName}`);
                      }}
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-3">
            <button onClick={() => setTab("users")} className="card p-5 text-left hover:ring-2 hover:ring-brand-300">
              <div className="text-sm font-semibold text-slate-900">Manage Users</div>
              <div className="mt-1 text-xs text-slate-500">View, suspend, or remove user accounts</div>
            </button>
            <button onClick={() => setTab("companies")} className="card p-5 text-left hover:ring-2 hover:ring-brand-300">
              <div className="text-sm font-semibold text-slate-900">Manage Companies</div>
              <div className="mt-1 text-xs text-slate-500">Verify, suspend, or delete companies</div>
            </button>
            <button onClick={() => setTab("employees")} className="card p-5 text-left hover:ring-2 hover:ring-brand-300">
              <div className="text-sm font-semibold text-slate-900">Review Employees</div>
              <div className="mt-1 text-xs text-slate-500">Verify employee memberships</div>
            </button>
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* USERS                                                              */}
      {/* ================================================================== */}
      {tab === "users" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="input w-64 py-1.5 text-sm"
            />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="input w-40 py-1.5 text-sm"
            >
              <option value="ALL">All roles</option>
              <option value="SEEKER">Job seeker</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="ADMIN">Admin</option>
            </select>
            <span className="text-sm text-slate-500">{filteredUsers.length} users</span>
          </div>

          <div className="card divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No users match your filters.</div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className={`flex flex-wrap items-center gap-3 p-4 ${u.suspended ? "opacity-60" : ""}`}>
                  <Avatar name={u.name} size={36} />
                  <div className="min-w-44 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{u.name}</span>
                      {u.suspended && (
                        <span className="pill bg-rose-50 text-rose-700 ring-rose-200">Suspended</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    {u.companyName && (
                      <div className="text-xs text-slate-400">{u.companyName}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">joined {timeAgo(u.createdAt)}</div>

                  {/* Role changer */}
                  <select
                    defaultValue={u.role}
                    onChange={(e) => {
                      const fd = new FormData();
                      fd.set("userId", u.id);
                      fd.set("role", e.target.value);
                      doAction(actions.setUserRole, fd, `Role updated for ${u.name}`);
                    }}
                    className="input w-36 py-1 text-xs"
                  >
                    <option value="SEEKER">Job seeker</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="RECRUITER">Recruiter</option>
                    <option value="ADMIN">Admin</option>
                  </select>

                  {/* Suspend */}
                  <button
                    className={u.suspended ? "btn-secondary btn-sm" : "btn-ghost btn-sm text-amber-600"}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("userId", u.id);
                      fd.set("suspended", u.suspended ? "false" : "true");
                      doAction(actions.suspendUser, fd, u.suspended ? `Unsuspended ${u.name}` : `Suspended ${u.name}`);
                    }}
                  >
                    {u.suspended ? "Unsuspend" : "Suspend"}
                  </button>

                  {/* Delete */}
                  <button
                    className="btn-ghost btn-sm text-rose-600"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("userId", u.id);
                      askConfirmThenDo(
                        "Delete user",
                        `This will permanently remove ${u.name} (${u.email}) and all their data — referrals, memberships, resumes. This cannot be undone.`,
                        "Delete permanently",
                        actions.deleteUser, fd, `Deleted ${u.name}`,
                      );
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* COMPANIES                                                          */}
      {/* ================================================================== */}
      {tab === "companies" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search companies…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="input w-64 py-1.5 text-sm"
            />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value as typeof companyFilter)}
              className="input w-40 py-1.5 text-sm"
            >
              <option value="ALL">All</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <span className="text-sm text-slate-500">{filteredCompanies.length} companies</span>
          </div>

          <div className="card divide-y divide-slate-100">
            {filteredCompanies.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No companies match your filters.</div>
            ) : (
              filteredCompanies.map((c) => (
                <div key={c.id} className={`flex flex-wrap items-center gap-3 p-4 ${c.suspended ? "opacity-60" : ""}`}>
                  <CompanyLogo name={c.name} logoText={c.logoText} brandColor={c.brandColor} size={36} />
                  <div className="min-w-44 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{c.name}</span>
                      {c.verified && !c.suspended && (
                        <span className="pill bg-emerald-50 text-emerald-700 ring-emerald-200">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                            <path fillRule="evenodd" d="M16.4 6.3a1 1 0 010 1.4l-6.5 6.5a1 1 0 01-1.4 0L4.6 10.3a1 1 0 111.4-1.4l2.6 2.6 5.8-5.8a1 1 0 011.4 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      {c.suspended && (
                        <span className="pill bg-rose-50 text-rose-700 ring-rose-200">Suspended</span>
                      )}
                      {!c.verified && !c.suspended && (
                        <span className="pill bg-amber-50 text-amber-800 ring-amber-200">Unverified</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.industry ?? "—"} · {c.hqLocation ?? "—"} · {c.size ?? "—"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {c.openJobs} roles · {c.totalOpenings} openings · {c.referrers} referrers · {c.memberCount} members
                    </div>
                  </div>

                  {/* Verify / Un-verify */}
                  <button
                    className={c.verified ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("companyId", c.id);
                      fd.set("verified", c.verified ? "false" : "true");
                      doAction(actions.setCompanyVerified, fd, c.verified ? `Un-verified ${c.name}` : `Verified ${c.name}`);
                    }}
                  >
                    {c.verified ? "Un-verify" : "Verify"}
                  </button>

                  {/* Suspend */}
                  <button
                    className={c.suspended ? "btn-secondary btn-sm" : "btn-ghost btn-sm text-amber-600"}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("companyId", c.id);
                      fd.set("suspended", c.suspended ? "false" : "true");
                      doAction(actions.suspendCompany, fd, c.suspended ? `Unsuspended ${c.name}` : `Suspended ${c.name}`);
                    }}
                  >
                    {c.suspended ? "Unsuspend" : "Suspend"}
                  </button>

                  {/* Delete */}
                  <button
                    className="btn-ghost btn-sm text-rose-600"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("companyId", c.id);
                      askConfirmThenDo(
                        "Delete company",
                        `This will permanently delete ${c.name} and all its job postings, memberships, and associated referrals. This cannot be undone.`,
                        "Delete permanently",
                        actions.deleteCompany, fd, `Deleted ${c.name}`,
                      );
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ================================================================== */}
      {/* EMPLOYEES                                                          */}
      {/* ================================================================== */}
      {tab === "employees" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by name, email, or company…"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="input w-72 py-1.5 text-sm"
            />
            <span className="text-sm text-slate-500">{filteredEmployees.length} employee records</span>
          </div>

          <div className="card divide-y divide-slate-100">
            {filteredEmployees.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No employees match your search.</div>
            ) : (
              filteredEmployees.map((e) => (
                <div key={e.memberId} className="flex flex-wrap items-center gap-3 p-4">
                  <Avatar name={e.userName} size={36} />
                  <div className="min-w-44 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{e.userName}</span>
                      {e.verified && (
                        <span className="pill bg-emerald-50 text-emerald-700 ring-emerald-200">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                            <path fillRule="evenodd" d="M16.4 6.3a1 1 0 010 1.4l-6.5 6.5a1 1 0 01-1.4 0L4.6 10.3a1 1 0 111.4-1.4l2.6 2.6 5.8-5.8a1 1 0 011.4 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      {!e.verified && (
                        <span className="pill bg-amber-50 text-amber-800 ring-amber-200">Pending</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{e.userEmail}</div>
                  </div>
                  <div className="min-w-36 text-sm text-slate-700">
                    {e.title ?? (e.isRecruiter ? "Recruiter" : "Employee")}
                    <div className="text-xs text-slate-500">{e.companyName}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    {e.isRecruiter && <span className="pill bg-sky-50 text-sky-700 ring-sky-200">Recruiter</span>}
                    {e.openToRefer && <span className="pill bg-indigo-50 text-indigo-700 ring-indigo-200">Open to refer</span>}
                  </div>

                  {/* Verify / Un-verify */}
                  <button
                    className={e.verified ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("memberId", e.memberId);
                      fd.set("verified", e.verified ? "false" : "true");
                      doAction(actions.setMemberVerified, fd, e.verified ? `Un-verified ${e.userName}` : `Verified ${e.userName}`);
                    }}
                  >
                    {e.verified ? "Un-verify" : "Verify"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </>
  );
}
