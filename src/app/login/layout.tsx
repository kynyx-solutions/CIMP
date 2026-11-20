import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your CIMP-BIIF dashboard.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
