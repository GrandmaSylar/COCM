import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAppColors } from '../../context/ThemeContext';
import { motion, radius } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';
import { AppText } from './AppText';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Equal-width segments with a sliding selection pill. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const c = useAppColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const segmentWidth = width > 0 ? (width - 6) / options.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * segmentWidth, motion.spring) }],
  }), [index, segmentWidth]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: c.surfaceMuted,
        borderRadius: radius.md,
        padding: 3,
        minHeight: 40,
      }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 3,
              bottom: 3,
              left: 3,
              width: segmentWidth,
              borderRadius: radius.md - 3,
              backgroundColor: c.isDark ? c.borderStrong : c.surface,
              shadowColor: '#000',
              shadowOpacity: c.isDark ? 0 : 0.08,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: c.isDark ? 0 : 1,
            },
            pillStyle,
          ]}
        />
      ) : null}
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (!selected) {
                haptic.selection();
                onChange(opt.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4 }}
          >
            <AppText variant={selected ? 'captionStrong' : 'caption'} tone={selected ? 'default' : 'muted'} numberOfLines={1}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
