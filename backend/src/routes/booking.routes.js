const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

router.post('/', verifyToken, bookingController.createBooking);
router.post('/checkout-cart', verifyToken, bookingController.checkoutCart);
router.get('/my', verifyToken, bookingController.getMyBookings);
router.get('/vendor', verifyToken, bookingController.getVendorBookings);
router.get('/all', verifyToken, bookingController.getAllBookingsAdmin);
router.patch('/:id/admin-pipeline', verifyToken, bookingController.adminUpdateBooking);
router.post('/crew-bundle/:bundleId/create-razorpay-order', verifyToken, bookingController.createRazorpayCrewOrder);
router.post('/crew-bundle/:bundleId/verify-razorpay-payment', verifyToken, bookingController.verifyRazorpayCrewPayment);
router.post('/crew-bundle/:bundleId/pay', verifyToken, bookingController.processCrewBundlePayment);
router.get('/:id/replacement-candidates', verifyToken, bookingController.getReplacementCandidates);
router.post('/:id/replace-vendor', verifyToken, bookingController.replaceVendor);
router.post('/:id/create-razorpay-order', verifyToken, bookingController.createRazorpayOrder);
router.post('/:id/verify-razorpay-payment', verifyToken, bookingController.verifyRazorpayPayment);
router.post('/:id/pay', verifyToken, bookingController.processPayment);
router.patch('/:id/status', verifyToken, bookingController.updateBookingStatus);
router.get('/:id/deliverables', verifyToken, bookingController.getBookingDeliverables);
router.post('/:id/deliverables', verifyToken, bookingController.deliverableUploadMiddleware, bookingController.submitBookingDeliverable);
router.post('/:id/deliverables/:deliverableId/review', verifyToken, bookingController.reviewBookingDeliverable);
router.post('/:id/deliverables/:deliverableId/vendor-reply', verifyToken, bookingController.replyToBookingDeliverable);
router.post('/:id/remind-balance', verifyToken, bookingController.sendBalancePaymentReminder);

router.get(
  '/all',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  bookingController.getAllBookings
);

module.exports = router;