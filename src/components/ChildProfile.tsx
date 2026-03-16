import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ChildMember } from './Children';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2, UserCheck, Phone, MapPin, Calendar, User, Users, CheckCircle2, XCircle, BarChart3, ExternalLink } from 'lucide-react';
import { getCloudinaryUrl } from '../utils/cloudinary';

interface ChildProfileProps {
  child: ChildMember;
  onBack: () => void;
  onEdit: (child: ChildMember) => void;
  onDelete: (child: ChildMember) => void;
  onPromoteToMember: (child: ChildMember) => void;
  onViewMember: (memberId: string) => void;
}

export function ChildProfile({ child: initialChild, onBack, onEdit, onDelete, onPromoteToMember, onViewMember }: ChildProfileProps) {
  const { canAccess } = useAuth();
  const [child, setChild] = useState<ChildMember>(initialChild);
  const [attendanceData, setAttendanceData] = useState<{
    summary: { totalServices: number; totalPresent: number; totalAbsent: number; percentage: number };
    records: Array<{ date: string; serviceType: string; status: 'present' | 'absent' }>;
  } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setAttendanceLoading(true);
      try {
        // Fetch full child data to ensure edits are reflected
        const fullChild = await api.children.members.getById(initialChild.id);
        if (fullChild) {
          setChild(fullChild);
        }

        const result = await api.children.members.getAttendanceHistory(initialChild.id);
        setAttendanceData(result);
      } catch (error) {
        toast.error('Failed to load profile data');
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchData();
  }, [initialChild.id]);

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRelationshipLabel = (rel: string) => {
    if (rel === 'mother') return 'Mother';
    if (rel === 'father') return 'Father';
    if (rel === 'guardian') return 'Guardian';
    return rel.charAt(0).toUpperCase() + rel.slice(1);
  };

  const statusColorMap: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  };

  const serviceTypeLabels: Record<string, string> = {
    sunday_morning: 'Sunday Main Service',
    sunday_evening: 'Sunday Evening',
    midweek: 'Midweek Service',
    special: 'Special Service',
    other: 'Other'
  };

  const serviceTypeColors: Record<string, string> = {
    sunday_morning: 'bg-blue-100 text-blue-800',
    sunday_evening: 'bg-purple-100 text-purple-800',
    midweek: 'bg-green-100 text-green-800',
    special: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-secondary/15 via-secondary/5 to-transparent p-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-white/50 dark:hover:bg-black/20">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Child Profile</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white dark:bg-card rounded-full flex items-center justify-center overflow-hidden shadow-lg ring-4 ring-white/50 dark:ring-card/50 shrink-0">
              {child.photo ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <img src={getCloudinaryUrl(child.photo, 'avatar') ?? ''} alt={`${child.firstName} ${child.lastName}`} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <DialogTitle className="sr-only">Profile Picture</DialogTitle>
                    <DialogDescription className="sr-only">Full size profile picture of {child.firstName} {child.lastName}</DialogDescription>
                    <img src={getCloudinaryUrl(child.photo, 'original') ?? ''} alt={`${child.firstName} ${child.lastName}`} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                  </DialogContent>
                </Dialog>
              ) : (
                <span className="text-5xl font-semibold text-primary">
                  {child.firstName[0]}{child.lastName[0]}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{child.firstName} {child.otherNames && `${child.otherNames} `}{child.lastName}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <Badge className={statusColorMap[child.status] || ''}>
                  {child.status}
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">{child.gender}</span>
                <span className="text-sm text-muted-foreground">&middot;</span>
                <span className="text-sm text-muted-foreground">{calculateAge(child.dateOfBirth)} yrs</span>
                <span className="text-sm text-muted-foreground">&middot;</span>
                <span className="text-sm text-muted-foreground">Joined {new Date(child.joinDate).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {canAccess('edit_members') && (
                  <Button size="sm" onClick={() => onEdit(child)}>
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
                {canAccess('manage_members') && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onPromoteToMember(child)}>
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Promote to Main Member
                  </Button>
                )}
                {canAccess('delete_members') && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attendance">Attendance History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-muted-foreground" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                    <p>{new Date(child.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Age</label>
                    <p>{calculateAge(child.dateOfBirth)} years</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <p className="capitalize">{child.gender}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {child.phone || '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Residence location</label>
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {child.residenceLocation || '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Joined</label>
                    <p className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {new Date(child.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  Parents / Guardians
                </h3>
                <div className="space-y-4">
                  {child.parents && child.parents.length > 0 ? (
                    child.parents.map(parent => (
                      <div key={parent.id} className="p-4 border rounded-lg bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{parent.firstName} {parent.lastName}</h4>
                            <Badge variant="outline" className="text-xs uppercase hidden sm:inline-flex">
                              {getRelationshipLabel(parent.relationship)}
                            </Badge>
                          </div>
                          <Badge variant="outline" className="text-xs uppercase sm:hidden mb-2">
                            {getRelationshipLabel(parent.relationship)}
                          </Badge>
                          <p className="text-sm flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {parent.phone}
                          </p>
                        </div>
                        <div>
                          {parent.isLinked && parent.linkedMemberId ? (
                            <Badge 
                              variant="secondary" 
                              className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer gap-1"
                              onClick={() => onViewMember(parent.linkedMemberId!)}
                            >
                              Linked Member
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not linked</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No parents or guardians recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <Card className="min-w-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{attendanceData?.summary.totalServices || 0}</p>
                    <p className="text-xs text-muted-foreground truncate">Total Services</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{attendanceData?.summary.totalPresent || 0}</p>
                    <p className="text-xs text-muted-foreground truncate">Present</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{attendanceData?.summary.totalAbsent || 0}</p>
                    <p className="text-xs text-muted-foreground truncate">Absent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{attendanceData?.summary.percentage || 0}%</p>
                    <p className="text-xs text-muted-foreground truncate">Attendance Rate</p>
                  </div>
                </div>
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(attendanceData?.summary.percentage || 0, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Records</h3>
            {attendanceLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : attendanceData?.records.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No attendance records found for this child.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {attendanceData?.records.map((record, index) => (
                  <Card key={`${record.date}-${record.serviceType}-${index}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {record.status === 'present' ? (
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <XCircle className="w-4 h-4 text-red-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{formatDate(record.date)}</p>
                          <Badge className={`text-xs mt-1 ${serviceTypeColors[record.serviceType] || 'bg-gray-100 text-gray-800'}`}>
                            {serviceTypeLabels[record.serviceType] || record.serviceType}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant={record.status === 'present' ? 'default' : 'destructive'}>
                        {record.status === 'present' ? 'Present' : 'Absent'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Child Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {child.firstName} {child.lastName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setDeleteDialogOpen(false);
                onDelete(child);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
