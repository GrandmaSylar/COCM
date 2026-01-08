import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Calendar, User, FileText, Users, CreditCard, Church, CheckCircle, ExternalLink } from 'lucide-react';
import { Member, ZONES } from './Members';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface MemberProfileProps {
  member: Member;
  onBack: () => void;
  onEdit: (member: Member) => void;
}

export function MemberProfile({ member, onBack, onEdit }: MemberProfileProps) {
  const { canAccess } = useAuth();
  const canEdit = canAccess('edit_members');
  const [attendanceStats, setAttendanceStats] = useState({
    thisMonth: 0,
    totalServices: 0,
    percentage: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await api.members.getAnalytics(member.id);
        setAttendanceStats(data.attendanceStats || {
          thisMonth: 0,
          totalServices: 0,
          percentage: 0
        });
        setRecentActivity(data.recentActivity || []);
      } catch (error) {
        console.error('Failed to fetch member analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [member.id]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>{member.firstName} {member.lastName}</h1>
            <p className="text-muted-foreground">Member Profile</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => onEdit(member)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center lg:justify-start mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                  {member.photo ? (
                    <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-medium text-primary">
                      {member.firstName[0]}{member.lastName[0]}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p>{member.firstName} {member.otherNames && `${member.otherNames} `}{member.lastName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <p className="capitalize">{member.gender}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Age</label>
                  <p>{calculateAge(member.dateOfBirth)} years old</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div>
                    <Badge
                      variant={member.status === 'active' ? 'default' : 'secondary'}
                      className={member.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {member.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p>{formatDate(member.dateOfBirth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Join Date</label>
                  <p>{formatDate(member.joinDate)}</p>
                </div>
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

          {/* Family Information */}
          {member.familyMembers && member.familyMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Family Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {member.familyMembers.map((familyMember) => (
                    <div key={familyMember.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {familyMember.firstName} {familyMember.otherNames && `${familyMember.otherNames} `}{familyMember.lastName}
                          </p>
                          {familyMember.isLinked && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Linked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{familyMember.relationship}</p>
                        {familyMember.phone && (
                          <p className="text-sm text-muted-foreground">{familyMember.phone}</p>
                        )}
                      </div>
                      {familyMember.isLinked && (
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{attendanceStats.percentage}%</div>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Attended</span>
                  <span>{attendanceStats.thisMonth}/{attendanceStats.totalServices}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${attendanceStats.percentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
