import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';

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

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  rolePermissions: RolePermissions;
  updateRolePermissions: (role: UserRole, permissions: string[]) => void;
  toggleUserStatus: (userId: string) => void;
  canAccess: (permission: string) => boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); // Start with no user logged in
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(defaultPermissions);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Initialize session from Supabase on mount
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            isActive: profile.is_active
          });
        }
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Clean up expired temporary permissions
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

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Use real API authentication
      const { api } = await import('../services/api');
      const response = await api.auth.signIn(email, password);

      if (response && response.user && response.session) {
        // Store the session in Supabase client
        await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token
        });

        setUser({
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          isActive: response.user.isActive
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
    logout,
    switchRole,
    isAuthenticated: !!user,
    rolePermissions,
    updateRolePermissions,
    toggleUserStatus,
    canAccess,
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

