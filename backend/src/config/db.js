const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
});

// Auto-sync schema and Blueprint categories on startup
const syncBlueprintSchema = async () => {
  try {
    const alterQuery = `
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS experience VARCHAR(100);
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS skills TEXT;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT 'available';
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS pricing NUMERIC(10, 2);
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS pricing_unit VARCHAR(50) DEFAULT 'day';
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10, 2) DEFAULT 2000.00;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS deposit_order_id VARCHAR(255);
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS deposit_payment_id VARCHAR(255);

      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_description TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(10, 2);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS additional_requirements TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor_profiles(id);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
      ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending_checkout', 'under_review', 'approved', 'confirmed', 'in_progress', 'deliverables_submitted', 'completed', 'cancelled', 'rejected'));
      ALTER TABLE vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_verified_by_fkey;
      ALTER TABLE vendor_profiles ADD CONSTRAINT vendor_profiles_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
      ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_vendor_id_fkey;
      ALTER TABLE bookings ADD CONSTRAINT bookings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendor_profiles(id) ON DELETE CASCADE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;
      ALTER TABLE users ALTER COLUMN mobile TYPE VARCHAR(64);
      ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'advance';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor_profiles(id) ON DELETE CASCADE;
      ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL;
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_razorpay_order_id_key;
      CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_booking_idx ON payments (razorpay_order_id, booking_id);

      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS warning_strikes INT DEFAULT 0;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS strike_history JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS last_strike_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50) DEFAULT 'mid';

      ALTER TABLE categories ADD COLUMN IF NOT EXISTS min_daily_rate NUMERIC(10, 2) DEFAULT 1000.00;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS max_daily_rate NUMERIC(10, 2) DEFAULT 60000.00;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS recommended_daily_rate NUMERIC(10, 2) DEFAULT 15000.00;

      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS claimed_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS desired_resolution_type VARCHAR(50) DEFAULT 'partial_refund';
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS desired_resolution_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS desired_resolution_details TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vendor_offer_type VARCHAR(50);
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vendor_offer_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vendor_offer_details TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS settlement_agreed BOOLEAN DEFAULT FALSE;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS settlement_agreed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS settlement_type VARCHAR(50);
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS settlement_notes TEXT;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255);
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE complaints ADD COLUMN IF NOT EXISTS vendor_payout_amount NUMERIC(10, 2) DEFAULT 0;

      CREATE TABLE IF NOT EXISTS otps (
        mobile VARCHAR(30) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_booking_review UNIQUE (booking_id)
      );

      CREATE TABLE IF NOT EXISTS vendor_blackout_dates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason VARCHAR(255) DEFAULT 'Unavailable / Busy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_blackout_vendor_dates 
      ON vendor_blackout_dates(vendor_id, start_date, end_date);

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        type VARCHAR(50) DEFAULT 'customer_vendor',
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE conversations ALTER COLUMN customer_id DROP NOT NULL;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'customer_vendor';

      CREATE INDEX IF NOT EXISTS idx_conv_customer ON conversations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_conv_vendor ON conversations(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_conv_admin ON conversations(admin_id);
      CREATE INDEX IF NOT EXISTS idx_conv_type ON conversations(type);
      CREATE INDEX IF NOT EXISTS idx_conv_booking ON conversations(booking_id);
      CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON conversations(last_message_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_admin_vendor_conv ON conversations(vendor_id) WHERE type = 'admin_vendor';

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_role VARCHAR(50) NOT NULL,
        message TEXT,
        file_url TEXT,
        file_name VARCHAR(255),
        file_type VARCHAR(50),
        file_size BIGINT,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_msg_unread ON messages(conversation_id, is_read);

      CREATE TABLE IF NOT EXISTS complaints (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        complaint_number VARCHAR(50) UNIQUE NOT NULL,
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        desired_resolution VARCHAR(100) NOT NULL,
        attachment_url TEXT,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'under_vendor_review', 'vendor_responded', 'resolved', 'dismissed')),
        vendor_response TEXT,
        vendor_responded_at TIMESTAMP WITH TIME ZONE,
        vendor_attachment_url TEXT,
        resolution_notes TEXT,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_vendor ON complaints(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_booking ON complaints(booking_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);

      CREATE TABLE IF NOT EXISTS complaint_replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_role VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        attachment_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_complaint_replies_comp ON complaint_replies(complaint_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS project_deliverables (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        deliverable_type VARCHAR(50) NOT NULL DEFAULT 'cloud_link',
        file_url TEXT NOT NULL,
        file_name VARCHAR(255),
        file_size BIGINT,
        file_type VARCHAR(50) DEFAULT 'cloud_suite',
        access_credentials TEXT,
        version INT NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        client_feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_deliverables_booking ON project_deliverables(booking_id);
      CREATE INDEX IF NOT EXISTS idx_deliverables_vendor ON project_deliverables(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_deliverables_status ON project_deliverables(status);

      ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS vendor_reply TEXT;
      ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS vendor_replied_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_balance_reminder_at TIMESTAMP WITH TIME ZONE;
    `;
    await pool.query(alterQuery);

  } catch (err) {
    console.error('[DB Sync Warning]:', err.message);
  }
};

syncBlueprintSchema();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};