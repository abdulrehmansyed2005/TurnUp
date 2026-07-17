const User = require('../models/User');
const Turf = require('../models/Turf');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('⚠️  No ADMIN_EMAIL set in .env — skipping admin seed.');
      return;
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`✅ Admin account already exists: ${adminEmail}`);
      return;
    }

    // Create admin user
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'Sports Head',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
      department: 'Sports',
      rollNumber: 'ADMIN',
      isVerified: true, // Admin is pre-verified
    });

    console.log(`🔑 Admin account created: ${admin.email}`);

    // Seed default turf if none exists
    const existingTurf = await Turf.findOne();
    if (!existingTurf) {
      const turf = await Turf.create({
        name: 'FAST NUCES Futsal Turf',
        university: 'FAST NUCES Lahore',
        sportTypes: ['Futsal'],
        location: 'FAST NUCES Lahore Campus',
        openTime: '09:00',
        closeTime: '17:00',
        slotDuration: 60,
        operatingDays: [1, 2, 3, 4, 5],
        isActive: true,
      });
      console.log(`🏟️  Default turf created: ${turf.name}`);
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
