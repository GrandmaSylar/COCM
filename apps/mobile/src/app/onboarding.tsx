import React, { useState, useRef } from 'react';
import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Button, Card, H1, Paragraph } from 'tamagui';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

const ONBOARDING_SLIDES = [
  {
    title: 'Church Directory',
    description: 'Keep track of all members, contact details, profile summaries, zones, and registration records inside a single native dashboard.',
    icon: '👥',
  },
  {
    title: 'Attendance Tracker',
    description: 'Easily track general service attendance headcounts, check-in members, register visitors, and monitor active participation history.',
    icon: '📝',
  },
  {
    title: 'Giving & Finances',
    description: 'Record general tithes, thanksgiving offerings, special project logs, and capture expense receipts using your phone camera.',
    icon: '📊',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

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
    <YStack flex={1} backgroundColor="$background" justifyContent="space-between" paddingVertical="$6">
      {/* Skip Button */}
      <XStack justifyContent="flex-end" paddingHorizontal="$4">
        <Button 
          backgroundColor="transparent"
          pressStyle={{ opacity: 0.7 }}
          onPress={handleComplete}
        >
          <Text color="$colorPress" fontWeight="600" fontSize={15}>Skip</Text>
        </Button>
      </XStack>

      {/* Slide Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flexGrow: 0 }}
      >
        {ONBOARDING_SLIDES.map((slide, index) => (
          <YStack 
            key={index} 
            width={width} 
            paddingHorizontal={32} 
            space="$4" 
            alignItems="center" 
            justifyContent="center"
          >
            <Card 
              width={160} 
              height={160} 
              borderRadius={80} 
              backgroundColor="$primary" 
              opacity={0.08} 
              position="absolute"
              top={-10}
            />
            <Text fontSize={72} marginBottom="$4">{slide.icon}</Text>
            
            <H1 textAlign="center" fontWeight="800" color="$color" fontSize={28} letterSpacing={-0.5}>
              {slide.title}
            </H1>
            
            <Paragraph textAlign="center" color="$colorHover" fontSize={16} lineHeight={24} paddingHorizontal="$2">
              {slide.description}
            </Paragraph>
          </YStack>
        ))}
      </ScrollView>

      {/* Bottom Pager Controls */}
      <YStack space="$5" paddingHorizontal={32} alignItems="center">
        {/* Carousel Indicators */}
        <XStack space="$2">
          {ONBOARDING_SLIDES.map((_, index) => (
            <YStack
              key={index}
              width={index === activeIndex ? 20 : 8}
              height={8}
              borderRadius={4}
              backgroundColor={index === activeIndex ? '$primary' : '$borderColor'}
            />
          ))}
        </XStack>

        {/* Action Button */}
        <Button
          themeInverse
          backgroundColor="$primary"
          width="100%"
          height={50}
          borderRadius="$4"
          pressStyle={{ scale: 0.98 }}
          onPress={() => {
            if (activeIndex < ONBOARDING_SLIDES.length - 1) {
              scrollViewRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
            } else {
              handleComplete();
            }
          }}
        >
          <Text color="#FFFFFF" fontWeight="700" fontSize={16}>
            {activeIndex === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </Button>
      </YStack>
    </YStack>
  );
}
