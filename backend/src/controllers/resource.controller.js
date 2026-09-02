const db = require('../config/db');

// GET /api/v1/resources?category_id=...&resource_type=...
exports.getResources = async (req, res) => {
  try {
    const { category_id, resource_type } = req.query;

    let queryText = `
      SELECT 
        r.id,
        r.title,
        r.description,
        r.resource_type,
        r.base_price,
        r.pricing_unit,
        r.status,
        c.name AS category_name,
        c.type AS category_type,
        vp.business_name,
        vp.location,
        vp.verification_status,
        u.name AS provider_name
      FROM resources r
      JOIN categories c ON r.category_id = c.id
      JOIN vendor_profiles vp ON r.vendor_id = vp.id
      JOIN users u ON vp.user_id = u.id
      WHERE vp.verification_status = 'verified' AND r.status = 'available'
    `;

    const params = [];
    if (category_id) {
      params.push(category_id);
      queryText += ` AND r.category_id = $${params.length}`;
    }
    if (resource_type) {
      params.push(resource_type);
      queryText += ` AND r.resource_type = $${params.length}`;
    }

    queryText += ' ORDER BY r.created_at DESC;';

    const { rows } = await db.query(queryText, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Fetch Resources Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};