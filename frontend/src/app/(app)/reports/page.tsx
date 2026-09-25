"use client";

import { Download, FileSpreadsheet, FileText, RotateCcw, Sparkles, Table2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AISuggestion } from "@/components/ai-suggestion";
import { useToast } from "@/components/providers";
import { EmptyState, PageHeader, PageLoader, Spinner, StatusBadge, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { ENTRY_STATUSES } from "@/lib/constants";
import { PRESETS, type PresetKey, presetRange, formatDate } from "@/lib/dates";
import { useRefData } from "@/lib/hooks";
import type { AIResult, Report, ReportEntry } from "@/lib/types";

type Params = { start_date: string; end_date: string; project_id: string; category_id: string; status: string };

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const search = useSearchParams();
  const toast = useToast();
  const ref = useRefData();
  const [preset, setPreset] = useState<PresetKey>("this_week");
  const [custom, setCustom] = useState(() => presetRange("this_week"));
  const [filters, setFilters] = useState({ project_id: search.get("project_id") ?? "", category_id: "", status: "" });
  const [report, setReport] = useState<Report | null>(null);
  const [active, setActive] = useState<Params | null>(null);
  const [loading, setLoading] = useState(false);
  const [customSummary, setCustomSummary] = useState<string | null>(null);
  const [ai, setAi] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const range = preset === "custom" ? custom : presetRange(preset);

  const generate = async () => {
    if (!range.start || !range.end) return toast("Choose a start and end date", "error");
    if (range.end < range.start) return toast("End date cannot be before start date", "error");
    const params: Params = { start_date: range.start, end_date: range.end, ...filters };
    setLoading(true);
    try {
      setReport(await api.get<Report>("/api/reports", params));
      setActive(params);
      setCustomSummary(null);
      setAi(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not generate report", "error");
    } finally {
      setLoading(false);
    }
  };

  const generateAI = async () => {
    if (!active) return;
    setAiLoading(true);
    try {
      const r = await api.post<AIResult>("/api/ai/generate-report-summary", {
        start_date: active.start_date,
        end_date: active.end_date,
        project_id: active.project_id || null,
        category_id: active.category_id || null,
        status: active.status || null,
      });
      setAi(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI summary failed", "error");
    } finally {
      setAiLoading(false);
    }
  };

  const exportAs = async (fmt: "pdf" | "xlsx" | "csv") => {
    if (!active) return;
    setExporting(fmt);
    try {
      await api.download(`/api/reports/export/${fmt}`, { ...active, summary: customSummary ?? undefined });
      toast(`${fmt.toUpperCase()} downloaded`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setExporting(null);
    }
  };

  const summary = customSummary ?? report?.summary ?? "";

  return (
    <div>
      <PageHeader title="Reports" description="Pick a timeframe and generate a professional work report." />

      <section className="card mb-6 p-5">
        <p className="label">Timeframe</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} className={cn("chip px-3 py-1.5", preset === p.key && "chip-active")} onClick={() => setPreset(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="label" htmlFor="from">
              From date
            </label>
            <input id="from" type="date" className="input" value={range.start} disabled={preset !== "custom"} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To date
            </label>
            <input id="to" type="date" className="input" value={range.end} disabled={preset !== "custom"} min={range.start} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="r-project">
              Project
            </label>
            <select id="r-project" className="input" value={filters.project_id} onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}>
              <option value="">All projects</option>
              {ref.data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-category">
              Category
            </label>
            <select id="r-category" className="input" value={filters.category_id} onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))}>
              <option value="">All categories</option>
              {ref.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="r-status">
              Status
            </label>
            <select id="r-status" className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {ENTRY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={generate} disabled={loading}>
              {loading ? <Spinner className="h-4 w-4 text-white" /> : <FileText className="h-4 w-4" />} Generate Report
            </button>
          </div>
        </div>
      </section>

      {!report ? (
        <div className="card">
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No report generated yet" description="Choose a timeframe and optional filters, then click “Generate Report”." />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Preview · <span className="font-medium text-slate-700 dark:text-slate-300">{report.period.label}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => exportAs("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />} PDF
              </button>
              <button className="btn-secondary" onClick={() => exportAs("xlsx")} disabled={!!exporting}>
                {exporting === "xlsx" ? <Spinner className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
              </button>
              <button className="btn-secondary" onClick={() => exportAs("csv")} disabled={!!exporting}>
                {exporting === "csv" ? <Spinner className="h-4 w-4" /> : <Table2 className="h-4 w-4" />} CSV
              </button>
            </div>
          </div>

          <article className="card mx-auto overflow-hidden">
            <header className="bg-indigo-600 px-6 py-6 text-white sm:px-10">
              <p className="text-2xl font-bold tracking-tight">WORK REPORT</p>
              <p className="mt-1 text-sm font-semibold text-indigo-100">{report.user.name}</p>
              <p className="text-sm text-indigo-100">
                Period: {report.period.label} &nbsp;|&nbsp; Generated: {report.generated_label}
              </p>
              {Object.entries(report.filters).some(([, v]) => v) && (
                <p className="mt-1 text-xs text-indigo-200">
                  Filters:{" "}
                  {Object.entries(report.filters)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`)
                    .join(", ")}
                </p>
              )}
            </header>
            <div className="space-y-8 px-6 py-6 sm:px-10">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-5 sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
                {[
                  ["Work items", report.totals.entries],
                  ["Completed", report.totals.completed],
                  ["In progress", report.totals.in_progress],
                  ["Blocked", report.totals.blocked],
                  ["Projects", report.totals.projects],
                ].map(([k, v]) => (
                  <div key={k} className="px-4 py-3">
                    <p className="text-xl font-bold tabular-nums">{v}</p>
                    <p className="text-[11px] text-slate-500">{k}</p>
                  </div>
                ))}
              </div>

              <Section title="Summary">
                <div className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed">{summary}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-secondary btn-sm" onClick={generateAI} disabled={aiLoading || report.totals.entries === 0}>
                      {aiLoading ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-indigo-500" />} Generate AI Report Summary
                    </button>
                    {customSummary && (
                      <button className="btn-ghost btn-sm" onClick={() => setCustomSummary(null)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Use automatic summary
                      </button>
                    )}
                    {customSummary && <span className="text-[11px] text-emerald-600">Custom summary will be used in exports</span>}
                  </div>
                  {ai && (
                    <AISuggestion
                      key={ai.summary}
                      original={summary}
                      originalLabel="Current summary"
                      suggestion={ai.summary ?? ""}
                      provider={ai.provider}
                      warning={ai.warning}
                      onReject={() => setAi(null)}
                      onAccept={(text) => {
                        setCustomSummary(text);
                        setAi(null);
                        toast("Summary updated");
                      }}
                    />
                  )}
                </div>
              </Section>

              {report.totals.entries === 0 ? (
                <p className="text-sm text-slate-500">No work entries were recorded for this period.</p>
              ) : (
                <>
                  <Section title="Daily Work">
                    <div className="space-y-5">
                      {report.daily.map((d) => (
                        <div key={d.date}>
                          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{d.date_label}</h4>
                          <div className="space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
                            {d.groups.map((g) => (
                              <div key={g.project}>
                                <p className="flex items-center gap-2 text-sm font-medium">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color ?? "#94a3b8" }} />
                                  {g.project}
                                </p>
                                <ul className="mt-1 space-y-1.5 pl-4">
                                  {g.entries.map((e) => (
                                    <ReportItem key={e.id} e={e} />
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="In Progress">
                    <SimpleList items={[...report.in_progress, ...report.planned]} empty="Nothing in progress." />
                  </Section>

                  <Section title="Blockers">
                    {report.blockers.length ? (
                      <ul className="space-y-2">
                        {report.blockers.map((e) => (
                          <li key={e.id} className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-sm dark:border-red-500/20 dark:bg-red-500/5">
                            <span className="text-slate-500">{formatDate(e.date)}</span> · <strong>{e.project ?? "General"}</strong> — {e.task_title} <StatusBadge status={e.status} />
                            {e.blockers && <p className="mt-1 text-red-700 dark:text-red-400">{e.blockers}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No blockers were recorded in this period.</p>
                    )}
                  </Section>

                  <Section title="Project Summary">
                    <div className="grid gap-4 md:grid-cols-2">
                      {report.project_summary.map((p) => (
                        <div key={p.project} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 font-medium">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color ?? "#94a3b8" }} />
                              {p.project}
                            </p>
                            <p className="text-xs text-slate-500">
                              {p.total} {p.total === 1 ? "item" : "items"} · {p.completed} done
                              {p.in_progress ? ` · ${p.in_progress} in progress` : ""}
                              {p.blocked ? ` · ${p.blocked} blocked` : ""}
                            </p>
                          </div>
                          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600 dark:text-slate-400">
                            {p.tasks.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </div>
          </article>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-indigo-600 uppercase dark:border-slate-800 dark:text-indigo-400">{title}</h3>
      {children}
    </section>
  );
}

function ReportItem({ e }: { e: ReportEntry }) {
  return (
    <li className="text-sm">
      <span className="font-medium">{e.task_title}</span>
      {e.description && <span className="text-slate-600 dark:text-slate-400"> — {e.description}</span>} <StatusBadge status={e.status} />
      {e.notes && <p className="text-xs text-slate-500">Notes: {e.notes}</p>}
    </li>
  );
}

function SimpleList({ items, empty }: { items: ReportEntry[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((e) => (
        <li key={e.id}>
          <strong>{e.project ?? "General"}</strong> — {e.task_title} <span className="text-xs text-slate-500">({e.status_label}, {formatDate(e.date)})</span>
        </li>
      ))}
    </ul>
  );
}
