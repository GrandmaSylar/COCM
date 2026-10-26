import React from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, ScrollView } from 'tamagui';
import { CalendarCheck, ShieldCheck, MapPin, ChevronRight } from '@tamagui/lucide-icons';

export default function OperationsScreen() {
  const router = useRouter();

  const operations = [
    {
      title: 'Attendance Tracker',
      description: 'Mark attendance registers for services and events.',
      icon: CalendarCheck,
      route: '/attendance',
      color: '#FF9500',
      bgColor: 'rgba(255, 149, 0, 0.1)',
    },
    {
      title: 'Ministries',
      description: 'Manage volunteer teams and structural departments.',
      icon: ShieldCheck,
      route: '/ministries',
      color: '#5856D6',
      bgColor: 'rgba(88, 86, 214, 0.1)',
    },
    {
      title: 'Zones Cell Groups',
      description: 'Organize geographic care cell zones.',
      icon: MapPin,
      route: '/zones',
      color: '#AF52DE',
      bgColor: 'rgba(175, 82, 222, 0.1)',
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16 }}>
      <YStack space="$4">
        <YStack>
          <H2 color="$color" fontWeight="800" fontSize={24}>Operations</H2>
          <Paragraph color="$colorPress" fontSize={14}>
            Administer services, volunteer staff, and care groups.
          </Paragraph>
        </YStack>

        <YStack space="$3">
          {operations.map((op) => {
            const Icon = op.icon;
            return (
              <Card
                key={op.title}
                padding="$4"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
                pressStyle={{ scale: 0.98 }}
                onPress={() => router.push(op.route as any)}
              >
                <XStack space="$3" alignItems="center" justifyContent="space-between">
                  <XStack space="$3" alignItems="center" flex={1}>
                    <YStack backgroundColor={op.bgColor} p="$2.5" borderRadius="$4">
                      <Icon size={24} color={op.color} />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize={16} fontWeight="700">{op.title}</Text>
                      <Paragraph color="$colorPress" fontSize={13} numberOfLines={2}>
                        {op.description}
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
