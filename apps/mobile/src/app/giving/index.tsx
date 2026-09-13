import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { ArrowLeft, Search, Plus, RefreshCw, Settings, X } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLocalGivingRecords, LocalGivingRecord } from '../../lib/db';
import { syncGivingRecords } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';

export default function GivingHistoryScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();
  const [records, setRecords] = useState<LocalGivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getLocalGivingRecords();
      setRecords(cached);

      syncGivingRecords().then(() => getLocalGivingRecords().then(setRecords)).catch(() => {});
    } catch (err) {
      console.error('Failed to load giving records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncGivingRecords();
      const updated = await getLocalGivingRecords();
      setRecords(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const s = searchTerm.toLowerCase();
    return (
      (r.service_name || '').toLowerCase().includes(s) ||
      (r.service_type || '').toLowerCase().includes(s) ||
      (r.notes || '').toLowerCase().includes(s) ||
      (r.service_date || '').toLowerCase().includes(s)
    );
  });

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Navigation Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center" flex={1}>
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack flex={1}>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Giving & Offerings</Text>
              <Text color={themeColors.textMuted} fontSize={11}>{records.length} Recorded Services</Text>
            </YStack>
          </XStack>

          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.push('/giving/types' as any)}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <Settings size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRefresh}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <RefreshCw size={18} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
              </YStack>
            </TouchableOpacity>
          </XStack>
        </XStack>

        <YStack flex={1} p="$4" space="$3">
          {/* Action Bar & Search */}
          <XStack space="$2" alignItems="center">
            <XStack flex={1} px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center" space="$2">
              <Search size={16} color={themeColors.textMuted} />
              <TextInput
                placeholder="Search by service name, type, date..."
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

            <TouchableOpacity onPress={() => router.push('/giving/record' as any)}>
              <YStack px="$3" py="$2.5" borderRadius="$3" backgroundColor="#34C759" alignItems="center" justifyContent="center">
                <XStack space="$1" alignItems="center">
                  <Plus size={16} color="white" />
                  <Text color="white" fontSize={12} fontWeight="800">Record</Text>
                </XStack>
              </YStack>
            </TouchableOpacity>
          </XStack>

          {/* List of Giving Records */}
          {loading ? (
            <Spinner size="large" color="#34C759" py="$6" />
          ) : filteredRecords.length === 0 ? (
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
              <Text color={themeColors.textMuted} fontSize={13}>No giving records found.</Text>
            </Card>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
              <YStack space="$2.5">
                {filteredRecords.map((r) => (
                  <Card key={r.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                    <YStack space="$2">
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack flex={1}>
                          <Text color={themeColors.text} fontSize={16} fontWeight="800">
                            {r.service_name || r.service_type || 'Sunday Service'}
                          </Text>
                          <Text color={themeColors.textMuted} fontSize={12}>{r.service_date}</Text>
                        </YStack>
                        <Text color="#34C759" fontSize={17} fontWeight="900">
                          {formatGHS(r.total_amount)}
                        </Text>
                      </XStack>

                      {/* Offering Category Badges */}
                      <XStack space="$1.5" flexWrap="wrap">
                        {r.offering_amount > 0 && (
                          <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                            <Text color="#34C759" fontSize={11} fontWeight="700">
                              Offertory: {formatGHS(r.offering_amount)}
                            </Text>
                          </XStack>
                        )}
                        {r.thanksgiving_amount > 0 && (
                          <XStack backgroundColor="rgba(255, 149, 0, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                            <Text color="#FF9500" fontSize={11} fontWeight="700">
                              Thanksgiving: {formatGHS(r.thanksgiving_amount)}
                            </Text>
                          </XStack>
                        )}
                        {r.donation_amount > 0 && (
                          <XStack backgroundColor="rgba(0, 122, 255, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                            <Text color="#007AFF" fontSize={11} fontWeight="700">
                              Donation: {formatGHS(r.donation_amount)}
                            </Text>
                          </XStack>
                        )}
                      </XStack>

                      {/* Payment Method Badges */}
                      <XStack space="$1.5" flexWrap="wrap" pt="$1" borderTopWidth={1} borderColor={themeColors.borderColor}>
                        {r.cash_amount > 0 && (
                          <Text color={themeColors.textMuted} fontSize={10}>Cash: {formatGHS(r.cash_amount)}</Text>
                        )}
                        {r.mobile_money_amount > 0 && (
                          <Text color={themeColors.textMuted} fontSize={10}>MoMo: {formatGHS(r.mobile_money_amount)}</Text>
                        )}
                        {r.bank_transfer_amount > 0 && (
                          <Text color={themeColors.textMuted} fontSize={10}>Bank: {formatGHS(r.bank_transfer_amount)}</Text>
                        )}
                      </XStack>
                    </YStack>
                  </Card>
                ))}
              </YStack>
            </ScrollView>
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
