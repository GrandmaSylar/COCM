import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { DollarSign, Plus, TrendingUp, Calendar, Search, ArrowLeft, Edit, Trash2, X, Settings, Church, Download } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';
import { api } from '../services/api';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport, formatCurrencyForExport } from '../utils/export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface GivingRecord {
  id: string;
  serviceName: string; // e.g., "Sunday Morning Service", "Midweek Service"
  serviceDate: string;
  serviceType: 'sunday_morning' | 'sunday_evening' | 'midweek' | 'special' | 'other';
  offerings: {
    offering: number;
    donation: number;
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
  createdBy?: string; // User's name who recorded the giving
  createdByEmail?: string; // User's email who recorded the giving
  createdAt?: string;
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
}

const serviceTypeLabels = {
  sunday_morning: 'Sunday Morning',
  sunday_evening: 'Sunday Evening',
  midweek: 'Midweek Service',
  special: 'Special Service',
  other: 'Other'
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

export function Giving({ onRecordGiving }: GivingProps) {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showCustomTypeManager, setShowCustomTypeManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, canAccess } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [givingData, typesData] = await Promise.all([
          api.giving.getAll(),
          api.giving.types.getAll()
        ]);
        setRecords(givingData || []);
        setCustomTypes(typesData || []);
      } catch (error) {
        console.error('Failed to fetch giving data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const canRecordGiving = canAccess('record_giving');
  const canManageCustomTypes = canAccess('manage_giving_types');

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = formatGhanaCedis;

  const getServiceTypeColor = (type: string) => {
    switch (type) {
      case 'sunday_morning': return 'bg-blue-100 text-blue-800';
      case 'sunday_evening': return 'bg-purple-100 text-purple-800';
      case 'midweek': return 'bg-green-100 text-green-800';
      case 'special': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteCustomType = async (typeId: string) => {
    if (confirm('Are you sure you want to delete this custom giving type?')) {
      try {
        await api.giving.types.delete(typeId);
        setCustomTypes(prev => prev.filter(type => type.id !== typeId));
        toast.success('Giving type deleted successfully');
      } catch (error) {
        console.error('Failed to delete giving type:', error);
        toast.error('Failed to delete giving type');
      }
    }
  };

  const handleToggleCustomType = async (typeId: string) => {
    try {
      await api.giving.types.toggle(typeId);
      setCustomTypes(prev => prev.map(type =>
        type.id === typeId ? { ...type, isActive: !type.isActive } : type
      ));
      toast.success('Giving type updated');
    } catch (error) {
      console.error('Failed to toggle giving type:', error);
      toast.error('Failed to update giving type');
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
      serviceType: serviceTypeLabels[record.serviceType],
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
          setCustomTypes(prev => [...prev, createdType]);
          toast.success('Giving type created successfully');
        } catch (error) {
          console.error('Failed to create giving type:', error);
          toast.error('Failed to create giving type');
        }
      }}
    />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Giving</h1>
          <p className="text-muted-foreground">
            Track offerings, donations, and thanksgiving per service
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export Button */}
          {records.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canManageCustomTypes && (
            <Button variant="outline" onClick={() => setShowCustomTypeManager(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Types
            </Button>
          )}
          {canRecordGiving && (
            <Button onClick={onRecordGiving}>
              <Plus className="w-4 h-4 mr-2" />
              Record Service Giving
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(totalGiving)}</p>
                <p className="text-sm text-muted-foreground">Total Giving</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(thisMonthGiving)}</p>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(thisWeekGiving)}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by service name or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
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

      {/* Giving Records */}
      <div className="space-y-4">
        <h2>Service Giving Records</h2>
        {records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Church className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-2">No Giving Records Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start tracking your church's offerings, donations, and thanksgiving by service.
                </p>
                {canRecordGiving && (
                  <Button onClick={onRecordGiving}>
                    <Plus className="w-4 h-4 mr-2" />
                    Record First Service Giving
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No giving records found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Church className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{record.serviceName}</h3>
                          <Badge className={getServiceTypeColor(record.serviceType)}>
                            {serviceTypeLabels[record.serviceType]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(record.serviceDate)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {formatAmount(record.totalAmount)}
                      </div>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Offering</p>
                      <p className="font-medium">{formatAmount(record.offerings.offering)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Donation</p>
                      <p className="font-medium">{formatAmount(record.offerings.donation)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Thanksgiving</p>
                      <p className="font-medium">{formatAmount(record.offerings.thanksgiving)}</p>
                    </div>
                    {Object.keys(record.offerings.customTypes).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Other</p>
                        <p className="font-medium">
                          {formatAmount(Object.values(record.offerings.customTypes).reduce((a, b) => a + b, 0))}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Custom Types */}
                  {Object.entries(record.offerings.customTypes).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(record.offerings.customTypes).map(([type, amount]) => (
                        <Badge key={type} variant="outline" className="bg-purple-50">
                          {type}: {formatAmount(amount)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Payment Breakdown */}
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(record.paymentBreakdown)
                      .filter(([key, value]) => key !== 'foreign_currency' && (value as number) > 0)
                      .map(([method, amount]) => (
                        <Badge key={method} variant="outline">
                          {paymentMethodLabels[method as keyof typeof paymentMethodLabels]}: {formatAmount(amount as number)}
                        </Badge>
                      ))}
                    {record.paymentBreakdown.foreign_currency && record.paymentBreakdown.foreign_currency.amount > 0 && (
                      <Badge variant="outline" className="bg-yellow-50">
                        Foreign ({record.paymentBreakdown.foreign_currency.currency}): {
                          CURRENCIES.find(c => c.code === record.paymentBreakdown.foreign_currency?.currency)?.symbol || ''
                        }{record.paymentBreakdown.foreign_currency.amount.toFixed(2)} (GH₵{record.paymentBreakdown.foreign_currency.ghs_equivalent.toFixed(2)})
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {record.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      Note: {record.notes}
                    </p>
                  )}

                  {/* Footer */}
                  {record.createdBy && record.createdAt && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Recorded by {record.createdBy}{record.createdByEmail && ` (${record.createdByEmail})`} on {formatDate(record.createdAt)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Mobile Floating Action Button */}
      {canRecordGiving && (
        <div className="lg:hidden fixed bottom-20 right-4">
          <Button
            onClick={onRecordGiving}
            size="lg"
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Custom Type Manager Component
interface CustomTypeManagerProps {
  customTypes: CustomGivingType[];
  onBack: () => void;
  onDelete: (typeId: string) => void;
  onToggle: (typeId: string) => void;
  onAdd: (type: Omit<CustomGivingType, 'id' | 'isActive' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
}

function CustomTypeManager({ customTypes, onBack, onDelete, onToggle, onAdd }: CustomTypeManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    onAdd({
      name: newTypeName.trim(),
      description: newTypeDescription.trim() || undefined
    });

    setNewTypeName('');
    setNewTypeDescription('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <form onSubmit={handleAddType} className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/50">
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
                  <div className="flex-1">
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
                      onClick={() => onToggle(type.id)}
                    >
                      {type.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(type.id)}
                      className="text-destructive hover:text-destructive"
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
}

export function RecordGiving({ onBack, onSave }: RecordGivingProps) {
  // Service type is fixed to Sunday Main Service for now
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Offering amounts
  const [offeringAmount, setOfferingAmount] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
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
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCustomTypes = async () => {
      try {
        const typesData = await api.giving.types.getAll();
        setCustomTypes((typesData || []).filter(type => type.isActive));
      } catch (error) {
        console.error('Failed to fetch custom types:', error);
      }
    };

    fetchCustomTypes();
  }, []);

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

      const givingData = {
        serviceName: 'Sunday Main Service',
        serviceDate,
        serviceType: 'sunday_morning' as const,
        offerings: {
          offering: parseFloat(offeringAmount) || 0,
          donation: parseFloat(donationAmount) || 0,
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
                <Label>Service Type</Label>
                <div className="p-3 bg-muted rounded-md">
                  <span className="font-medium">Sunday Main Service</span>
                </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label htmlFor="donation">Donation (GH₵)</Label>
                  <Input
                    id="donation"
                    type="number"
                    step="0.01"
                    min="0"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
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
              {customTypes.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium">Custom Giving Types</h4>
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
                </div>
              )}

              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Giving:</span>
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
                    <Select value={foreignCurrency || 'none'} onValueChange={(val) => setForeignCurrency(val === 'none' ? '' : val)}>
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

              <div className={`p-3 rounded-lg ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Payment Total:</span>
                  <span className="text-xl font-bold">{formatGhanaCedis(paymentTotal)}</span>
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
