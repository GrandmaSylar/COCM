import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAppColors } from '../context/ThemeContext';
import { HIT } from '../theme/tokens';
import { AppText, PressableScale } from './ui';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Right-side actions. */
  right?: React.ReactNode;
}

/** The screen header: surface background, hairline below, title left, actions right. Handles the top safe area. */
export function AppHeader({ title, subtitle, onBack, right }: AppHeaderProps) {
  const c = useAppColors();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: c.surface }}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} animated />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 60,
          paddingVertical: 8,
          paddingLeft: onBack ? 8 : 16,
          paddingRight: 8,
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        {onBack ? (
          <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={24} color={c.text} />
          </PressableScale>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    </SafeAreaView>
  );
}

/** A 44pt icon button for the header's right side. */
export function HeaderButton({ icon: Icon, label, onPress, disabled }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useAppColors();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={20} color={c.text} />
    </PressableScale>
  );
}
