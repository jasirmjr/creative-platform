const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaint.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// All complaint routes require authentication
router.use(verifyToken);

// Customer endpoints
router.post('/', complaintController.complaintUploadMiddleware, complaintController.createComplaint);
router.get('/my', complaintController.getMyComplaints);
router.post('/:id/accept-vendor-offer', complaintController.acceptVendorOffer);
router.post('/:id/escalate', complaintController.escalateToAdmin);

// Vendor endpoints
router.get('/vendor', complaintController.getVendorComplaints);
router.post('/:id/vendor-response', complaintController.complaintUploadMiddleware, complaintController.submitVendorResponse);
router.post('/:id/accept-client-offer', complaintController.acceptClientOffer);
router.post('/:id/counter-offer', complaintController.submitVendorCounterOffer);

// Admin Quick Enforcement & Management endpoints
router.get('/all', authorizeRoles('admin', 'super_admin'), complaintController.getAllComplaints);
router.patch('/:id/status', authorizeRoles('admin', 'super_admin'), complaintController.updateComplaintStatus);
router.post('/:id/refund', authorizeRoles('admin', 'super_admin'), complaintController.processRazorpayRefund);
router.post('/:id/strike', authorizeRoles('admin', 'super_admin'), complaintController.issueVendorStrike);
router.post('/:id/strike/revoke', authorizeRoles('admin', 'super_admin'), complaintController.revokeVendorStrike);
router.post('/:id/split-settlement', authorizeRoles('admin', 'super_admin'), complaintController.splitSettlement);

// Shared Timeline / Replies endpoints (Customer, Vendor, Admin)
router.get('/:id/timeline', complaintController.getComplaintTimeline);
router.post('/:id/replies', complaintController.complaintUploadMiddleware, complaintController.addComplaintReply);

module.exports = router;
