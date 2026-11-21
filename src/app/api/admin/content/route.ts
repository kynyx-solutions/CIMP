// Website content (PRD WEB-6). Admin IT edits; the CEO can view.
//   GET                          all keys with current value, default and last editor
//   PUT    { key, value }        save
//   DELETE ?key=…                restore the default
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { CONTENT_CHOICES, CONTENT_DEFAULTS, CONTENT_KEYS, CONTENT_META, checkChoices, checkShape, trimDeep, saveContent, resetContent, type ContentKey } from "@/lib/content";

const canView = (role: string) => role === "admin_it" || role === "ceo";
const canEdit = (role: string) => role === "admin_it"; // PRD §5: site config = Admin IT

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || !canView(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.siteConfig.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const items = CONTENT_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key, ...CONTENT_META[key],
      value: row?.value ?? CONTENT_DEFAULTS[key],
      default: CONTENT_DEFAULTS[key],
      customised: !!row, updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null,
    };
  });
  return NextResponse.json({ items, canEdit: canEdit(user.role), choices: CONTENT_CHOICES });
}

export async function PUT(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Only Admin IT can edit site content" }, { status: 403 });
  const { key, value } = await req.json().catch(() => ({}));
  if (!CONTENT_KEYS.includes(key)) return NextResponse.json({ error: "Unknown content key" }, { status: 400 });

  const clean = trimDeep(value);
  const err = checkShape(CONTENT_DEFAULTS[key as ContentKey], clean, CONTENT_META[key as ContentKey].label) ?? checkChoices(key, clean);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const before = await prisma.siteConfig.findUnique({ where: { key } });
  await saveContent(key, clean, user.name);
  revalidatePath("/", "layout"); // statically built public pages pick up the change
  await audit(req, user, "site_config.update", "site_config", key, `Updated website content: ${CONTENT_META[key as ContentKey].label}`,
    { [key]: { from: before?.value ?? "default", to: clean } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Only Admin IT can edit site content" }, { status: 403 });
  const key = req.nextUrl.searchParams.get("key") as ContentKey;
  if (!CONTENT_KEYS.includes(key)) return NextResponse.json({ error: "Unknown content key" }, { status: 400 });
  const before = await prisma.siteConfig.findUnique({ where: { key } });
  if (!before) return NextResponse.json({ error: "Already using the default" }, { status: 400 });
  await resetContent(key);
  revalidatePath("/", "layout");
  await audit(req, user, "site_config.reset", "site_config", key, `Restored default website content: ${CONTENT_META[key].label}`,
    { [key]: { from: before.value, to: "default" } });
  return NextResponse.json({ success: true });
}
