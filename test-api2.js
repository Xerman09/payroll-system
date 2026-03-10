const fs = require('fs');
async function test() {
  const res = await fetch('http://goatedcodoer:8091/fields/benefit_logs', {
    headers: { 'Authorization': 'Bearer ' + fs.readFileSync('.env.local', 'utf8').match(/DIRECTUS_TOKEN=(.*)/)[1].trim() }
  });
  console.log(await res.text());
}
test();
