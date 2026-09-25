"use client";

import { Plus, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { ENTRY_STATUSES } from "@/lib/constants";
import type { RefData } from "@/lib/hooks";
import type { AIResult, EntryStatus, Project, WorkEntry, WorkEntryInput } from "@/lib/types";
import { AISuggestion } from "./ai-suggestion";
import { useToast } from "./providers";
import { cn, Field, Spinner } from "./ui";

const LAST_KEY = "worklog_last_entry_defaults";

function blank(date: string): WorkEntryInput {
  let last: Partial<WorkEntryInput> = {};
  try {
    last = JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
  } catch {
    /* ignore */
  }
  return {
    work_date: date,
    project_id: last.project_id ?? null,
    category_id: last.category_id ?? null,
    task_title: "",
    description: "",
    status: "completed",
    notes: "",
    blockers: "",
  };
}

function fromEntry(e: WorkEntry): WorkEntryInput {
  return {
    work_date: e.work_date,
    project_id: e.project_id,
    category_id: e.category_id,
    task_title: e.task_title,
    description: e.description ?? "",
    status: e.status,
    notes: e.notes ?? "",
    blockers: e.blockers ?? "",
  };
}

export type SaveMode = "add_another" | "close";

export function EntryForm({
  date,
  entry,
  refData,
  onSaved,
  onCancel,
  onRefDataChange,
  compact = false,
}: {
  date: string;
  entry?: WorkEntry | null;
  refData: RefData | null;
  onSaved: (saved: WorkEntry, mode: SaveMode) => void;
  onCancel?: () => void;
  onRefDataChange?: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const isEdit = !!entry;
  const [form, setForm] = useState<WorkEntryInput>(() => (entry ? fromEntry(entry) : blank(date)));
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(() => !!(entry?.notes || entry?.blockers));
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [newProject, setNewProject] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep the date in sync when the parent's selected date changes (new entries only).
  const [prevDate, setPrevDate] = useState(date);
  if (date !== prevDate) {
    setPrevDate(date);
    if (!isEdit) setForm((f) => ({ ...f, work_date: date }));
  }

  const set = <K extends keyof WorkEntryInput>(k: K, v: WorkEntryInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (mode: SaveMode) => {
    if (!form.task_title.trim()) {
      toast("Task title is required", "error");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = { ...form };
      const saved = isEdit ? await api.put<WorkEntry>(`/api/work-entries/${entry!.id}`, body) : await api.post<WorkEntry>("/api/work-entries", body);
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({ project_id: form.project_id, category_id: form.category_id }));
      } catch {
        /* ignore */
      }
      toast(isEdit ? "Entry updated" : "Work entry saved");
      if (mode === "add_another" && !isEdit) {
        // Keep project/category/date for fast multi-task entry; clear the task specifics.
        setForm((f) => ({ ...f, task_title: "", description: "", notes: "", blockers: "", status: "completed" }));
        setAi(null);
        setTimeout(() => titleRef.current?.focus(), 0);
      }
      onSaved(saved, mode);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const improve = async () => {
    const text = (form.description || "").trim() || form.task_title.trim();
    if (!text) {
      toast("Write a description first", "info");
      return;
    }
    setAiLoading(true);
    try {
      const project = refData?.projects.find((p) => p.id === form.project_id)?.name;
      const r = await api.post<AIResult>("/api/ai/improve-description", { text, task_title: form.task_title || null, project: project ?? null });
      setAi(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI request failed", "error");
    } finally {
      setAiLoading(false);
    }
  };

  const createProject = async () => {
    const name = newProject?.trim();
    if (!name) return setNewProject(null);
    try {
      const p = await api.post<Project>("/api/projects", { name });
      set("project_id", p.id);
      setNewProject(null);
      toast(`Project “${p.name}” created`);
      onRefDataChange?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create project", "error");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit(e.shiftKey || isEdit ? "close" : "add_another");
    }
  };

  const projects = (refData?.projects ?? []).filter((p) => p.status !== "archived" || p.id === form.project_id);
  const recentProjects = refData?.recentProjects ?? [];
  const recentCategories = refData?.recentCategories ?? [];

  return (
    <form
      ref={formRef}
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(isEdit ? "close" : "add_another");
      }}
      className="space-y-4"
    >
      <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-[160px_1fr]")}>
        <Field label="Date" htmlFor="work_date">
          <input id="work_date" type="date" required className="input" value={form.work_date} onChange={(e) => set("work_date", e.target.value)} />
        </Field>
        <Field label="Task title *" htmlFor="task_title">
          <input
            id="task_title"
            ref={titleRef}
            autoFocus
            className="input"
            placeholder="e.g. Model API configuration"
            value={form.task_title}
            maxLength={255}
            onChange={(e) => set("task_title", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0" htmlFor="project_id">
              Project
            </label>
            {newProject === null && (
              <button type="button" className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setNewProject("")}>
                + New project
              </button>
            )}
          </div>
          {newProject !== null ? (
            <div className="flex gap-2">
              <input
                className="input"
                autoFocus
                placeholder="Project name"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    void createProject();
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setNewProject(null);
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={createProject}>
                Add
              </button>
            </div>
          ) : (
            <select id="project_id" className="input" value={form.project_id ?? ""} onChange={(e) => set("project_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {recentProjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recentProjects.slice(0, 4).map((p) => (
                <button type="button" key={p.id} tabIndex={-1} className={cn("chip", form.project_id === p.id && "chip-active")} onClick={() => set("project_id", p.id)}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="category_id">
            Category
          </label>
          <select id="category_id" className="input" value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value ? Number(e.target.value) : null)}>
            <option value="">No category</option>
            {(refData?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {recentCategories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recentCategories.slice(0, 4).map((c) => (
                <button type="button" key={c.id} tabIndex={-1} className={cn("chip", form.category_id === c.id && "chip-active")} onClick={() => set("category_id", c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0" htmlFor="description">
            Work description
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
            onClick={improve}
            disabled={aiLoading}
          >
            {aiLoading ? <Spinner className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            Improve Description with AI
          </button>
        </div>
        <textarea
          id="description"
          className="input min-h-[88px]"
          placeholder="What did you do? e.g. Added model API key configuration through the frontend and tested agent execution."
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {ai && (
        <AISuggestion
          key={ai.suggestion}
          original={ai.original ?? ""}
          suggestion={ai.suggestion ?? ""}
          provider={ai.provider}
          warning={ai.warning}
          onReject={() => setAi(null)}
          onAccept={(text) => {
            set("description", text);
            setAi(null);
            toast("Suggestion applied — remember to save", "info");
          }}
        />
      )}

      <div>
        <span className="label">Status</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {ENTRY_STATUSES.map((s) => (
            <button
              type="button"
              key={s.value}
              role="radio"
              aria-checked={form.status === s.value}
              className={cn("chip px-3 py-1.5", form.status === s.value && "chip-active")}
              onClick={() => set("status", s.value as EntryStatus)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {showMore || form.status === "blocked" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notes" htmlFor="notes">
            <textarea id="notes" className="input min-h-[64px]" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
          </Field>
          <Field label="Blockers (optional)" htmlFor="blockers">
            <textarea id="blockers" className="input min-h-[64px]" value={form.blockers ?? ""} onChange={(e) => set("blockers", e.target.value)} placeholder="What is blocking progress?" />
          </Field>
        </div>
      ) : (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600" onClick={() => setShowMore(true)}>
          <Plus className="h-3 w-3" /> Add notes / blockers
        </button>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <p className="hidden text-[11px] text-slate-400 sm:block">
          <span className="kbd">Ctrl/⌘</span> + <span className="kbd">Enter</span> {isEdit ? "save" : "save & add another"}
          {!isEdit && (
            <>
              {" · "}
              <span className="kbd">Ctrl/⌘</span> + <span className="kbd">Shift</span> + <span className="kbd">Enter</span> save & close
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          {isEdit ? (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner className="h-4 w-4 text-white" />} Save changes
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => submit("close")}>
                Save & Close
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving && <Spinner className="h-4 w-4 text-white" />} Save & Add Another
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
