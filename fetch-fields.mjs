import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const token = env.split('\n').find(l => l.startsWith('DIRECTUS_TOKEN=')).split('=')[1].trim();
fetch('http://goatedcodoer:8091/fields/benefit_logs', {headers:{'Authorization': 'Bearer ' + token}})
  .then(r => r.json())
  .then(data => fs.writeFileSync('fields-meta.json', JSON.stringify(data.data, null, 2)));
