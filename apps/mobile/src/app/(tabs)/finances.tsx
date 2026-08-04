import React from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, ScrollView } from 'tamagui';
import { Landmark, ArrowUpRight, ArrowDownRight, ChevronRight } from '@tamagui/lucide-icons';

export default function FinancesScreen() {
  const router = useRouter();

  const financeOptions = [
    {
      title: 'Giving & Tithes',
      description: 'Record offerings, cell group collections, and general donations.',
      icon: ArrowUpRight,
      route: '/giving',
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.1)',
    },
    {
      title: 'Expenses Logging',
      description: 'Capture expense accounts, receipts, and project costs.',
      icon: ArrowDownRight,
      route: '/expenses',
      color: '#FF3B30',
      bgColor: 'rgba(255, 59, 48, 0.1)',
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16 }}>
      <YStack space="$4">
        <YStack>
          <H2 color="$color" fontWeight="800" fontSize={24}>Finances</H2>
          <Paragraph color="$colorPress" fontSize={14}>
            Monitor offerings, tithes, cell donations, and expense registers.
          </Paragraph>
        </YStack>

        <YStack space="$3">
          {financeOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <Card
                key={opt.title}
                padding="$4"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
                pressStyle={{ scale: 0.98 }}
                onPress={() => router.push(opt.route as any)}
              >
                <XStack space="$3" alignItems="center" justifyContent="space-between">
                  <XStack space="$3" alignItems="center" flex={1}>
                    <YStack backgroundColor={opt.bgColor} p="$2.5" borderRadius="$4">
                      <Icon size={24} color={opt.color} />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize={16} fontWeight="700">{opt.title}</Text>
                      <Paragraph color="$colorPress" fontSize={13} numberOfLines={2}>
                        {opt.description}
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
