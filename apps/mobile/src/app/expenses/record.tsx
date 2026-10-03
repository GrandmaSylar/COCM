import React, { useState, useEffect } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Pencil, Receipt, Save, UserCheck, Wallet } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import {
  getLocalCustomServices,
  getLocalExpensePaymentMethods,
  getLocalExpenses,
  getLocalMembers,
  upsertLocalExpense,
  LocalExpensePaymentMethod,
  LocalMember
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { api } from '../../lib/api';
import { pushOrQueue } from '../../lib/syncEngine';
import { AppHeader } from '../../components/AppHeader';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { MemberNameField } from '../../components/MemberNameField';
import { RequisitionForm } from '../../components/ExpenseRequisition';
import { useAppColors } from '../../context/ThemeContext';
import { AppText, Button, ChoiceChips, FieldGroup, FormSection, SaveBar, Screen, TextField, useToast } from '../../components/ui';
import { space } from '../../theme/tokens';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordExpenseScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const [errors, setErrors] = useState<{ details?: string; amount?: string }>({});

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

  const [members, setMembers] = useState<LocalMember[]>([]);
  const [requestedBy, setRequestedBy] = useState<{ id?: string; name: string }>({ name: '' });
  const [recommendedBy, setRecommendedBy] = useState<{ id?: string; name: string }>({ name: '' });
  const [approvedBy, setApprovedBy] = useState<{ id?: string; name: string }>({ name: '' });

  const [saving, setSaving] = useState(false);
  // Like the web: the form is checked on the requisition preview before saving.
  const [previewing, setPreviewing] = useState(false);
  const [expenseDate] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!previewing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saving) setPreviewing(false);
      return true;
    });
    return () => sub.remove();
  }, [previewing, saving]);

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

        // 2. Custom services, payment methods & members (for sign-off names)
        const [customSvcs, pms, localMembers] = await Promise.all([
          getLocalCustomServices(),
          getLocalExpensePaymentMethods(),
          getLocalMembers()
        ]);
        setMembers(localMembers);

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

  const requestedByName = requestedBy.name.trim();
  const recommendedByName = recommendedBy.name.trim();
  const approvedByName = approvedBy.name.trim();

  const handlePreview = () => {
    const numAmount = parseFloat(amount);
    const nextErrors = {
      details: details.trim() ? undefined : 'Describe what the money was spent on.',
      amount: !isNaN(numAmount) && numAmount > 0 ? undefined : 'Enter an amount greater than zero.',
    };
    setErrors(nextErrors);
    if (nextErrors.details || nextErrors.amount) {
      toast.show({ title: 'Check the highlighted fields', tone: 'warning' });
      return;
    }
    setPreviewing(true);
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
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
        requestedById: requestedByName ? requestedBy.id : undefined,
        requestedByName: requestedByName || undefined,
        recommendedById: recommendedByName ? recommendedBy.id : undefined,
        recommendedByName: recommendedByName || undefined,
        approvedById: approvedByName ? approvedBy.id : undefined,
        approvedByName: approvedByName || undefined,
        status: 'approved',
        createdAt: expenseDate
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
        requested_by_name: requestedByName || undefined,
        recommended_by_name: recommendedByName || undefined,
        approved_by_name: approvedByName || undefined,
        status: 'approved',
        created_at: expenseDate
      });

      // 2. Server push; queued in the outbox only if the server can't be reached
      //    (a swallowed failure used to lose offline expenses on the next sync)
      await pushOrQueue('POST', '/expenses', payload);

      toast.show({ title: 'Requisition saved', message: `${formId} · GH₵ ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` });
      // Open the saved requisition so it can be shared or printed straight away.
      router.replace(`/expenses/receipt?id=${recordId}` as any);
    } catch (err) {
      console.error('Failed to save expense record:', err);
      toast.show({ title: 'Couldn’t record expense', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (previewing) {
    return (
      <Screen>
        <AppHeader title="Requisition preview" subtitle={formId} showBack onBack={() => !saving && setPreviewing(false)} />
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.sm }}>
          <AppText variant="caption" tone="muted" align="center">Check the form before saving. You can share or print it afterwards.</AppText>
          <RequisitionForm
            data={{
              formId,
              details: details.trim(),
              amount: parseFloat(amount) || 0,
              expenseDate,
              requestedByName,
              recommendedByName,
              approvedByName,
            }}
          />
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.sm),
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <Button label="Edit" icon={Pencil} variant="secondary" flex={1} disabled={saving} onPress={() => setPreviewing(false)} />
          <Button label={saving ? 'Saving…' : 'Save requisition'} icon={Save} flex={1.6} loading={saving} onPress={handleSave} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Record expense" subtitle={`Requisition ${formId}`} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
          <FormSection title="Expense" icon={Receipt} description={`Form ${formId}`} state={details.trim() && parseFloat(amount) > 0 ? 'done' : 'needed'}>
            <TextField
              label="What was it for? *"
              value={details}
              onChangeText={t => { setDetails(t); if (errors.details) setErrors(e => ({ ...e, details: undefined })); }}
              placeholder="e.g. Generator fuel, sound system cables"
              multiline
              error={errors.details}
            />
            <TextField
              label="Amount *"
              prefix="GH₵"
              value={amount}
              onChangeText={t => { setAmount(t.replace(/[^0-9.]/g, '')); if (errors.amount) setErrors(e => ({ ...e, amount: undefined })); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={errors.amount}
            />
          </FormSection>

          <FormSection title="Service account" icon={CalendarDays} state="done">
            <NativeDatePicker label="Service date" value={serviceDate} onChange={setServiceDate} maxDate={new Date()} />
            <FieldGroup label="Service">
              <ChoiceChips options={availableServices} value={serviceType} onChange={setServiceType} />
            </FieldGroup>
          </FormSection>

          <FormSection title="Payment" icon={Wallet} state="done">
            <FieldGroup label="Method">
              <ChoiceChips
                options={paymentMethods.map(pm => ({ value: pm.id, label: pm.name }))}
                value={paymentMethodId ?? paymentMethods.find(pm => pm.name === paymentMethodName)?.id ?? ''}
                onChange={id => {
                  const pm = paymentMethods.find(x => x.id === id);
                  if (pm) { setPaymentMethodName(pm.name); setPaymentMethodId(pm.id); }
                }}
              />
            </FieldGroup>
            <TextField label="Reference number" value={referenceNumber} onChangeText={setReferenceNumber} placeholder="Transaction ref, cheque no. (optional)" />
          </FormSection>

          <FormSection title="Authorization" icon={UserCheck} description="Sign-off names from the member list" state={requestedByName || recommendedByName || approvedByName ? 'done' : 'optional'}>
            <MemberNameField label="Requested by" value={requestedBy.name} memberId={requestedBy.id} members={members} onChange={(id, name) => setRequestedBy({ id, name })} />
            <MemberNameField label="Recommended by" value={recommendedBy.name} memberId={recommendedBy.id} members={members} onChange={(id, name) => setRecommendedBy({ id, name })} />
            <MemberNameField label="Approved by" value={approvedBy.name} memberId={approvedBy.id} members={members} onChange={(id, name) => setApprovedBy({ id, name })} />
          </FormSection>
        </ScrollView>
        <SaveBar label={`Preview requisition${parseFloat(amount) > 0 ? ` · GH₵ ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}`} onPress={handlePreview} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
