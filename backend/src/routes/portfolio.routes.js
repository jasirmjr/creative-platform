const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolio.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Vendor portfolio management
router.get('/my', verifyToken, portfolioController.getMyPortfolio);
router.get('/vendor/:vendorId', portfolioController.getPublicVendorPortfolio);

// Device File Upload endpoint (image, video, pdf)
router.post('/upload', verifyToken, portfolioController.uploadMiddleware, portfolioController.uploadFile);

// Create portfolio item (supports both JSON with media_url AND multipart/form-data with file)
router.post('/', verifyToken, portfolioController.uploadMiddleware, portfolioController.createPortfolioItem);

router.delete('/:id', verifyToken, portfolioController.deletePortfolioItem);

module.exports = router;
