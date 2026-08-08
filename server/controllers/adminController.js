const Booking = require('../models/Booking');
const BlockedSlot = require('../models/BlockedSlot');
const User = require('../models/User');
const Turf = require('../models/Turf');
const mongoose = require('mongoose');
const { sendEmail } = require('../utils/sendEmail');

// Helper: Validate HH:MM time format (M8)
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// Allowed booking status values
const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];

// H4/H2: Escape user-supplied strings before embedding in HTML email
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Helper: Get today's date normalized to midnight
const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Helper: Convert "HH:MM" to minutes since midnight
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper: Format "HH:MM" to "12-hour AM/PM" for email readability
const formatTime = (time) => {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// @route   GET /api/admin/bookings
// @desc    Get all bookings with full details (admin view)
// @access  Admin
const getAllBookings = async (req, res) => {
  try {
    const { status, date } = req.query;
    const query = {};

    // H5: Validate status is a plain string from the allowed enum — not an object/operator
    if (status !== undefined) {
      if (typeof status !== 'string' || !BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value.' });
      }
      query.status = status;
    }

    // H5: Validate date is a real parseable date string
    if (date !== undefined) {
      if (typeof date !== 'string') {
        return res.status(400).json({ message: 'Invalid date.' });
      }
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date format.' });
      }
      query.date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else {
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

    // M9: Validate booking ID before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID.' });
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

    // FIX #18: Prevent approving/rejecting a booking whose slot has already passed
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = timeToMinutes(booking.endTime);
    // Only enforce this check if the booking is for today
    const today = getTodayDate();
    const bookingDate = new Date(booking.date);
    const isToday =
      bookingDate.getFullYear() === today.getFullYear() &&
      bookingDate.getMonth() === today.getMonth() &&
      bookingDate.getDate() === today.getDate();

    if (isToday && slotMinutes <= currentMinutes) {
      return res.status(400).json({
        message: 'Cannot approve or reject a booking whose slot has already ended.',
      });
    }

    booking.status = status;
    // M4: Enforce max length on adminNote
    if (adminNote) {
      if (typeof adminNote !== 'string' || adminNote.length > 300) {
        return res.status(400).json({ message: 'Admin note must be a string under 300 characters.' });
      }
      booking.adminNote = adminNote.trim();
    }
    await booking.save();

    // FIX #5: Send email notification to student on approval or rejection
    try {
      const studentEmail = booking.user.email;
      // H4: Escape all user-controlled strings before embedding in HTML email
      const studentName = escapeHtml(booking.user.name);
      const turfName = escapeHtml(booking.turf.name);
      const slotTime = `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;
      const noteSection = adminNote
        ? `<p style="color:#9ca3af;font-size:14px;margin:12px 0 0;">📝 Admin note: <em>${escapeHtml(adminNote)}</em></p>`
        : '';

      const isApproved = status === 'approved';
      const accentColor = isApproved ? '#10b981' : '#ef4444';
      const accentBg = isApproved ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
      const borderColor = isApproved ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
      const emoji = isApproved ? '✅' : '❌';
      const headingText = isApproved ? 'Booking Approved!' : 'Booking Rejected';
      const bodyText = isApproved
        ? `Great news! Your turf booking has been <strong style="color:${accentColor};">approved</strong>. Your slot is confirmed.`
        : `Unfortunately, your turf booking has been <strong style="color:${accentColor};">rejected</strong> by the admin.`;

      const html = `
        <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:linear-gradient(135deg,#0a0f1c 0%,#111827 100%);border-radius:16px;border:1px solid ${borderColor};">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:${accentColor};font-size:28px;margin:0;">⚽ TurnUp</h1>
            <p style="color:#9ca3af;font-size:14px;margin:4px 0 0;">FAST NUCES Lahore — Turf Booking</p>
          </div>
          <div style="background:${accentBg};border-radius:12px;padding:24px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
            <h2 style="color:${accentColor};font-size:22px;margin:0 0 12px;">${headingText}</h2>
            <p style="color:#e5e7eb;font-size:15px;margin:0 0 20px;">Hi ${studentName}, ${bodyText}</p>
            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;text-align:left;">
              <p style="color:#9ca3af;font-size:13px;margin:0 0 6px;">📍 Turf: <span style="color:#f3f4f6;">${turfName}</span></p>
              <p style="color:#9ca3af;font-size:13px;margin:0;">🕐 Slot: <span style="color:#f3f4f6;">${slotTime}</span></p>
            </div>
            ${noteSection}
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center;margin:20px 0 0;">Open TurnUp to view your bookings.</p>
        </div>
      `;

      const subject = isApproved
        ? `TurnUp — Booking Approved for ${slotTime}`
        : `TurnUp — Booking Rejected for ${slotTime}`;

      await sendEmail(studentEmail, subject, html);
    } catch (emailErr) {
      // Don't fail the whole operation if email fails — log and move on
      console.error('Booking status email error:', emailErr);
    }

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

    // M8: Validate time format before storing to prevent corrupt slot display
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ message: 'startTime and endTime must be valid HH:MM format.' });
    }

    // Validate the slot actually exists on this turf
    const turf = await Turf.findById(turfId);
    if (!turf) return res.status(404).json({ message: 'Turf not found.' });
    const validSlots = turf.generateSlots();
    const isValidSlot = validSlots.some((s) => s.startTime === startTime && s.endTime === endTime);
    if (!isValidSlot) {
      return res.status(400).json({ message: 'This time slot does not match any valid slot for this turf.' });
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
    // M9: Validate ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID.' });
    }
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

// @route   GET /api/admin/blocked-slots
// @desc    Get today's blocked slots
// @access  Admin
const getBlockedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    const normalizedDate = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());

    const blockedSlots = await BlockedSlot.find({ date: normalizedDate }).sort({ startTime: 1 });
    res.json({ blockedSlots });
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics (date-aware)
// @access  Admin
const getStats = async (req, res) => {
  try {
    const { date } = req.query;
    let statsDate;
    if (date !== undefined) {
      // H5: Validate date is a real parseable string
      if (typeof date !== 'string') {
        return res.status(400).json({ message: 'Invalid date.' });
      }
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date format.' });
      }
      statsDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else {
      statsDate = getTodayDate();
    }

    const [
      pendingCount,
      approvedCount,
      cancelledCount,   // FIX #20: include cancelled count in stats
      rejectedCount,    // FIX #20: include rejected count in stats
      totalUsers,
      todayBlocked,
    ] = await Promise.all([
      Booking.countDocuments({ date: statsDate, status: 'pending' }),
      Booking.countDocuments({ date: statsDate, status: 'approved' }),
      Booking.countDocuments({ date: statsDate, status: 'cancelled' }),
      Booking.countDocuments({ date: statsDate, status: 'rejected' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      BlockedSlot.countDocuments({ date: statsDate }),
    ]);

    // Total bookings ever submitted for this date (all statuses except expired)
    const todayBookings = pendingCount + approvedCount + cancelledCount + rejectedCount;

    res.json({
      todayBookings,
      pendingCount,
      approvedCount,
      cancelledCount,
      rejectedCount,
      totalUsers,
      todayBlocked,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getAllBookings, updateBookingStatus, blockSlot, unblockSlot, getStats, getBlockedSlots };
