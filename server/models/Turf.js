const mongoose = require('mongoose');

const turfSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Turf name is required'],
    trim: true,
  },
  university: {
    type: String,
    required: [true, 'University name is required'],
    trim: true,
  },
  sportTypes: {
    type: [String],
    default: ['Futsal'],
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
  openTime: {
    type: String,
    required: true,
    default: '09:00',
  },
  closeTime: {
    type: String,
    required: true,
    default: '17:00',
  },
  slotDuration: {
    type: Number,
    required: true,
    default: 60, // minutes
  },
  operatingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5], // Mon=1 to Fri=5
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Generate time slots based on open/close time and duration
turfSchema.methods.generateSlots = function () {
  const slots = [];
  const [openHour, openMin] = this.openTime.split(':').map(Number);
  const [closeHour, closeMin] = this.closeTime.split(':').map(Number);
  const openMinutes = openHour * 60 + openMin;
  const closeMinutes = closeHour * 60 + closeMin;

  for (let time = openMinutes; time + this.slotDuration <= closeMinutes; time += this.slotDuration) {
    const startH = Math.floor(time / 60).toString().padStart(2, '0');
    const startM = (time % 60).toString().padStart(2, '0');
    const endTime = time + this.slotDuration;
    const endH = Math.floor(endTime / 60).toString().padStart(2, '0');
    const endM = (endTime % 60).toString().padStart(2, '0');

    slots.push({
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
    });
  }

  return slots;
};

module.exports = mongoose.model('Turf', turfSchema);
