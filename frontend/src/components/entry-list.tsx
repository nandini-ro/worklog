"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { relativeDay } from "@/lib/dates";
import type { WorkEntry } from "@/lib/types";
import { useConfirm, useToast } from "./providers";
import { cn, ProjectTag, StatusBadge } from "./ui";

export function useEntryActions(onChange: () => void) {
  const toast = useToast();
  const confirm = useConfirm();
  return {
    async duplicate(e: WorkEntry, work_date?: string) {
      try {
        await api.post(`/api/work-entries/${e.id}/duplicate`, work_date ? { work_date } : {});
        toast("Entry duplicated");
        onChange();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not duplicate", "error");
      }
    },
    async remove(e: WorkEntry) {
      const ok = await confirm({
        title: "Delete work entry?",
        message: (
          <>
            “<strong>{e.task_title}</strong>” will be permanently deleted.
          </>
        ),
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      try {
        await api.del(`/api/work-entries/${e.id}`);
        toast("Entry deleted");
        onChange();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not delete", "error");
      }
    },
  };
}

export function EntryRow({
  entry,
  onEdit,
  onDuplicate,
  onDelete,
  showDate = false,
}: {
  entry: WorkEntry;
  onEdit?: (e: WorkEntry) => void;
  onDuplicate?: (e: WorkEntry) => void;
  onDelete?: (e: WorkEntry) => void;
  showDate?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative flex gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showDate && <span className="text-xs font-medium text-slate-500">{relativeDay(entry.work_date)}</span>}
          {entry.project ? <ProjectTag name={entry.project.name} color={entry.project.color} /> : <span className="text-xs text-slate-400">No project</span>}
          {entry.category && <span className="text-xs text-slate-400">· {entry.category.name}</span>}
        </div>
        <button className="mt-1 block text-left text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => onEdit?.(entry)} disabled={!onEdit}>
          {entry.task_title}
        </button>
        {entry.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{entry.description}</p>}
        {entry.blockers && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            <span className="font-semibold">Blocker:</span> {entry.blockers}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <StatusBadge status={entry.status} />
        {(onEdit || onDuplicate || onDelete) && (
          <div className="relative">
            <button className="icon-btn h-7 w-7" onClick={() => setMenu((m) => !m)} aria-label="Entry actions" onBlur={() => setTimeout(() => setMenu(false), 150)}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div className="card absolute right-0 z-20 mt-1 w-36 overflow-hidden py-1 shadow-lg">
                {onEdit && (
                  <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(entry)}>
                    Edit
                  </MenuItem>
                )}
                {onDuplicate && (
                  <MenuItem icon={<Copy className="h-3.5 w-3.5" />} onClick={() => onDuplicate(entry)}>
                    Duplicate
                  </MenuItem>
                )}
                {onDelete && (
                  <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(entry)} danger>
                    Delete
                  </MenuItem>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800",
        danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200",
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
