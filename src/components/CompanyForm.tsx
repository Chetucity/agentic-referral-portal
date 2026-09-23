"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCompany, type ActionState } from "@/app/actions/jobs";
import { Alert } from "@/components/ui";
import { COMPANY_SIZES } from "@/lib/constants";

type CompanyInitial = {
  website: string | null;
  industry: string | null;
  size: string | null;
  hqLocation: string | null;
  about: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save company profile"}
    </button>
  );
}

export function CompanyForm({ initial }: { initial: CompanyInitial }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCompany,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}

      <fieldset className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="website">Website</label>
            <input id="website" name="website" defaultValue={initial.website ?? ""} className="input" placeholder="https://example.com" />
          </div>
          <div>
            <label className="label" htmlFor="industry">Industry</label>
            <input id="industry" name="industry" defaultValue={initial.industry ?? ""} className="input" placeholder="Cloud infrastructure" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="size">Company size</label>
            <select id="size" name="size" defaultValue={initial.size ?? ""} className="input">
              <option value="">Not specified</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hqLocation">Headquarters</label>
            <input id="hqLocation" name="hqLocation" defaultValue={initial.hqLocation ?? ""} className="input" placeholder="Bengaluru, India" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="about">About</label>
          <textarea
            id="about"
            name="about"
            rows={5}
            defaultValue={initial.about ?? ""}
            className="input resize-y"
            placeholder="What the company does, and what it's like to work there."
          />
        </div>
      </fieldset>

      <Submit />
    </form>
  );
}
