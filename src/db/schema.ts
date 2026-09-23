/**
 * Referral Portal — data model (Drizzle ORM / SQLite)
 *
 * Roles:      SEEKER | EMPLOYEE | RECRUITER | ADMIN
 * Referral:   REQUESTED -> ACCEPTED -> REFERRED -> INTERVIEWING -> HIRED | REJECTED
 *             (a referrer may DECLINE while still at REQUESTED)
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("SEEKER"),
    headline: text("headline"),
    location: text("location"),
    skills: text("skills"), // comma-separated
    experience: text("experience"),
    resumeUrl: text("resume_url"),
    linkedinUrl: text("linkedin_url"),
    bio: text("bio"),
    suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

/* -------------------------------------------------------------------------- */
/* Companies                                                                  */
/* -------------------------------------------------------------------------- */

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    website: text("website"),
    industry: text("industry"),
    size: text("size"),
    hqLocation: text("hq_location"),
    about: text("about"),
    logoText: text("logo_text"),
    brandColor: text("brand_color"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    slugIdx: uniqueIndex("companies_slug_idx").on(t.slug),
  }),
);

/**
 * Links a user to a company.
 * `openToRefer` controls whether the member is offered as a referrer on job pages.
 * `verified` means an admin (or work-email check) confirmed they really work there.
 */
export const companyMembers = sqliteTable(
  "company_members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title"),
    department: text("department"),
    yearsAtCo: integer("years_at_co"),
    isRecruiter: integer("is_recruiter", { mode: "boolean" })
      .notNull()
      .default(false),
    openToRefer: integer("open_to_refer", { mode: "boolean" })
      .notNull()
      .default(true),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: uniqueIndex("company_members_user_company_idx").on(
      t.userId,
      t.companyId,
    ),
    byCompany: index("company_members_company_idx").on(t.companyId),
  }),
);

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    postedById: text("posted_by_id").references(() => users.id),
    title: text("title").notNull(),
    department: text("department"),
    location: text("location"),
    workMode: text("work_mode"), // ONSITE | HYBRID | REMOTE
    employment: text("employment"), // FULL_TIME | CONTRACT | INTERNSHIP
    experienceMin: integer("experience_min"),
    experienceMax: integer("experience_max"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    currency: text("currency").default("INR"),
    skills: text("skills"), // comma-separated
    description: text("description").notNull(),
    openings: integer("openings").notNull().default(1),
    status: text("status").notNull().default("OPEN"), // OPEN | PAUSED | CLOSED
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    byCompany: index("jobs_company_idx").on(t.companyId),
    byStatus: index("jobs_status_idx").on(t.status),
  }),
);

/* -------------------------------------------------------------------------- */
/* Resumes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A resume built in the portal's resume builder.
 *
 * `data` is the builder's own document JSON — the form fields, template,
 * accent colour, section order and layout pins. It is stored opaquely on
 * purpose: the builder owns that shape and evolves it, and nothing on the
 * server needs to read inside it. The few things the rest of the app *does*
 * care about — the title, the headline it was built around, and the ATS score
 * — are denormalised into real columns so a list of resumes can be rendered,
 * sorted and shown to a referrer without parsing every blob.
 */
export const resumes = sqliteTable(
  "resumes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled resume"),
    /** Serialised builder document. Opaque to the server. */
    data: text("data").notNull(),
    /** Denormalised from `data` so lists and referral cards stay cheap. */
    fullName: text("full_name"),
    headline: text("headline"),
    atsScore: integer("ats_score"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    byUser: index("resumes_user_idx").on(t.userId),
    byUpdated: index("resumes_updated_idx").on(t.updatedAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* Referrals — the tracked pipeline                                           */
/* -------------------------------------------------------------------------- */

export const referrals = sqliteTable(
  "referrals",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    seekerId: text("seeker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("REQUESTED"),
    message: text("message"),
    /**
     * A resume the seeker built in the portal. Kept alongside `resumeUrl`
     * rather than replacing it: an externally hosted resume is still a valid
     * thing to attach, and existing referrals predate the builder.
     *
     * `set null` on delete, not cascade — deleting a resume must not delete
     * the referral it was attached to. The referral keeps its history and
     * simply stops pointing at a document.
     */
    resumeId: text("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    resumeUrl: text("resume_url"),
    referrerNote: text("referrer_note"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    uniq: uniqueIndex("referrals_job_seeker_referrer_idx").on(
      t.jobId,
      t.seekerId,
      t.referrerId,
    ),
    bySeeker: index("referrals_seeker_idx").on(t.seekerId),
    byReferrer: index("referrals_referrer_idx").on(t.referrerId),
    byJob: index("referrals_job_idx").on(t.jobId),
  }),
);

/** Immutable timeline entry for every status change or note on a referral. */
export const referralEvents = sqliteTable(
  "referral_events",
  {
    id: text("id").primaryKey(),
    referralId: text("referral_id")
      .notNull()
      .references(() => referrals.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    byReferral: index("referral_events_referral_idx").on(t.referralId),
  }),
);



/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({
    byUser: index("notifications_user_idx").on(t.userId, t.read),
  }),
);

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type ReferralEvent = typeof referralEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
