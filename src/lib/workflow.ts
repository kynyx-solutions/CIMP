// Shared (client + server) definitions for office roles and the
// 4-stage application approval workflow (PRD §4.2, §6.1).
// Keep this file free of server-only imports.

export type OfficeRole =
  | "admin_it"
  | "ceo"
  | "sr_manager"
  | "manager"
  | "executive"
  | "staff"
  // BIIF 2.0 (Phase 3): finance and communications
  | "accounts"
  | "social_media";

export const OFFICE_ROLES: OfficeRole[] = [
  "ceo",
  "admin_it",
  "sr_manager",
  "manager",
  "executive",
  "staff",
  "accounts",
  "social_media",
];

export const ROLE_LABELS: Record<string, string> = {
  incubatee: "Incubatee",
  mentor: "Mentor",
  admin_it: "Admin (IT)",
  ceo: "CEO",
  sr_manager: "Senior Manager",
  manager: "Incubation Manager",
  executive: "Executive",
  staff: "Office Staff",
  accounts: "Accounts Officer",
  social_media: "Social Media Manager",
};

export const ROLE_ICONS: Record<string, string> = {
  incubatee: "🚀",
  mentor: "🧭",
  admin_it: "🛠️",
  ceo: "👑",
  sr_manager: "🏛️",
  manager: "🔍",
  executive: "📋",
  staff: "🗂️",
  accounts: "💰",
  social_media: "📣",
};

// Approval authority. Higher rank can act on any stage at or below its rank.
// Admin IT and Office Staff have no approval authority.
export const APPROVAL_RANK: Record<string, number> = {
  executive: 1,
  manager: 2,
  sr_manager: 3,
  ceo: 4,
};

export function isOfficeRole(role: string | undefined | null): boolean {
  return !!role && (OFFICE_ROLES as string[]).includes(role);
}

export type Stage =
  | "submitted"
  | "executive_accepted"
  | "manager_reviewed"
  | "sr_manager_approved"
  | "ceo_approved"
  | "returned"
  | "rejected";

interface StageDef {
  label: string;
  waitingOn?: string; // human label of who acts next
  requiredRank?: number; // rank needed to act on this stage
  next?: Stage;
  actionLabel?: string; // label of the "advance" action at this stage
  needsSignature?: boolean; // advancing from this stage requires a signature
}

export const STAGES: Record<Stage, StageDef> = {
  submitted: {
    label: "Executive Review",
    waitingOn: "Executive",
    requiredRank: 1,
    next: "executive_accepted",
    actionLabel: "Accept Submission",
  },
  executive_accepted: {
    label: "Due Diligence",
    waitingOn: "Incubation Manager",
    requiredRank: 2,
    next: "manager_reviewed",
    actionLabel: "Complete Due Diligence",
  },
  manager_reviewed: {
    label: "Sr. Manager Approval",
    waitingOn: "Senior Manager",
    requiredRank: 3,
    next: "sr_manager_approved",
    actionLabel: "Approve & Sign",
    needsSignature: true,
  },
  sr_manager_approved: {
    label: "CEO Final Approval",
    waitingOn: "CEO",
    requiredRank: 4,
    next: "ceo_approved",
    actionLabel: "Final Approve & Sign",
    needsSignature: true,
  },
  ceo_approved: { label: "Approved" },
  rejected: { label: "Rejected" },
  // Sent back to the applicant for changes (PRD WF-3). Not an office queue stage.
  returned: { label: "Changes requested", waitingOn: "Applicant" },
};

export const PIPELINE: Stage[] = [
  "submitted",
  "executive_accepted",
  "manager_reviewed",
  "sr_manager_approved",
  "ceo_approved",
];

export function isOpenStage(stage: string): boolean {
  return stage in STAGES && !!STAGES[stage as Stage].next;
}

export type WorkflowAction = "advance" | "reject" | "send_back" | "fasttrack" | "toggle_public";

export function canAct(role: string, stage: string, action: WorkflowAction, status?: string): boolean {
  const rank = APPROVAL_RANK[role] ?? 0;
  if (action === "toggle_public") {
    return (role === "ceo" || role === "admin_it") && status === "approved";
  }
  if (!isOpenStage(stage)) return false;
  const required = STAGES[stage as Stage].requiredRank ?? Infinity;
  if (action === "fasttrack") return role === "ceo";
  // advance / reject / send_back: must hold authority for the current stage (or higher).
  return rank >= required;
}

// When did the application enter its current stage? (last decision, or submission)
export function stageEnteredAt(app: { createdAt: string | Date; steps?: { at: string | Date }[] }): Date {
  const last = app.steps && app.steps.length ? app.steps[app.steps.length - 1].at : app.createdAt;
  return new Date(last);
}

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function daysLabel(days: number): string {
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

// Stage to use for progress displays: a returned application keeps its place in the pipeline.
export function progressStage(app: { stage: string; returnedFrom?: string | null }): string {
  return app.stage === "returned" ? app.returnedFrom ?? "submitted" : app.stage;
}
