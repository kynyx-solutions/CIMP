import { describe, expect, it } from "vitest";
import { cronMatches, istParts, nextRun } from "@/lib/cron";

describe("scheduler cron (IST)", () => {
  it("reads times in IST", () => {
    const p = istParts(new Date("2026-11-23T03:30:00Z"));
    expect(p).toMatchObject({ hour: 9, minute: 0, weekday: 1, day: 23, month: 11 });
  });

  it("matches lists, ranges and steps", () => {
    const mon9 = istParts(new Date("2026-11-23T03:30:00Z")); // Monday 09:00 IST
    expect(cronMatches("0 9 * * 1", mon9)).toBe(true);
    expect(cronMatches("0 9 * * 2-6", mon9)).toBe(false);
    expect(cronMatches("*/15 9 * * *", mon9)).toBe(true);
    expect(cronMatches("0 8,9 * * *", mon9)).toBe(true);
    expect(cronMatches("0 9 * *", mon9)).toBe(false); // four fields
    expect(cronMatches("0 9 * * x", mon9)).toBe(false);
  });

  it("finds the next run", () => {
    const next = nextRun("0 2 * * *", new Date("2026-11-21T00:00:00Z")); // 05:30 IST
    expect(next?.toISOString()).toBe("2026-11-21T20:30:00.000Z"); // 02:00 IST on the 22nd
  });
});
