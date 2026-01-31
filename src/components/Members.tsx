import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Search, Plus, Phone, Mail, MapPin, Eye, Info, Users, UserPlus, ArrowUpDown, Download } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport } from '../utils/export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type Zone = 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
export type MemberStatus = 'active' | 'semi-active' | 'inactive' | 'sabbatical' | 'blacklisted';

// Member status definitions
export const MEMBER_STATUS_DEFINITIONS = {
  active: 'Mostly or always present on Sunday main services',
  'semi-active': 'Rarely present on Sunday Services (absent within less than a month)',
  inactive: 'Absent for more than a month without permission',
  sabbatical: 'Absent for a long period but with permission of absence',
  blacklisted: 'Sacked or removed'
} as const;

export type BaptismDateType = 'full' | 'monthYear' | 'yearOnly';

export interface BaptismInfo {
  dateType: BaptismDateType;
  fullDate?: string;
  month?: string;
  year?: string;
  previousCongregation?: string;
  roleInPreviousCongregation?: string;
}

export interface FamilyMember {
  id: string;
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  occupation?: string;
  hometown?: string;
  isLinked?: boolean;
  linkedMemberId?: string;
}

export interface LegalInfo {
  ghanaCardNumber?: string;
  ghanaCardExpiryDate?: string;
  alternativeIdType?: string;
  alternativeIdNumber?: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string;
  email?: string;
  phone: string;
  secondPhone?: string;
  gender: 'male' | 'female';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  dateOfBirth: string;
  occupation?: string;
  hometown?: string;
  residenceLocation: string;
  digitalAddress?: string;
  zone: Zone;
  zoneNumber: string; // e.g., "B23", "M15"
  notes: string;
  status: MemberStatus;
  joinDate: string;
  photo?: string; // Base64 encoded image or URL (maps to photo_url in database)
  baptismInfo?: BaptismInfo;
  familyMembers?: FamilyMember[]; // Computed from family_members table JOIN
  legalInfo?: LegalInfo;
  ministries?: string[]; // Member can be in multiple ministries
  // Audit fields
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export const ZONES = {
  A: 'Abossey Okai',
  B: 'Bubiashie', 
  F: 'Floating',
  K: 'Kasoa',
  M: 'Mataheko',
  R: 'Russia'
} as const;

export const MINISTRIES = [
  'Prayer Ministry',
  'Prophetic Ministry',
  'Visitation Ministry',
  'Welfare Ministry',
  'Evangelism Ministry',
  'Finance Ministry',
  'Health Ministry',
  'Youth Ministry',
  "Children's Ministry",
  'Marriage Ministry',
  'Worship Ministry',
  'Singing Ministry',
  'House-Keeping Ministry',
  'Security Ministry',
  'Education Ministry',
  'Ushering Ministry',
  'Men Fellowship',
  'Women Fellowship',
  'Project/Building Committee',
  'Scholarship Committee',
  'Business Support Fund Committee',
  'Zonal Leaders Committee',
  'Equipment & Machines',
  'Church Counsellors Committee'
] as const;

interface MembersProps {
  onAddMember: () => void;
  onViewMember: (member: Member) => void;
  onAddFromVisitor?: () => void;
}

export function Members({ onAddMember, onViewMember, onAddFromVisitor }: MembersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and sort state
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'zone' | 'status' | 'joinDate'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setError(null);
        const data = await api.members.getAll();
        setMembers(data || []);
      } catch (error) {
        console.error('Failed to fetch members:', error);
        setError('Failed to load members. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Apply filters
  let filteredMembers = members.filter(member => {
    // Text search
    const matchesSearch = searchTerm === '' ||
      `${member.firstName} ${member.lastName} ${member.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.includes(searchTerm) ||
      member.zoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ZONES[member.zone].toLowerCase().includes(searchTerm.toLowerCase());

    // Zone filter
    const matchesZone = zoneFilter === 'all' || member.zone === zoneFilter;

    // Status filter
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

    // Gender filter
    const matchesGender = genderFilter === 'all' || member.gender === genderFilter;

    return matchesSearch && matchesZone && matchesStatus && matchesGender;
  });

  // Apply sorting
  filteredMembers = [...filteredMembers].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case 'zone':
        comparison = a.zoneNumber.localeCompare(b.zoneNumber);
        break;
      case 'status':
        const statusOrder = { active: 0, 'semi-active': 1, inactive: 2, sabbatical: 3, blacklisted: 4 };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      case 'joinDate':
        comparison = new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const { user, canAccess } = useAuth();

  const canAddMembers = canAccess('manage_members');

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Search Skeleton */}
        <Skeleton className="h-10 w-full" />

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-16 mx-auto" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Member Cards Skeleton */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Export columns configuration
  const exportColumns = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'otherNames', label: 'Other Names' },
    { key: 'gender', label: 'Gender' },
    { key: 'phone', label: 'Phone' },
    { key: 'secondPhone', label: 'Second Phone' },
    { key: 'email', label: 'Email' },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'residenceLocation', label: 'Residence' },
    { key: 'digitalAddress', label: 'Digital Address' },
    { key: 'zone', label: 'Zone' },
    { key: 'zoneNumber', label: 'Zone Number' },
    { key: 'status', label: 'Status' },
    { key: 'joinDate', label: 'Join Date' },
    { key: 'maritalStatus', label: 'Marital Status' },
  ];

  const handleExportCSV = () => {
    const exportData = filteredMembers.map(m => ({
      ...m,
      dateOfBirth: formatDateForExport(m.dateOfBirth),
      joinDate: formatDateForExport(m.joinDate),
    }));
    exportToCSV(exportData, 'church_members', exportColumns);
  };

  const handleExportPDF = () => {
    const exportData = filteredMembers.map(m => ({
      ...m,
      dateOfBirth: formatDateForExport(m.dateOfBirth),
      joinDate: formatDateForExport(m.joinDate),
    }));
    exportToPDF(exportData, 'church_members', 'Church Members List', exportColumns);
  };

  const handleExportXLSX = () => {
    const exportData = filteredMembers.map(m => ({
      ...m,
      dateOfBirth: formatDateForExport(m.dateOfBirth),
      joinDate: formatDateForExport(m.joinDate),
    }));
    exportToXLSX(exportData, 'church_members', exportColumns);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Members</h1>
          <p className="text-muted-foreground">
            Manage your church members
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export Button */}
          {members.length > 0 && (
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
          {canAddMembers && (
            <>
              {onAddFromVisitor && (
                <Button variant="outline" onClick={onAddFromVisitor}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add from Visitor
                </Button>
              )}
              <Button onClick={onAddMember}>
                <Plus className="w-4 h-4 mr-2" />
                Add New Member
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Member Status Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Member Status Definitions:</strong><br />
          <strong>Active:</strong> Mostly or always present on Sunday main services<br />
          <strong>Semi-Active:</strong> Rarely present on Sunday Services (absent within less than a month)<br />
          <strong>Inactive:</strong> Absent for more than a month without permission<br />
          <strong>Sabbatical:</strong> Absent for a long period but with permission<br />
          <strong>Blacklisted:</strong> Sacked or removed
        </AlertDescription>
      </Alert>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members by name, zone, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {Object.entries(ZONES).map(([code, name]) => (
                <SelectItem key={code} value={code}>Zone {code} - {name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="semi-active">Semi-Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="sabbatical">Sabbatical</SelectItem>
              <SelectItem value="blacklisted">Blacklisted</SelectItem>
            </SelectContent>
          </Select>

          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>

          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [sort, order] = value.split('-') as [typeof sortBy, typeof sortOrder];
            setSortBy(sort);
            setSortOrder(order);
          }}>
            <SelectTrigger className="w-full sm:w-48">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="zone-asc">Zone (A-Z)</SelectItem>
              <SelectItem value="zone-desc">Zone (Z-A)</SelectItem>
              <SelectItem value="status-asc">Status (Active first)</SelectItem>
              <SelectItem value="status-desc">Status (Inactive first)</SelectItem>
              <SelectItem value="joinDate-desc">Join Date (Newest)</SelectItem>
              <SelectItem value="joinDate-asc">Join Date (Oldest)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filters summary */}
        {(zoneFilter !== 'all' || statusFilter !== 'all' || genderFilter !== 'all' || searchTerm) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredMembers.length} of {members.length} members</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setZoneFilter('all');
                setStatusFilter('all');
                setGenderFilter('all');
              }}
              className="h-6 text-xs"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{members.length}</div>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {members.filter(m => m.status === 'active').length}
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {members.filter(m => m.status === 'semi-active').length}
              </div>
              <p className="text-sm text-muted-foreground">Semi-Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {members.filter(m => m.status === 'inactive').length}
              </div>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {members.filter(m => m.status === 'sabbatical').length}
              </div>
              <p className="text-sm text-muted-foreground">Sabbatical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        {members.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-2">No Members Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your church member database by adding your first member.
                </p>
                {canAddMembers && (
                  <Button onClick={onAddMember}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Member
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredMembers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No members found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {member.firstName[0]}{member.lastName[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {member.firstName} {member.otherNames} {member.lastName}
                        </h3>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {member.zoneNumber} - Zone {member.zone}
                          </Badge>
                          <Badge
                            variant={member.status === 'active' ? 'default' : 'secondary'}
                            className={
                              member.status === 'active' ? 'bg-green-100 text-green-800' :
                              member.status === 'semi-active' ? 'bg-blue-100 text-blue-800' :
                              member.status === 'sabbatical' ? 'bg-purple-100 text-purple-800' :
                              member.status === 'blacklisted' ? 'bg-red-100 text-red-800' : ''
                            }
                          >
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {member.phone}
                        {member.secondPhone && <span className="text-xs">• {member.secondPhone}</span>}
                      </div>
                      {member.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {member.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {member.residenceLocation} ({ZONES[member.zone]})
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewMember(member)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Mobile Floating Action Button */}
      {canAddMembers && (
        <div className="lg:hidden fixed bottom-20 right-4">
          <Button
            onClick={onAddMember}
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