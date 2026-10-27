import React from 'react';
import { View } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { AppText } from './AppText';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function useToneColors(tone: Tone) {
  const c = useAppColors();
  if (tone === 'neutral') return { soft: c.surfaceMuted, text: c.textMuted, base: c.textSubtle };
  const map = { primary: c.primary, success: c.success, warning: c.warning, danger: c.danger, info: c.info };
  return map[tone];
}

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconType;
}

/** Small status label. Square-ish corners, sentence case. */
export function Badge({ label, tone = 'neutral', icon: Icon }: BadgeProps) {
  const t = useToneColors(tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: t.soft,
      }}
    >
      {Icon ? <Icon size={12} color={t.text} /> : null}
      <AppText variant="micro" color={t.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
