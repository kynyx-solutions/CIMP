// CRM for partners, sponsors, CSR and government relationships (BIIF 2.0). Shared by client and server.
import { APPROVAL_RANK } from "@/lib/workflow";

export const PARTNER_TYPES = [
  { value: "corporate", label: "Corporate" }, { value: "csr", label: "CSR funder" }, { value: "government", label: "Government" },
  { value: "academic", label: "Academic" }, { value: "investor_network", label: "Investor network" }, { value: "incubator", label: "Incubator / accelerator" },
  { value: "other", label: "Other" },
] as const;

export const PARTNER_STAGES = [
  { value: "lead", label: "Lead" }, { value: "contacted", label: "Contacted" }, { value: "proposal", label: "Proposal sent" },
  { value: "mou_signed", label: "MoU signed" }, { value: "active", label: "Active partner" }, { value: "dormant", label: "Dormant" },
] as const;

export const ACTIVITY_KINDS = [
  { value: "call", label: "Call" }, { value: "meeting", label: "Meeting" }, { value: "email", label: "Email" },
  { value: "note", label: "Note" }, { value: "follow_up", label: "Follow-up" },
] as const;

export const typeLabel = (v: string) => PARTNER_TYPES.find((t) => t.value === v)?.label ?? v;
export const stageLabel = (v: string) => PARTNER_STAGES.find((t) => t.value === v)?.label ?? v;

/** Executive and above, plus Admin IT, work in the CRM. */
export const canUseCrm = (role: string) => (APPROVAL_RANK[role] ?? 0) >= 1 || role === "admin_it";

// Partner API (read-only) and webhooks
export const API_SCOPES = [
  { value: "startups:read", label: "Published startups" },
  { value: "stats:read", label: "Programme statistics" },
] as const;
export const WEBHOOK_EVENTS = [
  { value: "application.approved", label: "Application approved by the CEO" },
  { value: "startup.published", label: "Startup published to the directory" },
  { value: "mentor.approved", label: "Mentor profile approved" },
] as const;
