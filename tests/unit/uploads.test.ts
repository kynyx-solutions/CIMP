import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { UPLOAD_RULES, isUploadPurpose, typeFromName, typeList, cleanFileName } from "@/lib/documents";
import { createTicket, receiveUpload } from "@/lib/uploads";
import { CARD_NUMBER } from "@/lib/idcard-number";

beforeAll(() => { process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890"; });

const jsonReq = (body: unknown) =>
  new NextRequest("http://localhost/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("upload rules", () => {
  it("knows every purpose and nothing else", () => {
    expect(isUploadPurpose("pitch_deck")).toBe(true);
    expect(isUploadPurpose("invoice")).toBe(true);
    expect(isUploadPurpose("constructor")).toBe(false);
    expect(isUploadPurpose("__proto__")).toBe(false);
  });
  it("reads the claimed type from the file name only for known types", () => {
    expect(typeFromName("Deck.PDF")).toBe("pdf");
    expect(typeFromName("photo.jpeg")).toBe("jpg");
    expect(typeFromName("x.exe")).toBeNull();
    expect(typeFromName("x.constructor")).toBeNull();
  });
  it("writes readable type lists and safe file names", () => {
    expect(typeList(["pdf", "jpg", "png"])).toBe("PDF, JPG or PNG");
    expect(cleanFileName('a"b\r\n<c>.pdf', "x.pdf")).toBe("a_b___c_.pdf");
    expect(cleanFileName("", "x.pdf")).toBe("x.pdf");
  });
  it("allows large pitch decks now that files bypass the app", () => {
    expect(UPLOAD_RULES.pitch_deck.maxBytes).toBe(10 * 1024 * 1024);
  });
});

describe("direct upload tickets", () => {
  it("refuses oversized, empty and wrong-type files before signing anything", async () => {
    expect(await createTicket("u1", "logo", "logo.png", 5 * 1024 * 1024)).toHaveProperty("error");
    expect(await createTicket("u1", "pitch_deck", "deck.pdf", 0)).toHaveProperty("error");
    expect(await createTicket("u1", "id_proof", "id.pptx", 1000)).toHaveProperty("error");
  });
  it("rejects a forged, foreign or session-key-signed ticket", async () => {
    const claims = { sub: "u1", p: "pitch_deck", n: "00000000-0000-0000-0000-000000000000.pdf", s: 10, f: "d.pdf" };
    // signed with the session secret itself: tickets use a derived key
    expect(await receiveUpload(jsonReq({ upload: jwt.sign(claims, process.env.JWT_SECRET!) }), "u1")).toHaveProperty("error");
    expect(await receiveUpload(jsonReq({ upload: "not-a-ticket" }), "u1")).toHaveProperty("error");
    expect(await receiveUpload(jsonReq({ applicationId: "x" }), "u1")).toHaveProperty("error");
  });
});

describe("ID-card numbers", () => {
  it("accepts only the random format", () => {
    expect(CARD_NUMBER.test("CB-2026-7KQ4M2XZ")).toBe(true);
    expect(CARD_NUMBER.test("CB-2026-0001")).toBe(false);
    expect(CARD_NUMBER.test("CB-2026-7KQ4M2XI")).toBe(false); // I is not in the alphabet
  });
});
