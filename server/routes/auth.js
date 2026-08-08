const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, verifyOTP, resendOTP, login, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const auth = require('../middleware/auth');

// Stricter limiter specifically for OTP email-sending routes (5 per 15 min per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait 15 minutes and try again.' },
});

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', otpLimiter, resendOTP);       // stricter: email-sending
router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/forgot-password', otpLimiter, forgotPassword);  // stricter: email-sending
router.post('/reset-password', resetPassword);

module.exports = router;
