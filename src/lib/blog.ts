// Blog (PRD BLG-1): Office Staff write, Admin IT approves. Shared by client and server.
export const BLOG_WRITERS = ["staff", "admin_it"];   // Admin IT may also write; publishing is Admin IT only
export const BLOG_STATUS: Record<string, { label: string; tone: "muted" | "warn" | "good" | "bad" }> = {
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "Waiting for approval", tone: "warn" },
  published: { label: "Published", tone: "good" },
  rejected: { label: "Changes requested", tone: "bad" },
};

export function slugify(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 70) || "post";
}

/**
 * The body is plain text: a blank line starts a paragraph, a line starting with "## " is a
 * heading, lines starting with "- " form a list. Rendered as React elements, never as HTML.
 */
export type Block = { kind: "h" | "p"; text: string } | { kind: "ul"; items: string[] };
export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.length === 1 && lines[0].startsWith("## ")) blocks.push({ kind: "h", text: lines[0].slice(3).trim() });
    else if (lines.every((l) => l.trimStart().startsWith("- "))) blocks.push({ kind: "ul", items: lines.map((l) => l.trimStart().slice(2).trim()) });
    else blocks.push({ kind: "p", text: lines.join(" ") });
  }
  return blocks;
}

export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
