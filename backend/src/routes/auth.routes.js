const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// Public routes for login/registration
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/common-login', authController.commonLogin);
router.post('/admin-login', authController.adminLogin);

// Protected route to get current user details
router.get('/me', verifyToken, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// Admin-only user retrieval & deletion
router.get(
  '/users',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  authController.getAllUsers
);

router.delete(
  '/users/:id',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  authController.deleteUser
);

router.patch(
  '/users/:id/restore',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  authController.restoreUser
);

module.exports = router;