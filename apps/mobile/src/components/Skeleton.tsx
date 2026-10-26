import React, { useEffect } from 'react';
import { DimensionValue, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useAppColors } from '../context/ThemeContext';
import { radius, space } from '../theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Placeholder block with a slow, gentle breathing fade (static when Reduce Motion is on). */
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const c = useAppColors();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: c.isDark ? c.borderStrong : c.surfaceMuted },
        animated,
        style,
      ]}
    />
  );
}

/** Flat surface matching the new cards and grouped lists. */
function SkeletonSurface({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useAppColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: space.md }, style]}>
      {children}
    </View>
  );
}

export function SkeletonText({ lines = 1, height = 14, lastLineWidth = '60%' }: { lines?: number; height?: number; lastLineWidth?: DimensionValue }) {
  return (
    <View style={{ gap: 8, width: '100%' }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={height} width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'} borderRadius={6} />
      ))}
    </View>
  );
}

export function SkeletonCard({ hasAvatar = true, lines = 2 }: { hasAvatar?: boolean; lines?: number }) {
  return (
    <SkeletonSurface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {hasAvatar && <Skeleton width={44} height={44} borderRadius={14} />}
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="45%" height={16} borderRadius={6} />
          <SkeletonText lines={lines - 1} height={12} lastLineWidth="70%" />
        </View>
      </View>
    </SkeletonSurface>
  );
}

export function SkeletonList({ count = 5, hasAvatar = true }: { count?: number; hasAvatar?: boolean }) {
  return (
    <View style={{ width: '100%', gap: space.xs, paddingVertical: 4 }}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} hasAvatar={hasAvatar} />
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={{ gap: space.xl, padding: space.md, width: '100%' }}>
      <View style={{ gap: 8 }}>
        <Skeleton width="35%" height={14} borderRadius={4} />
        <Skeleton width="65%" height={30} borderRadius={8} />
      </View>
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <SkeletonSurface style={{ flex: 1, gap: 10 }}><Skeleton width="60%" height={12} /><Skeleton width="45%" height={26} /></SkeletonSurface>
          <SkeletonSurface style={{ flex: 1, gap: 10 }}><Skeleton width="60%" height={12} /><Skeleton width="45%" height={26} /></SkeletonSurface>
        </View>
        <SkeletonSurface style={{ gap: 10 }}><Skeleton width="40%" height={12} /><Skeleton width="55%" height={26} /></SkeletonSurface>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {[1, 2, 3, 4].map(idx => (
          <SkeletonSurface key={idx} style={{ width: '48.5%', gap: 10 }}>
            <Skeleton width={36} height={36} borderRadius={11} />
            <Skeleton width="75%" height={14} />
          </SkeletonSurface>
        ))}
      </View>
      <SkeletonSurface style={{ gap: space.md }}>
        {[1, 2, 3].map(idx => (
          <View key={idx} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Skeleton width={34} height={34} borderRadius={10} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="75%" height={14} />
              <Skeleton width="35%" height={10} />
            </View>
          </View>
        ))}
      </SkeletonSurface>
    </View>
  );
}

export function SkeletonProfile() {
  return (
    <View style={{ gap: space.lg, padding: space.md, width: '100%', alignItems: 'center' }}>
      <Skeleton width={88} height={88} borderRadius={28} />
      <View style={{ gap: 8, alignItems: 'center', width: '100%' }}>
        <Skeleton width="50%" height={24} />
        <Skeleton width="35%" height={14} />
      </View>
      <SkeletonSurface style={{ width: '100%', gap: space.md }}>
        {[1, 2, 3].map(idx => (
          <View key={idx} style={{ gap: 6 }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="70%" height={16} />
          </View>
        ))}
      </SkeletonSurface>
    </View>
  );
}

export function SkeletonForm() {
  return (
    <View style={{ gap: space.md, padding: space.md, width: '100%' }}>
      {[1, 2, 3, 4, 5].map(idx => (
        <View key={idx} style={{ gap: 8 }}>
          <Skeleton width="35%" height={14} />
          <Skeleton width="100%" height={48} borderRadius={radius.md} />
        </View>
      ))}
      <Skeleton width="100%" height={48} borderRadius={radius.md} style={{ marginTop: space.sm }} />
    </View>
  );
}

export function SkeletonReports() {
  return (
    <View style={{ gap: space.lg, width: '100%' }}>
      {[0, 1].map(row => (
        <View key={row} style={{ flexDirection: 'row', gap: space.xs }}>
          {[0, 1].map(col => (
            <SkeletonSurface key={col} style={{ flex: 1, gap: 10 }}>
              <Skeleton width="60%" height={12} />
              <Skeleton width="80%" height={24} />
            </SkeletonSurface>
          ))}
        </View>
      ))}
      <SkeletonSurface style={{ gap: space.md }}>
        {[1, 2, 3, 4].map(idx => (
          <View key={idx} style={{ gap: 6 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="100%" height={8} borderRadius={4} />
          </View>
        ))}
      </SkeletonSurface>
    </View>
  );
}
