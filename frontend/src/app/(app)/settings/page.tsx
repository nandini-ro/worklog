"use client";

import { Monitor, Moon, Pencil, Plus, Sparkles, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth, useConfirm, useTheme, useToast, type Theme } from "@/components/providers";
import { Field, PageHeader, Spinner, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Category, User } from "@/lib/types";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile, categories and preferences." />
      <div className="space-y-6">
        <Profile />
        <Appearance />
        <Categories />
        <AIStatus />
      </div>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 mb-4 text-sm text-slate-500">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("name");
    try {
      setUser(await api.put<User>("/api/auth/me", { name }));
      toast("Profile updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Profile" description="Your name appears on exported reports.">
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Name" htmlFor="s-name">
            <input id="s-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <button className="btn-primary" disabled={busy === "name" || !name.trim() || name === user?.name}>
          {busy === "name" && <Spinner className="h-4 w-4 text-white" />} Save
        </button>
      </form>
    </Card>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const opts: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];
  return (
    <Card title="Appearance">
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.value} onClick={() => setTheme(o.value)} className={cn("chip justify-center rounded-lg py-2.5 text-sm", theme === o.value && "chip-active")}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Categories() {
  const toast = useToast();
  const confirm = useConfirm();
  const cats = useAsync(() => api.get<Category[]>("/api/categories"), "cats");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/api/categories", { name });
      setName("");
      toast("Category added");
      cats.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add category", "error");
    }
  };
  const rename = async () => {
    if (!editing) return;
    try {
      await api.put(`/api/categories/${editing.id}`, { name: editing.name });
      setEditing(null);
      toast("Category renamed");
      cats.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not rename", "error");
    }
  };
  const remove = async (c: Category) => {
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      message: c.entry_count ? `${c.entry_count} work entries use this category. They will be kept but become uncategorised.` : "This category is not used by any entries.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/api/categories/${c.id}`);
      toast("Category deleted");
      cats.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete", "error");
    }
  };

  return (
    <Card title="Categories" description="Classify your work. Defaults are created for you; add your own as needed.">
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input className="input" placeholder="New category name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="New category name" />
        <button className="btn-primary" disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {cats.data?.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2">
            {editing?.id === c.id ? (
              <input
                className="input py-1"
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename();
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={rename}
              />
            ) : (
              <span className="flex-1 text-sm">{c.name}</span>
            )}
            <span className="text-xs text-slate-400 tabular-nums">{c.entry_count ?? 0} entries</span>
            <button className="icon-btn" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button className="icon-btn hover:text-red-600" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AIStatus() {
  const s = useAsync(() => api.get<{ provider: string; configured: boolean; available_providers: string[] }>("/api/ai/status"), "ai");
  return (
    <Card title="AI assistance" description="Used for “Improve Description with AI” and “Generate AI Report Summary”. AI suggestions never overwrite your text automatically.">
      {s.data ? (
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <Sparkles className={cn("mt-0.5 h-4 w-4", s.data.configured ? "text-indigo-500" : "text-slate-400")} />
          {s.data.configured ? (
            <p>
              Connected to <strong className="capitalize">{s.data.provider}</strong>.
            </p>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              No AI provider key is configured, so a basic offline assistant is used. To enable full AI, set <code className="kbd">OPENAI_API_KEY</code>, <code className="kbd">GROQ_API_KEY</code> or{" "}
              <code className="kbd">GEMINI_API_KEY</code> in the backend environment. Keys stay on the server.
            </p>
          )}
        </div>
      ) : (
        <Spinner />
      )}
    </Card>
  );
}
