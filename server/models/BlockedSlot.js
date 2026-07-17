const mongoose = require('mongoose');

const blockedSlotSchema = new mongoose.Schema({
  turf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turf',
    required: true,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
  },
  reason: {
    type: String,
    required: [true, 'Reason for blocking is required'],
    trim: true,
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Prevent duplicate blocks on same slot
blockedSlotSchema.index({ turf: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('BlockedSlot', blockedSlotSchema);
