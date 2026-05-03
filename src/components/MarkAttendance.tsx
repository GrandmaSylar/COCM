import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { ArrowLeft, Search, Users, Clock, Check, X, UserCheck, UserX, Filter } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Member, ZONES } from './Members';
import { api } from '../services/api';
import { toast } from 'sonner';
import { getFriendlyMessage } from '../utils/error-handler';
import { AbsenteeReview } from './AbsenteeReview';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtimeAttendance } from '../hooks/useRealtimeAttendance';

interface AttendanceRecord {
  id: string;
  date: string;
  serviceType: string;
  startTime?: string;
  endTime?: string;
  presentMembers: string[]; // member ids
  absentMembers: string[]; // member ids
  totalPresent: number;
  markedBy: string;
  markedAt: string;
}

interface MarkAttendanceProps {
  onBack: () => void;
  onSave: (record: Omit<AttendanceRecord, 'id' | 'markedBy' | 'markedAt'>) => void;
  initialDate?: string;
  initialServiceType?: string;
}

const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

export function MarkAttendance({ onBack, onSave, initialDate, initialServiceType }: MarkAttendanceProps) {
  const [serviceType, setServiceType] = useState(initialServiceType || 'Sunday Main Service');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'marking' | 'absentee-review'>('marking');
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedAbsentMemberIds, setSavedAbsentMemberIds] = useState<string[]>([]);

  const [attendanceRecordId, setAttendanceRecordId] = useState<string | null>(null);
  const [sessionCreatorId, setSessionCreatorId] = useState<string | null>(null);
  const [sessionCreatorName, setSessionCreatorName] = useState<string>('');

  const handleSessionFinalized = useCallback((data: { absentMemberIds: string[] }) => {
    toast.info('Session finalized! Moving to Absentee Review...', { duration: 3000 });
    setSavedRecordId(attendanceRecordId);
    setSavedAbsentMemberIds(data.absentMemberIds);
    setPhase('absentee-review');
  }, [attendanceRecordId]);

  const handleSessionCancelled = useCallback(() => {
    toast.error('The attendance session has been cancelled by the initiator.', { duration: 4000 });
    onBack();
  }, [onBack]);

  const { presentIds, isReady, toggleMember, broadcastFinalized, broadcastCancelled } = useRealtimeAttendance(
    attendanceRecordId,
    { onSessionFinalized: handleSessionFinalized, onSessionCancelled: handleSessionCancelled }
  );

  const handleCancelSession = async () => {
    if (!attendanceRecordId) return;
    if (!confirm('Are you sure you want to cancel this session? All recorded attendance will be deleted.')) return;
    try {
      await api.attendance.cancelSession(attendanceRecordId);
      broadcastCancelled();
      toast.info('Session cancelled.');
      onBack();
    } catch (err) {
      console.error('Failed to cancel session:', err);
      toast.error(getFriendlyMessage(err));
    }
  };

  // Create/fetch session on mount (or when date/service changes)
  useEffect(() => {
    if (!date || !serviceType) return;
    api.attendance.getOrCreate({ date, serviceType, startTime, endTime })
      .then((res) => {
        setAttendanceRecordId(res.id);
        setSessionCreatorId(res.createdBy);
        setSessionCreatorName(res.creatorName || '');
      })
      .catch(err => console.error("Failed to init attendance session:", err));
  }, [date, serviceType]);

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
    if (value === SUNDAY_MAIN_SERVICE.name) {
      setStartTime(SUNDAY_MAIN_SERVICE.startTime);
      setEndTime(SUNDAY_MAIN_SERVICE.endTime);
    } else {
      const cs = customServices.find((s: any) => s.name === value);
      if (cs) {
        setStartTime(cs.startTime);
        setEndTime(cs.endTime);
      }
    }
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const membersData = await api.members.getAll();
        const activeMembers = membersData?.filter((m: Member) => m.status !== 'blacklisted' && m.status !== 'not baptised') || [];
        setMembers(activeMembers);
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Filter members based on search and zone
  const filteredMembers = members.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.zoneNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'all' || member.zone === selectedZone;
    const matchesUnmarked = !showOnlyUnmarked || !presentIds.has(member.id);
    
    return matchesSearch && matchesZone && matchesUnmarked;
  });

  // Enter key = instant mark
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredMembers.length === 1) {
      toggleMember(filteredMembers[0].id);
      setSearchTerm('');
    }
  };

  const handleReviewAbsentees = async () => {
    if (!attendanceRecordId) {
      toast.error('Attendance session not ready yet.');
      return;
    }

    setIsLoading(true);

    const allAbsentIds = members
      .filter(m => !presentIds.has(m.id))
      .map(m => m.id);

    try {
      // Finalize the session — updates total_count and sets status to 'finalized'
      await api.attendance.finalize(attendanceRecordId);
      toast.success(`Attendance finalized! ${presentIds.size} present.`);
      // Notify all other devices to transition to absentee review
      broadcastFinalized(presentIds.size, allAbsentIds);
    } catch (err) {
      console.error('Failed to finalize session:', err);
      toast.error(getFriendlyMessage(err));
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    if (allAbsentIds.length > 0) {
      setSavedRecordId(attendanceRecordId);
      setSavedAbsentMemberIds(allAbsentIds);
      setPhase('absentee-review');
    } else {
      toast.info('No absentees to review!');
      onSave({
        date,
        serviceType,
        startTime,
        endTime,
        presentMembers: Array.from(presentIds),
        absentMembers: [],
        totalPresent: presentIds.size
      });
    }
  };

  // Calculate stats
  const totalPresent = presentIds.size;
  const totalAbsent = members.length - presentIds.size;
  const totalUnmarked = totalAbsent;

  const getStatusColor = (status: 'present' | 'absent' | 'unmarked') => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const zones = Object.keys(ZONES) as Array<keyof typeof ZONES>;

  const handleAbsenteeComplete = () => {
    onSave({
      date,
      serviceType,
      startTime,
      endTime,
      presentMembers: Array.from(presentIds),
      absentMembers: members.filter(m => !presentIds.has(m.id)).map(m => m.id),
      totalPresent: presentIds.size
    });
  };

  // Show absentee review phase after attendance is saved
  if (phase === 'absentee-review' && savedRecordId) {
    return (
      <AbsenteeReview
        attendanceRecordId={savedRecordId}
        absentMemberIds={savedAbsentMemberIds}
        allMembers={members}
        serviceDate={date}
        onComplete={handleAbsenteeComplete}
        onSkip={handleAbsenteeComplete}
        isSessionCreator={user?.id === sessionCreatorId}
        onBack={() => setPhase('marking')}
        sessionCreatorName={sessionCreatorName}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2">
              Mark Attendance
              <Badge className="bg-green-600 text-white text-[10px]">LIVE</Badge>
            </h1>
            <p className="text-muted-foreground text-sm">
              Session by <strong>{sessionCreatorName || 'Loading...'}</strong>
            </p>
          </div>
        </div>
        {user?.id === sessionCreatorId && (
          <Button variant="destructive" size="sm" onClick={handleCancelSession}>
            Cancel Session
          </Button>
        )}
      </div>

      {/* Service Information */}
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
            
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
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
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-sm text-muted-foreground">Total Members</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-10"
                />
              </div>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      Zone {zone} - {ZONES[zone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showOnlyUnmarked"
                  checked={showOnlyUnmarked}
                  onCheckedChange={(checked: boolean) => setShowOnlyUnmarked(checked)}
                />
                <Label htmlFor="showOnlyUnmarked" className="text-sm">Show only unmarked</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Members ({filteredMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredMembers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No members found matching your filters.
                </AlertDescription>
              </Alert>
            ) : (
              filteredMembers.map((member) => {
                const isPresent = presentIds.has(member.id);
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {member.firstName[0]}{member.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="font-medium truncate">
                          {member.firstName} {member.otherNames} {member.lastName}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                          <span>{member.zoneNumber} - Zone {member.zone}</span>
                          <span>•</span>
                          <span>{member.phone}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`hidden sm:flex ${isPresent ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {isPresent && <Check className="w-3 h-3 mr-1" />}
                        {isPresent ? 'Present' : 'Not Present'}
                      </Badge>
                      
                      <Button
                        variant={isPresent ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMember(member.id)}
                        className={isPresent ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {isPresent ? <Check className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Absentees */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Alert className="flex-1 min-w-0">
              <AlertDescription>
                <strong>Summary:</strong> {totalPresent} present, {totalAbsent} not present out of {members.length} total members.
              </AlertDescription>
            </Alert>
            
            {user?.id === sessionCreatorId ? (
              <Button
                onClick={handleReviewAbsentees}
                disabled={!isReady || isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? 'Finalizing...' : 'Finalize & Review Absentees'}
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs whitespace-nowrap py-2 px-3">
                Session initiator will finalize
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}