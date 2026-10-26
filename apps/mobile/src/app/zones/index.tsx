import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MapPin } from '@tamagui/lucide-icons';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { GroupRoster, RosterGroup } from '../../components/GroupRoster';
import { Screen } from '../../components/ui';
import { getLocalDb, getLocalZones, LocalMember } from '../../lib/db';
import { space } from '../../theme/tokens';

export default function ZonesScreen() {
  const [zones, setZones] = useState<RosterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadZones = async () => {
    try {
      const db = await getLocalDb();

      // 1. Zones from SQLite
      const zoneRows = await getLocalZones();
      const zoneCodes = zoneRows.length > 0
        ? zoneRows.map(z => z.code || z.name)
        : ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Floating'];

      // 2. Members from local SQLite
      const allMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');

      setZones(zoneCodes.map(zCode => ({
        key: zCode,
        name: zCode.startsWith('Zone') ? zCode : `Zone ${zCode}`,
        members: (allMembers || []).filter(m => {
          if (!m.zone) return zCode === 'Floating' || zCode === 'Unassigned';
          return m.zone.toLowerCase() === zCode.toLowerCase() || m.zone.toLowerCase() === zCode.replace('Zone ', '').toLowerCase();
        }),
      })));
    } catch (err) {
      console.warn('Error loading zones roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadZones();
  };

  return (
    <Screen>
      <AppHeader title="Zones" subtitle={`${zones.length} care cell groups`} showBack />
      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <GroupRoster
          groups={zones}
          icon={MapPin}
          memberNoun="member"
          emptyTitle="No zones configured"
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </Screen>
  );
}
