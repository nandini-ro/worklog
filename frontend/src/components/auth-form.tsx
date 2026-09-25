"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useToast } from "./providers";
import { Field, Spinner } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      toast(mode === "login" ? "Welcome back!" : "Account created");
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
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Sign in to WorkLog" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">Record what you worked on. Report it in seconds.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {expired && mode === "login" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Your session expired. Please sign in again.</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400" role="alert">{error}</p>}
          {mode === "register" && (
            <Field label="Full name" htmlFor="name">
              <input id="name" className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          )}
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" className="input" required autoFocus={mode === "login"} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="password" hint={mode === "register" ? "At least 8 characters" : undefined}>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
