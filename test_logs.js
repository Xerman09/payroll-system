const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vos_database'
  });
  const [rows] = await db.execute('SELECT * FROM benefit_logs ORDER BY benefit_log_id DESC LIMIT 5');
  console.log(rows);
  db.end();
}
run();
