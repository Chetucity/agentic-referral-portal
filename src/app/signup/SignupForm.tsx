"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signup, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui";
import { COMPANY_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type RoleOption = { value: string; label: string; blurb: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignupForm({
  initialRole,
  roles,
}: {
  initialRole: string;
  roles: RoleOption[];
}) {
  const [state, action] = useActionState<FormState, FormData>(signup, null);
  const [role, setRole] = useState(initialRole);
  const needsCompany = role === "EMPLOYEE" || role === "RECRUITER";

  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      {/* Role picker ------------------------------------------------------ */}
      <fieldset className="card p-5">
        <legend className="sr-only">I am a</legend>
        <div className="mb-3 text-sm font-semibold text-slate-800">I am a…</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((r) => (
            <label
              key={r.value}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-colors",
                role === r.value
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="sr-only"
              />
              <div className="text-sm font-medium text-slate-900">{r.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{r.blurb}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Account ---------------------------------------------------------- */}
      <fieldset className="card space-y-4 p-5">
        <div className="text-sm font-semibold text-slate-800">Your details</div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" name="name" required className="input" placeholder="Aisha Verma" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" />
            {needsCompany && (
              <p className="hint">Use your work email — it speeds up verification.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" name="location" className="input" placeholder="Bengaluru, India" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="headline">Headline</label>
          <input
            id="headline"
            name="headline"
            className="input"
            placeholder={
              role === "SEEKER"
                ? "Frontend engineer, 3 yrs — React & TypeScript"
                : "Senior Engineer at …"
            }
          />
        </div>

        {role === "SEEKER" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="skills">Skills</label>
              <input id="skills" name="skills" className="input" placeholder="React, TypeScript, Node" />
              <p className="hint">Comma separated.</p>
            </div>
            <div>
              <label className="label" htmlFor="experience">Experience</label>
              <input id="experience" name="experience" className="input" placeholder="3 years" />
            </div>
          </div>
        )}
      </fieldset>

      {/* Company ---------------------------------------------------------- */}
      {needsCompany && (
        <fieldset className="card space-y-4 p-5">
          <div>
            <div className="text-sm font-semibold text-slate-800">Your company</div>
            <p className="mt-0.5 text-xs text-slate-500">
              If the company already exists you&apos;ll be added to it. Otherwise
              we create it and an admin verifies it later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="companyName">Company name</label>
              <input id="companyName" name="companyName" required className="input" placeholder="Nimbus Labs" />
            </div>
            <div>
              <label className="label" htmlFor="jobTitle">Your title there</label>
              <input id="jobTitle" name="jobTitle" className="input" placeholder="Senior Backend Engineer" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="companyWebsite">Website</label>
              <input id="companyWebsite" name="companyWebsite" className="input" placeholder="https://nimbus.io" />
            </div>
            <div>
              <label className="label" htmlFor="companyIndustry">Industry</label>
              <input id="companyIndustry" name="companyIndustry" className="input" placeholder="Cloud infrastructure" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="companySize">Company size</label>
              <select id="companySize" name="companySize" className="input" defaultValue="">
                <option value="">Select…</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>{s} employees</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="companyLocation">Headquarters</label>
              <input id="companyLocation" name="companyLocation" className="input" placeholder="Bengaluru, India" />
            </div>
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <Submit />
        <p className="text-xs text-slate-500">
          By continuing you agree this is a demo app and not real employment advice.
        </p>
      </div>
    </form>
  );
}
