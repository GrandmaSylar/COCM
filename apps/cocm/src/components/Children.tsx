import { useState, useMemo, useEffect } from 'react';
import { IconTile, LargeTitle } from './ui/ios';
import { SwipeRow } from './ui/ios-gestures';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Search, Plus, Users, UserPlus, Calendar, Banknote, Eye, CheckCircle, Clock, Pencil, RefreshCw, Download, BarChart3 } from 'lucide-react';
import { ChildrenAnalytics } from './ChildrenAnalytics';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { exportToCSV, exportToPDF, exportToXLSX, formatDateForExport, formatCurrencyForExport } from '../utils/export';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './EmptyState';
import { useAuth } from './AuthContext';
import { useCachedData } from '../hooks/useCachedData';
import { api } from '../services/api';
import { sanitizeUrl } from '@braintree/sanitize-url';
import { getCloudinaryUrl } from '../utils/cloudinary';
import { OfflineOverlay } from './OfflineOverlay';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';

// --- Types ---

export interface ChildParent {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone: string;
  relationship: string;
  occupation?: string;
  hometown?: string;
  isLinked?: boolean;
  linkedMemberId?: string;
  linkedChildMemberId?: string;
}

export interface ChildMember {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  status: 'active' | 'inactive';
  parents: ChildParent[];
  phone?: string;
  residenceLocation?: string;
  photo?: string;
  joinDate: string;

  zone?: string;
  notes?: string;
  email?: string;
  secondPhone?: string;
  digitalAddress?: string;
  occupation?: string;
  hometown?: string;
}

export interface ChildrenAttendanceEntry {
  childId: string;
  childName: string;
  present: boolean;
}

export interface ChildrenAttendanceRecord {
  id: string;
  date: string;
  serviceType: string;
  totalCount: number;
  entries?: ChildrenAttendanceEntry[];
}

export interface ChildrenGivingRecord {
  id: string;
  serviceDate: string;
  serviceType: string;
  totalAmount: number;
  notes?: string;
}

export interface ChildVisitorGuardian {
  id: string;
  fullName: string;
  residentialLocation?: string;
  contactInfo?: string;
}

export interface ChildVisitor {
  id: string;
  firstName: string;
  lastName: string;
  visitDate: string;
  notes?: string;
  gender?: string;
  dateOfBirth?: string;
  occupation?: string;
  contactPhone?: string;
  referredBy?: string;
  guardians: ChildVisitorGuardian[];
  convertedToMember?: boolean;
  convertedMemberId?: string;
}

// --- Helpers ---

function calculateAge(dob: string) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function ChildListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// --- Components ---

function ChildMembersList({ refreshKey, onAddChild, onViewChild, onRefresh }: { refreshKey: number, onAddChild: () => void, onViewChild: (child: ChildMember) => void, onRefresh: () => void }) {
  const { canAccess } = useAuth();
  const canAddMembers = canAccess('manage_members');

  const { data: children, loading } = useCachedData<ChildMember[]>(
    `children-members-${refreshKey}`,
    () => api.children.members.getAll()
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  const filteredChildren = useMemo(() => {
    if (!children) return [];
    return children.filter(c => {
      const matchesSearch = searchTerm === '' || 
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesGender = genderFilter === 'all' || c.gender === genderFilter;
      return matchesSearch && matchesStatus && matchesGender;
    });
  }, [children, searchTerm, statusFilter, genderFilter]);

  const handleExportCSV = () => {
    const data = filteredChildren.map(c => ({
      ...c,
      age: calculateAge(c.dateOfBirth),
      parentName: c.parents?.[0] ? `${c.parents[0].firstName} ${c.parents[0].lastName}` : '',
      dateOfBirth: formatDateForExport(c.dateOfBirth),
      joinDate: formatDateForExport(c.joinDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'age', label: 'Age' },
      { key: 'status', label: 'Status' },
      { key: 'joinDate', label: 'Join Date' },

      { key: 'zone', label: 'Zone' },
      { key: 'parentName', label: 'Parent/Guardian' }
    ];
    exportToCSV(data, `children-members-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const handleExportPDF = () => {
    const data = filteredChildren.map(c => ({
      ...c,
      age: calculateAge(c.dateOfBirth),
      parentName: c.parents?.[0] ? `${c.parents[0].firstName} ${c.parents[0].lastName}` : '',
      dateOfBirth: formatDateForExport(c.dateOfBirth),
      joinDate: formatDateForExport(c.joinDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'age', label: 'Age' },
      { key: 'status', label: 'Status' },
      { key: 'joinDate', label: 'Join Date' },
      { key: 'isBaptised', label: 'Baptised' },
      { key: 'zone', label: 'Zone' },
      { key: 'parentName', label: 'Parent/Guardian' }
    ];
    exportToPDF(data, `children-members-${new Date().toISOString().slice(0, 10)}`, 'Children Members', cols);
  };

  const handleExportXLSX = () => {
    const data = filteredChildren.map(c => ({
      ...c,
      age: calculateAge(c.dateOfBirth),
      parentName: c.parents?.[0] ? `${c.parents[0].firstName} ${c.parents[0].lastName}` : '',
      dateOfBirth: formatDateForExport(c.dateOfBirth),
      joinDate: formatDateForExport(c.joinDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'age', label: 'Age' },
      { key: 'status', label: 'Status' },
      { key: 'joinDate', label: 'Join Date' },
      { key: 'isBaptised', label: 'Baptised' },
      { key: 'zone', label: 'Zone' },
      { key: 'parentName', label: 'Parent/Guardian' }
    ];
    exportToXLSX(data, `children-members-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const totalChildren = children?.length || 0;
  const activeChildren = children?.filter(c => c.status === 'active').length || 0;
  const newThisMonth = children?.filter(c => {
    const dob = new Date(c.joinDate);
    const now = new Date();
    return dob.getMonth() === now.getMonth() && dob.getFullYear() === now.getFullYear();
  }).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Members</h2>
        <div className="flex items-center gap-2">
          {canAddMembers && (
            <Button onClick={onAddChild}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Child</span>
              <span className="sr-only sm:hidden">Add Child</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="icon" aria-label="More actions">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              {filteredChildren.length > 0 && (
                <>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <Download className="w-4 h-4" />
                    Export as Excel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Users, tone: 'primary' as const, value: totalChildren, label: 'Total' },
          { icon: CheckCircle, tone: 'success' as const, value: activeChildren, label: 'Active' },
          { icon: UserPlus, tone: 'info' as const, value: newThisMonth, label: 'New This Month' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-card p-3 sm:p-4">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums">{stat.value}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search by name..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !children ? (
        <ChildListSkeleton />
      ) : filteredChildren.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No Children Found"
              description={searchTerm ? "No children found matching your filters." : "Record your first child member to track their spiritual journey."}
              action={(!searchTerm && canAddMembers) ? { label: "Add Child", onClick: onAddChild } : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {filteredChildren.map(child => (
            <SwipeRow
              key={child.id}
              className="last:[&_button]:after:hidden"
              actions={[{ label: 'View', icon: Eye, tone: 'info', onClick: () => onViewChild(child) }]}
            >
              <button
                type="button"
                onClick={() => onViewChild(child)}
                className="relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 active:bg-accent after:absolute after:bottom-0 after:left-[4.5rem] after:right-0 after:h-px after:bg-separator"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary-text">
                  {child.photo && sanitizeUrl(child.photo) !== 'about:blank' ? (
                    <img src={sanitizeUrl(getCloudinaryUrl(child.photo, 'thumbnail') ?? '')} alt={child.firstName} className="size-full object-cover" />
                  ) : (
                    `${child.firstName[0]}${child.lastName[0]}`
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] leading-snug lg:text-[15px]">{child.firstName} {child.lastName}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {child.parents?.[0] ? `${child.parents[0].firstName} ${child.parents[0].lastName}`.trim() || 'No parent info' : 'No parent info'} · <span className="capitalize">{child.gender}</span> · {calculateAge(child.dateOfBirth)} yrs
                  </span>
                </span>
                <Badge variant="secondary" className={`shrink-0 border-0 capitalize ${child.status === 'active' ? 'bg-success-soft text-success-text' : 'bg-fill text-muted-foreground'}`}>
                  {child.status}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              </button>
            </SwipeRow>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildVisitorsList({ refreshKey, onAddVisitor, onRefresh, onConvertVisitor }: { refreshKey: number, onAddVisitor: () => void, onRefresh: () => void, onConvertVisitor?: (v: ChildVisitor) => void }) {
  const { data: visitors, loading } = useCachedData<ChildVisitor[]>(
    `children-visitors-${refreshKey}`,
    () => api.children.visitors.getAll()
  );

  const [searchTerm, setSearchTerm] = useState('');

  const filteredVisitors = useMemo(() => {
    if (!visitors) return [];
    return visitors.filter(v => {
      const matchName = `${v.firstName} ${v.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const firstGuardianName = v.guardians?.[0]?.fullName || '';
      const matchParent = firstGuardianName.toLowerCase().includes(searchTerm.toLowerCase());
      return searchTerm === '' || matchName || matchParent;
    });
  }, [visitors, searchTerm]);

  const handleExportCSV = () => {
    const data = filteredVisitors.map(v => ({
      ...v,
      guardians: v.guardians?.map(g => g.fullName).join(', ') || '',
      dateOfBirth: formatDateForExport(v.dateOfBirth),
      visitDate: formatDateForExport(v.visitDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'visitDate', label: 'Date of Visit' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'referredBy', label: 'Referred By' },
      { key: 'guardians', label: 'Guardian(s)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToCSV(data, `children-visitors-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const handleExportPDF = () => {
    const data = filteredVisitors.map(v => ({
      ...v,
      guardians: v.guardians?.map(g => g.fullName).join(', ') || '',
      dateOfBirth: formatDateForExport(v.dateOfBirth),
      visitDate: formatDateForExport(v.visitDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'visitDate', label: 'Date of Visit' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'referredBy', label: 'Referred By' },
      { key: 'guardians', label: 'Guardian(s)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToPDF(data, `children-visitors-${new Date().toISOString().slice(0, 10)}`, 'Children Visitors', cols);
  };

  const handleExportXLSX = () => {
    const data = filteredVisitors.map(v => ({
      ...v,
      guardians: v.guardians?.map(g => g.fullName).join(', ') || '',
      dateOfBirth: formatDateForExport(v.dateOfBirth),
      visitDate: formatDateForExport(v.visitDate)
    }));
    const cols = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'visitDate', label: 'Date of Visit' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'referredBy', label: 'Referred By' },
      { key: 'guardians', label: 'Guardian(s)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToXLSX(data, `children-visitors-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Visitors</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onAddVisitor}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Visitor</span>
            <span className="sr-only sm:hidden">Add Visitor</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="icon" aria-label="More actions">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              {filteredVisitors.length > 0 && (
                <>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <Download className="w-4 h-4" />
                    Export as Excel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search by child or parent/guardian name..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && !visitors ? (
        <ChildListSkeleton />
      ) : filteredVisitors.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserPlus}
              title="No Visitors Found"
              description={searchTerm ? "No visitors found matching your filters." : "Add visitors to keep track of new children joining activities."}
              action={!searchTerm ? { label: "Add Visitor", onClick: onAddVisitor } : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {filteredVisitors.map(visitor => (
            <div key={visitor.id} className={`flex items-center ${visitor.convertedToMember ? 'opacity-60' : ''}`}>
              <div className="relative flex w-full items-center gap-3 px-4 py-3 text-left after:absolute after:bottom-0 after:left-[4.5rem] after:right-0 after:h-px after:bg-separator flex-1 min-w-0">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary-text">
                  {visitor.firstName[0]}{visitor.lastName[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] leading-snug lg:text-[15px]">{visitor.firstName} {visitor.lastName}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {new Date(visitor.visitDate).toLocaleDateString()} · <span className="capitalize">{visitor.gender ?? '—'}</span> · {visitor.dateOfBirth ? calculateAge(visitor.dateOfBirth) + ' yrs' : '—'}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">Guardians: {visitor.guardians?.map(g => g.fullName).join(', ') || '—'}</span>
                  {visitor.convertedToMember && (
                    <Badge variant="secondary" className="mt-1 border-0 bg-fill text-muted-foreground">
                      <CheckCircle className="mr-1 size-3" />
                      Member
                    </Badge>
                  )}
                </span>
              </div>
              {!visitor.convertedToMember && onConvertVisitor && (
                <Button variant="soft" size="sm" className="mr-3 shrink-0" onClick={() => onConvertVisitor(visitor)}>
                  <UserPlus className="mr-1.5 size-4" />
                  Convert
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildrenAttendanceList({ refreshKey, onMarkAttendance, onRefresh }: { refreshKey: number, onMarkAttendance: () => void, onRefresh: () => void }) {
  const { data: records, loading } = useCachedData<ChildrenAttendanceRecord[]>(
    `children-attendance-${refreshKey}`,
    () => api.children.attendance.getAll()
  );

  const handleExportCSV = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      date: formatDateForExport(r.date)
    }));
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalCount', label: 'Total Present' }
    ];
    exportToCSV(data, `children-attendance-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const handleExportPDF = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      date: formatDateForExport(r.date)
    }));
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalCount', label: 'Total Present' }
    ];
    exportToPDF(data, `children-attendance-${new Date().toISOString().slice(0, 10)}`, 'Children Attendance', cols);
  };

  const handleExportXLSX = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      date: formatDateForExport(r.date)
    }));
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalCount', label: 'Total Present' }
    ];
    exportToXLSX(data, `children-attendance-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Attendance</h2>
        <div className="flex items-center gap-2">
          <Button onClick={onMarkAttendance}>
            <Calendar className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Mark Attendance</span>
            <span className="sr-only sm:hidden">Mark Attendance</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="icon" aria-label="More actions">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              {records && records.length > 0 && (
                <>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <Download className="w-4 h-4" />
                    Export as Excel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading && !records ? (
        <ChildListSkeleton />
      ) : !records || records.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Calendar}
              title="No Attendance Records"
              description="Start tracking attendance to see records here."
              action={{ label: "Mark Attendance", onClick: onMarkAttendance }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {records.map(record => (
            <div key={record.id} className="relative flex w-full items-center gap-3 px-4 py-3 text-left after:absolute after:bottom-0 after:left-[3.25rem] after:right-0 after:h-px after:bg-separator">
              <IconTile icon={Calendar} tone="primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] leading-snug lg:text-[15px]">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{record.serviceType}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xl font-bold leading-none tabular-nums">{record.totalCount}</span>
                <span className="text-[11px] text-muted-foreground">present</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildrenGivingList({ refreshKey, onRefresh }: { refreshKey: number, onRefresh: () => void }) {
  const { data: records, loading, refresh } = useCachedData<ChildrenGivingRecord[]>(
    `children-giving-${refreshKey}`,
    () => api.children.giving.getAll()
  );

  const { canAccess } = useAuth();
  const canEdit = canAccess('manage_giving');

  const handleExportCSV = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      serviceDate: formatDateForExport(r.serviceDate),
      totalAmount: formatCurrencyForExport(r.totalAmount)
    }));
    const cols = [
      { key: 'serviceDate', label: 'Service Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalAmount', label: 'Total Amount (GH₵)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToCSV(data, `children-giving-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const handleExportPDF = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      serviceDate: formatDateForExport(r.serviceDate),
      totalAmount: formatCurrencyForExport(r.totalAmount)
    }));
    const cols = [
      { key: 'serviceDate', label: 'Service Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalAmount', label: 'Total Amount (GH₵)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToPDF(data, `children-giving-${new Date().toISOString().slice(0, 10)}`, 'Children Giving', cols);
  };

  const handleExportXLSX = () => {
    if (!records) return;
    const data = records.map(r => ({
      ...r,
      serviceDate: formatDateForExport(r.serviceDate),
      totalAmount: formatCurrencyForExport(r.totalAmount)
    }));
    const cols = [
      { key: 'serviceDate', label: 'Service Date' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'totalAmount', label: 'Total Amount (GH₵)' },
      { key: 'notes', label: 'Notes' }
    ];
    exportToXLSX(data, `children-giving-${new Date().toISOString().slice(0, 10)}`, cols);
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChildrenGivingRecord | null>(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.services.getAll()
      .then(data => setServices(data.filter((s: any) => s.isActive && s.name !== 'Sunday Main Service')))
      .catch(console.error);
  }, []);

  const openCreateDialog = () => {
    setEditingRecord(null);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setServiceType('Sunday Main Service');
    setTotalAmount('');
    setNotes('');
    setDialogOpen(true);
  };

  const openEditDialog = (record: ChildrenGivingRecord) => {
    setEditingRecord(record);
    setServiceDate(record.serviceDate);
    setServiceType(record.serviceType);
    setTotalAmount(record.totalAmount.toString());
    setNotes(record.notes || '');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRecord(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        serviceDate,
        serviceType,
        totalAmount: parseFloat(totalAmount),
        notes
      };

      if (editingRecord) {
        await api.children.giving.update(editingRecord.id, payload);
      } else {
        await api.children.giving.create(payload);
      }

      closeDialog();
      refresh();
      toast.success(editingRecord ? 'Giving record updated' : 'Giving record created');
    } catch (error) {
      toast.error(getFriendlyMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold">Giving</h2>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog}>
            <Banknote className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Record Giving</span>
            <span className="sr-only sm:hidden">Record Giving</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="soft" size="icon" aria-label="More actions">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              {records && records.length > 0 && (
                <>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <Download className="w-4 h-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <Download className="w-4 h-4" />
                    Export as Excel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading && !records ? (
        <ChildListSkeleton />
      ) : !records || records.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Banknote}
              title="No Giving Records"
              description="No giving records yet. Record the first children's offering."
              action={{ label: "Record Giving", onClick: openCreateDialog }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card">
          {records.map(record => (
            <div key={record.id} className="flex items-center">
              <div className="relative flex w-full items-center gap-3 px-4 py-3 text-left after:absolute after:bottom-0 after:left-[3.25rem] after:right-0 after:h-px after:bg-separator flex-1 min-w-0">
                <IconTile icon={Banknote} tone="success" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] leading-snug lg:text-[15px]">{new Date(record.serviceDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{record.serviceType}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-bold leading-none tabular-nums">GH₵ {record.totalAmount.toFixed(2)}</span>
                  <span className="text-[11px] text-muted-foreground">Total</span>
                </span>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" className="mr-1 shrink-0" aria-label="Edit record" onClick={() => openEditDialog(record)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit Giving Record' : 'Record Giving'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Date</Label>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  GH₵
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-12"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !serviceDate || !serviceType || !totalAmount}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export interface ChildrenProps {
  onAddChild: () => void;
  onViewChild: (child: ChildMember) => void;
  onMarkAttendance: () => void;
  onAddChildVisitor: () => void;
  onConvertChildVisitor?: (visitor: ChildVisitor) => void;
  activeTab?: 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics';
  onTabChange?: (tab: 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics') => void;
}

export function Children({
  onAddChild,
  onViewChild,
  onMarkAttendance,
  onAddChildVisitor,
  onConvertChildVisitor,
  activeTab = 'members',
  onTabChange
}: ChildrenProps) {
  const [internalTab, setInternalTab] = useState<'members' | 'visitors' | 'attendance' | 'giving' | 'analytics'>(activeTab);
  const currentTab = onTabChange ? activeTab : internalTab;

  const handleTabChange = (tab: 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics') => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [visitorsRefreshKey, setVisitorsRefreshKey] = useState(0);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [givingRefreshKey, setGivingRefreshKey] = useState(0);

  return (
    <OfflineOverlay>
    <div className="space-y-4 animate-fade-in max-w-[1200px] mx-auto">
      <LargeTitle title="Children's Ministry" subtitle="Children records, visitors, attendance and giving" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {[
          { id: 'members', title: 'Members', icon: Users },
          { id: 'visitors', title: 'Visitors', icon: UserPlus },
          { id: 'attendance', title: 'Attendance', icon: Calendar },
          { id: 'giving', title: 'Giving', icon: Banknote },
          { id: 'analytics', title: 'Analytics', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={currentTab === tab.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] transition-colors active:opacity-70 ${
              currentTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
            }`}
            onClick={() => handleTabChange(tab.id as 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics')}
          >
            <tab.icon className="size-4" />
            {tab.title}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {currentTab === 'members' && (
          <ChildMembersList 
            refreshKey={membersRefreshKey} 
            onRefresh={() => setMembersRefreshKey(k => k + 1)}
            onAddChild={onAddChild} 
            onViewChild={onViewChild} 
          />
        )}
        {currentTab === 'visitors' && (
          <ChildVisitorsList 
            refreshKey={visitorsRefreshKey} 
            onRefresh={() => setVisitorsRefreshKey(k => k + 1)}
            onAddVisitor={onAddChildVisitor} 
            onConvertVisitor={onConvertChildVisitor}
          />
        )}
        {currentTab === 'attendance' && (
          <ChildrenAttendanceList 
            refreshKey={attendanceRefreshKey} 
            onRefresh={() => setAttendanceRefreshKey(k => k + 1)}
            onMarkAttendance={onMarkAttendance} 
          />
        )}
        {currentTab === 'giving' && (
          <ChildrenGivingList 
            refreshKey={givingRefreshKey} 
            onRefresh={() => setGivingRefreshKey(k => k + 1)}
          />
        )}
        {currentTab === 'analytics' && <ChildrenAnalytics />}
      </div>
    </div>
    </OfflineOverlay>
  );
}
