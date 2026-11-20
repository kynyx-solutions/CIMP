/**
 * Seed script — creates a demo incubatee account.
 * Run: npm run seed  (after `npx prisma db push`)
 *
 * Staff are NOT seeded: create the CEO with `npm run create-ceo`,
 * then the CEO creates other office users from the Team page.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function seed() {
  const prisma = new PrismaClient();
  try {
    const password = await bcrypt.hash('demo123', 12);
    await prisma.user.upsert({
      where: { email: 'incubatee@demo.com' },
      update: { password, isVerified: true },
      create: { name: 'Demo Incubatee', email: 'incubatee@demo.com', role: 'incubatee', password, isVerified: true },
    });
    console.log('✅ incubatee: incubatee@demo.com / demo123');
    console.log('\n🎉 Seed complete!');
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => { console.error(err); process.exit(1); });
