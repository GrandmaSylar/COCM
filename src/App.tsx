import { useState } from 'react';
import { AuthProvider, useAuth, TwoFAData } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { ForgotPassword } from './components/ForgotPassword';
import { OtpVerification } from './components/OtpVerification';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Members, Member } from './components/Members';
import { AddMember } from './components/AddMember';
import { EditMember } from './components/EditMember';
import { MemberProfile } from './components/MemberProfile';
import { MemberAttendanceHistory } from './components/MemberAttendanceHistory';
import { Attendance, RecordAttendance, AttendanceDetail } from './components/Attendance';
import { MarkAttendance } from './components/MarkAttendance';
import { Visitors, AddVisitor, VisitorProfile, Visitor } from './components/Visitors';
import { Giving, RecordGiving, GivingDetail } from './components/Giving';
import { Reports } from './components/Reports';
import { Settings, AddUser } from './components/Settings';
import { Help } from './components/Help';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import { api } from './services/api';

type AppPage = 'login' | 'signup' | 'forgot-password' | 'otp-verification' | 'dashboard' | 'members' | 'add-member' | 'edit-member' | 'member-profile' |
               'attendance' | 'record-attendance' | 'mark-attendance' | 'attendance-detail' | 'visitors' | 'add-visitor' | 'visitor-profile' |
               'giving' | 'record-giving' | 'giving-detail' | 'manage-giving-types' | 'reports' | 'help' | 'settings' | 'add-user' | 'convert-visitor' |
               'member-attendance-history';

function AppContent() {
  const { isAuthenticated, completeLogin } = useAuth();
  // Start with login page - user must authenticate first
  const [currentPage, setCurrentPage] = useState<AppPage>('login');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [selectedGivingId, setSelectedGivingId] = useState<string | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [givingRefreshKey, setGivingRefreshKey] = useState(0);
  const [visitorsRefreshKey, setVisitorsRefreshKey] = useState(0);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [twoFAData, setTwoFAData] = useState<TwoFAData | null>(null);

  // Show authentication pages when not authenticated
  if (!isAuthenticated) {
    return (
      <>
        {currentPage === 'login' && (
          <Login
            onForgotPassword={() => setCurrentPage('forgot-password')}
            onSignUp={() => setCurrentPage('signup')}
            onRequires2FA={(data) => {
              setTwoFAData(data);
              setCurrentPage('otp-verification');
            }}
          />
        )}
        {currentPage === 'otp-verification' && twoFAData && (
          <OtpVerification
            userId={twoFAData.userId}
            tempToken={twoFAData.tempToken}
            method={twoFAData.method}
            destination={twoFAData.destination}
            onVerified={async (session, user) => {
              await completeLogin(session, user);
              setTwoFAData(null);
              setCurrentPage('dashboard');
            }}
            onCancel={() => {
              setTwoFAData(null);
              setCurrentPage('login');
            }}
          />
        )}
        {currentPage === 'signup' && (
          <SignUp onBackToLogin={() => setCurrentPage('login')} />
        )}
        {currentPage === 'forgot-password' && (
          <ForgotPassword onBackToLogin={() => setCurrentPage('login')} />
        )}
      </>
    );
  }

  // Auto-navigate to dashboard after successful login
  if (isAuthenticated && currentPage === 'login') {
    setCurrentPage('dashboard');
  }

  const handleNavigate = (page: string) => {
    setCurrentPage(page as AppPage);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-member':
        setCurrentPage('add-member');
        break;
      case 'record-attendance':
        setCurrentPage('record-attendance');
        break;
      case 'mark-attendance':
        setCurrentPage('mark-attendance');
        break;
      case 'record-giving':
        setCurrentPage('record-giving');
        break;
      case 'add-visitor':
        setCurrentPage('add-visitor');
        break;
    }
  };

  const handleAddMember = () => {
    setCurrentPage('add-member');
  };

  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setCurrentPage('member-profile');
  };

  const handleViewMemberById = async (memberId: string) => {
    try {
      const member = await api.members.getById(memberId);
      if (member) {
        setSelectedMember(member);
        setCurrentPage('member-profile');
      } else {
        toast.error('Member not found');
      }
    } catch (error: any) {
      console.error('Failed to fetch member:', error);
      if (error?.status === 404) {
        toast.error('This member is no longer in the directory or the link is invalid.');
      } else {
        toast.error(error?.message || 'Failed to load member profile');
      }
    }
  };

  const handleSaveMember = async (memberData: Omit<Member, 'id' | 'joinDate'>) => {
    try {
      await api.members.create(memberData);
      toast.success('Member added successfully!');
      setMembersRefreshKey(prev => prev + 1);
      setCurrentPage('members');
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member. Please try again.');
    }
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setCurrentPage('edit-member');
  };

  const handleUpdateMember = async (memberData: Member) => {
    try {
      await api.members.update(memberData.id, memberData);
      toast.success('Member updated successfully!');
      setSelectedMember(memberData); // Update selected member with new data
      setMembersRefreshKey(prev => prev + 1);
      setCurrentPage('member-profile'); // Navigate back to profile
    } catch (error: any) {
      console.error('Failed to update member:', error);
      const message = error?.message || 'Failed to update member. Please try again.';
      toast.error(message);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    try {
      await api.members.delete(member.id);
      toast.success('Member deleted successfully!');
      setSelectedMember(null);
      setMembersRefreshKey(prev => prev + 1);
      setCurrentPage('members');
    } catch (error) {
      console.error('Failed to delete member:', error);
      toast.error('Failed to delete member. Please try again.');
    }
  };

  const handleRecordAttendance = () => {
    setCurrentPage('record-attendance');
  };

  const handleMarkAttendance = () => {
    setCurrentPage('mark-attendance');
  };

  const handleSaveAttendance = (attendanceData: any) => {
    toast.success('Attendance recorded successfully!');
    setAttendanceRefreshKey(prev => prev + 1);
    setCurrentPage('attendance');
  };

  const handleSaveMarkedAttendance = (attendanceData: any) => {
    toast.success('Individual attendance marked successfully!');
    setAttendanceRefreshKey(prev => prev + 1);
    setCurrentPage('attendance');
  };

  const handleRecordGiving = () => {
    setCurrentPage('record-giving');
  };

  const handleSaveGiving = (givingData: any) => {
    toast.success('Giving record added successfully!');
    setGivingRefreshKey(prev => prev + 1);
    setCurrentPage('giving');
  };

  const handleAddUser = () => {
    setCurrentPage('add-user');
  };

  const handleSaveUser = (userData: any) => {
    // In real app, this would save to API/database
    toast.success('User created successfully!');
    setCurrentPage('settings');
  };

  // Visitor handlers
  const handleAddVisitor = () => {
    setCurrentPage('add-visitor');
  };

  const handleViewVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setCurrentPage('visitor-profile');
  };

  const handleSaveVisitor = (visitorData: Omit<Visitor, 'id'>) => {
    toast.success('Visitor added successfully!');
    setVisitorsRefreshKey(prev => prev + 1);
    setCurrentPage('visitors');
  };

  const handleConvertVisitorToMember = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setCurrentPage('convert-visitor');
  };

  const handleSaveConvertedMember = async (memberData: Omit<Member, 'id' | 'joinDate'>) => {
    try {
      // Create the member
      await api.members.create(memberData);

      // Mark visitor as converted if we have a selected visitor
      if (selectedVisitor) {
        await api.visitors.update(selectedVisitor.id, {
          ...selectedVisitor,
          convertedToMember: true
        });
      }

      toast.success('Visitor converted to member successfully!');
      setMembersRefreshKey(prev => prev + 1);
      setSelectedVisitor(null);
      setCurrentPage('members');
    } catch (error) {
      console.error('Failed to convert visitor:', error);
      toast.error('Failed to convert visitor. Please try again.');
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} onQuickAction={handleQuickAction} />;
      
      case 'members':
        return (
          <Members
            key={membersRefreshKey}
            onAddMember={handleAddMember}
            onViewMember={handleViewMember}
            onAddFromVisitor={() => setCurrentPage('visitors')}
          />
        );
      
      case 'add-member':
        return (
          <AddMember 
            onBack={() => setCurrentPage('members')} 
            onSave={handleSaveMember}
          />
        );
      
      case 'member-profile':
        return selectedMember ? (
          <MemberProfile
            member={selectedMember}
            onBack={() => setCurrentPage('members')}
            onEdit={handleEditMember}
            onDelete={handleDeleteMember}
            onViewMember={handleViewMemberById}
            onViewAttendanceHistory={() => setCurrentPage('member-attendance-history')}
          />
        ) : null;

      case 'member-attendance-history':
        return selectedMember ? (
          <MemberAttendanceHistory
            memberId={selectedMember.id}
            memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
            onBack={() => setCurrentPage('member-profile')}
          />
        ) : null;

      case 'edit-member':
        return selectedMember ? (
          <EditMember
            member={selectedMember}
            onBack={() => setCurrentPage('member-profile')}
            onSave={handleUpdateMember}
          />
        ) : null;
      
      case 'attendance':
        return <Attendance
          key={attendanceRefreshKey}
          onRecordAttendance={handleRecordAttendance}
          onMarkAttendance={handleMarkAttendance}
          onViewRecord={(id: string) => {
            setSelectedAttendanceId(id);
            setCurrentPage('attendance-detail');
          }}
        />;

      case 'attendance-detail':
        return selectedAttendanceId ? (
          <AttendanceDetail
            recordId={selectedAttendanceId}
            onBack={() => setCurrentPage('attendance')}
            onSaved={() => {
              setAttendanceRefreshKey(prev => prev + 1);
              setCurrentPage('attendance');
            }}
          />
        ) : null;

      case 'record-attendance':
        return (
          <RecordAttendance
            onBack={() => setCurrentPage('attendance')}
            onSave={handleSaveAttendance}
          />
        );

      case 'mark-attendance':
        return (
          <MarkAttendance
            onBack={() => setCurrentPage('attendance')}
            onSave={handleSaveMarkedAttendance}
          />
        );
      
      case 'visitors':
        return (
          <Visitors
            key={visitorsRefreshKey}
            onAddVisitor={handleAddVisitor}
            onViewVisitor={handleViewVisitor}
            onConvertToMember={handleConvertVisitorToMember}
          />
        );
      
      case 'add-visitor':
        return (
          <AddVisitor 
            onBack={() => setCurrentPage('visitors')}
            onSave={handleSaveVisitor}
          />
        );
      
      case 'visitor-profile':
        return selectedVisitor ? (
          <VisitorProfile 
            visitor={selectedVisitor}
            onBack={() => setCurrentPage('visitors')}
            onEdit={(visitor) => toast.info('Edit visitor functionality would be implemented here')}
            onConvertToMember={handleConvertVisitorToMember}
          />
        ) : null;
      
      case 'convert-visitor':
        return selectedVisitor ? (
          <AddMember 
            onBack={() => setCurrentPage('visitor-profile')}
            onSave={handleSaveConvertedMember}
            visitorData={selectedVisitor}
          />
        ) : null;

      case 'giving':
        return <Giving
          key={givingRefreshKey}
          onRecordGiving={handleRecordGiving}
          onViewRecord={(id: string) => {
            setSelectedGivingId(id);
            setCurrentPage('giving-detail');
          }}
        />;

      case 'giving-detail':
        return selectedGivingId ? (
          <GivingDetail
            recordId={selectedGivingId}
            onBack={() => setCurrentPage('giving')}
            onSaved={() => {
              setGivingRefreshKey(prev => prev + 1);
              setCurrentPage('giving');
            }}
          />
        ) : null;

      case 'manage-giving-types':
        return (
          <Giving
            key={`types-${givingRefreshKey}`}
            onRecordGiving={handleRecordGiving}
            onViewRecord={(id: string) => {
              setSelectedGivingId(id);
              setCurrentPage('giving-detail');
            }}
            initialShowTypeManager={true}
          />
        );

      case 'record-giving':
        return (
          <RecordGiving
            onBack={() => setCurrentPage('giving')}
            onSave={handleSaveGiving}
            onManageTypes={() => setCurrentPage('manage-giving-types')}
          />
        );
      
      case 'reports':
        return <Reports />;
      
      case 'help':
        return <Help />;
      
      case 'settings':
        return <Settings onAddUser={handleAddUser} />;
      
      case 'add-user':
        return (
          <AddUser 
            onBack={() => setCurrentPage('settings')}
            onSave={handleSaveUser}
          />
        );
      
      default:
        return <Dashboard onNavigate={handleNavigate} onQuickAction={handleQuickAction} />;
    }
  };

  // No need to redirect since we start in dashboard mode

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderCurrentPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <AppContent />
          <Toaster position="top-right" />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}