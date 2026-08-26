import { WebSocket } from 'ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSync() {
  console.log('🧪 Starting Real-Time Sync & Notes End-to-End Test...');

  // 1. Health Check
  const healthRes = await fetch('http://localhost:3000/health');
  const health = await healthRes.json();
  console.log('✅ Health Check Response:', health);

  // 2. Client A creates a Room with initial local data and notes
  const createRes = await fetch('http://localhost:3000/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initialEntries: [
        { date: '2026-08-26', count: 1 }
      ],
      initialNotes: [
        { date: '2026-08-26', content: 'Podcast kaydı' }
      ]
    })
  });
  const createData = await createRes.json();
  console.log('✅ Room Created:', createData);
  const roomCode = createData.roomCode;

  if (!roomCode) throw new Error('Failed to obtain roomCode');

  // 3. Client A & Client B connect via WebSockets
  let clientAReceivedUpdates = [];
  let clientBReceivedUpdates = [];

  const wsA = new WebSocket(`ws://localhost:3000/ws?room=${roomCode}&deviceId=deviceA`);
  const wsB = new WebSocket(`ws://localhost:3000/ws?room=${roomCode}&deviceId=deviceB`);

  await Promise.all([
    new Promise((resolve) => wsA.on('open', resolve)),
    new Promise((resolve) => wsB.on('open', resolve))
  ]);
  console.log('✅ Both Client A and Client B connected to WebSocket room', roomCode);

  wsA.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    console.log('📩 [Client A received]:', parsed);
    clientAReceivedUpdates.push(parsed);
  });

  wsB.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    console.log('📩 [Client B received]:', parsed);
    clientBReceivedUpdates.push(parsed);
  });

  await sleep(300);

  // 4. Client A updates note on 2026-08-26
  console.log('👉 Client A updates note for 2026-08-26');
  wsA.send(JSON.stringify({
    type: 'UPDATE_NOTE',
    roomCode,
    date: '2026-08-26',
    content: 'Canlı yayın ve podcast kaydı',
    author: 'deviceA'
  }));

  await sleep(300);

  // 5. Client B adds count on 2026-08-27 -> count: 3
  console.log('👉 Client B adds 2026-08-27 -> count: 3');
  wsB.send(JSON.stringify({
    type: 'UPDATE_SESSION',
    roomCode,
    date: '2026-08-27',
    count: 3,
    author: 'deviceB'
  }));

  await sleep(300);

  // 6. Test REST sync endpoint
  const syncRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/sync`);
  const syncData = await syncRes.json();
  console.log('✅ Room State on Server:', syncData);

  // Assertions
  const date26Note = syncData.notes?.find(n => n.date === '2026-08-26');
  const date27Entry = syncData.entries?.find(e => e.date === '2026-08-27');

  if (date26Note?.content === 'Canlı yayın ve podcast kaydı' && date27Entry?.count === 3) {
    console.log('🎉🎉🎉 ALL REAL-TIME SESSIONS & NOTES SYNC TESTS PASSED! 🎉🎉🎉');
  } else {
    throw new Error('Test assertions failed: mismatch in sync data');
  }

  wsA.close();
  wsB.close();
  process.exit(0);
}

testSync().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
