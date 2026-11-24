// Receiving uploaded files (server-only). Two ways in, one result:
//   • multipart form with a `file` field: the file passes through the app (local storage)
//   • JSON with an `upload` ticket: the browser already PUT the file to S3 through a signed URL
//     from /api/uploads; the app checks its size and first bytes in the bucket before using it
// Either way the route gets the form fields first (to check access), then calls commit().
import type { NextRequest } from "next/server";
import { createHmac } from "crypto";
import jwt from "jsonwebtoken";
import { MIME, UPLOAD_RULES, cleanFileName, formatBytes, typeFromName, typeList, type FileType, type UploadPurpose } from "@/lib/documents";
import { SNIFF_BYTES, deleteStored, isStoredName, newStoredName, readStoredHead, saveFile, signedUploadUrl, sniffType, storedSize } from "@/lib/storage";

export type StoredUpload = { storedName: string; fileName: string; mimeType: string; size: number; type: FileType };
type Result<T> = T | { error: string };

export interface IncomingUpload {
  fields: Record<string, unknown>;
  /** Check the file against the rule for `purpose` and keep it. */
  commit(purpose: UploadPurpose): Promise<Result<StoredUpload>>;
}

type Ticket = { sub: string; p: UploadPurpose; n: string; s: number; f: string };

// Tickets use their own key so they can never pass for a session token
const ticketKey = () => createHmac("sha256", process.env.JWT_SECRET ?? "").update("upload-ticket").digest();

const tooBig = (purpose: UploadPurpose) => `${UPLOAD_RULES[purpose].label} must be under ${formatBytes(UPLOAD_RULES[purpose].maxBytes)}`;
const wrongType = (purpose: UploadPurpose) => `${UPLOAD_RULES[purpose].label} must be ${typeList(UPLOAD_RULES[purpose].types)}`;

/** Step 1 of a direct upload: a signed URL for exactly this file, and a ticket to hand in after. */
export async function createTicket(userId: string, purpose: UploadPurpose, name: string, size: number): Promise<Result<{ url: string; contentType: string; ticket: string }>> {
  const rule = UPLOAD_RULES[purpose];
  if (!Number.isInteger(size) || size <= 0) return { error: "The file is empty" };
  if (size > rule.maxBytes) return { error: tooBig(purpose) };
  const type = typeFromName(name);
  if (!type || !rule.types.includes(type)) return { error: wrongType(purpose) };
  const storedName = newStoredName(type);
  const url = await signedUploadUrl(storedName, size);
  const claims: Ticket = { sub: userId, p: purpose, n: storedName, s: size, f: cleanFileName(name, `document.${type}`) };
  const ticket = jwt.sign(claims, ticketKey(), { expiresIn: "30m" });
  return { url, contentType: MIME[type], ticket };
}

/** Read an upload request. Returns an error for a malformed request. */
export async function receiveUpload(req: NextRequest, userId: string): Promise<Result<IncomingUpload>> {
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    let form: FormData;
    try { form = await req.formData(); } catch { return { error: "Expected a file upload" }; }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
    const fields = Object.fromEntries(Array.from(form.entries()).filter(([k, v]) => k !== "file" && typeof v === "string"));
    return {
      fields,
      async commit(purpose) {
        const rule = UPLOAD_RULES[purpose];
        if (file.size > rule.maxBytes) return { error: tooBig(purpose) };
        const buf = Buffer.from(await file.arrayBuffer());
        const type = sniffType(buf);
        if (!type || !rule.types.includes(type)) return { error: wrongType(purpose) };
        const storedName = await saveFile(buf, type);
        return { storedName, type, size: buf.length, mimeType: MIME[type], fileName: cleanFileName(file.name, `document.${type}`) };
      },
    };
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.upload !== "string") return { error: "Expected a file upload" };
  let t: Ticket;
  try { t = jwt.verify(body.upload, ticketKey()) as Ticket; } catch { return { error: "The upload expired. Choose the file again." }; }
  if (t.sub !== userId || !isStoredName(t.n)) return { error: "The upload expired. Choose the file again." };
  const { upload: _ticket, ...fields } = body;
  return {
    fields,
    async commit(purpose) {
      if (t.p !== purpose) return { error: "The upload expired. Choose the file again." };
      const rule = UPLOAD_RULES[purpose];
      const size = await storedSize(t.n);
      if (size === null) return { error: "The file did not finish uploading. Please try again." };
      const reject = async (error: string) => { await deleteStored(t.n); return { error }; };
      if (size !== t.s || size > rule.maxBytes) return reject(tooBig(purpose));
      const type = sniffType(await readStoredHead(t.n, SNIFF_BYTES));
      // The stored name's extension was chosen from the file name: the bytes must agree
      if (!type || !rule.types.includes(type) || !t.n.endsWith(`.${type}`)) return reject(wrongType(purpose));
      return { storedName: t.n, type, size, mimeType: MIME[type], fileName: t.f };
    },
  };
}

/** Delete the file a record pointed to before, unless the same file was handed in again. */
export async function replaceStored(previous: string | null | undefined, current: string) {
  if (previous && previous !== current) await deleteStored(previous);
}
