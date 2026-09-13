import { Paths, Directory, File } from 'expo-file-system';
import { getLocalDb } from './db';

const receiptsDir = new Directory(Paths.document, 'receipts');

function ensureReceiptDirectory() {
  if (!receiptsDir.exists) {
    receiptsDir.create();
  }
}

export interface ExpenseReceiptDetails {
  formId: string;
  details: string;
  amount: number;
  serviceDate: string;
  serviceType: string;
  paymentMethodName: string;
  requestedByName?: string;
  approvedByName?: string;
}

/**
 * On-Demand Expense Receipt Issuance Engine (Expo SDK 57):
 * Receipts are ONLY generated upon explicit user action ("Issue Receipt" / "Generate Receipt").
 * Once generated, saves output to device storage (`receipts/receipt_{formId}.json`).
 */
export async function issueExpenseReceipt(expenseId: string, details: ExpenseReceiptDetails): Promise<string> {
  ensureReceiptDirectory();

  const receiptFileName = `receipt_${details.formId || expenseId}.json`;
  const receiptFile = new File(receiptsDir, receiptFileName);

  const receiptDocument = {
    receiptId: `REC-${details.formId}`,
    issuedAt: new Date().toISOString(),
    expenseId,
    formId: details.formId,
    amountFormatted: `GH₵ ${Number(details.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    amountRaw: details.amount,
    details: details.details,
    serviceDate: details.serviceDate,
    serviceType: details.serviceType,
    paymentMethod: details.paymentMethodName,
    requestedBy: details.requestedByName || 'Authorized Representative',
    approvedBy: details.approvedByName || 'Church Finance Office',
    status: 'ISSUED_AND_SAVED'
  };

  // Write JSON receipt payload to local filesystem
  receiptFile.write(JSON.stringify(receiptDocument, null, 2));

  // Save receipt local path into embedded SQLite
  const db = await getLocalDb();
  await db.runAsync('UPDATE expenses SET receipt_local_path = ?, status = ? WHERE id = ?', [
    receiptFile.uri,
    'issued',
    expenseId
  ]);

  return receiptFile.uri;
}

export async function getIssuedReceipt(expenseId: string): Promise<any | null> {
  try {
    const db = await getLocalDb();
    const row = await db.getFirstAsync<{ receipt_local_path?: string }>('SELECT receipt_local_path FROM expenses WHERE id = ?', [expenseId]);
    if (row?.receipt_local_path) {
      const receiptFile = new File(row.receipt_local_path);
      if (receiptFile.exists) {
        const content = await receiptFile.text();
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn(`Failed reading issued receipt for ${expenseId}:`, err);
  }
  return null;
}
