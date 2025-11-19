import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Search, Plus, Phone, Mail, MapPin, Eye, Info, Users } from 'lucide-react';
import { useAuth } from './AuthContext';

export type Zone = 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
export type MemberStatus = 'active' | 'semi-active' | 'inactive' | 'sabbatical' | 'blacklisted';

// Member status definitions
export const MEMBER_STATUS_DEFINITIONS = {
  active: 'Mostly or always present on Sunday main services',
  'semi-active': 'Rarely present on Sunday Services (absent within less than a month)',
  inactive: 'Absent for more than a month without permission',
  sabbatical: 'Absent for a long period but with permission of absence',
  blacklisted: 'Sacked or removed'
} as const;

export type BaptismDateType = 'full' | 'monthYear' | 'yearOnly';

export interface BaptismInfo {
  dateType: BaptismDateType;
  fullDate?: string;
  month?: string;
  year?: string;
  previousCongregation?: string;
  roleInPreviousCongregation?: string;
}

export interface FamilyMember {
  id: string;
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  isLinked?: boolean;
  linkedMemberId?: string;
}

export interface LegalInfo {
  ghanaCardNumber?: string;
  ghanaCardExpiryDate?: string;
  alternativeIdType?: string;
  alternativeIdNumber?: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  otherNames: string;
  email?: string;
  phone: string;
  secondPhone?: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  residenceLocation: string;
  digitalAddress?: string;
  zone: Zone;
  zoneNumber: string; // e.g., "B23", "M15"
  notes: string;
  status: MemberStatus;
  joinDate: string;
  photo?: string; // Base64 encoded image or URL
  baptismInfo?: BaptismInfo;
  familyMembers?: FamilyMember[];
  legalInfo?: LegalInfo;
  ministries?: string[]; // Member can be in multiple ministries
}

export const ZONES = {
  A: 'Abossey Okai',
  B: 'Bubiashie', 
  F: 'Floating',
  K: 'Kasoa',
  M: 'Mataheko',
  R: 'Russia'
} as const;

export const MINISTRIES = [
  'Prayer Ministry',
  'Prophetic Ministry',
  'Visitation Ministry',
  'Welfare Ministry',
  'Evangelism Ministry',
  'Finance Ministry',
  'Health Ministry',
  'Youth Ministry',
  "Children's Ministry",
  'Marriage Ministry',
  'Worship Ministry',
  'Singing Ministry',
  'House-Keeping Ministry',
  'Security Ministry',
  'Education Ministry',
  'Ushering Ministry',
  'Men Fellowship',
  'Women Fellowship',
  'Project/Building Committee',
  'Scholarship Committee',
  'Business Support Fund Committee',
  'Zonal Leaders Committee',
  'Equipment & Machines',
  'Church Counsellors Committee'
] as const;

interface MembersProps {
  onAddMember: () => void;
  onViewMember: (member: Member) => void;
}

// Mock members with complete details and linked family relationships
const mockMembers: Member[] = [
  {
    id: '1',
    firstName: 'Kwame',
    lastName: 'Mensah',
    otherNames: 'Kofi',
    email: 'kwame.mensah@email.com',
    phone: '+233 24 123 4567',
    secondPhone: '+233 50 987 6543',
    gender: 'male',
    dateOfBirth: '1975-05-15',
    residenceLocation: 'House No. 12, Mataheko Junction',
    digitalAddress: 'GA-123-4567',
    zone: 'M',
    zoneNumber: 'M01',
    notes: 'Active member, serves in music ministry',
    status: 'active',
    joinDate: '2010-01-15',
    photo: '',
    baptismInfo: {
      dateType: 'full',
      fullDate: '2009-12-25',
      previousCongregation: 'Church of Christ, Tema',
      roleInPreviousCongregation: 'Song Leader'
    },
    familyMembers: [
      {
        id: 'fm1',
        relationship: 'spouse',
        firstName: 'Akua',
        lastName: 'Mensah',
        otherNames: 'Abena',
        phone: '+233 24 234 5678',
        isLinked: true,
        linkedMemberId: '2'
      },
      {
        id: 'fm2',
        relationship: 'child',
        firstName: 'Yaw',
        lastName: 'Mensah',
        otherNames: '',
        phone: '+233 55 111 2222',
        isLinked: true,
        linkedMemberId: '3'
      },
      {
        id: 'fm3',
        relationship: 'sibling',
        firstName: 'Kojo',
        lastName: 'Mensah',
        otherNames: '',
        phone: '+233 24 333 4444',
        isLinked: true,
        linkedMemberId: '4'
      }
    ],
    legalInfo: {
      ghanaCardNumber: 'GHA-123456789-1',
      ghanaCardExpiryDate: '2030-05-15',
      alternativeIdType: '',
      alternativeIdNumber: ''
    },
    ministries: ['Worship Ministry', 'Singing Ministry', 'Men Fellowship']
  },
  {
    id: '2',
    firstName: 'Akua',
    lastName: 'Mensah',
    otherNames: 'Abena',
    email: 'akua.mensah@email.com',
    phone: '+233 24 234 5678',
    secondPhone: '',
    gender: 'female',
    dateOfBirth: '1978-08-20',
    residenceLocation: 'House No. 12, Mataheko Junction',
    digitalAddress: 'GA-123-4567',
    zone: 'M',
    zoneNumber: 'M02',
    notes: 'Active in women\'s ministry',
    status: 'active',
    joinDate: '2010-01-15',
    photo: '',
    baptismInfo: {
      dateType: 'monthYear',
      month: '12',
      year: '2009',
      previousCongregation: '',
      roleInPreviousCongregation: ''
    },
    familyMembers: [
      {
        id: 'fm4',
        relationship: 'spouse',
        firstName: 'Kwame',
        lastName: 'Mensah',
        otherNames: 'Kofi',
        phone: '+233 24 123 4567',
        isLinked: true,
        linkedMemberId: '1'
      },
      {
        id: 'fm5',
        relationship: 'child',
        firstName: 'Yaw',
        lastName: 'Mensah',
        otherNames: '',
        phone: '+233 55 111 2222',
        isLinked: true,
        linkedMemberId: '3'
      },
      {
        id: 'fm6',
        relationship: 'mother',
        firstName: 'Ama',
        lastName: 'Asante',
        otherNames: '',
        phone: '+233 24 555 6666',
        isLinked: false
      }
    ],
    legalInfo: {
      ghanaCardNumber: 'GHA-987654321-2',
      ghanaCardExpiryDate: '2029-08-20',
      alternativeIdType: '',
      alternativeIdNumber: ''
    },
    ministries: ['Women Fellowship', 'Welfare Ministry', 'House-Keeping Ministry']
  },
  {
    id: '3',
    firstName: 'Yaw',
    lastName: 'Mensah',
    otherNames: '',
    email: 'yaw.mensah@email.com',
    phone: '+233 55 111 2222',
    secondPhone: '',
    gender: 'male',
    dateOfBirth: '2005-03-10',
    residenceLocation: 'House No. 12, Mataheko Junction',
    digitalAddress: 'GA-123-4567',
    zone: 'M',
    zoneNumber: 'M03',
    notes: 'Youth member, active in youth ministry',
    status: 'active',
    joinDate: '2020-06-15',
    photo: '',
    baptismInfo: {
      dateType: 'full',
      fullDate: '2020-05-31',
      previousCongregation: '',
      roleInPreviousCongregation: ''
    },
    familyMembers: [
      {
        id: 'fm7',
        relationship: 'father',
        firstName: 'Kwame',
        lastName: 'Mensah',
        otherNames: 'Kofi',
        phone: '+233 24 123 4567',
        isLinked: true,
        linkedMemberId: '1'
      },
      {
        id: 'fm8',
        relationship: 'mother',
        firstName: 'Akua',
        lastName: 'Mensah',
        otherNames: 'Abena',
        phone: '+233 24 234 5678',
        isLinked: true,
        linkedMemberId: '2'
      }
    ],
    legalInfo: {
      ghanaCardNumber: 'GHA-555666777-3',
      ghanaCardExpiryDate: '2035-03-10',
      alternativeIdType: '',
      alternativeIdNumber: ''
    },
    ministries: ['Youth Ministry', 'Ushering Ministry']
  },
  {
    id: '4',
    firstName: 'Kojo',
    lastName: 'Mensah',
    otherNames: '',
    email: 'kojo.mensah@email.com',
    phone: '+233 24 333 4444',
    secondPhone: '+233 55 222 3333',
    gender: 'male',
    dateOfBirth: '1972-11-30',
    residenceLocation: 'House No. 45, Bubiashie',
    digitalAddress: 'GA-456-7890',
    zone: 'B',
    zoneNumber: 'B15',
    notes: 'Deacon, leads Bible study classes',
    status: 'active',
    joinDate: '2008-03-20',
    photo: '',
    baptismInfo: {
      dateType: 'yearOnly',
      year: '2007',
      previousCongregation: 'Church of Christ, Accra Central',
      roleInPreviousCongregation: 'Teacher'
    },
    familyMembers: [
      {
        id: 'fm9',
        relationship: 'sibling',
        firstName: 'Kwame',
        lastName: 'Mensah',
        otherNames: 'Kofi',
        phone: '+233 24 123 4567',
        isLinked: true,
        linkedMemberId: '1'
      },
      {
        id: 'fm10',
        relationship: 'spouse',
        firstName: 'Afua',
        lastName: 'Mensah',
        otherNames: '',
        phone: '+233 24 777 8888',
        isLinked: true,
        linkedMemberId: '5'
      }
    ],
    legalInfo: {
      ghanaCardNumber: 'GHA-111222333-4',
      ghanaCardExpiryDate: '2028-11-30',
      alternativeIdType: '',
      alternativeIdNumber: ''
    },
    ministries: ['Education Ministry', 'Men Fellowship', 'Zonal Leaders Committee', 'Church Counsellors Committee']
  },
  {
    id: '5',
    firstName: 'Afua',
    lastName: 'Mensah',
    otherNames: 'Adwoa',
    email: 'afua.mensah@email.com',
    phone: '+233 24 777 8888',
    secondPhone: '',
    gender: 'female',
    dateOfBirth: '1980-07-25',
    residenceLocation: 'House No. 45, Bubiashie',
    digitalAddress: 'GA-456-7890',
    zone: 'B',
    zoneNumber: 'B16',
    notes: 'Active in children\'s ministry',
    status: 'active',
    joinDate: '2008-03-20',
    photo: '',
    baptismInfo: {
      dateType: 'full',
      fullDate: '2008-02-15',
      previousCongregation: '',
      roleInPreviousCongregation: ''
    },
    familyMembers: [
      {
        id: 'fm11',
        relationship: 'spouse',
        firstName: 'Kojo',
        lastName: 'Mensah',
        otherNames: '',
        phone: '+233 24 333 4444',
        isLinked: true,
        linkedMemberId: '4'
      },
      {
        id: 'fm12',
        relationship: 'father',
        firstName: 'Kofi',
        lastName: 'Boateng',
        otherNames: '',
        phone: '+233 24 999 0000',
        isLinked: false
      }
    ],
    legalInfo: {
      ghanaCardNumber: 'GHA-444555666-5',
      ghanaCardExpiryDate: '2032-07-25',
      alternativeIdType: '',
      alternativeIdNumber: ''
    },
    ministries: ["Children's Ministry", 'Women Fellowship', 'Prayer Ministry']
  }
];

export function Members({ onAddMember, onViewMember }: MembersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [members] = useState<Member[]>(mockMembers);

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName} ${member.otherNames}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm) ||
    member.zoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ZONES[member.zone].toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { user, canAccess } = useAuth();
  
  const canAddMembers = canAccess('manage_members');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Members</h1>
          <p className="text-muted-foreground">
            Manage your church members
          </p>
        </div>
        {canAddMembers && (
          <Button onClick={onAddMember}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Member
          </Button>
        )}
      </div>

      {/* Member Status Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Member Status Definitions:</strong><br />
          <strong>Active:</strong> Mostly or always present on Sunday main services<br />
          <strong>Semi-Active:</strong> Rarely present on Sunday Services (absent within less than a month)<br />
          <strong>Inactive:</strong> Absent for more than a month without permission<br />
          <strong>Sabbatical:</strong> Absent for a long period but with permission<br />
          <strong>Blacklisted:</strong> Sacked or removed
        </AlertDescription>
      </Alert>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search members by name, zone, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{members.length}</div>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {members.filter(m => m.status === 'active').length}
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {members.filter(m => m.status === 'semi-active').length}
              </div>
              <p className="text-sm text-muted-foreground">Semi-Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {members.filter(m => m.status === 'inactive').length}
              </div>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {members.filter(m => m.status === 'sabbatical').length}
              </div>
              <p className="text-sm text-muted-foreground">Sabbatical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        {members.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium mb-2">No Members Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your church member database by adding your first member.
                </p>
                {canAddMembers && (
                  <Button onClick={onAddMember}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Member
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filteredMembers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No members found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            {member.firstName[0]}{member.lastName[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {member.firstName} {member.otherNames} {member.lastName}
                        </h3>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {member.zoneNumber} - Zone {member.zone}
                          </Badge>
                          <Badge
                            variant={member.status === 'active' ? 'default' : 'secondary'}
                            className={
                              member.status === 'active' ? 'bg-green-100 text-green-800' :
                              member.status === 'semi-active' ? 'bg-blue-100 text-blue-800' :
                              member.status === 'sabbatical' ? 'bg-purple-100 text-purple-800' :
                              member.status === 'blacklisted' ? 'bg-red-100 text-red-800' : ''
                            }
                          >
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {member.phone}
                        {member.secondPhone && <span className="text-xs">• {member.secondPhone}</span>}
                      </div>
                      {member.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {member.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {member.residenceLocation} ({ZONES[member.zone]})
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewMember(member)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Mobile Floating Action Button */}
      {canAddMembers && (
        <div className="lg:hidden fixed bottom-20 right-4">
          <Button
            onClick={onAddMember}
            size="lg"
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}