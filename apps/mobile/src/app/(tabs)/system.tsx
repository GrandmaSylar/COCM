import React from 'react';
import { TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, ScrollView } from 'tamagui';
import { BarChart3, Settings, ClipboardList, HelpCircle, ChevronRight, Moon, Sun, CloudOff } from '@tamagui/lucide-icons';
import { useThemeContext } from '../../context/ThemeContext';

export default function SystemScreen() {
  const router = useRouter();
  const { isDark, toggleTheme, themeColors } = useThemeContext();

  const systemMenus = [
    {
      title: 'Offline Outbox & Diagnostics',
      description: 'Manage SQLite outbox queue, retry failed items, and flush sync tasks.',
      icon: CloudOff,
      route: '/sync-diagnostics',
      color: '#FF9500',
      bgColor: 'rgba(255, 149, 0, 0.12)',
    },
    {
      title: 'Reports & Analytics',
      description: 'Generate demographic graphs and attendance & financial summaries.',
      icon: BarChart3,
      route: '/reports',
      color: '#007AFF',
      bgColor: 'rgba(0, 122, 255, 0.12)',
    },
    {
      title: 'App & System Settings',
      description: 'Configure dropdown options, themes, sync & system version info.',
      icon: Settings,
      route: '/settings',
      color: '#8E8E93',
      bgColor: 'rgba(142, 142, 147, 0.12)',
    },
    {
      title: 'Activity Logs',
      description: 'Review real-time system actions executed by leaders and users.',
      icon: ClipboardList,
      route: '/logs',
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.12)',
    },
    {
      title: 'Help & Guides',
      description: 'Review interactive tutorials, role permissions & feature guides.',
      icon: HelpCircle,
      route: '/help',
      color: '#AF52DE',
      bgColor: 'rgba(175, 82, 222, 0.12)',
    },
  ];

  return (
    <YStack flex={1} backgroundColor={themeColors.background}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <YStack space="$4">
          <YStack>
            <H2 color={themeColors.text} fontWeight="800" fontSize={24}>System Hub</H2>
            <Paragraph color={themeColors.textMuted} fontSize={14}>
              Configure options, check analytics & logs, and access user guides.
            </Paragraph>
          </YStack>

          {/* Dedicated Dark Mode Toggle Card */}
          <Card
            padding="$4"
            borderRadius="$5"
            backgroundColor={themeColors.cardBackground}
            borderColor={themeColors.borderColor}
            borderWidth={1}
            elevate
          >
            <XStack space="$3" alignItems="center" justifyContent="space-between">
              <XStack space="$3" alignItems="center" flex={1}>
                <YStack backgroundColor={isDark ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 122, 255, 0.1)'} p="$2.5" borderRadius="$4">
                  {isDark ? <Sun size={24} color="#FF9500" /> : <Moon size={24} color="#007AFF" />}
                </YStack>
                <YStack flex={1}>
                  <Text color={themeColors.text} fontSize={16} fontWeight="700">Dark Mode</Text>
                  <Paragraph color={themeColors.textMuted} fontSize={13}>
                    {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                  </Paragraph>
                </YStack>
              </XStack>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </XStack>
          </Card>

          <YStack space="$3">
            {systemMenus.map((menu) => {
              const Icon = menu.icon;
              return (
                <Card
                  key={menu.title}
                  padding="$4"
                  borderRadius="$5"
                  backgroundColor={themeColors.cardBackground}
                  borderColor={themeColors.borderColor}
                  borderWidth={1}
                  elevate
                  pressStyle={{ scale: 0.98 }}
                  onPress={() => router.push(menu.route as any)}
                >
                  <XStack space="$3" alignItems="center" justifyContent="space-between">
                    <XStack space="$3" alignItems="center" flex={1}>
                      <YStack backgroundColor={menu.bgColor} p="$2.5" borderRadius="$4">
                        <Icon size={24} color={menu.color} />
                      </YStack>
                      <YStack flex={1}>
                        <Text color={themeColors.text} fontSize={16} fontWeight="700">{menu.title}</Text>
                        <Paragraph color={themeColors.textMuted} fontSize={13} numberOfLines={2}>
                          {menu.description}
                        </Paragraph>
                      </YStack>
                    </XStack>
                    <ChevronRight size={20} color={themeColors.textMuted} />
                  </XStack>
                </Card>
              );
            })}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
