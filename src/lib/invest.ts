// Investment proposals (PRD INV-1). Shared by client and server.
import { APPROVAL_RANK } from "@/lib/workflow";

export const INSTRUMENTS = [
  { value: "equity", label: "Equity" },
  { value: "convertible", label: "Convertible note / CCD" },
  { value: "grant", label: "Grant" },
  { value: "other", label: "Other" },
] as const;

export const PROPOSAL_STATUS: Record<string, { label: string; tone: "warn" | "good" | "bad" | "muted" }> = {
  submitted: { label: "With the office", tone: "warn" },
  pitch_scheduled: { label: "Pitch scheduled", tone: "warn" },
  invested: { label: "Invested", tone: "good" },
  declined: { label: "Not taken forward", tone: "bad" },
  withdrawn: { label: "Withdrawn", tone: "muted" },
};
export const OPEN_PROPOSAL = ["submitted", "pitch_scheduled"];

/** Incubation Manager and above arrange pitches and record outcomes. */
export const canHandleProposals = (role: string) => (APPROVAL_RANK[role] ?? 0) >= 2;
