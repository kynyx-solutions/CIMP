import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { checkWebhookUrl, hashKey, newApiKey, sign } from "@/lib/integrations";
import { redact } from "@/lib/ai";
import { rateLimit, resetLimit } from "@/lib/ratelimit";
import { checkEnv } from "@/lib/env";
import { readStored, sniffType } from "@/lib/storage";

describe("partner API keys and webhooks (API-1, API-2)", () => {
  it("stores only a hash of the key", () => {
    const k = newApiKey();
    expect(k.key).toMatch(/^cbk_/);
    expect(k.keyHash).toBe(hashKey(k.key));
    expect(k.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(k.prefix.length).toBeLessThan(k.key.length);
  });

  it("signs webhook bodies with HMAC-SHA256", () => {
    const body = JSON.stringify({ event: "startup.published" });
    expect(sign("whsec_x", body)).toBe("sha256=" + createHmac("sha256", "whsec_x").update(body).digest("hex"));
  });

  it("blocks private, local and non-https targets", async () => {
    expect(await checkWebhookUrl("http://partner.example.com/hook")).toMatch(/https/);
    expect(await checkWebhookUrl("https://10.0.0.5/hook")).toMatch(/private/);
    expect(await checkWebhookUrl("https://192.168.1.10/hook")).toMatch(/private/);
    expect(await checkWebhookUrl("https://169.254.169.254/latest/meta-data")).toMatch(/private/);
    expect(await checkWebhookUrl("https://user:pw@example.com/")).toMatch(/credentials/);
    expect(await checkWebhookUrl("not a url")).toMatch(/valid URL/);
  });
});

describe("AI privacy (AI-2)", () => {
  it("removes email addresses and phone numbers", () => {
    const out = redact("Call 98765 43210 or +91-9876543210, mail founder@greengrid.in. Revenue 1200000.");
    expect(out).not.toMatch(/98765|9876543210|greengrid\.in/);
    expect(out).toContain("[email removed]");
    expect(out).toContain("[phone removed]");
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and resets", () => {
    const key = "test:" + Math.random();
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    resetLimit(key);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
  });
});

describe("environment check", () => {
  const good = {
    NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db:5432/cimp", JWT_SECRET: "x".repeat(48),
    COMPANY_EMAIL_DOMAINS: "cimp.ac.in", NEXT_PUBLIC_APP_URL: "https://portal.example.in", SMTP_HOST: "smtp", ANTHROPIC_API_KEY: "k",
  } as unknown as NodeJS.ProcessEnv;

  it("accepts a complete production config", () => {
    expect(checkEnv(good)).toEqual([]);
  });

  it("refuses weak or missing production settings", () => {
    const errs = checkEnv({ ...good, JWT_SECRET: "short", NEXT_PUBLIC_APP_URL: "http://portal.example.in" }).filter((i) => i.level === "error");
    expect(errs.map((e) => e.msg).join(" ")).toMatch(/JWT_SECRET[\s\S]*https/);
  });

  it("requires S3 settings when S3 storage is chosen", () => {
    const errs = checkEnv({ ...good, STORAGE_DRIVER: "s3" }).filter((i) => i.level === "error");
    expect(errs).toHaveLength(4);
  });

  it("requires a mail account in production unless log-only mode is chosen", () => {
    const noMail = { ...good, SMTP_HOST: undefined } as unknown as NodeJS.ProcessEnv;
    expect(checkEnv(noMail).some((i) => i.level === "error" && /mail account/.test(i.msg))).toBe(true);
    expect(checkEnv({ ...noMail, MAIL_TRANSPORT: "log" }).some((i) => i.level === "error")).toBe(false);
  });

  it("only warns in development", () => {
    expect(checkEnv({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv).every((i) => i.level === "warn")).toBe(true);
  });
});

describe("file storage", () => {
  it("identifies files by content, not name", () => {
    expect(sniffType(Buffer.from("%PDF-1.7 ..."))).toBe("pdf");
    expect(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });

  it("refuses stored names that could escape the folder", async () => {
    await expect(readStored("../../.env")).rejects.toThrow(/Invalid/);
    await expect(readStored("00000000-0000-0000-0000-000000000000.exe")).rejects.toThrow(/Invalid/);
  });
});
