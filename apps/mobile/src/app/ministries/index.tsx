import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ShieldCheck } from '@tamagui/lucide-icons';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { GroupRoster, RosterGroup } from '../../components/GroupRoster';
import { Screen } from '../../components/ui';
import { getLocalDb, getLocalDropdownOptions, LocalMember } from '../../lib/db';
import { space } from '../../theme/tokens';

const DEFAULT_MINISTRIES = ['Choir / Music', 'Protocol & Ushering', 'Media & IT', 'Prayer & Intercession', 'Evangelism & Outreach', 'Children Ministry'];

export default function MinistriesScreen() {
  const [ministries, setMinistries] = useState<RosterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMinistries = async () => {
    try {
      const db = await getLocalDb();

      // 1. Ministry names: Settings and the member forms store them under 'ministries'
      //    (this screen used to read 'ministry' and so always fell back to the defaults)
      let options = await getLocalDropdownOptions('ministries');
      if (options.length === 0) options = await getLocalDropdownOptions('ministry');
      const ministryNames = options.length > 0 ? options.map(o => o.label) : DEFAULT_MINISTRIES;

      // 2. Members from local SQLite
      const allMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');

      setMinistries(ministryNames.map(mName => ({
        key: mName,
        name: mName,
        members: (allMembers || []).filter(m => {
          if (!m.ministry) return false;
          return m.ministry.toLowerCase().includes(mName.toLowerCase()) || mName.toLowerCase().includes(m.ministry.toLowerCase());
        }),
      })));
    } catch (err) {
      console.warn('Error loading ministries roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMinistries();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMinistries();
  };

  return (
    <Screen>
      <AppHeader title="Ministries" subtitle={`${ministries.length} teams and departments`} showBack />
      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <GroupRoster
          groups={ministries}
          icon={ShieldCheck}
          memberNoun="volunteer"
          emptyTitle="No ministries configured"
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </Screen>
  );
}
