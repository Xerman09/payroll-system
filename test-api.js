const fs = require('fs');

async function test() {
  const env = fs.readFileSync('.env.local', 'utf8');
  let token = '';
  for (const line of env.split('\n')) {
    if (line.startsWith('DIRECTUS_TOKEN=')) token = line.split('=')[1].trim();
  }
  
  const res = await fetch('http://goatedcodoer:8091/items/benefit_logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      cutoff_id: 1,
      user_id: 1,
      benefit_code: "SSS",
      log_type: "CONTRIBUTION",
      source_amount: 100,
      deducted_amount: 100,
      payroll_run_id: 1,
      payroll_detail_id: "TEST"
    })
  });
  
  const txt = await res.text();
  console.log("STATUS:", res.status);
  console.log("BODY:", txt);
}
test();
