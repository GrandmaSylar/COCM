import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAppColors } from '../../context/ThemeContext';
import { radius, space } from '../../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { Tone, useToneColors } from './Badge';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface EmptyStateProps {
  icon: IconType;
  title: string;
  message?: string;
  tone?: Tone;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon: Icon, title, message, tone = 'neutral', action }: EmptyStateProps) {
  const t = useToneColors(tone);
  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={26} color={t.text} />
      </View>
      <AppText variant="headline" align="center">{title}</AppText>
      {message ? (
        <AppText variant="caption" tone="muted" align="center" style={{ maxWidth: 300 }}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <View style={{ marginTop: 8 }}>
          <Button label={action.label} onPress={action.onPress} variant="soft" size="sm" />
        </View>
      ) : null}
    </Animated.View>
  );
}

export interface StatTileProps {
  label: string;
  value: string;
  icon?: IconType;
  tone?: Tone;
  /** Small line under the value. */
  footnote?: string;
  footnoteTone?: 'muted' | 'success' | 'danger' | 'warning';
  /** Colors the value itself (e.g. net balance). */
  valueTone?: 'default' | 'success' | 'danger';
  onPress?: () => void;
}

export function StatTile({ label, value, icon: Icon, tone = 'primary', footnote, footnoteTone = 'muted', valueTone = 'default', onPress }: StatTileProps) {
  const c = useAppColors();
  const t = useToneColors(tone);
  const body = (
    <View
      style={{
        flex: 1,
        minHeight: 104,
        padding: space.md,
        gap: 6,
        borderRadius: radius.lg,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AppText variant="captionStrong" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{label}</AppText>
        {Icon ? <Icon size={16} color={t.text} /> : null}
      </View>
      <AppText variant="title" tone={valueTone} numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </AppText>
      {footnote ? (
        <AppText variant="caption" tone={footnoteTone} numberOfLines={2}>{footnote}</AppText>
      ) : null}
    </View>
  );
  if (!onPress) return <View style={{ flex: 1 }}>{body}</View>;
  return (
    <PressableScale onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      {body}
    </PressableScale>
  );
}

/** A thin horizontal proportion bar. */
export function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const c = useAppColors();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}
