const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// In-memory OTP cache for testing/fallback
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
    const { mobile, mode = 'login', email } = req.body;

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
      'SELECT id, name, mobile, role, is_deleted FROM users WHERE mobile = $1 OR mobile = $2;',
      [cleanMobile, mobile]
    );

    // If attempting to log in, the user must already exist and not be deactivated
    if (mode === 'login') {
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'This mobile number is not registered. Please switch to "Create Account" first.',
        });
      }
      if (existing.rows[0].is_deleted) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deactivated by platform administration. Please contact support to reactivate.',
        });
      }
    }

    // If attempting to register:
    if (mode === 'register') {
      // 1. Check if an active account with this mobile exists
      const activeMobile = existing.rows.find((u) => !u.is_deleted);
      if (activeMobile) {
        return res.status(400).json({
          success: false,
          message: 'An account with this mobile number already exists. Please switch to "Sign In".',
        });
      }

      // 2. Check if an active account with this email exists (if email provided)
      if (email && email.trim()) {
        const cleanEmail = email.trim().toLowerCase();
        const activeEmailRes = await db.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND (is_deleted IS NOT TRUE);',
          [cleanEmail]
        );
        if (activeEmailRes.rows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'This email address is already registered to another active account. Please sign in or use a different email.',
          });
        }
      }
    }

    // Cooldown check: enforce 60 seconds between OTP requests for the same number
    const prevOtp = await db.query('SELECT last_sent_at FROM otps WHERE mobile = $1;', [cleanMobile]);
    if (prevOtp.rows.length > 0 && prevOtp.rows[0].last_sent_at) {
      const elapsed = (Date.now() - new Date(prevOtp.rows[0].last_sent_at).getTime()) / 1000;
      if (elapsed < 60) {
        const remaining = Math.ceil(60 - elapsed);
        return res.status(429).json({
          success: false,
          cooldown_remaining: remaining,
          message: `Please wait ${remaining} seconds before requesting a new verification code.`,
        });
      }
    }

    // 4-digit secure OTP generated
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store in-memory map
    otpStore.set(cleanMobile, { otp, attempts: 0, expiresAt: Date.now() + 5 * 60 * 1000 });

    // Store in Postgres otps table (5 minutes expiry, resets attempts count to 0)
    try {
      await db.query(`
        INSERT INTO otps (mobile, otp, attempts, last_sent_at, expires_at)
        VALUES ($1, $2, 0, NOW(), NOW() + INTERVAL '5 minutes')
        ON CONFLICT (mobile) DO UPDATE 
        SET otp = EXCLUDED.otp, 
            attempts = 0,
            last_sent_at = EXCLUDED.last_sent_at,
            expires_at = EXCLUDED.expires_at;
      `, [cleanMobile, otp]);
    } catch (dbErr) {
      console.warn('otps table insert fallback to in-memory:', dbErr.message);
    }

    console.log(`[AUTH OTP] Mobile: ${cleanMobile} | Mode: ${mode} | Code: ${otp}`);

    const isDev = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully.',
      cooldown: 60,
      ...(isDev && { dev_otp: otp }), // Only exposed in development for testing convenience
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
      password, // Password set during registration (or first-time setup)
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
      experience_level,
      experience,
    } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and verification code are required.' });
    }

    const cleanMobile = normalizeMobile(mobile);

    // Fetch OTP record from DB
    const otpRes = await db.query(
      'SELECT * FROM otps WHERE mobile = $1;',
      [cleanMobile]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No verification code found. Please request a new code.' });
    }

    const otpRecord = otpRes.rows[0];

    // Check expiry (5 minutes)
    if (new Date() > new Date(otpRecord.expires_at)) {
      await db.query('DELETE FROM otps WHERE mobile = $1;', [cleanMobile]);
      otpStore.delete(cleanMobile);
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    // Check brute-force lockout (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await db.query('DELETE FROM otps WHERE mobile = $1;', [cleanMobile]);
      otpStore.delete(cleanMobile);
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
      });
    }

    // Validate OTP match
    if (otpRecord.otp.trim() !== otp.trim()) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      await db.query('UPDATE otps SET attempts = $1 WHERE mobile = $2;', [newAttempts, cleanMobile]);
      const remaining = 5 - newAttempts;
      return res.status(400).json({
        success: false,
        remaining_attempts: remaining,
        message: remaining > 0 
          ? `Invalid verification code. ${remaining} attempt(s) remaining.` 
          : 'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
      });
    }

    // OTP verified successfully - clear OTP record
    await db.query('DELETE FROM otps WHERE mobile = $1;', [cleanMobile]);
    otpStore.delete(cleanMobile);

    // Find or create user (check active accounts)
    let userRes = await db.query(
      'SELECT * FROM users WHERE (mobile = $1 OR mobile = $2) AND (is_deleted IS NOT TRUE);',
      [cleanMobile, mobile]
    );
    let user;

    if (userRes.rows.length === 0) {
      // Category Price Guardrails Validation for New Vendors
      let catFloor = 1000;
      let catCeil = 60000;
      let catRec = 15000;
      const primaryCat = category_name || skills;

      if (role === 'vendor' && primaryCat) {
        const catRes = await db.query(
          'SELECT min_daily_rate, max_daily_rate, recommended_daily_rate FROM categories WHERE name = $1 LIMIT 1;',
          [primaryCat]
        );
        if (catRes.rows.length > 0) {
          catFloor = Number(catRes.rows[0].min_daily_rate);
          catCeil = Number(catRes.rows[0].max_daily_rate);
          catRec = Number(catRes.rows[0].recommended_daily_rate);
        }
      }

      if (role === 'vendor' && pricing !== undefined && pricing !== null && pricing !== '') {
        const numPrice = Number(pricing);
        if (isNaN(numPrice) || numPrice < catFloor || numPrice > catCeil) {
          return res.status(400).json({
            success: false,
            message: `Daily rate of ₹${Number(pricing).toLocaleString()} is outside the permitted platform policy for ${primaryCat || 'this discipline'}. Permitted range is ₹${catFloor.toLocaleString()} to ₹${catCeil.toLocaleString()} (Market Benchmark: ₹${catRec.toLocaleString()}).`,
          });
        }
      }

      // Check if email already belongs to an active account
      if (email && email.trim()) {
        const cleanEmail = email.trim().toLowerCase();
        const activeEmailRes = await db.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND (is_deleted IS NOT TRUE);',
          [cleanEmail]
        );
        if (activeEmailRes.rows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'This email address is already registered to another account. Please use a different email or sign in.',
          });
        }

        // If a previously deleted/deactivated account has this email, release it immediately
        await db.query(
          `UPDATE users 
           SET email = email || '__deleted__' || SUBSTRING(id::text, 1, 8) 
           WHERE LOWER(email) = LOWER($1) AND is_deleted = true;`,
          [cleanEmail]
        );
      }

      // If a previously deleted/deactivated account has this mobile, release it immediately
      await db.query(
        `UPDATE users 
         SET mobile = mobile || '__del__' || SUBSTRING(id::text, 1, 8) 
         WHERE (mobile = $1 OR mobile = $2) AND is_deleted = true;`,
        [cleanMobile, mobile]
      );

      // New User Registration
      let passwordHash = null;
      if (password && password.trim().length >= 6) {
        passwordHash = await bcrypt.hash(password.trim(), 10);
      }

      const insertRes = await db.query(
        `INSERT INTO users (name, email, mobile, role, password_hash, is_verified)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, name, email, mobile, role, is_verified, password_hash;`,
        [name || business_name || 'Creative User', email ? email.trim().toLowerCase() : null, cleanMobile, role, passwordHash]
      );
      user = insertRes.rows[0];

      // Provision vendor profile if registering as vendor
      if (role === 'vendor') {
        const vendorName = business_name || user.name || 'Creative Studio';
        const vendorLocation = location || 'India';
        const vendorBio = bio || (primaryCat ? `Professional ${primaryCat} providing verified services.` : 'Creative vendor providing verified services.');
        const vendorPricing = (pricing && !isNaN(pricing)) ? Number(pricing) : catRec;
        const vendorUnit = pricing_unit || 'day';
        const expLevel = experience_level || 'mid';
        const expString = experience || (expLevel === 'senior' ? '6+ Years' : expLevel === 'entry' ? '1 – 2 Years' : '3 – 5 Years');

        const vpRes = await db.query(
          `INSERT INTO vendor_profiles (
            user_id, business_name, location, bio, skills, pricing, pricing_unit, verification_status, availability_status, deposit_status, deposit_amount, experience_level, experience
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified', 'available', 'pending', 2000.00, $8, $9)
          RETURNING *;`,
          [
            user.id,
            vendorName,
            vendorLocation,
            vendorBio,
            skills || category_name || 'Production',
            vendorPricing,
            vendorUnit,
            expLevel,
            expString,
          ]
        );
        user.vendor_profile = vpRes.rows[0];
      }
    } else {
      // Existing User Login (Strict authentication without mutating existing role/name)
      user = userRes.rows[0];
      if (user.is_deleted) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deactivated by platform administration. Please contact support to reactivate.',
        });
      }

      // If user logs in and also provides a password to set for the first time
      if (!user.password_hash && password && password.trim().length >= 6) {
        const passwordHash = await bcrypt.hash(password.trim(), 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2;', [passwordHash, user.id]);
        user.password_hash = passwordHash;
      }

      // Fetch vendor profile if vendor
      if (user.role === 'vendor') {
        const vpRes = await db.query('SELECT * FROM vendor_profiles WHERE user_id = $1;', [user.id]);
        user.vendor_profile = vpRes.rows[0] || null;
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, mobile: user.mobile, email: user.email },
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
        has_password: Boolean(user.password_hash),
        vendor_profile: user.vendor_profile || null,
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

// Password Login (Identifier & Password)
// Supports all registered users (Customers, Vendors, Admin) via Email OR 10-Digit Mobile
exports.commonLogin = async (req, res) => {
  try {
    const { identifier, email, mobile, password } = req.body;
    const input = (identifier || email || mobile || '').trim();

    if (!input || !password) {
      return res.status(400).json({ success: false, message: 'Email or mobile number and password are required.' });
    }

    const cleanInput = input.toLowerCase();
    const cleanMobile = normalizeMobile(input);

    // 1. Check Admin master credentials
    const configEmail = (process.env.ADMIN_EMAIL || 'admin@creativehub.com').trim().toLowerCase();
    const configPassword = (process.env.ADMIN_PASSWORD || 'admin@hub2026').trim();

    if (cleanInput === configEmail && password.trim() === configPassword) {
      let adminUserRes = await db.query('SELECT * FROM users WHERE email = $1', [configEmail]);
      let adminUser = adminUserRes.rows[0];

      if (!adminUser) {
        const adminHash = await bcrypt.hash(configPassword, 10);
        const insertAdmin = `
          INSERT INTO users (name, mobile, email, role, password_hash, is_verified)
          VALUES ('System Administrator', '0000000000', $1, 'admin', $2, true)
          ON CONFLICT (email) DO UPDATE SET role = 'admin'
          RETURNING *;
        `;
        const created = await db.query(insertAdmin, [configEmail, adminHash]);
        adminUser = created.rows[0];
      }

      const token = jwt.sign(
        { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Admin sign in successful',
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name || 'System Administrator',
          email: adminUser.email,
          role: adminUser.role,
        },
      });
    }

    // 2. Query registered users by Email OR Mobile
    const userRes = await db.query(
      `SELECT u.*, vp.id as vendor_profile_id, vp.business_name, vp.verification_status, vp.deposit_status
       FROM users u
       LEFT JOIN vendor_profiles vp ON u.id = vp.user_id
       WHERE LOWER(u.email) = $1 OR u.mobile = $2 OR u.mobile = $3;`,
      [cleanInput, cleanMobile, input]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email or mobile. Please check your credentials or create an account.',
      });
    }

    const user = userRes.rows[0];

    if (user.is_deleted) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated by platform administration. Please contact support.',
      });
    }

    // Check if account has a password set
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        has_password: false,
        message: 'No password has been set for this account. Please sign in using "Mobile OTP".',
      });
    }

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password.trim(), user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please verify your credentials and try again.',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, mobile: user.mobile, email: user.email },
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
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        has_password: true,
        vendor_profile: user.vendor_profile_id ? {
          id: user.vendor_profile_id,
          business_name: user.business_name,
          verification_status: user.verification_status,
          deposit_status: user.deposit_status,
        } : null,
      },
    });
  } catch (error) {
    console.error('Password Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/auth/admin-login
// Dedicated endpoint for Administrator Console authentication
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Admin email and master password are required.' });
    }

    const configEmail = (process.env.ADMIN_EMAIL || 'admin@creativehub.com').trim().toLowerCase();
    const configPassword = (process.env.ADMIN_PASSWORD || 'admin@hub2026').trim();

    if (email.trim().toLowerCase() !== configEmail || password.trim() !== configPassword) {
      return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
    }

    let adminUserRes = await db.query('SELECT * FROM users WHERE email = $1', [configEmail]);
    let adminUser = adminUserRes.rows[0];

    if (!adminUser) {
      const adminHash = await bcrypt.hash(configPassword, 10);
      const insertAdmin = `
        INSERT INTO users (name, mobile, email, role, password_hash, is_verified)
        VALUES ('System Administrator', '0000000000', $1, 'admin', $2, true)
        ON CONFLICT (email) DO UPDATE SET role = 'admin'
        RETURNING *;
      `;
      const created = await db.query(insertAdmin, [configEmail, adminHash]);
      adminUser = created.rows[0];
    }

    const token = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Admin console authenticated successfully',
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name || 'System Administrator',
        email: adminUser.email,
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/auth/users
// GET /api/v1/auth/users
// Protected: Admin / Super Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        SPLIT_PART(u.mobile, '__del__', 1) AS mobile,
        SPLIT_PART(u.email, '__deleted__', 1) AS email,
        u.role,
        u.is_verified,
        u.created_at,
        u.is_deleted,
        u.deleted_at,
        vp.id AS vendor_profile_id,
        vp.business_name,
        vp.location AS vendor_location,
        vp.verification_status,
        vp.deposit_status,
        vp.deposit_amount,
        vp.deposit_paid_at,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.customer_id = u.id) AS customer_bookings_count,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.vendor_id = vp.id) AS vendor_bookings_count
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

// DELETE /api/v1/auth/users/:id
// Protected: Admin / Super Admin only - Hard Delete for empty accounts, Soft Delete with email/mobile release for accounts with historical records
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.user.id;

    if (id === currentAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Security Protection: You cannot delete or deactivate your own administrator account.',
      });
    }

    // Check if target user exists
    const userRes = await db.query('SELECT id, name, mobile, email, role, is_deleted FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }
    const targetUser = userRes.rows[0];

    // Check if user has active or historical bookings
    const bookingsCountRes = await db.query(
      `SELECT COUNT(*)::int as count 
       FROM bookings 
       WHERE customer_id = $1 OR vendor_id IN (SELECT id FROM vendor_profiles WHERE user_id = $1);`,
      [id]
    );
    const hasBookings = Number(bookingsCountRes.rows[0]?.count || 0) > 0;

    if (!hasBookings) {
      // Hard Delete: Permanently remove the user, freeing email and mobile immediately
      await db.query('DELETE FROM reviews WHERE customer_id = $1;', [id]);
      await db.query('DELETE FROM complaints WHERE customer_id = $1;', [id]);
      await db.query('DELETE FROM messages WHERE sender_id = $1;', [id]);
      await db.query('DELETE FROM conversations WHERE customer_id = $1 OR vendor_id IN (SELECT id FROM vendor_profiles WHERE user_id = $1);', [id]);
      await db.query('DELETE FROM vendor_blackout_dates WHERE vendor_id IN (SELECT id FROM vendor_profiles WHERE user_id = $1);', [id]);
      await db.query('DELETE FROM portfolios WHERE vendor_id IN (SELECT id FROM vendor_profiles WHERE user_id = $1);', [id]);
      await db.query('DELETE FROM resources WHERE vendor_id IN (SELECT id FROM vendor_profiles WHERE user_id = $1);', [id]);
      await db.query('DELETE FROM vendor_profiles WHERE user_id = $1;', [id]);
      await db.query('DELETE FROM users WHERE id = $1;', [id]);

      return res.status(200).json({
        success: true,
        message: `User account "${targetUser.name || targetUser.mobile || targetUser.email}" has been permanently deleted and their email/mobile released.`,
      });
    } else {
      // Soft Delete: Keep booking/financial records, but release email and mobile so they can register again!
      const cleanEmail = targetUser.email ? targetUser.email.split('__deleted__')[0] : null;
      const cleanMobile = targetUser.mobile ? targetUser.mobile.split('__del__')[0] : targetUser.mobile;
      const anonymizedEmail = cleanEmail ? `${cleanEmail}__deleted__${String(targetUser.id).slice(0, 8)}` : null;
      const anonymizedMobile = `${cleanMobile}__del__${String(targetUser.id).slice(0, 8)}`;

      await db.query(
        `UPDATE users 
         SET is_deleted = true, 
             deleted_at = CURRENT_TIMESTAMP, 
             email = $1, 
             mobile = $2 
         WHERE id = $3;`,
        [anonymizedEmail, anonymizedMobile, id]
      );

      await db.query(
        "UPDATE vendor_profiles SET availability_status = 'unavailable' WHERE user_id = $1;",
        [id]
      );

      return res.status(200).json({
        success: true,
        message: `User account "${targetUser.name || targetUser.mobile || targetUser.email}" has been deactivated. Historical records are preserved, and their email is now freed for new registrations.`,
      });
    }
  } catch (error) {
    console.error('Delete User Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// PATCH /api/v1/auth/users/:id/restore
// Protected: Admin / Super Admin only - Restores deactivated user
exports.restoreUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await db.query('SELECT id, name, mobile, email, role FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }
    const targetUser = userRes.rows[0];

    let restoredEmail = targetUser.email;
    let restoredMobile = targetUser.mobile;

    if (restoredEmail && restoredEmail.includes('__deleted__')) {
      const originalEmail = restoredEmail.split('__deleted__')[0];
      const taken = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 AND (is_deleted IS NOT TRUE);',
        [originalEmail, id]
      );
      if (taken.rows.length === 0) {
        restoredEmail = originalEmail;
      }
    }

    if (restoredMobile && restoredMobile.includes('__del__')) {
      const originalMobile = restoredMobile.split('__del__')[0];
      const taken = await db.query(
        'SELECT id FROM users WHERE (mobile = $1) AND id != $2 AND (is_deleted IS NOT TRUE);',
        [originalMobile, id]
      );
      if (taken.rows.length === 0) {
        restoredMobile = originalMobile;
      }
    }

    await db.query(
      'UPDATE users SET is_deleted = false, deleted_at = NULL, email = $1, mobile = $2 WHERE id = $3;',
      [restoredEmail, restoredMobile, id]
    );

    await db.query(
      "UPDATE vendor_profiles SET availability_status = 'available' WHERE user_id = $1;",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `User account "${targetUser.name || targetUser.mobile || targetUser.email}" has been reactivated successfully.`,
    });
  } catch (error) {
    console.error('Restore User Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// Admin Login Alias for backwards compatibility
exports.adminLogin = exports.commonLogin;