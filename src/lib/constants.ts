/* Shared enums, labels and the referral state machine. */

export const ROLES = ["SEEKER", "EMPLOYEE", "RECRUITER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SEEKER: "Job seeker",
  EMPLOYEE: "Employee / Referrer",
  RECRUITER: "Recruiter",
  ADMIN: "Platform admin",
};

export const ROLE_BLURB: Record<Role, string> = {
  SEEKER: "Find openings and ask employees to refer you.",
  EMPLOYEE: "Refer people into your company and track how they do.",
  RECRUITER: "Post openings and manage your company's referrals.",
  ADMIN: "Verify companies and keep an eye on the platform.",
};

/**
 * Roles the public signup form is allowed to hand out. ADMIN is deliberately
 * excluded — it must never be assignable through self-registration. Granting
 * it is an out-of-band action (an operator updating the DB directly), not a
 * checkbox on the signup page.
 */
export const SELF_SERVE_ROLES = ROLES.filter(
  (r): r is Exclude<Role, "ADMIN"> => r !== "ADMIN",
);

/* -------------------------------------------------------------------------- */
/* Referral pipeline                                                          */
/* -------------------------------------------------------------------------- */

export const REFERRAL_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "REFERRED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
  "DECLINED",
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** The happy path, in order. Used to draw the progress tracker. */
export const PIPELINE: ReferralStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "REFERRED",
  "INTERVIEWING",
  "HIRED",
];

/** Statuses that end the referral. */
export const TERMINAL_STATUSES: ReferralStatus[] = [
  "HIRED",
  "REJECTED",
  "DECLINED",
];

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  REFERRED: "Referred",
  INTERVIEWING: "Interviewing",
  HIRED: "Hired",
  REJECTED: "Not selected",
  DECLINED: "Declined",
};

export const STATUS_HINT: Record<ReferralStatus, string> = {
  REQUESTED: "Waiting for the employee to pick this up.",
  ACCEPTED: "The employee agreed to refer — submission pending.",
  REFERRED: "Submitted through the company's internal referral system.",
  INTERVIEWING: "The company's hiring team is interviewing.",
  HIRED: "Offer accepted. The referral worked.",
  REJECTED: "The company did not move forward this time.",
  DECLINED: "The employee could not refer for this role.",
};

/** Tailwind classes per status, for pills and dots. */
export const STATUS_STYLE: Record<ReferralStatus, string> = {
  REQUESTED: "bg-amber-50 text-amber-800 ring-amber-200",
  ACCEPTED: "bg-sky-50 text-sky-800 ring-sky-200",
  REFERRED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  INTERVIEWING: "bg-violet-50 text-violet-800 ring-violet-200",
  HIRED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  DECLINED: "bg-slate-100 text-slate-700 ring-slate-300",
};

/**
 * Who may move a referral from A to B.
 * REFERRER = the employee who was asked; TEAM = referrer or the company's
 * recruiters; SEEKER = the candidate.
 */
type Actor = "REFERRER" | "TEAM" | "SEEKER";

export const TRANSITIONS: Record<
  ReferralStatus,
  { to: ReferralStatus; by: Actor; label: string }[]
> = {
  REQUESTED: [
    { to: "ACCEPTED", by: "REFERRER", label: "Accept request" },
    { to: "DECLINED", by: "REFERRER", label: "Decline" },
  ],
  ACCEPTED: [
    { to: "REFERRED", by: "TEAM", label: "Mark as referred" },
    { to: "DECLINED", by: "REFERRER", label: "Withdraw" },
  ],
  REFERRED: [
    { to: "INTERVIEWING", by: "TEAM", label: "Moved to interview" },
    { to: "REJECTED", by: "TEAM", label: "Not selected" },
  ],
  INTERVIEWING: [
    { to: "HIRED", by: "TEAM", label: "Hired" },
    { to: "REJECTED", by: "TEAM", label: "Not selected" },
  ],
  HIRED: [],
  REJECTED: [],
  DECLINED: [],
};

/** Can `actorKind` move a referral from `from` to `to`? */
export function canTransition(
  from: ReferralStatus,
  to: ReferralStatus,
  actorKind: Actor,
): boolean {
  const allowed = TRANSITIONS[from] ?? [];
  return allowed.some(
    (t) => t.to === to && (t.by === actorKind || (t.by === "TEAM" && actorKind === "REFERRER")),
  );
}

/* -------------------------------------------------------------------------- */
/* Job facets                                                                 */
/* -------------------------------------------------------------------------- */

export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const WORK_MODE_LABEL: Record<string, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "CONTRACT",
  "INTERNSHIP",
] as const;
export const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Full-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

export const JOB_STATUSES = ["OPEN", "PAUSED", "CLOSED"] as const;
export const JOB_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export const COMPANY_SIZES = [
  "1-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
] as const;
