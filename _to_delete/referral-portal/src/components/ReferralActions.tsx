"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateReferralStatus,
  addReferralNote,
  type ActionState,
} from "@/app/actions/referrals";
import { Alert } from "@/components/ui";
import { cn } from "@/lib/utils";

type Action = { to: string; label: string; tone: "primary" | "secondary" | "danger" };

function SubmitBtn({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    tone === "primary" ? "btn-primary" : tone === "danger" ? "btn-danger" : "btn-secondary";
  return (
    <button className={cn(cls, "btn-sm")} disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

/** Status-change buttons, with an optional note attached to the change. */
export function ReferralActions({
  referralId,
  actions,
}: {
  referralId: string;
  actions: Action[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateReferralStatus,
    null,
  );
  const [noteFor, setNoteFor] = useState<string | null>(null);

  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This referral has reached its final state — nothing more to move.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => setNoteFor(noteFor === a.to ? null : a.to)}
            className={cn(
              "btn-sm",
              a.tone === "primary"
                ? "btn-primary"
                : a.tone === "danger"
                  ? "btn-danger"
                  : "btn-secondary",
              noteFor === a.to && "ring-2 ring-brand-200",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {noteFor && (
        <form action={formAction} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="referralId" value={referralId} />
          <input type="hidden" name="toStatus" value={noteFor} />
          <label className="label" htmlFor="note">
            Add a note{" "}
            <span className="font-normal text-slate-400">(optional, visible to both sides)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            className="input resize-y"
            placeholder="Submitted through the internal portal — req #4412."
          />
          <div className="flex gap-2">
            <SubmitBtn
              label={actions.find((a) => a.to === noteFor)?.label ?? "Confirm"}
              tone={actions.find((a) => a.to === noteFor)?.tone ?? "primary"}
            />
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setNoteFor(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NoteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-secondary btn-sm" disabled={pending}>
      {pending ? "Posting…" : "Post note"}
    </button>
  );
}

export function AddNoteForm({ referralId }: { referralId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    addReferralNote,
    null,
  );

  return (
    <form action={action} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="referralId" value={referralId} />
      <label className="label" htmlFor="note-body">Add a note to the timeline</label>
      <textarea
        id="note-body"
        name="note"
        rows={2}
        className="input resize-y"
        placeholder="Any update worth recording…"
      />
      <NoteSubmit />
    </form>
  );
}
