'use client';
// Unified inbox (PRD MSG-1, MSG-2): applicant ↔ office, incubatee ↔ mentor, mentor ↔ office.
// Deep link: /messages?type=connection&id=…
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import StageBadge from '@/components/StageBadge';
import { ROLE_LABELS } from '@/lib/workflow';

type Thread = {
  type: 'application' | 'connection' | 'mentor_office'; id: string; title: string; subtitle: string; group: string;
  unread: number; lastAt: string | null; lastText: string | null; stage?: string;
};
type Msg = { _id: string; senderName: string; senderRole: string; content: string; createdAt: string; mine: boolean };

const POLL_MS = 10_000;

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<{ type: Thread['type']; id: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<{ canPost: boolean; notice: string | null; label: string }>({ canPost: false, notice: null, label: '' });
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
  }, [router]);

  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/chat/threads');
    if (res.ok) setThreads((await res.json()).threads);
  }, []);

  const loadMessages = useCallback(async (t: { type: string; id: string }, quiet = false) => {
    if (!quiet) setLoading(true);
    const res = await fetch(`/api/chat?type=${t.type}&id=${t.id}`);
    const d = await res.json();
    if (res.ok) { setMsgs(d.messages); setMeta({ canPost: d.canPost, notice: d.notice, label: d.label }); setError(''); }
    else setError(d.error || 'Could not open this conversation');
    if (!quiet) setLoading(false);
  }, []);

  useEffect(() => { if (user) loadThreads(); }, [user, loadThreads]);

  // Open the deep-linked thread once threads are known
  useEffect(() => {
    const type = params.get('type'); const id = params.get('id');
    if (threads && !active && type && id) setActive({ type: type as Thread['type'], id });
  }, [threads, params, active]);

  useEffect(() => {
    if (!active) return;
    loadMessages(active).then(loadThreads);
    const t = setInterval(() => loadMessages(active, true), POLL_MS);
    return () => clearInterval(t);
  }, [active, loadMessages, loadThreads]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  function open(t: Thread) {
    setActive({ type: t.type, id: t.id });
    router.replace(`/messages?type=${t.type}&id=${t.id}`, { scroll: false });
  }

  async function send() {
    if (!active || !input.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...active, content: input }) });
      const d = await res.json();
      if (res.ok) { setMsgs(p => [...p, d.message]); setInput(''); loadThreads(); }
      else setError(d.error);
    } finally { setSending(false); }
  }

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const current = threads?.find(t => active && t.type === active.type && t.id === active.id);
  const groups = (threads ?? []).reduce<Record<string, Thread[]>>((acc, t) => { (acc[t.group] ??= []).push(t); return acc; }, {});
  const intro = user.role === 'mentor'
    ? 'Talk to your mentees and the CIMP-BIIF office.'
    : user.role === 'incubatee'
      ? 'Talk to the incubation team and, once connected, your mentors.'
      : 'Applicants, mentors and investors in one inbox.';

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-navy mb-1">Messages</h1>
          <p className="text-secondary font-body text-sm">{intro}</p>
        </div>

        <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[480px]">
          {/* Conversation list (hidden on mobile while a chat is open) */}
          <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 bg-white border border-border rounded-2xl shadow-card overflow-hidden flex-col`}>
            <div className="flex-1 overflow-y-auto">
              {threads === null ? (
                <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
              ) : threads.length === 0 ? (
                <p className="text-muted text-sm font-body text-center py-10 px-6">
                  {user.role === 'incubatee' ? 'Submit an application to start talking to the incubation team.' : 'No conversations yet.'}
                </p>
              ) : Object.entries(groups).map(([group, list]) => (
                <section key={group}>
                  <p className="px-4 pt-4 pb-2 text-[11px] font-mono text-muted uppercase tracking-wider bg-surface-2 border-b border-border">{group}</p>
                  {list.map(t => {
                    const sel = active?.type === t.type && active.id === t.id;
                    return (
                      <button key={`${t.type}:${t.id}`} onClick={() => open(t)}
                        className={`w-full px-4 py-3.5 text-left border-b border-border/60 hover:bg-bg transition-colors ${sel ? 'bg-leaf-50 border-l-2 border-l-brand' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-body truncate ${t.unread ? 'font-bold' : 'font-semibold'} ${sel ? 'text-brand' : 'text-navy'}`}>{t.title}</p>
                          {t.lastAt && <span className="text-[10px] font-mono text-muted flex-shrink-0">{timeLabel(t.lastAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted font-body truncate">{t.lastText ?? t.subtitle}</p>
                          {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" aria-label={`${t.unread} unread`}>{t.unread}</span>}
                        </div>
                        {t.stage && <div className="mt-1.5"><StageBadge stage={t.stage} /></div>}
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          </aside>

          {/* Chat window */}
          <section className={`${active ? 'flex' : 'hidden md:flex'} flex-1 bg-white border border-border rounded-2xl shadow-card overflow-hidden flex-col`}>
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-bg border border-border flex items-center justify-center text-3xl mb-4" aria-hidden="true">💬</div>
                <h2 className="font-display text-xl font-bold text-navy mb-2">Select a conversation</h2>
                <p className="text-muted font-body text-sm">Choose a conversation on the left.</p>
              </div>
            ) : (
              <>
                <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                  <button onClick={() => { setActive(null); router.replace('/messages', { scroll: false }); }} className="md:hidden text-brand text-sm font-body font-semibold" aria-label="Back to conversations">←</button>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-body font-semibold text-navy truncate">{current?.title ?? meta.label}</h2>
                    <p className="text-xs text-muted font-body truncate">{current?.subtitle}</p>
                  </div>
                  {current?.stage && <StageBadge stage={current.stage} />}
                  {msgs.length > 0 && <a href={`/api/chat/pdf?type=${active.type}&id=${active.id}`} className="text-xs font-body font-semibold text-brand hover:underline whitespace-nowrap" title="Download this conversation as PDF">⬇ PDF</a>}
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-4" aria-live="polite">
                  {loading ? (
                    <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
                  ) : msgs.length === 0 ? (
                    <p className="text-muted font-body text-sm text-center pt-16">{error || 'No messages yet. Say hello!'}</p>
                  ) : msgs.map(m => (
                    <div key={m._id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-2xl ${m.mine ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-bg border border-border text-navy'}`}>
                        <p className={`text-xs font-semibold mb-1 font-body ${m.mine ? 'text-leaf-100' : 'text-muted'}`}>
                          {m.mine ? 'You' : m.senderName} · {ROLE_LABELS[m.senderRole as keyof typeof ROLE_LABELS] ?? m.senderRole}
                        </p>
                        <p className="text-sm font-body leading-relaxed whitespace-pre-line break-words">{m.content}</p>
                      </div>
                      <p className="text-[10px] text-faint font-mono mt-1 px-1">{timeLabel(m.createdAt)}</p>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                {meta.notice && <p className="px-5 py-2 text-xs font-body text-muted bg-surface-2 border-t border-border">{meta.notice}</p>}
                {meta.canPost && (
                  <div className="px-5 py-4 border-t border-border">
                    {error && msgs.length > 0 && <p role="alert" className="text-xs text-red-600 font-body mb-2">{error}</p>}
                    <div className="flex gap-3 items-end">
                      <label htmlFor="chat-input" className="sr-only">Message</label>
                      <textarea id="chat-input" value={input} onChange={e => setInput(e.target.value)} maxLength={2000}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                        rows={1} placeholder="Type a message (Enter to send, Shift+Enter for a new line)"
                        className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm font-body text-navy resize-none placeholder:text-faint focus:outline-none focus:border-leaf-400 focus:ring-2 focus:ring-leaf-100" />
                      <button onClick={send} disabled={sending || !input.trim()} aria-label="Send message"
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white bg-brand disabled:opacity-40 hover:opacity-90 transition-all flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><Inbox /></Suspense>;
}
