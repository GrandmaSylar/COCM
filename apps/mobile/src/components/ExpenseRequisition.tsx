import React, { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LocalExpense } from '../lib/db';

/**
 * The official expense requisition form, matching the web app's PDF
 * (apps/cocm/src/utils/export.ts → generateExpenseRequisitionPDF).
 * It is a printed document, so it keeps paper colours in dark mode too.
 */

export interface RequisitionData {
  formId: string;
  details: string;
  amount: number;
  /** Date the requisition was raised (the web's expenseDate). */
  expenseDate?: string;
  requestedByName?: string;
  recommendedByName?: string;
  approvedByName?: string;
}

export function toRequisitionData(e: LocalExpense): RequisitionData {
  return {
    formId: e.form_id,
    details: e.details,
    amount: e.amount,
    expenseDate: e.created_at,
    requestedByName: e.requested_by_name,
    recommendedByName: e.recommended_by_name,
    approvedByName: e.approved_by_name,
  };
}

const LOGO = require('../../assets/requisition-logo.png');

const PAPER = '#FFFFFF';
const INK = '#111111';
const RED = '#CB2D2C';
const BANNER = '#18182B';
const SERIF = Platform.select({ ios: 'Times New Roman', default: 'serif' });

const MIN_DETAIL_LINES = 4;
const DETAIL_LINE = 30;

export function formatRequisitionAmount(amount: number) {
  return (amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRequisitionDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Label followed by a red rule with the value written on it. */
function Blank({ label, value, labelWidth, flex = 1 }: { label: string; value?: string; labelWidth?: number; flex?: number }) {
  return (
    <View style={{ flex, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      <Text style={[styles.label, labelWidth ? { width: labelWidth } : null]}>{label}</Text>
      <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: RED, paddingBottom: 2, paddingLeft: 4, minHeight: 20, justifyContent: 'flex-end' }}>
        <Text style={styles.value} numberOfLines={1}>{value || ' '}</Text>
      </View>
    </View>
  );
}

export function RequisitionForm({ data }: { data: RequisitionData }) {
  const [detailLines, setDetailLines] = useState(MIN_DETAIL_LINES);
  const rows = Math.max(MIN_DETAIL_LINES, detailLines);

  return (
    <View
      style={{ backgroundColor: PAPER, borderWidth: 1.5, borderColor: RED, padding: 3, borderRadius: 4 }}
      accessibilityLabel={`Expense requisition form ${data.formId}`}
    >
      <View style={{ borderWidth: 0.5, borderColor: RED, padding: 12, gap: 18, overflow: 'hidden' }}>
        {/* Watermark */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={LOGO} style={{ width: '70%', aspectRatio: 1, opacity: 0.07 }} resizeMode="contain" />
        </View>

        {/* Letterhead */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Image source={LOGO} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityLabel="Church logo" />
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 2 }}>
            <Text style={{ fontFamily: SERIF, fontWeight: '700', fontSize: 17, color: INK, letterSpacing: 0.3 }} numberOfLines={1} adjustsFontSizeToFit>
              CHURCH OF CHRIST
            </Text>
            <Text style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: INK }}>—MATAHEKO—</Text>
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: 104 }}>
            <Text style={{ fontSize: 8.5, fontWeight: '700', color: INK, textAlign: 'right' }}>Church of Christ, Mataheko</Text>
            <Text style={{ fontSize: 8, color: INK }}>P.O BOX KN 1050</Text>
            <Text style={{ fontSize: 8, color: INK }}>Accra</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: INK, marginTop: 4 }} selectable>No: {data.formId || 'N/A'}</Text>
          </View>
        </View>

        {/* Banner */}
        <View style={{ backgroundColor: BANNER, paddingVertical: 7, alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, letterSpacing: 0.6 }}>EXPENSE REQUISITION FORM</Text>
        </View>

        {/* Details of expenditure on ruled lines */}
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>DETAILS OF EXPENDITURE</Text>
          <View style={{ height: rows * DETAIL_LINE }}>
            {Array.from({ length: rows }).map((_, i) => (
              <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * DETAIL_LINE - 6, borderBottomWidth: 1, borderBottomColor: RED }} />
            ))}
            <Text
              style={{ fontSize: 12.5, lineHeight: DETAIL_LINE, color: INK, paddingHorizontal: 4 }}
              onTextLayout={e => setDetailLines(e.nativeEvent.lines.length)}
              selectable
            >
              {data.details}
            </Text>
          </View>
        </View>

        {/* Amount and date */}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Blank label="AMOUNT GHS" value={formatRequisitionAmount(data.amount)} flex={1.15} />
          <Blank label="DATE" value={formatRequisitionDate(data.expenseDate)} />
        </View>

        {/* Sign-off */}
        <View style={{ gap: 16 }}>
          <Blank label="REQUESTED BY" value={data.requestedByName} labelWidth={104} />
          <Blank label="RECOMMENDED BY" value={data.recommendedByName} labelWidth={104} />
          <Blank label="APPROVED BY" value={data.approvedByName} labelWidth={104} />
        </View>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
          <Blank label="DATE" />
          <Blank label="SIGNATURE" flex={1.3} />
        </View>

        {/* Footer */}
        <View style={{ borderTopWidth: 0.5, borderTopColor: INK, paddingTop: 5, marginTop: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 8, color: INK }}>Acts 2:38 - Repent and be baptised</Text>
        </View>
      </View>
    </View>
  );
}

const styles = {
  label: { fontSize: 10.5, fontWeight: '700' as const, color: INK, letterSpacing: 0.2 },
  value: { fontSize: 12, color: INK },
};

// ---------------------------------------------------------------------------
// PDF (A4) — same layout as the web PDF
// ---------------------------------------------------------------------------

const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let logoDataUri: string | null = null;

async function getLogoDataUri(): Promise<string | null> {
  if (logoDataUri) return logoDataUri;
  try {
    const asset = Asset.fromModule(LOGO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    logoDataUri = `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('Requisition logo unavailable:', e);
  }
  return logoDataUri;
}

export function buildRequisitionHtml(data: RequisitionData, logo: string | null): string {
  const detailRows = Math.max(MIN_DETAIL_LINES, Math.ceil((data.details || '').length / 85) + 1);
  const blank = (label: string, value = '', labelWidth?: string) => `
    <div class="blank">
      <span class="lbl"${labelWidth ? ` style="width:${labelWidth}"` : ''}>${label}</span>
      <span class="rule">${esc(value) || '&nbsp;'}</span>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #000; }
  .page { position: relative; width: 210mm; height: 297mm; padding: 8mm; }
  .outer { position: absolute; inset: 8mm; border: 0.4mm solid ${RED}; }
  .inner { position: absolute; inset: 10mm; border: 0.15mm solid ${RED}; padding: 4mm 5mm; overflow: hidden; }
  .wm { position: absolute; left: 50%; top: 50%; width: 160mm; height: 160mm; margin: -80mm 0 0 -80mm; opacity: .07; }
  .head { position: relative; height: 36mm; }
  .logo { position: absolute; left: 0; top: 0; width: 35mm; height: 35mm; object-fit: contain; }
  .title { text-align: center; padding-top: 4mm; font-family: 'Times New Roman', Times, serif; }
  .title .a { font-weight: 700; font-size: 22pt; }
  .title .b { font-style: italic; font-size: 24pt; }
  .addr { position: absolute; right: 0; top: 2mm; text-align: right; font-size: 9pt; line-height: 1.5; }
  .addr .n { font-size: 11pt; font-weight: 700; margin-top: 2mm; }
  .banner { background: ${BANNER}; color: #fff; text-align: center; font-weight: 700; font-size: 16pt; padding: 2.5mm 0; margin-top: 2mm; }
  h3 { font-size: 11pt; margin: 9mm 0 2mm; }
  .lines { position: relative; font-size: 11pt; line-height: 12mm; padding: 0 2mm;
           background-image: linear-gradient(to bottom, transparent calc(12mm - 2.5mm), ${RED} calc(12mm - 2.5mm), ${RED} calc(12mm - 2.2mm), transparent calc(12mm - 2.2mm));
           background-size: 100% 12mm; min-height: ${detailRows * 12}mm; }
  .row { display: flex; gap: 10mm; margin-top: 10mm; }
  .blank { flex: 1; display: flex; align-items: flex-end; gap: 3mm; font-size: 11pt; }
  .lbl { font-weight: 700; white-space: nowrap; }
  .rule { flex: 1; border-bottom: 0.3mm solid ${RED}; padding: 0 2mm 1mm; min-height: 6mm; }
  .signs .blank { margin-top: 9mm; }
  .foot { position: absolute; left: 5mm; right: 5mm; bottom: 2mm; border-top: 0.15mm solid #000; text-align: center; font-size: 8pt; padding-top: 1.5mm; }
</style></head><body><div class="page">
  <div class="outer"></div>
  <div class="inner">
    ${logo ? `<img class="wm" src="${logo}" />` : ''}
    <div class="head">
      ${logo ? `<img class="logo" src="${logo}" />` : ''}
      <div class="title"><div class="a">CHURCH OF CHRIST</div><div class="b">—MATAHEKO—</div></div>
      <div class="addr"><b style="font-size:10pt">Church of Christ, Mataheko</b><br/>P.O BOX KN 1050<br/>Accra<div class="n">No: ${esc(data.formId || 'N/A')}</div></div>
    </div>
    <div class="banner">EXPENSE REQUISITION FORM</div>
    <h3>DETAILS OF EXPENDITURE</h3>
    <div class="lines">${esc(data.details).replace(/\n/g, '<br/>')}</div>
    <div class="row">
      ${blank('AMOUNT GHS', formatRequisitionAmount(data.amount))}
      ${blank('DATE', formatRequisitionDate(data.expenseDate))}
    </div>
    <div class="signs">
      ${blank('REQUESTED BY', data.requestedByName, '40mm')}
      ${blank('RECOMMENDED BY', data.recommendedByName, '40mm')}
      ${blank('APPROVED BY', data.approvedByName, '40mm')}
    </div>
    <div class="row">${blank('DATE')}${blank('SIGNATURE')}</div>
    <div class="foot">Acts 2:38 - Repent and be baptised</div>
  </div>
</div></body></html>`;
}

/** Renders the requisition to a PDF and opens the share sheet (save, WhatsApp, email…). */
export async function shareRequisitionPdf(data: RequisitionData) {
  const html = buildRequisitionHtml(data, await getLogoDataUri());
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  let target = uri;
  try {
    const safeId = (data.formId || 'receipt').replace(/[^A-Za-z0-9_-]/g, '_');
    target = `${FileSystem.cacheDirectory}expense-requisition-${safeId}.pdf`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: target });
  } catch {
    target = uri;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(target, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Expense requisition ${data.formId}`,
  });
}

/** Sends the requisition to the system print dialog. */
export async function printRequisition(data: RequisitionData) {
  const html = buildRequisitionHtml(data, await getLogoDataUri());
  await Print.printAsync({ html });
}
