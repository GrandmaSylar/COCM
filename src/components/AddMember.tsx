import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Save, Upload, X, Plus, Trash2, Search, CheckCircle, User, Phone, MapPin, Droplets, Users, FileText, StickyNote, ChevronDown, Check } from 'lucide-react';
import { Member, Zone, MemberStatus, ZONES, BaptismInfo, FamilyMember, LegalInfo, BaptismDateType, MINISTRIES } from './Members';
import { Visitor } from './Visitors';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { api } from '../services/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface AddMemberProps {
  onBack: () => void;
  onSave: (member: Omit<Member, 'id' | 'joinDate'>) => Promise<void>;
  visitorData?: Visitor; // Optional - for converting visitors to members
}

export function AddMember({ onBack, onSave, visitorData }: AddMemberProps) {
  const [formData, setFormData] = useState({
    firstName: visitorData?.firstName || '',
    lastName: visitorData?.lastName || '',
    otherNames: visitorData?.otherNames || '',
    email: visitorData?.email || '',
    phone: visitorData?.phone || '',
    secondPhone: visitorData?.secondPhone || '',
    gender: visitorData?.gender || ('' as 'male' | 'female' | ''),
    maritalStatus: '' as 'single' | 'married' | 'divorced' | 'widowed' | '',
    dateOfBirth: visitorData?.dateOfBirth || '',
    occupation: '',
    hometown: '',
    residenceLocation: visitorData?.residenceLocation || '',
    digitalAddress: '',
    zone: visitorData?.potentialZone || ('' as Zone | ''),
    zoneNumber: '',
    notes: visitorData ? `Converted from visitor. Original notes: ${visitorData.notes}` : '',
    photo: '' as string
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const isConvertingVisitor = !!visitorData;

  // Section open states
  const [sectionsOpen, setSectionsOpen] = useState({
    photo: true,
    basic: true,
    contact: false,
    location: false,
    baptism: false,
    family: false,
    legal: false,
    additional: false
  });

  // Baptism Info State
  const [baptismInfo, setBaptismInfo] = useState<BaptismInfo>({
    dateType: 'full',
    fullDate: '',
    month: '',
    year: '',
    previousCongregation: '',
    roleInPreviousCongregation: ''
  });

  // Family Info State
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  // Track search state per family member
  const [familySearchStates, setFamilySearchStates] = useState<Record<string, { query: string; results: Member[] }>>({});

  // Legal Info State
  const [legalInfo, setLegalInfo] = useState<LegalInfo>({
    ghanaCardNumber: '',
    ghanaCardExpiryDate: '',
    alternativeIdType: '',
    alternativeIdNumber: ''
  });

  // Ministries State
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);

  // State for existing zone numbers (for sequential numbering)
  const [existingZoneNumbers, setExistingZoneNumbers] = useState<Record<Zone, number[]>>({
    A: [], B: [], F: [], K: [], M: [], R: []
  });

  // Fetch existing members to get zone numbers
  useEffect(() => {
    const fetchZoneNumbers = async () => {
      try {
        const members = await api.members.getAll();
        const zoneNums: Record<Zone, number[]> = { A: [], B: [], F: [], K: [], M: [], R: [] };

        members.forEach((member: Member) => {
          if (member.zone && member.zoneNumber) {
            // Extract the number part from zone number (e.g., "A05" -> 5 or "A-05" -> 5)
            const numPart = parseInt(member.zoneNumber.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numPart) && zoneNums[member.zone as Zone]) {
              zoneNums[member.zone as Zone].push(numPart);
            }
          }
        });

        setExistingZoneNumbers(zoneNums);
      } catch (error) {
        console.error('Failed to fetch zone numbers:', error);
      }
    };

    fetchZoneNumbers();
  }, []);

  // Auto-generate zone number when zone is selected
  const generateZoneNumber = (zone: Zone) => {
    const existingNums = existingZoneNumbers[zone] || [];
    // Find the next available number (starts from 1)
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const nextNum = maxNum + 1;
    return `${zone}${nextNum.toString().padStart(2, '0')}`;
  };

  const [isLoading, setIsLoading] = useState(false);

  // Check if baptism date is filled based on dateType
  const isBaptismDateFilled = useMemo(() => {
    if (baptismInfo.dateType === 'full') {
      return !!baptismInfo.fullDate;
    } else if (baptismInfo.dateType === 'monthYear') {
      return !!baptismInfo.month && !!baptismInfo.year;
    } else if (baptismInfo.dateType === 'yearOnly') {
      return !!baptismInfo.year;
    }
    return false;
  }, [baptismInfo]);

  // Calculate progress based on required fields
  const progressData = useMemo(() => {
    const requiredFields = [
      { name: 'First Name', filled: !!formData.firstName.trim(), section: 'basic' },
      { name: 'Last Name', filled: !!formData.lastName.trim(), section: 'basic' },
      { name: 'Gender', filled: !!formData.gender, section: 'basic' },
      { name: 'Date of Birth', filled: !!formData.dateOfBirth, section: 'basic' },
      { name: 'Phone Number', filled: !!formData.phone.trim(), section: 'contact' },
      { name: 'Residence Location', filled: !!formData.residenceLocation.trim(), section: 'location' },
      { name: 'Zone', filled: !!formData.zone, section: 'location' },
      { name: 'Baptism Date', filled: isBaptismDateFilled, section: 'baptism' }
    ];

    const filledCount = requiredFields.filter(f => f.filled).length;
    const totalCount = requiredFields.length;
    const percentage = Math.round((filledCount / totalCount) * 100);

    return { requiredFields, filledCount, totalCount, percentage };
  }, [formData, isBaptismDateFilled]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gender || !formData.zone) return;

    setIsLoading(true);

    try {
      await onSave({
        ...formData,
        gender: formData.gender as 'male' | 'female',
        zone: formData.zone as Zone,
        maritalStatus: formData.maritalStatus || undefined,
        status: 'new' as MemberStatus, // Default status for new members - auto-evaluated after 4 Sundays
        baptismInfo,
        familyMembers,
        legalInfo,
        ministries: selectedMinistries
      });
    } catch (error) {
      console.error('Error saving member:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-generate zone number when zone is selected
      if (field === 'zone' && value) {
        updated.zoneNumber = generateZoneNumber(value as Zone);
      }

      return updated;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB.');
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

  // Family Members Functions
  const addFamilyMember = () => {
    const newMember: FamilyMember = {
      id: `temp-${Date.now()}`,
      relationship: 'sibling',
      firstName: '',
      lastName: '',
      otherNames: '',
      phone: '',
      occupation: '',
      hometown: '',
      isLinked: false
    };
    setFamilyMembers([...familyMembers, newMember]);
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(familyMembers.filter(m => m.id !== id));
  };

  const updateFamilyMember = (id: string, field: keyof FamilyMember, value: string) => {
    setFamilyMembers(familyMembers.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // Search for existing members (per family member)
  const searchExistingMembers = async (familyMemberId: string, query: string) => {
    // Update the query for this specific family member
    setFamilySearchStates(prev => ({
      ...prev,
      [familyMemberId]: { ...prev[familyMemberId], query, results: prev[familyMemberId]?.results || [] }
    }));

    if (query.length < 2) {
      setFamilySearchStates(prev => ({
        ...prev,
        [familyMemberId]: { query, results: [] }
      }));
      return;
    }

    try {
      const members = await api.members.getAll();
      const filtered = members.filter((m: Member) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        m.phone.includes(query)
      );
      setFamilySearchStates(prev => ({
        ...prev,
        [familyMemberId]: { query, results: filtered }
      }));
    } catch (error) {
      console.error('Failed to search members:', error);
      setFamilySearchStates(prev => ({
        ...prev,
        [familyMemberId]: { query, results: [] }
      }));
    }
  };

  const linkFamilyMemberToExisting = (familyMemberId: string, existingMember: Member) => {
    setFamilyMembers(familyMembers.map(m =>
      m.id === familyMemberId ? {
        ...m,
        firstName: existingMember.firstName,
        lastName: existingMember.lastName,
        otherNames: existingMember.otherNames || '',
        phone: existingMember.phone,
        occupation: existingMember.occupation || '',
        hometown: existingMember.hometown || '',
        isLinked: true,
        linkedMemberId: existingMember.id
      } : m
    ));
    // Clear search state for this family member
    setFamilySearchStates(prev => ({
      ...prev,
      [familyMemberId]: { query: '', results: [] }
    }));
  };

  const isValid = formData.firstName && formData.lastName && formData.phone &&
                  formData.gender && formData.dateOfBirth && formData.residenceLocation &&
                  formData.zone && isBaptismDateFilled;

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
            <div className="text-left">
              <h3 className="font-semibold">{title}</h3>
              {hasRequired && status.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {status.filled} of {status.total} required fields
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
    <div className="space-y-4 pt-32 lg:pt-36">
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
          <h1>Add New Member</h1>
          <p className="text-muted-foreground">
            Register a new church member
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
                          Passport size photo recommended. Max 5MB.
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <Select value={formData.maritalStatus} onValueChange={(value: string) => handleInputChange('maritalStatus', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
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
                      className={formData.dateOfBirth ? 'border-green-500 focus:border-green-500' : ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={formData.occupation}
                      onChange={(e) => handleInputChange('occupation', e.target.value)}
                      placeholder="e.g., Teacher, Engineer, Trader"
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
            <SectionHeader title="Contact Information" icon={Phone} isOpen={sectionsOpen.contact} hasRequired status={getSectionStatus('contact')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+233 24 123 4567"
                      required
                      className={formData.phone ? 'border-green-500 focus:border-green-500' : ''}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zone">Zone *</Label>
                    <Select value={formData.zone} onValueChange={(value: string) => handleInputChange('zone', value)}>
                      <SelectTrigger className={formData.zone ? 'border-green-500' : ''}>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ZONES).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            Zone {key} - {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zoneNumber">Zone Number</Label>
                    <Input
                      id="zoneNumber"
                      value={formData.zoneNumber}
                      onChange={(e) => handleInputChange('zoneNumber', e.target.value)}
                      placeholder="Auto-generated"
                      disabled
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Baptism Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.baptism} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, baptism: open }))}>
            <SectionHeader title="Baptism & Ministry" icon={Droplets} isOpen={sectionsOpen.baptism} hasRequired status={getSectionStatus('baptism')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label>Baptism Date Precision</Label>
                  <RadioGroup
                    value={baptismInfo.dateType}
                    onValueChange={(value: BaptismDateType) =>
                      setBaptismInfo({ ...baptismInfo, dateType: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="full-date" />
                      <Label htmlFor="full-date" className="font-normal">Full Date</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthYear" id="month-year" />
                      <Label htmlFor="month-year" className="font-normal">Month & Year Only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yearOnly" id="year-only" />
                      <Label htmlFor="year-only" className="font-normal">Year Only</Label>
                    </div>
                  </RadioGroup>
                </div>

                {baptismInfo.dateType === 'full' && (
                  <div className="space-y-2">
                    <Label htmlFor="baptismFullDate">Baptism Date</Label>
                    <Input
                      id="baptismFullDate"
                      type="date"
                      value={baptismInfo.fullDate}
                      onChange={(e) => setBaptismInfo({ ...baptismInfo, fullDate: e.target.value })}
                    />
                  </div>
                )}

                {baptismInfo.dateType === 'monthYear' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="baptismMonth">Month</Label>
                      <Select
                        value={baptismInfo.month}
                        onValueChange={(value: string) => setBaptismInfo({ ...baptismInfo, month: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                            <SelectItem key={month} value={String(idx + 1).padStart(2, '0')}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baptismYear">Year</Label>
                      <Input
                        id="baptismYear"
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        value={baptismInfo.year}
                        onChange={(e) => setBaptismInfo({ ...baptismInfo, year: e.target.value })}
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                )}

                {baptismInfo.dateType === 'yearOnly' && (
                  <div className="space-y-2">
                    <Label htmlFor="baptismYearOnly">Baptism Year</Label>
                    <Input
                      id="baptismYearOnly"
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={baptismInfo.year}
                      onChange={(e) => setBaptismInfo({ ...baptismInfo, year: e.target.value })}
                      placeholder="YYYY"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="previousCongregation">Previous Congregation</Label>
                  <Input
                    id="previousCongregation"
                    value={baptismInfo.previousCongregation}
                    onChange={(e) => setBaptismInfo({ ...baptismInfo, previousCongregation: e.target.value })}
                    placeholder="If member transferred from another congregation"
                  />
                  <p className="text-xs text-muted-foreground">
                    Fill only if the member is joining from another congregation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleInPreviousCongregation">Role/Ministry in Previous Congregation</Label>
                  <Input
                    id="roleInPreviousCongregation"
                    value={baptismInfo.roleInPreviousCongregation}
                    onChange={(e) => setBaptismInfo({ ...baptismInfo, roleInPreviousCongregation: e.target.value })}
                    placeholder="e.g., Deacon, Song Leader, Teacher"
                  />
                  <p className="text-xs text-muted-foreground">
                    Any leadership position or ministry held in previous congregation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assign Ministry</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select all ministries/groups this member will be part of
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                    {MINISTRIES.map((ministry) => (
                      <div key={ministry} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`ministry-${ministry}`}
                          checked={selectedMinistries.includes(ministry)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMinistries([...selectedMinistries, ministry]);
                            } else {
                              setSelectedMinistries(selectedMinistries.filter(m => m !== ministry));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label
                          htmlFor={`ministry-${ministry}`}
                          className="font-normal cursor-pointer"
                        >
                          {ministry}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedMinistries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedMinistries.map((ministry) => (
                        <Badge key={ministry} variant="secondary" className="gap-1">
                          {ministry}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => setSelectedMinistries(selectedMinistries.filter(m => m !== ministry))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Family Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.family} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, family: open }))}>
            <SectionHeader title="Family Information" icon={Users} isOpen={sectionsOpen.family} status={getSectionStatus('family')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Add family members such as mother, father, spouse, children, or siblings
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                {familyMembers.length === 0 ? (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">
                      No family members added yet. Click "Add" to add family information.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {familyMembers.map((member, index) => (
                      <Card key={member.id}>
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Label>Family Member {index + 1}</Label>
                                {member.isLinked && (
                                  <Badge variant="secondary" className="gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Linked Member
                                  </Badge>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFamilyMember(member.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <Label>Relationship *</Label>
                              <Select
                                value={member.relationship}
                                onValueChange={(value: string) => updateFamilyMember(member.id, 'relationship', value)}
                                disabled={member.isLinked}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mother">Mother</SelectItem>
                                  <SelectItem value="father">Father</SelectItem>
                                  <SelectItem value="spouse">Spouse</SelectItem>
                                  <SelectItem value="child">Child</SelectItem>
                                  <SelectItem value="sibling">Sibling</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {!member.isLinked && (
                              <div className="space-y-2">
                                <Label>Search Existing Member</Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={familySearchStates[member.id]?.query || ''}
                                    onChange={(e) => searchExistingMembers(member.id, e.target.value)}
                                    placeholder="Search by name or phone..."
                                  />
                                  <Button type="button" variant="outline" size="icon">
                                    <Search className="w-4 h-4" />
                                  </Button>
                                </div>
                                {(familySearchStates[member.id]?.results || []).length > 0 && (
                                  <div className="border rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                                    {familySearchStates[member.id].results.map(result => (
                                      <div
                                        key={result.id}
                                        className="p-2 hover:bg-muted rounded cursor-pointer"
                                        onClick={() => linkFamilyMemberToExisting(member.id, result)}
                                      >
                                        <div>{result.firstName} {result.lastName}</div>
                                        <div className="text-xs text-muted-foreground">{result.phone}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>First Name *</Label>
                                <Input
                                  value={member.firstName}
                                  onChange={(e) => updateFamilyMember(member.id, 'firstName', e.target.value)}
                                  placeholder="First name"
                                  disabled={member.isLinked}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Other Names</Label>
                                <Input
                                  value={member.otherNames}
                                  onChange={(e) => updateFamilyMember(member.id, 'otherNames', e.target.value)}
                                  placeholder="Other names"
                                  disabled={member.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Last Name *</Label>
                                <Input
                                  value={member.lastName}
                                  onChange={(e) => updateFamilyMember(member.id, 'lastName', e.target.value)}
                                  placeholder="Last name"
                                  disabled={member.isLinked}
                                  required
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                  value={member.phone}
                                  onChange={(e) => updateFamilyMember(member.id, 'phone', e.target.value)}
                                  placeholder="+233 24 123 4567"
                                  disabled={member.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Occupation</Label>
                                <Input
                                  value={member.occupation || ''}
                                  onChange={(e) => updateFamilyMember(member.id, 'occupation', e.target.value)}
                                  placeholder="e.g., Teacher"
                                  disabled={member.isLinked}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hometown</Label>
                                <Input
                                  value={member.hometown || ''}
                                  onChange={(e) => updateFamilyMember(member.id, 'hometown', e.target.value)}
                                  placeholder="e.g., Kumasi"
                                  disabled={member.isLinked}
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

        {/* Legal Information Section */}
        <Card>
          <Collapsible open={sectionsOpen.legal} onOpenChange={(open: boolean) => setSectionsOpen(prev => ({ ...prev, legal: open }))}>
            <SectionHeader title="Legal Information" icon={FileText} isOpen={sectionsOpen.legal} status={getSectionStatus('legal')} />
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ghanaCardNumber">Ghana Card Number</Label>
                    <Input
                      id="ghanaCardNumber"
                      value={legalInfo.ghanaCardNumber}
                      onChange={(e) => setLegalInfo({ ...legalInfo, ghanaCardNumber: e.target.value })}
                      placeholder="GHA-XXXXXXXXX-X"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ghanaCardExpiry">Ghana Card Expiry Date</Label>
                    <Input
                      id="ghanaCardExpiry"
                      type="date"
                      value={legalInfo.ghanaCardExpiryDate}
                      onChange={(e) => setLegalInfo({ ...legalInfo, ghanaCardExpiryDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Alternative ID (if Ghana Card not available)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="altIdType">ID Type</Label>
                      <Select
                        value={legalInfo.alternativeIdType}
                        onValueChange={(value: string) => setLegalInfo({ ...legalInfo, alternativeIdType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="voters">Voter's ID</SelectItem>
                          <SelectItem value="drivers">Driver's License</SelectItem>
                          <SelectItem value="nhis">NHIS Card</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="altIdNumber">ID Number</Label>
                      <Input
                        id="altIdNumber"
                        value={legalInfo.alternativeIdNumber}
                        onChange={(e) => setLegalInfo({ ...legalInfo, alternativeIdNumber: e.target.value })}
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Additional Information Section */}
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
                    placeholder="Any additional notes about the member..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 sticky bottom-0 bg-background pb-4">
          <Button type="submit" disabled={!isValid || isLoading} className="sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Member'}
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

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
