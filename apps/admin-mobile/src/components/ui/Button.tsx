import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { HIT, radius } from '../../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconType;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  flex?: number;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  fullWidth,
  flex,
  accessibilityLabel,
}: ButtonProps) {
  const c = useAppColors();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary.base, fg: c.primary.on },
    soft: { bg: c.primary.soft, fg: c.primary.text },
    secondary: { bg: c.surface, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.primary.text },
    danger: { bg: c.danger.base, fg: c.danger.on },
    dangerSoft: { bg: c.danger.soft, fg: c.danger.text },
  };
  const { bg, fg, border } = palette[variant];
  const height = size === 'md' ? 48 : 36;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptics={variant === 'primary' || variant === 'danger' ? 'medium' : 'light'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={size === 'sm' ? (HIT - height) / 2 : undefined}
      style={[
        {
          height,
          paddingHorizontal: size === 'md' ? 20 : 14,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: border ? 1 : 0,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        flex !== undefined ? { flex, alignSelf: 'auto' } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : Icon ? (
        <View>
          <Icon size={size === 'md' ? 18 : 16} color={fg} />
        </View>
      ) : null}
      <AppText variant={size === 'md' ? 'bodyStrong' : 'captionStrong'} color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}
