
async function testApi() {
  const url = 'http://localhost:9001/api/payroll-run?resource=payroll_run_access_log';
  const payload = {
    payload: {
      opened_by: 1,
      cutoff_id: 1,
      department_id: null,
      remarks: "Test access log from script"
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Status:', res.status, res.statusText);
    const json = await res.json().catch(() => null);
    console.log('JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testApi();
