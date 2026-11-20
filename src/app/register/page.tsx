"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import AuthShell, { inputCls, primaryBtn } from "@/components/public/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("Please accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { key: "name", label: "Full name", type: "text", ph: "Your name", auto: "name" },
    { key: "email", label: "Email", type: "email", ph: "you@example.com", auto: "email" },
    { key: "password", label: "Password", type: "password", ph: "At least 6 characters", auto: "new-password" },
  ] as const;

  return (
    <AuthShell
      title="Create your account"
      subtitle={<>Already registered? <Link href="/login" className="text-brand font-semibold hover:text-navy">Sign in</Link></>}
    >
      <div className="mb-6 px-4 py-3 bg-leaf-50 border border-leaf-100 rounded-xl text-xs text-secondary font-body">
        🚀 For founders applying to CIMP-BIIF. Office staff accounts are created by the organisation; staff should{" "}
        <Link href="/login" className="text-brand font-medium">sign in</Link> with their company email.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="block text-sm font-body font-medium text-navy mb-1.5">{f.label}</label>
            <input id={f.key} type={f.type} required autoComplete={f.auto}
              minLength={f.key === "password" ? 6 : undefined}
              value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              className={inputCls} placeholder={f.ph} />
          </div>
        ))}

        <label className="flex items-start gap-3 text-sm font-body text-secondary cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required
            className="mt-0.5 w-4 h-4 rounded border-border accent-[#3F7A16]" />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="text-brand underline">Terms of Use</Link> and the{" "}
            <Link href="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link>, and consent to CIMP-BIIF
            processing my data to review my application.
          </span>
        </label>

        {error && <div role="alert" className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">{error}</div>}

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? "Creating account…" : "Create account →"}
        </button>
        <p className="text-xs text-muted font-body text-center">We will email you a 6-digit code to verify your address.</p>
      </form>

      <div className="flex items-center gap-3 my-6" aria-hidden="true">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted font-mono uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <GoogleButton onError={setError} disabled={!consent} />
      {!consent && <p className="text-[11px] text-muted font-body text-center mt-1">Tick the consent box above to continue with Google.</p>}
    </AuthShell>
  );
}
