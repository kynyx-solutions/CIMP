// Quarterly progress reports (PRD QPR-1, QPR-2). Shared by client and server.
// Periods are calendar quarters written "2026-Q4" (Oct–Dec 2026).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function parsePeriod(p: string): { year: number; q: number } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(p);
  return m ? { year: Number(m[1]), q: Number(m[2]) } : null;
}

export function periodLabel(p: string): string {
  const x = parsePeriod(p);
  if (!x) return p;
  return `Q${x.q} ${x.year} (${MONTHS.at((x.q - 1) * 3)}–${MONTHS.at((x.q - 1) * 3 + 2)})`;
}

export function previousPeriod(p: string): string {
  const x = parsePeriod(p)!;
  return x.q === 1 ? `${x.year - 1}-Q4` : `${x.year}-Q${x.q - 1}`;
}

/** First day of the quarter after `p` (the report is due by then + 15 days). */
export function periodEnd(p: string): Date {
  const x = parsePeriod(p)!;
  return new Date(x.year, x.q * 3, 1);
}

export const QPR_DUE_DAYS = 15;
export function dueDate(p: string): Date {
  const d = periodEnd(p);
  d.setDate(d.getDate() + QPR_DUE_DAYS - 1);
  return d;
}

/** Periods an incubatee may file for today: the current quarter and the one before. */
export function fileablePeriods(now = new Date()): string[] {
  const cur = periodOf(now);
  return [cur, previousPeriod(cur)];
}

/**
 * Reminder window (QPR-2): the last 14 days of a quarter and the first 15 days after it.
 * Returns the period being reminded about, or null outside the window.
 */
export function reminderPeriod(now = new Date()): string | null {
  const cur = periodOf(now);
  const end = periodEnd(cur);
  const daysLeft = (end.getTime() - now.getTime()) / 864e5;
  if (daysLeft <= 14) return cur;
  const prev = previousPeriod(cur);
  const sinceEnd = (now.getTime() - periodEnd(prev).getTime()) / 864e5;
  if (sinceEnd >= 0 && sinceEnd < QPR_DUE_DAYS) return prev;
  return null;
}

export const QPR_STATUS: Record<string, { label: string; tone: "muted" | "warn" | "good" | "bad" }> = {
  missing: { label: "Not started", tone: "muted" },
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "Submitted", tone: "warn" },
  accepted: { label: "Accepted", tone: "good" },
  returned: { label: "Returned for changes", tone: "bad" },
};

export const QPR_TONE_CLS = {
  muted: "bg-slate-50 text-slate-600 border-slate-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  good: "bg-leaf-50 text-leaf-800 border-leaf-200",
  bad: "bg-red-50 text-red-700 border-red-200",
};
