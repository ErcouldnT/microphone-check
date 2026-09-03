import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete?: () => void;
}

const RING_COUNT = 3;
const RING_BASE_SIZE = 200;

/**
 * Launch screen.
 *
 * The glow is built from concentric rings that expand and fade rather than a
 * blurred disc — React Native has no blur filter, so the previous flat circle
 * simply sat behind the logo as a solid tint and fought its own colours.
 */
export default function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  const fade = useSharedValue(1);
  const logoScale = useSharedValue(0.62);
  const logoLift = useSharedValue(18);
  const pulse = useSharedValue(0);
  const titleReveal = useSharedValue(0);
  const subtitleReveal = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exitScale = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 11, stiffness: 110, mass: 0.9 });
    logoLift.value = withSpring(0, { damping: 14, stiffness: 120 });

    // Rings breathe continuously until the app is ready.
    pulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );

    titleReveal.value = withDelay(
      220,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    );
    subtitleReveal.value = withDelay(
      420,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    );

    // Loading bar shuttles left/right while services start up.
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
  }, [logoLift, logoScale, pulse, sweep, subtitleReveal, titleReveal]);

  useEffect(() => {
    if (!isReady) return;

    // Ease out by pushing the mark slightly toward the viewer, so the splash
    // reads as opening into the app rather than simply disappearing.
    const timer = setTimeout(() => {
      exitScale.value = withTiming(1.08, { duration: 460, easing: Easing.in(Easing.cubic) });
      fade.value = withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }, finished => {
        if (finished && onAnimationComplete) runOnJS(onAnimationComplete)();
      });
    }, 420);

    return () => clearTimeout(timer);
  }, [isReady, exitScale, fade, onAnimationComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: exitScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }, { translateY: logoLift.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleReveal.value,
    transform: [{ translateY: interpolate(titleReveal.value, [0, 1], [14, 0]) }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleReveal.value * 0.85,
    transform: [{ translateY: interpolate(subtitleReveal.value, [0, 1], [10, 0]) }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-46, 46]) }],
  }));

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents={isReady ? 'none' : 'auto'}
    >
      <View style={styles.stage}>
        {Array.from({ length: RING_COUNT }).map((_, index) => (
          <Ring key={index} index={index} pulse={pulse} />
        ))}

        <Animated.View style={[styles.logoWrapper, logoStyle]}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Animated.View style={titleStyle}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.titleCyan]}>MICROPHONE</Text>
          <Text style={[styles.title, styles.titlePink]}>CHECK</Text>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.subtitle, subtitleStyle]}>
        SHARED COUPLE CALENDAR
      </Animated.Text>

      <View style={styles.track}>
        <Animated.View style={[styles.sweep, sweepStyle]} />
      </View>
    </Animated.View>
  );
}

/** One expanding halo ring, offset in time from its siblings. */
function Ring({
  index,
  pulse,
}: {
  index: number;
  pulse: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // Stagger the ring phases so they trail one another outward.
    const phase = (pulse.value + index / RING_COUNT) % 1;
    return {
      opacity: interpolate(phase, [0, 0.15, 1], [0, 0.42, 0]),
      transform: [{ scale: interpolate(phase, [0, 1], [0.72, 1.55]) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        // Alternate the brand colours so the halo carries both, instead of
        // tinting the mark with a single clashing hue.
        { borderColor: index % 2 === 0 ? '#00FFFF' : '#FF007F' },
        style,
      ]}
    />
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
  stage: {
    width: RING_BASE_SIZE,
    height: RING_BASE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 34,
  },
  ring: {
    position: 'absolute',
    width: RING_BASE_SIZE,
    height: RING_BASE_SIZE,
    borderRadius: RING_BASE_SIZE / 2,
    borderWidth: 1.5,
  },
  logoWrapper: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 150,
    height: 150,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
  },
  titleCyan: {
    color: '#00FFFF',
  },
  titlePink: {
    color: '#FF007F',
    marginLeft: 8,
  },
  subtitle: {
    marginTop: 10,
    color: '#8A8A94',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3.5,
  },
  track: {
    marginTop: 30,
    width: 108,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#16161D',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sweep: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#00FFFF',
  },
});
