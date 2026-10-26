import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, RefreshControl, SectionList, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  RefreshCw, Plus, Pencil, Trash2, LogIn, LogOut, Activity, Download, Trash, ClipboardList,
} from '@tamagui/lucide-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalActivityLogs, LocalActivityLog } from '../../lib/db';
import { syncActivityLogs } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';
import { useAccess } from '../../lib/access';
import { SkeletonList } from '../../components/Skeleton';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { AppHeader } from '../../components/AppHeader';
import {
  AppText, Badge, EmptyState, FilterChips, IconButton, IconWell, Screen, SearchField, SegmentedControl, Tone, useToast,
} from '../../components/ui';
import { radius, space } from '../../theme/tokens';

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'login' | 'logout';

const ACTION_STYLE: Record<string, { tone: Tone; icon: React.ComponentType<any>; label: string }> = {
  create: { tone: 'success', icon: Plus, label: 'Created' },
  update: { tone: 'info', icon: Pencil, label: 'Updated' },
  delete: { tone: 'danger', icon: Trash2, label: 'Deleted' },
  login: { tone: 'primary', icon: LogIn, label: 'Signed in' },
  logout: { tone: 'neutral', icon: LogOut, label: 'Signed out' },
};

function actionStyle(action: string) {
  const act = (action || '').toLowerCase();
  return ACTION_STYLE[act] ?? { tone: 'warning' as Tone, icon: Activity, label: act ? act[0].toUpperCase() + act.slice(1) : 'Action' };
}

function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export default function ActivityLogsScreen() {
  const toast = useToast();
  const { colors: c } = useThemeContext();
  const { isDev, profile } = useAccess();
  const isAdmin = isDev || profile?.role === 'admin' || profile?.role === 'dev';

  const [logs, setLogs] = useState<LocalActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionFilter>('all');
  const [selectedEntity] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity });
      setLogs(cached);

      syncActivityLogs()
        .then(() => getLocalActivityLogs({ action: selectedAction, entityType: selectedEntity }).then(setLogs))
        .catch(() => {});
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAction, selectedEntity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase subscription
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

  const handleClearLogs = () => {
    Alert.alert(
      'Clear all activity logs?',
      'Every recorded action is permanently deleted for all users. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all logs',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await api.activityLog.clear();
              await syncActivityLogs();
              setLogs([]);
              toast.show({ title: 'Activity logs cleared' });
            } catch (err: any) {
              toast.show({ title: 'Couldn’t clear logs', message: err?.message, tone: 'error' });
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const filteredLogs = useMemo(() => {
    const s = searchTerm.toLowerCase();
    const now = new Date();

    return logs.filter(l => {
      const matchSearch = (
        (l.description || '').toLowerCase().includes(s) ||
        (l.user_name || '').toLowerCase().includes(s) ||
        (l.action || '').toLowerCase().includes(s) ||
        (l.entity_type || '').toLowerCase().includes(s)
      );
      if (!matchSearch) return false;

      if (selectedTimeRange !== 'all') {
        const logDate = new Date(l.created_at);
        if (selectedTimeRange === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (selectedTimeRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < weekAgo) return false;
        } else if (selectedTimeRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < monthAgo) return false;
        }
      }
      return true;
    });
  }, [logs, searchTerm, selectedTimeRange]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const header = 'ID,User,Action,Entity,Description,Timestamp\n';
      const rows = filteredLogs.map(l =>
        `"${l.id}","${l.user_name || ''}","${l.action || ''}","${l.entity_type || ''}","${(l.description || '').replace(/"/g, '""')}","${l.created_at}"`
      ).join('\n');

      const fileUri = `${FileSystem.documentDirectory}activity_logs_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
      toast.show({ title: `Exported ${filteredLogs.length} entries`, message: fileUri, duration: 5000 });
    } catch (err: any) {
      toast.show({ title: 'Export failed', message: err?.message, tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  // Group by calendar day for sticky date headers
  const sections = useMemo(() => {
    const groups: { title: string; data: LocalActivityLog[] }[] = [];
    let current: { title: string; data: LocalActivityLog[] } | null = null;
    for (const log of filteredLogs) {
      const title = dayLabel(new Date(log.created_at));
      if (!current || current.title !== title) {
        current = { title, data: [] };
        groups.push(current);
      }
      current.data.push(log);
    }
    return groups;
  }, [filteredLogs]);

  const hasFilters = !!searchTerm || selectedAction !== 'all' || selectedTimeRange !== 'all';

  return (
    <Screen>
      <AppHeader
        title="Activity log"
        subtitle={loading ? 'Loading…' : `${filteredLogs.length} ${filteredLogs.length === 1 ? 'entry' : 'entries'}`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={handleRefresh} />
            <IconButton icon={Download} label="Export as CSV" busy={exporting} onPress={handleExportCSV} />
            {isAdmin ? <IconButton icon={Trash} label="Clear all logs" tone="danger" busy={clearing} onPress={handleClearLogs} /> : null}
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm, backgroundColor: c.background }}>
        <SearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Search by user, action or description" />
        <FilterChips
          value={selectedAction}
          onChange={setSelectedAction}
          options={[
            { value: 'all', label: 'All actions' },
            { value: 'create', label: 'Created', icon: Plus },
            { value: 'update', label: 'Updated', icon: Pencil },
            { value: 'delete', label: 'Deleted', icon: Trash2 },
            { value: 'login', label: 'Sign-ins', icon: LogIn },
            { value: 'logout', label: 'Sign-outs', icon: LogOut },
          ]}
        />
        <SegmentedControl
          accessibilityLabel="Time range"
          value={selectedTimeRange}
          onChange={setSelectedTimeRange}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: '7 days' },
            { value: 'month', label: '30 days' },
          ]}
        />
      </View>

      {loading ? (
        <View style={{ padding: space.md }}>
          <SkeletonList count={6} hasAvatar={false} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
          ListEmptyComponent={
            <EmptyState
              icon={ClipboardList}
              title={hasFilters ? 'No matching activity' : 'No activity yet'}
              message={hasFilters ? 'Try a different search, action or time range.' : 'Actions taken in the web or mobile app appear here.'}
              action={hasFilters ? { label: 'Clear filters', onPress: () => { setSearchTerm(''); setSelectedAction('all'); setSelectedTimeRange('all'); } } : undefined}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: c.background, paddingTop: space.md, paddingBottom: space.xs }}>
              <AppText variant="captionStrong" tone="muted">{section.title}</AppText>
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const style = actionStyle(item.action);
            const first = index === 0;
            const last = index === section.data.length - 1;
            const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <Animated.View
                entering={index < 12 ? FadeIn.duration(200).delay(index * 25) : undefined}
                style={{
                  flexDirection: 'row',
                  gap: space.sm,
                  padding: space.md,
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderTopWidth: first ? 1 : 0,
                  borderBottomWidth: 1,
                  borderTopLeftRadius: first ? radius.lg : 0,
                  borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0,
                  borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <IconWell icon={style.icon} tone={style.tone} size={34} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyMedium">{item.description || style.label}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge label={style.label} tone={style.tone} />
                    <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {item.user_name || 'System user'} · {time}
                    </AppText>
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}
