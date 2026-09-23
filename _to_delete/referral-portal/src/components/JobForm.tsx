"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createJob, updateJob, type ActionState } from "@/app/actions/jobs";
import { Alert } from "@/components/ui";
import {
  WORK_MODES,
  WORK_MODE_LABEL,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_LABEL,
  JOB_STATUSES,
  JOB_STATUS_LABEL,
} from "@/lib/constants";

export type JobFormValues = {
  id?: string;
  title?: string;
  department?: string | null;
  location?: string | null;
  workMode?: string | null;
  employment?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  skills?: string | null;
  description?: string;
  openings?: number;
  status?: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function JobForm({
  mode,
  initial = {},
  companyName,
}: {
  mode: "create" | "edit";
  initial?: JobFormValues;
  companyName: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    mode === "create" ? createJob : updateJob,
    null,
  );

  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      {initial.id && <input type="hidden" name="jobId" value={initial.id} />}

      <fieldset className="card space-y-4 p-5">
        <div className="text-sm font-semibold text-slate-800">
          The role at {companyName}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Job title</label>
            <input id="title" name="title" required defaultValue={initial.title ?? ""} className="input" placeholder="Senior Frontend Engineer" />
          </div>
          <div>
            <label className="label" htmlFor="department">Team / department</label>
            <input id="department" name="department" defaultValue={initial.department ?? ""} className="input" placeholder="Platform" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" name="location" defaultValue={initial.location ?? ""} className="input" placeholder="Bengaluru, India" />
          </div>
          <div>
            <label className="label" htmlFor="workMode">Work mode</label>
            <select id="workMode" name="workMode" defaultValue={initial.workMode ?? ""} className="input">
              <option value="">Not specified</option>
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>{WORK_MODE_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="employment">Employment type</label>
            <select id="employment" name="employment" defaultValue={initial.employment ?? ""} className="input">
              <option value="">Not specified</option>
              {EMPLOYMENT_TYPES.map((e) => (
                <option key={e} value={e}>{EMPLOYMENT_LABEL[e]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="openings">Number of openings</label>
            <input id="openings" name="openings" type="number" min={1} defaultValue={initial.openings ?? 1} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="experienceMin">Experience min (yrs)</label>
            <input id="experienceMin" name="experienceMin" type="number" min={0} defaultValue={initial.experienceMin ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="experienceMax">Experience max (yrs)</label>
            <input id="experienceMax" name="experienceMax" type="number" min={0} defaultValue={initial.experienceMax ?? ""} className="input" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue={initial.currency ?? "INR"} className="input">
              <option value="INR">INR (LPA)</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="salaryMin">Salary min</label>
            <input id="salaryMin" name="salaryMin" type="number" min={0} defaultValue={initial.salaryMin ?? ""} className="input" placeholder="18" />
          </div>
          <div>
            <label className="label" htmlFor="salaryMax">Salary max</label>
            <input id="salaryMax" name="salaryMax" type="number" min={0} defaultValue={initial.salaryMax ?? ""} className="input" placeholder="28" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="skills">Skills</label>
          <input id="skills" name="skills" defaultValue={initial.skills ?? ""} className="input" placeholder="React, TypeScript, GraphQL" />
          <p className="hint">Comma separated. These drive search and matching.</p>
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            rows={10}
            required
            defaultValue={initial.description ?? ""}
            className="input resize-y font-mono text-[13px]"
            placeholder={"What the team does, what you'll build, and what you need to have done before.\n\nStart a line with \"- \" for a bullet."}
          />
        </div>

        {mode === "edit" && (
          <div className="sm:w-48">
            <label className="label" htmlFor="status">Posting status</label>
            <select id="status" name="status" defaultValue={initial.status ?? "OPEN"} className="input">
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Submit label={mode === "create" ? "Publish opening" : "Save changes"} />
        <Link href="/recruiter/jobs" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
