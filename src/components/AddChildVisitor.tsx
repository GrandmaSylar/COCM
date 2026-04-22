import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, Check, Users, User, Phone, StickyNote } from 'lucide-react';

interface AddChildVisitorProps {
  onBack: () => void;
  onSave: (data: any) => Promise<void>;
}

export function AddChildVisitor({ onBack, onSave }: AddChildVisitorProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    visitDate: new Date().toISOString().split('T')[0],
    occupation: '',
    contactPhone: '',
    referredBy: '',
    notes: ''
  });

  const [guardians, setGuardians] = useState([
    { id: `temp-${Date.now()}`, fullName: '', residentialLocation: '', contactInfo: '' }
  ]);

  const [ageError, setAgeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [sectionsOpen, setSectionsOpen] = useState({
    basic: true,
    contact: false,
    guardians: true,
    referral: false,
    notes: false
  });

  useEffect(() => {
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      const ageInMilliseconds = today.getTime() - dob.getTime();
      const age = Math.floor(ageInMilliseconds / (365.25 * 24 * 60 * 60 * 1000));
      if (age >= 18) {
        setAgeError("This visitor is 18 or older and cannot be registered as a child visitor");
      } else {
        setAgeError('');
      }
    } else {
      setAgeError('');
    }
  }, [formData.dateOfBirth]);

  const progressData = useMemo(() => {
    const requiredFields = [
      { name: 'First Name', filled: !!formData.firstName.trim(), section: 'basic' },
      { name: 'Last Name', filled: !!formData.lastName.trim(), section: 'basic' }
    ];

    const filledCount = requiredFields.filter(f => f.filled).length;
    const totalCount = requiredFields.length;
    const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    return { requiredFields, filledCount, totalCount, percentage };
  }, [formData, guardians]);

  const getProgressColor = (percentage: number) => {
    if (percentage < 30) return '#ef4444'; // red
    if (percentage < 50) return '#f97316'; // orange
    if (percentage < 70) return '#eab308'; // yellow
    if (percentage < 90) return '#84cc16'; // lime
    return '#22c55e'; // green
  };

  const getSectionStatus = (section: string) => {
    const sectionFields = progressData.requiredFields.filter(f => f.section === section);
    if (sectionFields.length === 0) return { complete: true, filled: 0, total: 0 };
    const filled = sectionFields.filter(f => f.filled).length;
    return { complete: filled === sectionFields.length, filled, total: sectionFields.length };
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addGuardian = () => {
    setGuardians([...guardians, { id: `temp-${Date.now()}`, fullName: '', residentialLocation: '', contactInfo: '' }]);
  };

  const removeGuardian = (id: string) => {
    setGuardians(guardians.filter(g => g.id !== id));
  };

  const updateGuardian = (id: string, field: string, value: string) => {
    setGuardians(guardians.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const isValid = !!(
    formData.firstName &&
    formData.lastName &&
    !ageError
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);
    try {
      await onSave({
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        visitDate: formData.visitDate,
        occupation: formData.occupation,
        contactPhone: formData.contactPhone,
        referredBy: formData.referredBy,
        notes: formData.notes,
        guardians: guardians.map(g => ({
          fullName: g.fullName,
          residentialLocation: g.residentialLocation,
          contactInfo: g.contactInfo
        }))
      });
    } finally {
      setIsLoading(false);
    }
  };

  const SectionHeader = ({
    title,
    icon: Icon,
    isOpen,
    hasRequired = false,
    status
  }: {
    title: string;
    icon: React.ElementType;
    isOpen: boolean;
    hasRequired?: boolean;
    status: { complete: boolean; filled: number; total: number };
  }) => {
    return (
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              status.complete && hasRequired ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'
            }`}>
              {status.complete && hasRequired ? (
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Icon className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="text-left flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {hasRequired && <span className="text-xs text-red-500 font-medium">Required</span>}
              {hasRequired && status.total > 0 && (
                <p className="text-xs text-muted-foreground ml-2">
                  {status.filled} of {status.total} filled
                </p>
              )}
            </div>
          </div>
          <ChevronDown
            className="h-5 w-5 text-muted-foreground transition-transform duration-300 ease-in-out"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </CollapsibleTrigger>
    );
  };

  return (
    <div className="space-y-4 pt-32 lg:pt-36 animate-fade-in relative pb-24">
      <div className="fixed top-2 left-2 right-2 sm:left-4 sm:right-4 lg:left-[calc(16rem+1.5rem)] lg:right-6 z-50">
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Registration Progress</span>
                <span className="text-lg font-bold" style={{ color: getProgressColor(progressData.percentage) }}>
                  {progressData.percentage}%
                </span>
              </div>
              <div className="relative h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(progressData.percentage, 3)}%`,
                    background: progressData.percentage === 0
                      ? '#ef4444'
                      : `linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 75%, #22c55e 100%)`,
                    backgroundSize: '400% 100%',
                    backgroundPosition: `${100 - progressData.percentage}% 0`
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {progressData.requiredFields.map((field) => (
                  <Badge
                    key={field.name}
                    variant={field.filled ? 'default' : 'outline'}
                    className={`text-xs transition-all duration-300 ${
                      field.filled
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {field.filled && <Check className="w-3 h-3 mr-1" />}
                    {field.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Child Visitor</h1>
          <p className="text-muted-foreground">Register a new visiting child</p>
        </div>
      </div>

      <form id="child-visitor-form" onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <Collapsible open={sectionsOpen.basic} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, basic: open }))}>
            <SectionHeader title="Basic Information" icon={User} isOpen={sectionsOpen.basic} hasRequired status={getSectionStatus('basic')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} placeholder="First Name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} placeholder="Last Name" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(value: string) => handleInputChange('gender', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} />
                    {ageError && <p className="text-sm text-red-500 mt-1">{ageError}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="visitDate">Date of Visit</Label>
                    <Input id="visitDate" type="date" value={formData.visitDate} onChange={(e) => handleInputChange('visitDate', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input id="occupation" value={formData.occupation} onChange={(e) => handleInputChange('occupation', e.target.value)} placeholder="e.g. Student" />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={sectionsOpen.contact} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, contact: open }))}>
            <SectionHeader title="Contact Info" icon={Phone} isOpen={sectionsOpen.contact} status={getSectionStatus('contact')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(e) => handleInputChange('contactPhone', e.target.value)} placeholder="Phone number" />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={sectionsOpen.guardians} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, guardians: open }))}>
            <SectionHeader title="Parents / Guardians" icon={Users} isOpen={sectionsOpen.guardians} status={getSectionStatus('guardians')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Guardians</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addGuardian}>
                    <Plus className="w-4 h-4 mr-2" /> Add Guardian
                  </Button>
                </div>
                {guardians.length === 0 ? (
                  <div className="border-2 border-dashed border-muted bg-muted/20 rounded-lg p-8 text-center">
                    <p className="text-muted-foreground font-medium">No guardians added.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {guardians.map((guardian, index) => (
                      <Card key={guardian.id} className="bg-muted/30">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <Label>Guardian {index + 1}</Label>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeGuardian(guardian.id)} disabled={guardians.length === 1} className="text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Label>Full Name</Label>
                              <Input value={guardian.fullName} onChange={(e) => updateGuardian(guardian.id, 'fullName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Residential Location</Label>
                              <Input value={guardian.residentialLocation} onChange={(e) => updateGuardian(guardian.id, 'residentialLocation', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Contact Info</Label>
                              <Input value={guardian.contactInfo} onChange={(e) => updateGuardian(guardian.id, 'contactInfo', e.target.value)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={sectionsOpen.referral} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, referral: open }))}>
            <SectionHeader title="Referral" icon={Users} isOpen={sectionsOpen.referral} status={getSectionStatus('referral')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="referredBy">Referred By</Label>
                  <Input id="referredBy" value={formData.referredBy} onChange={(e) => handleInputChange('referredBy', e.target.value)} placeholder="Who invited them?" />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={sectionsOpen.notes} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, notes: open }))}>
            <SectionHeader title="Notes" icon={StickyNote} isOpen={sectionsOpen.notes} status={getSectionStatus('notes')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={4} value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Additional information..." />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </form>

      <div className="fixed bottom-0 left-0 right-0 sm:left-64 lg:left-64 bg-background/80 backdrop-blur-md border-t p-4 z-40 transition-all duration-300 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)]">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="hidden sm:block">
            {!isValid && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Complete all required fields to save
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={onBack} disabled={isLoading} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button type="submit" form="child-visitor-form" disabled={!isValid || isLoading} className="flex-1 sm:flex-none min-w-[140px]">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Visitor
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
