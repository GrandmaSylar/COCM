import React from 'react';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, H2, Paragraph, ScrollView } from 'tamagui';
import { Users, UserCheck, Baby, ChevronRight } from '@tamagui/lucide-icons';

export default function PeopleScreen() {
  const router = useRouter();

  const directories = [
    {
      title: 'Members Directory',
      description: 'View congregation registry, details and tags.',
      icon: Users,
      route: '/members',
      color: '#007AFF',
      bgColor: 'rgba(0, 122, 255, 0.1)',
    },
    {
      title: 'Visitors Registry',
      description: 'Log and track first-time church visitors.',
      icon: UserCheck,
      route: '/visitors',
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.1)',
    },
    {
      title: 'Children Registry',
      description: 'Manage children members and parents matching.',
      icon: Baby,
      route: '/children',
      color: '#FF9500',
      bgColor: 'rgba(255, 149, 0, 0.1)',
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16 }}>
      <YStack space="$4">
        <YStack>
          <H2 color="$color" fontWeight="800" fontSize={24}>People</H2>
          <Paragraph color="$colorPress" fontSize={14}>
            Manage members, new visitors, and youth directories.
          </Paragraph>
        </YStack>

        <YStack space="$3">
          {directories.map((dir) => {
            const Icon = dir.icon;
            return (
              <Card
                key={dir.title}
                padding="$4"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
                pressStyle={{ scale: 0.98 }}
                onPress={() => router.push(dir.route as any)}
              >
                <XStack space="$3" alignItems="center" justifyContent="space-between">
                  <XStack space="$3" alignItems="center" flex={1}>
                    <YStack backgroundColor={dir.bgColor} p="$2.5" borderRadius="$4">
                      <Icon size={24} color={dir.color} />
                    </YStack>
                    <YStack flex={1}>
                      <Text color="$color" fontSize={16} fontWeight="700">{dir.title}</Text>
                      <Paragraph color="$colorPress" fontSize={13} numberOfLines={2}>
                        {dir.description}
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
