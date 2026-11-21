// Private file storage for the demo (server-only). Files sit outside the web root and are
// only reachable through /api/documents/[id]. Phase 1 replaces this with S3 (PRD DOC-2).
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { FileType } from "@/lib/documents";

const ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"));

/**
 * Identify a file by its first bytes. The browser's MIME type and the file
 * extension are both user-controlled, so neither is trusted.
 */
export function sniffType(buf: Buffer): FileType | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf"; // %PDF-
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (starts(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "ppt"; // legacy Office (OLE2)
  // .pptx is a zip whose entries include ppt/… ; checking the zip signature plus that name is enough here
  if (starts(0x50, 0x4b, 0x03, 0x04) && buf.subarray(0, Math.min(buf.length, 64 * 1024)).includes("ppt/")) return "pptx";
  return null;
}

// Stored names are generated here (uuid + known extension); never derived from user input.
const SAFE_NAME = /^[0-9a-f-]{36}\.(pdf|png|jpg|webp|pptx|ppt)$/;

export async function saveFile(buf: Buffer, type: FileType): Promise<string> {
  await mkdir(ROOT, { recursive: true });
  const storedName = `${randomUUID()}.${type}`;
  await writeFile(path.join(ROOT, storedName), buf, { flag: "wx" });
  return storedName;
}

export async function readStored(storedName: string): Promise<Buffer> {
  if (!SAFE_NAME.test(storedName)) throw new Error("Invalid stored name");
  return readFile(path.join(ROOT, storedName));
}

export async function deleteStored(storedName: string) {
  if (!SAFE_NAME.test(storedName)) return;
  await unlink(path.join(ROOT, storedName)).catch(() => {});
}
