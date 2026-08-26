async function debugPush() {
  console.log('1. Fetching registered push tokens from cal.erkut.dev...');
  
  // We can get the push token by registering or query test endpoint
  // Let's trigger /api/test-push and inspect
  // Or query room push tokens
  const joinRes = await fetch('https://cal.erkut.dev/api/rooms/MIC-GERW/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: 'MIC-GERW' })
  });
  const roomData = await joinRes.json();
  console.log('Room roomId:', roomData.roomId);

  // Let's test registering a known token or inspect token on device
}
debugPush();
