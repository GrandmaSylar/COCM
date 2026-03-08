import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase/client';
import { clearAllCache } from '../hooks/useCachedData';
import { invalidateApiCache, ApiError } from '../services/api';
import { getFriendlyMessage } from '../utils/error-handler';
import { toast } from 'sonner';

export type UserRole = 'dev' | 'admin' | 'pastor' | 'elder';

export interface TemporaryPermission {
  id?: string;
  userId?: string;
  permission: string;
  expiresAt: Date;
  grantedBy: string;
  grantedAt: Date;
  createdAt?: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: string[]; // Computed from role
  temporaryPermissions?: TemporaryPermission[]; // Fetched from temporary_permissions table
  tabAccess?: string[]; // Tabs this user can access
  isActive: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  // Audit fields
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermissions {
  [key: string]: string[];
}

export interface CustomRole {
  id: string;
  name: string;
  permissions: string[];
  createdBy: string;
  createdAt: Date;
}

export interface TwoFAData {
  requires2FA: true;
  method: 'email' | 'phone';
  userId: string;
  tempToken: string;
  destination: string;
}

export type LoginResult =
  | { success: true; requires2FA?: false }
  | { success: true; requires2FA: true; twoFAData: TwoFAData }
  | { success: false; error: string };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, keepSignedIn?: boolean) => Promise<LoginResult>;
  completeLogin: (session: any, userData: any, keepSignedIn?: boolean) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  isInitializing: boolean;
  rolePermissions: RolePermissions;
  updateRolePermissions: (role: UserRole, permissions: string[]) => void;
  toggleUserStatus: (userId: string) => void;
  canAccess: (permission: string) => boolean;
  hasTabAccess: (tab: string) => boolean;
  isDev: boolean;
  isAdmin: boolean;
  grantTemporaryPermission: (userId: string, permission: string, durationHours: number) => void;
  revokeTemporaryPermission: (userId: string, permission: string) => void;
  getUserTemporaryPermissions: (userId: string) => TemporaryPermission[];
  assignRoleToUser: (userId: string, role: UserRole, temporary?: boolean, durationHours?: number) => void;
  customRoles: CustomRole[];
  addCustomRole: (name: string, permissions: string[]) => void;
  deleteCustomRole: (roleId: string) => void;
  allUsers: User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default permissions for each role
// UPDATED: Elder and Pastor can only VIEW. Admin has full access. Dev has supreme access.
const defaultPermissions: RolePermissions = {
  dev: [
    'manage_users', 'manage_roles', 'manage_permissions', 'view_all', 'edit_all', 'delete_all',
    'manage_members', 'view_members', 'edit_members', 'delete_members',
    'manage_attendance', 'view_attendance', 'record_attendance',
    'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
    'view_reports', 'manage_settings', 'manage_services', 'manage_theme', 'grant_permissions'
  ],
  admin: [
    'manage_users', 'manage_members', 'view_members', 'edit_members', 'delete_members',
    'manage_attendance', 'view_attendance', 'record_attendance',
    'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
    'view_reports', 'manage_settings', 'manage_services', 'grant_permissions'
  ],
  pastor: [
    'view_members', 'view_attendance', 'view_giving', 'view_reports'
  ],
  elder: [
    'view_members', 'view_attendance', 'view_giving', 'view_reports'
  ]
};

// Demo users for Church of Christ, Mataheko Congregation (CoC.M)
const mockUsers: User[] = [];

// Export empty demo credentials for compatibility (using real backend auth now)
export const demoCredentials = {};

// Storage keys
const SUPABASE_STORAGE_KEY = 'sb-szligatlxwpcknwkhdyp-auth-token';
const KEEP_SIGNED_IN_KEY = 'cocm_keep_signed_in';
// Sentinel written to sessionStorage on login — auto-cleared by browser when tab/window closes
const SESSION_ACTIVE_KEY = 'cocm_session_active';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); // Start with no user logged in
  const [isInitializing, setIsInitializing] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(defaultPermissions);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Helper function to fetch user with temporary permissions
  const fetchUserWithPermissions = async (userId: string) => {
    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    // Fetch temporary permissions via API (uses service role, bypasses RLS)
    let temporaryPermissions: TemporaryPermission[] = [];
    try {
      const { api } = await import('../services/api');
      const tempPerms = await api.users.getTemporaryPermissions(userId);

      // Convert to TemporaryPermission format
      temporaryPermissions = (tempPerms || []).map((tp: any) => ({
        id: tp.id,
        userId: tp.user_id,
        permission: tp.permission,
        expiresAt: new Date(tp.expires_at),
        grantedBy: tp.granted_by,
        grantedAt: new Date(tp.created_at),
        createdAt: new Date(tp.created_at)
      }));
    } catch (error) {
      console.error('Failed to fetch temporary permissions:', error);
    }

    // Fetch tab access
    let tabAccess: string[] = [];
    try {
      const { api } = await import('../services/api');
      const tabData = await api.users.getTabAccess(userId);
      tabAccess = tabData?.tabs || [];
    } catch (error) {
      console.error('Failed to fetch tab access:', error);
    }

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      isActive: profile.is_active,
      temporaryPermissions,
      tabAccess,
      createdAt: profile.created_at
    };
  };

  // Initialize session from Supabase on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
        const sessionActive = !!sessionStorage.getItem(SESSION_ACTIVE_KEY);

        // If not keeping signed in and no active session sentinel (browser was closed/reopened),
        // clear the stale localStorage token and force sign out
        if (!keepSignedIn && !sessionActive) {
          localStorage.removeItem(SUPABASE_STORAGE_KEY);
          await supabase.auth.signOut();
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userData = await fetchUserWithPermissions(session.user.id);
          if (userData) {
            setUser(userData);
          }
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      }
    });

    // Safety net: clear localStorage token on tab/browser close if not keeping signed in
    // (sessionStorage sentinel is cleared automatically by the browser)
    const handleUnload = () => {
      if (localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'true') {
        localStorage.removeItem(SUPABASE_STORAGE_KEY);
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Heartbeat - keeps online status current while user is active
  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        const { api } = await import('../services/api');
        await api.auth.heartbeat();
      } catch (err) {
        if (err instanceof ApiError && err.errorObj?.error === 'logged_in_elsewhere') {
          toast.error('You have been signed in on another device. Only one active session is allowed.');
        }
        // All other errors (expired JWT, network failures, etc.) are silently ignored
      }
    };

    // Send immediately on mount/login
    sendHeartbeat();

    // Then every 2 minutes
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Refresh current user's temporary permissions periodically
  // This allows users to get newly granted permissions without re-logging
  useEffect(() => {
    const refreshUserPermissions = async () => {
      if (!user) return;

      try {
        // Fetch current temporary permissions via API (uses service role, bypasses RLS)
        const { api } = await import('../services/api');
        const tempPerms = await api.users.getTemporaryPermissions(user.id);

        // Convert to TemporaryPermission format
        const temporaryPermissions: TemporaryPermission[] = (tempPerms || []).map((tp: any) => ({
          id: tp.id,
          userId: tp.user_id,
          permission: tp.permission,
          expiresAt: new Date(tp.expires_at),
          grantedBy: tp.granted_by,
          grantedAt: new Date(tp.created_at),
          createdAt: new Date(tp.created_at)
        }));

        // Only update if permissions have changed
        const currentPerms = user.temporaryPermissions || [];
        const currentPermStrings = currentPerms.map(p => p.permission).sort().join(',');
        const newPermStrings = temporaryPermissions.map(p => p.permission).sort().join(',');

        if (currentPermStrings !== newPermStrings) {
          setUser(prev => prev ? { ...prev, temporaryPermissions } : null);
        }
      } catch (error) {
        console.error('Failed to refresh temporary permissions:', error);
      }
    };

    // Refresh every 30 seconds
    const interval = setInterval(refreshUserPermissions, 30000);

    // Also refresh immediately when user changes
    if (user) {
      refreshUserPermissions();
    }

    return () => clearInterval(interval);
  }, [user?.id]);

  // Clean up expired temporary permissions from local users list
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers(prevUsers => prevUsers.map(u => ({
        ...u,
        temporaryPermissions: u.temporaryPermissions?.filter(
          tp => new Date(tp.expiresAt) > new Date()
        )
      })));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const login = async (identifier: string, password: string, keepSignedIn = false): Promise<LoginResult> => {
    try {
      // Use real API authentication
      const { api } = await import('../services/api');
      const response = await api.auth.signIn(identifier, password);

      // Check if 2FA is required
      if (response && response.requires2FA) {
        // Store keepSignedIn preference for use after 2FA completes
        if (keepSignedIn) {
          localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
        } else {
          localStorage.removeItem(KEEP_SIGNED_IN_KEY);
        }
        // Write sentinel so current tab stays valid during 2FA
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        return {
          success: true,
          requires2FA: true,
          twoFAData: {
            requires2FA: true,
            method: response.method,
            userId: response.userId,
            tempToken: response.tempToken,
            destination: response.destination,
          }
        };
      }

      if (response && response.user && response.session) {
        // Store the session in Supabase client
        await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token
        });

        if (keepSignedIn) {
          // Persist across browser restarts
          localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
        } else {
          // Session only — sentinel in sessionStorage auto-clears on tab/browser close
          localStorage.removeItem(KEEP_SIGNED_IN_KEY);
        }
        // Always write the sentinel so this tab is considered active
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

        // Fetch user with their temporary permissions from database
        const userData = await fetchUserWithPermissions(response.user.id);
        if (userData) {
          setUser(userData);
        } else {
          // Fallback to basic user data if fetch fails
          setUser({
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role,
            isActive: response.user.isActive
          });
        }
        return { success: true };
      }
      return { success: false, error: 'Login failed. Please try again.' };
    } catch (error: any) {
      console.error('Login error:', error);
      // Use the utility to get a friendly message
      const errorMessage = getFriendlyMessage(error);
      return { success: false, error: errorMessage };
    }
  };

  const completeLogin = async (session: any, userData: any, keepSignedIn = false) => {
    // Set the Supabase session after OTP verification
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (keepSignedIn) {
      localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
    } else {
      localStorage.removeItem(KEEP_SIGNED_IN_KEY);
    }
    // Write sentinel for this tab
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

    // Fetch user with their temporary permissions
    const fullUser = await fetchUserWithPermissions(userData.id);
    if (fullUser) {
      setUser(fullUser);
    } else {
      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        isActive: userData.isActive,
      });
    }
  };

  const logout = async () => {
    // Log the logout activity via API before clearing session
    try {
      const { api } = await import('../services/api');
      await api.auth.signOut();
    } catch {
      // Continue with logout even if API call fails
    }

    // Set user to null first to stop all API calls immediately
    setUser(null);

    // Clear all caches
    clearAllCache();
    invalidateApiCache();

    // Clear localStorage items
    localStorage.removeItem('customThemeColors');
    localStorage.removeItem(KEEP_SIGNED_IN_KEY);

    // Clear Supabase session token from all storage
    localStorage.removeItem(SUPABASE_STORAGE_KEY);
    sessionStorage.removeItem(SUPABASE_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);

    // Clear app state from sessionStorage so login page renders
    sessionStorage.removeItem('currentPage');
    sessionStorage.removeItem('selectedMemberId');
    sessionStorage.removeItem('selectedVisitorId');
    sessionStorage.removeItem('selectedAttendanceId');
    sessionStorage.removeItem('selectedGivingId');
    sessionStorage.removeItem('selectedChildId');

    // Sign out from Supabase and wait for completion
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors, session is already cleared
    }

    // Force redirect to login page
    window.location.href = '/';
  };

  const switchRole = (role: UserRole) => {
    const foundUser = users.find(u => u.role === role && u.isActive);
    if (foundUser) {
      setUser(foundUser);
    }
  };

  const updateRolePermissions = (role: UserRole, permissions: string[]) => {
    // Only dev can modify permissions
    if (user?.role === 'dev') {
      setRolePermissions(prev => ({
        ...prev,
        [role]: permissions
      }));
    }
  };

  const toggleUserStatus = (userId: string) => {
    // Only dev can toggle user status
    if (user?.role === 'dev') {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isActive: !u.isActive } : u
      ));
      
      // If current user is deactivated, log them out
      if (user?.id === userId) {
        logout();
      }
    }
  };

  const canAccess = (permission: string): boolean => {
    if (!user || !user.isActive) return false;

    // Dev role can access everything
    if (user.role === 'dev') return true;

    // Check role-based permissions
    const userPermissions = rolePermissions[user.role] || [];
    if (userPermissions.includes(permission)) return true;

    // Check temporary permissions
    const tempPerms = user.temporaryPermissions || [];
    const validTempPerms = tempPerms.filter(tp => new Date(tp.expiresAt) > new Date());
    return validTempPerms.some(tp => tp.permission === permission);
  };

  const hasTabAccess = (tab: string): boolean => {
    if (!user || !user.isActive) return false;

    // Dev role can access everything
    if (user.role === 'dev') return true;

    // Dashboard, settings, and help are always accessible
    if (['dashboard', 'settings', 'help'].includes(tab)) return true;

    // Check user's tab access
    return (user.tabAccess || []).includes(tab);
  };

  const grantTemporaryPermission = (userId: string, permission: string, durationHours: number) => {
    // Only Admin and Dev can grant temporary permissions
    if (!user || (user.role !== 'admin' && user.role !== 'dev')) return;
    
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id === userId) {
        const existingTempPerms = u.temporaryPermissions || [];
        const newTempPerm: TemporaryPermission = {
          permission,
          expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
          grantedBy: user.id,
          grantedAt: new Date()
        };
        
        // Remove existing temp permission for same permission type
        const filteredPerms = existingTempPerms.filter(tp => tp.permission !== permission);
        
        return {
          ...u,
          temporaryPermissions: [...filteredPerms, newTempPerm]
        };
      }
      return u;
    }));
  };

  const revokeTemporaryPermission = (userId: string, permission: string) => {
    // Only Admin and Dev can revoke temporary permissions
    if (!user || (user.role !== 'admin' && user.role !== 'dev')) return;
    
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          temporaryPermissions: (u.temporaryPermissions || []).filter(
            tp => tp.permission !== permission
          )
        };
      }
      return u;
    }));
  };

  const getUserTemporaryPermissions = (userId: string): TemporaryPermission[] => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return [];
    
    const tempPerms = targetUser.temporaryPermissions || [];
    // Return only valid (not expired) permissions
    return tempPerms.filter(tp => new Date(tp.expiresAt) > new Date());
  };

  const assignRoleToUser = (userId: string, role: UserRole, temporary: boolean = false, durationHours?: number) => {
    // Only Dev can assign roles
    if (!user || user.role !== 'dev') return;
    
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id === userId) {
        if (temporary && durationHours) {
          // Store original role and set expiration
          return {
            ...u,
            role,
            originalRole: u.role,
            roleExpiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000)
          } as any; // Using any to avoid type conflicts with extended properties
        } else {
          // Permanent role change
          return {
            ...u,
            role,
            originalRole: undefined,
            roleExpiresAt: undefined
          };
        }
      }
      return u;
    }));
  };

  const addCustomRole = (name: string, permissions: string[]) => {
    // Only Dev can add custom roles
    if (!user || user.role !== 'dev') return;
    
    const newRole: CustomRole = {
      id: `custom_${Date.now()}`,
      name,
      permissions,
      createdBy: user.id,
      createdAt: new Date()
    };
    
    setCustomRoles(prev => [...prev, newRole]);
  };

  const deleteCustomRole = (roleId: string) => {
    // Only Dev can delete custom roles
    if (!user || user.role !== 'dev') return;
    
    setCustomRoles(prev => prev.filter(r => r.id !== roleId));
  };

  const isDev = user?.role === 'dev';
  const isAdmin = user?.role === 'admin';

  const value = {
    user,
    login,
    completeLogin,
    logout,
    switchRole,
    isAuthenticated: !!user,
    isInitializing,
    rolePermissions,
    updateRolePermissions,
    toggleUserStatus,
    canAccess,
    hasTabAccess,
    isDev,
    isAdmin,
    grantTemporaryPermission,
    revokeTemporaryPermission,
    getUserTemporaryPermissions,
    assignRoleToUser,
    customRoles,
    addCustomRole,
    deleteCustomRole,
    allUsers: users,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

