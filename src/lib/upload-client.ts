// Browser side of file uploads. With S3 storage the file goes straight to the bucket through a
// signed URL (no size limit from the web host); otherwise it is posted to the route as a form.
import { UPLOAD_RULES, formatBytes, type UploadPurpose } from "@/lib/documents";

export type UploadResult = { ok: boolean; data: { error?: string; [k: string]: unknown } };

const failed = (error: string): UploadResult => ({ ok: false, data: { error } });

/** Upload `file` to `endpoint` (e.g. /api/documents) with extra form `fields`. */
export async function uploadFile(endpoint: string, purpose: UploadPurpose, file: File, fields: Record<string, string> = {}): Promise<UploadResult> {
  const rule = UPLOAD_RULES[purpose];
  if (file.size > rule.maxBytes) return failed(`${rule.label} must be under ${formatBytes(rule.maxBytes)}`);
  try {
    const t = await fetch("/api/uploads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, name: file.name, size: file.size }),
    });
    const ticket = await t.json().catch(() => ({}));
    if (!t.ok) return failed(ticket.error ?? "Upload failed. Please try again.");

    let res: Response;
    if (ticket.direct) {
      const put = await fetch(ticket.url, { method: "PUT", body: file, headers: { "Content-Type": ticket.contentType } });
      if (!put.ok) return failed("Upload failed. Please try again.");
      res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, upload: ticket.ticket }) });
    } else {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      res = await fetch(endpoint, { method: "POST", body: fd });
    }
    return { ok: res.ok, data: await res.json().catch(() => ({ error: res.ok ? undefined : "Upload failed. Please try again." })) };
  } catch {
    return failed("Upload failed. Please check your connection and try again.");
  }
}
