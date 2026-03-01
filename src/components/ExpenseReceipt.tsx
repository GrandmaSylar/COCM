import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { api } from '../services/api';
import { formatGhanaCedis as formatCurrency } from './ui/utils';

interface ExpenseReceiptProps {
  expenseId: string;
  onBack: () => void;
}

export function ExpenseReceipt({ expenseId, onBack }: ExpenseReceiptProps) {
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const records = await api.expenses.getAll();
        const record = records.find((r: any) => r.id === expenseId);
        setExpense(record);
      } catch (error) {
        console.error('Failed to fetch expense receipt:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [expenseId]);

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || !expense) return;
    try {
      setIsDownloading(true);
      // Dynamically import libraries to keep main bundle size small
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${expense.formId || 'receipt'}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-muted-foreground">Expense record not found.</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Action Buttons - Hidden when printing */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 no-print print:hidden">
        <Button variant="ghost" onClick={onBack} className="self-start sm:self-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleDownloadPDF} disabled={isDownloading}>
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Receipt Content */}
      <div 
        ref={receiptRef}
        className="bg-white text-black p-8 sm:p-12 border rounded-xl shadow-sm mx-auto"
        style={{ maxWidth: '800px', minHeight: '1000px' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-10 pb-8 border-b-2 border-gray-200">
          <img src="/newlogo.png" alt="Church Logo" className="w-24 h-24 object-contain mb-2" crossOrigin="anonymous" />
          <h1 className="text-2xl font-bold uppercase tracking-wide">Church of Christ - Mataheko Congregation (CoC.M)</h1>
          <p className="text-gray-600">P.O BOX KN 1050, Accra</p>
          <h2 className="text-xl font-bold mt-6 pt-4 underline underline-offset-4">EXPENSE REQUISITION FORM</h2>
          <p className="text-sm font-semibold mt-2">Receipt No: <span className="text-primary">{expense.formId}</span></p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-12">
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Date</p>
            <p className="text-lg font-semibold">{new Date(expense.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Service Date</p>
            <p className="text-lg font-semibold">{new Date(expense.serviceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Service Type</p>
            <p className="text-lg font-semibold">{expense.serviceType || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Amount</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(expense.amount)}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Details</p>
            <p className="text-lg whitespace-pre-wrap">{expense.details}</p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-50 p-6 rounded-lg mb-12">
          <h3 className="text-md font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Payment Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Method</p>
              <p className="font-semibold">{expense.paymentMethodName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Reference</p>
              <p className="font-semibold">{expense.referenceNumber || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Personnel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16 px-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-8">Requested By</p>
            <div className="border-b-2 border-dashed border-gray-300 w-full mb-2"></div>
            <p className="font-semibold">{expense.requestedByName || 'N/A'}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-8">Recommended By</p>
            <div className="border-b-2 border-dashed border-gray-300 w-full mb-2"></div>
            <p className="font-semibold">{expense.recommendedByName || 'N/A'}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-8">Approved By</p>
            <div className="border-b-2 border-dashed border-gray-300 w-full mb-2"></div>
            <p className="font-semibold">{expense.approvedByName || 'N/A'}</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center border-t-2 border-gray-200 pt-6 mt-auto">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 font-medium">Status:</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-sm">
              ✓ Approved
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-8">Authorizing Signature</p>
            <div className="border-b border-black w-48"></div>
          </div>
        </div>
      </div>
      
      {/* CSS to hide elements during standard printing */}
      <style>{`
        @media print {
          body { background-color: white !important; }
          #sidebar-nav, #mobile-fab-nav, header, .no-print { display: none !important; }
          .content-watermark { background: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
