const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');

// Ensure complaints upload directory exists
const complaintUploadDir = path.join(__dirname, '../../uploads/complaints');
if (!fs.existsSync(complaintUploadDir)) {
  fs.mkdirSync(complaintUploadDir, { recursive: true });
}

// Multer storage for complaint evidence
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, complaintUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'evidence-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max per proof file
});

exports.complaintUploadMiddleware = upload.single('attachment');

// Helper to resolve vendor profile ID from user ID
async function getVendorProfileIdForUser(userId) {
  const res = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

// Helper to get socket.io instance
function getSocketIO() {
  try {
    const { getIO } = require('../socket/chat.socket');
    return getIO();
  } catch (err) {
    return null;
  }
}

// Helper to get Razorpay instance
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// Helper to enrich complaints with 1-week resolution SLA countdown & auto-escalation
async function enrichWithResolutionSLA(c) {
  if (!c) return c;
  const now = new Date();
  let deadline = c.resolution_deadline
    ? new Date(c.resolution_deadline)
    : new Date(new Date(c.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
  const diffMs = deadline.getTime() - now.getTime();
  const isExpired = diffMs <= 0;
  const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  // If 7-day SLA window expired without agreement, automatically escalate for Admin Arbitration
  if (
    isExpired &&
    (c.status === 'open' || c.status === 'under_vendor_review' || c.status === 'vendor_responded') &&
    !c.settlement_agreed
  ) {
    try {
      await db.query(
        `UPDATE complaints 
         SET status = 'under_vendor_review',
             priority = 'high',
             resolution_notes = COALESCE(resolution_notes || ' | ', '') || '1-Week Mutual Resolution Window Expired. Escalated to Platform Admin Arbitration.',
             updated_at = NOW()
         WHERE id = $1;`,
        [c.id]
      );
      c.status = 'under_vendor_review';
      c.is_auto_escalated = true;
    } catch (e) {
      console.error('Error auto-escalating complaint:', e);
    }
  }

  return {
    ...c,
    resolution_deadline: deadline.toISOString(),
    days_remaining: daysRemaining,
    hours_remaining: hoursRemaining,
    is_expired: isExpired,
    sla_window_days: 7,
  };
}

async function enrichListWithResolutionSLA(list) {
  if (!Array.isArray(list)) return [];
  const results = [];
  for (const item of list) {
    results.push(await enrichWithResolutionSLA(item));
  }
  return results;
}

// POST /api/v1/complaints
// Customer files a complaint against a booking
exports.createComplaint = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      booking_id,
      category,
      subject,
      description,
      desired_resolution,
      desired_resolution_type = 'partial_refund',
      desired_resolution_amount = 0,
      desired_resolution_details = '',
      claimed_amount = 0,
      priority = 'medium',
    } = req.body;

    if (!booking_id || !category || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, category, subject, and description are required.',
      });
    }

    const effectiveDesiredRes = desired_resolution || desired_resolution_type;

    // 1. Verify booking exists and belongs to this customer
    const bookingRes = await db.query(
      `SELECT b.*, vp.id AS vendor_profile_id, vp.user_id AS vendor_user_id, vp.business_name
       FROM bookings b
       JOIN vendor_profiles vp ON vp.id = b.vendor_id
       WHERE b.id = $1;`,
      [booking_id]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Referenced booking not found.' });
    }

    const booking = bookingRes.rows[0];
    if (booking.customer_id !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only raise complaints for your own bookings.',
      });
    }

    // 2. Check if open complaint already exists for this booking
    const existingCheck = await db.query(
      `SELECT id, complaint_number, status 
       FROM complaints 
       WHERE booking_id = $1 AND status NOT IN ('resolved', 'dismissed') 
       LIMIT 1;`,
      [booking_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `An active complaint (#${existingCheck.rows[0].complaint_number}) is already under review for this booking.`,
      });
    }

    // 3. Handle evidence attachment
    let attachment_url = null;
    if (req.file) {
      attachment_url = `/uploads/complaints/${req.file.filename}`;
    }

    // 4. Generate unique readable ticket number
    const complaintNumber = `CMP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const claimAmt = Number(claimed_amount || desired_resolution_amount || 0);

    // Set 1-week (7-day) SLA deadline
    const resolutionDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 5. Insert complaint record with 1-week resolution deadline
    const insertRes = await db.query(
      `INSERT INTO complaints (
        complaint_number, booking_id, customer_id, vendor_id,
        category, subject, description, desired_resolution,
        desired_resolution_type, desired_resolution_amount, desired_resolution_details,
        claimed_amount, attachment_url, priority, status, resolution_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'open', $15)
      RETURNING *;`,
      [
        complaintNumber,
        booking_id,
        customerId,
        booking.vendor_profile_id,
        category,
        subject.trim(),
        description.trim(),
        effectiveDesiredRes,
        desired_resolution_type,
        claimAmt,
        desired_resolution_details ? desired_resolution_details.trim() : '',
        claimAmt,
        attachment_url,
        priority,
        resolutionDeadline,
      ]
    );

    const rawComplaint = insertRes.rows[0];
    const complaint = await enrichWithResolutionSLA(rawComplaint);

    // Add initial entry to complaint timeline
    const proposalNotice = `Complaint submitted: ${subject.trim()}. Proposed settlement: ${desired_resolution_type.replace(/_/g, ' ')}${claimAmt > 0 ? ` (₹${claimAmt.toLocaleString()})` : ''}${desired_resolution_details ? ` - Terms: ${desired_resolution_details.trim()}` : ''}`;

    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, attachment_url
      ) VALUES ($1, $2, 'customer', $3, $4);`,
      [
        complaint.id,
        customerId,
        proposalNotice,
        attachment_url,
      ]
    );

    // Broadcast socket event to admin
    const io = getSocketIO();
    if (io) {
      io.emit('admin_complaint_alert', {
        complaint_id: complaint.id,
        complaint_number: complaint.complaint_number,
        subject: complaint.subject,
        priority: complaint.priority,
        created_at: complaint.created_at,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Complaint #${complaint.complaint_number} submitted successfully. Platform Admin will review your case.`,
      data: complaint,
    });
  } catch (err) {
    console.error('createComplaint error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
  }
};

// GET /api/v1/complaints/my
// Customer views their filed complaints
exports.getMyComplaints = async (req, res) => {
  try {
    const customerId = req.user.id;

    const query = `
      SELECT 
        c.*,
        b.project_name,
        b.total_amount,
        b.paid_amount,
        b.payment_status AS booking_payment_status,
        b.status AS booking_status,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        vp.business_name,
        vp.location AS vendor_location,
        u_vend.name AS vendor_owner_name,
        (SELECT COUNT(*)::int FROM complaint_replies cr WHERE cr.complaint_id = c.id AND cr.is_internal = FALSE) AS reply_count
      FROM complaints c
      JOIN bookings b ON b.id = c.booking_id
      JOIN vendor_profiles vp ON vp.id = c.vendor_id
      JOIN users u_vend ON u_vend.id = vp.user_id
      WHERE c.customer_id = $1
      ORDER BY c.created_at DESC;
    `;

    const result = await db.query(query, [customerId]);
    const enriched = await enrichListWithResolutionSLA(result.rows);
    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    console.error('getMyComplaints error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load your complaints.' });
  }
};

// GET /api/v1/complaints/vendor
// Vendor views complaints assigned to their studio
exports.getVendorComplaints = async (req, res) => {
  try {
    const userId = req.user.id;
    const vendorId = await getVendorProfileIdForUser(userId);

    if (!vendorId) {
      return res.status(403).json({ success: false, message: 'Vendor profile not found.' });
    }

    const query = `
      SELECT 
        c.*,
        b.project_name,
        b.total_amount,
        b.paid_amount,
        b.status AS booking_status,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        u_cust.name AS customer_name,
        u_cust.mobile AS customer_mobile,
        u_cust.email AS customer_email
      FROM complaints c
      JOIN bookings b ON b.id = c.booking_id
      JOIN users u_cust ON u_cust.id = c.customer_id
      WHERE c.vendor_id = $1
      ORDER BY c.created_at DESC;
    `;

    const result = await db.query(query, [vendorId]);
    const enriched = await enrichListWithResolutionSLA(result.rows);
    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    console.error('getVendorComplaints error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load vendor complaints.' });
  }
};

// POST /api/v1/complaints/:id/vendor-response
// Vendor submits their official explanation & counter-evidence
exports.submitVendorResponse = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;
    const { explanation } = req.body;

    if (!explanation || !explanation.trim()) {
      return res.status(400).json({ success: false, message: 'Explanation text is required.' });
    }

    const vendorId = await getVendorProfileIdForUser(userId);
    if (!vendorId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only authorized vendor can respond.' });
    }

    // Verify complaint belongs to this vendor
    const compCheck = await db.query('SELECT * FROM complaints WHERE id = $1;', [complaintId]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compCheck.rows[0];
    if (complaint.vendor_id !== vendorId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    let vendor_attachment_url = null;
    if (req.file) {
      vendor_attachment_url = `/uploads/complaints/${req.file.filename}`;
    }

    // Update complaint record
    const updateRes = await db.query(
      `UPDATE complaints 
       SET vendor_response = $1,
           vendor_responded_at = NOW(),
           vendor_attachment_url = COALESCE($2, vendor_attachment_url),
           status = 'vendor_responded',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [explanation.trim(), vendor_attachment_url, complaintId]
    );

    // Add to timeline
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, attachment_url
      ) VALUES ($1, $2, 'vendor', $3, $4);`,
      [
        complaintId,
        userId,
        `Vendor Official Explanation: ${explanation.trim()}`,
        vendor_attachment_url,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Vendor explanation submitted successfully.',
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('submitVendorResponse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit response.' });
  }
};

// GET /api/v1/complaints/all
// Admin lists all platform complaints with filters
exports.getAllComplaints = async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;

    let whereClauses = [];
    let params = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClauses.push(`c.status = $${params.length}`);
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      whereClauses.push(`c.priority = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category);
      whereClauses.push(`c.category = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClauses.push(`(
        LOWER(c.complaint_number) LIKE $${params.length} OR
        LOWER(c.subject) LIKE $${params.length} OR
        LOWER(u_cust.name) LIKE $${params.length} OR
        LOWER(vp.business_name) LIKE $${params.length} OR
        LOWER(b.project_name) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        c.*,
        b.project_name,
        b.total_amount,
        b.paid_amount,
        b.payment_status AS booking_payment_status,
        b.status AS booking_status,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        b.location AS shoot_location,
        u_cust.name AS customer_name,
        u_cust.mobile AS customer_mobile,
        u_cust.email AS customer_email,
        vp.business_name,
        vp.location AS vendor_location,
        vp.warning_strikes AS vendor_warning_strikes,
        vp.strike_history AS vendor_strike_history,
        u_vend.name AS vendor_owner_name,
        u_vend.mobile AS vendor_mobile,
        u_vend.email AS vendor_email,
        u_res.name AS resolved_by_name,
        (SELECT COUNT(*)::int FROM complaint_replies cr WHERE cr.complaint_id = c.id) AS reply_count
      FROM complaints c
      JOIN bookings b ON b.id = c.booking_id
      JOIN users u_cust ON u_cust.id = c.customer_id
      JOIN vendor_profiles vp ON vp.id = c.vendor_id
      JOIN users u_vend ON u_vend.id = vp.user_id
      LEFT JOIN users u_res ON u_res.id = c.resolved_by
      ${whereSql}
      ORDER BY 
        CASE 
          WHEN c.priority = 'critical' THEN 1
          WHEN c.priority = 'high' THEN 2
          WHEN c.priority = 'medium' THEN 3
          ELSE 4
        END,
        c.created_at DESC;
    `;

    const result = await db.query(query, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getAllComplaints error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch complaints.' });
  }
};

// GET /api/v1/complaints/:id/timeline
// Retrieves full timeline and replies for a complaint
exports.getComplaintTimeline = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. Fetch complaint
    const compRes = await db.query(
      `SELECT 
        c.*,
        b.project_name,
        b.total_amount,
        b.paid_amount,
        b.payment_status AS booking_payment_status,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        u_cust.name AS customer_name,
        u_cust.mobile AS customer_mobile,
        vp.business_name,
        vp.user_id AS vendor_user_id,
        vp.warning_strikes AS vendor_warning_strikes,
        vp.strike_history AS vendor_strike_history,
        u_vend.name AS vendor_owner_name
       FROM complaints c
       JOIN bookings b ON b.id = c.booking_id
       JOIN users u_cust ON u_cust.id = c.customer_id
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       JOIN users u_vend ON u_vend.id = vp.user_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];

    // Authorization guard
    const isCustomer = complaint.customer_id === userId;
    const isVendor = complaint.vendor_user_id === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // 2. Fetch replies
    const repliesQuery = `
      SELECT 
        cr.*,
        u.name AS sender_name
      FROM complaint_replies cr
      JOIN users u ON u.id = cr.sender_id
      WHERE cr.complaint_id = $1
        ${isAdmin ? '' : 'AND cr.is_internal = FALSE'}
      ORDER BY cr.created_at ASC;
    `;

    const repliesRes = await db.query(repliesQuery, [complaintId]);
    const enrichedComplaint = await enrichWithResolutionSLA(complaint);

    return res.status(200).json({
      success: true,
      data: {
        complaint: enrichedComplaint,
        timeline: repliesRes.rows,
      },
    });
  } catch (err) {
    console.error('getComplaintTimeline error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load timeline.' });
  }
};

// POST /api/v1/complaints/:id/replies
// Post a reply / mediation message into complaint timeline
exports.addComplaintReply = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { message, is_internal = false } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    // Verify participant
    const compRes = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id 
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];
    const isCustomer = complaint.customer_id === userId;
    const isVendor = complaint.vendor_user_id === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let attachment_url = null;
    if (req.file) {
      attachment_url = `/uploads/complaints/${req.file.filename}`;
    }

    const senderRole = isAdmin ? 'admin' : isCustomer ? 'customer' : 'vendor';
    const effectiveInternal = isAdmin ? Boolean(is_internal) : false;

    const insertRes = await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal, attachment_url
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;`,
      [
        complaintId,
        userId,
        senderRole,
        message.trim(),
        effectiveInternal,
        attachment_url,
      ]
    );

    // Update complaint updated_at
    await db.query('UPDATE complaints SET updated_at = NOW() WHERE id = $1;', [complaintId]);

    const senderRes = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    const replyData = insertRes.rows[0];
    replyData.sender_name = senderRes.rows[0]?.name || 'User';

    return res.status(201).json({
      success: true,
      data: replyData,
    });
  } catch (err) {
    console.error('addComplaintReply error:', err);
    return res.status(500).json({ success: false, message: 'Failed to post reply.' });
  }
};

// PATCH /api/v1/complaints/:id/status
// Admin updates complaint status (e.g. under_vendor_review, resolved, dismissed)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const adminId = req.user.id;
    const { status, resolution_notes } = req.body;

    const validStatuses = ['open', 'under_vendor_review', 'vendor_responded', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const isResolved = status === 'resolved' || status === 'dismissed';

    const updateRes = await db.query(
      `UPDATE complaints
       SET status = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           resolved_by = CASE WHEN $3 THEN $4 ELSE resolved_by END,
           resolved_at = CASE WHEN $3 THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *;`,
      [
        status,
        resolution_notes ? resolution_notes.trim() : null,
        isResolved,
        adminId,
        complaintId,
      ]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const updated = updateRes.rows[0];

    // Log status change to timeline
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'admin', $3, FALSE);`,
      [
        complaintId,
        adminId,
        isResolved
          ? `Dispute Marked as ${status.toUpperCase()}. Verdict / Terms: ${resolution_notes || 'Case closed by platform administrator.'}`
          : status === 'under_vendor_review'
          ? `Status changed to "Under Vendor Review". Platform requested vendor clarification.`
          : `Dispute status updated to "${status.replace('_', ' ')}".`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Dispute status updated to ${status}.`,
      data: updated,
    });
  } catch (err) {
    console.error('updateComplaintStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update complaint status.' });
  }
};

// =========================================================================
// OPTION 1: DIRECT RESOLUTION OFFERS & MUTUAL SETTLEMENT ENGINE
// =========================================================================

// POST /api/v1/complaints/:id/accept-client-offer
// Vendor accepts customer's settlement proposal -> resolves dispute immediately
exports.acceptClientOffer = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;

    const compRes = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id, vp.business_name, u_cust.name AS customer_name
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       JOIN users u_cust ON u_cust.id = c.customer_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];
    if (complaint.vendor_user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned vendor can accept this offer.' });
    }

    if (complaint.status === 'resolved' || complaint.status === 'dismissed') {
      return res.status(400).json({ success: false, message: 'Dispute is already closed.' });
    }

    const settlementType = complaint.desired_resolution_type || complaint.desired_resolution || 'agreed_settlement';
    const settlementAmount = Number(complaint.desired_resolution_amount || complaint.claimed_amount || 0);

    const updateRes = await db.query(
      `UPDATE complaints
       SET status = 'resolved',
           settlement_agreed = TRUE,
           settlement_agreed_at = NOW(),
           settlement_type = $1,
           settlement_amount = $2,
           settlement_notes = 'Vendor accepted customer resolution offer. Amicable mutual settlement reached.',
           resolution_notes = 'Amicable settlement: Vendor accepted customer resolution offer.',
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [settlementType, settlementAmount, complaintId]
    );

    // Auto-adjust booking balance if settlement involves refund or discount
    if (settlementAmount > 0 && (settlementType === 'partial_refund' || settlementType === 'full_refund')) {
      try {
        const bRes = await db.query('SELECT id, total_amount, paid_amount FROM bookings WHERE id = $1;', [complaint.booking_id]);
        if (bRes.rows.length > 0) {
          const currentTotal = Number(bRes.rows[0].total_amount || 0);
          const newTotal = Math.max(0, currentTotal - settlementAmount);
          await db.query('UPDATE bookings SET total_amount = $1 WHERE id = $2;', [newTotal, complaint.booking_id]);
          await db.query(
            `INSERT INTO payments (booking_id, amount, payment_type, payment_status, razorpay_order_id, razorpay_payment_id)
             VALUES ($1, $2, 'refund', 'settled_discount', $3, $4);`,
            [complaint.booking_id, settlementAmount, `order_settle_${Date.now()}`, `adj_settle_${Date.now()}`]
          );
        }
      } catch (adjErr) {
        console.warn('Auto booking adjustment non-fatal warning:', adjErr.message);
      }
    }

    // Timeline message
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'vendor', $3, FALSE);`,
      [
        complaintId,
        userId,
        `Mutual Settlement Reached: Studio accepted client's resolution proposal (${settlementType.replace(/_/g, ' ')}${settlementAmount > 0 ? ` of ₹${settlementAmount.toLocaleString()}` : ''}). Escrow & booking balance adjusted. Dispute amicably resolved.`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Customer's resolution offer accepted. Escrow adjusted and dispute amicably resolved!",
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('acceptClientOffer error:', err);
    return res.status(500).json({ success: false, message: 'Failed to accept offer.' });
  }
};

// POST /api/v1/complaints/:id/counter-offer
// Vendor proposes a formal counter-offer to client
exports.submitVendorCounterOffer = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;
    const { offer_type, offer_amount = 0, offer_details } = req.body;

    if (!offer_type || !offer_details) {
      return res.status(400).json({ success: false, message: 'Counter-offer type and details are required.' });
    }

    const compRes = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id, vp.business_name
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];
    if (complaint.vendor_user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned vendor can make a counter-offer.' });
    }

    const updateRes = await db.query(
      `UPDATE complaints
       SET vendor_offer_type = $1,
           vendor_offer_amount = $2,
           vendor_offer_details = $3,
           status = 'vendor_responded',
           vendor_responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *;`,
      [offer_type, Number(offer_amount) || 0, offer_details.trim(), complaintId]
    );

    // Timeline message
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'vendor', $3, FALSE);`,
      [
        complaintId,
        userId,
        `🔄 Studio Proposed Counter-Offer: ${offer_type.replace(/_/g, ' ')}${Number(offer_amount) > 0 ? ` (₹${Number(offer_amount).toLocaleString()})` : ''}. Details: ${offer_details.trim()}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Counter-offer submitted to client.',
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('submitVendorCounterOffer error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit counter-offer.' });
  }
};

// POST /api/v1/complaints/:id/accept-vendor-offer
// Customer accepts vendor's counter-offer -> resolves dispute
exports.acceptVendorOffer = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;

    const compRes = await db.query(
      `SELECT c.* FROM complaints c WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];
    if (complaint.customer_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the customer who raised this complaint can accept the counter-offer.' });
    }

    if (!complaint.vendor_offer_type) {
      return res.status(400).json({ success: false, message: 'No counter-offer has been proposed by the vendor.' });
    }

    const updateRes = await db.query(
      `UPDATE complaints
       SET status = 'resolved',
           settlement_agreed = TRUE,
           settlement_agreed_at = NOW(),
           settlement_type = $1,
           settlement_amount = $2,
           settlement_notes = $3,
           resolution_notes = 'Amicable settlement: Customer accepted studio counter-offer.',
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *;`,
      [
        complaint.vendor_offer_type,
        complaint.vendor_offer_amount,
        complaint.vendor_offer_details,
        complaintId,
      ]
    );

    // Auto-adjust booking balance if settlement involves refund or discount
    const settleAmt = Number(complaint.vendor_offer_amount || 0);
    const settleType = complaint.vendor_offer_type;
    if (settleAmt > 0 && (settleType === 'partial_refund' || settleType === 'full_refund')) {
      try {
        const bRes = await db.query('SELECT id, total_amount, paid_amount FROM bookings WHERE id = $1;', [complaint.booking_id]);
        if (bRes.rows.length > 0) {
          const currentTotal = Number(bRes.rows[0].total_amount || 0);
          const newTotal = Math.max(0, currentTotal - settleAmt);
          await db.query('UPDATE bookings SET total_amount = $1 WHERE id = $2;', [newTotal, complaint.booking_id]);
          await db.query(
            `INSERT INTO payments (booking_id, amount, payment_type, payment_status, razorpay_order_id, razorpay_payment_id)
             VALUES ($1, $2, 'refund', 'settled_discount', $3, $4);`,
            [complaint.booking_id, settleAmt, `order_settle_${Date.now()}`, `adj_settle_${Date.now()}`]
          );
        }
      } catch (adjErr) {
        console.warn('Auto booking adjustment non-fatal warning:', adjErr.message);
      }
    }

    // Timeline message
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'customer', $3, FALSE);`,
      [
        complaintId,
        userId,
        `Client Accepted Studio's Counter-Offer (${settleType.replace(/_/g, ' ')}${settleAmt > 0 ? ` of ₹${settleAmt.toLocaleString()}` : ''}). Escrow & booking balance adjusted. Dispute amicably resolved.`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Studio's counter-offer accepted. Escrow adjusted and dispute resolved!",
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('acceptVendorOffer error:', err);
    return res.status(500).json({ success: false, message: 'Failed to accept counter-offer.' });
  }
};

// POST /api/v1/complaints/:id/escalate
// Customer or vendor declines negotiation and requests Admin Arbitration
exports.escalateToAdmin = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const userId = req.user.id;
    const { reason = 'Mutual negotiation declined. Requested platform administrator arbitration.' } = req.body;

    const compRes = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = compRes.rows[0];
    const isCust = complaint.customer_id === userId;
    const isVend = complaint.vendor_user_id === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (!isCust && !isVend && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const senderRole = isCust ? 'customer' : isVend ? 'vendor' : 'admin';

    await db.query(
      `UPDATE complaints
       SET status = 'under_vendor_review',
           priority = CASE WHEN priority = 'low' THEN 'high' ELSE priority END,
           updated_at = NOW()
       WHERE id = $1;`,
      [complaintId]
    );

    // Timeline message
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, $3, $4, FALSE);`,
      [
        complaintId,
        userId,
        senderRole,
        `⚖️ Escalated to Platform Admin Arbitration. Reason: ${reason.trim()}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Dispute escalated to Platform Admin Arbitration.',
    });
  } catch (err) {
    console.error('escalateToAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to escalate dispute.' });
  }
};

// =========================================================================
// OPTION 4: ADMIN QUICK ENFORCEMENT TOOLSET (REFUNDS, STRIKES, SPLIT)
// =========================================================================

// POST /api/v1/complaints/:id/refund
// Admin triggers Razorpay refund for a booking dispute
exports.processRazorpayRefund = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const adminId = req.user.id;
    const { amount, reason = 'Dispute settlement refund' } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid refund amount is required.' });
    }

    const refundAmount = Number(amount);

    // Fetch complaint & booking payment records
    const compRes = await db.query(
      `SELECT c.*, b.id AS booking_id, b.project_name, b.total_amount, b.paid_amount,
              b.customer_id, u_cust.name AS customer_name
       FROM complaints c
       JOIN bookings b ON b.id = c.booking_id
       JOIN users u_cust ON u_cust.id = c.customer_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const comp = compRes.rows[0];
    if (refundAmount > Number(comp.paid_amount)) {
      return res.status(400).json({
        success: false,
        message: `Refund amount (₹${refundAmount.toLocaleString()}) cannot exceed total paid amount (₹${Number(comp.paid_amount).toLocaleString()}).`,
      });
    }

    // Find payment record for this booking
    const payRes = await db.query(
      `SELECT * FROM payments 
       WHERE booking_id = $1 AND payment_status = 'paid' AND razorpay_payment_id IS NOT NULL 
       ORDER BY created_at DESC LIMIT 1;`,
      [comp.booking_id]
    );

    const payment = payRes.rows[0];
    let refundId = null;
    let isLiveRefund = false;

    const rzp = getRazorpayInstance();
    if (rzp && payment && payment.razorpay_payment_id && !payment.razorpay_payment_id.startsWith('rzp_sim_')) {
      try {
        const rzpRefund = await rzp.payments.refund(payment.razorpay_payment_id, {
          amount: Math.round(refundAmount * 100),
          notes: {
            complaint_id: comp.id,
            complaint_number: comp.complaint_number,
            reason: reason.trim(),
          },
        });
        refundId = rzpRefund.id;
        isLiveRefund = true;
      } catch (rzpErr) {
        console.warn('Live Razorpay refund failed, logging simulation fallback:', rzpErr.message);
        refundId = `rfnd_test_${Date.now()}`;
      }
    } else {
      refundId = `rfnd_sim_${Date.now()}`;
    }

    // Record refund in payments table
    await db.query(
      `INSERT INTO payments (
        booking_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status
      ) VALUES ($1, $2, $3, $4, 'refund', 'refunded');`,
      [
        comp.booking_id,
        `order_rfnd_${Date.now()}`,
        refundId,
        -refundAmount,
      ]
    );

    // Update booking paid_amount
    const newPaidAmount = Math.max(0, Number(comp.paid_amount) - refundAmount);
    const newPaymentStatus = newPaidAmount <= 0 ? 'refunded' : 'partially_paid';
    await db.query(
      `UPDATE bookings SET paid_amount = $1, payment_status = $2 WHERE id = $3;`,
      [newPaidAmount, newPaymentStatus, comp.booking_id]
    );

    // Update complaint record
    const updatedCompRes = await db.query(
      `UPDATE complaints 
       SET refund_id = $1,
           refund_amount = COALESCE(refund_amount, 0) + $2,
           refunded_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [refundId, refundAmount, complaintId]
    );

    // Log to timeline
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'admin', $3, FALSE);`,
      [
        complaintId,
        adminId,
        `💳 Platform Admin Issued Razorpay Refund of ₹${refundAmount.toLocaleString()} to ${comp.customer_name}. (Reference ID: ${refundId}${isLiveRefund ? ' - Live Razorpay' : ''}). Reason: ${reason.trim()}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmount.toLocaleString()} successfully processed.`,
      data: {
        refund_id: refundId,
        amount: refundAmount,
        is_live: isLiveRefund,
        complaint: updatedCompRes.rows[0],
      },
    });
  } catch (err) {
    console.error('processRazorpayRefund error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process refund.' });
  }
};

// POST /api/v1/complaints/:id/strike
// Admin issues a Trust & Safety Warning Strike to a vendor
exports.issueVendorStrike = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const adminId = req.user.id;
    const { reason = 'Gross negligence / Unresolved service breach' } = req.body;

    const compRes = await db.query(
      `SELECT c.*, vp.id AS vendor_profile_id, vp.business_name, vp.warning_strikes, vp.strike_history
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const comp = compRes.rows[0];
    const currentStrikes = Number(comp.warning_strikes || 0);
    const newStrikes = currentStrikes + 1;

    let history = comp.strike_history || [];
    if (typeof history === 'string') {
      try { history = JSON.parse(history); } catch (e) { history = []; }
    }
    history.push({
      date: new Date().toISOString(),
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      reason: reason.trim(),
      issued_by: adminId,
    });

    await db.query(
      `UPDATE vendor_profiles
       SET warning_strikes = $1,
           strike_history = $2::jsonb,
           last_strike_at = NOW()
       WHERE id = $3;`,
      [newStrikes, JSON.stringify(history), comp.vendor_profile_id]
    );

    // Timeline entry
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'admin', $3, FALSE);`,
      [
        complaintId,
        adminId,
        `⚠️ Platform Trust & Safety Strike #${newStrikes} issued to studio "${comp.business_name}". Reason: ${reason.trim()}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Warning strike issued. Vendor now has ${newStrikes} strike(s).`,
      data: { warning_strikes: newStrikes, strike_history: history },
    });
  } catch (err) {
    console.error('issueVendorStrike error:', err);
    return res.status(500).json({ success: false, message: 'Failed to issue vendor strike.' });
  }
};

// POST /api/v1/complaints/:id/strike/revoke
// Admin revokes 1 warning strike from the vendor
exports.revokeVendorStrike = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const adminId = req.user.id;

    const compRes = await db.query(
      `SELECT c.*, vp.id AS vendor_profile_id, vp.business_name, vp.warning_strikes
       FROM complaints c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [complaintId]
    );

    if (compRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const comp = compRes.rows[0];
    const newStrikes = Math.max(0, Number(comp.warning_strikes || 0) - 1);

    await db.query(
      `UPDATE vendor_profiles
       SET warning_strikes = $1
       WHERE id = $2;`,
      [newStrikes, comp.vendor_profile_id]
    );

    // Timeline entry
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'admin', $3, FALSE);`,
      [
        complaintId,
        adminId,
        `Platform Admin revoked 1 warning strike for studio "${comp.business_name}". Current strikes: ${newStrikes}.`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: `Strike revoked. Vendor now has ${newStrikes} strike(s).`,
      data: { warning_strikes: newStrikes },
    });
  } catch (err) {
    console.error('revokeVendorStrike error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke strike.' });
  }
};

// POST /api/v1/complaints/:id/split-settlement
// Admin records a split verdict: allocating customer refund and vendor payout
exports.splitSettlement = async (req, res) => {
  try {
    const { id: complaintId } = req.params;
    const adminId = req.user.id;
    const {
      customer_refund_amount = 0,
      vendor_payout_amount = 0,
      resolution_notes = 'Split settlement determined by platform administrator.',
    } = req.body;

    const refundAmt = Number(customer_refund_amount) || 0;
    const payoutAmt = Number(vendor_payout_amount) || 0;

    const updateRes = await db.query(
      `UPDATE complaints
       SET status = 'resolved',
           settlement_type = 'split_settlement',
           settlement_amount = $1,
           refund_amount = $1,
           vendor_payout_amount = $2,
           resolution_notes = $3,
           resolved_by = $4,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *;`,
      [refundAmt, payoutAmt, resolution_notes.trim(), adminId, complaintId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Timeline entry
    await db.query(
      `INSERT INTO complaint_replies (
        complaint_id, sender_id, sender_role, message, is_internal
      ) VALUES ($1, $2, 'admin', $3, FALSE);`,
      [
        complaintId,
        adminId,
        `⚖️ Final Split Verdict: Customer Refund of ₹${refundAmt.toLocaleString()} | Studio Payout of ₹${payoutAmt.toLocaleString()}. Terms: ${resolution_notes.trim()}`,
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Split settlement verdict recorded.',
      data: updateRes.rows[0],
    });
  } catch (err) {
    console.error('splitSettlement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record split settlement.' });
  }
};
