const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public vendor availability check
router.get('/vendor/:vendorId', scheduleController.getVendorAvailability);

// Protected vendor schedule routes
router.get('/my', verifyToken, scheduleController.getMySchedule);
router.post('/block', verifyToken, scheduleController.blockDates);
router.delete('/block/:id', verifyToken, scheduleController.unblockDates);

module.exports = router;
