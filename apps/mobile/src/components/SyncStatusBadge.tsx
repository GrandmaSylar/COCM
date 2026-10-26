import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { RefreshCw, AlertTriangle, CloudOff } from '@tamagui/lucide-icons';
import { getSyncQueueStats } from '../lib/db';
import { subscribeSyncQueue } from '../lib/syncEngine';
import { AppText, PressableScale, useToneColors } from './ui';

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

  const hasError = stats.error > 0;
  const hasSyncing = stats.syncing > 0;
  const hasPending = stats.pending > 0;

  const state = hasError
    ? { tone: 'danger' as const, label: `${stats.error} failed`, icon: AlertTriangle }
    : hasSyncing
      ? { tone: 'info' as const, label: 'Syncing', icon: RefreshCw }
      : { tone: 'warning' as const, label: `${stats.pending} waiting`, icon: CloudOff };
  const t = useToneColors(state.tone);

  // Soft pulse while uploading
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (hasSyncing) {
      opacity.value = withRepeat(withTiming(0.55, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 150 });
    }
  }, [hasSyncing]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (loading) return null;
  // Completely synced: keep the header clean (status lives in System → Sync status)
  if (!hasPending && !hasSyncing && !hasError) return null;

  const Icon = state.icon;
  return (
    <PressableScale
      onPress={() => router.push('/sync-diagnostics' as any)}
      accessibilityRole="button"
      accessibilityLabel={`Sync status: ${state.label}. Open outbox.`}
      hitSlop={8}
      style={{ borderRadius: 999 }}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            height: 30,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: t.soft,
          },
          pulse,
        ]}
      >
        <Icon size={14} color={t.text} />
        <AppText variant="micro" color={t.text}>{state.label}</AppText>
      </Animated.View>
    </PressableScale>
  );
}
