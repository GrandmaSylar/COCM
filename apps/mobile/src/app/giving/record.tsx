import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AlertTriangle, Banknote, CalendarDays, FileText, Wallet } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import {
  getLocalCustomGivingTypes,
  getLocalCustomServices,
  upsertLocalGivingRecord,
  LocalCustomGivingType
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { pushOrQueue } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppText, ChoiceChips, FieldGroup, FormSection, SaveBar, Screen, Surface, TextField, useToast } from '../../components/ui';
import { radius, space } from '../../theme/tokens';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordGivingScreen() {
  const router = useRouter();
  const c = useAppColors();
  const toast = useToast();
  const [amountError, setAmountError] = useState<string | null>(null);

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
      setAmountError('Enter at least one offering amount.');
      toast.show({ title: 'Nothing to save yet', message: 'Enter at least one offering amount.', tone: 'warning' });
      return;
    }
    setAmountError(null);

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

      // 2. Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/giving', payload);

      toast.show({ title: 'Giving recorded', message: `${serviceName} · GH₵ ${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` });
      router.back();
    } catch (err) {
      console.error('Failed to save giving record:', err);
      toast.show({ title: 'Couldn’t record giving', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const ghs = (n: number) => `GH₵ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const paymentSum = parseVal(cashAmount) + parseVal(mobileMoneyAmount) + parseVal(cardAmount) + parseVal(bankTransferAmount);
  const paymentMismatch = paymentSum > 0 && Math.abs(paymentSum - calculatedTotal) > 0.009;
  const money = (label: string, value: string, set: (v: string) => void) => (
    <View style={{ flex: 1 }}>
      <TextField
        label={label}
        prefix="GH₵"
        value={value}
        onChangeText={v => { set(v.replace(/[^0-9.]/g, '')); if (amountError) setAmountError(null); }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        selectTextOnFocus
      />
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Record giving" subtitle="Offerings and payment breakdown" showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
          <Surface style={{ alignItems: 'center', gap: 4, backgroundColor: c.success.soft, borderColor: c.success.base }}>
            <AppText variant="captionStrong" tone="muted">Total giving</AppText>
            <AppText variant="display" tone="success" numeric>{ghs(calculatedTotal)}</AppText>
            {amountError ? <AppText variant="caption" tone="danger">{amountError}</AppText> : null}
          </Surface>

          <FormSection title="Service" icon={CalendarDays} state="done">
            <NativeDatePicker label="Service date" value={serviceDate} onChange={setServiceDate} maxDate={new Date()} />
            <FieldGroup label="Service">
              <ChoiceChips
                options={availableServices}
                value={serviceName}
                onChange={name => { setServiceName(name); setServiceType(name === SUNDAY_MAIN_SERVICE ? 'sunday_morning' : 'other'); }}
              />
            </FieldGroup>
          </FormSection>

          <FormSection title="Offerings" icon={Banknote} description="The total adds these up" state={calculatedTotal > 0 ? 'done' : 'needed'}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {money('Offertory', offeringAmount, setOfferingAmount)}
              {money('Thanksgiving', thanksgivingAmount, setThanksgivingAmount)}
            </View>
            {money('Donations / seed', donationAmount, setDonationAmount)}
            {customGivingTypes.length > 0 ? (
              <>
                <AppText variant="label" tone="muted">Other categories</AppText>
                {customGivingTypes.map(t => (
                  <View key={t.id}>{money(t.name, customAmounts[t.id] || '', v => handleCustomAmountChange(t.id, v))}</View>
                ))}
              </>
            ) : null}
          </FormSection>

          <FormSection title="Payment methods" icon={Wallet} description="How the money was received" state={paymentSum > 0 ? (paymentMismatch ? 'needed' : 'done') : 'optional'}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {money('Cash', cashAmount, setCashAmount)}
              {money('Mobile money', mobileMoneyAmount, setMobileMoneyAmount)}
            </View>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {money('Bank transfer', bankTransferAmount, setBankTransferAmount)}
              {money('Card', cardAmount, setCardAmount)}
            </View>
            {paymentMismatch ? (
              <View style={{ flexDirection: 'row', gap: 10, padding: space.sm, borderRadius: radius.md, backgroundColor: c.warning.soft }}>
                <AlertTriangle size={18} color={c.warning.text} />
                <AppText variant="caption" tone="warning" style={{ flex: 1 }}>
                  Payment methods add up to {ghs(paymentSum)}, but the offerings total {ghs(calculatedTotal)}.
                </AppText>
              </View>
            ) : null}
          </FormSection>

          <FormSection title="Notes" icon={FileText} state={notes ? 'done' : 'optional'} defaultOpen={false}>
            <TextField value={notes} onChangeText={setNotes} placeholder="Optional details" multiline accessibilityLabel="Notes" />
          </FormSection>
        </ScrollView>
        <SaveBar label={saving ? 'Saving…' : `Save · ${ghs(calculatedTotal)}`} loading={saving} onPress={handleSave} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
