/**
 * Seed script — creates a demo incubatee account.
 * Run: npm run seed  (after setting MONGODB_URI in .env.local)
 *
 * Staff are NOT seeded: create the CEO with `npm run create-ceo`,
 * then the CEO appoints managers from the Team page.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User =
    mongoose.models.User ||
    mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }), 'users');

  const password = await bcrypt.hash('demo123', 12);
  await User.findOneAndUpdate(
    { email: 'incubatee@demo.com' },
    { name: 'Demo Incubatee', email: 'incubatee@demo.com', role: 'incubatee', password, isVerified: true },
    { upsert: true, new: true }
  );
  console.log('✅ incubatee: incubatee@demo.com / demo123');

  console.log('\n🎉 Seed complete!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
