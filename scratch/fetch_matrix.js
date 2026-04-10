const http = require('http');

http.get('http://localhost:9001/api/wage-matrix', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Matrix Items:', json.matrix);
      console.log('Staff Items:', json.staff);
      // console.log('Vehicle Types:', json.vehicleTypes.slice(0, 2));
    } catch (e) {
      console.error('Error parsing JSON', e);
    }
  });
}).on('error', err => console.error(err));
