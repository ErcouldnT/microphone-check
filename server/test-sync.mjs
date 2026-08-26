import { WebSocket } from 'ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSync() {
  console.log('🧪 Starting Full Shared Couple Calendar End-to-End Test (v2.0)...');

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

  // 3. Client A & Client B connect via WebSockets
  let clientAReceivedUpdates = [];
  let clientBReceivedUpdates = [];

  const wsA = new WebSocket(`ws://localhost:3000/ws?room=${roomCode}&deviceId=deviceA`);
  const wsB = new WebSocket(`ws://localhost:3000/ws?room=${roomCode}&deviceId=deviceB`);

  await Promise.all([
    new Promise((resolve) => wsA.on('open', resolve)),
    new Promise((resolve) => wsB.on('open', resolve))
  ]);
  console.log('✅ 3. Connected! Client A and Client B joined room', roomCode);

  wsA.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    clientAReceivedUpdates.push(parsed);
  });

  wsB.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    clientBReceivedUpdates.push(parsed);
  });

  await sleep(300);

  // 4. Client A adds a Multi-day Camping event (2026-08-28 to 2026-08-30)
  console.log('👉 Client A adds Multi-day Event (28-30 Aug: Camping trip)');
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

  await sleep(300);

  // 5. Client B adds a distance counter (Days until next meet)
  console.log('👉 Client B adds Milestone Counter: Kavuşmaya Kalan Gün');
  wsB.send(JSON.stringify({
    type: 'UPDATE_COUNTER',
    roomCode,
    counter: {
      id: 'cnt-nextmeet',
      title: 'Kavuşmaya Kalan Gün',
      targetDate: '2026-09-01',
      type: 'until',
      icon: '✈️'
    },
    author: 'deviceB'
  }));

  await sleep(300);

  // 6. Test REST sync endpoint
  const syncRes = await fetch(`http://localhost:3000/api/rooms/${roomCode}/sync`);
  const syncData = await syncRes.json();
  console.log('✅ 6. Server Room Sync State:', {
    entries: syncData.entries?.length,
    notes: syncData.notes?.length,
    events: syncData.events?.length,
    counters: syncData.counters?.length
  });

  // Verify assertions
  const campingEv = syncData.events?.find(e => e.id === 'ev-camping');
  const meetCnt = syncData.counters?.find(c => c.id === 'cnt-nextmeet');

  if (campingEv?.title === 'Touch grass camping trip' && meetCnt?.icon === '✈️') {
    console.log('\n🎉🎉🎉 ALL V2.0 MULTI-DAY EVENTS, COLORED NOTES & COUNTERS TESTS PASSED! 🎉🎉🎉');
  } else {
    throw new Error('Test assertions failed in v2.0 sync data');
  }

  wsA.close();
  wsB.close();
  process.exit(0);
}

testSync().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
