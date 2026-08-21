const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendOTPEmail } = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// H6: Use crypto.randomInt — cryptographically secure (Math.random() state is reconstructable)
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

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

    // Enforce university email format: l(2-digit year)(4-digit roll)@lhr.nu.edu.pk
    if (!/^l\d{6}@lhr\.nu\.edu\.pk$/.test(email)) {
      return res.status(400).json({
        message: 'Email must follow the format l(year)(roll)@lhr.nu.edu.pk (e.g. l240690@lhr.nu.edu.pk)',
      });
    }

    // Cross-validate roll number against email
    // Email encodes: l(YY)(RRRR)@... e.g. l240690 → year=24, roll=0690
    // Roll number must match: YY[Ll]-RRRR e.g. 24L-0690
    const emailMatch = email.match(/^l(\d{2})(\d{4})@/);
    const rollMatch = rollNumber.match(/^(\d{2})[Ll]-(\d{4})$/);

    if (!rollMatch) {
      return res.status(400).json({ message: 'Roll number must follow the format 24L-0690.' });
    }

    if (emailMatch[1] !== rollMatch[1] || emailMatch[2] !== rollMatch[2]) {
      return res.status(400).json({
        message: 'Roll number does not match your email address.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) {
        // User exists but not verified — resend OTP
        const otp = generateOTP();
        if (process.env.NODE_ENV !== 'production') console.log(`\n📧 [DEV] OTP for ${email}: ${otp}\n`);
        const salt = await bcrypt.genSalt(10);
        existingUser.otp = await bcrypt.hash(otp, salt);
        existingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        existingUser.otpAttempts = 0; // reset counter on fresh OTP
        await existingUser.save();

        // Fire-and-forget — don't block response waiting for SMTP
        sendOTPEmail(email, otp).catch((emailErr) => console.error('Email send error:', emailErr));

        return res.status(200).json({
          message: 'Account exists but not verified. New OTP sent to your email.',
          email,
          requiresVerification: true,
        });
      }
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    if (process.env.NODE_ENV !== 'production') console.log(`\n📧 [DEV] OTP for ${email}: ${otp}\n`);
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

    // Fire-and-forget — don't block response waiting for SMTP
    sendOTPEmail(email, otp).catch((emailErr) => console.error('Email send error:', emailErr));

    res.status(201).json({
      message: 'Registration successful! Check your email for the verification code.',
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000) {
      // M3: Detect which field caused the duplicate so the error message is accurate
      const dupField = error.keyValue ? Object.keys(error.keyValue)[0] : 'email';
      if (dupField === 'rollNumber') {
        return res.status(400).json({ message: 'This roll number is already registered.' });
      }
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

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts');
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

    // FIX #11: Check if OTP is already locked out from too many attempts
    if (user.otpAttempts >= 3) {
      return res.status(400).json({
        message: 'Too many wrong attempts. Please request a new OTP.',
      });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      user.otpAttempts += 1;
      if (user.otpAttempts >= 3) {
        // Invalidate OTP so they must resend
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        return res.status(400).json({
          message: 'Too many wrong attempts. Your OTP has been invalidated. Please request a new one.',
        });
      }
      await user.save();
      const attemptsLeft = 3 - user.otpAttempts;
      return res.status(400).json({
        message: `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
      });
    }

    // Correct OTP — mark as verified and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
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

    // H8: Generic response — don't reveal whether email is registered
    if (!user || user.isVerified) {
      return res.json({ message: 'If that email is registered and unverified, a new code has been sent.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    if (process.env.NODE_ENV !== 'production') console.log(`\n📧 [DEV] Resend OTP for ${email}: ${otp}\n`); // M11 fixed
    const salt = await bcrypt.genSalt(10);
    user.otp = await bcrypt.hash(otp, salt);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }

    res.json({ message: 'If that email is registered and unverified, a new code has been sent.' });
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

    // Find user with password and login-lock fields
    const user = await User.findOne({ email }).select('+password +loginAttempts +loginLockUntil');
    if (!user) {
      // H7: Generic message — don't reveal whether email exists
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // H7: Check account lock
    if (user.loginLockUntil && user.loginLockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.loginLockUntil - new Date()) / 60000);
      return res.status(429).json({
        message: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // H7: Increment attempt counter, lock after 5 fails
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.loginLockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
        user.loginAttempts = 0;
        await user.save();
        return res.status(429).json({
          message: 'Too many failed attempts. Account locked for 15 minutes.',
        });
      }
      await user.save();
      const attemptsLeft = 5 - user.loginAttempts;
      return res.status(401).json({
        message: `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`,
      });
    }

    // Correct password — reset lockout counter
    if (user.loginAttempts > 0 || user.loginLockUntil) {
      user.loginAttempts = 0;
      user.loginLockUntil = null;
      await user.save();
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

// @route   POST /api/auth/forgot-password
// @desc    Send password-reset OTP to user's email
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts');
    // Always return success to prevent email enumeration
    if (!user || !user.isVerified) {
      return res.json({ message: 'If that email exists, a reset code has been sent.' });
    }

    // H9: Rate-limit per email — max one reset request per 2 minutes
    if (user.otpExpiry && user.otpExpiry > new Date(Date.now() + 8 * 60 * 1000)) {
      return res.status(429).json({
        message: 'A reset code was already sent recently. Please wait 2 minutes before requesting another.',
      });
    }

    const otp = generateOTP();
    if (process.env.NODE_ENV !== 'production') console.log(`\n🔑 [DEV] Password Reset OTP for ${email}: ${otp}\n`); // M12 fixed
    const salt = await bcrypt.genSalt(10);
    user.otp = await bcrypt.hash(otp, salt);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.otpAttempts = 0;
    await user.save();

    try {
      const { sendEmail } = require('../utils/sendEmail');
      const html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #0a0f1c 0%, #111827 100%); border-radius: 16px; border: 1px solid rgba(245,158,11,0.25);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #f59e0b; font-size: 28px; margin: 0;">⚽ TurnUp</h1>
            <p style="color: #9ca3af; font-size: 14px; margin: 4px 0 0;">Password Reset Request</p>
          </div>
          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; text-align: center;">
            <p style="color: #e5e7eb; font-size: 16px; margin: 0 0 16px;">Your password reset code is:</p>
            <div style="background: rgba(245,158,11,0.1); border: 2px dashed #f59e0b; border-radius: 12px; padding: 16px; display: inline-block;">
              <span style="color: #f59e0b; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #9ca3af; font-size: 13px; margin: 16px 0 0;">This code expires in <strong style="color: #f59e0b;">10 minutes</strong>.</p>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 20px 0 0;">If you didn't request this, ignore this email.</p>
        </div>
      `;
      await sendEmail(email, 'TurnUp — Password Reset Code', html);
    } catch (emailErr) {
      console.error('Reset email send error:', emailErr);
    }

    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/auth/reset-password
// @desc    Verify OTP and set new password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry +otpAttempts +password');
    if (!user) return res.status(400).json({ message: 'User not found.' });

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    // FIX #11: Check attempt count before verifying
    if (user.otpAttempts >= 3) {
      return res.status(400).json({
        message: 'Too many wrong attempts. Please request a new reset code.',
      });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      user.otpAttempts += 1;
      if (user.otpAttempts >= 3) {
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        return res.status(400).json({
          message: 'Too many wrong attempts. Your reset code has been invalidated. Please request a new one.',
        });
      }
      await user.save();
      const attemptsLeft = 3 - user.otpAttempts;
      return res.status(400).json({
        message: `Invalid reset code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
      });
    }

    user.password = newPassword; // pre-save hook will hash it
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

module.exports = { register, verifyOTP, resendOTP, login, getMe, forgotPassword, resetPassword };
