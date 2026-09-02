const { pool } = require('./db');

async function seedResources() {
  try {
    console.log('Seeding sample talent and rental equipment...');

    // 1. Create a dummy verified vendor user
    const vendorUser = await pool.query(`
      INSERT INTO users (name, mobile, email, role, is_verified)
      VALUES ('Arjun Sharma', '9876500001', 'arjun@creatives.io', 'vendor', true)
      ON CONFLICT (mobile) DO UPDATE SET is_verified = true
      RETURNING id;
    `);
    const userId = vendorUser.rows[0].id;

    // 2. Create verified vendor profile
    const vendorProfile = await pool.query(`
      INSERT INTO vendor_profiles (user_id, business_name, bio, location, verification_status)
      VALUES ($1, 'Cinematic Vision Studios', 'Award-winning cinematographer and cinema camera rental house.', 'Mumbai, India', 'verified')
      ON CONFLICT (user_id) DO UPDATE SET verification_status = 'verified'
      RETURNING id;
    `, [userId]);
    const vendorId = vendorProfile.rows[0].id;

    // 3. Look up Categories
    const cineCategory = await pool.query(`SELECT id FROM categories WHERE name = 'Cinematographers' LIMIT 1;`);
    const editorCategory = await pool.query(`SELECT id FROM categories WHERE name = 'Video Editors' LIMIT 1;`);
    const cameraCategory = await pool.query(`SELECT id FROM categories WHERE name = 'Cinema Cameras' LIMIT 1;`);

    // 4. Insert Sample Resources (Talent + Gear)
    if (cineCategory.rows.length > 0) {
      await pool.query(`
        INSERT INTO resources (vendor_id, category_id, title, description, resource_type, base_price, pricing_unit, status)
        VALUES ($1, $2, 'Commercial & Music Video DoP', 'Experienced with ARRI, RED, high-speed lighting, and narrative fiction.', 'service', 25000.00, 'day', 'available');
      `, [vendorId, cineCategory.rows[0].id]);
    }

    if (editorCategory.rows.length > 0) {
      await pool.query(`
        INSERT INTO resources (vendor_id, category_id, title, description, resource_type, base_price, pricing_unit, status)
        VALUES ($1, $2, 'Senior DaVinci Resolve Colorist & Editor', 'Specializing in TV commercials, reel grading, and pacing cuts.', 'service', 12000.00, 'project', 'available');
      `, [vendorId, editorCategory.rows[0].id]);
    }

    if (cameraCategory.rows.length > 0) {
      await pool.query(`
        INSERT INTO resources (vendor_id, category_id, title, description, resource_type, base_price, pricing_unit, status)
        VALUES ($1, $2, 'Sony FX3 Cinema Kit (Full Package)', 'Includes 24-70mm GM II lens, 4x batteries, Ninja V monitor, and Pelican case.', 'gear', 6500.00, 'day', 'available');
      `, [vendorId, cameraCategory.rows[0].id]);
    }

    console.log('Sample talent and equipment seeded successfully.');
  } catch (err) {
    console.error('Resource seeding failed:', err);
  } finally {
    await pool.end();
  }
}

seedResources();