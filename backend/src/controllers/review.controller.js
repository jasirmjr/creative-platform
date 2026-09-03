const db = require('../config/db');

// POST /api/v1/reviews
// Protected: Customer leaves a review for a completed booking
exports.createReview = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { booking_id, rating, comment } = req.body;

    if (!booking_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and star rating (1-5) are required.',
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5.',
      });
    }

    // 1. Fetch booking and check ownership & status
    const bookingQuery = `
      SELECT 
        b.id,
        b.customer_id,
        b.vendor_id,
        b.status,
        b.project_name,
        r.vendor_id AS resource_vendor_id
      FROM bookings b
      LEFT JOIN resources r ON b.resource_id = r.id
      WHERE b.id = $1;
    `;
    const bookingRes = await db.query(bookingQuery, [booking_id]);

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    // Ensure only the customer of this booking can review
    if (booking.customer_id !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only review bookings made from your account.',
      });
    }

    // Ensure booking is marked as completed
    if (booking.status !== 'completed' && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted once the booking is marked as completed.',
      });
    }

    // Resolve target vendor
    const targetVendorId = booking.vendor_id || booking.resource_vendor_id;
    if (!targetVendorId) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve vendor profile for this booking.',
      });
    }

    // 2. Insert or update review (one review per booking)
    const insertQuery = `
      INSERT INTO reviews (booking_id, customer_id, vendor_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (booking_id) DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const reviewRes = await db.query(insertQuery, [
      booking.id,
      customerId,
      targetVendorId,
      numRating,
      comment || null,
    ]);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: reviewRes.rows[0],
    });
  } catch (error) {
    console.error('Create Review Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// GET /api/v1/reviews/vendor/:vendorId
// Public: Get all reviews and average rating for a vendor
exports.getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const query = `
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.booking_id,
        b.project_name,
        u.name AS customer_name
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN bookings b ON r.booking_id = b.id
      WHERE r.vendor_id = $1
      ORDER BY r.created_at DESC;
    `;
    const { rows } = await db.query(query, [vendorId]);

    const totalReviews = rows.length;
    const avgRating = totalReviews > 0
      ? (rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : '5.0';

    return res.status(200).json({
      success: true,
      total_reviews: totalReviews,
      average_rating: Number(avgRating),
      data: rows,
    });
  } catch (error) {
    console.error('Get Vendor Reviews Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/reviews/my
// Protected: Customer fetches their own reviews
exports.getMyReviews = async (req, res) => {
  try {
    const customerId = req.user.id;
    const query = `
      SELECT 
        r.*,
        b.project_name,
        vp.business_name AS vendor_business_name
      FROM reviews r
      JOIN bookings b ON r.booking_id = b.id
      JOIN vendor_profiles vp ON r.vendor_id = vp.id
      WHERE r.customer_id = $1;
    `;
    const { rows } = await db.query(query, [customerId]);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Get My Reviews Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/reviews/studio
// Protected: Vendor fetches reviews received for their studio
exports.getStudioReviews = async (req, res) => {
  try {
    const userId = req.user.id;

    // Resolve vendor profile
    const vpRes = await db.query('SELECT id, business_name FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [], average_rating: 5.0 });
    }
    const vendorId = vpRes.rows[0].id;

    const query = `
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.booking_id,
        b.project_name,
        u.name AS customer_name
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN bookings b ON r.booking_id = b.id
      WHERE r.vendor_id = $1
      ORDER BY r.created_at DESC;
    `;
    const { rows } = await db.query(query, [vendorId]);
    const totalReviews = rows.length;
    const avgRating = totalReviews > 0
      ? (rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : '5.0';

    return res.status(200).json({
      success: true,
      count: totalReviews,
      average_rating: Number(avgRating),
      data: rows,
    });
  } catch (error) {
    console.error('Get Studio Reviews Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
