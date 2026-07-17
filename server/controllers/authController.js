const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendOTPEmail } = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route   POST /api/auth/register
// @desc    Register a new student
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, department, rollNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !department || !rollNumber) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check email domain
    if (!email.endsWith('@lhr.nu.edu.pk')) {
      return res.status(400).json({ message: 'Only @lhr.nu.edu.pk email addresses are allowed.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) {
        // User exists but not verified — resend OTP
        const otp = generateOTP();
        console.log(`\n📧 [DEV] OTP for ${email}: ${otp}\n`);
        const salt = await bcrypt.genSalt(10);
        existingUser.otp = await bcrypt.hash(otp, salt);
        existingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await existingUser.save();

        try {
          await sendOTPEmail(email, otp);
        } catch (emailErr) {
          console.error('Email send error:', emailErr);
        }

        return res.status(200).json({
          message: 'Account exists but not verified. New OTP sent to your email.',
          email,
          requiresVerification: true,
        });
      }
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`\n📧 [DEV] OTP for ${email}: ${otp}\n`);
    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      department,
      rollNumber,
      otp: hashedOTP,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Don't fail registration if email fails — user can resend
    }

    res.status(201).json({
      message: 'Registration successful! Check your email for the verification code.',
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/auth/verify-otp
// @desc    Verify email with OTP
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Check OTP expiry
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // Mark as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Email verified successfully!',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    console.log(`\n📧 [DEV] OTP for ${email}: ${otp}\n`);
    const salt = await bcrypt.genSalt(10);
    user.otp = await bcrypt.hash(otp, salt);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }

    res.json({ message: 'New OTP sent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Email not verified. Please verify your email first.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
const getMe = async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { register, verifyOTP, resendOTP, login, getMe };
