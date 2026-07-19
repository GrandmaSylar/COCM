import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Download, Edit, Save, Printer, Eye } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { generateExpenseRequisitionPDF } from '../utils/export';

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
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

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
        toast.error('Failed to load expense record');
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [expenseId, expenseData]);

  // Generate preview when expense is loaded
  useEffect(() => {
    if (expense) {
      const loadPreview = async () => {
        try {
          const url = await generateExpenseRequisitionPDF(expense, 'preview');
          if (typeof url === 'string') {
            setPreviewPdfUrl(url);
          }
        } catch (err) {
          console.error('Preview Generation Error:', err);
        }
      };
      loadPreview();
    }
  }, [expense]);

  const handleDownloadPDF = async () => {
    if (!expense) return;
    try {
      setIsDownloading(true);
      await generateExpenseRequisitionPDF(expense, 'download');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground flex-col gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        <p>Loading requisition...</p>
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
    <div className="max-w-5xl mx-auto py-8 px-4 h-[calc(100vh-100px)] flex flex-col">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-none">Requisition Preview</h1>
            <p className="text-sm text-muted-foreground mt-1">ID: {expense.formId || 'Draft'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" onClick={onEdit} disabled={isSubmitting} className="gap-2">
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
          
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloading || isSubmitting} className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'Download PDF'}</span>
          </Button>

          {onSave && (
            <Button onClick={onSave} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{isSubmitting ? 'Saving...' : 'Save Requisition'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 bg-muted rounded-xl border relative overflow-hidden shadow-inner p-4">
        {previewPdfUrl ? (
          <iframe 
            src={previewPdfUrl} 
            className="w-full h-full rounded border bg-white shadow-sm" 
            title="Expense Requisition PDF"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-sm font-medium">Generating preview...</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center no-print">
         <p className="text-xs text-muted-foreground flex items-center gap-2">
           <Eye className="w-3 h-3" />
           This is a native vector preview of the official requisition form
         </p>
      </div>
    </div>
  );
}
