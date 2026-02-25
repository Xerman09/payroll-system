const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vos_database'
  });
  const [rows] = await db.execute('SELECT user_id, breakdown_json FROM payroll_run_employee WHERE payroll_run_id = 71 LIMIT 1');
  const json = JSON.parse(rows[0].breakdown_json);
  console.log(JSON.stringify(json.deductions.benefit_loans, null, 2));
  db.end();
}
run();
