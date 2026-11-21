import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
