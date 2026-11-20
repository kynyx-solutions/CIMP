import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Register to apply for incubation at CIMP-BIIF.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
