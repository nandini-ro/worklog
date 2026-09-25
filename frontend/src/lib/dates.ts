const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISODate(new Date());

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "25 Sep 2026" — matches the backend/export format exactly. */
export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const d = fromISODate(iso);
  if (opts) return d.toLocaleDateString("en-GB", opts);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatLong(iso: string) {
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function relativeDay(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === addDays(t, -1)) return "Yesterday";
  if (iso === addDays(t, 1)) return "Tomorrow";
  const d = fromISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export type PresetKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom Range" },
];

/** Weeks start on Monday. */
export function presetRange(key: Exclude<PresetKey, "custom">, now = new Date()): { start: string; end: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const d = (y: number, m: number, day: number) => toISODate(new Date(y, m, day));
  switch (key) {
    case "today":
      return { start: toISODate(today), end: toISODate(today) };
    case "yesterday": {
      const y = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
      return { start: y, end: y };
    }
    case "this_week": {
      const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
      return { start: toISODate(s), end: addDays(toISODate(s), 6) };
    }
    case "last_week": {
      const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - 7);
      return { start: toISODate(s), end: addDays(toISODate(s), 6) };
    }
    case "this_month":
      return { start: d(today.getFullYear(), today.getMonth(), 1), end: d(today.getFullYear(), today.getMonth() + 1, 0) };
    case "last_month":
      return { start: d(today.getFullYear(), today.getMonth() - 1, 1), end: d(today.getFullYear(), today.getMonth(), 0) };
  }
}
