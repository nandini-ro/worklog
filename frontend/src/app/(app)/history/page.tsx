"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, History, Pencil, Search, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EntryModal } from "@/components/entry-modal";
import { useEntryActions } from "@/components/entry-list";
import { EmptyState, PageHeader, PageLoader, ProjectTag, Skeleton, StatusBadge, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { ENTRY_STATUSES } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/dates";
import { useAsync, useRefData } from "@/lib/hooks";
import type { Page, WorkEntry } from "@/lib/types";

type Filters = { q: string; start_date: string; end_date: string; project_id: string; category_id: string; status: string };

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <HistoryView />
    </Suspense>
  );
}

function HistoryView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    q: "",
    start_date: params.get("start_date") ?? "",
    end_date: params.get("end_date") ?? "",
    project_id: params.get("project_id") ?? "",
    category_id: params.get("category_id") ?? "",
    status: params.get("status") ?? "",
  }));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ field: "work_date", order: "desc" as "asc" | "desc" });
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const ref = useRefData();

  // Debounce free-text search.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === q ? f : { ...f, q }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = { ...filters, sort: sort.field, order: sort.order, page, page_size: pageSize };
  const list = useAsync(() => api.get<Page<WorkEntry>>("/api/work-entries", query), JSON.stringify(query));
  const actions = useEntryActions(list.reload);

  const update = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const clear = () => {
    setFilters({ q: "", start_date: "", end_date: "", project_id: "", category_id: "", status: "" });
    setQ("");
    setPage(1);
  };
  const active = Object.values(filters).some(Boolean);
  const toggleSort = (field: string) => setSort((s) => ({ field, order: s.field === field && s.order === "desc" ? "asc" : "desc" }));

  const data = list.data;

  return (
    <div>
      <PageHeader title="Work History" description="Search, filter and manage everything you've logged." />

      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search tasks, descriptions, notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </div>
          <input type="date" className="input" value={filters.start_date} onChange={(e) => update("start_date", e.target.value)} aria-label="From date" title="From date" />
          <input type="date" className="input" value={filters.end_date} onChange={(e) => update("end_date", e.target.value)} aria-label="To date" title="To date" />
          <select className="input" value={filters.project_id} onChange={(e) => update("project_id", e.target.value)} aria-label="Project">
            <option value="">All projects</option>
            {ref.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select className="input" value={filters.category_id} onChange={(e) => update("category_id", e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {ref.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">Status:</span>
          {[{ value: "", label: "All" }, ...ENTRY_STATUSES].map((s) => (
            <button key={s.value} className={cn("chip", filters.status === s.value && "chip-active")} onClick={() => update("status", s.value)}>
              {s.label}
            </button>
          ))}
          {active && (
            <button className="btn-ghost btn-sm ml-auto" onClick={clear}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {list.error && <p className="p-4 text-sm text-red-600">{list.error}</p>}
        {!data && list.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<History className="h-5 w-5" />} title={active ? "No entries match your filters" : "No work logged yet"} description={active ? "Try widening the date range or clearing filters." : "Entries you add will appear here."} />
        ) : data ? (
          <div className={cn("overflow-x-auto transition-opacity", list.loading && "opacity-60")}>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                <tr>
                  <Th sort={sort} onSort={toggleSort} field="work_date" className="w-28">Date</Th>
                  <Th sort={sort} onSort={toggleSort} field="project" className="w-40">Project</Th>
                  <Th sort={sort} onSort={toggleSort} field="task_title">Task / Description</Th>
                  <Th sort={sort} onSort={toggleSort} field="category" className="w-32">Category</Th>
                  <Th sort={sort} onSort={toggleSort} field="status" className="w-28">Status</Th>
                  <Th sort={sort} onSort={toggleSort} className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map((e) => (
                  <tr key={e.id} className="group align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{formatDate(e.work_date)}</td>
                    <td className="px-4 py-3">{e.project ? <ProjectTag name={e.project.name} color={e.project.color} /> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <button className="text-left font-medium hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setEditing(e)}>
                        {e.task_title}
                      </button>
                      {e.description && <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">{e.description}</p>}
                      {e.blockers && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Blocker: {e.blockers}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{e.category?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100">
                        <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="icon-btn" title="Duplicate to today" aria-label="Duplicate" onClick={() => actions.duplicate(e, todayISO())}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button className="icon-btn hover:text-red-600" title="Delete" aria-label="Delete" onClick={() => actions.remove(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <p className="text-slate-500">
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-500 tabular-nums">
                {data.page} / {data.pages}
              </span>
              <button className="btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <EntryModal open={!!editing} entry={editing} date={editing?.work_date ?? todayISO()} onClose={() => setEditing(null)} onSaved={list.reload} />
    </div>
  );
}

function Th({
  field,
  children,
  className,
  sort,
  onSort,
}: {
  field?: string;
  children: React.ReactNode;
  className?: string;
  sort: { field: string; order: "asc" | "desc" };
  onSort: (field: string) => void;
}) {
  return (
    <th className={cn("px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase", className)}>
      {field ? (
        <button className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100" onClick={() => onSort(field)}>
          {children}
          {sort.field === field && (sort.order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
