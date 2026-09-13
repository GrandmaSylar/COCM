import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { 
  getLocalGivingRecords, 
  getLocalExpenses, 
  LocalGivingRecord, 
  LocalExpense 
} from '../../lib/db';
import { syncGivingRecords, syncExpenses, syncCustomGivingTypes, syncExpensePaymentMethods } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';

export default function FinancesScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();
  const [activeTab, setActiveTab] = useState<'giving' | 'expenses'>('giving');
  const [givingRecords, setGivingRecords] = useState<LocalGivingRecord[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 0ms Cold Start from local SQLite
      const [localGiving, localExp] = await Promise.all([
        getLocalGivingRecords(),
        getLocalExpenses()
      ]);
      setGivingRecords(localGiving);
      setExpenses(localExp);

      // Background Sync
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGivingRecords)).catch(() => {});
      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncCustomGivingTypes().catch(() => {});
      syncExpensePaymentMethods().catch(() => {});
    } catch (err) {
      console.error('Failed to load finance data:', err);
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
      await Promise.all([
        syncGivingRecords(),
        syncExpenses(),
        syncCustomGivingTypes(),
        syncExpensePaymentMethods()
      ]);
      const [updatedGiving, updatedExp] = await Promise.all([
        getLocalGivingRecords(),
        getLocalExpenses()
      ]);
      setGivingRecords(updatedGiving);
      setExpenses(updatedExp);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute Total Financial Metrics
  const totalIncome = givingRecords.reduce((sum, g) => sum + (g.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <YStack flex={1} backgroundColor={themeColors.background}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF9500" />
        }
      >
        <YStack space="$4">

          {/* Subheader Title */}
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text color={themeColors.text} fontSize={22} fontWeight="900">Finances</Text>
              <Text color={themeColors.textMuted} fontSize={13}>Income, offerings, tithes & expenses registers</Text>
            </YStack>

            <TouchableOpacity onPress={handleRefresh}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <RefreshCw size={16} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
              </YStack>
            </TouchableOpacity>
          </XStack>

          {/* Financial Overview Summary Banner */}
          <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
            <YStack space="$3">
              <Text color={themeColors.textMuted} fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.5}>
                Financial Net Summary
              </Text>

              <XStack justifyContent="space-between" alignItems="center">
                <YStack>
                  <Text color={themeColors.text} fontSize={26} fontWeight="900">
                    {formatGHS(netBalance)}
                  </Text>
                  <Text color={netBalance >= 0 ? '#34C759' : '#FF3B30'} fontSize={12} fontWeight="800">
                    {netBalance >= 0 ? 'Positive Balance (Surplus)' : 'Deficit Balance'}
                  </Text>
                </YStack>

                <YStack p="$3" borderRadius="$4" backgroundColor={netBalance >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)'}>
                  {netBalance >= 0 ? <TrendingUp size={24} color="#34C759" /> : <TrendingDown size={24} color="#FF3B30" />}
                </YStack>
              </XStack>

              <XStack height={1} backgroundColor={themeColors.borderColor} my="$1" />

              <XStack justifyContent="space-between" alignItems="center">
                <XStack space="$2" alignItems="center">
                  <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(52, 199, 89, 0.15)">
                    <ArrowUpRight size={14} color="#34C759" />
                  </YStack>
                  <YStack>
                    <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">TOTAL GIVING</Text>
                    <Text color="#34C759" fontSize={13} fontWeight="800">{formatGHS(totalIncome)}</Text>
                  </YStack>
                </XStack>

                <YStack height={20} width={1} backgroundColor={themeColors.borderColor} />

                <XStack space="$2" alignItems="center">
                  <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(255, 59, 48, 0.15)">
                    <ArrowDownRight size={14} color="#FF3B30" />
                  </YStack>
                  <YStack>
                    <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">TOTAL EXPENSES</Text>
                    <Text color="#FF3B30" fontSize={13} fontWeight="800">{formatGHS(totalExpenses)}</Text>
                  </YStack>
                </XStack>
              </XStack>
            </YStack>
          </Card>

          {/* Quick Actions Single-Row Grid */}
          <XStack space="$2">
            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/giving/record' as any)}>
              <Card p="$3" borderRadius="$4" backgroundColor="rgba(52, 199, 89, 0.12)" borderWidth={1} borderColor="rgba(52, 199, 89, 0.3)" alignItems="center">
                <XStack space="$1.5" alignItems="center">
                  <Plus size={16} color="#34C759" />
                  <Text color="#34C759" fontSize={13} fontWeight="800">Giving</Text>
                </XStack>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/expenses/record' as any)}>
              <Card p="$3" borderRadius="$4" backgroundColor="rgba(255, 59, 48, 0.12)" borderWidth={1} borderColor="rgba(255, 59, 48, 0.3)" alignItems="center">
                <XStack space="$1.5" alignItems="center">
                  <Plus size={16} color="#FF3B30" />
                  <Text color="#FF3B30" fontSize={13} fontWeight="800">Expense</Text>
                </XStack>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/giving/types' as any)}>
              <Card p="$3" borderRadius="$4" backgroundColor="rgba(255, 149, 0, 0.12)" borderWidth={1} borderColor="rgba(255, 149, 0, 0.3)" alignItems="center">
                <XStack space="$1.5" alignItems="center">
                  <Settings size={16} color="#FF9500" />
                  <Text color="#FF9500" fontSize={13} fontWeight="800">Types</Text>
                </XStack>
              </Card>
            </TouchableOpacity>
          </XStack>

          {/* Segmented Control Sub-Tabs */}
          <XStack backgroundColor={isDark ? '#1C1C1E' : '#E5E5EA'} p="$1" borderRadius="$4">
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setActiveTab('giving')}
            >
              <YStack
                py="$2"
                borderRadius="$3"
                backgroundColor={activeTab === 'giving' ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                alignItems="center"
              >
                <Text
                  color={activeTab === 'giving' ? themeColors.text : themeColors.textMuted}
                  fontSize={13}
                  fontWeight={activeTab === 'giving' ? '800' : '600'}
                >
                  Giving History ({givingRecords.length})
                </Text>
              </YStack>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setActiveTab('expenses')}
            >
              <YStack
                py="$2"
                borderRadius="$3"
                backgroundColor={activeTab === 'expenses' ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                alignItems="center"
              >
                <Text
                  color={activeTab === 'expenses' ? themeColors.text : themeColors.textMuted}
                  fontSize={13}
                  fontWeight={activeTab === 'expenses' ? '800' : '600'}
                >
                  Expenses ({expenses.length})
                </Text>
              </YStack>
            </TouchableOpacity>
          </XStack>

          {/* Giving Tab Content */}
          {activeTab === 'giving' && (
            <YStack space="$2">
              {loading ? (
                <Spinner size="large" color="#34C759" py="$6" />
              ) : givingRecords.length === 0 ? (
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
                  <Text color={themeColors.textMuted} fontSize={13}>No giving records found.</Text>
                </Card>
              ) : (
                givingRecords.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => router.push(`/giving?id=${item.id}` as any)}>
                    <Card p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack flex={1} space="$1">
                          <Text color={themeColors.text} fontSize={15} fontWeight="800">
                            {item.service_name || item.service_type || 'Sunday Service'}
                          </Text>
                          <Text color={themeColors.textMuted} fontSize={11}>
                            {item.service_date} • {formatGHS(item.total_amount)}
                          </Text>
                          <XStack space="$1" flexWrap="wrap" mt="$1">
                            {item.offering_amount > 0 && (
                              <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                                <Text color="#34C759" fontSize={10} fontWeight="700">
                                  Offertory: {formatGHS(item.offering_amount)}
                                </Text>
                              </XStack>
                            )}
                            {item.thanksgiving_amount > 0 && (
                              <XStack backgroundColor="rgba(255, 149, 0, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                                <Text color="#FF9500" fontSize={10} fontWeight="700">
                                  Thanksgiving: {formatGHS(item.thanksgiving_amount)}
                                </Text>
                              </XStack>
                            )}
                          </XStack>
                        </YStack>

                        <YStack alignItems="flex-end" space="$1">
                          <Text color="#34C759" fontSize={15} fontWeight="900">
                            {formatGHS(item.total_amount)}
                          </Text>
                          <ChevronRight size={16} color={themeColors.textMuted} />
                        </YStack>
                      </XStack>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </YStack>
          )}

          {/* Expenses Tab Content */}
          {activeTab === 'expenses' && (
            <YStack space="$2">
              {loading ? (
                <Spinner size="large" color="#FF3B30" py="$6" />
              ) : expenses.length === 0 ? (
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
                  <Text color={themeColors.textMuted} fontSize={13}>No expense records logged yet.</Text>
                </Card>
              ) : (
                expenses.map((exp) => (
                  <TouchableOpacity key={exp.id} onPress={() => router.push(`/expenses/receipt?id=${exp.id}` as any)}>
                    <Card p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack flex={1} space="$1">
                          <XStack space="$2" alignItems="center">
                            <XStack backgroundColor="rgba(255, 59, 48, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                              <Text color="#FF3B30" fontSize={10} fontWeight="800">{exp.form_id}</Text>
                            </XStack>
                            <Text color={themeColors.text} fontSize={14} fontWeight="800" numberOfLines={1}>
                              {exp.details}
                            </Text>
                          </XStack>
                          <Text color={themeColors.textMuted} fontSize={11}>
                            {exp.service_date} • {exp.service_type} • {exp.payment_method_name}
                          </Text>
                        </YStack>

                        <YStack alignItems="flex-end" space="$1">
                          <Text color="#FF3B30" fontSize={15} fontWeight="900">
                            {formatGHS(exp.amount)}
                          </Text>
                          <ChevronRight size={16} color={themeColors.textMuted} />
                        </YStack>
                      </XStack>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </YStack>
          )}

        </YStack>
      </ScrollView>
    </YStack>
  );
}
