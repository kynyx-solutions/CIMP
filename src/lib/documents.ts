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
  { kind: "pitch_deck", label: "Pitch deck", help: "10–12 slides. PDF preferred.", types: ["pdf", "pptx", "ppt"], maxBytes: 4 * MB, required: true },
  { kind: "id_proof", label: "Founder ID proof", help: "Aadhaar, PAN or passport of the lead founder.", types: ["pdf", "jpg", "png"], maxBytes: 4 * MB, required: true },
  { kind: "registration", label: "Registration certificate", help: "Certificate of incorporation or DPIIT recognition, if registered.", types: ["pdf", "jpg", "png"], maxBytes: 4 * MB, required: false },
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

/** `accept` attribute for a file input */
export function acceptFor(def: DocKindDef) {
  return def.types.flatMap((t) => (t === "jpg" ? [".jpg", ".jpeg"] : [`.${t}`])).join(",");
}

export function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
