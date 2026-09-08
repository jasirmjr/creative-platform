const db = require('../config/db');

// Helper to get vendor_id from logged-in user id
async function getVendorIdForUser(userId) {
  const vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
  if (vpRes.rows.length === 0) {
    // Auto-create vendor profile if user is vendor but row missing
    const newVp = await db.query(
      `INSERT INTO vendor_profiles (user_id, business_name, verification_status)
       VALUES ($1, 'Creative Studio', 'verified')
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING id;`,
      [userId]
    );
    return newVp.rows[0].id;
  }
  return vpRes.rows[0].id;
}

// GET /api/v1/schedule/vendor/:vendorId
// Public: Returns upcoming booked ranges and blackout dates for any vendor
exports.getVendorAvailability = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // 1. Get confirmed/active bookings
    const bookingsRes = await db.query(
      `SELECT id, project_name, start_date, end_date, 'booking' as type
       FROM bookings
       WHERE vendor_id = $1
         AND status IN ('confirmed', 'in_progress', 'under_review')
         AND end_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY start_date ASC;`,
      [vendorId]
    );

    // 2. Get custom vendor blackout dates
    const blackoutsRes = await db.query(
      `SELECT id, reason, start_date, end_date, 'blackout' as type
       FROM vendor_blackout_dates
       WHERE vendor_id = $1
         AND end_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY start_date ASC;`,
      [vendorId]
    );

    const bookedRanges = bookingsRes.rows.map((b) => ({
      id: b.id,
      title: 'Platform Shoot',
      project_name: b.project_name,
      start_date: b.start_date,
      end_date: b.end_date,
      type: 'booking',
      reason: 'Booked on Platform',
    }));

    const blackoutRanges = blackoutsRes.rows.map((b) => ({
      id: b.id,
      title: b.reason || 'Unavailable / Off-Duty',
      start_date: b.start_date,
      end_date: b.end_date,
      type: 'blackout',
      reason: b.reason || 'Marked as Unavailable by Vendor',
    }));

    const allBlockedRanges = [...bookedRanges, ...blackoutRanges];

    return res.status(200).json({
      success: true,
      vendor_id: vendorId,
      booked_ranges: bookedRanges,
      blackout_ranges: blackoutRanges,
      all_blocked_ranges: allBlockedRanges,
    });
  } catch (error) {
    console.error('Get Vendor Availability Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/schedule/my
// Protected: Returns full schedule (bookings + blackouts) for the logged-in vendor
exports.getMySchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const vendorId = await getVendorIdForUser(userId);

    // 1. All bookings for this vendor
    const bookingsRes = await db.query(
      `SELECT b.id, b.project_name, b.start_date, b.end_date, b.status, b.total_amount,
              b.crew_bundle_id, b.crew_bundle_name, b.crew_role,
              u.name as customer_name, u.mobile as customer_mobile
       FROM bookings b
       LEFT JOIN users u ON b.customer_id = u.id
       WHERE b.vendor_id = $1
       ORDER BY b.start_date ASC;`,
      [vendorId]
    );

    // 2. All blackout dates
    const blackoutsRes = await db.query(
      `SELECT id, start_date, end_date, reason, created_at
       FROM vendor_blackout_dates
       WHERE vendor_id = $1
       ORDER BY start_date ASC;`,
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      vendor_id: vendorId,
      bookings: bookingsRes.rows,
      blackouts: blackoutsRes.rows,
    });
  } catch (error) {
    console.error('Get My Schedule Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/schedule/block
// Protected: Vendor marks date range as unavailable/booked
exports.blockDates = async (req, res) => {
  try {
    const userId = req.user.id;
    const vendorId = await getVendorIdForUser(userId);
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required.',
      });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start or end date format.',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date.',
      });
    }

    const insertQuery = `
      INSERT INTO vendor_blackout_dates (vendor_id, start_date, end_date, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [
      vendorId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
      reason || 'Unavailable / Off-Duty',
    ]);

    return res.status(201).json({
      success: true,
      message: 'Dates successfully marked as unavailable!',
      data: rows[0],
    });
  } catch (error) {
    console.error('Block Dates Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/v1/schedule/block/:id
// Protected: Vendor deletes/unblocks an unavailable date block
exports.unblockDates = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const vendorId = await getVendorIdForUser(userId);

    const checkRes = await db.query(
      'SELECT id FROM vendor_blackout_dates WHERE id = $1 AND vendor_id = $2;',
      [id, vendorId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blackout block not found or you do not have permission to delete it.',
      });
    }

    await db.query('DELETE FROM vendor_blackout_dates WHERE id = $1;', [id]);

    return res.status(200).json({
      success: true,
      message: 'Dates successfully unblocked and available for bookings!',
    });
  } catch (error) {
    console.error('Unblock Dates Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
