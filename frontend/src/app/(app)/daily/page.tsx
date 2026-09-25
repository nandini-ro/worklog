"use client";

import { ChevronLeft, ChevronRight, ClipboardCopy, ClipboardList } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { EntryForm } from "@/components/entry-form";
import { EntryModal } from "@/components/entry-modal";
import { EntryRow, useEntryActions } from "@/components/entry-list";
import { useToast } from "@/components/providers";
import { EmptyState, Modal, PageLoader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, formatDate, formatLong, relativeDay, todayISO } from "@/lib/dates";
import { useAsync, useRefData } from "@/lib/hooks";
import type { Page, WorkEntry } from "@/lib/types";

export default function DailyPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Daily />
    </Suspense>
  );
}

function Daily() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const date = params.get("date") || todayISO();
  const setDate = (d: string) => router.replace(d === todayISO() ? "/daily" : `/daily?date=${d}`);

  const ref = useRefData();
  const day = useAsync(() => api.get<WorkEntry[]>(`/api/work-entries/day/${date}`), date);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const [copyFrom, setCopyFrom] = useState<{ date: string; count: number } | null>(null);
  const [copying, setCopying] = useState(false);
  const actions = useEntryActions(() => {
    day.reload();
    ref.reload();
  });

  const findPrevious = async () => {
    // The most recent earlier day that has entries (skips weekends/days off).
    const r = await api.get<Page<WorkEntry>>("/api/work-entries", { end_date: addDays(date, -1), sort: "work_date", order: "desc", page_size: 1 });
    if (!r.items.length) return toast("No earlier entries to copy", "info");
    const prev = r.items[0].work_date;
    const entries = await api.get<WorkEntry[]>(`/api/work-entries/day/${prev}`);
    setCopyFrom({ date: prev, count: entries.length });
  };

  const doCopy = async (onlyUnfinished: boolean) => {
    if (!copyFrom) return;
    setCopying(true);
    try {
      const created = await api.post<WorkEntry[]>("/api/work-entries/copy-day", { source_date: copyFrom.date, target_date: date, only_unfinished: onlyUnfinished });
      toast(`Copied ${created.length} ${created.length === 1 ? "entry" : "entries"} — edit them as needed`);
      setCopyFrom(null);
      day.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Copy failed", "error");
    } finally {
      setCopying(false);
    }
  };

  const entries = day.data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{relativeDay(date)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{formatLong(date)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button className="icon-btn rounded-r-none" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input type="date" className="border-0 bg-transparent px-1 py-1.5 text-sm focus:outline-none" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Select date" />
            <button className="icon-btn rounded-l-none" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {date !== todayISO() && (
            <button className="btn-secondary" onClick={() => setDate(todayISO())}>
              Today
            </button>
          )}
          <button className="btn-secondary" onClick={findPrevious}>
            <ClipboardCopy className="h-4 w-4" /> Copy previous day
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="card p-5 xl:col-span-3">
          <h2 className="mb-4 text-sm font-semibold">Add work for {relativeDay(date).toLowerCase() === "today" ? "today" : formatDate(date)}</h2>
          <EntryForm
            date={date}
            refData={ref.data}
            onRefDataChange={ref.reload}
            onSaved={(saved, mode) => {
              day.reload();
              ref.reload();
              if (mode === "close") router.push("/dashboard");
              else if (saved.work_date !== date) setDate(saved.work_date);
            }}
          />
        </section>

        <section className="card self-start xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">
              Logged for this day <span className="font-normal text-slate-400">({entries.length})</span>
            </h2>
            {day.loading && <Spinner className="h-4 w-4" />}
          </div>
          {entries.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((e) => (
                <EntryRow key={e.id} entry={e} onEdit={setEditing} onDuplicate={(x) => actions.duplicate(x)} onDelete={actions.remove} />
              ))}
            </div>
          ) : (
            !day.loading && <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No entries for this day" description="Add tasks with the form. Use “Save & Add Another” to log several in a row." />
          )}
        </section>
      </div>

      <EntryModal open={!!editing} entry={editing} date={date} onClose={() => setEditing(null)} onSaved={day.reload} />

      <Modal open={!!copyFrom} onClose={() => setCopyFrom(null)} title="Copy previous day" size="sm">
        {copyFrom && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Copy <strong>{copyFrom.count}</strong> {copyFrom.count === 1 ? "entry" : "entries"} from <strong>{formatLong(copyFrom.date)}</strong> to <strong>{formatDate(date)}</strong>?
            </p>
            <p className="mt-2 text-xs text-slate-500">Copied entries keep their project, category, title, description and status so you can quickly update them.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCopyFrom(null)}>
                Cancel
              </button>
              <button className="btn-secondary" disabled={copying} onClick={() => doCopy(true)}>
                Only unfinished
              </button>
              <button className="btn-primary" disabled={copying} onClick={() => doCopy(false)}>
                {copying && <Spinner className="h-4 w-4 text-white" />} Copy all
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
