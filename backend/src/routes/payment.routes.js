const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public/authenticated receipt details endpoint
router.get('/:id/receipt', verifyToken, paymentController.getReceiptDetails);

// Get all payments for a booking
router.get('/booking/:bookingId', verifyToken, paymentController.getBookingPayments);

// Get vendor listing deposit payment
router.get('/vendor/:vendorId/deposit', verifyToken, paymentController.getVendorDepositPayment);

module.exports = router;
