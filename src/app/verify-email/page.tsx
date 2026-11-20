"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell, { primaryBtn } from "@/components/public/AuthShell";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // digits only
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  // Paste the whole 6-digit code into any box
  function handlePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    setOtp(Array.from({ length: 6 }, (_, i) => digits[i] ?? ""));
    inputs.current[Math.min(digits.length, 5)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResent(false);
    setError("");
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setResent(true);
      setCountdown(60);
    } else {
      const d = await res.json();
      setError(d.error);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={<>We sent a 6-digit code to <strong className="text-navy">{email || "your email"}</strong>. It expires in 10 minutes.</>}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset>
          <legend className="sr-only">Verification code</legend>
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input key={i} ref={(el) => { inputs.current[i] = el; }}
                type="text" inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={1}
                aria-label={`Digit ${i + 1}`} value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-display font-bold text-navy bg-white border border-border rounded-xl focus:outline-none focus:border-brand-2 focus:ring-4 focus:ring-leaf-100 transition" />
            ))}
          </div>
        </fieldset>

        {error && <div role="alert" className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">{error}</div>}
        {resent && <div role="status" className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-body">A new code has been sent.</div>}

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? "Verifying…" : "Verify & continue →"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm font-body">
        <span className="text-muted">Didn&apos;t get it? Check spam.</span>
        <button type="button" onClick={handleResend} disabled={countdown > 0}
          className="text-brand font-semibold hover:text-navy disabled:text-muted disabled:cursor-not-allowed">
          {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
        </button>
      </div>
      <p className="mt-8 text-sm font-body text-muted">
        Wrong email? <Link href="/register" className="text-brand font-semibold">Register again</Link>
      </p>
    </AuthShell>
  );
}
