import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Save, Upload, X, Plus, Trash2, Search, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Member, Zone, MemberStatus, ZONES, BaptismInfo, FamilyMember, LegalInfo, BaptismDateType } from './Members';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { api } from '../services/api';

interface EditMemberProps {
  member: Member;
  onBack: () => void;
  onSave: (member: Member) => Promise<void>;
}

export function EditMember({ member, onBack, onSave }: EditMemberProps) {
  const [formData, setFormData] = useState({
    firstName: member.firstName || '',
    lastName: member.lastName || '',
    otherNames: member.otherNames || '',
    email: member.email || '',
    phone: member.phone || '',
    secondPhone: member.secondPhone || '',
    gender: member.gender || ('' as 'male' | 'female' | ''),
    maritalStatus: member.maritalStatus || ('' as 'single' | 'married' | 'divorced' | 'widowed' | ''),
    dateOfBirth: member.dateOfBirth || '',
    occupation: member.occupation || '',
    hometown: member.hometown || '',
    residenceLocation: member.residenceLocation || '',
    digitalAddress: member.digitalAddress || '',
    zone: member.zone || ('' as Zone | ''),
    zoneNumber: member.zoneNumber || '',
    notes: member.notes || '',
    status: member.status || ('active' as MemberStatus),
    photo: member.photo || ('' as string)
  });
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(member.photo || null);

  // Sabbatical state deprecated

  // Baptism Info State
  const [baptismInfo, setBaptismInfo] = useState<BaptismInfo>(
    (member.baptismInfo && {
      ...member.baptismInfo,
      fullDate: member.baptismInfo.fullDate ?? '',
      month: member.baptismInfo.month ?? '',
      year: member.baptismInfo.year ?? '',
      previousCongregation: member.baptismInfo.previousCongregation ?? '',
      roleInPreviousCongregation: member.baptismInfo.roleInPreviousCongregation ?? ''
    }) || {
    dateType: 'full',
    fullDate: '',
    month: '',
    year: '',
    previousCongregation: '',
    roleInPreviousCongregation: ''
  });

  // Family Info State
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(
    (member.familyMembers || []).map(fm => ({ ...fm, otherNames: fm.otherNames ?? '', phone: fm.phone ?? '', occupation: fm.occupation ?? '', hometown: fm.hometown ?? '' }))
  );
  // Track search state per family member
  const [familySearchStates, setFamilySearchStates] = useState<Record<string, { query: string; results: Member[] }>>({});

  // Legal Info State
  const [legalInfo, setLegalInfo] = useState<LegalInfo>(
    (member.legalInfo && {
      ...member.legalInfo,
      ghanaCardNumber: member.legalInfo.ghanaCardNumber ?? '',
      ghanaCardExpiryDate: member.legalInfo.ghanaCardExpiryDate ?? '',
      alternativeIdType: member.legalInfo.alternativeIdType ?? '',
      alternativeIdNumber: member.legalInfo.alternativeIdNumber ?? ''
    }) || {
    ghanaCardNumber: '',
    ghanaCardExpiryDate: '',
    alternativeIdType: '',
    alternativeIdNumber: ''
  });

  // Ministries State
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>(member.ministries || []);

  // Position Held State
  const [selectedPositionHeld, setSelectedPositionHeld] = useState<string[]>(member.positionHeld || []);

  // Dropdown Options
  const [dropdownOptions, setDropdownOptions] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const fetchOptions = async () => {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const _options = await api.options.getAll();
      setDropdownOptions(_options);
    } catch (error: any) {
      console.error('Failed to fetch options:', error);
      setOptionsError(error.message || 'Failed to load options');
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const ministriesList = dropdownOptions
    .filter(o => o.category === 'ministries')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.label.localeCompare(b.label))
    .map(o => o.label);

  const positionHeldList = dropdownOptions
    .filter(o => o.category === 'position_held')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.label.localeCompare(b.label))
    .map(o => o.label);

  // Auto-generate zone number when zone is selected
  const generateZoneNumber = (zone: Zone) => {
    // In real app, this would check existing numbers and generate the next available
    const randomNum = Math.floor(Math.random() * 99) + 1;
    return `${zone}${randomNum.toString().padStart(2, '0')}`;
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gender || !formData.zone) return;

    setIsLoading(true);

    try {
      // Auto-evaluate status change upon baptism
      let finalStatus = formData.status as MemberStatus;
      if (
        member.status === 'not baptised' &&
        baptismInfo.dateType !== 'not_baptised' &&
        baptismInfo.dateType !== member.baptismInfo?.dateType
      ) {
        finalStatus = 'new';
      } else if (baptismInfo.dateType === 'not_baptised') {
        finalStatus = 'not baptised';
      }

      await onSave({
        ...member,
        ...formData,
        gender: formData.gender as 'male' | 'female',
        zone: formData.zone as Zone,
        maritalStatus: formData.maritalStatus || undefined,
        status: finalStatus,
        baptismInfo: baptismInfo.dateType === 'not_baptised' ? { dateType: 'not_baptised' } : baptismInfo,
        familyMembers,
        legalInfo,
        ministries: selectedMinistries,
        positionHeld: selectedPositionHeld
      });
      setIsLoading(false);
    } catch (error) {
      console.error('Error updating member:', error);
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Only suggest a zone number when zone changes if zone number is empty (user can always edit zone number)
      if (field === 'zone' && value && !prev.zoneNumber?.trim()) {
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
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB.');
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
      const [members, children] = await Promise.all([
        api.members.getAll(),
        api.children.members.getAll()
      ]);
      const allMembers = [...members, ...children];

      const filtered = allMembers.filter((m: any) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
        (m.phone && m.phone.includes(query))
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

  const linkFamilyMemberToExisting = (familyMemberId: string, existingMember: any) => {
    setFamilyMembers(familyMembers.map(m =>
      m.id === familyMemberId ? {
        ...m,
        firstName: existingMember.firstName,
        lastName: existingMember.lastName,
        otherNames: existingMember.otherNames || '',
        phone: existingMember.phone || '',
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
                  formData.zone && formData.zoneNumber?.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Edit Member</h1>
          <p className="text-muted-foreground">
            Update member information for {member.firstName} {member.lastName}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload */}
            <div className="space-y-4">
              <h3>Profile Photo</h3>
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
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3>Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                    required
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
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={(value: string) => handleInputChange('gender', value)}>
                  <SelectTrigger>
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

            {/* Member Status */}
            <div className="space-y-4">
              <h3>Member Status</h3>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value: string) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="semi-active">Semi-Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="traveled">Traveled</SelectItem>
                    <SelectItem value="schooling">Schooling</SelectItem>
                    <SelectItem value="not baptised">Not Baptised</SelectItem>
                    <SelectItem value="blacklisted">Blacklisted</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Status is auto-calculated based on last 4 Sunday Main Service attendances. Manual changes here will override until the next recalculation.
                </p>
              </div>

              {/* Removed sabbatical specific fields since it's replaced by sick, traveled, schooling natively handles via absence */}
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3>Contact Information</h3>
              
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
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3>Location Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="residenceLocation">Residence Location *</Label>
                <Input
                  id="residenceLocation"
                  value={formData.residenceLocation}
                  onChange={(e) => handleInputChange('residenceLocation', e.target.value)}
                  placeholder="Enter specific residence location"
                  required
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
                    <SelectTrigger>
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
                  <Label htmlFor="zoneNumber">Zone Number *</Label>
                  <Input
                    id="zoneNumber"
                    value={formData.zoneNumber}
                    onChange={(e) => handleInputChange('zoneNumber', e.target.value)}
                    placeholder="e.g., A01, M15"
                  />
                  <p className="text-xs text-muted-foreground">
                    Editable. Change Zone and leave this empty to auto-generate a number.
                  </p>
                </div>
              </div>
            </div>

            {/* Baptism Information */}
            <div className="space-y-4">
              <h3>Baptism Information</h3>
              
              <div className="space-y-4">
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
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="not_baptised" id="not-baptised" />
                      <Label htmlFor="not-baptised" className="font-normal">Not Baptised</Label>
                    </div>
                  </RadioGroup>
                </div>

                {baptismInfo.dateType === 'full' && (
                  <div className="space-y-2">
                    <Label htmlFor="baptismFullDate">Baptism Date</Label>
                    <Input
                      id="baptismFullDate"
                      type="date"
                      value={baptismInfo.fullDate || ''}
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
                        value={baptismInfo.year || ''}
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
                      value={baptismInfo.year || ''}
                      onChange={(e) => setBaptismInfo({ ...baptismInfo, year: e.target.value })}
                      placeholder="YYYY"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="previousCongregation">Previous Congregation</Label>
                  <Input
                    id="previousCongregation"
                    value={baptismInfo.previousCongregation || ''}
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
                    value={baptismInfo.roleInPreviousCongregation || ''}
                    onChange={(e) => setBaptismInfo({ ...baptismInfo, roleInPreviousCongregation: e.target.value })}
                    placeholder="e.g., Deacon, Song Leader, Teacher"
                  />
                  <p className="text-xs text-muted-foreground">
                    Any leadership position or ministry held in previous congregation
                  </p>
                </div>

                <div className="space-y-4">
                  {optionsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading options...</span>
                    </div>
                  ) : optionsError ? (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg flex flex-col items-center justify-center space-y-3 border border-red-200 dark:border-red-900/30">
                      <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">{optionsError}</span>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={fetchOptions} className="bg-white hover:bg-red-50 dark:bg-transparent dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40">
                        Retry Loading Options
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Assign Ministry</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Select all ministries/groups this member will be part of
                        </p>
                        {ministriesList.length === 0 ? (
                          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                            No ministries configured. Add them in Settings.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                            {ministriesList.map((ministry) => (
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
                                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
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
                        )}
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

                      <div className="space-y-2 pt-4 border-t">
                        <Label>Position Held</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Select any key leadership or volunteer positions held by this member
                        </p>
                        {positionHeldList.length === 0 ? (
                          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                            No positions configured. Add them in Settings.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                            {positionHeldList.map((pos) => (
                              <div key={pos} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`position-${pos}`}
                                  checked={selectedPositionHeld.includes(pos)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPositionHeld([...selectedPositionHeld, pos]);
                                    } else {
                                      setSelectedPositionHeld(selectedPositionHeld.filter(p => p !== pos));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
                                />
                                <Label 
                                  htmlFor={`position-${pos}`} 
                                  className="font-normal cursor-pointer"
                                >
                                  {pos}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedPositionHeld.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedPositionHeld.map((pos) => (
                              <Badge key={pos} variant="secondary" className="gap-1">
                                {pos}
                                <X 
                                  className="w-3 h-3 cursor-pointer" 
                                  onClick={() => setSelectedPositionHeld(selectedPositionHeld.filter(p => p !== pos))}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Family Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3>Family Information</h3>
                  <p className="text-sm text-muted-foreground">
                    Add at least 2 family members (mother, father, spouse, children, siblings)
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Family Member
                </Button>
              </div>

              {familyMembers.length === 0 ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">
                    No family members added yet. Click "Add Family Member" to begin.
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
                                value={member.firstName || ''}
                                onChange={(e) => updateFamilyMember(member.id, 'firstName', e.target.value)}
                                placeholder="First name"
                                disabled={member.isLinked}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Other Names</Label>
                              <Input
                                value={member.otherNames || ''}
                                onChange={(e) => updateFamilyMember(member.id, 'otherNames', e.target.value)}
                                placeholder="Other names"
                                disabled={member.isLinked}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Last Name *</Label>
                              <Input
                                value={member.lastName || ''}
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
                                value={member.phone || ''}
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
              
            </div>

            {/* Legal Information */}
            <div className="space-y-4">
              <h3>Legal Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ghanaCardNumber">Ghana Card Number</Label>
                    <Input
                      id="ghanaCardNumber"
                      value={legalInfo.ghanaCardNumber || ''}
                      onChange={(e) => setLegalInfo({ ...legalInfo, ghanaCardNumber: e.target.value })}
                      placeholder="GHA-XXXXXXXXX-X"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ghanaCardExpiry">Ghana Card Expiry Date</Label>
                    <Input
                      id="ghanaCardExpiry"
                      type="date"
                      value={legalInfo.ghanaCardExpiryDate || ''}
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
                        value={legalInfo.alternativeIdNumber || ''}
                        onChange={(e) => setLegalInfo({ ...legalInfo, alternativeIdNumber: e.target.value })}
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3>Additional Information</h3>
              
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
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={!isValid || isLoading} className="sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Update Member'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack} className="sm:w-auto">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
