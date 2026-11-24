// The UI was written against MongoDB documents and reads `_id`.
// Prisma rows use `id`; this adds an `_id` alias (recursively) so client
// pages keep working unchanged.
export function withId<T>(value: T): any {
  if (Array.isArray(value)) return value.map(withId);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withId(v);
    if ("id" in out && !("_id" in out)) out._id = out.id;
    return out;
  }
  return value;
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{20,40}$/i.test(value);
}

/** A trimmed string from untrusted input, cut to `max` characters ("" for anything else). */
export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
