import React, { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, Alert } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner, Paragraph, Separator } from 'tamagui';
import { RefreshCw, Trash2, CheckCircle2, AlertTriangle, CloudOff, Database, ChevronDown, ChevronUp, Play } from '@tamagui/lucide-icons';
import { AppHeader } from '../components/AppHeader';
import { 
  getAllSyncQueueItems, 
  getSyncQueueStats, 
  deleteSyncQueueItem, 
  retryFailedSyncItems, 
  clearAllSyncQueue,
  LocalSyncQueueItem 
} from '../lib/db';
import { flushSyncQueue, subscribeSyncQueue } from '../lib/syncEngine';

export default function SyncDiagnosticsScreen() {
  const [items, setItems] = useState<LocalSyncQueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, syncing: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const loadDiagnostics = async () => {
    try {
      const [qItems, qStats] = await Promise.all([
        getAllSyncQueueItems(),
        getSyncQueueStats(),
      ]);
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
      Alert.alert(
        'Sync Complete',
        `Processed ${res.processed} queue item(s). ${res.errors > 0 ? `${res.errors} item(s) failed.` : 'All items synced successfully.'}`
      );
    } catch (err) {
      Alert.alert('Sync Error', 'An error occurred during synchronization.');
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
      Alert.alert('Error', 'Failed to reset error queue items.');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Outbox Queue',
      'Are you sure you want to delete all pending local queue items? Unsaved offline changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive', 
          onPress: async () => {
            await clearAllSyncQueue();
            loadDiagnostics();
          } 
        },
      ]
    );
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete Queue Item',
      'Remove this specific outbox mutation from the local queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSyncQueueItem(id);
            loadDiagnostics();
          }
        }
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Outbox Diagnostics"
        subtitle="Offline SQLite sync queue manager"
        showBack
        backTitle="System"
        rightElement={
          <Button
            size="$3"
            backgroundColor="#007AFF"
            borderRadius="$3"
            onPress={handleFlushSync}
            disabled={syncing}
            icon={syncing ? <Spinner size="small" color="#FFFFFF" /> : <Play size={14} color="#FFFFFF" />}
            pressStyle={{ scale: 0.98 }}
          >
            <Text color="#FFFFFF" fontWeight="700" fontSize={13}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
          </Button>
        }
      />

      {/* Overview Stats Bar */}
      <YStack p="$4" space="$3">
        <XStack space="$2">
          <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
            <XStack space="$1.5" alignItems="center">
              <CloudOff size={14} color="#FF9500" />
              <Text color="$colorPress" fontSize={11} fontWeight="600">Pending</Text>
            </XStack>
            <Text color="$color" fontSize={22} fontWeight="800" marginTop="$1">{stats.pending}</Text>
          </Card>

          <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
            <XStack space="$1.5" alignItems="center">
              <RefreshCw size={14} color="#007AFF" />
              <Text color="$colorPress" fontSize={11} fontWeight="600">Syncing</Text>
            </XStack>
            <Text color="#007AFF" fontSize={22} fontWeight="800" marginTop="$1">{stats.syncing}</Text>
          </Card>

          <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
            <XStack space="$1.5" alignItems="center">
              <AlertTriangle size={14} color="#FF3B30" />
              <Text color="$colorPress" fontSize={11} fontWeight="600">Errors</Text>
            </XStack>
            <Text color="#FF3B30" fontSize={22} fontWeight="800" marginTop="$1">{stats.error}</Text>
          </Card>
        </XStack>

        {/* Action Controls */}
        <XStack space="$2">
          {stats.error > 0 && (
            <Button
              flex={1}
              size="$3"
              backgroundColor="rgba(255, 59, 48, 0.12)"
              borderColor="rgba(255, 59, 48, 0.3)"
              borderWidth={1}
              borderRadius="$3"
              onPress={handleRetryFailed}
              icon={<RefreshCw size={14} color="#FF3B30" />}
            >
              <Text color="#FF3B30" fontSize={12} fontWeight="700">Retry Failed ({stats.error})</Text>
            </Button>
          )}

          {stats.total > 0 && (
            <Button
              size="$3"
              backgroundColor="rgba(142, 142, 147, 0.12)"
              borderRadius="$3"
              onPress={handleClearAll}
              icon={<Trash2 size={14} color="$colorPress" />}
            >
              <Text color="$colorPress" fontSize={12} fontWeight="600">Clear All</Text>
            </Button>
          )}
        </XStack>
      </YStack>

      <Separator borderColor="$borderColor" />

      {/* Queue List */}
      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#007AFF" />
          <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading SQLite outbox queue...</Text>
        </YStack>
      ) : items.length > 0 ? (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isExpanded = !!expandedItems[item.id];
            const isError = item.status === 'error';
            const isSyncingItem = item.status === 'syncing';
            
            let statusColor = '#FF9500';
            let statusBg = 'rgba(255, 149, 0, 0.12)';
            if (isError) {
              statusColor = '#FF3B30';
              statusBg = 'rgba(255, 59, 48, 0.12)';
            } else if (isSyncingItem) {
              statusColor = '#007AFF';
              statusBg = 'rgba(0, 122, 255, 0.12)';
            }

            return (
              <Card
                marginBottom="$3"
                padding="$3.5"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
              >
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <YStack flex={1} space="$1">
                    <XStack space="$2" alignItems="center">
                      <XStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$2" py="$0.5" borderRadius="$2">
                        <Text color="#007AFF" fontSize={11} fontWeight="800">{item.action.toUpperCase()}</Text>
                      </XStack>
                      <Text color="$color" fontSize={14} fontWeight="700" numberOfLines={1}>{item.endpoint}</Text>
                    </XStack>

                    <Text color="$colorPress" fontSize={11} marginTop="$1">
                      Enqueued: {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </YStack>

                  <XStack space="$2" alignItems="center">
                    <XStack backgroundColor={statusBg} px="$2" py="$0.5" borderRadius="$2">
                      <Text color={statusColor} fontSize={10} fontWeight="700">{item.status.toUpperCase()}</Text>
                    </XStack>

                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)}>
                      <YStack p="$1.5" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.1)">
                        <Trash2 size={15} color="#FF3B30" />
                      </YStack>
                    </TouchableOpacity>
                  </XStack>
                </XStack>

                {/* Payload Accordion Toggle */}
                <TouchableOpacity onPress={() => toggleExpand(item.id)} style={{ marginTop: 10 }}>
                  <XStack space="$1" alignItems="center">
                    <Text color="#007AFF" fontSize={12} fontWeight="600">
                      {isExpanded ? 'Hide Payload' : 'Inspect Payload'}
                    </Text>
                    {isExpanded ? <ChevronUp size={14} color="#007AFF" /> : <ChevronDown size={14} color="#007AFF" />}
                  </XStack>
                </TouchableOpacity>

                {isExpanded && (
                  <YStack marginTop="$2.5" padding="$2.5" backgroundColor="$background" borderRadius="$3" borderWidth={1} borderColor="$borderColor">
                    <Text color="$color" fontSize={11} fontFamily="monospace">
                      {item.payload}
                    </Text>
                  </YStack>
                )}
              </Card>
            );
          }}
        />
      ) : (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Database size={40} color="#34C759" />
          <Text color="$color" fontSize={17} fontWeight="700" marginTop="$3">All Changes Synced</Text>
          <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
            Your local SQLite outbox queue is completely empty. All offline changes are persisted to the server.
          </Paragraph>
        </YStack>
      )}
    </YStack>
  );
}
