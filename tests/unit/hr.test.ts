import { describe, expect, it } from "vitest";
import { isLate, istToday, leaveApproverRole, workingDays } from "@/lib/hr";

describe("leave (HR-2)", () => {
  it("counts Monday to Saturday, skipping Sundays", () => {
    // 2026-11-21 is a Saturday, 2026-11-22 a Sunday
    expect(workingDays("2026-11-21", "2026-11-23")).toBe(2);
    expect(workingDays("2026-11-16", "2026-11-22")).toBe(6);
    expect(workingDays("2026-11-22", "2026-11-22")).toBe(0);
  });

  it("supports a half day only for a one-day leave", () => {
    expect(workingDays("2026-11-23", "2026-11-23", true)).toBe(0.5);
    expect(workingDays("2026-11-23", "2026-11-24", true)).toBe(2);
  });

  it("rejects reversed or invalid ranges", () => {
    expect(workingDays("2026-11-24", "2026-11-23")).toBe(0);
    expect(workingDays("not-a-date", "2026-11-23")).toBe(0);
  });

  it("routes approval to the right person", () => {
    expect(leaveApproverRole("staff")).toBe("sr_manager");
    expect(leaveApproverRole("executive")).toBe("sr_manager");
    expect(leaveApproverRole("sr_manager")).toBe("ceo");
    expect(leaveApproverRole("accounts")).toBe("ceo");
    expect(leaveApproverRole("admin_it")).toBe("ceo");
    expect(leaveApproverRole("ceo")).toBeNull();
  });
});

describe("attendance (HR-1)", () => {
  it("marks late after 10:15 IST", () => {
    expect(isLate("2026-11-23T04:45:00Z")).toBe(false); // 10:15 IST
    expect(isLate("2026-11-23T04:46:00Z")).toBe(true); // 10:16 IST
    expect(isLate("2026-11-23T03:30:00Z")).toBe(false); // 09:00 IST
  });

  it("uses the IST date, not UTC", () => {
    expect(istToday(new Date("2026-11-21T19:00:00Z"))).toBe("2026-11-22"); // 00:30 IST next day
    expect(istToday(new Date("2026-11-21T18:00:00Z"))).toBe("2026-11-21");
  });
});
