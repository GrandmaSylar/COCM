import { OfflineOverlay } from './OfflineOverlay';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { Plus, Edit, Trash2, Users, Shield, Mail, Phone, ArrowLeft, Save, Settings as SettingsIcon, Crown, Clock, Palette, Trash, Search, ArrowUpDown, UserPlus, Calendar, Banknote, BarChart3, Church, ClipboardList, Database, Download, Upload, RefreshCw, HardDrive, FileJson, AlertTriangle, CheckCircle, XCircle, ChevronDown, KeyRound, Circle, Baby, Loader2, Receipt, History, HandHeart, Lock, Info, LayoutGrid, Map } from 'lucide-react';
import { useAuth, UserRole, TemporaryPermission } from './AuthContext';
import { useTheme, ThemeColors, defaultColors } from './ThemeContext';
import { toast } from 'sonner';
import { api, invalidateApiCache } from '../services/api';
import { getFriendlyMessage } from '../utils/error-handler';
import { THEME_PRESETS } from '../utils/themePresets';
import { APP_VERSION, CHANGELOG, BUILD_DATE, GIT_HASH } from '../utils/version';
import { DevSettings } from './DevSettings';
import { ImportMembers } from './ImportMembers';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

interface SettingsProps {
  onAddUser: () => void;
}

const roleLabels = {
  dev: 'Developer',
  admin: 'Administrator',
  pastor: 'Pastor',
  elder: 'Elder'
};

const roleColors = {
  dev: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  pastor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  elder: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
};

const allPermissions = [
  'manage_users', 'manage_roles', 'manage_permissions', 'view_all', 'edit_all', 'delete_all',
  'manage_members', 'view_members', 'edit_members',
  'manage_attendance', 'view_attendance', 'record_attendance',
  'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
  'view_reports', 'manage_settings', 'manage_services', 'manage_theme', 'grant_permissions',
  'create_members', 'update_members', 'delete_members',
  'create_visitors', 'update_visitors', 'delete_visitors',
  'create_attendance', 'update_attendance', 'delete_attendance',
  'create_giving', 'update_giving', 'delete_giving',
  'create_expenses', 'update_expenses', 'delete_expenses',
  'create_children', 'update_children', 'delete_children',
  'create_services', 'update_services', 'delete_services'
];

// Helper function to convert hex to HSL (copied from ThemeContext for local use)
function hexToHSL(hex: string): string {
  // Handle empty or invalid hex
  if (!hex) return '0 0% 0%';
  
  hex = hex.replace('#', '');
  // Handle short hex
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Helper to apply theme colors to DOM
function applyThemeToDom(colors: ThemeColors | null) {
  const root = window.document.documentElement;
  if (colors) {
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--error', colors.error);
    root.style.setProperty('--info', colors.info);
    root.style.setProperty('--muted-custom', colors.muted);
    root.style.setProperty('--border-custom', colors.border);
    root.style.setProperty('--chart-1', colors.chart1);
    root.style.setProperty('--chart-2', colors.chart2);
    root.style.setProperty('--chart-3', colors.chart3);
    root.style.setProperty('--chart-4', colors.chart4);
    root.style.setProperty('--chart-5', colors.chart5);
    try {
      root.style.setProperty('--primary-hsl', hexToHSL(colors.primary));
      root.style.setProperty('--secondary-hsl', hexToHSL(colors.secondary));
    } catch (e) {
      console.warn('Failed to convert hex to HSL', e);
    }
  } else {
    // Revert to defaults by removing properties
    [
      '--primary', '--secondary', '--accent',
      '--success', '--warning', '--error', '--info',
      '--muted-custom', '--border-custom',
      '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
      '--primary-hsl', '--secondary-hsl'
    ].forEach(prop => root.style.removeProperty(prop));
  }
}

export interface CustomRoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  tabAccess: string[];
  dashboardWidgets: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  users: { id: string; name: string }[];
}

export const PERMISSION_GROUPS = {
  Members: ['manage_users', 'manage_roles', 'manage_permissions', 'manage_members', 'view_members', 'edit_members', 'delete_members'],
  Attendance: ['manage_attendance', 'view_attendance', 'record_attendance', 'manage_services'],
  Giving: ['manage_giving', 'view_giving', 'record_giving', 'manage_giving_types'],
  System: ['view_all', 'edit_all', 'delete_all', 'view_reports', 'manage_settings', 'manage_theme', 'grant_permissions']
};

export const TAB_OPTIONS = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'visitors', label: 'Visitors', icon: UserPlus },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'giving', label: 'Giving', icon: Banknote },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'services', label: 'Services', icon: Church },
  { id: 'activity-log', label: 'Activity Log', icon: ClipboardList },
  { id: 'children', label: 'Children', icon: Baby },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'ministry', label: 'Ministry', icon: HandHeart },
  { id: 'zones', label: 'Zones', icon: Map }
];

export const WIDGET_OPTIONS = [
  { id: 'widget_total_members', label: 'Total Members' },
  { id: 'widget_attendance_week', label: 'Weekly Attendance' },
  { id: 'widget_giving_month', label: 'Monthly Giving' },
  { id: 'widget_quick_actions', label: 'Quick Actions' }
];

export const TAB_CRUD_PERMISSIONS: Record<string, string[]> = {
  members: ['create_members', 'update_members', 'delete_members'],
  visitors: ['create_visitors', 'update_visitors', 'delete_visitors'],
  attendance: ['create_attendance', 'update_attendance', 'delete_attendance'],
  giving: ['create_giving', 'update_giving', 'delete_giving'],
  expenses: ['create_expenses', 'update_expenses', 'delete_expenses'],
  children: ['create_children', 'update_children', 'delete_children'],
  services: ['create_services', 'update_services', 'delete_services'],
  reports: [],
  'activity-log': [],
  ministry: [],
  zones: []
};

export function Settings({ onAddUser }: SettingsProps) {
  const {
    user,
    canAccess,
    isDev,
    isAdmin,
    rolePermissions,
    updateRolePermissions,
    toggleUserStatus,
    grantTemporaryPermission,
    revokeTemporaryPermission,
    getUserTemporaryPermissions,
    assignRoleToUser,
    allUsers,
    confirmAction
  } = useAuth();

  const { customColors, setCustomColors, resetColors, isSyncing } = useTheme();

  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [isRoleSheetOpen, setIsRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomRoleDefinition | null>(null);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [expandedSystemRole, setExpandedSystemRole] = useState<string | null>(null);
  const [expandedCustomRole, setExpandedCustomRole] = useState<string | null>(null);

  const [selectedUserForPermission, setSelectedUserForPermission] = useState<string | null>(null);
  const [permissionToGrant, setPermissionToGrant] = useState('');
  const [permissionDuration, setPermissionDuration] = useState('24');
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [allSystemUsers, setAllSystemUsers] = useState<any[]>([]);
  const [userTempPermissions, setUserTempPermissions] = useState<{ [userId: string]: any[] }>({});

  // Edit contact state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Reset password state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordUserName, setResetPasswordUserName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

  // Tick every 60s to keep elapsed time labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Search, filter, and sort state for users list
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'status' | 'lastLogin'>('name');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Theme customization state
  const [themeColorInputs, setThemeColorInputs] = useState<ThemeColors>(
    customColors || defaultColors
  );

  // Collapsible state
  const [userStatsOpen, setUserStatsOpen] = useState(false);
  const [tabAccessOpen, setTabAccessOpen] = useState<Record<string, boolean>>({});

  // Dropdown Options state
  const [dropdownOptions, setDropdownOptions] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  const fetchDropdownOptions = async () => {
    if (!isDev) return;
    setOptionsLoading(true);
    try {
      const data = await api.admin.getOptions();
      setDropdownOptions(data);
      setOptionsError(null);
    } catch (err: any) {
      setOptionsError(err?.message || 'Failed to fetch options');
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    if (!isDev) return;
    setIsRolesLoading(true);
    try {
      const data = await api.customRoles.getAll();
      setCustomRoles(data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch custom roles');
    } finally {
      setIsRolesLoading(false);
    }
  };

  useEffect(() => {
    if (isDev) {
      fetchDropdownOptions();
      fetchCustomRoles();
    }
  }, [isDev]);

  const handleAddOption = async (category: string) => {
    const label = newOptionInputs[category]?.trim();
    if (!label) return;
    
    // Convert label to snake_case for the value
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    
    try {
      const newOpt = await api.admin.createOption({ category, label, value });
      setDropdownOptions(prev => [...prev, newOpt]);
      setNewOptionInputs(prev => ({ ...prev, [category]: '' }));
      toast.success('Option added');
      invalidateApiCache('/options');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add option');
    }
  };

  const handleSaveOptionEdit = async (id: string, category: string) => {
    const label = editingLabel.trim();
    if (!label) return;
    
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    
    try {
      const updated = await api.admin.updateOption(id, { label, value, isActive: true });
      setDropdownOptions(prev => prev.map(o => o.id === id ? updated : o));
      setEditingOptionId(null);
      setEditingLabel('');
      toast.success('Option updated');
      invalidateApiCache('/options');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update option');
    }
  };

  const handleDeactivateOption = async (id: string) => {
    try {
      const updated = await api.admin.updateOption(id, { isActive: false });
      setDropdownOptions(prev => prev.map(o => o.id === id ? updated : o));
      toast.success('Option deactivated');
      invalidateApiCache('/options');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deactivate option');
    }
  };

  const handleReactivateOption = async (id: string) => {
    try {
      const updated = await api.admin.updateOption(id, { isActive: true });
      setDropdownOptions(prev => prev.map(o => o.id === id ? updated : o));
      toast.success('Option reactivated');
      invalidateApiCache('/options');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reactivate option');
    }
  };

  const optionCategories = [
    { id: 'ministries', title: 'Ministries' },
    { id: 'position_held', title: 'Position Held' },
    { id: 'id_types', title: 'ID Types' },
    { id: 'service_types', title: 'Service Types' },
    { id: 'giving_types', title: 'Giving Types' }
  ];

  // Sync theme inputs when customColors changes from server
  useEffect(() => {
    if (customColors) {
      setThemeColorInputs(customColors);
    }
  }, [customColors]);

  // Live Preview: Apply theme colors to DOM immediately when inputs change
  useEffect(() => {
    applyThemeToDom(themeColorInputs);
  }, [themeColorInputs]);

  // Cleanup: Restore original ThemeContext colors when component unmounts
  useEffect(() => {
    return () => {
      // Re-apply the actual saved/synced customColors (or null if none)
      // We read the ref/current value of customColors from the closure if we include it in dependency?
      // No, we want to restore to whatever 'customColors' is at the moment of unmount.
      applyThemeToDom(customColors);
    };
  }, [customColors]);

  const canManageUsers = canAccess('manage_users');
  const canManageSettings = canAccess('manage_settings');
  const canGrantPermissions = canAccess('grant_permissions');
  const canManageTheme = canAccess('manage_theme');

  const fetchUsers = async () => {
    if (!canManageUsers) return;

    try {
      const [allUsersData, pendingUsersData] = await Promise.all([
        api.users.getAll(),
        api.users.getPending()
      ]);
      setAllSystemUsers(allUsersData);
      setPendingUsers(pendingUsersData);

      // Fetch all temporary permissions in one batch call
      if (canGrantPermissions) {
        try {
          const tempPermsMap = await api.users.getAllTemporaryPermissions();
          setUserTempPermissions(tempPermsMap || {});
        } catch (error) {
          console.error('Failed to fetch temp permissions:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch all users and pending users, refresh every 30s for online status
  useEffect(() => {
    fetchUsers();

    const interval = setInterval(() => {
      if (canManageUsers) {
        invalidateApiCache('/users');
        api.users.getAll().then(data => setAllSystemUsers(data)).catch(() => {});
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [canManageUsers, canGrantPermissions]);

  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatExpiration = (date: Date) => {
    const now = new Date();
    const expiresAt = new Date(date);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      return `${Math.floor(diffHours / 24)} days`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    confirmAction({
      title: 'Delete User Account',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
      variant: 'destructive',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.users.delete(userId);
          toast.success('User deleted successfully');
          // Remove from both lists
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
          setAllSystemUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error: any) {
          console.error('Failed to delete user:', error);
          toast.error(getFriendlyMessage(error));
        }
      }
    });
  };


  const handleEditContact = (systemUser: any) => {
    setEditingUserId(systemUser.id);
    setEditEmail(systemUser.email || '');
    setEditPhone(systemUser.phone || '');
  };

  const handleSaveContact = async (userId: string) => {
    setIsSavingContact(true);
    try {
      await api.users.updateContact(userId, { email: editEmail, phone: editPhone });
      toast.success('Contact info updated successfully');
      // Update local state
      setAllSystemUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, email: editEmail, phone: editPhone } : u
      ));
      setEditingUserId(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update contact info');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId) return;
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.users.resetPassword(resetPasswordUserId, newPassword);
      toast.success(`Password reset successfully for ${resetPasswordUserName}`);
      setResetPasswordUserId(null);
      setResetPasswordUserName('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Helper to determine if user is online (heartbeat within last 5 minutes)
  const isUserOnline = (lastLogin?: string) => {
    if (!lastLogin) return false;
    const lastLoginTime = new Date(lastLogin).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return lastLoginTime > fiveMinutesAgo;
  };

  // Helper to format last seen time as timestamp
  const formatLastSeen = (lastLogin?: string) => {
    if (!lastLogin) return 'Offline';
    const date = new Date(lastLogin);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const handleTogglePermission = (role: UserRole, permission: string) => {
    if (!isDev) return;
    
    const currentPermissions = rolePermissions[role] || [];
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter(p => p !== permission)
      : [...currentPermissions, permission];
    
    updateRolePermissions(role, newPermissions);
    toast.success('Role permissions updated');
  };

  const handleGrantTemporaryPermission = async (userId: string, permission: string, durationHours: number) => {
    try {
      await api.users.grantPermission(userId, permission, durationHours);
      toast.success(`Permission granted for ${durationHours} hour${durationHours > 1 ? 's' : ''}`);

      // Refresh temporary permissions for this user
      const perms = await api.users.getTemporaryPermissions(userId);
      setUserTempPermissions(prev => ({ ...prev, [userId]: perms }));
    } catch (error) {
      console.error('Failed to grant permission:', error);
      toast.error('Failed to grant permission');
    }
  };

  const handleRevokePermission = async (userId: string, permission: string) => {
    try {
      await api.users.revokePermission(userId, permission);
      toast.success('Permission revoked');

      // Refresh temporary permissions for this user
      const perms = await api.users.getTemporaryPermissions(userId);
      setUserTempPermissions(prev => ({ ...prev, [userId]: perms }));
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      toast.error('Failed to revoke permission');
    }
  };

  const handleApplyThemeColors = () => {
    setCustomColors(themeColorInputs);
    toast.success('Theme colors updated');
  };

  const handleResetThemeColors = () => {
    resetColors();
    setThemeColorInputs(defaultColors);
    toast.success('Theme colors reset to default');
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await api.users.approve(userId);
      toast.success('User approved successfully');
      // Remove from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      // Update the user in allSystemUsers
      setAllSystemUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, isActive: true, approvalStatus: 'approved' }
          : u
      ));
    } catch (error) {
      console.error('Failed to approve user:', error);
      toast.error('Failed to approve user');
    }
  };

  const handleRejectUser = async (userId: string) => {
    confirmAction({
      title: 'Reject User Request',
      description: 'Are you sure you want to reject this user account request?',
      variant: 'destructive',
      confirmText: 'Reject',
      onConfirm: async () => {
        try {
          await api.users.reject(userId);
          toast.success('User rejected successfully');
          // Remove from pending list
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
          // Update the user in allSystemUsers
          setAllSystemUsers(prev => prev.map(u =>
            u.id === userId
              ? { ...u, isActive: false, approvalStatus: 'rejected' }
              : u
          ));
        } catch (error) {
          console.error('Failed to reject user:', error);
          toast.error('Failed to reject user');
        }
      }
    });
  };


  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      const result = await api.users.updateRole(userId, newRole as any);
      console.log('Role update result:', result);
      const roleName = newRole in roleLabels ? (roleLabels as any)[newRole] : newRole;
      toast.success(`User role updated to ${roleName}`);
      // Update the user in allSystemUsers
      setAllSystemUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, role: newRole }
          : u
      ));
    } catch (error: any) {
      console.error('Failed to update user role:', error);
      toast.error(error?.message || 'Failed to update user role. Please try again.');
    }
  };
  const handleCreateRole = () => {
    setEditingRole(null);
    setIsRoleSheetOpen(true);
  };

  const handleEditRole = (role: CustomRoleDefinition) => {
    setEditingRole(role);
    setIsRoleSheetOpen(true);
  };

  const handleDeleteRole = (role: CustomRoleDefinition) => {
    setDeleteTarget(role);
    setReassignments({});
  };

  const handleRoleSaved = (role: CustomRoleDefinition) => {
    setCustomRoles(prev => {
      const idx = prev.findIndex(r => r.id === role.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = role;
        return next;
      }
      return [...prev, role];
    });
    fetchCustomRoles();
  };

  const handleRoleDeleted = (roleId: string) => {
    setCustomRoles(prev => prev.filter(r => r.id !== roleId));
    setDeleteTarget(null);
  };

  const hasAdminAccess = canManageUsers || canManageSettings;

  const [activeTab, setActiveTab] = useState<string>(
    typeof window !== 'undefined' && window.innerWidth < 1024 ? "menu" : (hasAdminAccess ? "users" : "security")
  );

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && activeTab === "menu") {
        setActiveTab(hasAdminAccess ? "users" : "security");
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, hasAdminAccess]);

  return (
    <>
      <div className="space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full overflow-hidden">
        <div>
          <h1 className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <SettingsIcon className="w-6 h-6" />
            Settings
            {isDev && (
              <Badge variant="outline" className="ml-1 sm:ml-2 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                <Crown className="w-3 h-3 mr-1" />
                Dev Mode
              </Badge>
            )}
            {isAdmin && !isDev && (
              <Badge variant="outline" className="ml-1 sm:ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                Admin
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {hasAdminAccess ? 'System settings, user management, and permissions' : 'Account security settings'}
          </p>
        </div>
        {canManageUsers && (
          <Button onClick={onAddUser}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {isDev && (
        <Alert>
          <Crown className="h-4 w-4" />
          <AlertDescription>
            <strong>Developer Mode Active:</strong> You have supreme access and can modify all role permissions, manage custom roles, assign roles to users, and customize the theme.
          </AlertDescription>
        </Alert>
      )}

      {isAdmin && !isDev && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Administrator Access:</strong> You can grant temporary permissions to Pastor and Elder accounts for limited time periods.
          </AlertDescription>
        </Alert>
      )}

        <Tabs 
          value={activeTab}
          className="w-full flex flex-col gap-4 lg:gap-6 relative"
          onValueChange={(value) => {
            setActiveTab(value);
            if (value === "roles-and-permissions") {
              fetchCustomRoles();
            }
          }}
        >
          {/* Menu wrapper */}
          <div className={`w-full flex-shrink-0 relative ${activeTab !== 'menu' ? 'hidden lg:block' : 'block'}`}>
            <div className="lg:hidden mb-4">
              <h2 className="text-xl font-bold tracking-tight">Settings Menu</h2>
              <p className="text-sm text-muted-foreground">Select a category to view and manage settings.</p>
            </div>
            
            <TabsList className="flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center w-full h-auto bg-transparent border-none gap-3 lg:gap-1 p-0 lg:p-1 lg:border-b">
              
              {/* Account & Access Group */}
              <div className="hidden px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Account & Access
              </div>
              {hasAdminAccess && (
                <TabsTrigger value="users" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <Users className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Users & Permissions</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Manage access and user accounts</span>
                  </div>
                </TabsTrigger>
              )}
              {isDev && (
                <TabsTrigger value="roles-and-permissions" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <Shield className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Roles & Permissions</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Define system roles</span>
                  </div>
                </TabsTrigger>
              )}
              {hasAdminAccess && (
                <TabsTrigger value="import" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <Upload className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Import Members</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Bulk upload members data</span>
                  </div>
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                  <Lock className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                </div>
                <div className="flex flex-col lg:block">
                  <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Security</span>
                  <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Update passwords & security</span>
                </div>
              </TabsTrigger>

              {/* Customization & Settings Group */}
              <div className="hidden px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Customization
              </div>
              <TabsTrigger value="theme" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                  <Palette className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                </div>
                <div className="flex flex-col lg:block">
                  <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Theme</span>
                  <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Customize app appearance</span>
                </div>
              </TabsTrigger>
              {isDev && (
                <TabsTrigger value="dropdown-options" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <ClipboardList className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Dropdown Options</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Manage dropdown selections</span>
                  </div>
                </TabsTrigger>
              )}
              {isDev && (
                <TabsTrigger value="dev-settings" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <LayoutGrid className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Dev Settings</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Advanced developer configurations</span>
                  </div>
                </TabsTrigger>
              )}

              {/* System & About Group */}
              <div className="hidden px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                System
              </div>
              {hasAdminAccess && (
                <TabsTrigger value="backup" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                  <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                    <Database className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                  </div>
                  <div className="flex flex-col lg:block">
                    <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">Backup & Restore</span>
                    <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Manage database backups</span>
                  </div>
                </TabsTrigger>
              )}
              <TabsTrigger value="about" className="w-full lg:w-auto justify-start gap-4 lg:gap-2 h-auto lg:h-9 py-3 lg:py-0 px-4 lg:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-border/50 lg:border-none shadow-sm lg:shadow-none whitespace-normal lg:whitespace-nowrap text-left bg-card lg:bg-transparent rounded-xl lg:rounded-md items-center group">
                <div className="w-10 h-10 lg:w-auto lg:h-auto rounded-full bg-primary/10 lg:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-primary/20 lg:group-hover:bg-transparent transition-colors">
                  <Info className="w-5 h-5 lg:w-4 lg:h-4 text-primary lg:text-inherit" />
                </div>
                <div className="flex flex-col lg:block">
                  <span className="font-semibold lg:font-medium text-base lg:text-sm text-foreground lg:text-inherit">About System</span>
                  <span className="text-xs text-muted-foreground lg:hidden mt-0.5 font-normal">Version and system info</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className={`flex-1 w-full overflow-hidden ${activeTab === 'menu' ? 'hidden lg:block' : 'block'}`}>
            {/* Mobile Back Button */}
            <div className="lg:hidden mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setActiveTab('menu')}
                className="pl-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </Button>
            </div>

        {/* Users & Permissions Tab */}
        <TabsContent value="users" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>

          {/* Pending Users Section */}
          {pendingUsers.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Pending Account Approvals ({pendingUsers.length})
              </h2>
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <Card key={pendingUser.id} className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                        <div className="flex items-start gap-3 sm:gap-4 flex-1">
                          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                              {pendingUser.name.split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                              <h3 className="font-medium">{pendingUser.name}</h3>
                              <Badge className={(roleColors as any)[pendingUser.role] || "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"}>
                                {(roleLabels as any)[pendingUser.role] || pendingUser.role}
                              </Badge>
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                                Pending Approval
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Mail className="w-4 h-4" />
                              {pendingUser.email}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Signed up {new Date(pendingUser.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            onClick={() => handleApproveUser(pendingUser.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectUser(pendingUser.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 w-full sm:w-auto"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* System Overview - Collapsible */}
          <Collapsible open={userStatsOpen} onOpenChange={setUserStatsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  User Statistics ({allSystemUsers.length} Total)
                </span>
                <ChevronDown
                  className="h-4 w-4 transition-transform duration-300 ease-in-out"
                  style={{ transform: userStatsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 w-full">
                <Card className="min-w-0">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{allSystemUsers.length}</p>
                        <p className="text-xs text-muted-foreground">Total Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                        <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{allSystemUsers.filter(u => u.role === 'dev').length}</p>
                        <p className="text-xs text-muted-foreground">Developers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                        <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{allSystemUsers.filter(u => u.role === 'admin').length}</p>
                        <p className="text-xs text-muted-foreground">Admins</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{allSystemUsers.filter(u => u.role === 'pastor').length}</p>
                        <p className="text-xs text-muted-foreground">Pastors</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{allSystemUsers.filter(u => u.role === 'elder').length}</p>
                        <p className="text-xs text-muted-foreground">Elders</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* User List */}
          <div className="w-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2>System Users</h2>
              <Button variant="outline" size="sm" disabled={isRefreshingUsers} onClick={async () => { setIsRefreshingUsers(true); invalidateApiCache('/users'); try { await fetchUsers(); } finally { setIsRefreshingUsers(false); } }} title="Refresh user list">
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingUsers ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Search, Filter, Sort Controls */}
            <div className="flex flex-col gap-2 sm:gap-3 mb-4 overflow-x-hidden">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={`${userSortBy}-${userSortOrder}`} onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-') as [typeof userSortBy, typeof userSortOrder];
                  setUserSortBy(sortBy);
                  setUserSortOrder(sortOrder);
                }}>
                  <SelectTrigger className="w-full min-w-0">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="role-asc">Role (A-Z)</SelectItem>
                    <SelectItem value="role-desc">Role (Z-A)</SelectItem>
                    <SelectItem value="status-asc">Status (Active first)</SelectItem>
                    <SelectItem value="status-desc">Status (Inactive first)</SelectItem>
                    <SelectItem value="lastLogin-desc">Last Login (Recent)</SelectItem>
                    <SelectItem value="lastLogin-asc">Last Login (Oldest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              {(() => {
                // Apply filters and sorting
                let filteredUsers = allSystemUsers.filter(u => {
                  const matchesSearch = userSearchTerm === '' ||
                    u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearchTerm.toLowerCase());

                  const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;

                  let matchesStatus = true;
                  if (userStatusFilter === 'active') {
                    matchesStatus = u.isActive && u.approvalStatus === 'approved';
                  } else if (userStatusFilter === 'inactive') {
                    matchesStatus = !u.isActive && u.approvalStatus === 'approved';
                  } else if (userStatusFilter === 'pending') {
                    matchesStatus = u.approvalStatus === 'pending';
                  }

                  return matchesSearch && matchesRole && matchesStatus;
                });

                // Apply sorting
                filteredUsers.sort((a, b) => {
                  let comparison = 0;
                  switch (userSortBy) {
                    case 'name':
                      comparison = a.name.localeCompare(b.name);
                      break;
                    case 'role':
                      comparison = a.role.localeCompare(b.role);
                      break;
                    case 'status':
                      const aStatus = a.isActive ? 1 : 0;
                      const bStatus = b.isActive ? 1 : 0;
                      comparison = bStatus - aStatus;
                      break;
                    case 'lastLogin':
                      const aDate = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
                      const bDate = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
                      comparison = bDate - aDate;
                      break;
                  }
                  return userSortOrder === 'asc' ? comparison : -comparison;
                });

                if (filteredUsers.length === 0) {
                  return (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">No users found matching your filters.</p>
                      </CardContent>
                    </Card>
                  );
                }

                return filteredUsers.map((systemUser) => {
                const tempPerms = userTempPermissions[systemUser.id] || [];
                
                return (
                  <Card key={systemUser.id} className="hover:shadow-md transition-shadow w-full min-w-0">
                    <CardContent className="p-3 sm:p-4 overflow-hidden">
                      <div className="flex flex-col gap-3 w-full min-w-0">
                        <div className="flex items-start gap-3 sm:gap-4 flex-1">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {systemUser.name.split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                              <h3 className="font-medium">{systemUser.name}</h3>
                              <Badge className={(roleColors as any)[systemUser.role] || "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"}>
                                {(roleLabels as any)[systemUser.role] || systemUser.role}
                              </Badge>
                              {systemUser.approvalStatus === 'pending' && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                                  Pending
                                </Badge>
                              )}
                              {systemUser.approvalStatus === 'rejected' && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                                  Rejected
                                </Badge>
                              )}

                              {/* Online/Offline indicator */}
                              {systemUser.approvalStatus === 'approved' && systemUser.isActive && (
                                <div className={`flex items-center gap-1 text-xs ${isUserOnline(systemUser.lastLogin) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} title={systemUser.lastLogin ? `Last login: ${new Date(systemUser.lastLogin).toLocaleString()}` : 'Never logged in'}>
                                  <Circle className={`w-2 h-2 ${isUserOnline(systemUser.lastLogin) ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`} />
                                  {isUserOnline(systemUser.lastLogin) ? 'Online' : formatLastSeen(systemUser.lastLogin)}
                                </div>
                              )}

                            </div>
                            
                            <div className="space-y-1 mb-3">
                              {editingUserId === systemUser.id ? (
                                <div className="space-y-2 p-2 bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <Input
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      placeholder="Email"
                                      className="h-7 text-sm min-w-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <Input
                                      value={editPhone}
                                      onChange={(e) => setEditPhone(e.target.value)}
                                      placeholder="Phone (e.g. +233...)"
                                      className="h-7 text-sm min-w-0"
                                    />
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveContact(systemUser.id)} disabled={isSavingContact}>
                                      <Save className="w-3 h-3 mr-1" />
                                      {isSavingContact ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingUserId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                                    <Mail className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{systemUser.email}</span>
                                  </div>
                                  {systemUser.phone && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                                      <Phone className="w-4 h-4 flex-shrink-0" />
                                      <span className="truncate">{systemUser.phone}</span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-1.5">
                                    {isDev && systemUser.id !== user?.id && (
                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleEditContact(systemUser)}>
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit contact
                                      </Button>
                                    )}
                                    {/* Reset Password button for admin/dev */}
                                    {(isDev || isAdmin) && systemUser.id !== user?.id && systemUser.approvalStatus === 'approved' && (
                                      !(isAdmin && systemUser.role === 'dev') && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                          onClick={() => {
                                            setResetPasswordUserId(systemUser.id);
                                            setResetPasswordUserName(systemUser.name);
                                          }}
                                        >
                                          <KeyRound className="w-3 h-3 mr-1" />
                                          Reset Password
                                        </Button>
                                      )
                                    )}
                                  </div>
                                </>
                              )}
                              {isDev && systemUser.approvalStatus === 'approved' && systemUser.id !== user?.id && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 min-w-0">
                                  <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground flex-shrink-0">Change Role:</span>
                                  <Select
                                    value={systemUser.role}
                                    onValueChange={(newRole) => handleChangeUserRole(systemUser.id, newRole)}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-full sm:w-40 min-w-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <div className="text-xs font-semibold px-2 py-1.5 text-muted-foreground uppercase">System Roles</div>
                                      {Object.entries(roleLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                      {customRoles.length > 0 && (
                                        <>
                                          <div className="h-px bg-muted my-1" />
                                          <div className="text-xs font-semibold px-2 py-1.5 text-muted-foreground uppercase">Custom Roles</div>
                                          {customRoles.slice().sort((a,b) => a.name.localeCompare(b.name)).map((cr: any) => (
                                            <SelectItem key={cr.id} value={cr.name}>
                                              <div className="flex items-center gap-2">
                                                {cr.name}
                                                <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">Custom</Badge>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            {/* Temporary Permissions */}
                            {tempPerms.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-2 mb-2 min-w-0">
                                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                                    Temporary Permissions
                                  </span>
                                </div>
                                <div className="space-y-2 min-w-0">
                                  {tempPerms.map((tp) => (
                                    <div key={tp.permission} className="flex flex-col sm:flex-row items-start gap-2 text-sm min-w-0">
                                      <span className="text-blue-700 dark:text-blue-300 truncate flex-shrink-0 sm:flex-shrink">
                                        {tp.permission.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                      </span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                          Expires in {formatExpiration(tp.expires_at || tp.expiresAt)}
                                        </span>
                                        {(isAdmin || isDev) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRevokePermission(systemUser.id, tp.permission)}
                                          >
                                            <Trash className="w-3 h-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Tab Access (Dev Only) - Collapsible */}
                            {isDev && systemUser.role !== 'dev' && (
                              <Collapsible
                                  className="mt-4 w-full"
                                  open={tabAccessOpen[systemUser.id] || false}
                                  onOpenChange={(open) => setTabAccessOpen(prev => ({ ...prev, [systemUser.id]: open }))}
                                >
                                  <div className="p-4 bg-gradient-to-r from-secondary/10 to-amber-500/10 dark:from-secondary/20 dark:to-amber-500/20 border border-secondary/30 rounded-xl w-full">
                                    <CollapsibleTrigger asChild>
                                      <button type="button" className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                                            <Shield className="w-4 h-4 text-white" />
                                          </div>
                                          <span className="text-sm font-semibold text-secondary dark:text-blue-300">
                                            Tab Access
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground">
                                            {(systemUser.tabAccess || []).length} of {TAB_OPTIONS.length} tabs
                                          </span>
                                          <ChevronDown
                                            className="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out"
                                            style={{ transform: tabAccessOpen[systemUser.id] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                          />
                                        </div>
                                      </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-3">
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2 overflow-hidden">
                                        {TAB_OPTIONS.map(tab => {
                                        const hasAccess = (systemUser.tabAccess || []).includes(tab.id);
                                        return (
                                          <button
                                            key={tab.id}
                                            onClick={async () => {
                                              const currentTabs = systemUser.tabAccess || [];
                                              const newTabs = hasAccess
                                                ? currentTabs.filter((t: string) => t !== tab.id)
                                                : [...currentTabs, tab.id];
                                              try {
                                                await api.users.setTabAccess(systemUser.id, newTabs);
                                                toast.success(`Updated tab access for ${systemUser.name}`);
                                                fetchUsers();
                                              } catch (err) {
                                                toast.error('Failed to update tab access');
                                              }
                                            }}
                                            className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all min-w-0 ${
                                              hasAccess
                                                ? 'bg-secondary text-white border-secondary shadow-sm shadow-secondary/25'
                                                : 'bg-card text-muted-foreground border-border/50 hover:border-secondary/50 hover:bg-secondary/5'
                                            }`}
                                          >
                                            <tab.icon className="w-4 h-4 flex-shrink-0" />
                                            <span className="line-clamp-1">{tab.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            )}

                            {/* Grant Permission Button */}
                            {canGrantPermissions && (systemUser.role === 'pastor' || systemUser.role === 'elder') && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="mt-3 w-full">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Grant Permission
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Grant Temporary Permission</DialogTitle>
                                    <DialogDescription>
                                      Grant temporary access to {systemUser.name} for a limited time period.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Permission</Label>
                                      <Select
                                        value={permissionToGrant}
                                        onValueChange={setPermissionToGrant}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Select permission" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allPermissions.filter(p => !rolePermissions[systemUser.role]?.includes(p)).map(permission => (
                                            <SelectItem key={permission} value={permission}>
                                              {permission.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Duration</Label>
                                      <Select
                                        value={permissionDuration}
                                        onValueChange={setPermissionDuration}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="1">1 Hour</SelectItem>
                                          <SelectItem value="3">3 Hours</SelectItem>
                                          <SelectItem value="6">6 Hours</SelectItem>
                                          <SelectItem value="12">12 Hours</SelectItem>
                                          <SelectItem value="24">24 Hours</SelectItem>
                                          <SelectItem value="48">48 Hours</SelectItem>
                                          <SelectItem value="168">1 Week</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      onClick={async () => {
                                        if (permissionToGrant) {
                                          await handleGrantTemporaryPermission(
                                            systemUser.id,
                                            permissionToGrant,
                                            parseInt(permissionDuration)
                                          );
                                          setPermissionToGrant('');
                                        }
                                      }}
                                      disabled={!permissionToGrant}
                                    >
                                      Grant Permission
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 pt-2 border-t w-full">
                          {systemUser.id !== user?.id && isDev && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteUser(systemUser.id)}
                              className="text-destructive hover:text-destructive w-full"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              });
              })()}
            </div>
          </div>
        
        </OfflineOverlay>
      </TabsContent>

        {/* Roles & Permissions Tab */}
        {isDev && (
          <TabsContent value="roles-and-permissions" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>

            {/* System Roles */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5" />
                System Roles
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {(['dev', 'admin', 'pastor', 'elder'] as UserRole[]).map((role) => (
                  <SystemRoleCard
                    key={role}
                    role={role}
                    label={(roleLabels as any)[role]}
                    permissions={rolePermissions[role] || []}
                    users={allSystemUsers.filter((u: any) => u.role === role)}
                    isExpanded={expandedSystemRole === role}
                    onToggleExpand={() => setExpandedSystemRole(expandedSystemRole === role ? null : role)}
                    onTogglePermission={(permission: string) => handleTogglePermission(role, permission)}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom Roles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Custom Roles
                </h2>
                <Button onClick={handleCreateRole} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Role
                </Button>
              </div>

              {isRolesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6 h-40 bg-muted/20" />
                    </Card>
                  ))}
                </div>
              ) : customRoles.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No custom roles created yet.</p>
                    <Button variant="link" onClick={handleCreateRole}>Create your first custom role</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customRoles.map((role) => (
                    <CustomRoleCard
                      key={role.id}
                      role={role}
                      isExpanded={expandedCustomRole === role.id}
                      onToggleExpand={() => setExpandedCustomRole(expandedCustomRole === role.id ? null : role.id)}
                      onEdit={() => handleEditRole(role)}
                      onDelete={() => handleDeleteRole(role)}
                    />
                  ))}
                </div>
              )}
            </div>
          
        </OfflineOverlay>
      </TabsContent>
        )}

        {/* Dropdown Options Tab (Dev Only) */}
        {isDev && (
          <TabsContent value="dropdown-options" className="space-y-6">
        <OfflineOverlay>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5" />
                      Dropdown Options
                    </CardTitle>
                    <CardDescription>
                      Manage options for dropdown menus across the system. 
                      Adding a new option makes it immediately available.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchDropdownOptions} disabled={optionsLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${optionsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {optionsError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{optionsError}</AlertDescription>
                  </Alert>
                ) : optionsLoading && dropdownOptions.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {optionCategories.map((cat) => {
                      const catOptions = dropdownOptions
                        .filter(o => o.category === cat.id)
                        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
                      
                      const activeOptions = catOptions.filter(o => o.isActive);
                      const inactiveOptions = catOptions.filter(o => !o.isActive);

                      return (
                        <div key={cat.id} className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            {cat.title}
                            <Badge variant="secondary">{activeOptions.length} Active</Badge>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {catOptions.map(opt => (
                              <div 
                                key={opt.id} 
                                className={`flex items-center justify-between p-3 rounded-md border ${
                                  opt.isActive 
                                    ? 'bg-card' 
                                    : 'bg-muted/50 border-muted opacity-70'
                                }`}
                              >
                                {editingOptionId === opt.id ? (
                                  <div className="flex items-center gap-1 w-full">
                                    <Input
                                      value={editingLabel}
                                      onChange={(e) => setEditingLabel(e.target.value)}
                                      className="h-8 text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveOptionEdit(opt.id, cat.id);
                                        if (e.key === 'Escape') {
                                          setEditingOptionId(null);
                                          setEditingLabel('');
                                        }
                                      }}
                                    />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0 text-green-600" onClick={() => handleSaveOptionEdit(opt.id, cat.id)}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0 text-red-600" onClick={() => {
                                      setEditingOptionId(null);
                                      setEditingLabel('');
                                    }}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {opt.isActive ? null : (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Off</Badge>
                                      )}
                                      <span className={`text-sm truncate font-medium ${!opt.isActive && 'line-through text-muted-foreground'}`}>
                                        {opt.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {opt.isActive ? (
                                        <>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => {
                                            setEditingOptionId(opt.id);
                                            setEditingLabel(opt.label);
                                          }}>
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Deactivate" onClick={() => handleDeactivateOption(opt.id)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleReactivateOption(opt.id)}>
                                          Restore
                                        </Button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            <div className="flex items-center gap-2 p-1">
                              <Input
                                placeholder={`Add ${cat.title}...`}
                                className="h-8 text-sm"
                                value={newOptionInputs[cat.id] || ''}
                                onChange={(e) => setNewOptionInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddOption(cat.id);
                                }}
                              />
                              <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleAddOption(cat.id)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          
        </OfflineOverlay>
      </TabsContent>
        )}

        {/* Dev Settings Tab (Dev Only) */}
        {isDev && (
          <TabsContent value="dev-settings" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>

            <DevSettings />
          
        </OfflineOverlay>
      </TabsContent>
        )}

        {/* Theme Tab (Dev Only) */}
          <TabsContent value="theme" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Theme Customization
                  {isSyncing && (
                    <Badge variant="outline" className="ml-2 text-xs animate-pulse">
                      Syncing...
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Customize the color scheme of the entire system. Changes sync across all devices logged into this account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 overflow-x-hidden">
                {/* Theme Presets */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Theme Presets
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {THEME_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        className="cursor-pointer group relative"
                        onClick={() => {
                          setThemeColorInputs(preset.fullColors);
                          toast.success(`${preset.name} preset loaded. Click Apply to save.`);
                        }}
                      >
                        <div className="aspect-video rounded-lg border-2 mb-2 overflow-hidden relative shadow-sm transition-all group-hover:shadow-md group-hover:scale-105"
                             style={{ borderColor: themeColorInputs.primary === preset.fullColors.primary ? 'var(--primary)' : 'transparent' }}>
                          <div className="absolute inset-0 flex">
                            <div className="w-1/3 h-full" style={{ backgroundColor: preset.colors.primary }} />
                            <div className="w-1/3 h-full" style={{ backgroundColor: preset.colors.secondary }} />
                            <div className="w-1/3 h-full" style={{ backgroundColor: preset.colors.accent }} />
                          </div>
                          {themeColorInputs.primary === preset.fullColors.primary && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <CheckCircle className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-medium text-center truncate">{preset.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Colors */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Main Colors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ColorPicker
                      label="Primary"
                      description="Main brand color, buttons, links"
                      value={themeColorInputs.primary}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, primary: v })}
                    />
                    <ColorPicker
                      label="Secondary"
                      description="Secondary actions, badges"
                      value={themeColorInputs.secondary}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, secondary: v })}
                    />
                    <ColorPicker
                      label="Accent"
                      description="Highlights, special elements"
                      value={themeColorInputs.accent}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, accent: v })}
                    />
                  </div>
                </div>

                {/* Status Colors */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Status Colors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ColorPicker
                      label="Success"
                      description="Success states, completed"
                      value={themeColorInputs.success}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, success: v })}
                    />
                    <ColorPicker
                      label="Warning"
                      description="Warnings, pending states"
                      value={themeColorInputs.warning}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, warning: v })}
                    />
                    <ColorPicker
                      label="Error"
                      description="Errors, destructive actions"
                      value={themeColorInputs.error}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, error: v })}
                    />
                    <ColorPicker
                      label="Info"
                      description="Information, help"
                      value={themeColorInputs.info}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, info: v })}
                    />
                  </div>
                </div>

                {/* UI Colors */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    UI Colors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Muted"
                      description="Muted text, disabled states"
                      value={themeColorInputs.muted}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, muted: v })}
                    />
                    <ColorPicker
                      label="Border"
                      description="Borders, dividers"
                      value={themeColorInputs.border}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, border: v })}
                    />
                  </div>
                </div>

                {/* Chart Colors */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Chart Colors
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <ColorPicker
                      label="Chart 1"
                      value={themeColorInputs.chart1}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, chart1: v })}
                      compact
                    />
                    <ColorPicker
                      label="Chart 2"
                      value={themeColorInputs.chart2}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, chart2: v })}
                      compact
                    />
                    <ColorPicker
                      label="Chart 3"
                      value={themeColorInputs.chart3}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, chart3: v })}
                      compact
                    />
                    <ColorPicker
                      label="Chart 4"
                      value={themeColorInputs.chart4}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, chart4: v })}
                      compact
                    />
                    <ColorPicker
                      label="Chart 5"
                      value={themeColorInputs.chart5}
                      onChange={(v) => setThemeColorInputs({ ...themeColorInputs, chart5: v })}
                      compact
                    />
                  </div>
                </div>

                {/* Color Preview */}
                <div className="p-4 rounded-xl bg-muted/30 border">
                  <h3 className="text-sm font-semibold mb-3">Preview</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(themeColorInputs).map(([key, color]) => (
                      <div
                        key={key}
                        className="w-10 h-10 rounded-lg shadow-sm border"
                        style={{ backgroundColor: color }}
                        title={`${key}: ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-4">
                  <Button onClick={handleApplyThemeColors}>
                    <Save className="w-4 h-4 mr-2" />
                    Apply & Sync Colors
                  </Button>
                  <Button variant="outline" onClick={handleResetThemeColors}>
                    <Trash className="w-4 h-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>

                <Alert>
                  <Palette className="h-4 w-4" />
                  <AlertDescription>
                    Theme colors sync across all devices where this account is logged in. Changes may take up to 30 seconds to appear on other devices.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
        </OfflineOverlay>
          </TabsContent>
        {/* Backup & Restore Tab */}
        {hasAdminAccess && (
          <TabsContent value="backup" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>

            <BackupRestore />
          
        </OfflineOverlay>
      </TabsContent>
        )}

        {/* Import Members Tab */}
        {hasAdminAccess && (
          <TabsContent value="import" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>
            <ImportMembers />
        </OfflineOverlay>
      </TabsContent>
        )}

        <TabsContent value="security" className="space-y-6 w-full overflow-hidden">
        <OfflineOverlay>

          <SecuritySettings />
        
        </OfflineOverlay>
      </TabsContent>

        <TabsContent value="about" className="space-y-6 w-full overflow-hidden">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <img src="/newlogo.png" alt="CoC.M logo" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="text-xl font-bold">CoC.M — Church Management System</h2>
                    <p className="text-sm text-muted-foreground">Empowering churches with modern management tools</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Badge variant="outline" className="w-fit">v{APP_VERSION}</Badge>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Build: {new Date(BUILD_DATE).toLocaleDateString()} {new Date(BUILD_DATE).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Hash: {GIT_HASH}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Software Updates
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check if a newer version of the app is available.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    toast.info('Checking for updates...');
                    try {
                      // Unregister all service workers to clear cached assets
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) {
                          await registration.unregister();
                        }
                      }
                      // Clear all caches
                      if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        for (const name of cacheNames) {
                          await caches.delete(name);
                        }
                      }
                      toast.success('Update check complete. Reloading...');
                      // Hard refresh after a brief delay
                      setTimeout(() => {
                        window.location.reload();
                      }, 800);
                    } catch (err) {
                      console.error('Update check failed:', err);
                      toast.error('Update check failed. Try refreshing manually.');
                    }
                  }}
                  className="shrink-0"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check for Update
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Changelog
            </h3>
            {CHANGELOG.map((entry) => (
              <Card key={entry.version}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">v{entry.version}</Badge>
                    <span className="text-sm text-muted-foreground">{entry.date}</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {entry.changes.map((change, i) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
          </div>
        </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordUserId(null);
          setResetPasswordUserName('');
          setNewPassword('');
          setConfirmPassword('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetPasswordUserName}</strong>. They will need to use this password on their next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-red-500">Passwords do not match</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setResetPasswordUserId(null);
              setResetPasswordUserName('');
              setNewPassword('');
              setConfirmPassword('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isResettingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isResettingPassword ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

      <RoleFormSheet 
        open={isRoleSheetOpen}
        onOpenChange={setIsRoleSheetOpen}
        editingRole={editingRole}
        existingRoles={customRoles}
        onSaved={handleRoleSaved}
      />
      
      <DeleteRoleDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
        deleteTarget={deleteTarget}
        allRoles={customRoles}
        allSystemUsers={allSystemUsers}
        onDeleted={handleRoleDeleted}
      />
    </>
  );
}

// Color Picker Component
function ColorPicker({
  label,
  description,
  value,
  onChange,
  compact = false
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${compact ? '' : 'min-w-0'}`}>
      <Label className="text-xs font-medium">{label}</Label>
      {description && !compact && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 p-1 cursor-pointer border-2 rounded-lg"
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${compact ? 'w-20' : 'flex-1'} h-10 font-mono text-xs`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// Backup & Restore Component
// Available tables for backup/restore
const BACKUP_TABLE_GROUPS = [
  {
    title: 'Members & People',
    tables: [
      { id: 'members', label: 'Members', description: 'Church member records' },
      { id: 'family_members', label: 'Family Links', description: 'Family relationships between members' },
      { id: 'visitors', label: 'Visitors', description: 'Visitor records' },
      { id: 'absentee_records', label: 'Absentee Records', description: 'Absent member tracking' },
      { id: 'member_status_log', label: 'Status History', description: 'Member status change history' },
    ]
  },
  {
    title: 'Attendance & Services',
    tables: [
      { id: 'service_records', label: 'Service Records', description: 'Service records' },
      { id: 'attendance_records', label: 'Attendance Records', description: 'Service attendance summaries' },
      { id: 'attendance_entries', label: 'Attendance Entries', description: 'Individual attendance entries' },
      { id: 'custom_services', label: 'Custom Services', description: 'Custom service types' },
    ]
  },
  {
    title: 'Giving & Finances',
    tables: [
      { id: 'giving_records', label: 'Giving Records', description: 'Offering and donation records' },
      { id: 'custom_giving_types', label: 'Giving Types', description: 'Custom giving categories' },
    ]
  },
  {
    title: 'Expenses',
    tables: [
      { id: 'expense_payment_methods', label: 'Payment Methods', description: 'Expense payment method configurations' },
      { id: 'expense_records', label: 'Expense Records', description: 'Church expense requisition records' },
    ]
  },
  {
    title: "Children's Ministry",
    tables: [
      { id: 'children_members', label: 'Children Members', description: 'Child member records' },
      { id: 'children_member_parents', label: 'Children Member Parents', description: 'Guardian links for child members' },
      { id: 'children_visitors', label: 'Children Visitors', description: 'Child visitor records' },
      { id: 'children_visitor_guardians', label: 'Children Visitor Guardians', description: 'Guardian links for child visitors' },
      { id: 'children_attendance_records', label: 'Children Attendance', description: 'Children\'s service attendance' },
      { id: 'children_giving_records', label: 'Children Giving', description: 'Children\'s giving records' },
    ]
  },
  {
    title: 'System & Security',
    tables: [
      { id: 'custom_roles', label: 'Custom Roles', description: 'Custom role definitions' },
      { id: 'profiles', label: 'User Accounts', description: 'User profiles and settings' },
      { id: 'temporary_permissions', label: 'Temp Permissions', description: 'Temporary user permissions' },
      { id: 'user_tab_access', label: 'Tab Access', description: 'User tab access settings' },
      { id: 'user_settings', label: 'User Settings', description: 'User preferences and themes' },
      { id: 'notifications', label: 'Notifications', description: 'User notifications' },
      { id: 'activity_log', label: 'Activity Logs', description: 'System activity history' },
    ]
  },
  {
    title: 'Settings & Configuration',
    tables: [
      { id: 'system_dropdown_options', label: 'Dropdown Options', description: 'Custom dropdown values (ministries, positions, ID types, etc.)' },
      { id: 'notification_type_config', label: 'Notification Config', description: 'Notification type enable/disable settings' },
      { id: 'activity_log_config', label: 'Activity Log Config', description: 'Activity log action visibility settings' },
    ]
  }
];

const BACKUP_TABLES = BACKUP_TABLE_GROUPS.flatMap(g => g.tables);

function BackupRestore() {
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [lastFullBackup, setLastFullBackup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'differential'>('full');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge' | 'update'>('merge');
  const [restoreFailureMode, setRestoreFailureMode] = useState<'partial' | 'atomic'>('partial');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedBackupData, setUploadedBackupData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Table selection for backup
  const [selectedBackupTables, setSelectedBackupTables] = useState<string[]>(BACKUP_TABLES.map(t => t.id));
  const [selectAllBackup, setSelectAllBackup] = useState(true);

  // Table selection for restore
  const [selectedRestoreTables, setSelectedRestoreTables] = useState<string[]>([]);
  const [selectAllRestore, setSelectAllRestore] = useState(true);

  const toggleBackupTable = (tableId: string) => {
    setSelectedBackupTables(prev => {
      const newSelection = prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId];
      setSelectAllBackup(newSelection.length === BACKUP_TABLES.length);
      return newSelection;
    });
  };

  const toggleAllBackupTables = () => {
    if (selectAllBackup) {
      setSelectedBackupTables([]);
      setSelectAllBackup(false);
    } else {
      setSelectedBackupTables(BACKUP_TABLES.map(t => t.id));
      setSelectAllBackup(true);
    }
  };

  const toggleRestoreTable = (tableId: string) => {
    setSelectedRestoreTables(prev => {
      const availableTables = Object.keys(uploadedBackupData?.data || {});
      const newSelection = prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId];
      setSelectAllRestore(newSelection.length === availableTables.length);
      return newSelection;
    });
  };

  const toggleAllRestoreTables = () => {
    const availableTables = Object.keys(uploadedBackupData?.data || {});
    if (selectAllRestore) {
      setSelectedRestoreTables([]);
      setSelectAllRestore(false);
    } else {
      setSelectedRestoreTables(availableTables);
      setSelectAllRestore(true);
    }
  };

  // Load backup history and last full backup
  const loadBackupData = async () => {
    try {
      const [history, lastFull] = await Promise.all([
        api.backups.getAll(),
        api.backups.getLastFull()
      ]);
      setBackupHistory(history || []);
      setLastFullBackup(lastFull);
    } catch (error) {
      console.error('Failed to load backup data:', error);
      toast.error('Failed to load backup history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackupData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBackupData();
      toast.success('Backup history refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateBackup = async () => {
    if (backupType === 'differential' && !lastFullBackup) {
      toast.error('Please create a full backup first before creating a differential backup');
      return;
    }

    if (selectedBackupTables.length === 0) {
      toast.error('Please select at least one table to backup');
      return;
    }

    setIsCreatingBackup(true);
    try {
      const result = await api.backups.create(backupType, ['device'], selectedBackupTables);

      if (result && result.data) {
        // Download the backup file
        const jsonString = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.metadata.type === 'full'
          ? `backup_full_${new Date().toISOString().split('T')[0]}.json`
          : `backup_diff_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`${backupType === 'full' ? 'Full' : 'Differential'} backup created and downloaded`);
        loadBackupData(); // Refresh history
      }
    } catch (error: any) {
      console.error('Failed to create backup:', error);
      toast.error(error?.message || 'Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.metadata && data.data) {
            setUploadedBackupData(data);
            // Set available restore tables based on backup content
            const availableTables = Object.keys(data.data).filter(t => (data.data[t] || []).length > 0);
            setSelectedRestoreTables(availableTables);
            setSelectAllRestore(true);
            toast.success('Backup file loaded successfully');
          } else {
            toast.error('Invalid backup file format');
            setSelectedFile(null);
          }
        } catch {
          toast.error('Failed to parse backup file');
          setSelectedFile(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePreview = async () => {
    if (!uploadedBackupData) {
      toast.error('Please select a backup file first');
      return;
    }

    if (selectedRestoreTables.length === 0) {
      toast.error('Please select at least one table to restore');
      return;
    }

    try {
      const preview = await api.backups.preview(uploadedBackupData, restoreMode, selectedRestoreTables);
      setPreviewData(preview);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Failed to preview restore:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const handleRestore = async () => {
    if (!uploadedBackupData) {
      toast.error('Please select a backup file first');
      return;
    }

    if (selectedRestoreTables.length === 0) {
      toast.error('Please select at least one table to restore');
      return;
    }

    const tableList = selectedRestoreTables.join(', ');
    if (!confirm(`Are you sure you want to restore the following tables using "${restoreMode}" mode?\n\n${tableList}\n\nThis action may modify your data.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const result = await api.backups.restore(uploadedBackupData, restoreMode, selectedRestoreTables, restoreFailureMode);
      
      if (result.success) {
        toast.success('Backup restored successfully');
        setUploadedBackupData(null);
        setSelectedFile(null);
        setPreviewData(null);
        setShowPreview(false);
      } else {
        toast.error('Some tables failed to restore. Check console for details.');
        console.error('Restore results:', result);
      }
    } catch (error: any) {
      console.error('Failed to restore backup:', error);
      if (error.failedTable) {
        toast.error(`Restore stopped: table '${error.failedTable}' failed — ${error.message}`);
      } else {
        toast.error(getFriendlyMessage(error));
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup record?')) {
      return;
    }

    try {
      await api.backups.delete(backupId);
      toast.success('Backup record deleted');
      loadBackupData();
    } catch (error: any) {
      console.error('Failed to delete backup:', error);
      toast.error(getFriendlyMessage(error));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Backup & Restore
          </h2>
          <p className="text-sm text-muted-foreground">
            Create backups and restore your data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Create Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Create Backup
          </CardTitle>
          <CardDescription>
            Create a full or differential backup of your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Backup */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                backupType === 'full' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setBackupType('full')}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                  backupType === 'full' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {backupType === 'full' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Full Backup
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete snapshot of all data. Recommended weekly/monthly.
                  </p>
                </div>
              </div>
            </div>

            {/* Differential Backup */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                backupType === 'differential' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${!lastFullBackup ? 'opacity-50' : ''}`}
              onClick={() => lastFullBackup && setBackupType('differential')}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                  backupType === 'differential' ? 'border-primary' : 'border-muted-foreground'
                }`}>
                  {backupType === 'differential' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <FileJson className="w-4 h-4" />
                    Differential Backup
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only changes since last full backup. Smaller & faster.
                  </p>
                  {lastFullBackup ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Based on: {formatDate(lastFullBackup.createdAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-orange-500 mt-2">
                      Requires a full backup first
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table Selection for Backup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Tables to Backup</Label>
              <Button variant="ghost" size="sm" onClick={toggleAllBackupTables}>
                {selectAllBackup ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-6 mt-4">
              {BACKUP_TABLE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground/80 uppercase">{group.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.tables.map((table) => (
                      <div
                        key={table.id}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                          selectedBackupTables.includes(table.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleBackupTable(table.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          selectedBackupTables.includes(table.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {selectedBackupTables.includes(table.id) && (
                            <CheckCircle className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{table.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{table.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedBackupTables.length} of {BACKUP_TABLES.length} tables selected
            </p>
          </div>

          <Button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup || selectedBackupTables.length === 0}
            className="w-full sm:w-auto"
          >
            {isCreatingBackup ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Create & Download {backupType === 'full' ? 'Full' : 'Differential'} Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Upload a backup file to restore your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Select Backup File</Label>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Backup Info */}
          {uploadedBackupData && (
            <Alert>
              <FileJson className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Type:</strong> {uploadedBackupData.metadata.type === 'full' ? 'Full Backup' : 'Differential Backup'}</p>
                  <p><strong>Created:</strong> {formatDate(uploadedBackupData.metadata.createdAt)}</p>
                  <p><strong>Records:</strong> {Object.entries(uploadedBackupData.metadata.recordCounts || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Restore Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Restore Mode</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Merge Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'merge'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md'
                    : 'border-border hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/10'
                }`}
                onClick={() => setRestoreMode('merge')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'merge' ? 'border-green-500 bg-green-500' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'merge' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-600" />
                      Merge
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add new records only. Existing records are kept unchanged.
                    </p>
                    <Badge variant="outline" className="mt-2 text-green-600 border-green-300">Safest Option</Badge>
                  </div>
                </div>
              </div>

              {/* Update Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'update'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                    : 'border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                }`}
                onClick={() => setRestoreMode('update')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'update' ? 'border-blue-500 bg-blue-500' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'update' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      Update
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Update existing records and add new ones.
                    </p>
                    <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">Recommended</Badge>
                  </div>
                </div>
              </div>

              {/* Replace Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreMode === 'replace'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30 shadow-md'
                    : 'border-border hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/10'
                }`}
                onClick={() => setRestoreMode('replace')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreMode === 'replace' ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
                  }`}>
                    {restoreMode === 'replace' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-600" />
                      Replace
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Delete all existing data and import from backup.
                    </p>
                    <Badge variant="outline" className="mt-2 text-red-600 border-red-300">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Destructive
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Restore Failure Mode */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Restore Failure Mode</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Partial Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreFailureMode === 'partial'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setRestoreFailureMode('partial')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreFailureMode === 'partial' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {restoreFailureMode === 'partial' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      Partial
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Continue restoring other tables if one fails
                    </p>
                  </div>
                </div>
              </div>

              {/* Atomic Mode */}
              <div
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  restoreFailureMode === 'atomic'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setRestoreFailureMode('atomic')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    restoreFailureMode === 'atomic' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  }`}>
                    {restoreFailureMode === 'atomic' && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      Atomic
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Stop immediately if any table fails
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Selection for Restore */}
          {uploadedBackupData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Tables to Restore</Label>
                <Button variant="ghost" size="sm" onClick={toggleAllRestoreTables}>
                  {selectAllRestore ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="space-y-6 mt-4">
                {BACKUP_TABLE_GROUPS.map((group) => {
                  const groupTables = group.tables.filter(t => {
                    const tableData = uploadedBackupData.data?.[t.id];
                    return tableData && tableData.length > 0;
                  });

                  if (groupTables.length === 0) return null;

                  return (
                    <div key={group.title} className="space-y-3">
                      <h4 className="text-sm font-semibold tracking-tight text-foreground/80 uppercase">{group.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {groupTables.map((table) => {
                          const tableId = table.id;
                          const recordCount = uploadedBackupData.data[tableId].length;
                          return (
                            <div
                              key={tableId}
                              className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                                selectedRestoreTables.includes(tableId)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => toggleRestoreTable(tableId)}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                selectedRestoreTables.includes(tableId) ? 'bg-primary border-primary' : 'border-muted-foreground'
                              }`}>
                                {selectedRestoreTables.includes(tableId) && (
                                  <CheckCircle className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{table.label}</p>
                                <p className="text-xs text-muted-foreground">{recordCount} records</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedRestoreTables.length} tables selected for restore
              </p>
            </div>
          )}

          {/* Preview */}
          {showPreview && previewData && (
            <Alert>
              <AlertDescription>
                <h4 className="font-medium mb-2">Restore Preview ({previewData.mode} mode)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(previewData.tables || {}).map(([table, info]: [string, any]) => (
                    <div key={table} className="p-2 bg-muted rounded">
                      <p className="font-medium">{table}</p>
                      <p>Current: {info.currentCount}</p>
                      <p>Backup: {info.backupCount}</p>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!uploadedBackupData}
            >
              Preview Changes
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!uploadedBackupData || isRestoring}
              variant={restoreMode === 'replace' ? 'destructive' : 'default'}
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Restore Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            Recent backup operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No backups created yet. Create your first backup above.
            </p>
          ) : (
            <div className="space-y-3">
              {backupHistory.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {backup.type === 'full' ? (
                      <Database className="w-5 h-5 text-blue-500" />
                    ) : (
                      <FileJson className="w-5 h-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {backup.type === 'full' ? 'Full Backup' : 'Differential Backup'}
                        {backup.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {backup.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                        {backup.status === 'in_progress' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(backup.createdAt)} • {formatFileSize(backup.fileSize)}
                      </p>
                      {backup.recordCounts && (
                        <p className="text-xs text-muted-foreground">
                          {Object.values(backup.recordCounts).reduce((a: number, b: any) => a + (b || 0), 0)} total records
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={backup.status === 'completed' ? 'default' : backup.status === 'failed' ? 'destructive' : 'secondary'}>
                      {backup.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Security / 2FA Settings Component
function SecuritySettings() {
  const { user, isDev } = useAuth();
  const [twoFAMethod, setTwoFAMethod] = useState<'none' | 'email' | 'phone'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load current 2FA preference from profile
  useEffect(() => {
    const loadPreference = async () => {
      if (!user) return;
      try {
        const { supabase } = await import('@cms/shared');
        const { data: profile } = await supabase
          .from('profiles')
          .select('two_fa_method, phone')
          .eq('id', user.id)
          .single();
        if (profile?.two_fa_method) {
          setTwoFAMethod(profile.two_fa_method);
        }
      } catch (err) {
        console.error('Failed to load 2FA preference:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreference();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.auth.update2FAPreference(twoFAMethod);
      toast.success(
        twoFAMethod === 'none'
          ? 'Two-factor authentication disabled'
          : `Two-factor authentication enabled via ${twoFAMethod === 'email' ? 'Email' : 'Phone SMS'}`
      );
    } catch (err: any) {
      toast.error(getFriendlyMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading security settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account. After entering your password, you'll be asked for a verification code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'none' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => setTwoFAMethod('none')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'none' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'none' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <div>
              <p className="font-medium">Off</p>
              <p className="text-sm text-muted-foreground">Password only (less secure)</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'email' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => setTwoFAMethod('email')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'email' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'email' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Email OTP</p>
              <p className="text-sm text-muted-foreground">Receive a 6-digit code via email ({user?.email})</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              twoFAMethod === 'phone' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50 opacity-60'
            }`}
            onClick={() => setTwoFAMethod('phone')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              twoFAMethod === 'phone' ? 'border-primary' : 'border-muted-foreground'
            }`}>
              {twoFAMethod === 'phone' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Phone SMS OTP</p>
              <p className="text-sm text-muted-foreground">Receive a 6-digit code via SMS</p>
            </div>
          </div>
        </div>

        {twoFAMethod === 'phone' && (
          <Alert>
            <Phone className="h-4 w-4" />
            <AlertDescription>
              Make sure your phone number is set in your profile. SMS charges may apply.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save 2FA Preference'}
          </Button>

          {/* Test Sentry Error Button */}
          {isDev && (
            <Button 
              variant="destructive"
              onClick={() => {
                throw new Error("Sentry Test Error from User Request");
              }}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Test Sentry Error
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Add User Component
interface AddUserProps {
  onBack: () => void;
  onSave: (user: Omit<SystemUser, 'id' | 'lastLogin'>) => void;
}

export function AddUser({ onBack, onSave }: AddUserProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '' as UserRole | '',
    password: '',
    status: 'active' as 'active' | 'inactive',
    twoFaMethod: 'none' as 'none' | 'email' | 'phone'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const { isDev } = useAuth();

  useEffect(() => {
    if (isDev) {
      api.customRoles.getAll().then(setCustomRoles).catch(console.error);
    }
  }, [isDev]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role) return;

    setIsLoading(true);

    try {
      await api.users.create({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone,
        twoFaMethod: formData.twoFaMethod
      });

      toast.success('User created successfully');
      onBack();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      toast.error(getFriendlyMessage(error));
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isValid = formData.name && formData.email && formData.phone && 
                  formData.role && formData.password;

  return (
    <div className="space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden w-full min-w-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1>Add System User</h1>
          <p className="text-muted-foreground">
            Create a new user account
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 w-full overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">System</div>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem 
                        key={value} 
                        value={value}
                        disabled={value === 'dev' && !isDev}
                      >
                        <div className="flex items-center gap-2">
                          {label}
                          {value === 'dev' && <Crown className="w-3 h-3 text-purple-600" />}
                        </div>
                      </SelectItem>
                    ))}

                    {isDev && customRoles.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">Custom</div>
                        {customRoles.map((cr) => (
                          <SelectItem key={cr.id} value={cr.name}>
                            {cr.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {formData.role === 'dev' && !isDev && (
                  <p className="text-xs text-muted-foreground">
                    Only developers can create other developer accounts.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter secure password"
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Two-Factor Authentication</Label>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Enable 2FA</p>
                    <p className="text-xs text-muted-foreground">Require verification code on login</p>
                  </div>
                </div>
                <Switch
                  checked={formData.twoFaMethod !== 'none'}
                  onCheckedChange={(checked) => handleInputChange('twoFaMethod', checked ? 'email' : 'none')}
                />
              </div>
              {formData.twoFaMethod !== 'none' && (
                <div className="flex flex-col gap-3 sm:gap-2">
                  <Button
                    type="button"
                    variant={formData.twoFaMethod === 'email' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputChange('twoFaMethod', 'email')}
                    className="gap-1 w-full sm:w-auto"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={formData.twoFaMethod === 'phone' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputChange('twoFaMethod', 'phone')}
                    disabled={!formData.phone}
                    className="gap-1 w-full sm:w-auto"
                  >
                    <Phone className="w-3 h-3" />
                    Phone SMS
                  </Button>
                  {!formData.phone && formData.twoFaMethod === 'phone' && (
                    <p className="text-xs text-destructive self-center">Phone number required</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={!isValid || isLoading}>
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Creating...' : 'Create User'}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ----- New Components for Custom Roles -----

function SystemRoleCard({ role, label, permissions, users, isExpanded, onToggleExpand, onTogglePermission }: any) {
  const { isDev } = useAuth();
  const isDevRole = role === 'dev';
  
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Badge className={(roleColors as any)[role]}>{label}</Badge>
            {isDevRole && <span className="text-sm text-purple-600 dark:text-purple-400">Supreme Access</span>}
          </div>
          <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={onToggleExpand}>
            <Users className="w-3 h-3 mr-1" />
            {users.length} Users
          </Badge>
        </div>
        
        {isExpanded && users.length > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-md">
            {users.map((u: any) => u.name).join(', ')}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {allPermissions.map((permission: string) => {
            const hasPermission = permissions.includes(permission);
            return (
              <div
                key={permission}
                className={`flex items-center space-x-2 p-2 rounded border min-w-0 ${isDev && !isDevRole ? 'cursor-pointer hover:bg-muted/50' : ''} ${hasPermission ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800'}`}
                onClick={() => !isDevRole && isDev && onTogglePermission(permission)}
              >
                {isDev && !isDevRole && (
                  <Checkbox
                    checked={hasPermission}
                    onCheckedChange={() => onTogglePermission(permission)}
                    disabled={isDevRole}
                  />
                )}
                <span className={`text-xs truncate ${hasPermission ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                  {permission.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
                {isDevRole && <Crown className="w-3 h-3 text-purple-600 dark:text-purple-400 ml-auto flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomRoleCard({ role, isExpanded, onToggleExpand, onEdit, onDelete }: any) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{role.name}</CardTitle>
            {role.description && <CardDescription className="text-xs line-clamp-2 mt-1">{role.description}</CardDescription>}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          {role.permissions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.permissions.slice(0, 3).map((p: string) => (
                <Badge key={p} className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-1.5 py-0">
                  {p.replace(/_/g, ' ')}
                </Badge>
              ))}
              {role.permissions.length > 3 && (
                <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">+{role.permissions.length - 3}</Badge>
              )}
            </div>
          )}
          {role.tabAccess?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.tabAccess.slice(0, 3).map((t: string) => (
                <Badge key={t} className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
              {role.tabAccess.length > 3 && (
                <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">+{role.tabAccess.length - 3}</Badge>
              )}
            </div>
          )}
          {role.dashboardWidgets?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {role.dashboardWidgets.slice(0, 3).map((w: string) => (
                <Badge key={w} className="bg-gray-100 text-gray-800 hover:bg-gray-100 text-[10px] px-1.5 py-0 dark:bg-gray-800 dark:text-gray-300">
                  {w.replace(/-/g, ' ')}
                </Badge>
              ))}
              {role.dashboardWidgets.length > 3 && (
                <Badge className="bg-gray-100 text-gray-800 text-[10px] px-1.5 py-0">+{role.dashboardWidgets.length - 3}</Badge>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 mt-auto border-t text-xs text-muted-foreground flex items-center justify-between">
          <span title={new Date(role.createdAt).toLocaleString()}>
            Created by {role.createdByName || role.createdBy || 'System'} · {new Date(role.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Badge variant="secondary" className="cursor-pointer text-[10px] h-5" onClick={onToggleExpand}>
            <Users className="w-3 h-3 mr-1" />
            {role.users?.length || 0}
          </Badge>
        </div>
        
        {isExpanded && role.users?.length > 0 && (
          <div className="text-xs bg-muted/30 p-2 rounded mt-2 max-h-24 overflow-y-auto">
            {role.users.map((u: any) => u.name).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoleFormSheet({ open, onOpenChange, editingRole, existingRoles, onSaved }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name);
      setDescription(editingRole.description || '');
      setSelectedPermissions(editingRole.permissions || []);
      setSelectedTabs(editingRole.tabAccess || []);
      setSelectedWidgets(editingRole.dashboardWidgets || []);
    } else {
      setName('');
      setDescription('');
      setSelectedPermissions([]);
      setSelectedTabs([]);
      setSelectedWidgets([]);
    }
    setNameError('');
  }, [editingRole, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Role name is required');
      return;
    }
    
    const conflict = existingRoles.find((r: any) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== editingRole?.id);
    if (conflict) {
      setNameError('A role with this name already exists');
      return;
    }
    
    setIsSaving(true);
    setNameError('');
    
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
        tabAccess: selectedTabs,
        dashboardWidgets: selectedWidgets
      };
      
      let result;
      if (editingRole) {
        result = await api.customRoles.update(editingRole.id, payload);
      } else {
        result = await api.customRoles.create(payload);
      }
      
      toast.success(editingRole ? `Role '${name.trim()}' updated.` : `Role '${name.trim()}' created.`);
      onSaved(result);
      onOpenChange(false);
    } catch (err: any) {
      const isNameConflict = err?.message?.toLowerCase().includes('already exists') || err?.message?.toLowerCase().includes('duplicate');
      if (isNameConflict) {
        setNameError(err?.message || 'A role with this name already exists');
      } else {
        toast.error(err?.message || 'Failed to save role');
        setNameError(err?.message || 'Failed to save role');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGroupPermissions = (groupPerms: string[]) => {
    const allSelected = groupPerms.every(p => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !groupPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...groupPerms])));
    }
  };

  const toggleTab = (tabId: string) => {
    setSelectedTabs(prev => {
      const isCurrentlySelected = prev.includes(tabId);
      if (isCurrentlySelected) {
        const tabPerms = TAB_CRUD_PERMISSIONS[tabId] || [];
        if (tabPerms.length > 0) {
          setSelectedPermissions(currentPerms => currentPerms.filter(p => !tabPerms.includes(p)));
        }
        return prev.filter(t => t !== tabId);
      }
      return [...prev, tabId];
    });
  };

  const toggleCrudPermission = (permString: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permString) ? prev.filter(p => p !== permString) : [...prev, permString]
    );
  };

  const toggleWidget = (widgetId: string) => {
    setSelectedWidgets(prev => prev.includes(widgetId) ? prev.filter(w => w !== widgetId) : [...prev, widgetId]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl gap-0">
        <SheetHeader>
          <SheetTitle>{editingRole ? `Edit Role — ${editingRole.name}` : 'Create Custom Role'}</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="role-name">Role Name <span className="text-red-500">*</span></Label>
              <Input 
                id="role-name" 
                value={name} 
                onChange={e => { setName(e.target.value); setNameError(''); }}
                placeholder="e.g. Finance Team"
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea 
                id="role-desc" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder="What can users with this role do?"
                rows={2}
              />
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Function Permissions</h3>
            {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]: any) => (
              <div key={groupName} className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="font-medium text-sm">{groupName}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs px-2"
                    onClick={() => toggleGroupPermissions(perms)}
                  >
                    {perms.every((p: string) => selectedPermissions.includes(p)) ? 'Clear all' : 'Select all'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {perms.map((p: string) => (
                    <div key={p} className="flex items-start space-x-2">
                      <Checkbox 
                        id={`perm-${p}`}
                        checked={selectedPermissions.includes(p)}
                        onCheckedChange={(checked) => {
                          setSelectedPermissions(prev => 
                            checked ? [...prev, p] : prev.filter(x => x !== p)
                          );
                        }}
                      />
                      <label htmlFor={`perm-${p}`} className="text-xs font-medium leading-none cursor-pointer">
                        {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

           <div className="space-y-3">
            <h3 className="font-semibold text-sm">Tab Access</h3>
            <div className="space-y-3 border rounded-lg p-3">
              {TAB_OPTIONS.map(tab => {
                const isSelected = selectedTabs.includes(tab.id);
                const hasCrud = TAB_CRUD_PERMISSIONS[tab.id]?.length > 0;
                const activeCrudPerms = hasCrud 
                  ? TAB_CRUD_PERMISSIONS[tab.id].filter(p => selectedPermissions.includes(p)) 
                  : [];
                const isReadOnly = isSelected && hasCrud && activeCrudPerms.length === 0;

                return (
                  <div key={tab.id} className="flex flex-col space-y-2 pb-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tab-${tab.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleTab(tab.id)}
                      />
                      <label htmlFor={`tab-${tab.id}`} className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer flex-1">
                        <div className="flex items-center gap-1.5 p-1 rounded-md bg-muted/50 border">
                          <tab.icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        {tab.label}
                      </label>
                      {isReadOnly && (
                        <Badge variant="outline" className="text-[10px]">Read only</Badge>
                      )}
                    </div>
                    {isSelected && hasCrud && (
                      <div className="pl-8 flex flex-wrap gap-4">
                        {TAB_CRUD_PERMISSIONS[tab.id].map(perm => {
                          const actionMatch = perm.match(/^(create|update|delete)/);
                          const actionLabel = actionMatch ? actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1) : perm;
                          return (
                            <div key={perm} className="flex items-center space-x-1.5">
                              <Checkbox 
                                id={`crud-${perm}`}
                                checked={selectedPermissions.includes(perm)}
                                onCheckedChange={() => toggleCrudPermission(perm)}
                                className="w-3.5 h-3.5"
                              />
                              <label htmlFor={`crud-${perm}`} className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                                {actionLabel}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Dashboard Widgets</h3>
            <div className="flex flex-wrap gap-2">
              {WIDGET_OPTIONS.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                    selectedWidgets.includes(widget.id) 
                      ? 'bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300' 
                      : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {widget.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingRole ? 'Save Changes' : 'Save Role'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeleteRoleDialog({ open, onOpenChange, deleteTarget, allRoles, allSystemUsers, onDeleted }: any) {
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setReassignments({});
    }
  }, [open]);

  const hasUsers = deleteTarget?.users?.length > 0;
  
  const handleConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    
    try {
      if (hasUsers) {
        const payload = Object.entries(reassignments).map(([userId, newRole]) => ({ userId, newRole }));
        await api.customRoles.delete(deleteTarget.id, payload);
        toast.success(`Role '${deleteTarget.name}' deleted. ${payload.length} users reassigned.`);
      } else {
        await api.customRoles.delete(deleteTarget.id);
        toast.success(`Role '${deleteTarget.name}' deleted.`);
      }
      onDeleted(deleteTarget.id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!deleteTarget) return null;

  if (!hasUsers) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Role
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const isFormValid = Object.keys(reassignments).length === deleteTarget.users.length && 
                      Object.values(reassignments).every(v => v !== '');

  const otherCustomRoles = allRoles.filter((r: any) => r.id !== deleteTarget.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Role & Reassign Users</DialogTitle>
          <DialogDescription>
            The role <strong>{deleteTarget.name}</strong> has {deleteTarget.users.length} users assigned to it. 
            You must reassign them to a new role before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>This action cannot be undone.</AlertDescription>
        </Alert>

        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
          {deleteTarget.users.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between gap-3">
              <span className="text-base font-medium truncate">{u.name}</span>
              <Select 
                value={reassignments[u.id] || ''} 
                onValueChange={(val) => setReassignments(prev => ({ ...prev, [u.id]: val }))}
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">System</div>
                  <SelectItem value="dev">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pastor">Pastor</SelectItem>
                  <SelectItem value="elder">Elder</SelectItem>
                  
                  {otherCustomRoles.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="text-[10px] font-semibold px-2 py-1 text-muted-foreground uppercase">Custom</div>
                      {otherCustomRoles.map((cr: any) => (
                        <SelectItem key={cr.id} value={cr.name}>{cr.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!isFormValid || isDeleting}>
            {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Reassign & Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
