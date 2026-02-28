import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Visitors, AddVisitor, VisitorProfile, EditVisitor, Visitor } from './components/Visitors';
import { Giving, RecordGiving, GivingDetail } from './components/Giving';
import { Reports } from './components/Reports';
import { Settings, AddUser } from './components/Settings';
import { Help } from './components/Help';
import { Services } from './components/Services';
import { ActivityLog } from './components/ActivityLog';
import { Notifications } from './components/Notifications';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import { api } from './services/api';

type AppPage = 'login' | 'signup' | 'forgot-password' | 'otp-verification' | 'dashboard' | 'members' | 'add-member' | 'edit-member' | 'member-profile' |
               'attendance' | 'record-attendance' | 'mark-attendance' | 'attendance-detail' | 'visitors' | 'add-visitor' | 'visitor-profile' | 'edit-visitor' |
               'giving' | 'record-giving' | 'giving-detail' | 'manage-giving-types' | 'reports' | 'help' | 'settings' | 'add-user' | 'convert-visitor' |
               'member-attendance-history' | 'services' | 'activity-log' | 'notifications';

// Map sub-pages to their parent for back navigation
const PAGE_PARENT: Partial<Record<AppPage, AppPage>> = {
  'add-member': 'members',
  'edit-member': 'member-profile',
  'member-profile': 'members',
  'member-attendance-history': 'member-profile',
  'record-attendance': 'attendance',
  'mark-attendance': 'attendance',
  'attendance-detail': 'attendance',
  'add-visitor': 'visitors',
  'visitor-profile': 'visitors',
  'edit-visitor': 'visitor-profile',
  'convert-visitor': 'visitor-profile',
  'record-giving': 'giving',
  'giving-detail': 'giving',
  'manage-giving-types': 'giving',
  'add-user': 'settings',
};

function AppContent() {
  const { isAuthenticated, completeLogin, isInitializing } = useAuth();
  const isNavigatingRef = useRef(false);

  // Restore page from sessionStorage
  const getInitialPage = (): AppPage => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('currentPage');
      if (saved) return saved as AppPage;
    }
    return 'login';
  };

  const [currentPage, setCurrentPage] = useState<AppPage>(getInitialPage);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [selectedGivingId, setSelectedGivingId] = useState<string | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [givingRefreshKey, setGivingRefreshKey] = useState(0);
  const [visitorsRefreshKey, setVisitorsRefreshKey] = useState(0);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [twoFAData, setTwoFAData] = useState<TwoFAData | null>(null);
  const [restoringState, setRestoringState] = useState(true);

  // Persist page to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

  // Persist entity IDs to sessionStorage
  useEffect(() => {
    if (selectedMember) sessionStorage.setItem('selectedMemberId', selectedMember.id);
    else sessionStorage.removeItem('selectedMemberId');
  }, [selectedMember]);

  useEffect(() => {
    if (selectedVisitor) sessionStorage.setItem('selectedVisitorId', selectedVisitor.id);
    else sessionStorage.removeItem('selectedVisitorId');
  }, [selectedVisitor]);

  useEffect(() => {
    if (selectedAttendanceId) sessionStorage.setItem('selectedAttendanceId', selectedAttendanceId);
    else sessionStorage.removeItem('selectedAttendanceId');
  }, [selectedAttendanceId]);

  useEffect(() => {
    if (selectedGivingId) sessionStorage.setItem('selectedGivingId', selectedGivingId);
    else sessionStorage.removeItem('selectedGivingId');
  }, [selectedGivingId]);

  // Restore entities from sessionStorage on mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        const memberId = sessionStorage.getItem('selectedMemberId');
        const visitorId = sessionStorage.getItem('selectedVisitorId');
        const attId = sessionStorage.getItem('selectedAttendanceId');
        const givId = sessionStorage.getItem('selectedGivingId');

        if (memberId && !selectedMember) {
          try {
            const member = await api.members.getById(memberId);
            if (member) setSelectedMember(member);
          } catch { /* member may no longer exist */ }
        }
        if (visitorId && !selectedVisitor) {
          try {
            const visitor = await api.visitors.getById(visitorId);
            if (visitor) setSelectedVisitor(visitor);
          } catch { /* visitor may no longer exist */ }
        }
        if (attId) setSelectedAttendanceId(attId);
        if (givId) setSelectedGivingId(givId);
      } finally {
        setRestoringState(false);
      }
    };
    if (isAuthenticated) {
      restoreState();
    } else {
      setRestoringState(false);
    }
  }, [isAuthenticated]);

  // Browser back/forward button support
  const navigateTo = useCallback((page: AppPage, pushState = true) => {
    if (pushState && !isNavigatingRef.current) {
      window.history.pushState({ page }, '', undefined);
    }
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    // Set initial history state
    window.history.replaceState({ page: currentPage }, '', undefined);

    const handlePopState = (event: PopStateEvent) => {
      isNavigatingRef.current = true;
      const page = event.state?.page as AppPage;
      if (page) {
        setCurrentPage(page);
      } else {
        // If no state, go to parent or dashboard
        const parent = PAGE_PARENT[currentPage] || 'dashboard';
        setCurrentPage(parent);
      }
      setTimeout(() => { isNavigatingRef.current = false; }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Show full screen loader while auth is initializing to prevent login page flash
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading CoC.M...</p>
      </div>
    );
  }

  // Show authentication pages when not authenticated
  if (!isAuthenticated) {
    // Default to login page if current page is not an auth page
    const authPages = ['login', 'otp-verification', 'signup', 'forgot-password'];
    const effectivePage = authPages.includes(currentPage) ? currentPage : 'login';

    return (
      <>
        {effectivePage === 'login' && (
          <Login
            onForgotPassword={() => setCurrentPage('forgot-password')}
            onSignUp={() => setCurrentPage('signup')}
            onRequires2FA={(data) => {
              setTwoFAData(data);
              setCurrentPage('otp-verification');
            }}
          />
        )}
        {effectivePage === 'otp-verification' && twoFAData && (
          <OtpVerification
            userId={twoFAData.userId}
            tempToken={twoFAData.tempToken}
            method={twoFAData.method}
            destination={twoFAData.destination}
            onVerified={async (session, user) => {
              await completeLogin(session, user);
              setTwoFAData(null);
              navigateTo('dashboard');
            }}
            onCancel={() => {
              setTwoFAData(null);
              setCurrentPage('login');
            }}
          />
        )}
        {effectivePage === 'signup' && (
          <SignUp onBackToLogin={() => setCurrentPage('login')} />
        )}
        {effectivePage === 'forgot-password' && (
          <ForgotPassword onBackToLogin={() => setCurrentPage('login')} />
        )}
      </>
    );
  }

  // Auto-navigate to dashboard after successful login
  if (isAuthenticated && currentPage === 'login') {
    navigateTo('dashboard', false);

    // Fetch login summary notifications
    api.notifications.getLoginSummary().then((summary: any) => {
      if (summary?.birthdays?.length > 0) {
        summary.birthdays.forEach((b: any) => {
          toast.info(`🎂 ${b.name} has a birthday today!`);
        });
      }
      const notifs = summary?.notifications || [];
      if (notifs.length > 0) {
        toast.info(`You have ${notifs.length} new notification${notifs.length > 1 ? 's' : ''}.`);
      }
    }).catch(() => {});

    // Prefetch critical data
    Promise.all([
      api.members.getAll(),
      api.services.getAll(),
      api.giving.types.getAll(),
    ]).catch(() => {});
  }

  const handleNavigate = (page: string) => {
    navigateTo(page as AppPage);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-member':
        navigateTo('add-member');
        break;
      case 'record-attendance':
        navigateTo('record-attendance');
        break;
      case 'mark-attendance':
        navigateTo('mark-attendance');
        break;
      case 'record-giving':
        navigateTo('record-giving');
        break;
      case 'add-visitor':
        navigateTo('add-visitor');
        break;
    }
  };

  const handleAddMember = () => {
    navigateTo('add-member');
  };

  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    navigateTo('member-profile');
  };

  const handleViewMemberById = async (memberId: string) => {
    try {
      const member = await api.members.getById(memberId);
      if (member) {
        setSelectedMember(member);
        navigateTo('member-profile');
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
      navigateTo('members');
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member. Please try again.');
    }
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    navigateTo('edit-member');
  };

  const handleUpdateMember = async (memberData: Member) => {
    try {
      await api.members.update(memberData.id, memberData);
      toast.success('Member updated successfully!');
      setSelectedMember(memberData);
      setMembersRefreshKey(prev => prev + 1);
      navigateTo('member-profile');
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
      navigateTo('members');
    } catch (error) {
      console.error('Failed to delete member:', error);
      toast.error('Failed to delete member. Please try again.');
    }
  };

  const handleRecordAttendance = () => {
    navigateTo('record-attendance');
  };

  const handleMarkAttendance = () => {
    navigateTo('mark-attendance');
  };

  const handleSaveAttendance = (attendanceData: any) => {
    toast.success('Attendance recorded successfully!');
    setAttendanceRefreshKey(prev => prev + 1);
    navigateTo('attendance');
  };

  const handleSaveMarkedAttendance = (attendanceData: any) => {
    toast.success('Individual attendance marked successfully!');
    setAttendanceRefreshKey(prev => prev + 1);
    navigateTo('attendance');
  };

  const handleRecordGiving = () => {
    navigateTo('record-giving');
  };

  const handleSaveGiving = (givingData: any) => {
    toast.success('Giving record added successfully!');
    setGivingRefreshKey(prev => prev + 1);
    navigateTo('giving');
  };

  const handleAddUser = () => {
    navigateTo('add-user');
  };

  const handleSaveUser = (userData: any) => {
    toast.success('User created successfully!');
    navigateTo('settings');
  };

  // Visitor handlers
  const handleAddVisitor = () => {
    navigateTo('add-visitor');
  };

  const handleViewVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    navigateTo('visitor-profile');
  };

  const handleEditVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    navigateTo('edit-visitor');
  };

  const handleUpdateVisitor = async (visitorData: Visitor) => {
    try {
      await api.visitors.update(visitorData.id, visitorData);
      toast.success('Visitor updated successfully!');
      setSelectedVisitor(visitorData);
      setVisitorsRefreshKey(prev => prev + 1);
      navigateTo('visitor-profile');
    } catch (error: any) {
      console.error('Failed to update visitor:', error);
      toast.error(error?.message || 'Failed to update visitor. Please try again.');
    }
  };

  const handleSaveVisitor = (visitorData: Omit<Visitor, 'id'>) => {
    toast.success('Visitor added successfully!');
    setVisitorsRefreshKey(prev => prev + 1);
    navigateTo('visitors');
  };

  const handleConvertVisitorToMember = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    navigateTo('convert-visitor');
  };

  const handleSaveConvertedMember = async (memberData: Omit<Member, 'id' | 'joinDate'>) => {
    try {
      await api.members.create(memberData);

      if (selectedVisitor) {
        await api.visitors.update(selectedVisitor.id, {
          ...selectedVisitor,
          convertedToMember: true
        });
      }

      toast.success('Visitor converted to member successfully!');
      setMembersRefreshKey(prev => prev + 1);
      setSelectedVisitor(null);
      navigateTo('members');
    } catch (error) {
      console.error('Failed to convert visitor:', error);
      toast.error('Failed to convert visitor. Please try again.');
    }
  };

  // Notification click handler - navigate to relevant page
  const handleNotificationClick = (notification: any) => {
    const { type, entityType, entityId } = notification;

    if (type === 'member_registered' || entityType === 'user') {
      navigateTo('settings');
    } else if ((type === 'member_status_change' || type === 'birthday') && entityId) {
      handleViewMemberById(entityId);
    } else if (type === 'attendance_record' || entityType === 'attendance') {
      navigateTo('attendance');
    } else if (type === 'giving_record' || entityType === 'giving') {
      navigateTo('giving');
    } else if (entityType === 'member' && entityId) {
      handleViewMemberById(entityId);
    } else if (entityType === 'visitor') {
      navigateTo('visitors');
    }
  };

  if (restoringState && isAuthenticated) {
    return (
      <Layout currentPage={currentPage} onNavigate={handleNavigate}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

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
            onAddFromVisitor={() => navigateTo('visitors')}
          />
        );

      case 'add-member':
        return (
          <AddMember
            onBack={() => navigateTo('members')}
            onSave={handleSaveMember}
          />
        );

      case 'member-profile':
        return selectedMember ? (
          <MemberProfile
            member={selectedMember}
            onBack={() => navigateTo('members')}
            onEdit={handleEditMember}
            onDelete={handleDeleteMember}
            onViewMember={handleViewMemberById}
            onViewAttendanceHistory={() => navigateTo('member-attendance-history')}
          />
        ) : null;

      case 'member-attendance-history':
        return selectedMember ? (
          <MemberAttendanceHistory
            memberId={selectedMember.id}
            memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
            onBack={() => navigateTo('member-profile')}
          />
        ) : null;

      case 'edit-member':
        return selectedMember ? (
          <EditMember
            member={selectedMember}
            onBack={() => navigateTo('member-profile')}
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
            navigateTo('attendance-detail');
          }}
        />;

      case 'attendance-detail':
        return selectedAttendanceId ? (
          <AttendanceDetail
            recordId={selectedAttendanceId}
            onBack={() => navigateTo('attendance')}
            onSaved={() => {
              setAttendanceRefreshKey(prev => prev + 1);
              navigateTo('attendance');
            }}
          />
        ) : null;

      case 'record-attendance':
        return (
          <RecordAttendance
            onBack={() => navigateTo('attendance')}
            onSave={handleSaveAttendance}
          />
        );

      case 'mark-attendance':
        return (
          <MarkAttendance
            onBack={() => navigateTo('attendance')}
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
            onBack={() => navigateTo('visitors')}
            onSave={handleSaveVisitor}
          />
        );

      case 'visitor-profile':
        return selectedVisitor ? (
          <VisitorProfile
            visitor={selectedVisitor}
            onBack={() => navigateTo('visitors')}
            onEdit={handleEditVisitor}
            onConvertToMember={handleConvertVisitorToMember}
          />
        ) : null;

      case 'edit-visitor':
        return selectedVisitor ? (
          <EditVisitor
            visitor={selectedVisitor}
            onBack={() => navigateTo('visitor-profile')}
            onSave={handleUpdateVisitor}
          />
        ) : null;

      case 'convert-visitor':
        return selectedVisitor ? (
          <AddMember
            onBack={() => navigateTo('visitor-profile')}
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
            navigateTo('giving-detail');
          }}
        />;

      case 'giving-detail':
        return selectedGivingId ? (
          <GivingDetail
            recordId={selectedGivingId}
            onBack={() => navigateTo('giving')}
            onSaved={() => {
              setGivingRefreshKey(prev => prev + 1);
              navigateTo('giving');
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
              navigateTo('giving-detail');
            }}
            initialShowTypeManager={true}
          />
        );

      case 'record-giving':
        return (
          <RecordGiving
            onBack={() => navigateTo('giving')}
            onSave={handleSaveGiving}
            onManageTypes={() => navigateTo('manage-giving-types')}
          />
        );

      case 'reports':
        return <Reports />;

      case 'services':
        return <Services onViewMember={handleViewMemberById} />;

      case 'activity-log':
        return <ActivityLog />;

      case 'notifications':
        return <Notifications onNotificationClick={handleNotificationClick} />;

      case 'help':
        return <Help />;

      case 'settings':
        return <Settings onAddUser={handleAddUser} />;

      case 'add-user':
        return (
          <AddUser
            onBack={() => navigateTo('settings')}
            onSave={handleSaveUser}
          />
        );

      default:
        return <Dashboard onNavigate={handleNavigate} onQuickAction={handleQuickAction} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderCurrentPage()}
    </Layout>
  );
}

import { TutorialProvider } from './components/TutorialContext';
import { TutorialOverlay } from './components/TutorialOverlay';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TutorialProvider>
          <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
            <AppContent />
            <TutorialOverlay />
            <Toaster position="top-right" />
          </div>
        </TutorialProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
