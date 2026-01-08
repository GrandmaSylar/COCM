import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import {
  Search, Plus, Phone, Mail, MapPin, Eye, Users, UserPlus,
  ArrowLeft, Calendar, Clock, UserCheck
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { Zone, ZONES } from './Members';
import { api } from '../services/api';

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
  followUpStatus: 'pending' | 'contacted' | 'scheduled' | 'completed';
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
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMembershipInterest, setSelectedMembershipInterest] = useState('all');
  const [loading, setLoading] = useState(true);

  const { canAccess } = useAuth();
  const canManageVisitors = canAccess('manage_members'); // Same permission as managing members

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const visitorsData = await api.visitors.getAll();
        setVisitors(visitorsData || []);
      } catch (error) {
        console.error('Failed to fetch visitors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitors();
  }, []);

  const filteredVisitors = visitors.filter(visitor => {
    const matchesSearch = `${visitor.firstName} ${visitor.lastName} ${visitor.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visitor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         visitor.phone.includes(searchTerm) ||
                         visitor.residenceLocation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || visitor.followUpStatus === selectedStatus;
    const matchesMembershipInterest = selectedMembershipInterest === 'all' || 
                                     (selectedMembershipInterest === 'interested' && visitor.interestedInMembership) ||
                                     (selectedMembershipInterest === 'not-interested' && !visitor.interestedInMembership);
    
    return matchesSearch && matchesStatus && matchesMembershipInterest;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'contacted': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
  const pendingFollowUp = visitors.filter(v => v.followUpStatus === 'pending').length;
  const thisMonthVisitors = visitors.filter(visitor => {
    const visitDate = new Date(visitor.visitDate);
    const now = new Date();
    return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
  }).length;

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Visitors</h1>
          <p className="text-muted-foreground">
            Manage church visitors and potential members
          </p>
        </div>
        {canManageVisitors && (
          <Button onClick={onAddVisitor}>
            <Plus className="w-4 h-4 mr-2" />
            Add Visitor
          </Button>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalVisitors}</div>
              <p className="text-sm text-muted-foreground">Total Visitors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{interestedInMembership}</div>
              <p className="text-sm text-muted-foreground">Interested in Membership</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingFollowUp}</div>
              <p className="text-sm text-muted-foreground">Pending Follow-up</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{thisMonthVisitors}</div>
              <p className="text-sm text-muted-foreground">This Month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search visitors by name, phone, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedMembershipInterest} onValueChange={setSelectedMembershipInterest}>
          <SelectTrigger className="w-full lg:w-48">
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
                  Start tracking church visitors and follow up with potential members.
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
            <Card key={visitor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {visitor.firstName[0]}{visitor.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {visitor.firstName} {visitor.otherNames} {visitor.lastName}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge className={getStatusColor(visitor.followUpStatus)}>
                            {visitor.followUpStatus}
                          </Badge>
                          {visitor.interestedInMembership && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
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
                      <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
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

      {/* Mobile Floating Action Button */}
      {canManageVisitors && (
        <div className="lg:hidden fixed bottom-20 right-4">
          <Button
            onClick={onAddVisitor}
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
    dateOfBirth: '',
    residenceLocation: '',
    visitDate: new Date().toISOString().split('T')[0],
    serviceType: 'Sunday Main Service',
    referredBy: '',
    interestedInMembership: false,
    notes: '',
    followUpStatus: 'pending' as const,
    potentialZone: '' as Zone | ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.residenceLocation) {
      return;
    }

    setIsLoading(true);

    try {
      await api.visitors.create({
        ...formData,
        potentialZone: formData.potentialZone || undefined
      });
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referredBy">Referred By</Label>
                  <Input
                    id="referredBy"
                    value={formData.referredBy}
                    onChange={(e) => setFormData(prev => ({ ...prev, referredBy: e.target.value }))}
                    placeholder="Name of member who referred them"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'contacted': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
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
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-primary">
                {visitor.firstName[0]}{visitor.lastName[0]}
              </span>
            </div>
            <div>
              <div className="text-xl font-medium">
                {visitor.firstName} {visitor.otherNames} {visitor.lastName}
              </div>
              <div className="flex gap-2 mt-1">
                <Badge className={getStatusColor(visitor.followUpStatus)}>
                  {visitor.followUpStatus}
                </Badge>
                {visitor.interestedInMembership && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Interested in Membership
                  </Badge>
                )}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="font-medium mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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