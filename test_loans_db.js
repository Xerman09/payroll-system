const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vos_database'
  });
  
  // What happens if we try to insert two loans for the same user, cutoff, benefit, but DIFFERENT run?
  try {
     const [rows] = await db.execute('SELECT * FROM benefit_logs WHERE log_type="LOAN" AND user_id=176 LIMIT 5');
     console.log('Existing LOANs for user 176:', rows);
  } catch (e) {
     console.error(e);
  }
  db.end();
}
run();
