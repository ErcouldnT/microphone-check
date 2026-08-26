import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_PROJECT_ID = 'f377d6e6-6992-46e0-878c-d96688e136a8';

// Configure how notifications appear when app is in foreground or background
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        badge: 1,
        data: data || {},
      },
      trigger: null, // deliver immediately
    });
  } catch (e: any) {
    console.warn('Error scheduling local notification:', e.message);
  }
}

class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;
  private permissionStatus: string = 'undetermined';

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
          sound: 'default',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.permissionStatus = finalStatus;

      if (finalStatus !== 'granted') {
        console.warn('Notification permission not granted, status:', finalStatus);
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        DEFAULT_PROJECT_ID;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      }).catch(err => {
        console.warn('Could not get expo push token:', err.message);
        return null;
      });

      if (tokenData?.data) {
        this.pushToken = tokenData.data;
        console.log('✅ Registered Push Token:', this.pushToken);
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

  public getPermissionStatus(): string {
    return this.permissionStatus;
  }

  public async sendTokenToServer(serverUrl: string, roomCode: string, deviceId: string): Promise<void> {
    try {
      let token = this.pushToken;
      if (!token) {
        token = await this.registerForPushNotificationsAsync();
      }

      if (!token || !roomCode) {
        console.log('Cannot send token to server: token or roomCode missing');
        return;
      }

      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/rooms/${encodeURIComponent(roomCode)}/register-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          pushToken: token,
          platform: Platform.OS,
        }),
      });

      const resData = await res.json();
      console.log('✅ Push token registered on server response:', resData);
    } catch (err: any) {
      console.warn('Failed to send push token to server:', err.message);
    }
  }
}

export const notificationService = NotificationService.getInstance();
