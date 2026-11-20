import type { Role } from "@/lib/auth";
import { OFFICE_ROLES } from "@/lib/workflow";

// Staff accounts are never self-service: the CEO is created from the CLI
// (scripts/create-ceo.js) and other office users are created by the CEO.
export const STAFF_ROLES: Role[] = OFFICE_ROLES;

// Roles anyone can sign up for (email/password or Google).
// Add new non-staff roles (e.g. "mentor") here once they exist in the app.
export const PUBLIC_ROLES: Role[] = ["incubatee"];

export function isStaffRole(role: string | undefined | null): boolean {
  return !!role && (STAFF_ROLES as string[]).includes(role);
}

export function isPublicRole(role: string | undefined | null): role is Role {
  return !!role && (PUBLIC_ROLES as string[]).includes(role);
}

// COMPANY_EMAIL_DOMAINS="acme.com,acme.in" — staff emails must be on one of these.
export function getCompanyDomains(): string[] {
  return (process.env.COMPANY_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isCompanyEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return getCompanyDomains().includes(domain);
}
