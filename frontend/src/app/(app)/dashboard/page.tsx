"use client";

import { AlertOctagon, CalendarCheck, CalendarDays, CalendarRange, CheckCircle2, CircleDashed, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BarList, TrendChart } from "@/components/charts";
import { EntryModal } from "@/components/entry-modal";
import { EntryRow, useEntryActions } from "@/components/entry-list";
import { useAuth } from "@/components/providers";
import { EmptyState, Skeleton, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { formatLong, todayISO } from "@/lib/dates";
import { useAsync } from "@/lib/hooks";
import type { Dashboard, WorkEntry } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const today = todayISO();
  const { data, loading, error, reload } = useAsync(() => api.get<Dashboard>("/api/dashboard", { today }), today);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const actions = useEntryActions(reload);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{formatLong(today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {user?.name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/daily" className="btn-primary px-5 py-2.5 text-base shadow-md shadow-indigo-500/20">
          <Plus className="h-5 w-5" /> Add Today&apos;s Work
        </Link>
      </div>

      {error && <div className="card mb-6 p-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />)
        ) : data ? (
          <>
            <StatCard label="Today" value={data.counts.today} icon={<CalendarCheck className="h-5 w-5" />} hint="entries" />
            <StatCard label="This week" value={data.counts.week} icon={<CalendarRange className="h-5 w-5" />} hint="entries" />
            <StatCard label="This month" value={data.counts.month} icon={<CalendarDays className="h-5 w-5" />} hint="entries" />
            <StatCard label="Completed" value={data.status_counts.completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" hint="this month" />
            <StatCard label="In progress" value={data.status_counts.in_progress} icon={<CircleDashed className="h-5 w-5" />} accent="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" hint="this month" />
            <StatCard label="Blocked" value={data.status_counts.blocked} icon={<AlertOctagon className="h-5 w-5" />} accent="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" hint="this month" />
          </>
        ) : null}
      </div>

      {data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="card">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold">Today&apos;s work</h2>
                <Link href="/daily" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Open daily log →
                </Link>
              </div>
              {data.today_entries.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.today_entries.map((e) => (
                    <EntryRow key={e.id} entry={e} onEdit={setEditing} onDuplicate={(x) => actions.duplicate(x)} onDelete={actions.remove} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Nothing logged yet today"
                  description="Capture what you worked on — it only takes a few seconds."
                  action={
                    <Link href="/daily" className="btn-primary">
                      <Plus className="h-4 w-4" /> Add Today&apos;s Work
                    </Link>
                  }
                />
              )}
            </section>

            <section className="card p-4">
              <h2 className="mb-4 text-sm font-semibold">Daily activity — last 14 days</h2>
              <TrendChart data={data.trend} />
            </section>

            <section className="card">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-semibold">Recent activity</h2>
              </div>
              {data.recent.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recent.map((e) => (
                    <EntryRow key={e.id} entry={e} showDate onEdit={setEditing} />
                  ))}
                </div>
              ) : (
                <EmptyState title="No activity yet" description="Your recent work entries will appear here." />
              )}
            </section>
          </div>

          <div className="space-y-6">
            <StatusList title="In progress" entries={data.in_progress} empty="Nothing in progress" onEdit={setEditing} />
            <StatusList title="Blocked" entries={data.blocked} empty="No blockers — nice!" onEdit={setEditing} />
            <section className="card p-4">
              <h2 className="mb-4 text-sm font-semibold">Work by project <span className="font-normal text-slate-400">· 30 days</span></h2>
              <BarList items={data.by_project} />
            </section>
            <section className="card p-4">
              <h2 className="mb-4 text-sm font-semibold">Work by category <span className="font-normal text-slate-400">· 30 days</span></h2>
              <BarList items={data.by_category.map((c) => ({ ...c, color: undefined }))} />
            </section>
          </div>
        </div>
      )}

      <EntryModal open={!!editing} entry={editing} date={editing?.work_date ?? today} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}

function StatusList({ title, entries, empty, onEdit }: { title: string; entries: WorkEntry[]; empty: string; onEdit: (e: WorkEntry) => void }) {
  return (
    <section className="card">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold">
          {title} <span className="font-normal text-slate-400">({entries.length})</span>
        </h2>
      </div>
      {entries.length ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} showDate onEdit={onEdit} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-slate-400">{empty}</p>
      )}
    </section>
  );
}
