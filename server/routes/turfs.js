const express = require('express');
const router = express.Router();
const { getTurfs, createTurf, updateTurf } = require('../controllers/turfController');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.get('/', auth, getTurfs);
router.post('/', auth, adminOnly, createTurf);
router.patch('/:id', auth, adminOnly, updateTurf);

module.exports = router;
