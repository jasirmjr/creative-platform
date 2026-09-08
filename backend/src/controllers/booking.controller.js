const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure deliverables uploads directory exists
const deliverablesUploadsDir = path.join(__dirname, '../../uploads/deliverables');
if (!fs.existsSync(deliverablesUploadsDir)) {
  fs.mkdirSync(deliverablesUploadsDir, { recursive: true });
}

// Multer storage for project deliverables (photos, videos, preview reels, ZIP archives, lookbooks)
const deliverableStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, deliverablesUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'deliverable-' + uniqueSuffix + ext);
  },
});

const uploadDeliverable = multer({
  storage: deliverableStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file attachment
});

exports.deliverableUploadMiddleware = uploadDeliverable.single('file');

// Helper to get socket.io instance
function getSocketIO() {
  try {
    const { getIO } = require('../socket/chat.socket');
    return getIO();
  } catch (err) {
    return null;
  }
}

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

// Helper to check date availability against confirmed bookings and vendor blackout dates
async function validateVendorDateAvailability(vendorId, startDate, endDate) {
  if (!vendorId || !startDate || !endDate) return { available: true };

  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];

  // 1. Check for overlapping confirmed / active bookings
  const bookingOverlap = await db.query(
    `SELECT id, project_name, start_date, end_date
     FROM bookings
     WHERE vendor_id = $1
       AND status IN ('confirmed', 'in_progress', 'under_review')
       AND NOT (end_date <= $2 OR start_date >= $3)
     LIMIT 1;`,
    [vendorId, start, end]
  );

  if (bookingOverlap.rows.length > 0) {
    const b = bookingOverlap.rows[0];
    return {
      available: false,
      reason: `Vendor is already booked for "${b.project_name}" from ${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}.`,
      conflict_type: 'booking',
    };
  }

  // 2. Check for overlapping vendor blackout dates
  const blackoutOverlap = await db.query(
    `SELECT id, reason, start_date, end_date
     FROM vendor_blackout_dates
     WHERE vendor_id = $1
       AND NOT (end_date <= $2 OR start_date >= $3)
     LIMIT 1;`,
    [vendorId, start, end]
  );

  if (blackoutOverlap.rows.length > 0) {
    const bl = blackoutOverlap.rows[0];
    return {
      available: false,
      reason: `Vendor has marked these dates as unavailable (${bl.reason || 'Off-Duty'}) from ${new Date(bl.start_date).toLocaleDateString()} to ${new Date(bl.end_date).toLocaleDateString()}.`,
      conflict_type: 'blackout',
    };
  }

  return { available: true };
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

    // 2. Check vendor date availability (Prevent double bookings & respect blackout dates)
    const targetVendorId = vendor_id || resource?.vendor_id || null;
    if (targetVendorId) {
      // Guard: Only paid or waived vendors can receive bookings
      const vpCheck = await db.query('SELECT deposit_status, business_name FROM vendor_profiles WHERE id = $1', [targetVendorId]);
      if (vpCheck.rows.length > 0) {
        const vp = vpCheck.rows[0];
        if (vp.deposit_status !== 'paid' && vp.deposit_status !== 'waived') {
          return res.status(400).json({
            success: false,
            message: `This creative partner (${vp.business_name || 'Studio'}) has not completed their listing registration deposit and cannot accept client bookings.`,
          });
        }
      }

      const availCheck = await validateVendorDateAvailability(targetVendorId, start_date, end_date);
      if (!availCheck.available) {
        return res.status(400).json({
          success: false,
          message: availCheck.reason,
          conflict_type: availCheck.conflict_type,
        });
      }
    }

    // 3. Price calculation
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const calculatedAmount = Number(resource.base_price) * diffDays;
    const finalAmount = estimated_budget ? Number(estimated_budget) : calculatedAmount;

    // 4. Insert Managed Booking (initial status: confirmed)
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'pending', 'confirmed')
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
        b.last_balance_reminder_at,
        b.crew_bundle_id,
        b.crew_bundle_name,
        b.crew_role,
        b.rejection_reason,
        b.rejected_at,
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
        b.customer_id,
        b.vendor_id,
        b.project_name,
        b.project_description,
        b.location AS project_location,
        b.duration,
        b.start_date,
        b.end_date,
        b.total_amount,
        b.advance_amount,
        b.paid_amount,
        b.payment_status,
        b.status,
        b.last_balance_reminder_at,
        b.crew_bundle_id,
        b.crew_bundle_name,
        b.crew_role,
        b.rejection_reason,
        b.rejected_at,
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
        b.last_balance_reminder_at,
        b.crew_bundle_id,
        b.crew_bundle_name,
        b.crew_role,
        b.rejection_reason,
        b.rejected_at,
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
      'rejected',
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

// POST /api/v1/bookings/:id/create-razorpay-order
// Protected: Generates Razorpay Order for Advance Deposit, Balance, or Full Payment
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_type = 'advance' } = req.body;
    const userId = req.user.id;

    // Fetch booking
    const bookingRes = await db.query(
      `SELECT b.*, u.name AS customer_name, u.email AS customer_email, u.mobile AS customer_mobile
       FROM bookings b
       JOIN users u ON b.customer_id = u.id
       WHERE b.id = $1`,
      [id]
    );
    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const booking = bookingRes.rows[0];

    // Authorization check
    if (booking.customer_id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to make payments on this booking.' });
    }

    // Enforce 6-stage lifecycle: advance payment can only be made in Stage 3 (Terms Approved)
    if (payment_type === 'advance') {
      if (booking.status === 'rejected' || booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'This booking was declined by the creative partner. Please re-arrange the booking or find a replacement partner before making an advance deposit.',
        });
      }
      if (booking.status !== 'approved' && booking.status !== 'payment_pending') {
        return res.status(400).json({
          success: false,
          message: 'This booking is currently in Stage 2 (Under Review). The creative partner must review and accept the booking request before an advance deposit can be paid.',
        });
      }
    }

    if (payment_type === 'balance') {
      if (booking.status !== 'confirmed' && booking.status !== 'completed' && booking.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Balance settlement is only available once the shoot is confirmed or completed.',
        });
      }
    }

    const total = Number(booking.total_amount) || 0;
    const currentPaid = Number(booking.paid_amount) || 0;
    const advanceAmount = Number(booking.advance_amount) || Math.round(total * 0.3);
    const balanceRemaining = Math.max(0, total - currentPaid);

    let payAmount = 0;
    if (payment_type === 'advance') {
      if (currentPaid >= advanceAmount) {
        return res.status(400).json({ success: false, message: 'Advance deposit has already been paid for this project.' });
      }
      payAmount = advanceAmount;
    } else if (payment_type === 'balance') {
      if (balanceRemaining <= 0) {
        return res.status(400).json({ success: false, message: 'This project has already been settled in full.' });
      }
      payAmount = balanceRemaining;
    } else {
      // 'full'
      payAmount = balanceRemaining;
    }

    if (payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isLiveKeys = keyId && !keyId.includes('xxxxxx') && keySecret && !keySecret.includes('xxxxxx');

    let orderId = '';
    let isMock = false;

    if (isLiveKeys) {
      try {
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(payAmount * 100), // paise
          currency: 'INR',
          receipt: `bk_${booking.id.substring(0, 8)}`,
          notes: {
            booking_id: booking.id,
            payment_type,
            customer_id: booking.customer_id,
          },
        });
        orderId = rzpOrder.id;
      } catch (rzpErr) {
        console.warn('Razorpay Live API Error, falling back to simulator:', rzpErr.message);
        isMock = true;
        orderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    } else {
      isMock = true;
      orderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // Insert or update pending payment record
    await db.query(
      `INSERT INTO payments (booking_id, razorpay_order_id, amount, payment_type, payment_status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (razorpay_order_id, booking_id) DO UPDATE 
       SET amount = EXCLUDED.amount, payment_type = EXCLUDED.payment_type;`,
      [booking.id, orderId, payAmount, payment_type]
    );

    return res.status(200).json({
      success: true,
      order_id: orderId,
      key_id: isLiveKeys ? keyId : 'rzp_test_simulated',
      amount: payAmount,
      amount_paise: Math.round(payAmount * 100),
      currency: 'INR',
      payment_type,
      is_mock: isMock,
      booking: {
        id: booking.id,
        project_name: booking.project_name,
        total_amount: total,
        advance_amount: advanceAmount,
        paid_amount: currentPaid,
        balance_due: balanceRemaining,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_mobile: booking.customer_mobile,
      },
    });
  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// POST /api/v1/bookings/:id/verify-razorpay-payment
// Protected: Validates signature (or simulated payment), records transaction, and confirms booking
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_type = 'advance',
      is_mock = false,
      amount,
    } = req.body;

    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const booking = bookingRes.rows[0];

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    // Verify signature if not mock
    if (!is_mock && keySecret && !keySecret.includes('xxxxxx') && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature verification failed.' });
      }
    }

    const paymentId = razorpay_payment_id || `rzp_sim_${Date.now()}`;
    const orderId = razorpay_order_id || `order_sim_${Date.now()}`;

    // Get amount from payment record or body
    let payRecordRes = await db.query('SELECT * FROM payments WHERE razorpay_order_id = $1', [orderId]);
    let payId;
    if (payRecordRes.rows.length > 0) {
      verifiedAmount = Number(payRecordRes.rows[0].amount);
      const upd = await db.query(
        `UPDATE payments 
         SET razorpay_payment_id = $1, razorpay_signature = $2, payment_status = 'paid'
         WHERE razorpay_order_id = $3
         RETURNING id;`,
        [paymentId, razorpay_signature || 'simulated_sig', orderId]
      );
      payId = upd.rows[0]?.id;
    } else {
      const ins = await db.query(
        `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'paid')
         RETURNING id;`,
        [id, orderId, paymentId, razorpay_signature || 'simulated_sig', verifiedAmount, payment_type]
      );
      payId = ins.rows[0]?.id;
    }

    // Calculate new paid amount and status
    const currentPaid = Number(booking.paid_amount || 0);
    const newPaidAmount = currentPaid + verifiedAmount;
    const total = Number(booking.total_amount || 0);

    let newPaymentStatus = 'advance_paid';
    if (newPaidAmount >= total) {
      newPaymentStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'advance_paid';
    }

    // Update booking: status moves to 'confirmed'
    const updateRes = await db.query(
      `UPDATE bookings 
       SET status = 'confirmed', payment_status = $1, paid_amount = $2
       WHERE id = $3
       RETURNING *;`,
      [newPaymentStatus, newPaidAmount, id]
    );

    const updatedBooking = updateRes.rows[0];

    return res.status(200).json({
      success: true,
      message: newPaymentStatus === 'paid'
        ? 'Full payment verified! Project is fully paid and confirmed.'
        : `Advance deposit of ₹${verifiedAmount.toLocaleString()} received! Booking dates are confirmed and locked.`,
      data: updatedBooking,
      transaction: {
        receipt_id: payId,
        payment_id: paymentId,
        order_id: orderId,
        amount: verifiedAmount,
        payment_type,
        status: 'paid',
        payment_status: newPaymentStatus,
        balance_due: Math.max(0, total - newPaidAmount),
      },
    });
  } catch (error) {
    console.error('Verify Razorpay Payment Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// POST /api/v1/bookings/:id/pay
// Protected: Direct or Simulated payment processing (legacy/fallback support)
exports.processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_type = 'advance' } = req.body;

    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking record not found' });
    }
    const booking = bookingRes.rows[0];

    const total = Number(booking.total_amount) || 0;
    const currentPaid = Number(booking.paid_amount || 0);
    const advanceAmount = Number(booking.advance_amount) || Math.round(total * 0.3);

    let payAmount = Number(amount);
    if (!payAmount) {
      payAmount = payment_type === 'advance' ? advanceAmount : Math.max(0, total - currentPaid);
    }

    const mockRazorpayId = `rzp_pay_${Math.random().toString(36).substring(2, 10)}`;
    const mockOrderId = `order_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Record payment transaction
    const ins = await db.query(
      `INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'paid')
       RETURNING id`,
      [id, mockOrderId, mockRazorpayId, payAmount, payment_type]
    );
    const payId = ins.rows[0]?.id;

    // 2. Update booking to confirmed / paid
    const newPaidAmount = currentPaid + payAmount;
    let newPaymentStatus = 'advance_paid';
    if (newPaidAmount >= total) {
      newPaymentStatus = 'paid';
    }

    const updateRes = await db.query(
      `UPDATE bookings 
       SET status = 'confirmed', payment_status = $1, paid_amount = $2 
       WHERE id = $3 
       RETURNING *;`,
      [newPaymentStatus, newPaidAmount, id]
    );

    return res.status(200).json({
      success: true,
      message: newPaymentStatus === 'paid'
        ? 'Full payment verified! Project is officially confirmed.'
        : `Advance deposit of ₹${payAmount.toLocaleString()} verified! Project dates confirmed.`,
      data: updateRes.rows[0],
      transaction: {
        receipt_id: payId,
        payment_id: mockRazorpayId,
        order_id: mockOrderId,
        amount: payAmount,
        payment_type,
        status: 'paid',
        payment_status: newPaymentStatus,
        balance_due: Math.max(0, total - newPaidAmount),
      },
    });
  } catch (error) {
    console.error('Process Payment Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/v1/bookings/:id/status
// Protected: Vendor updates status (accept or decline with reason)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const userId = req.user.id;

    const allowedStatuses = [
      'under_review',
      'availability_check',
      'approved',
      'confirmed',
      'in_progress',
      'deliverables_submitted',
      'completed',
      'cancelled',
      'rejected',
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const checkQuery = `
      SELECT b.id, b.customer_id, b.status 
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      LEFT JOIN vendor_profiles vp ON (b.vendor_id = vp.id OR r.vendor_id = vp.id)
      WHERE b.id = $1 AND (vp.user_id = $2 OR b.customer_id = $2 OR $3 IN ('admin', 'super_admin'));
    `;
    const checkRes = await db.query(checkQuery, [id, userId, req.user.role]);
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this booking.' });
    }

    let rows;
    if (status === 'rejected') {
      const q = `
        UPDATE bookings 
        SET status = $1, rejection_reason = $2, rejected_at = CURRENT_TIMESTAMP 
        WHERE id = $3 
        RETURNING *;
      `;
      const result = await db.query(q, [status, rejection_reason || 'Declined by creative partner.', id]);
      rows = result.rows;
    } else if (status === 'approved') {
      const q = `
        UPDATE bookings 
        SET status = 'approved', rejection_reason = NULL, rejected_at = NULL,
            advance_amount = COALESCE(advance_amount, ROUND(total_amount * 0.3))
        WHERE id = $1 
        RETURNING *;
      `;
      const result = await db.query(q, [id]);
      rows = result.rows;
    } else if (status === 'confirmed') {
      const q = `
        UPDATE bookings 
        SET status = $1, rejection_reason = NULL, rejected_at = NULL 
        WHERE id = $2 
        RETURNING *;
      `;
      const result = await db.query(q, [status, id]);
      rows = result.rows;
    } else {
      const result = await db.query(
        'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *;',
        [status, id]
      );
      rows = result.rows;
    }

    let msg = `Booking status updated to ${status}.`;
    if (status === 'rejected') msg = 'Booking request declined. Reason sent to client.';
    if (status === 'approved') msg = 'Booking accepted! Client has been notified to pay the advance deposit.';
    if (status === 'confirmed') msg = 'Booking officially confirmed.';
    if (status === 'deliverables_submitted') msg = 'Deliverables submitted for client review!';
    if (status === 'completed') msg = 'Project successfully marked as completed! You can now share a verified review.';

    return res.status(200).json({
      success: true,
      message: msg,
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
    const { items, master_project_name, master_location, master_notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    // Determine if this is a Multi-Talent Crew Bundle checkout
    const isCrewBundle = items.length >= 2 || Boolean(master_project_name);
    const crewBundleId = isCrewBundle
      ? `CREW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      : null;
    const crewBundleName = master_project_name || (isCrewBundle ? 'Production Crew Package' : null);

    // Pre-validate date availability for all cart items (prevent conflicting bookings)
    for (const item of items) {
      const resource = await resolveResource(item.resource_id, item.vendor_id);
      const targetVendorId = item.vendor_id || resource?.vendor_id || null;
      const start = new Date(item.start_date || Date.now() + 86400000);
      const end = new Date(item.end_date || Date.now() + 86400000 * 2);

      if (targetVendorId) {
        const availCheck = await validateVendorDateAvailability(targetVendorId, start, end);
        if (!availCheck.available) {
          return res.status(400).json({
            success: false,
            message: `Booking Conflict: ${availCheck.reason}`,
            conflict_type: availCheck.conflict_type,
          });
        }
      }
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
      if (targetVendorId) {
        const vpCheck = await db.query('SELECT deposit_status FROM vendor_profiles WHERE id = $1', [targetVendorId]);
        if (vpCheck.rows.length > 0 && vpCheck.rows[0].deposit_status !== 'paid' && vpCheck.rows[0].deposit_status !== 'waived') {
          console.warn(`[Cart Checkout Guard]: Skipping unactivated vendor ${targetVendorId} (deposit_status: ${vpCheck.rows[0].deposit_status})`);
          continue;
        }
      }

      // Determine designated crew role for this member
      const crewRole = item.crew_role || item.skills || resource.skills || item.category_name || resource.title || 'Creative Specialist';
      const effectiveProjectName = master_project_name || project_name || `${item.business_name || resource.title || 'Creative Production'} Project`;
      const effectiveLocation = master_location || location || 'India';
      const effectiveNotes = master_notes || project_description || null;

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
          status,
          crew_bundle_id,
          crew_bundle_name,
          crew_role
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'pending', 'under_review', $14, $15, $16)
        RETURNING *;
      `;
      const resRow = await db.query(insertQuery, [
        customerId,
        resource.id,
        targetVendorId,
        effectiveProjectName,
        effectiveNotes,
        effectiveLocation,
        duration || `${diffDays} Day(s)`,
        finalAmount,
        additional_requirements || null,
        start,
        end,
        finalAmount,
        Math.round(finalAmount * 0.3),
        crewBundleId,
        crewBundleName,
        crewRole,
      ]);
      createdBookings.push(resRow.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: `${createdBookings.length} booking(s) confirmed and scheduled!`,
      data: createdBookings,
    });
  } catch (error) {
    console.error('Cart Checkout Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/all (Admin / Super Admin)
exports.getAllBookings = async (req, res) => {
  try {
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
        vp.business_name AS provider_name,
        u_prov.mobile AS provider_mobile,
        u_cust.name AS client_name,
        u_cust.mobile AS client_mobile
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN categories c ON r.category_id = c.id
      JOIN vendor_profiles vp ON r.vendor_id = vp.id
      JOIN users u_prov ON vp.user_id = u_prov.id
      JOIN users u_cust ON b.customer_id = u_cust.id
      ORDER BY b.created_at DESC;
    `;
    const { rows } = await db.query(query);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Fetch All Bookings Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/bookings/:id/replacement-candidates
// Protected: Client / Customer only - finds available vetted replacements for a declined or open crew slot on same shoot dates
exports.getReplacementCandidates = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Fetch booking details
    const bookingRes = await db.query(
      `SELECT b.*, c.id as category_id, c.name as category_name
       FROM bookings b
       LEFT JOIN resources r ON b.resource_id = r.id
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE b.id = $1 AND (b.customer_id = $2 OR $3 = 'admin');`,
      [id, userId, req.user.role]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found or access denied.' });
    }

    const booking = bookingRes.rows[0];
    const currentVendorId = booking.vendor_id;
    const startDate = booking.start_date;
    const endDate = booking.end_date;
    const crewRole = (booking.crew_role || booking.category_name || '').trim();

    // Calculate duration in days
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // 2. Query available candidate vendors
    const candidatesQuery = `
      SELECT 
        vp.id as vendor_id,
        vp.business_name,
        vp.skills,
        vp.experience,
        vp.experience_level,
        vp.pricing,
        vp.pricing_unit,
        vp.location,
        vp.bio,
        vp.profile_image,
        u.name as owner_name,
        r.id as resource_id,
        COALESCE(r.title, vp.business_name) as resource_title
      FROM vendor_profiles vp
      JOIN users u ON vp.user_id = u.id
      LEFT JOIN resources r ON r.vendor_id = vp.id
      WHERE (u.is_deleted IS NOT TRUE)
        AND vp.verification_status = 'verified'
        AND vp.availability_status = 'available'
        AND vp.id != $1
        -- Must not have conflicting blackout dates
        AND NOT EXISTS (
          SELECT 1 FROM vendor_blackout_dates vbd
          WHERE vbd.vendor_id = vp.id
            AND NOT (vbd.end_date < $2::date OR vbd.start_date > $3::date)
        )
        -- Must not have conflicting confirmed shoot bookings
        AND NOT EXISTS (
          SELECT 1 FROM bookings b2
          WHERE b2.vendor_id = vp.id
            AND b2.status IN ('confirmed', 'completed')
            AND NOT (b2.end_date < $2::date OR b2.start_date > $3::date)
        )
      ORDER BY 
        CASE WHEN vp.skills ILIKE $4 THEN 0 ELSE 1 END,
        vp.pricing ASC;
    `;

    const candidatesRes = await db.query(candidatesQuery, [
      currentVendorId,
      startDate,
      endDate,
      `%${crewRole}%`,
    ]);

    // Format candidates with calculated project total and advance deposit
    const candidates = candidatesRes.rows.map((c) => {
      const dailyPrice = Number(c.pricing || 15000);
      const calculatedTotal = dailyPrice * durationDays;
      const calculatedAdvance = Math.round(calculatedTotal * 0.3);
      return {
        ...c,
        daily_rate: dailyPrice,
        duration_days: durationDays,
        calculated_total: calculatedTotal,
        calculated_advance: calculatedAdvance,
      };
    });

    return res.status(200).json({
      success: true,
      booking: {
        id: booking.id,
        project_name: booking.project_name,
        crew_bundle_id: booking.crew_bundle_id,
        crew_bundle_name: booking.crew_bundle_name,
        crew_role: booking.crew_role,
        start_date: booking.start_date,
        end_date: booking.end_date,
        duration_days: durationDays,
      },
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error('Get Replacement Candidates Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/bookings/:id/replace-vendor
// Protected: Client / Customer only - Swaps declined/open slot with a new candidate partner
exports.replaceVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_vendor_id, new_resource_id } = req.body;
    const userId = req.user.id;

    if (!new_vendor_id) {
      return res.status(400).json({ success: false, message: 'New vendor ID is required.' });
    }

    // 1. Fetch existing booking
    const bookingRes = await db.query(
      `SELECT * FROM bookings WHERE id = $1 AND (customer_id = $2 OR $3 = 'admin');`,
      [id, userId, req.user.role]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found or access denied.' });
    }
    const booking = bookingRes.rows[0];

    // 2. Fetch new vendor details
    const vendorRes = await db.query(
      `SELECT vp.*, u.name as owner_name 
       FROM vendor_profiles vp 
       JOIN users u ON vp.user_id = u.id 
       WHERE vp.id = $1 AND (u.is_deleted IS NOT TRUE);`,
      [new_vendor_id]
    );

    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected replacement vendor not found.' });
    }
    const newVendor = vendorRes.rows[0];

    // 3. Resolve resource ID
    let finalResourceId = new_resource_id;
    if (!finalResourceId) {
      const resRes = await db.query(`SELECT id FROM resources WHERE vendor_id = $1 LIMIT 1;`, [new_vendor_id]);
      if (resRes.rows.length > 0) {
        finalResourceId = resRes.rows[0].id;
      } else {
        finalResourceId = booking.resource_id;
      }
    }

    // 4. Calculate pricing
    const diffTime = Math.abs(new Date(booking.end_date) - new Date(booking.start_date));
    const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    const dailyPrice = Number(newVendor.pricing || 15000);
    const newTotal = dailyPrice * durationDays;
    const newAdvance = Math.round(newTotal * 0.3);

    // 5. Update booking atomically
    const updateRes = await db.query(
      `UPDATE bookings
       SET vendor_id = $1,
           resource_id = $2,
           total_amount = $3,
           advance_amount = $4,
           paid_amount = 0,
           payment_status = 'pending',
           status = 'under_review',
           rejection_reason = NULL,
           rejected_at = NULL
       WHERE id = $5
       RETURNING *;`,
      [new_vendor_id, finalResourceId, newTotal, newAdvance, id]
    );

    const updatedBooking = updateRes.rows[0];

    return res.status(200).json({
      success: true,
      message: `Successfully swapped ${newVendor.business_name} into your crew for "${booking.project_name || 'Production Shoot'}"!`,
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Replace Vendor Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/bookings/crew-bundle/:bundleId/pay
// Protected: Client / Customer only - Combined crew payment that credits each vendor's account individually
exports.processCrewBundlePayment = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { payment_type = 'advance' } = req.body;
    const userId = req.user.id;

    // 1. Fetch all bookings for this bundle belonging to this customer
    const bookingsRes = await db.query(
      `SELECT b.*, vp.business_name, vp.skills
       FROM bookings b
       LEFT JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.crew_bundle_id = $1 AND (b.customer_id = $2 OR $3 = 'admin')
       ORDER BY b.created_at ASC;`,
      [bundleId, userId, req.user.role]
    );

    if (bookingsRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No crew bookings found for this project bundle.' });
    }

    const crewBookings = bookingsRes.rows;

    // Enforce Stage 2 check: No payment can be made while any booking is under review
    if (payment_type === 'advance') {
      const underReview = crewBookings.filter(
        (b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request'
      );
      if (underReview.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot pay crew advance: One or more specialists are still reviewing your shoot schedule in Stage 2 (Under Review). Creative partners must review and accept the booking before advance deposits can be paid.',
        });
      }
    }

    let totalPaidInThisTx = 0;
    const processedTransactions = [];
    const updatedBookings = [];

    // 2. Process each eligible crew member's payment separately
    for (const b of crewBookings) {
      const total = Number(b.total_amount) || 0;
      const currentPaid = Number(b.paid_amount || 0);
      const advanceDue = Number(b.advance_amount || Math.round(total * 0.3));

      let payAmount = 0;
      if (payment_type === 'advance') {
        if (currentPaid < advanceDue && (b.status === 'approved' || b.status === 'payment_pending')) {
          payAmount = Math.max(0, advanceDue - currentPaid);
        }
      } else {
        // Balance settlement
        if (currentPaid < total && (b.status === 'confirmed' || b.status === 'completed')) {
          payAmount = Math.max(0, total - currentPaid);
        }
      }

      if (payAmount > 0) {
        const mockRzpId = `rzp_crew_${Math.random().toString(36).substring(2, 10)}`;
        const mockOrderId = `order_crew_${Math.random().toString(36).substring(2, 10)}`;

        // Insert separate ledger entry in payments table for this specific vendor & booking
        const payIns = await db.query(
          `INSERT INTO payments (booking_id, vendor_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'paid', NOW())
           ON CONFLICT (razorpay_order_id, booking_id) DO UPDATE
           SET amount = EXCLUDED.amount, razorpay_payment_id = EXCLUDED.razorpay_payment_id, payment_status = 'paid'
           RETURNING id, amount, payment_type, payment_status, created_at;`,
          [b.id, b.vendor_id, mockOrderId, mockRzpId, payAmount, payment_type]
        );

        const newPaid = currentPaid + payAmount;
        const newPaymentStatus = newPaid >= total ? 'paid' : 'advance_paid';
        const newStatus = (payment_type === 'advance' && (b.status === 'approved' || b.status === 'payment_pending'))
          ? 'confirmed'
          : b.status;

        const upd = await db.query(
          `UPDATE bookings
           SET paid_amount = $1, payment_status = $2, status = $3
           WHERE id = $4
           RETURNING *;`,
          [newPaid, newPaymentStatus, newStatus, b.id]
        );

        totalPaidInThisTx += payAmount;
        processedTransactions.push({
          booking_id: b.id,
          vendor_name: b.business_name,
          role: b.crew_role || b.skills,
          amount_credited: payAmount,
          payment_id: payIns.rows[0].id,
          receipt_number: `RCP-${payment_type.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${payIns.rows[0].id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        });
        updatedBookings.push(upd.rows[0]);
      }
    }

    if (processedTransactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: payment_type === 'advance'
          ? 'All crew members already have their advance deposits settled, or are awaiting studio approval.'
          : 'All crew balances are already fully settled.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Combined payment of ₹${totalPaidInThisTx.toLocaleString()} processed! Credited separately to ${processedTransactions.length} crew specialist(s).`,
      total_amount_paid: totalPaidInThisTx,
      crew_members_paid_count: processedTransactions.length,
      transactions: processedTransactions,
      updated_bookings: updatedBookings,
    });
  } catch (error) {
    console.error('Process Crew Bundle Payment Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/bookings/crew-bundle/:bundleId/create-razorpay-order
// Generates official Razorpay order for an entire approved crew bundle using configured Razorpay keys
exports.createRazorpayCrewOrder = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { payment_type = 'advance' } = req.body;
    const userId = req.user.id;

    // Fetch all bookings for this bundle belonging to this customer
    const bookingsRes = await db.query(
      `SELECT b.*, u.name AS customer_name, u.email AS customer_email, u.mobile AS customer_mobile, vp.business_name
       FROM bookings b
       JOIN users u ON b.customer_id = u.id
       LEFT JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.crew_bundle_id = $1 AND (b.customer_id = $2 OR $3 = 'admin')
       ORDER BY b.created_at ASC;`,
      [bundleId, userId, req.user.role]
    );

    if (bookingsRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No crew bookings found for this project bundle.' });
    }

    const crewBookings = bookingsRes.rows;

    // 1. Stage verification: No advance payment if any member is still under review or rejected
    if (payment_type === 'advance') {
      const underReviewMembers = crewBookings.filter(
        (b) => b.status === 'under_review' || b.status === 'availability_check' || b.status === 'new_request'
      );
      if (underReviewMembers.length > 0) {
        const vendorNames = underReviewMembers.map((m) => m.business_name || 'Studio').join(', ');
        return res.status(400).json({
          success: false,
          message: `Cannot pay crew advance yet: ${vendorNames} (${underReviewMembers.length} specialist(s)) are still reviewing your shoot schedule in Stage 2. Please wait for creative partner acceptance before paying the advance.`,
        });
      }

      const rejectedMembers = crewBookings.filter(
        (b) => b.status === 'rejected' || b.status === 'cancelled'
      );
      if (rejectedMembers.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A creative partner has declined this shoot slot. Please re-arrange the vacant role with a replacement partner before paying the crew advance.`,
        });
      }
    }

    // 2. Calculate combined payment amount
    let totalPayAmount = 0;
    const eligibleBookings = [];

    for (const b of crewBookings) {
      const total = Number(b.total_amount) || 0;
      const currentPaid = Number(b.paid_amount || 0);
      const advanceDue = Number(b.advance_amount || Math.round(total * 0.3));

      let memberPay = 0;
      if (payment_type === 'advance') {
        if (currentPaid < advanceDue && (b.status === 'approved' || b.status === 'payment_pending')) {
          memberPay = Math.max(0, advanceDue - currentPaid);
        }
      } else {
        // Balance settlement
        if (currentPaid < total && (b.status === 'confirmed' || b.status === 'completed')) {
          memberPay = Math.max(0, total - currentPaid);
        }
      }

      if (memberPay > 0) {
        totalPayAmount += memberPay;
        eligibleBookings.push({
          booking_id: b.id,
          vendor_name: b.business_name,
          role: b.crew_role,
          amount_due: memberPay,
        });
      }
    }

    if (totalPayAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: payment_type === 'advance'
          ? 'All crew members already have their advance deposits settled, or are awaiting partner approval.'
          : 'All crew balances are already fully settled.',
      });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isLiveKeys = keyId && !keyId.includes('xxxxxx') && keySecret && !keySecret.includes('xxxxxx');

    let orderId = '';
    let isMock = false;

    if (isLiveKeys) {
      try {
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const rzpOrder = await razorpay.orders.create({
          amount: Math.round(totalPayAmount * 100), // paise
          currency: 'INR',
          receipt: `crew_${bundleId.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`,
          notes: {
            crew_bundle_id: bundleId,
            payment_type,
            customer_id: userId,
            member_count: String(eligibleBookings.length),
          },
        });
        orderId = rzpOrder.id;
      } catch (rzpErr) {
        console.warn('Razorpay Live API Error for Crew, falling back to simulator:', rzpErr.message);
        isMock = true;
        orderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    } else {
      isMock = true;
      orderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const firstBooking = crewBookings[0];

    return res.status(200).json({
      success: true,
      order_id: orderId,
      key_id: isLiveKeys ? keyId : 'rzp_test_simulated',
      amount: totalPayAmount,
      amount_paise: Math.round(totalPayAmount * 100),
      currency: 'INR',
      payment_type,
      is_mock: isMock,
      bundle_id: bundleId,
      bundle_name: firstBooking.crew_bundle_name || firstBooking.project_name,
      eligible_members: eligibleBookings,
      customer: {
        name: firstBooking.customer_name,
        email: firstBooking.customer_email,
        mobile: firstBooking.customer_mobile,
      },
    });
  } catch (error) {
    console.error('Create Razorpay Crew Order Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// POST /api/v1/bookings/crew-bundle/:bundleId/verify-razorpay-payment
// Verifies signature from Razorpay, credits each vendor's account individually, and confirms all bookings
exports.verifyRazorpayCrewPayment = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_type = 'advance',
      is_mock = false,
    } = req.body;
    const userId = req.user.id;

    // 1. Fetch bookings
    const bookingsRes = await db.query(
      `SELECT b.*, vp.business_name
       FROM bookings b
       LEFT JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.crew_bundle_id = $1 AND (b.customer_id = $2 OR $3 = 'admin')
       ORDER BY b.created_at ASC;`,
      [bundleId, userId, req.user.role]
    );

    if (bookingsRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No crew bookings found for this project bundle.' });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    // 2. Verify signature if live
    if (!is_mock && keySecret && !keySecret.includes('xxxxxx') && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature verification failed.' });
      }
    }

    const paymentId = razorpay_payment_id || `rzp_crew_${Date.now()}`;
    const orderId = razorpay_order_id || `order_crew_${Date.now()}`;

    let totalPaidInThisTx = 0;
    const processedTransactions = [];
    const updatedBookings = [];

    // 3. Process each eligible crew member
    for (const b of bookingsRes.rows) {
      const total = Number(b.total_amount) || 0;
      const currentPaid = Number(b.paid_amount || 0);
      const advanceDue = Number(b.advance_amount || Math.round(total * 0.3));

      let payAmount = 0;
      if (payment_type === 'advance') {
        if (currentPaid < advanceDue && (b.status === 'approved' || b.status === 'payment_pending')) {
          payAmount = Math.max(0, advanceDue - currentPaid);
        }
      } else {
        if (currentPaid < total && (b.status === 'confirmed' || b.status === 'completed')) {
          payAmount = Math.max(0, total - currentPaid);
        }
      }

      if (payAmount > 0) {
        // Distinct ledger entry in payments table for each vendor
        const payIns = await db.query(
          `INSERT INTO payments (booking_id, vendor_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, payment_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', NOW())
           ON CONFLICT (razorpay_order_id, booking_id) DO UPDATE
           SET amount = EXCLUDED.amount, razorpay_payment_id = EXCLUDED.razorpay_payment_id, razorpay_signature = EXCLUDED.razorpay_signature, payment_status = 'paid'
           RETURNING id, amount, payment_type, payment_status, created_at;`,
          [b.id, b.vendor_id, orderId, paymentId, razorpay_signature || 'verified', payAmount, payment_type]
        );

        const newPaid = currentPaid + payAmount;
        const newPaymentStatus = newPaid >= total ? 'paid' : 'advance_paid';
        const newStatus = (payment_type === 'advance' && (b.status === 'approved' || b.status === 'payment_pending'))
          ? 'confirmed'
          : b.status;

        const upd = await db.query(
          `UPDATE bookings
           SET paid_amount = $1, payment_status = $2, status = $3
           WHERE id = $4
           RETURNING *;`,
          [newPaid, newPaymentStatus, newStatus, b.id]
        );

        totalPaidInThisTx += payAmount;
        processedTransactions.push({
          booking_id: b.id,
          vendor_name: b.business_name,
          role: b.crew_role || b.skills,
          amount_credited: payAmount,
          payment_id: payIns.rows[0].id,
          receipt_number: `RCP-${payment_type.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${payIns.rows[0].id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        });
        updatedBookings.push(upd.rows[0]);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Razorpay payment of ₹${totalPaidInThisTx.toLocaleString()} verified! Credited separately to ${processedTransactions.length} crew specialist(s).`,
      total_amount_paid: totalPaidInThisTx,
      crew_members_paid_count: processedTransactions.length,
      transactions: processedTransactions,
      updated_bookings: updatedBookings,
    });
  } catch (error) {
    console.error('Verify Razorpay Crew Payment Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ==========================================
// PROJECT DELIVERABLES & MEDIA VAULT METHODS
// ==========================================

// GET /api/v1/bookings/:id/deliverables
// Protected: Get all deliverables for a booking (Customer, Vendor, or Admin)
exports.getBookingDeliverables = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Verify booking participant
    const bRes = await db.query(
      `SELECT b.*, vp.user_id AS vendor_user_id, vp.business_name,
              u_cust.name AS customer_name, u_cust.email AS customer_email
       FROM bookings b
       LEFT JOIN vendor_profiles vp ON b.vendor_id = vp.id
       LEFT JOIN users u_cust ON b.customer_id = u_cust.id
       WHERE b.id = $1;`,
      [id]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bRes.rows[0];
    const isCustomer = booking.customer_id === userId;
    const isVendor = booking.vendor_user_id === userId;

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied to this project vault.' });
    }

    const deliverablesRes = await db.query(
      `SELECT pd.*, vp.business_name, u_vend.name AS vendor_owner_name
       FROM project_deliverables pd
       JOIN vendor_profiles vp ON vp.id = pd.vendor_id
       JOIN users u_vend ON u_vend.id = vp.user_id
       WHERE pd.booking_id = $1
       ORDER BY pd.version DESC, pd.created_at DESC;`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          project_name: booking.project_name,
          status: booking.status,
          payment_status: booking.payment_status,
          total_amount: booking.total_amount,
          paid_amount: booking.paid_amount,
          advance_amount: booking.advance_amount,
          vendor_business_name: booking.business_name,
          customer_name: booking.customer_name,
          start_date: booking.start_date,
          end_date: booking.end_date,
        },
        deliverables: deliverablesRes.rows,
      },
    });
  } catch (err) {
    console.error('getBookingDeliverables error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve deliverables.' });
  }
};

// POST /api/v1/bookings/:id/deliverables
// Protected: Vendor submits deliverables (Cloud link or direct file)
exports.submitBookingDeliverable = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, deliverable_type, cloud_url, access_credentials, file_type } = req.body;

    // Verify vendor
    const bRes = await db.query(
      `SELECT b.*, vp.id AS vendor_profile_id, vp.user_id AS vendor_user_id
       FROM bookings b
       JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.id = $1;`,
      [id]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bRes.rows[0];
    if (booking.vendor_user_id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned creative vendor can submit deliverables.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Deliverable title is required.' });
    }

    let finalFileUrl = cloud_url?.trim() || '';
    let fileName = null;
    let fileSize = null;
    let detectedType = file_type || 'cloud_suite';

    if (req.file) {
      finalFileUrl = `/uploads/deliverables/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = req.file.size;
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.raw', '.cr2', '.nef'].includes(ext)) {
        detectedType = 'image';
      } else if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
        detectedType = 'video';
      } else if (['.zip', '.rar', '.7z', '.tar'].includes(ext)) {
        detectedType = 'archive';
      } else if (['.pdf', '.doc', '.docx'].includes(ext)) {
        detectedType = 'document';
      }
    }

    if (!finalFileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a secure cloud delivery link (Google Drive, Dropbox, etc.) or upload a file.',
      });
    }

    // Determine current version number
    const maxVerRes = await db.query(
      `SELECT COALESCE(MAX(version), 0) AS max_version FROM project_deliverables WHERE booking_id = $1;`,
      [id]
    );
    const nextVersion = Number(maxVerRes.rows[0].max_version) + 1;

    // Insert deliverable record
    const insertRes = await db.query(
      `INSERT INTO project_deliverables (
        booking_id, vendor_id, title, description, deliverable_type,
        file_url, file_name, file_size, file_type, access_credentials,
        version, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted')
      RETURNING *;`,
      [
        id,
        booking.vendor_profile_id,
        title.trim(),
        description ? description.trim() : '',
        deliverable_type === 'file_upload' || req.file ? 'file_upload' : 'cloud_link',
        finalFileUrl,
        fileName,
        fileSize,
        detectedType,
        access_credentials ? access_credentials.trim() : null,
        nextVersion,
      ]
    );

    const savedDeliverable = insertRes.rows[0];

    // Update booking status to deliverables_submitted (if it is confirmed or in_progress)
    await db.query(
      `UPDATE bookings SET status = 'deliverables_submitted' WHERE id = $1;`,
      [id]
    );

    // Notify client via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`user:${booking.customer_id}`).emit('deliverable_notification', {
        type: 'deliverable_submitted',
        booking_id: id,
        deliverable_id: savedDeliverable.id,
        title: savedDeliverable.title,
        version: nextVersion,
        message: `Your creative partner has uploaded Deliverables (v${nextVersion}) for "${booking.project_name || 'Project'}". Review in your Media Vault!`,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Deliverable package (v${nextVersion}) successfully published to client vault!`,
      data: savedDeliverable,
    });
  } catch (err) {
    console.error('submitBookingDeliverable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit deliverables.' });
  }
};

// POST /api/v1/bookings/:id/deliverables/:deliverableId/review
// Protected: Customer reviews deliverables (Approves or Requests Revision)
exports.reviewBookingDeliverable = async (req, res) => {
  try {
    const { id, deliverableId } = req.params;
    const { decision, feedback } = req.body;
    const userId = req.user.id;

    if (!['approved', 'revision_requested'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review decision. Must be 'approved' or 'revision_requested'.",
      });
    }

    if (decision === 'revision_requested' && (!feedback || !feedback.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide specific revision instructions for the creative partner.',
      });
    }

    // Verify booking and client
    const bRes = await db.query(
      `SELECT b.*, vp.user_id AS vendor_user_id
       FROM bookings b
       JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.id = $1;`,
      [id]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bRes.rows[0];
    if (booking.customer_id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only the project client can review deliverables.' });
    }

    // Update deliverable status and feedback
    const dRes = await db.query(
      `UPDATE project_deliverables 
       SET status = $1, client_feedback = $2, reviewed_at = NOW() 
       WHERE id = $3 AND booking_id = $4 
       RETURNING *;`,
      [decision, feedback ? feedback.trim() : null, deliverableId, id]
    );

    if (dRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deliverable record not found.' });
    }

    const updatedDeliverable = dRes.rows[0];

    // If approved -> update booking status to completed!
    if (decision === 'approved') {
      await db.query(`UPDATE bookings SET status = 'completed' WHERE id = $1;`, [id]);
    }

    // Notify vendor via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`user:${booking.vendor_user_id}`).emit('deliverable_notification', {
        type: decision === 'approved' ? 'deliverable_approved' : 'revision_requested',
        booking_id: id,
        deliverable_id: deliverableId,
        feedback: feedback ? feedback.trim() : '',
        message: decision === 'approved'
          ? `Great news! The client has approved your deliverables for "${booking.project_name || 'Project'}". Project marked as completed!`
          : `Client requested revisions on "${booking.project_name || 'Project'}": ${feedback.trim()}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: decision === 'approved'
        ? 'Deliverables approved! Project successfully completed. You can now settle any remaining balance and share your review.'
        : 'Revision request sent to creative partner.',
      data: updatedDeliverable,
    });
  } catch (err) {
    console.error('reviewBookingDeliverable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit deliverable review.' });
  }
};

// POST /api/v1/bookings/:id/deliverables/:deliverableId/vendor-reply
// Protected: Vendor submits an official response or status note to a revision request
exports.replyToBookingDeliverable = async (req, res) => {
  try {
    const { id, deliverableId } = req.params;
    const { reply } = req.body;
    const userId = req.user.id;

    if (!reply || !reply.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required.',
      });
    }

    // Verify booking and vendor
    const bRes = await db.query(
      `SELECT b.*, vp.user_id AS vendor_user_id, vp.business_name
       FROM bookings b
       JOIN vendor_profiles vp ON b.vendor_id = vp.id
       WHERE b.id = $1;`,
      [id]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bRes.rows[0];
    if (booking.vendor_user_id !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned creative vendor can reply to this revision request.' });
    }

    // Update deliverable with vendor reply
    const dRes = await db.query(
      `UPDATE project_deliverables 
       SET vendor_reply = $1, vendor_replied_at = NOW() 
       WHERE id = $2 AND booking_id = $3 
       RETURNING *;`,
      [reply.trim(), deliverableId, id]
    );

    if (dRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deliverable record not found.' });
    }

    const updatedDeliverable = dRes.rows[0];

    // Notify customer via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`user:${booking.customer_id}`).emit('deliverable_notification', {
        type: 'vendor_revision_reply',
        booking_id: id,
        deliverable_id: deliverableId,
        reply: reply.trim(),
        message: `${booking.business_name || 'Studio'} replied to your revision request: "${reply.trim().slice(0, 80)}..."`,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Studio response successfully posted to revision thread.',
      data: updatedDeliverable,
    });
  } catch (err) {
    console.error('replyToBookingDeliverable error:', err);
    return res.status(500).json({ success: false, message: 'Failed to post reply to revision.' });
  }
};

// POST /api/v1/bookings/:id/remind-balance
// Protected: Vendor sends balance payment reminder to customer for completed/submitted production
exports.sendBalancePaymentReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Fetch booking with vendor & customer details
    const bRes = await db.query(
      `SELECT b.*, vp.id AS vp_vendor_id, vp.user_id AS vendor_user_id, vp.business_name AS vendor_business_name,
              cu.id AS customer_user_id, cu.name AS customer_name, cu.email AS customer_email
       FROM bookings b
       JOIN vendor_profiles vp ON b.vendor_id = vp.id
       JOIN users cu ON b.customer_id = cu.id
       WHERE b.id = $1`,
      [id]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bRes.rows[0];

    // 2. Authorization: Vendor who owns this booking, or admin
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (booking.vendor_user_id !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You are not the assigned vendor for this booking.' });
    }

    // 3. Balance verification
    const totalAmount = Number(booking.total_amount || 0);
    const paidAmount = Number(booking.paid_amount || 0);
    const balanceDue = totalAmount - paidAmount;

    if (balanceDue <= 0 || booking.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'No pending balance due for this booking. Full project amount has already been settled.',
      });
    }

    // 4. Rate-limiting check: 2 minutes cooldown
    if (booking.last_balance_reminder_at) {
      const diffMs = Date.now() - new Date(booking.last_balance_reminder_at).getTime();
      const diffMinutes = diffMs / (1000 * 60);
      if (diffMinutes < 2) {
        return res.status(429).json({
          success: false,
          message: `A balance payment reminder was recently sent. Please wait ${Math.ceil(2 - diffMinutes)} minute(s) before sending another reminder.`,
        });
      }
    }

    // 5. Update last_balance_reminder_at
    const updateRes = await db.query(
      `UPDATE bookings 
       SET last_balance_reminder_at = NOW() 
       WHERE id = $1 
       RETURNING last_balance_reminder_at`,
      [id]
    );
    const lastReminderAt = updateRes.rows[0].last_balance_reminder_at;

    // 6. Post system payment reminder message in chat
    const reminderMsg = `💳 Final Balance Payment Reminder: Production deliverables for "${booking.project_name || 'Creative Production Shoot'}" are completed. The outstanding balance of ₹${balanceDue.toLocaleString()} is now due for settlement. Please settle this via your Client Dashboard to complete project escrow.`;

    let convId = null;
    try {
      const convRes = await db.query(
        `SELECT id FROM conversations WHERE customer_id = $1 AND vendor_id = $2 LIMIT 1`,
        [booking.customer_id, booking.vendor_id]
      );
      if (convRes.rows.length > 0) {
        convId = convRes.rows[0].id;
      } else {
        const newConv = await db.query(
          `INSERT INTO conversations (customer_id, vendor_id, booking_id, type, last_message_at)
           VALUES ($1, $2, $3, 'customer_vendor', NOW())
           RETURNING id`,
          [booking.customer_id, booking.vendor_id, booking.id]
        );
        convId = newConv.rows[0].id;
      }

      if (convId) {
        const msgRes = await db.query(
          `INSERT INTO messages (conversation_id, sender_id, sender_role, message)
           VALUES ($1, $2, 'vendor', $3)
           RETURNING *`,
          [convId, userId, reminderMsg]
        );
        const savedMessage = msgRes.rows[0];

        await db.query(
          `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
          [convId]
        );

        const io = getSocketIO();
        if (io) {
          io.to(`conv:${convId}`).emit('new_message', savedMessage);
          io.to(`user:${booking.customer_id}`).emit('chat_notification', {
            conversation_id: convId,
            sender_id: userId,
            sender_name: booking.vendor_business_name || 'Creative Studio',
            message: reminderMsg,
            created_at: savedMessage.created_at,
          });
        }
      }
    } catch (chatErr) {
      console.warn('Could not post balance reminder to chat messages:', chatErr.message);
    }

    // 7. Emit dedicated Socket.IO notification to client
    const io = getSocketIO();
    if (io) {
      io.to(`user:${booking.customer_id}`).emit('balance_reminder_notification', {
        type: 'balance_payment_reminder',
        booking_id: booking.id,
        project_name: booking.project_name,
        vendor_name: booking.vendor_business_name || 'Creative Studio',
        balance_due: balanceDue,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        reminded_at: lastReminderAt,
        message: `${booking.vendor_business_name || 'Your creative studio'} has requested settlement of pending balance ₹${balanceDue.toLocaleString()} for "${booking.project_name}".`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Balance payment reminder for ₹${balanceDue.toLocaleString()} sent to ${booking.customer_name}.`,
      data: {
        booking_id: booking.id,
        balance_due: balanceDue,
        last_balance_reminder_at: lastReminderAt,
      },
    });
  } catch (err) {
    console.error('sendBalancePaymentReminder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send balance payment reminder.' });
  }
};