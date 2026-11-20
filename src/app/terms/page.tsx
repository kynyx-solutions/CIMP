import type { Metadata } from "next";
import LegalPage from "@/components/public/LegalPage";
import { TERMS_SECTIONS } from "@/content/legal";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using the CIMP-BIIF website and incubation portal.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Use"
      desc="The rules for using the CIMP-BIIF website and incubation portal, and how we treat your application and ideas."
      sections={TERMS_SECTIONS} other={{ href: "/privacy", label: "Privacy Policy" }} />
  );
}
