import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type UserRole = 'dev' | 'admin' | 'pastor' | 'elder';

export interface TemporaryPermission {
  permission: string;
  expiresAt: Date;
  grantedBy: string;
  grantedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  temporaryPermissions?: TemporaryPermission[];
  isActive: boolean;
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
const mockUsers: User[] = [
  { 
    id: '1', 
    name: 'Dev Administrator', 
    email: 'dev@cocm.com', 
    role: 'dev',
    isActive: true
  },
  { 
    id: '2', 
    name: 'Kwame Asante', 
    email: 'admin@cocm.com', 
    role: 'admin',
    isActive: true
  },
  { 
    id: '3', 
    name: 'Pastor Emmanuel Adjei', 
    email: 'pastor@cocm.com', 
    role: 'pastor',
    isActive: true
  },
  { 
    id: '4', 
    name: 'Elder Ama Osei', 
    email: 'elder@cocm.com', 
    role: 'elder',
    isActive: true
  },
];

// Demo passwords (in real app, these would be hashed)
const demoCredentials = {
  'dev@cocm.com': 'dev123',
  'admin@cocm.com': 'admin123',
  'pastor@cocm.com': 'pastor123',
  'elder@cocm.com': 'elder123'
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); // Start with no user logged in
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(defaultPermissions);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

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
    // Check credentials
    if (demoCredentials[email as keyof typeof demoCredentials] !== password) {
      return false;
    }

    const foundUser = users.find(u => u.email === email && u.isActive);
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
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

// Export demo credentials for login component
export { demoCredentials };