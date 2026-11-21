// Private file storage (server-only). Files are never public: every download goes through an
// API route that checks access first (/api/documents/[id] and similar).
//
// STORAGE_DRIVER=local (default) keeps files on disk under UPLOAD_DIR (outside the web root).
// STORAGE_DRIVER=s3 uses any S3-compatible store: AWS S3, Cloudflare R2, MinIO, DigitalOcean
// Spaces (PRD DOC-2). Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and, for
// non-AWS stores, S3_ENDPOINT (+ S3_FORCE_PATH_STYLE=true for MinIO).
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
const SAFE_NAME = /^[0-9a-f-]{36}\.(pdf|png|jpg|webp|pptx|ppt|xlsx)$/;

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

interface Driver {
  put(name: string, buf: Buffer): Promise<void>;
  get(name: string): Promise<Buffer>;
  del(name: string): Promise<void>;
}

const local: Driver = {
  async put(name, buf) {
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, name), buf, { flag: "wx" });
  },
  get: (name) => readFile(path.join(ROOT, name)),
  async del(name) {
    await unlink(path.join(ROOT, name)).catch(() => {});
  },
};

let s3Driver: Driver | null = null;
async function s3(): Promise<Driver> {
  if (s3Driver) return s3Driver;
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = process.env.S3_BUCKET!;
  const prefix = (process.env.S3_PREFIX ?? "uploads/").replace(/^\/+/, "");
  const client = new S3Client({
    region: process.env.S3_REGION || "ap-south-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  s3Driver = {
    async put(name, buf) {
      const ext = name.split(".").pop()!;
      await client.send(new PutObjectCommand({
        Bucket, Key: prefix + name, Body: buf, ContentType: CONTENT_TYPE[ext] ?? "application/octet-stream",
        ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : "AES256",
        IfNoneMatch: "*", // never overwrite an existing object
      }));
    },
    async get(name) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: prefix + name }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async del(name) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: prefix + name })).catch(() => {});
    },
  };
  return s3Driver;
}

const driver = (): Promise<Driver> | Driver => (process.env.STORAGE_DRIVER === "s3" ? s3() : local);

/** Generated Excel exports (PRD XLS-1); never user uploads. */
export async function saveExport(buf: Buffer): Promise<string> {
  const storedName = `${randomUUID()}.xlsx`;
  await (await driver()).put(storedName, buf);
  return storedName;
}

export async function saveFile(buf: Buffer, type: FileType): Promise<string> {
  const storedName = `${randomUUID()}.${type}`;
  await (await driver()).put(storedName, buf);
  return storedName;
}

export async function readStored(storedName: string): Promise<Buffer> {
  if (!SAFE_NAME.test(storedName)) throw new Error("Invalid stored name");
  return (await driver()).get(storedName);
}

export async function deleteStored(storedName: string) {
  if (!SAFE_NAME.test(storedName)) return;
  await (await driver()).del(storedName);
}
