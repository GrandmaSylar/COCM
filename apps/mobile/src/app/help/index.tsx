import React, { useState, useMemo } from 'react';
import { ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Paragraph } from 'tamagui';
import { ArrowLeft, Search, HelpCircle, ChevronDown, ChevronUp, BookOpen, Users, Calendar, Banknote, BarChart3, Settings, Shield, Plus, Eye, Pencil } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeContext } from '../../context/ThemeContext';

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
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Help & User Guides</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Feature walkthroughs & step-by-step instructions</Text>
            </YStack>
          </XStack>
        </XStack>

        <YStack flex={1} p="$4" space="$3">
          {/* Search Input */}
          <XStack px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center" space="$2">
            <Search size={16} color={themeColors.textMuted} />
            <TextInput
              placeholder="Search help topics, features, instructions..."
              placeholderTextColor={themeColors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={{ flex: 1, color: themeColors.text, fontSize: 13 }}
            />
          </XStack>

          {/* Guide Accordion List */}
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
            <YStack space="$3">
              {filteredGuides.map(guide => {
                const isExpanded = expandedIds.includes(guide.id);
                const Icon = guide.icon;

                return (
                  <Card key={guide.id} borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} overflow="hidden">
                    <TouchableOpacity onPress={() => toggleExpand(guide.id)}>
                      <XStack p="$4" justifyContent="space-between" alignItems="center">
                        <XStack space="$3" alignItems="center" flex={1}>
                          <YStack p="$2" borderRadius="$3" backgroundColor="rgba(0, 122, 255, 0.12)">
                            <Icon size={20} color="#007AFF" />
                          </YStack>
                          <YStack flex={1}>
                            <Text color={themeColors.text} fontSize={15} fontWeight="800">{guide.title}</Text>
                            <Paragraph color={themeColors.textMuted} fontSize={12} numberOfLines={isExpanded ? undefined : 1}>
                              {guide.description}
                            </Paragraph>
                          </YStack>
                        </XStack>
                        {isExpanded ? <ChevronUp size={20} color={themeColors.textMuted} /> : <ChevronDown size={20} color={themeColors.textMuted} />}
                      </XStack>
                    </TouchableOpacity>

                    {isExpanded && (
                      <YStack p="$4" pt="$0" space="$3" borderTopWidth={1} borderColor={themeColors.borderColor}>
                        {/* Roles Badge */}
                        <XStack space="$1.5" alignItems="center" mt="$2">
                          <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">AVAILABLE FOR:</Text>
                          {guide.roles.map(r => (
                            <XStack key={r} backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                              <Text color="#34C759" fontSize={10} fontWeight="800">{r}</Text>
                            </XStack>
                          ))}
                        </XStack>

                        {/* Steps List */}
                        <YStack space="$2.5" mt="$1">
                          {guide.steps.map((step, idx) => (
                            <YStack key={idx} p="$3" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                              <Text color={themeColors.text} fontSize={13} fontWeight="800">{idx + 1}. {step.title}</Text>
                              <Paragraph color={themeColors.textMuted} fontSize={12} mt="$1">
                                {step.description}
                              </Paragraph>
                              {step.note && (
                                <Text color="#FF9500" fontSize={11} fontWeight="700" mt="$1">
                                  Note: {step.note}
                                </Text>
                              )}
                            </YStack>
                          ))}
                        </YStack>
                      </YStack>
                    )}
                  </Card>
                );
              })}
            </YStack>
          </ScrollView>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
