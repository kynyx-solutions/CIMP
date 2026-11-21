"use client";
// Application documents (PRD DOC-1): upload slots for the applicant, a read-only list for the office.
import { useCallback, useEffect, useRef, useState } from "react";
import { DOC_KINDS, acceptFor, formatBytes, type DocKind } from "@/lib/documents";

type Doc = { _id: string; kind: DocKind; fileName: string; mimeType: string; size: number; createdAt: string };

export default function DocumentsPanel({
  applicationId, editable, logoEditable = editable, compact = false, onChange,
}: {
  applicationId: string;
  /** applicant can upload/replace review documents */
  editable: boolean;
  /** the logo stays editable after review starts */
  logoEditable?: boolean;
  /** dense layout for the office side panel */
  compact?: boolean;
  onChange?: (docs: Doc[]) => void;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState<DocKind | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<Partial<Record<DocKind, HTMLInputElement | null>>>({});
  // Keep the latest callback without re-running the loader when the parent re-renders
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents?applicationId=${applicationId}`);
    const d = await res.json();
    if (res.ok) { setDocs(d.documents); onChangeRef.current?.(d.documents); }
    else setError(d.error);
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  async function upload(kind: DocKind, file: File) {
    setBusy(kind); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("applicationId", applicationId); fd.append("kind", kind);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) setError(d.error); else await load();
    } catch { setError("Upload failed. Please try again."); }
    finally { setBusy(null); const el = inputs.current[kind]; if (el) el.value = ""; }
  }

  async function remove(doc: Doc) {
    if (!window.confirm(`Remove ${doc.fileName}?`)) return;
    setBusy(doc.kind); setError("");
    const res = await fetch(`/api/documents/${doc._id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) setError(d.error); else await load();
    setBusy(null);
  }

  if (docs === null) return <p className="text-xs text-muted font-body">{error || "Loading documents…"}</p>;
  const byKind = new Map(docs.map((d) => [d.kind, d]));

  return (
    <div>
      {error && <p role="alert" className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-body">{error}</p>}
      <ul className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-3"}>
        {DOC_KINDS.map((def) => {
          const doc = byKind.get(def.kind);
          const canEdit = def.kind === "logo" ? logoEditable : editable;
          if (compact && !doc) {
            return (
              <li key={def.kind} className="flex items-center justify-between gap-2 border border-dashed border-border rounded-lg px-3 py-2">
                <span className="text-xs font-body text-muted">{def.label}</span>
                <span className={`text-[10px] font-mono ${def.required ? "text-amber-700" : "text-faint"}`}>{def.required ? "Missing" : "Not provided"}</span>
              </li>
            );
          }
          return (
            <li key={def.kind} className={`border rounded-xl ${compact ? "px-3 py-2" : "p-4"} ${doc ? "border-leaf-200 bg-leaf-50/50" : "border-border bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-body font-semibold text-navy ${compact ? "text-xs" : "text-sm"}`}>
                    {def.label} {def.required && !compact && <span className="text-red-600" aria-label="required">*</span>}
                  </p>
                  {doc ? (
                    <a href={`/api/documents/${doc._id}`} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-brand font-body underline truncate mt-0.5" title={doc.fileName}>
                      📎 {doc.fileName} <span className="text-muted no-underline">· {formatBytes(doc.size)}</span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted font-body mt-0.5">{def.help}</p>
                  )}
                </div>
                {doc && def.kind === "logo" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/documents/${doc._id}`} alt="" className="w-10 h-10 rounded-lg object-contain bg-white border border-border flex-shrink-0" />
                )}
              </div>
              {canEdit && !compact && (
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" disabled={busy !== null} onClick={() => inputs.current[def.kind]?.click()}
                    className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold font-body text-navy hover:border-brand disabled:opacity-50">
                    {busy === def.kind ? "Uploading…" : doc ? "Replace" : "Upload"}
                  </button>
                  {doc && (
                    <button type="button" disabled={busy !== null} onClick={() => remove(doc)} className="text-xs font-body text-muted hover:text-red-700 disabled:opacity-50">Remove</button>
                  )}
                  <span className="text-[10px] font-mono text-faint ml-auto">{def.types.join(", ").toUpperCase()} · max {formatBytes(def.maxBytes)}</span>
                  <input ref={(el) => { inputs.current[def.kind] = el; }} type="file" accept={acceptFor(def)} className="hidden"
                    aria-label={`Upload ${def.label}`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(def.kind, f); }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
