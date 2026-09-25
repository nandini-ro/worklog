"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-indigo-500", className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800", className)} />;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLE[status])}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ProjectTag({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color || "#94a3b8" }} />
      {name}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} className={cn("card relative mt-8 w-full p-6 shadow-xl sm:mt-16", width)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="icon-btn -mt-1 -mr-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={cn("rounded-lg p-2.5", accent)}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
