import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  Search, Plus, Phone, Mail, MapPin, Eye, Users, UserPlus,
  ArrowLeft, Calendar, Clock, UserCheck, RefreshCw, ChevronDown
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { Zone, ZONES } from './Members';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';

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
  // Conversion tracking
  convertedToMember?: boolean;
  convertedMemberId?: string;
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
      <div className="space-y-6">
        <div>
          <h1>Visitors</h1>
          <p className="text-muted-foreground">Loading visitors data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Visitors</h1>
          <p className="text-muted-foreground">
            Manage church visitors and potential members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canManageVisitors && (
            <Button onClick={onAddVisitor}>
              <Plus className="w-4 h-4 mr-2" />
              Add Visitor
            </Button>
          )}
        </div>
      </div>

      {/* Statistics - Collapsible */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Visitor Statistics ({totalVisitors} Total)
            </span>
            <ChevronDown
              className="h-4 w-4 transition-transform duration-300 ease-in-out"
              style={{ transform: statsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 stagger-children">
            <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-blue-500/50 via-blue-500/40 to-transparent border border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/50 hover:-translate-y-1">
              <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
                <Users className="w-16 h-16 text-blue-600" />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/40 flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{totalVisitors}</div>
                <div className="text-sm font-medium text-muted-foreground">Total Visitors</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500/50 via-emerald-500/40 to-transparent border border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1">
              <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
                <UserPlus className="w-16 h-16 text-emerald-600" />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/40 flex items-center justify-center mb-3 text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{interestedInMembership}</div>
                <div className="text-sm font-medium text-muted-foreground">Interested in Membership</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-500/50 via-amber-500/40 to-transparent border border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/50 hover:-translate-y-1">
              <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-30 transition-opacity">
                <Calendar className="w-16 h-16 text-amber-600" />
              </div>
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/40 flex items-center justify-center mb-3 text-amber-600 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-3xl font-bold tracking-tighter text-foreground mb-0.5 group-hover:translate-x-1 transition-transform">{thisMonthVisitors}</div>
                <div className="text-sm font-medium text-muted-foreground">This Month</div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search visitors by name, phone, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedMembershipInterest} onValueChange={setSelectedMembershipInterest}>
          <SelectTrigger className="w-full lg:max-w-xs lg:flex-shrink-0">
              <SelectValue placeholder="Membership interest" />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="not-interested">Not Interested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Visitors List */}
      <div className="space-y-4">
        {visitors.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-2">No Visitors Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start tracking church visitors and potential members.
                </p>
                {canManageVisitors && (
                  <Button onClick={onAddVisitor}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Visitor
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredVisitors.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No visitors found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredVisitors.map((visitor) => (
            <Card key={visitor.id} className="shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 icon-bg-pink rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {visitor.firstName[0]}{visitor.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {visitor.firstName} {visitor.otherNames} {visitor.lastName}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {visitor.interestedInMembership && (
                            <Badge variant="outline" className="badge-success">
                              <UserPlus className="w-3 h-3 mr-1" />
                              Interested in Membership
                            </Badge>
                          )}
                          {visitor.potentialZone && (
                            <Badge variant="outline">
                              Potential Zone {visitor.potentialZone}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {visitor.phone}
                        {visitor.secondPhone && <span className="text-xs">• {visitor.secondPhone}</span>}
                      </div>
                      {visitor.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {visitor.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {visitor.residenceLocation}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        Visited on {formatDate(visitor.visitDate)} ({visitor.serviceType})
                      </div>
                      {visitor.referredBy && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserCheck className="w-4 h-4" />
                          Referred by {visitor.referredBy}
                        </div>
                      )}
                    </div>

                    {visitor.notes && (
                      <div className="text-sm text-muted-foreground box-muted p-2 rounded">
                        <strong>Notes:</strong> {visitor.notes}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewVisitor(visitor)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {visitor.interestedInMembership && canManageVisitors && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onConvertToMember(visitor)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Convert
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
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
        setCustomServices((servicesData || []).filter((s: any) => s.isActive));
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
        gender: formData.gender || 'male', // Ensure valid gender
        potentialZone: formData.potentialZone || undefined,
        followUpStatus: 'pending' // Default value for database constraint
      } as Visitor);
      onSave({
        ...formData,
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
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
        setCustomServices((servicesData || []).filter((s: any) => s.isActive));
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
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
  );
}

// Visitor Profile Component
interface VisitorProfileProps {
  visitor: Visitor;
  onBack: () => void;
  onEdit: (visitor: Visitor) => void;
  onConvertToMember: (visitor: Visitor) => void;
}

export function VisitorProfile({ visitor, onBack, onEdit, onConvertToMember }: VisitorProfileProps) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1>Visitor Profile</h1>
          <p className="text-muted-foreground">
            View and manage visitor information
          </p>
        </div>
        {canManageVisitors && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(visitor)}>
              Edit
            </Button>
            {visitor.interestedInMembership && (
              <Button onClick={() => onConvertToMember(visitor)} className="bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Convert to Member
              </Button>
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
  );
}