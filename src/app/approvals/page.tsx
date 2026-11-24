'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import StageBadge from '@/components/StageBadge';
import DocumentsPanel from '@/components/DocumentsPanel';
import SignaturePad from '@/components/SignaturePad';
import { AiApplicationReview } from '@/components/AiTools';
import { STAGES, PIPELINE, ROLE_LABELS, ROLE_ICONS, APPROVAL_RANK, canAct, canViewApplicants, stageEnteredAt, daysSince, daysLabel, progressStage, type Stage } from '@/lib/workflow';
import FieldInput, { toFieldValue, type FieldValue } from '@/components/FieldInput';
import { valueOf, displayValue, type FormDef } from '@/lib/forms';

// Office roles that may correct application fields (PRD RBAC-4); enforced again by the API.
const OFFICE_EDITORS = ['staff', 'executive', 'manager', 'sr_manager', 'ceo'];

type Step = { fromStage: string; toStage: string; action: string; actorName: string; actorRole: string; remark?: string; signature?: string; signatureImage?: string | null; at: string; };
type App = {
  _id: string; applicantName: string; startupName: string; idea: string;
  industry: string; stage: string; status: string; isFastTracked: boolean;
  isPublic: boolean; rejectionReason?: string; steps?: Step[];
  pitchDeckUrl?: string; pitchDeckName?: string; createdAt: string;
  [field: string]: any; // dynamic application form fields
};

type Activity = { _id: string; actorName: string; actorRole: string; action: string; detail?: string; createdAt: string; };
type Message  = { _id: string; senderName: string; senderRole: string; content: string; createdAt: string; read: boolean; };

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [modal, setModal] = useState<{ type: string; app: App } | null>(null);
  const [inputText, setInputText] = useState('');
  const [signature, setSignature] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  // Side panel
  const [sideApp, setSideApp] = useState<App | null>(null);
  const [sideTab, setSideTab] = useState<'details'|'trail'|'timeline'|'messages'>('details');
  const [search, setSearch] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  // Live application form (PRD FORM-1) and office corrections (PRD RBAC-4)
  const [schema, setSchema] = useState<FormDef | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, FieldValue>>({});
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || !canViewApplicants(d.user.role)) { router.push('/dashboard'); return; }
      setUser(d.user);
    });
    fetch('/api/forms/application').then(r => r.json()).then(d => setSchema(d.form ?? null));
  }, [router]);

  function startEdit() {
    if (!schema || !sideApp) return;
    setEditForm(Object.fromEntries(schema.fields.map(f => [f.key, toFieldValue(f, valueOf(sideApp, f))])));
    setEditReason(''); setEditing(true);
  }

  async function saveEdit() {
    if (!schema || !sideApp) return;
    // Send only the fields that changed
    const changes = Object.fromEntries(schema.fields
      .filter(f => JSON.stringify(toFieldValue(f, valueOf(sideApp, f))) !== JSON.stringify(editForm[f.key]))
      .map(f => [f.key, editForm[f.key]]));
    if (!Object.keys(changes).length) { showToast('Nothing changed', 'error'); return; }
    setActionLoading('edit');
    try {
      const res = await fetch('/api/applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId: sideApp._id, changes, reason: editReason }) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast('Corrections saved and the applicant notified', 'success');
      setEditing(false);
      setSideApp(prev => prev ? { ...prev, ...data.application } : prev);
      await fetchApps();
    } finally { setActionLoading(null); }
  }

  useEffect(() => { if (user) fetchApps(); }, [user]);

  async function fetchApps() {
    setLoading(true);
    const res = await fetch('/api/applications');
    const data = await res.json();
    setApps(data.applications || []);
    setLoading(false);
  }

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function takeAction(applicationId: string, action: string, extra: Record<string, string> = {}) {
    setActionLoading(applicationId + action);
    try {
      const res = await fetch('/api/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId, action, ...extra }) });
      const data = await res.json();
      if (!res.ok) { showToast('Error: ' + data.error, 'error'); return; }
      showToast('Done! Application updated.');
      setModal(null); setInputText(''); setSignature(''); setSignatureImage('');
      await fetchApps();
      if (sideApp?._id === applicationId) openSidePanel({ ...sideApp, ...data.application });
    } catch { showToast('Something went wrong', 'error'); }
    finally { setActionLoading(null); }
  }

  async function openSidePanel(app: App) {
    setSideApp(app); setSideTab('details'); setEditing(false);
    const [actRes, msgRes] = await Promise.all([
      fetch(`/api/activity?applicationId=${app._id}`),
      fetch(`/api/messages?applicationId=${app._id}`),
    ]);
    const actData = await actRes.json();
    const msgData = await msgRes.json();
    setActivities(actData.activities || []);
    setMessages(msgData.messages || []);
  }

  async function sendMessage() {
    if (!msgInput.trim() || !sideApp) return;
    setMsgLoading(true);
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicationId: sideApp._id, content: msgInput }) });
      const data = await res.json();
      if (res.ok) { setMessages(prev => [...prev, data.message]); setMsgInput(''); }
    } finally { setMsgLoading(false); }
  }

  const q = search.trim().toLowerCase();
  const filtered = apps.filter(a => {
    if (q && ![a.startupName, a.applicantName, a.industry, a.city].some(v => v?.toLowerCase().includes(q))) return false;
    if (filter === 'all') return true;
    // Items waiting specifically on my role's stage
    if (filter === 'queue') return !!user && STAGES[a.stage as Stage]?.requiredRank === APPROVAL_RANK[user.role];
    if (filter === 'pending') return a.status === 'pending';
    if (filter === 'approved') return a.status === 'approved';
    if (filter === 'rejected') return a.status === 'rejected';
    if (filter === 'fasttracked') return a.isFastTracked;
    return true;
  });

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const isCEO = user.role === 'ceo';
  // Open application that this user can see but not act on
  const isOpenStageFor = (app: App) =>
    !!STAGES[app.stage as Stage]?.next && !canAct(user.role, app.stage, 'advance') && !canAct(user.role, app.stage, 'reject');

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg animate-fade-up ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Reject/Note Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-navy/20 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white border border-border rounded-2xl p-6 w-full max-w-md shadow-card-lg">
            <h3 className="font-display text-xl font-bold text-navy mb-1">
              {modal.type === 'reject' ? 'Reject Application' : modal.type === 'send_back' ? 'Send back for changes' : STAGES[modal.app.stage as Stage]?.actionLabel}
            </h3>
            <p className="text-muted text-sm font-body mb-4">
              {modal.app.startupName} · {STAGES[modal.app.stage as Stage]?.label}
            </p>
            <textarea rows={3} value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder={modal.type === 'reject' ? 'Reason for rejection (required, shown to applicant)...' : modal.type === 'send_back' ? 'What should the applicant change? (required, shown to applicant)...' : 'Remarks (recorded in the approval trail)...'}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-navy font-body text-sm focus:outline-none resize-none mb-4"
              onFocus={e => { e.target.style.borderColor='#6FAE2E'; e.target.style.boxShadow='0 0 0 3px rgba(111,174,46,0.12)'; }}
              onBlur={e => { e.target.style.borderColor=''; e.target.style.boxShadow=''; }} />
            {modal.type === 'advance' && STAGES[modal.app.stage as Stage]?.needsSignature && (
              <div className="mb-4">
                <p className="block text-xs font-body font-semibold text-navy mb-1.5">✍️ Sign with your finger, pen or mouse</p>
                <SignaturePad key={modal.app._id} onChange={setSignatureImage} label={`Sign as ${user.name}`} />
                <label className="block text-xs font-body font-semibold text-navy mt-3 mb-1.5" htmlFor="sig-name">Type your full name</label>
                <input id="sig-name" value={signature} onChange={e => setSignature(e.target.value)} placeholder={user.name}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-navy text-sm focus:outline-none" />
                <p className="text-[11px] text-muted font-body mt-1">The drawn signature and your name are recorded with your account, the date and time, and appear on the signed PDF. Legally valid eSign (Aadhaar / DSC) is a separate decision for CIMP.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setInputText(''); setSignature(''); setSignatureImage(''); }}
                className="flex-1 py-2.5 border border-border text-secondary rounded-xl hover:text-navy hover:border-border-2 transition-colors font-body text-sm">Cancel</button>
              <button
                disabled={!!actionLoading || ((modal.type === 'reject' || modal.type === 'send_back') && !inputText.trim()) || (modal.type === 'advance' && !!STAGES[modal.app.stage as Stage]?.needsSignature && (!signature.trim() || !signatureImage))}
                onClick={() => takeAction(modal.app._id, modal.type, { remark: inputText, signature, signatureImage })}
                className={`flex-1 py-2.5 rounded-xl font-body text-sm font-semibold transition-colors disabled:opacity-50 ${modal.type === 'reject' ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100' : 'text-white hover:opacity-90'}`}
                style={modal.type !== 'reject' ? { background: '#3F7A16' } : {}}>
                {modal.type === 'reject' ? 'Confirm Reject' : modal.type === 'send_back' ? 'Send back' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-navy mb-1">
              {isCEO ? <><span className="shimmer-blue">CEO</span> Command Center</> : 'Applications'}
            </h1>
            <p className="text-secondary font-body text-sm">
              {ROLE_LABELS[user.role]} · Executive Review → Due Diligence → Sr. Manager Approval → CEO Final Approval
            </p>
          </div>
          <div className="bg-white border border-border rounded-xl px-5 py-3 text-center shadow-card">
            <div className="font-display text-2xl text-navy">{apps.length}</div>
            <div className="text-xs font-mono text-muted">Total</div>
          </div>
        </div>

        {/* Search + Filters */}
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by startup, founder, industry or city…" aria-label="Search applications"
          className="w-full sm:w-96 mb-3 bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 placeholder:text-faint" />
        <div className="flex gap-2 mb-6 flex-wrap">
          {[{k:'all',l:'All'},...(APPROVAL_RANK[user.role]?[{k:'queue',l:'📥 My Queue'}]:[]),{k:'pending',l:'Pending'},{k:'approved',l:'Approved'},{k:'rejected',l:'Rejected'},
            ...(isCEO?[{k:'fasttracked',l:'⚡ Fast-Tracked'}]:[])].map(f=>(
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={`px-4 py-2 rounded-lg text-sm font-body font-medium transition-all ${filter===f.k ? 'bg-brand text-white' : 'bg-white border border-border text-secondary hover:border-border-2 hover:text-navy'}`}>
              {f.l}
            </button>
          ))}
        </div>

        <div className={`flex gap-6 ${sideApp ? 'items-start' : ''}`}>
          {/* Main list */}
          <div className={`flex-1 min-w-0 space-y-3 ${loading ? 'opacity-60' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-12 text-center shadow-card">
                <p className="text-muted font-body">No applications found</p>
              </div>
            ) : filtered.map(app => (
              <div key={app._id}
                className={`bg-white border rounded-2xl p-5 shadow-card transition-all cursor-pointer ${sideApp?._id === app._id ? 'border-brand shadow-blue' : app.isFastTracked ? 'border-amber-300 shadow-amber' : 'border-border hover:border-border-2 hover:shadow-card-md'}`}
                onClick={() => openSidePanel(app)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-body font-semibold text-navy">{app.startupName}</h3>
                      <StageBadge stage={app.stage} fastTracked={app.isFastTracked} />
                      {app.isPublic && <span className="text-xs font-mono text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🌐 Public</span>}
                      {app.isFastTracked && <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚡ Fast-Tracked</span>}
                      {app.pitchDeckUrl && <span className="text-xs font-mono text-leaf-800 bg-leaf-50 border border-leaf-200 px-2 py-0.5 rounded-full">📎 Deck</span>}
                    </div>
                    <p className="text-secondary font-body text-sm mb-2 line-clamp-2">{app.idea}</p>
                    <div className="flex items-center gap-3 text-xs font-mono text-muted">
                      <span>👤 {app.applicantName}</span><span>🏭 {app.industry}</span>
                      <span>📅 {new Date(app.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {/* Pipeline progress */}
                    <div className="flex items-center gap-1 mt-3">
                      {PIPELINE.map((s, i) => {
                        const cur = app.stage === 'rejected' ? -1 : PIPELINE.indexOf(progressStage(app) as Stage);
                        return <div key={s} title={STAGES[s].label}
                          className={`h-1.5 flex-1 rounded-full ${app.stage === 'rejected' ? 'bg-red-200' : i <= cur ? 'bg-brand' : 'bg-slate-200'}`} />;
                      })}
                    </div>
                    {STAGES[app.stage as Stage]?.waitingOn && (() => {
                      const d = daysSince(stageEnteredAt(app));
                      return <p className={`mt-1 text-[11px] font-mono ${d >= 7 ? 'text-red-600' : 'text-muted'}`}>
                        Waiting on: {STAGES[app.stage as Stage].waitingOn} · {daysLabel(d)} in this stage{d >= 7 ? ' ⚠' : ''}
                      </p>;
                    })()}
                    {(() => { const last = app.steps?.filter(s => s.remark).slice(-1)[0]; return last && app.stage !== 'rejected' ? (
                      <p className="mt-2 text-xs text-amber-700 font-body bg-amber-50 px-3 py-1.5 rounded-lg">{ROLE_LABELS[last.actorRole]}: {last.remark}</p>) : null; })()}
                    {app.rejectionReason && <p className="mt-2 text-xs text-red-600 font-body bg-red-50 px-3 py-1.5 rounded-lg">Rejected: {app.rejectionReason}</p>}
                    {app.stage === 'returned' && app.changeRequest && <p className="mt-2 text-xs text-orange-700 font-body bg-orange-50 px-3 py-1.5 rounded-lg">Changes requested: {app.changeRequest}</p>}
                  </div>

                  {/* Actions (role- and stage-aware) */}
                  <div className="flex-shrink-0 flex flex-col gap-2 min-w-[170px]" onClick={e => e.stopPropagation()}>
                    {canAct(user.role, app.stage, 'advance') && (
                      <button onClick={() => setModal({ type: 'advance', app })} disabled={!!actionLoading}
                        className="px-4 py-2 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all font-body"
                        style={{ background: '#3F7A16' }}>
                        ✓ {STAGES[app.stage as Stage].actionLabel}
                      </button>
                    )}
                    {canAct(user.role, app.stage, 'fasttrack') && app.stage !== 'sr_manager_approved' && (
                      <button onClick={() => takeAction(app._id, 'fasttrack')} disabled={!!actionLoading}
                        className="px-4 py-2 text-amber-800 text-xs font-bold rounded-lg transition-all font-body animate-pulse-amber"
                        style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>⚡ Fast Track</button>
                    )}
                    {canAct(user.role, app.stage, 'send_back') && (
                      <button onClick={() => setModal({ type: 'send_back', app })} disabled={!!actionLoading}
                        className="px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg hover:bg-orange-100 transition-colors font-body">↩ Send back for changes</button>
                    )}
                    {canAct(user.role, app.stage, 'reject') && (
                      <button onClick={() => setModal({ type: 'reject', app })} disabled={!!actionLoading}
                        className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-100 transition-colors font-body">✗ Reject</button>
                    )}
                    {canAct(user.role, app.stage, 'toggle_public', app.status) && (
                      <button onClick={() => takeAction(app._id, 'toggle_public')} disabled={!!actionLoading}
                        className={`px-4 py-2 text-xs rounded-lg transition-colors font-body border ${app.isPublic ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-bg border-border text-secondary hover:border-border-2 hover:text-navy'}`}>
                        {app.isPublic ? '🌐 Unpublish' : '🌐 Publish'}
                      </button>
                    )}
                    {app.stage === 'ceo_approved' && <span className="text-xs text-center text-green-600 font-mono py-1">Approved ✓</span>}
                    {app.stage === 'rejected' && <span className="text-xs text-center text-red-500 font-mono py-1">Rejected</span>}
                    {isOpenStageFor(app) && <span className="text-[11px] text-center text-muted font-mono py-1">View only</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Side panel */}
          {sideApp && (
            <div className="w-80 flex-shrink-0 bg-white border border-border rounded-2xl shadow-card-lg sticky top-20 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="font-body font-semibold text-navy text-sm truncate">{sideApp.startupName}</h3>
                  <p className="text-xs text-muted font-mono">{sideApp.applicantName}</p>
                </div>
                <button onClick={() => setSideApp(null)} className="w-7 h-7 rounded-lg hover:bg-bg flex items-center justify-center text-muted hover:text-navy transition-colors text-lg">×</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {(['details','trail','timeline','messages'] as const).map(t => (
                  <button key={t} onClick={() => setSideTab(t)}
                    className={`flex-1 py-2.5 text-[11px] font-body font-medium capitalize transition-colors ${sideTab===t ? 'text-brand border-b-2 border-brand bg-leaf-50/50' : 'text-muted hover:text-navy'}`}>
                    {t === 'details' ? '📄 Details' : t === 'trail' ? '✍️ Approvals' : t === 'timeline' ? '⏱ Activity' : '💬 Chat'}
                  </button>
                ))}
              </div>

              <div className="h-96 overflow-y-auto">
                {sideTab === 'details' && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      {sideApp.officeEdited
                        ? <span className="text-[10px] font-mono text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full" title="Corrected by the office; see Activity for old and new values">✎ Edited by office</span>
                        : <span />}
                      <a href={`/api/applications/${sideApp._id}/pdf`} className="ml-auto mr-3 text-[11px] font-body font-semibold text-brand hover:underline" title="Application with approval trail and signatures">⬇ PDF</a>
                      {schema && OFFICE_EDITORS.includes(user.role) && !editing && (
                        <button onClick={startEdit} className="text-[11px] font-body font-semibold text-brand hover:underline">✎ Correct fields</button>
                      )}
                    </div>
                    {schema && editing ? (
                      <div className="space-y-3">
                        <p className="text-[11px] text-muted font-body">Corrections are flagged on the application, recorded with old and new values in the audit log, and the applicant is notified.</p>
                        {schema.fields.map(f => (
                          <div key={f.key}>
                            <label id={`edit-${f.key}-label`} htmlFor={`edit-${f.key}`} className="block text-[11px] text-muted font-body mb-1">{f.label}</label>
                            <FieldInput f={f} idPrefix="edit-" value={editForm[f.key]} onChange={v => setEditForm(p => ({ ...p, [f.key]: v }))} />
                          </div>
                        ))}
                        <label className="block">
                          <span className="block text-[11px] text-navy font-body font-semibold mb-1">Reason for the correction *</span>
                          <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} maxLength={500}
                            placeholder="e.g. Applicant confirmed the correct CIN on a call" className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-body resize-none" />
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-border rounded-lg text-xs font-body text-secondary">Cancel</button>
                          <button onClick={saveEdit} disabled={!editReason.trim() || actionLoading === 'edit'} className="flex-1 py-2 rounded-lg bg-brand text-white text-xs font-semibold font-body disabled:opacity-50">
                            {actionLoading === 'edit' ? 'Saving…' : 'Save corrections'}
                          </button>
                        </div>
                      </div>
                    ) : (schema?.sections ?? []).map(sec => {
                      const fields = schema!.fields.filter(f => f.section === sec.title);
                      if (!fields.length) return null;
                      return (
                        <div key={sec.title}>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">{sec.title}</p>
                          <dl className="space-y-1.5">
                            {fields.map(f => {
                              const v = displayValue(valueOf(sideApp, f));
                              return (
                                <div key={f.key}>
                                  <dt className="text-[11px] text-muted font-body">{f.label}{!f.core && <span className="ml-1 text-[9px] font-mono text-faint">custom</span>}</dt>
                                  <dd className="text-xs text-navy font-body whitespace-pre-line break-words">
                                    {!v ? <span className="text-faint">Not provided</span>
                                      : f.type === 'url' && /^https?:\/\//.test(v)
                                        ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-brand underline">{v}</a>
                                        : v}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </div>
                      );
                    })}
                    {(APPROVAL_RANK[user.role] ?? 0) >= 1 && !editing && <AiApplicationReview key={'ai-' + sideApp._id} applicationId={sideApp._id} />}
                    <div>
                      <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">Documents</p>
                      <DocumentsPanel key={sideApp._id} applicationId={sideApp._id} editable={false} logoEditable={false} compact />
                    </div>
                  </div>
                )}
                {sideTab === 'trail' && (
                  <div className="p-4 space-y-3">
                    {(sideApp.steps ?? []).length === 0 ? (
                      <p className="text-muted text-xs font-body text-center py-8">No decisions yet. Waiting on {STAGES[sideApp.stage as Stage]?.waitingOn}.</p>
                    ) : (sideApp.steps ?? []).map((s, i) => (
                      <div key={i} className="border border-border rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-body font-semibold text-navy">{ROLE_ICONS[s.actorRole]} {s.actorName}</p>
                          <span className="text-[10px] font-mono text-muted">{ROLE_LABELS[s.actorRole]}</span>
                        </div>
                        <p className="text-xs text-secondary font-body mt-1">
                          {s.action} · <span className="text-muted">{STAGES[s.fromStage as Stage]?.label} → {STAGES[s.toStage as Stage]?.label}</span>
                        </p>
                        {s.remark && <p className="text-[11px] text-muted mt-1">&ldquo;{s.remark}&rdquo;</p>}
                        {s.signature && (
                          <div className="mt-1.5 border-t border-dashed border-border pt-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {s.signatureImage && <img src={s.signatureImage} alt={`Signature of ${s.actorName}`} className="h-12 w-auto" />}
                            <p className="text-xs text-navy font-body">Signed: {s.signature}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-faint font-mono mt-1">{new Date(s.at).toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sideTab === 'timeline' && (
                  <div className="p-4">
                    {activities.length === 0 ? (
                      <p className="text-muted text-xs font-body text-center py-8">No activity yet</p>
                    ) : (
                      <div className="space-y-3">
                        {activities.map((act, i) => (
                          <div key={act._id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-6 h-6 rounded-full bg-leaf-50 border border-leaf-200 flex items-center justify-center text-xs flex-shrink-0">
                                {ROLE_ICONS[act.actorRole] ?? '•'}
                              </div>
                              {i < activities.length-1 && <div className="w-px flex-1 bg-border mt-1 min-h-[12px]" />}
                            </div>
                            <div className="pb-3 flex-1">
                              <p className="text-xs font-body text-navy font-semibold">{act.actorName}</p>
                              <p className="text-xs text-secondary font-body">{act.action}</p>
                              {act.detail && <p className="text-[11px] text-muted mt-0.5">"{act.detail}"</p>}
                              <p className="text-[10px] text-faint font-mono mt-0.5">{new Date(act.createdAt).toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sideTab === 'messages' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {messages.length === 0 ? (
                        <p className="text-muted text-xs font-body text-center py-8">No messages yet</p>
                      ) : messages.map(m => (
                        <div key={m._id} className={`flex flex-col ${m.senderRole==='incubatee'?'items-end':'items-start'}`}>
                          <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs font-body ${m.senderRole==='incubatee'?'bg-leaf-700 text-white':'bg-bg border border-border text-navy'}`}>
                            <p className={`font-semibold mb-0.5 ${m.senderRole==='incubatee'?'text-leaf-100':'text-muted'}`}>{m.senderName}</p>
                            {m.content}
                          </div>
                          <p className="text-[10px] text-faint font-mono mt-0.5 px-1">{new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-border flex gap-2">
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                        placeholder="Type a message..." disabled={msgLoading}
                        className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-xs font-body text-navy focus:outline-none placeholder:text-faint"
                        onFocus={e=>{e.target.style.borderColor='#6FAE2E';}} onBlur={e=>{e.target.style.borderColor='';}} />
                      <button onClick={sendMessage} disabled={msgLoading || !msgInput.trim()}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-50 transition-all hover:opacity-90"
                        style={{ background: '#3F7A16' }}>→</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
