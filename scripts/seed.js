/**
 * Demo seed: office users, incubatees and sample applications at different stages.
 *
 *   npm run db:seed        (also runs automatically after `npm run db:reset`)
 *
 * DEMO / LOCAL ONLY. Refuses to run when NODE_ENV=production. In production the
 * CEO is created only with `npm run create-ceo` and office users from the Team page.
 * Safe to re-run: existing users and applications are left as they are.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

if (process.env.NODE_ENV === 'production') {
  console.error('❌ The demo seed must not run in production.');
  process.exit(1);
}

const domain = (process.env.COMPANY_EMAIL_DOMAINS || 'cimp.local').split(',')[0].trim().replace(/^@/, '');
const STAFF_PASSWORD = 'Demo@1234';
const INCUBATEE_PASSWORD = 'demo123';

const OFFICE = [
  { role: 'ceo', name: 'Demo CEO', email: `ceo@${domain}` },
  { role: 'admin_it', name: 'Demo Admin IT', email: `admin@${domain}` },
  { role: 'sr_manager', name: 'Demo Sr Manager', email: `srm@${domain}` },
  { role: 'manager', name: 'Demo Incubation Manager', email: `mgr@${domain}` },
  { role: 'executive', name: 'Demo Executive', email: `exec@${domain}` },
  { role: 'staff', name: 'Demo Office Staff', email: `staff@${domain}` },
];

const INCUBATEES = [
  { name: 'Demo Incubatee', email: 'incubatee@demo.com' },
  { name: 'Asha Verma', email: 'founder2@demo.com' },
  { name: 'Rahul Singh', email: 'founder3@demo.com' },
];

// Sample applications. `path` lists the workflow decisions already taken.
const APPLICATIONS = [
  {
    owner: 'incubatee@demo.com',
    data: {
      startupName: 'GreenGrid Labs', industry: 'CleanTech', ventureStage: 'Early revenue', city: 'Patna', state: 'Bihar',
      website: 'https://greengrid.example', founders: 'Neha Kumari - CEO - power systems engineer\nArjun Das - CTO',
      teamSize: 6, phone: '+91 9000000001', idea: 'Smart micro-grid controllers for rural clinics',
      problem: 'Rural clinics lose vaccines and power-dependent care to frequent outages.',
      solution: 'Low-cost controllers that balance solar, battery and grid power automatically.',
      traction: '14 clinics live, ₹18 lakh annual revenue', registrationStatus: 'Private Limited',
      cin: 'U40100BR2024PTC000123', dpiitNumber: 'DIPP123456', fundingRaised: '₹10–50 lakh',
    },
    path: [
      ['exec', 'Accept Submission', 'Documents complete'],
      ['mgr', 'Complete Due Diligence', 'Strong traction and team'],
      ['srm', 'Approve & Sign', 'Recommend approval', 'Demo Sr Manager'],
      ['ceo', 'Final Approve & Sign', 'Approved', 'Demo CEO'],
    ],
    publish: true,
  },
  {
    owner: 'founder2@demo.com',
    data: {
      startupName: 'MediScan', industry: 'HealthTech', ventureStage: 'MVP', city: 'Patna', state: 'Bihar',
      website: 'https://mediscan.example', founders: 'Asha Verma - CEO - ex-radiologist\nRavi Kumar - CTO',
      teamSize: 3, phone: '+91 9000000002', idea: 'AI X-ray triage for district hospitals',
      problem: 'District hospitals wait days for radiologist reads.',
      solution: 'On-device model flags urgent X-rays in minutes.', traction: '2 hospital pilots',
      registrationStatus: 'Private Limited', cin: 'U12345BR2025PTC000001', fundingRaised: 'Under ₹10 lakh',
    },
    path: [['exec', 'Accept Submission', 'Docs ok, check CIN']],
  },
  {
    owner: 'founder3@demo.com',
    data: {
      startupName: 'KisanLink', industry: 'AgriTech', ventureStage: 'Prototype', city: 'Muzaffarpur', state: 'Bihar',
      founders: 'Rahul Singh - founder - agri-economics graduate', teamSize: 2, phone: '+91 9000000003',
      idea: 'Direct market access for litchi farmers', problem: 'Farmers sell to middlemen at a fraction of market price.',
      solution: 'A WhatsApp-first marketplace connecting farmer groups to bulk buyers.', traction: 'None yet',
      registrationStatus: 'Not registered yet', fundingRaised: 'Bootstrapped',
    },
    path: [],
  },
];

// Sample mentors / investors (PRD MEN-1, MEN-2). Names are placeholders until CIMP shares its real network.
const MENTOR_PASSWORD = 'demo123';
const MENTORS = [
  {
    name: 'Sample Mentor: Priya Sinha', email: 'mentor1@demo.com',
    profile: { headline: 'Energy-systems consultant', organisation: 'Independent', yearsExperience: 15,
      expertise: 'Rural electrification, hardware go-to-market, government tenders', sectors: ['CleanTech', 'ESDM / Hardware'],
      bio: 'Fifteen years building solar and storage projects across eastern India.', status: 'approved', reviewedBy: 'Demo Incubation Manager' },
  },
  {
    name: 'Sample Investor: Vikram Rao', email: 'mentor2@demo.com',
    profile: { headline: 'Angel investor, ex-founder', organisation: 'Patna Angels (sample)', yearsExperience: 20,
      expertise: 'Seed fundraising, unit economics, board building', sectors: ['SaaS', 'FinTech', 'CleanTech'],
      status: 'approved', reviewedBy: 'Demo Incubation Manager',
      investorStatus: 'approved', investorThesis: 'Seed-stage B2B companies from Bihar with early revenue.', ticketSize: '₹10–25 lakh' },
  },
  {
    name: 'Sample Mentor: Dr. Meera Jha', email: 'mentor3@demo.com',
    profile: { headline: 'Public-health physician', organisation: 'District hospital (sample)', yearsExperience: 12,
      expertise: 'Clinical pilots, hospital procurement, regulatory approvals', sectors: ['HealthTech', 'AI/ML'],
      status: 'approved', reviewedBy: 'Demo Incubation Manager',
      investorStatus: 'submitted', investorThesis: 'Small cheques into health-access startups.', ticketSize: '₹5–10 lakh' },
  },
  {
    name: 'Sample Mentor: Arvind Kumar', email: 'mentor4@demo.com',
    profile: { headline: 'Agri supply-chain specialist', organisation: 'FPO network (sample)', yearsExperience: 18,
      expertise: 'Farmer producer organisations, cold chain, bulk buyers', sectors: ['AgriTech', 'E-Commerce'],
      status: 'submitted' },
  },
];

// Connections for the approved startup (GreenGrid Labs), one per workflow stage.
const CONNECTIONS = [
  { mentor: 'mentor1@demo.com', type: 'mentorship', status: 'active',
    message: 'We are expanding to 50 clinics and need help with state health-department tenders.',
    path: [['mgr', 'Approve & forward', 'Good fit'], ['srm', 'Route to mentor', null], ['mentor1@demo.com', 'accepted', null]] },
  { mentor: 'mentor2@demo.com', type: 'investment', status: 'routed',
    message: 'Raising a ₹50 lakh seed round; would value a conversation about terms and fit.',
    path: [['mgr', 'Approve & forward', 'Traction supports it'], ['srm', 'Route to mentor', 'Ok']] },
  { mentor: 'mentor3@demo.com', type: 'mentorship', status: 'requested',
    message: 'Looking for advice on running a clinical pilot with our controllers in PHCs.', path: [] },
];

/** A minimal one-page PDF with a few lines of text (placeholder documents). */
function samplePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 28 : 16} Tf 72 ${720 - i * 40} Td (${esc(l)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const STAGE_AFTER = {
  'Accept Submission': 'executive_accepted',
  'Complete Due Diligence': 'manager_reviewed',
  'Approve & Sign': 'sr_manager_approved',
  'Final Approve & Sign': 'ceo_approved',
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const staffHash = await bcrypt.hash(STAFF_PASSWORD, 12);
    const incHash = await bcrypt.hash(INCUBATEE_PASSWORD, 12);
    const users = {};

    for (const o of OFFICE) {
      if (o.role === 'ceo') {
        const existingCeo = await prisma.user.findFirst({ where: { role: 'ceo' } });
        if (existingCeo) { users.ceo = existingCeo; continue; }
      }
      users[o.email.split('@')[0]] = await prisma.user.upsert({
        where: { email: o.email }, update: {},
        create: { ...o, password: staffHash, isVerified: true },
      });
    }
    for (const i of INCUBATEES) {
      users[i.email] = await prisma.user.upsert({
        where: { email: i.email }, update: {},
        create: { ...i, role: 'incubatee', password: incHash, isVerified: true },
      });
    }

    for (const a of APPLICATIONS) {
      const owner = users[a.owner];
      if (await prisma.application.findFirst({ where: { userId: owner.id } })) continue;

      let stage = 'submitted';
      const steps = a.path.map(([who, action, remark, signature], idx) => {
        const actor = users[who];
        const fromStage = stage;
        stage = STAGE_AFTER[action];
        return {
          fromStage, toStage: stage, action, remark, signature: signature || null,
          actorId: actor.id, actorName: actor.name, actorRole: actor.role,
          at: new Date(Date.now() - (a.path.length - idx) * 2 * 86_400_000),
        };
      });

      const created = await prisma.application.create({
        data: {
          ...a.data, userId: owner.id, applicantName: owner.name,
          stage, status: stage === 'ceo_approved' ? 'approved' : 'pending',
          isEditable: a.path.length === 0, isPublic: Boolean(a.publish),
          createdAt: new Date(Date.now() - (a.path.length + 1) * 2 * 86_400_000),
          steps: { create: steps },
          activities: {
            create: [
              { actorName: owner.name, actorRole: 'incubatee', action: 'submitted application' },
              ...steps.map((s) => ({ actorName: s.actorName, actorRole: s.actorRole, action: s.action, detail: s.remark })),
            ],
          },
        },
      });
      // Matching audit trail (PRD AUD-1), so the audit screen has history in the demo
      const created0 = created.createdAt;
      await prisma.auditLog.createMany({
        data: [
          { actorId: owner.id, actorName: owner.name, actorRole: "incubatee", action: "application.submit", entity: "application", entityId: created.id,
            summary: `Submitted application "${created.startupName}" (form v0)`, at: created0 },
          ...steps.map((st) => ({
            actorId: st.actorId, actorName: st.actorName, actorRole: st.actorRole, action: "application.advance", entity: "application", entityId: created.id,
            summary: `${st.action} "${created.startupName}"${st.remark ? ` (remark: ${st.remark})` : ""}${st.signature ? " [signed]" : ""}`,
            diff: { stage: { from: st.fromStage, to: st.toStage } }, at: st.at,
          })),
          ...(a.publish ? [{ actorId: users.ceo?.id ?? null, actorName: "Demo CEO", actorRole: "ceo", action: "application.toggle_public", entity: "application", entityId: created.id,
            summary: `Published "${created.startupName}" to the public directory`, diff: { isPublic: { from: false, to: true } } }] : []),
        ],
      });
    }

    // Mentors and their profiles
    const mentorHash = await bcrypt.hash(MENTOR_PASSWORD, 12);
    for (const m of MENTORS) {
      const u = await prisma.user.upsert({
        where: { email: m.email }, update: {},
        create: { name: m.name, email: m.email, role: 'mentor', password: mentorHash, isVerified: true, consentAt: new Date() },
      });
      users[m.email] = u;
      await prisma.mentorProfile.upsert({ where: { userId: u.id }, update: {}, create: { ...m.profile, userId: u.id } });
    }

    // Connection requests for the approved startup
    const incubatee = users['incubatee@demo.com'];
    const approvedApp = await prisma.application.findFirst({ where: { userId: incubatee.id, status: 'approved' } });
    if (approvedApp && !(await prisma.connection.findFirst({ where: { incubateeId: incubatee.id } }))) {
      const NEXT = { 'Approve & forward': 'manager_approved', 'Route to mentor': 'routed', accepted: 'active' };
      for (const c of CONNECTIONS) {
        let status = 'requested';
        const total = c.path.length + 1;
        const steps = [
          { fromStatus: 'new', toStatus: 'requested', action: 'requested connection', actorId: incubatee.id, actorName: incubatee.name, actorRole: 'incubatee', remark: null, at: new Date(Date.now() - total * 86_400_000) },
          ...c.path.map(([who, action, remark], idx) => {
            const actor = users[who];
            const from = status;
            status = NEXT[action];
            return { fromStatus: from, toStatus: status, action, actorId: actor.id, actorName: actor.name, actorRole: actor.role, remark, at: new Date(Date.now() - (total - idx - 1) * 86_400_000) };
          }),
        ];
        await prisma.connection.create({
          data: {
            incubateeId: incubatee.id, mentorId: users[c.mentor].id, applicationId: approvedApp.id,
            type: c.type, message: c.message, status: c.status, steps: { create: steps },
          },
        });
      }
    }

    // Sample documents (PRD DOC-1): small placeholder PDFs in private storage
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads'));
    fs.mkdirSync(uploadDir, { recursive: true });
    const SAMPLE_DOCS = [
      { owner: 'incubatee@demo.com', kind: 'pitch_deck', fileName: 'GreenGrid-pitch-deck.pdf', lines: ['SAMPLE PITCH DECK', 'GreenGrid Labs', 'Smart micro-grid controllers for rural clinics', 'Placeholder document for the CIMP-BIIF demo'] },
      { owner: 'incubatee@demo.com', kind: 'id_proof', fileName: 'Founder-ID.pdf', lines: ['SAMPLE ID PROOF', 'Placeholder document for the CIMP-BIIF demo', 'No real personal data'] },
      { owner: 'incubatee@demo.com', kind: 'registration', fileName: 'Certificate-of-incorporation.pdf', lines: ['SAMPLE CERTIFICATE', 'GreenGrid Labs Private Limited', 'Placeholder document for the CIMP-BIIF demo'] },
      { owner: 'founder2@demo.com', kind: 'pitch_deck', fileName: 'MediScan-deck.pdf', lines: ['SAMPLE PITCH DECK', 'MediScan', 'AI X-ray triage for district hospitals', 'Placeholder document for the CIMP-BIIF demo'] },
    ];
    for (const d of SAMPLE_DOCS) {
      const app = await prisma.application.findFirst({ where: { userId: users[d.owner].id } });
      if (!app || (await prisma.applicationDocument.findUnique({ where: { applicationId_kind: { applicationId: app.id, kind: d.kind } } }))) continue;
      const buf = samplePdf(d.lines);
      const storedName = `${crypto.randomUUID()}.pdf`;
      fs.writeFileSync(path.join(uploadDir, storedName), buf);
      const doc = await prisma.applicationDocument.create({
        data: { applicationId: app.id, kind: d.kind, fileName: d.fileName, storedName, mimeType: 'application/pdf', size: buf.length, uploadedBy: users[d.owner].id },
      });
      if (d.kind === 'pitch_deck')
        await prisma.application.update({ where: { id: app.id }, data: { pitchDeckUrl: `/api/documents/${doc.id}`, pitchDeckName: d.fileName } });
    }

    // ── Phase 2 samples ──
    const qOf = (d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    const prevQ = (p) => { const [y, q] = [Number(p.slice(0, 4)), Number(p.slice(6))]; return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`; };
    const greenApp = await prisma.application.findFirst({ where: { userId: incubatee.id, status: 'approved' } });
    if (greenApp && (await prisma.qprReport.count()) === 0) {
      const lastQ = prevQ(qOf(new Date())), olderQ = prevQ(lastQ);
      await prisma.qprReport.createMany({ data: [
        { applicationId: greenApp.id, period: olderQ, formVersion: 0, status: 'accepted', submittedAt: new Date(Date.now() - 80 * 864e5), reviewedBy: 'Demo Executive', reviewedAt: new Date(Date.now() - 75 * 864e5), reviewNote: 'Good start.',
          answers: { revenue: 320000, customers: 22, teamSize: 5, fundsRaised: 0, milestones: 'Installed controllers in 8 clinics in Nalanda district.', challenges: 'Slow payments from two clinics.', supportNeeded: 'Introductions to the state health mission.', nextGoals: 'Reach 15 clinics and hire a field engineer.' } },
        { applicationId: greenApp.id, period: lastQ, formVersion: 0, status: 'submitted', submittedAt: new Date(Date.now() - 3 * 864e5),
          answers: { revenue: 450000, customers: 31, teamSize: 6, fundsRaised: 1000000, milestones: 'Live in 14 clinics; first government tender shortlisted.', challenges: 'Battery supply delays.', supportNeeded: 'Mentoring on government procurement.', nextGoals: 'Win the tender and reach 25 clinics.' } },
      ] });
    }
    const activeConn = await prisma.connection.findFirst({ where: { incubateeId: incubatee.id, status: 'active' } });
    if (activeConn && (await prisma.mentorSession.count()) === 0) {
      const m1u = users['mentor1@demo.com'];
      const past = await prisma.mentorSession.create({ data: { connectionId: activeConn.id, scheduledAt: new Date(Date.now() - 6 * 864e5), durationMin: 60, mode: 'physical', location: 'B-Hub meeting room 2', agenda: 'Review the health-department tender and the pricing sheet.', status: 'completed', createdById: m1u.id } });
      await prisma.sessionFeedback.createMany({ data: [
        { sessionId: past.id, authorId: incubatee.id, authorRole: 'mentee', rating: 5, comment: 'Very practical advice on the tender documents.' },
        { sessionId: past.id, authorId: m1u.id, authorRole: 'mentor', rating: 4, comment: 'Well prepared team.' },
      ] });
      const next = new Date(Date.now() + 2 * 864e5); next.setHours(16, 0, 0, 0);
      await prisma.mentorSession.create({ data: { connectionId: activeConn.id, scheduledAt: next, durationMin: 45, mode: 'virtual', location: 'https://meet.google.com/demo-sample', agenda: 'Prepare the tender presentation.', createdById: m1u.id } });
      await prisma.docRequest.create({ data: { connectionId: activeConn.id, title: 'Last 6 months of clinic installations', note: 'A simple sheet: clinic, date, system size.', requestedBy: m1u.id } });
    }
    if (greenApp && users['mentor2@demo.com'] && (await prisma.investmentProposal.count()) === 0) {
      await prisma.investmentProposal.create({ data: { investorId: users['mentor2@demo.com'].id, applicationId: greenApp.id, amount: '₹25 lakh', instrument: 'equity', terms: 'Seed investment for 8% equity with a board observer seat; follow-on rights in the next round.' } });
    }
    if ((await prisma.blogPost.count()) === 0 && users.staff) {
      await prisma.blogPost.createMany({ data: [
        { slug: 'sample-welcome-to-the-cimp-biif-blog', title: 'Sample: Welcome to the CIMP-BIIF blog', excerpt: 'News, events and founder stories from the incubation team. This is a sample post.', authorId: users.staff.id, authorName: users.staff.name, status: 'published', publishedAt: new Date(Date.now() - 2 * 864e5), reviewedBy: 'Demo Admin IT',
          body: 'This blog shares news from CIMP-BIIF: open calls, events at B-Hub and stories from the startups we support.\n\n## What you will find here\n\n- Announcements of new cohorts and deadlines\n- Reports from demo days and workshops\n- Founder stories and lessons learned\n\nThis is a sample post for the portal demo. Real posts are written by the office team and approved by Admin IT before they appear here.' },
        { slug: 'sample-demo-day-preview', title: 'Sample: Demo day preview', excerpt: 'Twelve startups will pitch to investors at B-Hub next month.', authorId: users.staff.id, authorName: users.staff.name, status: 'submitted',
          body: 'Twelve startups from the current cohort will pitch to a panel of investors and mentors at B-Hub next month.\n\nEach team has ten minutes to present and five minutes for questions. Investors interested in a startup can send a proposal through the portal, and the incubation team arranges a follow-up pitch.' },
      ] });
    }

    // Sample conversations (PRD MSG-1, MSG-2)
    if ((await prisma.chatMessage.count()) === 0) {
      const ago = (h) => new Date(Date.now() - h * 3_600_000);
      const msg = (threadType, threadId, u, content, h, read = true) => ({
        threadType, threadId, senderId: u.id, senderName: u.name, senderRole: u.role, content, createdAt: ago(h), read,
      });
      const active = await prisma.connection.findFirst({ where: { incubateeId: incubatee.id, status: 'active' } });
      const m1 = users['mentor1@demo.com'];
      const m2 = users['mentor2@demo.com'];
      const mgr = users.mgr;
      const rows = [];
      if (active) rows.push(
        msg('connection', active.id, incubatee, 'Thank you for accepting! Could we start with the Bihar health-department tender we are bidding for?', 30),
        msg('connection', active.id, m1, 'Happy to help. Please share the tender document and your last two bids. Are you free for a call on Thursday?', 26),
        msg('connection', active.id, incubatee, 'Shared both on email. Thursday 4 pm works for us.', 3, false),
      );
      if (m2 && mgr) rows.push(
        msg('mentor_office', m2.id, mgr, 'Welcome to the CIMP-BIIF network! Demo day is planned for next month; would you join the investor panel?', 48),
        msg('mentor_office', m2.id, m2, 'Yes, count me in. Please send the shortlist a week before.', 20, false),
      );
      if (rows.length) await prisma.chatMessage.createMany({ data: rows });
    }

    console.log('✅ Demo data ready\n');
    console.log(`Office users (password ${STAFF_PASSWORD}):`);
    for (const o of OFFICE) console.log(`  ${o.role.padEnd(11)} ${o.email}`);
    console.log(`Incubatees (password ${INCUBATEE_PASSWORD}):`);
    for (const i of INCUBATEES) console.log(`  ${i.email}`);
    console.log(`Mentors / investors (password ${MENTOR_PASSWORD}):`);
    for (const m of MENTORS) console.log(`  ${m.email}  (${m.profile.status}${m.profile.investorStatus ? `, investor ${m.profile.investorStatus}` : ''})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
