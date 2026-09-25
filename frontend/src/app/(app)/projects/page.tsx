"use client";

import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProjectModal } from "@/components/project-modal";
import { EmptyState, PageHeader, Skeleton, StatusBadge, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { PROJECT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { useAsync } from "@/lib/hooks";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useAsync(() => api.get<Project[]>("/api/projects", { status }), status);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Group your work by project to get clear reports."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New project
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: "", label: "All" }, ...PROJECT_STATUSES].map((s) => (
          <button key={s.value} className={cn("chip", status === s.value && "chip-active")} onClick={() => setStatus(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {list.loading && !list.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card group block overflow-hidden transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/50">
              <div className="h-1.5" style={{ backgroundColor: p.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{p.name}</h3>
                    {p.client && <p className="truncate text-xs text-slate-500">{p.client}</p>}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">{p.description || "No description"}</p>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <Mini label="Entries" value={p.entry_count} />
                  <Mini label="Done" value={p.completed_count} className="text-emerald-600 dark:text-emerald-400" />
                  <Mini label="Active" value={p.in_progress_count} className="text-blue-600 dark:text-blue-400" />
                  <Mini label="Blocked" value={p.blocked_count} className="text-red-600 dark:text-red-400" />
                </div>
                <p className="mt-4 text-xs text-slate-400">{p.last_activity ? `Last activity ${formatDate(p.last_activity)}` : "No activity yet"}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title={status ? "No projects with this status" : "No projects yet"}
            description="Create a project to organise your daily work entries."
            action={
              <button className="btn-primary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New project
              </button>
            }
          />
        </div>
      )}

      <ProjectModal open={creating} onClose={() => setCreating(false)} onSaved={list.reload} />
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
      <p className={cn("text-lg font-semibold tabular-nums", className)}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
    </div>
  );
}
