import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Save, Search, X } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';

// Simplified Hook for Cache
function useCachedData<T>(fetchFn: () => Promise<T>, deps: any[] = []): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let isMounted = true;
    fetchFn().then(res => { if (isMounted) setData(res); })
    .catch(err => { if (isMounted) setError(err); })
    .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, deps);
  return { data, loading, error };
}

// Reusable Member Combobox
function MemberCombobox({ label, value, onChange, members }: { label: string, value: string, onChange: (id: string, name: string) => void, members: any[] }) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMembers = members.filter(m => 
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10); // show top 10 matches

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      <Label>{label}</Label>
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <Input
          placeholder={`Search member for ${label.toLowerCase()}...`}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            // If they clear it, clear the parent value too
            if (e.target.value === '') onChange('', '');
          }}
          onFocus={() => setShowDropdown(true)}
          className="pl-9 pr-8"
        />
        {searchTerm && (
          <button 
            type="button"
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchTerm(''); onChange('', ''); setShowDropdown(false); }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && searchTerm && filteredMembers.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-popover text-popover-foreground border rounded-md shadow-md animate-in fade-in-80 zoom-in-95">
          {filteredMembers.map(m => {
            const fullName = `${m.firstName} ${m.lastName}`;
            return (
              <li
                key={m.id}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onClick={() => {
                  setSearchTerm(fullName);
                  onChange(m.id, fullName);
                  setShowDropdown(false);
                }}
              >
                {fullName}
              </li>
            );
          })}
        </ul>
      )}
      {showDropdown && searchTerm && filteredMembers.length === 0 && (
        <div className="absolute z-10 w-full mt-1 p-3 text-sm text-muted-foreground text-center bg-popover border rounded-md shadow-md animate-in fade-in-80">
          No members found.
        </div>
      )}
    </div>
  );
}

interface AddExpenseProps {
  onBack: () => void;
  onSaved: () => void;
}

export function AddExpense({ onBack, onSaved }: AddExpenseProps) {
  const [formData, setFormData] = useState({
    formId: '',
    serviceDate: '',
    serviceType: '',
    details: '',
    amount: '',
    paymentMethodId: '',
    paymentMethodName: '',
    referenceNumber: '',
    requestedById: '',
    requestedByName: '',
    recommendedById: '',
    recommendedByName: '',
    approvedById: '',
    approvedByName: '',
  });

  const [formIdError, setFormIdError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cached data
  const { data: servicesData } = useCachedData(() => api.services.getAll());
  const { data: membersData } = useCachedData(() => api.members.getAll());
  const { data: pmData } = useCachedData(() => api.expenses.paymentMethods.getAll());

  const activeServices = servicesData?.filter((s: any) => s.is_active) || [];
  const activeMethods = pmData?.filter((pm: any) => pm.is_active) || [];
  const members = membersData || [];

  useEffect(() => {
    let isMounted = true;
    api.expenses.getNextFormId().then(res => {
      if (isMounted && res.nextFormId) {
        setFormData(prev => ({ ...prev, formId: res.nextFormId }));
      }
    }).catch(err => {
      console.error('Failed to get next form ID:', err);
    });
    return () => { isMounted = false; };
  }, []);

  const isCashSelected = formData.paymentMethodName.toLowerCase() === 'cash' || !formData.paymentMethodId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceType) {
      toast.error('Service Type is required');
      return;
    }
    if (!formData.formId || !formData.serviceDate || !formData.serviceType || !formData.details || !formData.amount || !formData.paymentMethodId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setFormIdError('');

    try {
      await api.expenses.create({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      onSaved();
    } catch (error: any) {
      console.error('Error creating expense:', error);
      if (error?.status === 409) {
        setFormIdError('This Form ID already exists — please change it');
      } else {
        toast.error(error?.message || 'Failed to create expense. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Add Expense Requisition</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requisition Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <Label htmlFor="formId">Form ID <span className="text-destructive">*</span></Label>
                <Input 
                  id="formId" 
                  value={formData.formId}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, formId: e.target.value }));
                    setFormIdError('');
                  }}
                  className={formIdError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  required
                />
                {formIdError && <p className="text-sm text-red-500 mt-1 font-medium">{formIdError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div>
                  <Badge className="bg-green-500 hover:bg-green-600 text-white shadow-sm mt-1">✓ Approved</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDate">Service Date <span className="text-destructive">*</span></Label>
                <Input 
                  id="serviceDate" 
                  type="date"
                  value={formData.serviceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceDate: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type <span className="text-destructive">*</span></Label>
                <Select 
                  value={formData.serviceType}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, serviceType: val }))}
                  required
                >
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeServices.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expenseDate">Expense Date</Label>
                <Input 
                  id="expenseDate" 
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GH₵) <span className="text-destructive">*</span></Label>
                <Input 
                  id="amount" 
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="0.00"
                  className="text-lg font-semibold tabular-nums"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="details">Details of Expenditure <span className="text-destructive">*</span></Label>
                <Textarea 
                  id="details" 
                  rows={4}
                  value={formData.details}
                  onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
                  required
                  placeholder="Provide detailed description of the expense..."
                  className="resize-y"
                />
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t md:col-span-2">
                <h3 className="text-lg font-medium">Payment Details</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method <span className="text-destructive">*</span></Label>
                <Select 
                  value={formData.paymentMethodId}
                  onValueChange={(val) => {
                    const method = activeMethods.find((m: any) => m.id === val);
                    setFormData(prev => ({ 
                      ...prev, 
                      paymentMethodId: val, 
                      paymentMethodName: method ? method.name : '',
                      referenceNumber: (method?.name.toLowerCase() === 'cash') ? '' : prev.referenceNumber
                    }));
                  }}
                  required
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMethods.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Payment Reference</Label>
                <Input 
                  id="referenceNumber" 
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                  disabled={isCashSelected}
                  className={isCashSelected ? 'bg-muted' : ''}
                  placeholder={isCashSelected ? 'Not required for Cash' : 'Cheque no. / MoMo transaction ID'}
                />
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t md:col-span-2">
                <h3 className="text-lg font-medium">Personnel</h3>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <MemberCombobox 
                  label="Requested By" 
                  value={formData.requestedByName} 
                  members={members}
                  onChange={(id, name) => setFormData(prev => ({ ...prev, requestedById: id, requestedByName: name }))}
                />
                <MemberCombobox 
                  label="Recommended By" 
                  value={formData.recommendedByName} 
                  members={members}
                  onChange={(id, name) => setFormData(prev => ({ ...prev, recommendedById: id, recommendedByName: name }))}
                />
                <MemberCombobox 
                  label="Approved By" 
                  value={formData.approvedByName} 
                  members={members}
                  onChange={(id, name) => setFormData(prev => ({ ...prev, approvedById: id, approvedByName: name }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
              <Button type="button" variant="outline" onClick={onBack}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Requisition'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
