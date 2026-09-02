const { pool } = require('./db');

const initialCategories = [
  // Talent categories
  { name: 'Cinematographers', type: 'talent', description: 'Directors of Photography, camera operators, and lighting experts' },
  { name: 'Video Editors', type: 'talent', description: 'Reel editors, long-form documentary, and commercial colorists' },
  { name: 'Photographers', type: 'talent', description: 'Fashion, commercial, and product photographers' },
  { name: 'Models & Actors', type: 'talent', description: 'Runway, commercial, and screen models' },
  { name: 'Script Writers', type: 'talent', description: 'Screenplay, ad copy, and dialogue writers' },
  { name: 'Graphic Designers', type: 'talent', description: 'Brand identity, UI/UX, and thumbnail artists' },
  { name: 'Voice Artists', type: 'talent', description: 'Voiceovers for commercials, audiobooks, and dubbing' },

  // Gear & Rental categories
  { name: 'Cinema Cameras', type: 'gear_rental', description: 'RED, ARRI, Sony FX series cinema camera bodies' },
  { name: 'Lenses & Optics', type: 'gear_rental', description: 'Cine primes, anamorphic lenses, and zoom glass' },
  { name: 'Lighting & Grip', type: 'gear_rental', description: 'Continuous lights, softboxes, and C-stands' },
  { name: 'Audio Gear', type: 'gear_rental', description: 'Wireless lavaliers, boom mics, and field recorders' }
];

async function seed() {
  try {
    console.log('Seeding initial categories...');
    for (const cat of initialCategories) {
      await pool.query(
        `INSERT INTO categories (name, type, description, status)
         VALUES ($1, $2, $3, 'active');`,
        [cat.name, cat.type, cat.description]
      );
    }
    console.log('Categories seeded successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
  }
}

seed();