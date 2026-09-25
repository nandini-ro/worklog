"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EntryModal } from "@/components/entry-modal";
import { EntryRow, useEntryActions } from "@/components/entry-list";
import { EmptyState, PageHeader, Spinner, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { formatLong, toISODate, todayISO } from "@/lib/dates";
import { useAsync } from "@/lib/hooks";
import type { CalendarDay, WorkEntry } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const today = todayISO();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [modal, setModal] = useState<{ entry: WorkEntry | null } | null>(null);

  const cal = useAsync(() => api.get<CalendarDay[]>("/api/work-entries/calendar", { year: month.y, month: month.m + 1 }), `${month.y}-${month.m}`);
  const day = useAsync(() => api.get<WorkEntry[]>(`/api/work-entries/day/${selected}`), selected);
  const refresh = () => {
    cal.reload();
    day.reload();
  };
  const actions = useEntryActions(refresh);

  const byDate = new Map((cal.data ?? []).map((d) => [d.date, d]));
  const first = new Date(month.y, month.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(month.y, month.m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };
  const monthTotal = (cal.data ?? []).reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <PageHeader title="Calendar" description="See what you worked on, day by day." />
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
              <p className="text-xs text-slate-500">{monthTotal} entries this month</p>
            </div>
            <div className="flex items-center gap-1">
              {cal.loading && <Spinner className="mr-2 h-4 w-4" />}
              <button className="btn-secondary btn-sm" onClick={goToday}>
                Today
              </button>
              <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, i) => {
              if (!iso) return <div key={i} className="min-h-[76px] sm:min-h-[92px]" />;
              const info = byDate.get(iso);
              const isToday = iso === today;
              const isSel = iso === selected;
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  className={cn(
                    "flex min-h-[76px] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[92px] sm:p-2",
                    isSel ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-500/10" : "border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/50",
                    info && !isSel && "bg-white dark:bg-slate-900",
                  )}
                  aria-label={`${formatLong(iso)}: ${info?.total ?? 0} entries`}
                >
                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium", isToday ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-300")}>
                    {Number(iso.slice(8))}
                  </span>
                  {info && (
                    <div className="mt-auto space-y-0.5">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {info.total} <span className="hidden font-normal text-slate-500 sm:inline">{info.total === 1 ? "entry" : "entries"}</span>
                      </p>
                      <div className="flex flex-wrap gap-x-1.5 text-[10px] leading-tight">
                        {info.completed > 0 && <span className="text-emerald-600 dark:text-emerald-400" title="Completed">✓{info.completed}</span>}
                        {info.in_progress > 0 && <span className="text-blue-600 dark:text-blue-400" title="In progress">◐{info.in_progress}</span>}
                        {info.blocked > 0 && <span className="text-red-600 dark:text-red-400" title="Blocked">■{info.blocked}</span>}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-500">
            <span className="text-emerald-600">✓ Completed</span>
            <span className="text-blue-600">◐ In progress</span>
            <span className="text-red-600">■ Blocked</span>
          </div>
        </section>

        <section className="card self-start">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold">{formatLong(selected)}</h2>
              <p className="text-xs text-slate-500">{day.data?.length ?? 0} entries</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => setModal({ entry: null })}>
              <Plus className="h-3.5 w-3.5" /> Add entry
            </button>
          </div>
          {day.loading && !day.data ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : day.data?.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {day.data.map((e) => (
                <EntryRow key={e.id} entry={e} onEdit={(x) => setModal({ entry: x })} onDuplicate={(x) => actions.duplicate(x)} onDelete={actions.remove} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing recorded" description="Add what you worked on for this date." />
          )}
          <div className="border-t border-slate-100 px-4 py-2.5 text-right dark:border-slate-800">
            <Link href={`/daily?date=${selected}`} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Open in Daily Work →
            </Link>
          </div>
        </section>
      </div>

      <EntryModal open={!!modal} entry={modal?.entry} date={selected} onClose={() => setModal(null)} onSaved={refresh} />
    </div>
  );
}
