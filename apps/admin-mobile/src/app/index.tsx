import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { LogOut, Moon, RefreshCw, Sun } from 'lucide-react-native';
import { AppHeader, HeaderButton } from '../components/AppHeader';
import { BackupSection } from '../components/BackupSection';
import { ChecksSection, InfoSections, RecentFixesSection, SummaryTiles, ZoneFixSection } from '../components/DashboardSections';
import { AppText, Screen } from '../components/ui';
import { useAdminData } from '../context/AdminDataContext';
import { useAuth } from '../context/AuthContext';
import { useAppColors, useThemeContext } from '../context/ThemeContext';

export default function DashboardScreen() {
  const c = useAppColors();
  const { isDark, toggleTheme } = useThemeContext();
  const { session, signOut } = useAuth();
  const { report, loading, error, reload, version } = useAdminData();

  return (
    <Screen edges={['left', 'right']}>
      <AppHeader
        title="CoC.M Admin"
        subtitle={session?.user.email ?? undefined}
        right={
          <View style={{ flexDirection: 'row' }}>
            <HeaderButton icon={isDark ? Sun : Moon} label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggleTheme} />
            <HeaderButton icon={RefreshCw} label="Refresh" onPress={() => void reload()} disabled={loading} />
            <HeaderButton icon={LogOut} label="Sign out" onPress={() => void signOut()} />
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }}
        refreshControl={<RefreshControl refreshing={loading && !!report} onRefresh={() => void reload()} tintColor={c.primary.base} colors={[c.primary.base]} />}
      >
        {error ? (
          <View style={{ backgroundColor: c.danger.soft, borderRadius: 12, padding: 12 }}>
            <AppText variant="caption" tone="danger">
              {error}
            </AppText>
          </View>
        ) : null}

        {!report && loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator color={c.textSubtle} />
          </View>
        ) : null}

        {report ? (
          <>
            <SummaryTiles report={report} />
            <BackupSection lastBackupAt={report.backups.find((b) => b.status === 'completed')?.completedAt ?? null} onDone={() => void reload()} />
            <ZoneFixSection report={report} />
            <RecentFixesSection refreshKey={version} />
            <ChecksSection report={report} />
            <InfoSections report={report} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
