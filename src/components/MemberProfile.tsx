import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Calendar, User, FileText, Users, CreditCard, Church, CheckCircle, ExternalLink } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Member, ZONES } from './Members';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { toast } from 'sonner';

interface MemberProfileProps {
  member: Member;
  onBack: () => void;
  onEdit: (member: Member) => void;
  onDelete?: (member: Member) => void;
  onViewMember?: (memberId: string) => void;
  onViewAttendanceHistory?: () => void;
}

export function MemberProfile({ member: initialMember, onBack, onEdit, onDelete, onViewMember, onViewAttendanceHistory }: MemberProfileProps) {
  const { canAccess } = useAuth();
  const canEdit = canAccess('edit_members');
  const canDelete = canAccess('delete_members');

  // State for complete member data (including family members)
  const [member, setMember] = useState<Member>(initialMember);
  const [attendanceStats, setAttendanceStats] = useState({
    thisMonth: 0,
    totalServices: 0,
    percentage: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        // Fetch complete member data including family members
        const fullMember = await api.members.getById(initialMember.id);
        if (fullMember) {
          setMember(fullMember);
        }

        // Also fetch analytics
        const data = await api.members.getAnalytics(initialMember.id);
        setAttendanceStats(data.attendanceStats || {
          thisMonth: 0,
          totalServices: 0,
          percentage: 0
        });
        setRecentActivity(data.recentActivity || []);
      } catch (error) {
        console.error('Failed to fetch member data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [initialMember.id]);

  // Calculate age
  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format baptism date based on type
  const formatBaptismDate = () => {
    if (!member.baptismInfo) return 'Not recorded';
    
    const { dateType, fullDate, month, year } = member.baptismInfo;
    
    if (dateType === 'full' && fullDate) {
      return formatDate(fullDate);
    } else if (dateType === 'monthYear' && month && year) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    } else if (dateType === 'yearOnly' && year) {
      return year;
    }
    
    return 'Not recorded';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Info Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center lg:justify-start mb-6">
                  <Skeleton className="w-20 h-20 rounded-full" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact Info Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-5 h-5" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Skeleton */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const statusColorMap: Record<string, string> = {
    new: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'semi-active': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    sabbatical: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    blacklisted: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-secondary/15 via-secondary/5 to-transparent p-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-white/50 dark:hover:bg-black/20">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Member Profile</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-24 h-24 bg-white dark:bg-card rounded-full flex items-center justify-center overflow-hidden shadow-lg ring-4 ring-white/50 dark:ring-card/50 shrink-0">
              {member.photo ? (
                <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-primary">
                  {member.firstName[0]}{member.lastName[0]}
                </span>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{member.firstName} {member.otherNames && `${member.otherNames} `}{member.lastName}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <Badge className={statusColorMap[member.status] || ''}>
                  {member.status === 'sabbatical' && member.sabbaticalEndDate && new Date(member.sabbaticalEndDate) < new Date() ? 'Sabbatical (Ended)' : member.status}
                </Badge>
                <span className="text-sm text-muted-foreground">Zone {member.zone}</span>
                <span className="text-sm text-muted-foreground">&middot;</span>
                <span className="text-sm text-muted-foreground capitalize">{member.gender}</span>
                <span className="text-sm text-muted-foreground">&middot;</span>
                <span className="text-sm text-muted-foreground">{calculateAge(member.dateOfBirth)} yrs</span>
              </div>
              <div className="flex gap-2 mt-3 justify-center sm:justify-start">
                {canEdit && (
                  <Button size="sm" onClick={() => onEdit(member)}>
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
                {canDelete && onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${member.firstName} ${member.lastName}? This action cannot be undone.`)) {
                        onDelete(member);
                      }
                    }}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Member Information */}
        <div className="md:col-span-2 space-y-4 md:space-y-6 stagger-children">
          {/* Basic Info Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p>{member.firstName} {member.otherNames && `${member.otherNames} `}{member.lastName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <p className="capitalize">{member.gender}</p>
                </div>
                {member.maritalStatus && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Marital Status</label>
                    <p className="capitalize">{member.maritalStatus}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Age</label>
                  <p>{calculateAge(member.dateOfBirth)} years old</p>
                </div>
                {member.status === 'sabbatical' && (
                  <div className="col-span-full p-3 border rounded-lg bg-purple-50/50 space-y-2">
                    <label className="text-sm font-medium text-purple-800">Sabbatical Details</label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {member.sabbaticalStartDate && (
                        <div>
                          <span className="text-muted-foreground">Start: </span>
                          {new Date(member.sabbaticalStartDate).toLocaleDateString()}
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">End: </span>
                        {member.sabbaticalEndDate
                          ? new Date(member.sabbaticalEndDate).toLocaleDateString()
                          : 'Until further notice'}
                      </div>
                      {member.sabbaticalReason && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Reason: </span>
                          {member.sabbaticalReason}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            await api.members.endSabbatical(member.id);
                            const updated = await api.members.getById(member.id);
                            if (updated) {
                              setMember(updated);
                            }
                            toast.success('Sabbatical ended. Status will be recalculated based on attendance.');
                          } catch (error: any) {
                            console.error('Failed to end sabbatical:', error);
                            toast.error(error?.message || 'Failed to end sabbatical');
                          }
                        }}
                      >
                        End Sabbatical
                      </Button>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p>{formatDate(member.dateOfBirth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Join Date</label>
                  <p>{formatDate(member.joinDate)}</p>
                </div>
                {member.occupation && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Occupation</label>
                    <p>{member.occupation}</p>
                  </div>
                )}
                {member.hometown && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Hometown</label>
                    <p>{member.hometown}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{member.phone}</p>
                  <p className="text-sm text-muted-foreground">Primary Phone</p>
                </div>
              </div>
              {member.secondPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{member.secondPhone}</p>
                    <p className="text-sm text-muted-foreground">Secondary Phone</p>
                  </div>
                </div>
              )}
              {member.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{member.email}</p>
                    <p className="text-sm text-muted-foreground">Email Address</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Residence</label>
                <p>{member.residenceLocation}</p>
              </div>
              {member.digitalAddress && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Digital Address</label>
                  <p>{member.digitalAddress}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Zone</label>
                <p>{member.zoneNumber} - Zone {member.zone} ({ZONES[member.zone]})</p>
              </div>
            </CardContent>
          </Card>

          {/* Baptism Information */}
          {member.baptismInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Church className="w-5 h-5" />
                  Baptism Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Baptism Date</label>
                    <p>{formatBaptismDate()}</p>
                  </div>
                  {member.baptismInfo.previousCongregation && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Previous Congregation</label>
                      <p>{member.baptismInfo.previousCongregation}</p>
                    </div>
                  )}
                  {member.baptismInfo.roleInPreviousCongregation && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Role in Previous Congregation</label>
                      <p>{member.baptismInfo.roleInPreviousCongregation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ministries */}
          {member.ministries && member.ministries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Ministries & Groups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {member.ministries.map((ministry) => (
                    <Badge key={ministry} variant="secondary">
                      {ministry}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Family Tree */}
          {member.familyMembers && member.familyMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Family Tree
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Visual Family Tree */}
                <div className="relative py-4 sm:py-6 overflow-x-auto">
                  {/* Parents Row */}
                  {member.familyMembers.filter(f => f.relationship === 'father' || f.relationship === 'mother').length > 0 && (
                    <div className="flex justify-center gap-4 sm:gap-8 mb-4">
                      {member.familyMembers
                        .filter(f => f.relationship === 'father' || f.relationship === 'mother')
                        .map((parent) => (
                          <div
                            key={parent.id}
                            className={`text-center ${parent.isLinked && onViewMember ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            onClick={() => parent.isLinked && parent.linkedMemberId && onViewMember?.(parent.linkedMemberId)}
                          >
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
                              parent.relationship === 'father' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-pink-100 dark:bg-pink-900'
                            } ${parent.isLinked ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                              <span className={`text-lg font-medium ${
                                parent.relationship === 'father' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'
                              }`}>
                                {parent.firstName[0]}{parent.lastName[0]}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{parent.firstName} {parent.lastName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{parent.relationship}</p>
                            {parent.isLinked && (
                              <Badge variant="secondary" className="gap-1 mt-1 text-xs cursor-pointer">
                                <CheckCircle className="w-2 h-2" />
                                View Profile
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Connector line from parents to member */}
                  {member.familyMembers.filter(f => f.relationship === 'father' || f.relationship === 'mother').length > 0 && (
                    <div className="flex justify-center mb-4">
                      <div className="w-0.5 h-8 bg-border"></div>
                    </div>
                  )}

                  {/* Member Row (with spouse and siblings) */}
                  <div className="flex justify-center items-center gap-4 mb-4">
                    {/* Siblings on the left */}
                    {member.familyMembers.filter(f => f.relationship === 'sibling').map((sibling) => (
                      <div
                        key={sibling.id}
                        className={`text-center ${sibling.isLinked && onViewMember ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        onClick={() => sibling.isLinked && sibling.linkedMemberId && onViewMember?.(sibling.linkedMemberId)}
                      >
                        <div className={`w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-1 ${sibling.isLinked ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {sibling.firstName[0]}{sibling.lastName[0]}
                          </span>
                        </div>
                        <p className="text-xs font-medium">{sibling.firstName}</p>
                        <p className="text-xs text-muted-foreground">Sibling</p>
                        {sibling.isLinked && (
                          <Badge variant="secondary" className="gap-1 mt-1 text-xs">
                            <CheckCircle className="w-2 h-2" />
                          </Badge>
                        )}
                      </div>
                    ))}

                    {/* Connector line to sibling */}
                    {member.familyMembers.filter(f => f.relationship === 'sibling').length > 0 && (
                      <div className="h-0.5 w-4 bg-border"></div>
                    )}

                    {/* The Member */}
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-primary flex items-center justify-center mx-auto mb-2">
                        {member.photo ? (
                          <img src={member.photo} alt={member.firstName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-primary">
                            {member.firstName[0]}{member.lastName[0]}
                          </span>
                        )}
                      </div>
                      <p className="font-medium">{member.firstName} {member.lastName}</p>
                      <Badge className="mt-1">This Member</Badge>
                    </div>

                    {/* Connector line to spouse */}
                    {member.familyMembers.filter(f => f.relationship === 'spouse').length > 0 && (
                      <>
                        <div className="h-0.5 w-8 bg-red-400"></div>
                        <span className="text-red-400 text-xs">married</span>
                        <div className="h-0.5 w-8 bg-red-400"></div>
                      </>
                    )}

                    {/* Spouse */}
                    {member.familyMembers
                      .filter(f => f.relationship === 'spouse')
                      .map((spouse) => (
                        <div
                          key={spouse.id}
                          className={`text-center ${spouse.isLinked && onViewMember ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                          onClick={() => spouse.isLinked && spouse.linkedMemberId && onViewMember?.(spouse.linkedMemberId)}
                        >
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
                            member.gender === 'male' ? 'bg-pink-100 dark:bg-pink-900' : 'bg-blue-100 dark:bg-blue-900'
                          } ${spouse.isLinked ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                            <span className={`text-lg font-medium ${
                              member.gender === 'male' ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {spouse.firstName[0]}{spouse.lastName[0]}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{spouse.firstName} {spouse.lastName}</p>
                          <p className="text-xs text-muted-foreground">Spouse</p>
                          {spouse.isLinked && (
                            <Badge variant="secondary" className="gap-1 mt-1 text-xs cursor-pointer">
                              <CheckCircle className="w-2 h-2" />
                              View Profile
                            </Badge>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Connector line to children */}
                  {member.familyMembers.filter(f => f.relationship === 'child').length > 0 && (
                    <div className="flex justify-center mb-4">
                      <div className="w-0.5 h-8 bg-border"></div>
                    </div>
                  )}

                  {/* Children Row */}
                  {member.familyMembers.filter(f => f.relationship === 'child').length > 0 && (
                    <div className="flex justify-center gap-3 sm:gap-6 flex-wrap">
                      {member.familyMembers
                        .filter(f => f.relationship === 'child')
                        .map((child) => (
                          <div
                            key={child.id}
                            className={`text-center ${child.isLinked && onViewMember ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            onClick={() => child.isLinked && child.linkedMemberId && onViewMember?.(child.linkedMemberId)}
                          >
                            <div className={`w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-1 ${child.isLinked ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                {child.firstName[0]}{child.lastName[0]}
                              </span>
                            </div>
                            <p className="text-xs font-medium">{child.firstName}</p>
                            <p className="text-xs text-muted-foreground">Child</p>
                            {child.isLinked && (
                              <Badge variant="secondary" className="gap-1 mt-1 text-xs cursor-pointer">
                                <CheckCircle className="w-2 h-2" />
                                View
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Detailed Family Members List */}
                <Separator className="my-6" />
                <h4 className="text-sm font-medium mb-3">Family Details</h4>
                <div className="space-y-3">
                  {member.familyMembers.map((familyMember) => (
                    <div
                      key={familyMember.id}
                      className={`flex items-start justify-between p-3 border rounded-lg ${familyMember.isLinked && onViewMember ? 'hover:bg-muted/50 transition-colors' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {familyMember.firstName} {familyMember.otherNames && `${familyMember.otherNames} `}{familyMember.lastName}
                          </p>
                          {familyMember.isLinked && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Church Member
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{familyMember.relationship}</p>
                        {familyMember.phone && (
                          <p className="text-sm text-muted-foreground">{familyMember.phone}</p>
                        )}
                        {familyMember.occupation && (
                          <p className="text-sm text-muted-foreground">Occupation: {familyMember.occupation}</p>
                        )}
                        {familyMember.hometown && (
                          <p className="text-sm text-muted-foreground">Hometown: {familyMember.hometown}</p>
                        )}
                      </div>
                      {familyMember.isLinked && familyMember.linkedMemberId && onViewMember && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewMember(familyMember.linkedMemberId!)}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View Profile
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legal Information */}
          {member.legalInfo && (member.legalInfo.ghanaCardNumber || member.legalInfo.alternativeIdNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Legal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {member.legalInfo.ghanaCardNumber && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Ghana Card Number</label>
                      <p>{member.legalInfo.ghanaCardNumber}</p>
                    </div>
                    {member.legalInfo.ghanaCardExpiryDate && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                        <p>{formatDate(member.legalInfo.ghanaCardExpiryDate)}</p>
                      </div>
                    )}
                  </div>
                )}
                {member.legalInfo.alternativeIdNumber && (
                  <>
                    {member.legalInfo.ghanaCardNumber && <Separator className="my-4" />}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Alternative ID Type</label>
                        <p className="capitalize">{member.legalInfo.alternativeIdType || 'Other'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">ID Number</label>
                        <p>{member.legalInfo.alternativeIdNumber}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {member.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{member.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats and Activity Sidebar */}
        <div className="space-y-6">
          {/* Attendance Stats */}
          <Card
            className={`shadow-sm ${onViewAttendanceHistory ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group' : ''}`}
            onClick={onViewAttendanceHistory}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Attendance
                </span>
                {onViewAttendanceHistory && (
                  <span className="text-xs text-muted-foreground font-normal group-hover:text-primary transition-colors">
                    View History →
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                      className={attendanceStats.percentage >= 75 ? 'text-emerald-500' : attendanceStats.percentage >= 50 ? 'text-amber-500' : 'text-red-500'}
                      strokeDasharray={`${attendanceStats.percentage * 2.64} ${264 - attendanceStats.percentage * 2.64}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{attendanceStats.percentage}%</span>
                    <span className="text-[10px] text-muted-foreground">This Month</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {attendanceStats.thisMonth} of {attendanceStats.totalServices} services attended
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-2 bg-secondary shrink-0" />
                      <div>
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
