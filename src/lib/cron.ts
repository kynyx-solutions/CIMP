// Minimal cron matching for the in-app scheduler. Times are India Standard Time (UTC+5:30,
// no daylight saving). Supports "*", "n", "a-b", "a,b,c" and "*/n" in the five standard fields.
const IST_OFFSET_MS = 5.5 * 3600_000;

export type IstParts = { minute: number; hour: number; day: number; month: number; weekday: number; key: string };

export function istParts(d: Date = new Date()): IstParts {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    minute: t.getUTCMinutes(), hour: t.getUTCHours(), day: t.getUTCDate(), month: t.getUTCMonth() + 1, weekday: t.getUTCDay(),
    key: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())} IST`,
  };
}

function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((part) => {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let lo = min, hi = max;
    if (range !== "*") {
      const [a, b] = range.split("-").map(Number);
      lo = a; hi = b ?? a;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(step) || step < 1) return false;
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

/** Does the five-field cron expression match this IST minute? */
export function cronMatches(expr: string, at: IstParts): boolean {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return false;
  return fieldMatches(f[0], at.minute, 0, 59) && fieldMatches(f[1], at.hour, 0, 23)
    && fieldMatches(f[2], at.day, 1, 31) && fieldMatches(f[3], at.month, 1, 12) && fieldMatches(f[4], at.weekday, 0, 6);
}

/** Next time (from `from`, exclusive) the expression fires; searches up to 400 days. */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const start = Math.floor(from.getTime() / 60_000) * 60_000 + 60_000;
  for (let t = start, i = 0; i < 400 * 24 * 60; i++, t += 60_000) {
    const d = new Date(t);
    if (cronMatches(expr, istParts(d))) return d;
  }
  return null;
}
