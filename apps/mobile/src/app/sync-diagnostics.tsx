import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { RefreshCw, Trash2, CheckCircle2, AlertTriangle, CloudOff, ChevronDown, ChevronUp, UploadCloud } from '@tamagui/lucide-icons';
import { AppHeader } from '../components/AppHeader';
import { SkeletonList } from '../components/Skeleton';
import {
  getAllSyncQueueItems,
  getSyncQueueStats,
  deleteSyncQueueItem,
  retryFailedSyncItems,
  clearAllSyncQueue,
  LocalSyncQueueItem,
} from '../lib/db';
import { flushSyncQueue, subscribeSyncQueue } from '../lib/syncEngine';
import { useThemeContext } from '../context/ThemeContext';
import { AppText, Badge, Button, EmptyState, IconButton, IconWell, Screen, Surface, Tone, useToast } from '../components/ui';
import { radius, space } from '../theme/tokens';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting' },
  syncing: { tone: 'info', label: 'Syncing' },
  error: { tone: 'danger', label: 'Failed' },
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const METHOD_LABEL: Record<string, string> = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete' };

export default function SyncDiagnosticsScreen() {
  const toast = useToast();
  const { colors: c } = useThemeContext();
  const [items, setItems] = useState<LocalSyncQueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, syncing: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const loadDiagnostics = async () => {
    try {
      const [qItems, qStats] = await Promise.all([getAllSyncQueueItems(), getSyncQueueStats()]);
      setItems(qItems);
      setStats(qStats);
    } catch (err) {
      console.warn('Error loading sync diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
    const unsubscribe = subscribeSyncQueue(loadDiagnostics);
    return () => unsubscribe();
  }, []);

  const handleFlushSync = async () => {
    setSyncing(true);
    try {
      const res = await flushSyncQueue();
      if (res.errors > 0) {
        toast.show({
          title: `${res.errors} ${res.errors === 1 ? 'change' : 'changes'} failed`,
          message: res.processed > 0 ? `${res.processed} synced. See the errors below.` : 'See the errors below.',
          tone: 'warning',
        });
      } else {
        toast.show({ title: 'Sync complete', message: res.processed > 0 ? `${res.processed} ${res.processed === 1 ? 'change' : 'changes'} uploaded.` : 'Nothing was waiting.' });
      }
    } catch (err) {
      toast.show({ title: 'Sync failed', message: 'Check your connection and try again.', tone: 'error' });
    } finally {
      setSyncing(false);
      loadDiagnostics();
    }
  };

  const handleRetryFailed = async () => {
    try {
      await retryFailedSyncItems();
      await handleFlushSync();
    } catch (err) {
      toast.show({ title: 'Couldn’t reset failed items', tone: 'error' });
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear the outbox?',
      'All queued changes are deleted from this device. Anything not yet synced is lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            await clearAllSyncQueue();
            loadDiagnostics();
          },
        },
      ]
    );
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete this change?',
      'It is removed from the outbox and will never reach the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSyncQueueItem(id);
            loadDiagnostics();
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hero = stats.error > 0
    ? { icon: AlertTriangle, tone: 'danger' as Tone, title: `${stats.error} ${stats.error === 1 ? 'change' : 'changes'} failed`, text: 'Fix or delete them, then retry.' }
    : stats.syncing > 0 || syncing
      ? { icon: RefreshCw, tone: 'info' as Tone, title: 'Syncing…', text: 'Uploading queued changes.' }
      : stats.pending > 0
        ? { icon: CloudOff, tone: 'warning' as Tone, title: `${stats.pending} ${stats.pending === 1 ? 'change' : 'changes'} waiting`, text: 'They upload automatically when you’re online.' }
        : { icon: CheckCircle2, tone: 'success' as Tone, title: 'Everything is synced', text: 'No offline changes are waiting.' };

  return (
    <Screen>
      <AppHeader title="Sync & outbox" subtitle="Changes saved on this device" showBack />

      <View style={{ padding: space.md, gap: space.sm }}>
        <Surface style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <IconWell icon={hero.icon} tone={hero.tone} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="headline">{hero.title}</AppText>
              <AppText variant="caption" tone="muted">{hero.text}</AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted, paddingVertical: space.sm }}>
            {[
              { label: 'Waiting', value: stats.pending, tone: 'warning' as const },
              { label: 'Syncing', value: stats.syncing, tone: 'info' as const },
              { label: 'Failed', value: stats.error, tone: 'danger' as const },
            ].map((s, i) => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
                <AppText variant="title" numeric tone={s.value > 0 ? s.tone : 'subtle'}>{s.value}</AppText>
                <AppText variant="caption" tone="muted">{s.label}</AppText>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Button label={syncing ? 'Syncing…' : 'Sync now'} icon={UploadCloud} loading={syncing} flex={1} onPress={handleFlushSync} />
            {stats.error > 0 ? (
              <Button label={`Retry ${stats.error}`} icon={RefreshCw} variant="dangerSoft" flex={1} onPress={handleRetryFailed} disabled={syncing} />
            ) : null}
          </View>
        </Surface>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: space.md }}>
          <SkeletonList count={4} hasAvatar={false} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.xs, flexGrow: 1 }}
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 }}>
                <AppText variant="captionStrong" tone="muted">Queued changes · {items.length}</AppText>
                <Button label="Clear all" variant="ghost" size="sm" onPress={handleClearAll} />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={CheckCircle2}
              tone="success"
              title="Outbox is empty"
              message="Changes you make offline appear here until they reach the server."
            />
          }
          renderItem={({ item, index }) => {
            const isExpanded = !!expandedItems[item.id];
            const status = STATUS[item.status] ?? STATUS.pending;
            return (
              <Animated.View entering={index < 12 ? FadeIn.duration(200).delay(index * 25) : undefined}>
                <Surface style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <Badge label={METHOD_LABEL[item.action] ?? item.action} tone="neutral" />
                        <Badge label={status.label} tone={status.tone} />
                      </View>
                      <AppText variant="bodyMedium" numberOfLines={2} style={{ fontFamily: MONO, fontSize: 13 }}>
                        {item.endpoint}
                      </AppText>
                      <AppText variant="caption" tone="subtle">
                        Queued {new Date(item.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {item.attempts ? ` · ${item.attempts} ${item.attempts === 1 ? 'attempt' : 'attempts'}` : ''}
                      </AppText>
                    </View>
                    <IconButton icon={Trash2} label="Delete this change" tone="danger" size={36} onPress={() => handleDeleteItem(item.id)} />
                  </View>

                  {item.status === 'error' && item.last_error ? (
                    <View style={{ padding: 10, borderRadius: radius.sm, backgroundColor: c.danger.soft }}>
                      <AppText variant="caption" tone="danger" numberOfLines={4}>{item.last_error}</AppText>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}
                  >
                    <AppText variant="captionStrong" tone="primary">{isExpanded ? 'Hide details' : 'Show details'}</AppText>
                    {isExpanded ? <ChevronUp size={14} color={c.primary.text} /> : <ChevronDown size={14} color={c.primary.text} />}
                  </Pressable>

                  {isExpanded ? (
                    <View style={{ padding: 10, borderRadius: radius.sm, backgroundColor: c.surfaceMuted }}>
                      <AppText variant="caption" style={{ fontFamily: MONO }} selectable>
                        {item.payload}
                      </AppText>
                    </View>
                  ) : null}
                </Surface>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}
