const express = require('express');
const router = express.Router();
const { getAvailableSlots, createBooking, getMyBookings, cancelBooking } = require('../controllers/bookingController');
const auth = require('../middleware/auth');

router.use(auth); // All booking routes require auth

router.get('/available', getAvailableSlots);
router.post('/', createBooking);
router.get('/my', getMyBookings);
router.patch('/:id/cancel', cancelBooking);

module.exports = router;
