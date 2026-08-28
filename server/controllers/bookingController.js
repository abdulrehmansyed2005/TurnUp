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
// @desc    Get today's slot availability for a given sport (?sport=Futsal|Basketball)
// @access  Private
const getAvailableSlots = async (req, res) => {
  try {
    const { sport } = req.query;
    const today = getTodayDate();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = getCurrentTime();

    // Find turf by sport type, or default to first active turf
    const turfQuery = { isActive: true };
    if (sport) {
      turfQuery.sportTypes = sport; // MongoDB matches if array contains this value
    }
    const turf = await Turf.findOne(turfQuery);
    if (!turf) {
      return res.status(404).json({ message: 'No active turf found for this sport.' });
    }

    const isOperatingDay = turf.operatingDays.includes(dayOfWeek);
    const allSlots = turf.generateSlots();

    if (!isOperatingDay) {
      return res.json({
        turf: { id: turf._id, name: turf.name, sport: turf.sportTypes[0] || 'Futsal' },
        date: today,
        isOperatingDay: false,
        slots: [],
        message: 'Turf is closed on weekends.',
      });
    }

    // Auto-expire pending bookings whose time has passed
    await autoExpirePendingBookings();

    // Fetch all active bookings for this turf today, sorted by createdAt for priority
    const bookings = await Booking.find({
      turf: turf._id,
      date: today,
      status: { $in: ['pending', 'approved'] },
    }).sort({ createdAt: 1 });

    // Fetch today's blocked slots
    const blockedSlots = await BlockedSlot.find({ turf: turf._id, date: today });

    // Check if current user has an active booking for THIS turf today
    const userActiveBooking = bookings.find(
      (b) => b.user.toString() === req.user._id.toString()
    ) || null;

    // Check if user is locked out for this turf (cancelled within 2 hours)
    const userCancelledBooking = await Booking.findOne({
      user: req.user._id,
      turf: turf._id,
      date: today,
      status: 'cancelled',
      canRebook: false,
    });

    // Build slot status list
    const slots = allSlots.map((slot) => {
      const slotBookings = bookings.filter((b) => b.startTime === slot.startTime);
      const approvedBooking = slotBookings.find((b) => b.status === 'approved');
      // Already sorted by createdAt ascending → index 0 = highest priority
      const pendingBookings = slotBookings.filter((b) => b.status === 'pending');
      const blocked = blockedSlots.find((b) => b.startTime === slot.startTime);
      const isElapsed = timeToMinutes(slot.startTime) <= timeToMinutes(currentTime);

      if (isElapsed) return { ...slot, status: 'elapsed' };
      if (blocked) return { ...slot, status: 'blocked', reason: blocked.reason };

      if (approvedBooking) {
        return { ...slot, status: 'booked', teamName: approvedBooking.teamName };
      }

      if (pendingBookings.length > 0) {
        return {
          ...slot,
          status: 'pending',
          teamName: pendingBookings[0].teamName, // #1 in queue
          waitlistCount: pendingBookings.length,
        };
      }

      return { ...slot, status: 'available' };
    });

    // Calculate user's waitlist position for their active booking
    let userWaitlistPosition = null;
    if (userActiveBooking && userActiveBooking.status === 'pending') {
      const slotPending = bookings.filter(
        (b) => b.startTime === userActiveBooking.startTime && b.status === 'pending'
      );
      // Already sorted by createdAt, so indexOf gives priority position
      userWaitlistPosition =
        slotPending.findIndex((b) => b._id.toString() === userActiveBooking._id.toString()) + 1;
    }

    res.json({
      turf: { id: turf._id, name: turf.name, sport: turf.sportTypes[0] || 'Futsal' },
      date: today,
      isOperatingDay: true,
      slots,
      userHasActiveBooking: !!userActiveBooking,
      userIsLockedOut: !!userCancelledBooking,
      userActiveBookingId: userActiveBooking?._id || null,
      userActiveBookingTime: userActiveBooking
        ? { startTime: userActiveBooking.startTime, endTime: userActiveBooking.endTime }
        : null,
      userWaitlistPosition,
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @route   POST /api/bookings
// @desc    Create a new booking — joins waitlist if slot already has pending requests
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

    // Check if user already has an active booking for THIS TURF today (per-sport rule)
    const existingBooking = await Booking.findOne({
      user: req.user._id,
      turf: turfId,
      date: today,
      status: { $in: ['pending', 'approved'] },
    });
    if (existingBooking) {
      return res.status(400).json({
        message: `You already have a booking for this sport today. One slot per sport per day.`,
      });
    }

    // Block re-booking the exact same slot that was previously rejected today
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

    // Check if user is locked out for this turf (cancelled within 2 hours)
    const cancelledBooking = await Booking.findOne({
      user: req.user._id,
      turf: turfId,
      date: today,
      status: 'cancelled',
      canRebook: false,
    });
    if (cancelledBooking) {
      return res.status(400).json({
        message: 'You cancelled a booking too close to slot time. You cannot rebook today.',
      });
    }

    // Check if slot is blocked by admin
    const blockedSlot = await BlockedSlot.findOne({ turf: turfId, date: today, startTime });
    if (blockedSlot) {
      return res.status(400).json({ message: `This slot is blocked: ${blockedSlot.reason}` });
    }

    // Block joining if the slot is already APPROVED — no waitlist after confirmation
    const approvedSlot = await Booking.findOne({
      turf: turfId,
      date: today,
      startTime,
      status: 'approved',
    });
    if (approvedSlot) {
      return res.status(400).json({
        message: 'This slot has already been confirmed for another team.',
      });
    }

    // Create booking — joins the waitlist if others are already pending
    const booking = await Booking.create({
      user: req.user._id,
      turf: turfId,
      date: today,
      startTime,
      endTime,
      teamName: sanitizeTeamName(teamName),
      status: 'pending',
    });

    // Determine waitlist position (sorted by createdAt ascending)
    const slotPending = await Booking.find({
      turf: turfId,
      date: today,
      startTime,
      status: 'pending',
    }).sort({ createdAt: 1 });

    const waitlistPosition =
      slotPending.findIndex((b) => b._id.toString() === booking._id.toString()) + 1;

    res.status(201).json({
      message: 'Added to the queue! You\'ll be notified by email when the admin responds.',
      booking,
      waitlistPosition,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'You already have a booking for this sport today.',
      });
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
      .populate('turf', 'name sportTypes')
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

    // FIX #15: Prevent cancellation once the slot's end time has passed
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
      return res.status(400).json({
        message: 'You have reached the daily cancellation limit (3). Please contact the sports office.',
      });
    }

    // Calculate 2-hour rule
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = timeToMinutes(booking.startTime);
    const hoursUntilSlot = (slotMinutes - currentMinutes) / 60;
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
