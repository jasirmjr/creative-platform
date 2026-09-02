const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public routes for login/registration
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/admin-login', authController.adminLogin);

// Protected route to get current user details
router.get('/me', verifyToken, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;