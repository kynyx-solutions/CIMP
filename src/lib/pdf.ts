// Server-side PDF building (PRD PDF-1, IDC-1). Demo: pdf-lib with an embedded Unicode font
// (Noto Sans, so ₹ and accented names render). Phase 1 plan: Puppeteer from HTML templates.
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const BRAND = rgb(0.247, 0.478, 0.086);   // #3F7A16
export const INK = rgb(0.11, 0.21, 0.06);        // #1C3510
export const MUTED = rgb(0.42, 0.47, 0.38);      // #6A7860
export const RULE = rgb(0.86, 0.89, 0.82);
export const TINT = rgb(0.95, 0.97, 0.92);

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function fontBytes() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const [regular, bold] = await Promise.all([readFile(path.join(dir, "NotoSans-Regular.ttf")), readFile(path.join(dir, "NotoSans-Bold.ttf"))]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

/** Characters the embedded font cannot draw are replaced, so user text never breaks a PDF. */
function safe(font: PDFFont, s: string) {
  const set = font.getCharacterSet();
  return Array.from(s.replace(/\r/g, "")).map((ch) => (ch === "\n" || set.includes(ch.codePointAt(0)!) ? ch : "?")).join("");
}

export class PdfBuilder {
  private constructor(
    public doc: PDFDocument,
    public regular: PDFFont,
    public bold: PDFFont,
    private title: string,
    private subtitle: string,
  ) {}
  page!: PDFPage;
  y = 0;
  readonly W = 595.28;
  readonly H = 841.89;
  readonly M = 48;

  static async create(title: string, subtitle = "") {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const f = await fontBytes();
    const regular = await doc.embedFont(f.regular, { subset: true });
    const bold = await doc.embedFont(f.bold, { subset: true });
    doc.setTitle(title);
    doc.setProducer("CIMP-BIIF portal");
    doc.setCreator("CIMP-BIIF portal");
    const b = new PdfBuilder(doc, regular, bold, title, subtitle);
    b.newPage();
    return b;
  }

  newPage() {
    this.page = this.doc.addPage([this.W, this.H]);
    const p = this.page;
    p.drawRectangle({ x: 0, y: this.H - 6, width: this.W, height: 6, color: BRAND });
    p.drawText("CIMP-BIIF", { x: this.M, y: this.H - 40, size: 13, font: this.bold, color: BRAND });
    p.drawText(safe(this.regular, "CIMP Business Incubation and Innovation Foundation, Patna"), { x: this.M + 78, y: this.H - 40, size: 8.5, font: this.regular, color: MUTED });
    p.drawLine({ start: { x: this.M, y: this.H - 52 }, end: { x: this.W - this.M, y: this.H - 52 }, thickness: 0.6, color: RULE });
    this.y = this.H - 84;
    if (this.doc.getPageCount() === 1) {
      this.text(this.title, { size: 18, bold: true });
      if (this.subtitle) this.text(this.subtitle, { size: 10, color: MUTED });
      this.gap(10);
    }
  }

  private ensure(h: number) { if (this.y - h < this.M + 30) this.newPage(); }

  /** Wrap `s` to `width` at `size`; keeps explicit line breaks. */
  wrap(s: string, size: number, width: number, font = this.regular): string[] {
    const out: string[] = [];
    for (const para of safe(font, s).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
        if (line) out.push(line);
        // a single word longer than the line is cut hard
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        line = w;
      }
      out.push(line);
    }
    return out;
  }

  text(s: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; lineGap?: number } = {}) {
    const size = o.size ?? 10.5, font = o.bold ? this.bold : this.regular, x = o.x ?? this.M;
    const width = o.width ?? this.W - this.M - x;
    const lh = size * 1.35 + (o.lineGap ?? 0);
    for (const line of this.wrap(s, size, width, font)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= lh;
    }
  }

  heading(s: string) {
    this.gap(8); this.ensure(40);
    this.text(s, { size: 12.5, bold: true, color: BRAND });
    this.page.drawLine({ start: { x: this.M, y: this.y + 2 }, end: { x: this.W - this.M, y: this.y + 2 }, thickness: 0.5, color: RULE });
    this.gap(6);
  }

  /** Label / value rows, the value wrapped in the right column. */
  fields(rows: { label: string; value: string }[], labelWidth = 170) {
    for (const r of rows) {
      const vx = this.M + labelWidth, vw = this.W - this.M - vx;
      const lines = this.wrap(r.value || "—", 10, vw);
      const labelLines = this.wrap(r.label, 9, labelWidth - 12, this.bold);
      const h = Math.max(lines.length, labelLines.length) * 13.5 + 6;
      this.ensure(Math.min(h, 200));
      const top = this.y;
      labelLines.forEach((l, i) => this.page.drawText(l, { x: this.M, y: top - 10 - i * 13.5, size: 9, font: this.bold, color: MUTED }));
      let yy = top;
      for (const l of lines) {
        if (yy - 14 < this.M + 30) { this.newPage(); yy = this.y; }
        this.page.drawText(l, { x: vx, y: yy - 10, size: 10, font: this.regular, color: INK });
        yy -= 13.5;
      }
      this.y = Math.min(yy, top - labelLines.length * 13.5) - 6;
      this.page.drawLine({ start: { x: this.M, y: this.y + 3 }, end: { x: this.W - this.M, y: this.y + 3 }, thickness: 0.3, color: RULE });
    }
  }

  /** A simple table with fixed column widths (fractions of the text width). */
  table(headers: string[], rows: string[][], fractions: number[]) {
    const tw = this.W - 2 * this.M, xs: number[] = [];
    let acc = this.M; for (const f of fractions) { xs.push(acc); acc += f * tw; }
    const ws = fractions.map((f) => f * tw - 8);
    const drawHeader = () => {
      this.ensure(22);
      this.page.drawRectangle({ x: this.M, y: this.y - 18, width: tw, height: 18, color: TINT });
      headers.forEach((h, i) => this.page.drawText(safe(this.bold, h), { x: xs[i] + 4, y: this.y - 12.5, size: 8.5, font: this.bold, color: INK }));
      this.y -= 22;
    };
    drawHeader();
    for (const r of rows) {
      const cells = r.map((c, i) => this.wrap(c ?? "", 9, ws[i]));
      const h = Math.max(...cells.map((c) => c.length)) * 12 + 6;
      if (this.y - h < this.M + 30) { this.newPage(); drawHeader(); }
      cells.forEach((lines, i) => lines.forEach((l, j) => this.page.drawText(l, { x: xs[i] + 4, y: this.y - 9 - j * 12, size: 9, font: this.regular, color: INK })));
      this.y -= h;
      this.page.drawLine({ start: { x: this.M, y: this.y + 2 }, end: { x: this.W - this.M, y: this.y + 2 }, thickness: 0.3, color: RULE });
    }
  }

  gap(n: number) { this.y -= n; }

  /** A PNG (data URL or bytes) at most `maxW` × `maxH`, keeping its aspect ratio. Returns false if unreadable. */
  async image(png: string | Uint8Array, maxW: number, maxH: number, x = this.M): Promise<boolean> {
    try {
      const bytes = typeof png === "string" ? Buffer.from(png.split(",")[1] ?? "", "base64") : png;
      const img = await this.doc.embedPng(bytes);
      const k = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * k, h = img.height * k;
      this.ensure(h + 4);
      this.page.drawImage(img, { x, y: this.y - h, width: w, height: h });
      this.y -= h + 4;
      return true;
    } catch { return false; }
  }

  async save(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    const stamp = `Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} IST`;
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: this.M, y: 40 }, end: { x: this.W - this.M, y: 40 }, thickness: 0.4, color: RULE });
      p.drawText(stamp, { x: this.M, y: 26, size: 8, font: this.regular, color: MUTED });
      const label = `Page ${i + 1} of ${pages.length}`;
      p.drawText(label, { x: this.W - this.M - this.regular.widthOfTextAtSize(label, 8), y: 26, size: 8, font: this.regular, color: MUTED });
    });
    return this.doc.save();
  }
}

/** HTTP response for a generated PDF. */
export function pdfResponse(bytes: Uint8Array, fileName: string, inline = false) {
  const safeName = fileName.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
