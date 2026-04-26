import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AuthProvider, useAuth, TwoFAData } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { ForgotPassword } from './components/ForgotPassword';
import { OtpVerification } from './components/OtpVerification';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';
import { Toaster } from './components/ui/sonner';
import { clearCacheByPattern } from './hooks/useCachedData';

// Lazy load main pages
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Members = lazy(() => import('./components/Members').then(module => ({ default: module.Members })));
const AddMember = lazy(() => import('./components/AddMember').then(module => ({ default: module.AddMember })));
const EditMember = lazy(() => import('./components/EditMember').then(module => ({ default: module.EditMember })));
const MemberProfile = lazy(() => import('./components/MemberProfile').then(module => ({ default: module.MemberProfile })));
const MemberAttendanceHistory = lazy(() => import('./components/MemberAttendanceHistory').then(module => ({ default: module.MemberAttendanceHistory })));
const Attendance = lazy(() => import('./components/Attendance').then(module => ({ default: module.Attendance })));
const RecordAttendance = lazy(() => import('./components/Attendance').then(module => ({ default: module.RecordAttendance })));
const AttendanceDetail = lazy(() => import('./components/Attendance').then(module => ({ default: module.AttendanceDetail })));
const MarkAttendance = lazy(() => import('./components/MarkAttendance').then(module => ({ default: module.MarkAttendance })));
const Visitors = lazy(() => import('./components/Visitors').then(module => ({ default: module.Visitors })));
const AddVisitor = lazy(() => import('./components/Visitors').then(module => ({ default: module.AddVisitor })));
const VisitorProfile = lazy(() => import('./components/Visitors').then(module => ({ default: module.VisitorProfile })));
const EditVisitor = lazy(() => import('./components/Visitors').then(module => ({ default: module.EditVisitor })));
const Giving = lazy(() => import('./components/Giving').then(module => ({ default: module.Giving })));
const RecordGiving = lazy(() => import('./components/Giving').then(module => ({ default: module.RecordGiving })));
const GivingDetail = lazy(() => import('./components/Giving').then(module => ({ default: module.GivingDetail })));
const Reports = lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Settings = lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));
const AddUser = lazy(() => import('./components/Settings').then(module => ({ default: module.AddUser })));
const Help = lazy(() => import('./components/Help').then(module => ({ default: module.Help })));
const Services = lazy(() => import('./components/Services').then(module => ({ default: module.Services })));
const ActivityLog = lazy(() => import('./components/ActivityLog').then(module => ({ default: module.ActivityLog })));
const Notifications = lazy(() => import('./components/Notifications').then(module => ({ default: module.Notifications })));
const Children = lazy(() => import('./components/Children').then(module => ({ default: module.Children })));
const AddChildMember = lazy(() => import('./components/AddChildMember').then(m => ({ default: m.AddChildMember })));
const EditChildMember = lazy(() => import('./components/EditChildMember').then(m => ({ default: m.EditChildMember })));
const ChildProfile = lazy(() => import('./components/ChildProfile').then(m => ({ default: m.ChildProfile })));
const ChildrenMarkAttendance = lazy(() =>
  import('./components/ChildrenMarkAttendance').then(m => ({ default: m.ChildrenMarkAttendance }))
);
const AddChildVisitor = lazy(() =>
  import('./components/AddChildVisitor').then(m => ({ default: m.AddChildVisitor }))
);
const Expenses = lazy(() => import('./components/Expenses').then(m => ({ default: m.Expenses })));
const AddExpense = lazy(() => import('./components/AddExpense').then(m => ({ default: m.AddExpense })));
const EditExpense = lazy(() => import('./components/EditExpense').then(m => ({ default: m.EditExpense })));
const ExpenseReceipt = lazy(() => import('./components/ExpenseReceipt').then(m => ({ default: m.ExpenseReceipt })));
const Ministry = lazy(() => import('./components/Ministry').then(module => ({ default: module.Ministry })));

// Types needed by App which can't easily be lazy-loaded alongside their components
import type { Member } from './components/Members';
import type { Visitor } from './components/Visitors';
import type { ChildMember, ChildVisitor } from './components/Children';
import { toast } from 'sonner';
import { api } from './services/api';
import { getFriendlyMessage } from './utils/error-handler';
import * as Sentry from '@sentry/react';

type AppPage = 'login' | 'signup' | 'forgot-password' | 'otp-verification' | 'dashboard' | 'members' | 'add-member' | 'edit-member' | 'member-profile' |
               'attendance' | 'record-attendance' | 'mark-attendance' | 'attendance-detail' | 'visitors' | 'add-visitor' | 'visitor-profile' | 'edit-visitor' |
               'giving' | 'record-giving' | 'giving-detail' | 'manage-giving-types' | 'reports' | 'help' | 'settings' | 'add-user' | 'convert-visitor' |
               'member-attendance-history' | 'services' | 'activity-log' | 'notifications' | 'children' | 'children-add' | 'children-profile' | 'children-edit' | 'children-mark-attendance' | 'children-add-visitor' | 'convert-child-visitor' |
               'expenses' | 'add-expense' | 'edit-expense' | 'expense-receipt' | 'ministry';

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
  'children-add': 'children',
  'children-profile': 'children',
  'children-edit': 'children-profile',
  'children-mark-attendance': 'children',
  'children-add-visitor': 'children',
  'convert-child-visitor': 'children',
  'add-expense': 'expenses',
  'edit-expense': 'expenses',
  'expense-receipt': 'expenses',
};

function AppContent() {
  const { isAuthenticated, completeLogin, isInitializing, user } = useAuth();
  const isNavigatingRef = useRef(false);
  const convertOriginRef = useRef<'visitors' | 'services'>('visitors');

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
  const [selectedChildVisitor, setSelectedChildVisitor] = useState<ChildVisitor | null>(null);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [selectedGivingId, setSelectedGivingId] = useState<string | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [givingRefreshKey, setGivingRefreshKey] = useState(0);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [expensesRefreshKey, setExpensesRefreshKey] = useState(0);
  const [visitorsRefreshKey, setVisitorsRefreshKey] = useState(0);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [twoFAData, setTwoFAData] = useState<TwoFAData | null>(null);
  const [restoringState, setRestoringState] = useState(true);
  const [selectedChild, setSelectedChild] = useState<ChildMember | null>(null);
  const [childrenRefreshKey, setChildrenRefreshKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  const getInitialChildrenTab = (): any => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('childrenActiveTab');
      if (saved) return saved;
    }
    return 'members';
  };
  const [childrenActiveTab, setChildrenActiveTab] = useState<'members' | 'visitors' | 'attendance' | 'giving' | 'analytics'>(getInitialChildrenTab);

  useEffect(() => {
    sessionStorage.setItem('childrenActiveTab', childrenActiveTab);
  }, [childrenActiveTab]);

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
    if (selectedChild) sessionStorage.setItem('selectedChildId', selectedChild.id);
    else sessionStorage.removeItem('selectedChildId');
  }, [selectedChild]);

  useEffect(() => {
    if (selectedGivingId) sessionStorage.setItem('selectedGivingId', selectedGivingId);
    else sessionStorage.removeItem('selectedGivingId');
  }, [selectedGivingId]);

  useEffect(() => {
    if (selectedExpenseId) sessionStorage.setItem('selectedExpenseId', selectedExpenseId);
    else sessionStorage.removeItem('selectedExpenseId');
  }, [selectedExpenseId]);

  // Restore entities from sessionStorage on mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        const memberId = sessionStorage.getItem('selectedMemberId');
        const visitorId = sessionStorage.getItem('selectedVisitorId');
        const attId = sessionStorage.getItem('selectedAttendanceId');
        const givId = sessionStorage.getItem('selectedGivingId');
        const expId = sessionStorage.getItem('selectedExpenseId');
        const childId = sessionStorage.getItem('selectedChildId');

        if (memberId && !selectedMember) {
          try {
            const member = await api.members.getById(memberId);
            if (member) setSelectedMember(member);
          } catch { /* member may no longer exist */ }
        }
        if (childId && !selectedChild) {
          try {
            const child = await api.children.members.getById(childId);
            if (child) setSelectedChild(child);
          } catch { /* child may no longer exist */ }
        }
        if (visitorId && !selectedVisitor) {
          try {
            const visitor = await api.visitors.getById(visitorId);
            if (visitor) setSelectedVisitor(visitor);
          } catch { /* visitor may no longer exist */ }
        }
        if (attId) setSelectedAttendanceId(attId);
        if (givId) setSelectedGivingId(givId);
        if (expId) setSelectedExpenseId(expId);
      } finally {
        setRestoringState(false);
      }
    };
    if (isAuthenticated) {
      setRestoringState(true);
      restoreState();
    } else if (!isInitializing) {
      setRestoringState(false);
    }
  }, [isAuthenticated, isInitializing]);

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

  // Show splash screen while auth is initializing or splash animation is playing
  if (isInitializing || showSplash) {
    return (
      <SplashScreen
        isReady={!isInitializing}
        onComplete={() => setShowSplash(false)}
      />
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
    setSelectedChild(null);
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

  const handleSaveMember = async (memberData: any) => {
    try {
      const { photo, ...dataToSave } = memberData;
      const createdMember = await api.members.create(dataToSave);

      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          const photoUrl = await api.members.uploadPhoto(createdMember.id, file);
          await api.members.update(createdMember.id, { ...createdMember, photo: undefined, photoUrl });
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          toast.error('Member added, but photo upload failed.');
        }
      }

      toast.success('Member added successfully!');
      
      // If promoting a child to member, delete the child record
      if (selectedChild) {
        try {
          await api.children.members.delete(selectedChild.id);
          setChildrenRefreshKey(prev => prev + 1);
        } catch (childDeleteError) {
          console.error('Failed to remove child record after promotion:', childDeleteError);
          toast.warning('Member created, but the child record could not be removed automatically.');
        }
        setSelectedChild(null);
      }
      
      clearCacheByPattern('members-list');
      setMembersRefreshKey(prev => prev + 1);
      setSelectedMember(createdMember);
      navigateTo('member-profile');
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleEditMember = async (member: Member) => {
    try {
      const fullMember = await api.members.getById(member.id);
      setSelectedMember(fullMember || member);
      if (!fullMember) {
        toast.warning('Could not load full member data. Family links may be incomplete.');
      }
    } catch {
      toast.warning('Could not load full member data. Family links may be incomplete.');
      setSelectedMember(member);
    }
    navigateTo('edit-member');
  };

  const handleUpdateMember = async (memberData: any) => {
    try {
      const { photo, ...dataToSave } = memberData;
      let finalPhotoUrl = dataToSave.photoUrl ?? (photo && typeof photo === 'string' && !photo.startsWith('data:image') ? photo : undefined);

      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          finalPhotoUrl = await api.members.uploadPhoto(memberData.id, file);
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          toast.error('Member updated, but photo upload failed.');
        }
      }

      const updated = { ...dataToSave, photoUrl: finalPhotoUrl };
      await api.members.update(memberData.id, updated);
      toast.success('Member updated successfully!');
      try {
        const freshMember = await api.members.getById(memberData.id);
        setSelectedMember(freshMember || updated);
      } catch {
        setSelectedMember(updated);
      }
      clearCacheByPattern('members-list');
      setMembersRefreshKey(prev => prev + 1);
      navigateTo('member-profile');
    } catch (error: any) {
      console.error('Failed to update member:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleDeleteMember = async (member: Member) => {
    try {
      await api.members.delete(member.id);
      toast.success('Member deleted successfully!');
      setSelectedMember(null);
      clearCacheByPattern('members-list');
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
      const { dateOfBirth, ...updatePayload } = visitorData;
      await api.visitors.update(visitorData.id, updatePayload as Visitor);
      toast.success('Visitor updated successfully!');
      
      setSelectedVisitor(prev => prev ? { ...prev, ...updatePayload } as Visitor : updatePayload as Visitor);
      
      clearCacheByPattern('visitors-list');
      setVisitorsRefreshKey(prev => prev + 1);
      navigateTo('visitor-profile');
    } catch (error: any) {
      console.error('Failed to update visitor:', error);
      toast.error(error?.message || 'Failed to update visitor. Please try again.');
    }
  };

  const handleSaveVisitor = (visitorData: Omit<Visitor, 'id'>) => {
    toast.success('Visitor added successfully!');
    clearCacheByPattern('visitors-list');
    setVisitorsRefreshKey(prev => prev + 1);
    navigateTo('visitors');
  };

  const handleConvertVisitorToMember = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    convertOriginRef.current = 'visitors';
    navigateTo('convert-visitor');
  };

  const handleConvertVisitorFromServices = (visitor: any) => {
    setSelectedVisitor(visitor as Visitor);
    convertOriginRef.current = 'services';
    navigateTo('convert-visitor');
  };

  const handleSaveConvertedMember = async (memberData: any) => {
    try {
      const { photo, ...dataToSave } = memberData;
      const createdMember = await api.members.create(dataToSave);
      
      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          const photoUrl = await api.members.uploadPhoto(createdMember.id, file);
          await api.members.update(createdMember.id, { ...createdMember, photo: undefined, photoUrl });
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
        }
      }

      if (selectedVisitor) {
        await api.visitors.update(selectedVisitor.id, {
          ...selectedVisitor,
          convertedToMember: true,
          convertedMemberId: createdMember.id
        });
      }

      toast.success('Visitor converted to member successfully!');
      clearCacheByPattern('visitors-list');
      clearCacheByPattern('members-list');
      setMembersRefreshKey(prev => prev + 1);
      setVisitorsRefreshKey(prev => prev + 1);
      setSelectedVisitor(null);
      navigateTo(convertOriginRef.current === 'services' ? 'services' : 'visitors');
      convertOriginRef.current = 'visitors';
    } catch (error) {
      console.error('Failed to convert visitor:', error);
      toast.error('Failed to convert visitor. Please try again.');
    }
  };

  // Notification click handler - navigate to relevant page
  const handleAddChild = () => {
    navigateTo('children-add');
  };

  const handleViewChild = (child: ChildMember) => {
    setSelectedChild(child);
    navigateTo('children-profile');
  };

  const handleViewChildById = async (childId: string) => {
    try {
      const child = await api.children.members.getById(childId);
      if (child) {
        setSelectedChild(child);
        navigateTo('children-profile');
      } else {
        toast.error('Child member not found');
      }
    } catch (error: any) {
      console.error('Failed to fetch child member:', error);
      toast.error(error?.message || 'Failed to load child member profile');
    }
  };

  const handleEditChild = (child: ChildMember) => {
    setSelectedChild(child);
    navigateTo('children-edit');
  };

  const handleSaveChild = async (data: any) => {
    try {
      const { photo, ...memberData } = data;
      const createdChild = await api.children.members.create(memberData);
      
      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          const photoUrl = await api.children.members.uploadPhoto(createdChild.id, file);
          await api.children.members.update(createdChild.id, { ...createdChild, photo: undefined, photoUrl });
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          toast.error('Member created, but photo upload failed.');
        }
      }

      toast.success('Child member added successfully!');
      setChildrenRefreshKey(prev => prev + 1);
      setSelectedChild(createdChild);
      navigateTo('children-profile');
    } catch (error: any) {
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleUpdateChild = async (data: any) => {
    try {
      const { photo, ...memberData } = data;
      let finalPhotoUrl = memberData.photoUrl ?? (photo && typeof photo === 'string' && !photo.startsWith('data:image') ? photo : undefined);

      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          finalPhotoUrl = await api.children.members.uploadPhoto(data.id, file);
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          toast.error('Member updated, but photo upload failed.');
        }
      }

      const updatedChild = await api.children.members.update(data.id, { ...memberData, photoUrl: finalPhotoUrl });
      toast.success('Child member updated successfully!');
      setSelectedChild(updatedChild);
      setChildrenRefreshKey(prev => prev + 1);
      navigateTo('children-profile');
    } catch (error: any) {
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleDeleteChild = async (child: ChildMember) => {
    try {
      await api.children.members.delete(child.id);
      toast.success('Child deleted successfully!');
      setSelectedChild(null);
      setChildrenRefreshKey(prev => prev + 1);
      navigateTo('children');
    } catch (error: any) {
      console.error('Failed to delete child member:', error);
      toast.error(error?.message || 'Failed to delete child member. Please try again.');
    }
  };

  const handlePromoteChildToMember = (child: ChildMember) => {
    setSelectedChild(child);
    navigateTo('add-member');
  };

  const handleMarkChildrenAttendance = () => {
    navigateTo('children-mark-attendance');
  };

  const handleSaveChildrenAttendance = (data?: any) => {
    toast.success('Attendance recorded successfully!');
    setChildrenRefreshKey(prev => prev + 1);
    navigateTo('children');
  };

  const handleAddChildVisitor = () => {
    setChildrenActiveTab('visitors');
    navigateTo('children-add-visitor');
  };

  const handleSaveChildVisitor = async (data: any) => {
    try {
      await api.children.visitors.create(data);
      toast.success('Child visitor added successfully!');
      setChildrenRefreshKey(prev => prev + 1);
      setChildrenActiveTab('visitors');
      navigateTo('children');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add child visitor. Please try again.');
    }
  };

  const handleConvertChildVisitorToMember = (visitor: ChildVisitor) => {
    setSelectedChildVisitor(visitor);
    navigateTo('convert-child-visitor');
  };

  const handleSaveConvertedChildMember = async (data: any) => {
    try {
      const { photo, ...memberData } = data;
      const createdChild = await api.children.members.create(memberData);
      
      if (photo && photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], 'photo.jpg', { type: blob.type });
          const photoUrl = await api.children.members.uploadPhoto(createdChild.id, file);
          await api.children.members.update(createdChild.id, { ...createdChild, photo: undefined, photoUrl });
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
        }
      }

      if (selectedChildVisitor) {
        await api.children.visitors.update(selectedChildVisitor.id, {
          ...selectedChildVisitor,
          convertedToMember: true,
          convertedMemberId: createdChild.id
        });
      }

      toast.success('Child visitor converted to member successfully!');
      setChildrenRefreshKey(prev => prev + 1);
      setSelectedChildVisitor(null);
      setChildrenActiveTab('members');
      navigateTo('children');
    } catch (error: any) {
      toast.error(getFriendlyMessage(error));
    }
  };

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
            onBack={() => selectedChild ? navigateTo('children-profile') : navigateTo('members')}
            onSave={handleSaveMember}
            childData={selectedChild ?? undefined}
          />
        );

      case 'member-profile':
        if (!selectedMember) { navigateTo('members', false); return null; }
        return (
          <MemberProfile
            member={selectedMember}
            onBack={() => navigateTo('members')}
            onEdit={handleEditMember}
            onDelete={handleDeleteMember}
            onViewMember={handleViewMemberById}
            onViewChild={handleViewChildById}
            onViewAttendanceHistory={() => navigateTo('member-attendance-history')}
          />
        );

      case 'member-attendance-history':
        if (!selectedMember) { navigateTo('members', false); return null; }
        return (
          <MemberAttendanceHistory
            memberId={selectedMember.id}
            memberName={`${selectedMember.firstName} ${selectedMember.lastName}`}
            onBack={() => navigateTo('member-profile')}
          />
        );

      case 'edit-member':
        if (!selectedMember) { navigateTo('members', false); return null; }
        return (
          <EditMember
            member={selectedMember}
            onBack={() => navigateTo('member-profile')}
            onSave={handleUpdateMember}
          />
        );

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
        if (!selectedAttendanceId) { navigateTo('attendance', false); return null; }
        return (
          <AttendanceDetail
            recordId={selectedAttendanceId}
            onBack={() => navigateTo('attendance')}
            onSaved={() => {
              setAttendanceRefreshKey(prev => prev + 1);
              navigateTo('attendance');
            }}
          />
        );

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
        if (!selectedVisitor) { navigateTo('visitors', false); return null; }
        return (
          <VisitorProfile
            visitor={selectedVisitor}
            onBack={() => navigateTo('visitors')}
            onEdit={handleEditVisitor}
            onConvertToMember={handleConvertVisitorToMember}
            onViewMember={handleViewMemberById}
          />
        );

      case 'edit-visitor':
        if (!selectedVisitor) { navigateTo('visitors', false); return null; }
        return (
          <EditVisitor
            visitor={selectedVisitor}
            onBack={() => navigateTo('visitor-profile')}
            onSave={handleUpdateVisitor}
          />
        );

      case 'convert-visitor':
        if (!selectedVisitor) { navigateTo('visitors', false); return null; }
        return (
          <AddMember
            onBack={() => navigateTo(convertOriginRef.current === 'services' ? 'services' : 'visitor-profile')}
            onSave={handleSaveConvertedMember}
            visitorData={selectedVisitor}
          />
        );

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
        if (!selectedGivingId) { navigateTo('giving', false); return null; }
        return (
          <GivingDetail
            recordId={selectedGivingId}
            onBack={() => navigateTo('giving')}
            onSaved={() => {
              setGivingRefreshKey(prev => prev + 1);
              navigateTo('giving');
            }}
          />
        );

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

      case 'expenses':
        return (
          <Expenses
            key={expensesRefreshKey}
            onAddExpense={() => navigateTo('add-expense')}
            onViewReceipt={(id) => { setSelectedExpenseId(id); navigateTo('expense-receipt'); }}
            onEditExpense={(id) => { setSelectedExpenseId(id); navigateTo('edit-expense'); }}
            onDeleted={() => setExpensesRefreshKey(prev => prev + 1)}
          />
        );

      case 'add-expense':
        return (
          <AddExpense
            onBack={() => navigateTo('expenses')}
            onSaved={() => { setExpensesRefreshKey(prev => prev + 1); navigateTo('expenses'); }}
          />
        );

      case 'edit-expense':
        if (!selectedExpenseId) { navigateTo('expenses', false); return null; }
        if (!(user?.role === 'admin' || user?.role === 'dev')) {
          toast.error('Admin access required');
          navigateTo('expenses');
          return null;
        }
        return (
          <EditExpense
            expenseId={selectedExpenseId}
            onBack={() => navigateTo('expenses')}
            onSaved={() => { setExpensesRefreshKey(prev => prev + 1); navigateTo('expenses'); }}
          />
        );

      case 'expense-receipt':
        if (!selectedExpenseId) { navigateTo('expenses', false); return null; }
        return (
          <ExpenseReceipt
            expenseId={selectedExpenseId}
            onBack={() => navigateTo('expenses')}
            onEdit={() => navigateTo('edit-expense')}
            onSave={() => navigateTo('expenses')}
          />
        );

      case 'reports':
        return <Reports />;

      case 'services':
        return <Services onViewMember={handleViewMemberById} onConvertVisitor={handleConvertVisitorFromServices} />;

      case 'activity-log':
        return <ActivityLog />;

      case 'ministry':
        return <Ministry />;

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

      case 'children':
        return (
          <Children
            key={childrenRefreshKey}
            onAddChild={handleAddChild}
            onViewChild={handleViewChild}
            onMarkAttendance={handleMarkChildrenAttendance}
            onAddChildVisitor={handleAddChildVisitor}
            onConvertChildVisitor={handleConvertChildVisitorToMember}
            activeTab={childrenActiveTab}
            onTabChange={setChildrenActiveTab}
          />
        );

      case 'children-add':
        return (
          <AddChildMember
            onBack={() => navigateTo('children')}
            onSave={handleSaveChild}
          />
        );

      case 'children-edit':
        if (!selectedChild) { navigateTo('children', false); return null; }
        return (
          <EditChildMember
            child={selectedChild}
            onBack={() => navigateTo('children-profile')}
            onSave={handleUpdateChild}
          />
        );

      case 'children-profile':
        if (!selectedChild) { navigateTo('children', false); return null; }
        return (
          <ChildProfile
            child={selectedChild}
            onBack={() => navigateTo('children')}
            onEdit={handleEditChild}
            onDelete={handleDeleteChild}
            onPromoteToMember={handlePromoteChildToMember}
            onViewMember={handleViewMemberById}
            onViewChild={handleViewChildById}
          />
        );

      case 'children-mark-attendance':
        return (
          <ChildrenMarkAttendance
            onBack={() => navigateTo('children')}
            onSave={handleSaveChildrenAttendance}
          />
        );

      case 'children-add-visitor':
        return (
          <AddChildVisitor
            onBack={() => {
              setChildrenActiveTab('visitors');
              navigateTo('children');
            }}
            onSave={handleSaveChildVisitor}
          />
        );

      case 'convert-child-visitor':
        if (!selectedChildVisitor) { navigateTo('children', false); return null; }
        return (
          <AddChildMember
            onBack={() => navigateTo('children')}
            onSave={handleSaveConvertedChildMember}
            childVisitorData={selectedChildVisitor}
          />
        );

      default:
        return <Dashboard onNavigate={handleNavigate} onQuickAction={handleQuickAction} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      <Suspense fallback={
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        {renderCurrentPage()}
      </Suspense>
    </Layout>
  );
}

import { TutorialProvider } from './components/TutorialContext';
import { TutorialOverlay } from './components/TutorialOverlay';

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-4">We've been notified and are looking into the issue.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
          Refresh Page
        </button>
      </div>
    }>
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
    </Sentry.ErrorBoundary>
  );
}
