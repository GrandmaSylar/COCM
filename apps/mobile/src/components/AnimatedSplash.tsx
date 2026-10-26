import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SplashScreen } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, neutrals } from '../theme/tokens';

/**
 * Animated continuation of the native splash screen.
 *
 * Its first frame is identical to the native splash (same background, logo
 * size and position, see the expo-splash-screen plugin in app.json), so hiding
 * the native splash is invisible. The seal then settles upward, the wordmark
 * fades in beneath it, and once the app is ready the whole layer fades away.
 * Motion is eased and never springy; with Reduce Motion on it only fades.
 */

const LOGO = require('../../assets/splash-logo.png');
const LOGO_W = 180; // expo-splash-screen imageWidth
const LOGO_H = Math.round((LOGO_W * 527) / 540);
const NATIVE_BG = { light: '#FFFFFF', dark: '#0F1115' } as const;
const BRAND = '#DC2626';

const SETTLED_LIFT = -60;
const SETTLED_SCALE = 0.72;
const MIN_VISIBLE_MS = 1500;
const MAX_WAIT_MS = 6000;
const EXIT_MS = 420;
const BAR_TRACK = 104;
const BAR_SEGMENT = 36;

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);

export interface AnimatedSplashProps {
  /** True once the app can be shown (local database ready). */
  ready: boolean;
  onDone: () => void;
}

export function AnimatedSplash({ ready, onDone }: AnimatedSplashProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const n = neutrals[scheme];
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const mountedAt = useRef(Date.now());
  const nativeHidden = useRef(false);
  const [exiting, setExiting] = useState(false);

  const lift = useSharedValue(0); // 0 = native splash position, 1 = settled
  const words = useSharedValue(0);
  const halo = useSharedValue(0);
  const bar = useSharedValue(0);
  const exit = useSharedValue(0);

  const startIntro = () => {
    if (reduceMotion) {
      lift.value = 1;
      words.value = withTiming(1, { duration: 240 });
      return;
    }
    lift.value = withDelay(120, withTiming(1, { duration: 700, easing: easeInOut }));
    words.value = withDelay(420, withTiming(1, { duration: 520, easing: easeOut }));
    halo.value = withDelay(650, withRepeat(withTiming(1, { duration: 1800, easing: easeOut }), -1, false));
    bar.value = withRepeat(withTiming(1, { duration: 1100, easing: easeInOut }), -1, false);
  };

  // Swap out the native splash once our identical first frame is on screen.
  const hideNativeSplash = () => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
    startIntro();
  };

  useEffect(() => {
    const fallback = setTimeout(hideNativeSplash, 800);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (exiting) return;
    const finish = () => {
      hideNativeSplash();
      setExiting(true);
      const duration = reduceMotion ? 200 : EXIT_MS;
      exit.value = withTiming(1, { duration, easing: easeOut });
      setTimeout(() => {
        cancelAnimation(halo);
        cancelAnimation(bar);
        onDone();
      }, duration + 20);
    };
    const wait = ready ? Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current)) : MAX_WAIT_MS;
    const timer = setTimeout(finish, wait);
    return () => clearTimeout(timer);
  }, [ready, exiting]);

  const layerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + exit.value * 0.04 }] }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value * SETTLED_LIFT },
      { scale: 1 - lift.value * (1 - SETTLED_SCALE) },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - halo.value) * 0.32 * lift.value,
    transform: [{ scale: 1 + halo.value * 0.42 }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * 10 }],
  }));
  const footerStyle = useAnimatedStyle(() => ({ opacity: words.value }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -BAR_SEGMENT + bar.value * (BAR_TRACK + BAR_SEGMENT) }],
  }));

  return (
    <Animated.View
      pointerEvents={exiting ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, { backgroundColor: NATIVE_BG[scheme], zIndex: 100 }, layerStyle]}
      accessible
      accessibilityLabel="Church of Christ Mataheko. Loading"
    >
      <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
        {/* Seal: starts exactly where the native splash draws it */}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Animated.View style={[styles.center, { width: LOGO_W, height: LOGO_H }, logoStyle]}>
            <Animated.View
              style={[
                { position: 'absolute', width: LOGO_W, height: LOGO_W, borderRadius: LOGO_W / 2, borderWidth: 2, borderColor: BRAND },
                haloStyle,
              ]}
            />
            <Image source={LOGO} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" onLoad={hideNativeSplash} fadeDuration={0} />
          </Animated.View>
        </View>

        {/* Wordmark under the settled seal */}
        <Animated.View style={[styles.words, wordsStyle]}>
          <Text style={{ fontFamily: fonts.headingStrong, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: n.text }}>
            Church of Christ
          </Text>
          <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 4, color: BRAND, marginTop: 4 }}>
            MATAHEKO
          </Text>
        </Animated.View>

        {/* Loading indicator and verse */}
        <Animated.View style={[styles.footer, { bottom: insets.bottom + 48 }, footerStyle]}>
          {!reduceMotion ? (
            <View style={{ width: BAR_TRACK, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: n.border }}>
              <Animated.View style={[{ width: BAR_SEGMENT, height: 3, borderRadius: 2, backgroundColor: BRAND }, barStyle]} />
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: n.textSubtle, marginTop: 14 }}>
            Repent and be baptised · Acts 2:38
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}


const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    // Settled seal bottom ≈ SETTLED_LIFT + (LOGO_H * SETTLED_SCALE) / 2 ≈ +3
    marginTop: 22,
    alignItems: 'center',
  },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
