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
    experience VARCHAR(100),
    skills TEXT,
    availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN ('available', 'pending_booking', 'booked', 'unavailable')),
    pricing NUMERIC(10, 2),
    pricing_unit VARCHAR(50) DEFAULT 'day',
    profile_image TEXT,
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
    resource_id UUID REFERENCES resources(id),
    project_name VARCHAR(255),
    project_description TEXT,
    location VARCHAR(255),
    duration VARCHAR(100),
    estimated_budget NUMERIC(10, 2),
    additional_requirements TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    advance_amount NUMERIC(10, 2) DEFAULT 0,
    paid_amount NUMERIC(10, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partially_paid', 'paid', 'failed', 'refunded')),
    status VARCHAR(50) DEFAULT 'under_review',
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
    payment_type VARCHAR(50) DEFAULT 'full' CHECK (payment_type IN ('full', 'advance', 'custom', 'balance')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Safe schema alterations for existing databases
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS experience VARCHAR(100);
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS skills TEXT;
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT 'available';
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS pricing NUMERIC(10, 2);
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS pricing_unit VARCHAR(50) DEFAULT 'day';
  ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;

  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_description TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location VARCHAR(255);
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(10, 2);
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS additional_requirements TEXT;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0;
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(10, 2) DEFAULT 0;
`;

const blueprintCategories = [
  // 12 Creative Categories from Section 5 of Blueprint
  { name: 'Cinematographers', type: 'talent', description: 'Directors of Photography, camera operators, and lighting experts' },
  { name: 'Photographers', type: 'talent', description: 'Fashion, commercial, product, and portrait photographers' },
  { name: 'Script Writers', type: 'talent', description: 'Screenplay, ad copy, dialogue, and concept writers' },
  { name: 'Models', type: 'talent', description: 'Runway, commercial, screen, and fashion models' },
  { name: 'Video Editors', type: 'talent', description: 'Reel editors, long-form documentary, and commercial colorists' },
  { name: 'Graphic Designers', type: 'talent', description: 'Brand identity, visual aesthetics, UI/UX, and thumbnail artists' },
  { name: 'Creative Directors', type: 'talent', description: 'Creative direction, project vision, and campaign supervisors' },
  { name: 'Social Media Creators', type: 'talent', description: 'Short-form content creators, influencers, and viral strategists' },
  { name: 'Makeup Artists', type: 'talent', description: 'SFX, fashion editorial, bridal, and film production artists' },
  { name: 'Voice Artists', type: 'talent', description: 'Voiceovers for commercials, audiobooks, animation, and dubbing' },
  { name: 'Music and Sound Professionals', type: 'talent', description: 'Sound designers, audio mixers, Foley artists, and composers' },
  { name: 'Digital Marketing Specialists', type: 'talent', description: 'Performance marketing, media buyers, and growth campaign leads' },

  // Managed Gear Rental
  { name: 'Cinema Cameras', type: 'gear_rental', description: 'RED, ARRI, Sony FX series cinema camera bodies' },
  { name: 'Lenses & Optics', type: 'gear_rental', description: 'Cine primes, anamorphic lenses, and zoom glass' },
  { name: 'Lighting & Grip', type: 'gear_rental', description: 'Continuous lights, softboxes, and C-stands' },
  { name: 'Audio Gear', type: 'gear_rental', description: 'Wireless lavaliers, boom mics, and field recorders' },
];

const runMigrations = async () => {
  try {
    console.log('Running database migrations to match Blueprint...');
    await pool.query(createTablesQuery);
    console.log('Tables and columns updated successfully.');

    console.log('Seeding Blueprint categories...');
    for (const cat of blueprintCategories) {
      await pool.query(
        `INSERT INTO categories (name, type, description, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT DO NOTHING;`,
        [cat.name, cat.type, cat.description]
      );
    }
    console.log('Blueprint categories ready.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
};

runMigrations();