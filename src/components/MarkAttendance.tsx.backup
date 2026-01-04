import { useState, useEffect } from 'react';
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
}

// Mock members - in real app this would come from the main members database
const mockMembers: Member[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    otherNames: 'Michael',
    email: 'john.doe@example.com',
    phone: '+233 24 123 4567',
    gender: 'male',
    dateOfBirth: '1990-01-15',
    residenceLocation: 'East Legon',
    zone: 'M',
    zoneNumber: 'M15',
    notes: '',
    status: 'active',
    joinDate: '2023-01-15'
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    otherNames: 'Grace',
    email: 'jane.smith@example.com',
    phone: '+233 20 987 6543',
    gender: 'female',
    dateOfBirth: '1985-03-22',
    residenceLocation: 'Dansoman',
    zone: 'B',
    zoneNumber: 'B08',
    notes: '',
    status: 'active',
    joinDate: '2023-02-01'
  },
  {
    id: '3',
    firstName: 'Emmanuel',
    lastName: 'Asante',
    otherNames: 'Kwame',
    email: 'emmanuel.asante@example.com',
    phone: '+233 54 234 5678',
    gender: 'male',
    dateOfBirth: '1992-07-10',
    residenceLocation: 'Kasoa',
    zone: 'K',
    zoneNumber: 'K12',
    notes: '',
    status: 'semi-active',
    joinDate: '2023-03-10'
  }
];

const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

export function MarkAttendance({ onBack, onSave }: MarkAttendanceProps) {
  const [serviceType, setServiceType] = useState('Sunday Main Service');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');
  const [members] = useState<Member[]>(mockMembers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'present' | 'absent' | 'unmarked'>>({});
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();

  // Filter members based on search and zone
  const filteredMembers = members.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.zoneNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'all' || member.zone === selectedZone;
    const matchesUnmarked = !showOnlyUnmarked || attendanceStatus[member.id] === 'unmarked' || !attendanceStatus[member.id];
    
    return matchesSearch && matchesZone && matchesUnmarked;
  });

  // Initialize attendance status for all members
  useEffect(() => {
    const initialStatus: Record<string, 'present' | 'absent' | 'unmarked'> = {};
    members.forEach(member => {
      initialStatus[member.id] = 'unmarked';
    });
    setAttendanceStatus(initialStatus);
  }, [members]);

  const handleAttendanceToggle = (memberId: string, status: 'present' | 'absent') => {
    setAttendanceStatus(prev => ({
      ...prev,
      [memberId]: prev[memberId] === status ? 'unmarked' : status
    }));
  };

  const handleMarkAllPresent = () => {
    const newStatus = { ...attendanceStatus };
    filteredMembers.forEach(member => {
      newStatus[member.id] = 'present';
    });
    setAttendanceStatus(newStatus);
  };

  const handleMarkAllAbsent = () => {
    const newStatus = { ...attendanceStatus };
    filteredMembers.forEach(member => {
      newStatus[member.id] = 'absent';
    });
    setAttendanceStatus(newStatus);
  };

  const handleClearAll = () => {
    const newStatus = { ...attendanceStatus };
    filteredMembers.forEach(member => {
      newStatus[member.id] = 'unmarked';
    });
    setAttendanceStatus(newStatus);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const presentMembers = Object.entries(attendanceStatus)
      .filter(([_, status]) => status === 'present')
      .map(([memberId]) => memberId);
    
    const absentMembers = Object.entries(attendanceStatus)
      .filter(([_, status]) => status === 'absent')
      .map(([memberId]) => memberId);

    setIsLoading(true);
    
    setTimeout(() => {
      onSave({
        date,
        serviceType,
        startTime,
        endTime,
        presentMembers,
        absentMembers,
        totalPresent: presentMembers.length
      });
      setIsLoading(false);
    }, 1000);
  };

  // Calculate stats
  const totalMarked = Object.values(attendanceStatus).filter(status => status !== 'unmarked').length;
  const totalPresent = Object.values(attendanceStatus).filter(status => status === 'present').length;
  const totalAbsent = Object.values(attendanceStatus).filter(status => status === 'absent').length;
  const totalUnmarked = members.length - totalMarked;

  const getStatusColor = (status: 'present' | 'absent' | 'unmarked') => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const zones = Object.keys(ZONES) as Array<keyof typeof ZONES>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Mark Attendance</h1>
          <p className="text-muted-foreground">
            Mark individual members as present or absent
          </p>
        </div>
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
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                  {/* Add custom services here */}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  onCheckedChange={(checked) => setShowOnlyUnmarked(checked as boolean)}
                />
                <Label htmlFor="showOnlyUnmarked" className="text-sm">Show only unmarked</Label>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
                <UserCheck className="w-4 h-4 mr-2" />
                Mark All Present
              </Button>
              <Button variant="outline" size="sm" onClick={handleMarkAllAbsent}>
                <UserX className="w-4 h-4 mr-2" />
                Mark All Absent
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
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
                const status = attendanceStatus[member.id] || 'unmarked';
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {member.firstName[0]}{member.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {member.firstName} {member.otherNames} {member.lastName}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{member.zoneNumber} - Zone {member.zone}</span>
                          <span>•</span>
                          <span>{member.phone}</span>
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
                          onClick={() => handleAttendanceToggle(member.id, 'present')}
                          className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={status === 'absent' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleAttendanceToggle(member.id, 'absent')}
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

      {/* Submit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Alert className="flex-1">
              <AlertDescription>
                <strong>Summary:</strong> {totalPresent} present, {totalAbsent} absent, {totalUnmarked} unmarked out of {members.length} total members.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || totalMarked === 0}
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