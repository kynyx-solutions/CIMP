// Partner integrations (BIIF 2.0): API keys for the read-only partner API and signed webhooks.
// Server-only.
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { prisma } from "@/lib/prisma";

// ── API keys ────────────────────────────────────────────────────────────────
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key: shown once to the admin, stored only as a hash. */
export function newApiKey() {
  const key = `cbk_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashKey(key) };
}

const hits = new Map<string, { n: number; reset: number }>();
const LIMIT_PER_MIN = 60;

/** Authenticate `Authorization: Bearer cbk_…` and check the scope; applies a per-key rate limit. */
export async function authApiKey(header: string | null, scope: string): Promise<{ ok: true; keyId: string } | { ok: false; status: number; error: string }> {
  const m = /^Bearer\s+(cbk_[A-Za-z0-9_-]{20,64})$/.exec(header ?? "");
  if (!m) return { ok: false, status: 401, error: "Send an API key as: Authorization: Bearer cbk_…" };
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(m[1]) } });
  if (!key || key.revokedAt) return { ok: false, status: 401, error: "Invalid or revoked API key" };
  if (!key.scopes.includes(scope)) return { ok: false, status: 403, error: `This key lacks the ${scope} scope` };
  const now = Date.now(), h = hits.get(key.id);
  if (!h || h.reset < now) hits.set(key.id, { n: 1, reset: now + 60_000 });
  else if (++h.n > LIMIT_PER_MIN) return { ok: false, status: 429, error: `Rate limit: ${LIMIT_PER_MIN} requests per minute` };
  // last-used is informative; update at most once a minute per key
  if (!key.lastUsedAt || now - key.lastUsedAt.getTime() > 60_000) await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, keyId: key.id };
}

// ── Webhooks ────────────────────────────────────────────────────────────────
function privateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Webhook targets must be public HTTPS endpoints, so the portal cannot be used to reach
 * internal services (SSRF). Local HTTP receivers are allowed only outside production.
 */
export async function checkWebhookUrl(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return "Enter a valid URL"; }
  if (u.username || u.password) return "The URL must not contain credentials";
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  if (local && process.env.NODE_ENV !== "production") return u.protocol === "http:" || u.protocol === "https:" ? null : "Use http or https";
  if (u.protocol !== "https:") return "Webhook URLs must use https://";
  try {
    const addrs = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => privateAddress(a.address))) return "The URL points to a private or local network address";
  } catch { return "The host name could not be resolved"; }
  return null;
}

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;
export const sign = (secret: string, body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

async function deliver(hook: { id: string; url: string; secret: string }, event: string, data: unknown) {
  const id = randomUUID();
  const body = JSON.stringify({ id, event, createdAt: new Date().toISOString(), data });
  const started = Date.now();
  let status: number | null = null, error: string | null = null;
  try {
    const bad = await checkWebhookUrl(hook.url); // re-checked at send time (DNS can change)
    if (bad) throw new Error(bad);
    const res = await fetch(hook.url, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", "User-Agent": "CIMP-BIIF-Webhooks/1.0", "X-CIMP-Event": event, "X-CIMP-Delivery": id, "X-CIMP-Signature": sign(hook.secret, body) },
      body,
    });
    status = res.status;
    if (status >= 300) error = `HTTP ${status}`;
  } catch (e) {
    error = String((e as Error)?.message ?? e).slice(0, 200);
  }
  const durationMs = Date.now() - started;
  await prisma.webhookDelivery.create({ data: { webhookId: hook.id, event, status, error, durationMs } });
  await prisma.webhook.update({ where: { id: hook.id }, data: { lastStatus: status, lastError: error, lastDeliveredAt: new Date() } });
  return { status, error, durationMs };
}

/** Send an event to every active webhook subscribed to it. Never throws. Callers await it: on
 * serverless hosting work left running after the response is sent may never finish. Each
 * delivery times out on its own, so this adds a few seconds at most. */
export async function emitEvent(event: string, data: unknown): Promise<void> {
  try {
    const hooks = await prisma.webhook.findMany({ where: { active: true, events: { has: event } } });
    await Promise.all(hooks.map((h) => deliver(h, event, data)));
  } catch (err) {
    console.error("[webhooks] emit failed", event, err);
  }
}

export async function sendTestEvent(hookId: string) {
  const hook = await prisma.webhook.findUnique({ where: { id: hookId } });
  if (!hook) return null;
  return deliver(hook, "ping", { message: "Test event from the CIMP-BIIF portal" });
}
