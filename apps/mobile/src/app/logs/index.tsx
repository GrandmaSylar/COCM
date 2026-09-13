import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, TouchableOpacity, TextInput, RefreshControl, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { ArrowLeft, Search, RefreshCw, X, Plus, Pencil, Trash2, LogIn, LogOut, CheckCircle, Shield, Activity } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLocalActivityLogs, LocalActivityLog } from '../../lib/db';
import { syncActivityLogs } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

export default function ActivityLogsScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

  const [logs, setLogs] = useState<LocalActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity });
      setLogs(cached);

      syncActivityLogs().then(() => getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity }).then(setLogs)).catch(() => {});
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAction, selectedEntity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase Subscription
  useEffect(() => {
    const channel = supabase.channel('mobile-activity-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        syncActivityLogs().then(() => getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity }).then(setLogs)).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAction, selectedEntity]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncActivityLogs();
      const updated = await getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity });
      setLogs(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return logs.filter(l => {
      return (
        (l.description || '').toLowerCase().includes(s) ||
        (l.user_name || '').toLowerCase().includes(s) ||
        (l.action || '').toLowerCase().includes(s) ||
        (l.entity_type || '').toLowerCase().includes(s)
      );
    });
  }, [logs, searchTerm]);

  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act === 'create') return { color: '#34C759', bg: 'rgba(52, 199, 89, 0.15)', icon: Plus, label: 'CREATE' };
    if (act === 'update') return { color: '#007AFF', bg: 'rgba(0, 122, 255, 0.15)', icon: Pencil, label: 'UPDATE' };
    if (act === 'delete') return { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.15)', icon: Trash2, label: 'DELETE' };
    if (act === 'login') return { color: '#AF52DE', bg: 'rgba(175, 82, 222, 0.15)', icon: LogIn, label: 'LOGIN' };
    return { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.15)', icon: Activity, label: act.toUpperCase() };
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const isToday = d.toDateString() === new Date().toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Today ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center" flex={1}>
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack flex={1}>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Activity Logs</Text>
              <Text color={themeColors.textMuted} fontSize={11}>{logs.length} Recorded System Actions</Text>
            </YStack>
          </XStack>

          <TouchableOpacity onPress={handleRefresh}>
            <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
              <RefreshCw size={18} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        <YStack flex={1} p="$4" space="$3">

          {/* Search Bar */}
          <XStack px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center" space="$2">
            <Search size={16} color={themeColors.textMuted} />
            <TextInput
              placeholder="Search by action, user, description..."
              placeholderTextColor={themeColors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={{ flex: 1, color: themeColors.text, fontSize: 13 }}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <X size={14} color={themeColors.textMuted} />
              </TouchableOpacity>
            )}
          </XStack>

          {/* Action Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(['all', 'create', 'update', 'delete', 'login'] as const).map(act => {
              const isSelected = selectedAction === act;
              return (
                <TouchableOpacity key={act} onPress={() => setSelectedAction(act)}>
                  <YStack
                    px="$3"
                    py="$1.5"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor={isSelected ? '#34C759' : themeColors.borderColor}
                    backgroundColor={isSelected ? 'rgba(52, 199, 89, 0.15)' : themeColors.cardBackground}
                  >
                    <Text color={isSelected ? '#34C759' : themeColors.textMuted} fontSize={12} fontWeight={isSelected ? '800' : '600'}>
                      {act.toUpperCase()}
                    </Text>
                  </YStack>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Logs List */}
          {loading ? (
            <Spinner size="large" color="#34C759" py="$8" />
          ) : filteredLogs.length === 0 ? (
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
              <Text color={themeColors.textMuted} fontSize={13}>No activity log records found.</Text>
            </Card>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 60 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#34C759" />
              }
            >
              <YStack space="$2.5">
                {filteredLogs.map(item => {
                  const badge = getActionBadge(item.action);
                  const Icon = badge.icon;

                  return (
                    <Card key={item.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                      <YStack space="$2">
                        <XStack justifyContent="space-between" alignItems="center">
                          <XStack space="$2" alignItems="center">
                            <XStack backgroundColor={badge.bg} px="$2" py="$0.5" borderRadius="$2" alignItems="center" space="$1">
                              <Icon size={12} color={badge.color} />
                              <Text color={badge.color} fontSize={10} fontWeight="800">{badge.label}</Text>
                            </XStack>
                            <Text color={themeColors.text} fontSize={13} fontWeight="800">
                              {item.user_name || 'System User'}
                            </Text>
                          </XStack>

                          <Text color={themeColors.textMuted} fontSize={11}>
                            {formatDate(item.created_at)}
                          </Text>
                        </XStack>

                        <Text color={themeColors.text} fontSize={14} fontWeight="600" lineHeight={18}>
                          {item.description}
                        </Text>
                      </YStack>
                    </Card>
                  );
                })}
              </YStack>
            </ScrollView>
          )}

        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
