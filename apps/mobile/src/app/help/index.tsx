import React, { useState, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BookOpen, Users, Calendar, Banknote, BarChart3, Settings, Shield, ChevronDown, Info, SearchX } from '@tamagui/lucide-icons';
import { useThemeContext } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { AppText, Badge, EmptyState, IconWell, PressableScale, Screen, SearchField, Surface } from '../../components/ui';
import { motion, radius, space } from '../../theme/tokens';

interface GuideItem {
  id: string;
  title: string;
  icon: any;
  description: string;
  roles: string[];
  steps: {
    title: string;
    description: string;
    note?: string;
  }[];
}

const FEATURE_GUIDES: GuideItem[] = [
  {
    id: 'dashboard',
    title: '1. Dashboard & Overview',
    icon: BookOpen,
    description: 'Central hub for quick access to key church metrics and daily quick action tools.',
    roles: ['Admin', 'Pastor', 'Elder', 'Leader'],
    steps: [
      {
        title: 'View Summary Metrics',
        description: 'Displays real-time counts for Total Members, Weekly Attendance, Monthly Giving, and New Members.',
        note: 'Metrics automatically sync in background upon launch.'
      },
      {
        title: 'Quick Actions Bar',
        description: 'Single-tap shortcuts to Add Member, Record Attendance, Record Giving, Add Visitor, and Check In.',
      }
    ]
  },
  {
    id: 'members',
    title: '2. Member Management',
    icon: Users,
    description: 'Register congregation members, assign zone numbers, and track status.',
    roles: ['Admin', 'Pastor', 'Elder'],
    steps: [
      {
        title: 'Search & Filter Members',
        description: 'Search by name, zone number, or phone. Filter by status (Active, Semi-Active, Inactive, New).',
      },
      {
        title: 'Add & Edit Profiles',
        description: 'Tap Add New Member to register personal info, zone assignment, family matching, and passport photo.',
        note: 'Member status automatically recalculates based on last 4 Sunday services.'
      }
    ]
  },
  {
    id: 'attendance',
    title: '3. Attendance Tracking',
    icon: Calendar,
    description: 'Mark registers for Sunday Main Service, Cell Groups, or custom events.',
    roles: ['Admin', 'Pastor', 'Elder', 'Leader'],
    steps: [
      {
        title: 'Mark Individual Check-In',
        description: 'Search members and check them in during services. Live state updates across all connected devices.',
      },
      {
        title: 'General Head Count',
        description: 'Record general head counts (Men, Women, Children, Visitors) for large gatherings.',
      }
    ]
  },
  {
    id: 'giving',
    title: '4. Giving & Offerings',
    icon: Banknote,
    description: 'Log offertory, thanksgiving, donations, cell group collections, and custom giving categories.',
    roles: ['Admin', 'Pastor', 'Treasury'],
    steps: [
      {
        title: 'Record Service Offerings',
        description: 'Enter service date, select service type, fill category breakdown, and specify payment method (Cash, MoMo, Bank, Card).',
      },
      {
        title: 'Custom Categories',
        description: 'Manage dynamic giving categories (Building Fund, Harvest, etc.) under Types.',
      }
    ]
  },
  {
    id: 'expenses',
    title: '5. Expenses & Vouchers',
    icon: Settings,
    description: 'Capture disbursement vouchers, form IDs (EXP-XXXX), and authorization signatures.',
    roles: ['Admin', 'Pastor', 'Treasury'],
    steps: [
      {
        title: 'Record Expense Voucher',
        description: 'Enter purpose details, amount, service account, payment method, and personnel authorization tags.',
      },
      {
        title: 'View Official Voucher',
        description: 'Tap any expense to view and print the official disbursement receipt.',
      }
    ]
  },
  {
    id: 'reports',
    title: '6. Reports & Analytics',
    icon: BarChart3,
    description: 'Generate demographic breakdown graphs, attendance trends, and financial surplus/deficit metrics.',
    roles: ['Admin', 'Pastor', 'Executive'],
    steps: [
      {
        title: 'Period Filtering',
        description: 'Filter metrics by This Month, This Quarter, This Year, or All Time.',
      },
      {
        title: 'Demographic Distribution',
        description: 'Review Active vs Inactive ratio, Male/Female distribution, and giving category sub-totals.',
      }
    ]
  },
  {
    id: 'system',
    title: '7. System Settings & Diagnostics',
    icon: Shield,
    description: 'Configure dynamic dropdown options, light/dark themes, and inspect SQLite offline sync status.',
    roles: ['Admin', 'Dev'],
    steps: [
      {
        title: 'Dynamic Options Manager',
        description: 'Add, edit, or toggle active status for Ministries, Positions, and Payment Methods.',
      },
      {
        title: 'Offline Outbox Diagnostics',
        description: 'View pending offline mutations and flush queue directly to the server.',
      }
    ]
  }
];

export default function HelpScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>(['dashboard']);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredGuides = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return FEATURE_GUIDES.filter(g => {
      return (
        g.title.toLowerCase().includes(s) ||
        g.description.toLowerCase().includes(s) ||
        g.steps.some(st => st.title.toLowerCase().includes(s) || st.description.toLowerCase().includes(s))
      );
    });
  }, [searchTerm]);

  return (
    <Screen>
      <AppHeader title="Help & guides" subtitle="How each part of the app works" showBack />

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.sm }} keyboardShouldPersistTaps="handled">
        <SearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Search topics and instructions" />

        {filteredGuides.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No guides found"
            message={`Nothing matches "${searchTerm}".`}
            action={{ label: 'Clear search', onPress: () => setSearchTerm('') }}
          />
        ) : (
          filteredGuides.map(guide => (
            <GuideCard
              key={guide.id}
              guide={guide}
              expanded={expandedIds.includes(guide.id) || !!searchTerm}
              onToggle={() => toggleExpand(guide.id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function GuideCard({ guide, expanded, onToggle }: { guide: GuideItem; expanded: boolean; onToggle: () => void }) {
  const { colors: c } = useThemeContext();
  // Titles in the guide data are numbered ("1. Dashboard"); the card shows the number separately
  const match = guide.title.match(/^(\d+)\.\s*(.*)$/);
  const number = match?.[1];
  const title = match?.[2] ?? guide.title;

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: motion.base }) }],
  }), [expanded]);

  return (
    <Surface padded={false}>
      <PressableScale
        onPress={onToggle}
        haptics="selection"
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${guide.description}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}
      >
        <IconWell icon={guide.icon} tone="primary" size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={expanded ? undefined : 1}>{guide.description}</AppText>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color={c.textSubtle} />
        </Animated.View>
      </PressableScale>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <AppText variant="caption" tone="muted">For</AppText>
            {guide.roles.map(r => <Badge key={r} label={r} tone="neutral" />)}
            {number ? <AppText variant="caption" tone="subtle" style={{ marginLeft: 'auto' }}>Guide {number}</AppText> : null}
          </View>

          <View style={{ gap: 0 }}>
            {guide.steps.map((step, idx) => {
              const last = idx === guide.steps.length - 1;
              return (
                <View key={idx} style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary.soft, alignItems: 'center', justifyContent: 'center' }}>
                      <AppText variant="micro" tone="primary">{idx + 1}</AppText>
                    </View>
                    {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginVertical: 4 }} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4, paddingBottom: last ? 0 : space.md }}>
                    <AppText variant="bodyStrong">{step.title}</AppText>
                    <AppText variant="caption" tone="muted">{step.description}</AppText>
                    {step.note ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, padding: 10, borderRadius: radius.sm, backgroundColor: c.info.soft }}>
                        <Info size={16} color={c.info.text} />
                        <AppText variant="caption" color={c.info.text} style={{ flex: 1 }}>{step.note}</AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
    </Surface>
  );
}
