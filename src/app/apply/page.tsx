'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { APPLICATION_SECTIONS, APPLICATION_FIELDS, type AppField } from '@/lib/application-fields';
import { PIPELINE, STAGES } from '@/lib/workflow';

const emptyForm = () => Object.fromEntries(APPLICATION_FIELDS.map(f => [f.key, ''])) as Record<string, string>;

const inputCls =
  'w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-navy font-body text-sm focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors placeholder:text-faint';

export default function ApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      if (d.user.role !== 'incubatee') { router.push('/dashboard'); return; }
      setUser(d.user);
    });
    fetch('/api/applications').then(r => r.json()).then(d => {
      const app = d.applications?.[0];
      if (app) {
        setExistingApp(app);
        setForm(Object.fromEntries(APPLICATION_FIELDS.map(f => [f.key, app[f.key] == null ? '' : String(app[f.key])])));
        if (app.pitchDeckName) setUploadedFile(app.pitchDeckName);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const isEdit = existingApp && existingApp.isEditable;
      const res = await fetch('/api/applications', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { applicationId: existingApp._id, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !existingApp) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('applicationId', existingApp._id);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setUploadedFile(data.name);
    } catch { setError('Upload failed'); }
    finally { setUploadLoading(false); }
  }

  if (!user) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-3xl mx-auto mb-4">🎉</div>
        <h2 className="font-display text-2xl font-semibold text-navy mb-2">
          {existingApp ? 'Application Updated!' : 'Application Submitted!'}
        </h2>
        <p className="text-muted font-body">You can track every review step from your dashboard. Redirecting…</p>
      </div>
    </div>
  );

  const isLocked = existingApp && !existingApp.isEditable;
  const requiredCount = APPLICATION_FIELDS.filter(f => f.required).length;
  const filledRequired = APPLICATION_FIELDS.filter(f => f.required && form[f.key]?.trim()).length;

  function renderField(f: AppField) {
    const common = {
      id: f.key, required: f.required, disabled: isLocked, value: form[f.key] ?? '',
      maxLength: f.maxLength, placeholder: f.placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [f.key]: e.target.value })),
    };
    if (f.type === 'textarea') return <textarea {...common} rows={4} className={`${inputCls} resize-y`} />;
    if (f.type === 'select') return (
      <select {...common} className={inputCls}>
        <option value="">Select…</option>
        {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    return <input {...common} type={f.type === 'number' ? 'number' : f.type} min={f.type === 'number' ? 1 : undefined} className={inputCls} />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        <div>
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold text-navy mb-1">
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

          {error && <div role="alert" className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-body">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {APPLICATION_SECTIONS.map((section, si) => (
              <fieldset key={section.title} className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
                <legend className="sr-only">{section.title}</legend>
                <div className="mb-5">
                  <p className="text-xs font-mono text-brand uppercase tracking-wider font-semibold">Step {si + 1} of {APPLICATION_SECTIONS.length}</p>
                  <h2 className="font-display text-xl font-semibold text-navy mt-1">{section.title}</h2>
                  <p className="text-sm text-muted font-body">{section.desc}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  {section.fields.map(f => (
                    <div key={f.key} className={f.type === 'textarea' || f.key === 'idea' ? 'sm:col-span-2' : ''}>
                      <label htmlFor={f.key} className="block text-sm font-body font-medium text-navy mb-1.5">
                        {f.label}{f.required && <span className="text-red-500"> *</span>}
                      </label>
                      {renderField(f)}
                      <div className="flex justify-between gap-3 mt-1">
                        <p className="text-xs text-muted font-body">{f.help}</p>
                        {f.maxLength && (f.type === 'textarea' || f.key === 'idea') && (
                          <p className="text-[11px] text-faint font-mono flex-shrink-0">{(form[f.key] ?? '').length}/{f.maxLength}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            {/* Pitch Deck Upload (after the application exists) */}
            <fieldset className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
              <h2 className="font-display text-xl font-semibold text-navy">Pitch deck</h2>
              <p className="text-sm text-muted font-body mb-4">PDF or PowerPoint, max 5 MB. Strongly recommended.</p>
              {existingApp ? (
                <>
                  <button type="button" disabled={isLocked} onClick={() => fileRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-colors ${isLocked ? 'border-border opacity-60' : 'border-border hover:border-brand'}`}>
                    {uploadedFile ? (
                      <span className="inline-flex items-center gap-2 text-sm font-body text-navy font-medium">
                        📎 {uploadedFile} {!isLocked && <span className="text-xs text-brand">(click to replace)</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-secondary font-body">{uploadLoading ? 'Uploading…' : 'Click to upload your pitch deck'}</span>
                    )}
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.ppt,.pptx" className="hidden" onChange={handleFileUpload} disabled={isLocked} />
                </>
              ) : (
                <p className="text-sm text-secondary font-body bg-bg border border-border rounded-xl px-4 py-3">You can upload your deck right after submitting.</p>
              )}
            </fieldset>

            {!isLocked && (
              <button type="submit" disabled={loading}
                className="w-full py-3.5 text-white font-semibold rounded-xl transition-all disabled:opacity-50 font-body text-sm hover:opacity-90 bg-brand">
                {loading ? 'Saving…' : existingApp ? 'Update Application' : 'Submit Application →'}
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
                  <span className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-brand text-xs font-mono flex items-center justify-center flex-shrink-0">{i + 1}</span>
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
              <li>Pitch deck (PDF)</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
