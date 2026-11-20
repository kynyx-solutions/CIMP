import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  description: "Messages between applicants and the CIMP-BIIF team.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
