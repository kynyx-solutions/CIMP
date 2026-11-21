// HR for office users (BIIF 2.0): attendance and leave. Shared by client and server.
// Demo policy (to confirm with CIMP): Monday–Saturday working week, check-in after 10:15 IST is late.
import { isOfficeRole } from "@/lib/workflow";

export const LEAVE_TYPES = [
  { value: "casual", label: "Casual leave", quota: 12 },
  { value: "sick", label: "Sick leave", quota: 10 },
  { value: "earned", label: "Earned leave", quota: 15 },
  { value: "unpaid", label: "Leave without pay", quota: null },
] as const;
export const leaveLabel = (v: string) => LEAVE_TYPES.find((t) => t.value === v)?.label ?? v;

export const ATTENDANCE_MODES = [
  { value: "office", label: "Office" }, { value: "wfh", label: "Work from home" }, { value: "field", label: "Field visit" },
] as const;

export const LATE_AFTER = { hour: 10, minute: 15 }; // IST

/** HR is for office users only. */
export const canUseHr = (role: string) => isOfficeRole(role);
/** Who sees everyone's attendance and leave. */
export const HR_MANAGERS = ["ceo", "sr_manager"];

/** Who approves a role's leave. The CEO's own leave is recorded without approval. */
export function leaveApproverRole(role: string): "ceo" | "sr_manager" | null {
  if (role === "ceo") return null;
  return ["sr_manager", "admin_it", "accounts"].includes(role) ? "ceo" : "sr_manager";
}

/** Working days (Monday–Saturday) between two YYYY-MM-DD dates, inclusive; halfDay counts 0.5 for a one-day leave. */
export function workingDays(from: string, to: string, halfDay = false): number {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  let n = 0;
  for (let t = a; t <= b; t += 864e5) if (new Date(t).getUTCDay() !== 0) n++;
  return halfDay && n === 1 ? 0.5 : n;
}

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function isLate(checkIn: Date | string) {
  const t = new Date(new Date(checkIn).getTime() + 5.5 * 3600_000);
  return t.getUTCHours() > LATE_AFTER.hour || (t.getUTCHours() === LATE_AFTER.hour && t.getUTCMinutes() > LATE_AFTER.minute);
}

// Social media content calendar
export const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" }, { value: "x", label: "X (Twitter)" }, { value: "facebook", label: "Facebook" }, { value: "instagram", label: "Instagram" },
] as const;
export const SOCIAL_ROLES = ["social_media", "admin_it", "ceo"];
