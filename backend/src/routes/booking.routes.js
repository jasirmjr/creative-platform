const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/', verifyToken, bookingController.createBooking);
router.get('/my', verifyToken, bookingController.getMyBookings);
router.get('/vendor', verifyToken, bookingController.getVendorBookings);
router.patch('/:id/status', verifyToken, bookingController.updateBookingStatus);

module.exports = router;