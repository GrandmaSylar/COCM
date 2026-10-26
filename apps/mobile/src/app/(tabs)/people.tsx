import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Users, UserCheck, Baby } from '@tamagui/lucide-icons';
import { getLocalChildren, getLocalMembers, getLocalVisitors } from '../../lib/db';
import { HubScreen } from '../../components/HubScreen';

export default function PeopleScreen() {
  const [counts, setCounts] = useState<{ members?: number; visitors?: number; children?: number }>({});

  // Refresh the figures each time the tab comes into view (local SQLite, instant)
  useFocusEffect(
    useCallback(() => {
      Promise.all([getLocalMembers(), getLocalVisitors(), getLocalChildren()])
        .then(([m, v, c]) => setCounts({ members: m.length, visitors: v.length, children: c.length }))
        .catch(() => {});
    }, [])
  );

  const fmt = (n?: number) => (n === undefined ? undefined : n.toLocaleString());

  return (
    <HubScreen
      title="People"
      subtitle="Members, visitors and children."
      items={[
        {
          title: 'Members',
          description: 'Congregation directory, profiles and status',
          icon: Users,
          route: '/members',
          value: fmt(counts.members),
        },
        {
          title: 'Visitors',
          description: 'First-time guests and follow-up',
          icon: UserCheck,
          route: '/visitors',
          value: fmt(counts.visitors),
        },
        {
          title: 'Children',
          description: 'Children’s ministry, parents and attendance',
          icon: Baby,
          route: '/children',
          value: fmt(counts.children),
        },
      ]}
    />
  );
}
