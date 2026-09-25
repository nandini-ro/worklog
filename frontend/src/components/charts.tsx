import { formatDate } from "@/lib/dates";
import { cn } from "./ui";

export function BarList({ items, empty = "No data yet" }: { items: { name: string; count: number; color?: string }[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {i.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />}
              <span className="truncate">{i.name}</span>
            </span>
            <span className="shrink-0 text-xs text-slate-500 tabular-nums">
              {i.count} {i.count === 1 ? "entry" : "entries"} · {Math.round((i.count / total) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(i.count / max) * 100}%`, backgroundColor: i.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({ data }: { data: { date: string; total: number; completed: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d) => {
          const weekend = [0, 6].includes(new Date(d.date + "T00:00:00").getDay());
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${formatDate(d.date)}: ${d.total} entries, ${d.completed} completed`}>
              <div className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block dark:bg-slate-700">
                {d.total} · {d.completed} done
              </div>
              <div className={cn("relative w-full overflow-hidden rounded-t-md", d.total ? "bg-indigo-200 dark:bg-indigo-500/30" : "bg-slate-100 dark:bg-slate-800")} style={{ height: d.total ? `${(d.total / max) * 100}%` : "4px" }}>
                <div className="absolute bottom-0 w-full bg-indigo-500" style={{ height: d.total ? `${(d.completed / d.total) * 100}%` : 0 }} />
              </div>
              <span className={cn("mt-1.5 text-center text-[10px] tabular-nums", weekend ? "text-slate-300 dark:text-slate-600" : "text-slate-400")}>{d.date.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-indigo-500" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-indigo-200 dark:bg-indigo-500/30" /> Other entries
        </span>
      </div>
    </div>
  );
}
