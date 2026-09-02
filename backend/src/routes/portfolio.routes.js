const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolio.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Vendor portfolio management
router.get('/my', verifyToken, portfolioController.getMyPortfolio);
router.post('/', verifyToken, portfolioController.createPortfolioItem);
router.delete('/:id', verifyToken, portfolioController.deletePortfolioItem);

module.exports = router;
