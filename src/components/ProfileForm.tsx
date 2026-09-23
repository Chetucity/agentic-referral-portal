"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

type Initial = {
  name: string;
  headline: string | null;
  location: string | null;
  skills: string | null;
  experience: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  resumeUrl: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function ProfileForm({
  initial,
  showSeekerFields,
}: {
  initial: Initial;
  showSeekerFields: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Profile saved.</Alert>}

      <fieldset className="card space-y-4 p-5">
        <div className="text-sm font-semibold text-slate-800">Details</div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" name="name" required defaultValue={initial.name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" name="location" defaultValue={initial.location ?? ""} className="input" placeholder="Bengaluru, India" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="headline">Headline</label>
          <input id="headline" name="headline" defaultValue={initial.headline ?? ""} className="input" placeholder="Frontend engineer, 3 yrs — React & TypeScript" />
          <p className="hint">This is the one line referrers see first.</p>
        </div>

        {showSeekerFields && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="skills">Skills</label>
              <input id="skills" name="skills" defaultValue={initial.skills ?? ""} className="input" placeholder="React, TypeScript, Node" />
              <p className="hint">Comma separated — used to match you to openings.</p>
            </div>
            <div>
              <label className="label" htmlFor="experience">Experience</label>
              <input id="experience" name="experience" defaultValue={initial.experience ?? ""} className="input" placeholder="3 years" />
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="bio">About you</label>
          <textarea id="bio" name="bio" rows={4} defaultValue={initial.bio ?? ""} className="input resize-y" placeholder="A few sentences on what you've built and what you're looking for." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="linkedinUrl">LinkedIn</label>
            <input id="linkedinUrl" name="linkedinUrl" defaultValue={initial.linkedinUrl ?? ""} className="input" placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <label className="label" htmlFor="resumeUrl">Resume link</label>
            <input id="resumeUrl" name="resumeUrl" defaultValue={initial.resumeUrl ?? ""} className="input" placeholder="https://drive.google.com/…" />
          </div>
        </div>
      </fieldset>

      <Submit />
    </form>
  );
}
