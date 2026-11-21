// Mentor / investor network: profile approvals (PRD MEN-1, MEN-2, workflow 6.2)
// and incubatee ↔ mentor connection requests (PRD MEN-3, workflow 6.3).
// Shared by client and server; keep free of server-only imports.
import { APPROVAL_RANK } from "@/lib/workflow";

// Who may review profiles. Demo assumption until CIMP answers PRD Q6.
export const MENTOR_REVIEW_RANK = 2;   // Incubation Manager and above
export const INVESTOR_REVIEW_RANK = 3; // Senior Manager and above

export type ProfileStatus = "draft" | "submitted" | "approved" | "rejected";
export const PROFILE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  none: "Not applied",
};

export function canReviewMentor(role: string) {
  return (APPROVAL_RANK[role] ?? 0) >= MENTOR_REVIEW_RANK;
}
export function canReviewInvestor(role: string) {
  return (APPROVAL_RANK[role] ?? 0) >= INVESTOR_REVIEW_RANK;
}

// Connection workflow (6.3): Incubatee requests → Incubation Manager review →
// Sr. Manager routes to the mentor → mentor accepts / declines.
export type ConnStatus = "requested" | "manager_approved" | "routed" | "active" | "declined" | "rejected";

interface ConnStageDef {
  label: string;
  waitingOn?: string;
  requiredRank?: number; // office rank needed to approve/reject at this stage
  next?: ConnStatus;
  actionLabel?: string;
}

export const CONN_STAGES: Record<ConnStatus, ConnStageDef> = {
  requested:        { label: "Office review", waitingOn: "Incubation Manager", requiredRank: 2, next: "manager_approved", actionLabel: "Approve & forward" },
  manager_approved: { label: "Routing", waitingOn: "Senior Manager", requiredRank: 3, next: "routed", actionLabel: "Route to mentor" },
  routed:           { label: "Mentor response", waitingOn: "Mentor" },
  active:           { label: "Connected" },
  declined:         { label: "Declined by mentor" },
  rejected:         { label: "Not approved by office" },
};

export const CONN_PIPELINE: ConnStatus[] = ["requested", "manager_approved", "routed", "active"];

export type ConnAction = "approve" | "reject" | "accept" | "decline";

/** Can this user take `action` on a connection in `status`? (mentorId = the connection's mentor) */
export function canActOnConnection(
  user: { role: string; userId: string },
  conn: { status: string; mentorId: string },
  action: ConnAction,
): boolean {
  const stage = CONN_STAGES[conn.status as ConnStatus];
  if (!stage) return false;
  if (action === "accept" || action === "decline") {
    return conn.status === "routed" && user.role === "mentor" && user.userId === conn.mentorId;
  }
  // approve / reject by the office, at or above the stage's rank
  if (!stage.requiredRank) return false;
  return (APPROVAL_RANK[user.role] ?? 0) >= stage.requiredRank;
}

export const CONN_TYPES = [
  { value: "mentorship", label: "Mentorship" },
  { value: "investment", label: "Investment discussion" },
] as const;
