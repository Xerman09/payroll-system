async function run() {
  const res = await fetch('http://goatedcodoer:8056/items/payroll_run_employee?filter[payroll_run_id][_eq]=71&fields=user_id,breakdown_json&limit=1');
  const json = await res.json();
  const breakdown = typeof json.data[0].breakdown_json === 'string' ? JSON.parse(json.data[0].breakdown_json) : json.data[0].breakdown_json;
  console.log(JSON.stringify(breakdown.deductions.benefit_loans, null, 2));
}
run();
