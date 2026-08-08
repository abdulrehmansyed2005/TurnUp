const Booking = require('../models/Booking');
const BlockedSlot = require('../models/BlockedSlot');
const Turf = require('../models/Turf');
const mongoose = require('mongoose');

// Allowed booking status values for query filtering
const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];

// H2: Strip HTML tags from team name to prevent stored email injection
const sanitizeTeamName = (name) => String(name).replace(/<[^>]*>/g, '').trim();

// Helper: Get today's date normalized to midnight (local time)
const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Helper: Get current time as "HH:MM" string
const getCurrentTime = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

// Helper: Convert "HH:MM" to minutes since midnight
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper: Auto-expire pending bookings whose slot time has passed
const autoExpirePendingBookings = async () => {
  const today = getTodayDate();
  const currentTime = getCurrentTime();

  await Booking.updateMany(
    {
      date: today,
      status: 'pending',
      startTime: { $lte: currentTime },
    },
    { status: 'expired' }
  );
};

// @route   GET /api/bookings/available
// @desc    Get today's slot availability (no user identity revealed)
// @access  Private
const getAvailableSlots = async (req, res) => {
  try {
    const today = getTodayDate();
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const currentTime = getCurrentTime();

    // Find the turf
    const turf = await Turf.findOne({ isActive: true });
    if (!turf) {
      return res.status(404).json({ message: 'No active turf found.' });
    }

    // Check if today is an operating day
    const isOperatingDay = turf.operatingDays.includes(dayOfWeek);

    // Generate all possible slots
    const allSlots = turf.generateSlots();

    if (!isOperatingDay) {
      return res.json({
        turf: { id: turf._id, name: turf.name },
        date: today,
        isOperatingDay: false,
        slots: [],
        message: 'Turf is closed on weekends.',
      });
    }

    // Auto-expire pending bookings
    await autoExpirePendingBookings();

    // Get today's bookings (active ones: pending or approved)
    const bookings = await Booking.find({
      turf: turf._id,
      date: today,
      status: { $in: ['pending', 'approved'] },
    });

    // Get today's blocked slots
    const blockedSlots = await BlockedSlot.find({
      turf: turf._id,
      date: today,
    });

    // Check if current user has an active booking today
    const userActiveBooking = await Booking.findOne({
      user: req.user._id,
      date: today,
      status: { $in: ['pending', 'approved'] },
    });

    // Check if user is locked out (cancelled within 2 hours of slot)
    const userCancelledBooking = await Booking.findOne({
      user: req.user._id,
      date: today,
      status: 'cancelled',
      canRebook: false,
    });

    // Build slot status list
    const slots = allSlots.map((slot) => {
      const booking = bookings.find((b) => b.startTime === slot.startTime);
      const blocked = blockedSlots.find((b) => b.startTime === slot.startTime);
      const isElapsed = timeToMinutes(slot.startTime) <= timeToMinutes(currentTime);

      if (isElapsed) {
        return { ...slot, status: 'elapsed' };
      }

      if (blocked) {
        return { ...slot, status: 'blocked', reason: blocked.reason };
      }

      if (booking) {
        return {
          ...slot,
          status: booking.status === 'approved' ? 'booked' : 'pending',
          teamName: booking.teamName, // Show team name in the slot box
        };
      }

      return { ...slot, status: 'available' };
    });

    res.json({
      turf: { id: turf._id, name: turf.name },
      date: today,
      isOperatingDay: true,
      slots,
      userHasActiveBooking: !!userActiveBooking,
      userIsLockedOut: !!userCancelledBooking,
      userActiveBookingId: userActiveBooking?._id || null,
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
const createBooking = async (req, res) => {
  try {
    const { turfId, startTime, endTime, teamName } = req.body;
    const today = getTodayDate();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = getCurrentTime();

    // Admins cannot book slots
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admins cannot book slots.' });
    }

    // Validate required fields
    if (!turfId || !startTime || !endTime || !teamName) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if turf exists and is active
    const turf = await Turf.findById(turfId);
    if (!turf || !turf.isActive) {
      return res.status(404).json({ message: 'Turf not found or inactive.' });
    }

    // Check if today is an operating day
    if (!turf.operatingDays.includes(dayOfWeek)) {
      return res.status(400).json({ message: 'Turf is closed today.' });
    }

    // Check if slot is in the future
    if (timeToMinutes(startTime) <= timeToMinutes(currentTime)) {
      return res.status(400).json({ message: 'Cannot book a slot that has already started or passed.' });
    }

    // Check if slot is valid
    const allSlots = turf.generateSlots();
    const isValidSlot = allSlots.some((s) => s.startTime === startTime && s.endTime === endTime);
    if (!isValidSlot) {
      return res.status(400).json({ message: 'Invalid time slot.' });
    }

    // Auto-expire pending bookings
    await autoExpirePendingBookings();

    // Check if user already has an active booking today
    const existingBooking = await Booking.findOne({
      user: req.user._id,
      date: today,
      status: { $in: ['pending', 'approved'] },
    });
    if (existingBooking) {
      return res.status(400).json({ message: 'You already have a booking for today. One slot per person per day.' });
    }

    // FIX #14: Block re-booking the exact same slot that was previously rejected
    const rejectedSameSlot = await Booking.findOne({
      user: req.user._id,
      turf: turfId,
      date: today,
      startTime,
      status: 'rejected',
    });
    if (rejectedSameSlot) {
      return res.status(400).json({
        message: 'This slot was already rejected for you today. Please choose a different slot.',
      });
    }

    // Check if user is locked out (cancelled within 2 hours)
    const cancelledBooking = await Booking.findOne({
      user: req.user._id,
      date: today,
      status: 'cancelled',
      canRebook: false,
    });
    if (cancelledBooking) {
      return res.status(400).json({ message: 'You cancelled a booking too close to slot time. You cannot rebook today.' });
    }

    // Check if slot is blocked
    const blockedSlot = await BlockedSlot.findOne({
      turf: turfId,
      date: today,
      startTime,
    });
    if (blockedSlot) {
      return res.status(400).json({ message: `This slot is blocked: ${blockedSlot.reason}` });
    }

    // Check if slot is already booked
    const existingSlotBooking = await Booking.findOne({
      turf: turfId,
      date: today,
      startTime,
      status: { $in: ['pending', 'approved'] },
    });
    if (existingSlotBooking) {
      return res.status(400).json({ message: 'This slot is already booked.' });
    }

    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      turf: turfId,
      date: today,
      startTime,
      endTime,
      teamName: sanitizeTeamName(teamName), // H2: strip any HTML before storing
      status: 'pending',
    });

    res.status(201).json({
      message: 'Booking created! Waiting for admin approval.',
      booking,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This slot is already booked.' });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   GET /api/bookings/my
// @desc    Get current user's bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { user: req.user._id };

    // M6: Validate status is a plain string in the allowed enum — not an object/operator
    if (status !== undefined) {
      if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value.' });
      }
      query.status = status;
    }

    // Auto-expire pending bookings
    await autoExpirePendingBookings();

    const bookings = await Booking.find(query)
      .populate('turf', 'name')
      .sort({ date: -1, startTime: -1 });

    res.json({ bookings });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   PATCH /api/bookings/:id/cancel
// @desc    Cancel a booking (with 2-hour rebook rule)
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    // M9: Validate booking ID before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID.' });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Check ownership
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only cancel your own bookings.' });
    }

    // Check if booking is cancellable
    if (!['pending', 'approved'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking cannot be cancelled.' });
    }

    // FIX #15: Prevent cancellation once the slot's end time has passed (it's history)
    const currentTime = getCurrentTime();
    if (timeToMinutes(booking.endTime) <= timeToMinutes(currentTime)) {
      return res.status(400).json({ message: 'Cannot cancel a slot that has already ended.' });
    }

    // FIX #16: Daily cancellation limit — max 3 cancellations per day
    const today = getTodayDate();
    const cancelledTodayCount = await Booking.countDocuments({
      user: req.user._id,
      date: today,
      status: 'cancelled',
    });
    if (cancelledTodayCount >= 3) {
      return res.status(400).json({ message: 'You have reached the daily cancellation limit (3). Please contact the sports office.' });
    }

    // Calculate 2-hour rule
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = timeToMinutes(booking.startTime);
    const hoursUntilSlot = (slotMinutes - currentMinutes) / 60;

    // Can rebook if cancelled 2+ hours before slot
    const canRebook = hoursUntilSlot >= 2;

    booking.status = 'cancelled';
    booking.cancelledAt = now;
    booking.canRebook = canRebook;
    await booking.save();

    res.json({
      message: canRebook
        ? 'Booking cancelled. You can book another slot today.'
        : 'Booking cancelled. Since it was less than 2 hours before the slot, you cannot rebook today.',
      canRebook,
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

module.exports = { getAvailableSlots, createBooking, getMyBookings, cancelBooking };
