import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { ArrowLeft, Save, Upload, X, Plus, Trash2, Search, CheckCircle, User, Phone, MapPin, Users, StickyNote, ChevronDown, Check } from 'lucide-react';
import { Member } from './Members';
import { Badge } from './ui/badge';
import { api } from '../services/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import type { ChildMember, ChildParent, ChildVisitor } from './Children';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
interface AddChildMemberProps {
  onBack: () => void;
  onSave: (child: Omit<ChildMember, 'id' | 'joinDate'>) => Promise<void>;
  childVisitorData?: ChildVisitor;   // future pre-fill
  initialData?: ChildMember;         // used by EditChildMember
}

interface UIChildParent {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string;
  phone: string;
  relationship: string;
  occupation: string;
  hometown: string;
  isLinked?: boolean;
  linkedMemberId?: string;
  linkedChildMemberId?: string;
}

export function AddChildMember({ onBack, onSave, childVisitorData, initialData }: AddChildMemberProps) {
  const { alertAction } = useAuth();
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || childVisitorData?.firstName || '',
    lastName: initialData?.lastName || childVisitorData?.lastName || '',
    otherNames: initialData?.otherNames || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    secondPhone: initialData?.secondPhone || '',
    gender: initialData?.gender || ('' as 'male' | 'female' | ''),
    dateOfBirth: initialData?.dateOfBirth || '',
    occupation: initialData?.occupation || '',
    hometown: initialData?.hometown || '',
    residenceLocation: initialData?.residenceLocation || '',
    digitalAddress: initialData?.digitalAddress || '',
    notes: initialData?.notes || (childVisitorData ? `Converted from visitor. Original notes: ${childVisitorData.notes || ''}` : ''),
    photo: initialData?.photo || ''
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photo || null);

  // Section open states
  const [sectionsOpen, setSectionsOpen] = useState({
    photo: true,
    basic: true,
    contact: false,
    location: false,
    parents: false,
    additional: false
  });

  const [parents, setParents] = useState<UIChildParent[]>(
    () => (initialData?.parents ?? []).map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      otherNames: p.otherNames ?? '',
      phone: p.phone ?? '',
      relationship: p.relationship,
      occupation: p.occupation ?? '',
      hometown: p.hometown ?? '',
      isLinked: p.isLinked,
      linkedMemberId: p.linkedMemberId,
      linkedChildMemberId: p.linkedChildMemberId,
    }))
  );
  const [parentSearchStates, setParentSearchStates] = useState<Record<string, { query: string; results: (Member | (ChildMember & { _pool?: string }))[] }>>({});
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [ageError, setAgeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      const ageInMilliseconds = today.getTime() - dob.getTime();
      const age = Math.floor(ageInMilliseconds / (365.25 * 24 * 60 * 60 * 1000));
      if (age >= 18) {
        setAgeError("This person is not a child. Age must be under 18.");
      } else {
        setAgeError('');
      }
    } else {
      setAgeError('');
    }
  }, [formData.dateOfBirth]);

  // Calculate progress based on required fields
  const progressData = useMemo(() => {
    const requiredFields = [
      { name: 'First Name', filled: !!formData.firstName.trim(), section: 'basic' },
      { name: 'Last Name', filled: !!formData.lastName.trim(), section: 'basic' },
      { name: 'Gender', filled: !!formData.gender, section: 'basic' },
      { name: 'Date of Birth', filled: !!formData.dateOfBirth, section: 'basic' },
      { name: 'Residence Location', filled: !!formData.residenceLocation.trim(), section: 'location' }
    ];

    const filledCount = requiredFields.filter(f => f.filled).length;
    const totalCount = requiredFields.length;
    const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    return { requiredFields, filledCount, totalCount, percentage };
  }, [formData, parents]);

  // Get progress bar color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage < 30) return '#ef4444'; // red
    if (percentage < 50) return '#f97316'; // orange
    if (percentage < 70) return '#eab308'; // yellow
    if (percentage < 90) return '#84cc16'; // lime
    return '#22c55e'; // green
  };

  // Get section completion status
  const getSectionStatus = (section: string) => {
    const sectionFields = progressData.requiredFields.filter(f => f.section === section);
    if (sectionFields.length === 0) return { complete: true, filled: 0, total: 0 };
    const filled = sectionFields.filter(f => f.filled).length;
    return { complete: filled === sectionFields.length, filled, total: sectionFields.length };
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alertAction({
          title: 'Unsupported File Type',
          description: 'The selected file is not a supported image. Please select a valid photo file (such as JPG, JPEG, or PNG).',
          variant: 'warning'
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alertAction({
          title: 'File Too Large',
          description: 'The image size exceeds the 10MB limit. Please upload a smaller image file.',
          variant: 'warning'
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setPhotoPreview(result);
        setFormData(prev => ({ ...prev, photo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setFormData(prev => ({ ...prev, photo: '' }));
  };

  // Parent CRUD handlers
  const addParent = () => {
    const newParent: UIChildParent = {
      id: `temp-${Date.now()}`,
      firstName: '',
      lastName: '',
      otherNames: '',
      phone: '',
      relationship: 'mother',
      occupation: '',
      hometown: '',
      isLinked: false
    };
    setParents([...parents, newParent]);
  };

  const removeParent = (id: string) => {
    const parentToRemove = parents.find(p => p.id === id);
    if (parentToRemove?.isLinked) {
      setPendingRemovalId(id);
      return;
    }
    setParents(parents.filter(p => p.id !== id));
  };

  const updateParent = (id: string, field: string, value: string) => {
    setParents(parents.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const searchExistingMembers = async (parentId: string, query: string) => {
    setParentSearchStates(prev => ({
      ...prev,
      [parentId]: { ...prev[parentId], query, results: prev[parentId]?.results || [] }
    }));

    if (query.length < 2) {
      setParentSearchStates(prev => ({
        ...prev,
        [parentId]: { query, results: [] }
      }));
      return;
    }

    try {
      const [members, children] = await Promise.all([
        api.members.getAll(),
        api.children.members.getAll()
      ]);
      const allMembers = [
        ...members,
        ...children.filter((c: any) => c.id !== initialData?.id).map((c: any) => ({ ...c, _pool: 'child' }))
      ];
      
      const filtered = allMembers.filter((m: any) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        (m.phone && m.phone.includes(query))
      );
      setParentSearchStates(prev => ({
        ...prev,
        [parentId]: { query, results: filtered }
      }));
    } catch (error) {
      console.error('Failed to search members:', error);
      setParentSearchStates(prev => ({
        ...prev,
        [parentId]: { query, results: [] }
      }));
    }
  };

  const linkParentToExisting = (parentId: string, existingMember: any) => {
    const isChild = existingMember._pool === 'child';
    setParents(parents.map(p =>
      p.id === parentId ? {
        ...p,
        firstName: existingMember.firstName,
        lastName: existingMember.lastName,
        otherNames: existingMember.otherNames || '',
        phone: existingMember.phone || '',
        relationship: isChild ? 'sibling' : p.relationship,
        occupation: existingMember.occupation || '',
        hometown: existingMember.hometown || '',
        isLinked: true,
        linkedMemberId: isChild ? undefined : existingMember.id,
        linkedChildMemberId: isChild ? existingMember.id : undefined
      } : p
    ));
    setParentSearchStates(prev => ({
      ...prev,
      [parentId]: { query: '', results: [] }
    }));
  };

  const unlinkParent = (parentId: string) => {
    setParents(parents.map(p =>
      p.id === parentId ? {
        ...p,
        firstName: '',
        lastName: '',
        otherNames: '',
        phone: '',
        occupation: '',
        hometown: '',
        isLinked: false,
        linkedMemberId: undefined,
        linkedChildMemberId: undefined
      } : p
    ));
  };

  const isValid = !!(formData.firstName && formData.lastName &&
                  formData.gender && formData.dateOfBirth &&
                  formData.residenceLocation && !ageError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gender || !isValid) return;

    setIsLoading(true);

    try {
      const { photo, ...memberData } = formData;
      await onSave({
        ...memberData,
        photo,
        gender: formData.gender as 'male' | 'female',
        ...(initialData ? { status: initialData.status } : { status: 'new' }),
        parents: parents.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          otherNames: p.otherNames,
          phone: p.phone,
          relationship: p.relationship,
          occupation: p.occupation,
          hometown: p.hometown,
          isLinked: p.isLinked || false,
          linkedMemberId: p.linkedMemberId || undefined,
          linkedChildMemberId: p.linkedChildMemberId || undefined
        })),
      } as Omit<ChildMember, 'id' | 'joinDate'> & { photo?: string });
    } catch (error) {
      console.error('Error saving child member:', error);
      alertAction({
        title: 'Unable to Save Child Record',
        description: 'An unexpected issue occurred while trying to save the child profile. Please check your network connection and try again.',
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Section header component
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
    <div className="space-y-4 pt-32 lg:pt-36 animate-fade-in">
      {/* Floating Progress Bar at Top */}
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

              {/* Progress bar track and fill */}
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

              {/* Required fields checklist */}
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

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{initialData ? 'Edit Child' : 'Add New Child'}</h1>
          <p className="text-muted-foreground">
            {initialData ? 'Update child member information' : 'Register a new child member'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload Section */}
        <Card>
          <Collapsible open={sectionsOpen.photo} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, photo: open }))}>
            <SectionHeader title="Profile Photo" icon={Upload} isOpen={sectionsOpen.photo} status={getSectionStatus('photo')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="space-y-2">
                    <Label>Photo (Optional)</Label>
                    <div className="flex items-center gap-4">
                      {photoPreview ? (
                        <div className="relative">
                          <img
                            src={photoPreview}
                            alt="Member preview"
                            className="w-20 h-20 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={removePhoto}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-2">
                        <input
                          type="file"
                          id="photo"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('photo')?.click()}
                        >
                          {photoPreview ? 'Change Photo' : 'Upload Photo'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Passport size photo recommended. Max 10MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Basic Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.basic} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, basic: open }))}>
            <SectionHeader title="Basic Information" icon={User} isOpen={sectionsOpen.basic} hasRequired status={getSectionStatus('basic')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Enter first name"
                      required
                      className={formData.firstName ? 'border-green-500 focus:border-green-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otherNames">Other Names</Label>
                    <Input
                      id="otherNames"
                      value={formData.otherNames}
                      onChange={(e) => handleInputChange('otherNames', e.target.value)}
                      placeholder="Middle names"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter last name"
                      required
                      className={formData.lastName ? 'border-green-500 focus:border-green-500' : ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(value: string) => handleInputChange('gender', value)}>
                      <SelectTrigger className={formData.gender ? 'border-green-500' : ''}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      required
                      className={ageError ? 'border-red-500 focus:border-red-500' : formData.dateOfBirth ? 'border-green-500 focus:border-green-500' : ''}
                    />
                    {ageError && <p className="text-sm text-red-500 mt-1">{ageError}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={formData.occupation}
                      onChange={(e) => handleInputChange('occupation', e.target.value)}
                      placeholder="e.g., Student"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hometown">Hometown</Label>
                    <Input
                      id="hometown"
                      value={formData.hometown}
                      onChange={(e) => handleInputChange('hometown', e.target.value)}
                      placeholder="e.g., Kumasi, Cape Coast"
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Contact Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.contact} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, contact: open }))}>
            <SectionHeader title="Contact Information" icon={Phone} isOpen={sectionsOpen.contact} status={getSectionStatus('contact')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+233 24 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondPhone">Second Phone</Label>
                    <Input
                      id="secondPhone"
                      type="tel"
                      value={formData.secondPhone}
                      onChange={(e) => handleInputChange('secondPhone', e.target.value)}
                      placeholder="+233 55 987 6543"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address (optional)"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Location Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.location} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, location: open }))}>
            <SectionHeader title="Location Information" icon={MapPin} isOpen={sectionsOpen.location} hasRequired status={getSectionStatus('location')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="residenceLocation">Residence Location *</Label>
                  <Input
                    id="residenceLocation"
                    value={formData.residenceLocation}
                    onChange={(e) => handleInputChange('residenceLocation', e.target.value)}
                    placeholder="Enter specific residence location"
                    required
                    className={formData.residenceLocation ? 'border-green-500 focus:border-green-500' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="digitalAddress">Digital Address</Label>
                  <Input
                    id="digitalAddress"
                    value={formData.digitalAddress}
                    onChange={(e) => handleInputChange('digitalAddress', e.target.value)}
                    placeholder="e.g., GA-123-4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ghana Post GPS digital address
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Parents / Guardians Section */}
        <Card>
          <Collapsible open={sectionsOpen.parents} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, parents: open }))}>
            <SectionHeader title="Parents / Guardians" icon={Users} isOpen={sectionsOpen.parents} status={getSectionStatus('parents')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Add parents or guardians. (Optional)
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={addParent}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                {parents.length === 0 ? (
                  <div className="border-2 border-dashed border-muted-foreground/25 bg-muted/10 rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">
                      No parents or guardians added yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parents.map((parent, index) => (
                      <Card key={parent.id} className="bg-muted/30">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Label>Parent / Guardian {index + 1}</Label>
                                {parent.isLinked && (
                                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle className="w-3 h-3" />
                                    Linked Member
                                  </Badge>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeParent(parent.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <Label>Relationship *</Label>
                              <Select
                                value={parent.relationship}
                                onValueChange={(value: string) => updateParent(parent.id, 'relationship', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mother">Mother</SelectItem>
                                  <SelectItem value="father">Father</SelectItem>
                                  <SelectItem value="guardian">Guardian</SelectItem>
                                  <SelectItem value="sibling">Sibling</SelectItem>
                                  <SelectItem value="brother">Brother</SelectItem>
                                  <SelectItem value="sister">Sister</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {!parent.isLinked ? (
                              <div className="space-y-2">
                                <Label>Search Existing Member to Link</Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={parentSearchStates[parent.id]?.query || ''}
                                    onChange={(e) => searchExistingMembers(parent.id, e.target.value)}
                                    placeholder="Search by name or phone..."
                                  />
                                  <Button type="button" variant="outline" size="icon">
                                    <Search className="w-4 h-4" />
                                  </Button>
                                </div>
                                {(parentSearchStates[parent.id]?.results || []).length > 0 && (
                                  <div className="border rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto bg-background shadow-md">
                                    {parentSearchStates[parent.id].results.map((result: any) => (
                                      <div
                                        key={result.id}
                                        className="p-3 hover:bg-muted rounded cursor-pointer transition-colors"
                                        onClick={() => linkParentToExisting(parent.id, result)}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="font-medium">{result.firstName} {result.lastName}</div>
                                          <Badge variant="outline" className="text-[10px]">
                                            {result._pool === 'child' ? 'Child Member' : 'Main Member'}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground">{result.phone || 'No phone'}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="pt-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => unlinkParent(parent.id)}
                                >
                                  Unlink Member
                                </Button>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>First Name *</Label>
                                <Input
                                  value={parent.firstName}
                                  onChange={(e) => updateParent(parent.id, 'firstName', e.target.value)}
                                  placeholder="Parent's first name"
                                  disabled={parent.isLinked}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Other Names</Label>
                                <Input
                                  value={parent.otherNames}
                                  onChange={(e) => updateParent(parent.id, 'otherNames', e.target.value)}
                                  placeholder="Other names"
                                  disabled={parent.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Last Name *</Label>
                                <Input
                                  value={parent.lastName}
                                  onChange={(e) => updateParent(parent.id, 'lastName', e.target.value)}
                                  placeholder="Parent's last name"
                                  disabled={parent.isLinked}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                  value={parent.phone}
                                  onChange={(e) => updateParent(parent.id, 'phone', e.target.value)}
                                  placeholder="+233 24 123 4567"
                                  disabled={parent.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Occupation</Label>
                                <Input
                                  value={parent.occupation}
                                  onChange={(e) => updateParent(parent.id, 'occupation', e.target.value)}
                                  placeholder="e.g., Teacher"
                                  disabled={parent.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hometown</Label>
                                <Input
                                  value={parent.hometown}
                                  onChange={(e) => updateParent(parent.id, 'hometown', e.target.value)}
                                  placeholder="e.g., Kumasi"
                                  disabled={parent.isLinked}
                                />
                              </div>
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

        {/* Additional Notes Section */}
        <Card>
          <Collapsible open={sectionsOpen.additional} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, additional: open }))}>
            <SectionHeader title="Additional Notes" icon={StickyNote} isOpen={sectionsOpen.additional} status={getSectionStatus('additional')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Any additional notes about the child..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <AlertDialog open={!!pendingRemovalId} onOpenChange={(open: boolean) => !open && setPendingRemovalId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Family Member</AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const p = parents.find(p => p.id === pendingRemovalId);
                  return `Removing ${p?.firstName || ''} ${p?.lastName || ''} will also remove you from their family list. Are you sure?`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingRemovalId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => {
                  if (pendingRemovalId) {
                    setParents(parents.filter(p => p.id !== pendingRemovalId));
                    setPendingRemovalId(null);
                  }
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 sticky bottom-0 bg-background pb-4">
          <Button type="submit" disabled={!isValid || isLoading || !!ageError} className="sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Child'}
          </Button>
          <Button type="button" variant="outline" onClick={onBack} className="sm:w-auto">
            Cancel
          </Button>
          {!isValid && (
            <p className="text-sm text-muted-foreground self-center">
              Complete all required fields to save
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
