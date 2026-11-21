"use client";
import React from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

const provider = new GoogleAuthProvider();
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// Google sign-in is only for non-staff users (incubatees etc.).
// Staff are rejected server-side and must use company email + password.
export default function GoogleButton({
  onError,
  role,
  disabled = false,
}: {
  /** public role for new Google sign-ups (incubatee or mentor); ignored for existing users */
  role?: "incubatee" | "mentor";
  onError?: (message: string) => void;
  /** e.g. until the user ticks the Terms/Privacy consent box on the register page */
  disabled?: boolean;
}) {
  const handleGoogleLogin = async () => {
    if (disabled) return;
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken, role }),
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = "/dashboard";
      } else {
        await auth.signOut();
        onError?.(data.error || "Google sign-in failed");
      }
    } catch (err) {
      console.error("Google login error:", err);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={disabled}
        className="w-full py-3 bg-white border border-slate-200 rounded-xl text-navy font-semibold font-body text-sm flex items-center justify-center gap-2.5 hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconGoogle />
        Continue with Google
      </button>
      <p className="text-[11px] text-muted font-body text-center mt-2">
        By continuing with Google you agree to the{" "}
        <a href="/terms" className="underline hover:text-navy">Terms of Use</a> and{" "}
        <a href="/privacy" className="underline hover:text-navy">Privacy Policy</a>.
      </p>
    </div>
  );
}
