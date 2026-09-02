const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const createTablesQuery = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    mobile VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'admin', 'super_admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('talent', 'gear_rental')),
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('service', 'gear')),
    base_price NUMERIC(10, 2) NOT NULL,
    pricing_unit VARCHAR(50) DEFAULT 'day' CHECK (pricing_unit IN ('hour', 'day', 'project')),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    media_url TEXT NOT NULL,
    media_type VARCHAR(50) CHECK (media_type IN ('image', 'video', 'document')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id),
    resource_id UUID NOT NULL REFERENCES resources(id),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (
      status IN ('pending_checkout', 'under_review', 'approved', 'confirmed', 'in_progress', 'completed', 'cancelled')
    ),
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(255) UNIQUE,
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    await pool.query(createTablesQuery);
    console.log('Tables created successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
};

runMigrations();