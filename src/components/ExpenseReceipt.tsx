import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Printer, Download, Edit, Save } from 'lucide-react';
import { api } from '../services/api';
import { formatGhanaCedis as formatCurrency } from './ui/utils';

interface ExpenseReceiptProps {
  expenseId?: string;
  expenseData?: any;
  onBack: () => void;
  onEdit?: () => void;
  onSave?: () => Promise<void> | void;
  isSubmitting?: boolean;
}

export function ExpenseReceipt({ expenseId, expenseData, onBack, onEdit, onSave, isSubmitting = false }: ExpenseReceiptProps) {
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(!expenseData && !!expenseId);
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expenseData) {
      setExpense(expenseData);
      setLoading(false);
      return;
    }

    if (!expenseId) {
      setLoading(false);
      return;
    }

    const fetchExpense = async () => {
      try {
        const record = await api.expenses.getById(expenseId);
        setExpense(record);
      } catch (error) {
        console.error('Failed to fetch expense receipt:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [expenseId, expenseData]);

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
        windowWidth: 800,
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
    <div className="max-w-3xl mx-auto py-8 px-4 overflow-x-auto">
      {/* Action Buttons - Hidden when printing */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 no-print print:hidden">
        <Button variant="ghost" onClick={onBack} className="self-start sm:self-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          {onEdit && (
            <Button variant="outline" onClick={onEdit} disabled={isSubmitting}>
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Edit</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} disabled={isSubmitting}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Print</span>
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloading || isSubmitting}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">{isDownloading ? 'Generating PDF...' : 'Download PDF'}</span>
          </Button>
          {onSave && (
            <Button onClick={onSave} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">{isSubmitting ? 'Saving...' : 'Save Requisition'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Receipt Content */}
      <div 
        ref={receiptRef}
        className="bg-white text-black p-12 border rounded-xl shadow-sm mx-auto print:border-none print:shadow-none"
        style={{ width: '800px', maxWidth: 'none', minHeight: '1000px', margin: '0 auto' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          {/* Logo & Church Name */}
          <div className="flex flex-row items-center gap-5">
            <img src="/newlogo.png" alt="Church Logo" className="w-[100px] h-[100px] object-contain" crossOrigin="anonymous" />
            <div className="flex flex-col items-start text-left font-sans">
              <h1 className="text-2xl font-bold uppercase tracking-wide text-black m-0 leading-tight">Church of Christ</h1>
              <h2 className="text-[26px] font-bold uppercase tracking-wider text-black m-0 leading-tight">Mataheko</h2>
            </div>
          </div>
          
          {/* Right Address */}
          <div className="flex flex-col items-end text-right text-[13px] font-bold text-black space-y-[4px] pt-1">
            <p className="m-0">Church of Christ, Mataheko</p>
            <p className="m-0 font-normal">P.O BOX KN 1050</p>
            <p className="m-0 font-normal">Accra</p>
            <p className="mt-4 text-xs text-gray-400 font-normal">No: {expense.formId}</p>
          </div>
        </div>

        {/* Title Banner */}
        <div className="bg-[#18182b] text-white text-center py-2.5 rounded mb-10">
          <h3 className="text-xl font-bold uppercase tracking-wide m-0">Expense Requisition Form</h3>
        </div>

        {/* Details of Expenditure */}
        <div className="mb-14">
          <h4 className="font-bold text-[14px] mb-5 text-black tracking-wide uppercase">Details of Expenditure</h4>
          
          <div className="relative w-full">
            {/* Underlines background */}
            <div className="absolute inset-0 z-0 flex flex-col justify-start pointer-events-none">
              <div className="border-b border-gray-400 w-full h-[40px]"></div>
              <div className="border-b border-gray-400 w-full h-[40px]"></div>
              <div className="border-b border-gray-400 w-full h-[40px]"></div>
              <div className="border-b border-gray-400 w-full h-[40px]"></div>
            </div>
            
            {/* Content text */}
            <div 
              className="relative z-10 w-full font-normal text-base leading-[40px] pt-1 px-1 whitespace-pre-wrap break-words min-h-[160px]" 
            >
              {expense.details}
            </div>
          </div>
        </div>

        {/* Amount and Date row */}
        <div className="flex flex-row justify-between mb-16 gap-8 px-1">
          <div className="flex font-bold text-sm flex-1 items-end">
            <span className="whitespace-nowrap mr-6 tracking-wide">AMOUNT GHS</span>
            <div className="border-b border-gray-400 flex-1 text-center font-normal pb-0.5 text-lg">
              {formatCurrency(expense.amount).replace('₵', '').trim()} 
            </div>
          </div>
          <div className="flex font-bold text-sm flex-1 items-end">
            <span className="whitespace-nowrap mr-6 ml-8 tracking-wide">DATE</span>
            <div className="border-b border-gray-400 flex-1 text-center font-normal pb-0.5 text-lg">
              {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString('en-GB') : ''}
            </div>
          </div>
        </div>

        {/* Signatures stack */}
        <div className="space-y-10 mb-20 px-1">
          <div className="flex font-bold text-[13px] items-end">
            <span className="whitespace-nowrap w-[180px] tracking-wide uppercase">Requested By</span>
            <div className="border-b border-gray-400 flex-1 pb-0.5 text-lg font-normal pl-4">
              {expense.requestedByName}
            </div>
          </div>
          
          <div className="flex font-bold text-[13px] items-end">
            <span className="whitespace-nowrap w-[180px] tracking-wide uppercase">Recommended By:</span>
            <div className="border-b border-gray-400 flex-1 pb-0.5 text-lg font-normal pl-4">
              {expense.recommendedByName}
            </div>
          </div>

          <div className="flex font-bold text-[13px] items-end">
            <span className="whitespace-nowrap w-[180px] tracking-wide uppercase">Approved By</span>
            <div className="border-b border-gray-400 flex-1 pb-0.5 text-lg font-normal pl-4">
              {expense.approvedByName}
            </div>
          </div>
        </div>

        {/* Bottom Signature Row */}
        <div className="flex flex-row justify-between mb-20 gap-8 px-1">
          <div className="flex font-bold text-[13px] w-[35%] items-end">
            <span className="whitespace-nowrap mr-6 tracking-wide">DATE</span>
            <div className="border-b border-gray-400 flex-1 pb-2"></div>
          </div>
          <div className="flex font-bold text-[13px] flex-1 items-end ml-12">
            <span className="whitespace-nowrap mr-6 tracking-wide">SIGNATURE</span>
            <div className="border-b border-gray-400 flex-1 pb-2"></div>
          </div>
        </div>
        
        {/* Bottom thick lines */}
        <div className="flex justify-between mt-auto gap-4 pt-4 px-1 pb-8">
           <div className="border-b-[4px] border-black flex-1"></div>
           <div className="border-b-[4px] border-black flex-1"></div>
           <div className="border-b-[4px] border-black flex-1"></div>
           <div className="border-b-[4px] border-black flex-1"></div>
        </div>
      </div>
      
      {/* CSS to hide elements during standard printing */}
      <style>{`
        @media print {
          body { background-color: white !important; }
          #sidebar-nav, #mobile-fab-nav, header, .no-print { display: none !important; }
          .content-watermark { background: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
          main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: portrait; margin: 10mm; }
          #root { width: 800px !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
