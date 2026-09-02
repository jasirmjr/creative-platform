const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory OTP cache for testing/MVP (use Redis or an SMS service in production)
const otpStore = new Map();

// Generate & Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { mobile, role } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    // If logging in as vendor, check that vendor is already registered
    if (role === 'vendor') {
      const userRes = await db.query(
        `SELECT u.id, u.role, vp.id AS vendor_profile_id 
         FROM users u 
         LEFT JOIN vendor_profiles vp ON u.id = vp.user_id 
         WHERE u.mobile = $1`,
        [mobile]
      );

      if (
        userRes.rows.length === 0 ||
        (!userRes.rows[0].vendor_profile_id && userRes.rows[0].role !== 'vendor')
      ) {
        return res.status(403).json({
          success: false,
          message: 'No registered vendor found with this mobile number. Please apply via "+ Register as Vendor".'
        });
      }
    }

    // 4-digit OTP generated for development/MVP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(mobile, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    // In production, integrate your SMS provider API here
    console.log(`[DEV OTP] Mobile: ${mobile} | Role: ${role || 'customer'} | Code: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Verify OTP & Authenticate
exports.verifyOtp = async (req, res) => {
  const { mobile, otp, role = 'customer', name, email } = req.body;

  // Prevent role escalation to admin via OTP
  if (role === 'admin' || role === 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin accounts must sign in using the Admin Console credentials.'
    });
  }

  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
  }

  const storedData = otpStore.get(mobile);
  if (!storedData || storedData.otp !== otp || Date.now() > storedData.expiresAt) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  otpStore.delete(mobile);

  try {
    // Check if user already exists
    let userResult = await db.query('SELECT * FROM users WHERE mobile = $1', [mobile]);
    let user = userResult.rows[0];

    // Enforce: Only registered vendors can log in as vendor
    if (role === 'vendor') {
      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'No registered vendor found with this mobile number. Please register as a vendor first.'
        });
      }

      const vpRes = await db.query('SELECT * FROM vendor_profiles WHERE user_id = $1', [user.id]);
      if (vpRes.rows.length === 0 && user.role !== 'vendor') {
        return res.status(403).json({
          success: false,
          message: 'This account is registered as a customer, not as a vendor. Please apply via "+ Register as Vendor".'
        });
      }
    }

    // If new user (customers only)
    if (!user) {
      const insertQuery = `
        INSERT INTO users (name, mobile, email, role, is_verified)
        VALUES ($1, $2, $3, 'customer', true)
        RETURNING *;
      `;
      const newUser = await db.query(insertQuery, [
        name || null,
        mobile,
        email || null,
      ]);
      user = newUser.rows[0];
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/auth/admin-login
// Dedicated Email & Password login for Administrators
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const configEmail = (process.env.ADMIN_EMAIL || 'admin@creativehub.com').trim().toLowerCase();
    const configPassword = (process.env.ADMIN_PASSWORD || 'admin@hub2026').trim();

    if (email.trim().toLowerCase() !== configEmail || password.trim() !== configPassword) {
      return res.status(401).json({ success: false, message: 'Invalid administrator email or password.' });
    }

    // Ensure admin user exists in DB for foreign key relations (e.g. verified_by in vendor_profiles)
    let adminUserRes = await db.query('SELECT * FROM users WHERE email = $1', [configEmail]);
    let adminUser = adminUserRes.rows[0];

    if (!adminUser) {
      const insertAdmin = `
        INSERT INTO users (name, mobile, email, role, is_verified)
        VALUES ('System Administrator', '0000000000', $1, 'admin', true)
        ON CONFLICT (email) DO UPDATE SET role = 'admin'
        RETURNING *;
      `;
      const created = await db.query(insertAdmin, [configEmail]);
      adminUser = created.rows[0];
    } else if (adminUser.role !== 'admin' && adminUser.role !== 'super_admin') {
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUser.id]);
      adminUser.role = 'admin';
    }

    // Generate Admin JWT
    const token = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name || 'System Administrator',
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};