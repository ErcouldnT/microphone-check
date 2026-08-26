import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async registerForPushNotificationsAsync(): Promise<string | null> {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Microphone Check Calendar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FFFF',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      }).catch(err => {
        console.warn('Could not get expo push token:', err.message);
        return null;
      });

      if (tokenData?.data) {
        this.pushToken = tokenData.data;
        console.log('Registered Push Token:', this.pushToken);
        return this.pushToken;
      }

      return null;
    } catch (e: any) {
      console.warn('Error registering push notifications:', e.message);
      return null;
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  public async sendTokenToServer(serverUrl: string, roomCode: string, deviceId: string): Promise<void> {
    try {
      let token = this.pushToken;
      if (!token) {
        token = await this.registerForPushNotificationsAsync();
      }

      if (!token || !roomCode) return;

      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      await fetch(`${cleanUrl}/api/rooms/${encodeURIComponent(roomCode)}/register-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          pushToken: token,
          platform: Platform.OS,
        }),
      });
      console.log('Push token successfully registered with server for room', roomCode);
    } catch (err: any) {
      console.warn('Failed to send push token to server:', err.message);
    }
  }
}

export const notificationService = NotificationService.getInstance();
