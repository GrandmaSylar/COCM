import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState, Group, IconTile, LargeTitle, SearchField } from './ui/ios';
import { PullToRefresh, SwipeRow } from './ui/ios-gestures';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  Search, Plus, Phone, Mail, MapPin, Eye, Pencil, Users, UserPlus,
  ArrowLeft, Calendar, Clock, UserCheck, RefreshCw, ChevronDown, ChevronRight, CheckCircle
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { Zone, ZONES } from './Members';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import { OfflineOverlay } from './OfflineOverlay';

export interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string;
  email?: string;
  phone: string;
  secondPhone?: string;
  gender: 'male' | 'female';
  dateOfBirth?: string;
  residenceLocation: string;
  visitDate: string;
  serviceType: string;
  referredBy?: string;
  interestedInMembership: boolean;
  notes: string;
  potentialZone?: Zone;
  convertedToMember?: boolean;
  convertedMemberId?: string;
  church?: string;
  // Audit fields
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

interface VisitorsProps {
  onAddVisitor: () => void;
  onViewVisitor: (visitor: Visitor) => void;
  onConvertToMember: (visitor: Visitor) => void;
}

export function Visitors({ onAddVisitor, onViewVisitor, onConvertToMember }: VisitorsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembershipInterest, setSelectedMembershipInterest] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const { canAccess } = useAuth();
  const canManageVisitors = canAccess('manage_members'); // Same permission as managing members

  const { data: visitorsData, loading, refresh: refreshVisitors } = useCachedData<Visitor[]>(
    'visitors-list',
    () => api.visitors.getAll(),
    { duration: 3 * 60 * 1000 } // 3 minutes
  );
  const visitors = visitorsData || [];

  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch = `${visitor.firstName} ${visitor.lastName} ${visitor.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visitor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visitor.phone.includes(searchTerm) ||
                         visitor.residenceLocation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMembershipInterest = selectedMembershipInterest === 'all' ||
                                     (selectedMembershipInterest === 'interested' && visitor.interestedInMembership) ||
                                     (selectedMembershipInterest === 'not-interested' && !visitor.interestedInMembership);

    return matchesSearch && matchesMembershipInterest;
  });


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate statistics
  const totalVisitors = visitors.length;
  const interestedInMembership = visitors.filter(v => v.interestedInMembership).length;
  const thisMonthVisitors = visitors.filter(visitor => {
    const visitDate = new Date(visitor.visitDate);
    const now = new Date();
    return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
  }).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshVisitors();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <OfflineOverlay>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 rounded-xl" />
            <Skeleton className="h-4 w-56 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-full rounded-[10px]" />
          <div className="overflow-hidden rounded-xl bg-card">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </OfflineOverlay>
    );
  }

  const interestChips: [string, string][] = [['all', 'All'], ['interested', 'Interested'], ['not-interested', 'Not interested']];

  return (
    <OfflineOverlay>
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 relative">
      <LargeTitle
        title="Visitors"
        subtitle="Church visitors and potential members"
        actions={
          <>
            {canManageVisitors && (
              <Button onClick={onAddVisitor}>
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Visitor</span>
                <span className="sr-only sm:hidden">Add Visitor</span>
              </Button>
            )}
            <Button variant="soft" size="icon" aria-label="Refresh" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Users, tone: 'info' as const, value: totalVisitors, label: 'Visitors' },
          { icon: UserPlus, tone: 'success' as const, value: interestedInMembership, label: 'Interested' },
          { icon: Calendar, tone: 'warning' as const, value: thisMonthVisitors, label: 'This Month' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-3 sm:p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search name, phone, email or location" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {interestChips.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={selectedMembershipInterest === value}
            onClick={() => setSelectedMembershipInterest(value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] transition-colors active:opacity-70 ${selectedMembershipInterest === value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visitors.length === 0 ? (
        <Group>
          <EmptyState
            icon={Users}
            title="No Visitors Yet"
            description="Start tracking church visitors and potential members."
            action={canManageVisitors ? <Button onClick={onAddVisitor}><Plus className="w-4 h-4 mr-2" />Add First Visitor</Button> : undefined}
          />
        </Group>
      ) : filteredVisitors.length === 0 ? (
        <Group>
          <EmptyState icon={Search} title="No results" description="No visitors match your search or filter." />
        </Group>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {filteredVisitors.map((visitor) => {
            const canConvert = canManageVisitors && !visitor.convertedToMember;
            return (
              <SwipeRow
                key={visitor.id}
                className="last:[&_button]:after:hidden"
                actions={[
                  ...(canConvert ? [{ label: 'Convert', icon: UserPlus, tone: 'success' as const, onClick: () => onConvertToMember(visitor) }] : []),
                  { label: 'View', icon: Eye, tone: 'info' as const, onClick: () => onViewVisitor(visitor) },
                ]}
              >
                <div className={`flex items-stretch ${visitor.convertedToMember ? 'opacity-60' : ''}`}>
                  <button
                    type="button"
                    onClick={() => onViewVisitor(visitor)}
                    className="relative flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 active:bg-accent after:absolute after:bottom-0 after:left-[4.5rem] after:right-0 after:h-px after:bg-separator"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary-text">
                      {visitor.firstName[0]}{visitor.lastName[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] leading-snug lg:text-[15px]">
                        {visitor.firstName} {visitor.otherNames} {visitor.lastName}
                      </span>
                      <span className="block truncate text-[13px] text-muted-foreground">{visitor.phone} · {visitor.residenceLocation}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        Visited {formatDate(visitor.visitDate)} ({visitor.serviceType}){visitor.referredBy ? ` · Referred by ${visitor.referredBy}` : ''}
                      </span>
                      {(visitor.interestedInMembership && !visitor.convertedToMember) || visitor.convertedToMember || visitor.potentialZone ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {visitor.interestedInMembership && !visitor.convertedToMember && (
                            <Badge variant="secondary" className="border-0 bg-success-soft text-success-text">Interested</Badge>
                          )}
                          {visitor.convertedToMember && (
                            <Badge variant="secondary" className="border-0 bg-fill text-muted-foreground">
                              <UserCheck className="mr-1 size-3" />
                              Member
                            </Badge>
                          )}
                          {visitor.potentialZone && <Badge variant="secondary" className="border-0 bg-fill text-foreground">Zone {visitor.potentialZone}</Badge>}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                  </button>
                  {canConvert && (
                    <Button variant="soft" size="sm" className="mr-3 hidden self-center sm:inline-flex" onClick={() => onConvertToMember(visitor)}>
                      <UserPlus className="mr-1.5 size-4" />
                      Convert
                    </Button>
                  )}
                </div>
              </SwipeRow>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
    </OfflineOverlay>
  );
}

// Add Visitor Component
interface AddVisitorProps {
  onBack: () => void;
  onSave: (visitor: Omit<Visitor, 'id'>) => void;
}

export function AddVisitor({ onBack, onSave }: AddVisitorProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    otherNames: '',
    email: '',
    phone: '',
    secondPhone: '',
    gender: '' as 'male' | 'female' | '',
    residenceLocation: '',
    visitDate: new Date().toISOString().split('T')[0],
    serviceType: 'Sunday Main Service',
    referredBy: '',
    church: '',
    interestedInMembership: false,
    notes: '',
    potentialZone: '' as Zone | ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [customServices, setCustomServices] = useState<any[]>([]);
  const [referrerSearchQuery, setReferrerSearchQuery] = useState('');
  const [showReferrerSuggestions, setShowReferrerSuggestions] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersData, servicesData] = await Promise.all([
          api.members.getAll(),
          api.services.getAll()
        ]);
        setMembers(membersData || []);
        setCustomServices((servicesData || []).filter((s: any) => s.isActive && s.name !== 'Sunday Main Service'));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(referrerSearchQuery.toLowerCase())
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.residenceLocation) {
      return;
    }

    setIsLoading(true);

    try {
      await api.visitors.create({
        ...formData,
        gender: (formData.gender || 'male') as Visitor['gender'], // Ensure valid gender
        potentialZone: formData.potentialZone || undefined,
        followUpStatus: 'pending' // Default value for database constraint
      } as Omit<Visitor, 'id'>);
      
      onSave({
        ...formData,
        gender: (formData.gender || 'male') as Visitor['gender'],
        potentialZone: formData.potentialZone || undefined
      });
    } catch (error) {
      console.error('Failed to create visitor:', error);
      setIsLoading(false);
    }
  };

  const isValid = formData.firstName && formData.lastName && formData.phone && formData.residenceLocation;
  const zones = Object.keys(ZONES) as Array<keyof typeof ZONES>;

  return (
    <OfflineOverlay>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Add Visitor</h1>
          <p className="text-muted-foreground">
            Record details of a new church visitor
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visitor Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otherNames">Other Names</Label>
                  <Input
                    id="otherNames"
                    value={formData.otherNames}
                    onChange={(e) => setFormData(prev => ({ ...prev, otherNames: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value: 'male' | 'female') => setFormData(prev => ({ ...prev, gender: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+233 XX XXX XXXX"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondPhone">Second Phone</Label>
                  <Input
                    id="secondPhone"
                    value={formData.secondPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondPhone: e.target.value }))}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residenceLocation">Residence Location *</Label>
                  <Input
                    id="residenceLocation"
                    value={formData.residenceLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, residenceLocation: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Visit Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Visit Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitDate">Visit Date</Label>
                  <Input
                    id="visitDate"
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, visitDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select value={formData.serviceType} onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                      {customServices.map((service) => (
                        <SelectItem key={service.id} value={service.name}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="referredBy">Referred By (Member)</Label>
                  <Input
                    id="referredBy"
                    value={referrerSearchQuery || formData.referredBy}
                    onChange={(e) => {
                      setReferrerSearchQuery(e.target.value);
                      setFormData(prev => ({ ...prev, referredBy: e.target.value }));
                      setShowReferrerSuggestions(true);
                    }}
                    onFocus={() => setShowReferrerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowReferrerSuggestions(false), 200)}
                    placeholder="Search member name..."
                  />
                  {showReferrerSuggestions && referrerSearchQuery && filteredMembers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-sm max-h-40 overflow-y-auto">
                      {filteredMembers.map(member => (
                        <div
                          key={member.id}
                          className="p-2 hover:bg-muted cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur from firing
                            const fullName = `${member.firstName} ${member.lastName}`;
                            setFormData(prev => ({ ...prev, referredBy: fullName }));
                            setReferrerSearchQuery(fullName);
                            setShowReferrerSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{member.firstName} {member.lastName}</div>
                          <div className="text-xs text-muted-foreground">{member.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="church" className="flex items-center gap-2">Church / Congregation <Badge variant="outline" className="text-[10px] font-normal border-none bg-muted/50">Optional</Badge></Label>
                  <Input
                    id="church"
                    value={formData.church}
                    onChange={(e) => setFormData(prev => ({ ...prev, church: e.target.value }))}
                    placeholder="Previous or current church"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="potentialZone">Potential Zone Assignment</Label>
                  <Select value={formData.potentialZone} onValueChange={(value: Zone) => setFormData(prev => ({ ...prev, potentialZone: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select potential zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          Zone {zone} - {ZONES[zone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="interestedInMembership"
                    checked={formData.interestedInMembership}
                    onChange={(e) => setFormData(prev => ({ ...prev, interestedInMembership: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="interestedInMembership">Interested in Membership</Label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about the visitor..."
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || isLoading}>
                {isLoading ? 'Saving...' : 'Save Visitor'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </OfflineOverlay>
  );
}

// Edit Visitor Component
interface EditVisitorProps {
  visitor: Visitor;
  onBack: () => void;
  onSave: (visitor: Visitor) => void;
}

export function EditVisitor({ visitor, onBack, onSave }: EditVisitorProps) {
  const [formData, setFormData] = useState({
    firstName: visitor.firstName,
    lastName: visitor.lastName,
    otherNames: visitor.otherNames || '',
    email: visitor.email || '',
    phone: visitor.phone,
    secondPhone: visitor.secondPhone || '',
    gender: visitor.gender || '' as 'male' | 'female' | '',
    residenceLocation: visitor.residenceLocation,
    visitDate: visitor.visitDate,
    serviceType: visitor.serviceType,
    referredBy: visitor.referredBy || '',
    church: visitor.church || '',
    interestedInMembership: visitor.interestedInMembership,
    notes: visitor.notes || '',
    potentialZone: visitor.potentialZone || '' as Zone | ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [customServices, setCustomServices] = useState<any[]>([]);
  const [referrerSearchQuery, setReferrerSearchQuery] = useState(visitor.referredBy || '');
  const [showReferrerSuggestions, setShowReferrerSuggestions] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersData, servicesData] = await Promise.all([
          api.members.getAll(),
          api.services.getAll()
        ]);
        setMembers(membersData || []);
        setCustomServices((servicesData || []).filter((s: any) => s.isActive && s.name !== 'Sunday Main Service'));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(referrerSearchQuery.toLowerCase())
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.residenceLocation) {
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        id: visitor.id,
        ...formData,
        potentialZone: formData.potentialZone || undefined
      };
      delete payload.dateOfBirth;

      onSave(payload as Visitor);
    } catch (error) {
      console.error('Failed to update visitor:', error);
      setIsLoading(false);
    }
  };

  const isValid = formData.firstName && formData.lastName && formData.phone && formData.residenceLocation;
  const zones = Object.keys(ZONES) as Array<keyof typeof ZONES>;

  return (
    <OfflineOverlay>
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Edit Visitor</h1>
          <p className="text-muted-foreground">
            Update visitor information
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visitor Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First Name *</Label>
                  <Input
                    id="edit-firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-otherNames">Other Names</Label>
                  <Input
                    id="edit-otherNames"
                    value={formData.otherNames}
                    onChange={(e) => setFormData(prev => ({ ...prev, otherNames: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last Name *</Label>
                  <Input
                    id="edit-lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value: 'male' | 'female') => setFormData(prev => ({ ...prev, gender: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone Number *</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+233 XX XXX XXXX"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-secondPhone">Second Phone</Label>
                  <Input
                    id="edit-secondPhone"
                    value={formData.secondPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondPhone: e.target.value }))}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email Address</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-residenceLocation">Residence Location *</Label>
                  <Input
                    id="edit-residenceLocation"
                    value={formData.residenceLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, residenceLocation: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Visit Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Visit Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-visitDate">Visit Date</Label>
                  <Input
                    id="edit-visitDate"
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, visitDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-serviceType">Service Type</Label>
                  <Select value={formData.serviceType} onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                      {customServices.map((service) => (
                        <SelectItem key={service.id} value={service.name}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="edit-referredBy">Referred By (Member)</Label>
                  <Input
                    id="edit-referredBy"
                    value={referrerSearchQuery || formData.referredBy}
                    onChange={(e) => {
                      setReferrerSearchQuery(e.target.value);
                      setFormData(prev => ({ ...prev, referredBy: e.target.value }));
                      setShowReferrerSuggestions(true);
                    }}
                    onFocus={() => setShowReferrerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowReferrerSuggestions(false), 200)}
                    placeholder="Search member name..."
                  />
                  {showReferrerSuggestions && referrerSearchQuery && filteredMembers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-sm max-h-40 overflow-y-auto">
                      {filteredMembers.map(member => (
                        <div
                          key={member.id}
                          className="p-2 hover:bg-muted cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const fullName = `${member.firstName} ${member.lastName}`;
                            setFormData(prev => ({ ...prev, referredBy: fullName }));
                            setReferrerSearchQuery(fullName);
                            setShowReferrerSuggestions(false);
                          }}
                        >
                          <div className="font-medium">{member.firstName} {member.lastName}</div>
                          <div className="text-xs text-muted-foreground">{member.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-church" className="flex items-center gap-2">Church / Congregation <Badge variant="outline" className="text-[10px] font-normal border-none bg-muted/50">Optional</Badge></Label>
                  <Input
                    id="edit-church"
                    value={formData.church}
                    onChange={(e) => setFormData(prev => ({ ...prev, church: e.target.value }))}
                    placeholder="Previous or current church"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-potentialZone">Potential Zone Assignment</Label>
                  <Select value={formData.potentialZone} onValueChange={(value: Zone) => setFormData(prev => ({ ...prev, potentialZone: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select potential zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          Zone {zone} - {ZONES[zone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="edit-interestedInMembership"
                    checked={formData.interestedInMembership}
                    onChange={(e) => setFormData(prev => ({ ...prev, interestedInMembership: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="edit-interestedInMembership">Interested in Membership</Label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about the visitor..."
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || isLoading}>
                {isLoading ? 'Saving...' : 'Update Visitor'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </OfflineOverlay>
  );
}

// Visitor Profile Component
interface VisitorProfileProps {
  visitor: Visitor;
  onBack: () => void;
  onEdit: (visitor: Visitor) => void;
  onConvertToMember: (visitor: Visitor) => void;
  onViewMember: (memberId: string) => void;
}

export function VisitorProfile({ visitor, onBack, onEdit, onConvertToMember, onViewMember }: VisitorProfileProps) {
  const { canAccess } = useAuth();
  const canManageVisitors = canAccess('manage_members');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


  return (
    <OfflineOverlay>
    <div className="space-y-6">
      {/* Enhanced Header - Improved Mobile Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Visitor Profile</h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground line-clamp-1">
              View and manage visitor information
            </p>
          </div>
        </div>
        
        {canManageVisitors && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onEdit(visitor)} className="flex-1 sm:flex-none h-9 sm:h-10">
              <Pencil className="w-4 h-4 mr-2 hidden sm:inline-block" />
              Edit
            </Button>
            {visitor.convertedToMember ? (
              <Button 
                onClick={() => visitor.convertedMemberId && onViewMember(visitor.convertedMemberId)} 
                variant="outline"
                className="flex-1 sm:flex-none h-9 sm:h-10 border-primary text-primary hover:bg-primary/5"
                disabled={!visitor.convertedMemberId}
              >
                {visitor.convertedMemberId ? <Eye className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {visitor.convertedMemberId ? "View Member" : "Converted"}
              </Button>
            ) : (
              visitor.interestedInMembership && (
                <Button 
                  onClick={() => onConvertToMember(visitor)} 
                  className="flex-1 sm:flex-none h-9 sm:h-10 bg-success hover:bg-success shadow-sm"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  <span className="whitespace-nowrap">Convert to Member</span>
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {/* Visitor Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 icon-bg-pink rounded-full flex items-center justify-center">
              <span className="text-lg font-medium">
                {visitor.firstName[0]}{visitor.lastName[0]}
              </span>
            </div>
            <div>
              <div className="text-xl font-medium">
                {visitor.firstName} {visitor.otherNames} {visitor.lastName}
              </div>
              {visitor.interestedInMembership && (
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="badge-success">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Interested in Membership
                  </Badge>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="font-medium mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Gender</Label>
                <p className="text-sm">{visitor.gender ? visitor.gender.charAt(0).toUpperCase() + visitor.gender.slice(1) : 'Not specified'}</p>
              </div>
              {visitor.dateOfBirth && (
                <div>
                  <Label>Date of Birth</Label>
                  <p className="text-sm">{formatDate(visitor.dateOfBirth)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="font-medium mb-3">Contact Information</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{visitor.phone}</span>
                {visitor.secondPhone && <span className="text-sm text-muted-foreground">• {visitor.secondPhone}</span>}
              </div>
              {visitor.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{visitor.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{visitor.residenceLocation}</span>
              </div>
            </div>
          </div>

          {/* Visit Information */}
          <div>
            <h3 className="font-medium mb-3">Visit Information</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Visited on {formatDate(visitor.visitDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{visitor.serviceType}</span>
              </div>
              {visitor.referredBy && (
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Referred by {visitor.referredBy}</span>
                </div>
              )}
              {visitor.church && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Church: {visitor.church}</span>
                </div>
              )}
              {visitor.potentialZone && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Potential Zone: {visitor.potentialZone} - {ZONES[visitor.potentialZone]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {visitor.notes && (
            <div>
              <h3 className="font-medium mb-3">Notes</h3>
              <div className="text-sm bg-muted/50 p-3 rounded">
                {visitor.notes}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </OfflineOverlay>
  );
}