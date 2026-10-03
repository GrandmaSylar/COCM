import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { CalendarCheck, ShieldCheck, MapPin } from '@tamagui/lucide-icons';
import { getLocalAttendanceRecords, getLocalDropdownOptions, getLocalZones } from '../../lib/db';
import { HubScreen } from '../../components/HubScreen';

export default function OperationsScreen() {
  const [info, setInfo] = useState<{ lastService?: string; ministries?: number; zones?: number }>({});

  useFocusEffect(
    useCallback(() => {
      Promise.all([getLocalAttendanceRecords(), getLocalDropdownOptions('ministries'), getLocalZones()])
        .then(([records, ministries, zones]) => {
          const latest = records
            .map(r => r.date)
            .filter(Boolean)
            .sort()
            .pop();
          setInfo({
            lastService: latest
              ? new Date(latest).toLocaleDateString([], { day: 'numeric', month: 'short' })
              : undefined,
            ministries: ministries.filter(m => m.is_active !== 0).length,
            zones: zones.length,
          });
        })
        .catch(() => {});
    }, [])
  );

  return (
    <HubScreen
      title="Operations"
      subtitle="Services, ministries and care zones."
      items={[
        {
          title: 'Attendance',
          description: info.lastService ? `Last recorded ${info.lastService}` : 'Mark registers and head counts',
          icon: CalendarCheck,
          route: '/attendance',
        },
        {
          title: 'Ministries',
          description: 'Volunteer teams and departments',
          icon: ShieldCheck,
          route: '/ministries',
          value: info.ministries !== undefined ? String(info.ministries) : undefined,
        },
        {
          title: 'Zones',
          description: 'Geographic care cell groups',
          icon: MapPin,
          route: '/zones',
          value: info.zones !== undefined ? String(info.zones) : undefined,
        },
      ]}
    />
  );
}
