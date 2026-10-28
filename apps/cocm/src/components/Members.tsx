import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { EmptyState, Group, LargeTitle, SearchField } from './ui/ios';
import { PullToRefresh, SwipeRow } from './ui/ios-gestures';
import { Search, Plus, Phone, Eye, Info, Users, UserPlus, ArrowUpDown, Download, RefreshCw, ChevronDown, ChevronRight, MoreHorizontal, SlidersHorizontal, WifiOff } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getFriendlyMessage } from '../utils/error-handler';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport } from '../utils/export';
import { getCloudinaryUrl } from '../utils/cloudinary';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type Zone = 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
export type MemberStatus = 'new' | 'active' | 'semi-active' | 'inactive' | 'sick' | 'traveled' | 'schooling' | 'not baptised' | 'blacklisted';

// Member status definitions
export const MEMBER_STATUS_DEFINITIONS = {
  new: 'Recently registered, awaiting 4 Sunday Main Service records for evaluation',
  active: 'Present in 3-4 of last 4 Sunday Main Services',
  'semi-active': 'Present in 1-2 of last 4 Sunday Main Services',
  inactive: 'Absent from all last 4 Sunday Main Services',
  sick: 'Absent for a long period due to verified illness',
  traveled: 'Absent for a long period due to travel/relocation with notification',
  schooling: 'Absent for a long period due directly to educational reasons',
  'not baptised': 'Member has not undergone water baptism. Excluded from normal status calculations',
  blacklisted: 'Sacked or removed'
} as const;

export type BaptismDateType = 'full' | 'monthYear' | 'yearOnly' | 'forgotten';
export type BaptismStatus = 'baptised' | 'not_baptised';

export interface BaptismInfo {
  baptismStatus: BaptismStatus;
  dateType?: BaptismDateType;
  fullDate?: string;
  month?: string;
  year?: string;
  previousCongregation?: string;
  roleInPreviousCongregation?: string;
}

export function normaliseBaptismInfo(raw: any): BaptismInfo | undefined {
  if (raw == null) {
    return undefined;
  }

  if (typeof raw !== 'object') {
    return undefined;
  }

  if (raw.dateType === 'not_baptised') {
    const { dateType, fullDate, month, year, ...rest } = raw;
    return { baptismStatus: 'not_baptised', ...rest } as BaptismInfo;
  }

  if ('baptismStatus' in raw) {
    return { ...raw } as BaptismInfo;
  }

  return { baptismStatus: 'baptised', ...raw } as BaptismInfo;
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
  linkedChildMemberId?: string;
  childMemberId?: string;
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
  positionHeld?: string[]; // Member positions
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
  const { isOnline } = useNetworkStatus();
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
        const statusOrder = { new: 0, active: 1, 'semi-active': 2, inactive: 3, sick: 4, traveled: 5, schooling: 6, 'not baptised': 7, blacklisted: 8 };
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
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-4 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full rounded-[10px]" />
        <div className="overflow-hidden rounded-xl bg-card">
          {[...Array(6)].map((_, i) => (
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

  const filterFields: { label: string; value: string; set: (value: string) => void; options: [string, string][] }[] = [
    { label: 'Zone', value: zoneFilter, set: setZoneFilter, options: [['all', 'All Zones'], ...Object.entries(ZONES).map(([code, name]): [string, string] => [code, `${code} - ${name}`])] },
    {
      label: 'Status',
      value: statusFilter,
      set: setStatusFilter,
      options: [['all', 'All Status'], ['new', 'New'], ['active', 'Active'], ['semi-active', 'Semi-Active'], ['inactive', 'Inactive'], ['sick', 'Sick'], ['traveled', 'Traveled'], ['schooling', 'Schooling'], ['not baptised', 'Not Baptised'], ['blacklisted', 'Blacklisted']],
    },
    { label: 'Gender', value: genderFilter, set: setGenderFilter, options: [['all', 'All'], ['male', 'Male'], ['female', 'Female']] },
    { label: 'Ministry', value: ministryFilter, set: setMinistryFilter, options: [['all', 'All Ministries'], ...MINISTRIES.map((ministry): [string, string] => [ministry, ministry])] },
    {
      label: 'Birth Month',
      value: birthMonthFilter,
      set: setBirthMonthFilter,
      options: [['all', 'All Months'], ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, i): [string, string] => [String(i + 1).padStart(2, '0'), month])],
    },
    { label: 'Date of Birth', value: dateOfBirthFilter, set: setDateOfBirthFilter, options: [['all', 'All Dates'], ['today', "Today's Birthday"]] },
    { label: 'Age Range', value: ageRangeFilter, set: setAgeRangeFilter, options: [['all', 'All Ages'], ['18-25', '18-25'], ['26-35', '26-35'], ['36-45', '36-45'], ['46-55', '46-55'], ['56-65', '56-65'], ['65+', '65+']] },
  ];
  const filtersActive = filterFields.some((field) => field.value !== 'all');
  const clearFilters = () => {
    setSearchTerm('');
    filterFields.forEach((field) => field.set('all'));
  };

  const sortOptions: [Exclude<typeof sortBy, never>, 'asc' | 'desc', string][] = [
    ['name', 'asc', 'Name (A-Z)'],
    ['name', 'desc', 'Name (Z-A)'],
    ['zone', 'asc', 'Zone (A-Z)'],
    ['zone', 'desc', 'Zone (Z-A)'],
    ['status', 'asc', 'Status (Active first)'],
    ['status', 'desc', 'Status (Inactive first)'],
    ['joinDate', 'desc', 'Join Date (Newest)'],
    ['joinDate', 'asc', 'Join Date (Oldest)'],
    ['baptismDate', 'desc', 'Baptism Date (Newest)'],
    ['baptismDate', 'asc', 'Baptism Date (Oldest)'],
    ['baptismYear', 'desc', 'Baptism Year (Newest)'],
    ['baptismYear', 'asc', 'Baptism Year (Oldest)'],
  ];

  const countStatus = (...statuses: string[]) => members.filter((m) => statuses.includes(m.status)).length;
  const statChips: { label: string; count: number; status?: string }[] = [
    { label: 'Total', count: members.length, status: 'all' },
    { label: 'New', count: countStatus('new'), status: 'new' },
    { label: 'Active', count: countStatus('active'), status: 'active' },
    { label: 'Semi-Active', count: countStatus('semi-active'), status: 'semi-active' },
    { label: 'Inactive', count: countStatus('inactive'), status: 'inactive' },
    { label: 'Excused', count: countStatus('sick', 'traveled', 'schooling') },
    { label: 'Not Baptised', count: countStatus('not baptised'), status: 'not baptised' },
  ];

  const statusBadgeClass = (status: string) =>
    status === 'new' ? 'bg-primary/10 text-primary-text' :
    status === 'active' ? 'bg-success-soft text-success-text' :
    status === 'semi-active' ? 'bg-info-soft text-info-text' :
    status === 'inactive' ? 'bg-warning-soft text-warning-text' :
    status === 'blacklisted' ? 'bg-destructive/10 text-destructive' :
    'bg-fill text-foreground';

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 relative">
      <LargeTitle
        title={
          <span className="flex items-center gap-2">
            Members
            {!isOnline && (
              <Badge variant="outline" className="bg-warning-soft text-warning-text border-0">
                <WifiOff className="w-3 h-3 mr-1" />
                Cached
              </Badge>
            )}
          </span>
        }
        subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
        actions={
          <>
            {canAddMembers && (
              <Button onClick={onAddMember}>
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add New Member</span>
                <span className="sr-only sm:hidden">Add New Member</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="soft" size="icon" aria-label="More actions">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </DropdownMenuItem>
                {canAddMembers && onAddFromVisitor && (
                  <DropdownMenuItem onClick={onAddFromVisitor}>
                    <UserPlus className="w-4 h-4" />
                    Add from Visitor
                  </DropdownMenuItem>
                )}
                {members.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <Download className="w-4 h-4" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLSX}>
                      <Download className="w-4 h-4" />
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <Download className="w-4 h-4" />
                      Export as PDF
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status counts: tap one to filter the list */}
      {members.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {statChips.map((chip) => {
            const selectable = chip.status !== undefined;
            const selected = selectable && statusFilter === chip.status;
            return (
              <button
                key={chip.label}
                type="button"
                disabled={!selectable}
                onClick={() => chip.status && setStatusFilter(chip.status)}
                aria-pressed={selectable ? selected : undefined}
                className={`flex shrink-0 items-baseline gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] transition-colors active:opacity-70 ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
                }`}
              >
                <span className="font-semibold tabular-nums">{chip.count}</span>
                <span className={selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search, filter and sort */}
      <div className="flex items-center gap-2">
        <SearchField className="flex-1" value={searchTerm} onChange={setSearchTerm} placeholder="Search name, zone, email or phone" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={filtersActive ? 'default' : 'soft'} size="icon" aria-label="Filter">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="p-2 space-y-3">
              {filterFields.map((field) => (
                <div key={field.label}>
                  <label className="mb-1.5 block px-1 text-xs font-medium text-muted-foreground">{field.label}</label>
                  <Select value={field.value} onValueChange={field.set}>
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {filtersActive && (
                <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="soft" size="icon" aria-label="Sort">
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {sortOptions.map(([by, order, label]) => (
              <DropdownMenuItem key={label} onClick={() => { setSortBy(by); setSortOrder(order); }} className={sortBy === by && sortOrder === order ? 'bg-accent font-medium' : ''}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(filtersActive || searchTerm) && members.length > 0 && (
        <p className="px-1 text-[13px] text-muted-foreground">
          Showing {filteredMembers.length} of {members.length}
        </p>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <Group>
          <EmptyState
            icon={Users}
            title="No Members Yet"
            description="Start building your church member database by adding your first member."
            action={canAddMembers ? <Button onClick={onAddMember}><Plus className="w-4 h-4 mr-2" />Add First Member</Button> : undefined}
          />
        </Group>
      ) : filteredMembers.length === 0 ? (
        <Group>
          <EmptyState icon={Search} title="No results" description="No members match your search or filters." action={<Button variant="soft" onClick={clearFilters}>Clear filters</Button>} />
        </Group>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {filteredMembers.map((member) => {
            const row = (
              <button
                type="button"
                onClick={() => onViewMember(member)}
                className="relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 active:bg-accent after:absolute after:bottom-0 after:left-[4.5rem] after:right-0 after:h-px after:bg-separator"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {member.photo ? (
                    <img src={getCloudinaryUrl(member.photo, 'thumbnail') ?? ''} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-primary-text">
                      {member.firstName[0]}{member.lastName[0]}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] leading-snug lg:text-[15px]">
                    {member.firstName} {member.otherNames} {member.lastName}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {member.zoneNumber} · Zone {member.zone} · {member.phone}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {member.residenceLocation} ({ZONES[member.zone]})
                  </span>
                </span>
                <Badge variant="secondary" className={`shrink-0 border-0 capitalize ${statusBadgeClass(member.status)}`}>
                  {member.status}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              </button>
            );
            return (
              <SwipeRow
                key={member.id}
                className="last:[&_button]:after:hidden"
                actions={[
                  { label: 'Call', icon: Phone, tone: 'success', onClick: () => { window.location.href = `tel:${member.phone}`; } },
                  { label: 'View', icon: Eye, tone: 'info', onClick: () => onViewMember(member) },
                ]}
              >
                {row}
              </SwipeRow>
            );
          })}
        </div>
      )}

      {/* What each status means */}
      <Collapsible open={statusInfoOpen} onOpenChange={setStatusInfoOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl bg-card px-4 py-3 text-left text-[15px] active:bg-accent">
            <Info className="size-4 text-muted-foreground" />
            <span className="flex-1">Member status definitions</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-300" style={{ transform: statusInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-2 rounded-xl bg-card px-4 py-3 text-[13px] text-muted-foreground">
            {Object.entries(MEMBER_STATUS_DEFINITIONS).map(([status, text]) => (
              <p key={status}>
                <strong className="font-semibold capitalize text-foreground">{status}:</strong> {text}
              </p>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
    </PullToRefresh>
  );
}
