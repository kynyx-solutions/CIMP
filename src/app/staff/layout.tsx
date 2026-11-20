import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Office Team",
  description: "Manage CIMP-BIIF office users.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
