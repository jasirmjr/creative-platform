const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// POST /api/v1/reviews (Customer submits review for completed booking)
router.post('/', verifyToken, reviewController.createReview);

// GET /api/v1/reviews/my (Customer views their submitted reviews)
router.get('/my', verifyToken, reviewController.getMyReviews);

// GET /api/v1/reviews/studio (Vendor views reviews received for their studio)
router.get('/studio', verifyToken, authorizeRoles('vendor', 'admin'), reviewController.getStudioReviews);

// GET /api/v1/reviews/vendor/:vendorId (Public: Get reviews for a specific vendor)
router.get('/vendor/:vendorId', reviewController.getVendorReviews);

module.exports = router;
