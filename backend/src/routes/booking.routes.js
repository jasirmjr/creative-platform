const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/', verifyToken, bookingController.createBooking);
router.post('/checkout-cart', verifyToken, bookingController.checkoutCart);
router.get('/my', verifyToken, bookingController.getMyBookings);
router.get('/vendor', verifyToken, bookingController.getVendorBookings);
router.get('/all', verifyToken, bookingController.getAllBookingsAdmin);
router.patch('/:id/admin-pipeline', verifyToken, bookingController.adminUpdateBooking);
router.post('/:id/pay', verifyToken, bookingController.processPayment);
router.patch('/:id/status', verifyToken, bookingController.updateBookingStatus);

module.exports = router;