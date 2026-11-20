import type { Metadata } from "next";
import LegalPage from "@/components/public/LegalPage";
import { PRIVACY_SECTIONS } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How CIMP-BIIF collects, uses and protects personal data, and your rights under the DPDP Act, 2023.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy"
      desc="What personal data we collect, why, who can see it, and your rights under India's Digital Personal Data Protection Act, 2023."
      sections={PRIVACY_SECTIONS} other={{ href: "/terms", label: "Terms of Use" }} />
  );
}
