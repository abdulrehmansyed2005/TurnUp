const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const EMAIL = 'l240555@lhr.nu.edu.pk';
const NEW_PASSWORD = '289524';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email: EMAIL }).select('+password');
  if (!user) {
    console.error(`❌ No user found with email: ${EMAIL}`);
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(NEW_PASSWORD, salt);
  // Bypass the pre-save hook (which would re-hash) by using updateOne directly
  await User.updateOne({ _id: user._id }, { password: user.password });

  console.log(`✅ Password reset for ${EMAIL}`);
  process.exit(0);
})();
