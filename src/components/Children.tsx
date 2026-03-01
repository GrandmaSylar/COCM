import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Search, Plus, Users, UserPlus, Calendar, Banknote, Eye, CheckCircle, Clock } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './EmptyState';
import { useAuth } from './AuthContext';
import { useCachedData } from '../hooks/useCachedData';
import { api } from '../services/api';
import { sanitizeUrl } from '@braintree/sanitize-url';

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

export interface ChildVisitor {
  id: string;
  firstName: string;
  lastName: string;
  dateOfVisit: string;
  parentGuardianName: string;
  parentGuardianPhone?: string;
  followUpStatus: 'pending' | 'contacted' | 'converted';
  notes?: string;
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

function ChildMembersList({ refreshKey, onAddChild, onViewChild }: { refreshKey: number, onAddChild: () => void, onViewChild: (child: ChildMember) => void }) {
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

  if (loading) return <ChildListSkeleton />;

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
        {canAddMembers && (
          <Button onClick={onAddChild}>
            <Plus className="w-4 h-4 mr-2" />
            Add Child
          </Button>
        )}
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

      {filteredChildren.length === 0 ? (
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
                      <img src={sanitizeUrl(child.photo)} alt={child.firstName} className="w-full h-full object-cover" />
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

function ChildVisitorsList({ refreshKey, onAddVisitor }: { refreshKey: number, onAddVisitor: () => void }) {
  const { data: visitors, loading } = useCachedData<ChildVisitor[]>(
    `children-visitors-${refreshKey}`,
    () => api.children.visitors.getAll()
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVisitors = useMemo(() => {
    if (!visitors) return [];
    return visitors.filter(v => {
      const matchName = `${v.firstName} ${v.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParent = v.parentGuardianName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = searchTerm === '' || matchName || matchParent;
      const matchesStatus = statusFilter === 'all' || v.followUpStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visitors, searchTerm, statusFilter]);

  if (loading) return <ChildListSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Visitors</h2>
          <p className="text-muted-foreground">Manage children's ministry visitors</p>
        </div>
        <Button onClick={onAddVisitor}>
          <Plus className="w-4 h-4 mr-2" />
          Add Visitor
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search by child or parent name..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Follow-up Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredVisitors.length === 0 ? (
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
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(visitor.dateOfVisit).toLocaleDateString()}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="truncate max-w-[150px]">Parent: {visitor.parentGuardianName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Badge 
                    variant="outline"
                    className={
                      visitor.followUpStatus === 'pending' ? 'bg-amber-100 text-amber-800' :
                      visitor.followUpStatus === 'contacted' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }
                  >
                    {visitor.followUpStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildrenAttendanceList({ refreshKey, onMarkAttendance }: { refreshKey: number, onMarkAttendance: () => void }) {
  const { data: records, loading } = useCachedData<ChildrenAttendanceRecord[]>(
    `children-attendance-${refreshKey}`,
    () => api.children.attendance.getAll()
  );

  if (loading) return <ChildListSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance</h2>
          <p className="text-muted-foreground">View children's attendance records</p>
        </div>
        <Button onClick={onMarkAttendance}>
          <Calendar className="w-4 h-4 mr-2" />
          Mark Attendance
        </Button>
      </div>

      {!records || records.length === 0 ? (
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

function ChildrenGivingList() {
  const { data: records, loading } = useCachedData<ChildrenGivingRecord[]>(
    'children-giving',
    () => api.children.giving.getAll()
  );

  if (loading) return <ChildListSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Giving</h2>
          <p className="text-muted-foreground">View children's giving records</p>
        </div>
      </div>

      {!records || records.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Banknote}
              title="No Giving Records"
              description="Coming soon: You will be able to record children's giving here."
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ChildrenProps {
  onAddChild: () => void;
  onViewChild: (child: ChildMember) => void;
  onMarkAttendance: () => void;
  onAddChildVisitor: () => void;
  refreshKey: number;
  attendanceRefreshKey: number;
}

export function Children({
  onAddChild,
  onViewChild,
  onMarkAttendance,
  onAddChildVisitor,
  refreshKey,
  attendanceRefreshKey
}: ChildrenProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'visitors' | 'attendance' | 'giving'>('members');

  return (
    <div className="space-y-8 animate-fade-in max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Children's Ministry</h1>
        <p className="text-muted-foreground">
          Manage children records, visitors, attendance, and giving.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'members', title: 'Members', label: 'Registered children', icon: Users, color: 'bg-violet-100 text-violet-600' },
          { id: 'visitors', title: 'Visitors', label: 'New & visiting children', icon: UserPlus, color: 'bg-amber-100 text-amber-600' },
          { id: 'attendance', title: 'Attendance', label: 'Service attendance records', icon: Calendar, color: 'bg-green-100 text-green-600' },
          { id: 'giving', title: 'Giving', label: "Children's giving records", icon: Banknote, color: 'bg-emerald-100 text-emerald-600' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`rounded-xl p-3 flex items-center gap-3 w-full text-left transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border hover:bg-accent/50'
            }`}
            onClick={() => setActiveTab(tab.id as 'members' | 'visitors' | 'attendance' | 'giving')}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${activeTab === tab.id ? 'bg-white/20' : tab.color}`}>
              <tab.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">{tab.title}</div>
              <div className={`text-xs ${activeTab === tab.id ? 'opacity-75' : 'text-muted-foreground'}`}>{tab.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-[400px]">
        {activeTab === 'members' && (
          <ChildMembersList 
            refreshKey={refreshKey} 
            onAddChild={onAddChild} 
            onViewChild={onViewChild} 
          />
        )}
        {activeTab === 'visitors' && (
          <ChildVisitorsList 
            refreshKey={refreshKey} 
            onAddVisitor={onAddChildVisitor} 
          />
        )}
        {activeTab === 'attendance' && (
          <ChildrenAttendanceList 
            refreshKey={attendanceRefreshKey} 
            onMarkAttendance={onMarkAttendance} 
          />
        )}
        {activeTab === 'giving' && (
          <ChildrenGivingList />
        )}
      </div>
    </div>
  );
}
