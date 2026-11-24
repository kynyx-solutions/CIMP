// Application documents (PRD DOC-1, DOC-2). Shared by client and server.

export type DocKind = "pitch_deck" | "id_proof" | "registration" | "logo";
export type FileType = "pdf" | "png" | "jpg" | "webp" | "pptx" | "ppt";

export interface DocKindDef {
  kind: DocKind;
  label: string;
  help: string;
  types: FileType[];
  maxBytes: number;
  required: boolean;
  /** shown on the public profile once the startup is published */
  isPublic?: boolean;
}

const MB = 1024 * 1024;

export const DOC_KINDS: DocKindDef[] = [
  { kind: "pitch_deck", label: "Pitch deck", help: "10–12 slides. PDF preferred.", types: ["pdf", "pptx", "ppt"], maxBytes: 10 * MB, required: true },
  { kind: "id_proof", label: "Founder ID proof", help: "Aadhaar, PAN or passport of the lead founder.", types: ["pdf", "jpg", "png"], maxBytes: 5 * MB, required: true },
  { kind: "registration", label: "Registration certificate", help: "Certificate of incorporation or DPIIT recognition, if registered.", types: ["pdf", "jpg", "png"], maxBytes: 5 * MB, required: false },
  { kind: "logo", label: "Startup logo", help: "Square PNG or JPG. Shown on your public profile if you are published.", types: ["png", "jpg", "webp"], maxBytes: 1 * MB, required: false, isPublic: true },
];

export const DOC_KIND_MAP = Object.fromEntries(DOC_KINDS.map((d) => [d.kind, d])) as Record<DocKind, DocKindDef>;

export const MIME: Record<FileType, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
};

/** What can be uploaded where: application documents, mentor document requests, finance invoices. */
export type UploadPurpose = DocKind | "doc_request" | "invoice";
export type UploadRule = { label: string; types: FileType[]; maxBytes: number };

export const UPLOAD_RULES: Record<UploadPurpose, UploadRule> = {
  ...(Object.fromEntries(DOC_KINDS.map((d) => [d.kind, { label: d.label, types: d.types, maxBytes: d.maxBytes }])) as Record<DocKind, UploadRule>),
  doc_request: { label: "The document", types: ["pdf", "jpg", "png", "pptx", "ppt"], maxBytes: 10 * MB },
  invoice: { label: "The invoice", types: ["pdf", "jpg", "png"], maxBytes: 10 * MB },
};

export function isUploadPurpose(v: unknown): v is UploadPurpose {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(UPLOAD_RULES, v);
}

/** File type claimed by a file name's extension (checked again against the bytes after upload). */
export function typeFromName(name: string): FileType | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const t = ext === "jpeg" ? "jpg" : ext;
  return Object.prototype.hasOwnProperty.call(MIME, t) ? (t as FileType) : null;
}

/** "PDF, JPG or PNG" */
export function typeList(types: FileType[]) {
  const up = types.map((t) => t.toUpperCase());
  return up.length > 1 ? `${up.slice(0, -1).join(", ")} or ${up[up.length - 1]}` : up[0];
}

/** A file name safe to store and to put in a Content-Disposition header. */
export function cleanFileName(name: string, fallback: string) {
  return name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || fallback;
}

/** `accept` attribute for a file input */
export function acceptFor(def: { types: FileType[] }) {
  return def.types.flatMap((t) => (t === "jpg" ? [".jpg", ".jpeg"] : [`.${t}`])).join(",");
}

export function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
