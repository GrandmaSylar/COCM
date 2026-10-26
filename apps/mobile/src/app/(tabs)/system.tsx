import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { enterUp } from '../../theme/animations';
import {
  BarChart3, Settings, ClipboardList, HelpCircle, CloudOff, CheckCircle2, AlertTriangle, RefreshCw, Palette,
} from '@tamagui/lucide-icons';
import { useThemeContext } from '../../context/ThemeContext';
import { useAccess } from '../../lib/access';
import { getSyncQueueStats } from '../../lib/db';
import { subscribeSyncQueue } from '../../lib/syncEngine';
import { AppText, ListRow, Section, SegmentedControl } from '../../components/ui';
import { space } from '../../theme/tokens';

const TOOLS = [
  {
    title: 'Reports & analytics',
    description: 'Attendance, giving, expenses and membership figures',
    icon: BarChart3,
    route: '/reports',
  },
  {
    title: 'Activity log',
    description: 'Who changed what, and when',
    icon: ClipboardList,
    route: '/logs',
  },
  {
    title: 'App & system settings',
    description: 'Users, roles, security, backups and preferences',
    icon: Settings,
    route: '/settings',
  },
  {
    title: 'Help & guides',
    description: 'Step-by-step instructions for every module',
    icon: HelpCircle,
    route: '/help',
  },
];

export default function SystemScreen() {
  const router = useRouter();
  const { preference, setThemeMode, colors } = useThemeContext();
  const { canRoute } = useAccess();
  const [queue, setQueue] = useState({ total: 0, pending: 0, syncing: 0, error: 0 });

  useEffect(() => {
    const load = () => getSyncQueueStats().then(setQueue).catch(() => {});
    load();
    return subscribeSyncQueue(load);
  }, []);

  const sync = queue.error > 0
    ? { icon: AlertTriangle, tone: 'danger' as const, title: `${queue.error} ${queue.error === 1 ? 'change' : 'changes'} failed to sync`, subtitle: 'Review and retry in the outbox' }
    : queue.syncing > 0
      ? { icon: RefreshCw, tone: 'info' as const, title: 'Syncing changes…', subtitle: `${queue.pending + queue.syncing} in progress` }
      : queue.pending > 0
        ? { icon: CloudOff, tone: 'warning' as const, title: `${queue.pending} ${queue.pending === 1 ? 'change' : 'changes'} waiting to sync`, subtitle: 'They upload automatically when online' }
        : { icon: CheckCircle2, tone: 'success' as const, title: 'All changes synced', subtitle: 'Offline outbox is empty' };

  const tools = TOOLS.filter(t => canRoute(t.route));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}
    >
      <Animated.View entering={enterUp()} style={{ gap: 4 }}>
        <AppText variant="display" accessibilityRole="header">System</AppText>
        <AppText variant="body" tone="muted">Sync, settings, reports and help.</AppText>
      </Animated.View>

      <Animated.View entering={enterUp(40)}>
        <Section title="Sync status">
          <ListRow
            icon={sync.icon}
            iconTone={sync.tone}
            title={sync.title}
            subtitle={sync.subtitle}
            onPress={() => router.push('/sync-diagnostics' as any)}
          />
        </Section>
      </Animated.View>

      <Animated.View entering={enterUp(80)}>
        <Section title="Appearance">
          <View style={{ padding: space.md, gap: space.sm }}>
            <SegmentedControl
              accessibilityLabel="Theme mode"
              value={preference}
              onChange={setThemeMode}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </View>
          {canRoute('/settings') ? (
            <ListRow
              icon={Palette}
              title="Theme colors"
              subtitle="Presets and custom colors, synced with the web app"
              onPress={() => router.push('/settings?section=appearance' as any)}
            />
          ) : null}
        </Section>
      </Animated.View>

      {tools.length > 0 ? (
        <Animated.View entering={enterUp(120)}>
          <Section title="Tools">
            {tools.map(tool => (
              <ListRow
                key={tool.route}
                icon={tool.icon}
                title={tool.title}
                subtitle={tool.description}
                onPress={() => router.push(tool.route as any)}
              />
            ))}
          </Section>
        </Animated.View>
      ) : null}

      <AppText variant="caption" tone="subtle" align="center">
        CoC.M Mobile · Version 1.0.0
      </AppText>
    </ScrollView>
  );
}
