const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  turf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turf',
    required: true,
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
  },
  teamName: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [50, 'Team name cannot exceed 50 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'],
    default: 'pending',
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  canRebook: {
    type: Boolean,
    default: true,
  },
  adminNote: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

// Unique index: only ONE approved booking is allowed per slot.
// Pending requests do NOT block others from joining the waitlist.
bookingSchema.index(
  { turf: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'approved',
    },
    name: 'unique_approved_booking_per_slot',
  }
);

// One active booking per user per turf per day (Option B: per-sport rule).
// A student can book Futsal AND Basketball independently on the same day.
bookingSchema.index(
  { user: 1, turf: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'approved'] },
    },
    name: 'unique_active_booking_per_user_per_turf_per_day',
  }
);

// Index for admin queries
bookingSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
