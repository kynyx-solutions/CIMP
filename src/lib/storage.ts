// Private file storage (server-only). Files are never public: every download goes through an
// API route that checks access first (/api/documents/[id] and similar).
//
// STORAGE_DRIVER=local (default) keeps files on disk under UPLOAD_DIR (outside the web root).
// STORAGE_DRIVER=s3 uses any S3-compatible store: AWS S3, Cloudflare R2, MinIO, DigitalOcean
// Spaces, Supabase Storage (PRD DOC-2). Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY and, for non-AWS stores, S3_ENDPOINT (+ S3_FORCE_PATH_STYLE=true).
//
// With S3 the browser uploads straight to the bucket through a short-lived signed URL and
// downloads are redirected to one, so file size is not limited by the web host's request limit.
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
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
  if (starts(0x50, 0x4b, 0x03, 0x04) && buf.subarray(0, Math.min(buf.length, SNIFF_BYTES)).includes("ppt/")) return "pptx";
  return null;
}

/** How much of a file sniffType needs to see. */
export const SNIFF_BYTES = 64 * 1024;

// Stored names are generated here (uuid + known extension); never derived from user input.
const SAFE_NAME = /^[0-9a-f-]{36}\.(pdf|png|jpg|webp|pptx|ppt|xlsx)$/;
export const isStoredName = (name: unknown): name is string => typeof name === "string" && SAFE_NAME.test(name);

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const contentTypeOf = (name: string) => CONTENT_TYPE[name.split(".").pop()!] ?? "application/octet-stream";

interface Driver {
  put(name: string, buf: Buffer): Promise<void>;
  get(name: string): Promise<Buffer>;
  head(name: string, bytes: number): Promise<Buffer>;
  size(name: string): Promise<number | null>;
  del(name: string): Promise<void>;
  /** Signed URLs (S3 only). */
  uploadUrl?(name: string, size: number): Promise<string>;
  downloadUrl?(name: string, disposition: string): Promise<string>;
}

const local: Driver = {
  async put(name, buf) {
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, name), buf, { flag: "wx" });
  },
  get: (name) => readFile(path.join(ROOT, name)),
  head: async (name, bytes) => (await readFile(path.join(ROOT, name))).subarray(0, bytes),
  size: (name) => stat(path.join(ROOT, name)).then((s) => s.size, () => null),
  async del(name) {
    await unlink(path.join(ROOT, name)).catch(() => {});
  },
};

const SIGNED_URL_SECONDS = 600;

let s3Driver: Driver | null = null;
async function s3(): Promise<Driver> {
  if (s3Driver) return s3Driver;
  const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const Bucket = process.env.S3_BUCKET!;
  const prefix = (process.env.S3_PREFIX ?? "uploads/").replace(/^\/+/, "");
  const client = new S3Client({
    region: process.env.S3_REGION || "ap-south-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const encryption = process.env.S3_ENDPOINT ? undefined : ("AES256" as const);
  s3Driver = {
    async put(name, buf) {
      await client.send(new PutObjectCommand({
        Bucket, Key: prefix + name, Body: buf, ContentType: contentTypeOf(name),
        ServerSideEncryption: encryption,
        IfNoneMatch: "*", // never overwrite an existing object
      }));
    },
    async get(name) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: prefix + name }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async head(name, bytes) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: prefix + name, Range: `bytes=0-${bytes - 1}` }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async size(name) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket, Key: prefix + name }));
        return r.ContentLength ?? null;
      } catch { return null; }
    },
    async del(name) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: prefix + name })).catch(() => {});
    },
    // The signature covers the exact size and type: the store refuses any other body. (AWS buckets
    // encrypt new objects by default, so no encryption header the browser would have to send.)
    uploadUrl: (name, size) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key: prefix + name, ContentType: contentTypeOf(name), ContentLength: size }), { expiresIn: SIGNED_URL_SECONDS }),
    downloadUrl: (name, disposition) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket, Key: prefix + name, ResponseContentType: contentTypeOf(name), ResponseContentDisposition: disposition, ResponseCacheControl: "private, no-store" }), { expiresIn: SIGNED_URL_SECONDS }),
  };
  return s3Driver;
}

const driver = (): Promise<Driver> | Driver => (process.env.STORAGE_DRIVER === "s3" ? s3() : local);

/** True when browsers upload straight to the store (S3) instead of through the app. */
export const directUploads = () => process.env.STORAGE_DRIVER === "s3";

export const newStoredName = (type: FileType | "xlsx") => `${randomUUID()}.${type}`;

/** Generated Excel exports (PRD XLS-1); never user uploads. */
export async function saveExport(buf: Buffer): Promise<string> {
  const storedName = newStoredName("xlsx");
  await (await driver()).put(storedName, buf);
  return storedName;
}

export async function saveFile(buf: Buffer, type: FileType): Promise<string> {
  const storedName = newStoredName(type);
  await (await driver()).put(storedName, buf);
  return storedName;
}

export async function readStored(storedName: string): Promise<Buffer> {
  if (!isStoredName(storedName)) throw new Error("Invalid stored name");
  return (await driver()).get(storedName);
}

/** The first `bytes` of a stored file. */
export async function readStoredHead(storedName: string, bytes = SNIFF_BYTES): Promise<Buffer> {
  if (!isStoredName(storedName)) throw new Error("Invalid stored name");
  return (await driver()).head(storedName, bytes);
}

/** Size in bytes, or null when the file does not exist. */
export async function storedSize(storedName: string): Promise<number | null> {
  if (!isStoredName(storedName)) return null;
  return (await driver()).size(storedName);
}

export async function deleteStored(storedName: string) {
  if (!isStoredName(storedName)) return;
  await (await driver()).del(storedName);
}

/** Signed URL the browser PUTs the file to (S3 only). */
export async function signedUploadUrl(storedName: string, size: number): Promise<string> {
  const d = await driver();
  if (!d.uploadUrl || !isStoredName(storedName)) throw new Error("Direct uploads need STORAGE_DRIVER=s3");
  return d.uploadUrl(storedName, size);
}

/**
 * Send a stored file to the browser after the caller has checked access. With S3 this is a
 * redirect to a signed URL valid for 10 minutes; locally the app streams the file itself.
 */
export async function sendStored(storedName: string, opts: { fileName: string; contentType?: string; inline?: boolean; publicCache?: boolean }): Promise<Response> {
  const safeName = opts.fileName.replace(/["\\\r\n]/g, "_");
  const disposition = `${opts.inline ? "inline" : "attachment"}; filename="${safeName}"`;
  if (!isStoredName(storedName)) return Response.json({ error: "File missing" }, { status: 404 });
  const d = await driver();
  if (d.downloadUrl) {
    return new Response(null, { status: 302, headers: { Location: await d.downloadUrl(storedName, disposition), "Cache-Control": "private, no-store" } });
  }
  let body: Buffer;
  try { body = await d.get(storedName); } catch { return Response.json({ error: "File missing" }, { status: 404 }); }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": opts.contentType ?? contentTypeOf(storedName),
      "Content-Length": String(body.length),
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      // Treat the file as untrusted content: no scripts, no same-origin access
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": opts.publicCache ? "public, max-age=300" : "private, no-store",
    },
  });
}
