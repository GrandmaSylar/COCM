import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useAppColors } from '../../context/ThemeContext';
import { radius } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface IconButtonProps {
  icon: IconType;
  /** Screen-reader label (required: icon-only control). */
  label: string;
  onPress?: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
  size?: number;
  /** Shows a spinner instead of the icon. */
  busy?: boolean;
  /** Continuously rotates the icon (refresh in progress). */
  spinning?: boolean;
  disabled?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'neutral',
  size = 40,
  busy,
  spinning,
  disabled,
}: IconButtonProps) {
  const c = useAppColors();
  const palette = {
    neutral: { bg: c.surfaceMuted, fg: c.text },
    primary: { bg: c.primary.soft, fg: c.primary.text },
    danger: { bg: c.danger.soft, fg: c.danger.text },
  }[tone];

  const rotation = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 150 });
    }
  }, [spinning]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!(busy || spinning) }}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Animated.View style={spinStyle}>
          <Icon size={Math.round(size * 0.45)} color={palette.fg} />
        </Animated.View>
      )}
    </PressableScale>
  );
}
