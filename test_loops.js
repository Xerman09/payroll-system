async function run() {
  const res = await fetch('http://goatedcodoer:8056/items/benefit_logs?filter[log_type][_eq]=LOAN&fields=benefit_log_id,user_id,benefit_code,loan_id,payroll_run_id,cutoff_id&limit=2&sort=-benefit_log_id');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
