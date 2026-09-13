import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { ArrowLeft, CheckCircle } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getLocalExpenses, LocalExpense } from '../../lib/db';
import { useThemeContext } from '../../context/ThemeContext';

export default function ExpenseReceiptScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<LocalExpense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExpense() {
      if (!id) return;
      setLoading(true);
      try {
        const exps = await getLocalExpenses();
        const found = exps.find(e => e.id === id);
        if (found) setExpense(found);
      } catch (err) {
        console.error('Failed to load expense receipt:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExpense();
  }, [id]);

  const formatGHS = (val?: number) => {
    if (val === undefined || val === null) return 'GH₵ 0.00';
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Navigation Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Expense Voucher</Text>
              <Text color={themeColors.textMuted} fontSize={11}>{expense?.form_id || 'Receipt Details'}</Text>
            </YStack>
          </XStack>
        </XStack>

        {loading ? (
          <Spinner size="large" color="#FF3B30" py="$6" />
        ) : !expense ? (
          <YStack flex={1} p="$4" justifyContent="center" alignItems="center">
            <Text color={themeColors.textMuted} fontSize={14}>Expense record not found.</Text>
          </YStack>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            <YStack space="$4">

              {/* Official Voucher Card */}
              <Card p="$5" borderRadius="$4" borderWidth={2} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                <YStack space="$4">

                  {/* Church Header Badge */}
                  <YStack alignItems="center" space="$1" borderBottomWidth={1} borderColor={themeColors.borderColor} pb="$3">
                    <Text color={themeColors.text} fontSize={18} fontWeight="900" textTransform="uppercase" letterSpacing={1}>
                      CITY OF DREAMS CHAPEL
                    </Text>
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">OFFICIAL EXPENSE DISBURSEMENT VOUCHER</Text>
                    <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$3" py="$1" borderRadius="$2" mt="$1">
                      <XStack space="$1" alignItems="center">
                        <CheckCircle size={12} color="#34C759" />
                        <Text color="#34C759" fontSize={10} fontWeight="800">STATUS: APPROVED</Text>
                      </XStack>
                    </XStack>
                  </YStack>

                  {/* Form ID & Date Header */}
                  <XStack justifyContent="space-between" alignItems="center" backgroundColor={themeColors.borderColor} p="$3" borderRadius="$3">
                    <YStack>
                      <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">FORM ID</Text>
                      <Text color="#FF3B30" fontSize={16} fontWeight="900">{expense.form_id}</Text>
                    </YStack>
                    <YStack alignItems="flex-end">
                      <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">SERVICE DATE</Text>
                      <Text color={themeColors.text} fontSize={14} fontWeight="800">{expense.service_date}</Text>
                    </YStack>
                  </XStack>

                  {/* Details & Amount */}
                  <YStack space="$2" py="$2">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">PURPOSE / DETAILS</Text>
                    <Text color={themeColors.text} fontSize={15} fontWeight="700" lineHeight={20}>
                      {expense.details}
                    </Text>

                    <YStack mt="$2" p="$3" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.08)" borderWidth={1} borderColor="rgba(255, 59, 48, 0.3)" alignItems="center">
                      <Text color={themeColors.textMuted} fontSize={10} fontWeight="800">DISBURSED AMOUNT</Text>
                      <Text color="#FF3B30" fontSize={26} fontWeight="900" mt="$1">
                        {formatGHS(expense.amount)}
                      </Text>
                    </YStack>
                  </YStack>

                  {/* Payment Details */}
                  <YStack space="$2" pt="$2" borderTopWidth={1} borderColor={themeColors.borderColor}>
                    <XStack justifyContent="space-between">
                      <Text color={themeColors.textMuted} fontSize={12}>Payment Method:</Text>
                      <Text color={themeColors.text} fontSize={12} fontWeight="800">{expense.payment_method_name}</Text>
                    </XStack>
                    <XStack justifyContent="space-between">
                      <Text color={themeColors.textMuted} fontSize={12}>Service Type Account:</Text>
                      <Text color={themeColors.text} fontSize={12} fontWeight="800">{expense.service_type}</Text>
                    </XStack>
                    {expense.reference_number && (
                      <XStack justifyContent="space-between">
                        <Text color={themeColors.textMuted} fontSize={12}>Transaction Ref:</Text>
                        <Text color={themeColors.text} fontSize={12} fontWeight="800">{expense.reference_number}</Text>
                      </XStack>
                    )}
                  </YStack>

                  {/* Authorization Personnel Tags */}
                  <YStack space="$2" pt="$3" borderTopWidth={1} borderColor={themeColors.borderColor}>
                    <Text color={themeColors.textMuted} fontSize={10} fontWeight="800" textTransform="uppercase">Authorization Personnel</Text>

                    <XStack justifyContent="space-between">
                      <Text color={themeColors.textMuted} fontSize={11}>Requested By:</Text>
                      <Text color={themeColors.text} fontSize={11} fontWeight="700">{expense.requested_by_name || 'Church Treasury'}</Text>
                    </XStack>
                    <XStack justifyContent="space-between">
                      <Text color={themeColors.textMuted} fontSize={11}>Recommended By:</Text>
                      <Text color={themeColors.text} fontSize={11} fontWeight="700">{expense.recommended_by_name || 'Senior Pastor / Executive'}</Text>
                    </XStack>
                    <XStack justifyContent="space-between">
                      <Text color={themeColors.textMuted} fontSize={11}>Approved By:</Text>
                      <Text color={themeColors.text} fontSize={11} fontWeight="700">{expense.approved_by_name || 'Finance Administrator'}</Text>
                    </XStack>
                  </YStack>

                </YStack>
              </Card>

            </YStack>
          </ScrollView>
        )}
      </YStack>
    </SafeAreaView>
  );
}
