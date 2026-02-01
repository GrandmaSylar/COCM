import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Search, Users, ArrowLeft, Save, SkipForward } from 'lucide-react';
import { Member, ZONES } from './Members';
import { api } from '../services/api';
import { toast } from 'sonner';

interface AbsenteeInfo {
  memberId: string;
  requestedPermission: boolean;
  reason: string;
  reasonNotes: string;
  absenceStartDate: string;
  absenceEndDate: string;
  untilFurtherNotice: boolean;
}

interface AbsenteeReviewProps {
  attendanceRecordId: string;
  absentMemberIds: string[];
  allMembers: Member[];
  serviceDate: string;
  onComplete: () => void;
  onSkip: () => void;
}

const ABSENCE_REASONS = ['Sick', 'Travel', 'Work', 'Family Emergency', 'Other'];

export function AbsenteeReview({
  attendanceRecordId,
  absentMemberIds,
  allMembers,
  serviceDate,
  onComplete,
  onSkip,
}: AbsenteeReviewProps) {
  const [absentees, setAbsentees] = useState<Array<Member & { absenteeInfo?: any }>>([]);
  const [absenteeData, setAbsenteeData] = useState<Record<string, AbsenteeInfo>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAbsentees, setIsLoadingAbsentees] = useState(true);

  useEffect(() => {
    const fetchAbsentees = async () => {
      try {
        const data = await api.attendance.getAbsentees(attendanceRecordId);
        setAbsentees(data || []);

        // Initialize absentee data from server data
        const initialData: Record<string, AbsenteeInfo> = {};
        for (const absentee of (data || [])) {
          initialData[absentee.id] = {
            memberId: absentee.id,
            requestedPermission: absentee.absenteeInfo?.requestedPermission || false,
            reason: absentee.absenteeInfo?.reason || '',
            reasonNotes: absentee.absenteeInfo?.reasonNotes || '',
            absenceStartDate: absentee.absenteeInfo?.absenceStartDate || serviceDate,
            absenceEndDate: absentee.absenteeInfo?.absenceEndDate || '',
            untilFurtherNotice: absentee.absenteeInfo?.untilFurtherNotice || false,
          };
        }
        setAbsenteeData(initialData);
      } catch (error) {
        console.error('Failed to fetch absentees:', error);
        // Fallback: build from local data
        const absentMembers = allMembers.filter(m => absentMemberIds.includes(m.id));
        setAbsentees(absentMembers);
        const initialData: Record<string, AbsenteeInfo> = {};
        for (const member of absentMembers) {
          initialData[member.id] = {
            memberId: member.id,
            requestedPermission: false,
            reason: '',
            reasonNotes: '',
            absenceStartDate: serviceDate,
            absenceEndDate: '',
            untilFurtherNotice: false,
          };
        }
        setAbsenteeData(initialData);
      } finally {
        setIsLoadingAbsentees(false);
      }
    };
    fetchAbsentees();
  }, [attendanceRecordId]);

  const updateAbsenteeField = (memberId: string, field: keyof AbsenteeInfo, value: any) => {
    setAbsenteeData(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      }
    }));
  };

  const filteredAbsentees = absentees.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName} ${member.otherNames || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.zoneNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'all' || member.zone === selectedZone;
    return matchesSearch && matchesZone;
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter to only records that have some data filled in
      const recordsToSave = Object.values(absenteeData).filter(
        r => r.requestedPermission || r.reason || r.reasonNotes
      );

      if (recordsToSave.length > 0) {
        await api.attendance.saveAbsentees(attendanceRecordId, recordsToSave);
        toast.success(`Absentee information saved for ${recordsToSave.length} member(s).`);
      } else {
        toast.info('No absentee information to save.');
      }
      onComplete();
    } catch (error: any) {
      console.error('Failed to save absentee records:', error);
      toast.error(error?.message || 'Failed to save absentee information.');
    } finally {
      setIsSaving(false);
    }
  };

  const zones = Object.keys(ZONES) as Array<keyof typeof ZONES>;
  const withPermission = Object.values(absenteeData).filter(d => d.requestedPermission).length;

  if (isLoadingAbsentees) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading absentee list...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Absentee Review</h1>
        <p className="text-muted-foreground">
          Review absent members and record reasons for absence. You can skip this step if not needed.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{absentees.length}</div>
            <p className="text-sm text-muted-foreground">Total Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{withPermission}</div>
            <p className="text-sm text-muted-foreground">With Permission</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{absentees.length - withPermission}</div>
            <p className="text-sm text-muted-foreground">Without Permission</p>
          </CardContent>
        </Card>
      </div>

      {/* Search/Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search absent members..."
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
          </div>
        </CardContent>
      </Card>

      {/* Absentee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Absent Members ({filteredAbsentees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAbsentees.length === 0 ? (
              <Alert>
                <AlertDescription>No absent members found.</AlertDescription>
              </Alert>
            ) : (
              filteredAbsentees.map((member) => {
                const data = absenteeData[member.id];
                if (!data) return null;
                return (
                  <div key={member.id} className="p-4 border rounded-lg space-y-3">
                    {/* Member Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-red-600">
                          {member.firstName[0]}{member.lastName[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {member.firstName} {member.otherNames || ''} {member.lastName}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{member.zoneNumber} - Zone {member.zone}</span>
                          <span>|</span>
                          <span>{member.phone}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-red-100 text-red-800">Absent</Badge>
                    </div>

                    {/* Absentee Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-13">
                      <div className="flex items-center space-x-2 col-span-full">
                        <Checkbox
                          id={`permission-${member.id}`}
                          checked={data.requestedPermission}
                          onCheckedChange={(checked) =>
                            updateAbsenteeField(member.id, 'requestedPermission', !!checked)
                          }
                        />
                        <Label htmlFor={`permission-${member.id}`} className="text-sm">
                          Requested Permission to be Absent
                        </Label>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Reason</Label>
                        <Select
                          value={data.reason}
                          onValueChange={(val) => updateAbsenteeField(member.id, 'reason', val)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {ABSENCE_REASONS.map((reason) => (
                              <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <Input
                          value={data.reasonNotes}
                          onChange={(e) => updateAbsenteeField(member.id, 'reasonNotes', e.target.value)}
                          placeholder="Additional notes..."
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Absence Start Date</Label>
                        <Input
                          type="date"
                          value={data.absenceStartDate}
                          onChange={(e) => updateAbsenteeField(member.id, 'absenceStartDate', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      {!data.untilFurtherNotice && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Absence End Date</Label>
                          <Input
                            type="date"
                            value={data.absenceEndDate}
                            onChange={(e) => updateAbsenteeField(member.id, 'absenceEndDate', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`ufn-${member.id}`}
                          checked={data.untilFurtherNotice}
                          onCheckedChange={(checked) => {
                            updateAbsenteeField(member.id, 'untilFurtherNotice', !!checked);
                            if (checked) {
                              updateAbsenteeField(member.id, 'absenceEndDate', '');
                            }
                          }}
                        />
                        <Label htmlFor={`ufn-${member.id}`} className="text-sm">
                          Until further notice
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Alert className="flex-1">
              <AlertDescription>
                <strong>{absentees.length}</strong> absent members. <strong>{withPermission}</strong> with permission recorded.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onSkip} className="flex-1 sm:flex-none">
                <SkipForward className="w-4 h-4 mr-2" />
                Skip
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Absentee Info'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
