import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete?: () => void;
}

export default function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.85);
  const glow = useSharedValue(0.4);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Initial logo scale-in and glow pulsing
    scale.value = withSpring(1, { damping: 12, stiffness: 90 });
    textOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });

    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (isReady) {
      // 2. Smooth fade-out when app services are loaded
      const timer = setTimeout(() => {
        opacity.value = withTiming(
          0,
          { duration: 500, easing: Easing.out(Easing.ease) },
          (finished) => {
            if (finished && onAnimationComplete) {
              runOnJS(onAnimationComplete)();
            }
          }
        );
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents={isReady ? 'none' : 'auto'}>
      <View className="items-center justify-center">
        {/* Glow backdrop circle */}
        <View className="absolute w-64 h-64 rounded-full bg-neonCyan/10 blur-2xl" />

        {/* Animated Cyber Ninja Logo */}
        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Title & Slogan */}
        <Animated.View style={[styles.textWrapper, textStyle]}>
          <View className="flex-row items-center justify-center">
            <Text className="text-3xl font-extrabold text-neonCyan tracking-wider">MICROPHONE</Text>
            <Text className="text-3xl font-extrabold text-neonPink tracking-wider ml-1">CHECK</Text>
          </View>
          <Text className="text-gray-400 text-xs font-semibold tracking-widest uppercase mt-2 text-center">
            Shared Couple Calendar
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  logoWrapper: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  logoImage: {
    width: 170,
    height: 170,
  },
  textWrapper: {
    alignItems: 'center',
  },
});
