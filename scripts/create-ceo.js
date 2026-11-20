/**
 * Create the CEO (owner) account. This is the ONLY way a CEO can be created.
 *
 * Usage:
 *   npm run create-ceo -- --name "Jane Doe" --email jane@yourcompany.com --password "S3cure-pass"
 *
 * Requires DATABASE_URL (.env) and COMPANY_EMAIL_DOMAINS (.env.local).
 * Refuses to run if a CEO already exists (there is a single owner).
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  const name = arg('name');
  const email = arg('email')?.trim().toLowerCase();
  const password = arg('password');

  if (!name || !email || !password) {
    fail('Usage: npm run create-ceo -- --name "Full Name" --email you@company.com --password "..."');
  }
  if (password.length < 8) fail('Password must be at least 8 characters.');

  const domains = (process.env.COMPANY_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (domains.length === 0) fail('Set COMPANY_EMAIL_DOMAINS in .env.local first (e.g. "yourcompany.com").');
  if (!domains.includes(email.split('@')[1])) {
    fail(`CEO email must be on a company domain: ${domains.join(', ')}`);
  }

  const prisma = new PrismaClient();
  try {
    const existingCeo = await prisma.user.findFirst({ where: { role: 'ceo' } });
    if (existingCeo) fail(`A CEO already exists: ${existingCeo.email}`);
    if (await prisma.user.findUnique({ where: { email } })) fail(`A user with email ${email} already exists.`);

    await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 12), role: 'ceo', isVerified: true },
    });
    console.log(`✅ CEO created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
