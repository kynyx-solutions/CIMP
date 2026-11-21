'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import DocumentsPanel from '@/components/DocumentsPanel';
import FieldInput, { toFieldValue, isFilled, type FieldValue } from '@/components/FieldInput';
import { valueOf, type FormDef } from '@/lib/forms';
import { PIPELINE, STAGES } from '@/lib/workflow';

export default function ApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schema, setSchema] = useState<FormDef | null>(null);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      if (d.user.role !== 'incubatee') { router.push('/dashboard'); return; }
      setUser(d.user);
    });
    // The live form version from the Admin IT form builder (PRD FORM-1), then any saved answers
    Promise.all([
      fetch('/api/forms/application').then(r => r.json()),
      fetch('/api/applications').then(r => r.json()),
    ]).then(([f, a]) => {
      const def: FormDef = f.form;
      const app = a.applications?.[0];
      setSchema(def);
      if (app) setExistingApp(app);
      setForm(Object.fromEntries(def.fields.map(fd => [fd.key, toFieldValue(fd, valueOf(app, fd))])));
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const isEdit = existingApp && existingApp.isEditable;
      const res = await fetch('/api/applications', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { applicationId: existingApp._id, ...form, resubmit: isReturned } : form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  }

  if (!user || !schema) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
        <h2 className="font-display text-2xl font-bold text-navy mb-2">
          {existingApp ? 'Application Updated!' : 'Application Submitted!'}
        </h2>
        <p className="text-muted font-body">You can track every review step from your dashboard. Redirecting…</p>
      </div>
    </div>
  );

  const isLocked = existingApp && !existingApp.isEditable;
  const isReturned = existingApp?.stage === 'returned';
  const required = schema.fields.filter(f => f.required);
  const requiredCount = required.length;
  const filledRequired = required.filter(f => isFilled(form[f.key])).length;
  const sections = schema.sections
    .map(s => ({ ...s, fields: schema.fields.filter(f => f.section === s.title) }))
    .filter(s => s.fields.length > 0);
  const wide = (type: string, key: string) => type === 'textarea' || type === 'multiselect' || key === 'idea';

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        <div>
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold text-navy mb-1">
              {existingApp ? 'Your Application' : 'Apply for Incubation'}
            </h1>
            <p className="text-secondary font-body text-sm">
              {isLocked ? 'Your application is under review and cannot be edited.' : 'Takes about 15 minutes. Fields marked * are required.'}
            </p>
          </div>

          {isLocked && (
            <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <span className="text-lg" aria-hidden="true">🔒</span>
              <p className="text-sm text-amber-700 font-body">Application locked: currently under review by our team. Track progress on your dashboard.</p>
            </div>
          )}

          {existingApp?.officeEdited && (
            <div role="note" className="mb-6 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-800 font-body">
              ✎ The CIMP-BIIF office corrected some details on this application. The old and new values are in your application history on the dashboard.
            </div>
          )}

          {isReturned && (
            <div role="status" className="mb-6 px-5 py-4 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-sm font-body font-semibold text-orange-800">✏️ The reviewer asked for changes</p>
              <p className="text-sm font-body text-orange-800 mt-1 whitespace-pre-line">{existingApp.changeRequest}</p>
              <p className="text-xs font-body text-orange-700 mt-2">Update the fields below, then press <strong>Resubmit for review</strong>. Your application returns to the same review stage.</p>
            </div>
          )}

          {error && <div role="alert" className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {sections.map((section, si) => (
              <fieldset key={section.title} className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
                <legend className="sr-only">{section.title}</legend>
                <div className="mb-5">
                  <p className="text-xs font-mono text-brand uppercase tracking-wider font-semibold">Step {si + 1} of {sections.length}</p>
                  <h2 className="font-display text-xl font-bold text-navy mt-1">{section.title}</h2>
                  {section.desc && <p className="text-sm text-muted font-body">{section.desc}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  {section.fields.map(f => (
                    <div key={f.key} className={wide(f.type, f.key) ? 'sm:col-span-2' : ''}>
                      <label id={`${f.key}-label`} htmlFor={f.key} className="block text-sm font-body font-medium text-navy mb-1.5">
                        {f.label}{f.required && <span className="text-red-500"> *</span>}
                        {f.isPublic && !f.neverPublic && <span className="ml-2 text-[10px] font-mono text-brand bg-leaf-50 border border-leaf-200 px-1.5 py-0.5 rounded-full align-middle">public if approved</span>}
                      </label>
                      <FieldInput f={f} value={form[f.key]} disabled={isLocked} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                      <div className="flex justify-between gap-3 mt-1">
                        <p id={`${f.key}-help`} className="text-xs text-muted font-body">{f.help}</p>
                        {f.maxLength && (f.type === 'textarea' || f.key === 'idea') && (
                          <p className="text-[11px] text-faint font-mono flex-shrink-0">{String(form[f.key] ?? '').length}/{f.maxLength}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            {/* Documents (after the application exists): PRD DOC-1 */}
            <fieldset className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
              <h2 className="font-display text-xl font-bold text-navy">Documents</h2>
              <p className="text-sm text-muted font-body mb-4">
                {isLocked
                  ? 'Your documents are locked while the application is under review. You can still update your logo.'
                  : 'Only you and the CIMP-BIIF review team can open these files, except the logo, which appears on your public profile if you are published.'}
              </p>
              {existingApp ? (
                <DocumentsPanel applicationId={existingApp._id} editable={!isLocked} logoEditable />
              ) : (
                <p className="text-sm text-secondary font-body bg-bg border border-border rounded-xl px-4 py-3">You can upload your pitch deck, ID proof, registration certificate and logo right after submitting.</p>
              )}
            </fieldset>

            {!isLocked && (
              <button type="submit" disabled={loading}
                className="w-full py-3.5 text-white font-semibold rounded-xl transition-all disabled:opacity-50 font-body text-sm hover:opacity-90 bg-brand">
                {loading ? 'Saving…' : isReturned ? 'Resubmit for review →' : existingApp ? 'Update Application' : 'Submit Application →'}
              </button>
            )}
          </form>
        </div>

        {/* Sidebar: progress + what to expect */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          {!isLocked && (
            <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
              <p className="text-xs font-mono text-muted uppercase tracking-wider">Completion</p>
              <p className="font-display text-2xl text-navy mt-1">{filledRequired}/{requiredCount}</p>
              <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(filledRequired / requiredCount) * 100}%` }} />
              </div>
              <p className="text-xs text-muted font-body mt-2">required fields filled</p>
            </div>
          )}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">What happens next</p>
            <ol className="space-y-3">
              {PIPELINE.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm font-body">
                  <span className="w-6 h-6 rounded-full bg-leaf-50 border border-leaf-100 text-brand text-xs font-mono flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-navy">{s === 'ceo_approved' ? "You're in! 🎉" : STAGES[s].label}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted font-body mt-4">You get an email and a dashboard notification at every step.</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Keep these ready</p>
            <ul className="text-sm font-body text-secondary space-y-1.5 list-disc pl-4">
              <li>Founder backgrounds and LinkedIn links</li>
              <li>Registration (CIN) and DPIIT numbers, if any</li>
              <li>Traction numbers: users, revenue, pilots</li>
              <li>Pitch deck (PDF) and founder ID proof</li>
              <li>Incorporation or DPIIT certificate, if registered</li>
              <li>Square logo (PNG or JPG)</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
