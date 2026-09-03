const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory OTP cache for testing/MVP
const otpStore = new Map();

// Helper to normalize mobile numbers (strip spaces, country code, leading zeros)
function normalizeMobile(mobile) {
  if (!mobile) return '';
  const digits = mobile.toString().replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

// POST /api/v1/auth/send-otp
// Supports both 'login' (must already be registered) and 'register' (creates new customer account)
exports.sendOtp = async (req, res) => {
  try {
    const { mobile, mode = 'login' } = req.body;

    if (!mobile) {
      return res.status(400).json({ 
        success: false, 
        message: 'A valid 10-digit mobile number is required.' 
      });
    }

    const cleanMobile = normalizeMobile(mobile);
    if (cleanMobile.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit mobile number.',
      });
    }

    // Check if user is already registered in users table
    const existing = await db.query(
      'SELECT id, name, mobile, role FROM users WHERE mobile = $1 OR mobile = $2;',
      [cleanMobile, mobile]
    );

    // If attempting to log in, the user must already exist
    if (mode === 'login' && existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'This mobile number is not registered. Please switch to "Create Account" first.',
      });
    }

    // If attempting to register, prevent duplicate accounts
    if (mode === 'register' && existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this mobile number already exists. Please switch to "Sign In".',
      });
    }

    // 4-digit OTP generated for development/MVP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store in-memory map
    otpStore.set(cleanMobile, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    // Store in Postgres otps table
    try {
      await db.query(`
        INSERT INTO otps (mobile, otp, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
        ON CONFLICT (mobile) DO UPDATE SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at;
      `, [cleanMobile, otp]);
    } catch (dbErr) {
      console.warn('otps table insert fallback to in-memory:', dbErr.message);
    }

    console.log(`[DEV OTP] Mobile: ${cleanMobile} | Mode: ${mode} | Code: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
      otp, // Returned for dev/testing ease
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/auth/verify-otp
// Verifies OTP and signs user in, creating account if registering
exports.verifyOtp = async (req, res) => {
  try {
    const {
      mobile,
      otp,
      name,
      email,
      role = 'customer',
      business_name,
      category_name,
      location,
      bio,
      skills,
      pricing,
      pricing_unit,
    } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and verification code are required.' });
    }

    const cleanMobile = normalizeMobile(mobile);

    // Verify OTP from memory or DB
    let isValidOtp = false;
    const storedMemory = otpStore.get(cleanMobile);

    if (storedMemory && storedMemory.otp === otp.trim() && Date.now() <= storedMemory.expiresAt) {
      isValidOtp = true;
      otpStore.delete(cleanMobile);
    } else {
      const otpRes = await db.query(
        'SELECT * FROM otps WHERE mobile = $1 AND otp = $2 AND expires_at > NOW();',
        [cleanMobile, otp.trim()]
      );
      if (otpRes.rows.length > 0) {
        isValidOtp = true;
        await db.query('DELETE FROM otps WHERE mobile = $1;', [cleanMobile]);
      }
    }

    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    // Find or create user
    let userRes = await db.query('SELECT * FROM users WHERE mobile = $1 OR mobile = $2;', [cleanMobile, mobile]);
    let user;

    if (userRes.rows.length === 0) {
      const insertRes = await db.query(
        `INSERT INTO users (name, email, mobile, role, is_verified)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, name, email, mobile, role;`,
        [name || business_name || 'Creative User', email || null, cleanMobile, role]
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
      const targetRole = role === 'vendor' ? 'vendor' : user.role;
      const updateRes = await db.query(
        `UPDATE users
         SET name = COALESCE($1, name), email = COALESCE($2, email), role = $3
         WHERE id = $4
         RETURNING id, name, email, mobile, role;`,
        [name || business_name || user.name, email || user.email, targetRole, user.id]
      );
      user = updateRes.rows[0];
    }

    // If registering as a vendor, provision vendor_profiles
    if (user.role === 'vendor' || role === 'vendor') {
      const vendorName = business_name || user.name || 'Creative Studio';
      const vendorLocation = location || 'India';
      const vendorBio = bio || (category_name ? `Professional ${category_name} providing verified services.` : 'Creative vendor providing verified services.');
      const vendorPricing = pricing ? Number(pricing) : 15000;
      const vendorUnit = pricing_unit || 'day';

      await db.query(
        `INSERT INTO vendor_profiles (
          user_id, business_name, location, bio, skills, pricing, pricing_unit, verification_status, availability_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified', 'available')
        ON CONFLICT (user_id) DO UPDATE
        SET business_name = EXCLUDED.business_name,
            location = EXCLUDED.location,
            bio = EXCLUDED.bio,
            skills = COALESCE(EXCLUDED.skills, vendor_profiles.skills),
            pricing = EXCLUDED.pricing,
            pricing_unit = EXCLUDED.pricing_unit,
            verification_status = 'verified'
        RETURNING *;`,
        [
          user.id,
          vendorName,
          vendorLocation,
          vendorBio,
          skills || category_name || 'Production',
          vendorPricing,
          vendorUnit,
        ]
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, mobile: user.mobile },
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
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    if (error.code === '23505' && (error.constraint === 'users_email_key' || error.detail?.includes('email'))) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already registered to another account. Please use a different email or sign in.',
      });
    }
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// Common Login (Identifier & Password)
// Detects admin credentials automatically to sign in as admin, or validates registered users
exports.commonLogin = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginInput = (identifier || email || '').trim().toLowerCase();

    if (!loginInput || !password) {
      return res.status(400).json({ success: false, message: 'Email or username and password are required.' });
    }

    const configEmail = (process.env.ADMIN_EMAIL || 'admin@creativehub.com').trim().toLowerCase();
    const configPassword = (process.env.ADMIN_PASSWORD || 'admin@hub2026').trim();

    // Check if input matches Admin Credentials
    if (loginInput === configEmail && password.trim() === configPassword) {
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

      const token = jwt.sign(
        { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Sign in successful',
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name || 'System Administrator',
          email: adminUser.email,
          role: adminUser.role,
        },
      });
    }

    // If not matching admin credentials, verify if user is registered in users table
    const cleanMobile = normalizeMobile(loginInput);
    const userRes = await db.query('SELECT * FROM users WHERE email = $1 OR mobile = $2;', [loginInput, cleanMobile]);
    if (userRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'This account is not registered. Please create an account first.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify your details and try again.',
    });
  } catch (error) {
    console.error('Common Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/auth/users
// Protected: Admin / Super Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.role,
        u.is_verified,
        u.created_at,
        vp.business_name,
        vp.verification_status
      FROM users u
      LEFT JOIN vendor_profiles vp ON u.id = vp.user_id
      ORDER BY u.created_at DESC;
    `;
    const { rows } = await db.query(query);
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Fetch All Users Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin Login Alias for backwards compatibility
exports.adminLogin = exports.commonLogin;