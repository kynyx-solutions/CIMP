import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply for Incubation",
  description: "Submit your startup application to CIMP-BIIF.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
