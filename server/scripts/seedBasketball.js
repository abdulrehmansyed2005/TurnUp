/**
 * seedBasketball.js
 * One-time script to create the Basketball Court turf document in MongoDB.
 *
 * Usage (run from the /server directory):
 *   node scripts/seedBasketball.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from the server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Turf = require('../models/Turf');

const BASKETBALL_TURF = {
  name: 'Basketball Court',
  university: 'FAST NUCES Lahore',
  sportTypes: ['Basketball'],
  location: 'Sports Complex',
  openTime: '09:00',
  closeTime: '17:00',
  slotDuration: 60,          // 1-hour slots
  operatingDays: [1, 2, 3, 4, 5], // Mon–Fri
  isActive: true,
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Avoid duplicate seeding
    const existing = await Turf.findOne({ sportTypes: 'Basketball' });
    if (existing) {
      console.log('⚠️  Basketball Court already exists — skipping.');
      console.log(`   Name: ${existing.name} | ID: ${existing._id}`);
      process.exit(0);
    }

    const turf = await Turf.create(BASKETBALL_TURF);
    console.log('\n🏀 Basketball Court created successfully!');
    console.log(`   Name: ${turf.name}`);
    console.log(`   ID:   ${turf._id}`);
    console.log(`   Slots: ${turf.openTime} – ${turf.closeTime} (${turf.slotDuration} min each)`);
    console.log('\nDone. Students can now book Basketball slots from the Home page.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
