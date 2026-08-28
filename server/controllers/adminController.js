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

// Helper: Build the status email HTML body
const buildStatusEmailHtml = (studentName, turfName, slotTime, isApproved, adminNote) => {
  const accentColor = isApproved ? '#10b981' : '#ef4444';
  const accentBg = isApproved ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
  const borderColor = isApproved ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
  const emoji = isApproved ? '✅' : '❌';
  const headingText = isApproved ? 'Booking Approved!' : 'Booking Rejected';
  const bodyText = isApproved
    ? `Great news! Your turf booking has been <strong style="color:${accentColor};">approved</strong>. Your slot is confirmed.`
    : `Unfortunately, your turf booking has been <strong style="color:${accentColor};">rejected</strong> by the admin.`;
  const noteSection = adminNote
    ? `<p style="color:#9ca3af;font-size:14px;margin:12px 0 0;">📝 Admin note: <em>${escapeHtml(adminNote)}</em></p>`
    : '';

  return `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:linear-gradient(135deg,#0a0f1c 0%,#111827 100%);border-radius:16px;border:1px solid ${borderColor};">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:${accentColor};font-size:28px;margin:0;">⚽ TurnUp</h1>
        <p style="color:#9ca3af;font-size:14px;margin:4px 0 0;">FAST NUCES Lahore — Turf Booking</p>
      </div>
      <div style="background:${accentBg};border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
        <h2 style="color:${accentColor};font-size:22px;margin:0 0 12px;">${headingText}</h2>
        <p style="color:#e5e7eb;font-size:15px;margin:0 0 20px;">Hi ${escapeHtml(studentName)}, ${bodyText}</p>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;text-align:left;">
          <p style="color:#9ca3af;font-size:13px;margin:0 0 6px;">📍 Turf: <span style="color:#f3f4f6;">${escapeHtml(turfName)}</span></p>
          <p style="color:#9ca3af;font-size:13px;margin:0;">🕐 Slot: <span style="color:#f3f4f6;">${slotTime}</span></p>
        </div>
        ${noteSection}
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:20px 0 0;">Open TurnUp to view your bookings.</p>
    </div>
  `;
};

// Helper: Send "You've moved up!" email to next person in queue
const sendMovedUpEmail = async (user, turfName, slotTime, newPosition) => {
  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:linear-gradient(135deg,#0a0f1c 0%,#111827 100%);border-radius:16px;border:1px solid rgba(245,158,11,0.2);">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#f59e0b;font-size:28px;margin:0;">⚽ TurnUp</h1>
        <p style="color:#9ca3af;font-size:14px;margin:4px 0 0;">FAST NUCES Lahore — Turf Booking</p>
      </div>
      <div style="background:rgba(245,158,11,0.08);border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">📈</div>
        <h2 style="color:#f59e0b;font-size:22px;margin:0 0 12px;">You've Moved Up!</h2>
        <p style="color:#e5e7eb;font-size:15px;margin:0 0 20px;">
          Hi ${escapeHtml(user.name)}, someone ahead of you was rejected. You are now
          <strong style="color:#f59e0b;">#${newPosition} in the queue</strong> for this slot.
        </p>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;text-align:left;">
          <p style="color:#9ca3af;font-size:13px;margin:0 0 6px;">📍 Turf: <span style="color:#f3f4f6;">${escapeHtml(turfName)}</span></p>
          <p style="color:#9ca3af;font-size:13px;margin:0;">🕐 Slot: <span style="color:#f3f4f6;">${slotTime}</span></p>
        </div>
        ${newPosition === 1
          ? `<p style="color:#10b981;font-size:14px;margin:16px 0 0;font-weight:600;">🎯 You are now first in line! The admin will review your request soon.</p>`
          : ''}
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:20px 0 0;">Open TurnUp to check your booking status.</p>
    </div>
  `;
  await sendEmail(user.email, `TurnUp — You've moved up to #${newPosition} in the queue!`, html);
};

// Helper: Send "Slot filled" email when another applicant was approved
const sendSlotFilledEmail = async (user, turfName, slotTime) => {
  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:linear-gradient(135deg,#0a0f1c 0%,#111827 100%);border-radius:16px;border:1px solid rgba(239,68,68,0.2);">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#ef4444;font-size:28px;margin:0;">⚽ TurnUp</h1>
        <p style="color:#9ca3af;font-size:14px;margin:4px 0 0;">FAST NUCES Lahore — Turf Booking</p>
      </div>
      <div style="background:rgba(239,68,68,0.08);border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🏁</div>
        <h2 style="color:#ef4444;font-size:22px;margin:0 0 12px;">Slot Filled</h2>
        <p style="color:#e5e7eb;font-size:15px;margin:0 0 20px;">
          Hi ${escapeHtml(user.name)}, the slot you were waiting for has been confirmed for another team.
          Your request has been automatically closed.
        </p>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;text-align:left;">
          <p style="color:#9ca3af;font-size:13px;margin:0 0 6px;">📍 Turf: <span style="color:#f3f4f6;">${escapeHtml(turfName)}</span></p>
          <p style="color:#9ca3af;font-size:13px;margin:0;">🕐 Slot: <span style="color:#f3f4f6;">${slotTime}</span></p>
        </div>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:20px 0 0;">You can still book a different slot — open TurnUp to check availability.</p>
    </div>
  `;
  await sendEmail(user.email, `TurnUp — Slot filled for ${slotTime}`, html);
};

// @route   GET /api/admin/bookings
// @desc    Get all bookings with full details + waitlist priority info (admin view)
// @access  Admin
const getAllBookings = async (req, res) => {
  try {
    const { status, date, sport } = req.query;
    const query = {};

    // H5: Validate status
    if (status !== undefined) {
      if (typeof status !== 'string' || !BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value.' });
      }
      query.status = status;
    }

    // H5: Validate date
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

    // Filter by sport — find the turf by sportTypes
    if (sport && typeof sport === 'string') {
      const turf = await Turf.findOne({ isActive: true, sportTypes: sport });
      if (turf) {
        query.turf = turf._id;
      }
    }

    // Sort pending by startTime then createdAt (priority order within each slot)
    const bookings = await Booking.find(query)
      .populate('user', 'name email department rollNumber')
      .populate('turf', 'name sportTypes')
      .sort({ startTime: 1, createdAt: 1 });

    // For pending bookings, compute waitlistPosition and slotQueueSize
    // Group pending bookings by (turf, startTime) to assign positions
    const pendingBySlot = {};
    bookings.forEach((b) => {
      if (b.status === 'pending') {
        const key = `${b.turf?._id}-${b.startTime}`;
        if (!pendingBySlot[key]) pendingBySlot[key] = [];
        pendingBySlot[key].push(b._id.toString());
      }
    });

    const enrichedBookings = bookings.map((b) => {
      const obj = b.toObject();
      if (b.status === 'pending') {
        const key = `${b.turf?._id}-${b.startTime}`;
        const queue = pendingBySlot[key] || [];
        obj.waitlistPosition = queue.indexOf(b._id.toString()) + 1;
        obj.slotQueueSize = queue.length;
      }
      return obj;
    });

    res.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Admin get bookings error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   PATCH /api/admin/bookings/:id
// @desc    Approve or reject a booking, with waitlist notifications
// @access  Admin
const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "approved" or "rejected".' });
    }

    // M9: Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID.' });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email')
      .populate('turf', 'name sportTypes');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        message: `Cannot ${status} a booking that is already ${booking.status}.`,
      });
    }

    // FIX #18: Prevent approving/rejecting a booking whose slot has already passed
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = timeToMinutes(booking.endTime);
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

    const slotTime = `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;
    const turfName = booking.turf.name;

    // FIX #5: Send status email to the student
    try {
      const html = buildStatusEmailHtml(
        booking.user.name,
        turfName,
        slotTime,
        status === 'approved',
        adminNote
      );
      const subject =
        status === 'approved'
          ? `TurnUp — Booking Approved for ${slotTime}`
          : `TurnUp — Booking Rejected for ${slotTime}`;
      await sendEmail(booking.user.email, subject, html);
    } catch (emailErr) {
      console.error('Status email error:', emailErr);
    }

    // === WAITLIST SIDE-EFFECTS ===
    if (status === 'approved') {
      // Auto-reject all other pending requests for this slot (slot is now filled)
      const otherPending = await Booking.find({
        turf: booking.turf._id,
        date: booking.date,
        startTime: booking.startTime,
        status: 'pending',
        _id: { $ne: booking._id },
      }).populate('user', 'name email');

      if (otherPending.length > 0) {
        // Bulk reject them
        await Booking.updateMany(
          {
            turf: booking.turf._id,
            date: booking.date,
            startTime: booking.startTime,
            status: 'pending',
            _id: { $ne: booking._id },
          },
          { status: 'rejected', adminNote: 'Slot was confirmed for another team.' }
        );

        // Send "Slot filled" email to each displaced waitlist member
        for (const other of otherPending) {
          try {
            await sendSlotFilledEmail(other.user, turfName, slotTime);
          } catch (e) {
            console.error('Slot-filled email error:', e);
          }
        }
      }
    } else if (status === 'rejected') {
      // Notify the next person in the queue that they've moved up
      const nextInQueue = await Booking.findOne({
        turf: booking.turf._id,
        date: booking.date,
        startTime: booking.startTime,
        status: 'pending',
        _id: { $ne: booking._id },
      })
        .populate('user', 'name email')
        .sort({ createdAt: 1 });

      if (nextInQueue) {
        // Calculate their new position
        const remainingQueue = await Booking.find({
          turf: booking.turf._id,
          date: booking.date,
          startTime: booking.startTime,
          status: 'pending',
        }).sort({ createdAt: 1 });

        const newPosition =
          remainingQueue.findIndex(
            (b) => b._id.toString() === nextInQueue._id.toString()
          ) + 1;

        try {
          await sendMovedUpEmail(nextInQueue.user, turfName, slotTime, newPosition);
        } catch (e) {
          console.error('Moved-up email error:', e);
        }
      }
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

    // M8: Validate time format
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ message: 'startTime and endTime must be valid HH:MM format.' });
    }

    const turf = await Turf.findById(turfId);
    if (!turf) return res.status(404).json({ message: 'Turf not found.' });

    const validSlots = turf.generateSlots();
    const isValidSlot = validSlots.some((s) => s.startTime === startTime && s.endTime === endTime);
    if (!isValidSlot) {
      return res.status(400).json({ message: 'This time slot does not match any valid slot for this turf.' });
    }

    const slotDate = date ? new Date(date) : getTodayDate();
    const normalizedDate = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());

    // Check if slot has an active booking
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

    res.status(201).json({ message: 'Slot blocked successfully.', blockedSlot });
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

    const blockedSlots = await BlockedSlot.find({ date: normalizedDate })
      .populate('turf', 'name sportTypes')
      .sort({ startTime: 1 });

    res.json({ blockedSlots });
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics (date-aware, sport-aware)
// @access  Admin
const getStats = async (req, res) => {
  try {
    const { date, sport } = req.query;
    let statsDate;

    if (date !== undefined) {
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

    // Optionally scope stats to a specific sport's turf
    const statFilter = { date: statsDate };
    if (sport && typeof sport === 'string') {
      const turf = await Turf.findOne({ isActive: true, sportTypes: sport });
      if (turf) statFilter.turf = turf._id;
    }

    const [
      pendingCount,
      approvedCount,
      cancelledCount,
      rejectedCount,
      totalUsers,
      todayBlocked,
    ] = await Promise.all([
      Booking.countDocuments({ ...statFilter, status: 'pending' }),
      Booking.countDocuments({ ...statFilter, status: 'approved' }),
      Booking.countDocuments({ ...statFilter, status: 'cancelled' }),
      Booking.countDocuments({ ...statFilter, status: 'rejected' }),
      User.countDocuments({ role: 'student', isVerified: true }),
      BlockedSlot.countDocuments({ date: statsDate }),
    ]);

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
