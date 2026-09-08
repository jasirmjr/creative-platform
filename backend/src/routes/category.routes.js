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

// Admin-only category pricing policy update
router.patch(
  '/:id/pricing',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  categoryController.updateCategoryPricing
);

// Admin-only category deletion
router.delete(
  '/:id',
  verifyToken,
  authorizeRoles('admin', 'super_admin'),
  categoryController.deleteCategory
);

module.exports = router;