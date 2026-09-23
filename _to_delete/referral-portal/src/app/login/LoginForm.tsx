"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(login, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </div>

      <Submit />

      <p className="text-center text-xs text-slate-500 lg:hidden">
        Demo: <code>aisha@example.com</code> / <code>password123</code>
      </p>
    </form>
  );
}
