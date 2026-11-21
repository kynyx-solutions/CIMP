import { describe, expect, it } from "vitest";
import { CEO_LIMIT_INR, canActFinance, nextStatus } from "@/lib/finance";

describe("finance approval chain (FIN-2)", () => {
  const small = 45_000, big = 180_000;

  it("walks a small request: verify → approve → pay", () => {
    expect(nextStatus("submitted", "verify", small)).toBe("verified");
    expect(nextStatus("verified", "approve", small)).toBe("approved");
    expect(nextStatus("approved", "pay", small)).toBe("paid");
    expect(nextStatus("approved", "final_approve", small)).toBeNull(); // no CEO step needed
  });

  it("needs the CEO above the limit before payment", () => {
    expect(nextStatus("approved", "pay", big)).toBeNull();
    expect(nextStatus("approved", "final_approve", big)).toBe("final_approved");
    expect(nextStatus("final_approved", "pay", big)).toBe("paid");
  });

  it("treats exactly the limit as within it", () => {
    expect(nextStatus("approved", "pay", CEO_LIMIT_INR)).toBe("paid");
    expect(nextStatus("approved", "final_approve", CEO_LIMIT_INR)).toBeNull();
  });

  it("only allows send back and reject before approval is complete", () => {
    for (const s of ["submitted", "verified", "approved"]) {
      expect(nextStatus(s, "reject", small)).toBe("rejected");
      expect(nextStatus(s, "send_back", small)).toBe("returned");
    }
    expect(nextStatus("paid", "reject", small)).toBeNull();
    expect(nextStatus("final_approved", "send_back", big)).toBeNull();
  });

  it("gives each step to the right role", () => {
    expect(canActFinance("accounts", "submitted", "verify", small)).toBe(true);
    expect(canActFinance("manager", "submitted", "verify", small)).toBe(false);
    expect(canActFinance("sr_manager", "verified", "approve", small)).toBe(true);
    expect(canActFinance("manager", "verified", "approve", small)).toBe(false);
    expect(canActFinance("accounts", "verified", "approve", small)).toBe(false);
    expect(canActFinance("sr_manager", "approved", "final_approve", big)).toBe(false);
    expect(canActFinance("ceo", "approved", "final_approve", big)).toBe(true);
    expect(canActFinance("accounts", "final_approved", "pay", big)).toBe(true);
    expect(canActFinance("ceo", "final_approved", "pay", big)).toBe(false);
  });

  it("lets the current reviewer send back", () => {
    expect(canActFinance("accounts", "submitted", "send_back", small)).toBe(true);
    expect(canActFinance("sr_manager", "submitted", "send_back", small)).toBe(false);
    expect(canActFinance("sr_manager", "verified", "send_back", small)).toBe(true);
    expect(canActFinance("ceo", "approved", "reject", big)).toBe(true);
    expect(canActFinance("sr_manager", "approved", "reject", big)).toBe(false);
  });
});
