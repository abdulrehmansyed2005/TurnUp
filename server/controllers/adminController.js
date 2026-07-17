const Booking = require('../models/Booking');
const BlockedSlot = require('../models/BlockedSlot');
const User = require('../models/User');
const Turf = require('../models/Turf');

// Helper: Get today's date normalized to midnight
const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// @route   GET /api/admin/bookings
// @desc    Get all bookings with full details (admin view)
// @access  Admin
const getAllBookings = async (req, res) => {
  try {
    const { status, date } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (date) {
      const d = new Date(date);
      query.date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else {
      // Default: today's bookings
      query.date = getTodayDate();
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email department rollNumber')
      .populate('turf', 'name')
      .sort({ startTime: 1 });

    res.json({ bookings });
  } catch (error) {
    console.error('Admin get bookings error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   PATCH /api/admin/bookings/:id
// @desc    Approve or reject a booking
// @access  Admin
const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "approved" or "rejected".' });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email')
      .populate('turf', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `Cannot ${status} a booking that is already ${booking.status}.` });
    }

    booking.status = status;
    if (adminNote) {
      booking.adminNote = adminNote;
    }
    await booking.save();

    res.json({
      message: `Booking ${status} successfully.`,
      booking,
    });
  } catch (error) {
    console.error('Admin update booking error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   POST /api/admin/block-slot
// @desc    Block a slot with a reason
// @access  Admin
const blockSlot = async (req, res) => {
  try {
    const { turfId, date, startTime, endTime, reason } = req.body;

    if (!turfId || !startTime || !endTime || !reason) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Use today's date if no date provided
    const slotDate = date ? new Date(date) : getTodayDate();
    const normalizedDate = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());

    // Check if slot already has an active booking
    const existingBooking = await Booking.findOne({
      turf: turfId,
      date: normalizedDate,
      startTime,
      status: { $in: ['pending', 'approved'] },
    });

    if (existingBooking) {
      return res.status(400).json({
        message: 'This slot has an active booking. Cancel or reject it first before blocking.',
      });
    }

    const blockedSlot = await BlockedSlot.create({
      turf: turfId,
      date: normalizedDate,
      startTime,
      endTime,
      reason,
      blockedBy: req.user._id,
    });

    res.status(201).json({
      message: 'Slot blocked successfully.',
      blockedSlot,
    });
  } catch (error) {
    console.error('Block slot error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This slot is already blocked.' });
    }
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   DELETE /api/admin/block-slot/:id
// @desc    Unblock a slot
// @access  Admin
const unblockSlot = async (req, res) => {
  try {
    const blockedSlot = await BlockedSlot.findByIdAndDelete(req.params.id);

    if (!blockedSlot) {
      return res.status(404).json({ message: 'Blocked slot not found.' });
    }

    res.json({ message: 'Slot unblocked successfully.' });
  } catch (error) {
    console.error('Unblock slot error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Admin
const getStats = async (req, res) => {
  try {
    const today = getTodayDate();

    const [
      todayBookings,
      pendingCount,
      approvedCount,
      totalUsers,
      todayBlocked,
    ] = await Promise.all([
      Booking.countDocuments({ date: today }),
      Booking.countDocuments({ date: today, status: 'pending' }),
      Booking.countDocuments({ date: today, status: 'approved' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      BlockedSlot.countDocuments({ date: today }),
    ]);

    res.json({
      todayBookings,
      pendingCount,
      approvedCount,
      totalUsers,
      todayBlocked,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getAllBookings, updateBookingStatus, blockSlot, unblockSlot, getStats };
