import React from 'react';
import { Linking, View } from 'react-native';
import { ChevronRight, Phone } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { radius, space } from '../../theme/tokens';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';

export interface PersonRowProps {
  name: string;
  photoUri?: string | null;
  /** Badges under the name (zone, status...). */
  meta?: React.ReactNode;
  /** Secondary line (phone, guardian, visit date...). */
  subtitle?: string;
  phone?: string | null;
  onPress?: () => void;
  /** Position in a grouped list: rounds the outer corners and draws dividers. */
  position?: 'single' | 'first' | 'middle' | 'last';
}

/** Row for people lists: avatar, name, badges, optional call button. */
export function PersonRow({ name, photoUri, meta, subtitle, phone, onPress, position = 'single' }: PersonRowProps) {
  const c = useAppColors();
  const first = position === 'single' || position === 'first';
  const last = position === 'single' || position === 'last';

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderBottomWidth: 1,
        borderTopLeftRadius: first ? radius.lg : 0,
        borderTopRightRadius: first ? radius.lg : 0,
        borderBottomLeftRadius: last ? radius.lg : 0,
        borderBottomRightRadius: last ? radius.lg : 0,
        overflow: 'hidden',
      }}
    >
      <PressableScale
        onPress={onPress}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 68 }}
      >
        <Avatar name={name} uri={photoUri} size={44} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          {meta ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{meta}</View> : null}
          {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
        {phone ? (
          <IconButton icon={Phone} label={`Call ${name}`} tone="primary" size={38} onPress={() => Linking.openURL(`tel:${phone}`)} />
        ) : null}
        {onPress ? <ChevronRight size={18} color={c.textSubtle} /> : null}
      </PressableScale>
    </View>
  );
}

export function rowPosition(index: number, count: number): PersonRowProps['position'] {
  if (count === 1) return 'single';
  if (index === 0) return 'first';
  if (index === count - 1) return 'last';
  return 'middle';
}
