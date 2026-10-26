const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { uploadMiddleware } = require('../controllers/portfolio.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// Public listing
router.get('/list', vendorController.getRegisteredVendors);

// Protected actions
router.post('/register', verifyToken, vendorController.registerVendor);
router.get('/profile', verifyToken, vendorController.getVendorProfile);
router.put('/profile', verifyToken, vendorController.updateProviderProfile);
router.post('/avatar', verifyToken, uploadMiddleware, vendorController.uploadAvatar);
router.patch('/availability', verifyToken, vendorController.updateAvailability);

// Onboarding Listing Deposit actions
router.post('/deposit/create-order', verifyToken, vendorController.createDepositOrder);
router.post('/deposit/verify', verifyToken, vendorController.verifyDepositPayment);

// Admin-only review action
router.patch(
  '/:id/status',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  vendorController.updateVendorStatus
);

// Admin-only deposit status override
router.patch(
  '/:id/deposit-status',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  vendorController.updateDepositStatus
);

module.exports = router;