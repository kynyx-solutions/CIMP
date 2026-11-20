import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default function verifyLayout({ children } : { children: React.ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        
        <main>{children}</main>
      </Suspense>
    </div>
  );
}