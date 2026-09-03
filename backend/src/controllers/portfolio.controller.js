const db = require('../config/db');

// GET /api/v1/portfolios/my
// Protected: Returns all gallery works for the logged-in vendor
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;

    // Look up vendor profile id for this user
    let vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      // Auto-create a pending vendor profile if user is vendor but profile row missing
      const newVp = await db.query(
        `INSERT INTO vendor_profiles (user_id, business_name, verification_status)
         VALUES ($1, 'Creative Studio', 'pending')
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id;`,
        [userId]
      );
      vpRes = newVp;
    }
    const vendorId = vpRes.rows[0].id;

    const { rows } = await db.query(
      'SELECT * FROM portfolios WHERE vendor_id = $1 ORDER BY created_at DESC;',
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get My Portfolio Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/portfolios
// Protected: Adds a new work to the vendor's gallery
exports.createPortfolioItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, media_url, media_type = 'image' } = req.body;

    if (!title || !media_url) {
      return res.status(400).json({ success: false, message: 'Title and media URL are required.' });
    }

    let vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    let vendorId;

    if (vpRes.rows.length === 0) {
      const newVp = await db.query(
        `INSERT INTO vendor_profiles (user_id, business_name, verification_status)
         VALUES ($1, 'Creative Studio', 'pending')
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id;`,
        [userId]
      );
      vendorId = newVp.rows[0].id;
    } else {
      vendorId = vpRes.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO portfolios (vendor_id, title, description, media_url, media_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [
      vendorId,
      title,
      description || null,
      media_url,
      media_type,
    ]);

    return res.status(201).json({
      success: true,
      message: 'Work uploaded to gallery successfully!',
      data: rows[0],
    });
  } catch (error) {
    console.error('Create Portfolio Item Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/v1/portfolios/:id
// Protected: Deletes a gallery work owned by the vendor
exports.deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const checkQuery = `
      SELECT p.id 
      FROM portfolios p
      JOIN vendor_profiles vp ON p.vendor_id = vp.id
      WHERE p.id = $1 AND (vp.user_id = $2 OR $3 IN ('admin', 'super_admin'));
    `;
    const checkRes = await db.query(checkQuery, [id, userId, req.user.role]);

    if (checkRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this work.' });
    }

    await db.query('DELETE FROM portfolios WHERE id = $1', [id]);

    return res.status(200).json({
      success: true,
      message: 'Work successfully removed from gallery.',
    });
  } catch (error) {
    console.error('Delete Portfolio Item Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/portfolios/vendor/:vendorId
// Public: Returns gallery works for a specific vendor profile
exports.getPublicVendorPortfolio = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { rows } = await db.query(
      'SELECT * FROM portfolios WHERE vendor_id = $1 ORDER BY created_at DESC;',
      [vendorId]
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Public Portfolio Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
