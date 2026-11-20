"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ROLE_ICONS, ROLE_LABELS } from "@/lib/workflow";

type Member = { _id: string; name: string; email: string; role: string; createdAt: string };
type RoleOption = { value: string; label: string };

export default function StaffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role !== "ceo") {
          router.push("/dashboard");
          return;
        }
        setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  async function fetchMembers() {
    setLoading(true);
    const res = await fetch("/api/staff");
    const data = await res.json();
    setMembers(data.members || []);
    setRoles(data.roles || []);
    setDomains(data.domains || []);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setForm((p) => ({ ...p, name: "", email: "", password: "" }));
      showToast(`${data.member.name} added as ${ROLE_LABELS[data.member.role]}`);
      fetchMembers();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name} (${ROLE_LABELS[m.role]})? This deletes their account.`)) return;
    const res = await fetch(`/api/staff?userId=${m._id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast("Error: " + data.error);
      return;
    }
    showToast(`${m.name} removed`);
    fetchMembers();
  }

  if (!user)
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const inputCls =
    "w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-navy font-body text-sm focus:outline-none focus:border-brand placeholder:text-faint";

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg bg-green-50 border-green-200 text-green-700">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl font-semibold text-navy mb-1">Office Team</h1>
        <p className="text-secondary font-body text-sm mb-8">
          Create and manage office users. Staff cannot sign up themselves and must use a
          company email{domains.length ? ` (${domains.map((d) => "@" + d).join(", ")})` : ""}.
        </p>

        <div className="grid md:grid-cols-[1fr_1.4fr] gap-6 items-start">
          <form
            onSubmit={create}
            className="bg-white border border-border rounded-2xl p-6 shadow-card space-y-4"
          >
            <h2 className="font-body font-semibold text-navy">Add office user</h2>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className={inputCls}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {ROLE_ICONS[r.value]} {r.label}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputCls}
            />
            <input
              required
              type="email"
              placeholder={domains[0] ? `name@${domains[0]}` : "name@company.com"}
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={inputCls}
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Temporary password (min 8)"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className={inputCls}
            />
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 text-white font-semibold rounded-xl disabled:opacity-50 font-body text-sm hover:opacity-90"
              style={{ background: "#1D4ED8" }}
            >
              {saving ? "Adding..." : "Add User"}
            </button>
            <p className="text-xs text-muted font-body">
              Share the temporary password with the user directly.
            </p>
          </form>

          <div className="bg-white border border-border rounded-2xl p-6 shadow-card">
            <h2 className="font-body font-semibold text-navy mb-4">
              Office users <span className="text-muted font-mono text-xs">({members.length})</span>
            </h2>
            {loading ? (
              <div className="py-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted font-body text-sm py-6 text-center">No office users yet</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m._id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body font-medium text-navy text-sm truncate">
                        {m.name}
                        <span className="ml-2 text-[11px] font-mono text-brand bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          {ROLE_ICONS[m.role]} {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </p>
                      <p className="font-mono text-xs text-muted truncate">{m.email}</p>
                    </div>
                    <button
                      onClick={() => remove(m)}
                      className="text-xs font-body px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
