import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Haptic fired on press; false for none. */
  haptics?: keyof typeof haptic | false;
  scaleTo?: number;
}

/** Pressable with spring scale feedback + haptic. The base for every tappable surface. */
export function PressableScale({
  style,
  haptics = 'light',
  scaleTo = motion.pressScale,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        if (!reduceMotion) scale.value = withSpring(scaleTo, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (haptics) haptic[haptics]();
        onPress?.(e);
      }}
      style={[style, animatedStyle, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
