import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, TextInput, Alert as RNAlert, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { ArrowLeft, Check } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getLocalCustomGivingTypes, 
  getLocalCustomServices, 
  upsertLocalGivingRecord, 
  LocalCustomGivingType 
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { api } from '../../lib/api';
import { useThemeContext } from '../../context/ThemeContext';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordGivingScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('sunday_morning');
  const [serviceName, setServiceName] = useState(SUNDAY_MAIN_SERVICE);
  const [availableServices, setAvailableServices] = useState<string[]>([SUNDAY_MAIN_SERVICE]);

  // Standard Offerings
  const [offeringAmount, setOfferingAmount] = useState('');
  const [thanksgivingAmount, setThanksgivingAmount] = useState('');
  const [donationAmount, setDonationAmount] = useState('');

  // Dynamic Custom Types
  const [customGivingTypes, setCustomGivingTypes] = useState<LocalCustomGivingType[]>([]);
  const [customAmounts, setCustomAmounts] = useState<{ [key: string]: string }>({});

  // Payment Breakdown
  const [cashAmount, setCashAmount] = useState('');
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [bankTransferAmount, setBankTransferAmount] = useState('');

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [types, customSvcs] = await Promise.all([
          getLocalCustomGivingTypes(),
          getLocalCustomServices()
        ]);
        setCustomGivingTypes(types.filter(t => t.is_active === 1));

        const activeServiceNames = customSvcs
          .filter(s => s.is_active === 1 && s.name !== SUNDAY_MAIN_SERVICE)
          .map(s => s.name);
        setAvailableServices(Array.from(new Set([SUNDAY_MAIN_SERVICE, ...activeServiceNames])));
      } catch (err) {
        console.error('Failed to load giving options:', err);
      }
    }
    loadData();
  }, []);

  // Compute Total Giving Amount
  const parseVal = (v: string) => parseFloat(v) || 0;
  const customSum = Object.values(customAmounts).reduce((sum, v) => sum + parseVal(v), 0);
  const calculatedTotal = parseVal(offeringAmount) + parseVal(thanksgivingAmount) + parseVal(donationAmount) + customSum;

  const handleCustomAmountChange = (typeId: string, val: string) => {
    setCustomAmounts(prev => ({ ...prev, [typeId]: val }));
  };

  const handleSave = async () => {
    if (calculatedTotal <= 0) {
      RNAlert.alert('Invalid Amount', 'Please enter at least one offering amount.');
      return;
    }

    setSaving(true);
    try {
      const recordId = generateUUID();
      const customTypesObject: { [key: string]: number } = {};
      Object.entries(customAmounts).forEach(([k, v]) => {
        if (parseVal(v) > 0) customTypesObject[k] = parseVal(v);
      });

      const payload = {
        id: recordId,
        serviceName,
        serviceDate,
        serviceType,
        offerings: {
          offering: parseVal(offeringAmount),
          thanksgiving: parseVal(thanksgivingAmount),
          donation: parseVal(donationAmount),
          customTypes: customTypesObject
        },
        totalAmount: calculatedTotal,
        paymentBreakdown: {
          cash: parseVal(cashAmount),
          mobile_money: parseVal(mobileMoneyAmount),
          card: parseVal(cardAmount),
          bank_transfer: parseVal(bankTransferAmount)
        },
        notes: notes || undefined,
        createdAt: new Date().toISOString()
      };

      // 1. Save locally to SQLite immediately (0ms)
      await upsertLocalGivingRecord({
        id: recordId,
        service_name: serviceName,
        service_date: serviceDate,
        service_type: serviceType,
        offering_amount: parseVal(offeringAmount),
        thanksgiving_amount: parseVal(thanksgivingAmount),
        donation_amount: parseVal(donationAmount),
        custom_types: JSON.stringify(customTypesObject),
        total_amount: calculatedTotal,
        cash_amount: parseVal(cashAmount),
        mobile_money_amount: parseVal(mobileMoneyAmount),
        card_amount: parseVal(cardAmount),
        bank_transfer_amount: parseVal(bankTransferAmount),
        notes,
        created_at: new Date().toISOString()
      });

      // 2. Post to backend API
      try {
        await api.giving.create(payload);
      } catch (e) {
        console.warn('Backend giving create warning (cached locally):', e);
      }

      router.back();
    } catch (err) {
      console.error('Failed to save giving record:', err);
      RNAlert.alert('Error', 'Failed to record giving.');
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
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Record Giving</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Enter service offerings & payment breakdown</Text>
            </YStack>
          </XStack>
        </XStack>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <YStack space="$4">

            {/* Total Amount Summary Banner */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="rgba(52, 199, 89, 0.4)" backgroundColor="rgba(52, 199, 89, 0.08)" alignItems="center">
              <Text color={themeColors.textMuted} fontSize={11} fontWeight="800" textTransform="uppercase">TOTAL CALCULATED GIVING</Text>
              <Text color="#34C759" fontSize={30} fontWeight="900" mt="$1">
                GH₵ {calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Card>

            {/* Service & Date Selection */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">1. Service & Date Info</Text>

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
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">SELECT SERVICE TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {availableServices.map((name) => {
                      const isSelected = serviceName === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          onPress={() => {
                            setServiceName(name);
                            setServiceType(name === SUNDAY_MAIN_SERVICE ? 'sunday_morning' : 'other');
                          }}
                        >
                          <YStack
                            px="$3"
                            py="$1.5"
                            borderRadius="$3"
                            borderWidth={1}
                            borderColor={isSelected ? '#34C759' : themeColors.borderColor}
                            backgroundColor={isSelected ? 'rgba(52, 199, 89, 0.15)' : themeColors.background}
                          >
                            <Text color={isSelected ? '#34C759' : themeColors.textMuted} fontSize={12} fontWeight={isSelected ? '800' : '600'}>
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

            {/* Standard Offerings Breakdown */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">2. Standard Offering Categories (GH₵)</Text>

                <XStack space="$2">
                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">OFFERTORY</Text>
                    <TextInput
                      value={offeringAmount}
                      onChangeText={setOfferingAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>

                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">THANKSGIVING</Text>
                    <TextInput
                      value={thanksgivingAmount}
                      onChangeText={setThanksgivingAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>
                </XStack>

                <YStack space="$1">
                  <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">DONATIONS / SEED</Text>
                  <TextInput
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={themeColors.textMuted}
                    style={inputStyle}
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Custom Giving Categories Breakdown */}
            {customGivingTypes.length > 0 && (
              <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                <YStack space="$3">
                  <Text color={themeColors.text} fontSize={14} fontWeight="800">3. Custom Giving Categories (GH₵)</Text>

                  {customGivingTypes.map(t => (
                    <YStack key={t.id} space="$1">
                      <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">{t.name.toUpperCase()}</Text>
                      <TextInput
                        value={customAmounts[t.id] || ''}
                        onChangeText={(val) => handleCustomAmountChange(t.id, val)}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={themeColors.textMuted}
                        style={inputStyle}
                      />
                    </YStack>
                  ))}
                </YStack>
              </Card>
            )}

            {/* Payment Method Breakdown */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$3">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">4. Payment Method Breakdown (GH₵)</Text>

                <XStack space="$2">
                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">CASH</Text>
                    <TextInput
                      value={cashAmount}
                      onChangeText={setCashAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>

                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">MOBILE MONEY</Text>
                    <TextInput
                      value={mobileMoneyAmount}
                      onChangeText={setMobileMoneyAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>
                </XStack>

                <XStack space="$2">
                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">BANK TRANSFER</Text>
                    <TextInput
                      value={bankTransferAmount}
                      onChangeText={setBankTransferAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>

                  <YStack flex={1} space="$1">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">CARD</Text>
                    <TextInput
                      value={cardAmount}
                      onChangeText={setCardAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textMuted}
                      style={inputStyle}
                    />
                  </YStack>
                </XStack>
              </YStack>
            </Card>

            {/* Notes */}
            <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
              <YStack space="$2">
                <Text color={themeColors.text} fontSize={14} fontWeight="800">5. Additional Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional details or special instructions..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  style={{ ...inputStyle, minHeight: 60 }}
                />
              </YStack>
            </Card>

            {/* Save Button */}
            <Button backgroundColor="#34C759" size="$4" onPress={handleSave} disabled={saving}>
              {saving ? <Spinner color="white" /> : (
                <XStack space="$2" alignItems="center">
                  <Check size={18} color="white" />
                  <Text color="white" fontWeight="800" fontSize={14}>Save Giving Record</Text>
                </XStack>
              )}
            </Button>

          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
