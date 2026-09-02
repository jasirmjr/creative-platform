const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// Public catalog access
router.get('/', categoryController.getCategories);

// Admin-only category creation
router.post(
  '/',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  categoryController.createCategory
);

module.exports = router;