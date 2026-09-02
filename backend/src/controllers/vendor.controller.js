const db = require('../config/db');

// GET /api/v1/vendors/list
// Public: Returns list of vendors with optional ?status= filter
exports.getRegisteredVendors = async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT 
        vp.id,
        vp.user_id,
        vp.business_name,
        vp.bio,
        vp.location,
        vp.verification_status,
        vp.verified_by,
        vp.created_at,
        u.name AS owner_name,
        u.mobile,
        u.email
      FROM vendor_profiles vp
      LEFT JOIN users u ON vp.user_id = u.id
    `;
    const params = [];
    if (status) {
      params.push(status);
      queryText += ` WHERE vp.verification_status = $${params.length}`;
    }
    queryText += ' ORDER BY vp.created_at DESC;';

    const { rows } = await db.query(queryText, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Vendors Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/vendors/register
// Protected: User must have valid JWT
exports.registerVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_name, location, bio } = req.body;

    if (!business_name || !location) {
      return res.status(400).json({ success: false, message: 'Business name and location are required' });
    }

    const query = `
      INSERT INTO vendor_profiles (user_id, business_name, location, bio, verification_status)
      VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (user_id) DO UPDATE 
      SET business_name = EXCLUDED.business_name,
          location = EXCLUDED.location,
          bio = EXCLUDED.bio,
          verification_status = 'pending'
      RETURNING *;
    `;
    const { rows } = await db.query(query, [userId, business_name, location, bio || null]);

    // Update user role to vendor if currently customer
    await db.query(`UPDATE users SET role = 'vendor' WHERE id = $1 AND role = 'customer'`, [userId]);

    return res.status(200).json({
      success: true,
      message: 'Vendor application submitted successfully and is pending review.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Register Vendor Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/vendors/profile
// Protected: Returns vendor profile for current user
exports.getVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        vp.*,
        u.name AS owner_name,
        u.mobile,
        u.email
      FROM vendor_profiles vp
      JOIN users u ON vp.user_id = u.id
      WHERE vp.user_id = $1;
    `;
    const { rows } = await db.query(query, [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get Vendor Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/v1/vendors/:id/status
// Protected: Admin / Super Admin only
exports.updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params; // vendor_profiles.id
    const { status } = req.body; // 'verified', 'rejected', or 'pending'
    const adminId = req.user.id;

    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value. Must be verified, rejected, or pending.'
      });
    }

    const query = `
      UPDATE vendor_profiles
      SET verification_status = $1, verified_by = $2
      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await db.query(query, [status, adminId, id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Vendor status successfully updated to ${status}.`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Update Vendor Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};