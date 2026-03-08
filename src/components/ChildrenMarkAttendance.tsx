import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { ArrowLeft, Search, Users, Clock, Check, X, UserCheck, Filter } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { ChildMember } from './Children';
import { api } from '../services/api';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';
import { useCachedData } from '../hooks/useCachedData';

interface ChildrenMarkAttendanceProps {
  onBack: () => void;
  onSave: () => void;
}

const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

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

export function ChildrenMarkAttendance({ onBack, onSave }: ChildrenMarkAttendanceProps) {
  const [serviceType, setServiceType] = useState('Sunday Main Service');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [children, setChildren] = useState<ChildMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'present' | 'absent' | 'unmarked'>>({});
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  const { data: cachedServices } = useCachedData<any[]>(
    'custom-services',
    () => api.services.getAll(),
    { duration: 5 * 60 * 1000 }
  );
  const [customServices, setCustomServices] = useState<any[]>([]);

  useEffect(() => {
    if (cachedServices) setCustomServices(cachedServices);
  }, [cachedServices]);

  const availableServices = [
    SUNDAY_MAIN_SERVICE.name,
    ...customServices.filter((s: any) => s.isActive && s.name !== SUNDAY_MAIN_SERVICE.name).map((s: any) => s.name)
  ];

  const handleServiceTypeChange = (value: string) => {
    setServiceType(value);
  };

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        setError(null);
        const membersData = await api.children.members.getAll();
        setChildren(membersData || []);
      } catch (err: any) {
        console.error('Failed to fetch children:', err);
        setError(getFriendlyMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, []);

  const filteredChildren = children.filter(child => {
    const matchesSearch = `${child.firstName} ${child.otherNames ?? ''} ${child.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnmarked = !showOnlyUnmarked || attendanceStatus[child.id] === 'unmarked' || !attendanceStatus[child.id];
    
    return matchesSearch && matchesUnmarked;
  });

  useEffect(() => {
    const initialStatus: Record<string, 'present' | 'absent' | 'unmarked'> = {};
    children.forEach(child => {
      initialStatus[child.id] = 'unmarked';
    });
    setAttendanceStatus(initialStatus);
  }, [children]);

  const handleAttendanceToggle = (memberId: string, status: 'present' | 'absent') => {
    setAttendanceStatus(prev => ({
      ...prev,
      [memberId]: prev[memberId] === status ? 'unmarked' : status
    }));
  };

  const handleMarkAllPresent = () => {
    const newStatus = { ...attendanceStatus };
    filteredChildren.forEach(child => {
      newStatus[child.id] = 'present';
    });
    setAttendanceStatus(newStatus);
  };

  const handleClearAll = () => {
    const newStatus = { ...attendanceStatus };
    filteredChildren.forEach(child => {
      newStatus[child.id] = 'unmarked';
    });
    setAttendanceStatus(newStatus);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const presentIds = Object.entries(attendanceStatus)
      .filter(([_, status]) => status === 'present')
      .map(([memberId]) => memberId);

    const absentMembers = Object.entries(attendanceStatus)
      .filter(([_, status]) => status === 'absent')
      .map(([memberId]) => memberId);

    if (presentIds.length === 0 && absentMembers.length === 0) {
      toast.error('Please mark at least one member as present or absent before saving.');
      return;
    }

    setIsLoading(true);

    try {
      await api.children.attendance.create({
        date,
        serviceType,
        childMemberIds: presentIds,
        visitorsCount: 0
      });

      toast.success(`Attendance saved! ${presentIds.length} present, ${absentMembers.length} absent.`);
      onSave();
    } catch (error: any) {
      console.error('Failed to save attendance:', error);
      toast.error(getFriendlyMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const totalMarked = Object.values(attendanceStatus).filter(status => status !== 'unmarked').length;
  const totalPresent = Object.values(attendanceStatus).filter(status => status === 'present').length;
  const totalAbsent = Object.values(attendanceStatus).filter(status => status === 'absent').length;
  const totalUnmarked = children.length - totalMarked;

  const getStatusColor = (status: 'present' | 'absent' | 'unmarked') => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Mark Children's Attendance</h1>
          <p className="text-muted-foreground">
            Mark individual members as present or absent
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Service Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select value={serviceType} onValueChange={handleServiceTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalPresent}</div>
            <p className="text-sm text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{totalAbsent}</div>
            <p className="text-sm text-muted-foreground">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{totalUnmarked}</div>
            <p className="text-sm text-muted-foreground">Unmarked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{children.length}</div>
            <p className="text-sm text-muted-foreground">Total Members</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search children..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={loading || !!error}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showOnlyUnmarked"
                  checked={showOnlyUnmarked}
                  onCheckedChange={(checked: boolean) => setShowOnlyUnmarked(checked)}
                  disabled={loading || !!error}
                />
                <Label htmlFor="showOnlyUnmarked" className="text-sm">Show only unmarked</Label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllPresent} disabled={loading || !!error}>
                <UserCheck className="w-4 h-4 mr-2" />
                Mark All Present
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll} disabled={loading || !!error}>
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Children ({filteredChildren.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted rounded"></div>
                        <div className="h-3 w-24 bg-muted rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-16 h-6 bg-muted rounded-full"></div>
                      <div className="flex gap-1">
                        <div className="w-8 h-8 bg-muted rounded"></div>
                        <div className="w-8 h-8 bg-muted rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            ) : filteredChildren.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No children found matching your filters.
                </AlertDescription>
              </Alert>
            ) : (
              filteredChildren.map((child) => {
                const status = attendanceStatus[child.id] || 'unmarked';
                return (
                  <div key={child.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {child.firstName[0]}{child.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {child.firstName} {child.otherNames || ''} {child.lastName}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{calculateAge(child.dateOfBirth)} yrs</span>
                          <span>•</span>
                          <span className="capitalize">{child.gender}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(status)}>
                        {status === 'present' && <Check className="w-3 h-3 mr-1" />}
                        {status === 'absent' && <X className="w-3 h-3 mr-1" />}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                      
                      <div className="flex gap-1">
                        <Button
                          variant={status === 'present' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleAttendanceToggle(child.id, 'present')}
                          className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={status === 'absent' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleAttendanceToggle(child.id, 'absent')}
                          className={status === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Alert className="flex-1 min-w-0">
              <AlertDescription>
                <strong>Summary:</strong> {totalPresent} present, {totalAbsent} absent, {totalUnmarked} unmarked out of {children.length} total members.
              </AlertDescription>
            </Alert>
            
            <Button
              onClick={handleSubmit}
              disabled={isLoading || loading || !!error}
              className="w-full sm:w-auto"
            >
              {isLoading ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
