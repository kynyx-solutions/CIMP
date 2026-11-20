"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import AuthShell, { inputCls, primaryBtn } from "@/components/public/AuthShell";

// Only the applicant demo account is listed: staff accounts are created via
// scripts/create-ceo.js (CEO) and the CEO's Team page (other office users).
const DEMO = { email: "incubatee@demo.com", password: "demo123", label: "Demo applicant" };

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={<>New here? <Link href="/register" className="text-brand font-semibold hover:text-navy">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-body font-medium text-navy mb-1.5">Email</label>
          <input id="email" ref={emailRef} type="email" required autoComplete="email" value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className={inputCls} placeholder="you@example.com" />
          <p className="text-xs text-muted font-body mt-1.5">Office staff: use your company email.</p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-body font-medium text-navy mb-1.5">Password</label>
          <div className="relative">
            <input id="password" type={showPw ? "text" : "password"} required autoComplete="current-password" value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className={`${inputCls} pr-16`} placeholder="Your password" />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-body font-semibold text-brand px-2 py-1 rounded hover:bg-leaf-50"
              aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && <div role="alert" className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">{error}</div>}

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6" aria-hidden="true">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted font-mono uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <GoogleButton onError={setError} />
      <p className="text-[11px] text-muted font-body text-center mt-1">Google sign-in is for applicants only.</p>

      <button type="button" onClick={() => { setForm({ email: DEMO.email, password: DEMO.password }); emailRef.current?.focus(); }}
        className="mt-6 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-dashed border-border hover:border-brand text-left transition">
        <span>
          <span className="block text-xs font-mono uppercase tracking-wider text-muted">Try the demo</span>
          <span className="block text-sm font-body text-navy">{DEMO.label}: {DEMO.email}</span>
        </span>
        <span className="text-brand text-sm font-semibold font-body">Fill →</span>
      </button>
    </AuthShell>
  );
}
