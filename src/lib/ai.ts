// AI assistant for office users (BIIF 2.0: "custom GPT / AI tools"). Server-only.
// Claude via the official Anthropic SDK. Advisory only: reviewers decide.
// Privacy: contact details (phone numbers, emails) are removed before anything is sent.
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AI_MODEL = "claude-opus-5-5";
const PRICE_IN = 4 / 1_000_000, PRICE_OUT = 20 / 1_000_000; // USD per token, claude-opus-5-5
export const AI_LIMIT_PER_HOUR = 30;

export type AiFeature = "application_review" | "qpr_insight" | "draft";

/** A credential the SDK can use is present in the server's environment. */
export const aiConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function aiSettings(): Promise<{ enabled: boolean }> {
  const row = await prisma.siteConfig.findUnique({ where: { key: "aiSettings" } }).catch(() => null);
  return { enabled: (row?.value as any)?.enabled === true };
}
export async function setAiEnabled(enabled: boolean, by: string) {
  await prisma.siteConfig.upsert({
    where: { key: "aiSettings" },
    create: { key: "aiSettings", value: { enabled } as Prisma.InputJsonValue, updatedBy: by },
    update: { value: { enabled } as Prisma.InputJsonValue, updatedBy: by },
  });
}

/** Why AI can't run right now, or null. */
export async function aiUnavailable(userId: string): Promise<string | null> {
  if (!aiConfigured()) return "The AI assistant is not set up: add ANTHROPIC_API_KEY to the server settings.";
  if (!(await aiSettings()).enabled) return "The AI assistant is switched off. Admin IT can turn it on in Admin → AI assistant.";
  const recent = await prisma.aiRun.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= AI_LIMIT_PER_HOUR) return `You have reached ${AI_LIMIT_PER_HOUR} AI requests this hour. Try again later.`;
  return null;
}

/** Remove phone numbers and email addresses from text sent to the model. */
export function redact(s: string) {
  return s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]")
    .replace(/(\+?\d[\d\s-]{8,}\d)/g, "[phone removed]");
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/**
 * One Claude call that must return JSON matching `validate`. The reply is parsed and checked
 * here; one retry asks the model to fix invalid JSON. Every call is recorded in AiRun.
 */
export async function runJson<T>(opts: {
  feature: AiFeature; user: { userId: string; name: string }; entityId?: string | null;
  system: string; prompt: string; validate: (v: unknown) => T | null; maxTokens?: number;
}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let inputTokens = 0, outputTokens = 0;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await anthropic().beta.messages.create({
        model: AI_MODEL,
        max_tokens: opts.maxTokens ?? 4000,
        system: opts.system,
        output_config: { effort: "medium" },
        // If a safety classifier declines, the API re-runs the request on a suitable model
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      });
      inputTokens += res.usage.input_tokens;
      outputTokens += res.usage.output_tokens;
      if (res.stop_reason === "refusal") throw new Error("The model declined this request");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      let parsed: unknown = null;
      try { parsed = JSON.parse(json); } catch { /* retry below */ }
      const data = parsed === null ? null : opts.validate(parsed);
      if (data) {
        await record(opts, inputTokens, outputTokens, "ok");
        return { ok: true, data };
      }
      messages.push({ role: "assistant", content: res.content }, { role: "user", content: "That was not valid JSON in the requested shape. Reply again with only the JSON object." });
    }
    throw new Error("The AI reply could not be read");
  } catch (err) {
    const message = err instanceof Anthropic.RateLimitError ? "The AI service is busy; try again in a minute"
      : err instanceof Anthropic.AuthenticationError ? "The AI key was rejected; Admin IT should check ANTHROPIC_API_KEY"
      : err instanceof Anthropic.APIError ? `AI service error (${err.status})`
      : String((err as Error)?.message ?? err).slice(0, 200);
    await record(opts, inputTokens, outputTokens, "failed", message);
    return { ok: false, error: message };
  }
}

async function record(opts: { feature: AiFeature; user: { userId: string; name: string }; entityId?: string | null }, inputTokens: number, outputTokens: number, status: string, error?: string) {
  await prisma.aiRun.create({ data: { userId: opts.user.userId, userName: opts.user.name, feature: opts.feature, entityId: opts.entityId ?? null, model: AI_MODEL, inputTokens, outputTokens, status, error: error ?? null } }).catch(() => {});
}

export const costUsd = (inTok: number, outTok: number) => inTok * PRICE_IN + outTok * PRICE_OUT;

// ── Small validators (no extra dependency) ──
export const isStr = (v: unknown, max = 4000): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
export const strList = (v: unknown, maxItems = 8): string[] | null =>
  Array.isArray(v) && v.length <= maxItems && v.every((x) => isStr(x, 600)) ? (v as string[]) : null;
