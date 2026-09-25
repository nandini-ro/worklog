"use client";

import { BarChart3, CalendarDays, ClipboardList, FileText, FolderKanban, History, LayoutDashboard, Menu, Moon, Plus, Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useTheme } from "./providers";
import { cn, PageLoader } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daily", label: "Daily Work", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Global shortcut: press "n" (outside inputs) to add today's work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      router.push("/daily");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  if (loading) return <PageLoader />;
  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-slate-500">
        Cannot reach the server. Is the backend running on port 8000?
      </div>
    );

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm leading-tight font-semibold">WorkLog</p>
          <p className="text-[11px] leading-tight text-slate-500">Daily work & reports</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <Link href="/daily" onClick={() => setOpen(false)} className="btn-primary w-full">
          <Plus className="h-4 w-4" /> Add Today&apos;s Work
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {user.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-slate-500">{user.email}</p>
          </div>
          <button className="icon-btn" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Toggle theme" title={`Theme: ${theme}`}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button className="icon-btn absolute top-4 right-3" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/80">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">WorkLog</span>
          <Link href="/daily" className="btn-primary btn-sm ml-auto">
            <Plus className="h-3.5 w-3.5" /> Add work
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
