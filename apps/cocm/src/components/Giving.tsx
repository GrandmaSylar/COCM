import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { EmptyState, Group, IconTile, LargeTitle, SearchField } from './ui/ios';
import { PullToRefresh } from './ui/ios-gestures';
import { DropdownMenuSeparator } from './ui/dropdown-menu';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Banknote, Plus, TrendingUp, TrendingDown, Calendar, Search, ArrowLeft, Edit, Trash2, X, Settings, Church, Download, Eye, Lock, Unlock, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis, getExpenseKey } from './ui/utils';
import { api } from '../services/api';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport, formatCurrencyForExport } from '../utils/export';
import { useCachedData, clearCacheByPattern } from '../hooks/useCachedData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface GivingRecord {
  id: string;
  serviceName: string; // e.g., "Sunday Morning Service", "Midweek Service"
  serviceDate: string;
  serviceType: 'sunday_morning' | 'sunday_evening' | 'midweek' | 'special' | 'other';
  offerings: {
    offering: number;
    donation?: number;
    thanksgiving: number;
    customTypes: { [key: string]: number }; // Dynamic custom types with amounts
  };
  totalAmount: number;
  paymentBreakdown: {
    cash: number;
    mobile_money: number;
    card: number;
    bank_transfer: number;
    foreign_currency?: {
      currency: string;
      amount: number;
      ghs_equivalent: number;
    };
  };
  notes?: string;
  // Audit fields
  createdBy?: string;
  createdByEmail?: string;
  createdAt?: string;
  editedBy?: string;
  editedByEmail?: string;
  editedAt?: string;
}

interface CustomGivingType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  // Audit fields
  createdBy?: string; // User's name who created the type
  createdByEmail?: string; // User's email who created the type
  createdAt?: string;
  updatedAt?: string;
}

interface GivingProps {
  onRecordGiving: () => void;
  onViewRecord?: (id: string) => void;
  initialShowTypeManager?: boolean;
}

const serviceTypeLabels = {
  sunday_morning: 'Sunday Main Service',
  sunday_evening: 'Sunday Evening',
  midweek: 'Midweek Service',
  special: 'Special Service',
  other: 'Custom Service'
};

const paymentMethodLabels = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank_transfer: 'Bank Transfer'
};

// Common foreign currencies
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

export function Giving({ onRecordGiving, onViewRecord, initialShowTypeManager = false }: GivingProps) {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showCustomTypeManager, setShowCustomTypeManager] = useState(initialShowTypeManager);
  const [refreshing, setRefreshing] = useState(false);
  const { user, canAccess } = useAuth();
  const { isOnline } = useNetworkStatus();

  const { data: cachedGiving, loading: loadingGiving, refresh: refreshGiving } = useCachedData<any[]>(
    'giving-records',
    () => api.giving.getAll(),
    { duration: 2 * 60 * 1000 }
  );
  const { data: cachedTypes, loading: loadingTypes, refresh: refreshTypes } = useCachedData<CustomGivingType[]>(
    'giving-types',
    () => api.giving.types.getAll(),
    { duration: 5 * 60 * 1000 }
  );
  const { data: cachedExpenses, loading: loadingExpenses, refresh: refreshExpenses } = useCachedData<any[]>(
    'expense-records',
    () => api.expenses.getAll(),
    { duration: 2 * 60 * 1000 }
  );

  const loading = loadingGiving || loadingTypes || loadingExpenses;

  useEffect(() => {
    if (cachedGiving) setRecords(cachedGiving);
  }, [cachedGiving]);

  useEffect(() => {
    if (cachedTypes) setCustomTypes(cachedTypes);
  }, [cachedTypes]);

  useEffect(() => {
    if (cachedExpenses) setExpenseRecords(cachedExpenses);
  }, [cachedExpenses]);

  useEffect(() => {
    const handleSync = () => {
      refreshGiving();
      refreshTypes();
      refreshExpenses();
    };
    window.addEventListener('sync-queue-updated', handleSync);
    return () => window.removeEventListener('sync-queue-updated', handleSync);
  }, [refreshGiving, refreshTypes, refreshExpenses]);

  const canRecordGiving = canAccess('record_giving');
  const canManageCustomTypes = canAccess('manage_giving_types');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshGiving(), refreshTypes(), refreshExpenses()]);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedServiceType === 'all' || record.serviceType === selectedServiceType;
    return matchesSearch && matchesType;
  });

  // Calculate stats
  const totalGiving = records.reduce((sum, record) => sum + record.totalAmount, 0);
  const thisMonthGiving = records
    .filter(record => {
      const recordDate = new Date(record.serviceDate);
      const now = new Date();
      return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, record) => sum + record.totalAmount, 0);
  
  const thisWeekGiving = records
    .filter(record => {
      const recordDate = new Date(record.serviceDate);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return recordDate >= weekAgo && recordDate <= now;
    })
    .reduce((sum, record) => sum + record.totalAmount, 0);

  // Build expense lookup by serviceDate + serviceType (using camelCase as returned by the API)
  const expensesByKey = new Map<string, number>();
  expenseRecords.forEach((exp: any) => {
    const key = getExpenseKey(exp.serviceDate, exp.serviceType);
    expensesByKey.set(key, (expensesByKey.get(key) || 0) + (exp.amount || 0));
  });
  const totalExpenses = Array.from(expensesByKey.values()).reduce((sum, v) => sum + v, 0);
  const netGiving = totalGiving - totalExpenses;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = formatGhanaCedis;

  const EDIT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

  const getEditWindowInfo = (createdAt?: string) => {
    if (!createdAt) return { canEdit: false, timeRemaining: '' };
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const elapsed = now - created;
    const remaining = EDIT_WINDOW_MS - elapsed;
    if (remaining <= 0) return { canEdit: false, timeRemaining: '', label: 'Locked' };
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return { canEdit: true, timeRemaining: `${hours}h ${minutes}m left`, label: `${hours}h ${minutes}m left` };
  };

  const isDev = user?.role === 'dev';

  const getServiceTypeColor = (type: string) => {
    switch (type) {
      case 'sunday_morning': return 'badge-info';
      case 'sunday_evening': return 'badge-purple';
      case 'midweek': return 'badge-success';
      case 'special': return 'badge-orange';
      default: return 'badge-muted';
    }
  };

  const handleDeleteCustomType = async (typeId: string) => {
    if (!isOnline) {
      toast.warning('Reconnect to delete records.');
      return;
    }
    if (confirm('Are you sure you want to delete this custom giving type?')) {
      try {
        await api.giving.types.delete(typeId);
        clearCacheByPattern('giving-types');
        setCustomTypes(prev => prev.filter(type => type.id !== typeId));
        toast.success('Giving type deleted successfully');
      } catch (error) {
        console.error('Failed to delete giving type:', error);
        toast.error(getFriendlyMessage(error));
      }
    }
  };

  const handleToggleCustomType = async (typeId: string) => {
    if (!isOnline) {
      toast.warning('Reconnect to update giving types.');
      return;
    }
    try {
      await api.giving.types.toggle(typeId);
      clearCacheByPattern('giving-types');
      setCustomTypes(prev => prev.map(type =>
        type.id === typeId ? { ...type, isActive: !type.isActive } : type
      ));
      toast.success('Giving type updated');
    } catch (error) {
      console.error('Failed to toggle giving type:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  // Export columns configuration
  const exportColumns = [
    { key: 'serviceName', label: 'Service Name' },
    { key: 'serviceDate', label: 'Date' },
    { key: 'serviceType', label: 'Service Type' },
    { key: 'offering', label: 'Offering' },
    { key: 'donation', label: 'Donation' },
    { key: 'thanksgiving', label: 'Thanksgiving' },
    { key: 'totalAmount', label: 'Total Amount' },
    { key: 'cash', label: 'Cash' },
    { key: 'mobileMoney', label: 'Mobile Money' },
    { key: 'card', label: 'Card' },
    { key: 'bankTransfer', label: 'Bank Transfer' },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedBy', label: 'Recorded By' },
    { key: 'recordedByEmail', label: 'Recorder Email' },
    { key: 'createdAt', label: 'Recorded On' },
  ];

  const prepareExportData = () => {
    return filteredRecords.map(record => ({
      serviceName: record.serviceName,
      serviceDate: formatDateForExport(record.serviceDate),
      serviceType: record.serviceName,
      offering: formatCurrencyForExport(record.offerings.offering),
      donation: formatCurrencyForExport(record.offerings.donation),
      thanksgiving: formatCurrencyForExport(record.offerings.thanksgiving),
      totalAmount: formatCurrencyForExport(record.totalAmount),
      cash: formatCurrencyForExport(record.paymentBreakdown.cash),
      mobileMoney: formatCurrencyForExport(record.paymentBreakdown.mobile_money),
      card: formatCurrencyForExport(record.paymentBreakdown.card),
      bankTransfer: formatCurrencyForExport(record.paymentBreakdown.bank_transfer),
      notes: record.notes || '',
      recordedBy: record.createdBy || '',
      recordedByEmail: record.createdByEmail || '',
      createdAt: formatDateForExport(record.createdAt),
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(prepareExportData(), 'giving_records', exportColumns);
  };

  const handleExportPDF = () => {
    exportToPDF(prepareExportData(), 'giving_records', 'Church Giving Records', exportColumns);
  };

  const handleExportXLSX = () => {
    exportToXLSX(prepareExportData(), 'giving_records', exportColumns);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Giving</h1>
          <p className="text-muted-foreground">Loading giving data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (showCustomTypeManager && canManageCustomTypes) {
    return <CustomTypeManager
      customTypes={customTypes}
      onBack={() => setShowCustomTypeManager(false)}
      onDelete={handleDeleteCustomType}
      onToggle={handleToggleCustomType}
      onAdd={async (newType) => {
        try {
          const createdType = await api.giving.types.create({
            name: newType.name,
            description: newType.description
          });
          clearCacheByPattern('giving-types');
          setCustomTypes(prev => [...prev, createdType]);
          toast.success('Giving type created successfully');
        } catch (error: any) {
          console.error('Failed to create giving type:', error);
          toast.error(getFriendlyMessage(error));
        }
      }}
      onRefresh={async () => { await refreshTypes(); }}
    />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 relative">
      <LargeTitle
        title={
          <span className="flex items-center gap-2">
            Giving
            {!isOnline && (
              <Badge variant="outline" className="bg-warning-soft text-warning-text border-0">
                <WifiOff className="w-3 h-3 mr-1" />
                Cached
              </Badge>
            )}
          </span>
        }
        subtitle="Offerings, donations and thanksgiving per service"
        actions={
          <>
            {canRecordGiving && (
              <Button onClick={onRecordGiving}>
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Record Giving</span>
                <span className="sr-only sm:hidden">Record Giving</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="soft" size="icon" aria-label="More actions">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canManageCustomTypes && (
                  <DropdownMenuItem onClick={() => setShowCustomTypeManager(true)}>
                    <Settings className="w-4 h-4" />
                    Manage Types
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </DropdownMenuItem>
                {records.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <Download className="w-4 h-4" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLSX}>
                      <Download className="w-4 h-4" />
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <Download className="w-4 h-4" />
                      Export as PDF
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { icon: Banknote, tone: 'success' as const, value: totalGiving, label: 'Total Giving' },
          { icon: Calendar, tone: 'info' as const, value: thisMonthGiving, label: 'This Month' },
          { icon: TrendingUp, tone: 'info' as const, value: thisWeekGiving, label: 'This Week' },
          { icon: TrendingDown, tone: 'warning' as const, value: netGiving, label: 'Net Giving' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-3 sm:p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 truncate text-xl font-bold leading-none tracking-tight tabular-nums sm:text-2xl">{formatAmount(stat.value)}</div>
            <div className="mt-1 text-[13px] text-muted-foreground sm:text-[15px]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchField className="flex-1" value={searchTerm} onChange={setSearchTerm} placeholder="Search service name or notes" />
        <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {Object.entries(serviceTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {records.length === 0 ? (
        <Group>
          <EmptyState
            icon={Church}
            title="No Giving Records Yet"
            description="Start tracking your church's offerings, donations and thanksgiving by service."
            action={canRecordGiving ? <Button onClick={onRecordGiving}><Plus className="w-4 h-4 mr-2" />Record First Service Giving</Button> : undefined}
          />
        </Group>
      ) : filteredRecords.length === 0 ? (
        <Group>
          <EmptyState icon={Search} title="No results" description="No giving records match your filters." />
        </Group>
      ) : (
        <div className="space-y-3">
          <h2 className="px-4 text-[13px] uppercase tracking-wide text-muted-foreground">Service giving records</h2>
          {filteredRecords.map((record) => {
            const key = getExpenseKey(record.serviceDate, record.serviceType);
            const recordExpenses = expensesByKey.get(key) ?? 0;
            const editInfo = getEditWindowInfo(record.createdAt);
            const editable = editInfo.canEdit || isDev;
            const customTotal = Object.values(record.offerings.customTypes).reduce((a, b) => a + b, 0);
            const parts: [string, number][] = [
              ['Offering', record.offerings.offering],
              ...((record.offerings.donation ?? 0) > 0 ? [['Donation', record.offerings.donation ?? 0] as [string, number]] : []),
              ['Thanksgiving', record.offerings.thanksgiving],
              ...(Object.keys(record.offerings.customTypes).length > 0 ? [['Other', customTotal] as [string, number]] : []),
            ];
            return (
              <article key={record.id} className="overflow-hidden rounded-xl bg-card">
                <button
                  type="button"
                  disabled={!onViewRecord}
                  onClick={() => onViewRecord?.(record.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-accent/60 enabled:active:bg-accent"
                >
                  <IconTile icon={Church} tone="primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] leading-snug lg:text-[15px]">{record.serviceName}</span>
                    <span className="block text-[13px] text-muted-foreground">{formatDate(record.serviceDate)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xl font-bold leading-none tabular-nums text-foreground">{formatAmount(record.totalAmount)}</span>
                    <span className="text-[11px] text-muted-foreground">Total</span>
                  </span>
                  {onViewRecord ? <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" /> : null}
                </button>

                <div className="space-y-3 border-t border-separator px-4 py-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    {parts.map(([label, amount]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-medium tabular-nums">{formatAmount(amount)}</dd>
                      </div>
                    ))}
                  </dl>

                  {recordExpenses > 0 && (
                    <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Giving</span>
                        <span className="font-medium tabular-nums">{formatAmount(record.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Expenses</span>
                        <span className="font-medium tabular-nums text-destructive">−{formatAmount(recordExpenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-separator pt-1">
                        <span className="font-semibold">Net Giving</span>
                        <span className="font-bold tabular-nums text-success-text">{formatAmount(record.totalAmount - recordExpenses)}</span>
                      </div>
                    </div>
                  )}

                  {(Object.keys(record.offerings.customTypes).length > 0 || Object.values(record.paymentBreakdown).some((v) => typeof v === 'number' && v > 0) || (record.paymentBreakdown.foreign_currency && record.paymentBreakdown.foreign_currency.amount > 0)) && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(record.offerings.customTypes).map(([type, amount]) => (
                        <Badge key={type} variant="secondary" className="border-0 bg-primary/10 text-primary-text">
                          {type}: {formatAmount(amount)}
                        </Badge>
                      ))}
                      {Object.entries(record.paymentBreakdown)
                        .filter(([k, value]) => k !== 'foreign_currency' && (value as number) > 0)
                        .map(([method, amount]) => (
                          <Badge key={method} variant="secondary" className="border-0 bg-fill text-foreground">
                            {paymentMethodLabels[method as keyof typeof paymentMethodLabels]}: {formatAmount(amount as number)}
                          </Badge>
                        ))}
                      {record.paymentBreakdown.foreign_currency && record.paymentBreakdown.foreign_currency.amount > 0 && (
                        <Badge variant="secondary" className="border-0 bg-warning-soft text-warning-text">
                          Foreign: GH₵{record.paymentBreakdown.foreign_currency.ghs_equivalent.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}

                  {record.notes && <p className="truncate text-sm italic text-muted-foreground">Note: {record.notes}</p>}

                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="min-w-0 space-y-0.5">
                      {record.createdBy && record.createdAt && <div className="truncate">Recorded by {record.createdBy} on {formatDate(record.createdAt)}</div>}
                      {record.editedBy && record.editedAt && <div className="truncate">Edited by {record.editedBy} on {formatDate(record.editedAt)}</div>}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      {editable ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                      {editable ? (isDev && !editInfo.canEdit ? 'Dev' : editInfo.label) : 'Locked'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}

// Custom Type Manager Component
interface CustomTypeManagerProps {
  customTypes: CustomGivingType[];
  onBack: () => void;
  onDelete: (typeId: string) => void;
  onToggle: (typeId: string) => void;
  onAdd: (type: Omit<CustomGivingType, 'id' | 'isActive' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onRefresh: () => Promise<void>;
}

export function CustomTypeManager({ customTypes, onBack, onDelete, onToggle, onAdd, onRefresh }: CustomTypeManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const { isOnline } = useNetworkStatus();

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.warning('Reconnect to add custom giving types.');
      return;
    }
    if (!newTypeName.trim()) return;

    onAdd({
      name: newTypeName.trim(),
      description: newTypeDescription.trim() || undefined
    });

    setNewTypeName('');
    setNewTypeDescription('');
    setShowAddForm(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>Manage Custom Giving Types</h1>
            <p className="text-muted-foreground">
              Add, edit, or remove custom giving types
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Add New Type */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Giving Types</CardTitle>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showAddForm ? 'Cancel' : 'Add Type'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleAddType} className="space-y-4 mb-6 p-4 box-muted rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="typeName">Type Name *</Label>
                <Input
                  id="typeName"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g., Special Projects, Benevolence Fund"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="typeDescription">Description</Label>
                <Input
                  id="typeDescription"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="Optional description of this giving type"
                />
              </div>
              <Button type="submit" disabled={!newTypeName.trim()}>
                Add Custom Type
              </Button>
            </form>
          )}

          <div className="space-y-4">
            {customTypes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No custom giving types have been created yet. Add your first custom type above.
                </AlertDescription>
              </Alert>
            ) : (
              customTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{type.name}</h3>
                      <Badge variant={type.isActive ? 'default' : 'secondary'}>
                        {type.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {type.description && (
                      <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    )}
                    {type.createdBy && type.createdAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Created by {type.createdBy}{type.createdByEmail && ` (${type.createdByEmail})`} on {new Date(type.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isOnline}
                      onClick={() => onToggle(type.id)}
                    >
                      {type.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(type.id)}
                      className="text-destructive hover:text-destructive"
                      disabled={!isOnline}
                      title={!isOnline ? 'Reconnect to delete records.' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Record Giving Component - Now records per service
interface RecordGivingProps {
  onBack: () => void;
  onSave: (record: Omit<GivingRecord, 'id' | 'totalAmount' | 'createdBy' | 'createdAt'>) => void;
  onManageTypes?: () => void;
}

// Service type interface for attendance services
interface AttendanceService {
  id: string;
  name: string;
  isActive: boolean;
}

export function RecordGiving({ onBack, onSave, onManageTypes }: RecordGivingProps) {
  // Service selection
  const [selectedServiceId, setSelectedServiceId] = useState('sunday_main');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Offering amounts
  const [offeringAmount, setOfferingAmount] = useState('');

  const [thanksgivingAmount, setThanksgivingAmount] = useState('');

  // Custom types
  const [customTypeAmounts, setCustomTypeAmounts] = useState<{ [key: string]: string }>({});

  // Payment breakdown
  const [cashAmount, setCashAmount] = useState('');
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [bankTransferAmount, setBankTransferAmount] = useState('');

  // Foreign currency
  const [foreignCurrency, setForeignCurrency] = useState('');
  const [foreignAmount, setForeignAmount] = useState('');
  const [foreignGhsEquivalent, setForeignGhsEquivalent] = useState('');

  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Fetch active services from attendance
  const { data: cachedServices } = useCachedData<AttendanceService[]>(
    'custom-services',
    () => api.services.getAll(),
    { duration: 5 * 60 * 1000 }
  );
  const [availableServices, setAvailableServices] = useState<AttendanceService[]>([]);

  useEffect(() => {
    if (cachedServices) {
      // Filter only active services
      setAvailableServices(cachedServices.filter((s: any) => s.isActive));
    }
  }, [cachedServices]);

  const { data: cachedGivingTypes } = useCachedData<CustomGivingType[]>(
    'giving-types',
    () => api.giving.types.getAll(),
    { duration: 5 * 60 * 1000 }
  );
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);

  useEffect(() => {
    if (cachedGivingTypes) setCustomTypes(cachedGivingTypes.filter(type => type.isActive));
  }, [cachedGivingTypes]);

  // Get the selected service name and type
  const getSelectedServiceInfo = () => {
    if (selectedServiceId === 'sunday_main') {
      return { name: 'Sunday Main Service', type: 'sunday_morning' as const };
    }
    const service = availableServices.find(s => s.id === selectedServiceId);
    if (service) {
      return { name: service.name, type: 'other' as const };
    }
    return { name: 'Sunday Main Service', type: 'sunday_morning' as const };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const customTypesObj: { [key: string]: number } = {};
      Object.entries(customTypeAmounts).forEach(([key, value]) => {
        const amount = parseFloat(value);
        if (amount > 0) {
          customTypesObj[key] = amount;
        }
      });

      // Build payment breakdown with optional foreign currency
      const paymentBreakdown: any = {
        cash: parseFloat(cashAmount) || 0,
        mobile_money: parseFloat(mobileMoneyAmount) || 0,
        card: parseFloat(cardAmount) || 0,
        bank_transfer: parseFloat(bankTransferAmount) || 0
      };

      // Add foreign currency if provided
      if (foreignCurrency && (parseFloat(foreignAmount) || 0) > 0) {
        paymentBreakdown.foreign_currency = {
          currency: foreignCurrency,
          amount: parseFloat(foreignAmount) || 0,
          ghs_equivalent: parseFloat(foreignGhsEquivalent) || 0
        };
      }

      const serviceInfo = getSelectedServiceInfo();
      const givingData = {
        serviceName: serviceInfo.name,
        serviceDate,
        serviceType: serviceInfo.type,
        offerings: {
          offering: parseFloat(offeringAmount) || 0,

          thanksgiving: parseFloat(thanksgivingAmount) || 0,
          customTypes: customTypesObj
        },
        paymentBreakdown,
        totalAmount: calculateTotal(),
        notes: notes || undefined
      };

      await api.giving.create(givingData);
      onSave(givingData);
    } catch (error) {
      console.error('Failed to record giving:', error);
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    const offering = parseFloat(offeringAmount) || 0;
    const thanksgiving = parseFloat(thanksgivingAmount) || 0;
    const customTotal = Object.values(customTypeAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    return offering + thanksgiving + customTotal;
  };

  const calculatePaymentTotal = () => {
    const cash = parseFloat(cashAmount) || 0;
    const mobileMoney = parseFloat(mobileMoneyAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    const bankTransfer = parseFloat(bankTransferAmount) || 0;
    const foreignGhs = parseFloat(foreignGhsEquivalent) || 0;
    return cash + mobileMoney + card + bankTransfer + foreignGhs;
  };

  const total = calculateTotal();
  const paymentTotal = calculatePaymentTotal();
  const isBalanced = Math.abs(total - paymentTotal) < 0.01;

  const isValid = serviceDate && total > 0 && isBalanced;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Record Service Giving</h1>
          <p className="text-muted-foreground">
            Record all giving for a service
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Service Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday_main">Sunday Main Service</SelectItem>
                    {availableServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDate">Service Date *</Label>
                <Input
                  id="serviceDate"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Giving Amounts */}
            <div className="space-y-4">
              <h3>Giving Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offering">Offering (GH₵)</Label>
                  <Input
                    id="offering"
                    type="number"
                    step="0.01"
                    min="0"
                    value={offeringAmount}
                    onChange={(e) => setOfferingAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="thanksgiving">Thanksgiving (GH₵)</Label>
                  <Input
                    id="thanksgiving"
                    type="number"
                    step="0.01"
                    min="0"
                    value={thanksgivingAmount}
                    onChange={(e) => setThanksgivingAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Custom Types */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Custom Giving Types</h4>
                  {onManageTypes && (
                    <Button type="button" variant="outline" size="sm" onClick={onManageTypes}>
                      <Plus className="w-3 h-3 mr-1" />
                      Create Custom Giving Type
                    </Button>
                  )}
                </div>
                {customTypes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customTypes.map((type) => (
                      <div key={type.id} className="space-y-2">
                        <Label htmlFor={`custom-${type.id}`}>
                          {type.name} (GH₵)
                          {type.description && (
                            <span className="text-xs text-muted-foreground block">{type.description}</span>
                          )}
                        </Label>
                        <Input
                          id={`custom-${type.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={customTypeAmounts[type.name] || ''}
                          onChange={(e) => setCustomTypeAmounts({
                            ...customTypeAmounts,
                            [type.name]: e.target.value
                          })}
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No custom giving types yet.{onManageTypes && ' Click "Create Custom Giving Type" to add one.'}
                  </p>
                )}
              </div>

              <div className="p-3 box-primary rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-primary-foreground/80 dark:text-primary-foreground/90">Total Giving:</span>
                  <span className="text-xl font-bold">{formatGhanaCedis(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-4">
              <h3>Payment Method Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cash">Cash (GH₵)</Label>
                  <Input
                    id="cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mobileMoney">Mobile Money (GH₵)</Label>
                  <Input
                    id="mobileMoney"
                    type="number"
                    step="0.01"
                    min="0"
                    value={mobileMoneyAmount}
                    onChange={(e) => setMobileMoneyAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="card">Card (GH₵)</Label>
                  <Input
                    id="card"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankTransfer">Bank Transfer (GH₵)</Label>
                  <Input
                    id="bankTransfer"
                    type="number"
                    step="0.01"
                    min="0"
                    value={bankTransferAmount}
                    onChange={(e) => setBankTransferAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Foreign Currency Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Foreign Currency (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="foreignCurrency">Currency</Label>
                    <Select value={foreignCurrency || 'none'} onValueChange={(val: string) => setForeignCurrency(val === 'none' ? '' : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.symbol} {curr.code} - {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foreignAmount">
                      Amount {foreignCurrency && `(${CURRENCIES.find(c => c.code === foreignCurrency)?.symbol || foreignCurrency})`}
                    </Label>
                    <Input
                      id="foreignAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={foreignAmount}
                      onChange={(e) => setForeignAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={!foreignCurrency}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foreignGhsEquivalent">GH₵ Equivalent</Label>
                    <Input
                      id="foreignGhsEquivalent"
                      type="number"
                      step="0.01"
                      min="0"
                      value={foreignGhsEquivalent}
                      onChange={(e) => setForeignGhsEquivalent(e.target.value)}
                      placeholder="0.00"
                      disabled={!foreignCurrency}
                    />
                    <p className="text-xs text-muted-foreground">Enter the converted amount in GH₵</p>
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isBalanced ? 'bg-success-soft/50' : 'bg-destructive/10'}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${isBalanced ? 'text-success-text' : 'text-destructive'}`}>Payment Total:</span>
                  <span className={`text-xl font-bold ${isBalanced ? 'text-success-text' : 'text-destructive'}`}>{formatGhanaCedis(paymentTotal)}</span>
                </div>
                {!isBalanced && total > 0 && (
                  <p className="text-sm text-destructive mt-1">
                    Payment total must match giving total ({formatGhanaCedis(total)})
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or observations"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={!isValid || isLoading}>
                {isLoading ? 'Saving...' : 'Save Service Giving'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// GIVING DETAIL - View/Edit a single giving record
// ============================================================================

interface GivingDetailProps {
  recordId: string;
  onBack: () => void;
  onSaved: () => void;
}

export function GivingDetail({ recordId, onBack, onSaved }: GivingDetailProps) {
  const [record, setRecord] = useState<GivingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const { user } = useAuth();

  // Editable fields
  const [offeringAmount, setOfferingAmount] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [thanksgivingAmount, setThanksgivingAmount] = useState('');
  const [customTypeAmounts, setCustomTypeAmounts] = useState<{ [key: string]: string }>({});
  const [cashAmount, setCashAmount] = useState('');
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [bankTransferAmount, setBankTransferAmount] = useState('');
  const [foreignCurrency, setForeignCurrency] = useState('');
  const [foreignAmount, setForeignAmount] = useState('');
  const [foreignGhsEquivalent, setForeignGhsEquivalent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const [data, editStatus] = await Promise.all([
          api.giving.getById(recordId),
          api.giving.getEditStatus(recordId)
        ]);
        setRecord(data);
        setCanEdit(editStatus.canEdit);
        setTimeRemaining(editStatus.timeRemaining || '');

        // Populate edit fields
        if (data) {
          setOfferingAmount(String(data.offerings?.offering || 0));
          setDonationAmount(String(data.offerings?.donation || 0));
          setThanksgivingAmount(String(data.offerings?.thanksgiving || 0));
          const cta: { [key: string]: string } = {};
          if (data.offerings?.customTypes) {
            Object.entries(data.offerings.customTypes).forEach(([k, v]) => {
              cta[k] = String(v);
            });
          }
          setCustomTypeAmounts(cta);
          setCashAmount(String(data.paymentBreakdown?.cash || 0));
          setMobileMoneyAmount(String(data.paymentBreakdown?.mobile_money || 0));
          setCardAmount(String(data.paymentBreakdown?.card || 0));
          setBankTransferAmount(String(data.paymentBreakdown?.bank_transfer || 0));
          if (data.paymentBreakdown?.foreign_currency) {
            setForeignCurrency(data.paymentBreakdown.foreign_currency.currency || '');
            setForeignAmount(String(data.paymentBreakdown.foreign_currency.amount || 0));
            setForeignGhsEquivalent(String(data.paymentBreakdown.foreign_currency.ghs_equivalent || 0));
          }
          setNotes(data.notes || '');
        }
      } catch (error) {
        console.error('Failed to fetch giving record:', error);
        toast.error('Failed to load giving record');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [recordId]);

  const calculateTotal = () => {
    const offering = parseFloat(offeringAmount) || 0;
    const donation = parseFloat(donationAmount) || 0;
    const thanksgiving = parseFloat(thanksgivingAmount) || 0;
    const customTotal = Object.values(customTypeAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    return offering + donation + thanksgiving + customTotal;
  };

  const calculatePaymentTotal = () => {
    const cash = parseFloat(cashAmount) || 0;
    const mobileMoney = parseFloat(mobileMoneyAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    const bankTransfer = parseFloat(bankTransferAmount) || 0;
    const foreignGhs = parseFloat(foreignGhsEquivalent) || 0;
    return cash + mobileMoney + card + bankTransfer + foreignGhs;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const customTypesObj: { [key: string]: number } = {};
      Object.entries(customTypeAmounts).forEach(([key, value]) => {
        const amount = parseFloat(value);
        if (amount > 0) {
          customTypesObj[key] = amount;
        }
      });

      const paymentBreakdown: any = {
        cash: parseFloat(cashAmount) || 0,
        mobile_money: parseFloat(mobileMoneyAmount) || 0,
        card: parseFloat(cardAmount) || 0,
        bank_transfer: parseFloat(bankTransferAmount) || 0
      };

      if (foreignCurrency && (parseFloat(foreignAmount) || 0) > 0) {
        paymentBreakdown.foreign_currency = {
          currency: foreignCurrency,
          amount: parseFloat(foreignAmount) || 0,
          ghs_equivalent: parseFloat(foreignGhsEquivalent) || 0
        };
      }

      await api.giving.update(recordId, {
        offerings: {
          offering: parseFloat(offeringAmount) || 0,
          donation: parseFloat(donationAmount) || 0,
          thanksgiving: parseFloat(thanksgivingAmount) || 0,
          customTypes: customTypesObj
        },
        paymentBreakdown,
        totalAmount: calculateTotal(),
        notes: notes || undefined
      });

      toast.success('Giving record updated successfully!');
      onSaved();
    } catch (error: any) {
      console.error('Failed to update giving record:', error);
      toast.error(error?.message || 'Failed to update giving record');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1>Giving Record</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1>Giving Record</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Record not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = calculateTotal();
  const paymentTotal = calculatePaymentTotal();
  const isBalanced = Math.abs(total - paymentTotal) < 0.01;
  const isDev = user?.role === 'dev';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // VIEW MODE
  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1>{record.serviceName}</h1>
              <p className="text-muted-foreground">{formatDate(record.serviceDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={canEdit || isDev ? 'badge-success' : 'badge-muted'}>
              {canEdit || isDev ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {canEdit ? timeRemaining : isDev ? 'Dev Access' : 'Locked'}
            </Badge>
            {(canEdit || isDev) && (
              <Button onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Total Giving</CardTitle>
              <span className="text-2xl font-bold text-primary">{formatGhanaCedis(record.totalAmount)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Giving Breakdown */}
            <div>
              <h3 className="font-medium mb-3">Giving Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 p-3 box-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Offering</p>
                  <p className="font-medium">{formatGhanaCedis(record.offerings.offering)}</p>
                </div>
                {(record.offerings.donation ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Donation</p>
                  <p className="font-medium">{formatGhanaCedis(record.offerings.donation ?? 0)}</p>
                </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Thanksgiving</p>
                  <p className="font-medium">{formatGhanaCedis(record.offerings.thanksgiving)}</p>
                </div>
              </div>
            </div>

            {/* Custom Types */}
            {Object.entries(record.offerings.customTypes).length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Custom Types</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(record.offerings.customTypes).map(([type, amount]) => (
                    <Badge key={type} variant="outline" className="badge-purple text-sm py-1 px-3">
                      {type}: {formatGhanaCedis(amount)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Breakdown */}
            <div>
              <h3 className="font-medium mb-3">Payment Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 p-3 box-muted rounded-lg">
                {Object.entries(record.paymentBreakdown)
                  .filter(([key]) => key !== 'foreign_currency')
                  .map(([method, amount]) => (
                    <div key={method}>
                      <p className="text-xs text-muted-foreground">{paymentMethodLabels[method as keyof typeof paymentMethodLabels]}</p>
                      <p className="font-medium">{formatGhanaCedis(amount as number)}</p>
                    </div>
                  ))}
              </div>
              {record.paymentBreakdown.foreign_currency && record.paymentBreakdown.foreign_currency.amount > 0 && (
                <div className="mt-2 p-3 box-warning rounded-lg">
                  <p className="text-xs text-muted-foreground">Foreign Currency ({record.paymentBreakdown.foreign_currency.currency})</p>
                  <p className="font-medium">
                    {CURRENCIES.find(c => c.code === record.paymentBreakdown.foreign_currency?.currency)?.symbol || ''}
                    {record.paymentBreakdown.foreign_currency.amount.toFixed(2)} (GH₵{record.paymentBreakdown.foreign_currency.ghs_equivalent.toFixed(2)})
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {record.notes && (
              <div>
                <h3 className="font-medium mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground italic">{record.notes}</p>
              </div>
            )}

            {/* Audit */}
            {(record.createdBy || record.editedBy) && (
              <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
                {record.createdBy && record.createdAt && (
                  <div>Recorded by {record.createdBy}{record.createdByEmail && ` (${record.createdByEmail})`} on {formatDate(record.createdAt)}</div>
                )}
                {record.editedBy && record.editedAt && (
                  <div>Edited by {record.editedBy}{record.editedByEmail && ` (${record.editedByEmail})`} on {formatDate(record.editedAt)}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // EDIT MODE
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Edit Giving Record</h1>
          <p className="text-muted-foreground">{record.serviceName} - {formatDate(record.serviceDate)}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Giving Breakdown */}
          <div className="space-y-4">
            <h3>Giving Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-offering">Offering (GH₵)</Label>
                <Input id="edit-offering" type="number" step="0.01" min="0" value={offeringAmount} onChange={(e) => setOfferingAmount(e.target.value)} placeholder="0.00" />
              </div>
              {(parseFloat(donationAmount) || 0) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-donation">Donation (GH₵)</Label>
                <Input id="edit-donation" type="number" step="0.01" min="0" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} placeholder="0.00" />
              </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-thanksgiving">Thanksgiving (GH₵)</Label>
                <Input id="edit-thanksgiving" type="number" step="0.01" min="0" value={thanksgivingAmount} onChange={(e) => setThanksgivingAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Custom Types Edit */}
            {Object.keys(customTypeAmounts).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {Object.entries(customTypeAmounts).map(([typeName, amount]) => (
                  <div key={typeName} className="space-y-2">
                    <Label>{typeName} (GH₵)</Label>
                    <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setCustomTypeAmounts({ ...customTypeAmounts, [typeName]: e.target.value })} placeholder="0.00" />
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 box-primary rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-primary-foreground/80 dark:text-primary-foreground/90">Total Giving:</span>
                <span className="text-xl font-bold">{formatGhanaCedis(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-4">
            <h3>Payment Method Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cash (GH₵)</Label>
                <Input type="number" step="0.01" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Mobile Money (GH₵)</Label>
                <Input type="number" step="0.01" min="0" value={mobileMoneyAmount} onChange={(e) => setMobileMoneyAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Card (GH₵)</Label>
                <Input type="number" step="0.01" min="0" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Bank Transfer (GH₵)</Label>
                <Input type="number" step="0.01" min="0" value={bankTransferAmount} onChange={(e) => setBankTransferAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Foreign Currency */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium">Foreign Currency</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={foreignCurrency || 'none'} onValueChange={(val: string) => setForeignCurrency(val === 'none' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>{curr.symbol} {curr.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" min="0" value={foreignAmount} onChange={(e) => setForeignAmount(e.target.value)} placeholder="0.00" disabled={!foreignCurrency} />
                </div>
                <div className="space-y-2">
                  <Label>GH₵ Equivalent</Label>
                  <Input type="number" step="0.01" min="0" value={foreignGhsEquivalent} onChange={(e) => setForeignGhsEquivalent(e.target.value)} placeholder="0.00" disabled={!foreignCurrency} />
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${isBalanced ? 'bg-success-soft/50' : 'bg-destructive/10'}`}>
              <div className="flex justify-between items-center">
                <span className={`font-medium ${isBalanced ? 'text-success-text' : 'text-destructive'}`}>Payment Total:</span>
                <span className={`text-xl font-bold ${isBalanced ? 'text-success-text' : 'text-destructive'}`}>{formatGhanaCedis(paymentTotal)}</span>
              </div>
              {!isBalanced && total > 0 && (
                <p className="text-sm text-destructive mt-1">
                  Payment total must match giving total ({formatGhanaCedis(total)})
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving || !isBalanced || total <= 0}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
