"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { PROJECT_COLORS, PROJECT_STATUSES } from "@/lib/constants";
import type { Project, ProjectStatus } from "@/lib/types";
import { useToast } from "./providers";
import { cn, Field, Modal, Spinner } from "./ui";

type Form = { name: string; description: string; client: string; status: ProjectStatus; start_date: string; end_date: string; color: string };

export function ProjectModal({ open, project, onClose, onSaved }: { open: boolean; project?: Project | null; onClose: () => void; onSaved: (p: Project) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={project ? "Edit project" : "New project"}>
      {open && <ProjectForm key={project?.id ?? "new"} project={project} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ProjectForm({ project, onClose, onSaved }: { project?: Project | null; onClose: () => void; onSaved: (p: Project) => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Form>(() => ({
    name: project?.name ?? "",
    description: project?.description ?? "",
    client: project?.client ?? "",
    status: project?.status ?? "active",
    start_date: project?.start_date ?? "",
    end_date: project?.end_date ?? "",
    color: project?.color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
  }));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...f, start_date: f.start_date || null, end_date: f.end_date || null, description: f.description || null, client: f.client || null };
      const saved = project ? await api.put<Project>(`/api/projects/${project.id}`, body) : await api.post<Project>("/api/projects", body);
      toast(project ? "Project updated" : "Project created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save project", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name *" htmlFor="p-name">
          <input id="p-name" className="input" required autoFocus maxLength={150} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Client / team" htmlFor="p-client">
          <input id="p-client" className="input" maxLength={150} value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Description" htmlFor="p-desc">
        <textarea id="p-desc" className="input min-h-[72px]" value={f.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" htmlFor="p-status">
          <select id="p-status" className="input" value={f.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date" htmlFor="p-start">
          <input id="p-start" type="date" className="input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </Field>
        <Field label="End date" htmlFor="p-end">
          <input id="p-end" type="date" className="input" value={f.end_date} min={f.start_date || undefined} onChange={(e) => set("end_date", e.target.value)} />
        </Field>
      </div>
      <div>
        <span className="label">Tag color</span>
        <div className="flex flex-wrap items-center gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("color", c)}
              className={cn("h-7 w-7 rounded-full ring-offset-2 transition dark:ring-offset-slate-900", f.color === c && "ring-2 ring-slate-900 dark:ring-white")}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" aria-label="Custom color" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Spinner className="h-4 w-4 text-white" />} {project ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
