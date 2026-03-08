import { useState, useMemo, useEffect } from 'react';
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
  isBaptised: boolean;
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
      { key: 'isBaptised', label: 'Baptised' },
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Members</h2>
          <p className="text-muted-foreground">Manage children's ministry members</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {filteredChildren.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canAddMembers && (
            <Button onClick={onAddChild}>
              <Plus className="w-4 h-4 mr-2" />
              Add Child
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Children</p>
                <h3 className="text-2xl font-bold">{totalChildren}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <h3 className="text-2xl font-bold">{activeChildren}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <UserPlus className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">New This Month</p>
                <h3 className="text-2xl font-bold">{newThisMonth}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
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
        <div className="space-y-4">
          {filteredChildren.map(child => (
            <Card key={child.id} className="hover:bg-accent/5 transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary shrink-0 overflow-hidden shadow-inner">
                    {child.photo && sanitizeUrl(child.photo) !== 'about:blank' ? (
                      <img src={getCloudinaryUrl(child.photo, 'thumbnail') ?? ''} alt={child.firstName} className="w-full h-full object-cover" />
                    ) : (
                      `${child.firstName[0]}${child.lastName[0]}`
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{child.firstName} {child.lastName}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>{child.parents?.[0] ? `${child.parents[0].firstName} ${child.parents[0].lastName}`.trim() || 'No parent info' : 'No parent info'}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="capitalize">{child.gender}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span>{calculateAge(child.dateOfBirth)} yrs</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Badge variant={child.status === 'active' ? 'default' : 'secondary'} className="ml-auto sm:ml-0">
                    {child.status}
                  </Badge>
                  {child.isBaptised && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Baptised ✓
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onViewChild(child)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildVisitorsList({ refreshKey, onAddVisitor, onRefresh }: { refreshKey: number, onAddVisitor: () => void, onRefresh: () => void }) {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Visitors</h2>
          <p className="text-muted-foreground">Manage children's ministry visitors</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {filteredVisitors.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={onAddVisitor}>
            <Plus className="w-4 h-4 mr-2" />
            Add Visitor
          </Button>
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
        <div className="space-y-4">
          {filteredVisitors.map(visitor => (
            <Card key={visitor.id} className="hover:bg-accent/5 transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center font-bold text-secondary-foreground shrink-0 shadow-inner">
                    {visitor.firstName[0]}{visitor.lastName[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{visitor.firstName} {visitor.lastName}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(visitor.visitDate).toLocaleDateString()}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="capitalize">{visitor.gender ?? '—'}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span>{visitor.dateOfBirth ? calculateAge(visitor.dateOfBirth) + ' yrs' : '—'}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="truncate max-w-[200px]" title={visitor.guardians?.map(g => g.fullName).join(', ')}>
                        Guardians: {visitor.guardians?.map(g => g.fullName).join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                </div>
              </CardContent>
            </Card>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance</h2>
          <p className="text-muted-foreground">View children's attendance records</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {records && records.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={onMarkAttendance}>
            <Calendar className="w-4 h-4 mr-2" />
            Mark Attendance
          </Button>
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
        <div className="space-y-4">
          {records.map(record => (
            <Card key={record.id} className="hover:bg-accent/5 transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{record.serviceType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 w-full sm:w-auto">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Present</p>
                    <p className="text-lg font-bold text-green-600">{record.totalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Giving</h2>
          <p className="text-muted-foreground">View children's giving records</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {records && records.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={openCreateDialog}>
            <Banknote className="w-4 h-4 mr-2" />
            Record Giving
          </Button>
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
        <div className="space-y-4">
          {records.map(record => (
            <Card key={record.id} className="hover:bg-accent/5 transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{new Date(record.serviceDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{record.serviceType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total Amount</p>
                    <p className="text-xl font-bold text-emerald-600">GH₵ {record.totalAmount.toFixed(2)}</p>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(record)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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
  activeTab?: 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics';
  onTabChange?: (tab: 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics') => void;
}

export function Children({
  onAddChild,
  onViewChild,
  onMarkAttendance,
  onAddChildVisitor,
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
    <div className="space-y-8 animate-fade-in max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Children's Ministry</h1>
        <p className="text-muted-foreground">
          Manage children records, visitors, attendance, and giving.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { id: 'members', title: 'Members', label: 'Registered children', icon: Users, color: 'bg-violet-100 text-violet-600' },
          { id: 'visitors', title: 'Visitors', label: 'New & visiting children', icon: UserPlus, color: 'bg-amber-100 text-amber-600' },
          { id: 'attendance', title: 'Attendance', label: 'Service attendance records', icon: Calendar, color: 'bg-green-100 text-green-600' },
          { id: 'giving', title: 'Giving', label: "Children's giving records", icon: Banknote, color: 'bg-emerald-100 text-emerald-600' },
          { id: 'analytics', title: 'Analytics', label: "Children's insights", icon: BarChart3, color: 'bg-blue-100 text-blue-600' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`rounded-xl p-3 flex items-center gap-3 w-full text-left transition-all ${
              currentTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border hover:bg-accent/50'
            }`}
            onClick={() => handleTabChange(tab.id as 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics')}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${currentTab === tab.id ? 'bg-white/20' : tab.color}`}>
              <tab.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">{tab.title}</div>
              <div className={`text-xs ${currentTab === tab.id ? 'opacity-75' : 'text-muted-foreground'}`}>{tab.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-[400px]">
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
  );
}
