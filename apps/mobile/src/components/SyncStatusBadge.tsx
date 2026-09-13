import React, { useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { XStack, Text } from 'tamagui';
import { CheckCircle2, RefreshCw, AlertTriangle, CloudOff } from '@tamagui/lucide-icons';
import { getSyncQueueStats } from '../lib/db';
import { subscribeSyncQueue } from '../lib/syncEngine';

export function SyncStatusBadge() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, pending: 0, syncing: 0, error: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const s = await getSyncQueueStats();
      setStats(s);
    } catch (e) {
      console.warn('Error fetching sync queue stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const unsubscribe = subscribeSyncQueue(fetchStats);
    return () => unsubscribe();
  }, []);

  if (loading) return null;

  const hasPending = stats.pending > 0;
  const hasSyncing = stats.syncing > 0;
  const hasError = stats.error > 0;

  // When completely synced, don't clutter top header (diagnostics is accessible in System tab & when items are pending)
  if (!hasPending && !hasSyncing && !hasError) {
    return null;
  }

  let badgeBg = 'rgba(255, 149, 0, 0.12)';
  let badgeBorder = 'rgba(255, 149, 0, 0.3)';
  let iconColor = '#FF9500';
  let label = `${stats.pending} Outbox`;
  let Icon = CloudOff;

  if (hasError) {
    badgeBg = 'rgba(255, 59, 48, 0.12)';
    badgeBorder = 'rgba(255, 59, 48, 0.3)';
    iconColor = '#FF3B30';
    label = `${stats.error} Error`;
    Icon = AlertTriangle;
  } else if (hasSyncing) {
    badgeBg = 'rgba(0, 122, 255, 0.12)';
    badgeBorder = 'rgba(0, 122, 255, 0.3)';
    iconColor = '#007AFF';
    label = 'Syncing...';
    Icon = RefreshCw;
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/sync-diagnostics' as any)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <XStack
        alignItems="center"
        space="$1"
        px="$2"
        py="$0.5"
        borderRadius="$4"
        backgroundColor={badgeBg}
        borderWidth={1}
        borderColor={badgeBorder}
      >
        <Icon size={12} color={iconColor} />
        <Text color={iconColor} fontSize={10} fontWeight="700">
          {label}
        </Text>
      </XStack>
    </TouchableOpacity>
  );
}
