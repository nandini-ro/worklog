export type EntryStatus = "planned" | "in_progress" | "completed" | "blocked";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  entry_count?: number;
}

export interface ProjectRef {
  id: number;
  name: string;
  color: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  client: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  entry_count: number;
  completed_count: number;
  in_progress_count: number;
  blocked_count: number;
  last_activity: string | null;
}

export interface WorkEntry {
  id: number;
  work_date: string;
  project_id: number | null;
  category_id: number | null;
  task_title: string;
  description: string | null;
  status: EntryStatus;
  notes: string | null;
  blockers: string | null;
  project: ProjectRef | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}

export interface WorkEntryInput {
  work_date: string;
  project_id: number | null;
  category_id: number | null;
  task_title: string;
  description: string | null;
  status: EntryStatus;
  notes: string | null;
  blockers: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CalendarDay {
  date: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  planned: number;
}

export interface Dashboard {
  today: string;
  counts: { today: number; week: number; month: number };
  status_counts: Record<EntryStatus, number>;
  today_entries: WorkEntry[];
  in_progress: WorkEntry[];
  blocked: WorkEntry[];
  recent: WorkEntry[];
  by_project: { name: string; color: string; count: number }[];
  by_category: { name: string; count: number }[];
  trend: { date: string; total: number; completed: number }[];
}

export interface ReportEntry {
  id: number;
  date: string;
  date_label: string;
  project: string | null;
  project_color: string | null;
  category: string | null;
  task_title: string;
  description: string | null;
  status: EntryStatus;
  status_label: string;
  notes: string | null;
  blockers: string | null;
}

export interface Report {
  title: string;
  user: { name: string; email: string };
  period: { start: string; end: string; label: string };
  generated_label: string;
  filters: { project: string | null; category: string | null; status: string | null };
  totals: {
    entries: number;
    completed: number;
    in_progress: number;
    planned: number;
    blocked: number;
    projects: number;
    active_days: number;
  };
  summary: string;
  summary_source: "auto" | "custom";
  daily: {
    date: string;
    date_label: string;
    groups: { project: string; color: string | null; entries: ReportEntry[] }[];
  }[];
  completed: ReportEntry[];
  in_progress: ReportEntry[];
  planned: ReportEntry[];
  blockers: ReportEntry[];
  project_summary: {
    project: string;
    color: string | null;
    total: number;
    completed: number;
    in_progress: number;
    planned: number;
    blocked: number;
    tasks: string[];
  }[];
  category_summary: { category: string; total: number }[];
}

export interface AIResult {
  suggestion?: string;
  summary?: string;
  original?: string;
  provider: string;
  warning: string | null;
}
