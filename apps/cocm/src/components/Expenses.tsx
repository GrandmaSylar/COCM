import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { IconTile, LargeTitle } from './ui/ios';
import { MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';
import { Banknote, Plus, Calendar, Search, Settings, Receipt, Download, RefreshCw, Eye, Edit, Trash2, ArrowLeft, X, CheckCircle, WifiOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';
import { formatCurrencyForExport, exportToCSV, exportToPDF, exportToXLSX, exportGroupedToCSV, exportGroupedToPDF, exportGroupedToXLSX } from '../utils/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useCachedData } from '../hooks/useCachedData';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ExpensesProps {
  onAddExpense: () => void;
  onViewReceipt: (id: string) => void;
  onEditExpense: (id: string) => void;
  onDeleted: () => void;
  refreshKey?: number;
}

export function Expenses({ onAddExpense, onViewReceipt, onEditExpense, onDeleted, refreshKey = 0 }: ExpensesProps) {
  const { user, canAccess } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();

  const { data: expensesData, loading: loading1, refresh: refresh1 } = useCachedData(`expenses-list-${refreshKey}`, () => api.expenses.getAll());
  const { data: pmData, loading: loading2, refresh: refresh2 } = useCachedData(`expenses-payment-methods-${refreshKey}`, () => api.expenses.paymentMethods.getAll());
  const { data: givingData, loading: loading3, refresh: refresh3 } = useCachedData('giving-records', () => api.giving.getAll());

  const loading = loading1 || loading2 || loading3;
  const isDevOrAdmin = user?.role === 'dev' || user?.role === 'admin';

  const expenses = expensesData || [];
  const paymentMethods = pmData || [];

  const handleRefresh = async () => {
    await Promise.all([refresh1(), refresh2(), refresh3()]);
  };

  useEffect(() => {
    const handleSync = () => {
      refresh1();
      refresh2();
      refresh3();
    };
    window.addEventListener('sync-queue-updated', handleSync);
    return () => window.removeEventListener('sync-queue-updated', handleSync);
  }, [refresh1, refresh2, refresh3]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      const s = searchTerm.toLowerCase();
      return (
        (e.formId || '').toLowerCase().includes(s) ||
        (e.details || '').toLowerCase().includes(s) ||
        (e.serviceType || '').toLowerCase().includes(s)
      );
    });
  }, [expenses, searchTerm]);

  // Derived Groups
  const groupedData = useMemo(() => {
    const groupsMap = new Map<string, any[]>();
    filteredExpenses.forEach((exp: any) => {
      const key = `${exp.serviceDate}|${exp.serviceType || ''}`;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(exp);
    });

    return Array.from(groupsMap.entries()).map(([key, rows]) => {
      const [serviceDate, serviceType] = key.split('|');
      const subtotal = rows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      
      let relatedGiving = 0;
      if (givingData && serviceDate && serviceType) {
        relatedGiving = givingData
          .filter((g: any) => {
            const sDate = g.serviceDate ? g.serviceDate.split('T')[0] : '';
            const gServiceType = g.serviceType || g.service_name || '';
            return sDate === serviceDate && gServiceType === serviceType;
          })
          .reduce((sum: number, g: any) => sum + (g.totalAmount || 0), 0);
      }

      return {
        label: `${new Date(serviceDate).toLocaleDateString('en-GB')} - ${serviceType || 'General'}`,
        serviceDate,
        serviceType,
        subtotal,
        relatedGiving,
        net: relatedGiving - subtotal,
        rows
      };
    }).sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }, [filteredExpenses, givingData]);

  // Subtotals
  const totalAllTime = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return expenses.filter((e: any) => {
      if (!e.serviceDate) return false;
      const d = new Date(e.serviceDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const handleDelete = async (id: string, formId: string) => {
    if (!isOnline) {
      toast.warning('Reconnect to delete records.');
      return;
    }
    if (confirm(`Are you sure you want to permanently delete Expense Requisition ${formId}?`)) {
      setIsDeleting(id);
      try {
        await api.expenses.delete(id);
        toast.success(`Deleted requisition ${formId}`);
        await handleRefresh();
        onDeleted();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete expense requisition');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Export handlers
  const flatColumns = [
    { key: 'formId', label: 'Form ID' },
    { key: 'serviceDate', label: 'Service Date' },
    { key: 'serviceType', label: 'Service Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'details', label: 'Details' },
    { key: 'paymentMethodName', label: 'Payment Method' },
    { key: 'requestedByName', label: 'Requested By' },
  ];

  const handleExportFlatCSV = () => exportToCSV(filteredExpenses, 'expenses', flatColumns);
  const handleExportFlatPDF = () => exportToPDF(filteredExpenses, 'expenses', 'Expenses List', flatColumns);
  const handleExportFlatXLSX = () => exportToXLSX(filteredExpenses, 'expenses', flatColumns);

  const handleExportGroupedCSV = () => exportGroupedToCSV(groupedData, 'expenses_grouped', flatColumns);
  const handleExportGroupedPDF = () => exportGroupedToPDF(groupedData, 'expenses_grouped', 'Grouped Expenses', flatColumns);
  const handleExportGroupedXLSX = () => exportGroupedToXLSX(groupedData, 'expenses_grouped', flatColumns);


  if (showTypeManager && isDevOrAdmin) {
    return (
      <CustomTypeManager
        customTypes={paymentMethods}
        onBack={() => setShowTypeManager(false)}
        onRefresh={refresh2}
      />
    );
  }

  return (
    <div className="space-y-4">
      <LargeTitle
        title={
          <span className="flex items-center gap-2">
            Finance &amp; Expenses
            {!isOnline && (
              <Badge variant="outline" className="border-0 bg-warning-soft text-warning-text">
                <WifiOff className="w-3 h-3 mr-1" />
                Cached
              </Badge>
            )}
          </span>
        }
        subtitle="Manage expenditure and payment authorisations"
        actions={
          <>
            <Button onClick={onAddExpense}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Requisition</span>
              <span className="sr-only sm:hidden">New Requisition</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="soft" size="icon" aria-label="More actions">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </DropdownMenuItem>
                {isDevOrAdmin && (
                  <DropdownMenuItem onClick={() => setShowTypeManager(true)}>
                    <Settings className="w-4 h-4" />
                    Payment Methods
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { icon: Receipt, tone: 'primary' as const, value: `GH₵ ${totalAllTime.toFixed(2)}`, label: 'Total Expenses (All Time)' },
          { icon: Calendar, tone: 'warning' as const, value: `GH₵ ${totalThisMonth.toFixed(2)}`, label: 'Total Expenses (This Month)' },
          { icon: Banknote, tone: 'info' as const, value: String(expenses.length), label: 'Total Requisitions' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 truncate text-2xl font-bold leading-none tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <CardTitle>Expense Requisitions</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search details or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : (
            <Tabs defaultValue="flat" className="w-full mt-4">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <TabsList>
                  <TabsTrigger value="flat">List View</TabsTrigger>
                  <TabsTrigger value="grouped">Grouped View</TabsTrigger>
                </TabsList>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="font-semibold px-2 py-1 text-xs text-muted-foreground uppercase" disabled>Flat Export</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportFlatCSV}>CSV (Flat)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportFlatXLSX}>Excel (Flat)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportFlatPDF}>PDF (Flat)</DropdownMenuItem>
                    <div className="h-px bg-border my-1" />
                    <DropdownMenuItem className="font-semibold px-2 py-1 text-xs text-muted-foreground uppercase" disabled>Grouped Export</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportGroupedCSV}>CSV (Grouped)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportGroupedXLSX}>Excel (Grouped)</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportGroupedPDF}>PDF (Grouped)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <TabsContent value="flat" className="mt-0">
                <div className="block md:hidden space-y-2 mb-4">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg">No requisitions found.</div>
                  ) : (
                    filteredExpenses.map((exp: any) => (
                      <div key={exp.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{exp.formId}</span>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{exp.serviceType || 'General'}</span>
                          <span className="text-xs text-muted-foreground">{new Date(exp.serviceDate).toLocaleDateString()}</span>
                        </div>
                        <div className="line-clamp-2 text-sm">{exp.details}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="font-bold text-destructive">GH₵ {exp.amount?.toFixed(2)}</span>
                          <Badge variant="outline">{exp.paymentMethodName}</Badge>
                        </div>
                        {exp.requestedByName && (
                          <div className="text-xs text-muted-foreground mt-1">Req: {exp.requestedByName}</div>
                        )}
                        <div className="flex gap-1 justify-end mt-2">
                          <Button variant="ghost" size="icon" onClick={() => onViewReceipt(exp.id)} title="View Receipt">
                            <Eye className="w-4 h-4 text-info-text" />
                          </Button>
                          {isDevOrAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => onEditExpense(exp.id)} title="Edit">
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          {isDevOrAdmin && (
                            <Button variant="ghost" size="icon" disabled={isDeleting === exp.id || !isOnline} onClick={() => handleDelete(exp.id, exp.formId)} title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden md:block overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Form ID / Date</th>
                        <th className="px-4 py-3 font-semibold">Details</th>
                        <th className="px-4 py-3 font-semibold">Amount</th>
                        <th className="px-4 py-3 font-semibold">Method</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredExpenses.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No requisitions found.</td></tr>
                      ) : (
                        filteredExpenses.map((exp: any) => (
                          <tr key={exp.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-primary">{exp.formId}</div>
                              <div className="text-xs text-muted-foreground">{new Date(exp.serviceDate).toLocaleDateString()}</div>
                              <div className="text-[10px] bg-muted inline-block px-1.5 py-0.5 rounded mt-1">{exp.serviceType || 'General'}</div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="line-clamp-2">{exp.details}</div>
                              {exp.requestedByName && <div className="text-xs text-muted-foreground mt-1">Req: {exp.requestedByName}</div>}
                            </td>
                            <td className="px-4 py-3 align-top font-bold text-destructive">
                              GH₵ {exp.amount?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <Badge variant="outline">{exp.paymentMethodName}</Badge>
                            </td>
                            <td className="px-4 py-3 align-top text-right space-x-2">
                              <Button variant="ghost" size="icon" onClick={() => onViewReceipt(exp.id)} title="View Receipt">
                                <Eye className="w-4 h-4 text-info-text" />
                              </Button>
                              {isDevOrAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => onEditExpense(exp.id)} title="Edit">
                                  <Edit className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                              {isDevOrAdmin && (
                                <Button variant="ghost" size="icon" disabled={isDeleting === exp.id || !isOnline} onClick={() => handleDelete(exp.id, exp.formId)} title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="grouped" className="mt-0 space-y-6">
                {groupedData.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No records to group.</div>
                ) : (
                  groupedData.map((group, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-muted px-4 py-3 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 text-sm">
                        <div className="font-semibold">{group.label}</div>
                        <div className="flex flex-wrap gap-2 sm:gap-6 sm:items-center text-sm">
                          {group.relatedGiving > 0 && (
                            <div className="flex items-center space-x-2">
                              <span className="text-success-text font-medium">+ Giving: GH₵ {group.relatedGiving.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="font-bold text-destructive">- Exp: GH₵ {group.subtotal.toFixed(2)}</div>
                          {group.relatedGiving > 0 && (
                            <div className={`font-bold border px-2 py-1 rounded ${group.net >= 0 ? 'bg-success-soft text-success-text border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                              Net: GH₵ {group.net.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="bg-background divide-y divide-border">
                        {group.rows.map((exp: any) => (
                          <div key={exp.id} className="p-3 flex justify-between items-center text-sm hover:bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{exp.formId} <span className="text-muted-foreground font-normal ml-2">{exp.details}</span></div>
                              <div className="flex items-center gap-2 mt-1">
                                {exp.paymentMethodName && <Badge variant="outline" className="text-[10px]">{exp.paymentMethodName}</Badge>}
                                {exp.requestedByName && <span className="text-xs text-muted-foreground">Req: {exp.requestedByName}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold tabular-nums text-destructive">GH₵ {exp.amount?.toFixed(2)}</span>
                              <Button variant="ghost" size="icon" onClick={() => onViewReceipt(exp.id)} title="View Receipt">
                                <Eye className="w-4 h-4 text-info-text" />
                              </Button>
                              {isDevOrAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => onEditExpense(exp.id)} title="Edit">
                                  <Edit className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                              {isDevOrAdmin && (
                                <Button variant="ghost" size="icon" disabled={isDeleting === exp.id || !isOnline} onClick={() => handleDelete(exp.id, exp.formId)} title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Payment Methods Manager
function CustomTypeManager({ customTypes, onBack, onRefresh }: { customTypes: any[], onBack: () => void, onRefresh: () => Promise<void> }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const { isOnline } = useNetworkStatus();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.warning('Reconnect to add payment methods.');
      return;
    }
    if (!newTypeName.trim()) return;
    setSaving(true);
    try {
      await api.expenses.paymentMethods.create({ name: newTypeName.trim() });
      setNewTypeName('');
      setShowAddForm(false);
      await onRefresh();
      toast.success('Added payment method');
    } catch (err: any) {
      toast.error(getFriendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    if (!isOnline) {
      toast.warning('Reconnect to update payment methods.');
      return;
    }
    try {
      await api.expenses.paymentMethods.update(id, { is_active: !currentStatus });
      await onRefresh();
      toast.success('Updated status');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!isOnline) {
      toast.warning('Reconnect to delete records.');
      return;
    }
    if (confirm('Are you sure you want to delete this payment method?')) {
      try {
        await api.expenses.paymentMethods.delete(id);
        setInlineError('');
        await onRefresh();
        toast.success('Deleted payment method');
      } catch (err: any) {
        if (err?.status === 409) {
          setInlineError('Cannot delete: in use by expenses. Deactivate instead.');
          return;
        }
        toast.error('Failed to delete payment method');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="soft" size="icon" onClick={onBack} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <div>
          <h1>Manage Payment Methods</h1>
          <p className="text-muted-foreground">Configure payment methods for requisitions</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
             <CardTitle>Payment Methods</CardTitle>
             <Button onClick={() => setShowAddForm(!showAddForm)}>
               {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
               {showAddForm ? 'Cancel' : 'Add Method'}
             </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleAdd} className="space-y-4 mb-6 p-4 box-muted rounded-lg">
              <div className="space-y-2">
                <Label>Method Name</Label>
                <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} required />
              </div>
              <Button type="submit" disabled={saving || !newTypeName.trim()}>Add Method</Button>
            </form>
          )}

          {inlineError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{inlineError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {customTypes.length === 0 ? <p className="text-muted-foreground">No methods configured.</p> : customTypes.map(m => (
              <div key={m.id} className="flex justify-between items-center p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{m.name}</span>
                  <Badge variant={m.is_active ? 'default' : 'secondary'}>{m.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!isOnline} onClick={() => handleToggle(m.id, m.is_active)}>
                     {m.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteMethod(m.id)}
                    className="text-destructive"
                    disabled={!isOnline}
                    title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
