"use client";
// Admin panel (PRD §5): Admin IT configures forms and website content; the CEO and
// Admin IT read the audit log. The APIs enforce the same rules.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import AuditLog from "@/components/admin/AuditLog";
import FormBuilder from "@/components/admin/FormBuilder";
import ContentEditor from "@/components/admin/ContentEditor";
import IdCards from "@/components/admin/IdCards";
import Jobs from "@/components/admin/Jobs";
import EmailSettings from "@/components/admin/EmailSettings";

const TABS = [
  { key: "audit", label: "Audit log", roles: ["ceo", "admin_it"], desc: "Every change in the portal, who made it and when. Records cannot be edited or deleted." },
  { key: "forms", label: "Form builder", roles: ["admin_it", "ceo"], desc: "Questions on the application and mentor forms, and which answers are public." },
  { key: "content", label: "Website content", roles: ["admin_it", "ceo"], desc: "Numbers, open calls, eligibility, contacts, FAQ and the ID card template." },
  { key: "idcards", label: "ID cards", roles: ["admin_it", "ceo"], desc: "Virtual ID cards for incubatees and mentors." },
  { key: "jobs", label: "Scheduled jobs", roles: ["admin_it", "ceo"], desc: "Reminders and ID card renewals that run on a schedule." },
  { key: "email", label: "Email", roles: ["admin_it", "ceo"], desc: "How the portal sends email, and a test email to yourself." },
] as const;

function Admin() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user || !["ceo", "admin_it"].includes(d.user.role)) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const tabs = TABS.filter((t) => (t.roles as readonly string[]).includes(user.role));
  const tab = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0];
  const isAdminIT = user.role === "admin_it";

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Admin</h1>
        <p className="text-secondary font-body text-sm mt-1">{tab.desc}{!isAdminIT && tab.key !== "audit" && " View only: Admin IT makes changes."}</p>
        <div role="tablist" className="mt-6 mb-6 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab.key === t.key} onClick={() => router.replace(`/admin?tab=${t.key}`, { scroll: false })}
              className={`px-4 py-2.5 text-sm font-body font-semibold -mb-px border-b-2 ${tab.key === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab.key === "audit" && <AuditLog />}
        {tab.key === "forms" && <FormBuilder canEdit={isAdminIT} />}
        {tab.key === "content" && <ContentEditor />}
        {tab.key === "idcards" && <IdCards />}
        {tab.key === "jobs" && <Jobs />}
        {tab.key === "email" && <EmailSettings />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <Suspense><Admin /></Suspense>;
}
