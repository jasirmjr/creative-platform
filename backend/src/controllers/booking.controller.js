const db = require('../config/db');

// POST /api/v1/bookings
// Protected: Requires customer auth token
exports.createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { resource_id, start_date, end_date, notes } = req.body;

    if (!resource_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Resource, start date, and end date are required.' });
    }

    // 1. Fetch resource rate
    const resourceRes = await db.query('SELECT * FROM resources WHERE id = $1 AND status = $2', [resource_id, 'available']);
    if (resourceRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Resource not available for booking.' });
    }
    const resource = resourceRes.rows[0];

    // 2. Simple price calculation (days * base_price)
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const totalAmount = Number(resource.base_price) * diffDays;

    // 3. Set a 15-minute checkout reservation hold
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

    // 4. Insert booking
    const insertQuery = `
      INSERT INTO bookings (customer_id, resource_id, start_date, end_date, total_amount, status, locked_until)
      VALUES ($1, $2, $3, $4, $5, 'under_review', $6)
      RETURNING *;
    `;
    const bookingRes = await db.query(insertQuery, [
      customerId,
      resource_id,
      start,
      end,
      totalAmount,
      lockedUntil
    ]);

    return res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully',
      data: bookingRes.rows[0]
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/my
// Protected: Returns all bookings for the logged-in user
exports.getMyBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    const query = `
      SELECT 
        b.id,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.status,
        b.created_at,
        r.title AS resource_title,
        r.resource_type,
        c.name AS category_name,
        vp.business_name
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN categories c ON r.category_id = c.id
      JOIN vendor_profiles vp ON r.vendor_id = vp.id
      WHERE b.customer_id = $1
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await db.query(query, [customerId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get My Bookings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/vendor
// Protected: Returns all bookings made for the logged-in vendor's resources
exports.getVendorBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find vendor profile
    const vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
    const vendorId = vpRes.rows[0].id;

    const query = `
      SELECT 
        b.id,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.status,
        b.created_at,
        r.title AS resource_title,
        r.resource_type,
        c.name AS category_name,
        u.name AS customer_name,
        u.mobile AS customer_mobile,
        u.email AS customer_email
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN categories c ON r.category_id = c.id
      JOIN users u ON b.customer_id = u.id
      WHERE r.vendor_id = $1
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await db.query(query, [vendorId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Vendor Bookings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/status
// Protected: Vendor or Admin can accept (approved/confirmed) or decline (cancelled)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const allowedStatuses = ['under_review', 'approved', 'confirmed', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    // Verify booking belongs to this vendor or an admin
    const checkQuery = `
      SELECT b.id 
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN vendor_profiles vp ON r.vendor_id = vp.id
      WHERE b.id = $1 AND (vp.user_id = $2 OR $3 IN ('admin', 'super_admin'));
    `;
    const checkRes = await db.query(checkQuery, [id, userId, req.user.role]);
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this booking.' });
    }

    const { rows } = await db.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *;',
      [status, id]
    );

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}.`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Update Booking Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};