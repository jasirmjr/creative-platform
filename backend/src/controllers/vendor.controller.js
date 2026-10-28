const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// GET /api/v1/vendors/list
// Public: Returns list of verified / all vendors with skills, availability, and owner info
exports.getRegisteredVendors = async (req, res) => {
  try {
    const { status, category_id, category, search, include_deleted, include_unavailable, include_unpaid, deposit_status } = req.query;
    let queryText = `
      SELECT 
        vp.id,
        vp.user_id,
        vp.business_name,
        vp.bio,
        vp.location,
        vp.experience,
        vp.experience_level,
        vp.skills,
        vp.availability_status,
        vp.pricing,
        vp.pricing_unit,
        vp.profile_image,
        vp.verification_status,
        vp.verified_by,
        vp.created_at,
        vp.deposit_status,
        vp.deposit_amount,
        vp.deposit_paid_at,
        vp.warning_strikes,
        vp.last_strike_at,
        c.min_daily_rate AS category_min_rate,
        c.max_daily_rate AS category_max_rate,
        c.recommended_daily_rate AS category_rec_rate,
        u.name AS owner_name,
        u.mobile,
        u.email,
        u.is_deleted,
        COALESCE(ROUND(AVG(r.rating), 1), 5.0) AS avg_rating,
        COUNT(r.id)::int AS review_count
      FROM vendor_profiles vp
      LEFT JOIN users u ON vp.user_id = u.id
      LEFT JOIN categories c ON c.name = vp.skills
      LEFT JOIN reviews r ON r.vendor_id = vp.id
      WHERE 1=1
    `;
    const params = [];

    // Filter out deactivated accounts by default so public listings only show active ventures
    if (include_deleted !== 'true') {
      queryText += ' AND (u.is_deleted IS NOT TRUE)';
    }

    // Filter out unavailable vendors by default unless requested (e.g. for admin management)
    if (include_unavailable !== 'true') {
      queryText += " AND (vp.availability_status != 'unavailable')";
    }

    // Filter by deposit status: Only paid/waived vendors on landing page by default
    if (deposit_status) {
      params.push(deposit_status);
      queryText += ` AND vp.deposit_status = $${params.length}`;
    } else if (include_unpaid !== 'true') {
      queryText += " AND (vp.deposit_status = 'paid' OR vp.deposit_status = 'waived')";
    }

    if (status) {
      const normalizedStatus = status === 'approved' ? 'verified' : status;
      if (normalizedStatus === 'verified') {
        // Any vendor who has paid the deposit or is verified is immediately listed
        queryText += " AND (vp.verification_status = 'verified' OR vp.deposit_status = 'paid' OR vp.deposit_status = 'waived')";
      } else {
        params.push(normalizedStatus);
        queryText += ` AND vp.verification_status = $${params.length}`;
      }
    }

    if (category && category !== 'all') {
      params.push(`%${category}%`);
      queryText += ` AND (vp.skills ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (vp.business_name ILIKE $${params.length} OR u.name ILIKE $${params.length} OR vp.skills ILIKE $${params.length} OR vp.location ILIKE $${params.length})`;
    }

    queryText += ' GROUP BY vp.id, u.id, c.id, c.min_daily_rate, c.max_daily_rate, c.recommended_daily_rate ORDER BY vp.created_at DESC;';

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
          verification_status = CASE WHEN vendor_profiles.deposit_status IN ('paid', 'waived') THEN 'verified' ELSE 'pending' END
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
// Protected: Provider updates their skills, experience, pricing, bio, profile image
exports.updateProviderProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_name, bio, location, experience, skills, pricing, pricing_unit, experience_level, profile_image } = req.body;

    // Validate pricing against category guardrails if pricing is being updated
    if (pricing !== undefined && pricing !== null && pricing !== '') {
      const numPrice = Number(pricing);
      const currentVp = await db.query('SELECT skills FROM vendor_profiles WHERE user_id = $1', [userId]);
      const currentSpecialty = skills || currentVp.rows[0]?.skills;

      if (currentSpecialty) {
        const catRes = await db.query(
          'SELECT min_daily_rate, max_daily_rate, recommended_daily_rate FROM categories WHERE name = $1 LIMIT 1;',
          [currentSpecialty]
        );
        if (catRes.rows.length > 0) {
          const floor = Number(catRes.rows[0].min_daily_rate);
          const ceil = Number(catRes.rows[0].max_daily_rate);
          const rec = Number(catRes.rows[0].recommended_daily_rate);
          if (isNaN(numPrice) || numPrice < floor || numPrice > ceil) {
            return res.status(400).json({
              success: false,
              message: `Standard daily rate of ₹${numPrice.toLocaleString()} is outside the permitted platform policy for ${currentSpecialty}. Permitted range is ₹${floor.toLocaleString()} to ₹${ceil.toLocaleString()} (Market Benchmark: ₹${rec.toLocaleString()}).`,
            });
          }
        }
      }
    }

    const updateQuery = `
      UPDATE vendor_profiles
      SET 
        business_name = COALESCE($1, business_name),
        bio = COALESCE($2, bio),
        location = COALESCE($3, location),
        experience = COALESCE($4, experience),
        skills = COALESCE($5, skills),
        pricing = COALESCE($6, pricing),
        pricing_unit = COALESCE($7, pricing_unit),
        experience_level = COALESCE($8, experience_level),
        profile_image = CASE WHEN $9::text IS NOT NULL THEN (CASE WHEN $9 = '' THEN NULL ELSE $9 END) ELSE profile_image END
      WHERE user_id = $10
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
      experience_level || null,
      profile_image !== undefined ? profile_image : null,
      userId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    if (profile_image !== undefined) {
      await db.query(`UPDATE users SET profile_image = $1 WHERE id = $2`, [profile_image || null, userId]).catch(() => {});
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

// POST /api/v1/vendors/avatar
// Protected: Provider uploads an image file for their profile photo
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    const { rows } = await db.query(
      `UPDATE vendor_profiles SET profile_image = $1 WHERE user_id = $2 RETURNING *;`,
      [avatarUrl, userId]
    );

    await db.query(`UPDATE users SET profile_image = $1 WHERE id = $2;`, [avatarUrl, userId]).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: rows[0],
      profile_image: avatarUrl,
    });
  } catch (error) {
    console.error('Upload Avatar Error:', error);
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

// POST /api/v1/vendors/deposit/create-order
// Protected: Creative Partner initiates Razorpay order for onboarding deposit
exports.createDepositOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const vpRes = await db.query('SELECT * FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }
    const vendor = vpRes.rows[0];

    if (vendor.deposit_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Onboarding listing deposit has already been paid and activated.' });
    }
    if (vendor.deposit_status === 'waived') {
      return res.status(400).json({ success: false, message: 'Onboarding deposit has been waived by platform administration.' });
    }

    const amount = Number(vendor.deposit_amount || 2000);
    const amountPaise = Math.round(amount * 100);

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isLiveConfigured = keyId && keySecret && !keyId.includes('xxxxxx') && !keySecret.includes('xxxxxx');

    let orderId;
    let isMock = false;

    if (isLiveConfigured) {
      try {
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: `vnd_dep_${vendor.id.slice(0, 8)}_${Date.now().toString().slice(-6)}`,
          notes: {
            vendor_id: vendor.id,
            business_name: vendor.business_name,
            type: 'vendor_onboarding_deposit',
          },
        });
        orderId = order.id;
      } catch (rzpErr) {
        console.warn('[Vendor Deposit Razorpay API Warning]:', rzpErr.message, 'Falling back to test simulation mode.');
        isMock = true;
        orderId = `order_dep_sim_${Date.now()}`;
      }
    } else {
      isMock = true;
      orderId = `order_dep_sim_${Date.now()}`;
    }

    // Record order id in vendor_profiles
    await db.query('UPDATE vendor_profiles SET deposit_order_id = $1 WHERE id = $2;', [orderId, vendor.id]);

    return res.status(200).json({
      success: true,
      order_id: orderId,
      amount: amount,
      amount_paise: amountPaise,
      currency: 'INR',
      key_id: isMock ? 'rzp_test_simulated' : keyId,
      is_mock: isMock,
      vendor: {
        id: vendor.id,
        business_name: vendor.business_name,
        deposit_amount: amount,
        deposit_status: vendor.deposit_status,
      },
    });
  } catch (error) {
    console.error('Create Vendor Deposit Order Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// POST /api/v1/vendors/deposit/verify
// Protected: Validates signature or test payment, marks vendor deposit paid, activates listing
exports.verifyDepositPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      is_mock = false,
    } = req.body;

    const vpRes = await db.query('SELECT * FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }
    const vendor = vpRes.rows[0];

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

    const paymentId = razorpay_payment_id || `rzp_dep_sim_${Date.now()}`;
    const orderId = razorpay_order_id || vendor.deposit_order_id || `order_dep_sim_${Date.now()}`;
    const amount = Number(vendor.deposit_amount || 2000);

    // Update vendor profile to paid and directly approve verification status
    const updateRes = await db.query(
      `UPDATE vendor_profiles 
       SET deposit_status = 'paid', 
           verification_status = 'verified',
           deposit_paid_at = NOW(),
           deposit_order_id = $1,
           deposit_payment_id = $2
       WHERE id = $3
       RETURNING *;`,
      [orderId, paymentId, vendor.id]
    );

    // Record in payments table
    const ins = await db.query(
      `INSERT INTO payments (vendor_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_type, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'vendor_deposit', 'paid')
       RETURNING id;`,
      [vendor.id, orderId, paymentId, razorpay_signature || 'simulated_sig', amount]
    );
    const payId = ins.rows[0]?.id;

    return res.status(200).json({
      success: true,
      message: 'Onboarding deposit verified! Your creative studio profile has been directly approved and is now live on the marketplace.',
      data: updateRes.rows[0],
      transaction: {
        receipt_id: payId,
        payment_id: paymentId,
        order_id: orderId,
        amount,
        payment_type: 'vendor_deposit',
        status: 'paid',
      },
    });
  } catch (error) {
    console.error('Verify Vendor Deposit Payment Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// PATCH /api/v1/vendors/:id/deposit-status
// Protected: Admin / Super Admin only can override deposit status
exports.updateDepositStatus = async (req, res) => {
  try {
    const { id } = req.params; // vendor_profiles.id
    const { deposit_status } = req.body; // 'paid', 'waived', 'pending'

    const allowed = ['paid', 'waived', 'pending'];
    if (!allowed.includes(deposit_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid deposit status. Must be one of: ${allowed.join(', ')}`,
      });
    }

    const paidAt = deposit_status === 'paid' ? new Date() : null;
    const isAutoVerified = (deposit_status === 'paid' || deposit_status === 'waived');
    const updateRes = await db.query(
      `UPDATE vendor_profiles
       SET deposit_status = $1,
           verification_status = CASE WHEN $2 = true THEN 'verified' ELSE verification_status END,
           deposit_paid_at = COALESCE($3, deposit_paid_at)
       WHERE id = $4
       RETURNING *;`,
      [deposit_status, isAutoVerified, paidAt, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Vendor deposit status successfully set to "${deposit_status}".`,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Update Deposit Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};