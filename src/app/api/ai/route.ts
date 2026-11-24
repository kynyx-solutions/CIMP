// AI assistant (BIIF 2.0 "custom GPT / AI tools" for office users).
//   GET                         availability; Admin IT / CEO also get settings and usage
//   PUT  { enabled }            Admin IT switches the assistant on or off
//   POST { feature: "application_review", applicationId }
//   POST { feature: "qpr_insight", reportId }
//   POST { feature: "draft", kind: announcement|blog|social, points, tone, platform? }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { APPROVAL_RANK, STAGES, type Stage } from "@/lib/workflow";
import { displayValue, valueOf, type AnswerValue } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";
import { periodLabel } from "@/lib/qpr";
import { BLOG_WRITERS } from "@/lib/blog";
import { AI_LIMIT_PER_HOUR, AI_MODEL, aiConfigured, aiSettings, aiUnavailable, costUsd, isStr, redact, runJson, setAiEnabled, strList } from "@/lib/ai";
import { audit } from "@/lib/audit";

// Up to two model calls of a few thousand tokens each
export const maxDuration = 120;

const REVIEWERS = (r: string) => (APPROVAL_RANK[r] ?? 0) >= 1;
const DRAFTERS = ["executive", "manager", "ceo", "admin_it", "staff", "social_media"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reason = await aiUnavailable(user.userId);
  const base = { available: !reason, reason };
  if (!["admin_it", "ceo"].includes(user.role)) return NextResponse.json(base);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [byFeature, recent] = await Promise.all([
    prisma.aiRun.groupBy({ by: ["feature", "status"], where: { createdAt: { gte: monthStart } }, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aiRun.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const inTok = byFeature.reduce((n, r) => n + (r._sum.inputTokens ?? 0), 0), outTok = byFeature.reduce((n, r) => n + (r._sum.outputTokens ?? 0), 0);
  return NextResponse.json({
    ...base, configured: aiConfigured(), enabled: (await aiSettings()).enabled, model: AI_MODEL, limitPerHour: AI_LIMIT_PER_HOUR, canEdit: user.role === "admin_it",
    month: { runs: byFeature.reduce((n, r) => n + r._count._all, 0), failed: byFeature.filter((r) => r.status === "failed").reduce((n, r) => n + r._count._all, 0), inputTokens: inTok, outputTokens: outTok, estimatedUsd: Math.round(costUsd(inTok, outTok) * 100) / 100,
      byFeature: Object.fromEntries(["application_review", "qpr_insight", "draft"].map((f) => [f, byFeature.filter((r) => r.feature === f).reduce((n, r) => n + r._count._all, 0)])) },
    recent: recent.map((r) => ({ id: r.id, userName: r.userName, feature: r.feature, status: r.status, error: r.error, tokens: r.inputTokens + r.outputTokens, at: r.createdAt })),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin_it") return NextResponse.json({ error: "Only Admin IT changes AI settings" }, { status: 403 });
  const { enabled } = await req.json().catch(() => ({}));
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  await setAiEnabled(enabled, user.name);
  await audit(req, user, enabled ? "ai.enable" : "ai.disable", "ai", null, `${enabled ? "Switched on" : "Switched off"} the AI assistant`);
  return NextResponse.json({ success: true, enabled });
}

const SYSTEM = `You assist the incubation office of CIMP-BIIF, the startup incubator of Chandragupt Institute of Management Patna, Bihar, India.
Your output is advice for staff; people make every decision. Be specific, fair and brief. Use Indian English and rupees (₹, lakh, crore).
Base every statement only on the information given; when something needed is missing, say it is missing rather than guessing.
Reply with a single JSON object exactly in the shape requested, with no text before or after it.`;

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  // ── Reviewer briefing for an application ──
  if (b.feature === "application_review") {
    if (!REVIEWERS(user.role)) return NextResponse.json({ error: "Reviewers (Executive and above) use application review" }, { status: 403 });
    if (!isId(b.applicationId)) return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    const reason = await aiUnavailable(user.userId); if (reason) return NextResponse.json({ error: reason }, { status: 503 });
    const app = await prisma.application.findUnique({ where: { id: b.applicationId }, include: { documents: { select: { kind: true } } } });
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const form = await getForm("application");
    const fields = form.fields.filter((f) => f.key !== "phone" && f.type !== "tel" && f.type !== "email")
      .map((f) => `${f.label}: ${redact(displayValue(valueOf(app, f)) || "(not provided)")}`).join("\n");
    const prompt = `Prepare a briefing for the reviewer of this incubation application (current stage: ${STAGES[app.stage as Stage]?.label ?? app.stage}).

APPLICATION
${fields}
Documents on file: ${app.documents.map((d) => d.kind.replace("_", " ")).join(", ") || "none"}

Return JSON:
{"summary": "2-3 sentences on what the startup does and where it stands",
 "strengths": ["up to 4 short points"],
 "risks": ["up to 4 short points, including missing information"],
 "questions": ["up to 5 specific questions for due diligence"],
 "fitScore": 1-5 (5 = strong fit for CIMP-BIIF incubation),
 "fitRationale": "one sentence",
 "suggestedProgram": "pre-incubation" | "incubation" | "acceleration"}`;
    const r = await runJson({
      feature: "application_review", user, entityId: app.id, system: SYSTEM, prompt,
      validate: (v: any) => {
        const ok = v && isStr(v.summary, 1500) && strList(v.strengths) && strList(v.risks) && strList(v.questions) && Number.isInteger(v.fitScore) && v.fitScore >= 1 && v.fitScore <= 5 && isStr(v.fitRationale, 500) && ["pre-incubation", "incubation", "acceleration"].includes(v.suggestedProgram);
        return ok ? { summary: v.summary, strengths: v.strengths, risks: v.risks, questions: v.questions, fitScore: v.fitScore, fitRationale: v.fitRationale, suggestedProgram: v.suggestedProgram } : null;
      },
    });
    await audit(req, user, "ai.application_review", "ai", app.id, `AI briefing for "${app.startupName}": ${r.ok ? "ok" : r.error}`);
    return r.ok ? NextResponse.json({ success: true, result: r.data, model: AI_MODEL }) : NextResponse.json({ error: r.error }, { status: 502 });
  }

  // ── Progress-report insight ──
  if (b.feature === "qpr_insight") {
    if (!REVIEWERS(user.role)) return NextResponse.json({ error: "Reviewers (Executive and above) use report insights" }, { status: 403 });
    if (!isId(b.reportId)) return NextResponse.json({ error: "reportId required" }, { status: 400 });
    const reason = await aiUnavailable(user.userId); if (reason) return NextResponse.json({ error: reason }, { status: 503 });
    const rep = await prisma.qprReport.findUnique({ where: { id: b.reportId }, include: { application: { select: { startupName: true, industry: true } } } });
    if (!rep) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    const prev = await prisma.qprReport.findFirst({ where: { applicationId: rep.applicationId, period: { lt: rep.period }, status: { in: ["submitted", "accepted"] } }, orderBy: { period: "desc" } });
    const form = await getForm("qpr");
    const render = (a: Record<string, AnswerValue>) => form.fields.map((f) => `${f.label}: ${redact(displayValue(a?.[f.key]) || "(not answered)")}`).join("\n");
    const prompt = `Summarise this quarterly progress report from "${rep.application.startupName}" (${rep.application.industry}) for the incubation office.

THIS QUARTER: ${periodLabel(rep.period)}
${render(rep.answers as Record<string, AnswerValue>)}

${prev ? `PREVIOUS QUARTER: ${periodLabel(prev.period)}\n${render(prev.answers as Record<string, AnswerValue>)}` : "No previous report is on file."}

Return JSON:
{"summary": "2-3 sentences",
 "trends": ["up to 4 points comparing the numbers with the previous quarter, with the change"],
 "flags": ["up to 4 concerns the office should follow up"],
 "suggestedSupport": ["up to 4 concrete ways CIMP-BIIF could help"]}`;
    const r = await runJson({
      feature: "qpr_insight", user, entityId: rep.id, system: SYSTEM, prompt,
      validate: (v: any) => (v && isStr(v.summary, 1500) && strList(v.trends) && strList(v.flags) && strList(v.suggestedSupport) ? { summary: v.summary, trends: v.trends, flags: v.flags, suggestedSupport: v.suggestedSupport } : null),
    });
    await audit(req, user, "ai.qpr_insight", "ai", rep.id, `AI insight for ${periodLabel(rep.period)} report of "${rep.application.startupName}": ${r.ok ? "ok" : r.error}`);
    return r.ok ? NextResponse.json({ success: true, result: r.data, model: AI_MODEL }) : NextResponse.json({ error: r.error }, { status: 502 });
  }

  // ── Draft writer ──
  if (b.feature === "draft") {
    if (!DRAFTERS.includes(user.role) && !BLOG_WRITERS.includes(user.role)) return NextResponse.json({ error: "Your role cannot use the draft writer" }, { status: 403 });
    const kind = ["announcement", "blog", "social"].includes(b.kind) ? b.kind as "announcement" | "blog" | "social" : null;
    const points = typeof b.points === "string" ? b.points.trim().slice(0, 3000) : "";
    if (!kind || points.length < 10) return NextResponse.json({ error: "Choose what to draft and give a few points (at least 10 characters)" }, { status: 400 });
    const tone = ["formal", "warm", "brief"].includes(b.tone) ? b.tone : "warm";
    const xLimit = kind === "social" && b.platform === "x";
    const reason = await aiUnavailable(user.userId); if (reason) return NextResponse.json({ error: reason }, { status: 503 });
    const shape = kind === "blog"
      ? `{"title": "under 90 characters", "excerpt": "1-2 sentences under 280 characters", "text": "the post: 250-600 words, paragraphs separated by a blank line, optional lines starting with '## ' as headings and '- ' as list items"}`
      : kind === "social"
        ? `{"text": "the post${xLimit ? ", at most 260 characters" : ", under 1200 characters"}, may end with 2-3 relevant hashtags"}`
        : `{"title": "under 90 characters", "text": "the announcement, 60-180 words, plain text"}`;
    const prompt = `Write a ${kind === "blog" ? "blog post" : kind === "social" ? `social media post${b.platform ? ` for ${String(b.platform)}` : ""}` : "notification to send to portal users"} for CIMP-BIIF in a ${tone} tone, from these points:
${redact(points)}

Use only facts in the points; do not invent numbers, names, dates or quotes.
Return JSON: ${shape}`;
    const r = await runJson({
      feature: "draft", user, system: SYSTEM, prompt, maxTokens: 6000,
      validate: (v: any) => {
        if (!v || !isStr(v.text, 12000)) return null;
        if (xLimit && v.text.length > 280) return null;
        if ((kind === "blog" || kind === "announcement") && !isStr(v.title, 140)) return null;
        if (kind === "blog" && !isStr(v.excerpt, 300)) return null;
        return { title: v.title ?? null, excerpt: v.excerpt ?? null, text: v.text };
      },
    });
    await audit(req, user, "ai.draft", "ai", null, `AI ${kind} draft: ${r.ok ? "ok" : r.error}`);
    return r.ok ? NextResponse.json({ success: true, result: r.data, model: AI_MODEL }) : NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
}
