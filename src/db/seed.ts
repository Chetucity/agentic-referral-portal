/**
 * Seeds a realistic demo dataset: 5 companies, 12 openings, 14 users across all
 * four roles, and referrals sitting at every stage of the pipeline with real
 * timelines behind them.
 *
 * Run with: npm run db:seed   (or `npm run setup` to push the schema first)
 * Every seeded account uses the password: password123
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { scryptSync, randomBytes } from "node:crypto";
import * as schema from "./schema";
import {
  users,
  companies,
  companyMembers,
  jobs,
  referrals,
  referralEvents,
  notifications,
} from "./schema";

const url =
  process.env.DATABASE_URL ??
  (process.env.DATABASE_FILE
    ? `file:${process.env.DATABASE_FILE.replace(/^file:/, "")}`
    : "file:./data/app.db");

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client, { schema });

const PASSWORD = "password123";

function hash(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
const PW_HASH = hash(PASSWORD);

let counter = 0;
function id(prefix: string) {
  counter += 1;
  return `${prefix}_${counter.toString().padStart(4, "0")}`;
}

/** ISO timestamp N days ago (plus a few hours of jitter). */
function daysAgo(n: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hourOffset);
  return d.toISOString();
}

async function main() {
  /* -------------------------------------------------------------------------- */
  /* Wipe                                                                       */
  /* -------------------------------------------------------------------------- */

  console.log("Clearing existing data…");
  await db.delete(notifications).run();
  await db.delete(referralEvents).run();
  await db.delete(referrals).run();
  await db.delete(jobs).run();
  await db.delete(companyMembers).run();
  await db.delete(companies).run();
  await db.delete(users).run();

  /* -------------------------------------------------------------------------- */
  /* Companies                                                                  */
  /* -------------------------------------------------------------------------- */

  const companyRows = [
    {
      id: id("co"),
      name: "Nimbus Labs",
      slug: "nimbus-labs",
      website: "https://nimbus.io",
      industry: "Cloud infrastructure",
      size: "201-1000",
      hqLocation: "Bengaluru, India",
      logoText: "NL",
      brandColor: "#2547eb",
      verified: true,
      about:
        "Nimbus builds the deployment layer that a few thousand engineering teams push to every day. Small teams, long-lived services, and an unusual amount of care about latency. We hire slowly and keep people a long time.",
      createdAt: daysAgo(420),
    },
    {
      id: id("co"),
      name: "Kettle Health",
      slug: "kettle-health",
      website: "https://kettlehealth.com",
      industry: "Digital health",
      size: "51-200",
      hqLocation: "Pune, India",
      logoText: "KH",
      brandColor: "#0d9488",
      verified: true,
      about:
        "Kettle makes the software that runs outpatient clinics — scheduling, records, billing, and the boring glue in between. Regulated, high-stakes, and genuinely useful. Our users are nurses, not growth-hackers.",
      createdAt: daysAgo(380),
    },
    {
      id: id("co"),
      name: "Ardent Retail",
      slug: "ardent-retail",
      website: "https://ardentretail.in",
      industry: "Retail technology",
      size: "1001-5000",
      hqLocation: "Gurugram, India",
      logoText: "AR",
      brandColor: "#c2410c",
      verified: true,
      about:
        "Ardent runs the commerce stack behind several hundred brands in India — catalog, pricing, warehouse, last mile. Big scale, messy real-world constraints, and a lot of interesting supply-chain problems.",
      createdAt: daysAgo(300),
    },
    {
      id: id("co"),
      name: "Fernpath Studio",
      slug: "fernpath-studio",
      website: "https://fernpath.design",
      industry: "Design & product studio",
      size: "1-50",
      hqLocation: "Remote (India)",
      logoText: "FP",
      brandColor: "#7c3aed",
      verified: true,
      about:
        "A twelve-person product studio. We take on four or five engagements a year and go deep on each. Fully remote since 2019, four-day weeks in December.",
      createdAt: daysAgo(200),
    },
    {
      id: id("co"),
      name: "Bellweather Analytics",
      slug: "bellweather-analytics",
      website: "https://bellweather.dev",
      industry: "Data & analytics",
      size: "51-200",
      hqLocation: "Hyderabad, India",
      logoText: "BW",
      brandColor: "#0369a1",
      verified: false,
      about:
        "Bellweather turns operational data into decisions for mid-market manufacturers. Newer to the platform — verification pending.",
      createdAt: daysAgo(40),
    },
  ];
  await db.insert(companies).values(companyRows).run();
  const [nimbus, kettle, ardent, fernpath, bellweather] = companyRows;

  /* -------------------------------------------------------------------------- */
  /* Users                                                                      */
  /* -------------------------------------------------------------------------- */

  type SeedUser = typeof users.$inferInsert;

  const admin: SeedUser = {
    id: id("u"),
    email: "admin@referin.app",
    passwordHash: PW_HASH,
    name: "Meera Iyer",
    role: "ADMIN",
    headline: "Platform admin at ReferIn",
    location: "Bengaluru, India",
    createdAt: daysAgo(430),
  };

  // --- Seekers ---------------------------------------------------------------
  const aisha: SeedUser = {
    id: id("u"),
    email: "aisha@example.com",
    passwordHash: PW_HASH,
    name: "Aisha Verma",
    role: "SEEKER",
    headline: "Frontend engineer, 4 yrs — React, TypeScript, design systems",
    location: "Bengaluru, India",
    skills: "React, TypeScript, Next.js, CSS, Design systems, Accessibility",
    experience: "4 years",
    bio: "I spent the last two years on a design system used by six product teams — component API design, accessibility audits, and the unglamorous migration work. Looking for a team that treats the frontend as a real engineering surface.",
    linkedinUrl: "https://linkedin.com/in/aishaverma",
    resumeUrl: "https://example.com/aisha-verma-resume.pdf",
    createdAt: daysAgo(60),
  };

  const dev: SeedUser = {
    id: id("u"),
    email: "dev@example.com",
    passwordHash: PW_HASH,
    name: "Dev Patel",
    role: "SEEKER",
    headline: "Backend engineer, 6 yrs — Go, Postgres, distributed systems",
    location: "Pune, India",
    skills: "Go, Postgres, Kubernetes, gRPC, Kafka, Distributed systems",
    experience: "6 years",
    bio: "Built and ran the billing pipeline at a payments company — the kind that cannot be down and cannot be wrong. Comfortable on-call, careful about migrations.",
    createdAt: daysAgo(45),
  };

  const sana: SeedUser = {
    id: id("u"),
    email: "sana@example.com",
    passwordHash: PW_HASH,
    name: "Sana Qureshi",
    role: "SEEKER",
    headline: "Product designer, 5 yrs — healthcare and complex tools",
    location: "Mumbai, India",
    skills: "Product design, Figma, User research, Design systems, Prototyping",
    experience: "5 years",
    bio: "I design for people who use software all day because it's their job, not because they enjoy it. Clinics, warehouses, back offices.",
    createdAt: daysAgo(30),
  };

  const karthik: SeedUser = {
    id: id("u"),
    email: "karthik@example.com",
    passwordHash: PW_HASH,
    name: "Karthik Nair",
    role: "SEEKER",
    headline: "Data engineer, 3 yrs — Python, dbt, Airflow",
    location: "Kochi, India",
    skills: "Python, SQL, dbt, Airflow, Snowflake, Data modelling",
    experience: "3 years",
    createdAt: daysAgo(20),
  };

  // --- Employees (referrers) -------------------------------------------------
  const rohan: SeedUser = {
    id: id("u"),
    email: "rohan@nimbus.io",
    passwordHash: PW_HASH,
    name: "Rohan Desai",
    role: "EMPLOYEE",
    headline: "Senior Backend Engineer at Nimbus Labs",
    location: "Bengaluru, India",
    createdAt: daysAgo(400),
  };

  const tara: SeedUser = {
    id: id("u"),
    email: "tara@nimbus.io",
    passwordHash: PW_HASH,
    name: "Tara Menon",
    role: "EMPLOYEE",
    headline: "Staff Frontend Engineer at Nimbus Labs",
    location: "Bengaluru, India",
    createdAt: daysAgo(350),
  };

  const imran: SeedUser = {
    id: id("u"),
    email: "imran@kettlehealth.com",
    passwordHash: PW_HASH,
    name: "Imran Shaikh",
    role: "EMPLOYEE",
    headline: "Engineering Manager at Kettle Health",
    location: "Pune, India",
    createdAt: daysAgo(320),
  };

  const nisha: SeedUser = {
    id: id("u"),
    email: "nisha@kettlehealth.com",
    passwordHash: PW_HASH,
    name: "Nisha Rao",
    role: "EMPLOYEE",
    headline: "Lead Product Designer at Kettle Health",
    location: "Pune, India",
    createdAt: daysAgo(280),
  };

  const vikram: SeedUser = {
    id: id("u"),
    email: "vikram@ardentretail.in",
    passwordHash: PW_HASH,
    name: "Vikram Sethi",
    role: "EMPLOYEE",
    headline: "Principal Engineer at Ardent Retail",
    location: "Gurugram, India",
    createdAt: daysAgo(260),
  };

  const leela: SeedUser = {
    id: id("u"),
    email: "leela@fernpath.design",
    passwordHash: PW_HASH,
    name: "Leela Krishnan",
    role: "EMPLOYEE",
    headline: "Founding Designer at Fernpath Studio",
    location: "Remote, India",
    createdAt: daysAgo(190),
  };

  const arjun: SeedUser = {
    id: id("u"),
    email: "arjun@bellweather.dev",
    passwordHash: PW_HASH,
    name: "Arjun Bhat",
    role: "EMPLOYEE",
    headline: "Data Platform Lead at Bellweather Analytics",
    location: "Hyderabad, India",
    createdAt: daysAgo(35),
  };

  // --- Recruiters ------------------------------------------------------------
  const priya: SeedUser = {
    id: id("u"),
    email: "priya@nimbus.io",
    passwordHash: PW_HASH,
    name: "Priya Kulkarni",
    role: "RECRUITER",
    headline: "Talent Lead at Nimbus Labs",
    location: "Bengaluru, India",
    createdAt: daysAgo(390),
  };

  const farah: SeedUser = {
    id: id("u"),
    email: "farah@kettlehealth.com",
    passwordHash: PW_HASH,
    name: "Farah Ansari",
    role: "RECRUITER",
    headline: "Head of Talent at Kettle Health",
    location: "Pune, India",
    createdAt: daysAgo(300),
  };

  const sameer: SeedUser = {
    id: id("u"),
    email: "sameer@ardentretail.in",
    passwordHash: PW_HASH,
    name: "Sameer Joshi",
    role: "RECRUITER",
    headline: "Technical Recruiter at Ardent Retail",
    location: "Gurugram, India",
    createdAt: daysAgo(240),
  };

  const allUsers = [
    admin, aisha, dev, sana, karthik,
    rohan, tara, imran, nisha, vikram, leela, arjun,
    priya, farah, sameer,
  ];
  await db.insert(users).values(allUsers).run();

  /* -------------------------------------------------------------------------- */
  /* Company members                                                            */
  /* -------------------------------------------------------------------------- */

  await db.insert(companyMembers)
    .values([
      { id: id("m"), userId: rohan.id!, companyId: nimbus!.id, title: "Senior Backend Engineer", department: "Platform", yearsAtCo: 3, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(400) },
      { id: id("m"), userId: tara.id!, companyId: nimbus!.id, title: "Staff Frontend Engineer", department: "Product Engineering", yearsAtCo: 4, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(350) },
      { id: id("m"), userId: priya.id!, companyId: nimbus!.id, title: "Talent Lead", department: "People", yearsAtCo: 2, isRecruiter: true, openToRefer: false, verified: true, createdAt: daysAgo(390) },

      { id: id("m"), userId: imran.id!, companyId: kettle!.id, title: "Engineering Manager", department: "Clinical Platform", yearsAtCo: 3, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(320) },
      { id: id("m"), userId: nisha.id!, companyId: kettle!.id, title: "Lead Product Designer", department: "Design", yearsAtCo: 2, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(280) },
      { id: id("m"), userId: farah.id!, companyId: kettle!.id, title: "Head of Talent", department: "People", yearsAtCo: 3, isRecruiter: true, openToRefer: false, verified: true, createdAt: daysAgo(300) },

      { id: id("m"), userId: vikram.id!, companyId: ardent!.id, title: "Principal Engineer", department: "Supply Chain", yearsAtCo: 5, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(260) },
      { id: id("m"), userId: sameer.id!, companyId: ardent!.id, title: "Technical Recruiter", department: "People", yearsAtCo: 2, isRecruiter: true, openToRefer: false, verified: true, createdAt: daysAgo(240) },

      { id: id("m"), userId: leela.id!, companyId: fernpath!.id, title: "Founding Designer", department: "Studio", yearsAtCo: 5, isRecruiter: false, openToRefer: true, verified: true, createdAt: daysAgo(190) },

      // Bellweather is unverified — so is its one member. Shows the admin queue.
      { id: id("m"), userId: arjun.id!, companyId: bellweather!.id, title: "Data Platform Lead", department: "Engineering", yearsAtCo: 1, isRecruiter: false, openToRefer: true, verified: false, createdAt: daysAgo(35) },
    ])
    .run();

  /* -------------------------------------------------------------------------- */
  /* Jobs                                                                       */
  /* -------------------------------------------------------------------------- */

  type SeedJob = typeof jobs.$inferInsert;

  const jobRows: SeedJob[] = [
    {
      id: id("j"),
      companyId: nimbus!.id,
      postedById: priya.id!,
      title: "Senior Frontend Engineer",
      department: "Product Engineering",
      location: "Bengaluru, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 4,
      experienceMax: 8,
      salaryMin: 32,
      salaryMax: 48,
      currency: "INR",
      skills: "React, TypeScript, Next.js, Design systems, Accessibility",
      openings: 2,
      status: "OPEN",
      createdAt: daysAgo(12),
      description: `We're rebuilding the Nimbus console — the thing engineers stare at when a deploy is going sideways. It needs to be fast, legible, and honest about what's happening.

  What you'll do
  - Own significant surfaces of the console end to end, from data fetching to the last pixel
  - Push our design system forward — it's real, it's used, and it needs a stronger hand
  - Work directly with the platform team; you'll read a lot of API design docs
  - Care about accessibility as an engineering requirement, not a checklist

  What we're looking for
  - 4+ years building product frontends, ideally on a complex tool rather than a marketing site
  - Strong React and TypeScript; opinions about state management you can defend
  - You've maintained a component library that other teams depended on
  - Comfort with performance work: profiling, bundle budgets, render costs

  Interview process: an intro call, a two-hour paired working session on real code, and a conversation with two engineers you'd work with. Three steps, no take-home.`,
    },
    {
      id: id("j"),
      companyId: nimbus!.id,
      postedById: priya.id!,
      title: "Backend Engineer — Platform",
      department: "Platform",
      location: "Bengaluru, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 3,
      experienceMax: 7,
      salaryMin: 30,
      salaryMax: 45,
      currency: "INR",
      skills: "Go, Postgres, Kubernetes, gRPC, Distributed systems",
      openings: 3,
      status: "OPEN",
      createdAt: daysAgo(18),
      description: `The platform team owns the scheduler, the build pipeline and the control plane. Everything that makes a push turn into a running service.

  What you'll do
  - Design and run services where correctness under failure is the whole job
  - Take on-call for systems you built — we keep the rotation humane and the runbooks honest
  - Do the migration work properly; we don't ship half-cutovers and leave them

  What we're looking for
  - 3+ years of backend work in Go, Rust, Java or similar
  - Real experience with Postgres beyond ORM defaults — you've tuned a query plan
  - You've operated something in production and learned from it breaking

  Interview process: intro call, systems design conversation, and a code review exercise on our actual codebase.`,
    },
    {
      id: id("j"),
      companyId: nimbus!.id,
      postedById: priya.id!,
      title: "Site Reliability Engineer",
      department: "Platform",
      location: "Bengaluru, India",
      workMode: "ONSITE",
      employment: "FULL_TIME",
      experienceMin: 5,
      experienceMax: 10,
      salaryMin: 38,
      salaryMax: 55,
      currency: "INR",
      skills: "Kubernetes, Terraform, Prometheus, Linux, Incident response",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(6),
      description: `We run a lot of other people's workloads. This role is about keeping that boring.

  What you'll do
  - Own observability: metrics that mean something, alerts that fire for reasons
  - Lead incident response and write the postmortems people actually read
  - Drive capacity planning ahead of the growth curve rather than behind it

  What we're looking for
  - 5+ years in SRE, infrastructure or platform operations
  - Deep Kubernetes and Linux; Terraform or equivalent IaC in anger
  - The temperament for 3am — calm, methodical, writes things down`,
    },
    {
      id: id("j"),
      companyId: kettle!.id,
      postedById: farah.id!,
      title: "Full-stack Engineer — Clinical Platform",
      department: "Clinical Platform",
      location: "Pune, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 3,
      experienceMax: 6,
      salaryMin: 24,
      salaryMax: 38,
      currency: "INR",
      skills: "TypeScript, Node, React, Postgres, HL7/FHIR",
      openings: 2,
      status: "OPEN",
      createdAt: daysAgo(9),
      description: `You'll work on the software a nurse touches forty times a shift. Small friction compounds into real harm here, so we take interaction cost seriously.

  What you'll do
  - Build features across the stack — TypeScript on both ends, Postgres underneath
  - Work inside regulatory constraints (audit trails, data retention, access control) without letting them become an excuse for bad software
  - Sit in on clinic visits; everyone here does, twice a year

  What we're looking for
  - 3+ years full-stack, comfortable owning a feature from schema to screen
  - Care about correctness — this is not a domain where you ship and see
  - Healthcare experience is welcome but not required; curiosity about it is`,
    },
    {
      id: id("j"),
      companyId: kettle!.id,
      postedById: farah.id!,
      title: "Product Designer",
      department: "Design",
      location: "Pune, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 4,
      experienceMax: 8,
      salaryMin: 26,
      salaryMax: 40,
      currency: "INR",
      skills: "Product design, User research, Figma, Design systems, Healthcare",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(15),
      description: `Design for clinicians. High-density interfaces, high stakes, users who cannot afford to think about your interface.

  What you'll do
  - Own end-to-end design for a product area: research, flows, interface, and the rollout
  - Run real research — clinic observation, shadowing, not just five-user Zoom calls
  - Extend our design system for genuinely dense data interfaces

  What we're looking for
  - 4+ years in product design, ideally on tools rather than consumer apps
  - A portfolio that shows constraint and rigour more than visual flourish
  - You can defend a design decision with evidence`,
    },
    {
      id: id("j"),
      companyId: kettle!.id,
      postedById: farah.id!,
      title: "QA Automation Engineer",
      department: "Quality",
      location: "Pune, India",
      workMode: "REMOTE",
      employment: "FULL_TIME",
      experienceMin: 2,
      experienceMax: 5,
      salaryMin: 16,
      salaryMax: 26,
      currency: "INR",
      skills: "Playwright, TypeScript, Test strategy, CI/CD",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(25),
      description: `Our test suite is the reason we can ship weekly into a regulated environment. This role owns it.

  What you'll do
  - Grow and maintain the end-to-end suite in Playwright
  - Make the CI signal trustworthy — flaky tests get fixed or deleted, never muted
  - Partner with engineers on testability at design time`,
    },
    {
      id: id("j"),
      companyId: ardent!.id,
      postedById: sameer.id!,
      title: "Staff Engineer — Supply Chain",
      department: "Supply Chain",
      location: "Gurugram, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 8,
      experienceMax: 14,
      salaryMin: 55,
      salaryMax: 80,
      currency: "INR",
      skills: "Java, Kafka, Distributed systems, Systems design, Mentoring",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(21),
      description: `Ardent moves several hundred thousand orders a day across a warehouse network that was not designed by anyone in particular. This role is about imposing sense on it.

  What you'll do
  - Set technical direction for order orchestration and inventory allocation
  - Mentor a group of senior engineers; multiply rather than out-produce
  - Own the hardest correctness problems — double-allocation, partial failure, reconciliation

  What we're looking for
  - 8+ years, with real distributed systems depth
  - You've been the person who owned a system through a peak season
  - Written communication that holds up — you'll write a lot of design docs`,
    },
    {
      id: id("j"),
      companyId: ardent!.id,
      postedById: sameer.id!,
      title: "Data Engineer",
      department: "Data",
      location: "Gurugram, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 2,
      experienceMax: 5,
      salaryMin: 18,
      salaryMax: 30,
      currency: "INR",
      skills: "Python, SQL, dbt, Airflow, Data modelling, Snowflake",
      openings: 2,
      status: "OPEN",
      createdAt: daysAgo(4),
      description: `The data team is small and the surface is large. You'll own pipelines that pricing and planning depend on daily.

  What you'll do
  - Build and maintain batch pipelines in Airflow and dbt
  - Model the warehouse properly — the current one has grown by accretion
  - Work with analysts closely enough that you know what they actually need

  What we're looking for
  - 2+ years in data engineering, strong SQL
  - dbt and Airflow in production, not just tutorials
  - Comfort with ambiguity in source data, which is most of the job`,
    },
    {
      id: id("j"),
      companyId: ardent!.id,
      postedById: sameer.id!,
      title: "Android Engineer",
      department: "Consumer",
      location: "Bengaluru, India",
      workMode: "REMOTE",
      employment: "FULL_TIME",
      experienceMin: 3,
      experienceMax: 7,
      salaryMin: 25,
      salaryMax: 42,
      currency: "INR",
      skills: "Kotlin, Jetpack Compose, Android, Offline-first",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(30),
      description: `The Ardent delivery app runs on cheap phones on bad networks in places with no signal. Offline-first is not a feature here, it's the premise.

  What you'll do
  - Own significant parts of the delivery partner app
  - Make sync reliable under genuinely hostile network conditions
  - Keep the APK small and the cold start fast — both are business metrics for us`,
    },
    {
      id: id("j"),
      companyId: fernpath!.id,
      postedById: leela.id!,
      title: "Senior Product Designer (Contract)",
      department: "Studio",
      location: "Remote (India)",
      workMode: "REMOTE",
      employment: "CONTRACT",
      experienceMin: 5,
      experienceMax: 12,
      salaryMin: 30,
      salaryMax: 45,
      currency: "INR",
      skills: "Product design, Figma, Prototyping, Client work, Workshops",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(8),
      description: `A six-month engagement with an option to extend. You'd lead design on one client project — a B2B scheduling tool being rebuilt from scratch.

  What you'll do
  - Own the design of a product from research through to shipped interface
  - Run workshops with the client's team; a lot of this job is facilitation
  - Work with two engineers and one other designer

  What we're looking for
  - 5+ years, with at least one project you took from nothing to launched
  - Client-facing confidence — you'll present to executives
  - Fully remote, but overlapping hours with IST`,
    },
    {
      id: id("j"),
      companyId: fernpath!.id,
      postedById: leela.id!,
      title: "Frontend Engineer",
      department: "Studio",
      location: "Remote (India)",
      workMode: "REMOTE",
      employment: "FULL_TIME",
      experienceMin: 2,
      experienceMax: 6,
      salaryMin: 20,
      salaryMax: 34,
      currency: "INR",
      skills: "React, TypeScript, CSS, Animation, Accessibility",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(35),
      description: `Twelve people, four projects a year, fully remote. You'd be the third engineer.

  What you'll do
  - Build client products from design files that are unusually complete
  - Care about the craft layer: motion, focus states, the small stuff
  - Talk to clients directly — we don't have account managers

  What we're looking for
  - 2+ years of React and TypeScript
  - A genuine eye; you notice when something is two pixels off and it bothers you
  - Self-direction, because remote studio work rewards it`,
    },
    {
      id: id("j"),
      companyId: bellweather!.id,
      postedById: arjun.id!,
      title: "Analytics Engineer",
      department: "Engineering",
      location: "Hyderabad, India",
      workMode: "HYBRID",
      employment: "FULL_TIME",
      experienceMin: 2,
      experienceMax: 6,
      salaryMin: 18,
      salaryMax: 32,
      currency: "INR",
      skills: "SQL, dbt, Python, Data modelling, BI",
      openings: 1,
      status: "OPEN",
      createdAt: daysAgo(14),
      description: `Bellweather turns factory-floor data into decisions. This role sits between the raw pipelines and the people making calls on them.

  What you'll do
  - Model messy operational data into something analysts can trust
  - Own the semantic layer and the metric definitions behind it
  - Work directly with customer teams — manufacturers, not tech companies`,
    },
    // A closed role, so the manage view has something non-open in it.
    {
      id: id("j"),
      companyId: nimbus!.id,
      postedById: priya.id!,
      title: "Technical Writer",
      department: "Product Engineering",
      location: "Bengaluru, India",
      workMode: "REMOTE",
      employment: "FULL_TIME",
      experienceMin: 3,
      experienceMax: 8,
      salaryMin: 20,
      salaryMax: 32,
      currency: "INR",
      skills: "Technical writing, Documentation, Developer experience",
      openings: 1,
      status: "CLOSED",
      createdAt: daysAgo(70),
      description: `Filled — kept here so you can see what a closed posting looks like in the manage view.

  We were looking for someone to own the Nimbus docs end to end: reference, guides, and the getting-started path that determines whether a developer stays.`,
    },
  ];
  await db.insert(jobs).values(jobRows).run();

  const jobBy = (title: string) => jobRows.find((j) => j.title === title)!;

  /* -------------------------------------------------------------------------- */
  /* Referrals — one at each stage, with real timelines                         */
  /* -------------------------------------------------------------------------- */

  type Stage = {
    job: SeedJob;
    seeker: SeedUser;
    referrer: SeedUser;
    status: string;
    message: string;
    events: { from: string | null; to: string; by: SeedUser; note?: string; day: number }[];
  };

  const stages: Stage[] = [
    // 1. REQUESTED — waiting on Tara
    {
      job: jobBy("Senior Frontend Engineer"),
      seeker: aisha,
      referrer: tara,
      status: "REQUESTED",
      message:
        "Hi Tara — I saw the Senior Frontend role. I've spent the last two years owning a design system across six product teams, including an accessibility overhaul that took us from a failing audit to WCAG AA. The console rebuild is exactly the kind of work I want to be doing. Happy to walk you through the migration if useful.",
      events: [{ from: null, to: "REQUESTED", by: aisha, day: 3 }],
    },
    // 2. ACCEPTED — Rohan said yes, not yet submitted
    {
      job: jobBy("Backend Engineer — Platform"),
      seeker: dev,
      referrer: rohan,
      status: "ACCEPTED",
      message:
        "Hi Rohan — 6 years backend, mostly Go and Postgres. I ran the billing pipeline at my last company: the one that can't be down and can't be wrong. I've done the on-call and the 2am migrations. Would love a shot at the platform team.",
      events: [
        { from: null, to: "REQUESTED", by: dev, day: 9 },
        {
          from: "REQUESTED",
          to: "ACCEPTED",
          by: rohan,
          note: "Billing pipeline experience is directly relevant to what we're doing with the scheduler. Happy to refer — putting it through this week.",
          day: 8,
        },
      ],
    },
    // 3. REFERRED — submitted internally
    {
      job: jobBy("Product Designer"),
      seeker: sana,
      referrer: nisha,
      status: "REFERRED",
      message:
        "Hi Nisha — I've been designing for clinical and back-office users for five years. Most recently a scheduling tool for a hospital group; I sat in on 30+ hours of clinic observation for it. Kettle's approach to research is why I'm applying here specifically.",
      events: [
        { from: null, to: "REQUESTED", by: sana, day: 16 },
        {
          from: "REQUESTED",
          to: "ACCEPTED",
          by: nisha,
          note: "Portfolio is strong and the clinic observation work is exactly the instinct we hire for.",
          day: 15,
        },
        {
          from: "ACCEPTED",
          to: "REFERRED",
          by: nisha,
          note: "Submitted through the internal portal — req KH-2214. Farah has it.",
          day: 13,
        },
      ],
    },
    // 4. INTERVIEWING
    {
      job: jobBy("Data Engineer"),
      seeker: karthik,
      referrer: vikram,
      status: "INTERVIEWING",
      message:
        "Hi Vikram — 3 years in data engineering, dbt and Airflow in production at a logistics company. I've dealt with the kind of source data that changes shape without warning. Interested in the Ardent scale.",
      events: [
        { from: null, to: "REQUESTED", by: karthik, day: 22 },
        { from: "REQUESTED", to: "ACCEPTED", by: vikram, note: "Good fit for the modelling work. Referring.", day: 21 },
        { from: "ACCEPTED", to: "REFERRED", by: vikram, note: "Submitted — req AR-8890.", day: 20 },
        {
          from: "REFERRED",
          to: "INTERVIEWING",
          by: sameer,
          note: "Screen went well. Technical round scheduled for Thursday with the data team.",
          day: 11,
        },
      ],
    },
    // 5. HIRED — the success story
    {
      job: jobBy("Frontend Engineer"),
      seeker: aisha,
      referrer: leela,
      status: "HIRED",
      message:
        "Hi Leela — Fernpath's work has been on my radar for a while. I'm a frontend engineer with a design systems background and I care about the craft layer more than is probably reasonable. Would love to talk about the studio model.",
      events: [
        { from: null, to: "REQUESTED", by: aisha, day: 48 },
        { from: "REQUESTED", to: "ACCEPTED", by: leela, note: "Portfolio and the accessibility work sold me. Referring today.", day: 47 },
        { from: "ACCEPTED", to: "REFERRED", by: leela, note: "Passed to the team with a strong note.", day: 46 },
        { from: "REFERRED", to: "INTERVIEWING", by: leela, note: "Two conversations scheduled — one with me, one with the engineers.", day: 38 },
        {
          from: "INTERVIEWING",
          to: "HIRED",
          by: leela,
          note: "Offer out and accepted. Starting next month. Thanks for the referral — this one worked.",
          day: 30,
        },
      ],
    },
    // 6. REJECTED — didn't work out downstream
    {
      job: jobBy("Staff Engineer — Supply Chain"),
      seeker: dev,
      referrer: vikram,
      status: "REJECTED",
      message:
        "Hi Vikram — I know the Staff role wants 8+ and I'm at 6, but my last three years have been heavily distributed-systems weighted and I've owned a system through two peak seasons. Worth a conversation?",
      events: [
        { from: null, to: "REQUESTED", by: dev, day: 40 },
        { from: "REQUESTED", to: "ACCEPTED", by: vikram, note: "Slightly under on years but the depth is there. Worth putting forward.", day: 39 },
        { from: "ACCEPTED", to: "REFERRED", by: vikram, day: 38 },
        {
          from: "REFERRED",
          to: "REJECTED",
          by: sameer,
          note: "Hiring committee wants more scope experience at the staff level for this particular req. Strong candidate though — we'd like to keep him in mind for the senior backend role opening next quarter.",
          day: 33,
        },
      ],
    },
    // 7. DECLINED — referrer couldn't help
    {
      job: jobBy("Full-stack Engineer — Clinical Platform"),
      seeker: karthik,
      referrer: imran,
      status: "DECLINED",
      message:
        "Hi Imran — I'm a data engineer but I've done full-stack work at a previous role and I'm keen to move back toward product. Would you consider referring me for the clinical platform role?",
      events: [
        { from: null, to: "REQUESTED", by: karthik, day: 26 },
        {
          from: "REQUESTED",
          to: "DECLINED",
          by: imran,
          note: "I can only refer people whose work I can speak to directly, and I'd be guessing on the full-stack side here. Not a judgment on your ability — apply directly and mention you spoke to me. The data engineering roles at Ardent look like a better match right now.",
          day: 25,
        },
      ],
    },
    // 8. Another REQUESTED, so the inbox has more than one
    {
      job: jobBy("Senior Frontend Engineer"),
      seeker: sana,
      referrer: tara,
      status: "REQUESTED",
      message:
        "Hi Tara — I'm primarily a designer but I write production React and have shipped design-system code. I know that's an unusual profile for this role; happy to be told it's not a fit. Wanted to ask rather than wonder.",
      events: [{ from: null, to: "REQUESTED", by: sana, day: 1 }],
    },
    // 9. ACCEPTED at Kettle, so Imran's inbox isn't only declines
    {
      job: jobBy("QA Automation Engineer"),
      seeker: karthik,
      referrer: imran,
      status: "ACCEPTED",
      message:
        "Hi Imran — following up on the earlier conversation. I've done a fair bit of Playwright work building the test suite for our internal data tooling. This one feels like a much better match for what I can actually show you.",
      events: [
        { from: null, to: "REQUESTED", by: karthik, day: 7 },
        {
          from: "REQUESTED",
          to: "ACCEPTED",
          by: imran,
          note: "Much better fit — and I appreciate you taking the earlier note well. Referring this one.",
          day: 5,
        },
      ],
    },
  ];

  for (const s of stages) {
    const refId = id("r");
    const first = s.events[0]!;
    const last = s.events[s.events.length - 1]!;

    await db.insert(referrals)
      .values({
        id: refId,
        jobId: s.job.id!,
        seekerId: s.seeker.id!,
        referrerId: s.referrer.id!,
        status: s.status,
        message: s.message,
        resumeUrl: s.seeker.resumeUrl ?? null,
        createdAt: daysAgo(first.day),
        updatedAt: daysAgo(last.day),
      })
      .run();

    for (const e of s.events) {
      await db.insert(referralEvents)
        .values({
          id: id("e"),
          referralId: refId,
          actorId: e.by.id!,
          fromStatus: e.from,
          toStatus: e.to,
          note: e.note ?? (e.from === null ? s.message : null),
          createdAt: daysAgo(e.day),
        })
        .run();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Notifications                                                              */
  /* -------------------------------------------------------------------------- */

  const allReferrals = await db.select().from(referrals).all();
  const refFor = (seekerEmail: string, jobTitle: string) => {
    const seeker = allUsers.find((u) => u.email === seekerEmail)!;
    const job = jobBy(jobTitle);
    return allReferrals.find((r) => r.seekerId === seeker.id && r.jobId === job.id)!;
  };

  await db.insert(notifications)
    .values([
      {
        id: id("n"),
        userId: tara.id!,
        title: "Aisha Verma asked you for a referral",
        body: "Senior Frontend Engineer — take a look and accept or decline.",
        link: `/referrals/${refFor("aisha@example.com", "Senior Frontend Engineer").id}`,
        read: false,
        createdAt: daysAgo(3),
      },
      {
        id: id("n"),
        userId: tara.id!,
        title: "Sana Qureshi asked you for a referral",
        body: "Senior Frontend Engineer — take a look and accept or decline.",
        link: `/referrals/${refFor("sana@example.com", "Senior Frontend Engineer").id}`,
        read: false,
        createdAt: daysAgo(1),
      },
      {
        id: id("n"),
        userId: aisha.id!,
        title: 'Your referral is now "Hired"',
        body: "Frontend Engineer — updated by Leela Krishnan.",
        link: `/referrals/${refFor("aisha@example.com", "Frontend Engineer").id}`,
        read: true,
        createdAt: daysAgo(30),
      },
      {
        id: id("n"),
        userId: karthik.id!,
        title: 'Your referral is now "Interviewing"',
        body: "Data Engineer — updated by Sameer Joshi.",
        link: `/referrals/${refFor("karthik@example.com", "Data Engineer").id}`,
        read: false,
        createdAt: daysAgo(11),
      },
      {
        id: id("n"),
        userId: karthik.id!,
        title: 'Your referral is now "Accepted"',
        body: "QA Automation Engineer — updated by Imran Shaikh.",
        link: `/referrals/${refFor("karthik@example.com", "QA Automation Engineer").id}`,
        read: false,
        createdAt: daysAgo(5),
      },
      {
        id: id("n"),
        userId: dev.id!,
        title: 'Your referral is now "Accepted"',
        body: "Backend Engineer — Platform — updated by Rohan Desai.",
        link: `/referrals/${refFor("dev@example.com", "Backend Engineer — Platform").id}`,
        read: false,
        createdAt: daysAgo(8),
      },
      {
        id: id("n"),
        userId: sana.id!,
        title: 'Your referral is now "Referred"',
        body: "Product Designer — updated by Nisha Rao.",
        link: `/referrals/${refFor("sana@example.com", "Product Designer").id}`,
        read: false,
        createdAt: daysAgo(13),
      },
    ])
    .run();

  /* -------------------------------------------------------------------------- */

  console.log(`
  Seed complete.

    ${companyRows.length} companies
    ${jobRows.length} job postings
    ${allUsers.length} users
    ${stages.length} referrals across every pipeline stage

  Sign in with any of these (password: ${PASSWORD})

    aisha@example.com          Job seeker — referrals at 4 different stages, incl. a hire
    dev@example.com            Job seeker — one accepted, one rejected
    sana@example.com           Job seeker — one referred, one pending
    karthik@example.com        Job seeker — interviewing, accepted, and a decline

    rohan@nimbus.io            Employee at Nimbus — referrer
    tara@nimbus.io             Employee at Nimbus — TWO requests waiting on her
    imran@kettlehealth.com     Employee at Kettle Health — referrer
    nisha@kettlehealth.com     Employee at Kettle Health — referrer
    vikram@ardentretail.in     Employee at Ardent — referrer
    leela@fernpath.design      Employee at Fernpath — made a successful hire
    arjun@bellweather.dev      Employee at Bellweather — unverified, in admin queue

    priya@nimbus.io            Recruiter at Nimbus Labs
    farah@kettlehealth.com     Recruiter at Kettle Health
    sameer@ardentretail.in     Recruiter at Ardent Retail

    admin@referin.app          Platform admin
  `);



}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error(err);
    client.close();
    process.exit(1);
  });