const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory OTP cache for testing/MVP (use Redis or an SMS service in production)
const otpStore = new Map();

// Generate & Send OTP
exports.sendOtp = async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }

  // 4-digit OTP generated for development/MVP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore.set(mobile, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  // In production, integrate your SMS provider API here
  console.log(`[DEV OTP] Mobile: ${mobile} | Code: ${otp}`);

  return res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    otp: process.env.NODE_ENV === 'development' ? otp : undefined,
  });
};

// Verify OTP & Authenticate
exports.verifyOtp = async (req, res) => {
  const { mobile, otp, role = 'customer', name, email } = req.body;

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

    // If new user, register them
    if (!user) {
      const insertQuery = `
        INSERT INTO users (name, mobile, email, role, is_verified)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const newUser = await db.query(insertQuery, [
        name || null,
        mobile,
        email || null,
        role,
        true,
      ]);
      user = newUser.rows[0];

      // If registered as a vendor, scaffold an unverified vendor profile
      if (role === 'vendor') {
        await db.query(
          `INSERT INTO vendor_profiles (user_id, verification_status) VALUES ($1, 'pending')`,
          [user.id]
        );
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
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