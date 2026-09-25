"use client";

import { Check, Pencil, Sparkles, X } from "lucide-react";
import { useState } from "react";

/**
 * Shows the user's original text next to an AI suggestion. The suggestion is never applied
 * unless the user explicitly clicks Accept (optionally after editing it).
 */
export function AISuggestion({
  original,
  suggestion,
  provider,
  warning,
  onAccept,
  onReject,
  originalLabel = "Original",
}: {
  original: string;
  suggestion: string;
  provider: string;
  warning?: string | null;
  onAccept: (text: string) => void;
  onReject: () => void;
  originalLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(suggestion);
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" /> AI Suggestion
        </span>
        <span className="text-[11px] text-slate-500">{provider === "local" ? "Basic offline rewrite (no AI key configured)" : `via ${provider}`}</span>
      </div>
      {warning && <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{warning}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="label">{originalLabel}</p>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm whitespace-pre-wrap text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {original || <em className="text-slate-400">Empty</em>}
          </div>
        </div>
        <div>
          <p className="label">AI Suggestion</p>
          {editing ? (
            <textarea className="input min-h-[96px]" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-white p-3 text-sm whitespace-pre-wrap dark:border-indigo-500/30 dark:bg-slate-900">{text}</div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={onReject}>
          <X className="h-3.5 w-3.5" /> Reject
        </button>
        {!editing && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
        <button type="button" className="btn-primary btn-sm" onClick={() => onAccept(text.trim())} disabled={!text.trim()}>
          <Check className="h-3.5 w-3.5" /> Accept
        </button>
      </div>
    </div>
  );
}
