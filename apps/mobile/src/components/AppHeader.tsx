import React from 'react';
import { Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XStack, YStack, Text } from 'tamagui';
import { ChevronLeft, Moon, Sun } from '@tamagui/lucide-icons';
import { useThemeContext } from '../context/ThemeContext';
import { fonts, HIT, radius } from '../theme/tokens';
import { haptic } from '../theme/haptics';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  backTitle?: string;
  rightElement?: React.ReactNode;
  showThemeToggle?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  compact?: boolean;
}

/**
 * The single screen header. Handles the top safe area, back navigation and a
 * right-side action slot.
 */
export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  backTitle,
  rightElement,
  showThemeToggle = false,
  backgroundColor,
  borderColor,
  compact = false,
}: AppHeaderProps) {
  const router = useRouter();
  const { isDark, toggleTheme, colors } = useThemeContext();
  const headerBg = backgroundColor ?? colors.surface;

  const handleBack = () => {
    haptic.light();
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: headerBg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} animated />
      <XStack
        paddingLeft={showBack ? 8 : 16}
        paddingRight={16}
        paddingVertical={compact ? 6 : 8}
        alignItems="center"
        justifyContent="space-between"
        backgroundColor={headerBg}
        borderBottomWidth={1}
        borderColor={borderColor ?? colors.border}
        minHeight={compact ? 52 : 60}
        gap={8}
      >
        <XStack alignItems="center" flex={1} gap={4}>
          {showBack && (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={backTitle ? `Back to ${backTitle}` : 'Back'}
              hitSlop={8}
              style={({ pressed }) => ({
                minWidth: HIT,
                height: HIT,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
              })}
            >
              <ChevronLeft size={26} color={colors.primary.text} />
            </Pressable>
          )}

          <YStack flex={1}>
            <Text
              color={colors.text}
              fontFamily={fonts.heading}
              fontSize={compact ? 17 : 19}
              lineHeight={compact ? 22 : 24}
              letterSpacing={-0.3}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text color={colors.textMuted} fontSize={13} lineHeight={18} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        <XStack gap={8} alignItems="center">
          {showThemeToggle && (
            <Pressable
              onPress={() => { haptic.selection(); toggleTheme(); }}
              accessibilityRole="button"
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.borderStrong : colors.surfaceMuted,
              })}
            >
              {isDark ? <Sun size={19} color={colors.text} /> : <Moon size={19} color={colors.text} />}
            </Pressable>
          )}
          {rightElement}
        </XStack>
      </XStack>
    </SafeAreaView>
  );
}
