const http = require('http');

http.get('http://goatedcodoer:8090/items/overtime_request?limit=1', {
  headers: {
    'Authorization': 'Bearer NA9FAMvBr45KWDsu_YRuT77vNpGyGNZi'
  }
}, (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    console.log("Response:", data);
  });
}).on("error", (err) => {
  console.log("Error:", err.message);
});
