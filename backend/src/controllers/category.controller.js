const db = require('../config/db');

// GET /api/v1/categories
// Supports optional query: ?type=talent or ?type=gear_rental
exports.getCategories = async (req, res) => {
  try {
    const { type } = req.query;
    let queryText = 'SELECT * FROM categories WHERE status = $1';
    const queryParams = ['active'];

    if (type) {
      queryText += ' AND type = $2';
      queryParams.push(type);
    }

    queryText += ' ORDER BY name ASC';

    const { rows } = await db.query(queryText, queryParams);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Fetch Categories Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/categories (Restricted to Admin / Super Admin)
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image_url, min_daily_rate, recommended_daily_rate, max_daily_rate } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Discipline name is required.' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Discipline name cannot be empty.' });
    }

    // All categories are creative disciplines where talent brings their own equipment
    const normalizedType = 'talent';

    // Check if category already exists
    const existing = await db.query(
      'SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1;',
      [trimmedName]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Discipline "${existing.rows[0].name}" already exists in the platform catalog.`,
      });
    }

    // Parse and validate rate guardrails
    const min = parseFloat(min_daily_rate);
    const rec = parseFloat(recommended_daily_rate);
    const max = parseFloat(max_daily_rate);

    if (isNaN(min) || isNaN(rec) || isNaN(max)) {
      return res.status(400).json({
        success: false,
        message: 'Floor (min_daily_rate), Benchmark (recommended_daily_rate), and Ceiling (max_daily_rate) are required numbers.',
      });
    }

    if (min <= 0 || rec <= 0 || max <= 0) {
      return res.status(400).json({
        success: false,
        message: 'All daily rates must be greater than zero.',
      });
    }

    if (min > rec || rec > max) {
      return res.status(400).json({
        success: false,
        message: 'Rate logic error: Minimum floor must be ≤ Recommended benchmark ≤ Maximum ceiling.',
      });
    }

    const insertQuery = `
      INSERT INTO categories (name, type, description, image_url, min_daily_rate, recommended_daily_rate, max_daily_rate, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [
      trimmedName,
      normalizedType,
      description ? description.trim() : null,
      image_url || null,
      min,
      rec,
      max,
    ]);

    return res.status(201).json({
      success: true,
      message: `Category "${trimmedName}" created successfully with rate policies.`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Create Category Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// PATCH /api/v1/categories/:id/pricing (Restricted to Admin / Super Admin)
exports.updateCategoryPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { min_daily_rate, recommended_daily_rate, max_daily_rate } = req.body;

    const min = parseFloat(min_daily_rate);
    const rec = parseFloat(recommended_daily_rate);
    const max = parseFloat(max_daily_rate);

    if (isNaN(min) || isNaN(rec) || isNaN(max)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pricing values: min_daily_rate, recommended_daily_rate, and max_daily_rate must be valid numbers.',
      });
    }

    if (min <= 0 || rec <= 0 || max <= 0) {
      return res.status(400).json({
        success: false,
        message: 'All daily rates must be greater than zero.',
      });
    }

    if (min > rec || rec > max) {
      return res.status(400).json({
        success: false,
        message: 'Rate logic error: Minimum rate must be ≤ Recommended benchmark ≤ Maximum ceiling.',
      });
    }

    const query = `
      UPDATE categories
      SET min_daily_rate = $1, recommended_daily_rate = $2, max_daily_rate = $3
      WHERE id = $4
      RETURNING *;
    `;

    const { rows } = await db.query(query, [min, rec, max, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Category pricing policy updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update Category Pricing Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/v1/categories/:id (Restricted to Admin / Super Admin)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const catRes = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (catRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    const categoryName = catRes.rows[0].name;

    // Check if any vendors are linked to this category
    const vendorCheck = await db.query(
      'SELECT COUNT(*)::int AS count FROM vendor_profiles WHERE skills = $1',
      [categoryName]
    );
    const affectedVendors = vendorCheck.rows[0].count;

    // Delete category
    await db.query('DELETE FROM categories WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: `Category "${categoryName}" deleted successfully from catalog.`,
      affectedVendors,
    });
  } catch (error) {
    console.error('Delete Category Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};