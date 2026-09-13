import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, TouchableOpacity, TextInput, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { ArrowLeft, Search, Plus, RefreshCw, ChevronRight, X } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLocalExpenses, getLocalGivingRecords, LocalExpense, LocalGivingRecord } from '../../lib/db';
import { syncExpenses, syncGivingRecords } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';

export default function ExpensesListScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [givingRecords, setGivingRecords] = useState<LocalGivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [localExp, localGiving] = await Promise.all([
        getLocalExpenses(),
        getLocalGivingRecords()
      ]);
      setExpenses(localExp);
      setGivingRecords(localGiving);

      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGivingRecords)).catch(() => {});
    } catch (err) {
      console.error('Failed to load expenses data:', err);
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
      await Promise.all([syncExpenses(), syncGivingRecords()]);
      const [updatedExp, updatedGiving] = await Promise.all([
        getLocalExpenses(),
        getLocalGivingRecords()
      ]);
      setExpenses(updatedExp);
      setGivingRecords(updatedGiving);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return expenses.filter(e => {
      return (
        (e.form_id || '').toLowerCase().includes(s) ||
        (e.details || '').toLowerCase().includes(s) ||
        (e.service_type || '').toLowerCase().includes(s) ||
        (e.payment_method_name || '').toLowerCase().includes(s)
      );
    });
  }, [expenses, searchTerm]);

  // Group Expenses by Service Date & Service Type (matching web version)
  const groupedExpenses = useMemo(() => {
    const map = new Map<string, LocalExpense[]>();
    filteredExpenses.forEach(exp => {
      const key = `${exp.service_date}|${exp.service_type || 'General'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    });

    return Array.from(map.entries()).map(([key, rows]) => {
      const [serviceDate, serviceType] = key.split('|');
      const subtotal = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

      // Find related giving for this service group
      const relatedGiving = givingRecords
        .filter(g => g.service_date === serviceDate && (g.service_name === serviceType || g.service_type === serviceType))
        .reduce((sum, g) => sum + (g.total_amount || 0), 0);

      const net = relatedGiving - subtotal;

      return {
        key,
        serviceDate,
        serviceType,
        subtotal,
        relatedGiving,
        net,
        rows
      };
    });
  }, [filteredExpenses, givingRecords]);

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
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Expenses Log</Text>
              <Text color={themeColors.textMuted} fontSize={11}>{expenses.length} Logged Expense Items</Text>
            </YStack>
          </XStack>

          <TouchableOpacity onPress={handleRefresh}>
            <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
              <RefreshCw size={18} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        <YStack flex={1} p="$4" space="$3">
          {/* Action Bar & Search */}
          <XStack space="$2" alignItems="center">
            <XStack flex={1} px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center" space="$2">
              <Search size={16} color={themeColors.textMuted} />
              <TextInput
                placeholder="Search by Form ID, description, category..."
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

            <TouchableOpacity onPress={() => router.push('/expenses/record' as any)}>
              <YStack px="$3" py="$2.5" borderRadius="$3" backgroundColor="#FF3B30" alignItems="center" justifyContent="center">
                <XStack space="$1" alignItems="center">
                  <Plus size={16} color="white" />
                  <Text color="white" fontSize={12} fontWeight="800">Expense</Text>
                </XStack>
              </YStack>
            </TouchableOpacity>
          </XStack>

          {/* Grouped Expenses List */}
          {loading ? (
            <Spinner size="large" color="#FF3B30" py="$6" />
          ) : groupedExpenses.length === 0 ? (
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground} alignItems="center">
              <Text color={themeColors.textMuted} fontSize={13}>No expense records found.</Text>
            </Card>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
              <YStack space="$4">
                {groupedExpenses.map(group => (
                  <YStack key={group.key} space="$2">
                    {/* Service Group Header */}
                    <Card p="$3" borderRadius="$3" backgroundColor={themeColors.borderColor} borderWidth={1} borderColor={themeColors.borderColor}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack>
                          <Text color={themeColors.text} fontSize={14} fontWeight="800">{group.serviceDate} • {group.serviceType}</Text>
                          {group.relatedGiving > 0 && (
                            <Text color={themeColors.textMuted} fontSize={10}>
                              Income: {formatGHS(group.relatedGiving)} • Net: {formatGHS(group.net)}
                            </Text>
                          )}
                        </YStack>

                        <Text color="#FF3B30" fontSize={14} fontWeight="900">
                          Subtotal: {formatGHS(group.subtotal)}
                        </Text>
                      </XStack>
                    </Card>

                    {/* Expense Row Cards */}
                    {group.rows.map(exp => (
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
                                Payment: {exp.payment_method_name} {exp.reference_number ? `(Ref: ${exp.reference_number})` : ''}
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
                    ))}
                  </YStack>
                ))}
              </YStack>
            </ScrollView>
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
