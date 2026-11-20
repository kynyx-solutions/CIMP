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

      await prisma.application.create({
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
    }

    console.log('✅ Demo data ready\n');
    console.log(`Office users (password ${STAFF_PASSWORD}):`);
    for (const o of OFFICE) console.log(`  ${o.role.padEnd(11)} ${o.email}`);
    console.log(`Incubatees (password ${INCUBATEE_PASSWORD}):`);
    for (const i of INCUBATEES) console.log(`  ${i.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
