// Partner integrations admin (Admin IT; the CEO can view).
//   GET                                                  API keys, webhooks, recent deliveries
//   POST  { kind:"api_key", name, scopes }               → the key, shown once
//   POST  { kind:"webhook", url, events }                → the signing secret, shown once
//   PATCH { kind:"api_key", id, action:"revoke" } | { kind:"webhook", id, action:"toggle"|"test" }
//   DELETE ?webhookId=…
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { API_SCOPES, WEBHOOK_EVENTS } from "@/lib/crm";
import { checkWebhookUrl, newApiKey, newWebhookSecret, sendTestEvent } from "@/lib/integrations";
import { audit } from "@/lib/audit";

const view = (r: string) => r === "admin_it" || r === "ceo";
const edit = (r: string) => r === "admin_it";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !view(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [keys, hooks] = await Promise.all([
    prisma.apiKey.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true } }),
    prisma.webhook.findMany({ orderBy: { createdAt: "desc" }, include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } } }),
  ]);
  return NextResponse.json({ keys: withId(keys), webhooks: withId(hooks).map(({ secret, ...h }: any) => ({ ...h, secretHint: `${secret.slice(0, 10)}…` })), canEdit: edit(user.role) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !edit(user.role)) return NextResponse.json({ error: "Only Admin IT manages integrations" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.kind === "api_key") {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
    const scopes = Array.isArray(b.scopes) ? API_SCOPES.map((s) => s.value).filter((s) => b.scopes.includes(s)) : [];
    if (name.length < 2) return NextResponse.json({ error: "Name the key after the partner who will use it" }, { status: 400 });
    if (!scopes.length) return NextResponse.json({ error: "Choose at least one scope" }, { status: 400 });
    const k = newApiKey();
    const row = await prisma.apiKey.create({ data: { name, prefix: k.prefix, keyHash: k.keyHash, scopes, createdById: user.userId } });
    await audit(req, user, "integration.key_create", "integration", row.id, `Created API key "${name}" (${scopes.join(", ")})`);
    return NextResponse.json({ success: true, key: k.key, id: row.id }, { status: 201 });
  }
  if (b.kind === "webhook") {
    const url = typeof b.url === "string" ? b.url.trim().slice(0, 500) : "";
    const bad = await checkWebhookUrl(url);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const events = Array.isArray(b.events) ? WEBHOOK_EVENTS.map((e) => e.value).filter((e) => b.events.includes(e)) : [];
    if (!events.length) return NextResponse.json({ error: "Choose at least one event" }, { status: 400 });
    const secret = newWebhookSecret();
    const row = await prisma.webhook.create({ data: { url, secret, events, createdById: user.userId } });
    await audit(req, user, "integration.webhook_create", "integration", row.id, `Added webhook ${new URL(url).host} for ${events.join(", ")}`);
    return NextResponse.json({ success: true, secret, id: row.id }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !edit(user.role)) return NextResponse.json({ error: "Only Admin IT manages integrations" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isId(b.id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (b.kind === "api_key" && b.action === "revoke") {
    const k = await prisma.apiKey.update({ where: { id: b.id }, data: { revokedAt: new Date() } }).catch(() => null);
    if (!k) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await audit(req, user, "integration.key_revoke", "integration", k.id, `Revoked API key "${k.name}"`);
    return NextResponse.json({ success: true });
  }
  if (b.kind === "webhook" && b.action === "toggle") {
    const h = await prisma.webhook.findUnique({ where: { id: b.id } });
    if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.webhook.update({ where: { id: h.id }, data: { active: !h.active } });
    await audit(req, user, "integration.webhook_toggle", "integration", h.id, `${h.active ? "Paused" : "Resumed"} webhook ${new URL(h.url).host}`);
    return NextResponse.json({ success: true, active: !h.active });
  }
  if (b.kind === "webhook" && b.action === "test") {
    const r = await sendTestEvent(b.id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: !r.error, ...r });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !edit(user.role)) return NextResponse.json({ error: "Only Admin IT manages integrations" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("webhookId");
  if (!isId(id)) return NextResponse.json({ error: "webhookId required" }, { status: 400 });
  const h = await prisma.webhook.delete({ where: { id } }).catch(() => null);
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(req, user, "integration.webhook_delete", "integration", h.id, `Deleted webhook ${new URL(h.url).host}`);
  return NextResponse.json({ success: true });
}
