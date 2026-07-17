const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.get('/me', auth, getMe);

module.exports = router;
