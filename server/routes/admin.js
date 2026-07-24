const express = require('express');
const router = express.Router();
const { getAllBookings, updateBookingStatus, blockSlot, unblockSlot, getStats, getBlockedSlots } = require('../controllers/adminController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(auth, adminOnly); // All admin routes require auth + admin role

router.get('/bookings', getAllBookings);
router.patch('/bookings/:id', updateBookingStatus);
router.post('/block-slot', blockSlot);
router.delete('/block-slot/:id', unblockSlot);
router.get('/blocked-slots', getBlockedSlots);
router.get('/stats', getStats);

module.exports = router;
