async function run() {
  const res = await fetch('http://goatedcodoer:8056/items/benefit_logs?limit=1');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
