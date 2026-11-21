// Configurable Excel exports (PRD XLS-1). Shared column definitions; the server part loads rows
// and builds the workbook in a background job.
export type DatasetKey = "applications" | "mentors" | "connections" | "qpr" | "sessions";

export const DATASETS: Record<DatasetKey, { label: string; columns: { key: string; label: string; default?: boolean }[]; filters?: { key: string; label: string; options: string[] }[] }> = {
  applications: {
    label: "Applications and startups",
    columns: [
      { key: "startupName", label: "Startup", default: true }, { key: "applicantName", label: "Founder", default: true },
      { key: "email", label: "Founder email" }, { key: "phone", label: "Phone" },
      { key: "industry", label: "Sector", default: true }, { key: "ventureStage", label: "Venture stage", default: true },
      { key: "city", label: "City", default: true }, { key: "state", label: "State" },
      { key: "stage", label: "Review stage", default: true }, { key: "status", label: "Status", default: true },
      { key: "isPublic", label: "Published" }, { key: "officeEdited", label: "Edited by office" },
      { key: "teamSize", label: "Team size" }, { key: "fundingRaised", label: "Funding raised" },
      { key: "registrationStatus", label: "Registration" }, { key: "cin", label: "CIN" }, { key: "dpiitNumber", label: "DPIIT number" },
      { key: "createdAt", label: "Applied on", default: true },
    ],
    filters: [{ key: "status", label: "Status", options: ["pending", "approved", "rejected"] }],
  },
  mentors: {
    label: "Mentors and investors",
    columns: [
      { key: "name", label: "Name", default: true }, { key: "email", label: "Email", default: true },
      { key: "headline", label: "Headline", default: true }, { key: "organisation", label: "Organisation" },
      { key: "sectors", label: "Sectors", default: true }, { key: "yearsExperience", label: "Years of experience" },
      { key: "status", label: "Mentor status", default: true }, { key: "investorStatus", label: "Investor status", default: true },
      { key: "ticketSize", label: "Ticket size" }, { key: "isPublic", label: "Listed publicly" }, { key: "createdAt", label: "Joined on" },
    ],
  },
  connections: {
    label: "Mentor connections",
    columns: [
      { key: "startup", label: "Startup", default: true }, { key: "founder", label: "Founder", default: true },
      { key: "mentor", label: "Mentor", default: true }, { key: "type", label: "Type", default: true },
      { key: "status", label: "Status", default: true }, { key: "sessions", label: "Sessions held", default: true },
      { key: "avgRating", label: "Average rating" }, { key: "createdAt", label: "Requested on", default: true },
    ],
  },
  qpr: {
    label: "Quarterly progress reports",
    columns: [
      { key: "startup", label: "Startup", default: true }, { key: "period", label: "Quarter", default: true },
      { key: "status", label: "Status", default: true }, { key: "submittedAt", label: "Submitted on", default: true },
      { key: "revenue", label: "Revenue (₹)", default: true }, { key: "customers", label: "Customers / users", default: true },
      { key: "teamSize", label: "Team size", default: true }, { key: "fundsRaised", label: "Funds raised (₹)" },
      { key: "milestones", label: "Milestones" }, { key: "challenges", label: "Challenges" }, { key: "supportNeeded", label: "Support needed" },
      { key: "reviewedBy", label: "Reviewed by" },
    ],
  },
  sessions: {
    label: "Mentorship sessions",
    columns: [
      { key: "startup", label: "Startup", default: true }, { key: "mentor", label: "Mentor", default: true },
      { key: "scheduledAt", label: "Date", default: true }, { key: "durationMin", label: "Minutes", default: true },
      { key: "mode", label: "Mode", default: true }, { key: "status", label: "Status", default: true },
      { key: "mentorRating", label: "Mentor's rating" }, { key: "founderRating", label: "Founder's rating", default: true }, { key: "agenda", label: "Agenda" },
    ],
  },
};

export const DATASET_KEYS = Object.keys(DATASETS) as DatasetKey[];

/** Office roles that may see reports and download exports (PRD RBAC-5). */
export const REPORT_ROLES = ["executive", "manager", "sr_manager", "ceo", "admin_it"];
