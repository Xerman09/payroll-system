const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vos_database'
  });
  const [rows] = await db.execute(`
    SELECT column_name
    FROM information_schema.statistics
    WHERE table_schema = 'vos_database'
      AND table_name = 'benefit_logs'
      AND index_name = 'uq_blog_unique'
    ORDER BY seq_in_index;
  `);
  console.log(rows);
  db.end();
}
run();
