import React from 'react';
import { TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XStack, YStack, Text, Paragraph } from 'tamagui';
import { ArrowLeft, Moon, Sun } from '@tamagui/lucide-icons';
import { useThemeContext } from '../context/ThemeContext';

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

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  backTitle,
  rightElement,
  showThemeToggle = false,
  backgroundColor = '$cardBackground',
  borderColor = '$borderColor',
  compact = false,
}: AppHeaderProps) {
  const router = useRouter();
  const { isDark, toggleTheme, themeColors } = useThemeContext();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: themeColors.headerBackground }}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.headerBackground} />
      <XStack
        px="$4"
        py={compact ? '$2.5' : '$3'}
        alignItems="center"
        justifyContent="space-between"
        backgroundColor={backgroundColor}
        borderBottomWidth={1}
        borderColor={borderColor}
        minHeight={54}
      >
        <XStack space="$3" alignItems="center" flex={1}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingRight: 4,
              }}
            >
              <YStack
                backgroundColor="rgba(0, 122, 255, 0.08)"
                p="$2"
                borderRadius="$3"
                mr={backTitle ? '$1.5' : '$0'}
              >
                <ArrowLeft size={18} color="#007AFF" />
              </YStack>
              {backTitle ? (
                <Text color="#007AFF" fontSize={14} fontWeight="600">
                  {backTitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}

          <YStack flex={1}>
            <Text
              color="$color"
              fontWeight="800"
              fontSize={compact ? 17 : 19}
              numberOfLines={1}
              letterSpacing={-0.3}
            >
              {title}
            </Text>
            {subtitle ? (
              <Paragraph color="$colorPress" fontSize={12} numberOfLines={1} marginTop={-2}>
                {subtitle}
              </Paragraph>
            ) : null}
          </YStack>
        </XStack>

        <XStack space="$2" alignItems="center">
          {showThemeToggle && (
            <TouchableOpacity
              onPress={toggleTheme}
              activeOpacity={0.7}
              style={{
                padding: 7,
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 122, 255, 0.1)',
              }}
            >
              {isDark ? <Sun size={19} color="#FF9500" /> : <Moon size={19} color="#007AFF" />}
            </TouchableOpacity>
          )}
          {rightElement}
        </XStack>
      </XStack>
    </SafeAreaView>
  );
}

