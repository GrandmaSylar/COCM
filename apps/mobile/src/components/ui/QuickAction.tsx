import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

/** Round icon button with a caption underneath (contact-card style actions). */
export function QuickAction({
  icon, label, onPress, tone = 'primary',
}: { icon: IconType; label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'neutral' }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, minWidth: 56 }}>
      <IconButton icon={icon} label={label} tone={tone} size={48} onPress={onPress} />
      <AppText variant="caption" tone={tone === 'danger' ? 'danger' : 'muted'}>{label}</AppText>
    </View>
  );
}
