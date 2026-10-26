import React from 'react';
import { View } from 'react-native';
import { ChevronRight } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { space } from '../../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface AmountRowProps {
  title: string;
  /** Date / service / method line. */
  subtitle?: string;
  /** Pre-formatted amount, e.g. "GH₵ 1,250.00". */
  amount: string;
  direction: 'in' | 'out';
  /** Small content above the title (e.g. a form-id badge). */
  leading?: React.ReactNode;
  /** Extra line under the subtitle (e.g. category breakdown). */
  detail?: string;
  onPress?: () => void;
}

/** Money row: label on the left, signed amount right-aligned in success/danger. */
export function AmountRow({ title, subtitle, amount, direction, leading, detail, onPress }: AmountRowProps) {
  const c = useAppColors();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 64 }}>
      <View style={{ flex: 1, gap: 3 }}>
        {leading}
        <AppText variant="bodyMedium" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText> : null}
        {detail ? <AppText variant="caption" tone="subtle" numberOfLines={2}>{detail}</AppText> : null}
      </View>
      <AppText variant="bodyStrong" numeric tone={direction === 'in' ? 'success' : 'danger'}>
        {direction === 'in' ? '+' : '−'}{amount}
      </AppText>
      {onPress ? <ChevronRight size={18} color={c.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${title}, ${direction === 'in' ? 'received' : 'spent'} ${amount}`}>
      {content}
    </PressableScale>
  );
}
