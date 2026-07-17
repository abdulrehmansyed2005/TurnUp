const Turf = require('../models/Turf');

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
    const turf = await Turf.create(req.body);
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
    const turf = await Turf.findByIdAndUpdate(req.params.id, req.body, {
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
