const db = require('../config/db');

// GET /api/v1/vendors/list
// Public: Returns list of verified / all vendors with skills, availability, and owner info
exports.getRegisteredVendors = async (req, res) => {
  try {
    const { status, category_id, search } = req.query;
    let queryText = `
      SELECT 
        vp.id,
        vp.user_id,
        vp.business_name,
        vp.bio,
        vp.location,
        vp.experience,
        vp.skills,
        vp.availability_status,
        vp.pricing,
        vp.pricing_unit,
        vp.profile_image,
        vp.verification_status,
        vp.verified_by,
        vp.created_at,
        u.name AS owner_name,
        u.mobile,
        u.email,
        COALESCE(ROUND(AVG(r.rating), 1), 5.0) AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM vendor_profiles vp
      LEFT JOIN users u ON vp.user_id = u.id
      LEFT JOIN reviews r ON r.vendor_id = vp.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      const normalizedStatus = status === 'approved' ? 'verified' : status;
      params.push(normalizedStatus);
      queryText += ` AND vp.verification_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (vp.business_name ILIKE $${params.length} OR u.name ILIKE $${params.length} OR vp.skills ILIKE $${params.length} OR vp.location ILIKE $${params.length})`;
    }

    queryText += ' GROUP BY vp.id, u.id ORDER BY vp.created_at DESC;';

    const { rows } = await db.query(queryText, params);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Vendors Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/vendors/register
// Protected: User registers / submits vendor application
exports.registerVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_name, location, bio, experience, skills, pricing, pricing_unit } = req.body;

    if (!business_name || !location) {
      return res.status(400).json({ success: false, message: 'Business name and location are required' });
    }

    const query = `
      INSERT INTO vendor_profiles (
        user_id, business_name, location, bio, experience, skills, pricing, pricing_unit, verification_status, availability_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'available')
      ON CONFLICT (user_id) DO UPDATE 
      SET business_name = EXCLUDED.business_name,
          location = EXCLUDED.location,
          bio = EXCLUDED.bio,
          experience = COALESCE(EXCLUDED.experience, vendor_profiles.experience),
          skills = COALESCE(EXCLUDED.skills, vendor_profiles.skills),
          pricing = COALESCE(EXCLUDED.pricing, vendor_profiles.pricing),
          pricing_unit = COALESCE(EXCLUDED.pricing_unit, vendor_profiles.pricing_unit),
          verification_status = 'pending'
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      userId,
      business_name,
      location,
      bio || null,
      experience || '2+ years',
      skills || 'Commercial Production',
      pricing ? Number(pricing) : null,
      pricing_unit || 'day',
    ]);

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

// PATCH /api/v1/vendors/availability
// Protected: Service provider updates availability status per Section 12
exports.updateAvailability = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability_status } = req.body;

    const allowed = ['available', 'pending_booking', 'booked', 'unavailable'];
    if (!allowed.includes(availability_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid availability status. Must be one of: ${allowed.join(', ')}`,
      });
    }

    const { rows } = await db.query(
      `UPDATE vendor_profiles 
       SET availability_status = $1 
       WHERE user_id = $2 
       RETURNING *;`,
      [availability_status, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Availability updated to ${availability_status.replace('_', ' ')}.`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Update Availability Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/v1/vendors/profile
// Protected: Provider updates their skills, experience, pricing, bio
exports.updateProviderProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_name, bio, location, experience, skills, pricing, pricing_unit } = req.body;

    const updateQuery = `
      UPDATE vendor_profiles
      SET 
        business_name = COALESCE($1, business_name),
        bio = COALESCE($2, bio),
        location = COALESCE($3, location),
        experience = COALESCE($4, experience),
        skills = COALESCE($5, skills),
        pricing = COALESCE($6, pricing),
        pricing_unit = COALESCE($7, pricing_unit)
      WHERE user_id = $8
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [
      business_name,
      bio,
      location,
      experience,
      skills,
      pricing ? Number(pricing) : null,
      pricing_unit,
      userId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Studio profile updated successfully!',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update Provider Profile Error:', error);
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
        message: 'Invalid status value. Must be verified, rejected, or pending.',
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