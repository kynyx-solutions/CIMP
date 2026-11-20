/**
 * Create the CEO (owner) account. This is the ONLY way a CEO can be created.
 *
 * Usage:
 *   npm run create-ceo -- --name "Jane Doe" --email jane@yourcompany.com --password "S3cure-pass"
 *
 * Requires MONGODB_URI and COMPANY_EMAIL_DOMAINS in .env.local.
 * Refuses to run if a CEO already exists (there is a single owner).
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

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

  if (!process.env.MONGODB_URI) fail('Set MONGODB_URI in .env.local first.');
  await mongoose.connect(process.env.MONGODB_URI);

  // Loose model over the existing users collection (schema lives in src/models/User.ts).
  const User =
    mongoose.models.User ||
    mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }), 'users');

  const existingCeo = await User.findOne({ role: 'ceo' }).lean();
  if (existingCeo) fail(`A CEO already exists: ${existingCeo.email}`);

  if (await User.findOne({ email }).lean()) fail(`A user with email ${email} already exists.`);

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: 'ceo',
    isVerified: true,
  });

  console.log(`✅ CEO created: ${email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
