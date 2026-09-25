"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";
import { Modal } from "./ui";

/* ---------------- Theme ---------------- */
export type Theme = "light" | "dark" | "system";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "system", setTheme: () => {} });

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    try {
      return (localStorage.getItem("worklog_theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem("worklog_theme", t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------------- Toasts ---------------- */
type ToastKind = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
type ToastFn = (message: string, kind?: ToastKind) => void;
const ToastCtx = createContext<ToastFn>(() => {});

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = useCallback<ToastFn>((message, kind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  }, []);
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-indigo-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="card animate-toast-in pointer-events-auto flex items-start gap-3 p-3.5 shadow-lg">
            {icons[t.kind]}
            <p className="flex-1 text-sm">{t.message}</p>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Confirm dialog ---------------- */
interface ConfirmOpts {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ""} size="sm">
        {state?.message && <div className="text-sm text-slate-600 dark:text-slate-400">{state.message}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => close(false)}>
            Cancel
          </button>
          <button autoFocus className={state?.danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)}>
            {state?.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------------- Auth ---------------- */
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
}
const AuthCtx = createContext<AuthState | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal mode: the backend needs no sign-in, so just ask who "me" is.
  useEffect(() => {
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const r = await api.post<{ access_token: string; user: User }>("/api/auth/login", { email, password });
        tokenStore.set(r.access_token);
        setUser(r.user);
      },
      async register(name, email, password) {
        const r = await api.post<{ access_token: string; user: User }>("/api/auth/register", { name, email, password });
        tokenStore.set(r.access_token);
        setUser(r.user);
      },
      logout() {
        tokenStore.clear();
        setUser(null);
        // Full reload intentionally drops all in-memory state on sign-out.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      },
      setUser,
    }),
    [user, loading],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
