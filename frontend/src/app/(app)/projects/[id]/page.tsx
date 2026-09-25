"use client";

import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EntryModal } from "@/components/entry-modal";
import { EntryRow, useEntryActions } from "@/components/entry-list";
import { ProjectModal } from "@/components/project-modal";
import { useConfirm, useToast } from "@/components/providers";
import { EmptyState, PageLoader, StatCard, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, todayISO } from "@/lib/dates";
import { useAsync } from "@/lib/hooks";
import type { Page, Project, WorkEntry } from "@/lib/types";
import { CalendarClock, CheckCircle2, CircleDashed, ListChecks } from "lucide-react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const project = useAsync(() => api.get<Project>(`/api/projects/${id}`), id);
  const entries = useAsync(() => api.get<Page<WorkEntry>>("/api/work-entries", { project_id: id, page_size: 100 }), `p-${id}`);
  const [editingProject, setEditingProject] = useState(false);
  const [entryModal, setEntryModal] = useState<{ entry: WorkEntry | null } | null>(null);
  const refresh = () => {
    project.reload();
    entries.reload();
  };
  const actions = useEntryActions(refresh);

  if (project.error) {
    return (
      <div className="card">
        <EmptyState title="Project not found" description={project.error} action={<Link href="/projects" className="btn-secondary">Back to projects</Link>} />
      </div>
    );
  }
  if (!project.data) return <PageLoader />;
  const p = project.data;
  const items = entries.data?.items ?? [];
  const completed = items.filter((e) => e.status === "completed");
  const inProgress = items.filter((e) => e.status === "in_progress" || e.status === "blocked");

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${p.name}”?`,
      message: "The project will be deleted. Its work entries are kept but will no longer be linked to a project. Consider archiving instead.",
      confirmLabel: "Delete project",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/projects/${p.id}`);
      toast("Project deleted");
      router.push("/projects");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    }
  };

  return (
    <div>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-4 w-4 shrink-0 rounded" style={{ backgroundColor: p.color }} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[p.client, p.start_date && `Started ${formatDate(p.start_date)}`, p.end_date && `Ends ${formatDate(p.end_date)}`].filter(Boolean).join(" · ") || "No client or dates set"}
            </p>
            {p.description && <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{p.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setEntryModal({ entry: null })}>
            <Plus className="h-4 w-4" /> Add work
          </button>
          <Link href={`/reports?project_id=${p.id}`} className="btn-secondary">
            <FileText className="h-4 w-4" /> Report
          </Link>
          <button className="btn-secondary" onClick={() => setEditingProject(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button className="btn-ghost text-red-600" onClick={remove} aria-label="Delete project">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Work entries" value={p.entry_count} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Completed" value={p.completed_count} icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <StatCard label="In progress" value={p.in_progress_count} icon={<CircleDashed className="h-5 w-5" />} accent="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" />
        <StatCard label="Last activity" value={<span className="text-base">{p.last_activity ? formatDate(p.last_activity) : "—"}</span>} icon={<CalendarClock className="h-5 w-5" />} accent="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link href={`/history?project_id=${p.id}`} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              View all in history →
            </Link>
          </div>
          {items.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.slice(0, 20).map((e) => (
                <EntryRow key={e.id} entry={e} showDate onEdit={(x) => setEntryModal({ entry: x })} onDuplicate={(x) => actions.duplicate(x, todayISO())} onDelete={actions.remove} />
              ))}
            </div>
          ) : (
            <EmptyState title="No work logged for this project" description="Entries you log against this project will show here." />
          )}
        </section>
        <div className="space-y-6">
          <TaskList title="Completed tasks" items={completed} />
          <TaskList title="In progress & blocked" items={inProgress} />
        </div>
      </div>

      <ProjectModal open={editingProject} project={p} onClose={() => setEditingProject(false)} onSaved={refresh} />
      <EntryModal open={!!entryModal} entry={entryModal?.entry} date={todayISO()} onClose={() => setEntryModal(null)} onSaved={refresh} />
    </div>
  );
}

function TaskList({ title, items }: { title: string; items: WorkEntry[] }) {
  return (
    <section className="card">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold">
          {title} <span className="font-normal text-slate-400">({items.length})</span>
        </h2>
      </div>
      {items.length ? (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {items.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.task_title}</p>
                <p className="text-[11px] text-slate-500">{formatDate(e.work_date)}</p>
              </div>
              <StatusBadge status={e.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-slate-400">None</p>
      )}
    </section>
  );
}
