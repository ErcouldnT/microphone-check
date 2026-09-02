import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';
import { initDb } from '@/db/client';
import { syncService } from '@/services/syncService';

import { notificationService } from '@/services/notificationService';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { useState } from 'react';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    initDb()
      .then(() => syncService.init())
      .then(() => setAppReady(true))
      .catch(e => {
        console.error("Init Error:", e);
        setAppReady(true);
      });

    // Registering for push talks to FCM/APNs and can take tens of seconds (or
    // hang) when the service is unreachable, so it must not gate first paint.
    notificationService
      .registerForPushNotificationsAsync()
      .catch(e => console.warn("Push registration failed:", e?.message));
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && appReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, appReady]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <RootLayoutNav />
      {!splashFinished && (
        <AnimatedSplashScreen
          isReady={appReady && loaded}
          onAnimationComplete={() => setSplashFinished(true)}
        />
      )}
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
