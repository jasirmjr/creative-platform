const db = require('../config/db');

// Helper to resolve or create a bookable resource for a vendor or resource_id
async function resolveResource(resource_id, vendor_id) {
  if (resource_id) {
    const res = await db.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
    if (res.rows.length > 0) return res.rows[0];
  }

  if (vendor_id) {
    const res = await db.query('SELECT * FROM resources WHERE vendor_id = $1 LIMIT 1', [vendor_id]);
    if (res.rows.length > 0) return res.rows[0];

    // Auto-create a primary service resource for the vendor
    const catRes = await db.query('SELECT id FROM categories LIMIT 1');
    const catId = catRes.rows[0]?.id;
    const vpRes = await db.query('SELECT * FROM vendor_profiles WHERE id = $1', [vendor_id]);
    const vp = vpRes.rows[0];

    const newR = await db.query(
      `INSERT INTO resources (vendor_id, category_id, title, description, resource_type, base_price, pricing_unit, status)
       VALUES ($1, $2, $3, $4, 'service', $5, $6, 'available')
       RETURNING *;`,
      [
        vendor_id,
        catId,
        vp?.business_name || 'Production Service',
        vp?.bio || 'Professional creative service',
        vp?.pricing || 15000,
        vp?.pricing_unit || 'day',
      ]
    );
    return newR.rows[0];
  }
  return null;
}

// POST /api/v1/bookings
// Protected: Customer submits Section 11 Project Requirement Form
exports.createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      resource_id,
      vendor_id,
      project_name,
      project_description,
      start_date,
      end_date,
      location,
      duration,
      estimated_budget,
      additional_requirements,
    } = req.body;

    if ((!resource_id && !vendor_id) || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Professional / Resource, start date, and end date are required.',
      });
    }

    // 1. Fetch or resolve resource rate
    const resource = await resolveResource(resource_id, vendor_id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Creative professional / gear listing not found.' });
    }

    // 2. Price calculation
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const calculatedAmount = Number(resource.base_price) * diffDays;
    const finalAmount = estimated_budget ? Number(estimated_budget) : calculatedAmount;

    // 3. Insert Managed Booking (initial status: under_review per blueprint)
    const targetVendorId = vendor_id || resource?.vendor_id || null;
    const insertQuery = `
      INSERT INTO bookings (
        customer_id,
        resource_id,
        vendor_id,
        project_name,
        project_description,
        location,
        duration,
        estimated_budget,
        additional_requirements,
        start_date,
        end_date,
        total_amount,
        advance_amount,
        paid_amount,
        payment_status,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'pending', 'under_review')
      RETURNING *;
    `;
    const bookingRes = await db.query(insertQuery, [
      customerId,
      resource.id,
      targetVendorId,
      project_name || `${resource.title} Project`,
      project_description || null,
      location || null,
      duration || `${diffDays} Day(s)`,
      estimated_budget ? Number(estimated_budget) : null,
      additional_requirements || null,
      start,
      end,
      finalAmount,
      Math.round(finalAmount * 0.3), // default 30% advance recommended
    ]);

    return res.status(201).json({
      success: true,
      message: 'Project requirement submitted successfully! Our curation team is reviewing provider availability.',
      data: bookingRes.rows[0],
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/my
// Protected: Returns all project requirements & bookings for logged-in Customer
exports.getMyBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    const query = `
      SELECT 
        b.id,
        b.project_name,
        b.project_description,
        b.location AS project_location,
        b.duration,
        b.estimated_budget,
        b.additional_requirements,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.advance_amount,
        b.paid_amount,
        b.payment_status,
        b.status,
        b.created_at,
        r.title AS resource_title,
        r.resource_type,
        c.name AS category_name,
        vp.id AS vendor_id,
        vp.business_name,
        vp.location AS vendor_location,
        u.name AS provider_name,
        u.mobile AS provider_mobile
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN vendor_profiles vp ON r.vendor_id = vp.id
      LEFT JOIN users u ON vp.user_id = u.id
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
        b.project_name,
        b.project_description,
        b.location AS project_location,
        b.duration,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.payment_status,
        b.status,
        b.created_at,
        COALESCE(r.title, b.project_name, vp.business_name, 'Creative Service') AS resource_title,
        COALESCE(r.resource_type, 'service') AS resource_type,
        COALESCE(c.name, 'Creative Talent') AS category_name,
        u.name AS customer_name,
        u.mobile AS customer_mobile,
        u.email AS customer_email
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      LEFT JOIN vendor_profiles vp ON (b.vendor_id = vp.id OR r.vendor_id = vp.id)
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN users u ON b.customer_id = u.id
      WHERE (b.vendor_id = $1 OR r.vendor_id = $1 OR vp.id = $1)
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await db.query(query, [vendorId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get Vendor Bookings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/all
// Protected: Admin / Super Admin pipeline overview
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.project_name,
        b.project_description,
        b.location AS project_location,
        b.duration,
        b.estimated_budget,
        b.additional_requirements,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.advance_amount,
        b.paid_amount,
        b.payment_status,
        b.status,
        b.created_at,
        r.title AS resource_title,
        r.resource_type,
        c.name AS category_name,
        vp.business_name,
        vp.availability_status AS provider_availability,
        prov_u.name AS provider_name,
        prov_u.mobile AS provider_mobile,
        cust_u.name AS customer_name,
        cust_u.mobile AS customer_mobile,
        cust_u.email AS customer_email
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN vendor_profiles vp ON r.vendor_id = vp.id
      LEFT JOIN users prov_u ON vp.user_id = prov_u.id
      JOIN users cust_u ON b.customer_id = cust_u.id
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await db.query(query);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Admin Fetch Bookings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/admin-pipeline
// Protected: Admin updates booking status through Managed Marketplace Workflow
exports.adminUpdateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, total_amount, advance_amount } = req.body;

    const allowedStatuses = [
      'new_request',
      'under_review',
      'availability_check',
      'approved',
      'payment_pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid blueprint booking status' });
    }

    let updateQuery = 'UPDATE bookings SET ';
    const params = [];

    if (status) {
      params.push(status);
      updateQuery += `status = $${params.length}`;
    }

    if (total_amount !== undefined) {
      params.push(Number(total_amount));
      updateQuery += `${params.length > 1 ? ', ' : ''}total_amount = $${params.length}`;
    }

    if (advance_amount !== undefined) {
      params.push(Number(advance_amount));
      updateQuery += `${params.length > 1 ? ', ' : ''}advance_amount = $${params.length}`;
    }

    params.push(id);
    updateQuery += ` WHERE id = $${params.length} RETURNING *;`;

    const { rows } = await db.query(updateQuery, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Booking updated to ${status || 'updated terms'}.`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Admin Update Booking Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/bookings/:id/pay
// Protected: Customer or Admin simulates/processes Razorpay payment
exports.processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_type = 'full' } = req.body;
    const customerId = req.user.id;

    // Fetch booking
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking record not found' });
    }
    const booking = bookingRes.rows[0];

    const payAmount = Number(amount) || Number(booking.total_amount);
    const mockRazorpayId = `rzp_pay_${Math.random().toString(36).substring(2, 10)}`;
    const mockOrderId = `order_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Record payment transaction
    await db.query(
      `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'paid')`,
      [id, mockOrderId, mockRazorpayId, payAmount, payment_type]
    );

    // 2. Update booking to confirmed / paid
    const newPaidAmount = Number(booking.paid_amount || 0) + payAmount;
    const newPaymentStatus = newPaidAmount >= Number(booking.total_amount) ? 'paid' : 'partially_paid';

    const updateRes = await db.query(
      `UPDATE bookings 
       SET status = 'confirmed', payment_status = $1, paid_amount = $2 
       WHERE id = $3 
       RETURNING *;`,
      [newPaymentStatus, newPaidAmount, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully! Project is officially confirmed.',
      data: updateRes.rows[0],
      transaction: {
        payment_id: mockRazorpayId,
        order_id: mockOrderId,
        amount: payAmount,
        status: 'paid',
      },
    });
  } catch (error) {
    console.error('Process Payment Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/status
// Protected: Vendor updates status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const allowedStatuses = ['under_review', 'approved', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const checkQuery = `
      SELECT b.id 
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      LEFT JOIN vendor_profiles vp ON (b.vendor_id = vp.id OR r.vendor_id = vp.id)
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

// POST /api/v1/bookings/checkout-cart
// Protected: Batch submit all items from the customer's cart
exports.checkoutCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    const createdBookings = [];

    for (const item of items) {
      const {
        resource_id,
        vendor_id,
        project_name,
        project_description,
        start_date,
        end_date,
        location,
        duration,
        estimated_budget,
        additional_requirements,
      } = item;

      const resource = await resolveResource(resource_id, vendor_id);
      if (!resource) continue;

      const start = new Date(start_date || Date.now() + 86400000);
      const end = new Date(end_date || Date.now() + 86400000 * 2);
      const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      const basePrice = Number(resource.base_price || 15000);
      const finalAmount = estimated_budget ? Number(estimated_budget) : basePrice * diffDays;

      const targetVendorId = vendor_id || resource?.vendor_id || null;
      const insertQuery = `
        INSERT INTO bookings (
          customer_id,
          resource_id,
          vendor_id,
          project_name,
          project_description,
          location,
          duration,
          estimated_budget,
          additional_requirements,
          start_date,
          end_date,
          total_amount,
          advance_amount,
          paid_amount,
          payment_status,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'pending', 'under_review')
        RETURNING *;
      `;
      const resRow = await db.query(insertQuery, [
        customerId,
        resource.id,
        targetVendorId,
        project_name || `${item.business_name || resource.title || 'Creative Production'} Project`,
        project_description || null,
        location || null,
        duration || `${diffDays} Day(s)`,
        finalAmount,
        additional_requirements || null,
        start,
        end,
        finalAmount,
        Math.round(finalAmount * 0.3),
      ]);
      createdBookings.push(resRow.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: `${createdBookings.length} booking hold request(s) submitted for admin review!`,
      data: createdBookings,
    });
  } catch (error) {
    console.error('Cart Checkout Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};