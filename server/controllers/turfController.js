const Turf = require('../models/Turf');

// H1: Whitelist of allowed fields for turf creation/update — prevents mass assignment
const ALLOWED_TURF_FIELDS = [
  'name', 'university', 'sportTypes', 'location',
  'openTime', 'closeTime', 'slotDuration', 'operatingDays', 'isActive',
];

const pickAllowed = (body) => {
  return ALLOWED_TURF_FIELDS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      acc[key] = body[key];
    }
    return acc;
  }, {});
};

// @route   GET /api/turfs
// @desc    Get all turfs
// @access  Private
const getTurfs = async (req, res) => {
  try {
    const turfs = await Turf.find({ isActive: true });
    res.json({ turfs });
  } catch (error) {
    console.error('Get turfs error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   POST /api/turfs
// @desc    Create a new turf
// @access  Admin
const createTurf = async (req, res) => {
  try {
    // H1: only pass whitelisted fields — prevents slotDuration:0 DoS, field injection, etc.
    const safeData = pickAllowed(req.body);

    if (!safeData.name) {
      return res.status(400).json({ message: 'Turf name is required.' });
    }

    // Validate slotDuration is a positive number
    if (safeData.slotDuration !== undefined) {
      const dur = Number(safeData.slotDuration);
      if (!Number.isFinite(dur) || dur <= 0 || dur > 240) {
        return res.status(400).json({ message: 'slotDuration must be a positive number (max 240 minutes).' });
      }
      safeData.slotDuration = dur;
    }

    const turf = await Turf.create(safeData);
    res.status(201).json({ message: 'Turf created successfully.', turf });
  } catch (error) {
    console.error('Create turf error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @route   PATCH /api/turfs/:id
// @desc    Update turf configuration
// @access  Admin
const updateTurf = async (req, res) => {
  try {
    // H1: only pass whitelisted fields
    const safeData = pickAllowed(req.body);

    if (safeData.slotDuration !== undefined) {
      const dur = Number(safeData.slotDuration);
      if (!Number.isFinite(dur) || dur <= 0 || dur > 240) {
        return res.status(400).json({ message: 'slotDuration must be a positive number (max 240 minutes).' });
      }
      safeData.slotDuration = dur;
    }

    const turf = await Turf.findByIdAndUpdate(req.params.id, safeData, {
      new: true,
      runValidators: true,
    });

    if (!turf) {
      return res.status(404).json({ message: 'Turf not found.' });
    }

    res.json({ message: 'Turf updated successfully.', turf });
  } catch (error) {
    console.error('Update turf error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getTurfs, createTurf, updateTurf };
