async function run() {
  const res = await fetch('http://goatedcodoer:8056/items/benefit_logs?fields=benefit_log_id,id,user_id,benefit_code&limit=5&sort=-benefit_log_id');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
