import { describe, expect, it } from "vitest";
import { APPROVAL_RANK, OFFICE_ROLES, PIPELINE, canAct, isOfficeRole } from "@/lib/workflow";

describe("application approval (WF-1)", () => {
  it("has four office stages before approval", () => {
    expect(PIPELINE).toEqual(["submitted", "executive_accepted", "manager_reviewed", "sr_manager_approved", "ceo_approved"]);
  });

  it("lets each rank act on its stage and lower ones, never higher", () => {
    expect(canAct("executive", "submitted", "advance")).toBe(true);
    expect(canAct("executive", "executive_accepted", "advance")).toBe(false);
    expect(canAct("manager", "submitted", "advance")).toBe(true);
    expect(canAct("ceo", "sr_manager_approved", "advance")).toBe(true);
    expect(canAct("sr_manager", "sr_manager_approved", "advance")).toBe(false);
  });

  it("keeps the fast-track for the CEO", () => {
    expect(canAct("ceo", "submitted", "fasttrack")).toBe(true);
    expect(canAct("sr_manager", "submitted", "fasttrack")).toBe(false);
  });

  it("gives founders and non-approving roles no authority", () => {
    for (const r of ["incubatee", "mentor", "staff", "accounts", "social_media", "admin_it"])
      expect(canAct(r, "submitted", "advance")).toBe(false);
  });

  it("allows publishing only approved applications, by CEO or Admin IT", () => {
    expect(canAct("ceo", "ceo_approved", "toggle_public", "approved")).toBe(true);
    expect(canAct("admin_it", "ceo_approved", "toggle_public", "approved")).toBe(true);
    expect(canAct("ceo", "submitted", "toggle_public", "pending")).toBe(false);
    expect(canAct("manager", "ceo_approved", "toggle_public", "approved")).toBe(false);
  });

  it("knows every office role", () => {
    for (const r of OFFICE_ROLES) expect(isOfficeRole(r)).toBe(true);
    expect(isOfficeRole("incubatee")).toBe(false);
    expect(APPROVAL_RANK.ceo).toBeGreaterThan(APPROVAL_RANK.sr_manager);
  });
});
