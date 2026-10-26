import React, { useState, useRef } from 'react';
import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Users, ClipboardCheck, PieChart } from '@tamagui/lucide-icons';
import * as SecureStore from 'expo-secure-store';
import { useAppColors } from '../context/ThemeContext';
import { AppText, Button, Screen } from '../components/ui';
import { motion, radius, space } from '../theme/tokens';

const ONBOARDING_SLIDES = [
  {
    title: 'Church Directory',
    description: 'Keep track of all members, contact details, profile summaries, zones, and registration records inside a single native dashboard.',
    icon: Users,
  },
  {
    title: 'Attendance Tracker',
    description: 'Easily track general service attendance headcounts, check-in members, register visitors, and monitor active participation history.',
    icon: ClipboardCheck,
  },
  {
    title: 'Giving & Finances',
    description: 'Record general tithes, thanksgiving offerings, special project logs, and capture expense receipts using your phone camera.',
    icon: PieChart,
  },
];

function Dot({ active }: { active: boolean }) {
  const c = useAppColors();
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 24 : 8, { duration: motion.base }),
    opacity: withTiming(active ? 1 : 0.45, { duration: motion.base }),
  }), [active]);
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active ? c.primary.base : c.borderStrong }, style]} />;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const c = useAppColors();
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const isLast = activeIndex === ONBOARDING_SLIDES.length - 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setActiveIndex(index);
  };

  const handleComplete = async () => {
    try {
      await SecureStore.setItemAsync('has_onboarded', 'true');
      router.replace('/');
    } catch (e) {
      router.replace('/');
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.md, minHeight: 48 }}>
        {!isLast ? <Button label="Skip" variant="ghost" size="sm" onPress={handleComplete} /> : null}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {ONBOARDING_SLIDES.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <View
              key={index}
              style={{ width, paddingHorizontal: space.xxl, alignItems: 'center', justifyContent: 'center', gap: space.lg }}
              accessible
              accessibilityLabel={`${slide.title}. ${slide.description}`}
            >
              <View
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: 40,
                  backgroundColor: c.primary.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: space.sm,
                }}
              >
                <Icon size={56} color={c.primary.text} />
              </View>
              <AppText variant="display" align="center">{slide.title}</AppText>
              <AppText variant="body" tone="muted" align="center" style={{ fontSize: 16, lineHeight: 24, maxWidth: 340 }}>
                {slide.description}
              </AppText>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={`Page ${activeIndex + 1} of ${ONBOARDING_SLIDES.length}`}>
          {ONBOARDING_SLIDES.map((_, index) => <Dot key={index} active={index === activeIndex} />)}
        </View>
        <View style={{ width: '100%', borderRadius: radius.md }}>
          <Button
            label={isLast ? 'Get started' : 'Next'}
            fullWidth
            onPress={() => {
              if (!isLast) {
                scrollViewRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
              } else {
                handleComplete();
              }
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
