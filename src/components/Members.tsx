import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Search, Plus, Phone, Mail, MapPin, Eye, Info, Users, UserPlus, ArrowUpDown, Download, RefreshCw, ChevronDown } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import { getFriendlyMessage } from '../utils/error-handler';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport } from '../utils/export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type Zone = 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
export type MemberStatus = 'new' | 'active' | 'semi-active' | 'inactive' | 'sabbatical' | 'blacklisted';

// Member status definitions
export const MEMBER_STATUS_DEFINITIONS = {
  new: 'Recently registered, awaiting 4 Sunday Main Service records for evaluation',
  active: 'Present in 3-4 of last 4 Sunday Main Services',
  'semi-active': 'Present in 1-2 of last 4 Sunday Main Services',
  inactive: 'Absent from all last 4 Sunday Main Services',
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
  // Sabbatical fields
  sabbaticalStartDate?: string;
  sabbaticalEndDate?: string;
  sabbaticalReason?: string;
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
  const [refreshing, setRefreshing] = useState(false);

  // Filter and sort state
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ministryFilter, setMinistryFilter] = useState<string>('all');
  const [birthMonthFilter, setBirthMonthFilter] = useState<string>('all');
  const [dateOfBirthFilter, setDateOfBirthFilter] = useState<string>('all');
  const [ageRangeFilter, setAgeRangeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'zone' | 'status' | 'joinDate' | 'baptismDate' | 'baptismYear'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Collapsible state
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Use cached data hook (Option A)
  const { data: cachedMembers, loading: cachedLoading, error: cachedError, refresh } = useCachedData<Member[]>(
    'members-list',
    () => api.members.getAll(),
    { duration: 5 * 60 * 1000 }
  );

  useEffect(() => {
    if (cachedMembers) setMembers(cachedMembers);
    if (cachedLoading !== undefined) setLoading(cachedLoading);
    if (cachedError) setError(getFriendlyMessage(cachedError));
  }, [cachedMembers, cachedLoading, cachedError]);

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

    // Ministry filter
    const matchesMinistry = ministryFilter === 'all' || (member.ministries && member.ministries.includes(ministryFilter));

    // Birth month filter
    let matchesBirthMonth = true;
    if (birthMonthFilter !== 'all') {
      const dob = new Date(member.dateOfBirth);
      const dobMonth = String(dob.getMonth() + 1).padStart(2, '0');
      matchesBirthMonth = dobMonth === birthMonthFilter;
    }

    // Date of birth filter (today's birthday)
    let matchesDateOfBirth = true;
    if (dateOfBirthFilter === 'today') {
      const dob = new Date(member.dateOfBirth);
      const today = new Date();
      matchesDateOfBirth = dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
    }

    // Age range filter
    let matchesAgeRange = true;
    if (ageRangeFilter !== 'all') {
      const dob = new Date(member.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      
      switch (ageRangeFilter) {
        case '18-25':
          matchesAgeRange = age >= 18 && age <= 25;
          break;
        case '26-35':
          matchesAgeRange = age >= 26 && age <= 35;
          break;
        case '36-45':
          matchesAgeRange = age >= 36 && age <= 45;
          break;
        case '46-55':
          matchesAgeRange = age >= 46 && age <= 55;
          break;
        case '56-65':
          matchesAgeRange = age >= 56 && age <= 65;
          break;
        case '65+':
          matchesAgeRange = age > 65;
          break;
      }
    }

    return matchesSearch && matchesZone && matchesStatus && matchesGender && matchesMinistry && matchesBirthMonth && matchesDateOfBirth && matchesAgeRange;
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
        const statusOrder = { new: 0, active: 1, 'semi-active': 2, inactive: 3, sabbatical: 4, blacklisted: 5 };
        comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        break;
      case 'joinDate':
        comparison = new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
        break;
      case 'baptismDate':
        const aDate = a.baptismInfo?.fullDate ? new Date(a.baptismInfo.fullDate).getTime() : 0;
        const bDate = b.baptismInfo?.fullDate ? new Date(b.baptismInfo.fullDate).getTime() : 0;
        comparison = bDate - aDate;
        break;
      case 'baptismYear':
        const aYear = a.baptismInfo?.year ? parseInt(a.baptismInfo.year) : 0;
        const bYear = b.baptismInfo?.year ? parseInt(b.baptismInfo.year) : 0;
        comparison = bYear - aYear;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const { user, canAccess } = useAuth();

  const canAddMembers = canAccess('manage_members');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

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
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Members</h1>
          <p className="text-muted-foreground">
            Manage your church members
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Refresh Button */}
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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

      {/* Member Status Info - Collapsible */}
      <Collapsible open={statusInfoOpen} onOpenChange={setStatusInfoOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Member Status Definitions
            </span>
            <ChevronDown
              className="h-4 w-4 transition-transform duration-300 ease-in-out"
              style={{ transform: statusInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Alert>
            <AlertDescription>
              <strong>New:</strong> Recently registered, awaiting 4 Sunday Main Service records<br />
              <strong>Active:</strong> Present in 3-4 of last 4 Sunday Main Services<br />
              <strong>Semi-Active:</strong> Present in 1-2 of last 4 Sunday Main Services<br />
              <strong>Inactive:</strong> Absent from all last 4 Sunday Main Services<br />
              <strong>Sabbatical:</strong> Absent for a long period but with permission<br />
              <strong>Blacklisted:</strong> Sacked or removed
            </AlertDescription>
          </Alert>
        </CollapsibleContent>
      </Collapsible>

      {/* Stats - Collapsible */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Member Statistics ({members.length} Total)
            </span>
            <ChevronDown
              className="h-4 w-4 transition-transform duration-300 ease-in-out"
              style={{ transform: statsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 stagger-children">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">{members.length}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {members.filter(m => m.status === 'new').length}
                  </div>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {members.filter(m => m.status === 'active').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {members.filter(m => m.status === 'semi-active').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Semi-Active</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {members.filter(m => m.status === 'inactive').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {members.filter(m => m.status === 'sabbatical').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Sabbatical</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

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

        {/* Filter and Sort Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Filter Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Search className="w-4 h-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="p-3 space-y-3">
                {/* Zone Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Zone</label>
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {Object.entries(ZONES).map(([code, name]) => (
                        <SelectItem key={code} value={code}>{code} - {name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="semi-active">Semi-Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="sabbatical">Sabbatical</SelectItem>
                      <SelectItem value="blacklisted">Blacklisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Gender</label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ministry Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Ministry</label>
                  <Select value={ministryFilter} onValueChange={setMinistryFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ministries</SelectItem>
                      {MINISTRIES.map(ministry => (
                        <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Birth Month Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Birth Month</label>
                  <Select value={birthMonthFilter} onValueChange={setBirthMonthFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      <SelectItem value="01">January</SelectItem>
                      <SelectItem value="02">February</SelectItem>
                      <SelectItem value="03">March</SelectItem>
                      <SelectItem value="04">April</SelectItem>
                      <SelectItem value="05">May</SelectItem>
                      <SelectItem value="06">June</SelectItem>
                      <SelectItem value="07">July</SelectItem>
                      <SelectItem value="08">August</SelectItem>
                      <SelectItem value="09">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date of Birth Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Date of Birth</label>
                  <Select value={dateOfBirthFilter} onValueChange={setDateOfBirthFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today's Birthday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Range Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Age Range</label>
                  <Select value={ageRangeFilter} onValueChange={setAgeRangeFilter}>
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ages</SelectItem>
                      <SelectItem value="18-25">18-25</SelectItem>
                      <SelectItem value="26-35">26-35</SelectItem>
                      <SelectItem value="36-45">36-45</SelectItem>
                      <SelectItem value="46-55">46-55</SelectItem>
                      <SelectItem value="56-65">56-65</SelectItem>
                      <SelectItem value="65+">65+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Sort By</div>
                
                <DropdownMenuItem 
                  onClick={() => { setSortBy('name'); setSortOrder('asc'); }}
                  className={sortBy === 'name' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('name'); setSortOrder('desc'); }}
                  className={sortBy === 'name' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Name (Z-A)
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => { setSortBy('zone'); setSortOrder('asc'); }}
                  className={sortBy === 'zone' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Zone (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('zone'); setSortOrder('desc'); }}
                  className={sortBy === 'zone' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Zone (Z-A)
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => { setSortBy('status'); setSortOrder('asc'); }}
                  className={sortBy === 'status' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Status (Active first)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('status'); setSortOrder('desc'); }}
                  className={sortBy === 'status' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Status (Inactive first)
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => { setSortBy('joinDate'); setSortOrder('desc'); }}
                  className={sortBy === 'joinDate' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Join Date (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('joinDate'); setSortOrder('asc'); }}
                  className={sortBy === 'joinDate' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Join Date (Oldest)
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => { setSortBy('baptismDate'); setSortOrder('desc'); }}
                  className={sortBy === 'baptismDate' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Baptism Date (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('baptismDate'); setSortOrder('asc'); }}
                  className={sortBy === 'baptismDate' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Baptism Date (Oldest)
                </DropdownMenuItem>

                <DropdownMenuItem 
                  onClick={() => { setSortBy('baptismYear'); setSortOrder('desc'); }}
                  className={sortBy === 'baptismYear' && sortOrder === 'desc' ? 'bg-accent' : ''}
                >
                  Baptism Year (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setSortBy('baptismYear'); setSortOrder('asc'); }}
                  className={sortBy === 'baptismYear' && sortOrder === 'asc' ? 'bg-accent' : ''}
                >
                  Baptism Year (Oldest)
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active Filters Summary */}
          {(zoneFilter !== 'all' || statusFilter !== 'all' || genderFilter !== 'all' || ministryFilter !== 'all' || birthMonthFilter !== 'all' || dateOfBirthFilter !== 'all' || ageRangeFilter !== 'all') && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Showing {filteredMembers.length} of {members.length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setZoneFilter('all');
                  setStatusFilter('all');
                  setGenderFilter('all');
                  setMinistryFilter('all');
                  setBirthMonthFilter('all');
                  setDateOfBirthFilter('all');
                  setAgeRangeFilter('all');
                }}
                className="h-6 text-xs"
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-4 stagger-children">
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
            <Card key={member.id} className="shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
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
                              member.status === 'new' ? 'bg-cyan-100 text-cyan-800' :
                              member.status === 'active' ? 'bg-green-100 text-green-800' :
                              member.status === 'semi-active' ? 'bg-blue-100 text-blue-800' :
                              member.status === 'sabbatical' ? 'bg-purple-100 text-purple-800' :
                              member.status === 'blacklisted' ? 'bg-red-100 text-red-800' : ''
                            }
                          >
                            {member.status === 'sabbatical' && member.sabbaticalEndDate && new Date(member.sabbaticalEndDate) < new Date() ? 'Sabbatical (Ended)' : member.status}
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

    </div>
  );
}