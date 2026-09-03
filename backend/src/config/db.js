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
    `;
    await pool.query(alterQuery);

    // Seed 12 Blueprint categories if missing
    const categories = [
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
      { name: 'Cinema Cameras', type: 'gear_rental', description: 'RED, ARRI, Sony FX series cinema camera bodies' },
      { name: 'Lenses & Optics', type: 'gear_rental', description: 'Cine primes, anamorphic lenses, and zoom glass' },
      { name: 'Lighting & Grip', type: 'gear_rental', description: 'Continuous lights, softboxes, and C-stands' },
      { name: 'Audio Gear', type: 'gear_rental', description: 'Wireless lavaliers, boom mics, and field recorders' }
    ];

    for (const cat of categories) {
      await pool.query(
        `INSERT INTO categories (name, type, description, status)
         SELECT $1::VARCHAR, $2::VARCHAR, $3::TEXT, 'active'
         WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1::VARCHAR);`,
        [cat.name, cat.type, cat.description]
      );
    }
  } catch (err) {
    console.error('[DB Sync Warning]:', err.message);
  }
};

syncBlueprintSchema();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};