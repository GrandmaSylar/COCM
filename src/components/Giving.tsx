import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { DollarSign, Plus, TrendingUp, Calendar, Search, ArrowLeft, Edit, Trash2, X, Settings, Church } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';

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
  };
  notes?: string;
  recordedBy: string;
  recordedDate: string;
}

interface CustomGivingType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
}

interface GivingProps {
  onRecordGiving: () => void;
}

// Mock giving records with service-based giving
const mockGivingRecords: GivingRecord[] = [
  {
    id: '1',
    serviceName: 'Sunday Morning Service',
    serviceDate: '2025-01-19',
    serviceType: 'sunday_morning',
    offerings: {
      offering: 4500,
      donation: 2000,
      thanksgiving: 1500,
      customTypes: {
        'Building Fund': 3000
      }
    },
    totalAmount: 11000,
    paymentBreakdown: {
      cash: 7000,
      mobile_money: 3500,
      card: 500,
      bank_transfer: 0
    },
    notes: 'Good attendance and giving',
    recordedBy: 'Admin User',
    recordedDate: '2025-01-19'
  },
  {
    id: '2',
    serviceName: 'Midweek Bible Study',
    serviceDate: '2025-01-15',
    serviceType: 'midweek',
    offerings: {
      offering: 2500,
      donation: 500,
      thanksgiving: 800,
      customTypes: {}
    },
    totalAmount: 3800,
    paymentBreakdown: {
      cash: 3200,
      mobile_money: 600,
      card: 0,
      bank_transfer: 0
    },
    notes: '',
    recordedBy: 'Admin User',
    recordedDate: '2025-01-15'
  },
  {
    id: '3',
    serviceName: 'Sunday Morning Service',
    serviceDate: '2025-01-12',
    serviceType: 'sunday_morning',
    offerings: {
      offering: 5200,
      donation: 1800,
      thanksgiving: 2100,
      customTypes: {
        'Building Fund': 2500,
        'Missions Support': 1000
      }
    },
    totalAmount: 12600,
    paymentBreakdown: {
      cash: 8000,
      mobile_money: 4100,
      card: 500,
      bank_transfer: 0
    },
    notes: 'Special missions emphasis',
    recordedBy: 'Pastor User',
    recordedDate: '2025-01-12'
  }
];

// Mock custom giving types
const mockCustomTypes: CustomGivingType[] = [
  {
    id: '1',
    name: 'Building Fund',
    description: 'For church building construction and renovation',
    isActive: true,
    createdBy: 'Admin User',
    createdDate: '2024-01-01'
  },
  {
    id: '2',
    name: 'Missions Support',
    description: 'Supporting missionary work',
    isActive: true,
    createdBy: 'Admin User',
    createdDate: '2024-01-01'
  }
];

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

export function Giving({ onRecordGiving }: GivingProps) {
  const [records] = useState<GivingRecord[]>(mockGivingRecords);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>(mockCustomTypes);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showCustomTypeManager, setShowCustomTypeManager] = useState(false);
  const { user, canAccess } = useAuth();

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

  const handleDeleteCustomType = (typeId: string) => {
    if (confirm('Are you sure you want to delete this custom giving type?')) {
      setCustomTypes(prev => prev.filter(type => type.id !== typeId));
    }
  };

  const handleToggleCustomType = (typeId: string) => {
    setCustomTypes(prev => prev.map(type => 
      type.id === typeId ? { ...type, isActive: !type.isActive } : type
    ));
  };

  if (showCustomTypeManager && canManageCustomTypes) {
    return <CustomTypeManager 
      customTypes={customTypes}
      onBack={() => setShowCustomTypeManager(false)}
      onDelete={handleDeleteCustomType}
      onToggle={handleToggleCustomType}
      onAdd={(newType) => {
        const type: CustomGivingType = {
          id: (customTypes.length + 1).toString(),
          ...newType,
          isActive: true,
          createdBy: user?.name || 'Unknown',
          createdDate: new Date().toISOString().split('T')[0]
        };
        setCustomTypes(prev => [...prev, type]);
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
        <div className="flex gap-2">
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
                      .filter(([_, amount]) => amount > 0)
                      .map(([method, amount]) => (
                        <Badge key={method} variant="outline">
                          {paymentMethodLabels[method as keyof typeof paymentMethodLabels]}: {formatAmount(amount)}
                        </Badge>
                      ))}
                  </div>

                  {/* Notes */}
                  {record.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      Note: {record.notes}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Recorded by {record.recordedBy} on {formatDate(record.recordedDate)}
                  </div>
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
  onAdd: (type: Omit<CustomGivingType, 'id' | 'isActive' | 'createdBy' | 'createdDate'>) => void;
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
                    <p className="text-xs text-muted-foreground mt-2">
                      Created by {type.createdBy} on {new Date(type.createdDate).toLocaleDateString()}
                    </p>
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
  onSave: (record: Omit<GivingRecord, 'id' | 'totalAmount' | 'recordedBy' | 'recordedDate'>) => void;
}

export function RecordGiving({ onBack, onSave }: RecordGivingProps) {
  const [serviceName, setServiceName] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<'sunday_morning' | 'sunday_evening' | 'midweek' | 'special' | 'other'>('sunday_morning');
  
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
  
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Mock custom types (in real app, would fetch from state/API)
  const customTypes = mockCustomTypes.filter(type => type.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    
    setTimeout(() => {
      const customTypesObj: { [key: string]: number } = {};
      Object.entries(customTypeAmounts).forEach(([key, value]) => {
        const amount = parseFloat(value);
        if (amount > 0) {
          customTypesObj[key] = amount;
        }
      });

      onSave({
        serviceName,
        serviceDate,
        serviceType,
        offerings: {
          offering: parseFloat(offeringAmount) || 0,
          donation: parseFloat(donationAmount) || 0,
          thanksgiving: parseFloat(thanksgivingAmount) || 0,
          customTypes: customTypesObj
        },
        paymentBreakdown: {
          cash: parseFloat(cashAmount) || 0,
          mobile_money: parseFloat(mobileMoneyAmount) || 0,
          card: parseFloat(cardAmount) || 0,
          bank_transfer: parseFloat(bankTransferAmount) || 0
        },
        notes: notes || undefined
      });
      setIsLoading(false);
    }, 1000);
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
    return cash + mobileMoney + card + bankTransfer;
  };

  const total = calculateTotal();
  const paymentTotal = calculatePaymentTotal();
  const isBalanced = Math.abs(total - paymentTotal) < 0.01;

  const isValid = serviceName && serviceDate && total > 0 && isBalanced;

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
                <Label htmlFor="serviceName">Service Name *</Label>
                <Input
                  id="serviceName"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g., Sunday Morning Service"
                  required
                />
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

            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={(value: any) => setServiceType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(serviceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
