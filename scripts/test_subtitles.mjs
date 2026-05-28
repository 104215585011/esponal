// Timestamp: 2026-05-28 10:05
async function main() {
  const url = 'http://127.0.0.1:3000/api/subtitle?v=dQw4w9WgXcQ';
  console.log('Querying:', url);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log('Response keys:', Object.keys(json));
    console.log('Cues count:', json.cues ? json.cues.length : 'undefined');
    if (json.hint) {
      console.log('Hint:', json.hint);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
main();
