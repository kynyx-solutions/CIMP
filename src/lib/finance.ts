// Accounts and finance approvals (BIIF 2.0, CIMP overview §6.4). Shared by client and server.
//
//   submitted ──Accounts verifies──▶ verified ──Sr Manager approves──▶ approved
//        ▲                                                   │ (amount above the CEO limit)
//        └──────── returned (send back) ◀────────────────────┤──CEO approves──▶ final_approved
//                                                            ▼
//                                            Accounts records payment ──▶ paid
// Any review step can reject (with a reason) or send back to the requester.
import { APPROVAL_RANK, isOfficeRole } from "@/lib/workflow";

export const CEO_LIMIT_INR = 100_000; // requests above ₹1 lakh need the CEO's final approval

export const FINANCE_KINDS = [
  { value: "grant_tranche", label: "Seed-fund tranche to a startup" },
  { value: "disbursement", label: "Programme expense" },
  { value: "vendor_invoice", label: "Vendor invoice" },
  { value: "reimbursement", label: "Staff reimbursement" },
] as const;
export const kindLabel = (k: string) => FINANCE_KINDS.find((x) => x.value === k)?.label ?? k;

export const FIN_STATUS: Record<string, { label: string; tone: "warn" | "good" | "bad" | "muted"; waitingOn?: string }> = {
  submitted: { label: "Waiting for Accounts", tone: "warn", waitingOn: "Accounts Officer" },
  verified: { label: "Waiting for Sr Manager", tone: "warn", waitingOn: "Senior Manager" },
  approved: { label: "Approved, to be paid", tone: "warn", waitingOn: "Accounts Officer" },
  final_approved: { label: "CEO approved, to be paid", tone: "warn", waitingOn: "Accounts Officer" },
  paid: { label: "Paid", tone: "good" },
  returned: { label: "Sent back to requester", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
};

export type FinAction = "verify" | "approve" | "final_approve" | "pay" | "send_back" | "reject";

/** Which status an action leads to, given the amount. */
export function nextStatus(status: string, action: FinAction, amountInr: number): string | null {
  if (action === "reject") return ["submitted", "verified", "approved"].includes(status) ? "rejected" : null;
  if (action === "send_back") return ["submitted", "verified", "approved"].includes(status) ? "returned" : null;
  if (status === "submitted" && action === "verify") return "verified";
  if (status === "verified" && action === "approve") return "approved"; // above the limit, the CEO approves next
  if (status === "approved" && action === "final_approve" && amountInr > CEO_LIMIT_INR) return "final_approved";
  if (action === "pay" && (status === "final_approved" || (status === "approved" && amountInr <= CEO_LIMIT_INR))) return "paid";
  return null;
}

/** May this role take `action` on a request in `status`? (The requester never reviews their own request.) */
export function canActFinance(role: string, status: string, action: FinAction, amountInr: number): boolean {
  const rank = APPROVAL_RANK[role] ?? 0;
  const isAccounts = role === "accounts";
  if (!nextStatus(status, action, amountInr)) return false;
  switch (action) {
    case "verify": return isAccounts;
    case "approve": return rank >= 3; // Senior Manager or CEO
    case "final_approve": return role === "ceo";
    case "pay": return isAccounts;
    case "send_back":
    case "reject":
      return status === "submitted" ? isAccounts : status === "verified" ? rank >= 3 : role === "ceo";
  }
}

/** Who is told when a request reaches `status`. */
export const NEXT_REVIEWER: Record<string, { roles: string[]; label: string } | undefined> = {
  submitted: { roles: ["accounts"], label: "Accounts Officer" },
  verified: { roles: ["sr_manager"], label: "Senior Manager" },
  approved: undefined, // CEO or Accounts depending on the amount (handled in the API)
};

export const canRequestFinance = (role: string) => isOfficeRole(role);
/** Seeing every request and the seed-fund register. */
export const FINANCE_VIEWERS = ["accounts", "sr_manager", "ceo"];

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
