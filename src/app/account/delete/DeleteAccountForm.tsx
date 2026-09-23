"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteMyAccount, type DeleteState } from "@/app/actions/account";
import { Alert } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="mt-4 w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Deleting…" : "Permanently delete my account"}
    </button>
  );
}

/**
 * The deletion form.
 *
 * Two confirmations, for two different mistakes: the password stops someone
 * else doing it from a borrowed device, and typing DELETE stops you doing it
 * by reflex.
 */
export function DeleteAccountForm() {
  const [state, action] = useActionState<DeleteState, FormData>(
    deleteMyAccount,
    null,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <div>
        <label className="label" htmlFor="password">
          Your password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="confirm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          required
          autoComplete="off"
          spellCheck={false}
          className="input"
          placeholder="DELETE"
        />
      </div>

      <Submit />
    </form>
  );
}
