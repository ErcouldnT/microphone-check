export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendExpoPushNotifications(
  tokens: string[],
  payload: PushMessagePayload
): Promise<void> {
  if (!tokens || tokens.length === 0) return;

  const validTokens = Array.from(
    new Set(
      tokens.filter(
        t => t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
      )
    )
  );
  if (validTokens.length === 0) return;

  const messages = validTokens.map(to => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    priority: 'high',
    badge: 1,
    channelId: 'default',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('Expo Push notification dispatched to', validTokens.length, 'tokens:', result);
  } catch (err: any) {
    console.error('Error sending Expo push notifications:', err.message);
  }
}
