import React, { useState, useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Printer, Receipt, Share2 } from '@tamagui/lucide-icons';
import { useLocalSearchParams } from 'expo-router';
import { getLocalExpenses, LocalExpense } from '../../lib/db';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { printRequisition, RequisitionForm, shareRequisitionPdf, toRequisitionData } from '../../components/ExpenseRequisition';
import { AppText, Badge, Button, DetailRow, EmptyState, Screen, Surface, useToast } from '../../components/ui';
import { space } from '../../theme/tokens';

export default function ExpenseReceiptScreen() {
  const c = useAppColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<LocalExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'share' | 'print' | null>(null);

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

  const run = async (kind: 'share' | 'print') => {
    if (!expense) return;
    setBusy(kind);
    try {
      const data = toRequisitionData(expense);
      if (kind === 'share') await shareRequisitionPdf(data);
      else await printRequisition(data);
    } catch (err) {
      console.error('Requisition export failed:', err);
      toast.show({ title: kind === 'share' ? 'Couldn’t create the PDF' : 'Couldn’t open printing', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const status = (expense?.status || 'approved').toLowerCase();
  const statusTone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';

  return (
    <Screen>
      <AppHeader title="Expense requisition" subtitle={expense?.form_id || 'Requisition form'} showBack />

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonCard lines={5} hasAvatar={false} /></View>
      ) : !expense ? (
        <EmptyState icon={Receipt} title="Requisition not found" message="This expense may have been removed." />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.md }}>
            <RequisitionForm data={toRequisitionData(expense)} />

            <Surface style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.xs }}>
                <AppText variant="micro" tone="muted">Record details</AppText>
                <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} tone={statusTone} icon={status === 'approved' ? CheckCircle : undefined} />
              </View>
              <DetailRow label="Service account" value={expense.service_type} />
              <DetailRow label="Service date" value={expense.service_date} />
              <DetailRow label="Payment method" value={expense.payment_method_name} />
              {expense.reference_number ? <DetailRow label="Reference" value={expense.reference_number} /> : null}
            </Surface>
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
            <Button label="Print" icon={Printer} variant="secondary" flex={1} loading={busy === 'print'} disabled={!!busy} onPress={() => run('print')} />
            <Button label="Share PDF" icon={Share2} flex={1.4} loading={busy === 'share'} disabled={!!busy} onPress={() => run('share')} />
          </View>
        </>
      )}
    </Screen>
  );
}
