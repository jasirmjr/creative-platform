const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// Public listing
router.get('/list', vendorController.getRegisteredVendors);

// Protected actions
router.post('/register', verifyToken, vendorController.registerVendor);
router.get('/profile', verifyToken, vendorController.getVendorProfile);
router.put('/profile', verifyToken, vendorController.updateProviderProfile);
router.patch('/availability', verifyToken, vendorController.updateAvailability);

// Admin-only review action
router.patch(
  '/:id/status',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  vendorController.updateVendorStatus
);

module.exports = router;