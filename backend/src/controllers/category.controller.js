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
    const { name, type, description, image_url } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }

    const insertQuery = `
      INSERT INTO categories (name, type, description, image_url, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [name, type, description || null, image_url || null]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create Category Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};