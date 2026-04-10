
async function check() {
  try {
    const res = await fetch('http://localhost:9002/api/wage-matrix');
    const data = await res.json();
    console.log(JSON.stringify(data.vehicleTypes, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
