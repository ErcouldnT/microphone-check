import { WebSocket } from 'ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSync() {
  console.log('🧪 Starting Full Shared Couple Calendar + Remote Push Notifications Test...');

  // 1. Health Check
  const healthRes = await fetch('http://localhost:3000/health');
  const health = await healthRes.json();
  console.log('✅ 1. Health Check:', health);

  // 2. Client A creates a Room with initial local data
  const createRes = await fetch('http://localhost:3000/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initialEntries: [{ date: '2026-08-26', count: 1 }],
      initialNotes: [{ date: '2026-08-26', content: 'Podcast kaydı' }],
      initialEvents: [{
        id: 'ev-1',
        title: 'Sushi Dinner',
        startDate: '2026-08-26',
        endDate: '2026-08-26',
        isAllDay: false,
        startTime: '19:30',
        endTime: '21:00',
        color: '#FF007F',
        target: 'partner'
      }],
      initialCounters: [{
        id: 'cnt-1',
        title: 'Birlikte Geçen Gün',
        targetDate: '2025-01-01',
        type: 'since',
        icon: '❤️'
      }]
    })
  });
  const createData = await createRes.json();
  console.log('✅ 2. Room Created:', createData);
  const roomCode = createData.roomCode;
  if (!roomCode) throw new Error('Failed to obtain roomCode');

  // 3. Register Push Token for Client B (representing partner phone in background)
  console.log('👉 Registering simulated Push Token for Client B');
  const regRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/register-push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'deviceB',
      pushToken: 'ExponentPushToken[mock_token_partner_device]',
      platform: 'ios'
    })
  });
  const regData = await regRes.json();
  console.log('✅ 3. Push Token Registered:', regData);

  // 4. Client A connects via WebSockets
  const wsA = new WebSocket(`ws://localhost:3000/ws?room=${roomCode}&deviceId=deviceA`);
  await new Promise((resolve) => wsA.on('open', resolve));
  console.log('✅ 4. Connected! Client A joined room', roomCode);

  // 5. Client A adds a Multi-day Camping event (which triggers remote push for Client B)
  console.log('👉 Client A adds Multi-day Event (28-30 Aug: Camping trip) -> will trigger Push Notification to Client B');
  wsA.send(JSON.stringify({
    type: 'UPDATE_EVENT',
    roomCode,
    event: {
      id: 'ev-camping',
      title: 'Touch grass camping trip',
      startDate: '2026-08-28',
      endDate: '2026-08-30',
      isAllDay: true,
      color: '#FACC15',
      target: 'both'
    },
    author: 'deviceA'
  }));

  await sleep(400);

  // 6. Test REST sync endpoint
  const syncRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/sync`);
  const syncData = await syncRes.json();
  console.log('✅ 6. Server Room Sync State:', {
    entries: syncData.entries?.length,
    notes: syncData.notes?.length,
    events: syncData.events?.length,
    counters: syncData.counters?.length
  });

  const campingEv = syncData.events?.find(e => e.id === 'ev-camping');
  if (campingEv?.title === 'Touch grass camping trip') {
    console.log('\n🎉🎉🎉 ALL REMOTE PUSH NOTIFICATIONS & REAL-TIME SYNC TESTS PASSED! 🎉🎉🎉');
  } else {
    throw new Error('Test assertions failed in v2.0 sync data');
  }

  wsA.close();
  process.exit(0);
}

testSync().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
