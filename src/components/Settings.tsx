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
import { Plus, Edit, Trash2, Users, Shield, Mail, Phone, ArrowLeft, Save, Settings as SettingsIcon, Crown, Clock, Palette, Trash, Search, ArrowUpDown, UserPlus, Calendar, DollarSign, BarChart3, Church, ClipboardList } from 'lucide-react';
import { useAuth, UserRole, TemporaryPermission } from './AuthContext';
import { useTheme, ThemeColors } from './ThemeContext';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

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
  'manage_members', 'view_members', 'edit_members', 'delete_members',
  'manage_attendance', 'view_attendance', 'record_attendance',
  'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
  'view_reports', 'manage_settings', 'manage_services', 'manage_theme', 'grant_permissions'
];

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
    customRoles,
    addCustomRole,
    deleteCustomRole,
    allUsers
  } = useAuth();

  const { customColors, setCustomColors, resetColors } = useTheme();

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

  // Search, filter, and sort state for users list
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'status' | 'lastLogin'>('name');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Theme customization state
  const [themeColorInputs, setThemeColorInputs] = useState<ThemeColors>(
    customColors || {
      primary: '#dc2626',    // Red
      secondary: '#3b82f6',  // Blue
      accent: '#ffffff',     // White
      background: '#ffffff',
      foreground: '#0f172a'
    }
  );

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

  // Fetch all users and pending users
  useEffect(() => {
    fetchUsers();
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
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      await api.users.delete(userId);
      toast.success('User deleted successfully');
      // Remove from both lists
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      setAllSystemUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      toast.error(error?.message || 'Failed to delete user. Please try again.');
    }
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
    setThemeColorInputs({
      primary: '#dc2626',    // Red
      secondary: '#3b82f6',  // Blue
      accent: '#ffffff',     // White
      background: '#ffffff',
      foreground: '#0f172a'
    });
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
    if (!confirm('Are you sure you want to reject this user account?')) return;

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
  };

  const handleChangeUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const result = await api.users.updateRole(userId, newRole);
      console.log('Role update result:', result);
      toast.success(`User role updated to ${roleLabels[newRole]}`);
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

  const hasAdminAccess = canManageUsers || canManageSettings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" />
            Settings
            {isDev && (
              <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                <Crown className="w-3 h-3 mr-1" />
                Dev Mode
              </Badge>
            )}
            {isAdmin && !isDev && (
              <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
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

      <Tabs defaultValue={hasAdminAccess ? "users" : "security"} className="space-y-6">
        <TabsList>
          {hasAdminAccess && <TabsTrigger value="users">Users & Permissions</TabsTrigger>}
          {hasAdminAccess && <TabsTrigger value="roles">Role Permissions</TabsTrigger>}
          {isDev && <TabsTrigger value="custom-roles">Custom Roles</TabsTrigger>}
          {canManageTheme && <TabsTrigger value="theme">Theme</TabsTrigger>}
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Users & Permissions Tab */}
        <TabsContent value="users" className="space-y-6">
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                              {pendingUser.name.split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-medium">{pendingUser.name}</h3>
                              <Badge className={roleColors[pendingUser.role as UserRole]}>
                                {roleLabels[pendingUser.role as UserRole]}
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
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApproveUser(pendingUser.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectUser(pendingUser.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
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

          {/* System Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
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

          {/* User List */}
          <div>
            <h2 className="mb-4">System Users</h2>

            {/* Search, Filter, Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-48">
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

            <div className="space-y-4">
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
                  <Card key={systemUser.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {systemUser.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-medium">{systemUser.name}</h3>
                              <Badge className={roleColors[systemUser.role]}>
                                {roleLabels[systemUser.role]}
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
                              {systemUser.approvalStatus === 'approved' && (
                                <Badge variant={systemUser.isActive ? 'default' : 'secondary'}>
                                  {systemUser.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              )}
                              {isDev && systemUser.approvalStatus === 'approved' && (
                                <Switch
                                  checked={systemUser.isActive}
                                  onCheckedChange={() => toggleUserStatus(systemUser.id)}
                                />
                              )}
                            </div>
                            
                            <div className="space-y-1 mb-3">
                              {editingUserId === systemUser.id ? (
                                <div className="space-y-2 p-2 bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <Input
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      placeholder="Email"
                                      className="h-7 text-sm"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <Input
                                      value={editPhone}
                                      onChange={(e) => setEditPhone(e.target.value)}
                                      placeholder="Phone (e.g. +233...)"
                                      className="h-7 text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-2">
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
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="w-4 h-4" />
                                    {systemUser.email}
                                  </div>
                                  {systemUser.phone && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="w-4 h-4" />
                                      {systemUser.phone}
                                    </div>
                                  )}
                                  {isDev && systemUser.id !== user?.id && (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs mt-1 px-2" onClick={() => handleEditContact(systemUser)}>
                                      <Edit className="w-3 h-3 mr-1" />
                                      Edit contact
                                    </Button>
                                  )}
                                </>
                              )}
                              {isDev && systemUser.approvalStatus === 'approved' && systemUser.id !== user?.id && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Shield className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Change Role:</span>
                                  <Select
                                    value={systemUser.role}
                                    onValueChange={(newRole) => handleChangeUserRole(systemUser.id, newRole as UserRole)}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(roleLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            {/* Temporary Permissions */}
                            {tempPerms.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    Temporary Permissions
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {tempPerms.map((tp) => (
                                    <div key={tp.permission} className="flex items-center justify-between text-sm">
                                      <span className="text-blue-700 dark:text-blue-300">
                                        {tp.permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
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

                            {/* Tab Access (Dev Only) */}
                            {isDev && systemUser.role !== 'dev' && (
                              <div className="mt-4 p-4 bg-gradient-to-r from-secondary/10 to-amber-500/10 dark:from-secondary/20 dark:to-amber-500/20 border border-secondary/30 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                                      <Shield className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold text-secondary dark:text-blue-300">
                                      Tab Access
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {(systemUser.tabAccess || []).length} of 7 tabs
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {[
                                    { id: 'members', label: 'Members', icon: Users },
                                    { id: 'visitors', label: 'Visitors', icon: UserPlus },
                                    { id: 'attendance', label: 'Attendance', icon: Calendar },
                                    { id: 'giving', label: 'Giving', icon: DollarSign },
                                    { id: 'reports', label: 'Reports', icon: BarChart3 },
                                    { id: 'services', label: 'Services', icon: Church },
                                    { id: 'activity-log', label: 'Activity Log', icon: ClipboardList },
                                  ].map(tab => {
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
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                          hasAccess
                                            ? 'bg-secondary text-white border-secondary shadow-sm shadow-secondary/25'
                                            : 'bg-card text-muted-foreground border-border/50 hover:border-secondary/50 hover:bg-secondary/5'
                                        }`}
                                      >
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Grant Permission Button */}
                            {canGrantPermissions && (systemUser.role === 'pastor' || systemUser.role === 'elder') && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="mt-3">
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
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select permission" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allPermissions.filter(p => !rolePermissions[systemUser.role]?.includes(p)).map(permission => (
                                            <SelectItem key={permission} value={permission}>
                                              {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                                        <SelectTrigger>
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
                        
                        <div className="flex gap-2">
                          {systemUser.id !== user?.id && isDev && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteUser(systemUser.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </TabsContent>

        {/* Role Permissions Tab */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Role Permissions
                {isDev && (
                  <Badge variant="outline" className="text-xs">
                    Click to toggle permissions
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isDev 
                  ? "Manage default permissions for each role. Dev role always has supreme access."
                  : "View the permissions assigned to each role."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(roleLabels).map(([role, label]) => (
                  <div key={role}>
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={roleColors[role as UserRole]}>
                        {label}
                      </Badge>
                      {role === 'dev' && (
                        <span className="text-sm text-purple-600 dark:text-purple-400">Supreme Access</span>
                      )}
                      {(role === 'pastor' || role === 'elder') && (isAdmin || isDev) && (
                        <span className="text-sm text-muted-foreground">
                          View-only by default. Grant temporary permissions as needed.
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {allPermissions.map(permission => {
                        const hasPermission = rolePermissions[role]?.includes(permission) || false;
                        const isDevRole = role === 'dev';
                        
                        return (
                          <div
                            key={permission}
                            className={`flex items-center space-x-2 p-2 rounded border ${
                              isDev && !isDevRole ? 'cursor-pointer hover:bg-muted/50' : ''
                            } ${
                              hasPermission ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 
                              'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800'
                            }`}
                            onClick={() => !isDevRole && handleTogglePermission(role as UserRole, permission)}
                          >
                            {isDev && !isDevRole && (
                              <Switch
                                checked={hasPermission}
                                onCheckedChange={() => handleTogglePermission(role as UserRole, permission)}
                                disabled={isDevRole}
                              />
                            )}
                            <span className={`text-xs ${
                              hasPermission ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {isDevRole && (
                              <Crown className="w-3 h-3 text-purple-600 dark:text-purple-400 ml-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Roles Tab (Dev Only) */}
        {isDev && (
          <TabsContent value="custom-roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom Roles</CardTitle>
                <CardDescription>
                  Create custom roles with specific permission sets. This feature is coming soon.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Crown className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Custom role management will be available in the next update.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Theme Tab (Dev Only) */}
        {canManageTheme && (
          <TabsContent value="theme" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Theme Customization
                </CardTitle>
                <CardDescription>
                  Customize the color scheme of the entire system. Changes apply to both light and dark modes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primary-color"
                        type="color"
                        value={themeColorInputs.primary}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, primary: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={themeColorInputs.primary}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, primary: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondary-color"
                        type="color"
                        value={themeColorInputs.secondary}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, secondary: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={themeColorInputs.secondary}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, secondary: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accent-color"
                        type="color"
                        value={themeColorInputs.accent}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, accent: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={themeColorInputs.accent}
                        onChange={(e) => setThemeColorInputs({ ...themeColorInputs, accent: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleApplyThemeColors}>
                    <Save className="w-4 h-4 mr-2" />
                    Apply Colors
                  </Button>
                  <Button variant="outline" onClick={handleResetThemeColors}>
                    <Trash className="w-4 h-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>

                <Alert>
                  <Palette className="h-4 w-4" />
                  <AlertDescription>
                    Theme colors are applied globally to both light and dark modes. The system automatically adjusts contrast and brightness for optimal visibility.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        )}
        <TabsContent value="security" className="space-y-6">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Security / 2FA Settings Component
function SecuritySettings() {
  const { user } = useAuth();
  const [twoFAMethod, setTwoFAMethod] = useState<'none' | 'email' | 'phone'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load current 2FA preference from profile
  useEffect(() => {
    const loadPreference = async () => {
      if (!user) return;
      try {
        const { supabase } = await import('../utils/supabase/client');
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
      toast.error(err?.message || 'Failed to update 2FA preference');
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

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save 2FA Preference'}
        </Button>
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
  const { isDev } = useAuth();

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
      toast.error(error.message || 'Failed to create user. Please try again.');
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isValid = formData.name && formData.email && formData.phone && 
                  formData.role && formData.password;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                  <SelectContent>
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
                <div className="flex gap-2 ml-6">
                  <Button
                    type="button"
                    variant={formData.twoFaMethod === 'email' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputChange('twoFaMethod', 'email')}
                    className="gap-1"
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
                    className="gap-1"
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
