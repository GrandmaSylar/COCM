import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, TextInput, Alert as RNAlert, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { ArrowLeft, Check } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getLocalCustomServices, 
  getLocalExpensePaymentMethods, 
  getLocalExpenses,
  upsertLocalExpense, 
  LocalExpensePaymentMethod 
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { api } from '../../lib/api';
import { useThemeContext } from '../../context/ThemeContext';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordExpenseScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

  const [formId, setFormId] = useState('EXP-0001');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('General');
  const [availableServices, setAvailableServices] = useState<string[]>(['General', SUNDAY_MAIN_SERVICE]);

  const [paymentMethods, setPaymentMethods] = useState<LocalExpensePaymentMethod[]>([]);
  const [paymentMethodName, setPaymentMethodName] = useState('Cash');
  const [paymentMethodId, setPaymentMethodId] = useState<string | undefined>(undefined);
  const [referenceNumber, setReferenceNumber] = useState('');

  const [requestedByName, setRequestedByName] = useState('');
  const [recommendedByName, setRecommendedByName] = useState('');
  const [approvedByName, setApprovedByName] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function initForm() {
      try {
        // 1. Next Form ID
        try {
          const res = await api.expenses.getNextFormId();
          if (res && res.nextFormId) {
            setFormId(res.nextFormId);
          }
        } catch (err) {
          const exps = await getLocalExpenses();
          let maxNum = 0;
          exps.forEach(e => {
            const match = (e.form_id || '').match(/^EXP-(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          });
          setFormId(`EXP-${String(maxNum + 1).padStart(4, '0')}`);
        }

        // 2. Custom services & payment methods
        const [customSvcs, pms] = await Promise.all([
          getLocalCustomServices(),
          getLocalExpensePaymentMethods()
        ]);

        const activeServiceNames = customSvcs.filter(s => s.is_active === 1).map(s => s.name);
        setAvailableServices(Array.from(new Set(['General', SUNDAY_MAIN_SERVICE, ...activeServiceNames])));

        if (pms && pms.length > 0) {
          setPaymentMethods(pms.filter(p => p.is_active === 1));
          setPaymentMethodName(pms[0].name);
          setPaymentMethodId(pms[0].id);
        } else {
          setPaymentMethods([
            { id: 'cash', name: 'Cash', is_active: 1 },
            { id: 'momo', name: 'Mobile Money', is_active: 1 },
            { id: 'bank', name: 'Bank Transfer', is_active: 1 },
            { id: 'cheque', name: 'Cheque', is_active: 1 }
          ]);
        }
      } catch (err) {
        console.error('Failed to init expense form:', err);
      }
    }
    initForm();
  }, []);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!details.trim()) {
      RNAlert.alert('Validation Error', 'Expense details/description is required.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      RNAlert.alert('Validation Error', 'Please enter a valid expense amount.');
      return;
    }

    setSaving(true);
    try {
      const recordId = generateUUID();

      const payload = {
        id: recordId,
        formId,
        details: details.trim(),
        amount: numAmount,
        serviceDate,
        serviceType,
        paymentMethodId,
        paymentMethodName,
        referenceNumber: referenceNumber.trim() || undefined,
        requestedByName: requestedByName.trim() || undefined,
        recommendedByName: recommendedByName.trim() || undefined,
        approvedByName: approvedByName.trim() || undefined,
        status: 'approved',
        createdAt: new Date().toISOString()
      };

      // 1. Save locally to SQLite immediately (0ms)
      await upsertLocalExpense({
        id: recordId,
        form_id: formId,
        details: details.trim(),
        amount: numAmount,
        service_date: serviceDate,
        service_type: serviceType,
        payment_method_id: paymentMethodId,
        payment_method_name: paymentMethodName,
        reference_number: referenceNumber.trim() || undefined,
        requested_by_name: requestedByName.trim() || undefined,
        recommended_by_name: recommendedByName.trim() || undefined,
        approved_by_name: approvedByName.trim() || undefined,
        status: 'approved',
        created_at: new Date().toISOString()
      });

      // 2. Post to backend API
      try {
        await api.expenses.create(payload);
      } catch (e) {
        console.warn('Backend expense create warning (cached locally):', e);
      }

      router.back();
    } catch (err) {
      console.error('Failed to save expense record:', err);
      RNAlert.alert('Error', 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    color: themeColors.text,
    backgroundColor: themeColors.cardBackground,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
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
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Record Expense</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Form Voucher {formId}</Text>
            </YStack>
          </XStack>
        </XStack>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <YStack space="$4">

            {/* Form Voucher ID Badge Banner */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="rgba(255, 59, 48, 0.4)" backgroundColor="rgba(255, 59, 48, 0.08)" alignItems="center">
              <Text color={themeColors.textMuted} fontSize={11} fontWeight="800" textTransform="uppercase">OFFICIAL EXPENSE FORM ID</Text>
              <Text color="#FF3B30" fontSize={26} fontWeight="900" mt="$1">
                {formId}
              </Text>
            </Card>

            {/* General Expense Details */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">1. Expense Details</Text>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">PURPOSE / DETAILS *</Text>
                  <TextInput
                    value={details}
                    onChangeText={setDetails}
                    placeholder="e.g. Purchase of Media Sound System Cables, Generator Fuel..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    style={{ ...inputStyle, minHeight: 60 }}
                  />
                </YStack>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">AMOUNT (GH₵) *</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={themeColors.textMuted}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: '800' }}
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Service & Date Info */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">2. Service Account Info</Text>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">SERVICE DATE (YYYY-MM-DD)</Text>
                  <TextInput
                    value={serviceDate}
                    onChangeText={setServiceDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">SERVICE TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {availableServices.map((name) => {
                      const isSelected = serviceType === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          onPress={() => setServiceType(name)}
                        >
                          <YStack
                            px="$3"
                            py="$1.5"
                            borderRadius="$3"
                            borderWidth={1}
                            borderColor={isSelected ? '#FF3B30' : themeColors.borderColor}
                            backgroundColor={isSelected ? 'rgba(255, 59, 48, 0.15)' : themeColors.background}
                          >
                            <Text color={isSelected ? '#FF3B30' : themeColors.textMuted} fontSize={12} fontWeight={isSelected ? '800' : '600'}>
                              {name}
                            </Text>
                          </YStack>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </YStack>
              </YStack>
            </Card>

            {/* Payment Method Selector */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">3. Payment Method</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {paymentMethods.map((pm) => {
                    const isSelected = paymentMethodName === pm.name;
                    return (
                      <TouchableOpacity
                        key={pm.id}
                        onPress={() => {
                          setPaymentMethodName(pm.name);
                          setPaymentMethodId(pm.id);
                        }}
                      >
                        <YStack
                          px="$3"
                          py="$1.5"
                          borderRadius="$3"
                          borderWidth={1}
                          borderColor={isSelected ? '#FF9500' : themeColors.borderColor}
                          backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : themeColors.background}
                        >
                          <Text color={isSelected ? '#FF9500' : themeColors.textMuted} fontSize={12} fontWeight={isSelected ? '800' : '600'}>
                            {pm.name}
                          </Text>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">REFERENCE NUMBER (OPTIONAL)</Text>
                  <TextInput
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="e.g. Transaction Ref, Cheque No..."
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Personnel Signatures */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">4. Personnel Authorization Tags (Optional)</Text>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">REQUESTED BY</Text>
                  <TextInput
                    value={requestedByName}
                    onChangeText={setRequestedByName}
                    placeholder="Name of person requesting expense..."
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">RECOMMENDED BY</Text>
                  <TextInput
                    value={recommendedByName}
                    onChangeText={setRecommendedByName}
                    placeholder="Name of recommender..."
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">APPROVED BY</Text>
                  <TextInput
                    value={approvedByName}
                    onChangeText={setApprovedByName}
                    placeholder="Name of approver..."
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Save Button */}
            <Button backgroundColor="#FF3B30" size="$4" onPress={handleSave} disabled={saving}>
              {saving ? <Spinner color="white" /> : (
                <XStack space="$2" alignItems="center">
                  <Check size={18} color="white" />
                  <Text color="white" fontWeight="800" fontSize={14}>Save Expense Record</Text>
                </XStack>
              )}
            </Button>

          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
