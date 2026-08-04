import React from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, ScrollView } from 'tamagui';
import { BarChart3, Settings, ClipboardList, HelpCircle, ChevronRight } from '@tamagui/lucide-icons';

export default function SystemScreen() {
  const router = useRouter();

  const systemMenus = [
    {
      title: 'Reports & Analytics',
      description: 'Generate demographic graphs and attendance summaries.',
      icon: BarChart3,
      route: '/reports',
      color: '#007AFF',
      bgColor: 'rgba(0, 122, 255, 0.1)',
    },
    {
      title: 'App Settings',
      description: 'Configure device overrides, themes, and roles.',
      icon: Settings,
      route: '/settings',
      color: '#8E8E93',
      bgColor: 'rgba(142, 142, 147, 0.1)',
    },
    {
      title: 'Activity Logs',
      description: 'Review system actions executed by users.',
      icon: ClipboardList,
      route: '/logs',
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.1)',
    },
    {
      title: 'Help & Guides',
      description: 'Review interactive tutorials and user documentation.',
      icon: HelpCircle,
      route: '/help',
      color: '#FF9500',
      bgColor: 'rgba(255, 149, 0, 0.1)',
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16 }}>
      <YStack space="$4">
        <YStack>
          <H2 color="$color" fontWeight="800" fontSize={24}>System</H2>
          <Paragraph color="$colorPress" fontSize={14}>
            Configure portal options, check diagnostics logs, and request help.
          </Paragraph>
        </YStack>

        <YStack space="$3">
          {systemMenus.map((menu) => {
            const Icon = menu.icon;
            return (
              <Card
                key={menu.title}
                padding="$4"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
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
                      <Text color="$color" fontSize={16} fontWeight="700">{menu.title}</Text>
                      <Paragraph color="$colorPress" fontSize={13} numberOfLines={2}>
                        {menu.description}
                      </Paragraph>
                    </YStack>
                  </XStack>
                  <ChevronRight size={20} color="#8E8E93" />
                </XStack>
              </Card>
            );
          })}
        </YStack>
      </YStack>
    </ScrollView>
  );
}
