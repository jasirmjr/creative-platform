const db = require('./src/config/db');

async function run() {
  const res = await db.query(
    "UPDATE bookings SET status = 'confirmed' WHERE status = 'under_review' RETURNING id, status, project_name;"
  );
  console.log('Updated existing bookings to confirmed:', res.rows);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
