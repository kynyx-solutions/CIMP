"use client";
// Renders one form-builder field (PRD FORM-1). Value is a string, or string[] for multiselect.
import type { FieldDef } from "@/lib/forms";

export type FieldValue = string | string[];

export const fieldInputCls =
  "w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-navy font-body text-sm focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors placeholder:text-faint";

/** Form state value for a stored answer */
export function toFieldValue(f: FieldDef, v: unknown): FieldValue {
  if (f.type === "multiselect") return Array.isArray(v) ? v.map(String) : [];
  return v == null ? "" : String(v);
}

export function isFilled(v: FieldValue | undefined) {
  return Array.isArray(v) ? v.length > 0 : !!v?.trim();
}

export default function FieldInput({ f, value, onChange, disabled, idPrefix = "" }: {
  f: FieldDef; value: FieldValue | undefined; onChange: (v: FieldValue) => void; disabled?: boolean; idPrefix?: string;
}) {
  const id = `${idPrefix}${f.key}`;
  const common = {
    id, required: f.required, disabled, maxLength: f.maxLength, placeholder: f.placeholder,
    "aria-describedby": f.help ? `${id}-help` : undefined,
  };

  if (f.type === "multiselect") {
    const list = Array.isArray(value) ? value : [];
    return (
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {(f.options ?? []).map((o) => {
          const on = list.includes(o);
          return (
            <button key={o} type="button" disabled={disabled} aria-pressed={on}
              onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
              className={`px-3 py-1.5 rounded-full text-sm font-body border transition-colors disabled:opacity-60 ${on ? "bg-brand text-white border-brand" : "bg-white text-secondary border-border hover:border-brand"}`}>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  const v = typeof value === "string" ? value : "";
  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value);
  if (f.type === "textarea") return <textarea {...common} value={v} onChange={set} rows={4} className={`${fieldInputCls} resize-y`} />;
  if (f.type === "select") return (
    <select {...common} value={v} onChange={set} className={fieldInputCls}>
      <option value="">Select…</option>
      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const type = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text";
  return <input {...common} type={type} value={v} onChange={set} min={f.type === "number" ? 0 : undefined} className={fieldInputCls} />;
}
