const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory OTP cache for testing/MVP (use Redis or an SMS service in production)
const otpStore = new Map();

// Generate & Send OTP
// Only registered users with their mobile number in `users` can receive an OTP
exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const cleanMobile = mobile.trim();

    // Check if the user is registered in the database
    const userRes = await db.query(
      'SELECT id, name, mobile, role, is_verified FROM users WHERE mobile = $1',
      [cleanMobile]
    );

    if (userRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'This mobile number is not registered. Only registered accounts can log in.',
      });
    }

    const user = userRes.rows[0];

    // 4-digit OTP generated for development/MVP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(cleanMobile, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    console.log(`[DEV OTP] Mobile: ${cleanMobile} | Role: ${user.role} | Code: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
      otp: otp, // returned for dev convenience
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Verify OTP & Authenticate
// Strictly authenticates existing registered users based on their DB profile
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
    }

    const cleanMobile = mobile.trim();
    const storedData = otpStore.get(cleanMobile);
    if (!storedData || storedData.otp !== otp || Date.now() > storedData.expiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    otpStore.delete(cleanMobile);

    // Look up registered user
    const userResult = await db.query('SELECT * FROM users WHERE mobile = $1', [cleanMobile]);
    if (userResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'This account is not registered. Access denied.',
      });
    }

    const user = userResult.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Sign in successful',
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
      // Ensure admin user exists in DB for foreign key consistency
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
    const userRes = await db.query('SELECT * FROM users WHERE email = $1 OR mobile = $1', [loginInput]);
    if (userRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'This account is not registered. Only registered accounts can log in.',
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

// Admin Login Alias for backwards compatibility
exports.adminLogin = exports.commonLogin;