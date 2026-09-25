"use client";

import { BarChart3, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./providers";
import { Field, Spinner } from "./ui";

/** Personal mode: the app is locked behind one password (APP_PASSWORD on the server). */
export function UnlockForm() {
  const { user, loading, unlock } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = params.get("expired") === "1";

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">WorkLog</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your password to continue.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {expired && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Your session expired. Please unlock again.</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</p>}
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              className="input"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4 text-white" /> : <Lock className="h-4 w-4" />}
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
